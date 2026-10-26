# TESTBED LANDMINES — the register the build walks on every change

A landmine here is a defect where **nothing fails**. The build succeeds, the mod loads, the run completes, the TSV has rows — and the
damage is real and invisible: half a million error lines, a metric reading zero instead of erroring, a burst that evicts its own data
from the log ring, a key that never arrives so the run looks as if the metric failed. The linters check economics, `Invoke-ModChecks`
checks completeness, and `error.log` is expected to carry vanilla's noise, so nobody reads it. These get caught by someone happening to
look, usually months later and while investigating something else.

So they are enumerated here and enforced in code. An entry enforced by `tools/preflight.ps1` has a function `Test-Lm<ID>` there; the rest
name the build step or harness code that enforces them. This document holds the defect, how it was found and the detector; the root cause
and the measurements live in BUGS_AND_FIXES and FINDINGS where they are recorded, and the entry points there.

---

## How this is enforced

```
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1                          # every check, against mod\
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -Mod mod_foo -Config config\mod_config.foo.json
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -RepoOnly [-Config <book>]   # the checks that need no built mod
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -RepoOnly -Only L20,L33 -Config <book>
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -Session tools\testbed\sessions\<stamp>   # + the post-run checks
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -UpdateFingerprint                        # L8, after a deliberate change
```

Other flags: `-WarnOnly` (report, always exit 0), `-Quiet` (print only FAIL and WARN). Exit 0 = every check passed, warned or was N/A;
exit 1 = at least one FAIL. A detector that throws is itself a FAIL (`(detector error)`).

**Three kinds of check.** *Artifact* checks read the built mod and run only in a full walk. *Repo* checks read configs, schedules and
scripts, so they also run under `-RepoOnly` and can gate a batch before anything is built. *Post-run* checks read a session and report
N/A without `-Session`, so they cost a build nothing.

**Where it runs, automatically, and throws on any FAIL:**

| where | when | what |
|---|---|---|
| `tools/build.ps1`, before any file is emitted | every build | `preflight.ps1 -RepoOnly -Only L20 -Config <book>` — a missing tree twin fails in two seconds |
| `tools/build.ps1`, the control and overlay arms | before their early exit | the full walk (the arm whose whole promise is "carries nothing" must not skip the check) |
| `tools/build.ps1`, the end | every build: canonical, `-SaveTo`, `-DryRun` | the full walk against the built mod, with `-Config` |
| `tools/testbed/run_schedule.ps1` | before the estimate of every batch | `-RepoOnly`, then `-Only L20 -Config` per setup |
| by hand | after every batch (TESTBED_OPERATIONS §8.1) | `-Session <session folder>` |

**Checks outside preflight**, in `build.ps1`: the reference scan in `emit_vanilla_refs.mjs` (L40) and `check_dlc_gates.mjs` (L39) on every
build; then the linter block — `lint.sh` (prints, never throws), `lint_solvency.mjs` (L18), `lint_tech_content.mjs`,
`lint_start_conversion.mjs` (L13), `lint_tier_eras.mjs` (L31), `lint_pm_combos.mjs` — which `-NoLint`, or a schedule setup with
`lint: false`, skips. The harness carries the rest: the scheduler (L16, L17, L19, L21, L29, L30), the observer (L19, L26, L28, L32, L34),
the launcher (L30) and the waiter (L21).

`-NoPreflight` exists for a broken detector, not for a hurry.

**It checks the artifact, not the intent.** An artifact detector reads the files the build emitted, never the generator that produced
them or the flags it was handed — the principle of `verify_pms.mjs`, which re-reads `common/production_methods` rather than our own
extract. A generator bug cannot hide behind a checker that reads only the generator. Where the defect lives in the source itself (a reader
script, a schedule, a config), the source is the artifact.

---

## The register

**Runs:** *build* = the preflight walk at the end of every build · *repo* = also under `-RepoOnly`, the pre-batch gate · *session* =
`-Session` after a batch · *lint* = a build step outside preflight (skipped by `-NoLint`) · *harness* = scheduler, observer, launcher or
waiter. **Status:** AUTO = a detector fails the build, the batch or the post-run walk · WARN = it warns and a human judges · MANUAL = no
detector · OPEN = live; a detector or fix is owed. "Proven" = broken on purpose and seen to trip.

| ID | landmine | detector | runs | status |
|---|---|---|---|---|
| L1 | a named country tag with no existence guard | `Test-LmL1` | build | AUTO, proven |
| L2 | a data function written as script | `Test-LmL2` | build | AUTO |
| L3 | a scope bounded in 1836 and unbounded by 1900 | — (`preflight` skill) | before a batch | MANUAL |
| L4 | two heavy sweeps in one tick | `Test-LmL4` | build | WARN |
| L5 | a telemetry spec key the scheduler never passes on | `Test-LmL5` | build, repo | AUTO |
| L6 | telemetry reads a script value nothing defines | `Test-LmL6` | build | AUTO |
| L7 | a control arm carrying gameplay content | `Test-LmL7`; `-ControlOnly` throws | build | AUTO |
| L8 | the emitted telemetry changed and the schema version did not | `Test-LmL8` | build, repo | AUTO |
| L9 | reading the shared log ring without filtering by the run's own identity | `Test-LmL9` (regression test) | build, repo | AUTO + OPEN |
| L10 | editing the generator while a batch is running | — (`preflight` skill) | while a batch runs | MANUAL |
| L11 | a named tag that is not the country you think it is | proposed | — | OPEN |
| L12 | savegames reaped without a readable summary | `Test-LmL12` | session | AUTO, proven |
| L13 | a starting factory converted onto a tier its own production method contradicts | `lint_start_conversion.mjs` | lint | AUTO, proven |
| L14 | a country starts with a building its own technologies cannot unlock | `Test-LmL14` | build | AUTO, proven |
| L15 | a country loses a starting technology vanilla gives it | `Test-LmL15` | build | AUTO, proven |
| L16 | a schedule key honoured in `defaults` for some fields and silently dropped for others | `run_schedule.ps1` | harness (batch start) | AUTO, proven |
| L17 | a run that failed is recorded as `ok`, and the arm count silently shrinks | `Test-LmL17`; scheduler; `lib_runs` | session, harness | AUTO, proven |
| L18 | a tier that cannot break even at any price the engine can produce | `lint_solvency.mjs` | lint | AUTO, proven |
| L19 | an orphaned game process makes the next run fail instantly and silently | observer and scheduler guards | harness | partly guarded; OPEN |
| L20 | an alternate config with no paired `tech_tree_options.<sfx>.json` | `Test-LmL20` | build (twice), repo | AUTO, proven |
| L21 | a failed build hangs the scheduler instead of aborting it | `Invoke-BoundedBuild`; waiter | harness | AUTO, proven |
| L22 | a mod `effect` block silently replacing a vanilla on_action's | `Test-LmL22` | build | AUTO, proven |
| L23 | a log line counted raw when a burst repeats it | L28 (the mirror); reader rule | analysis | OPEN |
| L24 | a generator's own diagnostic text leaked into an emitted script file | `Test-LmL24` | build | AUTO, proven |
| L25 | a summary reader globs `*.json.gz` and reads the harvester's in-progress file | `Test-LmL25` | build, repo | AUTO, proven |
| L26 | one run folder holding two campaigns, recorded as a clean run | `Test-LmL26` | session | AUTO, proven; live check owed |
| L27 | an industry loop that keeps the disabled industries | `Test-LmL27` | build, repo | AUTO, proven |
| L28 | the log mirror re-copied the current log on a false rotation | `Test-LmL28` | session | AUTO, proven |
| L29 | the observer died on its own log line; a reader holding a log open drops lines | retrying writers; scheduler abort; `Test-LmL29` | harness, session (WARN) | fixed; abort proof owed |
| L30 | a batch launched from the agent's tool shell dies with the app | `launch_detached.ps1`; scheduler ALERT | harness | AUTO, proven |
| L31 | a rung placed or priced by its order in the industry, not by its tier | `lint_tier_eras.mjs`; `Test-LmL31` | lint, build, repo | AUTO, proven |
| L32 | a CTD during the autosave write leaves the continue pointer aimed at a save that does not exist | `Test-LmL32`; the resume feeder | session, harness | AUTO, proven |
| L33 | an emitted define the engine rejects at load, or never reads | `Test-LmL33` | build, repo, session | AUTO, proven |
| L34 | a run recorded complete in minutes | `Test-LmL34`; `lib_runs` | session | AUTO, proven; fix's live proof owed |
| L35 | a rung silently locked out of its industry's gated secondary method | `Test-LmL35` | build | AUTO, proven |
| L36 | a telemetry metric name that matches nothing | `Test-LmL36` | build, repo | AUTO, proven |
| L37 | the stop watcher goes blind to the register on a multi-config schedule | — | — | OPEN |
| L38 | a save summary that keeps one country record per definition | `Test-LmL38` | build, repo, session | AUTO, proven |
| L39 | a replaced vanilla file that loses a DLC gate | `check_dlc_gates.mjs` | every build | AUTO, proven |
| L40 | vanilla script that names a rung-0 key or a renamed method | `emit_vanilla_refs.mjs` scan; smoke check | every build; by hand | AUTO + MANUAL |
| L41 | a game paused by input looks like a healthy run | — | while a batch runs | MANUAL; OPEN |

---

## What no script checks

Walk these by hand. The `preflight` skill (`.claude/skills/preflight/SKILL.md`) carries L3 and L10.

- **Before a batch.** L3: size every scope at the run's end date, not at 1836. L10: is a batch already running? L11: resolve every tag a
  schedule names against the game files. L37: on a schedule with more than one setup the stop watcher enforces only its GDP fallback.
- **While a batch runs.** L10: queue every edit on the build path. L26: an in-game date that falls more than two years between two
  readings of one run is a second campaign — stop and relaunch. L29: never `tail -F` a live harness log. L41: an in-game date unchanged
  for 15 minutes while the game runs is frozen — look for `Paused: true, PlayerID: 1`. L40: count the vanilla-path
  `is_production_method_active` lines at the smoke check.
- **After a batch.** `preflight.ps1 -Session`. L9: `error_log_lines` is an upper bound. L23: count non-telemetry log lines as distinct
  tuples. L19: an orphaned `victoria3.exe` is invisible from the session that left it.

---

## Adding a landmine

When a run surfaces a new one:

1. **Write the entry here first** — the ID (the next free number; check the register before claiming one, and never reuse or renumber an
   ID), the defect, how it was found, the fix idiom and the numbers. Link to BUGS_AND_FIXES for the root cause and to FINDINGS for the
   measurements rather than restating them, so the two cannot drift. Add the row to the register.
2. **Write the detector** as `Test-Lm<ID>` in `tools/preflight.ps1` and register it in `$CHECKS` (`Artifact = $true` if it needs a built
   mod). Read the emitted artifact, not the generator.
3. **Prove the tripwire trips.** Break the thing on purpose, watch preflight fail, revert, watch it pass, and record the proof in the
   entry. A guardrail that has never failed is not known to work.

**A detector that can be code becomes code.** A manual step is one that gets skipped, and the failures in this file are the ones nobody
notices being skipped. L3 and L10 are manual because the information is not available at build time, not because the check was
inconvenient.

**Traps this register has already hit while writing detectors:**
- **It must be able to fail.** Refuse to report success over an empty population (`assertNonTrivial` in `verify_start_techs.mjs`, L14).
  Parse BOM-tolerantly and never swallow a parse error in a silent `catch` (L36). A silent skip is indistinguishable from a check that ran.
- **Prove it against every book and every session shape it will meet.** L13 was proven on one book and failed the other with eight false
  positives on its first build.
- **A check that reads a narrower key than the code it guards passes for the wrong reason** (L13 per industry where the property is per
  vanilla method group; L14 per `vanilla_pm` where placement is per alias set). When a key widens, sweep every consumer.
- **It must not cry wolf on a designed outcome** — runs in flight (L12, L17), stopped stubs (L12), accepted residuals (L33), floods of
  identical lines (L28). A detector that always fires is not read.
- **A walk over `tools/testbed/` skips `tools/testbed/sessions/`**: those scripts are frozen copies, and sessions are never rewritten
  (L25, L27).
- **PowerShell.** Register the verdict with `Add-Result`; a returned hashtable prints into the output stream and is never counted, so
  preflight once reported PASSED under a visible FAIL (L36). Call node as `& cmd /c "node ""<tool>"" … 2>&1"`, or have the tool print its
  verdict to stdout and signal only by exit code: `& node … 2>&1` under the Stop preference wraps a stderr line in an ErrorRecord and throws
  (L14, L31, L38). Variable names are case-insensitive, so `$T` and `$t` are one variable (L35). `run_schedule.ps1` runs under StrictMode,
  which reaches preflight through `&`: read optional properties through `PSObject.Properties`, or a missing one throws and blocks a launch
  (L36).
- **A watcher matches failure, process death and stall, not only success** (L21).

---

## The entries

### L1 — a named country tag with no existence guard

**Defect.** `c:TAG` on a country that no longer exists does not evaluate to false in Jomini; it raises `Invalid right side during
comparison 'c'`. Tags valid in 1836 are often gone by 1900, so a metric that names countries starts erroring mid-campaign and never
stops. Inside `every_market` the cost is dead tags × markets × dump dates.

**Found.** 2026-08-06: 574,455 `error.log` lines over one campaign, 48,659 naming our telemetry (BUGS_AND_FIXES 2026-08-06; the rule is in
TESTBED_METRICS).

**Fix idiom.** `Get-GuardedOwnerLimit` in `telemetry_lib.ps1` — `limit = { OR = { AND = { exists = c:GBR owner = c:GBR } … } }` — and
`Get-GuardedCountryBlock` (`if = { limit = { exists = c:X } c:X = { … } }`) to enter a named country's scope; or filter on a property
instead of identity.

**Detector.** `Test-LmL1` (build): a brace-depth scan of the emitted `on_actions` and `events`; a tag use is legal only if `exists =
c:<same tag>` is asserted in its block or an enclosing one. Not judged: tags inside loc strings (data functions, resolved by another
subsystem; the count is printed), and the files `emit_vanilla_refs.mjs` regenerates from vanilla (vanilla's own `c:TAG` uses, recognised
by their header line).

**Proven.** The hand fix covered 6 sites; the detector's first run found 13 more, including a `this = c:TAG` form.

**Residual.** The guard took comparison errors from 48,659 to 0 in the first guarded campaign, but it cannot silence `Failed to find
country!` from `eventtargetlinks.cpp`: `exists` must resolve the link to test it. That left 194 lines over 46 in-game years, all `QIN`
(L11). Read the rule as zero comparison errors; a `Failed to find country` count beyond a few hundred is the signal.

### L2 — a data function written as script

**Defect.** Data functions (`GetGoods('grain')`, `THIS.GetCountry.GetGDP`) live only inside the quoted text of a `debug_log`. Written as
script they are a parse error, and the engine abandons the file from the error onward: one `limit = { is_goods = GetGoods('grain') }` took
every dump defined below it, and the run harvested nothing (BUGS_AND_FIXES 2026-08-02).

**Detector.** `Test-LmL2` (build): `Test-TelemetryScript` from `telemetry_lib.ps1` — strip the quoted strings; no `Something(` and no `[`
may remain — over the emitted `on_actions` and `events`. The generator runs the same function on its own text; preflight's pass is the one
that survives someone bypassing the generator.

### L3 — a scope that is bounded today and unbounded in 1900

**Defect.** Which market a country belongs to changes. A per-pop sweep keyed on `market = c:BEL.market` covered 178 pops in 3 states in
1836; by 1850 Belgium had joined the British market, the sweep tried to emit 20,686 lines and 5,212 survived the ring — a 75% subset chosen
by ring position, every line individually valid (BUGS_AND_FIXES 2026-08-03).

**Detector.** MANUAL. None is possible: how many markets a scope covers is a property of the campaign, not of the script. Size every scope
at the run's END date with an untruncatable script value, not by counting the sweep's own lines. Anything keyed on one country's market is
the shape to distrust.

### L4 — two heavy sweeps in one tick

**Defect.** The game's log is a 5 × 512 KB ring shared by every run. One unphased dump was ~1.96 MB, and 6,015 telemetry lines rotated
away before any poll could read them; no poll rate fixes that. Phasing spreads the burst, and stacking two heavy blocks on one date brings
it back (origins on phase 0 with market goods: 5,980 of ~6,000 lines lost; TESTBED_METRICS).

**Detector.** `Test-LmL4` (build), advisory: in the emitted telemetry it counts nested iterations (`every_market_goods`,
`GetMarketBuyOrdersBreakdown`, `every_scope_building`, `every_scope_pop`) per trigger date and WARNs when a date carries more than one. A
WARN is a prompt to check the phasing: how many lines a sweep writes depends on how many markets exist on that date, which no build can
know.

### L5 — a telemetry spec key the scheduler never passes on

**Defect.** `run_schedule.ps1` rebuilds each run's telemetry spec from an explicit key list. A key `Read-TelemetrySpec` reads but the
scheduler does not pass on reaches neither the builder nor the mod; the metric falls back to its default and the run looks as if the metric
failed.

**Found.** 2026-08-05: a probe's `breakdown_dates`, `breakdown_tags`, `wide_dates` and `wide_tags` emitted nothing. 2026-08-06, by this
detector: `origin_goods` was threaded nowhere. `20260801_225108_paper-be20-n3` asked for `paper, wood, sulfur, dye, tools, steel, clothes,
silk, tea, coal` and measured the hardcoded default, so wood, sulfur and dye were never instrumented and glass, iron and opium were logged
unasked. A warning comment already sat on that key list.

**Detector.** `Test-LmL5` (build, repo): every key `Read-TelemetrySpec` consumes must appear somewhere in `run_schedule.ps1`. A mention
test, not a parse of the two hand-kept lists: a key mentioned nowhere is certainly dropped.

### L6 — telemetry reads a script value nothing defines

**Defect.** An undefined script value does not error; it reads zero. A run logged standard of living = 0 for all ~285 countries, with the
urban-centre figures on the same line correct, because `v3tb_solw_*` lived in a probe values file emitted only when a probe metric asked
for it (BUGS_AND_FIXES 2026-08-02).

**Detector.** `Test-LmL6` (build): every `ScriptValue('v3tb_*')` the emitted telemetry reads must be defined in an emitted
`common/script_values` file. Only our own names are judged.

### L7 — a control arm carrying gameplay content

**Defect.** A control may vary only its telemetry (CLAUDE.md §5.1 rule 3). A reader of `{kind: control}` in a schedule must be able to
assume vanilla without opening the build. A day of measurement (2026-08-05, F32/F33) ran on the full mod when the question was about the
base game (BUGS_AND_FIXES 2026-08-06, the provenance entry).

**Detector.** `Test-LmL7` (build, and before the control arm's early exit): identify the arm by the built mod's metadata id; a mod claiming
`com.yurcick.v3_testbed_control` may emit only `.metadata`, `common/on_actions`, `common/script_values` and `events`. Anything else fails
by name.

**Generator side.** `build.ps1 -ControlOnly` throws when handed a config with gameplay content (`pop_need_weight_mult`). Vanilla +
telemetry + one declared change is the overlay arm (`-Overlay`, id `com.yurcick.v3_testbed_overlay`; TESTBED_OPERATIONS §2.2), which L7
does not judge. The check keys on the arm being named honestly: an arm that carries content while borrowing the control id is what it
catches.

### L8 — the emitted telemetry changed and the schema version did not

**Defect.** A finding cites the telemetry schema version it was measured under. `TELEMETRY_VERSION` is bumped by hand and forgotten by
hand: the emitted script changes, the number stays, and two sessions that were never comparable look comparable.

**Detector.** `Test-LmL8` (build, repo): hash the canonical telemetry — every metric the library knows turned on (the list read from the
library's own source), dates, tags, token and build stamp pinned — and compare with `tools/telemetry_fingerprint.json`. Hash moved, version
not ⇒ FAIL; version moved, hash not ⇒ WARN.

**On a FAIL, decide.** Breaking → bump `$script:TELEMETRY_VERSION`, record it in the TESTBED_METRICS table, tag the affected findings, then
`-UpdateFingerprint`. Not breaking → `-UpdateFingerprint` and say so in the commit. The hash does not move on a game patch: it hashes our
generator's output (ON_GAME_UPDATE).

### L9 — reading the shared log ring without filtering by the run's own identity

**Defect.** The game's logs are a ring shared by every run and rotated at startup; anything read from them must be filtered by the run's
own identity, or it reads a previous session's output as this one's. A run measured 313,508 error lines, none of them its own: they cited
`zzz_v3tb_telemetry.txt:20954` while its telemetry file was 41 lines long (BUGS_AND_FIXES 2026-08-06).

| reader | filtered by | state |
|---|---|---|
| telemetry lines | the per-run token | fixed |
| the in-game clock | the line's own `[HH:MM:SS]` | fixed (it had discarded a successful resume verdict) |
| `meta.json` → `error_log_lines` | nothing: the line count of the run's `logs_live/error.log` mirror, which begins with the ring's leftovers | OPEN — an upper bound, not a per-run number |

The smoke check reads the run's own window instead: `batch_heartbeat.sh` keeps the error lines stamped between the run's start and now,
wrap-safe across midnight (TESTBED_OPERATIONS §4.1); `je_tally.mjs` windows the debug mirror by the run token's position.

**Detector.** `Test-LmL9` (build, repo): a regression test that the two fixes are still present (the token filter in `summarise.ps1`, the
timestamp regex in `run_observer.ps1`). It catches someone deleting a filter, not a new unfiltered reader. Owed: `error_log_lines` counted
inside the run's own window.

### L10 — editing the generator while a batch is running

**Defect.** `run_schedule.ps1` rebuilds the mod before every run, so an edit to `build.ps1`, an emitter, `telemetry_lib.ps1`, a setup's
config or any file under `tools/testbed/**` lands in run 2 but not run 1, and the arms stop being comparable — the one failure a control
design cannot survive. Cosmetic edits count (a schema-version bump). Preflight walks `tools/testbed/**/*.mjs` (L25, L27), so even a new
analysis script is on the batch's build path: one added mid-batch on 2026-09-09 failed L27 at the next run's build and the scheduler
aborted the schedule after one run (BUGS_AND_FIXES 2026-09-09).

**Detector.** MANUAL: the build cannot tell whether a batch it belongs to runs beside it. Queue the edit until the session reports
`SCHEDULE DONE` (CLAUDE.md §5.1 rule 7); run `preflight.ps1 -RepoOnly` before committing any `tools/testbed` file while a batch plays. A
frozen copy of a config — the usual mitigation against another session editing it mid-batch — is a new alternate and needs its tree twin
(L20).

### L11 — a named tag that is not the country you think it is

**Defect.** A metric names countries by tag. A tag that resolves to no country covers nothing and errors every tick; a tag that resolves to
a different country covers the wrong one and looks healthy.

**Found.** 2026-08-06, in `market_goods_wide`'s 50-tag list:

| tag in the list | what it actually is | intended |
|---|---|---|
| `QIN` | no country — no definition exists | the Qing, `CHI` |
| `COL` | British Columbia (`capital = STATE_BRITISH_COLUMBIA`) | Colombia, `CLM` |

So the wide sweep never covered the Qing, and F33's "first telephone production anywhere" is first among the 48 tags that resolved
(FINDINGS F33's own note). The same hour, `DNK` was assumed to be Denmark: it is an African minor owning `STATE_EQUATORIA`; Denmark is
`DEN`. `QIN` is still in three old schedules: `debut_good_full_v11.json`, `vanilla_retest.json`, `vanilla_retest_2.json`.

**The same hazard with names.** `PMR_JE` lines carry the country's display name, not its tag, and a country renames itself mid-campaign
(Britain became the "British Republic" in 8 of the 30 phase-1 runs, F107). `je_tally.mjs` and `fill_research.mjs` join through curated
alias maps; a name the map does not know is dropped, never guessed.

**Detector.** Proposed, not written: every `c:TAG` in the emitted telemetry must match a country in `common/country_definitions/*.txt`.
That catches `QIN`, not `COL` — only a human comparing intent against `capital = STATE_…` catches that, so a tag list should carry a
comment naming each unobvious tag. Resolve a tag against the game files before believing it.

### L12 — savegames reaped without a readable summary

**Defect.** The savegame instrument archives each autosave, melts it, writes one summary JSON and deletes the save. That makes the summary
the record: a save reaped without a readable summary is evidence that exists nowhere else, and a re-run is a different world. Every other
signal stays green, and an empty disk reads as success.

**The design the detector holds in force.** `harvest_saves.ps1` writes to a temp name, verifies the artifact (gunzips, parses, requires a
`save_summary_version`, a `provenance.date` and ≥ 10 countries), renames it, and only then deletes the `.v3`; a save that fails is kept,
with a `.err` beside it; the newest save of every run is kept for good (~57 MB a run against ~4 GB for the full set).

**Detector.** `Test-LmL12` (session): for every ended run with a `saves\` folder, require a non-empty `save_summaries\`, read one summary and
require a version (a folder of zero-byte files counts perfectly well), reject leftover `.partial.json.gz`, report `.err` files, and require
at least one `.v3` kept. Runs in flight are not judged. A run whose `archive.log` reads `ARCHIVE DONE - 0 saves` (a stopped 1836 stub)
is skipped and the skip printed; "an empty `saves\`" is not the test, because a full reap without summaries looks the same.

**Proven.** `save_summaries\` renamed away ⇒ FAIL; every save reaped ⇒ FAIL "the escape hatch is gone"; restored ⇒ PASS; the stub skip
holds on `20260915_002935` and `20260916_122445`, while run 1 of `20260916_122445` with its summaries renamed aside still FAILs. Two
harvester bugs that would have produced this signature under a reap-first design: BUGS_AND_FIXES 2026-08-11.

### L13 — a starting factory converted onto a tier its own production method contradicts

**Defect.** The 1836 start converter maps each vanilla factory onto a rung by its active main method. When the mapping fails, the factory
passes through on the vanilla building key, which some rung still owns, and lands there whatever it was running. The build, the linters
and `Invoke-ModChecks` pass, and `start_baseline.json`'s `unmapped` drift alarm reads 0, because a factory whose base key is absent from
the map is never examined at all.

**Found.** 2026-08-12: 98 of 327 starting factories sat one or two tiers off their own methods (ROADMAP.md, the L13 entry under *Deferred
fixes*).

**Still masked, not fixed.** `Get-SplitMaps` in `tools/history_lib.ps1` keys the base-building map on each industry's first rung. Every
canon industry's first rung carries the vanilla key, so conversion works; a book that mints a rung below the vanilla one breaks it again,
silently and at the same scale. The detector is what catches that.

**Detector.** `tools/lint_start_conversion.mjs <mod> <config>` (lint, throws), against the emitted history and the vanilla files:
COVERAGE — every vanilla main method maps to some rung (its own or a `vanilla_pm_aliases` entry), asked once per vanilla method group, with
ruled-away and power-bloc-gated methods exempt; PLACEMENT — a method absorbed as an alias may not shift its factory more than a third of
the ladder; KEYS — every `building=` in the emitted history is one the config defines. A mismatched mod/config pair reports every stray key,
so the tool prints the pair it compares. A factory on a rung that lacks its method also fails `lint_pm_combos.mjs`'s history check.

**Proven.** Stripping one alias fails it, naming the method and the industry. Its first run found a real case (automotive's last method
converted onto the first rung).

### L14 — a country starts with a building its own technologies cannot unlock

**Defect.** The engine places what history tells it and never audits that against the country's technologies, so a great power can start
owning a factory it could never build, and the economy diverges from vanilla for a reason no log names.

**Found.** 2026-08-12, once L13's fix let conversion work: BEL, FRA, GBR, PRU and USA owned a tooling workshop gated on a technology of
ours that had replaced vanilla's `mechanical_tools`. The fix named it in our starting grant, as vanilla names the three technologies its own
1836 map needs.

**The gate binds every building, whoever owns it.** A history `create_building` is checked against the state's own country; `add_ownership`
is not consulted (F68; CLAUDE.md §5.4). An exemption for foreign-owned buildings once switched this detector off and broken start rules
shipped green — its evidence was a snapshot taken a year late, after the engine's own provisioning had built the port. Do not reintroduce
an ownership exemption without a reading taken at 1836.2.1.

**Detector.** `Test-LmL14` (build): `tools/verify_start_techs.mjs <mod> --vs-vanilla` over the emitted history (ours is the only history
the engine reads). It resolves each building's and method's `unlocking_technologies` against vanilla plus our files, expands
`add_era_researched`, reads every method that lands on a rung (its `vanilla_pm` and its `vanilla_pm_aliases`), and reports per country.
It demands no new gap rather than zero: vanilla itself fails on three countries, and the same analysis runs unchanged against the game's
directory. L14 and L15 share `startSets()`, one definition of what a country starts with, per-country extras and guarded grants included.
N/A on an instrument arm (L15).

**Proven.** Deleting the two grant lines ⇒ FAIL naming GBR, FRA and BEL; a NET-owned `port_steam` injected into DEI's territory ⇒ exit 1
naming `screw_frigate`. The alias blind spot (a rung checked only against the method it is named for) and an allow-list that hid the
failing technology were fixed on 2026-08-31 (BUGS_AND_FIXES 2026-08-31).

⚠ **Three ways it reported a false answer before it worked:** it passed vacuously on wrong tag regexes (hence `assertNonTrivial()`); it
failed 24 countries spuriously by reading only `add_technology_researched` (most of the grant is `add_era_researched = era_1`); and it lost
its own error message through `2>&1` (the tool now prints its verdict to stdout and signals only by exit code).

### L15 — a country silently loses a starting technology vanilla gives it

**Defect.** The user's rule of 2026-08-12: every production method vanilla runs in 1836 stays, and the country running it holds its
technology (§10.55). We replace `common/scripted_effects/00_starting_inventions.txt` whole, so a transform that drops a line removes that
technology from a whole starting tier — and starting-tech tiers 1 and 2 get most of their set from `add_era_researched = era_1`, so moving a
technology out of tech era 1 silently withdraws it from 59 countries. The first symptom is a method a great power can no longer run.

**Detector.** `Test-LmL15` (build): `verify_start_techs.mjs <mod> --diff-vanilla` over the emitted files. It expands the era shorthand
against each side's own era assignments (the whole hazard is that ours differ) and includes the per-country `add_technology_researched`
extras 81 countries carry. It FAILs on any loss and reports the gains grouped, so an unexpected one is visible.

**Proven.** Deleting `add_technology_researched = railways` from the starting-tech tier-1 grant ⇒ FAIL naming FRA, GBR, PRU and USA.

**Instrument arms.** L14 and L15 read our own grant, which a control or overlay arm does not emit, so they report N/A — keyed on the built
mod's metadata id (`Get-InstrumentArmSkip`, L7's mechanism), never on the grant file being absent, which must stay a FAIL for a content mod.
Before that skip existed the control arm could not be built at all (2026-08-12 to 2026-08-13).

### L16 — a schedule key honoured in `defaults` for some fields and silently dropped for others

**Defect.** `dump_dates` was read from the run only (`Val $r "dump_dates" @()`) while `tags` and `metrics` fell back to `defaults`, so a
defaults-level `dump_dates` did nothing and every run fell back to one computed dump date instead of twelve. A per-decade series became a
single endpoint.

**Found.** 2026-08-13, by luck: the `-WhatIf` line printed `dumps: 1935.1.1`. Outside L5's reach — dump dates reach the observer as
`-DumpDates`, not through the telemetry spec.

**Detector.** `run_schedule.ps1` (harness, at batch start, before anything is built): `dump_dates` falls back to `defaults` like its
neighbours, and the scheduler throws on any `defaults` key not in `$KNOWN_DEFAULT_KEYS`, naming it (keys prefixed `_` are comments). A new
defaults key must be added to that list and threaded through, or the batch refuses to start.

**Proven.** A real schedule passes `-WhatIf`; the same schedule with a `dump_dates_typo` key in `defaults` throws, naming it.

### L17 — a run that failed is recorded as `ok`, and the arm count silently shrinks

**Defect.** The scheduler took a run's status from the observer's exit code alone, and the observer exits 0 when it abandons a run
(watchdog timeout, STOP file, a resume given up on). A run that reached 1851 of a planned 1936 counted beside three that reached 1936 — an
`n=4` that was `n=3` — while the run's own `meta.json` held every fact needed (`reached_ingame_date`, `until_date`, `self_quit`,
`abandoned_reason`).

**Found.** 2026-08-13, run 4 of `20260813_083557_vanilla-vs-mod-n4` (crashed at 1851.1.27, recorded `ok`). The generating cause of the
retrospective n-corrections in SESSION_VERDICTS: `techtree-full-n3` and `wages-n3` are n=2, `vanilla-retest`'s nineteen runs are sixteen
probes and three failed resumes, `canon-ports-n2` is n=1 for the century.

**Detectors.** (1) `run_schedule.ps1` reads each run's `meta.json` and records `partial(<date>)` instead of `ok`. (2) `Test-LmL17`
(session): every ended run must have reached its `until_date` with an empty `abandoned_reason`. It does not judge why — a STOP is a
shortfall for counting too, and the reason belongs in the session's VERDICT — and runs in flight are counted, never failed. (3)
`lib_runs.usableRuns` is the only definition of a usable run and prints what it drops (CLAUDE.md §3.5).

**Proven.** PASS on `20260817_225120_port-ramp-monthly-n3`; FAIL on `20260817_152516_anchorage-netseed-n1`, a run stopped by the STOP file.

### L18 — a tier that cannot break even at any price the engine can produce

**Defect.** The engine's price band stops at 175% of base. A rung whose base recipe cannot cover its inputs and wages even there survives
only on subsidy and dies when the subsidy lapses.

**Found.** 2026-08-17, diagnosing F67 on the six-rung book: `building_port` ate 15.2 clippers to make 9 merchant marine (break-even 270% of
base). `lint.sh` could not see it: its tier map leaves out `no_mass_be` industries, and its test is circular — it compares a recipe with a
`target_be` the solver restated from that same recipe.

**Rule** (§10.63). Inputs at base, output at the band edge: THROW if `I_base / ((1 − wage_pct) · O_base) · 100 > 175`, wages included. A
ratio below 1 is not the trigger: an early rung may destroy value at base prices when realised prices carry it, and only the unreachable
case is forbidden. Shipyards are not exempt. Recompute from the goods block; never implement it as a bound on `target_be`.

**Detector.** `tools/lint_solvency.mjs --config <book>` (lint, throws): every tier of every enabled industry, priced from
`tools/goods_prices.tsv`. A disabled industry is vanilla's and skipped; the canon has none.

**Proven.** `--census` on the six-rung book named exactly the port (270%), the railway (217%) and synthetics (208%), and stayed silent on
three rungs that destroy value at base but stay reachable (power 158, Bessemer steel 139, steel 135) — the three passing are part of the
proof.

### L19 — an orphaned game process makes the next run fail instantly, and nothing says so

**Defect.** The observer calls `Stop-Process -Force`, logs a clean stop — and the game outlives it. The game is single-instance, so every
later run fails at once, its `run.log` holding one line from the tidy-up path (`restored content_load.json + pdx_settings.json`) that reads
as an orderly shutdown; every visible signal blames the config. The orphan is invisible from the session that left it.

**Found.** 2026-08-17: `canon-ports-n2` run 2 was stopped with the STOP file, the game (PID 8420) kept running, and the next schedule's run
failed 20 s in (SESSION_VERDICTS, `20260817_145526_anchorage-netseed-n1`). It struck again in the L29 incident: 48 runs burned.

**Guards in place.** The observer refuses to start while any `victoria3.exe` runs and throws naming the PID — it never kills it, because the
process may be another session's run or a game the user is playing. `run_schedule.ps1` aborts after two consecutive instant failures
(observer exit non-zero under 90 s after launch), with an ALERT naming L19/L29. L17 drops the dead runs from n.

**Owed.** A verifiable kill: after `Stop-Process`, poll until the process is gone, kill again, and log the outcome either way (today it
is `Stop-Process -Force` and a 3-second sleep, unverified). A running game reported by `preflight.ps1 -RepoOnly` before a batch. Proof:
start the game by hand, launch a schedule, expect the refusal with the PID named.

### L20 — an alternate config without its paired `tech_tree_options.<sfx>.json` cannot be built

**Defect.** `emit_techs.mjs` and `emit_research_events.mjs` derive the tree file from the config's filename (`mod_config.<sfx>.json` →
`tech_tree_options.<sfx>.json`; `MOD_CONFIG` outranks the argument), so an alternate config without its twin cannot be built. The build
fails in 3 seconds with a clear ENOENT — into `build.log`, which nobody reads while a batch is believed to run.

**Found.** 2026-08-18: a frozen byte copy of the canon (an L10 mitigation) had no twin; with L21 the batch sat idle for 6 h 40 min of an
overnight window, zero runs. Five of 21 alternates were unbuildable at the time.

**Detector.** `Test-LmL20` (repo), wired three times: `build.ps1` runs `preflight.ps1 -RepoOnly -Only L20 -Config <book>` before emitting
a file; both full walks in `build.ps1` pass `-Config`; `run_schedule.ps1` runs it per setup before the estimate. With `-Config`: PASS/FAIL
for that config, the FAIL printing the one-line `Copy-Item` fix; without: a WARN listing every unpaired alternate. It mirrors the
emitters' suffix rule, `MOD_CONFIG` included, and names the file the suffix came from.

⚠ Never fix it by falling back to the canonical tree: that pairs one book's buildings with another's technologies (BUGS_AND_FIXES
2026-08-12).

**Proven** on all four paths (2026-08-18): the repo survey WARNs the unpaired alternates; PASS on the canon; FAIL, with the build refused
before any emission, on an unpaired book; `MOD_CONFIG` overriding `-Config` FAILs against the overriding book's tree.

### L21 — a failed build hangs the scheduler instead of aborting it

**Defect.** A failed build blocked the scheduler before its exit-code test: `session.log` stopped at `building setup '…'` with no `BUILD
FAILED`, the harness sat at 9.5 s CPU for 6 h 40 min with no child, and `wait_for_session.ps1` reported RUNNING throughout. Any build
failure, from any cause, cost the whole window. The blocking mechanism was never identified (candidates: PS 5.1 `2>&1` on a native
command, `Out-File` holding the pipe, a console QuickEdit freeze); the fix is a timeout, which is right whichever it was.

**Found.** 2026-08-18, the L20 incident.

**Fix and detector.** `run_schedule.ps1` builds through `Invoke-BoundedBuild`: `Start-Process -PassThru` with output to files merged into one
`build.log`; `WaitForExit` bounded by `-BuildTimeoutMinutes` (default 10, against a ~7 s build); on expiry the child is killed as a tree
(`taskkill /T /F`; `Kill()` alone orphans node and robocopy); the verdict is the process's `ExitCode`, and a null exit code is a failure. A
failed or timed-out build writes `session.json`, prints `SCHEDULE DONE … [ABORTED]` (the waiter's wake-up marker) and exits 3; the run's
status is `build_failed` or `build_timeout`. `wait_for_session.ps1` returns STALLED (exit 3) when nothing in the session tree has been
written for `-StallMinutes` (20), and BAD SESSION (exit 4) for a path that does not exist or enumerates nothing.

**Proven** by breakage: an invalid config ⇒ `BUILD FAILED … (exit 1)`, exit 3 in 1 s; a hanging stub builder at a 1-minute bound ⇒ `BUILD
TIMED OUT`, exit 3 in 63 s, its child's survival marker absent. Two traps the proofs exposed: `Start-Process -PassThru` without `-Wait`
reports a null `ExitCode` unless the handle is touched (`$null = $proc.Handle` is load-bearing); `[string](Get-Content -Raw)` on an empty
file is null, not `""`, so `.Trim()` under StrictMode throws — exactly the timeout case, where the build wrote no stderr. The waiter's
first STALLED called a healthy run stalled (a mangled path, then an invalid regex), which is why a bad path is its own verdict.

**Rule.** A watcher that matches only success is indistinguishable from a broken one: every wait condition also matches failure, process
death and stall.

### L22 — a mod `effect` block on a vanilla on_action silently replaces vanilla's

**Defect.** An on_action's `events` and `on_actions` lists merge across files; its `effect` block does not. With two `effect` blocks for
one on_action the engine keeps the most recently loaded and discards the other, logging one line (`jomini_onaction.cpp:124 There is more
than one 'effect' defined using most recent: …`).

**Found.** 2026-08-18, in `error.log`: `zzz_pm_rehaul_wargate.txt` declared `on_monthly_pulse_country = { effect = { … } }` and, loading
last, replaced vanilla's 1,005-line monthly country effect (Ottoman and Portuguese succession, ruler-trait rolls, content for fifteen tags)
for the whole campaign. Only that day's sessions carry it: the three `wargate-*` probes and `canon-n2`. The gameplay consequence was
inferred from the engine's message, not measured.

**Idiom.** Register a named action: `on_monthly_pulse_country = { on_actions = { pmr_wargate_eval } }` and `pmr_wargate_eval = { effect =
{ … } }`, as the telemetry and diag files do (MODDING_NOTES).

**Detector.** `Test-LmL22` (build): in the emitted `common/on_actions/*.txt`, no top-level block that is a vanilla on_action may have a
direct `effect = {` child. The vanilla names are parsed live from the game, so a patch that adds one is covered; `on_`-prefixed is the
fallback on a machine without the game. Deliberately not a grep for the engine's warning, which needs a run.

**Proven.** The bare `effect` re-added ⇒ FAIL naming the file and the on_action, with the two-line fix; restored ⇒ PASS.

### L23 — a log line counted raw when a burst repeats it

**Defect.** `PMR_JE|<stage>|<tech>|<country>` is logged once per research-entry completion, and analyses counted lines. Canon-n7 run 1 to
1926 held 12,143 lines against 5,293 distinct `(stage, tech, country)` triples (×2.29), the excess packed into a few seconds — Yogyakarta
completing `percussion_cap` 16 times in one second, in byte-identical repeated blocks.

**Cause.** The log mirror's false rotation (L28, identified 2026-09-04): canon-n7 run 1 re-copied one chunk 16 times.

**Rule.** Count distinct identity tuples, never raw lines, and print the raw count beside the distinct one. A stage completes once per
country per technology, so a triple cannot recur. F73's firing counts were raw, and its magnitudes do not stand (FINDINGS F73).

**Detector.** The mirror half is L28's detector. The reader half is owed: `je_tally.mjs`, `tech_census.mjs`, `fill_research.mjs`,
`peek_run.mjs` and `tech_finish_gap.mjs` de-duplicate, but `je_distribution.mjs`'s "firings" still counts raw lines, and nothing checks a
new reader. A log line is evidence that something happened, never of how many times.

### L24 — a generator's own diagnostic text leaked into an emitted script file

**Defect.** `build.ps1`'s `Set-BuildingAiValue` returns a building block's lines and reported a note with `Write-Output`, which in
PowerShell joins the function's return value. The note (`note: building_power_plant = { has a complex ai_value block - not overriding`)
carried an unbalanced `{`, so every later block of two building files nested one level deeper. The build, every linter and
`Invoke-ModChecks` passed and the mod loaded; only 96 `Duplicated key note` lines in `error.log` showed it.

**Found.** 2026-08-19, at the five-minute smoke check of `aival-n4` run 1 (BUGS_AND_FIXES 2026-08-19). The refusal path had never run: no
power or railway rung had carried an `ai_value` before.

**Detector.** `Test-LmL24` (build): every emitted `common/**/*.txt` must end at brace depth 0, never go negative, and hold nothing at depth
0 but `}` or `<key> =` (`#` is a comment only outside quotes; a key may start with a digit, as vanilla's `1848_popular_radical` does).
Deliberately not a grep for `note:` — the next leak will use another word in another function.

**Proven.** The original line re-injected ⇒ FAIL naming the stray line and the brace imbalance; no false positives over the emitted files
of both builds of the time.

**Rule.** A function that returns content never reports through the success stream; use `Write-Warning` or `Write-Host`. A refusal path
that has never executed is not known to work.

### L25 — a summary reader globs `*.json.gz` and so reads the harvester's in-progress file

**Defect.** `harvest_saves.ps1` writes each summary as `<stem>.partial.json.gz` and renames it after verifying (the L12 discipline), but
that name ends in `.json.gz`, and every reader globbed `.json.gz`. Mid-harvest, a still-truncated temp file throws in `gunzipSync` and the
reader's `try … catch { continue }` skips the year silently; a complete, not yet renamed one is read twice, inserting a zero-delta year
into readers that diff consecutive years.

**Found.** 2026-08-20, from a `.partial` name in a smoke check. Finished batches are unaffected (no temp file survives a harvest).

**Fix.** `.filter(f => f.endsWith('.json.gz') && !f.includes('.partial.'))` in every reader.

**Detector.** `Test-LmL25` (build, repo): in `tools/testbed/**/*.mjs`, every `endsWith('.json.gz')` site must be matched by an
`includes('.partial.')` guard; `tools/testbed/sessions/` is skipped. Not a point-in-time check that the folder is clean — the race is
real only during a harvest.

**Proven.** PASS on the clean tree; FAIL naming `peek_run.mjs` with its guard removed. Its first run found a fifteenth reader,
`port_ramp_table.mjs`, which the hand pass over fourteen had missed. A glob is not a manifest.

### L26 — one run folder holding two campaigns, recorded as a clean run that reached its target

**Defect.** A crash-resume whose load fails begins a fresh 1836 game under `-handsoff` (MODDING_NOTES). If that game reaches the target,
`meta.json` says reached, self-quit, no abandon reason, and L17 passes. Readers keyed on the date take the later campaign by luck of filename
order; readers that diff consecutive files diff 1931 against 1837. The only symptom is a doubled wall clock.

**Found.** 2026-08-31: run004 of `20260830_191950_tier4-vanilla-ladder-n4` took 267.3 min against 135–146 for its siblings (BUGS_AND_FIXES
2026-08-31). Again on 2026-09-03 (`20260902_223037_ab3-n3` run001), because the observer's fix was dead code behind a misplaced brace
(BUGS_AND_FIXES 2026-09-03).

**Detector.** `Test-LmL26` (session): read every summary's `provenance.date` in filename order. A backward jump over 2 years ⇒ FAIL, a
second campaign; ≤ 2 years ⇒ WARN, one campaign whose archiver read several ring slots in one pass (`autosave_1.v3`, the older save, sorts
after `autosave.v3`).

**Proven.** FAIL on `20260830_191950` (naming the seam) and on canon-n7 run007; WARN on `port-ramp-monthly-n3`; PASS on
`20260829_152435_tier4-n1`. A sweep of the 74 sessions then holding summaries found one hit inside a published n (that run004; measured
harmless).

**Generator side.** `run_observer.ps1` stops a resume whose first tick is a fresh 1836 game (before 1837.1.1 when the run had passed it);
a fed older save landing years behind is by design (L32). The entry is not redundant with the fix: a generator fix says nothing about
sessions already on disk.

**Owed.** A live check: an in-game date that falls more than two years between two readings of one run means stop the batch and
relaunch, or the run plays the century twice. The 2026-09-03 case was caught that way by hand; `batch_heartbeat.sh` does not compare
readings.

### L27 — an industry loop that keeps the disabled industries

**Defect.** A `disabled: true` industry is handed back to vanilla but keeps its tiers in the config, and its rung-0 key is the vanilla
building. A rung→tier map built without the filter counts every vanilla port, shipyard and railway level as a tiered rung. Nothing fails;
the employment-by-tier panels are wrong.

**Found.** 2026-09-03, by the user reading the ab3 ledger: Britain's t0 employment climbed 0.16M → 0.83M while the real t0 rungs fell to
0.09M (BUGS_AND_FIXES 2026-09-03; F98 §2 and F99 §1 corrected there).

**Today.** Only three frozen books carry disabled industries (`canon-4rung`, `canon4-art`, `canon4-je`); the canon carries just its 17
tiered industries. The rule stays for those books' sessions and any future book (CLAUDE.md §5.3).

**Rule.** `cfg.industries.filter(i => !i.disabled)`, or `if (ind.disabled) continue;` as the loop's first statement.

**Detector.** `Test-LmL27` (build, repo): every industry loop in `tools/testbed/**/*.mjs` (`for (const x of …industries…)`,
`.industries….forEach|map|filter|flatMap(`) must mention `disabled` on its line or the next two; sessions skipped. This is what puts a new
analysis script on the batch's build path (L10).

**Proven.** An unguarded probe file ⇒ FAIL naming `_lm27_probe.mjs:2`; removed ⇒ PASS.

### L28 — the log mirror re-copied the current log on a false rotation

**Defect.** The observer's `Read-Tail` took "the file is shorter than my read position" as a rotation. `Get-Item` reads the directory
entry, which NTFS updates lazily for a file another process holds open, so the length sat below the position for seconds and the whole
current file was re-appended on every 250 ms poll. `V3TB|` telemetry was saved by the mirror's de-duplication, so TSVs and summaries were
right; every other line — `PMR_JE` completions, the game's event lines, the error mirror — was multiplied.

**Found.** 2026-09-04: run 4 of `canon4-je-n5` appended one 946-line chunk 27 times in eight seconds; canon-n7 run 1, 16 times
(BUGS_AND_FIXES 2026-09-04). F101's six-rung per-run counts are raw lines: canon-n7 run 1's 12,004 are 5,232 unique completions.

**Fix.** `run_observer.ps1` reads the length through a handle (`Get-TrueLength`); an unchanged first-line signature means the same file,
not a rotation (`Test-SameSegment`, a prefix compare while the signature comes from a file under 120 bytes); a signature that cannot be
read this instant waits (2026-10-21).

**Detector.** `Test-LmL28` (session): in each run's `logs_live/*.log`, a zero-recovery seam (`--- harness: source log rotated at …,
recovered 0 chars from [] ---`) whose next 30 non-empty lines repeat, stamps and all, the 30 lines that began an earlier read of that
file (the mirror's start or another seam) ⇒ FAIL. The seam alone is not the signature: a real rotation whose old segment was already read
prints the same seam.

**Proven.** canon4-je-n5 run 4's debug mirror reads 26, canon-n7 run001's 14, the October mirrors 0. An earlier test (the 30 lines
anywhere since the previous seam) fired on floods of identical error lines; the two FAILs of 2026-10-20/21 (`wm99-n4` run 1,
`vanilla-now-n8` run 2) were that detector's false positives, not the mirror (BUGS_AND_FIXES 2026-10-21).

**Rule.** A count off a mirror counts what the mirror holds. Tally non-telemetry lines only after de-duplicating (L23); a burst of
identical lines in one second is the mirror until a unique game line in the same second is shown not to be duplicated.

### L29 — the observer died on its own log line, and the batch burned its run list behind the orphaned game

**Defect.** `Write-Log` in `run_observer.ps1` (`Add-Content` to `run.log`, every 20 s tick) ran under `$ErrorActionPreference = "Stop"` in
a poll loop with no `catch`, and `Add-Content` throws "Stream was not readable" while another process holds the file. A heartbeat's
`tail -1` at the wrong second unwound the observer with the game still running; every later observer refused beside the orphan (L19), and
the scheduler burned 48 runs in 15 minutes and printed `SCHEDULE DONE: 60/60`. The last line read as an orderly stop; the exception went
to a console window.

**Found.** 2026-09-07, run 12 of the 60-run plan (BUGS_AND_FIXES 2026-09-07; reproduced: 1,041 of 2,677 appends failed against Git Bash
readers in 45 s).

**Fix.** All four harness log writers (`run_observer`, `run_schedule`, `archive_autosaves`, `harvest_saves`) retry `Add-Content` eight
times with a growing pause, then keep the console line only; `run_schedule.ps1` aborts after two consecutive instant failures (L19). L17
catches the artifact, a run with no `meta.json`.

**The reader side** (2026-10-01, `20261001_215119_e1a-lift-probe-10y`). The retry outlasts a reader that opens and closes (`grep`,
`tail -1`), not one that keeps the file open. A Monitor running `tail -n 0 -F session.log` dropped every scheduler line for half an hour,
and the Monitor's expiry did not kill the `tail` (Windows, Git Bash); left alone it would have swallowed `SCHEDULE DONE`, the waiter's
marker. On 2026-10-17 (`20261017_190800` run 1) a stopped Monitor's `tail.exe` and `grep.exe` kept `run.log` blocked for two minutes until
killed by PID.

**Rule.** Never `tail -f` or `tail -F` a live harness log (`session.log`, any `run.log`, `archive.log`, `harvest.log`). Watch with a polling
loop that opens and closes the file (a background `until` loop running `tail -n 3`). After stopping any watcher, check
`Get-CimInstance Win32_Process` for a leftover `tail.exe`. A harness may die on nothing but the game, and anything it says on the way down
must reach a file.

**Detector.** `Test-LmL29` (session, WARN only — the runs' own `run.log`, `meta.json` and summaries are the record): every run folder with a
`meta.json` must have its `=== run N/M:` line in `session.log`. Proven: WARN on `20261001_215119` (runs 2 and 3 named), PASS on
`20260929_002728`.

**Owed.** A live proof of the scheduler's abort: start the game by hand, launch a throwaway 3-run schedule, expect two ALERTs and an abort.
Not beside a live batch — a second scheduler shares the `STOP_ARCHIVE` / `STOP_HARVEST` signal files.

### L30 — a batch launched from the agent's tool shell dies with the app

**Defect.** The agent's tool shell sits in a job object of the desktop app (KILL_ON_JOB_CLOSE). A `Start-Process` child breaks away
silently into a second job of the app's, and an app restart (a forced re-auth) killed scheduler, observer, game, archiver and harvester in
the same second. A job kill leaves no error, no marker and no last line — from outside it looks like a sleeping machine.

**Found.** 2026-09-13, from `20260910_151220_canon-flat-in12-n30`, killed at 18:45:29 on 2026-09-10 with run 1 ten months short of its end
(BUGS_AND_FIXES 2026-09-13).

**Fix and detector.** `tools/testbed/launch_detached.ps1` creates the process through WMI `Win32_Process.Create`, outside every job, then
asks the kernel and exits non-zero, killing the child, if it is in any job. `run_schedule.ps1` checks itself at startup and logs an ALERT
when it runs inside a job (not fatal: a user's console may sit in a benign one). A Task Scheduler task and `CREATE_BREAKAWAY_FROM_JOB`
were measured and both left the child in a job.

**Rule.** Launch through the launcher, called directly from the PowerShell tool — `& 'tools\testbed\launch_detached.ps1' -File …
-ArgumentList '-Schedule','<spec>' -NoExit` — never wrapped in `powershell -File`: that flattens the argument array into one token, the
scheduler never binds `-Schedule`, and the launcher still reports success, since its kernel proof says nothing about the child's
arguments. A session folder appears within a minute or the launch did not happen.

**The other class stays open.** A reboot (Windows Update restarted the machine at 03:00 on 2026-09-11) kills everything, launcher or not.
Surviving it needs a resume mode (an at-logon task that re-enters the schedule at its last completed run) or Windows Update held back for
the batch's window; neither exists (BACKLOG §G).

### L31 — a rung placed or priced by its order in the industry, not by its tier

**Defect.** `make_tier4_config.mjs` assigned tiers by vanilla method order and `make_ab_config.mjs` keyed the ladder on k = tier − the
industry's first tier, so a late industry's first rung was priced as an 1836 rung: automotive's t2 rung carried vanilla's recipe at
vanilla's margin, electrics' only rung sat on t1 with an 1836 recipe, synthetics and munition likewise. Eleven batches (F98–F110) passed
every lint.

**Found.** 2026-09-13, the tier pass (F111; BUGS_AND_FIXES 2026-09-13).

**Rule.** The tier rule (CLAUDE.md §2.3; §10.78): the rung's index within its industry is never a key to anything.

**Detector.** `tools/lint_tier_eras.mjs` (lint, throws) and `Test-LmL31` (build, repo; with `-Config` that book, without it the canon alone
— frozen pre-pass books such as `canon-4rung` fail by design). It reads the config and its paired tree (the tech eras the mod ships) and
checks: every rung within ±1 tier of its technology's, tiers strictly rising, inside 0–3; for an A/B book, output, input value, building
cost (flat, × C^tier, or a per-tier list) and `ai_value` recomputed from the game files and `_ab`; craft and merged rungs against their
`_artisan` and `_merge` records; output and value added per level rising with tier. A book with no `era_game_era` (the six-rung book) is
out of scope and says so. The A/B check needs the game files.

**Proven.** Every pre-pass book fails on its re-keyed industries; every regenerated book passes.

**Generator side.** `make_tier4_config.mjs` derives placement (`derivePlacement` / `placementFaults` in `lib_tier4_spec.mjs`; `PLACEMENT`
holds only ruled adjustments) and throws beyond ±1; `make_ab_config.mjs` keys on `t.era` and stamps `_ab.keyed_by: 'era'` and
`_ab.command`; `convert_history.ps1` resolves start rules by `era`.

### L32 — a CTD during the autosave write leaves the continue pointer aimed at a save that does not exist

**Defect.** The engine resumes (`-continuelastsave`) the save whose TITLE its pointer — `Documents\Paradox Interactive\Victoria
3\continue_game.json`, rewritten at every completed save — names, not the newest file. A crash during the autosave write leaves the
pointer aimed at a file that is absent or truncated; every resume then logs `Could not load save game [autosave]. Going to main menu.` and
`-handsoff` begins a fresh 1836 game. The old step-back ladder was inert against it, with intact older saves sitting unused beside it.

**Found.** 2026-09-14, run 2 of `20260914_173832_canon-c19-in12-n2`: a crash at 1858.1.1, seven launches in 3.5 minutes, abandoned as
`partial(1836.1.1)`; proved with `probe_resume.ps1` (BUGS_AND_FIXES 2026-09-14/15; MODDING_NOTES).

**Fix.** The deterministic resume feeder in `run_observer.ps1`: on a crash, quarantine the whole autosave set and feed one original per
attempt, newest first, copied under the pointer's title; a re-crash within `-ResumeWindowYears` (5) of the process's first crash feeds the
next-older original; beyond it, a new process opens from the engine's current saves; the set exhausted ⇒ abandon (FINDINGS F117).

**Detector.** `Test-LmL32` (session): a run whose `logs_live/debug.log` carries `Could not load save game [` ⇒ FAIL, or WARN when its
`run.log` shows a `resume feed N/M` line (the feeder handled it).

**Proven.** FAIL on run002 of `20260914_173832`; PASS on its re-run session.

### L33 — an emitted define the engine rejects at load, so the lever silently reverts to vanilla

**Defect.** Defines are a partial override, and the engine validates each value against ranges that are hardcoded and undocumented. A
value outside its range is discarded with one `error.log` line and the key keeps vanilla's value. The build, preflight, the smoke check and
the ledger all pass; the arm is simply not the book.

**Found.** 2026-09-15, run 1 of `20260915_232404_canon-c19-in12-eager-n2`: `MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR =
1.0` (vanilla's comment says "capped at 1"; the range is [0,1)) ran at vanilla's 0.75 — below the 0.9 of the book it was a one-lever test
against. F121 measured three of its four levers.

**Three shapes.**
- *Out of range:* `[defines.cpp:167]: Define 'NAI::…' not valid with given value, reason: Must be between 0 (included) and 1 (excluded)`.
- *Bounded by another define:* land `MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD` 1.25 makes vanilla's ship `EXCESSIVE_THRESHOLD`
  1.05 invalid ("Must be greater than 1.25") — a define no book sets, so no per-key table can anticipate it; what value the engine then
  holds is not known. Accepted as a named residual in the eager books (naval construction only). The key itself can be bounded too:
  `TRADE_CENTER_MINIMUM_GDP_NON_MARKET_CAPITAL` must exceed `_MARKET_CAPITAL` (1 / 1 rejected), and both must be > 0 (F246).
- *Dead* (2026-10-17): a key the engine does not read at all, reported in `debug.log` as `Define 'X' defined in '<file>' not specified.
  Maybe a define macro is missing` — vanilla's own line too (15 keys in 1.13.11, F241).

**Detector.** `Test-LmL33`, two halves. (a) Repo (gating a launch: `-RepoOnly -Only L33 -Config <book>`): the config's `ai_defines`
against bounds the engine has stated — a bound enters the table only then: the pool factor's [0,1) and the two trade-centre bounds FAIL;
land `CRITICAL_THRESHOLD` ≥ the ship `EXCESSIVE_THRESHOLD` WARNs (a deliberate trade). (b) Session: every run's `error.log` for "not valid
with given value", which catches any define, table or not ⇒ FAIL, except a sibling the static half predicted ⇒ WARN; and `debug.log` for a
dead key named in our defines file (`common/defines/01_pm_rehaul_defines.txt`) ⇒ FAIL. `emit_techs.mjs` also refuses the known dead keys
in `game_defines` at build, and `batch_heartbeat.sh` prints rejected defines as their own DEFINE REJECTED AT LOAD alarm at the smoke check.

**Proven.** The unregenerated eager book ⇒ FAIL (static); its aborted session ⇒ FAIL (log), naming both keys; `canon-c19-in12` ⇒ PASS; the
trade-centre 0 and 1 / 1 books and their sessions FAIL and the 1 / 2 book passes; the dead key FAILs both 0.99 runs of `20261017_190800`
and PASSes `20261016_192119`.

**Rule.** A define is a request; the run's own logs are the only proof it applied. Fix a breach by regenerating from the book's
`_ab.command` with the value inside the bound — never by hand-editing `ai_defines`, which leaves `_ab.command` describing a book that no
longer exists.

### L34 — a run recorded complete in minutes

**Defect.** A crash before the first autosave restarted the run with `-continuelastsave`, which loads the newest save on the machine — the
previous run's 1936.1.1 endpoint, still in the game's save folder. The first tick read the target, and the run "completed" in 169 s with
one summary. L17 passes (reached = until), L26 cannot see it (a one-entry series), and the landing guard compared against a tick the
restart had just cleared.

**Found.** 2026-09-17, run 2 of `20260917_132449_canon-c19-in12-confirm-n2` (BUGS_AND_FIXES 2026-09-17); no analysis consumed the stub.

**Detector.** `Test-LmL34` (session) and `lib_runs.usableRuns`: an ended run that reached its until date over a span of five years or more
must carry more than two save summaries (a century carries ≥ 15 at five-year cadence, ~100 at yearly; a foreign landing one or two).
Proven: FAIL naming run 2 of that session; PASS on a clean one.

**Generator side.** The early-death restart sets `$freshRestart`, and the next attempt launches a fresh 1836 game without
`-continuelastsave`. Live proof owed: parse-checked only, with the detector behind it.

### L35 — a rung silently locked out of its industry's gated secondary method

**Defect.** Vanilla gates three secondary methods by naming the main methods they may sit beside (`unlocking_production_methods`):
`pm_elastics` (textile), `pm_precision_tools` (furniture), `pm_bone_china` (glass). The builder owns `01_industry.txt` and appends our
rung's `pm_key` for each vanilla method a gate names, through `vanilla_pm` → `pm_key`. A minted rung (furniture spray finishing, paper
continuous web, fertilizer catalytic synthesis) has no `vanilla_pm`, so it was never appended, and `emit_secondaries.mjs` failed the same
test. Every check passed; the method was simply missing when a player opened the building.

**Found.** 2026-09-18, by the user playing the canon: "T3 furniture doesn't allow adding top luxury furniture secondary PM" (ROADMAP step 8
P7). Only furniture is affected today (paper's and fertilizer's industries have no gated secondary); every future addition is a fresh
instance.

**Fix.** A rung with no `vanilla_pm` inherits the gate membership of the nearest rung below it that has one, at both sites:
`$script:pmRemap` in `build.ps1` (now `vanilla_pm` → a list of `pm_key`s) and the `gatedOn` test in `emit_secondaries.mjs`.

**Detector.** `Test-LmL35` (build): in every `unlocking_production_methods` list of an owned vanilla file, if any rung of an industry is
named, every higher-tier rung of it must be named too. Our own `zzz_pm_rehaul_*` files are skipped: each per-rung copy there is gated to
exactly one rung by construction, and the gate list in the vanilla file is the cause the symptom comes from.

**Proven.** Removing `pm_main_furniture_spray_finishing` from the furniture gate ⇒ FAIL naming it; restored ⇒ PASS.

### L36 — a telemetry metric name that matches nothing, so the run measures nothing and says so nowhere

**Defect.** `telemetry_lib.ps1` selects each block with `if ($metrics -contains "<name>")`. A schedule `metrics` entry that matches no such
test emits nothing, and nothing reports it. Every surface check passes — status `ok`, L17, L26, L34 — and the only trace is `goods_rows:
0`. Not L5: there a key is dropped; here the key arrives and its values are nonsense.

**Found.** 2026-09-20, `20260920_192007_schedule`: of `markets, gdp, buildings, pops, construction, research, companies, queues` only
`construction` exists. Run 1 played a clean century and wrote a 94-byte, header-only `markets.tsv` (2,891 of its 2,917 `V3TB|` records were
`CON`); the market block is `market_goods_scoped`. The batch's price half was void (FINDINGS F153). A wrong name is also a comparability
failure: a baseline must instrument the same metrics as the arms it is divided into.

**Detector.** `Test-LmL36` (build, repo): every `metrics` entry in every `tools/testbed/schedules/*.json` (`defaults`, each setup, each run)
must appear in `telemetry_lib.ps1`'s own `-contains` tests — the valid set derived from the library on every run, never copied. Read with
`ConvertFrom-Json`: a UTF-8 BOM broke a Node first pass whose silent `catch` reported every schedule clean.

**Proven.** `markets, country_state` in a schedule ⇒ FAIL naming the file and `'markets'`; restored ⇒ PASS. Its first run also found
`goodsfilter_probe.json` asking for `consumption_goods` (never launched; repaired in place, recorded in `_metric_name_repaired`).

### L37 — the stop watcher goes blind to the register on any multi-config schedule

**Defect.** `tools/testbed/stop_watch.mjs` scores each finished run by calling `criteria.mjs --arm <session name>` with no `:setup`. On a
schedule with more than one setup, `lib_runs.usableRuns` refuses that call by design ("holds 2 arms … pass a setup name"), and the watcher
logs `criteria.mjs failed … falling back to the 1936 GDP rule` and runs the rest of the batch on the fallback, which catches a runaway only:
a stall and a capital-abundance runoff pass it. The one trace is a 300-character stderr tail in the hidden `stop_watch.log`, which on this
repo's path loses the `Error:` line off its front.

**Found.** 2026-09-22, `20260922_084038_b-gradient-4x3` from run 4: run 3 of `probe-sm-b152` broke by runoff (GBR 17 consecutive years
under 5% U\* at a mean hoard of 1.51) and the watcher read only its 1.164× GDP. Harmless there — that schedule's four configs were not
meant to stop one another.

**Status.** Live: `stop_watch.mjs` still passes `--arm` with the session name alone. The repair is one line: derive the setup from the
completed run's folder name and pass `--arm ${NAME}:${setup}`. A running watcher keeps the code it loaded, so a fix needs it re-armed.

**Detector (owed, `Test-LmL37`).** Repo, gating a launch: a schedule with more than one setup is incompatible with the watcher's current
invocation unless it declares it does not want per-config stopping. Session: `criteria.mjs failed` anywhere in `stop_watch.log`.

### L38 — a save summary that keeps one country record per definition

**Defect.** Up to `SAVE_SUMMARY_VERSION` 11, `save_state_summary.mjs` keyed `countries` by the country's definition tag, so records sharing
a definition — a civil war's two sides, a country a revolt left behind for decades, two records both carrying `is_main_tag` — overwrote
each other in slot order, the main one as often as not, and `world.gdp` / `world.population` lost the dropped records. Trade capacity was
mis-attributed the same way. The harvester's checks passed, L12 read a version, every reader got a number; `world.buildings`, summed over
country ids, disagreed silently. And the saves are reaped: a summary that dropped a record is the only record.

**Found.** 2026-09-30, `20260930_181601_craft-merge-30y` run 1 (FINDINGS F186; BUGS_AND_FIXES 2026-09-30): at 1866 `countries.PRU` and
`countries.JAP` were the rebel sides; vanilla n=16 seed 5 dropped the main China at 1936 (world population 13.8% low); every 1932–1936
summary of the canon n=6 and the vanilla n=16 carries a drop. Pre-v12 summaries cannot be repaired; `summary_drops.mjs --session <stamp>`
sizes their drops (CLAUDE.md §3.5).

**Fix (v12).** One entry per country record: the main record keeps the plain tag, every other record of its definition is `TAG@<country
id>` (a group with two mains, or none, gives the plain tag to its most populous record and names the group on stderr); world totals sum
every record; overlords, states, top producers and trade use the same key. Readers treat keys as opaque; `c.tag ?? key.split('@')[0]` is
the definition in every version.

**Detector.** `Test-LmL38`, both halves through `tools/testbed/ledger/summary_drops.mjs`. (a) Build, repo: `--selftest` runs the real
writer on a synthetic melt with two records of one definition and requires both entries (`AAA`, `AAA@2`), world totals over both, no
building-level gap, and the second record's state keyed `AAA@2` — a regression is caught before a batch reaps a save. (b) Session:
`--check` requires every sampled v12+ summary (each run's newest and every 10th) to satisfy Σ countries = world on building levels,
population and GDP, every key its tag or `tag@<id>`; pre-v12 summaries are counted, not failed.

**Proven.** The definition-keyed line put back ⇒ FAIL naming the dropped record; restored ⇒ PASS; a scratch session with one `TAG@id`
entry deleted ⇒ FAIL with the three gaps.

**Rule.** A map keyed by a field is a claim that the field is unique; check it on the data.

### L39 — a replaced vanilla file that loses a DLC gate, so DLC content reaches players without the DLC

**Defect.** Every DLC's gameplay ships in the base game folder behind `has_dlc_feature = <feature>` triggers and the `dlc = dlcNNN` field of
events; `game/dlc/` holds only art, music and sound. A vanilla file the build replaces whole (companies, the tier-reference fix's copies,
value overrides, defines, technologies, history) that drops one of those lines unlocks DLC content, which Paradox prohibits (CLAUDE.md §5.1
rule 1). Nothing fails: the mod loads, every lint passes.

**Registered.** 2026-10-21, the polish (the user: "This isn't my intention, and that's explicitly prohibited by PDS").

**Detector.** `tools/check_dlc_gates.mjs <mod>` in `build.ps1` after the last content emitter, every build (not skipped by `-NoLint`):
every shipped file under `common/` or `events/` at a vanilla path must keep vanilla's count of `has_dlc_feature` lines and `dlc =` fields,
or it throws (131 files, 19 of them gated, at registration). Additive files are not checked: a hook of ours that fires vanilla DLC
content carries the condition itself. `emit_vanilla_refs.mjs` and `emit_value_overrides.mjs` guard their own copies too.

**Proven.** Removing one `dlc = dlc014` line ⇒ the build throws.

### L40 — vanilla script that names a rung-0 key or a renamed method, so it errors or narrows silently

**Defect.** A vanilla trigger naming a main or secondary method the tier split moved (`is_production_method_active`) logs `Invalid
Production Method` and returns false; a `has_building = building_<x>` matches only the rung that keeps the vanilla key. The canon carried
44–46 such error lines a run (the industrial-accident events, `pm_events`, two vanilla scripted-trigger and -effect files).

**Registered.** 2026-10-21, the tier-reference fix (TIER_REFERENCE_AUDIT.md).

**Detector, two halves.** (1) Every build: `tools/emit_vanilla_refs.mjs` scans `common/` and `events/` and throws on any tiered reference
left outside a file it transforms or its ACCEPTED list, so a patch that adds one stops the build. (2) MANUAL at the smoke check: the run's
own error window must hold 0 `Invalid Production Method` / `PostValidate of trigger 'is_production_method_active'` lines whose script
location is a vanilla path. `batch_heartbeat.sh` filters the `is_production_method_active` class as noise (TESTBED_OPERATIONS §4.2), so
count it separately. Owed: half 2 in `preflight.ps1 -Session` once the window logic is shared.

### L41 — a game paused by input looks like a healthy run: the observer keeps writing a tick line every 20 s, so nothing goes silent

**Defect.** The engine's automatic pause toggles are `PlayerID: 0` and always resume (every run carries one or two). `Pause Toggled! Paused:
true, PlayerID: 1` is player input — a keypress or click in the game window. While paused, `run.log` keeps printing the same in-game date
every 20 s, so `wait_for_session.ps1`'s STALLED (no write anywhere for 20 minutes) never fires, and the run's timeout ends it short of
its target. It also corrupts the run's wall clock: play time rebuilt from the tick lines counts the paused hours, and a slowdown-episode
reader sees a monstrous year. Remove the interval from the `Paused: true` line to the next `Paused: false` before reading it.

**Found.** 2026-10-23, run 13 of `20261021_224949_alt-vanilla-canon-n16`: paused at 12:00:31, the clock held at 1871.7.24 for over two
hours (SESSION_VERDICTS: run 13 void).

**Detector.** MANUAL for now: watch the newest run's last `in-game` date; unchanged for 15 minutes while the game runs means frozen. Owed:
a FROZEN verdict in `wait_for_session.ps1` and a post-run check that flags any `Paused: true, PlayerID: 1` line — both after the batch, since
no `tools/testbed/**` edit may land while one runs.
