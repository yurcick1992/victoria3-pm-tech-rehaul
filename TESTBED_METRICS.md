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
| The **enclosing** scope of a nested iterator | **`PREV`** — bare, e.g. `PREV.GetMarket`. `SCOPE.GetPrevScope` / `SCOPE.Prev` do not work | ✅ verified |
| The on_action's root country | `SCOPE.GetRootScope.GetCountry` — empty in on_actions with no country root (e.g. `on_game_started_after_lobby`) | ⚠ context-dependent |

**Consequence:** any metric needing *two* runtime objects (market × market, state × owner country) gets the
second one from **`PREV`** when the objects are nested iterations — otherwise from
`GetPlayedOrObservedCountry` or a `Get…('key')` literal.

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
| **Entering DEFAULT** (not bankruptcy — see below) | `on_country_default` | `GetRootScope.GetCountry` = the defaulting country, plus its GDP and gold reserves at that moment | 57 |
| Leaving default (recovered **or** went bankrupt) | `on_country_no_longer_default` | root country | 356 ⚠ |
| **Diplomatic play started** | `on_diplomatic_play_started` | `SCOPE.sCountry('initiator')` and `('target')` — root is EMPTY | 41 |
| **Peace signed** | `on_peace_agreement_signed_war_leader` | root country; fires once per war leader, so twice per peace | 68 |
| War ended | `on_war_end` | `SCOPE.sCountry('actor')` and `('target')` | 35 |
| Capitulation | `on_capitulation` | root = the capitulating country | 37 |

Samples: `DEFAULT|root=Carlist Spain|d=December 27, 1838|gdp=397319.96|gold=0.00`,
`DIPPLAY|init=Texas|tgt=Mexico`, `CAPIT|root=Ladakh|d=March 3, 1836`.

⚠ **`on_country_no_longer_default` fires once for EVERY country at game init** (~300 lines before the
first tick) — filter by date before treating it as a recovery signal.

### DEFAULT is not BANKRUPTCY — they are two different things

The game distinguishes them, and so must we:

- **Default** is a *state*: loans exceed credit, construction pauses, building throughput is penalised and
  the penalty grows over time. The game's own `concept_default_desc` says the penalties end "as soon as the
  country's weekly balance becomes positive again, **or if bankruptcy is declared**".
- **Bankruptcy** is an *action* taken while in default: it wipes the debt, angers debt-holding pops, drops
  institutions to 1 and applies a decaying 10-year debuff.

`on_country_default` fires on **entering the default state**. There is **no bankruptcy on_action** — the
complete set is `on_country_default`, `on_country_no_longer_default`, `on_debt`, `on_scaled_debt`,
`on_entity_default`, `on_should_override_default`. And because leaving default happens on *either* recovery
or bankruptcy, `on_country_no_longer_default` cannot tell you which occurred.

**To detect bankruptcy itself**, poll the static modifier it applies:
`common/static_modifiers/00_code_static_modifiers.txt` → **`declared_bankruptcy`** (loc: "Declared
Bankruptcy" / "Effects of the country declaring bankruptcy"). On a monthly pulse:
```
every_country = {
    limit = { has_modifier = declared_bankruptcy  NOT = { has_variable = v3tb_bk_seen } }
    set_variable = v3tb_bk_seen
    debug_log = "…"
}
```
Related but not hookable: the diplomatic catalyst `catalyst_declared_bankruptcy` (category `cc_bankruptcy`)
is fired by code when it happens, but catalysts have no on_action. `last_bankruptcy_date` also exists
internally.

⚠ **UNMEASURED:** how long a country sits in default before declaring bankruptcy — i.e. whether the AI
presses the button immediately (in which case default events ≈ bankruptcy events and either signal will do)
or waits months/years (in which case they must be logged separately). The probe above is written but the
run to measure it has not been done. Until then, **do not read the 57 `on_country_default` firings as 57
bankruptcies** — they are 57 entries into default.
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

The **source** side is not limited to trade partners: `every_market` enumerates all ~305 markets and a
non-partner simply returns `0.00`, so the breakdown is complete.

### ✅ `PREV` works, and is observer-independent — there is no destination limit

**`PREV` refers to the enclosing scope inside a loc string** (verified: in `every_market` nested under the
British market, `PREV.GetMarket` = British Market while `THIS.GetMarket` = the iterated market). That
removes the two-runtime-object constraint entirely for nested iterations — **no observed country, no saved
scopes, no `-start_tag` needed**:

```
c:GBR = { market_capital.market = {          # or: every_market = {   for EVERY destination
    every_market = {                          # THIS = source, PREV = destination
        debug_log = "…dest=[PREV.GetMarket.GetNameNoFormatting]|src=[THIS.GetMarket.GetNameNoFormatting]|
                     amt=[PREV.GetMarket.GetImportedAmountFromMarket(THIS.GetMarket.Self, GetGoods('silk').Self)|2]"
    } } }
```
VERIFIED output, and it reconciles **exactly** against the independent market total: the British market's
`GetMarketImports` for silk = `130.00`, and the breakdown gives Qing `124.57` + Sicilian `5.43` = `130.00`.

`SCOPE.GetPrevScope` and `SCOPE.Prev` do **not** work — it is the bare `PREV`.

**Observer-independence VERIFIED.** Tested in spring 1836 with Great Britain observed, on four
destination × good pairs where *neither* side is the observed country, each checked against that market's
own `GetMarketImports`:

| Destination ← good | independent total | `PREV` breakdown sum | |
|---|---|---|---|
| Qing ← meat | 104.00 | 103.97 | ✓ |
| Russia ← tea | 65.00 | 64.98 | ✓ |
| Austria ← sugar | 216.00 | 215.96 | ✓ |
| Great Britain ← silk *(observed control)* | 130.00 | 129.99 | ✓ |
| Russia ← tobacco | 105.00 | 109.96 | ⚠ +4.96 |

The residual ~0.04 is rounding: each of ~305 source rows is printed to 2 dp. Origins are plausible
(Austrian sugar: Spain 119.81, Brazil 36.72, Ottomans 25.75, Venezuela 12.51).

⚠ **Open question — is `GetMarketImports` NET of exports?** Every total comes back a whole number
(104 / 105 / 65 / 216 / 130) while the breakdowns are fractional, and Russian tobacco's breakdown exceeds
its total by 4.96. The likeliest explanation is that `GetMarketImports` nets off that market's own exports
of the same good while the per-source sum is gross. Not confirmed — the cheap test is to log
`GetMarketExports` for the same pair and see whether `gross − exports = total`. Until then, prefer the
**per-source sum** when you need gross import volume, and treat `GetMarketImports` as possibly net.

Earlier attempts to settle observer-independence failed for two avoidable reasons worth remembering: the
destinations first chosen (France, USA, Russia-grain, Austria) import *nothing* that early — Russia
**exports** grain — so their zeros were true negatives; and two bulk dumps were silently truncated because
the probe used an ad-hoc log mirror with **no rotation recovery**. Probe through `run_observer.ps1`, or
replicate its recovery (on shrink, read the remainder of `debug.1.log` from the last offset *before*
restarting on the new file) — the final run handled 2 rotations and captured all 1 633 lines.

⚠ **Volume is now the only limit.** A full market×market matrix is ~305 × 305 = ~93 000 lines *per good*.
Pin the destination side (one country, or a handful) rather than iterating both.

### ❌ `play_as` cannot retarget an observer run

`play_as` is a real script effect, but it moves **the player**, and a `-handsoff` observer game has none.
With the correct form (`<country> = { play_as = c:FRA }` — it needs a country scope *and* a country target)
the log says plainly:
`play_as effect [ Failed to switch player to new country in play_as effect - no player for scoped country ]`.
Verified over 12 monthly switch attempts across 1836: the observed country stayed Great Britain throughout
and **observer mode never dropped**. Wrong forms fail earlier and differently — `play_as = c:FRA` at top
level gives "Wrong scope for effect: none, expected country", and `play_as = yes` gives "target: scope type
boolean, expected country". Use `PREV` instead; it is better in every way.
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
