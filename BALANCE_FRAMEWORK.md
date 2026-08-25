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
⚠ Resolved in §10.42: the actual mechanism was the type-drop-on-a-shared-price (wheat/maize/rye dropped in
turn, millet left as the protected sole source) plus the missing final re-check; both are closed by the
level-shedding rule and the unified enforcement pass.

## 10.42 ⭐⭐ THE 122-RUN MEASUREMENT CAMPAIGN AND THE RULED SET (2026-08-09)

One overnight campaign — 31 single-knob runs, an 87-cell combination matrix (leave-one-out, all core
pairs, champion variants, half-combos, 35 stratified random subsets; 58 min at concurrency 12, zero
failures), and jitter ensembles for the finalists — followed by explicit user rulings, shipped as the
solver's new DEFAULTS. Every default carries a revert knob; the knob is the A/B instrument, the default
is the decision. The raw reports lived in the session scratchpad; the durable numbers are here.

### 10.42.1 Metric honesty: the in-era illogicality count was measuring provisional recipes

The criterion judges the newest PRESENT tier, and during era N the leading rung still carries its
canonical-start (leanest-legal) recipe — so the headline read **52 (47 excl)** while the same criterion
replayed on the SHIPPED state read **94 (84)**. The report now prints the **final-state illogicality**,
scores the **leading rungs** against +20% (the §10.39.3 gap: they sat 29/79 within 8pp, mean |off| 38pp,
enforced by nothing), and splits losses **by vintage** (newest rungs = failure; stale tails = the design
working; the old-default era 2 had £117k of its £132k losses on NEWEST rungs). The final-state figure is
the headline everywhere now; BUGS_AND_FIXES has the entry.

### 10.42.2 The noise floor, calibrated — and the two response rules

Two near-no-op controls (count deadband 8→9; one extra settle pass) swing **total losses 703k–1.1M,
final illogicality 85–105, net 11.0–11.8M** on the old defaults. Single-run deltas inside ~±10 faults /
±250k losses / ±0.4M net certify nothing. What certifies: magnitude far outside the bands, and
mechanistic localization (a fault list losing exactly the industries a rule withheld; a loss column going
to exactly zero). Design changes are therefore scored on **3-run jitter ensembles** (ERA_JOINT 8/9/10)
from now on, and the **integer polish** (below) attacks the amplifier itself.

### 10.42.3 The interaction findings (the matrix's five results)

1. **The outer era iteration is the enabling substrate.** In-combo marginal +17 faults / +659k losses /
   +4.4M net — and every core placement/constraint PAIR measured without it is **anti-synergistic**
   (lead+debut −29 faults/−624k against what its singles promised; stale+urban −960k; lead+stale
   −24/−438k). Singles' standalone gains were substantially reshuffle luck; with the outer loop
   underneath, the same knobs turn cooperative. Nothing that changes scenario contents ships without it.
2. **PM hysteresis (0.02→0.10) is redeemed in combos** — within noise as a single, present in every top
   matrix cell, improving faults, losses and net when added to the champion. Deferred (user ruling)
   until after the core set beds in; the limit cycle's designed fix remains best-of-cycle freezing.
3. **The 1780 prune is redeemed in combos** — terrible standalone (reshuffle), best fault bucket of the
   matrix inside the champion, era 0 going 7 faults → 1. Its headline advantage melts under jitter; the
   era-0 cleanup is mechanistic and survives. Pending a design ruling on the list.
4. **Two knobs dissolve inside the combo**: the stale placement weight (its dying-rung job is done by
   outer + the reduction) and the leading placement weight (its value was hedging the sequential
   inconsistency). The leading weight was ALSO rejected as a premise by ruling — the scenario is not
   "day 1 after the unlock" — and stays 1.
5. **Composition invariants across all 113 configurations**: ore/oil/rubber over 25% of 1945 output in
   every cell except slope-1.4+construction-ramp (the slope is the only lever found; slope stays 1.5 by
   ruling); commercial grain always collapses at era 3 (the subsistence/market interface, open);
   railways healthy (670–860 levels at 1945) in every outer combo; fractional levels are catastrophic
   in combos (8.5M losses — the enforcement rules stop catching runaway losers) and are closed for good.

### 10.42.4 THE RULED SET — what now ships as defaults (user, 2026-08-09)

- **ERA_OUTER=3 + ERA_SHRINK_COARSE** — the sequential-inconsistency fix (§10.41.3's outer loop) with
  §10.38.4's coarse-to-fine step, which the outer workload makes mandatory (pass 2's era 5 wanted more
  than 2000 fine steps). Passes plateau by 3: further passes wander ±40k, less than run noise.
  `ERA_SHRINK_STEPS` default 6000 stays a safety net, not a budget. Full-run cost: ~25–35 min.
- **The unified post-solve enforcement pass** — raw solvency, manufacturing losses and the urban floor in
  ONE counts-only loop, worst violation first, because any phase running after another phase's final
  check can invalidate it (BUGS_AND_FIXES: the 116-level −46% fertilizer plant the raw-only version
  shipped; era-5 losses under the same combination fell 728k → 127k when unified).
- **ERA_STALE_W=0.25** — a rung already stale when placed (era 5, plateau overhang) is a remnant, not
  half the market.
- **ERA_SHRINK_STALE_FIRST** — the reduction cuts stale rungs before era-exact ones (user directive:
  obsolete capacity is the first victim of the process, era-exact capacity the last resort).
- **The debut guard + forward-chain rule** — an industry whose earliest tier is newer than the era is not
  placed (exempt until their era-1 tiers are minted: railway, steam shipyards, engines — the three
  remaining deliberate anachronisms), and a tier whose INPUT's producers cannot exist yet is not placed
  either (the mirror of §10.30's "the chain has to be finished"; measured case: the engine industry's
  era-3 electric-machining rung stood in 1870 demanding 97 electricity while `power`, also era 3, was
  guard-withheld — a buyer against a wall at the +75% ceiling). A good listed in any pop need never
  counts as buyer-less — that was already `hasNoBuyer`'s semantics and is now stated as the rule.
- **ERA_RAW_SHRINK** — §10.18 sheds LEVELS (25% steps, floor 1, then the type), because the type-drop on
  a shared price removed wheat, maize and rye in turn and left millet the only — protected, loss-making —
  grain source (§10.41.4's farms). Grain diversity now survives into era 4.
- **No urban-centre special case after all (ERA_URBAN_FLOOR default 0).** The −0.10 floor was built as
  the fix for the unconditional cut breaking 1870/1900 (BUGS_AND_FIXES) — but that mechanism belonged to
  the OLD single-pass solve. Under the ruled set the three variants (floor −0.10 / floor 0 / never cut)
  are statistically indistinguishable (58–69 faults, 155–242k losses, inside the jitter spread), so the
  special case is removed per the user's "why only urban centres" objection; centres are cut at any loss
  like manufacturing. The knob remains as the A/B instrument.
- **THE RICE BAN** — the solver places NO rice producers (commercial or subsistence; the subsistence mix
  renormalises over the rest): a US-like temperate country is not a paddy economy, and paddy output was
  flooding the rice market and bankrupting every commercial rice farm in every era. The UI is untouched;
  `ERA_ALLOW_RICE=1` restores, and a future two-mode solver may reintroduce rice properly.
- **ERA_RAW_PRICE_BAND=30** — raw goods get a ±30pp float around base in the count controller instead of
  the 8pp deadband: inside the band the controller leaves them alone, so scarcity may move them; nothing
  prescribes a path. (Replaces the REJECTED raw-price drift: no prescribed raw trajectory, and raw
  prices are expected near base "not too far too often".)
- **ERA_CONSTR_RAMP** — construction 8/10/12/15/17/18% of GDP by era instead of flat 15% (real capital
  formation's GDP share roughly doubled-to-tripled from the 1830s to the 1900s–20s; the level stays
  deliberately above both vanilla and reality because capital hunger is the mod's point).
- **THE INTEGER POLISH** (`ERA_POLISH`, final pass only) — greedy ±1-level moves on our tiers, re-priced
  per trial, kept only when the lexicographic objective (faults excluding excused → losses → net)
  strictly improves with no new ceiling breach. The approved attack on the ±1-level jaggedness at its
  source.
- **SHIPYARDS ARE OUT OF THE HEADLINE PROFIT METRICS** — reported on their own line, exactly like gold's
  tripwire, because their book losses measure the unmodelled naval-construction income, not the economy.
  The −30pp target handicap stays; the criterion excusal stays. ⚠ This is a metric POPULATION change —
  no profit figure before 2026-08-09 is comparable to one after without adding shipyards back.

### 10.42.5 Pending rulings and open work

- **ERA_WAGE_RAMP is DEAD** (ruled by measurement, 2026-08-09): without the rejected drift it bankrupts
  the economy even under the ±30pp raw band (losses £9.4M/wk, net negative; the jitter seed corroborates
  at £2.0M). Both halves of the Baumol pair are gone; its job — killing stale rungs — is already done by
  stale-first reduction + the outer loop (era-5 newest-rung losses are £0 without it).
- **The 1780 prune — RULED AND SHIPPED as the default (user, 2026-08-09): `steel@0,glass@0`.** The
  all-five candidate orphaned real demand: the ARMY buys small arms and artillery at 1780 (22+7
  battalions; arms trade at 94 with the industry present), and the UNIVERSITY buys paper in every era
  (`pm_scholastic_education`, the era-0 base method, eats 5/level; government administration joins from
  1836 — its era-0 `pm_simple_organization` is genuinely paperless, per vanilla). The solver's own
  ceiling tripwire caught it: pruned-1780 pinned paper (buy 5 / sell 0, NO PRODUCER) and artillery at
  175. The shipped list is therefore the two goods with no buyer of any kind at 1780. Measured: era 0
  drops 7 → 5 faults with no breach and no orphan; the five that remain (food, furniture, tooling,
  paper, artillery) are honest tiny-market statements about industries that genuinely existed, each
  losing £150–350/wk. Whole-ladder 64 (55) / £169k / £13.6M — statistically identical to the pre-prune
  default. `ERA_PRUNE=` (empty) reverts. ⚠ The general rule this ratified: **an industry may only be
  pruned from an era if its good has no buyer of any kind there** — pops, buildings, or the army.
- **THE ELECTRICITY PASS (user, 2026-08-09 — QUEUED, do not start until the ruled set's effects are
  measured).** Era-3's urban-centre lighting PM flips from CONSUMING 3 electricity to PRODUCING 1
  (municipal generation embedded in the urban centre), offset by a labour shift laborers → engineers
  sized to be roughly economically neutral at BASE electricity price and era-3 wages. Declared scope:
  **this will likely be the only PM change ever made to pre-existing non-manufacturing industries.**
  Implementation prerequisites: the goods half is a `pm_goods` override (existing mechanism); the
  employment half needs a per-PM employment override the builder does not yet have (extend `pm_goods` to
  employment or own the PM's file). Interactions to re-measure when it lands: electricity gains a supply
  source outside `power` wherever urban centres stand (the chain rule must treat it as a producer), and
  urban-centre economics change materially (they become electricity sellers).
- **The manor-house problem**: ownership professions are an 1836-frozen share of the productive
  workforce (PROF_RATIO), so manor houses are the biggest building in every economy including 1945.
  Direction under discussion: tie aristocrats to the LAND economy, capitalists to industrial capital,
  white-collar to a ramp — era-appropriate anchors instead of one frozen vector. ⭐ **No game run
  needed to fit them** (user, 2026-08-09): the `saves_debut` archive (356 vanilla autosaves,
  1836→1921) supplies the whole trajectory — professions per country via
  `melted_pops_by_profession.mjs`, building levels by type via `melted_building_goods.mjs` (it
  already parses `levels=N` per building; extend it ~20 lines to emit level totals per type per
  country), and the save's own `gdp` series (F45's source). Sample ~9 saves at decade intervals,
  extract the USA (the scenarios' reference country); era 5 stays an extrapolation — the campaign
  ends 1921 and vanilla ends 1936 anyway.
- **Grain collapses at era 3 in every configuration** — the subsistence/market interface (subsistence
  supplies grain at zero opportunity cost); needs its own session.
- ~~**PM choice still never settles** (hysteresis deferred; best-of-cycle freezing designed, unbuilt).~~
  **CLOSED 2026-08-10 (§10.48)**: hysteresis 0.10 + best-of-cycle freezing ship as defaults; PM choice
  settles in all six eras of all three seeds.

## 10.43 The electricity pass (2026-08-09) — municipal generation, the lighting mandate, and power's era-4 start

**The user's brief (superseding the §10.42.5 queue entry in three ways):** (1) urban-centre lighting
methods are MANDATED at the highest tier the era allows — a prerequisite of being a city, never a solver
choice; (2) the electric-streetlights method also consumes **one coal**, with the remaining effectiveness
change covered by shifting laborers into engineers; (3) investigate what can be done narratively to get
rid of an input-less era-3 power industry ("hydro") — were coal plants at 1870/1900/1920 different enough
to justify 2–3 standalone types, and does era-3 electricity need to exist at all? The brief explicitly
accepts that the outcome bends "urban centres are the only pre-existing non-manufacturing building whose
PMs we touch" — this is one large change to redo electricity.

### 10.43.1 The investigation — what the record supports

- **1870 (era 2): no central power stations existed anywhere.** The first were Pearl Street and Holborn
  Viaduct, both 1882; 1870s electricity is telegraph batteries and arc-light experiments (Gramme dynamo
  1871). An era-2 electricity industry would be an invention, not a correction. (The shipped model
  already agreed — power began at era 3 — and stays agreed: power now appears at era 2 in NO form.)
- **1900 (era 3): the plant generation of 1900 was the municipal engine-house.** Reciprocating steam
  engines driving dynamos, ~0.1–5 MW, typically owned by the city or the tram company, sited inside the
  city it lit; the load was street lighting and trams. The steam turbine existed (Parsons 1884) and the
  FIRST turbine station (Elberfeld, 1900) is exactly the leading edge at that date. Plant efficiency ~4%.
  Niagara (1895) proved large hydro at the same moment — as a one-off heroic site, not a standard plant.
- **1920–25 (era 4): the central station proper.** Steam turbines at 20–60+ MW per unit, pulverized-coal
  firing, regional interconnection (Britain's 1926 Grid Act), and electricity becoming an INDUSTRIAL
  input — motor drive overtaking line shafts. This is a different building from the 1900 engine-house in
  machinery, scale and siting; you rebuild, you do not upgrade. Efficiency ~15%.
- **1940 (era 5): the modernised station** — high-pressure/reheat steam, 100+ MW units, national grids —
  an evolution of the era-4 plant rather than a third coal generation. (Vanilla represents this rung as
  the oil-fired plant; oil was historically niche until postwar, but it prices the rung's fuel
  differentiation and is kept.)

**Verdicts.** Coal plants justify **two** standalone tiers (era 4 turbine hall, era 5 modernised), not
three — the "third" (1900) was municipal-scale and city-embedded, which is precisely what the rehauled
urban-centre lighting method models. **Era-3 electricity exists as a GOOD but not as a standalone
dominant industry**: supply at 1900 is the urban centres' own generation plus whatever leading-rung
turbine stations the market wants. **Hydro never becomes a market industry**: small-scale (mill-race /
municipal) hydro folds into the urban-centre generation narrative alongside municipal coal — the 1-coal
input keeps the fuel economics honest without claiming the whole method is hydro — and large-scale hydro
(Niagara 1895, Hoover 1936, Dnieprostroi) is a site-specific unique megaproject in the same class as the
canals, which the scenario model already excludes. No input-less producer exists anywhere in the ladder.
A future in-game unique building for the great dams stays open as mod content; it is not scenario model.

### 10.43.2 What shipped

1. **The lighting mandate** — `MANDATED_PMGS` in `tools/era_pm.mjs`: `pmg_street_lighting` resolves to
   exactly one candidate per era — none @0, gas @1–2, electric @3+ — so the optimiser cannot trade it and
   the PM limit cycle loses a participant. Gas's era-1 threshold is hand-assigned (vanilla leaves the PM
   ungated because vanilla starts at 1836; gas street lighting is 1807–1820s, and an ungated method would
   otherwise be mandated into 1780). Consulted via `mandatedPick()` by BOTH `candidates()`
   implementations — era_solver.mjs still carries its pre-era_pm fork of the candidate rules (dedup debt,
   flagged as its own task; the fork also lacks the coerced-labour ban, a real drift the "one copy" rule
   predicted).
2. **The municipal-generation method** — `pm_electric_streetlights` overridden via `pm_goods`
   (in: **2 coal** · out: 10 services + **1 electricity**; was in: 3 electricity · out: 10 services) and
   the new **`pm_employment`** (250 engineers; was 200 laborers + 50 engineers). `required_input_goods =
   electricity` is dropped by the builder — a producer gated on its own product being already in the
   market would deadlock the game's PM selector (MODDING_NOTES).
   **The neutrality arithmetic (coal ruled to 2, user 2026-08-09):** the flip's gross value is
   **+£120/level at base prices** (3 elec no longer bought = +90, 1 elec now sold = +30); the offsets are
   coal (£30 each) and the labor shift. A 1:1 laborers→engineers shift adds `N × base wage × 2`, and the
   method's own headcount caps N at 200 (drawing the building's base pool negative is forbidden —
   arcades + motor carriages already exhaust it: 1000 − 1000 laborers), so the shift covers `400 × base
   wage`. Residual per level = `120 − 30·coal − 400w`:
   | coal | era 3 (w .0885) | era 4 (.1071) | era 5 (.1297) |
   |---|---|---|---|
   | 1 | +£54.6 | +£47.1 | +£38.1 |
   | **2 (ruled)** | **+£24.6** | **+£17.1** | **+£8.1** |
   | 3 | −£5.4 | −£12.9 | −£21.9 |
   **2 coal does not close the gap completely** — but it is the right side to stop on: the residual is a
   modest UC gain (~2pp of a level's output) that DECAYS toward zero as wages rise, while 3 coal would
   make the MANDATED method a strict loss-maker at every era, worsening over time — a mandate must not
   force a money-loser. Raising the engineer count above 250 remains the lever if exact era-3 neutrality
   is ever wanted.
3. **Power = [coal @4, oil @5]** in `build_era_ladder.mjs`'s spec and the config; the era-3 "Early Power
   Plant" tier is deleted. The coal tier inherits the **vanilla key `building_power_plant`** (5 vanilla
   script files reference it — the key must survive) with tech swapped to `steam_turbine`; nothing in
   vanilla script references `pm_early_power_plant`, so nothing is orphaned. 1836 history contains no
   power plants, so the start conversion is untouched.
4. **Power is DEBUT-EXEMPT** (`ERA_DEBUT_EXEMPT` default gains `power`, permanently and on principle —
   unlike the trio pending era-1 tiers): its debut rung is EMBEDDED in urban centres, so the industry
   exists at era 3 even though its standalone ladder starts at era 4, and the era-3 scenario may place
   coal plants as its LEADING rung (+20% target) — the first turbine stations, which is historically the
   right reading of 1900. At era ≤2 availability alone excludes power (earliest tier era 4 > LEAD_TIER),
   so the exemption is inert there.
5. **The chain rule now gates reference-building METHODS by era** (`refProducible` in era_scenarios.mjs).
   The walk used to accept any PM of any reachable building; once streetlights PRODUCE electricity, that
   would have called electricity "producible at 1780" (the urban centre is an era-0 building listing an
   era-3 method) and un-withheld every electricity-eating rung three eras early. With the gate,
   electricity is ref-producible exactly from era 3 — which is also what closes prerequisite (b) from
   §10.42.5: the chain rule counts urban centres as electricity producers.
6. **The builder's PM override writer is now REPLACEMENT, not requantify** (`Convert-PmBlock` in
   build.ps1). The old writer could only rewrite quantities of goods lines that already existed, while
   the model's `pmRec()` has always read an override as the whole recipe — a latent divergence that this
   pass would have turned into a shipped bug (coal never added, the electricity input never removed).
   Now: goods lines are dropped and rewritten inside `building_modifiers → workforce_scaled`, employment
   inside `level_scaled`, `required_input_goods` dropped when its good leaves the inputs, and an override
   naming a PM no vanilla file defines THROWS. See BUGS_AND_FIXES for the two defects found while
   building it (the divergence itself; a PowerShell scalar-unwrap that emitted a lone tab instead of a
   one-line employment block).
7. **`pm_employment` reaches the model** via REFEDIT[pm].emp (econ_host folds the config key in;
   econ.js's pmRec/selEmp/tierEmp route through it) and the UI via a separate `REFEMP` (builder.html) —
   deliberately NOT inside the UI's editable REFEDIT, because pm_goods is serialised wholesale on export
   and dropped wholesale by `recipes: vanilla`, and the employment override must survive both. It is
   displayed in Workforce but not editable, consistent with the standing rule that workforce is not yet
   a UI-editable field.

**Scope declaration reaffirmed:** this is the only PM change made to pre-existing non-manufacturing
industries, now including its one deliberate extension (the power industry restructure that the
investigation concluded in) — the mechanism (`pm_goods`/`pm_employment`/mandates) is general, the
LICENSE to use it on non-manufacturing vanilla buildings is not.

⚠ **§10.43's two-tier power shape (coal @4 + oil @5, debut-exempt) lived for a few hours** — the user's
leading-rung challenge (§10.44) superseded it the same day: power is back to THREE tiers with the coal
turbine station AT era 3 (its honest date), a new pulverized-coal era-4 tier, and no exemption, because
the date gate needs none. Everything else in §10.43 (the lighting mandate, the municipal-generation
method at 2 coal, the hydro narrative, `pm_employment`, the writer semantics) stands unchanged.

## 10.44 The date gate (2026-08-09) — a tier stands where its technology existed, and the leading rung dies

**The user's challenge:** "the techs of era X are not discovered at exactly era X−1's scenario — there
should be NONE of them." The census that settled it, run on the shipped presets:

| scenario | industries with an era>N rung present | levels on them | share of tier-output value |
|---|---|---|---|
| 1780 | 0 | 0 | 0% |
| 1836 | 15 | 34 | **56.3%** |
| 1870 | 17 | 113 | **56.8%** |
| 1900 | 21 | 474 | **58.2%** |
| 1920 | 18 | 652 | **49.4%** |
| 1945 | 0 (no era 6) | 0 | 0% |

The "leading rung" was framed as a foothold; the solve made it HALF THE ECONOMY — level parity with the
dominant rung (1900: tooling 105/105, steel 48/47, port 74/76) carrying more than half of each
industry's output on a ×1.5 recipe. The one measurement on the other side — vanilla's own 1836 start is
45% tier-2 capacity, which is why the strict `era ≤ scenario era` version was rejected as "a 1750
market wearing an 1836 label" — turns out to be an argument about YEARS, not eras: the "era-2" capacity
standing in the real 1836 is 1830s–40s technology, contemporary with the date. Eras are wide bands;
scenario years sit inside them; the era⇒era rule could not tell 1842-tech-at-1836 (honest) from
1925-plant-at-1900 (fake).

### 10.44.1 The rule

Every tier carries **`tech_year`** — the year the SLOT'S technology was first **commercially
deployable** (a building of this kind could exist; how much of it exists stays the count controller's
job). A tier is placeable in a scenario iff `tech_year ≤ the scenario year`. Consequences:

- **"Leading" stops being a category.** What stands in 1900 is what existed by 1900. The era label
  still CLASSIFIES a rung (a present tier with era > scenario era reports as the lead rung and aims at
  `TG.current` +20%; the era-exact tier keeps `TG.minus1` +5%) — the positional target structure is
  unchanged, only placement moved from era arithmetic to the calendar.
- **The debut guard and its whole exemption list retire from the main path.** An industry whose
  technology has not arrived has no placeable tier and is simply absent; railway (1825), steam
  shipyards (1843), the engine trade (1820) and power (1900 — municipal generation inside urban centres
  before that) all resolve on their own dates, with no hand-waving. `ERA_DEBUT_GUARD`/`ERA_DEBUT_EXEMPT`
  survive only on the legacy path (`ERA_DATE_GATE=0` reverts the gate).
- **Date the slot, not the vanilla PM's decorative name.** Vanilla gates rubber-grip tooling on
  vulcanization (1844); the slot it occupies is the high-speed-steel machine shop (1901). The spec's own
  per-industry notes — the research that assigned the eras — supply the dates; each entry now carries a
  `years:[…]` array and each invented tier a `year:`, stamped into the config as `tech_year` by
  `build_era_ladder.mjs`, which also THROWS on a missing date and on arrival-order violations (a higher
  rung must not arrive at an earlier scenario than its predecessor; RAW years may invert where no
  scenario year separates them — photography 1839 vs realism 1850 both arrive at 1870, deliberate and
  inert).
- **Scope cut, named:** vanilla PRODUCTION METHODS (secondaries, reference buildings) stay on the era
  remap. Dating our 100 tiers kills the 50%-of-output anachronism; dating vanilla's several hundred PMs
  would be a much larger pass for a much smaller error — a later tightening if a specific PM reads wrong.

### 10.44.2 The judgment calls worth knowing (the full table lives in the spec)

- **Excluded from 1900 deliberately:** high-speed steel tooling (demonstrated 1900, tools on sale
  1901 → `1901`), electric-arc steel (Héroult 1900, first commercial steel plants 1903-06 → `1903`),
  electric-drive garment plants (`1905`). These were the census's biggest anachronisms.
- **Included at their scenarios deliberately:** series automobile production `1899` (De Dion-Bouton
  built ~400 cars in 1900 — automotive STANDS at the 1900 scenario, where the era anchor alone would
  have excluded it), mainline electric railways `1895` (Baltimore & Ohio), broadcast radio `1920`
  (KDKA — lands exactly on its scenario), the coal turbine station `1900` (Elberfeld).
- **The 1836 measured transition survives as dates:** dye/calico works 1830, machine paper mills 1830,
  shell guns 1830, percussion caps 1830, railways 1825, engine works 1820 — but superphosphate is
  `1842`, so vanilla-1836 fertilizer capacity is recorded as vanilla's own anachronism and the industry
  now debuts at 1870.
- **1780 gains second rungs honestly:** manufactory-scale food (1750), glass cones (1750), toolshops
  (1770), paper mills (1750), gun quarters (1770), cannon foundries (1750) all predate 1780 — the old
  "era 0 is a single rung, deliberately" ruling is superseded by the calendar.
- **Power = three tiers, no gaps (user ruling):** Coal-Fired `1900` @e3 (tech `steam_turbine`,
  deliberate-early), **Pulverized-Coal `1920` @e4** — a NEW all-new tier (tech `electrical_capacitors`
  as the closest grid-equipment gate, no vanilla PM, like the steamer chain), Oil-Fired `1925` @e5.

### 10.44.3 Measured results (default + ERA_JOINT 8/9/10; the default IS seed 8's jitter)

**The census transformed exactly as intended.** Share of tier-output value on rungs whose ERA exceeds
the scenario's, before → after the gate: 1836 **56.3% → 46.6%**, 1870 **56.8% → 40.5%**, 1900
**58.2% → 5.2%**, 1920 **49.4% → 0%**, 1945 0% → 0%. Two readings matter:
- **Calendar anachronism is now 0% by construction everywhere** — what remains of the "era>N" share is
  tiers whose tech DATES genuinely precede the scenario (1900's 5.2% is bolt-action 1886, recoil
  carriages 1897, kraft 1890, electric railway 1895, film 1896; 1836's 46.6% is 1815–1832 technology).
- ⭐ **1836's era-2 share landed at 46.6% against vanilla's independently measured 45% tier-2 start.**
  The dates were assigned slot-by-slot from the historical notes with no fitting — reproducing the one
  measured anchor this closely is the strongest external validation the placement rule has ever had.
  (1780 now holds e1 manufactory rungs for six trades, honestly — the "era 0 is a single rung" ruling
  is superseded by the calendar.)

| | final-state illogicality | losses £/wk | net £/wk | ceiling |
|---|---|---|---|---|
| pre-gate (2-coal ruled, §10.43.3) | 66 (57) | 247k | 12.3M | clear 6/6 |
| **date gate, default (ships)** | **64 (53)** · per era 9/8/9/14/13/11 | **159k** (1.3%) | **11.8M** | 5/6 |
| date gate, seeds 8/9/10 | 64/74/68 (53/63/57) | 159/175/145k | 11.8/11.4/11.5M | 5/5/4 |

**Faults same-to-better, losses distinctly better (−30–50%), net ~4% smaller** — the smaller economy is
the honest one: the deleted half-economy of next-era capacity ran on ×1.5 recipes that padded output.

**The ceiling column, stated precisely:**
- **Eras 1–5 are clear in seeds 8 and 9.** Seed 10 resurfaces the old **era-2 engines under-build**
  (buy 229 / sell 96 from 2 levels) — the §10.42.5 breach the electricity pass had closed-by-observation
  in 4/4 runs; it is marginal and seed-dependent, and is hereby REOPENED as flagged ("reopen if a later
  ensemble resurfaces it").
- **Era 0 carries a structural pair in every seed — the 1780 knot, now mechanically understood.**
  `hardwood buy ~56–73 / sell 0`: the 1780 shipyard (honestly placed, tech_year 1700) eats hardwood;
  hardwood's producer is the UNGATED logging conversion `pm_hardwood` (−25 wood → +10 hardwood), which
  the optimiser correctly refuses because wood floats at ~129 inside the ±30 raw band while hardwood is
  capped at 175 — the conversion destroys value at any legal price, so "no count can fix this" is
  literally true. `iron buy ~58 / sell 22` from a single mine sits in the same tiny-market never-settled
  PM cycle. Every dial that would clear these breaks a ruled design (the raw band, the ceiling, honest
  dates); this is the "1780 cannot pay for itself" open item made concrete, not a date-gate defect, and
  it goes to the 1780 session, not to a tuning patch.

**Found and fixed on the way** (BUGS_AND_FIXES, 2026-08-09): `makeTiers` dropping `tech_year` (the
`input_ratio` whitelist defect class recurring — caught in minutes because the gate THROWS instead of
falling back); the chain rule was ONE-PASS and a two-link chain slipped through (date-gated 1836:
fertilizer 1842 → explosives dropped → munition shipped pinned at the ceiling; the filter now iterates
to a fixed point); furniture's e1 date moved 1770 → 1800 inside its honest range on the input-chain
tie-break (its recipe eats hardwood, unproducible at 1780).

## 10.45 The wedge, measured (2026-08-09) — per-profession era multipliers replace the frozen 1836 vector

The manor-house problem (§10.42.5): the eight non-productive professions were an 1836-frozen share of
the productive workforce, so manor houses stayed the biggest building in every economy including 1945,
and `ERA_PROF_RAMP` (a single uniform factor) was the only dial. **FINDINGS F46 measured the real
trajectories** — nine melted saves of one vanilla USA campaign at decade intervals, 1836→1920, each
profession ÷ the productive workforce (the full series is in F46; the raw extracts are one melt away
from the saves_debut archive).

**Shipped:** `PROF_MULT_BY_ERA` — per-profession multipliers on the committed eight-market-median 1836
anchors (`PROF_RATIO_1836` is untouched: the SHAPE is the USA's, the LEVEL stays calibrated — stated
assumption, since levels demonstrably do not transfer across countries: USA shopkeepers are ×4–5 the
European median):

| profession | e0 (backcast) | e1 | e2 (1866/76) | e3 (1896/06) | e4 (1920) | e5 (extrapolated) |
|---|--:|--:|--:|--:|--:|--:|
| clerks | 0.70 | 1.00 | 1.55 | 1.78 | 2.13 | 2.70 |
| bureaucrats | 1.20 | 1.00 | 1.05 | 0.78 | 0.53 | 0.45 |
| clergymen | 1.00 | 1.00 | 1.51 | 1.49 | 1.16 | 1.00 |
| shopkeepers | 0.70 | 1.00 | 1.47 | 1.90 | 2.13 | 2.50 |
| aristocrats | 1.10 | 1.00 | 1.39 | 1.08 | 0.59 | 0.35 |
| capitalists | 0.30 | 1.00 | 1.61 | 2.47 | 2.46 | 2.80 |
| officers | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| academics | 0.70 | 1.00 | 8.40 | 4.00 | 2.13 | 1.80 |

The design intent lands as data: aristocrats (manor houses) fall to 0.59× by era 4 and 0.35× by era 5 —
the land economy's decline, WITH a real 1866 peak on the way — while capitalists (financial districts)
×2.5 and the white-collar block doubles. Bureaucrats HALVE, which is vanilla's own behaviour and is
followed deliberately (the model mirrors the game it mods). Academics' ×8.4 era-2 spike is vanilla's
university boom — volatile but measured, from a 0.15%-of-workforce base. `ERA_PROF_WEDGE=0` reverts to
the flat vector; `ERA_PROF_RAMP` still multiplies on top for experiments. Era 0/5 are judgment calls
marked in the code; the original three-anchor idea (tie aristocrats to the modelled land share, etc.)
was set aside for the measured per-era table — model-coupled anchors can come later if the per-era
table proves too rigid, and the F46 series is the data either would be fitted to.

## 10.46 Post-gate rulings (user, 2026-08-09): imports where no producer can exist, the ceiling-futility bug, the dye pin

Three rulings on §10.44.3's residuals, all in one re-solve:

1. **TRADE-SUPPLIED GOODS — "add trade supply exactly where demand is," scoped to an EXPLICIT LIST.**
   A good on `TRADE_SUPPLY_GOODS` (today: **hardwood only**) that buildings demand with no building
   supply is imported: trade sell orders are set equal to demand on EVERY re-price, so supply = demand
   and the price sits at 100% of base however demand moves; the import withdraws itself the moment a
   domestic producer appears, and the report prints a TRADE-SUPPLIED line naming every import.
   ⚠⚠ **THE SCOPE IS A LIST BECAUSE THE CONDITION VERSION WAS MEASURED AND IT WAS A DISASTER.** The
   first implementation imported ANY non-ladder good with building demand and zero building supply —
   which DISARMED the "kept at a loss — the market's only source" ceiling guard: dropping the last iron
   mine no longer breached the ceiling (imports flooded in at 100), so the raw-drop machinery cascaded
   and the solve shipped 1900 with its ENTIRE 25,520-unit iron supply imported, era-5 rubber 16,572
   imported, and the army's tanks bought abroad. One run, caught by the TRADE-SUPPLIED report line the
   rule prints about itself. The ruling covers structural WALLS (hardwood: the ungated wood→hardwood
   conversion can never pay while wood floats in-band under hardwood's 175 cap — no count, price or
   method choice can fix it), not transient supply gaps; a wall is a design finding, and each one is
   named on the list by hand.
2. **THE CEILING-FUTILITY BUG** ("iron is a bigger and weirder problem... can be some systemic
   weirdness" — confirmed). §10.21's futility guard was written for the 25% FLOOR ("extra supply cannot
   push the price down any further") but fired on ANY unmoved margin — including a good pinned at the
   175 CEILING with demand far above supply, where one growth step is not yet enough to unpin the price.
   The guard then `capBlocked` the producer PERMANENTLY — blocking exactly the growth the hard ceiling
   constraint requires. The 1780 iron mine (1 level, 419%, buy 58 / sell 22, forever) and the reopened
   era-2 engines under-build (buy 229 / sell 96) both carry this signature, in the raw and manufacturing
   branches respectively. Fix: the guard fires only when the producer's output is NOT pinned at the top
   band edge, in both branches.
3. **THE DYE PIN IS GONE.** `FIXED_REF_COUNT = { building_dye_plantation: 10 }` was a self-declared
   placeholder from before the count controller, the raw band and level-shedding existed ("10 is a
   reasonable-looking number, not a derived one") — the same class as the art academy's removed
   FIXED_COUNTS (§10.40). At 1780 it stood at 10/10 with barely any profit. The controller now sizes
   dye plantations like any plantation; the mechanism remains, empty.

Also folded into the same re-solve: the reference solver's fork of the PM rules is DELETED —
`era_solver.mjs` consumes `makePmRules` from era_pm.mjs (with an `onLawDisallowed` reporting hook), so
the coerced-labour ban, the veto knob, the mandate and the gate remap arrive in both solvers from one
implementation, and there is no second copy left to drift.

### 10.46.1 Measured results (wedge §10.45 + all three rulings + the solver dedup, one re-solve)

| | final-state illogicality | losses £/wk | net £/wk | ceiling |
|---|---|---|---|---|
| date-gate baseline (§10.44.3) | 64 (53) · seeds 64/74/68 | 159k · 145–175k | 11.8M · 11.4–11.8M | 5/5/4 of 6 |
| **combined (ships)** | **66 (55)** · per era 9/8/12/17/12/8 | **175k** (1.4%) | **12.5M** | **6/6** |
| combined, seeds 9/10 | 82 (70) / 64 (54) | 279k / 182k | 11.6M / 12.2M | 5/6 / 5/6 |

**The wedge + fixes are metrically neutral-to-positive and structurally strictly better.** Faults sit in
the same jagged band (seed 9's 82 is the spread's high edge; seed 10's 64 its low); net is UP ~0.7M on
the default — and the DEFAULT run clears the ceiling in all six eras for the first time since the date
gate landed: hardwood imports where ruled (72 units at 1780, 525 at 1836 — furniture and shipyards buy
it; every other good domestic), the 1780 iron mine grows freely now the futility guard knows which pin
it is looking at, and dye plantations are market-sized. The seed residuals, both marginal and named:
seed 9 re-shows the **era-2 engines squeeze** — now UNDERSTOOD rather than mysterious: with the futility
fix the growth path is open, but growing the engine industry at 1870 pushes its own inputs to the
ceiling (the cap-on-breach brake, working as designed), while not growing it pins engines — a genuine
two-sided 1870 statement, not a stuck dial; seed 10 shows a one-off lead drop-then-pin (buy 16 / sell 0
— the §10.18 drop's only-source undo checks breaches at drop time only, and this pin formed later).
Both stay on the open list at low concern per the user's ruling ("we're not done structurally, so the
particular values are of low concern").

⚠ **The first run of the combined state is a lesson recorded in item 1's scope note**: the
condition-based import rule shipped 1900 with all 25,520 units of iron imported before the explicit
list replaced it. Its numbers (73 (63) / £204k / £10.1M) are VOID for comparison — that economy bought
its metals abroad.

### 10.43.3 Measured results (default run + ERA_JOINT 8/9/10 ensemble, 2026-08-09)

**The design landed as specified.** Lighting per era: none / gas / gas / electric×3 (mandated, both
solvers). Power per era: e0–2 **none** (1870 has zero electricity — historically exact), e3 **36
coal-fired as the LEADING rung** beside **306 urban-centre levels each generating 1 electricity**, e4
63 coal (dominant) + 64 oil (leading), e5 91 coal (stale, being shed) + 363 oil (dominant). Electricity
price path **151 / 139 / 121** across e3/e4/e5 — scarce and expensive when new, deflating as the
industry modernises, never pinned at the band edge.

| | final-state illogicality | losses £/wk | net £/wk |
|---|---|---|---|
| baseline (ruled set + prune), default | 64 (55 excl) | 169k | 13.6M |
| baseline verification seeds | 58–68 (50–59) | 155–242k | 12.0–14.0M |
| electricity pass @1 coal, default | 72 (61) · per era 4/13/15/17/12/11 | 218k (1.8%) | 12.3M |
| electricity pass @1 coal, seeds 8/9/10 | 72/81/76 (61/72/67) | 218/347/319k | 12.3/11.7/12.2M |
| **@2 coal (RULED, ships)** | **66 (57)** · per era 4/12/15/19/8/8 | **247k** (2.0%) | **12.3M** |

The 2-coal re-solve (the user's coal ruling) landed INSIDE the 1-coal ensemble's spread on every metric
— the fault improvement 72→66 is reshuffle, not a coal effect — with the same qualitative state:
ceiling clear 6/6, era-3 = 303 UC generators + 37 leading stations, electricity 151/145/122, era-4/5
faults notably lower (8/8) and era-3 a little higher (19). These are the REFERENCE numbers for future
A/B work (the user ratified the pass's structural cost with the coal ruling).

**The cost is real but modest — median ≈ +13 faults, ≈ +100k losses, ≈ −1.3M net** (the ensembles
barely overlap, so this is signal, not the ±10/±250k/±0.4M jitter). It has two visible sources: (1)
**electricity is dearer at eras 4–5 than before** (139/121 vs 125/105 — the standalone sector is
smaller: 669 → 454 power levels at era 5) and the electric rungs that eat it pay for that — railway is
now loss-making + inverted at era 4 (electric railway eats 10 electricity/level, floored at 1 level),
electrics/synthetics linger on the 2-eras-stale-profitable lists; (2) urban centres got richer (the
uncovered £55/level residual plus electricity revenue), so more of the F13 entitlement survives the
loss cut (279 → 306 UC levels at era 3) and services supply grows accordingly. Era-5 newest-rung
losses stay **£0**; railways at 1945 read 117 levels in the 1-coal run and **86 in the shipped 2-coal
run** (~89 at baseline — the count is volatile across re-solves and none of these differences is
signal), still floored at 1 level in eras 3–4 — the railway question stays open and now has its
electricity interaction on the record.

⭐ **The one residual ceiling breach is GONE: the INDUSTRIAL CEILING is clear in all six eras in ALL
FOUR runs** (default + three seeds). The baseline's era-2 engines breach (buy 224 / sell 96,
§10.42.5's open item) does not reproduce anywhere in the new state. ⚠ Attribution is not fully pinned —
the pass changed nothing that touches era-2 engines directly, so the breach was evidently marginal and
the re-solve cleared it; treat it as closed-by-observation, reopen if a later ensemble resurfaces it.

**Fixed point:** the first solve after the ladder rebuild printed the expected one-generation ⚠ (the
re-minted tiers' frozen `input_ratio` is discarded by `build_era_ladder --write` and re-frozen by the
next solve's `--write`); the state after it reads `own 66 · below 23 · frozen 10 — no tier reads its
mix from the previous run`, and a full `--write` → re-run byte-identity check was run on the shipped
state (see CLAUDE.md's fixed-point note for the transient rule).

## 10.47 The macroscenario — explicit reasonability constraints (user, 2026-08-09)

**The problem it names:** the solve can satisfy every margin target, track the price path, clear the
ceiling — and still ship a scenario that is not a picture of the country it claims to describe. The
case that forced it: **three total railway levels in the 1900 scenario**, every one of them on target.
The count controller was doing its job (transportation sat on its path), §10.38 was doing its job
(loss-makers shrank), and the composite was still absurd, because nothing in the solve knew that a
large 1900 economy *has railways*. The margins are means; the scenario is the end.

**The design:** the six scenarios describe ONE chosen country — a large, autarkic, US-like,
industry-oriented economy. That choice already governs the solver in scattered places (the population
premise, the peasant shares, the rice ban, the temperate-leaning subsistence mix); `tools/era_macro.mjs`
makes its REASONABILITY half explicit, as per-era bounds at three levels, applied from 1836 on
(**1780 is exempt** — the bounds are industrial-era reasoning and the workshop economy predates them):

1. **Professions** — share of total population per profession. **Verified only**: professions are
   downstream of building employment and the measured wedge (§10.45), so there is no honest lever left
   to enforce with; a breach printed here means a design input drifted. (The user's "likely already
   covered" was right — the shipped state passes every profession bound in every era.)
2. **Industry categories** — share of GDP per category, the UI's own sector split (mfg-from-mfg-inputs
   / mfg-from-raw / extraction & logging / agriculture incl. fishing & whaling). **Enforced** through
   counts.
3. **Industry types** — share of GDP per config industry, all tiers combined. **Enforced** through
   counts. This is the level that forbids the dead-railway state (railway ∈ [1%, 15%] of GDP from
   1870).

**Bounds are on GROSS PRODUCT (value added), by ruling** — building outputs minus building inputs at
market prices, the same production-side quantity GDP is measured with (F45), so a bound reads
`VA_industry / GDP`. Not gross output: gross output cannot see that a building destroys value.
Consequences, stated: an industry with **negative pre-wage balance has negative gross product and can
never reach a positive floor by growing** (growth adds negative VA and makes the share worse), so
enforcement never grows a negative-VA tier, blocks the industry, and prints it on the standing
**NEGATIVE GROSS PRODUCT** line — that list is a *findings feed*, not noise (steel@1836,
artillery/explosives@1870 are debut-era squeezes of the §10.29 family; shipyards are permanent by
construction, their naval income being unmodelled, and are excused). And since the model's GDP is net
of construction's and the army's goods bills, category shares can top 100% — the bounds are calibrated
on that same denominator and must not be "corrected" against real-world national accounts.

**The bounds themselves are broad judgement calls, stated as such** (SCALE_LIMIT doctrine), calibrated
on the shipped 2026-08-09 presets so today's state passes wherever it is defensible: the failures they
manufacture on the shipped state are exactly railway@1870 (0.09%), railway@1900 (0.00%) and the
negative-VA list. A floor applies only where the industry can exist — the date gate, the chain rule,
ERA_PRUNE and the extinct rule all outrank it (`placement`'s `withheld` flag is the gate), and `lo = 0`
means *no floor at all*. Caps always apply. Future macroscenarios (a small trade-oriented country) are
additional entries in `MACROS`, selected by `ERA_MACRO=<id>` — never edits to `usa`.

**Enforcement semantics** (in `era_scenarios.mjs`, right after the unified §10.18/§10.38 recheck and
before the integer polish — the ordering is the precedence: a reasonability floor outranks a margin,
and nothing downstream may undo it, so the polish carries a macro guard on the GAP SUM, which catches
a move that deepens an existing breach where a breach COUNT would not):
- post-solve count moves only (minCount/maxCount, rawCap for reference producers), settle + re-price
  after every step — recipes and PM selections are final, `contSettle` is forbidden here (§10.21's
  rule);
- **floors grow the present tier with the best VA per level** (never a negative one), 25% of levels a
  step; **caps cut the oldest tier above one level first** (stale capacity dies first — §10.38's
  directive);
- **category moves pick members by the same tests and are undone if they push a member industry out of
  its own band** — the aggregate is never fixed by breaking a concrete bound. Category bounds sit far
  from the shipped state, so this path is dormant; if a bound is ever narrowed to where it binds,
  revisit the §10.18 interaction first;
- guards with the usual precedence: a step that breaches the +75% ceiling is undone and the bound
  blocked; a step that does not move the share is undone; a run that never moved the share at all is
  fully unwound (§10.21's futility doctrine — levels that bought nothing are junk), while partial
  progress is kept and the shortfall reported ("stalled at X%").

**Reporting:** a per-era `MACRO` block (moves kept, residual breaches, blocked bounds with reasons,
profession verification, the negative-VA line) and — the headline — a **MACRO REASONABILITY** block in
the final profit pass, computed on the SHIPPED state where recipes are final, because the in-era view
reads provisional leading-rung recipes (the §10.14.1/§10.39.3 lesson applies here too: the smoke run
grew railway@1870 to its floor in-era, and the final-state replay showed the same rung negative once
its era-3 recipe was final — only the outer iteration reconciles the two).

**Found and fixed on the way** (BUGS_AND_FIXES 2026-08-09): `applyCounts` never honoured `minCount`
for reference producers, so every §10.22 upper-band growth step on a raw producer was a silent no-op —
the margin never moved, the futility guard read that as "pinned at the floor", and the producer was
permanently blocked after one wasted step. The upper half of the raw band was unenforceable the whole
time it has existed. Fixed in the same pass (the macro layer needs the lever for its raw-category
floors); measured together with the layer below.

### 10.47.1 Measured results (macro layer + minCount fix, default + ERA_MACRO=0 + seeds 9/10, 2026-08-09)

| | final-state illogicality | losses £/wk | net £/wk | ceiling | macro residual |
|---|---|---|---|---|---|
| baseline cf21acb (seeds 8/9/10) | 66/82/64 (55/70/54) | 175/279/182k | 12.5/11.6/12.2M | 6 / 5 / 5 of 6 | — |
| minCount fix only (ERA_MACRO=0, seed 8) | 69 (58) · 9/8/15/17/12/8 | 177k | 12.5M | 6/6 | — |
| **fix + macro (ships, seed 8)** | **72 (61)** · 9/8/17/18/12/8 | **174k** (1.4%) | **12.5M** | **6/6** | **3** |
| fix + macro, seeds 9/10 | 85 (73) / 68 (58) | 300k / 184k | 11.5M / 12.1M | 5/6 / 5/6 | 9 / 5 |

**Metrically: a consistent +4–6 faults on every seed** — slightly above pure reshuffle, but the
ensembles overlap heavily and losses, net and the ceiling are unchanged (the default still clears all
six eras). About half the shift is the minCount fix alone (66→69 on seed 8, all of it era 2 — the raw
sector re-equilibrating now that over-band growth actually works), the rest the macro layer's kept
railway levels running slightly unprofitable. The layer is a ruled CONSTRAINT, not an optimisation —
this is the price of forbidding the degenerate composition, and it is small.

**What the layer did on the shipped default:** grew railway +2 @1870 and +3 @1900 (banked progress,
then stalled honestly); professions pass everywhere; categories pass everywhere; **3 residual
breaches** — explosives@1870 (−0.53%, negative gross product), railway@1870 (0.27% < 1%),
railway@1900 (0.02% < 1%). Seeds add marginal edge cases of the same two families (motor/glass/munition
debut-era negatives; a 0.43%-vs-0.50% textile floor miss at e4 on seed 9; railway@e4 0.04% on seed 10
and railway@e5 −0.01% on seed 9 — the railway story is jagged late but structural early).

**⭐ THE RAILWAY WALL, mechanically pinned (the §10.47 discussion item).** Growing railway at 1870/1900
is futile by measurement, not by guess: transportation demand there is POP-ONLY (~900/~1,400 units)
and urban centres already cover much of it, so a railway level's gross product collapses as the sector
grows — measured on the shipped state, VA/level **+£536 at 3 levels → +£71 at 10 → −£377 at 20**
(1870), with engines pinned at the 175 ceiling on the way; the reachable share maxes at ~0.3% (1870) /
~0.02–0.55% (1900, seed-dependent) against the 1% floor. **The missing ingredient is freight.** At
1920 raw producers buy ~17,900 units of transportation through vanilla's rail-transport methods
(`pm_rail_transport_mine`, `pm_steam_rail_transport`, logging/oil variants — all tech `railways`, our
era 2, so AVAILABLE from 1870) and railway jumps to ~336 levels; at 1870/1900 the optimiser correctly
refuses them, because in this model they are pure wage arbitrage — ~£150–200/level of transportation
bought against ~£150 of laborers' wages saved at 1870's base wage — and the trade only turns positive
as wages rise toward 1920. Vanilla models freight as labour-saving automation; our scenarios inherit
that abstraction, so the 1870–1900 railway age cannot happen in them without a ruling. Candidate
remedies for the user: (a) mandate rail freight on raw producers from era 2 (the street-lighting
precedent; measured as an experiment arm via `ERA_FORBID_PMS=pm_road_carts@2`), (b) lower the middle-era
railway floors to what a pop-only market supports, (c) model a real freight channel (a new mechanism).

**Remedy (a) MEASURED — the freight mandate arm (`ERA_FORBID_PMS=pm_road_carts@2`, seed 8, one run,
NOT shipped):** faults **70 (59)** — slightly better than the shipped default's 72 (61) — losses
£273k (+£100k, the freight bill landing on marginal producers), net £12.0M (−0.5M), ceiling 5/6 (the
one breach is at 1836, clippers + a lead orphan — seed-class artifacts of a different solve
trajectory, not freight effects; the mandate starts at 1870). **Railway per era: ~1.0% @1870 · 0.90%
@1900 · 0.95% @1920 — and the macro pass made NO count moves there: with freight demand real, the
ordinary price/count machinery builds the railway sector on its own**, and the macro floor decays into
a verification that misses by 0.01–0.10pp on a deliberately broad bound. Two second-order effects to
weigh: the 1920 railway boom flattens (0.95% vs 2.13% — the whole system re-equilibrates around
earlier rail), and 1870's explosives squeeze clears while 1836 picks up small glass/motor negatives.
A ruling, not a default: it re-prices the entire raw sector from 1870 (−£150–200/level), so it ships
only if the user rules that a railway-age mine ships by rail as a matter of era, like street lighting.

⭐⭐ **F47 SETTLES THE "IS THE MANDATE ARTIFICIAL?" HALF (measured 2026-08-09).** Vanilla itself adopts
rail freight against the wage arithmetic: 9 rail-freight raw producers in 1838 → **1,261 (58%) by
1912** — mines 72%, oil 81%, logging 63%, plantations 51% — while vanilla's own wage/wealth trajectory
over those 75 years is as flat as our ladder's (USA laborers gain ~2.8 wealth levels; F26-implied wage
×~1.4). The flip arithmetic on our presets needs ×1.8–2.6 the 1900 wage (×3.9–6 at 1870), and even the
shipped 1920 adoption is a frozen phase of a bistable limit cycle (a mine's break-even transportation
price at 1920 wages is ~65% of base; railways need ~95+ — the viability bands never overlap on the
current wage path). So freight adoption in the game we mod is NOT a profit decision, a profit-only
solver can never reproduce it, and "raise wages until it flips" both departs from vanilla's measured
wages and re-runs the measured ERA_WAGE_RAMP bankruptcy (§10.42.5) — wage shares of raw-producer cost
are 32–100%, and the ore-price rise a doubled wage demands cannot even be expressed inside the
engine's hard 25–175% band. An era-gated adoption rule (mandate) is the vanilla-faithful mechanism,
not an artificial one; the vanilla-paced variant would put rail on mines/oil/logging from era 3 and
leave 1870 on road carts (vanilla 1876 adoption was still low).

❌ **A SHIPYARD-STYLE TARGET HANDICAP FOR RAILWAY IS MEASURED AND IT HURTS (`ERA_RAIL_PENALTY=-0.10`,
seed 8, 2026-08-09; knob kept at default 0).** The user's question — would a −10pp railway target
(the −30pp shipyard pattern) substitute for the freight ruling? Against the shipped derived-bounds
state: faults 72 (61) → **74 (63)**, losses £178k → **£292k**, net £12.3M → **£11.8M**, ceiling
6/6 → 5/6, macro residuals 15 → **17** — and railway's mapped share FELL at every era it exists:
0.11→0.05% @1870, −0.00→**−0.56%** @1900, 1.70→0.84% @1920, 1.16→0.61% @1945. The mechanism is the
prediction confirmed, and it is instructive: (1) the count controller sizes railway off transportation
ORDERS, which no scoring change creates, so the handicap cannot add demand; (2) what it CAN do is make
`solveInputsAt` solve the dominant railway recipe to −5% instead of +5% — ~10% of revenue MORE inputs
per level — so every railway level produces LESS gross product; (3) the spared-from-shrink and
macro-grown levels (e3 grew +17) then carry that value-poorer recipe, and at final prices the 1900
railway sector is outright value-DESTROYING (−0.56% of the mapped economy). The shipyard handicap is
right because it compensates REAL income the model cannot see (naval construction); pre-mandate
railway has no hidden income — freight revenue does not exist in the modelled market — so the handicap
asserts income that is not there and the machinery converts the assertion into input-richer,
value-poorer railways. Do not ship it; the knob stays for re-measurement only.

## 10.47.2 The bounds are DERIVED from the real US, on the mapped commodity economy (user-ruled 2026-08-09)

The first bounds tables were broad hand calibrations. The user replaced the method: **look up the
actual US share X of each industry (Y per group) at the scenario date; industry gates are [X/4, 4X],
group gates [Y/3, 2Y]** — with a three-step procedure that makes the real numbers commensurable with a
model that is autarkic and goods-only:

1. **IMPORT ADJUSTMENT** (the autarky premise): where the US was a noticeable importer, X is scaled to
   CONSUMPTION rather than domestic production, using a narratively similar industry of similar traded
   value as the scale reference where the direct figure is thin (synthetics — German dyes; fertilizer —
   Chilean nitrates; explosives inputs). Extended on the same logic to the **army premise**: the
   scenario keeps a 5%-of-GDP standing army against the real US's ~1%, so arms/artillery/munitions X
   is the peacetime share ×~5 — and 1945 uses the interwar-normal share, NOT the war peak, because a
   floor above what the premise's own demand generates is a floor no market could honour.
2. **MAP OR DROP**: every real industry maps into our classification or is removed — dropped as
   unmappable: trade margins, finance, housing, professional/domestic services, government, road
   transport, printing, and construction (a demand sink here, not an industry). Basket remaps recorded
   in era_macro.mjs: flour/meatpacking/dairy/distilling → agriculture (the game sells grain, meat and
   fish to pops raw, so that value sits on farms); apparel+footwear → textile; pottery/household
   ceramics → glass; heavy electrical equipment → motor (leaving electrics the communications/consumer
   basket). The art academy has no surviving real counterpart and is dropped from the calculation
   (its hand sanity cap stays).
3. **RENORMALIZE**: shares are restated over the **mapped commodity economy** on BOTH sides — the real
   series over what survived the mapping, the model over its symmetric total (every tier industry +
   raw reference producers + subsistence, with urban centres excluded as the model's own
   unmappable-services counterpart). The solver's macro shares, reports and enforcement all moved to
   this denominator; nothing macro reads raw model GDP any more.

⚠ **The mfg-raw/mfg-mfg split gates are GONE by the mapping rule itself**: the model splits per TIER by
recipe (late steel migrates to mfg-inputs the moment it starts eating electricity), which no census
series can follow — unmappable, so removed, and the manufacturing TOTAL is gated instead. The split
stays in the sector-composition report, ungated.

**The derivation validates the model in one place and indicts it in two.** Renormalized, agriculture
lands almost exactly on the real series (real 36% of the mapped economy at 1900 vs the model's 36.5%;
27 vs 23.9 at 1920) — the premise chain (peasant shares → subsistence → farm sizing) reproduces real
US structural change with no fitting. The two structural findings, kept loudly visible:
- **Extraction runs ×1.8–4 the real share at every date** (real mining+logging 4.9–9.3% of the mapped
  economy; the model 18–52%, RISING with era as iron/oil hit their scale caps): V3's price vector
  books the value at the pithead — a mine turns ~£60 of tools into ~£1,200 of ore — where reality's
  value accrues in processing and distribution, and manufacturing additionally wears the 4:1 VA cap.
  No count bound can close a price-vector gap without starving every input chain into the +75%
  ceiling, so the extraction cap is **VERIFY-ONLY**: computed from real Y, reported red, never
  enforced.
- **Railway's real share is ~7–11% of the mapped economy through 1870–1945**, so the derived floors
  (1.75/2.7/2.75/2.05%) sit far above anything the model can reach — even the freight-mandate arm's
  ~1% of GDP is ~1.3–2% mapped. §10.47.1's wall, sharpened: V3 under-weights transportation the same
  way it over-weights ore, and the bound now states the full size of that gap instead of a
  hand-shrunk version of it.

**Dry-checked against the pre-derivation shipped state** (offline replay, before the re-solve): groups
pass everywhere except extraction's structural red; the firing set is historically sensible — floors
grow power@1900 (0.10→0.20 wanted), automotive@1920/45 (real autos were ~3–5% of the commodity
economy), electrics@1945 (the radio age), port@1836, railway@1920/45; caps trim paper@1870 (3.2 vs
2.8 — the admin-paper appetite) and automotive@1900 (0.55 vs 0.40 — a car industry a decade early);
walls stay walls (steel@1836, explosives@1870, motor@1870's two-sided engines squeeze, railway
@1870/1900, electrics@1900 debut).

### 10.47.3 Measured results (derived bounds, default --write + seeds 9/10, 2026-08-09)

| | final-state illogicality | losses £/wk | net £/wk | ceiling | macro residual |
|---|---|---|---|---|---|
| hand-bounds state (§10.47.1) | 72/85/68 (61/73/58) | 174/300/184k | 12.5/11.5/12.1M | 6 / 5 / 5 of 6 | 3/9/5 |
| **derived bounds (ships, seed 8)** | **72 (61)** · 9/9/17/17/12/8 | **178k** (1.4%) | **12.3M** | **6/6** | **15** |
| derived bounds, seeds 9/10 | 84 (72) / 73 (63) | 315k / 185k | 11.4M / 12.1M | 5/6 / 5/6 | 21 / 18 |

**The derivation is metrically free** — faults, losses, net and the ceiling are the previous state's
within noise on every seed (the write is a fresh solve, so even the recipes came back near-identical).
What changed is what the report NAMES: the residual count 3 → 15 is not the economy getting worse, it
is the yardstick getting honest — the hand bounds were calibrated so the shipped state passed, the
derived bounds state the real-US gap wherever one exists. The 15 named residuals on the default fall
into exactly four families:
1. **The transport gap** — railway 0.11% / −0.00% / 1.70% / 1.16% against derived floors
   1.75/2.73/2.75/2.05% (real rail was ~7–11% of the commodity economy). §10.47.1's freight ruling is
   the open lever; even the mandate arm's ~1.3–2% mapped would close only half the 1900–20 gap.
2. **The late-era new-economy undersizes** — automotive 0.49/0.65% vs floors 0.83/1.18%, electrics
   0.17% vs 0.40% @1945, power 0.09% vs 0.20% @1900: the same disease as railway on the demand side —
   pop budgets in V3 cannot fund cars/radios/power at their real shares, so enforcement grows a few
   levels and stalls at the price wall. A finding about the game's demand system, now stated with
   real-history numbers attached.
3. **The debut walls, unchanged** — steel/motor@1836, explosives@1870, electrics@1900: negative or
   near-zero gross product in the good's first era (§10.29 family), floors unreachable by
   construction, blocked and reported.
4. **Hairline misses** — artillery 0.10 vs 0.13, power@1945 1.02 vs 1.05: within the derivation's own
   2sf noise; not worth a lever.
Extraction's verify-only structural red prints at every era (18→52% vs real caps 9.8–18.6%) on its own
line, never enforced, per §10.47.2.

⭐ **The layer caught a real degeneracy in seed 9**: e4 textile at **0.17%** of the mapped economy
against a 1.93% floor — that seed shrinks the 1920 textile industry to a stub, which every previous
metric shrugged at (its margin faults counted the same either way) and the derived floor now flags by
name. That is the bound doing precisely what "no industry should be dead" was written for, on the
first ensemble it ever saw.

## 10.47.4 The subsidy tolerance — infra may run at a book loss, because vanilla says so (user-ruled 2026-08-09)

**The premise, verified in the game files:** vanilla's default AI strategy subsidises the
infrastructure trio at `must_have` — `building_power_plant`, `building_railway`, `building_port`
(`00_default_strategy.txt`, the subsidies block every AI country inherits). In the game we mod, a
loss-making railway does not die; the state pays the difference. The user's ruling: model that stance,
but bounded — infra must not gobble the budget, and no state budget will be modelled.

**The design — a LOSS TOLERANCE, never income, never a recipe change** (`ERA_SUBSIDY_TOL`, default
0.10; =0 reverts):
- the ladder criterion's loss floor for railway/port/power drops by the tolerance (an infra industry
  at −10%..0 is subsidised operation, not a fault) — mirrored in `ui/econ.js`'s `LADDER_LOSS_FLOOR` so
  the UI's Ladder check and the solver keep the ONE implementation;
- the loss-shrink and its recheck treat the trio like the shipyard handicap (cut only below −tol);
- **the recipe targets are untouched** — §10.47.1's measured `ERA_RAIL_PENALTY` failure is exactly
  what happens when target softness reaches `solveInputsAt`: ~10% of revenue more inputs per level,
  and the sector gets value-poorer at every era. Tolerance is applied at the five SCORING sites only;
- **the implied SUBSIDY BILL is printed per era** in the final profit pass (the trio's aggregate book
  losses, per industry — a profitable port does not offset the railway, matching per-building
  subsidies in-game), with its share of GDP. The bound needs no budget model because it is structural:
  bill ≤ tol × the trio's cost base, and the trio's size is bounded by its own market and the macro
  caps.

## 10.47.5 Closing rulings (user, 2026-08-09) — freight stays as-is, onset losses are tolerable, and the verification that let them stand

1. **FREIGHT — ACCEPTED AS-IS.** "Vanilla doesn't immediately switch to freight trains either." No
   mandate ships; the derived railway floors (1.75–2.75% of the mapped economy) and the 1920
   cycle-phase swing (§10.47.4.1) stand as ACCEPTED NAMED RESIDUALS, not open work. The freight
   bistability remains interesting only as a PM-SETTLING specimen (the hysteresis session's material),
   not as a demand problem to fix.
2. **NEGATIVE GROSS PRODUCT IN ONSET ERAS — TOLERABLE**, conditional on two verifications, both run on
   the shipped state and both passing:
   - **every negative-VA industry has at least some consumers** — steel@1836 buys 63 (the date-gated
     era-2 rungs present at 1836 eat it — the old "era-1 steel has zero buyers" was a statement about
     the pre-date-gate placement), engines 11, telephones 106 (pops), fine art 11 (pops),
     clippers/steamers heavy port demand, railway@1920 transportation 2,936. Nothing fails;
   - **the corridor distortion is negligible** — negative VA shrinks the mapped denominator by −4.72%
     at 1836 (dominated by the EXCUSED shipyard against a small £178k mapped economy) and −0.01…−1.82%
     at every later era, one to two orders of magnitude inside the factor-4 corridors, and in the
     FLATTERING direction for floors (a distortion-free denominator would make the named hairline
     misses marginally deeper, never flip a pass). ⚠ If 1836's 4.7% ever matters, the available dial
     is excluding LADDER_EXCUSED industries from the mapped denominator — noted, not needed.
   An onset industry that ever LOSES its consumers or grows its denominator drag past the corridors'
   noise re-opens this ruling; the NEGATIVE GROSS PRODUCT report line is the standing watch.

### 10.47.4.1 Measured results (default seed, report-only + reproducing --write, 2026-08-09 — SHIPS)

| | final-state illogicality | losses £/wk | net £/wk | ceiling | macro resid | subsidy bill |
|---|---|---|---|---|---|---|
| pre-tolerance (§10.47.3) | 72 (61) · 9/9/17/17/12/8 | 178k | 12.3M | 6/6 | 15 | — |
| **subsidy tol −10% (ships)** | **71 (61)** · 9/9/17/18/10/8 | 205k (1.7%) | 12.0M | **6/6** | **15** | **£0/0/0/0/1k/0** |

**Metrically free, and the bill answers the budget fear by measurement**: the trio's aggregate book
losses are ZERO in five of six eras and **£1k/wk (0.02% of GDP) at 1920** — at −10% tolerance the
subsidised infrastructure barely draws on the allowance, and the structural bound (bill ≤ tol × cost
base) never comes near binding. Railway landed where the tolerance can actually help: **1900 goes
0.00% → 0.33%** of the mapped economy (the macro floor's +17 grown levels now SURVIVE the loss-shrink
instead of being cut back) and **1945 reaches 1.88%** (vs floor 2.05 — a near-miss now, from 1.16),
with 1870 at 0.15%. Era-4/5 faults drop 12/8 → 10/8. ⚠ The 1920 railway share swung 1.70 → −0.01% —
that is the FREIGHT BISTABILITY changing phase between runs (the §10.47.1 limit cycle; the share has
read 2.13/1.70/0.84/−0.01 across four same-design runs), not a tolerance effect, and it is the
strongest remaining argument for settling the freight ruling: a mandated freight side would pin that
cycle. The derived railway floors (1.75–2.75%) remain honest residuals — the tolerance keeps a
REASONABLE railway sector alive at a bounded book loss; the historical SHARE still needs freight
demand.

## 10.48 The hysteresis session (2026-08-10) — PM choice SETTLES, and two ceiling-precedence bugs it flushed out

The experiment §10.42.5 scheduled and §10.47.5 handed over: make the discrete method choice settle.
Solver-only, no game runs; every arm judged on the 3-seed jitter ensemble (`ERA_JOINT` 8/9/10) against
the §10.47.4 reference state, which the harness first re-reproduced exactly (seed 8: 71 (61) ·
9/9/17/18/10/8 · £205k · £12.0M · macro 15 — byte-for-byte).

### 10.48.1 What the campaign measured (10 arms, 31 solver runs)

Illogicality is FINAL-STATE, excl-shipyards in parens; losses/net £/wk; "settled" counts eras whose PM
optimality line reads SETTLED; "phase noise" is the count of (building, PMG) selections that differ
across the three seeds' shipped states (the direct measure of solver noise in the method choice).

| arm | ill (excl) by seed | losses | net | macro | settled | phase noise |
|---|---|---|---|---|---|---|
| baseline (HEAD d5e1893) | 71(61)/79(68)/80(68) | 205–334k | 11.7–12.0M | 15/20/17 | 0/18 | 137/903 |
| `ERA_PM_MINGAIN=0.05` | 71(60)/68(58)/69(58) | 145–256k | 12.1–12.7M | 17/17/20 | 0 | — |
| `ERA_PM_MINGAIN=0.10` | 68(57)/66(56)/68(58) | 173–211k | 12.0–12.7M | 14/13/18 | 1 | 79/894 |
| `ERA_PM_MINGAIN=0.20` | 69(59)/76(65)/81(69) | 215–301k | 12.8–13.1M | 18/13/14 | 10 (early-break) | — |
| `ERA_PM_SEED=prod` alone | 72(61)/84(73)/62(52) | 189–238k | 11.5–13.0M | 20/21/23 | 0 | — |
| seed=prod + mingain 0.10 | 73(63)/69(59)/68(58) | 195–307k | 13.3–13.5M | 19/19/17 | 7 | — |
| freeze alone (0.02 churn) | 76(65)/77(66)/70(60) | 332–352k | 11.1–11.4M | 14/19/16 | 18/18 | 54/894 |
| freeze + 0.10, early-break | 64(54) ×3 (byte-identical) | 174k | 12.9M | 19 | 18/18 | 0 |
| freeze + 0.10 + full budget | 66(56)/67(56)/63(52) | 154–166k | 12.6–12.7M | 14–17 | 18/18 | — |
| **SHIPS: + set-guards + polish precedence** | **68(58)/64(54)/62(51)** | **154–218k** | **12.6–12.7M** | **15/17/15** | **18/18** | **50/897** |
| (same code, no knobs — the new default-path reference) | 65(55)/81(70)/79(67) | 214–334k | 11.3–12.0M | 14/21/15 | 0 | 136/903 |

The readings, in order of importance:

- **The hysteresis response curve is clean and 0.10 is its optimum** (ensemble mean of ill-excl: 65.7
  at 0.02 → 58.7 at 0.05 → **57.0 at 0.10** → 64.3 at 0.20, which also loses a ceiling era). The
  churn was mostly pairs of near-identical methods — the food industry's canning/distillery and the
  luxury PMGs dominate the differing-selection lists — trading places on noise-sized margins. The
  §10.42.5 deferral is lifted by this measurement.
- **Freezing without hysteresis is HARMFUL** (33–34 PMGs pinned at arbitrary phases, losses ×1.6):
  at 0.02 the optimiser churns so widely that cycle detection pins a third of the economy. Freezing is
  only safe AFTER hysteresis has thinned the churn to the genuine bistable pairs (10–13 pins).
- **⭐ The seed-jitter mechanism was literally "where the cycle got cut off."** With freezing + 0.10
  and the original early-break loop, the three seeds converged to a BYTE-IDENTICAL shipped state (same
  dump hash): once the PM fixed point arrives before the round budget, the budget — which is all
  `ERA_JOINT` varies — stops mattering. The shipped variant spends the remaining budget on the
  continuous half (see below), so seed variance returns through price convergence depth, but the
  discrete phase noise stays −63% (137 → 50), and the freight/railway specimen is FIXED: every seed
  now shows monotone adoption (no trains → wooden → steel carriages), where the baseline flipped
  `railway_electric`/`railway_diesel` between "steel carriages" and "no passenger trains" per seed.
- **An early PM fixed point must not starve the continuous half**: breaking the joint loop at the PM
  fixed point shipped 30–33pp residuals where the full budget reaches ~8pp (and cost the early-break
  arm its era-1 ceiling and macro 19). The loop now always runs its whole round budget and merely
  SKIPS the optimiser once settled — re-opening it only if a lifted pin (below) demands it.
- **Productivity-first seeding (user hypothesis: start each PMG at the era-legal candidate with the
  highest output-per-worker at base prices, `ERA_PM_SEED=prod`) is measured and PARKED**: it raises
  net output (~+8% on two seeds, £13.3–13.5M with hysteresis — it does bias toward capital-shaped
  local equilibria) but worsens illogicality spread (52–73 alone), macro residuals (17–23) and the
  ceiling, with or without hysteresis. It changes the STARTING POINT, not the dynamics, so it adds
  variance instead of removing it. The knob stays for re-measurement.
- **Longer joint settling (`ERA_SETTLE_ITERS=80`) does not dominate** (seed 8 degrades 58→67 excl)
  and doubles the joint-stage cost — parked at the default 40.
- Runtime: the shipped set roughly HALVES the solve's optimiser work (55–61 passes vs 109–142).

### 10.48.2 What ships (defaults; each revertable)

1. **`ERA_PM_MINGAIN` default 0.02 → 0.10** (`=0.02` restores).
2. **`ERA_PM_FREEZE` default ON** (`=0` reverts): after every joint round the full selection state is
   snapshotted; any (building, PMG) that RETURNS to a method it held after an earlier round is
   oscillating — a monotone march never revisits — and is pinned at the phase it returned to, which
   just won the score comparison at current prices ("best-of-cycle", not "last-of-budget").
   `optimisePMs` enforces pins, adds its own within-call cycles to the map, and DROPS any pin whose
   method stops being a legal candidate. ⚠ **A pin is not exempt from the ceiling**: a pinned phase
   that touches a good breached at 175 is lifted and the choice re-opened (measured: a pinned luxury
   phase held `silk buy 4 / sell 0` — an automatic 175 — through a whole joint loop before this rule).
3. **Ceiling guards compare breached-good SETS, not counts** (unconditional bugfix — see
   BUGS_AND_FIXES 2026-08-10: with dye already breached, the count-guard let the §10.38 shrink walk
   every iron mine out of an 1870 scenario, "1 → 1, fine" at every step).
4. **The integer polish leads its objective with the breach count and may clear a standing breach
   against the macro-gap veto** (unconditional bugfix, same entry: the old objective could not SEE a
   standing breach, and the macro veto then rejected the one +1-shipyard move that priced era-1
   clippers off the 175 wall because the shipyard's negative VA shrinks the mapped denominator).
   Result on the DEFAULT path alone: seeds 9/10's standing era-1 breaches are gone — **the ceiling is
   now clear in all six eras of all three seeds on both arms**, which the old defaults never achieved.
5. New measurement knobs, all default-neutral: `ERA_PM_SEED=prod` (parked), `ERA_SETTLE_ITERS`
   (default 40), `ERA_BREACH_TRACE=1` (prints per-step breach sets in the shrink loop — the
   instrument that localised the count-guard bug).

**The shipped reference state (bare defaults = the old seed-8 identity):** final-state illogicality
**68 (58 excl shipyards)** · per era 10/10/14/14/12/8 · losses **£156k/wk (1.2% of net)** · net
**£12.6M/wk** · **ceiling clear 6/6** · macro residuals 15 · subsidy bill ≈£0 (1k@1920) · **PM choice
SETTLED in all six eras** · ensemble (8/9/10): 68/64/62 (58/54/51) · £156/218/154k · £12.6–12.7M ·
macro 15/17/15 · ceiling 6/6 on every seed. Versus the same code without the two knobs: mean ill-excl
64.0 → 54.3, losses −35%, and 0 → 18 settled eras. Future A/B work compares against THESE numbers.
⚠ The freight-phase RUN-TO-RUN variance is dead (monotone adoption in every seed), but the freight
ruling itself (§10.47.5: accepted as-is) is untouched — railway's derived floors remain honest
residuals; what changed is that the share no longer swings between same-design runs.

## 10.49 The constraint-set experiment (2026-08-10) — bands for targets, a mandated price decline, and the increase mechanism: MEASURED, NOT SHIPPED

The user's three-part hypothesis ("should we try reducing or increasing constraint count once
more?"): **(A)** ADD a mandated aggregate price decline — manufactured goods' weighted-average
realised price must track an era ladder, mfg-from-mfg goods declining harder, any single industry
free to break it; **(B)** REMOVE the remaining explicit profit targets — the dominant recipe's +5%
pin becomes a BAND (no noticeable negatives, over-the-board positives penalised after late
settling, "reasonable 5–100% total-profit margins"); **(C)** ADD the reduction's mirror — an
INCREASE mechanism that grows the top-profit building (top of all scale-cap-eligible producers AND
≥20pp above the capital-weighted average margin; +10% of levels at ≥10, else +1), alternating one
increase with one reduction. All three are implemented behind default-off knobs (`ERA_PRICE_AVG`,
`ERA_PROFIT_BAND`+`ERA_BAND_LO/HI`, `ERA_GROW` with `=2` the strict variant, headers in
era_scenarios.mjs), and every arm below ran the full default pipeline, report-only, judged against
the §10.48 reference (which the refactored code first reproduced byte-for-byte: 68 (58) ·
10/10/14/14/12/8 · £156k · £12.6M · macro 15 · ceiling 6/6).

### 10.49.1 The redundancy audit (which constraints the proposals could supersede)

Exactly ONE explicit profit target still steers the solve: `solveInputsAt(dominant, +5%)` — the
recipe lever (counts chase the price path since §10.13; raw producers have bands since §10.22;
TG.current +20% survives only in scoring and the loss-floor arithmetic). The free-entry +25%
absolute cap is the one rule B's "penalise over-the-board positives" subsumes (under the band the
cap becomes the band top). Nothing else is redundant against the proposals: the per-good age-decay
price path is the WITHIN-class shape A's aggregate re-anchors, not a duplicate of it, and the
ceiling/scale/macro layers are the guards the proposals run under.

### 10.49.2 What the campaign measured (13 full solver runs + 2 ensembles)

Single-seed screening (default seed; ill = final-state excl shipyards; base reproduced = ref):

| arm | ill excl | per era | net | losses | macro | ceiling |
|---|---|---|---|---|---|---|
| base (ref) | 58 | 10/10/14/14/12/8 | 12.6M | 156k | 15 | 6/6 |
| A alone | 69 | 10/13/14/15/14/12 | 14.3M | **1.5M ⚠⚠** | 20 | 6/6 |
| B alone | 80 | 10/10/11/13/19/24 | 17.9M | 101k | 13 | **5/6 ⚠** |
| C plain (`ERA_GROW=1`) | 74 | 10/14/19/19/11/13 | 12.2M | 232k | 17 | 6/6 |
| C strict (`ERA_GROW=2`) | 65 | 6/11/16/12/10/19 | 12.0M | 434k | 15 | 6/6 |
| A+B | 71 | 10/11/15/10/13/19 | 19.8M | 118k | 13 | 6/6 |
| A+B+C2 | 67 | 9/9/12/10/13/19 | 19.7M | 135k | 11 | 6/6 |
| A+B+C2, band top 0.5 ("ABC2h") | 55→65* | — | 19.0M | 325k→130k* | 18 | 6/6 |
| A+B+C2, steeper ladders | 67 | 9/11/6/12/20/15 | 19.3M | 291k | 12 | 6/6 |

*before→after the plateau-offset fix below. The deciding 3-seed ensembles (`ERA_JOINT` 8/9/10):

| ensemble | ill excl by seed (mean) | losses | net | newest-rung losses | macro | ceiling |
|---|---|---|---|---|---|---|
| baseline (§10.48) | 58/54/51 (**54.3**) | 156–218k | 12.6–12.7M | ~28k | 15/17/15 | 6/6 ×3 |
| ABC2h | 65/52/70 (**62.3**) | **130–142k** | **18.5–19.5M** | **15–27k** | 19/15/14 | 6/6 ×3 |
| ABh (= ABC2h minus C) | 70/63/67 (66.7) | 198–321k | 18.1–18.3M | 72–178k | 16/18/15 | 6/6 ×3 |

### 10.49.3 The readings

- **The +5% recipe pin is LOAD-BEARING for obsolescence, not bookkeeping.** Under a target the
  dominant recipe's cost sits at revenue/1.05, so any price fall drowns the rung when its era
  passes; under a band top of 1.0 the cost sits at revenue/2 and a stale rung only dies when its
  price HALVES in two eras — no plausible ladder decays that fast, so B alone explodes the
  stale-profitable family (eras 4–5 read 19/24). Band top 0.5 (cost = revenue/1.5, death at ×0.67
  per two eras) is the working compromise, and its observed margins (5–50%) still sit inside the
  user's "reasonable 5–100%".
- **The three proposals only cohere TOGETHER — each alone is harmful.** A against pinned recipes
  re-riches every dominant recipe at the top of the falling price and bankrupts wholesale (£1.5M/wk
  losses, leading rungs 50.8pp adrift). B alone loses an era's ceiling and the stale tail. C plain
  grows the pithead artifact (smoke: era-5 sulfur +266, iron +255 — free entry chasing a margin the
  model itself calls a price-vector distortion, §10.47.2) and C in any form is worse than baseline
  outside the band stack. The user's instinct that A and B belong together is confirmed
  mechanically.
- **C strict earns its place INSIDE the stack**: ABC2h beats ABh on every axis (ill mean 62.3 vs
  66.7 · losses ~£140k vs ~£250k · newest-rung losses ~£20k vs ~£110k · net higher). The strict
  variant (a growth step may not deepen even a verify-only macro gap) is the only safe form.
- **What the band regime buys, at ensemble level**: net **+47–55%** (£18.5–19.5M vs £12.6M) ·
  losses BELOW baseline (£130–142k vs £156–218k) despite floating margins · loss-makers 98–104 vs
  124 · dominant rungs 6–9pp from aim vs 11pp · extraction's structural share red shrinks by
  10–14pp (e5 38% vs 52% — the higher-VA manufacturing dilutes the pithead artifact) · the feared
  chain-thinning did NOT happen (the 4:1 cap binds on 2 tiers, same as baseline; mfg-from-mfg
  share unchanged at ~49.5%).
- **What it costs: ~8 points of ensemble-mean illogicality (54.3 → 62.3), concentrated in
  stale-profitable** (27–30 vs ~23), with loss (~10–16 vs ~15) and inverted (~15–24 vs ~20)
  families roughly a wash. By the ruled criterion (§10.11: illogicality is the end) the
  constraint-set change as measured is NOT an improvement, so **the defaults do not move**.
- **⚠ A fault count can be bought with a dead industry** (§10.17's lesson, new clothes): the
  pre-fix ABC2h screening read 55 excl — better than baseline — while the A-offset had pushed
  textile to NEGATIVE gross product in its own plateau era (e4 −0.50% against a 1.93% floor). The
  fix (the plateau exemption starts AT the last tier's era, `>=` not `>`) revived textile and the
  count rose to 65 with losses falling £325k→£130k. Quote ensemble means, never a flattering seed.
- **A's ladder is realisable only where counts have authority**: eras 3–5 track within tolerance
  (achieved 92/87 · 92/73 · 82/57 against 96/88 · 84/68 · 72/50 raw/mfg), but eras 1–2 cannot be
  LIFTED to 120/130 — the floored one-level markets of §10.29 hold the averages down and no count
  can raise a price whose single level already floods its market.

### 10.49.4 Disposition — SHIPPED BY RULING (user, 2026-08-10: "ship this, this is an obvious improvement")

The §10.49.3 trade was put to the user and ruled: the band regime's economics outrank the ~8-point
illogicality cost. **The ABC2h stack is now the DEFAULT** — `ERA_PROFIT_BAND` ON (band top
`ERA_BAND_HI` default 0.50), `ERA_PRICE_AVG` ON, `ERA_GROW` default 2 (strict) — each with its
revert knob (`=0`; the target regime is one `ERA_PROFIT_BAND=0 ERA_PRICE_AVG=0 ERA_GROW=0` away).
The open design note above (a stale-rung killer that is not a price pin) stands as future work
under the new regime, whose stale-profitable family (~30) is now the biggest fault block.

### 10.49.5 The dominated-pin lift, and the shipped state (2026-08-10)

Shipping surfaced one more §10.48 blind spot, found by the user reading the ABC2h sheet: **the
era-0 textile mill ran `pm_craftsman_sewing` at −40.5% with +159.4% one candidate away** — a
bistable luxury PMG pinned by the cycle-freezer at the phase that had won at MID-SOLVE prices
(luxury_clothes has no SoL-7 buyer, so the method sells into a 25-floor while sacrificing clothes
at 161), and never re-scored: pins yielded to legality and the ceiling but not to PROFIT, and the
`pmDone` latch protected even unpinned selections (era 4 had two textile tiers stuck the OTHER
way, +40–49pp forgone). The defect predates §10.49 — the committed §10.48 baseline preset carries
the same selection. Fix, shipped with the ruling: **`ERA_PM_LIFT` (default 0.25)** — in the LAST
THREE joint rounds, present buildings' PMG selections are re-scored at current prices, and any
selection beaten by >25pp drops its pin and unlatches the optimiser, **one appeal per pin per era**
(full story in BUGS_AND_FIXES 2026-08-10 — the unconditional version re-opened every bistable pair
forever and cost §10.48's settling property, "PM settled 1/6", before the late-and-once form
restored it). The threshold sits far above `ERA_PM_MINGAIN` (0.10) so the churn the hysteresis
killed stays dead.

**The shipped reference state (bare defaults, after the `--write`):** final-state illogicality
**73 (64 excl shipyards)** · per era 9/13/9/11/14/17 · families loss 13 · stale-profitable 30 ·
inverted 21 · losses **£126k/wk (0.7% of net)** · net **£19.2M/wk** · **ceiling clear 6/6** ·
macro residuals 19 · **PM choice settled 5/6 eras** (era 2 the exception — the steel bistables
churn there under any regime) · era-0 textile on `no_luxury_clothes` · recipe mix `own 66 ·
below 24 · frozen 10`, no tier reading the previous write. ⚠ The unconditional-lift variant read
better on this seed (61 excl · £112k · £20.7M) and is NOT shipped — it bought those points by
re-opening every bistable pair each round, which un-settled the discrete choice (1/6) and put the
shipped state back on "wherever the budget ran out"; the one-appeal form keeps the §10.48
contract. **Ensemble (`ERA_JOINT` 8/9/10): 73/62/73 (64/55/65 excl) · losses £126/298/161k · net
£19.2–19.5M · macro 19/17/16 · ceiling clear 6/6 on every seed · PM settled 5/4/5 of 6** — mean
ill-excl 61.3 against the target regime's 54.3 and the pre-lift stack's 62.3. The write cycle is
a STRICT FIXED POINT (fourth `--write` reproduced the third byte-for-byte, both files). Future
A/B work compares against THESE numbers; the §10.48 figures are the last of the target regime.

## 10.50 The recipe ratchet (2026-08-10) — a later tier may not be less input-efficient, and the inverted family collapses

The user's complaint, verbatim shape: e0 tooling made 20 tools from 14.3 wood while e1 needed 77.3
wood for 30 tools — at base prices a value ratio of 2.80 collapsing to **0.78, a tier that DESTROYS
value at base prices**. Root cause: recipes are solved to margins at each tier's own dominant-era
REALISED prices, and nothing ever bounded a recipe's RICHNESS — the 4:1 value-added cap bounds only
leanness — so a tier solved when its output traded dear could go arbitrarily gluttonous. Census on
the shipped §10.49 book: **31 of 78 adjacent tier pairs violated monotonicity**, several
value-destroying outright (paper 4.01→0.80, steel 4.01→1.08, arms 3.95→1.07).

Two user hypotheses, both implemented as `ERA_RECIPE_MONO` and measured:
- **weak** — only where a pair is one-good-in/one-good-out with identical goods may the later tier
  not have a worse output:input ratio (physical; prices cancel, so it is the value rule restricted
  to where units are comparable). Scope: 6 of 78 pairs.
- **strong** — every adjacent pair of an industry: the later tier's O:I VALUE ratio at base prices
  may not be worse (base PMs only; secondary PMs deliberately unrestricted). "≥", not ">": two
  consecutive tiers at the 4:1 cap tie at ratio 4 exactly, so strict improvement is infeasible there.

Enforcement is a HARD Xmax in `solveInputsAt` (the mirror of the 4:1 Xmin; feasible by construction,
since ratio_prev ≤ 4 implies the ratchet cap is never below the lean floor), plus a violation check
in `solveDomRecipe`'s in-band early return so an outer pass moving the tier below re-opens the
recipe. The final profit pass prints a RECIPE MONOTONICITY census on every run.

Measured (single seed, then the deciding 3-seed ensemble for strong; reference = the shipped §10.49
state 73 (64) · £126k · £19.2M · macro 19):

| arm | ill excl | families L/S/I | net | losses | macro | census |
|---|---|---|---|---|---|---|
| reference (off) | 64 | 13/30/21 | 19.2M | 126k | 19 | 31/78 |
| weak | 63 | 14/32/17 | 19.7M | 135k | 15 | 21/78 |
| **strong** | **54** | 12/36/**6** | 20.1M | 138k | 16 | 3/78 (rounding) |
| strong, seeds 9/10 | 61/53 | 9–10/38–44/5–8 | 20.2–20.3M | 100–141k | 17–18 | 3–4/78 |

**Strong ships as the default** (`ERA_RECIPE_MONO=strong`; `weak`/`0` revert): ensemble mean
ill-excl **56.0 against the regime's 61.3**, the **INVERTED family collapses 21 → ~6** (a newer tier
that is structurally at least as input-efficient cannot easily earn less than the rung below), the
LOSS family thins to 9–12 with newest-rung losses at £5–19k/wk, net rises to £20.1–20.3M, macro
improves, and the ceiling stays clear on every seed. The residual census entries are 0.1-unit
rounding at the 4:1 cap (4.02→3.99), inside any honest reading of the rule. Costs, stated: the
stale-profitable family absorbs more (36–44 — lean old rungs die even more slowly, the §10.49 ruled
trade continuing), and ratcheted dominant rungs float further above the band top (dominant "on-aim"
64/102 vs 81/102), which is the constraint being hard while the band is soft — free entry, not the
recipe, now carries those margins down. Weak is strictly dominated by strong on every axis measured
and survives only as the knob's intermediate setting.

**The shipped reference state (bare defaults, after the `--write` — SUPERSEDES §10.49.5's):**
final-state illogicality **57 (54 excl shipyards)** · per era 3/5/7/12/15/15 · families loss 12 ·
stale-profitable 36 · inverted 6 · losses **£138k/wk (0.7% of net)** · net **£20.1M/wk** · ceiling
clear 6/6 · macro residuals 16 · PM settled 5/6 · census 3/78 (rounding hairliners at the 4:1 cap) ·
the complaint recipe now reads e0 = 20 tools from 10 wood, e1 = 30 tools from 15 wood — identical
physical efficiency, monotone at the ratchet edge. Ensemble (`ERA_JOINT` 8/9/10): **57/65/58
(54/61/53 excl)** · losses £138/100/141k · net £20.1–20.3M · macro 16/18/17 · ceiling 6/6 ×3 ·
newest-rung losses £5–19k/wk. Write cycle byte-identical (verified on the shipping pass). Future
A/B work compares against THESE numbers.

### 10.50.1 Clarified scope (user, 2026-08-10) — the defect is the regression, not the level

"It is not automatically forbidden for a PM to be value-destroying at base prices, as long as there
are plausible price scenarios when it's not value-destroying." The section above leaned on sub-1
base-price ratios ("a tier that destroys value at base prices") as if the LEVEL were the crime; it
is not, and the shipped mechanism never treated it as one — the ratchet has NO absolute floor, only
the pairwise bound, so a chain whose first tier sits below 1 may legally stay below 1. The shipped
book proves the scope live: textile's plateau pair runs 0.82/0.82, fertilizer 0.98 across three
eras, electrics debuts at 0.75 and power at 0.79 — every one viable at its own realised prices,
every one legal. Sub-1 at base prices was EVIDENCE OF MAGNITUDE in the tooling case (2.80 → 0.78 is
how far backwards a recipe had walked), not the offence; the offence is only a later tier less
input-efficient than the tier below it. Do not derive an absolute ratio floor from §10.50 — none
exists, and adding one would outlaw eight currently-healthy industries' debut and plateau tiers.

### 10.50.2 The premise chips (2026-08-10) — army and construction GDP shares, displayed and audited

Two read-only chips beside the UI's GDP figure (user request): **army/GDP** (battalion upkeep at
current prices ÷ weekly VA) and **constr/GDP** (the construction sector's goods bill ÷ weekly VA),
recomputed on every change, on the solver's own self-inclusive basis (both bills already sit in
`inAgg`, so the VA nets them off — the same arithmetic `setArmy` and `sizeConstruction` target).

The audit across the six shipped presets, against the premises (army 5%, construction 8→18% ramp):

| era | army share (want 5%) | battalions shipped / wanted at final prices | constr share | target |
|---|---|---|---|---|
| e0 | 4.3% | 65 / 75 | **2.9%** | 8% |
| e1 | 4.5% | 132 / 146 | 8.0% | 10% |
| e2 | 3.9% | 333 / 428 | 11.2% | 12% |
| e3 | **1.8%** | 372 / **1027** | 13.8% | 15% |
| e4 | **6.8%** | 1187 / 874 | 16.8% | 17% |
| e5 | 5.3% | 1871 / 1754 | 18.1% | 18% |

**Construction tracks its ramp within ~1–2pp everywhere except 1780** (2.9% vs 8% — the floored
tiny-market era again). **The army does NOT hold its premise**: 1.8–6.8% across eras, drifting
wherever war-goods prices move between the last army sizing and the shipped price table. Era 3 is
the worst case and it is THE SAME DEFECT as the insolvent-war-industries finding (the arms/artillery
price collapse): the army was sized while small_arms/artillery were dear, the prices then crashed to
the floor, and the shipped battalions' upkeep costs only 1.8% of VA — while the sizing rule at final
prices would field 1027 battalions, whose demand would in turn lift the very prices whose collapse
bankrupted the producers. The premise drift and the war-industry insolvency are one feedback loop
seen from two sides; closing it means making the army a proper participant in the §10.14.1 joint
fixed point (a solver-order change — needs a ruling, not a knob).

## 10.51 The army joins the fixed point (2026-08-10, user-ruled) — the cobweb, the damped joint solve, and the undrop rule it forced

The §10.50.2 audit found the army premise adrift (1.8–6.8% against 5%), and the user ruled: "army
and construction should re-solve and change on price and GDP changes", with bounds — "6.8 instead
of 5 is hardly acceptable. 1.8 absolutely isn't."

**The mechanism, verified by simulation before fixing**: `setArmy` already re-sized every settle,
but sizing from CURRENT prices alone is a COBWEB — battalions = budget/unitCost(p) while
p = f(army demand), and the army is most of the war-goods books. Undamped on the shipped 1900
preset the iteration flips forever between ~78 groups (prices floored) and ~310 (prices at
122–175); the shipped 372 battalions were wherever the last tick landed, and era 4's 6.8% was the
same coin's other face.

**The fix (`ERA_ARMY_FP`, default ON; =0 reverts)**: battalions and the army-goods prices are
solved to their JOINT fixed point inside `setArmy` — damped iteration (λ=0.5, ≤40 steps, stop at
half a group) against the frozen non-army order book, which is exact because `S.UNITNUM` is
cleared first and no pop need buys war goods. Monotone budget demand against fixed supply ⇒ one
crossing; the damping kills the two-cycle. A skip cache keeps it cheap: when the naive
current-price sizing agrees with the incumbent within 3% the fixed point already holds and the
aggregates call is skipped, so a converged outer loop pays almost nothing.

**The knock-on it exposed, and the symmetric rule it forced**: the consistent era-3 army (553
battalions vs 372) raised sugar demand after sugar's plantations had been LEGALLY dropped as
unviable — buy 903 / sell 122, pinned at 175, and no rule could bring a dropped producer back
(the polish moves only our tiers). **UNDROP ON BREACH** now leads each recheck iteration: while a
restricted good is breached and a dropped/shed raw producer makes it, that producer is restored
(or its shed cap lifted 25%) as the step, and it joins the "kept at a loss — the market's only
source" protected set. The ceiling now outranks solvency in BOTH directions.

**Measured (3-seed ensemble, per-era ARMY lines new in the report, ⚠ flag at ±1pp of the
consistent 5.3% — the display basis makes 5% of army-exclusive VA read as 5/95):**

| | e0 | e1 | e2 | e3 | e4 | e5 |
|---|---|---|---|---|---|---|
| before (§10.50.2) | 4.3% | 4.5% | 3.9% | **1.8%** | **6.8%** | 5.3% |
| seed 8 | 2.9%⚠ | 4.5% | 4.9% | 5.0% | 5.0% | 5.3% |
| seed 9 | 3.6%⚠ | 4.5% | 4.8% | 5.2% | 4.9% | 5.2% |
| seed 10 | 2.8%⚠ | 4.5% | 4.9% | 5.1% | 4.9% | 5.2% |

Eras 1–5 hold the user's bound on every seed; era 3 fields 553–616 battalions where the cobweb
shipped 372. **Era 0 misses (2.8–3.6%) and stays flagged** — 64 battalions in a floored
tiny-market economy where band-edge prices make the demand curve degenerate; it joins 1780's
documented honest exceptions rather than being ground at. Ceiling clear 6/6 on all three seeds
(the undrop working); headline metrics a wash against §10.50 (ill-excl 59/53/58, mean 56.7 vs
56.0 · net £20.0–20.5M · losses £116–245k, the increase being producers now deliberately kept to
serve the consistent army). Construction needed no mechanism change — it was already in the loop;
its only miss is era 0's integer granularity (§10.50.2), likewise flagged, likewise 1780.

### 10.51.1 The one-shot audit, ruled item by item (user, 2026-08-10) — and the post-macro recheck it shipped

The user asked for a census of everything calibrated ONCE rather than in the loop (the army's
family), then ruled on each of the five findings:

1. **SoL + base wage set once per era from the fit, never re-solved against the realized economy —
   ACCEPTED AS DESIGN** ("that is intended for simplicity, or we'd never solve that"). The premise
   stays exogenous; do not build an SoL/wage feedback.
2. **The free-entry tuner's single pass** (its minCount floors and futility verdicts were permanent
   while macro/polish kept moving prices — part of why dominant rungs ended 6–17pp off the band
   edge) — explained, then RULED "needs fixing" and SHIPPED as **§10.51.2**: `runFreeEntry` is a
   function and runs twice, the second time after the macro pass with a CLEAN futility slate
   (`capBlocked.clear()` — the late-appeal doctrine: mid-solve verdicts get one re-hearing at
   near-final prices) and a MACRO GUARD the first pass does not need (a growth step that deepens an
   enforceable macro gap is undone and the tier blocked, so free entry cannot un-pay what macro's
   floors paid for). Order after macro: free entry second pass → loss/band recheck → polish.
3. **The macro enforcement pass ran last with no §10.18/§10.22 re-verification after its moves —
   RULED "NEEDS FIXING", SHIPPED**: the recheck is now a function that runs twice, the second time
   AFTER macro, sparing exactly the keys macro's FLOOR moves raised (`skipGrown` — a reasonability
   floor outranks a margin by the §10.47 ruling, so the recheck must not cut what macro paid for;
   everything else is fair game). The second call also re-verifies the §10.22 UPPER band, which
   previously only the tuner's one pass ever enforced: an over-band raw producer grows one level
   at a time under the same futility/ceiling guards, losses outranking over-earners for the step.
4. **Construction's era-0 miss (2.9% vs 8%)** — integer granularity in a floored tiny market,
   flagged ⚠ in the report — ACCEPTED ("all right"), joins 1780's honest exceptions.
5. **The per-era futility/block lists** (capBlocked, protectedRaw, growBlocked — dated verdicts
   kept for termination's sake; the PM side has its one late appeal) — explained; RULED left
   untouched ("if you can't quantify the effects or reason where it's the most likely to bite,
   let's not touch this"). Exposure is unquantified-low; §10.51.2's fresh-slate second pass
   incidentally gives the TUNER's list its late appeal, and the remaining lists stay as they are
   until a measured case names one biting. Revisit only with such a case in hand.

**The shipped full-stack ensemble (army FP + undrop + post-macro free-entry AND recheck, seeds
8/9/10):** ill-excl **58/54/55 (mean 55.7 — §10.50's was 56.0)** · losses £276/116/130k · net
£20.0–20.3M · macro 20/19/19 · **ceiling 6/6 on every seed** · ARMY eras 1–5 within ±1pp of the
consistent 5.3% on every seed (4.4–5.3%), era 0 flagged at 2.8–3.6% · every over-loss raw producer
a NAMED "kept: only source" case. The premise-consistency machinery is metrically free — the fault
count did not move — which is the right price for a constraint layer that only makes the shipped
state mean what it says.

⚠ **The one visible trade, stated as such: dominant rungs sit further off the profit band (mean
17.0 → 23.5pp) under the CONSISTENT army — and that is three ruled constraints colliding, not a
regression to fix.** The 5%-GDP army premise pours real demand into war goods; the §10.47 macro
caps forbid the war industries from expanding to absorb it (arms ≤ 1.20% at 1900); so their
margins float above the band top, and free entry's second pass correctly refuses to grow them (the
macro guard doing its job). A state buying 5% of GDP in weapons from an industry history says was
this size IS a fat-margin arms sector; the excess margin is the honest residual of the premise,
the caps and the band all binding at once. §10.51.2's second free-entry pass is ~neutral on
today's seeds for exactly this reason — its value is standing ready for the industries the caps do
NOT bind.

## 10.52 THE PAYBACK IS TWO YEARS, NOT TEN — the capital side, measured for the first time (2026-08-12)

⭐⭐ **§9's ten-year-payback model is arithmetically right and its one assumption is 3–6× off, so every
building on the sheet repays its construction cost in about TWO YEARS.** Measured with the new
`tools/payback_census.mjs` (read-only) over the six shipped era scenarios, at each scenario's own
realised prices:

| scenario | tiers present | profitable | payback p25 / med / p75 | capital-weighted |
|---|---|---|---|---|
| 1780 | 9 | 7 | 1.0 / **1.6** / 6.3 | 1.4 |
| 1836 | 28 | 21 | 0.9 / **2.1** / 3.5 | 2.0 |
| 1870 | 47 | 37 | 1.0 / **2.0** / 3.9 | 1.9 |
| 1900 | 57 | 46 | 1.0 / **2.1** / 3.8 | 1.9 |
| 1920 | 61 | 51 | 0.9 / **2.2** / 3.4 | 2.3 |
| 1945 | 63 | 56 | 0.9 / **2.2** / 4.3 | 2.2 |

**Why.** `solve_building_cost.ps1` pays the cost back out of an ASSUMED **20% return on operating
cost**. The economy the solver actually ships earns, on its DOMINANT rungs (`TPthr`, the same quantity
the solve bands):

| scenario | margin p25 / med / p75 | rungs above the +50% band top |
|---|---|---|
| 1780 | 27 / **80** / 139 % | 5/9 |
| 1836 | 30 / **56** / 138 % | 9/17 |
| 1870 | 25 / **64** / 158 % | 11/19 |
| 1900 | 26 / **67** / 158 % | 14/21 |
| 1920 | 44 / **76** / 163 % | 14/21 |
| 1945 | 45 / **104** / 183 % | 12/17 |

10 years × 0.20 ÷ 0.90 ≈ 2.2 years. Nothing had measured it because payback is a property of the
**recipe book and the scenario together**, and the two live in different tools — §9 works at base
prices with an assumed margin and never sees a scenario; the era solver works at realised prices and
never looks at `building_cost`.

⚠ **This is the handover's "overabundance of capital", stated as one number.** At the shipped cost book
the whole standing capital stock of the 1945 scenario is **2.7 years** of that scenario's own
construction budget (K £2.26bn against 18% of a £1.50bn GDP) — the economy could rebuild itself from
nothing three times a decade. K/GDP runs **0.32 → 1.51** across the eras against a real-world ~3–4.

⭐ **AND THE TWO GOALS ARE LINKED BY AN IDENTITY THAT CANNOT BE ESCAPED BY TUNING**:
`K/GDP = payback × (profit share of GDP)`. Our tiers' profit share of GDP runs **14 / 16 / 27 / 48 / 55 /
68 %** across the six eras (wage share 5 / 8 / 10 / 16 / 14 / 13 %), against a real ~25–35%. So a
20-year payback at era 5 *forces* K/GDP ≈ 13, and conversely a realistic K/GDP of 3–4 *forces* a
payback of about 5 years. **A payback ladder that RISES over the century and a buildable capital stock
are in direct conflict, and the profit share is why** — the deeper fix is the wage share, which is
pinned (see §1: `W = base wage × Σ employees × wage_weight`, both pinned, landing at 10–40% of cost).

⚠ **A cost rule cannot make the ladder climb, and the census says so directly.** Under any
payback-anchored book, the median payback of the PROFITABLE STALE rungs is *shorter* than the dominant
rung's in 1836, 1870 and 1900 (10.7 vs 13.0 · 10.6 vs 14.4 · 13.2 vs 15.0 at the 10→20 ladder): the old
building is cheap AND still turning a healthy margin, so it remains the better investment. That is
§10.49's ruled stale-profitable trade (36 of the 57 faults) seen from the capital side. Build cost
cannot fix it — making OLDER buildings dearer is absurd — the price ladder has to.

**Status: measured, not shipped.** The rule proposed on top of it (`building_cost = c(era) × base-price
output value`, `c = P(era) × 52 × ρ(era) / £720`) is with the user for a ruling; `payback_census.mjs
--rule --p0 <a> --p5 <b>` derives and tests any ladder. ρ, the median realised-profit-to-base-output
ratio at a tier's dominant era, measures **0.54 / 0.69 / 0.54 / 0.52 / 0.57 / 0.61** — nearly flat,
which is what makes a six-number table enough.

## 10.53 TWO CALENDARS — 41 tiers were gated an era too high (user-ruled 2026-08-12)

⭐⭐ **A tier's era and its unlocking technology's era were being decided by two different functions,
and they disagree everywhere above era 1.**

```
the ladder's era bands (build_era_ladder, midpoints between the anchors):  1790 | 1850 | 1885 | 1912 | 1932
gameEra() in tech_tree_spec.mjs (VANILLA's own era windows):               1836 | 1861 | 1886 | 1911
```

A NEW technology that omits `era` gets `gameEra(year)`. So `cemented_carbide` (1927) landed in game era
5 while the tier it unlocks, `building_tooling_workshop_carbide`, is ladder era 4 — our e4 band being
1912–1932. **41 of the 106 tiers**, always by exactly one era, never two and never the other way: the
whole tooling ladder above e1, every port rung, every artillery and munitions rung. By ladder era:
e1 8/17 · e2 9/19 · **e3 15/21** · e4 9/21 (e0 and e5 clean by construction).

**It is not cosmetic.** The mechanical eras exist for two things and this hit both — the **era base
cost** (15 000 at era 4 against 17 500 at era 5) and the **ahead-of-time penalty**, so the affected rung
was dearer *and* penalised at exactly the date it is meant to be the workhorse. And it contradicts what
an era MEANS here: era 4's anchor is 1925 and its definition is "a leader holds about half of era 4's
technologies at 1925", yet this rung needed an era-5 technology, whose anchor is 1940. A live suspect
for the handover's "only 38% of the ladder is realised" and the e4/e5 level shares of 16%/4% at 1936 —
suspect, not measured, and not separated from cost or workforce.

**THE FIX IS A RULE, NOT A TABLE**: a technology that unlocks one of our tiers is placed in the
mechanical era that tier maps to (our e0 AND e1 → era 1, then 1:1), re-derived from the ladder every
run so a re-band cannot silently reintroduce the drift. The 2026-08-12 re-band had worked around it by
stating `era` by hand on its fifteen new rungs — correct, and exactly the fix that does not scale.

**THE THREE INVARIANTS IT RESPECTS (user-stated), each verified against the EMITTED mod, not the spec:**

1. **A 1836 situation keeps vanilla's PMs and tiers.** Only a move into **era 1** could change that —
   `add_era_researched = era_1` hands every era-1 technology to the tier-1/2 countries at the start, so
   lowering `railways` or `rifling` there would give the powers railways and rifled arms in 1836, which
   vanilla does not. Era 2+ is invisible to the start. Verified: the 16 history files are byte-identical
   (sha 6 a19a314f…), `00_starting_inventions.txt` is unchanged, and era 1 is still the only era granted.
2. **A 1836 tier's country holds its technologies** — `verify_start_techs.mjs --vs-vanilla`: *no starting-
   technology gap beyond vanilla's own* (vanilla itself fails on 6 countries). Lowering can only help here.
3. **No prerequisite in a later era** — re-parsed off the four emitted technology files: 233 technologies,
   310 prerequisite edges, **zero inversions**.

**32 moved. 9 held, and they are the discussion list:** eight that would land in era 1 —
`intensive_agriculture` (fertilizer e1, 1842) · `screw_frigate` (shipyard e1, 1845) ·
`iron_screw_steamers` (shipyard_steam e1, 1843) · `rifling` (arms e1, 1849) · `shell_gun` (artillery e1,
1830) · `percussion_cap` (munition e1, 1830) · `steamship_bunkering` (port e1, 1840) · `railways`
(railway e1, 1825) — every one an e1 rung whose technology postdates the 1836 start, so the conflict is
real rather than mechanical; and `telephone`, whose prerequisites `shift_work` and `electrical_generation`
would sit later. Whatever the rule declines it PRINTS: a rule that silently skips is indistinguishable
from one that never ran.

Result: production per era **15/14/20/23/20 → 15/18/26/19/14**, budget 1198k → 1148k; military
12/13/15/19/17 → 12/17/16/17/14, 990k → 960k; society untouched. ⚠ **Era-5 production falls from 20
technologies to 14** — that changes what "half of era 5 by 1940" means and partly re-opens the era-5
hole the re-band was filling. Not addressed here.

⚠ **TWO DEFECTS THIS FLUSHED OUT, both of the "nothing fails" kind.** (a) `emit_techs.mjs` treated any
`reEra` as a vanilla re-era and tried to patch OUR `regenerative_furnace` into `10_production.txt` — the
match-count assertion threw and stopped the build, which is the guard working. (b) **`emit_techs` patched
only the production file**, so an era move on a MILITARY technology was written into the spec, drawn by
the viewer, and silently dropped on the way to the mod. Three of the 32 are military. A `20_military.txt`
emitter now exists, and it is deliberately unconditional inside its block so an empty list and a broken
pattern cannot look alike.

## 10.54 TECH SPREAD RETURNS TO VANILLA — the journal entries already pay for the depth (user-ruled 2026-08-12)

⭐ **The mod emits no tech-spread change of any kind.** It shipped
`country_production_tech_spread_mult = 0.5` — a modifier vanilla sets on no tree — whose job was to
compensate a laggard for a production tree costing +65% over vanilla's. The ruling: *"Increased number of
industry techs are compensated aplenty by JEs."* The research journal entries of ROADMAP step 2 grant
**half an era's base cost per stage, three stages per technology**, which is the compensation; the spread
boost was a second one for the same depth.

**And it was the worst available place to pay it.** Spread only ever delivers technologies somebody else
already holds, so it cannot create a leader — it can only close the gap the deeper tree exists to open,
which is the mod's central goal. A grant a country earns by *building the industry* is the opposite kind
of lever: it rewards the leader for leading.

⚠ **What was ever actually SHIPPED was only the multiplier.** The 2026-08-10 ruling that raised the base
terms (FLAT 25 → 50, LIT 75 → 100) was superseded by its own consequence before it was emitted — a global
boost hands 69% of the society tree to a laggard against vanilla's 44% — so the flat and literacy terms
have always been vanilla. Do not describe the base spread as "restored"; it was never changed.

⇒ **We no longer own `common/static_modifiers/00_code_static_modifiers.txt`.** One added line in a
900-line file, and the repo's rule is that a file we would otherwise copy verbatim is not emitted: owning
it freezes that file against the next patch and ships bytes we did not author.

⚠ **The KNOBS STAY**, in the tech-tree page's spread panel, all three trees defaulting to 0 and the base
terms to vanilla's 25/75. The panel is the instrument for re-asking the question — the share of a tree
that spread alone hands a laggard by 1936, judged against vanilla's own share — and deleting the
instrument along with the setting would leave nothing to re-measure with. The `production-only +50%`
button is kept as the experiment it now is, not as a setting.

At vanilla spread and 50% literacy the shares now read: production **43%** against vanilla's 47%,
military **34%** against 45%, society **43%** against 44%. Military is the outlier and has no
compensation — its tree is +33% deeper than vanilla's and its journal entries cover the war technologies
on a 26-week bar rather than a 36-month one. Not addressed; flagged.

⚠ **This removal surfaced a build defect worth more than the change itself** — a removed emitter kept
shipping its file, because `build.ps1` cleaned three named directories instead of everything. See
BUGS_AND_FIXES, 2026-08-12.

## 10.55 THE 1836 GRANT IS DERIVED FROM THE 1836 MAP (user-ruled 2026-08-12)

⭐ **The ruling, in three parts.** The only blanket rule is that all civilised countries hold the
pre-industrial baseline; **era 1 is decided case by case**; and three invariants govern whatever is
decided:

1. **Every production method vanilla runs in 1836 stays, and the country running it holds the unlocking
   technology.** (Landmine L14, already enforced.)
2. **Where vanilla mandates a technology one by one, repeat that** — and check the technologies have not
   moved underneath it.
3. **For the top countries, check what they hold in vanilla by any source and grant it one by one.**

**What the grant was.** Every NEW era-1 production technology, named into tiers 3, 4 and 5 — 213
countries — on the reasoning that a country starting with a calico works must be able to build one.
True, and it was a blanket wearing a justification: of those 213 countries, **two** own anything of the
kind. Measured against the emitted 1836 map:

| technology | was granted to | actually owned by |
|---|---|---|
| `steel_toolmaking` | t1, t2 (named) | t1 only — BEL FRA GBR PRU USA |
| `beet_sugar_refining` | t1,t2 (era_1) + t3,t4,t5 | t1, t2 (NET), t3 (MEX, SPA) |
| `calico_printing` | t1,t2 + t3,t4,t5 | t1, t2 (NET) |
| `fourdrinier_machine` | t1,t2 + t3,t4,t5 | **t1 only** |
| `leblanc_process` | t1,t2 + t3,t4,t5 | **t1 only** |

**What it is now: derived, not listed.** `emit_techs.mjs` reads `config/start_baseline.json` — which
country of which starting tier owns which tier building — and grants each tier building's technology to
exactly the starting tiers that own one, minus whatever `add_era_researched` already covers and minus
anything vanilla names itself (read live from vanilla's own file). The emitted diff against vanilla is
**two lines**: `steel_toolmaking` → tier 1, `beet_sugar_refining` → tier 3.
⚠ `extract_start.ps1` therefore had to move BEFORE `emit_techs.mjs` in the build. A baseline written
later makes this build's grant a function of the previous build's map — the same stale-read shape that
bit `econ_host` reading `ui/data.js` and the solvers' own write→read loop.

**The full per-country result** (`verify_start_techs.mjs --diff-vanilla`, all 444 countries, per-country
`add_technology_researched` extras included, era shorthand expanded against each root's own eras):

| countries | tier | gains over vanilla |
|---|---|---|
| 338 | 4–7 | **nothing** |
| 47 | 3 | `beet_sugar_refining` |
| 54 | 2 | `beet_sugar_refining`, `calico_printing`, `crystal_glass`, `fourdrinier_machine`, `leblanc_process` |
| 5 | 1 | those five + `steel_toolmaking` |

**Zero countries lose anything** — rules 1 and 2 hold by construction and are now checked (L15).

⭐⭐ **AND "GAIN" IS THE WRONG WORD FOR THAT TABLE — user, 2026-08-12: *"if the country had it in vanilla,
then it's hardly a gain"*.** Correct, and it was the REPORT that was wrong, not the grant. **The tier
split moved every gate**: a vanilla main production method became its own building with its own
technology, so a permission the country already held had to be RE-ISSUED under a new key. All six:

| our gate | vanilla PM it replaced | vanilla's gate on it | did tier 1/2 hold that in vanilla? |
|---|---|---|---|
| `beet_sugar_refining` | `pm_sweeteners` | `distillation` (era 1) | yes — era_1 blanket |
| `calico_printing` | `pm_dye_workshops` | `lathe` (era 1) | yes — era_1 blanket |
| `crystal_glass` | `pm_leaded_glass` | `lathe` (era 1) | yes — era_1 blanket |
| `fourdrinier_machine` | `pm_sulfite_pulping` | `mechanical_tools` | yes — vanilla NAMES it |
| `steel_toolmaking` | `pm_steel` | `mechanical_tools` | yes — vanilla NAMES it |
| `leblanc_process` | `pm_leblanc_process` | **ungated** | always |

`--diff-vanilla` therefore compares CAPABILITY, not keys: the keys that differ, what a country can newly
BUILD, and which RUNGS are newly gated.

⚠⚠ **GETTING THAT COMPARISON RIGHT NEEDS THE BUILDING'S GATE, NOT JUST THE METHOD'S.** Most of these
vanilla PMs carry no `unlocking_technologies` of their own — the BUILDING is what is gated — so a PM-only
reading says "vanilla let anyone run this" and produced **23 phantom losses across every tier**, including
nonsense like tier 1 losing telephones. The base building key is the LOWEST TIER'S key, *not* the config's
`ind.building` field, which holds a properties object; indexing the vanilla table with that silently
yields undefined, and that is exactly how the phantom 23 appeared. With the building gate in, the real
count is three.

**The true 1836 delta, measured:**
- **CAPABILITY GAINED: one.** Tier 2 can build the era-1 Leblanc explosives works. In vanilla
  `pm_leblanc_process` was ungated but the explosives factory itself needed `intensive_agriculture`,
  which tier 2 lacks; our e1 rung is gated on `leblanc_process`, which tier 2 draws from vanilla's own
  era-1 blanket. A side effect of that blanket, not of the derived grant.
- **TWO RUNGS WERE NEWLY GATED** — buildable at once in vanilla, needing their own technology under ours:
  tier 2 tooling e2 (`mechanical_tools` → `steel_toolmaking`) and tier 4 food e1 (`distillation` →
  `beet_sugar_refining`).
- **Nothing any country actually RUNS in 1836 changes** — that is L14, and it is green.

⚠⚠ **A THIRD ROW WAS REPORTED AND WAS A PHANTOM — `dynamite`.** The check claimed tier 1 lost the era-2
ammonia-soda explosives works. The user asked how dynamite could be available to anyone in 1836; it
cannot. Vanilla gates `pm_ammonia-soda_process` on **`nitroglycerin`**, which no starting tier holds, so
tier 1 could never build that rung in vanilla either. The cause was a **hyphen in the identifier class**:
four vanilla keys contain one, three of them are `vanilla_pm` values of OUR tiers (explosives e2, power
e3, power e5), and an `[a-z_0-9]+` class does not open their blocks at all — so their gate read as empty,
which is the permissive direction. See BUGS_AND_FIXES, 2026-08-12.

⭐⭐ **RULING (user, 2026-08-12): MATCH VANILLA ON "COULD HAVE BUILT", NOT ONLY ON "OWNS ONE" — "even if
it's e2 in our era".** A tier vanilla let a country construct on day one stays constructible on day one.
The derived rule keeps its shape and widens its predicate: a tier building's technology is granted to
every starting tier that either owns one on the map OR satisfied vanilla's own requirement for it
(the BUILDING's gate ∪ the METHOD's gate, against vanilla's own era expansion). The grant is four lines:

```
tier 1  add_technology_researched = steel_toolmaking      (owns 16 of the map's 35 tooling workshops)
tier 2  add_technology_researched = steel_toolmaking      (could build one in vanilla — mechanical_tools)
tier 3  add_technology_researched = beet_sugar_refining   (MEX and SPA own one)
tier 4  add_technology_researched = beet_sugar_refining   (could build one in vanilla — distillation)
```

⇒ **RUNGS NEWLY GATED: 0.** The residual is one capability GAINED — tier 2 can build the era-1 Leblanc
explosives works, through vanilla's own `add_era_researched = era_1`, which cannot be removed without
stripping vanilla technologies.
⚠ Granting an era-2 technology at the 1836 start is not exotic: **all 13 technologies in vanilla's own
tier-1 named grant are era 2.** `add_era_researched = era_1` covers era 1; the named list exists
precisely to hand out era-2 ones.
⚠ Rule 3 asked for the top 30; the check covers all 444, which strictly dominates it. Tier 1 (5) and
tier 2 (54) contain every plausible top-30 country.

⚠ **The residual over-grant is tier 2, and it is deliberate.** Those 54 countries draw the five era-1
technologies from **vanilla's own** `add_era_researched = era_1`, which we cannot remove without
stripping vanilla technologies. `crystal_glass` is on that list because we re-era'd it 2 → 1 in 2026-08-11
(Ravenscroft 1674). All five are genuinely pre-1836 — beet sugar 1815, Leblanc 1820, calico printing and
the Fourdrinier machine 1830, lead crystal 1674 — and tier 2 is "advanced European and American powers",
which had all of them by 1836 whether or not the map places a building. Closing the gap would mean either
dropping vanilla's blanket or dating pre-1836 processes into era 2; both are worse.
⚠ Per-COUNTRY precision is available if it is ever wanted (a `limit` block inside the tier effect) and is
deliberately not done: vanilla's own structure is tier-granular plus per-country extras, and 45 extra
tier-3 countries knowing about beet sugar is not a defect worth new machinery.

## 10.56 ELEVEN TECH MERGES — one advance, several industries (user-ruled 2026-08-12)

⭐ **Where one historical advance reached several industries, one technology now gates all of them.** The
method was an exhaustive pairwise pass: all 188 technologies from era 2 up, **1487 within-era
within-tree pairs**, screened for "is there ONE advance behind both". Rejected on sight: pairs spanning
trees or eras, and **consecutive rungs of one industry** (that collapses the ladder).

| survivor (renamed) | now gates | absorbed |
|---|---|---|
| `steel_railway_cars` **Bulk Steel** | tooling e2 + railway e2 | steel_toolmaking |
| `electric_railway` **Electric Drive** | motor e3 + railway e3 | electric_motors |
| `watertube_boiler` **High-Pressure Steam** | motor e2 (+16 vanilla gates) | compound_engines |
| `aniline` **Coal-Tar Chemistry** | fertilizer e2 + synthetics e2 | ammoniacal_liquor |
| `art_silk` **Cellulose Esters** | synthetics e4 + furniture e4 | nitrocellulose_lacquer |
| `bolt_action_rifles` **Magazine Rifles** | arms e3 + munition e3 | drawn_brass_cartridges |
| `screw_frigate` **The Screw Steamer** | shipyard e1 + shipyard_steam e1 + port e1 | iron_screw_steamers, steamship_bunkering |
| `conveyors` **Continuous-Flow Production** | automotive e4 + food e4 + explosives e4 | continuous_nitration |
| `transfer_machining` **Automatic Machine Control** | automotive e5 + tooling e5 | tracer_control |
| `stamped_receivers` **Mass Small-Arms Production** | arms e5 + munition e5 | automatic_cartridge_lines |
| `percussion_cap` **Percussion Ordnance** | artillery e1 + munition e1 | — (re-point only) |

⚠ **A MERGE DELETES ONLY TECHNOLOGIES WE ADDED.** Twelve were deleted, all ours. A vanilla technology is
named by vanilla script — production methods, journal entries, events, ship modifications, company
formation requirements (`percussion_cap` in 16 places, `watertube_boiler` in 24) — so merging onto one
means re-pointing OUR tier gate and leaving it in the tree with its content. Two merges are re-points
with no deletion at all: artillery e1 onto `percussion_cap` (`shell_gun` stays) and food e4 onto
`conveyors` (`dough_rollers` stays).

⚠ **TWO APPROVED MERGES TURNED OUT NOT TO EXIST**: Rubber Mastication + Vulcanization, and Steam Donkey +
Steam Threshing. Both pairs are vanilla-vanilla AND neither member gates one of our tiers, so a merge
would be an edit to vanilla's tree for zero gain to our ladder. My "pure simplification, both contentless"
reading of them came from the viewer's BUILDING-unlock column and was simply wrong.

⭐⭐ **THE RULE THAT GOVERNS ALL OF THIS (user, 2026-08-12): THERE ARE NO CONTENTLESS VANILLA
TECHNOLOGIES.** None is a placeholder that only slows research; if one looks like that, you are looking in
the wrong place. `tools/audit_tech_content.mjs` is the instrument — modifier block, every production
method / building / combat unit / decree / company gated, and every line of vanilla script naming it.
`watertube_boiler` gates **sixteen** things and looked empty in the viewer.

**RAILWAY PLATEAUS AT e4.** The invented superheating rung and its technology (ours) are deleted; the
vanilla diesel rung moves e5 → e4 gated on `diesel_engine`, re-dated 1934 → **1925** (mainline
diesel-electric, and e4's band is 1912–1932). One technology for the diesel locomotive and the diesel
engine works, which is what they historically were.
⚠ **`compression_ignition` is NOT deleted.** It is vanilla and gates **ten** vanilla production methods —
diesel pumps in five mine types, diesel tractors, diesel trains, mass automobile production — plus a
vanilla event. It simply stops gating a building of ours.

**Result** (single seed, and the ±10 jitter band applies): final-state illogicality 67 (63 excl.
shipyards) against 57 (54) before, per era 4/7/12/11/12/21; net £22.0M/wk against £20.1M; losses £126k
against £138k; macro 18 against 20. Net, losses and macro improved. ⚠ The +9 is inside the documented
noise band and the railway lost a rung, which lands in era 5 — **user ruled the jitter ignorable for
now**; a 3-seed ensemble would settle it.

## 10.57 BUILDING COST — TWO BANDS OFF VANILLA'S OWN COST BOOK (user-ruled 2026-08-13)

⚠⚠ **SUPERSEDED BY §10.61 (user-ruled 2026-08-17): the cost book is now EXACTLY VANILLA, FLAT** — no
band, no era exponent, ports × workforce_mult. The exponential ladder below was rejected as **double
jeopardy**: having to construct the next tier at all is already the modernisation cost, and 1.5^era
priced the same thing twice. This section is kept for the rule's history and the census that produced
it; the named-exception table below is retired with it.

**The rule, in full:**
```
building_cost (points) = VANILLA's required_construction × band × 1.5^(era − 1)
band                   = 2  for the EXPENSIVE set  ·  1  for everything else
EXPENSIVE              = vanilla's own `construction_cost_very_high` (800) class, minus infrastructure,
                         PLUS four named exceptions (below)
```
Derived and written by **`node tools/payback_census.mjs --write`**. The whole cost book is five ladders,
one per (anchor × band) actually in play:

| anchor × band | e0 | e1 | e2 | e3 | e4 | e5 | industries |
|---|---|---|---|---|---|---|---|
| 400 × 1 | 265 | **400** | 600 | 900 | 1350 | 2025 | power, port, art_academy |
| 600 × 1 | 400 | **600** | 900 | 1350 | 2025 | 3040 | food, textile, furniture, glass, paper, shipyard_steam |
| 800 × 1 | 535 | **800** | 1200 | 1800 | 2700 | 4050 | railway |
| 600 × 2 | 800 | **1200** | 1800 | 2700 | 4050 | 6075 | tooling\*, shipyard\*, arms\*, artillery\* |
| 800 × 2 | 1065 | **1600** | 2400 | 3600 | 5400 | 8100 | fertilizer, explosives, steel, motor, automotive, munition, synthetics, electrics |

### ⭐ The four named exceptions (user-ruled 2026-08-13, from the delivered-payback census)

The derived rule reads vanilla's class, and for four industries vanilla's class is wrong **for this
economy** — they paid back in 3.6–6.5 years against the book's own 11.1 centre:

| industry | vanilla | payback before | after | the argument |
|---|---|---|---|---|
| **shipyard** | 600 | **3.6** | 7.2 | and it carries the −30pp naval handicap, so its profit here is *understated* — the true payback is faster still |
| **artillery** | 600 | **4.2** | 8.4 | its own family's other half (munition, explosives) is vanilla-800 and lands at 11.4–11.6 |
| **arms** | 600 | **5.6** | 11.3 | same family, same army-fed customer |
| **tooling** | 600 | **6.5** | 13.0 | an intermediate-goods producer; every other light industry on vanilla's 600 lands 11–17 |

⚠ **`paper` (6.6y) and `motor` (18.0y) were offered in the same ruling and deliberately LEFT ALONE**, as
were the borderline `textile` (7.3y) and `steel` (16.1y) — steel's figure is inflated by its era-1 rung
having no buyer at all (§10.32), which is a defect and not a pricing question.
⚠⚠ **THE WORST-LOOKING NUMBERS ARE NOT BAND PROBLEMS AND MUST NOT BE "FIXED" HERE.** synthetics **210y**,
automotive **55y**, shipyard_steam **484y**, railway **70y**, power **62y**, port **22y**: each has most
of its dominant rungs **at a loss** (the §10.29/§10.35 new-economy undersizes) or is infra priced off an
unpriced `state_infrastructure` output. Doubling or halving a cost cannot fix a building that does not
earn — moving one would only hide the fault.
⚠ **A STALE EXCEPTION IS WORSE THAN NONE**, so `payback_census.mjs` **throws** if an override names an
industry the config no longer has, or if vanilla has come to derive the same band anyway (which would
leave the reason above quietly untrue). Same discipline as `emit_techs.mjs` asserting its match counts.

Effect of the four: dominant-rung **p25 6.6 → ~10**, per-era medians tightened to **11.2–12.3** in every
era including era 0 (which had sat at 6.6), with the capital stock essentially unmoved.

### The three terms, and why each is what it is

⭐⭐ **VANILLA'S COST IS THE ERA-1 RUNG, NOT THE INDUSTRY'S FIRST.** The exponent is `era − 1`: an era-0
rung is vanilla ÷ 1.5, an era-5 rung is vanilla × 1.5⁴. Keying on the ERA and not on the tier's position
is what makes a late-starting industry expensive from its first building — automotive debuts at era 3 and
pays 1.5² over its anchor instead of being handed the era-1 price for being new. Well-defined because no
industry may hold two tiers in one era (`build_era_ladder.mjs` throws), so era ↔ rung is one-to-one.

⭐ **THE EXPENSIVE SET IS DERIVED, NOT LISTED** — it is vanilla's own `very_high` class read live from
`common/buildings`, so a patch that reclassifies a building carries through instead of leaving a stale
literal. The resolved set is printed on every run. **Infrastructure is excluded by hand**: railway is
`very_high` in vanilla, but port and railway sell `state_infrastructure`, which is **not a priced good**,
so nothing about them belongs in a profit-facing band — they take the plain vanilla anchor.

⚠ **NOTHING IN THE RULE TOUCHES PROFIT.** A loss-making tier costs exactly what its era says. Negative or
infinite costs are impossible **by construction** rather than by a guard — the inputs are a vanilla
constant, a band and an era — which was an explicit user requirement.

### Why it replaced the payback-derived rule that was ruled first

The first form of this ruling set `building_cost = c(macrotype, era) × base output value`, with
`c = 10 years × 52 × ρ(macrotype) / £720` and ρ measured per macrotype. It delivered a clean ten-year
median and was **rejected by the user as "still per-building fitting"** — every building got its own
number out of its own output value, which is exactly the property the two-band rule removes. Superseded,
not wrong; the measurements behind it stand and are in F53.

⭐ **TEN YEARS SURVIVES AS THE CHECK, NOT THE CONSTRUCTION.** The vanilla-anchored book *delivers* a
dominant-rung median of **11.5 years with the exceptions applied** (per era 11.5 / 12.3 / 11.9 / 11.4 /
11.2 / 11.6 — before them 6.6 / 11.2 / 11.1 / 11.2 / 10.5 / 11.1) against vanilla's
own 1836 reading of **11.4 modelled / 14.8 measured** (F53). That agreement is the argument for anchoring
on vanilla: adopt the base game's cost book and the base game's payback follows, with no fitting at all.
⚠ The band assignment was chosen on this check. The alternative — banding by MACROTYPE ("industry with
industrial input") — delivers **17.9 years**, well off vanilla, and its membership is an artifact: `dye`
counts as a manufactured good because our synthetics ladder makes it, so *textile* comes out expensive
(1200) while *steel* stays regular (800), which reads backwards. Vanilla's own heavy/light split does not
have that problem.

### The capital-side consequences

| scenario | K/GDP | yrs of construction budget to rebuild K | levels/yr the budget buys |
|---|---|---|---|
| 1780 | 1.72 | 21.5 | 1.2 |
| 1836 | 2.58 | 32.2 | 1.7 |
| 1870 | 3.80 | 38.0 | 4.0 |
| 1900 | 7.75 | 59.6 | 15.8 |
| 1920 | 8.23 | 51.4 | 33.5 |
| 1945 | 9.96 | 55.3 | 46.3 |

Against the shipped-before state (K/GDP 0.32→1.51, rebuild 4.0→8.4 years) this is a **5–7× tightening of
the capital constraint**, which is the "overabundance of capital" finding (§10.52 / F52) answered.
⚠ **K/GDP still reaches 10.0 against a real 3–4, and no cost book can fix that** — `K/GDP = payback ×
profit share of GDP` is an identity, and our tiers' profit share runs **16 → 68 %** across the eras
against a real 25–35 %. The pinned wage share is why. A cost rule can only move the first factor, and it
is already sitting on vanilla's own value.

### £720 per construction point is kept FLAT, as a known bias

⚠ **£720 is the IRON-FRAME method's goods bill per point**, not a constant. The rate is a property of the
construction method alone (both the goods and `country_construction_add` are `workforce_scaled`, so
staffing cancels):

| method | pts/level | **£/point** | gated on |
|---|---|---|---|
| `pm_wooden_buildings` | 2 | **1000** | default |
| `pm_iron_frame_buildings` | 5 | **720** | `urban_planning` (era 1) |
| `pm_steel_frame_buildings` | 10 | **540** | `steel_frame_buildings` (era 3) |
| `pm_arc_welded_buildings` | 15 | **527** | `arc_welding` (era 5) |

⇒ the real era ladder is **1000 / 720 / 720 / 540 / 540 / 527**, so an era-5 building pays back ~27%
FASTER in £ than the book's figures say and an era-0 one ~28% slower. **Accepted and known.** Using the
era rate would leave every macro figure identical (K and the construction budget scale together) and
change only the POINT cost. The reason not to split it is that £720 is the model's single constant
everywhere (`BCM.poundPerPoint`, the UI's Payback column, `solve_building_cost.ps1`), and changing it in
one place only would create two readings of one number.

### What it changed, mechanically

`building_cost` is a pure OUTPUT of the pipeline — **nothing in the solve reads it back** (verified: no
reference in `era_scenarios.mjs` or `era_solver.mjs`; `build_era_ladder.mjs` only nulls it on a freshly
minted tier). So writing it needs no re-solve and cannot disturb the §10.25 fixed point. 105 tiers
written — **39 of them had no `building_cost` at all**, having been minted by the ladder rebuild after
`solve_building_cost.ps1` last ran, and were silently falling back to the UI's own model.
`tools/solve_building_cost.ps1` is now **LEGACY for tiers on this ladder**: its assumed 20% return on
operating cost, against a 56–104% realised margin, is exactly what shipped a ~2-year payback (§10.52).
The vanilla construction data is read by ONE module, `tools/vanilla_construction.mjs`, shared with
`tools/vanilla_payback_census.mjs`.

## 10.58 THE PRODUCTIVITY-DIVERGENCE LEVERS — three vetoes and the vanilla-slope anatomy (user-ruled 2026-08-15)

**Context.** The flatcost-n1 batch (F59) showed the mod's aggregate productivity per productive worker
diverges from vanilla only after ~1910. Diagnosis (F57/F60): (1) DILUTION — tier buildings hold only
20% (1880) → 37% (1935) of productive workers, the untiered rest is vanilla-identical by construction;
(2) shared recipe slope on e0–e3 with the extra rungs opening only ~1900+; (3) vintage drag — vanilla
flips its whole stock free while our stock carries an old tail. Four levers were proposed to move the
divergence earlier; the user ruled:

- ❌ **A — employment declining per tier** ("×0.85–0.9 per era"): REJECTED. Automation PMs already carry
  this; a strongly varied base employment per tier is unwanted complexity.
- ❌ **B — tiering agriculture/extraction**: REJECTED on narrative grounds. Tiers represent capital
  re-construction of a production process; agriculture is not that, and real extraction (deposit yields,
  depletion) fits neither vanilla's logic nor anything feasible in a mod.
- ❌ **C — mandated obsolescence** (tech-triggered throughput maluses on old tiers): REJECTED.
  Obsolescence must be EMERGENT from the simulation, never scripted.
- ⏸ **D — steepening the output slope beyond ×1.5**: "we'll consider that." Open.
- ⏸ **E — accept late divergence as historical**: depends on how significant vanilla's own ladder is —
  answered by F60: vanilla's per-step profit multiplier is ×1.79 at fixed wages / ×1.43 at era-indexed
  wages, against ours ×1.67–1.70 / ×1.50. Vanilla's ladder is REAL and steep; what it lacks is a price
  on the step (no capital gating ⇒ no leader/laggard differentiation), rungs above its PM ceiling, and
  any vintage persistence. The mod's identity is the DISTRIBUTION (who is modern), not the mean slope.

**The report's scope control** (whole economy ⇄ tiered sector, urban centres always excluded from
"tiered" despite the §10.43 streetlights PM) exists because of the dilution finding — the sector view
is where the premise is testable at all. Measured under the 0.65×-anchor flat book: the mod's tier
sector staffs ~2× vanilla's counterpart buildings all century and runs ~0.7× their per-worker output
value until 1900, reaching parity only at 1935 (F60) — cheap buildings over-absorb into low rungs.

## 10.59 THE STEAMER WEDGE AND THE PER-TIER `solve_profit` OVERRIDE (user-ruled 2026-08-16)

**The fault it answers (F66's second half).** `building_shipyard_metal` (shipyard_steam e1,
tech_year 1843) was a −25% loss-maker BY CONSTRUCTION: the shipyard handicap (−30pp on every
shipyard target) put its dominant-recipe target at BAND_LO − 30pp = **−25%**, and the own-era
placement exemption (2026-08-12 ruling: an era-N scenario holds every industry's era-N rung
regardless of tech_year) makes it era-exact dominant at era 1 — so the solve dutifully delivered a
recipe that LOSES 25% at 1836's realised prices (base-price goods margin −6.7% before wages: £4,550
out vs £4,877 in). In the game the handicap's justification (unmodelled naval income) did not
materialise: nobody built steamer supply unsubsidised, while `screw_frigate` — a tier-1-tech
STARTING invention (BEL/FRA/GBR/PRU/USA) — unlocked the steamer-EATING `building_port_steam` from
day 1. Mandated-subsidy runs bought phantom steamers at the +75% ceiling for decades (F66).

**The ruling** (user, 2026-08-16, all three parts): *(1) re-solve, mandating a higher profitability
(lower BE) for Era 1 metal shipyards; (2) make some 1836 shipyards metal even where direct rule
application yields clipper; (3) everyone holding the t1 port tech in 1836 also gets the steamer tech
and all prerequisites, chain-ordered.*

**Part 1 — the `solve_profit` per-tier config field** (`tools/era_scenarios.mjs`):
- A tier carrying `solve_profit` is solved to that margin as a POINT target (±2pp hysteresis),
  **replacing both the band edge and the industry handicap** — for the solve only. Scoring keeps the
  −30pp shipyard stance (the excusal argument is untouched).
- Shipped value: `building_shipyard_metal.solve_profit = 0.05` — the standard workhorse stance.
  The recipe ratchet (§10.50) then binds the chain above it (a later tier may not be less
  input-efficient), so the whole steam chain tightens from the new e1 anchor.
- ⚠ **The field must be carried by `makeTiers`** (`ui/econ.js`) — the first solve ran with it
  silently dropped and changed nothing, the same trap as `input_ratio` and `tech_year` before it
  (§10.25: a config field the model drops is a solver branch that silently never runs).
- ⚠ A `domTierOf` "wedge fallback" was briefly added on the theory that the tier was never
  dominant-solved; that theory was WRONG (the own-era exemption places every rung at its own era, so
  the era-exact match always finds it) and the fallback was removed as dead code. The whole fix is
  the point-target branch in `solveDomRecipe`.

**Part 2 — the 1836 steamer seed — ⚠⚠ REVERTED the same day (user-ruled 2026-08-16 evening).**
As shipped for a few hours: new exception action **`force_industry_tier`** (fields `industry` +
`tier`), because `force_tier` resolves inside the base building's OWN industry and the steam chain
is a separate industry whose base building never appears in vanilla history; five rules, one yard
per `screw_frigate` holder (GBR Home Counties 5 / FRA Brittany 4 / USA Virginia 2 / BEL Flanders 1 /
PRU West Prussia 1 = 13 metal levels against the vanilla start's 105 clipper / 0 steamer). **The
reversion's reason**: the seed existed only to feed the abnormal from-start steam-port construction,
and F66's corrected diagnosis shows that construction is itself the defect (the engine provisions
every overseas state once per port building TYPE — fix the ports, not the symptom). The
`force_industry_tier` MACHINERY stays in the converter, documented and tested; the rules list is
empty. Part 1 (the `solve_profit` recipe stance) is deliberately KEPT — a viable metal shipyard is
right regardless of when demand arrives.

**Part 3 — verified already satisfied, no code.** `screw_frigate` gates BOTH `building_port_steam`
and `building_shipyard_metal` in the shipped tree, so "port-tech holders get the steamer tech" is
true by construction; the requested prerequisite-chain grant has nothing to add. The asymmetry that
produced the famine was purely economic (part 1) and stock (part 2).

⚠ **What this deliberately does NOT do**: it does not touch the port side of F66's runaway — which
turned out to be STRUCTURAL, not subsidy-driven (the engine's per-overseas-state port provisioning
fires once per port building TYPE, so the five-tier split makes every overseas state stack one
level of each new tier; identical with and without the mandate — see F66's corrected mechanism).
That is an open design question; the conditional-subsidy work (F64/F65) and its start-assignment
bypass are a separate open thread.

## 10.60 THE PORT UNIT FACTORISATION (user-ruled 2026-08-16, refined same evening: ×1/50 → ×1/10 → GRADED PER TIER — **IMPLEMENTED same evening, validated by probe; see §10.60.2**)

**The ruling (final form of the evening).** Port tiers are rebuilt at reduced unit size — employment
and ALL effects (recipes, merchant-marine output, state_infrastructure, construction cost) divided
by a PER-TIER factor — so the engine's un-overridable per-overseas-state port provisioning (F66)
places floors that cost little, while hub capacity re-expresses as more, cheaper levels. The
factorisation is **GRADED: hugest denominators on the early tiers (where the from-start waves hit),
progressively smaller for later eras** — a new port tech's unlock is a shock to damp, so the
smallest divisor must stay well above ×1/2 (user constraint).
**The proposed divisor set — 10 / 10 / 10 / 5 / 5 (e0…e4) — falls out of the profession-divisibility
constraint on its own** (every profession ≥10/level, the vanilla floor, per the
EMPLOYMENT_PROPORTIONALITY_LIMIT hazard below):
  e0 700/200/100 ÷10 = 70/20/10 (EXACTLY vanilla's anchorage PM — engine-proven) ·
  e1 600/200/100/100 ÷10 = 60/20/10/10 ·
  e2 500/200/200/100 ÷10 = 50/20/20/10 ·
  e3 400/250/**50**/200/100 ÷5 = 80/50/10/40/20 (the 50 engineers CAP e3 at ÷5 — ÷10 gives 5) ·
  e4 300/300/100/200/100 ÷5 = 60/60/20/40/20.
Late-tier shock check: an e3 wave costs 900/5 = 180 pts per overseas state, landing in a far larger
economy than 1837's — proportionally smaller than the damped e1 wave (400/10 = 40 pts) was.
Steamer-chain alignment at ÷10 (the reason ×1/50 was abandoned): a steam-port level eats 0.63
steamers/wk, so a gifted full-size metal yard is mild ACCEPTED overkill ("it just won't be fully
employed"), not ceremony.
⭐ **Proposed implementation architecture (next session's choice): divide at EMISSION, not in the
model.** The scenario model and the era solve keep FULL-SIZE ports (no re-solve, no ladder
distortion from unequal divisors — the ×1.5 output ladder and the recipe ratchet are per-level and
unit-sensitive); `build.ps1` divides output/inputs/employment/infra/cost by the tier's divisor when
emitting, and `convert_history.ps1` MULTIPLIES 1836 port levels by the divisor to preserve physical
capacity — EXCEPT anchorage-mapped ports, which stay at exactly level 1 by the same ruling (the
deliberately tiny colonial stub). Presets/extract must stay consistent with whichever side of the
seam they read.
⚠ **Interaction to watch in the validation probe**: shipping-lane MM demand is engine-side and
ABSOLUTE, so hub ports must grow ×divisor levels to carry the same lanes — cheap levels, but the AI
must actually build them.

**Why this fix and not another.** The provisioning term ignores building script entirely
(F66 addendum 2: ai_value 50 and −2000 both measured inert), so suppression is impossible; the
trigger is BINARY — it saturates at one level per (state, type), verified to century scale
(port_steam 221/238 still level 1 at 1935) — so any-sized port clears it (the user's reading,
measured true). De-tiering (trade_center precedent) was the alternative; rejected in favour of
keeping the port ladder and its capital story. Historical note in favour of fine granularity: a
real port was a mosaic of berths and basins of different vintages, and the colonial level-1 steam
port has a real referent (the coaling station).

**Implementation scoping (open, next session):** whether e0 shrinks too (presumably yes — "the
port unit"); the touchpoints are the config recipes/employment/state_infrastructure/building_cost
for the five port tiers, the era solve (volumes re-solved at the new scale), the scenario model's
port counts, the macro bounds, and the ×1/50 interaction with `SCALE_LIMIT`-style expectations;
plus a validation probe (the F66 wave should re-appear at ~1/50th the construction cost and the
queue share should collapse). The conditional-subsidy work (F64/F65) likely shrinks ×50 in
magnitude with it — revisit after.

### §10.60.2 THE IMPLEMENTATION AS SHIPPED (2026-08-16 evening — user architecture: EXPLICIT VALUES, NOT A HIDDEN DIVISOR)

**The user overruled the "divide at emission, model stays full-size" proposal mid-implementation**: no
obscure divisor coefficient behind the scenes. What shipped instead:
- **The port tiers' `output_qty`, `inputs` and `building_cost` are EXPLICITLY divided in the config**
  (out 0.9/1.4/2/6/9.2 · cost 27/40/60/180/270 — UI-visible and editable like any recipe), so the config,
  the UI and the era solve all see the true small unit.
- **Two per-tier config fields carry the non-recipe magnitudes: `workforce_mult` and `effect_mult`**
  (0.1/0.1/0.1/0.2/0.2 on the five port tiers), editable on every tier row in the balance UI (under
  ai_value). `build.ps1` applies them at emission — employment × workforce_mult (integer-guarded: throws
  on a fractional head-count), state_infrastructure/pollution/ship_construction × effect_mult. Config
  employment stays full-size (700/200/100…), which is what keeps the §10.60 table's engine-proven
  70/20/10 landing exactly.
- **The model applies them too** (`tierEmp()` in ui/econ.js AND builder.html's fork multiplies base
  employment by workforce_mult; builder.html's non-goods display shows effects × effect_mult), so
  wages/BE/profit are computed on the same small unit the game gets. `emit_research_events.mjs`
  multiplies its per-level employment source by workforce_mult (else a port-descended research bar fills
  ~10× too fast).
- **`convert_history.ps1` multiplies 1836 port levels by round(1/workforce_mult)** — 151 ownership-levels
  lines ×10 — EXCEPT anchorage-mapped entries (`pm_anchorage`), clamped to exactly level 1 (all 90 were
  1-level already; the clamp is patch insurance). Emission: fractional goods amounts are engine-proven
  (vanilla 12_subsistence.txt carries 0.25/0.5); `QtyMul` in build.ps1 emits integers bare (byte-identical
  for unfactored tiers) and fractions to ≤3 decimals.

**Probe validation (session `20260816_202628_ports-graded-probe`, 1836→1852, canonical config, n=1):**
- **The provisioning wave still fires — and became invisible in the queue.** GBR's 12 overseas steam-port
  stubs (same 12 states as the baseline) were all standing by the FIRST 1837 summary — the whole wave cost
  ~480 pts (12×40) and was absorbed in weeks. The baseline spent 1837–41 at 100% port_steam queue share
  for the same 12 buildings at 4,800 pts. GBR's queue is a normal diversified economy from 1837 on; ports
  appear as a 3-item blip (1839) and a 4-item industrial-port burst (1848). NET/SPA/DEN fired their
  delayed waves at screw_frigate research (4/3/6 stubs by 1840) — cheap, as designed; POR and FRA
  completed theirs instantly.
- **Fractional goods PROVEN in-game**: GBR merchant-marine output 226.46/wk at 1837 (0.9/level × ~231
  staffed levels), port profit positive and staffing-proportional. No new error-log classes.
- **1836 conversion verified**: GBR 319 basic-port levels (22 buildings) at 1837, staffed s231 —
  physical capacity preserved; the 4 anchorage entries in the sampled file stayed level 1.
- **GBR GDP vs vanilla (n=1, jagged surface — indicative only)**: graded 1.07→0.63 over 1837–51 against
  the baseline's 1.06→0.60, ahead 3–12pp in the middle years (0.85 vs 0.76 at 1841). The port sink is
  gone from the queue, but GBR's decline persists — its trade economy is the standing suspect (see next).
- ⚠⚠ **STANDING, PRE-EXISTING, NOT A REGRESSION — AND CORRECTED SAME EVENING: GBR/USA ports destaff to
  near-zero by ~1840 in both arms WHILE MM DEMAND IS HUGE AND THE PRICE SITS AT THE +75% CEILING.** The
  first write-up of this read country `goods_out` (production) as demand and concluded "MM demand
  ~5/wk" — WRONG, retracted within the hour when the chain-seed probe's `market_goods_scoped` telemetry
  recorded the actual order book: GBR MM buy 290–384/wk against sell 29–48, price pinned at £87.50
  (175% of base, the ceiling) from ~1839 on; FRA the same shape from 1841. The disease is SUPPLY-side
  and deeply pathological: buildings whose output sits at the price ceiling with 6–10× unmet demand
  shed their workforce anyway (GBR basic ports 319 levels at staffing ~3 from 1841). Candidate
  mechanisms, none yet discriminated: a market-access/local-price wedge (the port may realise a LOCAL
  price far below the market's ceiling), the qualifications/EMPLOYMENT_PROPORTIONALITY jam
  (10 bureaucrats/level gating whole buildings), or wage competition. Per-state
  `state_region_market_access` IS persisted in saves (found, not yet decomposed) and per-building
  realised revenue is in the melted building records — the discriminators exist.
- ⚠ **OPEN VERIFICATION: fractional `state_infrastructure_add` (0.3/0.4/1.2) has NO vanilla precedent**
  (goods decimals do). Weak positive evidence from the 1852 melt (Alaska: infra 10.37 ≈ base 10 + 1
  staffed port × 0.3); a dedicated 10-month probe (`infra-frac-probe`) melts an early save while ports
  are still staffed to read the fractional part directly.

⚠ **THREE REGENERATION TRAPS the explicit-value architecture creates** (each a tool that would silently
un-divide the ports on its next `--write`):
1. **`payback_census.mjs --write`** — ✅ **CLOSED by §10.61 (2026-08-17)**: the flat-vanilla rule
   multiplies by the tier's own `workforce_mult`, so a `--write` now PRODUCES the divided port book
   (40/40/40/80/80) instead of un-dividing it.
2. **`build_era_ladder.mjs --write`** re-mints the two invented port tiers (steam, motor) along the ×1.5
   ladder from anchored neighbours. Because the anchors are themselves divided, the interpolation lands
   ≈right (steam ~1.35 vs 1.4, motor 9 vs 9.2) — approximately safe, but verify after any ladder rebuild.
3. **`era_scenarios.mjs --write`** re-solves recipes at the model's scale — now the small unit,
   consistently (tierEmp applies workforce_mult), so this one is safe by construction; expect port
   COUNTS ~×10 on the next solve, and the committed era_presets are stale on port counts until then.

### §10.60.3 THE PARKING RULING + THE CLIPPER-PORT DECISION LIST (user-ruled 2026-08-16 late evening)

**RULED, standing design: on start, the t1 steam ports and the steam yards MUST be provided.** The §2
chain seed (13 leader-owned anchorage steam stubs + 2 converted metal yards, `_why_chain_seed` in
config/start_exceptions.json) is RATIFIED canonical — no longer probe-stage. The port/steamer work is
then PARKED pending the decisions below; next work item is UI/config consistency (the shipped-arm
visibility rework), and the clipper ports ("in the red too much" — user, looking at the 1840 state)
categorically need resolution.

**The open questions — RULED ON 2026-08-16 late evening (user answers inline):**
- **Q1 — the destaffing "mystery" — ANSWERED BY THE USER, and it is not a mystery: it is the RECIPE
  BOOK.** "Why shouldn't they shed workforce? Ports are tuned to BE under insane +100%+ output prices,
  so they can only break even under the maximum allowed +75% if inputs are very cheap — which doesn't
  happen, because shipyards are also tuned to BE under insanely high prices." A SOLVER problem (the
  maritime chain's targets assume prices the engine's 175% band can never deliver), queued — "we'll
  reach it soon enough". ⚠ The three mechanism candidates the probes suggested (access wedge /
  qualification jam / wage competition) are SUPERSEDED as explanations of the red ports; they may still
  modulate the margins but the first-order cause is the tuning.
  **IMMEDIATE RULING, implemented same night: mandate port subsidies for all MARKET LEADERS unless
  the LIKELY-TO-BE-PROFITABLE ports cover at least HALF of the market's MM demand.**
- **Q2 — RULED: (b), the F64/F65 conditional, "needs doing now" — DONE same night, canonical.**
  `building_subsidies`: the five port tier keys → must_have (the base mandate); `subsidy_conditional`:
  coverage_share 0.5, retire trigger `market_goods_buy_orders <= pmr_mm_high_cov` on mg:merchant_marine
  (the F65-measured idioms), exempt trigger `NOT = { ROOT.market.owner ?= ROOT }`; both retire and
  exempt land on nice_to_have (never `none` — no reliance on replace-vs-merge semantics).
  ⚠ **THE COVERAGE SET IS EXPLICIT, NOT DERIVED — corrected the same night.** The first emission
  derived "t2+" as every rung above sail, steam included; the user corrected it: *"the subsidies stop
  only when the likely-to-be-profitable ports are enough by themselves to cover the MM demand.
  Steamer t1 is not one of them"* — the t1 steam port is tuned loss-making like the sail port. The
  set now ships as config `subsidy_conditional.coverage_tiers` = **industrial / modern / motor**
  (validated against the port tiers at build; profitability is a design judgement the config states,
  not a rule the builder infers). The variant strategies carry loc ($key$ references to the base).
  Railway/power stay nice_to_have — the ruling names ports.
- **Q3 — RULED: with MM prices declining as steam ports improve, t1 (sail) ports should DIE in the t3
  (industrial-port) era.** The intended end-state, to be delivered by the Q1 solver rework's price
  path; the engine's per-state sail stubs remain a known tolerated floor.
- **Q4 — DEFERRED until Q1/Q2 land** (user).
- **Q5 — (c) RULED same night: FRA gets one motor factory.** FRA holds `atmospheric_engine` from the
  tier-1 starting grant (motor t1's own unlocking tech), so the Rhone 1-level paper mill (Lyon; FRA
  keeps 4 paper levels elsewhere) converts to motor t1 — 40 engines/wk capacity against the yard's
  16.6 need, eating 22.8 steel/wk beside Alsace's 65.
  **(a) RULED same night, MEASUREMENT FIRST (user: "check that in already completed runs"):** the
  century run shows the engine provisions steam ports into SUBJECT anchorage states regardless of the
  subject's tech — SIL/BIC/NSW/ABU hold stubs by the FIRST 1837 summary (Sierra Leone cannot have
  researched screw_frigate in a year), and by 1840 every subject in both markets has them; only ORG
  never does (likely annexed). So the subjects ARE seeded: **12 subject-owned anchorages convert to
  overlord-OWNED steam stubs** (rule field `owner` — convert_history rewrites the ownership country;
  vanilla precedent: SIL's African anchorages are GBR-owned in vanilla itself), **NO tech grants**.
  ⭐ **And the L14 gate itself was REFINED rather than excepted (user, same night)**: the
  starting-tech gate binds **domestically-owned** buildings only — a building wholly owned by foreign
  countries rides its owners' technology. verify_start_techs parses each block's ownership and prints
  the skip count (78 foreign-owned 1836 buildings on the current map: our 12 stubs + 66 of vanilla's
  own cross-owned blocks); the short-lived `tech_deviation` per-rule flag is GONE. Tripwire proven
  both ways (a stub flipped to domestic ownership fails naming BIC + screw_frigate).
  DEI excluded — NET's market, leader lacks the tech at start.
  (b) leader basic-port seeding: dropped (the engine does it in weeks).
  **The full seed roster: 25 steam stubs (13 leader-owned + 12 subject-state overlord-owned) +
  2 metal yards + 1 FRA motor factory = 28 rules.**
- **Q6 — RESOLVED (user, plainer form, same night):** the seed provides **ceil(steam-port count / X)
  full-size t1 metal yards, minimum one from the FIRST port**, where X = yard t1 output ÷ per-stub
  steamer demand (today 65 ÷ 0.61 ≈ 107: 1–107 ports → one yard, 108+ → two, and so on). Yards stay
  FULL-SIZE (no factoring — my ÷10 reading was wrong); X is derived from the config's own numbers, so
  a solver re-solve of either recipe changes the ratio automatically. The current seed (one yard each
  for GBR ~20 and FRA ~16 stubs) already satisfies the rule — no change to the rules on disk, only to
  their justification. Encode the formula in the seed generator when the seed is next regenerated.
- **Q7 — DEFERRED (user), with the diagnosis recorded: trade centers die now because MM is too
  expensive** (their input is the ceiling-priced good).

### §10.60.1 The start-assignment fix: OWN `common/history/ai/00_strategy.txt` (user-proposed 2026-08-16, agreed)

The conditional-subsidy fork's one real disruption is that history's 89 curated `set_strategy`
calls ignore `possible` — countries land on the base (mandate) variant regardless of their 1836
state and self-correct only at the first natural re-pick (2–8 years). The fix: extend
`replace_paths` to `common/history/ai` and emit our copy with each forked strategy's assignment
RE-POINTED to the variant whose trigger is true at 1836 — which is mechanically derivable, because
at 1836 no high-tier ports exist (the coverage clause is false everywhere), so market LEADERS get
the mandate variant and non-leaders the exempt variant, and 1836 market membership is exactly what
`extract_presets.ps1` already derives. Vanilla's archetype choices stay untouched.
⚠ **The limit**: the ~150 non-history countries get their strategy from the engine's initial
picker, and whether THAT respects `possible` at tick zero is the still-unrun 5-minute probe (fresh
1836 → first-save melt). If yes, owning the file closes the bypass completely; if no, the rest
keep the 2–8yr lag — pre-assigning them would override vanilla's archetype choice, a real
behaviour change we do not want. ⚠ An owned history file freezes against patches — ON_GAME_UPDATE
entry when implemented. Only relevant if the conditional machinery ships (parked until after
×1/10), but the design is recorded because any future conditional-strategy work needs it.

## 10.61 THE FLAT VANILLA COST BOOK (user-ruled 2026-08-17 — supersedes §10.57)

**The rule, in full:**
```
building_cost (points) = VANILLA's required_construction for the industry's anchor building
                         × the tier's workforce_mult where set (§10.60 graded ports: ×0.1 / ×0.2)
```
**Flat across tiers — no band, no era exponent, no named exceptions.** The whole book is four lines:
400 (power, art_academy) · 40/40/40/80/80 (port, = 400 × its multipliers) · 600 (food, textile,
furniture, glass, tooling, paper, shipyard, shipyard_steam, arms, artillery) · 800 (fertilizer,
explosives, steel, motor, automotive, munition, synthetics, electrics, railway).

**Why the exponential ladder died — DOUBLE JEOPARDY (the user's word).** The tier split's whole point
is that modernising is not a free toggle: reaching the next rung means constructing an entire new
building at full price. That IS the era cost. §10.57's ×1.5^(era−1) charged a second, compounding
premium on top of it — and the ×2 band a third — so the late game was over-priced twice over for the
same design goal. An era's premium is now exactly vanilla's own (none); eras are priced by what their
recipes eat and the research it takes to unlock them.

**Lineage.** The ruling was first made for the parity restart (HANDOVER 2026-08-16 §1b: "×1.0 flat
vanilla anchors (exactly vanilla cost book)") and ran as the `vancost_nosub` arm's config; it never
landed in the canonical config until the user caught the UI still showing the exponential book
(2026-08-17) — the UI was faithfully displaying a config the ruling had missed.

**Implementation.** `tools/payback_census.mjs --rule --write` implements it (the anchor read LIVE from
vanilla's `required_construction`, config `building.required_construction` as the fallback for chains
with no vanilla anchor — and the three clone industries now carry that field explicitly: power/port
`construction_cost_medium`, railway `construction_cost_very_high`). ⭐ **The graded ports ride
`workforce_mult`, which CLOSES §10.60.2's regeneration trap** — a `--write` can no longer un-divide
the port book, because the division is the rule itself. The UI's `buildingCostModel` hint
(builder.html) mirrors the same rule off the config's own anchor classes. Written 2026-08-17:
105 tiers, 96 changed.

**Accepted consequence: payback spreads wider and the check changes meaning.** §10.57 aimed the
dominant-rung median at ~11.5y in every era; the flat book delivers medians of 9.9 / 9.1 / 4.5 /
3.8 / 2.3 / 1.2 across the six eras (capital-weighted era-5 tiers pay back in about a year — they
earn late-era margins against an 1836 price). That is the ruling's intent, not a defect: the ten-year
figure was a §10.57-era check, and re-fitting costs to restore it would reintroduce exactly the
premium the ruling removed. K/GDP now reads 1.4–2.2 across eras (was rising to ~3+ late).

## 10.62 PER-TREE AI RESEARCH WEIGHT — DEFAULT 1, CONFIG-BACKED (user-ruled 2026-08-17)

The hardcoded society ai_weight ×0.8 (ruled 2026-08-11 to damp society against spread rushing it) is
**superseded**: the knob is now `tech_ai_weight_mult` in the config — {production, military, society},
**default 1 for every tree** ("no bonus or malus for all trees, I think the JEs may be boost enough").
At 1 a tree emits NOTHING, so at the defaults the mod stops owning `30_society.txt` entirely — one
fewer frozen vanilla file. A tree set ≠1 gets `multiply` appended last inside every vanilla
technology's ai_weight in that tree's file (preserving vanilla's own conditional weights; a technology
with no ai_weight block gets `value = <mult>` inserted, since the engine default weight is 1), and the
mod's own new technologies in that tree carry the multiplier as their flat weight.
**Surface**: the row lives beside the tech page's spread panel — the one EMITTED row in that panel —
round-tripped to the parent sheet over postMessage because the config write path (Export / Build now)
lives there. Implemented in `emit_techs.mjs` (AIW), sections 2/2b/3 generalized so all three trees
have an emission path (the 2b lesson: a change routed at a tree with no path is silently dropped).


---

## 10.63 THE SOLVENCY BOUND — TARGET BE ≤ 175 (user-ruled 2026-08-17)

**The rule.** A tier's **target BE may not exceed 175**. That is the tier's full, wage-inclusive
break-even — the OUTPUT price, as a % of base, at which its **base production method** covers its input
goods plus wages, **with inputs at base prices** — against the engine's own +75% band edge:

```
target_be = I_base / ((1 − wage_pct) · O_base) · 100  ≤  175
        ⟺  I_base ≤ 1.75 · (1 − wage_pct) · O_base
        ⟺  O:I ≥ 0.762 at the default wage_pct 0.25
```

A tier that fails is insolvent at **every output price the engine can produce**. That is not a balance
opinion, it is arithmetic about a building that can never pay for itself. **Enforced in both the solver
and the linter**, and **shipyards are not an exception** (user, same ruling — it costs nothing today, all
seven of their tiers sitting at ≤128, but the carve-out is gone so a future re-solve cannot hide in it).

### What it is NOT, and why

⚠⚠ **NOT "a recipe may not destroy value at base prices"** — that is `target_be ≤ 100`, and it is
**rejected**. An early tier is *meant* to be insolvent at base prices: its whole design is to be carried
by a high output price and then driven out as later tiers deflate that price. **§10.50.1 stands and sub-1
O:I stays legal** — three tiers (power e3 158, steel e2 139, steel e0 135) destroy value at base prices,
pass this rule, and are correct.

⚠ **The §10.50 RECIPE RATCHET is untouched and stays** (user, same ruling): *output value ÷ input value,
both at base prices, may not decrease with era within an industry.* The two are orthogonal and neither
subsumes the other — the ratchet is **relative** (a tier against the one below), this bound is
**absolute** (a tier against the engine). The ratchet is precisely what a ladder's bottom rung escapes,
which is how `building_port` reached 15.2 clippers for 9 merchant marine.

### ⚠ The superseded first line, kept because the reasoning matters

The rule was first ruled as *both* prices at their favourable edges — output ×1.75 **and** inputs ×0.25 —
which is `target_be ≤ 400`. Measured before it shipped, that caught **0 of 105 tiers**: the worst in the
book, `building_port` at 270, cleared it by ×1.48 with wages included. The user asked exactly the right
question before ruling ("will this really cover anything? ×4 input decrease is a huge boost"), the answer
was no, and the ruling was tightened the same hour. `lint_solvency.mjs --band` still scores the old line.

| test | equivalent to | threshold O:I | fails on the pre-ruling book |
|---|---|---|---|
| output +75%, inputs −75% — superseded | `target_be ≤ 400` | 0.333 | 0 |
| **output +75%, inputs at base — SHIPPED** | **`target_be ≤ 175`** | **0.762** | **3** |
| output at base — rejected | `target_be ≤ 100` | 1.333 | 6 |

**Why the middle line is the right one**: it is the exact formalisation of the ruling's own principle —
*"early tiers are intended to bring profits at a higher output price"* — permitting base-price insolvency
and forbidding only *"no output price in the band saves it"*. The evidence against also letting inputs
collapse: over 100 in-game years across nine markets in `20260817_104849_canon-ports-n2`, clippers never
traded below **85%** of base while merchant marine never exceeded **175%**. The weaker rule's "best case"
is not a state the game produces.

### Why wages are in it

`wage_pct` is the wage fraction of **total** cost, so `W = I_base · wp/(1−wp)` — the same quantity
`lint_profitability.awk` uses, i.e. the repo's standard **full** break-even. Excluding them would slacken
the bound from O:I ≥ 0.762 to ≥ 0.571.

### The three tiers it caught, and the re-solve

| tier | target BE | O:I | max input value allowed |
|---|---|---|---|
| `building_port` (e0) | **270** | 0.49 | £59 against £91 |
| `building_railway` (e1) | **217** | 0.61 | £788 against £978 |
| `building_synthetics_plant` (e2) | **208** | 0.64 | £4200 against £5000 |

⚠ **`building_port` is the one that matters** — it is the F67 defect, the merchant-marine chain's break
point, and the reason this rule exists.

### Where it is enforced

- **Solver** — `Xsolv` in `solveInputsAt()` (`tools/era_scenarios.mjs`), a hard clamp beside the existing
  `Xmin` (the 4:1 lean floor) and `Xmono` (the ratchet). It can never fight `Xmin`: that sits at
  `I = O/ioCap ≤ 0.25·O` and this at `I = 1.3125·O`, a factor of five apart, so the lean floor keeps the
  last word. ⚠ **Re-checked after `minMainInput`**, because the negative-goods floor is applied per good
  and *after* the clamp — a tier with large secondary reductions can be pushed back over the line by a
  different hard invariant. Two hard rules in genuine conflict must **fail loudly** rather than have one
  silently win, so that case records a breach and **`assertSolvency()` throws before the config write**.
  "Fail solving" is literal: the solve refuses to write a config it knows is unsolvable.
- **Build** — `tools/lint_solvency.mjs`, a **separate** check, and both reasons are the story of how F67
  survived for months. (1) **Scope**: `lint_profitability.awk` reads `ladder_tiers.txt`, which `build.ps1`
  writes only for industries with neither `follows_be:false` nor `no_mass_be` — so port, railway and power
  are invisible to it, and two of the three offenders are among them. (2) **Circularity**: that linter
  compares a recipe against `target_be`, which `era_solver` restates *from that same recipe*, so its
  deviation is 0 by construction and its own source comment concedes it "can no longer tell us the balance
  is wrong". ⚠ **Never read `target_be` in this check**; recompute from the goods block against
  `tools/goods_prices.tsv`.

⚠ **`MAX_TARGET_BE = 175` is a GAME CONSTANT and is NOT tunable.** It is the engine's own band edge
(`price = base × [1 + 0.75·clamp(±1)]`), so "no reachable output price saves this building" is a fact
about the engine rather than a balance preference. There is deliberately no `ERA_MAX_BE=200`.

⭐ **But ENFORCEMENT has a measurement switch, `ERA_SOLVENCY=0`** — a distinction worth keeping straight:
the threshold is fixed, whether the bound is *applied* is not. Same shape as `ERA_RECIPE_MONO=0` and
`ERA_PROFIT_BAND=0`, and it exists for the same reason — this repo judges a design change on a measured
A/B, and there is otherwise no baseline to measure against. ⚠ Never ship with it off; it is for
re-measurement only, like `ERA_RAIL_PENALTY`.
⚠⚠ **Why it had to exist, learned by getting it wrong**: the cap lives in the CODE, not the config, so an
attempt to produce a baseline by re-solving the *unchanged* config came back **byte-identical** to the
capped run — both solves applied the cap. That is a fine determinism check and a useless A/B. The knob was
written an hour after the comment asserting it was unnecessary.


## 10.64 THE COMPANY CHAIN EXTENSION (user-ruled 2026-08-23 — ROADMAP step 5, first shipped cut)

**The ruling.** *"Try adding all industry tiers to all companies that have the industry"* — the IDEAL
scenario of the 2026-08-23 survey: companies may own and build **every tier of their chains**, form off
the **lowest existing rung**, and follow the country up the ladder as technology unlocks. The
*investor-tech* foreign-investment edge (a regional HQ owning abroad what its home country has not
unlocked, using the host's pool against the host's tech) is **explicitly ACCEPTED**. Implemented as
`tools/emit_companies.mjs` (see CLAUDE.md), wired into `build.ps1`, which THROWS if it fails.

**Why (F77/F77.1/F79).** Vanilla company types reference a tiered industry only through its first rung —
`building_types`, `extension_building_types`, all 85 prosperity throughput bonuses, all formation
`is_building_type` tests, all `ai_construction_targets`. Under the tier split that pointed all THREE of a
company's economic pulls at the rung the mod wants retired: (1) the country-wide prosperity throughput
bonus, (2) the code-side +10% throughput / +30% construction efficiency on owned share, (3) the ×2–×3
investment-AI construction-score multipliers for company building types. Companies held **9.0%** of our
tiered sector against vanilla's 38.5% (endpoint melts) / **47.4%** (F79's n=18 per-year curve, v7+
definition), and **86% of the gap is pure lock-out** — 65.7% of our tiered sector sat above rung 1 where
no company could reach it. F79 also measured what companies are FOR: vanilla's stock converges to 77–90%
frontier per major, and companies run nearly half its tiered-equivalent sector by 1936. **The ai_value
ladder stays set aside until this works** (ruling 2026-08-23, ROADMAP step 5).

**What the survey established, and the design leans on (evidence classes as marked):**
- **[LOC, engine text]** Formation has two HARDCODED gates beside the scripted `possible`: tech to
  construct **at least one** listed type, and **5 levels of any combination of listed types in one
  state** not already company-owned (`COMPANY_MINIMUM_LEVELS_PER_HQ`). Listing the whole chain therefore
  keeps every company formable from tier 1 AND stops the level pool fragmenting per tier.
- **[FILE, defines]** Companies never spend their own money: they are **selected as owners** of
  investment-pool construction of their listed types (`OWNER_COMPANY_EXPANSION_CHANCE_MULTIPLIER`, ×100
  in the HQ state) and their presence multiplies those types' construction scores. So a company has NO
  tier-selection logic of its own — the tier choice is the construction AI's, which is exactly what the
  profitability ladder and (later) the ai_value ladder steer. Chain-listing flips the company pulls from
  backward (rung-1-only) to neutral; the forward tilt is the ladders' job.
- **[FILE-verified negative]** No bypass of `unlocking_technologies` exists anywhere in defines, AI
  files or effects — a company cannot cause construction of a tier its state's owner has not unlocked.
  Not a measurement; the first company arm should carry the cheap detector (v7+ summaries hold
  `company_levels` per type AND technologies held, so "company-held levels on an unresearched tier" is a
  one-script post-run check).
- **[FILE]** `prosperity_modifier` is **country-scope** (the wiki's "company-owned buildings only" is
  contradicted by the game's own concept text and by the modifiers' contents), so expanding a throughput
  entry to all tiers means "the bonus follows the industry", which is what it meant in vanilla where one
  building WAS the industry. Modifier types are **hand-enumerated, not auto-generated** — hence the
  additive modifier-type file and its loc.
- **Two scenarios REJECTED by the survey:** *high-tiers-only* `building_types` (t3/t4) is not
  "unlockable with lower tiers" — the hardcoded gates test the LISTED types, so such a company cannot
  form until 5 levels of t3+ exist; and *do-nothing* leaves the three rung-1 tilts actively subsidising
  obsolete capacity.

**Shipped shape (2026-08-23 build):** 22 vanilla company files whole-file-owned (all changed), 195
companies touched, +1,584 list tokens, 208 OR-wrapped formation tests, 85 prosperity lines expanded
(exactly F77's census), +656 `ai_construction_targets` entries, 75 new modifier types + loc ×11
languages. `building_shipyard` maps to BOTH config chains (clippers + steamers) — one vanilla industry,
two config industries, and a clippers-only company would die with the extinct ladder.

**Status: PROBE, not yet measured.** Deployed for an in-game eyeball; no scheduled arm has run under it.
The yardstick when one does: F79's vanilla company century (4.0% → 47.4% of the tiered-equivalent sector,
1846→1936, medians of n=18) read against the same per-year v7+ series on the mod arm, plus the rung
distribution of company-held levels (F77.1's melt read 100% rung 1 in both arms; success = the company
rung mix tracking the country's unlocked frontier). Escalation levers deliberately NOT shipped (measure
the restoration first): company slots on our techs (`country_max_companies_add`), the
`COMPANY_MINIMUM_LEVELS_PER_HQ` / `OWNER_COMPANY_EXPANSION_CHANCE_MULTIPLIER` defines.

## 10.65 THE INVERSE SOLVE — mandated prices, derived recipes, seeded counts (user-directed 2026-08-23, EXPERIMENTAL)

**Status: PROTOTYPE UNDER EVALUATION** (`tools/era_inverse.mjs`, artifact `config/era_inverse.json`).
Nothing in the build or the canonical pipeline reads it; the canonical config is untouched. The user's
motivation: growing dissatisfaction with the standing solver's architecture (counts as the lever, prices
realised, targets chased through a jagged fixed point) — so run the problem **backwards** and see whether
a coherent market composition even exists at designed prices.

**The first-pass spec (user's):**
1. every NON-INDUSTRIAL good sits at **base (100%)** in every scenario;
2. every INDUSTRIAL good sits at **175% − 25pp × scenario era** (e0 175 · e1 150 · e2 125 · e3 100 ·
   e4 75 · e5 50). "Industrial" = a good some ladder tier produces, from that first tier's era onward
   (before it, dye is a plantation good at 100 — the one-price-rule-per-good-per-era invariant holds).
3. Recipes are DERIVED from those prices + the ruled profitability targets (dominant +5%, shipyards
   −30pp, per-tier `solve_profit`) + the ×1.5 output ladder, under the standing hard invariants (4:1
   lean cap, §10.63 solvency, §10.50 ratchet, negative-goods floor).
4. Then SEED buildings + workforce so the order book actually PRODUCES the mandated prices — the V3
   formula makes each price a fixed buy:sell ratio (175 ⇒ 2 · 150 ⇒ 5/3 · 125 ⇒ 4/3 · 100 ⇒ 1 ·
   75 ⇒ 3/4 · 50 ⇒ 3/5) — and check for coherence ("no 8 million steel mills").

**Stated first-pass simplifications:** PM selections are Phase A's fit (not re-optimised at mandated
prices); the rung mix within an industry is a placement premise (leading/dominant 1 : one-era-stale
0.25 : two-era rung one level), scaled as a block; fractional counts; the §10.47 macro layer is not
enforced (composition read by eye instead). ⚠ The era-0 mandate (175) sits exactly ON the engine band
edge and would breach §10.15 for industrial inputs — implemented as specified and flagged.

### What it found (numbers from the 2026-08-23 run, canonical config)

1. **Recipes derive in CLOSED FORM — one pass, no iteration, no fixed point.** 88/105 tiers land
   exactly on the dominant +5% target. 10 are solvency-capped (§10.63) — all era-0/1 rungs, where a
   175/150% output price against base-price raw inputs affords a richer recipe than the engine's
   break-even band allows; they earn +10…+24% at their own era instead, inside the §10.49 band. 7 are
   ratchet-capped (the shipyard chains, port, art academy). The §10.50 ratchet is NEARLY AUTOMATIC
   under the mandate: for raw-fed chains output prices fall while input prices stand, forcing each rung
   leaner; for mfg-fed chains both fall together and the wage term provides the monotone improvement.

2. **The ladder's health is COUNT-INDEPENDENT and analytic.** Margins depend only on prices, so
   illogicality is computable without any scenario: **7 faults total (excl. excused) across all six
   eras** — per era 0/0/1/0/0/6 — against the standing solver's 54, and the seeded scenarios agree
   exactly. Obsolescence gradients come out clean: one-era-stale −3…−32%, two-era-stale −16…−51%,
   raw-fed chains steepest, mfg-fed softest (motor −2% one era stale — the wage-share point, now
   visible analytically). **The stale-profitable family (36 faults in the shipped solve) is gone BY
   CONSTRUCTION.**
   - The era-5 six are the **PLATEAU COLLISION**: the flat mandate keeps deflating goods whose ladder
     has ended (food/textile/furniture/port/railway all loss-making at 50%). `INV_PLATEAU=1` (hold a
     plateaued good's price at its last tier's era — §10.30's rule expressed as price) takes the total
     to **4**; the remaining 3 are the mirror image — a plateau-held OUTPUT over still-deflating INPUTS
     revives stale rungs (railway e3 reads +27% at 1945: transportation held at 75 while engines fell
     to 50). Mixed plateau/non-plateau chains cut both ways; any promoted version needs a ruling here.

3. **The BUILDING-FED core is fully seedable.** A damped power iteration (per-good factors blended
   geometrically over each producer's outputs, scale pinned to the population premise every pass)
   converges in 25–270 passes to residual ≤ 0.01. Goods whose demand is buildings/army/construction
   hit the mandate at **11/11 · 17/19 · 23/25 · 25/27 · 26/27 · 25/29** across eras 0–5. Composition
   is coherent: steel peaks at 12.7% of gross output, tooling ~7%, sector mix walks from raw-fed to
   mfg-fed with era (mfg-fed manufacturing 1% → 52%), population lands exactly on the premise, army
   4.5–5.3% of GDP, construction on its ramp. **No absurd counts anywhere.**

4. **⭐⭐ THE CENTRAL NEGATIVE RESULT: POP-FED GOODS CANNOT BE MANDATED — STRUCTURALLY.** The game
   allocates a need's money by SUPPLY SHARE (F31/F40), so a pop-dominated good's buy:sell ratio is
   nearly composition-invariant: build more and demand grows with it, build less and it shrinks. No
   count moves the ratio, so no market composition can realise a designed price. Measured: pop-fed
   goods on mandate **1/21 · 1/20 · 2/20 · 2/19 · 6/21 · 3/20**. ~16–20 goods per era are pop-pinned;
   their implied prices sit where SoL budgets put them (groceries 79–93, luxury goods 25–50, colonial
   goods swinging 49→162 as pop money grows). Two corollaries: (a) **a price mandate can bind only the
   building-fed half of the economy — consumer prices are an OUTCOME of the pop model at any
   composition**; (b) the SCALE of a pop-fed industry is under-determined by the mandate (the prototype
   holds it at the placement seed; the standing solver's price feedback is what normally sets it).
   This also explains the standing solver's stubborn consumer-chain faults from the other side.

5. **Named residual classes, each real economics rather than solver noise:**
   - **Joint production**: logging sells wood + hardwood in PM-fixed proportions — two per-good
     mandates over-determine one producer (wood starved at 128–175 while hardwood gluts at 25–55 in
     every era). A PM re-optimisation under the mandate (not in the first pass) could resolve it by
     mixing wood-only camps.
   - **Scale caps**: at era 5, mandated base-price iron/oil demand overruns the §10.40.6 deposit caps
     (mines/rigs pinned at 1000; implied 129/141 against 100). The flat-100 raw mandate FORBIDS the
     scarcity signal the standing solver's ±30 raw band exists to allow.
   - **Walls**: industrial goods with no reachable producer (unchanged from canon); porcelain is
     trade-supplied everywhere (no producer in scope — expected).

**What it suggests.** The inverse architecture cleanly separates what CAN be designed — the industrial
core's prices, recipes and relative sizes, all obtainable in closed form plus a fast, convergent
feasibility pass with none of the standing solve's machinery (no deadbands, no PM hysteresis, no
jagged response surface) — from what CANNOT: pop-fed consumer prices, which the game's own demand
mechanism decides at any composition. The natural second pass, if pursued: mandate industrial goods
only; let consumer goods take their pop-determined prices (readable analytically); solve consumer-chain
recipes against THOSE prices instead of a fiction; and fold PM choice into the mandate solve. Raw
goods likewise argue for a band (scale caps need a scarcity signal), which is §10.42.4's ruling
arrived at from the opposite direction.

**Knobs:** `INV_ITERS` (default 400) · `INV_DAMP` (0.5) · `INV_PLATEAU=1` (plateau price hold) ·
`INV_TRACE=good[@eraIx]` (per-good iteration trace) · honours `MOD_CONFIG` + the artifact-suffix rule.

### §10.65.1 PASS 2 — THE HYBRID MANDATE (user-directed 2026-08-23 "let's try that", run 2026-08-24)

Pass 1's central negative result acted on: the mandate now binds ONLY building-fed goods; **consumer
goods (pop demand > 70% of buy, classified per era in a short sweep) float to whatever price the pop
model realises**, and an OUTER loop (`INV_OUTER`, default 3) iterates consumer-chain recipes against
those realised prices to a joint fixed point. The user's requested highlight: every consumer price
more than 30pp from base is flagged. Same prototype, same artifact; ~17–21 goods per era classify as
consumer-priced (the staples, durables, luxuries, colonial goods, services, transportation — plus
automobiles/telephones/aeroplanes/fine_art when they arrive).

**1. The mandated core still works — and era 1's miss is a DEMAND-SHIFT, not a failure.** Literal
on-mandate: 9/11 · 0/19 · 22/25 · 25/27 · 29/31 · 25/31. The era-1 zero decomposes: after removing
the MEDIAN log-offset, **17/19 goods sit within tolerance of the mandate SHIFTED by a common ×1.10**
— with the population pinned to the premise, SoL-8 pop demand plus the now-competing consumer
industries exceed what 13M people's workforce can supply at all, so the whole core floats ~13pp above
its mandated prices while holding the relative structure exactly. Every other era's common shift is
×0.98–1.02. (Era 5 keeps the §10.40.6 scale-cap collisions — iron/oil at the 1000-deposit cap — and
the wood/hardwood, telephones/radios joint-production knots.)

**2. ⭐ THE CONSUMER PRICE MAP (the requested highlight).** Beyond ±30pp per era: **15/17 · 7/19 ·
9/18 · 6/19 · 4/15 · 11/18**. The recurring offenders (>30pp in 2+ eras): liquor 25–68 in five eras
(pops never fund it at base against beside-goods), opium 34–67, wine 25–34, luxury_clothes /
luxury_furniture pinned at 25 through eras 0–2 (Phase A's luxury PMs oversupply SoL-8 pops),
telephones 25–39 (the §10.29 communication-need story from the price side), and the big arc:
**clothes 165→175→157→93→68→25 and furniture 175→142→83→64→25** — consumer durables genuinely
SCARCE in eras 0–2 (the premise workforce cannot clothe its own population at base prices) and
collapsing into abundance by eras 4–5. Groceries hold 45→99→91→94→79→49. Era 0 is the degenerate
end (nearly everything at 25 — SoL-7 pops fund almost nothing; its GDP collapses and army/constr
shares with it). ⚠ Instructively, the realised consumer arc 165→25 DECLINES MORE STEEPLY than the
pass-1 mandate (175→50) — the mandate's direction was right for consumer goods; it is the level path
that pops refuse.

**3. ⚠⚠ THE COST — the consumer ladder loses its obsolescence engine: illogicality 22 vs pass 1's 7**
(per era 1/0/1/4/5/11, analytic = seeded). The new faults sit almost exactly in the consumer chains:
stale-profitable textile/furniture (e3–e4), inverted food/textile/furniture/railway (e4–e5), era-5
losses when late consumer prices collapse below the last rungs' break-evens. Mechanism: the pass-1
mandate's scheduled decline WAS the obsolescence driver; realised consumer prices do not decline on
schedule (they meander with SoL and need composition), so stale consumer rungs stay profitable — and
the §10.50 ratchet then anchors every later rung's recipe to the leanness the depressed era-0/1
prices forced, flattening the chains further (textile margins +23…+48%, all ratchet-capped).
electrics is the worst case: telephones (consumer, glutted at 25) and radios (mandated 75–100) from
adjacent tiers of one industry — its e2 rung reads −36% at what pops actually pay.

**4. ⚠ CONSUMER PRICE LEVELS ARE INDETERMINATE IN THE COUPLED SYSTEM.** For a saturated-need good,
(recipe, price, scale) form a CONTINUUM of self-consistent fixed points — a lean recipe at a low
price with big mills is as self-consistent as a rich recipe at a high price with small ones — and
the outer loop lands path-dependently (era-5 clothes at 25 is one such landing). The game pins this
by construction costs and AI thresholds; the standing solver pins it with its price-path priors; a
promoted inverse solver must pick an explicit anchor. The natural pass-3 candidate: keep a DESIGNED
price path for consumer chains as the RECIPE-SOLVING anchor (pass 1's mandate, or a plateau-held
variant), while seeding and SCORING at realised prices with the gap reported — designed deflation as
intent, pop-realism as measurement.

**The trade-off, stated once:** pass 1 = a clean ladder (7 faults) priced partly in fiction
(consumer mandates unreachable); pass 2 = honest consumer prices (the highlight map above) at the
cost of the consumer half of the ladder (22 faults, concentrated there). Both halves are now
measured; which anchor to adopt is a design ruling, not a computation.

**Pass-2 knobs:** `INV_OUTER` (default 3) · `INV_DEBUG=good,good…` (per-pass book-vs-realised trace).

### §10.65.2 PASS 3 — THE DESIGN LADDER WITH POP-LIMITED YIELDS (user-ruled 2026-08-24, CURRENT)

**The ruling that reframed pass 2:** *"I'd like our tiered Industry's output prices to have a downward
ladder, where possible (where it doesn't conflict with pop demand)."* — "industrial" is DEFINED as a
tiered industry's OUTPUT, consumer chains included: clothes, furniture, groceries are industrial goods
whose DESIGN price is 175 − 25pp × era exactly like steel's. Pass 2's demand-side classification
(everything pop-fed floats freely) is SUPERSEDED — it inverted this definition and let the consumer
half of the ladder lose its obsolescence engine wholesale.

**The mechanism:** every good's book starts at its DESIGN (tiered outputs on the ladder; everything
else 100); steering always aims at the book; a POP-DOMINATED good (> 50% of buy) that persistently
refuses its design RE-ANCHORS to what pops support (first anchoring jumps straight to the realised
price — a midpoint feeds the recipe solve transients; subsequent updates damp 0.5), and each anchor
is a NAMED CONFLICT (design → achieved). Thin markets (buy < 8 units — era-0 luxuries flipping
25↔175 on unit-sized moves) never anchor: their price is noise, not a pop statement. The outer loop
(INV_OUTER, default 6) converges 41 → 10.5pp as the anchor set stabilises (~85–93 anchors).

**Results (2026-08-24 run, canonical config):**
- **⭐ The design ladder HOLDS across the late eras and the yields are few and named**: tiered outputs
  holding 175−25·era exactly: 5/8 · 0/13 · 3/18 · **15/21 · 18/21 · 19/21** (e0…e5). Yields at e3:
  clothes 100→93, groceries 100→96, automobiles 100→94, telephones 100→63; at e4: clothes 75→78,
  groceries 75→80, telephones 75→25; at e5 only automobiles 50→73 and telephones 50→25. **At eras
  3–5 pops largely ACCEPT the designed deflation** (glut is achievable), and the pop-priced ⚠ set
  shrinks to 2–7 goods.
- **The early eras carry the real conflicts, in BOTH directions**: e1–e2 durables run ABOVE design —
  clothes 150→175, 125→175; furniture 150→175, 125→153 (pops outbid the ladder; the premise workforce
  cannot clothe the population, scarcity wins) — while glass 150→108, groceries 125→84 and
  transportation 150→69 run BELOW it (pops refuse those levels). Era 1 additionally carries the
  ×1.08 AGGREGATE excess-demand shift (15/18 structurally on the shifted book; nothing on it
  literally), and era 0 stays degenerate (SoL-7 pops fund almost nothing; most consumer goods at 25,
  seven industries absent).
- **Illogicality 15 excl. (14 seeded), per era 0/1/1/1/4/8** — between pass 1's 7 (all-mandate
  fiction) and pass 2's 22 (free float). The remaining faults sit exactly where the ladder yielded
  (railway stale on anchored transportation, electrics inverted on telephones@25) plus the era-5
  plateau block.
- **⭐⭐ THE ERA-5 PLATEAU COLLISION IS BILATERAL — measured, not assumed.** `INV_PLATEAU=1` (design
  holds a plateaued good at its last tier's price, ~75) buys only 15→14: food/textile/furniture's
  permanent tiers need ~70–75% of base to stay viable at era-5 wages, and **the pop model will not
  fund their goods above ~50 at any composition** (in the linear supply-share regime the price is
  scale-invariant, so no scarcity strategy reaches 75 either). The Baumol tension is now a number:
  the plateau industries' viability price and their pop-supported price diverge by ~20–25pp at 1945.
  No price RULE fixes this; it needs a design decision (richer last-tier recipes, higher SoL premise,
  or accepting subsidised staples).
- Standing residuals unchanged in kind: wood/hardwood joint production, era-5 iron/oil at the
  §10.40.6 deposit caps, era-2 clippers knot, porcelain trade-supplied.

**Where this leaves the experiment:** the inverse architecture now expresses the ruled intent
directly — designed deflation as the default, pop demand as the named, measured exception. The
conflict lists (`ladder_yields` in config/era_inverse.json) are the design's honest frontier: each
entry is a good where the mod must either accept the pop price, change the premise (SoL/population),
or change the pop model's inputs (need weights, buy packages). Promotion to canon would need: PM
choice folded into the solve, the §10.47 macro layer, integer counts, and rulings on the plateau
collision and the early-era durables scarcity.

**UI integration (user-directed 2026-08-24):** the balance sheet carries the experiment as a first-class
view — a third red recipe button **`recipes: solver 2`** (the derived book, via `PMDATA.inverse` embedded
by build.ps1 from the artifact's `recipes`) and a second preset row of six scenarios (**Inverse solve ·
designed ladder, pop-limited yields**, via the artifact's `presets` passed through extract_presets.ps1 —
era-preset schema by construction, fractional counts). Verified end-to-end: applying `inv3_1900` and
letting the panel's auto price mode recompute reproduces the solver's book exactly (steel/tools/engines/
iron 100 = the era-3 mandate; clothes 93, groceries 96, telephones 63 = the named yields). Both halves
are build-time copies of config/era_inverse.json — after a `--write`, rebuild. The artifact additionally
carries `va_by_industry` per scenario (the VA composition the UI cannot show; vanilla's measured
counterpart is FINDINGS F80).

### ⭐⭐ THE TUNING DISCIPLINE — what may be tuned in the inverse solver, and what structurally prevents the solver-1 slope (stated 2026-08-24, prompted by the user's ceiling request)

Solver 1's constraint accretion had a MECHANISM, not a moral failing: every rule entered the fixed-point
LOOP as a feedback term, and inside a loop a constraint does not just bind — it REDISTRIBUTES. It moves
prices, which move recipes, which move counts, which surface a new artifact somewhere else, which
motivates the next rule (the documented chain: ceiling → no-buyer → raw bands → shrink → PM freeze →
lift → ratchet → solvency), and the rules then needed precedence rules against EACH OTHER (ceiling
outranks §10.18; undrop-on-breach; §10.51's collisions). On a jagged response surface (±10 faults from
no-ops) every knob purchase had to be validated on 3-seed ensembles — tuning became measurement-bound.

The inverse solver's tunables split into three tiers, and the tier decides the discipline:
1. **DESIGN AXIOMS** — the price book (the ladder formula, the plateau rule), the profit targets, the
   premises (population, SoL, peasant share, army 5%, the construction ramp), the placement rules.
   Tune freely: they ARE the design, each is visible as data in the artifact, and each applies
   uniformly to everything. There is no per-good exception anywhere in this tier.
2. **CLASSIFICATION RULES** — what counts as pop-dominated (>50% of buy), thin (<8 units), industrial
   (a tiered output, from its first tier's era). These decide WHICH axiom applies to a good, so they
   change the answer: treat them as design rulings — few, named, stated in one place.
3. **SEARCH KNOBS** — damping, factor clamps, futility windows, outer passes, the one-appeal rule.
   These move HOW the solve converges, not where: the fixed point is knob-independent EXCEPT where the
   answer is genuinely under-determined (a pop-fed industry's scale), and those spots are FLAGGED as
   under-determined rather than silently knob-set.

**The rule that keeps it from sliding: a new requirement enters as an AXIOM (change the book or a
premise) or as an ACCEPTANCE CRITERION (a verify line that fails the scenario by name) — never as a new
feedback term in the loop.** A failed criterion is remedied by a structural lever (a book change, a
premise change, a new degree of freedom like PM mixing), ruled explicitly — never by a gain. What makes
this enforceable rather than aspirational: prices are AXIOMS here, not state, so there is no controller
for a rule to leak into, and infeasibility cannot be silently traded away — it lands in a named residual
class (pop-limited / joint-production / scale-capped / wall / thin) instead of being absorbed by price
drift as in solver 1.

**The §10.15 industrial-input ceiling, added under that rule (verify-only, same session):** RESTRICTED =
every good any tier recipe, secondary PMG, or combat-unit upkeep can consume (computed from the config
as loaded — recipe goods SETS are invariant under the solve); a restricted good realising ≥174.5 in a
non-thin market fails the era by name, and a BOOK that asks a restricted good for the edge is flagged as
a breach-by-design (era 0's mandate of 175 flags 7 goods — the user's own first-pass spec, §10.65 header
warning now enforced as a criterion). Result on the shipped run: breaches **1 · 1 · 1 · 0 · 1 · 1** —
clippers@e0 (thin-economy shipbuilding), artillery@e1 (unconverged micro-market), clippers@e2 (the
shipyard knot: port demands 282, every producer decayed/froze), wood@e4+e5 (below). No control term was
added; the failures point at their structural levers.

### The WOOD case — the joint-production knot, mechanics now measured (user question, 2026-08-24)

Wood's realised price across the six scenarios: **25 · 105 · 103 · 25 · 175 · 175** against a design of
100 everywhere. Not noise — three named causes, read off the shipped presets:
- **One lever serves two goods in PM-fixed proportions.** Logging camps' era PM (Phase A's selection)
  produces wood:hardwood at **1:0 (e0) · 1:1 (e1–e2) · 3:1 (e3–e5)** while the DEMAND ratio swings from
  20:1 (e3: wood 12.6k vs hardwood 0.6k) to 10:1 (e5). The camp count is steered by the value-weighted
  blend of both goods' errors, so whenever the two disagree the blend nets toward zero, the futility
  guard reads "steering moved producers, ratio did not move", and camps FREEZE at a path-dependent size:
  524 camps at e3 (wood glutted to 25, sell 35k vs buy 12.6k) against 60–124 at e4–e5 (wood starved to
  175, buy 13–20k vs sell 4–8k — paper + furniture recipes tripling demand while the camps stand frozen).
- **e0's 25 is a classification accident worth knowing about**: pop firewood is >50% of the tiny e0 wood
  demand, so wood got pop-anchored and the anchor accepted the glut price.
- **The structural lever, named**: PM MIXING. In the game, different camps in different states run
  different PMs; the model pins one PM per building type per era. Splitting multi-output raw producers
  into per-PM sub-producers (a camp@wood-only population beside a camp@sawmill population, each steered
  by its own outputs) gives the second lever the two mandates need. That is a new degree of freedom —
  tier-1 above — not a tuning knob, and it is the pass-4 item PM-choice-in-the-solve reduced to its
  smallest useful piece.

**RESOLVED (2026-08-24, same day — user: the swings are "quite undesirable"), pending one ruling.**
True per-PM sub-populations cannot be expressed in the shared econ.js model (one selection per building
type), so the shipped fix is the smaller stance `SINGLE_GOOD_REFS = { building_logging_camp:
{ pmg_hardwood: pm_no_hardwood } }` — a LIST, never a condition (the §10.46.1 lesson), same mechanism
class as MANDATED_PMGS. The camp's hardwood PMG is a pure conversion toggle (−40 wood → +20 hardwood);
held at base, the camp becomes a SINGLE-GOOD lever the steering can serve, and hardwood — no domestic
producer left — rides the existing trade-supply channel at exactly its design price.
⚠ **This EXTENDS §10.46's ruling** (hardwood is already the one trade-supplied good, "every other good
domestic") from 1780-where-no-PM-exists to all six inverse scenarios — **flagged for user review**; the
domestic alternative is the pass-4 PM-mixing item.
**Measured result:** wood **25 · 100 · 100 · 100 · 100 · 100** (the swings are gone; e0 stays the
degenerate pop-anchored 1780), hardwood **100 in every era** (imports 3 → 2.7k across the eras, visible
in the presets' trade column), industrial-input ceiling breaches **1·0·0·0·0·0** (only e0 clippers
left — artillery@e1 cleared too), on-book e1 3/35 → **33/35** and e2 18/39 → **37/39** (the knot had
been feeding era 1's excess-demand chase), illogicality 15 → **13** (11 seeded).
⚠ **What the fix REVEALED — the era-3 uniform glut (premise-tier, not a knot):** era 3 now reads 3/43
on-book literally but **40/43 on the book shifted by a common ×0.94** — every price drifted down in
lockstep (pop goods 80–84, the core at 95). The ~6% workforce surplus that previously hid inside 524
frozen glut-camps (a £750k/wk wood glut) is now a clean aggregate statement: at the era-3 premise
(75M, 22% peasants, work ratio 0.30) the economy supplies ~6% more than the book absorbs. The remedy
tier is AXIOMS — a premise nudge (peasant share up ~2pp, or SoL) or accepting the shift — a design
ruling, deliberately not a solver lever.

### §10.65.3 THE VANILLA-ANCHORED LADDER + THE MARGIN AXIOM (user-ruled 2026-08-24, evening — the standing design)

Two rulings the same day, each closing a measured failure:
1. **Margins +40% flat** (`INV_MARGIN`, superseding the inherited +5%): F81 measured the +5% book's
   cost envelopes (143–167% of base early) as a century-long zero-margin economy — world GDP ×0.18 of
   vanilla by 1936, the investment loop never starting.
2. **The price ladder is vanilla-anchored at 1836** (`INV_LADDER`, default **120 · 100 · 84 · 71 ·
   59 · 50** — 1836 = base 100, ×0.84/era, era 5 landing on the original ladder's own 50): the
   in-between +40%@175−25·era book still ran recipes ×2.15/×1.54 vanilla's input share at e0/e1,
   measured as a −10% GDP stock effect at 1837 (canon/aival2 = vanilla exactly at that date) and a
   0.90×→0.58× divergence by 1886 (solver2b-n1). The ladder asserts only the DECLINE; the top was the
   part the live market refused, twice. ⚠ The slope is pinned by the death condition — two eras of
   decline must outrun one margin, 0.84² < 1/1.4 — so the 1836 ANCHOR is the one free dial (a dearer
   anchor buys early-premium narrative at a measured stock-effect cost: 110→−2–3%, 120→−4–5%).
   ⚠ "Shift all profitability graphs upward" via margins alone was considered and REJECTED on the
   same arithmetic: vanilla-parity at a 150 top needs ≈+115%, and no sane ladder loses >53% per two
   eras — obsolescence would die at every rung.

**The derived book (2026-08-24): envelopes be 86/71/60/51/42/36; era-1 at ×1.03 vanilla's measured
input share** — the stock effect closed by construction. Scenario read: eras 1–2 the cleanest of any
book (34/36 · 38/40 on book at ×1.00 shift), **industrial-input ceiling clear in all six eras for the
first time**; the trade is late-era scenario illogicality 32 excl. (9 loss in the known pop-anchor
knots / **22 stale-profitable** / 4 inverted) — the ×0.84+40% deaths are −1…−2% on goods by design,
wage growth the intended finisher, so realisation drift reads many stale rungs marginally positive in
the SNAPSHOTS. The in-game validation arm (solver2c) is the test that matters.

### §10.65.7 DEPEASANTATION AND SoL — the ruled goals (user, 2026-08-25, on the solver2e n=1 read)

Two statements made on solver2e run-1 data, both GOALS that later verdicts must grade against:
1. ⭐⭐ **DEPEASANTATION MUST NOT BE LIKELY** — *"'possible' for tall high-tech majors, but not
   likely"* — and **the solver2e 1935 peasant shares of 10–20% for GBR/NET are "close to the goal I
   was aiming at"** (readings: GBR 10.5%, NET 22.5%, USA 44.6%, RUS 58.8% of workforce, vs vanilla's
   1.0/1.4/31.4/47.0). ⚠ This RE-SIGNS the earlier framing: the mid-century "labor-absorption
   deficit" (productive workers 0.58–0.77× of vanilla) is partly the DESIRED shape, not purely a
   fault — verdicts must separate "peasantry retained" (goal) from "GDP dip" (fault) instead of
   reading one through the other.
2. **SoL must not be suppressed** (the fear was "12 SoL in 1935 GBR"); the measured solver2e read —
   GBR 25.2 / NET 20.8 / USA 14.7 / RUS 10.6 vs vanilla 19.7/17.7/14.9/10.7 — was ruled acceptable
   for now ("Lovely. No need for changes as of now"). ⚠ The MECHANISM is split and measured: the
   tall majors' premium is WAGE-driven labour scarcity (GBR base wage ×2.24 vanilla, NET ×1.75),
   while USA/RUS reach parity through cheap goods at ×0.92–0.93 wages. The user flagged
   scarcity-only SoL growth as non-ideal — watch the wage channel's share, don't let it become the
   only lift.

### §10.65.4 THE SOLVER2C VERDICT — the anchor holds, the back half is REJECTED (user-ruled 2026-08-24, night)

solver2c-n1 (F83) validated the anchor and exposed the back half, and the user ruled on both:
**"no, neither ×1.5 GDP over vanilla nor depeasanting around 1900 is acceptable. This could be
improved by increasing build cost, but a harder problem to tackle is older tier not getting
displaced."**

What that fixes as design state:
1. **The 1836 anchor + the early ladder STAND** — 0.87–0.97× of vanilla through 1890, in-envelope
   from 1841; the front half is not to be re-opened for the back half's sins.
2. **The late-century economy is over-fuelled and the ruling REJECTS it**: GDP ×1.53–1.64 of vanilla
   by 1920–36, tiered workforce 41% vs vanilla's 29.5%, pooled-7 investment pool £2.45B (24× aival2)
   — margins far past what construction can absorb. ⭐ **Build cost is the NAMED first lever** (the
   flat vanilla book of §10.61 prices an e5 plant at an 1836 cost against 3.7y realised paybacks —
   the overshoot engine the ledger's G3 row has flagged since canon). ⚠ Raising it re-opens §10.61's
   "no era exponent / no double jeopardy" ruling — any proposal must go back to the user with that
   tension stated, not around it.
3. ⭐⭐ **THE HARD PROBLEM IS DISPLACEMENT.** F83's mechanism: in the live game input and output
   prices CO-DEFLATE (fabric 55 under clothes 62 at 1930), so an old rung's effective break-even
   falls with its selling price, only the 10–40% wage share separates rungs, and under ×0.84+40%
   **nothing loses money for a century** — the ladder climbs by accumulation. The §10.65.2
   stale-profitable trade, confirmed in-game at full strength. Any fix must attack the RELATIVE
   margin between rungs (or capacity itself), not the price level — the price level is what the
   anchor ruling just settled.

**Two displacement levers RULED OUT the same night:**
- ❌ **A technology-carried obsolescence malus** (negative throughput on the rung two eras below,
  attached to the displacing tech) — **"out of the question. We need emergent obsolescence, not
  pegged."** The user also named the exploit it would mint: concentrate lower-tier industry in your
  SUBJECTS, whose countries lack the tech and hence the malus. Do not re-propose modifier-based rot
  in any form.
- ⚠ **Capital deepening** (per-level employment declining up the ladder) is judged a COMPLEMENT at
  best: it steepens the construction incentive and enlarges the old rungs' wage exposure, but with
  paybacks at 3.7y everything still gets built and no standing stock dies — it cannot create
  displacement while prices sit above every rung's break-even.

**The open direction (proposed, not ruled): the PER-GOOD PRICE SYSTEM — granular ladders with an
enforced death condition.** F84 measured the mechanism's ground truth: vanilla runs INPUT SCARCITY
(fabric rises under flat clothes) while our lean late recipes manufacture the co-deflation
ourselves (raw demand lags, raw prices fall with output prices). The self-consistent design:
per-industry anchors = each output's MEASURED vanilla realized price (the §10.65.3 vanilla-anchor
ruling made granular); raw-input paths taken from measurement rather than asserted flat-100; and
each industry's output slope derived from the death condition against ITS OWN input-mix path —
`r_o² < κ·[(1−w)·r_i² + w·g_w]/(1+m)` — so displacement is emergent from cost structure and free
entry, no pegs. Industries with deflating inputs need steeper slopes (textile at fabric ×0.90/era ⇒
output ×≤0.78/era); flat-input industries keep ×0.84; rising-input industries gentler.
