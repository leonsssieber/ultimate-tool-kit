#!/usr/bin/env python3
"""
Ultimate Toolkit — local download helper.

Runs entirely on YOUR machine and wraps yt-dlp so the website (even when hosted on
Vercel over HTTPS) can download YouTube/etc. videos from your own IP. Nothing is sent
to any third party — it only listens on localhost.

Requirements:
  - Python 3.8+
  - yt-dlp   ->  pip install -r requirements.txt   (or: pip install yt-dlp)
  - ffmpeg   ->  must be on your PATH (https://ffmpeg.org/download.html)

Run:
  python server.py            # listens on http://localhost:8787
  python server.py 9000       # custom port

Endpoints (all CORS-enabled, incl. Private-Network-Access for HTTPS pages):
  GET  /health           -> {"ok": true}
  POST /info   {url}     -> {title, uploader, duration_string, thumbnail, heights:[...]}
  POST /download {url, mode, quality}
        mode    = "both" | "video" | "audio"
        quality = "best" | "2160" | "1440" | "1080" | "720" | "480" | "360"
"""
import json
import os
import sys
import glob
import shutil
import tempfile
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787

MIME = {
    ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".opus": "audio/opus", ".wav": "audio/wav",
}


def ytdlp_path():
    return shutil.which("yt-dlp") or shutil.which("yt-dlp.exe")


def build_format(mode, quality):
    """Return extra yt-dlp args for the requested mode/quality."""
    q = None if quality in (None, "", "best") else quality
    if mode == "audio":
        return ["-x", "--audio-format", "mp3", "--audio-quality", "0"]
    if mode == "video":
        fmt = f"bv*[height<={q}]/bv*" if q else "bv*/b"
        return ["-f", fmt]
    # both
    if q:
        fmt = f"bv*[height<={q}]+ba/b[height<={q}]/b"
    else:
        fmt = "bv*+ba/b"
    return ["-f", fmt, "--merge-output-format", "mp4"]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass  # quiet

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            return self._json(200, {"ok": True, "ytdlp": bool(ytdlp_path())})
        self._json(404, {"error": "not found"})

    def _read_body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")

    def do_POST(self):
        yt = ytdlp_path()
        if not yt:
            return self._json(500, {"error": "yt-dlp is not installed or not on PATH. Run: pip install yt-dlp"})
        try:
            data = self._read_body()
        except Exception:
            return self._json(400, {"error": "invalid JSON body"})
        url = (data.get("url") or "").strip()
        if not url:
            return self._json(400, {"error": "missing url"})

        if self.path.rstrip("/") == "/info":
            return self._info(yt, url)
        if self.path.rstrip("/") == "/download":
            return self._download(yt, url, data.get("mode", "both"), data.get("quality", "best"))
        self._json(404, {"error": "not found"})

    def _info(self, yt, url):
        try:
            out = subprocess.run([yt, "-J", "--no-warnings", "--no-playlist", url],
                                 capture_output=True, timeout=60)
            if out.returncode != 0:
                return self._json(502, {"error": out.stderr.decode(errors="ignore")[-400:] or "yt-dlp failed"})
            info = json.loads(out.stdout.decode(errors="ignore"))
            heights = sorted({f.get("height") for f in info.get("formats", []) if f.get("height")}, reverse=True)
            self._json(200, {
                "title": info.get("title"),
                "uploader": info.get("uploader"),
                "duration_string": info.get("duration_string"),
                "thumbnail": info.get("thumbnail"),
                "heights": heights,
            })
        except subprocess.TimeoutExpired:
            self._json(504, {"error": "timed out fetching info"})
        except Exception as e:
            self._json(500, {"error": str(e)})

    def _download(self, yt, url, mode, quality):
        tmp = tempfile.mkdtemp(prefix="utk_")
        try:
            args = [yt, "--no-warnings", "--no-playlist", "--restrict-filenames",
                    "-o", os.path.join(tmp, "%(title).80s.%(ext)s")]
            args += build_format(mode, quality)
            args.append(url)
            proc = subprocess.run(args, capture_output=True, timeout=1800)
            if proc.returncode != 0:
                return self._json(502, {"error": proc.stderr.decode(errors="ignore")[-500:] or "download failed"})
            files = [f for f in glob.glob(os.path.join(tmp, "*")) if os.path.isfile(f)]
            if not files:
                return self._json(500, {"error": "no output file produced"})
            path = max(files, key=os.path.getsize)
            name = os.path.basename(path)
            ext = os.path.splitext(name)[1].lower()
            size = os.path.getsize(path)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
            self.send_header("Content-Length", str(size))
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
            self.end_headers()
            with open(path, "rb") as fh:
                shutil.copyfileobj(fh, self.wfile, length=1024 * 256)
        except subprocess.TimeoutExpired:
            self._json(504, {"error": "download timed out"})
        except (BrokenPipeError, ConnectionResetError):
            pass  # client cancelled
        except Exception as e:
            try:
                self._json(500, {"error": str(e)})
            except Exception:
                pass
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    if not ytdlp_path():
        print("!! yt-dlp not found. Install it with:  pip install -r requirements.txt")
    if not shutil.which("ffmpeg"):
        print("!! ffmpeg not found on PATH — merging video+audio and MP3 export will fail.")
        print("   Install from https://ffmpeg.org/download.html")
    print(f"Ultimate Toolkit helper running at  http://localhost:{PORT}")
    print("Keep this window open while downloading. Press Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
