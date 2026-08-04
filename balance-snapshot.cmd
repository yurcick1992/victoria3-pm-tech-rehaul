@echo off
rem One-click SELF-CONTAINED SNAPSHOT of the PM & Tech Rehaul balance editor.
rem Writes balance_ui_snapshot.html at the repo root: one file, no server, no network - for reading
rem and tuning the sheet away from this machine. "Build now" is disabled in it (that needs tools\ui.ps1);
rem Export mod_config.json still works, so tune remotely and bring the file back.
rem It refuses to run if ui\*.js is older than config\mod_config.json - build first, then snapshot.
node "%~dp0tools\bundle_ui.mjs" %*
pause
