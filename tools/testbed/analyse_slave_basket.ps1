<#
  analyse_slave_basket.ps1 - pull the "purchased for slaves" channel out of a consumption_breakdown session.

  Victoria 3 never has a slave buy anything: the BUILDING that employs them buys a consumer-goods
  basket on their behalf (SLAVE_BASKET_* in common/defines), and the market panel reports it as its own
  buy-order channel. `Goods.GetMarketBuyOrdersBreakdown` (metric `consumption_breakdown`) is the only
  place that number is readable, so this script is the reader. See FINDINGS F27.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\testbed\analyse_slave_basket.ps1 `
        -Session tools\testbed\sessions\<stamp>_<label> [-Tsv out.tsv]

  THREE things in here are load-bearing, not detail:

  1. EVERY LINE IS FILTERED BY THE RUN'S OWN TOKEN, read from that run's meta.json. The game's log is
     a 5x512 KB ring shared by every run on the machine, so one run's `logs_live\debug.log` routinely
     contains the tail of the PREVIOUS run - a different market entirely. Attributing those to this
     run's market is silent, plausible corruption.

  2. GREP `purchased for`, NEVER THE FULL PHRASE. The rendered line is, byte for byte:
         <21>v; +2.61<21>! purchased for <22>slaves! Slaves
     - the loc string `GOODS_SLAVE_CONSUMPTION_MARKET_ORDERS` interpolates a $slaves$ concept, so 0x16
     sits between "for" and "slaves", and 0x15 fences the value. Matching "purchased for slaves"
     returns nothing at all - a silent zero, not an error - and so does requiring "!" to follow the
     digits directly.

  3. EVERY BLOCK IS VERIFIED AGAINST AN INDEPENDENT NUMBER BEFORE IT IS BELIEVED. The value line does
     not name its good - only the surrounding BEGIN/C2end fence does - and the fence is NOT reliable:
     at British-market volume the log mirror puts values in the wrong block (one run had five slave
     lines inside `wine` while `furniture` and `fabric`, which do have slave purchases, showed none).
     Trusting the fence produced `tools` - not a pop need at all - at 7 units.
     The check: each block's payload opens with `Current total: <buy orders>`, and the same run's own
     `G|` telemetry line carries `GetMarketBuyOrders` for every good. If the two disagree, the block is
     not the good its fence claims, and it is DISCARDED. Numbers here have passed that check.

  4. RUNS ARE UNIONED, NOT AVERAGED BLINDLY. The breakdown is several hundred KB of formatted tooltip
     text per market, so the ring truncates almost every run - and each one truncates at a DIFFERENT
     good. A good seen by one run of four is real data, not an outlier; a good seen by none is simply
     unmeasured. So the report carries n per good and the min/max spread, and coverage is reported
     per run so a truncated run is visible rather than averaged away.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $Session,
    [string] $Tsv = ""
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not (Test-Path $Session)) { throw "session not found: $Session" }
$runs = @(Get-ChildItem $Session -Directory | Where-Object { $_.Name -match '^run\d+_' } | Sort-Object Name)
if (-not $runs) { throw "no run folders under $Session" }

# market -> good -> list of values, plus per-run coverage
$data     = @{}
$coverage = New-Object System.Collections.Generic.List[object]

# Resolve each run's token + log path once.
$plan = foreach ($r in $runs) {
    $metaPath = Join-Path $r.FullName 'meta.json'
    $logPath  = Join-Path $r.FullName 'logs_live\debug.log'
    if (-not (Test-Path $metaPath)) { Write-Output "  WARN: $($r.Name) has no meta.json - skipped"; continue }
    if (-not (Test-Path $logPath))  { Write-Output "  WARN: $($r.Name) has no logs_live\debug.log - skipped"; continue }
    $token = (Get-Content -LiteralPath $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json).token
    if (-not $token) { Write-Output "  WARN: $($r.Name) meta.json carries no token - skipped"; continue }
    [pscustomobject]@{ name = $r.Name; token = $token; log = $logPath }
}

# ---- PASS 1, SESSION-WIDE: buy orders per market x good, from the `G|` telemetry line
# (GetMarketBuyOrders). This is the independent number every block is checked against.
#
# Built across ALL runs, not per run, and that is not a shortcut: the breakdown's own volume can push
# a run's `G|` lines out of the shared log ring entirely - both American runs of the 20260803_134507
# batch lost every one of theirs - and without a reference such a run verifies to nothing. Runs in one
# session are the same arm at the same date, so another run's buy orders are the same quantity: across
# four British runs the per-good spread is 1-3%, well inside the 2% tolerance's intent. Later runs
# overwrite earlier ones; any of them will do.
$buyOf = @{}
foreach ($p in $plan) {
    foreach ($ln in [System.IO.File]::ReadLines($p.log)) {
        if ($ln.Length -lt 400 -and $ln -match "\|$($p.token)\|G\|[^|]+\|([^|]+)\|([^|]+)\|([0-9.]+)\|") {
            $buyOf["$($Matches[1])`t$($Matches[2])"] = [double]$Matches[3]
        }
    }
}
Write-Output ("reference buy-orders table: {0} market x good entries`n" -f $buyOf.Count)

foreach ($p in $plan) {
    $token = $p.token; $logPath = $p.log

    # ⚠ A BLOCK ONLY COUNTS IF IT CLOSED, AND ONLY IF IT IS UNAMBIGUOUS. A clean block holds exactly
    # one slave line. A block the ring truncated holds nine, because its C2end was never written and
    # everything logged afterwards fell inside it; a block the mirror interleaved holds two or more,
    # and there is no way to tell which one is this good's - British `wine` alternated between 0.04
    # (its own) and 113 (grain's, 111-113). So: commit on C2end, discard anything unterminated, and
    # discard any block carrying more than one candidate rather than guessing between them.
    # PASS 2 - the breakdown blocks.
    $fenced = @{}; $hits = 0; $dropped = 0; $badTotal = 0; $ambiguous = 0
    $mkt = $null; $lastMkt = $null; $good = $null; $pending = $null; $nCand = 0; $curTotal = $null
    foreach ($ln in [System.IO.File]::ReadLines($logPath)) {
        # The BEGIN fence is short; the payload lines are multi-KB base64, so the length test keeps the
        # regex off them. Both market and good come from the fence, never from the payload.
        if ($ln.Length -lt 400 -and $ln -match "\|$token\|CP\|C2\|[^|]+\|([^|]+)\|([^|]+)\|BEGIN") {
            if ($good) { $dropped++ }          # previous block never closed - throw it away
            $mkt = $Matches[1]; $lastMkt = $mkt; $good = $Matches[2]
            $pending = $null; $nCand = 0; $curTotal = $null; $fenced[$good] = $true
        }
        elseif ($ln.Length -lt 400 -and $ln -match "\|$token\|CP\|C2end\|") {
            if ($good -and $nCand -gt 0) {
                if ($nCand -gt 1) { $ambiguous++ }
                else {
                    # VERIFY: the block's own "Current total" must be this good's buy orders. 3 significant
                    # figures ("9.02K") is all the tooltip prints, so allow 2% - orders of magnitude apart
                    # is what misattribution looks like, never a rounding difference.
                    $ref = $buyOf["$mkt`t$good"]
                    $ok  = ($null -ne $curTotal) -and ($null -ne $ref) -and
                           ([math]::Abs($curTotal - $ref) -le [math]::Max(0.02 * [math]::Max($ref,1), 1))
                    if ($ok) {
                        if (-not $data.ContainsKey($mkt)) { $data[$mkt] = @{} }
                        if (-not $data[$mkt].ContainsKey($good)) { $data[$mkt][$good] = New-Object System.Collections.Generic.List[double] }
                        $data[$mkt][$good].Add($pending); $hits++
                    } else { $badTotal++ }
                }
            }
            $good = $null; $pending = $null; $nCand = 0; $curTotal = $null
        }
        # any OTHER run's fence means the ring has moved on to a different run: drop what is open
        elseif ($ln.Length -lt 400 -and $ln -match "\|CP\|C2(end|done)?\|") {
            if ($good) { $dropped++ }; $good = $null; $pending = $null; $nCand = 0; $curTotal = $null
        }
        elseif ($good -and $null -eq $curTotal -and $ln -match 'Current total: .{0,2}v; ([0-9.]+)([KMB]?)') {
            $mul = @{ '' = 1; 'K' = 1e3; 'M' = 1e6; 'B' = 1e9 }[$Matches[2]]
            $curTotal = [double]$Matches[1] * $mul
        }
        # The rendered line is exactly:  <21>v; +2.61<21>! purchased for <22>slaves! Slaves
        # so the value is fenced by 0x15 and the word "slaves" by 0x16. Match up to a few non-digits
        # between the number and "purchased for", and STOP THERE - never reach for "slaves".
        elseif ($good -and $ln -match '\+([0-9.]+)[^0-9]{0,4}purchased for') {
            $nCand++; if ($nCand -eq 1) { $pending = [double]$Matches[1] }
        }
    }
    if ($good) { $dropped++ }                  # file ended mid-block
    $coverage.Add([pscustomobject]@{ run = $p.name; token = $token; market = $lastMkt
                                     goodsCaptured = $fenced.Count; verified = $hits
                                     ambiguous = $ambiguous; failedTotalCheck = $badTotal
                                     unclosedBlocks = $dropped })
}

Write-Output "=== coverage per run (the breakdown truncates; each run loses a different tail) ==="
$coverage | Format-Table -AutoSize | Out-String | Write-Output

if (-not $data.Keys.Count) {
    Write-Output "NO slave-purchase lines found. Check that the session ran the `consumption_breakdown` metric,"
    Write-Output "and that the log matched on 'purchased for' rather than the full phrase (see header note 2)."
    return
}

$rows = New-Object System.Collections.Generic.List[object]
foreach ($m in ($data.Keys | Sort-Object)) {
    Write-Output "=== $m - purchased for slaves, per good ==="
    $out = foreach ($g in ($data[$m].Keys | Sort-Object)) {
        $v = $data[$m][$g]
        $stat = $v | Measure-Object -Average -Minimum -Maximum
        $row = [pscustomobject]@{
            market = $m; good = $g; n = $v.Count
            mean = [math]::Round($stat.Average, 2)
            min  = [math]::Round($stat.Minimum, 2)
            max  = [math]::Round($stat.Maximum, 2)
            # spread as a share of the mean: anything material here means the runs disagree about the
            # same quantity, which would undermine using them as one measurement
            spread_pct = $(if ($stat.Average -gt 0) { [math]::Round(($stat.Maximum - $stat.Minimum) / $stat.Average * 100, 1) } else { 0 })
        }
        $rows.Add($row); $row
    }
    $out | Sort-Object -Property mean -Descending | Format-Table -AutoSize | Out-String | Write-Output
    $tot = ($out | Measure-Object -Property mean -Sum).Sum
    Write-Output ("  {0} good(s) with slave purchases, total {1:N1} units" -f $out.Count, $tot)
    Write-Output ""
}

if ($Tsv) {
    $rows | Export-Csv -LiteralPath $Tsv -NoTypeInformation -Delimiter "`t" -Encoding UTF8
    Write-Output "wrote $Tsv"
}
