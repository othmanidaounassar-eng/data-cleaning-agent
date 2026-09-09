@echo off
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
..\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port %1 >> server_%1.log 2>&1
