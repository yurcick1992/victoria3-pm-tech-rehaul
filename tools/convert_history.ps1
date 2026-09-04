<#
  PM & Tech Rehaul - 1836 game-start (history) converter.

  The 1836 start is generated from <game>/common/history/buildings/*.txt (no bundled save).
  Each split-industry factory is created as its vanilla base building with its tier encoded in
  the active MAIN production method. This script re-tiers every such factory onto the correct
  new building, and applies manual overrides from config/start_exceptions.json.

  Per create_building block of a split industry:
    - map (vanilla base building + active main PM) -> (correct tier building key + our main PM),
    - rewrite `building=`, the self-ownership `type=`, and the main-PM token (secondary tokens kept).
  Manual exceptions (by building, optionally scoped to country/state) can force a specific tier
  or remove the factory. All 16 files are re-emitted to mod/common/history/buildings/ because
  metadata.json uses replace_paths on that folder.

  Usage:  powershell -ExecutionPolicy Bypass -File tools\convert_history.ps1 [-Game "<path to Victoria 3\game>"]
#>
param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
    [string]$Config,
    [string]$ModDir = 'mod'   # output mod folder (relative to Repo); build.ps1 passes the -DryRun/-SaveTo target
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'history_lib.ps1')

$histDir = Join-Path $Game 'common\history\buildings'
if (-not (Test-Path $histDir)) { throw "History dir not found: $histDir (set -Game or VIC3_GAME)" }
$outDir = Join-Path $Repo (Join-Path $ModDir 'common\history\buildings')
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
# Clear stale output first. metadata.json puts this folder under `replace_paths`, so the mod's copy
# is the ONLY history the engine reads: a file vanilla dropped in a patch would otherwise keep
# placing its factories forever, from a leftover we never rewrite.
Remove-Item (Join-Path $outDir '*.txt') -Force -ErrorAction SilentlyContinue

$cfgPath = if ($Config) { (Resolve-Path -LiteralPath $Config).Path } else { Join-Path $Repo 'config\mod_config.json' }
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
# model_only tiers are not emitted as buildings, so the 1836 start can never place one. Dropping them here
# also keeps `force_tier`'s bounds check (tiers.Count) honest — it must count BUILDABLE tiers.
foreach ($ind in $cfg.industries) { $ind.tiers = @($ind.tiers | Where-Object { -not $_.model_only }) }
$maps = Get-SplitMaps $cfg
# ⚠ A `disabled` industry is left VANILLA and never enters $industryById, so a start rule naming one
# hit the "unknown industry" throw and killed the build. That is the right error for a TYPO and the
# wrong one for an industry this book deliberately does not tier — the four-rung arm hands ports,
# shipyards and railways back, and start_exceptions still carries the §10.60.3 chain seed for them.
# So the two cases are separated: a rule for a DISABLED industry is skipped and reported; a rule for
# an industry that does not exist at all still throws.
$disabledIds = @{}
foreach ($ind in $cfg.industries) { if ($ind.disabled) { $disabledIds[[string]$ind.id] = $true } }
$skippedRules = 0
$baseIndustry = $maps.baseIndustry; $pmMap = $maps.pmMap; $industryById = $maps.industryById

# manual exceptions (optional)
$rules = @()
# `start_exceptions_file` in the config names another rule set (the four-rung canon names an EMPTY one — its 1836 start is
# vanilla's, converted; the six-rung chain seed in config/start_exceptions.json must not reach it. User-ruled 2026-09-04)
$exPath = if ($cfg.start_exceptions_file) { Join-Path $Repo ($cfg.start_exceptions_file -replace '/', '\') } else { Join-Path $Repo 'config\start_exceptions.json' }
if (Test-Path $exPath) {
    $ex = Get-Content $exPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($ex.rules) { $rules = @($ex.rules) }
}

function Find-Exception($bkey, $country, $state) {
    $best = $null; $bestScore = -1
    foreach ($r in $rules) {
        if ($r.building -ne $bkey) { continue }
        if ($r.country -and $r.country -ne $country) { continue }
        if ($r.state   -and $r.state   -ne $state)   { continue }
        $score = 0; if ($r.country) { $score += 2 }; if ($r.state) { $score += 1 }
        if ($score -ge $bestScore) { $bestScore = $score; $best = $r }   # >= : last wins on tie
    }
    return $best
}

$script:converted = 0; $script:removed = 0; $script:forced = 0; $script:unmapped = @()
$script:levelsMultiplied = 0; $script:anchorClamped = 0   # §10.60 graded port factorisation counters
$script:ownerRewrites = 0   # §10.60.3 Q5a: blocks whose ownership was rewritten to the overlord
$script:ownerFormFixed = 0  # add_ownership blocks replaced with the government-ownership form (see below)

$handler = {
    param($block, $state, $country)
    $bkey = $null
    foreach ($l in $block) { if ($l -match 'building\s*=\s*"(building_[A-Za-z0-9_]+)"') { $bkey = $Matches[1]; break } }
    if (-not $bkey) { return ,$block }

    $ex = Find-Exception $bkey $country $state
    if ($ex -and $ex.action -eq 'remove') { $script:removed++; return @() }

    if (-not $baseIndustry.ContainsKey($bkey)) {
        if ($ex -and $ex.action -like 'force*') { Write-Warning "$($ex.action) on non-split building $bkey ignored ($country/$state)" }
        return ,$block   # non-split building, nothing to re-tier
    }
    $id = $baseIndustry[$bkey]

    $mainPm = $null
    foreach ($vpm in $pmMap[$id].Keys) {
        $needle = '"' + [regex]::Escape($vpm) + '"'
        foreach ($l in $block) { if ($l -match $needle) { $mainPm = $vpm; break } }
        if ($mainPm) { break }
    }
    if (-not $mainPm) { $script:unmapped += "$bkey @ $country/$state"; return ,$block }

    $tierIndex = $pmMap[$id][$mainPm].tier
    if ($ex -and $ex.action -eq 'force_industry_tier') {
        # Cross-industry force (user-ruled 2026-08-16, the 1836 steamer seed): re-tier this factory onto
        # ANOTHER config industry's tier — clipper shipyards -> building_shipyard_metal. `force_tier`
        # cannot express this: its tier index resolves inside the base building's OWN industry, and the
        # steam chain is a separate industry whose base building is all-new (never in vanilla history).
        # The rule must name a real industry id; a typo throws rather than silently keeping the old tier.
        $tid = [string]$ex.industry
        if ($disabledIds.ContainsKey($tid)) { $script:skippedRules++; continue }
        if (-not $industryById.ContainsKey($tid)) { throw "force_industry_tier: unknown industry '$tid' ($country/$state)" }
        $id = $tid
        $tierIndex = [int]$ex.tier
        $maxT = $industryById[$id].tiers.Count
        if ($tierIndex -lt 1) { $tierIndex = 1 }
        if ($tierIndex -gt $maxT) { $tierIndex = $maxT }
        $script:forced++
    }
    elseif ($ex -and $ex.action -eq 'force_tier') {
        $tierIndex = [int]$ex.tier
        $maxT = $industryById[$id].tiers.Count
        if ($tierIndex -lt 1) { $tierIndex = 1 }
        if ($tierIndex -gt $maxT) { $tierIndex = $maxT }
        $script:forced++
    }
    $tier = $industryById[$id].tiers[$tierIndex - 1]
    $tierKey = $tier.key; $newPm = $tier.pm_key

    # §10.60 GRADED PORT FACTORISATION: a tier carrying `workforce_mult` is a fractional-unit building
    # (its config goods/cost are explicitly divided; build.ps1 scales employment/effects by the
    # multipliers), so the 1836 start MULTIPLIES its levels by 1/workforce_mult to preserve physical
    # capacity. EXCEPTION, by the same ruling: anchorage-mapped ports stay at exactly level 1 — the
    # deliberately tiny colonial stub. All 90 vanilla anchorage entries are 1-level today; the clamp is
    # so a patch cannot silently change that.
    $div = if ($null -ne $tier.workforce_mult -and [double]$tier.workforce_mult -gt 0 -and [double]$tier.workforce_mult -lt 1) { [int][math]::Floor(1.0 / [double]$tier.workforce_mult + 0.5) } else { 1 }
    $clampOne = ($mainPm -eq 'pm_anchorage')

    $reBld  = 'building\s*=\s*"' + [regex]::Escape($bkey) + '"'
    $reType = 'type\s*=\s*"'     + [regex]::Escape($bkey) + '"'
    $rePm   = '"' + [regex]::Escape($mainPm) + '"'
    $res = New-Object System.Collections.Generic.List[string]
    foreach ($l in $block) {
        $nl = $l
        $nl = [regex]::Replace($nl, $reBld,  'building="' + $tierKey + '"')
        $nl = [regex]::Replace($nl, $reType, 'type="'     + $tierKey + '"')
        $nl = [regex]::Replace($nl, $rePm,   '"' + $newPm + '"')
        if ($clampOne) {
            if ($nl -match 'levels\s*=\s*(\d+)' -and [int]$Matches[1] -ne 1) { $script:anchorClamped++ }
            $nl = [regex]::Replace($nl, '(levels\s*=\s*)\d+', '${1}1')
        } elseif ($div -gt 1 -and $nl -match 'levels\s*=\s*\d+') {
            $nl = [regex]::Replace($nl, '(levels\s*=\s*)(\d+)', { param($m) $m.Groups[1].Value + ([int]$m.Groups[2].Value * $div) })
            $script:levelsMultiplied++
        }
        $res.Add($nl)
    }
    # §10.60.3 Q5a (user-ruled 2026-08-16 night): a rule may carry `owner` — the seeded building's
    # OWNERSHIP is rewritten to that country (the overlord), while the building stays physically in
    # the subject's state. Vanilla itself has cross-country 1836 ownership (SIL's African anchorages
    # are GBR-owned), and the engine demonstrably provisions steam ports into subject states without
    # the subject holding the tech.
    #
    # ⭐⭐ `owner` MEANS GOVERNMENT-OWNED BY THAT COUNTRY (user ruling, 2026-08-17). A seeded building is
    # a STATE GRANT from the market leader, not a private investment, so its whole `add_ownership` block
    # is REPLACED with a single government entry — never patched in place, and never carrying a financial
    # district or a manor house.
    #
    #     add_ownership={ country={ country="c:<owner>" levels=<total> } }
    #
    # ⚠⚠ WHY THE RULE HAD TO BE STATED, and why a financial district ever entered the picture. This
    # started as a blunt regex over every `country="c:X"` token in the block. For an ANCHORAGE that is
    # harmless — vanilla already owns those as government (`country={ country="c:PLY" levels=1 }`), so
    # swapping the tag gives exactly the intended result. But vanilla owns SHIPYARDS **privately**:
    #     building={ type="building_financial_district" country="c:DEI" region="STATE_WEST_JAVA" }
    # and rewriting only the country token there produces "NET's financial district in West Java" — a
    # building that does not exist. The engine then silently declines the whole `create_building`.
    # Inheriting vanilla's ownership SHAPE was the mistake; a grant should assert its own.
    #
    # ⚠ Multi-owner blocks collapse to one government owner with the levels summed. That is intended
    # here — these are grants — but it is why `owner` does not belong on an ordinary vanilla factory.
    if ($ex -and $ex.owner) {
        $own = New-Object System.Collections.Generic.List[string]
        $ri = 0
        while ($ri -lt $res.Count) {
            $line = $res[$ri]
            if ($line -match '^(\s*)add_ownership=\{\s*$') {
                $indent = $Matches[1]
                # consume the whole ownership block, summing whatever levels it declared
                $rj = $ri + 1; $depth = 1; $levels = 0
                while ($rj -lt $res.Count -and $depth -gt 0) {
                    if ($res[$rj] -match '\{') { $depth++ }
                    if ($res[$rj] -match '\}') { $depth-- ; if ($depth -eq 0) { break } }
                    if ($res[$rj] -match 'levels\s*=\s*(\d+)') { $levels += [int]$Matches[1] }
                    $rj++
                }
                if ($levels -lt 1) { $levels = 1 }
                $own.Add($indent + 'add_ownership={')
                $own.Add($indent + "`tcountry={")
                $own.Add($indent + "`t`tcountry=`"c:" + $ex.owner + '"')
                $own.Add($indent + "`t`tlevels=" + $levels)
                $own.Add($indent + "`t}")
                $own.Add($indent + '}')
                $script:ownerFormFixed++
                $ri = $rj + 1
                continue
            }
            $own.Add($line)
            $ri++
        }
        $res = $own
        $script:ownerRewrites++
    }
    $script:converted++
    return ,$res.ToArray()
}

# ⭐⭐ `action: create` — A GRANT THAT ADDS A BUILDING INSTEAD OF CONSUMING ONE (user-ruled 2026-08-17).
#
# Every other action here RE-TIERS a building vanilla already placed, which ties a grant to whatever
# happens to stand in that state. That constraint is what split the industry grants across states and
# forced them to eat unrelated industries: FRA's motor factory had to be a paper mill because Brittany
# contains nothing but shipyards, and NET's had to be a food industry. The user's requirement — ALL
# industry grants in ONE state per market leader, at Home Counties / Brittany / Amsterdam — is simply
# not expressible by conversion.
#
# So a `create` rule emits a fresh `create_building` block into `s:<state> { region_state:<country> }`:
#   { action:"create", industry:"motor", tier:1, country:"FRA", state:"STATE_BRITTANY", levels:4 }
# Ownership is the market leader's GOVERNMENT, the same form the `owner` rewrite produces — a grant is a
# state endowment, never a financial district's private holding.
#
# ⚠ It THROWS if the target region_state is not found. A grant that silently lands nowhere is exactly
# the failure mode that let the chain seed ship 13 of its 25 stubs, and this path has no linter behind it.
$creates = @($rules | Where-Object { $_.action -eq 'create' })
$script:created = 0
$script:createPlaced = @{}

$files = Get-ChildItem $histDir -Filter *.txt
foreach ($f in $files) {
    $outLines = Walk-HistoryFile $f.FullName $handler

    foreach ($cr in $creates) {
        # ⚠ TOLERATE WHITESPACE AROUND `=`. The history files are not uniform - `region_state:DEI={` in
        # some, `region_state:BIC = {` in others - and a literal match silently found nothing for the
        # spaced ones. The create guard below caught it (STATE_PEGU), which is why that guard exists.
        $anchor = '^\s*s:' + [regex]::Escape($cr.state) + '\s*='
        $rs     = '^\s*region_state:' + [regex]::Escape($cr.country) + '\s*='
        # find the state, then its region_state, then that block's closing brace
        $si = -1; for ($i = 0; $i -lt $outLines.Count; $i++) { if ($outLines[$i] -match $anchor) { $si = $i; break } }
        if ($si -lt 0) { continue }
        $ri = -1; for ($i = $si + 1; $i -lt $outLines.Count; $i++) {
            if ($outLines[$i] -match '^\ts:') { break }
            if ($outLines[$i] -match $rs) { $ri = $i; break }
        }
        if ($ri -lt 0) { continue }
        $depth = 1; $ci = -1
        for ($i = $ri + 1; $i -lt $outLines.Count; $i++) {
            $depth += ([regex]::Matches($outLines[$i], '\{')).Count
            $depth -= ([regex]::Matches($outLines[$i], '\}')).Count
            if ($depth -le 0) { $ci = $i; break }
        }
        if ($ci -lt 0) { throw "create: region_state:$($cr.country) in $($cr.state) has no closing brace" }

        if ($disabledIds.ContainsKey([string]$cr.industry)) { $script:skippedRules++; continue }
        $ind = $industryById[[string]$cr.industry]
        if (-not $ind) { throw "create: unknown industry '$($cr.industry)'" }
        $tier = $ind.tiers[[int]$cr.tier - 1]
        if (-not $tier) { throw "create: $($cr.industry) has no tier $($cr.tier)" }
        $lv = if ($cr.levels) { [int]$cr.levels } else { 1 }
        # WHERE it sits and WHO owns it are different questions. `country` is the region_state it is
        # placed in (a subject's state, for a colonial port); `owner` is the government that owns it
        # (the market leader). Default: the state's own country owns it.
        $ownTag = if ($cr.owner) { [string]$cr.owner } else { [string]$cr.country }

        $blk = @(
            "`t`t`tcreate_building={",
            "`t`t`t`tbuilding=`"$($tier.key)`"",
            "`t`t`t`tadd_ownership={",
            "`t`t`t`t`tcountry={",
            "`t`t`t`t`t`tcountry=`"c:$ownTag`"",
            "`t`t`t`t`t`tlevels=$lv",
            "`t`t`t`t`t}",
            "`t`t`t`t}",
            "`t`t`t`treserves=1",
            "`t`t`t`tactivate_production_methods={ `"$($tier.pm_key)`" }",
            "`t`t`t}")
        $new = New-Object System.Collections.Generic.List[string]
        if ($ci -gt 0) { $new.AddRange([string[]]$outLines[0..($ci - 1)]) }
        $new.AddRange([string[]]$blk)
        $new.AddRange([string[]]$outLines[$ci..($outLines.Count - 1)])
        $outLines = $new.ToArray()
        $script:created++
        $script:createPlaced[($cr.country + '/' + $cr.state + ' ' + $tier.key)] = $lv
    }

    $text = ($outLines -join "`r`n") + "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $outDir $f.Name), $text, (New-Object System.Text.UTF8Encoding($true)))
}
# ⭐⭐ THE WORKFORCE FOR A GRANTED FACTORY (user-ruled 2026-08-17). A granted building with no workers
# staffs itself only slowly, out of whatever the state's existing pops can spare, so an INDUSTRY grant
# also spawns its own labour: the market leader's PRIMARY CULTURE, one pop per profession the tier
# employs, in the state the factory was placed in.
#
# SIZE. Each of the three granted tiers employs exactly 5 000 per level, and a pop's WORKFORCE is its
# size × WORKING_ADULT_RATIO_BASE (0.25) — so a pop that supplies 5 000 workers numbers 20 000 people,
# dependents included, which is what the ruling asks for ("5k or so workers, with their dependents
# within their pops"). Per profession: size = employment / 0.25.
#
# ⚠ PORTS GET NONE, by the same ruling. They are tiny stubs in colonial states and importing a British
# workforce into them is neither wanted nor plausible.
# ⚠ ADDITIVE FILE, not a replacement: `common/history/pops` is NOT in metadata's `replace_paths` (only
# `common/history/buildings` is), so this file adds pops rather than replacing vanilla's.
$WORKING_ADULT_RATIO = 0.25
$primaryCulture = @{ GBR = 'british'; FRA = 'french'; NET = 'dutch' }
$popStates = @{}
foreach ($cr in $creates) {
    if ($cr.industry -eq 'port') { continue }          # ports get no workforce
    # …and a rule for a DISABLED industry seeded no building above, so it must seed no pops either.
    # This is the second pass over $creates; guarding only the first left $ind null here.
    if ($disabledIds.ContainsKey([string]$cr.industry)) { continue }
    $ind  = $industryById[[string]$cr.industry]
    $tier = $ind.tiers[[int]$cr.tier - 1]
    $lv   = if ($cr.levels) { [int]$cr.levels } else { 1 }
    $ownTag = if ($cr.owner) { [string]$cr.owner } else { [string]$cr.country }
    $cul = $primaryCulture[$ownTag]
    if (-not $cul) { throw "create: no primary culture known for $ownTag - add it to `$primaryCulture" }
    if (-not $tier.employment) { continue }
    $key = "$($cr.state)|$($cr.country)"
    if (-not $popStates.ContainsKey($key)) { $popStates[$key] = @{} }
    foreach ($p in $tier.employment.PSObject.Properties) {
        $people = [int][math]::Round(($p.Value * $lv) / $WORKING_ADULT_RATIO)
        if ($people -le 0) { continue }
        $pk = "$cul|$($p.Name)"
        $popStates[$key][$pk] = [int]$popStates[$key][$pk] + $people
    }
}
if ($popStates.Count -gt 0) {
    $popDir = Join-Path $Repo (Join-Path $ModDir 'common\history\pops')
    if (-not (Test-Path $popDir)) { New-Item -ItemType Directory -Force -Path $popDir | Out-Null }
    $out = New-Object System.Collections.Generic.List[string]
    $out.Add('# GENERATED by tools/convert_history.ps1 - the workforce for CREATED industry grants.')
    $out.Add('# One pop per profession the granted tier employs, of the market leader''s primary culture,')
    $out.Add('# sized employment / 0.25 so the pop carries its dependents. Ports get none. ADDITIVE.')
    $out.Add('POPS = {')
    $script:popPeople = 0
    foreach ($k in ($popStates.Keys | Sort-Object)) {
        $st, $co = $k.Split('|')
        $out.Add("`ts:$st = {")
        $out.Add("`t`tregion_state:$co = {")
        foreach ($pk in ($popStates[$k].Keys | Sort-Object)) {
            $cul, $prof = $pk.Split('|')
            $n = $popStates[$k][$pk]; $script:popPeople += $n
            $out.Add("`t`t`tcreate_pop = { culture = $cul pop_type = $prof size = $n }")
        }
        $out.Add("`t`t}")
        $out.Add("`t}")
    }
    $out.Add('}')
    [System.IO.File]::WriteAllText((Join-Path $popDir 'zzz_pm_rehaul_seed_pops.txt'), (($out -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
    Write-Output ("  seed workforce: {0} people across {1} state(s), {2} pop(s)" -f `
        $script:popPeople, $popStates.Count, ($popStates.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum)
}

# A grant that found no home is a silent hole — fail rather than ship a seed that isn't there.
foreach ($cr in $creates) {
    # a rule for a disabled industry placed nothing on purpose, so it cannot be a "silent hole" —
    # the THIRD and last pass over $creates that has to know that
    if ($disabledIds.ContainsKey([string]$cr.industry)) { continue }
    $ind = $industryById[[string]$cr.industry]
    $key = $cr.country + '/' + $cr.state + ' ' + $ind.tiers[[int]$cr.tier - 1].key
    if (-not $script:createPlaced.ContainsKey($key)) {
        # ASCII only inside a string literal: this file is read as ANSI, so a multi-byte character
        # (an em-dash, a section sign) corrupts the literal and the whole script fails to parse.
        throw "create: no region_state:$($cr.country) found in $($cr.state) - the grant '$key' would vanish silently"
    }
}

Write-Output ("History conversion: {0} factories re-tiered ({1} forced, {2} removed) across {3} files; {4} exception rule(s)." -f `
    $script:converted, $script:forced, $script:removed, $files.Count, $rules.Count)
if ($script:levelsMultiplied -gt 0 -or $script:anchorClamped -gt 0) {
    Write-Output ("  §10.60 port factorisation: {0} ownership levels line(s) multiplied by 1/workforce_mult; {1} anchorage entr(ies) clamped above level 1." -f `
        $script:levelsMultiplied, $script:anchorClamped)
}
if ($script:ownerRewrites -gt 0) {
    Write-Output ("  §10.60.3 Q5a: {0} seeded block(s) granted to overlord GOVERNMENT ownership ({1} add_ownership block(s) replaced)." -f `
        $script:ownerRewrites, $script:ownerFormFixed)
}
if ($script:created -gt 0) {
    Write-Output ("  industry grants CREATED (government-owned, not converted): {0}" -f $script:created)
    foreach ($k in ($script:createPlaced.Keys | Sort-Object)) { Write-Output ("    {0} x{1}" -f $k, $script:createPlaced[$k]) }
}
if ($script:unmapped.Count -gt 0) {
    Write-Output ("  WARNING: {0} split-industry blocks had no recognized main PM (version drift?):" -f $script:unmapped.Count)
    $script:unmapped | Select-Object -Unique | ForEach-Object { Write-Output "    $_" }
}

if ($skippedRules -gt 0) { Write-Host "  start rules skipped (their industry is disabled in this config): $skippedRules" }
