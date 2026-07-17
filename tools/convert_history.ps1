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

$cfgPath = if ($Config) { (Resolve-Path -LiteralPath $Config).Path } else { Join-Path $Repo 'config\mod_config.json' }
$cfg = Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
$maps = Get-SplitMaps $cfg
$baseIndustry = $maps.baseIndustry; $pmMap = $maps.pmMap; $industryById = $maps.industryById

# manual exceptions (optional)
$rules = @()
$exPath = Join-Path $Repo 'config\start_exceptions.json'
if (Test-Path $exPath) {
    $ex = Get-Content $exPath -Raw | ConvertFrom-Json
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

$handler = {
    param($block, $state, $country)
    $bkey = $null
    foreach ($l in $block) { if ($l -match 'building\s*=\s*"(building_[A-Za-z0-9_]+)"') { $bkey = $Matches[1]; break } }
    if (-not $bkey) { return ,$block }

    $ex = Find-Exception $bkey $country $state
    if ($ex -and $ex.action -eq 'remove') { $script:removed++; return @() }

    if (-not $baseIndustry.ContainsKey($bkey)) {
        if ($ex -and $ex.action -eq 'force_tier') { Write-Warning "force_tier on non-split building $bkey ignored ($country/$state)" }
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
    if ($ex -and $ex.action -eq 'force_tier') {
        $tierIndex = [int]$ex.tier
        $maxT = $industryById[$id].tiers.Count
        if ($tierIndex -lt 1) { $tierIndex = 1 }
        if ($tierIndex -gt $maxT) { $tierIndex = $maxT }
        $script:forced++
    }
    $tier = $industryById[$id].tiers[$tierIndex - 1]
    $tierKey = $tier.key; $newPm = $tier.pm_key

    $reBld  = 'building\s*=\s*"' + [regex]::Escape($bkey) + '"'
    $reType = 'type\s*=\s*"'     + [regex]::Escape($bkey) + '"'
    $rePm   = '"' + [regex]::Escape($mainPm) + '"'
    $res = New-Object System.Collections.Generic.List[string]
    foreach ($l in $block) {
        $nl = $l
        $nl = [regex]::Replace($nl, $reBld,  'building="' + $tierKey + '"')
        $nl = [regex]::Replace($nl, $reType, 'type="'     + $tierKey + '"')
        $nl = [regex]::Replace($nl, $rePm,   '"' + $newPm + '"')
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
if ($script:unmapped.Count -gt 0) {
    Write-Output ("  WARNING: {0} split-industry blocks had no recognized main PM (version drift?):" -f $script:unmapped.Count)
    $script:unmapped | Select-Object -Unique | ForEach-Object { Write-Output "    $_" }
}
