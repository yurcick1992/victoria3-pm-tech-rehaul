<#
  harvest_saves.ps1 - stages B-D of the savegame instrument: MELT -> EXTRACT -> REAP.

  ⭐ WHAT THIS IS FOR (ROADMAP step 3.5). A melted savegame is the better source for anything that is a
  *level* rather than an *event*: it is complete, internally consistent, carries things telemetry cannot
  reach (per-building SUBSIDY spend, technologies held, ownership, cash reserves), and it is not subject
  to the log ring. `archive_autosaves.ps1` is stage A and runs CONCURRENTLY with the game; this script is
  everything behind it and must NOT be coupled to it - coupling races the engine, and a melt that outlasts
  the interval between autosaves loses saves silently.

    powershell -File tools\testbed\harvest_saves.ps1 -Saves <archive dir> [-Out <dir>] [-Workers 4]
                                                     [-Watch] [-NoReap] [-KeepLast]

  ⚠⚠ THE PRINCIPLE THIS INVERTS. The repo runs on "the summary is a CACHE; the raw log is the record",
  which is what makes compressing logs safe. Reaping the saves inverts it: THE SUMMARY BECOMES THE RECORD.
  So, in order:
    1. the summary is written to a TEMP name, then VERIFIED (gunzips, parses, carries a version, a date
       and a plausible country count), then renamed into place;
    2. only then is the save deleted;
    3. the NEWEST save of the set is kept permanently (-KeepLast, on by default) as the escape hatch for
       every question the schema did not anticipate.
  A verify failure never reaps. This is the same discipline summarise.ps1 uses before gzipping raws.

  ⭐ MEASURED 2026-08-11, and it retires the handover's central worry. Melt+extract STREAMS end to end
  (rakaly -c straight into the reader, no 391 MB intermediate on disk): 5.0 s per 57 MB save on one core.
  Against a quarterly producer that emits one save every 15-35 s of wall clock, a single worker already
  keeps up; four drain a whole century in ~8 minutes. The feared "consumer 3-6x slower than the producer,
  backlog grows without bound" does not happen at any cadence we use.

  ⚠ DEFAULT IS SERIAL WITH THE GAME, NOT CONCURRENT. Wall clock is one of the things these batches
  MEASURE, so stealing cores from the engine would confound the very number under test. Run this between
  runs (which is what run_schedule.ps1 does), or pass -Watch deliberately when the queue matters more than
  the timing does.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string] $Saves,
  [string] $Out        = "",          # default: <Saves>\..\save_summaries
  [int]    $Workers    = 4,
  [switch] $Watch,                    # keep polling while a victoria3 process is alive
  [switch] $NoReap,                   # extract but never delete the .v3
  [bool]   $KeepLast   = $true,       # keep the newest save permanently
  [int]    $PollSeconds = 5,
  [int]    $IdleExitMinutes = 10,
  [string] $Provenance = ""           # JSON merged into every summary's .provenance
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not [System.IO.Path]::IsPathRooted($Saves)) { $Saves = Join-Path $repo $Saves }
if (-not (Test-Path $Saves)) { throw "no such saves dir: $Saves" }
if (-not $Out) { $Out = Join-Path (Split-Path $Saves -Parent) "save_summaries" }
if (-not [System.IO.Path]::IsPathRooted($Out)) { $Out = Join-Path $repo $Out }
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$reader = Join-Path $PSScriptRoot "save_state_summary.mjs"
$stopFile = Join-Path $PSScriptRoot "STOP_HARVEST"
if (Test-Path $stopFile) { Remove-Item $stopFile -Force }
$log = Join-Path $Out "harvest.log"
function Log([string]$m, [string]$lvl = "INFO") {
  $line = "[{0}] {1,-5} {2}" -f (Get-Date -Format "HH:mm:ss"), $lvl, $m
  Write-Host $line; Add-Content -Path $log -Value $line -Encoding utf8
}

Log "harvest: '$Saves' -> '$Out'  workers=$Workers watch=$($Watch.IsPresent) reap=$(-not $NoReap) keepLast=$KeepLast"

# ⚠ VERIFY BEFORE REAPING, and verify the ARTIFACT rather than the exit code. A reader can exit 0 having
# written something unusable; the only check worth having is the one that opens the file it wrote.
function Test-Summary([string]$path) {
  try {
    if (-not (Test-Path $path)) { return "missing" }
    $len = (Get-Item $path).Length
    if ($len -lt 1024) { return "implausibly small ($len bytes)" }
    $bytes = [IO.File]::ReadAllBytes($path)
    $ms = [IO.MemoryStream]::new($bytes)
    $gz = [IO.Compression.GZipStream]::new($ms, [IO.Compression.CompressionMode]::Decompress)
    $sr = [IO.StreamReader]::new($gz)
    $json = $sr.ReadToEnd(); $sr.Dispose()
    $o = $json | ConvertFrom-Json
    if (-not $o.save_summary_version) { return "no save_summary_version" }
    if (-not $o.provenance.date)      { return "no provenance.date" }
    $n = @($o.countries.PSObject.Properties).Count
    if ($n -lt 10) { return "only $n countries" }
    return ""
  } catch { return "unreadable: $_" }
}

$done = 0; $failed = 0; $reaped = 0
$startedAt = Get-Date
$lastGameSeen = Get-Date
$jobs = @{}          # save full path -> @{ proc; out; tmp; started }
# ⚠ A SAVE THAT FAILED IS NEVER RE-DISPATCHED IN THE SAME PASS. The queue is defined by "no summary
# exists yet", so without this a permanent failure (a truncated .v3, a reader bug) is retried forever at
# full worker width — which is exactly what happened the first time this ran.
$blocked = @{}

function Start-One([System.IO.FileInfo]$f) {
  # ⚠ NOT `$out` — PowerShell variable names are CASE-INSENSITIVE, so a local `$out` IS the script's
  # `$Out` parameter. Assigning it rewrote the output directory to a per-save path on the first launch
  # ("…\_summaries\0001_autosave.json.gz\0001_autosave.partial.json.gz") and every worker exited 1.
  $stem = [IO.Path]::GetFileNameWithoutExtension($f.Name)
  $dest = Join-Path $Out "$stem.json.gz"
  # ⚠ THE TEMP NAME MUST STILL END IN .gz — the reader decides whether to compress from the extension it
  # is given, so a `.json.gz.part` produced a 1.4 MB uncompressed file that then failed its own gunzip
  # verify. Partial-ness is carried in the STEM, not the suffix.
  $tmp  = Join-Path $Out "$stem.partial.json.gz"
  # ⚠ QUOTE EVERY ARGUMENT. `Start-Process -ArgumentList` joins an array with spaces and quotes NOTHING,
  # and the repo path contains a space ("victoria 3 PM and tech rehaul") — so node was handed
  # `C:\claude-code\victoria` as its script and exited 1 on every save.
  $q = { param($s) '"' + ($s -replace '"', '\"') + '"' }
  $a = @((& $q $reader), (& $q $f.FullName), "--out", (& $q $tmp), "--source-name", (& $q $f.Name))
  if ($Provenance) { $a += @("--provenance", (& $q $Provenance)) }
  if ($env:HARVEST_DEBUG) { Log ("launch: node " + ($a -join ' ')) "DEBUG" }
  $p = Start-Process -FilePath "node" -ArgumentList $a -NoNewWindow -PassThru `
        -RedirectStandardError (Join-Path $Out "$stem.err")
  # ⚠ TOUCHING .Handle IS LOAD-BEARING, not defensive noise. Without it `$p.ExitCode` reads EMPTY on a
  # Start-Process -PassThru object even after HasExited is true (PowerShell only caches the exit code if
  # the handle was materialised). Every job then looked like a failure, nothing was ever marked done, and
  # the queue re-dispatched the same four saves forever — 888 "failures" in one minute on its first run.
  $null = $p.Handle
  $jobs[$f.FullName] = @{ proc = $p; dest = $dest; tmp = $tmp; started = (Get-Date); name = $f.Name; stem = $stem }
}

function Complete-One($key) {
  $j = $jobs[$key]
  $ok = ($j.proc.ExitCode -eq 0)
  $why = if ($ok) { Test-Summary $j.tmp } else { "reader exit $($j.proc.ExitCode)" }
  $errFile = Join-Path $Out "$($j.stem).err"
  if ($ok -and -not $why) {
    Move-Item -LiteralPath $j.tmp -Destination $j.dest -Force
    Remove-Item $errFile -Force -ErrorAction SilentlyContinue
    $script:done++
    # THE ESCAPE HATCH: the newest save of the set is summarised like any other and then KEPT, so the
    # final state has both a summary and a save to re-read for whatever the schema did not anticipate.
    $isNewest = $KeepLast -and (@(Get-ChildItem $Saves -Filter "*.v3" -ErrorAction SilentlyContinue |
                                 Sort-Object Name | Select-Object -Last 1).FullName -eq $key)
    if (-not $NoReap -and -not $isNewest) { Remove-Item -LiteralPath $key -Force -ErrorAction SilentlyContinue; $script:reaped++ }
  } else {
    $script:failed++
    $script:blocked[$key] = $why
    $tail = ""
    if (Test-Path $errFile) { $tail = (Get-Content $errFile -Tail 3 -ErrorAction SilentlyContinue) -join " / " }
    Log "FAILED $($j.name): $why  $tail" "WARN"
    Remove-Item $j.tmp -Force -ErrorAction SilentlyContinue
    # ⚠ a failed save is NEVER reaped - it stays on disk as the only remaining copy of its own evidence
  }
  $jobs.Remove($key)
}

function Get-Queue {
  $all = @(Get-ChildItem $Saves -Filter "*.v3" -ErrorAction SilentlyContinue | Sort-Object Name)
  # ⚠ `-KeepLast` means DO NOT REAP the newest, not "do not summarise" it — the distinction cost the
  # 1936 endpoint of every run in the first batch, so the series ran 1837-1935 and the final state had a
  # save but no summary. Reaping is skipped in Complete-One instead.
  # ⚠ In -Watch mode the newest IS still skipped, because during a live run it may be the one the
  # archiver has only just renamed into place and a newer one is imminent; the post-run drain then picks
  # it up. (The archiver's atomic rename makes reading it safe; deferring is about ordering, not safety.)
  if ($Watch -and $all.Count -gt 0) { $all = @($all | Select-Object -SkipLast 1) }
  # skip anything already summarised, and anything a worker currently holds
  @($all | Where-Object {
      $stem = [IO.Path]::GetFileNameWithoutExtension($_.Name)
      -not (Test-Path (Join-Path $Out "$stem.json.gz")) -and -not $jobs.ContainsKey($_.FullName) `
        -and -not $blocked.ContainsKey($_.FullName)
    })
}

$lastReport = Get-Date; $lastDone = 0; $rate = 0.0
while ($true) {
  if (Test-Path $stopFile) { Log "STOP_HARVEST seen - finishing in-flight work"; break }

  foreach ($k in @($jobs.Keys)) { if ($jobs[$k].proc.HasExited) { Complete-One $k } }

  $queue = @(Get-Queue)
  $qn = @($queue).Count
  while ($jobs.Count -lt $Workers -and $qn -gt 0) {
    Start-One $queue[0]
    $queue = @($queue | Select-Object -Skip 1); $qn = @($queue).Count
  }

  # ⭐ CLI TRANSPARENCY (user requirement): a growing backlog must be visible while it is still cheap to
  # react to, so the line carries the queue DEPTH, its SIZE ON DISK and the DRAIN RATE, not just a count.
  if (((Get-Date) - $lastReport).TotalSeconds -ge 15) {
    $q = @(Get-ChildItem $Saves -Filter "*.v3" -ErrorAction SilentlyContinue)
    $gb = if (@($q).Count -gt 0) { [math]::Round((($q | Measure-Object Length -Sum).Sum) / 1GB, 2) } else { 0 }
    $mins = ((Get-Date) - $lastReport).TotalMinutes
    if ($mins -gt 0) { $rate = [math]::Round(($done - $lastDone) / $mins, 1) }
    Log ("melt queue: {0} saves pending, {1} in flight - {2} done, {3} failed, {4} reaped - {5} GB on disk - draining {6}/min" -f `
         $qn, $jobs.Count, $done, $failed, $reaped, $gb, $rate)
    $lastReport = Get-Date; $lastDone = $done
  }

  if ($jobs.Count -eq 0 -and $qn -eq 0) {
    if (-not $Watch) { break }
    $game = @(Get-Process victoria3 -ErrorAction SilentlyContinue)
    if ($game.Count -gt 0) { $lastGameSeen = Get-Date }
    elseif (((Get-Date) - $lastGameSeen).TotalMinutes -ge $IdleExitMinutes) {
      Log "no victoria3 process for $IdleExitMinutes min and queue empty - stopping"; break
    }
  }
  Start-Sleep -Seconds ([Math]::Max(1, [Math]::Min($PollSeconds, 2)))
}
foreach ($k in @($jobs.Keys)) { $jobs[$k].proc.WaitForExit(); Complete-One $k }

$elapsed = [math]::Round(((Get-Date) - $startedAt).TotalMinutes, 1)
Log "HARVEST DONE - $done summaries, $failed failed, $reaped saves reaped, ${elapsed} min"
if ($failed -gt 0) { exit 1 }
