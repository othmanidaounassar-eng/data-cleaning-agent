@echo off
set PYTHONIOENCODING=utf-8
set RATE_LIMIT_CLEAN=10000/minute
set RATE_LIMIT_ANALYZE=10000/minute
set RATE_LIMIT_CHAT=10000/minute
set RATE_LIMIT_MISC=10000/minute
cd /d "%~dp0"
..\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port %1 >> server_%1.log 2>&1
