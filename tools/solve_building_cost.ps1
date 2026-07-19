<#
  PM & Tech Rehaul - building-cost solver.

  Fills every tier's `building_cost` (construction points -> emitted as required_construction) in
  config/mod_config.json from a 10-year-payback model (BALANCE_FRAMEWORK.md section 9). Run it after
  changing volumes/targets or a game patch, then build.ps1. It ONLY writes building_cost.

  Model (per tier, per level, weekly flows):
    I   = input cost at base prices  = sum(config input qty * base price)
    W   = wages = WagePct fraction of TOTAL cost       (WagePct=0.25 of total = +33% over goods)
    TC  = total operating cost = I + W = I / (1-WagePct)
    profit = weekly net profit = MarginPct * TC        (a 20% return on operating cost)
    cost_money = PaybackYears * WeeksPerYear * profit   (money the building must earn back)
    building_cost (points) = cost_money / money-per-construction-point, rounded to RoundTo.

  Money-per-construction-point is read from the CURRENT vanilla construction sector at 0 efficiency
  bonus, using the specified PM (default the "iron" PM pm_iron_frame_buildings):
    per_point = sum(goods_input * base price) / country_construction_add   (both weekly => tick cancels)

  Reading note: "output priced at BE+20pp" is realized here as a flat 20% return on total cost,
  because the literal "output = config-BE + 20pp, minus wages" goes negative for BE>~60% (all T1s)
  and yields a ~800x cost spread. See BALANCE_FRAMEWORK.md section 9 for the derivation and the
  rejected alternative.

  Usage:  powershell -ExecutionPolicy Bypass -File tools\solve_building_cost.ps1 [-Game "<...\Victoria 3\game>"]
#>
param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
    [double]$WagePct      = 0.25,   # wages as a fraction of TOTAL cost (goods + wages)
    [double]$MarginPct    = 0.20,   # net profit as a fraction of total operating cost
    [int]   $PaybackYears = 10,
    [int]   $WeeksPerYear = 52,     # Victoria 3 economy ticks weekly (52/yr)
    [int]   $RoundTo      = 5,       # round building_cost to a multiple of this (0 = exact integer)
    [string]$ConstructionPm = 'pm_iron_frame_buildings',
    [ValidateSet('cost','output')]
    [string]$Basis        = 'cost'   # profit basis: 'cost' = MarginPct of total operating cost (chosen,
                                     #   vanilla-hugging, 2.9x spread); 'output' = MarginPct of base
                                     #   output value (steeper capital-demand ladder, ~9x spread).
)
$ErrorActionPreference = 'Stop'
function RoundHalfUp($x) { return [int][math]::Floor([double]$x + 0.5) }

# --- prices ---
$prices = @{}
foreach ($line in (Get-Content (Join-Path $Repo 'tools\goods_prices.tsv'))) {
    if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }
    $c = $line -split "`t"; if ($c.Count -ge 2) { $prices[$c[0].Trim()] = [double]$c[1].Trim() }
}

# --- money-per-construction-point from the live construction sector (chosen PM, 0 efficiency bonus) ---
$conText = [System.IO.File]::ReadAllText((Join-Path $Game 'common\production_methods\13_construction.txt'))
$cur = $null; $conIns = @{}; $conAdd = 0
foreach ($l in ($conText -split "`r?`n")) {
    if ($l -match '^(pm_[A-Za-z0-9_-]+)\s*=\s*\{') { $cur = $Matches[1]; continue }
    if ($cur -eq $ConstructionPm) {
        if     ($l -match 'goods_input_([a-z_]+)_add\s*=\s*(-?\d+)') { $conIns[$Matches[1]] = [int]$Matches[2] }
        elseif ($l -match 'country_construction_add\s*=\s*(-?\d+)')  { $conAdd = [int]$Matches[1] }
    }
}
if ($conAdd -le 0 -or $conIns.Count -eq 0) { throw "Could not parse construction PM '$ConstructionPm' from 13_construction.txt (add=$conAdd, inputs=$($conIns.Count))." }
$conGoodsVal = 0.0; foreach ($g in $conIns.Keys) { $conGoodsVal += $conIns[$g] * $prices[$g] }
$poundPerPoint = $conGoodsVal / $conAdd
Write-Output ("Money/construction-point = {0:N0} (PM {1}: {2:N0}/wk goods / {3} pts/wk)" -f $poundPerPoint, $ConstructionPm, $conGoodsVal, $conAdd)

# --- solve building_cost per tier ---
$cfg = Get-Content (Join-Path $Repo 'config\mod_config.json') -Raw | ConvertFrom-Json
$horizon = $PaybackYears * $WeeksPerYear   # weeks of profit the build cost must equal
$report = @()
foreach ($ind in $cfg.industries) {
    if ($ind.follows_be -eq $false) { continue }   # ports/railways keep vanilla required_construction (no building_cost)
    $n = 0
    foreach ($t in $ind.tiers) {
        $n++
        $I = 0.0; foreach ($p in $t.inputs.PSObject.Properties) { $I += [double]$p.Value * $prices[$p.Name] }
        $outGood = if ($t.output_good) { $t.output_good } else { $ind.output_good }
        $O = [double]$t.output_qty * $prices[$outGood]
        $wage = if ($null -ne $t.wage_pct) { [double]$t.wage_pct } else { $WagePct }   # per-tier override
        # weekly net profit under the chosen basis
        $profit = if ($Basis -eq 'output') { $MarginPct * $O } else { $MarginPct * $I / (1 - $wage) }
        $cost = $horizon * $profit / $poundPerPoint
        $pts = if ($RoundTo -gt 0) { [int]([math]::Round($cost / $RoundTo) * $RoundTo) } else { RoundHalfUp $cost }
        if ($pts -lt 1) { $pts = 1 }
        $t | Add-Member -NotePropertyName building_cost -NotePropertyValue $pts -Force
        $report += [pscustomobject]@{ Building = $t.key.Replace('building_',''); Tier = $n; InputCost = [math]::Round($I); BuildingCost = $pts; Disabled = [bool]$ind.disabled }
    }
}

$json = $cfg | ConvertTo-Json -Depth 30 -Compress
[System.IO.File]::WriteAllText((Join-Path $Repo 'config\mod_config.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("Solved building_cost for {0} tiers across {1} industries -> config\mod_config.json" -f $report.Count, $cfg.industries.Count)
$basisDesc = if ($Basis -eq 'output') { "$($MarginPct.ToString('P0')) of output value" } else { "$($MarginPct.ToString('P0')) return on total cost" }
Write-Output ("Model: {0}yr payback, {1} basis ({2}), {3:P0} wages, {4} wk/yr." -f $PaybackYears, $Basis, $basisDesc, $WagePct, $WeeksPerYear)
$report | Format-Table -AutoSize | Out-String | Write-Output
