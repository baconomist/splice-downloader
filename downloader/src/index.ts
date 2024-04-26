import { Page } from "puppeteer"
import { getAllCssSelectorsFromDom, getCssSelectorFromDom, launchBrowser, scrollElemIntoView, scrollIntoView, waitForCssSelectorFromDom } from "./utils"
import { spawnSync, execSync, exec } from 'child_process'
import * as id3 from 'node-id3'

async function downloadPack(packUrl: string) {
    const [browser, page] = await launchBrowser({ withProxy: false, optimized: false, args: ['--use-fake-ui-for-media-stream'], ignoreDefaultArgs: ['--mute-audio'], headless: false })

    async function inner(pageNumber = 1) {
        await page.goto(`${packUrl}?page=${pageNumber}`, { waitUntil: ['domcontentloaded', 'networkidle2'] })
        const sampleBtns = await page.$$('sp-overflow-menu')

        const numSamplesOnPage = sampleBtns.length
        // This means it's the last page
        // TODO: test edge cases, ex: is it 51?
        if (numSamplesOnPage < 50)
            return

        for (const btn of sampleBtns) {
            try {
                await scrollElemIntoView(page, btn)
                await btn.click()

                const linkSelector = await getCssSelectorFromDom(page, 'button', elem => elem.innerHTML.includes('Copy link'), e => e)
                await page.click(linkSelector)
                const sampleUrl = await page.evaluate(() => navigator.clipboard.readText())
                await downloadSample(sampleUrl)
            }
            catch (e) {

            }
        }

        return inner(pageNumber + 1)
    }

    await inner()

    await browser.close()
}

async function downloadSample(sampleUrl: string) {
    let success = false
    let done = false
    exec(`./run-container.sh ${sampleUrl}`, { encoding: 'utf8' }, (err, stdout, stderr) => {
        success = !err
        done = true
        console.log("OUTPUT:", err, stdout, stderr)
    })

    while (!done) { await new Promise(r => setTimeout(r, 1)) }

    if (!success) {
        console.log(`Retrying for sample ${sampleUrl}`)
        return downloadSample(sampleUrl)
    }
}

(async () => {
    // TODO: require to run this as SUDO
    // await downloadSample('https://splice.com/sounds/sample/2ddb9b4c76074cb1c648a85959206aa54e2893a493ea8cd2ab50b1f0bdf29786')
    await downloadPack('https://splice.com/sounds/packs/sample-magic/house-nation-2/samples')

    process.exit(1)

    // await new Promise(r => setTimeout(r, 99999))
})()
