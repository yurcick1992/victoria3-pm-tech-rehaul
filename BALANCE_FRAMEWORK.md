# PM & Tech Rehaul — Balance Framework

This document is the **source of truth** for the economic balance of the mod. Every
concrete building/PM number must be justified against the targets defined here. It is
built in layers:

1. **Metrics** — how we measure profitability.
2. **The price band** — the range prices can actually move in, which bounds everything.
3. **Design targets** — the profitability ladder we want tiers to sit on.
4. **Vanilla baseline** — documentation of where vanilla actually sits today.
5. **Gap analysis** — how far vanilla is from the targets, per industry.

> Scope of v0.1: manufacturing industries only (`common/*/01_industry.txt`).
> Raw resource extraction, agriculture, and services are out of scope for now.

---

## 1. Metrics

For a building (or a single PM) at a given set of market prices, let:

- **I** = input cost = Σ (input good qty × input good price)
- **O** = output revenue = Σ (output good qty × output good price)
- **W** = wages = Σ (employees × wage)

We track three numbers:

| Metric | Formula | Meaning |
|---|---|---|
| **Input-output profitability** (IO%) | `(O − I) / I` | Gross margin over input cost, wages ignored. Governs whether the *process* is worth running at all. |
| **Total profitability** (TP%) | `(O − I − W) / (I + W)` | Return on the building's full operating cost. What the owner actually cares about. |
| **Break-even output price** (BE%) | `I / O` at base prices, expressed as a % of base output price | The output price (as % of base) at which IO% = 0. **This is the key tuning handle.** |

**Worked example** (the one from the brief): W = 500, I = 2000, O = 3000.
- IO% = (3000 − 2000) / 2000 = **+50%**
- TP% = (3000 − 2000 − 500) / (2000 + 500) = 500 / 2500 = **+20%**

**Why break-even output price is the master handle.** A building only earns positive IO
margin when the market price of its output is above its BE%. Because higher tiers should
survive at *lower* output prices, we design the ladder directly in BE% terms and then
solve the input/output quantities to hit it. At base input prices, `BE% = I / O`, so:

- To **lower** a tier's BE% (make it viable at cheaper output prices) → raise output per
  unit input, or cheapen the input mix.
- To **raise** a tier's BE% → the opposite.

Wages (W) are deliberately held aside for the first pass, as instructed: wage levels are
endogenous (they move with pop prosperity and labor demand), so IO% is the stable,
price-only quantity we anchor on first. TP% targets come in a later pass once the IO
ladder is fixed.

**Building-level vs. PM-level.** Because we only edit *main* PMs but a building also runs
the base (default) states of its other PMGs, profitability is checked at the **building
level**: the linter sums the main PM plus the **base PM of every other PMG** the building
runs, then computes BE on that total. For light industry those base PMs are inert "off"
states (no goods), so building BE equals main-PM BE — but heavy/military buildings have
base secondary PMs that produce or consume, so the building-level view is the correct one
and is enforced from the start. The linter is `tools/lint.sh` (wraps
`lint_profitability.awk` + `ladder_tiers.txt`); run it on every version.

---

## 2. The price band

A good's market price in Victoria 3 moves with the balance of buy vs. sell orders, within
a hard band:

- **Floor: 25% of base** (price is −75%), reached when **supply ≈ 2× demand**.
- **Ceiling: 175% of base** (price is +75%), reached when **demand ≈ 2× supply**.

So every tier's break-even output price **must live inside 25%–175%**, and we want to
leave headroom at both ends:

- If a tier's BE% is **below ~40%**, it prints money even in a glutted market → it never
  gets pushed out, tiers never rotate.
- If a tier's BE% is **above ~160%**, it can *never* be profitable even at peak scarcity →
  it's dead on arrival.

The usable design corridor is therefore roughly **40%–160% BE**, and we spread the tiers
across it.

---

## 3. Design targets — the profitability ladder

The core mechanic we are building toward (brief point 3):

> A tier-N building usually **cannot** maintain profitability once a significant share of
> tier-(N+2) buildings is present on the market.

Mechanism: tier-(N+2) buildings are viable at a much lower output price, so when enough of
them are built they push the market price down to *their* comfort zone — which is **below
tier-N's break-even**, forcing tier-N into the red.

We express this as a descending **break-even ladder** on the output good, at base input
prices:

| Tier | Target BE% (output price to break even) | Interpretation |
|---|---|---|
| **T1** (earliest) | **130–150%** | Only profitable when the good is scarce/expensive. A frontier industry. |
| **T2** | **105–125%** | Profitable around/just above base price. |
| **T3** | **85–105%** | Comfortable at base price. |
| **T4** | **65–85%** | Profitable even when the good is somewhat glutted. |
| **T5+** | **50–65%** | Only fully-modern plants survive a saturated market. |

Consecutive tiers differ by ~**20 percentage points** of BE. Two tiers up (N → N+2) is
therefore a ~**40-point** gap: whenever the market settles near tier-(N+2)'s BE, tier-N is
~40 points underwater on output price → reliably unprofitable. That is exactly the intended
N+2 obsolescence, with N+1 remaining marginally viable as a transition tier.

**Leniency clause (deep-funnel early game).** Early-tier producers of deep-funnel goods
(e.g. explosives, which eat sulfur + fertilizer that are themselves scarce early) will in
practice face *above-base* input prices, which pushes their real BE even higher. For those
goods we may target the **low end** of each tier's BE band, so they aren't punished twice.
This is applied per-good in the gap analysis, not globally.

**Input-price sensitivity.** The BE% targets above assume **base input prices**. When
inputs are expensive, real BE rises; when inputs are cheap (glutted), real BE falls. A tier
with a heavier, more diverse input mix is therefore more exposed to input-price swings — a
property we can use deliberately (modern tiers trading raw-material dependence for
efficiency).

---

## 4. Vanilla baseline (documentation)

The two scenarios requested, **wages aside**, at **base input prices**:

- **IO@100%** = input-output profitability at base output price.
- **IO@150%** = input-output profitability at 150% output price.
- **BE** = break-even output price (% of base) — the single number that places the PM on
  the ladder in §3.

Values are computed from `common/production_methods/01_industry.txt` × `common/goods`
base prices (see `tools/` for the extractor). **MAIN** = the tiered progression that this
mod splits into separate buildings. **(sec)** = secondary/redistribution PM that stays.

### Light industry

**Food Industry — MAIN chain (groceries)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_bakery | 800 | 1350 | +68.8% | +153.1% | **59%** |
| T2 | pm_sweeteners | 1250 | 1950 | +56.0% | +134.0% | **64%** |
| T3 | pm_baking_powder | 2500 | 3600 | +44.0% | +116.0% | **69%** |

*Secondary:* canning (BE ~57–67%), distillery pot_stills BE 83% / patent_stills BE 64%.

**Textile Mill — MAIN chain (clothes)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_handsewn_clothes | 800 | 1350 | +68.8% | +153.1% | **59%** |
| T2 | pm_dye_workshops | 1000 | 1800 | +80.0% | +170.0% | **56%** |
| T3 | pm_sewing_machines | 1800 | 3000 | +66.7% | +150.0% | **60%** |
| T4 | pm_electric_sewing_machines | 2700 | 4200 | +55.6% | +133.3% | **64%** |

*Secondary (luxury clothes):* craftsman_sewing BE 33%, elastics BE 52%.

**Furniture Manufactory — MAIN chain (furniture)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_handcrafted_furniture | 800 | 1350 | +68.8% | +153.1% | **59%** |
| T2 | pm_lathe | 1000 | 1950 | +95.0% | +192.5% | **51%** |
| T3 | pm_mechanized_workshops | 1600 | 3300 | +106.2% | +209.4% | **48%** |

*Secondary (luxury furniture):* luxury_furniture BE 40%, precision_tools BE 55%.

**Glassworks — MAIN chain (glass)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_forest_glass | 600 | 1200 | +100.0% | +200.0% | **50%** |
| T2 | pm_leaded_glass | 800 | 1600 | +100.0% | +200.0% | **50%** |
| T3 | pm_crystal_glass | 1400 | 2400 | +71.4% | +157.1% | **58%** |
| T4 | pm_houseware_plastics | 2000 | 4000 | +100.0% | +200.0% | **50%** |

*Secondary (porcelain):* ceramics BE 67%, bone_china BE 31%.

**Tooling Workshop — MAIN chain (tools)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_crude_tools | 600 | 1200 | +100.0% | +200.0% | **50%** |
| T2 | pm_pig_iron | 1400 | 2400 | +71.4% | +157.1% | **58%** |
| T3 | pm_steel | 1600 | 3200 | +100.0% | +200.0% | **50%** |
| T4 | pm_rubber_grips | 1900 | 4400 | +131.6% | +247.4% | **43%** |

**Paper Mill — MAIN chain (paper)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_pulp_pressing | 600 | 1200 | +100.0% | +200.0% | **50%** |
| T2 | pm_sulfite_pulping | 1100 | 2100 | +90.9% | +186.4% | **52%** |
| T3 | pm_bleached_paper | 1500 | 3000 | +100.0% | +200.0% | **50%** |

### Heavy industry

**Chemical Plant — MAIN chain (fertilizer)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_artificial_fertilizers | 1900 | 2700 | +42.1% | +113.2% | **70%** |
| T2 | pm_improved_fertilizer | 2700 | 4200 | +55.6% | +133.3% | **64%** |
| T3 | pm_nitrogen_fixation | 4000 | 6000 | +50.0% | +125.0% | **67%** |

**Explosives Factory — MAIN chain (explosives)** *(deep-funnel: eats sulfur + fertilizer)*
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_leblanc_process | 1600 | 2500 | +56.2% | +134.4% | **64%** |
| T2 | pm_ammonia-soda_process | 2700 | 4000 | +48.1% | +122.2% | **68%** |
| T3 | pm_vacuum_evaporation | 3800 | 5500 | +44.7% | +117.1% | **69%** |
| T4 | pm_brine_electrolysis | 5000 | 7500 | +50.0% | +125.0% | **67%** |

**Synthetics Plant** — already single main PM: pm_dye_production BE 59%. *(sec: rayon BE 25%.)*

**Steel Mill — MAIN chain (steel)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_blister_steel_process | 2500 | 3250 | +30.0% | +95.0% | **77%** |
| T2 | pm_bessemer_process | 3300 | 4500 | +36.4% | +104.5% | **73%** |
| T3 | pm_open_hearth_process | 4500 | 6000 | +33.3% | +100.0% | **75%** |
| T4 | pm_electric_arc_process | 5800 | 7500 | +29.3% | +94.0% | **77%** |

**Motor Industry — MAIN chain (engines)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_steam_engines | 1500 | 2400 | +60.0% | +140.0% | **63%** |
| T2 | pm_electric_engines | 2900 | 4800 | +65.5% | +148.3% | **60%** |
| T3 | pm_diesel_engines | 4500 | 7200 | +60.0% | +140.0% | **63%** |

**Shipyard — MAIN chain (clippers → steamers)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_basic_shipbuilding | 1200 | 2400 | +100.0% | +200.0% | **50%** |
| T2 | pm_complex_shipbuilding | 1900 | 4200 | +121.1% | +231.6% | **45%** |
| T3 | pm_metal_shipbuilding | 2400 | 4550 | +89.6% | +184.4% | **53%** |
| T4 | pm_arc_welding_shipbuilding | 3000 | 5600 | +86.7% | +180.0% | **54%** |

**Automotive Industry — MAIN chain (automobiles)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_automobile_production | 1000 | 3000 | +200.0% | +350.0% | **33%** |
| T2 | pm_mass_automobile_production | 1400 | 5000 | +257.1% | +435.7% | **28%** |

**Electrics Industry** — already single main PM: pm_telephones BE 67%. *(sec: radios BE 83%.)*

### Military industry

**Arms Industry — MAIN chain (small arms)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_muskets | 800 | 1800 | +125.0% | +237.5% | **44%** |
| T2 | pm_rifles | 1100 | 3000 | +172.7% | +309.1% | **37%** |
| T3 | pm_repeaters | 1800 | 4200 | +133.3% | +250.0% | **43%** |
| T4 | pm_bolt_action_rifles | 2600 | 6000 | +130.8% | +246.2% | **43%** |

**Artillery Foundry — MAIN chain (artillery)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_cannons | 1000 | 1750 | +75.0% | +162.5% | **57%** |
| T2 | pm_smoothbores | 1600 | 3150 | +96.9% | +195.3% | **51%** |
| T3 | pm_breech_loaders | 2050 | 4550 | +122.0% | +232.9% | **45%** |
| T4 | pm_recoiled_barrels | 3200 | 6300 | +96.9% | +195.3% | **51%** |

**Munition Plant — MAIN chain (ammunition)**
| Tier | PM | I | O | IO@100% | IO@150% | BE |
|---|---|--:|--:|--:|--:|--:|
| T1 | pm_percussion_caps | 1800 | 2500 | +38.9% | +108.3% | **72%** |
| T2 | pm_explosive_shells | 3200 | 4500 | +40.6% | +110.9% | **71%** |

---

## 5. Gap analysis — vanilla vs. the ladder

The ladder in §3 wants BE to **descend steeply** with tier (≈150% → ≈50%). Vanilla does
almost the opposite: **BE is flat, and often slightly rising**, across every industry.

| Industry | Vanilla BE by tier | Shape | Verdict |
|---|---|---|---|
| Paper | 50 → 52 → 50 | flat | tiers economically identical |
| Steel | 77 → 73 → 75 → 77 | flat, high | identical; all live only in scarcity |
| Textile | 59 → 56 → 60 → 64 | flat / rising | later tiers *worse* at base price |
| Food | 59 → 64 → 69 | **rising** | wrong direction — upgrades hurt margin |
| Furniture | 59 → 51 → 48 | mildly descending | closest to intent, but only ~11 pts total |
| Glass | 50 → 50 → 58 → 50 | flat | identical |
| Tooling | 50 → 58 → 50 → 43 | noisy | no clean ladder |
| Fertilizer | 70 → 64 → 67 | flat | identical |
| Explosives | 64 → 68 → 69 → 67 | flat, high | identical (deep-funnel — expect leniency) |
| Motor | 63 → 60 → 63 | flat | identical |
| Shipyard | 50 → 45 → 53 → 54 | flat/rising | identical |
| Automotive | 33 → 28 | too low | prints money even glutted (never rotates) |
| Arms | 44 → 37 → 43 → 43 | flat, low | too profitable; military-goods design |
| Artillery | 57 → 51 → 45 → 51 | mildly descending | partial ladder |
| Munitions | 72 → 71 | flat, high | identical |

**Conclusions that drive the rebalance:**

1. **The central problem is confirmed quantitatively:** vanilla tiers are a *choice of
   efficiency at the same break-even*, not a *ladder of break-evens*. Splitting them into
   separate buildings (points 1–2) does nothing on its own — without re-sloping BE,
   nobody would ever be forced off an old tier. Point 3 is the load-bearing change.

2. **Every MAIN chain needs BE re-sloped to descend ~20 pts/tier** toward the §3 bands.
   Concretely this usually means: keep T1 near vanilla output-per-input but push its BE
   *up* toward 130–150% (leaner output or richer input), while pushing top tiers' BE
   *down* toward 50–65% (more output per input).

3. **Watch the absolute floor.** Automotive (28–33%) and arms (37–44%) already sit near/below
   the ladder floor; those need BE raised across the board, not just re-sloped, or they
   never rotate at all. These are also the goods where wages (deferred) matter most.

4. **Deep-funnel goods (explosives, and to a degree fertilizer/steel)** start high on BE
   because their inputs are pricey. Apply the §3 leniency clause: target the low end of each
   tier band so early tiers aren't doubly punished by above-base input prices.

---

## 6. Open questions for the next pass

- **Exact per-tier BE targets per good** — do we use one global ladder (§3) or per-good
  ladders that account for how volatile each output good's price is in practice?
- **Wage/TP layer** — once IO ladders are set, choose TP% targets and confirm employment
  numbers per tier (currently flat ~5000/level in most chains).
- **N+1 viability window** — how long should the transition tier stay marginally profitable
  before N+2 makes N unviable? This sets the exact per-tier BE step (15 vs 20 vs 25 pts).

---

## 7. v0.1 applied — light industry

**Scope done:** food, textile, furniture, glass, tooling, paper — split into 21 tier
buildings (6 base buildings overridden as T1 + 15 new higher-tier buildings), each with one
main PM + the vanilla secondary/automation groups. Every main PM re-sloped to the global
ladder and verified by the building-level linter (`tools/lint.sh`, 21/21 PASS).

**Content is config-driven.** All numbers live in `config/mod_config.json` and are realized by
`tools/build.ps1`, which for each tier **solves the input quantities** so break-even equals the
tier's `target_be` at base prices, given the configured `output_qty` and input composition
(`input_qty = ref_qty × (target_be/100 × outputValue / refInputValue)`). Vanilla **employment**
and **pollution** are preserved (wage/TP layer deferred). The initial `output_qty` values came
from a balanced sqrt-split of the vanilla recipe (`tools/solve_targets.awk`), but going forward
`output_qty` and `target_be` are simply design knobs in the config.

**Resulting break-even ladder (linter output):**

| Good | T1 | T2 | T3 | T4 |
|---|--:|--:|--:|--:|
| Groceries | 140% | 114% | 95% | — |
| Clothes | 140% | 114% | 95% | 76% |
| Furniture | 140% | 115% | 95% | — |
| Glass | 139% | 115% | 96% | 74% |
| Tools | 139% | 114% | 96% | 76% |
| Paper | 139% | 116% | 95% | — |

Compare to vanilla (§4/§5): every chain was flat ~50–75%; now each descends ~20 pts/tier,
so tier-N sits ~40 pts above tier-(N+2)'s break-even → the N+2 obsolescence mechanic works.

**Known consequences / caveats to revisit consciously:**

1. **T1 output is cut ~35–40%** (e.g. paper 40→24, groceries 45→29). This is intended: it
   creates the finished-good scarcity that justifies T1's high BE, and it is self-correcting
   (scarce good → price rises toward 140% → T1 viable). But it does mean early-game finished
   output is lower; watch for shortages in playtesting.
2. **Employment unchanged while T1 output fell** → T1 output-per-worker dropped. When the
   wage/TP layer is done, revisit T1 employment (or accept that T1 only pays wages at its
   elevated operating price, which the numbers roughly preserve).
3. **Company / journal / AI bonuses** that target `building_<x>` now hit only the T1 variant
   (key preserved). Higher tiers get no such bonuses yet. Revisit if it matters.
4. **Category grouping:** each tier building is its own `category_building_type`, so building
   registry / average-productivity views split by tier. Could reunify with
   `category_building_type = building_<x>` if desired.
5. **Secondary-PM edge cases:** distillery `pot_stills` (−30 groceries) on a T1 food building
   (now +29 groceries) can drive net groceries ≈ 0. Pre-existing vanilla behavior, now sharper.

**Not yet done:** heavy industry (chemical/fertilizer, explosives, steel, motor, shipyard,
automotive), military industry (arms, artillery, munitions), and the wage/TP layer. Synthetics
and electrics already have a single main PM and need no split.

