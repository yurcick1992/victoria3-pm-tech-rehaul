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
  fraction of TOTAL cost** (goods + wages): `wage_pct = W / (I + W)`, so `W = wage_pct/(1−wage_pct) · I`
  and total cost `= I / (1−wage_pct)`. **`wage_pct` defaults to 25%** (≡ the old "+33% over goods" —
  0.25 of total = 0.333 of goods; a per-tier `wage_pct` in the config overrides it). Framing wages as a
  fraction of *total* (rather than of goods) keeps the knob bounded 0–100% and is forward-compatible with
  labour-only buildings (no input goods → wages are 100% of total). This is a **model/accounting layer
  only** — **not** emitted to the game (no wage "goods input"); the game still pays its own wages from
  employment. The solvers, linter, and builder use this same `W`. **The UI has moved on** (transition in
  progress): it now roots wages in the real workforce — `W = Σ (employees × base wage × pop-type wage_weight)`,
  driven by a global **base wage** in the Workforce panel (see CLAUDE.md → Balance UI). So the UI's BE currently
  diverges from `wage_pct`-based `target_be`; the pipeline will be switched to the workforce model once the base
  wage is calibrated.

We track two numbers, both **wage-inclusive** (this is the change from earlier versions, where the
ladder was run on the wage-free `I/O`):

| Metric | Formula | Meaning |
|---|---|---|
| **Full profitability** (the displayed profit) | `(O − I − W) / (I + W)` | Return on the building's full operating cost. What the owner actually earns. |
| **Full break-even output price** (BE%) | `(I + W) / O` at base input prices, as a % of base output price | The output price (as % of base) at which full profit = 0. Equivalently `(I/O) / (1 − wage_pct)`. **This is the key tuning handle.** |

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
> **§8.1** for the ladder **actually in force** (era anchors 125/100/75/50/35 with an H1 manufactured-input
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
from a balanced sqrt-split of the vanilla recipe (a one-off `tools/solve_targets.awk`, since deleted
along with `profit.awk` / `vanilla_profit_baseline.txt` — nothing referenced them), but going forward
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

> ⚠ **Soon to be deprecated.** The BE methodology — era anchors, the H1 input discount, and the wage
> model they are solved against — is being reworked wholesale, and `tools/solve_be_targets.ps1` carries
> the same marker. Expect it to be replaced rather than incrementally tuned; keep the anchors below and
> the solver's `$anchor` table in step until then.

Targets are **full break-even** output prices (input goods **+ wages**, §1), referenced to the output
good's price as % of base. **BE is a curve over each tier's tech unlock date (era), not a per-industry
group ladder.** This ties obsolescence to real historical tech gaps: whichever tier's tech is ~2 eras
older is ~50 pp underwater on output price when the market settles at the newer tier's BE.

Each tier's `target_be` is:

> **target_be = anchor(era) − 15 · [ era ≤ 3 AND the recipe consumes a factory-made intermediate ]**

**Era anchors** (the date curve). The tech's vanilla era → its BE anchor:

| Era (vanilla band) | e1 (pre-1836) | e2 (1836–61) | e3 (1862–86) | e4 (1887–1911) | e5 (1911–36) |
|---|--:|--:|--:|--:|--:|
| **Anchor BE %** | 115 | 90 | 65 | 40 | 25 |

25 pp/era, so a 2-era gap = 50 pp → the **N+2 obsolescence** mechanic; everything stays inside the
25–175% band (§2) with headroom. There is **no within-era differentiation** — every tier on the same era
gets the same anchor. (The eras themselves will be reworked/expanded later; a within-era spread was
considered and dropped for simplicity.)

**Two hand-tuned exceptions.** `tooling` (95 / 95 / 55 / 30, a further −20 pp) and `power`
(60 / 50 / 35) sit off the curve **deliberately**. They are not solver output:
`solve_be_targets.ps1 -Write` resets them to the anchors above, so re-apply them after any solver run.
Every other BE-ladder tier (53 of 60) is exactly `anchor − 15·[H1 mfg input]`.

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

- **`shipyard` → clippers** — Basic (`navigation`, e1 → 125) / Complex (`screw_frigate`, e2 → 85 after
  the engines discount), inputs wood/hardwood/fabric/engines. Keeps the vanilla base building
  `building_shipyard` (+ `building_shipyards` alias).
- **`shipyard_steam` → steamers** — Metal (`gantry_cranes`, e3 → 60) / Arc-Welding (`arc_welding`, e5 →
  35), inputs steel/coal/electricity/engines. All-new buildings (base `building_shipyard_metal`, no
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

### 8.4 New-economy chains (power / port / railway)

Three infrastructure/utility buildings are now tiered too, so modernizing them **costs capital** (build
the newer plant) like every other chain — the mod's core goal — while **not** all following the BE ladder:

- **`power`** (electricity) is a normal BE-ladder chain: `electrical_generation`/`steam_turbine`/`oil_turbine`
  → e3/e4/e5 → targets **60 / 50 / 35**. It sets `output_override` per tier to keep vanilla electricity
  output (25/50/80) rather than the ×1.5 volume growth (electricity is consumed locally, not a good to
  flood a market with); inputs are solved to the target. Its tiny volumes miss the target by a few pp on
  integer rounding, so it's kept **off the hard linter ladder** (`no_mass_be`).
- **`port`** (merchant_marine, 3 tiers) and **`railway`** (transportation, 4 tiers) are **`follows_be: false`**:
  they keep **vanilla volumes and vanilla construction cost**, and their BE is informational only (the
  volume / BE-target / building-cost solvers and the linter all skip them). Rationale (brief point 3 note):
  these are utilities with non-market-flooding outputs and produce **infrastructure** (`state_infrastructure`,
  emitted verbatim) — the BE-obsolescence mechanic isn't the right model for them, but tech-gated
  *construction cost* still is. `trade_center` is left fully vanilla (no main-PM ladder — only its secondary
  quantity PMs change, unchanged from vanilla).

All three are `no_mass_be` (locked-by-default in the UI, excluded from the mass BE tools) and are emitted
by **clone-and-swap** to preserve their special engine fields (see CLAUDE.md / §ON_GAME_UPDATE).

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

### 9.2 ⚠ SUPERSEDED (2026-07-31) — the model is now "output at BE+20pp"

**The `output` basis is now the one in force**, by explicit design decision: *inputs at 100 % of base
price, wages at the regular `wage_pct`, output sold 20 pp above the tier's BE, 10-year payback.* Since a
tier at its BE has revenue exactly equal to `inputs + wages`, selling 20 pp higher yields
**π = 0.20 × (base output value)** — which is what `-Basis output` computes. The command of record is:

```
powershell -ExecutionPolicy Bypass -File tools\solve_building_cost.ps1 -Basis output -MarginPct 0.20 -PaybackYears 10
```

⚠ **`-Basis output` is NOT the solver's default** (`cost` still is), so the basis must be passed
explicitly or a re-solve silently reverts to the superseded model below.

**Why the change.** The `cost` basis ties build cost to *input* cost, and because `target_be` falls
steeply with tier, inputs shrink as tiers advance — so it made **modern buildings cheaper to construct
than primitive ones** (textile 230 → 360 → 270), directly against the mod's capital-demand goal. The
`output` basis rises monotonically with tier in every industry, which is the intended ladder.

**Resulting spread is sane:** 110–1580 points against vanilla's flat 200/400/600/800 — ratios
**0.18×–2.63×** of each building's own vanilla cost, no order-of-magnitude outlier. It also removes the
near-free buildings the previous stored values had (art academy T1 was **5** points, furniture T2 **15**).

The reasoning that originally rejected this basis is kept below for the record.

### 9.2.1 (superseded) Why a flat return on cost

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


---

## 10. The five-era ladder — SUPERSEDES §3 and §8 for every tiered industry

**Status: current method.** §3's break-even ladder and §8's volume methodology priced every good at
100% of base and solved break-even against that. That is precisely the assumption this mod exists to
stop making — a tech lead only matters if prices move. Everything below replaces it. §9's
building-cost model is unaffected.

### 10.1 The eras

The mod's own five technology eras, anchored at **~1750 / 1850 / 1900 / 1925 / 1940** — wider than the
game's window at the front, contracting towards the back, because technical progress accelerates after
the industrial revolution. **No industry has two tiers on one era.** 89 tiers over 22 industries:
67 real + 22 `model_only` (modelled, not emitted — no unlocking technology exists yet).

`output(k) = vanilla tier-1 output × 1.5^k` over the industry's own ladder, exempting `follows_be:false`
industries (port, railway keep vanilla volumes) and any tier with `output_override` (power). Employment
for invented tiers holds headcount and moves 10% of it laborers→machinists and 5% machinists→engineers
per era — which reproduces vanilla's own T3→T4 step exactly for textile, glass and steel.

Ladders that stop early carry `ladder_end`:
- **`plateau`** (food, textile, furniture, port) — the last tier is permanent. Its good's price must
  therefore hold that tier at **+5%** rather than deflate past it, which makes the good relatively
  dearer over time. Baumol's cost disease falls out of the model rather than being put in.
- **`extinct`** (sail shipyards) — the industry is allowed to die; no floor.

### 10.2 Targets

| what | target |
|---|---|
| era-appropriate tier | **+20%** |
| one era stale | **−5%** |
| two eras stale | **−30%** (a CHECK, not a constraint — see below) |
| plateaued industry's last tier, after its era | **+5%** |
| extraction / logging | **+20%** |
| agriculture | **+10%** |
| **shipyards — both chains** | **−30pp on every line above** |

Shipyards are penalised because **none of their income from naval ship construction is modelled**: the
`country_ship_construction_add` a shipyard grants is real value the market price of clippers/steamers
does not represent. Without the penalty they are priced as if that were free.

**−5% at one era and −30% at two are not independently satisfiable.** Two eras of the drift that
produces −5% compounds to about −11%. Only one of the two can be imposed; the two-era figure is
reported, not enforced.

### 10.3 Why prices are realised, never prescribed

Deriving a price path from profit margins alone (which `tools/era_solver.mjs` still does, as a
reference view) produces numbers **no market composition can reach**. Steel at 150% of base in era 1 is
the clearest case: an era-1 economy has no steel consumer at all — era-1 tooling is wood, era-1 arms are
iron and hardwood — so steel sits at the 25% floor however the market is arranged.

So `tools/era_scenarios.mjs` never assigns a price. It reads what the order book produces (the game's
own formula, on the scenario's own orders) and moves the one lever it has — **building counts** — until
the profit targets hold at whatever prices result. Supply and margin move opposite ways, so the feedback
is: earning more than target ⇒ build more ⇒ price falls ⇒ margin falls.

Two things set the scale, and they are different questions. **Ratios** between buildings come from that
feedback and are scale-free. **Absolute size** comes from the population, which is the one exogenous
number: total pop and peasant share per era, with every count then scaled so the buildings employ
exactly the working adults the non-peasant population provides.

### 10.4 Wage share is not a free variable

`W = base wage × Σ(employees × wage_weight)`, and both employment (vanilla, ~5000/level) and the base
wage (the era's SoL, via F26) are pinned. Measured across the config it lands at **10–40% of total
cost**. So obsolescence is **price-driven**, not wage-driven: what kills an old building is its output
price falling while its input prices do not. The ladder therefore works best for industries eating
**raw** inputs (food←grain, glass←wood, steel←iron+coal) and weakest for those eating **manufactured**
ones (motor←steel, automotive←engines), whose inputs deflate alongside their outputs.

### 10.5 Two invariants the solve must respect

- **One price rule per good per era.** `dye` is a plantation good until synthetics exists and a
  manufactured one afterwards. Running both rules at once made it converge to a stable *blend* that
  satisfied neither target — synthetics read −30% where −5% was asked.
- **The negative-goods floor.** A tier's main input can never be solved below the largest reduction its
  own secondary PMs can apply, or the building's total input for that good goes negative and
  `lint_negative_goods.awk` rejects the build. The invariant is hard and the profit target is soft, so
  the floor wins and the tier misses slightly.

### 10.6 Results (2026-08-03)

Converged: 0.000% price movement in the final iteration; PM selections settled at iteration 20 of 120
(frozen after 60), so no limit cycle. No tier infeasible — inputs never go negative and no price pins at
the engine band.

Profit targets at the **realised** prices, per era, counting only buildings the solver could actually
steer:

| era | year | within 8pp | mean abs. miss | floored at 1 level |
|---|---|---|---|---|
| 1 | 1836 | 19/22 | 3.8pp | 14 |
| 2 | 1870 | 25/30 | 6.3pp | 12 |
| 3 | 1900 | 33/40 | 7.1pp | 5 |
| 4 | 1920 | 30/40 | 4.7pp | 5 |
| 5 | 1935 | 33/41 | 3.2pp | 4 |

**Every tiered industry is on target in every era.** The entire residual is in raw producers, where
significant variance is accepted by design: a good has ONE price but several producers of differing
productivity (grain has five farms), so at most one can sit exactly on its own target.

**"Floored"** is a distinct category, not a miss: the solver wanted *fewer than one level* of that
building and could not have it. A single level already floods that good's market, the price sits at the
floor, and no count can rescue the margin. It is a real property of a one-country scenario with no
exports — art academies, vineyards and opium plantations are floored in every era. It shrinks as the
economy grows (14 → 4 from era 1 to era 5), which is the expected direction.

**Gold is excluded entirely.** No pop need lists it and no building consumes it, so its order book is
one-sided by construction and its mines read −68% at any scale. A target that cannot be moved by the
only lever available is not a target.

### 10.7 What automation does, un-asked

PMs are chosen per era by availability (the PM's own unlocking technology, vanilla era remapped 1:1)
and then by profit, with hysteresis (a switch must beat the incumbent by >2%, and selection freezes
after three sweeps). The emergent result: **automation turns itself on only at era 5** — assembly
lines, mechanised looms, automated bakeries, automatic bottle blowers — because that is when labour
finally becomes dear relative to the engines and electricity it consumes. Nothing asserts this.

It has a cost worth naming: automation also rescues *old* tiers, which is why six of the seven
"two eras stale" misses in the reference fit sit specifically at era 5.

### 10.8 Which production methods the solver may use

Vanilla gates production methods **eight** ways; the first version of this solver modelled three. The
result was not subtle — it selected `pm_herring_meal_farming_building_rice_farm` (gated on
`geographic_region_japan`) and `slave_exploitation_*` (violent-treatment plantation methods) for scenarios
containing zero slaves.

The rule now:

| gate | treatment |
|---|---|
| `unlocking_technologies` | satisfied by era (vanilla era remapped 1:1 onto ours) |
| `unlocking_production_methods` | satisfied only by a main PM present in the same building |
| `unlocking_principles` (power bloc) | never satisfied |
| `unlocking_identity`, `unlocking_company_categories`, `unlocking_geographic_regions`, `unlocking_religions` | never satisfied |
| `unlocking_laws` | satisfied only by a law in `SCENARIO_LAWS` |
| `disallowing_laws` | blocks only if it names a law in `SCENARIO_LAWS` |

`SCENARIO_LAWS = { law_slavery_banned, law_commercialized_agriculture }`.

**Why two laws and not zero.** The two law-gate kinds point in opposite directions — `unlocking_laws`
means "you must hold this", `disallowing_laws` means "you must not". Treating both as unfulfilled is not
the neutral choice; it is incoherent, and it lands worse than either alternative:

- **automation switches off.** Every automation PM (`pm_automated_bakery`, `pm_mechanized_looms`,
  `pm_automatic_bottle_blowers`, the `assembly_lines_*` family — 12 in total) carries
  `disallowing_laws = { law_industry_banned }`, a law an industrial country would never hold. The design
  brief requires automation to be choosable, so losing it is a direct contradiction.
- **slave exploitation switches on.** 25 PMGs have **no law-neutral member** — vanilla forces a flavour.
  That includes every plantation labour group (cotton, sugar, coffee, dye, tea, banana, rubber) and every
  subsistence group. With no laws held, the candidate set is empty and the UI's own default stands, which
  for those groups is `slave_exploitation_*`.

Two laws a modern country holds by definition is the smallest stance that yields no serfdom, no slavery,
no geographic or company special cases — and working automation. With it, exactly one PMG still has no
legal option (`pmg_ownership_building_company_headquarter`), and company headquarters are excluded from
these scenarios anyway.

**These PMs are not removed from the balance UI.** A human can still select any of them and read the
arithmetic. The restriction is on the solver, which has to build a scenario out of what an unexceptional
country can actually run.

**`tools/verify_pms.mjs` audits it.** It re-reads `common/production_methods` directly rather than our
own extract — so a bug in the extractor cannot hide behind it — and fails if any selected PM is not a
real vanilla PM or could not legally be run. Current result: **156 distinct PMs selected across the five
presets, none unreal, none illegal.**

⚠ Watch the **UTF-8 BOM** when parsing those files. Every one starts with one, so the FIRST production
method in each file is invisible to a naive `^name = {` match. That made six perfectly real PMs
(`pm_simple_farming`, `default_building_subsistence_farm`, `coffee_plantation_dry_process`, …) look
hallucinated on this check's first run. An **empty** gate block is likewise not a gate — vanilla ships
`unlocking_geographic_regions = { }` on `coffee_plantation_dry_process`, restricting nothing.

### 10.9 The value-added ceiling — 4:1, manufacturing only

**A manufacturing recipe may not turn £1 of inputs into more than £4 of output, at BASE prices.**
Extraction and agriculture are exempt: they are location- and labour-constrained rather than
input-constrained, and legitimately run enormous ratios (a coal mine consumes almost nothing but tools).

**Why it is needed.** Profit targets alone do not determine a recipe. Any output/input ratio can be made
to hit any margin by moving the other lever, so the solver was free to satisfy "+20%" by hollowing out the
recipe instead of by sizing the industry properly — and it did. Before the ceiling, 24 of 82 tiers
breached 4:1, including **art academy at 500:1, paper e3 at 245:1 (£11 of inputs for £2,700 of paper),
synthetics e2 at 133:1 and automotive e4 at 64:1**. A building with almost no input costs is cheap to run
in every later era, never becomes obsolete, and inverts the whole ladder. That was the visible symptom:
in 1935, synthetics read e2 +36% / e3 +31% / e4 +23% / e5 +14% — older tiers beating newer ones.

**It is an ECONOMIC anchor, not a physical one.** A "unit" of a V3 good is arbitrary and the game folds
product quality into quantity, so there is no real-world productivity figure to calibrate against. The
ceiling sidesteps that entirely: it says value added cannot exceed 75% of output value, and never needs to
know what a unit is.

**It costs nothing at base prices.** A +20% margin needs `I + W ≤ O/1.2`; with `I ≥ O/4` that is
`W ≤ 0.583·O`. The highest wage share anywhere in the ladder is `0.30·O`, so there is ~2× headroom.

**It converts insolvency into a closed-form test.** With the recipe floored at `O/4`, the best margin a
tier can reach at market prices is fixed:

```
margin_max = (p·O − q·O/4 − W) / (q·O/4 + W)
```

`p` = what its output fetches, `q` = its input price index. If `margin_max < target`, the industry cannot
hit its target at ANY recipe, and the only remedy is a smaller share of the market so its own price rises.
No search required. This is what turns "the solver quietly produced a factory with no inputs" into a
condition detectable before any damage is done, and it is the phase-1 feasibility signal a general
equilibrium solve needs.

⚠ **The clamp must apply to the INSOLVENT branch too.** `solveInputsAt` originally returned early when the
target was unreachable, which left the previously-hollowed recipe in place — so the exact tiers the ceiling
exists to catch were the only ones it never touched. An insolvent tier now gets the **cheapest legal
recipe** (exactly the cap) plus a report that it cannot reach its target.

**Persistently insolvent industries** (art academy in every era; shipyards in 1, 4, 5; synthetics in 2–3;
electrics and automotive in 3; steel in 1) are the honest output of that test: in a closed one-country
market with no exports, these cannot reach their target at any recipe or any size.

### 10.10 Counts are driven by PRICES, not by margin — the degeneracy that made the solver inert

**The bug.** `solveInputsAt` pins every era-appropriate tier to exactly its profit target, every iteration.
The count feedback was `count *= 1 + gain·(profit − target)`. If profit *is* the target by construction,
that is `1 + gain·0` — **the count solver multiplied by one and did nothing for the entire run**. It was
visible in the output and went unread for several rounds: every top tier in the 1935 scenario reported
exactly +20% — glass, tooling, paper, fertilizer, steel, motor, automotive, munition, electrics, all
identical. Counts were set by nothing but the initial guess and the population rescale, which is why
tools sat at 134% of base with demand 47% over supply and nothing corrected it.

Two levers were aimed at the same number, so one of them was inert. **Counts now target PRICES and inputs
target MARGIN**, and neither can cancel the other.

**The price path is not arbitrary — it is what the obsolescence targets arithmetically require.** A tier
whose inputs were solved to its target at its own era's price `P_old` earns `1.2·P/P_old − 1` later, so
−5% one era on needs `P/P_old = 0.79` and −30% two eras on needs `0.583` (≈0.76/era). The top tier cannot
survive below roughly 66% of base, because the 4:1 ceiling stops it cutting inputs further
(`P ≥ 1.2·(0.25 + W/O)`, with `W/O ≈ 0.3` measured).

Swept over 27 combinations; **`PRICE_START` dominates** (every 155 row beat every 130 and 140 row). Best:

```
PRICE_START 155   PRICE_DECAY 0.82   PRICE_FLOOR 75
```

⚠ A **relative** target — "0.82 × the previous era's realised price" — looks more principled, since the
rule constrains a ratio rather than a level. It measures **worse** (51 illogical points against 45 at the
time): the debut era then has no anchor at all and every later era inherits whatever it drifted to. An
absolute path re-anchors each era independently.

### 10.11 Illogicality: the scoring metric and where it stands

Three faults, counted per industry per scenario, summing (a top tier that is both loss-making and beaten
by the tier below it scores 2, because those are two separate things wrong with it):

1. the era-appropriate tier loses money
2. a two-eras-stale tier still turns a profit — it should have been driven out
3. the era-appropriate tier earns less than the tier one era below it — the ladder runs backwards

**Shipyards and art academies are excused.** Shipyards carry a deliberate −30pp target because no
naval-construction income is modelled, so one at −10% is exactly on target; art academies cannot be sized
by margin at all, because `fine_art`'s budget is fixed and extra academies only destroy their own price.

| | total | loss-making | stale-profitable | inverted |
|---|---|---|---|---|
| start of this pass | 73–77 | 24 | 22 | 27 |
| **now** | **35** (24 net) | **6** | **8** | **10** |

Per era: 2 / 7 / 12 / 9 / 5. Era 5 fell from 21 to 5.

**What moved it, in order of contribution:** price-driven counts (the fix above), the integer-floor
scale-up (§10.12), vanilla-calibrated peasant shares (F28), and removing the shipyard false positive.

**What did NOT move it:** the output multiplier. Swept 1.50 / 1.55 / 1.60 → 73 / 77 / 74, flat within
noise, and raising it makes the ladder inversion *worse* (27 → 32) because more supply depresses the price
of the good the top tier sells most of. A fixed-price argument for raising it does not survive contact
with an endogenous-price solver.

**The residue clusters in the deep chains** — synthetics, electrics, automotive, and to a lesser extent
steel, food, paper, explosives, fertilizer. These are exactly the industries identified at the outset as
structurally hardest: their inputs are themselves manufactured, so input and output prices deflate
together and the obsolescence mechanism has little to bite on.

### 10.12 The integer floor, and why scaling the market up is a real fix

Every price here is a ratio of buy to sell orders, so multiplying the whole economy changes nothing —
**except that a tier wanting 0.4 levels cannot have them and must sit at 1**, flooding its own market.
That integer floor is the only non-proportional thing in the model. Measured in era 1 before the fix: one
steel e1 plus one steel e2 sold 199 against a buy of 40, with pops buying no steel at all; groceries 162
against 74; paper 122 against 47.

The market is therefore scaled up until the **MEDIAN** era-appropriate industry reaches
`MIN_MAIN_LEVELS_BY_ERA` (5 / 5 / 10 / 10 / 10). ⚠ **Median, not minimum** — art academies and vineyards
want fewer than one level at *any* scale, so chasing the minimum never terminates and produced a country
of 10 billion people on the first attempt.

⚠ The honest cost: era 1 needs a very large market to clear that floor with 78% of its population in
subsistence. It is a **world-scale market**, not a single country, and should be described that way.
