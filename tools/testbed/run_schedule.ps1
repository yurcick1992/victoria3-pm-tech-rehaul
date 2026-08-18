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
    [switch] $WhatIf,
    # ⭐ THE SAVEGAME INSTRUMENT (ROADMAP step 3.5). Stage A (archive) AND stages B-D (melt / extract /
    # reap) both run CONCURRENTLY with the game, so a save is summarised and deleted minutes after it is
    # written instead of tens of gigabytes standing until the run ends (user ruling, 2026-08-11). At
    # yearly cadence that holds the queue near zero; at quarterly it is the difference between ~16 GB and
    # ~nothing per run. A final synchronous drain always follows the run, so a dead watcher costs
    # nothing but time.
    # ⚠ The concurrent melt costs ~5 s of ONE core per save, on a 20-core machine against a mostly
    # single-threaded engine. Believed negligible; NOT measured. `-HarvestWorkers 0` restores the old
    # drain-between-runs shape for a batch that needs the machine perfectly quiet.
    [switch] $NoSaveHarvest,
    [int]    $HarvestWorkers = 4,
    # keep every archived save instead of reaping it once its summary verifies (needs ~16 GB per run)
    [switch] $KeepSaves,
    # ⭐ L21 — HOW LONG A BUILD MAY TAKE BEFORE IT IS KILLED AND THE SCHEDULE ABORTS.
    # A build is ~7 s. On 2026-08-18 one failed in 3 s and the scheduler hung for 6 h 40 min without
    # ever reaching its own exit-code test, costing the whole window (TESTBED_LANDMINES L21). The
    # blocking mechanism was never identified, so this bounds the build rather than diagnosing it.
    # 10 minutes is ~85x the normal build and still releases the machine the same morning.
    [int]    $BuildTimeoutMinutes = 10
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

# "1886.1.1" -> 18860101, for ordering. Returns 0 if unparseable, so a missing date can never make a
# run look like it reached its target. ⚠ A COPY of run_observer.ps1's helper, deliberately: the observer
# runs its whole body on import, so it cannot be dot-sourced for one function. Eight lines duplicated
# beats executing a game driver to borrow a parser.
function ConvertTo-DateNum {
    param([string]$D)
    if (-not $D) { return 0 }
    $p = "$D".Split('.')
    if ($p.Count -lt 3) { return 0 }
    return ([int]$p[0]) * 10000 + ([int]$p[1]) * 100 + ([int]$p[2])
}

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
$defDumps    = @(Val $defaults "dump_dates" @())

# ---- L16: A `defaults` KEY THAT IS HONOURED FOR SOME FIELDS AND SILENTLY DROPPED FOR OTHERS --------
# `dump_dates` used to be read from the RUN ONLY, with no $defaults fallback - unlike `tags` and
# `metrics` sitting on the very next lines. So a defaults-level dump_dates was accepted by the JSON,
# read by nothing, and every run quietly fell back to ONE computed dump date instead of the twelve
# that were asked for: a per-decade series silently becomes a single endpoint, and the run looks like
# the METRIC failed rather than the plumbing. The fallback above closes it.
# ⚠ THE GUARD MATTERS MORE THAN THE FIX. The next key added to `defaults` will have the same hazard,
# so this refuses to start on any defaults key the scheduler does not actually thread through - and
# it names the key. A comment sitting on the right line did not stop this happening the first time
# (TESTBED_LANDMINES L5 makes the same point about spec keys); a check that throws does.
$KNOWN_DEFAULT_KEYS = @('tags','metrics','autosave_interval','timeout_minutes','dump_dates','wages_markets')
if ($defaults) {
    $unknown = @($defaults.PSObject.Properties | ForEach-Object { $_.Name } |
                 Where-Object { $KNOWN_DEFAULT_KEYS -notcontains $_ -and $_ -notlike '_*' })
    if ($unknown.Count) {
        throw ("L16: schedule 'defaults' carries key(s) the scheduler does not thread through: " +
               ($unknown -join ', ') +
               ". A defaults key that nothing reads is accepted silently and changes nothing, which reads as a failed METRIC rather than failed plumbing. Either move it to each run, or thread it through and add it to `$KNOWN_DEFAULT_KEYS. (Keys prefixed with _ are treated as comments.)")
    }
}

# ---- validate everything BEFORE building or launching anything ----
$setupNames = @($setups.PSObject.Properties | ForEach-Object { $_.Name })

# ⚠ SETUP SHAPE IS VALIDATED HERE, NOT LAZILY IN Resolve-Setup. Resolve-Setup runs per run, inside the
# execution loop and AFTER the -WhatIf return - so a malformed setup used only by the last run of an
# overnight schedule was not reported until that run began, hours in, and -WhatIf could not surface it
# at all. This header says "validate everything BEFORE building or launching anything"; it now does.
foreach ($sn in $setupNames) {
    $sp = $setups.$sn
    $sk = Val $sp "kind" "config"
    $sc = Val $sp "config" $null
    switch ($sk) {
        "control" {
            if ($sc) { throw "setup '$sn': kind 'control' takes no 'config' - a control arm carries no gameplay content. Use kind 'overlay' for vanilla + one declared change." }
        }
        "overlay" {
            if (-not $sc) { throw "setup '$sn': kind 'overlay' requires a 'config' naming what the overlay is" }
            if (-not (Test-Path (RepoPath $sc))) { throw "setup '$sn': config not found: $(RepoPath $sc)" }
        }
        "config"  {
            if ($sc -and -not (Test-Path (RepoPath $sc))) { throw "setup '$sn': config not found: $(RepoPath $sc)" }
        }
        "recipe"  { throw "setup '$sn': kind 'recipe' is not implemented yet - use kind 'config' with a prepared config file" }
        default   { throw "setup '$sn': unknown kind '$sk'" }
    }
}

$plan = @()
$i = 0
foreach ($r in $runs) {
    $i++
    $sid = Val $r "setup" ""
    if (-not $sid)                      { throw "run #$i has no 'setup'" }
    if ($setupNames -notcontains $sid)  { throw "run #$i references unknown setup '$sid'" }
    $until = Val $r "until" ""
    if ($until -notmatch '^\d{3,4}\.\d{1,2}\.\d{1,2}$') { throw "run #$i has a bad 'until' date: '$until'" }
    $dumps = @(Val $r "dump_dates" $defDumps)   # L16: defaults-level dump_dates is now honoured
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
        #
        # ⚠ THIS COMMENT WAS ALREADY HERE AND `origin_goods` STILL SLIPPED THROUGH - it was read by
        # Read-TelemetrySpec, requested by three schedules, and listed nowhere here, so every
        # scheduled origins run silently fell back to the hardcoded goods list. Found 2026-08-06 by
        # tools/preflight.ps1, which now checks this mechanically (landmine L5). A warning at the
        # right place is not a guardrail; the check is. Add the key BOTH here and in the spec writer
        # below, and preflight will confirm it.
        breakdown_dates = $(Val $r "breakdown_dates" @(Val $defaults "breakdown_dates" @()))
        breakdown_tags  = $(Val $r "breakdown_tags"  @(Val $defaults "breakdown_tags"  @()))
        wide_dates      = $(Val $r "wide_dates"      @(Val $defaults "wide_dates"      @()))
        wide_tags       = $(Val $r "wide_tags"       @(Val $defaults "wide_tags"       @()))
        origin_goods    = $(Val $r "origin_goods"    @(Val $defaults "origin_goods"    @()))
        autosave = Val $r "autosave_interval" $defAutosave
        timeout  = [int](Val $r "timeout_minutes" $defTimeout)
    }
}

# ---- PREFLIGHT, repo half, BEFORE the estimate is printed ----
# Game time is the one cost that cannot be recovered. The per-build half of preflight runs inside
# build.ps1 and would catch an emitted landmine anyway - but it would catch it after this script has
# already announced an 8-hour estimate. The repo-level entries (a spec key the scheduler drops,
# telemetry changed without a schema bump, an unfiltered log reader) need no built mod, so they gate
# here in about two seconds. See TESTBED_LANDMINES.md.
& (Join-Path (Split-Path $PSScriptRoot -Parent) 'preflight.ps1') -RepoOnly -Quiet
if ($LASTEXITCODE -ne 0) {
    $global:LASTEXITCODE = 0
    throw "PREFLIGHT FAILED - see the landmine IDs above and TESTBED_LANDMINES.md. Nothing was built and nothing launched."
}
$global:LASTEXITCODE = 0

# ---- L20, per SETUP, still before the estimate. The repo-wide pass above only WARNS (it does not
#      know which config this batch will build); here every setup's own config is named, so a batch
#      pointed at an alternate with no paired tech_tree_options dies in two seconds instead of at
#      its first build - which on 2026-08-18 cost 6 h 40 min and produced zero runs.
foreach ($sname in @($setups.PSObject.Properties.Name)) {
    $scfg = Val $setups.$sname 'config' $null
    if (-not $scfg) { continue }
    & (Join-Path (Split-Path $PSScriptRoot -Parent) 'preflight.ps1') -RepoOnly -Only L20 -Config (RepoPath $scfg) -Quiet
    if ($LASTEXITCODE -ne 0) {
        $global:LASTEXITCODE = 0
        throw "PREFLIGHT FAILED (L20) for setup '$sname' - see above. Nothing was built and nothing launched."
    }
    $global:LASTEXITCODE = 0
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
    $cfg = $null
    switch ($kind) {
        "control" {
            # PURE vanilla + telemetry, no gameplay content whatsoever. A config here is a mistake,
            # not a feature: the builder throws if one carries content, and accepting the argument
            # at all was how the guarantee got lost in the first place. Use `kind: overlay`.
            if (Val $Spec "config" $null) {
                throw "setup '$Id': kind 'control' takes no 'config' - a control arm carries no gameplay content. Use kind 'overlay' for vanilla + one declared change."
            }
            $args += "-ControlOnly"
        }
        "overlay"  {
            # ⚠ NOT A CONTROL. Vanilla + telemetry + a small DECLARED overlay, today exactly the
            # config's `pop_need_weight_mult` and nothing else. It exists so a treatment against a
            # vanilla control is expressible without pretending to be one; build_state records
            # `arm: overlay+<what>`, and no finding from it may be reported as a control.
            $cfg = RepoPath (Val $Spec "config" "")
            if (-not $cfg)               { throw "setup '$Id': kind 'overlay' requires a 'config' naming what the overlay is" }
            if (-not (Test-Path $cfg))   { throw "setup '$Id': config not found: $cfg" }
            $args += @("-Overlay", "-Config", $cfg)
        }
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
    # Config is returned so it can be handed to the observer as -BuildConfig. Without that,
    # build_state.json records `built_from_config: ""` and `config_sha256: null` - the two fields
    # CLAUDE.md requires to be machine-read, and precisely the two that would have caught the
    # 2026-08-05 wrong-arm day, where which arm each session ran had to be reconstructed by hand
    # from schedule.json. See run_observer.ps1's build_state block.
    return @{ Args = $args; ModPath = (Join-Path $Repo "mod_$modName"); Kind = $kind; Config = $cfg }
}

# ---- L21 - THE BUILD IS BOUNDED, AND ITS VERDICT COMES FROM THE PROCESS, NOT THE PIPELINE.
#      On 2026-08-18 a build failed in 3 seconds and this scheduler sat alive for 6 h 40 min: the old
#      form was  & powershell @args 2>&1 | Out-File build.log , and it never reached the exit-code test
#      below it. session.log ended mid-sentence, no BUILD FAILED line was ever written, the harness held
#      9.5 s of CPU with no build child, and the whole overnight window produced zero runs.
#      The blocking mechanism was NEVER IDENTIFIED (candidates: PS 5.1 wrapping a native command's
#      stderr into NativeCommandError records under 2>&1; Out-File holding the pipeline; a QuickEdit
#      console-selection freeze). WARN: do NOT write the cause into the fix - write the TIMEOUT, which
#      is correct whichever it was. Three properties, all load-bearing:
#        1. the child is BOUNDED and killed as a TREE on expiry (build.ps1 spawns node/robocopy
#           children, and $proc.Kill() on PS 5.1 orphans them);
#        2. the exit code comes from the PROCESS OBJECT, so a stuck stream cannot swallow it;
#        3. output goes to FILES by redirection, never through a PowerShell pipeline.
#      WARN: Start-Process joins -ArgumentList with SPACES and QUOTES NOTHING, and this repo lives under
#      a path with a space - every element is quoted here by hand. Same trap as the archiver launch.
function Quote-ProcArg {
    param([string]$A)
    if ($A -eq "") { return '""' }
    if ($A -match '[\s"]') { return '"' + ($A -replace '"', '\"') + '"' }
    return $A
}
function Invoke-BoundedBuild {
    param([string[]]$BuildArgs, [string]$RunDir, [int]$TimeoutMinutes)
    $logPath = Join-Path $RunDir "build.log"
    $outPath = Join-Path $RunDir "build.stdout.log"
    $errPath = Join-Path $RunDir "build.stderr.log"
    foreach ($pth in @($logPath, $outPath, $errPath)) { if (Test-Path $pth) { Remove-Item $pth -Force } }

    $argLine = (($BuildArgs | ForEach-Object { Quote-ProcArg $_ }) -join ' ')
    # -NoNewWindow so the child shares this console (it reads no stdin and its streams are on files, so
    # it cannot touch the p/r/s/x keypress control this session depends on).
    $proc = Start-Process -FilePath "powershell" -ArgumentList $argLine -PassThru -NoNewWindow -RedirectStandardOutput $outPath -RedirectStandardError $errPath
    # PS 5.1 QUIRK: -PassThru WITHOUT -Wait hands back a Process whose ExitCode reads $null unless
    # the handle has been touched - .NET closes it otherwise. Proven: the first L21 proof run
    # reported exit -1 (this function's 'unverifiable' fallback) where the build really exited 1.
    $null = $proc.Handle
    $timedOut = $false
    if (-not $proc.WaitForExit($TimeoutMinutes * 60 * 1000)) {
        $timedOut = $true
        try { & taskkill /T /F /PID $proc.Id | Out-Null } catch { }
        try { if (-not $proc.HasExited) { $proc.Kill() } } catch { }
        Start-Sleep -Seconds 2
    } else {
        $proc.WaitForExit()          # flush the redirected streams before they are read
    }

    # ONE greppable build.log, stdout then stderr - the node ENOENT that L20 is about arrives on stderr,
    # and the 2026-08-18 build.log was missing it entirely.
    $outTxt = ""
    $errTxt = ""
    # WARN: `$x = [string](Get-Content -Raw)` on an EMPTY file leaves $x NULL, not "" - the cast has
    # nothing to act on - and under Set-StrictMode 2.0 the next .Trim() is a terminating error. That
    # is exactly the TIMEOUT case (a hung build has usually written no stderr at all), so the guard
    # below is what makes the timeout branch survive to report itself.
    $rawOut = if (Test-Path $outPath) { Get-Content $outPath -Raw -ErrorAction SilentlyContinue } else { $null }
    $rawErr = if (Test-Path $errPath) { Get-Content $errPath -Raw -ErrorAction SilentlyContinue } else { $null }
    if ($null -ne $rawOut) { $outTxt = [string]$rawOut }
    if ($null -ne $rawErr) { $errTxt = [string]$rawErr }
    $merged = $outTxt
    if ($errTxt.Trim()) { $merged += "`r`n----- stderr -----`r`n" + $errTxt }
    [System.IO.File]::WriteAllText($logPath, $merged, $Utf8)
    Remove-Item $outPath, $errPath -Force -ErrorAction SilentlyContinue

    $rc = $null
    if ($timedOut) {
        $rc = 124
    } else {
        try { $rc = $proc.ExitCode } catch { $rc = $null }
        # An unverifiable build is a FAILED build. Never pass one through: the whole point of taking the
        # verdict off the process object is that it can be trusted, and a null here means it cannot be.
        if ($null -eq $rc) { $rc = -1 }
    }
    $tail = @()
    if ($rc -ne 0) {
        $tail = @(($merged -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -Last 8)
    }
    return @{ ExitCode = $rc; TimedOut = $timedOut; Tail = $tail }
}

$index = @()
$abort = $false
# L21: a build failure/timeout must ABORT and say so in the process exit code, not just in the log.
$fatalExit = 0
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
    foreach ($k in @('breakdown_dates','breakdown_tags','wide_dates','wide_tags','origin_goods')) {
        if ($p.$k -and @($p.$k).Count) { $spec[$k] = @($p.$k) }
    }
    [System.IO.File]::WriteAllText($specFile, ($spec | ConvertTo-Json -Depth 6), $Utf8)

    Log "=== run $($p.index)/$($plan.Count): setup '$($p.setup)' -> $($p.until) ==="
    $setupSpec = $setups.$($p.setup)
    $resolved = Resolve-Setup -Id $p.setup -Spec $setupSpec -SpecFile $specFile -Token $token

    Log "building setup '$($p.setup)' (kind $($resolved.Kind))..."
    $t0 = Get-Date
    $bres = Invoke-BoundedBuild -BuildArgs $resolved.Args -RunDir $runDir -TimeoutMinutes $BuildTimeoutMinutes
    if ($bres.TimedOut) {
        Log "BUILD TIMED OUT for setup '$($p.setup)' after $BuildTimeoutMinutes min - child killed; see build.log; aborting schedule" "ALERT"
        foreach ($bl in $bres.Tail) { Log "  build.log| $bl" "ALERT" }
        $abort = $true; $fatalExit = 3
        $index += [ordered]@{ index = $p.index; setup = $p.setup; status = "build_timeout" }
        continue
    }
    if ($bres.ExitCode -ne 0) {
        Log "BUILD FAILED for setup '$($p.setup)' (exit $($bres.ExitCode)) - see build.log; aborting schedule" "ALERT"
        foreach ($bl in $bres.Tail) { Log "  build.log| $bl" "ALERT" }
        $abort = $true; $fatalExit = 3
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
    # PROVENANCE: the arm this run was built from, machine-read into build_state.json. A control arm
    # with no config passes nothing, and build_state then reads as the pure-vanilla arm it is.
    if ($resolved.Config) { $obsArgs += @("-BuildConfig",$resolved.Config) }

    # ---- STAGE A: archive autosaves CONCURRENTLY with the game (a file copy; the engine rotates its
    #      slots by RENAME and a 45 MB write is not atomic, both of which archive_autosaves.ps1 handles).
    #      -SkipExisting is what keeps run N's leftover slots out of run N+1's folder.
    $saveDir = Join-Path $runDir "saves"
    $sumDir  = Join-Path $runDir "save_summaries"
    $arch = $null
    if (-not $NoSaveHarvest) {
        $stopArch = Join-Path $PSScriptRoot "STOP_ARCHIVE"
        if (Test-Path $stopArch) { Remove-Item $stopArch -Force }
        # ⚠⚠ EVERY PATH IS QUOTED, INCLUDING THE -File ONE. `Start-Process -ArgumentList` joins an array
        # with spaces and quotes NOTHING, and this repo lives under "victoria 3 PM and tech rehaul" — so
        # an unquoted script path makes powershell report
        #   Processing -File 'C:\claude-code\victoria' failed ... does not have a '.ps1' extension
        # into a hidden window, and the archiver is simply never there. The first launch of this batch
        # played 3.5 in-game years capturing nothing before that was noticed; -WindowStyle Hidden is
        # what made it silent. The run's own log now proves the archiver is alive rather than started.
        $archLog = Join-Path $runDir "archiver_launch.log"
        $arch = Start-Process powershell -PassThru -WindowStyle Hidden -RedirectStandardError $archLog -ArgumentList @(
            "-ExecutionPolicy","Bypass","-File","`"$(Join-Path $PSScriptRoot 'archive_autosaves.ps1')`"",
            "-Dest","`"$saveDir`"","-SkipExisting","-MaxMinutes","$($p.timeout + 15)","-IdleExitMinutes","5")
        $null = $arch.Handle
        Start-Sleep -Seconds 3
        if ($arch.HasExited) {
            $why = (Get-Content $archLog -Tail 3 -ErrorAction SilentlyContinue) -join ' / '
            Log "ARCHIVER DIED AT LAUNCH (exit $($arch.ExitCode)): $why - no saves will be captured for this run" "ALERT"
            $arch = $null
        } else {
            Log "autosave archiver alive (pid $($arch.Id)) -> $(Split-Path $saveDir -Leaf)\"
        }
    }

    # ---- STAGES B-D, CONCURRENTLY (user ruling 2026-08-11: melt and reap as saves arrive rather than
    #      letting tens of gigabytes stand until a run ends). Safe now that the archiver renames into
    #      place atomically, so a `.v3` in that folder is complete by construction.
    #      Cost to the game: one worker melting a 40 MB save takes ~5 s of ONE core per ~60 s of wall
    #      clock at yearly cadence, on a 20-core machine against a mostly single-threaded engine. That is
    #      believed negligible and is NOT yet measured — `-HarvestWorkers 0` runs the old between-runs
    #      shape if a batch ever needs the machine perfectly quiet.
    $harv = $null
    if (-not $NoSaveHarvest -and $arch -and $HarvestWorkers -gt 0) {
        $prov = Join-Path $runDir "save_provenance.json"
        [System.IO.File]::WriteAllText($prov, ([ordered]@{
            session = $stamp; label = $label; run_index = $p.index; setup = $p.setup
            arm_kind = $resolved.Kind; built_from_config = $resolved.Config
            token = $token; until = $p.until
        } | ConvertTo-Json -Depth 4), $Utf8)
        $stopH = Join-Path $PSScriptRoot "STOP_HARVEST"
        if (Test-Path $stopH) { Remove-Item $stopH -Force }
        $harvLog = Join-Path $runDir "harvester_launch.log"
        # ⚠⚠ THE CONCATENATION MUST BE PARENTHESISED. Written as `-ArgumentList @(...) + $(...)`, the
        # binder takes the array literal as -ArgumentList and then sees ` + ` as the NEXT POSITIONAL
        # ARGUMENT to Start-Process, which fails with
        #   "A positional parameter cannot be found that accepts argument '+'"
        # attributed to run_schedule.ps1 itself, several frames from where the mistake is. It aborts the
        # batch AFTER the mod is built and the archiver is running, so the session folder looks like a
        # started run that simply never launched the game. Keep the outer parentheses.
        $harvArgs = @(
            "-ExecutionPolicy","Bypass","-File","`"$(Join-Path $PSScriptRoot 'harvest_saves.ps1')`"",
            "-Saves","`"$saveDir`"","-Out","`"$sumDir`"","-Workers","$HarvestWorkers",
            "-Provenance","`"$prov`"","-Watch")
        if ($KeepSaves) { $harvArgs += "-NoReap" }
        $harv = Start-Process powershell -PassThru -WindowStyle Hidden -RedirectStandardError $harvLog -ArgumentList $harvArgs
        $null = $harv.Handle
        Start-Sleep -Seconds 3
        if ($harv.HasExited) {
            $why = (Get-Content $harvLog -Tail 3 -ErrorAction SilentlyContinue) -join ' / '
            Log "HARVESTER DIED AT LAUNCH (exit $($harv.ExitCode)): $why - falling back to a drain after the run" "ALERT"
            $harv = $null
        } else {
            Log "save harvester alive (pid $($harv.Id), $HarvestWorkers workers, watching)"
        }
    }

    & powershell @obsArgs
    $rc = $LASTEXITCODE

    if ($arch) {
        # signal it rather than killing it: a kill mid-copy leaves a truncated .v3 in the archive, which
        # is the one failure the stability check exists to prevent
        New-Item -ItemType File -Force -Path (Join-Path $PSScriptRoot "STOP_ARCHIVE") | Out-Null
        if (-not $arch.WaitForExit(60000)) { Log "archiver did not stop within 60s - killing" "WARN"; $arch.Kill() }
        Remove-Item (Join-Path $PSScriptRoot "STOP_ARCHIVE") -Force -ErrorAction SilentlyContinue
        $nSaves = @(Get-ChildItem $saveDir -Filter "*.v3" -ErrorAction SilentlyContinue).Count
        Log "archiver stopped - $nSaves save(s) still on disk (the harvester has been draining them)"

        # ---- stop the watcher, then ALWAYS run a final synchronous drain. The watcher handles the bulk
        #      DURING the run; this pass catches whatever arrived in its last poll, and is the whole
        #      harvest if the watcher died or was disabled. It is idempotent - the queue is "saves with
        #      no summary yet" - so running it after a successful watch costs seconds.
        if ($harv) {
            New-Item -ItemType File -Force -Path (Join-Path $PSScriptRoot "STOP_HARVEST") | Out-Null
            if (-not $harv.WaitForExit(180000)) { Log "harvester did not stop within 180s - killing" "WARN"; $harv.Kill() }
            Remove-Item (Join-Path $PSScriptRoot "STOP_HARVEST") -Force -ErrorAction SilentlyContinue
        }
        # PROVENANCE travels with each summary: a summary outlives its save, so it has to say which arm,
        # which run and which session it came from without a lookup. Written by the watcher launch when
        # there is one; written here when there is not.
        $prov = Join-Path $runDir "save_provenance.json"
        if (-not (Test-Path $prov)) {
            [System.IO.File]::WriteAllText($prov, ([ordered]@{
                session = $stamp; label = $label; run_index = $p.index; setup = $p.setup
                arm_kind = $resolved.Kind; built_from_config = $resolved.Config
                token = $token; until = $p.until
            } | ConvertTo-Json -Depth 4), $Utf8)
        }
        # ⚠ NOT pre-quoted, unlike the Start-Process calls above, and the difference is real: `& powershell
        # @args` quotes each element itself when it contains a space, so adding quotes here would nest
        # them. Start-Process -ArgumentList joins raw and quotes nothing, so there they are mandatory.
        # Same two shapes, two opposite rules - this one matches $obsArgs, which works.
        $hArgs = @("-ExecutionPolicy","Bypass","-File",(Join-Path $PSScriptRoot "harvest_saves.ps1"),
                   "-Saves",$saveDir,"-Out",$sumDir,"-Workers","$([Math]::Max(1,$HarvestWorkers))",
                   "-Provenance",$prov)
        if ($KeepSaves) { $hArgs += "-NoReap" }
        $t1 = Get-Date
        & powershell @hArgs
        $hrc = $LASTEXITCODE
        $nSum = @(Get-ChildItem $sumDir -Filter "*.json.gz" -ErrorAction SilentlyContinue).Count
        $left = @(Get-ChildItem $saveDir -Filter "*.v3" -ErrorAction SilentlyContinue).Count
        Log ("save harvest: {0} summaries, {1} save(s) kept, final drain {2:N0}s{3}" -f $nSum, $left,
             ((Get-Date)-$t1).TotalSeconds,
             $(if ($hrc -ne 0) { " - ⚠ SOME FAILED, those .v3 files are kept" } else { "" }))
    }

    $status = switch ($rc) { 0 { "ok" } 2 { "stopped_by_user" } 3 { "fatal_early_crashes" } default { "failed($rc)" } }
    # ⚠⚠ THE EXIT CODE IS NOT THE WHOLE STORY — landmine L17. run_observer exits 0 when it ABANDONS a
    # run, so an abandoned run used to read exactly like a completed one. That is how a batch reports
    # "8/8 ok" while two of its runs covered 15 and 9 years of a century, and it is the generating cause
    # of four retrospective n-corrections already in SESSION_VERDICTS.md. The run's own meta.json has
    # always known better; nothing read it. Now it does.
    $metaPath = Join-Path $runDir "meta.json"
    if ($status -eq "ok" -and (Test-Path $metaPath)) {
        try {
            $meta = Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $short = ($meta.reached_ingame_date -and (ConvertTo-DateNum $meta.reached_ingame_date) -lt (ConvertTo-DateNum $p.until))
            if ((-not $meta.self_quit) -or $meta.abandoned_reason -or $short) {
                $status = "partial($($meta.reached_ingame_date))"
                Log "run $($p.index) did NOT reach $($p.until): stopped at $($meta.reached_ingame_date)$(if ($meta.abandoned_reason) { " - $($meta.abandoned_reason)" }) - recording '$status', NOT 'ok'" "WARN"
            }
        } catch { Log "run $($p.index): meta.json unreadable ($($_.Exception.Message)) - status left as '$status'" "WARN" }
    }
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
$doneNote = if ($abort) { " [ABORTED - see the ALERT lines above]" } else { "" }
Log "SCHEDULE DONE: $($index.Count)/$($plan.Count) run(s) -> $sessionDir$doneNote"
# SCHEDULE DONE is still printed on an aborted schedule: it is what wait_for_session.ps1 wakes on, and
# a batch that died at the first build must wake the agent in seconds rather than look like a live run.
# The distinction lives in the EXIT CODE and in session.json's per-run status.
if ($fatalExit -ne 0) { Log "schedule ended FATAL (exit $fatalExit)" "ALERT"; exit $fatalExit }
