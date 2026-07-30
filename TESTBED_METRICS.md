# What the testbed can log (and what it can't)

Every entry below was **verified in-game against 1.13.9** by probing it and reading the log — nothing
here is inferred from the GUI files alone. Syntax that merely *looks* right frequently returns a silent
empty value, so treat anything not listed as VERIFIED as unknown.

Companion to `MODDING_NOTES.md` → *Automated headless runs* (which covers the harness itself). Re-verify
after a game patch: these are engine data functions, not moddable data.

---

## The three mechanisms

**1. `debug_log` with data functions** — the main channel. Works without debug mode.
```
debug_log = "TAG|[GetMetaPlayer.GetPlayedOrObservedCountry.GetGDP|2]"
```
⚠ **One bad data function voids the WHOLE line** — it is not printed at all, you only get
`pdx_data_localize.cpp: Data error in loc string '<the entire string>'`. So put one metric per line when
probing, and never mix an unverified function into a line carrying data you need.

⚠ **A silent empty value is the dangerous failure.** `[…GetMarket.GetNameNoFormatting]` on an unresolved
country prints `" Market"`, not an error. Always probe a new path by printing something whose value you
already know (a name), not just the number you're after.

**2. Iterating script values** — the way to get aggregates and per-type counts into a single line.
Define in `common/script_values/`, read with **`.MakeScope.ScriptValue('name')`**:
```
v3tb_tooling_levels = { value = 0
    every_scope_state = { every_scope_building = {
        limit = { is_building_type = building_tooling_workshop }
        add = level } } }
```
```
debug_log = "…[GetMetaPlayer.GetPlayedOrObservedCountry.MakeScope.ScriptValue('v3tb_tooling_levels')]"
```
VERIFIED: GBR 1836 → 2 tooling workshops, 21 levels. `[SCOPE.ScriptValue('x')]` (without `MakeScope`)
silently returns 0 — it never enters the country scope.

**3. `on_action` hooks** — for one-off events. Merge with vanilla's own entries, so use the documented
append pattern (`some_vanilla_on_action = { on_actions = { ours } }`).

---

## Reaching the right object — the hard part

| Need | How | Status |
|---|---|---|
| The current scope | `THIS.Get<Type>…` e.g. `THIS.GetMarketGoods`, `THIS.GetMarket`, `THIS.GetState` | ✅ verified |
| A country by tag | **no such thing** — `GetCountry('GBR')` does not exist; countries are runtime objects | ❌ |
| One chosen country, anywhere | `GetMetaPlayer.GetPlayedOrObservedCountry` — and **`-start_tag=FRA` sets it** (verified: observed = France) | ✅ verified |
| A database definition by key | `GetGoods('silk')`, `GetBuildingType('building_tooling_workshop')`; also `GetLawType`, `GetPopType`, `GetCulture`, `GetStateRegion`, … | ✅ verified |
| A scope **the game passed** to the on_action | `SCOPE.sCountry('initiator')` | ✅ verified |
| A scope **you saved yourself** with `save_scope_as` | **not reachable** — resolves as a function but finds nothing, yielding an empty object | ❌ |
| The on_action's root country | `SCOPE.GetRootScope.GetCountry` — empty in on_actions with no country root (e.g. `on_game_started_after_lobby`) | ⚠ context-dependent |

**Consequence:** any metric needing *two* runtime objects (market × market, state × owner country) must get
one of them from `GetPlayedOrObservedCountry` or a `Get…('key')` literal. This is the single biggest
constraint on what can be logged.

⚠ **Argument forms are not uniform.** For `GetImportedAmountFromMarket(market, goods)` the market argument
**requires `.Self`** and so does the goods argument — the form copied from `custom_tooltip.gui`
(market without `.Self`) errors. Copy a GUI call as a starting point, then probe both forms.

⚠ Building **aliases are not keys**: `GetBuildingType('building_tooling_workshops')` (the alias) silently
returns nothing; the key is `building_tooling_workshop`. Same for `is_building_type`.

---

## 1. One-off events — all VERIFIED firing with usable identity

Probed over 1836→1850, one observer run:

| Event | on_action | Identity available | Count to 1850 |
|---|---|---|---|
| **Bankruptcy** | `on_country_default` | `GetRootScope.GetCountry` = the defaulting country, plus its GDP and gold reserves at that moment | 57 |
| Recovery from bankruptcy | `on_country_no_longer_default` | root country | 356 ⚠ |
| **Diplomatic play started** | `on_diplomatic_play_started` | `SCOPE.sCountry('initiator')` and `('target')` — root is EMPTY | 41 |
| **Peace signed** | `on_peace_agreement_signed_war_leader` | root country; fires once per war leader, so twice per peace | 68 |
| War ended | `on_war_end` | `SCOPE.sCountry('actor')` and `('target')` | 35 |
| Capitulation | `on_capitulation` | root = the capitulating country | 37 |

Samples: `DEFAULT|root=Carlist Spain|d=December 27, 1838|gdp=397319.96|gold=0.00`,
`DIPPLAY|init=Texas|tgt=Mexico`, `CAPIT|root=Ladakh|d=March 3, 1836`.

⚠ **`on_country_no_longer_default` fires once for EVERY country at game init** (~300 lines before the
first tick) — filter by date before treating it as a recovery signal.
⚠ `on_diplomatic_play_started` has **no country root**; use the `initiator`/`target` scopes.
There are also `on_diplomatic_action*`, `on_diplomats_expelled`, `on_capitulation`-family hooks (~40 more
in `00_code_on_actions.txt`) that were not probed but should behave the same way.

---

## 2. State-of-process metrics

### 2.1 Building counts — VERIFIED
Per country, and per building type, via an iterating script value (mechanism 2):

| Metric | Value (GBR / world, 1836) |
|---|---|
| buildings (count) | 252 / **5 976** |
| building levels | 3 219 / **89 964** |
| tooling workshops | 2 buildings, 21 levels |

World totals just wrap the same iterator in `every_country = { … }`. **This is the metric to use for the
tiering question** — it measures directly whether the AI built the newer tier, instead of inferring it
from downstream market prices.

### 2.2 GDP — VERIFIED
- Country: `GetGDP` → `24 824 719.31`. Also as a script value keyword (`value = gdp`).
- **World**: script value `{ value = 0  every_country = { add = gdp } }` → `366 538 141.9`.
- State: `GetGDPContribution` (`3 609 695`) and `GetGDPContributionPercentage` (`14.54%`).
- `GetGDPRanking` returns a **base64 tooltip blob**, not a number — it does contain the world top-10
  ("1. 85.4M Great Qing, 2. 34.6M East India Company, 3. 24.8M Great Britain…") but parsing it is ugly;
  compute rankings from per-country GDP instead.

### 2.3 Foreign-owned GDP — VERIFIED, exactly as needed
On Country, no per-owner iteration required:
- `GetForeignOwnedGDP` — absolute
- `GetForeignOwnedGDPFraction` (use `|%2` → `0.00%`) — **the share metric**
- `GetGDPOwnedInForeignCountries` → GBR 1836 = `8 561 050.99` (its holdings abroad)
- `GetGDPWithOwnershipsInForeignCountries` → `33 361 051` = own GDP + holdings abroad (consistent ✓)
- `GetTotalForeignConstructions`

Per-state, per-owner also exists: `State.GetGdpRatioOwnedBy(<country>)` — but it needs a second runtime
object, so in practice only usable with the observed country as the owner.

### 2.4 Market composition per good — VERIFIED
In `every_market_goods` scope, on `THIS.GetMarketGoods.GetGoods`:
`GetMarketBuyOrders`, `GetMarketSellOrders`, `GetMarketPrice`, **`GetMarketImports`**,
**`GetMarketExports`**, **`GetMarketProduction`**, `GetKey`.

So import share of a good in a market = `GetMarketImports / GetMarketBuyOrders`, with `GetMarketProduction`
giving the domestic side. Example (British market, 1836): `tools` production 1888.8, buy 1788.9,
imports 0, exports 125 — i.e. a net exporter, 0% import share.

### 2.5 Where a market's imports come from — VERIFIED, with one limit
```
every_market = {                                    # THIS = the SOURCE market
  debug_log = "…[GetMetaPlayer.GetPlayedOrObservedCountry.GetMarket.GetImportedAmountFromMarket(
                  THIS.GetMarket.Self, GetGoods('silk').Self)|2]"
}
```
British market silk imports, 1836: **Qing Market 105.04, Sicilian Market 4.95** (≈ the 120 total
`GetMarketImports` reported for that good). The reverse direction is
`THIS.GetMarket.GetExportedAmountToMarket(<observed>.GetMarket.Self, GetGoods('x').Self)`, so one run
yields the observed country's bilateral trade **both ways**.

⚠ **The destination is limited to the observed country** (`-start_tag=<TAG>`). A full market×market matrix
is not expressible, because both sides would need to be runtime objects in one expression. For several
destinations: one run per country, or accept the observed country as the focus.
⚠ **Volume:** `every_market` is ~305 markets. Times all ~40 goods that is ~12 000 lines per dump — fine
for one dump, but restrict the goods list for multi-date runs.

---

## Not resolved

| Want | Status |
|---|---|
| **Construction throughput / capacity per country** | Not found on `Country`. `GetConstructionsInCountry` belongs to `ConstructionPanel`, not Country; `GetConstruction`, `GetConstructionCapacity`, `GetBaseConstructionSpeed`, `GetConstructionEfficiency` all fail on Country. Script-value keyword `construction` is not a valid event target link either. Routes left: count buildings under construction by iteration, or find the panel-free function. |
| Money / treasury as a script value | `money_amount` is not a valid keyword. But **`GetGoldReserves`** (`1 234 152.66`) and **`GetWeeklyBalance`** (`-31 421.45`) work as data functions on Country. |
| Total population as a data function | No `GetPopulation`/`GetPopulationCount`. Use the script-value keyword **`total_population`** (verified: 25 951 649), or `GetInactivePopulation` + `GetPoliticallyInvolvedPopulation`. |
| `GetBuildingTypeLevels` | Exists in the exe but not on `Country` — use the script-value count instead. |

## Verified script-value keywords (country scope)

`gdp` ✅ · `literacy_rate` ✅ (0.53169) · `total_population` ✅ · `money_amount` ❌ · `construction` ❌

## Other verified Country data functions

`GetIncorporatedLiteracyRate` (0.53) · `GetAverageSoLByPopulation` (10.23) · `GetGoldReserves` ·
`GetWeeklyBalance` · `GetInvestmentPool` · `GetTotalForeignConstructions` · `GetMarket` ·
`GetInactivePopulation` · `GetPoliticallyInvolvedPopulation`
