# PM & Tech Rehaul — Victoria 3 mod

An **economic-realism mod for Victoria 3 (1.13 "Matcha")** that addresses structural
deficiencies in the base game's economy.

## Why this mod exists (the goals)

The vanilla economy is too forgiving and makes technology feel cheap. Concretely:

- **A technological edge should really matter.** Falling behind on tech should cost you
  markets; leading should let you out-compete rivals. Vanilla blunts this.
- **The economy should be more competitive and aggressive** — efficient producers should
  drive inefficient ones out of a market, not coexist indefinitely.
- **Upgrading production should cost capital, like it does in reality.** Today, turning an
  1830s-design factory into a 1930s-design one is *free* — you just flip a production method.
  That is ridiculous. A more modern, more efficient plant should have to be **built** (real
  construction cost, real capital demand), not switched on for nothing. This raises the demand
  for capital and creates a realistic capital deficit as economies modernize.

Everything below — "one main PM", "a building per tier", the profitability ladder — is a
**means to those ends**, not the point. If a mechanic doesn't serve the goals above, it's wrong.

## How the goals are achieved (the means)

1. **One main PM per building.** Each economic building keeps a single main production method.
   The old free "switch your factory to a newer method" upgrade path is removed. Secondary /
   redistribution groups (automation, luxury, canning, distillery, glassblowing, …) stay.
2. **A building per tier.** Each former main PM becomes its own building type, unlocked on the
   same technology the old PM used. Modernizing now means *constructing* the newer building —
   spending capital — instead of a free toggle. (This is the mechanism for the capital-demand
   and "tech matters" goals.)
3. **Profitability ladder.** Outputs/inputs are re-sloped so a tier-N building can't stay
   profitable once tier-(N+2) buildings flood the market — so a tech lead actually pushes
   laggards out. Governed by `BALANCE_FRAMEWORK.md` (the balance source of truth).

## THE FIVE-ERA LADDER (current method — supersedes the BE targets)

The mod has its **own five technology eras**, anchored at **~1750 / 1850 / 1900 / 1925 / 1940** —
deliberately wider than the game's window at the front and **contracting** towards the back, because
technical progress accelerates after the industrial revolution. **No industry has two tiers on one era.**
89 tiers over 22 industries: 67 real + **22 `model_only`** (modelled but NOT emitted, because the game
has no unlocking technology for them yet — the builder gets a filtered config, `ui/data.js` gets the
complete one). Some ladders stop early, recorded per industry as **`ladder_end`**: `plateau` (food,
textile, furniture — the last tier is permanent, so its good's price must hold that tier up rather
than deflate past it, which is Baumol's cost disease falling out of the model) or `extinct` (sail
shipyards — the industry **actually dies**: no price floor, *and* it is not placed in a scenario two eras
past its last tier, *and* neither is any tier whose input it was the only source of. Making only the first
half true left a −84% shipyard alive in 1935 feeding an era-1 port that then out-earned the modern one —
BALANCE_FRAMEWORK §10.30).

**Balance is now solved as one interdependent economy with prices UNLOCKED, not against fixed prices.**
The old per-tier `target_be` ladder (era anchors, the H1 input discount) is **superseded**: it priced
every good at 100% of base, which is exactly the assumption the rehaul is trying to stop making.
`target_be` survives only as a **derived drift guard** so `lint_profitability.awk` still catches an
accidental hand-edit; it is no longer a design input, and `solve_be_targets.ps1` / `solve_volumes.ps1` /
`solve_building_cost.ps1` are legacy for tiers on this ladder.

The pipeline (**Node ≥ 24 required**, `C:\Program Files\nodejs`):
```
node tools/build_era_ladder.mjs --write   # structure: eras, invented tiers, ×1.5 output ladder
node tools/era_scenarios.mjs   --write    # THE solve: prices, volumes, counts, pops, army
powershell -File tools/build.ps1
```
`tools/era_solver.mjs` is the **balance-only reference view** (margins alone, no scenario) and writes
`config/era_prices.json`; `tools/era_scenarios.mjs` is authoritative and overwrites its volumes.

**Why prices are realised rather than prescribed.** Deriving a price path from profit margins alone
produces numbers no market composition can reach — steel at 150% of base in era 1 is unreachable because
an era-1 economy has *no steel consumer at all*. So the solver never assigns a price. It reads what the
order book produces (the game's own formula, on the scenario's own orders) and moves the one lever it
has, **building counts**, until the profit targets hold at whatever prices result.

**Targets:** era-appropriate tier **+20%**, one era stale **−5%**, two eras stale **−30%** (the third is
a *check*, not a constraint — two eras of the −5% drift compounds to about −11%, so the two cannot both
be imposed); extraction/logging **+20%**, agriculture **+10%**, with significant variance accepted.
**Shipyards carry a further −30pp on all of them**, because none of their income from naval ship
construction is modelled. A plateaued industry's last tier holds **+5%** forever.

**⭐ THE GOAL A SCENARIO SET MUST CLEAR IS "ILLOGICALITY" — BALANCE_FRAMEWORK §10.11.** Those profit
targets are a *means*; illogicality is the end, and it is what says whether the tech ladder actually
works. Three faults, counted per industry per scenario and summing: (1) the era-appropriate tier **loses
money**, (2) a **two-eras-stale** tier still turns a profit, (3) the ladder is **inverted** — the newest
tier earns less than the one below it. Acceptable: **~0** for (1) and (3), **in the teens** for (2),
**excluding shipyards and art academies** (both have targets they cannot meet by construction).
`tools/era_scenarios.mjs` prints the count per era with the offending industries named.
**Current state: 41 points, 30 excluding the excused (3 / 4 / 12 / 10 / 12 per era) — NOT yet acceptable.**
⚠ The excluded count rose 27 → 29 when `extinct` was made real (§10.30.2) — kept deliberately, because the
variant that scored 40 breached the industrial ceiling and the ceiling outranks the metric.
It is **live in the balance UI** as the **Ladder check** panel, from ONE shared implementation
(`ladderFaults()` in `ui/econ.js`, called by both the UI and the solver). It scores only the buildings a
scenario actually CONTAINS — an absent industry or a tier at Number 0 is never a fault and never the
comparison partner for one — so zeroing things out while tinkering can only lower the count (§10.17).
✅ **The write cycle is a STRICT FIXED POINT** (BALANCE_FRAMEWORK §10.25, closed 2026-08-05): config,
presets and the printed report come back byte-identical after every `--write` → re-run. It got there by
making the recipe MIX come from the vanilla recipes alone — the run prints `RECIPE MIX: own 67 · below 22`
and warns if any tier ever reads its mix from the previous write.
✅ **The count/price loop now CONVERGES** (§10.28): it used to limit-cycle forever at a 19–94pp residual,
because a proportional controller cannot settle integer building counts (a good wanting 6.4 levels toggles
6/7, worth ~20pp of price). A **deadband with hysteresis — stop chasing at 8pp, resume at 15pp** — fixed it:
residual 5/12/4/9/1, profit targets **75 of 86 within 8pp at a mean miss of 5.7pp** (was 60/85 at 11.0pp).
⚠ **The score is reproducible but the response surface is JAGGED** — deadband 8 scores 45, 10 scores 50,
15 scores 45. So the five-point rule still applies to *design* changes: a result worth 1–3 points is not a
result, even though re-running reproduces it exactly.
⚠ **PM choice still never settles** — with prices converged, that is now a genuine discrete limit cycle in
the method choice and is the next thing to look at.
⚠ **THE LARGEST REMAINING BLOCK IS NOT A BALANCE PROBLEM (§10.29).** Every insolvent industry is *floored
at 1 level* and pinned at the 25% price band edge: era-1 steel has **zero** buyers (its first consumer is
an era-2 tier), and era-3 telephones read buy 18 against sell 72 because they share `popneed_communication`
with `transportation`, which is sold in vast quantity. Two obvious remedies were measured and **both fail**
— a 4× bigger market leaves the prices *identical* (supply and demand scale together), and cutting the
debut tier's output makes the industry **worse** (−29% → −62%), because pop money is allocated by supply
share, so less supply buys less demand. Do not re-try either; §10.29 states the remaining options.
⚠ **§10.32 answers "how many industries have no market yet": exactly ONE** — era-1 steel (gold aside). The
only other producer-before-consumer gap is `steamers` (made era 2, first eaten era 3), and pops buy those.
**19 of 22 industries sit exactly on their vanilla unlocking tech's era**; the three that do not —
`synthetics`, `electrics`, `automotive` — are placed one era EARLY by deliberate historical correction in
`build_era_ladder.mjs`, and are precisely the offenders. That is the true source of the "consumer arrives
an era late" gap: the building was moved by hand, the PMs that buy its output were left on vanilla's era.
**Four candidate fixes were measured and none is a clear win** (moving the engine industry to era 1 → 47;
moving railway too → 51; the no-buyer rule → 39 dropped / 45 zeroed, the better figure again coming from a
defect). **The steamers half is now FIXED** by giving port a five-era ladder (§10.33), and **§10.35 supplies
the fix for the rest** — see below.
✅ **§10.34: TWO INDEPENDENT SOURCES AGREE ON THE READING WE SHIP.**
`game/common/pop_needs/00_pop_needs.txt` documents the mechanic in a header comment: `weight` is *"the base
weight applied to this good based on market Sell Order share"*, `max_supply_share` *"the maximum weight
that can be applied … relative supply above this amount will have no further impact"*, `min_supply_share`
*"a minimum of this multiplier of the base weight … regardless of its market Sell Order share"*. That is
**exactly what `needSplit()` does**, and **F31 measured the same conclusion independently** against the
game's own consumption telemetry. ⚠ **The comment alone would not settle it** — shipped statements can be
confidently wrong, and a comment that was true when written rots silently after the code moves. It carries
weight here only because an independent measurement agrees with it. **Read that file before theorising**
(cheap hypotheses), **and corroborate before believing** (docs are not evidence on their own).
⚠ F33 briefly claimed to refute it; that claim is **RETRACTED** — an argument that concludes the documented
rule is impossible is a broken argument. Its measurements stand, its inference does not. The live question
is now **why our implementation of the documented rule yields so much less demand than the game does**,
with the `local` goods abstraction (§10.35.1a) the leading suspect. Superseded text follows:
⭐ **AND F35 SAYS WHY NO AMOUNT OF THAT ARITHMETIC COULD EVER HAVE SETTLED IT.** F33's telephone case was
called "unconditional" because telephones sit in exactly one need. **A single-need good is not a
single-good need** (user, 2026-08-06): `communication` is `telephones` + `transportation`, and
`transportation` is both multi-need and `local` — the very good flaw 1 is about. A census of the shipped
file shows this is structural: **all 15 pop needs share a good with another need, so NO need's budget is
observable from the order book**, and that budget is the quantity the whole argument runs through.
⇒ **The level of a share can never identify the rule; only a PERTURBATION can.** That promotes the
pop-need weight lever from "is `weight` live?" to the only available route, and makes
**`popneed_luxury_items` the one clean venue in the game** — silk / luxury_clothes / luxury_furniture /
porcelain are each single-need with no local good, so its budget IS observable until radios exist, and
`luxury_furniture` trades from 1836. Design perturbation experiments there, not on telephones.
⚠ **§10.34 — the reopening (RETRACTED, kept for the record) (FINDINGS F33, 2026-08-05).**
F31 remains correct for what it measured: scored over seven **1836** markets the final-share reading fits
**worse in all seven** (20.0% → 24.2%), and Russian heating is 79% wood against wood's 0.5 cap, which that
reading forbids. **But F31 could not test the case that matters**: in 1836 `free_movement` and
`communication` each have exactly ONE supplied good, which is why F24 reports 0.0% error for them.
Measured in a 1903 campaign, the **shipped** reading is *arithmetically impossible* there — 948 units of
automobile pop demand would require **100 662 units** of transportation pop demand against a market whose
**entire** transportation buy orders are 19 459, a 5.2× overshoot. The final-share reading is consistent
(9 483 units, 49% of the market). So: **1836 heating refutes the final-share reading; 1903 free_movement
refutes the raw clamp.** The real rule is neither, and finding it is open work.
⚠ **There is no authored floor to appeal to**: `min_supply_share` is non-zero on **7 entries in the whole
game** (furniture, meat, fruit, silk, luxury_clothes, luxury_furniture, porcelain — all 0.1) and is **0 for
automobiles, telephones, radios and steamers**. Re-derive the 1836 half with
`tools/testbed/score_pop_split.mjs`, the 1903 half with `tools/testbed/analyse_debut_mechanism.mjs`.
⭐ **§10.35 ANSWERS IT INSTEAD, AND IT IS NOT A DEMAND MECHANISM.** In vanilla each of these goods has
**exactly one** building customer, arriving *with* the good: automobiles are bought by
`pm_public_motor_carriages` in **urban centres** (hundreds of levels per market, 1 each) on
**`combustion_engine` — the same tech that unlocks the car plant**; telephones by `pm_switch_boards` in
government administration (5/level). Our ladder moves the *factory* an era early but PM availability still
gates on the tech's **vanilla era remapped 1:1**, so the customers stay behind. Off the shipped presets:
era 3 makes 30 automobiles and 60 telephones against **zero** reachable building demand and is floored at
1 level; era 4 switches the customers on (330 / 770) and the same industries jump to 22 and 20 levels.
⚠ The deeper cause: **our eras and vanilla's are different year scales** (ours 1750/1850/1900/1925/1940,
vanilla's pre-1836 / 1836-61 / 1862-86 / 1887-1911 / 1911-36), so our era 3 sits inside vanilla's era 4 and
the 1:1 remap mis-sorts precisely the late techs. Fix built as **`tools/era_tech_sync.mjs`**
(**`ERA_TECH_SYNC=1`**, **default OFF**): one tech, one era. It **only ever LOWERS** — the naive "whenever
they differ" rule made 18 changes, 12 unforced, including pushing every dynamite PM out of era 3; the
minimum leaves the 6 that are forced.
❌ **MEASURED AND PARKED — not a win in any variant** (§10.35.2): all six → **49/36**, `combustion_engine`
alone → **41/31**, against the shipped **41/30**. The aimed-at effect is real (automotive leaves era 3's
loss-making list, era 4 goes 10 → 8) but era 3 worsens 12 → 14 and the net is a wash inside the jagged
surface. Do not ship it on the argument alone.
⚠⚠ **AND ITS PREMISE ABOUT IN-GAME TIMING IS UNVERIFIED.** A tech gate makes `pm_public_motor_carriages`
*selectable*; whether urban centres actually switch to it is an **AI decision that plausibly lags until pop
demand has already built**. The model-side half stands regardless (a PM the era gate forbids can never be
selected, so era 3 has zero *reachable* building demand), but the "in vanilla the customer arrives with the
good" reading does not. `schedules/debut_good_demand.json` is measuring the real sequence.
NOT started, and `needSplit` is a measured result, so do not replace it on reasoning alone.

⚠ **Older illogicality figures in the docs are void, not merely stale** (BALANCE_FRAMEWORK §10.14.1): the
solver used to re-solve recipes *after* its final price sync, so it reported profits at prices its own
recipes contradicted. The previous configuration scored 65/54 under corrected accounting where it had
reported 35/24. **Never report or ship from a non-finalised state** — the solve now iterates prices, PM
choice, recipes and counts to a joint fixed point and reports only what it ships.

⚠ **The third price band (§10.13) is CLOSED — built, swept over 64 combinations, and within noise.** Do not
spend more effort tuning the price path; the gradient is not there. What paid was fixing three scenario
defects (§10.14): the non-final reporting above, the **forward probe** (a level of the *next* era's tier in
every industry — an anachronism scored by nothing that supplied 61% of era-1 steel and floored every debut
good), and a **glutted by-product vetoing a starved input** in the count feedback (which shrank logging
523→124 levels while wood starved).

**⭐ POST-SOLVE SCENARIO TUNER — FREE ENTRY (§10.21).** *Not part of the solve*: when it runs, recipes, PM
selections and volumes are FINAL and must not move — it adjusts **building counts only** and re-prices, which
is why it must never call `contSettle()` (that re-solves recipes). Any era-appropriate manufacturing tier over
**+25%** is built one level at a time until it drops under the cap. **Revertable: `ERA_PROFIT_CAP=0`.** The
+75% ceiling outranks it — a step that breaches it is undone and that industry stops growing. Sanity check
printed per era: manufacturing share of output (⚠ >90%) and raw-producer profits. ⚠ Current verdict:
manufacturing fine (27→58% across eras), **raw-sector profits NOT** — medians 52–66% against targets of
+20%/+10%, 10–12 producers over +50% every era. Applying the same rule to extraction/agriculture is the
obvious next move, but it must run *together* with §10.18, not after it.

**⭐ RAW PRODUCERS HAVE A BAND, NOT A TARGET (§10.22).** Extraction **0…+400%**, agriculture **0…+200%** — the old +20%/+10% targets are GONE (a good has one price and several producers, so at most one could ever sit on a target; the rest were permanent unfixable misses). Both bounds are enforced in the SAME loop as §10.21, because growing a producer can push a sibling below zero. ⚠ A rule that cannot reach its goal must stop: if a growth step does not lower the margin (the good is pinned at the 25% floor) the producer is blocked — `tea_plantation` once ate all 400 tuner steps achieving nothing.

**⭐ HARD CONSTRAINT — NO LOSS-MAKING RAW PRODUCER MAY BE PRESENT (§10.18).** No extraction or agriculture
building in a scenario may run at a loss; the rule is on *non-zero* producers, so the remedy is not to build
it. Enforced greedily and minimally (drop the worst, re-converge, look again), **gold exempt** (one-sided
order book by construction). ⚠ **It can collide with the ceiling below, and the ceiling wins**: dropping the
era-1 iron mine left 1836 with 704 iron demand and zero iron supply, so a drop that breaches the ceiling is
undone and the building is kept and **reported by name**. ⚠ Each round must *begin* from a converged state —
checking and then settling lets the state drift back over the line after the check.

**⭐ HARD CONSTRAINT — THE INDUSTRIAL PRICE CEILING (§10.15).** No good that manufacturing can consume may
reach **+75%** (the engine's 175% band edge). −75% is fine; +75% is fine for a purely consumer good. An
input pinned at the ceiling means the market can no longer signal scarcity at all, so everything downstream
is priced against a wall. Enforced in the price path (restricted goods capped at 160), in the counts (a
breach outranks the revenue-weighted mean) and in **PM choice** (scored `profit − 100 × breaches`, so the
constraint decides and profit only breaks ties). Currently **clear in all five eras**, from 11 breaches.

**Wage share is not a free variable** (`W = base wage × Σ employees × wage_weight`, both pinned), and it
lands at 10–40% of total cost. So obsolescence is **price-driven**: what kills an old building is its
output price falling while its input prices do not. That is why the ladder works best for industries
eating **raw** inputs and weakest for those eating **manufactured** ones.

**WHICH PRODUCTION METHODS THE SOLVER MAY USE.** Vanilla gates PMs **eight** ways and we originally
modelled three, so the solver helped itself to a Japan-only rice method and to violent slave-exploitation
plantations in scenarios containing zero slaves. The rule now:
- **Technology** is the only gate the solver satisfies freely (the PM's own `unlocking_technologies`, its
  vanilla era remapped 1:1 onto ours).
- **Every other `unlocking_*` is NEVER satisfied** — no power-bloc principle or identity, no company
  category, no geographic region, no state religion.
- **Law gates are read against a deliberate two-law stance**, in the direction vanilla means them:
  `SCENARIO_LAWS = { law_slavery_banned, law_commercialized_agriculture }`. `unlocking_laws` needs one of
  ours; `disallowing_laws` blocks only if it names one of ours.

⚠ The two-law stance is **not** a softening of "assume nothing is fulfilled" — it is what makes that
instruction *coherent*. The two gate kinds point opposite ways, so treating both as unfulfilled lands
somewhere worse than either: automation switches **off** (every automation PM carries
`disallowing_laws = { law_industry_banned }`, a law an industrial country would never hold) and slave
exploitation switches **on** (25 PMGs, including every plantation labour group, have no law-neutral
member, so "hold no laws" leaves the default sitting on `slave_exploitation_*`). Two named laws a modern
country has by definition is the smallest stance that yields no serfdom, no slavery, no exotic
special cases — and working automation.

⚠ These PMs are **not** removed from the balance UI. A human can still select any of them and read the
arithmetic; the restriction is on the **solver**, which must build a scenario from what an unexceptional
country can run. Verify with **`node tools/verify_pms.mjs`**, which re-reads the game files directly
(not our extract, so an extractor bug cannot hide) and fails if any selected PM is unreal or illegal.

⚠ **Two hard invariants the solve must respect**, both learned by breaking them:
- **One price rule per good per era.** `dye` is a plantation good until synthetics exists and a
  manufactured one after; running both rules made it converge to a *blend* satisfying neither.
- **The negative-goods floor.** A tier's main input can never be solved below the largest reduction its
  own secondary PMs can apply, or the building's total input for that good goes negative. The invariant
  is hard and the profit target is soft, so the floor wins and the tier misses slightly.

Scope now: **all manufacturing + the new-economy chains + the art academy** — 22 config industries / 67 tier
buildings. The new-economy chains (infra + electricity) are `power` (electricity), `port` and `railway` —
**all three now on the BE ladder on regular terms** (commit `0cdc041` dropped `follows_be: false` from port
and railway; they are solved, targeted and scored like any other industry, and since 2026-08-05 they carry
the ×1.5 output ladder like everything else — BALANCE_FRAMEWORK §10.27). They
live in other vanilla files (`06_urban_center`, `11_private_infrastructure`) and are emitted by
**clone-and-swap** (see below); `trade_center` is deliberately left vanilla. **`art_academy`** (fine_art,
`bg_arts`, on the BE ladder) is a normal split (not clone) sourced from `06_urban_center`; its 4 tiers are the
vanilla base PMs (traditional → realist → photographic → film art). Its jobs live in its **ownership PMG**
(kept as a secondary), so its tiers carry **no base `employment`** — the builder omits the empty `level_scaled`
block, and the UI's workforce column counts every secondary PMG's active PM (base included) so the jobs still show. Break-even is
**wage-inclusive** (full break-even: output revenue = input goods + wages; `wage_pct` is the wage fraction of
**total** cost so total = goods/(1−`wage_pct`), default 25% ≡ old +33%-over-goods — a model-only accounting
layer, **not** emitted to the game; see BALANCE_FRAMEWORK §1).
**The ladder is a curve over each tier's tech unlock date (era), not a per-industry group ladder.** Each
tier's `target_be` = the era anchor for its unlocking tech's era, minus an early-game input adjustment:
- **Era anchors** (BE % of base output price), by the tech's vanilla era: **e1 115 / e2 90 / e3 65 /
  e4 40 / e5 25** (25 pp/era, so a 2-era lead sits 50 pp under → the N+2 obsolescence). There is
  **no within-era differentiation** — every tier on the same era gets the same anchor (the eras will be
  reworked later).
  **Two groups are deliberately OFF the curve** and are hand-tuned, not solver output: **tooling**
  (95 / 95 / 55 / 30 — a further −20 pp) and **power** (60 / 50 / 35). `solve_be_targets.ps1 -Write`
  would flatten both back onto the curve; re-apply them afterwards (the UI's group 🔒 protects them
  from the mass BE tools).
- **H1 manufactured-input discount: −15 pp** if the tier unlocks in **eras 1–3** *and* its recipe
  consumes a **factory-made intermediate** (tools, steel, engines, fertilizer, explosives, paper, glass,
  …). **Dye and silk do NOT count** (RGO/plantation-sourced in H1; see BALANCE_FRAMEWORK §3). Off in
  eras 4–5, where those intermediate markets have matured to ~base.

Targets are derived by **`tools/solve_be_targets.ps1`** (reads each tech's era live from vanilla, writes
per-tier `target_be` + `natural_year`); the UI shows the natural unlock year per tier and per industry.
Volumes then follow the §8 methodology (tier-1 output = vanilla output, ×1.5 per tier, inputs solved from
the full-BE goal with wages folded in).
**Shipyards are enabled and split by output good** into two output-good-consistent 2-tier chains (the
vanilla shipyard produces *clippers* then switches to *steamers* mid-ladder): `shipyard` → clippers
(Basic/Complex, e1/e2 → 125/85) and `shipyard_steam` → steamers (Metal/Arc-Welding, e3/e5 → 60/35). The
steamer chain is all-new buildings (base `building_shipyard_metal`, no vanilla anchor — the builder
appends it). Deferred: more tech tiers, transport/electricity secondary-PM tweaks, and raw-resource
extraction. (The wage layer is now folded into the ladder.)

## Repository layout

```
CLAUDE.md               this file — goals + how to work
README.md               user-facing setup (play the mod, launch the editor) — for GitHub visitors
balance-ui.cmd          one-click launcher for the balance editor (double-click; runs tools\ui.ps1)
balance-snapshot.cmd    one-click SELF-CONTAINED SNAPSHOT of the editor (runs tools\bundle_ui.mjs) →
                        balance_ui_snapshot.html at the repo root (GITIGNORED). One file, no server, no
                        network — for reading/tuning the sheet away from this machine or handing to
                        someone. It is a SNAPSHOT, not a mirror: it carries the config as of the moment it
                        was written and says so in a dated banner
BALANCE_FRAMEWORK.md    balance methodology, targets, vanilla baseline, applied changes (SOURCE OF TRUTH)
MODDING_NOTES.md        Victoria 3 engine/tooling gotchas (localization, load order, error.log, …)
TESTBED_METRICS.md      what the testbed CAN and CANNOT log — in-game-VERIFIED data-function syntax for
                        metrics (GDP, building counts, foreign-owned GDP, market imports/origins) and for
                        one-off events (bankruptcy, diplomatic plays, peace). CONSULT before adding a metric
FINDINGS.md             what the testbed has actually ESTABLISHED — measured results with their evidence,
                        confidence and limits (design lives in BALANCE_FRAMEWORK, instrument in
                        TESTBED_METRICS, this is the OUTPUT). Numbers are copied in FULL, because a finding
                        must outlive its raw data. APPEND after any measurement batch
ON_GAME_UPDATE.md       what to re-run / re-check after a Victoria 3 patch (version-sensitive touchpoints + drift log)
BUGS_AND_FIXES.md       root-cause log of non-obvious fixed bugs — NOT auto-loaded; CONSULT when investigating a new bug or after a patch
MISSING_PM_REFERENCES.md catalogue of vanilla events/JEs/effects that reference a main PM our tier split relocated (they error+return false → missed flavor). GENERATED by tools/audit_pm_refs.ps1; strategic fix deferred
MISSING_BUILDING_CONDITIONS.md catalogue of special conditional fields (e.g. a conditional ai_value block) inside vanilla buildings we replace/split that our emitted building drops. Hand-maintained; directly fixable but batch-deferred (distinct from MISSING_PM_REFERENCES, which is external refs)
config/era_prices.json      GENERATED by tools/era_solver.mjs and COMMITTED: the balance-only view — each good's price
                        per era (% of base) and the PMs a country of that era runs. Reference, not authoritative:
                        tools/era_scenarios.mjs re-solves against REALISED prices and overwrites the volumes
config/era_presets.json     GENERATED by tools/era_scenarios.mjs and COMMITTED: the five solved era scenarios
                        (buildings/pops/units/sol/prices), passed through by extract_presets.ps1 into ui/presets.js.
                        Committed because a scenario is a design input, not an artifact
config/mod_config.json      THE THING YOU EDIT — industries → tiers (tech, target_be, natural_year, output, inputs, building_cost, wage_pct?, employment, names, vanilla_pm, vanilla_pm_aliases?, state_infrastructure?, ship_construction?, ai_value?, output_override?); industry flags source_file?/clone_from_vanilla?/follows_be?/no_mass_be? (new-economy); plus top-level building_ai_value (map building_key→ai_value for PRESERVED buildings in owned files, e.g. trade center), pm_goods (map pm_key→{in:{good:qty},out:{good:qty}} — per-PM goods overrides applied to the owned PM files; any building's PM), and building_subsidies (map building_key→AI subsidy policy; see below)
config/start_exceptions.json manual 1836-start overrides (force_tier / remove, scoped by country/state) — editable
config/start_baseline.json   GENERATED inventory of the vanilla 1836 start (per-industry/tier/country + drift check)
config/presets.json          WHICH scenario presets to generate (id/label/group/country + optional market_add/market_drop, sol, measured_market) — editable. A preset carrying a **`placeholder`** block instead of `country` is **SYNTHETIC**: not derived from any country, one level of every ordinary building so each production chain is present exactly once (what BE-solving wants). See `placeholder_defaults` for the shared pops, the SoL multipliers and the exclusion lists. Note `sol.slaves` is the **slave basket level** (what buildings buy for them), not a standard of living, and `defaults.class_mult` deliberately has **no** `slaves` entry — slaves are not on the pop-consumption path at all
config/pop_distribution.json FITTED within-need consumption distribution (need → good → share), replacing the vanilla `weight` field — which is not an allocation rule (the game allocates by SUPPLY SHARE) and cost 12 pp of scenario demand accuracy. ONE market-independent distribution by design, solved across all 7 preset markets against config/measured_1836.json; re-derive with the balance UI's **fit pops** button and paste the printed JSON back. Absent ⇒ the UI falls back to `weight` per need
config/measured_1836.json    GENERATED (tools/extract_measured.ps1, from a testbed session) and COMMITTED: the things the game FILES cannot answer — per market TRADE (imports/exports per good), SoL per stratum, MILITARY building levels, urban-centre levels as a cross-check, and per market **WAGES** (`-WagesOnly`, a MERGE-only mode that rewrites just the `wages` block and leaves every other field untouched, because a wages session carries none of the other metrics and a full run over it would blank them). The wages block holds **`base_weekly_wage`** — the UI's base £/wk knob, measured, on the F26 basis: **laborers + farmers + machinists, EMPLOYED pops only** (the three professions actually paid a building's market wage; state-salaried and owner professions are excluded, and an unemployed pop would put workers in the wage-unit denominator with nothing in the numerator). Beside it: `base_weekly_labour` on the **superseded** 11-profession basis, kept only for continuity with earlier findings and **not** to be fed to a scenario; the per-profession spread; the game's own per-state average annual wage (mean/median/min/max); the workforce ratio; and a per-pop-type table. Read by extract_presets.ps1; optional (a clone without it still builds, just without those). ⚠ Regenerate after a game patch — a stale table is silently wrong, not obviously missing
tools/                  dev tooling — NOT shipped in the mod
  build.ps1             builder: config → generates all mod/ files + all-language loc + ladder_tiers.txt + 1836 start, then lints
  --- the five-era pipeline (Node ≥ 24; see "THE FIVE-ERA LADDER" above) ---
  build_era_ladder.mjs  STRUCTURE: stamps each tier's era from an explicit per-industry spec, mints the 22
                        model_only tiers, applies the ×1.5 output ladder. IDEMPOTENT (drops previously invented
                        tiers first), so run it BEFORE era_scenarios, never after — it discards their volumes
  era_tech_sync.mjs     ONE TECHNOLOGY, ONE ERA (§10.35). A tier's own unlocking tech is made available in the
                        era the ladder placed that tier, and everything else that tech unlocks moves with it —
                        which is what stops a hand-moved industry producing into an era where its only
                        building customer is still locked. **`ERA_TECH_SYNC=1`, default OFF, unmeasured.**
                        ⚠ It only ever LOWERS an era; the reverse direction is not forced and withdraws PMs
                        that are correctly available. ⚠ Deliberately NOT inside build_era_ladder.mjs despite
                        belonging there conceptually: that module runs its build at import time and keys off
                        `--write`, the same flag `era_scenarios --write` uses, so importing it from the
                        scenario solver would re-mint the invented tiers and discard its own volumes
  era_solver.mjs        BALANCE-ONLY reference view: derives a price path from profit margins alone, no scenario.
                        Writes config/era_prices.json. Superseded for volumes by era_scenarios
  era_scenarios.mjs     THE solve: prices realised from the order book, tier volumes + building counts + pops +
                        army solved together per era. Writes config/era_presets.json AND the volumes back to
                        config/mod_config.json. Ends in a JOINT FIXED POINT over prices/PMs/recipes/counts and
                        reports ONLY that final state (§10.14.1) — do not add a step after it that mutates any
                        of them. Prints, per era: profit targets, PRICE PATH realisation, the INDUSTRIAL
                        CEILING pass/fail (§10.15) and ILLOGICALITY. Env knobs, all for A/B measurement rather
                        than configuration: PRICE_START / PRICE_DECAY / PRICE_DECAY_INT / PRICE_FLOOR(_INT),
                        ERA_RATIO (=frozen restores the losing recipe-mix precedence, §10.25.2),
                        ERA_COUNT_DEADBAND / _OUT (the count controller's hysteresis band, 8→15pp; 0 = off
                        and it limit-cycles forever, §10.28), ERA_SETTLE_TRACE=1 (per-iteration residual),
                        ERA_MIN_LEVELS_MULT (scales the market-size floor; swept in §10.29 and it does NOT
                        move the floored industries — the trap is scale-invariant),
                        ERA_EXTINCT_GRACE (eras past its last tier before an `extinct` industry stops being
                        placed, default 2; -1 restores the old always-present behaviour, §10.30),
                        ERA_NO_BUYER=1 (withhold an industry whose good has no buyer of any kind — built,
                        measured, DEFAULT OFF because it does not pay for itself, §10.32),
                        ERA_CEIL_BOOST, ERA_CEIL_PM, ERA_JOINT, ERA_PROBE (the removed forward probe, kept
                        only so its damage can be re-measured — leave it off)
  econ_host.mjs         loads ui/econ.js + the generated ui/*.js under Node — supplies the state containers the
                        browser would. Contains NO model of its own.
                        ⚠ The CONFIG comes from config/mod_config.json DIRECTLY, not from the copy embedded in
                        ui/data.js: data.js is build output, so sourcing it there put a build step inside the
                        solvers' own write→read loop and made `--write` + re-run silently re-read the PREVIOUS
                        values (see BUGS_AND_FIXES). data.js still supplies prices + the vanilla extract
  econ_selftest.mjs     regression check for ui/econ.js against MEASURED numbers already in the docs (F26/F27,
                        the V3 price formula anchors, and F31's two readings of the supply-share bounds —
                        above all that a cap YIELDS when no good with supply can absorb what it displaces).
                        Run it after touching ui/econ.js
  verify_pms.mjs        audits every PM the era presets select: is it a REAL vanilla PM, and could this
                        country legally run it? Reads common/production_methods DIRECTLY rather than our
                        extract, so an extractor bug cannot hide behind it. Exits non-zero on any failure.
                        ⚠ It strips the UTF-8 BOM: every PM file starts with one, so the FIRST production
                        method in each file is invisible to a naive `^name = {` match — which made six real
                        PMs look hallucinated on this check's first run
  solve_be_targets.ps1  re-derives every tier's target_be + natural_year from its tech's vanilla era (date ladder; BALANCE_FRAMEWORK §8.1)
  solve_volumes.ps1     re-derives every tier's output/input volumes from vanilla recipes + target_be (BALANCE_FRAMEWORK §8)
  solve_building_cost.ps1 re-derives every tier's building_cost (construction points) from a 10yr-payback model (BALANCE_FRAMEWORK §9)
  extract_vanilla.ps1   dumps EVERY vanilla building/PMG/PM → ui/vanilla.js (the UI's all-buildings explorer — same editable layout as the tier cards); regenerated each build
  telemetry_lib.ps1     THE one generator of testbed telemetry script; dot-sourced by build.ps1 so the vanilla
                        control and every modded arm instrument IDENTICALLY (a control that logs differently is not a control)
  extract_icons.ps1     converts the vanilla goods icons (.dds) → ui/icons.js (base64 PNGs) for the scenario panel; regenerated each build. ui/icons.js is GITIGNORED — it is Paradox art, never committed or shipped; the UI degrades to text-only without it
  extract_measured.ps1  testbed session → config/measured_1836.json: the measured 1836 reference the
                        presets need and the game files cannot give (trade, SoL by stratum, military
                        levels, urban-centre cross-check). Run it after a game patch, pointing at a
                        run built with metrics `boot_dump`/`scenario`/`building_inventory`. Reads at
                        **1836.2.1, not day 0** — construction goods spend is exactly £0 on day 0
                        (the sector has not ticked yet), so day 0 is history-faithful but
                        economically unfinished (FINDINGS F14)
  extract_presets.ps1   derives the scenario panel's market PRESETS from the vanilla 1836 start (config/presets.json → ui/presets.js): per country market, its buildings (re-tiered) + the PMs vanilla runs, treaty goods transfers, the population split into consumption classes, and the **measured base wage** for that market (`base_wage` / `base_wage_note`; absent when the market has no per-pop measurement, in which case the UI leaves the sheet wage alone rather than substituting the per-worker state average, which is a different quantity), plus the buy-package / pop-need tables the UI needs; regenerated each build
  audit_pm_refs.ps1     scans vanilla events/JEs/effects for references to main PMs our split relocated → MISSING_PM_REFERENCES.md (diagnostic; not run by build)
  convert_history.ps1   1836 start converter: re-tiers vanilla starting factories, applies start_exceptions.json
  extract_start.ps1     baseline extractor: vanilla start → start_baseline.json (inventory + version-drift alarm)
  history_lib.ps1       shared vanilla parsing: ONE history walker (Invoke-HistoryWalk; Walk-HistoryFile = rewriting mode, Read-HistoryBlocks = read-only mode) + Get-TopBlocks / Get-ListTokens / Get-Num, used by the converter, every extractor and the volume solvers
  ui.ps1                balance-UI server: serves ui/ at localhost:8777 + POST /api/build (writes config, runs build)
  bundle_ui.mjs         inlines ui/builder.html + data.js + vanilla.js + presets.js into ONE standalone page
                        (`node tools/bundle_ui.mjs [--out <path>] [--stale-ok]`, or balance-snapshot.cmd).
                        ⚠ **ui/icons.js is deliberately EXCLUDED** — Paradox art, gitignored because the repo
                        is public, and a snapshot is something you hand to someone else; the panel already
                        degrades to text-only good names. "Build now" is disabled in the copy (it POSTs to
                        ui.ps1); **Export mod_config.json still works**, so the round trip is tune → export →
                        bring the file back. Two guards, both exit non-zero: it REFUSES to bundle when
                        ui/*.js is older than config/mod_config.json (a snapshot of the previous build's
                        numbers is the failure mode worth preventing — `--stale-ok` overrides), and it fails
                        if builder.html loads a `<script src>` not listed in its INLINE/OMIT lists, rather
                        than silently shipping a page missing a whole data set
  testbed/run_observer.ps1  the GAME driver, called BY run_schedule (a hand run is a DIAGNOSTIC, not an
                        experiment — it has no build step): launches the game headless (no launcher), plays to
                        a date, harvests, quits; owns crash-resume + the p/r/s/x keys. Telemetry always comes
                        from the mod under test — it has NO generator of its own and refuses to launch a mod
                        that carries none
  testbed/summarise.ps1 THE post-run analysis step: raw logs -> summary.json + TSVs, then optionally
                        gzips the raws (-Compress, only after the summary verifies). THREE TIERS per run:
                        summary.json (~100 KB, what meta-batch analysis reads) / TSVs (~7 MB, drill-down)
                        / logs .gz (~5 MB, archive). **The summary is a CACHE; the raw log is the record** —
                        the script re-runs over .gz archives, so a field added later is back-filled, not
                        lost. That is what makes compressing safe under the never-delete rule
  testbed/analyse_wages.sh  analysis for the `wages` metric (base wage / wage+SoL trajectory / workforce
                        ratio). Two things in it are load-bearing, not detail: it filters every line by the
                        run's OWN token from meta.json (the log ring carries other sessions' lines — one run
                        folder held 976 foreign pop lines for a 187-pop country), and it never
                        de-duplicates per-pop lines blindly — it uses each country's `WC` pop-object count
                        as the expected line count, takes a complete single source where one exists, and
                        reports the shortfall where none does
  testbed/analyse_slave_basket.ps1  analysis for the `consumption_breakdown` metric's **"purchased for slaves"**
                        line — the only readable measurement of the slave channel (FINDINGS F27). Like
                        analyse_wages it filters by each run's OWN token, and it adds a per-block INTEGRITY
                        CHECK that is load-bearing: the value line does not name its good, only its fence
                        does, and at British-market volume the log mirror puts values in the wrong block. So
                        each block's `Current total:` is verified against that good's `GetMarketBuyOrders`
                        from the run's own `G|` line (reference table built session-wide, because the
                        breakdown's volume can push a run's `G|` lines out of the ring entirely), and a block
                        holding more than one candidate is discarded rather than guessed at. Without it the
                        parse invents goods the game never reported
  testbed/score_pop_split.mjs  THE scorer for the pop-consumption model against DIRECTLY MEASURED
                        consumption (`consumption_breakdown`): monetary error per market on the F24 basis,
                        within-need misallocation, and a per-good diff. Runs the model under each
                        `S.SPLIT_MODE` in turn (`--modes raw,final`) so two readings of one rule are scored
                        on byte-identical measured data. Built for FINDINGS F31; not specific to it — any
                        later change to the pop model is re-scored the same way. It reads a session's logs
                        directly, with the same four safeguards `analyse_slave_basket` needs (own-token
                        filter, block verified against the run's `G|` buy orders, K/M/B suffixes, tail-only
                        matching), plus one of its own: a verified block with **no** pop entry is a real
                        ZERO, not a miss, or the model is never charged for demand it invents.
                        ⚠ Its `--need` and cap-violation views must see EVERY good of a need before they
                        judge — the ring truncates, and a partial denominator invents violations
  testbed/analyse_debut_goods.mjs  what a good's order book does in the months AFTER it first appears —
                        the reader for a long dense-cadence `market_goods_scoped` run
                        (`schedules/debut_good_demand.json`). Finds each (market, good) series that is ZERO
                        at the first dump and non-zero later — a good already trading in 1836 is not a
                        debut — and prints the window around it. ⚠ **Demand-side by design**: a good can be
                        invented in a country we do not watch, so it keys on the first month a market BUYS
                        it, not the first month anyone makes it, and reports the ORDER of the two. Demand
                        before local production means the market imported it, which is the case that says
                        most about where a debut good's demand comes from
  testbed/wait_for_session.ps1  the wake-up signal for a batch launched into its own window (which the
                        agent harness cannot see). Run it with run_in_background; returns DONE on
                        completion, RUNNING on a heartbeat, DEAD (exit 2) if the game vanished
  testbed/run_schedule.ps1  THE entry point for all measurement: ordered schedule JSON -> build each run via
                        build.ps1 -> run -> harvest -> cross-run markets_all.tsv. Interactive p/r/s/x control;
                        crash policy. Never call the builder directly for test data. Specs in
                        testbed/schedules/, results in testbed/sessions/ (the ONE results root)
  testbed/make_vanilla_stub.ps1  derives a "tiering only" config (structure kept, base-game recipes/costs/ai_value)
                        -> config/mod_config.vanilla_stub.json; the headless twin of the UI's Bring-to-vanilla,
                        used as the control arm when measuring what the tier split alone does
  goods_prices.tsv      THE price table — the single source for the builder, both solvers, BOTH linters and the UI
  lint.sh                profitability + negative-goods linter wrapper (runs both awks below)
  lint_profitability.awk / ladder_tiers.txt   BE-vs-ladder linter (ladder_tiers.txt is GENERATED; prices come
                        from goods_prices.tsv via `-v PRICES=`, never a copy inside the awk)
  lint_negative_goods.awk negative-goods invariant linter (no PM combination drives a good's building total < 0)
ui/                     browser balance editor — builder.html (hand-authored) + econ.js (hand-authored) + data.js +
                        vanilla.js + presets.js + icons.js (the last four GENERATED each build; icons.js is gitignored game art)
  econ.js               THE economic model, hand-authored, shared by builder.html AND the Node solvers. Also
                        the ONE implementation of **`ladderFaults()`** — the illogicality criterion (§10.11)
                        — called by both `tools/era_scenarios.mjs` and the UI's **Ladder check** panel, since
                        the rule that decides whether the ladder works cannot have two definitions. It scores
                        only buildings a scenario CONTAINS (§10.17). builder.html now loads econ.js for it. One
                        implementation of the pop-demand rules (F13/F19/F22/F24/F26/F27), the V3 price formula,
                        wages-from-workforce and the scenario order book — a second copy would drift, and these
                        are measured results, not conventions. Pure model: no DOM, no formatting.
                        ⚠ builder.html still carries its own identical copy of these ~260 lines; collapsing that
                        fork is an open task. Until then, change BOTH or neither.
mod/                    THE DEPLOYABLE MOD — GENERATED, do not hand-edit
  .metadata/metadata.json                                (hand-maintained, except the mod `name` which the builder suffixes with the build time; has replace_paths for history)
  common/buildings/{01_industry,06_urban_center,11_private_infrastructure}.txt   (generated: WHOLE-FILE replacements of vanilla — 06/11 own the new-economy chains — see MODDING_NOTES)
  common/ai_strategies/01_admin_strategies.txt            (generated: WHOLE-FILE replacement of vanilla — rewrites the `subsidies` block of all 7 administrative strategies from `building_subsidies`; see AI subsidy policy)
  common/{production_methods,production_method_groups}/zzz_pm_rehaul_*.txt   (generated, additive)
  common/production_methods/<vanilla name>.txt           (generated: WHOLE-FILE replacement, but ONLY for the vanilla PM files we actually CHANGE — secondary-PM gate remap + per-PM `pm_goods` overrides. A file we would copy verbatim is NOT emitted: owning it would freeze that vanilla file against the next patch and ship bytes we didn't author, for nothing. Today that means `01_industry.txt` alone. See below)
  common/history/buildings/*.txt                         (generated: the re-tiered 1836 start; replaces vanilla via replace_paths)
  common/on_actions/zzz_pm_rehaul_diag.txt               (generated: self-diagnostic tripwire; logs PM_TECH_REHAUL init marker to debug.log at game start — see MODDING_NOTES → Self-diagnostics)
  events/zzz_v3tb_probe.txt                              (generated, TESTBED ONLY — the only events/ file the builder ever emits, and only when a telemetry metric asks. Exists because `on_monthly_pulse` is the finest pulse vanilla has: a reading BETWEEN month boundaries is unreachable from an on_action, so a scheduled `trigger_event = { days = N }` is the only route. Never present in a normal build)
  localization/<lang>/replace/zzz_pm_rehaul_l_<lang>.yml (generated for all 11 languages; replace/ so name overrides win)
```

Only `mod/` is the game mod; the whole repo (docs + tools + config + `mod/`) goes on GitHub.
The deployed mod is a real copy of `mod/` only (see Deployment below), so docs/tools never reach
the game.

## Working conventions

- **Keep the docs in sync with reality — always, in the same pass as the change.** Any change
  that affects behavior, file structure, conventions, scope, or numbers must be reflected in the
  relevant `.md` (`CLAUDE.md`, `BALANCE_FRAMEWORK.md`, `MODDING_NOTES.md`, `ON_GAME_UPDATE.md`,
  `README.md`) right then. In particular, any new coupling to a vanilla file/number goes in
  `ON_GAME_UPDATE.md`.
  Never leave a doc describing something that is no longer true, and never leave a doc update
  "hanging" for later. **One narrow exception:** when a change is a *proposed* solution the user is
  still weighing and its outcome is genuinely uncertain, the doc update may be briefly deferred —
  but call out the divergence explicitly and reconcile it the moment it settles (bring the docs to
  the facts, or the facts to the docs). Resolve such gaps as soon as possible, not eventually.
- **Edit the config, not the generated files.** The mod content lives in
  `config/mod_config.json`. To change balance or add/split buildings, edit that, then run the
  builder:
  ```
  powershell -ExecutionPolicy Bypass -File tools\build.ps1
  ```
  It regenerates every `mod/common/*` and `mod/localization/*` file, regenerates
  `tools/ladder_tiers.txt`, **converts the 1836 start** (re-tiers vanilla starting factories into
  `mod/common/history/buildings/` via `convert_history.ps1`), and then runs the linter — which
  must print **LINT PASSED** (BE-vs-ladder) and **NEGATIVE-GOODS CHECK PASSED** (invariant: no
  reachable PM combination drives any good's building-level total input/output below zero — see
  Working conventions), then **MOD CHECKS PASSED** (post-build sanity on the finished mod: required files
  exist + non-empty, one loc file per language, and the **1836 start** — one history file per vanilla
  history file, none empty, `create_building` blocks actually present, because `replace_paths` makes our
  copy the *only* history the engine reads, so an empty conversion would silently delete every starting
  factory in the game. The hook for future mandatory checks lives in `Invoke-ModChecks` in `build.ps1`;
  note it *throws*, whereas a red linter today only prints). Never hand-edit files under `mod/common` or
  `mod/localization`; they are overwritten on every build. To build from a **different config
  file** (e.g. an alternate balance set exported from the UI) without touching
  `config/mod_config.json`, pass `-Config <path>` — `build.ps1` threads it through the start
  extractor and history converter too, so the whole build uses that file. Default is
  `config/mod_config.json`. Other flags: `-NoLint`, `-NoDeploy`.
- **Build somewhere other than `mod/` (for tests / alternates).** By default the build writes the
  canonical `mod/` and deploys it. Two flags redirect the output and **never touch `mod/`** (nor
  `tools/ladder_tiers.txt`, `ui/data.js`, or `config/start_baseline.json` — alt builds only ever
  write their own folder):
    - `-DryRun` — build a full, real mod into a throwaway `mod_dryrun_<pid>/`, run the linter +
      `Invoke-ModChecks` on it, report, then **delete** the folder. Never deploys. Use this to
      verify a config/build safely (**prefer it for test builds** so a build never silently
      rewrites `mod/`).
    - `-SaveTo <name>` — build into `mod_<name>/` inside the repo and **keep** it (not deployed,
      not deleted; clean up manually). For alternate balance sets you want to compare/keep.
  `-DryRun` and `-SaveTo` are mutually exclusive.
- **The 1836 start is converted, not hand-authored.** `convert_history.ps1` reads vanilla
  `common/history/buildings/*.txt` and maps each split-industry factory (base building + active
  main PM) onto the correct tier building, keeping ownership + secondary PMs. metadata.json's
  `replace_paths` makes the mod's copy replace vanilla's, so **rebuild after any game update** to
  pick up new vanilla history. Uses the `vanilla_pm` field per tier in the config.
- **Manual start overrides** live in `config/start_exceptions.json`: rules targeting a vanilla base
  building, optionally scoped to a `country` (region_state tag) and/or `state`, with action
  `force_tier` (set tier N regardless of vanilla PM) or `remove` (delete the factory). Most
  specific scope wins. Default is an empty `rules` list (pure mechanical conversion). To author
  rules, browse `config/start_baseline.json` (regenerated each build by `extract_start.ps1`) to see
  which countries/states have which factories. That baseline's `unmapped` list is also the
  **version-drift alarm**: if a game update renames/adds main PMs, unmapped factories appear there,
  telling you to refresh the config's `vanilla_pm` fields.
- **Config holds ACTUAL volumes.** `inputs` and `output_qty` are the real per-throughput numbers
  the game uses; the builder emits them directly. `target_be` is the design goal (informational) and
  now means **full** break-even (output revenue = input goods + wages). The linter re-checks each
  building's actual full break-even (building-level: main PM + the base PM of every other PMG, plus
  wages = `wage_pct`·inputs) against its configured `target_be` (±6pp). This per-target check supports
  the date-based ladder (era anchors 125/100/75/50/35 with the H1 −15 pp input adjustment; targets set by
  `solve_be_targets.ps1`). `tools/ladder_tiers.txt` carries `pm tier target_be wage_pct`.
- **Negative-goods invariant (second linter).** `tools/lint_negative_goods.awk` (run by `lint.sh` after
  the BE check) enforces that **no reachable combination of PMs drives any good's building-level total
  input or output below zero** — across **EVERY building** (vanilla + mod). Reduction PMs legitimately emit
  negative `goods_output_*_add` (e.g. the aeroplane/tank lines subtract from a car plant's automobiles
  output; luxury/ceramics/rayon PMs subtract from the base good); the design guarantees the active main
  output covers the maximum reduction. Because the balance UI lets any PM's goods be edited via `pm_goods`
  (**negatives allowed**, for those reduction outputs), this check catches an edit — or a tier-volume choice
  — that would let a player-selectable combination go negative. Method: **brute-force** the Cartesian
  product of each building's PMGs (one active PM per PMG — counts are tiny), keep only **legal**
  combinations, sum every good, and flag any total `< 0`. **Gating is respected** — a combination is legal
  only if every chosen PM's `unlocking_production_methods` gate is satisfied by another chosen PM in that
  same combination, so a gated secondary (e.g. `pm_elastics`, unlocked only by the sewing/electric main PMs)
  is never counted against a main PM that can't run it, and a vanilla base PMG's low-tier main PM isn't
  blamed for a reduction it can't reach. Only "risky" goods (those with a negative contribution in some PM)
  are checked, so buildings without reductions are skipped outright. **PM names are not all `pm_`-prefixed**
  (plantations/farms use `default_`/`automatic_`/`worker_`/… ), so every top-level block in a
  production_methods file is a PM and every token in a `production_methods`/`unlocking_production_methods`
  list is a PM reference. The check reads all vanilla PMGs, the mod's **owned** production-methods files (so
  `pm_goods` overrides are seen), and all buildings (vanilla + mod, mod overriding).
- **BE targets are derived from tech unlock date.** `tools/solve_be_targets.ps1` reads each tier's
  unlocking tech's **era** live from vanilla `common/technology/technologies/*.txt` and writes per-tier
  `target_be` (era anchor − H1 input discount, above) and `natural_year` (the era's representative year,
  shown in the UI). Run it **before** `solve_volumes.ps1` when eras/anchors change or after a game patch:
  `solve_be_targets.ps1` → `solve_volumes.ps1` → `solve_building_cost.ps1` → `build.ps1`. It is a
  design-target solver, not run by `build.ps1`.
- **Volumes are derived, not hand-tuned.** `output_qty`/`inputs` come from `tools/solve_volumes.ps1`
  (BALANCE_FRAMEWORK §8): tier-1 output = the vanilla tier-1 PM's output, higher tiers ×`output_mult`
  (default 1.5) per tier, inputs solved from `target_be` (with wages folded in: `I = target_be/100 ·
  O / (1+wage_pct)`) keeping vanilla input ratios. It re-reads the
  **current** vanilla recipes (via each tier's `vanilla_pm`), so after changing a `target_be`/`output_mult`
  or after a game update: run `solve_volumes.ps1`, then `build.ps1`. (The UI edits volumes directly;
  the solver regenerates them from the methodology.) All three solvers take **`-Config <path>`** (default:
  the repo-absolute `config/mod_config.json`), so the whole pipeline can be run against an alternate
  balance set without touching the canonical config — and none of them can silently miss because they
  were launched from another working directory.
- **Building cost is derived too.** Each tier's `building_cost` (construction points) is emitted as the
  building's `required_construction` (a per-tier number now — it replaces vanilla's flat
  `construction_cost_high`/`_very_high` script-values; the building-level `required_construction` in the
  config remains only as a fallback for tiers without `building_cost`). Values come from
  `tools/solve_building_cost.ps1` — a 10-year-payback model (BALANCE_FRAMEWORK §9): `building_cost =
  10yr × 52wk × (20% net return on total operating cost) ÷ £720-per-construction-point`, where £720 is
  read live from the construction sector's iron PM at 0 efficiency bonus. Re-solve after changing volumes
  or a game patch: `solve_volumes.ps1` → `solve_building_cost.ps1` → `build.ps1`. The model's knobs
  (margin %, payback years, weeks/yr) are solver parameters; **wages** use the shared `wage_pct` (fraction of
  total, default 0.25, per-tier `wage_pct` override — the same knob the volume solver, linter, and UI use; §1). The UI
  preserves `building_cost` through export/Build-now (it deep-clones the config), but does not itself edit it.
- **Toggle a whole industry** with an industry-level `disabled: true` in the config — the builder,
  history converter, and UI all skip it, leaving that vanilla building untouched (the mechanism that
  formerly kept shipyards vanilla; no industry is disabled now). Building-level flags: `heavy_industry_law` (emits the industry-ban /
  extraction-economy `possible` block), `coastal_only` (emits `potential = { is_coastal = yes }`),
  and a per-tier `output_good` override (e.g. clippers→steamers). `mod_config.json` is stored
  **minified**; edit it via the balance UI, or with JSON-aware tooling (add industries by merging
  with PowerShell `ConvertTo-Json -Compress`), not by hand.
- **New-economy industries (clone-and-swap) — power / port / railway.** These vanilla buildings carry
  engine-critical fields our simple schema can't model (`port = yes`, `terrain_manipulator`, big
  `ai_value`/`should_auto_expand` blocks, `potential`). So an industry with **`clone_from_vanilla: true`**
  is emitted by *copying its vanilla building block* and surgically swapping only key / tech / PMGs /
  (construction) — everything else verbatim (`New-ClonedBuilding` in build.ps1). It also needs
  **`source_file`** (the vanilla `common/buildings/*.txt` we whole-file-own for it — `06_urban_center` for
  power, `11_private_infrastructure` for port/railway; the builder now owns **01 + 06 + 11**). Two more
  industry flags: **`follows_be: false`** (stay on vanilla volumes: the volume / BE-target / building-cost
  solvers skip them, the linter ladder skips them, the building name omits the BE target — **no industry
  carries it today**; port and railway lost it in `0cdc041` and are on the ladder like everything else) and
  **`no_mass_be: true`** (all three — excluded from the linter ladder and, in the UI, locked-by-default so
  the mass BE tools + preset never touch them). Per-tier **`state_infrastructure`** is emitted as a
  workforce-scaled `state_infrastructure_add` (ports/railways produce infrastructure). Power is on the BE
  ladder normally (electricity output; `output_override` keeps its vanilla per-tier electricity). Their PMs
  are our own copies (editable), so `solve_volumes` reads **every** `common/production_methods` file, not
  just `01_industry`. `trade_center` stays vanilla (no tiers). `1836` ports/railways are re-tiered by
  `convert_history` like any split industry.
- **AI subsidy policy (`building_subsidies` → `common/ai_strategies/01_admin_strategies.txt`).** The `subsidies`
  block inside an ai_strategy is the AI's subsidy **decision rule** (`must_have` / `wants_to_have` / `nice_to_have`
  — the only three values vanilla uses). It is the **only durable** way to make the AI subsidize a building: the AI
  re-scores subsidies continuously (defines `NAI` `SUBSIDIZE_*`), so a scripted `set_subsidized` effect is simply
  undone on its next pass — do NOT try to force subsidies from an on_action.
  The builder **whole-file-replaces `01_admin_strategies.txt`**, rewriting the `subsidies` block of each of its **7
  administrative** strategies. We own that (~655-line) file rather than `ai_strategy_default`, which is a single
  ~8790-line block — a 13× smaller patch surface. Coverage is still universal because every AI country always runs
  exactly one administrative strategy (`ai_strategy_industrial_expansion` has **no `possible` gate**, so it is always
  available). Each rewritten block = that strategy's own vanilla entries + our overrides — **plus**, *only* if the
  strategy had **no `subsidies` block at all** in vanilla, `ai_strategy_default`'s subsidies restated (read **live**
  from `00_default_strategy.txt` each build — that file is read, never owned, so it can never go stale).
  **The conditional matters.** Whether a typed strategy's `subsidies` merges with the default's per key or replaces
  it wholesale is **not conclusively settled** (an in-game probe — since removed — leaned toward *merge* but on
  late-game data only; see ON_GAME_UPDATE.md drift log 2026-07-23). The rule below is written to be **correct under
  both readings**, so this never needs resolving for the mod to be right — it only matters for the two loose ends
  noted after it. The two cases differ:
    - A strategy that **already has** a block is **authoritative** — under *replace* whatever it omits was omitted
      deliberately (real vanilla fine-tuning, e.g. `industrial_expansion` subsidizing only its four mines), and
      under *merge* the default supplies the rest anyway. Restating there would **invent subsidies vanilla never
      granted**, so we don't.
    - A strategy with **no** block only becomes replace-exposed *because we add one*, so there we restate to keep
      vanilla behaviour intact.
  That rule is correct under both readings and never overwrites a strategy-specific value (e.g. `tooling_workshop`
  stays `nice_to_have` in `resource_expansion` and `wants_to_have` in `colonial_extraction`). Config values: `vanilla` (or absent) emits nothing;
  `none` drops the key from every block we write. ⚠ `none` can only reliably suppress entries living in files we
  own — the trio is also set by `ai_strategy_default`, so suppressing those is semantics-dependent (the UI warns).
  **Note this does NOT bypass the trade-center GDP gate** (`NAI` `TRADE_CENTER_MINIMUM_GDP_*`), a hard eligibility
  filter on which states the AI will even consider; subsidy only re-weights states that already cleared it.
- **Secondary-PM gates (`unlocking_production_methods`).** A few vanilla secondary PMs are gated behind a
  main PM: `pm_bone_china` (glass porcelain), `pm_elastics` (textile luxury), `pm_precision_tools`
  (furniture luxury) each have `unlocking_production_methods = { <vanilla main PM> }` — only available when
  that main PM is present in the building. Splitting each main PM into its own renamed building broke the
  gate (the secondary silently locked). Fix: the builder **whole-file-replaces `common/production_methods/01_industry.txt`**
  and, for every `unlocking_production_methods` list, **appends our tier `pm_key`** for each split
  vanilla main PM it references (map: `vanilla_pm`→`pm_key`). The secondary then unlocks at exactly the
  tiers whose main PM satisfied it in vanilla (e.g. bone china at glass T3/T4). Everything else in the file
  is copied verbatim; the linter reads vanilla's copy + our `zzz`, so it's untouched. New gated secondaries
  a patch adds are picked up automatically on rebuild.
- **Balance UI (for Claude-less iteration):** one-click **`balance-ui.cmd`** (or
  `powershell -ExecutionPolicy Bypass -File tools\ui.ps1`) opens a browser editor (`ui/builder.html`)
  showing every building × tier with editable **main-PM** input/output volumes. **Wages now stem from the
  building's WORKFORCE**, not a fraction of goods: a **base-wage row** — inside the scenario panel, directly
  under the Population row and above every building, because the wage is a property of the market being
  modelled and it prices the buildings below it — sets one
  global **base wage** in two linked terms — **£/week ↔ £/year** (yearly = ×52; V3 is inconsistent about which
  it shows) — and lists each profession's weekly wage = `base × wage_weight` (the vanilla `common/pop_types`
  weights: laborers 1, machinists/clerks/soldiers 1.5, farmers 2, shopkeepers/engineers/clergymen 3,
  bureaucrats/academics 4, officers/aristocrats/capitalists 5, peasants 0.2, slaves 0; everyone
  non-discriminated). A building's **wage units** = `Σ (employees × wage_weight)` and its wage `W = base × units`.
  **The base wage is now MEASURED, not guessed.** It was a flat `0.04` £/wk; on the canonical F26 basis
  (`base_weekly_wage` — laborers + farmers + machinists, EMPLOYED pops only) vanilla 1836 reads **0.0606
  for the Austrian market and 0.0781 for the Belgian**, so the guess was ~34% low for Austria and ~49% low
  for an industrial market. (The superseded 11-profession basis, `base_weekly_labour`, read 0.0490 / 0.0741
  — kept in `measured_1836.json` only for continuity with earlier findings, never fed to a scenario.)
  A **preset carries its market's `base_wage`** (from `config/measured_1836.json` → `ui/presets.js`) and
  applies it through `recomputeWages()`, so it obeys the same rule as typing in the panel: unlocked
  groups inherit, **locked groups keep the wage they were tuned at**. A preset with no measured wage
  leaves the sheet's wage alone rather than resetting it, and says so in the banner.
  ⚠ The stored figure is the **LABOUR** base. Capitalists (£59.66/yr) and aristocrats (£7.55) draw
  dividends and rent through the same income field as a labourer's £3.79 wage, and folding them in
  inflates Belgium's base from £3.85 to £4.55/yr with money no building ever pays; peasants are excluded
  because subsistence is not a market wage. Across the eleven working professions the implied base agrees
  to within ±13% (Belgium cv 0.081) — the game confirming the `base × wage_weight` model the sheet already
  assumed. Austria's cv is 0.189, it being five countries sharing one market, so a single base describes
  some markets better than others. See TESTBED_METRICS §5 and FINDINGS.
  Every building keeps its **own base wage**, so the wages row (bottom of the Input cell) has **three
  mutually-dependent editable fields**: **base £/wk** ⇄ **total £** ⇄ **% of total cost**. Edit any one and the
  other two follow (`W = base·units`; `base = W/units`; `% → W = p/(1−p)·goods → base`). Two rules make this
  behave: (1) a **PM change** that alters the labour mix **preserves the base wage** and recomputes the other two
  (base is the stored value, the rest derive); (2) changing the **sheet-level** base wage is **inherited by every
  building in a NON-LOCKED group**, while **locked groups keep their current wage** (pinned to the old sheet value
  if they were only following it) — so locks protect a tuned group from the global knob. A labour-only building
  (gov administration) is 100% wages (that field is fixed/disabled — nothing to trade off against) and now has a
  real £ from its bureaucrats; a building with no workforce shows `—`. Wages remain a **model-only** term (dashed
  "modelling only · not emitted" fence) — **never emitted** to the game (V3 pays wages from employment). Per-building
  base wages are **session-only** (like PM selections), not saved to the config.
  **NOTE (transitional):** only the **UI** uses workforce wages so far; the solvers/linter/builder still use the
  legacy per-tier `wage_pct` (fraction of total, §1). Because the legacy wage scales with *input cost* (~I/3)
  while the workforce wage scales with *employment* (flat, and much smaller), the config's stored volumes read
  **~10–20 pp UNDER `target_be`** when loaded into the UI (worst on input-heavy tiers). So **on load the UI
  re-solves every unlocked ladder group to its `target_be` at the current standard wage, and lets `building_cost`
  follow** (`reconcileToWageModel`, bottom of `builder.html`) — the sheet therefore opens *on target*. This is a
  UI-side reconcile: it does not touch the config until you **Export** / **Build now**. ⚠️ **Pipeline conflict:**
  exporting now writes workforce-wage volumes (inputs ~+15%), which a later `solve_volumes.ps1` run would
  overwrite back to legacy — so until the pipeline is switched over, don't re-run the volume solver on a config
  exported from the UI. (`building_cost` is nearly unchanged by the reconcile: total operating cost `I + W` is
  pinned to `target × O` under either wage model, so the payback model lands in the same place.)
  **Mass BE tools** (toolbar, whole sheet, skipping **locked** *and* `follows_be:false` groups): **`solve →
  targets`** re-solves every unlocked tier's INPUT volumes (recipe proportions kept, **output untouched** per §8;
  an active secondary PM's inputs are held fixed and netted off the goal first) so its full BE hits its Target at
  the **current** standard wage — **build cost deliberately does not follow** (the payback tools own that); and
  **`targets −10pp` / `targets +10pp`** shift every unlocked tier's `target_be` by 10 pp (floored at
  `BE_MIN` = 5) **without** re-solving, so you can stack shifts or change the wage and then re-solve once.
  Each tier's **secondary-PM selectors** sit under the
  building name (Building column); switching one distributes that PM's effects across the columns: its input goods
  appear as extra rows in the **Input** column, its output goods (including negative *reductions* of the main good,
  e.g. tank production −20 automobiles) as extra rows in the **Output** column, and its employment folds into
  **Workforce**. The secondary **goods rows are editable** (marked with a `↳`), wired to the shared `pm_goods`
  override — so editing one changes that PM's recipe everywhere it's used (negatives allowed, for reduction
  outputs). Contributions are **not summed** with the main good — each active secondary is its own row (you see
  `automobiles 30` and `↳ automobiles −20` side by side, both editable but independent). **Non-goods outputs**
  (infrastructure / ship construction / pollution from the config, plus modifiers from active secondaries) are
  listed at the bottom of the Output cell **read-only**, **merged by kind into a total** (base pollution + an
  automation PM's pollution ⇒ one `pollution +25`). A **Workforce** column shows each tier's employment (total + per-profession),
  **tracking the selected PMs** (e.g. automation's −1500 laborers) — **viz-only**: not editable, not saved, not a
  new emit path (the builder already emits base `employment`; the UI carries it through and adds **every** secondary
  PMG's active PM employment — *including its base/default PM*, since each PMG always has one active PM in-game.
  Usually the base is inert, but some carry the jobs, e.g. the art academy's ownership PMG employs academics/
  clerks/laborers even at its default). Reference-explorer buildings get the same read-only workforce line. Live
  **full** break-even + per-good-threshold **full
  profitability** ((output − inputs − wages)/(inputs + wages), shown as **% and weekly £**). Each Input/Output
  cell ends in a **subtotal** — `total in` (input goods **+ wages**) and `total out` (priced goods only; the
  non-goods block below it has no £) — so a row reads as one equation: *in − out ⇒ profit*.
  **EVERY £ IN A BUILDING ROW IS AT THE CURRENT SCENARIO PRICES, INCLUDING THROUGHPUT** — each goods row and both
  subtotals (`mval()`), so `total out − total in` equals the Profit column **exactly**, always. Wages are the one
  term throughput does NOT scale (it moves goods, not the workforce — which is precisely why it lifts the margin).
  ⚠ These used to be at **base** prices with no throughput, which agrees with the Profit column only at 100% prices
  and no bonus. Once era presets began unlocking prices and setting throughput, the subtotals and the profit
  disagreed on screen by default with nothing to explain the gap (a furniture tier showed in £2691 / out £2850
  beside a profit of £2141). Do not reintroduce a base-price subtotal without a second, clearly-labelled row.
  **Scenario panel + market prices (session-only).** Every building row has a **Number** column (count of that
  building in a hypothetical market; default 0, keyed by building key for tiers *and* reference buildings). The
  **Scenario panel** (which **replaced the old price panel** — it now owns pricing) is **styled after the in-game
  market screen**: a **goods pictogram** + name/base price, then a two-row grouped header —
  **Buy orders** (buildings | pops | trade) · **Sell orders** (buildings | trade) · **Balance** · **Price** — with
  thin proportional bars under Balance and Price. Buy = each building's active-PM **inputs** × its Number, Sell =
  its **outputs** × Number (secondary reductions net out); **pops** is the derived population demand *plus* the
  baskets buildings buy for their slaves (read-only, and the hover splits the two — see the preset section
  below); **trade**
  (default 0) is everything else — treaty transfers a preset fills
  in, or anything you dial in by hand. Pops never sell, so the sell side keeps a single **trade** column.
  **Colour** (gold `#d9a441` / blue `#5c9ede`): **gold = abundance** (sell > buy) **and below-base price**,
  **blue = deficit and above-base price** — surplus and a low price always co-occur, so a row reads as one market
  state. ⚠ The game itself appears to colour by **sign** (a *high* price is gold there); we colour by meaning —
  flip `scenPriceCls()` to mirror vanilla exactly. **Pictograms** come from `ui/icons.js` (generated,
  gitignored); the UI can never read game files itself, so a fresh clone that has not been built shows clean
  **text-only** rows, and a good with no icon gets a dashed placeholder so names stay aligned. Assumptions (per design): full employment, no market-access/throughput
  effects — a building contributes exactly its listed in/out × Number. The good-group **sections are individually
  foldable** (click the section header; `SCENFOLD` set). The **price column header carries the two price controls**
  (replacing the removed panel's lock toggle + reset button), wired by **event delegation** since the panel
  re-renders: a **`locked` checkbox** (default **ON**) and a **`100%` button**. **Locked** = prices are manual —
  each price cell is an editable **% of base** (the old price-panel behaviour, now inline); the `100%` button
  (enabled only when locked) resets every good to 100%. **Auto** (unchecked) = prices are computed live from the
  orders via the **actual V3 formula** `price = base × [1 + 0.75·clamp((BUY−SELL)/min(BUY,SELL), ±1)]` (25–175%
  band; vic3.paradoxwikis.com/Market) and the cells go read-only. Either way the value lives in the existing
  **`thresholds`** map (the formula output *is* a "% of base"), so it **propagates to every building's
  Profit@prices** (tier cells + reference rows) with no other plumbing — `refreshScenPrices()` (called from
  `updateComputed`) keeps the price column in sync after any change, including the `%→X` payback tools. Hovering an
  industry flags its goods on their **scenario rows** (the highlight moved off the removed panel). All of this —
  `BLDNUM`/`ADDBUY`/`ADDSELL`/`SCENFOLD`/lock state — is **session-only** (never saved to config or emitted), like
  PM selections.
  **Scenario presets (the preset bar).** A wrapping button strip at the top of the scenario panel (sized to hold a
  couple of dozen entries, grouped by the preset's `group`). Clicking one **completely overwrites** the scenario:
  every building **Number**, the **non-pop** buy + sell orders, the **population**, the per-stratum **SoL**, the
  **base wage**, *and* the
  **PM selections** (both our tiers' secondaries and the explorer's `REFSEL`, reset to defaults first, then set to
  what vanilla actually runs there). Always present: a built-in **Empty** preset that zeroes everything — it works
  even without `ui/presets.js`.
  **PLACEHOLDER presets (`ph_sol10/12/14/18/20`)** are synthetic — no country, no trade, no army, base
  PMs throughout, and **one level of every ordinary building** so every chain appears exactly once.
  Excluded: `unique` buildings and the monument/canal groups (one-off wonders), the military groups
  (no army), and **company headquarters** (they exist only once a company is formed). Manor houses and
  financial districts stay — ordinary ownership buildings that employ the upper stratum and carry no
  market goods. **Urban centres and subsistence are still DERIVED, not placed at 1**: subsistence from
  the peasants (`peasants × 0.25 ÷ 5000` staffed levels) and urban centres by the F13 rule
  (`floor(Σ urbanization / 100)`) — 50 and 6 levels at the current pop counts. Pops are 1 M lower /
  1 M peasants / 100 k middle / 10 k upper / 0 slaves; within-stratum variation is the UI's own
  `SOL_SPREAD`, not something the preset carries. SoL is **lower = the scenario's number, middle ×1.5,
  upper ×3**, and the **base wage comes from FINDINGS F26** (`exp((SoL−37.43)/10.49)`), so these are
  the first presets whose wage is derived rather than measured. Deliberately uniform and crude — meant
  to be diversified.
  **PRINCIPLE — a preset is a one-off overwrite, not a mode you sit in.** The instant you touch a field the
  scenario is your own, so **nothing in the panel may claim you are "in" a preset**: no active-button highlight, no
  standing description of the market / subsistence / lock state. Everything a preset knows about itself —
  market members, building types + levels, the pop split, the subsistence staffing sum, treaty transfers,
  the price-lock state, the measured base wage, the derived urban-centre count — is reported **once, in the
  banner**, by `presetReportHTML()` when it is applied. The bar itself holds only live
  controls. Keep it that way when adding preset features. The rest come from **`ui/presets.js`**, generated by `tools/extract_presets.ps1` from the live
  vanilla 1836 start (so they refresh on a game patch), and **which** presets exist is `config/presets.json`
  (id/label/group/country, optional `market_add`/`market_drop` and `sol`). Derivation, per spec:
  a preset is a country's **whole market** — the lead country plus every subject that shares its market (all
  subject types share the overlord's by default; `grant_own_market` is the exception, resolved transitively, e.g.
  GBR → BIC → its Indian puppets); its **buildings** are every `create_building` in `common/history/buildings`
  owned by a member, counted in **levels** and mapped onto **our tier building** via the active vanilla main PM;
  **PRINCIPLE — diverge from the history files only where they cannot answer.** Everything the history files
  contain is taken from them; measurement (`config/measured_1836.json`) covers exactly four things they do
  not hold: what a market **trades**, each stratum's **standard of living**, the pop class **split**, and
  which **production methods urban centres run**. Two things that *looked* like they needed measuring did
  not — **military battalions** are in `common/history/military_formations` (goods from each combat unit
  type's `upkeep_modifier`, *not* from barracks or logistics centres, whose PMs carry no goods at all), and
  **urban-centre levels** are derivable (F13). When adding a scenario input, check history first.
  **Pop class split: SIZE from history, SHARES measured.** History cannot give the split — only 690 of
  4 454 `create_pop` blocks name a `pop_type`, the engine assigning the rest from available jobs at init.
  Deriving it from building jobs (as this used to) inverted the dependency, so the pop side inherited every
  building-side error; the worst was **manor houses**, inferred from `add_ownership` at a **tenth** of the
  real count. They carry no goods, so it was invisible in market orders while flowing straight into the
  **upper** class, which buys the most per head. Britain's upper class was 268 707 and is 967 616.
  **no trade-route trade** is assumed, only `goods_transfer` treaty articles in force in 1836 (a transfer **out**
  of the market is an extra **buy** order, a transfer **in** an extra **sell** order).
  **Each pop need's money is split across ALL its goods by the game's DOCUMENTED rule** (`needSplit()`;
  vic3.paradoxwikis.com/Needs): `market share = (sell orders − 0.5 × NON-POP buy orders) / Σ over the
  need's goods`; `purchase weight = weight × market share`, clamped to the entry's
  `min_supply_share`/`max_supply_share`; `units = (need money / base price) × purchase weight / Σ`.
  Every good the need lists is a candidate — an unsupplied one scores zero and drops out by itself,
  which is why there is no separate availability gate. The **slave basket** goes through the same
  split, fed the same supply and non-pop order book in the same pass.
  ✅ **The weights are VERIFIED correct against the game files** (2026-08-04): all **52 entries across 15
  needs** match `common/pop_needs/00_pop_needs.txt` exactly — every `weight`, `max_supply_share`,
  `min_supply_share` and `default` — and **29 of the 52 carry a non-default weight**, so this was a real
  thing to get wrong. Re-check after a patch. ⚠ But the art-academy story built on top of it was wrong:
  `fine_art`'s budget is **not** fixed (it grows from 2% to 84% of the leisure need as academies are added);
  the binding constraint is that fine_art costs **£200**, so even 84% of that budget buys 96 units while one
  academy level makes 14.4. See BALANCE_FRAMEWORK §10.19 — the lever is academy OUTPUT, not the demand model.
  ⚠ The **−0.5 × non-pop buy orders** term is the one that matters most and is the least guessable —
  a good industry consumes heavily is correspondingly less available to pops, and omitting it over-fed
  grain by half (same-run Belgian test: pop demand error 30.3 % → **16.2 %**, F22).
  ⚠ The bounds **clamp**. The wiki says market share "has no effect" outside them, which reads as
  reverting to bare `weight`, and that is measurably wrong: liquor is ~95 % of Belgium's intoxicants
  supply and the reverting reading predicts 102 against 201 observed, where clamping gives 199.
  ✅ **WHAT the bounds clamp is SETTLED — the RAW supply share, not the final share of the need**
  (FINDINGS F31, BALANCE_FRAMEWORK §10.34, 2026-08-05). The rival reading — cap each good's final share and
  hand the excess to the goods still unclamped — was built, and scored against the game's own consumption
  telemetry it is worse in **all seven** 1836 markets: **20.0 % → 24.2 %** mean error. It survives only as
  the A/B switch **`S.SPLIT_MODE = 'final'`** (default `'raw'`), re-scorable with
  **`tools/testbed/score_pop_split.mjs`**. ⚠ It also **refutes the mechanism it was wanted for**: the point
  was to hand a debut good a guaranteed slice of its need, and 1836 holds that exact case — Russian heating
  caps wood at 0.5 with scarce oil beside it, and the reading gives oil ~17 % of the budget where the game
  gives it **0.8 %**. Whatever produces a new good's demand spike in game, it is not this. Do not re-run
  this experiment; do not adopt the final-share reading for what it would do to the illogicality score.
  Goods are equivalent **per pound, not per unit** — a higher base price fulfils the same need with
  fewer units, which is why units come from money ÷ base price. **No fitted
  numbers, and nothing stored per scenario.** It is not circular and not a time series: pops never
  sell, so supply does not depend on pop demand, and the split is one pass over the scenario's own
  sell orders. ⚠ **February, not May** — the same rule
  scored against May 1836 is worse, so the substitution lag does not pay for the construction
  drift a wider gap brings in.
  **In-stratum SoL spread (`SOL_SPREAD` = 8).** A stratum is not one wealth level, and buy packages are
  steps, so each class's people are spread uniformly over ±8 levels around its mean rather than
  collapsed onto it. One global constant, not a per-market fit (fitting the width per market buys
  ~0.5 pp and is deliberately not done).
  **⚠ HOW ACCURATE THIS ACTUALLY IS — state it plainly, do not round it away.** Scored against the
  game's **own** pop-consumption figures (`consumption_breakdown` telemetry, not a residual) across
  seven 1836 markets, mean absolute error is **18.5 %** of pop spending at base prices. The ladder
  behind that: 49.8 % flat-SoL + fitted weights → 48.2 % measured per-stratum SoL → 25.7 % adding this
  supply-share split → **18.5 %** adding the spread → 16.7 % if every pop's TRUE SoL is used instead
  (so the stratum abstraction costs ~1.8 pp and is kept). **These are MEAN errors — individual goods
  and individual markets are worse**: Japan sits at ~33 % and is a genuine ~1.8× level shortfall that
  is still unexplained, while Russia and the USA reach ~8–10 %.
  **The likely culprit is the within-need substitution.** Forcing the predicted total to match the
  measured total recovers only 0.5 pp (16.7 → 16.2), so the money is right and its *distribution* is
  wrong. Per-need, the money placed on the wrong good runs **heating 20 %, basic_food 16 %,
  intoxicants 15 %**, against 0 % for needs with a single available good. What cannot be separated from
  the order book: 17 of 35 goods belong to **two** needs (meat and fruit are `basic_food` *and*
  `luxury_food`; opium is `intoxicants` *and* `leisure`), so no need has an observable budget and
  "wrong budget per need" cannot be told apart from "wrong split within need". See FINDINGS F24.
  `config/pop_distribution.json` survives only as the **fallback** for a need with no supply at all in
  the scenario (an empty market must still split sanely); the `fit pops` button re-derives that
  fallback. It is no longer the model.
  *(Historical: the fitted market-independent vector this replaced, and the vanilla `weight` field
  before it — `weight` is not an allocation rule and cost 12 pp on its own.)* `weight` is not an allocation
  rule — the game allocates by *supply share*, bounded per entry by `max_supply_share` — and using it gave
  British grain 17 % of the food budget where the real share is ~79 %, understating British grain demand by
  7 900 units. The fitted split is **market-independent by design** (a supply-share rule would make the
  panel's demand depend on its own supply) and is solved across all 7 preset markets against the measured
  order book: mean absolute demand error **49.1 % → 37.0 %**, six markets of seven improving (FINDINGS F15).
  Re-derive with the **fit pops** button in the preset bar, which prints the JSON to the console; it is
  session-only until pasted into the config, because a design input belongs in version control.
  ⚠ The fit is **weighted per market** (each normalised by its own total demand). Unweighted, Britain and
  the Qing set the answer for everyone and France and the USA get *worse* — that difference is the whole
  content of "one rule for every country", so don't change the weighting without re-reading F15.
  **Pop demand** is otherwise computed **live in the UI** (`popSpend()` → `spendToGoods()`), not baked into the
  preset: the preset carries the
  population split into **upper / middle / lower / peasants / slaves**, each class buys the **buy package**
  (`common/buy_packages`) of its wealth level — the **SoL** fields in the bar, default 35 / 16 / 9 — scaled by
  people ÷ `POP_SIZE_PACKAGE` (10 000), by the **per-head dependent factor** (needs are per *working adult*;
  dependents need `DEPENDENT_CONSUMPTION_RATIO` = half ⇒ `0.25 + 0.75×0.5` = **0.625** per head) and by its class
  multiplier (**peasants ×0.05** — the game's own `consumption_mult` in `common/pop_types/peasants.txt`: most of a
  peasant's needs are met inside the subsistence building and never reach the market; overridable via
  `defaults.class_mult` in `config/presets.json`). Each **pop need**'s money is split across **every** good that
  need lists, by the market's own supply share (`needSplit()`, below). Money → quantity at **base price**.
  **There is no "pop demand fit ×" knob and no per-good availability gate** — both are gone, and neither should
  come back. The fit multiplier was a global scalar on all pop consumption from before the model was calibrated,
  and F24 showed forcing the predicted total onto the measured total buys only 0.5 pp, so it had nothing left to
  correct. The **"Pops may buy" toggles + scenario year** were redundant against supply share: a good the market
  does not supply already takes a zero share and drops out on its own, so the calendar gate could only make the
  two disagree.
  **SLAVES ARE NOT A CONSUMING CLASS** (FINDINGS F27). The game never has a slave buy anything: the **building
  that employs them buys a consumer-goods basket** on their behalf, and the market screen reports it as its own
  order channel (`GOODS_SLAVE_CONSUMPTION_MARKET_ORDERS`, *"purchased for slaves"*). The panel computes it
  separately (`slaveSpend()`), then **folds it into the `pops` buy column** — it is a genuinely separate channel
  but a small and usually-zero one, and a permanent column for it costs every reader width on every row, so the
  column is the total and **hovering a pops cell breaks the slave part out** in absolute numbers.
  The basket is a **wealth level**, from `common/defines`: `SLAVE_BASKET_DEFAULT` 8, clamped to
  `[max(MIN 1, SCALED_MIN 0.5 × lowest non-slave wealth), min(MAX 12, SCALED_MAX 1.0 × that wealth)]` — so the
  **`slaves` field in the SoL row is that basket level**, not a standard of living, and a preset seeds it from the
  market's measured slave SoL (which *is* the realised basket: the rule's 8 against a measured 7–8). Per head it
  uses slaves' **own** `working_adult_ratio = 0.5` ⇒ **0.75**, and **no class multiplier** — the game has no
  `consumption_mult` for slaves, so the 0.5 that used to be applied was invented.
  **The dominant term is WHERE THE SLAVES WORK** — `SLAVE_BASKET_SUBSISTENCE_GOODS_MULT = 0.05` makes a slave in
  a subsistence building cost a twentieth of the basket, and applying the full basket to everyone over-predicts
  the American market's **directly measured** slave purchases by 3.9×. So the share is **derived**
  (`slaveRealShare()`), by the same residual-employment logic the peasant/subsistence model uses — buildings hire
  first, subsistence absorbs the rest:
  `unqualified jobs (laborers+farmers) in non-subsistence buildings − lower stratum × 0.25` is the surplus, split
  between slaves and peasants in proportion to their workforce; the basket multiplier is that share plus 0.05 of
  the rest. It **self-scales**: more industry ⇒ more slaves in real jobs ⇒ more market demand. **Both large slave
  markets were measured directly and it holds**: the USA derives **0.209** against a measured 0.224 (volumes 94 %
  of measured) and Britain **0.05** against 0.044 (114 %) — Britain's free lower stratum already exceeds every
  unqualified job in the market, so none of its 10.5 M rural-India slaves reach a real building.
  ⚠ Two stated assumptions, neither fitted: slaves fill **laborer/farmer** jobs (using all jobs instead gives the
  USA 0.235 — the measurement sits between), and slaves/peasants split the surplus **proportionally** ("slaves
  first" gives 0.383, "peasants first" 0.05). Don't replace either with a global fudge factor.
  ⚠ **The share is computed MARKET-WIDE, and that is its known failure mode**: France and Russia hold near-identical
  slave counts but consume 14× apart, because France's slaves sit in colonial plantations while its free workers
  sit in the metropole, and the market-level aggregate washes that out. Accepted deliberately — those two markets
  hold 0.4 % of the world's slaves and 13 units of demand between them. See F27.
  **The population itself is editable** — one field per class (`upper / middle / lower / peasants / slaves`) in the
  preset bar, showing the derived total; a preset reloads them, and you can then push them around by hand.
  **SoL is per stratum, five fields, and a preset fills them from measurement** (`config/measured_1836.json`):
  peasants carry their **own** wealth level rather than borrowing the lower class's, because the
  measured spread cannot be expressed otherwise — peasants run 4.5 in Japan against 12.1 in France, and in
  Britain they sit *above* labourers (F12). **The SoL row and the Population row are ONE class order**
  (`CLASSES`, upper · middle · lower · peasants · slaves) on one CSS grid template, so each class sits in one
  column across both — keep it that way; two lists in two orders is how they came to disagree.
  **Hovering a scenario supply or demand number gives its breakdown by source** — `paper — 840 supply from
  2 building type(s) / Sulfite Pulping Paper Mills (T2) 10×60 = 600 / …` for the building columns, and the
  per-**pop-need** split for the pops column (a need is the unit the money is budgeted to, so it is
  the one that tells you where to look when a good is wrong), **with the slave-basket part broken out below it**
  in absolute numbers together with the share and multiplier that produced it.
  The pops column, the SoL fields and the pop counts are all **session-only**.
  **Buildings the history files never create are inferred**, because two of them dominate the supply side:
  - **Subsistence farms** (`bg_subsistence_*`) — *the peasants ARE this supply*. The game raises one per state on
    the arable land the real farms/ranches/plantations leave free (`arable_land` and `subsistence_building` in
    `map_data/state_regions`, minus the levels of `bg_agriculture`/`bg_ranching`/`bg_plantations` buildings there;
    state ownership from `common/history/states`, apportioned by owned-province share when a state is split).
    Each level hires 5 000 peasants (rice paddies 10 000) and its goods are **`workforce_scaled`** — proportional
    to the peasants actually working, *not* to the level count. So the extractor emits each subsistence type at
    its **staffed-level equivalent** = free arable × `staffing`, where `staffing = min(1, peasant workforce ÷
    capacity)` and peasant workforce = peasant pop × `WORKING_ADULT_RATIO_BASE` (0.25). That reproduces the real
    output exactly under the UI's full-employment model, and it self-scales: peasants are already the residual of
    the class split, so more industry ⇒ fewer peasants ⇒ less subsistence output. 1836 staffing lands at
    FRA 79% / GBR 73% / RUS 57% / **CHI 100%** (China is arable-capped: 90.9M peasant workers vs 73.3M jobs).
  - **Ownership buildings** (**manor houses / financial districts**) — inferred from the `add_ownership` entries
    (one level per owned level), for any owner type history never `create_building`s.
  For both, which PM is active is decided by the owner's **LAWS** (`activate_law` in `common/history/countries`)
  rather than by a history line: `Select-LawPm` picks the first PM that is not power-bloc- or tech-gated, not
  disallowed by an active law, and either ungated or unlocked by one the country has — so Russia/Qing run
  `pm_serfdom`, France `pm_peasant_proprietorship`, Britain `pm_serfdom_no`, and everyone gets home workshops
  rather than the collectivized-agriculture variant the PMG happens to list first.
  - **Urban centres** — **solved** (FINDINGS F13; the divisor was the missing piece and it is **100**).
    A state raises `floor(state urbanization / 100)` levels, where each building level contributes its
    `building_group`'s `urbanization` **except** groups flagged `is_subsistence`, which contribute
    nothing. Verified exact on **774 of 783 states**; the nine misses are all under-predictions from the
    technology/law urbanization bonus, which we deliberately ignore (base techs). The floor is taken
    **per state and then summed** — flooring the market total once would hand a large market the rounding
    loss of every state at once. A tier building contributes exactly what the vanilla building it replaced
    did, because the lookup is keyed on `vanilla_pm`'s base building, not on the tier key. PMs are chosen
    by the market leader's laws (`Select-LawPm`), like the other never-created buildings.
  - **Military buildings** (barracks, conscription/logistics centres) come from `config/measured_1836.json`,
    not history: the engine sizes them to the army, so history carries 31 British barrack levels against
    705 in game (F14).
  - **THROUGHPUT** is a per-building-type multiplier on inputs *and* outputs, measured with
    `Building.GetThroughputBonusCurrent` — the same call the building panel renders — so it is **read,
    not summed from sub-factors and not fitted**. Belgium's steel mill runs **+31.5 %**, mostly its
    John Cockerill company bonus. Economy of scale is only the first slice: `building_throughput_add
    = 0.01` per level (from level 1, capped at 20) for groups flagged `economy_of_scale`; 1 555
    buildings world-wide match that exactly and 3 033 have no bonus at all (owner, military, trade,
    infrastructure). It has its own **Thru** column, is editable, and is **never emitted** — the game
    computes its own.
  - **SECONDARY production methods** are measured too: history's `activate_production_methods` lists
    fewer than the game runs, which is why Belgium's fruit and luxury clothes had no source at all.
    ⚠ The rule is **most popular by levels, per PMG per building type per market — a deliberate
    distortion**: a country whose farms split 51/49 is rendered as if all ran the winner. The
    extractor prints a **near-tie warning** whenever the winner holds under 65 % of levels, because
    that is exactly where it misleads. Belgium's wheat farms are a 4-vs-4 tie, and "no secondary" won
    — which is why its fruit is still zero.

  **A scenario contains BUILDINGS, not raw order adjustments.** Anything that consumes or produces goods is
  represented as a building with a count, so it shows up in the sheet, in the hover breakdown, and in the
  per-building arithmetic. The only non-building columns are the two **trade** columns — treaty
  `goods_transfer` articles plus the market's actual trade-route flows, filled in by a preset and editable
  for manual tinkering. **Trade centres consume merchant marine and nothing else**; the goods that move
  *through* them are trade, and belong in the trade column. An editable **Build cost** column
  (construction points → `required_construction`, with a muted "model N" hint that turns amber when the
  stored value diverges from what `solve_building_cost.ps1` would set), a read-only **Payback** column
  (years = build cost × £720/point ÷ annual net profit at the current prices; wages per the row's
  wage %, at base input cost; **∞** when unprofitable at current prices), a
  **ladder chart with TWO SWITCHABLE VIEWS** (a radio in its header; they answer different questions and
  neither replaces the other, so keep both): **break-even** — full BE at BASE input prices, a property of the
  RECIPE alone and therefore scenario-independent, with each tier's target band shaded; and **profit** — the
  margin each tier actually earns at the current scenario's realised prices, PMs, throughput and wages
  (identical to the row's Profit column, cross-checked), y-axis auto-scaled to the data and always including
  **0%** (drawn solid, the viability line) plus a dashed **+20%** era-appropriate target. A line sloping DOWN
  to the right in profit view IS an inverted ladder. ⚠ The two views disagree by design — a tier can sit
  exactly on its BE target and still lose money once its output price falls; reading either alone as "the
  ladder" is the mistake. A **hollow dot** in either view means the scenario contains none of that building
  (same presence rule as the Ladder check).
  **A SECOND, independent dimension: raw ⇄ aggregated.** *Raw* is one line per industry (as above).
  *Aggregated* collapses everything into the mod's **four standard sectors** — the same split
  `era_scenarios.mjs` reports its composition in, so chart and report can be read against each other:
  **extraction & logging** (mining/gold/logging/oil/rubber), **agriculture, fishing & whaling**
  (farms/plantations/ranching/fishing), **manufacturing from raw inputs** and **manufacturing from
  manufactured inputs** — the last two split **per TIER** by whether that tier's recipe consumes a good our
  own ladder makes (identical test to the solver's `mfg_high`/`mfg_low`). Drawn as **box plots** (whiskers
  min–max, box IQR, thin line median) with a **◆ output-weighted centre**: each member weighted by what it
  contributes to the scenario's output value, so the big producers set the position and an unbuilt building
  weighs nothing. ⚠ The centre falls back to a plain median when *nothing in that box is built* (a later
  era's tier, say) and is then drawn **hollow ◇** — a filled marker there would claim a weighting the
  scenario never supplied. ⚠ **Extraction and agriculture are UNTIERED** (vanilla buildings, outside the
  tiering scope): they repeat unchanged in every tier column as a flat baseline to read each manufacturing
  tier against, and that flatness is the honest statement that they have no ladder.
  The aggregation shape is **explicitly provisional** — box-plots-plus-weighted-centre is a starting point,
  not a settled choice.
  Plus config-part save/load (version-tolerant), and snapshot history. **Payback
  tools** (selectable X years) come in two actions at three levels: **$ = set build cost** (fix prices,
  set build cost so payback = X) and **% = set prices** (fix build cost, scale that industry's output +
  input prices by one factor — keeping the IO ratio + input mix — so an anchor tier's payback = X; flags
  prices leaving the 25–175% band). The three levels: **tier** (the `$`/`%` buttons on each row, anchor =
  that tier), **group/vanilla-industry** (the `group $→X`/`group %→X` buttons in each card header, anchor
  = the group's Tier-1), and **whole sheet** (the `sheet …` toolbar buttons — every group, anchor = each
  group's Tier-1). **Group locks:** each card header has a 🔒 lock toggle (plus toolbar `🔒 all` / `🔓
  all`); a locked group is **excluded from every mass editor** — the **Restore-defaults** preset, the sheet
  payback buttons, and its own group/tier payback buttons (which grey out) — while manual field edits stay
  allowed. Locks are UI-session state (reset on reload). The **Restore defaults** button resets each in-scope
  **unlocked** group to its as-loaded config values (target BE, volumes, build cost, ai_value, secondary PMs)
  — i.e. what a page refresh produces, but honoring current locks (a page refresh restores all defaults **and**
  lockedness). The **Bring to vanilla** button (same scope selector + lock honoring) resets each in-scope
  **unlocked** split building *toward base-game values*: every tier's output+inputs become its `vanilla_pm`'s
  recipe (read live from `vanilla.js`), its `ai_value` becomes the **pre-split vanilla building's** value
  (Tier-1 key = the vanilla base building; blank = engine default, e.g. tooling → 2000), its **`building_cost`**
  becomes the pre-split building's flat `required_construction` (the vanilla `construction_cost_*` script value:
  low 200 / medium 400 / high 600 / very_high 800 — `VANILLA_CONSTRUCTION` in the UI, mirror
  `common/script_values/building_values.txt`), and its secondaries reset to base. `target_be` is left as-is, so
  BE then reflects vanilla economics (usually off-target/amber — expected).
  **GUIDELINE — what "Bring to vanilla" must (not) touch:** it brings **everything** back to vanilla **except**
  (1) the *tier split itself* (the per-tier buildings that replaced one vanilla building stay split — this
  button is about values, not structure), and (2) any field the UI does **not** yet make editable **and**
  emittable (today: **workforce**/`employment`). Everything else that is editable+emittable — output, inputs,
  `ai_value`, `building_cost`, secondary-PM goods — must reset to the base-game value. Uphold this as we add
  fields: when a field becomes editable+emittable, wire it into Bring-to-vanilla too. *(Future: give every
  building a "vanilla root" — the recorded base-game values — so any building, not just the tier-split ones,
  can be brought to vanilla.)* More named presets will come later. **Base `ai_value`**
  (building AI construction desire) is editable everywhere: on **our tier rows** (per-tier `ai_value` in the
  config; blank = engine default 1000) and on **every explorer building** (a `data-refaiv` field backed by
  the top-level **`building_ai_value`** map). The builder emits ai_value for buildings in files it owns via
  two separate paths — (a) **our tier buildings**, from each tier's own `ai_value` (this is where **tooling =
  2000 at all four tiers** comes from, matching the vanilla tooling workshop), and (b) **PRESERVED** vanilla
  buildings inside owned files `01/06/11`, from the top-level `building_ai_value` map via `Set-BuildingAiValue`
  (today one entry: **`building_trade_center` = 5000**, i.e. 5× the engine default of 1000 — vanilla scripts
  no `ai_value` for it at all). Explorer edits to non-owned buildings show but don't emit yet. The UI's default display reads
  each building's vanilla `ai_value` from `vanilla.js` (now extracted). **AI subsidy policy** is editable the same way,
  on **every** row (tier + explorer), via a 5-option dropdown backed by the top-level **`building_subsidies`** map
  (building key → `vanilla`/`none`/`nice_to_have`/`wants_to_have`/`must_have`; **default `vanilla` everywhere except
  `building_trade_center` = `must_have`**). See "AI subsidy policy" below for what it emits and why. **"Build now"** writes the config and runs the full build (needs the `ui.ps1` server — a
  browser can't run programs). Everything else works **frontend-only**: opening `ui/builder.html`
  directly still edits + previews + **Export mod_config.json** (then run `build.ps1` yourself).
  User-facing setup lives in `README.md`.
- **PRINCIPLE — column alignment: LEFT unless there's a reason.** In the building tables every column aligns
  **left** (`th,td` default); the `.num` class now only requests **tabular figures**, it does *not* force
  right-alignment. Right-alignment is **opt-in**, and only justified where a cell holds a **label → value pair**
  that should read as an equation — the goods rows (`grain 66 £1320`) and the `total in £1560` subtotals, both
  handled by `.goodrow`'s flex — or in the **scenario panel**, which deliberately mirrors the in-game market
  screen (order magnitudes line up). Don't reintroduce a right-aligned column without one of those reasons.
- **PRINCIPLE — ONE UI layout for every building (do not keep re-deriving this).** There is **no separate or
  lesser UI** for buildings outside the tiering scope. Our tiers, economic-but-out-of-scope buildings (farms,
  mines, …), and non-economic buildings (government administration, military, …) all render with the **exact
  same row layout** — same columns, PM selectors under the name, editable goods, the **wages row**, workforce,
  BE/Profit. A cell or value is blank / `—` **only when the building genuinely lacks it**: no goods output →
  Output `—`; no *input* goods → wages are **100%** of total with the £ magnitude `—` (not modelable yet); not
  on the ladder → Target / Build cost / Payback `—`. **Never branch the layout on tiered-vs-reference.** When you add a UI element, add it everywhere
  and let it show `—` where truly absent. **Macrogroups only organize** buildings (economic-out-of-scope vs
  non-economic) — they never change the layout. (The wages row uses one shared `wageRowHTML`; reference-building
  wages are session-only via `REFWAGE`, model-only like everywhere else.)
- **All-buildings explorer.** The UI **always** shows every vanilla building,
  not just our tiered industries: our industries stay editable cards (each tier's **secondary PMGs** —
  canning, luxury, automation, … — are PM dropdowns under the building name; a non-base selection folds into
  that tier's BE/profit + Workforce and its **goods are editable** (via `pm_goods`) in the Input/Output columns,
  matching the linter's building-level view; default = base/"off" PM = the PMG's first **non-gated** PM, so nothing
  moves until you switch). A PM carrying `unlocking_principles` is **power-bloc-gated** (only active with a power-bloc
  principle, e.g. `pm_principle_freedom_of_movement_3`); `extract_vanilla.ps1` flags these with `gated:true` in
  `vanilla.js`, and `basePm()` skips them when picking a PMG's default — some PMGs list the gated PM first, and
  defaulting to it would show effects that are inactive in-game. Below
  them, **every other vanilla building** (those not on our tier ladder — some economic, just out of scope
  for now) renders in the **same card + table UI** as our industries: one **category card** per taxonomy
  group, one **row per building** using the **exact same 11-column layout** as the industry tables (shared
  `MTABLE_COLS` colgroup, so columns line up). Each building is shown as **Tier 0** (untiered — a grey `0`
  pill); the ladder-only columns (Target / Build cost / Payback / →X) show **—** (genuinely N/A — not on the
  ladder). Each row has the building's **PM selectors under its name**, **every good editable** in the
  Input/Output columns (wired to `pm_goods`), the **wages row** at the bottom of the Input cell (editable
  £↔%, model-only; a building with no *input* goods is **100% wages** (its whole cost is labour) with the £
  magnitude shown as `—` until wages are per-profession), non-goods outputs
  (infrastructure, pollution, bureaucracy, trade capacity, ship construction, …) and **workforce** read-only,
  and informational **BE** + **Profit@thr**. **Each category is locked by default** (a
  🔒 that excludes it from future mass tools — still fully editable; the amber bar without the dimming);
  unlock to include it. The **Military** card (battalions, not buildings — two rows per combat unit type,
  mobilised and not) is a category card like any other: same 13-column layout, **foldable** through the same
  `REFGRPOPEN` set, collapsed by default with its unit-type and battalion counts in the header. **Goods edits are config-backed and emitted**: they persist to the top-level
  **`pm_goods`** map, which the builder writes into the owned production-methods files, so an edit to a PM
  applies to **every** building that uses it (our tier main PMs stay per-tier; every *other* PM — reference
  buildings' PMs *and* our tiers' secondary PMs, editable both in the reference table and on the tier cards
  (the `↳` rows) — goes through `pm_goods`). Note **PM names are not all `pm_`-prefixed** (plantations/mines
  use `default_`/`automatic_`/`picks_and_shovels_`/… ); the extractor, the builder's `pm_goods` writer, and
  the linter all handle any name — so plantation/mine goods are editable & emittable too. Buildings are
  sorted into a **custom taxonomy** (not raw `building_group`) grouped into **macrogroups by economic status**
  (organization only — never a layout change): **economic, out of scope** — *Utilities, trade & arts* →
  *Food & agriculture* (farms/plantations/ranching) → *Raw resource extraction* (mining, gold fields, logging,
  oil, rubber, fishing & whaling); then **non-economic** (state, property & special, no market goods) —
  administration, military consumers, property owners, subsistence, service, construction, Unique buildings.
  (`#econref` is now emptied and merged into `#reference`.) The map is `GRPCAT`/`CATLABEL`/`ECON_CATS`/`REF_CLUSTERS` in `ui/builder.html`
  (keyed by vanilla `building_group`; unmapped groups fall back to their own card in the Other cluster).
  All PM data comes from `ui/vanilla.js` (regenerated every build by `extract_vanilla.ps1`; UI-only, never
  shipped). PM *selections* in the explorer are session-only (which PM is active is the game's runtime
  choice); PM *goods* edits are saved/emitted via `pm_goods` (above); category **locks** are UI-session state.
  **Emission scope for untiered buildings:** we emit their **goods** (via `pm_goods`) and, inside files we
  already own, their **ai_value** — never a whole building definition. There is deliberately **no switch** for
  that: an `include_all_buildings` config bool / `-IncludeAllBuildings` flag used to sit in the builder and
  gated *nothing* (it was read, logged, and never used again), so it was removed. When we do start emitting
  untiered buildings wholesale, add the scope control together with the code that honours it.
- **Localization is generated for all 11 languages** — every added key gets an English stub in
  every language file, because untranslated keys show as raw `<key>` placeholders for non-English
  players (no reliable English fallback). This is handled by the builder; you never write loc by
  hand. See MODDING_NOTES.md → Localization. In-game building names are auto-formatted as
  `Tier N. <name>. BE target <actual on-build full BE>%` (e.g. "Tier 1. Bakery Food Industries. BE target 140%";
  BE here is the wage-inclusive full break-even).
- **After an in-game load, check `error.log`** (see MODDING_NOTES.md) — the linter checks
  economics, not engine errors. The builder also emits a **self-diagnostic** on_action
  (`mod/common/on_actions/zzz_pm_rehaul_diag.txt`) that logs a `PM_TECH_REHAUL: init OK … (build <ts>)`
  marker to `logs/debug.log` at game start (absent marker ⇒ mod failed to load). **Convention:** when a
  change might trip something the linter can't see, add an invariant tripwire inside `pm_tech_rehaul_diag`
  (logs `PM_TECH_REHAUL WARN …` on failure), then have the user run the game (init fires at the 1836 start;
  ~1 in-game day, or to 01.02.1837 for a first pulse) and read back `debug.log` + `error.log`. See
  MODDING_NOTES → Self-diagnostics.
- **🛑 HARD RULE — A RUN'S CONFIGURATION MUST BE UNAMBIGUOUS BEFORE IT LAUNCHES. CLARIFY UNTIL CERTAIN.**
  A request to "run X" is **not** a specification. Before any launch, state back — and get agreement on —
  **which ARM** — `{kind: control}` = vanilla + telemetry and **nothing else, ever**; `{kind: config,
  config: <path>}` = a full modded build, and *which* one; plus, once the ❌ below is fixed,
  `{kind: overlay, config: <path>}` = vanilla + telemetry + a small declared overlay, which is **not a
  control** and must never be reported as one — plus the **span**,
  **n**, the **metrics**, and **what is being compared against what**. If any
  of that is unstated, ASK. Do not infer it from what the last batch happened to use.
  ✅ **The arm is now RECORDED, machine-read, in every run's `build_state.json`** (schema v2):
  `deterministic.arm` is `control` / `control+pop_needs` / `config`, and `deviates_from_vanilla` lists
  every gameplay directory the built mod actually carries. Both are read **off the built mod**, not off
  the flags it was asked for, so they cannot disagree with what loaded. `built_from_config` +
  `config_sha256` are populated too — `run_schedule.ps1` never passed `-BuildConfig` before 2026-08-06,
  which is exactly why the wrong-arm day had to be reconstructed by hand from `schedule.json`.
  ⚠ **This rule is written in a wasted day (2026-08-05).** A full day of debut-good measurement — five
  launches, ~6 h of game time, findings F32/F33 — was run on `config/mod_config.json`, the old tiered mod,
  because that is what the previous balance batch used. The user's expectation was vanilla + telemetry. The
  result satisfies **neither** purpose: it is not the design we are moving towards, and it is not a clean
  reference either, since it differs from vanilla in GDP, workforce composition and an unbounded amount
  else. Everything measured that way needs re-running before it can be trusted.
  ⚠ **"Which arm" is not a detail — it decides what the number MEANS.** A measurement of *the game's*
  behaviour must be on vanilla; a measurement of *our economy's* behaviour must be on our config; and the
  two answer different questions. **State the arm in the schedule's `_why`, and in every finding it
  produces.** A finding that names its session but not its arm is uninterpretable later.
- **NEVER launch a game run without the user's explicit go-ahead — and ask for the whole batch in ONE
  request.** Game time is the one cost here that cannot be optimized away: every run pays ~40 s of load
  plus roughly a minute per in-game year, and it monopolizes the machine. Three rules:
  - **Explicit ask or explicit permission, every time.** Only start `run_observer.ps1` (or the game by any
    other means) when the user has asked for a run or approved the one you proposed. Permission for one
    batch is **not** permission for the next — re-ask, even for a rerun of the same thing.
  - **Always quote the cost as `<count> × <span>`** — e.g. *"I need five 1836→1840 runs, ~30 min"* — whether
    the runs are your idea or the user's. The only exception is when the user has already named the count
    and span themselves; then just confirm what you're about to do.
  - **Bundle every run you can foresee, including the branches.** If the outcome forks (*"if tier-1 BE 140
    reads badly we'll want the same batch at 130"*), ask for **both** in the same request instead of coming
    back for the second half. The normal working pattern is a batch left running overnight, after which the
    user is unreachable for hours — one night beats two nights with an idle day between them. When a fork is
    plausible but not certain, name it and ask for permission to cover it anyway.
- **The observer (`tools/testbed/run_observer.ps1`) — the game driver `run_schedule` calls.**
  Deterministic, no agent in the loop: it launches the game **without the Paradox launcher**
  (`victoria3.exe -handsoff` auto-starts an **observer** game at the 1836 bookmark;
  `-run_until=<date>` makes the game play to a date and **quit itself**), harvests, and repeats
  N times. ~5.7 in-game days/sec (+~40 s startup), so a 5-year run is ~5–6 min. **Measurement goes
  through `run_schedule.ps1`** (above); invoking the observer by hand is a *diagnostic* — e.g. the
  post-patch smoke test in ON_GAME_UPDATE — because it has no build step and can only run a mod
  someone already built:
  ```
  powershell -ExecutionPolicy Bypass -File tools\testbed\run_observer.ps1 -Runs 1 -DumpDates 1836.3.1 -UntilDate 1836.4.1
  ```
  Two pieces: (1) it writes **`content_load.json`** to enable the mod under test (`dlc_load.json` is gone
  in 1.13 — see MODDING_NOTES) and backs up/restores that plus `pdx_settings.json`; (2) it harvests into
  `tools/testbed/sessions/` — **the one results root** — `markets.tsv` + `events.tsv` + `meta.json` +
  `harness.log` per run, `markets_all.tsv` + `session.json` + `session.log` per *session*, and the game's
  logs. **Telemetry is not its job**: it comes from the mod under test (see the next bullet), and the
  observer **refuses to launch** a mod that carries none rather than burning the game time to harvest
  nothing. **The game's own logs are a 5×512 KB rotating ring
  shared by every run**, so the growing ones (`debug`, `error`, `dedicated_server`) are **mirrored
  continuously** into `logs_live/` — one complete file per log per run, which is the authoritative
  copy (`logs/` is only the exit-time snapshot, and can contain a previous run's rotated files).
  Long runs *need* this: a full-length campaign overflows the ring and would otherwise lose its early
  game. See MODDING_NOTES → *Automated headless runs* for the two rotation hazards and the per-run token
  that keeps runs from contaminating each other.
  **One run's results live in exactly one place.** Under `-FlatOut` (how the scheduler always calls it —
  always `-Runs 1`) the run writes straight into the folder it was given: no `runNN/` level, and no
  session-level aggregate, because with one run `markets_all.tsv` would be a byte copy of `markets.tsv`
  and `session.json` a re-wrap of `meta.json`. The cross-run aggregate is the scheduler's
  `markets_all.tsv`, whose rows carry `run_index` + `setup` so a row identifies its arm on sight.
  **Every batch writes `build_state.json`** at the session root — what was under test, so the numbers stay
  interpretable later. It is a two-part tree: **`deterministic`** (machine-read: mod metadata + a
  file-layout fingerprint, the config it was built from + that config's hash, git branch/commit/dirty, game
  version, harness args, the harness script's own hash) and **`agentic`** (free text via `-Label` / `-Notes
  <json>`: what this build *is*, how it differs from the baseline, why it ran, what signal is expected,
  caveats). The agentic half is a deliberate stopgap for hand-driven experiments — as the sweep driver
  learns to set a parameter, that parameter moves into `deterministic`; anything added there must be
  machine-read, never described.
  Useful flags: **`-DumpDates a,b,c`** (several dump dates per run; each must be the 1st of a month, and
  extra dates are cheap insurance — a run cut short still has its earlier dumps), **`-ModPath <dir>`** (any
  absolute path, so an alternate build from `build.ps1 -SaveTo <name>` runs without being deployed),
  **`-Stamp`** (the session id; the scheduler passes its own so one run has ONE identity across
  `build_state.json`, the folder name and the telemetry token), `-Label`, `-Notes`, `-BuildConfig`.
  There is **no `-NoMod`**: the control arm is a real mod built by `build.ps1 -ControlOnly` (vanilla +
  telemetry), so both arms load a mod and instrument identically.
  **Crash resilience:** a run that ends early is resumed from its own last autosave
  (`-AutosaveInterval`, default `five_year` ≈ 19 saves per campaign; engine values are
  `never/monthly/quarteryear/halfyear/five_year/yearly` — no script effect can save the game).
  **⚠ Autosaves overwrite the player's own `autosave*.v3` slots.** A CTD is identified by a new
  `crashes\victoria3_*` minidump, never by exit code. Resume is guarded three ways (own-save-is-newest, and
  the resumed clock landing neither ahead nor at a fresh 1836 start), because `-continuelastsave` loads the
  newest save *on the machine* and will otherwise splice in a foreign timeline; see MODDING_NOTES.
  **To stop:** press **`q`** (finish this run, then stop) or **`x`** (stop now) in the harness console at
  any time — no need to kill the game. A `tools/testbed/STOP` file does the same and is the fallback when
  the harness was launched headlessly (an agent-launched background job has no console).
  **⚠ LAUNCH IT SO THE KEYS SURVIVE.** The keypress control needs a real console:
  `[Console]::KeyAvailable` throws when stdio is redirected, which silently sets `HasConsole = $false`
  and disables `p/r/s/q/x` for the whole session. **Redirecting stdout/stderr is enough to kill it** —
  `Start-Process … -NoNewWindow -RedirectStandardOutput …` looks harmless and is not. Spawn it into its
  **own visible window** and leave stdio alone:
  ```
  Start-Process powershell -ArgumentList '-ExecutionPolicy','Bypass','-NoExit','-File','tools\testbed\run_schedule.ps1','-Schedule','<spec.json>'
  ```
  For progress, **tail the session log** (`tools/testbed/sessions/<stamp>/session.log`) rather than
  capturing the process's stdio. Since 2026-07-31 the observer logs a loud `WARN` at startup when it
  has no console, so a headless launch is at least visible in the log — it used to be indistinguishable
  from an interactive one, and an entire overnight batch ran with the STOP file as its only control.
  ⚠ `run_schedule.ps1` takes **no `-Label`** (the label comes from the schedule JSON); passing it kills
  the launch instantly, which is exactly how the above happened.
- **ALWAYS pair a batch launch with `tools/testbed/wait_for_session.ps1` in the BACKGROUND.** The
  visible window that keeps the keys alive is invisible to the agent harness, so nothing signals when
  the batch ends — on 2026-08-01 a finished 8-hour batch sat unnoticed for ~2 h. The waiter supplies
  the missing signal: run it with the tool's `run_in_background` (which *is* harness-tracked), and its
  exit wakes the agent. It returns on whichever comes first — **DONE** (session finished),
  **RUNNING** (the `-MaxMinutes` heartbeat, default 30; just re-launch it to keep waiting), or
  **DEAD** (exit 2 — no game process and no completion marker, after a **`-DeadGraceSeconds` grace,
  default 900**, re-checked throughout rather than slept blind). The heartbeat is the point: without
  it, a hung run would never wake anyone, because the completion signal is exactly what a hang
  withholds.
  ⚠ **Do not confuse the two graces — they are different timers on different scripts.** This one is
  the **waiter's DEAD grace** (`wait_for_session.ps1 -DeadGraceSeconds`, **900 s**, raised from 90 s
  because a long harvest looks exactly like a dead session). The other is the **observer's crash
  grace** (`run_observer.ps1 -StopGraceSeconds`, **still 60 s**) — how long an unexplained game exit
  waits for a keypress before being treated as a CTD and resumed. ⚠ That 60 s only applies when the
  harness **has an interactive console**; launched headlessly it logs *"no interactive console -
  cannot ask; treating as a crash"* and resumes within a second or two.
  ```
  powershell -ExecutionPolicy Bypass -File tools\testbed\wait_for_session.ps1 -Session tools\testbed\sessions\<stamp> -MaxMinutes 30
  ```
  ⚠ **DEAD IS A FALSE POSITIVE DURING A LONG HARVEST.** Between runs the game is gone and there is no
  completion marker yet, which is exactly the DEAD signature — but the observer is parsing the mirror, and
  that takes **minutes** on a big one (measured 2026-08-05: a 496 MB mirror took ~7 min, against the
  waiter's 90 s grace). Before treating DEAD as real, check `run.log`'s tail for a `run N finished` line and
  whether the harness PowerShell is still alive; a batch that looks dead may simply be writing
  `markets.tsv`. Do NOT relaunch the schedule on a DEAD alone — that is how a healthy batch gets killed and
  restarted from 1836.
- **Telemetry belongs to the BUILDER, not the harness.** `tools/telemetry_lib.ps1` is the single
  generator of testbed logging script; `build.ps1` dot-sources it and emits
  `common/on_actions/zzz_v3tb_telemetry.txt` into whatever mod it builds. Flags: **`-Telemetry <spec.json>`**
  (`{dump_dates, tags, metrics}`; each dump date must be the 1st of a month), `-TelemetryOn` (defaults),
  `-TelemetryToken <tok>` (stamps every line so one run cannot read another's output), and
  **`-ControlOnly`** — the **vanilla control arm**: a complete, loadable mod whose *only* content is that
  telemetry file plus metadata (no buildings, PMs, localization or history). `-ControlOnly` requires
  `-SaveTo`/`-DryRun` so it can never overwrite the canonical `mod/`.
  🛑 **HARD RULE — THE ONLY THING A CONTROL MAY VARY IS ITS TELEMETRY.** (User, 2026-08-06.) A control
  arm carries **no gameplay content of any kind**. Not one file, not one field, not "just one small
  well-guarded exception". If an arm needs a gameplay change, however small, it is **not a control** and
  must not be built by, named after, or documented alongside `-ControlOnly`.
  ❌ **THIS IS CURRENTLY VIOLATED AND MUST BE FIXED BEFORE THE NEXT COMMIT TO `build.ps1`.** On
  2026-08-06 `-ControlOnly -Config <path>` was made to also emit `common/pop_needs/00_pop_needs.txt`
  when that config carries `pop_need_weight_mult`, so that a pop-need weight experiment could run against
  vanilla instead of on top of the whole tiered mod. The *motivation* was right and the arm it produces is
  a real, useful thing — vanilla + telemetry + one declared file. **The implementation is wrong**: it was
  bolted onto the one flag whose entire purpose is to guarantee the absence of gameplay content, so the
  flag's name now lies. Warnings in the build output do not repair that — a guard is read by whoever opens
  the code, the *name* is read by everyone, and a reader who sees `{kind: control}` in a schedule can no
  longer assume vanilla. That is precisely the class of failure the 2026-08-05 wrong-arm day was.
  **THE FIX — a third arm, not a control with fluff. Not yet done:**
    1. **`-ControlOnly` gets its invariant back, enforced not documented.** It emits metadata + telemetry
       and *nothing else*, and it **throws** if handed a `-Config` carrying any content-producing key.
       A flag that guarantees an absence must fail loudly rather than quietly widen.
    2. **A separate `-Overlay -Config <path>`**, schedule `{kind: overlay, config: X}`: vanilla +
       telemetry + a **declared, enumerable** overlay. The config names which emitters may run; anything
       not on that list is refused rather than silently skipped, so the arm's content is exactly what the
       config says and is readable without running it.
    3. **It reports itself as its own thing** — `arm: overlay+<what>`, `deviates_from_vanilla` listing
       the files — and is never described as a control in a schedule `_why`, a finding, or a board.
    4. **Both keep sharing the ONE telemetry generator.** That was always the only thing arms were meant
       to hold in common, and it is what makes them comparable.
  ⚠ **The right shape is a list of content emitters that each arm opts into, not a chain of
  short-circuits.** The current bug exists because emission is a straight-line script with an early
  `exit 0` in the middle: the only way to add content to the control was to move an emitter above the
  exit, which is why a gameplay file ended up on the wrong side of the guarantee.
  ⚠ **Sessions run on 2026-08-05/06 record `arm: control+pop_needs`.** After the rename that value means
  **overlay**. Do not back-fill it into their `build_state.json` — a session artifact is a historical
  record, not a cache.
  **Why the builder owns this:** an experiment's arms must instrument *identically* or the control isn't a
  control — one generator guarantees that (verified: control and modded builds emit byte-identical
  telemetry apart from the build-timestamp comment). **`telemetry_lib.ps1` is the ONLY generator**: the
  harness used to carry a second one (`Write-InstrumentMod` in `run_observer.ps1`, writing a throwaway
  `v3_testbed_instr` mod), which had already drifted — its market line stopped at price, with no
  imports/exports/production, and it emitted no events at all — so a hand-run arm silently logged fewer
  columns than a scheduled one. It is gone; do not reintroduce a fallback generator.
  Before adding a metric, read `TESTBED_METRICS.md`.
  ⚠ `telemetry_lib.ps1` deliberately sets **no** `Set-StrictMode`: it is dot-sourced, and StrictMode
  applies to the *caller's* scope — switching it on broke the builder's own property tests.
  ⚠⚠ **NEVER edit `telemetry_lib.ps1` or `build.ps1` while a batch is running.** `run_schedule.ps1`
  rebuilds the mod **before every run**, so an edit lands in run 2 and run 3 but not run 1 — and the
  arms silently stop being comparable, which is the one failure a control design cannot survive. This
  includes edits that look cosmetic, such as bumping `$script:TELEMETRY_VERSION`. Queue them and apply
  them once the session reports SCHEDULE DONE; if a doc has to describe the new state meanwhile, say
  which session is affected (see TESTBED_METRICS' v10 note).
- **ALL measurement goes through `tools/testbed/run_schedule.ps1 -Schedule <x.json>`.** This is the entry
  point: it owns *schedule JSON → build each run's mod via `build.ps1` → run it → harvest*. **Never invoke
  the builder directly to produce test data** — that bypasses the record of what was built and why. (Calling
  `build.ps1 -DryRun` during development, to check a config still lints, is fine: it produces no
  measurements.) The `runs` list is **explicit and ordered**, so any sequence works including repeats and
  alternation (`A@1841, B@1841, A@1841, B@1846`); each run carries its **index**, and the schedule JSON is
  copied verbatim into the session folder so a result always traces back to its plan. Setups are
  `{kind: control}` (vanilla + telemetry, via `build.ps1 -ControlOnly`) or `{kind: config, config: <path>}`.
  ❌ **`{kind: control, config: <path>}` exists today and is the architectural violation flagged under
  `-ControlOnly` above** — it builds vanilla + telemetry + a pop-need weight file while still calling
  itself a control. It is to be replaced by `{kind: overlay, config: <path>}`, a third kind that is
  honestly named. Until then, any finding from such a run states its arm as **overlay**, not control.
  ⚠ **EVERY telemetry spec key must be listed in the plan entry that `Resolve-Setup` builds, or it is
  silently dropped** — the key reaches neither the builder nor the mod, and the run then looks like the
  *metric* failed rather than the plumbing. That cost a probe run on 2026-08-05 (`breakdown_dates`,
  `breakdown_tags`, `wide_dates`, `wide_tags` all emitted nothing until they were added).
  **The mod is rebuilt for every run, never cached** — builds are deterministic (same config + same vanilla
  ⇒ same output) and take ~1 min, whereas caching would hide a setup that isn't reproducible. The only
  nondeterminism in a build artifact is the timestamp the builder stamps into the mod `name`, so any
  "did this rebuild change?" check must exclude it. `{kind: recipe}` (ordered solver steps) is deliberately
  **not** implemented: a recipe encodes balance *methodology*, so its vocabulary dies with the next BE
  rework — author a config file and reference it instead. Specs live in `tools/testbed/schedules/`,
  results in `tools/testbed/sessions/` (gitignored, **and never deleted** — see below) — **one results
  root**; the older `runs/` and
  `batches/` roots are gone and stay gitignored so a stale folder can't drop game logs into the tree.
  Each `mod_sched_<setup>/` it builds is deleted when the schedule ends (build output, reproducible from
  the setup's config; `-KeepMods` keeps them). The session folder ends up as: `schedule.json` +
  `session.json` + `session.log` + **`markets_all.tsv`** (all runs, each row prefixed `run_index` +
  `setup`), and one flat `runNNN_<setup>/` per run.
  **Interactive control** — the runner reads keys, so start it from a console you can type into (or let it
  be spawned into its own window): **`[p]` pause · `[r]` resume · `[s]` stop after this run · `[x]` stop
  now**. Pause suspends the watchdog *and* crash detection, so a paused session is never mistaken for a
  crash; the runner cannot pause the *game*, you do that yourself. On `[r]` it checks whether
  `victoria3.exe` is still up: if so it just keeps watching, if not it resumes that run from its last
  autosave. **Crash policy:** an unexplained exit with no keypress within 60 s is treated as a CTD and
  resumed; **3 crashes from the same autosave** ⇒ permanent failure, move to the next run; **3 crashes
  before the first autosave ever exists** ⇒ loud alert and the **whole schedule aborts**, because repeated
  deaths that early mean the mod itself is broken. Exit codes: `0` ok, `2` stopped by user, `3` fatal.
- **⚠️ TESTBED SESSIONS ARE NEVER DELETED — not even obsolete ones.** Everything under
  `tools/testbed/sessions/` is **permanent**. This is the one exception to "gitignored ⇒ throwaway":
  it is gitignored because it is bulky and binary-ish (game logs, minidumps), **not** because it is
  disposable. Do not delete a session during a cleanup, a refactor, a results-root consolidation, or
  because a design change made the run's config obsolete. If disk becomes a real problem, **ask the
  user** and propose archiving (zip the session, or drop only `logs/`, `logs_live/` and
  `_settings_backup/` while keeping `markets_all.tsv` + `events.tsv` + `meta.json` +
  `build_state.json` + `schedule.json`) — never a silent `Remove-Item`.
  **Why.** A session is not reproducible measurement, it is a *historical observation*: 26 h of game
  time, a specific game version, a config that may no longer exist, and a specific set of RNG
  playthroughs. Re-running never reproduces it — different seeds, and after a patch a different game.
  An obsolete run is still the only evidence of what the economy did under that design, which is
  exactly what you want when a later result looks strange.
  **This rule is written in blood.** The `runs/`→`sessions/` consolidation (`b6f77cb`) deleted the
  legacy roots, taking with them the **n=5-per-arm, 1836→1935 tiering-vs-vanilla batch** —
  `20260729_101106` and `20260729_233413`, ~26 h of runtime (FINDINGS.md F1/F2). Its conclusions
  survived only because they were reconstructed from a chat transcript, and only the parts that had
  been *printed* at the time: the underlying `markets_all.tsv` is gone, so any question not asked
  back then can never be asked of that batch again.
  **And there is no backup.** `sessions/` is gitignored, so deleted results are NOT on GitHub, not
  in any branch, and not in the reflog — `git log --all` over `runs/` returns nothing at all.
  **Gitignored ≠ backed up.** Deletion here is unconditionally final.
  Hence the companion rule: **write the conclusion into `FINDINGS.md`, with the numbers in full, as
  part of the same pass that produces it** — don't leave the finding living in the session folder or
  in chat.
- **Record every measurement batch in `FINDINGS.md`.** After a run batch, append (or update) a finding
  there with: the claim + effect size, the arms/n-per-arm/span/dates and the actual numbers, the
  session folder, the confidence, and an explicit **"what it does NOT say"**. Copy the tables in
  rather than pointing at the session — findings must outlive their raw data, their config, and the
  game version they ran on. Keep it honest about limits: a stated confound (F2's time-of-day
  ordering) or an unmeasured question (F1's per-good dispersion) belongs in the doc, not dropped
  because it complicates the headline.
- **Published UI snapshot — REGENERATE AND REPUBLISH IT WHENEVER THE SHEET CHANGES.** Once a snapshot has
  been published in a session (`tools/bundle_ui.mjs` → Artifact), it stops being a one-off and becomes a
  live deliverable: the user is reading it while you work, and it is the *only* view they have when away
  from this machine. So after **any** change that alters what it shows — a solver `--write`, a `build.ps1`
  run, or an edit to `ui/builder.html` / `ui/econ.js` — regenerate it and **republish to the SAME artifact
  URL** (pass the same file path; do not mint a new one). Do it unprompted, in the same pass as the change,
  exactly like the status board.
  ⚠ **Regenerate from the repo copy, not the scratchpad one.** `bundle_ui.mjs` writes
  `balance_ui_snapshot.html` at the repo root; copy that over the published file path before republishing.
  Republishing the scratchpad copy without refreshing it ships the previous build — which has happened, and
  is invisible from the outside because the page still looks current.
  ⚠ **STAMP IT IN UTC, EXPLICITLY.** Both the snapshot and the status board carry their generation time as
  **`yyyy-mm-dd, HH:MM UTC`** — the zone spelled out, not implied, and to the minute. A bare timestamp on a
  detached page is read in the reader's own zone and can be hours out, and telling someone how stale the
  thing is is the entire job of the stamp.
  ⚠ **SHOW that it happened.** Report the regeneration in the reply — the banner timestamp, or that the
  published copy matches the repo copy. A regeneration buried inside a chained command is invisible to the
  reader, who then has to take it on trust or ask. This has already gone wrong once: `bundle_ui.mjs` was run
  through `| head -1`, its output began with a blank line, and the confirmation was swallowed, so a snapshot
  that HAD been regenerated looked skipped.
  ⚠ **A stale snapshot is worse than none.** It carries its own timestamp and reads as authoritative, so a
  reader has no way to tell it is describing an economy that no longer exists. If you cannot regenerate it
  (build broken, mid-refactor), say so rather than leaving the old one standing.
- **Status board — REBUILD it UNPROMPTED, never maintain it.** Publish a status board as an
  Artifact, and **republish it to the same URL the moment the picture moves — during the session,
  not at the end, and without being asked.** Closing an item, hitting a blocker or handing a
  decision back are all triggers; waiting to be told defeats the point, because the user is
  reading it while you work.
  **Never commit it.** It is a view, so a committed copy rots into a stale second source of truth.
  Write it to the scratchpad (outside the repo); `.gitignore` carries `status_board*.html` as a
  safety net if one is ever written inside. The **template** at
  `tools/status_board.template.html` IS committed — it is the reusable shell, holds no state, and
  carries the section rules as comments. Start from it.
  Closing an item, discovering a blocker, or deferring something to the user all change the board;
  a board that still shows yesterday's state is worse than none, because the user is reading it.
  Restructure freely: entries move between sections, sections empty out, the tally changes. It is a
  *view*, regenerated from current state; it is **not** a document that accumulates. Do not carry numbering,
  wording or entries across sessions, and do not commit it — the durable records are `FINDINGS.md`
  (results), `TESTBED_METRICS.md` (what the instrument can do), `MODDING_NOTES.md` (engine gotchas)
  and `BUGS_AND_FIXES.md` (root causes). If a board entry says something not captured in one of those,
  **the doc is missing it — go fix the doc**, because the board is disposable and the doc is not.
  Build it from these sections, in this order:
    1. **Tally** — blocked / open / awaiting-the-user / closed counts.
    2. **Open work** — one entry each, with *goal, blocker, consequence, next step*. An entry with no
       concrete next step is not open work, it is a wish; drop it or turn it into one.
    3. **Waiting on you** — items where the next move is the user's (a deferred decision, a
       recommendation of mine they have not ruled on). Say plainly what is being asked.
    4. **Verified working** — the solid ground, with the numbers that make it checkable. This section
       is what stops a board of problems reading as a project in trouble.
    5. **Closed** — a compact table.
  Two rules on wording, both learned the hard way:
    - **State outcomes in plain language, never as a reference.** "F3, F4, F5" is not an outcome; "the
      BE ladder does not yet produce specialisation" is. A reader should never have to open another
      file to learn what happened.
    - **Say where the id came from.** Session task ids (`#4`, `#11`) do not survive into a new session,
      so a board that shows them must say so, or it silently invites the user to cite a dead number.
- **Missing-reference cataloguing (the `MISSING_*` family).** Replacing/splitting a vanilla entity can make
  vanilla script or the building's own fields stop matching. **We catalogue every such case rather than fix it
  piecemeal — one strategic batch pass later.** Document *all* missing references this way, one focused
  `MISSING_*` doc per class:
  - **Relocated main-PM references** — external `production_method = <our vanilla_pm>` in vanilla
    events/JEs/effects/triggers (`is_production_method_active`, `activate_production_method`, …). The PM still
    exists but isn't active on the split building, so the check errors+returns false. → **`MISSING_PM_REFERENCES.md`**,
    AUTO-generated by `tools/audit_pm_refs.ps1` (re-run after any tiering change/patch).
  - **Dropped building conditional fields** — a conditional `ai_value` block, `potential`, `should_auto_expand`,
    … inside a vanilla building we regenerate but flatten/omit. Fully in our control (directly fixable), just
    deferred. → **`MISSING_BUILDING_CONDITIONS.md`** (hand-maintained).
  - **Narrowed building references** — `has_building = <base building>` (457 vanilla uses) now matches only
    Tier 1, missing owners who built only higher tiers. Not a broken reference (the key survives via the Tier-1
    alias) but a completeness gap — and **gameplay-significant, not just flavor**: e.g. **company mandates,
    monopolies, and similar mechanics latch onto our Tier-1 building, not all tiers of the industry** (which
    would make more sense). The **same "make our tier buildings eligible" strategic fix** resolves it and the
    PM-reference class together. Not separately enumerated.
  When an in-game run surfaces a new case, **append it to the right `MISSING_*` doc** (or add the PM to the split
  set and re-run the audit) — don't fix it inline.
- Read `MODDING_NOTES.md` before touching metadata, load order, or icons.
- The only hand-maintained file inside `mod/` is `.metadata/metadata.json` — and even there the
  builder suffixes the mod `name` with `(built yyyy-MM-dd HH:mm)` each build (stripping the prior
  suffix so it never accumulates), so the Paradox launcher's mod list makes the freshest build
  obvious. The mod `id` stays fixed, so playset membership is unaffected.

## Deployment / testing

`build.ps1` deploys a **real copy** of `<repo>\mod` to
`Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul` (via `robocopy /MIR`) at the end of
every build. A directory **junction does NOT work** — the Paradox launcher won't traverse it and
shows the mod as ~48 bytes; a real copy is required. Pass `-NoDeploy` to skip. After a build,
restart the Paradox launcher if it was open (it only rescans local mods on startup), then add
"PM and Tech Rehaul" to a playset to load it.
