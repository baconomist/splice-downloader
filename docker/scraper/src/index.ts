import { Page } from "puppeteer"
import { getCssSelectorFromDom, launchBrowser } from "./utils"
import { spawn } from "child_process"
import * as cheerio from "cheerio"
import fs from "fs"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import path from "path"
import { getAudioLengthInMillis, isEntireAudioSilent, waitForSilence } from "./audioUtils"
import cliProgress from "cli-progress"

const argv = yargs(hideBin(process.argv)).argv
console.log("argv", argv)
let RECORDING_DEVICE = undefined

// const OUTPUT_DIR = '../../out'
// const EXECUTABLE_PATH = undefined
let OUTPUT_DIR = undefined

async function downloadSample(page: Page, sampleUrl: string) {
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

    const outputFilePathWithoutExt = path.resolve(path.join(OUTPUT_DIR, sampleId))

    // TODO: check if we even need this with the new "waitForSilence()" thing
    // const NUM_TAKES = 6
    // const audioTakes = []
    // for (let i = 0; i < NUM_TAKES; i++) {
    //     audioTakes.push(await recordSampleTake(page, outputFilePathWithoutExt, i))
    // }

    // const audioLengths = []
    // for (let i = 0; i < NUM_TAKES; i++) {
    //     audioLengths.push(getAudioLengthInMillis(audioTakes[i]))
    // }

    let takeFile
    do {
        takeFile = await recordSampleTake(page, outputFilePathWithoutExt, 0)
    } while (await isEntireAudioSilent(takeFile))

    fs.cpSync(takeFile, outputFilePathWithoutExt + ".wav")
    fs.rmSync(takeFile)

    console.log("Writing metadata to json file...")
    fs.writeFileSync(`${outputFilePathWithoutExt}.json`, JSON.stringify({ title: title, artist: author, album: samplePack, bpm: bpm, fileUrl: sampleUrl, sampleId: sampleId }))
}

async function recordSampleTake(page: Page, outputFilePathWithoutExt: string, sampleTake: number) {
    const takeOutputPath = `${outputFilePathWithoutExt}_${sampleTake}.wav`
    const recordingHandle = startRecording(takeOutputPath)

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

    // Create a new progress bar instance and use shades_classic theme
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)

    // Start the progress bar with a total value of 100 and start value of 0
    bar.start(1, 0)

    // Progress bar resets back to 0 when sample finished playing
    let progress = 0
    do {
        progress = parseFloat(await page.$eval(progressSelector, (e) => e.getAttribute("value")))
        bar.update(progress)
    } while (progress <= 0)

    do {
        progress = parseFloat(await page.$eval(progressSelector, (e) => e.getAttribute("value")))
        bar.update(progress)
    } while (progress > 0)

    bar.stop()

    console.log("Finished sample playback")

    // Wait a little bit before terminating recording to make sure we capture all the audio
    await waitForSilence({ deviceName: RECORDING_DEVICE })

    await stopRecording(recordingHandle)

    return takeOutputPath
}

function startRecording(filePath: string) {
    console.log(`Starting recording to: ${filePath}`)

    // NOTE: on windows Voicemeter must be setup correctly for this to work
    // Set VoiceMeter (input) as default device, use MME output to avoid noise/grain audio issues
    // PICK DEVICE NAME FROM:
    // ffmpeg -list_devices true -f dshow -i dummy
    // Make sure voicemeter outputs to both:
    // 1. MME HEADSET
    // 2. MME VB INPUT

    // Outputs .wav @ 48khz, 16-bit depth (tho the actual audio might not be this quality pretty sure splice preview is close to this quality)
    const procHandle = argv.testMode
        ? spawn("ffmpeg", ["-y", "-f", "dshow", "-i", RECORDING_DEVICE, "-acodec", "pcm_s24le", "-ar", "48000", filePath])
        : spawn("ffmpeg", ["-y", "-f", "pulse", "-i", RECORDING_DEVICE, "-acodec", "pcm_s24le", "-ar", "48000", filePath])

    let stdout = ""
    procHandle.stdout.on("data", (msg) => {
        stdout += msg.toString()
    })

    let stderr = ""
    procHandle.stderr.on("data", (err) => {
        stderr += err.toString()
    })

    procHandle.on("close", () => {
        console.log(stdout)
        if (stderr.trim().length > 0) {
            console.error("FFMPEG ERROR:", stderr)
            console.log("FFMPEG ERROR ^^^ (MIGHT NOT BE ERROR IF SUCCESSFUL RECORDING CUS WE KILL WITH SIGINT)")
        }
    })

    return procHandle
}

async function stopRecording(recordingHandle) {
    console.log("Stopping recording...")

    // send interrupt to stop recording
    recordingHandle.kill("SIGINT")

    // Give time for ffmpeg to exit
    await new Promise((r) => setTimeout(r, 500))

    console.log("Stopped recording")
}

;(async () => {
    let [browser, page] = [undefined, undefined]
    if (argv.testMode) {
        RECORDING_DEVICE = "audio=CABLE Output (VB-Audio Virtual Cable)"
        // ENV FOR LOCAL TESTING
        OUTPUT_DIR = "./out"
        console.log("Executing in TEST mode")

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR)
        }

        ;[browser, page] = await launchBrowser({ withProxy: false, optimized: false, headless: false })
        await downloadSample(page, process.argv[2])
        console.log("Finished")
        await new Promise((r) => setTimeout(r, 99999))
        await browser.close()
        process.exit(1)
    } else {
        // ENV FOR DOCKER
        RECORDING_DEVICE = "virtual-capture-recorder.monitor"
        OUTPUT_DIR = "/out"
        const EXECUTABLE_PATH = "/usr/bin/google-chrome"

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR)
        }

        ;[browser, page] = await launchBrowser({ withProxy: false, optimized: false, args: ["--use-fake-ui-for-media-stream"], ignoreDefaultArgs: ["--mute-audio"], headless: "new", executablePath: EXECUTABLE_PATH })
        await downloadSample(page, process.argv[2])
        await browser.close()
    }
})()
