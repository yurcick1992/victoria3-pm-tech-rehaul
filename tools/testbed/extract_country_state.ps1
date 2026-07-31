<#
  extract_country_state.ps1 - harvest the per-country telemetry out of a finished session.

  WHY THIS EXISTS: run_observer.ps1 parses only the MARKET/G lines (-> markets.tsv) and the EV
  lines (-> events.tsv). The country_state metric block (GDP / BLD / LVL / WORLD) is emitted by
  the builder and lands in the run's debug.log, but nothing harvests it. Until the harness does
  that inline, this script recovers it from logs_live/ after the fact.

  logs_live/ is the authoritative copy (the game's own logs/ is a 5x512KB rotating ring shared by
  every run and can hold a previous run's rotated files).

  Emits, at the session root:
    country_state.tsv  run_index  dump_date  country  gdp  foreign_owned_frac  foreign_owned_abs
                       gdp_abroad  market
    buildings.tsv      run_index  dump_date  country  kind(bld|lvl)  total  mfg  extract  agri
                       subsist  gold
    world.tsv          run_index  dump_date  world_gdp
    country_flags.tsv  run_index  dump_date  country  at_war  civil_war  revolutionary  in_default
                       (absent for sessions run before the STATE metric existed)

  Usage: extract_country_state.ps1 -Session <session dir>
#>
param(
    [Parameter(Mandatory=$true)][string]$Session
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Session)) { throw "session not found: $Session" }

$cs = [System.Collections.Generic.List[string]]::new()
$bl = [System.Collections.Generic.List[string]]::new()
$wd = [System.Collections.Generic.List[string]]::new()
$cs.Add("run_index`tdump_date`tcountry`tgdp`tforeign_owned_frac`tforeign_owned_abs`tgdp_abroad`tmarket")
$bl.Add("run_index`tdump_date`tcountry`tkind`ttotal`tmfg`textract`tagri`tsubsist`tgold")
$wd.Add("run_index`tdump_date`tworld_gdp")
$fl = [System.Collections.Generic.List[string]]::new()
$fl.Add("run_index`tdump_date`tcountry`tat_war`tcivil_war`trevolutionary`tin_default")

$runs = Get-ChildItem $Session -Directory -Filter 'run*' | Sort-Object Name
foreach ($r in $runs) {
    if ($r.Name -notmatch '^run0*(\d+)') { continue }
    $idx = [int]$Matches[1]
    $log = Join-Path $r.FullName 'logs_live\debug.log'
    if (-not (Test-Path $log)) { Write-Warning "no logs_live\debug.log in $($r.Name)"; continue }

    # The run's own token, so a line from another run can never be counted here.
    $tok = $null
    $metaPath = Join-Path $r.FullName 'meta.json'
    if (Test-Path $metaPath) { $tok = (Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json).token }

    $n = 0
    foreach ($line in [System.IO.File]::ReadLines($log, [System.Text.Encoding]::UTF8)) {
        $i = $line.IndexOf('V3TB|')
        if ($i -lt 0) { continue }
        $f = $line.Substring($i).Split('|')
        if ($f.Count -lt 4) { continue }
        if ($tok -and $f[1] -ne $tok) { continue }
        switch ($f[2]) {
            'GDP'   { if ($f.Count -ge 10) { $cs.Add("$idx`t$($f[3])`t$($f[4])`t$($f[5])`t$($f[6])`t$($f[7])`t$($f[8])`t$($f[9])"); $n++ } }
            'BLD'   { if ($f.Count -ge 11) { $bl.Add("$idx`t$($f[3])`t$($f[4])`tbld`t$($f[5])`t$($f[6])`t$($f[7])`t$($f[8])`t$($f[9])`t$($f[10])"); $n++ } }
            'LVL'   { if ($f.Count -ge 11) { $bl.Add("$idx`t$($f[3])`t$($f[4])`tlvl`t$($f[5])`t$($f[6])`t$($f[7])`t$($f[8])`t$($f[9])`t$($f[10])"); $n++ } }
            'WORLD' { if ($f.Count -ge 5)  { $wd.Add("$idx`t$($f[3])`t$($f[4])"); $n++ } }
            'STATE' {
                # fields 5..8 arrive as "war=1" / "civil=0" / ... - strip the label, keep the value
                if ($f.Count -ge 9) {
                    $v = @(4..8 | ForEach-Object { ($f[$_] -replace '^[a-z]+=','') })
                    $fl.Add("$idx`t$($f[3])`t$($v[0])`t$($v[1])`t$($v[2])`t$($v[3])`t$($v[4])"); $n++
                }
            }
        }
    }
    Write-Output ("run {0,-3} {1,6} rows" -f $idx, $n)
}

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Join-Path $Session 'country_state.tsv'), $cs, $enc)
[System.IO.File]::WriteAllLines((Join-Path $Session 'buildings.tsv'),     $bl, $enc)
[System.IO.File]::WriteAllLines((Join-Path $Session 'world.tsv'),         $wd, $enc)
if ($fl.Count -gt 1) { [System.IO.File]::WriteAllLines((Join-Path $Session 'country_flags.tsv'), $fl, $enc) }
Write-Output ""
Write-Output ("country_state.tsv {0} rows / buildings.tsv {1} rows / world.tsv {2} rows / country_flags.tsv {3} rows" -f ($cs.Count-1), ($bl.Count-1), ($wd.Count-1), ($fl.Count-1))
