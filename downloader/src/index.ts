import glob from "glob"
import { Page } from "puppeteer"
import { getAllCssSelectorsFromDom, getCssSelectorFromDom, launchBrowser, scrollElemIntoView, scrollIntoView, waitForCssSelectorFromDom } from "./utils"
import { spawnSync, execSync, exec } from "child_process"
import * as id3 from "node-id3"
import path from "path"
import fs from "fs"

async function downloadPack(packUrl: string) {
    console.log("Downloading Pack...")
    const [browser, page] = await launchBrowser({ withProxy: false, optimized: false, args: ["--use-fake-ui-for-media-stream"], ignoreDefaultArgs: ["--mute-audio"], headless: false })

    let sampleUrls = []
    async function inner(pageNumber = 1) {
        await page.goto(`${packUrl}?page=${pageNumber}`, { waitUntil: ["domcontentloaded", "networkidle2"] })

        await page.waitForSelector('a[href^="https://splice.com/sounds/sample/"]')

        const sampleLinks = await page.$$('a[href^="https://splice.com/sounds/sample/"]')

        const numSamplesOnPage = sampleLinks.length

        for (const link of sampleLinks) {
            const sampleUrl = await link.evaluate((el) => el.href)
            console.log(sampleUrl)
            sampleUrls.push(sampleUrl)
        }

        // This means it's the last page
        // TODO: test edge cases, ex: is it 51?
        if (numSamplesOnPage < 50) return

        return inner(pageNumber + 1)
    }

    await inner()

    await browser.close()

    let runningProcs = []
    for (const sampleUrl of sampleUrls) {
        runningProcs.push(downloadSample(sampleUrl))
        if (runningProcs.length >= 5) {
            await Promise.all(runningProcs)
            runningProcs = []
        }
    }

    await Promise.all(runningProcs)
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

    if (process.platform == "win32") {
        exec(`docker run --rm -v %pwd%/out:/out spliceaudiorecorder /bin/bash -c "./run.sh ${sampleUrl}"`, onExecComplete)
    } else {
        exec(`docker run --rm -v $(pwd)/out:/out spliceaudiorecorder /bin/bash -c "./run.sh ${sampleUrl}"`, onExecComplete)
    }

    while (!done) {
        await new Promise((r) => setTimeout(r, 1))
    }

    if (!success) {
        console.log(`Retrying for sample ${sampleUrl}`)
        return downloadSample(sampleUrl)
    }
}

function getMostRecentFile(dir) {
    return glob
        .sync(`${dir}/*mp3`)
        .map((name) => ({ name, ctime: fs.statSync(name).ctime }))
        .sort((a, b) => b.ctime - a.ctime)[0].name
}

async function postProcessFile(filePath: string) {
    const trimCmd = `ffmpeg -i ${filePath} -af silenceremove=1:0:-50dB ${filePath.replace(".mp3", "").replace(".wav", "")}_trimmed.mp3`
    console.log(trimCmd)

    let done = false

    exec(trimCmd, (err, stdout, stderr) => {
        done = true
        console.log("OUTPUT:", err, stdout, stderr)
    })

    while (!done) {
        await new Promise((r) => setTimeout(r, 1))
    }

    let done2 = false

    const rmOriginalFileCmd = `rm -rf ${filePath}`
    exec(rmOriginalFileCmd, (err, stdout, stderr) => {
        done2 = true
        console.log("OUTPUT:", err, stdout, stderr)
    })

    while (!done2) {
        await new Promise((r) => setTimeout(r, 1))
    }
}

;(async () => {
    // TODO: require to run this as SUDO

    const url = process.argv[2]

    if (!url) throw new Error("Invalid args! Usage: downloader packUrl or downloader sampleUrl")

    const isPack = url.includes("pack")

    if (isPack) {
        // 'https://splice.com/sounds/packs/sample-magic/house-nation-2/samples'
        await downloadPack(url)

        const files = glob.sync(`./out/*mp3`)

        const promises = []
        for (const file of files) {
            if (file.includes("_trimmed")) continue
            promises.push(postProcessFile(file))
        }
        await Promise.all(promises)
    } else {
        // await downloadSample('https://splice.com/sounds/sample/2ddb9b4c76074cb1c648a85959206aa54e2893a493ea8cd2ab50b1f0bdf29786')
        await downloadSample(url)

        const mostRecentFile = getMostRecentFile("./out")
        await postProcessFile(mostRecentFile)
    }

    process.exit(1)

    // await new Promise(r => setTimeout(r, 99999))
})()
