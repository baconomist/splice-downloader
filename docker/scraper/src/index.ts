import { Page } from "puppeteer"
import { getAllCssSelectorsFromDom, getCssSelectorFromDom, launchBrowser, waitForCssSelectorFromDom } from "./utils"
import { spawn } from 'child_process'
import * as id3 from 'node-id3'

// const OUTPUT_DIR = '../../out'
// const EXECUTABLE_PATH = undefined
const EXECUTABLE_PATH = '/usr/bin/google-chrome'
const OUTPUT_DIR = '/out'

async function downloadSample(page: Page, sampleUrl: string) {
    // await page.goto('https://splice.com/sounds/sample/5eabcd8df2080d86acdffac638c4ca588cf1a1454f6ee6b0599189bfb2e8353f/sample-magic-house-drums-kicks-deep-house-house-tech-house-sample')
    // const sampleUrl = 'https://splice.com/sounds/sample/2ddb9b4c76074cb1c648a85959206aa54e2893a493ea8cd2ab50b1f0bdf29786'
    // const sampleUrl = 'https://splice.com/sounds/sample/7e830523e0fa1e64e5ef2487fe8c07cfa577a60cd5362249105d8c45978c88c0'
    await page.goto(sampleUrl)

    await page.waitForSelector('.title')

    const title = await page.$eval('h3[class="title"]', e => e.innerHTML)
    
    // Bpm can be null for kicks etc
    let bpm
    try {
        bpm = await page.$eval('div[data-qa="sound-details.bpm"]', e => e.innerHTML)
        console.log("BPM:", bpm)
    }
    catch (e) {

    }
    
    const author = await page.$eval('a[data-qa="sound-details.provider"', e => e.innerHTML)
    const samplePack = await page.$eval('a[data-qa="sound-details.pack"', e => e.innerHTML)

    // const key = 
    // const tags = await page.$eval('sp-tags', e => e.)

    const [recordingHandle, filePath] = startRecording(title)

    const selector = await getCssSelectorFromDom(page, 'span', elem => elem.innerHTML.includes('Play'), e => e)
    await page.click(selector)

    const progressSelector = 'progress[class="progress-bar hidden-background"]'
    await page.waitForSelector(progressSelector)

    // Progress bar resets back to 0 when sample finished playing
    let progress = 0
    do {
        progress = parseFloat(await page.$eval(progressSelector, (e) => e.getAttribute('value')))
        console.log("Progress", progress)
    } while (progress <= 0)

    do {
        progress = parseFloat(await page.$eval(progressSelector, (e) => e.getAttribute('value')))
        console.log("Progress", progress)
    } while (progress > 0)

    console.log("Done recording")

    // Wait a little bit before terminating recording to make sure we capture all the audio
    await new Promise(r => setTimeout(r, 250))
    stopRecording(recordingHandle, filePath, { title: title, artist: author, album: samplePack, bpm: bpm, fileUrl: sampleUrl })
}

function startRecording(fileNameWithExt: string) {
    const filePath = OUTPUT_DIR + `/${fileNameWithExt}.mp3`

    return [spawn('ffmpeg', ['-f', 'pulse', '-i', 'virtual-capture-recorder.monitor', '-acodec', 'mp3', filePath]), filePath]

    // return [spawn('ffmpeg', ['-f', 'pulse', '-i', 'default', filePath]), filePath]
}

function stopRecording(recordingHandle, filePath, metaData) {
    // send interrupt to stop recording
    recordingHandle.kill("SIGINT")

    // id3.write(metaData, filePath)
    // console.log(id3.read(filePath))

    console.log("Stopped recording")
}

(async () => {
    const [browser, page] = await launchBrowser({ withProxy: false, optimized: false, args: ['--use-fake-ui-for-media-stream'], ignoreDefaultArgs: ['--mute-audio'], headless: "new", executablePath: EXECUTABLE_PATH })

    await downloadSample(page, process.argv[2])

    await browser.close()
    // process.exit(1)

    // await new Promise(r => setTimeout(r, 99999))
})()