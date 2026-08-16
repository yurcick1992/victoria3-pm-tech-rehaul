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
$baseIndustry = $maps.baseIndustry; $pmMap = $maps.pmMap; $industryById = $maps.industryById

# manual exceptions (optional)
$rules = @()
$exPath = Join-Path $Repo 'config\start_exceptions.json'
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
    $script:converted++
    return ,$res.ToArray()
}

$files = Get-ChildItem $histDir -Filter *.txt
foreach ($f in $files) {
    $outLines = Walk-HistoryFile $f.FullName $handler
    $text = ($outLines -join "`r`n") + "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $outDir $f.Name), $text, (New-Object System.Text.UTF8Encoding($true)))
}

Write-Output ("History conversion: {0} factories re-tiered ({1} forced, {2} removed) across {3} files; {4} exception rule(s)." -f `
    $script:converted, $script:forced, $script:removed, $files.Count, $rules.Count)
if ($script:levelsMultiplied -gt 0 -or $script:anchorClamped -gt 0) {
    Write-Output ("  §10.60 port factorisation: {0} ownership levels line(s) multiplied by 1/workforce_mult; {1} anchorage entr(ies) clamped above level 1." -f `
        $script:levelsMultiplied, $script:anchorClamped)
}
if ($script:unmapped.Count -gt 0) {
    Write-Output ("  WARNING: {0} split-industry blocks had no recognized main PM (version drift?):" -f $script:unmapped.Count)
    $script:unmapped | Select-Object -Unique | ForEach-Object { Write-Output "    $_" }
}
