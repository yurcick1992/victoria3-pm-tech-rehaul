<#
  PM & Tech Rehaul - volume solver.

  Regenerates every tier's ACTUAL volumes (output_qty + inputs) in config/mod_config.json from the
  design methodology (BALANCE_FRAMEWORK.md §8), re-deriving from the CURRENT vanilla recipes so it
  stays correct across game updates. Run it after changing target_be / output_mult, or after a game
  patch. It does NOT change target_be, techs, employment, names, etc. — only output_qty + inputs.

  Methodology, per industry:
    - baseOut = vanilla output qty of the TIER-1 vanilla_pm (from the game).
    - tier N output_qty = tier.output_override, else (N==1 ? baseOut : round(baseOut * mult^(N-1))),
      mult = industry.output_mult (default 1.5).
    - tier N inputs = the tier's OWN vanilla_pm input goods, scaled by one factor to hit target_be
      at base prices (so input↔input ratios stay vanilla), rounded to integers (min 1). target_be is
      the FULL break-even (input goods + wages). wage_pct is now the wage fraction of TOTAL cost, so
      W = wage_pct/(1-wage_pct) * I and total = I/(1-wage_pct); solving total/O = target_be gives
      I = target_be/100 * O * (1 - wage_pct):
        scale = (target_be/100 * outputValue * (1-wage_pct)) / vanillaInputValue ; qty[g] = round(vanilla_qty[g]*scale)
      wage_pct defaults to 25% (a per-tier `wage_pct` in the config overrides it). See BALANCE_FRAMEWORK §1/§8.

  Usage:  powershell -ExecutionPolicy Bypass -File tools\solve_volumes.ps1 [-Game "<...\Victoria 3\game>"]
#>
param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
    [double]$WagePct = 0.25   # wages as a fraction of TOTAL cost (goods + wages); default (per-tier wage_pct overrides)
)
$ErrorActionPreference = 'Stop'
function RoundHalfUp($x) { return [int][math]::Floor([double]$x + 0.5) }

# --- prices ---
$prices = @{}
foreach ($line in (Get-Content (Join-Path $Repo 'tools\goods_prices.tsv'))) {
    if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }
    $c = $line -split "`t"; if ($c.Count -ge 2) { $prices[$c[0].Trim()] = [double]$c[1].Trim() }
}

# --- parse vanilla recipes (pm -> @{out=@{good=qty}; ins=@{good=qty}}) from the game ---
# Read EVERY production_methods file (not just 01_industry) so PMs from 06_urban_center (power) and
# 11_private_infrastructure (port/railway) resolve too.
$recipes = @{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\production_methods') -Filter *.txt)) {
    $text = [System.IO.File]::ReadAllText($f.FullName)   # ReadAllText strips the BOM
    $cur = $null
    foreach ($l in ($text -split "`r?`n")) {
        if ($l -match '^(pm_[A-Za-z0-9_-]+)\s*=\s*\{') { $cur = $Matches[1]; $recipes[$cur] = @{ out = @{}; ins = @{} } }
        elseif ($cur) {
            if     ($l -match 'goods_input_([a-z_]+)_add\s*=\s*(-?\d+)')  { $recipes[$cur].ins[$Matches[1]] = [int]$Matches[2] }
            elseif ($l -match 'goods_output_([a-z_]+)_add\s*=\s*(-?\d+)') { $recipes[$cur].out[$Matches[1]] = [int]$Matches[2] }
        }
    }
}

# --- config ---
$cfg = Get-Content (Join-Path $Repo 'config\mod_config.json') -Raw | ConvertFrom-Json
$report = @()
foreach ($ind in $cfg.industries) {
    if ($ind.follows_be -eq $false) { continue }   # ports/railways stay on vanilla volumes - don't re-solve
    $mult = if ($null -ne $ind.output_mult) { [double]$ind.output_mult } else { 1.5 }
    $t1 = $ind.tiers[0]
    if (-not $recipes.ContainsKey($t1.vanilla_pm)) { Write-Warning "no vanilla recipe for $($t1.vanilla_pm) ($($ind.id)) - skipped"; continue }
    $t1OutGood = if ($t1.output_good) { $t1.output_good } else { $ind.output_good }
    $baseOut = [int]$recipes[$t1.vanilla_pm].out[$t1OutGood]
    if ($baseOut -le 0) { Write-Warning "tier-1 vanilla output for $($ind.id) is $baseOut - skipped"; continue }

    $n = 0
    foreach ($t in $ind.tiers) {
        $n++
        $outGood = if ($t.output_good) { $t.output_good } else { $ind.output_good }
        $outQty = if ($null -ne $t.output_override) { [int]$t.output_override }
                  elseif ($n -eq 1) { $baseOut }
                  else { RoundHalfUp ($baseOut * [math]::Pow($mult, $n - 1)) }
        $outVal = $outQty * $prices[$outGood]

        $van = $recipes[$t.vanilla_pm].ins
        $vanInVal = 0.0; foreach ($g in $van.Keys) { $vanInVal += $van[$g] * $prices[$g] }
        # target_be is the FULL break-even (input goods + wages). wage is the wage fraction of TOTAL,
        # so total = I/(1-wage). Solve total/O = target_be  =>  I = target_be/100 * O * (1-wage).
        $wage = if ($null -ne $t.wage_pct) { [double]$t.wage_pct } else { $WagePct }
        $scale = ($t.target_be / 100.0 * $outVal * (1 - $wage)) / $vanInVal

        $newIn = [ordered]@{}
        foreach ($g in ($van.Keys | Sort-Object)) { $q = RoundHalfUp ($van[$g] * $scale); if ($q -lt 1) { $q = 1 }; $newIn[$g] = $q }

        # write back
        $t.output_qty = $outQty
        $t.inputs = [pscustomobject]$newIn
        $actualIn = 0.0; foreach ($g in $newIn.Keys) { $actualIn += $newIn[$g] * $prices[$g] }
        $be = if ($outVal -gt 0) { $actualIn / (1 - $wage) / $outVal * 100 } else { 0 }   # full BE (total cost = goods/(1-wage))
        $report += [pscustomobject]@{ Building = $t.key; Tier = $n; Out = "$outGood x$outQty"; TargetBE = $t.target_be; ActualBE = [math]::Round($be) }
    }
}

$json = $cfg | ConvertTo-Json -Depth 30 -Compress
[System.IO.File]::WriteAllText((Join-Path $Repo 'config\mod_config.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("Solved volumes for {0} tiers across {1} industries -> config\mod_config.json" -f $report.Count, $cfg.industries.Count)
$report | Format-Table -AutoSize | Out-String | Write-Output
