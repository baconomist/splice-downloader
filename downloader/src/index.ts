import glob from "glob"
import { Page } from "puppeteer"
import { getAllCssSelectorsFromDom, getCssSelectorFromDom, launchBrowser, scrollElemIntoView, scrollIntoView, waitForCssSelectorFromDom } from "./utils"
import { spawnSync, execSync, exec } from 'child_process'
import * as id3 from 'node-id3'
import path from "path"
import fs from "fs"

async function downloadPack(packUrl: string) {
    console.log("Downloading Pack...")
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
    console.log("Downloading Sample...")
    let success = false
    let done = false

    function onExecComplete(err, stdout, stderr) {
        success = !err
        done = true
        console.log("OUTPUT:", err, stdout, stderr)
    }

    if (process.platform == 'win32') {
        exec(`docker run --rm -v %pwd%/out:/out spliceaudiorecorder /bin/bash -c "./run.sh ${sampleUrl}"`, onExecComplete)
    }
    else{
        exec(`docker run --rm -v $(pwd)/out:/out spliceaudiorecorder /bin/bash -c "./run.sh ${sampleUrl}"`, onExecComplete)
    }

    while (!done) { await new Promise(r => setTimeout(r, 1)) }

    if (!success) {
        console.log(`Retrying for sample ${sampleUrl}`)
        return downloadSample(sampleUrl)
    }
}

function getMostRecentFile(dir) {
    return glob.sync(`${dir}/*mp3`)
    .map(name => ({name, ctime: fs.statSync(name).ctime}))
    .sort((a, b) => b.ctime - a.ctime)[0].name
}

(async () => {
    // TODO: require to run this as SUDO

    const url = process.argv[2]

    if (!url) throw new Error("Invalid args! Usage: downloader packUrl or downloader sampleUrl")

    const isPack = url.includes('pack')

    if (isPack) {
        // 'https://splice.com/sounds/packs/sample-magic/house-nation-2/samples'
        await downloadPack(url)
    }
    else {
        // await downloadSample('https://splice.com/sounds/sample/2ddb9b4c76074cb1c648a85959206aa54e2893a493ea8cd2ab50b1f0bdf29786')
        await downloadSample(url)
    }

    const mostRecentFile = getMostRecentFile("./out")
    const trimCmd = `ffmpeg -i ${mostRecentFile} -af silenceremove=1:0:-50dB ${mostRecentFile.replace(".mp3", '').replace(".wav", '')}_trimmed.mp3`
    console.log(trimCmd)

    let done = false

    exec(trimCmd, (err, stdout, stderr) => {
        done = true
        console.log("OUTPUT:", err, stdout, stderr)
    })

    while (!done) { await new Promise(r => setTimeout(r, 1)) }

    process.exit(1)

    // await new Promise(r => setTimeout(r, 99999))
})()
