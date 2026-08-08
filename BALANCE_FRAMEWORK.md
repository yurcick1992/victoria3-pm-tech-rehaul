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

### 10.6 Results (2026-08-03) — ⚠ SUPERSEDED, and measured in a non-final state (§10.14.1)

**Do not quote these numbers.** They were read off a state whose prices and recipes disagreed, and the
"converged" claim below measured only the main loop, not the closing passes that followed it. Current
results are §10.16.

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

### 10.11 ILLOGICALITY — the acceptance criterion a scenario set must clear

**This is the goal, not a diagnostic.** A scenario set is not ready to build on until it clears the bar
below. It exists because "the balance looks about right" is unfalsifiable, and because every earlier
target — break-even ladders, profit percentages, price paths — measured a *means* rather than the end.
The end is that the tech ladder visibly works: the newest tier pays, the one below it is marginal, the one
below that is driven out. Illogicality counts the times that fails.

| fault | acceptable total, all five eras | rationale |
|---|---|---|
| era-appropriate tier **loses money** | **~0** | a country's best available factory must be worth building |
| **two-eras-stale** tier still profitable | **in the teens** | some survivors are realistic; a market full of them is not |
| ladder **inverted** (newest earns less than the tier below) | **~0** | this one contradicts the mod's whole premise |

**Shipyards and art academies are excluded from the bar** (see below) — they are counted and reported, but
they do not have to clear it.

⚠ It is a COUNT, not a magnitude: a tier two eras stale at +1% scores the same as one at +50%. That is
deliberate — the question is whether the ladder holds, not by how much — but it means the metric cannot
rank two near-equal configurations, and a magnitude-weighted variant would be the thing to add if tuning
ever needs finer resolution than this gives.

Three faults, counted per industry per scenario, summing (a top tier that is both loss-making and beaten
by the tier below it scores 2, because those are two separate things wrong with it):

1. the era-appropriate tier loses money
2. a two-eras-stale tier still turns a profit — it should have been driven out
3. the era-appropriate tier earns less than the tier one era below it — the ladder runs backwards

**Shipyards and art academies are excused.** Shipyards carry a deliberate −30pp target because no
naval-construction income is modelled, so one at −10% is exactly on target; art academies cannot be sized
by margin at all, because `fine_art`'s budget is fixed and extra academies only destroy their own price.

⚠⚠ **THE FIGURES IN THIS SECTION ARE SUPERSEDED AND WERE MEASURED WRONG — see §10.14.1.** They were taken
from a state in which the solver had re-solved its recipes *after* its final price sync, so the profits
being counted were evaluated at prices those recipes contradicted. Under corrected accounting the same
configuration scores 65 total / 54 net, not 35/24. **Current state is §10.16.** The fault definitions,
the acceptance bar and the reasoning below all stand; only the numbers are void.

| | total | loss-making | stale-profitable | inverted |
|---|---|---|---|---|
| start of this pass | 73–77 | 24 | 22 | 27 |
| ~~then reported as~~ | ~~35 (24 net)~~ | ~~6~~ | ~~8~~ | ~~10~~ |

~~Per era: 2 / 7 / 12 / 9 / 5. Era 5 fell from 21 to 5.~~

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

### 10.13 CLOSED: the third price band was built, measured, and is NOT the lever (2026-08-04)

**Implemented, swept, kept — but it does not do what it was chosen to do.** The hypothesis below was that
the remaining illogicality sat in the deep chains because one decay rate deflates a chain's inputs and its
output together, and that giving intermediates a slower decay would open the gap obsolescence needs. It was
the single largest outstanding item in this document. It is now built (`targetPrice()` in
`tools/era_scenarios.mjs`) and the answer is that **the band separation is within noise**.

**How the split is decided — derived, not transcribed.** A tiered good is an **intermediate** if any ladder
industry (`follows_be !== false`) eats it as an input, and **finished** otherwise; anything no tier produces
is **raw** and stays flat at 100. That is the mechanism stated literally: a good is an intermediate exactly
when one tier's output price is another tier's input price, which is the coupling the band exists to break.

| band | goods |
|---|---|
| intermediate | dye, electricity, engines, explosives, fertilizer, paper, steel, tools |
| finished | ammunition, artillery, automobiles, clippers, clothes, fine_art, furniture, glass, groceries, small_arms, steamers, telephones |

Two calls worth recording, both settled by the derivation rather than by hand:
- **glass is FINISHED**, not intermediate as the original list guessed. No tier of ours consumes glass; its
  demand is `popneed_household_items`. Deriving the split rather than transcribing the list caught it.
- **clippers and steamers are FINISHED.** Their only industrial buyer is `port`, which is `follows_be: false`
  — held on vanilla economics and not on the ladder — so its appetite cannot define a band. They are
  otherwise pop leisure goods.

**The measurement.** 64 combinations of `PRICE_START` × `PRICE_DECAY` × `PRICE_DECAY_INT` under the
corrected solver (§10.14). Net illogicality across the whole grid runs 28–47 with no systematic gradient in
`PRICE_DECAY_INT`: 0.78, 0.82 and 0.86 all appear among the best rows and all appear among the worst. The
adopted `155 / 0.82 / 0.86` scores 30 net; the same start and decay with **no** separation at all
(`0.82 / 0.82`) scores 31. That difference is smaller than the surface's own jaggedness — neighbouring
parameter values routinely differ by 5 points, because counts are integers and the PM choice is discrete.

**Why it cannot work, in hindsight.** The two bands pull in opposite directions and roughly cancel. A slow
intermediate decay squeezes the stale tiers of industries that **eat** intermediates (automotive, electrics,
textile) — the intended effect, and it is real. It simultaneously **spares** the stale tiers of the
industries that **make** them (steel, tooling, motor, paper, fertilizer, explosives, synthetics), because
those industries' own obsolescence driver is their output price falling against flat *raw* inputs. Taking it
to the extreme makes this unmistakable: at `PRICE_DECAY_INT = 1.0` (intermediates never deflate) the
stale-profitable fault rises from 10 to 26. There are about as many industries on one side as the other, so
the sum barely moves.

**What actually moved the number** was not the price path at all — it was three defects in how the scenario
was built and reported (§10.14). The band is kept because it is principled and costs nothing, not because it
is load-bearing. **Do not spend further effort tuning the price path**; the gradient is not there.

<details>
<summary>The original hypothesis, kept for the record</summary>

The remaining illogicality sits almost entirely in the **deep chains** — synthetics, electrics,
automotive, and behind them steel, explosives, fertilizer, paper. Their inputs are themselves
manufactured, so §10.10's price path deflates input and output *together* and leaves no gap for
obsolescence to open. This was predicted before any code was written (§10.4) and remains the single
largest structural gap.

**The agreed fix has never been built.** A third price band was chosen early on: raw goods flat,
**intermediates deflating slowly**, finished goods deflating fast. Every price path since has instead
treated all manufactured goods identically — `targetPrice()` applies one `PRICE_START`/`PRICE_DECAY` to
everything with a tier. Restoring the split is a small change to that one function:

- **raw** (extraction, agriculture) — flat at 100, as now
- **intermediate** (steel, tools, engines, electricity, fertilizer, paper, glass, explosives, dye) —
  a slower decay, so a deep chain's input bill holds up while its output falls
- **finished** (groceries, clothes, furniture, automobiles, telephones, fine_art, small_arms, …) —
  the current fast decay

⚠ Some goods are both, depending on era and on who is buying — `paper` is an input to explosives and a
consumer good; `engines` feeds ports, railways and automotive. Expect the split to need a judgement call
per good rather than a clean rule, and record the calls.

**Run this before concluding anything about the mod's premise.** The premise makes one falsifiable claim —
that a price gap between a tier's output and its inputs can push obsolete buildings out — and that claim
is *demonstrated* wherever the gap exists (manufactured 156 → 73 against raw near 100; stale-profitable
down to 8; era 5 from 21 illogical points to 5). What is unproven is whether it holds for chains that eat
their own sector's output, which is roughly nine industries of twenty-two. That is the question the third
band answers, and it is narrower than "does the premise work".

</details>

---

## 10.14 The three defects that were actually costing the scenarios (2026-08-04)

Chasing §10.13 turned up three defects in how a scenario is *built and reported*. None is a balance
question; together they were worth far more than any price path.

### 10.14.1 The solver reported and shipped a NON-FINAL state

**The single worst of the three, because it corrupts the yardstick rather than the economy.** The closing
sequence was three single passes in a fixed order — sync prices, optimise PMs, sync prices, re-solve
recipes — so whichever ran *last* invalidated the other two. The last was the recipe re-solve, which changes
what every era-current building buys, which changes prices. **The scenario therefore reported profits, and
shipped a `prices` table, that its own recipes contradicted.** Measurable, not theoretical: era-1 `iron` was
recorded at the 175 ceiling while the shipped order book said buy 831 against sell 990 — a price of 86.

Every illogicality figure in §10.11 and §10.6 was measured in that state and is **not comparable** with
anything measured after this. Under corrected accounting the same configuration scores **65 total / 54 net**,
where it had reported 38/35.

**The fix is an invariant, not a patch.** Prices, PM selections, recipes and counts are iterated to a joint
fixed point, and the state that is reported is the state that is shipped, with nothing mutated afterwards.
The final convergence runs with the PM choice **held fixed**, so the last thing to move is continuous.
The rule for anyone extending this: **never report or ship from a non-finalised state.**

⚠ The continuous part converges (residual 9–25pp in eras 1, 3, 4, 5); the **discrete** part does not.
`optimisePMs` never reaches a state where no building wants to switch, because thin-market goods
(luxury_furniture, porcelain, fruit, silk) flip between the 25 and 175 band edges when a single building
type changes method. This is now **reported per era** rather than being invisible. It is a real property of
running one PM per building type per market where a real market runs a mix.

### 10.14.2 The forward probe — an anachronism that broke every debut era

Each industry placed **one level of the NEXT era's tier**, to "show the ladder from both sides". It was
scored by nothing — every check filters to `era <= this era` — so it contributed supply and no information.
Harmless for a mature industry; fatal for a young one, because the probe is a ×1.5-*bigger* plant than the
tier beside it:

| era | good | supply | demand | of which the probe |
|---|---|---|---|---|
| 1 | steel | 199 | 36 | `steel_mill_bessemer` 101 of 166 (61%) |
| 3 | automobiles | 92 | 45 | `automotive_industry_mass`, more than the era-3 tier |
| 3 | telephones | 184 | 32 | `electrics_industry_radio`, more than the era-3 tier |

All three were exactly the goods reported as "insolvent at these prices". The good sank to the 25% floor,
the era-appropriate tier read insolvent, and the count feedback then saw an over-supplied good and tried to
build *fewer* — which it could not, one level being the floor. It then poisoned the *later* eras too: the
tier had been given the cheapest legal recipe while its price was floored, so when the price recovered it
became the profitable old tier that should have died (`stale_profitable`, `inverted`).

It was also false on its own terms — a Bessemer converter (1856) standing in the 1836 scenario. **Removed.**
It also created the ceiling breaches of §10.14.3 that had *no producer at all*, by putting a building that
consumes dye/engines/steamers/electricity into an era where nothing makes them.

### 10.14.3 A glutted by-product could veto a starved input

Building counts follow the revenue-weighted geometric mean of their goods' price errors — right for two
goods that merely disagree, **wrong** when one good is starved and another glutted: the factors cancel and
the building never grows.

**WOOD is the case.** A logging camp running `pm_increased_hardwood` makes 20 wood and 20 hardwood per level
instead of 60 wood. Wood pinned at the 175 ceiling, hardwood dumped at the 25 floor, mean below 1 — so the
solver **shrank logging from 523 levels to 124** across eras 2→5 while wood's shortage tripled (era 5: buy
14 511 against sell 2 801). Wood feeds furniture, paper, tooling and glass, and pop heating besides.

Worse, `pmg_hardwood` is **bistable under a profit-only rule and has no stable side**: at the realised prices
`pm_no_hardwood` earns 213% against the incumbent's 34%, but switching removes the market's only hardwood
supply and pins *hardwood* at the ceiling instead. The two trade places forever (measured: a 150pp residual).

Both are fixed by §10.15's constraint rather than by naming any building.

---

## 10.15 THE INDUSTRIAL PRICE CEILING — a hard constraint

**No good that manufacturing can consume may reach +75% (the engine's 175% band ceiling).** −75% is
acceptable, and +75% is acceptable for a purely consumer good. What is not acceptable is an **input** pinned
at the ceiling: there the market has run out of any ability to signal scarcity — the price cannot rise
further however short the good is — so every industry downstream is priced against a wall, its recipe is
solved against a number that is an artifact of the band rather than of the market, and the count feedback
gets no gradient at all.

⚠ **THIS IS A SCOPE DECISION, NOT A CLAIM ABOUT THE GAME** (user, 2026-08-05). Those prices are entirely
reachable in play and the engine is content to sit at them. We exclude them because a pinned input inflicts
effects on **non-pop consumers that this model deliberately does not represent**, and a scenario in that
state is not a stable one worth balancing against. So a measurement showing the game holding a good at the
ceiling is **not** evidence against this constraint — expect to see it, and check first whether the good had
any non-pop consumer at that moment. Observed 1857–63: the British market held **steamers** at the ceiling
for six years on ~2 units of demand and zero supply, which is the *exempt* case, since nothing industrial
was buying steamers there yet. (`steamers` is nonetheless on the restricted list below, because ports eat it
in our ladder — "consumable by industry" is deliberately era-independent, see Scope.) This note exists
because that observation was briefly written up as the game contradicting the rule, which it is not.

**Scope, deliberately simple:** a good is restricted if it is an input to **any** production method reachable
in any of our industry buildings — main recipes and every secondary PMG, across every era. "Consumable by
industry", not "consumed right now": treating it as era-dependent would make the set change underfoot as the
PM optimiser moves. 25 goods: `clippers coal dye electricity engines explosives fabric fertilizer fish glass
grain hardwood iron lead meat oil paper rubber silk steamers steel sugar sulfur tools wood`.

Enforced in three places, each individually switchable (`ERA_CEIL_BOOST`, `ERA_CEIL_PM`) so its contribution
can be measured rather than asserted:

1. **The price path may not ask for it.** A restricted good's target is capped at `CEIL_TARGET` = 160.
2. **Counts: a breach outranks the weighted mean.** A restricted good at the ceiling forces its producers to
   grow regardless of what its co-products are doing — the fix for §10.14.3's wood.
3. **PM choice: a breach outranks profit.** A method selection is scored `profit − 100 × breaches`, so the
   constraint decides and profit only breaks ties. This resolves the hardwood bistability **without naming
   any building**: the middle method `pm_hardwood` is the only one leaving both goods inside the band, so it
   wins on the penalty though it loses on profit. That is the right answer, reached by the rule.

**Result: clear in all five eras** — no consumable good at +75% anywhere, from 11 breaches before.
Reported per era as pass/fail, and a breach names its producers, because "under-built" (counts can fix it)
and "no producer at all" (no count can) look identical in the price and need opposite remedies.

### 10.16 Where the scenarios now stand (2026-08-04)

Measured under the corrected, self-consistent accounting of §10.14.1. **Not comparable with the older
figures in §10.6 and §10.11**, which were measured in the non-final state.

| | total | loss-making | stale-profitable | inverted | ceiling breaches |
|---|---|---|---|---|---|
| previous configuration, corrected accounting | 65 (54 net) | 27 | 17 | 21 | 11 |
| **now** | **41 (28 net)** | 12 | 14 | 15 | **1** (era 2 only) |

Per era: 3 / 7 / 11 / 9 / 11 (after §10.18's raw-producer rule, which improved it from 48/33).

⚠⚠ **THE SOLVE IS NOT A FIXED POINT ACROSS ITS OWN WRITE, and an earlier claim here that it was is
RETRACTED.** That check was invalid: `era_scenarios.mjs` sourced its config from `ui/data.js`, which is
*build output*, so `--write` followed by a re-run silently re-read the **previous** values and reproduced
its numbers exactly — which is precisely what a converged fixed point looks like. Once the build caught up,
the figures moved by nine points. `tools/econ_host.mjs` now loads `config/mod_config.json` directly, so
write → re-run has no build step inside it (see BUGS_AND_FIXES).

With that closed, the honest picture is:
- **A single run is deterministic** — consecutive runs reproduce the per-era figures exactly.
- **Repeated write → re-run cycles are not.** Measured over four cycles: 47, 51, 51, 48 total. The solve
  is **path-dependent on the recipes it starts from**: it re-solves them from whatever the config holds,
  writes the result back, and the next run starts somewhere else. It wanders rather than diverging, but
  any single figure is a point in that wander, not a converged value.

So quote this number as *the current configuration's score*, never as *the solver's answer*. Making the
write cycle converge is open work, and it is a prerequisite for tuning anything against this metric.

Adopted path: `PRICE_START 155 · PRICE_DECAY 0.82 · PRICE_DECAY_INT 0.86 · PRICE_FLOOR 75`.

### 10.18 NO LOSS-MAKING RAW PRODUCER MAY BE PRESENT — and it can collide with the ceiling

**No extraction or agriculture building present in a scenario may run at a loss.** A market that operates a
mine or a plantation at a loss is not a picture of an economy; nobody runs one. The rule is stated on
**non-zero** producers, which names its own remedy: don't build it. That is the economically honest escape,
and it is self-limiting — removing a producer raises its good's price, which routinely rescues the others
sharing that price.

Enforced greedily and **minimally**: converge, drop the single worst offender, re-converge, look again.
Dropping them all at once would delete producers the constraint never required.

⚠ **Gold is exempt**, for the reason it is exempt from profit targets: no pop need lists it and no building
consumes it, so its order book is one-sided by construction and its mines read about −68% at any size. That
is an artifact of not modelling gold as money, and dropping every gold mine would delete gold from the
economy to fix a number.

⚠⚠ **THIS CONSTRAINT AND §10.15's CEILING CAN CONFLICT, AND THE CEILING WINS.** Dropping a producer removes
supply, so it can push a good manufacturing consumes to the +75% ceiling — or leave it with *no producer at
all*. Measured on the first unguarded run: dropping the era-1 iron mine left 1836 with **704 iron demand and
zero iron supply**, and dropping the era-3 rubber plantation did the same to rubber. A market with no iron
in it is a worse falsehood than a marginal iron mine, so a drop that breaches the ceiling is **undone** and
the building is **protected and reported by name**. A raw producer that must run at a loss because it is the
market's only source is a finding about the scenario, not something to absorb quietly.

⚠ **Ordering is the correctness of the loop.** Each round must *begin* from a converged state. Checking the
constraint and then running a final convergence lets the state drift back across the line after the check —
measured: era-3 wheat, maize and millet settled at −1% and era 2 picked up two ceiling breaches, both after
the loop had declared itself satisfied. There is now no trailing settle at all.

**Result:** clear in eras 1, 2, 4 and 5. Era 3 keeps `rubber_plantation` at −50% as the market's only rubber
source. Drops are modest and plausible — `vineyard` and `rice_farm` in every era (both permanently floored),
`lead_mine`/`sulfur_mine` in 1836 (little demand for either yet), `whaling_station` in 1870.
**It also improved illogicality**, 48 → 41 total and 33 → 28 net: dropping unviable raw producers raises raw
prices, which is exactly the gap the manufacturing ladders need.

### 10.20 THE CONSTRUCTION SECTOR BUILT EVERYTHING OUT OF WOOD, IN EVERY ERA

**The largest single distortion found so far, and it ran for the whole project.** Every era's construction
sector sat on `pm_wooden_buildings` — the *era-0* method, 75 wood and 25 fabric per level — at 74–92 levels,
in 1935 exactly as in 1836.

**Why the optimiser could not fix it.** `optimisePMs` ranks a method by the building's profit margin. The
construction sector **sells nothing** (its output is construction points, a modifier, not a priced good), so
its margin is undefined, every candidate scores identically, and the incumbent — a PMG's first and most
primitive entry — never moves. The same hole applies to government administration and the military buildings.

**What it cost:**
- Construction bought **no iron, steel, glass, explosives, tools or electricity in any scenario.**
- It inflated wood demand by thousands of units. Wood was pinned at the **175 ceiling in four of five eras**,
  and §10.14.3's logging-camp diagnosis, while real, was treating a symptom: the missing demand-side half
  was here.
- Era-1 iron demand read 704 where the true figure is several thousand, which is why the iron mine looked
  unviable and had to be protected under §10.18.

**Two rules, and the construction sector gets both.**

1. **A building with no priced output runs the most ADVANCED method its technology allows** — it cannot be
   ranked by profit, so it must be told. Applies to government administration and the military buildings.
   ⚠ "Most advanced" is by **tech era, not list position**: `pmg_transportation_building_logging_camp` ends
   on `pm_log_carts`, the primitive one.
2. **The construction sector's method is HARDCODED per era and the solver takes it as given.** A frame
   material is a fact about the era, not a market outcome, and nothing should be able to drift it:
   **iron frame (e1, e2) → steel frame (e3, e4) → arc welded (e5)**.

**Its LEVEL COUNT is not solved either — it is a share of GDP.** A construction sector sells nothing, so no
margin steers it, and a share of *building levels* was the wrong unit anyway: what a country spends on
building things is a share of what it produces. `CONSTRUCTION_GDP_SHARE` = **10%** of gross output, and the
count follows from that and its goods bill. No circularity — it produces no priced good, so it contributes
nothing to the gross output it is measured against.

⚠⚠ **BE HONEST ABOUT WHAT THIS KNOB IS.** Neither investment nor government spending is simulated here, so
the construction sector is the one thing in a scenario that is **pure demand with no supply**. That makes it
a demand injection, and it means **almost any average profitability could be manufactured just by pumping
it**. It must therefore be a *stated premise*, never a lever to tune margins with: if a profit target is
ever "achieved" by raising this number, nothing has been achieved. It is written down here rather than
discovered in the numbers.

**Vanilla, under this same accounting** (construction goods bill ÷ gross output value, on the vanilla 1836
markets): Qing 0.66%, Russia 1.19%, Japan 1.61%, Britain 2.28%, France 3.76%, Austria 4.13%, USA 4.63%,
Belgium 6.30% — median ~3.0%, industrialised markets 2.3–6.3%. **10% is roughly double vanilla's industrial
end, deliberately**: modernising has to be *built*, and raising the demand for capital is the mod's point.

⚠ **It is re-sized on EVERY settle, and the achieved share is reported per era.** It takes no part in the
price/count feedback — it is never steered toward a margin and never enters `scaleOf` — but it must not be
computed once either: the economy grows by large factors during a solve, and a count fixed from an early,
small GDP would leave the shipped scenario nowhere near its stated share. Achieved: **9.4% / 9.7% / 10.0% /
10.0%** in eras 2–5. **Era 1 lands at 6.9% and is flagged `OFF TARGET`** — its construction inputs re-price
after the last sizing, which is a symptom of era 1 not converging (§10.16), not of a stale count.

⚠ **Era 4 is steel frame, not arc welded**, which differs from the initial expectation. Vanilla gates
`pm_arc_welded_buildings` on the `arc_welding` technology, which sits in **vanilla's era 5**, and this
project's standing rule is that technology is the one gate the solver satisfies freely, with the vanilla era
remapped 1:1 (§10.8). Overriding it here would be the solver helping itself to a technology, which is the
exact class of thing §10.8 exists to stop. Historically defensible too: arc welding existed in the 1920s but
did not become the normal way to frame a building until later.

**Effect on prices** (before → after):

| | e1 | e2 | e3 | e4 | e5 |
|---|---|---|---|---|---|
| iron | **25 → 100** | 102 | 101 | 99 | 105 |
| wood | 158 → 135 | **175 → 154** | **175 → 141** | **175 → 126** | **175 → 111** |

⚠ **Two traps hit while wiring this, both worth remembering.** (a) The hardcoded PM must be set *before*
anything checks whether the building is present — the count is now derived from the goods bill, so guarding
the method on `BLDNUM > 0` deadlocks the two and ships a scenario with **no construction sector at all**.
(b) `ui/econ.js`'s `refEcon()` does **not** return `Ith`/`Oth`, though `builder.html`'s copy of the same
function does (the fork noted in CLAUDE.md); reading `per.Ith` gave `undefined`, a zero cost, and the same
empty result. Compute the goods bill explicitly rather than depending on the forked half's return shape.

Illogicality lands at 51 total / 33 net, inside the write-cycle wander (§10.16), so this is **not a scoring
win and should not be reported as one**. It is a **correctness** win: the scenarios now contain a
construction sector that buys what a construction sector buys, and raw producers are viable in four of five
eras **without dropping any**, where before the rule had to remove several.

### 10.21 FREE ENTRY — a manufacturing industry over +25% grows until it isn't (post-solve tuner)

**This is a SCENARIO TUNER, not part of the solve.** By the time it runs the solve is finished: recipes, PM
selections and volumes are **final and must not move**. It adjusts exactly one thing — **building counts** —
and re-prices after each step. That is why it does not call `contSettle()`: that would re-solve input
recipes and undo the solve it exists to tune.

**The rule.** Any era-appropriate manufacturing tier earning more than **+25%** is built **one level at a
time** until it drops under the cap. A fat margin in a market anyone can enter is not an equilibrium.

⚠ **Fully revertable** — `ERA_PROFIT_CAP=0` disables it and the solve returns to its previous behaviour.
That is deliberate: this is a rule whose consequences are judged *after the fact*, so being able to take it
back out without unpicking anything is part of the design. `ERA_PROFIT_CAP_PCT` moves the cap.

⚠ **The +75% industrial ceiling still binds and outranks it.** Growing a manufacturer raises its demand for
inputs, so a step that pushes a consumable good to the band edge is undone and that industry stops growing —
the same precedence used when dropping loss-making raw producers (§10.18).

**It is gentle in practice:** 1 / 17 / 4 / 5 / 5 levels added across the five eras.

#### The sanity check — one pass, one fail

| era | manufacturing share of non-subsistence output | raw producers: median / max profit | over +50% |
|---|---|---|---|
| 1 | 27% | 66% / 294% | 10 |
| 2 | 35% | 54% / 235% | 10 |
| 3 | 47% | 64% / 175% | 10 |
| 4 | 56% | 52% / 174% | 10 |
| 5 | 58% | 54% / 151% | 12 |

✅ **Manufacturing is not oversized.** 27% → 58% across the eras, nowhere near the 90% alarm, and that
progression is what industrialisation ought to look like.

❌ **Raw-sector profits are too high, and this is now the clearest open defect in the scenarios.** Extraction
targets +20% and agriculture +10%; they are running at **medians of 52–66%** with **10–12 producers above
+50% in every era**, and maxima of 150–290%. It is not *caused* by free entry — §10.6 always reported the
residual as concentrated in raw producers — but the check names it instead of leaving it as "significant
variance accepted".

### 10.22 EXTRACTION AND AGRICULTURE HAVE NO TARGET — THEY HAVE A BAND (2026-08-04)

**Superseding the +20% / +10% raw targets.** A target says "this number should be 20%", and for raw
producers that was never true or useful: a good has ONE price and several producers of differing
productivity, so **at most one of them can ever sit on a target** and the rest were permanently logged as
misses no lever could fix. That was essentially the whole of §10.6's residual.

A band says what would actually be *wrong* — a mine running at a loss (nobody would operate it) or one
printing money (nobody would leave it alone). Between those, spread is real productivity difference and is
left alone rather than fought.

| | band |
|---|---|
| extraction | **0% … +400%** |
| agriculture | **0% … +200%** |

Extraction gets the wider ceiling because it genuinely runs enormous ratios — a coal mine consumes almost
nothing but tools — the same reason §10.9's value-added cap exempts it. Both bounds are enforced **in the
same loop** as §10.21's free entry, because they interact: growing a raw producer cuts its good's price and
can push a *sibling* producer below zero, so enforcing them in sequence has each pass undo the other.

**The effect on the profit-target score is large**, because the unmeetable half of it is gone:
8/8, 11/14, 9/17, 14/18, 15/18 within 8pp, mean miss 2–13pp (was ~30–65pp with raw producers scored).

**Result: eras 4 and 5 have all 22 present producers inside the band.** Three violations remain, each
reported with its reason rather than left bare:
- `tea_plantation` 294% (e1) and 235% (e2) — **its good is already at the 25% price floor, so extra supply
  cannot move the margin at all.**
- `rubber_plantation` −50% (e3) — kept as the market's only rubber source (§10.18).

⚠ **A rule that cannot reach its goal must say so and stop.** Before that guard existed, `tea_plantation`
consumed **all 400 tuner steps** in era 1 and still read 294%: the price was pinned at the floor, so every
level added achieved exactly nothing. The tuner now checks that a growth step actually *lowered* the margin
and blocks the producer when it did not.

### 10.19 The pop-need weights are CORRECT — and the art-academy explanation in this document was not

**Checked, because a wrong weight here would invalidate every demand number.** All **52 entries across 15
needs** in `ui/presets.js` match `common/pop_needs/00_pop_needs.txt` exactly — every `weight`,
`max_supply_share`, `min_supply_share` and `default`. **29 of the 52 carry a non-default weight**, so this
was a real thing to get wrong, and it is not wrong. Re-check with the diff any time the game patches.

The split rule matches the wiki: `purchase weight = weight × clamp(market share, min, max)`.
⚠ The wiki's own phrasing is ambiguous — it renders as `weight ⋅ (min < market share < max)`, which reads
either as a **clamp** or as a **boolean gate**. The two differ enormously for a high-weight, low-supply good
like `fine_art` (weight 4). The clamp reading is the one measurement supports: Belgian liquor is ~95% of its
market's intoxicant supply, and clamping predicts 199 against 201 observed where the alternative gives 102.

**But the reason this document gave for art academies is wrong.** §10.11 and `FIXED_COUNTS` rest on the claim
that *"fine_art's budget is fixed, so extra academies only destroy their own price"*. It is not fixed —
under the supply-share rule, more academies raise fine_art's share of `popneed_leisure` and therefore its
money. Measured on the era-3 scenario:

| academies | fine_art buy / sell | price | share of the leisure budget |
|---|---|---|---|
| 1 | 2 / 14 | 25% | 2.1% |
| 10 | 20 / 144 | 25% | 17.5% |
| 50 | 59 / 720 | 25% | 51.6% |
| 250 | 96 / 3600 | 25% | 84.2% |

**The real constraint is unit volume against a high base price.** `fine_art` costs **£200**, the dearest
consumer good, and units bought = money ÷ base price — so even 84% of the entire leisure budget (£19,209)
buys only **96 units**. One era-3 academy level produces **14.4**. Demand rises roughly 2.4 units per
academy while supply rises 14.4, so supply outruns demand about 6:1 at every count and the price sits on the
25% floor from the first level onward. The whole leisure need could absorb only ~8 academy levels even if
fine_art displaced services entirely.

So the conclusion (academies cannot be sized by margin) stands, the mechanism is different, and **the lever
is their output volume, not the demand model** — one level currently produces over 10% of the entire leisure
budget's worth of art. That is the thing to change if academies should be viable; `FIXED_COUNTS` is a
stopgap around a number that is simply too large.

### 10.17 The criterion is now LIVE IN THE BALANCE UI

The rule has exactly **one** implementation — `ladderFaults()` in `ui/econ.js` — called by both
`tools/era_scenarios.mjs` and the balance UI's **Ladder check** panel. The criterion that decides whether
the ladder works cannot have two definitions.

**It is scored on the buildings the scenario actually CONTAINS**, which is what makes it safe to watch
while tinkering:

- an industry with **no buildings at all** contributes **zero**, however bad its arithmetic looks;
- a tier whose **Number is 0** is invisible — never a fault itself, and never the comparison partner
  for one;
- **`inverted` requires both** the best tier present *and* a lower one present. A missing lower tier can
  never inflate the count;
- **`stale-profitable` is measured in ERA DISTANCE** (≥2) from the best tier present, not by position in
  a list, so a gap in the ladder cannot promote a one-era-old tier into a "two-eras-stale" one.

Zeroing things out can therefore only ever *lower* the count. Verified in the UI: emptying `tooling`
takes era 4 from 12 to 11 and drops its fault; keeping only the newest shipyard tier removes its
`inverted` fault rather than inflating it; emptying the whole scenario reports 0 problems, 0 industries.

⚠ **The panel and the solver's report answer slightly different questions, and will not always agree
industry-for-industry.** The panel scores the **stored** state — the config's recipes and the preset's
counts and prices, i.e. what was actually shipped. The solver's report scores the state it **just
re-derived** in that run. At era 4 both give 14 points, but two industries land in different categories.
That is the path-dependence above, seen from the side; it is not a disagreement about the rule.

**The bar in §10.11 is still not met** — ~0 loss-making and ~0 inverted, teens for stale-profitable. Net
loss-making is 19 and net inverted 14, both well above ~0. What is now true that was not before: the
measurement is honest, the hard constraint holds, the criterion is visible live in the UI, and the price
path has been eliminated as the lever.

---

## 10.23 `ladder_end`, fixed-count producers, model_only — the declared-but-absent rules, now built (2026-08-04)

Closing the gaps the §10.21 audit found. Each was design the documents asserted and the solver never did.

### plateau and extinct are enforced

**`plateau`** (food, textile, furniture, port — three that matter, port being infrastructure): the last tier
is permanent, so **its good's price stops deflating when the ladder stops**. Implemented in `targetPrice()`
by capping the good's "age" at its last tier's era. Without it the model demanded that a permanent tier keep
pace with obsolescence that has nowhere left to come from. Holding the price is what makes **Baumol's cost
disease fall out of the model** rather than being asserted: a sector whose productivity stops improving
becomes relatively dearer as the rest of the economy moves on.

**`extinct`** (sail shipyards): no floor at all, so the good keeps deflating past the point where anyone
would build one. That was already the behaviour — it is now *explicit*, which matters because "we chose not
to floor it" and "we never implemented flooring" look identical from outside. Measured: clippers now run
132 / 175 / 91 / **25 / 25** across the eras. The industry dies, visibly.

### Fixed-count reference producers, which may only shrink

The dye plantation was **deleted from every scenario** so synthetics would be dye's only source. That was
wrong in era 1, where synthetics does not exist and the plantation is the historically correct supplier, and
crude everywhere else because it *decided* the outcome instead of letting the market reach it.

Now: a stated count (**10**, a placeholder — see below) exists from era 1 and persists, **unless it cannot
turn a profit, in which case it sheds one level at a time** until profitable or gone. Obsolescence happening
rather than asserted — synthetics arrives, dye's price falls, plantations retreat as far as the market pushes.

⚠ **The ceiling guards the shrink**, and era 1 proved why: with synthetics absent the plantation is dye's
*only* source, so shrinking to zero left dye with demand and no supply, pinned at the band edge. Retreat now
stops where the market still has a supplier. Result: **era 1 supports 1 plantation** (1836 dye demand is
tiny), **eras 2–5 hold all 10**.

⚠ A fixed-count producer is exempt from the raw band's **upper** bound — it is hand-placed and may only
shrink, so growing it is not an available remedy. Reported as exempt, not as a violation.

⚠⚠ **THE COUNT IS A PLACEHOLDER.** 10 is reasonable-looking, not derived. "How many of an untiered producer
should exist" is intended to become a proper constraint for every industry; until then this is the one
hand-set case and is labelled as such rather than dressed up.

### model_only tiers are now visible

22 of 89 tiers are modelled but never emitted (no unlocking technology exists). The solver never read the
flag, so they are placed, priced and scored exactly like real tiers — which is the intent, but was an
unexamined assumption. Now **reported per era**: 0 / 0 / 2 / 9 / 22 present. A reader can see how much of a
late-era scenario rests on tiers the game cannot currently have.

---

## 10.24 The population chain — professions drive buildings (2026-08-04)

```
productive buildings -> their workforce
that workforce       -> the other professions, in vanilla proportions
                        (slaves 0 . peasants by era share . soldiers from the army)
GDP                  -> CONSTRUCTION            (10% of gross output, section 10.20)
peasants             -> subsistence levels, split across the subsistence TYPES
GDP                  -> battalions -> SOLDIERS
those professions    -> the non-economic / autoscaling buildings that employ them
all of the above     -> URBAN CENTRES (floor(sum of urbanization / 100), FINDINGS F13) - LAST, because
                        every building placed above contributes urbanization
and back             -> productive building counts, chasing profit goals under the constraints
```

**The direction is the point.** Support buildings used to be placed at a fixed **share of building levels**
(ownership 32%, government 6%, trade 3.5%), and the strata were read off whatever employment that produced
— so "how many aristocrats exist" was decided by an arbitrary constant. Now the professions are the
quantity with a claim to be right, and the buildings are sized to employ them. That also retires the weak
ownership-share restriction the constraints audit flagged.

**MEASURED, not chosen** — each non-productive profession's workforce as a ratio of total *productive*
workforce, median across the eight vanilla 1836 markets: clerks 0.0529, bureaucrats 0.0174, clergymen
0.0164, shopkeepers 0.0121, aristocrats 0.0078, capitalists 0.0028, officers 0.0024, academics 0.0015.
Laborers and machinists are excluded because their buildings are sized by their own rules (construction at
10% of GDP, urban centres by urbanization); soldiers because they come from the army.

### A profession has SEVERAL employers, and some are productive

⚠⚠ Sizing a building from a profession's whole target double-counts everyone already employed elsewhere,
and any building that is nobody's designated source is never placed at all. **Academics are 100% university
in vanilla; universities were in no list, so they were permanently empty** while art academies quietly
employed academics the model never accounted for. Bureaucrats defaulted wholly to government administration
for the same reason.

Each designated building is now sized from `target - what every OTHER placed building already employs of
that profession`, **including productive ones**, iterated four times because these buildings supply each
other's professions. Measured shares of each profession's non-productive employment (1836):

| profession | where it actually works |
|---|---|
| academics | university 100% |
| aristocrats | manor house 63.3% · government administration 36.7% |
| bureaucrats | government administration 98.6% · construction 1.4% |
| capitalists | financial district 100% |
| clergymen | manor house 47.6% · government administration 33.1% · urban centre 16.5% · university 2.7% |
| clerks | urban centre 50.2% · government administration 27% · trade centre 18.9% |
| shopkeepers | urban centre 69.8% · trade centre 20.7% · financial district 9.5% |

Professions with no designated building (clergymen, shopkeepers, officers) fall out of the buildings placed
for others — which is what the vanilla data says actually happens. Universities now appear: 16–47 levels.

⚠ These are **1836** shares, not late-game ones. No session carries the `building_inventory` metric, so
late-game telemetry does not exist yet; swap these numbers in when it does.

### Subsistence is split across TYPES

Every peasant used to land in `building_subsistence_farm`. Vanilla's mix, by level share, is rice farm
59.7%, farm 37.4%, pasture 2.5%, orchard 0.2%, fishing village 0.2%. The split is applied by **workforce**,
not by levels, because a rice paddy holds twice what a farm does. ⚠ This is the WORLD 1836 mix and is
therefore rice-heavy — vanilla's proportion as specified, not a temperate-country one.

### SOLDIERS EXISTED NOWHERE, and now do

**No military building was placed in any scenario.** V3 puts a barracks' manpower in the *battalions* it
hosts — `building_barrack` carries no employment at all, and its PMs carry no goods — so nothing ever
created a soldier. The scenarios ran armies of 545–879 battalions that bought small arms and ammunition
while employing nobody, paying no wages and eating nothing.

A battalion is **1 000 serving soldiers**; they are working adults, so the people behind them are
`1 000 / working-adult ratio`. Barracks are placed 1:1 with battalions — free, since they employ nobody and
consume nothing.

| era | battalions | soldier people | inside a lower stratum of |
|---|---|---|---|
| 1836 | 545 | 2.18 M | 33.5 M |
| 1870 | 759 | 3.04 M | 50.8 M |
| 1900 | 793 | 2.64 M | 41.6 M |
| 1920 | 879 | 2.66 M | 38.4 M |
| 1935 | 845 | 2.11 M | 32.5 M |

⚠ **Ordering is the chain**: `setArmy` must run *before* `setPops`, or the soldier count is always one
iteration stale — which in a damped loop reads as a permanent undercount rather than as a lag.

### Known circularities, stated rather than hidden

The chain closes on itself twice, deliberately: productive buildings -> professions -> buildings ->
productive buildings, and GDP -> army -> soldiers -> consumption -> GDP. Both are fixed-point iterations,
and the second is *positive* feedback. They are damped by the same machinery as everything else.

## 10.25 Write-cycle convergence — CLOSED, a strict fixed point (2026-08-05)

**`config/mod_config.json`, `config/era_presets.json` and the whole printed report are now byte-identical
after every `--write` -> re-run cycle**, verified three generations deep. The score is a number that can be
quoted. What follows is the four causes and how each was closed, because the last one hid behind the first
three for a week.

Section 10.16 recorded that repeated `--write` -> re-run cycles wandered (47 / 51 / 51 / 48). Four causes:

1. **The recipe MIX drifted.** Inputs were rescaled in place and each good rounded to 0.1, so every re-solve
   quantised the proportions differently and `--write` saved the drift for the next run to inherit.
   **Fixed**: the solve scales a canonical *ratio*, frozen into the config as `input_ratio`. The 22 invented
   (`model_only`) tiers have no vanilla recipe to fall back on, which is exactly why freezing was needed.
2. **The starting SCALE was an input.** Each run opened from the previous run's volumes, took a different
   trajectory through a search containing discrete choices (PM selection, integer counts) and could settle
   in a different basin. **Fixed**: every tier is reset to `ratio x X0` before the solve, X0 fixed by the
   4:1 cap — a definition, not a remembered number. Stored volumes are now purely an output.
3. **Floating-point renormalisation.** A frozen ratio was re-normalised on load; its sum is
   1.0000000000000002, so it shifted by an ulp every generation. **Fixed**: used verbatim.
4. **THE FROZEN RATIO NEVER ARRIVED.** `ui/econ.js`'s `makeTiers` — which normalises the config into the
   model both the UI and the solvers run on — did not copy `input_ratio`. So `t.input_ratio` was
   `undefined` inside `era_scenarios.mjs` and the entire "frozen" branch of (1) was **unreachable dead
   code**. The 67 tiers with a `vanilla_pm` fell through to the vanilla recipe, which is invariant — which
   is exactly why eras 1–2 looked fixed and the fix looked half-successful. The **22 `model_only` tiers
   have no vanilla recipe**, fell all the way through to `t.inputs`, and re-derived their mix from the
   previous `--write`'s rounding every single generation. Eras 3–5 are where those 22 live.
   **Fixed**: `makeTiers` carries `input_ratio` (in `ui/econ.js` **and** `ui/builder.html`, which forks it),
   and the two divergent copies of the ratio logic inside `era_scenarios.mjs` were collapsed into one
   `ratioFor()`.

### 10.25.1 Where an invented tier's recipe MIX comes from

`ratioFor()` is the single definition, and its precedence is now **most-invariant-first**:

| # | source | covers |
|---|---|---|
| 1 | this tier's **own vanilla recipe** | the 67 real tiers |
| 2 | the vanilla recipe of the **nearest real tier below it in the same industry** | the 22 `model_only` tiers |
| 3 | the frozen `input_ratio` in the config, used **verbatim** | nothing, today |
| 4 | the current inputs | nothing, ever, if the config is complete |

(2) is not a new invention: `build_era_ladder.mjs` mints a `model_only` tier by **copying the goods set of
the tier below it**, so that tier's vanilla mix *is* this tier's mix by construction — and it is a game
file, where a frozen copy of a solved number is not.

**The run now prints which branch each tier took** (`RECIPE MIX (ERA_RATIO=vanilla): own 67 · below 22`),
and warns loudly if any tier reaches (4), because that is the one entry that carries state from the last
write. A branch that sat unreachable for weeks did so precisely because nothing ever said which branch ran.

### 10.25.2 The losing arm, measured — `ERA_RATIO=frozen`

The documented precedence had `input_ratio` **outranking** vanilla. Once (4) was fixed, that ordering also
produces a strict fixed point, and from the config as committed on 2026-08-04 it scores **43 points
(31 excluding shipyards/art academies)** against the canonical rule's **53 (38)**. It was still rejected,
and the reason is the whole point of this section:

**Those 43 points are not reproducible.** Run the documented pipeline from its first step —
`build_era_ladder.mjs --write`, which re-mints the 22 `model_only` tiers and therefore drops their
`input_ratio` — and the same rule scores **51 (36)**, because the ratios that earned the 43 cannot be
regenerated by any step of the pipeline. They were the *shadow of the bug*: a mix flattened by the 0.1
rounding and the negative-goods floor, then frozen. Measured against the canonical mixes they are not
subtle — `paper_mill_kraft` wood **0.333 vs 0.600**, `artillery_foundry_autofrettage` steel **0.333 vs
0.571**, `art_academy_sound_film` paper **0.333 vs 0.500**, and `food_industry_mechanised` sugar
**0.000644 vs 0.272727**. The recurring 0.333 / 0.500 / 0.250 is the signature: equal shares, which is what
a floor produces when it dominates every small term. The 67 real tiers agreed to **0.000%** either way, so
the whole 10-point gap is those 22 invented recipes.

So the choice was between a mix derived from game files and a mix derived from a rounding artefact, priced
at 2 points against the pipeline's own output (53 vs 51). The canonical rule wins on the criterion that
matters more than either number: **the config is now reproducible by the pipeline that claims to produce
it**, and the fixed point is a property of the code rather than of a file that must be preserved forever.
`ERA_RATIO=frozen` is kept so this can be re-measured rather than re-argued.

### 10.26 Population by profession (2026-08-04)

The class row is three wealth strata plus peasants and slaves, which is the unit **consumption** is computed
on — a buy package is a wealth level, not a job. But nobody thinks in strata; they think "how many
bureaucrats". So each scenario now carries `pops_by_profession`, and the balance UI shows it as a row under
the population row.

⚠ **Professions are additive DETAIL, never a second source of truth.** The class counts are their SUM and are
**read-only** whenever professions are present, so the two cannot disagree on screen. Editing a profession
recomputes its stratum, which flows into pop demand exactly as a class edit used to. Verified: the twelve
professions sum to 47 856 970 against strata of 47 856 970 in era 4, and moving bureaucrats by +1 000 000
moves the middle class by exactly that and back.

Soldiers appear here as a profession like any other, which is what makes the army visible in the population
rather than only in the order book.

## 10.27 The config is not reproducible by its own pipeline — port and railway (2026-08-05)

Found while proving §10.25: running the documented pipeline's **first** step,
`node tools/build_era_ladder.mjs --write`, on the committed config **changes it**. Two industries move:

| industry | committed `output_qty` | what the ×1.5 ladder wants |
|---|---|---|
| `port` | 9 / 20 / 30 | 9 / 14 / 22 |
| `railway` | 20 / 25 / 35 / 40 | 20 / 31 / 48 / 74 |

The cause is a rule that was half-applied. Commit `0cdc041` deliberately dropped **`follows_be: false`**
from port and railway, putting them "on regular terms" — solved, targeted and scored like every other
industry. `build_era_ladder.mjs` reads exactly that flag to decide whether the ×1.5 output ladder applies
(`const onLadder = ind.follows_be !== false`), so from that commit onwards it *would* re-slope both. It has
not been re-run since, so their volumes are still the vanilla ones the flag used to protect.

This is not a solver defect and it is not the write-cycle wander — `era_scenarios.mjs` never touches
`output_qty`, so the config is a strict fixed point of the step that actually runs. It is a **staleness**:
the stored volumes are the output of a pipeline step nobody has executed against the current flags, so the
file cannot be regenerated from its own inputs.

⚠ It also matters for the ladder itself, because **`port` is a named repeat offender** — 2-eras-stale
profitable in eras 3/4/5 and inverted in 4/5 — and its output ladder was ×2.2 then ×1.5 rather
than ×1.5 throughout. A tier-2 port producing 20 where the ladder wants 14 is a tier-2 that is too good.

### 10.27.1 RESOLVED — the pipeline was run, and it is now a strict fixed point end to end

`build_era_ladder.mjs --write` was run and the ×1.5 ladder applied to both industries. Measured against
the state before it, on an otherwise identical configuration:

| | illogicality (excl) | per era | residual per era | price path | targets <8pp |
|---|---|---|---|---|---|
| vanilla port/railway volumes | 46 (29) | 3 / 4 / 9 / 15 / 15 | 5 / 12 / 4 / 9 / 1 | 65/97 | 75/86 |
| **×1.5 ladder applied** | **44 (27)** | 3 / 4 / 9 / 14 / 14 | 5 / 12 / 1 / 2 / 6 | 67/97 | 73/86 |

Two points is inside the jaggedness of §10.28 and is **not** the reason to keep it. The reason is that
**the whole documented pipeline is now idempotent**: `build_era_ladder.mjs --write` followed by
`era_scenarios.mjs --write`, run twice in succession, returns `config/mod_config.json` byte-identical and
prints an identical report. Before, step 1 of the pipeline changed the file the repository was shipping.

⚠ `build_era_ladder.mjs` on its own is still not a no-op after a solve, and is not meant to be: it re-mints
the 22 `model_only` tiers and so discards their solved volumes by design. That is why the pipeline order is
ladder → scenarios and never the reverse. What is now stable is the *pair*.

⚠ Port is still an offender — two eras stale and inverted in eras 4 and 5. Its output ladder was one cause,
not the cause.

## 10.28 THE COUNT CONTROLLER LIMIT-CYCLED — it needed a deadband, not more passes (2026-08-05)

`era_scenarios.mjs` claims to end in a joint fixed point over prices, PM choice, recipes and counts
(§10.14.1). It did not. Every era printed `PM optimality: ⚠ NEVER SETTLED` and a **continuous residual of
19–94pp** — the amount the *largest-moving price still changed on the very last iteration of the final
settle*. The scenario being reported was one arbitrary phase of an oscillation.

**It was not a matter of iterations.** Tracing the residual per iteration shows it never decays at all:

```
era 4 (last 20 of 40):  19 19 19 20 20 19 12 19 19 19 20 20 19 19 20 20 20 20 …
era 5 (last 20 of 40):  26 26 26 13 25 27 27 27 27 28 28 27 15 26 27 27 27 26 …
```

A flat band of constant amplitude is the signature of a **proportional controller driving a quantised
plant**. `stepCounts` moves each good's producers by `(realised/target)^gain`, but **building counts are
integers**, and at these market sizes one level of a thinly-produced good is worth ~20pp of price. A good
whose ideal count is 6.4 levels toggles 6 / 7 forever. The largest movers are exactly the goods with
fewest producers — clippers, explosives, fertilizer, automobiles, artillery, silk. `ERA_JOINT=24` tripled
the passes, still never settled, and scored slightly *worse* (55 against 53). This is the integer floor of
§10.12 showing up in the controller rather than in the prices.

### 10.28.1 The fix: a deadband with hysteresis — enter at 8pp, leave at 15pp

The price path is a target with a **stated tolerance**: the report itself calls a good realised when it is
within 15pp. Movement inside that tolerance is not signal, so the controller now stops chasing it.

A *flat* band cannot do both jobs, and the sweep says so plainly. Narrow tracks well and still cycles; wide
converges and stops tracking:

| deadband | illogicality (excl) | residual per era | price path | profit targets <8pp | mean off |
|---|---|---|---|---|---|
| **0** (as shipped) | 53 (38) | 65 / 39 / 37 / 20 / 26 | 66/97 | 60/85 | 11.0pp |
| 5 | 52 (36) | 58 / 96 / 17 / 19 / 28 | 66/97 | 65/84 | 9.3pp |
| 8 | **45 (30)** | 61 / 85 / 3 / 19 / 28 | **71/97** | 70/84 | 7.1pp |
| 10 | 50 (34) | 61 / 82 / 35 / 4 / 11 | 68/97 | 66/84 | 7.4pp |
| 15 | **45 (31)** | 4 / 96 / 1 / 9 / 6 | 60/97 | 69/83 | 6.8pp |
| 20 | 46 (29) | 6 / 2 / 5 / 16 / 10 | 51/97 | 70/82 | 5.8pp |
| 25 | 60 (44) | 2 / 105 / 8 / 6 / 11 | 43/97 | 67/84 | 7.4pp |
| 35 | 68 (52) | 41 / 91 / 4 / 1 / 3 | 37/97 | 69/82 | 6.0pp |

So the band a good must **enter** is narrow and the band it must **leave** is wide: it is pursued until
comfortably on the path, then tolerates drift before being pursued again. Measured across four hysteresis
pairs, **8 → 15 wins on every secondary criterion at an illogicality that is statistically tied for best**:

| variant | illogicality (excl) | residual per era | price path | profit targets <8pp | mean off |
|---|---|---|---|---|---|
| flat 8 | 45 (30) | 61 / 85 / 3 / 19 / 28 | 71/97 | 70/84 | 7.1pp |
| flat 20 | 46 (29) | 6 / 2 / 5 / 16 / 10 | 51/97 | 70/82 | 5.8pp |
| hysteresis 5→20 | 49 (32) | 1 / 20 / 10 / 1 / 27 | 67/97 | 71/85 | 6.1pp |
| **hysteresis 8→15** | **46 (29)** | **5 / 12 / 4 / 9 / 1** | 65/97 | **75/86** | **5.7pp** |
| hysteresis 8→20 | 52 (36) | 61 / 4 / 1 / 3 / 1 | 62/97 | 69/84 | 7.2pp |
| hysteresis 10→25 | 51 (35) | 47 / 27 / 14 / 3 / 1 | 56/97 | 72/85 | 6.1pp |

It is the **only** variant that converges in all five eras while holding tracking, and its profit targets
are far the best: **75 of 86 industries within 8pp of target, mean miss 5.7pp**, against 60/85 at 11.0pp
with no band at all. Landed and re-solved, the shipped configuration scores **46 points, 29 excluding
shipyards and art academies** (3 / 4 / 9 / 15 / 15), and remains a strict write-cycle fixed point.

⚠ **The price-path column is partly tautological** and must not be read as a straight regression: the
report scores a good realised at 15pp and the knob is measured in the same units, so a band of 20 or 35 is
*defined* to miss it. Compare bands against each other, not against the criterion they are made of.

⚠ **PM choice still never settles.** With prices now converged, the remaining `⚠ NEVER SETTLED` is a
genuine discrete limit cycle in the method choice, not the continuous half chasing a moving target. It is
reported honestly and is the next thing to look at, not a number to explain away.

⚠ **The response surface is jagged** — flat 8 gives 45, flat 10 gives 50, flat 15 gives 45. That is the
integer floor again, and it means a tuning result worth 1–3 points is not a result. The five-point rule
still applies to *design* changes even though the write cycle is now exactly reproducible.

## 10.29 WHY THE LATE-ERA LOSS-MAKERS LOSE — a debut good is trapped at the price floor (2026-08-05)

Every industry the run calls **INSOLVENT** ("even the 4:1 recipe misses target") is also **floored at
1 level**, and the two are the same fact: the tier is selling more than the market wants at any price, so
its output good sits at the 25% band edge and no recipe can cover the cost. Measured directly off the
shipped order book:

| era | good | buy | sell | price |
|---|---|---|---|---|
| 1836 | steel | **0** | 78 | 25 |
| 1900 | telephones | 18 | 72 | 25 |
| 1900 | automobiles | 20 | 36 | 41 |
| 1900 | fine_art | 8 | 54 | 25 |
| 1920 | fine_art | 15 | 84 | 25 |
| 1935 | fine_art | 40 | 130 | 25 |

**Era-1 steel has literally no buyer.** The earliest tier that eats steel is `motor_industry` in era 2, and
so are `arms_industry_rifles` and `shipyard_metal`; the construction sector only moves to
`pm_steel_frame_buildings` in era 3. So an 1836 market contains a steel mill and nothing that buys from
it — which is faithful to vanilla (1836 tooling runs on iron) but is scored as "the era-appropriate tier
loses money".

### 10.29.1 Two plausible remedies, both measured, both wrong

**Scaling the market does not help — it is scale-invariant.** §10.12's remedy for the integer floor is a
bigger market, so the floor was made a knob (`ERA_MIN_LEVELS_MULT`) and swept. At ×4 the era-3 market goes
from 89.7 M people to 308 M and 10 k building levels to 33 k, and **era-3 telephones are still at exactly
25 and automobiles at exactly 41**, with electrics still floored and still insolvent (best −27% against
−29%). Supply and demand grow together, so a tier that wants 0.3 levels at one scale wants 0.3 at four
times the scale. §10.12's own first sentence says this; the floor only bites when the wanted fraction
crosses 1, and for these industries it never does.

| min-levels × | illogicality (excl) | per era | price path | targets <8pp |
|---|---|---|---|---|
| **1** (shipped) | 44 (27) | 3 / 4 / 9 / 14 / 14 | 67/97 | 73/86 |
| 2 | 50 (34) | 3 / 4 / 9 / 17 / 17 | 65/97 | 70/84 |
| 3 | 45 (29) | 2 / 4 / 9 / 13 / 17 | 69/97 | 71/85 |
| 4 | 42 (27) | 2 / 4 / 8 / 10 / 18 | 72/97 | 81/86 |

**Cutting the debut tier's output does not help either — it makes the industry worse.** Setting electrics
and automotive tier-1 output to their measured era-3 demand (60 → 20 and 30 → 20) and letting
`build_era_ladder` rescale the chain scores **40 (25)**, apparently four points better. It is not a fix:
era-3 telephones are **still at 25**, and electrics goes from −29% to **−62%**. The improvement came from
era 5 and from reshuffling elsewhere, and era-4 telephones over-corrected to 175. Reverted.

The reason is the demand rule itself. Pop money is allocated **by supply share** (F22, the game's own
documented rule): a need's budget is split across its goods by `(sell − 0.5 × non-pop buy) / Σ`. So cutting
a good's supply cuts its share of the budget, which cuts its demand — the oversupply ratio barely moves,
and the industry is smaller *and* poorer. **A debut good cannot be priced up from either direction.**

### 10.29.2 The actual mechanism, and it is vanilla's

The trap is what a debut good shares its need with:

* `popneed_communication` = **{ transportation, telephones }**
* `popneed_free_movement` = **{ transportation, automobiles }**

`transportation` is sold in enormous quantity by urban centres, railways and ports — hundreds of levels of
each — so a new good's share of its own need is a rounding error, and it receives almost none of the
budget however much or little of it exists.

The institutional demand that would break the tie **exists, and arrives an era late**:

| PM | building | buys | unlocking tech | vanilla era |
|---|---|---|---|---|
| `pm_switch_boards` | government administration | 5 telephones / level | `central_planning` | era 4 |
| `pm_public_motor_carriages` | urban centre | automobiles | `combustion_engine` | era 4 |

Our era-3 scenario holds **196 levels of government administration and 427 urban centres**, all correctly
running the previous method. That is 980 telephones of demand sitting one era later than the factory that
makes them — against a total measured era-3 telephone demand of **18**. The gap is vanilla's own tech
tree, not our era mapping: the electrics industry unlocks one era before the government starts buying
telephones.

### 10.29.3 What is left, stated as a choice rather than resolved

This accounts for the largest single block of remaining illogicality — electrics, automotive and the art
academy are three of roughly five loss-makers in each of eras 3–5. Nothing here is a solver defect, so
none of it was "fixed":

1. **Accept it and say so.** A debut industry is unprofitable until its consumers arrive; that is real
   economic history and arguably what the mod should model. It costs illogicality points because the
   criterion cannot tell "the ladder is broken" from "this good has no market yet".
2. **Give the criterion a notion of a debut tier**, the way §10.17 already exempts a building the scenario
   does not contain. ⚠ Dangerous: §10.17 exists precisely because zeroing things out lowers the count, and
   an exemption written to make a number look better is the same move.
3. **Do not place an industry whose output good has NO buyer at all** — a strictly narrower rule than
   §10.18's, keyed on zero demand rather than on unprofitability. It would drop only the era-1 steel mill
   (buy 0) and is economically unarguable: a factory with no customers would not be built. Worth about one
   point.

⚠ **§10.19's arithmetic and the order book disagree about fine_art** and that should be re-checked before
anything is built on either. §10.19 argues the binding constraint is that fine_art costs £200, so even 84%
of the leisure budget buys only 96 units against one academy's 14.4 — i.e. demand *exceeds* supply. The
shipped order book says the opposite in every era: 8 against 54, 15 against 84, 40 against 130.

## 10.30 "EXTINCT" NOW MEANS THE INDUSTRY ACTUALLY DIES — and the chain dies with it (2026-08-05)

`ladder_end: extinct` was implemented as *"no price floor"* and nothing more (§10.23). So the scenario went
on placing **sail shipyards in 1920 and 1935, one level per tier, running at −84%**. That is not a dying
industry, it is a subsidised one, and nobody would operate it for a single year let alone a century.

**It did real damage downstream.** Those levels keep `clippers` supplied at the 25% floor, and the era-1
port eats clippers. In 1920 the oldest port tier earned **+95%** against the era-appropriate tier's +54%:
a perfectly inverted ladder, bought with an input the model had already declared obsolete. §10.4 says
obsolescence is price-driven — an old building dies because *its output* price falls while its inputs do
not — and an old tier whose *input* is itself an extinct good runs the mechanism exactly backwards.

**The horizon is the mod's own.** A tier two eras stale is meant to be gone (§10.11 fault 2), so an extinct
industry is no longer placed once it is two eras past its last tier. Sail shipyards therefore persist
through era 3 (winding down, at a loss, as they should) and are absent from eras 4 and 5.
`ERA_EXTINCT_GRACE` makes the horizon measurable; `-1` restores the old always-present behaviour.

### 10.30.1 Removing the producer alone is WORSE than leaving it — the chain must be finished

Measured, in order:

| | illogicality (excl) | per era | industrial ceiling |
|---|---|---|---|
| shipyards kept alive (before) | 44 (27) | 3 / 4 / 9 / 14 / 14 | clear |
| extinct industry dropped, nothing else | 40 (27) | 3 / 4 / 9 / 12 / 12 | ⚠ **BREACHED in eras 4 and 5** |
| **+ its consumers dropped too** | **42 (29)** | 3 / 4 / 9 / 12 / 14 | clear |

Dropping the shipyards on their own left the era-1 port **still buying clippers from nobody**, which put
clippers on the +75% ceiling in both late eras — a hard constraint (§10.15) that had been clear in all
five. A building whose input has no supplier anywhere in the market does not run at an infinite price; it
does not run. So a tier is no longer placed once every producer of one of its inputs is extinct.

### 10.30.2 The honest cost: this is +2 on the number that matters

**The excluded count went UP, 27 → 29**, and the acceptance target is stated on the excluded count. The
total fell 44 → 42, but most of that is shipyard faults disappearing along with the shipyards, and those
were already excused. In era 5 the fault count is unchanged at 14 and the composition shifted: `shipyard`
left the inverted list and `tooling` entered it.

It was kept anyway, on three grounds, and the disagreement is recorded rather than smoothed over:

1. It implements a rule the documents already claimed. A −84% industry held alive for a century is not a
   defensible scenario at any score.
2. The alternative that scores best (40) **violates a hard constraint**, and the ceiling outranks the
   metric everywhere else in this document.
3. Two points is inside the jaggedness measured in §10.28 (deadband 8 → 45, 10 → 50, 15 → 45), so it is
   not distinguishable from a re-shuffle.

⚠ **The clipper subsidy was NOT port's inversion fault.** Fault (3) compares the newest tier against the
one below it, which for port is era 4 against era 3 — `port_modern` (steamers + oil) against
`port_industrial` (steamers + coal). Port is still inverted in eras 4 and 5 and the era-1 tier was never
the reason. That is the next thing to look at for port, and it is a recipe question, not a scenario one.

## 10.31 WHY PORT AND RAILWAY RUN BACKWARDS — the old tier floats, the new one is pinned (2026-08-05)

Inversion (§10.11 fault 3) should be ~0 and is 4–5 per late era. After §10.30 removed the clipper
subsidy, the survivors are **port** and **railway** in both eras 4 and 5, plus tooling and paper. The
mechanism is one asymmetry, and it is general rather than specific to these industries:

**Only the era-appropriate tier is re-solved.** `solveInputsAt` runs on the current tier each iteration and
pins it to exactly its target (+20%). Every older tier keeps the recipe it was given when *it* was current,
and its profit then **floats** with prices. So the newest tier cannot rise above target, while the one
below it can rise without limit.

The only force pushing an older tier down is its **output** price decaying faster than its inputs (§10.4).
That fails precisely when a tier's inputs are manufactured goods on the same deflating ladder — which
§10.4 already warns about in general terms. Port is the clean case:

| tier | era | recipe | output |
|---|---|---|---|
| `port_industrial` | 3 | steamers 3.5 + coal 3.5 | 14 |
| `port_modern` | 4 | steamers 4.3 + oil 8.6 | 22 |

`steamers` costs **142% of base in era 3 and 50% in era 4**. Both tiers buy steamers, but only the era-4
tier is re-pinned to +20% after that collapse; the era-3 tier simply keeps the windfall. On top of that the
newer tier swaps cheap coal for oil, so the ×1.57 extra output does not cover the dearer input. Railway is
the same shape twice over (coal → electricity → oil).

⚠ **This is not a recipe that can be hand-tuned away**, because the tier that would need tuning is the one
the solver deliberately leaves alone — and leaving it alone is correct.

⚠⚠ **AND THE OBVIOUS REMEDY DOES NOT EXIST.** "Re-solve the older tier to §10.2's stale target (−5% one era
back, −30% two back)" is the first thing anyone will reach for, and it is **incoherent**: a tier has ONE
stored recipe, and a recipe is a property of the technology, not of the era you are looking at it from.
Solving `port_industrial` to −5% in era 4 would overwrite the recipe that made it +20% in era 3, where it
is the era-appropriate tier. That is why only the current tier is solved. Do not implement it.

Stated properly, the constraint is this: **for a fixed output ladder and a given price path, a tier's whole
profit trajectory is determined by one number** — its input scale. Pin that number at one era and every
other era follows from prices alone. So obsolescence is not a free parameter, and the honest options are:

1. **Solve each tier against its whole lifetime rather than one era** — a least-squares fit of the single
   input scale against +20% when current, −5% one era on, −30% two on, accepting a compromise on all three.
   This is coherent but needs an outer iteration across eras, because era N's solve would have to see
   era N+1's prices, and the eras are currently solved in sequence. A real architectural change.
2. **Stop a good's price from becoming a windfall for whoever still eats it** once its main consumers move
   on. Port's inversion is `steamers` at 142 then 50; nothing in the model connects that collapse to the
   fact that the tier still buying steamers is obsolete.
3. Accept inversion in industries whose inputs are themselves ladder goods — which §10.4 already predicts
   in general terms — and say so in the criterion rather than in a footnote.

⚠ Note that (2) is *not* the price-path sweep closed in §10.13. That swept the decay **parameters** of the
prescribed path; this is about a **realised** price collapsing 92pp between two eras on the supply side.

## 10.32 HOW MANY INDUSTRIES HAVE NO MARKET YET — the answer is one, and four fixes were measured (2026-08-05)

§10.29 left three options on the table and the question "is steel the only case". Both are now answered
by measurement rather than argument.

### 10.32.1 Which goods actually have no market

Scored off the shipped order book, every good supplied at ≥2× its own demand:

| era | good | buy | sell | ratio |
|---|---|---|---|---|
| all five | gold | 0 | 1 164 – 4 963 | **no buyer** — exempt by construction (§10.18) |
| 1836 | **steel** | **0** | 78 | **no buyer at all** |
| 1836 | fine_art | 0 | 12 | 27× |
| 1836 | dye | 6 | 33 | 5.5× |
| 1870 | **steamers** | 3 | 78 | **23×** |
| 1900 | telephones | 18 | 72 | 3.9× |
| 1900 | rubber | 14 | 44 | 3.2× |
| 1920/35 | fine_art | 14 / 41 | 84 / 130 | 6× / 3× |

**Strictly zero-buyer: steel in era 1, and nothing else** (gold aside). But the *producer-before-consumer*
pattern has exactly **two** instances, both one era wide:

| good | first produced | first eaten | by |
|---|---|---|---|
| `steel` | e1 `steel_mill` | e2 | `motor_industry` |
| `steamers` | e2 `shipyard_metal` | e3 | `port_industrial` |

`steamers` is the worse ratio of the two (23× against steel's infinite-but-tiny 78 units) and is **not** a
zero-buyer case, because pops buy steamers through `popneed_leisure`. Everything else in the table is the
supply-share trap of §10.29, not a missing consumer.

### 10.32.2 Three industries are placed an era EARLIER than their vanilla tech — deliberately

Checking every industry's debut era against its vanilla building's unlocking technology: **19 of 22 match
exactly.** The three that do not are all placed one era early, and they are precisely the offenders:

| industry | our era | vanilla tech | vanilla era | the spec's stated reason |
|---|---|---|---|---|
| `synthetics` | 2 | `aniline` | 3 | "Perkin's mauveine is 1856, not 1874" |
| `electrics` | 3 | `telephone` | 4 | "Bell 1876, first exchange 1878" |
| `automotive` | 3 | `combustion_engine` | 4 | "Curved Dash 1901, per the design brief" |

These are **conscious historical corrections, not oversights**, and they are the direct cause of §10.29's
"the consumer arrives an era late": `pm_switch_boards` is gated on `central_planning` (era 4) and
`pm_public_motor_carriages` on `combustion_engine` (era 4 — the *identical* tech the automotive building
needs). The gap is not vanilla's. It is ours: **the building was moved earlier by hand and the PMs that
buy its output were left on the 1:1 vanilla era remap.** Whether to move those consumer PMs too is a design
decision, and the cleanest statement of the open question.

### 10.32.3 Four candidate fixes, all measured, none a clear win

| arm | illogicality (excl) | per era | residual per era | targets <8pp |
|---|---|---|---|---|
| **as shipped** | **42 (29)** | 3 / 4 / 9 / 12 / 14 | 5 / 12 / 1 / 12 / 4 | 72/86 |
| motor industry → era 1 | 47 (37) | 3 / 6 / 12 / 16 / 10 | 61 / 99 / 5 / 3 / 12 | 69/85 |
| motor **and** railway → era 1 | 51 (37) | 3 / 10 / 15 / 12 / 11 | 138 / 136 / 28 / 13 / 12 | 62/85 |
| no-buyer rule, industry dropped | 39 (29) | 2 / 7 / 8 / 11 / 11 | 61 / 34 / 3 / 13 / 15 | 70/86 |
| no-buyer rule, industry zeroed | 45 (32) | 2 / 7 / 11 / 12 / 13 | 61 / 97 / 4 / 12 / 2 | 65/83 |

**Moving the engine industry to era 1 does not fix steel — it moves the hole to engines.** One motor level
buys 39.8 steel against a supply of 78, which is still a 2:1 glut and still the price floor, and the motor
industry is then itself floored with `engines` adrift at 25 (want 155). Adding railway at era 1 as well
**does** fix it — steel leaves the adrift list entirely and era 1's score is unchanged at 3 (1 excluding) —
but era 2 loses its railway tier and pays 4 → 10, the residual explodes to 138/136, and the mean target
miss triples to 17.5pp. ⚠ It is also an anachronism on the project's own terms: `atmospheric_engine` and
`railways` are both **vanilla era 2**, and the forward probe was deleted in §10.14.2 for exactly this.
(A historical case *could* be made — Newcomen 1712, Watt 1776, against an era-1 anchor of ~1750 — which
would make it the same kind of correction as the three above. It would need the same explicit argument in
the spec, not a numerical justification.)

**The no-buyer rule works and does not pay for itself.** Era 1 drops from 3 to 2 as predicted, and no
other era improves. Note which variant scores better and why: *dropping* the industry outright scores 39
against *zeroing* it at 45 — but dropping it also removes it from `placement`, which is what drives
`solveInputsAt`, so its recipe is never solved and the era where it does have a market inherits the
canonical start. The better number comes from a defect, exactly as in §10.25.2. The correct implementation
is the zeroing one, and it is worse than doing nothing.

**Shipped: option 1, accept it.** The rule is built and kept behind `ERA_NO_BUYER=1`, default **off**,
because it is a decision about what a scenario should contain rather than a defect fix — and because
every arm that touches era 1's composition blows the continuous residual from 5pp to 61pp, which would
undo §10.28.

## 10.33 PORTS GET A FIVE-ERA LADDER — and it closes the steamers gap (2026-08-05)

Port had three tiers at eras 1, 3 and 4, a ×2.2-then-×1.5 output ladder, and `ladder_end: plateau`. It has
been rebuilt as a normal five-era industry: **9 / 14 / 22 / 34 / 52** on the standard ×1.5 ladder, with
eras 2 and 5 invented (`model_only`, so not emitted) and the plateau flag dropped, since it now reaches
era 5 like any other industry.

| era | tier | inputs | infra |
|---|---|---|---|
| 1 | `port` | clippers 5.7 | 3 |
| 2 | `port_steam` *(invented)* | **steamers 2 + coal 2** | 4 |
| 3 | `port_industrial` | steamers 3.5 + coal 3.5 | 4 |
| 4 | `port_modern` | steamers 4.8 + oil 9.5 | 5 |
| 5 | `port_motor` *(invented)* | steamers 7 + oil 15 | 6 |

### 10.33.1 An invented tier can now carry its OWN recipe, and this is why it had to

`build_era_ladder.mjs` mints an invented tier by copying the goods of the tier below it, which is right
when the new tier is the same technology done better and **wrong when the era it lands in has changed what
the industry consumes**. The era-2 port is exactly that: iron screw steamers arrive in era 2
(`shipyard_metal`), so an 1870 port bunkers steamers, not the 1836 port's clippers. The `invent` spec
therefore accepts `inputs` (and `state_infrastructure`), used verbatim, with the ×1.5 ladder still setting
the scale. ⚠ Step 3 of the ladder had to be taught about it too — it re-derives an invented tier's inputs
from the tier below and would have silently undone the override.

`ratioFor` then does the right thing with no special case: no real tier below the era-2 port has a vanilla
recipe covering `{steamers, coal}`, so it falls through to the frozen `input_ratio` — the first time that
fallback has ever been load-bearing. The run now prints `RECIPE MIX: own 67 · below 23 · frozen 1`.

### 10.33.2 What it bought

**The steamers producer-before-consumer gap (§10.32.1) is closed.** Era-2 steamers were the worst
oversupply in the model at 23× — buy 3 against sell 78, pinned at the 25 floor. They now read
**buy 652 / sell 936, price 67**.

**Port's ladder is no longer inverted.** It has left the inverted list in every era. In 1935 the five
tiers read **−32% / −26% / +11% / +11% / +22%**, and in 1920 **−19% / −24% / +10% / +20%** — old tiers
losing money, the era-appropriate one on target, which is what the ladder is supposed to do and what port
conspicuously did not do before (§10.31: the era-1 port earned +95% against the modern one's +54%).

**Headline metric: 42 (29) → 41 (30).** Flat, and the excluded count is one worse. Eras 4 and 5 improve
(12 → 10 and 14 → 12) and era 3 gets worse (9 → 12), where a single level of the era-1 port still earns
+131% on clippers that the dying sail shipyards leave at the 25 floor — the §10.31 windfall, now confined
to one era instead of three. ⚠ Era 2's continuous residual rose from 12pp to 47pp; the era-2 port is a new
92-level building and the count controller has not fully settled it.

## 10.34 THE `max_supply_share` CLAMP — hypothesis RAISED, TESTED and REJECTED (2026-08-05)

> **⭐ RESULT FIRST: the shipped reading is right and the alternative is wrong.** Scored against the game's
> own consumption telemetry over seven 1836 markets, clamping the RAW supply share (what we ship) errs by
> **20.0 %** of pop spending and clamping the FINAL share errs by **24.2 %** — worse in **all seven**
> markets, none improving. **Nothing changed in the model.** The alternative survives only as an A/B
> switch, `S.SPLIT_MODE = 'final'`, so the result can be re-derived rather than taken on trust. The
> committed scorer is **`tools/testbed/score_pop_split.mjs`**; the full numbers are **FINDINGS F31**.
>
> ⚠ **This also refutes the mechanism, not just the fit.** The reason to want the final-share reading was
> that it hands a newly-invented good a guaranteed slice of its need — the bootstrap electrics and
> automotive need. 1836 contains that exact configuration: Russian heating, where wood is capped at 0.5 and
> **oil** is present but scarce. The reading predicts oil takes ~17 % of the heating budget; the game gives
> it **0.8 %** (9.4 units measured against 140.8 predicted). The game does not redistribute a cap's
> leftover to a barely-supplied alternative, so this is not the route to a debut good's demand.
>
> ⚠⚠ **REOPENED 2026-08-05 — FINDINGS F33.** Everything above stands *for the needs F31 measured*, but it
> is **not** the whole answer. F31's data is 1836, where `free_movement` and `communication` each have
> exactly ONE supplied good (F24 reports 0.0% error for them for that reason), so **the configuration that
> matters — a capped incumbent competing with a debut good — was never in the sample.** Measured in a 1903
> campaign it goes the other way: the **shipped** reading cannot generate the observed automobile demand
> at all, implying 100 662 units of transportation pop demand against a market total of 19 459 (5.2×).
> So 1836 heating refutes the final-share reading and 1903 free_movement refutes the raw clamp: **neither
> is the rule.** Do not read this section as "settled in favour of the raw clamp"; read it as "the raw
> clamp wins on multi-good needs and loses on two-good ones, and we do not yet know why."
>
> The rest of this section is the case as it was argued BEFORE the test, kept because the reasoning was
> good and only the measurement could settle it — which is the point.


**The hypothesis being tested** (raised by the user): in game, a newly-invented good's demand and price
spike on arrival, supporting several factories immediately; in our model a debut good's demand is a token
amount. Something must give a new good a floor share of its need.

**There is such a mechanism, and we have it in the data already** — but it is applied to the wrong
quantity, so it does nothing.

`popneed_communication` is `{ transportation (weight 1, max_supply_share 0.75), telephones (weight 2,
max 1.0) }`, and `popneed_free_movement` is `{ transportation (max 0.75), automobiles (weight 1.25,
max 1.0) }`. **Transportation cannot exceed 75% of either need.** Read as a cap on the FINAL share, that
entitles telephones to 25% of the communication budget from the moment they exist — precisely the
bootstrapping the hypothesis predicts, and in a large market that is hundreds of buy orders.

**What `needSplit()` does instead** (`ui/econ.js`): it clamps the *raw supply share*, then multiplies by
weight, then **re-normalises** — which hands the capped money straight back:

```
transportation raw share 0.999 → clamped to 0.75 → × weight 1   = 0.750
telephones     raw share 0.001 → not clamped     → × weight 2   = 0.002
normalised:    transportation 99.7%,  telephones 0.3%
```

The cap moves the answer by a third of a percent. A field Paradox bothered to author for 52 entries
cannot plausibly do that.

**The wiki is obsolete and self-contradictory, so it is not the evidence.** Its own page says both "the
maximum *weight* that can be applied to a good based on market Sell Order share" (our reading) and "a
maximum of 40% of the Basic Food need can be satiated with Meat" (the final-share reading). Its numbers
are stale — it says meat is 40% of basic food and furniture a 5% minimum of household items, where the
shipped files say **0.9** and **0.1**. The game's own tooltip is the better clue: it renders
`GoodsList.GetPopConsumptionRatio` as *"X% of the need is filled with good Y"* — the final share.

**The internal evidence points the same way.** Under the final-share reading every clamp in the file is a
sensible design statement: no single food is more than 90% of a diet; wood at most 50% of heating; wine at
most 25% of intoxicants; each luxury item at least 10%. Under our reading, `popneed_basic_food` gives all
five goods `max 0.9`, which with five goods can almost never bind — an inert setting on the most important
need in the game.

⚠ **F24's calibration has NO POWER on this.** It reports misallocation of "0.0% for `standard_clothing`,
`services`, `free_movement`, `communication`, which have one unlocked good and so nothing to misallocate" —
telephones and automobiles do not exist in 1836. But the needs it names as our WORST errors are exactly the
ones with binding clamps: **heating 20.4%** (wood 0.5 / fabric 0.25 / coal 0.8), **basic_food 15.9%**
(all five at 0.9), **intoxicants 14.7%** (wine 0.25). So the 1836 data *can* discriminate — it simply has
never been asked to.

### 10.34.1 How it was tested, and what came back

All three steps ran. Step 2 was built exactly as specified — capped-proportional allocation, iterating
clamp-and-redistribute, with **caps yielding** when nothing that can actually supply the good is left to
absorb the money (the user's ruling: yield when the alternatives have *exactly zero* supply, not merely
little). `tools/econ_selftest.mjs` pins that yield rule, the bootstrap it produces, and the fact that the
two readings agree exactly where no cap binds.

| | shipped (`raw`) | alternative (`final`) |
|---|--:|--:|
| BEL | 18.3 | 25.6 |
| JAP | 36.2 | 37.5 |
| FRA | 29.2 | 34.5 |
| USA | 19.2 | 23.2 |
| RUS | 19.4 | 25.2 |
| CHI | 17.6 | 20.7 |
| AUS | 18.1 | 18.4 |
| **mean** | **20.0** | **24.2** |

Step 3 was therefore never reached: a reading that fits the game worse cannot be adopted for what it would
do to the illogicality score, which is the trap this document keeps naming.

**Why it fails is legible, not statistical.** The caps Paradox authored sit BELOW the concentration the
game actually shows, so binding them forces a diversification that does not happen: Russian heating is
79 % wood against a 0.5 cap, Qing heating 67 %. Under the final-share reading the excess has to go
somewhere, and it lands on goods the market barely has — Russian oil 9.4 measured against 140.8 predicted,
Qing tobacco 255 against 776, French coffee 126 against 205. The needs with the tightest caps degrade
most: heating **+11.1 pp** of within-need misallocation, luxury items **+6.5**, crude items **+5.1**.
Three needs improve slightly (intoxicants −2.8, leisure −1.1, simple clothing −1.0) and that is all.

**One rigorous test was attempted and did NOT fire, which is worth recording.** For a good belonging to
exactly one need, measured money is unambiguously that need's, and the sum over the need's goods
upper-bounds its budget — so `m_g / Σ` is a hard *lower* bound on the good's share. Any such good measured
above its own cap would refute the final-share reading outright, whatever the rest of the model does.
**No good clears that bar**, so the refutation rests on the fit, not on a contradiction. ⚠ The check is in
the scorer and it initially reported four violations, all artifacts: the log ring truncates, and summing
only the goods that survived under-states the denominator. It now requires **every** good of the need to
have been captured before it will judge — a verified block with no pop entry being a real zero.

**What is still open.** The observation that started this — a new good's demand and price spike in game —
remains unexplained and is still worth explaining; `max_supply_share` simply is not the mechanism. §10.29
lists what else is on the table for electrics and automotive. **→ §10.35 answers it, and it is not a demand
mechanism at all.**

---

## 10.35 A DEBUT GOOD'S CUSTOMER IS A BUILDING, AND WE WITHHELD IT — measured, fix built, NOT yet re-solved (2026-08-05)

⚠⚠ **CORRECTION, 2026-08-05 (user).** An earlier draft of this section claimed the customer "arrives with
the good" in game. **That was an inference from the technology gate and it is not established.** Unlocking
`pm_public_motor_carriages` only makes it *selectable*; whether urban centres actually switch to it is an AI
decision, and it very plausibly lags until pop demand has already built up. The claim below is therefore
about **availability**, which is all a tech gate can tell you. What the game actually does — the order in
which demand, price and the method switch move — is being measured (`schedules/debut_good_demand.json`), and
until that lands nothing here should be read as the in-game sequence.
⚠ The **model-side** half is unaffected by this, because it is about availability by construction: a method
the era gate forbids can never be selected, so era 3 genuinely has zero *reachable* building demand
whatever the AI would have chosen.

⚠⚠ **AND THE BASE GAME DOES THIS TO ITSELF** (FINDINGS F33, measured 2026-08-05). "The consumer arrives
before the producer" is **not** peculiar to our hand-moved industries. `pm_switch_boards` — the government
method that buys telephones — is gated on **`central_planning`**, a *different* technology from the one
that unlocks telephone production. In a measured campaign Britain acquired `central_planning` in **1901**,
switched a building onto switchboards, and demanded telephones from **1910** — nine years before the
`telephone` technology existed **anywhere on Earth** (world-first 1919.4, first production 1920.9, imports
zero throughout). So this section's diagnosis was right about the mechanism and wrong to treat it as
self-inflicted: our era remap makes an existing vanilla pattern worse, it does not create it.

**THE FINDING.** In vanilla each of these goods has **exactly one** building customer, and the technology
that unlocks the good also unlocks that customer:

| good | its only building customer | where | qty | unlocked by |
|---|---|---|--:|---|
| `automobiles` | `pm_public_motor_carriages` | **urban centres** (`pmg_public_transport`) | 1/level | `combustion_engine` |
| `telephones` | `pm_switch_boards` | government administration | 5/level | `central_planning` |

Urban centres number in the **hundreds of levels** per market, so `combustion_engine` — the very technology
that lets a country build a car plant — simultaneously creates hundreds of units of automobile demand.
That is the demand a newly-invented good gets in game, and it is **not a pop mechanism**, which is why
§10.34's search through the pop model found nothing.

**What our ladder does to it.** Three industries are placed one era EARLIER than their vanilla unlocking
technology as deliberate historical corrections. But production-method availability (`era_pm.mjs`) and
vanilla-building availability (`era_scenarios.mjs`) both gate on the technology's **own vanilla era,
remapped 1:1**. So the factory moves and everything else that technology unlocks stays behind. Read off the
**shipped** `config/era_presets.json`:

```
era3_1900   automotive T1 x1 makes 30 automobiles | electrics T1 x1 makes 60 telephones
            building demand REACHABLE this era:  automobiles 0   telephones 0
            (its 335 urban centres run pm_public_trams; gov admin runs no switchboards)
era4_1920   automotive x22 makes 711 | electrics x20 makes 1398
            building demand reachable:  automobiles 330   telephones 770
```

Era 3 is a **dead era by construction** for both: they produce into a market where no building is permitted
to buy from them, pops give them a rounding error, they sit floored at 1 level — and then era 4 switches the
customers on and the same industries jump to 22 and 20 levels. **That is the whole of §10.29's insolvency,
and no demand model could have fixed it.**

⚠ **The deeper cause is that our eras and vanilla's are not the same scale.** Ours anchor at
1750/1850/1900/1925/1940; vanilla's run pre-1836 / 1836-61 / 1862-86 / 1887-1911 / 1911-36. So our era 3
(1900) sits inside *vanilla's era 4*, and the pipeline's 1:1 remap is an approximation that mis-sorts
exactly the late-era technologies. The hand-moves are not the disease, they are where the mismatch bites.

### 10.35.1 The fix — built, default OFF, not yet measured

`tools/era_tech_sync.mjs`, enabled with **`ERA_TECH_SYNC=1`**. One technology gets one era: a tier's own
unlocking technology is made available in the era the ladder placed that tier, and everything else that
technology unlocks moves with it. Derived from the config, so the historical judgement stays stated once.

⚠ **It only ever LOWERS an era, and that asymmetry is the whole correctness of it.** The forced direction
is "the factory's own technology must exist where the factory does". The reverse is not forced — a
technology being available earlier than some tier that uses it is normal — and applying it withdraws
methods that are currently correctly available. Written the naive way ("whenever the two differ") the rule
made **18** changes, 12 of them unforced, including pushing every dynamite method out of era 3. Taking the
minimum leaves the **6** that are forced: `combustion_engine` 4→3, `telephone` 4→3, `electric_railway` 4→3,
`compression_ignition` 5→4, `gantry_cranes` 3→2, `aniline` 3→2.

**It fixes automotive and does NOT fix electrics** — stated plainly because the two look alike and are not.
`combustion_engine` carries `pm_public_motor_carriages` into era 3 with the car plant, which is the repair
of a genuine inconsistency. `telephone` carries no production methods at all: telephones are *made* by
`pm_telephones` (tech `radio`) and *bought* by `pm_switch_boards` (tech `central_planning`), so moving
electrics' customer would be a fresh historical judgement, not a repair. Left alone deliberately.

### 10.35.1a ⚠ THE LOCALITY ABSTRACTION — what our model does not represent at all (user, 2026-08-05)

**Every model here behaves as if the whole economy were a single state.** The game is not: it has states
inside markets, markets inside a world, and goods that move between them under rules we do not implement.
This is a **deliberate, permanent simplification** — there will be no multi-state model in the balance UI,
just as there is no multi-PM-per-building selection — but it must be held in mind when reading any
measurement, because effects we attribute to a demand rule may be locality artifacts.

⚠ **It is the reason a token demand against zero local supply is NOT automatically evidence against
`needSplit`.** A completely zero-supply good plausibly does take its true zero share, exactly as we model
it; what our single-state view cannot represent is a good that is supplied *somewhere else*.

**Open questions, none of them answered, recorded so they are not silently assumed away:**
1. Does one **market** receiving a need-fulfilling good make *other* markets' pops start demanding it? If
   so, is that additionally **tech-gated on the receiving side**, and how does the gate behave for a market
   shared by several countries with different technologies?
2. Does one **state** receiving a good make other states' pops demand it — **uniformly or not**? And are
   `local` goods (`services`, `transportation`, `electricity`) an exception, since they cannot move between
   states at all?

⚠ Any reading of a market-level order book inherits this. In particular the six years of unmet British
steamer demand (§10.35.1b) cannot be attributed to a production-method switch, to pop behaviour, or to a
locality effect on the evidence we have — the market line carries no channel split and no state detail.

### ⭐ 10.35.1a(i) THE LEADING HYPOTHESIS: we apply the right formula at the wrong GRANULARITY

**Not that the rule is wrong — that we feed it market-wide supply where the game may use local supply.**
The pop-needs fields are *moddable data the engine reads*, so their documented contract is comparatively
trustworthy (a field modders set must behave as described or mods break) — which is a stronger warrant than
prose about hidden behaviour, though still not proof. Take the formula as correct, then ask what supply
figure goes into it.

`needSplit()` uses **market-wide** sell orders. But `transportation`, `services` and `electricity` are
`local`: a pop consumes only its own state's supply. If the game computes each good's supply share against
**local** supply, then wherever transportation is thin, a tradable newcomer like `automobiles` takes a far
larger share than the market-wide aggregate implies.

**This single change reconciles every observation of 2026-08-05 without discarding any of them:**
- the documented rule stands, and our implementation of the *formula* is right;
- **F31/F24's good fit on 1836 needs** follows, because heating, food and clothing are all tradable, so
  market-wide ≈ local;
- **the two needs that break — `free_movement` and `communication` — are exactly the two whose incumbent is
  local**, which is otherwise an odd coincidence;
- **F33's impossibility dissolves**: pops never needed 100 662 units of transport, because transportation's
  share was never ~97 % in the states where the automobiles were actually bought.

### ⚠⚠ 10.35.1a(ii) THE TWO HYPOTHESES ARE OBSERVATIONALLY EQUIVALENT — and what resolves them

**"The newcomer's weight is understated" and "transportation's share is overstated" are the same equation.**
A need's budget is unobserved, so from the newcomer's demand alone only the RATIO of purchase weights is
recoverable: raising `w_new` and lowering `ms_transportation` move the newcomer's share identically. Every
"required weight" figure below can be re-read as a required transportation share, and the data cannot
attribute the discrepancy to numerator or denominator.

**Solved for the weight** (documented formula, market-wide supply, transport pops capped at half the
market), over 49 observations across both runs:

| good | documented weight | required weight, median | multiplier |
|---|--:|--:|--:|
| `automobiles` | 1.25 | **~4.9** | 3.9× (2.8–12.7) |
| `telephones` | 2.0 | **~4.8** | 2.4× (1.0–3.9) |

⚠ **Note what clusters: the ABSOLUTE weight (~4.8 for both), not the multiplier (3.9× vs 2.4×).** A
per-good weight error gives no reason for two different goods to need the *same* corrected weight; a shared
error in their shared incumbent does. Suggestive of the transportation reading — but only suggestive, since
the two are equivalent as above.

⚠ A first attempt to separate them (solving each need for the transportation share it implies, then
comparing the two needs at the same date and market) is **NOT valid as run**: it capped transport's pop
demand at half the market *independently per need*, double-counting, when transportation serves both needs
and the constraint is on their SUM. Its 0.29–0.93 disagreement is therefore uninterpretable.

**⭐ WHAT ACTUALLY RESOLVES IT: transportation's OWN pop demand**, which pins the budgets and makes the
system over-determined (transport serves two needs, so three observed demands against two budgets leaves a
spare equation to test the formula with). **That measurement is obtainable** — the channel split verified
43 transportation blocks in run 1 and 24 in run 2 (e.g. British 1853: total 8 220, pops 7 700). But
truncation left only **2 dumps** where transportation and a newcomer were captured together, one per run,
which is too thin.

**So the next run is well specified**: the channel split on **ONE market**, a short date list around the
newcomer's debut, and nothing else competing for the log ring — which should capture every good in the
need at every dump instead of 24–33 of ~44. That is a cheap, targeted run, not another full campaign.

⚠ **HYPOTHESIS, not a finding.** It is cheap to falsify: it predicts our accuracy should degrade as a
local good's weight in a need grows. F24's per-need error table already exists to test that, and `heating`
is the natural case — it contains `electricity`, a local good, alongside four tradables. ⚠ Note we will
NOT build a multi-state model regardless (§10.35.1a); the point of confirming this is to know what our
market-level numbers systematically get wrong, and possibly to correct the share input for local goods
rather than to simulate states.

### 10.35.2 MEASURED — it is not a win in any variant. Parked, default OFF

| variant | points | excluding excused | per era |
|---|--:|--:|---|
| **shipped (off)** | **41** | **30** | 3/4/12/10/12 |
| all six forced corrections | 49 | 36 | 3/7/13/15/11 |
| + customer test (drops `aniline`, `telephone`) | 49 | 36 | 3/7/13/15/11 |
| `combustion_engine` alone | **41** | **31** | 3/4/14/8/12 |
| `combustion_engine` + `compression_ignition` | 46 | 35 | 3/4/14/14/11 |

**The aimed-at effect is real and visible**: under the correction `automotive` leaves era 3's loss-making
list exactly as predicted, and era 4 improves 10 → 8. But the money moves rather than appearing — era 3
worsens 12 → 14 — and the best variant lands on 41/31 against 41/30, i.e. **a wash, well inside the jagged
response surface** (§10.28: deadband 8 scores 45, 10 scores 50, 15 scores 45). By the five-point rule that
is not a result.

⚠ **The customer test does NOT isolate automotive**, which is why `ERA_TECH_SYNC_ONLY` exists: ports buy
`steamers` and trains buy `engines`, so `gantry_cranes` and `electric_railway` satisfy "this technology also
gates a customer of the tier's good" just as `combustion_engine` does. Only an explicit allow-list separates
them, and that is a measurement knob, not a design.

**Left OFF and parked.** The reasoning behind it still looks right, and the one thing it was aimed at does
happen — but it does not pay for itself, and its premise about *in-game* timing is exactly what the
correction at the head of this section says is unverified. Revisit once the run says what the game actually
does; do not ship it on the argument alone.

---

## 10.36 ⭐⭐ THE WITHIN-NEED SUBSTITUTION RULE IS SOLVED — and it changes one thing in our model

**FINDINGS F40 (2026-08-07).** The rule the game uses to divide a pop need's money across its substitutable
goods is now measured end to end, against the purchase weights a **savegame stores** rather than against
anything inferred from an order book:

```
availability(g) = ( market sell orders(g) − 0.5 × NON-POP demand(g) ) × BASE price(g)
raw share       = availability(g) / Σ availability over the need's own goods
purchase weight = base weight(need,g) × clamp( raw , min_supply_share , max_supply_share )
units           = need money × (purchase weight / Σ purchase weights) / base price(g)
```

A gamestate's own supply and non-pop demand reproduce that same gamestate's stored weights to **0.82 pp
across 16 863 entries** in a VANILLA 1904 gamestate with every term on — replicated on four gamestates
across two arms and two decades (0.66-0.82 pp American, 1.13-2.46 pp British), every need under 1.45 pp.

### 10.36.1 What actually changed in `needSplit`, and what did not

**One line.** Availability is now a **value** (`supply × base price`) where it used to be a **unit count**.
Everything else the model already did was right: the −0.5 non-pop deduction (F22), the clamp acting on the
RAW share rather than the final one (F31), and `units ∝ purchase weight / base price` (F39).

Measured both ways, on two independent instruments pointing in the same direction:

| test | count-based (old) | value-based (F40) |
|---|--:|--:|
| within a fully clean need — British `luxury_food`, 4 goods | 8.15 pp | **0.59 pp** |
| within a fully clean need — American `basic_food`, 5 goods | 5.43 pp | **1.63 pp** |
| 1836 pop **consumption** telemetry, mean over 7 markets | 20.0 % | **18.3 %** |

⚠ **The 1836 line is the one that matters for confidence.** The change was derived from 1925 savegame
weights and then scored against a different instrument, in a different decade, in a different arm — and it
improved. `S.AVAIL_MODE = 'units'` restores the old reading for A/B measurement; it is not a setting.

### 10.36.2 Three terms of the real rule we deliberately do NOT model

Each is measured in F40, so the omission is a decision with a known size, not a gap:

- **Prestige goods** — `share × (1 + prestige_goods_demand_increase × prestige share of that good's supply)`,
  the increase being 0.5 by default and 0.75 / 1.0 in four needs. Measured against the save's own prestige
  output to within 0.6 pp on fish, coffee, opium and grain. Our scenarios contain no prestige goods, so the
  factor is 1 — but it is why a British `standard_clothing` entry reads 1.4065 where the rule alone gives 1.
- **Culture obsession** (a floor on the purchase weight of `clamp(obsMin × max_supply_share × weight, obsMin², obsMin)`) and **religion taboo**
  (`× 0.5`, exact). We have no culture dimension and will not add one.
- **`local` goods.** Their substitution supply is the state's own plus
  `(1 − the state's GDP share) × 0.25 ×` the market's production
  (`LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR`). ⭐ This is the mechanism behind the previously unexplained
  `transportation ÷ 1.6–2`, measured on three dates to within 2–8 % where ignoring it is out by 2.2× every
  year (F40).
  ❌ **"And our model needs no change for it" — WITHDRAWN, and the correction is §10.37 (F43, 2026-08-07).**
  The argument ran: a model whose one state *is* the whole market has a GDP share of 1, so the augmentation
  term goes to zero and market supply is already right. Every step of that is true and the conclusion is
  still wrong, because it answers the wrong question. What the substitution rule needs is not what the
  *market* holds but what a **pop** sees — and pops live in states. A state that is the whole market is not
  a representative state; it is precisely the one state for which the local rule does nothing.
  ⇒ We now model a **representative** state instead: a fifth of the country's GDP holding a fifth of the
  local supply, giving `0.2 + (1 − 0.2) × 0.25 = 0.40` of market supply. Measured against eight vanilla
  gamestates' stored weights it cuts local-good-need error from **4.23 pp to 0.84 pp**, better in 16 of 16
  market-dates. See §10.37.

### 10.36.3 ⚠ The debut ramp is SUPPLY, not a rate limiter — a claim I made and then measured

`MAX_DEMAND_ADJUSTMENT_BASE_AMOUNT` (0.01) and `MAX_DEMAND_ADJUSTMENT_SCALED_AMOUNT` (0.09) rate-limit how
far a pop’s demand for a substitutable good may move per update, so a stored weight is in principle a
trailing value. I took that to be the explanation for a debut good ramping instead of jumping. **It is not.**

Applying the local-goods rule to Midlands `communication` across the three 1923/24/25 saves, the observed
share sits on its computed target every year — 0.11497 against 0.11195, 0.15474 against 0.16900, 0.21214
against 0.21738 — with no accumulating lag. The ramp is the **target** rising as telephone supply goes
819 → 1 151 → 1 480. That is exactly what F32 and F37 measured from the order book, now confirmed from the
game’s own stored weights.

⇒ **Nothing hands a newly invented good a bootstrap share, and nothing holds it back either.** F31 already
showed the final-share reading of `max_supply_share` does not, and §10.32’s “consumer arrives an era late”
problem is therefore still a *supply-and-customer* problem, not a demand-rule one. Do not go looking for a
demand mechanism again.

### 10.36.4 ⭐⭐ THE DEBUT SPIKE, ANSWERED — and the one place our abstraction bites

Measured on the **vanilla control** campaign, where automobiles first trade in the American market at
**1902.1.1**. By 1904 the game gives automobiles **38.4 %** of `popneed_free_movement` on **513** units of
supply, against transportation's **8 550** — a sixteen-fold supply difference producing a three-to-two
share. That is the "spike", and two ordinary terms produce all of it:

1. **Availability is a value.** Automobiles cost £100 against transportation's £30, so 513 automobiles are
   worth 51 299 and the share is computed on that.
2. **Transportation is `local`.** A state sees its own supply plus a quarter of the market's
   (`LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR`), so New York's effective transportation supply is about
   **2 650**, not 8 550.

| date | automobiles supplied | target, MARKET transportation | target, LOCAL transportation | observed |
|---|--:|--:|--:|--:|
| 1902.4.1 | 83 | 0.02883 | 0.06840 | **0.04906** |
| 1904.1.1 | 513 | 0.21919 | 0.40166 | **0.38380** |
| 1906.1.1 | 903 | 0.22105 | 0.41521 | **0.41228** |

⇒ **No anomaly and no special debut mechanism.** A newly invented good punches above its supply because it
is expensive and its competitor is local — and it **plateaus** rather than climbing.

### 10.36.5 ✅ THE ONE-DIRECTIONAL BIAS THIS LEFT IN OUR SCENARIOS — DIAGNOSED HERE, FIXED IN §10.37

> **STATUS: CLOSED (F43, 2026-08-07).** This section identified the bias correctly and did not act on it;
> §10.37 is the acting. It is kept because the diagnosis is what the fix was built from, and because the
> reasoning error it corrects — answering "what does the market hold" when the question was "what does a
> pop see" — is worth being able to re-read. The numbers below describe the model **before** the fix.

§10.36.2 said the local-goods rule needs no implementation because our one state *is* the market. That is
right for the *market's* arithmetic and **wrong for a debut good's share**: the game's pops live in states,
and a state sees far less of a local good than the market holds. Our model therefore gave a local good its
full market supply and a debut good **21.9 %** where the game gives **38.4 %**.

**Affected needs are exactly those containing a `local` good**: `free_movement` (transportation),
`communication` (transportation), `leisure` (services), `services`, `heating` (electricity).

⇒ **Our scenarios UNDER-state a new good's pop demand in those needs, by roughly the factor the local rule
removes (~1.9× in the case measured).** This is worth holding against §10.32's "consumer arrives an era
late" conclusion: part of what looks like a missing customer for `automobiles`, `telephones` and
`electricity` is our own abstraction understating the pop side. It does **not** rescue the era-1 steel case
(steel is in no pop need at all), but it does mean the automotive and telephone shortfalls are smaller in
the game than in our model.

⚠⚠ **DO NOT CARRY THAT DIRECTION FORWARD — F43 REVERSED IT.** The shipped 0.40 discount slightly
**over**-corrects: automobiles in `free_movement` now predict 0.4124 against an observed 0.3768, where they
used to predict 0.2192. So the residual bias in the local-containing needs is now **upward** and small
(~3.6 pp), not downward and large (~15.8 pp). Anything reasoning from "our model under-states a debut good"
is reasoning from the pre-F43 model. See §10.37.2.

## 10.37 ⭐⭐ THE `local` GOODS FIX — we model a REPRESENTATIVE state, not the degenerate whole-market one

**FINDINGS F43 (2026-08-07).** This closes §10.36.5 and withdraws §10.36.2's "no change needed".

### 10.37.1 The rule and the constant

`services`, `transportation` and `electricity` carry `local = yes` in `common/goods`. Their **substitution**
supply — explicitly *"only for goods substitution supply and not for price calculations"* — is:

```
effective supply(state) = the state's OWN production
                        + ( 1 − the state's GDP share ) × LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR
                          × the MARKET's production                       (the factor being 0.25)
```

Our scenario has no state dimension, so it cannot compute a share. It can, however, stop pretending its one
state is the *whole market* — the single state for which this rule is a no-op — and model a **representative**
one instead:

```
the state's own supply = 0.20 × the market's
the state's GDP share  = 0.20
⇒ multiplier           = 0.20 + (1 − 0.20) × 0.25 = 0.40
```

`needSplit` multiplies a local good's **availability** by 0.40. `S.LOCAL_MULT = 1` restores the old reading
(env `LOCAL_MULT=1` through `econ_host`); it is an A/B switch, not a setting.

### 10.37.2 Measured, on the game's own stored weights

Eight **pure vanilla** gamestates 1901–1920 × two markets, scored against the purchase weights the saves
themselves store. Local-good needs, mean absolute error of the predicted share:

| arm | panel mean | worst cell | better in |
|---|--:|--:|--:|
| unaugmented (1.00) — the old reading | 4.226 pp | 5.650 | — |
| **0.40 — derived, shipped** | **0.835 pp** | 1.586 | **16 / 16** |
| 0.35 — the empirical optimum | 0.809 pp | 1.473 | 16 / 16 |

⭐ **The derived value lands 0.026 pp off the best constant available.** It was reached from the game's
formula plus two stated assumptions and *then* checked against the sweep — it is not fitted, and re-fitting
it to 0.35 would trade a derivation for 0.03 pp. The non-local half of the score is untouched (0.819 pp).

⚠ **The residual CHANGED SIGN: 0.40 slightly over-corrects.** Read as shares rather than as an error (the
table in F43), automobiles in `free_movement` go 0.2192 → **0.4124** against an observed **0.3768**, and
`leisure`'s services land at 0.2755 against 0.2319. The miss fell from 15.8 pp to 3.6 pp *and crossed over*.
That is very likely what the sweep was detecting when it preferred 0.35. Two consequences: the remaining
bias in these needs is now **upward**, reversing §10.36.5's direction; and 0.35–0.40 should be re-examined
against shares, not only against mean error, if this is ever revisited.
⭐ **The single largest gain is `leisure/services`, and it fixed six goods at once**: we gave services 48.7 %
of that need against the game's 23.2 %, and small_arms, steamers, opium, clippers, fine_art and automobiles
were each starved by exactly that surplus. Steamers and automobiles in leisure now land at 0.00 and 0.01 pp.

⚠ **The factor multiplies the WHOLE availability**, `f × (supply − 0.5 × non-pop) × base`, not the supply
alone. Scaling supply while deducting a whole market's industrial demand drives electricity to zero and
**drops those entries from the score**, which makes the low end of that variant incomparable rather than
merely worse. It is also the right statement about the world: our one state is a scaled-down market, so its
industry scales with its production.

### 10.37.3 What it does to the ladder: nothing, and that is the honest headline

Both arms re-solved to their own **strict fixed point**:

| arm | illogicality | excluding excused | per era |
|---|--:|--:|---|
| unaugmented | 41 | 28 | 2 / 5 / 12 / 11 / 11 |
| **0.40, shipped** | **43** | **30** | 3 / 9 / 9 / 8 / 14 |

**+2 points is inside the jaggedness** (§10.28 — a deadband sweep spans 38–48 on this same config), so by
the five-point rule this is neither gain nor loss. It ships because it is **measurably closer to the game**,
not because it scores better. ⭐ The aimed-at mechanism does work: `electrics` leaves the loss-making list in
**both** era 4 and era 5, and eras 3 and 4 improve 12 → 9 and 11 → 8; eras 2 and 5 pay for it (5 → 9, 11 → 14).

⚠ **Two apparent improvements were measured and REJECTED**, and it matters that they were rejected rather
than shipped:
- `ERA_NO_BUYER=1` scores **35 / 24**. §10.32.3 already established why: its better variant *drops* the
  industry from `placement`, so its recipe is never solved. The gain is the known defect.
- `ERA_COUNT_DEADBAND=10` scores **38 / 26**, but 9 and 11 score 41 and 39 — a ~3-point band with a
  one-point spike at its centre. Re-tuning a **convergence** parameter on the illogicality score is exactly
  the noise-chasing §10.28 warns about. (It *is* better on the smoother criterion — 79/87 profit targets
  within 8pp against 74/85, era 2's mean miss 16.4 → 7.4 pp — but it also introduces two `tobacco_plantation`
  limit cycles in era 4, and one good number inside a noisy band is not a reason to move a settled knob.)

### 10.37.4 What this does NOT resolve

The `local` correction raises a debut good's pop demand in the five affected needs; it does **not** touch
§10.32's era-1 steel case, because steel is in no pop need at all. The three unmodelled terms of F40
(prestige, obsession, taboo) remain unmodelled, all three still no-ops for our scenarios.

## 10.38 ⭐⭐ THE LOSS-MAKING REDUCTION, and the guard that was silently a budget

**2026-08-08.** Raw producers have had a downward rule since §10.18 (a loss-maker is *dropped*).
Manufacturing had none at all: a tier losing money simply sat at whatever size the job-pool rescale gave
it, because building counts are the **dependent** variable here — every settle rescales them so total
employment equals the pool the population provides.

### 10.38.1 The rule

Converge; take the tier losing money by the **largest margin**; cut **one level**; **cap** it there so the
rescale cannot undo it; re-converge; look again. A tier stops at **one level** — the industry is never
deleted, because "unprofitable" and "absent" are different statements, and §10.17 stops scoring a tier at
zero anyway. Revertable: `ERA_SHRINK_LOSSMAKERS=0`.

**The cap is what makes it stick.** Cutting without capping is a no-op — the next settle grows the industry
straight back to refill the job pool. With the cap the labour goes elsewhere instead, which is the whole
point: **this redistributes the workforce, it cannot shrink it.**

**Shipyards carry their −30pp handicap here too** (§10.30's `TG.shipyard_penalty`), on both the test and
the comparison, so a −35% shipyard ranks as −5%. Without it the rule reads a shipyard as the worst
loss-maker in the economy at a margin that is, for a shipyard, par, and cuts it first every single era.

### 10.38.2 ⚠⚠ `SHRINK_STEPS` IS A SAFETY NET, AND AT 60 IT WAS A BUDGET

The loop's real stopping condition is `if (!worst) break` — it terminates on its own once nothing is losing
money above one level. At 60 it never reached that state in era 5, a 26k-level economy: it stopped at step
60 of the **543** that era wants, having reached only the second entry of a **thirteen-industry** hand-off.

Measured, era 5 alone, at three budgets:

| steps | 60 | 400 | **2000 (converged at 543)** |
|---|--:|--:|--:|
| losses/wk | £643k | £137k | **£17k** |
| losses as % of net | 10% | 2% | **0%** |
| loss-making types | 26 | 27 | **21** |
| profitable types | 53 | 52 | **58** |
| net/wk | £6.6M | £6.6M | £6.5M |
| GDP | £722.5M | £724.1M | £718.4M |
| illogicality (era 5) | 11 (8 excl) | 11 (8 excl) | **9 (6 excl)** |

**Whole-ladder illogicality 58 → 56, and 46 → 44 excluding.** Era 5 lost one inversion and one
two-eras-stale-profitable fault — `port` and `railway` both dropped off those lists, because the stale
rungs causing them were finally reached. That is **above the five-point rule on the excluded count** and is
therefore a real result, not jaggedness.

It cost **0.6% of GDP and £100k/wk of net profit to remove £626k/wk of losses**. Strongly positive, not
free — worth stating, because the rule redistributes labour into capacity that earns slightly less in
aggregate than the loss-makers grossed.

⚠⚠ **ERAS 0–4 NEVER REVEALED THIS.** They use **0 / 4 / 2 / 2 / 13** steps, so the guard bound in exactly
one era and nothing else in the report moved when it was raised. **A guard that binds in one place looks
like a converged solve everywhere else** — which is the general lesson, not a fact about this constant.

### 10.38.3 Why era 5 needs so much more than any other era

Era 5 is **the only scenario whose top two rungs are not both meant to be profitable.** The placement rule
gives `weight: 1` to the leading tier and `weight: 1` to the one below — **equal level counts**. With
`lead = [0,2,3,4,5,5]` those two are the *leading* and *dominant* tiers everywhere else, targeted +20% and
+5%. There is no tier 6, so at era 5 `lead == dominant` and the equal-weight partner slides down onto the
**one-era-stale** rung, which the design intends to be dying:

```
scenario 1900   motor  e3:10@-2%    e4:10@+4%     pair = (dominant, leading)
scenario 1920   motor  e4:27@+5%    e5:27@+37%    pair = (dominant, leading)
scenario 1945   motor  e4:159@-18%  e5:159@+7%    pair = (ONE-ERA-STALE, dominant)
```

So era 5 begins with roughly half its capacity on rungs running −13% to −23%, and the reduction has to walk
all of it down. **This is the ladder working, not failing** — e4 at −18% beside e5 at +7% is exactly the
obsolescence signal the mod exists to produce. The defect was only that the scenario *placed* that rung at
full scale and then was not allowed to correct it.

⚠ **This also means "total losses" is not a clean health metric.** It counts a dying tail — which the design
wants — the same as an industry that cannot pay for itself. Split by role, era 5 at 60 steps had £791k of
its £900k gross loss on **stale tails** and only one loss-making *newest* tier (`shipyard_steam`, excused).
Losses **on newest tiers only** is the metric that separates them.

### 10.38.4 If the runtime needs fixing

Era 5 now does ~543 `contSettle` calls instead of 60 (six-era run ~5 min → ~12 min). The fix is a
**coarse-to-fine step** — cut ~5% of a tier's levels while it is deep in the red, one level near the
boundary — not a lower guard. ⚠ It must be checked to land in the **same terminal state**: a coarse step can
overshoot the point where an industry stops being worst, which changes the hand-off order.

## 10.39 THE PROFIT-TARGET OBJECTIVE WAS GRADING ITSELF AGAINST THE WRONG NUMBER

**2026-08-08.** A bookkeeping fix, with no change to the economy whatsoever — the same solve, the same
config, the same presets, only the yardstick corrected. Recorded because the *size* of it is the point.

### 10.39.1 What was wrong

The six-era rework (§ "dominant-tier solving") made each scenario hold **two** tuned rungs: the **leading**
tier (era+1, `TG.current` +20%) and the **dominant** tier (era N, `TG.minus1` +5%). The report's
`PROFIT TARGETS` line was inherited from the five-era ladder, where the highest tier present *was* the
era-appropriate one — so it picked the highest tier at or below the era (the **dominant** one) and graded it
against **`TG.current`, +20%**.

The solver had been aiming that rung at **+5%** ever since the dominant-solve change. Every era therefore
carried a **systematic ~15pp phantom miss**, and it was most of what the metric reported.

### 10.39.2 What it was hiding

| era | before (dominant vs +20%) | after (dominant vs +5%) |
|---|--:|--:|
| 1780 | 0/0 · 0.0pp | 0/0 · 0.0pp (9 floored) |
| 1836 | 1/5 · 11.9pp | **5/6 · 4.1pp** |
| 1870 | 2/11 · 24.6pp | **7/16 · 16.6pp** |
| 1900 | 2/18 · 18.7pp | **17/20 · 7.7pp** |
| 1920 | 0/21 · 18.1pp | **20/21 · 3.7pp** |
| 1945 | 0/21 · 15.4pp | **21/21 · 0.6pp** |
| **total** | **5/76** | **70/84** |

Era 5's clustering at 4–5% margins — which read as a total failure at `0/21` — was the solve landing on its
target almost exactly. ⭐ **The metric was reporting the solver's success as its worst result.**

⚠ The remaining real misses are now legible instead of buried: **era 2's `steel −65%` and `arms +66%`**, and
**era 3's `synthetics −48%` / `fertilizer −41%`**. Those are the genuine work.

### 10.39.3 Why the leading tier still cannot be scored here

The obvious completion — also grade the leading tier against +20% — was built, and it is **invalid in the
per-era report**. A tier's recipe is solved exactly once, in the era where it is dominant, so at era N the
era-(N+1) rung still carries an unsolved recipe. Measured on `tooling e2` at era 1: the report saw
`{iron 6.4, wood 9.6}` → 201% where the config converges to `{iron 16.8, wood 25.1}` → 50%, with prices,
wage, employment, throughput, levels and secondary PM all identical.

Era 0 (leading == dominant) and era 5 (nothing left to solve) were the only eras that agreed with the
shipped preset — which is what identified the cause. **Scoring the leading tier requires a final pass over
all six eras after the whole solve is finished.** Not built.

⚠ This is **§10.14.1 recurring**: that section closed "never report or ship from a non-finalised state" for
**prices**. It was still open for **recipes**, and nothing detected it for months because the only rows
affected were ones nothing had been scoring.

## 10.40 TWO PINS REMOVED: urban-centre levels and art-academy counts

**2026-08-08.** Both are the same kind of defect — a quantity the solver was told rather than allowed to
solve — and in both cases the pin was defensible when it was written and had become the thing preventing
the mechanism around it from working.

### 10.40.1 Urban centres: F13's formula is a CEILING, not a count

F13 measures how many levels urbanization **entitles** a market to. The game staffs that entitlement out of
whoever is available, so an urban centre that cannot pay its way sheds employment rather than standing
fully manned at a loss. Our model has no employment scaling, so holding the entitlement *and* full
employment modelled a building that would not exist:

| | 1780 | 1836 | 1870 | 1900 | 1920 | 1945 |
|---|--:|--:|--:|--:|--:|--:|
| urban-centre margin | −19% | **−49%** | −2% | −2% | +17% | +15% |

⭐ **Two of those are already the zero-profit equilibrium the real rule implies** (1870, 1900), and two are
legitimately above it because the entitlement binds (1920, 1945). **1836 is the broken one** — a −49%
building held fully staffed, over-supplying services and transportation for that whole scenario.

The loss-making reduction (§10.38) may now cut urban centres, and the count is `min(entitlement, cap)`.
Measured, it cuts exactly where the mechanism says it should and nowhere else:

```
1780  3 → 1     1836  27 → 18     1870 −1     1900 −4     1920 untouched     1945 untouched
```

1836's economy-wide losses fell **£21k → £14k/wk**. `ERA_URBAN_SHRINK=0` reverts.

⚠ This approximates employment scaling **by level count**, which is not the same thing. Real per-building
employment scaling would be better and is not built.

### 10.40.2 ⭐⭐ Art academies: the count pin WAS the inversion

The solver carried three exceptions for `art_academy`: a 10:1 value-added cap (against 4:1), exclusion from
the ladder criterion, and — the one that mattered — **`FIXED_COUNTS = { art_academy: {cur:2, m1:2, m2:1} }`**.

The count controller's only lever is building counts. For this industry they were constants, so it could
never close fine_art's gap to its own price path:

| | era 4 | era 5 |
|---|---|---|
| pinned | 56% of base (path wants 85%) | **117% (path wants 75%)** — 42pp adrift |
| solved normally | **on path** | **on path** |

**And that gap is what produced the inversion.** Each tier's recipe is solved once, at its own era's price
(§10.39.3), so an output price that *rises* across the ladder flatters every older rung — era-3 academy
**+115%** against era-5's **+2%**. Removing the pin takes `art_academy` out of era 5's inverted list
(inverted 5 → 2). ⚠ **The observed inversion was manufactured by the pin, not by the demand model** — which
supersedes §10.19's conclusion that the lever was academy OUTPUT.

⚠ The original reasoning is not wrong and is why this is a switch (`ERA_ART_NORMAL=0`) rather than a
deletion: fine_art is unclamped (`max_supply_share = 1`) and carries the highest weight in `popneed_leisure`,
so extra academies really can bid down their own price with no floor. That failure mode has to be **measured
happening** before the pin comes back.

⚠⚠ **SOLVING them normally and SCORING them normally are separate decisions, and only the first is taken.**
The illogicality excusal exists because countries build academies for **prestige**, which this model does
not represent at all — untouched by this result, and kept. The report now names its excused set.

### 10.40.3 Measured, four variants

| variant | illogicality (total) | net/wk | losses/wk | losers | targets | mean \|off\| |
|---|--:|--:|--:|--:|--:|--:|
| A baseline | 56 | £11.92M | £2.46M | 126 | 70/84 | 5.5pp |
| B urban only | 54 | £12.10M | £2.50M | 128 | 71/85 | 5.3pp |
| C art only | 55 | £11.90M | £2.64M | 134 | 65/79 | 4.7pp |
| **D both — shipped** | **50** | **£12.12M** | £2.63M | 128 | 68/82 | **4.0pp** |

⚠⚠ **THE net AND losses COLUMNS ABOVE ARE CONTAMINATED BY GOLD — see §10.40.5.** They were measured before
the metric exempted it, and **83% of every loss figure in them is gold**, which loses money by construction
in every scenario. Use them only for the *relative* A→D comparison, and not even confidently for that, since
gold mine counts differ between variants. The illogicality and target columns are unaffected. The decision to
ship D rests on §10.40.1–2's mechanisms, not on these two columns.

⚠ **Only the TOTAL column compares across all four.** "Excluding" means shipyards + art academies in A/B
and shipyards alone in C/D, because normalising art academies removes them from the excused set. This is
exactly the sort of silently-shifting denominator §10.39 was about, hence the report now prints the set.

⚠ **The −6 clears the five-point rule but is a SUM of per-era moves that individually do not** (1836 13→12,
1870 9→6, 1900 12→**13**, 1945 9→6), and C alone reaches only 55 while D reaches 50 — an interaction not
distinguishable from jaggedness. **It ships on the two confirmed mechanisms above, not on the 6 points.**

⚠ **The cost is real and concentrated:** era 1900 worsens on both metrics — illogicality 12 → 13 and losses
**£576k → £713k** — and it is art normalisation that does it (C alone: £732k at 1900). Economy-wide losses
rise 7% while net profit rises 1.7%.

### 10.40.4 The new profitability metric

`profitTotals()` now covers **every building in the scenario that sells goods** — our tiers including
shipyards and art academies, raw producers, urban centres, subsistence — excluding only buildings with no
goods output at all, which have no margin to report. It returns two numbers that are deliberately not
derivable from one another:

- **net** — every producer's weekly profit, losses deducted from the winners: does the economy pay for itself?
- **loss** — the loss-makers alone, winners ignored: how much of it is being carried?

A rise in both at once is an economy growing while its tail rots, and a single figure cannot show that.
`exNet` / `exLoss` repeat the pair over the excused industries so earlier figures stay comparable when the
excused set changes underneath them.

### 10.40.5 ⚠⚠ The new metric's first outing measured GOLD, not the economy

Caught immediately, by the reader noticing that losses had gone from tens of thousands per week to millions
and asking how. The economy had not changed; the **metric** had, and it swept in a building whose losses are
definitional.

**Nothing in the model buys gold.** Its order book is one-sided by construction, so its price sits pinned at
the **25% floor in every era** and every gold mine runs at about **−62%** regardless of what anything else
does. `SKIP_TARGET_BLD` already exempts `building_gold_mine` and `building_gold_field` from §10.18's
no-loss-making-raw-producer rule for exactly this reason — the new loss metric simply had no equivalent.

Decomposed over the six eras:

| | 1780 | 1836 | 1870 | 1900 | 1920 | 1945 | total |
|---|--:|--:|--:|--:|--:|--:|--:|
| losses, our tiers | £3k | £16k | £42k | £105k | £53k | £193k | **£0.41M** |
| losses, other producers | £0k | £0k | £0k | £8k | £31k | £29k | **£0.07M** |
| **real losses** | £3k | £17k | £42k | £113k | £84k | £222k | **£0.48M** |
| **GOLD — artifact** | £0k | £8k | £130k | £680k | **£1 021k** | £441k | **£2.28M** |

**£2.28M against £0.48M: the artifact was 4.7× the signal**, and at 1920 gold alone was 92% of the era's
reported losses. Every mine that is not gold is comfortably profitable — 1920 reads lead +48%, sulfur +74%,
iron +35%, coal +48%.

**First fix — insufficient.** Gold was scored into its own pair (`auNet` / `auLoss`) and printed on its own
line rather than dropped, on the principle that a number removed silently is a number nobody can check.

⭐⭐ **Final fix — GOLD IS OUT OF THE MODEL ENTIRELY** (user's call, and the right one). `EXCLUDE_REF` now
holds `building_gold_mine` and `building_gold_field`, so no scenario contains either. The exemption approach
was treating a symptom: gold had *already* accumulated `SKIP_GOODS`, `NO_BUYER_EXEMPT`, `SKIP_TARGET_BLD`
and an exemption from §10.18's solvency rule, and it still leaked into the first metric that widened its
population. **A quantity that needs a special case everywhere it appears does not belong in the model.**

In the real game gold is minted into the treasury; this model has no treasury, so gold is a good with
producers and no consumer — the one thing the price formula cannot represent. Its workforce is negligible
and the job-pool rescale absorbs it; its output fed nothing.

⚠ The `auNet`/`auLoss` reporting is **kept** even though it must now always be zero. It costs nothing, it
prints only when non-zero, and it is therefore a tripwire: if a gold building ever reappears in a scenario,
the line comes back rather than the loss quietly rejoining the total.

⚠ **The general lesson is about metric scope, not about gold.** "Every building that sells goods" sounds
like a neutral widening and is not: it silently admits buildings whose margin is a modelling artifact
(gold), buildings carrying a deliberate handicap (shipyards, −30pp), and buildings that are not really
firms (subsistence). Each needs a stated position. A metric's population is part of its definition, and
widening it is a change of measurement, not a change of coverage.

### 10.40.6 SCALE LIMITS — hard solver constraints on building counts, and the 440 whaling stations

Removing gold raised the wider question of what bounds an extraction count at all. Nothing did: the count
controller has no notion of a resource deposit, so a good whose price keeps asking for supply keeps getting
it.

⚠ **An attempt to score this against vanilla's own `capped_resources` was made and is DELIBERATELY NOT
KEPT.** Vanilla distinguishes *potential* slots from slots *exploitable at a given date*
(`resource = { … undiscovered_amount }`, plus discovery gating), and reading one as the other is exactly how
a check like this becomes confidently wrong. Set aside rather than refined.

**What ships instead is a set of stated judgement calls, enforced as HARD CONSTRAINTS in `applyCounts`** —
not warnings. `SCALE_LIMIT`:

| bound | limit |
|---|--:|
| whaling stations | 30 |
| fishing wharves | 100 |
| each ore or logging building, separately | 1 000 |
| each plantation type, separately | 300 |
| non-subsistence agriculture, combined | 3 000 |

The first four are per-building clamps. **The agriculture bound is joint**, so it cannot be a clamp: when the
total is over, every farm, plantation and ranch is scaled down *together*, preserving the crop mix the price
feedback chose and removing only the excess.

⚠ **Per plantation TYPE, not combined** — 400 tea plantations is implausible even where the total acreage is
not, and a combined bound would hide it behind the other twelve crops.

#### ⭐⭐ Whaling is the one that needed this, and it is a fix rather than a guardrail

Whaling stations produce **oil** and are **ungated by technology**, so the controller used them as an
unbounded substitute oil source exactly when oil demand exploded. Across the six eras the count ran:

```
2  ·  19  ·  1  ·  9  ·  47  ·  440
```

That is not a trajectory, it is a quantity nothing was bounding — and historically whaling was in steep
**decline** by 1945, so 440 stations is the wrong *sign* as well as the wrong magnitude.

**Before the constraints** (measured on the shipped scenarios): whaling **47** at 1920 and **440** at 1945,
fishing **106** at 1920, iron **1 251** at 1945. Everything else was inside — coal peaked at 568, logging at
223, agriculture combined at 2 346.

**After:** every era reports `SCALE LIMITS … held`. 1920 sits at the whaling cap; 1945 sits at whaling,
iron and oil-rig caps. Whole-ladder illogicality moved **54 → 52** (47 excluding shipyards), so the
constraints cost nothing on the criterion and are not carried on that basis anyway.

⚠ **The report line is now a VERIFICATION, not a warning.** The caps bind during the solve, so anything it
prints as breached is a bug in the constraint rather than a property of the economy. It is kept for the same
reason the landmine register exists: a constraint nobody checks is a constraint that silently stops being
applied. It also names anything sitting *at* a cap, since a binding constraint is a fact about the scenario
worth seeing.

## 10.41 PROFIT TOTALS ARE REPORTED ONCE, AFTER EVERYTHING — recipes AND counts

**2026-08-08.** *"Reported profit totals should be provided not only after the recipes, but after the
recipes AND the counts are settled. Anything else is useless."* (user.) Correct, and the first version of
this metric failed it twice over.

### 10.41.1 The same defect as §10.39.3, in a second place

`profitTotals()` ran **inside** the per-era pass. A tier's recipe is solved once, in the era where that tier
is DOMINANT — so while era N runs, the era-(N+1) rung standing in its scenario still carries an **unsolved**
recipe, and unsolved recipes are leaner. Scored against a replay of the shipped presets:

| | 1780 | 1836 | 1870 | 1900 | 1920 | 1945 |
|---|--:|--:|--:|--:|--:|--:|
| in-pass report | £0.01M | £0.09M | £0.40M | **£1.80M** | £4.80M | £8.10M |
| replay of shipped state | £0.01M | £0.06M | £0.08M | **£0.40M** | £2.45M | £8.10M |

⭐ **Exact agreement at era 0 and era 5 and divergence everywhere between** — era 0 has no leading tier, era
5 has nothing left to solve. That signature identified the cause, exactly as it did in §10.39.3. The
overstatement reached **4.5×** at 1900.

⚠ §10.39.3 was diagnosed and fixed for the profit-TARGET line hours earlier, and the same defect was
shipped in `profitTotals` in the same session because nobody asked whether it generalised. **When a defect
is found in one report line, sweep every other line computed at the same point.**

### 10.41.2 What ships

The per-era profitability line is **removed**, and one **FINAL PROFIT PASS** runs after the whole era loop.
It replays each era's SHIPPED preset — the exact object written to `config/era_presets.json`, so counts,
prices, PM selections, throughput, pops and wages are all final — against the final recipe book. Verified
against an independent replay script: identical to the pound.

Two disagreeing numbers is the trap, so there is now only one.

### 10.41.3 ⚠⚠ What this does NOT fix — the solve is sequentially inconsistent

Replaying gives honest profits **for the state that ships**. But era N's **counts** were themselves chosen
against those provisional downstream recipes, so the shipped state was reached through an inconsistent
solve. `JOINT_PASSES` (`ERA_JOINT`, default 8) is a fixed point **within** one era and does not address
this; there is no outer loop over the era sequence.

The real fix is an outer iteration — solve all six eras, re-solve all six against the now-final recipes,
repeat until the whole set is stable — and it is **not built**. The existing "strict fixed point" check does
not catch it either: that verifies `--write` twice is byte-identical, and this inconsistency is
deterministic, so it reproduces perfectly while still being wrong.

### 10.41.4 The state it reports, and one thing it immediately found

| era | net £/wk | losses £/wk | loss-makers | profitable | losses % of net |
|---|--:|--:|--:|--:|--:|
| 1780 | 10k | 3k | 9 | 23 | 29% |
| 1836 | 60k | 18k | 22 | 45 | 30% |
| **1870** | **83k** | **132k** | 36 | 42 | ⚠⚠ **158%** |
| **1900** | 400k | 346k | 43 | 43 | ⚠ **87%** |
| 1920 | 2.4M | 258k | 32 | 57 | 11% |
| 1945 | 8.1M | 241k | 41 | 50 | 3% |
| **TOTAL** | **11.1M** | **998k** | 183 | 260 | **9.0%** |

**1870 is the worst era in the set: its loss-makers lose more than the whole economy earns.** 1900 is at
87%. Both were invisible while the in-pass figure was reporting 5× and 4.5× those net values.

⚠ The pass also names the biggest loss-makers per era, and that immediately shows **loss-making farms**
(`millet_farm −84k` at 1900, `wheat_farm −49k` and `subsistence_rice_farm −24k` at 1920) — which §10.18
forbids outright. The leading suspect is §10.40.6's joint agriculture scaling: scaling every farm down
together to hold the 3 000 bound moves supply and can push individuals below zero, and §10.18's drop rule
runs before it and is not re-checked. **Not confirmed.**
