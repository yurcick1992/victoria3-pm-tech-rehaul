<#
  PM & Tech Rehaul - scenario-preset extractor (vanilla 1836 start -> ui/presets.js).

  A "preset" fills the balance UI's scenario panel in one click: every building of one country's
  WHOLE MARKET (count + the PMs vanilla actually runs), the non-building buy/sell orders from
  intergovernmental goods transfers, and the market's population split into consumption classes.
  The UI turns the class counts into pop BUY orders live (buy packages x pop needs x supply share),
  scaled by its session "vanilla-fit" knob - see ui/builder.html and CLAUDE.md.

  Everything here is DERIVED FROM THE LIVE GAME, so a patch is a one-command refresh (build.ps1 runs
  it). It never touches config/ or mod/. Which presets to emit lives in config/presets.json.

  Derivation (per config/presets.json entry), matching the design spec:
    1. MARKET   - the lead country + every subject that shares its market. All subject types share the
                  overlord's market unless a `grant_own_market` pact exists (that pact exists exactly
                  because sharing is the default); resolved transitively (GBR -> BIC -> its puppets).
                  Manual overrides: market_add / market_drop in config/presets.json.
    2. BUILDINGS- every create_building in common/history/buildings owned by a member country, mapped
                  onto OUR tier building when the industry is split (base building + the active vanilla
                  main PM -> tier key, via config `vanilla_pm`), counted in LEVELS. The PMs vanilla
                  activates are recorded per building key (majority by levels) so the UI can select them.
    3. TRADE    - no regular (trade-route) trade is assumed. Only `goods_transfer` treaty articles
                  active in 1836 count: a transfer OUT of the market is an extra BUY order (the goods
                  are bought away), a transfer IN is an extra SELL order.
    4. POPS     - total population from common/history/pops, split into classes:
                  jobs (building levels x the employment of its active PMs) / working_adult_ratio give
                  the employed people per profession, bucketed into upper / middle / lower strata;
                  slaves come from the explicit `pop_type = slaves` pops; peasants are the remainder.
                  The per-class consumption norms (wealth levels + the slave/peasant multipliers) and
                  the buy-package / pop-need tables travel with the file so the UI can do the goods math.

  Usage:  powershell -ExecutionPolicy Bypass -File tools\extract_presets.ps1 [-Game "<...\Victoria 3\game>"]
#>
param(
    [string]$Repo = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = $(if ($env:VIC3_GAME) { $env:VIC3_GAME } else { "C:\Program Files (x86)\Steam\steamapps\common\Victoria 3\game" }),
    [string]$Config
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'history_lib.ps1')

$START_YEAR = 1836

# Pop strata are ENGINE-side (not scripted anywhere in common/), so they are spelled out here.
# Re-check after a patch that adds a profession - an unknown pop type lands in 'lower' with a warning.
$STRATA = @{
    aristocrats = 'upper'; capitalists = 'upper'
    clerks = 'middle'; shopkeepers = 'middle'; engineers = 'middle'; bureaucrats = 'middle'
    academics = 'middle'; clergymen = 'middle'; officers = 'middle'
    laborers = 'lower'; farmers = 'lower'; machinists = 'lower'; soldiers = 'lower'
    peasants = 'peasants'; slaves = 'slaves'
}
# Diplomatic pact types that make one country a SUBJECT of another (i.e. share its market by default).
$SUBJECT_TYPES = @('puppet','protectorate','colony','vassal','tributary','personal_union','dominion','crown_land','chartered_company')

function Warn($msg) { Write-Output ("  WARN: {0}" -f $msg) }

# ---------------------------------------------------------------- vanilla reference (buildings/PMGs/PMs)
$bBlocks = Get-TopBlocks (Join-Path $Game 'common\buildings') 'building_'
$bldPmgs = @{}; $bldGroup = @{}; $bldTech = @{}
foreach ($n in $bBlocks.Keys) {
    $bldPmgs[$n] = @(Get-ListTokens $bBlocks[$n] 'production_method_groups' 'pmg_')
    if (($bBlocks[$n] -join ' ') -match 'building_group\s*=\s*(bg_[A-Za-z0-9_]+)') { $bldGroup[$n] = $Matches[1] }
    # the tech gate is often on the BUILDING, not on its PMs (power plant -> electricity, electrics -> telephones)
    $bldTech[$n] = @(Get-ListTokens $bBlocks[$n] 'unlocking_technologies' '')
}
# Building groups whose levels occupy ARABLE LAND (the `arable_resources` a state region lists).
# What's left over is what the subsistence buildings cover.
$ARABLE_GROUPS = @('bg_agriculture','bg_ranching','bg_plantations')

# ---------------------------------------------------------------- urbanization -> urban centres
# History never creates urban centres; the game raises them from each STATE's urbanization. The rule
# is `floor(state urbanization / 100)`, where every building level contributes its building group's
# `urbanization`, EXCEPT groups flagged `is_subsistence` - those declare no urbanization of their own
# and would otherwise inherit bg_agriculture's 5, which is wrong by a factor of five for an agrarian
# country. Both halves were VERIFIED against the game's own level counts (FINDINGS F13): exact on
# 774 of 783 states. The nine misses are Great Britain (11 levels), Upper Canada and France (1 each),
# all UNDER-predictions - that is the technology/law urbanization bonus, which we deliberately ignore
# ("assume base techs"), so a developed country gets slightly fewer urban centres here than in-game.
#
# Groups inherit through `parent_group`, so both lookups walk up the chain.
$URBAN_PER_LEVEL = 100
$grpUrb = @{}; $grpParent = @{}; $grpSubs = @{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\building_groups') -Filter *.txt)) {
    $cur = $null; $depth = 0
    foreach ($l in (Get-Content -LiteralPath $f.FullName)) {
        $line = ($l -replace '#.*$', '')
        if ($line -match '^\s*(bg_[A-Za-z0-9_]+)\s*=\s*\{') { $cur = $Matches[1]; $depth = 1; continue }
        if (-not $cur) { continue }
        $depth += ([regex]::Matches($line, '\{')).Count - ([regex]::Matches($line, '\}')).Count
        if ($line -match '^\s*parent_group\s*=\s*(bg_[A-Za-z0-9_]+)') { $grpParent[$cur] = $Matches[1] }
        if ($line -match '^\s*urbanization\s*=\s*(\d+)')              { $grpUrb[$cur] = [int]$Matches[1] }
        if ($line -match '^\s*is_subsistence\s*=\s*yes')              { $grpSubs[$cur] = $true }
        if ($depth -le 0) { $cur = $null }
    }
}
function Get-GroupChainValue($g, $tbl) {
    $seen = @{}
    while ($g -and -not $seen[$g]) {
        if ($tbl.ContainsKey($g)) { return $tbl[$g] }
        $seen[$g] = $true; $g = $grpParent[$g]
    }
    return $null
}
function Get-Urbanization($bkey) {
    $g = $bldGroup[$bkey]
    if (-not $g) { return 0 }
    if (Get-GroupChainValue $g $grpSubs) { return 0 }
    $v = Get-GroupChainValue $g $grpUrb
    if ($null -eq $v) { return 0 }
    return [int]$v
}
$URBAN_CENTER = 'building_urban_center'

# Display name -> STATE_ key. The telemetry logs a state by its localised NAME (there is no state-key
# data function, the same limitation as country tags), while history works in STATE_ keys - so the
# measured per-state corrections can only be joined onto the derived per-state urbanization through
# the localisation. Getting this wrong would not error; it would silently give each correction its own
# floor bucket, where a state's worth of military urbanization rounds to zero.
$stateKeyByName = @{}
$stateLoc = Join-Path $Game 'localization\english\map\states_l_english.yml'
if (Test-Path $stateLoc) {
    foreach ($l in (Get-Content -LiteralPath $stateLoc -Encoding UTF8)) {
        if ($l -match '^\s*(STATE_[A-Z0-9_]+)\s*:\s*\d*\s*"(.*)"\s*$') { $stateKeyByName[$Matches[2]] = $Matches[1] }
    }
} else { Warn "state localisation not found - measured per-state corrections cannot be joined" }

$gBlocks = Get-TopBlocks (Join-Path $Game 'common\production_method_groups') 'pmg_'
$pmgPms = @{}; $pmToPmg = @{}
foreach ($n in $gBlocks.Keys) {
    # PM names are not all pm_-prefixed (plantations/mines use default_/picks_and_shovels_/...), so take every token.
    $pms = @(Get-ListTokens $gBlocks[$n] 'production_methods' '')
    $pmgPms[$n] = $pms
    foreach ($p in $pms) { if (-not $pmToPmg.ContainsKey($p)) { $pmToPmg[$p] = $n } }
}

$pBlocks = Get-TopBlocks (Join-Path $Game 'common\production_methods') ''
$pmEmp = @{}; $pmGated = @{}; $pmLaws = @{}; $pmTech = @{}; $pmTechList = @{}; $pmOut = @{}
foreach ($n in $pBlocks.Keys) {
    $e = @{}
    $pmTechList[$n] = @(Get-ListTokens $pBlocks[$n] 'unlocking_technologies' '')
    $og = @{}
    foreach ($l in $pBlocks[$n]) {
        if ($l -match 'goods_output_([a-z_]+)_add\s*=\s*(-?\d+(?:\.\d+)?)' -and (Get-Num $Matches[2]) -gt 0) { $og[$Matches[1]] = $true }
    }
    $pmOut[$n] = $og
    # law gates matter for the buildings history never creates (subsistence, manor houses): which PM is
    # active there is decided by the owner's LAWS, not by a history line. Collect both gate lists.
    $unlock = New-Object System.Collections.Generic.List[string]
    $disallow = New-Object System.Collections.Generic.List[string]
    $mode = $null
    foreach ($l in $pBlocks[$n]) {
        if     ($l -match 'building_employment_([a-z_]+)_add\s*=\s*(-?\d+)') { $e[$Matches[1]] = [int]$Matches[2] }
        elseif ($l -match 'unlocking_principles\s*=')                        { $pmGated[$n] = $true }   # power-bloc-gated: never the default
        elseif ($l -match 'unlocking_technologies\s*=')                      { $pmTech[$n] = $true }
        if     ($l -match 'unlocking_laws\s*=\s*\{')   { $mode = 'u' }
        elseif ($l -match 'disallowing_laws\s*=\s*\{') { $mode = 'd' }
        elseif ($mode -and $l -match '\}')             { $mode = $null }
        elseif ($mode -and $l -match '^\s*(law_[A-Za-z0-9_]+)') {
            if ($mode -eq 'u') { $unlock.Add($Matches[1]) } else { $disallow.Add($Matches[1]) }
        }
    }
    $pmEmp[$n] = $e
    $pmLaws[$n] = @{ unlock = $unlock.ToArray(); disallow = $disallow.ToArray() }
}
# A PMG's default ("off") PM = its first non-gated PM - the same rule the UI uses.
$basePmCache = @{}
function Get-BasePm($pmg) {
    if ($basePmCache.ContainsKey($pmg)) { return $basePmCache[$pmg] }
    $pms = $pmgPms[$pmg]
    $r = $null
    if ($pms) { foreach ($p in $pms) { if (-not $pmGated.ContainsKey($p)) { $r = $p; break } }; if (-not $r) { $r = $pms[0] } }
    $basePmCache[$pmg] = $r
    return $r
}

# For a building history never creates, the active PM of a PMG is whatever the owner's LAWS allow:
# take the first PM that is not power-bloc-gated, not tech-gated (1836), not disallowed by an active
# law, and either ungated by law or unlocked by one the country has. Falls back to the PMG default.
function Select-LawPm($pmg, $laws) {
    foreach ($pm in $pmgPms[$pmg]) {
        if ($pmGated.ContainsKey($pm) -or $pmTech.ContainsKey($pm)) { continue }
        $g = $pmLaws[$pm]; if (-not $g) { return $pm }
        $bad = $false
        foreach ($l in $g.disallow) { if ($laws.ContainsKey($l)) { $bad = $true; break } }
        if ($bad) { continue }
        if ($g.unlock.Count -gt 0) {
            $hit = $false
            foreach ($l in $g.unlock) { if ($laws.ContainsKey($l)) { $hit = $true; break } }
            if (-not $hit) { continue }
        }
        return $pm
    }
    return (Get-BasePm $pmg)
}

# ---------------------------------------------------------------- when can a good exist? (by YEAR)
# Whether pops can want a good is a question about the CALENDAR, not about one country's research: a
# market imports what it cannot make. So availability is derived per good from the earliest year any
# building x PM that outputs it could exist - i.e. the start year of the earliest ERA whose techs
# unlock it. Vanilla dates the eras in comments (`era_2 = { #1836-1861 }`), which is the only place
# those years appear, so we parse them and fall back to a static ladder if the format ever changes.
$techEra = @{}
$techBlocks = Get-TopBlocks (Join-Path $Game 'common\technology\technologies') ''
foreach ($n in $techBlocks.Keys) {
    if (($techBlocks[$n] -join ' ') -match 'era\s*=\s*era_(\d+)') { $techEra[$n] = [int]$Matches[1] }
}
$ERA_YEAR_FALLBACK = @{ 1 = 0; 2 = 1836; 3 = 1862; 4 = 1887; 5 = 1911 }
$eraYear = @{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\technology\eras') -Filter *.txt)) {
    $cur = $null
    foreach ($l in (Get-Content -LiteralPath $f.FullName)) {
        if ($l -match '^\s*era_(\d+)\s*=') {
            $cur = [int]$Matches[1]
            # "#Pre-1836" = always available by our 1836+ scenarios; "#1836-1861" = starts 1836
            if     ($l -match '#\s*Pre-\d{4}')  { $eraYear[$cur] = 0 }
            elseif ($l -match '#\s*(\d{4})')    { $eraYear[$cur] = [int]$Matches[1] }
        }
    }
}
foreach ($e in $ERA_YEAR_FALLBACK.Keys) {
    if (-not $eraYear.ContainsKey($e)) { Warn "era_$e has no year comment - using fallback $($ERA_YEAR_FALLBACK[$e])"; $eraYear[$e] = $ERA_YEAR_FALLBACK[$e] }
}
# earliest year a tech gate can be satisfied; an empty gate list is always satisfied
function Get-GateYear($techList) {
    if (-not $techList -or $techList.Count -eq 0) { return 0 }
    $best = $null
    foreach ($t in $techList) {
        $e = $techEra[$t]; if (-not $e) { continue }
        $y = $eraYear[$e]
        if ($null -eq $best -or $y -lt $best) { $best = $y }
    }
    if ($null -eq $best) { return 9999 }   # gated by a tech we can't date: treat as unavailable
    return $best
}
# ---------------------------------------------------------------- active laws per country (1836)
$lawsOf = @{}
$countryDir = Join-Path $Game 'common\history\countries'
foreach ($f in (Get-ChildItem $countryDir -Filter *.txt)) {
    $tag = $null
    foreach ($l in (Get-Content -LiteralPath $f.FullName)) {
        if ($l -match '^\s*c:([A-Z0-9_]+)\s*\??=') { $tag = $Matches[1]; if (-not $lawsOf.ContainsKey($tag)) { $lawsOf[$tag] = @{} } }
        elseif ($tag -and $l -match 'activate_law\s*=\s*law_type:(law_[A-Za-z0-9_]+)') { $lawsOf[$tag][$Matches[1]] = $true }
    }
}

# ---------------------------------------------------------------- state regions: arable land + subsistence type
# A state's SUBSISTENCE buildings occupy the arable land its real farms/ranches/plantations don't
# (each of their levels takes 1). They are never in the history files - the game raises them itself.
$srBlocks = Get-TopBlocks (Join-Path $Game 'map_data\state_regions') 'STATE_'
$stateRegion = @{}
foreach ($n in $srBlocks.Keys) {
    $j = ($srBlocks[$n] -join ' ')
    $arable = if ($j -match 'arable_land\s*=\s*(\d+)') { [int]$Matches[1] } else { 0 }
    $subs   = if ($j -match 'subsistence_building\s*=\s*"([a-z_]+)"') { $Matches[1] } else { 'building_subsistence_farm' }
    $provs  = if ($j -match 'provinces\s*=\s*\{([^}]*)\}') { ([regex]::Matches($Matches[1], '"[^"]+"')).Count } else { 0 }
    $stateRegion[$n] = @{ arable = $arable; subs = $subs; provs = $provs }
}
# state ownership at 1836: a state can be split between countries, so apportion its arable land by
# the share of provinces each owner holds.
$stateOwners = @{}
$curState = $null
$stLines = Get-Content -LiteralPath (Join-Path $Game 'common\history\states\00_states.txt')
for ($i = 0; $i -lt $stLines.Count; $i++) {
    $l = $stLines[$i]
    if ($l -match 's:(STATE_[A-Za-z0-9_]+)\s*=\s*\{') { $curState = $Matches[1] }
    elseif ($curState -and $l -match 'country\s*=\s*c:([A-Z0-9_]+)') {
        $c = $Matches[1]
        for ($k = $i; $k -lt [math]::Min($i + 4, $stLines.Count); $k++) {
            if ($stLines[$k] -match 'owned_provinces\s*=\s*\{([^}]*)\}') {
                $n = ([regex]::Matches($Matches[1], 'x[0-9A-Fa-f]{6}')).Count
                if (-not $stateOwners.ContainsKey($curState)) { $stateOwners[$curState] = @{} }
                $stateOwners[$curState][$c] = ($stateOwners[$curState][$c] + 0) + $n
                break
            }
        }
    }
}

# ---------------------------------------------------------------- pop types: working-adult ratio
$workRatio = @{}; $consumptionMult = @{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\pop_types') -Filter *.txt)) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    if ($txt -match '^\s*([a-z_]+)\s*=\s*\{') {
        $name = $Matches[1]
        $workRatio[$name] = if ($txt -match 'working_adult_ratio\s*=\s*([0-9.]+)') { [double]$Matches[1] } else { $null }
        # `consumption_mult` is the pop type's own share of market participation - peasants have 0.05
        # ("the portion of Peasant buy packages that are added as state region consumption").
        if ($txt -match 'consumption_mult\s*=\s*([0-9.]+)') { $consumptionMult[$name] = [double]$Matches[1] }
    }
}
$WORK_RATIO_BASE = 0.25   # defines NPops WORKING_ADULT_RATIO_BASE
$DEPENDENT_CONSUMPTION = 0.5   # defines NPops DEPENDENT_CONSUMPTION_RATIO - dependents need half of a working adult
function Get-WorkRatio($popType) {
    $r = $workRatio[$popType]
    if ($r -and $r -gt 0) { return $r }
    return $WORK_RATIO_BASE
}

# ---------------------------------------------------------------- pop consumption tables (buy packages + needs)
$wBlocks = Get-TopBlocks (Join-Path $Game 'common\buy_packages') 'wealth_'
$buyPackages = [ordered]@{}
foreach ($n in $wBlocks.Keys) {
    $lvl = ($n -replace '^wealth_', '')
    $goods = [ordered]@{}; $inGoods = $false; $depth = 0
    foreach ($l in $wBlocks[$n]) {
        if (-not $inGoods) { if ($l -match 'goods\s*=\s*\{') { $inGoods = $true; $depth = 1 }; continue }
        $depth += ([regex]::Matches($l, '\{')).Count - ([regex]::Matches($l, '\}')).Count
        if ($l -match '(popneed_[a-z_]+)\s*=\s*([0-9.]+)') { $goods[$Matches[1]] = [double]$Matches[2] }
        if ($depth -le 0) { break }
    }
    $buyPackages[$lvl] = $goods
}

$nBlocks = Get-TopBlocks (Join-Path $Game 'common\pop_needs') 'popneed_'
$popNeeds = [ordered]@{}
foreach ($n in $nBlocks.Keys) {
    $def = $null; $entries = New-Object System.Collections.Generic.List[object]; $cur = $null
    foreach ($l in $nBlocks[$n]) {
        if     ($l -match '^\s*default\s*=\s*([a-z_]+)')          { $def = $Matches[1] }
        elseif ($l -match 'entry\s*=\s*\{')                       { if ($cur) { $entries.Add($cur) }; $cur = [ordered]@{ g = $null; w = 1.0; max = 1.0; min = 0.0 } }
        elseif ($cur -and $l -match '^\s*goods\s*=\s*([a-z_]+)')  { $cur.g = $Matches[1] }
        elseif ($cur -and $l -match 'weight\s*=\s*([0-9.]+)')     { $cur.w = [double]$Matches[1] }
        elseif ($cur -and $l -match 'max_supply_share\s*=\s*([0-9.]+)') { $cur.max = [double]$Matches[1] }
        elseif ($cur -and $l -match 'min_supply_share\s*=\s*([0-9.]+)') { $cur.min = [double]$Matches[1] }
    }
    if ($cur) { $entries.Add($cur) }
    $popNeeds[$n] = [ordered]@{ def = $def; entries = @($entries.ToArray() | Where-Object { $_.g }) }
}

# ---------------------------------------------------------------- market membership (subject relationships)
$subjOf = @{}       # subject tag -> overlord tag
$ownMarket = @{}    # subject tag -> $true when granted its own market
$diploPath = Join-Path $Game 'common\history\diplomacy\00_subject_relationships.txt'
$overlord = $null; $pactCountry = $null
foreach ($l in (Get-Content -LiteralPath $diploPath)) {
    if ($l -match '^\s*c:([A-Z0-9_]+)\s*\??=\s*\{')     { $overlord = $Matches[1]; $pactCountry = $null; continue }
    if ($l -match '^\s*country\s*=\s*c:([A-Z0-9_]+)')   { $pactCountry = $Matches[1]; continue }
    if ($l -match '^\s*type\s*=\s*([a-z_]+)') {
        $type = $Matches[1]
        if ($overlord -and $pactCountry) {
            if ($type -eq 'grant_own_market')          { $ownMarket[$pactCountry] = $true }
            elseif ($SUBJECT_TYPES -contains $type)    { if (-not $subjOf.ContainsKey($pactCountry)) { $subjOf[$pactCountry] = $overlord } }
        }
        $pactCountry = $null
    }
}
# lead -> every tag in its market (transitive; a granted-own-market subject takes its own subtree with it)
function Get-MarketMembers($lead) {
    $members = New-Object System.Collections.Generic.List[string]
    $members.Add($lead)
    $changed = $true
    while ($changed) {
        $changed = $false
        foreach ($sub in $subjOf.Keys) {
            if ($members -contains $sub) { continue }
            if ($ownMarket.ContainsKey($sub)) { continue }
            if ($members -contains $subjOf[$sub]) { $members.Add($sub); $changed = $true }
        }
    }
    return ,$members.ToArray()
}

# ---------------------------------------------------------------- goods transfers (treaty articles)
# Only `goods_transfer` articles of treaties in force in 1836. The file wraps some treaties in an
# if/else on a DLC feature, so the same treaty appears twice - dedupe on name + the two countries.
$transfers = New-Object System.Collections.Generic.List[object]
$treatyPath = Join-Path $Game 'common\history\treaties\00_historical_treaties.txt'
if (Test-Path $treatyPath) {
    $tl = Get-Content -LiteralPath $treatyPath
    $seenTreaty = @{}
    $i = 0
    while ($i -lt $tl.Count) {
        if ($tl[$i] -match 'create_treaty\s*=\s*\{') {
            $blk = New-Object System.Collections.Generic.List[string]; $depth = 0
            do {
                $l = $tl[$i]
                $depth += ([regex]::Matches($l, '\{')).Count - ([regex]::Matches($l, '\}')).Count
                $blk.Add($l); $i++
            } while ($i -lt $tl.Count -and $depth -gt 0)

            $name = $null; $first = $null; $second = $null; $from = $null; $years = 0
            $arts = New-Object System.Collections.Generic.List[object]; $cur = $null
            foreach ($l in $blk) {
                if     ($l -match '^\s*name\s*=\s*([A-Za-z0-9_]+)')            { $name = $Matches[1] }
                elseif ($l -match '^\s*first_country\s*=\s*c:([A-Z0-9_]+)')    { $first = $Matches[1] }
                elseif ($l -match '^\s*second_country\s*=\s*c:([A-Z0-9_]+)')   { $second = $Matches[1] }
                elseif ($l -match 'entered_into_force_on\s*=\s*(\d+)\.')       { $from = [int]$Matches[1] }
                elseif ($l -match 'binding_period\s*=\s*\{\s*years\s*=\s*(\d+)') { $years = [int]$Matches[1] }
                elseif ($l -match '^\s*article\s*=\s*([a-z_]+)') {
                    if ($cur) { $arts.Add($cur) }
                    $cur = [ordered]@{ article = $Matches[1]; src = $null; dst = $null; good = $null; qty = 0 }
                }
                elseif ($cur -and $l -match 'source_country\s*=\s*c:([A-Z0-9_]+)') { $cur.src = $Matches[1] }
                elseif ($cur -and $l -match 'target_country\s*=\s*c:([A-Z0-9_]+)') { $cur.dst = $Matches[1] }
                elseif ($cur -and $l -match 'goods\s*=\s*g:([a-z_]+)')             { $cur.good = $Matches[1] }
                elseif ($cur -and $l -match 'quantity\s*=\s*([0-9.]+)')            { $cur.qty = [double]$Matches[1] }
            }
            if ($cur) { $arts.Add($cur) }

            $key = "$name|$first|$second"
            $active = (-not $from -or $from -le $START_YEAR) -and ($years -le 0 -or -not $from -or ($from + $years) -ge $START_YEAR)
            if ($active -and -not $seenTreaty.ContainsKey($key)) {
                $seenTreaty[$key] = $true
                foreach ($a in $arts) {
                    if ($a.article -eq 'goods_transfer' -and $a.good -and $a.qty -gt 0 -and $a.src -and $a.dst) {
                        $transfers.Add([pscustomobject]@{ src = $a.src; dst = $a.dst; good = $a.good; qty = $a.qty; treaty = $name })
                    }
                }
            }
        } else { $i++ }
    }
}

# ---------------------------------------------------------------- our tier split (config)
$cfgPath = if ($Config) { (Resolve-Path -LiteralPath $Config).Path } else { Join-Path $Repo 'config\mod_config.json' }
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$maps = Get-SplitMaps $cfg
$baseIndustry = $maps.baseIndustry; $pmMap = $maps.pmMap

# ---------------------------------------------------------------- vanilla 1836 buildings
$script:bldRows = New-Object System.Collections.Generic.List[object]
$script:unmapped = New-Object System.Collections.Generic.List[string]
$script:ownRows = New-Object System.Collections.Generic.List[object]
$script:createdTypes = @{}
$bldHandler = {
    param($block, $state, $country)
    if (-not $country) { return }
    $bkey = $null; $levels = 0
    $pms = New-Object System.Collections.Generic.List[string]
    foreach ($l in $block) {
        if ($l -match 'building\s*=\s*"(building_[A-Za-z0-9_]+)"') { if (-not $bkey) { $bkey = $Matches[1] } }
        if ($l -match 'levels\s*=\s*(\d+)') { $levels += [int]$Matches[1] }
        if ($l -match 'activate_production_methods\s*=\s*\{([^}]*)\}') {
            foreach ($m in [regex]::Matches($Matches[1], '"([A-Za-z0-9_-]+)"')) { $pms.Add($m.Groups[1].Value) }
        }
    }
    if (-not $bkey -or $levels -le 0) { return }
    $script:createdTypes[$bkey] = $true
    # OWNERSHIP buildings (manor houses / financial districts) are never `create_building`d - the game
    # raises them to hold what they own, one level per owned level. Record every `add_ownership = {
    # building = { type=... country=... levels=... } }` entry; the owner sits in ITS country's market.
    $joined = ($block -join ' ')
    foreach ($m in [regex]::Matches($joined, 'building\s*=\s*\{([^}]*)\}')) {
        $inner = $m.Groups[1].Value
        if ($inner -notmatch 'type\s*=\s*"(building_[A-Za-z0-9_]+)"') { continue }
        $otype = $Matches[1]
        if ($otype -eq $bkey) { continue }                                  # self-ownership: not an ownership building
        $ocountry = if ($inner -match 'country\s*=\s*"c:([A-Za-z0-9_]+)"') { $Matches[1] } else { $country }
        $olevels  = if ($inner -match 'levels\s*=\s*(\d+)') { [int]$Matches[1] } else { 0 }
        if ($olevels -gt 0) { $script:ownRows.Add([pscustomobject]@{ country = $ocountry; key = $otype; levels = $olevels }) }
    }
    # map onto our tier building when this industry is split
    $tierKey = $bkey
    if ($baseIndustry.ContainsKey($bkey)) {
        $id = $baseIndustry[$bkey]; $hit = $null
        foreach ($p in $pms) { if ($pmMap[$id].ContainsKey($p)) { $hit = $pmMap[$id][$p]; break } }
        if ($hit) { $tierKey = $hit.tier_key }
        else { $script:unmapped.Add("$bkey ($country/$state)") }   # keeps Tier-1 key; also the vanilla_pm drift alarm
    }
    $script:bldRows.Add([pscustomobject]@{ country = $country; state = $state; vanilla = $bkey; key = $tierKey; levels = $levels; pms = $pms.ToArray() })
}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\history\buildings') -Filter *.txt)) {
    [void](Walk-HistoryFile $f.FullName $bldHandler)
}
# Fold the implied ownership buildings in as ordinary buildings. An owner type that history DOES create
# somewhere is a real building already counted (and would double-count), so only never-created owner
# types qualify - today manor houses + financial districts, and any new one a patch adds.
$ownTypes = @{}
foreach ($r in $script:ownRows) { if (-not $script:createdTypes.ContainsKey($r.key)) { $ownTypes[$r.key] = $true } }
foreach ($r in $script:ownRows) {
    if (-not $ownTypes.ContainsKey($r.key)) { continue }
    $script:bldRows.Add([pscustomobject]@{ country = $r.country; state = $null; vanilla = $r.key; key = $r.key; levels = $r.levels; pms = @() })
}
Write-Output ("  ownership buildings implied from add_ownership: {0}" -f (($ownTypes.Keys | Sort-Object) -join ', '))

# ---------------------------------------------------------------- military: units, from HISTORY
# Army goods are NOT on the barracks or the logistics centre - both of those have production methods
# with no goods at all. They are on the COMBAT UNIT TYPE, as `upkeep_modifier { goods_input_*_add }`
# per battalion. And the battalions themselves are in the history files
# (common/history/military_formations: `combat_unit = { type = unit_type:X  count = N }`), so the
# whole military side is derivable without measuring anything.
$unitGoods = @{}    # unit type -> good -> qty per battalion (peacetime upkeep)
$unitGroup = @{}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\combat_unit_types') -Filter *.txt)) {
    $cur = $null; $inUpkeep = $false; $depth = 0
    foreach ($l in (Get-Content -LiteralPath $f.FullName)) {
        $line = ($l -replace '#.*$', '')
        if ($line -match '^\s*(combat_unit_type_[a-z0-9_]+)\s*=\s*\{') { $cur = $Matches[1]; $unitGoods[$cur] = [ordered]@{}; $inUpkeep = $false; continue }
        if (-not $cur) { continue }
        if ($line -match '^\s*group\s*=\s*(combat_unit_group_[a-z0-9_]+)') { $unitGroup[$cur] = $Matches[1] }
        if ($line -match '^\s*upkeep_modifier\s*=\s*\{') { $inUpkeep = $true; $depth = 1; continue }
        if ($inUpkeep) {
            $depth += ([regex]::Matches($line, '\{')).Count - ([regex]::Matches($line, '\}')).Count
            if ($line -match 'goods_input_([a-z_]+)_add\s*=\s*(-?[0-9.]+)') { $unitGoods[$cur][$Matches[1]] = [double]$Matches[2] }
            if ($depth -le 0) { $inUpkeep = $false }
        }
    }
}
# battalions per country per unit type
$unitsOf = @{}
$mfDir = Join-Path $Game 'common\history\military_formations'
if (Test-Path $mfDir) {
    foreach ($f in (Get-ChildItem $mfDir -Filter *.txt)) {
        $tag = $null; $ut = $null
        foreach ($l in (Get-Content -LiteralPath $f.FullName)) {
            $line = ($l -replace '#.*$', '')
            if ($line -match '^\s*c:([A-Z0-9_]+)\s*\??=\s*\{') { $tag = $Matches[1]; continue }
            if ($line -match 'type\s*=\s*unit_type:(combat_unit_type_[a-z0-9_]+)') { $ut = $Matches[1]; continue }
            if ($ut -and $tag -and $line -match '^\s*count\s*=\s*(\d+)') {
                $unitsOf["$tag|$ut"] = ($unitsOf["$tag|$ut"] + 0) + [int]$Matches[1]
                $ut = $null
            }
        }
    }
} else { Warn "common/history/military_formations not found - the scenario will carry no military units" }
Write-Output ("  military: {0} unit type(s) with upkeep goods, {1} country-unit entries from history" -f `
    (($unitGoods.Keys | Where-Object { $unitGoods[$_].Count -gt 0 }).Count), $unitsOf.Count)

# ---------------------------------------------------------------- vanilla 1836 pops
$script:popRows = New-Object System.Collections.Generic.List[object]
$popHandler = {
    param($block, $state, $country)
    if (-not $country) { return }
    $size = 0; $type = $null
    foreach ($l in $block) {
        if ($l -match '^\s*size\s*=\s*(\d+)')          { $size = [int]$Matches[1] }
        elseif ($l -match '^\s*pop_type\s*=\s*([a-z_]+)') { $type = $Matches[1] }
    }
    if ($size -gt 0) { $script:popRows.Add([pscustomobject]@{ country = $country; size = $size; type = $type }) }
}
foreach ($f in (Get-ChildItem (Join-Path $Game 'common\history\pops') -Filter *.txt)) {
    Read-HistoryBlocks $f.FullName 'create_pop' $popHandler
}

# ---------------------------------------------------------------- build each preset
$presetCfgPath = Join-Path $Repo 'config\presets.json'
$presetCfg = Get-Content -LiteralPath $presetCfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$defSol = $presetCfg.defaults.sol

# ---------------------------------------------------------------- measured 1836 reference (optional)
# Four things the game FILES cannot answer, measured once and committed: what a market actually
# trades, each stratum's standard of living, and how many military buildings the engine raised.
# Optional on purpose - a fresh clone with no measurement still produces working presets, just
# without those. See tools/extract_measured.ps1.
$measured = $null
$measuredPath = Join-Path $Repo 'config\measured_1836.json'
if (Test-Path $measuredPath) {
    $measured = Get-Content -LiteralPath $measuredPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Output ("  measured reference: {0} market(s), {1}, game {2}" -f `
        ($measured.markets.PSObject.Properties.Name).Count, $measured._meta.date, $measured._meta.game_version)
} else {
    Warn "config/measured_1836.json missing - presets will carry no trade, no measured SoL and no military buildings"
}
function Get-Measured($p) {
    if (-not $measured -or -not $p.measured_market) { return $null }
    return $measured.markets.($p.measured_market)
}

# every good any pop need can be satisfied with - the UI renders one unlock toggle per entry
$needGoods = New-Object System.Collections.Generic.List[string]
foreach ($n in $popNeeds.Keys) {
    foreach ($e in $popNeeds[$n].entries) { if ($needGoods -notcontains $e.g) { $needGoods.Add($e.g) } }
}
# The year each good becomes possible ANYWHERE: the earliest year some building x PM that outputs it
# can run (both gates satisfied). 0 = always. Country-independent on purpose - a market can import a
# good it cannot make itself, so availability is a property of the calendar, not of one country's research.
$availableFrom = [ordered]@{}
foreach ($g in $needGoods) {
    $best = 9999
    foreach ($b in $bldPmgs.Keys) {
        $by = Get-GateYear $bldTech[$b]
        if ($by -ge $best) { continue }
        foreach ($pmg in $bldPmgs[$b]) {
            foreach ($pm in $pmgPms[$pmg]) {
                if (-not $pmOut[$pm] -or -not $pmOut[$pm].ContainsKey($g)) { continue }
                $y = [math]::Max($by, (Get-GateYear $pmTechList[$pm]))
                if ($y -lt $best) { $best = $y }
            }
        }
    }
    $availableFrom[$g] = $best
}

$out = New-Object System.Collections.Generic.List[object]
foreach ($p in $presetCfg.presets) {
    # ⚠ FIRST thing in the loop. This used to be assigned two thirds of the way down, AFTER the
    # urban-centre block that reads it - so that block silently used the PREVIOUS preset's market.
    # It failed quietly and plausibly: Russia inherited the Qing's urban-centre methods (free clergy
    # 104 levels against state 2) and came out with free urban clergy, when its own capital runs
    # state clergy. A per-iteration variable read before assignment is a stale value, not an error.
    $meas = Get-Measured $p
    $lead = $p.country
    $members = New-Object System.Collections.Generic.List[string]
    foreach ($m in (Get-MarketMembers $lead)) { $members.Add($m) }
    if ($p.market_add)  { foreach ($m in $p.market_add)  { if ($members -notcontains $m) { $members.Add($m) } } }
    if ($p.market_drop) { foreach ($m in $p.market_drop) { [void]$members.Remove($m) } }
    $memberSet = @{}; foreach ($m in $members) { $memberSet[$m] = $true }

    # --- buildings: levels per (tier-mapped) key + the PM vanilla runs there (majority by levels) ---
    $levelsByKey = @{}; $pmVotes = @{}
    $jobs = @{}; $agriUsed = @{}; $urbByState = @{}
    foreach ($r in $script:bldRows) {
        if (-not $memberSet.ContainsKey($r.country)) { continue }
        $levelsByKey[$r.key] = ($levelsByKey[$r.key] + 0) + $r.levels
        # arable land this state's real farms/ranches/plantations occupy (the rest is subsistence)
        if ($r.state -and ($ARABLE_GROUPS -contains $bldGroup[$r.vanilla])) {
            $ak = "$($r.state)|$($r.country)"; $agriUsed[$ak] = ($agriUsed[$ak] + 0) + $r.levels
        }
        # urbanization, accumulated PER STATE because the urban-centre count is a per-state floor
        if ($r.state) {
            # Keyed on the VANILLA building, not our tier key - $bldGroup only knows vanilla, and
            # more importantly this is what makes "a tier provides as much urbanization as the
            # vanilla building it replaced" true by construction rather than by a copied constant.
            $u = Get-Urbanization $r.vanilla
            if ($u -gt 0) {
                $uk = "$($r.state)|$($r.country)"
                $urbByState[$uk] = ($urbByState[$uk] + 0) + $r.levels * $u
            }
        }
        # Which PMG each activated PM belongs to is resolved WITHIN THIS BUILDING's PMGs: several PMs are
        # shared across buildings (pm_simple_farming, pm_tools_disabled, ... appear in every farm's PMGs),
        # so a global pm->pmg map would attribute them to whichever building was parsed first.
        $chosen = @{}
        foreach ($pmg in $bldPmgs[$r.vanilla]) {
            $list = $pmgPms[$pmg]
            if (-not $list) { continue }
            foreach ($pm in $r.pms) { if ($list -contains $pm) { $chosen[$pmg] = $pm; break } }
        }
        # per-PMG vote, weighted by levels, so the preset picks the setup most of the market actually runs
        foreach ($pmg in $chosen.Keys) {
            $vk = "$($r.key)|$pmg|$($chosen[$pmg])"
            $pmVotes[$vk] = ($pmVotes[$vk] + 0) + $r.levels
        }
        # employment: every PMG of the VANILLA building contributes its active PM (history's, else the PMG default)
        foreach ($pmg in $bldPmgs[$r.vanilla]) {
            $pm = if ($chosen.ContainsKey($pmg)) { $chosen[$pmg] } else { Get-BasePm $pmg }
            if (-not $pm -or -not $pmEmp.ContainsKey($pm)) { continue }
            foreach ($t in $pmEmp[$pm].Keys) { $jobs[$t] = ($jobs[$t] + 0) + $r.levels * $pmEmp[$pm][$t] }
        }
    }
    $buildings = [ordered]@{}
    foreach ($k in ($levelsByKey.Keys | Sort-Object)) { $buildings[$k] = [int]$levelsByKey[$k] }

    $pmsByKey = [ordered]@{}
    foreach ($vk in ($pmVotes.Keys | Sort-Object)) {
        $parts = $vk -split '\|'
        $bk = $parts[0]; $pmg = $parts[1]; $pm = $parts[2]
        if (-not $pmsByKey.Contains($bk)) { $pmsByKey[$bk] = [ordered]@{} }
        $prev = $pmsByKey[$bk][$pmg]
        if (-not $prev -or $pmVotes["$bk|$pmg|$prev"] -lt $pmVotes[$vk]) { $pmsByKey[$bk][$pmg] = $pm }
    }

    # --- pops: total, explicit slaves, and the job-derived class split ---
    $totalPop = 0; $slavePop = 0
    $cls = [ordered]@{ upper = 0.0; middle = 0.0; lower = 0.0 }
    foreach ($r in $script:popRows) {
        if (-not $memberSet.ContainsKey($r.country)) { continue }
        $totalPop += $r.size
        if ($r.type -eq 'slaves') { $slavePop += $r.size }
        elseif ($r.type) {
            $s = $STRATA[$r.type]
            if ($s -and $cls.Contains($s)) { $cls[$s] += $r.size }   # explicitly seeded professions
        }
    }
    # The class split does NOT come from building jobs any more.
    #
    # It used to: employment of each building's active PMs, divided by the working-adult ratio, gave
    # people per profession. That inverted the dependency - the pop side inherited every error in the
    # building side, and the worst of those was manor houses, inferred from `add_ownership` at a tenth
    # of the real count (British market 426 levels against 4 755). Manor houses carry no goods, so the
    # error was invisible in market orders while flowing straight into the UPPER class, which buys the
    # most per head.
    #
    # History cannot supply the split either - only 690 of 4 454 `create_pop` blocks name a pop_type,
    # because the engine assigns the rest from available jobs at init. So: SIZE from history (which has
    # it), SHARES from measurement (which is the only place the answer exists). Minimum necessary.
    $splitSrc = 'jobs (no measurement)'
    $wbs = $(if ($meas) { $meas.workforce_by_stratum } else { $null })
    $wTot = 0.0
    if ($wbs) { foreach ($s in @('upper','middle','lower','peasants','slaves')) { $wTot += [double]($wbs.$s) } }
    if ($wTot -gt 0) {
        # Workforce shares stand in for people shares: working_adult_ratio is the base 0.25 for every
        # stratum here (peasants included - they script no override), so the two are proportional.
        foreach ($s in @('upper','middle','lower')) { $cls[$s] = $totalPop * [double]($wbs.$s) / $wTot }
        $slavePop = [int]($totalPop * [double]($wbs.slaves) / $wTot)
        $peasants = [math]::Max(0, $totalPop - $cls.upper - $cls.middle - $cls.lower - $slavePop)
        $splitSrc = "measured $($measured._meta.date)"
    } else {
        foreach ($t in $jobs.Keys) {
            if ($t -eq 'slaves') { continue }    # slave POPS are explicit in history; don't double-count their jobs
            $s = $STRATA[$t]
            if (-not $s) { Warn "unknown pop type '$t' (treated as lower) - check the STRATA map after a patch"; $s = 'lower' }
            if ($s -eq 'peasants') { continue }  # peasants are the remainder, never job-derived
            if ($cls.Contains($s)) { $cls[$s] += $jobs[$t] / (Get-WorkRatio $t) }
        }
        $employed = $cls.upper + $cls.middle + $cls.lower + $slavePop
        $peasants = [math]::Max(0, $totalPop - $employed)
    }

    # --- subsistence buildings: the PEASANTS are the supply ---
    # History never creates these; the game raises one per state covering the arable land the real
    # farms/ranches/plantations leave free, each level hiring N peasants (5000, rice paddies 10000).
    # Their goods are `workforce_scaled` - proportional to the peasants actually WORKING there - so the
    # supply this puts on the market is set by the peasant count, capped by the land. We therefore emit
    # each subsistence type at its STAFFED-LEVEL EQUIVALENT (employed peasants / employment per level),
    # which is exactly what reproduces the real output under the UI's full-employment model.
    $subsArable = @{}; $subsOwnerVotes = @{}
    foreach ($st in $stateOwners.Keys) {
        $reg = $stateRegion[$st]
        if (-not $reg -or $reg.arable -le 0) { continue }
        $tot = 0; foreach ($c in $stateOwners[$st].Keys) { $tot += $stateOwners[$st][$c] }
        if ($tot -le 0) { continue }
        foreach ($c in $stateOwners[$st].Keys) {
            if (-not $memberSet.ContainsKey($c)) { continue }
            $free = $reg.arable * ($stateOwners[$st][$c] / [double]$tot) - ($agriUsed["$st|$c"] + 0)
            if ($free -le 0) { continue }
            $subsArable[$reg.subs] = ($subsArable[$reg.subs] + 0) + $free
            $vk = "$($reg.subs)|$c"; $subsOwnerVotes[$vk] = ($subsOwnerVotes[$vk] + 0) + $free
        }
    }
    # PMs per subsistence type: decided by the LAWS of the owner holding most of that land (serfdom /
    # tenant farmers / peasant proprietorship change both the goods and the peasant→farmer split).
    $subsPms = @{}; $subsEmp = @{}
    foreach ($k in $subsArable.Keys) {
        $best = $null; $bestW = -1
        foreach ($vk in $subsOwnerVotes.Keys) {
            $parts = $vk -split '\|'
            if ($parts[0] -ne $k) { continue }
            if ($subsOwnerVotes[$vk] -gt $bestW) { $bestW = $subsOwnerVotes[$vk]; $best = $parts[1] }
        }
        $laws = if ($best -and $lawsOf.ContainsKey($best)) { $lawsOf[$best] } else { @{} }
        $sel = [ordered]@{}; $e = 0
        foreach ($pmg in $bldPmgs[$k]) {
            $pm = Select-LawPm $pmg $laws
            if (-not $pm) { continue }
            $sel[$pmg] = $pm
            if ($pmEmp.ContainsKey($pm)) { $e += ($pmEmp[$pm]['peasants'] + 0) }
        }
        if ($e -le 0) { $e = 5000 }
        $subsPms[$k] = $sel; $subsEmp[$k] = $e
    }
    $subsCapacity = 0.0
    foreach ($k in $subsArable.Keys) { $subsCapacity += $subsArable[$k] * $subsEmp[$k] }
    $peasantWork = $peasants * $WORK_RATIO_BASE          # peasants script no working_adult_ratio override
    $staffing = if ($subsCapacity -gt 0) { [math]::Min(1.0, $peasantWork / $subsCapacity) } else { 0.0 }
    $subsLevels = 0
    foreach ($k in ($subsArable.Keys | Sort-Object)) {
        $lvl = [int][math]::Round($subsArable[$k] * $staffing)
        if ($lvl -lt 1) { continue }
        $buildings[$k] = $lvl; $pmsByKey[$k] = $subsPms[$k]; $subsLevels += $lvl
    }

    # --- urban centres: one level per 100 urbanization, floored PER STATE then summed ---
    # Note the floor has to be taken state by state: summing first and flooring once would hand a
    # large market the rounding loss of every state at once. Their PMs are chosen the same way the
    # other never-created buildings are (Select-LawPm, by the market leader's laws) - history has no
    # line to read, and the alternative, measuring capitals in-game, would make presets.js depend on
    # a game RUN rather than the game FILES.
    # Buildings history never creates carry urbanization too - military 2/level, companies 5 - and
    # leaving them out was most of the derived shortfall on developed markets. They come from the
    # measured reference per STATE, because the floor is per state and a market total cannot be
    # apportioned back. Keyed by state NAME here (the measurement has no state ids), so a state whose
    # name the history walker spells differently simply contributes nothing rather than mis-crediting
    # another state.
    $extraUnjoined = 0
    if ($meas -and $meas.extra_by_state) {
        foreach ($sp in $meas.extra_by_state.PSObject.Properties) {
            $stKey = $stateKeyByName[$sp.Name]
            foreach ($bp in $sp.Value.PSObject.Properties) {
                $u = Get-Urbanization $bp.Name
                if ($u -le 0) { continue }
                $pts = [int]$bp.Value * $u
                if (-not $stKey) { $extraUnjoined += $pts; continue }
                # find the bucket this state already has in THIS market (a state can be split, so the
                # key carries the owner too); fall back to a market-scoped bucket for the state.
                $hit = $null
                foreach ($uk in @($urbByState.Keys)) { if ($uk -like "$stKey|*") { $hit = $uk; break } }
                if (-not $hit) { $hit = "$stKey|extra" }
                $urbByState[$hit] = ($urbByState[$hit] + 0) + $pts
            }
        }
    }
    $ucLevels = 0
    foreach ($uk in $urbByState.Keys) { $ucLevels += [math]::Floor($urbByState[$uk] / $URBAN_PER_LEVEL) }
    $ucLevels = [int]$ucLevels
    if ($ucLevels -gt 0) {
        # PMs: MEASURED where available, majority by levels within each PMG. Inferring them from the
        # market leader's laws (the way subsistence PMs are chosen) got two PMGs of four wrong -
        # real urban centres largely run `pm_market_squares` rather than stalls, many run
        # `pm_gas_streetlights` (which buys coal), and most run `pm_free_urban_clergy` rather than
        # state. Those are exactly the goods the panel was short on.
        $leadLaws = if ($lawsOf.ContainsKey($lead)) { $lawsOf[$lead] } else { @{} }
        $ucSel = [ordered]@{}
        $ucPmSrc = 'laws'
        $ucMeas = $(if ($meas) { $meas.urban_center_pm_levels } else { $null })
        foreach ($pmg in $bldPmgs[$URBAN_CENTER]) {
            $pm = $null
            if ($ucMeas) {
                $best = -1
                foreach ($cand in $pmgPms[$pmg]) {
                    $v = $ucMeas.$cand
                    if ($null -ne $v -and [double]$v -gt $best) { $best = [double]$v; $pm = $cand }
                }
                if ($pm) { $ucPmSrc = 'measured' }
            }
            if (-not $pm) { $pm = Select-LawPm $pmg $leadLaws }
            if ($pm) { $ucSel[$pmg] = $pm }
        }
        $buildings[$URBAN_CENTER] = $ucLevels
        $pmsByKey[$URBAN_CENTER] = $ucSel
    }

    # --- SECONDARY production methods, measured ---
    # The preset takes secondaries from history's `activate_production_methods`, and the game runs
    # more than history lists - Belgium's fruit and luxury clothes had no source in the scenario at
    # all. Most popular PM per PMG per building, by levels.
    # ⚠ DISTORTION BY CONSTRUCTION: a country whose farms split 51/49 between two secondaries is
    # rendered as if all of them ran the winner. The margin is reported below so a near-tie is
    # visible rather than silently flattened - that is where this misleads.
    $secApplied = 0; $secClose = New-Object System.Collections.Generic.List[string]
    if ($meas -and $meas.secondary_pm_levels) {
        foreach ($bp in $meas.secondary_pm_levels.PSObject.Properties) {
            $bkey = $bp.Name
            if (-not $buildings.Contains($bkey)) { continue }          # not in this scenario
            $lv = @{}; foreach ($q in $bp.Value.PSObject.Properties) { $lv[$q.Name] = [double]$q.Value }
            $vanillaKey = $bkey
            foreach ($vk in $baseIndustry.Keys) { if ($pmMap[$baseIndustry[$vk]].Values | Where-Object { $_.tier_key -eq $bkey }) { $vanillaKey = $vk; break } }
            foreach ($pmg in $bldPmgs[$vanillaKey]) {
                $cands = @($pmgPms[$pmg] | Where-Object { $lv.ContainsKey($_) })
                if ($cands.Count -eq 0) { continue }
                $best = $null; $bestV = -1; $second = 0
                foreach ($c in $cands) { if ($lv[$c] -gt $bestV) { $second = $bestV; $bestV = $lv[$c]; $best = $c } elseif ($lv[$c] -gt $second) { $second = $lv[$c] } }
                if (-not $best -or $bestV -le 0) { continue }
                if (-not $pmsByKey.Contains($bkey)) { $pmsByKey[$bkey] = [ordered]@{} }
                $pmsByKey[$bkey][$pmg] = $best
                $secApplied++
                if ($second -gt 0 -and ($bestV / ($bestV + $second)) -lt 0.65) {
                    $secClose.Add(("{0}/{1}: {2} {3:N0} vs {4:N0}" -f $bkey, $pmg, $best, $bestV, $second))
                }
            }
        }
    }

    # --- THROUGHPUT per building type, measured ---
    # Read off the building (Building.GetThroughputBonusCurrent), not summed from technology + law +
    # company sub-factors. Level-weighted mean per type. Applied in the UI as a multiplier on that
    # building's goods, shown in its own column, and never emitted to the game.
    $thru = [ordered]@{}
    if ($meas -and $meas.throughput) {
        foreach ($tp in $meas.throughput.PSObject.Properties) {
            if ($buildings.Contains($tp.Name) -and [double]$tp.Value -ne 0) { $thru[$tp.Name] = [math]::Round([double]$tp.Value, 4) }
        }
    }

    $year = if ($p.year) { [int]$p.year } elseif ($presetCfg.defaults.year) { [int]$presetCfg.defaults.year } else { $START_YEAR }
    # --- which pop-need goods pops may want here ---
    # Default is purely the preset's YEAR (a market imports what it can't make, so this is not the lead
    # country's tech). `unlock_add` / `unlock_drop` in config/presets.json then override per preset, for
    # anything the calendar can't know - e.g. "no clippers" for a landlocked market.
    $unlocked = New-Object System.Collections.Generic.List[string]
    foreach ($g in $needGoods) { if ($availableFrom[$g] -le $year) { $unlocked.Add($g) } }
    if ($p.unlock_add)  { foreach ($g in $p.unlock_add)  { if ($unlocked -notcontains $g) { $unlocked.Add($g) } } }
    if ($p.unlock_drop) { foreach ($g in $p.unlock_drop) { [void]$unlocked.Remove($g) } }


    # --- standard of living per class ---
    # Measured per stratum where available. The flat 35/16/9 could not be right for Britain and the
    # Qing at once, and peasants are the extreme case: 4.5 in Japan against 12.1 in France. Peasants
    # and slaves get their OWN level rather than borrowing the lower class's.
    $sol = if ($p.sol) { $p.sol } else { $defSol }
    $solOut = [ordered]@{ upper = [int]$sol.upper; middle = [int]$sol.middle; lower = [int]$sol.lower }
    $solOut['peasants'] = $solOut['lower']; $solOut['slaves'] = $solOut['lower']
    $solSrc = 'config default'
    if ($meas -and $meas.sol) {
        foreach ($s in @('upper','middle','lower','peasants','slaves')) {
            $v = $meas.sol.$s
            # A stratum the market does not have is emitted as absent, not as 0 - a hard zero would
            # silently mean "buys the wealth-0 package" instead of "there is nobody here".
            if ($null -ne $v -and $v -gt 0) { $solOut[$s] = [int][math]::Round([double]$v) }
        }
        $solSrc = "measured $($measured._meta.date)"
    }

    # --- BASE WAGE, measured (config/measured_1836.json -> each market's `wages` block) ---
    # The UI prices a building's wage bill as base x SUM(employees x wage_weight). `base` was a
    # guessed 0.04/wk that had never been measured, and it is a per-MARKET quantity, so the preset
    # is exactly where it belongs. Measured 1836: Austria 0.049/wk, Belgium 0.074/wk.
    #
    # ⚠ The LABOUR base, never the all-pops one. Capitalists (£59.66/yr) and aristocrats (£7.55)
    # draw dividends and rent through the same income field as a labourer's £3.79 wage, and folding
    # them in inflates Belgium's base from £3.85 to £4.55 a year with money no building ever pays.
    # Peasants are out for the opposite reason - subsistence is not a market wage.
    $baseWage = $null; $baseWageNote = $null
    if ($meas -and $meas.wages) {
        if ($null -ne $meas.wages.base_weekly_labour) {
            $baseWage = [double]$meas.wages.base_weekly_labour
            $sp = $meas.wages.labour_base_spread
            if ($sp) {
                $baseWageNote = "measured across $($sp.types) professions, which agree to within £$($sp.min)-$($sp.max)/yr (cv $($sp.cv))"
            }
        } elseif ($meas.wages.state_annual_wage) {
            # No per-pop rows for this market ⇒ no wage-weight-normalised base. Emit NOTHING rather
            # than substituting the per-state average: that is money per WORKER, a different
            # quantity, and using it would overstate the base by the market's mean wage weight
            # (0.52 in Austria, 0.74 in Belgium - so not a constant that could be corrected for).
            $baseWageNote = "not measured for this market - only the game's per-state average is available (£$($meas.wages.state_annual_wage.mean)/yr per worker, which is not a base wage)"
        }
    }

    # --- military UNITS, from history ---
    # NOT the measured barrack levels this used to carry. Barracks and logistics centres have no
    # goods on their production methods at all, so their level count buys nothing but urbanization -
    # which the per-state correction already handles. The goods live on the battalions, and the
    # battalions are in the history files, so nothing here needs measuring.
    $units = [ordered]@{}
    $milAdded = 0
    foreach ($k in ($unitsOf.Keys | Sort-Object)) {
        $parts = $k -split '\|'
        if (-not $memberSet.ContainsKey($parts[0])) { continue }
        $units[$parts[1]] = ($units[$parts[1]] + 0) + $unitsOf[$k]
        $milAdded += $unitsOf[$k]
    }

    # --- non-building orders: TRADE ---
    # Treaty `goods_transfer` articles plus the market's actual trade-route flows. Both live inside
    # the game's own order book already (sell = production + imports + transfers in), so carrying
    # them here makes the scenario's totals comparable to the game's raw orders. Buildings are never
    # represented here - a consumer that is a building belongs in the buildings column as a building.
    $nonbuy = [ordered]@{}; $nonsell = [ordered]@{}; $tnotes = New-Object System.Collections.Generic.List[string]
    foreach ($t in $transfers) {
        $inSrc = $memberSet.ContainsKey($t.src); $inDst = $memberSet.ContainsKey($t.dst)
        if ($inSrc -and $inDst) { continue }        # internal to the market: nets out
        if ($inSrc) { $nonbuy[$t.good]  = ($nonbuy[$t.good]  + 0) + $t.qty; $tnotes.Add("-$($t.qty) $($t.good) -> $($t.dst) ($($t.treaty))") }
        if ($inDst) { $nonsell[$t.good] = ($nonsell[$t.good] + 0) + $t.qty; $tnotes.Add("+$($t.qty) $($t.good) <- $($t.src) ($($t.treaty))") }
    }
    $tradeGoods = 0
    if ($meas) {
        # ⚠ Treaty transfers are NOT added on top: the measured imports/exports are the market's
        # whole external flow, transfers included (the engine reports a transfer inside sell orders).
        # Adding both would double-count every treaty good, so measurement wins where it exists.
        foreach ($tp in $meas.trade_out.PSObject.Properties) { $nonbuy[$tp.Name]  = [math]::Round([double]$tp.Value, 2); $tradeGoods++ }
        foreach ($tp in $meas.trade_in.PSObject.Properties)  { $nonsell[$tp.Name] = [math]::Round([double]$tp.Value, 2); $tradeGoods++ }
    }

    $out.Add([ordered]@{
        id = $p.id; label = $p.label; group = $p.group; country = $lead
        base_wage = $baseWage; base_wage_note = $baseWageNote
        market = @($members.ToArray() | Sort-Object)
        buildings = $buildings
        pms = $pmsByKey
        pops = [ordered]@{
            total = [int]$totalPop
            upper = [int][math]::Round($cls.upper); middle = [int][math]::Round($cls.middle); lower = [int][math]::Round($cls.lower)
            slaves = [int]$slavePop; peasants = [int][math]::Round($peasants)
        }
        sol = $solOut
        year = $year
        unlocked = $unlocked.ToArray()
        subsistence = [ordered]@{
            free_arable = [int][math]::Round(($subsArable.Values | Measure-Object -Sum).Sum)
            capacity_jobs = [int][math]::Round($subsCapacity)
            peasant_workforce = [int][math]::Round($peasantWork)
            staffing = [math]::Round($staffing, 3)
            levels = $subsLevels
        }
        nonbuy = $nonbuy; nonsell = $nonsell
        units = $units
        throughput = $thru
        # The game's own order book for this market, carried so the UI can FIT against it: observed
        # pop demand is `buy - our building demand - trade out`, which cannot be reconstructed from
        # the netted numbers alone. Absent when there is no measured reference.
        measured = $(if ($meas) { [ordered]@{ date = $measured._meta.date; buy = $meas.buy; sell = $meas.sell; production = $meas.production } } else { $null })
        notes = $tnotes.ToArray()
    })
    Write-Output ("  {0,-14} market {1,-3} tags | {2,5} building levels | pop {3,12:N0} (u {4:N0} / m {5:N0} / l {6:N0} / slv {7:N0} / peas {8:N0})" -f `
        $p.id, $members.Count, ($levelsByKey.Values | Measure-Object -Sum).Sum, $totalPop, $cls.upper, $cls.middle, $cls.lower, $slavePop, $peasants)
    Write-Output ("                 subsistence: free arable {0:N0} -> {1:N0} peasant jobs, workforce {2:N0} => staffing {3:P0}, emitted {4:N0} staffed levels" -f `
        (($subsArable.Values | Measure-Object -Sum).Sum), $subsCapacity, $peasantWork, $staffing, $subsLevels)
    Write-Output ("                 urban centres: {0:N0} urbanization over {1:N0} states => {2:N0} levels{3}" -f `
        (($urbByState.Values | Measure-Object -Sum).Sum), $urbByState.Count, $ucLevels,
        $(if ($meas) { " (measured {0})" -f $meas.urban_center_levels } else { "" }))
    if ($secClose.Count -gt 0) { Write-Output ("                 SEC near-tie (most-popular distorts): {0}" -f (($secClose.ToArray() | Select-Object -First 3) -join "; ")) }
    Write-Output ("                 SoL [{0}] u{1}/m{2}/l{3}/peas{4}/slv{5} | military {6:N0} battalions | trade on {7} good(s)" -f `
        $solSrc, $solOut.upper, $solOut.middle, $solOut.lower, $solOut.peasants, $solOut.slaves, $milAdded, $tradeGoods)
}

# ---------------------------------------------------------------- write ui/presets.js
# de-dup the drift list without a pipeline (locale-sensitive Sort-Object chokes on this list)
$unmapUniq = New-Object System.Collections.Generic.List[string]
foreach ($u in $script:unmapped) {
    if ($unmapUniq.Count -ge 20) { break }
    if (-not $unmapUniq.Contains($u)) { $unmapUniq.Add($u) }
}
$meta = [ordered]@{
    generated = (Get-Date).ToString('s')
    game = $Game
    start_year = $START_YEAR
    unmapped_buildings = @($unmapUniq.ToArray())
}
# Class multipliers: how much of its wealth level's buy package a class actually brings to the market.
#   peasants - the game's OWN number (`consumption_mult` in common/pop_types/peasants.txt, 0.05: most of a
#              peasant's needs are met inside the subsistence building and never reach the market);
#   slaves   - a modelling choice (the game has no consumption_mult for slaves), overridable in presets.json;
#   the rest - full participation.
$classMult = [ordered]@{ upper = 1.0; middle = 1.0; lower = 1.0
    slaves = 0.5
    peasants = $(if ($consumptionMult.ContainsKey('peasants')) { $consumptionMult['peasants'] } else { 0.05 }) }
if ($presetCfg.defaults.class_mult) {
    foreach ($k in $presetCfg.defaults.class_mult.PSObject.Properties.Name) { $classMult[$k] = [double]$presetCfg.defaults.class_mult.$k }
}
$popModel = [ordered]@{
    pop_size_package = 10000        # defines NPops POP_SIZE_PACKAGE - a buy package is per this many people
    # A pop's needs are per WORKING ADULT, with dependents needing DEPENDENT_CONSUMPTION_RATIO of that.
    # Per head that is working_adult_ratio + (1 - working_adult_ratio) x dependent_ratio = 0.625.
    working_adult_ratio = $WORK_RATIO_BASE
    dependent_consumption_ratio = $DEPENDENT_CONSUMPTION
    class_mult = $classMult
    # The FITTED within-need split (config/pop_distribution.json), replacing the vanilla `weight`
    # field. `weight` is not an allocation rule - the game allocates a need's money by SUPPLY SHARE -
    # and using it understated British grain demand by 7 900 units. Absent => the UI falls back to
    # `weight` per need, so a need the fit never saw still behaves.
    distribution = $(
        $dp = Join-Path $Repo 'config\pop_distribution.json'
        if (Test-Path $dp) { (Get-Content -LiteralPath $dp -Raw -Encoding UTF8 | ConvertFrom-Json).distribution }
        else { Warn "config/pop_distribution.json missing - pop demand falls back to the vanilla weight split"; $null })
    # Peacetime goods per battalion, from each combat unit type's upkeep_modifier. The UI renders
    # two rows per type - mobilised and not - because mobilisation changes consumption by orders of
    # magnitude; they are clones for now, so the mobilised row costs the same until the mobilisation
    # options are modelled.
    unit_goods = $unitGoods
    unit_group = $unitGroup
    need_goods = $needGoods.ToArray()   # every good pop needs can be met with (one UI unlock toggle each)
    available_from = $availableFrom     # good -> earliest year it can exist at all (0 = always)
    buy_packages = $buyPackages
    needs = $popNeeds
}
# NOTE: `@($list)` on a System.Collections.Generic.List[object] throws "Argument types do not match"
# in Windows PowerShell 5.1 - always go through .ToArray() when handing a generic list to ConvertTo-Json.
$payload = [ordered]@{ _meta = $meta; pop_model = $popModel; presets = $out.ToArray() }
$json = $payload | ConvertTo-Json -Depth 12 -Compress
$body = "// AUTO-GENERATED by tools/extract_presets.ps1 - scenario presets derived from the vanilla 1836 start.`n" +
        "// Read-only; regenerated from the live game on every build. Which presets exist: config/presets.json.`n" +
        "window.PMPRESETS = $json;`n"
$outPath = Join-Path $Repo 'ui\presets.js'
[System.IO.File]::WriteAllText($outPath, $body, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ("Extracted {0} preset(s), {1} buy packages, {2} pop needs, {3} goods transfers -> ui\presets.js ({4:N0} KB)" -f `
    $out.Count, $buyPackages.Count, $popNeeds.Count, $transfers.Count, ((Get-Item $outPath).Length / 1KB))
if ($script:unmapped.Count -gt 0) {
    Write-Output ("  DRIFT: {0} history factories had no recognized main PM (kept at Tier 1) - refresh the config's vanilla_pm fields." -f $script:unmapped.Count)
}
