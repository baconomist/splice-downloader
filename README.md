## A tool that lets you download samples from splice

## Usage

1. Install docker: https://www.docker.com/

2. Install nodejs + npm: https://nodejs.org/en/download

3. ```cd downloader && npm i``` 

4. ```cd scraper && ./build.sh```

5. ```cd downloader && npm run dev <sample url> or <sample pack url>```

## DISCLAIMER
This tool is only for educational purposes and should be used in accordance with applicable laws.
I do not bear any responsibility for misuse of this tool and/or damages caused via copyright infringement.


## DONATIONS

If you've got spare change, any donations would be greatly appreciated :)

**Monereo Wallet:**
`4AAkqVtvaKP6gE7V3FJ99qJ8svT3CC5HeKHtAzECJB63UdQGEW9Zmnc9YCBtiq2PTfSVkLtScnBYWBPhiNMVVfw8QDHPgpQ`


## TODO:
- skip already downloaded files
- fix url ?page= so that you can paste in pack links w/ search queries
- instantly trim audio after each individual sample download from the pack --> move audio trimming into docker container
- show progress % for pack download
- argv: --num-procs x --> for # of parallel


## TODO: audio content checker
sometimes the downloaded audio file is empty or it doesnt actually capture the entire recording
we need a way to:
- verify the length of the file within a given percentage
- verify the file isnt empty

if either is true, re-download