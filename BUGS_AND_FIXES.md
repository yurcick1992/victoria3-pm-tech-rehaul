# Fixed bugs & root causes

A running log of **non-obvious bugs**, their real root cause, and the fix — the kind that the economics
linter can't catch and that took real investigation to pin down. **Not loaded into context by default.**
Consult it:

- when investigating a **new bug** (the same root causes recur — especially the PM-emitter whitelist and
  main-PM renaming),
- on an **explicit ask** ("what did we fix / why did X break"),
- after a **game update**, alongside `ON_GAME_UPDATE.md`.

Each entry: symptom → root cause → fix → how to detect/prevent next time. Newest first.

---

## A builder's own diagnostic note written INTO the mod, breaking two building files (2026-08-19)

**Symptom.** None from any guard. The build succeeded, `lint.sh`, `lint_solvency.mjs` and
`Invoke-ModChecks` all passed, `preflight.ps1` passed, the mod loaded, the `PM_TECH_REHAUL: init OK`
marker was written and the clock advanced. The only trace was 96 lines of
`gamedatabase.h:378 Duplicated key note: will not be created from file: common/buildings/06_urban_center.txt:165`
in `error.log` — a file expected to carry vanilla's own noise — found at the five-minute smoke check of
a batch that was then stopped and relaunched.

**Root cause.** `Set-BuildingAiValue` (tools/build.ps1) **returns the lines of a building block**, and
reported its "won't override a complex `ai_value` block" note with `Write-Output`. In PowerShell a bare
`Write-Output` inside a function **joins that function's return value**, so the note became line 0 of the
returned array and was written into the emitted file:

```
note: building_power_plant = { has a complex ai_value block - not overriding
building_power_plant = {
```

The note text contains `<key> = {`, an **unbalanced opening brace**, so the parser opened a bogus block,
nested the real definition inside it, and left the file at depth 1 — shifting every subsequent block a
level. Seven such lines, one per cloned tier with a complex vanilla block (3 power + 4 railway).

**Why it had never fired.** The refusal path is correct and deliberate — mangling railway's 164-line
Trans-Siberian / Shinkansen / Trans-Continental `ai_value` block would be far worse than skipping it. But
`Set-BuildingAiValue` is only *called* on a cloned tier when that tier carries an `ai_value` in the config,
and until the ai_value ladder (500 x (era+1) on all 105 tiers) **no power or railway tier ever did**. The
F66 port probe did set ai_values on cloned tiers, but ports carry no complex block, so it took the scalar
path and the note never printed. ⇒ **A branch that has never executed is not known to work** — the same
holds for any `else` in a generator that only a new config shape can reach.

**Fix.** `Write-Output` → `Write-Warning`. A function that returns content must never report through the
success stream; the note is *more* visible on the warning stream, which is what a silent skip deserves.

**Prevention.** Landmine **L24**, `Test-LmL24` in `tools/preflight.ps1`, artifact-side so it runs on every
build: every emitted `common/**/*.txt` must be brace-balanced and hold nothing but script at depth 0.
Deliberately not a grep for `note:` or for `Write-Output` — the class is *a generator leaking its own
output into its output*, and the next one will use different words. Zero false positives over all 36
emitted files of two builds; proven to exit 1 with the original line re-injected.
---

## `predict_good_demand.mjs --obsession-budget 1` never loaded a single obsession — and its verification passed anyway (2026-08-16)

**Symptom.** None, twice over. The flag ran without error, the predicted number MOVED in the expected
direction, and calib3's verdict recorded the term as "implemented and verified on the named case"
(British tea 1627.0 → 1654.5). All of that happened with the obsession table **empty**.

**Root cause, two independent halves.**
1. The culture scan matched the **trimmed** line `cultures={`. A melted gamestate's first such line is
   not the culture database — it is an indented per-country culture-id list (`cultures={ 15 289 }`)
   inside the country records, ~1.9M lines before the real top-level `cultures={`. The loop entered
   it, found no `N={` records, hit depth 0, and **`break`-ed** — the scan ended before the culture
   database was ever reached.
2. Even reaching it would have read nothing: obsession goods are **quoted** in a melt (`"meat"`), and
   the token test was `/^[a-z_]+$/` — unquoted only.

**Why the verification lied.** The term has two halves sharing one renormalisation: obsessions
(per-culture, from the melt — broken) and taboos (per-religion, from game files — working). The tea
movement came from the TABOO half's budget renormalisation over Hindu/Muslim pops, landing close to
the magnitude the obsession story predicted. A moved number is not a fired mechanism.

**Fix** (both `predict_good_demand.mjs` and the new `slave_channel_ab.mjs`): anchor the section at
**column 0** (`line === 'cultures={'`, untrimmed — the same lesson as `score_save.ps1`'s date
anchor), accept quoted goods (`/^"?([a-z_]+)"?$/`), and print the loaded obsession count so an empty
table is visible (`obsessions: N culture(s) carry one`).

**Detect/prevent.** A term whose input table can silently be empty must SAY how many entries it
loaded — and a verification must check the mechanism's *input* fired, not only that the output moved.
(With the fix in place the F44 budget term was then properly measured — and REFUTED, F61: it worsens
all three calibrated markets. The bug hid a negative result, not a positive one.)

## `build.ps1 -Config X` built X's buildings with the CANONICAL config's technologies (2026-08-12)

**Symptom.** None. That is the whole problem — the build succeeded, the linter passed, `Invoke-ModChecks`
passed, preflight passed, and the mod loaded.

**Found by** checking a *pending* measurement rather than a failure. Batch B of the research-events work
was to re-run batch A with **doubled** employment thresholds, from
`config/mod_config.2x_thresholds.json`. Asking "will it actually emit the doubled numbers?" produced the
answer *no*.

**Root cause.** `build.ps1` threads `-Config $cfgPath` through every step — `extract_presets.ps1`,
`extract_start.ps1`, `convert_history.ps1` — **except the two newest ones**. `emit_techs.mjs` and
`emit_research_events.mjs` were called with only the mod root and read `config/mod_config.json`
directly, by name. So an alternate-config build emitted:

- **buildings** from the alternate config,
- **technologies** from the canonical one — a tier present only in the alternate gets no unlocking
  technology (a building nobody can construct), and one present only in the canonical gets a technology
  unlocking a building that does not exist (an engine error at load),
- **research events** from the canonical one — including the whole `research_events` block.

**What it would have cost.** Demonstrated, not inferred: running `emit_research_events.mjs` the old way
(no config argument) against the batch-B mod root produces output **byte-identical to the canonical
arm** — 15 000 / 45 000 / 135 000 / 405 000, batch A's thresholds. Batch B would have been an exact
rerun of batch A, ~5 hours of game time, and the honest reading of the result would have been *"doubling
the thresholds changes nothing"*: a confidently wrong finding with clean-looking data behind it.

**Fix.** Both emitters take the config path as `process.argv[3]`, defaulting to the canonical one, and
`build.ps1` passes `$cfgPath` to both.

**The guard that should have caught it was itself wrong, twice.** `emit_techs.mjs` carried a staleness
check comparing `tech_tree_options.json`'s mtime against `config/mod_config.json`'s — the wrong file on
this path, and mtime is the wrong test anyway: too weak (a tree regenerated after an unrelated edit
passes while still missing a tier) and too strong (any config touched later trips it, which blocked the
batch-B config outright for merely existing). It now checks what it means: **every tier this build will
emit must name a technology the shipping tree contains.**
⚠ And the first version of *that* threw on all ten tiers with no technology at all — which are correct:
a tier with no `tech` is available from the 1836 start, which is exactly right for the pre-industrial
era-0 rungs and the vanilla basic port. Only a tier that *names* a technology can be wrong about it.
The start-available ones are counted and printed instead, so an accidental one is still visible.

**Detecting it next time.** The general shape is *a build step that ignores the config the build was
given*, and it is worth grepping for whenever a step is added: `grep -n "mod_config.json" tools/*.mjs`.
Three tools had the same defect in one day — this one, plus `era_solver.mjs` (read the redirected config
via `econ_host`, wrote its solved recipes into the canonical one) and `build_era_ladder.mjs`. All now
take the path explicitly.
⚠ **No shipped measurement is affected.** Both emitters are ROADMAP step 1/2, added 2026-08-11/12; the
only sessions that used a non-canonical config predate them.

---

## A `+` in the wrong place aborts every concurrent-harvest batch, and blames the wrong script (2026-08-12)

**Symptom.** `run_schedule.ps1` builds the mod, reports `build ok`, reports `autosave archiver alive
(pid …)`, and then dies with:

```
run_schedule.ps1 : A positional parameter cannot be found that accepts argument '+'.
    + CategoryInfo : InvalidArgument: (:) [run_schedule.ps1], ParameterBindingException
```

The session folder is created and looks like a started run — `build.log`, `telemetry.json`,
`save_provenance.json`, an empty `saves\` — but there is **no `run.log`, no `meta.json`, and the game
never launches**. Reproducible in the foreground and in the background, so it is not a wrapper artefact.

**Root cause.** The save-harvester launch was written as

```powershell
Start-Process powershell … -ArgumentList @(
    "-ExecutionPolicy","Bypass","-File","…harvest_saves.ps1",
    …,"-Watch") + $(if ($KeepSaves) { @("-NoReap") } else { @() })
```

PowerShell binds the array literal to `-ArgumentList` and then reads ` + ` as the **next positional
argument to `Start-Process`**, which has none left. Two things make it hard to see: the error is
attributed to **`run_schedule.ps1` itself** rather than to `Start-Process`, several frames from the
mistake; and it fires *after* the archiver is already running, so the failure looks like the observer
refusing to start rather than a parse problem in the line before it.

⚠ A minimal repro does **not** reproduce it — `-ArgumentList @("-a","-b") + $(…)` against a simple
function binds cleanly. It needs a cmdlet with positional parameters left to bind, which `Start-Process`
has and a one-parameter function does not. Do not conclude from a small test that the construct is safe.

**Fix.** Build the array first, append conditionally, then pass it:

```powershell
$harvArgs = @("-ExecutionPolicy","Bypass","-File","…","-Watch")
if ($KeepSaves) { $harvArgs += "-NoReap" }
Start-Process powershell … -ArgumentList $harvArgs
```

**Detection next time.** The signature is a session folder with `build.log` but **no `run.log`** — the
scheduler got past the build and never reached the observer. `Get-ChildItem <session>\run001_*` answering
that question takes two seconds and is worth doing before diagnosing anything else. Note also that
`[Parser]::ParseFile` reports the file as syntactically **clean**: this is a binding error, not a syntax
error, so a parse check cannot catch it — only running it can.

⚠ It also stranded **six** `run_schedule.ps1` processes across retries, each with its own archiver
watching the same save folder. Kill by matching `run_schedule\.ps1` / `archive_autosaves\.ps1` in the
command line — and exclude `Get-CimInstance` from the match, or the query process matches **itself** and
you spend several minutes chasing an archiver that was never there.

---

## Three ways to launch a process that never runs — the savegame harvest's first hour (2026-08-11)

**Symptom, all three times: nothing failed.** A worker "started", the log said so by pid, and no output
ever appeared. These are worth one entry together because they share a shape — *a launch that reports
success and produces nothing* — and because the pipeline they were in **deletes savegames**, so any of
them under a reap-first design would have destroyed a century of evidence rather than merely wasting it.

**1. `Start-Process -ArgumentList` quotes NOTHING, and this repo's path has a space.**
`tools\testbed` sits under `C:\claude-code\victoria 3 PM and tech rehaul\`. `-ArgumentList @(…)` joins
its elements with spaces and adds no quoting, so `powershell -File <that path>` became
`-File 'C:\claude-code\victoria'` and PowerShell replied *"does not have a '.ps1' extension"* — **into a
hidden window**, which is what made it silent. Hit twice: once in the harvest worker pool (`node` handed
a truncated script path, exiting 1 on every save) and once in the scheduler's autosave archiver, where
**the batch played 3.5 in-game years capturing nothing** before it was noticed and stopped.
⚠ **The opposite rule applies to `& powershell @args`**, which quotes each element itself — pre-quoting
there nests the quotes. Two invocation styles, two contradictory rules, in the same twenty lines.
**Fix:** quote every path in the `Start-Process` call, leave the `&` call bare, and make the scheduler
**prove the archiver is alive** (sleep 3, check `HasExited`, print the redirected stderr and shout) rather
than reporting that it was started.

**2. `Start-Process -PassThru` gives an EMPTY `ExitCode` unless the handle was materialised.**
`$p.HasExited` was `$true` and `$p.ExitCode` was `''`, so every finished worker was scored as a failure.
The queue is defined as "saves with no summary yet", so the same four saves were re-dispatched forever —
**888 "failures" in one minute**. **Fix:** `$null = $p.Handle` immediately after `Start-Process` (which
makes PowerShell cache the exit code), *plus* a failure blocklist so a permanent failure can never be
retried in the same pass. Both are needed: the second is what stops a genuine defect becoming a spin.

**3. A local `$out` inside a function IS the script's `$Out` parameter.** PowerShell variable names are
case-insensitive, so `$out = Join-Path $Out "$stem.json.gz"` **rewrote the output directory** on the first
launch, and every subsequent path became
`…\_summaries\0001_autosave.json.gz\0001_autosave.partial.json.gz`. **Fix:** name the local `$dest`.

**A fourth, caught on a dry run rather than in the batch:** PowerShell 5.1's `Out-File -Encoding utf8`
writes a **BOM**, so a hand-authored provenance file made `JSON.parse` throw — *after* the whole melt had
been parsed. The reader now strips a BOM (the repo already knew to: `verify_pms.mjs` documents that every
vanilla file starts with one).

**How this was caught rather than shipped.** The harvester **verifies the artifact before reaping the
save** — gunzip it, parse it, require a `save_summary_version`, a date and ≥10 countries — and never
deletes a `.v3` whose summary failed. Landmine **L12** then enforces the same thing over a whole session
after the fact. The verify-before-reap order is not caution; it is the only reason three launch bugs cost
five minutes instead of a batch.

---

## The vanilla building "anchor" was tier POSITION 1 — switching on the era-0 rungs silently shipped vanilla's buildings for 9 industries (2026-08-11)

**Symptom.** Nothing failed. The build was green — lint, negative-goods, mod checks and preflight all
passed — the mod loaded, the game ran to date and self-quit. Only `error.log` knew, with nine lines:
`gamedatabase.h: Duplicated key building_food_industry will not be created from file:
common/buildings/01_industry.txt`, once each for food, textile, furniture, glass, tooling, paper, steel,
arms and artillery.

**Root cause.** `build.ps1` keyed each industry's generated block set on **`$ind.tiers[0].key`**, on the
assumption that the first tier is the one reusing the vanilla building key. That held for as long as the
era-0 rungs were `model_only`. The moment they were switched on (ROADMAP step 1), `tiers[0]` became an
**invented** key — `building_food_industry_artisanal` — so:
1. the vanilla `building_food_industry` block matched nothing in `$genByBase` and was copied through
   **verbatim**, and
2. the "no vanilla anchor in this file, append as a new industry" fallback then appended our whole set,
3. giving **two definitions of the same key in one file**.

The engine does not crash on that. It keeps the **first** — vanilla's — and logs one line. So the mod
shipped **vanilla's** food industry, textile mill, steel mill and six more: no tiers, no new recipes, no
tech gating, for exactly the nine industries that have a pre-industrial rung. Everything downstream
still looked right, because the generated file *contained* our buildings; they were simply never loaded.
⚠ The same assumption also drove `aliases`, which are only legal on the building that reuses the vanilla
key: they were being written onto the era-0 rung.

**Fix.** Compute an explicit **anchor tier** per industry — the lowest-era tier that carries a
`vanilla_pm` — and key both `$genByBase`/`$genFileOf` and the `aliases` emission on it. An all-new chain
with no `vanilla_pm` anywhere (the steamer shipyard) falls back to `tiers[0]` and is appended, which is
what the existing `note:` line already reports.

**Detect / prevent.** `error.log` was the *only* witness, and it is expected to carry vanilla's own
noise, so nobody reads it — the exact shape TESTBED_LANDMINES exists for. Two cheap guards, both now
used: a **duplicate-key scan of the emitted buildings files** (104 blocks, 0 duplicates), and grepping a
run's `error.log` for `Duplicated key`. A build-time assertion belongs in `Invoke-ModChecks`.
⚠ **Generalise the lesson: any "the first tier is the vanilla one" assumption is now false.** The ladder
grew a rung *below* the vanilla anchor, so tier POSITION no longer implies tier ROLE anywhere. The same
class already bit the user-facing tier numbering (CLAUDE.md: "N IS THE ERA, NEVER A POSITION").

---

## A frozen PM selection was never re-validated against PROFIT — a −40% method shipped with +159% one candidate away (2026-08-10)

**Symptom.** The era-0 preset's textile mill ran `pm_craftsman_sewing` — buying silk to make
luxury_clothes in a scenario whose SoL-7 pops buy no luxury at all, so the output sat at the 25% price
floor while the 30 clothes/level the method sacrifices traded at 161. Replayed on the shipped state:
−40.5% with the method on, +159.4% with it off. The same defect ran the other way at era 4, where two
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
ceiling, and to dominance — **but each pin gets exactly ONE appeal per era, heard late**. The first
version lifted unconditionally every round, and a genuinely bistable pair is dominated from whichever
side it holds, so it was re-opened forever: the settling property §10.48 bought came straight back off
("PM settled 1/6" on the first shipped write). Late + once means the appeal is judged at near-converged
prices, and a choice that re-freezes after its appeal stands as best-of-cycle at those prices.

**Detect/prevent.** The threshold is deliberately far above `ERA_PM_MINGAIN` (0.25 vs 0.10) so the lift
cannot reintroduce the churn the hysteresis killed; anything surviving is within 25pp of optimal at
final prices or a bistable pair that already had its late appeal. When a shipped selection looks absurd
in the UI, replay the preset and toggle the PMG — the two-line check that found this one (see §10.49.5).

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

## The integer polish could not CLEAR a standing ceiling breach — and the macro veto blocked the one move that could (2026-08-10)

**Symptom.** Scenarios shipped with a hard-constraint violation standing (era-1 `clippers buy 106 /
sell 48` from the 1-level shipyard, price pinned at 175) while the polish reported "0 moves accepted":
one +1 shipyard level would have priced clippers at ~110, and nothing ever took it. Under the old
jitter defaults this was live in the SHIPPED ensemble — seeds 9 and 10 both carried a standing era-1
breach the polish never tried to fix.

**Root cause.** Two layers. (1) The polish's objective was `illogicality → losses → net` with a guard
that only refused NEW breaches — a standing breach was invisible to it, so a breach-clearing move was
scored purely on profit keys it usually loses. (2) With that fixed, the macroscenario gap-sum veto
still rejected the move: the shipyard's value added is negative, so adding a level SHRINKS the mapped
denominator, every other share rises, and a standing above-cap gap (era-1 paper) widens by a hair. The
veto ran before the objective, so the hard constraint lost to the soft layer — inverting the precedence
the rest of the solver enforces (macro enforcement undoes its own steps on a ceiling breach).

**Fix.** Ceiling breaches lead the polish objective lexicographically (breaches → faults → losses →
net), and a move that strictly clears a breach without creating one is exempt from the macro-gap veto.
Measured: the default ensemble went from standing era-1 breaches on two of three seeds to the ceiling
CLEAR on all six eras of all three seeds, illogicality unchanged.

**Detect/prevent.** When a constraint is declared to outrank everything, grep for every accept/reject
decision and check the constraint appears — at the RIGHT precedence — in each. A hard constraint that
is merely "guarded against getting worse" can never recover from a violation that arrives by any other
path; some pass must be rewarded for clearing it.

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

## The futility guard blocked growth at the CEILING it was needed for (2026-08-09)

**Symptom.** The 1780 iron mine sat at 1 level, 419% margin, its good pinned at the 175 ceiling with
buy 58 / sell 22 — and the count machinery never grew it, run after run, seed after seed. The era-2
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

## The date gate's first runs: a field the model drops, and a wall that didn't propagate (2026-08-09)

Three defects surfaced in the first two runs of §10.44's date gate, each caught by a deliberate loud
failure rather than by shipping wrong numbers.

**1. `makeTiers` dropped `tech_year` — the `input_ratio` defect class, recurring.** The solver THREW
("building_food_industry_artisanal has no tech_year") although the config plainly carried the field:
`ui/econ.js`'s `makeTiers()` copies a FIELD WHITELIST from config tiers into the model, and any new
config field is silently absent until added there — exactly how `input_ratio` once made the frozen-mix
branch unreachable dead code (§10.25). Fixed in both copies (econ.js + builder.html's fork). The reason
this cost minutes instead of a shipped defect: the gate THROWS on a missing date instead of falling
back to era arithmetic. A fallback would have run the old placement silently under the new flag.
**Detect next time:** when adding a config field the solver reads, grep `makeTiers` FIRST — it is the
choke point every tier field passes through, in two copies.

**2. The chain rule was one-pass, and a two-link chain slipped through.** At the date-gated 1836 the
explosives factory is correctly dropped (its FERTILIZER input debuts 1842 — superphosphate's honest
date), but the munition plant had already passed its own explosives check against a producer list built
BEFORE any drop — and shipped with `explosives buy 49 / sell 0` pinned at the ceiling, the exact
"buyer whose supplier cannot exist" the rule exists to prevent. The rule's producer set is now rebuilt
after every drop and the filter iterates to a fixed point (bounded by the tier count). The date gate
did not create the defect — it created the first chain of length two (fertilizer→explosives→munition)
the one-pass version ever faced.

**3. A date inside the honest range can still be the wrong date — the 1780 hardwood pin.** Furniture's
e1 manufactory dated 1770 placed at 1780, and its recipe eats HARDWOOD — produced only by a tech-gated
logging secondary the 1780 scenario cannot run, and invisible to the chain rule (hardwood is not a
tiered good, so `GOOD_FIRST_ERA` has no entry and `unproducible()` waves it through by design).
`hardwood buy 73 / sell 0 — NO PRODUCER AT ALL`. The authoring fix: the honest range for manufactory
joinery is 1770 (Gillows-scale London) to ~1800 (provincial manufactory scale); WITHIN an honest range
the tie-break is input-chain producibility → 1800. Recorded in the spec note. The general limitation —
the chain rule guards tiered goods only — stands, documented, with the ceiling tripwire as its detector.

## The pm_goods writer and the model disagreed on what an override IS (2026-08-09, latent — found by inspection)

**Symptom.** None — that is the point. `pm_goods` was empty, so nothing had ever exercised the divergence.
The electricity pass (§10.43) would have been its first user and its first victim: the model would price
urban centres on the new streetlights recipe (+1 electricity out, −1 coal in) while the emitted mod kept
electricity −3 with no coal at all.

**Root cause.** Two implementations of one contract. `ui/econ.js`'s `pmRec()` has always read an override
as the PM's WHOLE goods map (`in: o.in || v.in` — replacement), while `build.ps1`'s writer walked the
vanilla lines and only REQUANTIFIED goods that already had a line — it could neither add a good nor remove
one. Every historical use happened to only requantify, so the fork stayed invisible.

**Fix.** The writer now implements replacement (`Convert-PmBlock`): drop every goods line in the PM block,
write the override's inputs+outputs into `building_modifiers → workforce_scaled`; same for the new
`pm_employment` into `level_scaled`; drop a `required_input_goods` whose good left the inputs (a producer
gated on its own product deadlocks — MODDING_NOTES); THROW on an override naming an unknown PM or a PM
without the target sub-block.

**Two more found while building it.**
- **PowerShell scalar-unwrap**: a ONE-line employment override came back from the builder scriptblock as a
  bare string; `$new[$n]` then indexed CHARACTERS and the emitted `level_scaled` block held a single tab
  instead of the engineers line — silently, build green. `@( )` around the invocation is load-bearing and
  commented as such. Caught only by reading the emitted artifact (the verify-the-artifact principle).
- **`era_solver.mjs` still carries a pre-`era_pm.mjs` fork of `candidates()`** — the mandate landed in the
  shared copy and era 0 of `era_prices.json` still showed gas streetlights. The fork has also already
  drifted exactly as era_pm's header predicted (it lacks the coerced-labour ban). Both forks now consult
  the one `mandatedPick()`; full dedup filed as its own task.

**Detect next time.** When a mechanism has a model half and an emitter half, test it with a case that
exercises the SEMANTIC difference (add + remove, not just requantify), and read the emitted file rather
than trusting a green build.

## The in-era illogicality count was fiction — it scored recipes that never ship (2026-08-09)

**Symptom.** The headline illogicality read 52 (47 excluding shipyards) while a replay of the criterion on
the SHIPPED presets — final recipes, final counts — read **94 (84)**. Under the outer era iteration the
in-era count "worsened" to ~90 and converged to the replayed one.

**Root cause.** The same §10.14.1/§10.39.3/§10.41.1 defect in its fourth home: `ladderFaults` judges the
newest PRESENT tier, and during era N that leading rung still carries its provisional (leanest-legal,
canonical-start) recipe — lean recipes look profitable, so fault 1 (loss-making) and fault 3 (inverted)
were systematically under-counted mid-ladder. The truth was always ~94; "52" measured a state no one ships.

**Fix.** The criterion is now ALSO replayed on the shipped state (`FINAL-STATE ILLOGICALITY`), together
with leading/dominant-rung scoring and a losses-by-vintage split; the final-state figure is the headline,
and the outer iteration (ERA_OUTER, default 3) closes the gap at its source by re-solving every era against
the final recipe book.

**Detect next time.** Any number computed inside the era pass is suspect until it agrees with a replay of
the shipped preset — the fingerprint of this defect family is exact agreement at era 0 and era 5 with
divergence between.

## The urban-centre reduction is what broke 1870 and 1900 (2026-08-09)

**Symptom.** The 2026-08-08 handover's open item: 1870's net fell 0.43M → 0.08M and 1900's 1.33M → 0.40M
somewhere in the gold/urban/art batch, losses tripling, attribution contaminated.

**Root cause.** `ERA_URBAN_SHRINK` cut urban centres at ANY loss. At 1870/1900 they sat at −2%, so each cut
bought almost nothing — while counts are the dependent variable (full employment by construction), so every
cut poured clerks into productive industry and flooded all markets at once. Measured: turning only that
knob off restored 1870 to net 208k / losses 37k and 1900 to 1.4M / 111k. The art-academy change was
innocent (reverting it made losses AND faults worse).

**Fix.** Two-stage. First a loss floor (`ERA_URBAN_FLOOR=-0.10`: cut only below −10%) recovered the two
eras while keeping 1836's −49% case cut. Then the ruled set's outer iteration + unified enforcement
absorbed the breaking mechanism entirely — under them the floor, the unconditional cut and never-cutting
are statistically indistinguishable — so the special case was REMOVED again (default 0, cut at any loss,
same rule as manufacturing) and the knob remains as the A/B instrument.

## A raw-only solvency re-check recreated the phase-ordering bug it existed to close (2026-08-09)

**Symptom.** In the first full combination run, era 5 shipped `chemical_plant_reforming` at **116 levels ×
−46% = £448k/wk** — 60% of the era's losses in one building type — while the report's own reduction had
terminated cleanly.

**Root cause.** The new post-tuner §10.18 re-check dropped/shrank raw producers AFTER the manufacturing
reduction had finished. Prices moved out from under the reduction's last check, fertilizer went deep
underwater, and no rule that could cut manufacturing was still running. Same failure class as §10.18's
"each round must begin from a converged state": any enforcement phase that runs after another phase's
final check can invalidate it.

**Fix.** ONE unified counts-only enforcement loop over every rule at once (raw solvency, manufacturing
losses, urban floor) — worst violation first, settle + re-price after each step, terminate only when
everything is clean simultaneously. Era-5 losses under the same combination fell 728k → 127k.

**Detect next time.** When adding any post-solve rule, ask what other rule's terminal check it can
invalidate; if the answer is anything, it belongs inside the shared loop, not after it.

## The scale-limit verification counted subsistence fishing villages against the commercial cap (2026-08-09)

**Symptom.** `SCALE LIMITS … ⚠⚠ BREACHED — fishing 102 (the cap failed to apply; this is a bug)` the
moment the fishing wharf sat at its cap of 100.

**Root cause.** The verification summed every building matching `/fishing/`, and
`building_subsistence_fishing_village` matched — but subsistence buildings are sized from the peasants and
were never subject to the caps, so 100 wharf + 2 villages printed a phantom breach. Enforcement was
correct throughout; only the check lied.

**Fix.** The verification skips subsistence buildings, matching what `applyCounts` actually caps.

---

## The per-era report scored a tier whose recipe that run had not solved yet — and read it 4x too profitable (2026-08-08)

**Symptom.** After the profit-target line was changed to also score the scenario's LEADING tier (the era+1
rung), eras 1–4 reported absurd margins — `railway 708%`, `port 608%`, `arms 291%`, `tooling 201%` — while
era 0 and era 5 looked fine. Replaying the SHIPPED preset for the same scenarios gave 603%, 196%, 82%, 50%.
Everything else in those era blocks was byte-identical between the two runs (GDP, illogicality, price path,
composition), so it was demonstrably the same solve.

**Root cause. A tier's recipe is solved exactly ONCE, in the era where that tier is DOMINANT.** So when era
N prints its report, the era-(N+1) tier sitting in its scenario still carries an **unsolved** recipe — era
N+1 has not run yet. Dumping both sides for `tooling e2` at era 1:

```
report (live, era 1):    in = { iron  6.4, wood  9.6 }  ->  201%
config it converges to:  in = { iron 16.8, wood 25.1 }  ->   50%
```

A uniform 2.62× on the inputs, with **prices, wage, employment, throughput, level count and secondary PM
all identical** — which is what ruled out every other explanation in turn.

**Why exactly two eras looked right, and why that was the clue.** Era 0's leading tier IS its dominant tier
(`lead = [0,2,3,4,5,5]`), so it had no such row; era 5 is last, so by the time it reports every tier has
been solved. Those were precisely the two eras that agreed with the shipped config — the pattern named the
cause before any dump did.

**Fix.** The per-era line scores only the DOMINANT tier (plus a plateaued industry's permanent top tier).
Scoring the leading tier needs a FINAL pass over all six eras after the whole solve is finished; until that
exists, the report scores only what is final at the moment it prints.

**Detect / prevent.** This is BALANCE_FRAMEWORK §10.14.1's rule — *never report from a non-finalised state*
— surviving for **recipes** after it had been fixed for **prices**. General check: **before scoring anything
in a per-era report, ask whether a LATER era still writes to it.** The cheap detector is the one that worked
here — replay the shipped preset and diff every scored row against the report; any row that disagrees is
being reported from a state that is not shipped.

⚠ **A second, quieter bug rode along.** The `floored` test keys on `h.kind.startsWith('tier')` to choose
between an `I:<industry>` and an `R:building_<name>` lookup. Renaming `kind` to the row's role sent every
lookup down the reference branch, so nothing was ever detected as floored and era 1's seven floored
industries silently became genuine misses — inflating the very metric being fixed. A string-prefix contract
between two sites 40 lines apart, with no assertion on either end.
### ⚠⚠ IT RECURRED THE SAME DAY, IN `profitTotals()`, AND THE FIX ABOVE IS WHY IT WAS FOUND

Hours after the above was diagnosed and fixed for the profit-TARGET line, the **same defect shipped in the
new `profitTotals()` metric**, which was being written in the same session and also ran inside the per-era
pass. It summed every tier in the scenario — including the leading tier, whose recipe the next era had not
solved. Scored against a replay of the shipped presets:

| | 1780 | 1836 | 1870 | 1900 | 1920 | 1945 |
|---|--:|--:|--:|--:|--:|--:|
| in-pass report | £0.01M | £0.09M | £0.40M | **£1.80M** | £4.80M | £8.10M |
| replay of shipped state | £0.01M | £0.06M | £0.08M | **£0.40M** | £2.45M | £8.10M |

**Same fingerprint** — exact agreement at era 0 and era 5, divergence everywhere between — which is what
identified it in seconds the second time. Overstated by **4.5×** at 1900, and it hid the fact that era 1870's
loss-makers lose more than the whole era earns (losses 158% of net).

**Fix:** the per-era line is removed entirely and a single FINAL PROFIT PASS runs after the whole era loop,
replaying each shipped preset against the final recipe book (BALANCE_FRAMEWORK §10.41).

⭐ **THE RULE THIS ESTABLISHES: when a defect is found in one report line, SWEEP EVERY OTHER LINE COMPUTED
AT THE SAME POINT.** The first fix was correct, well documented, and did nothing to prevent the second
occurrence, because it was written as a fix to *that line* rather than as a property of *that position in
the solve*. Anything computed inside the per-era pass is computed before the later eras have settled the
recipes of the tiers standing in the earlier ones.

⚠ And a limit worth stating: the final pass makes the REPORT honest, not the SOLVE. Era N's counts were
themselves chosen against the provisional downstream recipes, and no outer loop over the era sequence
exists. The strict fixed-point check cannot catch that — the inconsistency is deterministic, so it
reproduces byte-identically while still being wrong.

---


## ✅ CLOSED — crash resume was working all along; the HARNESS was throwing it away on a stale clock reading (2026-08-06)

> ### ✅ CONFIRMED IN THE FIELD, same day, first guarded campaign
> `20260806_110926_vanilla-retest-2` run 1, control arm. **Two genuine CTDs, both recovered, run
> continuing past both:**
>
> | | crashed at | crash dump | outcome |
> |---|---|---|---|
> | 1st | 1889.3.1 | `victoria3_01260706_121501` | resumed, continued |
> | 2nd | 1899.3.1 | `victoria3_01260706_123032` | resumed, continued |
>
> Reached **1917.4** — 28 in-game years past the first crash, and past **1893**, the best any campaign
> had ever managed. No `resume started a fresh game`, no abandonment.
>
> **What changed is the VERDICT, not the resume.** The only relevant fix between the two nights is that
> `$firstTick` is now judged against each tick line's own `[HH:MM:SS]` rather than its arrival order.
> Under the old code these two crashes would have been sampled during the ~100 s window where the tail
> still serves the previous session's content, and abandoned.
>
> ### ⚠ AND THE FIX MOVED THE BOTTLENECK: the resume BUDGET is now what ends a campaign
>
> Same night, run 2 of the same batch: crashed at 1875, 1901, 1927, 1929 and 1932, **recovered from
> every one**, and was then stopped by `-MaxResumes` at **1933.3.1** — three in-game years short of
> 1936, after 2 h 21 m. `abandoned_reason: "resume budget exhausted"`, `self_quit: false`.
>
> That is a different failure from the one this entry was written about: nothing was mis-judged and
> nothing was thrown away, the counter simply ran out. **Raised 5 → 12.** Safe to raise because two
> separate guards already bound the pathological cases — 3 crashes from the *same* autosave is a
> permanent failure, and 3 before any autosave exists aborts the whole schedule — so this counter only
> limits how many *distinct* points a run may recover from. ⚠ Not free: each resume replays up to one
> autosave interval, so a run approaching the new cap is reporting a stability problem, not a budget
> one. Watch `resumes` in `meta.json`.
>
> ⚠ **Measured crash rate, for planning:** **4 and 6 CTDs per century** across the two control
> campaigns — roughly one per 15–25 in-game years, and all of them recovered. Crashes are now a cost in
> replayed minutes rather than a threat to the run.
>
> ⚠ **This does not prove the four earlier campaigns were each wrongly abandoned** — different crashes,
> different saves, and their evidence was never recorded. What it does establish is that the
> configuration the old entry called untested — *a real CTD, late in a long campaign* — resumes fine.
> The mid-write-truncation hypothesis remains plausible but is now **unnecessary** to explain anything
> observed, and the fallback ladder built for it has still never fired.

**Original entry, kept because its evidence stands and its conclusion is the instructive part:**

## ⚠ (superseded) crash resume has NEVER worked: 4 of 4 full campaigns died mid-run and every resume started a fresh 1836 game (2026-08-06)

**Symptom.** **No 1836→1936 campaign has ever completed.** Every full-length run on record, across two
different arms and two nights, ended the same way:

| session | arm | reached | target | resumes | outcome |
|---|---|---|---|---|---|
| `20260805_150128_debut-good-full-v11` run 1 | `config` | 1925.3.1 | 1936.1.1 | 1 | resume started a fresh game |
| `20260805_150128_debut-good-full-v11` run 2 | `config` | 1927.4.1 | 1936.1.1 | 1 | resume started a fresh game |
| `20260805_234555_vanilla-retest` run 17 | `control` | 1893.3.1 | 1936.1.1 | 1 | resume started a fresh game |
| `20260805_234555_vanilla-retest` run 18 | `control` | 1867.3.1 | 1936.1.1 | 1 | resume started a fresh game |

`self_quit` is **false** in all four — the game never reached its target date and quit itself. Five CTD
minidumps were written on the night of 2026-08-05/06 alone.

**The guard works; the resume does not.** `Test-OwnSaveIsNewest` and the landed-clock check both fire
correctly and refuse to splice a foreign timeline into the data — that is why nothing silently corrupt
has shipped. But the resume they are guarding is **0 for 4**.

**❌ THE `-handsoff` HYPOTHESIS IS DISPROVEN — TESTED 2026-08-06, session `resume_diag`.** It was
proposed here that `-handsoff` overrides `-continuelastsave` and starts a fresh 1836 observer game.
**It does not.** A short control run was killed mid-flight and the harness's own resume path was
allowed to run:

| | |
|---|---|
| killed at | 1837.3.5, with an autosave from that same second |
| resumed at | **1837.3.2** — the last autosave, three in-game days back. Correct. |
| session mode after resume | **observer**, `continue_game.json` → `"desc": "Observing Great Britain"` |

So `-continuelastsave` (a) is a real flag — it is present in the exe's string pool, which also rules
out a silent no-op — (b) loads the autosave with `-handsoff` present, and (c) **keeps observer mode**
rather than handing control to a player. Autosaves are fine too: at `monthly` they fired every ~5 s of
wall time, 28 MB each.

**⭐ SO THE FAILURE IS NARROWER THAN THIS ENTRY FIRST CLAIMED.** Resume works for a **clean kill, early
in a short run, with a fresh small save**. All four real failures were the opposite on every axis: a
genuine CTD, late in a 100-year campaign, `yearly` autosaves, and much larger save files.

**⭐ NEW LEADING HYPOTHESIS, UNTESTED: the CTD lands DURING an autosave write, leaving a truncated
`.v3`.** An autosave stalls the game and writes 28–95 MB; a crash mid-write leaves a file that exists,
is newest, and passes `Test-OwnSaveIsNewest` — but fails to load. And MODDING_NOTES already records the
consequence: *a failed load plus `-handsoff` starts a fresh 1836 game* (verified there against a bad
`-loadsave=` path). Run 18 landing on exactly **1836.1.1** is precisely that signature.
**How to test:** after any real CTD, check the newest `.v3` for a truncated size against its siblings
before resuming — and if it is short, resume from the one before it instead.

**⚠ A SECOND, SEPARATE BUG FOUND BY THE SAME RUN — the harness's clock reading is STALE AT STARTUP.**
For the first ~100 seconds the harness reported `in-game 1877.2.13` while the game was demonstrably at
**1836.2** (its own `dedicated_server.log` said so). 1877 was the *previous night's* content: the game
rotates its logs at startup, and the tail keeps reading from an offset established against the old,
much larger file, so it sees nothing new until the fresh log grows past that point. Even once caught up
it lags the real clock by ~3 in-game months.
**This is not cosmetic, and the mechanism is exact.** All three resume verdicts are computed from
**`$firstTick`** — *the first tick observed after the relaunch* — which is sampled in precisely the
window where the tail is still serving the previous session's content:

```
$landed = ConvertTo-DateNum $firstTick        # ← stale for ~100 s after any relaunch
if ($landed -gt $wanted)              → "resume loaded a save ahead of the run"
if ($wanted - $landed -gt 20000)      → "resume started a fresh game"
```

⚠ **Run 19's abandonment has an obvious stale-read explanation.** It was killed at 1854.3.1 and
abandoned as *"resume loaded a save ahead of the run"*. A stale tail serves content from near the END
of the pre-rotation file — i.e. that run's own latest pre-crash date, ~1881 — so `landed > wanted`
fires and a perfectly good resume is discarded as a foreign save. That is the same shape as the
diagnostic's 1877-for-1836 misread.

**⭐ THE FIX, and the log makes it easy: every tick line carries its own wall clock.**

```
[10:18:02][jominiapplication.cpp:539]: Processing Tick: 1836.10.15.6
```

So **do not judge a resume until a tick line appears whose own timestamp is later than the relaunch**,
and ignore every line older than that. That is robust without needing to detect rotation at all. Detect
rotation as well (size shrink / handle identity) so the *progress display* stops lying, but the verdict
must key on the line's timestamp, not on arrival order.

⚠ **Whether each of the four campaigns was wrongly abandoned cannot be recovered after the fact** — the
verdict was recorded, the evidence behind it was not. Treat the "resume never works" conclusion as
**unproven in both directions** until the harness is fixed and a real CTD is observed under it.

**Why it went unnoticed.** The failure is *reported* — `abandoned_reason` says exactly what happened —
but it is reported per run in `meta.json`, and the harness still exits 0 and logs `run N finished: ok`,
so a schedule of many runs looks healthy at the session level. Nothing aggregates "did this campaign
actually reach its target date".

⚠ **What this does to existing data.** Contamination is at the **early** end, not the late end: the
fresh game re-dumps early dates and the harness keeps the later value, so the *original* timeline's
early dumps are overwritten (81 rows in run 17, 165 in run 18). Dates after the crash simply do not
exist. So a late-campaign reading such as F33's 1920–1924 telephone rows is from the original timeline
and is not spliced — but **any run's earliest years may be from the restart**, and every such run is
truncated well short of 1936.

**Prevention.** Two things are missing and both are cheap: a **session-level summary of runs that did
not reach their target date** (today you have to open each `meta.json`), and treating `self_quit: false`
on a full-length run as a loud failure rather than a field nobody reads.

---

## `c:TAG` on a country that no longer exists is an ERROR, not `false` — and our own telemetry emits 574 000 of them per campaign (2026-08-06)

**Symptom.** A pure **vanilla control** run — no mod content at all beyond telemetry — wrote **574 455
lines to `error.log`** over one 1836→1936 campaign, of which **48 659** name our own
`common/on_actions/zzz_v3tb_telemetry.txt`. The message is `Invalid right side during comparison 'c'`.
A second run was already at **145 549** lines by in-game 1854. The same campaign CTD'd at 1871, and the
previous night's batch on a different arm CTD'd twice, both times with the same metric enabled.

**Root cause.** The `market_goods_wide` sweep (§ TESTBED_METRICS, the "who made it first anywhere" metric)
emits a fixed 50-tag filter:

```
every_market = { limit = { OR = { owner = c:GBR owner = c:USA … owner = c:TEX owner = c:CAL … } } }
```

**About twenty of those tags stop existing during a normal campaign** — TUS, SIC, PAP, BAV, SAX, WUR,
BAD, HAN, HES, MEC, OLD, KRA, WAL, MOL, TEX, CAL, DAI, HAW … are annexed or form into successors. In
Jomini script `c:TAG` on an absent country does **not** evaluate to false; it raises a script-system
error. And because the filter sits inside `every_market`, **the whole `OR` is re-evaluated once per
market** — so the cost is roughly *dead tags × markets × dump dates*, i.e. ~20 × ~300 × 97.

**Fix (prepared, NOT yet applied — a batch was running, and `telemetry_lib.ps1` may never be edited
mid-batch).** Guard every tag with its own existence test, the idiom the boot block already uses:

```
limit = { OR = { AND = { exists = c:GBR owner = c:GBR }  AND = { exists = c:USA owner = c:USA }  … } }
```

**Why it went unnoticed for so long.** Nothing *fails*. The metric emits correct lines for every country
that does exist, the run completes, the TSV looks right — the only symptom is a log file nobody reads
because `error.log` is expected to carry vanilla's own noise. The harness records `error_log_lines` in
`meta.json` and it had been climbing for weeks.

⚠ **Whether it CAUSES the crashes is still unproven** and should not be asserted. What is established:
it is a real defect, it is ours, it is enormous, and it is the largest single contributor to a log volume
the previous night already flagged as the first suspect for two CTDs. Fixing it is worth doing on its own
merits; if the crashes stop, that is evidence, not proof.

**How to detect it recurred.** Anything naming `zzz_v3tb_telemetry.txt` in `error.log` is ours by
definition and should be **zero** — *but count it inside the run's own wall-clock window*, see below.

⚠⚠ **`meta.json` → `error_log_lines` IS NOT A PER-RUN NUMBER — do not use it as one** (found
2026-08-06, session `resume_diag`, correcting what this entry first said). That session was a 20-minute
control run with a **41-line** telemetry file, and it reported **41 237** error lines. Breaking them
down by the timestamp each line carries:

| stamped | lines | whose |
|---|--:|---|
| `02:xx` | **21 139** | the *previous* session's run 19, which ended at 02:52 |
| `10:xx` | 886 | this run's actual window |
| of those, ours | **0** | this run's telemetry errored **not once** |

The give-away was that the errors cite `zzz_v3tb_telemetry.txt:20954` while this run's telemetry file
is **41 lines long**. The mirror had inherited the previous session's ring content wholesale.

**⭐ THE GENERAL RULE, and this is the third place the same trap has bitten.** The game's logs are a
shared rotating ring, so **anything read out of them must be filtered by the run's own identity**:
- **telemetry lines** — filtered by the per-run **token**. Protected, and have been for a while.
- **the in-game clock** — was **not** filtered; fixed by the line's own `[HH:MM:SS]` (see the resume
  entry above).
- **error counts** — still **not** filtered. Same fix: count only lines stamped inside the run's window.

⚠ It also means the per-run error volumes quoted at the top of this entry (574 455 / 145 549 / 313 508)
are **upper bounds, not measurements** — they include whatever the ring still held. The *defect* is
confirmed regardless, because the erroring lines are unambiguously the 50-tag `OR` block and those line
numbers belong to those runs' own telemetry files. It is the magnitudes that are unreliable.

**⭐ The general lesson.** A country tag hardcoded in telemetry is a **time bomb on a long campaign**: it
is valid at 1836 and invalid by 1900. Any metric that names countries must either guard with `exists` or
iterate and filter on a property instead of on identity.

**✅ FIXED 2026-08-06, and the class is now enforced.** Every tag filter goes through one function
(`Get-GuardedOwnerLimit` / `Get-GuardedCountryBlock` in `telemetry_lib.ps1`) — writing the idiom out per
site is exactly how it got reintroduced at nineteen of them. The emitted script text changed; the
emitted **data** did not, since a dead tag produced no lines before and produces none now, so
`TELEMETRY_VERSION` stayed at **12**.
⚠ **The hand fix was not the fix.** Six sites were corrected by reading the code; the new detector then
found **13 more**, including a `this = c:TAG` form that had not been considered at all. Two of the
survivors (`consumption_probe` on BEL/JAP, the `probe` metric on GBR/FRA/CHI) are exactly the
long-campaign shape the entry is about.
⚠ **Stated assumption, not proof:** guarding is treated as behaviour-preserving because the metric
demonstrably emitted correct lines for countries that existed — i.e. the errored sub-trigger was already
acting as false. It was **not** separately verified that an errored comparison inside an `OR` never
evaluated *true*; if it did, pre-fix runs logged extra markets.
⇒ **`TESTBED_LANDMINES.md` L1**, checked by `tools/preflight.ps1` against the emitted files inside every
build. That register is where this class of defect — the ones where nothing fails — is now enumerated.

---

## The provenance field that would have caught a wasted day was never populated — the scheduler simply did not pass it (2026-08-06)

**Symptom.** A full day of measurement (2026-08-05, five launches, ~6 h of game time, findings F32/F33)
ran on `config/mod_config.json` — our full tiered mod — when the question being asked was about the base
game. Nobody noticed until the results were read closely and the "buyer" of a debut good turned out to be
`Tier 2. Industrial Port`, one of our own buildings. Reconstructing **which arm each historical session
ran** then required opening every session's `schedule.json` by hand.

**Root cause — and it is not the human error it looks like.** `build_state.json` exists precisely to
record this, and CLAUDE.md requires its `deterministic` half to be machine-read. But
`run_observer.ps1` wrote `built_from_config = $BuildConfig` from a parameter that
**`run_schedule.ps1` never passed**. `Resolve-Setup` resolved the config path, put it into the *builder's*
argument list, and then threw it away — it returned `@{ Args; ModPath; Kind }` with no `Config`. So every
scheduled run in the project's history recorded `built_from_config: ""` and `config_sha256: null`. The
guard was designed, built, documented, and inert.

**Fix.** `Resolve-Setup` returns `Config`; `run_schedule.ps1` appends `-BuildConfig` to the observer
args when it is set. And `build_state.json` (now **schema v2**) additionally records
`deterministic.arm` (`control` / `control+pop_needs` / `config`) and `deviates_from_vanilla` — the list
of gameplay directories the mod actually contains.

**⭐ The prevention lesson, which is the general one.** The new fields are derived **from the built mod on
disk**, not from the flags the builder was asked for. A flag records an *intention*; the artifact records
what actually loaded, and only the second can contradict a mistaken intention. When adding a provenance
field, ask what it would say if the code above it were wrong — if the answer is "the same thing", it is
decoration.

**How to detect it recurred.** `deterministic.arm` must never be `unknown`, and a `config`-arm run must
have a non-null `config_sha256`. Historical sessions are schema v1 and have neither; read their arm from
`schedule.json` and **do not back-fill** — an old `build_state.json` is a historical record, not a cache.

---

## A solver read BUILD OUTPUT and wrote SOURCE, so its convergence check verified nothing (2026-08-04)

**Symptom.** `node tools/era_scenarios.mjs --write` followed immediately by a re-run reproduced every
figure **exactly** — 2/5/12/11/13 illogicality points, industry for industry. That was recorded as proof
the solve is a fixed point with respect to its own write. It is not. After the next `build.ps1` the same
command returned 5/11/13/10/13 — nine points different, with industries appearing that had never been
flagged.

**Root cause.** `tools/econ_host.mjs` sourced the config from `ui/data.js`. That file **embeds a copy** of
`config/mod_config.json`, but it is *build output* — regenerated by `build.ps1`, not by the solver. The
solvers **write `config/mod_config.json` and then read `ui/data.js`**, so there was a build step sitting
inside the write→read loop. A re-run without one never saw its own output; it re-read the previous
values and, being deterministic, produced the previous answer.

**Why it is worse than an ordinary stale-cache bug.** The failure mode is not a wrong number, it is a
*confirming* number. The check was specifically designed to detect instability, and the bug made an
unstable solve return the one result that says "stable". A test that cannot fail is worse than no test,
because it is quoted.

**Fix.** `econ_host.mjs` loads `config/mod_config.json` directly, falling back to the copy inside
`data.js` only when there is no config on disk. `data.js` remains the source of prices and of the vanilla
extract beside it. With the loop closed, the honest result is that a **single run is deterministic** but
**repeated write→re-run cycles wander** (47 / 51 / 51 / 48 points): the solve is path-dependent on the
recipes it starts from. That is now recorded in BALANCE_FRAMEWORK §10.16 as open work.

**Prevent next time.** When a tool writes file A and reads file B, ask whether B is derived from A and
what regenerates it. A generated file that *contains* a source file is the dangerous shape — it looks
authoritative and is silently a snapshot. The same reasoning is why `tools/bundle_ui.mjs` refuses to
build a UI snapshot when `ui/*.js` is older than the config.

---

## The solver reported and shipped a state it had already invalidated (2026-08-04)

**Symptom.** Era-1 `iron` was flagged at the +75% price ceiling while the very same scenario's order book
said buy 831 against sell 990 — which is a price of **86**, not 175. Era-1 `hardwood` did the same. Two of
three reported ceiling breaches were goods in surplus.

**Root cause.** `buildScenario` ended with three single passes in a fixed order: sync prices → optimise PMs
→ sync prices → **re-solve every era-current tier's input recipe**. The recipe re-solve changes what those
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
report that output. The instrument now prints its own residual per era, so a non-converged solve says so.

**Related, found in the same pass** (both BALANCE_FRAMEWORK §10.14):

- **The forward probe.** Every industry placed one level of the *next* era's tier, "to show the ladder from
  both sides". It was scored by nothing — every check filters to `era <= this era` — and being a ×1.5-bigger
  plant it supplied **61% of era-1 steel**, most of era-3 automobiles and most of era-3 telephones. Those
  three goods sank to the 25% floor and were precisely the ones reported "insolvent at these prices". It was
  also an anachronism (a Bessemer converter in 1836). *Lesson: a display-only element that participates in
  the simulation is not display-only.*
- **A glutted by-product vetoing a starved input.** Building counts follow the revenue-weighted geometric
  mean of their goods' price errors, so a logging camp making ceiling-priced `wood` and floor-priced
  `hardwood` had the two cancel: the solver **shrank logging from 523 levels to 124** while wood's shortage
  tripled. *Lesson: averaging is the wrong aggregator when one of the terms is a constraint violation.*

---

## A fitted slope is not a structural constant — don't extrapolate one when the theory gives it (2026-08-03)

**Symptom.** The published SoL → base-wage rule (FINDINGS F26) predicted **0.4098 £/wk** where the
game measures **0.2133** (Attica 1935, lower-stratum SoL 18.99) — **+92 %**. Its SoL-16 entry was
nearly double the truth. Everything inside the observed range looked fine.

**Root cause — and it is not "fitted linearly".** The form was `SoL = a + b·ln(base)`, i.e.
log-linear, so the base was already exponential in SoL, growing ×`exp(1/b)` per level. The error was
leaving **`b` free** when the buy-package table *fixes* it: package cost grows ×1.1002 per wealth
level with **r² = 1.0000**, so the structural slope is `1/ln(1.1) = 10.49`. A free fit returned
**5.56** — ×1.196 per level instead of ×1.1 — and that was extrapolated six levels past its data.

**Why the free fit was flat, since the data is sound.** Fitted on **SoL ≥ 10 alone the slope
recovers to 10.01**. The flattening lives in the low-SoL region, where economies are subsistence-
dominated and living standard is largely decoupled from wages; ordinary attenuation (noise and
heterogeneity in the x-variable bias a regression slope toward zero) adds to it. So 5.56 is a
defensible *predictive* slope across the observed range and a badly biased estimate of the
*structural* one. **The two are not interchangeable, and only the structural one may be
extrapolated.**

**What makes this bad rather than unlucky.** The same document already stated the answer. It said
"the buy-package table is EXACTLY exponential, so this is a definition, not a result" and, further
down, "`b` should be 1/ln(1.1) = 10.49 … measured `b` is 5.61 rising to 7.75". The discrepancy was
observed, explained away with a narrative ("economies becoming more wage-based"), and then published
anyway. **A factor-of-two gap against a known constant is a test to run, not a phenomenon to
describe.**

**Fix.** Constrain the slope and fit only the intercept:
`base £/wk = exp((SoL − 37.43) / 10.49)`. It beats the free fit *everywhere* — median error 17 % vs
19 % overall, **9 % vs 50 %** in the high-SoL tail — so the constraint cost nothing even in-sample.

**Detect/prevent.**
- **When theory supplies a coefficient, fit the intercept and fix the slope**, then check the free
  fit against it. If they disagree materially, that disagreement is the finding.
- **Never invert a free-fitted slope outside its data range.** Inside the range a regression predicts;
  outside it, only a structural relationship does.
- **Re-fit on the sub-range you actually care about.** Here `SoL ≥ 10` would have exposed the whole
  problem in one line, because it returns the theoretical value.
- **Treat a narrative explanation of a numeric gap as a red flag.** If the story cannot be turned into
  a test, it is covering the gap rather than closing it.

---

## A scope that is correct at the start date is not therefore BOUNDED over time (2026-08-03)

**Symptom.** A 100-year batch was launched with a per-pop sweep scoped to "the whole Belgian market",
verified correct and cheap at 1836 (178 pops, 3 states). At the 1850 dump the same sweep tried to emit
**20 686** lines and only **5 212** survived the log ring.

**Root cause.** `market = c:BEL.market` was never wrong — it was *unbounded*. **Which market a country
belongs to changes**: by 1850 Belgium had joined the **British** market, so the scope silently expanded
from one country to 65, including all of British India. Every surviving line was individually valid,
which is what made it dangerous — nothing looked broken, the data was simply a 75 % subset chosen by
ring position rather than by chance, and therefore biased in an unknown direction.

**Why the sizing done beforehand did not catch it.** Volume was measured properly, with an
untruncatable script value rather than by counting the sweep's own lines — but it was measured **only
at the start date**. The growth being guarded against was assumed to be *pop growth* (a smooth ~2-3×
over a century); the actual growth was a *scope change* (a 110× step at one date).

**Fix.** Scope the per-pop sweep to the lead country **and its subjects**, keeping the market test
alongside as a guard:
```
limit = { market = c:%TAG%.market   OR = { this = c:%TAG%  is_subject_of = c:%TAG% } }
```
The market test stays because **an invalid trigger inside a `limit` is silently ignored** — had
`is_subject_of` not resolved, the limit would have become a no-op and swept all ~285 countries. With
the verified test present, that failure degrades to the old behaviour instead of destroying the run.
Lead+subjects is also the better *unit*: a trajectory needs one fixed economy tracked across a
century, not one that silently becomes another.

**Detect/prevent.**
- **Ask of any sweep scope: what makes this bounded in 1935, not just in 1836?** Market membership,
  subject status, alliance and market-lead all change; a tag and its subject tree are far stabler.
- **Make each dump prove its own completeness.** The `WC` line carries a pop-object count derived
  independently of the pop lines, which is the only reason this was caught mid-run at 1850 rather
  than at 08:00 with six hours spent.
- **Check the completeness of an early mid-run dump before letting a long batch run to term.** The
  batch was stopped after ~35 min and relaunched, costing half an hour instead of six.
- **Test a filter on the case where the hypotheses differ.** BEL and AUS could not verify the fix at
  all — at 1836 their market *is* lead+subjects, so both designs give identical counts. `BIC` was the
  discriminating case (inside the 3 242-pop British market, own subject tree ⇒ 1 696).

### Companion trap: StrictMode makes an absent property a terminating error

Threading the new `wage_pop_markets` field through `run_schedule.ps1` used
`$defaults.wage_pop_markets` as a fallback. `run_schedule.ps1` runs under `Set-StrictMode`, where
reading a property an object does not have **throws** rather than yielding `$null` — so every
schedule that simply *omitted* the field (the normal case, since the metric has its own default)
aborted before its first run. The failure surfaced only as a launched window that vanished; the
diagnosis was to run the scheduler in the foreground and read the actual error. **Guard both sides of
a defaults lookup with `PSObject.Properties.Name -contains`, and when a background launch produces no
session, re-run it in the foreground rather than re-launching it again.**

---

## A loop variable read before it is assigned gives the PREVIOUS iteration's data (2026-08-02)

**Symptom.** Russia's scenario preset came out running `pm_free_urban_clergy` in its urban centres,
which is plainly wrong — Russia's own measurement is `pm_state_urban_clergy` 38 levels against
`pm_free_urban_clergy` 1. Britain came out with `pm_no_street_lighting` (44 levels) over
`pm_gas_streetlights` (89). The majority-pick logic was correct in isolation: replayed against
Britain's own numbers it returns `pm_gas_streetlights`.

**Root cause.** In `extract_presets.ps1`'s per-preset loop, `$meas = Get-Measured $p` was assigned
about two-thirds of the way down — **after** the urban-centre block that reads it. PowerShell does not
error on a variable read before assignment inside a loop; it returns whatever the *previous iteration*
left there. So each preset picked its urban-centre methods from the market before it in the list:
Russia (4th) used the Qing's (3rd) numbers, where free clergy leads 104 to 2; Britain (2nd) used
France's, where `no_street_lighting` leads 43 to 17. The first preset got `$null` and silently fell
back to the law-based inference.

**Why it survived review.** The failure is *plausible* rather than absurd — every value is a real
production method that some market really runs — and it was masked by a coincidence: France's
amenities majority is `pm_market_squares`, which is also Britain's, so the one field anybody spot-
checked looked correct.

**Fix.** `$meas = Get-Measured $p` is now the first statement in the loop, with a comment saying why.

**Prevention.** Assign every per-iteration variable at the **top** of the loop body, not next to its
first use. And when a derived field looks wrong for one entity, check whether it belongs to a
*neighbouring* entity before assuming the logic is wrong — the arithmetic here was never at fault.

---

## The wrong PM trigger makes every filter match everything (2026-08-02)

**Symptom.** A probe asking which production methods urban centres run reported that **all 13
candidate PMs were active on all 224 urban centres**, at identical level totals (599 each) —
including mutually exclusive ones from the same PMG (`pm_no_street_lighting` *and*
`pm_gas_streetlights` *and* `pm_electric_streetlights`).

**Root cause.** The filter was

```
limit = { is_building_type = building_urban_center  is_production_method_active = pm_gas_streetlights }
```

`is_production_method_active` is a **STATE**-scope trigger taking a *block*
(`{ building_type = X  production_method = Y }`); the **building**-scope trigger is
`has_active_production_method = pm_x`, which vanilla uses exactly this way inside `any_scope_building`
(155 uses against 61 of the other). An invalid trigger inside a `limit` is **silently ignored**, so the
limit degenerated to `is_building_type` alone and every PM matched every urban centre.

**Fix.** `has_active_production_method = <pm>`, bare key, building scope.

**Prevention — the sanity check was already written down and it caught this.** TESTBED_METRICS §3.7
records the same failure mode for `is_unemployed` and states the rule: *a filtered result that equals
its unfiltered twin is a failed filter, not a measurement*. Here the tell was even louder — identical
counts across mutually exclusive alternatives. **Any multi-candidate probe must compare candidates
against each other before the numbers are believed**, because this class of bug produces plausible
numbers rather than errors or zeros.

---

## A script value that does not exist returns 0, not an error (2026-08-02)

**Symptom.** A measurement run logged **standard of living = 0 for every one of ~285 countries**,
while the urban-centre count and levels sitting on the *same line* were correct (GBR 9 / 89, France
18 / 60). No error in `error.log`, no data-error line, nothing to notice.

**Root cause.** `v3tb_solw_*` / `v3tb_swf_*` were still defined in `zzz_v3tb_probe_values.txt`, which
`build.ps1` emits **only when a probe metric asks for it**. The schedule requested the production
`scenario` metric and no probe, so the mod shipped without those script values — and
`MakeScope.ScriptValue('<missing>')` returns **0**, exactly like a real zero.

This is the same class as the `is_unemployed` hazard in TESTBED_METRICS §3.7: the dangerous failure
is not the loud one, it is the plausible number.

**Fix.** Moved them into `New-TelemetryScriptValues` (the always-emitted file) via
`Get-StratumSolValues`, and left a comment in the probe file saying where they went and why —
**moved, not copied**, because two files defining one script-value key is a silent override.

**Prevention.** A rule rather than a check, because there is nothing to check against: **when a
probe graduates to production, MOVE it out of the probe file in the same pass**. And when a metric
is added to a schedule, confirm the value it reads is in a file that schedule actually emits. A
sanity-check helps too: a filtered aggregate that comes back as a clean `0` for *every* country is a
missing value, not a measurement.

---

## A data function used as SCRIPT silently deletes the rest of the file (2026-08-02)

**Symptom.** A probe run harvested **nothing**: `markets.tsv` had only its header, and `debug.log` held
no `BEGIN`, no `G` rows, no country lines — for a mod whose telemetry file plainly contained all three
dumps. The only V3TB output was one line, printed by the *trigger* logger with its data functions
**unresolved**: `jomini_trigger_impl.cpp: Trigger, V3TB|…|EARLY|boot|[TimeKeeper.GetCurrentDate.GetString]|…: true`.

**Root cause.** A new game-start block filtered a goods iteration with

```
every_market_goods = { limit = { is_goods = GetGoods('grain') }   # ← WRONG
```

`GetGoods('x')` is a **loc-string data function**. It is valid only inside the quoted text of a
`debug_log`; in script it is a parse error. And Paradox does not skip the bad statement — **it abandons
the file from the error onward**. The three dumps were defined *below* that block, so all of them
ceased to exist:

```
Unknown trigger type: ), near line: 36" in file: "common/on_actions/zzz_v3tb_telemetry.txt" near line: 38
Error: "Unexpected token: v3tb_dump_1_p0, …"        ← every dump, gone
No on_action scripted with tag v3tb_dump_1_p0 cannot link
```

The single surviving line was the *unparsed* text being evaluated as a trigger, which is why it printed
its data functions literally and appended `: true`.

**Fix.** Drop the filter — the good's key is on every line anyway, so filtering at analysis time costs
nothing and carries no parse risk. The same construct was sitting **latent in the pre-existing `probe`
metric** (`is_goods = GetGoods('tools')`), which would have destroyed any run that used it; fixed too.

**Prevention — `Test-TelemetryScript` in `tools/telemetry_lib.ps1`, called from `build.ps1`.** It strips
every double-quoted string and every comment from each generated line and throws if what remains
contains a `Something(` call or a `[`. Unit-checked both ways: a normal `debug_log` line passes, the bad
`limit` is caught. **The point is to fail at BUILD time**, because the in-game cost of this mistake is a
whole measurement run plus its load time — and the failure looks like "the metric returned nothing",
not like a syntax error.

**Generalise it:** the damage here came from *position*, not severity. A malformed line near the TOP of a
generated file destroys everything below it, so a new block added at the top of `zzz_v3tb_telemetry.txt`
is far more dangerous than the same block added at the bottom.

---

## Recurring themes (read first)

1. **The builder's PM emitter is a WHITELIST.** When we regenerate a tier's main PM
   (`New-...` in `build.ps1`), it only reproduces: goods in/out, employment, `state_pollution_generation`,
   `state_infrastructure`, `country_ship_construction`. **Any other modifier on the vanilla PM is silently
   dropped** — `country_modifiers`, other `state_*_add`, `disallowing_laws`, `unlocking_*`, etc. The
   economics linter won't notice (it only checks break-even). → When tiering a new building or after a
   patch, **scan each `vanilla_pm` for anything outside the whitelist** (`country_modifiers`, unexpected
   `state_*_add`, etc.).

2. **Renaming/splitting main PMs breaks references to them by name.** Our tiers rename each vanilla main PM
   (`pm_crystal_glass` → `pm_main_glass_crystal`) and put it in its own building. Anything in vanilla that
   references a main PM **by its original name** stops matching — `unlocking_production_methods`, and
   potentially other cross-references. → When splitting a chain, **grep vanilla for the vanilla main-PM
   names** to find who else depends on them.

3. **The linter checks economics, not engine behavior.** Naval capacity, PM gates, `port = yes`, AI
   values, infrastructure output — all invisible to `lint.sh`. A green build is necessary, not sufficient;
   **in-game load + `error.log` is the only real check** (see `MODDING_NOTES.md`).

4. **This dev box is `ru-RU` / codepage 1251, and PowerShell 5.1 defaults to it for both reading and
   writing.** Every non-ASCII round trip through a tool is a silent corruption risk that reproduces only
   here — read with `-Encoding UTF8`, write with `[IO.File]::WriteAllText(..., UTF8Encoding($false))`,
   format numbers with `InvariantCulture`. Three separate bugs below share this one root.

---

## 2026-07-31 — `Set-Content` silently transliterated the config on write

**Symptom.** None visible — found by audit, not by failure. `config/mod_config.json` happens to be pure
ASCII today, so the bug had nothing to destroy yet.

**Root cause.** `solve_be_targets.ps1 -Write` persisted the config with `... | Set-Content $Config
-NoNewline`. With no `-Encoding`, PowerShell 5.1 encodes to the **system ANSI codepage** — CP1251 here.
That is worse than the usual mojibake: CP1251 has no `é`, so the character is **best-fitted away**, not
mangled. Verified on a temp copy: a tier named `Béakery` came back `Beakery`, no error, no warning, and
the next `Get-Content -Encoding UTF8` reads the damaged name as if it were authored that way. Every other
config writer in the repo already used `WriteAllText` + UTF-8 no BOM; this was the one hold-out, and it
sits in the solver you run *first* in the pipeline, so the loss would then propagate into localization.

**Fix.** `WriteAllText(..., UTF8Encoding($false))`, matching every other tool.

**Detect/prevent.** Grep for `Set-Content` / `Out-File` / `>` in any tool that writes a file another tool
reads: on 5.1 they are all ANSI-by-default. The failure is invisible on an en-US machine, so it will never
show up in review — only a non-ASCII round-trip test catches it.

---

## 2026-07-26 — Fractional PM goods silently read as 0 (subsistence / urban centre / agro)

**Symptom.** Building the scenario presets, a subsistence farm looked like it produced *nothing*: the UI's
all-buildings explorer showed `default_building_subsistence_farm` with grain 1 and **fabric 0, wood 0,
services 0**, so a whole market's food/wood supply vanished from the model.

**Root cause.** Vanilla PM quantities are **not all integers** — 58 values across
`production_methods/12_subsistence.txt`, `06_urban_center.txt` and `02_agro.txt` are fractions
(`goods_output_grain_add = 1.0`, `fabric 0.5`, `meat 0.33`). `extract_vanilla.ps1` matched
`goods_(input|output)_..._add\s*=\s*(-?\d+)`, and `-?\d+` happily matches the **leading integer part** of
`0.5` → `0`, then `[int]` locks it in. No error, no warning: every fractional good became zero in
`ui/vanilla.js`. It went unnoticed because our own tiered industries (`01_industry`) are all integers.

**Fix.** `Get-Num` in `tools/history_lib.ps1` (int when whole, double otherwise) + a decimal-aware regex in
`extract_vanilla.ps1`. Two follow-ons, because fractions must now survive a round trip: the UI's
`refEditSet` no longer `Math.round`s an edited quantity, and `build.ps1` writes `pm_goods` overrides through
`Format-Qty`, which formats with **`InvariantCulture`** — on a Russian-locale Windows (this dev box) plain
interpolation of `0.5` emits `0,5`, which V3 cannot parse.

**Detect/prevent.** When a tool parses a vanilla number, assume it can be fractional: match
`-?\d+(\.\d+)?`. When a tool *writes* one, pass it through `InvariantCulture` — the locale trap is silent
and only reproduces on a non-English machine.

---

## 2026-07-18 — 1836 start: `Invalid production method: pm_anchorage` (90× in error.log)

**Symptom.** `error.log` at load: 90× `create_building effect [ Invalid production method: pm_anchorage ]`
in our re-tiered `common/history/buildings/*.txt`. (Found via the new self-diagnostic in-game test.)

**Root cause.** `pm_anchorage` is vanilla's *undeveloped-port* base PM. The 1836 start has ports on it.
`convert_history.ps1` matches a factory's active main PM against each tier's `vanilla_pm` (port = basic /
industrial / modern) — `pm_anchorage` matches none, so the block is left **unchanged** (still
`building_port` + `pm_anchorage`). But `building_port` is now our T1 (PMG `pmg_main_port_basic`, no
`pm_anchorage`), so the activated PM is invalid for it.

**Fix.** New per-tier **`vanilla_pm_aliases`** (list) in the config + `history_lib.ps1`: extra vanilla main
PMs that also map to that tier. Set port T1 `vanilla_pm_aliases = ["pm_anchorage"]`, so undeveloped ports
convert to our basic port (T1). Verified: 0 `pm_anchorage` left; conversion 604→694.

**Detect/prevent.** After tiering any building, check the 1836 history for its **base/level-0 PM** (ports:
anchorage; some buildings have an inert base main PM) — it won't match a tier's `vanilla_pm` and will be
left invalid. Add it to that tier's `vanilla_pm_aliases`. The converter's `unmapped` warning also flags it.

## 2026-07-18 — Known limitation: `is_production_method_active` checks on split main PMs (log noise + missed flavor)

**Symptom.** `error.log`: `is_production_method_active trigger [ Invalid Production Method 'pm_mechanized_workshops' / 'pm_electric_trains' / 'pm_diesel_trains' … ]` (a few each, more as the game runs).

**Root cause.** Theme #2 at scale. Vanilla industrialization/modernization **events, journal entries, and
scripted effects** (e.g. `save_industrialized_pm_building_and_state` in `common/scripted_effects`, used by
`events/pm_events.txt`) check `is_production_method_active = { building_type = building_X; production_method = pm_Y }`
where `pm_Y` is a **main** PM we split/renamed onto a separate tier building — so the base building no longer
has it, and the trigger errors and returns **false**.

**Impact.** Low: those checks fail → the flavor/journal content that detects "this building is industrialized/
modern" won't fire for our tiered buildings. **No crashes.** Long-standing for manufacturing (since the v0.1
split); railway variants arrived with Phase 2. **Not fixed** — a comprehensive fix means owning
`scripted_effects` / `scripted_triggers` / `journal_entries` / `events` and rewriting every such check to our
tier structure (check for our tier *building* instead of the old main PM). Deferred pending a decision on
whether the affected content is worth it.

## 2026-07-17 — Gated secondary PMs stopped working (bone china / elastics / precision tools)

**Symptom.** After the tier split, secondary PMs that were gated behind a primary PM became permanently
unavailable — e.g. **Bone China** could not be selected on the Crystal Glassworks (glass tier 3).

**Root cause.** Three vanilla secondaries are gated by
**`unlocking_production_methods = { <vanilla main PM> }`** — only available when one of those *main* PMs is
present in the building:

| Secondary | gated behind (vanilla main PM) | should appear on |
|---|---|---|
| `pm_bone_china` (glass porcelain) | `pm_crystal_glass`, `pm_houseware_plastics` | glass T3, T4 |
| `pm_elastics` (textile luxury) | `pm_sewing_machines`, `pm_electric_sewing_machines` | textile T3, T4 |
| `pm_precision_tools` (furniture luxury) | `pm_lathe`, `pm_mechanized_workshops` | furniture T2, T3 |

The split renamed those main PMs (`pm_crystal_glass` → `pm_main_glass_crystal`) and moved each into its own
building, so the gate referenced a PM that is **never present** in the tier building → the secondary
silently locked. (Theme #2.)

**Fix.** The gate lives inside the vanilla PM, and V3 rejects cross-file PM redefine, so the builder now
**whole-file-replaces `common/production_methods/01_industry.txt`**: it copies vanilla verbatim but, for
every `unlocking_production_methods` list, **appends our tier `pm_key`** for each split vanilla main PM it
references (map `vanilla_pm → pm_key`, built from the config). The secondary then unlocks at exactly the
tiers whose main PM satisfied it in vanilla. Scope: exactly 3 PMs, all in `01_industry.txt` (06/11 have
none). Verified: 106 PMs preserved, untouched PMs byte-identical, gates correctly extended, LINT 53/53
(the linter reads vanilla + `zzz`, not the owned copy).

**Detect/prevent.** After a patch or when splitting a new chain, grep vanilla `common/production_methods`
for `unlocking_production_methods` and check whether any listed PM is one we split. The builder's remap now
handles any such gate automatically on rebuild — but only for files it owns (currently `01_industry.txt`);
if a gated secondary appears in another PM file, own that file too.

---

## 2026-07-17 — Shipyards make clippers but navies can't be built or maintained

**Symptom.** After the shipyard split, shipyards still produced **clippers**, but **navies would not build**,
and existing 1836 navies **decayed over time from missing maintenance**.

**Root cause.** The base shipbuilding PMs carry a **country modifier on the same PM that outputs
clippers/steamers**:

```
pm_basic_shipbuilding = {
    country_modifiers = { workforce_scaled = { country_ship_construction_add = 5 } }   # <-- naval capacity
    building_modifiers = { workforce_scaled = { ... goods_output_clippers_add = 40 } }
}
```

`country_ship_construction_add` (basic 5 / complex 10 / metal 15 / arc 20) is the capacity that **builds and
maintains navies**. Our PM emitter only copied goods/employment/pollution, so it **dropped the
`country_modifiers` block** → shipyards granted **zero** ship construction. (Theme #1.)

**Why it was hard to find.** `country_ship_construction_add` is a **country modifier, not a good**, so it was
invisible to every goods-based search. Dead ends ruled out along the way: `clippers` is an **`industrial`**
good (trade convoys / fishing / ports), *not* a naval-unit good; there are **no naval `combat_unit_types`**;
the naval buildings (`naval_administration`/`fortification`/`logistics_center`) consume
small_arms/artillery/steel, not ship goods. The capacity comes solely from the shipbuilding PMs' country
modifier.

**Fix.** New per-tier **`ship_construction`** config field → emitted as
`country_modifiers { workforce_scaled { country_ship_construction_add = N } }`; set **5 / 10 / 15 / 20** on
the four shipyard tiers. Audited every tiered `vanilla_pm` for `country_modifiers` / unhandled
`state_*_add`: **the shipyard chain is the only one affected**.

**Detect/prevent.** This is the canonical Theme-#1 case: the emitter whitelist dropped a modifier. When
tiering any building, dump its `vanilla_pm`s and look for modifier blocks the emitter doesn't carry.

**⚠ SEQUEL (2026-08-05).** The advice above — *drop the filter, the good's key is on every line, filter at
analysis time* — was rediscovered the hard way at a cost of three probe runs, because this file was not
consulted before instrumenting. A second, **quieter** variant of the same trap was found in the process
and is written up in TESTBED_METRICS §3.3.1: putting the goods accessor inside a `debug_log` **string**
rather than in script position parses and links cleanly, logs nothing anywhere, and simply makes the whole
on_action produce **no output** — plain-string fences on the same effect included. Line-level fencing does
not contain it; probe an unverified data function in an on_action of its own.

## Two CTDs in one long run, and a resume guard that earned its keep (2026-08-05)

**Symptom.** A 1836→1936 run with heavy telemetry (496 MB mirror) crashed twice — `crashes\victoria3_*`
minidumps at 16:38 and 17:16. After the second, the harness logged:

```
resume landed at 1882.2.12, far behind 1906.4.1 - fresh game, abandoning run 1
run 1 finished: 8098.5s wall over 2 attempt(s), in-game 1925.3.1, exit resume started a fresh game
```

**This is the guard working, not a bug.** `-continuelastsave` loads the newest save ON THE MACHINE, and the
one it found was 24 in-game years behind where the run actually was. Splicing that in would have produced a
single "run" whose series jumped backwards — silent, plausible corruption of exactly the kind the order
book cannot self-diagnose. The harness refused it and kept the 89 years it had (1836→1925.3), which was
enough to carry FINDINGS F32/F33.

⚠ **Suspect the telemetry volume before the mod.** This configuration writes ~500 MB per run; the earlier
1910-span runs at ~250 MB did not crash. Not established, but the correlation is the first thing to test if
long runs keep dying — halve the breakdown cadence and see.

⚠ **`wait_for_session.ps1` reports DEAD during the post-run harvest.** No game process plus no completion
marker is the DEAD signature, but between runs the observer is parsing the mirror — ~7 minutes for 496 MB
against a 90 s grace. It looked like a dead batch and was a healthy one. Check `run.log` for
`run N finished` before believing it; see CLAUDE.md → wait_for_session.

## The answer was in a shipped comment all along (2026-08-05)

**Symptom.** A full day of inference — two solver A/Bs, three probe runs, a 2x1836-1936 campaign — spent
deciding what `max_supply_share` bounds, ending in a finding (F33) that BOTH candidate readings were
refuted.

**Root cause.** Nobody read the top of the file. `game/common/pop_needs/00_pop_needs.txt` opens with four
comment lines documenting the mechanic outright: `weight` is the base weight applied *based on market Sell
Order share*, `max_supply_share` is the maximum weight applicable on that basis (*"relative supply above
this amount will have no further impact on base weight"*), `min_supply_share` a minimum multiplier of the
base weight regardless of share. That is the reading we already implement.

I had read the DATA in that file twice — verifying all 52 entries against our extract on 2026-08-04, and
listing every `min_supply_share` on 2026-08-05 — and both times started at the first `popneed_` block,
four lines below the answer.

**Fix / rule.** **Search the shipped files for documentation before measuring.** Paradox ships `readme.md`
in several `common/` subfolders (`acceptance_statuses`, `laws`, `social_classes`, `social_hierarchies`,
`dynamic_treaty_names`), `_on_actions.md`, and header comments in others. A grep for `^#` at the head of a
file you are about to reverse-engineer costs seconds.

⚠⚠ **BUT DOCUMENTATION IS A HYPOTHESIS SOURCE, NOT AN ANSWER.** The reason to read it first is that it is
CHEAP, not that it is authoritative. Developers ship confidently wrong statements, and — worse — leave
statements that were true at publication and quietly stopped being true when the code moved. A stale
comment is more dangerous than an absent one, because it reads as settled. The wiki being unreliable (F31:
self-contradictory, two stale numbers) is a specific case of a general problem, not a reason to treat
in-repo text as different in kind. Correct use: **take the hypothesis from the docs, then confirm it
against telemetry.** The `00_pop_needs.txt` comment can be leaned on here only because F31 had already
measured the same conclusion independently — two agreeing sources, not one official one.

⚠ The measurements are not wasted: they stand as observations and they raised the real question, which is
why our implementation of the documented rule produces far less demand than the game does. But the day
would have started there rather than ended there.

## A REMOVED EMITTER KEPT SHIPPING ITS FILE — `mod/` was never fully cleaned (2026-08-12)

**Symptom: none.** The build passed, both linters passed, `Invoke-ModChecks` passed, preflight passed,
the mod loaded — and it went on carrying a gameplay change that had been deleted by ruling.

**What happened.** The per-tree tech-spread boost was removed from `emit_techs.mjs`: the section that
emitted `common/static_modifiers/00_code_static_modifiers.txt` (a whole-file copy of vanilla plus one
added line) was deleted. Rebuild, redeploy — and the file was **still there**, in `mod/` and in the
deployed copy, still setting `country_production_tech_spread_mult = 0.5`. Only a hand check caught it.

**Root cause.** `build.ps1`'s clean step named **three directories plus localization**:

```powershell
foreach ($d in 'common\buildings', 'common\production_methods', 'common\production_method_groups') { ... }
```

Every other emitted folder — `technology`, `static_modifiers`, `defines`, `journal_entries`,
`ai_strategies`, `scripted_effects`, `script_values`, `scripted_progress_bars`, `on_actions`, `events`,
`gfx` — kept whatever an earlier build had left. `mod/` was therefore the UNION of every build ever run
in that working copy, not the output of the current one.

⚠ **This is the normal case, not an edge case.** Several emitters are conditional by design:
`research_events.enabled = false` emits no journal entries, bars or script values; the military era-move
file is written only when there are moves; the testbed probe event only when a metric asks. Each of those
leaves a stale file behind the moment its condition flips off — and a stale `zzz_v3tb_probe.txt` in a
CONTROL arm is precisely the landmine L7 exists to prevent, reached by a route L7 does not watch (it
walks the mod, and the mod really does contain the file).

**Fix.** Clean **everything** under `mod/`, with two deliberate exceptions: `.metadata` (the one
hand-maintained thing in the tree) and `common/history` (rewritten later in the same build by
`convert_history.ps1` — wiping it early would leave the game with no starting buildings at all if the
converter then failed, and `replace_paths` makes our copy the only history the engine reads).

**Verified**: after the fix the stale file is gone from `mod/` and from the deployment; the 16 history
files are byte-identical (sha256 `a19a314f…`); the mod's directory list is exactly the 25 it emits.

**The general lesson**: a clean step that names its targets is a list that silently falls behind the
emitters. Whitelist what survives, not what dies.

## FOUR VANILLA KEYS CONTAIN A HYPHEN, AND AN `[a-z_0-9]+` ID CLASS MAKES THEM INVISIBLE (2026-08-12)

**Symptom: a confident, wrong finding.** `verify_start_techs.mjs --diff-vanilla` reported that tier-1
countries LOSE the ability to build the era-2 ammonia-soda explosives works — vanilla needing only
`intensive_agriculture` where we need `dynamite`. The user asked how dynamite could possibly be available
to anyone in 1836. It cannot: vanilla gates `pm_ammonia-soda_process` on **`nitroglycerin`**, which no
starting tier holds.

**Root cause.** The block parser used `/^([A-Za-z_0-9]+)\s*=\s*\{/gm`. Four vanilla keys contain a
hyphen — `pm_ammonia-soda_process`, `pm_coal-fired_plant`, `pm_oil-fired_plant`, `pan-nationalism` — and
for those the pattern does not merely mis-name the block, **it never opens it**, so the entry is absent
from the table entirely. Every lookup then returns "no gate", and **absent reads as PERMISSIVE**: the
check concluded vanilla let anyone run those methods.

⚠ **Three of the four are `vanilla_pm` values of our own tiers** — explosives e2, power e3, power e5 — so
a four-key blind spot landed precisely on the comparison the file exists to make. The same class of miss
had already appeared once that day, in an ad-hoc era-inversion check that silently skipped
`pan-nationalism` and its edges.

**Fix.** `[A-Za-z_0-9-]+` in the id class, everywhere blocks or references are matched, in both
`verify_start_techs.mjs` and the new capability pass in `emit_techs.mjs`. PM count went 539 → 542.

**Effect on conclusions.** The "tier 1 loses explosives e2" row is void. The real list of rungs that lost
buildability was two, not three, and both are now granted (§10.55).

**The general lesson**: an identifier class is a whitelist, and a whitelist that is missing a character
fails SILENTLY and in the permissive direction. Derive the class from the data — a one-line census
(`grep -oE '^[A-Za-z_0-9-]+ = \{' | grep -- -`) would have found all four in seconds.

---

## 2026-08-17 — `ROOT` is not valid in a `scripted_progress_bar`, and it cost 18,720 error lines a run

**Symptom.** Every modded run poured `Event target link 'owner' returned an invalid object` into
`error.log` — **18,723 lines** in the shipped century run, against **0** in a vanilla run of the same
length. 18,720 of them name our own file,
`common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt`.

**The line.** The research events' war gate, emitted by `emit_research_events.mjs`:

```
any_scope_war = { any_scope_front = { any_scope_general = {
    owner = ROOT
    num_mobilized_battalions >= 100
} } }
```

**What it is NOT.** Three plausible causes were checked and cleared before the real one:

- **Not the scope chain.** Vanilla runs the *identical* `war → front → general → owner = ROOT` chain in
  `common/journal_entries/00_nursing.txt`. 14 of vanilla's 21 `any_scope_front` blocks nest
  `any_scope_general`.
- **Not the `owner` link being unsupported.** 17 vanilla `any_scope_general` blocks use `owner =`.
- **Not an occasional general with no owner** — the hypothesis the `owner ?= { … }` safe-link idiom
  exists for. **All 160** `owner = ROOT` lines in the file error, **~117 times each, uniformly**. A
  missing owner on *some* general fires intermittently; this fires on every evaluation.

**The cause.** `ROOT` is not a valid scope inside a `scripted_progress_bar`. The census that settles it:
**vanilla uses `ROOT` zero times across all 14 of its progress-bar files**; we use it 160 times.
Vanilla's identical chain lives in a **journal entry**, where ROOT is the JE's country. A bar has no
ROOT, so the comparison target is invalid and the trigger fails every tick, in every country holding a
war bar. The engine's shipped `scripted_progress_bars.md` documents the syntax but not the scope.

⚠ **The damage is noise, not behaviour** — as far as measured. The gate simply never passes, so the war
half of the research events cannot fire. That is a real content defect, but it does not corrupt the
economy, and every economic number taken from these runs stands.

**Fix: NOT YET APPLIED.** It needs a design decision rather than a one-liner, because the bar genuinely
needs "generals belonging to the country this bar is for" and the back-reference is exactly what is
unavailable. The candidates: express the gate through the country's own `any_military_formation`
(never leaves our scope, so no owner test is needed at all), or move the war test into the journal
entry — where ROOT is valid — and have the bar read a script value. Either needs a run to verify,
since the failure mode is silent.

**The transferable lesson.** *A construct being idiomatic in vanilla does not make it valid in your
context.* The chain, the link and the comparison were each copied faithfully from a vanilla file that
uses all three — into a different kind of file, where one of them has no meaning. When script fails
uniformly rather than occasionally, suspect the **context**, not the data.


## 2026-08-29 — ai_value keyed on the RUNG INDEX instead of the ERA (four-rung arm)

**Symptom:** none. The build passed every linter, preflight twice, and played a clean 100-year
campaign. The defect was found only by reading the emitted numbers *by era* rather than by rung,
in answer to a direct question about what ai_values the four tiers carry.

**The bug.** `tools/make_tier4_config.mjs` line 209 set
`t.ai_value = 750 * AI_LADDER ** steps`, where `steps = j - kept[0].era` is the rung index
*relative to that industry's own first rung*. That anchor is correct for `output_qty` (a tier's
absolute output is a design output; the ladder is what carries meaning) and it is what the line
above it does NOT do for `building_cost`, which already used the absolute era `j`.

**Why it matters.** `ai_value` is the AI's construction desire, and a building competes against
*every other industry's* buildings, not only against its own ladder. Keying it on the rung index
made it a function of when an industry's ladder happens to start:

| era | ai_value(s) present | spread |
|---|---|---|
| 0 | 750 | — |
| 1 | 750, 1998 | 2.66× |
| 2 | **750, 1998, 5321** | **7.1×** |
| 3 | 1998, 5321, 14172 | 7.1× |

The canonical book is strictly era-keyed (one value per era, no exceptions). The four industries
whose ladders start late — **automotive and power (first rung e2, 7.1× too low), synthetics and
electrics (first rung e1, 2.66× too low)** — are precisely the new economy, and they were handed a
malus nobody designed. In the run they came back at **0.14× / 0.34× / 0.06× / 0.54×** of the
canonical arm's workers, against 0.38–1.27× for the industries starting at e0.

**Fix.** `t.ai_value = Math.round(750 * Math.pow(AI_LADDER, j))` — the absolute era, with a comment
saying why and naming the three different anchors in that loop (cost: era; ai_value: era;
output_qty: rung, deliberately). The shipped `config/mod_config.tier4.json` and the pass-through
copy in `config/era_inverse.tier4.json` were corrected in place (10 tiers), which is exact because
`ai_value` never enters the solve — `era_inverse.mjs` only copies it into its artifact.

**Lesson.** A per-rung ladder and a per-era ladder look identical on any industry that starts at
rung 0, which is most of them — so the defect is invisible in a spot check and invisible in every
aggregate. **Read a per-tier quantity grouped by the axis it is SUPPOSED to be constant on**, and
assert the invariant: one `ai_value` per era is now checkable in one line.

## 2026-08-29 — `make_tier4_techs.mjs` has NO ladder-era alignment step (latent, not yet harmful)

**Found by:** a user question — "are synthetics and electrics wrongly gated behind a very high level
tech?" The answer is **no**, but the check exposed a missing guard.

`tech_tree_spec.mjs` carries the LADDER-ERA ALIGNMENT (its line ~1069, user-ruled 2026-08-12): a
technology gating one of our tiers is placed in the MECHANICAL era that tier maps to, re-derived from
the ladder every run, only ever lowering, never landing in era 1. **`make_tier4_techs.mjs` — the
four-rung tree — does none of it.** New technologies get `gameEra(year)`, and vanilla technologies
keep whatever era vanilla gave them. `gameEra` uses VANILLA's windows (1836/1861/1886/1911), which is
exactly the two-calendar problem that put **41 of 106 tiers one era too high** in the six-rung book.

**Current damage: 3 of 66 tiers**, all vanilla technologies, all +1 above the mechanical era their
own era maps to (`ERA_LEAD` 2/3/4/5):

| industry | era | gate | gate era | target |
|---|---|---|---|---|
| food | e1 | `pasteurization` | 4 | 3 |
| motor | e2 | `compression_ignition` | 5 | 4 |
| arms | e2 | `stormtroopers` | 5 | 4 |

32 are exactly on target and 31 sit below it (harmless — cheaper and earlier). It is this mild only
because the tree was hand-pegged under the 15-year rule, which tracked the eras closely **by
accident**. That is luck, not design: nothing in the tool would stop a future peg landing two eras
high, and the cost is real (era base cost + the ahead-of-time penalty, at exactly the date the rung
is meant to be the workhorse).

**Not fixed yet** — the n=3 batch `20260829_212316` froze the config hash and L10 forbids a mid-batch
edit. Fix after it lands: port the alignment rule, or at minimum a validator that FAILS on any tier
whose gate sits above its era's mechanical target.

⚠ **Analysis trap, hit while measuring this.** The first pass keyed the target on the RUNG INDEX and
reported 10 misaligned tiers including every new-economy industry. The target is keyed on the tier's
**ERA**. Keyed correctly it is 3, and none of them are in the new economy. This is the *same* error
as the ai_value defect logged above, made within the hour — **when a per-tier quantity has both a rung
index and an era available, state which one it is keyed on, and check that the two differ before
trusting any result derived from either.**

## 2026-08-30 — TWO added technologies are never researched by anyone, so four frontier rungs are dead content

⚠⚠ **THIS ENTRY REPLACES A WRONG FIRST VERSION WRITTEN THE SAME DAY**, which claimed seven rungs were
"gated on technologies dated after the game ends". That mechanism is FALSE and the correction matters
more than the finding: **a technology's `year`/`onset` is a NARRATIVE annotation, not a gate.** The
mechanical gate is the technology's ERA plus its prerequisites, so a 1938-onset technology is perfectly
researchable before 1936 by a country that is ahead. The data said so plainly and the first version
read past it — `glass` (onset 1938) built **184 levels**, and `fertilizer` (onset 1937) is alive while
`synthetics`, which shares the very same technology `catalytic_synthesis`, is not.

**The real finding**, measured at n=3 over session `20260829_212316`, counting countries holding each
technology at 1936:

| technology | run1 | run2 | run3 | gates |
|---|---|---|---|---|
| `automatic_weapons_manufacture` | **0** | **0** | **0** | arms, artillery, munition e3 |
| `cyclonite_process` | **0** | **0** | **0** | explosives e3 |
| `catalytic_synthesis` | 2 | 2 | 1 | fertilizer e3 (alive), synthetics e3 (never built) |
| `glass_fibre` | 0 | 6 | 2 | glass e3 |
| `transfer_machining` | 2 | 5 | 5 | tooling, automotive e3 |
| `continuous_web_processing` | 0 | 2 | 5 | textile, paper e3 |

**Two of the nine technologies added by `make_tier4_techs.mjs` are researched by NOBODY, in any run.**
That makes four frontier rungs — arms, artillery, munition, explosives — dead content: they exist in
the files, pass every linter, and can never be constructed. 13 of the 18 e3 rungs are alive; 5 are
never born, and `synthetics` is the fifth for a different reason (its technology IS held by 1–2
countries and nobody builds the building — an economic failure, not a gating one).

**Why those two.** Not the era (`catalytic_synthesis` is era 5 too and gets researched). The
distinguishing features are that `automatic_weapons_manufacture` is the only one in the MILITARY tree,
and `cyclonite_process` sits behind two prerequisites (`nitrogen_fixation` + `plastics`). With
`tech_ai_weight_mult` at the ruled 1/1/1, nothing steers the AI toward either. **Not established** —
it is a hypothesis with n=3 behind the observation and nothing behind the cause.

**Fix owed** (deferred: the batch froze the config hash): re-peg those four rungs onto technologies the
AI demonstrably researches, or make the two reachable. And add the validator that would have caught it
— **FAIL when a technology gating a tier is held by zero countries at the campaign end**, which is a
post-run check rather than a build-time one, so it belongs beside the ledger, not in `preflight`.

**Lesson (unchanged, and the reason the wrong version still found something real).** `payback`,
`illogicality`, `below-best` and every macro bound are computed over buildings that EXIST. None can
report a rung nothing ever built — it contributes to no numerator and no denominator and reads as a
design outcome. **A rung at zero in every arm including the control is evidence about the RULES, not
about the economy.** Second lesson, from the wrong version: **when a script prints a FILTERED list,
label the filter in the output.** The first version read a list of zero-level rungs as though it were
the full set, and reported "all 18 frontier rungs are at zero" when 6 of 18 were alive at the time.


## 2026-08-30 — a new technology pegged behind `stormtroopers`, which ~2.7 countries per century ever research

**Found by:** the user asking whether an obvious tech bug was stopping some technologies being
researched. It was.

`make_tier4_techs.mjs` gives `automatic_weapons_manufacture` (which gates the FRONTIER rung of
**three** industries — arms, artillery, munition) the prerequisites `stormtroopers` +
`automatic_machine_guns`. Countries holding each at 1936:

| prerequisite | our mod (n=3) | pure vanilla (n=6) |
|---|---|---|
| `automatic_machine_guns` | 64-72 | mean 49.2 |
| **`stormtroopers`** | **1 / 6 / 0** | **0,6,1,5,4,0 - mean 2.7** |

**`stormtroopers` is a dead end in the BASE GAME** — about 2.7 countries per century reach it. A
technology chained behind it is unreachable in practice, and `automatic_weapons_manufacture` was
held by **zero countries in all three runs**, making three frontier rungs dead content.

The same shape, milder, explains the rest: `cyclonite_process` and `catalytic_synthesis` share
identical era, category, prerequisites and ai_weight, and both sit behind `nitrogen_fixation`
(27-32 countries) - they land on 0 and 1-2 respectively, i.e. both are marginal and the difference
between them is noise, not design. `glass_fibre` sits behind `automatic_bottle_blowers` (32-41)
and lands on 0/6/2.

⭐ **THE RULE: a new technology's reachability is bounded by its RAREST prerequisite, not its own
era or cost.** Pegging is usually argued from DATES (the 15-year rule) and from tree plausibility;
neither notices that the peg target is a technology nobody researches.

**Fix owed:** drop `stormtroopers` from `automatic_weapons_manufacture` (leaving
`automatic_machine_guns`, ~50-70 countries), and add a validator — **FAIL, or at least WARN, when a
new technology's prerequisite is held by fewer than N countries in the vanilla baseline.** The
baseline needed for that check already exists and is committed
(`20260821_131149_vanilla-baseline-n16`), so the rate is measurable at authoring time rather than
after a 7-hour batch.
⚠ Note `plastics` runs 105-128 in our mod against vanilla's 33.7 — the research JEs working on the
production tree. So a vanilla holding rate is a LOWER bound for a production technology, and roughly
unchanged for a military one; do not apply one threshold to both trees without checking.


## 2026-08-30 — FOUR vanilla technologies left gating NOTHING by the four-rung re-peg (UNACCEPTABLE)

**User-ruled 2026-08-30, on spotting it in the tech tree:** *"this is absolutely unacceptable ...
There is usually no reason to strip vanilla effects from vanilla techs."*

**Measured on the shipped tier4 build.** Of 57 vanilla PRODUCTION technologies, **4 gate nothing
reachable**:

| technology | vanilla PMs it gates | industry | what gates that industry now |
|---|---|---|---|
| `bessemer_process` (era 2, 1856) | `pm_bessemer_process` | steel | e1 `open_hearth_process` (1867) |
| `lathe` (era 1, 1800) | `pm_lathe`, `pm_leaded_glass`, `pm_dye_workshops` | tooling/glass/synthetics | e1 `steel_railway_cars` |
| `crystal_glass` | `pm_crystal_glass` | glass | e2 `plastics` |
| `baking_powder` | `pm_baking_powder` | food | e1 `pasteurization` |

⚠ A first scan said EIGHT. `enclosure`, `shaft_mining`, `prospecting` and `rubber_mastication` are
FINE — they gate BUILDINGS (farms, mines, plantations) and decrees, which an ad-hoc
`unlocking_technologies` regex over building bodies missed and `audit_tech_content.mjs` finds
correctly. **Use the audit tool; do not re-derive its job with a regex.**

**Mechanism.** The PMs are still DEFINED in our emitted `01_industry.txt` (we copy the file
verbatim apart from the gate remap), but no shipped building carries the PMG that holds them — our
tier split gives each tier building its own single main PM. So the technology unlocks a method that
exists and is on nothing.

**Root cause is STRUCTURAL, not only a pegging slip.** Cutting six rungs to four means fewer gates
are needed than vanilla has technologies for that chain. Vanilla's steel mill has methods behind
BOTH `bessemer_process` (1856) and `open_hearth_process` (1867); with four steel rungs,
`make_tier4_techs.mjs` chose one by 15-year date proximity and **never checked whether the
technology it displaced would be left empty.** Bessemer is the EARLIER and arguably more apt gate
for steel e1.

**This contradicts a rule already in CLAUDE.md** — *"THERE ARE NO CONTENTLESS VANILLA TECHNOLOGIES"*
— which was written about not DELETING them. The four-rung re-peg empties them without deleting
them, which the rule did not anticipate and which is worse: the technology still costs research and
still appears in the tree, and now buys nothing.

**Fix owed** (deferred: a run is in flight): in `make_tier4_techs.mjs`,
1. **prefer the technology that already gates the tier's own `vanilla_pm`** — that is the
   zero-strip choice and needs no 15-year argument;
2. where a rung genuinely cannot use it, keep the displaced technology non-empty — either attach the
   orphaned vanilla PM to the tier building's PMG as a secondary, or re-point an adjacent rung onto it;
3. **VALIDATOR: FAIL when any vanilla technology that gated a PM in the chain we replaced ends up
   gating nothing reachable in the emitted mod.** `/tmp/orphan.mjs` in this session is the working
   prototype: parse shipped buildings (mod files replacing vanilla by filename) -> PMGs -> PMs, and
   check every vanilla technology against that reachable set.


## 2026-08-30 — THE VANILLA-LADDER REBUILD: tiers are vanilla production methods again

**User-ruled**, after the orphaned-technology finding: *"the new 4 tiers should be based, in
references and, if that doesn't create a narrative crime, in names, to the original vanilla PMs …
Going original 4 PMs -> 6 tiers -> 4 tiers is going backwards and creating avoidable problems."*

**The diagnosis was exactly right.** Vanilla's main ladders hold **3-4 methods**; the canonical
six-rung book stretched them to 5-6 by INVENTION; the four-rung cut then ran a date-proximity DP over
*those six* and landed on a set matching neither vanilla's methods nor its gates. Two whole defect
classes came out of that one step — four vanilla technologies gating nothing, and one technology
gating two rungs of one industry.

**The rebuild.** A rung IS a vanilla production method, taken from the anchor building's `pmg_base_*`
group in vanilla order, sourced from the canonical tier that already carries it (all 53 exist), and
**taking the technology vanilla gates that method with**. An ungated method (pm_bakery, pm_muskets)
falls back to the vanilla BUILDING's gate. Invention happens only where vanilla is short, pegged to a
FREE vanilla technology before minting.

| | before | after |
|---|---|---|
| tier buildings | 66 | **62** |
| new technologies minted | 9 | **3** |
| technologies gating one of our tiers | 25 | **48** |
| orphaned technologies | 4 | **0** |
| one technology gating two rungs | 1 (food/conveyors) | **0** |

**Nine industries are now 1:1 with vanilla** — textile, glass, tooling, steel, explosives, arms,
artillery, art_academy, automotive — with zero invention and zero drops. `bessemer_process`,
`crystal_glass`, `lathe` and `baking_powder` all gate a rung naturally, and
`automatic_weapons_manufacture` — the technology pegged behind `stormtroopers`, which ~2.7 countries
per century research — **is not needed at all**, so that defect disappears with the design rather
than being patched.

**Power** goes back to vanilla shape (switchable methods) with `pm_early_power_plant` removed via a
NEW emission path: `pmg_drop_methods` in the config makes build.ps1 own the vanilla PMG file and
re-emit it without that method. There is no additive way to take a method off a vanilla group.

**Enforcement**: `tools/lint_tech_content.mjs`, wired into build.ps1 beside the solvency linter,
reads the EMITTED mod and fails on either hard rule. It reads the artifact, not the config, because a
method can stop being reachable through a BUILDING or a PMG change the tech tool never sees.

**Three fixes to guards whose premises the rebuild removed:**
- `emit_techs` threw on an EMPTY 1836 grant. That grant existed to hand back technologies our
  re-pegging had moved; with vanilla gates nothing needs handing back, so empty is now correct.
- The 15-year peg rule now judges only INVENTED rungs. A rung taking its own method's gate cannot be
  mispegged — that IS the right technology, and vanilla dates many at invention (camera 1839 for an
  1885 rung).
- `smokeless_powder` moved to the production tree: munition's other gates are production, and the
  engine refuses a cross-category prerequisite.

⚠ **Two things I got wrong while doing this, both from the same cause** — banding vanilla methods by
their ONSET year rather than vanilla's ERA field. It reported 13 of 18 ladders in conflict (the true figure is 5) and
made paper look date-inverted when our own `tech_year`s were already ordered. **Vanilla dates at
invention; use the era field for progression questions and `tech_year` for calendar ones.**

## 2026-08-31 — a resume that silently restarted from 1836 PLAYED THE CENTURY AGAIN, and was recorded as a clean run

**Found** while investigating why run004 of `20260830_191950_tier4-vanilla-ladder-n4` took **267.3
min** against 135.1 / 145.5 / 145.7 for its three siblings. The answer is the whole bug: it played
1836→1936 **twice**.

### What happened

CTD at **1931.1.13**, five in-game years from the finish. The resume ladder then failed on every
candidate — attempts 2 and 3 crashed instantly on `autosave.v3` (quarantined), attempt 4 stepped back
to `autosave_1.v3`, **that load failed too, and `-handsoff` began a fresh 1836 game**. Attempt 4 ran
that fresh campaign 32 minutes to 1864.9.14 and crashed; attempt 5 then continued *it*
(`-continuelastsave` takes the newest save on the machine, which was attempt 4's 1864 autosave) and
carried it to 1936.1.1. `meta.json`: `reached_ingame_date 1936.1.1`, `self_quit true`,
`abandoned_reason ""`. A perfect-looking run.

### Root cause — TWO halves, and the second is the dangerous one

`run_observer.ps1` has a resume-landing guard that detects exactly this (`$wanted - $landed -gt
20000` ⇒ the load failed and a fresh game started ⇒ quarantine and step back). It was written for
this failure and it is correct. But:

1. **It only runs when the attempt ENDS.** Attempt 4 burned 32 minutes before the harness could look.
2. **⭐ It sits AFTER `if ($reached -or $timedOut) { break }`, so on a SUCCESSFUL attempt it is
   structurally unreachable.** Attempt 5's fresh campaign reached the target, `break` fired, and the
   guard was never consulted. **The guard that exists to prevent a spliced timeline cannot run in the
   one case where the splice survives into the results.**

The `-ContinueFromSave` path already had a first-tick abort for the identical condition (line ~843).
The crash-resume path never got one.

### The fix

A first-tick abort for the resume path, mirroring the continuation one: as soon as `$firstTick` is
known, if it is more than 2 in-game years behind the run's high-water mark, kill the game. The
attempt can then never reach the target, so control **always** falls through to the existing ladder,
which does its quarantine/step-back bookkeeping unchanged.

⚠ It deliberately does **not** set `$timedOut`/`$abandoned` — those would `break` out of the very
ladder that must run. It reuses the existing `> 20000` threshold rather than inventing a constant.

Verified against this run's own dates: trips on 1931.1.13→1836.1.1 and 1931.1.13→1864.9.14, does not
trip on a legitimate 1931.1.13→1931.1.1 or →1929.6.1 resume (yearly autosaves are ≤1y back).

### And the artifact-side check, because a generator fix is no evidence about data already on disk

Landmine **L26**, AUTO, post-run (`preflight.ps1 -Session <dir>`): any backward in-game date jump
across a run's summary series. It separates two shapes, because they are different defects —
**> 2y = a second campaign (FAIL)**; **≤ 2y = the archiver read several slots of the rotation ring in
one pass, so `autosave_1.v3` (the OLDER save) sorts after `autosave.v3` by filename (WARN, one
campaign, a few summaries out of order)**.

**Swept over all 74 sessions holding summaries: 5 hits.**

| session | shape | counted? |
|---|---|---|
| `20260814_122820_costbook-ab-n2` run001 | 99y — second campaign | no — `usableRuns()` keeps none of that session |
| `20260818_221216_canon-n7` run007 | 38y — second campaign | **no** — L17 already drops run007; the six-rung baseline is n=6 and clean |
| `20260817_225120_port-ramp-monthly-n3` | 0.01–0.89y — ring order | counted, negligible (one month) |
| `20260816_110325_ports-cond-n1` run002 | 1y ×4 — ring order | lib_runs refuses that session (two arms) |
| `20260830_191950_tier4-vanilla-ladder-n4` run004 | **94y — second campaign** | **yes, the only one** |

So exactly one published `n` contains a doubled campaign, and its effect was **measured, not
assumed**: run004's below-best share reads **38.14%** against 36.84 / 37.77 / 38.38 for its siblings,
and the adoption-lag distribution over all four matches run 1 alone. The batch's numbers stand.

### ⚠ It also REFUTES the standing explanation for an unloadable newest save

MODDING_NOTES records the leading hypothesis as *a CTD landing mid-autosave-write, leaving a
truncated `.v3` that exists, is newest, and fails to load* — and the quarantine machinery was built
partly to test it by keeping the file and recording sizes. **This is the first quarantine with a
size record, and it points the other way**: the bad `autosave.v3` is **43 302 141 B — the LARGEST of
the four**, against `autosave_1` 42 946 448, `autosave_2` 42 452 117, `autosave_3` 42 475 142. Not
truncated. What makes a late-1931 gamestate unloadable is unidentified, and `autosave_1` — a
complete, ordinary-sized save — failed to load as well.

### The lesson worth keeping

**A guard placed after an early-exit is not a guard.** The condition `if ($reached) { break }` reads
as "we are done, nothing more to check", and it silently made a correctness check conditional on the
run having failed — i.e. it ran in every case except the one that mattered. When adding a validity
check to a loop, check where the loop can leave from, not only where the check sits.

## 2026-08-31 — a `vanilla_pm_aliases` rung: the converter places the building, the tech grant never hears about it, and L14 shares the blind spot

**Found by the 5-minute smoke check** on `20260831_113919_tier4-flatcost-aiv26-n2`: ten
`create_building effect [ … must have invented … Mechanical Tools ]` lines in the run's own error
window, from ten countries — Two Sicilies, the Ottoman Empire, Chile, Brazil, Khalsa Raj and five
more. Each silently loses its starting tooling workshop.

### The mechanism

The four-rung tooling ladder has **four rungs and three vanilla production methods**, so one method
is absorbed into a neighbour as an alias:

| rung | `vanilla_pm` | gate | `vanilla_pm_aliases` |
|---|---|---|---|
| e0 | `pm_crude_tools` | `manufacturies` | — |
| **e1** | **`pm_steel`** | **`mechanical_tools`** | **`pm_pig_iron`** |
| e2 | `pm_rubber_grips` | `vulcanization` | — |
| e3 | *(invented)* | `cemented_carbide` | — |

`pm_pig_iron`'s own vanilla gate is **`steelworking`**, and in vanilla these ten countries hold it
and run pig iron in 1836. Our converter maps them through the **alias** onto e1 — a building gated
on `mechanical_tools`, which they do not hold. The engine drops the block.

**`emit_techs.mjs`'s 1836 grant never reads `vanilla_pm_aliases`.** The grant rule is *"every
production method vanilla runs in 1836 stays, and the country running it holds the technology"* — it
walks each tier's `vanilla_pm`, so it grants `mechanical_tools` to countries running `pm_steel` and
never learns that a `pm_pig_iron` country has also been placed on that rung. Census of the whole
tools directory: `vanilla_pm_aliases` is read by `history_lib.ps1` (which *places* the building),
`lib_vanilla_ladder.mjs` and `lint_start_conversion.mjs` — **and by nothing that grants or verifies a
technology**.

### ⚠ AND L14 CANNOT SEE IT, BECAUSE IT HAS THE SAME BLIND SPOT

`verify_start_techs.mjs:274` reads

```js
if (t.model_only || !t.vanilla_pm) continue;
rows.push({ …, vanillaNeeds: [...new Set([...bg, ...(vpm[t.vanilla_pm] || [])])],
              weNeed: t.tech ? [t.tech] : [] });
```

For tooling e1 it therefore asks *"what does vanilla need to run `pm_steel`?"* (`mechanical_tools`)
against *"what do we need?"* (`mechanical_tools`) — identical, no gap. The comparison that would
fail — vanilla needs `steelworking` for `pm_pig_iron`, we demand `mechanical_tools` — is never
constructed, because the alias is not in the row set. **The detector passes, and the mod ships ten
dropped buildings.** This is the second time in two days that a guardrail missed the case it exists
for by reading a narrower key than the code it guards (cf. the L13 entry of 2026-08-31, whose
COVERAGE check was per-industry where the property is per-PMG).

### Blast radius

**INHERITED, not new.** The n=4 baseline `20260830_191950_tier4-vanilla-ladder-n4` carries the
identical 10 lines, so the two arms are affected equally and their comparison is unaffected — which
is why the running batch was **not** stopped. It arrived with the vanilla-ladder rebuild, which is
what introduced aliases in the first place (they exist so a dropped rung's vanilla method still has
somewhere to land). Ten buildings across ten mid-tier countries is small in world terms, but it is a
silent divergence from the 1836 start the mod's premise says should match vanilla.

### The fix owed (NOT yet applied — the batch is running and the build path must not move mid-batch)

1. **`emit_techs.mjs`**: walk `[t.vanilla_pm, ...(t.vanilla_pm_aliases || [])]` when deciding who
   gets a rung's technology, so a country placed via an alias is granted the rung's gate.
2. **`verify_start_techs.mjs`**: build `vannillaNeeds` from the union over the alias set, so the
   `pm_pig_iron`-needs-`steelworking` / we-demand-`mechanical_tools` mismatch becomes a row and the
   detector fails. Then prove it by re-running against this book, which must report exactly these
   ten countries.
3. Only then rebuild. ⚠ Do not edit either file while a batch is running — `run_schedule.ps1`
   rebuilds before every run, so the arms would stop being comparable mid-session.

### The lesson

**When one key is widened, every consumer of that key is a candidate for the same widening.** The
alias was added for the converter and tested on the converter. Nothing swept for who else keys on
`vanilla_pm`, and two of the three who do are the technology grant and the check that guards it.
A one-line census — `grep -rl vanilla_pm tools/` — would have listed them all.

### 2026-08-31 — the same defect, THREE times over, and the root cause was an allow-list

*(supersedes the "fix owed" section of the entry above — user-ruled the ten dropped buildings
unacceptable; the batch was stopped at ~1842 and redone.)*

Chasing the ten dropped tooling workshops found **three** independent defects, and the one that
actually silenced the alarm was neither of the two first suspected.

**1. `emit_techs.mjs` read `vanilla_pm` only** — the alias blind spot described above. Real, but on
its own it would still have been *reported* by a working detector.

**2. `verify_start_techs.mjs` hardcoded `config/mod_config.json`.** Line 269 built the "what do WE
demand for this rung" table from the canonical six-rung book **no matter which config was being
built**. For every alternate-config build — tier4, solver2, the vanilla stub — L14 compared the
emitted mod's 1836 start against a ladder that was not in it. Every other tool in the pipeline
honours `MOD_CONFIG`; this one silently did not. Now honours `MOD_CONFIG` and `--config`.

**3. ⭐ THE ONE THAT MATTERED — an unconditional allow-list.**
```js
const NAMED = new Set(['central_archives', 'mechanical_tools', 'intensive_agriculture']);
…
const missing = [...reqs].filter(r => !rec.set.has(r) && !NAMED.has(r)).sort();
```
It suppressed those three technologies **as a requirement, for every country**. Its premise — *"the
1836 grant names them, so a gap is never real"* — holds only while the grant names them to every
tier that can own such a building. The four-rung book broke it: the grant names `mechanical_tools`
to tiers 1–2, while the tooling e1 rung lands in **tier-3 and tier-4** countries' hands through the
alias mapping. So the detector was told, in advance and unconditionally, to ignore the exact
technology that was about to fail.

⇒ **It was also redundant.** `startSets()` already expands the grant per country, so a country that
genuinely was granted the technology has it in `rec.set` and raises no gap. An allow-list layered on
a correct per-country set can only ever hide a true failure; anything genuinely inherited from
vanilla is absorbed by `--vs-vanilla`, which exists for that. `NAMED` is now empty, with a comment
saying not to repopulate it.

**And the grant carried the mirror image of the same mistake:** `if (VAN_STARTING_NAMED.has(t.tech))
continue;` skipped any technology vanilla names *anywhere*, where the right test is whether vanilla
names it **to that tier** (`vTier[st].has(t.tech)`). One allow-list on the granting side, one on the
checking side, agreeing with each other and both wrong.

⚠ **A subtlety that would have produced a half-fix.** Widening to aliases must ask the question
**per method**, not over the union of their gates. The union asks *"could a vanilla country of this
tier run BOTH `pm_steel` and `pm_pig_iron`"* — which tier 3 cannot — so it would have withheld the
grant from precisely the countries needing it. The right question is *"could this tier run ANY
method that lands on this rung?"*

### Proof, both directions

- Detector before the grant fix, on the honest (tier4 mod, tier4 config) pair: **exactly the ten
  countries the engine reported** — BRZ, CHI, CHL, PAN, RUS, SIC, TUR on `mechanical_tools`, plus
  the three vanilla-inherited `fractional_distillation` rows.
- After: those seven are gone, three inherited rows remain, `--vs-vanilla` PASSES, `--diff-vanilla`
  reports **0 rungs newly gated** and no country losing a technology.
- The canonical six-rung book still builds green with `NAMED` emptied.

### What the baseline lost, for the record

The n=4 baseline `20260830_191950` shipped without this fix, so it was missing **10
`create_building` blocks = 23 ownership levels** of `building_tooling_workshop_steel` at 1836:
**RUS 11 · CHI 4 · SIC 3 · TUR 2 · CHL 1 · BRZ 1 · PAN 1**. Any comparison against it must carry
that: the corrected arm starts with more industry, concentrated in Russia, and the difference
favours the new arm.

### The lesson

**An allow-list is a standing instruction to ignore evidence, and it does not expire when the
premise behind it does.** Both of these were written when the grant genuinely covered the case, and
both kept firing for months after the ladder moved out from under them. If a check must exempt
something, derive the exemption from the same data the check reads (here: "is it in this country's
own start set?") so it cannot outlive its reason.

## 2026-09-01 — two ledger fill scripts read a HARDCODED session and ignored `--mod` (3rd and 4th of the same defect)

`fill_emp.mjs` and `fill_research.mjs` both opened with
`const RUNS = [1,2,3,4,5,6].map(i => '20260818_221216_canon-n7/run00${i}_canonfull')`
while accepting every other flag. Filling a ledger for ANY other batch therefore reported **canon-n7's**
employment-by-rung table and its technologies-held / journal-entry tables **under the new batch's title**,
with nothing failing: the numbers are plausible, the tables render, the report passes `fill_verify`.

Caught by noticing `fill_emp` print employment figures **identical** to a different arm's — implausible
across different worlds — not by any check.

⚠⚠ **CONSEQUENCE: the published flat-cost n=7 ledger's employment and research sections are canon-n7's.**
Every other section of that report reads its own data. It needs re-filling and republishing.

**This is the THIRD and FOURTH instance of one defect.** `fill_consts.mjs` and `fill_payback.mjs` had the
same shape and were each fixed alone, when the defect was found, without sweeping the rest of the family.
⇒ **RULE: when a tool is parameterised, sweep EVERY sibling for the hardcoded value in the same pass** —
one grep over the family (`grep -oE "20[0-9]{6}_[0-9]{6}_[a-z0-9-]+" fill_*.mjs report_*.mjs` beside a
`grep -c '\-\-mod'`) finds them all in seconds and is what should have run the first time.

**Fix:** both now derive their run list from `--mod` and **throw** without it, rather than defaulting.
A default that is a previous batch is worse than an error, because it produces a believable report.
`fill_consts`, `report_data` and `report_data2` keep the stamp only as a default they actually override.

**A companion change to `fill_verify.mjs`:** its staleness gate is a substring test over the visible
document, so a batch report that *deliberately names* another session — as the incidents section above
must, to report this very bug — tripped it. Rather than weaken the gate, a deliberate cross-batch
reference is now marked `<code class="xref">…</code>` and exempted, with every exemption **printed by
name** on each run. The exemption cannot fire by accident: prose left behind in the template shell never
wears the class. Proven both ways — the marked reference passes, an injected unmarked `flatcost-n1`
still fails the gate.

## 2026-09-02 — company `ai_construction_targets` duplicated per rung kept the AI rebuilding rung 0 in company home states

**Symptom.** On the user's own metric — people by rung in the shortlist economies — the rung-0 headcount never
fell in any four-rung arm (flat-cost 0.48M→0.43M over the century, cost ladder 0.48→1.44M) while its share
collapsed only because the sector grew. In the flat-cost run001 save at 1936, 30 of the shortlist's 46 e0
textile levels stood in Ile-de-France and 23 of 54 e0 food levels in Leinster; a third to a half of the standing
e0 buildings had been ESTABLISHED after 1920, 38% of e0 levels were company-held (textile 55%, steel 73%, motor
71%), and 54–100% of e0 buildings recorded a layoff after 1930 — dying and rebuilt at once (FINDINGS F97 §4).

**Root cause.** The company chain extension (2026-08-23) duplicated every `ai_construction_targets` entry per
tier. The engine's own comment (`00_ai.txt`): the AI is much more likely to select the building type and the
state that fulfil these targets "for the next company it's planning to form", ×5 on the type and ×20/×50 on
the state. Ile-de-France is Maison Worth's target state for `building_textile_mill`, Leinster is Guinness's
for `building_food_industry` — both rung-0 KEYS, and after duplication both companies carried a standing target
of `level = 5` of the rung-0 building beside the newer rungs. Not an engine mandate like the port wave (F66):
script we wrote.

**Fix (`tools/emit_companies.mjs`).** Nothing deleted. Each duplicated entry below the top rung carries
`owner = { NOT = { has_technology_researched = <next rung's technology> } }` inside its `state_trigger`
(created if the entry had none). A country that cannot yet build rung k+1 sees exactly vanilla's target on
rung k; once it can, the target moves to k+1, whose entry is already in the list. Formation (`possible`,
OR-wrapped over the chain), regional HQs, prosperity and the established-company multipliers run on
`building_types` and are untouched. The summary line now reports the gated count (310 on the four-rung book).
⚠ Bounded downside: if the engine consults `state_trigger` only when picking the state, the ×5 type weight
still leaks to old rungs and behaviour is today's, not worse. Whether the clause is honoured is one of the
pre-registered unknowns of the ab-ladder batch.

**Lesson.** A vanilla block that names ONE building per industry encodes "the industry"; duplicating it per rung
encodes "every rung, forever". Every per-rung expansion of a vanilla list needs the question "which rung did
vanilla MEAN?", and for a construction target the answer is the best one the country can build.

**Outcome (same day).** The gate ran once (20260902_095339 run001, ab1, n=1): shortlist companies 17 against 26 in
vanilla and 26 in the equally small 1.92-ladder arm, NET/BEL/PRU with no company where both references had them,
regional HQs 20 against 74 — and the rung-0 headcount it was meant to cut rose 0.73M→1.17M. Not separable from the
half-sized economy at n=1, but the 1.92 arm is the size control and kept its companies. **Default OFF** now
(`company_target_gate: true` opts in); the relaunch `ab_ladder_n3x2b` runs without it. The suspicion for the
mechanism: the AI may treat a company's target list as a conjunction, and an entry whose state_trigger is false
everywhere makes the company unplannable — the opposite of what the clause intended.

## 2026-09-03 — the crash-resume "abort on the first tick" in `run_observer.ps1` was dead code (a misplaced brace)

**Symptom.** `20260902_223037_ab3-n3` run001 crashed at 1890.3.9, two resumes loaded `autosave.v3` and died
without advancing, the observer quarantined it and stepped back one autosave — and the next attempt's first tick
read **1836.1.12** with no abort. The fresh game played 26 minutes to 1858 inside the same run folder (landmine
L26) before the agent's heartbeat saw the clock go backwards and stopped the batch.

**Cause.** The guard added on 2026-08-31 ("stop the game NOW on a resume whose first tick lands >2 years behind
`$tickAtStart`") was written directly after the CONTINUATION guard's body and before that guard's closing brace,
so it sat INSIDE `if ($ContinueFromSave -and $attempt -eq 1 -and …) { … }`. A crash resume is attempt ≥ 2, so the
enclosing condition was always false and the new guard could never execute. The end-of-attempt ladder (which
does handle a fresh start, by quarantining and stepping back) is only reached when the attempt ENDS — a crash
or the target — which is exactly the case the first-tick guard was written to pre-empt. Its operands were all
correct (`ConvertTo-DateNum` gives 18900225 − 18360112 = 540113 > 20000); the block was simply unreachable.

**Fix.** One brace: close the continuation `if` after its `Start-Sleep`, drop the duplicate `}` after the guard.
Parse-checked with `[System.Management.Automation.Language.Parser]::ParseFile` (0 errors). Applied 00:25 while
`20260903_000418_ab3-n3` was on run 1 — that run had already loaded the old script; runs 2–3 use the fixed one.

**Lesson.** A guard that "was structurally unreachable" was replaced by a guard that was structurally
unreachable in a different way, and both shipped because a guard that never fires looks identical to a guard
that is never needed. The register's rule applies to the harness too: **prove the tripwire trips** — the
2026-08-31 fix was never exercised against a real failed load. Owed: a synthetic test that feeds the observer a
first tick of 1836.1.1 after a `$tickAtStart` of 1890 and asserts the `Stop-Process` path is taken.

## 2026-09-03 — the ledger counted the four-rung book's DISABLED industries as tiered rungs: Britain's shipyards and ports showed up as a growing "e0"

**Symptom.** The user read a steady era-to-era growth of e0 employment for GBR+FRA on the ab3 growth-seeds ledger
while glass e0 had halved and tooling e0 barely moved. The page's British e0 series ran 0.16M (1840) → 0.83M
(1930) → 0.68M (1935); the era-0 rungs of the ENABLED industries, staffing-weighted, are 0.16M (1900) → 0.09M
(1935). The difference is `building_shipyard` (5,000/level) and `building_port` (1,000/level): 469k and 365k
"e0 people" in Britain at 1935.

**Cause.** On a four-rung book `port`, `shipyard`, `shipyard_steam`, `railway` and `power` carry `disabled: true`
(§10.66/§10.67.5): the industry is handed back to vanilla, but its tiers stay in the config and its rung-0 KEY IS
the vanilla building. Nine ledger scripts built their tier→era / tier→employment maps by walking
`cfg.industries` without the `disabled` filter — `report_data2.mjs` (the per-country employment-by-era panel),
`fill_emp.mjs` (the world employment-by-era table, hence goal G2's "oldest rung still grows"), `fill_indecomp.mjs`,
`tiered_panel.mjs`, `report_data.mjs` (era stocks / frontier share), `analyse_ai_tier_profit.mjs`,
`analyse_build_allocation.mjs`, `analyse_gdp_gap.mjs`, `peek_run.mjs`. `fill_payback.mjs` and
`analyse_ai_tier_choice.mjs` already filtered, which is why below-best and payback were right while the employment
panels were wrong. The same defect class as emit_research_events dying on a disabled shipyard tier (§10.67.5) —
on the six-rung canon nothing is disabled, so nothing ever showed.

**Fix.** `if (ind.disabled) continue;` as the first statement of every industry loop in those nine scripts
(`peek_run` via a filter on the loop source); node --check on all; the four A/B ledgers (ab1 n=2, ab2 n=2, ab3 n=3,
ab3 growth seeds) regenerated and republished to their URLs; F98 §2 and F99 §1's world rung headcounts corrected
(ab2 seed 1 at 1935: e0 8.2M not 10.7M).

**Lesson.** A config walker that means "our tiered industries" must say so — `cfg.industries.filter(i =>
!i.disabled)` — and the register needs a static detector for the omission (owed: L27, the L25 pattern).

## 2026-09-03 — FIXED the same day: the art academy's research journal entries could never fire (employment source = 0)

`emit_research_events.mjs` builds each rule-A source's script value as `Σ(level × occupancy) × <employment per level>`,
taking the employment from the tier's config `employment`. The art academy carries **no base employment** (its jobs
live in its ownership PMG, kept as a secondary — CLAUDE.md, "art_academy … its tiers carry no base employment"), so
the multiplier is 0, the value is 0 on every level count, and the `>= threshold` trigger is false forever: `film` and
`sound_film` fired 0 of 6 for Britain in the calibration (F101.2) with 21–52-year windows open. Present on the
six-rung canon too (same code). Fix: derive the per-level employment the way `tierEmp()` in `ui/econ.js` does — base
employment plus every secondary PMG's base PM — or, for a tier whose config employment sums to 0, count STAFFED LEVELS
against `people / perLevel` the way the group anchors already do. FIXED 2026-09-03 with the calibration change: the rule-A loop no longer `return`s on a zero-employment predecessor, and
the source loop treats `emp > 0` as the people/levels switch, so the academy's technologies (realism, film, sound_film) get
bars — the emitted count went 40 → 43 technologies. Then (the user: "fix the art academy not being calculated properly") the
per-level employment is DERIVED rather than defaulted: `tierEmp()` takes the config employment, or for a tier whose main
method employs nobody the base (first non-gated) method of each secondary PMG from `ui/vanilla.js` — the academy's
`pm_traditional_patronage` is 1,000 academics + 3,000 clerks + 1,000 laborers = 5,000 per level, so its marks read
5 / 15 / 47 fully staffed levels at 25k / 75k / 235k, and the JE text quotes the real people figure.
⚠ Found on the way: the new multi-line JE description was emitted with REAL newlines inside the yml value (507 malformed
loc lines, the build passing, the game would have shown the first line and logged the rest as garbage) — the loc writer now
escapes `
`. A loc value is one line; the escape is part of the string.

## 2026-09-03 — a patch script's `$$` reached the emitter as `$`, and the loc lost its `$good$` reference

**Symptom:** the consumption-anchor term text read `explosives$: at least 50 a week…` — the leading `$` of the `$explosives$`
loc reference gone, so the game would have printed a bare `explosives$`.
**Cause:** the patch applied its text with `String.prototype.replace(anchor, replacementString)`, and a STRING replacement
interprets `$$` as one literal `$` (beside `$&`, the backtick/quote forms and `$n`). The patch's template literal `$${s.good}$`
therefore landed in the emitter as `${s.good}$`. Every earlier patch survived because `${T}` is not a replace pattern; only `$$` is.
**Fix:** the two lines corrected in place; the fixer used `s.replace(a, () => b)` — a FUNCTION replacement is verbatim.
**Rule:** when a patch script pastes JavaScript that contains `$$`, pass the replacement as a function, never a string.

## 2026-09-03 — OPEN (fix queued behind the running batch, L10): rescaled secondary methods ship without loc

**Symptom:** every four-rung run logs ~700–1,000 `Production Method is missing loc key` / `Production Method Group is missing loc
key` lines (canon4-tgate run001 738, ab3 run001 984, canon4-je run001 ~150 in its first five minutes); the pure-vanilla
baseline logs none. The keys are the A/B book's RESCALED secondaries — `pm_vacuum_canning_food_industry_sweetener`,
`pm_tank_production_automotive_industry_transfer_line`, `pmg_synthetic_silk_synthetics_plant_polyamide`, … — the per-building
copies `tools/emit_secondaries.mjs` writes so a rung's secondaries scale with its recipe (§10.68).
**Cause:** the emitter copies the method and the group under a new key and emits no localization for either, so the game
shows the raw key in the building panel. Loud (error.log), cosmetic (no economics touched), and present in every run on
the book since ab1.
**Fix owed:** emit `<newkey>: "$<sourcekey>$"` (and the `_desc` where the source has one) for every copied PM and PMG in all 11
languages, the way emit_companies.mjs re-points its modifier loc. NOT applied while canon4-je-n5 runs — a build-path edit
mid-batch makes the arms incomparable (landmine L10). Apply after SCHEDULE DONE and prove it with a dry-run grep of the loc.

## 2026-09-03 — OPEN (fix queued behind canon4-je-n5, L10): marines put two naval technologies on the war channel

**Symptom:** `PMR_JE|inception|power_of_the_purse|East India Company` at 1838.11 of canon4-je-n5 run 1 — a naval-tree
technology (prerequisite `admiralty`, a naval-base method) completing a WAR stage, after the user had ruled no naval entries.
**Cause:** `UNIT_TECHS` is every technology named in `unlocking_technologies` inside `00_land_combat_unit_types.txt`, and
vanilla keeps the three MARINES unit types there (`group = combat_unit_group_marines` — they fight on land): low-tier on
`line_infantry` (era 1, so no entry), mid-tier on `power_of_the_purse`, high-tier on `landing_craft`. The `naval_channel:
false` drop removes only technologies with SHIP modifications (`isFleetTech`), which these lack. The dry-run verification
listed all eight names and I read "in the land file" as "army" without checking what each unlocks.
**Effect on the batch:** two extra 6-tick war entries, granting an era-2 and an era-4 naval technology on an army front
condition; minor-country flavoured (the first firings are the EIC and the Qing). Not stopped; recorded in §10.69 and owed
a line in the session's VERDICT.
**Fix owed:** in `tools/emit_research_events.mjs`, skip a unit type whose `group` is `combat_unit_group_marines` when
building `UNIT_TECHS` (parse the block, not just the `unlocking_technologies` line), leaving the six army entries; prove it
with a dry run listing exactly breech_loading_artillery, defense_in_depth, general_staff, mobile_armor, nco_training,
trench_works. Rule: a unit-type gate is classified by the unit's GROUP, never by which file it sits in.
