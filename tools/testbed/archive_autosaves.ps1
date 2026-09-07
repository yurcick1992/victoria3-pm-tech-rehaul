<#
  archive_autosaves.ps1 - copy every autosave the engine writes into a keep-forever archive
  BEFORE the engine overwrites its slot.

  WHY THIS EXISTS. Victoria 3 rotates a SMALL, FIXED set of autosave slots (autosave.v3,
  autosave_1.v3, autosave_2.v3). At a quarteryear cadence a slot is reused every ~9 in-game
  months, i.e. every ~45 seconds of wall clock at observer speed. So a campaign writes ~340
  autosaves and keeps 3. If the measurement is "reconstruct a gamestate's pop demand from that
  same gamestate's supply", the gamestate has to still exist - which means copying it out
  within seconds of it being written.

  THE ONE HAZARD IS COPYING A HALF-WRITTEN SAVE. A 45 MB write is not atomic, and a truncated
  .v3 looks exactly like a real one (it exists, it is newest, it has a plausible size) - the
  same failure mode that produced the observer's quarantine ladder. So a file is only copied
  once its size AND mtime have been unchanged for -StableSeconds, and the copy is verified by
  length afterwards.

    powershell -ExecutionPolicy Bypass -File tools\testbed\archive_autosaves.ps1 `
        -Dest tools\testbed\saves_debut -MaxMinutes 240

  Stop it with tools\testbed\STOP_ARCHIVE (the observer's own STOP file is left alone), or let
  -MaxMinutes expire, or let it exit on its own once the game has been gone for -IdleExitMinutes.
#>
[CmdletBinding()]
param(
  [string] $Dest             = "tools\testbed\saves_debut",
  [int]    $PollSeconds      = 2,
  [int]    $StableSeconds    = 4,
  [int]    $MaxMinutes       = 300,
  [int]    $IdleExitMinutes  = 10,
  [int]    $MinFreeGB        = 8,
  # ⚠ NEEDED WHENEVER A BATCH RUNS BACK TO BACK. The engine's autosave slots survive the game exiting, so
  # at the start of run N+1 the save folder still holds run N's five saves - and without this they are
  # archived into run N+1's folder and attributed to the wrong arm. Pre-seeding them as already-seen is
  # the fix that does not touch the files themselves (deleting them would break crash-resume).
  [switch] $SkipExisting
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo    = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not [System.IO.Path]::IsPathRooted($Dest)) { $Dest = Join-Path $repo $Dest }
$Doc     = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Paradox Interactive\Victoria 3"
$SaveDir = Join-Path $Doc "save games"
$stopFile = Join-Path $PSScriptRoot "STOP_ARCHIVE"

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$log = Join-Path $Dest "archive.log"
function Log([string]$m, [string]$lvl = "INFO") {
  $line = "[{0}] {1,-5} {2}" -f (Get-Date -Format "HH:mm:ss"), $lvl, $m
  Write-Host $line
  # never let a held-open log file kill the archiver (Add-Content throws while another process reads the file; 2026-09-07)
  for ($try = 1; $try -le 8; $try++) {
    try { Add-Content -Path $log -Value $line -Encoding utf8 -ErrorAction Stop; return }
    catch { Start-Sleep -Milliseconds (25 * $try) }
  }
}

Log "archiving autosaves from '$SaveDir' -> '$Dest'"
Log "poll ${PollSeconds}s | stable ${StableSeconds}s | max ${MaxMinutes}min | idle-exit ${IdleExitMinutes}min | min free ${MinFreeGB}GB"
if (Test-Path $stopFile) { Remove-Item $stopFile -Force }

# ⚠ DEDUPE ON CONTENT SIGNATURE, NOT ON SLOT NAME. The engine ROTATES its slots by renaming:
# autosave.v3 becomes autosave_1.v3, which becomes autosave_2.v3, and so on. The rename preserves
# length and mtime, so a per-name key sees "new" content in every slot the file passes through and
# archives the SAME save up to five times - measured, and at 45 MB a copy it fills the disk in about
# an hour. Keying on (length, mtime) globally makes a rotated file identical to the one already kept.
$seen    = @{}
if ($SkipExisting) {
  $pre = @(Get-ChildItem $SaveDir -Filter "autosave*.v3" -ErrorAction SilentlyContinue)
  foreach ($f in $pre) { $seen["{0}|{1}" -f $f.Length, $f.LastWriteTimeUtc.Ticks] = $true }
  Log "-SkipExisting: $(@($pre).Count) pre-existing autosave(s) marked as already seen"
}
# candidates awaiting stability: name -> @{ len; mtime; since }
$pending = @{}
$n       = 0
$started = Get-Date
$lastGameSeen = Get-Date

function Get-FreeGB {
  $d = [System.IO.DriveInfo]::new((Split-Path $Dest -Qualifier) + "\")
  [math]::Round($d.AvailableFreeSpace / 1GB, 1)
}

while ($true) {
  if (Test-Path $stopFile) { Log "STOP_ARCHIVE seen - stopping"; break }
  if (((Get-Date) - $started).TotalMinutes -ge $MaxMinutes) { Log "-MaxMinutes reached - stopping"; break }

  $game = @(Get-Process victoria3 -ErrorAction SilentlyContinue)
  if ($game.Count -gt 0) { $lastGameSeen = Get-Date }
  elseif (((Get-Date) - $lastGameSeen).TotalMinutes -ge $IdleExitMinutes) {
    Log "no victoria3 process for $IdleExitMinutes min - stopping"; break
  }

  $free = Get-FreeGB
  if ($free -lt $MinFreeGB) { Log "only ${free} GB free (< $MinFreeGB) - STOPPING before the disk fills" "ALERT"; break }

  $files = @()
  try { $files = @(Get-ChildItem $SaveDir -Filter "autosave*.v3" -ErrorAction SilentlyContinue) } catch {}

  foreach ($f in $files) {
    $sig = "{0}|{1}" -f $f.Length, $f.LastWriteTimeUtc.Ticks
    if ($seen.ContainsKey($sig)) { continue }

    if ($pending.ContainsKey($f.Name)) {
      $p = $pending[$f.Name]
      if ($p.sig -ne $sig) {
        # still being written - restart the stability clock
        $pending[$f.Name] = @{ sig = $sig; since = (Get-Date) }
        continue
      }
      if (((Get-Date) - $p.since).TotalSeconds -lt $StableSeconds) { continue }
    } else {
      $pending[$f.Name] = @{ sig = $sig; since = (Get-Date) }
      continue
    }

    # stable for long enough - archive it
    $n++
    $stamp = $f.LastWriteTime.ToString("yyyyMMdd_HHmmss")
    $out   = Join-Path $Dest ("{0:d4}_{1}_{2}" -f $n, $stamp, $f.Name)
    # ⚠⚠ COPY TO A TEMP NAME, THEN RENAME. `Copy-Item` is not atomic, so for the duration of a 45 MB
    # write there is a file at the destination path that LOOKS like a complete save and is not. That was
    # harmless while nothing read the archive until the run ended, but the harvester now melts saves AS
    # THEY ARRIVE (user ruling, 2026-08-11) and would pick the half-written one up. A rename on the same
    # volume is atomic, so a `.v3` in this folder is complete by construction.
    # ⚠ The `.part` suffix also keeps it out of the harvester's `*.v3` queue while it is being written.
    $tmp = "$out.part"
    try {
      Copy-Item -LiteralPath $f.FullName -Destination $tmp -Force
      $copied = (Get-Item $tmp).Length
      if ($copied -ne $f.Length) {
        Log "size mismatch on $($f.Name): source $($f.Length) vs copy $copied - DISCARDING" "WARN"
        Remove-Item $tmp -Force; $n--
      } else {
        Move-Item -LiteralPath $tmp -Destination $out -Force
        $seen[$sig] = $true
        Log ("#{0,-4} {1,-16} {2,10:N0} bytes  (free {3} GB)" -f $n, $f.Name, $copied, (Get-FreeGB))
      }
    } catch {
      Log "copy failed for $($f.Name): $_" "WARN"; $n--
      Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
    $pending.Remove($f.Name)
  }

  Start-Sleep -Seconds $PollSeconds
}

Log "ARCHIVE DONE - $n saves in '$Dest'"
