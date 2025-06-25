@echo off
echo Stopping any running Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

echo Starting WA-BOT server...
start "" cmd /k "node index.js"

echo Waiting for server to start...
timeout /t 5 >nul

start http://localhost:3000/workflow-editor.html
start http://localhost:1880/red/

echo Server restarted and browser windows opened.
