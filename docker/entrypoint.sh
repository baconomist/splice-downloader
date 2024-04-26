# Cleanup to be "stateless" on startup, otherwise pulseaudio daemon can't start
rm -rf /var/run/pulse /var/lib/pulse /root/.config/pulse

# Start the pulseaudio server
pulseaudio -D --verbose --exit-idle-time=-1 --system --disallow-exit

# # Load the virtual sink and set it as default
# pacmd load-module module-virtual-sink sink_name=v1
# pacmd set-default-sink v1

# # set the monitor of v1 sink to be the default source
# pacmd set-default-source v1.monitor

# Create a virtual audio source; fixed by adding source master and format
# echo "Creating virtual audio source: ";
# pactl load-module module-virtual-source master=auto_null.monitor format=s16le source_name=VirtualMic

# Set VirtualMic as default input source;
# echo "Setting default source: ";
# pactl set-default-source VirtualMic

echo "Creating virtual audio out:"

pactl load-module module-null-sink sink_name=virtual-capture-speaker
pactl load-module module-null-sink sink_name=virtual-capture-recorder
pactl load-module module-loopback source=virtual-capture-speaker.monitor sink=virtual-capture-recorder

# ffmpeg -f pulse -i virtual-capture.monitor -t 3600 -acodec mp3 output.mp3

# pactl load-module module-virtual-sink sink_name=v1
# pactl set-default-sink v1

# # set the monitor of v1 sink to be the default source
# pactl set-default-source v1.monitor



# How It Works:
#     Source: The audio source from which the audio is captured. This can be a physical device like a microphone or a virtual source such as the monitor of a sink (which outputs what is being played to the sink).
#     Sink: The destination for the audio. This can be a physical device like speakers or headphones, or a virtual sink, which can be used for capturing and processing audio without outputting to any physical device.