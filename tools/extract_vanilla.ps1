<#
  PM & Tech Rehaul - vanilla building/PMG/PM extractor.

  Dumps the WHOLE vanilla building economy (every building, production_method_group and
  production_method) into ui/vanilla.js as `window.PMVANILLA`, so the balance UI's all-buildings
  explorer can show every building, tiered or not.

  This is READ-ONLY reference data: it re-reads the live game each run, so a patch is a one-command
  refresh. It does NOT touch config or the mod. build.ps1 runs it on every CANONICAL build
  (-DryRun / -SaveTo builds leave ui/ alone); nothing gates it - the UI always shows every building.

  Output shape (all keys are the vanilla ids):
    window.PMVANILLA = {
      buildings: { building_x: { group, unique(bool), tech, city, pmgs:[...] }, ... },
      pmgs:      { pmg_x: { pms:[...] }, ... },
      pms:       { pm_x: { in:{good:qty}, out:{good:qty}, emp:{pop:qty}, mods:{name:val}, gated?:true }, ... }
                 (gated = power-bloc-gated: has unlocking_principles; the UI never defaults to it)
    }

  Usage:  powershell -ExecutionPolicy Bypass -File tools\extract_vanilla.ps1 [-Game "<...\Victoria 3\game>"]
#>
param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" })
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'history_lib.ps1')   # Get-TopBlocks / Get-ListTokens

# --- buildings ---
$bBlocks = Get-TopBlocks (Join-Path $Game 'common\buildings') 'building_'
$buildings = [ordered]@{}
foreach ($name in $bBlocks.Keys) {
    $blk = $bBlocks[$name]; $joined = ($blk -join " ")
    $group  = if ($joined -match 'building_group\s*=\s*(bg_[A-Za-z0-9_]+)') { $Matches[1] } else { $null }
    $unique = [bool]($joined -match 'unique\s*=\s*yes')
    $tech   = if ($joined -match 'unlocking_technologies\s*=\s*\{\s*([A-Za-z0-9_]+)') { $Matches[1] }
              elseif ($joined -match 'unlocking_technologies\s*=\s*\{[^}]*\b([A-Za-z0-9_]+)\b') { $Matches[1] } else { $null }
    $city   = if ($joined -match 'city_type\s*=\s*([A-Za-z0-9_]+)') { $Matches[1] } else { $null }
    # base ai_value: a scalar `ai_value = N`, or the `value = N` at the head of an `ai_value = { … }` block.
    # $null when unscripted (engine default 1000). Used only for the UI's ai_value default display.
    $aiv = if ($joined -match 'ai_value\s*=\s*(-?\d+)') { [int]$Matches[1] }
           elseif ($joined -match 'ai_value\s*=\s*\{\s*value\s*=\s*(-?\d+)') { [int]$Matches[1] } else { $null }
    $pmgs   = @(Get-ListTokens $blk 'production_method_groups' 'pmg_')
    $buildings[$name] = [ordered]@{ group = $group; unique = $unique; tech = $tech; city = $city; ai_value = $aiv; pmgs = $pmgs }
}

# --- pmgs ---
$gBlocks = Get-TopBlocks (Join-Path $Game 'common\production_method_groups') 'pmg_'
$pmgs = [ordered]@{}
foreach ($name in $gBlocks.Keys) {
    # PM names are NOT all pm_-prefixed (plantations/farms use default_/automatic_/worker_/slave_/… ,
    # e.g. default_building_cotton_plantation), so capture every token in the production_methods list.
    $pmgs[$name] = [ordered]@{ pms = @(Get-ListTokens $gBlocks[$name] 'production_methods' '') }
}

# --- pms (goods in/out, employment, and other *_add modifiers) ---
# Every top-level block in a production_methods file IS a PM, whatever its name prefix (see above).
$pBlocks = Get-TopBlocks (Join-Path $Game 'common\production_methods') ''
$pms = [ordered]@{}
foreach ($name in $pBlocks.Keys) {
    $in = [ordered]@{}; $out = [ordered]@{}; $emp = [ordered]@{}; $mods = [ordered]@{}; $gated = $false
    # A PM's own unlocking technology. Needed to answer "which secondary PM would a country of this era
    # actually be running?" — without it, a model has to guess from the PM's position in its group, and
    # would hand an 1836 farm its 1900 fertilizer method. Paired with the $techEra table below.
    $pmTech = if (($pBlocks[$name] -join ' ') -match 'unlocking_technologies\s*=\s*\{\s*([A-Za-z0-9_]+)') { $Matches[1] } else { $null }
    # A few secondary PMs are gated behind a MAIN PM being present in the same building (pm_bone_china,
    # pm_elastics, pm_precision_tools). Anything choosing PMs has to respect that or it will switch on a
    # secondary the building cannot actually run.
    $pmGate = @(Get-ListTokens $pBlocks[$name] 'unlocking_production_methods' '')
    # EVERY OTHER GATE a PM can carry. Vanilla uses eight mechanisms and we used to model three, so the
    # PM chooser happily selected a Japan-only rice method and slave-exploitation plantations for a
    # country with no slaves. Captured here so anything picking PMs can evaluate them properly.
    $pmLaws     = @(Get-ListTokens $pBlocks[$name] 'unlocking_laws' '')
    $pmNoLaws   = @(Get-ListTokens $pBlocks[$name] 'disallowing_laws' '')
    $pmRegions  = @(Get-ListTokens $pBlocks[$name] 'unlocking_geographic_regions' '')
    $pmCompany  = @(Get-ListTokens $pBlocks[$name] 'unlocking_company_categories' '')
    $pmIdentity = @(Get-ListTokens $pBlocks[$name] 'unlocking_identity' '')
    $pmRel      = @(Get-ListTokens $pBlocks[$name] 'unlocking_religions' '')
    $pmNoRel    = @(Get-ListTokens $pBlocks[$name] 'disallowing_religions' '')
    # Goods values are NOT always integers: subsistence / urban-centre / agro PMs use fractions
    # (grain 1.0, fabric 0.5, meat 0.33, ...). Matching only \d+ silently truncated those to 0.
    # PROFESSION RATIO — how a MILITARY building splits its manpower between soldiers and officers.
    # ⚠ This is NOT `building_employment_*_add`, and that is why it was invisible: no PM in the entire
    # game employs `soldiers` or `officers` through the normal employment path, so a scan for employers
    # finds none and the professions look like they simply do not exist. They come from
    # `profession_ratio = { soldiers = 97 officers = 3 }` inside the barracks/naval training PMs, which
    # ranges 97/3 -> 75/25 as the training method improves. Without it every scenario has ZERO officers,
    # and officers are a MIDDLE-stratum consumer.
    $prof = [ordered]@{}; $inProf = $false
    foreach ($l in $pBlocks[$name]) {
        if ($inProf) {
            if ($l -match '\}') { $inProf = $false }
            elseif ($l -match '^\s*([a-z][a-z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)\s*$') { $prof[$Matches[1]] = Get-Num $Matches[2] }
            continue
        }
        if ($l -match 'profession_ratio\s*=\s*\{') { $inProf = $true; continue }
    }
    foreach ($l in $pBlocks[$name]) {
        if     ($l -match 'goods_input_([a-z_]+)_add\s*=\s*(-?\d+(?:\.\d+)?)')  { $in[$Matches[1]]  = Get-Num $Matches[2] }
        elseif ($l -match 'goods_output_([a-z_]+)_add\s*=\s*(-?\d+(?:\.\d+)?)') { $out[$Matches[1]] = Get-Num $Matches[2] }
        elseif ($l -match 'building_employment_([a-z_]+)_add\s*=\s*(-?\d+)')  { $emp[$Matches[1]] = [int]$Matches[2] }
        elseif ($l -match '^\s*([a-z][a-z0-9_]*)_add\s*=\s*(-?\d+)\s*$')      { $mods[$Matches[1]] = [int]$Matches[2] }
        elseif ($l -match 'unlocking_principles\s*=')                        { $gated = $true }  # power-bloc-gated (only active with a bloc principle) — UI must not default to it
    }
    $rec = [ordered]@{ in = $in; out = $out; emp = $emp; mods = $mods }
    if ($prof.Count -gt 0) { $rec.prof = $prof }
    if ($gated) { $rec.gated = $true }
    if ($pmTech) { $rec.tech = $pmTech }
    if ($pmGate.Count -gt 0) { $rec.gate = $pmGate }
    if ($pmLaws.Count     -gt 0) { $rec.laws     = $pmLaws }
    if ($pmNoLaws.Count   -gt 0) { $rec.nolaws   = $pmNoLaws }
    if ($pmRegions.Count  -gt 0) { $rec.regions  = $pmRegions }
    if ($pmCompany.Count  -gt 0) { $rec.company  = $pmCompany }
    if ($pmIdentity.Count -gt 0) { $rec.identity = $pmIdentity }
    if ($pmRel.Count      -gt 0) { $rec.religion = $pmRel }
    if ($pmNoRel.Count    -gt 0) { $rec.noreligion = $pmNoRel }
    $pms[$name] = $rec
}

# --- technology -> era, read LIVE from the game (same source solve_be_targets.ps1 uses) ---
$techEra = [ordered]@{}
$techDir = Join-Path $Game 'common\technology\technologies'
if (Test-Path $techDir) {
    foreach ($f in (Get-ChildItem $techDir -Filter *.txt)) {
        $cur = $null
        foreach ($ln in (Get-Content -LiteralPath $f.FullName -Encoding UTF8)) {
            if ($ln -match '^\s*([a-z][A-Za-z0-9_]*)\s*=\s*\{') { $cur = $Matches[1]; continue }
            if ($null -ne $cur -and $ln -match '^\s*era\s*=\s*era_(\d)') { $techEra[$cur] = [int]$Matches[1]; $cur = $null }
        }
    }
}

# --- building groups: urbanization + the subsistence flag + the parent chain ---
# Needed to apply the F13 urban-centre rule outside PowerShell: a state raises floor(urbanization / 100)
# levels, where every building level contributes its group's `urbanization` EXCEPT groups flagged
# `is_subsistence`, which contribute nothing. Both fields INHERIT down the parent chain, so the chain has
# to ship too — a child group usually declares neither. Verified exact on 774 of 783 states (FINDINGS F13).
# tools/extract_presets.ps1 parses the same three fields for the same rule; keep them in step.
$groups = [ordered]@{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\building_groups') -Filter *.txt)) {
    $cur = $null
    foreach ($line in (Get-Content -LiteralPath $f.FullName -Encoding UTF8)) {
        if ($line -match '^\s*(bg_[A-Za-z0-9_]+)\s*=\s*\{') { $cur = $Matches[1]; if (-not $groups.Contains($cur)) { $groups[$cur] = [ordered]@{} }; continue }
        if (-not $cur) { continue }
        if ($line -match '^\s*parent_group\s*=\s*(bg_[A-Za-z0-9_]+)') { $groups[$cur].parent = $Matches[1] }
        if ($line -match '^\s*urbanization\s*=\s*(\d+)')              { $groups[$cur].urbanization = [int]$Matches[1] }
        if ($line -match '^\s*is_subsistence\s*=\s*yes')              { $groups[$cur].subsistence = $true }
    }
}

# --- write ui/vanilla.js ---
$payload = [ordered]@{ buildings = $buildings; pmgs = $pmgs; pms = $pms; groups = $groups; tech_era = $techEra }
$json = $payload | ConvertTo-Json -Depth 12 -Compress
$body = "// AUTO-GENERATED by tools/extract_vanilla.ps1 - vanilla building/PMG/PM reference for the balance UI.`n" +
        "// Read-only; regenerated from the live game on every canonical build.`n" +
        "window.PMVANILLA = $json;`n"
$outPath = Join-Path $Repo 'ui\vanilla.js'
[System.IO.File]::WriteAllText($outPath, $body, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("Extracted {0} buildings, {1} pmgs, {2} pms -> ui\vanilla.js ({3:N0} KB)" -f `
    $buildings.Count, $pmgs.Count, $pms.Count, ((Get-Item $outPath).Length / 1KB))
