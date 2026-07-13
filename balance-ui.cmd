@echo off
rem One-click launcher for the PM & Tech Rehaul balance UI.
rem Starts the local server (tools\ui.ps1); it opens the editor in your default browser.
rem Close this window to stop the server.
powershell -ExecutionPolicy Bypass -File "%~dp0tools\ui.ps1"
pause
