@echo off
REM Battle of Hong Kong 1941 — launcher (Windows).
REM Real map tiles must be loaded over http (same-origin), so the app is served
REM by a tiny local Node server. Double-click this file to run it.
REM First time only: run  tools\fetch_tiles.ps1  to download the terrain + imagery tiles.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required ^(https://nodejs.org^). & pause & exit /b 1)
start "" http://localhost:5050
node "tools\serve.js"
