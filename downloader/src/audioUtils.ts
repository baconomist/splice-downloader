import { spawn } from "child_process";
import path from "path";

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