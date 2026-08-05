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
    ... -KeepMods   keep the mod_sched_<setup>\ folders (default: deleted when the schedule ends)

  OUTPUT - tools\testbed\sessions\<stamp>_<label>\
    schedule.json      the plan, verbatim
    session.json       what ran, per run, with status
    session.log        the driver's log
    markets_all.tsv    ALL runs, each row prefixed run_index + setup  <- the cross-run aggregate
    runNNN_<setup>\    one folder per run: build.log, build_state.json, telemetry.json, run.log,
                       meta.json, markets.tsv, events.tsv, harness.log, logs_live\, logs\
  A run folder is FLAT (the observer writes straight into it): there is no extra run01\ level and
  no per-run copy of the aggregate - one run's results live in exactly one place.

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
    # keep the mod_sched_<setup>\ folders this builds (default: delete them when the schedule ends;
    # they are ~1.7 MB each and fully reproducible from the setup's config)
    [switch] $KeepMods,
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
        # Which markets get PER-POP lines (metric `wages`): group -> successor chain. An OBJECT, so
        # it is passed through as-is rather than through the array-coercing Val defaults above.
        # ⚠ Both lookups are guarded: this script runs under StrictMode, where reading a property an
        # object does not have is a terminating error, not $null. A schedule that simply omits this
        # field is the NORMAL case (the metric has its own default), so an unguarded
        # `$defaults.wage_pop_markets` aborts every such schedule before its first run.
        wage_pop_markets = $(
            if     ($r.PSObject.Properties.Name -contains 'wage_pop_markets')        { $r.wage_pop_markets }
            elseif ($defaults -and $defaults.PSObject.Properties.Name -contains 'wage_pop_markets') { $defaults.wage_pop_markets }
            else   { $null })
        # ⚠ EVERY TELEMETRY SPEC KEY MUST BE LISTED HERE OR IT IS SILENTLY DROPPED. The plan entry is
        # the only thing that reaches the builder; a key present in the schedule JSON but absent here
        # simply never arrives, the mod builds without that block, and the run looks like the metric
        # failed rather than like the plumbing did. That cost a probe run on 2026-08-05 (the sparse
        # breakdown and wide sweep both emitted nothing until these four were added). Same guarded
        # lookup as wage_pop_markets, for the same StrictMode reason.
        breakdown_dates = $(Val $r "breakdown_dates" @(Val $defaults "breakdown_dates" @()))
        breakdown_tags  = $(Val $r "breakdown_tags"  @(Val $defaults "breakdown_tags"  @()))
        wide_dates      = $(Val $r "wide_dates"      @(Val $defaults "wide_dates"      @()))
        wide_tags       = $(Val $r "wide_tags"       @(Val $defaults "wide_tags"       @()))
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
$modsBuilt = @{}
foreach ($p in $plan) {
    if ($abort) { Log "schedule aborted - skipping remaining runs" "WARN"; break }
    $runNo++
    $token   = "{0}s{1:d3}" -f $stamp, $p.index
    $runDir  = Join-Path $sessionDir ("run{0:d3}_{1}" -f $p.index, $p.setup)
    $null = New-Item -ItemType Directory -Force -Path $runDir

    # telemetry spec for this run - the builder bakes it into whatever mod it makes
    $specFile = Join-Path $runDir "telemetry.json"
    $spec = [ordered]@{ dump_dates = $p.dump_dates; tags = $p.tags; metrics = $p.metrics }
    if ($p.wage_pop_markets) { $spec['wage_pop_markets'] = $p.wage_pop_markets }
    foreach ($k in @('breakdown_dates','breakdown_tags','wide_dates','wide_tags')) {
        if ($p.$k -and @($p.$k).Count) { $spec[$k] = @($p.$k) }
    }
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
    $modsBuilt[$resolved.ModPath] = $true

    # ---- run it. run_observer owns the game: launch, supervise, harvest, crash-resume. ----
    # -Stamp: the run inherits THIS schedule's identity, so build_state.json, the folder and the
    # telemetry token all say the same thing instead of three different timestamps.
    $obsArgs = @("-ExecutionPolicy","Bypass","-File",$Observer,
                 "-Runs","1",
                 "-ModPath",$resolved.ModPath,
                 "-DumpDates",($p.dump_dates -join ","),
                 "-UntilDate",$p.until,
                 "-Tags",($p.tags -join ","),
                 "-AutosaveInterval",$p.autosave,
                 "-TimeoutMinutes","$($p.timeout)",
                 "-OutRoot",$runDir, "-FlatOut",
                 "-Stamp",$stamp,
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

# ---- cross-run aggregate. This is the level the aggregate belongs at: each run folder holds ONE
#      run's markets.tsv, and comparing setups means reading them together. Every row is prefixed
#      with the run index + setup, so a row identifies its arm without a lookup.
$allRows = New-Object System.Collections.Generic.List[string]
foreach ($e in $index) {
    if (-not $e.Contains("dir")) { continue }
    $tsv = Join-Path (Join-Path $sessionDir $e.dir) "markets.tsv"
    if (-not (Test-Path $tsv)) { continue }
    $lines = @(Get-Content $tsv)
    for ($k = 1; $k -lt $lines.Count; $k++) {           # skip the per-run header
        if (-not $lines[$k]) { continue }
        $cols = $lines[$k] -split "`t"
        # drop the per-run "run" column (always 1 under the scheduler) and prefix run_index + setup
        $rest = if ($cols.Count -gt 1) { ($cols[1..($cols.Count - 1)]) -join "`t" } else { "" }
        $null = $allRows.Add(("{0}`t{1}`t{2}" -f $e.index, $e.setup, $rest))
    }
}
$aggHeader = "run_index`tsetup`tdump_date`ttag`tmarket`tgood`tbuy_orders`tsell_orders`tprice`timports`texports`tproduction`tstatus"
[System.IO.File]::WriteAllLines((Join-Path $sessionDir "markets_all.tsv"), [string[]](@($aggHeader) + $allRows.ToArray()), $Utf8)
Log "aggregate: $($allRows.Count) row(s) -> markets_all.tsv"

$summary = [ordered]@{
    label = $label; stamp = $stamp; schedule_file = (Resolve-Path $Schedule).Path
    runs_planned = $plan.Count; runs_executed = $index.Count; aborted = $abort
    schedule = ($schedRaw | ConvertFrom-Json); index = $index
}
[System.IO.File]::WriteAllText((Join-Path $sessionDir "session.json"), ($summary | ConvertTo-Json -Depth 14), $Utf8)

# ---- the built mods are BUILD OUTPUT, not results: reproducible from the setup's config, ~1.7 MB
#      each, and previously left behind forever. build_state.json already records what each one was.
if (-not $KeepMods) {
    foreach ($m in $modsBuilt.Keys) {
        if (Test-Path $m) { Remove-Item $m -Recurse -Force -ErrorAction SilentlyContinue }
    }
    if ($modsBuilt.Count -gt 0) { Log "removed $($modsBuilt.Count) built mod folder(s) (pass -KeepMods to keep them)" }
}
Log "SCHEDULE DONE: $($index.Count)/$($plan.Count) run(s) -> $sessionDir"
