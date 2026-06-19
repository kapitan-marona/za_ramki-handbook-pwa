@echo off
cd /d "%~dp0"
set PORT=8097
echo Starting ZA RAMKI local server on http://127.0.0.1:%PORT%/
echo.
node tools\local-static-server.js
echo.
echo Server stopped. Press any key to close this window.
pause >nul
