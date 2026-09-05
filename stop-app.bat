@echo off
REM Stops the backend (port 8000) and frontend (port 5173).
REM PostgreSQL and Ollama are left running - they are shared services.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-app.ps1"
