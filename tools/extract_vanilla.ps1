<#
  PM & Tech Rehaul - vanilla building/PMG/PM extractor.

  Dumps the WHOLE vanilla building economy (every building, production_method_group and
  production_method) into ui/vanilla.js as `window.PMVANILLA`, so the balance UI can show every
  building as a PM-selection explorer (see the `include_all_buildings` toggle in mod_config.json).

  This is READ-ONLY reference data: it re-reads the live game each run, so a patch is a one-command
  refresh. It does NOT touch config or the mod. build.ps1 runs it when include_all_buildings is set.

  Output shape (all keys are the vanilla ids):
    window.PMVANILLA = {
      buildings: { building_x: { group, unique(bool), tech, city, pmgs:[...] }, ... },
      pmgs:      { pmg_x: { pms:[...] }, ... },
      pms:       { pm_x: { in:{good:qty}, out:{good:qty}, emp:{pop:qty}, mods:{name:val} }, ... }
    }

  Usage:  powershell -ExecutionPolicy Bypass -File tools\extract_vanilla.ps1 [-Game "<...\Victoria 3\game>"]
#>
param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" })
)
$ErrorActionPreference = 'Stop'

# Read every top-level `<prefix>NAME = { ... }` block from a directory of .txt files, brace-tracked.
# Returns an ordered hashtable name -> array of block lines (header .. matching close).
function Get-TopBlocks([string]$dir, [string]$prefix) {
    $blocks = [ordered]@{}
    foreach ($f in (Get-ChildItem -LiteralPath $dir -Filter *.txt | Sort-Object Name)) {
        $text = [System.IO.File]::ReadAllText($f.FullName)   # ReadAllText strips the BOM
        $lines = $text -split "`r?`n"
        $i = 0
        while ($i -lt $lines.Count) {
            if ($lines[$i] -match ("^(" + $prefix + "[A-Za-z0-9_-]+)\s*=\s*\{")) {   # keys may contain '-' (e.g. pm_coal-fired_plant)
                $name = $Matches[1]; $depth = 0
                $buf = New-Object System.Collections.Generic.List[string]
                do {
                    $ln = $lines[$i]
                    $depth += ([regex]::Matches($ln, '\{')).Count - ([regex]::Matches($ln, '\}')).Count
                    $buf.Add($ln); $i++
                } while ($i -lt $lines.Count -and $depth -gt 0)
                $blocks[$name] = $buf.ToArray()
            } else { $i++ }
        }
    }
    return $blocks
}

# Collect the `key_` tokens inside a `<field> = { ... }` list (single- or multi-line, no nested braces).
function Get-ListTokens([string[]]$block, [string]$field, [string]$tokenPrefix) {
    $joined = ($block -join " ")
    if ($joined -match ($field + '\s*=\s*\{([^}]*)\}')) {
        return ([regex]::Matches($Matches[1], '(' + $tokenPrefix + '[A-Za-z0-9_-]+)') | ForEach-Object { $_.Groups[1].Value })   # keys may contain '-'
    }
    return @()
}

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
    $pmgs   = @(Get-ListTokens $blk 'production_method_groups' 'pmg_')
    $buildings[$name] = [ordered]@{ group = $group; unique = $unique; tech = $tech; city = $city; pmgs = $pmgs }
}

# --- pmgs ---
$gBlocks = Get-TopBlocks (Join-Path $Game 'common\production_method_groups') 'pmg_'
$pmgs = [ordered]@{}
foreach ($name in $gBlocks.Keys) {
    $pmgs[$name] = [ordered]@{ pms = @(Get-ListTokens $gBlocks[$name] 'production_methods' 'pm_') }
}

# --- pms (goods in/out, employment, and other *_add modifiers) ---
$pBlocks = Get-TopBlocks (Join-Path $Game 'common\production_methods') 'pm_'
$pms = [ordered]@{}
foreach ($name in $pBlocks.Keys) {
    $in = [ordered]@{}; $out = [ordered]@{}; $emp = [ordered]@{}; $mods = [ordered]@{}
    foreach ($l in $pBlocks[$name]) {
        if     ($l -match 'goods_input_([a-z_]+)_add\s*=\s*(-?\d+)')          { $in[$Matches[1]]  = [int]$Matches[2] }
        elseif ($l -match 'goods_output_([a-z_]+)_add\s*=\s*(-?\d+)')         { $out[$Matches[1]] = [int]$Matches[2] }
        elseif ($l -match 'building_employment_([a-z_]+)_add\s*=\s*(-?\d+)')  { $emp[$Matches[1]] = [int]$Matches[2] }
        elseif ($l -match '^\s*([a-z][a-z0-9_]*)_add\s*=\s*(-?\d+)\s*$')      { $mods[$Matches[1]] = [int]$Matches[2] }
    }
    $pms[$name] = [ordered]@{ in = $in; out = $out; emp = $emp; mods = $mods }
}

# --- write ui/vanilla.js ---
$payload = [ordered]@{ buildings = $buildings; pmgs = $pmgs; pms = $pms }
$json = $payload | ConvertTo-Json -Depth 12 -Compress
$body = "// AUTO-GENERATED by tools/extract_vanilla.ps1 - vanilla building/PMG/PM reference for the balance UI.`n" +
        "// Read-only; regenerated from the live game. See the include_all_buildings toggle.`n" +
        "window.PMVANILLA = $json;`n"
$outPath = Join-Path $Repo 'ui\vanilla.js'
[System.IO.File]::WriteAllText($outPath, $body, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("Extracted {0} buildings, {1} pmgs, {2} pms -> ui\vanilla.js ({3:N0} KB)" -f `
    $buildings.Count, $pmgs.Count, $pms.Count, ((Get-Item $outPath).Length / 1KB))
