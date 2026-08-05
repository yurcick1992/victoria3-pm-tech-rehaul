<#
  make_vanilla_stub.ps1 - derive a "tiering only" config from the real one.

  Produces a mod that keeps the STRUCTURE of the rehaul (one building per former main PM,
  gated on the same tech) but whose ECONOMICS are the base game's. That isolates the effect
  of the tier split itself - the AI now has to *construct* a newer building instead of
  flipping a production method for free - from the effect of our re-sloped recipes.

  It is the headless equivalent of the balance UI's "Bring to vanilla" button, and follows the
  same guideline (CLAUDE.md): everything editable+emittable goes back to base-game values,
  EXCEPT the tier split itself. Per tier, read live from the game:

    output_qty     <- the tier's own vanilla_pm output (NO x1.5 ladder)
    inputs         <- the tier's own vanilla_pm inputs  (NO break-even re-solve)
    building_cost  <- the PRE-SPLIT vanilla building's required_construction, resolved through
                      common/script_values/building_values.txt (low 200 / medium 400 / high 600 /
                      very_high 800 today - read live, not hardcoded)
    ai_value       <- the PRE-SPLIT vanilla building's ai_value (absent = engine default)
    target_be      <- recomputed from the vanilla recipe, so the generated building NAME states
                      the break-even this building actually has. Descriptive only; target_be is
                      never emitted as a game value.

  Employment is left alone: it is not editable+emittable through the UI yet, so per the same
  guideline it is out of scope for "bring to vanilla".

  Build the result WITHOUT the linter - it is deliberately off the break-even ladder:
    powershell -File tools\testbed\make_vanilla_stub.ps1
    powershell -File tools\build.ps1 -Config config\mod_config.vanilla_stub.json -SaveTo vanilla_stub -NoLint -NoDeploy
#>
[CmdletBinding()]
param(
    [string] $Game   = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
    [string] $Config = "",
    [string] $Out    = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $Repo 'tools\history_lib.ps1')   # Get-Num (fraction-safe vanilla number parse)
if (-not $Config) { $Config = Join-Path $Repo "config\mod_config.json" }
if (-not $Out)    { $Out    = Join-Path $Repo "config\mod_config.vanilla_stub.json" }

function RoundHalfUp($x) { return [int][math]::Floor([double]$x + 0.5) }

function Set-Prop {
    # not every tier carries every field (follows_be:false tiers have no building_cost, most
    # tiers have no ai_value), so set-or-add rather than assume
    param($Obj, [string]$Name, $Value)
    if ($Obj.PSObject.Properties.Name -contains $Name) { $Obj.$Name = $Value }
    else { $Obj | Add-Member -NotePropertyName $Name -NotePropertyValue $Value }
}

# --- prices (for the descriptive break-even only) ---
$prices = @{}
foreach ($line in (Get-Content (Join-Path $Repo 'tools\goods_prices.tsv'))) {
    if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }
    $c = $line -split "`t"; if ($c.Count -ge 2) { $prices[$c[0].Trim()] = [double]$c[1].Trim() }
}

# --- vanilla recipes: pm -> @{out=@{good=qty}; ins=@{good=qty}} ---
# Read EVERY production_methods file so power/port/railway PMs (06/11) resolve too.
$recipes = @{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\production_methods') -Filter *.txt)) {
    $cur = $null
    foreach ($l in ([System.IO.File]::ReadAllText($f.FullName) -split "`r?`n")) {
        if ($l -match '^(pm_[A-Za-z0-9_-]+)\s*=\s*\{') { $cur = $Matches[1]; $recipes[$cur] = @{ out = @{}; ins = @{} } }
        elseif ($cur) {
            # fraction-safe: matching only \d+ would capture "0" out of "0.5" and silently zero the good
            if     ($l -match 'goods_input_([a-z_]+)_add\s*=\s*(-?\d+(?:\.\d+)?)')  { $recipes[$cur].ins[$Matches[1]] = Get-Num $Matches[2] }
            elseif ($l -match 'goods_output_([a-z_]+)_add\s*=\s*(-?\d+(?:\.\d+)?)') { $recipes[$cur].out[$Matches[1]] = Get-Num $Matches[2] }
        }
    }
}

# --- construction-cost script values (live, not hardcoded) ---
$costValues = @{}
$sv = Join-Path $Game 'common\script_values\building_values.txt'
if (Test-Path $sv) {
    foreach ($l in (Get-Content $sv)) {
        if ($l -match '^\s*(construction_cost_[a-z_]+)\s*=\s*(\d+)') { $costValues[$Matches[1]] = [int]$Matches[2] }
    }
}

# --- vanilla buildings: key -> @{cost=<int>; ai=<int|null>} (depth-1 assignments only, so a
#     conditional ai_value block inside the building is not mistaken for the flat value) ---
$vanBuildings = @{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\buildings') -Filter *.txt)) {
    $depth = 0; $cur = $null
    foreach ($l in ([System.IO.File]::ReadAllText($f.FullName) -split "`r?`n")) {
        $code = ($l -replace '#.*$', '')
        if ($depth -eq 0 -and $code -match '^(building_[A-Za-z0-9_]+)\s*=\s*\{') {
            $cur = $Matches[1]; $vanBuildings[$cur] = @{ cost = $null; ai = $null }
        }
        elseif ($cur -and $depth -eq 1) {
            if ($code -match '^\s*required_construction\s*=\s*([A-Za-z0-9_]+)') {
                $tok = $Matches[1]
                $vanBuildings[$cur].cost = $(if ($tok -match '^\d+$') { [int]$tok } elseif ($costValues.ContainsKey($tok)) { $costValues[$tok] } else { $null })
            }
            elseif ($code -match '^\s*ai_value\s*=\s*(\d+)') { $vanBuildings[$cur].ai = [int]$Matches[1] }
        }
        $depth += ([regex]::Matches($code, '\{')).Count - ([regex]::Matches($code, '\}')).Count
        if ($depth -le 0) { $depth = 0; $cur = $null }
    }
}

# --- rewrite the config ---
$cfg = Get-Content $Config -Raw -Encoding UTF8 | ConvertFrom-Json
$WagePct = 0.25
$changed = 0; $skipped = @()

foreach ($ind in $cfg.industries) {
    if ($ind.PSObject.Properties.Name -contains 'disabled' -and $ind.disabled) { continue }

    # the pre-split vanilla building: Tier-1's key IS the vanilla base building (see CLAUDE.md)
    $baseKey = $ind.tiers[0].key
    $baseVan = $(if ($vanBuildings.ContainsKey($baseKey)) { $vanBuildings[$baseKey] } else { $null })
    if (-not $baseVan) { $skipped += "$($ind.id): no vanilla building '$baseKey' (all-new chain) - cost/ai_value left as configured" }

    foreach ($t in $ind.tiers) {
        # ⚠ A TIER MAY LEGITIMATELY HAVE NO `vanilla_pm`, and this script predates that. The five-era
        # ladder mints `model_only` tiers - modelled but never emitted, because the game has no technology
        # that would unlock them - and those have no vanilla production method to be brought back to by
        # construction. There is nothing to do for them here, which is correct: they are not in the game,
        # so they cannot differ from it.
        # ⚠ The guard must be an EXISTENCE test, not `-not $t.vanilla_pm`: this script runs under
        # StrictMode 2.0, where reading an absent property is a TERMINATING error rather than $null, so
        # the bare read below used to abort the whole run with "The property 'vanilla_pm' cannot be found".
        $hasVanPm = $t.PSObject.Properties.Name -contains 'vanilla_pm' -and $t.vanilla_pm
        if (-not $hasVanPm) {
            $isModelOnly = $t.PSObject.Properties.Name -contains 'model_only' -and $t.model_only
            $skipped += "$($ind.id)/$($t.key): no vanilla_pm$(if ($isModelOnly) { ' (model_only - not in the game at all)' } else { ' - CHECK THIS, a real tier should have one' })"
            continue
        }
        if (-not $recipes.ContainsKey($t.vanilla_pm)) {
            $skipped += "$($ind.id)/$($t.key): no vanilla recipe for $($t.vanilla_pm) - left as configured"
            continue
        }
        $outGood = $(if ($t.PSObject.Properties.Name -contains 'output_good' -and $t.output_good) { $t.output_good } else { $ind.output_good })
        $van     = $recipes[$t.vanilla_pm]
        $outQty  = $(if ($van.out.ContainsKey($outGood)) { [int]$van.out[$outGood] } else { 0 })
        if ($outQty -le 0) {
            $skipped += "$($ind.id)/$($t.key): vanilla_pm $($t.vanilla_pm) outputs no $outGood - left as configured"
            continue
        }

        $newIn = [ordered]@{}
        foreach ($g in ($van.ins.Keys | Sort-Object)) { $newIn[$g] = [int]$van.ins[$g] }

        Set-Prop $t 'output_qty' $outQty
        Set-Prop $t 'inputs'     ([pscustomobject]$newIn)

        # descriptive break-even of the vanilla recipe (wage-inclusive, same convention as the ladder)
        $wage = $(if ($t.PSObject.Properties.Name -contains 'wage_pct' -and $null -ne $t.wage_pct) { [double]$t.wage_pct } else { $WagePct })
        $inVal = 0.0; foreach ($g in $newIn.Keys) { $inVal += $newIn[$g] * $prices[$g] }
        $outVal = $outQty * $prices[$outGood]
        if ($outVal -gt 0) { Set-Prop $t 'target_be' (RoundHalfUp ($inVal / (1 - $wage) / $outVal * 100)) }

        if ($baseVan) {
            if ($null -ne $baseVan.cost) { Set-Prop $t 'building_cost' $baseVan.cost }
            if ($null -ne $baseVan.ai)   { Set-Prop $t 'ai_value' $baseVan.ai }
            elseif ($t.PSObject.Properties.Name -contains 'ai_value') {
                $t.PSObject.Properties.Remove('ai_value')   # vanilla leaves it at the engine default
            }
        }
        $changed++
    }
}

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Out, ($cfg | ConvertTo-Json -Depth 20 -Compress), $enc)

Write-Host "vanilla stub written: $Out"
Write-Host "  tiers set to vanilla recipes: $changed"
foreach ($s in $skipped) { Write-Host "  NOTE $s" }
