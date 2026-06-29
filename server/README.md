# 🎬 Download helper (yt-dlp)

The website is 100% static, but YouTube (and most streaming sites) **can't be downloaded from a
browser or a cloud server** — YouTube blocks cross-origin browser fetches, signs its stream URLs,
and blocks datacenter IPs (so a Vercel serverless function would fail). The reliable way is to run
this tiny helper on **your own computer**: the toolkit's *YouTube Downloader* page talks to it,
`yt-dlp` does the work from your home IP, and the finished file streams back to your browser.

> It only listens on `localhost` (127.0.0.1). Nothing is sent to any third party.

## Setup (one time)
1. Install **Python 3.8+** and **ffmpeg** (https://ffmpeg.org/download.html — needed to merge
   video+audio and to make MP3s).
2. In this folder install yt-dlp:
   ```bash
   pip install -r requirements.txt
   ```

## Run it
- **Windows:** double-click `run.bat`
- **macOS / Linux:** `./run.sh` (or `python3 server.py`)

You'll see `http://localhost:8787`. Keep that window open, then on the site open
**Download → YouTube Downloader** and click **Test connection**.

Custom port: `python server.py 9000` (then set the same URL in the tool).

## Why not just host this on Vercel?
- Serverless functions cap responses at ~4.5 MB and time out in ~10 s on the free plan — far too
  small/short for video.
- YouTube blocks cloud/datacenter IPs with "confirm you're not a bot". Your home IP doesn't hit that.

A local helper sidesteps all of it. (If you have your own VPS/residential proxy you could host
`server.py` there and point the tool's *helper URL* at it — same API.)

## Keeping yt-dlp fresh
YouTube changes often; if downloads break, update yt-dlp:
```bash
pip install -U yt-dlp
```

> Only download content you have the right to (your own uploads, Creative Commons, etc.).
