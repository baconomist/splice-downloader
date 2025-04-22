import { Page } from "puppeteer"
import { getAllCssSelectorsFromDom, getCssSelectorFromDom, launchBrowser, waitForCssSelectorFromDom } from "./utils"
import { spawn } from "child_process"
import * as id3 from "node-id3"
import * as cheerio from "cheerio"
import fs from "fs"

// const OUTPUT_DIR = '../../out'
// const EXECUTABLE_PATH = undefined
const EXECUTABLE_PATH = "/usr/bin/google-chrome"
const OUTPUT_DIR = "/out"

async function downloadSample(page: Page, sampleUrl: string) {
    // await page.goto('https://splice.com/sounds/sample/5eabcd8df2080d86acdffac638c4ca588cf1a1454f6ee6b0599189bfb2e8353f/sample-magic-house-drums-kicks-deep-house-house-tech-house-sample')
    // const sampleUrl = 'https://splice.com/sounds/sample/2ddb9b4c76074cb1c648a85959206aa54e2893a493ea8cd2ab50b1f0bdf29786'
    // const sampleUrl = 'https://splice.com/sounds/sample/7e830523e0fa1e64e5ef2487fe8c07cfa577a60cd5362249105d8c45978c88c0'
    await page.goto(sampleUrl)
    await page.waitForNetworkIdle({ idleTime: 1000 })

    const sampleId = sampleUrl.replace("//", "/").split("/")[4]
    let title = null
    const htmlContent = await page.content()

    const parser = cheerio.load(htmlContent)

    title = parser(parser('[class^="title "]')[0]).text()

    // Bpm can be null for kicks etc
    let bpm
    try {
        bpm = parser(
            parser("*").filter((i, el) => {
                return parser(el).text().toLocaleLowerCase() == "bpm"
            })[0].parent.lastChild
        ).text()
        console.log("BPM:", bpm)
    } catch (e) {}

    const samplePack = parser(parser(".subheading").children("a")[0]).text()
    const author = parser(parser(".subheading").children("a")[1]).text()

    console.log(`Sample info: Title: ${title} Bpm: ${bpm} Pack: ${samplePack} Author: ${author}`)

    // const key =
    // const tags = await page.$eval('sp-tags', e => e.)

    const [recordingHandle, filePath] = startRecording(sampleId)

    await page.waitForNetworkIdle({ idleTime: 1000 })
    const selector = await getCssSelectorFromDom(
        page,
        "span",
        (elem) => elem.innerHTML.includes("Play"),
        (e) => e
    )
    await page.click(selector)

    const progressSelector = 'progress[class*="progress-bar"]'
    await page.waitForSelector(progressSelector)

    // Progress bar resets back to 0 when sample finished playing
    let progress = 0
    do {
        progress = parseFloat(await page.$eval(progressSelector, (e) => e.getAttribute("value")))
        console.log("Progress", progress)
    } while (progress <= 0)

    do {
        progress = parseFloat(await page.$eval(progressSelector, (e) => e.getAttribute("value")))
        console.log("Progress", progress)
    } while (progress > 0)

    console.log("Done recording")

    // Wait a little bit before terminating recording to make sure we capture all the audio
    await new Promise((r) => setTimeout(r, 250))
    stopRecording(recordingHandle, filePath, { title: title, artist: author, album: samplePack, bpm: bpm, fileUrl: sampleUrl, sampleId: sampleId })
}

function startRecording(fileNameWithExt: string) {
    const filePath = OUTPUT_DIR + `/${fileNameWithExt}.wav`

    // Outputs .wav @ 48khz (tho the actual audio might not be this quality)
    return [spawn("ffmpeg", ["-f", "pulse", "-i", "virtual-capture-recorder.monitor", "-acodec", "pcm_s24le", "-ar", "48000", filePath]), filePath]

    // return [spawn("ffmpeg", ["-f", "pulse", "-i", "virtual-capture-recorder.monitor", "-acodec", "mp3", filePath]), filePath]

    // return [spawn('ffmpeg', ['-f', 'pulse', '-i', 'default', filePath]), filePath]
}

function stopRecording(recordingHandle, filePath, metaData) {
    // send interrupt to stop recording
    recordingHandle.kill("SIGINT")

    // id3.write(metaData, filePath)
    // console.log(id3.read(filePath))
    fs.writeFileSync(`${filePath}.json`, JSON.stringify(metaData))

    console.log("Stopped recording")
}

;(async () => {
    // const [browser, page] = await launchBrowser({ withProxy: false, optimized: false, headless: false })
    const [browser, page] = await launchBrowser({ withProxy: false, optimized: false, args: ["--use-fake-ui-for-media-stream"], ignoreDefaultArgs: ["--mute-audio"], headless: "new", executablePath: EXECUTABLE_PATH })

    await downloadSample(page, process.argv[2])

    await browser.close()
    // process.exit(1)

    // await new Promise(r => setTimeout(r, 99999))
})()
