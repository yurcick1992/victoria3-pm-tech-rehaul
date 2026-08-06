<#
  score_save.ps1 - melt one archived autosave and score the pop-need substitution rule against it.

  ⭐ ONE GAMESTATE, BOTH SIDES. The weights, the buildings' supply and non-pop demand, and the cultures'
  current obsessions all come out of the SAME save; only the market order book comes from the run's own
  telemetry at the same dump date. That is what makes this a reconstruction rather than a cross-run
  comparison.

    powershell -File tools\testbed\score_save.ps1 -Save <path.v3> -Session <session dir> `
        -Market "British Market" -Probe STATE_MIDLANDS

  The melt is ~7x the save on disk and is deleted afterwards unless -Keep is given.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string] $Save,
  [string] $Session = "",
  [string] $Market  = "British Market",
  [string] $Probe   = "STATE_MIDLANDS",
  [string] $Run     = "1",
  [string] $Weights = "",
  [switch] $Keep
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$rakaly = Join-Path $repo "tools\vendor\rakaly\rakaly.exe"
if (-not (Test-Path $rakaly)) { throw "rakaly not found at $rakaly - see TESTBED_METRICS section 7 for the fetch command" }

$work = Join-Path $repo "tools\testbed\_score_work"
New-Item -ItemType Directory -Force -Path $work | Out-Null
$stem  = [IO.Path]::GetFileNameWithoutExtension($Save)
$melt  = Join-Path $work "$stem.melted.txt"

if (-not (Test-Path $melt)) {
  Write-Host "melting $Save ..."
  & $rakaly melt --format vic3 --unknown-key stringify -o $melt $Save | Out-Null
}
# ⚠ anchor at column 0: the save is full of nested `date=` fields (last_civil_war_date, price trends,
# migration records) and a leading-whitespace-tolerant pattern picks one of those instead — it read 1.1.1.
$date = (Select-String -Path $melt -Pattern '^date=(\d+\.\d+\.\d+)' -List).Matches[0].Groups[1].Value
Write-Host "gamestate date: $date"

$w  = Join-Path $work "$stem.weights.tsv"
$bg = Join-Path $work "$stem.bgoods.tsv"
$cu = Join-Path $work "$stem.cultures.tsv"
$wArg = if ($Weights) { @("--weights", $Weights) } else { @() }
node (Join-Path $repo "tools\testbed\melted_pop_need_weights.mjs") $melt --tsv $w @wArg
node (Join-Path $repo "tools\testbed\melted_building_goods.mjs")   $melt --tsv $bg
node (Join-Path $repo "tools\testbed\melted_cultures.mjs")         $melt --tsv $cu

if ($Session) {
  $mk = Join-Path $Session "markets_all.tsv"
  if (Test-Path $mk) {
    node (Join-Path $repo "tools\testbed\predict_pop_split.mjs") $w $bg $mk `
      --obsessions $cu --market $Market --probe $Probe --date $date --run $Run --no-culture
  } else { Write-Host "no markets_all.tsv in $Session yet - extraction done, scoring skipped" }
}
if (-not $Keep) { Remove-Item $melt -Force -ErrorAction SilentlyContinue }
Write-Host "artifacts: $w`n           $bg`n           $cu"
