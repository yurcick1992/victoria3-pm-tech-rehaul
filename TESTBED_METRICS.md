# What the testbed can log (and what it can't)

The reference for the testbed's two instruments: what each can measure, how (the exact data function or save field), whether it
is verified, and where it breaks. Read it before adding a metric or trusting one.

- **Telemetry** (§1–§6) is the PROCESS instrument. `tools/telemetry_lib.ps1` emits `debug_log` lines from the mod's own script
  (`common/on_actions/zzz_v3tb_telemetry.txt`, plus `zzz_v3tb_values.txt` for script values); the observer mirrors the log and
  harvests `markets.tsv` and `events.tsv`. It sees events, the market order book and anything between saves. Every line carries
  the run's token. The data functions were verified in-game on 1.13.9 and are in use unchanged through 1.13.11; they are engine
  functions, not moddable data, so re-verify after a game patch. **Syntax that merely looks right often returns a silent empty
  value: treat anything not marked verified here as unknown.**
- **The save summaries** (§7–§7½) are the STATE instrument. Every autosave is melted with `rakaly` and reduced by
  `tools/testbed/save_state_summary.mjs` to one JSON summary. A summary is complete, internally consistent and immune to the log
  ring, but a snapshot: it shows no event and nothing between two saves.

Elsewhere: how a run works end to end is CLAUDE.md §5.5; the harness (launch, the log ring and its mirror, the per-run token) is
MODDING_NOTES → *Automated headless runs*; how a batch is planned and run is TESTBED_OPERATIONS.md; defects where nothing fails
are TESTBED_LANDMINES.md; what the instruments have told us is FINDINGS.md.

---

## Which instrument answers what

| question | instrument | § |
|---|---|---|
| a LEVEL: GDP, population by profession, buildings by type (levels, staffing, profit, active methods, wage bill), budgets, technologies held, trade capacity per good, laws, tariffs, ownership, IG clout, queues | save summary | §7½ |
| an EVENT: default, war, peace, revolt, bankruptcy; a technology's acquisition DATE | telemetry `events`, `tech_log` | §1, §3.8, §6 |
| the market ORDER BOOK: buy and sell orders, market prices, imports and exports per market — in no save at all | telemetry `market_goods*` | §2.4, §2.4½ |
| who supplied whom | telemetry `origins` | §2.5 |
| pop versus building demand for a good | `consumption_breakdown` (validation runs) or the save reconstruction | §3.3, §9 |
| state wages and per-pop income | telemetry `wages`; the wage level is save-side | §5, §9 |
| research-entry stages, dam surveys | content log lines (not telemetry) | §8 |
| play time | the observer's tick lines and `meta.json`, with the summaries for world size | §7⅜ |

## What a standard century batch records

Read off the current schedules (e.g. `tools/testbed/schedules/alt_vanilla_canon_rest20.json`) and `run_schedule.ps1`:
- telemetry metrics `country_state`, `population`, `treasury`, `events`, `tech_log`, `market_goods_scoped`, on the eleven tags of
  `tools/testbed/ledger/lib_markets.mjs` (`TELEMETRY_TAGS`: GBR FRA USA PRU NGF GER NET BEL UNL RUS JAP), at twelve dump dates:
  1836.2.1, 1840.1.1, then 1 January of every decade to 1930, and 1935.1.1;
- the red-flag feed, which the scheduler adds to every run: `market_goods_wide` on 1 July of every year (§2.4½);
- the downsize feed, which the scheduler adds to every telemetry run: `downsizing`, the monthly poll of auto-downsized levels (§2.4¾);
- yearly autosaves, each melted into a summary (v19 today); each run's newest save is kept (§7½);
- the observer's tick lines in `run.log`, `meta.json`, and the machine-load monitor (§7⅜).

## The metric catalogue

Every metric `telemetry_lib.ps1` knows (it tests `$metrics -contains '<name>'`; a name that matches nothing measures nothing, L36).
"Phase" is the month offset a dump block fires at (see *Phased dumps*). Each phase is fenced by `BEGIN|<date>|p<n>` and
`END|<date>|p<n>` lines.

| metric | lines | when | scope | measures | status | § |
|---|---|---|---|---|---|---|
| `market_goods` | `MARKET`, `G` | dump, p0 | every market (~304) | per good: buy, sell, price, imports, exports, production | verified; ~5,300 lines a dump | §2.4 |
| `market_goods_scoped` | `MARKET`, `G` | dump, p0 | markets owned by the spec's tags | as above | verified | §2.4 |
| `market_goods_wide` | `GW` | its own `wide_dates` (the feed: 1 July yearly) | markets owned by `wide_tags` | buy, sell, price, production | verified; on in every run | §2.4½ |
| `country_state` | `GDP`, `BLD`, `LVL`, `STATE`, `WORLD` | dump, p1 | every country; `WORLD` once | GDP, foreign-owned GDP, GDP abroad, market; building counts and levels by category; war / civil-war / revolt / default flags; world GDP | verified | §2.1–§2.3, §3.1, §3.4 |
| `population` | `POP` | p1, inside the `country_state` pass (needs it) | every country | workforce, peasants, slaves, dependents, mean state unemployment rate, total population | verified | §3.7 |
| `treasury` | `TCASH`, `TREV`, `TEXP`, `TRADE` | dump, p2 | every country | the in-game budget panel; trade capacity and trade centres | verified | §3.5, §3.6 |
| `origins` | `ORIG` | dump, p3 | the tags' markets as importers × the tags' markets as exporters × `origin_goods` | bilateral import volume | verified | §2.5 |
| `events` | `EV` | on_actions + a monthly bankruptcy poll | world | DEFAULT, DIPPLAY, WARSTART, REVOLT, SECESSION, CIVILWARWON, PEACE, CAPIT, BANKRUPTCY | verified (REVOLT, SECESSION, CIVILWARWON: in use, root not probed) | §1, §3.8 |
| `tech_log` | `TECH` | `on_acquired_technology` | world | every acquisition, to the day | verified | §6 |
| `downsizing` | `DZ`, `DZX`, `DZM` | every 1st of the month (`on_monthly_pulse`) | every producing building under 90% staffed | each level lost since the last poll: levels and private levels before and after, employment, the engine's warning flag, the building id; buildings tracked per poll | on in every telemetry run (the downsize feed) | §2.4¾ |
| `wages` | `WMKT`, `WC`, `SW`, `WSTR`, `PW`, `PWG` | dump, p0 (all of it) | `WC`/`SW`: members of the tags' markets; `WSTR`, `PW`: lead + subjects of `wage_pop_markets`, `PW` at endpoint dumps only | state wages, pop income, workforce ratio | verified | §5 |
| `scenario` | `MKT`, `SCEN` | dump, p1 | every country | urban-centre count and levels, SoL and workforce by stratum, market | verified | §4.2 |
| `boot_dump` | `BEGIN`/`END`, `MARKET`, `G`, `MKT`, `SCEN` (+ `CON`) | game start (day 0) | as `market_goods(_scoped)` | the start-state read | verified | §4.2, §4.3 |
| `building_inventory` | `BINVC`, `BINV`, `THRU` | day 7 | every building | type, level, employment %, employee cap, state; throughput bonus current and target | verified | §4.2 |
| `state_access` | `SMA` | dump, p3 | states of the tags | market access, infrastructure, infrastructure usage | verified | §9 |
| `construction_queue` | `CQ` | dump, p1 | the tags | queued levels (all / government / private) + the canary | verified; probe tool only (summary v5 supersedes) | §9 |
| `construction` | `CON` | dump, p1 | every country | construction, government and military goods spend | verified; retired from batch specs | §9 |
| `active_pms` | `APM` | dump, p3 | urban centres; grain-farm and textile secondaries | active methods per building | verified; replaced by summary v8 `pms` | §9 |
| `pop_sol` | `POP1` | dump, p0 | pops of the tags | per-pop SoL | superseded by `wages` and the save's pop table | — |
| `consumption_breakdown` | `CP` + tooltip payload | dump, p0 | the tags' markets | buy orders split by channel | verified, ~1 MB per market per dump; validation runs only | §3.3, §9 |
| `breakdown_sparse` | `CP` + tooltip payload | its own `breakdown_dates`, one market (`breakdown_tags`) per month | one market per tick | as above | as above | §3.3.1 |
| probes: `probe`, `treasury_probe`, `route_probe`, `origins_probe`, `scenario_probe`, `wage_probe`, `wage_probe2`, `consumption_probe`, `filter_probe`, `downsize_probe` | `P`, `TP`, `RP`, `OP`, `SP`, `WP`, `W2`, `CP`, `FP`, `DZP`/`DZV` | p0 or their own on_actions | — | one-off diagnostics; emit nothing unless asked for | — | §3.3.0, §4, §5 |

The `BOOT` line (`V3TB|<token>|BOOT|v<schema>|<date>`) and the `SEED` line (`[GetGlobalRandomSeed]`, MODDING_NOTES → *RNG seed*) are
emitted at game start in every build.

---

## Schema versions — bump it, never renumber it

Two counters, both **consecutive and monotonic**. A finding cites the version it was measured under, and that citation has to keep
meaning the same thing forever: never reuse or renumber a version. **Bump by one** whenever the output changes so that an older
session or summary is no longer comparable — a new metric or field, a changed line format, a dropped field.

### The telemetry schema — `$script:TELEMETRY_VERSION` in `tools/telemetry_lib.ps1` (today **15**)

Stamped into every generated telemetry file and each run's `BOOT` line, so a session's schema is readable off its own log. Record a
bump here **and** in the schema table at the top of FINDINGS.md. Changing the emitted telemetry without a bump trips L8
(`preflight.ps1 -UpdateFingerprint` for a deliberate fingerprint update); every new spec key must be threaded through the
scheduler (L5).

| schema | adds |
|---|---|
| **v1** | market goods, buy/sell/price only, generated by the harness. No events, no imports/exports/production |
| **v2** | builder-owned generator; imports, exports, production; events DEFAULT, DIPPLAY, PEACE, CAPIT |
| **v3** | `country_state` (GDP, foreign-owned GDP, GDP abroad, market; building counts and levels by category; world GDP); market owner; events WARSTART and true BANKRUPTCY. ⚠ v1–v3 carry no war state, so a country snapshot from them can be distorted by a war with no way to tell |
| **v4** | `STATE` per country per dump: `at_war` / `civil_war` / `revolutionary` / `in_default` |
| **v5** | `treasury`: TCASH / TREV / TEXP (the budget panel, §3.5) + TRADE (§3.6), then for tracked countries only |
| **v6** | `population`: `POP` per country per dump (§3.7) |
| **v7** | phased dumps (*Phased dumps* below) and tag-scoping removed: treasury on every country, market goods on every market |
| **v8** | `origins`: who supplied whom, per good, per importer market (phase 3) |
| **v9** | urban-centre count and levels; `market_goods_scoped`; `scenario`, `boot_dump`, `building_inventory`, `scenario_probe`; the first `events/` file the builder emits (§4) |
| **v10** | `wages` (§5): `WC`, `SW`, `WSTR`, `PW`; script values `v3tb_popobj_count`, `v3tb_state_count`, `v3tb_poptype_id` |
| **v11** | `tech_log` (§6) |
| **v12** | `filter_probe` (§3.3.0), diagnostic only |
| **v13** | `state_access` (`SMA`) and `construction_queue` (`CQ`), §9 |
| **v14** | `state_access` moves phase 1 → 3 (it pushed phase 1 past the ~1,500-line threshold late-century, §5.7); `wages` gains the spec key `wage_pop_endpoints` (`both` \| `first` \| `last` \| `none`, default `both`) choosing which dumps carry the heavy `PW` sweep — `none` for century batches |
| **v15** | `downsizing` (§2.4¾): the monthly poll of auto-downsized levels, `DZ` / `DZX` / `DZM`, added to every telemetry run by the scheduler's downsize feed; `downsize_probe` for its diagnostics |

⚠ Sessions `20260803_014037` and `20260803_022027` stamp v9 while carrying early v10 content (both were stopped part-way and are the
evidence for §5.6 and §5.7, not usable runs). Read their schema from `schedule.json`, not the `BOOT` line.

### The save-summary schema — `SAVE_SUMMARY_VERSION` in `tools/testbed/save_state_summary.mjs` (today **19**)

Written into every summary as `save_summary_version`; the version notes in the reader's header are the authoritative list. A field
absent from a summary older than the version that added it means "not captured", never zero. Saves are reaped, so a summary
version cannot be back-filled: add fields between batches, never during one (the harvester writes summaries mid-batch).

| version | adds |
|---|---|
| v2 | pop object counts |
| v3 | pop objects split into total and non-empty |
| v4 | `world.game_rules` (§7¼) |
| v5 | construction-queue composition per country (`queues.government/private`) |
| v6 | per-building-type value added `va_out` / `va_in`, at base prices |
| v7 | ownership: `company_levels`, `companies`, `ownership_levels` |
| v8 | per-building-type active methods `pms`; `prestige_out`; the top-level `states` map (`infrastructure`, `infrastructure_usage`) |
| v9 | the building's own ledger: `goods_sales`, `goods_cost`, `taxes`, `salary_w` |
| v10 | trade: per-state `trade_capacity` / `trade_capacity_usage`, per-country `trade`, `world.trade_goods`, `world.world_market_price` |
| v11 | `laws`, `trade_policy`, `tariffs` |
| v12 | one entry per country RECORD (`TAG@<id>` keys), `tag`, `civil_war`, `last_civil_war_date`; world totals over every record (L38) |
| v13 | `interest_groups` (clout, political strength) |
| v14 | `ig_by_workplace`, `world.ig_order` |
| v15 | per-state `lab` (slack labour) and `res` (resource-capped buildings) |
| v16 | military formations and their travel paths |
| v17 | dam types in `res`; per-state `dam_q` (queued dam levels by builder) |
| v18 | research flows: `innovation`, `max_innovation`, `population_incorporated`, `spreading`, `progress_unheld` |
| v19 | `world.war_goals`, `world.treaty_port_goals`, `world.treaty_ports` |

---

## Telemetry fundamentals

### The three mechanisms

**1. `debug_log` with data functions** — the main channel. Works without debug mode.
```
debug_log = "TAG|[GetMetaPlayer.GetPlayedOrObservedCountry.GetGDP|2]"
```
⚠ **One bad data function voids the WHOLE line** — it is not printed at all, you only get
`pdx_data_localize.cpp: Data error in loc string '<the entire string>'`. So put one metric per line when probing, and never mix an
unverified function into a line carrying data you need.

⚠ **A silent empty value is the dangerous failure.** `[…GetMarket.GetNameNoFormatting]` on an unresolved country prints
`" Market"`, not an error. Always probe a new path by printing something whose value you already know (a name), not just the number
you're after.

**2. Iterating script values** — the way to get aggregates and per-type counts into a single line. Define in
`common/script_values/`, read with **`.MakeScope.ScriptValue('name')`**:
```
v3tb_tooling_levels = { value = 0
    every_scope_state = { every_scope_building = {
        limit = { is_building_type = building_tooling_workshop }
        add = level } } }
```
```
debug_log = "…[GetMetaPlayer.GetPlayedOrObservedCountry.MakeScope.ScriptValue('v3tb_tooling_levels')]"
```
VERIFIED: GBR 1836 → 2 tooling workshops, 21 levels. `[SCOPE.ScriptValue('x')]` (without `MakeScope`) silently returns 0 — it never
enters the country scope. `MakeScope.ScriptValue` on a script value nothing defines also returns **0, not an error** (L6).

**3. `on_action` hooks** — for one-off events. Merge with vanilla's own entries through the documented append pattern
(`some_vanilla_on_action = { on_actions = { ours } }`); a mod `effect` block on a vanilla on_action replaces vanilla's (L22).

### Reaching the right object — the hard part

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

**Consequence:** any metric needing *two* runtime objects (market × market, state × owner country) gets the second one from
**`PREV`** when the objects are nested iterations — otherwise from `GetPlayedOrObservedCountry` or a `Get…('key')` literal.

⚠ **Argument forms are not uniform.** For `GetImportedAmountFromMarket(market, goods)` the market argument **requires `.Self`** and so
does the goods argument — the form copied from `custom_tooltip.gui` (market without `.Self`) errors. Copy a GUI call as a starting
point, then probe both forms.

⚠ Building **aliases are not keys**: `GetBuildingType('building_tooling_workshops')` (the alias) silently returns nothing; the key is
`building_tooling_workshop`. Same for `is_building_type`.

⚠ **A data function is loc-string-only.** Written as script — e.g. `limit = { is_goods = GetGoods('grain') }` — it is a parse error and
the engine abandons the rest of the file from that point (L2; BUGS_AND_FIXES → *A data function used as SCRIPT silently deletes the
rest of the file*). The good's key is on every line anyway: filter at analysis time.

⚠ **There is no `play_as` workaround.** `play_as` moves the *player*, and a `-handsoff` observer game has none: `<country> = { play_as =
c:FRA }` logs `Failed to switch player to new country in play_as effect - no player for scoped country` and observer mode never drops
(12 monthly attempts). Use `PREV`.

### Verified keywords, triggers and data functions

| kind | verified ✅ | fails ❌ |
|---|---|---|
| country script-value keywords | `gdp` · `literacy_rate` (0.53169) · `total_population` (25 951 649) · `produced_bureaucracy` · `bureaucracy_usage` (Britain 1836: 2,513 / 2,395, printed with `[THIS.GetCountry.MakeScope.ScriptValue('<sv>')\|0]`) | `money_amount` · `construction` |
| pop-scope keywords | `workforce` · `dependents` (their sums close on total population to 0.03 %, §3.7) · `standard_of_living` · `wealth` (returns the same number as `standard_of_living`) · nested `add = { value = x multiply = y }` | `pop_size` (weight by `workforce`) |
| other scopes | `state_unemployment_rate` (state) · `level` (building, `add = level`) | `trade_capacity` (not a state keyword) · `employment` (not a building keyword) |
| triggers | `is_building_type` · `is_building_group` (matches PARENT groups, §3.1) · `is_pop_type` · `market = c:TAG.market` (§5.3) · `is_subject_of` · `has_modifier = declared_bankruptcy` · `is_in_civil_war` (a scripted trigger, §3.4) · `market_goods_buy_orders > 0`, `is_consumed_by_government_buildings = yes` (in `every_market_goods`, §3.3.0) · comparators `construction_queue_num_queued_levels` / `_government_` / `_private_` wrapped in script values (v13 `CQ`) | `is_unemployed` (silently ignored, §3.7) · `unemployed_workforce` (reads 0) · `is_goods`, `goods`, `goods_equal` (§3.3.1) |
| Country data functions | `GetGDP` · `GetIncorporatedLiteracyRate` (0.53) · `GetAverageSoLByPopulation` (10.23) · `GetGoldReserves` · `GetWeeklyBalance` · `GetInvestmentPool` · `GetTotalForeignConstructions` · `GetMarket` · `GetTotalPopulation` · `GetInactivePopulation` · `GetPoliticallyInvolvedPopulation` · the whole budget panel (§3.5) | `GetTag` · `GetDefinition.GetKey` (§3) · `GetAverageAnnualWage` (state only, §5.1) · `GetPopulation` / `GetPopulationCount` · `GetBuildingTypeLevels` (in the exe, not on Country) |

**Not found on the log side:**
- **Construction throughput or capacity per country.** `GetConstructionsInCountry` belongs to `ConstructionPanel`, not Country;
  `GetConstruction`, `GetConstructionCapacity`, `GetBaseConstructionSpeed`, `GetConstructionEfficiency` all fail on Country, and
  `construction` is not a valid event target link. Save-side, each queue's total speed is in the summary (`queues.*.speed`, §7½).
- **Queue composition** (which building types are queued). Save-side only (`queues.*.by_type`, summary v5).
- **An unemployed-person COUNT summable in a script value** (§3.7.1).

### Named country tags — a hardcoded tag is a time bomb on a long campaign

`c:TAG` on a country that **no longer exists** does not evaluate to false — it raises a script-system error. Tags valid at 1836 are
routinely gone by 1900 (annexed, or formed into a successor), so a metric that names countries starts erroring part-way through a
campaign and never stops. **It is silent by construction**: the metric still emits correct lines for the countries that exist, the
TSV looks right, and the only trace is in `error.log` (one vanilla control run wrote 574 455 lines, 48 659 naming our telemetry
file — BUGS_AND_FIXES, L1).

**Rule:** every filter on a named tag goes through **one** function — `Get-GuardedOwnerLimit` (emits
`OR = { AND = { exists = c:GBR owner = c:GBR } … }`) or `Get-GuardedCountryBlock` for a scope switch (`if = { limit = { exists =
c:GBR } c:GBR = { … } }`) — or iterates and filters on a **property** instead of identity. L1 checks the emitted files on every
build. ⚠ `meta.json` → `error_log_lines` is the run's own count only from 2026-10-28 (L9: the lines stamped inside the run's window,
`error_log_foreign_lines` beside it); before that it is the raw mirror line count, an upper bound — `preflight.ps1 -Session` says
whether a session's mirrors held another run's lines. Lines
naming `zzz_v3tb_telemetry.txt` are ours by definition and should be **zero**.

⚠ A tag may not be the country you think: the Netherlands is **`NET`**, not `NED` (`c:NED` reports absent for a country that plainly
exists — L11, §5.3); `IND` in 1836 is Indore.

### Phased dumps (v7) — group by the LOGGED date, and know when each block was sampled

A dump used to emit everything in one tick: ~1.96 MB, 78 % of the game's 5 × 512 KB log ring, so segments rotated away before any
poll could read them. No poll rate fixes that. So each block of a logical dump fires in a different month (L4):

| phase | metrics | sampled at |
|---|---|---|
| 0 | `market_goods`, `market_goods_scoped`, `wages`, `pop_sol`, `consumption_breakdown`, every probe | the dump date exactly |
| 1 | `country_state` (+ `population`), `scenario`, `construction`, `construction_queue` | **+1 month** |
| 2 | `treasury` | **+2 months** |
| 3 | `origins`, `active_pms`, `state_access` | **+3 months** |

Outside the dump phases: `market_goods_wide` and `breakdown_sparse` fire on their own dates, `boot_dump` at game start,
`building_inventory` on day 7, `events` and `tech_log` on their on_actions.

⚠⚠ **The logged date is NOT when the value was sampled.** Phase *p* fires *p* months after the date it stamps on every line. Grouping
by `dump_date` stays correct; a dated model does not. Urban-centre methods stamped `1836.2.1` are the 1836.5.1 state (by May ~110
levels had switched on `pm_public_trams`); the SoL and urban-centre levels in `config/measured_1836.json`, stamped 1836.2.1, are the
1836.3.1 state. **Rule: when a phased metric feeds a dated model, put it in phase 0 or subtract the phase from the label.**

⚠ **A run's `until` must be at least the last dump date + p + 1 months**, or that block never fires: a probe ending before dump + 3
months harvests zero `ORIG` and `SMA` lines.

⚠ **The country set can differ between phases** (285 countries in p1 against 283 in p2 at one logical dump: annexations in between).
Join on country name and tolerate the difference; never assume the treasury row count equals the GDP row count.

⚠ **Never phase apart two quantities that must be read at the same instant** — a completeness check is always one of those (§5.5).

### The log channel: recovery and the completeness gate

- **Recovery.** `tools/testbed/summarise.ps1` reads both `logs_live/debug.log` (the live mirror) and the exit-time copy of the ring
  (`logs/debug*.log`), de-duplicating by exact payload. Lines the mirror missed are still in the ring at exit, so merging recovers
  them at no runtime cost (verified: 2 013 lines reported missing, 2 013 recovered). The harness's `MIRROR INCOMPLETE` warning
  therefore says how much the summariser will recover, not that data is lost. ⚠ This rescues only what is still in the ring at exit —
  never a mid-run dump of a long campaign (§5.7).
- **The completeness gate.** A short dump looks exactly like real attrition ("France is missing"). `summarise.ps1` measures country
  rows per dump against that run's own peak and flags anything under 60 % (`WARNING: run 1: 1 PARTIAL dump(s) - 1846.2.1=58 rows`),
  and writes the list to `summary.json` → `integrity.partial_dumps` beside `country_rows_per_dump`. **Read it before analysing a long
  run** and treat a flagged dump as absent, not as a sample.
- **Filter on the run's own token** from `meta.json` before counting anything per run: the ring carries earlier runs' lines (§5.4, L9),
  and the mirror can re-copy chunks (L28) — de-duplicate per-event lines, but never per-pop lines (`PW`, `POP1`), where identical lines
  are distinct pops.

---

## 1. One-off events — `events`, VERIFIED firing with usable identity

Lines: `V3TB|<token>|EV|<TYPE>|<country>[|<target>]|<date>[|gdp=<gdp>]`, harvested into `events.tsv`. The hooks below were probed over
1836→1850 in one observer run.

| Event | on_action | Identity | Emitted | Count to 1850 (one probe) |
|---|---|---|---|---|
| **Entering DEFAULT** — NOT bankruptcy (below) | `on_country_default` | `GetRootScope.GetCountry` = the defaulting country, plus its GDP | `DEFAULT` | 57 |
| Leaving default (recovered **or** went bankrupt) | `on_country_no_longer_default` | root country | probed, not emitted | 356 ⚠ |
| **Diplomatic play started** | `on_diplomatic_play_started` | `SCOPE.sCountry('initiator')` and `('target')` — root is EMPTY | `DIPPLAY` | 41 |
| A play that became a war | `on_diplo_play_war_start` | `SCOPE.sCountry('initiator')` / `('target')` | `WARSTART` | — |
| **Peace signed** | `on_peace_agreement_signed_war_leader` | root country; fires once per war leader, so twice per peace | `PEACE` | 68 |
| War ended | `on_war_end` | `SCOPE.sCountry('actor')` and `('target')` | probed, not emitted | 35 |
| Capitulation | `on_capitulation` | root = the capitulating country | `CAPIT` | 37 |
| Revolution / secession started; civil war won | `on_revolution_start`, `on_secession_start`, `on_civil_war_won` | `SCOPE.GetRootScope.GetCountry` | `REVOLT`, `SECESSION`, `CIVILWARWON` | — |
| True bankruptcy | none — a monthly poll (§3.8) | `THIS.GetCountry` | `BANKRUPTCY` | — |

Samples: `DIPPLAY|init=Texas|tgt=Mexico`, `CAPIT|root=Ladakh|d=March 3, 1836` (probe forms). The REVOLT, SECESSION and CIVILWARWON
roots were never probed on their own, but the lines are read in production: a `REVOLT` line names the country revolted against and
the war's `CIVILWARWON` names the winner (`tools/testbed/ledger/stuck_britain.mjs`).

⚠ **`on_country_no_longer_default` fires once for EVERY country at game init** (~300 lines before the first tick) — filter by date
before treating it as a recovery signal. `on_diplomatic_play_started` has **no country root**; use the `initiator`/`target` scopes.
There are ~40 more hooks in `00_code_on_actions.txt` (`on_diplomatic_action*`, `on_diplomats_expelled`, …), unprobed.

### DEFAULT is not BANKRUPTCY — they are two different things

- **Default** is a *state*: loans exceed credit, construction pauses, building throughput is penalised and the penalty grows. The
  game's own `concept_default_desc` says the penalties end "as soon as the country's weekly balance becomes positive again, **or if
  bankruptcy is declared**".
- **Bankruptcy** is an *action* taken while in default: it wipes the debt, angers debt-holding pops, drops institutions to 1 and
  applies a decaying 10-year debuff.

`on_country_default` fires on **entering the default state**. There is **no bankruptcy on_action** — the complete set is
`on_country_default`, `on_country_no_longer_default`, `on_debt`, `on_scaled_debt`, `on_entity_default`, `on_should_override_default`
— and leaving default happens on *either* recovery or bankruptcy, so `on_country_no_longer_default` cannot tell which occurred. The
diplomatic catalyst `catalyst_declared_bankruptcy` (category `cc_bankruptcy`) has no on_action; `last_bankruptcy_date` is in the save
(§7½). Bankruptcy itself is polled (§3.8).

**Reporting rule: call DEFAULT lines what they are — entries into default, never "bankruptcies".**

**How long a default lasts** (1836→1850, 93 events, 89 with an observed exit): 91 % end within ~6 weeks, 4 % within 6 months, 1 %
within 2 years, 3 % last longer; median ≈ 30 days. ⚠ Exits carry no in-game date and were dated by interpolating wall-clock stamps, so
"on the order of a month" is solid and "exactly 30 days" is not.

### Reporting rule: collapse chains with <13 months between neighbours

Small states oscillate in and out of default (Portugal enters default 12 times in 14 years). When reporting *how many defaults
happened*, group each country's events into chains and **report only the earliest event of each chain**, starting a new chain
whenever the gap **from the previous event** is 13 months or more:

```
gap_months = (y2*12 + m2) - (y1*12 + m1)      # calendar months; ~396 days if you only have day numbers
gap_months <  13  -> same chain (drop this event)
gap_months >= 13  -> new chain  (report this event)
```

The gap is between **neighbours**, not from the chain's start. Worked example — `1838.01, 1838.11, 1839.04, 1842.02, 1843.01` reports
as **two** defaults, 1838 and 1842. 13 months is just over a year, so an annual re-default cycle collapses. On the 1836→1850 run: 94
raw events → 80 reported (Portugal 12 → 1, Hanover 4 → 1; Mombasa's five crises ~2 years apart all survive).

---

## 2. State-of-process metrics

### 2.1 Building counts — VERIFIED

Per country and per building type, via an iterating script value (mechanism 2). `country_state` emits `BLD` (counts) and `LVL`
(levels) by category: total, `mfg` (`bg_manufacturing`), `extract` (mining, logging, rubber, oil), `agri` (agriculture, ranching,
plantations, fishing, whaling), `subsist` (subsistence, children of agriculture/ranching — subtract at analysis time), `gold`.
"Non-economic" is derived as total − (mfg + extract + agri), so a forgotten group cannot vanish from the accounting.

| Metric | Value (GBR / world, 1836) |
|---|---|
| buildings (count) | 252 / **5 976** |
| building levels | 3 219 / **89 964** |
| tooling workshops | 2 buildings, 21 levels |

World totals wrap the same iterator in `every_country = { … }`. Building counts measure directly whether the AI built a newer rung;
the save summary now carries the same per type (§7½).

### 2.2 GDP — VERIFIED
- Country: `GetGDP` → `24 824 719.31`. Also as a script-value keyword (`value = gdp`). Line: `GDP|<date>|<country>|<GDP>|<foreign-owned
  fraction>|<foreign-owned GDP>|<GDP owned abroad>|<market name>`.
- **World**: script value `{ value = 0  every_country = { add = gdp } }` → `366 538 141.9`, emitted once per dump as `WORLD` (from inside a
  guarded `c:GBR` scope; `NO_GBR` if Britain is gone). Call it *outside* `every_country`, or it is O(n²).
- State: `GetGDPContribution` (`3 609 695`) and `GetGDPContributionPercentage` (`14.54%`).
- `GetGDPRanking` returns a **base64 tooltip blob**, not a number — it does contain the world top-10 but parsing it is ugly; compute
  rankings from per-country GDP.

### 2.3 Foreign-owned GDP — VERIFIED
On Country, no per-owner iteration required:
- `GetForeignOwnedGDP` — absolute
- `GetForeignOwnedGDPFraction` (use `|%2` → `0.00%`) — **the share metric**
- `GetGDPOwnedInForeignCountries` → GBR 1836 = `8 561 050.99` (its holdings abroad)
- `GetGDPWithOwnershipsInForeignCountries` → `33 361 051` = own GDP + holdings abroad (consistent ✓)
- `GetTotalForeignConstructions`

Per-state, per-owner also exists: `State.GetGdpRatioOwnedBy(<country>)` — but it needs a second runtime object, so in practice only
with the observed country as the owner.

### 2.4 Market composition per good — `market_goods`, VERIFIED

In `every_market_goods` scope, on `THIS.GetMarketGoods.GetGoods`: `GetMarketBuyOrders`, `GetMarketSellOrders`, `GetMarketPrice`,
**`GetMarketImports`**, **`GetMarketExports`**, **`GetMarketProduction`**, `GetKey`. The emitted line:

```
every_market = {
  debug_log = "V3TB|<token>|MARKET|<date>|[THIS.GetMarket.GetNameNoFormatting]|owner=[THIS.GetMarket.GetOwner.GetNameNoFormatting]"
  every_market_goods = {
    debug_log = "V3TB|<token>|G|<date>|[PREV.GetMarket.GetNameNoFormatting]|[THIS.GetMarketGoods.GetGoods.GetKey]|[THIS.GetMarketGoods.GetGoods.GetMarketBuyOrders|2]|[THIS.GetMarketGoods.GetGoods.GetMarketSellOrders|2]|[THIS.GetMarketGoods.GetGoods.GetMarketPrice|2]|[THIS.GetMarketGoods.GetGoods.GetMarketImports|2]|[THIS.GetMarketGoods.GetGoods.GetMarketExports|2]|[THIS.GetMarketGoods.GetGoods.GetMarketProduction|2]"
  } }
```

Import share = `imports / buy_orders`; self-supply share = `production / buy_orders` (British market 1836, `tools`: production
1888.8, buy 1788.9, imports 0, exports 125 — a net exporter). A market is identified by its name plus its owner; `market_goods_scoped`
adds `limit = { <Get-GuardedOwnerLimit tags> }` to the market loop. **Limits:** ~5,300 lines a dump for every market — restrict the
markets, not the goods (§3.3.0); the order book is in no save, so this is the only source (§9); for the import and export columns
see §2.5.

### 2.4½ The yearly red-flag feed — `market_goods_wide` in EVERY run (user-ruled 2026-10-03, BALANCE_FRAMEWORK §10.94)

`run_schedule.ps1` adds `market_goods_wide` to every run on **1 July of every year** from 1836 to the year before `until`, over the
eleven tags of `ledger/lib_markets.mjs` (`TELEMETRY_TAGS`, read from that file), merged with whatever the schedule asks (a union of
dates and tags); `-NoRedFlagFeed` drops it, only for a re-run that must match an old batch byte for byte. The line is
`V3TB|<token>|GW|<date>|<market>|<good>|<buy>|<sell>|<price>|<production>` — ~50 a market a year, ≤ 11 markets: guarded tags (L1),
bounded at any end date (L3), July so it never shares a tick with the January dumps' phases. The lines stay in
`logs_live/debug.log` (not harvested into a TSV); `ledger/input_price_flags.mjs` reads them by the run's token, de-duplicating
mirror re-copies (L28). They exist for the input-price red flags — a 2-year stretch needs a reading a year, which the decadal dumps
cannot give — and they are the only source that prices a good in a market that makes none of it (the save summaries price a good
from its producers). Sessions before 2026-10-03 carry none; their flags come from the save summaries and say so.

### 2.4¾ The monthly downsizing poll — `downsizing` in EVERY telemetry run (user, 2026-10-30; FINDINGS F260, F261)

Auto-downsizing (a building missing ≥ 1 private level of staffing and ≥ 10% of it waits 6 months, then loses one private level a
week) has no hook (MODDING_NOTES → *Auto-downsizing*), so the poll looks for the drop itself. On every 1st of the month
(`on_monthly_pulse`, emitted last in `zzz_v3tb_telemetry.txt` by `Get-DownsizeBlock`) it remembers every building of the producing
groups (manufacturing, agriculture, ranching, plantations, extraction, power, arts; not subsistence) that QUALIFIES — level ≥ 1, not
wholly owned by a country, under 90% staffed, at least one level empty — and, at the next poll, logs each remembered building whose
level fell:
```
V3TB|<token>|DZ|<date>|<country>|<state>|<type>|<level before>|<level now>|<private before>|<private now>|<employment now>
V3TB|<token>|DZX|<date>|<country>|<state>|<type>|auto=<IsAutoDownsizing 0/1>|id=<the save's building id>
V3TB|<token>|DZM|<date>|tracked=<remembered now>|read=<remembered last poll, still there>|drops=<DZ lines>|over=<4,096+ levels>
```
- **Private = not owned by a country** (`country_ownership_fraction`), so a building that owns itself counts; `private_ownership_fraction`
  leaves those out (probe `20261030_221503`). Government = the rest. The reader leads with the VOLUME (every level lost on a tracked
  building) and counts a drop as auto-downsizing when private levels fell, government levels did not, and it lost at most 5 levels
  since the last poll (one level a week); state clusters are printed and kept (F261).
- **The memory lives on the state**: a building scope holds no variables (probe `20261030_220510`), so each state keeps variable lists
  of building scopes, a building's level and private levels written as 12 bits across lists, two generations alternating.
- **A building that loses its LAST level** is still logged, from the state's list, which keeps the dead reference: its DZ line names
  the type and the levels (`2|0|2|0`) but the country is empty, the state `NULL_STATE` and the id −1 (probe `20261030_222514`).
- **Not seen:** ports, railways, trade centres and the mod's dams (outside the groups — a mod-only group name would void the limit in a
  vanilla control); a drop in the month before a continuation's second poll (nothing is remembered before the first).
- **Volume:** one DZM line a month plus two lines a drop (a 1921 vanilla world: ~990 buildings tracked, ~70 drops a year). **Cost:**
  nothing measurable — in a 1921 vanilla world the poll's sub-tick grows ~0.4 s a game year, and the year's ~127 s moved −0.3 ± 0.4 s
  (F261).
- Read with `ledger/downsize_telemetry.mjs <label>=<group>[:<setup>]` (per run, by decade, by type, by tier for a tiered book). Off:
  `run_schedule.ps1 -NoDownsizeFeed`, the schedule key `downsize_feed: false`, or `$DOWNSIZE_FEED_DEFAULT = $false`. Sessions before v15
  carry none; for them only F260's save route exists (`ledger/downsize_series.mjs`, kept saves only).

### 2.5 Where a market's imports come from — `origins`, VERIFIED, with one limit

**The bilateral form uses `PREV`**: inside a nested iteration `PREV` is the enclosing scope (in `every_market` nested under the British
market, `PREV.GetMarket` = British Market, `THIS.GetMarket` = the iterated market). No observed country, saved scope or `-start_tag`
is needed:

```
c:GBR = { market_capital.market = {          # or: every_market = {   for EVERY destination
    every_market = {                          # THIS = source, PREV = destination
        debug_log = "…dest=[PREV.GetMarket.GetNameNoFormatting]|src=[THIS.GetMarket.GetNameNoFormatting]|
                     amt=[PREV.GetMarket.GetImportedAmountFromMarket(THIS.GetMarket.Self, GetGoods('silk').Self)|2]"
    } } }
```

**It reconciles exactly** against the market's own total: British market, 1836.2.1, silk — `GetMarketImports` 125.00 = Qing 120.80 +
Sicilian 4.20. It is **observer-independent**: with Great Britain observed, destination × good pairs where neither side is the observed
country summed to the destination's own `GetMarketImports` within rounding (Qing ← meat 104.00 / 103.97, Russia ← tea 65.00 / 64.98,
Austria ← sugar 216.00 / 215.96; the observed control Britain ← silk 130.00 / 129.99; the residual is 2-dp rounding over ~305 rows).
One pair read high (Russia ← tobacco 105.00 / 109.96), most plausibly the log-mirror loss of that time, never re-checked. The source
side is complete: `every_market` enumerates all ~305 markets and a non-partner returns `0.00`.

**The production form (v8) pins the exporter by filtering the iteration, not by an argument:**

```
c:GBR = { market_capital.market = {              # importer = PREV
    every_market = {
        limit = { OR = { owner = c:CHI  owner = c:FRA … } }    # exporter, pinned by owner (emitted guarded, L1)
        debug_log = "…|[THIS.GetMarket.GetNameNoFormatting]|silk|
                     [PREV.GetMarket.GetImportedAmountFromMarket(THIS.GetMarket.Self, GetGoods('silk').Self)|2]"
    } } }
```

Emitted as `V3TB|<token>|ORIG|<date>|<importer tag>|<exporter market>|<good>|<amount>`, importers and exporters both the spec's tags,
goods from `origin_goods` (default `tools steel clothes paper glass coal iron silk tea opium`). Cost is importers × exporters × goods
(8 × 8 × 10 = 640 lines a dump). **Limits:**
- **Every scope-path argument voids**: `c:CHI.market_capital.market[.GetMarket].Self` as an argument, in both directions, and
  **`GetExportedAmountToMarket` in every form tried** (probe `20260801_185552`, five variants). The market argument must come from an
  iterated scope.
- **The good must be a LITERAL key** — `GetGoods('silk')`. An iterated good passed as an argument voids, so the goods list is
  enumerated in the generated script.
- **`every_trade_route` yields nothing** in this context (a constant marker inside the loop printed zero times), so origins come from
  the market × market form, not routes.
- **Drop self-pairs**: a market "importing from itself" returns a non-zero value (Austria ← Austrian Market tea 2.16); meaning unknown.
- **Volume:** a full market × market matrix is ~93,000 lines per good; pin both sides to a handful of tags. Origins needs its own phase
  (phase 3): put in phase 0 beside market goods it lost 5 980 of ~6 000 lines (L4).

**What the market line's import and export columns report** (`GetMarketImports` / `GetMarketExports`). Checked against the save's
trade capacity (summary v10; FINDINGS F159 §1, F161 §5) on run 1 of `20260923_215141_canon-trade-n4`:
- a (market, good) pair whose members trade the good in ONE direction reports exactly `capacity × traded_quantity` in that direction
  (155 of 155 at 1840.1.1; on a re-count that reads every good's quantity, 159 of 160 — the miss is British merchant marine, capacity 2
  imported, line 0);
- a pair whose members hold capacity in BOTH directions reports **the dominant direction at its full gross volume and 0 for the other
  — never the net** (9 of 9 at 1840: British luxury clothes, import capacity 32 against export 56, reads exports 896 = 56 × 16 and
  imports 0);
- the volume carries each member's trade-centre **quantity multiplier**: `line = Σ over members of capacity × traded_quantity × (1 +
  quantity mult)`, and "dominant" is decided on that effective volume, not on capacity (British luxury clothes at 1850: import
  capacity 69 against export 59, yet exports 1,416 = 59 × 1.5 × 16 and imports 0);
- at 1850.1.1, 137 of 160 one-way and 5 of 8 two-way pairs match; 23 of the 26 misses sit between ×1.0 and ×1.5 (mixed centre methods
  among members), and three read below ×1.0 with no explanation (British tea, fine art, luxury furniture).

⇒ For TRADE VOLUME read the v10 capacity (`countries.<tag>.trade.goods`) × the traded quantity, not the market line; the quantity
multiplier is not in a summary, so that product is a LOWER bound. Import shares from the line are comparable between arms (every arm
carries the same rule) but are a floor. The rule is what this build does at these dates: an August 2026 sweep of 50 370
market-good-snapshot rows found 7 carrying both flows (Prussia importing 55 tea while exporting 5), so re-check before relying on it
where two-way trade is large. Checker: `node tools/testbed/ledger/market_line_check.mjs <runDir> <date>`.

---

## 3. Per-country iteration — VERIFIED

**`every_country` works inside an on_action effect, and `THIS.GetCountry.…` resolves** — so you cannot ask for a country by tag, but you
can walk all ~285 of them and log each. Verified per country: `GetNameNoFormatting`, `GetGDP`, `GetForeignOwnedGDPFraction`,
`GetForeignOwnedGDP`, `GetGDPOwnedInForeignCountries`, `GetMarket.GetNameNoFormatting`.

⚠ **There is NO country tag data function.** Both `GetTag` and `GetDefinition.GetKey` fail (they void their line). **Country identity
in logs is the NAME** — which changes when a country forms (Prussia → Germany), so cross-date joins must handle it, and a join
against the saves needs two keys (§7½). For a *named* country the trigger-side `c:TAG` scope works, so a fixed watch-list is a
per-tag block guarded by `exists = c:TAG` with an `else` that logs an explicit "absent" line.

### 3.1 Building counts by category — VERIFIED

`is_building_group` **matches PARENT groups**, so one test covers a whole branch of `common/building_groups`: `is_building_group =
bg_manufacturing` catches light + heavy + military industry and ship construction together. Combined with mechanism 2 and
`MakeScope.ScriptValue` *inside* `every_country`, this gives per-country per-category counts in one pass.

Verified 1836 (buildings, not levels): GBR total 259 / mfg 28 / extract 17 / agri 65 / subsistence 26 / gold 0. France 288 / 29 / 17
/ 96 / 29 / 0. Russia 392 / 39 / 35 / 126 / 73 / 0. Verified world GDP 1836 = `372 895 689.39`.

⚠ These counts iterate `every_scope_state × every_scope_building` for every country; there is no country-level building-count function.
Restrict to tracked tags if cost matters.

### 3.2 Market ownership — VERIFIED

**`GetMarket.GetOwner.GetNameNoFormatting`** gives the country that owns a market, which makes a shared market legible: 1836 `BIC` (East
India Company) logs `British Market | owner=Great Britain | member=East India Company`.

### 3.3 Orders decompose by channel ONLY through the tooltip string — `consumption_breakdown`

Every *scalar* route fails, and each voids its line: `GetWorldMarketAdditionalImportsToMarket`,
`GetWorldMarketAdditionalExportsFromMarket` (on Market *and* on Goods), `GetMarketBuyAndSellOrdersBalance` (on Goods), and
`GetMarketGoods(<goods>)` — **a data function taking a goods argument does not work here**. A treaty transfer lands in sell orders but
not in `GetMarketImports` (§4.1), so on the sell side it is `sell − production − imports`.

#### `GetMarketBuyOrdersBreakdown` — VERIFIED, and expensive

`Goods.GetMarketBuyOrdersBreakdown` returns the market panel's buy-orders split **by source** as formatted tooltip text: a **Pop
Consumption** entry with a per-pop-type split under it, one entry per **building type**, and an **`N purchased for Slaves`** line (loc
`GOODS_SLAVE_CONSUMPTION_MARKET_ORDERS`) — the slave-basket channel, a *building* purchase that appears nowhere else. Emitted as:

```
every_market_goods = {
    debug_log = "V3TB|<token>|CP|C2|<date>|[PREV.GetMarket.GetNameNoFormatting]|[THIS.GetMarketGoods.GetGoods.GetKey]|BEGIN"
    debug_log = "[THIS.GetMarketGoods.GetGoods.GetMarketBuyOrdersBreakdown]"
    debug_log = "V3TB|<token>|CP|C2end|[THIS.GetMarketGoods.GetGoods.GetKey]"
}
```

Five things about it are load-bearing, and **every one fails silently** — the parse returns plausible numbers rather than an error —
which is why `tools/testbed/analyse_slave_basket.ps1` (and `lib_breakdown.mjs`) exist rather than a grep:
- **It is text, not a number.** The call lands as many physical lines, each carrying a multi-KB base64 payload. Fence it with your own
  markers.
- **One market per tick.** Two markets pushed the log to 2.1 MB against the 5 × 512 KB ring and the block was cut after 43 of ~72 goods.
  Even one market usually loses its tail, so **run each market twice and union the goods** — runs truncate at different points.
- **Grep for `purchased for`, NEVER the full phrase.** The rendered line is, byte for byte, `<21>v; +2.61<21>! purchased for
  <22>slaves! Slaves` — 0x15 fences the value, 0x16 precedes the interpolated `$slaves$` concept. Searching for `purchased for slaves`
  matches nothing and returns a silent zero, as does requiring `!` to follow the digits. Same trap for any loc string that interpolates
  a `$concept$`.
- **A block only counts if it CLOSED.** The ring truncates the last block, and its fence then swallows every value logged afterwards.
  Discard unterminated blocks.
- **A fence is not proof of which good a value belongs to.** At British-market volume the mirror interleaves, putting values inside the
  wrong block. **Verify**: each block's payload opens with `Current total: <buy orders>`, which must match the `G|` line's
  `GetMarketBuyOrders` for that good; a block holding more than one candidate value cannot be resolved. Build that reference table
  **across the whole session** — the breakdown's own volume can push a run's `G|` lines out of the ring, and runs in one session are the
  same arm at the same date (per-good spread 0–5 %).

What you CAN get as plain scalars is the **domestic-vs-traded split** (§2.4). For *who* supplies, use `origins` (§2.5).

Status: verified; ~1.1 MB per market per tick against a 2.5 MB ring. Save-side by ruling, the breakdown kept for validation runs (§9).

### 3.3.0 A `limit` DOES work in `every_market_goods`; what fails is goods IDENTITY (v12, FINDINGS F34)

Probe `20260805_233952_filter-probe` (control arm) tested the quantity and property triggers vanilla itself uses under `script_context
= player_market_goods`, each in its own fenced on_action (metric `filter_probe`, lines `FP|<case>|start|hit|end`):

| `limit` | goods (British Market, 1836.2.1) | |
|---|--:|---|
| *(none)* | 43 | baseline |
| `market_goods_buy_orders > 0` | **42** | ✅ works — excludes exactly `gold`, which has zero buy orders |
| `market_goods_sell_orders > 0` | 43 | parses; nothing to exclude at this date |
| `is_consumed_by_government_buildings = yes` | **5** | ✅ works — `fabric iron paper tools wood` |
| `goods_equal = g:automobiles` | 43 | ❌ no-op — matched everything; identity still unavailable |

**Where to look for more:** `common/trigger_localization/00_trigger_localization.txt` catalogues **every** trigger in the game, and
`common/alert_types/00_alert_types.txt` shows which run in a `market_goods` scope. Read them before probing.

⚠⚠ **Do not put a filter on the channel split.** The saving is small (1 good in 43) and `score_pop_split.mjs` counts *a verified block
with no pop entry* as a **real zero** — which is what charges the pop model for demand it invents on goods nobody buys. Filtering
zero-buy-order goods deletes exactly the cases the model is most likely to fail (F34).

### 3.3.1 The breakdown cannot be restricted to named goods by identity — four routes probed, all failed (v11–v12)

| route | probe | result |
|---|---|---|
| `limit = { is_goods = g:X }` inside `every_market_goods` | `20260805_140913` | fires **zero** times; no error names the trigger |
| `limit = { goods = g:X }` inside `every_market_goods` | `20260805_140913` | same |
| `THIS.GetMarket.GetMarketGoods(GetGoods('X').Self).GetMarketBuyOrdersBreakdown` | `20260805_141239`, `_141614` | **takes the whole on_action down** |
| `limit = { goods_equal = g:X }` inside `every_market_goods` | `20260805_233952` | parses and runs, but matches **every** good — a no-op (F34) |

The third route is a quieter variant of L2. A data function in **script** position is a loud parse error that abandons the rest of the
file. Here the accessor sat inside a `debug_log` **string**: the file parsed and linked cleanly, nothing appeared in `error.log`,
`game.log` or `warning.log`, and the dump on_action simply **produced no output at all** — the plain-string fences around the bad line
did not print either (`BEGIN` went from 321 occurrences in a working run to zero). The effect appears to be validated as a whole and
silently no-op'd; that mechanism is inferred, not proven.

**Rule:** probe an unverified data function in an **on_action of its own**, not merely on a line of its own — a line-level fence does
not contain this failure. And read BUGS_AND_FIXES before probing a new data function.

**The affordable shape is a SPARSE DATE LIST, not a goods filter** — `breakdown_sparse` with `breakdown_dates` and `breakdown_tags`,
each market in its own month (one megabyte per tick, never two). Aim it at dates a cheap `market_goods_scoped` run has identified. It
must ride in the same run as the observation: dates found in one run do not transfer to another seed.

### 3.3.2 Restricting the breakdown to POP-CONSUMABLE goods — wanted, and not buildable

The design that should be used (user, 2026-08-05): emit the channel split only for goods pops can consume, or only for goods sharing a
**need** with the goods under investigation (of ~53 goods, 35 appear in some pop need; one question's needs touch ~15). That is a ~3×
saving on the most expensive metric.

**It is blocked by the trigger set, not by the scope:** quantity and property triggers work (§3.3.0), but there is **no
`is_consumed_by_pops`** — only `is_consumed_by_government_buildings` and `is_consumed_by_military_buildings` — and nothing in the trigger
catalogue selects a good by who consumes it. Selecting a need's goods would need goods identity, which has never worked (§3.3.1). And
even the filters that work must not go on the breakdown (§3.3.0). Note the asymmetry with the order book, where filtering at analysis
time costs nothing: for the breakdown the cost **is the emission**. **The levers remain markets, dates and goods-at-analysis**: one
market per tick, a sparse date list, union across dumps and runs.

### 3.4 Country STATE flags — VERIFIED (v4)

`v3tb_at_war` / `v3tb_civil_war` / `v3tb_revolutionary` / `v3tb_in_default`, 0/1 script values read per country per dump, on their own
`STATE` line (kept off the GDP line so a void cannot take GDP with it):
- **war** — 14 countries at 1836.2.1, exactly the historical ones (Texas/Mexico, Carlist Spain, Jammu/Ladakh, Tripolitania/Fezzan,
  Brazil/Riograndense).
- **civil / revol** — `civil` is **exactly 2× `revol` at every dump**, the correct signature: a civil war is fought between a country and
  a breakaway sharing its `country_definition`, so `is_in_civil_war` is true for both while `is_revolutionary` is true only for the
  breakaway.
- **default** — Bremen entered default 22 Jan 1848 and reads `default=1` at the 1848.2.1 dump.

⚠ `is_in_civil_war` is a **scripted trigger** (`common/scripted_triggers/00_scripted_triggers.txt`) written against `ROOT`. It
evaluates correctly inside `every_country` here — do not "fix" it without re-probing.

⚠⚠ **These flags sample an INSTANT, and civil wars are transient — they undersample by ~30×.** Over 1836–1856 the event log held 267
distinct revolt tags while 12 snapshots caught 8 episodes. **Use the flags to decide whether a snapshot's economics are distorted; count
episodes with the `REVOLT` / `CIVILWARWON` events (§1).**

### 3.5 Treasury — the whole in-game budget panel, VERIFIED (v5)

Every function below is on **Country** scope and returned a value with **zero data errors** (probe sessions `20260731_232310` /
`_232749`). They are the functions `gui/budget_panel.gui` uses, so the log reproduces the panel line for line. Emitted on every country
as `TCASH`, `TREV`, `TEXP` in this order — **the field order is the parsing contract: append at the END of a line, never insert.**

**Cash / stock (`TCASH`).** ⚠ Reserves and debt are **different variables** — log both, never one signed number: `GetGoldReserves`
(943 265 for GBR 1836) · `GetPrincipal` (the debt; 0 at 1836) · `GetMaxCredit` · `GetRemainingCredit` · `GetWeeklyBalance` ·
`GetInvestmentPool` · `GetInvestmentPoolChange` · `GetUnrealizedTaxes` · `GetWeeklyExpenses`. Net position = `GetGoldReserves −
GetPrincipal`, at analysis time.

**Revenue (`TREV`).** `GetIncomeTaxIncome` · `GetPollTaxIncome` · **`PredictConsumptionTaxes`** · **`PredictTariffs`** ·
**`PredictMinting`** · **`PredictDiplomaticPactsIncome`** · **`PredictTreatyIncome`** · `GetInvestmentIncome`.

**Expenses (`TEXP`).** `GetGovernmentGoodsExpenses` · **`PredictGovernmentWagesExpenses`** · `GetMilitaryGoodsExpenses` ·
**`PredictMilitaryWagesExpenses`** · `GetSupplyShipMaintenanceExpenses` · `GetSupplyShipConstructionGoodsExpenses` ·
`GetMilitaryShipMaintenanceExpenses` · `GetPortConnectionExpenses` · `GetWelfarePaymentsExpenses` · `GetSubsidiesExpenses` ·
`GetSubventionsExpenses` · `GetInterestPayment` · `GetConstructionGoodsExpenses` · `GetGovernmentSlavesExpenses` ·
`GetMilitarySlavesExpenses` · **`PredictTreatyExpenses`** · **`PredictDiplomaticPactsExpenses`**.

⚠ Note the **`Predict*`** prefix on seven of them — the panel computes those forward, and no `Get*` equivalent exists. Each read is
`[THIS.GetCountry.<Function>|2]`. The whole budget is also in every save summary (§7½, §9).

### 3.6 Trade capacity — country-level, NO sub-country iteration

**`Market.GetCountryTradeCapacity(<country>.Self)`** — VERIFIED, reached from a country as
`THIS.GetCountry.GetMarket.GetCountryTradeCapacity(THIS.GetCountry.Self)`. Emitted on the `TRADE` line with trade-centre count and
levels (`v3tb_bld_tradecenter`, `v3tb_lvl_tradecenter`).

| 1836 | centres | levels | capacity | capacity/level |
|---|--:|--:|--:|--:|
| GBR | 12 | 46 | 490 | 10.65 |
| FRA | 12 | 27 | 278 | 10.30 |
| RUS | 8 | 21 | 208 | 9.90 |
| CHI | 1 | 40 | 360 | 9.00 |

Capacity per level is not constant (9.0–10.65): capacity reflects centres that are staffed, levels only what was built.

❌ `trade_capacity` is **not** a state-scope script-value keyword and `employment` is **not** a building-scope one — both returned 0.
`GetTradeCapacity` is **State** scope and `GetEmploymentPercentage` / `GetEmployeeCap` are **Building** scope, so neither can be read per
country without iterating. Trade capacity USAGE is not reachable on the log side at all; it is save-side, per state and per good (§7½).

### 3.7 Population / workforce — `population` (v6), VERIFIED

Line: `POP|<date>|<country>|<workforce>|<peasant workforce>|<slave workforce>|<dependents>|<mean state unemployment rate>|<total
population>`, inside the `country_state` pass. **Workforce + dependents = total population to within 0.03 %** in all three countries
probed (session `20260801_114934_pop-probe`), so the pop sweep sees every pop exactly once.

| 1836 | workforce | peasants | peasant % | employed % | unemp % |
|---|--:|--:|--:|--:|--:|
| Britain | 7 779 018 | 4 030 230 | 51.8 % | 47.0 % | 1.22 % |
| France | 10 387 977 | 6 839 529 | 65.8 % | 32.6 % | 1.54 % |
| Qing | 91 721 014 | 82 743 610 | **90.2 %** | 9.5 % | 0.30 % |

`GetInactivePopulation` came back within 4 110 of the dependents sum — effectively the same quantity; prefer `dependents`.

⚠ **`is_unemployed` DOES NOT EXIST, and its failure mode is the dangerous one.** `limit = { is_unemployed = yes }` returned **exactly the
unfiltered workforce total** (7 779 018 for Britain), not zero and not an error. **An invalid trigger inside a `limit` is silently
ignored, so the limit becomes a no-op and the script value returns the total.** The number looks plausible.

**Rule: sanity-check every limit-based script value against its unfiltered twin.** A filtered sum equal to the total is a failed filter,
not a result. (The working filters discriminate: peasants 4.0 M < workforce 7.8 M; `bg_manufacturing` 28 < 259 buildings;
`building_trade_center` 12 < 259.) `unemployed_workforce` failed cleanly, returning 0.

### 3.7.1 Field sources

The capital-scarcity measure: what share of a country's workforce sits in subsistence or idle rather than gainfully employed.

| field | source |
|---|---|
| total workforce | `every_scope_state × every_scope_pop { add = workforce }` (`v3tb_wf_total`) |
| peasant workforce | same, `limit = { is_pop_type = peasants }` (`v3tb_wf_peasants`) |
| slave workforce | same, `is_pop_type = slaves` (`v3tb_wf_slaves`) |
| dependents | `add = dependents` (`v3tb_dependents`) |
| **unemployment rate** | mean `state_unemployment_rate` over states (`v3tb_unemp_rate`) — see below |
| total population | `Country.GetTotalPopulation` |

Gainfully employed is derived: `workforce_total − peasants − slaves − unemployed`.

⚠ **There is NO unemployed-COUNT keyword.** `state_unemployment_rate` (state scope) is the only handle, so the rate field reproduces
**vanilla's own estimate** from `common/script_values/je_values.txt` (`mon_unemployment_estimate`) — the unweighted mean across states.
Vanilla's comment there says the trigger "is way off actual unemployment rate" and doubles it; **we do not double, and report the raw
mean.** Treat it as directional. A true count needs `State.GetNumUnemployedWorkingAdults`, a data function that cannot be summed inside a
script value — the `wages` metric logs it per state (`SW`, §5.1), and the save carries per-state slack labour (§7½).

### 3.8 War start and true bankruptcy

- **`on_diplo_play_war_start`** — a diplomatic play that actually became a war (`WARSTART`, with `initiator` / `target`). Distinct from
  `on_diplomatic_play_started`, which fires for every play including those settled without fighting.
- **Bankruptcy** has no on_action, so `events` adds `v3tb_bankruptcy_poll` to `on_monthly_pulse`: it polls the static modifier
  `declared_bankruptcy` (`common/static_modifiers/00_code_static_modifiers.txt`) and latches each country with a variable, so each
  declaration logs once:
```
every_country = {
    limit = { has_modifier = declared_bankruptcy  NOT = { has_variable = v3tb_bk_seen } }
    set_variable = v3tb_bk_seen
    debug_log = "…"
}
```
  The latch is cleared when the modifier goes.

---

## 4. Scenario calibration (v9)

Built to answer where the balance UI's scenario panel differs from the game's own 1836 market, and why.

### 4.1 The orders reconcile — and that gives a pop-free test of the building model ✅ VERIFIED

Measured on the British market, 1836.2.1, every good:

```
sell_orders = production + imports          (+ treaty goods_transfer INTO the market)
```

Exact on every good (fish 2100.35 = 2088.35 + 12; fabric 6064.24 = 5564.24 + 500). The one apparent exception, **wine** (sell 40.20,
production 20.20, imports 0.00), is the `goods_transfer` treaty article `extract_presets.ps1` carries as `nonsell.wine = 20`. So a
treaty transfer lands in **sell orders but not in `GetMarketImports`**.

The like-for-like comparison against the UI is therefore:

| UI quantity | in-game |
|---|---|
| building inputs + pop demand + `ADDBUY` | `buy_orders − exports` |
| building outputs + `ADDSELL` | `sell_orders − imports` |

⚠ The buy-side half is **inferred by symmetry** — that exports sit inside buy orders is not verified. The sell side is.

**Pops never sell**, so the supply side is a channel-pure test of the building model, and the demand residual after a verified building
model is pop demand. ⚠ That residual is the weaker route: `GetMarketBuyOrdersBreakdown` (§3.3) reads the split directly, and the residual
**flatters** whatever pop model it scores by absorbing building-side error (Belgium 14.6 % residual-scored against 23.0 % measured
directly, F23). Where the two disagree, believe the direct read.

### 4.2 What v9 adds — all verified except where marked ❌

| metric | what |
|---|---|
| `v3tb_bld_urban_center` / `v3tb_lvl_urban_center` | urban-centre count + levels per country (GBR 9 buildings / 89 levels) |
| `market_goods_scoped` | market sweep restricted to the spec's tags |
| `boot_dump` | market goods + `SCEN` from `on_game_started_after_lobby` — **the day-0 read**; the market is fully initialised at day 0 |
| `building_inventory` | `BINV`: one line per building, every country — type key, level, employment %, employee cap, state — on day 7 to keep its ~6 400-line burst off the day-0 tick; a `BINVC` marker per country; `THRU` per building |
| `scenario` | `SCEN` + `MKT` per country: urban-centre count and levels, people-weighted SoL and workforce per stratum, the country's market |

**Per-building fields:**

| call | |
|---|---|
| `THIS.GetBuilding.GetBuildingType.GetKey` | ✅ the type key |
| `THIS.GetBuilding.GetType.GetKey` | ❌ voids |
| `THIS.GetBuilding.GetExpansionLevel` | ✅ **this is the level** |
| `THIS.GetBuilding.GetLevel` | ❌ voids |
| `THIS.GetBuilding.GetEmploymentPercentage` · `GetEmployeeCap` · `GetState.GetNameNoFormatting` | ✅ |
| `THIS.GetBuilding.GetState.GetCountry.GetNameNoFormatting` | ✅ — the owning country inline, which `PREV` cannot give (it reaches the *state*, not the country) |
| `THIS.GetBuilding.GetThroughputBonusCurrent` / `GetThroughputBonusTarget` (`\|4`) | ✅ the realised throughput bonus, on its own `THRU` line (measured in session `20260802_190643`) |

`GetExpansionLevel` reconciles with the script-value level sum (8 logged GBR urban centres summed to 87 against `v3tb_lvl_urban_center`'s
89 over 9 buildings — one 2-level building lost to the ring).

**Pop standard of living:** `standard_of_living` works as a pop-scope keyword; `wealth` returns the same number; nested `add = { value = x
multiply = y }` makes a people-weighted mean possible; `pop_size` does not exist (weight by `workforce`). Cross-check: GBR's
people-weighted mean SoL 10.13 against `GetAverageSoLByPopulation`'s 10.23.

**Urban centres are why the building enumeration exists.** The game raises them from state urbanisation by an engine-side rule that is
**not in the game files**, so the scenario panel cannot compute them and the level count has to be measured.

⚠ **Duplicate script-value keys are a silent override.** `v3tb_wf_peasants` / `v3tb_wf_slaves` already exist, so the per-stratum
denominators are named `v3tb_swf_*`. Two files defining one key would let a probe file quietly redefine a production metric.

⚠ **A verified value must MOVE out of the probe file, not be copied.** `zzz_v3tb_probe_values.txt` is emitted only when a probe metric
asks for it, so a production schedule with no probe gets a mod without those script values — and `MakeScope.ScriptValue` on a missing
value returns **0** (every country logged SoL 0 in session `20260802_111721` for exactly this reason). Graduated values live in
`New-TelemetryScriptValues`. **When a probe graduates, move it.**

### 4.3 The early read

The scenario preset is derived from the history files, the start state before any AI acts, so the earliest readable market is the most
comparable. **`on_monthly_pulse` is the finest pulse vanilla has** (there is no weekly one). Results:
1. **day 0** — `on_game_started_after_lobby` (`boot_dump`): works; the market is fully initialised. Day 0 → 1836.2.1 already moves the
   industrial inputs (British iron buy orders +25.7 %, small arms −17.3 %, engines +13.7 %) as the AI's construction queue fills.
2. **day 7** — a scheduled `trigger_event = { id = … days = 7 }` from the game-start hook: works, and is the only way to reach a
   non-month-boundary date (it is why the builder emits an `events/` file).
3. **1836.1.1** — a monthly pulse on the start date never fires (§5.8).

---

## 5. Wages, pop income and the workforce ratio — `wages` (v10)

Built to measure the base wage the balance UI's profit arithmetic rests on, how wages and SoL move over a campaign, and the workforce
ratio (1 − dependent share). Probed in sessions `20260803_012437` (calls), `20260803_013054` (sizing and attribution) and
`20260803_013903` (the assembled metric). The wage level itself is now read from the saves (§9); this metric's log-only value is the
per-state wage, the per-pop income split and per-stratum SoL.

Lines, all in phase 0 (§5.5):
- `WC|<date>|<group>|<country>|<market>|<pop objects>|<states>|<total population>|<mean SoL>` — per country of the market, one line each;
- `SW|<date>|<group>|<country>|<state>|<average annual wage>|<subsistence working adults>|<unemployed working adults>` — per state;
- `WSTR|<date>|<group>|<country>|<workforce>|<dependents>|<total population>|<mean SoL>|<SoL and workforce for upper, middle, lower,
  peasants, slaves>` — per country of each deep group (lead + subjects);
- `PW|<date>|<group>|<anchor>|<country>|<state>|<pop type id>|<workforce>|<dependents>|<total size>|<SoL>|<income>|<workforce income>|<dependent
  income>|<expenses>` — per pop of the deep groups, endpoint dumps only (§5.7, `wage_pop_endpoints`). ⚠ **Never de-duplicate `PW` lines**:
  two pops with identical values emit byte-identical lines, and collapsing them destroys the distribution;
- `WMKT` start / `ABSENT` markers per tracked tag.

Deep groups come from the spec's `wage_pop_markets` (group → successor chain; default `BEL = [BEL, NET]`, `AUS = [AUS, GER]`): the first tag
that still exists anchors the sweep.

### 5.1 Wages live on the STATE, not the country

| call | scope | |
|---|---|---|
| **`GetAverageAnnualWage`** | **State** | ✅ the budget-panel figure. Belgium 1836: Wallonia 3.14, Flanders 1.98, Belgian Gelre 0.42 |
| `GetAverageAnnualWage` | Country | ❌ **VOIDS** — there is no country-level wage |
| `GetNumSubsistenceWorkingAdults` | State | ✅ Flanders 391 050 |
| `GetNumUnemployedWorkingAdults` | State | ✅ Flanders 14 352, Wallonia 0 |
| `GetState.GetCountry.GetNameNoFormatting` | State | ✅ — a state names its own country inline, so the state sweep needs no marker-order reconstruction |

A market's average wage must be built up from states — the shape of the quantity: Belgium's three states span 7.5× at the start.

### 5.2 Pop income — VERIFIED, and it decomposes exactly

All on **Pop** scope. Measured on one Belgian machinist pop (workforce 500):

| call | value | |
|---|--:|---|
| `GetIncome` | 84.2477 | weekly, total |
| **`GetWorkforceIncome`** | 65.4832 | **the wage** |
| `GetDependentIncome` | 18.7644 | |
| `GetExpenses` | 81.3864 | |
| `GetMoney` | 2.8612 | net |
| `GetNumWorkforce` / `GetDependentsSize` / `GetTotalSize` | 2000 / 6000 / 8000 | |

Identities hold **exactly**: `GetIncome = GetWorkforceIncome + GetDependentIncome` (84.2477 = 65.4832 + 18.7644), `GetMoney = GetIncome −
GetExpenses`, `workforce + dependents = GetTotalSize`. `PW` emits `GetIncome` beside its two parts (a cross-check) and omits `GetMoney`.

❌ **Voids or useless:** `GetWorksAt.GetBuildingType.GetKey` voids (use `GetBuilding.GetBuildingType.GetKey` — a Belgian machinist reads
`building_arms_industry`). `GetSocialClass` resolves but returns **empty**. `GetPopType.GetKey` voids.

⚠ **`GetPopType.GetName` resolves but returns a ~90-byte tooltip blob** (`tooltippable_name tooltip:dw_948111401,CK841UIDAAA=,
DATA_POP_TYPE_NAME_TOOLTIP,PopTypeTooltip machinists! Machinists!!`), not a key. So the type is emitted as a **small integer** via the
`v3tb_poptype_id` script value (`is_pop_type` chain; 0 = a type the list does not know). The order in `Get-WagePopTypes` **is the on-disk
encoding — append only**; inserting a type silently re-labels every session already recorded.

### 5.3 Whole markets can be enumerated — `market = c:TAG.market`

`every_country = { limit = { market = c:BEL.market } }` **works** and filters rather than silently becoming a no-op: it returned **Belgium
alone** for the Belgian market and **Austria + Hungary + Croatia-Slavonia + Transylvania + Krakow** for the Austrian. (Vanilla uses `market =
ROOT.market`, never a `c:TAG` right-hand side, so this needed probing.)

⚠ **The Netherlands is `NET`, not `NED`.** `c:NED` reports ABSENT in 1836 for a country that plainly exists — the silent-empty failure in
its purest form (L11). `GER` correctly reports ABSENT in 1836, which exercises the successor path.

### 5.4 SIZE a per-pop sweep with a script value, never by counting its own lines

`v3tb_popobj_count` (`every_scope_state = { every_scope_pop = { add = 1 } }`) is one line per country and is the number of `PW` lines that
country will emit — the completeness check **for the very lines whose truncation it guards against**. Counting the sweep's own output
measures the truncation (181 Belgian pops against a true 187). Measured 1836 sizes:

| market | pop objects | states |
|---|--:|--:|
| Belgian | 187 | 3 |
| Austrian | 895 | 27 |
| British (65 members) | ~3 400 | 136 |
| Russian | ~1 633 | 96 |
| all 8 tracked | ~9 800 | ~410 |

⚠ **A cross-session line is not a cross-session bug — it is the ring.** One run's folder held 976 Belgian pop lines stamped with an
earlier session's token. **Any per-pop analysis must filter on the run's own token from `meta.json`** (`tools/testbed/analyse_wages.sh`
does).

### 5.5 ⚠ Phases were actively WRONG here — one dump, one tick

When Austria's per-pop sweep ran a month after its `WC` line, it returned **549 pops against the 504 the `WC` line counted** — not log loss:
**pop objects are created as pops migrate and promote, ~10 % of them within a single month.** The completeness check compared two
populations and could never come out equal, and a state's wage sat a month from the pops earning it. In a single phase, four of six
countries matched **exactly** (Austria 504/504, Croatia-Slavonia 60/60, Krakow 21/21, Transylvania 82/82), with ~0.4 % residual loss.

**Rule: phase to avoid a burst, but never phase apart two quantities that must be read at the same instant — and a completeness check
is always one of those.** The whole `wages` metric therefore rides phase 0.

### 5.5b ⚠ NEVER divide a MARKET quantity by a COUNTRY quantity

A scope-pairing rule for **analysis**. `market_goods` logs **per MARKET**; `country_state` and `population` log **per COUNTRY**. A market
spans every subject without its own market plus customs-union partners, so **market orders ÷ one country's population is a category
error** — it inflates any per-capita figure by the ratio of market members to that country. GBR is only the worst case (its Indian subjects
put most of the British Market's population outside the country), not a special one.

The `GDP` line's **last field is the country's MARKET NAME**, so countries can be grouped into their market and summed:

| numerator | denominator | valid? |
|---|---|---|
| country GDP | that country's population | ✅ |
| market orders | Σ population of that market's member countries | ✅ |
| Σ GDP of a market's members | that market's orders | ✅ — the only correct way to compare the two |
| market orders | one member country's population | ❌ |

⚠ Membership **changes over a campaign** (annexation, subject grants, customs unions), so regroup **per dump**, never at 1836 (§5.6).

### 5.6 ⚠⚠ "The whole market" is NOT a bounded scope — pin per-pop sweeps to lead + subjects

`market = c:BEL.market` filters correctly (§5.3) and is **unbounded over time**, because which market a country belongs to changes. In
session `20260803_014037_wages-n3`: at 1836.2.1 it meant Belgium alone (178 pops expected, 177 survived); at 1850.1.1 it meant the British
Market with 65 members (**20 686** expected, **5 212** survived). **A 75 % loss is not a sample**: which lines survive is decided by ring
position, so the survivors are biased in an unknown direction, and every line present is individually valid (L3).

**Fix: scope per-pop sweeps to the lead country AND ITS SUBJECTS**, keeping the market test as a guard:

```
limit = {
    market = c:%TAG%.market
    OR = { this = c:%TAG%  is_subject_of = c:%TAG% }
}
```

The market test stays because an invalid trigger in a `limit` is silently ignored (§3.7): had `is_subject_of` not resolved, the limit would
have swept all ~285 countries (~100 k lines); with the verified market test present the failure degrades instead. And lead + subjects is
the better unit: a trajectory needs a fixed economy across a century.

⚠ **When testing a filter, pick the case where the two hypotheses differ.** BEL and AUS cannot verify this one (at 1836 their market *is*
lead plus subjects). Probe `20260803_021616` used **BIC**, inside the 3 242-pop British market with its own subject tree: the filtered
sweep returned 1 696 pops across its 45 Indian subject states, correctly excluding Great Britain, the Cape, Ceylon and Canada.

The whole market stays observed through `WC` and `SW`, which cost one line per country or state.

### 5.7 ⚠⚠ A MID-RUN dump has a hard size budget: ~1 500 lines, and no recovery

A channel limit that applies to **every** heavy metric on a long run. Session `20260803_022027_wages-n3`, run 1:

| dump | lines emitted in the tick | pops logged / expected | |
|---|--:|---|---|
| 1836.2.1 | ~1 529 | **1 039 / 1 039** | complete ✓ |
| 1850.1.1 | ~3 400 | 115 / ~2 176 | **5 %** |
| 1865.1.1 | ~3 400 | 473 / ~2 500 | **19 %** |

**It is a threshold, not a gradient.** A dump is written in one tick; the ring is 5 × 512 KB, so ~1 500 lines (≈200 KB) fit inside a
segment while ~3 400 (≈440 KB) fill one and rotate mid-burst, and the live mirror loses what rotated.

⚠⚠ **The ring-snapshot rescue does not apply to a long run** (*The log channel* above): it recovers only what is still in the ring at
exit. After a run to 1935 the ring holds the 1930s, so **a mid-run dump in a century campaign is unrecoverable** — and unrecoverable as a
*biased* subset.

**Design rule: put the trajectory on cheap lines and the distribution at the endpoints.** Every dump: aggregates only (`WC`, `SW`,
`WSTR`, ~800 lines). First and last dump: the full per-object sweep — the first is proven complete, the last is close enough to exit that
the ring snapshot still holds it. Verified in probe `20260803_025834` (the middle dump emitted 70 `WC` + 164 `SW` + 6 `WSTR` and zero
per-pop lines). A century batch sharing phase 0 with market goods uses `wage_pop_endpoints: none` (the 1935 sweep, ~4,875 lines, is the
measured-unsafe case) and takes the per-pop distribution from a dedicated 1836 probe.

**Loss concentrates at the HEAD of a big tick.** On a ~1 600-line 1836 dump emitted WSTR → WC → SW → PW: `WSTR` 0 of 6 captured, `WC` 60 of
~90, `SW` 310 of ~400, `PW` 1 076 of ~1 090. **Emit the small, load-bearing lines LAST** when a tick is large.

⚠ **A country is not a stable observation target across a century.** Austria went from 20 750 355 people in 1836 to 1 225 974 by 1850,
having lost Hungary, Croatia-Slavonia, Transylvania and Krakow; the successor chain fires only when a tag ceases to exist entirely. Carry
population and pop-object counts beside any trajectory so a collapse is visible rather than read as an economic result.

⚠ `market_goods` is ~5 300 lines a dump, so the same budget applies to it: read `integrity.partial_dumps` before analysing a long run.

### 5.8 A 1836.1.1 dump NEVER FIRES

`on_monthly_pulse` does not tick on the start date, so a dump requested at `1836.1.1` produces nothing. **The earliest usable monthly
dump is 1836.2.1**; the start state is read with `boot_dump` (§4.3). `Read-TelemetrySpec` also rejects any dump date that is not the 1st
of a month.

---

## 6. Technology acquisition, as an EVENT — `tech_log` (v11), VERIFIED

`tech_log` emits one line the moment any country acquires any technology:

```
V3TB|<token>|TECH|<country>|<date>|<technology display name>
V3TB|20260805_132101s001|TECH|Oregon|January 1, 1836|Egalitarianism
```

Hook: **`on_acquired_technology`** (a vanilla code on_action; `Root` = the country, `scope:technology` = the technology acquired), merged
through the append form `on_acquired_technology = { on_actions = { v3tb_ev_tech } }`. The emitted effect:

```
debug_log = "V3TB|<token>|TECH|[SCOPE.GetRootScope.GetCountry.GetNameNoFormatting]|[TimeKeeper.GetCurrentDate.GetString]|[SCOPE.sTechnology('technology').GetNameNoFormatting]"
```

**Why event-driven, not sampled:** snapshotting who holds what would be ~200 countries × ~180 technologies per date and still only as
precise as the grid; the event costs one line per real acquisition and is exact to the day. The 1836 start alone fires ~1 800 lines (every
country's starting technologies). The yearly held set is also in every save summary (§7½); keep `tech_log` where day precision matters.

### 6.1 The accessor, and what does NOT work

No vanilla localisation uses `scope:technology`, so this took two probe runs (`20260805_131202_techlog-probe`, `20260805_131733_techlog-probe`).

| expression | result |
|---|---|
| `SCOPE.sTechnology('technology').GetNameNoFormatting` | ✅ `Enclosure`, `Standing Army` — **use this** |
| `SCOPE.sTechnology('technology').GetName` | ⚠ works, but returns the tooltip markup wrapper |
| `SCOPE.sTechnology('technology').GetKey` | ❌ *"Could not find data system function 'GetKey'"* — the scope resolves, the method does not exist |
| `SCOPE.sTechnologyType('technology').GetKey` | ❌ |
| `SCOPE.GetTechnology.GetKey` | ❌ *"Could not find promote for 'GetTechnology'"* |
| `SCOPE.GetRootScope.GetCountry.GetNameNoFormatting` | ✅ the acquiring country |
| `TimeKeeper.GetCurrentDate.GetString` | ✅ `January 1, 1836` |

⚠ **It yields the DISPLAY NAME, not the key.** A consumer that needs `combustion_engine` must map through the game's localisation; re-check
the mapping after a patch that renames a technology.

⚠ **Probe each candidate on its OWN LINE first**, and merge only once every function resolves: had all four fields shared a line, one
failure would have produced nothing at all and looked like the on_action not firing.

---

## 7. The savegame — the second instrument, and the right one for STATE

Telemetry is a keyhole: a metric must be expressible as a data function, must survive the scope's limits (§3.3.0), and lands in a
rotating ring that truncates. **A savegame is the whole world state at one instant**, written anyway by the autosave the harness
configures. **Use the save for STATE, the log for PROCESS**: a save cannot show a trajectory, an event, or anything between autosaves.

### Melt the save — never hand-decode

**`rakaly melt --format vic3` converts the whole binary save to plaintext with real field names** in about two seconds (a 45.5 MB `.v3`
becomes ~316 MB of text). The summariser streams it (`-c`, nothing on disk):

```
tools/vendor/rakaly/rakaly.exe melt --format vic3 --unknown-key stringify -o <out>.txt <save>.v3
tools/vendor/rakaly/rakaly.exe melt --format vic3 --unknown-key stringify -c <save>.v3 | node tools/testbed/save_state_summary.mjs - --out s.json
```

**Dependency:** the [rakaly CLI](https://github.com/rakaly/cli), release **v0.8.19**, asset `rakaly-0.8.19-x86_64-pc-windows-msvc.zip`
(2 035 299 bytes), unpacked to `tools/vendor/rakaly/`. It is **gitignored, not committed** — a third-party binary, not ours to
redistribute. Re-fetch with `gh release download v0.8.19 --repo rakaly/cli --pattern '*windows-msvc.zip'`. ⚠ Its README lists only
EU4/CK3/HOI4/Imperator; **`--format vic3` is supported anyway** — check `melt --help`, not the docs. Built on
[jomini](https://github.com/rakaly/jomini); tokens are compiled into the release, so nothing needs extracting from the game executable.

### The format, for the record

| Region | Contents |
|---|---|
| bytes 0–23 | ASCII header, e.g. `SAV0103316c71b10000049b\n` |
| bytes 24–1202 | metadata in Clausewitz binary — country, government, DLC, game rules, **mod name** |
| byte 1203 → EOF | a ZIP with exactly one entry, `gamestate` |

A 1925 autosave is 45.5 MB and inflates to 259 MB, so everything downstream must stream. The gamestate is binary-tokenised: little-endian
uint16 tokens, a few structural (`0x0001 =`, `0x0003 {`, `0x0004 }`, `0x000C` int32, `0x0014` uint32, `0x000D` fixed, `0x000E` bool,
`0x000F`/`0x0017` string, `0x0167` int64, `0x0290` fixed64), the rest field names whose table ships in the executable. **There is no
text-save option** (no `save_as_text` / `plaintext` flag in the exe, no save-format key in `pdx_settings.json`).

The hand-written binary readers (`save_extract.mjs`, `lib_savebin.mjs`, `save_survey.mjs`, `save_dump_records.mjs`, `save_pops.mjs`,
`save_summary.mjs`, `save_market_goods.mjs`) were **removed on 2026-10-28** (in git history): `rakaly melt` does everything they did, and
`lib_savebin.mjs`'s brace depth drifted after ~104 MB, a known jomini format quirk ("hidden objects" — containers the byte stream implies
rather than braces). **Melt every save.** The pop-record tokens those readers used, as the melt names them (kept for reading old findings):

| token | field |
|---|---|
| `0x00e1` | `type` (profession) |
| `0x2fd5` | `workforce` |
| `0x573a` | `dependents` (not "pop size") |
| `0x2819` | `location` (not "state") |
| `0x330b` | `assimilation_culture` (not "workplace building") |
| `0x5f73` | `political_movement_support` |
| `0x5afb` | `interest_group_support_data` |
| `0x27dd` | `culture` |
| `0x27e3` | `religion` |
| `0x5556` | `wealth` |

⚠ Total population is **`workforce + dependents`** (1 923 896 283 in a 1925 save; the workforce ratio 0.257, essentially
`WORKING_ADULT_RATIO_BASE` 0.25). A total that looks right is not confirmation: a wrong token guess once gave 1.43 bn, a plausible 1925
world.

### What is and is not in a save

- **Every building, with its realised recipe**: `building_manager.database.<id>` carries `building`, `levels`, `state`, `input_goods={
  goods={ <idx>={ value=X  prestige_goods={a b c} } } }` and the matching `output_goods`. `value` is a QUANTITY in units, not money (F74).
  Summed per market this gives supply, non-pop demand and the prestige share of supply (`melted_building_goods.mjs`, validated against
  telemetry at a mean 8.3 % on production; the residual is market membership). Also `cash_reserves`, `profit_after_reserves`, `staffing`,
  `goods_sales`, `goods_cost`, the active `production_methods`, and a subsidised flag.
- **The pop-need purchase weights**: `states.database.<id>.pop_needs.<CULTURE id>.pop_need_entry_data[need].weights{ <good idx> =
  <purchase weight> }` — the game's computed weight per state, culture, need and good (888 states × 15 needs in a 1925 save;
  `melted_pop_need_weights.mjs`). The stored weight sits on the value the rule computes from the same gamestate's supply, with no lag
  (F40): a debut good's gradual onset is its supply growing.
- **Culture obsessions** as runtime state (`0x5501 = { "luxury_furniture" "automobiles" … }`); reading the 1836 file instead put a 1925
  culture 220 pp wrong (`melted_cultures.mjs`). The game's internal name for English is `british` (index 15); `scottish` is 289.
- **Per pop**: `workforce`, `dependents`, `wealth`, `wealth_progress`, `previous_quality_of_life`, `num_literate`, `qualifications`,
  `workplace`. **Per-pop consumption is not stored** (the only candidate field, `0x5f73`, holds 2–8 entries — interest groups, not ~35
  goods).
- **The pops the game's panel shows are display-time aggregations**: of five pops read in-game, one matched a save record on profession,
  culture, religion, wealth and size.
- **The 177 `consumption_tax` blocks are the AI's tax evaluation**, not consumption: `{ type=consumption_tax goods="<good>"
  direction=increase_spending country=<id> priority={ priority=must_have score_before_random=A score=B } cost=100 valid=yes|no }`.
  The removed `save_market_goods.mjs` reported these under a market name; they are not market data.
- ⚠ **THE MARKET ORDER BOOK IS NOT IN A SAVE AT ALL.** The market database holds only `owner` per market; orders are recomputed on load.

⚠ **A record id carries a GENERATION prefix once its slot has been reused** (`slot + k·2^24`: a Kaffa textile mill read `16785323` = 2^24 +
8107 at 1866), and every handle to it — a pop's `workplace`, an owner reference — carries the same prefix. **Never reduce an id modulo
2^24**: a reader that did joined every first-generation building and lost every worker of a reused slot, harmless at 1836–1838 and wrong
by 1866 (F184 §4; `tools/testbed/ledger/craft_fill.mjs` joins on the full id). Country ids carry it too (`50332209` = 3·2^24 + 1073).

---

## 7¼ — The game rules are recorded (summary v4)

Every save summary's `world.game_rules` carries the rule settings the run was played under (fifteen in 1.13). **`pop_consolidation` is
the one that matters for interpretation**: the player's fidelity-versus-performance dial, it decides how many POP RECORDS the world holds,
and pop records — not people — are what the engine iterates per tick. A session on a different setting is not comparable to one on the
default. The observer sets no rules, so every batch runs the default (`moderate_consolidation`); read it off the save, never off intent.

---

## 7⅜ — Wall clock: the data sources

How the wall clock is graded, the run clusters, the slowdown quarantine and what a report contains are TESTBED_OPERATIONS §7. The grade
is the raw total a player waits through; the pop-matched figure is a diagnostic. Nothing extra is instrumented — every batch already
writes what the wall clock needs:

| quantity | where | reader |
|---|---|---|
| the century's play time | `<run>/run.log` tick lines — elapsed wall and in-game date every ~20 s per attempt | `ledger/lib_wall.mjs` (default of `report_perf.mjs`), `ledger/wall_from_ticks.mjs`, `run_timing.mjs` |
| total run time | `<run>/meta.json` → `wall_seconds` (every attempt; `wall_seconds_prior` / `_this_launch` for a continuation), `attempt_log[]` | `report_perf.mjs --wall meta` |
| in-game date reached | `meta.json` → `reached_ingame_date` against `until_date` (L17) | `lib_runs.usableRuns` |
| per-year wall clock and world size together | `<run>/save_summaries/` FILENAMES `NNNN_yyyymmdd_HHMMSS_autosave…` + each summary's `world.pop_objects_live`, `world.gdp`, `world.buildings` | `ledger/report_perf.mjs` |
| sub-tick costs | `logs_live/dedicated_server.log` | `ledger/tick_profile.mjs`, `ledger/tick_overhead.mjs` |
| slowdown episodes | the tick lines; v16+ summaries' `formations` | `ledger/wall_clusters.mjs`, `ledger/slow_episodes.mjs`, `slow_quarantine.mjs` |
| machine load | `<session>/machine_load.tsv` | `ledger/machine_load.mjs` |

Rules for the pop-matched diagnostic:
- **Compare seconds per in-game year at equal world size, never at equal date or in total**: the raw total can invert the answer when an
  arm simulates a smaller world (F71: ×0.86 of vanilla's total for a world with ×0.65 the pop objects, −2.5 % pop-matched). Which size
  measure predicts tick cost is fitted in F72 / F120 (pop objects, with building levels or GDP as a size proxy).
- **Use `pop_objects_live`, not `population` and not `pop_objects`**: people are not what the engine iterates, and ~17 % of records hold
  nobody (§7½).
- **Valid only within one `pop_consolidation` setting** (§7¼) — check `world.game_rules` matches across arms.
- **Ratios within one night survive; absolute minutes across sessions do not** (machine load, thermal state, a patch). Compare against the
  same days' vanilla.
- Drop an interval that spans a **resume** (it contains the crash and reload). The filename stamp is the source autosave's last-write time
  (`archive_autosaves.ps1`), i.e. when the engine finished writing it.

---

## 7½. The savegame harvest — the instrument, and what a summary carries

Every autosave of every run is archived, melted, summarised and reaped automatically, so a batch produces a yearly per-country state
series beside telemetry's handful of dump dates. CLAUDE.md §5.5 says how it fits into a run; REPO_GUIDE §4 has each tool's flags.

### The pipeline

- **Stage A — archive** (`tools/testbed/archive_autosaves.ps1`, concurrent with the game). Copies each autosave once it is size-stable to
  `<run>/saves/NNNN_yyyymmdd_HHMMSS_<autosave file name>` (the stamp is the source file's last-write time), de-duplicating on
  (length, mtime) because the engine rotates its slots by renaming.
  ⚠ `Copy-Item` is not atomic: it copies to `<name>.v3.part` and **renames into place**, so a `.v3` in that folder is complete by
  construction and the `.part` suffix keeps it out of the queue meanwhile.
- **Stages B–D — melt, extract, reap** (`tools/testbed/harvest_saves.ps1`, wired into `run_schedule.ps1`, run concurrently with
  `-Watch` so a save is summarised and deleted minutes after it is written (user ruling, 2026-08-11), and again as a final synchronous
  drain after every run; a dead watcher costs time, nothing else). Each save is melted straight
  into `save_state_summary.mjs`; the summary is written to `<stem>.partial.json.gz`, **verified** (gunzips, parses, carries
  `save_summary_version`, `provenance.date` and ≥ 10 countries) and renamed to `<run>/save_summaries/<stem>.json.gz`. The queue is "saves
  with no summary yet", so the pass is idempotent; a failed save is never retried in the same pass and never reaped (it keeps a `.err`).
  ⚠ Readers must not glob `*.json.gz` and pick up `*.partial.json.gz` (L25).
- **Reaping.** Once saves are reaped **the summary is the record** (everywhere else the raw log is the record and a summary is a cache), so
  the schema is generous by default and the reaping is guarded: each run's **newest save is kept permanently** as the escape hatch for
  questions the schema did not anticipate (summarised and kept; L12 checks it post-run); every other save is put to the slowdown
  quarantine judge (`slow_quarantine.mjs`, TESTBED_OPERATIONS §7.6), which keeps saves around a slowdown in `<run>/quarantine_saves/` and
  releases the rest for reaping. `harvest_saves.ps1 -NoQuarantine` reaps at once and `-NoReap` reaps nothing; the scheduler's
  `-KeepSaves` keeps every save (~16 GB a run), `-NoSaveHarvest` turns the instrument off and `-HarvestWorkers 0` drains between runs
  only.
- **Provenance.** The scheduler writes `<run>/save_provenance.json` (session, label, run index, setup, arm kind, `built_from_config`,
  token, until), merged into every summary's `provenance` beside its source file, in-game date and reader — a summary outlives its save, so
  it says what it came from without a lookup.

### The cost

Measured on a 56.9 MB 1935 gamestate (20 logical cores): `rakaly melt` to disk 2 s; **melt streamed into the single-pass reader 5.0 s,
nothing on disk**. A quarterly autosave arrives every 15–35 s of wall clock, so one worker keeps up and four drain a century in ~8 minutes
(F50). The concurrent harvester does not slow the game measurably: in-game days per wall second in ticks with a save being melted against
idle ticks, to 1860, read 5.24 / 5.17 (mod) and 5.69 / 5.59 (vanilla) (F217 §1). A summary is ~2.2 MB raw, ~10 % of that gzipped.

### What an autosave costs

The save stall is measured from the per-tick log: ~0.9 s per save in vanilla and ~1.1 s in the mod (F217 §1), landing on hour 0 of the save
day — in per-tick means from 1900, quarter-start hour 0 reads 1.94 s against 0.34 s on other month starts (F218). ⚠ A yearly autosave fires on **1 January**, which is
also when `on_yearly_pulse` runs, so comparing tick windows with and without an autosave measures January, not the save. What a whole
cadence costs a batch beyond the stall is **not measured**; the identifying design is two cadences, not one run's tick log —
`tools/testbed/schedules/autosave_cadence_vanilla.json`, n=2 vanilla-yearly against n=2 vanilla-quarterly, interleaved: both arms run the
same ~100 yearly pulses and differ by ~300 autosaves, so `(mean quarterly wall − mean yearly wall) / 300` is the cost of one save as we take
them, archiver included (a third arm with `-NoSaveHarvest` would separate the archiver). Not yet run. Schedules use **yearly** saves:
every reader expects the 1 January series, and a wall-clock batch must compare like cadence with like (TESTBED_OPERATIONS §2.2).

### What the summary carries

Top level: `save_summary_version`, `provenance`, `not_captured` (below), `world`, `countries`, `states`, `top_producers`.

**`countries`** — one entry per country record, keyed by the definition TAG for the main record and **`TAG@<country id>`** for every other
record of the same definition (summary v12: a civil war's other side, `civil_war: true`; a country a revolt left behind; the second of two
`is_main_tag` records, where the most populous main keeps the plain TAG). Read `c.tag ?? key.split('@')[0]` for the definition; a pool
member is the plain TAG. Each entry:

| block | fields | since | notes |
|---|---|---|---|
| identity | `id`, `tag`, `market`, `government`, `country_type`, `is_main_tag`, `civil_war`, `last_civil_war_date`, `overlord`, `own_market_pact` | v12 for the civil-war fields | `last_civil_war_date` is the save's field verbatim; whether it marks a war's start or end is NOT verified. `overlord` is a country key |
| headline | `gdp`, `prestige`, `literacy`, `avg_sol` | — | the last sample of each weekly TREND channel (the `gdp` sample predates the save by a few weeks) |
| money | `money`, `credit`, `investment_pool`, `base_wage`, `average_productivity`, `last_bankruptcy_date`, `weekly_expenses`, `weekly_income` | — | £ per employee per week = `base_wage` ÷ 10,000 (CLAUDE.md §2.10, F152); `last_bankruptcy_date` over a series gives bankruptcy frequency |
| budget | `building_budget`: `expense`, `income`, `expense_by_category`, `income_by_category`, `subsidies`, `subventions` | — | `subsidies` and `subventions` per building type, booked directly by the save (no deriving); `construction_goods` is the category telemetry's `CON` duplicated |
| people | `strata`, `professions`, `workforce_by_profession`, `pop_statistics` | — | profession index verified (below); strata: V3 counts **farmers as MIDDLE** and **clerks as LOWER** |
| technology | `technologies` (count), `technologies_held`, `researching`; `innovation`, `max_innovation`, `population_incorporated`, `spreading`, `progress_unheld` | v18 for the flows | innovation is not in the country record: it comes from the AI's snapshot `ai.database.<n>.spending_variables` (its last update, not a weekly mean); the cap reproduced exactly as 50 + 150 × `literacy` on the saves the field was built on (vanilla's levers; the canon's are x = 25, CLAUDE.md §4.1). `progressed_technologies` pools points from every source; stale entries for held techs are dropped. Tech SPREAD is in no save (reconstructed in F223). Acquisition DATES are telemetry's (§6) |
| law | `laws` (active law keys), `trade_policy`, `tariffs.{import,export}.<good>` | v11 | from the top-level `laws.database` (`active=yes` only); `trade_policy` = the active law of `lawgroup_trade_policy`, the group read live from `common/laws`. A tariff level is a FRACTION of the law's rate (`TARIFF_LEVEL_EFFECT_LOW` 0.25 / `_HIGH` 0.5 / `_MAXIMUM` 1.0 of `state_tariff_import_add`, 0.50 under the protective laws, absent under free trade); a good with no record has no set level (FINDINGS F161 §6) |
| pop records | `pop_objects`, `pop_objects_live` | v2/v3 | see *Pop objects* below |
| ownership | `foreign_owned_levels`, `owned_abroad_levels`, `companies`, `ownership_levels` | v7 for companies | ⚠⚠ the two `*_levels` count GOVERNMENT ownership only (owner identity = a country); private capital abroad runs through financial districts, company HQs and manor houses and is NOT in them (Britain reads 5–568 "owned abroad" at 1935 where the melted save, every owner resolved to its country, reads 3.8k–11.5k; F178 §2). For private capital abroad read the kept save's `building_ownership_manager` |
| buildings | `buildings.<type>` = { `n`, `levels`, `subsidised`, `subsidised_levels`, `profit`, `cash`, `staffing`, `va_out`, `va_in`, `goods_sales`, `goods_cost`, `taxes`, `salary_w`, `company_levels`, `pms` } | v6 `va_*`, v7 `company_levels`, v8 `pms`, v9 the ledger | `va_*` priced at BASE cost reproduce the save's GDP to 0.3 % (F74); `goods_sales` / `goods_cost` are at MARKET prices, so wages = `goods_sales − goods_cost − profit`, verified against the building panel to 0.38 % (F152 §9); `salary_w` = Σ(rate × staffing). `pms` = active method → levels, base and secondary alike (each method group's levels sum to the type's levels). Save buildings carry staffing but no headcount (§9) |
| goods | `goods_out`, `goods_in`, `prestige_out` | v8 for prestige | quantities in units |
| politics | `interest_groups.<ig>` = { clout, ps, rad, loy }; `ig_by_workplace` | v13, v14 | `ledger/ig_clout.mjs` back-fills pre-v13 runs from a kept save's 521-week `clout_trend` ring (ten years before each kept save; F190) |
| trade | `trade` = { `capacity`, `usage`, `goods.<good>.{imp, exp}` } | v10 | summed over the states the country owns; in capacity units — volume = capacity × `traded_quantity` × (1 + the trade-centre quantity multiplier, not in the summary) |
| military | `formations` (absent = none) | v16 | counts, Σ moves, Σ path length, loops — for the fleet-loop slowdowns (F218 §8) |
| construction | `queues.government/private` = { `n`, `left`, `speed`, `by_type` } | v5 | queue COMPOSITION, which script cannot see; ⚠ a queue element is an anonymous block holding a nested `identity={}` — close it on its own depth |

**`world`** — `buildings.<type>` (summed, incl. `pms`), `gdp` and `population` (over every country record — v≤11 summed the keyed map and
lost every dropped record; L38), `game_rules` (§7¼), `ig_order`, `pop_objects` / `pop_objects_live` / `pop_objects_empty` /
`pop_objects_unowned(_live)`, `companies`, `company_levels_unattributed`, `companies_unresolved`, `ownership_levels`, `trade` = { capacity,
usage }, `trade_goods`, `world_market_price.<good>` = { `last`, `mean52` } (v10), `formations` (v16: + `by_bucket`, `hist_moves`,
`supply_moves`, `worst`), `war_goals`, `treaty_port_goals`, `treaty_ports` (v19: goals of the ACTIVE plays only — a snapshot).

**`states`** (v8) — keyed by the save-internal state id (stable within a campaign; `region` is the durable key across campaigns):
`country` (the owner's key, null if unowned), `region`, `infrastructure`, `infrastructure_usage`, `trade_capacity`, `trade_capacity_usage`
(v10), `lab` = { peas, unemp } (v15), `res` = { building type: [levels, staffing, profit] } (v15; v17 adds the dam types), `dam_q` = { dam
type: { builder key: queued levels } } (v17, government and private queues together).

**`top_producers.<good>`** — `world` total and the **top 20** producing countries with quantities, every good including `local` ones (user
ruling 2026-08-11). The 319 summaries written before that ruling carry 15 and cannot be widened.

**Save-field notes that bite** (the melt's own layout):
- **Goods indices are POSITIONAL** in `common/goods/00_goods.txt` (0 = ammunition … 52 = fine_art): a patch that inserts a good shifts
  every later index. The reader resolves them from the game files; never hard-code one.
- **State trade per good** is `states.database.<id>.trade = { goods = { <goods index> = { value = <int> } } }`, **signed: + export, −
  import**; Σ|value| equals the state's `trade_capacity_usage` exactly (Louisiana 1901: 1,189 = 1,189; 175 of 183 states within 1).
  `traded_goods` beside it lists the same goods sorted by |value|; each sub-block also carries a `prestige_goods = { 0 0 0 }` triple; the
  block's closing brace is `\t\t\t}` at the state record's depth (F159 §1).
- **A state with zero usage OMITS `trade_capacity_usage`** (Clausewitz default elision): pair by adjacency and treat a missing partner as 0.
  `trade_capacity` also appears as a BLOCK elsewhere; require the scalar form. Capacity binds all century: world usage 90–98.5 % of
  capacity (F159 §2).
- **The world market price** is `market_manager.world_market.price_trend.channels.<goods index>.values` (the exe's
  `Goods.GetWorldPriceTrend`): a **52-slot RING BUFFER, one slot per WEEK** — `index` = weeks since 1836.1.1, the latest price at
  **values[(index − 1) mod 52]**, not the last element (`sample_rate=28` does not describe the spacing). An untraded good sits on its
  175 % ceiling.
- **Slack labour** (`lab`): a peasant pop, or any other pop with no `workplace`, is the state's slack labour; Σ over a country's states
  matches its `population_unemployed_workforce` within ~5 %. The resource CAPS are static (`map_data/state_regions`: `capped_resources`,
  discovered `resource` amounts, `arable_land`, `arable_resources`) and are read by the analysis (built for the valid-investment rule,
  F207).
- **Formations** (`military_formation_manager.database.<id>`): `country` (a country_manager id), `type` (army / fleet),
  `is_recalled_for_repairs=yes`, a typed `target_location={ type=state|military_formation|front|prov identity=<id> }` and
  `travel_progress={ path={ … moves={ { to_node … distance cost } … } cost= distance= } current_move= total_distance_progress= }`. A path
  whose length equals `total_distance_progress` for a fleet parked at its end is a loop. Ships (`ship_manager`) carry `fleet=`,
  `hit_points=` and a name-list `definition`. In v16 an owner's id can change between years: key on `owner_id` per year.

**`not_captured`** — every summary names what it deliberately leaves out, with where to get it: the market order book (not persisted —
telemetry, permanently); per-state goods flows (`melted_building_goods.mjs` on a kept save); pop-need purchase weights
(`melted_pop_need_weights.mjs`); cultures and obsessions (`melted_cultures.mjs`); technology acquisition DATES (`tech_log`); formation
paths in full (`fleet_loops.mjs`); a state's trade advantage and local goods prices (not persisted — a rung's realised price is
`goods_sales ÷ va_out` per building type). For the trade advantage, log-side candidates exist and are **unprobed**: the exe registers
`GetMarketImportAdvantage` / `GetMarketExportAdvantage` / `GetMarketRelativeImport…` / `…Export…Advantage(Desc)` in the same Goods block as
`GetMarketBuyOrders`, so `[THIS.GetMarketGoods.GetGoods.GetMarketImportAdvantage|2]` could ride the `G` line inside `every_market_goods`
(vanilla's GUI reaches the market figure as `Market.GetImportAdvantage(Goods.Self)`, `goods_world_market_panel.gui`; it is an average over
the market's states, loc `MARKET_RELATIVE_IMPORT_ADVANTAGE_TOOLTIP`). The state figure and the local prices need state context —
`GetStateRelativeImportAdvantage`, `GetStateImportPrice`, `GetStateExportPrice` (`building_details_panel.gui`, `goods_state_panel.gui`) and
`GetStateImportAdvantage` (string pool only); there is no `GetStateGoods`, so the candidate route is `GetGoods('<good>').WithStateContext(
THIS.GetState.Self)` (vanilla's form in `map_markers.gui`) with a literal good. ⚠ The same block holds `GetMarketBuyAndSellOrdersBalance`,
which voids (§3.3): membership of the block is not proof — probe fenced, one function per line, in its own on_action.

### Pop objects: total and non-empty are different numbers, and neither is "how many pops there are"

A pop object is a RECORD. Summary v3 stores both counts, per country and world-wide, so a regression can ask which predicts tick cost. On a
vanilla 1936 gamestate, **158 636 records, of which 27 534 (17.4 %) hold nobody** (stable across arms: 17.4 / 16.9 / 17.5 %); a further
2.0 % have dependants and no workers, a different thing (F50).
- ⚠ `<id>=none` freed slots sit in the same database (4 630 of them), so a record test must require the trailing `{` — without it the count
  ran 2.9 % high.
- ⚠ `workplace` is one of the identity dimensions (an iron mine and a coal mine in one state give two English Protestant labourer pops), on
  70 % of records; even (state, culture, religion, profession, workplace, wealth) leaves 7.2 % unidentified. **Count records; claim nothing
  about the tuple.** `workplace` is the building's full record id (§7).
- ⚠ The game's interface hides the empties (STATE_SLAVONIA stores 564 records and shows 280). Stored counts will not agree with the UI, and
  neither side is wrong.

### The pop table is otherwise not scanned — a verified shortcut

`pops={…}` is 8 M of the melt's 16 M lines. Each country record carries `pop_statistics.population_by_profession` indexed by pop type, and
**that index is alphabetical over `common/pop_types/*.txt` — verified**: summed world-wide the two sources agree to 0.03 % on all 15
professions. `--verify-pops` re-does the labelled scan and prints the comparison; the reader **throws** if the game ships a different
number of pop types than the save's own count prefix, so a patch cannot silently shift every index. (Likewise it throws unless
`common/interest_groups` holds the 8 files the IG-support index assumes.)

### The join between the two instruments needs TWO keys, and neither is the name

Telemetry names a country by display name (§3), and display names change mid-campaign (the country telemetry calls "India" is tag `BHT`,
Bhutan having formed India); a save names it by tag. **Population alone is not a key either**: across ~250 countries a coincidence inside
0.1 % is ordinary (Tripolitania @1930 joined to `PCO` at 0.08 % population agreement and +1 722 % GDP disagreement). So
`tools/testbed/verify_save_alignment.mjs` runs two passes, and the scored quantity is never one of its own keys:

| pass | join on | scores |
|---|---|---|
| A | population + **building count** | **GDP** |
| B | population + **GDP** | **building count** |

Where the passes assign different save countries to one telemetry country, the row is reported as unproven rather than scored. Population
tolerance is 5 % (safe only because of the second key). Measured on vanilla (11 shared dates, 272 of 275 joined): GDP |mean| 1.61 %,
buildings |mean| 1.05 %, median 0.00 % (F50); re-run on `20260815_153825_flatcost-n1`, GDP |mean| 1.87 %, buildings 0.65 % — **aligned**.
A residual of a few percent is expected: the save's `gdp` is a weekly trend sample a few weeks old, and a telemetry dump fires a phase after
its label. **The two instruments disagree most on countries that are changing hands** (GBR shed 11.5 % of its people in one year of the
F50 run) — a property of the world; check a per-country point against its neighbours in the series before calling it a trend. Run the
alignment before moving a state metric off the logs.

### What must never move off the logs

- **Events** — war, peace, default, bankruptcy, revolt, and technology acquisition DATES. A save shows what is HELD, never when it arrived.
- **The market ORDER BOOK**, which is not persisted at all.

---

## 8. Content log lines — not telemetry

The mod's own content logs to `debug.log` too. These lines are **not token-stamped**: a run's own lines begin at its `PM_TECH_REHAUL: init
OK … (build <ts>)` marker, because the mirror starts with whatever the shared ring held — a reader that counts from the top counts the
previous run's lines too. The country is the display NAME (no tag function exists), so a join across a country's formation (Prussia → the
North German Federation → Germany) must go by name history.

### The dam log lines

Emitted by `tools/emit_dams.mjs` in any build with `dams.enabled` (the canon), FINDINGS F168:

`PMR_DAM|<event>|<project id>|<country NAME>|<date>|bur <produced>/<used>`, for `survey_start`, `survey_month` (monthly while a survey
runs), `survey_stop`, `survey_complete`, `survey_ended` (the journal entry invalidated: cancelled, or the anchor left the chain), and
`family_survey` (a survey by the owner's family that opens the dam to the family — `dams.rules = family`, the canon; no bureaucracy field);
`built|…|level k/n` and `complete` (`on_building_built` / `on_building_expanded`, logged from the host's scope; no bureaucracy field); plus
`bur_year|-|<country>|<date>|bur …|surveys N building M` once a year for every country holding `electrical_generation` (M = dam levels under
construction in its own states), and `start|<n> projects|-|<date>` once at 1836. Probe builds (`dams.probe`) add `probe_*` lines
(`probe_can_build`, `probe_contest_seed`, `probe_sink`, `probe_grant`, `probe_laissez_faire`, monthly `probe_lvl` / `probe_q`,
`probe_release`, `probe_armed`, `probe_withdraw` — FINDINGS F176) and playtest builds `playtest_open`.

⚠ **Nothing logs WHO QUEUED a level**: the engine builds every level (BALANCE_FRAMEWORK §10.89.11), so there are no scripted stage or
financing lines (`stage_start`, `finance_*`, `gov_paused`, `gov_backlog` exist only in older sessions, which
`tools/testbed/ledger/dam_report.mjs` still reads). Who queued which dam is read from the save summaries: `states.<id>.dam_q` per builder
(v17) and `queues.*.by_type.building_dam_*` per country.

### The research-entry log lines

Emitted by `tools/emit_research_events.mjs` when `research_events.enabled` (the canon):
- `PMR_JE|<stage>|<tech>|<country NAME>` when a stage completes; the repeating implementation stage carries its count
  (`implementation<n>`);
- `PMR_JE|ind_fill|<tech>|<country>` for an extra entry's fill;
- `PMR_JE|placed_all|-|-` once, when script placement (`research_events.placement = script`, the canon) puts the first stages on the map;
- `PMR_JEH|<stage>|<tech>|<country>|<date>` when a stage completes on the HALVED mark (`research_events.follower_halving`, the canon:
  BALANCE_FRAMEWORK §10.97);
- `PMR_JEG|reduced|<stage>|<tech>|<country>` when a grant is reduced by `research_events.date_gate` (not set in the canon).

Count them per run with `tools/testbed/ledger/je_tally.mjs`, which de-duplicates — the mirror can re-copy chunks (L28), and a raw count
over-reads (L23).

⚠ **Every research bar is `monthly_progress`** — industry, war and naval alike — so a WAR entry's bar is identified only by the expiring
country variable it reads, `pmr_wargate_<tech>` (set by `on_monthly_pulse_country` in `zzz_pm_rehaul_wargate.txt`), never by its cadence or
span.

---

## 9. Which metrics stay on the logs — the telemetry audit

The ruled criteria (user, 2026-08-15): (1) no metric may double-save what another already saves (cheap re-derivation is fine); (2) anything
reliably obtainable from savegame analysis moves there, subject to calibration — 99 %+ agreement with grace for read-date lag, **no
unexplained calibration factors**. The `*_probe` metrics are one-off diagnostics, exempt. The calibration that licenses the moves is the
two-key alignment (§7½: aligned).

| metric | verdict | why / where it went |
|---|---|---|
| `market_goods` / `_scoped` / `_wide` | **log-only, permanently** | the order book is not persisted. `_wide` runs in every run as the red-flag feed (§2.4½) |
| `origins` | **log-only, permanently** | no trade-route volume in a save (only per-state capacity per good, which gives volume but not the partner) |
| `events` | log-only | process, not state |
| `tech_log` | partial | summaries hold the yearly held set; keep `tech_log` where day precision matters |
| `country_state` | replaceable at annual cadence | kept in the standard batch for sub-annual reads and as the alignment's telemetry side |
| `population` | replaceable | summaries carry `pop_statistics` and professions; it is the alignment's join key |
| `treasury` | replaceable | money, credit, weekly flows and the budget by category are in every summary |
| `wages` | the wage LEVEL is save-side; the rest is log-only | F55 found the wage in every country record (`base_wage`); the audit still ruled `wages` log-only, because the factor between `base_wage` and F26's per-pop wage basis drifted ×6.4 over a century (`20260814_123646_vanilla-wages-century-n5`). F152 then gave `base_wage` its unit (£ per employee per week = `base_wage` ÷ 10,000, matching F26 at 1840: GBR 0.0610); the wage model built on it reproduces the wage bill to ~1 % in the median from 1857 (CLAUDE.md §2.10), and the v9 ledger gives each building type's exact wage bill. Log-only: the state average annual wage (`SW`), the per-pop income split (`PW`), per-stratum SoL (`WSTR`) |
| `building_inventory` | partial | save building records carry staffing, levels and methods but **no headcount**; exact employment stays `BINV` (employment % × cap) or the pop-table `workplace` join. ⚠ Owed: a same-date `BINV`/save pair to calibrate staffing |
| `active_pms` | replaced | summary v8 `pms` (verified on a 1936 vanilla melt: 15,201 of 15,201 records carry the block) |
| `pop_sol` | replaceable, heavy | the melted pop table's `previous_quality_of_life` per pop record |
| `scenario` / `boot_dump` | partial | per-stratum SoL beyond `avg_sol` is log-side; the day-0 read is the point of `boot_dump` |
| `construction` (`CON`) | **retired from batch specs** | triple-saved: the same `GetConstructionGoodsExpenses` is in `CON`, in the `CQ` canary column and in every summary's `construction_goods` category |
| `construction_queue` (`CQ`) | probe / sub-annual tool only | superseded by summary v5 queues (composition per element, which script cannot see; validated on the calib2 melt: GBR private 4 elements / 656 left, JAP government 3 / 1011). ⚠ `CQ`'s canary: an all-zero queue beside a nonzero `GetConstructionGoodsExpenses` means the wrap failed (L6) |
| `state_access` (`SMA`) | partial | `market_access` is a database pointer in the save, not a value, so ACCESS stays log-side; infrastructure and usage are save-side since summary v8 |
| `consumption_breakdown` / `breakdown_sparse` | **save-side by ruling (user, 2026-08-16)**; the breakdown kept for validation runs | below |

**`consumption_breakdown`, the ruling.** The goal remains eliminating the divergence between the save reconstruction and the logged split.
If it cannot be closed, the documented residual (~5 %) is accepted rather than kept on the logs: the breakdown costs ~1.1 MB per tick per
market against a 2.5 MB ring, and melting is architecturally cleaner by orders of magnitude. **No compensation coefficients either way — a
residual is documented, never fudged.** The reconstruction: stored purchase weights × pop wealth and size × buy packages ÷ base price,
peasants ×0.05, every slave pop in the pop line at its own wealth, and the "purchased for slaves" line = employed slaves × the per-head
package (F61, `tools/testbed/slave_channel_ab.mjs`). Calibrated at vanilla 1840 (`20260815_233017_consumption-calib2`): spend-weighted
per-good error USA 6.1 % · GBR 5.0 % · FRA 2.6 %; over a century 1.6–6.8 % on ordinary markets (F63). The named candidates for the
remaining residual (Britain's poor-staples cluster at ×1.07–1.15, the colonial slave line at ×1.27–1.39) are exhausted. Keep the breakdown
as the validation metric on runs where a market has re-formed as a customs-union super-market, where the reconstruction fails (F63: the
summaries' `market` id shows it).
