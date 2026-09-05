@echo off
REM Double-click this to start the RAG Powered Knowledge System.
REM It brings up PostgreSQL, Ollama, the backend and the frontend,
REM then opens the app in your browser.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-app.ps1"
