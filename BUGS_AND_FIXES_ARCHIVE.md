# Fixed bugs & root causes — the archive

Entries of `BUGS_AND_FIXES.md` about the retired six-rung solver (`era_scenarios.mjs`, `era_inverse.mjs` and their kin; the six-rung ladder is
closed for good, BALANCE_FRAMEWORK §10.80), and one four-rung entry made moot by the vanilla-ladder rebuild and the tier rule, moved here verbatim on 2026-10-24 (user ruling for the records: "index + archive"). Each block is
preceded by a comment giving its original line range in `BUGS_AND_FIXES.md` at commit `6cdb618`; newest first. Their lessons that still
apply are restated as principles in `CLAUDE.md` §2.12 (report only a final state; a rule that skips cases prints what it skipped).

---

<!-- BUGS_AND_FIXES.md lines 2153–2190 at 6cdb618 -->
## 2026-08-29 — `make_tier4_techs.mjs` has NO ladder-era alignment step (latent, not yet harmful)

**Found by:** a user question — "are synthetics and electrics wrongly gated behind a very high level
tech?" The answer is **no**, but the check exposed a missing guard.

`tech_tree_spec.mjs` carries the LADDER-TIER ALIGNMENT (its line ~1069, user-ruled 2026-08-12): a
technology gating one of our tiers is placed in the MECHANICAL era that tier maps to, re-derived from
the ladder every run, only ever lowering, never landing in era 1. **`make_tier4_techs.mjs` — the
four-rung tree — does none of it.** New technologies get `gameEra(year)`, and vanilla technologies
keep whatever era vanilla gave them. `gameEra` uses VANILLA's windows (1836/1861/1886/1911), which is
exactly the two-calendar problem that put **41 of 106 tiers one era too high** in the six-rung book.

**Current damage: 3 of 66 tiers**, all vanilla technologies, all +1 above the mechanical era their
own tier maps to (`ERA_LEAD` 2/3/4/5):

| industry | tier | gate | gate era | target |
|---|---|---|---|---|
| food | t1 | `pasteurization` | 4 | 3 |
| motor | t2 | `compression_ignition` | 5 | 4 |
| arms | t2 | `stormtroopers` | 5 | 4 |

32 are exactly on target and 31 sit below it (harmless — cheaper and earlier). It is this mild only
because the tree was hand-pegged under the 15-year rule, which tracked the eras closely **by
accident**. That is luck, not design: nothing in the tool would stop a future peg landing two eras
high, and the cost is real (era base cost + the ahead-of-time penalty, at exactly the date the rung
is meant to be the workhorse).

**Not fixed yet** — the n=3 batch `20260829_212316` froze the config hash and L10 forbids a mid-batch
edit. Fix after it lands: port the alignment rule, or at minimum a validator that FAILS on any tier
whose gate sits above its tier's mechanical target.

⚠ **Analysis trap, hit while measuring this.** The first pass keyed the target on the RUNG INDEX and
reported 10 misaligned tiers including every new-economy industry. The target is keyed on the rung's
**TIER**. Keyed correctly it is 3, and none of them are in the new economy. This is the *same* error
as the ai_value defect logged above, made within the hour — **when a per-tier quantity has both a rung
index and a tier available, state which one it is keyed on, and check that the two differ before
trusting any result derived from either.**

<!-- BUGS_AND_FIXES.md lines 838–870 at 6cdb618 -->
## A frozen PM selection was never re-validated against PROFIT — a −40% method shipped with +159% one candidate away (2026-08-10)

**Symptom.** The tier-0 preset's textile mill ran `pm_craftsman_sewing` — buying silk to make
luxury_clothes in a scenario whose SoL-7 pops buy no luxury at all, so the output sat at the 25% price
floor while the 30 clothes/level the method sacrifices traded at 161. Replayed on the shipped state:
−40.5% with the method on, +159.4% with it off. The same defect ran the other way at tier 4, where two
textile tiers sat on `pm_no_luxury_clothes` forgoing +40–49pp. Nothing failed: the run reported
`PM optimality: SETTLED`, and the state passed every guard. Found by the user reading the sheet.

**Root cause.** Two §10.48 mechanisms each stop re-scoring a selection while prices keep moving:
(1) best-of-cycle FREEZING pins an oscillating PMG at the phase that won *at the prices of that round* —
and a pin is re-validated against legality and the ceiling, never against profit, so when later phases of
the solve (the shrink, the tuner, the §10.49 offsets) move prices far enough to invert the comparison,
the pin stands anyway; (2) the `pmDone` latch skips the optimiser entirely once a round makes no move, so
even UNPINNED selections are last scored at mid-solve prices. The luxury textile PMG is a bistable pair
(switching it flips both goods' prices), so it was exactly the class the freezer exists for — pinned, and
pinned on the wrong side.

**Fix.** `liftDominatedSelections()` (`ERA_PM_LIFT`, default 0.25): in the LAST THREE joint rounds,
each present building's PMG selection is re-scored against its legal candidates at CURRENT prices; any
selection beaten by more than the threshold drops its pin (if any) and unlatches `pmDone`, and the
optimiser re-decides under its own rules. The pin contract becomes: pins yield to legality, to the
ceiling, and to dominance — **but each pin gets exactly ONE appeal per tier, heard late**. The first
version lifted unconditionally every round, and a genuinely bistable pair is dominated from whichever
side it holds, so it was re-opened forever: the settling property §10.48 bought came straight back off
("PM settled 1/6" on the first shipped write). Late + once means the appeal is judged at near-converged
prices, and a choice that re-freezes after its appeal stands as best-of-cycle at those prices.

**Detect/prevent.** The threshold is deliberately far above `ERA_PM_MINGAIN` (0.25 vs 0.10) so the lift
cannot reintroduce the churn the hysteresis killed; anything surviving is within 25pp of optimal at
final prices or a bistable pair that already had its late appeal. When a shipped selection looks absurd
in the UI, replay the preset and toggle the PMG — the two-line check that found this one (see §10.49.5).

<!-- BUGS_AND_FIXES.md lines 871–894 at 6cdb618 -->
## Every ceiling guard compared breach COUNTS — blind the moment anything was already breached (2026-08-10)

**Symptom.** During the hysteresis campaign (§10.48), one seed's 1870 scenario shipped `iron buy 1k /
sell 0 — NO PRODUCER AT ALL` at the 175 band edge: every iron mine had been walked out of the economy
one shed at a time, while every per-step ceiling check reported the step as safe.

**Root cause.** All ~10 "undo this step if it breached the industrial ceiling" guards (§10.18 drops and
sheds, the §10.38 manufacturing shrink, the §10.21 tuner's growth steps, macro enforcement, the integer
polish) had the shape `before = ceilingBreaches(); … if (ceilingBreaches() > before) undo`. A COUNT is
blind once any breach already exists: with dye standing at 175, a step that pushed **iron** to 175 while
dye happened to come off the wall read "1 → 1, fine" — and a loop of such steps dismantles an industry
with every individual check passing. The promise in the §10.18 comment ("a drop that breaches the
ceiling is undone") was simply false whenever the scenario already carried one breach.

**Fix.** `ceilingBreachSet()` + `breachGrew(before)`: a step is undone when any GOOD is breached that
was not breached before it — swapping one breach for another is also a regression and also rejected.
All guard sites converted; the count survives only where a count is the right thing (the PM-choice
penalty's magnitude).

**Detect/prevent.** A guard on an aggregate (count, sum, mean) silently weakens the moment the
aggregate is non-zero at rest. Guard on the SET of violations whenever "which ones" matters — and test
the guard in a state that already violates, not only from a clean state, because that is the state in
which it will actually run.

<!-- BUGS_AND_FIXES.md lines 895–920 at 6cdb618 -->
## The integer polish could not CLEAR a standing ceiling breach — and the macro veto blocked the one move that could (2026-08-10)

**Symptom.** Scenarios shipped with a hard-constraint violation standing (tier-1 `clippers buy 106 /
sell 48` from the 1-level shipyard, price pinned at 175) while the polish reported "0 moves accepted":
one +1 shipyard level would have priced clippers at ~110, and nothing ever took it. Under the old
jitter defaults this was live in the SHIPPED ensemble — seeds 9 and 10 both carried a standing tier-1
breach the polish never tried to fix.

**Root cause.** Two layers. (1) The polish's objective was `illogicality → losses → net` with a guard
that only refused NEW breaches — a standing breach was invisible to it, so a breach-clearing move was
scored purely on profit keys it usually loses. (2) With that fixed, the macroscenario gap-sum veto
still rejected the move: the shipyard's value added is negative, so adding a level SHRINKS the mapped
denominator, every other share rises, and a standing above-cap gap (tier-1 paper) widens by a hair. The
veto ran before the objective, so the hard constraint lost to the soft layer — inverting the precedence
the rest of the solver enforces (macro enforcement undoes its own steps on a ceiling breach).

**Fix.** Ceiling breaches lead the polish objective lexicographically (breaches → faults → losses →
net), and a move that strictly clears a breach without creating one is exempt from the macro-gap veto.
Measured: the default ensemble went from standing tier-1 breaches on two of three seeds to the ceiling
CLEAR on all six tiers of all three seeds, illogicality unchanged.

**Detect/prevent.** When a constraint is declared to outrank everything, grep for every accept/reject
decision and check the constraint appears — at the RIGHT precedence — in each. A hard constraint that
is merely "guarded against getting worse" can never recover from a violation that arrives by any other
path; some pass must be rewarded for clearing it.

<!-- BUGS_AND_FIXES.md lines 921–946 at 6cdb618 -->
## The tuner's raw-growth lever never reached the counts — `minCount` ignored for reference producers (2026-08-09)

**Symptom.** The raw sector's upper band (§10.22, extraction ≤ +400% / agriculture ≤ +200%) never came
down: §10.21's own sanity line reported "raw producers median 52–66% … 10–12 producers over +50% every
era" for as long as it has printed, and the FREE ENTRY line essentially never named a plantation or
mine among what it grew. The one recorded raw-growth story — `tea_plantation` eating all 400 tuner
steps "achieving nothing" — was attributed to its price being pinned at the 25% floor.

**Root cause.** The tuner grows a producer by raising `minCount[key]` and re-settling. `applyCounts`
honours `minCount` in its TIER branch — and its REFERENCE branch (mines, farms, plantations) computed
`min(lvl(scaleOf), scaleCapOf, rawCap)` with **no `minCount` term at all**. So every raw growth step
was a no-op: settle recomputed the same count, the margin came back unmoved, and the futility guard —
which reads an unmoved margin as "pinned at the floor" — unwound the (empty) run and `capBlocked` the
producer after one wasted step. The upper half of the raw band was **unenforceable the entire time it
has existed**, and the tea story was misdiagnosed: any ref candidate would have "achieved nothing",
tea was merely picked first. (Pre-futility-guard, the same no-op is why tea could burn 400 steps.)

**Fix.** The ref branch is now `min(max(lvl(scaleOf), minCount||0), scaleCapOf, rawCap)` — the same
shape as the tier branch, caps still outranking the floor. Found while building §10.47's macroscenario
enforcement, which needed the same lever for raw-category floors; measured together with it (§10.47.1).

**Detect/prevent.** A lever is only known to work when its effect has been SEEN: after wiring any new
count-space rule, force one step and confirm the count actually moved before trusting the rule's
reports. The futility guard's "nothing moved" is indistinguishable from "the lever is disconnected" —
which is the same lesson as the ceiling-pin entry below, one bug further upstream.

<!-- BUGS_AND_FIXES.md lines 947–971 at 6cdb618 -->
## The futility guard blocked growth at the CEILING it was needed for (2026-08-09)

**Symptom.** The 1780 iron mine sat at 1 level, 419% margin, its good pinned at the 175 ceiling with
buy 58 / sell 22 — and the count machinery never grew it, run after run, seed after seed. The tier-2
engines under-build (buy 229 / sell 96 from 2 levels) resurfaced with the same signature after the date
gate. The user's read — "the iron mines themselves are profitable, why is there only one of them? It can
be some systemic weirdness" — was exactly right.

**Root cause.** §10.21's futility guard exists for the 25% price FLOOR: a producer whose good is floored
cannot move its own margin by growing, so growth steps are unwound and the producer `capBlocked` — the
guard's own comment says "pinned at the 25% price floor". The implementation never checked WHICH pin:
at the 175 CEILING with demand far above supply, one growth level often leaves buy/sell ≥ 1.6, the price
stays pinned, the margin does not move — and the guard read that as futility and PERMANENTLY blocked the
one producer the hard ceiling constraint needed grown. Whether a seed hit it depended on whether an
intermediate state crossed the 1.6 line during the tuner — hence the seed-dependence of the engines
breach.

**Fix.** Both branches (raw and manufacturing) skip the futility verdict when the producer's output good
sits at ≥174.5% — there "margin did not move" means "not enough growth yet", and the ceiling-breach undo
remains the only brake.

**Detect next time.** A profitable producer at minimum size whose good is at the TOP band edge is the
fingerprint — the report already prints both halves (`RAW BAND … OUTSIDE` + `INDUSTRIAL CEILING … from
<building> N×M`); read them together.

<!-- BUGS_AND_FIXES.md lines 1037–1056 at 6cdb618 -->
## The in-tier illogicality count was fiction — it scored recipes that never ship (2026-08-09)

**Symptom.** The headline illogicality read 52 (47 excluding shipyards) while a replay of the criterion on
the SHIPPED presets — final recipes, final counts — read **94 (84)**. Under the outer tier iteration the
in-tier count "worsened" to ~90 and converged to the replayed one.

**Root cause.** The same §10.14.1/§10.39.3/§10.41.1 defect in its fourth home: `ladderFaults` judges the
newest PRESENT tier, and during tier N that leading rung still carries its provisional (leanest-legal,
canonical-start) recipe — lean recipes look profitable, so fault 1 (loss-making) and fault 3 (inverted)
were systematically under-counted mid-ladder. The truth was always ~94; "52" measured a state no one ships.

**Fix.** The criterion is now ALSO replayed on the shipped state (`FINAL-STATE ILLOGICALITY`), together
with leading/dominant-rung scoring and a losses-by-vintage split; the final-state figure is the headline,
and the outer iteration (ERA_OUTER, default 3) closes the gap at its source by re-solving every tier against
the final recipe book.

**Detect next time.** Any number computed inside the tier pass is suspect until it agrees with a replay of
the shipped preset — the fingerprint of this defect family is exact agreement at tier 0 and tier 5 with
divergence between.

<!-- BUGS_AND_FIXES.md lines 1057–1073 at 6cdb618 -->
## The urban-centre reduction is what broke 1870 and 1900 (2026-08-09)

**Symptom.** The 2026-08-08 handover's open item: 1870's net fell 0.43M → 0.08M and 1900's 1.33M → 0.40M
somewhere in the gold/urban/art batch, losses tripling, attribution contaminated.

**Root cause.** `ERA_URBAN_SHRINK` cut urban centres at ANY loss. At 1870/1900 they sat at −2%, so each cut
bought almost nothing — while counts are the dependent variable (full employment by construction), so every
cut poured clerks into productive industry and flooded all markets at once. Measured: turning only that
knob off restored 1870 to net 208k / losses 37k and 1900 to 1.4M / 111k. The art-academy change was
innocent (reverting it made losses AND faults worse).

**Fix.** Two-stage. First a loss floor (`ERA_URBAN_FLOOR=-0.10`: cut only below −10%) recovered the two
tiers while keeping 1836's −49% case cut. Then the ruled set's outer iteration + unified enforcement
absorbed the breaking mechanism entirely — under them the floor, the unconditional cut and never-cutting
are statistically indistinguishable — so the special case was REMOVED again (default 0, cut at any loss,
same rule as manufacturing) and the knob remains as the A/B instrument.

<!-- BUGS_AND_FIXES.md lines 1074–1092 at 6cdb618 -->
## A raw-only solvency re-check recreated the phase-ordering bug it existed to close (2026-08-09)

**Symptom.** In the first full combination run, tier 5 shipped `chemical_plant_reforming` at **116 levels ×
−46% = £448k/wk** — 60% of the tier's losses in one building type — while the report's own reduction had
terminated cleanly.

**Root cause.** The new post-tuner §10.18 re-check dropped/shrank raw producers AFTER the manufacturing
reduction had finished. Prices moved out from under the reduction's last check, fertilizer went deep
underwater, and no rule that could cut manufacturing was still running. Same failure class as §10.18's
"each round must begin from a converged state": any enforcement phase that runs after another phase's
final check can invalidate it.

**Fix.** ONE unified counts-only enforcement loop over every rule at once (raw solvency, manufacturing
losses, urban floor) — worst violation first, settle + re-price after each step, terminate only when
everything is clean simultaneously. Tier-5 losses under the same combination fell 728k → 127k.

**Detect next time.** When adding any post-solve rule, ask what other rule's terminal check it can
invalidate; if the answer is anything, it belongs inside the shared loop, not after it.

<!-- BUGS_AND_FIXES.md lines 1093–1106 at 6cdb618 -->
## The scale-limit verification counted subsistence fishing villages against the commercial cap (2026-08-09)

**Symptom.** `SCALE LIMITS … ⚠⚠ BREACHED — fishing 102 (the cap failed to apply; this is a bug)` the
moment the fishing wharf sat at its cap of 100.

**Root cause.** The verification summed every building matching `/fishing/`, and
`building_subsistence_fishing_village` matched — but subsistence buildings are sized from the peasants and
were never subject to the caps, so 100 wharf + 2 villages printed a phantom breach. Enforcement was
correct throughout; only the check lied.

**Fix.** The verification skips subsistence buildings, matching what `applyCounts` actually caps.

---

<!-- BUGS_AND_FIXES.md lines 1107–1179 at 6cdb618 -->
## The per-tier report scored a rung whose recipe that run had not solved yet — and read it 4x too profitable (2026-08-08)

**Symptom.** After the profit-target line was changed to also score the scenario's LEADING rung (the tier+1
rung), tiers 1–4 reported absurd margins — `railway 708%`, `port 608%`, `arms 291%`, `tooling 201%` — while
tier 0 and tier 5 looked fine. Replaying the SHIPPED preset for the same scenarios gave 603%, 196%, 82%, 50%.
Everything else in those tier blocks was byte-identical between the two runs (GDP, illogicality, price path,
composition), so it was demonstrably the same solve.

**Root cause. A rung's recipe is solved exactly ONCE, in the tier where that rung is DOMINANT.** So when tier
N prints its report, the tier-(N+1) rung sitting in its scenario still carries an **unsolved** recipe — tier
N+1 has not run yet. Dumping both sides for `tooling e2` at tier 1:

```
report (live, era 1):    in = { iron  6.4, wood  9.6 }  ->  201%
config it converges to:  in = { iron 16.8, wood 25.1 }  ->   50%
```

A uniform 2.62× on the inputs, with **prices, wage, employment, throughput, level count and secondary PM
all identical** — which is what ruled out every other explanation in turn.

**Why exactly two tiers looked right, and why that was the clue.** Tier 0's leading rung IS its dominant rung
(`lead = [0,2,3,4,5,5]`), so it had no such row; tier 5 is last, so by the time it reports every rung has
been solved. Those were precisely the two tiers that agreed with the shipped config — the pattern named the
cause before any dump did.

**Fix.** The per-tier line scores only the DOMINANT rung (plus a plateaued industry's permanent top rung).
Scoring the leading rung needs a FINAL pass over all six tiers after the whole solve is finished; until that
exists, the report scores only what is final at the moment it prints.

**Detect / prevent.** This is BALANCE_FRAMEWORK §10.14.1's rule — *never report from a non-finalised state*
— surviving for **recipes** after it had been fixed for **prices**. General check: **before scoring anything
in a per-tier report, ask whether a LATER tier still writes to it.** The cheap detector is the one that worked
here — replay the shipped preset and diff every scored row against the report; any row that disagrees is
being reported from a state that is not shipped.

⚠ **A second, quieter bug rode along.** The `floored` test keys on `h.kind.startsWith('tier')` to choose
between an `I:<industry>` and an `R:building_<name>` lookup. Renaming `kind` to the row's role sent every
lookup down the reference branch, so nothing was ever detected as floored and tier 1's seven floored
industries silently became genuine misses — inflating the very metric being fixed. A string-prefix contract
between two sites 40 lines apart, with no assertion on either end.
### ⚠⚠ IT RECURRED THE SAME DAY, IN `profitTotals()`, AND THE FIX ABOVE IS WHY IT WAS FOUND

Hours after the above was diagnosed and fixed for the profit-TARGET line, the **same defect shipped in the
new `profitTotals()` metric**, which was being written in the same session and also ran inside the per-tier
pass. It summed every rung in the scenario — including the leading rung, whose recipe the next tier had not
solved. Scored against a replay of the shipped presets:

| | 1780 | 1836 | 1870 | 1900 | 1920 | 1945 |
|---|--:|--:|--:|--:|--:|--:|
| in-pass report | £0.01M | £0.09M | £0.40M | **£1.80M** | £4.80M | £8.10M |
| replay of shipped state | £0.01M | £0.06M | £0.08M | **£0.40M** | £2.45M | £8.10M |

**Same fingerprint** — exact agreement at tier 0 and tier 5, divergence everywhere between — which is what
identified it in seconds the second time. Overstated by **4.5×** at 1900, and it hid the fact that the 1870 tier's
loss-makers lose more than the whole tier earns (losses 158% of net).

**Fix:** the per-tier line is removed entirely and a single FINAL PROFIT PASS runs after the whole tier loop,
replaying each shipped preset against the final recipe book (BALANCE_FRAMEWORK §10.41).

⭐ **THE RULE THIS ESTABLISHES: when a defect is found in one report line, SWEEP EVERY OTHER LINE COMPUTED
AT THE SAME POINT.** The first fix was correct, well documented, and did nothing to prevent the second
occurrence, because it was written as a fix to *that line* rather than as a property of *that position in
the solve*. Anything computed inside the per-tier pass is computed before the later tiers have settled the
recipes of the rungs standing in the earlier ones.

⚠ And a limit worth stating: the final pass makes the REPORT honest, not the SOLVE. Tier N's counts were
themselves chosen against the provisional downstream recipes, and no outer loop over the tier sequence
exists. The strict fixed-point check cannot catch that — the inconsistency is deterministic, so it
reproduces byte-identically while still being wrong.

---

<!-- BUGS_AND_FIXES.md lines 1481–1524 at 6cdb618 -->
## The solver reported and shipped a state it had already invalidated (2026-08-04)

**Symptom.** Tier-1 `iron` was flagged at the +75% price ceiling while the very same scenario's order book
said buy 831 against sell 990 — which is a price of **86**, not 175. Tier-1 `hardwood` did the same. Two of
three reported ceiling breaches were goods in surplus.

**Root cause.** `buildScenario` ended with three single passes in a fixed order: sync prices → optimise PMs
→ sync prices → **re-solve every tier-current rung's input recipe**. The recipe re-solve changes what those
buildings buy, which changes the order book, which changes prices — and nothing ran afterwards. So the
`S.thresholds` table that was reported, and written into `config/era_presets.json` as the scenario's
`prices`, described the market *before* the recipes it was shipped alongside. Whichever pass ran last
silently invalidated the other two.

**Why it went unnoticed for so long.** It never produces an error or an implausible-looking number in
isolation — it produces a *self-consistent-looking* report whose parts were computed at different moments.
It also flattered the headline metric, which is the worst possible failure mode for a yardstick: illogicality
read 35 total / 24 net, and the same configuration under corrected accounting scores **65 / 54**. Every
tuning decision taken against the old number was taken against noise.

**Fix.** The closing sequence is now a joint fixed point: the continuous variables (prices, recipes, counts)
are iterated to convergence with the PM choice **held fixed**, then the PM choice is re-checked at the prices
they produced, and the pair repeats. The state that is reported is the state that is shipped, with nothing
mutated after it. Written up as an invariant in `tools/era_scenarios.mjs` and in BALANCE_FRAMEWORK §10.14.1:
**never report or ship from a non-finalised state.**

**Prevent next time.** Any solver that alternates between coupled variables must end on a *convergence*, not
on a pass. If a step changes something a previously computed output depended on, either re-run it or do not
report that output. The instrument now prints its own residual per tier, so a non-converged solve says so.

**Related, found in the same pass** (both BALANCE_FRAMEWORK §10.14):

- **The forward probe.** Every industry placed one level of the *next* tier's rung, "to show the ladder from
  both sides". It was scored by nothing — every check filters to `era <= this era` — and being a ×1.5-bigger
  plant it supplied **61% of tier-1 steel**, most of tier-3 automobiles and most of tier-3 telephones. Those
  three goods sank to the 25% floor and were precisely the ones reported "insolvent at these prices". It was
  also an anachronism (a Bessemer converter in 1836). *Lesson: a display-only element that participates in
  the simulation is not display-only.*
- **A glutted by-product vetoing a starved input.** Building counts follow the revenue-weighted geometric
  mean of their goods' price errors, so a logging camp making ceiling-priced `wood` and floor-priced
  `hardwood` had the two cancel: the solver **shrank logging from 523 levels to 124** while wood's shortage
  tripled. *Lesson: averaging is the wrong aggregator when one of the terms is a constraint violation.*

---
