<#
  run_schedule.ps1 - run an ordered SCHEDULE of testbed runs from a JSON file.

  This is the entry point for all measurement. It owns the loop:
      schedule JSON  ->  build each run's mod via build.ps1  ->  run it  ->  harvest
  Nothing else should invoke the builder to produce test data; going straight to build.ps1
  bypasses the record of what was built and why.

  The runs list is EXPLICIT and ORDERED, so any sequence works, including repeats and
  alternation:  A@1841, B@1841, A@1841, B@1846, B@1846, B@1846.
  Every run records its index in the schedule, and the schedule JSON is copied verbatim into
  the session folder, so a result can always be traced back to the exact plan that produced it.

  Usage (from a console you can type into - see CONTROL below):
    powershell -ExecutionPolicy Bypass -File tools\testbed\run_schedule.ps1 -Schedule tools\testbed\schedules\example.json
    ... -WhatIf     print the plan, the builds it implies and a time estimate; launch nothing

  CONTROL, while running:
    [p] pause    [r] resume    [s] stop after this run    [x] stop now
  Pause suspends the watchdog AND crash detection, so a paused session is never mistaken for a
  crash. The runner cannot pause the GAME - pause it yourself; on resume the runner checks
  whether victoria3.exe is still up: if it is, it just keeps watching; if it is gone, it
  resumes that run from its last autosave.

  SCHEDULE FORMAT
  {
    "schedule_version": 1,
    "label": "be-sweep-1",
    "defaults": { "tags": ["GBR","FRA"], "metrics": ["market_goods"],
                  "autosave_interval": "five_year", "timeout_minutes": 360 },
    "setups": {
      "vanilla": { "kind": "control" },
      "A":       { "kind": "config", "config": "config/mod_config.json" },
      "B":       { "kind": "config", "config": "config/mod_config.be_minus10.json", "lint": false }
    },
    "runs": [
      { "setup": "A",       "until": "1841.1.1" },
      { "setup": "vanilla", "until": "1841.1.1", "dump_dates": ["1838.1.1","1840.1.1"] }
    ]
  }
  A run's dump_dates default to 1 January of the year before `until`. Relative paths resolve
  against the repo root. `kind: recipe` (ordered solver steps) is deliberately NOT implemented
  yet - see the note at Resolve-Setup.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $Schedule,
    [string] $OutRoot = "",
    [switch] $WhatIf
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$Repo     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Observer = Join-Path $PSScriptRoot "run_observer.ps1"
$Builder  = Join-Path $Repo "tools\build.ps1"
$Utf8     = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $Schedule)) { throw "schedule not found: $Schedule" }
$schedRaw = Get-Content $Schedule -Raw -Encoding UTF8
$sched    = $schedRaw | ConvertFrom-Json

function Val {
    param($Obj, [string]$Name, $Default)
    if ($null -eq $Obj) { return $Default }
    $names = @($Obj.PSObject.Properties | ForEach-Object { $_.Name })
    if ($names -contains $Name -and $null -ne $Obj.$Name) { return $Obj.$Name }
    return $Default
}
function RepoPath {
    param([string]$P)
    if (-not $P) { return "" }
    if ([System.IO.Path]::IsPathRooted($P)) { return $P }
    return (Join-Path $Repo $P)
}

$label    = Val $sched "label" "schedule"
$defaults = Val $sched "defaults" $null
$setups   = Val $sched "setups" $null
$runs     = @(Val $sched "runs" @())
if (-not $setups)      { throw "schedule has no 'setups'" }
if ($runs.Count -lt 1) { throw "schedule has no 'runs'" }

$defTags     = @(Val $defaults "tags" @("GBR","FRA"))
$defMetrics  = @(Val $defaults "metrics" @("market_goods"))
$defAutosave = Val $defaults "autosave_interval" "five_year"
$defTimeout  = [int](Val $defaults "timeout_minutes" 360)

# ---- validate everything BEFORE building or launching anything ----
$setupNames = @($setups.PSObject.Properties | ForEach-Object { $_.Name })
$plan = @()
$i = 0
foreach ($r in $runs) {
    $i++
    $sid = Val $r "setup" ""
    if (-not $sid)                      { throw "run #$i has no 'setup'" }
    if ($setupNames -notcontains $sid)  { throw "run #$i references unknown setup '$sid'" }
    $until = Val $r "until" ""
    if ($until -notmatch '^\d{3,4}\.\d{1,2}\.\d{1,2}$') { throw "run #$i has a bad 'until' date: '$until'" }
    $dumps = @(Val $r "dump_dates" @())
    if ($dumps.Count -eq 0) { $dumps = @("$([int]$until.Split('.')[0] - 1).1.1") }   # year before `until`
    foreach ($d in $dumps) {
        if ($d -notmatch '^\d{3,4}\.\d{1,2}\.1$') { throw "run #$i dump date '$d' must be the 1st of a month (on_monthly_pulse only fires then)" }
    }
    $plan += [ordered]@{
        index = $i; setup = $sid; until = $until; dump_dates = $dumps
        tags = @(Val $r "tags" $defTags); metrics = @(Val $r "metrics" $defMetrics)
        autosave = Val $r "autosave_interval" $defAutosave
        timeout  = [int](Val $r "timeout_minutes" $defTimeout)
    }
}

# ---- plan report + estimate ----
$years = 0; foreach ($p in $plan) { $years += ([int]$p.until.Split('.')[0] - 1836) }
$estMin = [int]($years * 85 / 60)          # ~85 s per in-game year, measured on a 1836-1935 run
Write-Host ""
Write-Host "schedule '$label': $($plan.Count) run(s) over $($setupNames.Count) setup(s)"
foreach ($p in $plan) { Write-Host ("  #{0,-3} {1,-12} -> {2}   dumps: {3}" -f $p.index, $p.setup, $p.until, ($p.dump_dates -join ', ')) }
Write-Host ("estimate: ~{0:N1} h of game time (rough - late years run slower)" -f ($estMin / 60))
Write-Host ""
if ($WhatIf) { Write-Host "-WhatIf: nothing built, nothing launched."; return }

$stamp      = Get-Date -Format "yyyyMMdd_HHmmss"
if (-not $OutRoot) { $OutRoot = Join-Path $PSScriptRoot "sessions" }   # schedules/ holds SPECS; sessions/ holds RESULTS
$sessionDir = Join-Path $OutRoot "${stamp}_$label"
$null = New-Item -ItemType Directory -Force -Path $sessionDir
# the plan, verbatim, next to its results
Copy-Item $Schedule (Join-Path $sessionDir "schedule.json") -Force

$sessionLog = Join-Path $sessionDir "session.log"
function Log {
    param([string]$m, [string]$lvl = "INFO")
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "HH:mm:ss"), $lvl, $m
    Write-Host $line
    Add-Content -Path $sessionLog -Value $line -Encoding utf8
}

# ---- build a setup's mod. Rebuilt for EVERY run, deliberately: builds are deterministic
#      (same config + same vanilla -> same output), they take ~1 min, and caching would hide
#      a setup whose recipe is not reproducible. See CLAUDE.md.
function Resolve-Setup {
    param([string]$Id, $Spec, [string]$SpecFile, [string]$Token)
    $kind = Val $Spec "kind" "config"
    $modName = "sched_$($Id -replace '[^A-Za-z0-9._-]','_')"
    $args = @("-ExecutionPolicy","Bypass","-File",$Builder,"-SaveTo",$modName,
              "-Telemetry",$SpecFile,"-TelemetryToken",$Token)
    switch ($kind) {
        "control" { $args += "-ControlOnly" }
        "config"  {
            $cfg = RepoPath (Val $Spec "config" "config/mod_config.json")
            if (-not (Test-Path $cfg)) { throw "setup '$Id': config not found: $cfg" }
            $args += @("-Config", $cfg)
            if (-not [bool](Val $Spec "lint" $true)) { $args += "-NoLint" }
        }
        "recipe"  {
            # Deliberately unimplemented. A recipe encodes BALANCE METHODOLOGY (solve BE, then
            # volumes, then costs), so its vocabulary dies with the next BE rework. Author the
            # config file instead and reference it with kind:config - a config is inert data and
            # survives any solver change. Revisit once the BE approach settles.
            throw "setup '$Id': kind 'recipe' is not implemented yet - use kind 'config' with a prepared config file"
        }
        default   { throw "setup '$Id': unknown kind '$kind'" }
    }
    return @{ Args = $args; ModPath = (Join-Path $Repo "mod_$modName"); Kind = $kind }
}

$index = @()
$abort = $false
$runNo = 0
foreach ($p in $plan) {
    if ($abort) { Log "schedule aborted - skipping remaining runs" "WARN"; break }
    $runNo++
    $token   = "{0}s{1:d3}" -f $stamp, $p.index
    $runDir  = Join-Path $sessionDir ("run{0:d3}_{1}" -f $p.index, $p.setup)
    $null = New-Item -ItemType Directory -Force -Path $runDir

    # telemetry spec for this run - the builder bakes it into whatever mod it makes
    $specFile = Join-Path $runDir "telemetry.json"
    $spec = [ordered]@{ dump_dates = $p.dump_dates; tags = $p.tags; metrics = $p.metrics }
    [System.IO.File]::WriteAllText($specFile, ($spec | ConvertTo-Json -Depth 6), $Utf8)

    Log "=== run $($p.index)/$($plan.Count): setup '$($p.setup)' -> $($p.until) ==="
    $setupSpec = $setups.$($p.setup)
    $resolved = Resolve-Setup -Id $p.setup -Spec $setupSpec -SpecFile $specFile -Token $token

    Log "building setup '$($p.setup)' (kind $($resolved.Kind))..."
    $t0 = Get-Date
    # Out-File, not Tee-Object: Tee-Object writes UTF-16 on PS 5.1, which makes build.log ungreppable
    & powershell @($resolved.Args) 2>&1 | Out-File -FilePath (Join-Path $runDir "build.log") -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        Log "BUILD FAILED for setup '$($p.setup)' (exit $LASTEXITCODE) - see build.log; aborting schedule" "ALERT"
        $abort = $true
        $index += [ordered]@{ index = $p.index; setup = $p.setup; status = "build_failed" }
        continue
    }
    Log ("build ok in {0:N0}s -> {1}" -f ((Get-Date)-$t0).TotalSeconds, (Split-Path $resolved.ModPath -Leaf))

    # ---- run it. run_observer owns the game: launch, supervise, harvest, crash-resume. ----
    $obsArgs = @("-ExecutionPolicy","Bypass","-File",$Observer,
                 "-Runs","1",
                 "-ModPath",$resolved.ModPath,
                 "-DumpDates",($p.dump_dates -join ","),
                 "-UntilDate",$p.until,
                 "-Tags",($p.tags -join ","),
                 "-AutosaveInterval",$p.autosave,
                 "-TimeoutMinutes","$($p.timeout)",
                 "-OutRoot",$runDir, "-FlatOut",
                 "-NoInstrument",
                 "-TelemetryToken",$token,
                 "-Label","$label/#$($p.index) $($p.setup)")
    & powershell @obsArgs
    $rc = $LASTEXITCODE

    $status = switch ($rc) { 0 { "ok" } 2 { "stopped_by_user" } 3 { "fatal_early_crashes" } default { "failed($rc)" } }
    Log "run $($p.index) finished: $status"
    if ($rc -eq 3) {
        Log "REPEATED EARLY CRASHES - the mod for setup '$($p.setup)' is probably broken. Aborting the whole schedule." "ALERT"
        $abort = $true
    } elseif ($rc -eq 2) {
        Log "stopped by user - not continuing with the remaining runs" "WARN"
        $abort = $true
    }
    $index += [ordered]@{ index = $p.index; setup = $p.setup; until = $p.until
                          dump_dates = $p.dump_dates; mod = (Split-Path $resolved.ModPath -Leaf)
                          token = $token; status = $status; dir = (Split-Path $runDir -Leaf) }
}

$summary = [ordered]@{
    label = $label; stamp = $stamp; schedule_file = (Resolve-Path $Schedule).Path
    runs_planned = $plan.Count; runs_executed = $index.Count; aborted = $abort
    schedule = ($schedRaw | ConvertFrom-Json); index = $index
}
[System.IO.File]::WriteAllText((Join-Path $sessionDir "session.json"), ($summary | ConvertTo-Json -Depth 14), $Utf8)
Log "SCHEDULE DONE: $($index.Count)/$($plan.Count) run(s) -> $sessionDir"
