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

- **I** = input-goods cost = Σ (input good qty × input good price)
- **O** = output revenue = Σ (output good qty × output good price)
- **W** = wages. In the live game wages are endogenous (employees × wage, moving with prosperity
  and labor demand), which is not a design knob. For balance purposes we model wages as a **fixed
  fraction of input-goods cost**: `W = wage_pct · I`, with **`wage_pct` defaulting to 33%** (a
  per-tier `wage_pct` in the config overrides it). This is a **model/accounting layer only** — it is
  **not** emitted to the game (no wage "goods input"); the game still pays its own wages from
  employment. Every tool (volume solver, linter, building-cost solver, UI) uses this same `W`.

We track two numbers, both **wage-inclusive** (this is the change from earlier versions, where the
ladder was run on the wage-free `I/O`):

| Metric | Formula | Meaning |
|---|---|---|
| **Full profitability** (the displayed profit) | `(O − I − W) / (I + W)` | Return on the building's full operating cost. What the owner actually earns. |
| **Full break-even output price** (BE%) | `(I + W) / O` at base input prices, as a % of base output price | The output price (as % of base) at which full profit = 0. Equivalently `(1 + wage_pct) · (I/O)`. **This is the key tuning handle.** |

**Worked example** (the brief's): W = 500, I = 2000, O = 3000.
- Full profitability = (3000 − 2000 − 500) / (2000 + 500) = 500 / 2500 = **+20%**
- Full BE% at these volumes = (2000 + 500) / 3000 = **83%** — the output can fall to 83% of base
  before this building stops covering inputs **and** wages.

**Why full break-even output price is the master handle.** A building only turns a real (wage-inclusive)
profit when the market price of its output is above its BE%. Because higher tiers should survive at
*lower* output prices, we design the ladder directly in BE% terms and then solve the input/output
quantities to hit it. At base input prices, `BE% = (I + W) / O`, so:

- To **lower** a tier's BE% (make it viable at cheaper output prices) → raise output per
  unit input, cheapen the input mix, or lower `wage_pct`.
- To **raise** a tier's BE% → the opposite.

> **Note on the vanilla baseline (§4/§5).** Those tables were measured on the wage-free `I/O`
> (the metric this framework originally anchored on). They are kept as historical vanilla
> documentation; multiply by ~`1 + wage_pct` to compare against a wage-inclusive BE.

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

> **These are the original v0.1 wage-free targets, kept for history.** The ladder was since relaxed
> (v0.2, −20 pp), re-based to **wage-inclusive full break-even**, and finally re-cast as a **curve over
> tech unlock date (era)** rather than a per-industry group ladder — see **§1** for the metric and
> **§8.1** for the ladder **actually in force** (era anchors 140/115/90/65/50 with an H1 manufactured-input
> −15 pp adjustment), with **§8.2–8.3** for how volumes are derived. The *shape* (descending BE, N+2
> obsolescence) is unchanged; the meaning of BE and the absolute numbers moved.

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

> **Raw vs. manufactured inputs (for BE-target purposes).** When we classify a tier's inputs
> as raw vs. factory-made (e.g. the early-game manufactured-input adjustment), **dye and silk
> count as raw, not manufactured.** Both are RGO/plantation-sourced in the early game (dye
> plantations, sericulture) and trade near base then, so a consumer of dye/silk is not
> structurally input-squeezed the way a consumer of tools/steel/engines is. (Dye only becomes
> factory-made later, via the synthetics plant, i.e. in the late game where such an adjustment
> would be off anyway.) This carve-out lives in `tools/solve_be_targets.ps1` (`$MFG_GOODS`).

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

**Superseded by §8** — the applied numbers above were the first light-industry pass; the whole of
manufacturing has since been re-derived by the §8 volume methodology on the relaxed (v0.2) ladder.

---

## 8. Volume methodology & the relaxed (v0.2) ladder

### 8.1 The in-force ladder (date curve — wage-inclusive full break-even)

Targets are **full break-even** output prices (input goods **+ wages**, §1), referenced to the output
good's price as % of base. **BE is a curve over each tier's tech unlock date (era), not a per-industry
group ladder.** This ties obsolescence to real historical tech gaps: whichever tier's tech is ~2 eras
older is ~50 pp underwater on output price when the market settles at the newer tier's BE.

Each tier's `target_be` is:

> **target_be = anchor(era) − 15 · [ era ≤ 3 AND the recipe consumes a factory-made intermediate ]**

**Era anchors** (the date curve). The tech's vanilla era → its BE anchor:

| Era (vanilla band) | e1 (pre-1836) | e2 (1836–61) | e3 (1862–86) | e4 (1887–1911) | e5 (1911–36) |
|---|--:|--:|--:|--:|--:|
| **Anchor BE %** | 140 | 115 | 90 | 65 | 50 |

~25 pp/era, so a 2-era gap ≈ 50 pp → the **N+2 obsolescence** mechanic; everything stays inside the
25–175% band (§2) with headroom. There is **no within-era differentiation** — every tier on the same era
gets the same anchor. (The eras themselves will be reworked/expanded later; a within-era spread was
considered and dropped for simplicity.)

**H1 manufactured-input discount (−15 pp).** Applied only when a tier unlocks in **eras 1–3** *and* its
recipe consumes a **factory-made intermediate** (tools, steel, engines, fertilizer, explosives, paper,
glass, …). Rationale: in the first half of the game those intermediates trade *above* base, so their
consumer's real BE is higher than the base-price figure; we lower the nominal target to compensate. In
**eras 4–5 the discount is off** — those intermediate markets have matured to ~base, so a
manufactured-input plant is no longer disadvantaged and everything converges to the pure date curve.
**Dye and silk are NOT counted as manufactured** here (RGO/plantation-sourced in H1; see the §3 note).

This replaces the earlier per-group ladders (light 140/115/90/65, tools one tier lower, heavy/mil
120/95/65/40, single-PM 65). Those group distinctions are now **emergent**: chains capped at an early
era stay high-BE (e.g. food tops out at e2 → 115), tool/steel/engine consumers get the H1 discount, and
deep-funnel goods (explosives, munitions, synthetics) pick up the discount automatically.

Targets are derived by **`tools/solve_be_targets.ps1`**, which reads each tech's era live from vanilla
`common/technology/technologies/*.txt` and writes per-tier `target_be` + `natural_year` (the era's
representative year, shown in the UI). Run it first: `solve_be_targets.ps1` → `solve_volumes.ps1` →
`solve_building_cost.ps1` → `build.ps1`.

**Shipyards are enabled and split by output good** (§ following). The vanilla shipyard's single chain
produces *clippers* (wooden: basic/complex shipbuilding) then switches to *steamers* (metal:
metal/arc-welding) — a genuine output-good **and** input-mix type change, not a scaled recipe. Because BE
is referenced to the output good's price, a single mixed-good ladder is incoherent across that seam, so
the chain is split into two **output-good-consistent** chains, each placed on the date curve by its own
techs:

- **`shipyard` → clippers** — Basic (`navigation`, e1 → 140) / Complex (`screw_frigate`, e2 → 100 after
  the engines discount), inputs wood/hardwood/fabric/engines. Keeps the vanilla base building
  `building_shipyard` (+ `building_shipyards` alias).
- **`shipyard_steam` → steamers** — Metal (`gantry_cranes`, e3 → 75) / Arc-Welding (`arc_welding`, e5 →
  50), inputs steel/coal/electricity/engines. All-new buildings (base `building_shipyard_metal`, no
  vanilla anchor — the builder appends it). No 1836 start factories (metal/arc techs post-date the start),
  so the whole 1836 shipyard stock converts onto the clipper line.

### 8.2 How volumes are derived (the goal)

Break-even only fixes the **ratio** of input value to output value; it does not fix the absolute
volumes (140-out-for-100-in and 14-out-for-10-in have the same BE). We pin the volumes so they are
**deterministic and re-derivable from the current vanilla recipes** (so a game patch is a one-command
refresh, not a re-tune):

1. **Tier-1 output = the vanilla tier-1 PM's output** (e.g. paper T1 = 40 paper, steel T1 = 65 steel).
2. **Tier-1 inputs** are solved from the tier's target BE at base prices, scaling the *vanilla* input
   quantities by a single factor so input↔input ratios stay vanilla, rounded to integers (≥1). Because
   the target is a **full** break-even, wages are folded in: solve `(I + wage_pct·I)/O = target_be`,
   i.e. `I = target_be/100 · O / (1 + wage_pct)`, then distribute `I` across the vanilla input mix.
3. **Higher-tier output = tier-1 output × 1.5^(tier−1)** (T2 ×1.5, T3 ×2.25, T4 ×3.375), unless a tier
   sets an explicit `output_override` for a realism-driven reason. Per-industry `output_mult`
   overrides the 1.5 default.
4. **Higher-tier inputs** are solved exactly like step 2, using *that tier's* vanilla input goods/ratios
   and its own target BE.

This makes higher tiers genuinely **bigger plants** (more absolute output), which is what floods the
market and drives laggards out, while BE governs *when* each tier is viable.

### 8.3 Implementation

`tools/solve_volumes.ps1` implements §8.2: it reads the **current** vanilla recipes from the game
(via each tier's `vanilla_pm`), plus `target_be` / `output_mult` from the config, and writes the
solved `output_qty` + `inputs` back into `config/mod_config.json`. Both the solver and the linter read
`wage_pct` (per-tier override, default 0.33). Run it after changing a target or after a game update,
then `build.ps1`. The linter (`lint.sh`) confirms each building's actual **full** BE (input goods +
wages) is within ±6 pp of its configured `target_be`. Coverage: **all manufacturing** (18 config
industries — 17 vanilla, with the shipyard split into clipper + steamer chains, all enabled). Deferred:
more tech tiers and raw-resource extraction. (The wage layer, previously deferred, is now folded into
the ladder here.)

---

## 9. Building construction cost (10-year-payback model)

Each tier carries an explicit **`building_cost`** (construction points) in the config, emitted as the
building's `required_construction`. It replaces vanilla's four flat script-values
(`construction_cost_low/medium/high/very_high` = 200/400/600/800). This directly serves the mod's core
goal — **modernizing must cost capital**: a newer plant has to be *built*, not toggled on for free, so
a bigger/more-modern tier costs more to construct. Solved by `tools/solve_building_cost.ps1`.

### 9.1 The model

Per building level, weekly flows at base prices:

- **I** = input-goods cost = Σ(input qty × base price)
- **W** = wages = **`wage_pct`·I** (the same shared assumption as §1; default 33%, per-tier override)
- **TC** = total operating cost = I + W = (1 + wage_pct)·I
- **π** = net weekly profit = **20%** of TC
- **cost** = `PaybackYears × WeeksPerYear × π` = money the building must earn back over a **10-year** payback
- **building_cost** (points) = cost ÷ (money per construction point), rounded to the nearest 5.

**Money per construction point** is read from the **live** construction sector at **0 efficiency bonus**,
using the "iron" PM `pm_iron_frame_buildings`: it consumes wood 40 + fabric 20 + iron 50 + tools 10 =
**£3 600/wk** and produces `country_construction_add = 5` points/wk → **£720/point**. Both sides are
weekly, so the tick cancels; the solver re-reads this from the game each run, so a patch is a one-command
refresh.

**Weekly vs. yearly.** Victoria 3 ticks **weekly** (52/yr); PM `_add` flows and construction output are
weekly. So profit is annualized **×52**, and the per-point cost is a flow **ratio** (tick-independent).

### 9.2 Why a flat return on cost (not "output at BE+20pp")

The brief said "output priced at BE+20pp, wages +33% of input, 10-yr payback." Pricing revenue off each
tier's BE makes the cost **scale with BE**, which balloons the tier spread: high-BE early tiers and
low-BE modern tiers end up with wildly different margins (an earlier IO-BE experiment gave a **~800×**
spread and pushed T1 basics toward ≈3 points, violating the "T1 ≈ vanilla" and "≤ 20–30× spread"
guards). Now that BE is wage-inclusive the literal reading no longer goes *negative*, but it still
inherits that BE-driven spread.

We therefore realize "+20pp" as a **flat 20% net return on total operating cost** (π = 0.20·TC), which is
BE-independent and bounded. This hugs vanilla and keeps a mild "modern costs more" slope. (A steeper
alternative — 20% of *output value*, giving a wider spread that leans harder into the capital-demand goal —
was considered and rejected in favor of this vanilla-hugging shape; it stays available as
`solve_building_cost.ps1 -Basis output` if playtesting wants a steeper ladder.)

### 9.3 Resulting costs (points), vs. vanilla 600 (light/mil) / 800 (heavy)

Solver-derived from the current volumes (on the date-ladder targets); a snapshot — the live config/UI is
authoritative and these move on any re-solve.

| Industry | T1 | T2 | T3 | T4 |
|---|--:|--:|--:|--:|
| Food | 275 | 415 | 500 | — |
| Textile | 275 | 415 | 440 | 430 |
| Furniture | 275 | 375 | 435 | — |
| Glass | 240 | 365 | 455 | 385 |
| Tooling | 240 | 365 | 395 | 440 |
| Paper | 240 | 295 | 455 | — |
| Fertilizer | 450 | 520 | 570 | — |
| Explosives | 355 | 535 | 620 | 795 |
| Steel | 660 | 815 | 950 | 1030 |
| Motor | 345 | 335 | 400 | — |
| Automotive | 280 | 325 | — | — |
| Arms | 370 | 380 | 450 | 565 |
| Artillery | 355 | 445 | 430 | 555 |
| Munitions | 365 | 405 | — | — |
| Shipyard — clippers | 485 | 510 | — | — |
| Shipyard — steamers | 500 | 505 | — | — |
| Synthetics / Electrics (single-PM) | 345 / 400 | — | — | — |

Spread **240 → 1030 = 4.3×**; T1 basics ≈2× under vanilla. Cheapest are the lean light T1s (glass /
paper / tooling at 240); **steel is now the most expensive** (660 → 1030 — coal/iron-heavy recipes on the
high early-era BE anchors). Costs rise with era mainly via the ×1.5 volume growth per tier; where a tier's
BE anchor drops sharply (H2), input cost and hence build cost can dip against the tier below (e.g. motor
T2, artillery T3) — an expected property of the "return on cost" reading.

All assumptions are the solver's parameters (`WagePct`, `MarginPct`, `PaybackYears`, `WeeksPerYear`,
`RoundTo`, `ConstructionPm`); re-solve with one command after playtest tuning.

