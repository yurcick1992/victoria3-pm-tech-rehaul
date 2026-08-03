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
    [string]$Out,
    # MERGE-ONLY mode for the `wages` metric. A wages session carries none of the other metrics, so
    # a normal run over it would write a measured table that is empty everywhere else - and this file
    # is one whose staleness is "silently wrong, not obviously missing". So -WagesOnly reads the
    # existing file, replaces only each market's `wages` block, and leaves every other field alone.
    [switch]$WagesOnly
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

# ================================================================ WAGES (merge-only)
if ($WagesOnly) {
    # wage_weight per pop type, indexed by the integer on each PW line (Get-WagePopTypes in
    # tools/telemetry_lib.ps1 defines the order; index 0 means "a type that list does not know").
    # Values are common/pop_types/*.txt. ⚠ Keep in step with Get-WagePopTypes - it is append-only.
    $PT = @('unknown','laborers','farmers','machinists','clerks','shopkeepers','engineers',
            'clergymen','bureaucrats','academics','officers','soldiers','aristocrats',
            'capitalists','peasants','slaves')
    $WW = @(0, 1, 2, 1.5, 1.5, 3, 3, 3, 4, 4, 5, 1.5, 5, 5, 0.2, 0)

    # country -> market, from the WC line (this metric does not emit MKT)
    # ⚠ Per-run counts are averaged by the number of runs that ACTUALLY CARRY that market, not by
    # the total run count. Runs differ in which markets they sweep per-pop (the deep-market list is
    # per schedule), so dividing a market's pop lines by every run understates it by exactly the
    # factor of runs that never swept it - which reads as a 5x shortfall in the completeness column
    # for a market that is in fact complete. The token is field 1 of every line, so run identity is
    # available per line without threading it through.
    $mOf = @{}; $popObj = @{}; $wcTok = @{}
    foreach ($l in $lines) {
        $p = $l -split '\|'
        if ($p[2] -ne 'WC' -or $p[3] -ne $Date) { continue }
        $mOf[$p[5]] = $p[6]
        $popObj["$($p[5])"] = ($popObj["$($p[5])"] + 0) + [double]$p[7]
        if (-not $wcTok.ContainsKey($p[6])) { $wcTok[$p[6]] = @{} }
        $wcTok[$p[6]][$p[1]] = $true
    }
    if (-not $mOf.Count) { throw "no WC lines at $Date - is this a `wages` session, and is the date right?" }

    # --- per-market accumulators. Everything reported is a RATIO of two sums, which is what makes
    # this robust to the ~0.4% per-pop line loss the ring still causes: a lost pop removes its wage
    # bill AND its wage units, so the quotient barely moves, whereas a raw total would be short.
    $bill = @{}; $units = @{}; $workers = @{}; $wfSum = @{}; $totSum = @{}
    $solNum = @{}; $incSum = @{}; $depIncSum = @{}; $expSum = @{}; $pwSeen = @{}; $pwTok = @{}
    $tBill = @{}; $tUnits = @{}; $tWork = @{}; $tTot = @{}     # keyed market|typeid
    # --- THE CANONICAL MARKET WAGE (FINDINGS F26) -------------------------------------------------
    # laborers + farmers + machinists, EMPLOYED pops only. Both restrictions are corrections, not
    # preferences:
    #   - only these three are paid the MARKET wage a building hands out. Bureaucrats, academics,
    #     clergymen and officers are state-salaried on the government-wage law, soldiers on the
    #     military-wage law, and shopkeepers are owners whose workforce income is wage + ~15%
    #     dividends. Dropping soldiers alone cut the p90 fit error from 54% to 38%.
    #   - an UNEMPLOYED pop contributes workers to the wage-unit denominator and nothing to the
    #     numerator, so including it deflates the wage. 14.9% of lower-stratum pops, holding 18.3%
    #     of that workforce, have effectively zero workforce income; excluding them raises the base
    #     by 1.00-1.38x (mean 1.15x).
    $WAGE_PROFS = @('laborers','farmers','machinists')
    $EMPLOYED_MIN = 0.005          # implied per-pop base £/wk below this = not actually employed
    $wBill = @{}; $wUnits = @{}; $wWork = @{}; $wSol = @{}
    foreach ($l in $lines) {
        $p = $l -split '\|'
        if ($p[2] -ne 'PW' -or $p[3] -ne $Date) { continue }
        $m = $mOf[$p[6]]; if (-not $m) { continue }
        $ti = [int]$p[8]; $w = $WW[$ti]
        $wfv = [double]$p[9]; $tot = [double]$p[11]
        $wi = [double]$p[14]
        $bill[$m]    = ($bill[$m]    + 0) + $wi
        $units[$m]   = ($units[$m]   + 0) + $wfv * $w
        $workers[$m] = ($workers[$m] + 0) + $wfv
        $wfSum[$m]   = ($wfSum[$m]   + 0) + $wfv
        $totSum[$m]  = ($totSum[$m]  + 0) + $tot
        $solNum[$m]  = ($solNum[$m]  + 0) + [double]$p[12] * $wfv
        $incSum[$m]  = ($incSum[$m]  + 0) + [double]$p[13]
        $depIncSum[$m] = ($depIncSum[$m] + 0) + [double]$p[15]
        $expSum[$m]  = ($expSum[$m]  + 0) + [double]$p[16]
        $pwSeen[$m]  = ($pwSeen[$m]  + 0) + 1
        if (-not $pwTok.ContainsKey($m)) { $pwTok[$m] = @{} }
        $pwTok[$m][$p[1]] = $true
        $k = "$m|$ti"
        $tBill[$k] = ($tBill[$k] + 0) + $wi
        $tUnits[$k] = ($tUnits[$k] + 0) + $wfv * $w
        $tWork[$k] = ($tWork[$k] + 0) + $wfv
        $tTot[$k]  = ($tTot[$k]  + 0) + $tot
        # canonical market wage: the three market-paid professions, employed pops only
        if ($WAGE_PROFS -contains $PT[$ti]) {
            $u = $wfv * $w
            if ($u -gt 0 -and ($wi / $u) -ge $EMPLOYED_MIN) {
                $wBill[$m]  = ($wBill[$m]  + 0) + $wi
                $wUnits[$m] = ($wUnits[$m] + 0) + $u
            }
            # SoL is measured over ALL of them, employed or not - that is what a scenario types in
            $wWork[$m] = ($wWork[$m] + 0) + $wfv
            $wSol[$m]  = ($wSol[$m]  + 0) + [double]$p[12] * $wfv
        }
    }

    # --- state average annual wage, the game's own per-state figure (Q1's "between states" spread)
    $stW = @{}
    foreach ($l in $lines) {
        $p = $l -split '\|'
        if ($p[2] -ne 'SW' -or $p[3] -ne $Date) { continue }
        $m = $mOf[$p[5]]; if (-not $m) { continue }
        if (-not $stW.ContainsKey($m)) { $stW[$m] = New-Object System.Collections.Generic.List[double] }
        $stW[$m].Add([double]$p[7])
    }

    $existing = $null
    if (Test-Path $Out) { $existing = Get-Content $Out -Raw -Encoding UTF8 | ConvertFrom-Json }
    if (-not $existing) { throw "-WagesOnly merges into an existing $Out; none found" }

    $touched = 0; $report = @()
    foreach ($m in ($mOf.Values | Sort-Object -Unique)) {
        $w = [ordered]@{}
        if ($stW.ContainsKey($m) -and $stW[$m].Count) {
            $v = @($stW[$m] | Sort-Object)
            # ⚠ [int] in PowerShell rounds half-to-EVEN, so [int](3/2) is 2, not 1 - which silently
            # took the wrong element and reported Belgium's median as its maximum. Floor explicitly.
            $mid = [int][math]::Floor($v.Count / 2)
            $w.state_annual_wage = [ordered]@{
                # ⚠ UNWEIGHTED across states - the game exposes no per-state worker count to weight
                # by, so this is "the average between states" literally. The weighted figure is
                # `base_weekly` below, which comes from the pops themselves.
                states = [int][math]::Round($v.Count / $runCount)
                mean   = [math]::Round((($v | Measure-Object -Sum).Sum / $v.Count), 4)
                median = [math]::Round(($(if ($v.Count % 2) { $v[$mid] } else { ($v[$mid-1] + $v[$mid]) / 2 })), 4)
                min    = [math]::Round($v[0], 4)
                max    = [math]::Round($v[$v.Count - 1], 4)
            }
        }
        if ($units[$m] -gt 0) {
            $bw = $bill[$m] / $units[$m]
            $w.base_weekly = [math]::Round($bw, 6)
            $w.base_annual = [math]::Round($bw * 52, 4)
            $w.per_worker_annual = [math]::Round($bill[$m] / $workers[$m] * 52, 4)
            $w.mean_wage_weight  = [math]::Round($units[$m] / $workers[$m], 4)
            $w.workforce_ratio   = [math]::Round($wfSum[$m] / $totSum[$m], 4)
            $w.wage_share_of_income = [math]::Round($bill[$m] / $incSum[$m], 4)
            $w.mean_sol_workforce_weighted = [math]::Round($solNum[$m] / $wfSum[$m], 3)
            # --- THE NUMBER THE BALANCE SHEET WANTS, and why it is not `base_weekly`.
            # Measured Belgium 1836: base_annual per pop type is 3.79 laborers, 3.79 farmers, 4.01
            # machinists, 3.58 clerks, 4.38 shopkeepers, 4.04 engineers, 4.14 clergymen, 3.70
            # bureaucrats, 3.61 academics, 3.41 officers, 3.42 soldiers - a tight cluster, which is
            # the game confirming that it really does pay wage = base x wage_weight.
            # Then aristocrats 7.55 and CAPITALISTS 59.66. Those two are not wages: GetWorkforceIncome
            # for an owner pop is dividends and rent, and folding them into one market-wide average
            # inflates the base by ~15% with money no building ever pays out. Peasants (2.79) are
            # excluded for the opposite reason - their consumption is met inside the subsistence
            # building and never priced as a market wage.
            # So `base_weekly_labour` is the figure to seed the UI with; `base_weekly` is kept beside
            # it as the raw all-pops number so the difference stays visible rather than assumed away.
            $LABOUR = @('laborers','farmers','machinists','clerks','shopkeepers','engineers',
                        'clergymen','bureaucrats','academics','officers','soldiers')
            $lBill = 0.0; $lUnits = 0.0; $lWork = 0.0; $lBases = @()
            foreach ($ti in (0..($PT.Count - 1))) {
                $k = "$m|$ti"
                if ($LABOUR -notcontains $PT[$ti] -or -not $tUnits.ContainsKey($k) -or $tUnits[$k] -le 0) { continue }
                $lBill += $tBill[$k]; $lUnits += $tUnits[$k]; $lWork += $tWork[$k]
                $lBases += ($tBill[$k] / $tUnits[$k] * 52)
            }
            # ---- THE CANONICAL FIGURE: what the scenario presets consume ----
            if ($wUnits[$m] -gt 0) {
                $bw = $wBill[$m] / $wUnits[$m]
                $w.base_weekly_wage = [math]::Round($bw, 6)
                $w.base_annual_wage = [math]::Round($bw * 52, 4)
                $w.wage_basis = 'laborers+farmers+machinists, employed only (FINDINGS F26)'
                if ($wWork[$m] -gt 0) { $w.wage_stratum_sol = [math]::Round($wSol[$m] / $wWork[$m], 3) }
            }
            if ($lUnits -gt 0) {
                $lb = $lBill / $lUnits
                # ⚠ SUPERSEDED basis, kept for continuity with earlier findings: 11 professions
                # including soldiers and the state-salaried middle stratum, and including the
                # unemployed. Do not feed this to a scenario - use base_weekly_wage.
                $w.base_weekly_labour = [math]::Round($lb, 6)
                $w.base_annual_labour = [math]::Round($lb * 52, 4)
                # How well ONE base wage describes this market: the spread of the per-type bases that
                # should all be the same number. A small CV is the model holding; a large one says a
                # single base is hiding something.
                $mu = ($lBases | Measure-Object -Average).Average
                $sd = if ($lBases.Count -gt 1) {
                    [math]::Sqrt((($lBases | ForEach-Object { ($_ - $mu) * ($_ - $mu) } | Measure-Object -Sum).Sum) / ($lBases.Count - 1))
                } else { 0 }
                $w.labour_base_spread = [ordered]@{
                    types = $lBases.Count
                    min   = [math]::Round(($lBases | Measure-Object -Minimum).Minimum, 4)
                    max   = [math]::Round(($lBases | Measure-Object -Maximum).Maximum, 4)
                    cv    = $(if ($mu -gt 0) { [math]::Round($sd / $mu, 4) } else { $null })
                }
                $w.excluded_from_labour_base = @('capitalists (dividends, not wages)',
                    'aristocrats (rent, not wages)', 'peasants (subsistence, not a market wage)', 'slaves (wage_weight 0)')
            }
            $w.by_pop_type = [ordered]@{}
            foreach ($ti in (0..($PT.Count - 1))) {
                $k = "$m|$ti"; if (-not $tWork.ContainsKey($k) -or $tWork[$k] -le 0) { continue }
                $w.by_pop_type[$PT[$ti]] = [ordered]@{
                    workforce       = [int][math]::Round($tWork[$k] / [math]::Max(1, $pwTok[$m].Count))
                    annual_per_worker = [math]::Round($tBill[$k] / $tWork[$k] * 52, 4)
                    base_annual     = $(if ($tUnits[$k] -gt 0) { [math]::Round($tBill[$k] / $tUnits[$k] * 52, 4) } else { $null })
                    workforce_ratio = [math]::Round($tWork[$k] / $tTot[$k], 4)
                }
            }
            # Completeness, carried WITH the numbers rather than left in a console log: the WC line
            # counts pop objects independently of the PW lines, so a short dump is visible here.
            $nWc = [math]::Max(1, $wcTok[$m].Count)
            $nPw = [math]::Max(1, $pwTok[$m].Count)
            $w.pops_expected = [int][math]::Round((($mOf.Keys | Where-Object { $mOf[$_] -eq $m } |
                                ForEach-Object { $popObj[$_] } | Measure-Object -Sum).Sum) / $nWc)
            $w.pops_logged   = [int][math]::Round($pwSeen[$m] / $nPw)
            $w.runs_per_pop  = $nPw
            $w.source = 'per_pop'
        } else {
            $w.source = 'state_average_only'
            $w._note  = 'No per-pop lines for this market, so no wage-weight-normalised base wage. Only the game per-state average annual wage (per WORKER) is available.'
        }
        if ($existing.markets.PSObject.Properties.Name -contains $m) {
            $existing.markets.$m | Add-Member -NotePropertyName wages -NotePropertyValue $w -Force
            $touched++
            $report += ,@($m, $w)
        } else {
            Write-Warning "market '$m' has wage data but is not in $Out - skipped"
        }
    }
    $existing._meta | Add-Member -NotePropertyName wages_from -NotePropertyValue ([ordered]@{
        generated = (Get-Date).ToString('s'); date = $Date
        runs = $runCount; sessions = @($runDirs); tokens = @($tokens)
        sampled_at = "$Date exactly - the wages metric is entirely phase 0, so nothing here drifts"
    }) -Force
    [System.IO.File]::WriteAllText($Out, ($existing | ConvertTo-Json -Depth 9), (New-Object System.Text.UTF8Encoding($false)))
    Write-Output ("merged wages into {0} market(s) -> {1}" -f $touched, $Out)
    foreach ($r in $report) {
        $m = $r[0]; $w = $r[1]
        if ($w.source -eq 'per_pop') {
            Write-Output ("  {0,-18} LABOUR base {1,8:N5}/wk ({2,6:N2}/yr, spread {3:N2}-{4:N2} cv {5:N3}) | all-pops base {6,6:N2}/yr | wf ratio {7:N4} | pops {8}/{9}" -f `
                $m, $w.base_weekly_labour, $w.base_annual_labour,
                $w.labour_base_spread.min, $w.labour_base_spread.max, $w.labour_base_spread.cv,
                $w.base_annual, $w.workforce_ratio, $w.pops_logged, $w.pops_expected)
        } else {
            Write-Output ("  {0,-18} state-average only: mean £{1,6:N3}/yr over {2} state(s)" -f `
                $m, $w.state_annual_wage.mean, $w.state_annual_wage.states)
        }
    }
    exit 0
}

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
