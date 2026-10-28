<#
  wait_for_session.ps1 - block until a testbed session finishes, or until a time budget expires.

  WHY THIS EXISTS. A batch is launched with Start-Process into its OWN visible window, because
  that is the only way the p/r/s/x keys survive (redirecting stdio kills them - see TESTBED_OPERATIONS.md section 3.1).
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
  Exit 3 means STALLED: the harness is alive but NOTHING in the session tree has been written for
  -StallMinutes. Exit 4 means BAD SESSION - the path does not exist, or its tree enumerates nothing;
  that is a broken ARGUMENT, and reporting it as STALLED would be a watcher failing in the flattering
  direction (it happened, on the day STALLED shipped). Exit 5 means FROZEN (L41, 2026-10-28): the game
  runs and the harness writes, but the newest run's in-game date has not moved for -FrozenMinutes -
  a game paused by a click in its window looks exactly like that, and STALLED cannot see it.

  WHY STALLED EXISTS (landmine L21, 2026-08-18). "Alive" is not "working". A build failed in 3
  seconds and the scheduler blocked on its own output pipeline: no game, no completion marker, a
  live harness holding 9.5 s of CPU over 6 h 40 min. Every wait condition in the repo matched only
  SUCCESS, so the silence read as a healthy long run and the window was lost. A watcher that
  matches only success is indistinguishable from a broken watcher - so this one also matches
  failure and stall.

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
                         [-StallMinutes 20] [-FrozenMinutes 25]
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
    [int]$DeadGraceSeconds = 900,
    # How long the WHOLE session tree may go without a single file write before this calls it STALLED.
    # The game mirrors its logs continuously, the concurrent harvest writes a summary every few
    # seconds, and a build writes build.log - so under any healthy stage something ticks within
    # seconds. 20 min is ~2 orders of magnitude of slack and still 20x better than the 6 h 40 min L21
    # cost. 0 disables the check.
    [int]$StallMinutes = 20,
    # How long the newest run's IN-GAME date may stand still, while the game runs, before this calls it FROZEN (exit 5; landmine
    # L41, 2026-10-28). A game paused by input keeps the observer writing a tick line every 20 s, so STALLED never fires; the date is
    # what stops. A healthy run advances its date within a minute even in the dense 1930s; loading at the start is not counted.
    # 0 disables the check. 25, above the observer's own 15-min frozen stop (run_observer -FrozenMinutes, 2026-10-28): the observer stops
    # and resumes a frozen game itself, so FROZEN here means its recovery did not happen - the case that needs a person.
    [int]$FrozenMinutes = 25
)
$ErrorActionPreference = 'Stop'

# ⚠⚠ A SESSION PATH THAT DOES NOT EXIST IS AN ERROR, NOT A STALL - and this check is why.
# Measured 2026-08-18, minutes after STALLED shipped: the path was passed through a layer that ate its
# backslashes, the waiter happily watched a directory that was never there, found zero files, and
# reported STALLED against a run that was healthy and advancing. A watcher that cannot tell a broken
# ARGUMENT from a broken RUN is the same defect as one that cannot tell failure from success - it just
# fails in the flattering direction instead. Exit 4, named, before any waiting happens.
if (-not (Test-Path $Session)) {
    Write-Output "BAD SESSION - no such directory: $Session"
    Write-Output "  (a mistyped or mangled path must never be reported as STALLED or DEAD - check the path, not the run)"
    exit 4
}
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

function Get-NewestWrite {
    # "Is ANYTHING happening?" - the newest write anywhere in the session tree. It deliberately does not
    # care WHICH stage is live: the game mirrors logs_live continuously, the harvest writes summaries
    # every few seconds, a build writes build.log. If none of them has written for -StallMinutes, the
    # session is not working, whatever its processes claim.
    # WARN: the autosave archive folder is excluded - a 45 MB copy takes many seconds and its mtime is
    # the START of the write, but everything else in the tree ticks faster, so it only adds noise.
    # WARN WARN: MATCHED ON THE PARENT DIRECTORY'S NAME, NOT A PATH REGEX, AND THAT IS DELIBERATE. The
    # first version tested the full path against a regex full of escaped separators; an escaping layer
    # collapsed the doubling, leaving an INVALID regex that threw on every file. It did not surface,
    # because the same run was handed a mangled session path, so the enumeration was empty and the broken
    # filter never ran - one bug hiding another. A comparison with no escaping in it cannot be mangled.
    $newest = [datetime]::MinValue
    Get-ChildItem $Session -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Directory.Name -ne 'saves' } |
        ForEach-Object { if ($_.LastWriteTime -gt $newest) { $newest = $_.LastWriteTime } }
    return $newest
}

function Get-NewestRunClock {
    # The run being played is the one whose run.log was written last; its newest tick line names the in-game date.
    $rl = Get-ChildItem $Session -Directory -Filter 'run*' -ErrorAction SilentlyContinue |
          ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName 'run.log') -ErrorAction SilentlyContinue } |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $rl) { return $null }
    $m = Get-Content -LiteralPath $rl.FullName -Tail 40 -ErrorAction SilentlyContinue | Select-String -Pattern 'in-game (\S+)' | Select-Object -Last 1
    if (-not $m) { return $null }
    return [pscustomobject]@{ Run = $rl.Directory.Name; Dir = $rl.Directory.FullName; Date = $m.Matches[0].Groups[1].Value }
}

$lastWrite   = Get-NewestWrite
$lastWriteAt = Get-Date
$clockKey    = $null
$clockAt     = Get-Date

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

    # ---- STALLED: alive, but nothing has been written anywhere in the session for StallMinutes.
    if ($StallMinutes -gt 0) {
        $nw = Get-NewestWrite
        if ($nw -gt $lastWrite) { $lastWrite = $nw; $lastWriteAt = Get-Date }
        elseif ($nw -eq [datetime]::MinValue) {
            # Not stale - EMPTY. The tree existed at startup and now enumerates nothing, which is a
            # disappeared or unreadable folder, not a quiet one. Same rule as above: say which.
            Write-Output "BAD SESSION - the session tree enumerates no files at all: $Session"
            exit 4
        }
        elseif (((Get-Date) - $lastWriteAt).TotalMinutes -ge $StallMinutes) {
            Write-Output ("STALLED - harness may be alive but nothing in the session tree has been written for {0} min" -f $StallMinutes)
            Write-Output ("  newest write: {0}" -f $lastWrite)
            Write-Output "  (L21: a failed build used to block the scheduler here for hours - check build.log first)"
            Write-Output ((Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 5) -join "`n")
            exit 3
        }
    }

    # ---- FROZEN: the game runs and the harness writes, but the newest run's in-game date has not moved for FrozenMinutes (L41).
    if ($FrozenMinutes -gt 0 -and $alive) {
        $clk = Get-NewestRunClock
        if ($clk -and $clk.Date -ne 'loading') {
            $key = "$($clk.Run)|$($clk.Date)"
            if ($key -ne $clockKey) { $clockKey = $key; $clockAt = Get-Date }
            elseif (((Get-Date) - $clockAt).TotalMinutes -ge $FrozenMinutes) {
                Write-Output ("FROZEN - {0} has stood at in-game {1} for {2} min while the game runs" -f $clk.Run, $clk.Date, $FrozenMinutes)
                $ds = Join-Path $clk.Dir 'logs_live\dedicated_server.log'
                $pause = $(if (Test-Path -LiteralPath $ds) { Select-String -LiteralPath $ds -SimpleMatch 'Paused: true, PlayerID: 1' -ErrorAction SilentlyContinue | Select-Object -Last 1 })
                if ($pause) { Write-Output "  a PLAYER pause is on record (L41: a click or keypress in the game window): $($pause.Line.Trim())" }
                else { Write-Output "  no player pause on record - a hang or a livelock; check the game window and debug.log" }
                Write-Output "  (the run's own timeout would end it short of its target; unpause the game, or stop and resume the run)"
                exit 5
            }
        }
    }

    if ((Get-Date) -ge $deadline) {
        Write-Output ("RUNNING - still going after {0} min, at in-game {1}" -f $MaxMinutes, (Get-Progress))
        Write-Output ((Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 2) -join "`n")
        exit 0
    }
    Start-Sleep -Seconds $PollSeconds
}
