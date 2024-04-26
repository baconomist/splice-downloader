# sudo docker run --rm spliceaudiorecorder /bin/bash
echo "ARG $1"
sudo docker run --rm -v $(pwd)/out:/out spliceaudiorecorder /bin/bash -c "./run.sh $1"

# -it
# --rm -c "./run.sh"

# apt install wget
# wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
# dpkg -i google-chrome-stable_current_amd64.deb