@echo off
REM ---- edit these three lines, then double-click this file ----
set BASE=https://YOUR-APP.vercel.app
set TOKEN=YOUR_PBI_TOKEN
set OUTDIR=%USERPROFILE%\Documents\ScanToolsBackups
set EVERY_MIN=5
node "%~dp0backup.js"
pause
