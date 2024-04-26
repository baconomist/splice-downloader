FROM ubuntu

RUN apt update

RUN apt install vim -y

# INSTALL AUDIO STUFF
RUN apt install pulseaudio socat -y
RUN apt install alsa-utils -y
RUN apt install ffmpeg -y
# END INSTALL AUDIO STUFF

# Install nodejs
ENV NODE_VERSION=20.12.2
RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"
RUN node --version
RUN npm --version
RUN npm install -g typescript
RUN npm install -g ts-node

# END Install nodejs

# Install chrome

RUN apt-get update && apt-get install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt-get install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*


# CODE STUFF
COPY ./run.sh .

RUN chmod +x ./run.sh

RUN mkdir scraper
COPY ./scraper ./scraper
  
WORKDIR scraper
RUN npm install
WORKDIR /

COPY entrypoint.sh /opt/bin/entrypoint.sh
RUN chmod +x /opt/bin/entrypoint.sh

RUN adduser root pulse-access
# ENTRYPOINT /opt/bin/entrypoint.sh