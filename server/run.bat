@echo off
REM Ultimate Toolkit download helper (Windows). Double-click to run.
cd /d "%~dp0"
where yt-dlp >nul 2>nul || (echo Installing yt-dlp... & pip install -r requirements.txt)
python server.py %*
pause
