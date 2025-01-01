import { Browser, Page } from "puppeteer"
import puppeteer from "puppeteer-extra"

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

export async function launchBrowser({ withProxy = true, optimized = true, args = [], ignoreDefaultArgs = [], headless = null, executablePath = undefined }): Promise<[Browser, Page]> {

    // const proxy = getRandomProxy()
    const proxy = { address: null }

    //'--proxy-server=geo.iproyal.com:12321'
    // '--proxy-server=43.159.28.126:2334'
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: headless,
        defaultViewport: {
            width: 1920,
            height: 1080
        },
        args: [...args, '--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials', withProxy ? `--proxy-server=${proxy.address}` : '', "--window-size=1920,1080", "--window-position=0,0"],
        ignoreDefaultArgs: ignoreDefaultArgs
    });

    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(0);

    // Minimize browser
    // CANNOT MINIMIZE OTHERWISE IT ERRORS OUT AND DOESNT LOAD HTML
    // const session = await page.target().createCDPSession();
    // const { windowId } = await session.send('Browser.getWindowForTarget');
    // await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });

    if (withProxy) {
        // await page.authenticate({
        //     username: proxy.user,
        //     password: proxy.password
        // })

        // await page.authenticate({
        //     username: 'u676e79a6573e05d3-zone-custom-region-ca',
        //     password: 'u676e79a6573e05d3'
        // })
    }

    // Block images to speed up loading and reduce proxy bandwidth
    await page.setRequestInterception(true);
    page.on('request', (req) => {

        if (!optimized) {
            req.continue()
            return;
        }

        // || req.resourceType() == 'stylesheet' || req.url().includes('.css')) --> causes errors for outlook
        const cssFilters = ((req.resourceType() == 'stylesheet' || req.url().includes('.css')) && !(req.url().includes('outlook') || req.url().includes('microsoft') || req.url().includes('office')))

        if ((cssFilters || req.resourceType() === 'image' || req.url().includes('v3/open_channels/main/messages') || req.resourceType() == 'font' || req.url().includes('analytics')) && !req.url().includes('recaptcha')) {
            req.abort();
        } else {
            req.continue();
        }
    })

    // Allow scripts to load properly
    await page.setBypassCSP(true)

    return [browser, page]
}


export async function waitForCssSelectorFromDom(page: Page, initialSelector: string, condition: (domElement: Element) => boolean | undefined, selector: (matchedElem: Element) => Element | null, allowPreviousScrapingId = true, timeout = 1000): Promise<string | undefined> {
    let res
    const start = Date.now()

    do {
        res = await getCssSelectorFromDom(page, initialSelector, condition, selector, allowPreviousScrapingId)
    }
    while (res == null && Date.now() - start < timeout)

    return res
}

let funcI = 0
let scrapingI = 0

export async function getCssSelectorFromDom(page: Page, initialSelector: string, condition: (domElement: Element) => boolean | undefined, selector: (matchedElem: Element) => Element | null, allowPreviousScrapingId = true): Promise<string | undefined> {
    const funcId = `getCssSelectorFromDom${funcI++}`
    const funcId2 = `getCssSelectorFromDom${funcI++}`
    const scrapingId = `scraping${scrapingI++}`

    // TODO: add check to make sure scripts load correctly
    await page.addScriptTag({ content: `window.${funcId} = function(elem){return (${condition})(elem)}; console.log("getCssSelectorFromDom script1 loaded")` })
    await page.addScriptTag({ content: `window.${funcId2} = function(elem){return (${selector})(elem)}; console.log("getCssSelectorFromDom script2 loaded")` })

    const res = await page.evaluate(async (initialSelector, funcId, funcId2, scrapingId, allowPreviousScrapingId) => {
        for (const elem of document.querySelectorAll(initialSelector)) {
            if ((window as any)[funcId](elem) && (elem.getAttribute('scraping_id') == null || allowPreviousScrapingId)) {
                const selectedElem = (window as any)[funcId2](elem)
                selectedElem.setAttribute('scraping_id', scrapingId)
                return `${selectedElem.nodeName.toLowerCase()}[scraping_id="${scrapingId}"]`
            }
        }
        return null
    }, initialSelector, funcId, funcId2, scrapingId, allowPreviousScrapingId)

    return res
}

export async function getAllCssSelectorsFromDom(page: Page, initialSelector: string, condition: (domElement: Element) => boolean | undefined, selector: (matchedElem: Element) => Element | null): Promise<Array<string> | undefined> {
    const result: Array<string> = []
    let s = null
    do {
        s = await getCssSelectorFromDom(page, initialSelector, condition, selector, false)
        if (s != null) {
            result.push(s)
        }
    }
    while (s != null)

    return result
}


export async function scrollIntoView(page: Page, selector: string) {
    for (let i = 0; i < 10; i++) {
        await page.$eval(selector, elem => elem.scrollIntoView())
    }
}