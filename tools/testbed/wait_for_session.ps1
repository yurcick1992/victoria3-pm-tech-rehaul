<#
  wait_for_session.ps1 - block until a testbed session finishes, or until a time budget expires.

  WHY THIS EXISTS. A batch is launched with Start-Process into its OWN visible window, because
  that is the only way the p/r/s/x keys survive (redirecting stdio kills them - see CLAUDE.md).
  But a detached window is invisible to the agent harness: nothing notifies Claude when the batch
  ends, so an 8-hour batch can sit finished for hours before anyone looks. That happened on
  2026-08-01.

  This script is the missing signal. Run it with the Bash/PowerShell tool's run_in_background,
  which IS harness-tracked: when it exits, Claude is notified and wakes up.

  It exits on WHICHEVER COMES FIRST:
    - the session finishing  -> exit 0, prints DONE      (the useful wake-up)
    - -MaxMinutes elapsing   -> exit 0, prints RUNNING   (a heartbeat; re-launch to keep waiting)
  Both are exit 0 because neither is an error - read the printed status, not the code. Exit 2
  means the session looks DEAD (no game process and no completion marker), which IS worth alarm.

  The heartbeat matters: without it a hung run would never wake anyone, so the agent would wait
  forever on a signal that is not coming. With it, the longest anyone is ever in the dark is
  -MaxMinutes.

  Usage:
    wait_for_session.ps1 -Session <dir> [-MaxMinutes 30] [-PollSeconds 30]
#>
param(
    [Parameter(Mandatory=$true)][string]$Session,
    [int]$MaxMinutes = 30,
    [int]$PollSeconds = 30
)
$ErrorActionPreference = 'Stop'

$log = Join-Path $Session 'session.log'
$deadline = (Get-Date).AddMinutes($MaxMinutes)

function Get-Progress {
    # Newest in-game date any run has reported - so a heartbeat says something useful.
    $runLogs = Get-ChildItem $Session -Directory -Filter 'run*' -ErrorAction SilentlyContinue |
               ForEach-Object { Join-Path $_.FullName 'run.log' } | Where-Object { Test-Path $_ }
    $last = ""
    foreach ($rl in $runLogs) {
        $m = Select-String -Path $rl -Pattern 'in-game (\d+\.\d+\.\d+)' -ErrorAction SilentlyContinue | Select-Object -Last 1
        if ($m) { $last = $m.Matches[0].Groups[1].Value }
    }
    return $last
}

while ($true) {
    $done = $false
    if (Test-Path $log) {
        if (Select-String -Path $log -Pattern 'SCHEDULE DONE' -Quiet -ErrorAction SilentlyContinue) { $done = $true }
    }
    if ($done) {
        $tail = (Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 3) -join "`n"
        Write-Output "DONE - session finished"
        Write-Output $tail
        exit 0
    }

    $alive = $null -ne (Get-Process victoria3 -ErrorAction SilentlyContinue)
    if (-not $alive) {
        # No game and no completion marker. Could be the gap between runs (the scheduler is
        # building the next mod, ~1 min), so tolerate a short absence before crying wolf.
        Start-Sleep -Seconds 90
        $stillDead = $null -eq (Get-Process victoria3 -ErrorAction SilentlyContinue)
        $nowDone = (Test-Path $log) -and (Select-String -Path $log -Pattern 'SCHEDULE DONE' -Quiet -ErrorAction SilentlyContinue)
        if ($stillDead -and -not $nowDone) {
            Write-Output "DEAD - no victoria3 process and no SCHEDULE DONE marker"
            Write-Output ((Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 5) -join "`n")
            exit 2
        }
    }

    if ((Get-Date) -ge $deadline) {
        Write-Output ("RUNNING - still going after {0} min, at in-game {1}" -f $MaxMinutes, (Get-Progress))
        Write-Output ((Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 2) -join "`n")
        exit 0
    }
    Start-Sleep -Seconds $PollSeconds
}
