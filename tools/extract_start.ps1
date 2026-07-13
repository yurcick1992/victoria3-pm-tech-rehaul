<#
  PM & Tech Rehaul - 1836 start baseline extractor (version-robust).

  Reads whatever vanilla start is installed (<game>/common/history/buildings/*.txt) and produces
  config/start_baseline.json: an inventory of every split-industry factory (country, state,
  building, industry, active vanilla PM, implied tier, levels, owners) plus a per-industry
  summary and, crucially, an 'unmapped' list of split-industry factories whose active main PM is
  NOT in the config. That unmapped list is the drift alarm: if a game update renames/adds PMs, it
  shows up here so the config (vanilla_pm fields) can be refreshed and the converter stays correct.

  This is a read-only authoring/validation aid: browse start_baseline.json to see what exists
  (which countries/states have which tiers) before writing rules in config/start_exceptions.json.

  Usage:  powershell -ExecutionPolicy Bypass -File tools\extract_start.ps1 [-Game "<path to Victoria 3\game>"]
#>
param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" })
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'history_lib.ps1')

$histDir = Join-Path $Game 'common\history\buildings'
if (-not (Test-Path $histDir)) { throw "History dir not found: $histDir (set -Game or VIC3_GAME)" }

$cfg = Get-Content (Join-Path $Repo 'config\mod_config.json') -Raw | ConvertFrom-Json
$maps = Get-SplitMaps $cfg
$baseIndustry = $maps.baseIndustry; $pmMap = $maps.pmMap

$script:factories = New-Object System.Collections.Generic.List[object]
$script:unmapped  = New-Object System.Collections.Generic.List[object]

$handler = {
    param($block, $state, $country)
    $bkey = $null
    foreach ($l in $block) { if ($l -match 'building\s*=\s*"(building_[A-Za-z0-9_]+)"') { $bkey = $Matches[1]; break } }
    if ($bkey -and $baseIndustry.ContainsKey($bkey)) {
        $id = $baseIndustry[$bkey]
        $mainPm = $null
        foreach ($vpm in $pmMap[$id].Keys) {
            $needle = '"' + [regex]::Escape($vpm) + '"'
            foreach ($l in $block) { if ($l -match $needle) { $mainPm = $vpm; break } }
            if ($mainPm) { break }
        }
        $levels = 0; $owners = @()
        foreach ($l in $block) {
            if ($l -match 'levels\s*=\s*(\d+)') { $levels += [int]$Matches[1] }
            if ($l -match 'type\s*=\s*"(building_[A-Za-z0-9_]+)"') { $owners += $Matches[1] }
        }
        if ($mainPm) {
            $script:factories.Add([pscustomobject]@{
                country = $country; state = $state; building = $bkey; industry = $id
                vanilla_pm = $mainPm; tier = $pmMap[$id][$mainPm].tier; levels = $levels; owners = $owners
            })
        } else {
            $acts = @(); foreach ($l in $block) { if ($l -match 'activate_production_methods') { $acts += $l.Trim() } }
            $script:unmapped.Add([pscustomobject]@{ country = $country; state = $state; building = $bkey; activate = $acts })
        }
    }
    return ,$block
}

foreach ($f in (Get-ChildItem $histDir -Filter *.txt)) { [void](Walk-HistoryFile $f.FullName $handler) }

# --- summary: per industry -> total, per-tier counts, and per-country per-tier counts ---
$byIndustry = [ordered]@{}
foreach ($fac in $script:factories) {
    if (-not $byIndustry.Contains($fac.industry)) { $byIndustry[$fac.industry] = [ordered]@{ total = 0; tiers = [ordered]@{}; countries = [ordered]@{} } }
    $bi = $byIndustry[$fac.industry]
    $bi.total++
    $tk = "T$($fac.tier)"
    if (-not $bi.tiers.Contains($tk)) { $bi.tiers[$tk] = 0 }
    $bi.tiers[$tk]++
    if (-not $bi.countries.Contains($fac.country)) { $bi.countries[$fac.country] = [ordered]@{} }
    if (-not $bi.countries[$fac.country].Contains($tk)) { $bi.countries[$fac.country][$tk] = 0 }
    $bi.countries[$fac.country][$tk]++
}

$out = [ordered]@{
    _meta = [ordered]@{
        generated = (Get-Date).ToString('s')
        game = $Game
        total_split_factories = $script:factories.Count
        unmapped_count = $script:unmapped.Count
    }
    summary = $byIndustry
    unmapped = $script:unmapped
    factories = $script:factories
}
$json = $out | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText((Join-Path $Repo 'config\start_baseline.json'), $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ("Baseline: {0} split-industry factories -> config\start_baseline.json" -f $script:factories.Count)
foreach ($k in $byIndustry.Keys) {
    $t = ($byIndustry[$k].tiers.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
    Write-Output ("  {0,-10} total {1,-4} [{2}]" -f $k, $byIndustry[$k].total, $t)
}
if ($script:unmapped.Count -gt 0) {
    Write-Output ("  DRIFT: {0} split-industry factories have an unrecognized main PM - refresh config vanilla_pm fields." -f $script:unmapped.Count)
}
