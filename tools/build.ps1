<#
  PM & Tech Rehaul - mod builder.

  Reads config/mod_config.json and generates the whole mod:
    mod/common/buildings/{01_industry,06_urban_center,11_private_infrastructure}.txt
                                                         (WHOLE-FILE replacements of vanilla)
    mod/common/production_methods/zzz_pm_rehaul_01_industry.txt        (our tier main PMs, additive)
    mod/common/production_method_groups/zzz_pm_rehaul_01_industry.txt  (additive)
    mod/common/production_methods/<vanilla file>.txt     (whole-file replacement, but ONLY for the
                                                         files we actually change: the secondary-PM
                                                         gate remap and any pm_goods override)
    mod/common/ai_strategies/01_admin_strategies.txt     (WHOLE-FILE replacement: AI subsidy policy)
    mod/common/on_actions/zzz_pm_rehaul_diag.txt         (self-diagnostic tripwire)
    mod/common/on_actions/zzz_v3tb_telemetry.txt         (testbed telemetry, when asked for)
    mod/common/history/buildings/*.txt                   (the re-tiered 1836 start, via convert_history)
    mod/localization/<lang>/replace/zzz_pm_rehaul_l_<lang>.yml   (ALL configured languages)
    tools/ladder_tiers.txt                               (linter tier map, derived from config)

  Building logic: per tier the config carries ACTUAL volumes (output_qty + inputs, derived by
  solve_volumes.ps1). The builder emits them as-is, preserves employment/pollution, and labels each
  building with its actual FULL break-even (input goods + wages).

  WAGES ARE NEVER EMITTED. `wage_pct` is a model-only accounting term: the wage fraction of TOTAL
  cost (goods + wages), default 0.25, so total = goods/(1-0.25). It exists to compute break-even in
  our tools; V3 pays its own wages endogenously from employment and we do not touch that. (0.25 of
  total is the same number as the older "+33% over goods" spelling - reparameterized 2026-07-19, so
  a stray 0.33 in an old comment is the same value, not a different setting.) See BALANCE_FRAMEWORK §1/§8.

  Usage:   powershell -ExecutionPolicy Bypass -File tools\build.ps1 [-NoLint] [-NoDeploy] [-Config <path>] [-DryRun] [-SaveTo <name>]

  -Config lets you build from a specific config file (the same mod_config.json the UI emits)
  instead of the default config/mod_config.json - handy for building an alternate balance set
  without the UI. The path is threaded through the start extractor + history converter too, so
  the whole build (including the 1836 start) uses that config. Default: config/mod_config.json.

  Output location (default is the canonical mod/ folder, which also deploys to the Paradox mod
  folder). Two ways to build WITHOUT touching mod/:
    -DryRun         Build a full, real mod into a throwaway folder (mod_dryrun_<pid>), run the
                    post-build checks on the finished mod, report, then DELETE the folder. Never
                    deploys. Use this to verify a build/config safely - it never rewrites mod/.
    -SaveTo <name>  Build into mod_<name>/ inside the repo and KEEP it (not deployed, not deleted).
                    For alternate balance sets you want to compare/keep. Clean up manually.
  -DryRun and -SaveTo are mutually exclusive. Both leave the canonical mod/ untouched.
#>
param([switch]$NoLint, [switch]$NoDeploy, [string]$Config, [switch]$DryRun, [string]$SaveTo,
      [string]$Telemetry, [switch]$TelemetryOn, [string]$TelemetryToken, [switch]$ControlOnly,
      # -Overlay: vanilla + telemetry + a small DECLARED gameplay overlay. NOT a control - it gets its
      # own mod id so preflight's L7 can tell them apart, and it must never be reported as one.
      [switch]$Overlay,
      [switch]$NoPreflight)
$ErrorActionPreference = 'Stop'
$INV = [System.Globalization.CultureInfo]::InvariantCulture
function Fmt($v) { return ([double]$v).ToString($INV) }   # locale-safe number -> string
function RoundHalfUp($x) { return [int][math]::Floor([double]$x + 0.5) }
# §10.60 GRADED PORT FACTORISATION (user architecture, 2026-08-16): the port tiers' goods volumes and
# building_cost are EXPLICITLY divided in the config (visible + editable in the UI like any recipe), and the
# residual non-UI-editable magnitudes ride on two per-tier multiplier fields — `workforce_mult` (employment)
# and `effect_mult` (state_infrastructure / pollution / ship_construction) — 0.1 on the ÷10 tiers, 0.2 on
# the ÷5 tiers, applied here at emission. The 1836 start multiplies levels by 1/workforce_mult
# (convert_history.ps1) to preserve physical capacity. This helper renders a multiplier-scaled quantity:
# integers stay bare [int] (byte-identical emission for every unfactored tier); fractional results emit up
# to 3 decimals (fractional goods amounts are engine-proven — vanilla's own 12_subsistence.txt PMs carry
# 0.25/0.5).
function QtyMul($v, $m) {
    $q = [math]::Round([double]$v * $m, 3)
    if ($q -eq [math]::Floor($q)) { return [string][int]$q }
    return $q.ToString('0.###', $INV)
}

# clone_from_vanilla: build a tier building by copying the vanilla block and surgically swapping only
# the header key, unlocking_technologies, production_method_groups, and (optionally) required_construction.
# Everything else (port=yes, terrain_manipulator, ai_value, should_auto_expand, potential, ...) is kept
# verbatim so the special engine semantics of ports/railways/power survive. `^` matches string start, so
# the header swap hits only the first line (not e.g. building_railway references inside ai_value blocks).
function New-ClonedBuilding($vanLines, $tierKey, $baseKey, $tech, $pmgTokens, $reqCon) {
    $s = ($vanLines -join "`n")
    $s = [regex]::Replace($s, '^\s*' + [regex]::Escape($baseKey) + '\s*=\s*\{', "$tierKey = {")
    $utech = "unlocking_technologies = { $tech }"
    if ($s -match 'unlocking_technologies\s*=\s*\{[^{}]*\}') { $s = [regex]::Replace($s, 'unlocking_technologies\s*=\s*\{[^{}]*\}', $utech) }
    else { $s = [regex]::Replace($s, '^(' + [regex]::Escape($tierKey) + '\s*=\s*\{)', "`$1`n`t$utech") }
    $pmgBlock = "production_method_groups = {`n`t`t" + ($pmgTokens -join "`n`t`t") + "`n`t}"
    $s = [regex]::Replace($s, 'production_method_groups\s*=\s*\{[^{}]*\}', $pmgBlock)
    if ($null -ne $reqCon) { $s = [regex]::Replace($s, 'required_construction\s*=\s*\S+', "required_construction = $reqCon") }
    return $s
}

# Override the ai_value of a PRESERVED (verbatim-copied) building block in an owned file — e.g. trade
# center. Replaces a scalar `ai_value = N`, inserts one after the header if absent, and leaves a complex
# `ai_value = { … }` block untouched (with a note) so we never mangle conditional AI scripting.
function Set-BuildingAiValue($lines, $value) {
    $arr = @($lines)
    for ($k = 0; $k -lt $arr.Count; $k++) {
        # ⚠⚠ Write-WARNING, never Write-Output. This function RETURNS THE LINES OF A BUILDING BLOCK,
        # and in PowerShell a bare Write-Output inside a function joins that return value — so the note
        # was emitted INTO common/buildings/*.txt as a literal line. The note text itself contains
        # "<key> = {", an unbalanced brace, so the parser opened a bogus block and swallowed the real
        # building definition that followed. 96 parse errors per run, mod still loads, nothing fails.
        # Landmine L24. It only ever fired once a CLONED tier with a complex vanilla ai_value block was
        # given a config ai_value, which the ai_value ladder is the first thing to do.
        if ($arr[$k] -match '^\s*ai_value\s*=\s*\{')      { Write-Warning "$($arr[0].Trim()) has a complex ai_value block - not overriding"; return $arr }
        if ($arr[$k] -match '^\s*ai_value\s*=\s*-?\d+')   { $arr[$k] = "`tai_value = $([int]$value)"; return $arr }
    }
    $out = New-Object System.Collections.Generic.List[string]
    $out.Add($arr[0]); $out.Add("`tai_value = $([int]$value)")
    for ($k = 1; $k -lt $arr.Count; $k++) { $out.Add($arr[$k]) }
    return $out.ToArray()
}

$repo = Split-Path $PSScriptRoot -Parent
$genHeader = "# AUTO-GENERATED by tools/build.ps1 from config/mod_config.json - do not edit by hand.`n"

# --- load prices ---
$prices = @{}
foreach ($line in (Get-Content (Join-Path $repo 'tools\goods_prices.tsv'))) {
    if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }
    $c = $line -split "`t"
    if ($c.Count -ge 2) { $prices[$c[0].Trim()] = [double]$c[1].Trim() }
}

# --- load config (default, or a caller-supplied file via -Config) ---
$cfgPath = if ($Config) { (Resolve-Path -LiteralPath $Config).Path } else { Join-Path $repo 'config\mod_config.json' }
Write-Output "Config: $cfgPath"

# --- L20 GATE: does this config have its paired tech tree? Asked HERE, before a single file is
#     emitted, because emit_techs.mjs derives config/tech_tree_options<sfx>.json from the config's
#     FILENAME and dies on ENOENT half-way through the build if it is missing. On 2026-08-18 that
#     killed a batch in 3 seconds and cost 6 h 40 min of an overnight window (TESTBED_LANDMINES
#     L20 + L21). Two seconds here, naming the one-line fix, instead of a stack trace out of node.
#     WARN: it is the SAME detector the full preflight runs at the end - one definition, run twice,
#     rather than a second copy of the rule that can drift from it.
if (-not $NoPreflight) {
    & (Join-Path $PSScriptRoot 'preflight.ps1') -RepoOnly -Only L20 -Config $cfgPath -Quiet
    if ($LASTEXITCODE -ne 0) {
        $global:LASTEXITCODE = 0
        throw "PREFLIGHT FAILED (L20) - see above and TESTBED_LANDMINES.md."
    }
    $global:LASTEXITCODE = 0
}
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
# MODEL-ONLY TIERS. The config carries the mod's full five-era ladder, including tiers that have no
# unlocking technology in the game yet (`model_only: true`). Those exist for the BALANCE MODEL - the UI,
# the scenario panel and tools/era_solver.mjs - and must NEVER be emitted: a building gated on a tech that
# does not exist would be unbuildable, and its name/loc would still ship. So the emission path gets a
# FILTERED config while ui/data.js keeps the complete one (that is the whole point of the flag).
# ⚠ A second, independent parse: ConvertFrom-Json returns reference types, so filtering a shared object
# would strip the tiers out of the UI's copy too.
$cfgFull = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$modelOnlyCount = 0
foreach ($ind in $cfg.industries) {
    $keep = @($ind.tiers | Where-Object { -not $_.model_only })
    $modelOnlyCount += ($ind.tiers.Count - $keep.Count)
    $ind.tiers = $keep
}
if ($modelOnlyCount -gt 0) { Write-Output "Model-only tiers skipped (not emitted): $modelOnlyCount" }
$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" })

# NOTE: buildings we do not TIER are never emitted as whole definitions - only their PM goods (via
# pm_goods) and, inside files we already own, their ai_value. There is deliberately no switch for
# that: an `include_all_buildings` flag existed here but gated nothing, so it was removed. If we
# ever start emitting untiered buildings wholesale, add the scope control together with the code.

# --- resolve output mod directory (relative name under repo) --------------------------------------
#   default 'mod' (canonical, deploys); -SaveTo X -> 'mod_X' (kept); -DryRun -> throwaway (deleted).
if ($DryRun -and $SaveTo) { throw "-DryRun and -SaveTo are mutually exclusive." }
$isAlt = $DryRun -or $SaveTo
if ($DryRun) {
    $modRel = "mod_dryrun_$PID"
} elseif ($SaveTo) {
    if ($SaveTo -notmatch '^[A-Za-z0-9._-]+$') { throw "-SaveTo name must be [A-Za-z0-9._-]+ (got '$SaveTo')." }
    $modRel = "mod_$SaveTo"
} else {
    $modRel = "mod"
}
$modAbs = Join-Path $repo $modRel
Write-Output "Output: $modRel$(if ($DryRun) { '  (dry run - will be deleted)' } elseif ($SaveTo) { '  (kept, not deployed)' })"

# For an alternate target, start from a clean folder but seed the one hand-maintained file
# (.metadata/metadata.json) from the canonical mod/ so the result is a complete, loadable mod.
if ($isAlt) {
    if (Test-Path $modAbs) { Remove-Item $modAbs -Recurse -Force }
    $srcMeta = Join-Path $repo 'mod\.metadata\metadata.json'
    $dstMeta = Join-Path $modAbs '.metadata\metadata.json'
    New-Item -ItemType Directory -Force -Path (Split-Path $dstMeta -Parent) | Out-Null
    Copy-Item -LiteralPath $srcMeta -Destination $dstMeta -Force
}

# --- pop_needs: scale the WEIGHT of chosen goods inside every need they appear in -----------------
# `weight` is the base weight a good gets in a need, modulated by its share of the market's sell orders
# (the mechanic is documented in a header comment in vanilla's own 00_pop_needs.txt - read it before
# touching this). It is the one lever on how a need's money splits between competing goods.
#
# Config: top-level `pop_need_weight_mult`, a map good -> multiplier, applied to EVERY entry for that
# good across ALL needs. Absent or empty => the file is NOT emitted at all and pop needs stay vanilla,
# on the same principle as the production-method files: owning a file we would copy verbatim freezes it
# against the next patch and ships bytes we did not author, for nothing.
#
# ⚠ WHOLE-FILE replacement of a SINGLE vanilla file (`00_pop_needs.txt`), so a game patch that adds a
# need or changes a weight is silently overridden until this is rebuilt. Listed in ON_GAME_UPDATE.
#
# ⚠ DEFINED HERE, ABOVE THE -ControlOnly SHORT-CIRCUIT, AND ON PURPOSE. The control arm must be able to
# carry this ONE change and nothing else: "vanilla + a weight rescaling" is the treatment arm of the
# pop-need weight experiment, and until 2026-08-06 it was not buildable at all, because -ControlOnly
# exits before the emitter ever ran. It writes directly rather than through WriteText/$bom, which are
# defined further down, for the same reason. Game content must be UTF-8 WITH BOM (the lexer warns
# otherwise), which is what $true to UTF8Encoding buys.
function Write-PopNeedWeights($cfgObj, $gameDir, $modRoot, $header, $relLabel) {
    $relPN = 'common\pop_needs\00_pop_needs.txt'
    $pnMult = @{}
    if ($cfgObj -and $cfgObj.pop_need_weight_mult) {
        foreach ($p in $cfgObj.pop_need_weight_mult.PSObject.Properties) { $pnMult[$p.Name] = [double]$p.Value }
    }
    if ($pnMult.Count -eq 0) {
        Write-Output "pop needs: no weight multipliers configured - staying vanilla (file not emitted)"
        return
    }
    $srcPN = Join-Path $gameDir $relPN
    if (-not (Test-Path -LiteralPath $srcPN)) {
        Write-Output "note: $relPN not found in game - skipping pop-need weight scaling"
        return
    }
    $pnLines = Get-Content -LiteralPath $srcPN
    $pOut = New-Object System.Collections.Generic.List[string]
    $pOut.Add($header.TrimEnd())
    $curGood = $null; $changed = 0
    foreach ($l in $pnLines) {
        $line = $l
        if ($l -match '^\s*goods\s*=\s*([a-z0-9_]+)') { $curGood = $Matches[1] }
        elseif ($l -match '^(\s*)weight\s*=\s*([0-9.]+)\s*$' -and $curGood -and $pnMult.ContainsKey($curGood)) {
            $nw = [double]$Matches[2] * $pnMult[$curGood]
            # trailing zeros trimmed: the game parses either, but a diff against vanilla should read clean
            $line = "{0}weight = {1}" -f $Matches[1], ($nw.ToString('0.####', [Globalization.CultureInfo]::InvariantCulture))
            $changed++
        }
        elseif ($l -match '^\s*entry\s*=\s*\{') { $curGood = $null }
        $pOut.Add($line)
    }
    $dstPN = Join-Path $modRoot $relPN
    New-Item -ItemType Directory -Force -Path (Split-Path $dstPN -Parent) | Out-Null
    [System.IO.File]::WriteAllText($dstPN, (($pOut -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding($true)))
    Write-Output ("pop needs: scaled {0} weight line(s) across {1} good(s) -> {2}\{3}" -f $changed, $pnMult.Count, $relLabel, $relPN)
    foreach ($k in ($pnMult.Keys | Sort-Object)) { Write-Output ("    {0} x{1}" -f $k, $pnMult[$k]) }
    if ($changed -eq 0) { Write-Output "WARN: pop_need_weight_mult named $($pnMult.Count) good(s) but matched NO weight line - check the good keys" }
}

# ---------------------------------------------------------------- telemetry ----
# Telemetry is generated HERE, by the one shared module, for every arm of an experiment - the
# vanilla control and any modded build alike. That is what makes a control valid: arms that
# instrument differently are not comparable. See TESTBED_METRICS.md before adding a metric.
. (Join-Path $PSScriptRoot 'telemetry_lib.ps1')

# ⚠ -Overlay BELONGS IN THIS LIST for the same reason -ControlOnly does: both arms are built to be
# MEASURED, and both write their telemetry inside the early-exit branch below. Omitting it (as this line
# did when -Overlay was added, 2026-08-06) leaves $telemetryText undefined and the branch writes an empty
# file — a silent instrument failure on an arm whose whole purpose is instrumentation.
$telemetryOn = $TelemetryOn -or $Telemetry -or $ControlOnly -or $Overlay
$telemetrySpec = $null
if ($telemetryOn) {
    $telemetrySpec = Read-TelemetrySpec $Telemetry
    $tok = $(if ($TelemetryToken) { $TelemetryToken } else { "build" })
    $telemetryText = New-TelemetryScript -Spec $telemetrySpec -Token $tok -BuildStamp (Get-Date -Format 'yyyy-MM-dd HH:mm')
    # Script values are the SECOND half of the same instrument (aggregate building counts read via
    # MakeScope.ScriptValue). Both arms get both files, or the arms are not comparable.
    $telemetryValues = New-TelemetryScriptValues
    # Probe values live in their own file so an unverified keyword cannot take the working ones
    # down with it (a script-values file that fails to parse loses everything in it).
    $telemetryProbeValues = $(if (@($telemetrySpec.metrics) -match '^(treasury_probe|scenario_probe)$') { New-TelemetryProbeValues } else { $null })
    # Events are the third file of the instrument, and the only one the builder emits under events/.
    # Needed because on_monthly_pulse is the finest pulse vanilla has: a reading between month
    # boundaries can only come from a scheduled event. $null unless a metric asks for it.
    $telemetryEvents = New-TelemetryEvents -Spec $telemetrySpec -Token $tok
    # Fail the BUILD, not the run: a data function written as script kills the rest of the file, and
    # the cost of finding that out in-game is a whole measurement run. See Test-TelemetryScript.
    Test-TelemetryScript -Text $telemetryText -What 'zzz_v3tb_telemetry.txt'
    if ($telemetryEvents) { Test-TelemetryScript -Text $telemetryEvents -What 'zzz_v3tb_probe.txt' }
}

# -ControlOnly: the CONTROL ARM. A complete, loadable mod whose only content is telemetry -
# no tier buildings, no production methods, no localization, no history. Everything the game
# sees is vanilla except the logging, which is byte-identical to what the modded arms carry.
#
# -Overlay: THE THIRD ARM, and NOT a control. Vanilla + telemetry + a small DECLARED overlay -
# today exactly one thing, the pop-need weight rescaling. It exists because a treatment against a
# vanilla control has to be "vanilla plus one named change", and for one day that was bolted onto
# -ControlOnly itself, which made the flag's name lie (user, 2026-08-06: "the only thing that's
# acceptable to add to a control and still call it control is a different telemetry approach").
# It carries its OWN metadata id, which is what lets preflight's L7 tell the two apart: L7 requires
# a control to emit nothing but the instrument directories, and an overlay is simply not a control
# so the check does not apply to it. Naming the arm honestly is what makes the guardrail work.
if ($ControlOnly -or $Overlay) {
    if ($ControlOnly -and $Overlay) { throw "-ControlOnly and -Overlay are different arms; pass exactly one." }
    $armFlag = $(if ($Overlay) { '-Overlay' } else { '-ControlOnly' })
    if (-not $isAlt) { throw "$armFlag must be combined with -SaveTo <name> or -DryRun; it must never overwrite the canonical mod/." }
    # ⚠ THE CONTROL'S GUARANTEE IS ENFORCED, NOT DOCUMENTED. A flag that promises the ABSENCE of
    # gameplay content must FAIL when handed content, never quietly widen to accommodate it - that
    # is precisely how the guarantee was lost. Use -Overlay for an arm that is meant to carry a
    # change; the error names it so the fix is obvious.
    if ($ControlOnly -and $cfg -and $cfg.PSObject.Properties.Name -contains 'pop_need_weight_mult' -and $cfg.pop_need_weight_mult) {
        throw "-ControlOnly was given a config carrying pop_need_weight_mult ($(Split-Path $cfgPath -Leaf)). A control arm carries NO gameplay content - that is the whole guarantee. Use -Overlay for vanilla + one declared change."
    }
    $meta = Get-Content $dstMeta -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($Overlay) {
        $meta.name = "V3 Testbed Overlay (vanilla + telemetry + declared overlay, built $(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
        $meta.id = "com.yurcick.v3_testbed_overlay"
        $meta.short_description = "NOT a control: vanilla + telemetry + a small declared gameplay overlay."
    } else {
        $meta.name = "V3 Testbed Control (vanilla + telemetry, built $(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
        $meta.id = "com.yurcick.v3_testbed_control"
        $meta.short_description = "Vanilla control arm: telemetry only, no gameplay content."
    }
    if ($meta.PSObject.Properties.Name -contains 'replace_paths') { $meta.PSObject.Properties.Remove('replace_paths') }
    [System.IO.File]::WriteAllText($dstMeta, ($meta | ConvertTo-Json -Depth 12), (New-Object System.Text.UTF8Encoding($false)))
    # WriteText/$bom are defined further down the script, so write directly here.
    # Game content must be UTF-8 WITH BOM (the lexer warns otherwise).
    $telDir = Join-Path $modAbs 'common\on_actions'
    New-Item -ItemType Directory -Force -Path $telDir | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $telDir 'zzz_v3tb_telemetry.txt'), $telemetryText, (New-Object System.Text.UTF8Encoding($true)))
    $svDir = Join-Path $modAbs 'common\script_values'
    New-Item -ItemType Directory -Force -Path $svDir | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $svDir 'zzz_v3tb_values.txt'), $telemetryValues, (New-Object System.Text.UTF8Encoding($true)))
    if ($telemetryProbeValues) { [System.IO.File]::WriteAllText((Join-Path $svDir 'zzz_v3tb_probe_values.txt'), $telemetryProbeValues, (New-Object System.Text.UTF8Encoding($true))) }
    if ($telemetryEvents) {
        $evDir = Join-Path $modAbs 'events'
        New-Item -ItemType Directory -Force -Path $evDir | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $evDir 'zzz_v3tb_probe.txt'), $telemetryEvents, (New-Object System.Text.UTF8Encoding($true)))
    }
    # THE OVERLAY, and only for -Overlay. A control never reaches this with content: the guard at the
    # top of this block throws first, so the absence is enforced rather than merely intended.
    # ⚠ ONE DECLARED THING ONLY. If a second overlay kind is ever added, it must be named in the
    # config and refused when not on the allow-list - an arm that quietly accumulates content is the
    # failure this whole split exists to prevent, and it would be just as bad under a new name.
    $pnEmitted = $false
    if ($Overlay) {
        Write-PopNeedWeights $cfg $Game $modAbs $genHeader $modRel
        $pnEmitted = Test-Path -LiteralPath (Join-Path $modAbs 'common\pop_needs\00_pop_needs.txt')
        if (-not $pnEmitted) {
            throw "-Overlay was given $(Split-Path $cfgPath -Leaf), which produced no overlay at all. An overlay arm that carries nothing is a control wearing the wrong name - pass -ControlOnly, or give it a config with pop_need_weight_mult."
        }
    }
    Write-Output ""
    if ($Overlay) {
        Write-Output "OVERLAY BUILD (NOT a control): vanilla + telemetry + a declared overlay -> $modRel"
    } else {
        Write-Output "CONTROL BUILD: vanilla + telemetry only -> $modRel"
    }
    Write-Output "  dump dates: $($telemetrySpec.dump_dates -join ', ')"
    Write-Output "  tags      : $($telemetrySpec.tags -join ', ')"
    Write-Output "  metrics   : $($telemetrySpec.metrics -join ', ')"
    if ($pnEmitted) {
        # ASCII on purpose: this line lands in build.log, which is read back through tooling that
        # decodes UTF-8 as CP1251 on this machine, and a mangled warning is a warning nobody reads.
        Write-Output "  overlay: common/pop_needs/00_pop_needs.txt from $(Split-Path $cfgPath -Leaf)"
        Write-Output "  !! THIS IS NOT A CONTROL ARM - never report a result from it as one."
    } else {
        Write-Output "  (no buildings, no production methods, no localization, no history, no pop needs)"
    }
    # PREFLIGHT on the control arm too. It exits early - that early exit is the same one CLAUDE.md
    # names as the reason a gameplay file ended up on the wrong side of the -ControlOnly guarantee -
    # so a check placed only at the bottom of the script would never see the one arm whose whole
    # promise is "carries nothing". L7 is precisely that promise, checked against the emitted files.
    if (-not $NoPreflight) {
        & (Join-Path $PSScriptRoot 'preflight.ps1') -Mod $modAbs -Config $cfgPath -Quiet
        if ($LASTEXITCODE -ne 0) {
            $global:LASTEXITCODE = 0
            throw "PREFLIGHT FAILED - see the landmine IDs above and TESTBED_LANDMINES.md."
        }
        $global:LASTEXITCODE = 0
    }
    exit 0
}

# --- post-build checks: run on the FINISHED mod folder (after generation + convert + lint).
#   This is the mandated-checks hook the dry run relies on; add future must-pass checks here.
#   Returns an array of problem strings (empty = healthy). Existence + non-empty of the files a
#   loadable build must have, one loc file per configured language. ------------------------------
function Invoke-ModChecks($modRoot, $config) {
    $problems = @()
    $required = @(
        'common\buildings\01_industry.txt',
        'common\production_methods\zzz_pm_rehaul_01_industry.txt',
        'common\production_method_groups\zzz_pm_rehaul_01_industry.txt',
        '.metadata\metadata.json'
    )
    foreach ($r in $required) {
        $p = Join-Path $modRoot $r
        if (-not (Test-Path $p)) { $problems += "missing: $r" }
        elseif ((Get-Item $p).Length -eq 0) { $problems += "empty: $r" }
    }
    foreach ($lang in $config.languages) {
        $p = Join-Path $modRoot "localization\$lang\replace\$($config.loc_basename)_l_$lang.yml"
        if (-not (Test-Path $p)) { $problems += "missing loc: $lang" }
        elseif ((Get-Item $p).Length -eq 0) { $problems += "empty loc: $lang" }
    }
    # 1836 start. metadata.json lists common/history/buildings under `replace_paths`, so the engine
    # reads ONLY our copy: a converter that silently emitted nothing would wipe every starting
    # factory in the game and nothing else here would notice. Check one file per vanilla file, all
    # non-empty, and that they still contain create_building blocks.
    $histSrc = Join-Path $Game 'common\history\buildings'
    $histOut = Join-Path $modRoot 'common\history\buildings'
    if (Test-Path $histSrc) {
        $srcFiles = @(Get-ChildItem $histSrc -Filter *.txt)
        $outFiles = @(Get-ChildItem $histOut -Filter *.txt -ErrorAction SilentlyContinue)
        if ($outFiles.Count -ne $srcFiles.Count) {
            $problems += "history: $($outFiles.Count) file(s) emitted, vanilla has $($srcFiles.Count) (replace_paths makes ours the only history)"
        }
        $emptyHist = @($outFiles | Where-Object { $_.Length -eq 0 })
        if ($emptyHist.Count -gt 0) { $problems += "history: empty file(s): $(($emptyHist | ForEach-Object { $_.Name }) -join ', ')" }
        $totalBuildings = 0
        foreach ($f in $outFiles) { $totalBuildings += ([regex]::Matches([System.IO.File]::ReadAllText($f.FullName), 'create_building\s*=\s*\{')).Count }
        if ($totalBuildings -eq 0 -and $outFiles.Count -gt 0) { $problems += "history: no create_building blocks emitted - the 1836 start would be empty" }
    }
    return $problems
}

# --- clean previously generated outputs -------------------------------------------------------------
# ⚠⚠ EVERYTHING, not a list. This used to name three directories plus localization, so every OTHER
# emitted folder — technology, static_modifiers, defines, journal_entries, ai_strategies, scripted_effects,
# script_values, scripted_progress_bars, on_actions, events — kept whatever an earlier build had put
# there. A file whose EMITTER IS REMOVED therefore went on shipping forever: the build passes, the linters
# pass, preflight passes, the mod loads, and it silently carries a gameplay change that was deleted by
# ruling. That is exactly what happened when the per-tree tech-spread boost was removed (2026-08-12) —
# `common/static_modifiers/00_code_static_modifiers.txt` survived the rebuild and was still deployed.
# A conditional emitter makes this the NORMAL case, not an edge one: `research_events.enabled = false`
# and the military era-move file both emit nothing on some runs.
# ⚠ TWO EXCEPTIONS, both deliberate:
#   .metadata      — the one hand-maintained thing in mod/ (CLAUDE.md); deleting it loses the mod id.
#   common/history — rewritten LATER in this build by convert_history.ps1. Wiping it here would leave the
#                    game with no starting buildings at all if the converter then failed, and
#                    replace_paths makes our copy the only history the engine reads.
foreach ($d in Get-ChildItem $modAbs -Force -ErrorAction SilentlyContinue) {
    if ($d.Name -eq '.metadata') { continue }
    if ($d.PSIsContainer -and $d.Name -eq 'common') {
        foreach ($c in Get-ChildItem $d.FullName -Force -ErrorAction SilentlyContinue) {
            if ($c.Name -eq 'history') { continue }
            Remove-Item $c.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
        continue
    }
    Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
}

$pmOut = @($genHeader); $pmgOut = @($genHeader)
$genByBase = @{}        # base building key -> generated text for that whole industry (base + tiers)
$genFileOf = @{}        # base building key -> which vanilla buildings file we emit it into (we whole-file-replace that file)
$locBody = @()          # localization entries (identical across languages)

# Owned vanilla building files: 01_industry.txt (default) plus any industry's source_file (06/11 for the
# new-economy chains). We whole-file-replace each. Parse their building blocks up front so clone_from_vanilla
# industries can copy the vanilla block.
$defaultSrc = 'common/buildings/01_industry.txt'
$ownedRels = @(@($cfg.industries | Where-Object { -not $_.disabled } | ForEach-Object { if ($_.source_file) { $_.source_file } else { $defaultSrc } }) | Select-Object -Unique)
$vanBld = @{}           # vanilla building key -> block lines (for cloning)
foreach ($rel in $ownedRels) {
    $vl = Get-Content -LiteralPath (Join-Path $Game ($rel -replace '/','\'))
    $j = 0
    while ($j -lt $vl.Count) {
        if ($vl[$j] -match '^(building_[A-Za-z0-9_]+)\s*=\s*\{') {
            $bk = $Matches[1]; $d = 0; $buf = New-Object System.Collections.Generic.List[string]
            do { $l = $vl[$j]; $d += ([regex]::Matches($l,'\{')).Count - ([regex]::Matches($l,'\}')).Count; $buf.Add($l); $j++ } while ($j -lt $vl.Count -and $d -gt 0)
            $vanBld[$bk] = $buf.ToArray()
        } else { $j++ }
    }
}
$tierMap = @('# MAIN production method  tier(1-based)  target_be  wage_pct. AUTO-GENERATED by build.ps1.')
$summary = @()
$D = [char]36           # literal '$' for loc interpolation

foreach ($ind in $cfg.industries) {
    if ($ind.disabled) { continue }   # leave vanilla (no split); config keeps the data for later
    $tierNo = 0
    $indBld = @()
    # THE ANCHOR TIER: the one that reuses the vanilla building key, so vanilla's `has_building` and
    # history references keep matching. It is the lowest-era tier carrying a vanilla_pm — NOT tiers[0],
    # which since the era-0 rungs were switched on is an invented key. See the genByBase note below.
    $anchor = ($ind.tiers | Where-Object { $null -ne $_.vanilla_pm } | Sort-Object { [int]$_.era } | Select-Object -First 1)
    if ($null -eq $anchor) { $anchor = $ind.tiers[0] }
    $anchorKey = $anchor.key
    foreach ($t in $ind.tiers) {
        $tierNo++

        # inputs/output_qty are actual volumes; the builder emits them directly.
        $outGood = if ($t.output_good) { $t.output_good } else { $ind.output_good }
        $Oval = [double]$t.output_qty * $prices[$outGood]
        $wage = if ($null -ne $t.wage_pct) { [double]$t.wage_pct } else { 0.25 }   # wages as fraction of TOTAL cost (input goods + wages); default 0.25 (BALANCE_FRAMEWORK §1)

        # ---- PM ----
        # §10.60 graded port factorisation: workforce/effect multipliers, 1 for every unfactored tier.
        $wfM = if ($null -ne $t.workforce_mult) { [double]$t.workforce_mult } else { 1.0 }
        $fxM = if ($null -ne $t.effect_mult) { [double]$t.effect_mult } else { 1.0 }
        $pm = @("$($t.pm_key) = {", "`ttexture = `"$($t.texture)`"")
        # state modifiers (workforce-scaled): pollution + infrastructure (ports/railways produce infra).
        $stateMods = @()
        if ([double]$t.pollution -gt 0) { $stateMods += "state_pollution_generation_add = $(QtyMul $t.pollution $fxM)" }
        if ($null -ne $t.state_infrastructure) { $stateMods += "state_infrastructure_add = $(QtyMul $t.state_infrastructure $fxM)" }
        if ($stateMods.Count -gt 0) {
            $pm += "`tstate_modifiers = {","`t`tworkforce_scaled = {"
            foreach ($sm in $stateMods) { $pm += "`t`t`t$sm" }
            $pm += "`t`t}","`t}"
        }
        # country modifiers: shipyards grant naval capacity (country_ship_construction_add) from the SAME
        # PM that makes clippers/steamers — dropping it silently breaks building/maintaining navies.
        if ($null -ne $t.ship_construction) {
            $pm += "`tcountry_modifiers = {","`t`tworkforce_scaled = {","`t`t`tcountry_ship_construction_add = $(QtyMul $t.ship_construction $fxM)","`t`t}","`t}"
        }
        $pm += "`tbuilding_modifiers = {","`t`tworkforce_scaled = {"
        # EXACT VOLUMES FOR EVERY TIER (user-ruled 2026-08-17): the config's solved volumes emit
        # VERBATIM. The legacy [int] cast quietly shipped 42 where the model said 42.3, so the game ran
        # a slightly different recipe from every solver, linter and UI figure — worst on low-volume
        # goods. QtyMul emits integers bare and fractions to 3 dp, so integer configs stay byte-stable.
        $actualI = 0.0
        foreach ($p in $t.inputs.PSObject.Properties) {
            $actualI += [double]$p.Value * $prices[$p.Name]
            $pm += "`t`t`tgoods_input_$($p.Name)_add = $(QtyMul $p.Value 1)"
        }
        $pm += "`t`t`tgoods_output_$($outGood)_add = $(QtyMul $t.output_qty 1)","`t`t}"
        # employment (level_scaled). Some buildings carry NO base-PM employment (e.g. the art academy: jobs live
        # in its ownership PMG, kept as a secondary), so omit the block entirely when employment is empty.
        $empProps = if ($null -ne $t.employment) { @($t.employment.PSObject.Properties) } else { @() }
        if ($empProps.Count -gt 0) {
            $pm += "`t`tlevel_scaled = {"
            # §10.60: multiplied employment stays whole by construction (the 0.1/0.1/0.1/0.2/0.2 set was
            # chosen so every profession lands >=10/level — the EMPLOYMENT_PROPORTIONALITY_LIMIT hazard);
            # throw rather than silently rounding if a config edit ever breaks that.
            foreach ($e in $empProps) {
                $ev = [math]::Round([double]$e.Value * $wfM, 6)
                if ($ev -ne [math]::Floor($ev)) { throw "workforce_mult $wfM on $($t.key) leaves fractional employment $($e.Name)=$ev - adjust the multiplier or the employment (§10.60)" }
                $pm += "`t`t`tbuilding_employment_$($e.Name)_add = $([int]$ev)"
            }
            $pm += "`t`t}"
        }
        $pm += "`t}"
        if ($null -ne $t.required_input_goods) { $pm += "`trequired_input_goods = $($t.required_input_goods)" }
        $pm += "}",""
        $pmOut += $pm
        $actualBe = if ($Oval -gt 0) { $actualI / (1 - $wage) / $Oval * 100 } else { 0 }   # actual FULL break-even (total cost = goods/(1-wage)), for the building name + summary

        # ---- PMG (single main PM) ----
        $pmgOut += "$($t.pmg_key) = {","`ttexture = `"gfx/interface/icons/generic_icons/mixed_icon_base.dds`"","`tproduction_methods = { $($t.pm_key) }","}",""

        # ---- Building ----
        if ($ind.clone_from_vanilla) {
            # copy the vanilla block, swap only key/tech/PMGs/(construction); keep all special engine fields.
            $baseKey = $ind.tiers[0].key
            if (-not $vanBld.ContainsKey($baseKey)) { throw "clone_from_vanilla: vanilla building '$baseKey' not found in owned files for industry '$($ind.id)'" }
            $pmgTokens = @($t.pmg_key) + @($ind.secondary_pmgs)
            $reqCon = if ($null -ne $t.building_cost) { [int]$t.building_cost } else { $null }   # $null => keep vanilla required_construction
            $clonedBld = New-ClonedBuilding $vanBld[$baseKey] $t.key $baseKey $t.tech $pmgTokens $reqCon
            # Per-tier ai_value on CLONED tiers too (F66 addendum): vanilla port/railway carry no scalar
            # ai_value, so a cloned tier competes at the engine default 1000 (NAI
            # PRODUCTION_BUILDING_BASE_VALUE) unless the config says otherwise. The F66 probe sets tiny
            # values on the e1+ port tiers to test whether ai_value reaches the per-overseas-state
            # provisioning term. Set-BuildingAiValue refuses complex blocks, so a vanilla conditional
            # ai_value (railway's Trans-Siberian block) is never mangled — it notes and skips instead.
            # ⚠ New-ClonedBuilding returns ONE STRING, not lines — split before the per-line helper, or
            # the "insert after element 0" lands AFTER the whole block, at file top level (caught on the
            # first emit: four ai_value = 50 orphans between buildings).
            if ($null -ne $t.ai_value) { $clonedBld = (Set-BuildingAiValue ($clonedBld -split "`n") ([int]$t.ai_value)) -join "`n" }
            $indBld += $clonedBld
            $indBld += ""
        } else {
            $b = $ind.building
            $bl = @("$($t.key) = {")
            # aliases (vanilla plural keys) belong ONLY to the building that reuses the vanilla key;
            # putting them on any other tier would be a duplicate-alias conflict. That is the ANCHOR
            # tier, not tier position 1 — an era-0 rung sits at position 1 and has an invented key.
            if ($null -ne $b.aliases -and $t.key -eq $anchorKey) { $bl += "`taliases = { $($b.aliases -join ' ') }" }
            $bl += "`tbuilding_group = $($b.building_group)","`ticon = `"$($b.icon)`"","`tcity_type = $($b.city_type)","`tlevels_per_mesh = $([int]$b.levels_per_mesh)"
            if ($null -ne $b.ai_nationalization_desire) { $bl += "`tai_nationalization_desire = $(Fmt $b.ai_nationalization_desire)" }
            # An era-0 rung carries NO technology on purpose (ROADMAP step 1): a bloomery forge and a
            # village joinery are what exists before industry, so they emit ungated like vanilla's own
            # logging camp. Omit the line entirely rather than writing an empty block.
            if ($null -ne $t.tech -and "$($t.tech)" -ne '') { $bl += "`tunlocking_technologies = { $($t.tech) }" }
            $bl += "`tproduction_method_groups = {","`t`t$($t.pmg_key)"
            foreach ($s in $ind.secondary_pmgs) { $bl += "`t`t$s" }
            # required_construction: per-tier building_cost (construction points) if set, else the
            # building-level fallback (a raw number or a vanilla script-value name like construction_cost_high).
            $reqCon = if ($null -ne $t.building_cost) { [int]$t.building_cost } else { $b.required_construction }
            $bl += "`t}","`trequired_construction = $reqCon"
            if ($b.heavy_industry_law) { $bl += "`tpossible = {","`t`towner = {","`t`t`tNOT = {","`t`t`t`tOR = {","`t`t`t`t`thas_law_or_variant = law_type:law_industry_banned","`t`t`t`t`thas_law_or_variant = law_type:law_extraction_economy","`t`t`t`t}","`t`t`t}","`t`t}","`t}" }
            if ($b.coastal_only) { $bl += "`tpotential = {","`t`tis_coastal = yes","`t}" }
            # ai_value: per-tier override (editable in the UI) wins, else the building-level fallback.
            $aiv = if ($null -ne $t.ai_value) { $t.ai_value } elseif ($null -ne $b.ai_value) { $b.ai_value } else { $null }
            if ($null -ne $aiv) { $bl += "`tai_value = $([int]$aiv)" }
            $bl += "`townership_type = $($b.ownership_type)","`tbackground = `"$($b.background)`"","}",""
            $indBld += $bl
        }

        # ---- localization (shared body) ----
        # follows_be:false industries (ports, railways) stay on vanilla economics, so their name omits
        # the BE target (BE is not the design handle for them).
        $beLabel = if ($ind.follows_be -eq $false) { "" } else { ". BE target $([math]::Round($actualBe))%" }
        # ⚠ THE NUMBER A PLAYER READS IS THE ERA, NOT A POSITION. It used to be `$tierNo`, a 1-based count
        # of EMITTED tiers, which meant the same digit described different vintages in different industries:
        # the automotive industry's first building is era 3, and it shipped as "Tier 1". It also disagreed
        # with the UI (which labels by era) and with the config. The era is the design's own number and the
        # one every other surface uses, so it is what the name says. An industry legitimately starts at
        # "Era 3" or "Era 4" — that IS the statement, not a gap to hide.
        $eraNo = if ($null -ne $t.era) { [int]$t.era } else { $tierNo }
        $locBody += " $($t.key):0 `"Era $eraNo. $($t.name)$beLabel`""
        $locBody += " $($t.key)_lens_option:0 `"Expand $D$($t.key)$D`""
        $locBody += " $($t.pmg_key):0 `"$($t.pm_name)`""
        $locBody += " $($t.pm_key):0 `"$($t.pm_name)`""

        # ---- tier map + summary ---- (columns: pm tier target_be wage_pct; linter reads all four)
        # The hard linter ladder covers only the core manufacturing chains. New-economy industries
        # (no_mass_be: power/port/railway) are excluded: ports/railways stay on vanilla economics, and
        # power's tiny volumes (output 25) miss its BE target by a few pp on integer rounding by design.
        if ($ind.follows_be -ne $false -and -not $ind.no_mass_be) { $tierMap += "$($t.pm_key) $tierNo $($t.target_be) $(Fmt $wage)" }
        $summary += [pscustomobject]@{ Building=$t.key; Tier=$tierNo; TargetBE=$t.target_be; ActualBE=[math]::Round($actualBe) }
    }
    # ⚠ KEYED BY THE TIER THAT REUSES THE VANILLA BUILDING KEY - which is NOT tiers[0].
    # It was tiers[0] until the era-0 rungs were switched on (2026-08-11). An era-0 tier is an INVENTED
    # key (building_food_industry_artisanal), so keying on it meant the vanilla `building_food_industry`
    # block matched nothing, was copied through verbatim, AND our set was appended by the no-anchor
    # fallback below - two definitions of the same key in one file. The game does not crash: it logs
    # `gamedatabase.h: Duplicated key ... will not be created` and keeps the VANILLA one, so the mod
    # silently ships vanilla's building for all 9 industries that have an era-0 rung.
    # $anchorKey is computed at the top of this industry loop (the lowest-era tier with a vanilla_pm).
    $genByBase[$anchorKey] = ($indBld -join "`n")
    $genFileOf[$anchorKey] = if ($ind.source_file) { $ind.source_file } else { $defaultSrc }
}

# --- write files ---
$noBom = New-Object System.Text.UTF8Encoding($false)   # tool files (ladder_tiers)
$bom   = New-Object System.Text.UTF8Encoding($true)    # game content (common/*, localization) - matches vanilla
function WriteText($rel, $text, $enc) {
    $path = Join-Path $repo $rel
    $dir = Split-Path $path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText($path, $text, $enc)
}
WriteText "$modRel\common\production_methods\zzz_pm_rehaul_01_industry.txt"        (($pmOut  -join "`n") + "`n") $bom
WriteText "$modRel\common\production_method_groups\zzz_pm_rehaul_01_industry.txt"  (($pmgOut -join "`n") + "`n") $bom
# Linter tier map: canonical build writes the committed tools\ladder_tiers.txt; alternate builds
# (-DryRun/-SaveTo) write a throwaway temp copy so they never mutate the committed file.
if ($isAlt) {
    $ladderPath = Join-Path ([System.IO.Path]::GetTempPath()) "pm_ladder_$PID.txt"
    [System.IO.File]::WriteAllText($ladderPath, (($tierMap -join "`n") + "`n"), $noBom)
} else {
    WriteText 'tools\ladder_tiers.txt' (($tierMap -join "`n") + "`n") $noBom
    $ladderPath = Join-Path $repo 'tools\ladder_tiers.txt'
}

# --- buildings: REPLACE each OWNED vanilla buildings file (same filename) ---
# V3 rejects a redefined building key that comes from a different file, so the mod must OWN the whole
# file. We own 01_industry.txt (manufacturing) plus any industry's source_file (06_urban_center for
# power, 11_private_infrastructure for port/railway). For each owned file: copy vanilla, swap each of
# OUR base building blocks (that belong to that file) for our (base + tier) set, keep everything else
# verbatim; append any of our new industries that have no vanilla anchor in that file.
# ai_value overrides for PRESERVED buildings in owned files (config top-level building_ai_value map).
$aiMap = @{}
if ($cfg.building_ai_value) { foreach ($p in $cfg.building_ai_value.PSObject.Properties) { $aiMap[$p.Name] = [int]$p.Value } }
foreach ($rel in $ownedRels) {
    $relWin = $rel -replace '/','\'
    $vanLines = Get-Content -LiteralPath (Join-Path $Game $relWin)
    $bOut = New-Object System.Collections.Generic.List[string]
    $bOut.Add($genHeader.TrimEnd())
    $emitted = @{}; $i = 0
    while ($i -lt $vanLines.Count) {
        $line = $vanLines[$i]
        if ($line -match '^(building_[A-Za-z0-9_]+)\s*=\s*\{') {
            $bkey = $Matches[1]
            $blk = New-Object System.Collections.Generic.List[string]; $depth = 0
            do {
                $l = $vanLines[$i]
                $depth += ([regex]::Matches($l, '\{')).Count - ([regex]::Matches($l, '\}')).Count
                $blk.Add($l); $i++
            } while ($i -lt $vanLines.Count -and $depth -gt 0)
            if ($genByBase.ContainsKey($bkey) -and $genFileOf[$bkey] -eq $rel) { $bOut.Add($genByBase[$bkey]); $emitted[$bkey] = $true }
            elseif ($aiMap.ContainsKey($bkey)) { foreach ($bl2 in (Set-BuildingAiValue $blk $aiMap[$bkey])) { $bOut.Add($bl2) } }   # preserved building + ai_value override (trade center, …)
            else { foreach ($bl2 in $blk) { $bOut.Add($bl2) } }
        } else { $bOut.Add($line); $i++ }
    }
    foreach ($bk in $genByBase.Keys) { if ($genFileOf[$bk] -eq $rel -and -not $emitted.ContainsKey($bk)) { Write-Output "note: $bk has no vanilla base building in $rel - appending as a new industry (expected for split-out chains, e.g. the steamer shipyard)"; $bOut.Add($genByBase[$bk]) } }
    WriteText "$modRel\$relWin" (($bOut -join "`n") + "`n") $bom
}

# --- pop_needs -----------------------------------------------------------------------------------
# The emitter itself lives near the top of this script (Write-PopNeedWeights), ABOVE the -ControlOnly
# short-circuit, so the vanilla control arm can carry this one change and nothing else. See it there
# for what it does and why the file is not emitted at all when no multiplier is configured.
Write-PopNeedWeights $cfg $Game $modAbs $genHeader $modRel

# --- ai_strategies: REPLACE 01_admin_strategies.txt to control AI SUBSIDY POLICY ------------------
# The `subsidies` block inside an ai_strategy is the AI's subsidy DECISION RULE (must_have /
# wants_to_have / nice_to_have) - NOT a per-building flag. It is the only durable way to make the AI
# subsidize a building: the AI re-scores subsidies continuously (defines NAI SUBSIDIZE_*), so a scripted
# `set_subsidized` would simply be undone on its next pass.
# WHY THIS FILE: we own the ADMINISTRATIVE strategies (all 7 live in this one ~655-line file) rather than
# ai_strategy_default (a single ~8790-line block) - a 13x smaller patch surface. Every AI country always
# runs exactly one administrative strategy (ai_strategy_industrial_expansion has no `possible` gate, so it
# is always available), so covering all 7 covers everyone.
# TRIO RESTATEMENT: it is unclear whether a typed strategy's `subsidies` MERGES with ai_strategy_default's
# per key or REPLACES it wholesale, so we restate the default's power_plant/railway/port = must_have in
# every block we write. That is a no-op under merge and correct under replace.
# Config: top-level `building_subsidies` map, building key -> vanilla|none|nice_to_have|wants_to_have|must_have.
#   vanilla (or absent) = emit nothing for that building (its vanilla entries stand)
#   none                = suppress it (drop the key from every block we write)
$SUBSIDY_ENUM = @('nice_to_have','wants_to_have','must_have')
# depth-1 `subsidies = { … }` helpers: read its building->value entries, and strip the whole block out.
function Get-SubsidyEntries($blk) {
    $out = [ordered]@{}; $d = 0; $inb = $false
    foreach ($l in $blk) {
        if (-not $inb -and $l -match '^\s*subsidies\s*=\s*\{') { $inb = $true; $d = 0 }
        if ($inb) {
            $d += ([regex]::Matches($l,'\{')).Count - ([regex]::Matches($l,'\}')).Count
            if ($l -match '^\s*(building_[A-Za-z0-9_]+)\s*=\s*([a-z_]+)') { $out[$Matches[1]] = $Matches[2] }
            if ($d -le 0) { $inb = $false }
        }
    }
    return $out
}
function Test-HasSubsidyBlock($blk) {
    foreach ($l in $blk) { if ($l -match '^\s*subsidies\s*=\s*\{') { return $true } }
    return $false
}
function Remove-SubsidyBlock($blk) {
    $out = New-Object System.Collections.Generic.List[string]; $d = 0; $inb = $false
    foreach ($l in $blk) {
        if (-not $inb -and $l -match '^\s*subsidies\s*=\s*\{') { $inb = $true; $d = 0 }
        if ($inb) {
            $d += ([regex]::Matches($l,'\{')).Count - ([regex]::Matches($l,'\}')).Count
            if ($d -le 0) { $inb = $false }
            continue
        }
        $out.Add($l)
    }
    return $out
}
$subMap = @{}
if ($cfg.building_subsidies) {
    foreach ($p in $cfg.building_subsidies.PSObject.Properties) {
        $v = [string]$p.Value
        if ([string]::IsNullOrWhiteSpace($v) -or $v -eq 'vanilla') { continue }
        if ($v -ne 'none' -and $SUBSIDY_ENUM -notcontains $v) {
            throw "building_subsidies: '$($p.Name)' = '$v' is invalid (expected vanilla|none|nice_to_have|wants_to_have|must_have)"
        }
        $subMap[$p.Name] = $v
    }
}
# --- CONDITIONAL subsidies (config `subsidy_conditional`, EXPERIMENTAL 2026-08-16) --------------
# The subsidies block itself is a flat map (no per-entry triggers — goods_stances has them, subsidies
# does not), so conditionality is expressed the way the engine expresses ALL conditional AI behaviour:
# STRATEGY VARIANTS. Each admin strategy is emitted twice — the BASE keeps the building_subsidies map
# (which should carry the mandate, e.g. early ports = must_have), and a `<name>_pmr_mature` variant
# applies `retire_overrides` on top. The two carry MUTUALLY EXCLUSIVE `possible` gates (base = original
# possible AND NOT retire_trigger; variant = original possible AND retire_trigger), so exactly one of
# the pair is available at any time — if the AI re-evaluates strategies it MUST switch, and if it never
# does, the design degrades to a permanent base mandate rather than to nothing.
# ⚠ `retire_trigger` is raw script pasted into the possible blocks — keep it to constructs vanilla
# itself uses inside ai_strategies (any_scope_building / is_building_type / count >=), and remember a
# broken trigger fails SILENT-PERMISSIVE or SILENT-RESTRICTIVE, not loudly: check error.log on load.
$subCond = $cfg.subsidy_conditional
if ($subCond) {
    if (-not $subCond.retire_trigger -or -not $subCond.retire_overrides) {
        throw "subsidy_conditional needs both retire_trigger and retire_overrides"
    }
    foreach ($p in $subCond.retire_overrides.PSObject.Properties) {
        $v = [string]$p.Value
        if ($v -ne 'none' -and $SUBSIDY_ENUM -notcontains $v) { throw "subsidy_conditional.retire_overrides: '$($p.Name)' = '$v' invalid" }
    }
    # Optional THIRD class (2026-08-16, user design): countries in SOMEONE ELSE'S market are exempt
    # from the mandate entirely (their overseas access rides the market owner's merchant marine).
    # exempt_trigger is the OUT-OF-CLASS condition (e.g. NOT = { ROOT.market.owner ?= ROOT } —
    # vanilla's own market-ownership idiom, 02_coffee_and_milk.txt); exempt_overrides its map.
    if ($subCond.exempt_trigger -and -not $subCond.exempt_overrides) { throw "subsidy_conditional.exempt_trigger needs exempt_overrides" }
    if ($subCond.exempt_overrides) {
        foreach ($p in $subCond.exempt_overrides.PSObject.Properties) {
            $v = [string]$p.Value
            if ($v -ne 'none' -and $SUBSIDY_ENUM -notcontains $v) { throw "subsidy_conditional.exempt_overrides: '$($p.Name)' = '$v' invalid" }
        }
    }
    # Optional: emit the merchant-marine share script values the retire_trigger can reference.
    # pmr_port_mm_excess >= 0  <=>  (t2+ ports' occupancy-weighted merchant_marine output)
    # >= retire_share x (all port tiers' output). Coefficients are the CONFIG's own per-tier
    # output_qty, read at build time - a re-solve flows through automatically. The SV-in-trigger
    # construct is the research bars' own shipped idiom (pmr_mob_share >= 0.5).
    if ($subCond.retire_share -or $subCond.coverage_share) {
        $portInd = $cfg.industries | Where-Object { $_.id -eq 'port' }
        if (-not $portInd) { throw "subsidy_conditional share values need a 'port' industry in the config" }
        $share = if ($subCond.retire_share) { [double]$subCond.retire_share } else { 0.5 }
        if ($share -le 0 -or $share -ge 1) { throw "subsidy_conditional.retire_share must be in (0,1)" }
        $inv = [Math]::Round(1.0 / $share, 4)
        # invariant formatting inline - Format-Qty is defined later in this straight-line script,
        # and a Russian-locale comma in a script value would be a silent parse failure
        $fmtN = { param($v) $d = [double]$v
            if ($d -eq [math]::Truncate($d)) { return ([long]$d).ToString([System.Globalization.CultureInfo]::InvariantCulture) }
            return $d.ToString('0.####', [System.Globalization.CultureInfo]::InvariantCulture) }
        $sv = New-Object System.Collections.Generic.List[string]
        $sv.Add(($genHeader.TrimEnd()))
        $tierKeys = @($portInd.tiers | ForEach-Object { $_.key })
        # THE COVERAGE SET — which port tiers count toward retiring the mandate (user-corrected
        # 2026-08-16 twice, §10.60.3): "the subsidies stop only when the LIKELY-TO-BE-PROFITABLE
        # ports are enough by themselves to cover the MM demand. Steamer t1 is not one of them."
        # So the set is EXPLICIT in the config (`coverage_tiers` — canonical: industrial/modern/
        # motor), validated against the port tiers, never a derivation: "above the lowest era"
        # wrongly included the steam stub, and profitability is a design judgement the config
        # states, not a rule the builder can infer. Fallback without the key: modern+motor (the
        # F65-measured pair), the conservative direction (mandate lasts longer).
        $modernSet = if ($subCond.coverage_tiers) {
            foreach ($ck in $subCond.coverage_tiers) {
                if ($tierKeys -notcontains $ck) { throw "subsidy_conditional.coverage_tiers: '$ck' is not a port tier key (have: $($tierKeys -join ', '))" }
            }
            @($subCond.coverage_tiers)
        } else { @('building_port_modern', 'building_port_motor') }
        foreach ($t in $portInd.tiers) {
            $svName = 'pmr_mm_' + ($t.key -replace '^building_', '')
            $sv.Add("$svName = {")
            $sv.Add("`tvalue = 0")
            $sv.Add("`tevery_scope_building = {")
            $sv.Add("`t`tlimit = { is_building_type = $($t.key) }")
            $sv.Add("`t`tadd = { value = this.level  multiply = occupancy }")
            $sv.Add("`t}")
            $sv.Add("`tmultiply = $(& $fmtN $t.output_qty)")
            $sv.Add("}")
        }
        if ($subCond.retire_share) {
            $sv.Add("# excess >= 0  <=>  modern share of port merchant-marine output >= $share")
            $sv.Add("pmr_port_mm_excess = {")
            $first = $true
            foreach ($t in $portInd.tiers) {
                if ($modernSet -notcontains $t.key) { continue }
                $svName = 'pmr_mm_' + ($t.key -replace '^building_', '')
                if ($first) { $sv.Add("`tvalue = $svName"); $first = $false } else { $sv.Add("`tadd = $svName") }
            }
            if ($first) { throw "subsidy_conditional.retire_share: no modern-class port tiers found" }
            $sv.Add("`tmultiply = $(& $fmtN $inv)")
            foreach ($t in $portInd.tiers) {
                $svName = 'pmr_mm_' + ($t.key -replace '^building_', '')
                $sv.Add("`tsubtract = $svName")
            }
            $sv.Add("}")
        }
        # v3 (user design): coverage comparator — staffed high-tier MM output x (1/coverage_share),
        # for the trigger  mg:merchant_marine = { market_goods_buy_orders > pmr_mm_high_cov }
        # (buy orders exceeding it  <=>  high-tier covers < coverage_share of the market's MM demand)
        if ($subCond.coverage_share) {
            $cs = [double]$subCond.coverage_share
            if ($cs -le 0 -or $cs -ge 1) { throw "subsidy_conditional.coverage_share must be in (0,1)" }
            $cinv = [Math]::Round(1.0 / $cs, 4)
            $sv.Add("pmr_mm_high_cov = {")
            $first = $true
            foreach ($t in $portInd.tiers) {
                if ($modernSet -notcontains $t.key) { continue }
                $svName = 'pmr_mm_' + ($t.key -replace '^building_', '')
                if ($first) { $sv.Add("`tvalue = $svName"); $first = $false } else { $sv.Add("`tadd = $svName") }
            }
            $sv.Add("`tmultiply = $(& $fmtN $cinv)")
            $sv.Add("}")
        }
        WriteText "$modRel\common\script_values\zzz_pm_rehaul_subsidy_values.txt" (($sv -join "`n") + "`n") $bom
        Write-Output "ai subsidies: merchant-marine share values emitted (retire_share $share, coefficients $((@($portInd.tiers | ForEach-Object { $_.output_qty })) -join '/'))"
    }
}
# Read ai_strategy_default's OWN subsidies live from vanilla (we deliberately do NOT own that file - it is a
# single ~8790-line block covering the whole AI: wargoals, navy/army sizes, treaties, infamy, interest groups.
# Owning it to change one field would freeze all of that against every future patch). We only READ its trio so
# the restatement stays in sync automatically instead of being hardcoded here.
$SUBSIDY_TRIO = [ordered]@{}
$srcDef = Join-Path $Game 'common\ai_strategies\00_default_strategy.txt'
if (Test-Path -LiteralPath $srcDef) {
    $defLines = Get-Content -LiteralPath $srcDef
    $dBlk = New-Object System.Collections.Generic.List[string]; $dd = 0; $started = $false
    foreach ($l in $defLines) {
        if (-not $started) { if ($l -match '^ai_strategy_default\s*=\s*\{') { $started = $true } else { continue } }
        $dd += ([regex]::Matches($l,'\{')).Count - ([regex]::Matches($l,'\}')).Count
        $dBlk.Add($l)
        if ($started -and $dd -le 0) { break }
    }
    $SUBSIDY_TRIO = Get-SubsidyEntries $dBlk
}
if ($SUBSIDY_TRIO.Count -eq 0) {
    Write-Output "note: could not read ai_strategy_default's subsidies from vanilla - typed strategies will carry only their own entries + our overrides"
}
$relAI    = 'common\ai_strategies\01_admin_strategies.txt'
$srcAI    = Join-Path $Game $relAI
if (-not (Test-Path -LiteralPath $srcAI)) {
    Write-Output "note: $relAI not found in game - skipping AI subsidy emission (subsidy policy will stay vanilla)"
} else {
    $aiLines = Get-Content -LiteralPath $srcAI
    $aOut = New-Object System.Collections.Generic.List[string]
    $condLoc = New-Object System.Collections.Generic.List[string]   # conditional-subsidy variant names -> loc
    $aOut.Add($genHeader.TrimEnd())
    $touched = 0; $i = 0
    while ($i -lt $aiLines.Count) {
        $line = $aiLines[$i]
        if ($line -match '^(ai_strategy_[A-Za-z0-9_]+)\s*=\s*\{') {
            $blk = New-Object System.Collections.Generic.List[string]; $depth = 0
            do {
                $l = $aiLines[$i]
                $depth += ([regex]::Matches($l,'\{')).Count - ([regex]::Matches($l,'\}')).Count
                $blk.Add($l); $i++
            } while ($i -lt $aiLines.Count -and $depth -gt 0)
            # only administrative strategies carry economy policy; leave any other type verbatim
            if (($blk -join "`n") -match '(?m)^\s*type\s*=\s*administrative\s*$') {
                $hadBlock = Test-HasSubsidyBlock $blk
                $ent = Get-SubsidyEntries $blk                                   # this strategy's vanilla entries
                # Seed ai_strategy_default's entries ONLY into strategies that had NO subsidies block of their
                # own. A strategy that HAS one is authoritative: under REPLACE semantics whatever it omits was
                # omitted deliberately (vanilla fine-tuning), and under MERGE semantics the default supplies the
                # rest anyway - so restating there would invent subsidies vanilla never granted. A strategy with
                # NO block only becomes replace-exposed because WE add one, so there we must restate to keep
                # vanilla behaviour intact. Correct under both readings, and never overrides a tuned value.
                if (-not $hadBlock) {
                    foreach ($k in $SUBSIDY_TRIO.Keys) { if (-not $ent.Contains($k)) { $ent[$k] = $SUBSIDY_TRIO[$k] } }
                }
                foreach ($k in $subMap.Keys) {                                   # user overrides win
                    if ($subMap[$k] -eq 'none') { if ($ent.Contains($k)) { $ent.Remove($k) } }
                    else { $ent[$k] = $subMap[$k] }
                }
                # helper: rebuild this strategy block with a given subsidies map, a given name suffix,
                # and an extra clause AND-composed into `possible` (inserted right after `possible = {`,
                # or as a fresh possible block when the strategy had none - industrial_expansion's case).
                $emitVariant = {
                    param($entMap, $suffix, $possibleClause)
                    $body = Remove-SubsidyBlock $blk
                    $new  = New-Object System.Collections.Generic.List[string]
                    $hdr  = $body[0]
                    if ($suffix) { $hdr = $hdr -replace '^(ai_strategy_[A-Za-z0-9_]+)', ('$1' + $suffix) }
                    # collect variant names for loc ($condLoc defined before the file loop): a variant
                    # with no loc shows its raw key in every AI tooltip that names the strategy.
                    if ($suffix -and $hdr -match '^(ai_strategy_[A-Za-z0-9_]+)') { $condLoc.Add($Matches[1]) }
                    $new.Add($hdr)
                    $new.Add("`tsubsidies = {")
                    foreach ($k in $entMap.Keys) { $new.Add("`t`t$k = $($entMap[$k])") }
                    $new.Add("`t}")
                    $hasPossible = ($body | Where-Object { $_ -match '^\s*possible\s*=\s*\{' }) -ne $null
                    if ($possibleClause -and -not $hasPossible) {
                        $new.Add("`tpossible = {")
                        foreach ($cl in $possibleClause) { $new.Add("`t`t$cl") }
                        $new.Add("`t}")
                    }
                    $injected = $false
                    for ($j = 1; $j -lt $body.Count; $j++) {
                        $new.Add($body[$j])
                        if ($possibleClause -and -not $injected -and $body[$j] -match '^\s*possible\s*=\s*\{') {
                            foreach ($cl in $possibleClause) { $new.Add("`t`t$cl") }
                            $injected = $true
                        }
                    }
                    return $new
                }
                if ($subCond) {
                    $applyOv = {
                        param($base, $ov)
                        $m = [ordered]@{}
                        foreach ($k in $base.Keys) { $m[$k] = $base[$k] }
                        foreach ($p in $ov.PSObject.Properties) {
                            if ([string]$p.Value -eq 'none') { if ($m.Contains($p.Name)) { $m.Remove($p.Name) } }
                            else { $m[$p.Name] = [string]$p.Value }
                        }
                        return $m
                    }
                    # The possible clauses PARTITION: (exempt) / (not exempt AND not retired) /
                    # (not exempt AND retired) - exactly one variant is available at any time, so an
                    # AI that re-evaluates must land somewhere and the always-available guarantee holds.
                    $notRetire = @('NOT = {', "`t$($subCond.retire_trigger)", '}')
                    if ($subCond.exempt_trigger) {
                        $notExempt = @('NOT = {', "`t$($subCond.exempt_trigger)", '}')
                        # EXEMPT (in someone else's market): no mandate ever
                        foreach ($nl in (& $emitVariant (& $applyOv $ent $subCond.exempt_overrides) '_pmr_ext' @($subCond.exempt_trigger))) { $aOut.Add($nl) }
                        # BASE (own market, retire condition not met): the mandate
                        foreach ($nl in (& $emitVariant $ent '' ($notExempt + $notRetire))) { $aOut.Add($nl) }
                        # MATURE (own market, retire condition met): mandate retired
                        foreach ($nl in (& $emitVariant (& $applyOv $ent $subCond.retire_overrides) '_pmr_mature' ($notExempt + @($subCond.retire_trigger)))) { $aOut.Add($nl) }
                    } else {
                        foreach ($nl in (& $emitVariant $ent '' $notRetire)) { $aOut.Add($nl) }
                        foreach ($nl in (& $emitVariant (& $applyOv $ent $subCond.retire_overrides) '_pmr_mature' @($subCond.retire_trigger))) { $aOut.Add($nl) }
                    }
                } else {
                    foreach ($nl in (& $emitVariant $ent '' $null)) { $aOut.Add($nl) }
                }
                $touched++
            } else { foreach ($bl in $blk) { $aOut.Add($bl) } }
        } else { $aOut.Add($line); $i++ }
    }
    WriteText "$modRel\$relAI" (($aOut -join "`n") + "`n") $bom
    if ($subCond -and $condLoc.Count) {
        # Variant strategies DISPLAY AS THEIR BASE via loc $key$ references (vanilla's own idiom —
        # diplomacy_l_english.yml does exactly this): the variants are policy STATES of one strategy,
        # and a renamed strategy in an AI tooltip would read as new content.
        foreach ($vn in ($condLoc | Select-Object -Unique)) {
            $bn = $vn -replace '_pmr_(mature|ext)$', ''
            $locBody += " ${vn}:0 `"$D$bn$D`""
            $locBody += " ${vn}_desc:0 `"$D${bn}_desc$D`""
        }
    }
    $setList  = if ($subMap.Count) { ($subMap.Keys | Sort-Object | ForEach-Object { "$_=$($subMap[$_])" }) -join ', ' } else { '(none - vanilla policy)' }
    $trioList = if ($SUBSIDY_TRIO.Count) { ($SUBSIDY_TRIO.Keys | ForEach-Object { "$_=$($SUBSIDY_TRIO[$_])" }) -join ', ' } else { '(none)' }
    Write-Output "ai subsidies: rewrote $touched administrative strategies; overrides: $setList"
    Write-Output "ai subsidies: default-strategy trio read live from vanilla: $trioList"
    if ($subCond) {
        $retList = ($subCond.retire_overrides.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ', '
        Write-Output "ai subsidies: CONDITIONAL variants emitted ($touched pairs, mutually exclusive possible); retire -> $retList; trigger: $($subCond.retire_trigger)"
    }
}

# --- own EVERY production_methods file: three surgical transforms, everything else verbatim ---
#   (1) GATE REMAP: append our tier pm_key to each `unlocking_production_methods` list that references a
#       split vanilla main PM (map vanilla_pm -> pm_key), so gated secondaries (bone china, elastics,
#       precision tools) unlock at the right tier again (they were locked by the main-PM rename).
#   (2) GOODS OVERRIDE (config `pm_goods`): the override REPLACES the PM's goods wholesale — every
#       goods_input/output_*_add line is dropped and the override's inputs+outputs written into
#       `building_modifiers -> workforce_scaled`. ⚠ REPLACEMENT, not per-line requantify: ui/econ.js's
#       pmRec() has always read an override as the whole recipe (`in: o.in || v.in`), and the electricity
#       pass (§10.43) is exactly a case that ADDS a good (coal) and REMOVES one (the electricity input) —
#       the old quantity-rewrite writer would have shipped a mod disagreeing with the model on both.
#       A `required_input_goods = g` line is dropped when g is no longer among the override's inputs
#       (pm_electric_streetlights required electricity-in-market — a deadlock once the PM PRODUCES it).
#   (3) EMPLOYMENT OVERRIDE (config `pm_employment`, pm -> {profession: count}): same replacement
#       semantics for the crew — every building_employment_*_add line is dropped and the override written
#       into `building_modifiers -> level_scaled`. This is the per-PM employment override the electricity
#       pass needed (laborers -> engineers on the streetlights method); the model reads it via
#       REFEDIT[pm].emp (host) / REFEMP (browser).
#       Both overrides THROW if the PM lacks the target sub-block — a silently skipped override is the
#       landmine class (nothing fails, the mod diverges from the model).
# This makes EVERY PM's goods/crew editable & emittable WITHOUT owning any building file — buildings
# reference PMs by key, so all buildings pick up the edit. Default (no override) = verbatim copy.
# The BE linter reads vanilla + our zzz (not these owned copies), so it's unaffected. The negative-goods
# linter (lint_negative_goods.awk) DOES read these owned copies, so it checks pm_goods overrides.
$script:pmRemap = @{}
foreach ($ind in $cfg.industries) { if ($ind.disabled) { continue }; foreach ($t in $ind.tiers) { if ($t.vanilla_pm) { $script:pmRemap[$t.vanilla_pm] = $t.pm_key } } }
$gateEval = [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    $toks = @([regex]::Matches($m.Groups[1].Value, 'pm_[A-Za-z0-9_-]+') | ForEach-Object { $_.Value })
    $adds = @()
    foreach ($tk in $toks) { if ($script:pmRemap.ContainsKey($tk)) { $mapped = $script:pmRemap[$tk]; if (($toks -notcontains $mapped) -and ($adds -notcontains $mapped)) { $adds += $mapped } } }
    if ($adds.Count -eq 0) { return $m.Value }
    "unlocking_production_methods = {`n" + ((@($toks) + $adds | ForEach-Object { "`t`t$_" }) -join "`n") + "`n`t}"
}
# Write a goods quantity the way the game reads it: invariant decimal point, no trailing ".0" on whole
# numbers (a comma separator from a non-English locale would be a parse error in V3 script).
function Format-Qty($v) {
    $d = [double]$v
    if ($d -eq [math]::Truncate($d)) { return ([int]$d).ToString([System.Globalization.CultureInfo]::InvariantCulture) }
    return $d.ToString('0.####', [System.Globalization.CultureInfo]::InvariantCulture)
}
# goods-override lookup: pm -> @{ in=[ordered]@{good=qty}; out=[ordered]@{good=qty} } (config order kept)
$pmGoods = @{}
if ($cfg.pm_goods) { foreach ($p in $cfg.pm_goods.PSObject.Properties) {
    $ov = @{ in = [ordered]@{}; out = [ordered]@{} }
    # Quantities are NOT always integers — vanilla's subsistence / urban-centre / agro PMs use fractions
    # (grain 1.0, fabric 0.5, meat 0.33). Keep them as doubles and write them back with INVARIANT
    # culture, or a comma decimal separator on a non-English Windows would emit invalid script.
    if ($p.Value.in)  { foreach ($g in $p.Value.in.PSObject.Properties)  { $ov.in[$g.Name]  = [double]$g.Value } }
    if ($p.Value.out) { foreach ($g in $p.Value.out.PSObject.Properties) { $ov.out[$g.Name] = [double]$g.Value } }
    $pmGoods[$p.Name] = $ov
} }
# employment-override lookup: pm -> [ordered]@{ profession = count }
$pmEmp = @{}
if ($cfg.pm_employment) { foreach ($p in $cfg.pm_employment.PSObject.Properties) {
    $ov = [ordered]@{}
    foreach ($e in $p.Value.PSObject.Properties) { $ov[$e.Name] = [double]$e.Value }
    $pmEmp[$p.Name] = $ov
} }
# Rewrite ONE overridden PM's block (replacement semantics; see the header comment above). $blk is the
# block's lines, header line included; returns the new lines. Throws when the PM cannot carry the
# override, because a silently skipped override ships a mod that disagrees with the model.
function Convert-PmBlock([System.Collections.Generic.List[string]]$blk, [string]$pmName, $goodsOv, $empOv) {
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($ln in $blk) {
        if ($goodsOv -and $ln -match '^\s*goods_(input|output)_[a-z_]+_add\s*=') { continue }
        if ($empOv   -and $ln -match '^\s*building_employment_[a-z_]+_add\s*=')  { continue }
        if ($goodsOv -and $ln -match '^\s*required_input_goods\s*=\s*([a-z_]+)') {
            if (-not $goodsOv.in.Contains($Matches[1])) { continue }   # no longer an input => the gate would deadlock
        }
        $out.Add($ln)
    }
    # locate `building_modifiers = {` and its extent, then the target sub-block(s) INSIDE it — the file
    # also has workforce_scaled under state_modifiers, so anchoring on the sub-block name alone is wrong
    $bmIx = -1
    for ($k = 0; $k -lt $out.Count; $k++) { if ($out[$k] -match '^\s*building_modifiers\s*=\s*\{') { $bmIx = $k; break } }
    if ($bmIx -lt 0) { throw "pm override: $pmName has no building_modifiers block - cannot apply the override" }
    $depth = 0; $bmEnd = $out.Count - 1
    for ($k = $bmIx; $k -lt $out.Count; $k++) {
        $depth += ([regex]::Matches($out[$k], '\{')).Count - ([regex]::Matches($out[$k], '\}')).Count
        if ($k -gt $bmIx -and $depth -le 0) { $bmEnd = $k; break }
    }
    $insertInto = {
        param($subRe, $mkLines, $what)
        $ix = -1
        for ($k = $bmIx + 1; $k -lt $bmEnd; $k++) { if ($out[$k] -match $subRe) { $ix = $k; break } }
        if ($ix -lt 0) { throw "pm override: $pmName has no $what block inside building_modifiers - cannot apply the override" }
        $indent = ([regex]::Match($out[$ix], '^\s*')).Value + "`t"
        # @( ) is load-bearing: a one-line override comes back as a bare STRING (PowerShell unwraps
        # single-element arrays), and indexing a string yields CHARACTERS — the emitted block then holds
        # one tab instead of the employment line, silently.
        $new = @(& $mkLines $indent)
        for ($n = $new.Count - 1; $n -ge 0; $n--) { $out.Insert($ix + 1, $new[$n]) }
    }
    if ($goodsOv) {
        & $insertInto '^\s*workforce_scaled\s*=\s*\{' {
            param($ind)
            $l = @()
            foreach ($g in $goodsOv.in.Keys)  { $l += "${ind}goods_input_${g}_add = $(Format-Qty $goodsOv.in[$g])" }
            foreach ($g in $goodsOv.out.Keys) { $l += "${ind}goods_output_${g}_add = $(Format-Qty $goodsOv.out[$g])" }
            return $l
        } 'workforce_scaled'
        # indices moved; refresh building_modifiers extent for a following employment insert
        $depth = 0; $bmEnd = $out.Count - 1
        for ($k = $bmIx; $k -lt $out.Count; $k++) {
            $depth += ([regex]::Matches($out[$k], '\{')).Count - ([regex]::Matches($out[$k], '\}')).Count
            if ($k -gt $bmIx -and $depth -le 0) { $bmEnd = $k; break }
        }
    }
    if ($empOv) {
        & $insertInto '^\s*level_scaled\s*=\s*\{' {
            param($ind)
            $l = @()
            foreach ($pr in $empOv.Keys) { $l += "${ind}building_employment_${pr}_add = $(Format-Qty $empOv[$pr])" }
            return $l
        } 'level_scaled'
    }
    return $out
}
# ONLY files we actually CHANGE are emitted. A file we own but copy verbatim is pure downside: it
# freezes that vanilla file against every future patch, ships bytes we did not author, and buys
# nothing (an unwritten file simply stays vanilla). Today only 01_industry.txt changes (the gate
# remap); with an empty pm_goods map the other 14 were byte-identical copies.
$pmEmitted = @(); $pmSkipped = 0; $pmOverridden = New-Object System.Collections.Generic.HashSet[string]
foreach ($pf in (Get-ChildItem (Join-Path $Game 'common\production_methods') -Filter *.txt)) {
    $orig = [System.IO.File]::ReadAllText($pf.FullName)
    $txt = [regex]::Replace($orig, 'unlocking_production_methods\s*=\s*\{([^{}]*)\}', $gateEval)
    if ($pmGoods.Count -gt 0 -or $pmEmp.Count -gt 0) {
        $lines = $txt -split "`r?`n"; $touched = $false
        $outL = New-Object System.Collections.Generic.List[string]
        $k = 0
        while ($k -lt $lines.Count) {
            $line = $lines[$k]
            # PM headers are top-level (column 0) in a production_methods file; names are NOT all pm_-prefixed
            # (plantations/farms use default_/automatic_/worker_/… , e.g. default_building_cotton_plantation).
            if ($line -match '^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{' -and ($pmGoods.ContainsKey($Matches[1]) -or $pmEmp.ContainsKey($Matches[1]))) {
                $name = $Matches[1]
                $blk = New-Object System.Collections.Generic.List[string]
                $depth = 0
                do {
                    $depth += ([regex]::Matches($lines[$k], '\{')).Count - ([regex]::Matches($lines[$k], '\}')).Count
                    $blk.Add($lines[$k]); $k++
                } while ($k -lt $lines.Count -and $depth -gt 0)
                foreach ($nl in (Convert-PmBlock $blk $name $pmGoods[$name] $pmEmp[$name])) { $outL.Add($nl) }
                [void]$pmOverridden.Add($name)
                $touched = $true
                continue
            }
            $outL.Add($line); $k++
        }
        if ($touched) { $txt = $outL -join "`n" }
    }
    if ($txt -ceq $orig) { $pmSkipped++; continue }   # unchanged => do not own it
    WriteText "$modRel\common\production_methods\$($pf.Name)" $txt $bom
    $pmEmitted += $pf.Name
}
# an override naming a PM no vanilla file defines would otherwise vanish without a trace — the exact
# "nothing fails" class TESTBED_LANDMINES exists for
foreach ($pm in @($pmGoods.Keys) + @($pmEmp.Keys) | Select-Object -Unique) {
    if (-not $pmOverridden.Contains($pm)) { throw "pm_goods/pm_employment override names '$pm', which no vanilla production_methods file defines" }
}
Write-Output ("production_methods: owning {0} file(s) [{1}]; {2} left vanilla (unchanged); {3} PM override(s) applied" -f $pmEmitted.Count, ($pmEmitted -join ', '), $pmSkipped, $pmOverridden.Count)

# --- localization for every language (UTF-8 WITH BOM), in a replace/ folder so our building-name
#     overrides win over vanilla (and new keys are still defined) ---
$base = $cfg.loc_basename
foreach ($lang in $cfg.languages) {
    $content = "l_${lang}:`n" + "# AUTO-GENERATED by tools/build.ps1 - do not edit by hand. English strings are used as stubs for all languages.`n" + (($locBody -join "`n")) + "`n"
    WriteText "$modRel\localization\$lang\replace\${base}_l_${lang}.yml" $content $bom
}

# --- self-diagnostic on_action (dev convention; see MODDING_NOTES → Self-diagnostics) -------------------
# Fires at game start. We only ADD an `on_actions = { }` reference to the vanilla on_action (its effect
# block is untouched - per common/on_actions/_on_actions.md), so it can't break vanilla game-start.
# Read the results in Documents/Paradox Interactive/Victoria 3/logs/debug.log (search PM_TECH_REHAUL);
# an absent init marker => the mod failed to load (check error.log). Add invariant tripwires inside
# pm_tech_rehaul_diag whenever a risky change might trip - log "PM_TECH_REHAUL WARN: ..." on failure.
$diagTs = Get-Date -Format 'yyyy-MM-dd HH:mm'
$diag = @(
    $genHeader.TrimEnd(), "",
    "on_game_started_after_lobby = {",
    "`ton_actions = { pm_tech_rehaul_diag }",
    "}", "",
    "pm_tech_rehaul_diag = {",
    "`teffect = {",
    "`t`tdebug_log = `"PM_TECH_REHAUL: init OK - mod loaded, game started (build $diagTs) on [TimeKeeper.GetCurrentDate.GetString]`"",
    "`t`t# --- invariant tripwires: add checks for risky changes; log PM_TECH_REHAUL WARN on failure ---",
    "`t}",
    "}"
)
WriteText "$modRel\common\on_actions\zzz_pm_rehaul_diag.txt" (($diag -join "`n") + "`n") $bom

# testbed telemetry, from the same generator the control arm uses
if ($telemetryOn) {
    WriteText "$modRel\common\on_actions\zzz_v3tb_telemetry.txt" $telemetryText $bom
    WriteText "$modRel\common\script_values\zzz_v3tb_values.txt" $telemetryValues $bom
    if ($telemetryProbeValues) { WriteText "$modRel\common\script_values\zzz_v3tb_probe_values.txt" $telemetryProbeValues $bom }
    if ($telemetryEvents) { WriteText "$modRel\events\zzz_v3tb_probe.txt" $telemetryEvents $bom }
    Write-Output "telemetry: dump $($telemetrySpec.dump_dates -join ', ') for $($telemetrySpec.tags -join '+') [$($telemetrySpec.metrics -join ', ')]"
}

# --- THE INDUSTRY TECH TREE (ROADMAP step 1) -----------------------------------------------------
# Delegated to Node because the tree is authored as JSON (config/tech_tree_options.json, generated by
# tools/tech_tree_spec.mjs) and every vanilla transform it performs is a text surgery that THROWS when
# its anchor is missing. Keeping it there rather than restating the design here means there is one
# definition of the tree, not two.
# ⚠⚠ $cfgPath IS NOT OPTIONAL HERE. Both emitters used to read config/mod_config.json directly while
# every other step received -Config, so `build.ps1 -Config <alt>` emitted the alternate config's
# BUILDINGS beside the canonical config's TECHNOLOGIES and RESEARCH EVENTS. See BUGS_AND_FIXES
# (2026-08-12) - it was caught one run before it would have voided an overnight batch.
# ⚠⚠ THE 1836 BASELINE IS REFRESHED FIRST, AND THE ORDER IS LOAD-BEARING. `emit_techs` derives the 1836
# starting-technology grant from `config/start_baseline.json` — which country of which starting tier owns
# which tier building on the map — so a baseline written LATER in the build would make this build's grant
# a function of the PREVIOUS build's map. That is the stale-read shape this repo has been bitten by twice
# (econ_host reading ui/data.js; the solvers' write->read loop). extract_start reads vanilla history plus
# the config and depends on nothing emit_techs writes, so moving it up is free.
# ⚠ It rewrites the repo-tracked config/start_baseline.json, so alternate targets (-DryRun/-SaveTo) skip
# it and emit_techs falls back to the committed copy — correct, since an alt build must never write repo
# files, and landmine L14 still fails the build if the grant it derives is wrong.
if (-not $isAlt) { & (Join-Path $PSScriptRoot 'extract_start.ps1') -Repo $repo -Config $cfgPath }
& node (Join-Path $PSScriptRoot 'emit_techs.mjs') $modAbs $cfgPath
if ($LASTEXITCODE -ne 0) { throw "emit_techs.mjs failed (exit $LASTEXITCODE) - the mod would ship without its technologies." }

# --- INDUSTRY-DRIVEN RESEARCH EVENTS (ROADMAP step 2) --------------------------------------------
# Reads config/mod_config.json's `research_events` block and emits nothing at all when it is
# disabled. That is what makes `techs` and `techs+events` two CONFIG VARIANTS of one builder rather
# than a build flag (user ruling 2026-08-11), so the arm is expressible as {kind: config, config: X}
# and is recorded in build_state.json without touching the harness.
& node (Join-Path $PSScriptRoot 'emit_research_events.mjs') $modAbs $cfgPath
if ($LASTEXITCODE -ne 0) { throw "emit_research_events.mjs failed (exit $LASTEXITCODE) - the mod would ship without its research events." }

# --- emit UI data (consumed by ui/builder.html) so the editor always reflects the latest config ---
# Only the canonical build repoints the UI; alternate builds (-DryRun/-SaveTo) leave ui/data.js alone.
if (-not $isAlt) {
    # $cfgFull, not $cfg: the UI models the WHOLE five-era ladder, including the model_only tiers the
    # emission path above deliberately dropped.
    # THE TECHNOLOGY INDEX. A tier's `tech` is the MOD's unlocking technology (tech_tree_spec.mjs stamps
    # it into the config), and "which technology, and in which era" is the question the sheet is asked
    # about every building — so the sheet needs a name and an era per technology, not a bare key.
    # A COMPACT INDEX, not the tree: ui/techdata.js is ~340 KB and is the TREE PAGE's data. This is the
    # SHIPPING option's per-technology facts only (~20 KB), because a lookup table is what the sheet
    # needs and loading the whole tree twice is not.
    # ⚠ It is the SHIPPING option — the same one emit_techs.mjs writes into the mod — so the sheet can
    # never show a technology from a candidate tree the game does not have.
    $techIdx = [ordered]@{}
    $ttoPath = Join-Path $repo 'config\tech_tree_options.json'
    if (Test-Path $ttoPath) {
        $tto = Get-Content $ttoPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $ship = $tto.options | Where-Object { $_.ships } | Select-Object -First 1
        if (-not $ship) { $ship = $tto.options[0] }
        foreach ($t in $ship.techs) {
            $techIdx[$t.id] = [ordered]@{ n = $t.name; e = $t.era; c = $t.category; o = $t.origin; y = $t.onset }
        }
    }
    # start_exceptions rides along so the UI's Mod-changes page can ENUMERATE the 1836 start rules
    # rather than point at the file; `generated` (UTC, stated) lets the page say how old this copy is
    # when the live /api/config fetch is unavailable (standalone snapshot, file:// open).
    $sxPath = Join-Path $repo 'config\start_exceptions.json'
    $startExJson = if (Test-Path $sxPath) { (Get-Content $sxPath -Raw -Encoding UTF8 | ConvertFrom-Json) | ConvertTo-Json -Depth 10 } else { 'null' }
    $uiData = "// AUTO-GENERATED by tools/build.ps1 - the balance UI reads this.`n" +
              "window.PMDATA = {`n  generated: `"" + [DateTime]::UtcNow.ToString('yyyy-MM-dd, HH:mm') + " UTC`"" +
              ",`n  config: " + ($cfgFull | ConvertTo-Json -Depth 20) + ",`n  prices: " + ($prices | ConvertTo-Json) +
              ",`n  techs: " + ($techIdx | ConvertTo-Json -Depth 4 -Compress) +
              ",`n  start_exceptions: " + $startExJson + "`n};`n"
    WriteText 'ui\data.js' $uiData $noBom
    # vanilla.js: full building/PMG/PM reference so the UI ALWAYS shows every building, tiered or
    # not. Re-derived from the live game each build.
    & (Join-Path $PSScriptRoot 'extract_vanilla.ps1') -Repo $repo -Game $Game
    # icons.js: goods pictograms for the scenario panel. UI-only and .gitignore'd (game art is never
    # committed or shipped); if it's missing the UI simply renders without pictograms.
    & (Join-Path $PSScriptRoot 'extract_icons.ps1') -Repo $repo -Game $Game
    # presets.js: the scenario panel's one-click market presets (vanilla 1836 per country market) +
    # the pop consumption tables they need. Derived from the live game, so a patch refreshes them here.
    & (Join-Path $PSScriptRoot 'extract_presets.ps1') -Repo $repo -Game $Game -Config $cfgPath
}

# --- report ---
Write-Output ("Generated {0} tier buildings across {1} industries; localization in {2} languages." -f $summary.Count, $cfg.industries.Count, $cfg.languages.Count)
$summary | Format-Table -AutoSize | Out-String | Write-Output

# --- convert the 1836 start (the baseline it reads was refreshed BEFORE emit_techs, above) ---
& (Join-Path $PSScriptRoot 'convert_history.ps1') -Repo $repo -Config $cfgPath -ModDir $modRel

if (-not $NoLint) {
    $bashPath = $null
    $cmd = Get-Command bash -ErrorAction SilentlyContinue
    if ($cmd) { $bashPath = $cmd.Source }
    else {
        foreach ($p in @("$env:ProgramFiles\Git\bin\bash.exe", "${env:ProgramFiles(x86)}\Git\bin\bash.exe", "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe")) {
            if (Test-Path $p) { $bashPath = $p; break }
        }
    }
    if ($bashPath) {
        Write-Output "Running linter..."
        $env:PM_MOD_DIR = $modRel      # tell lint.sh which mod folder to read (default 'mod')
        $env:PM_LADDER  = $ladderPath  # ...and which tier map to lint against (temp copy for alt builds)
        try { & $bashPath (Join-Path $repo 'tools/lint.sh') }
        finally { Remove-Item Env:\PM_MOD_DIR, Env:\PM_LADDER -ErrorAction SilentlyContinue }
    } else {
        Write-Output "bash (Git Bash) not found - run the linter separately:  bash tools/lint.sh"
    }

    # --- L18: THE SOLVENCY LINTER (BALANCE_FRAMEWORK 10.63) -----------------------------------------
    # Every tier's BASE production method must be able to break even at SOME price inside the engine's
    # own 25-175% band: target BE <= 175, wages included. A tier that cannot is unsellable at any price
    # the market can produce, and nothing else notices - which is exactly why F67 survived for months.
    # DELIBERATELY SEPARATE from lint.sh's BE check, for the two reasons that let F67 through: that
    # check reads ladder_tiers.txt, which EXCLUDES no_mass_be industries (port, railway, power - three
    # of the six sub-1 tiers), and its test is CIRCULAR, comparing a recipe against a target_be the
    # solver restates FROM that recipe. This one recomputes from the goods block and reads nothing else.
    $solvLint = Join-Path $repo 'tools/lint_solvency.mjs'
    if (Test-Path $solvLint) {
        Write-Output "Running solvency linter (L18)..."
        & node $solvLint --config $cfgPath
        if ($LASTEXITCODE -ne 0) { throw "SOLVENCY LINT FAILED (L18): a tier cannot break even at any price in the engine's 25-175% band. See BALANCE_FRAMEWORK 10.63." }
    } else {
        Write-Output "WARN: tools/lint_solvency.mjs missing - L18 not checked"
    }
}
# alt builds used a throwaway ladder in TEMP; remove it now that the linter is done with it.
if ($isAlt -and $ladderPath -and (Test-Path $ladderPath)) { Remove-Item $ladderPath -Force -ErrorAction SilentlyContinue }

# --- stamp the build time into the mod NAME so it's obvious in the launcher which build is loaded ---
$metaPath = Join-Path $modAbs '.metadata\metadata.json'
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm'
$meta = Get-Content $metaPath -Raw
$meta = [regex]::Replace($meta, '("name"\s*:\s*"[^"]*?)\s*\(built[^)]*\)(")', '${1}${2}')          # strip any prior "(built ...)"
$meta = [regex]::Replace($meta, '("name"\s*:\s*"[^"]*)(")', ('${1} (built ' + $ts + ')${2}'))       # append fresh timestamp
[System.IO.File]::WriteAllText($metaPath, $meta, $noBom)
Write-Output "Build timestamp: $ts (mod name)"

# --- post-build checks on the FINISHED mod (the dry-run guarantee; also guards deploy) ---
$problems = Invoke-ModChecks $modAbs $cfg
if ($problems.Count -gt 0) {
    Write-Output "MOD CHECKS FAILED for ${modRel}:"
    $problems | ForEach-Object { Write-Output "  - $_" }
    if ($DryRun) { Remove-Item $modAbs -Recurse -Force -ErrorAction SilentlyContinue; Write-Output "Dry-run folder deleted." }
    throw "Post-build mod checks failed ($($problems.Count) problem(s))."
}
Write-Output "MOD CHECKS PASSED: $modRel is a complete build."

# --- PREFLIGHT: walk TESTBED_LANDMINES.md against what we just emitted ---
# Invoke-ModChecks answers "is this build COMPLETE". Preflight answers "does this build carry a known
# landmine" - the failures where nothing fails: a c:TAG that errors half a million times once its
# country is annexed, a script value that reads zero instead of erroring, telemetry that changed
# without a schema bump. Those are invisible to every other check we run, which is why this one
# throws rather than warns. -NoPreflight exists for a broken detector, not for a hurry.
if (-not $NoPreflight) {
    & (Join-Path $PSScriptRoot 'preflight.ps1') -Mod $modAbs -Config $cfgPath -Quiet
    if ($LASTEXITCODE -ne 0) {
        $global:LASTEXITCODE = 0
        if ($DryRun) { Remove-Item $modAbs -Recurse -Force -ErrorAction SilentlyContinue; Write-Output "Dry-run folder deleted." }
        throw "PREFLIGHT FAILED - see the landmine IDs above and TESTBED_LANDMINES.md. Override with -NoPreflight only if the DETECTOR is wrong."
    }
    $global:LASTEXITCODE = 0
}

# --- dry run: we proved a full build works; delete the throwaway folder and stop (never deploy) ---
if ($DryRun) {
    Remove-Item $modAbs -Recurse -Force
    Write-Output "DRY RUN OK: built + checked $modRel, then deleted it. Canonical mod/ untouched."
    return
}
# --- alternate save target: keep it, but never deploy (only the canonical mod/ deploys) ---
if ($SaveTo) {
    Write-Output "Saved alternate build -> $modRel (not deployed)."
    return
}

# --- deploy: mirror mod/ into the Paradox mod folder as a REAL copy ---
# The Paradox launcher does not traverse directory junctions (it reports the mod as ~48 bytes),
# so we deploy an actual copy. build.ps1 re-mirrors on every build, keeping iteration one command.
if (-not $NoDeploy) {
    $src  = Join-Path $repo 'mod'
    $dest = Join-Path $env:USERPROFILE 'Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul'
    if (Test-Path $dest) {
        $di = Get-Item $dest -Force
        if ($di.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            [System.IO.Directory]::Delete($dest, $false)   # remove old junction; write real files instead
        }
    }
    & robocopy $src $dest /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    $rc = $LASTEXITCODE; $global:LASTEXITCODE = 0
    if ($rc -ge 8) { Write-Warning "Deploy: robocopy reported errors (exit $rc)" }
    else { Write-Output "Deployed real copy -> $dest" }
}
