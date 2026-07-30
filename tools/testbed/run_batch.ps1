<#
  run_batch.ps1 - run a testbed EXPERIMENT from a JSON job file. No agent, no chat.

  A job describes one or more "arms" (a mod build, or the base game) and how many runs each
  should get. The driver interleaves them - A, B, A, B, ... - so that anything drifting over
  the hours (machine load, thermals, your own use of the PC) hits both arms equally instead of
  landing entirely on whichever arm ran first.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\testbed\run_batch.ps1 -Job tools\testbed\jobs\tiering_vs_vanilla.json
    powershell -ExecutionPolicy Bypass -File tools\testbed\run_batch.ps1 -Job <job> -WhatIf   # print the plan and the cost, run nothing

  While it runs:  [q] stop after the current run   [x] stop immediately
  (handled inside run_observer's poll loop, so it responds during a run, not just between them)

  Job file (see jobs\*.json):
  {
    "label": "tiering-vs-vanilla",
    "runs_per_arm": 5,
    "interleave": true,
    "dump_dates": ["1860.1.1","1886.1.1","1910.1.1","1935.1.1"],
    "until_date": "1935.2.1",
    "tags": ["GBR","FRA"],
    "autosave_interval": "five_year",
    "timeout_minutes": 360,
    "arms": [
      { "id": "vanilla", "no_mod": true,  "notes": { ... } },
      { "id": "stub", "mod_path": "mod_vanilla_stub",
        "build_config": "config/mod_config.vanilla_stub.json", "notes": { ... } }
    ]
  }
  Relative mod_path / build_config are resolved against the repo root. "notes" is copied
  verbatim into that arm's build_state.json agentic block.

  Output: tools\testbed\batches\<stamp>\
    batch.json        the job as run, plus one index entry per run (arm, session, seconds, rows)
    markets_all.tsv   every run's rows, merged, with an "arm" column in front
    <session dirs>    one run_observer session per run, exactly as run_observer writes them
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $Job,
    [switch] $WhatIf
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$Repo     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Observer = Join-Path $PSScriptRoot "run_observer.ps1"
$StopFile = Join-Path $PSScriptRoot "STOP"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $Job)) { throw "job file not found: $Job" }
$j = Get-Content $Job -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-JobValue {
    param($Obj, [string]$Name, $Default)
    if ($Obj.PSObject.Properties.Name -contains $Name -and $null -ne $Obj.$Name) { return $Obj.$Name }
    return $Default
}
function Resolve-RepoPath {
    param([string]$P)
    if (-not $P) { return "" }
    if ([System.IO.Path]::IsPathRooted($P)) { return $P }
    return (Join-Path $Repo $P)
}

$label      = Get-JobValue $j "label" "batch"
$perArm     = [int](Get-JobValue $j "runs_per_arm" 1)
$interleave = [bool](Get-JobValue $j "interleave" $true)
$dumpDates  = @(Get-JobValue $j "dump_dates" @("1840.1.1"))
$untilDate  = Get-JobValue $j "until_date" "1841.1.1"
$tags       = @(Get-JobValue $j "tags" @("GBR"))
$autosave   = Get-JobValue $j "autosave_interval" "five_year"
$timeout    = [int](Get-JobValue $j "timeout_minutes" 360)
$arms       = @($j.arms)
if ($arms.Count -lt 1) { throw "job has no arms" }

# ---- build the run order ----
$order = @()
if ($interleave) {
    for ($i = 1; $i -le $perArm; $i++) { foreach ($a in $arms) { $order += @{ arm = $a; iter = $i } } }
} else {
    foreach ($a in $arms) { for ($i = 1; $i -le $perArm; $i++) { $order += @{ arm = $a; iter = $i } } }
}

$stamp    = Get-Date -Format "yyyyMMdd_HHmmss"
$batchDir = Join-Path (Join-Path $PSScriptRoot "batches") "${stamp}_$label"

Write-Host ""
Write-Host "batch '$label': $($arms.Count) arm(s) x $perArm run(s) = $($order.Count) runs, $($dumpDates[0])..$untilDate"
Write-Host "order: $(($order | ForEach-Object { $_.arm.id }) -join ' -> ')"
Write-Host "out:   $batchDir"
# A 1836->1935 run measured ~2h20m; scale that by the span so the estimate follows the job.
$years = [int]$untilDate.Split('.')[0] - 1836
$estPerRun = [math]::Max(1, [int]($years * 85 / 60))
Write-Host ("estimate: ~{0} min/run x {1} = ~{2:N1} h  (rough - late years are slower)" -f $estPerRun, $order.Count, ($estPerRun * $order.Count / 60))
Write-Host ""
if ($WhatIf) { Write-Host "-WhatIf: nothing launched."; return }

if (Test-Path $StopFile) { Remove-Item $StopFile -Force }
$null = New-Item -ItemType Directory -Force -Path $batchDir

$index = @()
$n = 0
foreach ($step in $order) {
    $n++
    $arm = $step.arm
    if (Test-Path $StopFile) {
        Write-Host "STOP requested - not starting run $n of $($order.Count)"
        break
    }

    $armId = Get-JobValue $arm "id" "arm$n"
    $args = @(
        "-ExecutionPolicy", "Bypass", "-File", $Observer,
        "-Runs", "1",
        "-DumpDates", ($dumpDates -join ","),
        "-UntilDate", $untilDate,
        "-Tags", ($tags -join ","),
        "-AutosaveInterval", $autosave,
        "-TimeoutMinutes", "$timeout",
        "-OutRoot", $batchDir,
        "-Label", "$label/$armId#$($step.iter)"
    )
    if ([bool](Get-JobValue $arm "no_mod" $false)) { $args += "-NoMod" }
    $mp = Resolve-RepoPath (Get-JobValue $arm "mod_path" "")
    if ($mp) { $args += @("-ModPath", $mp) }
    $bc = Resolve-RepoPath (Get-JobValue $arm "build_config" "")
    if ($bc) { $args += @("-BuildConfig", $bc) }

    # the arm's notes become that session's build_state.json agentic block
    $notesFile = ""
    if ($arm.PSObject.Properties.Name -contains "notes" -and $arm.notes) {
        $notesFile = Join-Path $batchDir "_notes_$armId.json"
        [System.IO.File]::WriteAllText($notesFile, ($arm.notes | ConvertTo-Json -Depth 10), $Utf8NoBom)
        $args += @("-Notes", $notesFile)
    }

    $before = @(Get-ChildItem $batchDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    Write-Host "--- [$n/$($order.Count)] arm '$armId' iteration $($step.iter) ---"
    $t0 = Get-Date
    & powershell @args
    $secs = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)

    # the session run_observer just created is the new directory
    $after   = @(Get-ChildItem $batchDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $session = @($after | Where-Object { $before -notcontains $_ })
    $sessionName = $(if ($session.Count -gt 0) { $session[0] } else { "" })

    $rows = 0; $wall = $null
    if ($sessionName) {
        $metaPath = Join-Path $batchDir "$sessionName\run01\meta.json"
        if (Test-Path $metaPath) {
            $m = Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $rows = $m.goods_rows; $wall = $m.wall_seconds
        }
    }
    $index += [ordered]@{ n = $n; arm = $armId; iteration = $step.iter; session = $sessionName
                          driver_seconds = $secs; run_wall_seconds = $wall; goods_rows = $rows }
    Write-Host ("--- done: {0}s, {1} rows -> {2}" -f $secs, $rows, $sessionName)
}

# ---- merge every run's rows, with the arm in front ----
$header = "arm`trun_n`t" + "run`tdump_date`ttag`tmarket`tgood`tbuy_orders`tsell_orders`tprice`tstatus"
$merged = New-Object System.Collections.Generic.List[string]
$null = $merged.Add($header)
foreach ($e in $index) {
    if (-not $e.session) { continue }
    $tsv = Join-Path $batchDir "$($e.session)\run01\markets.tsv"
    if (-not (Test-Path $tsv)) { continue }
    $first = $true
    foreach ($line in (Get-Content $tsv)) {
        if ($first) { $first = $false; continue }
        $null = $merged.Add("$($e.arm)`t$($e.n)`t$line")
    }
}
[System.IO.File]::WriteAllLines((Join-Path $batchDir "markets_all.tsv"), [string[]]$merged, $Utf8NoBom)

$out = [ordered]@{
    label = $label; stamp = $stamp; job_file = (Resolve-Path $Job).Path
    job = $j; runs_planned = $order.Count; runs_done = $index.Count
    stopped_early = (Test-Path $StopFile); index = $index
}
[System.IO.File]::WriteAllText((Join-Path $batchDir "batch.json"), ($out | ConvertTo-Json -Depth 14), $Utf8NoBom)

Write-Host ""
Write-Host "BATCH DONE: $($index.Count)/$($order.Count) runs, $($merged.Count - 1) rows -> $batchDir"
if (Test-Path $StopFile) { Remove-Item $StopFile -Force }
