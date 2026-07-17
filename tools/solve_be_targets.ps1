<#
  solve_be_targets.ps1 - derive each tier's target_be from its tech's era (natural unlock date).

  Model (BALANCE_FRAMEWORK, date-ladder):
    target_be(tier) = anchor(era) - 15 * [era<=3 AND the recipe consumes a manufactured input]
      anchor: e1..e5 = 140 115 90 65 50   (the date curve; ~25pp/era, 2-era gap = ~50pp -> N+2 obsolescence)
      H1 manufactured-input discount (-15pp) only in eras 1-3, where factory intermediates trade
      above base; off in H2 (eras 4-5), where those markets have matured.
    natural_year(tier) = a representative unlock year for the tech's era (for UI display).

  There is intentionally NO within-era differentiation: every tier on the same era gets the same
  target_be (the eras themselves will be reworked later). Era per tech is read LIVE from the game
  (patch-proof). Default: report-only. -Write patches target_be + natural_year into the config.
#>
param(
  [string]$Game   = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
  [string]$Config = "config\mod_config.json",
  [switch]$Write
)
$ErrorActionPreference = 'Stop'

$anchor  = @{1=140; 2=115; 3=90; 4=65; 5=50}
# Representative natural-unlock year per era. Vanilla era bands: e1 pre-1836, e2 1836-61,
# e3 1862-86, e4 1887-1911, e5 1911-36; we use each band's midpoint (e1 = the 1836 start).
$eraYear = @{1=1836; 2=1848; 3=1874; 4=1899; 5=1923}
$H1_MAX_ERA   = 3
$MFG_DISCOUNT = 15
$FLOOR        = 45

# Goods produced by manufacturing (an input drawn from another factory, not an RGO), used to apply
# the H1 manufactured-input discount to a consuming tier.
# NOT counted as manufactured for this purpose: dye and silk. Both are RGO/plantation-sourced in H1
# (dye plantations, sericulture) and trade near base then, so a consumer of dye/silk is not
# structurally input-squeezed the way a consumer of tools/steel/engines is. (Dye is only factory-made
# later via the synthetics plant, i.e. H2, where the discount is off anyway.)
$MFG_GOODS = @('tools','steel','engines','fertilizer','explosives','paper','glass','clothes',
  'furniture','groceries','ammunition','artillery','small_arms','automobiles','aeroplanes',
  'telephones','radios','steamers','clippers','fabric_synthetic')

# ---- read era per tech, live from the game ----
$techDir = Join-Path $Game 'common\technology\technologies'
if (-not (Test-Path $techDir)) { throw "tech dir not found: $techDir (set VIC3_GAME)" }
$techEra = @{}
foreach ($f in Get-ChildItem $techDir -Filter *.txt) {
  $cur = $null
  foreach ($ln in (Get-Content $f.FullName)) {
    if ($ln -match '^([a-z_][a-z0-9_]*)\s*=\s*\{') { $cur = $Matches[1]; continue }
    if ($null -ne $cur -and $ln -match '^\s*era\s*=\s*era_(\d)') { $techEra[$cur] = [int]$Matches[1]; $cur = $null }
  }
}

function BE-For($techName, $hasMfg) {
  $e  = $techEra[$techName]
  $be = $anchor[$e]
  if ($e -le $H1_MAX_ERA -and $hasMfg) { $be -= $MFG_DISCOUNT }
  if ($be -lt $FLOOR) { $be = $FLOOR }
  [pscustomobject]@{ era = $e; year = $eraYear[$e]; be = [int]$be }
}

# ---- walk config ----
$cfg = Get-Content $Config -Raw | ConvertFrom-Json
"{0,-16} {1,-3} {2,-24} {3,-4} {4,-6} {5,-9} {6}" -f 'industry','T','tech','era','year','inputs','BE'
"".PadRight(80,'-')
foreach ($i in $cfg.industries) {
  $ti = 0
  foreach ($t in $i.tiers) {
    $ti++
    $ins = @(); if ($t.inputs) { $ins = $t.inputs.PSObject.Properties.Name }
    $man = @($ins | Where-Object { $MFG_GOODS -contains $_ })
    $hasMfg = $man.Count -gt 0
    if (-not $techEra.ContainsKey($t.tech)) { Write-Warning "unknown tech $($t.tech) ($($i.id) T$ti)"; continue }
    $r = BE-For $t.tech $hasMfg
    $mark = if ($r.era -le $H1_MAX_ERA -and $hasMfg) { 'MFG-15' } elseif ($hasMfg) { '(mfg,H2)' } else { 'raw' }
    "{0,-16} T{1} {2,-24} e{3}  {4}  {5,-9} {6,3}  {7}" -f $i.id,$ti,$t.tech,$r.era,$r.year,($man -join '+'),$r.be,$mark
    if ($Write) {
      # follows_be:false industries (ports, railways) stay on vanilla economics — keep their
      # (informational) target_be, don't overwrite it from the era ladder. natural_year is still useful.
      if ($i.follows_be -ne $false) { $t | Add-Member -NotePropertyName target_be -NotePropertyValue $r.be -Force }
      $t | Add-Member -NotePropertyName natural_year -NotePropertyValue $r.year -Force
    }
  }
}
if ($Write) {
  ($cfg | ConvertTo-Json -Depth 40 -Compress) | Set-Content $Config -NoNewline
  Write-Host "`n[written] target_be + natural_year -> $Config"
} else {
  Write-Host "`n(report only -- pass -Write to patch the config)"
}
