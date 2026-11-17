<#
  lib_same_book.ps1 - THE SAME-BOOK GATE (landmine L53; BALANCE_FRAMEWORK 10.118; user-ruled 2026-11-17).

  THE RULE, in the user's words: "Everything other than syntax-measuring or performance probes (where, for example,
  deliberate worsening is permissible to understand the impact) must be measured on the exact same books as the full
  runs." and "Ensure that this is so by machinery, that there's no separate 'shorter run book' at all, so no room for
  mistakes." A book = config/mod_config.<name>.json + its tree twin config/tech_tree_options.<name>.json, built into a
  mod by the emitters. The mistake this file makes impossible: a short run (1836 to 1855, say) measured on one book,
  and the century then played on another.

  WHAT IS HERE. Functions only: dot-sourcing this file runs nothing, launches nothing and writes nothing, so the three
  callers can share one implementation -
    run_schedule.ps1   the gate at plan time (before preflight, the estimate and any build; also under -WhatIf),
                       the continuation's inheritance check (plan time, again before its build, and after its build);
    run_observer.ps1   the content-layout fingerprint and the build-path dirtiness build_state.json records;
    preflight.ps1      Test-LmL53, which runs the gate on the fixture schedules of tools\testbed\fixtures\same_book\.
  It must stay StrictMode-safe (run_schedule and run_observer run under Set-StrictMode 2.0) and ASCII-only (these
  scripts carry no BOM, and Windows PowerShell 5.1 reads a BOM-less file as ANSI).

  THE THREE LEGAL FORMS of a run on a {kind: config} arm:
    full span     `until` at or after the schedule's `full_until` (default 1936.1.1);
    probe         "probe": "syntax" | "performance" on the run or in `defaults`: any book, any span, never economy data
                  (ledger/lib_runs.mjs drops it from every usable-run list);
    checkpoint    "checkpoint": true on the run: the first leg of a full-span run on THIS book. It stops early, its last
                  save is kept, and a later run continues it to full_until (continue_save + parent). That continuation is
                  verified to build the parent's book: Assert-SameBookContinuation and Test-SameBookLayout.
#>

function Get-SameBookDefaultFullUntil { return '1936.1.1' }
function Get-SameBookProbeKinds       { return @('syntax', 'performance') }

# A property of a parsed-JSON object, or the default when the object or the property is absent or null. StrictMode-safe.
# NOTE an empty JSON array comes back as nothing at all (PowerShell unrolls it): never test "present" on an array field.
function SbProp {
    param($Obj, [string]$Name, $Default = $null)
    if ($null -eq $Obj -or -not $Name) { return $Default }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p -or $null -eq $p.Value) { return $Default }
    return $p.Value
}

# "1886.1.1" -> 18860101; 0 when unparseable, so a bad date can never read as "reached the full span".
function SbDateNum {
    param([string]$D)
    if (-not $D) { return 0 }
    $p = "$D".Split('.')
    if ($p.Count -lt 3) { return 0 }
    try { return ([int]$p[0]) * 10000 + ([int]$p[1]) * 100 + ([int]$p[2]) } catch { return 0 }
}

function Get-SameBookRuleText {
    $s = [string][char]0xA7
    return ("THE SAME-BOOK RULE (BALANCE_FRAMEWORK ${s}10.118, landmine L53): everything other than a syntax or performance probe is " +
            "measured on the exact same book as the full runs - there is no separate 'shorter run book'. A run on a {kind: config} " +
            "arm that stops before the full span must be one of three legal forms: " +
            "(1) FULL SPAN: 'until' at or after the schedule's full_until; " +
            "(2) a PROBE: `"probe`": `"syntax`" or `"probe`": `"performance`" on the run or in defaults - any book, and readers never count it as economy data; " +
            "(3) a CHECKPOINT LEG: `"checkpoint`": true on the run - the first leg of a full-span run on this book, whose last save is kept " +
            "and which a later run continues to full_until with continue_save + parent (verified to build the same book).")
}

<#
  THE GATE. Pure: reads the parsed schedule, touches no file, no process. Returns one record per run, in schedule order:
    index, setup, setup_kind, until, full_until, run_kind, probe, checkpoint, continuation
  run_kind is one of  full | checkpoint | probe:syntax | probe:performance | continuation | short
  ('short' = a run that stops before full_until on an arm that builds no book of ours: control, overlay, external,
  release. The gate does not judge those; the record still says the run was not a full span).
  THROWS on the first run that breaks the rule, naming the run.
    -NoSaveHarvest   the scheduler's switch: no archiver, so no save is kept in the session - a checkpoint leg throws.
    -DefaultAutosave the autosave interval a run gets when neither it nor `defaults` names one (the scheduler's default).
#>
function Get-SameBookPlan {
    param(
        [Parameter(Mandatory = $true)] $Sched,
        [switch] $NoSaveHarvest,
        [string] $DefaultAutosave = 'five_year'
    )
    $rule     = Get-SameBookRuleText
    $defaults = SbProp $Sched 'defaults'
    $setups   = SbProp $Sched 'setups'
    $runs     = @(SbProp $Sched 'runs' @())
    $fullUntil = [string](SbProp $Sched 'full_until' (Get-SameBookDefaultFullUntil))
    if ($fullUntil -notmatch '^\d{3,4}\.\d{1,2}\.\d{1,2}$') { throw "schedule key 'full_until' is not a date: '$fullUntil' (default $(Get-SameBookDefaultFullUntil))" }
    $fullNum  = SbDateNum $fullUntil
    $kinds    = @(Get-SameBookProbeKinds)
    $defProbe = SbProp $defaults 'probe'
    if ($null -ne (SbProp $defaults 'checkpoint')) { throw "schedule 'defaults' carries 'checkpoint': it is a RUN-level key - each checkpoint leg names itself. $rule" }
    $defAuto  = [string](SbProp $defaults 'autosave_interval' $DefaultAutosave)

    $out = @(); $i = 0
    foreach ($r in $runs) {
        $i++
        $sid   = [string](SbProp $r 'setup' '')
        $kind  = [string](SbProp (SbProp $setups $sid) 'kind' 'config')
        $until = [string](SbProp $r 'until' '')
        $where = "run #$i (setup '$sid', kind $kind, until $until)"
        $short = (SbDateNum $until) -lt $fullNum

        $probeRaw = SbProp $r 'probe' $defProbe
        $probe = ''
        if ($null -ne $probeRaw) {
            if (($probeRaw -isnot [string]) -or ($kinds -notcontains $probeRaw)) {
                throw "${where}: `"probe`": $(ConvertTo-Json $probeRaw -Compress) is not a probe kind - the only values are `"$($kinds -join '`" and `"')`". $rule"
            }
            $probe = [string]$probeRaw
        }
        $cpRaw = SbProp $r 'checkpoint'
        if ($null -ne $cpRaw -and $cpRaw -isnot [bool]) { throw "${where}: `"checkpoint`" must be true or false, not $(ConvertTo-Json $cpRaw -Compress). $rule" }
        $checkpoint   = ($cpRaw -eq $true)
        $continuation = [bool]([string](SbProp $r 'continue_save' ''))
        $parent       = [string](SbProp $r 'parent' '')

        if ($probe -and $checkpoint)   { throw "${where}: both `"probe`" and `"checkpoint`" - a probe is never economy data and is never continued into a full run; a checkpoint leg IS the start of one. Choose one. $rule" }
        if ($probe -and $continuation) { throw "${where}: a continuation (continue_save) must not carry `"probe`" - it plays on a measured run's world, on that run's book. $rule" }
        if ($continuation -and -not $parent) { throw "${where}: a continuation (continue_save) REQUIRES `"parent`" (<session>/<runNNN_setup> under tools\testbed\sessions, or an absolute run folder) - the run whose save it loads, so its book can be verified against the parent's build_state.json. $rule" }
        if ($checkpoint -and -not $short) { throw "${where}: `"checkpoint`": true on a run that reaches full_until ($fullUntil) - that is a full run; remove the flag. $rule" }
        if ($checkpoint) {
            # A checkpoint leg exists to be continued, so its last save must survive it. The harvest keeps each run's newest
            # save (harvest_saves.ps1 -KeepLast, its default; the scheduler never turns it off) - unless nothing is archived.
            if ($NoSaveHarvest) { throw "${where}: a checkpoint leg under -NoSaveHarvest - no save would be archived into the session, so there would be nothing to continue. Drop -NoSaveHarvest." }
            $auto = [string](SbProp $r 'autosave_interval' $defAuto)
            if ($auto -eq 'never') { throw "${where}: a checkpoint leg with autosave_interval 'never' - the game would write no save to continue from." }
        }
        if ($kind -eq 'config' -and $short -and -not $probe -and -not $checkpoint) {
            $what = if ($continuation) { "a continuation that stops at $until, before full_until ($fullUntil), is a middle leg and must say `"checkpoint`": true" }
                    else { "it stops at $until, before full_until ($fullUntil), and is neither a probe nor a checkpoint leg" }
            throw "${where}: a SHORT RUN ON A BOOK - $what. $rule"
        }

        $runKind = if ($probe) { "probe:$probe" } elseif ($continuation) { 'continuation' } elseif ($checkpoint) { 'checkpoint' } elseif (-not $short) { 'full' } else { 'short' }
        $out += [ordered]@{ index = $i; setup = $sid; setup_kind = $kind; until = $until; full_until = $fullUntil
                            run_kind = $runKind; probe = $probe; checkpoint = $checkpoint; continuation = $continuation }
    }
    return $out
}

# ---------------------------------------------------------------- the book's files ----

# The tree twin of a config, by the emitters' own rule (emit_techs.mjs, emit_research_events.mjs; preflight's Get-TreeSuffix):
# config\tech_tree_options<.sfx>.json under the REPO's config folder, the suffix taken from the config's file name.
function Get-SameBookTreeTwinPath {
    param([string]$ConfigPath, [string]$Repo)
    if (-not $ConfigPath) { return '' }
    $bn = Split-Path $ConfigPath -Leaf
    $sfx = if ($bn -match '^mod_config\.(.+)\.json$') { '.' + $Matches[1] } else { '' }
    return (Join-Path (Join-Path $Repo 'config') ("tech_tree_options$sfx.json"))
}

# sha256 of a file, lower-case hex, in full ('' when the file is absent). build_state.json records the first 16 digits.
function Get-SameBookFileSha {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return '' }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLower()
}

# The installed game's version, read where run_observer.ps1 reads it for build_state.json (launcher-settings.json rawVersion).
function Get-SameBookGameVersion {
    param([string]$Game)
    if (-not $Game) { $Game = if ($env:VIC3_GAME) { $env:VIC3_GAME } else { 'C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game' } }
    $ls = Join-Path (Split-Path -Parent $Game) 'launcher\launcher-settings.json'
    if (-not (Test-Path -LiteralPath $ls)) { return '' }
    try { return [string](Get-Content -LiteralPath $ls -Raw -Encoding UTF8 | ConvertFrom-Json).rawVersion } catch { return '' }
}

# ---------------------------------------------------------------- what builds the mod ----

<#
  THE PATHS A BUILD READS besides the book itself, as git pathspecs relative to the repo root. Conservative on purpose:
    tools/build.ps1, telemetry_lib.ps1 (dot-sourced), convert_history.ps1 + history_lib.ps1 (the 1836 start),
    every emitter tools/emit_*.mjs and every tools/lib_*.mjs they import, basic_secondaries.mjs (the names' break-even),
    strip_release_logging.mjs (release builds), tools/goods_prices.tsv (THE price table),
    art/ (thumbnails and icons), mod/.metadata/ (the one hand-maintained mod file), ui/vanilla.js and ui/econ.js (read by
    emitters and libraries), and every file under config/ that is not itself a book (start rules, the start baseline,
    measured reference data, the dam tables). Books (mod_config*.json, tech_tree_options*.json) are left out here:
    the book a run builds is compared by sha256, not by commit.
  A new input of the build belongs in this list (ON_GAME_UPDATE-style coupling: REPO_GUIDE names it under lib_same_book.ps1).
#>
function Get-SameBookBuildPaths {
    return @(
        'tools/build.ps1', 'tools/telemetry_lib.ps1', 'tools/convert_history.ps1', 'tools/history_lib.ps1',
        'tools/basic_secondaries.mjs', 'tools/strip_release_logging.mjs', 'tools/goods_prices.tsv',
        ':(glob)tools/emit_*.mjs', ':(glob)tools/lib_*.mjs',
        'art', 'mod/.metadata', 'ui/vanilla.js', 'ui/econ.js',
        'config', ':(exclude,glob)config/mod_config*.json', ':(exclude,glob)config/tech_tree_options*.json'
    )
}

# git through cmd, never `& git ... 2>&1`: under the Stop preference Windows PowerShell 5.1 turns a native stderr line into
# a terminating ErrorRecord (the trap TESTBED_LANDMINES records for node). Returns @{ Code; Lines }.
function Invoke-SbGit {
    param([string]$Repo, [string[]]$GitArgs)
    $line = ($GitArgs | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
    $out = & cmd /c "git -C `"$Repo`" $line 2>&1"
    $code = $LASTEXITCODE
    $global:LASTEXITCODE = 0
    return @{ Code = $code; Lines = @($out | ForEach-Object { "$_" } | Where-Object { $_.Trim() }) }
}

<#
  mod/.metadata/metadata.json IS REWRITTEN BY EVERY BUILD: build.ps1 strips any "(built ...)" from its `name` and stamps a
  fresh one (none on a release build), in the canonical mod\ for a default build and in the copy for -SaveTo. So the tracked
  file differs between two commits, or from HEAD, whenever someone built in between - and that difference never reaches a
  built mod, which is re-stamped anyway. $true when the working tree's file equals <Rev>'s once the stamp is stripped from
  both, by the builder's own pattern. Anything else in the file (the version, the id, replace_paths) still counts.
#>
function Test-SbMetadataStampOnly {
    param([string]$Repo, [string]$Rev)
    $wt = Join-Path $Repo 'mod\.metadata\metadata.json'
    if (-not $Rev -or -not (Test-Path -LiteralPath $wt)) { return $false }
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("pmr_sb_meta_{0}_{1}.json" -f $PID, [guid]::NewGuid().ToString('N').Substring(0, 8))
    try {
        # to a file, not through the pipeline: the bytes must arrive as git wrote them (UTF-8), not through the console code page
        $null = & cmd /c "git -C `"$Repo`" show `"${Rev}:mod/.metadata/metadata.json`" > `"$tmp`" 2>nul"
        $code = $LASTEXITCODE; $global:LASTEXITCODE = 0
        if ($code -ne 0 -or -not (Test-Path -LiteralPath $tmp)) { return $false }
        $norm = { param($t) ([regex]::Replace(([string]$t -replace "`r`n", "`n"), '("name"\s*:\s*"[^"]*?)\s*\(built[^)]*\)(")', '${1}${2}')).Trim() }
        $a = & $norm ([System.IO.File]::ReadAllText($tmp, [System.Text.Encoding]::UTF8))
        $b = & $norm ([System.IO.File]::ReadAllText($wt, [System.Text.Encoding]::UTF8))
        return ($a -and ($a -ceq $b))
    } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
}

# Uncommitted or untracked files among the build paths. Returns @{ Ok; Paths; Error }.
# -ExtraPaths (a book file to check by commit, see Assert-SameBookContinuation) are asked in a query of their own: the
# build paths EXCLUDE the books, and in a git pathspec an exclusion wins over any inclusion beside it.
# -StampRev: the revision mod/.metadata/metadata.json is compared with before it counts (HEAD: is the file dirty beyond its
# build stamp?). Get-SameBookBuildDrift passes the parent's commit.
function Get-SameBookDirtyBuildPaths {
    param([string]$Repo, [string[]]$ExtraPaths = @(), [string]$StampRev = 'HEAD')
    $paths = @()
    foreach ($spec in @(, @(Get-SameBookBuildPaths)) + @(, @($ExtraPaths | Where-Object { $_ }))) {
        if (-not @($spec).Count) { continue }
        $r = Invoke-SbGit -Repo $Repo -GitArgs (@('status', '--porcelain', '--') + @($spec))
        if ($r.Code -ne 0) { return @{ Ok = $false; Paths = @(); Error = "git status failed (exit $($r.Code)): $($r.Lines -join ' / ')" } }
        $paths += @($r.Lines | ForEach-Object { $_.Trim() })
    }
    if (@($paths | Where-Object { $_ -like '*mod/.metadata/metadata.json' }).Count -and (Test-SbMetadataStampOnly -Repo $Repo -Rev $StampRev)) {
        $paths = @($paths | Where-Object { $_ -notlike '*mod/.metadata/metadata.json' })
    }
    return @{ Ok = $true; Paths = $paths; Error = '' }
}

# What changed among the build paths between a recorded commit and HEAD, and what is uncommitted there now.
# Returns @{ Ok; Committed; Dirty; Error }. Ok is $false only when git could not answer (an unknown commit, no git).
function Get-SameBookBuildDrift {
    param([string]$Repo, [string]$Commit, [string[]]$ExtraPaths = @())
    if (-not $Commit) { return @{ Ok = $false; Committed = @(); Dirty = @(); Error = 'the parent recorded no repo commit' } }
    $e = Invoke-SbGit -Repo $Repo -GitArgs @('cat-file', '-e', "$Commit^{commit}")
    if ($e.Code -ne 0) { return @{ Ok = $false; Committed = @(); Dirty = @(); Error = "commit $Commit is not in this repository ($Repo): $($e.Lines -join ' / ')" } }
    $committed = @()
    foreach ($spec in @(, @(Get-SameBookBuildPaths)) + @(, @($ExtraPaths | Where-Object { $_ }))) {
        if (-not @($spec).Count) { continue }
        $d = Invoke-SbGit -Repo $Repo -GitArgs (@('diff', '--name-only', $Commit, 'HEAD', '--') + @($spec))
        if ($d.Code -ne 0) { return @{ Ok = $false; Committed = @(); Dirty = @(); Error = "git diff failed (exit $($d.Code)): $($d.Lines -join ' / ')" } }
        $committed += @($d.Lines)
    }
    # the one file every build rewrites: it counts only when it differs from the parent's commit beyond its build stamp
    $stampOnly = $false
    if (@($committed | Where-Object { $_ -eq 'mod/.metadata/metadata.json' }).Count -and (Test-SbMetadataStampOnly -Repo $Repo -Rev $Commit)) {
        $committed = @($committed | Where-Object { $_ -ne 'mod/.metadata/metadata.json' }); $stampOnly = $true
    }
    $s = Get-SameBookDirtyBuildPaths -Repo $Repo -ExtraPaths $ExtraPaths -StampRev $Commit
    if (-not $s.Ok) { return @{ Ok = $false; Committed = @(); Dirty = @(); Error = $s.Error; StampOnly = $false } }
    return @{ Ok = $true; Committed = $committed; Dirty = @($s.Paths); Error = ''; StampOnly = $stampOnly }
}

# ---------------------------------------------------------------- the built mod ----

<#
  The layout fingerprint of a mod folder: sha256 over every file's relative path and size, first 16 hex digits - the
  algorithm of run_observer.ps1's Get-DirFingerprint and run_schedule.ps1's Get-ModLayoutSha (keep the three alike).
  -ContentOnly leaves out the instrument, the files named zzz_v3tb_* (the telemetry script and its values): their size
  follows the run's telemetry spec (dump dates, the red-flag feed's yearly dates up to `until`, tags, metrics), so a
  checkpoint leg to 1855 and its continuation to 1936 differ there by design, while every file of the BOOK must not.
#>
function Get-SameBookLayoutSha {
    param([string]$Dir, [switch]$ContentOnly)
    if (-not $Dir -or -not (Test-Path -LiteralPath $Dir)) { return '' }
    $Dir = $Dir.TrimEnd('\', '/')
    $sb = New-Object System.Text.StringBuilder
    foreach ($f in (@(Get-ChildItem -LiteralPath $Dir -Recurse -File) | Sort-Object FullName)) {
        if ($ContentOnly -and $f.Name -like 'zzz_v3tb_*') { continue }
        $null = $sb.Append($f.FullName.Substring($Dir.Length)).Append(':').Append($f.Length).Append(';')
    }
    $sha  = [System.Security.Cryptography.SHA256]::Create()
    $hash = ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($sb.ToString())) | ForEach-Object { $_.ToString("x2") }) -join ""
    $sha.Dispose()
    return $hash.Substring(0, 16)
}

# ---------------------------------------------------------------- a continuation inherits its book ----

<#
  The comparisons that need no file and no git: a parent's parsed build_state.json against what this run would build.
  Returns @{ Problems = @(strings); Notes = @(strings) }; an empty Problems means these checks pass.
    arm           the parent's arm must be the arm this setup builds (config / control / overlay+... / external+...);
    book          this run's config sha256 must be the parent's recorded config_sha256 (16 hex digits recorded);
    tree twin     equal when the parent recorded tree_sha256 (runs from 2026-11-17 on); a note when it did not;
    game version  equal, and known on both sides;
    parent build  a parent built from a dirty tree is refused: build_paths_dirty when recorded (the build's own inputs),
                  else the older whole-repo `dirty`.
#>
function Test-SameBookContinuation {
    param(
        $ParentState,
        [string]$SetupKind,
        [string]$ConfigPath = '', [string]$ConfigSha = '',
        [string]$TreePath = '',   [string]$TreeSha = '',
        [string]$GameVersion = ''
    )
    $problems = @(); $notes = @()
    $det = SbProp $ParentState 'deterministic'
    if ($null -eq $det) { return @{ Problems = @("PARENT RECORD: its build_state.json has no 'deterministic' block - what it ran is not on record"); Notes = @() } }
    $pArm = [string](SbProp $det 'arm' '')
    $mut  = SbProp $det 'mod_under_test'

    $armOk = switch ($SetupKind) {
        'config'   { $pArm -eq 'config' }
        'release'  { $pArm -eq 'config' }
        'control'  { $pArm -eq 'control' }
        'overlay'  { $pArm -like 'overlay+*' }
        'external' { $pArm -like 'external+*' }
        default    { $false }
    }
    if (-not $armOk) { $problems += "ARM: this run's setup is kind '$SetupKind', the parent ran arm '$pArm' - a continuation plays on in the parent's arm" }

    if (@('config', 'release', 'overlay') -contains $SetupKind) {
        $pSha = [string](SbProp $mut 'config_sha256' '')
        $pCfg = [string](SbProp $mut 'built_from_config' '')
        if (-not $pSha) { $problems += "BOOK: the parent recorded no config_sha256 (built_from_config: '$pCfg') - its book cannot be verified" }
        elseif (-not $ConfigSha) { $problems += "BOOK: this run's config could not be hashed ($ConfigPath)" }
        elseif (-not $ConfigSha.StartsWith($pSha.ToLower())) {
            $problems += "BOOK: this run builds $ConfigPath (sha256 $($ConfigSha.Substring(0, [math]::Min(16, $ConfigSha.Length)))), the parent ran $pCfg (sha256 $pSha) - a different book"
        } else { $notes += "book: sha256 $pSha = the parent's ($(Split-Path $ConfigPath -Leaf))" }

        $pTree = [string](SbProp $mut 'tree_sha256' '')
        if ($pTree) {
            if (-not $TreeSha) { $problems += "TREE TWIN: this run's tree twin could not be hashed ($TreePath)" }
            elseif (-not $TreeSha.StartsWith($pTree.ToLower())) {
                $problems += "TREE TWIN: this run builds $TreePath (sha256 $($TreeSha.Substring(0, [math]::Min(16, $TreeSha.Length)))), the parent ran $([string](SbProp $mut 'built_from_tree' '')) (sha256 $pTree) - a different technology tree"
            } else { $notes += "tree twin: sha256 $pTree = the parent's" }
        } else {
            $notes += "tree twin: the parent recorded no tree_sha256 (a run from before 2026-11-17) - checked by commit where git tracks the twin, and by the built mod's layout after the build"
        }
    }

    $pGame = [string](SbProp (SbProp $det 'game') 'version' '')
    if (-not $pGame -or -not $GameVersion) { $problems += "GAME VERSION: not known on both sides (installed: '$GameVersion', the parent's: '$pGame') - the vanilla files the build reads cannot be verified" }
    elseif ($pGame -ne $GameVersion) { $problems += "GAME VERSION: the installed game is $GameVersion, the parent ran on $pGame - the build reads vanilla's files, so the same config builds a different mod" }
    else { $notes += "game version: $GameVersion = the parent's" }

    $repo = SbProp $det 'repo'
    $bpd  = SbProp $repo 'build_paths_dirty'
    if ($null -ne $bpd) {
        if ($bpd -eq $true) { $problems += "PARENT BUILD: the parent was built with uncommitted changes among the build's own inputs (build_paths_dirty: true, commit $([string](SbProp $repo 'commit' '?'))) - what built it cannot be reproduced" }
        else { $notes += "parent build: its build inputs were clean at commit $([string](SbProp $repo 'commit' '?'))" }
    } else {
        $dirty = SbProp $repo 'dirty'
        if ($null -eq $dirty) { $problems += "PARENT BUILD: the parent's build_state.json does not say whether its working tree was clean - what built it cannot be verified" }
        elseif ($dirty -eq $true) { $problems += "PARENT BUILD: the parent was built from a dirty working tree (dirty: true, commit $([string](SbProp $repo 'commit' '?'))) - what built it cannot be reproduced" }
        else { $notes += "parent build: a clean tree at commit $([string](SbProp $repo 'commit' '?'))" }
    }
    return @{ Problems = $problems; Notes = $notes }
}

# Resolve a run's `parent` to a folder: an absolute path as given, else <SessionsRoot>\<session>\<runNNN_setup>.
function Resolve-SameBookParent {
    param([string]$Parent, [string]$SessionsRoot)
    if (-not $Parent) { return '' }
    $p = $Parent -replace '/', '\'
    if ([System.IO.Path]::IsPathRooted($p)) { return $p.TrimEnd('\') }
    return (Join-Path $SessionsRoot $p).TrimEnd('\')
}

<#
  THE CONTINUATION CHECK, everything that can be known before the build. Reads the parent's build_state.json, hashes
  this run's config and tree twin, reads the installed game's version and asks git what changed among the build paths
  since the parent's commit. Prints one line per check that passed (unless -Quiet) and THROWS one message listing every
  check that failed. Returns what the post-build check needs:
    @{ ParentDir; ParentState; ConfigSha; TreePath; TreeSha; GameVersion }
#>
function Assert-SameBookContinuation {
    param(
        [int]$Index, [string]$SetupId, [string]$SetupKind,
        [string]$ConfigPath = '', [string]$Parent, [string]$Repo, [string]$SessionsRoot,
        [string]$Game = '', [switch]$Quiet
    )
    $s = [string][char]0xA7
    $head = "run #$Index (setup '$SetupId'): a continuation must build what its parent ran (the same-book rule, BALANCE_FRAMEWORK ${s}10.118, landmine L53)"
    $parentDir = Resolve-SameBookParent -Parent $Parent -SessionsRoot $SessionsRoot
    if (-not $parentDir) { throw "$head - it names no 'parent'." }
    if (-not (Test-Path -LiteralPath $parentDir)) { throw "$head - parent not found: $parentDir ('parent' is <session>/<runNNN_setup> under $SessionsRoot, or an absolute run folder)." }
    $bs = Join-Path $parentDir 'build_state.json'
    if (-not (Test-Path -LiteralPath $bs)) { throw "$head - the parent has no build_state.json: $bs. What it ran is not on record, so its book cannot be verified." }
    $state = Get-Content -LiteralPath $bs -Raw -Encoding UTF8 | ConvertFrom-Json

    $hasBook  = @('config', 'release', 'overlay') -contains $SetupKind
    $cfgSha   = if ($hasBook) { Get-SameBookFileSha $ConfigPath } else { '' }
    $treePath = if ($hasBook -and $SetupKind -ne 'overlay') { Get-SameBookTreeTwinPath -ConfigPath $ConfigPath -Repo $Repo } else { '' }
    $treeSha  = Get-SameBookFileSha $treePath
    $gameVer  = Get-SameBookGameVersion -Game $Game

    $t = Test-SameBookContinuation -ParentState $state -SetupKind $SetupKind -ConfigPath $ConfigPath -ConfigSha $cfgSha `
                                   -TreePath $treePath -TreeSha $treeSha -GameVersion $gameVer
    $problems = @($t.Problems); $notes = @($t.Notes)

    # the emitters read MOD_CONFIG before their argument when they name the tree twin: a redirected build is not this book
    if ($hasBook -and $env:MOD_CONFIG) { $problems += "MOD_CONFIG: the environment variable MOD_CONFIG is set ($($env:MOD_CONFIG)) - the emitters take the tree twin's name from it before the config they are handed, so the build would not be the book named here. Clear it." }

    # what builds the mod: nothing among the build paths may differ from the parent's commit, committed or not. A parent that
    # recorded no tree twin sha256 has its twin checked here too, as far as git tracks it.
    $det    = SbProp $state 'deterministic'
    $commit = [string](SbProp (SbProp $det 'repo') 'commit' '')
    $extra  = @()
    if ($treePath -and -not [string](SbProp (SbProp $det 'mod_under_test') 'tree_sha256' '')) { $extra = @('config/' + (Split-Path $treePath -Leaf)) }
    $drift = Get-SameBookBuildDrift -Repo $Repo -Commit $commit -ExtraPaths $extra
    if (-not $drift.Ok) {
        $problems += "BUILD PATHS: cannot be verified - $($drift.Error)"
    } else {
        if (@($drift.Committed).Count) {
            $problems += ("BUILD PATHS: $(@($drift.Committed).Count) file(s) that build the mod changed between the parent's commit $commit and HEAD " +
                          "(git diff --name-only $commit HEAD): " + (@($drift.Committed) -join ', ') +
                          ". The same config would no longer build the parent's mod. Bring those files back to their state at $commit, or play the full span again on today's build.")
        }
        if (@($drift.Dirty).Count) {
            $problems += ("BUILD PATHS: $(@($drift.Dirty).Count) uncommitted or untracked file(s) among what builds the mod (git status --porcelain): " +
                          (@($drift.Dirty) -join ', ') + ". Commit or remove them first.")
        }
        if (-not @($drift.Committed).Count -and -not @($drift.Dirty).Count) { $notes += "build paths: nothing that builds the mod changed since the parent's commit $commit, and none of it is uncommitted$(if ($drift.StampOnly) { ' (mod/.metadata/metadata.json differs only by the build stamp in its name, which every build rewrites)' } else { '' })" }
    }

    if (-not $Quiet) { foreach ($n in $notes) { Write-Host "  same-book: run #$Index continues $parentDir - $n" } }
    if ($problems.Count) {
        throw ("$head - $($problems.Count) check(s) FAILED against $parentDir :`n  - " + ($problems -join "`n  - ") + "`nNothing was built and nothing launched for this run.")
    }
    return @{ ParentDir = $parentDir; ParentState = $state; ConfigSha = $cfgSha; TreePath = $treePath; TreeSha = $treeSha; GameVersion = $gameVer }
}

<#
  THE POST-BUILD CHECK: the mod just built against the parent's recorded fingerprint. Returns
    @{ Ok; Basis; Mine; Parent; Message }
  Basis 'content' - the parent recorded fingerprint.content_layout_sha256 (runs from 2026-11-17 on): every file but the
                    instrument is compared, so a different telemetry spec (a later `until`, other dump dates) cannot fail it;
  Basis 'whole'   - an older parent: only fingerprint.layout_sha256 exists, which INCLUDES the telemetry file, whose size
                    follows the spec. It is still an exact test when the continuation carries the parent's spec (the token
                    and the build stamp are fixed-width), so a mismatch throws - and the message says whether the two
                    telemetry.json files differ, the one benign cause. It is not weakened to a warning.
#>
function Test-SameBookLayout {
    param([string]$ModPath, $ParentState, [string]$ParentDir = '', [string]$SpecFile = '')
    $fp = SbProp (SbProp (SbProp $ParentState 'deterministic') 'mod_under_test') 'fingerprint'
    $pContent = [string](SbProp $fp 'content_layout_sha256' '')
    $pWhole   = [string](SbProp $fp 'layout_sha256' '')
    if ($pContent) {
        $mine = Get-SameBookLayoutSha -Dir $ModPath -ContentOnly
        $ok = ($mine -eq $pContent)
        $msg = if ($ok) { "the built mod's content layout $mine = the parent's" }
               else { "the built mod's content layout is $mine, the parent's was $pContent (every file but the zzz_v3tb_* instrument, by relative path and size) - the same config, tree and build paths built a DIFFERENT mod; something the build reads is outside the checked set (lib_same_book.ps1 Get-SameBookBuildPaths) or the game's files changed under one version number" }
        return @{ Ok = $ok; Basis = 'content'; Mine = $mine; Parent = $pContent; Message = $msg }
    }
    if (-not $pWhole) { return @{ Ok = $false; Basis = 'none'; Mine = ''; Parent = ''; Message = "the parent recorded no layout fingerprint - the built mod cannot be compared with what it ran" } }
    $mine = Get-SameBookLayoutSha -Dir $ModPath
    if ($mine -eq $pWhole) { return @{ Ok = $true; Basis = 'whole'; Mine = $mine; Parent = $pWhole; Message = "the built mod's layout $mine = the parent's (whole mod, telemetry included)" } }
    $specNote = "the parent's telemetry.json was not compared"
    $pSpec = if ($ParentDir) { Join-Path $ParentDir 'telemetry.json' } else { '' }
    if ($pSpec -and $SpecFile -and (Test-Path -LiteralPath $pSpec) -and (Test-Path -LiteralPath $SpecFile)) {
        $a = (Get-Content -LiteralPath $pSpec -Raw -Encoding UTF8 | ConvertFrom-Json | ConvertTo-Json -Depth 8 -Compress)
        $b = (Get-Content -LiteralPath $SpecFile -Raw -Encoding UTF8 | ConvertFrom-Json | ConvertTo-Json -Depth 8 -Compress)
        $specNote = if ($a -eq $b) { "the two telemetry specs are IDENTICAL, so the difference is in the book's own files" }
                    else { "the two telemetry specs DIFFER ($pSpec against $SpecFile), which alone changes the telemetry file's size: give this run the parent's dump_dates, tags, metrics and wide/breakdown keys (and the same feeds), then the comparison is exact" }
    }
    return @{ Ok = $false; Basis = 'whole'; Mine = $mine; Parent = $pWhole
              Message = "the built mod's layout is $mine, the parent's was $pWhole. This parent predates content_layout_sha256, so only the WHOLE mod's layout is on record, telemetry file included; $specNote" }
}
