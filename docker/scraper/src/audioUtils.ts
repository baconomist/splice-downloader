import { spawn } from "child_process"
import path from "path"

export async function waitForSilence({
    deviceName = "CABLE Output (VB-Audio Virtual Cable)",
    silenceThreshold = -30, // dB
    silenceDuration = 0.1, // seconds
    timeout = 1000, // millis
    onTimeout = () => {}
}) {
    return new Promise<void>((resolve, reject) => {
        console.log("Waiting for silence...")
        setTimeout(() => {
            resolve()
            onTimeout()
        }, timeout)
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

export async function isEntireAudioSilent(filePath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', path.resolve(filePath),
      '-af', 'silencedetect=n=-50dB:d=1', // Silence threshold: -50dB, duration: 1 second
      '-f', 'null',                      // Output format: null (discard audio/video output)
      '-'                                 // Don't output any actual file
    ]);

    let output = '';

    ffmpeg.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffmpeg.stderr.on('data', (data) => {
      output += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
      } else {
        // Check if there's any part of the file that is not silent
        const silenceStart = /silence_start/.test(output);
        const silenceEnd = /silence_end/.test(output);

        // If there's silence_start but no valid non-silent audio, it's full silence
        if (silenceStart && !silenceEnd) {
          resolve(true); // The file is full of silence
        } else {
          resolve(false); // The file contains non-silent parts
        }
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}