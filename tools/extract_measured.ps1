<#
  PM & Tech Rehaul - measured 1836 reference -> config/measured_1836.json

  Everything else feeding the scenario presets is derived from the game FILES, so it refreshes on any
  build. These four things cannot be:

    * TRADE       - what a market actually imports and exports. The scenario assumes no trade routes,
                    but a real 1836 market has them, and they are indistinguishable from treaty
                    transfers in the order book (TESTBED_METRICS 3.3: orders cannot be decomposed by
                    channel). Measured per market per good.
    * SOL         - the people-weighted standard of living per stratum. Pop wealth is emergent, and
                    the flat 35/16/9 the presets used cannot be right for Britain and the Qing at
                    once (peasants run 4.5 in Japan against 12.1 in France).
    * MILITARY    - barracks and logistics/conscription centres. History creates a fraction of what
                    the game ends up with (31 British barrack levels in history against 705 in game),
                    because the engine sizes them to the army.
    * URBAN       - urban-centre levels. The extractor now DERIVES these (floor(urbanization/100) per
                    state, verified exact on 774/783 states), so this field is carried only as a
                    CROSS-CHECK on that derivation, never as its input.

  So this file is a committed snapshot of one game version's start, not a live derivation. It records
  the game version and session it came from, and `extract_presets.ps1` warns when the game version
  moves - a stale table is otherwise silently wrong rather than obviously missing.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\extract_measured.ps1 `
        -Session tools\testbed\sessions\<stamp>\run001_mod [-Date 1836.2.1]

  ⚠ DATE. Feb 1836, not the 1 January day-0 read, and that is a measured choice: construction goods
  spend is exactly 0.00 on day 0 in every country (the construction sector has not run a weekly tick
  yet) and reaches its settled level by 1836.2.1. Day 0 is history-faithful but economically
  unfinished. See FINDINGS F14.
#>
param(
    # One or more RUN folders. Several are averaged field by field - the 1836 start is nearly
    # deterministic for most metrics, but not all (urban-centre tram levels swing by a third between
    # runs, FINDINGS F16), so averaging is the honest default rather than trusting run 1.
    [Parameter(Mandatory=$true)][string[]]$Session,
    [string]$Date = '1836.2.1',
    [string]$Repo,
    [string]$Out
)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is not reliably populated inside a param() default here, so resolve it in the body.
if (-not $Repo) { $Repo = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent }
if (-not $Out) { $Out = Join-Path $Repo 'config\measured_1836.json' }

$runDirs = @($Session | ForEach-Object { (Resolve-Path -LiteralPath $_).Path })
$runCount = $runDirs.Count
$lines = New-Object System.Collections.Generic.List[string]
$tokens = @()
foreach ($runDir in $runDirs) {
    $logs = @()
    foreach ($p in @((Join-Path $runDir 'logs_live\debug.log'), (Join-Path $runDir 'logs\debug.log'))) {
        if (Test-Path $p) { $logs += $p }
    }
    foreach ($p in (Get-ChildItem (Join-Path $runDir 'logs') -Filter 'debug*.log' -ErrorAction SilentlyContinue)) { $logs += $p.FullName }
    if (-not $logs) { throw "no debug logs under $runDir" }

    # Each run's OWN token. Consecutive runs share one logs folder and the game's log ring is not
    # cleared between them, so without this a run reads its predecessor's lines as its own - and when
    # averaging several runs that would silently double-count one of them.
    $meta = Get-Content (Join-Path $runDir 'meta.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $token = $meta.token
    if (-not $token) { throw "meta.json carries no telemetry token; cannot separate this run's lines from the ring" }
    if ($tokens -contains $token) { throw "duplicate telemetry token '$token' - the same run was passed twice" }
    $tokens += $token

    # De-dup WITHIN a run (the live mirror and the exit-time ring overlap), never across runs: two
    # runs legitimately produce identical lines, and dropping them would break the average.
    $seen = @{}
    $n = 0
    foreach ($f in $logs) {
        foreach ($l in [System.IO.File]::ReadLines($f)) {
            $i = $l.IndexOf("V3TB|$token|")
            if ($i -lt 0) { continue }
            $s = $l.Substring($i)
            if ($seen.ContainsKey($s)) { continue }
            $seen[$s] = $true
            $lines.Add($s); $n++
        }
    }
    Write-Output ("  {0}: {1:N0} distinct lines (token {2})" -f (Split-Path $runDir -Leaf), $n, $token)
}
Write-Output ("averaging over {0} run(s), {1:N0} lines total" -f $runCount, $lines.Count)

# ---------------------------------------------------------------- country -> market
$marketOf = @{}
foreach ($l in $lines) {
    $p = $l -split '\|'
    if ($p[2] -ne 'MKT') { continue }
    $marketOf[$p[4]] = $p[5]
}

# ---------------------------------------------------------------- trade, per market per good
# imports are a SELL source for the importing market, exports a BUY source. Both sit inside the
# market's order book already (verified: sell_orders = production + imports + treaty transfers in),
# so putting them in the scenario's trade column makes the scenario's totals directly comparable to
# the game's raw buy/sell orders instead of to a netted-out version of them.
$tradeIn = @{}; $tradeOut = @{}; $buyOrd = @{}; $sellOrd = @{}; $prodOrd = @{}
foreach ($l in $lines) {
    $p = $l -split '\|'
    if ($p[2] -ne 'G' -or $p[3] -ne $Date) { continue }
    $m = $p[4]; $g = $p[5]
    $imp = [double]$p[9]; $exp = [double]$p[10]
    if ($imp -ne 0) { $tradeIn["$m|$g"]  = ($tradeIn["$m|$g"]  + 0) + $imp }
    if ($exp -ne 0) { $tradeOut["$m|$g"] = ($tradeOut["$m|$g"] + 0) + $exp }
    # The raw order book. This is the FIT TARGET: observed pop demand is
    # buy_orders - our building demand - trade out, so the raw numbers have to travel with the
    # trade numbers or the subtraction cannot be reproduced later.
    # += not = : several runs are averaged, and an assignment would keep only the last one.
    $buyOrd["$m|$g"]  = ($buyOrd["$m|$g"]  + 0) + [double]$p[6]
    $sellOrd["$m|$g"] = ($sellOrd["$m|$g"] + 0) + [double]$p[7]
    $prodOrd["$m|$g"] = ($prodOrd["$m|$g"] + 0) + [double]$p[11]
}

# ---------------------------------------------------------------- SoL + urban centres, per country
$STRATA = @('upper','middle','lower','peasants','slaves')
$solW = @{}; $wf = @{}; $ucLvl = @{}
foreach ($l in $lines) {
    $p = $l -split '\|'
    if ($p[2] -ne 'SCEN' -or $p[3] -ne $Date) { continue }
    $c = $p[4]
    $ucLvl[$c] = ($ucLvl[$c] + 0) + [double]$p[6]
    for ($i = 0; $i -lt $STRATA.Count; $i++) {
        $solW["$c|$($STRATA[$i])"] = ($solW["$c|$($STRATA[$i])"] + 0) + [double]$p[7 + 2*$i]
        $wf["$c|$($STRATA[$i])"]   = ($wf["$c|$($STRATA[$i])"]   + 0) + [double]$p[8 + 2*$i]
    }
}

# ---------------------------------------------------------------- military buildings, per country
# The engine sizes these to the army rather than reading them from history, so the scenario cannot
# derive them. Levels only - the PMs come from the building's own PMGs in the UI.
# ⚠ NOT $MIL / $mil - PowerShell variable names are CASE-INSENSITIVE, so those are one variable and
# the accumulator silently wipes the type list, leaving every line filtered out and the result empty.
$MIL_TYPES = @('building_barrack','building_conscription_center','building_army_logistics_center',
               'building_naval_logistics_center')
$milLevels = @{}
# Buildings the HISTORY FILES never create, per STATE. The scenario derives urban centres as
# floor(state urbanization / 100), and these types carry urbanization too (military 2/level,
# companies 5) - leaving them out is most of why the derived count runs short on developed markets.
# Levels only: the urbanization value per group is applied by extract_presets.ps1, which already owns
# that table. Duplicating it here would be a second place to keep correct.
$extraByState = @{}
foreach ($l in $lines) {
    $p = $l -split '\|'
    if ($p[2] -ne 'BINV') { continue }
    $c = $p[4]; $t = $p[5]; $st = $p[9]
    if ($MIL_TYPES -contains $t) { $milLevels["$c|$t"] = ($milLevels["$c|$t"] + 0) + [double]$p[6] }
    if (($MIL_TYPES -contains $t) -or ($t -like 'building_company_*')) {
        $extraByState["$c|$st|$t"] = ($extraByState["$c|$st|$t"] + 0) + [double]$p[6]
    }
}

# ---------------------------------------------------------------- urban-centre production methods
# Which PMs urban centres actually run, in LEVELS per PM. The extractor picks the majority within
# each PMG - it already parses the PMG->PM mapping, and doing it there keeps that parsing in one
# place. Measured because history never creates these buildings, so there is no line to read; the
# previous guess (the market leader's laws) was wrong on two PMGs of four.
$ucPmLevels = @{}
# ANY building's active PMs, in levels, keyed country|building|pm. The extractor picks the most
# popular PM within each PMG - it owns the PMG->PM mapping, so the choice belongs there.
# ⚠ "Most popular" is a DISTORTION by construction: a country whose farms are split 51/49 between
# two secondaries is rendered as though all of them ran the winner. extract_presets reports the
# margin so a near-tie is visible rather than silently flattened.
$pmLevels = @{}
foreach ($l in $lines) {
    $p = $l -split '\|'
    if ($p[2] -ne 'APM') { continue }
    if ($p[5] -eq 'building_urban_center') { $ucPmLevels["$($p[4])|$($p[6])"] = ($ucPmLevels["$($p[4])|$($p[6])"] + 0) + [double]$p[7] }
    $pmLevels["$($p[4])|$($p[5])|$($p[6])"] = ($pmLevels["$($p[4])|$($p[5])|$($p[6])"] + 0) + [double]$p[7]
}

# ---------------------------------------------------------------- throughput, per building TYPE
# Building.GetThroughputBonusCurrent, read straight off the building - not summed from technology +
# law + company sub-factors and not backed out of order differences. Level-weighted mean per type,
# because that is how it enters a market total: a 2-level steel mill at +31.5% and a 1-level one at
# +1% do not average to +16%.
$thruNum = @{}; $thruDen = @{}
foreach ($l in $lines) {
    $p = $l -split '\|'
    if ($p[2] -ne 'THRU') { continue }
    $k = "$($p[4])|$($p[5])"
    $lvl = [double]$p[6]
    if ($lvl -le 0) { continue }
    $thruNum[$k] = ($thruNum[$k] + 0) + [double]$p[7] * $lvl
    $thruDen[$k] = ($thruDen[$k] + 0) + $lvl
}

# ---------------------------------------------------------------- average over the runs
# ⚠ Divide each key by the number of runs THAT KEY appeared in, not by the total run count. Sessions
# are heterogeneous - an older session predates a metric, so pooling five runs where only two carry
# throughput would otherwise divide those two by five and report 40% of the real bonus. Lines are
# de-duplicated within a run, so an occurrence count IS a run count.
$keyRuns = @{}
foreach ($l in $lines) {
    $p = $l -split '\|'
    switch ($p[2]) {
        'G'    { if ($p[3] -eq $Date) { $keyRuns["G|$($p[4])|$($p[5])"]++ } }
        'SCEN' { if ($p[3] -eq $Date) { $keyRuns["SCEN|$($p[4])"]++ } }
        'BINV' { $keyRuns["BINV|$($p[4])|$($p[5])|$($p[9])"]++ }
        'APM'  { $keyRuns["APM|$($p[4])|$($p[5])|$($p[6])"]++ }
        'THRU' { $keyRuns["THRU|$($p[4])|$($p[5])"]++ }
    }
}
function Norm($tbl, $prefix) {
    foreach ($k in @($tbl.Keys)) {
        $n = $keyRuns["$prefix|$k"]
        if ($n -gt 1) { $tbl[$k] = $tbl[$k] / $n }
    }
}
Norm $buyOrd 'G'; Norm $sellOrd 'G'; Norm $prodOrd 'G'; Norm $tradeIn 'G'; Norm $tradeOut 'G'
Norm $ucLvl 'SCEN'
foreach ($k in @($solW.Keys)) { $c=($k -split '\|')[0]; $n=$keyRuns["SCEN|$c"]; if ($n -gt 1) { $solW[$k]=$solW[$k]/$n; $wf[$k]=$wf[$k]/$n } }
foreach ($k in @($milLevels.Keys))   { $q=$k -split '\|'; $n=0; foreach ($kk in $keyRuns.Keys) { if ($kk -like "BINV|$($q[0])|$($q[1])|*") { $n=[math]::Max($n,$keyRuns[$kk]) } }; if ($n -gt 1) { $milLevels[$k]=$milLevels[$k]/$n } }
foreach ($k in @($extraByState.Keys)){ $q=$k -split '\|'; $n=$keyRuns["BINV|$($q[0])|$($q[2])|$($q[1])"]; if ($n -gt 1) { $extraByState[$k]=$extraByState[$k]/$n } }
foreach ($k in @($pmLevels.Keys))    { $n=$keyRuns["APM|$k"]; if ($n -gt 1) { $pmLevels[$k]=$pmLevels[$k]/$n } }
foreach ($k in @($ucPmLevels.Keys))  { $q=$k -split '\|'; $n=$keyRuns["APM|$($q[0])|building_urban_center|$($q[1])"]; if ($n -gt 1) { $ucPmLevels[$k]=$ucPmLevels[$k]/$n } }
foreach ($k in @($thruDen.Keys))     { $n=$keyRuns["THRU|$k"]; if ($n -gt 1) { $thruNum[$k]=$thruNum[$k]/$n; $thruDen[$k]=$thruDen[$k]/$n } }

# (The earlier flat "divide everything by $runCount" is gone: it was wrong the moment two sessions
# with different metric sets were pooled. Per-key counts above supersede it.)

# ---------------------------------------------------------------- aggregate to MARKETS
$markets = @{}
function Ensure-Market($m) {
    if (-not $markets.ContainsKey($m)) {
        $markets[$m] = [ordered]@{
            trade_in = [ordered]@{}; trade_out = [ordered]@{}
            buy = [ordered]@{}; sell = [ordered]@{}; production = [ordered]@{}
            sol = [ordered]@{}; urban_center_levels = 0; military = [ordered]@{}
            extra_by_state = [ordered]@{}; urban_center_pm_levels = [ordered]@{}
            secondary_pm_levels = [ordered]@{}; throughput = [ordered]@{}; _thn = @{}; _thd = @{}
            _sol_num = @{}; _sol_den = @{}
        }
    }
    return $markets[$m]
}
foreach ($k in $tradeIn.Keys)  { $p = $k -split '\|'; (Ensure-Market $p[0]).trade_in[$p[1]]  = [math]::Round($tradeIn[$k], 2) }
foreach ($k in $tradeOut.Keys) { $p = $k -split '\|'; (Ensure-Market $p[0]).trade_out[$p[1]] = [math]::Round($tradeOut[$k], 2) }
foreach ($k in $buyOrd.Keys)   { $p = $k -split '\|'; $e = Ensure-Market $p[0]
    $e.buy[$p[1]]        = [math]::Round($buyOrd[$k], 2)
    $e.sell[$p[1]]       = [math]::Round($sellOrd[$k], 2)
    $e.production[$p[1]] = [math]::Round($prodOrd[$k], 2) }
foreach ($c in $ucLvl.Keys) {
    $m = $marketOf[$c]; if (-not $m) { continue }
    $e = Ensure-Market $m
    $e.urban_center_levels += [int]$ucLvl[$c]
    foreach ($s in $STRATA) {
        $e._sol_num[$s] = ($e._sol_num[$s] + 0) + ($solW["$c|$s"] + 0)
        $e._sol_den[$s] = ($e._sol_den[$s] + 0) + ($wf["$c|$s"] + 0)
    }
}
foreach ($k in $milLevels.Keys) {
    $p = $k -split '\|'
    $m = $marketOf[$p[0]]; if (-not $m) { continue }
    $e = Ensure-Market $m
    $e.military[$p[1]] = ($e.military[$p[1]] + 0) + [int]$milLevels[$k]
}
foreach ($k in $extraByState.Keys) {
    $p = $k -split '\|'
    $m = $marketOf[$p[0]]; if (-not $m) { continue }
    $e = Ensure-Market $m
    if (-not $e.extra_by_state.Contains($p[1])) { $e.extra_by_state[$p[1]] = [ordered]@{} }
    $e.extra_by_state[$p[1]][$p[2]] = ($e.extra_by_state[$p[1]][$p[2]] + 0) + [int]$extraByState[$k]
}
foreach ($k in $ucPmLevels.Keys) {
    $q = $k -split '\|'
    $m = $marketOf[$q[0]]; if (-not $m) { continue }
    $e = Ensure-Market $m
    $e.urban_center_pm_levels[$q[1]] = ($e.urban_center_pm_levels[$q[1]] + 0) + [int]$ucPmLevels[$k]
}
foreach ($k in $pmLevels.Keys) {
    $q = $k -split '\|'
    $m = $marketOf[$q[0]]; if (-not $m) { continue }
    $e = Ensure-Market $m
    if (-not $e.secondary_pm_levels.Contains($q[1])) { $e.secondary_pm_levels[$q[1]] = [ordered]@{} }
    $e.secondary_pm_levels[$q[1]][$q[2]] = ($e.secondary_pm_levels[$q[1]][$q[2]] + 0) + [double]$pmLevels[$k]
}
foreach ($k in $thruDen.Keys) {
    $q = $k -split '\|'
    $m = $marketOf[$q[0]]; if (-not $m) { continue }
    $e = Ensure-Market $m
    $e._thn[$q[1]] = ($e._thn[$q[1]] + 0) + $thruNum[$k]
    $e._thd[$q[1]] = ($e._thd[$q[1]] + 0) + $thruDen[$k]
}
foreach ($m in $markets.Keys) {
    $e = $markets[$m]
    # Workforce per stratum, which is the SPLIT the history files cannot give: only 690 of 4 454
    # `create_pop` blocks declare a pop_type, and the engine assigns the rest from available jobs at
    # init. The scenario takes its population SIZE from history and only the split from here.
    $e.workforce_by_stratum = [ordered]@{}
    foreach ($s in $STRATA) { $e.workforce_by_stratum[$s] = [int]($e._sol_den[$s] + 0) }
    foreach ($s in $STRATA) {
        $den = $e._sol_den[$s]
        # A stratum with no workforce in this market has no SoL - emit nothing rather than 0, so the
        # consumer can fall back instead of feeding a hard zero into a buy package.
        if ($den -gt 0) { $e.sol[$s] = [math]::Round($e._sol_num[$s] / $den, 2) }
    }
    foreach ($b in @($e._thd.Keys)) {
        if ($e._thd[$b] -gt 0) { $e.throughput[$b] = [math]::Round($e._thn[$b] / $e._thd[$b], 4) }
    }
    $e.Remove('_sol_num'); $e.Remove('_sol_den'); $e.Remove('_thn'); $e.Remove('_thd')
}

# ---------------------------------------------------------------- write
$gameVer = 'unknown'
$bs = Join-Path (Split-Path $runDir -Parent) 'build_state.json'
if (Test-Path $bs) {
    $b = Get-Content $bs -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($b.deterministic -and $b.deterministic.game_version) { $gameVer = $b.deterministic.game_version }
}
$payload = [ordered]@{
    _comment = "MEASURED 1836 reference for the scenario presets - see tools/extract_measured.ps1. Regenerate after a game update; a stale table is silently wrong, not obviously missing."
    _meta = [ordered]@{
        generated = (Get-Date).ToString('s')
        session = $runDir
        date = $Date
        game_version = $gameVer
        telemetry_token = $token
        # ⚠ `date` is the LOGICAL dump date, which is not when each field was sampled. A phased
        # metric fires `phase` months after the date it stamps (TESTBED_METRICS), and the event-borne
        # ones fire on their own schedule. Recorded per field so a reader cannot assume one instant:
        sampled_at = [ordered]@{
            trade_and_orders  = "$Date (phase 0 - exact)"
            sol_and_urban     = "$Date + 1 month (phase 1)"
            military_and_extra_by_state = "1836.1.8 (day-7 event)"
            urban_center_pms  = "1836.1.4 (day-3 event) when taken from a probe session, or $Date + 3 months (phase 3) from the dump body"
        }
    }
    markets = $markets
}
$json = $payload | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ("wrote {0} market(s) -> {1}" -f $markets.Count, $Out)
foreach ($m in ($markets.Keys | Sort-Object)) {
    $e = $markets[$m]
    Write-Output ("  {0,-20} trade in {1,3} good(s) / out {2,3}  |  UC {3,4}  |  military {4,3} type(s)  |  SoL {5}" -f `
        $m, $e.trade_in.Count, $e.trade_out.Count, $e.urban_center_levels, $e.military.Count,
        (($STRATA | Where-Object { $e.sol.Contains($_) } | ForEach-Object { "$_=$($e.sol[$_])" }) -join ' '))
}
