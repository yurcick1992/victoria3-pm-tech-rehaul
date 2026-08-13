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
    [string]$Session = ''               # a session folder to walk the POST-RUN entries against (L12)
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
    # L12 needs a finished SESSION, not a mod - it is the one post-run entry, and it reports N/A
    # (never FAIL) when no -Session is given, so it costs a build nothing.
    @{ Id = 'L12'; Artifact = $false; Fn = { Test-LmL12 } },
    @{ Id = 'L14'; Artifact = $true;  Fn = { Test-LmL14 } },
    @{ Id = 'L15'; Artifact = $true;  Fn = { Test-LmL15 } }
)
if ($RepoOnly) { $CHECKS = @($CHECKS | Where-Object { -not $_.Artifact }) }

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
