#!/usr/bin/env bash
# Ultimate Toolkit download helper (macOS/Linux).
cd "$(dirname "$0")"
command -v yt-dlp >/dev/null 2>&1 || { echo "Installing yt-dlp..."; pip install -r requirements.txt; }
python3 server.py "$@"
