# get-max-volume.ps1

param (
    [string]$InputPath
)

# Run FFmpeg and capture the output
$ffmpegOutput = ffmpeg -i $InputPath -filter:a "volumedetect" -f null NUL 2>&1

# Extract the line containing max_volume
$match = ($ffmpegOutput | Select-String "max_volume").ToString()

# Use regex to extract the dB value
if ($match -match "max_volume:\s*(-?[0-9.]+)\s*dB") {
    Write-Output ("$($matches[1])dB")
} else {
    Write-Error "max_volume not found"
}
