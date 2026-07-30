<#
  telemetry_lib.ps1 - the ONE place that generates testbed telemetry script.

  Dot-sourced by build.ps1. Every arm of an experiment - the vanilla control and any modded
  build - gets its instrumentation from here, which is what makes a control valid: if the arms
  could differ in what they log, the comparison would not be like-for-like.

  Everything emitted below uses data functions VERIFIED in-game against 1.13.9. Before adding a
  metric, read TESTBED_METRICS.md: one bad data function voids the WHOLE debug_log line it sits
  in (it is not printed at all), and several plausible-looking paths silently return an empty
  value rather than erroring.

  The telemetry SPEC is a small JSON object, so a future UI can author it:
    {
      "dump_dates": ["1840.1.1", "1860.1.1"],     # each must be the 1st of a month
      "tags":       ["GBR", "FRA"],               # markets to dump
      "metrics":    ["market_goods"]              # which metric blocks to emit
    }
#>

# NOTE: deliberately no Set-StrictMode here. This file is DOT-SOURCED into build.ps1, and
# Set-StrictMode applies to the CALLER's scope - switching it on broke the builder's own
# `-not $_.disabled` property tests. A library must not change its caller's strictness.

function Get-TelemetryDefaults {
    return [ordered]@{
        dump_dates = @("1840.1.1")
        tags       = @("GBR", "FRA")
        metrics    = @("market_goods")
    }
}

function Read-TelemetrySpec {
    param([string]$Path)
    $spec = Get-TelemetryDefaults
    if ($Path) {
        if (-not (Test-Path $Path)) { throw "telemetry spec not found: $Path" }
        $j = Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($k in @("dump_dates", "tags", "metrics")) {
            if ($j.PSObject.Properties.Name -contains $k -and $j.$k) { $spec[$k] = @($j.$k) }
        }
    }
    foreach ($d in $spec.dump_dates) {
        if ($d -notmatch '^\d{3,4}\.\d{1,2}\.1$') {
            throw "telemetry dump date '$d' must be the 1st of a month - on_monthly_pulse only fires then"
        }
    }
    return $spec
}

function New-TelemetryScript {
    <#
      Returns the text of common/on_actions/zzz_v3tb_telemetry.txt.
      $Token stamps every line so a run can reject lines belonging to another run - consecutive
      runs share one logs\ folder and the game rotates debug.log at launch, which otherwise lets
      an earlier run's output be read as this one's.
    #>
    param($Spec, [string]$Token, [string]$BuildStamp)

    $dates   = @($Spec.dump_dates)
    $tags    = @($Spec.tags)
    $metrics = @($Spec.metrics)

    $dumpNames = @()
    $dumpBody  = ""
    $n = 0
    foreach ($date in $dates) {
        $n++
        $name = "v3tb_dump_$n"
        $dumpNames += $name

        # one-month trigger window: on_monthly_pulse fires on the 1st, so this is hit exactly once
        $p = $date.Split('.')
        $y = [int]$p[0]; $m = [int]$p[1]
        $nm = $m + 1; $ny = $y
        if ($nm -gt 12) { $nm = 1; $ny = $y + 1 }
        $next = "{0}.{1}.1" -f $ny, $nm

        $blocks = ""
        if ($metrics -contains "market_goods") {
            foreach ($tag in $tags) {
                $blocks += @"

			# ---- $tag : per-good market state ----
			if = {
				limit = { exists = c:$tag }
				c:$tag = {
					if = {
						limit = { exists = market_capital.market }
						market_capital.market = {
							debug_log = "V3TB|$Token|MARKET|$date|$tag|[THIS.GetMarket.GetNameNoFormatting]"
							every_market_goods = {
								debug_log = "V3TB|$Token|G|$date|$tag|[THIS.GetMarketGoods.GetGoods.GetKey]|[THIS.GetMarketGoods.GetGoods.GetMarketBuyOrders|2]|[THIS.GetMarketGoods.GetGoods.GetMarketSellOrders|2]|[THIS.GetMarketGoods.GetGoods.GetMarketPrice|2]|[THIS.GetMarketGoods.GetGoods.GetMarketImports|2]|[THIS.GetMarketGoods.GetGoods.GetMarketExports|2]|[THIS.GetMarketGoods.GetGoods.GetMarketProduction|2]"
							}
						}
					}
					else = { debug_log = "V3TB|$Token|MARKET_NOT_FOUND|$date|$tag|country exists but has no market" }
				}
			}
			else = { debug_log = "V3TB|$Token|MARKET_NOT_FOUND|$date|$tag|no such country" }
"@
            }
        }

        $dumpBody += @"

$name = {
	trigger = {
		game_date >= "$date"
		NOT = { game_date >= "$next" }
	}
	effect = {
		debug_log = "V3TB|$Token|BEGIN|$date|[TimeKeeper.GetCurrentDate.GetString]"
$blocks
		debug_log = "V3TB|$Token|END|$date|[TimeKeeper.GetCurrentDate.GetString]"
	}
}
"@
    }

    # one-off events. on_country_default is ENTERING DEFAULT, not bankruptcy - see TESTBED_METRICS.
    $events = ""
    if ($metrics -contains "events") {
        $events = @"

on_country_default = { on_actions = { v3tb_ev_default } }
on_diplomatic_play_started = { on_actions = { v3tb_ev_dipplay } }
on_peace_agreement_signed_war_leader = { on_actions = { v3tb_ev_peace } }
on_capitulation = { on_actions = { v3tb_ev_capit } }

v3tb_ev_default = {
	effect = { debug_log = "V3TB|$Token|EV|DEFAULT|[SCOPE.GetRootScope.GetCountry.GetNameNoFormatting]|[TimeKeeper.GetCurrentDate.GetString]|gdp=[SCOPE.GetRootScope.GetCountry.GetGDP|2]" }
}
v3tb_ev_dipplay = {
	effect = { debug_log = "V3TB|$Token|EV|DIPPLAY|[SCOPE.sCountry('initiator').GetNameNoFormatting]|[SCOPE.sCountry('target').GetNameNoFormatting]|[TimeKeeper.GetCurrentDate.GetString]" }
}
v3tb_ev_peace = {
	effect = { debug_log = "V3TB|$Token|EV|PEACE|[SCOPE.GetRootScope.GetCountry.GetNameNoFormatting]|[TimeKeeper.GetCurrentDate.GetString]" }
}
v3tb_ev_capit = {
	effect = { debug_log = "V3TB|$Token|EV|CAPIT|[SCOPE.GetRootScope.GetCountry.GetNameNoFormatting]|[TimeKeeper.GetCurrentDate.GetString]" }
}
"@
    }

    return @"
# AUTO-GENERATED by tools/telemetry_lib.ps1 via build.ps1 - do not edit by hand.
# build: $BuildStamp   token: $Token
# dump dates: $($dates -join ', ')   tags: $($tags -join ', ')   metrics: $($metrics -join ', ')

on_game_started_after_lobby = {
	on_actions = { v3tb_boot }
}

on_monthly_pulse = {
	on_actions = { $($dumpNames -join ' ') }
}

v3tb_boot = {
	effect = {
		debug_log = "V3TB|$Token|BOOT|[TimeKeeper.GetCurrentDate.GetString]"
	}
}
$dumpBody$events
"@
}
