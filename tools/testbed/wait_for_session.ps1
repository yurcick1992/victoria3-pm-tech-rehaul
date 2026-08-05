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

  ⚠ DEAD IS NOT INSTANT, AND MUST NOT BE. Between runs the game is gone and there is no completion
  marker yet - identical to the DEAD signature - while the observer parses the whole log mirror.
  That scales with the mirror: ~7 minutes for 496 MB (measured 2026-08-05), against the 90 s this
  used to allow. It reported DEAD on a healthy batch, and acting on it would have restarted a
  1836-1936 run from 1836. The grace is now -DeadGraceSeconds (default 900) and it re-checks
  throughout, returning to normal waiting the moment the game reappears or the schedule finishes.

  Usage:
    wait_for_session.ps1 -Session <dir> [-MaxMinutes 30] [-PollSeconds 30] [-DeadGraceSeconds 900]
#>
param(
    [Parameter(Mandatory=$true)][string]$Session,
    [int]$MaxMinutes = 30,
    [int]$PollSeconds = 30,
    # How long the game may be absent before this calls the session DEAD. It is NOT just the
    # build gap between runs - the dominant case is the post-run HARVEST, which parses the whole
    # log mirror and scales with it. Measured 2026-08-05: a 496 MB mirror took ~7 minutes, against
    # the 90 s this used to allow, so a perfectly healthy batch reported DEAD and acting on that
    # would have restarted a 1836-1936 run from scratch. 900 s covers a ~1 GB mirror with room.
    [int]$DeadGraceSeconds = 900
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
        # No game and no completion marker. That is ALSO what the normal gap between runs looks
        # like - the scheduler harvesting the finished run (minutes, scaling with mirror size) and
        # then building the next mod (~1 min). So wait out the grace, re-checking as we go, and
        # bail out early the moment the game comes back or the schedule reports done.
        $graceEnd = (Get-Date).AddSeconds($DeadGraceSeconds)
        $recovered = $false
        while ((Get-Date) -lt $graceEnd) {
            Start-Sleep -Seconds $PollSeconds
            if ($null -ne (Get-Process victoria3 -ErrorAction SilentlyContinue)) { $recovered = $true; break }
            if ((Test-Path $log) -and (Select-String -Path $log -Pattern 'SCHEDULE DONE' -Quiet -ErrorAction SilentlyContinue)) { $recovered = $true; break }
        }
        if (-not $recovered) {
            Write-Output ("DEAD - no victoria3 process and no SCHEDULE DONE marker for {0}s" -f $DeadGraceSeconds)
            Write-Output "  (a long HARVEST looks identical - check run.log for 'run N finished' before acting)"
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
