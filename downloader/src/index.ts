import glob from "glob"
import { Page } from "puppeteer"
import { getAllCssSelectorsFromDom, getCssSelectorFromDom, launchBrowser, scrollElemIntoView, scrollIntoView, waitForCssSelectorFromDom } from "./utils"
import { spawnSync, execSync, exec } from "child_process"
import * as id3 from "node-id3"
import path from "path"
import fs from "fs"

const ABLETON_DIR = `C:\\Users\\Lucas\\Documents\\Ableton\\User Library\\Samples\\Splice`

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

    const NUM_PROCS = 1
    let runningProcs = []
    for (const sampleUrl of sampleUrls) {
        runningProcs.push(downloadAndPostProcessSample(sampleUrl))
        if (runningProcs.length >= NUM_PROCS) {
            const first = await Promise.race(runningProcs)
            runningProcs.splice(runningProcs.indexOf(first), 1)
        }
    }

    await Promise.all(runningProcs)
}

type SampleData = { audioFilePath: string; metaData: { title: string; artist: string } & any }

async function downloadAndPostProcessSample(sampleUrl: string) {
    const downloadedSample = await downloadSample(sampleUrl)
    await postProcessSample(downloadedSample)
}

async function downloadSample(sampleUrl: string): Promise<SampleData> {
    console.log("Downloading Sample...")
    let success = false
    let done = false

    const sampleId = sampleUrl.replace("//", "/").split("/")[4]
    const outputAudioPath = `./out/${sampleId}.wav`
    const outputMetaFilePath = `./out/${sampleId}.wav.json`

    function onExecComplete(err, stdout, stderr) {
        success = !err
        done = true
        console.log("OUTPUT:", err, stdout, stderr)
    }

    if (process.platform == "win32") {
        exec(`docker run --rm -v "%cd%\\out:/out" spliceaudiorecorder /bin/bash -c "./run.sh ${sampleUrl}"`, onExecComplete)
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

    const metaData = JSON.parse(fs.readFileSync(outputMetaFilePath, "utf-8"))
    fs.rmSync(outputMetaFilePath)

    metaData.title = metaData.title.replace(".wav", "").replace(".aif", "").replace(".flac", "")

    return { audioFilePath: outputAudioPath, metaData: metaData }
}

async function execAndWaitForCMD(cmd: string): Promise<string> {
    let done = false

    console.log("Executing: ", cmd)
    let output = undefined
    exec(cmd, (err, stdout, stderr) => {
        done = true
        output = stdout
        console.log("OUTPUT:", err, stdout, stderr)
    })

    while (!done) {
        await new Promise((r) => setTimeout(r, 1))
    }

    return output.trim()
}

async function postProcessSample(sampleData: SampleData) {
    const filePath = sampleData.audioFilePath

    // CONVERT TO WAV CUS FUCKING MP3 ALWAYS HAS LIKE 2ms of start silence FFUCK MP3
    const tmpFilePath = `${filePath}_tmp.wav`
    const tmpNormalizedFilePath = `${filePath}_tmp_normalized.wav`
    const processedFileOutputPath = `${filePath}.wav`

    const createTmpFileCMD = `mv ${filePath} ${tmpFilePath}`
    await execAndWaitForCMD(createTmpFileCMD)

    let dbLevel = await execAndWaitForCMD(`powershell.exe -ExecutionPolicy Bypass -File ./getMaxVolume.ps1 -InputPath "${tmpFilePath}"`)
    const positiveDB = dbLevel.replace("-", "")
    console.log("DB LEVEL:", positiveDB)

    const normalizeCMD = `ffmpeg -i ${tmpFilePath} -filter:a "volume=${positiveDB}" ${tmpNormalizedFilePath} -f null NUL`
    await execAndWaitForCMD(normalizeCMD)

    // const trimSilenceCMD = `ffmpeg -y -i ${tmpNormalizedFilePath} -af silenceremove=1:0:-50dB ${outputFilePath}`
    const trimSilenceCMD = `ffmpeg -y -i ${tmpNormalizedFilePath} -af silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB ${processedFileOutputPath}`
    await execAndWaitForCMD(trimSilenceCMD)

    const filesToCleanUp = [tmpFilePath, tmpNormalizedFilePath]

    for (const file of filesToCleanUp) {
        await execAndWaitForCMD(`rm -rf ${file}`)
    }

    const outDest = outDir ?? ABLETON_DIR

    if (!fs.existsSync(outDest)) {
        fs.mkdirSync(outDest, { recursive: true })
    }

    fs.copyFileSync(processedFileOutputPath, path.join(outDest, `${sampleData.metaData.title}.wav`))
    fs.rmSync(processedFileOutputPath)
}

let outDir = undefined
;(async () => {
    // TODO: require to run this as SUDO

    const url = process.argv[2]
    outDir = process.argv[3]

    if (!url) throw new Error("Invalid args! Usage: downloader packUrl or downloader sampleUrl")

    const isPack = url.includes("pack")

    if (isPack) {
        await execAndWaitForCMD(`rm -rf ./out`)
        fs.mkdirSync("./out")

        // 'https://splice.com/sounds/packs/sample-magic/house-nation-2/samples'

        const artistName = url.replace("//", "/").split("/")[4]
        const packName = url.replace("//", "/").split("/")[5]
        console.log("ARTIST NAME:", packName)
        console.log("PACK NAME:", packName)

        if (!outDir) {
            outDir = path.join(ABLETON_DIR, artistName, packName)
        }

        console.log("OUT DIR:", outDir)

        await downloadPack(url)
    } else {
        // await downloadSample('https://splice.com/sounds/sample/2ddb9b4c76074cb1c648a85959206aa54e2893a493ea8cd2ab50b1f0bdf29786')
        await downloadAndPostProcessSample(url)
    }

    process.exit(1)

    // await new Promise(r => setTimeout(r, 99999))
})()
