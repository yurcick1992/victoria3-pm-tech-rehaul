# Drop tools\testbed\NO_NEW_RUNS at a given local time, so a running schedule lets its current game finish and starts no
# further run (run_schedule.ps1 checks the file before every run). For a user deadline on STARTING games; the STOP file
# is the wrong tool for that, because it closes the game that is running.
#   launch_detached.ps1 -File tools\testbed\no_new_runs_at.ps1 -ArgumentList '-At','2026-09-30 16:00' -Hidden
# ⚠ Remove tools\testbed\NO_NEW_RUNS after the batch: while it exists every schedule refuses to start a run.
param([Parameter(Mandatory = $true)][string]$At)
$ErrorActionPreference = 'Stop'
$when = [datetime]::Parse($At)
$flag = Join-Path $PSScriptRoot 'NO_NEW_RUNS'
$log = Join-Path $PSScriptRoot 'no_new_runs_at.log'
Add-Content -Path $log -Value ("{0}  armed: NO_NEW_RUNS at {1} (local)" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $when.ToString('yyyy-MM-dd HH:mm'))
while ((Get-Date) -lt $when) { Start-Sleep -Seconds 30 }
New-Item -ItemType File -Force -Path $flag | Out-Null
Add-Content -Path $log -Value ("{0}  dropped {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $flag)
