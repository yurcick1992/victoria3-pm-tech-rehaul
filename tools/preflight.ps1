<#
  preflight.ps1 - THE GUARDRAIL. Walks every entry in TESTBED_LANDMINES.md, one by one, against
  what was ACTUALLY EMITTED, and fails the build on any breach.

  WHY THIS EXISTS. The landmines in that register share one property: nothing fails. The run
  completes, the TSV looks right, the mod loads - and the damage (half a million error lines, a
  metric silently reading zero, a burst that evicts its own data from the log ring) is only
  visible to someone who thought to look. A rule written in a doc is read once; a check that
  throws is read every time. So the register holds the reasoning and this script holds the
  enforcement, and each entry here carries the ID it enforces.

  IT CHECKS THE ARTIFACT, NOT THE INTENT. Every detector reads the FILES THE BUILD EMITTED, not
  the generator's source or the flags it was handed - the same principle as verify_pms.mjs
  re-reading common/production_methods rather than our own extract. A generator bug cannot hide
  behind a checker that only reads the generator.

  USAGE
    powershell -ExecutionPolicy Bypass -File tools\preflight.ps1                 # checks mod\
    powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -Mod mod_foo    # an alt build
    powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -UpdateFingerprint
    powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -WarnOnly       # report, never throw
    powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -RepoOnly -Config config\mod_config.foo.json
    powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -RepoOnly -Only L20 -Config <cfg>

  Exit code 0 = every AUTO entry passed (or was N/A). 1 = at least one FAILED.

  ADDING A LANDMINE. Add the entry to TESTBED_LANDMINES.md first (it owns the story and the
  evidence), then add a Test-Lm* function here with the same ID and register it in $CHECKS below.
  An entry whose detector cannot be code stays MANUAL in the register and is walked by the
  `preflight` skill instead - but prefer code: a manual step is one an agent can skip.
#>

param(
    [string]$Mod,                       # built mod root to inspect; default <repo>\mod
    [switch]$UpdateFingerprint,         # rewrite tools\telemetry_fingerprint.json from current code (L8)
    [switch]$RepoOnly,                  # only the checks that need no built mod (for a pre-batch gate)
    [switch]$WarnOnly,                  # print the report but always exit 0
    [switch]$Quiet,                     # only print FAIL/WARN lines
    [string]$Session = '',              # a session folder to walk the POST-RUN entries against (L12)
    # L20: the config THIS BUILD IS ABOUT TO USE. build.ps1 already knows it and now passes it, which is
    # what turns L20 from a repo-wide WARN survey into a FAIL on the one config that matters.
    [string]$Config = '',
    # run only these landmine IDs (comma-separated). build.ps1 uses it for the EARLY L20 gate, so a
    # missing tech tree fails in two seconds instead of half-way through emission.
    [string]$Only = ''
)

# NOTE: deliberately NO Set-StrictMode. This script dot-sources telemetry_lib.ps1, which documents
# that it must not run under StrictMode (its callers' property tests break). Turning it on here
# would impose it on every function in that library.
$ErrorActionPreference = 'Stop'

$Repo = Split-Path $PSScriptRoot -Parent
if (-not $Mod) { $Mod = Join-Path $Repo 'mod' }
if (-not [System.IO.Path]::IsPathRooted($Mod)) { $Mod = Join-Path $Repo $Mod }

$FingerprintFile = Join-Path $PSScriptRoot 'telemetry_fingerprint.json'
$CONTROL_MOD_ID  = 'com.yurcick.v3_testbed_control'
$OVERLAY_MOD_ID  = 'com.yurcick.v3_testbed_overlay'

# L22 needs the VANILLA on_action names. Read live so a patch that adds one is covered without editing
# this file. ⚠ Every check that uses it must degrade to a documented fallback when the path is absent —
# preflight has to keep working on a machine without the game installed.
$GameDir = 'C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game'

# ⚠⚠ L14 AND L15 VERIFY *OUR OWN* 1836 TECHNOLOGY GRANT, WHICH ONLY A CONTENT ARM HAS.
# A control emits `.metadata` + telemetry and nothing else — that is CLAUDE.md's hard rule — so it
# carries no `common/scripted_effects/00_starting_inventions.txt`, and both detectors used to die on
# ENOENT reading it. That made `build.ps1 -ControlOnly` THROW, i.e. THE CONTROL ARM COULD NOT BE BUILT
# AT ALL from the moment L14/L15 were added (2026-08-12) until this was fixed (2026-08-13) — found by a
# 20-hour vanilla-vs-mod batch stalling on its first run, with the failure invisible because the
# scheduler's window swallowed it. The honest verdict for a control is N/A, exactly like L12 without
# -Session.
# ⚠ KEYED ON THE MOD'S OWN METADATA ID, NEVER ON THE FILE BEING ABSENT. "The grant file is missing" must
# stay a FAILURE for a content mod — that is precisely the fault L15 exists to catch — so the skip has to
# identify the ARM, not the symptom. Same mechanism L7 uses, and read off the BUILT mod so it cannot
# disagree with what loaded.
function Get-InstrumentArmSkip {
    $metaFile = Join-Path $Mod '.metadata\metadata.json'
    if (-not (Test-Path $metaFile)) { return $null }
    try { $meta = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
    if ($meta.id -eq $CONTROL_MOD_ID -or $meta.id -eq $OVERLAY_MOD_ID) {
        return "instrument arm (id: $($meta.id)) - emits no starting-inventions grant by design"
    }
    return $null
}

# --------------------------------------------------------------------------- reporting ----
$script:Results = @()
function Add-Result {
    param([string]$Id, [string]$Title, [string]$Status, [string]$Detail)
    $script:Results += [pscustomobject]@{ Id = $Id; Title = $Title; Status = $Status; Detail = $Detail }
}

# --------------------------------------------------------------------------- helpers ----
function Get-EmittedScriptFiles {
    <#
      The files that carry TRIGGERS AND EFFECTS - the only place a c:TAG comparison or a
      script-as-loc-string error can live. Buildings/PMs are data blocks and are covered by the
      two awk linters instead.
    #>
    param([string]$Root)
    $out = @()
    foreach ($rel in @('common\on_actions', 'events')) {
        $d = Join-Path $Root $rel
        if (Test-Path $d) { $out += @(Get-ChildItem $d -Filter *.txt -File -ErrorAction SilentlyContinue) }
    }
    return $out
}

function Remove-StringsAndComments {
    <#
      Everything a Jomini SCRIPT statement can be, with the loc strings taken out. A `c:GBR`
      inside the quoted text of a debug_log is a DATA FUNCTION, resolved by a different subsystem
      that fails differently (a loc-string data error, not `Invalid right side during comparison`),
      so L1 must not judge it - see the register's note on that limit.
    #>
    param([string]$Line)
    $s = [regex]::Replace($Line, '"[^"]*"', '""')
    return ($s -replace '#.*$', '')
}

# ============================================================== L1 ====
function Test-LmL1 {
    <#
      L1 - a named country tag with no existence guard.

      `c:TAG` on a country that no longer exists does NOT evaluate to false in Jomini; it raises
      `Invalid right side during comparison 'c'`. Tags valid at 1836 are routinely gone by 1900,
      so any metric that names countries starts erroring partway through a campaign and never
      stops. Measured: 574 455 error.log lines over one campaign, 48 659 naming our own telemetry
      (BUGS_AND_FIXES 2026-08-06).

      DETECTOR. Brace-depth scan. A tag USE is legal only if `exists = c:<that same tag>` was
      asserted in the block it sits in or in an enclosing one. Assertions are collected before
      uses on the same line, because the guarded idiom puts both on adjacent lines inside one
      block, and `limit = { exists = c:X }` opens and closes on its own line so it registers
      against the enclosing block - exactly where it applies.
    #>
    $files = Get-EmittedScriptFiles $Mod
    if (-not $files.Count) { Add-Result 'L1' 'named country tag has no exists guard' 'N/A' 'no on_actions/events emitted'; return }

    $bad = @()
    $locRefs = 0
    foreach ($f in $files) {
        $depth = 0
        $asserted = @{}      # depth -> @{TAG=$true}
        $n = 0
        foreach ($raw in ([System.IO.File]::ReadAllText($f.FullName) -split "`r?`n")) {
            $n++
            $locRefs += ([regex]::Matches($raw, '"[^"]*"') | ForEach-Object { ([regex]::Matches($_.Value, 'c:[A-Z]{3}')).Count } | Measure-Object -Sum).Sum
            $code = Remove-StringsAndComments $raw

            # 1. assertions made by this line, registered against the block the line sits in
            foreach ($m in [regex]::Matches($code, 'exists\s*=\s*c:([A-Za-z0-9_]+)')) {
                if (-not $asserted.ContainsKey($depth)) { $asserted[$depth] = @{} }
                $asserted[$depth][$m.Groups[1].Value] = $true
            }

            # 2. uses on this line that are not themselves the assertion
            $useLine = [regex]::Replace($code, 'exists\s*=\s*c:[A-Za-z0-9_]+', '')
            foreach ($m in [regex]::Matches($useLine, 'c:([A-Za-z0-9_]+)')) {
                $tag = $m.Groups[1].Value
                $ok = $false
                foreach ($d in $asserted.Keys) { if ($d -le $depth -and $asserted[$d].ContainsKey($tag)) { $ok = $true } }
                if (-not $ok) { $bad += "  $($f.Name):${n}: c:$tag unguarded -- $($raw.Trim())" }
            }

            # 3. depth, then forget assertions made in blocks that just closed
            $depth += ([regex]::Matches($code, '\{')).Count - ([regex]::Matches($code, '\}')).Count
            foreach ($d in @($asserted.Keys)) { if ($d -gt $depth) { $asserted.Remove($d) } }
        }
    }

    $note = "$locRefs tag reference(s) inside loc strings not judged (different subsystem - see register)"
    if ($bad.Count) {
        $shown = $bad | Select-Object -First 12
        $more = ''
        if ($bad.Count -gt 12) { $more = "`n  ... and $($bad.Count - 12) more" }
        Add-Result 'L1' 'named country tag has no exists guard' 'FAIL' `
            ("$($bad.Count) unguarded use(s). Guard each with `OR = { AND = { exists = c:X owner = c:X } ... }`, or filter on a property instead of identity.`n" + ($shown -join "`n") + $more)
    } else {
        Add-Result 'L1' 'named country tag has no exists guard' 'PASS' $note
    }
}

# ============================================================== L2 ====
function Test-LmL2 {
    <#
      L2 - a data function written as SCRIPT. Paradox abandons the file FROM THE ERROR ONWARD, so
      one bad `limit = { is_goods = GetGoods('grain') }` silently takes every dump defined below it.

      The detector already exists as Test-TelemetryScript in telemetry_lib.ps1 and runs on the
      generated TEXT at build time. Here it runs again over the EMITTED FILES, which is the check
      that survives someone bypassing the generator - and it is the same one implementation, so
      the two can never disagree.
    #>
    $files = Get-EmittedScriptFiles $Mod
    if (-not $files.Count) { Add-Result 'L2' 'data function used as script' 'N/A' 'no on_actions/events emitted'; return }
    . (Join-Path $PSScriptRoot 'telemetry_lib.ps1')
    $errs = @()
    foreach ($f in $files) {
        try { Test-TelemetryScript -Text ([System.IO.File]::ReadAllText($f.FullName)) -What $f.Name }
        catch { $errs += $_.Exception.Message }
    }
    if ($errs.Count) { Add-Result 'L2' 'data function used as script' 'FAIL' ($errs -join "`n") }
    else { Add-Result 'L2' 'data function used as script' 'PASS' "$($files.Count) file(s) clean" }
}

# ============================================================== L4 ====
function Test-LmL4 {
    <#
      L4 - two heavy sweeps in one tick.

      The game's log is a 5x512 KB ring shared by every run. One unphased dump was ~1.96 MB, i.e.
      78% of the whole ring, so segments rotated away before any poll could read them (6 015
      telemetry lines lost, measured). NO POLL RATE FIXES THIS - you cannot read a ring faster
      than it is destroyed. Phasing exists to spread the burst; stacking two heavy blocks on one
      date reintroduces it (origins on phase 0 with market goods: 5 980 of ~6 000 lines lost).

      DETECTOR IS ADVISORY, not a gate: how many lines a sweep produces depends on the campaign
      (how many markets exist in 1900), which is not knowable at build time. So this counts
      NESTED ITERATIONS - the shape that multiplies - per trigger date, and warns when a date
      carries more than one. A WARN here is a prompt to check the phasing, not a verdict.
    #>
    $tel = Join-Path $Mod 'common\on_actions\zzz_v3tb_telemetry.txt'
    if (-not (Test-Path $tel)) { Add-Result 'L4' 'two heavy sweeps in one tick' 'N/A' 'no telemetry emitted'; return }

    $heavyPat = 'every_market_goods|GetMarketBuyOrdersBreakdown|every_scope_building|every_scope_pop'
    $lines = [System.IO.File]::ReadAllText($tel) -split "`r?`n"
    $depth = 0; $cur = $null; $blocks = @()
    foreach ($raw in $lines) {
        $code = Remove-StringsAndComments $raw
        if ($depth -eq 0 -and $raw -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{') {
            $cur = [pscustomobject]@{ Name = $Matches[1]; Date = $null; Heavy = 0 }
            $blocks += $cur
        }
        if ($cur) {
            if ($raw -match 'game_date\s*>=\s*"([0-9.]+)"' -and -not $cur.Date) { $cur.Date = $Matches[1] }
            $cur.Heavy += ([regex]::Matches($raw, $heavyPat)).Count
        }
        $depth += ([regex]::Matches($code, '\{')).Count - ([regex]::Matches($code, '\}')).Count
        if ($depth -le 0) { $depth = 0; $cur = $null }
    }

    $clashes = @()
    foreach ($g in ($blocks | Where-Object { $_.Date -and $_.Heavy -gt 0 } | Group-Object Date)) {
        if ($g.Count -gt 1) { $clashes += "  $($g.Name): $(($g.Group | ForEach-Object { "$($_.Name)(x$($_.Heavy))" }) -join ' + ')" }
    }
    if ($clashes.Count) {
        Add-Result 'L4' 'two heavy sweeps in one tick' 'WARN' `
            ("$($clashes.Count) date(s) carry more than one nested sweep - check the phasing before a long run:`n" + ($clashes -join "`n"))
    } else {
        Add-Result 'L4' 'two heavy sweeps in one tick' 'PASS' "$(@($blocks | Where-Object { $_.Heavy -gt 0 }).Count) heavy block(s), none sharing a date"
    }
}

# ============================================================== L5 ====
function Test-LmL5 {
    <#
      L5 - a telemetry spec key the scheduler never passes on.

      run_schedule.ps1 rebuilds the per-run spec from an EXPLICIT key list. A key added to
      Read-TelemetrySpec but not to that list is silently dropped: it reaches neither the builder
      nor the mod, and the run then looks like the METRIC failed rather than the plumbing. That
      cost a probe run on 2026-08-05 (breakdown_dates, breakdown_tags, wide_dates, wide_tags all
      emitted nothing).

      DETECTOR. Every key Read-TelemetrySpec consumes must appear somewhere in run_schedule.ps1.
      Deliberately a mention test rather than a parse of its two hand-maintained key lists: the
      lists move around, and a key that appears NOWHERE in the scheduler is unambiguously dropped.
    #>
    $libSrc   = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'telemetry_lib.ps1'))
    $schedFile = Join-Path $PSScriptRoot 'testbed\run_schedule.ps1'
    if (-not (Test-Path $schedFile)) { Add-Result 'L5' 'spec key the scheduler drops' 'N/A' 'run_schedule.ps1 not found'; return }
    $schedSrc = [System.IO.File]::ReadAllText($schedFile)

    # keys consumed by Read-TelemetrySpec: the @( ... ) loop plus any explicitly-named property
    $keys = @()
    $m = [regex]::Match($libSrc, 'function Read-TelemetrySpec.*?foreach \(\$k in @\((.*?)\)\)', 'Singleline')
    if ($m.Success) { $keys += ([regex]::Matches($m.Groups[1].Value, '"([a-z_]+)"') | ForEach-Object { $_.Groups[1].Value }) }
    $m2 = [regex]::Match($libSrc, 'function Read-TelemetrySpec.*?(?=\nfunction )', 'Singleline')
    if ($m2.Success) { $keys += ([regex]::Matches($m2.Value, "Properties\.Name -contains '([a-z_]+)'") | ForEach-Object { $_.Groups[1].Value }) }
    $keys = @($keys | Select-Object -Unique)
    if (-not $keys.Count) { Add-Result 'L5' 'spec key the scheduler drops' 'WARN' 'could not read the spec key list out of Read-TelemetrySpec - detector needs updating'; return }

    $missing = @($keys | Where-Object { $schedSrc -notmatch [regex]::Escape($_) })
    if ($missing.Count) {
        Add-Result 'L5' 'spec key the scheduler drops' 'FAIL' `
            "read by Read-TelemetrySpec but never mentioned in run_schedule.ps1: $($missing -join ', ') - a run asking for these would silently get none"
    } else {
        Add-Result 'L5' 'spec key the scheduler drops' 'PASS' "$($keys.Count) spec key(s), all threaded through the scheduler"
    }
}

# ============================================================== L6 ====
function Test-LmL6 {
    <#
      L6 - telemetry reads a script value nothing defines.

      An undefined ScriptValue does not error; it reads ZERO. A run once logged standard of living
      = 0 for every one of ~285 countries, with the urban-centre figures on the SAME LINE correct,
      because v3tb_solw_* lived in the probe values file and that file is only emitted when a probe
      metric asks for it. No error.log line, nothing to notice (BUGS_AND_FIXES).

      DETECTOR. Every v3tb_* name the emitted telemetry reads must be defined in an emitted
      script_values file. Only our own names are judged - vanilla script values are not ours to
      account for.
    #>
    $files = Get-EmittedScriptFiles $Mod
    if (-not $files.Count) { Add-Result 'L6' 'script value read but never defined' 'N/A' 'no on_actions/events emitted'; return }

    $used = @{}
    foreach ($f in $files) {
        foreach ($m in [regex]::Matches([System.IO.File]::ReadAllText($f.FullName), "ScriptValue\('(v3tb_[a-z0-9_]+)'\)")) {
            $used[$m.Groups[1].Value] = $true
        }
    }
    if (-not $used.Count) { Add-Result 'L6' 'script value read but never defined' 'PASS' 'telemetry reads no script values'; return }

    $defined = @{}
    $svDir = Join-Path $Mod 'common\script_values'
    if (Test-Path $svDir) {
        foreach ($f in (Get-ChildItem $svDir -Filter *.txt -File)) {
            foreach ($m in [regex]::Matches([System.IO.File]::ReadAllText($f.FullName), '(?m)^\s*(v3tb_[a-z0-9_]+)\s*=\s*\{')) {
                $defined[$m.Groups[1].Value] = $true
            }
        }
    }
    $missing = @($used.Keys | Where-Object { -not $defined.ContainsKey($_) } | Sort-Object)
    if ($missing.Count) {
        Add-Result 'L6' 'script value read but never defined' 'FAIL' `
            "$($missing.Count) read but undefined - these read ZERO in game, silently: $($missing -join ', ')"
    } else {
        Add-Result 'L6' 'script value read but never defined' 'PASS' "$($used.Count) script value(s) read, all defined"
    }
}

# ============================================================= L14 ====
function Test-LmL14 {
    <#
      L14 - a country starts with a building its own technologies cannot unlock.

      The build succeeds, the mod loads, the game runs, and a great power simply owns a factory it
      could never have constructed. Nothing errors: the engine places what history tells it to place
      and never audits that against the country's technology set. The economy then comes out
      different from vanilla's for a reason no log mentions.

      FOUND LIVE 2026-08-12, and only because an unrelated bug was fixed first. While the 1836
      converter silently failed to re-tier (landmine L13), vanilla's steel-tooling workshops stayed on
      the base rung and nothing was gated wrongly. The moment conversion started working, five great
      powers - BEL, FRA, GBR, PRU, USA - owned a tooling workshop gated on 'steel_toolmaking', an 1865
      technology of ours that had replaced vanilla's 'mechanical_tools' gate. The fix was to name it
      in our own starting grant, exactly as vanilla names the three it needs for the same reason.

      DETECTOR. tools/verify_start_techs.mjs --vs-vanilla, over the EMITTED history - ours is the only
      history the engine reads, via replace_paths.

      IT COMPARES AGAINST VANILLA RATHER THAN DEMANDING ZERO. Vanilla itself fails on six countries,
      so an absolute pass is unreachable and a build demanding one could never go green. What we hold
      ourselves to is introducing no NEW gap, which is the real requirement and is computable because
      the same analysis runs unchanged against the game's own directory.
    #>
    $skip = Get-InstrumentArmSkip
    if ($skip) { Add-Result 'L14' 'a country starts with a building it cannot unlock' 'N/A' $skip; return }
    $script = Join-Path $PSScriptRoot 'verify_start_techs.mjs'
    if (-not (Test-Path $script)) { Add-Result 'L14' 'a country starts with a building it cannot unlock' 'N/A' 'verify_start_techs.mjs not present'; return }
    # no 2>&1: PS 5.1 wraps a native exe stderr line in an ErrorRecord, which loses the detail.
    # verify_start_techs writes its verdict to STDOUT and signals only through the exit code.
    $out = & node $script $Mod --vs-vanilla
    if ($LASTEXITCODE -eq 0) {
        $line = @($out | Where-Object { $_ -match 'inherited, not ours' }) -join ''
        $detail = if ($line) { $line.Trim() } else { "no gap beyond vanilla's own" }
        Add-Result 'L14' 'a country starts with a building it cannot unlock' 'PASS' $detail
    } else {
        Add-Result 'L14' 'a country starts with a building it cannot unlock' 'FAIL' ((@($out) | Select-Object -Last 12) -join [Environment]::NewLine)
    }
}

# ============================================================== L15 ===
function Test-LmL15 {
    <#
      L15 - a country silently LOSES a starting technology vanilla gives it.

      L14 asks whether a country can unlock what it owns. This asks the converse, and it is the
      user's rule of 2026-08-12: every production method vanilla runs in 1836 stays, and the country
      running it holds the technology that unlocks it. Nothing in the build enforced the "stays" half.

      WHY IT CAN HAPPEN WITHOUT ANYTHING FAILING. We whole-file-replace vanilla's starting-inventions
      file, so a transform that drops a line, or a re-era that moves a technology OUT of the era a
      tier's 'add_era_researched' covers, quietly removes it from every country of that tier. The mod
      still loads. The country simply cannot run a production method it ran in vanilla, and the first
      symptom is an economy that reads slightly wrong a decade later.

      DETECTOR. tools/verify_start_techs.mjs --diff-vanilla, over the EMITTED files, expanding the era
      shorthand against EACH root's own eras and including the per-country 'add_technology_researched'
      extras that 81 countries carry in their own history.

      PROVEN: deleting 'railways' from the tier-1 grant makes it name FRA, GBR, PRU, USA and fail.
    #>
    $skip = Get-InstrumentArmSkip
    if ($skip) { Add-Result 'L15' 'a country loses a vanilla starting technology' 'N/A' $skip; return }
    $script = Join-Path $PSScriptRoot 'verify_start_techs.mjs'
    if (-not (Test-Path $script)) { Add-Result 'L15' 'a country loses a vanilla starting technology' 'N/A' 'verify_start_techs.mjs not present'; return }
    $out = & node $script $Mod --diff-vanilla
    if ($LASTEXITCODE -eq 0) {
        # the gains are intended and ruled; report their SHAPE so an unexpected one is visible here
        $rows = @($out | Where-Object { $_ -match '^\s+\d+ countries' })
        Add-Result 'L15' 'a country loses a vanilla starting technology' 'PASS' (($rows | ForEach-Object { $_.Trim() }) -join '; ')
    } else {
        Add-Result 'L15' 'a country loses a vanilla starting technology' 'FAIL' ((@($out) | Select-Object -Last 12) -join [Environment]::NewLine)
    }
}

# ============================================================= L22 ====
function Test-LmL22 {
    <#
      L22 - a mod `effect` block on a VANILLA on_action silently REPLACES vanilla's.

      An on_action's `events` list MERGES across files; its `effect` block does NOT. Two files
      defining an effect for the same on_action do not compose - the engine keeps the most recently
      loaded one and DISCARDS the other, logging a single line in a file that is expected to carry
      vanilla's own noise. `zzz_pm_rehaul_wargate.txt` did this to `on_monthly_pulse_country`, whose
      vanilla effect is 1005 lines of Ottoman and Portuguese succession and ruler-trait rolls, and
      nothing failed anywhere: the mod loaded, every gate passed, the run completed.

      DETECTOR. Read the EMITTED on_actions files. Any top-level block that is a VANILLA on_action
      must not contain a direct `effect = {` child - it must register a named action instead
      (`on_actions = { my_action }`, with the effect on `my_action`). The vanilla on_action names are
      parsed live from the game's own common/on_actions, so a patch that adds one is covered without
      touching this check; `on_`-prefixed is the fallback when the game files are unreadable.

      ⚠ Deliberately NOT a grep for the engine's warning string: that needs a RUN, and the whole
      point is to fail at build time. Same principle as reading the artifact rather than the generator.
    #>
    $dir = Join-Path $Mod 'common\on_actions'
    if (-not (Test-Path $dir)) { Add-Result 'L22' 'mod effect overriding a vanilla on_action' 'N/A' 'no on_actions emitted'; return }

    # vanilla on_action names, read live; fall back to the `on_` convention if the game is unreadable
    $vanilla = @{}
    $vDir = Join-Path $GameDir 'common\on_actions'
    if (Test-Path $vDir) {
        foreach ($f in Get-ChildItem $vDir -Filter *.txt -File) {
            foreach ($line in [System.IO.File]::ReadAllLines($f.FullName)) {
                if ($line -match '^([a-z_0-9]+)\s*=\s*\{') { $vanilla[$Matches[1]] = $true }
            }
        }
    }
    $bad = @(); $checked = 0
    foreach ($f in Get-ChildItem $dir -Filter *.txt -File) {
        $lines = [System.IO.File]::ReadAllLines($f.FullName)
        $blk = $null
        foreach ($line in $lines) {
            if ($line -match '^([a-z_0-9]+)\s*=\s*\{') { $blk = $Matches[1]; continue }
            # a direct child sits one indent level in
            if ($blk -and $line -match '^[\t ]{1,2}effect\s*=\s*\{') {
                $isVanilla = if ($vanilla.Count) { $vanilla.ContainsKey($blk) } else { $blk -like 'on_*' }
                $checked++
                if ($isVanilla) { $bad += "$($f.Name): '$blk' declares its own effect block" }
            }
        }
    }
    if ($bad.Count) {
        Add-Result 'L22' 'mod effect overriding a vanilla on_action' 'FAIL' (
            ($bad -join [Environment]::NewLine) + [Environment]::NewLine +
            "vanilla's effect for that on_action is DISCARDED (most-recent-load wins). Register a named" + [Environment]::NewLine +
            "action instead:  <on_action> = { on_actions = { my_action } }  and put the effect on my_action.")
    } else {
        Add-Result 'L22' 'mod effect overriding a vanilla on_action' 'PASS' `
            "$($checked) direct effect block(s) inspected, none on a vanilla on_action ($($vanilla.Count) vanilla names known)"
    }
}

# ============================================================= L24 ====
function Test-LmL24 {
    <#
      L24 - a GENERATOR'S OWN DIAGNOSTIC TEXT LEAKED INTO AN EMITTED SCRIPT FILE.

      build.ps1's Set-BuildingAiValue returns the LINES of a building block and reported its
      "won't override a complex ai_value block" note with Write-Output. In PowerShell a bare
      Write-Output inside a function JOINS ITS RETURN VALUE, so the note was written into
      common/buildings/06_urban_center.txt and 11_private_infrastructure.txt as a literal line:

          note: building_power_plant = { has a complex ai_value block - not overriding
          building_power_plant = {

      The note text itself contains "<key> = {", an UNBALANCED OPENING BRACE, so the parser opened a
      bogus block and the real definition nested inside it. 96 parse errors per run, and NOTHING
      FAILED: the build succeeded, every lint passed, the mod loaded, the init marker was written,
      the clock advanced. Found only by reading error.log at the five-minute smoke check.

      DETECTOR. Read every EMITTED common/**/*.txt (the artifact, never the generator) and require
      that it is syntactically a Paradox script file:
        * brace depth ends at 0 and never goes negative;
        * every non-blank, non-comment line at depth 0 is either `}` or `<key> =` .
      Prose cannot satisfy the second rule, which is the point - the check is about TEXT THAT IS NOT
      SCRIPT, not about any one generator's bug. `#` is honoured as a comment only outside quotes.

      ⚠ Deliberately NOT a grep for "note:" or for Write-Output in build.ps1. The bug class is a
      generator leaking its own output, and the next one will use a different word and a different
      function. Verified zero false positives across all 36 emitted files of both the canonical and
      the aival builds, and PROVEN to trip by injecting the exact line the bug produced.
    #>
    $dir = Join-Path $Mod 'common'
    if (-not (Test-Path $dir)) { Add-Result 'L24' 'generator text leaked into an emitted script file' 'N/A' 'no common/ emitted'; return }

    $ok  = [regex]'^[@A-Za-z_][\w.:@|''-]*\s*='
    $bad = @(); $n = 0
    foreach ($f in Get-ChildItem -Path $dir -Recurse -File -Filter *.txt) {
        $n++
        $depth = 0; $minDepth = 0; $stray = @()
        $lines = [System.IO.File]::ReadAllLines($f.FullName)
        for ($i = 0; $i -lt $lines.Count; $i++) {
            # strip a trailing comment, honouring quotes
            $code = ''; $q = $false
            foreach ($ch in $lines[$i].ToCharArray()) {
                if ($ch -eq '"') { $q = -not $q }
                if ($ch -eq '#' -and -not $q) { break }
                $code += $ch
            }
            $t = $code.Trim()
            if ($depth -eq 0 -and $t -and $t -ne '}' -and -not $ok.IsMatch($t)) {
                if ($stray.Count -lt 3) { $stray += "line $($i+1): $($t.Substring(0, [Math]::Min(80, $t.Length)))" }
            }
            foreach ($ch in $code.ToCharArray()) {
                if ($ch -eq '{') { $depth++ }
                elseif ($ch -eq '}') { $depth--; if ($depth -lt $minDepth) { $minDepth = $depth } }
            }
        }
        $rel = $f.FullName.Substring($Mod.Length).TrimStart('\')
        if ($stray.Count) { $bad += "  $rel - NOT SCRIPT at top level:"; $bad += ($stray | ForEach-Object { "      $_" }) }
        if ($depth -ne 0)   { $bad += "  $rel - brace depth ends at $depth, not 0" }
        if ($minDepth -lt 0){ $bad += "  $rel - brace depth went negative ($minDepth): a stray closing brace" }
    }
    if ($bad.Count) {
        Add-Result 'L24' 'generator text leaked into an emitted script file' 'FAIL' (
            ($bad -join [Environment]::NewLine) + [Environment]::NewLine +
            "an emitted file is not valid script. The usual cause is a generator function that both" + [Environment]::NewLine +
            "RETURNS lines and reports with Write-Output - use Write-Warning/Write-Host for notes.")
    } else {
        Add-Result 'L24' 'generator text leaked into an emitted script file' 'PASS' `
            "$n emitted common/*.txt file(s): brace-balanced, nothing but script at top level"
    }
}

# ============================================================= L27 ====
function Test-LmL27 {
    <#
      L27 - an analysis script walks cfg.industries for tiers WITHOUT skipping 'disabled' industries.

      On a four-rung book port / shipyard / shipyard_steam / railway / power carry disabled: true: the industry
      is handed back to vanilla, but its tiers stay in the config and its rung-0 KEY IS THE VANILLA BUILDING
      (building_port, building_shipyard, building_railway). A tier map built without the filter therefore
      counts Britain's vanilla shipyards and ports as "e0" - the ab3 growth-seeds ledger showed a British e0
      series climbing 0.16M -> 0.83M while the real era-0 rungs fell 0.16M -> 0.09M (BUGS_AND_FIXES 2026-09-03).
      Nine ledger scripts had the omission; nothing failed, the panel was simply wrong, and on the six-rung
      canon (nothing disabled) it could never show.

      DETECTOR. Static, repo-side, the L25 pattern: every industry loop in tools\testbed\**\*.mjs
      (for (const x of <...>industries<...>) / .industries.forEach|map|filter|flatMap) must mention 'disabled'
      on that line or within the next two. Sessions are skipped (frozen copies, never rewritten).
    #>
    $root = Join-Path $Repo 'tools\testbed'
    if (-not (Test-Path $root)) { Add-Result 'L27' 'industry loop that keeps disabled industries' 'N/A' 'no tools\testbed'; return }
    $bad = @(); $checked = 0; $loops = 0
    foreach ($f in Get-ChildItem -Path $root -Recurse -File -Filter *.mjs) {
        if ($f.FullName -match '\\sessions\\') { continue }
        $lines = [System.IO.File]::ReadAllLines($f.FullName)
        $hit = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $l = $lines[$i]
            if ($l -notmatch 'for \(const \w+ of [^)]*industries' -and $l -notmatch '\.industries[^;]*\.(forEach|map|filter|flatMap)\(') { continue }
            $hit = $true; $loops++
            $win = $l
            if ($i + 1 -lt $lines.Count) { $win += "`n" + $lines[$i + 1] }
            if ($i + 2 -lt $lines.Count) { $win += "`n" + $lines[$i + 2] }
            if ($win -notmatch 'disabled') { $bad += ('{0}:{1}' -f $f.FullName.Substring($Repo.Length + 1), ($i + 1)) }
        }
        if ($hit) { $checked++ }
    }
    if ($bad.Count -gt 0) {
        Add-Result 'L27' 'industry loop that keeps disabled industries' 'FAIL' (
            ("{0} industry loop(s) without a 'disabled' guard:`n        " -f $bad.Count) + ($bad -join "`n        ") +
            "`n        a disabled industry's rung-0 key IS the vanilla building - start the loop with: if (ind.disabled) continue;")
    } else {
        Add-Result 'L27' 'industry loop that keeps disabled industries' 'PASS' `
            ("{0} script(s) with industry loops, {1} loop(s), every one guarded" -f $checked, $loops)
    }
}

# ============================================================= L25 ====
function Test-LmL25 {
    <#
      L25 - a summary reader globs *.json.gz and so reads the harvester's IN-PROGRESS file.

      harvest_saves.ps1 writes each save summary to "$stem.partial.json.gz" and renames it only after
      verifying it. That discipline is correct and is why L12 exists: a reaped save makes the summary
      the record, so it must never be half-written.

      But "0001_x.partial.json.gz".endsWith('.json.gz') is TRUE, and every reader globbed exactly that.
      Two silent outcomes, neither of which raises anything:
        * still truncated -> gunzipSync throws -> every reader wraps the parse in try/catch{continue},
          so the year is SILENTLY SKIPPED and a mid-batch read reports a short series as complete;
        * complete but not yet renamed -> both names are in the listing -> the year is READ TWICE,
          inserting a spurious zero-delta year into the diff-based analysers.

      DETECTOR. Static, repo-side: no script under tools/testbed may test endsWith('.json.gz') without
      also excluding '.partial.'. It reads the SOURCE here rather than an artifact because the defect
      is IN the reader - the artifact-vs-generator rule is about not trusting a generator's own report
      of what it emitted, and there is no artifact to inspect for this one.

      ⚠ Deliberately not a check that the summaries directory is clean at some moment: the race is
      real only DURING a harvest, so a point-in-time check would pass on every idle repo and catch
      nothing. The property worth enforcing is that the readers cannot be caught by it at all.

      ⚠ Sibling of L9 (reading the shared log ring unfiltered) and L23 (trusting line counts from that
      ring) one layer down. A GLOB IS NOT A MANIFEST.
    #>
    $root = Join-Path $Repo 'tools\testbed'
    if (-not (Test-Path $root)) { Add-Result 'L25' 'summary reader globs the harvester temp file' 'N/A' 'no tools\testbed'; return }
    $bad = @(); $checked = 0
    foreach ($f in Get-ChildItem -Path $root -Recurse -File -Filter *.mjs) {
        # ⚠ SKIP tools\testbed\sessions\ — those .mjs are FROZEN COPIES archived inside a finished
        # session, i.e. the record of how that batch was analysed. Sessions are never deleted and never
        # rewritten (CLAUDE.md); "fixing" one would be editing history to make a check pass, and the
        # race it warns about cannot recur for a batch that finished months ago.
        if ($f.FullName -match '\\sessions\\') { continue }
        $txt = [System.IO.File]::ReadAllText($f.FullName)
        if ($txt -notmatch "endsWith\('\.json\.gz'\)") { continue }
        $checked++
        # every glob site in the file must carry the exclusion
        $sites = ([regex]"endsWith\('\.json\.gz'\)").Matches($txt).Count
        $guards = ([regex]"includes\('\.partial\.'\)").Matches($txt).Count
        if ($guards -lt $sites) {
            $rel = $f.FullName.Substring($Repo.Length).TrimStart('\')
            $bad += "  $rel - $sites glob site(s), $guards guard(s)"
        }
    }
    if ($bad.Count) {
        Add-Result 'L25' 'summary reader globs the harvester temp file' 'FAIL' (
            ($bad -join [Environment]::NewLine) + [Environment]::NewLine +
            "a reader can pick up harvest_saves.ps1's in-progress `"`$stem.partial.json.gz`" and either" + [Environment]::NewLine +
            "skip that year silently or count it twice. Fix:" + [Environment]::NewLine +
            "  .filter(f => f.endsWith('.json.gz') && !f.includes('.partial.'))")
    } else {
        Add-Result 'L25' 'summary reader globs the harvester temp file' 'PASS' `
            "$checked summary reader(s), every glob site excludes the .partial temp name"
    }
}

# ============================================================== L7 ====
function Test-LmL7 {
    <#
      L7 - a control arm carrying gameplay content.

      CLAUDE.md, hard rule: the only thing a control may vary is its telemetry. Not one file, not
      one field. A control that carries gameplay content is not a control, and a reader who sees
      `{kind: control}` in a schedule must be able to assume vanilla without opening the build.

      DETECTOR. Identify the arm by the mod's own metadata id (read off the BUILT mod, so it
      cannot disagree with what loaded), then require that every emitted path is one of the four
      instrument directories. Anything else fails by name.
    #>
    $metaFile = Join-Path $Mod '.metadata\metadata.json'
    if (-not (Test-Path $metaFile)) { Add-Result 'L7' 'control arm carries gameplay content' 'N/A' 'no metadata.json'; return }
    $meta = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($meta.id -ne $CONTROL_MOD_ID) { Add-Result 'L7' 'control arm carries gameplay content' 'N/A' "not a control arm (id: $($meta.id))"; return }

    $allowed = @('.metadata', 'common\on_actions', 'common\script_values', 'events')
    $extra = @()
    foreach ($f in (Get-ChildItem $Mod -Recurse -File)) {
        $rel = $f.FullName.Substring($Mod.Length).TrimStart('\')
        $dir = Split-Path $rel -Parent
        if ($allowed -notcontains $dir) { $extra += "  $rel" }
    }
    if ($extra.Count) {
        Add-Result 'L7' 'control arm carries gameplay content' 'FAIL' `
            ("a control arm may carry ONLY metadata + telemetry. These are gameplay content:`n" + (($extra | Select-Object -First 15) -join "`n"))
    } else {
        Add-Result 'L7' 'control arm carries gameplay content' 'PASS' 'metadata + telemetry only'
    }
}

# ============================================================== L8 ====
function Get-CanonicalTelemetry {
    <#
      The telemetry text generated from a spec that turns on EVERY metric the library knows, with
      the date, tags, token and build stamp pinned. The metric list is read out of the library's
      own source rather than hardcoded, so a metric added tomorrow is fingerprinted tomorrow
      without anyone remembering to add it here.
    #>
    . (Join-Path $PSScriptRoot 'telemetry_lib.ps1')
    $libSrc = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'telemetry_lib.ps1'))
    $metrics = @([regex]::Matches($libSrc, '\$metrics -contains "([a-z_]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique | Sort-Object)
    $spec = [ordered]@{
        dump_dates       = @('1840.1.1')
        tags             = @('GBR', 'FRA')
        metrics          = $metrics
        origin_goods     = @('tools', 'steel')
        breakdown_dates  = @('1840.1.1')
        breakdown_tags   = @('GBR')
        wide_dates       = @('1840.1.1')
        wide_tags        = @('GBR', 'FRA')
        wage_pop_markets = @{ deep = @('GBR') }
        wage_pop_endpoints = 'both'   # v14; 'both' = the pre-v14 behaviour, so the hash is stable across the bump
    }
    $text = New-TelemetryScript -Spec $spec -Token 'FINGERPRINT' -BuildStamp 'FINGERPRINT'
    return @{ Text = $text; Metrics = $metrics; Version = (Get-TelemetryVersion) }
}

function Get-Sha256 { param([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $h = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
    return ([BitConverter]::ToString($h) -replace '-', '').ToLower()
}

function Test-LmL8 {
    <#
      L8 - the emitted telemetry changed and the schema version did not.

      A finding cites the schema version it was measured under, and that citation has to keep
      meaning the same thing forever. TELEMETRY_VERSION is bumped by hand, which means it is
      forgotten by hand: nothing today notices that the emitted script changed while the number
      stayed put, and the cost lands months later on whoever compares two sessions that are not
      comparable.

      DETECTOR. Hash the canonical telemetry (every metric on, everything else pinned) and store
      it next to the version. If the hash moved and the version did not, fail and say so. This is
      the entry that makes the guardrail bite on "any change, including telemetry" rather than
      only on the changes someone thought to check.

      Not a judgement about whether the change WAS breaking - the script cannot know that. It is a
      forced decision point: bump the version, or record that this change is compatible by
      refreshing the fingerprint with -UpdateFingerprint.
    #>
    $canon = Get-CanonicalTelemetry
    $hash = Get-Sha256 $canon.Text

    if ($UpdateFingerprint) {
        $obj = [ordered]@{
            _comment = 'GENERATED by tools/preflight.ps1 -UpdateFingerprint. Landmine L8: if the hash moves and telemetry_version does not, the build fails. See TESTBED_LANDMINES.md.'
            telemetry_version = $canon.Version
            canonical_sha256  = $hash
            metrics           = $canon.Metrics
            updated           = (Get-Date -Format 'yyyy-MM-dd HH:mm')
        }
        [System.IO.File]::WriteAllText($FingerprintFile, (($obj | ConvertTo-Json -Depth 5) + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
        Add-Result 'L8' 'telemetry changed without a version bump' 'PASS' "fingerprint rewritten: v$($canon.Version) $($hash.Substring(0,12)) over $($canon.Metrics.Count) metric(s)"
        return
    }

    if (-not (Test-Path $FingerprintFile)) {
        Add-Result 'L8' 'telemetry changed without a version bump' 'FAIL' `
            "no telemetry_fingerprint.json - run: powershell -File tools\preflight.ps1 -UpdateFingerprint"
        return
    }
    $fp = Get-Content $FingerprintFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($fp.canonical_sha256 -eq $hash) {
        if ($fp.telemetry_version -ne $canon.Version) {
            Add-Result 'L8' 'telemetry changed without a version bump' 'WARN' `
                "version moved $($fp.telemetry_version) -> $($canon.Version) with IDENTICAL emitted telemetry. If that bump was real, refresh the fingerprint; if not, it renumbers findings for nothing."
        } else {
            Add-Result 'L8' 'telemetry changed without a version bump' 'PASS' "v$($canon.Version), $($hash.Substring(0,12)), $($canon.Metrics.Count) metric(s)"
        }
        return
    }
    if ($fp.telemetry_version -ne $canon.Version) {
        Add-Result 'L8' 'telemetry changed without a version bump' 'WARN' `
            "telemetry changed AND version bumped $($fp.telemetry_version) -> $($canon.Version). Record the bump in TESTBED_METRICS.md, then: powershell -File tools\preflight.ps1 -UpdateFingerprint"
        return
    }
    Add-Result 'L8' 'telemetry changed without a version bump' 'FAIL' `
        ("emitted telemetry changed but TELEMETRY_VERSION is still $($canon.Version).`n" +
         "  was $($fp.canonical_sha256.Substring(0,12)), now $($hash.Substring(0,12)).`n" +
         "  Either bump `$script:TELEMETRY_VERSION in telemetry_lib.ps1 and record it in TESTBED_METRICS.md,`n" +
         "  or - if older sessions stay comparable - accept it with: powershell -File tools\preflight.ps1 -UpdateFingerprint")
}

# ============================================================== L9 ====
function Test-LmL9 {
    <#
      L9 - reading the shared log ring without filtering by the run's own identity.

      The game's logs are a 5x512 KB ring shared by EVERY run, and the game rotates them at
      startup. Anything read out of them must be filtered by the run's own identity or it reads a
      PREVIOUS session's output as this one's. Three places, three outcomes: telemetry lines are
      filtered by token (fixed, long-standing); the in-game clock was not, which threw away a
      successful resume verdict (fixed, by the line's own [HH:MM:SS]); error counts are STILL not
      filtered, which is why meta.json's error_log_lines is an upper bound and not a measurement.

      DETECTOR is a presence test on the two fixes that exist, not a proof of correctness - it
      catches a REGRESSION (someone deleting the token filter), not a new unfiltered reader. The
      third case is open work and is reported as such rather than silently passing.
    #>
    $sum = Join-Path $PSScriptRoot 'testbed\summarise.ps1'
    if (-not (Test-Path $sum)) { Add-Result 'L9' 'reads the shared log ring unfiltered' 'N/A' 'summarise.ps1 not found'; return }
    $obs = Join-Path $PSScriptRoot 'testbed\run_observer.ps1'
    $missing = @()
    if ([System.IO.File]::ReadAllText($sum) -notmatch 'token') { $missing += 'summarise.ps1 no longer filters by the run token' }
    if ((Test-Path $obs) -and ([System.IO.File]::ReadAllText($obs) -notmatch '\d\{2\}:\\d\{2\}:\\d\{2\}|HH:MM:SS|\d\{1,2\}:\\d\{2\}:\\d\{2\}') ) {
        # the clock filter is a timestamp regex; absence of any timestamp pattern means it went away
        if ([System.IO.File]::ReadAllText($obs) -notmatch '\[\\d') { $missing += 'run_observer.ps1 no longer stamps ticks by their own clock time' }
    }
    if ($missing.Count) { Add-Result 'L9' 'reads the shared log ring unfiltered' 'FAIL' ($missing -join '; ') }
    else { Add-Result 'L9' 'reads the shared log ring unfiltered' 'PASS' 'token filter and clock stamp both present; error counts remain unfiltered by design (open, see register)' }
}

# ============================================================== L12 ====
function Test-LmL17 {
    <#
      L17 - A RUN THAT FAILED IS RECORDED AS `ok`, AND THE ARM'S n SILENTLY SHRINKS.

      The scheduler derives a run's status from the OBSERVER'S EXIT CODE alone, and the observer exits
      0 even when it ABANDONS a run - on a watchdog timeout, on a STOP file, or on a resume it gave up
      on. So a run that reached 1838 of a planned 1936 is counted beside three that reached 1936, the
      arm reports n=4, and every mean is computed over a population that never existed.

      Nothing was missing to catch it: each run's own meta.json already carries reached_ingame_date,
      until_date, self_quit and abandoned_reason. Nothing read them. This is the generating cause of
      the four retrospective n-corrections in SESSION_VERDICTS.md - techtree-full-n3 and wages-n3 are
      n=2, vanilla-retest's nineteen runs are sixteen probes and three failed resumes, and
      canon-ports-n2 is n=1 for the century.

      DETECTOR: for every ENDED run in the session, compare reached_ingame_date against until_date and
      report any run that fell short, or that carries a non-empty abandoned_reason. It does NOT judge
      why - a deliberate STOP is as much a shortfall for COUNTING purposes as a crash is, and which of
      those it was belongs in the session's VERDICT.md, written by a human.
      ⚠ A run still in flight legitimately has no `ended` yet; those are counted separately and never
      failed, for the same reason L12 skips them - a detector that cries wolf on every mid-batch check
      is one people learn to ignore, which loses the whole point of the register.
      ⚠ It cannot run at build time: it reads a session. N/A without -Session, exactly like L12.
    #>
    if (-not $Session) { Add-Result 'L17' 'a failed run recorded as ok' 'N/A' 'no -Session given (this entry is post-run)'; return }
    if (-not (Test-Path $Session)) { Add-Result 'L17' 'a failed run recorded as ok' 'FAIL' "no such session: $Session"; return }

    $short = @(); $ended = 0; $inflight = 0
    foreach ($run in @(Get-ChildItem $Session -Directory)) {
        $meta = Join-Path $run.FullName 'meta.json'
        if (-not (Test-Path $meta)) { continue }
        $m = $null
        try { $m = Get-Content $meta -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
        if (-not $m) { $short += "$($run.Name): meta.json unreadable"; continue }
        if (-not $m.ended) { $inflight++; continue }
        $ended++

        $reached = $null; $target = $null
        if ("$($m.reached_ingame_date)" -match '^(\d{4})\.(\d+)\.(\d+)') { $reached = [int]$Matches[1]*10000 + [int]$Matches[2]*100 + [int]$Matches[3] }
        if ("$($m.until_date)"        -match '^(\d{4})\.(\d+)\.(\d+)') { $target  = [int]$Matches[1]*10000 + [int]$Matches[2]*100 + [int]$Matches[3] }

        $why = @()
        if ($null -ne $reached -and $null -ne $target -and $reached -lt $target) {
            $why += "reached $($m.reached_ingame_date) of $($m.until_date)"
        }
        if ("$($m.abandoned_reason)".Trim()) { $why += "abandoned: $($m.abandoned_reason)" }
        if ($why.Count) { $short += "$($run.Name): $($why -join ' | ')" }
    }

    $note = "$ended ended run(s)"
    if ($inflight) { $note = "$note, $inflight still in flight" }

    if ($short.Count) {
        Add-Result 'L17' 'a failed run recorded as ok' 'FAIL' ("$($short.Count) of $ended ended run(s) did NOT complete - do not count them in this arm's n:`n    " + ($short -join "`n    "))
    } elseif ($ended -eq 0) {
        Add-Result 'L17' 'a failed run recorded as ok' 'N/A' 'no ended runs in this session yet'
    } else {
        Add-Result 'L17' 'a failed run recorded as ok' 'PASS' "$note, all reached their target date"
    }
}

function Test-LmL28 {
    <#
      L28 - THE LOG MIRROR RE-COPIED THE CURRENT LOG ON A FALSE ROTATION.

      run_observer's Read-Tail took "directory length below my read position" as proof of a rotation.
      Get-Item reads the DIRECTORY entry, which NTFS updates lazily for a file another process holds
      open, while the chunk reader sees the true size through a handle - so for seconds at a time the
      length sits below Pos, the tail reset Pos to 0 and re-copied the whole current file on EVERY
      250 ms poll. Run 4 of 20260903_173810_canon4-je-n5 appended one 946-line chunk 27 times in eight
      seconds; canon-n7 run001 sixteen times. V3TB telemetry lines were saved by the Seen2 de-dupe;
      every other line - the research journal's PMR_JE completions, the game's own event lines, the
      error mirror's lines - was multiplied. A raw line count off the mirror then over-reads: F101's
      canon-n7 run001 figure (12,004 lines) is 5,232 unique completions.

      Nothing fails: the run completes, the TSVs are right (V3TB de-duped), the summaries are right.
      Only a reader that COUNTS non-telemetry lines is wrong, and it is wrong silently.

      The observer is fixed (an unchanged first-line signature means a stale length, not a rotation).
      This entry is the ARTIFACT-side check: every false rotation left a seam line reading
      `recovered 0 chars from []`, so a session on disk says for itself whether its mirrors carry
      duplicated chunks. FAIL = at least one such seam in any run; count PMR_JE and event lines from
      such a mirror only after de-duplicating (tools/testbed/ledger/je_tally.mjs does).
    #>
    if (-not $Session) { Add-Result 'L28' 'log mirror re-copied on a false rotation' 'N/A' 'no -Session given (this entry is post-run)'; return }
    if (-not (Test-Path $Session)) { Add-Result 'L28' 'log mirror re-copied on a false rotation' 'FAIL' "no such session: $Session"; return }
    $hits = @(); $checked = 0
    # The scan runs in node (as L26's does): the mirrors are 100k–400k lines and the test needs a rolling index.
    # THE TEST: a false rotation re-copies the current file from its START, so the lines after a zero-recovery
    # seam reappear as a long run the mirror already holds since the previous seam. Thirty consecutive identical
    # lines is the bar — a benign real rotation (rotated segment already consumed, new file read from 0) is
    # followed by NEW lines, and error.log's periodic bursts repeat 4–8 identical lines, never thirty.
    # ⚠ One line, or five, was NOT enough: canon4-art-n2 (recorded after the fix, nothing duplicated) read
    #   1–2 false positives per error mirror on both, and the five-line form MISSED run 4 of canon4-je-n5 — the
    #   original copy of the chunk had been mirrored in interleaved pieces, so only re-copy-vs-re-copy matched.
    $js = @'
const fs=require('fs');
const L=fs.readFileSync(process.argv[2],'utf8').split(/\r?\n/);   // [0]=node [1]=this script [2]=mirror
const RUN=30; let hits=0, regionStart=0, pendingAt=-1;
const isSeam=l=>l.startsWith('--- harness: source log rotated');
const check=(from)=>{ // the RUN non-empty lines after index from must equal RUN consecutive lines somewhere in [regionStart, from)
  const nxt=[]; for(let j=from;j<L.length&&nxt.length<RUN;j++){ if(isSeam(L[j])) break; if(L[j].length) nxt.push(L[j]); }
  if(nxt.length<RUN) return false;
  for(let e=regionStart;e<from;e++){ if(L[e]!==nxt[0]) continue; let k=1, m=e+1; while(k<RUN&&m<from){ if(!L[m].length){m++;continue;} if(L[m]!==nxt[k]) break; k++; m++; } if(k===RUN) return true; }
  return false; };
for(let i=0;i<L.length;i++){ if(!isSeam(L[i])) continue; if(L[i].includes('recovered 0 chars from []')){ if(check(i+1)) hits++; } regionStart=i+1; }
console.log(hits);
'@
    $tmp = Join-Path $env:TEMP ("lm28_" + [guid]::NewGuid().ToString('N') + '.js')
    Set-Content -LiteralPath $tmp -Value $js -Encoding utf8
    try {
        foreach ($run in @(Get-ChildItem $Session -Directory)) {
            foreach ($name in @('debug.log', 'error.log', 'dedicated_server.log')) {
                $mirror = Join-Path $run.FullName ("logs_live\" + $name)
                if (-not (Test-Path $mirror)) { continue }
                $checked++
                $n = 0
                $out = & node $tmp $mirror 2>$null
                if ($LASTEXITCODE -ne 0) { $hits += ("{0}/{1}: detector could not read the mirror" -f $run.Name, $name); continue }
                $n = [int]("$out".Trim())
                if ($n -gt 0) { $hits += ("{0}/{1}: {2} false rotation(s)" -f $run.Name, $name, $n) }
            }
        }
    } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    if ($checked -eq 0) { Add-Result 'L28' 'log mirror re-copied on a false rotation' 'N/A' 'no logs_live mirrors in this session'; return }
    if ($hits.Count) {
        Add-Result 'L28' 'log mirror re-copied on a false rotation' 'FAIL' ("mirror chunks DUPLICATED - de-duplicate before counting lines: " + ($hits -join ' | '))
    } else {
        Add-Result 'L28' 'log mirror re-copied on a false rotation' 'PASS' ("no re-copied chunk after any seam in $checked mirror(s)")
    }
}

function Test-LmL26 {
    <#
      L26 - ONE RUN FOLDER HOLDING TWO CAMPAIGNS.

      A crash-resume whose load FAILS starts a fresh 1836 game (verified: MODDING_NOTES). If that
      fresh game then REACHES THE TARGET, run_observer's `if ($reached -or $timedOut) { break }` fires
      BEFORE the resume-landing guard, so the guard is never consulted: meta.json records
      `reached_ingame_date` = the target, `self_quit` = true, `abandoned_reason` = empty. The run looks
      perfect. Its save_summaries hold TWO campaigns, and the wall clock is double.

      Measured on run004 of 20260830_191950_tier4-vanilla-ladder-n4: CTD at 1931.1.13, every resume
      attempt failed to reload a late save, and the run played 1836->1936 a SECOND time. 267 min
      against 135-146 for its siblings; 195 summaries over 100 distinct in-game dates.

      Nothing fails. Readers keyed on the DATE take the later campaign (coherent, by filename order);
      readers that DIFF CONSECUTIVE FILES cross the seam once and diff 1931 against 1837. On that run
      it cost nothing - measured, its below-best share reads 38.14% against a 36.84-38.38% spread
      across its siblings - but that is a property of "levels removed are ignored", not of the reader
      being safe.

      The observer is fixed (the fresh-start abort now fires on the FIRST TICK of a resume, so such an
      attempt can never reach the target). This entry is the ARTIFACT-side check, because a fix in the
      generator is no evidence at all about a session already on disk.

      SWEPT over all 74 sessions holding summaries when this was written: 5 hits, of which 4 are
      already excluded by lib_runs/L17 or are the sub-year shape below. Only this batch counts one.

      DETECTOR: read every provenance.date in filename order and classify each backward jump.
    #>
    if (-not $Session) { Add-Result 'L26' 'two campaigns in one run folder' 'N/A' 'no -Session given (this entry is post-run)'; return }
    if (-not (Test-Path $Session)) { Add-Result 'L26' 'two campaigns in one run folder' 'FAIL' "no such session: $Session"; return }
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { Add-Result 'L26' 'two campaigns in one run folder' 'N/A' 'node not on PATH (the summaries are gzipped JSON)'; return }
    $bad = @(); $soft = @(); $checked = 0
    foreach ($run in @(Get-ChildItem $Session -Directory)) {
        $dir = Join-Path $run.FullName 'save_summaries'
        if (-not (Test-Path $dir)) { continue }
        $checked++
        # Read through node: the summaries are gzipped and PowerShell has no streaming gunzip
        # one-liner. It prints "<years>|<from> -> <to>" per backward jump, nothing when monotone.
        $js = @'
const fs=require('fs'),zlib=require('zlib'),path=require('path');
const dir=process.argv[2];   // [0]=node [1]=this script
const num=d=>{const p=String(d||'').split('.');return p.length<3?0:(+p[0])*10000+(+p[1])*100+(+p[2]);};
let prev=null;
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.json.gz')&&!x.includes('.partial.')).sort()){
  let d; try{ d=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,f)))).provenance.date; }catch{ continue; }
  if(prev && num(d)<num(prev.d)) console.log(((num(prev.d)-num(d))/10000).toFixed(2)+'|'+prev.d+' -> '+d+' ('+f+')');
  prev={d,f};
}
'@
        $tmp = Join-Path $env:TEMP ("lm26_" + [guid]::NewGuid().ToString('N') + '.js')
        Set-Content -LiteralPath $tmp -Value $js -Encoding utf8
        try { $out = & node $tmp $dir 2>$null } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
        foreach ($line in @($out | Where-Object { $_ })) {
            # TWO SHAPES, and they are DIFFERENT DEFECTS - reporting them as one would put a doubled
            # century and a filename-ordering wobble under the same headline:
            #   > 2y  - a SECOND CAMPAIGN in the folder. This entry's subject. FAIL.
            #   <= 2y - the ARCHIVER read several slots of the rotation ring in one pass, so
            #           autosave_1.v3 (the OLDER save) sorts AFTER autosave.v3 by filename. ONE
            #           campaign, a few summaries out of order. Small, real, separately caused. WARN.
            $yrs = 0.0; $txt = $line
            if ($line -match '^([0-9.]+)\|(.+)') { $yrs = [double]$Matches[1]; $txt = $Matches[2] }
            $row = "$($run.Name): $txt [$yrs y]"
            if ($yrs -gt 2) { $bad += $row } else { $soft += $row }
        }
    }
    if ($checked -eq 0) { Add-Result 'L26' 'two campaigns in one run folder' 'N/A' 'no save_summaries in this session'; return }
    if ($bad.Count) {
        Add-Result 'L26' 'two campaigns in one run folder' 'FAIL' ("SECOND CAMPAIGN - backward jump over 2y in " + $bad.Count + " place(s): " + ($bad -join ' | '))
    } elseif ($soft.Count) {
        Add-Result 'L26' 'two campaigns in one run folder' 'WARN' ("one campaign, summaries OUT OF ORDER (archiver read the rotation ring in one pass) in " + $soft.Count + " place(s): " + ($soft -join ' | '))
    } else {
        Add-Result 'L26' 'two campaigns in one run folder' 'PASS' "$checked run(s), every summary series monotone in game date"
    }
}


function Test-LmL12 {
    <#
      L12 - A SESSION WHOSE SAVES WERE REAPED BUT WHOSE SUMMARIES ARE NOT THERE.

      This is the landmine the savegame instrument creates by existing. Everywhere else in the repo
      "the summary is a CACHE, the raw log is the record" - which is what makes compressing raws safe.
      Reaping autosaves INVERTS it: the summary becomes the record, and a save deleted without a
      readable summary beside it is evidence that no longer exists anywhere. Re-running does not
      recover it - a different seed is a different world.

      And it is silent by construction. The batch completes, session.json says every run finished, the
      markets TSV is full, and the disk is pleasantly empty. Nothing anywhere says that run 4's saves
      went through a reader that crashed on every one of them.

      DETECTOR: for each run folder holding a `saves\` directory, require a `save_summaries\` beside
      it, require it non-empty, READ one and require a save_summary_version, reject leftover
      `.partial` files, report the per-save `.err` files harvest_saves.ps1 leaves on failure, and
      require at least one save still kept (the escape hatch the ruling asks for).
    #>
    if (-not $Session) { Add-Result 'L12' 'saves reaped without summaries' 'N/A' 'no -Session given (this entry is post-run)'; return }
    if (-not (Test-Path $Session)) { Add-Result 'L12' 'saves reaped without summaries' 'FAIL' "no such session: $Session"; return }
    $bad = @(); $seen = 0; $tot = 0
    $inflight = 0
    foreach ($run in @(Get-ChildItem $Session -Directory)) {
        $sv = Join-Path $run.FullName 'saves'
        if (-not (Test-Path $sv)) { continue }
        # ⚠ A RUN STILL PLAYING LEGITIMATELY HAS saves\ AND NO save_summaries\ - the harvest runs after
        # the game exits. Judging it is a false positive, and a detector that cries wolf on every
        # mid-batch check is one people learn to ignore, which is the entire point of the register lost.
        # `ended` in meta.json is the completion signal; no meta.json at all means the run never finished.
        $meta = Join-Path $run.FullName 'meta.json'
        $ended = $false
        if (Test-Path $meta) { try { $ended = [bool](Get-Content $meta -Raw | ConvertFrom-Json).ended } catch { $ended = $false } }
        if (-not $ended) { $inflight++; continue }
        $seen++
        $sm = Join-Path $run.FullName 'save_summaries'
        $kept = @(Get-ChildItem $sv -Filter '*.v3' -ErrorAction SilentlyContinue)
        if (-not (Test-Path $sm)) { $bad += "$($run.Name): saves\ exists but save_summaries\ does not"; continue }
        $sums  = @(Get-ChildItem $sm -Filter '*.json.gz' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '*.partial.json.gz' })
        $errs  = @(Get-ChildItem $sm -Filter '*.err' -ErrorAction SilentlyContinue)
        $parts = @(Get-ChildItem $sm -Filter '*.partial.json.gz' -ErrorAction SilentlyContinue)
        $tot += $sums.Count
        if ($sums.Count -eq 0) { $bad += "$($run.Name): 0 summaries"; continue }
        if ($errs.Count)  { $bad += "$($run.Name): $($errs.Count) save(s) failed to summarise - $((($errs | Select-Object -First 3).Name) -join ', ')" }
        if ($parts.Count) { $bad += "$($run.Name): $($parts.Count) partial summary file(s) left behind" }
        # ⚠ READ one, do not merely count: a directory of zero-byte files counts perfectly well.
        $probe = $sums[0]
        try {
            $ms = [IO.MemoryStream]::new([IO.File]::ReadAllBytes($probe.FullName))
            $gz = [IO.Compression.GZipStream]::new($ms, [IO.Compression.CompressionMode]::Decompress)
            $o  = ([IO.StreamReader]::new($gz)).ReadToEnd() | ConvertFrom-Json
            if (-not $o.save_summary_version) { $bad += "$($run.Name): $($probe.Name) carries no save_summary_version" }
        } catch { $bad += "$($run.Name): $($probe.Name) is unreadable - $($_.Exception.Message)" }
        if ($kept.Count -eq 0) { $bad += "$($run.Name): every save reaped and none kept - the escape hatch is gone" }
    }
    $note = $(if ($inflight) { " ($inflight run(s) still in flight, not judged)" } else { '' })
    if (-not $seen) { Add-Result 'L12' 'saves reaped without summaries' 'N/A' "no FINISHED run in this session archived saves$note"; return }
    if ($bad.Count) { Add-Result 'L12' 'saves reaped without summaries' 'FAIL' (($bad -join "`n") + $note) }
    else { Add-Result 'L12' 'saves reaped without summaries' 'PASS' "$seen finished run(s) with archived saves, $tot readable versioned summaries, an escape-hatch save kept in each$note" }
}

# ============================================================== L20 ====
function Get-TreeSuffix {
    <#
      THE SAME RULE emit_techs.mjs AND emit_research_events.mjs USE, restated once here. Both derive
      their tree file from the CONFIG'S FILENAME:
          const raw = process.env.MOD_CONFIG || process.argv[3] || '';
          const m = basename(raw).match(/^mod_config\.(.+)\.json$/);
          TREE = 'config/tech_tree_options' + (m ? '.'+m[1] : '') + '.json'
      MOD_CONFIG wins over the argument in both, so it wins here too - otherwise a redirected run
      would be checked against the wrong pair, which is the failure mode this whole entry is about.
    #>
    param([string]$ConfigPath)
    $raw = $env:MOD_CONFIG
    if (-not $raw) { $raw = $ConfigPath }
    if (-not $raw) { return '' }
    $bn = Split-Path $raw -Leaf
    if ($bn -match '^mod_config\.(.+)\.json$') { return '.' + $Matches[1] }
    return ''
}
function Test-LmL20 {
    <#
      L20 - an ALTERNATE CONFIG WITHOUT ITS PAIRED tech_tree_options.<sfx>.json cannot be built.

      COST AT DISCOVERY: 6 h 40 min of an overnight window, zero runs (2026-08-18). A full-century
      n=2 batch was launched against a frozen byte copy of the canonical config - itself the right
      call, an L10 mitigation so a second agent session editing config/mod_config.json could not
      change the arm between runs. The freeze had no paired tree, emit_techs.mjs threw ENOENT three
      seconds in, and the scheduler then failed to abort (L21). From outside, an idle machine and a
      silent log look exactly like a healthy long run.

      DETECTOR. With -Config: FAIL when the config about to be built has no paired tree, printing the
      one-line Copy-Item that fixes it. Without -Config: WARN-list every unpaired alternate in
      config/ - that alone would have caught this, because -WhatIf ran preflight -RepoOnly seconds
      before launch and printed PREFLIGHT PASSED.

      WARN: do NOT "fix" the underlying trap by falling back to the canonical tree. That pairs an
      alternate config's BUILDINGS with the canonical config's TECHNOLOGIES - exactly the defect
      BUGS_AND_FIXES 2026-08-12 records, caught one run before it voided an overnight batch. It must
      fail; it must fail loudly and early, naming the missing file and the fix.
    #>
    $cfgDir = Join-Path $Repo 'config'
    if ($Config) {
        $cfgFile = $Config
        if (-not [System.IO.Path]::IsPathRooted($cfgFile)) { $cfgFile = Join-Path $Repo $cfgFile }
        if (-not (Test-Path $cfgFile)) {
            Add-Result 'L20' 'alternate config with no paired tech tree' 'FAIL' "config not found: $cfgFile"
            return
        }
        $sfx  = Get-TreeSuffix -ConfigPath $cfgFile
        # MOD_CONFIG outranks -Config in both emitters, so say which name the suffix came from -
        # a message naming the wrong file is how a redirected run gets 'fixed' in the wrong place.
        $srcName = if ($env:MOD_CONFIG) { (Split-Path $env:MOD_CONFIG -Leaf) + ' (MOD_CONFIG)' } else { Split-Path $cfgFile -Leaf }
        $tree = Join-Path $cfgDir ('tech_tree_options' + $sfx + '.json')
        if (Test-Path $tree) {
            Add-Result 'L20' 'alternate config with no paired tech tree' 'PASS' (
                "$srcName is paired with $(Split-Path $tree -Leaf)")
        } else {
            Add-Result 'L20' 'alternate config with no paired tech tree' 'FAIL' (
                "$srcName has NO paired tree - emit_techs.mjs will throw ENOENT on" + [Environment]::NewLine +
                "  config\tech_tree_options$sfx.json" + [Environment]::NewLine +
                "FIX (one line, from the repo root):" + [Environment]::NewLine +
                "  Copy-Item config\tech_tree_options.json config\tech_tree_options$sfx.json" + [Environment]::NewLine +
                "Do NOT make the emitters fall back to the canonical tree: that ships an alternate config's" + [Environment]::NewLine +
                "BUILDINGS against the canonical config's TECHNOLOGIES (BUGS_AND_FIXES 2026-08-12).")
        }
        return
    }
    # No -Config: survey the repo. Every alternate that cannot be built today is named, so a batch
    # pointed at one is caught before it is launched rather than at its first build.
    $unpaired = @()
    $paired   = 0
    foreach ($f in @(Get-ChildItem $cfgDir -Filter 'mod_config.*.json' -File -ErrorAction SilentlyContinue)) {
        if ($f.Name -notmatch '^mod_config\.(.+)\.json$') { continue }
        $sfx = '.' + $Matches[1]
        if (Test-Path (Join-Path $cfgDir ('tech_tree_options' + $sfx + '.json'))) { $paired++ }
        else { $unpaired += $f.Name }
    }
    if ($unpaired.Count) {
        Add-Result 'L20' 'alternate config with no paired tech tree' 'WARN' (
            "$($unpaired.Count) alternate config(s) CANNOT BE BUILT today (no paired tech_tree_options):" + [Environment]::NewLine +
            "  " + ($unpaired -join ([Environment]::NewLine + "  ")) + [Environment]::NewLine +
            "each needs:  Copy-Item config\tech_tree_options.json config\tech_tree_options.<sfx>.json" + [Environment]::NewLine +
            "(pass -Config <path> to turn this into a FAIL for the one config about to be built)")
    } else {
        Add-Result 'L20' 'alternate config with no paired tech tree' 'PASS' (
            "$paired alternate config(s) checked, all paired")
    }
}

# --------------------------------------------------------------------------- driver ----
# `Artifact` = needs a BUILT mod to read. The rest read the repo and can therefore gate a batch
# BEFORE anything is built, which is the difference between failing in two seconds and failing after
# the first run's build.
$CHECKS = @(
    @{ Id = 'L1'; Artifact = $true;  Fn = { Test-LmL1 } },
    @{ Id = 'L2'; Artifact = $true;  Fn = { Test-LmL2 } },
    @{ Id = 'L4'; Artifact = $true;  Fn = { Test-LmL4 } },
    @{ Id = 'L5'; Artifact = $false; Fn = { Test-LmL5 } },
    @{ Id = 'L6'; Artifact = $true;  Fn = { Test-LmL6 } },
    @{ Id = 'L7'; Artifact = $true;  Fn = { Test-LmL7 } },
    @{ Id = 'L8'; Artifact = $false; Fn = { Test-LmL8 } },
    @{ Id = 'L9'; Artifact = $false; Fn = { Test-LmL9 } },
    # L12 needs a finished SESSION, not a mod - it and L26 are the two post-run entries, and both report N/A
    # (never FAIL) when no -Session is given, so it costs a build nothing.
    @{ Id = 'L12'; Artifact = $false; Fn = { Test-LmL12 } },
    # L26 is the SECOND post-run entry, same N/A-without--Session rule as L12.
    @{ Id = 'L26'; Artifact = $false; Fn = { Test-LmL26 } },
    @{ Id = 'L28'; Artifact = $false; Fn = { Test-LmL28 } },
    @{ Id = 'L14'; Artifact = $true;  Fn = { Test-LmL14 } },
    @{ Id = 'L15'; Artifact = $true;  Fn = { Test-LmL15 } },
    @{ Id = 'L17'; Artifact = $false; Fn = { Test-LmL17 } },
    # L20 reads the CONFIG, not the mod, so it gates a batch before anything is built - which is the
    # whole point: the failure it catches costs a whole window when it is found at the first build.
    @{ Id = 'L20'; Artifact = $false; Fn = { Test-LmL20 } },
    @{ Id = 'L22'; Artifact = $true;  Fn = { Test-LmL22 } },
    @{ Id = 'L24'; Artifact = $true;  Fn = { Test-LmL24 } },
    # L25 reads the ANALYSIS SCRIPTS, not the mod, so it costs a build nothing and gates a batch
    # before anything is harvested — which is when a reader that can race the harvester matters.
    @{ Id = 'L25'; Artifact = $false; Fn = { Test-LmL25 } }
    @{ Id = 'L27'; Artifact = $false; Fn = { Test-LmL27 } }
)
if ($RepoOnly) { $CHECKS = @($CHECKS | Where-Object { -not $_.Artifact }) }
if ($Only) {
    $want = @($Only -split '[, ]+' | Where-Object { $_ } | ForEach-Object { $_.ToUpper() })
    $CHECKS = @($CHECKS | Where-Object { $want -contains $_.Id })
    if (-not $CHECKS.Count) { Write-Output "PREFLIGHT: -Only '$Only' matched no check"; exit 1 }
}

foreach ($c in $CHECKS) {
    try { & $c.Fn }
    catch {
        # A detector that throws is itself a failure - a silent detector is worse than no detector.
        Add-Result $c.Id '(detector error)' 'FAIL' "the check itself threw: $($_.Exception.Message)"
    }
}

$fails = @($script:Results | Where-Object { $_.Status -eq 'FAIL' })
$warns = @($script:Results | Where-Object { $_.Status -eq 'WARN' })

$against = $(if ($RepoOnly) { 'the repo (pre-batch gate)' } else { Split-Path $Mod -Leaf })
Write-Output ""
Write-Output "PREFLIGHT - TESTBED_LANDMINES.md walked against $against"
foreach ($r in $script:Results) {
    if ($Quiet -and $r.Status -in @('PASS', 'N/A')) { continue }
    Write-Output ("  {0,-3} {1,-5} {2}" -f $r.Id, $r.Status, $r.Title)
    if ($r.Detail -and $r.Status -ne 'PASS') { Write-Output ("        " + ($r.Detail -replace "`n", "`n        ")) }
    elseif ($r.Detail -and -not $Quiet) { Write-Output ("        " + $r.Detail) }
}
Write-Output ""

if ($fails.Count) {
    Write-Output "PREFLIGHT FAILED: $($fails.Count) landmine(s) live - $(($fails.Id) -join ', ')"
    if (-not $WarnOnly) { exit 1 }
    exit 0
}
if ($warns.Count) { Write-Output "PREFLIGHT PASSED with $($warns.Count) warning(s) - $(($warns.Id) -join ', ')" }
else { Write-Output "PREFLIGHT PASSED" }
exit 0
