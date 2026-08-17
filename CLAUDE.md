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

## ⭐⭐⭐ THE ANCHOR PRINCIPLE — WHAT AN ERA *MEANS* (user-ruled 2026-08-12, GOVERNING)

**Read this before touching the tech tree, the era ladder, or any tier's era.** It is the intent the
rest of this section implements, and where the two disagree, this wins.

1. **SIX of our eras (0–5) ride on FIVE mechanical game eras.** The game has at most five, and they
   exist only as machinery — the ahead-of-time penalty and the era base cost. The mapping is
   **our 0 AND our 1 both sit in mechanical era 1**; thereafter one-to-one, our 2→2, 3→3, 4→4, 5→5.
2. ⭐⭐ **EACH OF OUR ERAS HAS AN ANCHOR YEAR, AND THE ANCHOR HAS A NARRATIVE MEANING: at the anchor
   year, a TECHNOLOGY LEADER should hold about HALF of that era's technologies.** That is the
   definition of an era in this mod. It is not a label and not a decoration.
3. **Era 0 is anchored well before the 1836 start; era 5 slightly after the 1936 end.** Both are
   deliberate. The consequence is intended: **even an experienced player should finish a whole tree
   only when unusually lucky, playing a strong nation, and probably neglecting the other trees.**
4. ⭐⭐ **THE ANCHORS ARE AUTHORITATIVE. THE TECHNOLOGIES AND THE INDUSTRIES ARE CALIBRATED TO THEM,
   NEVER THE REVERSE.** If the tree's dates and the anchors disagree, the tree is wrong. A substantial
   re-dating or re-banding of technologies is an acceptable cost of meeting them.
   ⚠ This overturns a reading recorded on 2026-08-12 that treated the dated content as fixed and the
   anchors as the outlier — that had it backwards.
5. **It coexists with the vanilla-fidelity premise by dividing the timeline.** At **1836** we hold
   composition and distribution close to vanilla. **After 1836 only GDP** needs to stay near vanilla;
   nothing else is bound by it, and the tech distribution in particular is expected to diverge.
6. ⚠ **The balance UI's economic scenarios deliberately break rule 2, and that is correct.** A scenario
   at era N contains tier-N industries of *every* type, even though the principle says half that era's
   technology should be unavailable. A scenario is not one country: it is an **amalgamation of several
   large technology leaders, each ahead in a different subfield**, and it models **no international
   trade**. So it must contain every chain to be solvable. Do not "fix" this to match rule 2.

## THE FIVE-ERA LADDER (current method — supersedes the BE targets)

⚠ **The heading is inherited and imprecise: there are SIX eras (0–5), not five.** Era 0 is the
pre-industrial rung that carries no unlocking technology at all. See the anchor principle above.

The mod has its **own technology eras**, anchored at **1750 / 1830 / 1870 / 1900 / 1925 / 1940**
(user-ruled 2026-08-12, superseding ~1700/1750/1850/1900/1925/1940) — deliberately wider than the game's
window at the front and **contracting** towards the back, because technical progress accelerates after
the industrial revolution. Each tier's `tech_year` must fall in its era's **band** (boundaries
**1790 / 1850 / 1885 / 1912 / 1932**, the midpoints between anchors), and **no industry has two tiers on
one era** — `build_era_ladder.mjs` now THROWS on either, at authoring time, because nothing downstream
compared a tier's authored era against its own date.
**105 tiers over 22 industries: 66 real + 39 invented**, 11/17/19/21/21/16 per era (modelled but NOT
emitted while the game has no unlocking technology for them — the builder gets a filtered config,
`ui/data.js` gets the complete one; the count is `build_era_ladder.mjs`'s own summary line — earlier
"89/67/22" and "100/67/33" here had gone stale against the spec).
⚠ **An invented tier is marked by having NO `vanilla_pm`, not by `model_only`.** It used to be
`model_only`, which the tech-tree step clears by design — after which the ladder builder's idempotent
drop matched nothing and it threw on the first industry, i.e. the pipeline's FIRST stage could not run
at all. A permanent all-new tier therefore belongs in the spec's `invent[]`, never in `eras[]`.
⚠⚠ **The re-band is written into the SPEC but the CANONICAL config still holds the 100-tier ladder**,
held until the research-events batch B has built (`config/mod_config.era6.json` carries it meanwhile,
reachable through **`MOD_CONFIG=`**, which all three era tools now honour — `era_solver.mjs` used to
hardcode the path while `econ_host.mjs` honoured the override, so a redirected run read one file and
wrote its solved recipes into the other). The full table is in ROADMAP step 1b.
⭐⭐ **EVERY TIER ALSO CARRIES `tech_year` — THE DATE GATE (§10.44, user-ruled 2026-08-09).** The year
the SLOT's technology was first commercially deployable, transcribed from the spec's own dated notes
(date the slot, not the vanilla PM's decorative name), stamped by `build_era_ladder.mjs`, which throws
on a missing date or an arrival-order violation. A scenario places a tier iff `tech_year ≤ its calendar
year` — replacing the "leading rung" era arithmetic, which had put **~50–58% of tier-output value on
NEXT-ERA technology in every middle scenario** (census: level-parity leading rungs, tooling 105/105 at
1900). "Leading" survives only as a CLASSIFICATION (a present tier with era > scenario era reports as
the lead rung, target +20%); placement is the calendar's. The debut guard and its exemption list are
retired to the legacy path (`ERA_DATE_GATE=0`): railway 1825, steam shipyards 1843, engines 1820 and
power 1900 all stand on their own dates. Vanilla PMs stay era-gated (a named scope cut). Some ladders stop early, recorded per industry as **`ladder_end`**: `plateau` (food,
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
node tools/build_era_ladder.mjs --write   # structure: eras, tech_year dates (§10.44), invented tiers, ×1.5 ladder
node tools/era_solver.mjs --write         # refresh era_prices.json (the FIT the scenario solve seeds from)
node tools/era_scenarios.mjs   --write    # THE solve: prices, volumes, counts, pops, army (~8–20 min:
powershell -File tools/build.ps1          #   3 outer passes + final-pass integer polish, §10.42.4;
                                          #   faster since §10.48 — the settled PM loop skips ~half the work)
```
`tools/era_solver.mjs` is the **balance-only reference view** (margins alone, no scenario) and writes
`config/era_prices.json`; `tools/era_scenarios.mjs` is authoritative and overwrites its volumes.
⚠ The FIRST scenario solve after a ladder rebuild prints the RECIPE MIX ⚠ (re-minted tiers lose their
frozen ratios; its own `--write` re-freezes them) — the SECOND run is clean (see the fixed-point note).

**Why prices are realised rather than prescribed.** Deriving a price path from profit margins alone
produces numbers no market composition can reach — steel at 150% of base in era 1 is unreachable because
an era-1 economy has *no steel consumer at all*. So the solver never assigns a price. It reads what the
order book produces (the game's own formula, on the scenario's own orders) and moves the one lever it
has, **building counts**, until the profit targets hold at whatever prices result.

**Targets — A SCENARIO HAS TWO TUNED RUNGS, NOT ONE, AND THEY HAVE DIFFERENT TARGETS.** A scenario may
hold a **LEADING** rung (a present tier with era > the scenario era — since §10.44 it is there only when
its `tech_year` has actually arrived, not by the retired `lead = [0,2,3,4,5,5]` era rule, which now
matters only on the `ERA_DATE_GATE=0` legacy path) and a **DOMINANT** tier (era N — the workhorse):
- **leading `TG.current` +20%** · **dominant `TG.minus1` +5%** · **one era stale `TG.minus2` −20%**.
- A **plateaued** industry's last tier holds `TG.plateau` **+5%** forever.
- **Shipyards carry a further −30pp on all of them**, because none of their income from naval ship
  construction is modelled.
- Extraction and agriculture have a **band**, not a target (§10.22).
⚠⚠ **THE ERA-APPROPRIATE TIER IS THE DOMINANT ONE AND ITS TARGET IS +5%, NOT +20%.** The old five-era text
here read "era-appropriate +20%, one era stale −5%, two eras stale −30%", which describes a ladder whose top
rung present was the era-appropriate one. That is no longer the shape, and the stale wording outlived the
change: the report graded the dominant tier against +20% while the solver aimed it at +5%, a **systematic
15pp phantom miss in every era**. Fixing the yardstick alone moved the objective from **5/76 to 70/84 within
8pp** with the economy completely unchanged (BUGS_AND_FIXES, 2026-08-08).
⚠ **The LEADING tier is currently scored by nothing**, and cannot be scored in the per-era report: its
recipe is solved in the *next* era, so at report time it is not final. That needs a post-solve pass over all
six eras — see the same entry.

**⭐ THE GOAL A SCENARIO SET MUST CLEAR IS "ILLOGICALITY" — BALANCE_FRAMEWORK §10.11.** Those profit
targets are a *means*; illogicality is the end, and it is what says whether the tech ladder actually
works. Three faults, counted per industry per scenario and summing: (1) the era-appropriate tier **loses
money**, (2) a **two-eras-stale** tier still turns a profit, (3) the ladder is **inverted** — the newest
tier earns less than the one below it. Acceptable: **~0** for (1) and (3), **in the teens** for (2),
**excluding shipyards and art academies** (both have targets they cannot meet by construction).
`tools/era_scenarios.mjs` prints the count per era with the offending industries named.
⚠⚠ **THE HEADLINE COUNT IS THE FINAL-STATE ONE** (BUGS_AND_FIXES 2026-08-09): the in-era line reads the
leading rung's PROVISIONAL recipe and under-counted by ~40 points (52 reported vs 94 replayed on the
shipped state). Quote the `FINAL-STATE ILLOGICALITY` line, never the per-era sum alone — and no profit
figure before 2026-08-09 is comparable to later ones without adding shipyards back (they are excluded
from the totals now, reported on their own line, like gold).
**Current state under the ruled set (§10.42.4) + the 1780 prune + the ELECTRICITY PASS (§10.43, 2-coal
ruled) + the DATE GATE (§10.44) + the WEDGE and the 1780 RULINGS (§10.45/§10.46) + the MACROSCENARIO
LAYER with DERIVED BOUNDS, the minCount-for-refs fix, and the INFRA SUBSIDY TOLERANCE
(§10.47/§10.47.2/§10.47.4, shipped 2026-08-09) + THE HYSTERESIS SET (§10.48, shipped 2026-08-10 —
`ERA_PM_MINGAIN` 0.10 + `ERA_PM_FREEZE` best-of-cycle freezing as defaults, ceiling guards on breach
SETS, breach-clearing polish) + THE CONSTRAINT-SET REGIME (§10.49, user-ruled 2026-08-10 "ship this" —
profit BAND +5…+50% in place of the +5% target, the MANDATED PRICE-DECLINE ladder, the strict INCREASE
mechanism, and the ERA_PM_LIFT dominance re-open) + THE RECIPE RATCHET (§10.50, 2026-08-10 — the
STRONG form ships: a later tier's base recipe may not be less input-efficient at base prices than
the tier below; the census went 31/78 violated → 3 rounding hairliners, and the INVERTED family
collapsed 21 → 6): final-state illogicality 57 (54 excluding shipyards), per era 3/5/7/12/15/15,
families loss 12 / stale-profitable 36 / inverted 6 · losses £138k/wk ≈ 0.7% of net · net £20.1M/wk
(the band regime's +59% over §10.48's £12.6M is the ruling's point: real margins, and the stale
family carrying the fault count is the ruled trade) + THE ARMY IN THE FIXED POINT (§10.51,
user-ruled 2026-08-10 — ERA_ARMY_FP: battalions and war-goods prices solved jointly inside setArmy,
killing the cobweb that shipped 1.8–6.8% army shares against the 5% premise; eras 1–5 now hold
±1pp of the consistent 5.3% on every seed, era 0 the flagged 1780 exception; UNDROP-ON-BREACH makes
the ceiling outrank solvency in both directions; per-era ARMY report lines added; §10.51.1: the
recheck runs TWICE, the second time after macro sparing only its floor-grown keys, and re-verifies
the §10.22 upper band — the five-item one-shot audit is ruled: SoL/wage premise and e0 granularity
ACCEPTED, block-lists left by ruling, the post-macro gap AND the tuner single-pass both FIXED —
§10.51.2: free entry re-runs after macro with a fresh futility slate and a macro guard; ⚠ dominant
rungs off the band 17→23.5pp is the army premise × macro caps × band COLLIDING on the war
industries, an honest residual, not a defect) ·
ensemble (full stack) 65/61/61 (58/54/55, mean 55.7) · £116–276k · £20.0–20.3M · macro 20/19/19 ·
**THE CEILING IS CLEAR IN ALL SIX ERAS OF ALL THREE SEEDS** · PM settled 5/6 (era 2's steel
bistables are the exception) · ⚠ the
§10.48 figures (68/58 · £156k · £12.6M ·
ensemble 68/64/62 (58/54/51) / £156–218k / £12.6–12.7M / macro 15/17/15) are the LAST OF THE TARGET
REGIME — comparable to each other, not to these ·
**PM CHOICE SETTLES in every era of every seed**, cross-seed phase noise 137→50 selections, freight
adoption monotone · the same code without the two knobs reads mean ill-excl 64.0 and losses £214–334k,
so the set is a real gain, not jitter (§10.48.1's table holds all ten arms) · the macro residual
FAMILY structure below persists under the §10.49 regime (whose own list is 19: the war industries
join the over-cap block — explosives@1900/20/45, arms@1900, their army-fed margins competed by free
entry — and railway@1945 reads 1.29% against its 2.05% floor, still the closest approach the model
has made; the per-family NUMBERS below are the §10.48-era readings) —
four named families (§10.47.3): the TRANSPORT GAP (railway 0.15/0.33/−0.01/1.88%
mapped vs derived floors 1.75–2.75% from a real ~7–11%; wages and target handicaps are MEASURED off
the table — F47: vanilla adopts rail freight against the wage arithmetic, 58% of raw producers by
1912 at ×1.4-flat wages, and the recipe-reaching handicap made railway value-poorer — and FREIGHT IS
RULED ACCEPTED AS-IS, §10.47.5: "vanilla doesn't immediately switch either", so the gap is an
ACCEPTED residual, not open work — and the 1920 cycle swing that used to ride on it
(2.13/1.70/0.84/−0.01 across same-design runs, the unpinned bistable PM cycle) is GONE since §10.48
pinned the phase: adoption is monotone in every seed), the late-era
NEW-ECONOMY UNDERSIZES (automotive/electrics/power short of real-history floors — V3 pop budgets
cannot fund them at real scale), the DEBUT WALLS (steel/motor@1836, electrics@1900 — §10.29 family,
RULED TOLERABLE §10.47.5: every one verified to have consumers, and their denominator drag is
−4.7%@1836 / ≤1.9% later, inside the corridors' noise in the flattering direction), and hairliners;
extraction's cap is VERIFY-ONLY structural red at every era (model
18–52% vs real 9.8–18.6% caps — V3 books value at the pithead) · the INFRA SUBSIDY TOLERANCE
(§10.47.4, vanilla's must_have trio railway/port/power may book −10% before fault or shrink, scoring
only, mirrored in econ.js LADDER_LOSS_FLOOR) ships with an IMPLIED SUBSIDY BILL of ~£0 (£1k/wk =
0.02% of GDP at 1920 only) and revived railway@1900 to 0.33% · the layer caught seed 9 shrinking 1920
textile to a 0.17% stub — the "no dead industries" bound working on its first ensemble ·
calendar-anachronistic output 0% by construction; 1836's honest era-2 share 46.6% vs vanilla's
measured 45% · hardwood TRADE-SUPPLIED where ruled (every other good domestic — the condition-based
version shipped an all-imports iron economy and is recorded VOID, §10.46.1) · ownership professions
follow the MEASURED wedge (F46), and every profession share passes its §10.47 bound in every era ·
the futility guard knows which price pin it is looking at, and the dye placeholder pin is
gone.** Future A/B work compares against THESE numbers. The pre-campaign state on
the same metric was 94 (84) and £868k losses. 1780's remaining faults (furniture, tooling, paper,
arms, artillery in the current run) are honest tiny-market statements — industries with real
buyers, each losing £86–300/wk at one floored level.
⚠ Older counts in this file's history (43/30, 52/47) are the in-era metric on the old defaults — void for
comparison on both grounds.
⚠ **Two levers that lower the count are REJECTED and must stay rejected**: `ERA_NO_BUYER=1` buys its gain
with §10.32.3's known defect, and deadband retuning is a spike in a jagged band (§10.42.2's calibration:
±10 faults / ±250k losses / ±0.4M net from no-op changes on the old defaults — design changes are judged
on 3-seed ensembles, `ERA_JOINT` 8/9/10).
It is **live in the balance UI** as the **Ladder check** panel, from ONE shared implementation
(`ladderFaults()` in `ui/econ.js`, called by both the UI and the solver). It scores only the buildings a
scenario actually CONTAINS — an absent industry or a tier at Number 0 is never a fault and never the
comparison partner for one — so zeroing things out while tinkering can only lower the count (§10.17).
✅ **The write cycle is a STRICT FIXED POINT** (BALANCE_FRAMEWORK §10.25, closed 2026-08-05): config,
presets and the printed report come back byte-identical after every `--write` → re-run. It got there by
making the recipe MIX come from invariant sources — the run prints `RECIPE MIX: own 66 · below 23 ·
frozen 10` and warns if any tier ever reads its mix from the previous write. ⚠ **One EXPECTED transient:**
`build_era_ladder.mjs --write` re-mints the invented tiers, which discards their frozen `input_ratio`, so
the FIRST solve after a ladder rebuild prints the ⚠ (those tiers fall through to their seeded inputs) and
its own `--write` re-freezes them — the SECOND run is clean and the fixed point holds from there. A ⚠ on
any later run is a real defect.
✅ **The count/price loop now CONVERGES** (§10.28): it used to limit-cycle forever at a 19–94pp residual,
because a proportional controller cannot settle integer building counts (a good wanting 6.4 levels toggles
6/7, worth ~20pp of price). A **deadband with hysteresis — stop chasing at 8pp, resume at 15pp** — fixed
it. ⭐ **Raw goods now carry a ±30pp BAND instead** (§10.42.4, user design): inside it the controller
leaves them alone entirely, so raw prices float with scarcity rather than being steered back to base;
nothing prescribes a raw price path (the drift idea is REJECTED).
⚠ **The response surface is JAGGED and now CALIBRATED** (§10.42.2): no-op controls swing ±10 faults /
±250k losses / ±0.4M net, so design changes are judged on 3-seed jitter ensembles (`ERA_JOINT` 8/9/10),
and the final-pass **integer polish** (±1-level greedy moves on the global objective) attacks the
amplifier at its source.
✅ **PM choice now SETTLES — in all six eras of all three ensemble seeds (§10.48, shipped 2026-08-10).**
The limit cycle was killed by two levers together: **hysteresis** (`ERA_PM_MINGAIN` default 0.02→0.10 —
the response curve is clean and 0.10 is its optimum; most churn was near-identical method pairs trading
places on noise-sized margins) and **best-of-cycle freezing** (`ERA_PM_FREEZE`, default ON: a PMG that
RETURNS to a method it held after an earlier joint round is pinned at that phase — it just won the score
comparison at current prices; a pin is lifted if its method goes illegal or touches a ceiling-breached
good). Cross-seed PM phase noise fell 137→50 differing selections, the freight/railway phase flapping is
gone (monotone adoption in every seed), losses fell ~35%, and the optimiser work roughly halved.
⚠ **Freezing without the hysteresis is HARMFUL** (it pins a third of the churning economy at arbitrary
phases — measured, §10.48.1); the two ship together. ⚠ An early PM fixed point must not starve the
continuous half: the joint loop always spends its full round budget, skipping only the optimiser.
⚠ **THE LARGEST REMAINING BLOCK IS NOT A BALANCE PROBLEM (§10.29).** Every insolvent industry is *floored
at 1 level* and pinned at the 25% price band edge.
⚠⚠ **THE STEEL HALF OF THIS IS VOID — "era-1 steel has ZERO buyers, its first consumer is an era-2 tier"
WAS TRUE IN AUGUST 2026 AND IS NOT TRUE NOW** (re-measured 2026-08-13). The date gate and two re-bandings
moved `motor` e1, `shipyard_steam` e1 and `arms` e1 into era 1, and all three eat steel: the shipped
1836 scenario reads **buy 112 against sell 78** — demand EXCEEDS supply and the price sits at 100%, not on
the floor. Do not cite the zero. ⭐ It is also **contradicted by the game**: a melted vanilla 1838
gamestate has a real steel market of **1387 units/wk**, consumed by tooling workshops (90.5%, 56 levels)
and motor industry (9.5%), against 1063 produced — see FINDINGS **F54**. The `ERA_PRUNE` default
`steel@0` still stands, because at **1780** there genuinely is no steel consumer of any kind.
The rest of the block is unaffected: era-3 telephones read buy 18 against sell 72 because they share `popneed_communication`
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
it. Enforced greedily and minimally (drop the worst, re-converge, look again), **gold — see below** (one-sided
order book by construction). ⚠ **It can collide with the ceiling below, and the ceiling wins**: dropping the
era-1 iron mine left 1836 with 704 iron demand and zero iron supply, so a drop that breaches the ceiling is
undone and the building is kept and **reported by name**. ⚠ Each round must *begin* from a converged state —
checking and then settling lets the state drift back over the line after the check.

**⭐⭐ GOLD IS NOT IN THE MODEL AT ALL (§10.40.5, 2026-08-08).** `building_gold_mine` and `building_gold_field`
are in `EXCLUDE_REF`, so **no scenario contains either**. In the real game gold is minted into the treasury;
this model has no treasury, so gold is a good with producers and **no consumer whatsoever** — its order book
is one-sided by construction, its price sits pinned at the 25% floor in every era, and every gold mine runs
at about **−62%** regardless of what the rest of the economy does.
⚠ **It was exempted four separate ways before it was removed** — `SKIP_GOODS`, `NO_BUYER_EXEMPT`,
`SKIP_TARGET_BLD`, and §10.18 above — and it *still* leaked into the first profit metric that widened its
population, supplying **£2.28M of loss against £0.48M from the whole rest of the economy** (4.7× the signal;
92% of era 4's reported losses on its own). **A quantity that needs a special case everywhere it appears does
not belong in the model.** Its workforce is negligible and the job-pool rescale absorbs it.
⚠ Do not "fix" gold by giving it a buyer, a price floor or another exemption; it is out, and the
`auNet`/`auLoss` line in `profitTotals` is kept purely as a **tripwire** that prints if one ever returns.
⚠ **The USA — which these scenarios are referenced against throughout — has ZERO gold deposits in vanilla.**
The right number of gold mines here was never "few", it was none.

**⭐⭐ SCALE LIMITS — HARD SOLVER CONSTRAINTS on building counts (§10.40.6).** The count controller has no
notion of a resource deposit, so a good whose price keeps asking for supply keeps getting it. `SCALE_LIMIT`
bounds it: **whaling 30 · fishing 100 · each ore/logging building 1000 · each plantation TYPE 300 ·
non-subsistence agriculture combined 3000**. The first four are per-building clamps in `applyCounts`; the
agriculture bound is **joint**, so an over-total scales every farm/plantation/ranch down together and
preserves the crop mix the price feedback chose. Per plantation TYPE, because 400 tea plantations is
implausible even where the total acreage is not.
⚠ **Judgement calls, stated as such** — deliberately NOT derived from vanilla's `capped_resources`, which
distinguishes *potential* slots from slots *exploitable at a given date*, and reading one as the other is
how such a check becomes confidently wrong.
⚠⚠ **WHALING IS WHY THIS EXISTS.** It produces **oil** and is **ungated by technology**, so the controller
used it as an unbounded substitute oil source exactly when oil demand exploded — the count ran
**2 / 19 / 1 / 9 / 47 / 440** across the six eras, when whaling was historically in steep **decline** by
1945, so 440 was the wrong sign as well as the wrong magnitude. The other bounds are guardrails; this one is
a fix. Also caught: fishing 106 at 1920 and iron 1 251 at 1945.
⚠ The report's **SCALE LIMITS** line is a **verification, not a warning** — the caps bind during the solve,
so a breach printed there is a bug in the constraint rather than a property of the economy. It also names
anything sitting *at* a cap, since a binding constraint is a fact about the scenario worth seeing.
⚠ The verification **skips subsistence buildings** (they are sized from the peasants, never capped) — it
used to count `subsistence_fishing_village` against the commercial fishing cap and printed a phantom
"fishing 102 BREACHED" the moment the wharf sat at 100 (BUGS_AND_FIXES 2026-08-09).

**⭐⭐ GDP IS `52 × weekly VALUE ADDED`, MEASURED — NOT GROSS OUTPUT (FINDINGS F45).** Value added = building
outputs − building **inputs**, at market prices; pops and trade are on neither side, because value added is a
production-side quantity. Confirmed against the `gdp` series three vanilla melted savegames persist, read
beside those same saves' `input_goods`/`output_goods`: **52.44 (1901) · 51.44 (1912) · 49.94 (1920)**.
⚠ **Gross output is a MOVING TARGET** — it double-counts every intermediate, so its ratio to GDP falls
**×48.5 (1836) → ×36.7 (1935)** as chains lengthen. Anything calibrated on gross output is calibrated against
a quantity whose meaning changes across the very period the ladder spans; that is why this exists.
The **army (5%)** and **construction (15%)** budgets are shares of GDP, rebased off gross output. Reference,
measured off a vanilla 1901 gamestate — construction's goods bill as a share of GDP: FRA 20.1% · RUS 19.9% ·
USA 15.3% · GBR 14.1% · BEL 8.8% · JAP 4.5%. Implemented once, in `ui/econ.js`'s `scenarioValueAdded()` /
`scenarioGDP()`, and shown in the UI's scenario summary as GDP and GDP per capita — plus two
READ-ONLY chips (user, 2026-08-10): **army/GDP** and **constr/GDP** share, recomputed on every
change, on the solver's own self-inclusive basis (both bills sit in `inAgg`, so the VA nets them
off). Era-preset targets: army 5%, construction the §10.42.4 ramp. ⚠ The audit that shipped with
them (§10.50.2): construction tracks within ~1–2pp except 1780; **the army does NOT hold its 5%**
(1.8–6.8% across eras — battalions are sized mid-solve and war-goods prices move afterwards; e3's
1.8% is the same defect as its insolvent war industries, one feedback loop seen from two sides).

**⭐ LOSS-MAKING MANUFACTURING SHRINKS (§10.38, semantics updated by §10.42.4).** Raw producers shed levels
(§10.18 via `ERA_RAW_SHRINK`); manufacturing had no downward rule at all, so a loss-maker sat at whatever
size the job-pool rescale gave it. Now: converge, take the worst loss-maker — **stale rungs first**
(`ERA_SHRINK_STALE_FIRST`, user directive: obsolete capacity is the first victim, era-exact the last
resort) — cut **coarse-to-fine** (`ERA_SHRINK_COARSE`: ~5% of levels while worse than −10%, one level near
the boundary), **CAP** it there so the rescale cannot undo it, re-converge, look again. A tier stops at
**one level** — "unprofitable" and "absent" are different statements, and §10.17 stops scoring a tier at
zero anyway. The cap is what makes it stick: counts are the DEPENDENT variable (full employment by
construction) and an uncapped cut regrows on the next settle. **This redistributes the workforce; it
cannot shrink it.** Shipyards carry their −30pp handicap on both the test and the comparison, or the rule
cuts them first every era at a margin that is, for a shipyard, par. Revertable: `ERA_SHRINK_LOSSMAKERS=0`.
⚠⚠ **`ERA_SHRINK_STEPS` IS A SAFETY NET, NOT A BUDGET (default 6000)** — the loop stops on its own
(`if (!worst) break`). It was 60 (a budget that bound only in era 5, §10.38.2), then 2000, which the outer
iteration made a budget AGAIN (pass-2 era 5 wanted more than 2000 fine steps and shipped £387k of
un-shrunk losses) — hence coarse stepping as default and 6000 as the net. A guard that binds in ONE place
looks like a converged solve everywhere else; never lower it to fix runtime.
⚠ **"Total losses" is therefore not a clean health metric** — it counts a dying tail, which the design *wants*,
the same as an industry that cannot pay for itself. At 60 steps era 5 had £791k of its £900k gross loss on
**stale tails** and exactly one loss-making *newest* tier (an excused shipyard). Losses **on newest tiers
only** is what separates them.
⚠ **Era 5 is the only scenario whose top two rungs are not both meant to be profitable**, which is why it needs
so much more shrinking than any other. The placement rule gives `weight: 1` to the leading tier and to the one
below; with `lead = [0,2,3,4,5,5]` those are the *leading* and *dominant* tiers everywhere else (+20% / +5%),
but there is no tier 6, so at era 5 the partner slides down onto the **one-era-stale** rung and half the
capacity starts at −13% to −23%. That is the ladder working, not failing — the defect was only that the
scenario placed a dying rung at full scale and could not correct it.

**⭐ HARD CONSTRAINT — THE INDUSTRIAL PRICE CEILING (§10.15).** No good that manufacturing **or the army**
can consume may reach **+75%** (the engine's 175% band edge). −75% is fine; **+75% is fine only for a
PURELY CIVILIAN-CONSUMED good** (user ruling 2026-08-12). An input pinned at the ceiling means the market
can no longer signal scarcity at all, so everything downstream is priced against a wall — and that
argument does not care whether the buyer is a factory or a battalion. Enforced in the price path
(restricted goods capped at 160), in the counts (a breach outranks the revenue-weighted mean) and in
**PM choice** (scored `profit − 100 × breaches`, so the constraint decides and profit only breaks ties).
⚠ **The military half was measured, not assumed**: combat-unit upkeep consumes 8 goods (ammunition,
artillery, grain, iron, oil, **radios**, small_arms, tanks), of which **5 were not already restricted** —
small_arms, ammunition, radios, tanks, artillery, i.e. exactly the war-industry outputs no civilian chain
eats. Restricted set 25 → 30. `radios` is the case the ruling names: pops buy them, which made them look
purely civilian, but a battalion's upkeep buys them too. The set comes from `UNIT_GOODS`, which the
no-buyer test already built and the ceiling simply never consulted.

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
per-tier `target_be` + `natural_year`). ⚠ Since §10.44 the UI shows **`tech_year`** (the slot's real
onset, under each era pill and as the industry header's "onset ~YYYY") — `natural_year` (the era
anchor) is config-only, carried through export but no longer displayed. The era pill always reads
`e0`–`e5` (era 0 included — a falsy-zero check once made e0 tiers display their 1-based position in the
tier-1 colour; e0 now has its own bronze, distinct from the untiered reference grey "0").
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
ROADMAP.md              THE PLAN — steps 0-7 from the solved economy to release (tech tree rework, industry-
                        driven research events, costs+build, the telemetry loop that is the MVP's definition,
                        then mandates/dams/visuals). Plan only: rulings go to BALANCE_FRAMEWORK, results to
                        FINDINGS, engine gotchas to MODDING_NOTES. CONSULT when deciding what to work on next
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
TESTBED_LANDMINES.md    THE REGISTER of defects where NOTHING FAILS — a c:TAG that errors half a million
                        times once its country is annexed, a script value that reads zero instead of
                        erroring, telemetry changed without a schema bump, a spec key the scheduler drops.
                        Each entry carries an ID and a DETECTOR; `tools/preflight.ps1` walks them against
                        the EMITTED files and THROWS, inside build.ps1 (every build, control arm included)
                        and run_schedule.ps1 (before a batch). The MD holds the story, the script holds the
                        enforcement — an entry that stays manual is a smell. ADD TO IT when a run surfaces
                        a new one, detector and all
MISSING_PM_REFERENCES.md catalogue of vanilla events/JEs/effects that reference a main PM our tier split relocated (they error+return false → missed flavor). GENERATED by tools/audit_pm_refs.ps1; strategic fix deferred
MISSING_BUILDING_CONDITIONS.md catalogue of special conditional fields (e.g. a conditional ai_value block) inside vanilla buildings we replace/split that our emitted building drops. Hand-maintained; directly fixable but batch-deferred (distinct from MISSING_PM_REFERENCES, which is external refs)
config/era_prices.json      GENERATED by tools/era_solver.mjs and COMMITTED: the balance-only view — each good's price
                        per era (% of base) and the PMs a country of that era runs. Reference, not authoritative:
                        tools/era_scenarios.mjs re-solves against REALISED prices and overwrites the volumes
config/era_presets.json     GENERATED by tools/era_scenarios.mjs and COMMITTED: the five solved era scenarios
                        (buildings/pops/units/sol/prices), passed through by extract_presets.ps1 into ui/presets.js.
                        Committed because a scenario is a design input, not an artifact
config/tech_tree_options.json GENERATED by tools/tech_tree_spec.mjs and COMMITTED: the three candidate
                        INDUSTRY TECH TREES (ROADMAP step 1) — every technology with its era, date, prerequisites,
                        dependents and the buildings it unlocks, for all three trees (production/military/society).
                        A design input under review, not yet emitted to the mod; NOTHING reads it but the viewer
config/mod_config.json      THE THING YOU EDIT — industries → tiers (tech, target_be, natural_year, output, inputs, building_cost, wage_pct?, employment, names, vanilla_pm, vanilla_pm_aliases?, state_infrastructure?, ship_construction?, ai_value?, output_override?, solve_profit? — §10.59: per-tier recipe-solve margin override replacing the band edge AND the industry handicap, today 0.05 on building_shipyard_metal; must stay carried by ui/econ.js makeTiers — plus workforce_mult?/effect_mult?, §10.60.2: the graded port factorisation's per-tier EMISSION multipliers (0.1 on the ÷10 port tiers, 0.2 on the ÷5 ones; goods+cost are divided EXPLICITLY in the config, employment/state-effects ride these two; UI-editable under ai_value on every tier row; build.ps1, convert_history.ps1 (levels ×1/workforce_mult, anchorage clamped to level 1), tierEmp() in BOTH econ.js and builder.html's fork, emit_research_events.mjs AND payback_census.mjs all consume them — the §10.60.2 "--write would un-divide port building_cost" trap is CLOSED since §10.61 made cost = vanilla anchor × workforce_mult); industry flags source_file?/clone_from_vanilla?/follows_be?/no_mass_be? (new-economy); plus top-level building_ai_value (map building_key→ai_value for PRESERVED buildings in owned files, e.g. trade center), pm_goods (map pm_key→{in:{good:qty},out:{good:qty}} — per-PM goods overrides applied to the owned PM files; any building's PM. ⚠ REPLACEMENT semantics, not per-line requantify: the override IS the PM's whole goods block, so it can add and remove goods, and a `required_input_goods` naming a good the override no longer consumes is dropped — see §10.43's streetlights, which ADD coal and REMOVE the electricity input), pm_employment (map pm_key→{profession:count} — per-PM EMPLOYMENT override, same replacement semantics into the PM's level_scaled block; config-only, displayed but NOT editable in the UI; today: pm_electric_streetlights = 250 engineers), and building_subsidies (map building_key→AI subsidy policy; see below), and **subsidy_conditional** (EXPERIMENTAL probe-stage, 2026-08-16: `{retire_overrides, retire_trigger}` — emits each of the 7 admin strategies as a MUTUALLY-EXCLUSIVE PAIR, base = the `building_subsidies` mandate with `possible = NOT(retire_trigger)`, `_pmr_mature` variant = `retire_overrides` applied with `possible = retire_trigger`. This is the engine's only conditional-subsidy lever — the `subsidies` block is a flat map with no per-entry triggers (goods_stances has them; subsidies does not). ⚠ `retire_trigger` is raw script pasted into both possible blocks; keep to constructs vanilla itself uses inside ai_strategies (`any_scope_building`/`is_building_type`/`count >=`). ✅ **MEASURED, F64 (2026-08-16): AIs DO re-pick strategies mid-campaign when `possible` flips** — the ports-cond world shows 11 countries on `_pmr_mature` at 1900 → 67 by 1936, GBR's port subsidy £82k→£0 permanently at its modern ports' arrival, colonial access 1.000 for the whole century, world bill −42% to a £204k/wk plateau carried by minors that never reach the count≥2 threshold. ✅ **v2 (F65, same day): the config also takes `exempt_trigger`/`exempt_overrides` (a third `_pmr_ext` variant — the measured form uses vanilla's own `ROOT.market.owner ?= ROOT`, exempting countries in someone else's market) and `retire_share` (emits `common/script_values/zzz_pm_rehaul_subsidy_values.txt`: occupancy-weighted merchant-marine share per port tier from the config's own output_qty; retire_trigger `pmr_port_mm_excess >= 0` — CUSTOM SCRIPT VALUES PROVABLY WORK INSIDE STRATEGY `possible` BLOCKS).** v2 measured: access 1.000 all window at ~30% less cost than count≥2; class transitions track the (violently churning) market topology with 2–8yr event-driven lags; known edges = start-decade over-mandation of members (tick-zero probe not run), and portless own-market countries class mature via 0 ≥ 0 (functional no-op). ⭐⭐ **CANONICAL since 2026-08-16 late evening (Q1+Q2 ruling, §10.60.3)**: the five port tier keys are must_have in building_subsidies (the base mandate, market leaders) and subsidy_conditional carries coverage_share 0.5 + the retire trigger `market_goods_buy_orders <= pmr_mm_high_cov` (mandate retires when the LIKELY-TO-BE-PROFITABLE ports — `coverage_tiers`, EXPLICIT in the config: industrial/modern/motor, validated at build; the t1 steam port is tuned loss-making and deliberately does NOT count — cover ≥ half of the market's MM demand) + the exempt trigger `NOT = { ROOT.market.owner ?= ROOT }` (non-leaders); both land on nice_to_have, never `none`, so nothing rides the unresolved merge-vs-replace semantics. The variant strategies now carry loc for all 11 languages ($key$ references to the base — a variant is a policy STATE, not new content). Railway/power stay nice_to_have), and **research_events** (ROADMAP step 2 — the industry-driven research journal entries. `enabled:false` emits NOTHING and reproduces the plain `techs` arm, `enabled:true` the `techs+events` arm, which is what makes the two a CONFIG VARIANT rather than a build flag — user ruling 2026-08-11, so the arm is expressible as `{kind: config, config: …}` and lands in build_state.json with no harness change. Carries: `thresholds_by_era` (PEOPLE employed in the predecessor tier — user-ruled 15k/45k/135k/405k for eras 2–5, plus a PROVISIONAL era-1 5k continuing the ×3 ladder downward, needed since the re-band put researchable rungs at era 1 and NOT itself ruled — the config's own `_threshold_era1_note` flags it), `stages` (inception/development/implementation), `grant_fraction` 0.5 of the era base cost per stage, `industry_bar_months` 36 / `war_bar_weeks` 26, `war_gate` (front-restricted, one general ≥100 mobilised battalions OR two ≥50, plus a ≥50% mobilised share), and `necessity_anchors` — the EIGHT hand-authored demand-pull mappings for industries whose first rung has no predecessor tier. ⚠ An industry whose first rung is gated on a RESEARCHABLE technology (era 2+) and has no anchor gets a research bar with NO source, which can never fill — the emitter used to skip it silently on the reasoning that such rungs are era-1 freebies, which stopped being true when the ladder-era alignment held `percussion_cap` back at era 2. It now THROWS. munition is the case that found it, and its anchor is the army: bg_army + bg_conscription. Everything else is derived by the emitter from the ladder and the live game), and **tech_ai_weight_mult** (per-tree AI research-weight multiplier {production, military, society}, DEFAULT 1/1/1 by ruling 2026-08-17 — no bonus or malus, the research JEs are boost enough; at 1 nothing is emitted; consumed by emit_techs.mjs, editable beside the tech page's spread panel)
config/start_exceptions.json manual 1836-start overrides (force_tier / force_industry_tier / remove, scoped by
                        country/state, optional `owner` ownership rewrite) — editable. Carries the RATIFIED
                        §10.60.3 CHAIN SEED (28 rules): 25 anchorages in the GBR/FRA markets → level-1 graded
                        steam-port stubs (12 subject-owned ones rewritten to the overlord, riding the refined
                        L14 rule), 2 clipper-yard blocks → metal shipyards (GBR East Anglia, FRA Brittany),
                        1 FRA Rhône paper mill → motor t1 (Q5c). Steel deliberately NOT seeded. The earlier
                        §10.59 steamer seed remains REVERTED (F66) — its rules live only in the file's
                        `_why_steamer_seed` comment. EMBEDDED in ui/data.js (`PMDATA.start_exceptions`) and
                        served live at /api/start_exceptions so the UI's Mod-changes page can enumerate it
config/start_baseline.json   GENERATED inventory of the vanilla 1836 start (per-industry/tier/country + drift check)
config/presets.json          WHICH scenario presets to generate (id/label/group/country + optional market_add/market_drop, sol, measured_market) — editable. A preset carrying a **`placeholder`** block instead of `country` is **SYNTHETIC**: not derived from any country, one level of every ordinary building so each production chain is present exactly once (what BE-solving wants). See `placeholder_defaults` for the shared pops, the SoL multipliers and the exclusion lists. Note `sol.slaves` is the **slave basket level** (what buildings buy for them), not a standard of living, and `defaults.class_mult` deliberately has **no** `slaves` entry — slaves are not on the pop-consumption path at all
config/pop_distribution.json FITTED within-need consumption distribution (need → good → share), replacing the vanilla `weight` field — which is not an allocation rule (the game allocates by SUPPLY SHARE) and cost 12 pp of scenario demand accuracy. ONE market-independent distribution by design, solved across all 7 preset markets against config/measured_1836.json; re-derive with the balance UI's **fit pops** button and paste the printed JSON back. Absent ⇒ the UI falls back to `weight` per need
config/measured_1836_professions.json GENERATED (tools/testbed/melted_pops_by_profession.mjs, from a melted VANILLA
                        1836.4.1 autosave) and COMMITTED: population BY PROFESSION per COUNTRY — the source the
                        balance sheet's population row is edited on, and which its wealth strata are the SUM of.
                        Per country, not per market, because market membership is extract_presets.ps1's job and a
                        second save-derived definition of it would drift silently. ⚠ A pop's size here is
                        `workforce + dependents`; measured_1836.json's `by_pop_type` holds WORKFORCE, about a
                        quarter of it — they are different quantities, do not substitute one for the other
config/measured_1836.json    GENERATED (tools/extract_measured.ps1, from a testbed session) and COMMITTED: the things the game FILES cannot answer — per market TRADE (imports/exports per good), SoL per stratum, MILITARY building levels, urban-centre levels as a cross-check, and per market **WAGES** (`-WagesOnly`, a MERGE-only mode that rewrites just the `wages` block and leaves every other field untouched, because a wages session carries none of the other metrics and a full run over it would blank them). The wages block holds **`base_weekly_wage`** — the UI's base £/wk knob, measured, on the F26 basis: **laborers + farmers + machinists, EMPLOYED pops only** (the three professions actually paid a building's market wage; state-salaried and owner professions are excluded, and an unemployed pop would put workers in the wage-unit denominator with nothing in the numerator). Beside it: `base_weekly_labour` on the **superseded** 11-profession basis, kept only for continuity with earlier findings and **not** to be fed to a scenario; the per-profession spread; the game's own per-state average annual wage (mean/median/min/max); the workforce ratio; and a per-pop-type table. Read by extract_presets.ps1; optional (a clone without it still builds, just without those). ⚠ Regenerate after a game patch — a stale table is silently wrong, not obviously missing
tools/                  dev tooling — NOT shipped in the mod
  build.ps1             builder: config → generates all mod/ files + all-language loc + ladder_tiers.txt + 1836 start, then lints
  preflight.ps1         THE GUARDRAIL for TESTBED_LANDMINES.md: walks every entry against what was ACTUALLY
                        EMITTED and exits non-zero on any breach. Run automatically by build.ps1 (at the end,
                        AND before the control arm's early exit — that early exit is why a check at the
                        bottom alone would never see the one arm whose promise is "carries nothing") and by
                        run_schedule.ps1 (`-RepoOnly`, before a batch is estimated, so a landmine costs two
                        seconds rather than the first run's build). `-NoPreflight` on the builder is for a
                        BROKEN DETECTOR, not for a hurry. It reads the ARTIFACT, never the generator — same
                        principle as verify_pms.mjs. Adding a check: entry in the register first, then
                        `Test-Lm<ID>` here, then PROVE the tripwire trips by breaking it on purpose
  telemetry_fingerprint.json  GENERATED by `preflight.ps1 -UpdateFingerprint` and COMMITTED: the sha256 of
                        the canonical telemetry (every metric on, dates/tags/token/stamp pinned) beside the
                        schema version it was taken at. Landmine L8 — if the hash moves and
                        TELEMETRY_VERSION does not, the build FAILS. Not a judgement that the change was
                        breaking; a forced decision between bumping the version and recording that older
                        sessions stay comparable
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
                        army solved together per era, then THE OUTER ITERATION (default 3 passes) re-runs the
                        whole era sequence against the final recipe book — a tier's recipe is solved once, in
                        the era where it is dominant, so a single pass chooses counts against provisional
                        recipes (§10.41.3/§10.42). Full run ~8–20 min (halved by §10.48's settled PM
                        loop). Writes config/era_presets.json AND the
                        volumes back to config/mod_config.json. Ends in a JOINT FIXED POINT over
                        prices/PMs/recipes/counts and reports ONLY that final state (§10.14.1) — do not add a
                        step after it that mutates any of them. Prints, per era: profit targets, PRICE PATH
                        realisation, the INDUSTRIAL CEILING pass/fail (§10.15) and ILLOGICALITY — plus, after
                        the loop, the FINAL PROFIT PASS whose FINAL-STATE ILLOGICALITY is the headline metric
                        (the in-era count reads provisional recipes — BUGS_AND_FIXES 2026-08-09).
                        ⭐ THE RULED-SET DEFAULTS (all §10.42.4, each with a revert knob): ERA_OUTER=3 +
                        ERA_SHRINK_COARSE (coarse-to-fine reduction), the unified post-solve enforcement pass
                        (ERA_RAW_SHRINK — §10.18 sheds levels, not types), ERA_STALE_W=0.25,
                        ERA_SHRINK_STALE_FIRST (stale rungs die first), the DEBUT GUARD + forward-chain rule
                        (ERA_DATE_GATE — §10.44: a tier is placeable iff its tech_year ≤ the scenario
                        YEAR; the leading-rung era arithmetic, the debut guard and its whole exemption
                        list are LEGACY, read only under ERA_DATE_GATE=0),
                        ERA_URBAN_FLOOR=-0.10, the RICE BAN (ERA_ALLOW_RICE=1 restores),
                        ERA_RAW_PRICE_BAND=30 (raw prices float ±30pp; no prescribed path),
                        ERA_CONSTR_RAMP (8→18% of GDP by era), ERA_POLISH (final-pass ±1-level polish) and
                        SHIPYARDS EXCLUDED from the headline profit totals (own line, like gold's tripwire).
                        Measurement-only knobs, unchanged: PRICE_START / PRICE_DECAY / PRICE_DECAY_INT /
                        PRICE_FLOOR(_INT), ERA_RATIO (=frozen restores the losing recipe-mix precedence,
                        §10.25.2), ERA_COUNT_DEADBAND / _OUT (manufactured goods' hysteresis band, 8→15pp;
                        0 = off and it limit-cycles forever, §10.28), ERA_SETTLE_TRACE=1,
                        ERA_MIN_LEVELS_MULT (§10.29 — the trap is scale-invariant), ERA_EXTINCT_GRACE
                        (§10.30), ERA_NO_BUYER=1 (measured, stays off, §10.32), ERA_SHRINK_LOSSMAKERS=0,
                        ERA_SHRINK_STEPS (default 6000 — a SAFETY NET, not a budget; §10.38),
                        ERA_WAGE_RAMP (Baumol wage growth — DEAD by measurement, §10.42.5),
                        ⭐ ERA_PM_MINGAIN (default 0.10 — §10.48: the PM optimiser's hysteresis, shipped
                        2026-08-10; =0.02 restores the old optimiser) and ⭐ ERA_PM_FREEZE (default ON —
                        §10.48: best-of-cycle freezing; a PMG returning to a method it held after an
                        earlier joint round is pinned at that phase; pins yield to legality and to the
                        ceiling; =0 reverts). Together they settle PM choice in every era (the old
                        "never settles" ⚠ is closed) — ⚠ freezing without the hysteresis is measured
                        HARMFUL, revert both or neither. Related measurement knobs: ERA_PM_SEED=prod
                        (productivity-first PM seeding — measured 2026-08-10, PARKED: +8% net, worse
                        illogicality/macro), ERA_SETTLE_ITERS (joint-loop settle iterations, default
                        40 — 80 measured, no dominance), ERA_BREACH_TRACE=1 (per-step ceiling breach
                        sets in the shrink loop),
                        ⭐⭐ THE CONSTRAINT-SET REGIME (§10.49 — SHIPPED AS DEFAULTS by ruling,
                        2026-08-10 "ship this, this is an obvious improvement"): ERA_PROFIT_BAND
                        default ON (+ ERA_BAND_LO/HI, default 0.05/0.50 — the dominant recipe's
                        +5% pin is a BAND, solved to an edge only when the margin leaves it; the
                        free-entry cap is the band top; =0 restores the target regime),
                        ERA_PRICE_AVG default ON (+ _RAW/_MFG/_TOL/_GAIN — the mandated aggregate
                        price decline: class-weighted manufactured price averages track an era
                        ladder, raw-fed 120…72 / mfg-fed 130…50 over eras 1–5 ±10pp, through an
                        integral offset on the count controller; plateau goods exempt FROM their
                        last tier's era — ⚠ `>=`, the `>` version killed textile; era 0 exempt,
                        §10.29 floored markets hold its averages down; =0 disables), ERA_GROW
                        default 2 = STRICT (the INCREASE mechanism, the reduction's mirror: the
                        top-profit producer ≥20pp above the capital-weighted average margin grows
                        +10%/+1 alternating with cuts, and may not deepen even verify-only macro
                        gaps; =1 the measured-harmful plain form, =0 disables), and ERA_PM_LIFT
                        default 0.25 (pins and settled PM selections yield to DOMINANCE: beaten by
                        >25pp at current prices re-opens the choice — the era-0 textile −40%-vs-
                        +159% pin is why; LAST THREE joint rounds only, ONE appeal per pin per era,
                        or every bistable pair re-opens forever and §10.48's settling dies —
                        BUGS_AND_FIXES 2026-08-10), and ERA_RECIPE_MONO default strong (§10.50, THE
                        RECIPE RATCHET: a later tier's base recipe may not be less input-efficient
                        — O:I value at base prices — than the tier below; hard Xmax in
                        solveInputsAt, mirror of the 4:1 lean floor, feasible by construction;
                        'weak' = identical one-good-IO pairs only, measured strictly dominated;
                        =0 reverts. Nothing had ever bounded recipe RICHNESS: e1 tooling once ate
                        £1,546 of wood to make £1,200 of tools. ⚠ NO absolute ratio floor — sub-1
                        at base prices is legal when realised prices carry it; only the REGRESSION
                        is forbidden, §10.50.1. ⚠ The two examples §10.50.1 cites, fertilizer 0.98
                        and electrics 0.75, BOTH NOW RUN 3.99 — later re-solves fixed them and the
                        exemption stayed; today's sub-1 population is 6 tiers, worst 0.49),
                        ⭐⭐ THE SOLVENCY BOUND — TARGET BE ≤ 175 (§10.63, user-ruled 2026-08-17;
                        the THRESHOLD is a game constant and is NOT tunable — 175 is the engine's
                        own band edge — but ENFORCEMENT has the measurement switch ERA_SOLVENCY=0,
                        same shape as ERA_RECIPE_MONO=0, because the cap lives in the CODE not the
                        config, so without it two solves of two different configs both apply it and
                        come back byte-identical and there is no A/B baseline at all; never ship
                        with it off): a tier's full wage-inclusive break-even, i.e. the
                        OUTPUT price as a % of base at which its BASE PM covers input goods plus
                        wages WITH INPUTS AT BASE, may not exceed 175 — `Ibase ≤ 1.75·(1−wp)·Obase`,
                        so O:I ≥ 0.762 at wp 0.25. `Xsolv` clamps it in solveInputsAt beside Xmin
                        and the ratchet (never fighting Xmin, which sits 5× away), and
                        `assertSolvency()` THROWS before the config write when minMainInput (the
                        negative-goods floor, applied per good AFTER the clamp) pushes a tier back
                        over the line — two hard invariants in conflict must fail loudly, not have
                        one silently win. Build side: `tools/lint_solvency.mjs`, SEPARATE from
                        lint_profitability.awk for the two reasons F67 survived — that linter's
                        scope excludes no_mass_be industries, and its test is circular (target_be
                        is restated FROM the recipe it checks). SHIPYARDS ARE NOT EXEMPT (costs
                        nothing today, all seven at ≤128, but the carve-out is gone).
                        ⚠ It caught THREE tiers on the pre-ruling book — port 270, railway 217,
                        synthetics 208 — which is what forced the re-solve.
                        ⚠ It is NOT "may not destroy value at base prices" (that is ≤100, REJECTED):
                        an early tier is MEANT to be insolvent at base and carried by a higher
                        output price, so §10.50.1 stands and sub-1 O:I stays legal (power 158,
                        steel 139/135 all pass). ⚠ A FIRST ruling the same day set the weaker
                        both-edges line (output ×1.75 AND inputs ×0.25 = target_be ≤ 400); measured
                        at 0 of 105 before shipping and superseded within the hour —
                        `lint_solvency.mjs --band` still scores it.
                        ⚠ Each measured HARMFUL
                        ALONE (A → £1.5M losses, B → stale explosion, C plain → grows the pithead
                        artifact) — revert as a set, not singly. Band top 1.0 measured: a stale
                        rung then dies only if its price HALVES in 2 eras — 0.5 is the working
                        top, margins live in 5–50%,
                        ERA_RAIL_PENALTY (default 0 — MEASURED AND REJECTED, §10.47.1: a target
                        handicap reaches solveInputsAt and buys richer recipes, making railway
                        value-poorer at every era; kept for re-measurement only),
                        ⭐ ERA_SUBSIDY_TOL (default 0.10 — §10.47.4, user-ruled: vanilla's default AI
                        strategy subsidises railway/port/power at must_have, so the trio may run down
                        to −10% before the ladder criterion calls it a fault or the loss-shrink cuts
                        it. SCORING ONLY — recipes untouched (the ERA_RAIL_PENALTY lesson); the
                        implied SUBSIDY BILL is printed per era, structurally ≤ tol × the trio's cost
                        base. ⚠ mirrored in ui/econ.js LADDER_LOSS_FLOOR — keep the two in step),
                        ERA_PRUNE (default steel@0,glass@0 — the ruled 1780 prune; empty reverts),
                        ERA_PROF_WEDGE (default ON — §10.45/F46: per-profession era multipliers on the
                        1836 vector, measured from the saves_debut USA campaign; =0 restores the frozen
                        vector; ERA_PROF_RAMP still multiplies on top),
                        ERA_LEAD_W (stays 1 by ruling), ERA_RAW_DRIFT (REJECTED by ruling; knob kept for
                        A/B only), ERA_CEIL_BOOST, ERA_CEIL_PM, ERA_JOINT (also the jitter seed for
                        3-run ensembles), ERA_PROBE (the removed forward probe — leave it off).
                        ⭐ TRADE-SUPPLIED GOODS (§10.46): goods on the EXPLICIT TRADE_SUPPLY_GOODS list
                        (today: hardwood only) with building demand and no building supply are IMPORTED
                        (trade sell = demand every re-price ⇒ price 100) — the 1780 hardwood ruling.
                        ⚠ A LIST, NEVER a condition: the condition version disarmed the only-source
                        ceiling guard and shipped 1900 with ALL its iron imported (§10.46.1). The §10.21
                        futility guard fires only at the price FLOOR, never at the ceiling (the
                        1780-iron/era-2-engines bug), and FIXED_REF_COUNT is EMPTY (the
                        10-dye-plantation placeholder pin is gone).
                        ⭐⭐ THE MACROSCENARIO (ERA_MACRO, default usa — §10.47/§10.47.2, user-ruled
                        2026-08-09): reasonability bounds from tools/era_macro.mjs, applied 1836+
                        (1780 exempt) — the governance layer the rice ban and the US population
                        premise already belonged to. Three levels: profession shares of population
                        (VERIFIED only), industry-GROUP shares and per-INDUSTRY shares (both ENFORCED
                        post-solve through counts, before the polish, which carries a macro guard).
                        ⭐ Bounds are DERIVED, not calibrated (§10.47.2): X = the real US industry's
                        share at the scenario date, import-adjusted for the autarky premise, army-
                        premise-scaled for the war industries, mapped-or-dropped into our taxonomy and
                        RENORMALIZED over the mapped commodity economy — gates [X/4,4X] per industry,
                        [Y/3,2Y] per group; the model's shares are measured on the symmetric
                        denominator (tier industries + raw refs + subsistence, urban centres excluded),
                        NOT raw model GDP. Gross product (VA) by ruling — negative pre-wage balance can
                        never reach a floor by growing; enforcement blocks it and NEGATIVE GROSS
                        PRODUCT is the standing discussion list. Floors waived where placement
                        withholds (date gate / prune / chain / extinct outrank); `nofloor` = shipyards
                        (VA negative by construction) + the unmappable art academy. The EXTRACTION cap
                        is VERIFY-ONLY: real mining+logging is 4.9–9.3% of the mapped economy, the
                        model runs ×1.8–4 that because V3 books value at the pithead — a price-vector
                        property no count can close (§10.47.2). Headline check = the MACRO
                        REASONABILITY block in the final profit pass. ERA_MACRO=0 disables;
                        ERA_MACRO_STEPS caps moves (default 400). Railway's derived floors
                        (1.75–2.75% mapped, from a real ~7–11%) state the full transport gap — the
                        freight ruling (§10.47.1) is what could move it
  era_macro.mjs         the macroscenario DATA: per-industry X and per-group Y (real US shares of the
                        mapped commodity economy, 2 significant figures, adjustment tags (b)asket
                        (i)mport (a)rmy-premise (s)judgment recorded per row) + profession bands, and
                        activeMacro()/macroBounds()/macroVerifyOnly()/validateMacro(). Pure data +
                        helpers, validated fail-loud against the live model at solver start; a future
                        macroscenario is a NEW entry in MACROS selected by ERA_MACRO=<id>, never an
                        edit to `usa`. Sources: Historical Statistics of the US / Census of
                        Manufactures / Gallman's commodity-output series — factor-4 gates need 2sf,
                        not decimals
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
  solve_building_cost.ps1 LEGACY for tiers on the era ladder — the older 10yr-payback model (BALANCE_FRAMEWORK §9),
                        whose assumed 20% return on operating cost is what shipped a ~2-year book.
                        `payback_census.mjs --write` owns building_cost now (§10.61)
  audit_tech_content.mjs ⭐⭐ WHAT WOULD BE LOST IF THIS TECHNOLOGY WERE MERGED AWAY OR DELETED?
                        Read-only. Per technology: its MODIFIER block, every production method /
                        building / combat unit / decree / company it gates, and every line of vanilla
                        script that names it. `--all-new` sweeps every technology we add.
                        ⭐⭐ THE RULE IT ENFORCES (user, 2026-08-12): **THERE ARE NO CONTENTLESS VANILLA
                        TECHNOLOGIES.** None is a placeholder that only slows research down; if one looks
                        like that, you are looking in the wrong place. The tech-tree viewer counts only
                        BUILDING unlocks, which is exactly why a technology can look empty there and gate
                        sixteen things — `watertube_boiler` does. Run this before ANY merge or removal and
                        make the survivor absorb everything listed.
                        ⚠ ITS FINDING THAT CHANGED THE PLAN: a vanilla technology can essentially never be
                        DELETED, because vanilla script names it — in production methods, journal entries,
                        events, ship modifications and COMPANY formation requirements. A merge is therefore
                        re-pointing OUR tier gates onto one technology, and deleting only technologies WE
                        added (which have zero vanilla references by construction).
  vanilla_construction.mjs VANILLA'S CONSTRUCTION DATA, read live from the game files — ONE
                        implementation, because two tools need it. `requiredConstruction()` (building →
                        points, depth-aware so a conditional second field cannot win),
                        `constructionCostValues()` (the `construction_cost_*` script values) and
                        `constructionMethods()` (the construction sector's methods → £ per point).
                        Consumed by `payback_census.mjs` (the cost book anchors on it) and
                        `vanilla_payback_census.mjs` (it prices vanilla with it)
  vanilla_payback_census.mjs ⭐⭐ WHAT PAYBACK DOES THE BASE GAME RUN AT? Read-only. The REFERENCE the
                        cost book is anchored to, because `payback_census.mjs` can only compare us
                        against our own assumption. Vanilla recipe book (each tier's `vanilla_pm`,
                        invented tiers interpolated along the ×1.5 ladder — the same rule the UI's
                        `recipes: vanilla` button uses), vanilla `required_construction` read live from
                        `common/buildings/*.txt` through `common/script_values/building_values.txt`, the
                        eight vanilla-1836 preset markets at their own realised prices. `--book mod`
                        re-reads the same scenarios on our book, which is the gap in one number;
                        `--detail` gives the per-building-type table.
                        ⚠ The vanilla construction data it reads lives in ONE module,
                        **`tools/vanilla_construction.mjs`** (`requiredConstruction()` /
                        `constructionMethods()` / `constructionCostValues()`), shared with
                        `payback_census.mjs`, which anchors the cost book on the same numbers.
                        ⭐⭐ **£720 PER CONSTRUCTION POINT IS ONE METHOD'S RATE, NOT A CONSTANT** (F53).
                        It is `pm_iron_frame_buildings`; the ladder is **wooden 1000 · iron 720 · steel
                        540 · arc 527**, i.e. the cheapest available rate falls 1000/720/720/540/540/527
                        across our six eras. The tool DERIVES it per method from the game files and
                        takes `--constr-pm` to pick one; 1836 wants iron frame, since all eight markets
                        hold `urban_planning` from vanilla's own starting inventions. Every £ figure in
                        `payback_census.mjs` still uses 720 flat, so its late-era capital stock and
                        rebuild times read ~27% high.
                        ⚠ A building at a LOSS has no payback and is reported as a COUNT, never folded
                        into a median as a large number. The capital-weighted aggregate — Σ(cost×levels)
                        ÷ Σ(52×profit×levels) — needs no distribution and is the robust reading.
  payback_census.mjs    ⭐⭐ THE CAPITAL-SIDE CENSUS **AND THE COST-BOOK SOLVER** (`--write` is the one
                        thing here that writes, and it writes exactly `building_cost`). What a level
                        COSTS against what it EARNS, across the six era scenarios: payback per tier at
                        that scenario's own realised prices, the realised margins behind it, capital
                        stock, **K/GDP**, and **years of the construction budget the standing capital
                        stock represents** (the buildability constraint, and the sharpest single reading
                        of the capital glut). `--rule` derives the cost book, `--write` stores it.
                        ⭐⭐ THE RULE IT IMPLEMENTS is in the Working-conventions bullet *Building cost
                        is exactly vanilla's own cost book, flat* (§10.61) — read that first; this is
                        where it runs.
                        ⭐⭐ WHY IT EXISTS, and the finding it was written for: `solve_building_cost.ps1`
                        pays the cost back out of an ASSUMED 20% return on operating cost, while the
                        shipped economy earns 56–104% (median, dominant rungs) — so the REALISED payback
                        was **~2 years in every era**, not the 10 the model names. The model is right; its
                        one assumption is 3–6× off. Nothing measured that before, because payback is a
                        property of the RECIPE BOOK and the SCENARIO together and the two live in
                        different tools. ⚠ A tier is read in the era where it is DOMINANT, the same
                        convention the recipe solve uses. ⚠ Its £ figures are all on the flat-£720 basis
                        (see the ruling) — self-consistent within it, ~27% high on late-era capital
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
                        + GET /api/config and GET /api/start_exceptions (the LIVE config files, verbatim bytes —
                        the sheet boots from these when served, falling back to the build-time copy in data.js;
                        the static branch serves ui/ ONLY, which is why the config needs its own routes)
  bundle_ui.mjs         inlines ui/builder.html + data.js + vanilla.js + presets.js — **and the whole tech-tree
                        page, techtree.html with techdata.js folded into it** — into ONE standalone page
                        (`node tools/bundle_ui.mjs [--out <path>] [--stale-ok]`, or balance-snapshot.cmd).
                        ⚠ **ui/icons.js is deliberately EXCLUDED** — Paradox art, gitignored because the repo
                        is public, and a snapshot is something you hand to someone else; the panel already
                        degrades to text-only good names. "Build now" is disabled in the copy (it POSTs to
                        ui.ps1); **Export mod_config.json still works IN THE FILE**, so the round trip is tune → export →
                        bring the file back.
                        ⚠ **BUT NOT IN THE PUBLISHED ARTIFACT.** The artifact viewer never grants a page
                        download permission, so Export is INERT there — the button does nothing, silently,
                        including for `data:`/`blob:` hrefs. The published snapshot is therefore READ-ONLY
                        in practice: to tune and bring changes back, download the HTML and open it locally,
                        or use the served UI. Do not tell someone to "export from the link".
                        Two guards, both exit non-zero: it REFUSES to bundle when
                        ui/*.js is older than config/mod_config.json (a snapshot of the previous build's
                        numbers is the failure mode worth preventing — `--stale-ok` overrides), and it fails
                        if builder.html loads a `<script src>` not listed in its INLINE/OMIT lists, rather
                        than silently shipping a page missing a whole data set. The tech-tree page has two
                        more of the same kind: it fails if techtree.html stops loading techdata.js, and if
                        builder.html stops reading `window.__TECHTREE_HTML` (which would leave the detached
                        copy quietly falling back to an `<iframe src>` with nothing beside it to serve).
                        ⚠ The tree page's own data, ui/techdata.js, only WARNS when stale — see techtree.html
                        below for why. ⚠ The tree block is built before the wrapper strip and appended
                        AFTER it: that strip is `$`-anchored and deletes every `<meta>` globally, so an
                        earlier append would both defeat the anchor and eat the tree's own charset meta out
                        of its string literal
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
  --- THE SAVEGAME READER: a SECOND instrument, for STATE rather than PROCESS (TESTBED_METRICS §7) ---
  testbed/save_extract.mjs   a `.v3` save -> its `gamestate` (ASCII header + metadata + a one-entry ZIP;
                        45.5 MB inflates to 259 MB, so everything downstream STREAMS). There is no
                        text-save option — checked, so nobody re-checks
  testbed/lib_savebin.mjs    THE reader for Clausewitz binary — one implementation, like lib_breakdown.
                        ⚠⚠ TRUSTED ONLY BEFORE ~104 MB: brace depth is stable through the pop table, then
                        drifts (a rare token with an unconsumed payload) and ends at depth 146. The
                        states/buildings/market databases live past the drift, which is why per-market pop
                        analysis and per-state `local` goods supply are NOT yet available
  testbed/save_survey.mjs    structure + token census — what is in a gamestate and where
  testbed/save_dump_records.mjs  the raw token sequence around an anchor string, to read a record's shape
  testbed/save_pops.mjs      the POP TABLE (+ the country tag table, which rides along because a pop
                        carries its owner as an INDEX and is unlabelled without it) -> TSV
  testbed/save_summary.mjs   THE readable summary: wealth distribution, need budgets, and the WEALTH
                        THRESHOLD PER NEED — three needs (communication, leisure, luxury_food) do not
                        exist below wealth 20 and only 7.9 % of the world reaches it (FINDINGS F38).
                        ⚠ Field meanings are HYPOTHESES until independently confirmed; the confirmed set
                        and what confirmed it are tabulated in TESTBED_METRICS §7
  --- the MELTED-save readers (rakaly melt -> plaintext with real field names). These are what solved
      the pop-need split (FINDINGS F40); they read STATE, so they need no telemetry of their own ---
  testbed/melted_pop_need_weights.mjs  the game's OWN computed purchase weight per (state, CULTURE, need,
                        good), out of `states.database.<id>.pop_needs`. Divide by the base weight from
                        common/pop_needs and you recover the SUPPLY SHARE the game actually used — a
                        quantity that exists nowhere else and cannot be derived from the order book.
                        ⚠ Supersedes melted_state_needs.mjs, which numbered the entries 0,1,2… and threw
                        the real key away; the keys are CULTURE ids and are not consecutive, so the
                        counter merged distinct cultures under one label
  testbed/melted_building_goods.mjs  per-state SUPPLY and NON-POP DEMAND, from every building's
                        `input_goods` / `output_goods`, plus the prestige share of each output.
                        ⭐ The market order book is NOT persisted in a save (the market database holds only
                        `owner`), but the buildings are — so the pair the substitution rule consumes can be
                        rebuilt for the SAME gamestate the weights come from. Validated against the run's
                        own telemetry: production matches to ~8 % mean
  testbed/melted_pops_by_profession.mjs  POPULATION BY PROFESSION per country, out of a melt -> the
                        committed `config/measured_1836_professions.json`. Written because the balance
                        sheet edits population by profession and sums the strata from it, and nothing in
                        history or telemetry supplied that split. ⚠ Size is `workforce + dependents`, and
                        an unattributable pop (a state with no owner) is REPORTED, never dropped
  testbed/melted_cultures.mjs  the culture database and its CURRENT obsessions. ⚠ OBSESSIONS ARE RUNTIME
                        STATE — common/cultures holds only the 1836 set and the game adds and drops them
                        all campaign; reading the file instead of the save put Australian wine 220 pp wrong
  testbed/predict_pop_split.mjs  THE end-to-end check: predict every stored purchase weight in a market
                        from that market's own supply, non-pop demand and prestige supply. `--no-culture`
                        scores the mechanism alone. **`--local <mode>`** scores the LOCAL-GOODS readings
                        against each other and prints their error as its own headline (F43): `off` (market
                        supply, the pre-F43 reading), `scaled:<f>` (the shipped form — the factor on the
                        WHOLE availability), `fixed:<f>` (on supply only — ⚠ zeroes electricity out below
                        f≈0.3 and DROPS those entries, so its low end is not comparable), `state`, and
                        `gdp` (the real per-state rule with GDP proxied by output-value share).
                        **`--shares`** emits the SHARES per (need, good) as TSV instead of an aggregate
                        error — run it under two `--local` modes and join on the observed column, which is a
                        property of the save and must come back identical or the runs are not comparable. An
                        error figure cannot distinguish a 0.49-vs-0.23 miss from a 0.05-vs-0.02 one.
                        Supporting single-term tools: within_need_test.mjs
                        (candidate availability forms, inside one need — no cross-need scale to invent),
                        fit_substitution_rule.mjs --sweep (the deduction coefficients),
                        validate_split_rule.mjs (clamps, prestige and culture terms, isolated),
                        solve_need_availability.mjs / fit_availability.mjs / identify_availability.mjs /
                        invert_deduction.mjs (the identification path, kept for re-derivation)
  --- ⭐⭐ THE SAVEGAME HARVEST — the same instrument, INDUSTRIALISED (2026-08-11, TESTBED_METRICS §7½).
      Every autosave of every run is archived, melted, summarised and reaped automatically, so a batch
      yields an ANNUAL per-country state series beside the log telemetry's twelve dump dates ---
  testbed/save_state_summary.mjs  ONE MELT -> ONE SUMMARY JSON (gzipped, ~400 KB from 2.2 MB raw).
                        Takes a `.v3` DIRECTLY and melts it in-process with `rakaly -c`, so the 391 MB
                        plaintext never touches disk and a worker pool needs no shell pipe. Per country:
                        GDP/prestige/literacy/SoL (last sample of each weekly trend), pop_statistics
                        incl. POPULATION BY PROFESSION, buildings BY TYPE (count, levels, SUBSIDISED
                        levels, profit, cash, staffing), the whole budget with `country_building_budget`
                        itemised by category AND BY BUILDING (⭐ the per-building SUBSIDY line, which
                        needed no deriving — the save books it directly), last_bankruptcy_date,
                        technologies held, foreign-owned/owned-abroad levels, goods in/out, and
                        TOP PRODUCERS BY GOOD with quantities (top 20 per good, in EVERY summary),
                        and POP OBJECT COUNTS — total AND non-empty, per country and world-wide.
                        ⚠ 17.4% of vanilla pop records hold NO people, the game's UI hides them, and
                        `<id>=none` freed slots sit in the same database (a record test must require the
                        trailing brace, or the count comes out 2.9% high). Count RECORDS and claim
                        nothing about the identity tuple — `workplace` is one of its dimensions but
                        state+culture+religion+profession+workplace+wealth still only reaches 92.8%.
                        ⚠ It does NOT scan the pop table (8 M of the melt's 16 M lines): each country
                        record already carries population_by_profession, and that index is ALPHABETICAL
                        over `common/pop_types/*.txt` — VERIFIED, agreeing to 0.03% world-wide on all 15
                        professions (`--verify-pops` re-derives it the expensive way). It THROWS if the
                        game's pop-type count ever differs from the save's own count prefix.
                        ⚠ SAVE_SUMMARY_VERSION is bump-never-renumber, like TELEMETRY_VERSION.
                        ⚠ NOT to be confused with `save_summary.mjs` (below), which reads the RAW BINARY
                        and answers a different question
  testbed/harvest_saves.ps1  stages B-D: melt -> extract -> VERIFY -> reap, N workers (default 4), with
                        the queue-depth / GB / drain-rate progress line. ⚠⚠ IT INVERTS THE REPO'S RULE:
                        everywhere else "the summary is a CACHE, the raw log is the record", but a reaped
                        save makes THE SUMMARY THE RECORD. Hence: write to a temp name, VERIFY the
                        artifact (gunzip, parse, require a version + date + ≥10 countries), rename, and
                        only THEN delete the .v3 — a failed save is never reaped and keeps a .err beside
                        it, and the NEWEST save of each run is kept permanently as the escape hatch.
                        Landmine L12 enforces all of that post-run (`preflight.ps1 -Session <dir>`).
                        ⭐ IT RUNS CONCURRENTLY WITH THE GAME BY DEFAULT (`-Watch`, user ruling
                        2026-08-11): a save is summarised and deleted minutes after it is written rather
                        than tens of gigabytes standing until the run ends. A final synchronous drain
                        always follows the run, so a dead watcher costs time and nothing else — the queue
                        is "saves with no summary yet", which makes the pass idempotent.
                        ⚠ This required the archiver to write ATOMICALLY (copy to `.v3.part`, then
                        rename): `Copy-Item` is not atomic, so a live harvester could otherwise read a
                        half-copied save. ⚠ The melt's cost to the GAME is unmeasured (~5 s of one core
                        per save, 20 cores, mostly single-threaded engine); `-HarvestWorkers 0` restores
                        the drain-between-runs shape for a batch that needs the machine quiet
  testbed/verify_save_alignment.mjs  THE GATE: do the two instruments agree on GDP, building count and
                        population? ⚠ The join is on POPULATION, not on name — telemetry names a country
                        by DISPLAY NAME, which changes mid-campaign (the country telemetry calls "India"
                        is tag BHT), while a save names it by TAG, which does not. Matching on GDP and
                        then reporting GDP agreement would be circular; population is measured
                        independently on both sides and is not scored. Run it before moving any
                        state-of-process metric off the logs
  ⚠ MEASURED COST, and it retires the plan's central worry: melt 2 s, single-pass extract ~4 s,
      STREAMED end-to-end 5.0 s per 57 MB save. The consumer is several times FASTER than a quarterly
      producer (one save per 15-35 s of wall clock), so the queue never grows. The binding constraint is
      the ENGINE: writing a 40-55 MB autosave stalls the game, so ~400 quarterly saves per century cost
      real game wall clock where ~100 yearly ones do not — which is why a batch measuring wall clock uses
      YEARLY (also the cadence the earlier vanilla sessions used, keeping them comparable)
  testbed/score_save.ps1   ONE COMMAND per gamestate: melt an archived autosave, run all three readers,
                        score it. `-Keep` keeps the 250 MB melt for follow-up work; without it the melt
                        is deleted. ⚠ It reads the date from the melt anchored at COLUMN 0 — a save is
                        full of nested `date=` fields and a whitespace-tolerant pattern reads 1.1.1
  testbed/predict_good_demand.mjs  PREDICTED vs MEASURED pop demand for one good, in UNITS — the end
                        product, where a purchase weight is only an intermediate. Adds the BUDGET half:
                        every pop's wealth and size from the save × `common/buy_packages`, × the stored
                        split, ÷ base price. `--explain` prints the whole arithmetic (per need, the ten
                        biggest state×culture cells, and one pop end to end); `--peasant-mult` A/Bs the
                        `consumption_mult`. ⚠ **Measured pop demand is `buy − building input − EXPORTS`**
                        — exports sit in the buy orders, and forgetting them charged the USA's 4 092
                        exported cars to its own pops (F42)
  testbed/debut_series.mjs  a debut good and its need-mate across many gamestates, in RAW UNITS, with the
                        share rebuilt one term at a time against the game's own stored value. Written
                        because the automobile story reads BACKWARDS as a ratio — see the ratio principle
                        above
  testbed/saves_debut/     ⚠ **KEEP — 356 quarterly autosaves of one VANILLA campaign, 1836.1 → 1921.1**
                        (9.2 GB, gitignored). The same never-delete rule as `sessions/` applies and for the
                        same reason: it is a historical observation, not reproducible measurement — a
                        different seed gives a different world, and a patch gives a different game. It is
                        the evidence behind F40's vanilla replication and behind the automobile debut
                        (first traded 1902.1.1). Label any of them without melting via
                        `map_saves_to_dates.mjs`, which joins the archiver's log to the observer's ticks.
                        `_score_work/` beside it is a scratch dir for melts and IS disposable
  testbed/archive_autosaves.ps1  copies every autosave the engine writes into a keep-forever archive
                        BEFORE its slot is reused. ⚠ Two hazards, both hit in practice: the engine ROTATES
                        slots by RENAMING, so a per-name dedupe archives the same save up to five times
                        and fills the disk; and a 45 MB write is not atomic, so a file is only copied once
                        its size and mtime have been stable for -StableSeconds. Run it alongside a batch
                        whenever the saves, not the logs, are the instrument
  testbed/wait_for_session.ps1  the wake-up signal for a batch launched into its own window (which the
                        agent harness cannot see). Run it with run_in_background; returns DONE on
                        completion, RUNNING on a heartbeat, DEAD (exit 2) if the game vanished
  testbed/ledger/       THE BATCH LEDGER — the reusable per-batch report (template + data scripts +
                        README with the fill procedure). Ruled conventions encoded: normalized/absolute
                        toggles on every view, world + watchlist pages with selectable countries,
                        computed per-tag anomaly flags, the whole-economy/tiered-sector scope control.
                        Published as an Artifact per batch AND copied into the session as REPORT.html.
                        ⚠ Session paths hardcoded to the first instance (flatcost-n1); --session flag TODO
  testbed/run_schedule.ps1  THE entry point for all measurement: ordered schedule JSON -> build each run via
                        build.ps1 -> run -> harvest -> cross-run markets_all.tsv. Interactive p/r/s/x control;
                        crash policy. Never call the builder directly for test data. Specs in
                        testbed/schedules/, results in testbed/sessions/ (the ONE results root).
                        ⭐ It also owns the SAVEGAME HARVEST (default ON, `-NoSaveHarvest` opts out):
                        `archive_autosaves.ps1` runs CONCURRENTLY with the game into `<run>\saves\`, and
                        `harvest_saves.ps1` runs BETWEEN runs into `<run>\save_summaries\`, with a
                        `save_provenance.json` carrying the arm/run/session into every summary.
                        ⚠ The archiver is launched with `Start-Process`, whose `-ArgumentList` joins an
                        array with spaces and QUOTES NOTHING — and this repo lives under a path with a
                        space, so every path there is quoted by hand and the scheduler now PROVES the
                        archiver is alive rather than reporting it started. It was launched into a hidden
                        window and died instantly on `Processing -File 'C:\claude-code\victoria' failed`;
                        the batch played 3.5 in-game years capturing nothing before that was noticed.
                        ⚠ The harvest is invoked with `& powershell @args`, which quotes each element
                        ITSELF — so its paths must NOT be pre-quoted. Two calls, two opposite rules
  testbed/make_vanilla_stub.ps1  derives a "tiering only" config (structure kept, base-game recipes/costs/ai_value)
                        -> config/mod_config.vanilla_stub.json; the headless twin of the UI's Bring-to-vanilla,
                        used as the control arm when measuring what the tier split alone does
  goods_prices.tsv      THE price table — the single source for the builder, both solvers, BOTH linters and the UI
  lint.sh                profitability + negative-goods linter wrapper (runs both awks below)
  lint_profitability.awk / ladder_tiers.txt   BE-vs-ladder linter (ladder_tiers.txt is GENERATED; prices come
                        from goods_prices.tsv via `-v PRICES=`, never a copy inside the awk)
  lint_negative_goods.awk negative-goods invariant linter (no PM combination drives a good's building total < 0)
  lint_solvency.mjs     THE SOLVENCY LINTER (§10.63 / landmine L18) — every tier's BASE PM must be able to
                        break even at SOME price inside the engine's own 25–175% band: output ×1.75,
                        inputs ×0.25, wages included. `--census` ranks every tier by how close it is to
                        the line; `--config <path>` scores an alternate book; `--goods-only` drops the wage
                        term for A/B and is NOT the shipped rule. ⚠ SEPARATE from lint_profitability.awk on
                        purpose, and both reasons are why F67 survived for months: that linter reads
                        ladder_tiers.txt, which EXCLUDES `no_mass_be` industries (port/railway/power — three
                        of the six sub-1 tiers), and its test is CIRCULAR (it compares a recipe against
                        target_be, which era_solver restates FROM that recipe, so the deviation is 0 by
                        construction). ⚠ Never read target_be here; recompute from the goods block.
                        ⚠⚠ It passes on the current book — 0 of 105 — BY DESIGN, not by luck: the ruled
                        threshold is target_be ≤ 400 and the port sits at 270. A passing run is NOT evidence
                        the port is fine. ✅ WIRED INTO build.ps1 (2026-08-17), immediately after lint.sh, and it
                        THROWS on a non-zero exit. Kept separate from lint.sh on purpose — see the two
                        reasons above
  emit_techs.mjs        THE TECH TREE, EMITTED (ROADMAP step 1) — called by build.ps1, which THROWS if it
                        fails. Reads config/tech_tree_options.json's SHIPPING option and writes the additive
                        new-technology file, the era moves into vanilla's production AND military files, the
                        per-tree AI research weight (config `tech_ai_weight_mult` — DEFAULT 1/1/1 by ruling
                        2026-08-17, at which it emits NOTHING; the 2026-08-11 society ×0.8 is superseded;
                        a tree ≠1 gets `multiply` appended in every vanilla ai_weight of its file and sets
                        the new techs' flat weight; editable beside the tech page's spread panel), the 1836
                        starting grant, the ahead-of-time define, a minted
                        placeholder icon and loc for all 11 languages.
                        ⭐⭐ **THE 1836 GRANT IS DERIVED FROM THE 1836 MAP** (user ruling 2026-08-12): *every
                        production method vanilla runs in 1836 stays, and the country running it holds the
                        technology.* For each of our tier buildings standing on the map it takes the
                        STARTING TIERS of the countries owning one and grants that tier's technology to
                        exactly those tiers, minus what vanilla's own `add_era_researched` already covers
                        and minus anything vanilla names itself (read live from vanilla's file, so a patch
                        flows through). It used to name every new era-1 production technology to tiers 3,
                        4 and 5 — 213 countries, of which **two** owned anything of the kind. The grant is
                        now FOUR lines — at the current tree `steel_railway_cars` to tiers 1-2,
                        `beet_sugar_refining` to tiers 3-4 (an OUTCOME of map × tree, so a re-band moves it:
                        an earlier tree granted `steel_toolmaking` where this one grants `steel_railway_cars`
                        — verify against the EMITTED 00_starting_inventions.txt, not this note).
                        ⭐ The predicate is BOTH "owns one on the map" AND "could have built one in
                        vanilla" (user ruling: match vanilla on could-have-built, even where the
                        technology is era 2 in our tree — all 13 of vanilla's own tier-1 named grants are
                        era 2). Vanilla's side needs the BUILDING's gate as well as the METHOD's, and the
                        id class must admit a HYPHEN: three of our tiers' `vanilla_pm` values contain one
                        and an [a-z_0-9]+ class leaves their gate reading EMPTY, i.e. permissive.
                        ⚠ Tiers 1 and 2 keep vanilla's own `add_era_researched = era_1`, so our era-1
                        technologies reach them regardless — a deliberate, small over-grant (tier 2 gets
                        `fourdrinier_machine` and `leblanc_process` unneeded). Removing vanilla's blanket
                        would strip vanilla technologies, which the rule forbids.
                        ⚠ Its source is `config/start_baseline.json`, which is why **build.ps1 now runs
                        `extract_start.ps1` BEFORE this** — a baseline written later would derive this
                        build's grant from the previous build's map. Guarded by landmines L14 and L15.
                        ⚠ **IT EMITS NO TECH-SPREAD CHANGE — spread is exactly vanilla** (user ruling
                        2026-08-12). It shipped `country_production_tech_spread_mult = 0.5` until then, for
                        which it owned a whole 900-line vanilla file; the ruling is that the deeper
                        production tree is compensated **aplenty by the research journal entries**, so the
                        boost paid twice for the same depth — and on the one lever that works AGAINST the
                        mod's goal, since spread only ever delivers what somebody else already has. The
                        BASE terms (flat 25, literacy 75) were never changed: the 2026-08-10 ruling that
                        raised them to 50/100 was superseded before it was emitted. The knobs stay in the
                        tech-tree page's spread panel, all at vanilla, because that panel is how the
                        question gets re-asked. ⇒ we no longer own `common/static_modifiers` at all
                        ⚠ EVERY vanilla transform asserts its own MATCH COUNT and throws on a no-op — "fix the
                        transform rather than shipping a silent no-op". That guard earned its keep on
                        2026-08-12: the ladder-era alignment made the era-move loop try to patch
                        `regenerative_furnace`, one of OUR technologies, into the vanilla file. The fix is the
                        `origin === 'vanilla'` filter; the point is that the build stopped rather than
                        half-emitting a tree
  emit_research_events.mjs  THE INDUSTRY-DRIVEN RESEARCH EVENTS (ROADMAP step 2) — called by build.ps1, which
                        THROWS if it fails. Reads config's `research_events` block and emits nothing when it
                        is disabled. Derives the per-technology anchor table rather than storing it: rule A
                        (improvement) from the tier ladder's own N−1 rung, rule B (necessity) from the
                        hand-authored `necessity_anchors`, rule C (war) for the military tree, rule D
                        (necessity) for non-tier production technologies, anchored on the building group of
                        whatever they unlock — parsed LIVE from the game's production_methods, so a patch
                        cannot leave it quietly wrong. Sources ACCUMULATE: a technology unlocking two
                        industries' tiers (mechanized_workshops → textile + furniture) gets one journal entry
                        fed by both, each adding a tick, so holding both fills the bar twice as fast.
                        Emits journal_entries + scripted_progress_bars + script_values + loc for all 11
                        languages. ⚠ Era-1 technologies are SKIPPED by construction — `add_era_researched =
                        era_1` hands them out at the 1836 start, so `can_research` is false from day one and
                        an event on them could never fire. Current output: 126 technologies (86 industry,
                        40 war) → 378 journal entries, 126 bars, 133 script values, ~1,265 loc keys
                        (was 122/366/115/1103 at the 2026-08-12 first emission; counts track the ladder)
  tech_tree_spec.mjs    THE INDUSTRY TECH TREE — three candidate designs (ROADMAP step 1), authored here and
                        rendered by ui/techtree.html. `--write` emits config/tech_tree_options.json + ui/techdata.js;
                        `--chains` prints each industry's ladder per option for review. It is a DESIGN DOCUMENT as
                        much as a generator — the engine constraints, the shared decisions and the three
                        philosophies are its header comment. Vanilla technologies, their eras, their prerequisites,
                        their building unlocks and their DISPLAY NAMES are all parsed LIVE from the game, so a patch
                        cannot leave it quietly wrong. It VALIDATES: every tier reachable, and no technology sitting
                        in an earlier era than one of its own prerequisites (which caught two real inversions on the
                        first run); nothing above era 1 without a prerequisite; and NO FULLY EMPTY TECHNOLOGY — one
                        we add must unlock something or carry a modifier, with every modifier NAME checked against
                        common/modifier_type_definitions, because an invented one does not error in game, it
                        silently does nothing (that check caught 10 on its first run). Also carries the NARRATIVE
                        ONSET table — a real-world date for all 239 technologies, vanilla included — and reports
                        every conflict with the era's calendar window. ⚠ It does NOT emit anything into mod/ yet
                        ⭐⭐ **LADDER-ERA ALIGNMENT (user-ruled 2026-08-12).** A technology that unlocks one of our
                        tiers is placed in the MECHANICAL era that tier maps to — the anchor principle's own
                        mapping (our e0 AND e1 → era 1, then 1:1). Until this existed nothing enforced it, because
                        a NEW technology that omits `era` gets `gameEra(year)`, and `gameEra` maps a year onto
                        **VANILLA's** era windows — `1836|1861|1886|1911` against the ladder's own bands
                        `1790|1850|1885|1912|1932`. **Two calendars, disagreeing everywhere above era 1: 41 of the
                        106 tiers were gated one era too high** (the whole tooling ladder above e1, every port
                        rung, every artillery rung). Not cosmetic — the mechanical eras exist for the ERA BASE
                        COST and the AHEAD-OF-TIME PENALTY, so an e4 rung on an era-5 technology was dearer AND
                        penalised at exactly the date it is meant to be the workhorse, and a leader sitting on the
                        era-4 anchor (1925) could not have it at all.
                        ⚠ A RULE RE-DERIVED FROM THE LADDER EVERY RUN, never a table of literals — a re-band
                        cannot silently reintroduce the drift. (The 2026-08-12 re-band worked around it by stating
                        `era` by hand on its fifteen new rungs: correct, and exactly the fix that does not scale.)
                        **Three things it will not do, each a user-stated invariant, each verified against the
                        EMITTED mod rather than the spec:** it only ever LOWERS; it never lands in **era 1**
                        (`add_era_researched = era_1` hands every era-1 technology to the tier-1/2 countries at
                        the 1836 start, and vanilla gives them none of these); and it never INVERTS a prerequisite
                        (iterated to a fixed point, since lowering one rung can free the one above it).
                        **32 moved, 9 held** — 8 that would reach era 1 (all e1 rungs whose technology postdates
                        the start: arms 1849, ports 1840, fertilizer 1842, railways, artillery, munitions,
                        shipyards) and `telephone`, blocked by `shift_work`/`electrical_generation`. Whatever it
                        declines it PRINTS: a rule that silently skips is indistinguishable from one that never
                        ran. Production went 15/14/20/23/20 → **15/18/26/19/14** per era, budget 1198k → 1148k
ui/                     browser balance editor — builder.html (hand-authored) + econ.js (hand-authored) + data.js +
                        vanilla.js + presets.js + icons.js (the last four GENERATED each build; icons.js is gitignored game art)
                        + techdata.js (GENERATED, but by `tech_tree_spec.mjs --write`, NOT by the builder)
  data.js               GENERATED each build: `generated` (the copy's build time, UTC, stated — what the
                        load banner shows when the live /api/config fetch is unavailable), `config` (the
                        WHOLE ladder, model_only tiers included — the emission path drops those, the UI
                        must not; ⚠ a BUILD-TIME COPY: when served, the page fetches the live config over
                        /api/config and this copy is only the snapshot/file:// fallback),
                        `start_exceptions` (config/start_exceptions.json embedded, so the Mod-changes
                        page can enumerate the 1836 rules standalone), `prices`, and **`techs`** — a COMPACT
                        index of the SHIPPING tech tree, `id → {n name, e game era, c category, o
                        vanilla|new, y onset}`, built from `config/tech_tree_options.json`. It is what
                        lets every building row and every ladder-chart dot name its unlocking technology
                        instead of printing a script key. ⚠ The index is the SHIPPING option, the same one
                        `emit_techs.mjs` writes into the mod, so the sheet cannot name a technology the
                        game does not have — and `emit_techs.mjs` throws when that file has fallen behind
                        the config, so the build is what keeps the index honest. ⚠ ~20 KB, deliberately
                        NOT ui/techdata.js: that is 340 KB and it is the TREE PAGE's data
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
  techtree.html         THE TECH TREE VIEWER (ROADMAP step 1) — **the balance UI's SECOND PAGE** (the
                        `Balance sheet` / `Tech tree` switch at the top left of builder.html) AND still a
                        complete standalone page openable off the filesystem, reading the GENERATED
                        techdata.js. It is embedded in an **IFRAME**, deliberately: it is a whole page whose
                        selectors (`header`, `.row`, `.legend`, `.stats`, `.node`) collide head-on with the
                        sheet's, and a frame isolates both directions for free while leaving this file
                        byte-identical and independently openable. **LAZY** — the frame is not filled until
                        the page is first visited, so the sheet never pays for ~340 KB of tree.
                        ⚠ TWO SOURCES, one frame: served from `ui/` it loads by `src`; inside the standalone
                        snapshot the whole page (techdata.js already folded in) arrives as
                        `window.__TECHTREE_HTML` and goes in by `srcdoc`. `tools/bundle_ui.mjs` FAILS the
                        bundle if either half has moved, and builder.html shows a named warning rather than a
                        blank frame if a host's CSP refuses the nested frame.
                        ⚠ `techdata.js` is generated by `node tools/tech_tree_spec.mjs --write`, which the
                        BUILDER DOES NOT RUN — refresh it by hand after a ladder change. Whether it is behind
                        the LADDER is already answered, and THROWN on, by `emit_techs.mjs` inside the build;
                        the bundler only checks that techdata.js and config/tech_tree_options.json carry the
                        SAME `generated` stamp, i.e. that the pair came from one run.
                        ⚠ NOT an mtime check against the config — `--write` writes techdata.js and then
                        stamps the config, and the build rewrites the config again after that, so techdata.js
                        is older than mod_config.json after every normal build. The first version of this
                        guard warned on a perfectly current pair, which is how a guard teaches people to
                        ignore it. Era is a ROW and progression runs DOWNWARD, as in the
                        game; unlike the game, COLUMNS ARE INDUSTRIES, so an industry's ladder reads as one
                        vertical line. Hovering a technology names what blocks it and what it blocks; clicking
                        pins that. Switches option (1/2/3) and tree (production/military/society) and reports each
                        combination's research budget against vanilla's. Colours every dating conflict against the
                        era's calendar window. Carries the **TECH SPREAD panel** — the three constants of the
                        spread formula are editable and it shows, live, the SHARE OF EACH TREE that spread alone
                        hands a laggard by 1936, judged against vanilla's own share rather than against zero
                        (that share, not the multiplier, is what says whether a boost is safe). The panel also
                        carries its ONE emitted row: **AI research weight ×** per tree (config
                        `tech_ai_weight_mult`, default 1/1/1 = nothing emitted) — round-tripped to the parent
                        sheet over postMessage, because the config write path (Export / Build now) lives
                        there; read-only with a note when the page is opened truly standalone
mod/                    THE DEPLOYABLE MOD — GENERATED, do not hand-edit
  .metadata/metadata.json                                (hand-maintained, except the mod `name` which the builder suffixes with the build time; has replace_paths for history)
  common/buildings/{01_industry,06_urban_center,11_private_infrastructure}.txt   (generated: WHOLE-FILE replacements of vanilla — 06/11 own the new-economy chains — see MODDING_NOTES)
  common/ai_strategies/01_admin_strategies.txt            (generated: WHOLE-FILE replacement of vanilla — rewrites the `subsidies` block of all 7 administrative strategies from `building_subsidies`; see AI subsidy policy)
  common/{production_methods,production_method_groups}/zzz_pm_rehaul_*.txt   (generated, additive)
  common/production_methods/<vanilla name>.txt           (generated: WHOLE-FILE replacement, but ONLY for the vanilla PM files we actually CHANGE — secondary-PM gate remap + per-PM `pm_goods`/`pm_employment` overrides. A file we would copy verbatim is NOT emitted: owning it would freeze that vanilla file against the next patch and ship bytes we didn't author, for nothing. Today that means `01_industry.txt` (gate remap) and `06_urban_center.txt` (the §10.43 electric-streetlights override). See below)
  common/history/buildings/*.txt                         (generated: the re-tiered 1836 start; replaces vanilla via replace_paths)
  common/on_actions/zzz_pm_rehaul_diag.txt               (generated: self-diagnostic tripwire; logs PM_TECH_REHAUL init marker to debug.log at game start — see MODDING_NOTES → Self-diagnostics)
  common/journal_entries/zzz_pm_rehaul_research.txt      (generated by emit_research_events.mjs, ADDITIVE — three journal entries per covered technology: inception / development / implementation. Only the FIRST auto-activates, from `is_shown_when_inactive = { can_research = X }`; the other two are placed by `add_journal_entry` from the one before. Each grants half the era base cost and logs `PMR_JE|<stage>|<tech>|<country>` on completion, which is how a batch counts firings. Absent when research_events.enabled is false)
  common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt  (generated, ADDITIVE — one bar per covered technology, shared by its three stages, each instance starting at zero. `monthly_progress` for industry entries (36 months), `weekly_progress` for war ones (26 weeks). One tooltipped `add` term per contributing source, so several qualifying industries fill the bar proportionally faster)
  common/technology/technologies/zzz_pm_rehaul_techs.txt (generated by emit_techs.mjs, ADDITIVE — the technologies the mod ADDS (42 at the current tree: 27 production, 14 military, 1 society), each with its era, prerequisites, unlocks and the minted placeholder icon)
  common/defines/01_pm_rehaul_defines.txt                (generated by emit_techs.mjs, ADDITIVE partial override — TECH_AHEAD_OF_TIME_PENALTY_FACTOR. ⚠ ships at 0.25, which IS vanilla's value — currently a NO-OP, flagged on the UI's Mod-changes page: the 0.15 boost was withdrawn by the 2026-08-12 ruling and the emission outlived the setting)
  common/technology/technologies/{10_production,20_military,30_society}.txt (generated: WHOLE-FILE replacements of vanilla — 20 and 30 ONLY EXIST WHEN THEY CARRY SOMETHING. 10 carries the ERA MOVES + the `aniline` prerequisite swap; **20 carries era moves too** — until 2026-08-12 emit_techs patched 10 alone, so a re-era on a MILITARY technology was written into the spec, drawn by the viewer, and silently dropped on the way to the mod, with nothing failing anywhere; the ladder-era alignment moves three (repeaters, breech_loading_artillery, bolt_action_rifles) and that is what surfaced it. Any file also takes the per-tree `tech_ai_weight_mult` multiply when ≠1 — **at the ruled default 1/1/1 (2026-08-17) 30_society is NOT emitted at all**; its hardcoded ai_weight ×0.8 (2026-08-11) is superseded — no tree is damped or favoured by default, the research JEs being boost enough. Each transform asserts its own match count and THROWS on a no-op)
  common/scripted_effects/00_starting_inventions.txt     (generated: WHOLE-FILE replacement — the new era-1 production technologies added to the 1836 starting sets. ⚠ `add_era_researched = era_1` is the ONLY era granted at the start, which is exactly why the ladder-era alignment refuses to move anything INTO era 1)
  common/script_values/zzz_pm_rehaul_research_values.txt (generated, ADDITIVE — per-source employment sums, `Σ(level × occupancy) × employment-per-level`. ⚠ occupancy is a WEIGHT, never a `limit` filter: the filter form scores seven half-staffed levels as zero while passing three full ones, which is the opposite of the intent)
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
  `force_tier` (set tier N regardless of vanilla PM), `force_industry_tier` (re-tier onto ANOTHER
  config industry's tier N — fields `industry` + `tier`; needed when the target chain is a separate
  industry whose base building never appears in vanilla history, i.e. the steamer chain; an unknown
  industry id THROWS) or `remove` (delete the factory), plus an optional `owner` field that rewrites
  the block's ownership to another tag (safe only on single-owner blocks — the converter warns). Most
  specific scope wins. The rules list currently carries the **RATIFIED §10.60.3 CHAIN SEED (28
  rules)** — the anchorage→steam-stub conversions in the GBR/FRA markets (12 subject-owned ones
  rewritten to the overlord), the two metal-shipyard seeds and the FRA motor factory; see the
  repo-layout entry above and the file's own `_why_chain_seed` comment for the design rule. The
  earlier §10.59 steamer seed stays **REVERTED** (F66: it fed the abnormal from-start steam-port
  construction — the AI builds one level per overseas state per port building TYPE (F66's MEASURED
  pattern; the rule itself is NOT identified); the graded
  ports fixed the disease). To author
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
- ⭐⭐ **BUILDING COST IS EXACTLY VANILLA'S OWN COST BOOK, FLAT** (user-ruled 2026-08-17,
  BALANCE_FRAMEWORK **§10.61** — superseding §10.57's two-band ×1.5^(era−1) ladder). Each tier's
  `building_cost` (construction points) is emitted as the building's `required_construction` (a per-tier
  number replacing vanilla's flat `construction_cost_*` script-values; the building-level
  `required_construction` in the config is the anchor CLASS and the fallback for tiers without
  `building_cost` — the three clone industries now carry it explicitly: power/port
  `construction_cost_medium`, railway `construction_cost_very_high`). The rule:
  ```
  building_cost (points) = VANILLA's required_construction for the industry's anchor building
                           × the tier's workforce_mult where set (graded ports: ×0.1 / ×0.2)
  ```
  **Flat across tiers — no band, no era exponent, no exceptions.** The whole book is four lines:
  **400** power, art_academy · **40/40/40/80/80** port · **600** food, textile, furniture, glass,
  tooling, paper, shipyard, shipyard_steam, arms, artillery · **800** fertilizer, explosives, steel,
  motor, automotive, munition, synthetics, electrics, railway.
  ⭐⭐ **WHY THE EXPONENT DIED — DOUBLE JEOPARDY (the user's word).** Modernising already costs the full
  price of constructing a NEW building — that is the tier split's whole point — so an era exponent
  priced the same thing twice, and the ×2 band compounded it. Eras are priced by what their recipes eat
  and the research to unlock them, not by a cost multiplier. §10.57's named-exception table is retired
  with the ladder. (The ruling was first made for the parity restart — HANDOVER 2026-08-16 §1b's "×1.0
  flat vanilla anchors" — and ran as the vancost arm; it reached the canonical config only on
  2026-08-17, when the user caught the UI still showing the exponential book.)
  ⚠ **Payback is now a READING, not a check**: dominant-rung medians run 9.9 → 1.2 across the eras
  (late tiers earn late margins against an 1836-priced building). Accepted consequence of the ruling —
  do not re-fit costs to restore the old ~11.5y figure; that reintroduces the premium the ruling
  removed. ⚠ An earlier form derived cost from output value and a measured profit ratio; **rejected as
  "still per-building fitting"**. Do not reintroduce that either.
  ⭐ **THE GRADED PORTS RIDE `workforce_mult`** — §10.60.2's regeneration trap ("payback_census --write
  would un-divide port building_cost") is **CLOSED**: the division is part of the rule itself.
  ⚠⚠ **NOTHING IN THE RULE TOUCHES PROFIT** — the inputs are a vanilla constant and a config
  multiplier, so a negative or infinite cost is impossible *by construction*. Explicit user
  requirement, carried over from §10.57.
  ⚠ **£720/point is the IRON-FRAME rate and is kept FLAT by the same ruling.** The real rate is
  **1000 / 720 / 720 / 540 / 540 / 527** across our eras (wooden → iron → steel → arc, gated by
  `urban_planning` / `steel_frame_buildings` / `arc_welding`), so an era-5 building really pays back
  ~27% faster than the book says and era 0 ~28% slower. **An accepted, known bias** — F53 has the table.
  ⚠ `building_cost` is a pure OUTPUT: nothing in the solve reads it back, so writing it needs no
  re-solve and cannot disturb the fixed point. **`tools/solve_building_cost.ps1` is LEGACY for tiers on
  this ladder** — its assumed 20% return on operating cost against a 56–104% realised margin is exactly
  what put the shipped book at a ~2-year payback. It still documents the older model (BALANCE_FRAMEWORK §9)
  and still serves any tier off the era ladder. **wages** use the shared `wage_pct` (fraction of total,
  default 0.25, per-tier `wage_pct` override — the same knob the volume solver, linter, and UI use; §1).
  The UI preserves `building_cost` through export/Build-now (it deep-clones the config), but does not
  itself edit it.
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
  ladder normally (electricity output; `output_override` keeps its vanilla per-tier electricity).
  ⭐⭐ **PORTS ARE FRACTIONAL-UNIT BUILDINGS (§10.60/§10.60.2, user-ruled + implemented 2026-08-16):** the
  AI builds one level per overseas state per NEW port TYPE and no script we tried can stop it
  (F66 — ai_value measured inert), so the port unit was shrunk instead:
  ⚠ **"PROVISIONING" WAS OUR OWN LABEL FOR AN UNIDENTIFIED RULE and is retired (2026-08-17).** F66
  establishes the PATTERN on good evidence — arm-independent of the subsidy mandate, magnitude tracking
  the count of overseas possessions (GBR 12 · FRA 10 · BEL 1 · USA 0 · PRU 0), one level per overseas
  state per port type in the 1855 save — and says in its own text that *"the exact rule — hardcoded vs
  NAI — is not identified from files"*. It runs through the PRIVATE CONSTRUCTION QUEUE, so it is
  ordinary construction, not a separate placement path. Do not cite it as a documented engine feature;
  the shrink is justified by the measured pattern, which is enough. the five tiers' goods and
  building_cost are divided by 10/10/10/5/5 EXPLICITLY in the config, and per-tier `workforce_mult` /
  `effect_mult` (0.1/0.2) scale employment and infra at emission. The 1836 start multiplies port levels
  by 1/workforce_mult (anchorage entries stay level 1). Validated: the provisioning wave still fires but
  costs ~1/10 (GBR's whole steam wave ≈ 480 pts, absorbed in weeks, queue share collapsed from 100% to a
  blip). §10.60.2 lists the regeneration traps; the payback_census one ("--write would un-divide the
  cost") is CLOSED since §10.61 made cost = vanilla anchor × workforce_mult.
  ⭐ **POWER = THREE TIERS, NO GAPS (§10.43 + §10.44, 2026-08-09):** coal-fired turbine station
  (`building_power_plant`, the vanilla key so `has_building` references keep matching; tech
  `steam_turbine` — deliberate-early; **era 3, tech_year 1900**, Elberfeld), **pulverized-coal**
  (`building_power_plant_pulverized` — an ALL-NEW tier like the steamer chain, NO vanilla PM; tech
  `electrical_capacitors` as the closest grid-equipment gate; era 4, year 1920) and oil-fired (era 5,
  year 1925). The vanilla era-3 "Early Power Plant" tier is GONE: the 1900 MUNICIPAL engine-house is
  modelled inside urban centres via the MANDATED electric-streetlights method (`pm_goods`: +1
  electricity out, −2 coal in (ruled; 1 coal left the mandate too profitable, 3 would force a
  loss-maker — §10.43.2); `pm_employment`: 250 engineers, laborers gone — the streetlight PMG is a
  solver PREREQUISITE per era via `MANDATED_PMGS` in era_pm.mjs: none @0, gas @1-2, electric @3+, never
  an economic choice). No debut exemption — the DATE GATE (§10.44) places the coal station at 1900 on
  its own year; hydro is deliberately NOT a market industry (small-scale folds into the UC
  narrative, large-scale is a site-specific megaproject like a canal, outside the scenario model). Their PMs
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
  showing every building × tier with editable **main-PM** input/output volumes.
  ⭐ **EVERY BUILDING NAMES ITS UNLOCKING TECHNOLOGY** — on the row (`🔒 Bessemer Process · tech era 2`,
  hover for tree, onset and vanilla-vs-new) and on every dot of the **Ladder chart in `raw` mode**, where
  the rung's position is meaningless without knowing what gates it. Our tiers name the MOD's technology
  (`tech_tree_spec.mjs` stamps it into the config), reference buildings their vanilla one; both resolve
  through the same `PMDATA.techs` index. ⚠⚠ **THE TWO ERAS ARE DIFFERENT NUMBERS.** A tier's era is its
  rung on the mod's SIX-era ladder; a technology's era is its row in the GAME's five-era tree, where our
  0 and our 1 both sit in game era 1 (the anchor principle). So an `e0` building on `tech era 1` is
  correct — which is why the label says "tech era" and never bare "era".
  ⭐ **THREE PAGES, one window** — the `Balance sheet` / `Tech tree` / `Mod changes` switch at the top
  left. They are views of one config, so they are pages rather than windows; the tree is
  `ui/techtree.html` in an iframe (see the repo layout for why a frame and how the snapshot carries it),
  and **Mod changes** (user-ruled 2026-08-16) is an inline READ-ONLY page — the whole set of changes the
  Build button emits beyond the sheet's per-tier recipes, compressed into readable points grouped by
  theme (tier split / emission rules / PM surgery / 1836 start / tech tree / research events / AI
  behaviour / meta+guards). Numbers and lists on it are interpolated from the loaded config + live
  session state on every visit, so they cannot go stale against the sheet; the prose states the
  builders' fixed rules and is maintained WITH them (`renderModChanges` in builder.html — same doc-sync
  convention as this file). There is deliberately NO add/remove-a-point UI, ever: the page is a faithful
  VIEW of the emitted set. It absorbed the short-lived "Shipped arm" card (2026-08-16's first cut).
  ⚠ marks on it flag verified divergences between stated intent and what ships (e.g. port/railway names
  carrying a meaningless BE label; the ahead-of-time define shipping at vanilla's own 0.25 — a no-op);
  resolving those is a design decision, not the page's. Every header control
  belongs to the SHEET, so the other two pages hide the lot rather than offering buttons that do nothing
  to what is on screen.
  ⭐⭐ **THE SHEET OPENS ON EXACTLY WHAT THE BUILD BUTTON WOULD SHIP** (user-ruled 2026-08-16). Served by
  `tools/ui.ps1` the page fetches **`GET /api/config`** (the live `config/mod_config.json`, verbatim) and
  `GET /api/start_exceptions` synchronously at boot and swaps them into `PMDATA` before anything reads it
  — closing for the UI the same stale-copy trap `econ_host.mjs` closed for the Node solvers (`ui/data.js`
  is a BUILD-TIME copy, stale the moment a solver `--write` touches the config without a build). The
  standalone snapshot and a `file://` open have no server and keep the embedded copy (stamped
  `PMDATA.generated`, UTC); the load banner states which source the page is on either way. No reconcile,
  no re-solve on load — the config is authoritative and is shown as-is. **Wages now stem from the
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
  **NOTE:** `reconcileToWageModel` — the old load-time re-solve of every unlocked group to its
  `target_be` at base prices — is **REMOVED** (tombstone at the bottom of `builder.html`). It was right
  while the config's volumes came from the legacy wage model at 100% prices; it became actively wrong
  once `era_scenarios.mjs` solved each tier against its own era's realised prices (`target_be` is only a
  drift guard now), because the re-solve threw those volumes away before they could be read. The sheet
  loads the config **as-is** and shows it; `solve → targets` remains available as an explicit action.
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
  re-renders: a **`locked` checkbox** (default **OFF**) and a **`100%` button**. ⚠ **Prices are UNLOCKED by
  default — on load and after EVERY preset**, including presets that carry no prices of their own. Realised
  prices are the whole design; a locked panel shows numbers the scenario in front of you did not produce, and
  leaving a hand-locked price standing over someone else's order book is worse still. Locking is the
  deliberate act (pin a price, see what it does), not the resting state. **Locked** = prices are manual —
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
  scenario is your own, so **nothing in the panel may claim you are "in" a preset**: no STICKY active-button
  highlight, no standing description of the market / subsistence / lock state.
  ⚠ **What this forbids is an assertion that can go STALE, not the fact itself.** A preset button carries a
  **`.same` ✓ badge** meaning *"pressing this would change nothing"* — DERIVED from the live state on every
  render, so it vanishes the instant anything diverges and returns if you undo. It never claims you are "in"
  anything and it cannot lie, which is the property the rule was protecting. Built exactly like the recipe
  badge: `scenarioSnapshot()` is the one definition of the scenario, shared by the fingerprint AND by
  save/restore. Three things it had to learn, each of which produced a wrong badge first:
  (1) **a preset's result depends on the state it is applied from** — several write prices, SoL, base wage or
  the working-adult ratio only when they carry one — so there is NO per-preset cache; the probe applies the
  preset *from here* through the real `applyScenarioPreset(id, quiet)` and asks whether the state moved;
  (2) **in AUTO price mode `thresholds` are derived, not state** (render recomputes them from the order
  book), and the quiet probe does not render — so the probe calls **`syncScenarioPrices()` itself**. Prices
  are then compared **unconditionally**, which is what keeps a price EDIT clearing the badge, while the
  **lock toggle is deliberately NOT in the key at all**: locked-vs-auto changes how a price is *decided*,
  not what the market *is*, so flipping it must leave the badge alone.
  ⚠⚠ **An earlier attempt excluded prices from the SNAPSHOT instead, and that was destructive** — the
  snapshot is what `scenarioRestore()` puts back, so a field filtered out of it is a field **destroyed** on
  the next probe. It emptied the live price table on every refresh; auto mode's own recompute silently
  repaired it, so the damage only surfaced once the panel was **locked** and every price read **£NaN**. The
  snapshot is faithful and complete; normalisation for comparison happens in the fingerprint;
  (3) **`REFSEL` is part scenario, part lazy default** — `refSel()` fills each PMG's base PM the first time a
  reference building is RENDERED, so it is populated after a click and empty after a quiet probe; entries
  equal to the default are normalised away. Full pass over ~22 presets costs ~50 ms, so it runs immediately
  from `render()` and **debounced 200 ms** from `updateComputed()`. Everything a preset knows about itself —
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
  ⭐⭐ **Each pop need's money is split across ALL its goods by a rule that is now SOLVED AND MEASURED
  END TO END — FINDINGS F40 (2026-08-07)** (`needSplit()`):
  ```
  availability(g) = ( market sell orders(g) − 0.5 × NON-POP demand(g) ) × BASE price(g) × LOCAL(g)
  raw share       = availability(g) / Σ availability over the need's own goods
  purchase weight = base weight(need,g) × clamp( raw , min_supply_share , max_supply_share )
  units           = need money × (purchase weight / Σ purchase weights) / base price(g)

  LOCAL(g)        = 0.40 if g is `local` (services, transportation, electricity), else 1
  ```
  **Availability is a VALUE, not a unit count** — that is the one thing this changes and it is the whole of
  it. Measured against the purchase weights a savegame stores: a gamestate's own supply and non-pop demand
  reproduce that same gamestate's weights to **0.82 pp over 16 863 entries** (VANILLA, American market, 1904) with
  every term switched on — replicated on four gamestates across two arms and two decades (0.66-0.82 pp
  American, 1.13-2.46 pp British) with every need under 1.45 pp. `S.AVAIL_MODE = 'units'` restores the old count-based reading as an A/B switch.
  ⭐ It is confirmed by a second, independent measurement: re-scored against the game's own 1836 pop
  **consumption** telemetry it improves the mean absolute error across 7 markets from **20.0 % to 18.3 %**.
  ⭐⭐ **THE VALUE READING SURVIVED ITS SHARPEST CHALLENGE (F44, 2026-08-07).** The 1.13 wiki's
  `market share of good` formula carries **no base price** and the page says outright that pops "never
  consider either the base price or market price … in choosing which goods to purchase in what amounts" —
  F40 inverted. Re-scored on the game's stored weights, `--avail units` is worse in **32 of 32** cells
  (16 vanilla market-dates × non-local/local), **5.85×** and **5.73×** on the means (0.500 vs 2.924 pp,
  0.828 vs 4.745 pp), with the two distributions **completely disjoint**. Do not adopt the units reading;
  the switch exists to re-score it, not to configure it.
  Every good the need lists is a candidate — an unsupplied one scores zero and drops out by itself,
  which is why there is no separate availability gate. The **slave basket** goes through the same
  split, fed the same supply and non-pop order book in the same pass.
  ⚠ **KNOWN DIVERGENCE — an EMPTY need should buy its DEFAULT good, exclusively** (F44). When a need has no
  supply at all in the scenario, `needSplit` falls back to `config/pop_distribution.json` and then to the
  vanilla `weight` vector; the game buys the need's `default` good and nothing else. The default is already
  in our data (`"def"` per need in `ui/presets.js`, from `extract_presets.ps1`) and simply unused on that
  path. **Not fixed** — it moves scenario demand, so it needs measuring through the era solve first.
  ⭐⭐ **THE `local` GOODS MULTIPLIER IS THE ONE THING F43 ADDS (2026-08-07, BALANCE_FRAMEWORK §10.37).**
  `services`, `transportation` and `electricity` are `local = yes`: a state's *substitution* supply is its
  own production plus `(1 − its GDP share) × 0.25 ×` the market's. We used to give them the market's whole
  supply on the argument that our one state IS the market — true, and the wrong question, because pops live
  in states and a state that is the whole market is the one state the rule does nothing for. We now model a
  **representative** state — a fifth of the GDP holding a fifth of the local supply — giving
  `0.2 + 0.8 × 0.25 = 0.40`. **Measured on eight PURE-VANILLA gamestates × two markets: local-good needs err
  0.835 pp against 4.226 pp unaugmented, better in 16 of 16**, with the derived 0.40 landing 0.03 pp off the
  swept optimum. ⚠ It multiplies the **whole availability**, not the supply alone — scaling supply while
  deducting a whole market's industry zeroes electricity out. `S.LOCAL_MULT = 1` (env `LOCAL_MULT=1`) is the
  A/B, not a setting. ⚠ On the era ladder it is **neutral** (41/28 → 43/30, inside the jaggedness); it ships
  because it is closer to the game, not because it scores better.
  ⚠⚠ **WHAT IS IMPLEMENTED vs ONLY DOCUMENTED — check this before trusting a scenario number.**
  `needSplit()` implements the **core rule**: value-weighted availability, the −0.5 non-pop deduction, the
  min/max clamp, and the `local` multiplier above. Already present from earlier work: the peasant
  `class_mult` 0.05 and the 0.625 dependent factor. **Three measured terms are deliberately absent**
  (`grep prestige\|obsession\|taboo ui/econ.js` returns nothing) — **prestige goods**, **culture obsession**
  and **religion taboo**, all genuine no-ops here: our scenarios contain no prestige goods and the model has
  no culture dimension. Safe to leave out.
  ⚠ **Three terms of the game's real rule are deliberately NOT modelled, because our scenario has no
  dimension for them**; each is measured and written up in F40 so the omission is a choice, not an oversight:
  the **prestige-goods** multiplier (`1 + prestige_goods_demand_increase × prestige share of supply`;
  measured against the save to 0.6 pp on five goods), culture **obsession** (a floor on the PURCHASE WEIGHT of
  `clamp(obsession_demand_min × max_supply_share × weight, obsession_demand_min², obsession_demand_min)`) and religion **taboo** (`× 0.5`, exact). ⚠ **Obsessions are
  RUNTIME state, not file content** — the game adds and drops them all campaign, so reading them from
  `common/cultures` puts a 1925 culture 220 pp wrong.
  ⚠⚠ **THE OBSESSION/TABOO OMISSION IS TWICE AS BIG AS THAT — there is a SECOND, CROSS-NEED channel** (F44,
  2026-08-07). Besides the within-need weight term above, an obsession or taboo moves **the whole NEED'S
  BUDGET by ±25 %** — `OBSESSION_POP_NEED_EXPENSE_MULT = 0.25` / `TABOO_POP_NEED_EXPENSE_MULT = -0.25`,
  *"scaled by number of obsessions, money is given or taken from other needs"*, so the pop's total buy
  package is unchanged and the money moves BETWEEN needs. Still a no-op for us (no culture dimension), but
  it is not the same no-op we had recorded. Also `MAX_NUM_OBSESSIONS = 3`.
  ⚠ **Trust the DEFINES over the wiki on these constants**: the wiki states obsession = "min weight 1, ×2",
  where the game ships `DEFAULT_OBSESSION_DEMAND_MIN = 0.5` / `DEFAULT_OBSESSION_DEMAND_MULT = 1.5` with
  **no pop need overriding either**, and the wiki's numbers score 1.5–3.5 pp against our 0.3–0.9 pp in 6 of
  6 cells. Likewise prestige is `1 + 0.5 × share`, not the wiki's "direct proportion" (⇒ 1.0), which we
  already had right — though the define scopes that share to **local** supply where we use the market's, an
  open point.
  ⚠ **The weights the save stores are per (state, CULTURE).** A rate limiter also exists
  (`MAX_DEMAND_ADJUSTMENT_BASE_AMOUNT` 0.01 + `_SCALED_AMOUNT` 0.09 per update), but ❌ **it is NOT what
  makes a debut good ramp** — measured over three saves, the observed share sits on its computed target
  every year (0.11497 vs 0.11195, 0.15474 vs 0.16900, 0.21214 vs 0.21738) with no accumulating lag.
  ⭐ **THE "DEBUT SPIKE" IS ANSWERED, on vanilla, across the ramp.** Automobiles first trade in the
  American market at 1902.1.1; by 1904 the game gives them **38.4 %** of `free_movement` on 513 units
  against transportation's 8 550. Two ordinary terms produce all of it: automobiles cost **£100** against
  transportation's £30 and availability is a *value*, and **transportation is `local`** so a state sees its
  own supply plus a quarter of the market's. The local-corrected target tracks the whole ramp
  (0.068/0.049 · 0.402/0.384 · 0.415/0.412) where market-wide transportation is out by ~1.9× throughout,
  and it **plateaus** rather than climbing. **Stop looking for a demand mechanism that favours a newcomer —
  there isn't one, in either direction.**
  ✅ **THIS WAS THE ONE PLACE OUR MODEL DIVERGED MATERIALLY, AND IT IS NOW FIXED (F43).** Our scenarios are
  single-state, so `needSplit` used to give a local good its full market supply and a debut good only
  **21.9 %** where the game gives 38.4 % — under-stating a new good's share in every need containing a
  `local` good (`free_movement`, `communication`, `leisure`, `services`, `heating`). The 0.40 multiplier
  above closes it. ⚠ It does **not** rescue §10.32's era-1 steel case: steel is in no pop need at all, so no
  pop-demand correction can reach it.
  ⚠⚠ **THE RESIDUAL NOW POINTS THE OTHER WAY — 0.40 slightly OVER-corrects.** Read as shares: automobiles in
  `free_movement` predicted **0.2192** before and **0.4124** now, against an observed **0.3768**; leisure's
  services land at 0.2755 against 0.2319. The miss fell 15.8 pp → 3.6 pp *and changed sign*. So "our model
  under-states a debut good's share" is a **pre-F43** statement and must not be carried forward. ⭐ The
  biggest single gain was `leisure/services` (48.7 % predicted against 23.2 % observed), which was starving
  six competing goods at once; steamers and automobiles in leisure now land at 0.00 and 0.01 pp.
  ✅ **The weights are VERIFIED correct against the game files** (2026-08-04): all **52 entries across 15
  needs** match `common/pop_needs/00_pop_needs.txt` exactly — every `weight`, `max_supply_share`,
  `min_supply_share` and `default` — and **29 of the 52 carry a non-default weight**, so this was a real
  thing to get wrong. Re-check after a patch. ⚠ But the art-academy story built on top of it was wrong:
  `fine_art`'s budget is **not** fixed (it grows from 2% to 84% of the leisure need as academies are added);
  the binding constraint is that fine_art costs **£200**, so even 84% of that budget buys 96 units while one
  academy level makes 14.4. See BALANCE_FRAMEWORK §10.19 — the lever is academy OUTPUT, not the demand model.
  ⭐⭐ **AND THE LEVER TURNED OUT TO BE NEITHER — IT WAS A HAND-PINNED COUNT (§10.40, 2026-08-08).** The
  solver carried `FIXED_COUNTS = { art_academy: {cur:2, m1:2, m2:1} }`, so the count controller's ONLY lever
  was a constant for this industry and it could never close fine_art's gap to its own price path: **117% of
  base realised at era 5 against a path asking 75%**, 42pp adrift, for as long as the pin existed. Removing
  it puts fine_art **on the path in both era 4 and era 5** and takes `art_academy` out of era 5's inverted
  list. The observed "old academies are wildly more profitable than new ones" (era-3 +115% against era-5
  +2%) was **manufactured by the pin**: each tier's recipe is solved once at its own era's price, so a
  rising output price flatters every older rung. Solving them normally is now the default
  (`ERA_ART_NORMAL=0` restores all three exceptions — the pin, a 10:1 value-added cap, and exclusion from
  the ladder criterion).
  ⚠ **Solving them normally and SCORING them normally are different decisions.** The illogicality excusal
  exists because countries build academies for **prestige**, which this model does not represent at all —
  that argument is untouched by this result, and the excusal is kept. The report now prints which set it
  excused (`excluding shipyards` vs `excluding shipyards/art academies`) so the two can never be silently
  confused again.
  ⚠ The **−0.5 × non-pop buy orders** term is the one that matters most and is the least guessable —
  a good industry consumes heavily is correspondingly less available to pops, and omitting it over-fed
  grain by half (same-run Belgian test: pop demand error 30.3 % → **16.2 %**, F22).
  ⚠ The bounds **clamp**. The wiki's **prose** says market share "has no effect" outside them, which reads
  as reverting to bare `weight`, and that is measurably wrong: liquor is ~95 % of Belgium's intoxicants
  supply and the reverting reading predicts 102 against 201 observed, where clamping gives 199.
  ⭐ **But the wiki's own FORMULA agrees with us** (F44): the `<math>` block that prose is glossing writes
  `purchase weight = weight × ( min < market share < max )` — a clamp. So the wiki is a **third** agreement
  with the shipped reading, next to the `00_pop_needs.txt` header comment and F31. Scope any "the wiki says
  otherwise" remark to the page's prose. ⚠ **The page's formulae render as IMAGES**; a text scrape misses
  all five. Read it as raw wikitext (`?action=raw`).
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
  numbers, and nothing stored per scenario.**
  ✅ **The "units, not money / current, not base price" correction F39 once demanded is WITHDRAWN** — F39's
  own corrected box already retracted it against the savegame, and F40 confirms the shipped reading
  (`units ∝ purchase weight / BASE price`) directly. Do not reintroduce it.
  ✅ **`local` goods (services, transportation, electricity) need NO change on our side, and that is a
  result rather than an omission.** In the game their substitution supply is *the state's own plus
  (1 − the state's GDP share) × 0.25 × the market's production*
  (`LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR`, "only for goods substitution supply and not for price
  calculations") — ⭐ the mechanism behind the unexplained `transportation ÷ 1.6–2` the previous session
  could not name; it was never a divisor. **But a model whose one state IS the whole market has a GDP share
  of 1, so the augmentation term vanishes and the effective supply is the market's** — which is what
  `needSplit` already uses. The 2.2× gap is a property of comparing our model against *one state* of a real
  multi-state game, not an error in the rule we ship. It is not circular and not a time series:
  pops never sell, so supply does not depend on pop demand, and the split is one pass over the scenario's
  own sell orders. ⚠ **February, not May** — the same rule scored against May 1836 is worse, so the
  substitution lag does not pay for the construction drift a wider gap brings in.
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
  **THE SLAVE CHANNEL IMPLEMENTS F61** (re-derived 2026-08-16 by user ruling — "pick the one that gives
  the closest result from melting"): **slave pops consume in the POP line at their own wealth**
  (`popSpend` includes the slaves class at `solOf('slaves')`, 0.75/head via their working_adult_ratio
  0.5, no class multiplier — melt-scored, the USA closes 0.863→1.003 only with all of them in), **and
  the "purchased for slaves" building line is an ADDITIONAL purchase = employed (non-subsistence)
  slaves × per-head package at FULL rate** (no dependent discount, no 0.05 subsistence term —
  `slaveBasketMult()` is now the employed share alone; F61 measured the old form at USA 1.094 vs this
  form's 0.984, per-good spend-weighted |err| 1.9%). The employed share still comes from
  `slaveRealShare()`'s residual-employment derivation, unchanged. `tools/econ_selftest.mjs` carries the
  F61 checks; ⚠ builder.html's fork mirrors all three functions — change BOTH or neither.
  **The superseded F27 reading below is kept for the record** (its share derivation and its
  measurements survive; only the channel split changed):
  the game never has a slave buy anything — the **building
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
  ⭐⭐ **POPULATION IS EDITED BY PROFESSION, AND A STRATUM IS ALWAYS THEIR SUM — never an input.** The
  **By profession** row carries **all 16 pop types** (`PROF_ORDER`, peasants and slaves included — they are
  strata in their own right, so with the class row read-only this is the only place to set them), and it is
  **always rendered with every field present, zero included**. The class row (`upper / middle / lower /
  peasants / slaves`) is **always read-only** and always the sum; there is no `data-pop` write path at all,
  so removing the `readonly` attribute cannot silently reintroduce a second source of truth.
  ⚠ **This used to be conditional and it inverted the model.** A `HAVE_POPPROF` flag gated *both* whether
  the profession row existed *and* whether the strata were editable, so a preset carrying no professions
  made the DERIVED quantity the input and the profession row vanish entirely — the sheet silently changed
  shape depending on which preset was loaded. The flag is gone; do not reintroduce a conditional here.
  **Every generated preset now carries `pops_by_profession`**, from
  **`config/measured_1836_professions.json`** (per COUNTRY, summed over the preset's own market members —
  market membership stays `extract_presets.ps1`'s job, from history, so there is no second definition of
  it). Placeholders have no country, so their authored stratum totals are split by the **world's own
  within-stratum profession shares** from the same gamestate — one documented rule, not a per-preset
  invention. A hand-written preset with only classes still loads: each class goes onto one representative
  profession (lower→laborers, middle→clerks, upper→aristocrats) and the UI **warns in the banner** that the
  totals are right but the profession *mix* is fabricated — and the mix is what prices wages.
  ✅ The two sources cross-check: derived strata vs each preset's independently-derived `pops` agree to
  **0–1 %** in six of eight country markets. ⚠ **The USA is out by 12–15 % on every stratum and −43 % on
  slaves, and Russia/France by 63–90 % on slaves** — two independent derivations disagreeing, not yet
  explained; the save's 2.03 M US slaves is the historically plausible one.
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
    ⚠⚠ **IN THE ERA SOLVER THAT FORMULA IS A CEILING, NOT A COUNT (§10.40; `ERA_URBAN_SHRINK=0` reverts).**
    F13 measures how many levels urbanization *entitles* a market to; the game then staffs them out of
    whoever is available, so an urban centre that cannot pay its way **sheds employment** rather than
    standing fully manned at a loss. Our model has no employment scaling, so holding the entitlement AND
    full employment modelled a building that would not exist — measured margins **1780 −19% · 1836 −49% ·
    1870 −2% · 1900 −2% · 1920 +17% · 1945 +15%**. The loss-making reduction may now cut urban centres like
    any other building, and the level count is `min(entitlement, cap)`. It behaves exactly as the mechanism
    predicts: it cuts in **1780 (3→1), 1836 (27→18), 1870 and 1900**, and leaves 1920 and 1945 untouched
    because there the cap genuinely binds. 1836's economy-wide losses fell **£21k → £14k/wk**.
    ⚠ This is an approximation of employment scaling by level count, not the real thing. Modelling
    per-building employment properly would be better and is not done.
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
  allowed. Locks are UI-session state (reset on reload).
  **⭐⭐ THE SHEET IS TWO THINGS IN A TRENCHCOAT, AND THE SEAM IS NOW EXPLICIT.** One is the **RECIPE BOOK** —
  every tier's `output_qty` + `inputs` and the `pm_goods` overrides, i.e. exactly what the builder EMITS to
  the game. The other is the **SCENARIO** — building counts, pops, wages, workforce ratios, PM selections,
  prices — which is session-only and never emitted. Two recipe books exist, switched by the two **red**
  buttons at the front of the header: **`recipes: vanilla`** (every tier's `vanilla_pm` recipe read live from
  `vanilla.js`; a tier we invented has no vanilla PM, so its entry is **interpolated** along the ×1.5 ladder
  from the nearest anchored tier — the same rule `build_era_ladder.mjs` seeds an invented tier with, so the
  two agree by construction) and **`recipes: mod`** (the config as loaded). Both are **whole-sheet and ignore
  locks** — which book you are on is a mode, not a per-group tuning decision — and neither touches the
  scenario.
  **RED MEANS IT WRITES THE RECIPE BOOK.** Exactly three buttons are red: the two above and **`solve →
  targets`**. Everything else moves the scenario only. ⚠ **Scenario presets write no recipes at all** and
  must stay that way — `applyScenarioPreset` touches `BLDNUM`, `REFSEL`, `_sec`, `POPS`, `SOL` and wages,
  and nothing else.
  **The "would this change anything?" badge is DERIVED, never tracked.** A recipe button dims (`.same`,
  italic) when the sheet already holds that book. It is a comparison of canonical fingerprints recomputed
  from the state itself — a few thousand numbers, no DOM, microseconds — called from **both** `render()`
  (page load, book switch, preset) and `updateComputed()` (live field edit), because `render()` does **not**
  call `updateComputed()`. ⚠ **`recipeSnapshot()` is the ONE definition of what a recipe is**, and both the
  writer (`recipeApply`) and the fingerprint (`recipeKey`) consume that same shape. Keep it that way: two
  lists would let a field added to the writer and forgotten in the fingerprint make the badge **lie**,
  silently, for exactly the field somebody just added. Same reasoning as `ladderFaults()` having one
  implementation. A maintained dirty-flag was rejected for the same reason — proof it is derived: undo a
  manual edit and `.same` comes back, which a flag would never do.
  The **Restore defaults** button resets each in-scope
  **unlocked** group to its as-loaded config values (target BE, build cost, ai_value, secondary PMs)
  — honoring current locks. ⚠ It **no longer touches volumes**: rebuilding tiers from the pristine config
  silently reset `output_qty` + `inputs`, i.e. it was a recipe-book switch wearing a scenario button's
  clothes. Use the red `recipes: mod` for those. The **Bring to vanilla** button (same scope selector + lock
  handling) resets each in-scope
  **unlocked** split building *toward base-game values*: its `ai_value` becomes the **pre-split vanilla building's** value
  (Tier-1 key = the vanilla base building; blank = engine default, e.g. tooling → 2000), its **`building_cost`**
  becomes the pre-split building's flat `required_construction` (the vanilla `construction_cost_*` script value:
  low 200 / medium 400 / high 600 / very_high 800 — `VANILLA_CONSTRUCTION` in the UI, mirror
  `common/script_values/building_values.txt`), and its secondaries reset to base. `target_be` is left as-is, so
  BE then reflects vanilla economics (usually off-target/amber — expected).
  **GUIDELINE — what "Bring to vanilla" must (not) touch:** it brings back to vanilla **everything that is
  neither recipe nor scenario** — `ai_value`, `building_cost`, secondary defaults — **except**
  (1) the *tier split itself* (the per-tier buildings that replaced one vanilla building stay split — this
  button is about values, not structure), and (2) any field the UI does **not** yet make editable **and**
  emittable (today: **workforce**/`employment`). ⚠ **Output, inputs and `pm_goods` are NO LONGER its job** —
  they are the recipe book's, and `recipes: vanilla` owns them. Uphold this as we add
  fields: when a field becomes editable+emittable, wire it into whichever of the two it belongs to. *(Future: give every
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
  (building key → `vanilla`/`none`/`nice_to_have`/`wants_to_have`/`must_have`; **default `vanilla` EVERYWHERE**, including `building_trade_center` — it was `must_have` until
2026-08-11, when F49 measured that mandate at **35% of all government expense** against vanilla's 4.7%,
and the user parked the question by removing it from the default config. Vanilla's own
`ai_strategy_montenegro_admin` still subsidises trade centres and we preserve that, as we preserve every
strategy's own entries). See "AI subsidy policy" below for what it emits and why. **"Build now"** writes the config and runs the full build (needs the `ui.ps1` server — a
  browser can't run programs). Everything else works **frontend-only**: opening `ui/builder.html`
  directly still edits + previews + **Export mod_config.json** (then run `build.ps1` yourself).
  User-facing setup lives in `README.md`.
- **PRINCIPLE — A REPORTED RATIO CARRIES ITS OWN NUMERATOR AND DENOMINATOR.** (User, 2026-08-06.) If the
  headline metric of a table is a ratio, the table shows **both terms as their own columns**, and the
  ratio column names its direction (`ratio = transp ÷ auto`, not `ratio`). A bare `1907: 2033` forces the
  reader to carry the definition in their head, and a reader who mis-remembers which way up it goes reads
  the entire trajectory backwards. ⚠ **This is not only a presentation rule — the terms carry the
  finding.** A compact one-line trajectory of `transportation ÷ automobiles` looked like the incumbent
  being displaced; printing both columns showed transportation buying nearly flat (×1.66 over 29 years)
  while automobile buying went ×829, i.e. the ratio collapses because the newcomer grows. That was
  invisible until the denominator was on the page. Same rule for any derived figure whose inputs are not
  obvious: **show what it was computed from.**
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
  `Era N. <name>. BE target <actual on-build full BE>%` (e.g. "Era 1. Bakery Food Industries. BE target 140%";
  BE here is the wage-inclusive full break-even).
  ⚠⚠ **N IS THE ERA, NEVER A POSITION — in the game, in the UI and in the config alike.** It used to be a
  1-based count of emitted tiers, which made the same digit mean different vintages in different industries:
  the automotive industry's first building is era 3 and shipped as "Tier 1", while arms' era-2 rung shipped
  as "Tier 2" and rendered as "T3" in the scenario panel. Three numberings, all disagreeing. **An industry
  legitimately starts at "Era 3" or "Era 4" and that IS the statement** — the missing lower rungs are the
  claim that the industry did not exist yet, not a gap to be papered over by renumbering from 1.
  ⚠ The UI's `t.tier` field survives as a 1-based DOM key and `data-` attribute ONLY; every user-facing
  label goes through `tlab(t)` and reads the era. Do not print `t.tier`.
- **After an in-game load, check `error.log`** (see MODDING_NOTES.md) — the linter checks
  economics, not engine errors. The builder also emits a **self-diagnostic** on_action
  (`mod/common/on_actions/zzz_pm_rehaul_diag.txt`) that logs a `PM_TECH_REHAUL: init OK … (build <ts>)`
  marker to `logs/debug.log` at game start (absent marker ⇒ mod failed to load). **Convention:** when a
  change might trip something the linter can't see, add an invariant tripwire inside `pm_tech_rehaul_diag`
  (logs `PM_TECH_REHAUL WARN …` on failure), then have the user run the game (init fires at the 1836 start;
  ~1 in-game day, or to 01.02.1837 for a first pulse) and read back `debug.log` + `error.log`. See
  MODDING_NOTES → Self-diagnostics.
- **🛑 THE LANDMINE REGISTER IS WALKED ON EVERY BUILD — `TESTBED_LANDMINES.md` + `tools/preflight.ps1`.**
  A "landmine" here is a defect where **nothing fails**: the build succeeds, the mod loads, the run
  completes, the TSV has rows — and the damage is real and invisible. Half a million error lines from an
  annexed country tag. A script value that reads **zero** instead of erroring. A burst that evicts its own
  data from the log ring. A spec key that never arrives, so the run looks like the *metric* failed rather
  than the plumbing. None of these are caught by the linters (economics), by `Invoke-ModChecks`
  (completeness), or by reading `error.log` (nobody does — it is expected to carry vanilla's noise).
  So each is enumerated with an **ID and a detector**, and `preflight.ps1` **throws** inside `build.ps1`
  and `run_schedule.ps1`. Today: L1 tag guards · L2 data-function-as-script · L3 unbounded scope (manual) ·
  L4 burst phasing (advisory) · L5 dropped spec key · L6 undefined script value · L7 control-arm purity ·
  L8 telemetry changed without a schema bump · L9 unfiltered ring reads · L10 mid-batch edits (manual) ·
  L11 a tag that is not the country you think it is (proposed) · **L13 a starting factory converted onto a tier
  its own production method contradicts (MASKED by the re-band, not fixed)** · **L14 a country starts with a
  building its own technologies cannot unlock** (`verify_start_techs.mjs --vs-vanilla`, compared against
  vanilla because vanilla itself fails on three countries).
  ⭐⭐ **THE GATE BINDS EVERY BUILDING, WHOEVER OWNS IT (re-established 2026-08-17, FINDINGS F68).** A
  history `create_building` is checked against the **region_state's OWN country**; `add_ownership` is not
  consulted, so naming an advanced overlord as owner does not help, and a rejected block is dropped
  **silently** — the mod loads, the build passes, the building is absent. The engine says so in
  `error.log`: `create_building effect [ … Dutch East Indies … must have invented … ]`.
  ⚠⚠ **THIS DETECTOR WAS DISARMED FOR A DAY AND SHIPPED 22 BROKEN START RULES.** A 2026-08-16
  "refinement" made L14 SKIP wholly foreign-owned buildings, on the theory that they ride their owners'
  technology — and its evidence was a save read at **1837.1.1, a year after init**, so what it actually
  saw was F66's engine provisioning wave building those ports, not our `create_building` succeeding.
  ⚠ It then survived a second bug in the same file: `analyse()` counted `add_technology_researched`
  lines sitting inside a per-country guard (`if = { limit = { this = c:NET } … }`, exactly how
  `emit_techs.mjs` writes `start_tech_grants`) as though **every** country of that tier held them — so
  our NET-only `screw_frigate` grant was credited to all 60-odd tier-2 countries and DEI, SMB, TID and
  PON looked entitled to steam ports they cannot build. `startSets()` had already solved this and even
  warned that over-reporting holdings "is a detector that passes the very failure L14 is for"; the fix
  is that **both landmines now read `startSets()`**, one definition of what a country starts with.
  It also killed three standing false positives (vanilla-inherited gaps 6 → 3), because the old path
  ignored the per-country extras 81 countries carry.
  ⚠ Re-proved by sabotage: injecting one NET-owned `port_steam` into DEI's territory now exits 1 and
  names `DEI (tier 2): screw_frigate`. Do not re-introduce an ownership exemption without a reading
  taken at **1836.2.1** · **L15 a country LOSES a starting technology
  vanilla gives it** (`verify_start_techs.mjs --diff-vanilla` — L14's converse, and the quiet one: tiers 1
  and 2 draw most of their set from `add_era_researched = era_1`, so re-era-ing a technology OUT of era 1
  withdraws it from 59 countries with no file mentioning it. It expands the era shorthand against EACH
  root's own eras and includes the per-country extras 81 countries carry) ·
  **L17 a run that FAILED is recorded as `ok`** — the scheduler derives status from the observer's EXIT
  CODE alone, and the observer exits 0 even when it ABANDONS a run, so a run that reached 15% of its span
  counts as complete and the arm's `n` silently shrinks. Everything needed is already in that run's own
  `meta.json` (`reached_ingame_date`, `self_quit`, `abandoned_reason`) and nothing reads it. Found live
  2026-08-13; it is the generating cause of the FOUR retrospective n-corrections already in
  `SESSION_VERDICTS.md`. ✅ AUTO since 2026-08-17: `preflight.ps1 -Session <dir>` compares every
  ENDED run's `reached_ingame_date` against its `until_date` and fails on any shortfall or non-empty
  `abandoned_reason`. It does NOT judge WHY — a deliberate STOP is as much a shortfall for COUNTING as a
  crash, and which it was belongs in the VERDICT. Proven both ways on real sessions ·
  **L16 a schedule key that works in `defaults` for some fields and is SILENTLY DROPPED for others (AUTO since 2026-08-17)**
  (`dump_dates` USED TO BE run-only, with no `$defaults` fallback unlike every neighbouring key — a
  defaults-level one was ignored and every run fell back to ONE dump date instead of twelve, so a
  per-decade series silently became a single endpoint. Both halves fixed: AUTO since 2026-08-17 — the scheduler throws on any `defaults` key it does not thread through, naming it, and `dump_dates` now falls back to defaults like its neighbours) ·
  **L12 savegames reaped without a readable
  summary** — the one POST-RUN entry, walked with `preflight.ps1 -Session <dir>` and N/A on a normal build.
  ⚠⚠ **L14 AND L15 ARE `N/A` FOR AN INSTRUMENT ARM, AND GETTING THAT WRONG MADE THE CONTROL ARM
  UNBUILDABLE FOR A DAY** (2026-08-12 → 13). They read our own 1836 grant, which a control does not emit,
  so both died on ENOENT and `build.ps1 -ControlOnly` **threw** — a landmine sitting inside the landmine
  register's own enforcement, found only when a 20-hour batch stalled on its first build with neither a
  `build ok` nor a `BUILD FAILED` line anywhere. The skip keys on the mod's METADATA ID (the mechanism L7
  uses), **never** on the grant file being absent, because a content mod missing its grant must still FAIL.
  **The MD holds the story and the numbers; the script holds the enforcement.** When a run surfaces a new
  one: entry first, then `Test-Lm<ID>`, then **prove the tripwire trips** by breaking it on purpose — a
  guardrail that has never failed is not known to work.
  ⚠ **A comment in the right place is not a guardrail.** The dropped-spec-key warning was already sitting
  on the exact line list it describes, and `origin_goods` still slipped past it for weeks. That is the
  whole case for the check over the note.
  ⚠ **The detector outperforms reading the code.** The L1 fix covered 6 sites found by hand; the detector
  then found **13 more**. Do not treat a hand pass as equivalent.
  The **`preflight` skill** covers only what code cannot decide (L3, L10) and the ritual for adding one.
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
- **⭐⭐ AN ALLOTTED WINDOW IS A STANDING GO-AHEAD — INSIDE IT, GO AND GET THE DATA YOURSELF**
  (user-ruled 2026-08-14). When the user grants an explicit window for long work — "up to Friday
  evening", "overnight", "take the next N hours" — that window is permission to run **probes and short
  tests on your own initiative**, without coming back to ask. If you hit a blocker that is simply
  *missing data*, or a question that a measurement would close, **run the measurement**. Do not stop and
  ask; do not hand back a half-answer that a five-minute probe would have finished.
  ⚠ **NO WORDING SHORTENS THE WINDOW BELOW 12 HOURS FROM THE LAST REPLY.** "Friday evening" can mean
  many things, but it never means less than that, so never reason yourself into believing the time is
  nearly gone. The window ends when the allotted time actually runs out, or when the user **explicitly**
  breaks it with a command to do otherwise.
  ⚠ **A STATUS REQUEST IS NOT A BREAK.** Asking what is happening, asking for analysis of data already
  collected, or asking a question about earlier results does **not** end the window and does not require
  you to re-ask before continuing. Only an instruction to stop, or to do something else instead, does.
  ⚠ **LONG tests follow the same rule with one bound: do not START one with under 3 hours of the window
  left** without explicit permission — a long run that cannot finish inside the window is worse than no
  run, because it monopolises the machine and produces a partial result nobody asked for.
  ⚠ This does NOT relax the arm-discipline rule below: a probe still has to state its arm, span and
  metrics in its schedule `_why`, and still gets a `VERDICT.md`. Autonomy is about **not asking**, not
  about recording less.
- **NEVER launch a game run without the user's explicit go-ahead — and ask for the whole batch in ONE
  request.** ⚠ Read this together with the allotted-window rule directly above: inside a granted window
  the go-ahead is already given and this bullet's "ask first" does not re-apply per probe. Game time is the one cost here that cannot be optimized away, and it monopolizes the
  machine. ⚠⚠ **DO NOT SIZE A RUN AT "a minute per in-game year" — that is the OPENING rate and it
  under-states a century by about a third.** The game slows as the economy grows: ~1.0 in-game years per
  minute in the 1830s against ~0.44 in the 1930s. A full 1836→1936 run is **~2h35 on the mod, ~2h20 on
  vanilla**. The per-decade curves and a cumulative budget table are in MODDING_NOTES → *Automated
  headless runs*; regenerate them with `node tools/testbed/run_timing.mjs <sessionDir>`. Three rules:
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
  N times. ~5.7 in-game days/sec (+~40 s startup) **in the OPENING YEARS ONLY**, so a 5-year probe is
  ~5–6 min — do not scale that to a campaign, see the curves above. **Measurement goes
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
  ✅ **VERIFIED 2026-08-06 (session `resume_diag`): the resume works and KEEPS OBSERVER MODE.** Killed at
  1837.3.5, it came back at 1837.3.2 — the last autosave — with `continue_game.json` reading
  `"desc": "Observing Great Britain"`. A silent hand-off to a human player would corrupt every later
  measurement while looking like a normal run; it does not happen. `-handsoff` does **not** override
  `-continuelastsave`, and `continuelastsave` is a real flag (it is in the exe's string pool).
  ⭐ **FALLBACK LADDER when a resume produces a fresh 1836 game** (i.e. the load failed): retry the same
  autosave **twice**, then **quarantine it** into the run folder and step back to the previous one; if
  *that* also fails, stop and record `resume failed from two different autosaves` rather than walking
  the whole ring. ⚠ Quarantining is not a preference, it is the **only** way to choose a save —
  `-loadsave=<path>` is rejected by the exe, so the engine always takes the newest. The moved file is
  **kept**, and `meta.json` → `quarantined_saves` records its byte size against its siblings: much
  smaller than its neighbours confirms the leading hypothesis (a CTD landing mid-autosave-write leaves a
  truncated `.v3` that exists, is newest, and fails to load); the same size refutes it.
  ⭐ **EVERY SAVE A CRASHED RESUME LOADED IS KEPT AS EVIDENCE** (user-approved 2026-08-14, F56): at each
  resume launch the observer copies the save `-continuelastsave` is about to load into
  `<run>\quarantined_saves\` as a pending copy — promoted and recorded in `meta.json` →
  `quarantined_saves` (reason `loaded by a crashed resume`) if that attempt crashes, deleted if it
  completes. Copy at LAUNCH, not at crash: slot rotation renames the file away and the concurrent
  harvester reaps the archive within minutes, which is how the 2026-08-14 vanilla run's poisoned ~1896
  save was lost (the run recovered, so keep-newest kept only its 1936 endpoint). The folder is invisible
  to `harvest_saves.ps1` and to L12, which both glob `saves\` only. ⚠ Live proof still owed: the hooks
  are parse-checked and trace-reviewed, but no batch has crashed-and-resumed under them yet — check the
  first post-2026-08-14 batch with resumes for `quarantined_saves\` entries and their meta records.
  ⚠⚠ **THE RESUME VERDICT MUST NOT BE READ FROM A STALE TAIL.** The game rotates its logs at startup and
  the tail keeps reading against the old file's offset, so for ~100 s after any launch it serves the
  PREVIOUS session's ticks — measured: `in-game 1877.2.13` reported while the game was at 1836.2. Every
  verdict keys on `$firstTick`, so this is how a *successful* resume gets thrown away (very probably what
  killed run 19 of the vanilla-retest batch). Fixed by trusting each tick line's **own `[HH:MM:SS]`
  stamp** and ignoring anything older than the attempt — no rotation detection needed. See
  BUGS_AND_FIXES.
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
- **🛑 HARD RULE — SMOKE-CHECK EVERY RUN ~5 MINUTES AFTER IT STARTS, AGENTICALLY.** (User, 2026-08-12.)
  A run that is botched at minute one is still botched at hour three, and the harness will not say so:
  it reports `SESSION DONE` on a run that loaded no mod at all. Five minutes in, the game has booted,
  loaded, started and written its first ticks — everything needed to tell a healthy run from a dead one
  is already on disk. **Look at it then, not at the end.** Four checks, all cheap:
  1. **Did OUR mod load?** `grep PM_TECH_REHAUL <run>/logs_live/debug.log` — the builder emits that init
     marker for exactly this. Absent ⇒ stop the run, do not wait.
  2. **Does the game version match the mod's?** `does not match game version` in `error.log`. A Steam
     update between two sessions makes them incomparable, and it is invisible unless looked for — it
     happened on 2026-08-12 **between two runs of the same afternoon** (1.13.9 → 1.13.10).
  3. **Errors in THIS RUN'S time window only.** `error.log` is a shared ring carrying other sessions'
     lines; a raw line count is meaningless. Filter by the run's own start time, then discard vanilla's
     own noise (the `jomini_spline_network_graphics` flood) and the catalogued
     `is_production_method_active` PostValidate class (MISSING_PM_REFERENCES). What is left is the signal.
  4. **Is the clock advancing?** The tail of `<run>/run.log` should show `in-game <date>` moving.
  5. **Is the construction mix reasonable?** (User-directed 2026-08-16, after F66.) As soon as the
     concurrent save harvest lands its first summary (~10 min for the 1837 autosave), run
     `node tools/testbed/queue_mix.mjs <run-dir>` — for select majors separately and the world as a
     whole, the distribution of what is being built, private queue and government queue separately,
     must be plausible. One building family dominating a major's queue (≥60% of ≥3 items) is a
     **red flag that can invalidate the run**: F66's port spam read 100%-port on GBR and FRA at the
     very first 1837 summary, in every arm, and nobody looked until 1855. Re-run it `--all` post-run;
     the WARN threshold is advisory — read the lines, don't just gate on the exit code.
  ⚠ **`mod_loaded=False` in the harness summary is NOT authoritative** — it read False on a run whose
  init marker is plainly in `debug.log`. Check the marker yourself before believing the summary either way.
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
  ✅ **THE THREE ARMS, and the guarantee is now ENFORCED rather than documented** (fixed 2026-08-06, after
  the rule above was breached for a day by bolting the pop-need overlay onto `-ControlOnly` itself):
    1. **`-ControlOnly`** — metadata + telemetry and *nothing else*. It **throws** if handed a `-Config`
       carrying `pop_need_weight_mult`, and `{kind: control}` **throws** if a schedule gives it a `config`
       at all. A flag that promises an absence must fail loudly rather than quietly widen.
    2. **`-Overlay -Config <path>`**, schedule **`{kind: overlay, config: X}`** — vanilla + telemetry +
       a **declared** overlay. It throws if the config produces no overlay, because an overlay carrying
       nothing is a control wearing the wrong name. ⚠ Today the only overlay kind is the pop-need weight
       rescaling; **if a second is ever added it must be named and allow-listed**, or the arm starts
       quietly accumulating content, which is the whole failure this split exists to prevent.
    3. **It reports itself as its own thing.** Its own mod id (`com.yurcick.v3_testbed_overlay`), so
       `build_state.json` records **`arm: overlay+pop_needs`** and landmine **L7** — which requires a
       *control* to emit nothing outside `.metadata` / `on_actions` / `script_values` / `events` — simply
       does not apply to it. **Naming the arm honestly is what makes the guardrail work**: L7 keys on the
       control's metadata id, so an overlay that lied about being a control would trip it, and one that
       says what it is passes for the right reason.
    4. **Both share the ONE telemetry generator**, which was always the only thing arms were meant to
       hold in common and is what makes them comparable.
  ⚠ **All three guards are tested, not assumed** — a control handed a content config, an overlay handed a
  contentless one, and a `{kind: control}` with a `config` all fail with a message naming the fix.
  ⚠ **Setup shape is validated UP FRONT**, in the same pass as the run list, not lazily in `Resolve-Setup`
  — which runs inside the execution loop and *after* the `-WhatIf` return, so a malformed setup used only
  by the last run of an overnight schedule went unreported until that run began, hours in.
  ⚠ **The underlying shape is still a straight-line script with an early `exit 0`**, which is what made
  the original breach possible. A list of content emitters each arm opts into would be better; the guards
  above make the current shape safe, they do not make it right.
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
  ✅ **Now checked mechanically (landmine L5)** — and it immediately found a live one: **`origin_goods`**
  was read by `Read-TelemetrySpec`, requested by three schedules, and threaded through nowhere, so every
  scheduled `origins` run silently measured the hardcoded default goods list. Session
  `20260801_225108_paper-be20-n3` asked for wood/sulfur/dye and **never instrumented them**; its own
  `telemetry.json` carries `origins` with no `origin_goods` at all. Fixed, and the check now guards it.
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
- **🛑🛑 EVERY SESSION THAT RAN GETS A `VERDICT.md`, AND THE DEADLINE IS THE HANDOVER** (user ruling
  2026-08-12). A sound session needs one as much as a defective one — its numbers are what a later
  reader compares against, and "sound" is itself a finding that has to be stated. ⚠ **The right MOMENT
  cannot be pinned down**, because a verdict often needs the user: whether a result is void, what it is
  confounded by, and what it means are frequently their call, and that conversation can run for hours
  after the run ends. So the rule is not "write it when the run finishes" — it is **"a handover may not
  be written while a session from this session's work lacks a verdict"**. That is a moment that always
  arrives and is always noticeable.
  **Check it mechanically rather than from memory** — one line, and it is the last step before the
  handover:
  ```bash
  for d in tools/testbed/sessions/*/; do b=$(basename "$d"); [ "${b:0:8}" -ge 20260812 ] 2>/dev/null && { [ -f "$d/VERDICT.md" ] || echo "MISSING VERDICT: $b"; }; done
  ```
  ⚠ **The glob starts at 2026-08-12 ON PURPOSE.** The convention began that day and 77 earlier sessions
  have no verdict; a check that reports 77 misses every time is a check nobody reads, which is the exact
  failure mode this register-and-detector habit exists to prevent. Widen the glob only to write a
  RETROSPECTIVE verdict deliberately — and mark it as retrospective, since it is weaker evidence than one
  written while the analysis was live.
  Then add the one-line row to the COMMITTED `tools/testbed/SESSION_VERDICTS.md` — the session folder is
  gitignored, so the row is the half that survives it.
- **A SESSION THAT IS SUPERSEDED, DEFECTIVE OR PARTLY VOID NEEDS THE VERDICT MOST.**
  Everything a session carries about *why* it ran — `schedule.json`'s `_why`/`_comparison`,
  `build_state.json`'s `agentic` block — is written **before** the run. Nothing anywhere records what it
  turned out to mean, and since sessions are never deleted (below), a defective batch otherwise sits
  there indefinitely looking like clean runs. `FINDINGS.md` is the wrong home: it is organised by result,
  a retracted or partial result does not belong in it, and someone reading a session folder has no reason
  to go looking there.
  **So the annotation lives WITH the data**, `tools/testbed/sessions/<stamp>/VERDICT.md`, where it cannot
  be found separately from what it describes. Write one when: a defect is found in the build after it
  ran; a later batch supersedes it; part of the result is void and part survives; or a metric turns out
  not to have been instrumented. Say plainly **what is void, what still reads, and how far** — and
  distinguish the measured quantity from the proposed cause, because a session's numbers usually outlive
  the first explanation of them.
  ⚠⚠ **NAMING THE DEFECT IS NOT THE VERDICT — TRACE WHAT IT DID, AND WHAT IT TOUCHED.** "The military
  channel was ungated" says nothing a reader can act on. "A clear overshoot on the technology boost,
  exacerbated by military technology being gated on conditions that are true far too often, so it was
  shared free and fast" says what happened *and* by what mechanism. Then **follow the knock-ons**: this
  game is densely interconnected and a defect never stays in its own channel. In the case that produced
  this rule, one ungated military term plausibly reached four other readings — easier early conquest
  (13–20 fewer countries surviving, which silently changes the population every median and percentile is
  computed over), directed research redirected into the *other* trees (so the untreated tree is a weaker
  control than it looks), the treated tree's own gain partly borrowed from that freed budget, and ~10%
  more war feeding every economic number. **List those paths even when you cannot measure them** — an
  unlisted confound reads as an absent one.
  ⚠ Corollary: be sceptical of your own control. A tree, arm or metric is only a control for the channels
  it is actually independent of; say which those are.
  ⚠ **Do not write the verdict off the endpoint alone.** The trajectory is often where the result is:
  whether a leader plateaued or the century merely ended, when milestones moved, whether two runs of one
  arm agree. A 1935 snapshot cannot tell those apart.
  ⚠ A verdict written **retrospectively**, from the documents rather than at the time, says so at the
  top — it is weaker evidence than one written while the analysis was live, and a later reader needs to
  know which kind they have.
  ⚠⚠ **A `VERDICT.md` IS GITIGNORED WITH ITS SESSION, so it is NOT backed up** — the same standing hazard
  as the data (*gitignored ≠ backed up*, below). That is accepted for the reasoning, which is moot once
  the data is gone, but **not** for the correction itself: a "this batch is n=2, not n=3" is exactly the
  kind of thing that must outlive the folder. So every verdict also gets a **one-line row in the
  COMMITTED `tools/testbed/SESSION_VERDICTS.md`**, carrying the status and the correction. Same division
  of labour as `FINDINGS.md` and the sessions it describes: detail with the data, conclusion in the repo.
  ⭐ Writing verdicts over the existing sessions paid for itself immediately — it found three batches
  claiming more runs than they have (`techtree-full-n3` and `wages-n3` are n=2; `vanilla-retest`'s
  nineteen runs are sixteen 52-second probes plus three failed resumes), one of which underpins the
  measured base wage. **Run counts in a session's NAME are not evidence; the run logs are.**
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
- **The HANDOVER is a baton, and is NOT COMMITTED** (user ruling 2026-08-12). Write it at the end of a
  session for the next one — three or four concrete tasks in the user's own order, each with the
  measurements that motivate it and the traps that cost time. Then **gitignored, like the status board
  and for the same reason**: it is replaced wholesale each session, and a committed copy rots into a
  stale second source of truth. ⚠ **The corollary is load-bearing: nothing durable may live only in the
  handover.** Before writing one, put the results in `FINDINGS.md`, the plan in `ROADMAP.md`, rulings in
  `BALANCE_FRAMEWORK.md`, guardrails in `TESTBED_LANDMINES.md`. The handover then only has to say what
  to DO, and can point at those for why.
  ⚠⚠ **AND EVERY SESSION THAT RAN MUST HAVE ITS `VERDICT.md` FIRST** — the handover is the deadline for
  that rule, because no earlier moment reliably arrives (see the verdict rule above). Run the
  missing-verdict check before writing, not after.
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
