# GLOSSARY — the internal terminology, in one place

**Why it exists** (user, 2026-09-19, after asking for hard bounds on "H" and meaning the world product): *"I got confused, which is mostly on me,
but we probably need an internal terminology cheat sheet."* So: one letter, one meaning, and where each is defined and computed.

⚠ **Rule 1 — a bare letter is only allowed if it is on this page.** If a new quantity needs a name, it goes here in the same pass.
⚠ **Rule 2 — where a letter and a phrase compete, the PHRASE wins in prose.** "world product" and "the pool's hoard" are always clearer than
"GDP" and "H"; the letters exist for tables and code, not for sentences.

---

## 1. THE MEASURED QUANTITIES (the criteria register, `tools/testbed/ledger/criteria.mjs`, BALANCE_FRAMEWORK §10.83)

| name | what it is | notes |
|---|---|---|
| **world GDP** / **the world product** | the combined GDP of **all countries** | ⭐ NO LETTER, deliberately — "GDP" is good enough and "W" is taken. In code `gdpW`. The register's priority-1 metric |
| **pool GDP** | the same, summed over the SHORTLIST POOL only | `gdpP`. ⚠ it is TOTAL pool GDP; the per-capita reading is printed beside it and is a different number |
| **W** | **productive workers per capita** = (salaried − government − military) ÷ Σ strata population | the depeasantation axis. NOT "workers", NOT "workforce" |
| **U\*** | **total unemployment INCLUDING peasants** = (unemployed + peasants) ÷ (salaried + unemployed + peasants) | the star is part of the name: plain "U" would read as the strict figure, which is a different number (world 16.3% against U\* 41.7% in vanilla) |
| **H** | the **investment-pool hoard ÷ GDP** | a stock over a flow. ⚠ vanilla's own H spans 0.56–1.93× between seeds, so it is *"hardly comparable with vanilla"* (user, 2026-09-19) and carries no vanilla-derived bound |
| **Y** | **GDP ÷ productive worker** | so that `W × Y` = GDP per capita. The productivity axis |
| **T0 … T3** | **workers in the tiered industries' era-0 … era-3 rungs** = Σ staffed levels × per-level employment × workforce_mult | keyed by the rung's ERA, from the run's own config. An industry starting at e2 contributes nothing to T0 |
| **PI** | the **building-input price index**: steel / tools / engines / fertilizer / explosives / dye / paper, median over the scoped markets of price ÷ base, ÷ vanilla's | falling = the design working |
| **PP** | the **pop-goods price index IN WAGE UNITS**: groceries / clothes / furniture / glass / fine art / automobiles / telephones / radios, ÷ the owner's base wage, ÷ vanilla's | wage units because pop goods stay near base in pounds (F97) |
| **PM** | the **war-goods** index (small arms / artillery / ammunition) | read only — the army's demand is exogenous |
| **the loss**, **L** | the register's single objective, Σ w · d over the terms above | §10.83.5/.7. Lower is better |
| **σ** | the spread a distance is measured in | FIXED CONSTANTS since 2026-09-18: the pooled WITHIN-CONFIG spread over the 2026-09-13→18 runs, not vanilla's seed spread |

## 2. THE SCOPES — who is being counted

| name | who |
|---|---|
| **the world** | every country in the save |
| **the SHORTLIST POOL** (usually just "the pool", or "the shortlist") | **GBR · USA · FRA · NET · BEL · UNL · PRU · NGF · GER**, summed and read as ONE economy. Ratios internal to it survive territory moving between members. **UNL** = the United Netherlands, which REPLACES NET and BEL where it forms (2 of the 16 vanilla seeds, from 1876) |
| **the MAJORS** | the same nine. "Majors" is *not* a prestige rank and never means RUS / CHI / TUR / SPA, however successful a seed makes them |
| **MEMBER** (per-country lines) | GBR · USA · FRA · GER · NET · BEL · UNL, where GER = GER, else NGF, else PRU — the German state through its three names. UNL gets its OWN row rather than resolving into NET and BEL, so it is never counted twice |
| **the scoped markets** | the markets the price indices are read in: the ARM's markets **intersected with** VANILLA's, printed with the index. Vanilla carries British · American · French · Dutch today, so that is the basis; an arm instrumented since 2026-09-20 also has German and Belgian prices, and they enter the day a vanilla baseline carries them |
| **the instrumented markets** | whatever a schedule's telemetry tag list names. **ELEVEN since 2026-09-20**: GBR · FRA · USA · PRU · NGF · GER · NET · BEL · UNL · RUS · JAP. Older sessions carry **the seven** (British · American · French · Prussian · Russian · Japanese · Dutch) and so hold no German prices after 1870 and no Belgian ever. ⚠ A market is named for its LEADER's adjective, so the German one reads Prussian → North German → German and the United Netherlands' is still "Dutch Market" — a market NAME does not identify its leader |

## 3. TIME

| name | what |
|---|---|
| **the end state** | the **1932–1936 mean** of the yearly save summaries (the 1935 point is printed beside it, never used alone) |
| **the anchor** / **the 1836 anchor** | the 1836 start, and the 1836–1845 window the hard anchor line reads |
| **a dump date** | one of the 12 dates telemetry writes a market snapshot at (1836.2.1, 1840, 1850 … 1935) |
| **the window** | whatever `--end` names; by default the end state |

## 4. STATISTICS — the two that caused trouble

- ⭐⭐ **"CI" IN THIS PROJECT MEANS THE PERCENTILE INTERVAL OF VANILLA'S SIXTEEN SEEDS, NOT THE CONFIDENCE INTERVAL OF A MEAN.** "vanilla's 90% CI"
  is `p5 … p95` over the 16 runs; "95% CI" is `p2.5 … p97.5`. The interval of the *mean* would be ~4× narrower and is never what is meant.
- **AIM / SOFT / HARD** — an AIM is what the iteration is trying to reach; a SOFT boundary is unacceptable but the economy is not broken, so the run
  is still read in full; a HARD boundary means the economy IS broken, the run records only **broken by stall** or **broken by runoff**, and ONE
  broken run ends the config.
- **intact** — a run that broke no hard line. **the consensus** — what a config is read as: the median of the intact runs (with three, the two
  closest on world GDP). **divergent** — a pair too far apart under F114's bands to have a consensus; it owes a third run.
- **directional** — the standing ruling (§10.83.7): no two-book loss gap in this family is statistically real at n=2–3, so a lever is read for its
  DIRECTION, weighted by whether its mechanism is understood, and a pooled reading across a whole axis outranks any single pair.

## 5. THE LADDER AND THE BOOK (config design)

| name | what |
|---|---|
| ⭐ **era**, **e0 … e3** | the **NARRATIVE era of a RUNG**, 0–3, anchors 1836 / 1875 / 1905 / 1940. It is the rung's place on the ladder and the key to every multiplier |
| ⭐ **game era**, **tech era 1 … 5** | the **MECHANICAL era of a TECHNOLOGY** — the era base cost and the ahead-of-time penalty. Mapped by `era_game_era` = [1, 3, 4, 5] |
| ⚠ **tier** | a LOOKUP KEY only (a DOM id, a history-converter map key). Never a multiplier, never an analysis cut. Say "rung" or "e2" |
| **rung** | one tiered building of one industry — the thing an era labels |
| **A** | the **output ratio per era**: a rung of era e makes `vanilla's first method × A^e` |
| **B** | the **input-value ratio per era**: input value `× B^e` over that rung's own vanilla mix |
| **r** | **A ÷ B** — the margin's SHAPE, multiplying per era. Today 2.2 ÷ 1.5 = **1.467** |
| **C** | the **cost ratio**: building_cost = the vanilla anchor `× C^era` (`--cost-ratio`; `--cost-ladder` gives it per era explicitly) |
| **in0**, **the lift**, **the era-0 input penalty** | rung 0's input VALUE `× in0`, with the whole ladder anchored on the lifted rung 0 (`--in0`). Today **1.2** |
| **`--in0-level m`**, "**uniform −X%**" | the same penalty chosen PER INDUSTRY so every industry's era-0 rung lands on the SAME margin `m` at base prices, in place of one scalar. `lift_i = O0 × (1 − wage_pct) ÷ (I0 × (1 + m))` |
| **target_be** | the **output price, as % of base, at which a rung covers input goods + wages**. `= 100 ÷ (1 + m)`. Its own drift guard, not a design input |
| **the book** | one complete `config/mod_config.*.json` — a named point in (A, B, C, in0, ai_value, defines) space |
| **the canon** / **the incumbent** | the book `config/mod_config.json` currently is; today `canon-c19-in12` |

## 6. ECONOMICS

| name | what |
|---|---|
| **base price** | the good's price in `tools/goods_prices.tsv` — the game's own reference, never what anything actually sells for |
| **realised price** | what the market produced. Off base by ±60 pp across markets at 1836 and ±50 pp across seeds by 1900 (§10.86.2) |
| **the band** | the engine's price range, **25–175% of base**. A good at either edge can no longer signal scarcity |
| **PROFIT** | ⭐ the game's own weekly bottom line for a building, in £: revenue − inputs − wages at MARKET prices, confirmed by measurement (F152). **This is what a report quotes** (user-ruled 2026-09-20, §10.87); a margin may sit beside it, never instead of it |
| **margin** (unqualified) | **(output − inputs − wages) ÷ (inputs + wages)**, all at current prices — the sheet's definition. Read off a SAVE it is `profit ÷ (R − profit)` where R = `va_out` re-priced from base to market. ⚠ F92's `profit ÷ (va_out − profit)` is that with the units BROKEN — `va_out` is base-priced and `profit` market-priced — and is retired; it is UNDEFINED, not approximate, where `va_out` is 0 (ownership buildings) |
| **goods margin** | the same without wages. Always say which |
| **value added** | outputs − inputs at market prices. **GDP = 52 × weekly value added** (F45); pops and trade are on neither side |
| **wage units** | Σ (employees × `wage_weight`); a building's wage bill is `wage × wage units × staffed levels`. Model-only — never emitted |
| **the NORMAL wage rate** | a country's reference wage — the save's own `base_wage`, **in the engine's unit: weekly £ per 10,000 employees**, so £ per employee per week = `base_wage ÷ 10,000`. The committed path per tag per year is `config/measured_base_wages.json` |
| **the WAGE PREMIUM** | **1.52×** — what buildings actually pay over the normal rate (p10 1.22, p90 1.85, flat across the century and the same on mod arms). A prediction that omits it understates wages by about half again |
| **wage_pct** | the flat wage fraction of TOTAL cost, 0.25. ⚠ **RETIRED FROM PREDICTIONS** (§10.87): vanilla's own share runs 54.6% at 1840 to 29.7% at 1935, so 25% is below its range in every decade. It survives only as the config-side convention behind `target_be` and `lint_solvency` (L18) |
| **throughput** | a per-building multiplier on inputs *and* outputs, so it raises the full margin but not the goods margin |

## 7. PROCESS

| name | what |
|---|---|
| **arm** | one thing under test in a batch: `{kind: control}` (vanilla + telemetry, nothing else, ever) or `{kind: config, config: …}` |
| **setup** | the schedule's name for an arm |
| **run** | one 1836 → 1936 campaign. **session** — one scheduler invocation's folder. **batch** — the runs a schedule was written for |
| **the 2+1 rule** | two runs, `alignment_check.mjs`, a third only if they diverge; the config read as the median |
| **the run-level stop** | a run of a 2+1 batch ending above ×1.3 of vanilla's 1936 world GDP is that config's last run |
| **usable** | a run that reached its own `until` date with no `abandoned_reason` (landmine L17) — `lib_runs.usableRuns` is the only definition |

---

**Where the authority lives**: the register in BALANCE_FRAMEWORK §10.83 (+ .4–.7 and §10.85, §10.86), the era rule in §10.78 and CLAUDE.md's
governing section, the price principles in §10.86.2, results in FINDINGS, engine behaviour in MODDING_NOTES, guardrails in TESTBED_LANDMINES.
This page names things; it does not rule on them.
