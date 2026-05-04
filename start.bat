@echo off
title OTD Risk Dashboard

echo =============================================
echo   Proactive OTD Risk Dashboard - Startup
echo =============================================
echo.

REM ── Start Python Backend (port 8000) ──
echo [1/2] Starting Python backend on http://localhost:8000 ...
start "OTD Backend" cmd /k "cd /d "%~dp0backend" && pip install -r requirements.txt -q && echo. && echo Backend ready - open http://localhost:8000/docs && echo. && python -m uvicorn main:app --reload --port 8000"

REM Give the backend a moment to start
timeout /t 4 /nobreak > nul

REM ── Start React Frontend (port 5173) ──
echo [2/2] Starting React frontend on http://localhost:5173 ...
start "OTD Frontend" cmd /k "cd /d "%~dp0frontend" && npm install && npm run dev"

echo.
echo =============================================
echo   Both servers are starting...
echo   Open http://localhost:5173 in your browser
echo =============================================
echo.
pause


