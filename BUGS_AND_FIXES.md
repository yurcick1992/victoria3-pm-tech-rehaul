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
