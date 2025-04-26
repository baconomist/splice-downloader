import { spawn } from "child_process"

export async function waitForSilence({
    deviceName = "CABLE Output (VB-Audio Virtual Cable)",
    silenceThreshold = -30, // dB
    silenceDuration = 0.1, // seconds
}) {
    return new Promise<void>((resolve, reject) => {
        const args = ["-f", "dshow", "-i", deviceName, "-af", `silencedetect=n=${silenceThreshold}dB:d=${silenceDuration}`, "-f", "null", "-"]

        const ffmpeg = spawn("ffmpeg", args)

        ffmpeg.stderr.on("data", (data) => {
            const output = data.toString()
            console.log(output)

            // Look for silence start
            if (output.includes("silence_start")) {
                console.log("🤫 Silence detected!")
                ffmpeg.kill() // Stop the ffmpeg process
                resolve()
            }
        })

        ffmpeg.on("error", (err) => {
            reject(err)
        })

        ffmpeg.on("exit", (code) => {
            if (code !== 0) {
                console.log(`ffmpeg exited with code ${code}`)
            }
        })
    })
}

export async function getAudioLengthInMillis(filePath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath])

        let output = ""

        ffprobe.stdout.on("data", (data) => {
            output += data.toString()
        })

        ffprobe.stderr.on("data", (data) => {
            console.error(`ffprobe error: ${data}`)
        })

        ffprobe.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`ffprobe exited with code ${code}`))
            } else {
                const seconds = parseFloat(output.trim())
                const millis = Math.round(seconds * 1000)
                resolve(millis)
            }
        })
    })
}
