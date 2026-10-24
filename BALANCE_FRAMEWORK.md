# PM & Tech Rehaul — Balance Framework

This document is the **source of truth** for the mod's balance rulings. Each ruling is a numbered § with the user's words, the reasoning and
the measurements it rests on. It is a record: a ruling is never rewritten, only superseded by a later one. Where a later ruling and an
earlier one disagree, the later one governs. `CLAUDE.md` states the rulings in force as design rules (its §2.13 is a one-line index of
them).

**The archive.** The sections that no longer govern anything (the v0.1 profitability ladder, the six-rung ladder and its solver, the retired
arms and books) were moved verbatim, under their own § numbers, to **`BALANCE_FRAMEWORK_ARCHIVE.md`** on 2026-10-24 (user ruling: "index +
archive"). Each moved block leaves a stub here that lists its headings, so a search for a § number still lands. The archive's text is unchanged
and complete; the old preamble of this file (the v0.1 "layers 1–5" plan) is at its top.

## Status index

**in force** — governs the canon or the method today. **partly** — the § still governs the part named. **superseded** — replaced by the §
named. **record** — history: a measurement, a retired arm, a canonisation. **Here** = this file; **archive** = `BALANCE_FRAMEWORK_ARCHIVE.md`.

| § | subject | status | where |
|---|---|---|---|
| 1–9 | the v0.1–v0.2 profitability ladder: metrics, price band, design targets, vanilla baseline, gap analysis, volume method, the 10-year-payback cost model | record (superseded by §10) | archive |
| 10–10.42 | the five- and six-tier ladders and the scenario solver: constraints, price ceiling, population chain, count controller, debut goods, the 122-run campaign | record. §10.34, §10.36 and §10.37 still describe parts of the balance editor's model (`ui/econ.js`, REPO_GUIDE) | archive |
| 10.43 | the electricity pass | partly: the urban-centre streetlights recipe (10.43.0; why 2 coal: 10.43.2 item 2) and the builder's replacing method-override writer (10.43.2 item 6). Its six-rung power ladder was superseded the same day by §10.44 | here |
| 10.44–10.53 | the date gate, the wedge, macroscenario bounds, hysteresis, constraint sets, the recipe ratchet, the army in the fixed point, the two-year payback, the two calendars | record (the six-rung solver; the tier–tech-era mapping is now §10.78) | archive |
| 10.54 | tech spread stays vanilla's | in force | here |
| 10.55 | the 1836 technology grant is derived from the 1836 map | in force | here |
| 10.56 | eleven tech merges | superseded: the tree is vanilla's (§10.67.4, §10.72) | archive |
| 10.57 | building cost in two bands off vanilla's cost book | superseded by §10.61, then by the cost step (§10.84, §10.101) | archive |
| 10.58 | the productivity-divergence levers | partly: vetoes A (per-tier employment), B (tiered agriculture and extraction) and C (scripted obsolescence) stand; C is CLAUDE.md §1.4's no-penalty rule | here |
| 10.59 | the steamer wedge and the per-tier `solve_profit` override | record (the solver; the field survives for the six-rung book) | archive |
| 10.60 | the port unit factorisation | record (the six-rung book; `effect_mult` and `workforce_mult` survive in the builder and the editor) | archive |
| 10.61 | the flat vanilla cost book | superseded by the cost step C (§10.84, §10.101) | archive |
| 10.62 | per-tree AI research weight, default 1 | in force | here |
| 10.63 | the solvency bound, break-even ≤ 175% | in force | here |
| 10.64 | the company chain extension | in force | here |
| 10.65 | the inverse solve | closed (§10.80) | archive |
| 10.66 | the band budget, the first four-rung proposal, UI 2.0 | record; 10.66.6 (railway handed back to vanilla) still holds | archive |
| 10.67 | the battle-test arm: a cost ladder, less productive entries, a vanilla-pegged tree | record; the pegged tree carried into §10.72; 10.67.5 (readers skip `disabled` industries, L27) still holds | archive |
| 10.68 | the A/B ladder | in force (the values: CLAUDE.md §1.3) | here |
| 10.69 | `canon-4rung`, declared beside the six-rung canon | record | archive |
| 10.70 | the art-academy "hypersonic" stress test | record | archive |
| 10.71 | the vanilla-first four-rung ladder, `canon4v` | superseded by its restatement, §10.72 | archive |
| 10.72 | the four-rung canon is built from vanilla and the spec alone | in force | here |
| 10.73 | `canon4v-art3`: the film academy at ×3 | reverted by §10.74 | archive |
| 10.74 | `canon4v` is the canon; the art academy on the regular ladder; no infinite money printers | in force (the ladder and money-printer rules) | here |
| 10.75 | the ruled set on `canon4v-hai3` | partly: the investment-pool define set stands, at later values (CLAUDE.md §4.1, F158); the 3^tier `ai_value` ladder is superseded by the calibrated desire ladder (§10.92) | here |
| 10.76 | `canon4v-hai3` is the canon; the 60-run plan | record | archive |
| 10.77 | the vanilla-1836 premise relaxed for the input lift | partly: the tier-0 input lift stands; flat cost and linear `ai_value` are superseded (§10.84, §10.92) | here |
| 10.78 | the tier rule | in force | here |
| 10.79 | the hoard; the capital-abundance flag; the under-side rule | partly: the under-side rule stands; the flag is superseded by §10.83 | here |
| 10.80 | the six-rung ladder is closed for good | in force | here |
| 10.81 | a conditional construction weight: expressible, deliberately unused | record of a decision | here |
| 10.82, 10.82.1 | the mid-game dip is expected; the plateau test | partly: the dip ruling stands; the workers ceilings and the plateau test are superseded by §10.83 | here |
| 10.83 | the criteria register (+ .4–.8) | in force, amended by §10.85, §10.86.1, §10.100 | here |
| 10.84 | the canonisation of `canon-c19-in12` and its two defects | record (lineage) | archive |
| 10.85 | the shortlist's GDP and W aims widened | in force | here |
| 10.86 | the world product's hard band; prices planned first; the tier-0 penalty bounded; per-industry levels closed | in force; the per-industry closure relaxed by §10.101 | here |
| 10.87 | report true profits; the wage model; the margin identity | in force | here |
| 10.88 | trade ×1 at B 1.64; the finish boost | in force (B moved with later books) | here |
| 10.89 | hydro dams; the power plant at 4× cost | in force | here |
| 10.90 | the closed price levers; world GDP read as displayed | in force | here |
| 10.91 | craft rungs and merged rungs | in force | here |
| 10.92 | recipes steer production; AI values only follow profit | in force | here |
| 10.93 | secondary and automation methods | in force | here |
| 10.94 | input-price red flags | in force | here |
| 10.95 | research entries for production technologies outside the ladder | in force | here |
| 10.96 | the last tech rework; every decade's world GDP a target | in force | here |
| 10.97 | the research entries reworked; research halved | in force | here |
| 10.98 | research entries beyond production | in force | here |
| 10.99 | the artmerge arm is the canon | record, with a warning (pre-artmerge books lack the performance changes) | here |
| 10.100 | the world-GDP aim 0.90–1.00; the closed-major term | in force | here |
| 10.101 | a per-industry input lift; the routine levers; cost1 | in force | here |
| 10.102 | the world-market monopoly threshold 0.99 | in force (canon since 2026-10-21) | here |
| 10.103 | treaty ports | deferred to mod 1.1 on game 1.15 | here |

---

## §1–§10.42 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 1. Metrics
- 2. The price band
- 3. Design targets — the profitability ladder
- 4. Vanilla baseline (documentation)
- 5. Gap analysis — vanilla vs. the ladder
- 6. Open questions for the next pass
- 7. v0.1 applied — light industry
- 8. Volume methodology & the relaxed (v0.2) ladder
- 9. Building construction cost (10-year-payback model)
- 10. The five-tier ladder — SUPERSEDES §3 and §8 for every tiered industry
- 10.14 The three defects that were actually costing the scenarios (2026-08-04)
- 10.15 THE INDUSTRIAL PRICE CEILING — a hard constraint
- 10.23 `ladder_end`, fixed-count producers, model_only — the declared-but-absent rules, now built (2026-08-04)
- 10.24 The population chain — professions drive buildings (2026-08-04)
- 10.25 Write-cycle convergence — CLOSED, a strict fixed point (2026-08-05)
- 10.27 The config is not reproducible by its own pipeline — port and railway (2026-08-05)
- 10.28 THE COUNT CONTROLLER LIMIT-CYCLED — it needed a deadband, not more passes (2026-08-05)
- 10.29 WHY THE LATE-TIER LOSS-MAKERS LOSE — a debut good is trapped at the price floor (2026-08-05)
- 10.30 "EXTINCT" NOW MEANS THE INDUSTRY ACTUALLY DIES — and the chain dies with it (2026-08-05)
- 10.31 WHY PORT AND RAILWAY RUN BACKWARDS — the old tier floats, the new one is pinned (2026-08-05)
- 10.32 HOW MANY INDUSTRIES HAVE NO MARKET YET — the answer is one, and four fixes were measured (2026-08-05)
- 10.33 PORTS GET A FIVE-TIER LADDER — and it closes the steamers gap (2026-08-05)
- 10.34 THE `max_supply_share` CLAMP — hypothesis RAISED, TESTED and REJECTED (2026-08-05)
- 10.35 A DEBUT GOOD'S CUSTOMER IS A BUILDING, AND WE WITHHELD IT — measured, fix built, NOT yet re-solved (2026-08-05)
- 10.36 ⭐⭐ THE WITHIN-NEED SUBSTITUTION RULE IS SOLVED — and it changes one thing in our model
- 10.37 ⭐⭐ THE `local` GOODS FIX — we model a REPRESENTATIVE state, not the degenerate whole-market one
- 10.38 ⭐⭐ THE LOSS-MAKING REDUCTION, and the guard that was silently a budget
- 10.39 THE PROFIT-TARGET OBJECTIVE WAS GRADING ITSELF AGAINST THE WRONG NUMBER
- 10.40 TWO PINS REMOVED: urban-centre levels and art-academy counts
- 10.41 PROFIT TOTALS ARE REPORTED ONCE, AFTER EVERYTHING — recipes AND counts
- 10.42 ⭐⭐ THE 122-RUN MEASUREMENT CAMPAIGN AND THE RULED SET (2026-08-09)

## 10.43 The electricity pass (2026-08-09) — municipal generation, the lighting mandate, and power's tier-4 start

### ⭐⭐⭐ 10.43.0 THE URBAN-CENTRE ELECTRICITY OVERRIDE IS CANONICAL, ON ITS OWN, REGARDLESS OF EVERY OTHER OPEN EXPERIMENT (user-ruled 2026-09-19)

**The user, after catching it missing mid-batch:** *"Make the notes to canonize the ruling on electricity within Urban Centers,
regardless of whether we adopt any other changes. I expect that the most effects will be to player's convenience (as he wouldn't
have to manually change stuff state by state upon electrifying) rather than actual economy (which will change a bit as well, but I
don't think it will change a lot)."*

⭐ **THE RULING IS FREE-STANDING.** It does not ride on the anchor slide, the in0 sweep, the split lift or anything else under test.
Whatever book becomes the canon next, **it carries this**:

```
pm_goods.pm_electric_streetlights      = { in: { coal: 2 }, out: { services: 10, electricity: 1 } }
pm_employment.pm_electric_streetlights = { engineers: 250 }
```

byte-identical to `config/mod_config.six_rung.json`, which is the parity the user asked for. It lives in
**`tools/lib_tier4_spec.mjs`** (`PM_GOODS_RULED` / `PM_EMPLOYMENT_RULED`) and is emitted by **`make_tier4_config.mjs`** into every
generated book, so a rebuild cannot drop it — a hand-edited config key is exactly how the 2026-09-04 rebuild-from-vanilla lost it
(ROADMAP step 8 **P2**; every four-rung book from `canon4v` to `canon-c19-in12` shipped with vanilla's 3-electricity SINK).

✅⭐ **DONE 2026-09-20 — THE CANON CARRIES IT, AND THE DIFF WAS PROVED.** The canon was regenerated through the vanilla-only
pipeline (`make_tier4_config` → `make_tier4_techs` → `make_ab_config` with the incumbent's own `_ab.command`) and diffed against
the shipped book field by field. The whole diff:

| field | before | after |
|---|---|---|
| `pm_goods` | absent | `{pm_electric_streetlights: 2 coal in, 10 services + 1 electricity out}` |
| `pm_employment` | absent | `{pm_electric_streetlights: 250 engineers}` |
| `_ab.*` (12 flags) | absent | explicit `null` — flags `make_ab_config` has gained since 2026-09-14; they record "not used" |
| `_variant.*` | — | the new book's own name, base, ruling and stamp |

**Not one industry, rung, recipe, `building_cost`, `ai_value`, technology or define moved, and the tech-tree twin came back with
ZERO field diffs.** Built and deployed; every linter, L18, L31, MOD CHECKS and PREFLIGHT pass. The emitted
`mod/common/production_methods/06_urban_center.txt` carries the source recipe and correctly drops vanilla's
`required_input_goods = electricity`, which the override's REPLACEMENT semantics make stale.

⚠ **THE CANONIZED BOOK IS NAMED `canon-c19-in12-elec`**, not `canon-c19-in12`. `config/mod_config.canon-c19-in12.json` is the
RECORD of the arm F131 measured over four seeds, and those seeds ran WITHOUT the override — regenerating it in place (which the
first attempt did, and which is corrected) would have broken the link between a finding and the book it was measured on. A named
book is the record of what it measured; the canon says which book it is.

⚠ **THE SECOND-DIFFERENCE WARNING STILL APPLIES, IN THE OTHER DIRECTION**: the canon's own century runs
(`20260917_132449` / `20260917_161410`) do NOT carry the override, so a new arm read against them still carries it as a second
difference until a century batch is run on `canon-c19-in12-elec`. Nothing has measured the override's economic effect yet.

⭐ **THE USER'S OWN PREDICTION, recorded so it can be checked rather than assumed**: the dominant effect is **player CONVENIENCE** —
with the method generating its own power instead of drawing 3 electricity, electrifying a state no longer depends on arranging
supply for it first, so the player is not switching methods state by state as the grid arrives — and the ECONOMIC effect is real but
**small**. Nothing has measured either half; the anchor probes could not see it (the method is technology-gated and unreachable in
1836–1838), and the first century run carrying it is `20260919_224153_anch-in12-century-n3`.

⚠ **THE POWER-PLANT INDUSTRY IS NOT PART OF THIS AND MUST NOT BE REOPENED** (ruled the same day): the regular power plant stays
vanilla — no tiering, no other change, now or deferred — and the dam megaproject is a polishing-phase item. So a canon carrying this
override has BOTH the municipal source and vanilla's own Early Power Plant, where §10.43's six-rung design had the municipal source
*instead of* it. **That is intended.** ⚠ Owning `common/production_methods/06_urban_center.txt` (and, since `canon4v`,
`common/buildings/06_urban_center.txt` for the art academy) means owning `pm_early_power_plant` and `building_power_plant` with it;
they are in the same files and whole-file replacement cannot spare them. Both are byte-identical to vanilla in our copies, so the
cost is patch drift only, recorded in `ON_GAME_UPDATE.md`. The user considered and **rejected** the alternative of an additive
`zzz_` single-PM override: *"we just aim to not own things unnecessarily. It being in the same file is reason enough."*

**The user's brief (superseding the §10.42.5 queue entry in three ways):** (1) urban-centre lighting
methods are MANDATED at the most advanced method the tier allows — a prerequisite of being a city, never a solver
choice; (2) the electric-streetlights method also consumes **one coal**, with the remaining effectiveness
change covered by shifting laborers into engineers; (3) investigate what can be done narratively to get
rid of an input-less tier-3 power industry ("hydro") — were coal plants at 1870/1900/1920 different enough
to justify 2–3 standalone types, and does tier-3 electricity need to exist at all? The brief explicitly
accepts that the outcome bends "urban centres are the only pre-existing non-manufacturing building whose
PMs we touch" — this is one large change to redo electricity.

### 10.43.1 The investigation — what the record supports

- **1870 (tier 2): no central power stations existed anywhere.** The first were Pearl Street and Holborn
  Viaduct, both 1882; 1870s electricity is telegraph batteries and arc-light experiments (Gramme dynamo
  1871). A tier-2 electricity industry would be an invention, not a correction. (The shipped model
  already agreed — power began at tier 3 — and stays agreed: power now appears at tier 2 in NO form.)
- **1900 (tier 3): the plant generation of 1900 was the municipal engine-house.** Reciprocating steam
  engines driving dynamos, ~0.1–5 MW, typically owned by the city or the tram company, sited inside the
  city it lit; the load was street lighting and trams. The steam turbine existed (Parsons 1884) and the
  FIRST turbine station (Elberfeld, 1900) is exactly the leading edge at that date. Plant efficiency ~4%.
  Niagara (1895) proved large hydro at the same moment — as a one-off heroic site, not a standard plant.
- **1920–25 (tier 4): the central station proper.** Steam turbines at 20–60+ MW per unit, pulverized-coal
  firing, regional interconnection (Britain's 1926 Grid Act), and electricity becoming an INDUSTRIAL
  input — motor drive overtaking line shafts. This is a different building from the 1900 engine-house in
  machinery, scale and siting; you rebuild, you do not upgrade. Efficiency ~15%.
- **1940 (tier 5): the modernised station** — high-pressure/reheat steam, 100+ MW units, national grids —
  an evolution of the tier-4 plant rather than a third coal generation. (Vanilla represents this rung as
  the oil-fired plant; oil was historically niche until postwar, but it prices the rung's fuel
  differentiation and is kept.)

**Verdicts.** Coal plants justify **two** standalone rungs (tier 4 turbine hall, tier 5 modernised), not
three — the "third" (1900) was municipal-scale and city-embedded, which is precisely what the rehauled
urban-centre lighting method models. **Tier-3 electricity exists as a GOOD but not as a standalone
dominant industry**: supply at 1900 is the urban centres' own generation plus whatever leading-rung
turbine stations the market wants. **Hydro never becomes a market industry**: small-scale (mill-race /
municipal) hydro folds into the urban-centre generation narrative alongside municipal coal — the 1-coal
input keeps the fuel economics honest without claiming the whole method is hydro — and large-scale hydro
(Niagara 1895, Hoover 1936, Dnieprostroi) is a site-specific unique megaproject in the same class as the
canals, which the scenario model already excludes. No input-less producer exists anywhere in the ladder.
A future in-game unique building for the great dams stays open as mod content; it is not scenario model.

### 10.43.2 What shipped

1. **The lighting mandate** — `MANDATED_PMGS` in `tools/era_pm.mjs`: `pmg_street_lighting` resolves to
   exactly one candidate per tier — none @0, gas @1–2, electric @3+ — so the optimiser cannot trade it and
   the PM limit cycle loses a participant. Gas's tier-1 threshold is hand-assigned (vanilla leaves the PM
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
   | coal | tier 3 (w .0885) | tier 4 (.1071) | tier 5 (.1297) |
   |---|---|---|---|
   | 1 | +£54.6 | +£47.1 | +£38.1 |
   | **2 (ruled)** | **+£24.6** | **+£17.1** | **+£8.1** |
   | 3 | −£5.4 | −£12.9 | −£21.9 |
   **2 coal does not close the gap completely** — but it is the right side to stop on: the residual is a
   modest UC gain (~2pp of a level's output) that DECAYS toward zero as wages rise, while 3 coal would
   make the MANDATED method a strict loss-maker at every tier, worsening over time — a mandate must not
   force a money-loser. Raising the engineer count above 250 remains the lever if exact tier-3 neutrality
   is ever wanted.
3. **Power = [coal @4, oil @5]** in `build_era_ladder.mjs`'s spec and the config; the tier-3 "Early Power
   Plant" tier is deleted. The coal tier inherits the **vanilla key `building_power_plant`** (5 vanilla
   script files reference it — the key must survive) with tech swapped to `steam_turbine`; nothing in
   vanilla script references `pm_early_power_plant`, so nothing is orphaned. 1836 history contains no
   power plants, so the start conversion is untouched.
4. **Power is DEBUT-EXEMPT** (`ERA_DEBUT_EXEMPT` default gains `power`, permanently and on principle —
   unlike the trio pending tier-1 rungs): its debut rung is EMBEDDED in urban centres, so the industry
   exists at tier 3 even though its standalone ladder starts at tier 4, and the tier-3 scenario may place
   coal plants as its LEADING rung (+20% target) — the first turbine stations, which is historically the
   right reading of 1900. At tier ≤2 availability alone excludes power (earliest rung tier 4 > LEAD_TIER),
   so the exemption is inert there.
5. **The chain rule now gates reference-building METHODS by tier** (`refProducible` in era_scenarios.mjs).
   The walk used to accept any PM of any reachable building; once streetlights PRODUCE electricity, that
   would have called electricity "producible at 1780" (the urban centre is a tier-0 building listing a
   tier-3 method) and un-withheld every electricity-eating rung three tiers early. With the gate,
   electricity is ref-producible exactly from tier 3 — which is also what closes prerequisite (b) from
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
turbine station AT tier 3 (its honest date), a new pulverized-coal tier-4 rung, and no exemption, because
the date gate needs none. Everything else in §10.43 (the lighting mandate, the municipal-generation
method at 2 coal, the hydro narrative, `pm_employment`, the writer semantics) stands unchanged.

## §10.44–§10.53 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.44 The date gate (2026-08-09) — a tier stands where its technology existed, and the leading rung dies
- 10.45 The wedge, measured (2026-08-09) — per-profession tier multipliers replace the frozen 1836 vector
- 10.46 Post-gate rulings (user, 2026-08-09): imports where no producer can exist, the ceiling-futility bug, the dye pin
- 10.47 The macroscenario — explicit reasonability constraints (user, 2026-08-09)
- 10.47.2 The bounds are DERIVED from the real US, on the mapped commodity economy (user-ruled 2026-08-09)
- 10.47.4 The subsidy tolerance — infra may run at a book loss, because vanilla says so (user-ruled 2026-08-09)
- 10.47.5 Closing rulings (user, 2026-08-09) — freight stays as-is, onset losses are tolerable, and the verification that let them stand
- 10.48 The hysteresis session (2026-08-10) — PM choice SETTLES, and two ceiling-precedence bugs it flushed out
- 10.49 The constraint-set experiment (2026-08-10) — bands for targets, a mandated price decline, and the increase mechanism: MEASURED, NOT SHIPPED
- 10.50 The recipe ratchet (2026-08-10) — a later tier may not be less input-efficient, and the inverted family collapses
- 10.51 The army joins the fixed point (2026-08-10, user-ruled) — the cobweb, the damped joint solve, and the undrop rule it forced
- 10.52 THE PAYBACK IS TWO YEARS, NOT TEN — the capital side, measured for the first time (2026-08-12)
- 10.53 TWO CALENDARS — 41 tiers were gated a tech era too high (user-ruled 2026-08-12)

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
pre-industrial baseline; **tech era 1 is decided case by case**; and three invariants govern whatever is
decided:

1. **Every production method vanilla runs in 1836 stays, and the country running it holds the unlocking
   technology.** (Landmine L14, already enforced.)
2. **Where vanilla mandates a technology one by one, repeat that** — and check the technologies have not
   moved underneath it.
3. **For the top countries, check what they hold in vanilla by any source and grant it one by one.**

**What the grant was.** Every NEW tech-era-1 production technology, named into starting-tech tiers 3, 4 and 5 — 213
countries — on the reasoning that a country starting with a calico works must be able to build one.
True, and it was a blanket wearing a justification: of those 213 countries, **two** own anything of the
kind. Measured against the emitted 1836 map:

| technology | was granted to (starting-tech tiers) | actually owned by (starting-tech tiers) |
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
**two lines**: `steel_toolmaking` → starting-tech tier 1, `beet_sugar_refining` → starting-tech tier 3.
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

| our gate | vanilla PM it replaced | vanilla's gate on it | did starting-tech tier 1/2 hold that in vanilla? |
|---|---|---|---|
| `beet_sugar_refining` | `pm_sweeteners` | `distillation` (tech era 1) | yes — era_1 blanket |
| `calico_printing` | `pm_dye_workshops` | `lathe` (tech era 1) | yes — era_1 blanket |
| `crystal_glass` | `pm_leaded_glass` | `lathe` (tech era 1) | yes — era_1 blanket |
| `fourdrinier_machine` | `pm_sulfite_pulping` | `mechanical_tools` | yes — vanilla NAMES it |
| `steel_toolmaking` | `pm_steel` | `mechanical_tools` | yes — vanilla NAMES it |
| `leblanc_process` | `pm_leblanc_process` | **ungated** | always |

`--diff-vanilla` therefore compares CAPABILITY, not keys: the keys that differ, what a country can newly
BUILD, and which RUNGS are newly gated.

⚠⚠ **GETTING THAT COMPARISON RIGHT NEEDS THE BUILDING'S GATE, NOT JUST THE METHOD'S.** Most of these
vanilla PMs carry no `unlocking_technologies` of their own — the BUILDING is what is gated — so a PM-only
reading says "vanilla let anyone run this" and produced **23 phantom losses across every tier**, including
nonsense like starting-tech tier 1 losing telephones. The base building key is the LOWEST TIER'S key, *not* the config's
`ind.building` field, which holds a properties object; indexing the vanilla table with that silently
yields undefined, and that is exactly how the phantom 23 appeared. With the building gate in, the real
count is three.

**The true 1836 delta, measured:**
- **CAPABILITY GAINED: one.** Starting-tech tier 2 can build the tier-1 Leblanc explosives works. In vanilla
  `pm_leblanc_process` was ungated but the explosives factory itself needed `intensive_agriculture`,
  which starting-tech tier 2 lacks; our t1 rung is gated on `leblanc_process`, which starting-tech tier 2 draws from vanilla's own
  tech-era-1 blanket. A side effect of that blanket, not of the derived grant.
- **TWO RUNGS WERE NEWLY GATED** — buildable at once in vanilla, needing their own technology under ours:
  starting-tech tier 2 tooling t2 (`mechanical_tools` → `steel_toolmaking`) and starting-tech tier 4 food t1 (`distillation` →
  `beet_sugar_refining`).
- **Nothing any country actually RUNS in 1836 changes** — that is L14, and it is green.

⚠⚠ **A THIRD ROW WAS REPORTED AND WAS A PHANTOM — `dynamite`.** The check claimed starting-tech tier 1 lost the tier-2
ammonia-soda explosives works. The user asked how dynamite could be available to anyone in 1836; it
cannot. Vanilla gates `pm_ammonia-soda_process` on **`nitroglycerin`**, which no starting tier holds, so
starting-tech tier 1 could never build that rung in vanilla either. The cause was a **hyphen in the identifier class**:
four vanilla keys contain one, three of them are `vanilla_pm` values of OUR tiers (explosives t2, power
t3, power t5), and an `[a-z_0-9]+` class does not open their blocks at all — so their gate read as empty,
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

⇒ **RUNGS NEWLY GATED: 0.** The residual is one capability GAINED — starting-tech tier 2 can build the tier-1 Leblanc
explosives works, through vanilla's own `add_era_researched = era_1`, which cannot be removed without
stripping vanilla technologies.
⚠ Granting a tech-era-2 technology at the 1836 start is not exotic: **all 13 technologies in vanilla's own
starting-tech tier-1 named grant are tech era 2.** `add_era_researched = era_1` covers tech era 1; the named list exists
precisely to hand out tech-era-2 ones.
⚠ Rule 3 asked for the top 30; the check covers all 444, which strictly dominates it. Starting-tech tier 1 (5) and
starting-tech tier 2 (54) contain every plausible top-30 country.

⚠ **The residual over-grant is starting-tech tier 2, and it is deliberate.** Those 54 countries draw the five tech-era-1
technologies from **vanilla's own** `add_era_researched = era_1`, which we cannot remove without
stripping vanilla technologies. `crystal_glass` is on that list because we re-era'd it 2 → 1 in 2026-08-11
(Ravenscroft 1674). All five are genuinely pre-1836 — beet sugar 1815, Leblanc 1820, calico printing and
the Fourdrinier machine 1830, lead crystal 1674 — and starting-tech tier 2 is "advanced European and American powers",
which had all of them by 1836 whether or not the map places a building. Closing the gap would mean either
dropping vanilla's blanket or dating pre-1836 processes into tech era 2; both are worse.
⚠ Per-COUNTRY precision is available if it is ever wanted (a `limit` block inside the tier effect) and is
deliberately not done: vanilla's own structure is tier-granular plus per-country extras, and 45 extra
starting-tech tier-3 countries knowing about beet sugar is not a defect worth new machinery.

## §10.56–§10.57 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.56 ELEVEN TECH MERGES — one advance, several industries (user-ruled 2026-08-12)
- 10.57 BUILDING COST — TWO BANDS OFF VANILLA'S OWN COST BOOK (user-ruled 2026-08-13)

## 10.58 THE PRODUCTIVITY-DIVERGENCE LEVERS — three vetoes and the vanilla-slope anatomy (user-ruled 2026-08-15)

**Context.** The flatcost-n1 batch (F59) showed the mod's aggregate productivity per productive worker
diverges from vanilla only after ~1910. Diagnosis (F57/F60): (1) DILUTION — tier buildings hold only
20% (1880) → 37% (1935) of productive workers, the untiered rest is vanilla-identical by construction;
(2) shared recipe slope on t0–t3 with the extra rungs opening only ~1900+; (3) vintage drag — vanilla
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
  answered by F60: vanilla's per-step profit multiplier is ×1.79 at fixed wages / ×1.43 at tier-indexed
  wages, against ours ×1.67–1.70 / ×1.50. Vanilla's ladder is REAL and steep; what it lacks is a price
  on the step (no capital gating ⇒ no leader/laggard differentiation), rungs above its PM ceiling, and
  any vintage persistence. The mod's identity is the DISTRIBUTION (who is modern), not the mean slope.

**The report's scope control** (whole economy ⇄ tiered sector, urban centres always excluded from
"tiered" despite the §10.43 streetlights PM) exists because of the dilution finding — the sector view
is where the premise is testable at all. Measured under the 0.65×-anchor flat book: the mod's tier
sector staffs ~2× vanilla's counterpart buildings all century and runs ~0.7× their per-worker output
value until 1900, reaching parity only at 1935 (F60) — cheap buildings over-absorb into low rungs.

## §10.59–§10.61 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.59 THE STEAMER WEDGE AND THE PER-TIER `solve_profit` OVERRIDE (user-ruled 2026-08-16)
- 10.60 THE PORT UNIT FACTORISATION (user-ruled 2026-08-16, refined same evening: ×1/50 → ×1/10 → GRADED PER TIER — **IMPLEMENTED same evening, validated by probe; see §10.60.2**)
- 10.61 THE FLAT VANILLA COST BOOK (user-ruled 2026-08-17 — supersedes §10.57)

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
O:I stays legal** — three tiers (power t3 158, steel t2 139, steel t0 135) destroy value at base prices,
pass this rule, and are correct.

⚠ **The §10.50 RECIPE RATCHET is untouched and stays** (user, same ruling): *output value ÷ input value,
both at base prices, may not decrease with tier within an industry.* The two are orthogonal and neither
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
| `building_port` (t0) | **270** | 0.49 | £59 against £91 |
| `building_railway` (t1) | **217** | 0.61 | £788 against £978 |
| `building_synthetics_plant` (t2) | **208** | 0.64 | £4200 against £5000 |

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
`tools/emit_companies.mjs` (see REPO_GUIDE.md §3), wired into `build.ps1`, which THROWS if it fails.

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
  keeps every company formable from the first rung AND stops the level pool fragmenting per tier.
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

## §10.65–§10.67 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.65 THE INVERSE SOLVE — mandated prices, derived recipes, seeded counts (user-directed 2026-08-23, EXPERIMENTAL)
- 10.66 THE BAND BUDGET AND THE FOUR-RUNG LADDER (analysis 2026-08-29; the ladder is a PROPOSAL, not a ruling)
- 10.67 THE BATTLE-TEST ARM — less productive JEs, a cost ladder, a vanilla-pegged tree (user-ruled 2026-08-29)

## 10.68 THE A/B LADDER — vanilla-anchored rungs, capacity-priced construction (user-ruled 2026-09-02, TWO ARMS UNDER TEST)

**The ruling.** After the four-rung arms of 2026-08-29→09-01 (F93–F96) and the diagnosis in F97, the user ruled
the final round before a revert to the six-rung canon: *"output = vanilla_lowest_tier_output × A^era, input =
vanilla_lowest_tier_input × B^era"*, tier counted from the industry's own first rung, two arms prepared and both
tested at n=3 — (1) A = B, (2) A > B; chosen 2026-09-02: ab1 = 2.5/2.5, ab2 = 2.0/1.5. Scripted removal of dead levels (H3), engine wage dials (H5) and
distinct goods per rung (H6) were REJECTED; vanilla recipes for vanilla rungs (H2) is what the formula does;
the cost-divisor define is adjusted, its value derived from the cost book actually used.

**The rule, as built (`tools/make_ab_config.mjs`, from the tier4 STRUCTURE — rungs, tiers, techs, keys, employment):**
- k = rung tier − the industry's first rung's tier (automotive t2 → k=0, t3 → k=1).
- `output_qty(k)` = vanilla lowest-tier output × A^k.
- input VALUE(k) = vanilla lowest-tier input value × B^k, spread over the rung's OWN vanilla method's input mix
  (an invented rung takes the nearest lower vanilla rung's mix). ⚠ INTERPRETATION, flagged to the user: the value
  ladder is B^k, the goods are the rung's vanilla method's — so a t2 steel mill still eats electricity and a t2
  glassworks oil and lead. CONFIRMED by the user 2026-09-02 as the intended reading ("keep vanilla changing input mix and add
  VALUE ladder to it"); reading it as "the lowest tier's goods only" would have deleted the new-economy chains'
  demand.
- `building_cost(k)` = vanilla construction anchor (the industry's `required_construction` class: 600/800/400)
  × A^k — **capacity-priced**: a construction point buys the same OUTPUT at every rung. Under the engine's margin
  band (profit held at 15–25% of REVENUE by wage moves) profit ∝ revenue ∝ output, so payback is flat across
  rungs and the growth loop is vanilla's per unit of capital. This is the GDP guard: F97 §3 showed GDP tracks
  physical output, so output per construction point is what has to match vanilla.
- `ai_value` = 1000 × A^**tier** (tier-keyed, the 2026-08-29 rule; cost is delta-keyed, so a late-starting industry
  gets more desire per point than a same-tier rung of an 1836 industry — left as ruled).
- `target_be` restated from the recipe (the lint_profitability drift guard).
- `ai_defines.PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING` = 0.001 × 800 / max
  cost in the book, so the dearest rung carries the ÷1.8 vanilla gives its dearest production building. The
  vanilla 0.001 divided the 1.92-ladder arm's rungs by 3.2–5.3 and starved its pool (F97 §3). The other six
  `ai_defines` and the 160/240 thresholds are carried unchanged.
- Rung 0 = vanilla's recipe, cost and employment ⇒ **1836 is vanilla by construction.** Secondary methods are
  rescaled at build time by `emit_secondaries.mjs` against whatever main recipe the config carries.
- **Company formation targets gated to the best unlocked rung** (`emit_companies.mjs`, BUGS_AND_FIXES 2026-09-02):
  every duplicated `ai_construction_targets` entry below the top rung carries
  `owner = { NOT = { has_technology_researched = <next rung's tech> } }` in its `state_trigger`. Formation,
  regional HQs, prosperity and the established-company multipliers run on `building_types`/`possible`, untouched.
  User-approved 2026-09-02 ("Go with your solution") — and **SWITCHED OFF the same day** after its one run
  (`20260902_095339` run001, ab1 n=1): shortlist companies 17 vs 26 in vanilla and 26 in the equally small 1.92-ladder
  arm, NET/BEL/PRU with no company where both references had them, regional HQs 20 vs 74, while the rung-0 headcount
  it was meant to cut ROSE 0.73M→1.17M. The user's pre-declared criterion applies ("if the companies won't form or
  won't properly expand, the cure is worse than the disease"). Now opt-in via `company_target_gate: true`, default
  false, off in both A/B arms; the relaunch `ab_ladder_n3x2b` carries no gate.

**What this retires FOR THIS ARM:** the mandated price ladder as a design input (§10.65/§10.66 — F94/F97: the
engine realises the decline in wage units, not in £), the lean floor, the recipe ratchet, the margin ladder and
the solvency clamp (all moot on vanilla-anchored recipes; the build's linters still run and pass), and the
inverse solve as the book's source. `era_inverse.mjs` and the tier4 pipeline remain the reference for the
solved-book arms.

**The four numbers.** The death threshold is F97 §2's: a rung two behind empties below ~0.2 of the frontier's VA
per worker. Arm 1 sits on vanilla's own SHAPE (vanilla runs A ≈ B ≈ 1.5 per method step, F97 §6) at ×2.5:

| | ab1, A=B=2.5 | ab2, A=2.0, B=1.5 |
|---|---|---|
| VA/worker rung k ÷ rung k−2, min · max | 5.7 · 6.9 | 4.5 · 8.5 |
| rung k ÷ rung k−1 | 2.5 | 2.2 to 3.7 |
| top-rung input share of output value (floor 1:6 = 0.167) | 0.30–0.77, none below | art_academy 0.13 below; rest 0.19–0.41 |
| cost ladder, 600-pt industry / dearest | 600/1 500/3 750/9 375 · 12 500 | 600/1 200/2 400/4 800 · 6 400 |
| ai_value by tier | 1 000/2 500/6 250/15 625 | 1 000/2 000/4 000/8 000 |
| cost-divisor scaling (top ÷1.80) | 0.000064 | 0.000125 |

At A=2.0 three industries sit under the 5.0 line (arms and furniture 4.9, art academy 4.5); A=2.1 would lift all to
5.0+ at the price of a hairline floor miss on arms. The user chose 2.0/1.5 (2026-09-02); the shortfall is a watch item.
The art academy's floor miss reflects vanilla's own input share of 0.30.

**Predictions, pre-registered in `tools/testbed/schedules/ab_ladder_n3x2.json`:** GDP 0.85–1.05× vanilla at
the n=3 median in both arms; shortlist t0 headcount FALLING 1900→1935 for the first time and under 30% staffed
by 1935; t2 the largest shortlist rung by 1920; tiered employment 0.4–0.6× vanilla (ab1) / 0.5–0.7× (ab2);
below-best ≤ 25%; company-held t0 share and post-1920 t0 establishment both down from the flat-cost readings;
the 1836.2.1 order book vanilla-like (no raw at 175). Not predicted: the K-loop's response magnitude, and
whether the engine honours an owner-technology clause inside a company `state_trigger`.

**First read (ab1 n=1, `20260902_095339`, VERDICT there):** P1 and P2 FALSIFIED — GDP 0.54× vanilla at 1935
(0.96 · 0.83 · 0.62 · 0.57 · 0.54 across 1860–1935), productive workers per capita 0.53×, GDP per productive worker
1.08×; shortlist construction capacity 0.48× vanilla, investment pool 0.42×, peasants 48.8% of the workforce vs 17.1%;
every manufactured price ABOVE base all century (tools 153% at 1935) with a 279-item private backlog in Britain — a
supply-short stall, the 1.92-ladder arm's shape (0.62×) again, not seed noise; t0 rungs 94–98% staffed and the t0
headcount rising. Capacity pricing creates 2.5–6× fewer jobs per construction point, labour stays peasant, demand and
the pool grow slowly, and the government builds half the construction sectors. ⚠ Whether the ×2^k arm stalls less is
what the relaunch tests first (ab2 leads).

**Second read (ab2 n=1, `20260902_121027` run001, gate OFF):** the shape the design asks for — world GDP **0.98×**
vanilla at 1935 (0.97 · 0.84 · 0.81 · 0.93 · 0.98 across 1860–1935), productive workers per capita 0.76×, GDP per
productive worker 1.32×; shortlist GDP 1.23× (1.12 · 1.07 · 1.13 · 1.28 · 1.23), workers per capita 0.84×, £ per
worker 1.56×. Shortlist construction 1 334 levels vs vanilla 757, pool £355M vs £700M, peasants 27.4% vs 17.1%.
Companies with the gate off are at vanilla's level: shortlist 25 vs 26, 6 of 6 countries, regional HQs 135 vs 96,
company-held 38.8% vs 39.1% — which pins ab1's company deficit on the gate. Shortlist t0 headcount 0.80M → 1.17M
(1900) → 0.89M (1935), the first arm in which it falls after 1900; t0 rungs 1–81% staffed (motor 3, steel 1,
furniture 24, food 46, textile 48, paper 52, tooling 71, glass 81); t1 still the largest rung at 53%, t2 43%.
Prices above base for the supply-short goods (glass 155, furniture 139, paper 139, tools 126) and at or below for
clothes 102, engines 97, steel 89, groceries 81. Below-best 35.4%, 87% of it one rung behind. Wall clock 9 467 s,
vanilla's range. ⚠ n=1; the ab1 replicates that follow run with the gate off and are not comparable to ab1's first run.

**Third read — the batch closed (2026-09-02 22:18, FINDINGS F98, VERDICT in `20260902_121027`):** ab2 n=2 world
GDP **0.98× / 0.97×**, shortlist 1.07× / 1.23×, productive workers per capita 0.72–0.76×, £ per productive worker
1.25–1.32×, companies at vanilla, P +2.5% PASS, below-best 36.1%; ab1 n=2 gate-off **0.39× / 0.47×** beside the
gate-on 0.54× — three seeds, a stall, construction 0.48× vanilla. The user stopped the third ab2 seed at 1861 and
the sixth run was skipped. ⭐ The t0 rungs that survive on ab2 (glass 85% staffed, tooling 60%, art academy 70%)
ride glass at 150–175% and tools at 120–170% of base in every core market of both seeds — demand from the
construction sector's steel-frame method (40 glass + 20 tools per level, 80–90% of building glass demand in
both games) against an AI that under-builds the plastics rung (Britain 44/97 levels vs vanilla's 255, though it
is the most profitable building on the map); steel, food, furniture, arms, artillery and explosives t0 are dead
at 1–7% staffing. So the remaining t0 question is a market-shortage question first and a rung-gate question
second. PROPOSED, not built, awaiting a ruling: a `possible = { owner = { NOT = { has_technology_researched =
<rung k+2's tech> } } }` build gate on every rung plus a steeper ai_value ladder, on the ab2 book.
**ab3 — RULED AND LAUNCHED (user, 2026-09-02 22:30, session `20260902_223037_ab3-n3`, n=3):** the ab2 book with ONE change,
glass and tooling at **ai_value 1000 × 3^tier = 1000 / 3000 / 9000 / 27000** against the generic 1000 × 2^tier =
1000 / 2000 / 4000 / 8000 ("about the same in the 1830s, but growing steeper") — `make_ab_config.mjs --ai-steep
glass,tooling:3`; exactly six fields differ from ab2, verified by diff. Predictions P1–P7 are in the schedule
(`tools/testbed/schedules/ab3_n3.json`): glass toward vanilla's 105–126% and tools toward 91–101% in the core markets,
British glassworks above 200 levels, shortlist t0 glass/tooling under 100k each and under 30% staffed, world GDP
0.93–1.03×, below-best ≤ 40%, companies at vanilla; a joint null on P1–P3 would say the deficit is a pool/cost effect,
not a desire effect. The rung build-gate stays proposed, not built.
**First read (ab3 seed 1, `20260903_000418` run001, 2026-09-03 02:40 — the first launch `20260902_223037` was voided
by L26 and relaunched):** the lever bites. World GDP **0.95×** vanilla (prod/capita 0.72×, £/worker 1.36×), shortlist
1.17× (0.88× · 1.57×); companies at vanilla (shortlist 26 vs 26, 6 of 6, regional HQs 114 vs 96, company-held 37.8%
vs 39.1%). Glass at 1935: British **118%** (ab2 158/153, vanilla 105), American 135 (152/171, 111), French 140
(155/159, 126), Russian 149 (154/172, 113); tools British 103 (96/129, 91), French 98, American 116, Russian 140.
Britain holds 117 leaded + 84 plastics glassworks (P2's >200 met) and 172 rubber-grip + 10 carbide tooling levels;
Germany over-shoots to 391 + 206 glassworks, exporting glass. Shortlist t0 headcount 773k = 3.7% of tiered (ab2
1.18M = 5%): glass t0 119k at 72% staffed (was 319k), but tooling t0 **397k**, of which 375k is the USA's 75 t0
workshops — 74 of the 75 company-held, the F97 §4 company pattern in one seed. Steel reads 124 in the American and
115 in the Russian market (the new tooling rungs eat steel) — a watch item. P4 and P6 pass, P1/P2 pass in Britain
and move the right way elsewhere, P3 half (glass yes, tooling no, for the company reason), P5 undecidable at n=1.
**Batch closed (2026-09-03 07:59, n=3, FINDINGS F99, VERDICT in `20260903_000418`):** world GDP **0.95× / 0.39× / 0.90×**
(shortlist 1.17 / 0.25 / 1.01); the lever bites in both growth seeds — British glass 118% / 112% (ab2 158 / 153,
vanilla 105), Britain 84 / 201 plastics glassworks (ab2 44 / 97), seed 3's Britain supplying its own glass; tools at
vanilla's level in Britain and France; below-best 35.3%, frontier payback 7.3 y vs stale 27.1 y, P +2.3% PASS.
Shortlist t0: glass 119k / 50k / 146k (ab2 234k / 404k), tooling 397k / 75k / 61k — lower, not dead. ⚠ Seed 2 STALLED:
Britain's private construction collapsed in 1860 (320 → 101 pts/wk, pool 0) and India left and fragmented the British
market in 1880–82; nothing ties it to the six fields (glass/tooling counts identical through 1870), but the ab2 book
family now stalls in 1 of 5 seeds against ab1's 3 of 3 — a low-growth equilibrium a bad decade can tip a major into.
OPEN: whether to spend seeds on the stall rate (pool-side levers: cost divisor, top-rung cost) or on the rung k−2
build gate for the surviving t0 glass/textile/motor rungs.

**Files:** `config/mod_config.ab1.json`, `config/mod_config.ab2.json` (+ `tech_tree_options.ab1/ab2.json`),
both `-DryRun` clean (lint 62/62, negative-goods, solvency 62/62, tech content 193/0 orphans, start conversion,
mod checks, preflight ×2). Nothing canonical changed; `mod_config.json` is still the solver2f book.


## §10.69–§10.71 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.69 `canon-4rung` — the four-rung canon declared beside the six-rung canon (user-ruled 2026-09-03)
- 10.70 — THE ART-ACADEMY "HYPERSONIC" LADDER — canon4-art (user-directed 2026-09-04, a STRESS TEST, nothing canonical changed)
- 10.71 — THE VANILLA-FIRST FOUR-RUNG LADDER — `canon4v` (user-ruled, restated 2026-09-04; a CANDIDATE canon awaiting ratification)

## 10.72 — THE FOUR-RUNG CANON IS BUILT FROM VANILLA AND NOTHING ELSE (user-ruled 2026-09-04, the third time)

**The ruling, in the user's words:** "Find all instances of prose or code that make you do that and get rid of them. Four-rung
generator takes vanilla rungs (up to four) and enriches them. Very rarely alters them. No six-rung-canon data should be
consulted whatsoever in preparing the canon4rungs." It was triggered by the agent proposing to fix the rung NAMES inside a
generator that still cloned every rung from the six-rung book — the derivation already ruled out on 2026-08-30 and again
earlier on 2026-09-04.

**What consulted six-rung data, and what replaced it.**
- `make_tier4_config.mjs` cloned each rung from the canonical tier carrying that vanilla method (names, dates, keys,
  employment, textures came along) and copied the canonical book's top-level blocks: the six hoard `ai_defines`, the electric
  streetlight `pm_goods`/`pm_employment` override (a six-rung POWER-ladder decision on a book where power is vanilla), the
  trade-centre `building_ai_value` 5000, `building_subsidies`, the NET `start_tech_grants` (the metal-shipyard seed), and the
  six-rung fits for `era_prices`/`measured_price_paths` twins. → Rewritten: it reads the game's buildings, method groups,
  methods and English localisation plus `tools/lib_tier4_spec.mjs`. A rung is a vanilla method with vanilla's name, gate,
  recipe, staffing, pollution and icon; the building block is vanilla's; secondary groups are vanilla's; none of the six-rung
  top-level blocks is carried. The structure carries no cost or ai_value — the A/B tool's.
- `make_tier4_techs.mjs` took the six-rung twin's technologies as its base: that ladder's era alignment (dynamite, repeaters,
  breech-loading artillery 3 → 2; combustion engine, telephone 4 → 3; aniline 3 → 2; atmospheric engine, crystal glass → 1),
  its 14 renames ("Lead Crystal", "Coal-Tar Chemistry", "Continuous-Flow Production"…) and 12 prerequisites it had inserted
  (minted tech-era-1 technologies that do not exist here). → Rewritten: vanilla's technologies from the game, at vanilla's eras,
  names and prerequisites; the spec's ERA_MOVES (against vanilla only vulcanization moves, 3 → 4) and the additions' minted
  technologies are the whole departure.
- `emit_techs.mjs` rewrote aniline's prerequisite on EVERY build (a six-rung tech-era move's consequence). → Applied only when the
  tree actually moved aniline.
- `convert_history.ps1` applied `config/start_exceptions.json` — the six-rung chain seed (steam-port stubs, metal shipyards,
  the FRA/NET motor and steel `create` rules) — to any config. → A config may name its own rule set
  (`start_exceptions_file`); the four-rung one names an EMPTY set: its 1836 start is vanilla's, converted.
- `lint_start_conversion.mjs` opened `config/mod_config.json` to find an industry's vanilla group. → Reads the config it lints.
- `lib_tier4_spec.mjs`'s MODERN table named six-rung tier keys "to restore"; `propose_vanilla_ladder.mjs` proposed the
  vanilla ladder FROM the canonical config. → The spec is self-contained (ADDITIONS carry key, names, year, minted technology);
  the proposal script is deleted.
- Prose: the CLAUDE.md entries for both tools and the tier4 layout line, and §10.66 / §10.67.4 / §10.71's procedures, all
  described the derivation → rewritten or banner-retired. canon-4rung (the measured book) is FROZEN: its structure came from
  the retired path and the pipeline can no longer reproduce it; the committed file is the record.

**The spec (the only authored input):** INDUSTRIES (17 vanilla buildings), PLACEMENT for the five with fewer than four
methods (food t0–t2; automotive t2–t3; munition t1–t2, because the plant does not exist at 1836; synthetics t1; electrics
t1), ADDITIONS (rule 2: furniture spray finishing 1923, paper continuous web 1930, fertilizer catalytic synthesis 1937, motor
high-speed diesel 1935 — each where vanilla stops 25+ years short of 1940 and no secondary group covers the theme), ERA_MOVES,
TECH_RENAMES_RULED (empty). Building names are derived, "<vanilla building> (<vanilla method>)".

**The result, canon4v regenerated:** 57 buildings (59 on the clone path, 63 before rule 1), 183 technologies of which 4
minted, 41 research technologies → 123 entries; every one of the 53 vanilla rungs carries vanilla's name and vanilla's gate
(the coverage audit reads 0 flags); the tree's eras are vanilla's. Dry run clean (lints, solvency, tech content, L13, preflight).
Tier → tech era, as the game will enforce it (cell = gate technology, its tech era):
| industry | tier 0 | tier 1 | tier 2 | tier 3 |
|---|---|---|---|---|
| food | manufacturies 1 | distillation 1 | baking_powder 2 | — |
| textile | manufacturies 1 | lathe 1 | mechanized_workshops 2 | electrical_capacitors 4 |
| furniture | manufacturies 1 | lathe 1 | mechanized_workshops 2 | spray_finishing 5 |
| glass | manufacturies 1 | lathe 1 | crystal_glass 2 | plastics 4 |
| tooling | manufacturies 1 | steelworking 1 | mechanical_tools 2 | vulcanization 4 (moved from 3) |
| paper | manufacturies 1 | mechanical_tools 2 | chemical_bleaching 2 | continuous_web_processing 5 |
| fertilizer | intensive_agriculture 2 | improved_fertilizer 3 | nitrogen_fixation 4 | catalytic_synthesis 5 |
| explosives | intensive_agriculture 2 | nitroglycerin 2 | dynamite 3 | electrical_capacitors 4 |
| steel | steelworking 1 | bessemer_process 2 | open_hearth_process 3 | electric_arc_process 4 |
| motor | atmospheric_engine 2 | electric_railway 4 | compression_ignition 5 | high_speed_diesel 5 |
| automotive | — | — | combustion_engine 4 | compression_ignition 5 |
| arms | gunsmithing 1 | rifling 2 | repeaters 3 | bolt_action_rifles 4 |
| artillery | artillery 1 | shell_gun 2 | breech_loading_artillery 3 | automatic_machine_guns 4 |
| munition | — | percussion_cap 2 | dynamite 3 | — |
| synthetics | — | aniline 3 | — | — |
| electrics | — | telephone 4 | — | — |
| art_academy | romanticism 1 | realism 2 | camera 3 | film 4 |
Five rungs beyond rung 0 are tech-era-1 start technologies (distillation, lathe ×3, steelworking), as in vanilla.

**Ruled later the same day — the motor anchor:** COAL + IRON MINES, one summed source (a list in `necessity_anchors` is one
source over exactly those building types; lead, sulfur and gold mines left out). The entry ticks while the country employs
25,000 workers in its coal and iron mines together — five fully staffed mine levels — and only starting-tech tier 3–5 countries ever see
it, vanilla handing starting-tech tiers 1 and 2 the technology in 1836. With it, every research-entry term is rephrased for the player
("Workers in Coal Mines and Iron Mines: at least 25,000; now N"; "Coal Mines: at least 5 fully staffed levels (25,000
workers); now 3"): no bg_ key is player-facing.

**Open, awaiting the user:** (2) whether any of the not-carried six-rung blocks is wanted on this line (the hoard
defines were in the MEASURED canon-4rung, so canon4v's first batch is not a pure re-measure); (3) ratification and a run.

## §10.73 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.73 — canon4v-art3: THE FILM ACADEMY AT ×3, AND THE FIRST BATCH OF THE VANILLA-BUILT CANDIDATE (user-ruled 2026-09-04)

## 10.74 — canon4v IS THE CANON; the art academy back on the regular ladder (user-ruled 2026-09-05)

**Ruling.** "Revert art academies to regular ladder (keep the vanilla t0 build cost, which is unique). While the current
situation is somewhat better than vanilla, it's also gameable, I'd rather not leave infinite money printers in the mod.
Canonise the result, commit and push."

**What changed.** Nothing in the book: canon4v (§10.72) already carries the academy on the A/B ladder — fine art 5 / 10 /
20 / 40 a level, inputs ×1.5 per rung over each method's own mix, building_cost 400 / 800 / 1,600 / 3,200 (rung 0 is
vanilla's own `construction_cost_medium`, the one 400-point anchor among industries that anchor at 600 or 800; the ladder
keeps it and doubles from it), ai_value 1,000 × 2^tier. The ×3 film rung was only ever the `canon4v-art3` variant (§10.73),
and it is retired: F104 measured it at 103–117% of base with 120 fine art a level on a 3,200-point building — output per
construction point three times the ladder's, which is the money printer. `config/mod_config.canon4v-art3.json` stays as
the measured arm's record; nothing builds it by default.

**The promotion.** The spec's CANON record was stamped canonical and the book regenerated through the vanilla-only pipeline
(`make_tier4_config` → `make_tier4_techs` → `make_ab_config --A 2.0 --B 1.5 --suffix canon4v --ai-steep glass,tooling:3
--divisor 0.000125`); the regenerated pair was proven identical to the committed pair apart from its stamps, then copied to
`config/mod_config.json` + `config/tech_tree_options.json`. The six-rung canon (the solver2f book of §10.65.9) moved to
`config/mod_config.six_rung.json` + `config/tech_tree_options.six_rung.json`, un-ignored, buildable with `-Config`. The
six-rung machinery — `build_era_ladder`, `era_solver`, `era_scenarios`, `era_tech_sync`, `payback_census`,
`vanilla_payback_census`, `verify_pms`, `tech_tree_spec --write` — throws on the four-rung canon unless
`MOD_CONFIG=config/mod_config.six_rung.json` is set, because a `--write` in any of them would have rewritten a four-rung
config as if it had six tiers. `mod/` and the deployed copy follow the default build. ⚠ The regular-ladder academy is
itself unmeasured: F104 ran the ×3 variant; everything outside the academy in F104 is this canon's reading.

### 10.74.1 — Obsolescence levers: getting tiered output prices LOWER in the late game without touching pop consumption
(advice recorded 2026-09-05, NOT ruled)

**The mechanism that sets a late-game price.** Pop demand in UNITS is price-inelastic — a pop buys `need money × share ÷
BASE price` units (F40) and pays the market price for them — so a surplus is absorbed only by wealth progression, population
growth and trade (F97), never by pops buying more because the good is cheap. The market formula needs a sustained surplus
of two-thirds over demand to hold a price at 50% of base. The AI removes any such surplus by not building: construction goes
where the return on capital is, so the price settles where the FRONTIER rung's return no longer attracts the private pool.
⇒ A late-game price is set by three things and pops are none of them: (1) the frontier's break-even price — its input value
and wages per unit of output; (2) the capital available to build frontier capacity; (3) how strongly the AI prefers the
frontier over older rungs and over the untiered sectors. F104's 64% groceries / 69% steel at 1935 came from (1) alone.

| lever | mechanism | evidence | gameable? |
|---|---|---|---|
| **ai_value 3^tier on every tiered industry** (today glass + tooling only) | more of the pool goes to the frontier rung, capacity outruns wealth-driven demand sooner | F99: British glass 118/112% vs 153–158 on the same book — the lever moves PRICE | no (willingness, not economics); watch the overshoot check (F76) for starved raw sectors |
| **widen A/B on the top rungs** (e.g. B 1.25 above rung 2, A unchanged) | the frontier stays profitable at a lower price; rung k−2 dies there | ab1 (2.5/2.5) stalled on the INPUT side; the A÷B ratio, not A, sets the floor | no, if building_cost stays ∝ output (capacity pricing) |
| **upper-rung staffing ×0.85 per rung** | wages per unit fall, frontier break-even falls, labour released — the "fewer workers" goal directly | tiered_panel: VA per tiered worker already 3.2× vanilla; unmeasured as a lever | no — output per construction point unchanged |
| **re-add the private-pool hoard defines** (the six-rung canon's `ai_defines`; canon-4rung carried them, canon4v does not) | more capital → more frontier capacity | measured on canon-4rung (F98–F103), absent in F104 | no — capital side |
| **economy-of-scale cap raised by tech-era-4/5 technologies** (`building_economy_of_scale_level_cap_add`, vanilla's own mechanism) | big frontier buildings gain throughput, cheaper capacity per point | unmeasured; vanilla-shaped | mildly — bounded by vanilla's own cap idiom |
| **capacity price falling per rung** (cost ∝ A^k × 0.9^k) | more output per construction point at the frontier | this IS the art-×3 direction at 3× — rejected today at that magnitude | yes at any size — the very thing the ruling refuses |

Not levers: base-price changes (units are money ÷ base price — that is pop consumption); scripted price control (none
exists; the price is computed); raising output without cost (the money printer). The death mechanism itself reads WAGES
(F97: a building lays off under 0.66× expected SoL), so any lever that lowers the frontier's break-even also widens the
VA-per-worker gap the old rung dies on. Recommended order if ruled: ai_value 3^tier everywhere (cheapest, measured to bite,
reversible), then upper-rung staffing, then the hoard defines; A/B and the scale cap after a price PATH has been read off
`markets_all.tsv`, since F104's decline is one market at one date.

**Read 2026-09-05 (F105).** The path was read before any lever moved. It says: a decline over the century in four goods
(groceries, steel, small arms, artillery — the ones whose output outran demand), none in £ for the other twelve, five of which
are dearer than vanilla late because the arm under-builds them (paper at 0.6× vanilla's output all century, cars and
telephones short of a demand 1.3–1.8× vanilla's); broad and steeper than vanilla in WAGE units (wages ×1.79 vs ×1.50); and
**the private pool hoards** — world pools 0.48 of GDP at 1935 against vanilla's 0.29 and 0.19 on canon4-je, which carried the
six-rung hoard defines. So the order above stands with one change of weight: the hoard defines are not third but first, since
idle capital beside under-built consumer industries is the measured constraint; ai_value 3^tier next (glass shows it moves the
path earlier, F105 §3); the A/B widening cannot be sized from a price target yet, because every 1935 price sits far above the
frontier's break-even. User rulings the same day: ai_value 3^tier everywhere OK; the hoard defines OK with a conscious pass on
the numbers; upper-rung staffing NO; A/B widening possible, amount unclear; the economy-of-scale suggestion was WRONG for this
mod (vanilla already raises the cap by technology — mechanized workshops +10, shift work +20 on a base of 20 — and the bonus
rides on the building TYPE, so a split ladder hands it to the entrenched rung and resets it for every new one; a lever against
obsolescence, not for it; see the 2026-09-05 exchange).

## 10.75 — THE RULED SET ON THE CANON: `canon4v-hai3` (user-ruled 2026-09-05, measured in canon4v_hai3_n2.json)

**Rulings (2026-09-05, after F105).** On the §10.74.1 levers: ai_value 3^tier on every tiered industry — OK; the investment-pool
defines as proposed — OK, with `PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_WANTED_COST_COVERAGE` ruled OUT ("don't go into
that"); upper-rung staffing — NO; A/B widening — possible, amount unclear, not taken; the economy-of-scale suggestion — dropped
(vanilla already raises the cap by technology, and on a split ladder the bonus rides on the entrenched rung). "Go with another
n=2 in the ruled config."

**The set, define by define.** Vanilla's values and comments are the game's own (`common/defines/00_ai.txt`).

| define | vanilla | canon4v | canon4v-hai3 | what it does |
|---|---|---|---|---|
| `MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR` | 0.75 | 0.75 | **0.9** | the AI invests more in construction when its pool has outgrown its construction capacity — F105's measured symptom (world pools 0.48 of GDP at 1935, Britain's above a year of GDP) |
| `MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD` | 0.75 | 0.75 | **0.9** | a construction sector below this fraction of wanted counts as very important to grow |
| `MONEY_SPENDING_CONSTRUCTION_EXCESSIVE_THRESHOLD` | 1.05 | 1.05 | **1.5** | the AI stops wanting more construction only above this fraction of wanted |
| `CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED` | 0.05 | 0.05 | **0.1** | the AI's own queue-count cap for production buildings, per point of construction; the least understood of the set, kept because the measured pool reduction on canon4-je came from the set |
| `PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD` / `_VERY_LONG_` | 40 / 60 wk | 40 / 60 | **160 / 240** | the AI halves a building's score past 40 weeks at full sector usage and quarters it past 60; our rungs cost ×2 / ×4 / ×8 vanilla's anchor by capacity pricing, so vanilla's thresholds tax the top rung for being priced by capacity. ×4 scores the ×4-priced tier-3/4 workhorse rung as vanilla scores its own mill; the ×8 rung is still scored down in sectors under ~240 points a week (×8 would neutralise the rule; the six-rung book used ×3 for its 2.7× top rung) |
| `PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING` | 0.001 | 0.000125 | 0.000125 | the pool's score for a construction is divided by 1 + cost × this; at vanilla's value a 4,800-point rung-3 mill scores ÷5.8 against ÷1.6 for the 600-point rung 0 (a 3.6× bias to the old rung), at the book's value ÷1.6 against ÷1.075 (1.5× — a residual) |
| `PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_WANTED_COST_COVERAGE` | 1 | 1 | 1 | RULED OUT. The pool must hold a construction's whole cost before starting it; a rung-3 mill is £2.6–3.5M, which a minor's pool never reaches |
| `AUTONOMOUS_INVESTMENT_UPDATE_COUNT_DIVISOR` | 500,000 | vanilla | vanilla | one autonomous-investment update per tick per £500k entering the pool; lowering it spends large pools faster at a performance cost — revisit only if pools still hoard after the set |

⚠⚠ **THE ENGINE VALIDATES EVERY DEFINE AS IT LOADS IT, AND A REJECTED VALUE REVERTS TO VANILLA IN SILENCE** (landmine **L33**,
found 2026-09-15). The bounds are hardcoded and undocumented, and vanilla's own comments can be wrong about them: the comment on
`TOO_LARGE_INVESTMENT_POOL_FACTOR` says *"capped at 1"* while the validator's range is **[0,1)** and excludes 1 — the eager set used
1.0 and ran at vanilla's 0.75, i.e. BELOW the canon's 0.9, for a whole batch (F121's correction). **0.99 is the usable cap.** A bound
can also cross-reference a sibling: raising `MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD` to 1.25 invalidates vanilla's own
`MONEY_SPENDING_SHIP_CONSTRUCTION_EXCESSIVE_THRESHOLD` of 1.05, a define we never set. ⇒ When choosing a define value here, check the
first run's `error.log` for `defines.cpp` *"not valid with given value"* — `Test-LmL33` and the heartbeat's DEFINE REJECTED alarm do it
for you, but the value in this table is a REQUEST until a run proves the engine took it.

**ai_value.** 1,000 × 3^tier on all 17 tiered industries (1,000 / 3,000 / 9,000 / 27,000), where canon4v steepens glass and
tooling only and the rest run 1,000 × 2^tier. F99 measured the lever on glass and F105 §3 read its path: British glass output
2.9× vanilla's at 1880 and the price 0.86–0.94× of vanilla's through 1900, converging to 1.07× by 1935 as demand caught up — it
moves the path earlier; whether it holds a price down late is what this batch reads across seventeen goods.

**The arm.** `config/mod_config.canon4v-hai3.json` + twin: `make_ab_config --A 2.0 --B 1.5 --suffix canon4v-hai3 --ai-steep
<all 17>:3 --divisor 0.000125 --ai-defines <the five>` (the `--ai-defines K=V,K=V` flag was added for it, so the book is
regenerable by one command), verified by field diff to differ from canon4v in ai_value, ai_defines and stamps only. Schedule
`tools/testbed/schedules/canon4v_hai3_n2.json` — n=2, 1836 → 1936, predictions P1–P8 (pool share below 0.30 of world GDP,
construction ÷ vanilla ≥ 0.95, the under-built consumer industries closing by 1900, the four decliners staying below vanilla
and three more joining them, below-best ≤ 41%, no stall, P inside budget, the regular academy at 140–165%). The canon
(`config/mod_config.json`) is untouched until the batch reads.

**Outcome (F106, session 20260905_174831, n=2, both runs clean).** The pools fell where the hoard was largest — Britain 1.06 →
0.41 / 0.73 of GDP — and the construction sector reached vanilla's size (1.03× its levels at 1935), but the world's pools hold
0.41 in both seeds (canon4v-art3 0.48, vanilla 0.29, canon4-je with the same defines on the old structure 0.19) and total
building levels stay at 0.77× vanilla's. ai_value 3^tier everywhere moved the consumer build-out to before 1900 (British clothes
1.62× vanilla's output at 1900, paper 1.71, fertilizer 1.00 against 0.68 / 0.62 / 0.54), pushed the four falling goods further
(pooled groceries 0.61, steel 0.80, arms 0.66, artillery 0.56) and took paper, fertilizer and ammunition below vanilla (0.93 /
0.94 / 0.91); tools (1.17) and clothes (1.08) did not fall. Tier choice 39.0% (44.9), the oldest rung's workforce 6.9M (9.4M).
World GDP 0.88× (0.84 / 0.93), inside the canon's spread; companies 193 (238); row P 1.8% faster in total and +6.8% per unit
pop-matched (from +1.3%). The regular-ladder academy reads fine art 147%. NOT ratified — measured; the canon is untouched.

## §10.76 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.76 — canon4v-hai3 IS THE CANON; the 60-run plan with a GDP gate at run 30 (user-ruled 2026-09-06)

## 10.77 — THE VANILLA-1836 PREMISE IS DROPPED: rung-0 inputs lifted, building cost flat, ai_value linear (user-ruled 2026-09-10)

**Ruling (user, 2026-09-10, after F108).** "Once this run ends, we end the current batch and start a new one. We get rid of the
'1836 is as close to vanilla as we can' approach. Instead, to ensure the obsolescence, we raise the inputs of the 1836 tier, lowering its
margin compared to vanilla. The ladder then stays the same, different A and B. The building cost ladder is flat, the ai_values ladder is
not exponential (but still upwards)." The user leans ×1.3 on the 1836 tier's inputs, A 2.2 / B 1.5 as in phase 2.

**What it overturns.** §10.72's "rung 0 IS vanilla, so 1836 is vanilla by construction" (the anchor principle's 1836 half) — the 1836
composition no longer holds at vanilla's margins. §10.61's flat cost book is RESTORED to the shipped configs (F108 §6: the stall rate
follows the cost ladder's steepness — flat-cost books 0 of 7 at 0.95–1.71× vanilla, ×2^k books 8 of 46, ×2.5^k 3 of 3). The
exponential ai_value ladders (2^tier, 3^tier) are replaced by a linear one.

**The arithmetic behind the number (2026-09-10, at base prices, the measured base wage 0.0796/wk, wage weights vanilla's).** Vanilla's
rung-0 margin is thin and uneven — food/textile/furniture +6%, glass/tooling/paper +11%, steel +7%, munition +4%, fertilizer +8%, arms
+39%, automotive +77%; value-weighted +18% — because the input share of revenue runs from 0.33 (automotive) to 0.77 (steel). A uniform
lift therefore lands unevenly: at ×1.2 the value-weighted margin is +4% (food −6%, glass 0%, steel −8%, munition −9%, arms +23%);
at ×1.3 it is −2% (food −11%, glass −5%, steel −14% with zero value added per worker, munition −15%, fertilizer −12%, arms +17%).
Break-even output prices move from 84–96% of base to 96–106% (×1.2) or 104–117% (×1.3); vanilla's 1836 realised prices sit 5–20%
above base, which is what keeps a ×1.2 rung 0 alive until rung 1 exists and lets the first price fall from rung-1 supply kill it —
the obsolescence the ruling wants. On the ladder anchored on the lifted rung 0 (inputs I0 × lift × 1.5^k, output × 2.2^k) rung 1
reads +44–58% on the consumer goods, rung 2 +100–150%, rung 3 +200–300%; value added per worker rung 0 : 1 : 2 ≈ 1 : 4 : 11, past F97's
death ratio. **Recommended: ×1.2, the ladder anchored on it, ai_value 1,000 / 2,000 / 3,000 / 4,000 by tier (linear +1,000: rung 0 at
parity with every untiered vanilla building, a 4× top-to-bottom contrast instead of 27×), cost 600 / 800 / 400 flat, the cost divisor
back at vanilla's 0.001, the 24-month bar and the §10.75 defines kept.** ×1.3 is generated beside it (`config/mod_config.canon-flat-in13.json`)
for the record; it starts six industries loss-making at base prices from day one.

**Implementation.** `make_ab_config.mjs --in0 <mult> [--in0-only] --cost-flat --ai-ladder v0,v1,v2,v3` (2026-09-10): the lift on rung 0's
input value with the ladder anchored on it (`--in0-only` lifts rung 0 alone), the flat cost book, and an explicit ai_value list by tier
index. Books: `config/mod_config.canon-flat-in12.json` and `canon-flat-in13.json` (+ twins), both stamped `_variant`, bar 24; the ×1.2
book dry-run builds clean. Schedule `canon_flat_in12_n30.json` (30 runs, no gate, predictions P1–P8). ✅ **CONFIRMED by the user 2026-09-10 15:00: "Go with 1.2 as soon as the current run ends"** — the ×1.2 book, the ladder anchored on
it, ai_value 1,000 / 2,000 / 3,000 / 4,000, flat cost; `canon-flat-in13` stays only as the record of the alternative. **LAUNCHED 2026-09-10 15:12** as `20260910_151220_canon-flat-in12-n30` (30 runs, timeout 420, no gate), the moment phase 2's batch ended at its run 11 (F109: the A 2.2 arm at n=11 read 0.915× vanilla — the comparison this arm is read against, with phase 1 (F107) and the vanilla n=16 as the references).

**Outcome (2026-09-13, FINDINGS F110 — ONE SEED; the batch died with the agent app at 18:45:29 on 2026-09-10 with run 1 at 1935.2, landmine
L30, and run 1 was finished by hand from its 1935.1.1 autosave; runs 2–30 never launched and the user ruled no relaunch.)** World GDP at 1935
**2.10×** the vanilla median (£9,211M) — not a giant Britain (0.88×) but a rest-of-world twice vanilla's (Russia 4.1×, the USA 1.9×, an
independent India at £1.07B, Japan 9×); productive workers per capita **1.23×** vanilla (every earlier arm 0.6–0.7×), output per productive
worker 1.60×; trajectory 1.11× (1860) → 1.78 → 2.63 (1900) → 2.26 → 2.10. **Rung 0 dies**: 6.71M → 4.17M workers 1920 → 1935 (phase 2 grows to
5.74M), stale payback 157 years against the frontier's 4.9, the rung-0 steel / artillery / arms / munition buildings 0–2% staffed at negative
margins from 1880 and the consumer rungs 7–38% staffed by 1935; tier choice 26.0% (phase 2 40.2%). **Prices through the floor**: pooled 1935 ÷
vanilla groceries 0.44, clothes 0.50, steel 0.55, tools 0.57, small arms 0.35, artillery 0.32; base wage ×5.55; every tiered good at 0.03–0.12
of its 1840 wage price. **The pools balloon**: 2.28 of a year's world GDP (phase 2 0.34, vanilla 0.29), Britain 11.2 — the §10.75 defines were
tuned against the 0.000125 divisor, and a 600-point building on 0.001 is built in weeks. Row P: 215.9 min against 165 — 31% slower in total,
OVER budget, on a world 1.46× the pop objects; pop-matched +8.1%. Predictions: P2 (rung 0 dies), P5 (prices), P6 (tier choice) PASS; P3
(0.90–1.30× the world) and P4's early-game clause (1860 at 1.11×) MISSED upward; P7's total MISSED; P1 not scorable at n=1. Four levers changed at
once and one seed: a direction, not a result — the next seeds (through `launch_detached.ps1`, landmine L30) and the pool hoard are what to settle
before ruling on it. Ledger https://claude.ai/code/artifact/0e29136d-ec51-4818-b139-1e6fd529cbec (fill dir `tools/testbed/ledger/out_canon_flat_in12_n1`).

## 10.78 — THE TIER RULE: rungs refer to their tiers, never to their order, and the ladder is keyed on the tier (user-ruled 2026-09-13, "the final ladder realignment")

**The ruling (user, 2026-09-13).** "We always refer to the techs by their actual tech era (which has a real game mechanical meaning —
unfinished techs of eras under N add penalties to era N tech cost), and always refer to tiers by their narrative era between 0 and 3,
and same-era industry tiers are roughly the same unlock time, meaning that an industry that starts in 1900 is starting not at t0, but
at around t2. Adjustments can be made as we don't have too many tiers for good alignment, but if I ever see a t0 automobile industry, I
will riot." And: "while these tier numbers do not have inherent game mechanical meaning, they have a very strict meaning in the mod, as
those numbers are the anchors that dictate their economy, by the ladder (our late tiers are uniformly more effective than earlier
ones)." It restates the 2026-09-03 research-mark ruling ("do not consider late-to-appear industries as t0/t1") and extends it from the
analyses to the config, the generator and every reader. CLAUDE.md carries it as a GOVERNING section.

**The rule, as implemented (`tools/lib_tier4_spec.mjs` header; `make_tier4_config.mjs`, `make_ab_config.mjs`, `lint_tier_eras.mjs`).**
1. *Two kinds.* A technology's GAME era (1–5) is mechanical. A rung's TIER (0–3) has the anchors 1836 / 1875 / 1905 / 1940
   (`era_anchor_years`) and maps through `era_game_era` [1, 3, 4, 5]: t0 ↔ 1 (held at the start), t1 ↔ 3, t2 ↔ 4, t3 ↔ 5; **game era 2
   (researched 1836–1861) sits in the gap and rounds UP to t1**, the first researched tier.
2. *Derivation.* A rung's tier = the tier its gate technology's game era maps to, bumped up only as far as one-rung-per-tier needs in vanilla's method
   order (vanilla's ladders are front-loaded — game eras 1, 1, 2, 4 for a textile mill — so the bump is what places a four-method industry
   on 0, 1, 2, 3). *Tolerance ±1 tier* is the ruled adjustment. A ladder that does not fit needs a `PLACEMENT` ruling; the generator throws
   otherwise, and throws on any placement — derived or ruled — outside the tolerance.
3. *The economics follow the tier.* output × A^e, input value × lift × B^e (the lift on tier 0 alone under `--in0-only`), building cost
   anchor × A^e or flat, ai_value by e, the research marks by the unlocked rung's tier. The rung index is never a key.

**The census (the canon, 57 rungs; "off" = placed tier − the tier its technology implies).** Derived, no ruling: food t0/t1+1/t2+1
(manufacturies 1, distillation 1, baking_powder 2); textile, glass, tooling t0/t1+1/t2+1/t3+1 (1, 1, 2, 4); furniture t0/t1+1/t2+1/t3
(spray_finishing minted, 5); paper t0/t1/t2+1/t3 (1, 2, 2, 5); steel, arms, artillery, art_academy t0/t1/t2+1/t3+1 (1, 2, 3, 4);
automotive t2/t3 (combustion_engine 4, compression_ignition 5); munition t1/t2+1 (percussion_cap 2, dynamite 3 — the 2026-09-04 ruling
reproduced); synthetics t1 (aniline 3); **electrics t2 (telephone, game era 4) — the ruled t1 of 2026-09-04 was one tier low and is
corrected**. Ruled (`PLACEMENT`): fertilizer t0−1/t1/t2/t3 and explosives t0−1/t1/t2+1/t3+1 (the first method intensive_agriculture is
game era 2 → t1, but three researched rungs sit above it, so the ladder fits only with it at t0 — the 1840s rung treated as the 1836 one,
the one the lift kills); motor t0−1/t1−1/t2−1/t3 (electric engines on electric_railway, game era 4 → t2, and diesel on compression_ignition,
5 → t3, each one tier BELOW their technology so the minted high_speed_diesel keeps the top rung). ⚠ **Motor is PENDING a ruling**: the
derivation gives [0, 2, 3] with no slot for the addition; the alternative is to DROP high_speed_diesel — no rung off its tier, but no 1940
rung (compression_ignition, a tech-era-5 technology, would BE the t3). Kept with the addition because it was ruled 2026-09-04 and both middle
rungs are within tolerance; they arrive late (weaker than their date), never early.

**What the index keying had done (FINDINGS F111).** `make_ab_config` keyed every multiplier on k = tier − the industry's first tier, so
automotive's t2 and t3 rungs carried k = 0 and 1 — vanilla's recipe at vanilla's margin, then ×A — and munition's t1/t2, synthetics' t1
and electrics' rung carried k = 0/1/0/0. Regenerated on the tier (the canon, A 2.0 / B 1.5): automotive t2 output 30 → 120 automobiles,
inputs 10/5/5 → 22.5/11.3/11.3 engines/rubber/oil, cost 800 → 3,200, target_be 44 → 25; t3 60 → 240, cost 1,600 → 6,400; munition t1
50 → 100 ammunition (cost 800 → 1,600), t2 100 → 200; synthetics t1 80 → 160 dye; electrics t1 → t2, 60 → 240 telephones, cost 800 →
3,200, ai_value 3,000 → 9,000. On the flat-cost ×1.2 book the same rungs also lose the lifted-vanilla margins that left electrics at
target_be 107 and munition at 115 — loss-making at base from their debut (F110: 29% and 27% staffed on 697 and 841 built levels).
Every four-method industry is byte-identical before and after (proved per book, 2026-09-13).

**Guards.** The generator derives, validates and throws. **`tools/lint_tier_eras.mjs` runs inside every `build.ps1`** and as landmine
**L31** in `preflight.ps1`: placement within ±1 of the technology's era (from the config's PAIRED tree, the era the mod ships), one rung
per tier, output and value added rising with tier in every industry, and for an A/B book every multiplier a function of the tier (output,
input value, cost, ai_value recomputed from the vanilla first method and `_ab`). A book records `_ab.keyed_by: 'era'` and `_ab.command`;
`--bar-months` and `--variant` make the measured books' hand edits part of the command. The history converter names a rung by `era`
(`tier`, a position, is the six-rung rule set's and throws on a four-rung book); `start_baseline.json` labels by tier; the research-event
emitter converts a rule-D technology's game era to a tier before reading the marks; the UI's tier pill reads the book's anchors.

**Books regenerated 2026-09-13 (each by its own one-line command, recorded in `_ab.command`):** the canon (`config/mod_config.json` =
`canon4v-hai3`), `canon-je24`, `canon-je24-a22`, `canon-flat-in12`, `canon-flat-in13`, and the two test books of the next session,
`canon-flat-in12-a16` (A 1.6 on the flat lifted book) and `canon-je24-a22-in12` (the lift alone on phase 2's book). The books F106–F110
were measured on are commit `880f098`'s copies (`git show 880f098:config/mod_config.canon-je24.json`). ⚠ Comparability: a run of a
regenerated book differs from its measured baseline in the four re-keyed industries (~1.5% of world value added at 1935 in every mod arm,
2.05% in vanilla); world readings — GDP, workers, unemployment, pools, construction, the four-method industries' obsolescence — stay
comparable; readings about automobiles, telephones, dye and ammunition do not. ⚠ A SECOND change rides along in every build since
2026-09-13, unrelated to the tier rule but found by its dry runs (BUGS_AND_FIXES 2026-09-13): `emit_secondaries.mjs`'s input regex had
shipped without its backslashes, so every secondary method kept VANILLA input quantities on every rung while its outputs scaled — the
t2 cannery made 4× vanilla's groceries for vanilla's meat and iron. Fixed; secondaries on rungs 1+ are now dearer by the rung's input
ratio, which touches every book's secondary adoption against the measured baselines.

**Open.** (1) Motor's ruling above. (2) The systematic "+1" of the four-method industries (a game-era-3 technology gating a t2 rung in six
industries, a game-era-4 one gating t3 in eight): the tolerance accepts it and vanilla's tree forces it; closing it would mean ERA_MOVES
on vanilla technologies (out of scope, "with techs fixed"). (3) Munition's percussion caps at t1 (the gap rounds up) rather than t0 — the
2026-09-04 ruling, kept. (4) Electrics' research mark moves with its tier: 75,000 trade-centre workers (the t2 mark) instead of 25,000.

### §10.78.1 — The two rulings of the evening, and the canon (user-ruled 2026-09-13, "Canonize the outcome config")

**Motor: option B.** The user asked for the tier-by-technology-era matrix under both readings, as full tables and then as aggregates
(a cell = how many rungs of that tier are gated by a technology of that game era), leaned to B, and after the producer/consumer check
below ruled it. Motor is placed by the rule alone at **[0, 2, 3]**: atmospheric engines t0, electric engines (electric_railway, game era 4)
t2, diesel (compression_ignition, game era 5) t3 — no rung below its technology's era, an empty t1, and the minted high_speed_diesel
addition DROPPED (compression_ignition, a tech-era-5 technology, is the 1940 rung; the addition had no slot). The book is **56 buildings, 182
technologies (3 minted)**. **Munition: [1, 2] confirmed** ("earliest munition is t1"), which is what the derivation gives.
⚠⚠ **CORRECTED 2026-10-01: "placed by the rule alone" is wrong for motor.** atmospheric_engine is GAME ERA 2, which the rule rounds UP to
t1, so the derivation gives **[1, 2, 3]** (no overflow, no bump); [0, 2, 3] exists only through the explicit `motor` entry in
`tools/lib_tier4_spec.mjs`'s PLACEMENT, i.e. the first rung sits one tier BELOW its technology's (−1, inside the tolerance). Nothing about the
book changes; the wording does.

The aggregates that decided it (rows = tiers, columns = the gating technology's game era):

| option A — motor [0,1,2,3] with the addition | tech era 1 | 2 | 3 | 4 | 5 | rungs |
|---|---|---|---|---|---|---|
| t0 (1836) | 10 | 3 | · | · | · | 13 |
| t1 (1875) | 5 | 7 | 2 | **1** | · | 15 |
| t2 (1905) | · | 6 | 6 | 3 | **1** | 16 |
| t3 (1940) | · | · | · | 8 | 5 | 13 |

| option B — motor [0,2,3], the addition dropped (RULED) | tech era 1 | 2 | 3 | 4 | 5 | rungs |
|---|---|---|---|---|---|---|
| t0 (1836) | 10 | 3 | · | · | · | 13 |
| t1 (1875) | 5 | 7 | 2 | · | · | 14 |
| t2 (1905) | · | 6 | 6 | 4 | · | 16 |
| t3 (1940) | · | · | · | 8 | 5 | 13 |

B empties the two cells that were motor alone (a t1 rung on a tech-era-4 technology, a t2 rung on a tech-era-5 one). What stays off the
diagonal in both is vanilla's front-loading: five tech-era-1 technologies gate t1 rungs, six tech-era-2 technologies gate t2 rungs, eight t3 rungs
sit on tech-era-4 technologies. Nothing below tech era 4 gates a t3 rung.

**The producer/consumer check that preceded the ruling (FINDINGS F112).** Dating every consumer of every tiered good by its gating
technology's game era (pop needs, all 115 vanilla buildings' methods including our buildings' secondaries, our rungs' inputs, the 18
unit types' upkeep), the largest gap between a producer and its first consumer is **steel, 14 narrative years** (steelworking, held at
the start, against tooling's steel tools on mechanical_tools, game era 2) — nil in play for the leaders, whom vanilla's 1836 grants hand
mechanical_tools (F54). Every other tiered good has a consumer in the same tech era as its first producer; the reverse direction is empty (all
131 rung-input pairs have a producer in the same tech era or earlier). Identical under both motor options, since motor neither makes nor
consumes steel and engines' first consumer (the shipyard's complex shipbuilding, tech era 2) sits on the same tech era as motor's first rung.

**What the canon is now.** `config/mod_config.json` = `canon4v-hai3` regenerated: the tier rule (§10.78), motor B, munition t1; A 2.0 /
B 1.5, cost ×2^tier, ai_value 1,000×3^tier on all 17, divisor 0.000125, the §10.75 defines, the 60-month bar. Every live book (canon-je24,
canon-je24-a22, canon-flat-in12/13, the two test books) regenerated from the same structure. The book F106/F107 measured is commit
880f098's copy; the tier-keyed motor-A state of the afternoon is commit c18234c's. Consequence for the research entries: motor's t2
(electric engines) takes the t2 mark (75,000 workers in the predecessor rung, motor t0) in place of the t1 mark.

## 10.79 — THE HOARD IS A PROBLEM IN ITSELF, THE CAPITAL-ABUNDANCE FLAG, AND THE UNDER-SIDE RULE (user-ruled 2026-09-15); the cost-slope sweep read, and the next session's three 2+1 configurations

**The three rulings, in the user's words (2026-09-15).**
1. *"I'm reasonably sure that hoarding is a problem by itself that should be tuned by spending eagerness defines. It seems that they
   are not the main lever you iterate, but significant hoarding (more than 1 yearly world product) can spoil all measurements, and
   we're aiming at levels lower than vanilla, better to fix that sooner than later."* — The hoard is the investment pool ÷ GDP; the
   aim is BELOW vanilla's n=16 median (0.29 world / 0.35 on the GBR+USA+FRA+GER shortlist); a pool above a year of world GDP voids
   the other readings of a batch.
2. *"Split unemployment (it includes peasants, right? It must) into world and shortest-list as well. Basically, as situation of
   complete capital abundance (total unemployment under 3%, hoard over 2 GDP), if not confined to minors, invalidates the config more
   or less, it just shouldn't happen. More than that, it distorts the economy a lot, and other metrics' readings from this config
   become heavily unreliable as well."* — THE CAPITAL-ABUNDANCE FLAG: total unemployment INCLUDING peasants = (unemployed + peasants)
   ÷ (salaried + unemployed + peasants); a shortlist member under 3% with a hoard over 2 GDP trips ⚑, the pooled shortlist tripping is
   a VOID. `tools/testbed/ledger/capital_flags.mjs` (exit 4 = void) runs in every write-up beside `alignment_check.mjs`. Measured at
   1935: the flat A 1.9 pair is VOID (0.3–1.0% at a hoard of 3.1–3.3); C 1.6, the ×1.3 lift and one C 1.9 seed trip it for Britain
   alone (vanilla's own Britain does in 2 of 16 seeds).
3. *"Note that more aggressive spend of investment pool money will increase the economy and thus depeasantation. So ceteris paribus,
   the other parts of the config (A/B/initial input penalty/cost_ladder) should be taken from the side that gave values slightly under
   the GDP/depeasantation target, not at the target."* — THE UNDER-SIDE RULE: the eager-spending defines go on a base that reads
   slightly under the band, never on the found configuration itself.

**The sweep, read (F113 / F115–F121; the session table is F123).** On the lifted A 2.2 / B 1.5 book the cost slope C
(`make_ab_config --cost-ratio C`, building_cost = anchor × C^tier) is the loop's gain: flat and C 1.6 run away (1.8–1.9× vanilla GDP,
rung 0 dead or thinning, the majors' labour emptied), **C 1.9 lands** (1.09 / 1.07 / 1.13 / 1.04× across four seeds with workers per
capita 0.64–0.70×, both bands, F117 + F120 — `canon-c19-in12` is the found configuration), C 2.05 and 2.2 stall (0.65–0.74×). The
×1.3 lift is closed (a runaway at 1.9, F118; a stall at 2.05, F119); halving rung 0's construction desire changes nothing (F120);
the eager-spending defines on the under-side slope C 2.05 give a bistable configuration (F121: 0.56 / 0.37 / 1.32×, two stalls
locked in by early British disasters, one growth seed whose hoard returned at 0.83 world / 1.31 shortlist). What the defines do,
in 3 of 3 seeds: the private construction backlog 2.0–2.4 → 1.1–1.3 years and the government backlog 2.8–3.0 → 0.9–1.6 years.
What they cannot do: hold the pool where the economy grows — in the growth seed the pool held five to six years of the private
queue's spend (inflow ≈ £1.1–1.3B a year against £0.8–1.0B of construction), so the sector would need to be a third larger than the
AI builds at its most eager, or the inflow a quarter smaller. ⇒ **The hoard's lever past this point is a balance change and needs a
ruling**: the construction sector's throughput per level or goods per point, or the pool's inflow (the laws'
`state_<pop>_investment_pool_efficiency_mult` / `_contribution_add`, ±0.25 to ±0.75 today).

⭐⭐ **RULED 2026-09-15 (the same evening the question was put): BOTH BALANCE-SIDE HOARD LEVERS ARE REFUSED, ON SCOPE.**
The user, in full: *"touching the construction methods is something I strongly want to avoid. Going into pool efficiency modifiers
by laws is completely out of the scope, no way this mod goes into this, we're a bit overextended already."* So the two candidates the
arithmetic above identified — the construction sector's throughput per level or goods per point, and the laws' investment-pool
contribution modifiers — are **closed, and are not to be re-proposed**. (The private-allocation share is a law modifier too,
`country_private_construction_allocation_mult`; it falls under the same refusal.)

⇒ **What remains in scope for the hoard, in full:**
1. **The AI define family, at the one value it has never actually held — `TOO_LARGE_INVESTMENT_POOL_FACTOR` 0.99** (L33: the batch
   that was meant to test 1.0 ran at vanilla's 0.75). `canon-c19-in12-eager` measures it. This is the LAST untried define: the
   coverage define was ruled out 2026-09-05, the update divisor is not the bottleneck (2,100–2,300 items already queued), and the
   other three are measured (a queue lever, 3 of 3 seeds).
2. **The configuration's own economics** — the cost slope C, A/B, the lift — which move the pool INDIRECTLY, by changing how much
   surplus the economy generates and how fast the frontier absorbs it. That is what the sweep is already doing, and it is what the
   **under-side rule** (same ruling day) exists for: take the other settings from the side that reads slightly under target,
   because faster spending raises GDP and depeasantation.

⇒ **And if 0.99 does not hold it: the hoard becomes an ACCEPTED, DOCUMENTED RESIDUAL of the configuration, not a target.** Do not
spend a further batch on it. It keeps its role as a **void criterion** — the capital-abundance flag (a shortlist member under 3%
total unemployment including peasants with a hoard over 2 GDP; the pooled shortlist tripping voids the configuration) is a gate on
results, and needs no lever to work. Report the pool ÷ GDP every batch and say plainly that it sits above vanilla's 0.31.

⚠⚠ **L33 — THE EAGER SET RAN AT THREE OF ITS FOUR LEVERS, AND THE FOURTH RAN BACKWARDS (found 2026-09-15, corrected in F121).**
The set raises `MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR` from the canon's 0.9 to **1.0** — the cap vanilla's own
comment in `common/defines/00_ai.txt` names (*"capped at 1"*). **The engine's validator excludes 1** (`Must be between 0 (included) and
1 (excluded)`), discards the value, and the key keeps **vanilla's 0.75** — below the very book the arm is a one-lever test against. Every
F121 run carries the rejection line; the non-eager books (0.9) carry none. So the "⇒" above is stated one value too early: the define
family is **untested at its cap**, not spent, and `canon-c19-in12-eager` regenerated at **0.99** (the highest the validator accepts, +32%
on what actually ran) is what decides it. Every unrun eager book was regenerated at 0.99; `canon-c205-in12-eager` stays at 1.0 as F121's
own record. A second, accepted residual of the set: the land CRITICAL at 1.25 invalidates VANILLA's ship `EXCESSIVE_THRESHOLD` of 1.05,
a define no book of ours sets — naval only, identical across the eager arms, and what the engine then holds for it is not known.
⇒ **Do not spend the balance-side ruling on the strength of F121 alone.** Landmine **L33** now gates both halves (the config's
`ai_defines` against the bounds the engine has stated, and any run's error log for `defines.cpp`'s rejection line).

⭐⭐⭐ **WHAT COUNTS AS A HOARD, AND WHAT COUNTS AS A BACKLOG — THE THRESHOLDS (user-ruled 2026-09-16, GOVERNING for every
verdict from here).** The user, in full: *"A too-long backlog is undesirable (as the queued buildings can be not needed by the
time the construction starts), but this is far from critical, unless the queue goes 3+ years. Hoarding is a bigger problem,
especially persistent hoarding (over 2 yearly GDP for the last 5 years, and doesn't decrease by at least 0.5 yearly GDP YoY
1931 onwards; or over 5 yearly GDP overall). However, hoarding AND inability to invest (mostly because of the full employment)
is a strong negative verdict, and not only on the config itself, but also on most other deductions (as this distorts the
economy)."*

| test | threshold | consequence |
|---|---|---|
| **BACKLOG** | 3+ years of construction queue | undesirable below that and NOT a fault — queued buildings may be unwanted by the time they start, which is a cost, not a defect. At 3+ years, a real concern. |
| **PERSISTENT-A** | pool > 2 yearly GDP in each of the last five years, AND not falling by ≥ 0.5 GDP year on year from 1931 | persistent hoarding — a bigger problem than any backlog. A pool over 2 that IS draining at that rate is not this. |
| **PERSISTENT-B** | pool > 5 yearly GDP at any point | persistent hoarding, on the level alone. |
| **ABUNDANCE** | hoard > 2 GDP **and** total unemployment incl. peasants < 3% | ⚑⚑ **THE STRONG NEGATIVE VERDICT**: hoarding it CANNOT invest. It condemns the configuration **and most deductions drawn from it**, because the economy is distorted — so a run that trips it cannot be quoted for prices, tier choice, obsolescence or anything else. Shortlist-wide ⇒ VOID. |

⚠⚠ **THE IMMEDIATE CONSEQUENCE, AND IT REFRAMES THE WHOLE 2026-09-15/16 HOARD THREAD: THE STANDING CONFIGURATION DOES NOT
HOARD.** `canon-c19-in12` reads a world pool peaking at **0.43 and 0.67** of GDP and a shortlist at **0.66 and 1.59** — an
order of magnitude inside PERSISTENT-B and never near A's five-year window. Its private backlog of 2.0–2.4 years sits under
the 3-year line. **By these thresholds it has no hoarding fault at all**, and the 2026-09-15 aim of *"a pool below vanilla's
0.29"* is a PREFERENCE, not a gate. What DOES trip the tests is the runaway family: the flat-cost book (F110) reads world
**2.28** rising with all five last years over 2 (⚑A) and a shortlist peak of **8.04** (⚑A ⚑B). The ×1.3 lift at C 1.9 (F118)
does NOT trip either test (world 1.10, shortlist rising to 2.61 but its five-year window is not all above 2) — so it is a
concern on other grounds, not a hoarder by this definition.
⇒ Report pool ÷ GDP every batch as a READING; call it a fault only when a test above fires. Do not re-open the hoard as a
tuning target: the levers are exhausted (§10.79's refusal, plus F125 — the only in-scope lever that holds the pool cannot
leave a readable configuration), and by these thresholds the configuration it would be tuning is already clean.

**Implemented** in `tools/testbed/ledger/capital_flags.mjs`, which now prints a PERSISTENT HOARDING block over each run's
whole yearly series (peak and year, the last five years, ⚑A / ⚑B) beside the single-year abundance verdict, and still exits
4 on a shortlist-wide abundance trip. Proven on the day: the flat-cost arm trips ⚑A/⚑B, the ×1.3 lift and the standing
configuration do not.

**The old rung on the found slope (F122).** Its level count rises 12–18% from 1900 to 1935, but front-loaded (1900–1920, flat after
1930), its staffed levels FALL by a fifth, half or more of the added levels are NEW buildings in fresh states placed by countries that
already hold the frontier (229 of 245, 287 of 304), and by 1935 rung 0 is 1% of either queue — expansion below 80% staffing is
forbidden by `PRODUCTION_BUILDING_LOW_EMPLOYMENT_THRESHOLD`. So after 1920 the old rung persists on a positive margin; it is not
rebuilt. The last willingness lever on the placements is the scoring's noise (`PRODUCTION_BUILDING_RANDOM_FACTOR` 10, ×2 for the
private pool), next on the ordered list of 2026-09-03 after the ai_value ladder.

**The next session's three 2+1 configurations (prepared 2026-09-15 evening, each generated by `make_ab_config` with its `_ab.command`
recorded, field-diffed against its base, dry-run built clean; schedules `_n2.json` + `_tb.json` in `tools/testbed/schedules/`):**
1. **`canon-c19-in12-eager`** — the eager set on the found slope: reads what the defines do where every seed grows (the backlog and
   sector predictions stand; the pool is expected to follow growth; GDP may exceed the band — F121's growth seed reached 1.32×).
2. **`canon-c195-in12-eager`** — the under-side rule on the sweep's own axis: cost × 1.95^tier (600 / 1,170 / 2,282 / 4,449) with the
   eager set, short of the C 2.05 cliff; the branch book `canon-c20-in12-eager` (× 2.0^tier) is generated for the case that both eager
   slopes overshoot.
3. **`canon-c19-in12-eager-sharp` / `canon-c195-in12-eager-sharp`** — on whichever base read in the band: the government AI's
   construction noise halved (RANDOM_FACTOR 10 → 5), the private pool's noise quartered with it (its mult 2.0 → 1.0), the pool's
   profit weight 1.5 → 2.5. Key prediction: below-best under 22% (the sweep 30–38%), fewer than 150 new rung-0 buildings 1900 → 1935
   (245 / 304), rung 0's 1935 level count at or below 1900's. Willingness only — no gate, cap or removal.
The order and the branch rules are in HANDOVER.md; the run-level stop, the capital flag and the 2+1 alignment apply to every batch.

## 10.80 — THE SIX-RUNG LADDER IS CLOSED FOR GOOD, AND THE REASON IS THE UI, NOT THE ECONOMICS (user-ruled 2026-09-16)

**The user, in full:** *"We likely won't return to the six-rung for UI bloat reasons, even if it worked not that bad
mechanically. If it is still listed as main/canonical somewhere, it's a mistake, fix now."*

So the six-rung ladder is a **CLOSED line, not a dormant alternative**. Two things follow, and they pull in opposite
directions, which is why both are written down:

- **It is not a failed design.** It worked acceptably in mechanical terms, and the record of what it measured stays
  valid on its own terms (§10.65's inverse solve, the illogicality campaign, the solver-2 book). Nothing in this
  ruling retracts a six-rung measurement; it retracts its FUTURE.
- **The binding constraint is the balance UI.** The sheet renders a row per rung per industry, and at six rungs over
  twenty-two industries it stops being readable — which is a real cost, paid on every tuning pass by a human, against
  a mechanical gain that four rungs already capture. A design nobody can read is not a design that ships.

⇒ **Nothing may describe it as the canon, the shipped book, or the current method.** Corrected in place on the day:
CLAUDE.md's "TWO CANONS" heading (now "THERE IS ONE CANON…", with the old heading kept below it as history), the list
line that still equated the six-rung book with `config/mod_config.json` (it has been
`config/mod_config.six_rung.json` since 2026-09-05), the clause saying `mod/` "follows the six-rung config until
ruled otherwise" (void since 2026-09-05 — `mod/` and the deployed copy follow the canon), the "THE SHIPPED BOOK IS
THE SOLVER-2 CONFIGURATION" heading, and "THE FIVE-ERA LADDER (current method)". Two surviving mentions are
deliberately kept and made explicitly past-tense, because they are statements about what a tool read or what a book
measured AT THAT DATE, not claims about now.

⚠ **What is NOT removed.** `config/mod_config.six_rung.json` + its tree twin stay in the repo, un-ignored, and the
six-rung machinery (`build_era_ladder` / `era_solver` / `era_scenarios` / `era_tech_sync` / `payback_census` /
`vanilla_payback_census` / `verify_pms` / `tech_tree_spec --write`) still runs under
`MOD_CONFIG=config/mod_config.six_rung.json` and still THROWS on a four-rung book without it. That guard is what stops
a `--write` rewriting the four-rung canon as if it had six tiers, so it protects the CANON and must stay.

## 10.81 — A CONDITIONAL CONSTRUCTION WEIGHT IS EXPRESSIBLE, COSTED, AND DELIBERATELY UNUSED (recorded 2026-09-16)

Recorded because the question was asked and answered, and the answer should not have to be re-derived. **Defines are
initialised once and are global**: `NAI` values load at game start, are constant, and apply identically to every
country for the whole century. So the spending thresholds of §10.79 cannot express *"build more construction only
where it can be applied effectively"* — they can only say always or never, which is exactly why raising them
destabilised the economy (F125).

**But that conditionality already exists in the mechanism they override.** `MONEY_SPENDING_CONSTRUCTION_*_THRESHOLD`
are ratios of actual-to-**WANTED** construction, and "wanted" is computed per country from its own situation. Vanilla's
rule therefore already reads *build more when you need more, stop when you have enough*; moving EXCESSIVE from 1.05 to
3.0 did not make the AI judge better, it told it to ignore the "enough" signal until it held triple. ⚠ There is **no
define for land "wanted construction"** — the only `WANTED_*` construction defines in the game are the two naval ones
(`SHIP_CONSTRUCTION_WANTED_SHIPS_TO_BUILD_COST_FACTOR`, `..._BUILT_SHIPS_COST_FACTOR`). Raising what they want is not
available; only disabling the brake is, and the brake is load-bearing.

**The genuinely conditional lever is an AI STRATEGY, not a define.** `building_group_weights = { bg_construction = X }`
sits inside an `ai_strategy`, and a strategy is selected per country by its `possible` block — vanilla uses this itself
(`ai_strategy_placate_population` weights `bg_construction = 0.5`). We already own the emission path for
`01_admin_strategies.txt` (§ the AI-subsidy-policy convention), and **F64/F65 measured that AIs DO re-pick strategies
mid-campaign when `possible` flips** (11 countries on a variant at 1900 → 67 by 1936). So a mutually-exclusive strategy
pair gated on a country-state trigger — mechanically identical to the port subsidy's retire/exempt variants — could
weight construction up only while a country has profitable industry to point it at.

⇒ **NOT BUILT, and not to be built for the hoard.** The 2026-09-16 thresholds (§10.79) say the standing configuration
has no hoarding fault at all, so the motivation has evaporated; and this session's own evidence says the brake is doing
useful work — it is what holds four seeds inside 0.09 of GDP ratio where removing it spread five seeds over 0.37–1.45.
This section exists so that a future need finds the shape already costed, not so that the next session builds it.
⚠ It would also re-open the file the same day's fix stopped us owning — see §10.80's neighbour, the conditional
emission guard: any book that sets `building_subsidies` or `subsidy_conditional` owns a 655-line vanilla file again.

## 10.82 — THE THREE RULINGS OF 2026-09-16 EVENING: the mid-game dip is EXPECTED, a PLATEAU in a major is the fault, and the workers-per-capita ceilings that open the A axis (user-ruled 2026-09-16; the four-batch plan re-ordered on them)

**The questions put** (from the four-batch plan of the same day — HANDOVER.md, FINDINGS F127): whether the found configuration's 1890–1910
dip is a fault; whether its unemployment is; and whether the workers-per-capita band centred on 0.634× vanilla is a design goal that forbids
a smaller output step (A). **The user, in full:**

1. *"The mid-game dip is not only acceptable, it's expected to happen in the era where the countries have already acquired the techs for
   newer PMs but haven't yet built them (as in vanilla they don't have to build, they just switch)."*
2. *"5-9% in majors is borderline. However, if it's exacerbated by plateauing (say, 5-9% since 1919), then it's definitely unacceptable, at
   least if widespread. An occasional fully depeasanted major in 1930 (especially a "tall" high tech major like BEL or NET or at least GBR)
   is tolerable, but the median should not see depeasantation even in majors, and shouldn't plateau in any major. On the other hand, having
   some minors hoarding and depeasanted is not that problematic, and vanilla tends to do this even more often than the majors (we don't
   follow the vanilla in this, but this is just how this all works, and fighting it in minors is not worth it)."*
3. *"I'd aim for at most 0.8 for top majors. However, 0.9 on average in the world is tolerable. Above that -- hardly so."*

**What follows, and what it changed the same evening.**

- **Ruling 1 — the dip is the premise showing.** `canon-c19-e2soft` (the t2 rung's cost alone lowered to fill it) is **DROPPED** before it
  ran; the book, its twin and its schedules stay in the repo as the record of the proposal and of this ruling. The 0.75 / 0.89 at 1900 is not
  a fault to tune, and no future batch should aim at it. It stays a READING in every verdict (the decade series), never a target.
- ⚠⚠ **THE PARAGRAPH BELOW OVER-READ RULING 2 AND WAS CORRECTED BY THE USER ON 2026-09-17 — §10.82.1.** A plateau is CAPITAL ABUNDANCE
  PERSISTING at the last few percent of peasants and job-changers, not slow depeasantation; the "found configuration fails" verdict
  below is RETRACTED (it does not), and the USA / Russia readings are development readings, not plateaus. Kept as the record of the
  misreading; the corrected test is §10.82.1's.
- **Ruling 2 — THE PLATEAU TEST, a standing read on every batch from here.** The agent's operationalisation (stated as such): over
  1919 → 1935, per major (GBR FRA USA GER/PRU RUS AUS; NET BEL as the "tall" cases; JAP reported but excused, since vanilla's own Japan
  sits at 40–57% strict unemployment in every seed), **a major PLATEAUS when its strict unemployment stays above 5% while its peasants'
  share of the workforce falls by fewer than 8 points.** Unacceptable when WIDESPREAD (two or more majors in both seeds). A fully depeasanted
  Britain / Belgium / Netherlands is tolerable; the MEDIAN major must not be depeasanted; minors are not judged.
  ⚠ **The found configuration fails this as read on its two seeds** (scratch `major_series.mjs`, the yearly summaries): the **USA plateaus in
  both** — strict unemployment 11.1 → 12.8% and 12.3 → 14.3% with peasants 61 → 55% and 60 → 55% — and so does **Russia** (42–54%, peasants
  70 → 73% and 65 → 61%); France in one seed (30 → 34%, peasants 56 → 46%). Vanilla's USA over the same years: 11.6 → 7.4% with peasants
  57 → 46, 8.8 → 2.1 / 58 → 33, 6.3 → 6.5 / 31 → 13 (runs 1, 5, 9) — it absorbs 11–25 points of peasants where the found book absorbs 5–6;
  vanilla's Russia stalls in one seed of three (68 → 66 at 32%). The median major at 1935 is nowhere near depeasanted on the found book
  (GBR 1 / 8%, FRA 46 / 23, USA 55 / 55, PRU-GER 11 / 39, RUS 73 / 61, AUS 19 / 21, BEL 7 / 8, NET 28 / 25) — goal 4 holds; the fault is the
  OPPOSITE one, stagnation, and it is exactly F127's diagnosis (a tiered sector employing 36–40M where vanilla's employs 71–73M, a raw sector
  at 59–69% of vanilla's). So the labour-absorption batches carry the plateau test as a KEY prediction: **the USA's peasant share falling ≥ 10
  points 1919 → 1935 with its strict unemployment ≤ 10% at 1935, and at most one plateaued major (Japan excused) per seed.**
- **Ruling 3 — THE WORKERS CEILINGS.** Productive workers per capita ÷ vanilla: **≤ 0.8 for the top majors (the aim), ≤ 0.9 world (tolerable),
  above that not.** The found configuration reads 0.65 / 0.67 world and 0.71 / 0.72 on the GBR-USA-FRA-NET-BEL-PRU-GER shortlist
  (`first_run_decomp`), so the A axis is OPEN within those ceilings: a smaller output step at the same gain per construction point puts more
  frontier levels and more workers behind each pound of GDP. The 2+1 rule's workers band (0.55–0.72, F114) is NOT re-centred by this ruling —
  it stays the alignment criterion; the ceilings are a verdict criterion on top of it, read on the shortlist AND the world.

**The plan as it stands after the rulings (nothing else changed):** batch 1 = `canon-b18-gm` (B 1.8 gain-matched — the design's own price
channel and the raw sector's weight; rung 0 untouched), LAUNCHED 2026-09-16 21:55 local as `20260916_215513_canon-b18-gm-n2`, its plateau
predictions pre-registered in the session's `RULING_ADDENDUM.md` before any result existed; batch 2 = the A axis gain-matched —
`canon-a19-gm` (A 1.9: `--cost-ladder 1.38,2.22,3.68`, value added per frontier level 0.73 / 0.61 / 0.54 of the found book's) or the
milder `canon-a20-gm` (A 2.0) if batch 1 already lifts the shortlist's workers toward 0.8; batch 3 decided by 1–2 (the second step, the
A × B combination, or the cost branches); batch 4 the pick's confirmation pair for the canonisation decision.

## 10.82.1 — THE PLATEAU TEST, CORRECTED (user, 2026-09-17 morning): a plateau is capital abundance persisting at the last few percent, not slow depeasantation

**The user, in full (2026-09-17 ~07:35 local), on reading the 2026-09-16 operationalisation:** *"I think we might have overdone this on the definition of plateauing. What I meant is that the failure to get rid of last several percent of peasants (e.g. due to new ones constantly immigrating or a tiny share of factories shedding workers who do find jobs later, but not instantly) doesn't change the broader negative 'capital is abundant, this is broken' criterion. Having a local fiscal crisis that stops depeasantation at 20% stable between 1925 and 1935 is NOT plateauing by this definition."*

**What ruling 2 means, then.** The "5–9% since 1919" of the ruling is the FRICTIONAL RESIDUAL — a major that has absorbed its peasants
down to the last few percent (immigrants arriving, a few factories shedding workers who find jobs later, but not instantly) and sits
there for fifteen years while its pool holds more than two years of GDP. That major is capital-abundant, and the residual does not
rescue it from the abundance verdict (§10.79: "hoarding AND inability to invest … a strong negative verdict"): the abundance flag's 3%
line is not one to hide behind at 6%. Widespread = unacceptable; one tall major (BEL, NET, GBR) at vanilla's own extreme is a flag, as
before. A major whose absorption STOPS at 20% peasants — a fiscal crisis, a poor economy, an under-built frontier — is NOT a plateau in
this sense: that is a development reading, judged by the GDP and workers bands, never by this test.

**The corrected operationalisation (the agent's, stated as such):** PLATEAU(major) = total unemployment INCLUDING peasants ≤ 10% in
EVERY year from 1919 to 1935 (the residual, never cleared and never re-filled) AND the pool ÷ GDP > 2 in any year of 1931–1935 (capital
abundant). Shortlist members only (GBR, USA, FRA, GER / PRU); two or more in a seed = widespread. `capital_flags.mjs` prints it as
PERSISTENT ABUNDANCE beside the single-year abundance flag; `major_series.mjs` prints the per-major series it is read from.

**What it retracts.** The 2026-09-16 operationalisation ("strict unemployment above 5% while the peasant share falls by fewer than 8
points") measured SLOW DEPEASANTATION — the opposite case. The USA at 55–65% peasants and Russia at 60–73% on the found configuration
are under-absorbed, not capital-abundant, and neither is a plateau. So: **the found configuration `canon-c19-in12` does NOT fail the
plateau test.** Its one reading of the kind is Britain in seed 1 — 0.8% total unemployment including peasants at a hoard of 2.40 at
1935, reached only around 1925 (32 → 18 → 5 → 1% peasants over 1900 → 1930) — the single-year abundance flag vanilla's own Britain trips
in 2 of 16 seeds; tolerable by the ruling's own words. **F128's "three plateaued majors per seed" on `canon-b18-gm` is retracted the
same way**: under the corrected test no major plateaus in any of its three seeds (shortlist hoards 0.14–0.45, the capital flag CLEAN);
what stands there is the stall, the price channel, the untouched old rung, and the USA's labour absorption in two seeds of three
(peasants 65 → 53 and 44 → 12) — a labour READING, not a criterion. `canon-a19-gm`'s KEY 2 was re-labelled the same way before its
run 1 landed (the repo copy of its schedule carries the note; the session copy is the frozen original).

**Where the over-reading was written and is now marked:** this section's ruling-2 paragraph (kept as the record, with the pointer
above it), HANDOVER.md, CLAUDE.md's `major_series.mjs` and `canon-a19-gm` entries, FINDINGS F128 (a correction note appended), the
two `canon-b18-gm` sessions' VERDICT.md / RUN1_READ.md / RULING_ADDENDUM.md (notes appended), the b18 ledger (republished at the same
URL with the sentence corrected), and the memory.

**Implemented and proven both ways (2026-09-17 07:55 local):** `capital_flags.mjs` prints the PERSISTENT ABUNDANCE block (per shortlist member: the years at or under 10% total unemployment including peasants over 1919–1935, the late hoard maximum, ⚑ PLATEAU when every year is under the line and the pool exceeded 2 GDP in 1931–1935; two members = WIDESPREAD). The found configuration reads NONE (Britain in seed 1 is under the line 15 of 17 years with a hoard of 2.40 — the single-year flag, not a plateau); `canon-b18-gm` reads NONE in all three seeds; the flat A 1.9 pair (F115, the measured VOID) reads ⚑ PLATEAU GBR + USA and GBR + GER + USA — WIDESPREAD, every year of the window under 5% with hoards of 3.2–9.0. That is the "capital is abundant, this is broken" case the ruling names, and nothing else trips it.


## 10.83 — THE CRITERIA REGISTER: AIM / SOFT BOUNDARY / HARD BOUNDARY, PER SCOPE — ONE RULE SET FOR THE CONFIG ITERATOR AND THE BATCH REPORT (user-ruled 2026-09-17 midday; supersedes the operational criteria of §10.79, §10.82, §10.82.1 and the capital-abundance flag)

**The ruling, verbatim (the user, after "that's a mess" on the two-scope table of the criteria then in force):**

> All right, the new rulings.
> Split into
> 1) the aim, to which we are trying to get with iterating config options
> 2) the soft boundaries, going beyond which is not acceptable, but which do not break the game and thus readings from these runs can be taken in full
> 3) the hard boundaries, going beyond which breaks the economy and only allows for a binary failure as a recorded outcome: "broken by stall" or "broken by runoff"
>
> In the future, I want you to use these as the framework to find optimum solutions on the config, trying to quantify and reason on which config changes lead to what outcomes.
>
> Your "T" must be decomposed into T0, T1, T2 and T3. Ensure that the industries that don't have early game options (e.g. automobiles) start at later tiers, don't count towards T0 share.
>
> I intend to have this as a unified rule set for the iterator and the report, so if I missed anything important that you suspect isn't superceded by another point, highlight this and we'll discuss. I'm specifically concerned about not monitoring prices, but I can't find concise wording that will align with the intended price direction but will allow for certain divergences.
>
> For the shortlist, unless specified explicitly, the conditions are measured on the pool taken together, not on individual countries.
> Unless specified explicitly, the conditions concern 1935-1936, or at least 5-10 last in-game years, they're about END STATE, not the path to it.
>
> The hard boundaries are checked on individual run level, everything else -- on "consensus" (median of two runs if there are two in total, or of two aligned ones if the first and second runs diverge).
>
> Conditions themselves, shortlist:
> W for the shortlist: aim at 0.6-0.7 of vanilla; soft boundary -- > 1.0 of vanilla
> U* for the shortlist: aim at 2+ of vanilla; soft boundary -- < 1.0 of vanilla; hard boundary -- under 10% collectively; hard boundary -- under 5% and not rising above that in 1926-1935 for any individual country that's at least 50 million population and isn't in the state of civil war
> H: aim at <1 of vanilla; hard boundary -- over 5 of vanilla for any individual country that's over 50 million population; hard boundary -- over 3 of vanilla for any individual country each year between 1931 and 1936, and not declining by at least 0.5 of this country's yearly GDP on average (for simplicity, the decline must be 2.5 of 1931 GDP over the course of 5 years)
> T0: aim at it 0 in 1936, or at least a declining trajectory decade over decade past 1900s. Soft boundary -- a more than 30% increase 1935 over average of 1900-1909.
> T3: at least X% (suggest X)
> GDP: aim for high enough Y to hit about 1.1 of vanilla. Soft boundary: <0.95 of vanilla, or >1.5 of vanilla. "Y" not that important by itself, but should compensate dip in W.
>
> Conditions, world:
> GDP: aim 1.0 of vanilla. Soft boundary -- not in the band of [0.75; 1.33] of vanilla
> GDP: hard boundary: 1836-1845 off vanilla not by more than 10% from 90% vanilla CI (each year, whole world combined, up to two year exceptions per run allowed)
> W: aim for [0.6-0.95] of vanilla. Soft boundary -- >1.0 of vanilla
> U*: soft boundary -- < 1.0 of vanilla (should be higher, although no specific aim set)
> H: aim at <1 of vanilla
>
> The most important aims are world GDP in 1935, then shortlist decomposition (W*Y), then W itself, in shortlist AND the world.
>
> The levers you can use freely is the A, B, input penalty, eagerness to build (from all PoVs: ai_value; strategies; mod-level static constant), build cost. What stays: anchor of 1836 where possible, except input penalty; everything else in the game.

### 10.83.1 — The register as implemented (`tools/testbed/ledger/criteria.mjs`)

**Scopes.** The SHORTLIST is the pool **GBR / USA / FRA / NET / BEL / PRU / NGF / GER** (the three German tags are one state at three
stages; NGF was in no pool until 2026-09-17, when it was added to every pooled script — it stands at 1935 in 1 of 16 vanilla seeds), read
TOGETHER unless a line says "individual country"; the WORLD is the save's own world totals. **Quantities** (every ratio is to the vanilla
per-run MEDIAN of the same scope and window, n=16 — `20260821_131149_vanilla-baseline-n16`):

| symbol | quantity | exact definition |
|---|---|---|
| GDP | world GDP; the pool's GDP | the save's `world.gdp`; Σ `gdp` over the pool |
| W | productive workers per capita | (salaried − government − military workforce) ÷ Σ strata population |
| U* | total unemployment INCLUDING peasants | (unemployed + peasants) ÷ (salaried + unemployed + peasants); peasants = `population_subsisting_workforce` × 100,000 |
| H | the hoard | investment pool ÷ GDP |
| Y | productivity | GDP ÷ productive workers, so W × Y = GDP per capita (the decomposition) |
| T0 … T3 | workers in the tiered industries' rungs BY TIER | Σ over building types of staffed levels × per-level employment × workforce_mult, keyed by the rung's tier from the run's own config (`build_state.json → mod_under_test.built_from_config`); an industry that starts at t2 (automotive) contributes nothing to T0 — the tier rule, never the rung index |

**End state.** The mean over the last five yearly summaries, **1932.1.1 … 1936.1.1** (`--end`), with the 1935 point printed beside it
for continuity with F117–F129, unless a line names its own years. **Hard boundaries are checked per run; everything else on the
CONSENSUS**: the median (mean) of two runs; with three, the two closest on world GDP (the aligned pair) and the third set aside; with more,
the median of all. **A big country** is one whose Σ strata ≥ 50M in the years the line covers.

| SHORTLIST (the pool) | AIM | SOFT boundary (beyond: unacceptable, readings taken in full) | HARD boundary (per run: broken by stall / by runoff) |
|---|---|---|---|
| W | 0.6–0.7× | > 1.0× | — |
| U* | ≥ 2× | < 1.0× | pooled U* < 10% at the end state (runoff); an individual big country, not in civil war, with U* < 5% in EVERY year 1926–1935 (runoff) |
| H | < 1× | — | an individual big country with H > 5× vanilla at the end state (stall); H > 3× vanilla in every year 1931–1936 unless its pool fell by ≥ 2.5 × its 1931 GDP over those years (stall) |
| T0 | 0 at 1936, or falling decade over decade after the 1900s (1900–09 > 1910–19 > 1920–29 > 1930–36 means) | T0 at 1935 > 1.3 × the 1900–1909 mean | — |
| T3 | ≥ X% of the tiered workers (X to be ruled; provisional 25 — see 10.83.3) | — | — |
| GDP | ≈ 1.1× (±0.05), reached through a high enough Y | < 0.95× or > 1.5× | — |

| WORLD | AIM | SOFT boundary | HARD boundary (per run) |
|---|---|---|---|
| GDP | 1.0× (±0.05) — PRIORITY 1 | outside [0.75, 1.33] | 1836–1845: world GDP outside vanilla's 90% CI (the 5th–95th percentile over the 16 seeds, per year) widened by 10% in MORE THAN TWO years (below → stall, above → runoff) |
| W | 0.6–0.95× | > 1.0× | — |
| U* | (higher than vanilla, no number) | < 1.0× | — |
| H | < 1× | — | — |

**Priorities:** world GDP at 1935, then the pool's W × Y, then W itself (pool and world). **Levers (free):** A, B, the input penalty (the
×lift on tier 0), eagerness to build (ai_value, AI strategies, the mod-level defines), building cost. **Stays:** the 1836 anchor where
possible (except the input penalty), everything else in the game. **Outcome classes:** a run beyond a HARD line records only its binary
class; the side is the breach's — a U* line or an anchor overshoot = runoff, an H line or an anchor undershoot = stall; when a run
breaches both kinds, its world GDP side decides (≥ 1.0× runoff, else stall).

**Assumptions the implementation had to make (each flagged for ruling in 10.83.3):** "of vanilla" on a per-country hoard line = the vanilla
POOLED shortlist H (0.33 in the window ⇒ the lines at 1.00 and 1.67 GDP; `--h-ref world` 0.29, `--h-ref country` each member's own
vanilla median); a civil war is not in the summaries, so a member-year whose population fell more than 15% year on year is exempt from
the per-country lines; "under 5% and not rising above that in 1926–1935" is read as U* < 5% in EVERY year 1926–1935.

### 10.83.2 — Calibration: vanilla's own sixteen seeds under the hard boundaries, and the measured books under the register

**The literal hard lines break vanilla itself.** Scored with the pooled hoard reference, **9 of 16 vanilla seeds are "broken"**; with the
per-country reference **12 of 16**. The breaches: Britain's U* is under 5% in every year 1926–1935 in **8** seeds (0.3–2.6% at most)
and Germany's in **7** (0.2–2.7%), both in 6 — vanilla's fully depeasanted tall majors; Britain's hoard exceeds 5 × the pooled vanilla
H (1.67 GDP) at the end state in 2 seeds (2.16, 2.74 GDP) and Germany's in 1 (1.75); the persistent line (> 1.00 GDP every year
1931–1936, not spent down) trips in 6. Under the per-country reference the tiny vanilla medians of France, the USA and Germany (0.05 /
0.14 / 0.08) turn hoards of 0.3–0.9 GDP into "5×". The two lines that are well calibrated as written: the **1836–1845 anchor** (0
violations in every vanilla seed, by construction) and the **pooled U* < 10%** (vanilla's lowest seed 13.7%).

**The measured books** (consensus over the usable runs; the hard column under the LITERAL lines with the pooled reference):

| book (n) | hard, per run | world GDP | pool W | pool U* | pool H | pool GDP | T0 1935 ÷ 1900s | T3 share | world W | world U* | world H |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `canon-c19-in12`, the found (2) | run 1 BROKEN (Britain: U* ≤ 4.5% 1926–35; hoard 2.25 GDP, 1.67–2.65 every year 1931–36) | 1.05 | 0.70 (aim's edge) | 1.93 | 2.82 | 1.37 | 0.64 (1900s .58 / .59 / .68 / .48M) | 25% | 0.65 (aim) | 1.43 | 1.79 |
| `canon-c19-e0ai500`, the family pair (2) | both BROKEN (Britain and Germany above 3× every year: 1.06–1.97 GDP) | 1.08 | 0.82 | 1.35 | 2.72 | **1.73 (beyond > 1.5)** | 0.34 (aim: declining every decade) | 28% | 0.66 (aim) | 1.41 | 1.93 |
| `canon-a19-gm` (2) | intact | 1.13 | 0.88 | 1.43 | 1.41 | 1.47 | 0.46 | 35% | 0.86 (aim) | 1.17 | 1.10 |
| `canon-b18-gm` (3; consensus runs 1 + 3) | intact | **0.66 (beyond < 0.75)** | 0.56 | 2.52 (aim) | 0.83 (aim) | **0.81 (beyond < 0.95)** | 1.22 | 17% | 0.60 (aim) | 1.52 | 0.69 (aim) |

What the register says about the sweep so far: the hoard aim (H < vanilla) is met by no growth book — every book at or above the world
GDP aim carries 1.4–2.8× vanilla's pooled hoard, and the only book under it is the stalled one; the found configuration is the closest
on the two priority-1/3 lines (world GDP 1.05, world W 0.65, pool W at the aim's edge) and misses the pool's GDP aim upward (1.37 against
1.1) with Y 1.95×; the A 1.9 book trades W for Y the wrong way (pool W 0.88, pool GDP 1.47 at the soft line's edge).

### 10.83.3 — Open at the ruling: what the implementation had to assume, what the register does not cover, and the suggestions

1. **The per-country U* hard line as written classifies vanilla's Britain and Germany as broken in 9 of 16 seeds** (10.83.2). Suggested
   re-calibration, for ruling: make it the CAPITAL-ABUNDANCE pair — U* < 5% in every year 1926–1935 AND the member's hoard averaging more
   than 2 GDP over 1931–1935 (vanilla: 2 of 16 seeds, Britain at 2.1 and 2.7 GDP — the extreme the 2026-09-15 flag was calibrated on); the
   found configuration's run 1 (Britain 4.5% at most, mean hoard ~2.2 GDP) would then be a broken run, which the rulings of 2026-09-15/16
   called "Britain alone at vanilla's extreme = a flag". The widespread form (two big members under 5%) still breaks 6 of 16 vanilla seeds.
2. **"Of vanilla" on the per-country hoard lines.** The pooled reference puts them at 1.00 and 1.67 GDP; the per-country one is worse
   (12 of 16). Suggested: absolute GDP-years — the level line at 3 GDP (≈ 9× the pooled vanilla H; vanilla 0 of 16, max 2.74) and the
   persistent line at 2 GDP every year 1931–1936 not spent down (≈ 6×; vanilla 1 of 16, Britain 2.39–3.06) — the §10.79 numbers, which were
   calibrated on exactly this.
3. **Prices are not in the register** (the user's stated concern). Proposed line, concise and divergence-tolerant — **PW, the tiered
   industries' outputs in WAGE UNITS**: the median over the tiered goods of (market price ÷ the market's base wage) at the end state, ÷
   vanilla's same median, in the British market and the seven-market pool (`batch_tables.mjs` prints both): **aim ≤ 0.8** (the frontier's
   goods cheaper in labour than vanilla's — the decline F97 identified as the one the engine's death mechanism reads), **soft boundary
   > 1.1** (dearer in labour than vanilla's: the price path inverted). Judged on the MEDIAN across the goods, so any single good may
   diverge either way (a fabric squeeze, a clothes glut) without moving the verdict. Shortlist scope (the two markets), consensus.
   First readings on `batch_tables.mjs`'s century-change form (the British price 1935 ÷ 1840 in wage units, arm ÷ vanilla, medians over the
   tiered goods): the found configuration ≈ 0.5 (its base wage ×2.25 against vanilla's ×1.49 — the F97 mechanism), the A 1.9 pair ≈ 0.9 with the
   goods split either side of 1 (tools 1.26×, glass 1.05×, dye 1.10× dearer in labour than vanilla's; steel 0.74×, clothes 0.76×, small arms 0.41×
   cheaper): the proposed line separates the two books the way F129's price-channel reading did, and it says the A 1.9 book's obsolescence
   pressure in labour terms is vanilla's, not the design's.
4. **X for T3.** The found configuration reads 25% of the tiered workers in t3 rungs at the end state, the family pair 28%, the A 1.9
   pair 35%, the stalled B 1.8 book 17%. Suggested **X = 25** — the level the in-band books already hold, so the line separates a stall
   (17%) from the family without rewarding the runaway; vanilla's equivalent (the share of levels on the top vanilla method) is not
   yet measured and would make a better anchor.
5. **Civil war** is not in the save summaries; a > 15% year-on-year population fall stands in for it. A proper flag needs the events
   telemetry or a save field.
6. **The run-level stop** (a run above 1.3× vanilla's 1936 GDP ends the config) is a batch-flow rule, not a criterion; suggested: keep it,
   at the world SOFT top (1.33×, at 1936). **The F114 bands** stay only as the DIVERGENCE test that decides a third run; their TARGET
   semantics are superseded by the register's aims. **Row P** (the +10% play-time budget) stays as its own standing constraint outside
   the register. **Below-best tier choice** (F75) and the old rung's margin ladder are mechanism diagnostics, not criteria; T0 carries the
   old rung's death.
7. **The end window** is implemented as the 1932–1936 mean; the ruling allows 1935–36 or the last 5–10 years — confirm or set.
8. **Consensus with three runs** = the two closest on world GDP; with four or more, the median of all — confirm.

**Superseded by this section** (kept as history): §10.82's operational lines for rulings 2 and 3 (the 5–9% borderline, the 0.8 / 0.9
ceilings — now the register's W aims and soft lines), §10.82.1's plateau test, §10.79's PERSISTENT-A/B hoarding tests and the
2026-09-15 capital-abundance flag (`capital_flags.mjs` remains a diagnostic printer), `majors_workers.mjs`'s ≥ 1.0 failure line (= the
register's pooled W soft boundary; the script remains the composition printer), and F114's TARGET bands (the bands remain the
divergence test). The ruling of 2026-09-16 that the mid-game dip is expected stands: the register reads the end state.


### 10.83.4 — The afternoon's amendments (user, 2026-09-17 13:00–13:30): the register as it now stands, and the loss validated over twelve batches

**The rulings, verbatim, on the six open points of 10.83.3:**

> 1. The literal hard lines break vanilla itself — This is partially intended, partially not. Let's rephrase: 1) a clear capital abundance of
> any major, where the U* is consistently below 5% for several years in a row, and the hoard is significant compared to GDP (not necessarily
> to vanilla), for any significant high-tech major, it's a hard boundary broken, as it distorts the economy and makes other readings almost
> meaningless. If there's just some hoard or low unemployment by the very late game, this is bad, but not a hard failure. However, vanilla
> tends to overdo it on lowering U* too, so the aims are significantly off vanilla goals. Suggest rewording the criteria to fit this.
> — [the rewording proposed: five or more consecutive years under 5% ending by 1936 AND a mean hoard of at least 1.5 of the member's own GDP]
> **"1. Agreed"**
> 2. No book meeting the hoard aim is OK. This is a less important goal than other aims anywhere. Suggest a formula to minimize with weights
> to different aims. — [on the first formula:] Hard to read. However, the "distance" sounds naive, we should probably rely more on natural
> distributions, rather than taking simple distance in percentage points. Any solution you propose, calculate the outcome metrics on all
> runs in the latest 10 or so batches that didn't break hard barriers to ensure that the actual best batches get best score.
> 3. For prices, this is clearly not detailed enough. Perhaps we have to have two or three goods groups to better express that. What
> obsolescence clearly needs is a significant price reduction towards the end game, where tiered industy outputs drop from, say, +50% prices
> when t0 is prevalent to −50% when t3 is widespread (if not prevalent yet by 1936). However, the empirics says that for the goods that are
> consumed by pops, prices tend to not drop that much, and rather, pop wealth grows and consumption grows, there's no stable situation of
> −50% prices on most consumer goods. — [on the three groups proposed:] At this moment, implement the way you suggest. For the future (but
> not to try unless decided explicitly) we can try having not only input goods penalty in 1836 recipes, but an output goods penalty
> (reduction of output) to raise the prices at anchor. Write that down as a distant possibility.
> 4. [X for T3] No. Rather, go for "the more, the better" for the T3/(T0+T1+T2), with low weight for the resulting formula.
> 5. [the run-level stop] You mean when one run can be sufficient if a hard boundary is broken? Why should we remove that? — I still don't
> get it. Why would 1.33 stop the batch then?
> 6. [the end state as the 1932–1936 mean] IDK. I'd just take the latest reading on most metrics. But maybe you're right, feel free to
> argue. — All right.

**Where the register stands after them (implemented in `criteria.mjs`):**

- **HARD — capital abundance (agreed):** a shortlist member of 50M or more, not in civil war, with U* under 5% in FIVE or more consecutive
  years ending by 1936 AND a mean hoard over those years of at least **1.5 of its own GDP** → broken by runoff. Calibration (the longest such
  stretch per big member, mean hoard over it): vanilla breaks in **2 of 16** seeds (Britain 18 years at 1.52 and at 2.14 GDP; at ≥ 1.0 it
  would be 5, at ≥ 2.0 1), the found configuration in **1 of 2** (run 1: Britain 11 years 1926–1936 at 1.80), the C 1.9 family pair in 1 of
  2 (Germany 6 years at 1.64; its other seed's Britain at 1.49 is just under), the A 2.05 book in its one run (Britain 5 years 1932–1936 at
  2.08), the A 1.9 pair in 0 (Britain 7 years at 1.06), the B 1.8 triple in 0. The years condition alone is vanilla's normal state (Britain
  under 5% for 9–18 consecutive years in 12 of 16 seeds); the hoard is what separates "clear abundance". **SOFT:** three or more years at
  ≥ 1.0 GDP, five or more at any hoard, or a hoard alone — over 3 GDP at the end state, or over 2 in every year 1931–1936 without a
  2.5-GDP spend-down ("just some hoard or low unemployment by the very late game"). The 10.83.1 per-country "of vanilla" hoard lines are
  withdrawn — the pair replaces them.
- **HARD — world GDP at the end state** above 1.5× = broken by runoff, below 0.5× = broken by stall (proposed 13:00, implemented; vanilla's
  seeds 0.86–1.15; the flat-cost runaways 1.7–1.9, C 1.6 1.9, the C 2.05 eager stall 0.37). The 1836–1845 anchor and the pooled U* < 10%
  line stand as ruled.
- **The stop:** only a HARD break ends a config — one run is enough — and a SOFT breach never stops a batch (I had proposed stopping at the
  1.33 soft top on flow grounds; withdrawn). `tools/testbed/stop_watch.mjs` now runs `criteria.mjs` on each completed run of a live 2+1
  session and drops the STOP file when that run is broken; the 2026-09-14 rule (1936 GDP above 1.3× vanilla) is only the fallback when the
  register cannot be read.
- **T3:** no X — "the more, the better" on T3 ÷ (T0 + T1 + T2), entering the loss as −w · ln(ratio) at weight 0.3.
- **Prices, three groups, implemented as proposed** in the four scoped shortlist markets (British, American, French, Dutch — the telemetry
  scopes no German or Belgian market): **PI**, the building inputs (steel, tools, engines, fertilizer, explosives, dye, paper) in pounds
  ÷ base at 1935, ÷ vanilla's — aim ≤ 0.8, soft > 1.0, plus "falling decade over decade 1900 → 1935"; **PP**, the pop goods (groceries,
  clothes, furniture, glass, fine art, automobiles, telephones, radios) in WAGE UNITS (price ÷ the owner's base wage) ÷ vanilla's — aim
  ≤ 0.8, soft > 1.1; **PM**, the war goods (small arms, artillery, ammunition), read only. Vanilla's PI path 1.13 → 1.09 → 1.07 → 1.03 →
  1.02 (vanilla's own free switching lowers its input prices a tenth); the found configuration reads PI 0.80 (0.82 of base, falling every
  decade) and PP 0.84, the A 1.9 pair PI 0.88 / PP 1.05, the flat-cost A 1.6 book PI 1.04 (beyond the soft line — its inputs dearer than
  vanilla's). **A DISTANT POSSIBILITY, written down and NOT to be tried unless decided explicitly:** an OUTPUT-goods penalty on the 1836
  recipes (a reduction of the t0 rung's output) beside the input penalty, to raise prices at the anchor toward the "+50% when t0 is
  prevalent" the design sketches; the 1836 anchor rules out a plain output cut today.
- **The end state** stays the 1932–1936 mean (accepted). The argument, measured on vanilla and the books alike: year to year 1931 → 1936
  world GDP moves 3–5%, U* 2–5%, the hoard 5–8%, and the 1936 point sits 7–10% off the five-year mean on GDP, 4–12% on U*, 10–18% on the
  hoard, against aims of ±0.05; only W agrees within 1.5–4%.

**THE LOSS, as ruled ("rely on natural distributions", validated on the recent batches).** For each aim line, d = the distance from the aim
interval in units of the metric's natural seed spread — σ, the standard deviation of the same ratio across vanilla's sixteen seeds (world
GDP 0.11, W 0.07, U* 0.09, H 0.44; the pool's GDP 0.15, W 0.06, U* 0.31, H 0.85; PI 0.03, PP 0.18), capped at 5; the two T terms with no
vanilla reference use the spread across the mod runs read in the same invocation; a line BEYOND ITS SOFT BOUNDARY adds a flat 10 × its
weight, because "unacceptable" has to outrank any accumulation of inside-the-line misses (without it a stalled book at 0.72× world GDP
out-scored the A 1.9 pair); T3 enters as −w · ln(T3 ÷ (T0 + T1 + T2)). **L = Σ w · d** with the provisional weights **world GDP 3 · pool
GDP (W × Y) 2 · pool W 2 · world W 1.5 · pool U* 1 · T0 1 · PI 1 · PP 0.5 · world U* 0.5 · pool H 0.5 · T3 0.3 · world H 0.25**
(`--weights` overrides). A broken run has no loss; a config's loss is its intact consensus's; a consensus pair that DIVERGES under F114's
bands has no consensus (a third run is owed) and is unranked.

**Validated over the twelve books of the last four days** (`criteria.mjs` with every arm; the consensus over the intact runs; ratios to
vanilla; the loss beside):

| book (intact / broken) | loss | world GDP | pool GDP | pool W | world W | pool U* | pool H | PI | PP | T0 | T3 ÷ rest |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `canon-c19-in12`, the found (1 / 1) | **5.3** | 1.04 | 1.45 | 0.70 | 0.67 | 1.94 | 1.58 | 0.80 | 0.84 | 0.77 | 0.33 |
| `canon-a19-gm` (2 / 0) | 17.6 | 1.13 | 1.47 | 0.88 | 0.86 | 1.43 | 1.41 | 0.88 | 1.05 | 0.46 | 0.54 |
| `canon-c19-e0ai500`, the family pair (1 / 1) | 37.5 (pool GDP beyond the soft line) | 1.05 | 1.79 | 0.86 | 0.64 | 1.21 | 2.10 | 0.80 | 0.70 | 0.26 | 0.37 |
| `canon-c205-in13` (2 / 0) | 42.3 (world GDP beyond) | 0.72 | 1.03 | 0.58 | 0.56 | 2.51 | 0.70 | 0.91 | 0.90 | 0.48 | 0.22 |
| `canon-b18-gm` (3 / 0) | 68.6 (world and pool GDP beyond) | 0.66 | 0.81 | 0.56 | 0.60 | 2.52 | 0.83 | 0.95 | 0.94 | 1.22 | 0.20 |
| `canon-je24-a22-in12` (3 / 0) | 83.1 (world and pool GDP, T0 beyond) | 0.61 | 0.93 | 0.52 | 0.52 | 2.79 | 0.88 | 0.97 | 1.06 | 1.65 | 0.19 |
| `canon-flat-in12-a16` (3 / 0) | 86.9 (world and pool GDP, PI, PP beyond) | 0.60 | 0.64 | 0.68 | 0.68 | 2.26 | 0.23 | 1.04 | 1.22 | 0.47 | 0.47 |
| `canon-c205-in12-eager` (2 / 1) | DIVERGENT (0.57 / 1.27) | — | — | — | — | — | — | — | — | — | — |
| `canon-flat-in12-a19` (0 / 2), `canon-c16-in12` (0 / 1), `canon-c19-in13` (0 / 1), `canon-a205-gm` (0 / 1) | OUT — broken by runoff | | | | | | | | | | |

The ranking is the judgement the sessions had already reached by hand — the found configuration first, the A 1.9 pair second, then the
books with one soft breach, then the stalls, with every runaway out — so the loss passes the test the ruling set for it: "the actual best
batches get best score". What the loss adds to the hand reading: the found configuration's whole residual is the pool's GDP (1.45 against
the 1.1 aim, 4.1 of its 5.3) and its intact consensus rests on ONE run; the A 1.9 pair pays first on pool W (5.6) and the pool's GDP (4.4),
then PI (2.4) and world GDP (2.3). ⚠ n=1 for the found configuration's loss until batch 4's two seeds land; the weights are provisional and
were validated once, on these twelve books.

**The σ source does not change the order.** `--sigma mod` takes every spread from the seventeen INTACT mod runs read in the invocation instead
of vanilla's sixteen seeds — wider on the price and hoard lines, where vanilla barely moves between seeds — and the ranking comes back
identical (the found 2.4, A 1.9 7.9, the family pair 27.4, the C 2.05 lift 35.9, B 1.8 58.5, A 2.2 in12 71.7, flat A 1.6 75.8; the same
OUT and DIVERGENT rows): the distances shrink, the soft-breach penalties carry the breached books, and the two in-band books keep their
places on the same lines. Vanilla's spread stays the default — it is the reference's own natural variation and does not depend on which
batches happen to be read.


### 10.83.5 — The loss re-weighted and made continuous (user-ruled 2026-09-18 ~09:00 local; implemented the same morning; validation against the historical books DEFERRED by the user's instruction of ~13:20)

**The rulings, verbatim (user, 2026-09-18, after the loss was walked through on batch 1's 44.6 against the incumbent's 7.6):**

> Balance weights more equally (reduce pool GDP weight, increase the now low-weighted options, especially T3/rest and T0/rest). The
> direction is generally right (except for T), but the share difference is too much.
>
> Penalty for being over soft cap is excessive and counterintuitive, and I believe can cost us efficiency when optimising for reducing loss
> function. While hitting soft cap means "we're not there yet" and "this build can't be final", but being 1% over soft cap isn't instantly
> infinitely worse than being 1% under, and discarding an otherwise almost-fitting setup for this reason is plain wrong and will break
> minimisation process.

**What changed in `tools/testbed/ledger/criteria.mjs` (the defaults; the 2026-09-17 form stays reachable by flags):**

1. **The soft line is a KINK, not a step.** Beyond a soft boundary the EXCESS distance (in σ, capped at 5) counts `SOFT_SLOPE` (default 2)
   more times on top of the aim distance: `d = min(5, gap_from_aim/σ) + SOFT_SLOPE × min(5, excess_beyond_soft/σ)`. The loss is continuous
   through the line and steeper past it; a book 1% over reads a hair worse than 1% under. The flat `10 × w` step survives only as
   `--soft-pen` (default 0; `--soft-pen 10 --soft-slope 0` reproduces the 2026-09-17 form). A breach still marks the book "not final": the
   report's verdict column and the ranking's new `beyond soft (not final)` column carry the breached lines.
2. **T0 is a share term like T3.** `T0 ÷ (T1 + T2 + T3)`, the less the better, scored as its distance from 0 in the mod runs' spread of that
   share (σ over the runs read in the invocation, fallback 0.02; measured 0.026 over the 28 intact runs of the 2026-09-13 → 09-18 books,
   mean 0.037), plus the kink beyond T0's soft line (1935 > 1.3 × the 1900s). The old form (0 unless rising above the 1900s) gave no
   gradient to a book that empties the old rung; the decade path and the "falling" verdict are still printed.
3. **The weights:** world GDP 2 · pool W 1.5 · T0 1.5 · T3 1.5 · pool GDP 1.25 · world W 1.25 · pool U* 1 · PI 1 · PP 0.75 · world U* 0.75
   · pool H 0.75 · world H 0.5 — a 4× range in place of the 12× of the 2026-09-17 set (3 / 2 / 2 / 1.5 / 1 / 1 / 1 / 0.5 / 0.5 / 0.5 / 0.3 /
   0.25), the priority order kept (world GDP first, then the pool's W and W × Y), the T lines raised to the second tier as ruled.
   `--weights k=v,…` overrides; the ranking header prints the set in force.

**The re-ranking that was run (2026-09-18 ~12:00 local, every book measured since 2026-09-13, the consensus over the intact runs; NOT yet
judged — the user deferred validation):**

| book (intact / broken) | loss 2026-09-17 form | loss 2026-09-18 form | world GDP | pool GDP | pool W | pool H | T0 ÷ rest | T3 ÷ rest | beyond soft |
|---|---|---|---|---|---|---|---|---|---|
| `canon-c19-in12`, the incumbent (3 / 1) | 9.06 (7.6 as recorded in F131, before T0 became a share) | **11.48** | 1.10 | 1.30 | 0.68 | 4.17 | 0.039 | 0.344 | — |
| `canon-c205-in13` (2 / 0) | 43.37 | 14.39 | 0.72 | 1.03 | 0.58 | 0.70 | 0.028 | 0.220 | world GDP |
| `canon-a19-gm` (2 / 0) | 18.34 | 16.16 | 1.13 | 1.47 | 0.88 | 1.41 | 0.019 | 0.538 | — |
| `canon-c19-e0ai500` (1 / 1) | 38.22 | 20.82 | 1.05 | 1.79 | 0.86 | 2.10 | 0.019 | 0.372 | pool GDP |
| `canon-b18-gm` (3 / 0) | 70.69 | 25.60 | 0.66 | 0.81 | 0.56 | 0.83 | 0.070 | 0.201 | world GDP, pool GDP |
| `canon-c195-in12-eager` (2 / 0, F132) | 45.06 | 27.88 | 1.23 | 2.01 | 0.91 | 0.53 | 0.012 | 0.444 | pool GDP |
| `canon-je24-a22-in12` (3 / 0) | 84.78 | 31.99 | 0.61 | 0.93 | 0.52 | 0.88 | 0.083 | 0.190 | world GDP, pool GDP, T0 |
| `canon-flat-in12-a16` (3 / 0) | 87.70 | 33.51 | 0.60 | 0.64 | 0.68 | 0.23 | 0.021 | 0.467 | world GDP, pool GDP, PI, PP |
| `canon-c205-in12-eager` (2 / 1), `canon-c19-in12-eager` (2 / 0), `canon-c19-in12-eager-q10` (3 / 0), `canon-c195-in12` (3 / 0, F133) | DIVERGENT | DIVERGENT | | | | | | | |
| `canon-flat-in12-a19`, `canon-c16-in12`, `canon-c19-in13`, `canon-a205-gm`, `canon-c19-in12-sharp` | OUT (no intact run) | OUT | | | | | | | |

(The incumbent read 12.75 when ranked beside the batch-2 books alone and 11.48 in the seventeen-book invocation: the T terms' σ is the
spread of the runs READ, so a loss is comparable only within one invocation — a known property, unchanged from 2026-09-17.)

**Deferred (the user, 2026-09-18 ~13:20 local): the validation judgement** — whether this ranking "puts the actual best batches first" as
the 2026-09-17 ruling requires, whether the stalled B 1.8 book at 25.6 and the stall-side C 2.05 ×1.3 book at 14.4 sit where they should
against the A 1.9 pair at 16.2, and whether the T σ should be fixed rather than per invocation. The numbers above are the record for that
discussion; nothing in the register's AIM / SOFT / HARD lines moved.

### 10.83.6 — The validation, RUN (FINDINGS **F134**, 2026-09-18 afternoon): the loss reproduces, it ranks the historical arc right, and it fails the ruling's test twice — a stall second, and the whole ranking inside the seed noise

`criteria.mjs` at its 2026-09-18 defaults, re-run over the seventeen books in one invocation, reproduces §10.83.5's table inside rounding. Four
readings the table did not contain, all in F134 with the commands:

1. **The arc is right.** Scored on the same register, `canon4v-hai3` (the 2026-09-06 canon) → `canon-je24` → `canon-je24-a22` → the incumbent
   reads **19.32 → 14.61 → 12.18 → 11.22**, with T0 ÷ rest **0.113 → 0.078 → 0.060 → 0.039**, PI 0.92 → 0.96 → 0.93 → **0.84** and PP 1.04 →
   0.97 → 0.89 → **0.83**. The one line that regressed is the hoard (pool H 1.50 → **4.17**). ⚠ The first two rows' runs were built from
   index-keyed books; the tier-0 rung set is identical between those books and today's, so T0 is unaffected (four rungs differ, all above t0).
2. **Vanilla scored against the mod's own loss reads 16.77** (no T terms), essentially all of it pool W 6.5 + PI 5.0 + pool U* 3.2 — the loss does
   say what the mod is for. The incumbent's comparable ten-term figure is 7.7.
3. ⚠⚠ **THE RANKING IS INSIDE THE NOISE.** Pooled within-book σ of a SINGLE run's loss is **11.3** (17 d.f., 11 books; the incumbent's own three
   intact seeds read 6.9 / 29.6 / 15.2), so a two-seed consensus carries se ≈ 8.0 and two books separate only at Δ ≳ 22.5. **No adjacent gap in the
   eight-book ranking exceeds 4.8, and the incumbent does not separate from the last-placed book.** ⇒ the loss is a DESCRIPTION of one config's
   residual, not a ranking instrument at n=2–3. Two contributing causes, both measured: the σ it divides by is VANILLA's seed spread, and the mod's
   own within-config spread is **1.3–3.0× wider** on every line but PP (pool GDP 3.0×, world W 1.3× — an uneven over-statement that inflates the
   pool-GDP term specifically); and the twelve terms carry **3.9 effective dimensions** (pool W ~ pool U* r = −0.98, world W ~ world U* −0.99,
   pool H ~ world H 0.95, world GDP ~ pool GDP 0.93; 58% of the variance in one component).
4. ⚠ **A STALL RANKS SECOND.** `canon-c205-in13` (world GDP 0.72, a stall in both seeds) at 14.40 sits above `canon-a19-gm` at 16.17. The kink is
   not the cause — the loss is affine in `--soft-slope` and the two swap only at **slope 5.12**; at slope 0 the stall is still cheaper (13.3 vs
   16.2). The cause is that a stalled economy satisfies the labour aims by keeping peasants and the hoard aim by having no capital, and the
   depeasantation axis holds 4.5 of the 13.25 total weight across four correlated terms against the GDP axis's 3.25 across two. Measured offline,
   **dropping the two redundant labour terms and world H is enough to restore §10.83.4's hand order** (a19-gm 14.3 < c205-in13 14.5), and doing that
   *plus* honouring the register's own priority sentence (GDP 2.5 / 2.0 over pool W 1.0 / world W 0.75) reproduces it with a margin.
5. ⚠ **The weights as ruled contradict the register's priority sentence** — "world GDP > the pool's W × Y > W" against weights world GDP 2 ·
   pool W **1.5** · pool GDP **1.25**. A consequence of the ruled "reduce pool GDP"; the user's call which of the two moves.

**Nothing was changed in `criteria.mjs`:** it still ships the ruled 2026-09-18 defaults, and the re-weightings are offline recomputations from its
own `--json`. The four proposals waiting on a ruling are (a) one term per axis, (b) the priority order restored between pool GDP and pool W,
(c) σ from the mod's own within-config spread instead of vanilla's, (d) a FIXED T σ in place of the per-invocation one (which moves a book by up
to ~5 points between invocations) and a floor under the unbounded −ln(T3 ÷ rest) bounty.

### 10.83.7 — The loss AMENDED (user-ruled 2026-09-18 evening, after F134): three of the four fixes taken, one refused, and the statistics ruled DIRECTIONAL

**The rulings, verbatim (user, 2026-09-18 evening, on F134's four proposals and its noise finding):**

> On "diffs not being statistically real": unfortunate, but I can't think of finer metrics, and increasing statistical power would take too long. So
> treat as directional, especially when moving a lever leads to theoretically understandable results.
>
> On changes to loss function: drop world U*, but not the other things you propose dropping. All right on restoring priority line. Ok on the right sigma
> and fixing sigmas for T. You may suggest alternative approaches to T completely, that are aligned with obsolescence (tiers N-2/N-3 should become
> unprofitable and mostly shed workers when tier N becomes prevalent).

**⭐⭐ THE STATISTICAL STANCE, RULED: DIRECTIONAL.** F134's noise finding stands and is not to be treated as a blocker. A lever's reading is taken as
evidence of its DIRECTION, weighted by whether the mechanism is understood — *"especially when moving a lever leads to theoretically understandable
results"* — not as a significant difference. ⇒ Two consequences for practice: (1) a finding argues the MECHANISM beside the number, and a result whose
mechanism is not understood carries much less weight than one that is; (2) **the pooled reading across a whole lever axis outranks the two-book
comparison** — the regression over the eleven runs of the cost axis (F135 §3) is worth more than any one pair on it, and costs no game time.
⚠ THE ADOPT RULE's "beat the incumbent by ≥ 3" is therefore retired as a significance test. What replaces it: a candidate is adopted when it beats the
incumbent on the loss AND the lever's direction is understood AND no new hard break — the judgement stays the user's, and the loss is the summary, not
the referee.

**IMPLEMENTED in `tools/testbed/ledger/criteria.mjs` the same evening (its defaults ARE the ruled form):**

1. **World U* is OUT of the loss** — r = −0.99 with world W over the 29 intact runs, i.e. the same statement twice. It stays a SOFT boundary in the
   register and a flag in the report and the ranking; it simply carries no weight. Pool U* and world H are KEPT (the user refused those two drops).
2. **The priority line is restored in the weights**: **world GDP 2 · pool GDP 1.5 · pool W 1.25 · world W 1.25 · T0 1.5 · T3 1.5 · pool U* 1 · PI 1 ·
   PP 0.75 · pool H 0.75 · world H 0.5.** Pool GDP (the pool's W × Y) now outranks pool W, as the register's own priority sentence says and the
   2026-09-18 morning set did not. `--weights` still overrides, and naming `worldU` there puts it back.
3. **σ is a FIXED CONSTANT per line, measured as the POOLED WITHIN-CONFIG spread over the 29 intact runs of the 2026-09-13 → 09-18 books** (17 d.f.):
   world GDP 0.228 · pool GDP 0.440 · world W 0.089 · pool W 0.148 · world U* 0.129 · pool U* 0.631 · world H 0.566 · pool H 1.358 · PI 0.078 ·
   PP 0.117, and for the tiered-labour terms T0 ÷ rest **0.025**, T3 ÷ rest 0.106, T0's 1935 ÷ 1900s ratio 0.407. Fixed, so a loss is comparable ACROSS
   invocations — the defect F134 §10 quantified. `--sigma vanilla` restores the 2026-09-17 behaviour (vanilla's seed spread, 1.3–3.0× narrower);
   `--sigma runs` recomputes from the runs read in the invocation (the old `--sigma mod`).
   ⚠ **Re-measure the constants when the run population changes materially, in a finding that says so** — a stale σ is silently wrong, not missing.

**The re-ranking under the amended loss** (the same seventeen books, one invocation): the incumbent **8.40** · `canon-a19-gm` **9.24** ·
`canon-c205-in13` 9.35 · `canon-c19-e0ai500` 10.48 · `canon-c195-in12-eager` 13.05 · `canon-b18-gm` 15.64 · `canon-flat-in12-a16` 19.97 ·
`canon-je24-a22-in12` 21.65; the same four DIVERGENT and five OUT rows. **The working book is back above the stall** (F134 §4's failure), by 0.11.
The noise scales with it: pooled within-book σ of a single run's loss **6.6** (was 11.3), so a two-seed consensus carries se ≈ 4.7 and the separation
threshold is ≈ 13.1 — the picture F134 §5 describes is unchanged in substance, and the ruling above is what governs its use.

**⭐ PROPOSED, NOT RULED — THE OBSOLESCENCE TERM, to replace T0 (FINDINGS F136, built and validated over 51 runs of nine books).** The user's sentence
— *"tiers N−2/N−3 should become unprofitable and mostly shed workers when tier N becomes prevalent"* — made into a measure:

- Per tiered INDUSTRY, world-wide, at the end state: **N = the MODAL rung** (the tier holding the most staffed levels in that industry — parameter-free;
  a prevalence THRESHOLD was tried and rejected, it inverts the ranking by selection bias at 0.55).
- For each k ∈ {2, 3} with N − k ≥ 0: **shed = 1 − workers(N−k, end) ÷ that rung's own maximum over the century**.
- **O_shed = the mean over the scored pairs**, 0 to 1, the more the better; an industry whose modal rung is t0 or t1 contributes nothing, and a book
  where nothing climbs scores 0 (so a stall cannot score well by staying poor — F134 §4's failure mode, closed by construction).
- Into the loss as **w · (1 − O_shed) ÷ σ_O** with σ_O = **0.038** (the measured pooled within-config spread), replacing T0's term; T3 stays.
- **It discriminates 5.0× signal-to-noise against T0 ÷ rest's 2.8×**, puts the two best books first, the two stalls mid-table, and reads the arc
  monotonically (0.432 → 0.457 → 0.615 from the 2026-09-06 canon through phase 1 to the incumbent).
- ⚠ **The margin half is NOT scored.** `dead = 1 − margin(N−k) ÷ margin(N)` ranks a STALL first, because a realised margin is measured over survivors
  and the engine has already laid off the unprofitable buildings (F97's 0.66× SoL rule) — the old rungs that remain are profitable by construction.
  It is reported as a diagnostic beside the per-industry table, which is where the finding of F136 §1 comes from.
- ⭐⭐ **What that table says, and it is the sharpest reading the register has produced:** the ladder works COMPLETELY in the war and heavy chains
  (arms, artillery, explosives, steel shed 92–98% of the old rung's peak workers, three of them at NEGATIVE margins) and barely at all in the consumer
  chains (glass 14%, motor 26%, textile 29%, paper 30%, food 39% shed, every one still earning ~21%). **Textile's t0 rung earns 21% against its own
  frontier's 25% — a flat ladder in the industry carrying the most workers.** That is F97's pop-price mechanism read per industry: a building-fed or
  army-fed good's price can fall, a pop-fed good's cannot, because pop wealth rises to absorb the glut.

**Still open after this section:** whether to adopt the obsolescence term; whether T3 should also be bounded (−ln is unbounded and can go negative,
F134 §10); and the interpretation of batch 2 (F133), which the user has not returned to.

## §10.84 — archived

Moved verbatim, under the same numbers, to `BALANCE_FRAMEWORK_ARCHIVE.md` (2026-10-24); status in the index above. Its headings:

- 10.84 — THE CANONIZATION OF `canon-c19-in12` (2026-09-18, user-delegated), and the two defects it ships

## 10.85 — THE SHORTLIST'S GDP AND W AIMS WIDENED (user-ruled 2026-09-18 evening, during the first human playtest) — and it unseats the incumbent

**The ruling, verbatim:**

> it's clear that for shortest list, a GDP (and GDP per capita) significantly over vanilla reference is normal. We still, unlike vanilla, insist
> that full depeasantation is damaging on all fronts and unacceptable, but having 95% of workforce (compared to vanilla full employment) at x2
> product per productive worker is OK, for the shortlist (the world as a whole still shouldn't run off)

**Implemented in `criteria.mjs` (its defaults ARE the ruled form). The WORLD lines are untouched** — "the world as a whole still shouldn't run
off" is already the world GDP aim 1.0, soft 0.75–1.33, HARD > 1.5 — and so is everything else in the register:

| line | was | is |
|---|---|---|
| pool W | aim **0.6–0.7**, soft > 1.0 | aim **0.6–0.95**, soft > 1.0 (unchanged — that IS "full depeasantation") |
| pool GDP | aim **≈1.1**, soft < 0.95 or **> 1.5** | aim **1.1–1.9** (= 0.95 × 2.0), soft < 0.95 or **> 2.0** |

**The arithmetic check the ruling needs, and it passes.** The shortlist is **31.0%** of world GDP in vanilla at the end state (£1,320M of
£4,258M). So a pool at 1.9× with the world held at 1.0× implies the REST of the world at **0.60** of vanilla, and at the world's 1.33 soft top
it implies **1.07**. The amendment is therefore consistent with the world lines, and the leader/periphery divergence it permits **is goal 1** —
"falling behind on tech should cost you markets". For reference, the measured books' implied rest-of-world: the incumbent 1.01, A 1.9 0.98, the
eager C 1.95 book 0.89, the stalls 0.47–0.60.

**⚠⚠ THE CONSEQUENCE: THE AMENDMENT UNSEATS THE INCUMBENT.** Re-scored over the eight ranked books (nothing else changed):

| book | loss BEFORE | loss AFTER | pool W | pool GDP |
|---|---|---|---|---|
| `canon-c19-e0ai500` ⚠ n=1 intact | 10.5 | **5.0** | 0.86 | 1.79 |
| `canon-c195-in12-eager` (F132) | 13.0 | **5.3** | 0.91 | 2.01 (still just over the new soft line) |
| `canon-a19-gm` | 9.2 | **6.6** | 0.88 | 1.47 |
| **`canon-c19-in12` — the canon** | **8.4** | **7.9** | 0.68 | 1.30 |
| `canon-c205-in13` (a stall) | 9.3 | 9.5 | 0.58 | 1.03 |
| `canon-b18-gm` (a stall) | 15.6 | 15.8 | 0.56 | 0.81 |
| `canon-flat-in12-a16` | 20.0 | 20.1 | 0.68 | 0.64 |
| `canon-je24-a22-in12` | 21.6 | 21.8 | 0.52 | 0.93 |

The books that were penalised for being "too rich" are now the best ones, and **the canon drops from first to fourth**. ⚠ Read that with the
directional ruling (§10.83.7) and with two cautions: `canon-c19-e0ai500` has only ONE intact run, and `canon-c195-in12-eager` belongs to the
eager family, which F124/F125 measured as unstable by seed (0.74 / 1.45 and 1.23 / 0.94 / 0.56 on world GDP) even though F132's own pair was
aligned. **No re-canonization is proposed on this evidence** — the amendment changes what to AIM at, and the books that now look best have two
intact seeds between them.

**⚠ TWO INCONSISTENCIES THE AMENDMENT EXPOSES, both UNRULED:**

1. **Pool U*'s aim now contradicts pool W's.** They are the same axis measured twice — r = **−0.98** over the 29 intact runs — and the aim
   "U* ≥ 2× vanilla" corresponds to pool W ≈ 0.68. At the new pool W ceiling of 0.95, pool U* is ~1.0, i.e. sitting ON its own soft line
   ("< 1.0"). So a book can now be AT one aim and beyond the other soft line for the same fact. F134 §7 proposed dropping the redundant
   unemployment terms and the user kept pool U*; this ruling is what makes the redundancy bite. Options: re-aim pool U* to ≥ 1.0 with soft < 0.9,
   make it read-only like PM, or drop it. Measured: it barely moves the ranking either way (the top four read 5.0 / 5.3 / 6.6 / 7.9 with it and
   3.7 / 4.0 / 5.7 / 7.9 without), so this is about coherence, not about scores.
2. **"GDP per capita" and what the register measures are not the same number.** `gdpP` is TOTAL pool GDP ÷ vanilla's total; the ruling's words
   ("GDP *and GDP per capita*") and the report's own old label ("W × Y") name the per-capita quantity. They differ by the pool's population
   ratio, which conquest moves by up to ~20% — F132 seed 1 reads total **2.06** against per-capita **1.86** because Britain annexed a 46M
   Chinese successor state between 1934 and 1935. ⭐ **It is decisive right now**: the eager book's consensus reads total **2.01** (beyond the new
   2.0 soft line) and per-capita **1.85** (inside the 1.9 aim). The report now prints BOTH on the pool GDP line; which one the criterion is on is
   the user's call.

### 10.83.8 — TWO READING RULES (user-ruled 2026-09-22, on the first run of the B-gradient batch)

**RULING 1 — U\* AND H "AT THE AIM" IN A POOR ECONOMY ARE NOT RESULTS; THEY ARE THE ABSENCE OF A READING.** The user, on
run 1 of `probe-sm-b152` (world GDP **0.67×**, and on the register pool U\* 2.70× "AT THE AIM", pool H 0.23× "AT THE AIM"):
*"'median U\* at the aim because the world is poor' or 'H at the aim because the world is poor' is not a positive result,
it's a lack of any result on U\* and H."*

⇒ **When world GDP is far enough from its aim, the labour and hoard lines carry no information about the levers that were
supposed to move them.** A world that never industrialised keeps its peasants and accumulates no investment pool *by
identity* — whatever A, B, the cost slope or the spending set are doing.

⚠⚠ **THE GATE IS NOT AT THE AIM, AND SAYING SO WAS THE FIRST DRAFT'S ERROR** (corrected by the user within the hour:
*"It's important not to overdo that. Readings at 20% of median to either side are OK. But 0.6 is not, 0.6 does disqualify
U\* and H."*). The aim is 1.0 and ±20% is ordinary seed spread — vanilla's own sixteen seeds run 0.823–1.146 of their
median — so a gate at the aim would void almost every run ever measured. The ruled anchors:

| world GDP ÷ vanilla | U\* and H |
|---|---|
| **0.80 – 1.20** | **READ NORMALLY** — inside ±20% of the median, ruled OK |
| 0.66 – 0.80 and 1.20 – 1.38 | **WEAKENED** — quote them only with the GDP beside them; never "at the aim" unqualified |
| **≤ 0.60** | **DISQUALIFIED** — ruled outright |

⚠ The exact cut between "weakened" and "disqualified" is **UNRULED**: 0.80 is ruled OK and 0.60 ruled out, and nothing
says where in between it falls. Report the band a run is in rather than inventing a threshold.
⭐ **Note that 0.60 sits BELOW the world-product hard floor of 0.66** (§10.86.1), so a run actually reaching 0.60 is
already *broken by stall* and records only a binary outcome — U\* and H are not reported for it at all. ⇒ **the gate's
live region for an INTACT run is 0.66–0.80** (and 1.20–1.38 above), which is exactly where run 1 of `probe-sm-b152`
landed at **0.67**: intact, one notch off the hard floor, and its pool U\* 2.70× / pool H 0.23× are therefore weakened to
the point of carrying nothing — which is the reading the ruling was made about.

⚠ **This is stronger than F134's finding that a stall RANKS well.** F134 said the LOSS mis-ranks, which invites a
re-weighting; this says the underlying READINGS are absent, so no weighting can repair them — only a run with a working
economy can measure U\* or H at all. Nothing in `criteria.mjs` changes: it still prints and scores both lines, because the
loss is a residual and this is a rule about what a REPORT may claim.

⇒ It sharpens the standing priority (world GDP at 1935 > the pool's W × Y > W) into a **GATE**: world GDP is read first,
and it decides how much weight the other lines can carry — full inside ±20% of the median, none at 0.60.

**RULING 2 — A COUNTRY-LEVEL SHARE IS A READING, EVEN THOUGH COUNTRY-LEVEL LEVELS ARE NOISY.** The user: *"While
country-level readings are inherently noisy, still, the shares of something (1−U\*, for instance) should not be discarded
completely."* ⇒ A per-country **level** (GDP, workforce size, building count) moves with territory and is a weak signal;
a per-country **SHARE** normalises that away and stands on its own.

⭐ **Measured the same day, and it reverses the caveat that produced the ruling.** Britain's U\* = (unemployed + peasants)
÷ total workforce, six runs of the same base with one B step between them:

| run | 1860 | 1880 | 1900 | 1920 | 1935 | 1935 workforce |
|---|---|---|---|---|---|---|
| `probe-sm-b152` r1 (B 1.52) | 70.1% | 70.1% | 67.6% | 59.6% | **44.0%** | 16.9M |
| `probe-slide-mild` n2r1 (B 1.50) | 69.7% | 53.7% | 19.5% | 4.6% | 1.7% | 19.4M |
| n2r2 | 59.2% | 55.7% | 35.5% | 23.8% | 12.1% | 21.4M |
| n3r1 | 63.8% | 65.3% | 58.9% | 35.9% | 5.2% | 20.3M |
| n3r2 | 61.2% | 58.1% | 42.4% | 18.6% | 3.4% | 20.5M |
| n3r3 | 63.8% | 53.4% | 24.8% | 25.4% | 8.4% | 29.2M |

The b152 run's Britain was first discounted as territorially confounded (its total population ends at 56.9M against
81.3M in a base seed). **That discount was wrong**: the WORKFORCE denominators are 16.9M against 19.4–20.5M, ~15% apart
rather than ~30%, because most of the population gap is dependents and colonial subjects who never enter the denominator
— and the share normalises precisely what the caveat was worrying about. All six seeds sit together at 59–70% through
1860–1880; five then fall below 12.1% and one does not. **That is a real reading of a country, at n=1.**
⚠ It is still ONE seed and cannot yet say whether the cause is the B step or a basin: three b152 seeds near 44% would
mean the config, a scatter of 5 / 44 / 8 would mean the seed.
⚠ The identity to use is `U* = (population_unemployed_workforce + peasants) ÷ Σ workforce_by_profession`, which holds
EXACTLY in the save (salaried + unemployed + peasants = Σ, verified to the pound); putting the unemployed in the
denominator a second time reads ~5pp low.

## 10.86 — THE THREE RULINGS OF 2026-09-19: THE WORLD PRODUCT GETS A HARD BAND FROM VANILLA'S OWN 95% CI, PRICES ARE PLANNED FOR BEFORE A CONFIG IS PLANNED, AND THE TIER-0 INPUT PENALTY IS SIZED AGAINST THE 1836 MAP (user-ruled 2026-09-19; GLOSSARY.md is its by-product)

### 10.86.1 — THE WORLD PRODUCT GETS A DERIVED HARD BAND: VANILLA'S OWN 95% CI ± 10% (user-ruled 2026-09-19), and the terminology sheet the ruling's own history demanded

**The ruling, settled at the third attempt and stated in the user's own words:** *"What I meant is not H and not W, but rather world product, the
combined GDP of all countries (do we have a letter for that? We probably shouldn't, 'GDP' is good enough). For it, the mod hard boundaries are
95% CI ±10%."* — **AMENDED within the hour to ±20%**: *"let's make it 95CI-+20%, not 10%, for hard bounds on world product. To not disallow 1.3 as
hard boundary broken."*

**THE RULE.** The register's END-STATE world GDP line becomes **[vanilla's 2.5th percentile × 0.8, vanilla's 97.5th percentile × 1.2]**, derived per
invocation from the vanilla reference's own seed distribution in the same window — never a literal, the way the 1836–1845 anchor's CI already works.
At n=16 vanilla's end-state world GDP runs **0.823–1.146×** its own median, so the band is **0.66–1.38×**. Below = **broken by stall**, above =
**broken by runoff**, checked per run. It REPLACES the provisional `< 0.5` / `> 1.5` lines of 2026-09-17 (`--gdp-hard legacy` restores them,
`--gdp-hard off` removes them). ⚠ **"CI" here means the PERCENTILE INTERVAL OF THE SIXTEEN SEEDS, not the confidence interval of a mean** — the
project's established convention, and now written down in `GLOSSARY.md` §4.

**WHAT IT BREAKS, over the six books of 2026-09-17/19 (11 runs), at both widths — the amendment is what the first column is for:**

| book | runs | at ×0.9/×1.1 (0.74–1.26) | **at the ruled ×0.8/×1.2 (0.66–1.38)** |
|---|---|---|---|
| **`canon-c19-in12` — the canon** | 1.30 / 1.16 | run 1 BROKEN BY RUNOFF ⇒ config out | **intact** |
| `canon-a19-gm` (A 1.9) | 1.15 / 1.10 | both intact | **intact** |
| `canon-c195-in12-eager` | 1.17 / 1.30 | run 2 broken by runoff | **intact** |
| `canon-c195-in12` | 1.17 / 0.92 / 0.68 | the tie-breaker broken by stall | **intact** |
| `canon-lvl-a19b17` (F139) | 0.60 / 0.45 | both broken by stall | **both still BROKEN BY STALL** |
| `canon-a205-gm` | 1.00 | already broken (capital abundance) | already broken |

⇒ **6 of 11 runs broke at ±10%, 2 of 11 at the ruled ±20%**, and the two are F139's stalls, which every other reading already condemned. The line is
real without being a formality.

✅ **AND THE AMENDMENT FIXES WHAT ±10% BROKE.** At ×0.9/×1.1 the hard ceiling (1.26) was TIGHTER than the SOFT ceiling (1.33), so a run broke before it
could ever read "beyond the soft boundary" and the loss's kink on that term was unreachable; the floor had the same problem at one point of margin
(hard 0.74 against soft 0.75). At the ruled ×0.8/×1.2 the band is **0.66–1.38, outside the soft line on both sides**, so soft and hard are ordered
correctly again and nothing further needs ruling. ⚠ The one thing still worth knowing: **W has no hard bound** — the reading that briefly put one there
was superseded the same evening, the code keeps it behind `--w-hard` (default **off**) so nothing unruled ships, and **H has none by the ruling itself**.

⭐ **AND THE HISTORY IS THE POINT OF `GLOSSARY.md`.** This ruling was made three times — first as "hard boundaries for H", then corrected to W, then
to the world product — and each reading gave a completely different, and separately measured, answer:

| the reading | vanilla's own 95% CI, as a ratio to its median | the band it implies (at the ±10% first tried) | what it would have done |
|---|---|---|---|
| **H** (the hoard ÷ GDP) | world **0.56–1.93×**, pool **0.40–2.74×** | 0.51–2.12 / 0.36–3.02 | breaks the canon on the hoard (pool H 6.77× in one seed) |
| **W** (productive workers per capita) | world **0.86–1.08×**, pool **0.89–1.10×** | 0.78–1.19 / 0.80–1.21 | **the floor lands INSIDE the register's own W aim of 0.6–0.95 and breaks every book we have** — one intact run in five |
| **world GDP** (the ruling) | **0.823–1.146×** | 0.74–1.26× at ±10%, **0.66–1.38× at the ruled ±20%** | 6 of 11 runs at ±10% including the canon's; **2 of 11 at ±20%** |

⚠ Note what the widths are doing: because vanilla's own seed spread differs by a factor of six between these three quantities, the SAME formula gives a
±20% band that is generous on world GDP (0.66–1.38) and would be absurd on H (0.33–2.32). The width is only meaningful next to the metric's own spread,
which is the substance of *"H is hardly comparable with vanilla anyway"*.

The letters were doing real work and two of the three readings were live hypotheses, which is exactly the condition a glossary is for. **`GLOSSARY.md`
is now the single page that says what each letter means**, with the rule that a bare letter is only allowed if it is on that page. Kept as measured
readings, not as rulings: H carries no vanilla-derived bound (its seed spread makes one meaningless — the user's own *"H is hardly comparable with
vanilla anyway"*), and W's hard band is NOT shipped.

### 10.86.2 — ⭐⭐ REALISED PRICES ARE THE FIRST THING TO PLAN, NOT THE LAST THING TO READ (user-ruled 2026-09-19, GOVERNING for config design)

**The user's words:** *"When contemplating a setup, we should understand that (1) realised prices will be far off base, mostly by design, but
significantly — by random seed. Industry economics 'at base prices' is not even directional, it's just one of the factors. (2) Realised prices are
hardly transferrable between configs, we get only directional guesses. We should always try understanding where prices go, first, and plan configs
around that. Even if we no longer use a complex building-level solver."*

**Both claims are now measured, on vanilla's own sixteen seeds (FINDINGS F140 §1):**

| date | spread across MARKETS (same seed-median) | spread across SEEDS (same market) | largest seed spread |
|---|---|---|---|
| 1836.2.1 | **61 pp of base** | 10 pp | 75 pp |
| 1840.1.1 | 65 pp | 27 pp | 106 pp |
| 1850.1.1 | 49 pp | 37 pp | 127 pp |
| 1900.1.1 | 42 pp | **52 pp** | 150 pp |
| 1935.1.1 | 30 pp | **53 pp** | 139 pp |

⇒ **At the 1836 anchor the price is a property of the MARKET (±60 pp) and barely of the seed (±10 pp); by 1900 the seed has overtaken the market and
never gives it back.** A base-price margin is never a description of anything, and a realised margin read at one date in one seed is a draw from a
distribution 50 pp wide. ⇒ **A config is designed against a measured price DISTRIBUTION, not against base prices and not against one run's prices.**
`tools/era0_solvency.mjs` is the instrument this ruling asks for on the recipe side; the criteria register's PI / PP are its end-state half.

### 10.86.3 — THE TIER-0 INPUT PENALTY IS BOUNDED BY THE 1836 MAP'S OWN VALUE ADDED, NOT BY AN INSOLVENCY COUNT

**The user's design proposal, 2026-09-19:** *"I now think we need a tighter A/B to avoid money printing, but a higher t0 input penalty to ensure that t0
industry can't work at base prices, require higher output prices."* The pairing is coherent and it is the direct answer to F139: a tighter A/B inverted
the realised ladder because tier 0, whose recipe is the cheapest in input value, became the most profitable rung in the game; raising tier 0's input
penalty attacks exactly that.

**What the census says (FINDINGS F140, `tools/era0_solvency.mjs`), over 13 tier-0 industries × 7 vanilla markets at the measured 1836/1840 prices:**

| option | target_be (median) | insolvent cells, 1836.2.1 | at 1840.1.1 | VERY DEAD | tiered VA of the 7 markets, 1840 | solvent share over vanilla's century |
|---|---|---|---|---|---|---|
| vanilla ×1.0 | 79% | 22/70 (31%) | 10/75 (13%) | 0 | £755k/wk = 100% | 92% |
| **×1.2 — the canon** | 95% | 29/70 (41%) | 18/75 (24%) | 0 | £596k = **79%** | 82% |
| ×1.4 | 111% | 38/70 (54%) | 35/75 (47%) | 0 | £438k = 58% | 62% |
| ×1.6 | 126% | 39/70 (56%) | 46/75 (61%) | 1 | £280k = 37% | 46% |
| uniform −10% | 111% | 40/70 (57%) | 36/75 (48%) | 2 | £362k = 48% | 64% |
| uniform −20% | 125% | 41/70 (59%) | 44/75 (59%) | 3 | £214k = 28% | 49% |
| uniform −30% | 143% | 51/70 (73%) | 55/75 (73%) | 7 | £24k = **3%** | 27% |

⭐⭐ **THE BINDING CONSTRAINT IS THE THIRD-LAST COLUMN, AND IT IS AN ACCOUNTING IDENTITY, NOT A BEHAVIOURAL CLAIM.** The tier-0 recipe *is* the 1836
map's manufacturing, so buying more input per unit of the same output subtracts value added one-for-one: the seven markets' tier-0 value added is
**9.2% of world GDP** at 1840, and the penalty deletes 21% of it at ×1.2, 42% at ×1.4, 63% at ×1.6, 72% at uniform −20% and **97% at uniform −30%**
(−1.9 / −3.9 / −5.8 / −6.6 / −8.9 points of world GDP, first-order, partly returned later as the raw sector grows into the extra input demand).
The register's HARD 1836–1845 anchor is vanilla's 90% CI ± 10%, so ×1.6 and the uniform options are spending most of that budget on day one.

⭐ **AND THE PENALTY PUSHES ITS OWN INPUT PRICES UP, which the margin table does not include.** First-order, from the standing tier-0 buildings' extra
demand against each market's own order book: at ×1.4 British fabric goes 92 → 122% of base and wood 103 → 136%; at uniform −30%, wood 103 → 175% and
iron 148 → 175%, i.e. pinned at the band edge where the market can no longer signal scarcity at all (§10.15's ceiling, from the other side).

⭐ **A SCALAR LIFT AND A UNIFORM LEVEL ARE NOT THE SAME LEVER.** The scalar keeps vanilla's own dispersion (at ×1.4: art academy 56%, arms 83%, steel
144% — an 88-point spread in what each rung needs from its output price); the uniform level removes it, at the cost of hitting hardest exactly the
industries vanilla made generous — **arms ×2.11, artillery ×1.64, art academy ×3.13 at −20%** — and those are the industries that go VERY DEAD.

⚠ **The very-dead list is small and it is the same three families every time**: **glass** (already −35% median in vanilla at 1836 and −47/−48% in the
Prussian, Dutch and Japanese markets — a vanilla property, not ours), **paper and furniture in the Dutch market**, and, only under the uniform options,
**arms and artillery in Britain and France**. Under the scalar options up to ×1.4 the very-dead count is **zero**.

⚠⚠ **AND F137 IS A PREREQUISITE, NOT A PARALLEL TASK.** Re-run against the canon's OWN measured 1836 prices instead of vanilla's, every option is
materially worse and the very-dead count doubles to quadruples (×1.6: 1 → 6 cells; uniform −20%: 2 → 10; uniform −30%: 10 → 23), because our shipped
1836 already over-produces wherever the map carries rungs above tier 0 (F137: tooling +88% at half vanilla's price). **Even vanilla's own recipe is
insolvent in 40% of cells at our own 1836 prices, against 31% at vanilla's.** Raising the penalty on top of that stacks two output-price cuts on the
same buildings, and the result would be the sum of two changes — unreadable, which is exactly what §10.86.2 forbids.

⇒ **THE RECOMMENDATION PUT TO THE USER: the scalar axis, ×1.35–1.45 (target_be ≈ 108–113), paired with the tighter A/B, and only after F137** — the
largest penalty that leaves no industry very dead at vanilla's prices, keeps the first-order anchor cost near 4% of world GDP, and still moves tier 0
from "solvent in 82% of vanilla's market-years" to "62%", i.e. onto the line the price decline then has to push it over. The uniform level is the
better *shape* and should be revisited at −5 to −10% once the supply anchor is fixed, never at −20% or beyond.

⚠ **This SUPERSEDES ROADMAP step 9's standing "do not raise `in0` above 1.2 in the same batch"** on the user's own ruling. Two of its three reasons are
answered — "it drives rung 0 negative at base" is now the INTENT, and "closed as a lever at the current r" was measured at r = 1.467, which is the
number being changed — but **the third reason stands and is why F137 comes first**.

### 10.86.4 — THE PER-INDUSTRY UNIFORM LEVEL IS CLOSED; LADDERS MAY BE NON-GEOMETRIC; AND WHAT IS LEFT TO CUT THE MONEY PRINTING (user-ruled 2026-09-19 evening)

**The ruling, verbatim:** *"No, we won't go there, this is 'the solver' all over again, and we didn't manage to do that, too complex. Vanilla values +
uniform ladders and penalties stay, although ladders can be more complex than anchor\*A^era."* And the question it comes with: *"If going with over 1.2
as the input penalty breaks 1836 economy significantly, what can you suggest, ladder-wise, to decrease money printing? Maybe a significantly lower A,
with vanilla B (1.5, is it?)?"*

⇒ **`make_ab_config --in0-level` IS CLOSED as a design axis.** It stays in the tool (it generated `canon-lvl-a19b17`, the F139 book, and the census of
F140 needs it to price the option) but no book will use it again: a per-industry number chosen to hit a per-industry target is the solver's shape, and
the solver is the thing this project walked away from. **`in0` is ONE SCALAR. A, B and the cost ladder are UNIFORM across industries.** ⚠ **RELAXED 2026-10-13 (§10.101):** a named industry may carry its own lift for its WHOLE ladder (one number per industry line; the engines at 1.0); `--in0-level` stays closed.
⇒ **What IS opened: a ladder need not be `anchor × A^era`.** Per-tier lists are legitimate (the cost ladder has taken them since 2026-09-16,
`--cost-ladder`), so the OUTPUT and INPUT ladders may be lists too. That is a real new degree of freedom and §10.86.4.2 is what it buys.

#### 10.86.4.1 — The three things a ladder has to satisfy at once, and the identity that makes two of them fight

Written down because the answer falls out of the algebra. With `out_e` and `in_e` the ladders and `m0` the rung-0 margin the `in0` penalty leaves:

- **MARGIN at base** = `(1 + m0) × (out_e ÷ in_e) − 1` — the money printer. It is a RATIO.
- **OBSOLESCENCE** (F97's death test: a rung two back must hold < 0.20 of the frontier's value added per worker; employment per level is constant
  across an industry's rungs, so it is just VA per level) = `(out_e − in_e) ÷ (out_E − in_E)` — a DIFFERENCE.
- **CAPITAL per unit of output** = `cost_e ÷ out_e` — the F113/F117 dial: dearer means fewer frontier levels and less labour absorbed.
- and, at the anchor, **THE 1836 ERROR (F137)** = `out_e ÷ (that rung's own vanilla method's output)`, which depends on the OUTPUT ladder alone.

⭐ **A ratio and a difference cannot be flattened together by the same move.** Narrowing `out ÷ in` to kill the margin narrows `out − in` too — unless
BOTH ladders grow, which is the only way to hold a wide difference at a narrow ratio. That is the whole design space, and it is why "lower A" and
"steeper B at the top" are genuinely different answers rather than two spellings of one.

#### 10.86.4.2 — The candidate table (`tools/ladder_options.mjs`, all at `in0` 1.2, textile shown, the death test counted over all 17 industries)

| book | margin t0/t1/t2/t3 at base | death test < 0.20 | capital ÷ output at t3 | **1836 anchor error** |
|---|---|---|---|---|
| **CANON** A 2.2 / B 1.5 / C 1.9 | 5 / 55 / **127** / **233** | **16 of 17** | 0.64 | **+27.3%** |
| A 2.0 / B 1.55 / C 1.8 | 5 / 36 / 76 / 127 | 14 of 17 | 0.73 | +19.2% |
| **A 1.9 / B 1.5 / C 1.9** | 5 / 34 / 69 / 114 | 10 of 17 | 1.00 | **+15.3%** |
| A 1.9 / B 1.5 / C 1.75 | 5 / 34 / 69 / 114 | 10 of 17 | 0.78 | +15.3% |
| `canon-a19-gm` — **ALREADY MEASURED** | 5 / 34 / 69 / 114 | 10 of 17 | 0.54 | +15.3% |
| A 1.7 / B 1.5 / C 1.6 | 5 / 20 / 35 / 54 | **3 of 17** ⚠ | 0.83 | +7.5% |
| A 2.2 / **B accelerating** 1.66/3.29/6.81 / C 1.9 | 5 / 40 / 55 / **65** | **16 of 17** | 0.64 | +27.3% |

⭐ **LOWER A PAYS TWICE AND COSTS ONCE.** It cuts the margin, and because the 1836 error is `out_e ÷ vanilla's own method`, it is also **the only lever
that repairs F137**: +27.3% → +19.2% (A 2.0) → +15.3% (A 1.9) → +7.5% (A 1.7). It also shortens build time (P8) at a given capital ratio. What it costs
is the death test, and below about A 1.8 that collapses (3 of 17 at A 1.7) — the rung two back stops being poor enough to die.
⭐ **THE NON-GEOMETRIC B LADDER IS THE ONLY WAY TO CUT THE TOP MARGIN WITHOUT TOUCHING OBSOLESCENCE** — 233% → 65% with the death test unchanged at
16 of 17, because the output ladder is untouched and both ladders grow. ⚠ Its price is the raw pull: the frontier then spends **45.5% of its output
value on inputs against 22.5%**, an effective B of 1.90 at the top, and **F128 measured B 1.8 as a stall** (world GDP 0.70 over three seeds). It also
leaves the 1836 anchor error untouched. It is the interesting card, and it is the risky one.

#### 10.86.4.3 — ⭐⭐ THE USER'S OWN SUGGESTION HAS ALREADY BEEN RUN, AND IT IS THE BEST BOOK ON THE REGISTER

`canon-a19-gm` **IS** "significantly lower A with vanilla B": A 1.9 / B 1.5 / `in0` 1.2, differing from the proposal only in its cost ladder, which was
gain-matched and therefore cheap (capital ÷ output 0.54 at t3 against the canon's 0.64). Measured at n=2 (F129, session 20260917_051736), re-scored
today under the ±20% band:

| | `canon-a19-gm` | the canon |
|---|---|---|
| hard breaks | **none — the only book of six with no broken run** | run 1 at 1.30× was broken at ×1.1, intact at ×1.2 |
| loss | **6.63** | 8.57 |
| world GDP | 1.15 / 1.10 | 1.30 / 1.16 |
| **T0 ÷ rest (the old rung's share)** | **0.019** | 0.030 |
| T3 ÷ rest | **0.538** | 0.449 |
| pool W | 0.88 (seed 1: **1.04**, a soft breach) | 0.75 |

⭐⭐ **AND IT CONTRADICTS ITS OWN BASE-PRICE DEATH TEST.** The table above says A 1.9 should be WORSE at obsolescence (10 of 17 against 16 of 17);
measured, its old rung is **better** on every reading — T0 ÷ rest 0.019 against 0.030, T3 ÷ rest 0.538 against 0.449, the old rung 39.5 / 32.2% staffed
against 45%. That is §10.86.2 again, on the design side this time: **a base-price ratio is a coordinate, not a prediction**, and the death test is to be
read as a flag, not a gate.

Its one real defect is the other side of the same coin — the cheap frontier absorbs too much labour (pool W 1.04 in one seed = full depeasantation)
and world GDP sits above the aim. That is the COST ladder's doing, not A's.

⇒ **THE RECOMMENDATION: `A 1.9 / B 1.5 / in0 1.2 / cost = anchor × 1.75^era`** — the measured book with ONE lever moved, the cost slope, from 0.54 to
0.78 capital per unit of output at the frontier. It cuts the base margin ladder from 5/55/127/233 to 5/34/69/114, cuts the F137 anchor error nearly in
half, and takes the labour absorption and world GDP back down toward the aim from a book that already has no hard break. **The accelerating-B ladder is
the batch after it, not beside it** — it is the sharper instrument for the top rungs and it needs its own seed pair, because combining it with a changed
A would make the result unreadable.

#### 10.86.4.4 — ⭐⭐ THE ACCELERATING INPUT LADDER IS BUILT (2026-09-20): `make_ab_config --in-ladder`, and the candidate `probe-accel-slide`

§10.86.4.3 closes by saying the accelerating-B ladder "is the batch after it, not beside it … it needs its own seed pair". It now exists as a flag and
as a book. **`--in-ladder m1,m2,m3`** is the exact counterpart of `--cost-ladder`: it replaces `B^k` with an explicit per-tier list, still ONE list for
every industry, so it exercises the non-geometric freedom the 2026-09-19 ruling opened without reopening the per-industry level the same ruling closed.
`--B` becomes optional and `_ab.B` is then **null** rather than a stamp that lies; `_ab.in_ladder` carries the ladder and **L31 re-derives input value
from it**, taught rather than bypassed. Proven both ways by sabotage: stripping `_ab.in_ladder` from a copy fails 22 rungs, and hand-editing one t3
input fails that rung by name (`steel e3: input value £16530, the era rule says £14100 … 4.700 at ladder index 3`). Below the anchor (`k < 0` under
`--anchor-for`) the list is extended geometrically from its own first step, `m_1^k`, which is identically `B^k` for a geometric ladder — so a slid
industry's lowest rung is treated the same either way and no existing book moves (L31 still passes on the canon and on `probe-anch-costslide`).

**The candidate: `probe-accel-slide` = `probe-anch-costslide` with the input ladder `1 / 1.5 / 2.6 / 4.7` in place of `1 / 1.5 / 2.25 / 3.375`.** One
lever; the economic field diff is `inputs` on 22 rungs and nothing else. Measured **from the books themselves**, slide included — ⚠ NOT from
`ladder_options`, which does not model `--anchor-for` and so reads a slid book one rung high:

| book | F97 death test | value added per top-rung level | ÷ working | paper t3 margin | unslid t3 median |
|---|---|---|---|---|---|
| `probe-anch-costslide` (B 1.5) | 24/24 | £10,892 | 1.000 | 426% | 360% |
| `probe-b16-slide` (flat B 1.6) | 24/24 | £10,210 | 0.937 | 333% | 279% |
| **`probe-accel-slide` (1/1.5/2.6/4.7)** | **24/24** | **£9,789** | **0.899** | **277%** | **230%** |

⭐ **The death test does not move at all**, which is the property §10.86.4 predicted and the reason this instrument is preferred to a lower A: raising
the top rung's inputs moves the value-added numerator and denominator together. `building_cost` is untouched, so capital per unit of output and ROADMAP
step 8's **P8** build-time complaint are unchanged; t0 and t1 input value are identical, so **F137's 1836 anchor error is exactly as before (+27.3%)**
and T0's economics do not move.

⭐ **Why it lands on paper, without being a per-industry lever.** The anchor slide put the eight industries whose 1836 mass sits on t1 one ladder index
lower, so their top rung reads index 2 (×2.6) while the unslid nine read index 3 (×4.7). Input value moves **×1.000 / ×1.000 / ×1.155 / ×1.393** for the
unslid set against **×1.000 / ×1.000 / ×1.000 / ×1.156** for the slid one. The acceleration therefore falls on exactly the industries that were never
shifted down and whose top rungs stayed fattest — paper, the art academy, arms, motor, explosives — which is what the user asked for on 2026-09-20
("paper needs nerfing stronger") arrived at by a uniform rule rather than by naming paper.

⚠ **The numbers above are DESIGN COORDINATES, not predictions** (§10.86.2). F139 measured the market compressing a designed 5/55/127/233 into a realised
26/31/47/46, so the designed cuts will not appear as realised ones. The column that carries the GDP expectation is value added per frontier level
(×0.899), and the standing warning is F128: a base-price gain match UNDERSTATES the price channel, and B 1.8 gain-matched STALLED at 0.70.

#### 10.86.5 — INSOLVENCY IS NOT A BINARY: THE READING IS HOW MUCH OF THE 1836 INDUSTRY SURVIVES THE ADJUSTMENT (user-ruled 2026-09-19)

**The user, on the tier-0 penalty census:** *"It's important to understand the total output or employment of the 1836.1.1 insolvent industry. Shedding
half of the workforce and becoming profitable is OK, shedding 95% is death."*

⇒ **A count of loss-making cells is the wrong unit and F140's headline is therefore incomplete.** The engine lays a building off before it demolishes
it, so an insolvent industry does not vanish: it sheds staffing until its output price recovers, and the design question is where that stops. The
measure is **staffed levels retained**, with workers and output derived from them, and it is read PER INDUSTRY (all rungs summed) because vanilla has
one glassworks type where the mod has a t0 and a t1 — a per-TYPE comparison across the arms is not like for like.

**THE BANDS** (`tools/testbed/ledger/early_probe.mjs`): **intact ≥ 85% · an adjustment ≥ 50% · WOUNDED ≥ 20% · DYING ≥ 10% · DEAD below**, plus the
headline "what share of the 1836 tiered WORKFORCE sits in a type that has shed more than half / 80% / 90%".

⭐ **AND VANILLA SHEDS TOO, WHICH IS THE BASELINE THIS IS JUDGED AGAINST** — measured in the probe's own control arm over 1836 → 1838: glass retains
**73%** of its staffed levels (ending at an 18% margin), explosives 75%, munition 82%, artillery 92%, everything else 92–112%. So "an industry that
sheds a quarter of its workforce in the first two years" is VANILLA'S OWN BEHAVIOUR at the anchor, not a defect of ours.

#### 10.86.6 — THE GRADED TIER-0 PENALTY: BY INDUSTRY, NOT BY GOOD (user-ruled 2026-09-19)

**The ruling that opened it:** *"Let's experiment on different in0 depending on how manufactured its inputs are. The 'higher manufactured' they are, the
smaller the in0 penalty should be. An input which input is itself manufactured gives squared effects. For the purpose of this, dyes, silk and
electricity are raw."*
**The ruling that settled its shape:** *"Nah, 1830s is what matters for this question. And it seems that per good or per industry is almost the same
for e0, so let's go for per industry for simplicity."*

**THE MECHANISM (F143 §3a).** A uniform `in0` COMPOUNDS down the chain: an industry eating a manufactured good pays its own penalty AND the price rise
its supplier's penalty caused, so a second-stage industry carries roughly the square of a first-stage one. Motor is the measured proof — its tier-0 rung
is at a 0% base margin against vanilla's +20%, engines are bid to 175% of base against vanilla's 148%, and it builds half vanilla's levels.

**THE RULE, implemented as `make_ab_config --in0-stage <raw>,<stage1>,<stage2>`.** It is a RULE derived from the recipe book, which is what separates it
from the CLOSED `--in0-level` axis (§10.86.4): nothing is chosen per industry by hand.
- a good's **STAGE** = 0 if raw, else 1 + the value-weighted mean stage of ITS OWN first rung's inputs. **RAW BY RULING: dye, silk, electricity.**
  Derived: automobiles 2.20 · engines 2.00 · fine_art 2.00 · ammunition 1.76 · explosives 1.38 · telephones 1.14 · every other tiered good 1.00.
- an industry's **LIFT** = the three given values interpolated on the value-weighted mean stage of **its TIER-0 inputs**, applied to every rung (the
  ladder stays anchored on the lifted rung 0).

**PER INDUSTRY, NOT PER GOOD — and the reason it is free.** Interpolating on the mean stage equals the value-weighted mean of per-good lifts whenever a
basket's inputs sit in one linear segment of the scheme, so the two rules are **identical at tier 0 for every industry that stands on the 1836 map**
(explosives, the only mixed tier-0 basket, comes out ×1.419 either way). They diverge only where a basket straddles the kink at stage 1, and in practice
only at the HIGHER rungs, where the input mix becomes far more manufactured than the tier-0 mix the rule keys on — artillery t3 ×1.550 against ×1.244
per-good (−19.8%), tooling t3 −17.8%, arms t1–t3 −14 to −18%, motor t3 **+13.0%**, automotive t3 **+14.2%**.
⇒ The simplification is paid for entirely in the frontier rungs' input bill, and it is paid in the direction the money printer wants (a HIGHER bill on
the war and tooling frontiers). ⚠ The honest statement of the cost: **arms t0 eats iron and hardwood, but arms t2 is 78% steel and tools, and the rule
taxes that frontier as though it still ate raw goods.** Revisit if the frontier's input bill ever becomes the binding question; for the 1830s, which is
what this lever is for, the choice is a no-op.

#### 10.86.7 — THE SUPPLIER-SIDE TERM: an industry is relieved for what it SELLS as well as for what it BUYS (user-ruled 2026-09-19)

**The ruling:** *"I also do like the idea that 'rawness score' (that leads to higher in0) is reduced a bit not only for the manufacturers with
manufactured inputs, but also for their suppliers."* And on the weighting: *"At this moment, derive from 1836, and we'll balance the late game later.
Since A/B, we still should have improvement at higher eras."*

**WHY IT EXISTS.** §10.86.6's rule relieves an industry for what it BUYS, and F145 measured the consequence: it cannot reach **steel**, whose inputs are
iron and coal, and steel is the binding constraint of the whole chain — demand 0.97 of vanilla, supply three quarters, **18% of its early prices at the
+75% ceiling in the SHIPPED CANON** where vanilla never touches it. This term reaches it from the other side.

**THE RULE, implemented as `make_ab_config --in0-supplier <k>` (requires `--in0-stage`).**

⭐⭐ **IT IS A BINARY POINT, NOT A WEIGHTED SHARE, AND IT COUNTS ONLY 1836-PRESENT CONSUMERS** — the user, correcting the first implementation twice in
a row: *"I don't understand the talk about levels though. Where does it become level-weighed? I thought the being an input of a manufacturer is a
binary state"*, then *"Not even that. w(g) = 1 if any tiered rung present in 1836 consumes its output good"*, and *"it's a point score, with other
points coming from DEPENDING on industrial outputs"*. **Both corrections were right and the level-weighting was mine, not asked for.**

**w(g) = 1 if any tiered rung STANDING ON THE 1836 MAP consumes the industry's own output good, else 0.** The score is ADDITIVE POINTS:
**effective stage = the input-side score (§10.86.6) + k × w**, and the lift is interpolated on that.
- Presence is read from the committed `config/start_baseline.json` — a CONFIG artifact — so the generator needs **no build output and no measured
  data**, and the rule is a property of the recipe book and the 1836 map alone.
- **It removes the tier instability that was the one serious objection to the whole term**: the share version read steel 1.00 at 1836 and 0.31 at 1910,
  and the lift anchors every rung, so a tier-dependent weight was an anchor-time number doing a century-long job. A binary point is tier-stable.
- ⚠ The share version also asked the **wrong question** — how much of my output *my own ladder* takes — when the question is whether my output is an
  INTERMEDIATE good. Tools sold to vanilla's construction sectors, farms and mines are just as intermediate as tools sold to our furniture works.
- `--in0-supplier-mode any` counts a rung at any tier; `share` restores the proportionate version. Both kept for A/B only.

**THE PARTITION — the five industries with a NAMED 1836 CONSUMER:**

| w = 1 (earns the supplier point) | who consumes it, on the 1836 map |
|---|---|
| **steel** | tooling t2, motor t0 |
| **tooling** | furniture t1 |
| **paper** | art academy t0 |
| **fertilizer** | explosives t0 |
| **explosives** | munition t1 |

| w = 0 | why |
|---|---|
| food · textile · furniture · glass · arms · artillery · munition · automotive · electrics · art academy | nobody in the ladder buys their output — pops and the army do |
| **motor** | engines' only buyer, **automotive, does not exist in 1836** (it would score 1 under `--in0-supplier-mode any`) |
| **synthetics** | **dye is RAW by the ruling, applied symmetrically** — a producer earns no supplier point for selling a good the ruling calls raw |

**At `k = 0.5` on the 1.40 / 1.20 / 1.10 ladder:** **steel, tooling, paper and fertilizer ×1.400 → ×1.300** · explosives ×1.325 → ×1.225 ·
**everything else unchanged** (motor ×1.200, synthetics ×1.305, the academy ×1.200, automotive ×1.180, and food / textile / furniture / glass / arms /
artillery at the full ×1.400). ⭐ `w(steel) = 1` is the point of the whole term: steel is F145's binding constraint and no input-keyed rule can reach it.

⚠ **What the rule spends that it need not**: **tooling and paper are among the healthiest industries at every `in0` tested** — never negative in any
arm — and they take the same −0.10 as steel. That is the price of a rule over a fit, and it is cheap; noted so it is not mistaken for a finding.
⚠ `config/mod_config.probe-gradsup.json` (grad-a + `--in0-supplier 0.5`) is generated, L20 clean and dry-run built clean. **NOT RUN.**
---

## §10.87 — ⭐⭐⭐ REPORT TRUE PROFITS; PREDICT THE WAGE FROM THE ECONOMY AND THE DECADE (user-ruled 2026-09-20, GOVERNING for every report and every design tool)

**The user, 2026-09-20, in two sentences:**
> *"in reports, always report true profits, not margins (= value added / input value)"*
> *"in predictions, try assuming the actual wage share by estimating individual wages and applying profession multipliers.
> Note that an industry tier doesn't have a 'predicted wage', the decade and the economy does (e.g. 'stalling GBR in 1920')."*

Both are about the same defect, and F150 had found its third face the day before: **we were quoting a RATIO whose wage term
was either assumed (a flat `wage_pct` of 0.25) or unreconcilable (F92's identity, which mixed market and base prices).**

### 10.87.1 — REPORTS QUOTE PROFIT IN £

Every report, ledger table and finding quotes **profit in £** — per week, with the annual figure and the per-staffed-level
figure where they help, and per construction point where capital is the question. A margin may sit BESIDE it; it may never
replace it and may never be the headline. Implemented in `e0_survivors.mjs`, `rung_econ.mjs`, `early_probe.mjs`,
`slid_vs_unslid.mjs`, `vanilla_margins.mjs` and `ladder_options.mjs`.

⚠ **A tool that cannot compute a unit-correct margin prints NO margin** rather than the old one. `rung_econ.mjs` and
`slid_vs_unslid.mjs` aggregate one rung over EVERY market at every price, so there is no single output price to re-value
`va_out` at; they now print profit and say why the margin column is gone. A wrong number is worse than an absent one.

### 10.87.2 — ⭐⭐ THE WAGE IS THE ECONOMY'S AND THE DECADE'S — `tools/lib_wage_model.mjs`

    W (£/week) = wage(tag, year) × Σ_profession (employees × wage_weight) × staffed levels

- `wage_weight` is vanilla's own, read LIVE from `common/pop_types` (laborers 1 · clerks/machinists/soldiers 1.5 · farmers 2 ·
  shopkeepers/engineers/clergymen 3 · academics/bureaucrats 4 · aristocrats/capitalists/officers 5 · peasants 0.2 · slaves 0).
- **THE UNIT IS IN THE DEFINES**, which is what makes the save's own number usable: the engine's wage rate is *weekly £ per
  `POP_SIZE_PACKAGE` employees* (`NORMAL_WAGE_RATE_FALLBACK` and `MINIMUM_WAGE_RATE` both say so; `POP_SIZE_PACKAGE` = 10,000),
  so **£ per employee per week = a summary's `base_wage` ÷ 10,000**. GBR 1840 reads 0.0610 against F26's independently
  measured 0.0610 Austrian / 0.0796 Belgian.
- `config/measured_base_wages.json` is the committed path — the normal rate per tag per year, median over the vanilla n=16
  baseline, 17 tags. Regenerate with `tools/measure_wage_share.mjs --write-wages`.
- ⭐⭐⭐ **THERE IS NO PREMIUM AND NO PROFIT TERM — `W = wage × wage units × staffed levels` IS THE WHOLE MODEL** (F152 §10,
  settled against the game's own building panel and the save's own fields; it RETIRES the 1.52× first published here and
  the `1.19 + 0.30 × profit` that briefly replaced it — BOTH were artefacts of approximating revenue as base-priced
  `va_out` × a price multiplier, whose residual sat exactly where the wage bill was being read).
  Scored against the EXACT bill a save reports (`goods_sales − goods_cost − profit`), `base_wage/10,000 × wage units ×
  staffed levels` reads **0.85 / 0.92 / 0.99 / 0.99 / 1.01 / 1.09** at 1836.2 / 1836.10 / 1857 / 1877 / 1897 / 1921 — right
  to ~1% in the median for most of the century, the two low readings being the opening year before wages settle.
  ⚠ The per-building spread is real and wide (p10 ≈ 0.45, p90 ≈ 1.6–1.8): a single building is not predictable to better
  than a factor of two. ⚠ The claim built on the retired coefficients — that a recipe cannot set a margin because the wage
  damps it by 1/1.30 — is withdrawn with them.
  ⭐ **`profit = revenue − inputs − wages`, and DIVIDENDS AND SUBSIDIES SIT BELOW IT** (the user, reading a live game
  2026-09-20: a building paid a 6.13k dividend against 5.51k of profit and ran its reserves down for it). So
  `profit_after_reserves` — what the summary already calls `profit` — IS the clean pre-distribution figure §10.87.1 asks
  reports to quote. ⭐ **Save-summary v9 carries `goods_sales`, `goods_cost` and `salary_w`**, so from v9 on wages,
  revenue, inputs and profit are all READ and none of this is modelled at all.
  ⭐⭐ **THE DESIGN CONSEQUENCE IS LARGER THAN THE ARITHMETIC: A RECIPE CANNOT SET A BUILDING'S MARGIN.** Solving the line
  above gives `P = (R − I − 1.19·Wm) ÷ 1.30`, so **every designed margin is damped by 1/1.30 before a single price moves** —
  a second, purely mechanical compression channel beside the price one, and one mechanism behind F139's designed
  5 / 55 / 127 / 233 realising as 26 / 31 / 47 / 46. It sharpens §10.86.2 rather than contradicting it.
  ⚠ Vanilla's per-profession weights are directionally right and imperfect in detail (a refit gives shopkeepers 5.65 against
  3, machinists 1.03 against 1.5) — NOT adopted: it buys 0.394 → 0.338 of scatter and returns −11.5 for clergymen.

⚠⚠ **THE FLAT `wage_pct` = 0.25 IS RETIRED FROM EVERY PREDICTION**, and it was never merely imprecise: **vanilla's own wage
share of TOTAL COST runs 54.6% at 1840 → 29.7% at 1935**, i.e. 25% is below vanilla's range in every decade of the century.
It is worst where a building's cost is nearly all labour — the **ART ACADEMY**, whose jobs live in its OWNERSHIP PMG, so
`t.employment` is empty and a share of GOODS charged it almost nothing (its base-price margin read +108% / +313%, F143 §1a).
`lib_wage_model.tierEmployment()` is the fix: a tier with no employment of its own falls back to the base method of each of
its industry's secondary PMGs, returning the PROFESSION MAP because a wage needs the weights. The academy reads 9,500 wage
units a level against textile's 6,000, and becomes the worst tier-0 rung in the book.

⚠ **`wage_pct` SURVIVES AS A CONFIG-SIDE ACCOUNTING CONVENTION AND NOTHING ELSE** — it is what `make_ab_config` restates
`target_be` with and what `lint_solvency.mjs` (landmine L18) gates on. Neither was changed here, deliberately: L18 is a HARD
gate on the shipped book, and restating `target_be` would move every building's emitted NAME, which would have stopped the
electricity canonization (§10.43.0) being the provable two-key diff it had to be. Re-basing those two on the wage model is
OPEN and needs its own ruling and its own pass.

### 10.87.3 — ⭐⭐ THE MARGIN IDENTITY, REPAIRED (F150 → F152)

F92 shipped `margin = profit ÷ (va_out − profit)` on the reasoning that total cost is revenue minus profit. The reasoning is
right; the substitution is not. **`va_out` / `va_in` are the save's goods flows priced at BASE cost** (save_state_summary
prices them with `common/goods`' `cost =`) while **`profit` is the game's own figure at MARKET prices**, so the old ratio put
a market-price numerator over a base-price denominator. The repair:

    R = va_out × Σ_g share_g × (price_g ÷ base_g)      the ACTIVE methods' goods mix, at that market's prices
    margin = profit ÷ (R − profit)                     because R − profit ≡ inputs + wages, by definition

**Validated**: the implied wage bill `R − I − profit` is positive in **490 of 520** priced vanilla entries, against F150's
26% of entries and 45% of LEVELS negative. The 30 that remain are **shipyards** (naval-construction income is not in the
goods flows — the same fact behind their −30pp solver handicap) and **subsistence** (its own wage rules), both excluded by
name. ⇒ **`profit = revenue − inputs − wages` at market prices is CONFIRMED.**

⚠⚠ **IT IS UNDEFINED, NOT APPROXIMATE, FOR A BUILDING WITH NO GOODS FLOWS.** Financial districts, manor houses and company
headquarters read `va_out = va_in = 0` with a large positive `profit` (GBR 1900: 12 types, **£2.75M a week**).
`trueMargin()` returns null there and the caller prints the profit.

⭐ **THE 1836 ANCHOR STANDS.** At 1836 the output price sits at 0.943 of base, so on the same 145 priced manufacturing
entries the repair reads **30.5% against the legacy 30.9%**. F92's published **25.8%** is over the whole 4,002-entry sample
where 30.5% is over the 507 PRICED ones — a sample difference, not a definition one, and `vanilla_margins.mjs` now prints
both. What does NOT stand is any margin quoted where prices have left base: every century endpoint, and worst exactly where
the mod's price decline is working.

### 10.87.4 — NGF AND THE UNITED NETHERLANDS ARE IN THE SHORTLIST, THE MAJORS AND THE PRICE-TRACKED MARKETS (user-ruled 2026-09-20)

**The user:** *"add NGF and United Netherlands (NET+BEL, I'm not sure which tag in game terms) into both shortlist of
reported countries, shortest list of high-tech majors, and the list of price-tracked markets."*

The tag is **UNL**. `tools/testbed/ledger/lib_markets.mjs` is now the ONE definition of all three lists, for nine readers.

⭐ **IT IS NOT A HYPOTHETICAL COUNTRY AND IT WAS COSTING US MEMBERS.** Vanilla's own `common/country_formation` lets any
power holding Holland + Flanders + Wallonia + Friesland + Gelre form it, `ai_will_do = always`; it stands in **2 of the 16
vanilla baseline seeds from 1876** and in **run 2 of `20260920_114003_anch-costslide-century`**, where NET and BEL do not
exist and UNL holds **£201M of GDP at 1935**. Every pool listed NET and BEL and not UNL, so those seeds silently reported a
smaller, poorer shortlist with nothing failing. F151 §4 recorded the symptom; F152 §7 has the cause.

⚠ `UNL_ADJ` is **"Dutch"**, so the United Netherlands' market is still "Dutch Market" — the market NAME does not identify
its leader. Prices are keyed by TAG through `MARKET_NAMES` and the tag is resolved per run, never the reverse. The German
market reads Prussian → North German → German across the century for the same reason.

⚠⚠ **PI AND PP ARE READ ON THE INTERSECTION OF THE ARM'S MARKETS AND VANILLA'S, AND THE BASIS IS PRINTED.** The ten-tag
telemetry list of 2026-09-20 (eleven with UNL) gives a new arm German and Belgian prices that the n=16 vanilla baseline does
not have, and averaging different baskets on the two sides of a ratio is not a comparison. Those markets enter the register's
price indices the day a vanilla baseline carries them, and not before — an owed measurement, not something to assume.

**Measured effect on the register**, on the one intact run of the anchor-slide arm: pool H 3.49 → 3.54, pool GDP 1.23 → 1.21,
loss 5.50 → 5.53. The ARM's own numbers did not move; VANILLA's pool reference did, because it now counts the Low Countries
in the two seeds where they had unified.

## §10.88 — THE CANON IS TRADE ×1 AT B 1.64, WITH THE FINISH BOOST (user-ruled 2026-09-25)

**The ruling:** *"Canonize trade x1, B 1.64. The research wall clock overhead is solved elsewhere, it's zero."*

1. **The book** (`config/mod_config.canon-b164-trade.json`, copied to `config/mod_config.json`): `canon-slide-b158` regenerated at B 1.64,
   the finish boost on, plus F159 §7's per-good trade table at ×1. The tech tree is the previous canon's, byte for byte.
2. **Why these two levers:** F161 showed the trade table doubling trade and lifting world GDP 0.87 → 1.13 at B 1.58. F163's ladder (trade
   ×1.5, B 1.64–1.76) put B 1.64 lowest on the register (3.58), with the old rung's share of the higher rungs a third of the previous canon's
   and the price decline equal to it. ×1.5 bought only ×1.03 the trade of ×1, so the scale stays at 1.
3. **The trade-off the user named**, on F163's pooled slopes: raising B or C costs GDP and obsolescence and dampens runoff. The hoard
   is B's clearest effect (pool H −16.5 per unit ln B); prices and the old rung move the wrong way with B (directional).
4. **The finish boost stays:** F164 measured no wall-clock cost, and F163's modelled-cost reading (1.08× vanilla, the previous batches
   1.06–1.09) agrees. Its completion behaviour is as ruled on 2026-09-24 (F162): it acts at the AI's next research choice; no completion tick.
5. **Unmeasured as a combination:** trade ×1 at B 1.64 with the boost has not run; F163's slope places it near world GDP 1.05–1.1.

## §10.89 — HYDRO-DAM MEGAPROJECTS, AND THE POWER PLANT AT 4× CONSTRUCTION COST (user-ruled 2026-09-26; ROADMAP step 6)

**Status: IMPLEMENTED as a test book (`config/mod_config.canon-dams.json`), NOT canonical.** Generator `tools/emit_dams.mjs`, numbers
`tools/lib_dams.mjs` (ONE derivation), project table `config/dam_projects.json` (from `tools/make_dam_projects.mjs`), book from
`tools/make_dam_config.mjs`; the power plant's cost by `tools/emit_building_costs.mjs`.

### 10.89.1 — The power plant costs 4 × vanilla (1,600 points), its recipe untouched — REVERSES the 2026-09-19 "power stays vanilla" ruling
The user, 2026-09-26: *"let's just make vanilla power plants more expensive without changing their recipes. Defer judgement on whether we
need to improve their consumers' recipes (as electricity will become more scarce and expensive) until tests."* Measured on the canon's
1936 saves (n=3): electricity is **2.1% of world GDP** (the US 2.3% against ~2.4% historically — the output share is right), but a power
plant carries **2.3 years of revenue in capital, the same as the average building** (2.2–2.5), where 1930s utilities carried ~4–5 against
manufacturing's ~1 (recalled, not sourced — a 3–5× range). 4× restores the ratio; the building stands for the whole utility (the game has
no grid building). ⚠ What it moves is the SPEED of supply, not profitability: with no interest rate every profitable plant pays back, and
4× only stretches the time (~3 → ~11 years at the 175% ceiling) and quarters the plant levels a construction sector adds per year. The
AI's private scoring divides by (1 + cost × 0.000125): 1.05 → 1.2, a small dent. ⇒ **The test's signal**: electricity pinned at the ceiling
in the majors' markets by ~1920 means 3× or softer consumer recipes.
⭐ **READ AND RULED 2026-10-21 (POLISH_1_0.md Q6): the consumers' recipes are KEPT.** On the canon (F247, n=4) electricity reads 25–122% of base
in the American, British, French and German markets at 1920 (October's vanilla 73–140%) and touches the ceiling once, in one American market at
1930 — the dams supply the cheap power the 4× plant cost does not touch. The signal did not fire.

### 10.89.2 — What a dam is
- **One PROJECT per state** (159), each the research rows (`hydro_1930s_feasible.csv`, 134 projects feasible with 1930s engineering) that
  fall in it, merged; a border plant belongs to the state that CONSUMED its power ("geography is not paramount"), reviewed case by case
  (Hoover → California by ruling; Ottawa/Gatineau → Ontario; Susquehanna 2 PA / 1 MD; Iron Gates split Wallachia/E. Serbia; Tabqa → Aleppo;
  Bhutan → West Bengal; Baluchaung → Pegu; Kainji → Hausaland; Paulo Afonso 2 Bahia / 2 Pernambuco; Cañón del Pato → Lima).
- **No personal names** (user-ruled): a dam named for a person or a company is renamed for its river, gorge or locality; exceptions are
  dynasty surnames, "Victoria", and any place name already in use by 1836 (Hoover → Black Canyon, Churchill Falls → Labrador Plateau,
  Moses–Saunders → Long Sault, Dneproges → Dnieper Rapids, Volgograd → Tsaritsyn, Keokuk → Des Moines Rapids, …).
- **Anchored to one province**: every stage's `possible` requires the building state to be the split part owning the anchor province
  (`owner ?= p:<prov>.state.owner`, vanilla's Victoria Terminus pattern) — only the true province owner's side can build (user, 2026-09-26).
- **STAGES**: unique single-level buildings `building_dam_<id>_<k>` (`unique` = never built by private investors; group
  `bg_pmr_hydro_dams`, government-funded, so never privatised and always carried by the state), ALL opening when the survey completes so a
  country with the construction capacity builds them in parallel (a sequential chain would put a 19-stage project at decades).

### 10.89.3 — The cost model (the go-ahead, 2026-09-26)
`points per MW = 0.4 × (power-plant points ÷ 50) × 1.2 × m × (MW per part ÷ 560)^−0.2`; `electricity per MW = 0.52`.
- **0.4 electricity per MW of capacity** — vanilla's 1936 world electricity (~49k/wk; the canon ~54k) against ~100–120 GW real: one coal level
  ≈ 125 MW (per country the ratio runs 65–350 MW a level, so this is the low-middle — NOT an overestimate of the plant).
- **× 1.3 for output** (0.52) — hydro ran baseload (~50–60% of nameplate) against 1930s steam's ~35–45%.
- **1.2** — hydro's capital cost per kW over thermal at a Dneproges-class site (1930s: Hoover ~$90/kW, Grand Coulee ~$80, Bonneville ~$170,
  Conowingo ~$200 against thermal ~$100–125; recalled). An earlier draft used 2.0; the user rejected the result ("five plants combined with
  hardly any benefits but with added hassle") and the evidence says the giants were the CHEAPEST per kW.
- **m** — the research's terrain multiplier (Dneproges 1.0, Niagara 0.5, Hoover 1.6, Fort Peck 2.5); **the scale term** — twice the size ≈
  13% cheaper per MW ("recoup at scale").
- The power-plant points are read from the book, so dams re-price with the 4× plant: Dneproges ≈ 8,600 points for ~290 electricity/week
  (5.8 coal plants' output for ~5.4 coal plants' cost, with no fuel).
- **Stages ≤ 10,000 points** — the user allowed ~+20% construction speed over the technologies' 35–40/week, so ≈ 42/week ⇒ ≤ 4.6 years.
  Result: 349 stages, median project 2, median stage ~7,500 points (~3.4 years), largest project 19 (the Columbia).
- **Staff** per 50 electricity: 50 laborers, 100 machinists, 50 engineers (a fifth of a coal plant); **upkeep** 1 tools + 1 engines (no
  electrical-equipment good exists; engines are the coal plant's own turbine stand-in) — ~7% of revenue.
- At the user's expected sale price of ~50% of base, a Dneproges-class dam pays back like a coal plant at 100% (~10 years); Niagara-class
  sites ~5, Hoover ~17, Fort Peck ~26.

### 10.89.4 — The technology classes (per STAGE)
A falls / high-head / escarpment / lake-outlet → `electrical_generation` (game era 3); B cascades / gorges / mid dams → `steam_turbine`
(game era 4, the turbine-generator); C large rivers / high dams / lowland earthfill → `arc_welding` (game era 5, welded penstocks). A
merged project's stages are shared out over its rows' classes in proportion to their points, earliest class first, and the survey opens
with the earliest class — so Niagara's falls open in tech era 3 though Long Sault supplies most of the New York project.

### 10.89.5 — The survey (user: ~1,000 bureaucracy, 1–3 years, varying)
A decision shown to the anchor province's owner and every country above it in its overlord chain — never to a great power as such, never
to an investor — once the class technology is held; one survey per project world-wide. It adds a `country_bureaucracy_cost_add` modifier
and a counter journal entry (vanilla's canal pattern). **Length** 12 / 18 / 24 months by class, +6 above 1.5 GW, +6 above 4 GW, ≤ 36;
**cost** 1,000 × (project points ÷ 20,000)^0.3 in [500, 1,500] (median ~850). On completion a GLOBAL variable opens the stages.
⚠ **The surveyor has NO exclusive right, and cannot have one**: a building's `possible` and `ai_value` are evaluated in the STATE's scope
(`common/buildings/buildings.md`) and cannot see who is constructing. So the right to build is the anchor owner's overlord chain as a whole
from the day the survey completes, which satisfies the user's "two idle years ⇒ free for all" rule trivially.

### 10.89.6 — AI: a quarterly DRIVER, because the engine's AI can do neither half (probes p1–p5, 2026-09-26)
Two engine facts, each measured, forced this:
1. **The AI takes every visible decision in one pass** — it scores them all before taking any, so neither a low `ai_chance` nor a
   "surveys under way" counter stops a country taking several surveys the same day (p1–p3: Britain five, then four; Russia four,
   twice), and the combined bureaucracy cost drove it into deficit and cancellation (72 in p2).
2. **The government AI never queues a dam stage on its own** (p1, p2: zero in any queue while force-started stages built and fired
   their effects), whatever the `ai_value`.
⇒ The survey decision is the PLAYER's (`ai_chance` 0). AI countries survey and build through `pmr_dam_driver` on
`on_monthly_pulse_country` with a 90-day cooldown: an AI country holding `electrical_generation`, not at war, not in default, scaled
debt under 0.5 (a SUBJECT also under 0.1 and at a positive fixed income — "subjects step in if economically feasible"; an overlord
"always tries unless heavily burdened"), starts per quarter at most ONE survey (while its surveys under way < 1 + one per £100M / £300M
of GDP) and at most ONE stage (while its dam stages under construction < 1 + one per £50M / 100M / 200M / 350M / 500M of GDP),
taking the first open project in the table's order (largest first) in its own states or its subjects'. A stage under construction is
never re-started, and a started project is passed over for a year (p4: otherwise one stuck project held a country's queue).
⚠ **`start_building_construction` queues for the STATE'S OWNER**, so an overlord's survey of a subject's site is built by the subject
at the subject's cost — and never, where the subject has no construction (Britain's Columbia in the Oregon Country, retried once a year).
Vanilla's government AI does build in subjects (`GOVERNMENT_CONSTRUCTION_SUBJECT_INVESTMENT_BIAS = 1.5`), but not these buildings.
**No electricity-price condition anywhere** (user: *"Dams are a foundation for future industry, not a reaction on high electricity
demand"*). The stages keep `ai_value` 30,000 (×0.1 at war or in default) in case the engine's AI ever does take them.
**Cancellation** only in default (vanilla's canal AI never cancels). **Telemetry** (user, 2026-09-26: *"we will need to understand
which countries went for the surveys"*, and the bureaucracy balance beside it): `PMR_DAM|<event>|<project>|<country name>|<date>|bur
<produced>/<used>` for survey_start / survey_month / survey_stop / survey_complete / survey_ended and stage_start, `built` / `complete`,
and a yearly `bur_year` line for every country holding `electrical_generation` with its surveys and stages under way.

### 10.89.7 — Non-power effects (user: "aligned with how much better than the world average the place has become"; "no bonus is about as effective per unit of input and labour as elsewhere")
The irrigation research found 8 material and 4 marginal cases; **no cotton-specific bonus is justified** (Egypt's lead is the Delta's,
which predates the dam and vanilla's Nile trait already gives). Mechanism: `add_arable_land` and trait swaps from `on_building_built`
(the Hokkaido wetlands→plain precedent), targets named explicitly because three dams water another state.
- **1836 maluses** (the user's "if it was worse and then became average, maluses it is"): Middle and Upper Egypt `Basin Irrigation`
  (agriculture and plantations −0.1 over vanilla's Nile +0.2); Blue Nile `Rain-fed Plain` (−0.2). Aswan (First Cataract) removes Middle
  Egypt's (+8 arable); Upper Egypt keeps it (its conversion came only with the High Dam, which is out of scope); Sennar removes Blue Nile's
  (+12 arable). The Nile trait itself is kept: a vanilla trigger tests for it. Lower Egypt and Dongola untouched.
- **On completion**: Washington +15 (Columbia Basin), Armenia +8, Elizavetpol +5 / Azerbaijan +4 (Mingachevir), California +5 (Coachella),
  Taurida +5 and drought impact −0.15 (Kakhovka; fires when the whole project stands), Tennessee flood impact −0.15, Alabama and
  Kentucky −0.1 (TVA), marginal +3 Pashtunistan, +3 Tajikistan, +1 New South Wales. Flood modifiers do nothing in vanilla's
  flood-exempt regions (Egypt, Sudan, Central Asia, the Dakotas), so none is placed there.

### 10.89.8 — Vanilla electricity site bonuses removed
The electricity line (`goods_output_electricity_mult`) of `state_trait_niagara_falls`, `krka_falls`, `angara_river`,
`trondhjemsfjorden` and `hardangerfjorden` is commented out in whole-file copies of their four vanilla trait files (every other line
vanilla's, asserted). The generic power-plant bonuses (an event modifier, seven company prosperity lines) are kept.

### 10.89.9 — THE REDESIGN (user-ruled 2026-09-26 evening; probes p6–p11, FINDINGS F169) — supersedes the stage buildings of §10.89.2 and the owner-queue driver of §10.89.6
The first century run (`canon-dams-n1`, the §10.89.2 design) is the record of that design. The user then ruled, in order:
*"I really dislike that stages … are different buildings"*; *"I'd prefer the rich overlord building the megaprojects"*; ownership must
never evaporate on privatisation, and the dam must be subsidised whoever owns it; concurrent builders should share the levels like a
deposit (*"no need to invent something very custom"*) but *"a 95% built dam dropped or stalled because someone else beat you … is
unacceptable"*. What ships now:
- **ONE building per project**, `building_dam_<id>`, `expandable`, up to `stages` levels (the cap: vanilla's trade-centre idiom
  `level_after_queued_constructions`, counted over every queued level). `potential` lists it only in the split part holding the anchor
  province and only once someone in the chain has surveyed it (`<v>_surveyed_any`).
- **Not government-funded**: the group sits under `bg_private_infrastructure` (a government-funded building cannot be built by another
  country), `can_build_private = { always = no }` keeps investors out (the skyscraper idiom), and **`can_build_government` reads the
  builder through `scope:investor_country`** (vanilla's trade-centre trigger — the builder IS visible, §10.89.5's "invisible" was wrong):
  it must be the anchor owner or above it in the chain, have completed its OWN survey, hold the technology of the next level's class
  (per level; the dam carries NO `unlocking_technologies`, because `create_building` demands the HOST's technology — p7), and no
  overlord may be financing the dam at that moment.
- **Surveys** per country (`<v>_surveyed` on the surveyor); a completed survey sets a two-year global claim during which nobody else may
  survey; surveying stops once every level is taken.
- ⭐ **THE OVERLORD FINANCES** (p8–p11): `start_building_construction` queues only for the state OWNER (p6: Britain's starts in Canada
  and the Oregon Country landed in the subjects' queues and sat forever where they had no construction) and the engine's AI never
  queues a dam. So an overlord that surveyed a subject's site FINANCES a level: a journal entry pays points × £540 (steel frame, base
  prices) in monthly instalments over the time a normal build takes at 42 points a week, then `create_building` +
  `add_ownership` sets the financier's holding to one more level — the level is the OVERLORD's (p8: Britain owns the Columbia in the
  Oregon Country, Russia Kemi–Oulu in Finland, the Ottomans Tabqa in Egypt). ⚠ `create_building` cannot take `level` with an ownership
  block (p9, "mutually exclusive" — it then ADDS the levels to the host), and the ownership block's `levels` SETS a holding. While a
  level is financed nobody else may build the dam, and financing starts only when nothing of the dam is under construction — so no
  construction is ever wasted. AI overlords finance through the driver; a player overlord through the `<v>_finance_decision`.
- **The AI driver** (quarterly): one survey, one owner-queue construction where it owns the anchor state and surveyed, and one financed
  level in a subject's state, within the GDP-scaled slots (financed levels count in them); a subject surveys its own site only when no
  overlord above holds the technology unburdened.
- **Ownership and privatisation**: every level is owned by its builder's government (p6: Laissez-faire USA and France included — none
  offered for sale in four years); `ai_nationalization_desire = 0.75` on every dam (the AI privatises below 0 and nationalises above 1;
  ⚠ the documented `ai_privatization_deisre` is REJECTED by the engine, p6); `must_have` subsidies in every administrative strategy.
- ⚠⚠ **MEASURED OVER A CENTURY (FINDINGS F170, n=1): the OWNER path stalls.** Five overlords financed levels at real dates and every
  financed level stayed the financier's, nothing was privatised — but a level queued for a state owner with little government
  construction sat 10–19 years (Japan, Sardinia, East Africa, Argentina), which is the waste the ruling forbids.
  ⭐ **RULED 2026-09-27 — THE OWNER CAPACITY GATE.** The driver queues an owner level only when the owner's GDP ≥ **4,000 × the
  level's points** (the level's goods, points × £540, at most ~2.7% of a year's GDP at a five-year pace), its construction is not
  paused (`is_construction_paused = no`) and its government queue is not stuck (`construction_queue_government_duration < 520`
  weeks); an AI survey of a site in its OWN state needs the same GDP floor. Poor countries wait until they can build; a subject's
  site still goes to a surveying overlord's financing. Calibrated on the owner starts of canon-dams-v2-n1 (21 of 27 slow levels
  blocked, 11 of 47 fast ones delayed; noisy — several levels of one dam queue in series). ⚠ Bankruptcy losses are ACCEPTED as
  vanilla (user-ruled the same day: a default wipes every government construction, dams included), with no debt gate beyond the
  driver's standing `in_default = no` / `scaled_debt < 0.5`. Progress lost when a subject's relationship to its financier changes
  is acceptable (user-ruled). No construction was lost to a builder conflict in canon-dams-v2-n1 (every loss matched a bankruptcy).
- ⚠ **What the financed path does not do**: it spends money, not construction points — the overlord's contractors are modelled as a cash
  outlay at the construction sector's goods price, so it does not compete with the overlord's own construction queue.
- ⭐ **A PLAYER OVERLORD BUILDS THROUGH THE ORDINARY BUILD MENU SINCE 2026-09-27** (user's playtest): the dam showed in a subject's
  state with *"Laxapana Falls cannot be constructed in a foreign state"* — the engine's `CANNOT_EXPAND_BUILDING_NOT_OWNABLE`. A building
  with NO `ownership_type` is treated like an administration, a barracks or a monument and is refused abroad; the trade centre, the
  ports and the power plant carry `ownership_type = self` and a foreign government can build them. Every dam now carries it, so an
  overlord's own government queue can build a level in its subject's state, owned by the overlord. The AI still has no script route to
  a foreign government queue, so AI overlords keep FINANCING. ⚠ Pending the user's confirmation in play; once confirmed, the player's
  `<v>_finance_decision` is redundant and is to be hidden from human players. ⚠ Unmeasured whether the field changes anything for the
  AI (it never queues a dam itself, and no `foreign_investment_ai_factor` is set on the group).
  ⭐ **THE TEST THE USER ASKED FOR (2026-09-27):** *"For the test, remove scripted queue adds. I suspect that the reason AI never built the
  dams without them is the same declaration that we just removed."* — F169's "the engine's AI never queued a dam" was measured only on
  dams WITHOUT an ownership_type. `dams.ai.driver_build` and `driver_finance` (default true) now switch off the driver's owner-queue
  starts and its financing; `make_dam_config --ai-self` writes `canon-dams-aiself` (+ `-probe`), where the driver only surveys. Schedules
  `dam_probe_p13_aiself.json` (1836 → 1840 on the probe book, ~7 min) and `canon_dams_aiself_n1.json` (a century), predictions inside.
  If the engine AI builds dams on its own, the scripted construction paths can go; if not, they stay.
  ⚠ **AND THE LOCK-OUT MUST BE TESTED WITH SEVERAL BUILDERS AT ONCE** (user, the same day: *"the probes need to have multiple possible
  investors to check that once one starts building, others got locked out and don't waste a lot of money there"*). No earlier probe
  had two eligible builders on one site (only the granted majors held the technology, and a completed survey is a two-year claim).
  The ai-self PROBE is therefore the CONTEST probe (`dams.probe.contest`, cost × 0.25): every subject's site starts with the owner and
  every country above it holding the technologies and a completed survey, and every standing dam logs monthly its built level and its
  level after all queued constructions (`PMR_DAM|probe_lvl` / `probe_q`). What is already known: the game does NOT re-check
  `can_build_government` on a construction under way (canon-dams-v3-n3: Britain's own last levels of Lochaber and Galloway completed
  while the cap read full). What is not: whether one builder's queued level counts in the cap another builder reads, and whether a
  poor subject owner grabs a level it cannot fund now that the driver's owner capacity gate no longer stands in front of the AI.
  ⚠ **The probe also needs a MARKET** (user: *"If noone starts building dams, this could well be because there's no electricity
  demand. Try adding some."*): nothing buys electricity before ~1880, so in an 1836 probe a dam's output has no buyer. The contest
  book's `pm_goods` gives `pm_no_public_transport` (every urban centre, ungated, from 1836) 1 electricity in per level — demand in
  every market from the first week, the price at the band edge. Probe only; the century arm needs none (its dams unlock with the
  electrical technologies, when the streetlights and factory electrification already buy electricity).

### 10.89.10 — THE CUTS AND THE CANONIZATION (user-ruled 2026-09-27; FINDINGS F171–F172)
The gated n=3 put hydro at 43–52% of world electricity at 1935, "slightly overdone … especially considering that Urban Center electricity is
also partially hydro narratively", and F172 showed electricity-using industry following the dams into empty places (the Labrador dam alone
was 10% of dam output, with Newfoundland drawing up to 578 a week). The user ruled: remove the dams where they make particularly little sense
— a very low 1836 population and no migration pull because of a bad climate — **Russian and American sites protected**; then, after a
site-by-site review of Central Asia and Transcaucasia, *"I agree on all counts. Remove everything you suggested and canonize the build."*
The cuts live in `tools/make_dam_projects.mjs`'s `CUTS` table, each with its reason:
- **Removed (12):** Labrador Plateau (Churchill Falls), Thjórsá (Iceland), the Iguaçu Falls twice (Paraná, Corrientes/Misiones), Victoria
  Falls + Kafue (Zambia), Victoria Falls (Zambezi), Kemijoki + Oulujoki (Oulu), the Grijalva (Chiapas), the lower Caroní (Bolívar), the Naryn
  (Kirghizia), the Vakhsh (Tajikistan, its +3 arable with it), the upper Irtysh (Semireche).
- **Trimmed (a research row dropped):** the lower Nelson River (Manitoba keeps the Winnipeg River), Manapouri (the South Island keeps the
  Waitaki and the Clutha), the other Norrland rivers (Norrland keeps the Lule älv), the Vorotan (Armenia keeps the Sevan–Hrazdan cascade);
  **reduced:** Rion & Ingur from 5 to 2 parts (the Rioni scale).
- **Kept after review:** Rion & Ingur (populous Georgia, a real 1933 plant), Sevan–Hrazdan, Mingachevir (its irrigation effects), the Chirchik
  (the Tashkent oasis); the Sulak (Dagestan) as Russian.
Result: **147 projects / 313 levels / 135.7 GW** (from 159 / 349 / 157.0). The book is THE CANON since the same ruling (CLAUDE.md), built on
`canon-b164-trade` with no key of it changed. ⚠ No batch has measured the cut table; expected hydro ~40–45% of world electricity at 1935.
The research sites file the generator reads is committed as `config/dam_sites_research.json` (it lived only in a session scratchpad before).
**Addendum, same day — ONE OBJECT, ONE IN-GAME PROJECT (user-ruled).** *"The case of 'one object, two consuming states' must be resolved into one
in-game object as well. It goes towards the biggest IRL consumer state if it takes up at least 70% of output (see Hoover Dam ruling).
Otherwise — strictly geographically."* (and: the Russian and American protection was from deletion on irrelevance grounds, not from
merging). Applied at once to the two unambiguous cases, as `CUTS.merge` in make_dam_projects.mjs: the Paulo Afonso falls (one site, split
2/2 Bahia/Pernambuco; CHESF sold across the whole Northeast, no state near 70% → Bahia, where the powerhouses stand) and the Snowy Mountains
(the works stand in NSW; output ~2/3 NSW, ~1/3 Victoria → NSW). **145 projects / 313 levels / 135.7 GW.** The rule's other candidates on the
list (consumer-rule placements without a verified 70% share, and straddling border objects) went to the user for rulings.

**The second round, same day (user-ruled): *"1. Romania 2. West Bengal 3. When unsure, let's go with physical, if the other candidate states
are at least 100 km away. If not, check more thoroughly."*** Every remaining case had its other candidate state within 100 km (Chelsea 18 km,
Rapides-Farmer 16, Paugan 42, Holtwood 28, Safe Harbor 39, Tabqa 6, Baluchaung 57, from the anchor provinces), so each was checked:
- **Iron Gates** — one dam on the Danube border, output 50/50 → ruled to Romania: `iron_gates_djerdap` merged into Wallachia (`CUTS.merge`).
- **Bhutan's rivers** stay in West Bengal (ruled; no change).
- **The Gatineau** — Paugan's whole output went to Ontario Hydro (stays in Ontario); Chelsea and Farmer's sold half to Ontario Hydro and
  half to CIP's Templeton mill, under 70% → physical, Quebec. `niagara_ottawa`'s Ottawa + Gatineau row 5 → 4 parts, `laurentian_rivers`' 1 → 2.
- **The Susquehanna** — Conowingo (in Maryland) was Philadelphia Electric's plant with its lines to Philadelphia; from 1931 Baltimore's
  Consolidated was entitled to all of Penn Water's energy from Holtwood and Safe Harbor (two thirds of Safe Harbor bought directly; the
  1952 appeal, 194 F.2d 89). Both pass the 70% line in the direction opposite to geography, so the two projects SWAP hosts (`CUTS.swapHosts`):
  Conowingo → Pennsylvania, the Holtwood/Safe Harbor pair → Maryland.
- **Tabqa** fed the Syrian national grid and irrigation; nothing puts Aleppo near 70% → physical: Deir-Ez-Zor (the Raqqa hub, `CUTS.relocate`,
  anchor x1ECFDA, an Ottoman state in 1836).
- **Lawpita (Baluchaung)** stays in Pegu: its 1960 first stage came with the line to Rangoon, the Mandalay line only in 1963 — Rangoon above
  70% early, the Hoover case.
The generator now throws if two projects end up in one state. **144 projects / 312 levels / 135.7 GW**; canon rebuilt and deployed.
⚠ Friction (the ruling's point b): the Iron Gates in Wallachia and Tabqa in Deir-Ez-Zor both stand in states whose 1836 owner (an Ottoman
subject, the Ottomans) is not the historical consumer; the survey goes to whoever holds the anchor in play, so this is accepted as play.

### 10.89.11 — THE ENGINE BUILDS THE DAMS; THE SCRIPT ONLY SURVEYS (user-ruled 2026-09-28; FINDINGS F173–F174) — supersedes the construction halves of §10.89.6 and §10.89.9

*"Remove all now-obsolete scripting (of all dam-related JEs and decisions only surveys should still exist). … No capacity locks / guards
yet. Check that the tech locks for building is the same as for surveying, this will likely disqualify poor and backward subjects by itself."*

The chain of evidence: the dams had no `ownership_type`, which the engine treats like an administration — refused in a foreign state
(the user's playtest), and never built by the AI (F169). With `ownership_type = self` the AI builds dams in its own states (F173); with
local electricity demand and the technologies at the overlord it also builds in its subjects' states (F174: Britain → Ceylon, Qing →
Joseon, the German Empire → Lombardy-Venetia), and the user queued the Ceylon dam by hand as Britain in a build where Ceylon lacked the
technology. So every scripted construction path was a workaround for a missing declaration, and all of them go:
- **Removed**: the driver's owner-queue starts (`start_building_construction`), the overlord FINANCING (its journal entry, its player
  decision, the `create_building` + `add_ownership` chain, the "no financing running" clause in `can_build_government`), the OWNER CAPACITY
  GATE (§10.89.9's GDP ≥ 4,000 × points / construction unpaused / queue under 520 weeks, and the GDP floor on surveys of own sites) with its
  yearly `gov_paused` / `gov_backlog` log lines, the driver's build slots, the `dams.ai.driver_*` switches, and the old race / finance probe
  tests. `make_dam_config --ai-self` throws.
- **Kept**: the survey (the player decision, the stop decision, the counter journal entry, the AI driver's survey step with its survey
  slots and its rule that a subject surveys its own site only when no unburdened overlord above holds the technology), `ownership_type =
  self`, `can_build_government` (builder in the chain, its own survey, the next level's technology, the level cap), the effects, the
  subsidies, the probe machinery (`dams.probe`: grants, contest seeding, level log, electricity consumers — probe builds only).
- **The technology locks are ONE**: the survey needs the first level's technology and building level 1 needs the same — `lib_dams` now
  DEFINES a project's `tech` as its first level's, and the emitted survey decisions and building rules were checked equal on all 144 dams
  (64 electrical generation, 47 steam turbine, 33 arc welding). A country that cannot survey cannot build, so a poor, backward subject is
  kept out until it researches the technology itself — the user's expected substitute for a capacity gate.
- ⚠ **What is not guarded**: a subject that HAS the technology may still grab a level it cannot fund (F173 §4); no capacity lock stands in
  front of it, by ruling. The first measurement is the n=5 century batch of 2026-09-28 on the canon as it now ships.

### 10.89.12 — WHO MAY SURVEY AND BUILD, AND HOW THE AI SURVEYS (user-ruled 2026-09-28; FINDINGS F176, F177) — `dams.rules = "family"`, THE CANON SINCE 2026-09-29

The rulings, in the user's words where they were given:
- **Construction rights** = the state holder and the upward chain to the top overlord; siblings only through investment rights: *"Unless
  certain power bloc principles are taken or a subject explicitly granted broad within-family investment rights, only the state holder and the
  upward chain to the top overlord has construction rights, not siblings"*; investment rights in the OWNER or in ANY country of its chain count
  (*"the case of 'has investment rights in your overlord' should be covered as well"*; p26b saw Prussia build in Norway, Sweden's subject, on its
  rights with Sweden). The power-bloc route is dropped (*"very rare to make a difference"*; no trigger for "lower rank" was found).
- **Survey sharing**: *"survey within top-overlord family unlocks the construction for the whole family, and other family members don't
  re-survey; survey outside the top-overlord family allows only the surveying country to build"*; and *"if the siblings, uncles or nephews can
  construct, then they don't need their own survey"*.
- **The 12-month block**: *"starting the survey blocks another starts a 12-month cooldown on surveys of the same dam, preventing other countries
  from taking it (visibility stays, availability displays the cooldown); instantly removed if the surveying country abandons the survey"*.
- **No claim**: *"Remove the current claim, it fills the same role, but is not natural to the game."*
- **A queued dam blocks surveys**: *"while the dam is already in the construction queue, this should block surveys of this dam for everyone"*
  (unless stalls-then-abandonment turn out common).
- **Stall threshold**: one year in a queue without progress (the five canon runs: 197 of 198 constructions progress within their first year).
- **Bureaucracy**: spare bureaucracy ≥ the survey's cost in `possible`, plus a 30-day take cooldown for the AI ONLY (*"I would prefer avoiding
  forced pauses between survey starts … not critical, especially if the forced pauses only affect the AI"*; p27/p28 measured the cooldown).

Implemented in `tools/emit_dams.mjs` behind `dams.rules = "family"` (the canon's output is byte-identical without it); the AI takes the survey
decision itself and the quarterly driver is not hooked; `dams.log_levels` adds the monthly built/queued level log. The book is
`config/mod_config.canon-dams-family.json` (the canon + those two keys), probed by p29 (F176 §5); its prod-like batch
`tools/testbed/schedules/canon_dams_family_n3.json` was run as the n=6 `canon_dams_family_n6.json` (session `20260929_002728`, FINDINGS F177).

⭐⭐ **CANONIZED 2026-09-29** (user: *"the construction loss when investment rights or a subject relationship breaks are rare enough and result in
losing little enough progress to ignore. All types of options stay and get canonized."*). The measured n=6: 4 intact / 1 pre-dam stuck-Britain
stall / 1 runoff, consensus loss 5.90; a median 47 dam levels; rights holders finish 84% of the constructions they start and lose 25 with ~39%
built, owners and overlords finish 98–100%. ⇒ **No protection is added against rights-holder or subject losses**: every builder kind the
rules allow (owner, overlord chain, investment rights in the owner or its chain, family surveys) stays. `config/mod_config.json` + twin are
`config/mod_config.canon-dams-family.json` + twin verbatim (sha256 `7bf6e9db1cb46b1d`), `dams.log_levels` included, as measured and
playtested.
⭐ **AMENDED THE SAME DAY — two more rulings.** (1) The monthly dam log is DROPPED from the canon (*"Drop."*): `config/mod_config.json` is now
`config/mod_config.canon-dams-family-nolog.json` (sha256 `806c8b3df03b5d61`) — the measured book minus `dams.log_levels`, instrumentation only,
no gameplay effect; the measured book keeps its bytes as the record. (2) **Owners that queue their own dam and sit on it are LEFT ALONE**
(*"Leave the stalls sitting on dams."*): F177's two long cases, Canada on Niagara-Ottawa (8 years at 5%) and on the Laurentian (5½ years
without progress), get no nudge.

### 10.89.13 — FOUR DAM TYPES ON THE ENGINE'S RESOURCE SLOTS, IN RULED CLASSES (user-ruled 2026-10-09; FINDINGS F220–F221) — UNDER TEST, not the canon

**Why.** F220 localised a third of the mod's early tick overhead in the dams: 144 unbuilt building types priced by count, and 144 level-cap
lines on every country. F221 measured the fix — four building types capped by the state region's own resource slots (`capped_by_resources` on
the group, `capped_resources = { building_dam_<class> = N }` in whole-file copies of the vanilla `map_data/state_regions` files) — at −2.3 s per
in-game year, and with it the level cap holds for every builder by construction (the 2026-10-05 foreign-builder hole). The user: *"Can't we
have true local slots, still? A state can have 5 logging slots, can't it have 2 'large dam' slots?"*; *"two dam sizes, and for each two dam
prices, four building types"*.

**The classes, ruled** (*"go with the revised classes"*), after the user's constraints: a small dam *"still should be much bigger than a
regular factory … under 300 output is absolutely not good enough"* (a vanilla coal plant level makes 50); every level built within 5 years
(*"9.5y build time is excessive from gameplay PoV, I'd cap at 5 years"* — the engine caps one construction at 40 points a week with every
technology, ~35 when dams open, so ≤ ~9,000 points); cheap and dear *"at least 1.5 times over"*; and the economy aligned with the recipes
(at base prices the jex book's t2 rungs pay back in 6.7 years median, t3 3.3; the per-project dams 15):

| class | name | electricity / points per level | points per electricity | payback at base (GBR 1920 wage, £600 a point) | build at 35/wk | technology |
|---|---|---|---|---|---|---|
| small cheap | Mountain Power Station | 300 / 4,800 | 16 | 6.7 y | 2.6 y | electrical_generation |
| small dear | River Dam | 300 / 7,200 | 24 | 10.1 y | 4.0 y | steam_turbine |
| large cheap | Great Mountain Scheme | 600 / 6,000 | 10 | 4.2 y | 3.3 y | steam_turbine |
| large dear | Great River Dam | 600 / 9,000 | 15 | 6.3 y | 4.9 y | arc_welding |

- **Size by the PROJECT's scale** (≥ 1.5 GW → large), **price by its head type** (the high-head resource types — falls, alpine, fjord,
  escarpment, plateau, lake outlet, canal — holding ≥ half its MW → cheap). Large is 37.5% cheaper per electricity than small (the 1930s big
  dams ran $80–90 a kW against $170–200 for the smaller ones). The user's own first guess of 1,500 for large was argued down: within 5 years
  it costs 6 points per electricity and pays back in 2.5 years, ahead of every t3 rung, and only seven projects are big enough.
- **Slots** = round(the project's electricity ÷ the class level). **Projects under 150 electricity are dropped** (*"Dropping those under 150 in
  canon is OK unless they add huge agricultural bonuses, in which cases let's make them small (and probably dear)"*): 22 sites; **Aswan's First
  Cataract and Sennar are kept** as one River Dam level each (+8 / +12 arable land, the basin-irrigation and rain-fed-plain penalties removed);
  Warsak's +3 arable land is not large. 122 projects, 181 slots, 72,900 electricity (the per-project book 70,568 in 312 levels); total
  construction points halve (2.41M → 1.24M), the price of ≥ 300-electricity levels under the 5-year cap.
- **Upkeep follows the electricity** (*"align the tools input to the electricity output (should still be widely profitable once built, at
  any prices)"*): per 50 electricity 1 tools + 1 engines; `resourceLayout()` ASSERTS each class profitable at electricity on the 25% floor,
  inputs on the 175% ceiling and a wage of £0.15 an employee a week (twice Britain's 1935 rate).
- **Staff at the historical level, the whole dam and project counted** (user-ruled 2026-10-09: *"This is intended to be extremely capital
  intensive in construction and a symbolically employed money printer later"*; applied 2026-10-10 after the batch, F222): per 50 electricity
  10 laborers / 15 machinists / 10 engineers — 210 a small level, 420 a large one (≈ 0.36 a MW; Hoover's ~150 power-plant staff + ~350 Bureau
  of Reclamation for ~1–1.3 GW ≈ 0.4). Every profession stays ≥ 10 a level, vanilla's own floor (the anchorage's 10 bureaucrats under the
  10-point proportionality rule). The worst-price profit is then +1,144 a week a small level, +2,288 a large one. It is the default in
  `tools/lib_dams.mjs` for every dam book; the batch of F222 ran the earlier 50 / 100 / 50 (1,200 / 2,400 a level).
- **Where it lives:** the table in `tools/make_dam4_config.mjs` (book `config/mod_config.jex-dam4s.json` = the jex book + these dams +
  `research_events.placement = script`); the derivation in `tools/lib_dams.mjs` `resourceLayout()`, shared by `emit_dams.mjs` and the slot
  check `tools/testbed/ledger/dam_slots.mjs` (save summary v17: dam levels and queued dam levels per state, with builders). Measured by the
  century batch `20261009_193145_jex-dam4s-n3`.
- ⭐⭐ **IN THE ARTMERGE ARM SINCE 2026-10-10** (user, on F222: *"Huge success. Almost certainly this becomes our standard. Incorporate this
  into the artmerge 'branch' now. If we ever get back to preartmerge canon, these performance-optimizing changes will need to be
  reimplemented."*) ⇒ **the arm's book is `config/mod_config.jex-dam4s.json`**: the jex book + the four dam classes + script-placed research
  entries + the historical staffing (the lib default since 2026-10-10, so the book now BUILDS at 10 / 15 / 10, not the 50 / 100 / 50 F222
  measured). The two performance changes are the arm's from here on; an artmerge book made later is made by `make_dam4_config.mjs --base
  <it> --suffix <sfx> --script-placement` as the chain's last step. ⚠ **The canon (`canon-dams-family-nolog`) does NOT carry them** — it
  keeps the per-project dams and `is_shown_when_inactive` first stages. A return to the pre-artmerge line must REIMPLEMENT both: the class
  table above was fitted on the artmerge book's projects and research entries, so it has to be checked against that book's (and re-measured,
  with the slot check) rather than assumed to carry over. ✅ **The player's shift-click queue PASSED the hand test** (user, 2026-10-10, on
  `mod_playtest_dam4s_damtest/`: one dam queued correctly — the engine's resource slot is the cap for a human builder too).

### 10.89.14 — PRIVATE DAM CONSTRUCTION (2026-10-16; FINDINGS F239–F240) — RULED AND CANONIZED: `dams.private = all`
⭐⭐ **RULED 2026-10-16** (user: *"Canonize this change"*, the variant *"Everywhere, and mandate their subsidies"*): the canon is
`config/mod_config.jex-dam4s-rs-x25-dpriv.json` = jex-dam4s-rs-x25 + `dams.private = all`, nothing else. This SUPERSEDES §10.89.9's government-only
construction (`can_build_private = { always = no }`) for the canon; the rights, survey and technology conditions now bind both routes. The subsidy
mandate needed no change: the four dam types are already `must_have` in every administrative strategy, and every privately built level in the probe was
subsidised. Accepted with it: private capital may pre-empt the government route, and privately built levels go to financial districts (or to the dam
itself), so §10.89.9's government-ownership intent no longer holds where private investors build. ⚠ UNMEASURED over a century. ⭐ Since the same
evening the canon carries it on top of the engine unlift and the conditional merge-host desire (`jex-dam4s-rs-x25-m10ac-dpriv`, §10.101 item 6).
The text below is the probe-stage record:
**Why.** Dams are government-built only (§10.89.9: `can_build_private = { always = no }`, a design ruling — ownership kept by governments, the overlord
building the megaprojects; no engine requirement for it is on record). F239: a host whose government barely builds never builds its surveyed sites —
laissez-faire hosts 0 of 6 (run 3's Britain surveyed both Scottish sites in 1911–12 and built neither). The user asked whether the survey gating survives
private construction, then for probes.
**What exists.** `dams.private` in `tools/emit_dams.mjs`: absent = the ruled design (byte-identical output); `all` = `can_build_private` carries the
same conditions as `can_build_government` (construction rights, the builder's own or family survey, the technology, all on `scope:investor_country`, the
scope vanilla's trade centre also reads in `can_build_private`); `laissez_faire` = the same, only where the host state's owner holds law_laissez_faire.
**What the probe showed (F240, exaggerated values).** The private route builds under every economic law; the survey gate held for all 30
constructions (including a foreign private investor under investment rights); the laissez-faire variant builds privately only in laissez-faire hosts.
Privately built levels go to the host's financial district (GBR, USA, France) or to the dam itself (Austria, Russia). Opened everywhere, private capital
pre-empts the government route even in interventionist countries, so the government-ownership intent of §10.89.9 is lost there; the laissez-faire variant
keeps it everywhere else. ⇒ **The choice (all / laissez_faire / leave government-only) is the user's**; nothing reaches a book until ruled.

## §10.90 — LOW END-GAME PRICES: WHICH LEVERS ARE OPEN, AND WHY WORLD GDP IS READ AS DISPLAYED (user-ruled 2026-09-30)

Asked while looking for a way to keep the tiered outputs' prices low in the end game (the obsolescence mechanism: an old rung dies when its
output price falls while its input prices do not). Three levers were proposed; the user ruled on each:

1. **NO change to the pop-need demand limits** (`max_supply_share` caps, or any other limit on how much of a need a finished good may take).
   *"Narrative and simulation consistency grounds: people should really mostly switch to consuming finished products towards the end of the
   game era."* The supply-share "sponge" (a good's share of its need grows with its supply until the cap) therefore stays as it is.
2. **NO construction goods-efficiency change**, and **NO change to how treasury and pool cash is generated** (investment-pool contribution
   efficiency and the like): *"Unless we change how cash is generated in treasuries in pools (like IP contribution efficiency, and we won't
   go there), this will simply lead to more construction and guaranteed runoffs."*
3. **Cheaper frontier inputs: "possible", with a stated fear of runoff**, and a worked example requested on a canonical scenario. The
   example (FINDINGS F178 §8) found the input-cost lever family moves prices and the old rung only WITH world GDP (24 runs of the B axis:
   PI −0.114 per unit ln world GDP, B's own effect not resolved; the old rung's share none beyond GDP), so it is recorded as a GDP lever,
   not a price lever. Not pursued unless a new argument separates it from growth.

⭐ **WORLD GDP IS READ AS THE GAME DISPLAYS IT.** *"Two important things in game scale with displayed GDP and have mechanical
consequences: government money minting and prestige (so country rank), which again has mechanical consequences. We're aiming for 1.0 of
vanilla GDP not because it looks nice, but because otherwise we'll have a hell of a lot more to balance."* ⇒ a design that lowers prices must
still land the DISPLAYED world GDP near 1.0× vanilla. GDP at BASE prices may be tracked beside it as a secondary reading (*"could be a useful
secondary metric to track, but not the main one"*); it never replaces the register's line.
⚠ **Measured the same day (FINDINGS F178 §9.4): the displayed figure is not a market-priced value added.** Over a century it stays within
0.94–1.08 of value added at BASE prices, in vanilla and the mod, while the buildings' own market ledgers reach only ~0.63–0.70 of it. So a
price decline costs displayed GDP little: the mod's lower price level takes ~7% off the world's at 1935 (~18% off the shortlist's), and the
two readings (displayed and base-priced) stay close. The first draft of this section called the ruled figure "nominal, at market prices";
that wording is withdrawn — the user's words were "displayed GDP".

## §10.91 — THE ARTISANSHIP t0 RUNGS (LINE A) AND SIX RUNGS MERGED BACK INTO METHOD SWITCHES (LINE B) (user-ruled 2026-09-30; unmeasured)

**Provenance.** Designed with the user in a cloud session on 2026-09-30 (no game files or run data there); its handover lived outside the
repo (`HANDOVER_artisanship.md` in the user's Downloads), so this section is the durable record of its rulings. The local session answered
the questions the cloud session could not (FINDINGS **F180**), and the user ruled on the remaining choices the same evening. ROADMAP steps
**12** (Line A) and **13** (Line B). Both lines are built as ALTERNATE books (`artisan6*`, `merge6`), measured separately, and combined only
after both are read. ⚠ SUPERSEDED the same evening by §10.91.3: from then on the two lines are ONE book (`artmerge6`), canonised or dropped
together. The canon (`canon-dams-family-nolog`) is untouched.

**Why.** The user, closing the previous line: *"drastically changing e0 economy to push its effectiveness per wage unit way lower,
implementing 'true artisanship' on lower level (prospering in scarcity, badly scalable, replaced in mid-game by industrial scale)."* F94
says the output-price decline the design rests on is not achieved; F97 says the decline the engine reads is in WAGE units (a building lays
off once its workers fall under 0.66× expected SoL). A labour-heavy rung is exposed to exactly that: it gets dearer as the wage rises.

### §10.91.1 — Line A: the craft rungs

**The pattern (ruled).** Rungs that are *"1) artisanship, not manufacturies / factories 2) narratively need more skilled workforce (e.g. as
a share of the workforce), on average, than later industrial-scale production 3) much more labour-intensive, with reasonable labour share of
full non-capital expenditure way higher than for later industries."* Six t0 rungs: Bakeries (food), Handsewn Clothes (textile), Handcrafted
Furniture (furniture), Forest Glass (glass), Crude Tools (tooling), Pulp Pressing (paper). **Muskets fits the pattern and is deferred**
(the only 1836 small-arms producer). **Automobiles are untouched** (the tier rule: the industry starts at t2).

**The unit and the recipes (ruled: *"500 looks better to me narratively"*; *"On recipes: let's go with your proposal"*).** A level is a
500-worker craft unit (`workforce_mult` 0.1 on a 5,000-head staffing block), keeping the vanilla building key. Per level, at base prices,
base-price break-even with W = the t0 reference wage (£0.05837 per wage unit per week, `lib_wage_model.eraReferenceWage`) × wage units:

| Rung | Staffing, ruled mix (shopkeepers / machinists / laborers) | Recipe per level | Cost (points) | Base-price break-even | Labour share |
|---|---|---|---|---|---|
| Bakeries | 90 / 150 / 260 | 3.6 grain → 3.37 groceries | 12 | 115% | 38% |
| Handsewn Clothes | 65 / 210 / 225 | 1.95 fabric → 1.95 clothes | 6 | 140% | 52% |
| Handcrafted Furniture | 90 / 250 / 160 | 1.38 wood + 0.46 fabric → 2.0 furniture | 6 | 140% | 56% |
| Forest Glass | 50 / 250 / 200 | 1.59 wood → 1.32 glass | 6 | 140% | 57% |
| Crude Tools | 75 / 225 / 200 | 2.23 wood → 1.59 tools | 6 | 140% | 50% |
| Pulp Pressing | 50 / 200 / 250 | 3.06 wood → 2.43 paper | 12 | 140% | 40% |

The identity behind them: labour share = 1 − r ÷ BE, r = material cost ÷ output value at base. The aim is a break-even of 130–150%; 175% is
unacceptable. Cost = the canon t0's ÷ 50 (600 → 12, 316 → 6).

**Rulings, in full:**
1. **No ×1.2 input lift on the craft t0s**; t1–t3 of the six industries keep theirs and must come out byte-identical to the canon.
2. **Secondaries:** automation stripped *"where they're narratively inappropriate altogether"*; on the crafts that is every automation
   group, plus Vacuum Canning (both variants) and Patent Stills. Kept: Cannery, Pot Stills, Craftsman Sewing, Luxury Furniture, Ceramics —
   their employment × 0.1 (`emit_secondaries`' verbatim-employment rule is amended for rungs carrying `workforce_mult`).
3. **No economy of scale for crafts**, urbanization **2** per level and infrastructure usage **×1/10** — carried by ONE child building group
   `bg_pmr_crafts` (parent `bg_light_industry`, `economy_of_scale = no`, `urbanization = 2`, `infrastructure_usage_per_level = 0.15`). The
   route was researched before adopting it (F180 §1: vanilla overrides an inherited economy of scale in child groups, measured zero on
   159-level financial districts; group-keyed script matches subgroups).
4. **ai_value untouched** (*"Don't touch for now"*), 1,000 per craft level — a watch item.
5. **Research events keep their marks in PEOPLE**; the people→levels conversion already honours `workforce_mult`.
6. **The 1836 start holds employment**: every converted craft building gets ×10 levels, and — ruled 2026-09-30 evening, *"that's a
   must"* — **the converted factories' workforce is converted into the craft professions**: in every state holding craft levels, the
   untyped history pops of that state are carved into typed shopkeepers and machinists matching the craft staffing (base plus the active
   secondaries), population unchanged, laborers left untyped (*"tune 1836 workers to recipes"*). ⚠ The ×10 must not reach OWNER BUILDINGS:
   the engine sizes a financial district or manor house by the levels it owns at the start, so the first probe grew financial districts
   by +693 levels and urban centres by +5% (FINDINGS F181). An owner-building entry of a craft block keeps its original levels and the rest
   of that craft becomes self-owned in its own state — the masters own the rest (76% of the 1836 craft capital was self-owned already);
   government entries keep the ×10.
7. **Companies can neither build nor form off craft rungs** (*"Companies, by themselves or with mandates, should not be able to build
   'artisanship' t0s"*): the craft keys leave every company list, formation test, prosperity line and construction target.
8. **Cost ÷50 is kept** — the local session found a periphery craft repays itself in about a year at 1836 prices (F180 §4) and the user
   ruled: *"keep ÷1/50. Faster payback is narratively deliberate."*
9. **The staffing risk is accepted and tracked** (F180 §2: machinists need literacy above 10%, and a building cannot fill one profession
   more than 10 points ahead of its scarcest): *"Needs tracking, but otherwise acceptable. 10% is a really low threshold."* The first probe
   builds **two staffing variants** — the ruled mix, and masters as shopkeepers plus laborers at the same wage units (Bakeries 127/373,
   Clothes 118/382, Furniture 152/348, Glass 112/388, Tools 131/369, Paper 100/400 per level; the base-price break-even unchanged within
   0.1%) — each with the 1836 workforce tuned to its own mix (*"all right, probe both. Don't forget to tune 1836 workers to recipes"*).
10. **Later, not now:** spread the 1836 craft levels over several of the largest states; trim automation methods that duplicate a
    main-method upgrade (textile looms, bottle blowers, the automated bakery, furniture's steam methods on Lathes); Muskets.

### §10.91.2 — Line B: six add-on rungs become second main methods of the rung below

**The ruling.** *"Anything over 30% can safely be ignored. However, the 6 options you say should be merged, removing higher tiers and
recreating them as new PMs, unlockable by the same techs that now unlock tiers (so, basically returning for vanilla PM switch and gates, but
only for some tiers of some industries)."* Period sources put each retrofit at 5–20% of a new plant (the old plant plus one department or a
new drive). The six: Sweeteners + Baking Powder (food t1|t2), Sewing Machines + Electric Sewing Machines (textile t2|t3), Mechanized
Workshops + Spray Finishing (furniture t2|t3), Sulfite Pulping + Paper Bleaching (paper t1|t2), Artificial + Improved Fertilizers
(fertilizer t0|t1), Open Hearth + Electric Arc (steel t2|t3). Continuous Web Processing and Catalytic Synthesis stay tiered (*"I agree on
all three counts"*); everything over 30% stays tiered (*"leave everything as in canon, strictly tiered"* otherwise).

**Cost (principle ruled, numbers from data).** One constant cost per merged building, with no dependence on the builder (*"very gamey and
we won't go this way"*), chosen *"that results in reasonable payback time at realised prices for both tierN PM in its era and tierN+1 PM in
its era"*. **The first test is the geometric midpoint** (*"midpoint first"*, 2026-09-30): cost = host × √1.9 — 1,571 (food, textile,
furniture, paper), 1,103 (fertilizer), 3,981 (steel) — and ai_value likewise 1,000 × 3^(e+0.5): 5,196 (food, paper), 15,588 (textile,
furniture, steel), 1,732 (fertilizer). At the canon's realised profits (F180 §5) that puts the hosts at 12–18 years in their own tier and the
added methods at 3.8–6.4 years (vanilla F53: 1900 quartiles 5.6 / 9.0 / 15.4).

**Recipes verbatim** (the ruled default). The prepared branch if the merge book runs hot: the added method's recipe (output and inputs) ×
1/√1.9 ≈ 0.73, which gives new builds exactly the canon's value added per construction point and keeps F97's death test under 0.20 in every
pair (furniture closest at 0.18). A cost-only branch is × 1.9^0.75 = 1.62 of the host.

**What merging changes.** The old method dies by SWITCHING, as in vanilla, not by exit — every metric must count levels by the ACTIVE
method's tier (save summaries carry per-method levels since v8); this matters most for fertilizer, whose host is the t0 rung T0 counts. None
of the six removed rungs stands on the 1836 map; staffing totals already match within every pair.

**How it is expressed (implemented 2026-09-30, `tools/make_merge_config.mjs`, book `merge6`).** The removed rung keeps its tier record and gains
`method_of: <host key>`; `_merge.pairs` records every pair with both rungs' old costs and ai_values. The builder emits no building for a
`method_of` rung: its main method joins the host's main group, gated by its own technology. Each emitter follows the same reading, one
building with two main methods:
- **Secondaries** (`emit_secondaries`): each rescalable secondary is minted once per main method, scaled to that method's output and input bill,
  and gated to that method — so a cannery beside Baking Powder is Baking Powder's cannery. A vanilla-gated secondary keeps its original only
  when no main method satisfies the gate. ⭐ (2026-10-05, the user's "UI clatter") Copies that share a name are each `is_hidden_when_unavailable
  = yes`, vanilla's idiom for variants of one line, so the panel lists only the copy beside the running main method — the numbers are unchanged.
  ⚠ The field hides on any unavailability, so a technology-gated line (cannery, stills, vacuum canning, elastics, precision tools) does not
  appear at all on a merged building until the technology is held. Considered and NOT taken the same day: ONE copy per line (host-sized: the
  line falls to ~45% of its per-rung ratio beside the merged method; merged-sized and disallowed where negative: the host loses 7 of its 10
  lines, until tier 4 for luxury clothes and tier 5 for luxury furniture).
  ⚠⚠ (2026-10-11) The hidden copies could never be selected in the panel (BUGS_AND_FIXES 2026-10-11). Interim fix: the flag is removed and
  each copy is named after its main method ("Cannery (Baking Powder)"). ⭐⭐ **RULED THE SAME DAY: ONE SHARED COPY PER LINE, NOT TIED TO
  A MAIN METHOD** (user: *"Make one shared copy per option, with no tie to a main method … It's OK if the secondary method zeroes the primary
  output. It's still not OK to make anything negative."*). So a line may take a main method's output down to exactly zero, under every main
  method the building carries, but no legal combination may take any good, input or job below zero (`lint_pm_combos.mjs` stays the
  judge). That relaxes the "disallowed where negative" variant above: a reduction may be as large as the smallest main method's output.
  The sizing rule is to be worked out when it is built. ⏸ DEFERRED by order until several tests of the neighbouring session are done.
  ⭐⭐ **SHARPENED THE SAME DAY — A MERGED BUILDING'S SECONDARIES HAVE THE SAME ABSOLUTE EFFECTS UNDER EVERY MAIN METHOD** (user: *"For a
  merged industry, all secondary PMs must have the same effects in absolute numbers. No 'cannery on sweeteners give -24 grain, cannery on
  baking powder give -39.35 grain'."*, and *"this is specifically what I forbade"*). The merge ruling above asked for *"basically returning
  for vanilla PM switch and gates"*, and vanilla's secondaries are fixed amounts whatever main method runs (Cannery is +30 groceries beside
  Bakery, Sweeteners and Baking Powder alike). The per-main-method scaling of 2026-09-30 therefore broke the ruling from the day it was
  built. Measured on the food host: the copies kept the Bakery ratio on both main methods, i.e. Cannery +67% groceries beside Baking
  Powder where vanilla's is +25%, and Vacuum +133% against +50%. ⇒ The rebuild emits ONE set of numbers per line per merged building.
  Plain (one-main) buildings keep the per-rung scaling of 2026-09-01. What absolute size that set takes is the open sizing question, bounded
  by the zero-not-negative rule.
  ⭐⭐ **AND IT IS BY CONSTRUCTION, AS IN VANILLA, NOT BY A RULE** (user, the same day: *"in vanilla this is achieved by construction … its
  industries have one set of secondaries, and not a tree of 'which secondary belongs to which primary' … restrictions … are named explicitly …
  Check, and if that's so in vanilla, keep this the same."*). Checked: a vanilla building carries ONE list of secondary groups, shared by every
  main method. A restriction is written on the restricted method itself, as `unlocking_production_methods` naming the main methods it may run
  beside. The engine documents no other form and has no disallow list for methods. Vanilla uses it on 6 methods only (Elastics, Precision Tools,
  Bone China and three outside industry). ⇒ A merged building gets one group per secondary line, one method per line, and an
  `unlocking_production_methods` list only on a line that may not run beside some main method.
  **THE SIZE (user, the same message):** *"same percentage as vanilla, for the most advanced PM of both ours and vanilla. If anything goes
  negative, forbid the combination."* ⇒ Each line takes the share of the building's MOST ADVANCED main method that vanilla's line takes of
  vanilla's most advanced main method of the industry (food: vanilla Baking Powder, groceries 120, against ours, 143). A combination that would
  still go negative is FORBIDDEN through that list, never shrunk. Worked for food at this reading (goods the main method also carries keep their
  own share; new outputs × our output ÷ vanilla's = 1.19; new inputs × our input bill ÷ vanilla's = 0.98; labour-saving lines stay vanilla's):
  Cannery grain −19.67, meat +19.67, iron +9.84, groceries +35.75 (+£482 value added); Vacuum grain −29.51, groceries +71.5; Pot stills sugar
  +24.58, liquor +71.5, groceries −35.75; Patent stills liquor +119.17, groceries −47.67. Under Sweeteners the tightest sums are grain 18.49
  (Vacuum) and groceries 17.33 (Patent stills), so the food building forbids nothing. ⚠ The input/output split is this reading's; vanilla's
  share is well-defined only for goods the main method carries.
  ⭐⭐ **EXTENDED AND IMPLEMENTED THE SAME EVENING** (user: *"Scale up inputs to match top-output PM as well. Don't change the workforce effect.
  This applies to all other industries as well. Apply everywhere."*; on scope, *"Every tiered rung"*, and *"These changes will need to be
  incorporated into all books of the artmerge branch onward"*). `tools/emit_secondaries.mjs`'s `top` rule, on for every book carrying
  `_merge` or `_artisan` (config `secondary_rule` overrides; every earlier book, the canon included, builds byte for byte as before, proven on the
  canon): (1) EVERY tiered rung's lines take vanilla's share of vanilla's most advanced main method the line may run beside, applied to the
  building's most advanced main method (for a plain rung, its own). It replaces, for this branch, the 2026-09-01 reference "the lowest primary
  method that allows it" — which also made the Bakeries' Pot stills (referenced on Sweeteners) and canners (on Bakery) disagree. (2) Merged
  buildings carry one copy per line, gated only where a main method is left out. (3) LABOUR-SAVING methods are minted per building with their
  inputs scaled the same way and their workforce effect untouched (they were vanilla quantities on every rung). Built on the playtest book
  `jex-dam4s-ra-play` as `mod_ra_top`, every lint green; two combinations FORBIDDEN by the never-negative test: Elastics beside Sewing Machines
  (clothes −13.2) and Precision Tools beside Mechanized Workshops (furniture −14.3). The effect on the lower rungs is large: the Tier 0 and
  Tier 1 food canners go from +67% to +25% of the main output, Craftsman Sewing from −67% to −21% of clothes, Ceramics from −33% to −10% of
  glass. Unmeasured.
  ⭐⭐ **ONE NAME, ONE RECIPE FOR AUTOMATION (user, later the same evening):** *"I meant anchoring at the top-level … the same named automation
  tier must have the same inputs and have the same workforce effects for all industry tiers"*, and *"What definitely goes is 'one name -- one
  recipe' though. What can change is the numbers."* ⇒ a labour-saving method's inputs are sized ONCE per industry, to the industry's most
  advanced rung against vanilla's most advanced main method, and that recipe stands on every rung (the per-building first cut made glass t1's
  Bottle Blowers 0.96 / 0.96 / 2.4 and t3's 2.58 / 2.58 / 6.45; now 2.58 / 2.58 / 6.45 on every rung). ⚠ The user expects the TOP ANCHOR to be
  too dear and may redo it: the labour saved is fixed in heads, so the anchor only moves the break-even wage. Tooling's (×2.38): Watertube
  Boiler coal 23.77 for 1,500 laborers = £0.48 a laborer a week at base prices, Rotary Valve £0.54, Assembly Lines £0.44, against vanilla's
  £0.20 / £0.23 / £0.18 and Britain's normal rate of £0.061 (1840) – £0.092 (1935) — so automation in tooling would hardly ever pay. Three
  candidate anchors were laid out: vanilla's numbers (×1), the top rung, the rung current when the technology arrives. ⚠ Arms and artillery
  are two industries on ONE vanilla building, so the same game name (Rotary Valve Engine, Assembly Lines) carries different numbers in each
  (coal 20.5 against 24.22).
  ⭐⭐ **AND FOR THE GOODS LINES TOO** (user, asked whether a Cannery may be +0.67 groceries on the Tier 0 Bakeries and +35.75 on the Tier 1-2
  building: *"Yes, it does."*). ⇒ IMPLEMENTED BY CONSTRUCTION: under the `top` rule each (industry, line) is ONE method shared by every rung
  that lists it (`pm_cannery_food`, `pm_watertube_boiler_building_tooling_workshop_tooling` …), sized to the industry's most advanced rung
  against vanilla's most advanced main method, its employment vanilla's on every rung (the craft amendment of 2026-09-30 no longer applies to
  it); a rung leaves out of its group a line that would take any good or job below zero beside its main method, and the shared method is
  gated (`unlocking_production_methods`) only where a merged building's main method is left out. A PAIR of lines from different groups that
  is fine alone but negative together beside a main method is made mutually exclusive there, the vanilla way: each is unlocked beside that
  main method only while the other group runs its off method (automotive tier 2: Tanks −58.08 and Aeroplanes −29.04 cars against 66; each
  is now gated on `pm_main_automotive_mass_automobile_production` or the other's `pm_no_…`). Every lint green on the playtest book; the
  canon builds byte for byte as before. ⚠⚠ **WHAT IT TAKES AWAY — lines now carried by fewer rungs, every one by the never-negative test:**
  every craft rung loses all its goods lines (cannery, stills, Craftsman Sewing, luxury furniture, ceramics); Craftsman Sewing leaves textile
  t1 Dye Workshops (clothes −2.22) and luxury furniture leaves furniture t1 Lathe (−6.5), so **LUXURY CLOTHES AND LUXURY FURNITURE HAVE NO
  PRODUCER UNTIL THE t2 RUNGS** (Sewing Machines, Mechanized Workshops) — at the 1836 start and through the t1 decades, where vanilla's
  Handsewn Clothes and Handcrafted Furniture make both from day one; Precision Tools leaves the Lathe rung; canning and distilling leave the
  Bakeries. The anchor is the user's to redo; a lower anchor (e.g. the rung current when the line's technology arrives) would keep them.
  ⭐⭐ **THE ANCHOR IS THE INDUSTRY'S t2 RUNG** (user-ruled the same evening, *"go with 'take era 2'"*, after both were built on the playtest
  book and compared): every shared line is sized to the industry's t2 rung against vanilla's most advanced main method (no t2 rung → the
  highest below it; synthetics → its t1). Against the top anchor: Craftsman Sewing returns to textile t1 Dye Workshops (+28.3 luxury clothes)
  and luxury furniture to furniture t1 Lathe (+32.5), so both are made from the t1 rungs on; Elastics and Precision Tools run beside both main
  methods of their merged buildings; Tanks and Aeroplanes are no longer exclusive on automotive t2 (−26.4 / −13.2 cars against 66); automation
  break-even per laborer a week at base prices: tooling Watertube Boiler £0.29, Rotary Valve £0.33, Assembly Lines £0.27 (vanilla £0.20 /
  £0.23 / £0.18; the top anchor £0.48 / £0.54 / £0.44), glass Bottle Blowers £0.13 (vanilla £0.16). Food is unchanged (its top is t2).
  Still forbidden: every craft's goods lines (a 500-worker level makes too little for any industry-wide recipe — Handsewn Clothes would go to
  −25.6 clothes) and Precision Tools on Lathe (−6.5). ⚠ OPEN: the crafts carry no secondary at all under one name, one recipe; a separately
  NAMED craft variant would satisfy it, unruled.
- **Research entries** (`emit_research_events`): a merged rung is counted as the host's levels running its method; a host carrying merged
  methods counts only the levels on its own. Paper t3's source is sulfite mills on the bleaching method; fertilizer t2's, chemical plants on
  the improved method.
- **Companies**: merged keys leave every company list (they name no building type); the host covers both methods.
- **The 1836 start**: no factory lands on a merged rung, and the converter throws if one ever does.
- **L31** checks the record and the midpoint.
The reading side is `tools/testbed/ledger/merge_methods.mjs` (levels per method, from the summaries' `pms`). The register's T0–T3 split a
host's workers by method since 2026-09-30 (`criteria.mjs`, commit `df5769f`: the host's staffing shared out over its main methods by the levels
running each); the old-rung census and the obsolescence readers still count by building type.

**⭐ THE HOST'S DESIRE CONDITIONAL ON THE MERGED TECHNOLOGY (user-ruled 2026-10-16; under test).** *"Costs unchanged, paper returned to regularly
lifted, desire — conditional on having the tech (if tech to unlock a better PM is there, then the ai_values are like the building is higher rung,
otherwise — lower)."* Why (the discussion the same day): a host's desire attaches to its BUILDING TYPE, but for years it can run only its own method
(paper's host opens with mechanical tools and bleaches only with chemical bleaching; textile's, furniture's and steel's open on a t2 technology and
wait for a t3 one), so the midpoint over-weights it before the merged technology and under-weights it after — §10.92 asks desire to follow profit.
A flat "ai_value of the highest" was rejected for that reason: it is F204's / F206's t2-host capture again (at 15,588 the hosts took a quarter to a
third of US private construction and held 39% of the grossly misplaced capital). ⇒ `make_merge_config --ai-rule cond`: the host carries its OWN
rung's tier value as `ai_value` and `ai_value_cond { tech: the merged method's technology, value: the merged rung's era value }`; `build.ps1` emits
`ai_value = { value = <own> if = { limit = { owner ?= { has_technology_researched = <tech> } } add = <merged − own> } }` (vanilla's own idiom,
`03_mines.txt`); the record `_merge.pairs[ind].ai_rule = 'cond'` is what L31 re-derives (proven to trip on a hand-edited conditional value and on a
dropped record). Costs keep their rule (the midpoint; textile its own). On the canon's ladder: food and paper hosts 1,000 → 3,000 with the merged
technology, textile / furniture / steel 3,000 → 5,000, fertilizer 1,000 / 1,000 (no block). First book `jex-dam4s-rs-x25-m10ac` (the canon + engines
unlifted + this rule); the condition is probed at extreme values first (`--ai-cond-values lo,hi` + `--grant-full` / `--grant-host`, probe books only).
⭐⭐ **IN THE CANON SINCE 2026-10-16 EVENING** (user: *"Canonize unlifted engines and conditional merge-host desire"*; the canon book
`jex-dam4s-rs-x25-m10ac-dpriv`, §10.101 item 6). The mechanism works (F238: the AI's choice moves with the technology); measured over a century it did NOT
lower misplaced capital (F239: 22% median against the canon's 20% and F237's 19%, the merge hosts taking 24–27% of new capital) — canonized for the
principle (§10.92: desire follows the profit the host can actually earn), not for a measured gain.

### §10.91.3 — ONE book from now on; the machinist staffing; the crafts' hiring floor (user-ruled 2026-09-30 evening; the floor ruled in the same night)

Three rulings in one message, answering the open choices after FINDINGS F184 / F185 / F187.
- **The two lines are combined, always.** On the proposal to run century batches of each book: *"No. From now on, combine them always. After
  this arc (maybe 2-3 days), I'll finalise the decision on whether both stay and get canonised or both go."* ⇒ the crafts and the merges are
  measured as ONE book, **`artmerge6`** = `artisan6` + the merge keys, built by `make_merge_config.mjs --base config/mod_config.artisan6.json`
  and proven by field diff to be exactly `artisan6` plus the six host/merged pairs and `merge6` plus the six craft rungs (the tree twin is the
  canon's). They are canonised or dropped TOGETHER. `artisan6`, `merge6` and their probe books stay as the records of F181–F185.
- **The staffing: *"The one with the machinists."*** ⇒ the ruled mix (§10.91.1, 30–50% machinists); `artisan6-shop` is dropped and kept only as
  a record.
- **The crafts' hiring floor is probed** (F185 §5's proposal): *"Yes, go with a 10-year probe and report on differences. If only possible with a
  longer probe, do that one instead."* ⇒ **`artmerge6-floor`** = `artmerge6` + `min_productivity_to_hire = 0.01` on `bg_pmr_crafts` — the
  per-group override of the engine's `BUILDING_DEFAULT_MIN_EARNINGS_TO_HIRE_EMPLOYEES` (3, "annual earnings/employee"; vanilla sets 10 on its
  owner buildings), 0.01 rather than 0 because for some group fields the engine reads 0 as unset. Generated by `make_artisan_config.mjs
  --hire-floor 0.01` then `make_merge_config.mjs`; its build differs from `artmerge6`'s by that one line. Probe session
  `20260930_205540_craft-floor-10y`, 2 × 1836 → 1846 (ten years suffice: in the 30-year craft run 30–45% of craft levels sat under the £3 floor
  in 1837–1848 and ~10% after, while craft staffing fell 95.6 → 88.5%). The probe reported; the user decided (below).
  **Outcome (FINDINGS F188):** the setting stays inside the crafts; their failed hires collapse and they add 118k workers from peasants and the
  unemployed while taking FEWER from other industries; nothing outside the crafts moves beyond two no-floor seeds' spread; new crafts still
  pause near 10% — the pause and margin rules, which have no group override, now bind.
- ⭐⭐ **THE FLOOR IS RULED INTO THE ARM (2026-09-30 late evening, on F188):** *"Marvellous. This threshold reduction is now a firm part of the
  'artisans + merges' arm, implement it."* ⇒ **the arm's book is `config/mod_config.artmerge6-floor.json`** (+ its twin, the canon's tree) — the
  bytes F188 measured (sha256 `ea45a2bc32b78025`; its craft half `artisan6-floor`, `d3a37b6e2f7dc84e`). Implemented in the generator:
  `make_artisan_config.mjs --hire-floor` now DEFAULTS to 0.01, `--hire-floor none` gives the engine's £3, and every command it records spells
  the floor out. Proven: regenerating the arm through the default path (`make_artisan_config.mjs --base config/mod_config.json --suffix
  artisan6-floor`, then `make_merge_config.mjs --base config/mod_config.artisan6-floor.json --suffix artmerge6-floor`) gives both books byte
  for byte; `--hire-floor none` reproduces `artisan6` except its recorded command. `artisan6`, `artisan6-shop` and `artmerge6` stay as the
  records of F181–F188 and are no longer the arm. The next step is a century 2+1 of the arm against the canon (schedule
  `tools/testbed/schedules/artmerge6_floor_n2.json` + `_tb.json`, prepared, not launched), and the recipe iteration it may lead to; FINDINGS
  **F189** sets the craft recipes beside vanilla's first methods and the canon's t0, at base prices and realised at 1845.
- ⚠⚠ **CORRECTED 2026-10-01 — THE RULED FLOOR IS £2, NOT 0.01.** The user: *"There was a ruling to lower the threshold for crafts, but not to
  0.01, but to £2, so only a third off. Probably should retest with a probe on the intended setup."* The 0.01 was the PROBE value (taken from
  F185 §5's "at 1 … at 0" range), the ruling's words named no number, and the session wrote the probe value in as the ruled one. So every
  craft book since `artmerge6-floor` carries `min_productivity_to_hire = 0.01` — F188's floor arm, F191's 10-year probe, F194's century batch
  (`artmerge6-pb`, n=3) and the readings taken from it (F195, F196) all ran on a floor the user did not rule. Those findings stand as
  measurements of 0.01; none of them is a measurement of the intended arm on this key. `make_artisan_config.mjs` now defaults to `--hire-floor
  2`; the books already written keep their recorded `--hire-floor 0.01` and stay the records of what was measured. A re-probe of the arm at £2
  is proposed (not launched).

### §10.91.4 — The craft staffing becomes shopkeepers + laborers, 30%; four craft outputs raised (user-ruled 2026-10-01; under probe)

- **The staffing (amending §10.91.3's "The one with the machinists"):** *"No machinists as artisans. Rather, make them all shopkeepers +
  labourers. While machinists could fit a bit better from some narrative PoVs, I want the Petite Bourgeoisie interest group to represent those
  new artisans. And making them mostly shopkeepers is the easiest way to do that."* FINDINGS F190: the machinist crafts had not moved the PB's
  clout at all (world mean 4.1–4.4% over 1838–1846, inside the no-craft books' and vanilla's range).
- **The share:** proposed with F190 §3's arithmetic and ruled *"30% it is"* ⇒ every craft **1,500 shopkeepers + 3,500 laborers per 5,000 block
  (150 + 350 a craft level)**, 1.60 wage units a head (vanilla's t0 1.20; the machinist mixes 1.40–1.61). The engine sets a craft's wage LEVEL
  (it cuts wages until profit sits near 15–20% of revenue), so a bigger shopkeeper share costs wage level, not a runaway bill; the risks named
  with it are shopkeepers leaving at cut wages (F185: craft layoffs bind on shopkeepers) and the shopkeeper qualification (wealth − 5).
- **The recipes (the ruling allowed "tune recipes a bit to provide more added value under early-game realised prices"):** craft OUTPUT × 1.10 food
  (3.37 → 3.71), × 1.30 glass (1.32 → 1.72), × 1.20 tooling (1.59 → 1.91), × 1.20 paper (2.43 → 2.92); textile and furniture unchanged; inputs,
  cost and everything else unchanged. Sized so each craft reaches 20% profit on revenue paying ~0.6 of its country's normal wage (the canon t0's
  level) at the realised 1838–1846 prices of F188 — first-order: more output lowers the price. Base-price break-even 107 / 146 / 139 / 114 / 119
  / 123%.
- **The book:** `config/mod_config.artmerge6-pb.json` (+ twin) = `make_artisan_config.mjs --base config/mod_config.json --suffix artisan6-pb
  --staffing pb` (the floor by default), then `make_merge_config.mjs --base config/mod_config.artisan6-pb.json --suffix artmerge6-pb`; proven
  by field diff against `artmerge6-floor` to be the six crafts' employment, four `output_qty` and the derived `wage_pct` / `target_be` only.
  The `pb` table lives in the generator (`PB_STAFF`, each craft's `pb_out`); `ruled` and `shop` stay as records. The ruled next steps: a
  10-year probe (*"check that no industries are completely dead, and no market that has some goods produced in canon is left with only a token
  amount"*), then the n=3 century batch if it is healthy.

### §10.91.5 — The t1-anchor recipe model, engines on t1, one craft rule and output-matched 1836 seeding (user-ruled 2026-10-01; under probe)

The user asked for a recipe model to settle first (*"anchor t1 including engines, go from there to both sides uniformly, even if not
geometrically"*) and then a way to make old rungs and crafts obsolete and the 1830s' artisans more numerous. FINDINGS **F197** holds the
arithmetic; the rulings, in the user's words where given:
- **Every industry is anchored at t1** — its ×1 is its t1 rung's vanilla method (or, with no t1 rung, its first rung's), inputs × the lift; t2
  = ×A, t3 = ×A² (A 2.2 / B 1.64 / C 1.9 kept); building cost follows the anchor (`--anchor-cost`, F151). The eight industries already slid
  are unchanged; it moves food, paper, fertilizer, explosives, steel, motor, arms, artillery and the art academy.
- **The step DOWN to t0 is ÷1.5 on output and on input value** (*"Agreed on e1/1.5 instead of e1/A; e1/B"*) — vanilla's own method step
  (F97 §6), the anchor's margin kept. The geometric step (÷A, ÷B) left steel's, explosives' and fertilizer's 1836 rungs value-destroying at
  base (F197 §3; F149 §4's all-17 failure). `make_ab_config --down-step 1.5`.
- **Engines on t1** — motor on [1,2,3], which is the tier rule's own derivation (atmospheric_engine is game era 2 → t1); [0,2,3] was an
  explicit PLACEMENT entry (§10.78's correction). `make_tier4_config --derive motor` writes the structure without that entry, so the canon's
  own regeneration still reproduces the canon. Named costs (F197 §3): frontier engines −14% per construction point, the steam rung one step
  below electric (it dies where diesel prevails), and motor's steam workers leave the tier-0 count (T0) by relabelling.
- **The pop-good penalty**: the anchor and every rung below it of an industry whose output sits in a pop need (read live from
  common/pop_needs — food, textile, furniture, glass, paper, arms, the art academy; automotive and electrics have no rung that low) carry an
  input lift of **1.4**; every other rung and industry keeps 1.2. The frontier above the anchor keeps the 1.2 ladder. `--in1-pop 1.4`.
- **One craft rule, "the 60%"**: every craft level makes 0.6 of its vanilla first method's goods per worker, with inputs set so its value added
  per worker-year meets the crafts' hiring floor (£2) at an output price of 0.89 of base, inputs at base (`make_artisan_config --craft-rule
  0.6,0.89`). It replaces the per-craft recipes of §10.91.1/§10.91.4 (the pb staffing stays): output 2.70 (food, textile, furniture) / 1.80 (glass,
  tooling) / 2.40 (paper) a level, base-price break-even 123–127%.
- **The crafts' hiring floor is £2** (§10.91.3's correction): kept at the ruled value.
- **Output-matched 1836 seeding** (`--seed 5`, done by `tools/emit_craft_start.mjs` at build time): per country and craft industry the craft
  levels the vanilla t0 factories became are topped up until they make the vanilla factories' output; the extra levels go to the country's 5
  most urbanised states (the F13 sum), in proportion, each city capped by its spare 1836.2.1 infrastructure (the excess spills to the next
  urbanised states). Their workforce is NEW typed pops, 30% shopkeepers / 70% laborers, each profession carrying the country's most numerous
  culture-religion of that profession at **1836.2.1** (*"Redo with 1836.2.1"* — `config/measured_1836_pop_identity.json` from a kept vanilla
  1836.2.1 save; no such profession → the first primary culture and state religion, reported). **Head count is vanilla's** (*"Always preserve
  vanilla total head count, take from peasants (in the states where shopkeepers/labourers are created, if possible, otherwise from the state
  with most peasants), Ignore ethnicity and religion of the peasants"*): the same number of people comes off the untyped pops of that state —
  never more than its 1836.2.1 peasants, never below 10% of a block — else off the country's state with the most peasants left. A country
  whose peasants cannot cover its seeding is seeded only as far as they do, and REPORTED (*"If still not possible to fix Krakow or Mughals,
  report"*): Kraków and the Mughals are covered; **Paraguay** (Bajo Paraguay holds 44 peasants at 1836.2.1) loses 3 of 7 levels and
  **Schwarzburg** (0 peasants) all 7.
- Measured by the build itself: 3,441 craft levels seeded in 60 countries over 156 states, 6.88M people typed (4.82M laborers, 2.06M
  shopkeepers) and the same 6.88M taken from peasants (6.79M in the same state); 513 levels spilled past the top five cities on
  infrastructure; 1836 urban centres 469 → 538 (F13 estimate — the seeded artisans are urban workers at the ruled urbanization of 2 a level).
- **The user's correction on the labour reserve:** *"It won't, if the prices are the way that this is value-destroying"* — a rung whose value
  added at realised prices is under its hiring floor cannot hire, so a peasant reserve does not refill it; the reserve only refills rungs that
  stay above the floor.
- **The book**: `config/mod_config.e1a-artmerge.json` (+ twin), built by the canon's own chain — `make_tier4_config --derive motor`
  (TIER4_SUFFIX=tier4-e1) → `make_tier4_techs` → `make_ab_config` (the canon's command + `--base config/mod_config.tier4-e1.json --anchor-for
  <all 17>:1 --down-step 1.5 --in1-pop 1.4`, suffix e1a) → `make_trade_config` (e1a-trade) → `make_dam_config` (e1a-dams) + `dams.rules =
  family` → `make_artisan_config --staffing pb --hire-floor 2 --craft-rule 0.6,0.89 --seed 5` (e1a-art) → `make_merge_config` (e1a-artmerge).
  Field diff against `artmerge6-pb-f2`: the nine re-anchored industries' rungs, motor's first rung's tier, the pop-good t1 inputs of textile,
  furniture and glass, the six craft recipes and the records — nothing else. Every build check passes (LINT, negative goods, solvency, tech
  content, L13, L31 with the two new rules, mod checks, preflight). The plan (user: *"go: probes and then runs"*): a 10-year probe, then a
  century 2+1 against the canon.
- **The floor itself, re-probed first** (FINDINGS **F198**, session `20261001_115032`, `artmerge6-pb` at £2, 2 × 1836→1846): healthy against
  the canon (0 of 79 types dead, 0 of 335 cells a token), crafts staffed 95–96% as at 0.01, but 15–21% of craft levels log a failed hire
  (0.01: 3–4%) — the ruled floor restores most of the hiring friction, and costs no staffing at 1846.
- **The probe** of the e1a book: session `20261001_121754_e1a-artmerge-10y` (2 × 1836→1846, dumps 1836.2.1 / 1837.12.1 / 1840.1.1 /
  1845.1.1; schedule `e1a_artmerge_10y.json` with its predictions). The seeding takes in game: at the first summary (1836.4.1) the six crafts
  hold +3,447 levels against the £2 arm (the build reported 3,441), 93–98% staffed, world population within 0.02%, urban centres 673 against 599.
  The century 2+1 is `e1a_artmerge_n2.json` + `e1a_artmerge_tb.json`.
- **The probe's outcome** (FINDINGS **F199**): the 1836 supply anchor lands on vanilla's in the seven markets (groceries 0.93 against the canon's
  1.33–1.53, paper 0.96 against 1.16), steel sits at the ceiling in 0% of readings at 1837.12 (F149's all-17 failure does not recur), world GDP
  528 / 527 at 1846, and the t1 money printer is gone (food t1 £8.4 of value added per worker-year against the canon book's £21). ⚠⚠ **ONE
  REGIONAL DEFECT, both seeds**: the 1.4-lifted pop-good t1 rungs empty in the German states and Belgium within four years (the Zollverein's glass
  sold at 0.69× base at 1836, where the lifted recipe cannot pay), and since pop demand follows supply share the market shrinks instead of calling
  capacity back — the Prussian market's glass 59–61 a week at 1846 against vanilla's 287–384. The lift's VALUE is the lever it points at (the user:
  "the exact value isn't fixed"); NOT changed without a ruling. The century 2+1 runs on the ruled book (`20261001_124750_e1a-artmerge-n2`) with
  the German market registered as a watch item.
- **The century** (FINDINGS **F200**, n=2 aligned, both intact): consensus loss **7.76** (the canon 5.90 at 4 intact / 2 broken; the 0.01 crafts arm
  10.09). The hoard is gone (pool H 0.52 against the 0.01 arm's 2.64 — the t1 money printer was the pool's inflow, F135) and pop-goods prices sit
  back inside the soft line (PP 1.07 against 1.16), PI falls decade over decade, T0 falls to 0.60 of its 1900s level; but **world GDP 0.82** after a
  long mid-game dip (0.71 at 1900, 0.69 at 1920), the shortlist ending at 1.09× vanilla's GDP with 1.41× its output per worker. Motor's steam rung
  (t1 now) keeps 0.5–1.0M shortlist workers — out of T0 by relabelling only — and the shortlist's food and paper crafts survive at £5–8 of value
  added per worker-year. The German glass hole ran until the German Empire's t2 rungs (run 2: 51–59 a week 1846–1860). Not ruled on.
- **Why the hole (FINDINGS F201):** the 1.4 lift puts the t1 glass and food rungs under the engine's 15% wage-cut line at ordinary prices
  (`BUILDING_PROFIT_TARGET_TO_LOWER_WAGES`), so once a price dip has emptied them they never rehire (`BUILDING_PROFIT_TARGET_TO_HIRE_EMPLOYEES` 25%);
  the trigger is an opening glut vanilla itself has (the Zollverein's glass at 0.53–0.56× base at 1836.2.1). France, Prussia and the USA lose a quarter
  to three-quarters of their groceries and Prussia and the USA up to half or more of their glass in 1837–1850.
- ⛔ **RULED OUT (user, 2026-10-01): a penalty that arrives with the better method** — *"No, never ever, for simulation purity reasons."* No
  technology-triggered malus (throughput or otherwise) on a country's older rungs when it learns a newer method; obsolescence stays with recipes and
  realised prices. Do not propose it again.
- **The lift probe (user-approved the same day: "Go on with the probes you suggest"; FINDINGS F202, session `20261001_215119`):** the lift on
  the anchor at **1.0** (`e1a10-artmerge`, the t1 recipe = vanilla's own) and **1.2** (`e1a12-artmerge`, the canon's scalar), every other key e1a's;
  2 × 1836→1846 each, read on the ten largest 1836 markets. ⭐ **Both close the hole**: the t1 glass and food rungs of the Prussian, French and US markets
  ride out the opening glut (Prussian glass 0.81–0.93× vanilla's median at 1845 against 0.15–0.70 under 1.4; French groceries 1.00–1.12× against
  0.33–0.74; US groceries 0.69–0.85× against 0.47–0.70). They differ where the t1 rung was already healthy: at **1.0** the British food rung earns
  0.34–0.39 of sales and British-market groceries reach **1.60–2.23×** vanilla's median, above its seed range (0.88–1.36); at **1.2** 0.22–0.27 and
  **1.27–1.32×**, inside it. World GDP at 1846: 1.02 / 1.00, 0.99 / 0.99, 0.95–1.00 (1.0 / 1.2 / 1.4); the 1836 anchor is unchanged (the lift moves
  inputs, not output); 0 dead types. The obsolescence handicap the lift exists for, in F97's death ratio at base prices (t1 ÷ t3, line 0.20): 0.15–0.17
  at 1.0, 0.11–0.15 at 1.2, 0.07–0.10 at 1.4. ⚠ At 1.2 one seed's French t1 glassworks fell to 0.47 staffed at 1845.
  ⭐⭐ **RULED 2026-10-01 (user, on F202): THE LIFT IS 1.2** — *"Go with 1.2. 3 full runs."* It closes the hole without lifting the t1 rungs into the
  money-printer band in Britain and keeps the larger part of the handicap. ⇒ **THE ARM'S BOOK IS `config/mod_config.e1a12-artmerge.json`** (+ its tree
  twin, e1a's byte for byte): e1a-artmerge with `--in1-pop 1.2`; `e1a-artmerge` (1.4) and `e1a10-artmerge` (1.0) are records. Regenerate by the e1a chain of
  this section with `--in1-pop 1.2` and suffix `e1a12` (the book's `_ab.command`). Its century: a FIXED n=3 of full runs (no stop watcher; the register's
  hard lines are read afterwards), session `20261001_225817_e1a12-artmerge-n3`, schedule `e1a12_artmerge_n3.json` with its predictions registered before
  launch.
- **The 1.2 book's century (FINDINGS F203, n=3 full runs):** 2 intact / 1 broken by stall (F166's stuck Britain after an 1847 civil war); consensus loss
  **8.62** against the 1.4 book's 7.76 and the canon's 5.90; world GDP 0.78, the pool's GDP 0.85 (beyond the soft line), the hoard back (pool H 1.41
  against 0.52 — F135: the t1 margins are the inflow), PI 0.95 falling, PP 1.05, T0 not yet falling (0.87). The German hole is gone at 1846–1850 in all
  three seeds; the t1 food rung overshoots in the rich markets in the 1850s; ⚠ the USA stays agrarian in all three seeds (GDP 0.35–0.55× vanilla at
  1935). Directional: the lift fixed the early hole and did not improve the century. Not ruled on.
- **Why the USA (FINDINGS F204, no game time):** no plain bug. One seed lost five southern states to New Africa in 1891; in all three the investment
  AI put 26–33% of the US's 1860–1900 private construction into textile's and furniture's t2 MERGE HOSTS — `ai_value` 15,588 (this section's midpoint
  rule), available from the 1850s because the tier rule bumps their game-era-2 gate to t2 — since steel, the high-value alternative, is thin under the t1
  anchor (Bessemer O:I 1.14 at base against vanilla's 1.36 and the canon's 1.45). Mines, logging, plantations and railways (`ai_value` 1,000–2,000, at
  2–10× the hosts' profit per construction point) took ~10% against vanilla's 31% — a starvation common to every four-rung book, which the canon's US
  survives because its steel and arms rungs win the AI's choice. ⚠ The merge hosts' midpoint `ai_value` applies to the host's OWN method for the
  decades before the merged method's technology exists. Levers proposed in F204, none ruled.
- ⭐⭐ **THE DESIRE LADDER COMPRESSED (user-ruled 2026-10-02):** *"Change the desire to build to 1) artisan 800 2) other e0 1000 3) e1 1000 4) e2 3000
  5) e3 5000. Run a 30-year probe and report. Unless clearly broken, run 2+1 then."* — in place of 1,000 × 3^tier (1,000 / 3,000 / 9,000 / 27,000) on all
  seventeen tiered industries. The book `config/mod_config.e1a12-ai1135-artmerge.json` is the arm's book regenerated through its own chain with
  `make_ab_config --ai-ladder 1000,1000,3000,5000` (no `--ai-steep`) and `make_artisan_config --craft-ai 800` (a new flag; `_artisan.craft_ai`, which
  L31 checks); everything else is the arm's commands verbatim, `dams.rules = family` after make_dam_config as before. ⚠ **The merge hosts keep this
  section's midpoint rule on the NEW values** — food and paper t1 hosts √(1,000 × 3,000) = 1,732, textile / furniture / steel t2 hosts √(3,000 ×
  5,000) = 3,873, fertilizer's t0 host √(1,000 × 1,000) = 1,000 — the ruling named the ladder, not the hosts, and F204's lever (a) (hosts at their own
  tier's value) stays unruled. Field diff against `e1a12-artmerge`: 57 `ai_value` fields and the provenance records, nothing else; every build check
  passes. The frontier's premium over the old rungs falls from 9–27× to 3–5×, and t0 and t1 now stand at par with the untiered sector (1,000); the
  crafts sit under it. Probe `20261002_111449_e1a12-ai1135-30y` (1 × 1836 → 1866), then the century 2+1 (`e1a12_ai1135_n2.json` + `_tb.json`).
- **The probe's outcome (FINDINGS F208):** not broken; world GDP 0.91–1.02× vanilla to 1865, dipping from 1856 like every four-rung book; the grossly
  misplaced share of new capital (F206) 17–19% a decade against e1a12's 23–25% (vanilla 16–17%), 15% against valid options only (F207); the textile t2
  merge host nearly empty (8 staffed levels world-wide against 42); ⚠ the USA still put 47% of its 1856–66 private construction into textile and furniture
  in that seed (e1a12's seeds 32–65%) — the prediction "under 20%" failed. Not broken ⇒ the century 2+1 launched as ruled: `20261002_120946_e1a12-ai1135-n2`,
  its saves summarised at v15, so §10.92's metric can be read on it year by year.
- **The century's outcome (FINDINGS F209):** ended at n=2 by the stop rule — run 1 intact (world GDP 0.79, loss 8.79), run 2 BROKEN BY RUNOFF (1.42×, the
  shortlist fully depeasanted, pooled U* 7.0%, the pools spent); the register's consensus is run 1 alone. Misplaced capital 1926–36 29% / 26% (e1a12 38%,
  the canon 28%, vanilla 17%); the USA 1.23 / 0.91× vanilla (e1a12 0.35–0.55); old rungs beside a rung two tiers newer 4.9 / 4.5% of world tier workers and
  0.9 / 1.2% of the shortlist's at 1935. Not ruled on.

## §10.92 — RECIPES STEER PRODUCTION; AI VALUES ONLY MAKE THE AI FOLLOW PROFIT (user-ruled 2026-10-02, GOVERNING)

**The ruling, verbatim** (after F206/F207 defined under-investment as payback and measured it): *"Once the 2+1 lands, let's see whether it'll lead
to better 'ineffectively invested capital' metric. In fact, we want it to be as low as possible, and the reason that we fine-tune AI values is that
it's not low naturally, not for some desire to steer it away. When we do need to steer the industrial production somewhere (e.g. some industry is
dead and shouldn't be, or even dead and causes ripple effects), we primarily work with recipes to ensure that it is effective/profitable for the AI
to combat this problem. And AI values only follow to ensure that the AI follows what's profitable. This is a very universal principle worth
recording at a high-level, even if our machinery to understand 'how profitable something is' and 'how effective is the AI in pursuing profits in
economic development' can change in the future."*

**What it rules.**
1. **The objective for the investment AI is that misplaced capital be as low as possible.** Today's measure (FINDINGS F206 for the definition, F207 for
   the valid-option rule): the share of a run-decade's new capital in mines, agriculture and manufacturing whose expected payback — construction cost ÷
   the annual profit per staffed level that type earned in that country at the time, at realised prices and actual wages — is more than 3× the best
   VALID sector's (grossly suboptimal; loss-making counts here) or 1.5–3× (a bit suboptimal); an option is valid when some state holds free deposits or
   arable land for it AND ≥ 25k peasants + unemployed. Infrastructure, shipyards and trade centres are left out.
2. **AI values, and every other willingness lever (AI strategies, AI defines), are tuned for that and nothing else** — because the AI does not invest
   where it pays on its own. They are never a device to push the AI toward or away from an industry or a rung for its own sake, and a change to them
   is judged by whether misplaced capital falls (directionally, §10.83.7).
3. **Steering production is the recipes' job** — inputs, outputs, building cost, i.e. the economics the book sets. A dead industry that should live,
   a death that ripples down a chain, an old rung that should die and does not: the remedy is to make the wanted outcome effective and profitable for
   the AI, reading realised prices first (§10.86.2). The AI values then follow so that the AI pursues what is profitable.
4. **Machinery-independent.** "How profitable" and "how effective is the AI at pursuing profit" are measured today by F206/F207's reader
   (`tools/testbed/ledger/misplaced_capital.mjs`, promoted from the session's scratch `payback_valid2.mjs` on 2026-10-02 with identical output);
   it may be replaced, the principle stands.

**How it reads against what was done before** (a reclassification, not a retraction).
- **The tier desire ladders** (1,000 × A^tier on the ab books, 1,000 × 3^tier since §10.75) were introduced to correct exactly this kind of failure: the
  private pool weighs a company's rung 0 with the same ×3 company multiplier, the cheapest cost divisor and a large random term as its rung 3, so it
  expanded old rungs "regardless of profit per construction point" (the §10.69 reading of 2026-09-03 above, F100). Under §10.92 that motive is the
  legitimate one — the AI not following profit — and the measure of the dose is misplaced capital. **F206 §5 measured the dose overshooting** in every
  four-rung book: the gross capital concentrates in the high-desire t2 rungs (canon: bolt-action arms 82% of their own new capital gross, open-hearth
  steel 36%), and e1a12 put **39% of all its grossly misplaced capital into its three t2 merge hosts at `ai_value` 15,588**.
- **The halved rung-0 desire** (`canon-c19-e0ai500`, F120) was the same motive applied at the bottom of the ladder; it moved nothing, because the
  government AI's desire was not what built the old rung.
- **The no-artificial-limits ruling (§10.69, 2026-09-03)** said which levers may touch the AI (willingness, never a hard block); §10.92 says what
  those levers are FOR.
- **The compressed ladder** (`e1a12-ai1135`, §10.91.5) is the first change tested under it: its probe brought misplaced capital to vanilla's level over
  1836–66 (F208); over the century (F209) it brought the last decade's share from e1a12's 38% to 29% / 26% — the canon's level, not vanilla's 17% — with
  one of its two seeds broken by runoff, so the AI-side lever moved the yardstick the ruled way and left the remaining excess to the recipes.

**What it does not rule.** Misplaced capital is NOT a line of the criteria register (§10.83) and carries no aim number; it is the yardstick of the AI
levers. ⭐ CONFIRMED the same day (user: *"It doesn't, you went correctly. It is an important metric to consider though."*): it stays out of the register.

### §10.92.1 — The exemption: what is never measured, and whose AI values are set to get it BUILT (user-ruled 2026-10-02)

**The ruling, verbatim:** *"It's worth noting that there are things that can be affected by ai_values that are exempt from the 'minimise bad capital
allocation' aim. Basically, if AI stops building infrastructure or government industries or shipyards 'because it doesn't see profits', this'll be a
net loss. We won't have a very detailed criterion that will check whether there are enough shipyards etc. But it's important to exclude them and
infrastructure and trade centers from the measurement, even if they technically can generate profit, and most of them -- through goods.
Additionally, let's remove gold mines as well (but add a static 5000 ai_value to them)."*

- **Never in the measurement, even where they earn through goods**: infrastructure — railways, ports, power plants, the hydro dams; **trade centres**;
  **shipyards** (vanilla files them under light industry, `bg_ship_construction`); **every government-funded building** — the groups the engine marks
  `is_government_funded = yes` (`bg_government`: administration, universities, monuments, skyscrapers; `bg_public_infrastructure`: construction
  sectors; `bg_canals`; `bg_military`: barracks, conscription and logistics centres, the navy's buildings); and **gold mines and gold fields**.
  F206/F207's scope already excluded every one of them (it is the tiered manufacturing rungs plus the mine and farm patterns, gold left out); the
  reader now also refuses the port / railway / power / shipyard industries by NAME, so a book that tiers one of them cannot leak it in — proven to
  change no existing reading.
- **Their AI values serve a different purpose**: to make the AI build them although they do not pay (or do not pay visibly). §10.92's
  "AI values only follow profit" does not apply to them, and there is no adequacy criterion for them (how many shipyards are enough) beyond the
  register's general lines.
- **The gold mine's static `ai_value` 5000 is already the game's**: vanilla's `building_gold_mine` carries `ai_value = 5000 # Gold mines are very
  nice for minting revenue and guaranteed profits` (`common/buildings/03_mines.txt`), and the mod does not own that file, so every book — the canon,
  the arm, the running batch — already ships it. Ruled to STAY 5000: a patch that moves it moves ours silently, hence the ON_GAME_UPDATE coupling.
  `building_gold_field` (the gold-rush fields, `bg_gold_fields`) is `expandable = no` and placed by events, so its `ai_value` has nothing to steer.
- ⭐ **Read narrowly, by the engine's own classification**: "government industries" are the government-funded groups above. **The military
  industries (arms, munitions, artillery — `bg_military_industry`, a child of `bg_manufacturing`, privately built) are NOT exempt — user-ruled the
  same day: *"They should not be exempt."*** They stay in the measurement and their AI values follow profit like any manufacturing rung's. The art
  academy (`bg_arts`, urban facilities, privately built) stays in on the same reading (not separately ruled). Their weight in the measurement is in
  FINDINGS F207's addendum (the military industries carry 3–4 points of the four-rung books' 1926–36 misplacement, none of vanilla's).

## §10.93 — SECONDARY AND AUTOMATION METHODS: NONE SHOWN THAT CANNOT RUN, NONE THAT TAKES A NUMBER NEGATIVE, NONE BESIDE A MAIN METHOD IT IS NARRATIVELY INCOMPATIBLE WITH (REVIEWED PAIR BY PAIR), THE ONES THAT ARE THE SAME AS A MAIN METHOD MANDATED ON IT; MAIN GROUPS TITLED "BASE"; MERGED BUILDINGS NAMED BY THEIR TIER SPAN (user, 2026-10-02 evening, from the playtest of `e1a12-ai1135`)

**The user, verbatim:** *"some secondary PMs for artisans are wrong. Make another pass to ensure that all secondary and automation PMs are narratively
compatible with the primary PMs of our tiered industries. Even if they are, secondary ones are unbalanced in some places. Check as a hard rule that no
secondary can exist that in combination with an allowed compatible primary takes any number into the negative (one of the input goods or employment).
Examples: e0 textile elastics, e0 furniture precision tools, e0 glass bone china all deduct much more than the only primary PM produces. If those PMs are
actually disallowed by something, we need to not show them (or not have)"* and *"merged industries should have a mixed name, e.g. 'era 1-2. paper mills'"*.

**What the three examples were (traced the same evening, BUGS_AND_FIXES 2026-10-02).** They WERE disallowed: vanilla gates Elastics on the sewing-machine
methods, Precision Tools on the lathe and mechanized-workshop methods, Bone China on crystal glass and houseware plastics (`unlocking_production_methods`,
the only three such gates in vanilla's industry file). `emit_secondaries.mjs` minted per-rung copies only where a main method satisfies the gate and, on
every other rung, KEPT VANILLA'S ORIGINAL in the group — "names main PMs it does not have and therefore stays unavailable". It did stay unavailable, and the
game SHOWED it, greyed, at vanilla numbers: −70 clothes, −55 furniture, −20 glass beside a craft level that makes 2.7, 2.7 and 1.8. Five such cases on the
arm's book (the three crafts, plus Dye Workshops and Leaded Glass); the same five in the canon's build. No legal combination of any building went negative in
goods or employment — measured over all 292 buildings the game loads, vanilla's included.

**What is ruled and built.**
1. **A building carries only methods it can run.** A secondary gated on main methods the building lacks is not in its group at all (it used to be kept,
   greyed). `emit_secondaries.mjs` drops it and prints it under "not carried".
2. **THE HARD RULE — no legal combination takes any number negative.** For every combination of one method per group that the engine would allow (a
   PM-gated method only beside a method it names), every input good, every output good and every profession's employment stays ≥ −0.011 (one hundredth,
   the emitted resolution — vanilla's own car plant nets automobiles to exactly zero with both conversions). Enforced by **`tools/lint_pm_combos.mjs`**,
   which `build.ps1` runs on every build and **throws** on — unlike `lint.sh`'s goods-only negative check, whose result the build only prints. It reads
   the EMITTED mod over the game, over every building the game loads (a `pm_goods` override can reach a vanilla building through a method file we own).
   It also fails a dead method (rule 1), an 1836 history block naming a method its building lacks (the engine rejects the whole block), and a
   labour-saving method on a craft rung (§10.91.1). Each kind proven to trip on a sabotaged copy the day it was written.
3. **⭐ NARRATIVE COMPATIBILITY, REVIEWED ONE COMBINATION AT A TIME — `tools/lib_secondary_compat.mjs`** (user-ruled 23:15 the same evening: *"No, no
   universal rule. Go through all vanilla combinations one by one, it's not like there are thousands of them. I agree that the assembly line on muskets
   doesn't make much sense though."*). Every vanilla secondary or automation method of every tiered industry was judged beside every vanilla main method of
   that industry — **139 pairs** — on one question asked case by case: *could a factory working this way plausibly have run this method?* (the main method
   still in use when the secondary's technology appeared, and the secondary not contradicting what the main method is). **14 are incompatible:**

   | main method | not beside | why |
   |---|---|---|
   | Handsewn Clothes | Automatic Power Looms | electric automatic looms (c.1900) arrive half a century after the sewing machine ended hand-sewing as a factory method |
   | Handcrafted Furniture | Water-tube Boiler · Rotary Valve Engine · Assembly Lines | a handcraft method: powering its machinery is what the Lathes method is |
   | Forest Glass | Automatic Bottle Blowers | wood-fired forest glasshouses were gone long before the bottle machine (1903) |
   | Crude Tools | Water-tube Boiler · Rotary Valve Engine · Assembly Lines | a village-smithy method: powering it is what Wrought Iron Tools is |
   | Wrought Iron Tools | Assembly Lines | wrought-iron tools gave way to mild steel by the 1890s; conveyors arrive in the 1910s |
   | Muskets | Assembly Lines | out of military production in the 1860s (the user agreed) |
   | Rifles | Assembly Lines | rifle-muskets and single-shot breechloaders out of military production by the 1890s |
   | Cannons · Smoothbores | Assembly Lines | smoothbore cannon and shell guns obsolete by the 1870s |
   | Percussion Caps | Assembly Lines | cap-and-ball ammunition gave way to the metallic cartridge in the 1870s |

   ⭐ **ACCEPTED by the user the same night** (*"All right on incompatibles."*), the borderline calls below included.
   Borderline pairs judged COMPATIBLE: Muskets / Cannons beside the Rotary Valve Engine (steam-powered armories of the
   1850s–60s, as the products died out); Handsewn Clothes beside Mechanized Looms (weaving was mechanised while sewing was still by hand); Dye Workshops
   beside Automatic Power Looms; Leaded Glass beside Automatic Bottle Blowers; Pulp Pressing beside steam (paper mills were among the first steam-powered
   industries); Steam Engines beside Assembly Lines (steam engines were built into the 1940s); the Automated Bakery beside Sweeteners (the biscuit
   industry's lines). Every other pair is plainly compatible — the luxury lines, canning, distilling, rayon, radios, aeroplanes and tanks, the patronage
   methods, and the automation of every factory method from Lathes, Sewing Machines, Leaded Glass, Sulfite Pulping and the Bessemer process upward.
   A rung is judged by its VANILLA main method (a minted addition by the vanilla method below it); a merged building whose main methods disagree gets the
   method once per main method that may run it, gated to that method; a group kept by reference is copied per building where a member has to go. The
   table is validated against the game's method files at every build (a key the game does not define THROWS), and a carried pair the review never looked
   at WARNS — a patch that adds a method owes the table a row.
   - **On the arm's book** it removes Assembly Lines from Muskets, Rifles, Cannons, Smoothbores, Percussion Caps and Wrought Iron Tools; the eight other
     incompatible pairs sit on the six t0 methods that are crafts there, whose automation the craft ruling (§10.91.1) already removes.
   - **On the canon's next build it removes all fourteen.** ⚠ An economic change to the canon (late-game automation on old rungs, which keeps them alive —
     against the ladder's goal), unmeasured; the canon is not rebuilt.
   - ⚠ **Superseded within the hour: a UNIVERSAL rule** — no method two or more tiers ahead of its main method (the ladder's death distance), my
     first reading of "narratively compatible". The user rejected it; it removed three pairs on the arm (Muskets and Cannons × Assembly Lines, and the
     Automated Bakery beside Sweeteners, which the review keeps) and nine on the canon. Session `20261002_223204` was built with it and is VOID.
4. **A merged building carries a mixed name**: its main methods' tier span and the building's own name, without any one method's — **"Era 1-2. Paper
   Mills. Recipe BE 63%/47%"** — the recipe break-even given per main method in tier order. A method name in the building's name described half of what it
   runs. Research texts naming a merged rung read "<host> (<method>)" as before. ⭐ **Every main production-method group is titled "Base"** (`$pm_base$`,
   vanilla's own title for its main groups, translated in every language) — user-agreed 23:55; it used to carry the rung's method name, which for a merged
   building named one of its two switchable methods. A display label only: no key, save, history or tool reads it.
5. **⭐ AN AUTOMATION THAT IS NARRATIVELY THE SAME AS A MAIN METHOD IS MANDATED ON IT AND REMOVED FROM THE RUNGS BELOW** (user-ruled 23:55: *"1) remove
   them from lower, 'not yet upgraded' rungs 2) mandate them as is to primary rungs they match with"*). The census the user asked for (*"Just how often
   does this happen?"*) found three pairs in the tiered industries: textile's **Mechanized Looms** (the Sewing Machines rung's own technology, Mechanized
   Workshops), textile's **Automatic Power Looms** (Electric Sewing Machines' own technology, Electrical Capacitors) and automotive's **Assembly Lines**
   (what Mass Production IS, though vanilla gates it on Conveyors). On the matching main method the automation group offers ONLY that method — vanilla's
   quantities, always on, no "off" — as a copy gated to the main method and carrying no law gate, and no technology gate the main method does not imply
   (rule 6: until 2026-10-03 Mass Production needed Compression Ignition, which did not require Conveyors, so a copy keeping Conveyors would have left the
   group with nothing to run, and every copy's technology gate was dropped). The merged textile
   building's group holds the two copies, each gated to its own method, so exactly one is valid at a time; a group left with nothing but an "off" method
   (Dye Workshops, Automobile Production) is dropped from the building. The rule-1 removals (Mechanized Looms off Handsewn Clothes and Dye Workshops;
   Automatic Power Looms off them and off Sewing Machines; Assembly Lines off Automobile Production) are derived into the table from vanilla's main-method
   order. `MANDATED` lives in `tools/lib_secondary_compat.mjs`; `lint_pm_combos.mjs` checks that each mandated method is the only choice beside its main
   method and carries no technology gate its main method does not imply, and that no group of a tier building has nothing to run beside some main method.
   ⚠ **What the mandate costs, recorded when ruled:** the three rungs now always pay the automation's goods and need fewer laborers. Vanilla's own note on
   Mechanized Looms says it breaks even only when a laborer's annual wage exceeds £6.9, and Britain's measured normal rate runs £3.2–4.8 a year (F152), so
   at base prices each mandate trims its rung's margin by roughly 2–4% of revenue (Sewing Machines −£60–110 a level a week, Electric Sewing Machines
   −£270–350, Mass Production −£410–460). Employment stays ≥ 0 (Mass Production's laborers reach exactly 0).
   ⚠ **The engine behaviour it relies on — MEASURED: IT WORKS BUT IS NOT ENFORCED** (session `20261002_235755`, `tools/testbed/ledger/mandate_switch.mjs`).
   When the merged textile building switches main method the engine does move most levels to the other gated copy (every level on each method ran its own
   copy through 1912 in run 1, and through 1936 in runs 2 and 3), but it does not re-check a selected method when the main method changes: run 1 held one or
   two Electric Sewing Machines levels on the Mechanized Looms copy in ten yearly snapshots 1913–1926 (Scandinavia, Croatia, Austria), the AI keeping the
   cheaper copy. Nothing in error.log names it; consistent again by 1927. Folding each loom into its main method on the merged building would make it
   engine-proof; accepting it is the alternative — the user's call (BACKLOG).
6. **⭐ BREAK-EVEN UNDER THE MOST BASIC SECONDARY METHODS AVAILABLE** (user-ruled 2026-10-03 00:05, implemented after the batch the same morning): *"BE
   numbers should mean 'under most basic of all secondary PMs available for the building'. Not 'main PM only'. Skipping checks is wrong, rather we should
   check properly so that it'd match. This is a visual and linter thing though, so redo after the runs end, don't restart one more time."* A building's BE,
   per main method, is computed with — in each of its other groups — the FIRST member legal beside that main method: the "off" method almost everywhere
   (no goods, nothing changes), the mandated copy where one is mandated. ONE implementation, `lib_secondary_compat.mjs` (`basicSecondaries` /
   `basicTotals` / `basicEmployment`), read by every surface:
   - **the book**: `make_ab_config.mjs` restates `target_be` / `wage_pct` on that basis (the automation's goods in, its jobs out of the wage units);
     **`tools/restate_basic_be.mjs --config <book> [--write]`** re-applies the same formula to a book written before the ruling and PROVES itself — every
     rung without a mandate must reproduce its stored numbers to the last digit, or nothing is written. Applied to the canon (both copies) and the arm:
     Sewing Machines 62 → **64** (wage share 0.2005 → 0.151), Electric Sewing Machines 45 → **48** (0.1847 → 0.1157), Mass Production 29 → **32**
     (0.2273 → 0.1754); the other 53 of 56 rungs reproduce exactly. Recorded in each book as `_basic_be`. ⚠ Neither field reaches the game, so no measured
     number moves — the arm's batch ran on the pre-restatement bytes.
   - **the lint**: `lint_profitability.awk` checks EVERY main method of a building (a merged host's second method had no drift guard at all — only a
     group's first member was ever checked) under the first member of every other group legal beside it (gate-aware: ungated, or gated on the main method
     or on a method already chosen; power-bloc gated members never chosen), FAILS a main method with nothing legal in some group, and reads the full
     vanilla + mod definition set (the mod's own 01_industry.txt with its remapped gates included; `lint.sh` feeds both linters one concatenation). The
     stop-gap that left mandated groups out is gone. Proven to trip three ways: a merged method's target off by 12, the looms copy removed from its group,
     the copy's tools ×12.
   - **the building name**: "Recipe BE" (goods only, wages ignored, ROADMAP step 8 P3) adds the basic secondaries' goods — `tools/basic_secondaries.mjs`, called
     by `build.ps1` once per build, prices them with the builder's own table. Sewing Machines reads 55% (was 50% at main method only), Mass Production 26%.
   - **the balance sheet**: `ui/data.js` carries `sec_options` (`basic_secondaries.mjs --options`): per rung and group, the vanilla members legal beside
     its main method wherever they differ from vanilla's group, an empty list for a group the building does not carry. The sheet offers exactly those and
     defaults to the first, so a mandated automation is selected by default and no rung offers a method the game would not let it run (Elastics on
     Handsewn Clothes, looms on the t0 and t1 textile rungs, Assembly Lines on Muskets …).
7. **⭐ CONVEYORS IS A PREREQUISITE OF COMPRESSION IGNITION, SO MASS PRODUCTION'S ASSEMBLY LINES KEEP THEIR OWN GATE** (user-ruled 2026-10-03: *"Would simply
   requiring conveyors as the tech prerequisite for the latest automobile industry-gating tech help? Do that after the current runs."*). It does: with
   Conveyors a prerequisite of the rung's technology, every country holding Mass Production holds Conveyors, so the mandated copy keeps vanilla's gate and
   the group can never be left with nothing to run. The general rule now in `emit_secondaries.mjs`: **a mandated copy keeps vanilla's technology gate
   wherever every technology in it lies in the prerequisite closure of its building's technology and its main method's, in the tree the build emitted**;
   otherwise it is dropped as before. All three copies keep theirs now (Mechanized Looms ← Mechanized Workshops, Automatic Power Looms ← Electrical
   Capacitors, Assembly Lines ← Conveyors ⊂ the closure of Compression Ignition). `lint_pm_combos.mjs` check 7 fails a gate the main method does not imply.
   - **Where it lives:** `PREREQ_ADDS` in `tools/lib_tier4_spec.mjs` (a new explicit-departure table beside `ERA_MOVES`; a stale or misspelt entry
     throws); `make_tier4_techs.mjs` appends it and records `vanillaPrereqs` / `prereqsAdded`; `emit_techs.mjs` patches the technology's block in its
     vanilla file, anchored inside that block, and THROWS if vanilla's list is no longer the one the tree recorded. The canon's and the arm's tree twins were
     regenerated (tier4 / tier4-e1) and proven to differ from the shipped ones only by the prerequisite and the stamp.
   - ⚠ **What else it moves:** Compression Ignition also gates motor's t3 (Diesel Engines), compression-ignition tractors, the five mines' diesel pumps
     and diesel trains — all now wait on Conveyors (tech era 4: vulcanization, shift work, electrical generation) as well. Vanilla's onset dates run the other way
     (compression ignition 1897, conveyors 1913), and at the anchor principle's tech-era-5 position the practical delay should be small; unmeasured.

**Measured the same night:** the overnight n=3 of the arm (session `20261002_235755_e1a12-ai1135-n3`, the third launch at 23:57 — the first, on the
universal rule, and the second, before the mandates, were stopped and are VOID) is the first batch built with all five; its book is the 2+1's byte for byte
(sha256 `73065d3f2a9328b9`), so pooling with the 2+1 carries rules 3 and 5 as a second, small difference. The 1836 history comes out semantically identical (whitespace only; the history rewrite
now leaves a block it does not change byte for byte). ⭐ **It ended 3/3 intact** (the VERDICT in the session folder): world GDP 0.80 / 1.01 / 0.89× at the
end state, consensus loss 7.40 (pooled with the 2+1, 4 intact / 1 broken, 7.02), misplaced capital 21% of 1926–36's new capital. Rules 6 and 7 came after
it: the arm's book was restated in place (`_basic_be`, three rungs' `target_be` / `wage_pct`, which reach no game file) and its tree twin regenerated with
the Conveyors prerequisite, so a build of the arm's book today differs from the measured one by rule 7 and the building names.

**What "the method box" was** (the user asked, 23:15: *"Are those not two switchable vanilla-like PMs, but rather one averaging 'PM in the middle'?"*):
they ARE two switchable methods, exactly like vanilla's own main group — `pmg_main_paper_sulfite_pulping = { production_methods = { pm_main_paper_sulfite_pulping
pm_main_paper_bleached_paper } }`, each method with its own recipe, the second gated on its own technology (§10.91.2). Nothing is averaged; only the cost
and `ai_value` of the HOST BUILDING are the two rungs' geometric midpoint. "The method box" was the group's display NAME, which the first cut of rule 4
changed from the host method's name to both names; it is now "Base", as vanilla titles it.

## §10.94 — INPUT-PRICE RED FLAGS: A STANDING CHECK ON EVERY BATCH AND EVERY PROBE, REPORTED AS PROSE AND HIGHLIGHTED INLINE, NOT A LOSS TERM (user-ruled 2026-10-03)

**The question** (the user, 2026-10-03): *"Are we tracking industrial inputs shortages in major markets for all configs? Not only 'do we save them', but
actually 'do we have mandatory checks and problemness metrics for them'? … I'm concerned whether some overly tight e0/e1 recipes lead to decades of
shortages and stifled growth for some countries, even if on average it looks OK."* The answer was no (FINDINGS F212 §1). **The rulings, verbatim:**
- *"No need to track the penalty itself, probably. Prolonged (2–3 years plus) price of +70% and higher for any industrially consumed good, or wide
  oscillations on tiny volumes all count as red flags."*
- *"For clarity: we need to track this for any good that is consumed by any industry. Say, iron fits."*
- *"Ruling: >= 0.5 base price swings within 3 years on under 10 units of supply a week is a flag."* — the swing is the **shortage in disguise**: *"the
  volumes are too low and don't allow for a stable high price, but the market conditions are the same: producers can't produce even at a significant
  shortage, pushing prices beyond the +70%."*
- *"An industry that can't begin growing because its inputs prices make it insolvent will have these prices swing."* — so **no flag is dismissed for want
  of building demand**: a good nobody in the market eats may be the input of the industry that never began.
- *"while we still gather local goods which are industry-consumed, electricity and transportation, we exclude them from the red flag calculations,
  possible addition to loss function etc."*
- Yearly `market_goods_wide` on the eleven tags in every schedule — *"Yes"*; the reader in every ledger and every probe readout — *"Yep"*; the next vanilla
  batch paired with the same logging — *"Yep"*.
- *"while we're not adding this to loss function now, we should add this as prose to the standardized report (which major market had flags, for which
  industries, when). I also want you to highlight that inline."*

**The rules:**
1. **HIGH** — the price ≥ **1.70 × base** at every reading of a stretch spanning **≥ 2 years** (readings ≤ 1.1 years apart). The engine's own line sits
   beside it: `GOODS_SHORTAGE_PENALTY_THRESHOLD` 0.5 pins the price at 175% and cuts every consumer's output; +70% is sell/buy ≈ 0.52.
2. **SWING** — inside any **3-year** window the price ranges **≥ 0.5 × base** while the window's median **supply is under 10 units a week**.
3. **Goods** — every good a production method of any INDUSTRY consumes (read live from the game: every production-methods file but the military,
   government, monument, canal, subsistence and company-HQ ones) plus every input of the book's own rungs. **Local goods (electricity, transportation,
   services) are excluded** from the flags, still gathered.
4. **Scope** — the major markets of the eleven telemetry tags (British, American, French, Dutch, Belgian, German, Russian, Japanese; `lib_markets.mjs`).
5. **The feed** — `run_schedule.ps1` adds `market_goods_wide` on **1 July of every year** from 1836 to the year before `until`, on the eleven tags read
   from `lib_markets.mjs`'s `TELEMETRY_TAGS`, to EVERY run, merged with whatever the schedule asks (a union, never a replacement); `-NoRedFlagFeed` drops
   it for a re-run that must match an old batch's telemetry. July keeps it clear of the January dumps and their phases. ⇒ the next vanilla batch carries
   it like any other.
6. **The reader** — `tools/testbed/ledger/input_price_flags.mjs`. Its primary source is that feed (supply = sell orders); a run without it is read from
   the save summaries (supply = the market members' production PLUS, in a v10+ summary, their imports at a lower bound — trade capacity × the run's
   traded quantity; price = the producers' `goods_sales ÷ va_out`), which are **blind where a market makes none of the good** — the feed is what closes
   that. Every flag carries the market, the good, the span, the price range, supply (made + imported) and building demand, the producers' staffed levels
   and the **BUYERS PRESENT** in the market — building · method, most levels at a reading, and in how many of the window's readings it was there — or "no
   buyer in the market" with the rungs that would eat it. ⚠ A buyer present at one reading of four is not the industry the price starved (F215: the card
   once read "tooling workshop" for seven Assembly Lines levels at one reading of a German oil market that had no oil economy at all).
7. **Where it is read** — the ledger's VERDICT section carries the flags as a highlighted card above the goal table (`fill_ledger.sh` writes
   `redflags.html`; the template's `__REDFLAGS__`; an out dir without it says so on the page — since 2026-10-08 the headline card of rule 9 in its
   place), and every probe readout prints `--md`. A reference arm
   (`--ref`, the vanilla set) prints one line of counts per run beside the book's flags — and where the reference's summaries carry no trade (the
   eleven-tag set is v9) the book's counts ON THAT BASIS (production alone) beside it, so the comparison is like for like.
8. **Not a loss term and not a register flag**, for now.
9. ⭐ **THE REPORT SHOWS A HEADLINE AND A SUMMARY, NOT THE LISTING (user-ruled 2026-10-08).** The listing had reached 1,625 flags (576k characters)
   on the jex n=16 report — "at least 100 times too large to be readable". The user asked for "a short metric or two of how problematic the situation
   is for major markets" and a summary of 3–15 sentences, the whole listing saved but not shown. Implemented (`redflag_metrics.mjs`,
   `lib_redflag_metrics.mjs`, the redflag-summary skill): **PROBLEM MARKET-YEARS** — Σ over the eight major markets of the in-game years under a HIGH
   flag on ≥ 10 units a week of BUILDING demand, of 800 — and **CHRONIC MARKETS**, those with ≥ 20 such years, each as median · range over the runs,
   with the split by period and by market beside them; the listing goes to `redflags_full.html`, kept beside the report. ⚠ The demand floor reuses the
   ruled SWING line's 10 units and drops the phantom HIGHs (a good nobody makes and almost nobody eats — radios, obsolete clippers — at the band edge
   for decades): on jex n=16 it takes the median from 259 to 212.5 market-years. ⚠ The two forms the user sketched — years with a problem in any market,
   and markets with a problem in ≥ 5 of the 99 two-year windows — saturate on that book (96 of 100, 8 of 8; 86 and 7 with the floor) and are kept in
   the JSON only. ⚠ A vanilla line is like for like only on the summaries' basis; the order-book readings have no vanilla twin until a vanilla batch
   with yearly GW lines exists. PROPOSED, the thresholds (10 units, 20 years) awaiting the user's word.

**Calibration (FINDINGS F212 §7, yearly readings over the century):** vanilla (the eleven-tag set, n=4) 0.5 HIGH and 20.8 SWING flags per run (1.5
HIGH-years per run: Russian engines 1859–63, American explosives 1861–63); the canon 1.8 HIGH (9.3 HIGH-years) and 28.0 SWING; `e1a12-artmerge` 0.3 (0.7)
and 23.0; the arm `e1a12-ai1135` 1.4 (6.8) and 27.4 — every book on production-alone supply, like for like with the v9 reference (with imports the
arm's n=3 reads 34 / 21 / 19 SWING against 35 / 24 / 21). ⚠ **At the ruled thresholds SWING is common in vanilla itself** — a book's SWING count is read
against vanilla's line, never alone; the HIGH years separate the books from vanilla far more sharply (×5–6).

## §10.95 — RESEARCH ENTRIES FOR PRODUCTION TECHNOLOGIES OUTSIDE THE TIER LADDER: ONE BY ONE, CALIBRATED ON THE NARRATIVE ONSET (user-ruled 2026-10-05)

Relaxes the 2026-08-30 `tiers_only` scope (only technologies that unlock a tier rung carry an entry) for the production tree, after the user found
Radio without one. The audit, the per-technology table and the calibration live in ROADMAP step 2 ("COVERAGE AUDIT OF THE PRODUCTION TREE"); the
table itself lives only in `tools/make_research_extra_config.mjs`. The rulings:

1. **Every production technology has an entry, or a stated reason not to**: a vanilla journal entry that is not country- or region-specific; an early
   technology most countries start with; no reasonable in-game precursor. An oversight is restored where it makes sense narratively.
2. **An entry counts its PRECURSOR**: the workforce of the industry the technology would improve (Radio: the electrics industry's telephones), and may
   REQUIRE further technologies held for the bar to advance (Radio: Electric Telegraph). Visibility stays gated on the technology's own researchability.
3. **The marks** (user's rules): on average the SECOND-fastest country starts the clock in the technology's narrative onset decade; in no more than 10%
   of playerless runs does any country start it more than 20 years early; a late technology with no second country by 1936 is allowed but highlighted, as
   is a technology where the two rules conflict. Onsets before 1836 are exempt, sized so a Russian, Chinese or Ottoman speed-up is possible, not instant.
4. **Every mark is a whole number of fully staffed levels** of what it counts (rounded UP; the counter reads fully staffed levels at base staffing).
5. **A switchable building counts only the main methods that can narratively lead to the technology** — no wooden shipyard advances arc welding; a
   method a craft cannot run (vacuum canning, the automated bakery, the bottle machine) leaves the crafts out of that count.
6. **Dropped:** shift work (an absolute workforce mark rewards playing wide: 850k is 7% of the Dutch population against 0.8% of the Russian, and healthy
   Netherlands reached it decades after researching shift work unaided) and pumpjacks (no precursor).
7. **Tech-era-1 technologies gating a rung with a predecessor keep their entry** (`era1_rule_a`): the start grants them only to starting-tech tiers 1–2, 59 of 444 countries.
8. The user's stated aim: if the earlier books placed half the tech majors' discoveries within a decade of the onset and these entries push the tree
   ahead by 1936, ordinary research is nerfed to bring it back, so the tree leans more on the entries than before. First measured by `20261005_154629_jex-n16`.
9. **An entry whose mark most majors already exceed when the technology opens is ACCEPTABLE** (user, 2026-10-05: *"Acceptable."*): it no longer tells a
   big industry from a small one and acts as a flat research subsidy on that technology (run 1: arc welding, pneumatic tools, pasteurization, steam
   donkey, mechanized farming, threshing — majors at 3–10× the mark at opening). The majors' acquisitions still spread by decades, because a technology
   opens at different dates in different countries. No "at most half the majors over the mark at opening" rule is applied.

## §10.96 — THE LAST TECH REWORK: SHIFT THE RESEARCH LEVERS, NO NEW PRINCIPLE; THE TARGETS, AND EVERY DECADE'S WORLD GDP AS A TARGET (user-ruled 2026-10-10; ROADMAP step 14)

The user: *"shift the levers a bit without any principle changes, decrease independent research speed (the default research chosen by country AI)
and maybe increase tech spread. This should make other sources of 'getting the tech first' (our JEs) relatively more impactful"*; *"reduce both the
innovation caps and innovation generated by universities, but do so in a way that will result in roughly on-target overall situation in 1900 and 1936
(now it's ahead of targets after we boosted JEs)"*; and *"build a quantitative model of how actual frontier and average techs at a given moment
depend on the literacy and all levers"*. Base book: `jex-dam4s` (§10.89.13).

1. **The levers** are numbers the game already has: the innovation base and cap (`base_values` 50 / 50, the cap's literacy term 150 in
   `country_literacy_rate`), what a university produces (1 / 1.5 / 2 innovation per staffed level, vanilla `07_government.txt`), and tech spread
   (`base_values` 25, literacy term 75, the unspent-innovation term 0.2). Nothing new is invented; the research entries (§10.95) are left as they are.
   ⚠ Measured on the 1936 saves: an AI major sits ON its cap (Britain 179.8 innovation against a cap of 177.3 on the book, 168.5 against 167.3 in
   vanilla) and the AI builds universities to 1.0–1.25 × the cap (`MONEY_SPENDING_INNOVATION_*`) — so for a major the CAP sets research speed and
   university output sets its COST; 202 of 270 countries have no university and research at the flat 50.
2. **The targets (user: "let's try with those targets"):** the leader holds about half of game era 4 at 1905 and somewhat under half of game era 5 at
   1936 (its anchor is 1940); the tech majors' median count near vanilla's (77 at 1900, 107 at 1936, F138); production technologies reaching half the
   majors within ten years of their onset not below today's 27 of 43 (F222).
3. ⭐⭐ **WORLD GDP OF EVERY DECADE IS A TARGET IN ITS OWN RIGHT** (user: *"we're also doing that to bring GDP down to vanilla level, as a less advanced
   world produces less. However, this is very easy to overdo, and if the gap with vanilla by 1886 is bigger than canon 2sigma one, we likely just broke
   it. The GDP of every decade is a target by itself."*). Read as world GDP as displayed ÷ the vanilla n=16 per-run median at the first summary of each
   decade year. **THE 1886 BREAK LINE: the arm's 1886 median more than 2σ of the canon's own 1886 spread from vanilla** — the canon
   (`canon-dams-family`, n=6, 20260929_002728) reads σ **0.085** at 1886, so the line is **0.83 / 1.17**. The readings it is measured against
   (÷ vanilla's median, median · σ over runs; vanilla's 1886 median £1,170M):

   | arm | 1846 | 1866 | 1886 | 1906 | 1926 | 1936 |
   |---|---|---|---|---|---|---|
   | vanilla n=16 | 1.000 · 0.033 | 1.000 · 0.038 | 1.000 · 0.090 | 1.000 · 0.118 | 1.000 · 0.131 | 1.000 · 0.102 |
   | canon n=6 | 0.964 · 0.037 | 0.891 · 0.052 | 0.867 · 0.085 | 0.814 · 0.180 | 0.900 · 0.310 | 1.058 · 0.414 |
   | jex n=16 | 1.006 · 0.015 | 0.993 · 0.039 | 0.955 · 0.046 | 0.899 · 0.092 | 0.987 · 0.187 | 1.120 · 0.228 |
   | jex-dam4s n=4 | 1.008 · 0.008 | 1.001 · 0.051 | 1.064 · 0.069 | 1.052 · 0.102 | 1.203 · 0.193 | 1.294 · 0.274 |

   ⚠ The canon's σ is from six runs that include a stall and a runoff, so it is itself noisy. ⚠ jex and jex-dam4s carry the SAME research (F222) and
   still part by 0.1–0.2 from 1886 on, so the book's late richness has a cause outside research that is not yet found — a research nerf can bring GDP
   down, but sizing it on GDP alone would attribute that unknown cause to research. Pre-v12 vanilla summaries may lose a dropped country record
   from `world.gdp` (L38); small at world scale.
4. ⭐ **THE MODEL'S FIRST READING (FINDINGS F223, the same day):** the all-country median already sits at vanilla's; the overshoot is the leader
   and the majors. The leader's tech-era-5 production is delivered whole by the research entries, so its tech-era-5 share falls only through military and
   society. A cap cut and higher tech-era-4/5 costs reach the leader with the median untouched (the entries' grants follow the era cost); a university
   cut is mostly a cost lever once the AI rebuilds to its cap; a spread raise lifts the leader too. Every setting that puts the leader near half
   costs production-onset timing (26 → 19–22 of 43) — a trade-off for the user, not yet ruled. Candidates await the user's choice; none has run.

## §10.97 — THE RESEARCH ENTRIES REWORKED: SLOWER, NON-ADDITIVE, LITERACY-GATED, OPEN-ENDED; RESEARCH HALVED FOR EVERYONE (user-ruled 2026-10-11; ROADMAP step 14; BUILT as jex-dam4s-rb, F226; CANON since 2026-10-12 as part of jex-dam4s-rs, §10.99)

**The complaint (user, after playing candidate A of §10.96):** *"tech JEs are overdoing it. Playing a wide-ish major (GBR, USA, FRA, PRU, AUS, RUS,
QIN) is now trivial for the player, it's too easy to get tech boosts in everything and cover the whole production tree with 90% of points coming from
JEs."* The slowdown must be organic and narratively justified, never a count cap ("no 'stop JEs of era X if 3 have already happened'"), and a TALL
HIGH-TECH MINOR must still reach its entries.

**THE PREMISE (user):** *"Innovation happened because the industry was pushed to innovate and had significant concentration of capital and mind, not
because the state 'considered it vital and promoted'"* — no academic or state-directed channel outside the military, and *"a wide country with ten
genuinely cutting-edge large enough industries has no reason that only some of them will innovate."* ⇒ No share-of-economy marks (a breadth cap in
disguise), no science or institution requirement on a stage. REJECTED with reasons: per-state cluster marks (*"state definition is too arbitrary in
game"*); a capital-inflow condition (hard to read, gameable by periodic demolition, and *"it's the stress and competition that forces firms to innovate,
and capital influx is inversely correlated with that"*); counting skilled jobs only (the engine already holds profession ratios near target). ⚠ The
history was challenged and recorded: after ~1870 chemistry and electricity drew heavily on universities, but through FIRMS (the dyestuff labs, Menlo
Park, GE, Bell, DuPont) — consistent with the premise; agriculture (experiment stations) and the military are the state-driven exceptions.

**THE RULINGS:**
1. **Sources do not add up.** A bar gains one tick in a month if AT LEAST ONE of its sources qualifies; several qualifying sources no longer speed it.
   The entry lists its sources as "any of".
2. **Industry stage length 36 months** (was 24); war and naval channels unchanged ("for now, and let's see").
3. **Twenty stages: Inception, Development, Implementation 1–18**, each granting 0.5 × the era base cost; the chain continues until the technology is
   acquired. With no ahead-of-time penalty two stages suffice, as before; the extra stages let an entry pay off a penalty with TIME. **The penalty
   factor stays 0.25** (user: a tall country may run *"significantly ahead in one industry it specialises on … penalties, but not prohibitive"*).
   Measured on candidate A (5 runs): combustion engines would cost Britain ×7.5 the era cost at 1846, ×4.75 at 1856, ×2.75 at 1866, ×1.75–2.25 at
   1871 — 15 / 10 / 6 / 4 stages, so 30 / 20 / 12 / 8 years of one bar at 36 months, before the prerequisite chain and the source's own mark. ⚠ Tick
   cost: F220 measured entry types placed only by script (no `is_shown_when_inactive`) to be free until placed; only one stage per technology is ever
   active.
4. **A literacy requirement per the technology's GAME era: 25 / 35 / 45 / 55 / 65%** (tech eras 1–5), on industry entries only — **war and naval entries
   are exempt**. It is a requirement for a monthly tick, not more: below it the bar PAUSES and keeps its progress. Who it hits, from the save summaries
   (candidate A's runs and vanilla n=16): Russia and Qing out from tech era 1 for most or all of the century, Austria in tech eras 3–5 until ~1866–1906, France
   flickering at tech era 3 and blocked at tech era 4 in vanilla-like seeds, the USA at tech eras 4–5 in its dip years; GBR, Prussia/Germany, Belgium, the
   Netherlands and Sweden essentially unaffected. (The user's first ladder, 20/35/50/65/80, would have kept GBR, the USA, France and the Netherlands
   out of tech era 5 for the whole century while Belgium and Germany passed — rejected on that reading.)
5. **Followers: the mark is HALVED at every stage once a NON-isolationist country holds the technology**, and only for an entry country that is
   itself NOT isolationist (user: *"have it hit both ways"*). One global flag per technology, raised once and forever by the first holder that is not
   under the isolationist trade policy at the time (raised on acquisition, at the campaign start for what is already held, and by a yearly sweep
   for a holder that drops isolationism later; a holder annexed or turning isolationist later is ignored by ruling); an isolationist country never
   gets the halved mark, whatever the flag says. ⚠ "Isolationist" is the law OR ANY VARIANT of it: the Qing's `law_canton_system` and Japan's
   `law_sakoku` (`parent = law_isolationism`). Until 2026-10-17 the test was `has_law`, false for a variant, so both 1836 isolationists raised the
   flag and took the halved mark (BUGS_AND_FIXES 2026-10-17).
6. **Ordinary research halved** — `base_values` innovation 50 → 25 and cap 50 → 25, the cap's literacy term 50 → 25 (vanilla 150); **universities
   stay at candidate A's ×0.5 of vanilla** (user). Research = min(innovation, cap), so: a country on the base alone (the tall minors — Belgium,
   Sweden, Sardinia, Denmark, Switzerland at innovation ~50 against caps of 73–94) halves exactly (25 against a cap of ~40–48); a major on its cap
   halves exactly too, because the cap halves (Britain 1866: innovation 81 → 56, cap 80 → 40, research 80 → 40); only a country between the two,
   with a few universities and below its cap, loses a little less (France ~55 → ~30, −45%). Majors carry ~10–20 innovation above the halved cap,
   which feeds spread at 0.2 a point (+2–4) and which the AI's university spending (built to 1.0–1.25 × the cap) should shed over time.
   ⚠ Halving the base ALONE would not do this: the minors would lose 50% while capped majors lose 0–35% (Prussia 1935: innovation 119, cap 94).
   Spread's base and literacy terms are untouched, so spread gains relative weight. No technology-cost change (the same slowdown by another route,
   which would slow spread too; not wanted).
7. **The AI should educate like a player would** — willingness levers, no hard blocks: an `ai_enact_weight_modifier` on the religious/private/public
   school laws while `law_no_schools` is active (⚠ untested outside petitions — probe first), and `institution_scores.institution_schools` added to the
   seven administrative strategies (additive by vanilla's own comment). Measured: Russia keeps no schools in 5 of 5 runs for the whole century, Qing
   to ~1926; ~80% of country-years at no schools in 1846, ~40% in 1906. The levels actually reached are limited by spare bureaucracy and are not in
   the summaries — read them from a kept save before sizing the score.
8. **Society and tech spread: DEFERRED** ("let's see how it all works, first").

Probes (the school-law lever, institution levels in a kept save) wait until the concurrent session reports on its runs.

⚠ **Building it (notes for the book that carries §10.97):** (a) generate it through `make_research_levers_config.mjs` WITHOUT `--dam-staff` (or
otherwise strip `dams.staff_per_50`), so the dams run the ruled historical staffing 10/15/10 per 50 electricity, not candidate A's 50/100/50 pin;
(b) since commit `0659e81`, and in its current form since `a029429` (one shared method per industry and line, sized to the industry's t2 RUNG
against vanilla's top main method — the anchor ruled the same evening, after `7fdfcc1` had sized it to the top rung — vanilla's employment on every
rung, a line left out where it would push a good or job below zero), every artmerge-branch book builds its secondaries under the `top` rule
(§10.91.2). ⚠ Under it the crafts carry NO secondary line (open with the user); luxury clothes and luxury furniture come from the t1 rungs (Dye
Workshops, Lathe); automation costs sit near vanilla's (tooling break-even £0.27–0.33 a laborer a week against vanilla's £0.18–0.23). Unmeasured.
So the new book differs from candidate
A's MEASURED build in its secondaries and its dam staffing as well as in research — compare it against candidate A rebuilt under the same rules, or
name both confounds wherever the two are read side by side; (c) the tick-cost design (one repeating Implementation entry per technology with a
country counter that reads 0 when missing; cheap conditions first in every bar — literacy, then the halved-mark switch, then the sources; no
placement while under the literacy line with no stored progress; the held flag set on `on_acquired_technology` + the campaign start + a yearly
sweep, never a monthly scan) is recorded in the session of 2026-10-11 and is to be confirmed by a 5-year amplified timing batch plus an
active-entry count in the save summary over the first century run.

## §10.98 — RESEARCH ENTRIES BEYOND PRODUCTION: SHIPS, CONTAGIOUS IDEAS, AND THE COUNTRY'S OWN CONDITION (user-ruled 2026-10-12; BUILT as jex-dam4s-rs, F227; CANON since 2026-10-12, §10.99)

The user (after F226: the leader's military and society at ~60% of vanilla's points): *"more tech spread and more JEs where possible"* as the
weak option, *"this and also a significant society research multiplier (possibly also with a slight tuning to ai values to prefer societal techs
a bit more)"* as the strong one — **the weak one first; tech spread deferred to a separate step**. Entries must reward what is otherwise a valid
thing to achieve: **no condition that invites suboptimal play to farm technology** (which rules out casualties, mobilised armies, war exhaustion
and front stalemates as sources).

**THE COMMON RULES (every entry, ruled):** conditions do not add up (any one qualifying ticks the bar once); **36-month stages, 20 stages, the
repeating implementation stage** (two stages pay the cost with no ahead-of-time penalty); the **literacy line by the technology's game era**
(25/35/45/55/65%, a pause) on every non-military entry; ⭐ the **frontline (war) entries tick faster — 12 months a stage** — but also non-additive
and 20 stages.

**RULED:**
1. **Ships, back on** (`naval_channel`): a ship type ticks its technology's bar if WE have one, a declared RIVAL has one, or a GREAT POWER has one
   — any of the three, one tick; 36-month stages (was 60, with ours +2 superseding a rival's +1).
2. **Contagious ideas** (the user's own design): a law in force in a country that is not a revolt (a revolt is temporary) ticks the technology that
   unlocks it — **radical** laws (socialism, anarchism, corporatism, political agitation, central planning, nationalism's ethnostate) from ANY such
   country; **advanced** laws (egalitarianism, human rights, feminism, labour movement, pharmaceuticals' insurance laws) only from a great power or
   a neighbour. The condition can turn off again (a law repealed), so it is recomputed, not raised once.
3. **Tropical empire:** quinine and malaria prevention tick while we or a sufficiently integrated subject hold land in the strategic regions
   West Africa, Equatorial Africa, East Africa (which includes the Horn's land; `region_horn_of_africa` is a SEA zone), Southern Africa or
   Indonesia — North Africa and the Nile Basin deliberately not. Integrated enough = `subject_type_colony`, `_dominion`, `_personal_union`,
   `_crown_land`, `_puppet`, `_vassal`, `_chartered_company`; NOT `_protectorate` (16 in the 1836 history, e.g. the Ionian Islands) and NOT
   `_tributary` — "it's important not to confuse them". **Civilizing mission:** a great or major power (an unrecognized major power does not count) with any colonial
   affairs law other than "no colonial affairs".
4. **Large state apparatus** (central archives, identification documents, macroeconomics, mass surveillance) — government administration.
5. **Antibiotics** — the chemical industry's workers (pharmaceuticals predates the chemical industry, so it does not).
6. **Mass media** (mass propaganda) — the electrics industry's workers.
7. **Cities** — the country's LARGEST urban centre, in levels: **modern sewerage 15, organized sports 20, elevator 40, paved roads 80**. Measured
   (vanilla, the largest per country): the world's largest 25 / 41 / 78 / 238 at 1850 / 1870 / 1890 / 1910; Belgium 8 / 22 / 41 / 131, the
   Netherlands 9 / 16 / 19 / 59.
8. **Universities at work** (dialectics, philosophical pragmatism, psychiatry, psychoanalysis, behaviorism, analytical philosophy) — **3 × N
   staffed university levels for a game-era-N technology**. Measured in 1860: this book Belgium 5 / the Netherlands 11 / Sardinia-Piedmont 0,
   vanilla 10 / 16 / 3 (the halved university output makes the AI build fewer).
9. **Capital needs institutions** (joint stock companies, corporate charters, central banking, postal savings, mutual funds, investment banks,
   corporate management, international exchange standards, modern financial instruments) — financial-district LEVELS, an absolute mark
   calibrated "to not exclude tall minors, roughly the same as with universities" (user: not relative to the economy): **10 × N financial-district
   levels for a game-era-N technology, AND the economic-system law is not `law_traditionalism`**. Measured at the technologies' narrative dates
   (vanilla n=16 / this book n=3): majors 90–500 mid-century; Belgium ~40, the Netherlands ~50–60 (163–190 by 1920), Sweden and Portugal ~20,
   Denmark and Sardinia 10–25; Belgium falls to 26–33 by 1900, so it loses the tech-era-4 technology.
10. **Overlap with vanilla's own entries (user, the same day):** a technology that a UNIVERSAL vanilla journal entry already advances gets no
   entry of ours, for now ("I understand that vanilla JEs underdo this a lot compared to what we do"). Found by tracing every vanilla entry's
   completion events to `add_technology_progress`: the art chain — Romanticism → realism (3,500), Realism → camera (4,150), Camera → film (6,000),
   Film → mass propaganda (5,850), shown to everyone but unrecognized countries ⇒ **realism, camera, film** (today's art-academy rung entries) and
   **mass propaganda** (the planned mass-media row) are to be dropped (pending the user's confirmation).
   ⚠⚠ **THE PREMISE IS FALSE IN THE MOD (found 2026-10-21, TIER_REFERENCE_AUDIT.md §3.1):** those vanilla art entries test
   `is_building_type = building_art_academy` together with `has_active_production_method = pm_traditional_art` / `pm_realist_art` / … — and in
   the mod rung 0 runs `pm_main_art_academy_traditional_art` and the later methods live on other buildings, so the chain can NEVER complete.
   Since `exclude_techs` shipped (2026-10-12) realism, camera and film have had no entry of any kind, and mass propaganda loses its 5,850.
   The fix is the vanilla-reference pass (POLISH_1_0.md §2), which makes the vanilla entries work again — not a revival of our own entries.
   Borderline: War Nursing's random
   "Prefab hospital" event offers progress to the first researchable of medical degrees / quinine / malaria prevention / antibiotics, wartime only
   and an option; Springtime of the Peoples → central archives is one-off and Europe-only (not universal).
**REJECTED:** domestic political pressure (circular — the movements demanding a law are themselves gated on that law's technology); non-unit
military entries from war conditions (farmable).
**COST DESIGN (proposed):** a bar cannot name its own country, so every condition reaching beyond it is computed in a monthly pulse and handed to
the bar as a flag: radical laws and the great-power half of advanced laws as GLOBAL flags recomputed each month (set or cleared — a repealed law
drops within a month); the neighbour half from the holders outward (each holder marks its adjacent countries, `is_adjacent_to_country`, with a
variable expiring after ~40 days); ships the same way.
11. ⭐ **THE RULED NUMBERS ARE THE FOLLOWERS' MARKS; THE FIRST ACQUISITION NEEDS DOUBLE** (user, 2026-10-12: *"let's have the ruled numbers as the
   halved ones, and for the initial acquisition they should double"*), for every counted mark of §10.98, the cities included: government
   administration and universities 6 × N first / 3 × N once a non-isolationist country holds the technology; financial districts 20 × N / 10 × N;
   the largest urban centre 30 / 40 / 80 / 160 first, 15 / 20 / 40 / 80 after; **antibiotics 500,000 chemical workers first, 250,000 after** — the
   500,000 calibrated as the FIRST acquisition (the top country's chemical workers 1925–30 on the §10.97 book: 381 / 559 / 652 thousand in 1925,
   555 / 592 / 882 in 1930; vanilla's leaders 640–2,139 in 1925). Yes/no conditions (ideas, tropics, civilizing mission, ships) carry no mark.
**MEASURED (2026-10-12):** the monthly checks cost nothing measurable (20261012_111843: Δ −2.0 ± 1.9 s a year 1836–41; ×10 checks +0.1 ± 2.1);
over the century the book plays ×1.005 of vanilla (F227). The book measured n=3 in F227: 2 intact / 1 broken by runoff, consensus loss 5.37.
**THE REVOLT FIX (2026-10-12, after F227):** a revolt acquires its technologies — firing the placement — before it inherits its parent's entries,
so the placement's has_journal_entry test lost the race and the inheritance logged "already has a journal entry" (627–843 lines a run). Nothing
is placed in a revolutionary country now (`NOT = { is_revolutionary = yes }`), and a completed stage adds the next only where it is absent.

## §10.99 — THE ARTMERGE ARM IS THE CANON: `jex-dam4s-rs` (user-ruled 2026-10-12; ROADMAP step 14's decision)

The user, after F227: *"CANONIZE artmerge with all these additions. The preartmerge config family is no longer canon, and while it's not
deleted yet, write that returning to it would need to reimplement performance changes."*
1. **THE CANON IS `config/mod_config.jex-dam4s-rs.json` + its tree twin**, copied verbatim to `config/mod_config.json` /
   `config/tech_tree_options.json`. Its chain: the artmerge arm (crafts + six merges, §10.91, the t1 anchors, the 1.2 pop-good lift, the
   compressed desire ladder, textile's host at its own cost) → the extra research entries (§10.95) → the four-class resource-slot dams and
   script-placed research entries (§10.89.13, the tick-cost fixes) → the §10.97 research rework (research halved, non-additive literacy-gated
   entries, 20 stages, follower halving, AI schooling) → the §10.98 entries (ships, frontline, contagious ideas, tropics, civilizing mission,
   state apparatus, universities, finance, cities, antibiotics). Measured: F227 (n=3: 2 intact / 1 runoff, consensus loss 5.37, majors 0.97 of
   vanilla's technology, the leader on the anchor principle, play ×1.005). The revolt duplicate-placement fix (§10.98's last paragraph) is in
   the emitter, not the book, and was probed on it (20261012_220651).
2. **THE PRE-ARTMERGE FAMILY IS NO LONGER CANON** — `canon-dams-family-nolog` (the canon 2026-09-29 → 2026-10-12) and every book before it.
   The files stay (not deleted yet), as records. ⚠⚠ **RETURNING TO IT WOULD NEED THE PERFORMANCE CHANGES REIMPLEMENTED**: those books carry
   neither tick-cost fix — dams as resource-slot buildings in four classes (`dams.layout = resource4`, built for the artmerge book's table)
   and research entries placed by triggers instead of `is_shown_when_inactive` (`research_events.placement = script`) — nor anything of
   §10.95/§10.97/§10.98; F220/F221 measured the cost those fixes remove.
3. Known open items carried into the canon (F227): one runoff seed in three; military technology ~10 behind vanilla (no tech-era-5 military
   technology held anywhere); tech spread ×2 and a society research multiplier deferred.

## §10.100 — CAPITAL ABUNDANCE MUST BE HARD TO REACH FOR A PLAYER ON A CLOSED MAJOR: THE WORLD-GDP AIM BECOMES 0.90–1.00, AND A CLOSED-MAJOR TERM IS TO BE DESIGNED (user-ruled 2026-10-13; FINDINGS F229, F231)

The user, after F229: *"with a skilled player being more likely to go capital-abundant than in vanilla, and even AI running off often enough under
our four-rung structure if it's lucky, we need to lower our targets a bit, at least in optimisation … the aim here is to make capital abundance a
hard to achieve goal for an average player, even on majors with no capital dump zones (so, GER or, to some extent, USA; GBR with its vast empire has
investment targets long after Britain itself is fully urban)."* Of the options argued (a lower world-GDP target, an asymmetric penalty, both, or
scoring the mechanism directly), the rulings:
1. **THE WORLD-GDP AIM IS THE BAND 0.90–1.00** (*"the band of 0.9-1.0 is good"*), in place of 0.95–1.05 (the register's "aim 1.0"). Inside it the
   term costs nothing; outside it the distance counts as before; the soft line (0.75–1.33) and the hard lines (vanilla's percentile interval ±20%,
   0.66–1.38 at n=16) are unchanged. `criteria.mjs` ships it as the default since 2026-10-13; `--gdp-aim 0.95,1.05` restores the old aim. Losses
   computed before that date are on the old aim (the canon's two intact runs score 5.6 / 5.3 on the old aim and 5.9 / 5.8 on the new one).
   ⚠ Why not a lower point target or an asymmetric penalty alone: F229's outcomes are one continuum, so moving the target trades runoffs for stalls;
   and the loss is scored on the consensus of intact runs (a median), on which an asymmetric penalty is only a shifted target.
2. **THE MECHANISM IS TO BE SCORED DIRECTLY ON THE CLOSED MAJORS GER AND FRA** — *"Let's go with PRU/NGF/GER (if for some weird reason all exist,
   take one, GER > NGF > PRU) and FRA. France tends to have a colonial empire, but not nearly as vast as GBR, and not in the same order of magnitude
   in population."* The USA is out (*"unreliable"*), Belgium out (it fits, but is too small, and the research entries penalise small countries).
   The term itself is NOT yet designed. ⚠ F231's measurement: France does not bind on any book measured (median end U* 52–69% at world GDP 0.9–1.25,
   capital-abundant in one run of 219), so a France term would read slack today; Germany binds, with a step at world GDP ~1.1 (full employment a
   quarter of seeds below it, two thirds above, capital abundance only above).
   ⭐ **AMENDED THE SAME DAY, on F231** (user: *"Full employment with capital piling up is very-very bad. Simply full employment is just bad; drop
   France for now."*): **the term is on GERMANY ALONE** (GER > NGF > PRU), and it has two severities — full employment of the closed major is BAD,
   full employment WITH the hoard piling up is VERY BAD and weighs several times more.
   ⭐⭐ **THE TERM, RULED AND IMPLEMENTED THE SAME DAY** (user: *"Yes, implement it with those numbers."*) — `criteria.mjs`'s `gerCM`, weight
   **1.5**, a default loss term: over 1927–1936, year by year, **e** = how far German U* is below 10% (0 at ≥ 10%, 1 at 0%) and **a** = e × the
   hoard's excess over 0.5 GDP ramped to 1 at 1.5 GDP; **G = mean(e) + 4 · mean(a)** (0–5). A run's own loss carries its own G; the consensus carries
   the arm's **lucky seed = the 75th-percentile run by G (nearest rank) over ALL its usable runs, broken ones included** (the better of two, the best
   of three). `--weights gerCM=0` drops it. Every number (10%, 0.5–1.5, ×4, 1.5, p75) is a chosen setting, not a measurement. First reading: the
   canon's consensus loss **5.37 → 7.28** (its runoff seed, run 3, has Germany fully employed with the hoard spent: G 0.98 → +1.47), rs-c20 11.06
   (G 0.99, again the runoff seed).
3. **A LUCKY AI SEED IS THE STAND-IN FOR A SKILLED PLAYER, AND EVERY REPORT USING IT SAYS SO** (*"All right, let's do that."*). ⚠ What a skilled
   player does better, in the user's words, is mostly NOT capital allocation: *"A skilled player knows which techs to rush and what research order to
   choose to maximise spread. A skilled player knows to grab easy access points into Africa to block other countries and get a lot of land unopposed.
   A skilled player knows when to attack a weakened rival. And yes, in economic development it doesn't misplace capital and knows how to propel up an
   unsustainable industry to avoid economy-wide problems from it being insolvent, but that's less important than everything else combined."* So the
   proxy is a lucky seed (more land, faster technology, the rival weakened) rather than a sharpened investment AI.
4. **The lever that matches the goal** (the capital cost of a job on the frontier rungs, i.e. the cost slope C against employment) is under the
   user's consideration, NOT ruled (*"So upping C further? I'll think on that."*). F228's C 2.0 widened the seed spread.

## §10.101 — A PER-INDUSTRY INPUT LIFT IS ALLOWED, ONE NUMBER PER INDUSTRY LINE; THE ENGINE LADDER GOES UNLIFTED (user-ruled 2026-10-13; FINDINGS F232)

The user, after F232's equilibrium model of the engine red flags: *"remove in1 for engines specifically, all rungs. The ruling that disallowed
fine-tuning industries was a result of our failure to balance it automatically with a solver, it might have been an overkill. I still want to keep it as
simple as possible, so as few specific rulings as possible, and better to have a reduced in1 for an industry line than a very bespoke recipe for one rung
specifically."*
1. **The 2026-09-19 closure of the per-industry axis (§10.86.4, "`in0` is ONE SCALAR") is RELAXED, not reversed.** A named industry may carry its own
   input lift — ONE number for its WHOLE ladder, every rung, so the steps between its rungs (and F97's death test) are untouched. Per-rung recipes stay
   out, and so does a per-industry level solved to a target margin (`--in0-level` stays closed: that was the solver by another name). Each such
   exception is a ruling of its own, kept as few as possible.
2. **The first: the motor industry (engines) at lift 1.0** in place of the book's 1.2 — steel 36 → 30 per 40 engines on the steam rung (vanilla's own
   recipe), 40.7 → 33.9 steel + 30.5 → 25.4 electricity on the electric rung, 53.8 → 44.8 steel + oil on the diesel rung. WHY (F232): engines are about
   half of the canon's input-price problem market-years; at the equilibrium where new engine factories pay back like the average new tiered capital,
   the unlifted recipe clears 64% of engine problem-years against 38% today.
3. **Implementation:** `make_ab_config --in0-for <industry>:<mult>[,…]`, recorded as `_ab.in0_for` only when set (every earlier book regenerates byte
   for byte), re-derived by `lint_tier_eras.mjs` (L31; proven to fail on the book with the record stripped). Book: `config/mod_config.jex-dam4s-rs-m10.json`
   = the canon's recorded chain with `--in0-for motor:1`; field diff against the canon = the three motor rungs' inputs and their restated target_be /
   wage_pct, nothing else. ⚠ Its `_variant` record says "10.100" — written before a peer session took that number; it means this section.
4. **The plan (the same message):** three 30-year probes (`rs_m10_30y_n3.json`); if they hold, the research entries' bar goes from 3 to 4 years a stage,
   and the combined book runs a century n=3 under the register as amended by §10.100.
5. **PRECEDENCE (user-ruled later the same day):** *"an individual decision overrides a more general one. It's 'paper', more importantly than a pop
   good."* ⇒ an industry's own lift (`--in0-for`) replaces the pop-good lift (`--in1-pop`) on its anchor and lower rungs as well as the general lift
   above them — its WHOLE ladder carries the one number. Implemented in `make_ab_config.mjs` (it used to refuse the combination); L31 already gave
   `_ab.in0_for` priority. Proven: the m10 chain's A/B book regenerates with 0 differing leaves, and `--in0-for motor:1,paper:1` moves exactly the four
   paper rungs' inputs and their restated target_be / wage_pct (the t0 paper rung's A/B recipe is replaced by the craft rule later in the chain).
   **Paper is the proposed next per-industry lift** (the second-largest problem good in every artmerge book; a large share of government upkeep through
   government administration — the user's expectation is steadier budgets and possibly less dispersion in world GDP). Its value is not yet chosen.
6. ⭐⭐ **IN THE CANON SINCE 2026-10-16 EVENING** (user: *"Canonize unlifted engines and conditional merge-host desire"*): the canon is
   `config/mod_config.jex-dam4s-rs-x25-m10ac-dpriv.json` (sha256 `fc7490eb6288514b`) = F239's measured `jex-dam4s-rs-x25-m10ac` (x25 + `--in0-for
   motor:1` + §10.91.2's `--ai-rule cond`) + `dams.private = all` (§10.89.14). Measured without the private dams only (F239, n=3: 3 intact, consensus
   loss 6.72); the combination is unmeasured. Paper stays at the general lift.

### §10.101.1 — THE ROUTINE OPTIMISATION LEVERS (user-ruled 2026-10-13)
The set a routine search for the optimum moves — everything else is either decided, or recalibrated only as a separate, deliberate event.
- **The ladder:** A (output step per tier), B (input step per tier), C (cost step per tier); **in1** the general input lift; **in1 for pop goods** (the
  anchor and lower rungs of industries whose output pops buy — a separate dial, though today equal to in1); **the two t0 steps down**, one for the
  crafts — the craft rule's SHARE of vanilla's goods per worker (today 0.6), the 0.89× hiring-floor crossing held fixed (user-agreed) — and one for the
  non-craft t0 rungs (today `--down-step` 1.5); **per-industry in1** where ruled (engines 1.0; **paper a likely lever, today 1.2 on every rung,
  range 1.0–1.3**, value not chosen).
- **Research:** ONE combined innovation parameter **x** (user-ruled the same day): innovation base = cap base = the cap's literacy term = x, and the
  universities' innovation × **x/150** — vanilla's base equals its cap base, so the room universities fill is 150 × literacy there and x × literacy here,
  and x/150 keeps the number of universities needed to reach the cap at vanilla's for every literacy. At the canon's x = 25 that is ×1/6 in place of ×0.5
  (today a country needs a third of vanilla's universities to reach the cap; the canon's leaders sit on it with 16–31 levels against vanilla's 46–83). Flat
  innovation from companies, power-bloc principles and events is not scaled ⭐ (AMENDED 2026-10-21, user-ruled, POLISH_1_0.md Q1: the four
  FLAT adds are now ×1/3 — Philips cap 15 → 5, Advanced Research III cap 5 → 1.5 per schools level, the expedition's weekly innovation 10 → 3,
  Cuba's modernisation cap 30 → 10 — so each keeps its vanilla share of a literate major's cap; config `vanilla_value_overrides`. Event research
  GRANTS stay vanilla's, a third of a technology, Q2). **IN THE CANON SINCE 2026-10-13** (`jex-dam4s-rs-x25`, `make_research_levers_config --innov-x 25`; unmeasured); **tech spread** (unused so far, vanilla's); **the length of a non-war research-entry stage** (48 months in `jex-dam4s-rs-m10-je48`).
- **NOT levers:**
  - **The AI desire ladder** is not a lever in itself: it is CALIBRATED per config to minimise misplaced capital (§10.92), better or worse.
  - **Decided:**
    - the grant per stage (half the era's base cost when no ahead-of-time penalty applies — research effectiveness is carried by the stage length);
    - the trade weights (per-good, non-vanilla, at ×1; scaling them is closed);
    - the merge-host cost rule;
    - the dam staffing.
  - **Separate recalibration events at most, never routine:** the entry marks, the literacy gates and the power-plant cost.

### §10.101.2 — COST LEVEL AND COST SLOPE ARE SEPARATE DIALS: `cost1` (user-ruled 2026-10-14; under test)
The user, 2026-10-14: *"I want to reduce capital abundance and depeasantation. I'd push C some more, but I'm already unhappy with the fact that payback
periods on e3 are not significantly better than e2. Idea: add cost1-factor, similar to what in1 does, but for cost"*, then *"Let's try C=1.8 and cost1=1.2"*.
1. **What it is:** ONE multiplier on every rung's `building_cost` (`make_ab_config --cost1 <k>`, recorded as `_ab.cost1` only when set, re-derived by L31).
   It multiplies the anchor, so the non-craft t0 rungs move with it (a t0 left cheaper would reward rebuilding the old rung) and the crafts follow
   through the ÷50 rule (6 → 8 points). Output, inputs, ai_value and target_be are untouched.
2. **Why a separate dial:** raising C alone makes t3 relatively dearer. Measured on F227's end state (the shortlist at 1935, £600 a point), paybacks run
   t1 8.6–11.8 y, t2 7.6–10.6 y, t3 7.1–7.9 y — t3 barely better than t2. cost1 sets how capital-hungry the ladder is; C sets the t3-vs-t2 relation.
3. **The first book:** `config/mod_config.jex-dam4s-rs-x25-c18k12.json` = the canon's recorded chain with `--cost-ratio 1.8 --cost1 1.2` in place of
   `--cost-ratio 1.9` (the unchanged chain proven to reproduce the canon with 0 content differences first). Against the canon, `building_cost` alone:
   t0 ×1.27, t1 ×1.20, t2 ×1.14, t3 ×1.08 (the ladder pivots at the t1 anchor). Batch: `rs_c18k12_n3.json`, a fixed n=3 century.
4. **The static expectation (stated before the batch):** with the same capital in the tiered sector and ~1/1.15 of its levels, world GDP −6 to −7%, the
   shortlist's −9 to −10%, U* +1.3 to +1.8 pp world and +2.8 to +3.4 pp shortlist. The tiered sector is ~48% of world GDP and ~70–75% of the
   shortlist's, and 10–13% of the world's workforce against 21–25% of the shortlist's. Feedback loops are expected to change the size, not the sign.
5. **Measured (FINDINGS F234, n=3, 2026-10-14):** 3 intact / 0 broken, world GDP 0.95 / 0.84 / 1.01, consensus loss 5.37 against the canon's 7.28,
   the closed-major term 0; t3 pays back in about two thirds of t2's time in two seeds of three; PI no longer falls and the input-price problem
   market-years rose 208 → 245. Not ruled on.

## §10.102 — THE NEXT ARM CARRIES `NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD = 0.99`; CANONISED ONLY AFTER AT LEAST n=3 PERFORMANCE TESTS (user-ruled 2026-10-17; FINDINGS F241) — ⭐ CANONISED 2026-10-21 (F248, item 4)
The user, 2026-10-17, after the probes of F241: *"We will likely go with that in the future. While we won't canonize it prematurely, before at least
performance tests on n=3, I want the next arm to have this change"* — and, on scope, *"Vanilla in-market monopolies are broken by design, but are out of
scope for us"* (the lever was acceptable only because it touches foreign trade alone).
1. **What it is:** the engine's own key for the world-market monopoly threshold (its define registry; vanilla's file misnames it
   `WORLD_MARKET_MONOPOLY_MIN_SHARE`, a dead key, and sets the real one nowhere). Vanilla's default is below 0.36, so EVERY traded good's world price
   carries `MONOPOLY_PRICE_IMPACT` 0.2 × its leading exporting market's share (+7% to +20%). At 0.99 the markup stays only on goods one market exports
   above 99%. Country and company monopolies do not read it.
2. **What it does, measured (F241, one year from the user's 1935 save):** the freed goods' world prices drop by exactly the markup in week 1 and climb back
   within 2–3 weeks; trade centres re-allocate full capacity — the freed goods' world exports −5 to −9%, imports +4 to +11% in months 1–2; importers' local
   prices ×0.990 at week 4; markets with no trade capacity bit-identical for the first month; in-market company monopolies show no change of their own.
3. **The book:** `config/mod_config.jex-dam4s-rs-x25-m10ac-dpriv-wm99.json` + twin = the canon + `game_defines` + `_wm99_variant`, nothing else (field diff
   proven; build diff = the `NEconomy` block). Every next arm builds on it. Deployed for a playtest 2026-10-17 21:23 (`mod_playtest_wm99/`).
4. **Before canonising:** at least n=3 performance tests (the wall clock against vanilla and the canon); the economic read comes from the same batch.
   ⭐ **Set at n=4 (user, 2026-10-19):** *"n=4 under the monopoly to decide whether it gets canonised"* — the decision for mod 1.0, after a thorough
   explanation of the change to the user.
   ⭐⭐ **THE DECISION RULE (user, 2026-10-19 late evening, after the explanation):** *"it's 0.99 if performance is adequate, and we don't touch it
   otherwise."* ⇒ **performance is the only criterion**: the n=4's play time (`wall_clusters.mjs`, the main median over clusters 1 + 2) within the
   +10% budget against vanilla n=16 ⇒ the wm99 book becomes the canon at 0.99; over it ⇒ the threshold is left at the engine's default (no
   `game_defines`). No other value (0.5, 1.0) is in play. The register and the ledger are read from the same batch as the record, not as the gate.
   Batch: `tools/testbed/schedules/wm99_n4.json` (4 × 1836→1936, fixed n, no stop watcher).
   ⛔ **OUTCOME (2026-10-20, FINDINGS F247): NOT CANONISED.** Session `20261019_225952_wm99-n4`: main median 194.2 min (runs 2 and 3; runs 1 and 4
   listed-bug fleet loops) against vanilla n=16's 165.0 = **×1.18**, over the ×1.10 budget. The canon keeps the engine's default; the wm99 book
   stays as the record and no next arm builds on it. ⚠ The book is the canon + the define, and the canon itself (private dams) has never run a
   century, so the result does not say the THRESHOLD costs time — only that this book is over the budget. The canon's own century is the open
   performance question for mod 1.0.
   ⭐⭐ **OVERTURNED 2026-10-21 — CANONISED** (user: *"Canonise the monopoly effects on intenational trade only kicking in in extreme cases of over 99%
   supply"*). The ×1.18 was read against the SUMMER vanilla; vanilla re-run on 2026-10-20/21 (n=6, game 1.13.11, today's harness) plays at a main median
   of 178.5 min, ×1.08 of the summer's 165.0, and stays ×1.08–1.09 slower at the same live pop objects, building levels and world GDP (FINDINGS **F248**).
   Against that same-days vanilla the wm99 n=4 reads 194.2 ÷ 178.5 = **×1.09, inside the budget**. ⇒ `config/mod_config.json` is the wm99 book verbatim
   (sha256 `64c024535cbd9b71`), built and deployed 2026-10-21. ⚠ Thin: two of the n=4's runs are in clusters 1 + 2 and the reference is n=6; the
   alternating vanilla + canon batch (`tools/testbed/schedules/alt_vanilla_canon_n16.json`, ~4 days, after the first round of polish) is the measurement
   that settles the canon's place against the budget.

## §10.103 — TREATY PORTS: THE FUNNEL AS MEASURED, THE LAYERED SOLUTION, AND THE DEFERRAL TO MOD 1.1 ON GAME 1.15 (user-ruled 2026-10-19; FINDINGS F243–F246)
The user, 2026-10-19, after the treaty-port arc: *"We'll wait for a promised significant AI decision making rework in 1.14. Document the treaty ports
findings and possible multi-layered solution thoroughly, and defer it to possible mod version 1.1 (game version 1.15)."* ⇒ **Nothing of this ships in
mod 1.0.** The canon carries neither `ai_treaty_ports` nor `treaty_port_rules`, and both emitters write nothing when their key is absent (a canon
build is unchanged by them). Every piece below stays in the repo, built and probed, for a decision on game 1.15.

**0. The release timeline it is deferred against** (the user, the same message):
1. **30.10** — mod 1.0 released for Victoria 3 1.13.
2. **05.11** — Victoria 3 1.15 released, with 1.14 folded in by the developers' decision (1.14 is where the AI decision-making rework was promised).
3. **~12.11** — a 1.15.N patch that is stable enough to build on.
4. **~16.11** — mod 1.1 for 1.15.N. **This is where treaty ports could go, or not.**
5. **18.11** — GTA VI comes out, and attention to Paradox games, let alone mods, is gone until the new year.
⚠ Between steps 3 and 4 there are about **four days**. That fits the 10-year probes (~25 min each) and at most ONE n=3 century (~9–10 h), and
nothing iterative. So the 1.1 decision has to be made mostly on whether the 1.15 AI needs the artificial layers at all (§3 below).

**1. Why treaty ports belong in this mod.** A treaty port is the one gateway into a closed or thinly traded market that the host's tariffs,
subventions, embargoes and isolationism cannot shut (F243 §1). A technology leader's exports reaching a lagging market through it are exactly
the price pressure THE CORE DESIGN ELEMENT needs: the host's output prices fall while its old rungs' input prices do not. The user's own motive as
an exporter (F243): *"not allowing me to kill their industries by abundance of higher-tech supply"*.

**2. The funnel, link by link, as measured on 1.13** (the user's own summary, amended where the measurements disagree with it):

| link | what 1.13 does | evidence | status |
|---|---|---|---|
| **0. Eligibility** | only a state with a PORT BUILDING can be ceded (`is_potential_treaty_port`; 798 eligible states hold a port at 1836, 723 ineligible hold none); the engine seeds a level-1 port in the new treaty port on cession | F244 §6, §7 | **solved by layer A** (probed on the treaty route) |
| **1. Pursuit** | the AI STARTS treaty-port plays only against unrecognised or decentralised hosts, whatever the desire, and NEVER adds a treaty-port demand to a play it is already in; yet it SCORES the desire against recognised hosts too (25 of 176 pairs carrying the treaty-port reason, all under the secret goal "conquer"). The PLAYER is gated by rank, not recognition | F243 §2, F244 §2, §5, §10 | **opened by layers B + C**; the user is against the artificial driver |
| **2. Persistence** | a new port lives a median ~7 years (2–48): the article's `requirement_to_maintain` fails when politics moves the port province (civil wars, a third country taking it; one Russian lapse unexplained); the host never withdrew. 1–5 ports stand at a time over the century against vanilla's 0 at 1936 in 14 of 16 seeds | F244 §4, §9 | **accepted as the game's own politics** |
| **3. Trade capacity** | of 24 new ports over three centuries, 11 never traded, 8 reached 12–48 capacity, 5 reached 100+ (Calabria 375, Zhejiang 203, Shaozhou 201, Bengal 157, Tuscany 133). The AI's trade-centre GDP gate is NOT what empties them: under vanilla's defines it built Macau's and Hong Kong's trade centres at a quarter and a tenth of the threshold | F245 link 1, F246 | **open**: why ports in RECOGNISED markets stay empty |
| **4. Imports → the host's prices** | the trade AI fills the host's SHORTAGES first (Macau supplied 77% of the Qing market's luxury clothes, 73% of its luxury furniture); mass goods get 3–12% of the host's supply, and by the price formula pushing an importer's premium down to the world price needs ~40–50% extra supply. Local prices are not in a save, so this link is computed, not observed | F245 links 2–3 | **diluted, not refuted**; economy-wide, more capacity did narrow the importer premium (F161 §6) |
| **5. Price → the old rung** | at the world's average realised price 59–88% of the consumer-chain old-rung levels sit below break-even | F161 §4 | **works if link 4 delivers** |

⇒ Every link now works or has a working fix; what is thin is VOLUME — how many ports the AI takes and keeps, and how much trade capacity the ones in
recognised markets build. ⭐ **For a player hegemon the funnel is open already on 1.13**: the rank gate lets a player demand ports from recognised
countries, and the capacity needed to add 40% of a host's supply of ten consumer goods is ~14 trade-centre levels for Japan at 1866 and 115–327 for
the Qing over 1866–1936 (F245's hegemon table). One real headwind sits in the engine, not in our implementation: shortages are filled before mass
goods, so a port undercuts the host's own industry only after its shortages are met.

**3. The layered solution — five layers, each usable alone, each built and probed on 1.13:**
- **A. ELIGIBILITY** — `treaty_port_rules.no_port_building` + `seed_port_on_cession` (`tools/emit_treaty_port_rules.mjs`). Our check
  `pmr_treaty_port_candidate` (coastal, not already a treaty port, the host controls the port province, not the taker's) replaces the engine's
  port-building requirement in whole-file copies of `common/treaty_articles/14_treaty_port.txt` and `common/war_goal_types/25_take_treaty_port.txt`;
  a level-1 port is built inside the article's `on_entry_into_force` just before vanilla's `cede_treaty_port`. ⚠⚠ **USE BOTH OR NEITHER**: the
  override alone hands the port province over as plain territory, because the engine sets the treaty-port status only where the state holds a port
  at the moment of cession (F244 §8: Ceará). ⚠ Proven on the TREATY route (Yucatán → France flagged); the WAR route is inferred, since no portless
  play resolved inside the six-month probe.
- **B. DESIRE** — `ai_treaty_ports` (`tools/emit_ai_treaty_ports.mjs`): one additive `treaty_port_value` block in every administrative strategy —
  the target's trade-law points, population, the host state's population and GDP; × 0 under our conquer stance on the region, × 0.25 where a
  protectorate is possible, × 0.5 where we already hold a port in their market; −1,000 at a technology lead of ≤ 5. The chosen scale is **×4**
  (`tpd4`, whose block reads after scaling: sakoku / canton system 140, isolationism 160, mercantilism 48, protectionism 40, free trade −40, capped
  at 400), because the measured threshold sits there: a demanding AI lets its play lapse at a desire of 15–40, and weaker hosts cede at 160–400
  (F244 §3).
- **C. PURSUIT** — three forms:
  - **C1, the driver as built** (`ai_treaty_ports.driver`, `tpd4`: 10% a year, desire ≥ 60, an 8-year cooldown, no great-power hosts): an AI that
    is recognised, a major power or above, at peace, in no committed play, permitted aggressive plays and not infamous starts a `dp_take_treaty_port`
    play on the recognised-host state with its highest engine-computed desire. Measured: +0.7% tick cost, treaty-port demands 3–6% of active war
    goals, 5–11 new ports a century (F244 §3–§4, §9). ⚠ The user is AGAINST it: it bypasses the AI's own decision whether to go to war.
  - **C2, the organic driver (designed, NOT built)** — the same play-start step, but gated on what the engine itself already decided (F244 §10):
    (1) `has_secret_goal = { who = <host> secret_goal = conquer }` toward the host (every pair carrying the treaty-port reason holds it), or attitude
    belligerent; (2) relations below cordial (the play's own `possible`); (3) affordability — not in default, debt under a line, our
    `army_power_projection` against the host's and its likely allies', mirroring the engine's own play confidence (force balance 75 at 4:1, debt −25,
    bankruptcy −25, our own other conflicts −25); (4) a host ALREADY AT WAR raises the chance rather than blocking it (the engine's own
    `DIPLO_PLAY_CONFIDENCE_FROM_ENEMY_CONFLICTS` +25), weighted by the war's BURDEN — the host's enemies' army power against its own, so a Qing putting
    down a three-battalion uprising barely counts and a Qing holding off Russia counts fully; (5) a state already demanded is marked per state, and a
    host whose every candidate state is demanded is skipped. ⚠ Summing `every_enemy_in_war` inside a script value is not yet verified in game.
  - **C3, the engine's own pursuit** — no driver. ⚠ Two engine behaviours stand in the way on 1.13: the start-of-play filter that leaves recognised
    hosts out (engine-side, no script names it), and the never-added rule (a treaty-port demand is only ever a play's OPENING goal). The script
    candidate for the second is `skip_build_list` on the `take_treaty_port` war-goal type; untested. A debug game's console command
    `ai_evaluate_treaty_port` prints the engine's own score for one state, which is the direct way to see what 1.15 changed.
- **D. TRADE CAPACITY** — `treaty_port_rules.trade_center_gate` (`tools/emit_treaty_port_rules.mjs`): the engine's trade-centre GDP gate off in
  `ai_defines` (MARKET_CAPITAL 1 / NON_MARKET_CAPITAL 2 — the engine rejects 0, and a NON_MARKET_CAPITAL not above MARKET_CAPITAL, at load, L33),
  vanilla's test re-written into the trade centre's `can_build_*` with treaty ports exempt. Measured (F246): no tick cost (Δ −0.5 ± 3.6 s per in-game
  year), world trade-centre counts inside the reference range, and nothing gained in the ports, because the gate was never what kept them empty.
  ⇒ **KEEP OFF unless 1.15 shows the gate binding.** The open question is the cause in recognised markets; candidates, none measured: the port's
  workforce (a trade centre needs 800 clerks and 200 shopkeepers a level; the cession moves 1,000 of the taker's people), the trade centre's profit
  inside a richer, recognised market, and the taker's own construction priorities.
- **E. MEASUREMENT** — the tools that read all of it: save summary v19 (`world.war_goals`, `world.treaty_port_goals`, `world.treaty_ports`),
  `ledger/war_goal_mix.mjs` (the war-goal census), `ledger/treaty_port_trade.mjs` (a port's flows against its host market, and `--need` for the
  capacity a share would take), `ledger/ai_country_goals.mjs` (stances, attitudes and the pairs carrying a reason), `ledger/market_good_snapshots.mjs`
  and `ledger/world_price_rings.mjs` (one good through a run's saves), and `ledger/arm_tick_cost.mjs` for the cost.

**4. The books** (all gitignored, regenerable): `…-wm99-tp` / `-tpx` / `-tpd` … `-tpd4` from `tools/make_treaty_port_config.mjs` (each book's
`_treaty_port_variant.command`; `tpd4` = `--driver production-nogp --scale 4`); the eligibility probe books `…-wm99-tpr0` … `-tpr3` and the gate book
`…-wm99-tpd4-tcg` were made by hand from those (their `_treaty_port_rules_variant` / `_tcg_variant` records say how). ⚠ For 1.1, teach
`make_treaty_port_config.mjs` the `treaty_port_rules` keys, so a book carrying layers A and D comes from one command rather than a hand edit.

**5. The plan for 1.15.N, in order (the four days of §0):**
1. **Re-read the engine facts the AI rework may have changed** before building anything: the port-building requirement (the campaign-start
   eligibility log, `tp_potential_probe.json`), the pursuit filter (the extreme desire WITHOUT a driver, `tp_extreme_10y.json`: does the AI start
   plays against recognised hosts now?), the never-added rule (`war_goal_mix.mjs` over a 30-year run), the stances (`ai_country_goals.mjs`), the
   trade-centre defines and the files the emitters patch (ON_GAME_UPDATE's treaty-port rows).
2. **If the 1.15 AI pursues recognised hosts by itself:** ship layers A + B (and E), no driver — the most organic outcome, and the one the user prefers.
3. **If it does not:** C2, the organic driver, built and probed for ten years against the same book without it; C1 only if the user rules it in.
4. **A 30-year read** of the chosen stack: ports standing, trade capacity per port (`treaty_port_trade.mjs`), the tick cost. A century n=3 only if
   the time allows; otherwise the feature ships, if at all, on the 30-year read and the user's playtest.
5. **The recognised-market capacity question** (layer D's open item) is worth a probe of its own only if ports in recognised markets keep standing
   empty under 1.15.
