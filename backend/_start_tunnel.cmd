@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "C:\Users\hi\AppData\Roaming\npm\node_modules\localtunnel\bin\lt.js" --port 8000 > tunnel.log 2>&1
