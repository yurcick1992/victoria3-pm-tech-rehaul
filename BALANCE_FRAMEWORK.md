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

## 10.25 Write-cycle convergence — three causes found, two fixed

Section 10.16 recorded that repeated `--write` -> re-run cycles wandered (47 / 51 / 51 / 48). Three causes:

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

**Eras 1 and 2 are now exactly stable across every write cycle**, and a single run is deterministic.
**Eras 3–5 still move** and the config hash still churns, so this is *not yet* a strict fixed point and the
remaining cause is unidentified. Do not quote a single figure from eras 3–5 as "the" score.

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
