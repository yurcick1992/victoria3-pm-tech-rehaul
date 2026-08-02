<#
  summarise.ps1 - turn a finished session's raw logs into a compact, queryable summary.

  THE SUMMARY IS A CACHE; THE RAW LOG IS THE RECORD. This script must stay re-runnable over
  archived (gzipped) sessions, so a field added later can be back-filled instead of lost. That is
  what makes it safe to compress raws aggressively - and compression is what makes the
  never-delete rule affordable (CLAUDE.md).

  THREE TIERS, per run:
    summary.json   ~100 KB  <- meta-batch analysis reads ONLY this
    *.tsv          ~7 MB    <- drill-down; tabular because every analysis so far was awk over TSV
    logs .gz       ~5 MB    <- archive, never deleted

  Emits per run, beside the harness's own markets.tsv / events.tsv:
    country_state.tsv  run dump country gdp fo_frac fo_abs gdp_abroad market
    buildings.tsv      run dump country kind(bld|lvl) total mfg extract agri subsist gold
    pop.tsv            run dump country workforce peasants slaves dependents unemp_rate total_pop
                       + derived peasant_pct / employed_pct / unemp_pct
    country_flags.tsv  run dump country at_war civil_war revolutionary in_default
    treasury.tsv       run dump country gold principal maxcredit remcredit balance pool poolchange
                       unrealized weeklyexp
    world.tsv          run dump world_gdp
    summary.json       provenance + integrity + pace + world aggregates

  ⚠ PHASED DUMPS: since 2026-08-01 one logical dump is emitted over three consecutive months
  (market goods, then country/pop, then treasury). The logged date is the LOGICAL one, so grouping
  by dump_date is correct - but the country set can differ by a few between phases (annexations
  between months). Join on country name and tolerate small differences; never assume the treasury
  row count equals the GDP row count.

  IT READS BOTH LOG COPIES. The live mirror can miss lines when a dump writes faster than the ring
  is polled; those lines are usually still in the game's own ring, which the harness snapshots at
  exit. This script reads both and de-duplicates by exact payload, so the summary is complete even
  when the mirror is short. Verified: a run the harness flagged as 2013 lines short recovered
  exactly 2013. Consequence: the harness's MIRROR INCOMPLETE warning is a recovery estimate, not a
  loss alarm - real loss is a summarise run that recovers FEWER lines than the warning reported.

  Usage:
    summarise.ps1 -Session <session dir> [-Compress]
#>
param(
    [Parameter(Mandatory=$true)][string]$Session,
    [switch]$Compress
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Session)) { throw "session not found: $Session" }

# MODDING_NOTES: on a ru-RU machine PowerShell formats 51.94 as "51,94", which silently corrupts
# every TSV consumer. Pin the whole script to invariant formatting.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

function Open-MaybeGz {
    # Returns a StreamReader over path or path.gz, whichever exists.
    param([string]$Path)
    if (Test-Path $Path) { return New-Object System.IO.StreamReader($Path, [System.Text.Encoding]::UTF8) }
    if (Test-Path "$Path.gz") {
        $fs = [System.IO.File]::OpenRead("$Path.gz")
        $gz = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Decompress)
        return New-Object System.IO.StreamReader($gz, [System.Text.Encoding]::UTF8)
    }
    return $null
}

$cs = [System.Collections.Generic.List[string]]::new(); $cs.Add("run`tdump`tcountry`tgdp`tfo_frac`tfo_abs`tgdp_abroad`tmarket")
$bl = [System.Collections.Generic.List[string]]::new(); $bl.Add("run`tdump`tcountry`tkind`ttotal`tmfg`textract`tagri`tsubsist`tgold")
$pp = [System.Collections.Generic.List[string]]::new(); $pp.Add("run`tdump`tcountry`tworkforce`tpeasants`tslaves`tdependents`tunemp_rate`ttotal_pop`tpeasant_pct`temployed_pct`tunemp_pct")
$fl = [System.Collections.Generic.List[string]]::new(); $fl.Add("run`tdump`tcountry`tat_war`tcivil_war`trevolutionary`tin_default")
$tr = [System.Collections.Generic.List[string]]::new(); $tr.Add("run`tdump`tcountry`tgold`tprincipal`tmaxcredit`tremcredit`tbalance`tpool`tpoolchange`tunrealized`tweeklyexp")
$wd = [System.Collections.Generic.List[string]]::new(); $wd.Add("run`tdump`tworld_gdp")
$runSummaries = @()

foreach ($r in (Get-ChildItem $Session -Directory -Filter 'run*' | Sort-Object Name)) {
    if ($r.Name -notmatch '^run0*(\d+)') { continue }
    $idx = [int]$Matches[1]
    $meta = $null; $mp = Join-Path $r.FullName 'meta.json'
    if (Test-Path $mp) { $meta = Get-Content $mp -Raw -Encoding UTF8 | ConvertFrom-Json }
    $tok = if ($meta) { $meta.token } else { $null }

    # READ THE MIRROR **AND** THE EXIT SNAPSHOT OF THE GAME'S RING, then de-duplicate.
    # The live mirror can miss lines when a dump writes faster than the ring is polled (measured:
    # ~2000 lines on an all-markets run). Those lines are often still sitting in the game's own
    # rotating logs, which the harness copies at exit - which is exactly how the integrity check
    # detects the loss in the first place. Reading both and de-duplicating by exact payload
    # recovers them at zero runtime cost, and is idempotent: a line present in both is kept once.
    $sources = @(Join-Path $r.FullName 'logs_live\debug.log')
    $ring = Join-Path $r.FullName 'logs'
    if (Test-Path $ring) {
        # highest index first = oldest content first, so recovered lines land in emission order
        $sources += (Get-ChildItem $ring -Filter 'debug*.log' -ErrorAction SilentlyContinue |
                     Sort-Object { if ($_.Name -match 'debug\.(\d+)\.log') { -[int]$Matches[1] } else { 0 } } |
                     ForEach-Object { $_.FullName })
    }

    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $recovered = 0
    $dups = 0; $n = 0
    $seed = ""; $schema = ""
    $phaseClock = @{}      # "dump|phase" -> HH:MM:SS of its BEGIN
    $countryFirst = @{}; $countryLast = @{}

    $srcIdx = 0
    foreach ($src in $sources) {
      $srcIdx++
      $rd = Open-MaybeGz $src
      if (-not $rd) { continue }
      $beforeCount = $n
      while ($null -ne ($line = $rd.ReadLine())) {
        $i = $line.IndexOf('V3TB|')
        if ($i -lt 0) { continue }
        $payload = $line.Substring($i)
        $f = $payload.Split('|')
        if ($f.Count -lt 3) { continue }
        if ($tok -and $f[1] -ne $tok) { continue }
        if (-not $seen.Add($payload)) { $dups++; continue }
        $n++
        # wall clock from the log's own "[HH:MM:SS]" prefix
        $clock = if ($line -match '^\[(\d{2}:\d{2}:\d{2})\]') { $Matches[1] } else { "" }

        switch ($f[2]) {
            'SEED'  { if ($f.Count -ge 4) { $seed = $f[3] } }
            'BOOT'  { if ($f.Count -ge 4) { $schema = $f[3] } }
            'BEGIN' { if ($f.Count -ge 5 -and $clock) { $phaseClock["$($f[3])|$($f[4])"] = $clock } }
            'GDP'   { if ($f.Count -ge 10) {
                        $cs.Add("$idx`t$($f[3])`t$($f[4])`t$($f[5])`t$($f[6])`t$($f[7])`t$($f[8])`t$($f[9])")
                        if (-not $countryFirst.ContainsKey($f[4])) { $countryFirst[$f[4]] = $f[3] }
                        $countryLast[$f[4]] = $f[3] } }
            'BLD'   { if ($f.Count -ge 11) { $bl.Add("$idx`t$($f[3])`t$($f[4])`tbld`t$($f[5])`t$($f[6])`t$($f[7])`t$($f[8])`t$($f[9])`t$($f[10])") } }
            'LVL'   { if ($f.Count -ge 11) { $bl.Add("$idx`t$($f[3])`t$($f[4])`tlvl`t$($f[5])`t$($f[6])`t$($f[7])`t$($f[8])`t$($f[9])`t$($f[10])") } }
            'WORLD' { if ($f.Count -ge 5)  { $wd.Add("$idx`t$($f[3])`t$($f[4])") } }
            'STATE' { if ($f.Count -ge 9)  {
                        $v = @(5..8 | ForEach-Object { ($f[$_] -replace '^[a-z]+=','') })
                        $fl.Add("$idx`t$($f[3])`t$($f[4])`t$($v[0])`t$($v[1])`t$($v[2])`t$($v[3])") } }
            'POP'   { if ($f.Count -ge 10) {
                        $wf=[double]$f[5]; $pe=[double]$f[6]; $sl=[double]$f[7]; $ur=[double]$f[9]
                        $unp = 100*$ur; $pep = if ($wf -gt 0) { 100*$pe/$wf } else { 0 }
                        $slp = if ($wf -gt 0) { 100*$sl/$wf } else { 0 }
                        $emp = [Math]::Max(0, 100 - $pep - $slp - $unp)
                        $pp.Add(("{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}`t{7}`t{8}`t{9:N2}`t{10:N2}`t{11:N2}" -f `
                                 $idx,$f[3],$f[4],$f[5],$f[6],$f[7],$f[8],$f[9],$f[10],$pep,$emp,$unp)) } }
            'TCASH' { if ($f.Count -ge 13 -and $f[4] -ne 'ABSENT') {
                        $tr.Add("$idx`t$($f[3])`t$($f[4])`t$($f[5])`t$($f[6])`t$($f[7])`t$($f[8])`t$($f[9])`t$($f[10])`t$($f[11])`t$($f[12])`t$($f[13])") } }
        }
      }
      $rd.Dispose()
      # Anything new found in a ring file is a line the live mirror missed.
      if ($srcIdx -gt 1 -and ($n - $beforeCount) -gt 0) { $recovered += ($n - $beforeCount) }
    }

    # --- COMPLETENESS GATE ---------------------------------------------------------------
    # A dump can arrive PARTIAL: the v8 arm lost most of two country phases (58 and 141 rows
    # against ~283) even with phased dumps, 200 ms polling and ring recovery. A short dump is
    # indistinguishable from real attrition unless it is flagged - "France is missing" reads as
    # a country that stopped existing, when it may just be a lost line. So measure it here,
    # BEFORE anything is analysed, and put it in summary.json where the analysis will see it.
    $rowsPerDump = @{}
    foreach ($row in $cs) {
        if ($row -like "run`tdump*") { continue }
        $p = $row.Split("`t")
        if ($p.Count -lt 2 -or $p[0] -ne "$idx") { continue }
        $rowsPerDump[$p[1]] = 1 + $(if ($rowsPerDump.ContainsKey($p[1])) { $rowsPerDump[$p[1]] } else { 0 })
    }
    $peak = 0; foreach ($v in $rowsPerDump.Values) { if ($v -gt $peak) { $peak = $v } }
    # Country counts fall naturally as states are annexed, so compare against this run's OWN peak
    # rather than a fixed number, and only cry foul well below any plausible attrition curve.
    $short = @()
    foreach ($d in ($rowsPerDump.Keys | Sort-Object)) {
        if ($peak -gt 0 -and $rowsPerDump[$d] -lt [int]($peak * 0.6)) {
            $short += [ordered]@{ dump = $d; rows = $rowsPerDump[$d]; expected_at_least = [int]($peak*0.6) }
        }
    }
    if ($short.Count -gt 0) {
        Write-Warning ("run {0}: {1} PARTIAL dump(s) - {2}. Exclude these from country-level analysis." -f `
            $idx, $short.Count, (($short | ForEach-Object { "$($_.dump)=$($_.rows) rows" }) -join ', '))
    }

    # --- pace: wall-clock at each logical dump (phase 0), and the interval between dumps ---
    $dumps = ($phaseClock.Keys | ForEach-Object { $_.Split('|')[0] } | Sort-Object -Unique)
    $pace = @()
    $prevSec = $null; $prevDump = $null
    foreach ($d in $dumps) {
        $c = $phaseClock["$d|p0"]; if (-not $c) { $c = $phaseClock["$d|p1"] }
        if (-not $c) { continue }
        $t = [datetime]::ParseExact($c, 'HH:mm:ss', $null)
        $sec = $t.TimeOfDay.TotalSeconds
        $entry = [ordered]@{ dump = $d; clock = $c }
        if ($null -ne $prevSec) {
            $dt = $sec - $prevSec; if ($dt -lt 0) { $dt += 86400 }   # past midnight
            $y1 = [int]($prevDump.Split('.')[0]); $y2 = [int]($d.Split('.')[0])
            $entry.seconds_since_prev = [Math]::Round($dt, 1)
            if ($y2 -gt $y1 -and $dt -gt 0) { $entry.months_per_min = [Math]::Round(($y2-$y1)*12 / ($dt/60), 2) }
        }
        $pace += $entry
        $prevSec = $sec; $prevDump = $d
    }

    $runSummaries += [ordered]@{
        run = $idx
        setup = ($r.Name -replace '^run\d+_','')
        provenance = [ordered]@{
            telemetry_schema = $schema; seed = $seed
            game_version = $(if ($meta) { $meta.game_version } else { $null })
            wall_seconds = $(if ($meta) { $meta.wall_seconds } else { $null })
            reached = $(if ($meta) { $meta.reached_ingame_date } else { $null })
        }
        integrity = [ordered]@{
            dumps_seen = $dumps.Count
            dump_complete = $(if ($meta) { $meta.dump_complete } else { $null })
            attempts = $(if ($meta) { $meta.attempts } else { $null })
            resumes = $(if ($meta) { $meta.resumes } else { $null })
            error_log_lines = $(if ($meta) { $meta.error_log_lines } else { $null })
            telemetry_lines = $n
            duplicates_dropped = $dups
            lines_recovered_from_ring = $recovered
            # Country rows seen per dump, and any dump far below this run's own peak. A non-empty
            # partial_dumps list means those country-dates are incomplete, NOT that countries died.
            country_rows_per_dump = $rowsPerDump
            partial_dumps = $short
        }
        pace = $pace
        countries = [ordered]@{
            first_seen = $countryFirst   # for formation/annexation lineage (PRU -> GER etc.)
            last_seen  = $countryLast
        }
    }
    Write-Output ("run {0,-3} {1,7} telemetry lines, {2} dumps, {3} dup(s) dropped{4}" -f $idx, $n, $dumps.Count, $dups, $(if ($recovered) { ", $recovered RECOVERED from the ring snapshot" } else { "" }))
}

$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($p in @(@{n='country_state.tsv';d=$cs}, @{n='buildings.tsv';d=$bl}, @{n='pop.tsv';d=$pp},
                 @{n='country_flags.tsv';d=$fl}, @{n='treasury.tsv';d=$tr}, @{n='world.tsv';d=$wd})) {
    if ($p.d.Count -gt 1) { [System.IO.File]::WriteAllLines((Join-Path $Session $p.n), $p.d, $enc) }
}
$summary = [ordered]@{
    session = (Split-Path $Session -Leaf)
    generated = (Get-Date).ToString('o')
    note = "Summary is a CACHE - raw logs remain the record and this script re-runs over .gz archives."
    runs = $runSummaries
}
[System.IO.File]::WriteAllText((Join-Path $Session 'summary.json'), ($summary | ConvertTo-Json -Depth 8), $enc)
Write-Output ""
Write-Output ("summary.json + {0} TSV(s) -> {1}" -f 6, $Session)

if ($Compress) {
    # Only AFTER the summary exists and parses. Verify before destroying the plain text.
    $null = Get-Content (Join-Path $Session 'summary.json') -Raw | ConvertFrom-Json
    $saved = 0L; $before = 0L
    foreach ($f in (Get-ChildItem $Session -Recurse -File -Include *.log |
                    Where-Object { $_.FullName -match '\\logs(_live)?\\' })) {
        $before += $f.Length
        $out = "$($f.FullName).gz"
        $in  = [System.IO.File]::OpenRead($f.FullName)
        $os  = [System.IO.File]::Create($out)
        $gz  = New-Object System.IO.Compression.GZipStream($os, [System.IO.Compression.CompressionLevel]::Optimal)
        $in.CopyTo($gz); $gz.Dispose(); $os.Dispose(); $in.Dispose()
        $saved += (Get-Item $out).Length
        Remove-Item $f.FullName -Force
    }
    if ($before -gt 0) {
        Write-Output ("compressed logs: {0:N1} MB -> {1:N1} MB ({2:N1}x)" -f ($before/1MB), ($saved/1MB), ($before/[Math]::Max(1,$saved)))
    }
}
