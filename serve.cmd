@echo off
REM Double-click this file to preview the site at http://localhost:8080
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
pause
