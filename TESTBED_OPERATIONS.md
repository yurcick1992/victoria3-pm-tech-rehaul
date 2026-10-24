# TESTBED OPERATIONS — how a measurement batch is planned, launched, watched, judged and recorded

This is the procedure. It does not repeat what other documents own:

| topic | lives in |
|---|---|
| engine behaviour of headless runs: launch arguments, `content_load.json`, the log ring and its mirror, the per-run token, crash detection by minidump, `-continuelastsave`, autosave enums, the per-decade timing curves | MODDING_NOTES → *Automated headless runs (the testbed)* |
| every guardrail where nothing fails (IDs L1–L38), its story and its detector | TESTBED_LANDMINES.md |
| what telemetry and the save summaries can log; the wall-clock data sources | TESTBED_METRICS.md (§7⅜ wall clock, §7½ the save harvest) |
| what each tool is and how it is invoked | REPO_GUIDE.md (tools are referred to here by path only) |
| how a config is judged (aim / soft / hard, the loss, the consensus) | BALANCE_FRAMEWORK §10.83 and CLAUDE.md §3.2 |
| the words (arm, setup, run, session, batch, usable, intact, consensus, the 2+1 rule) | GLOSSARY.md §4, §7 |
| results | FINDINGS.md (F-numbers); per-session status in `tools/testbed/SESSION_VERDICTS.md` |

The batch machine is Windows; paths and commands below are written as they are typed there. Commands are run from the repo root.

---

## 1. Before a batch

### 1.1 What must be agreed before anything launches

A request to "run X" is not a specification. Before a launch, state back and get agreement on:

1. **The arm(s)** — `{kind: control}` (vanilla + telemetry, nothing else), `{kind: overlay, config: …}` (vanilla + telemetry + one
   declared overlay; not a control), or `{kind: config, config: <path>}` (a full modded build, and which book). §2.2 defines them.
2. **The base book** a new config branches from. A lever change ("try C 1.8 and cost1 1.2") names what moves, not what it moves
   from. Say explicitly whether it branches from the canon or from the latest hypothesis under test, and which of each one's levers
   carry over. (Ruled 2026-10-14 after a 3 × 1836→1936 batch was built on the canon while the latest hypothesis was meant — F234.)
3. **The span** (start and `until`), **n**, and whether the batch is a 2+1 test (§6.2) or a fixed-n / full-run batch.
4. **The metrics** (the telemetry spec) and the dump dates.
5. **What is compared against what** — which reference (§6.4) and which reading decides.

If any of these is unstated, ask. Do not infer it from what the previous batch used.

**Which arm answers which question.** A probe asking how the *engine* behaves (does this trigger mean what its name says, does this
on_action merge or replace, does the AI re-pick a strategy) belongs on vanilla + telemetry: on the mod, our own content is a confound
on the mechanism under test, and a null result cannot be told apart from our content suppressing it. A probe asking how *our economy*
behaves belongs on the config. Decide which question is being asked before choosing the arm.

**Write it down where it survives.** The schedule's `_why` / `_comparison` (and, for config iterations, a `_register` block with the
predictions in the register's own terms) states the arm, the base, the hypothesis and the prediction **before** the run — that is
what turns a surprise into a finding instead of a correction (CLAUDE.md §2.8: no ceteris-paribus extrapolation). Every finding the batch
produces names its arm as well as its session; a finding that names only its session is uninterpretable later.

### 1.2 The go-ahead

- **Never launch a game run without the user's explicit go-ahead.** Only start the scheduler (or the game by any means) when the
  user asked for the run or approved the one proposed. Permission for one batch is not permission for the next, including a rerun
  of the same thing.
- **Ask for the whole batch in one request, branches included.** If the outcome may fork ("if this reads badly we'll want the same
  batch at 130"), ask for both halves together. The usual pattern is a batch left running overnight while the user is unreachable;
  one night beats two nights with an idle day between them.
- **Quote the cost as `<count> × <span>` with a time**, e.g. "three 1836→1936 runs, ~10 h". When the user has already named count
  and span, just confirm what is about to run.

**An allotted window is a standing go-ahead** (ruled 2026-08-14). When the user grants an explicit window for long work
("until Friday evening", "overnight", "the next N hours"), probes and short tests inside it need no further asking: if a blocker is
missing data, or a measurement would close a question, run the measurement instead of handing back a half-answer.

- No wording shortens a window below **12 hours from the last reply**; it ends when the time runs out or the user explicitly
  says to stop or do something else.
- A status request, a request for analysis of data already collected, or a question about earlier results is **not** a break.
- Do not **start** a long test with under **3 hours** of the window left without explicit permission.
- Autonomy is about not asking, not about recording less: a probe in a window still states arm, span and metrics in its schedule
  and still gets a `VERDICT.md` (§8.3).

### 1.3 Sizing a batch

Do not size a century at the opening rate (~1 in-game year per real minute): the game slows as the economy grows, to ~0.44
in-game years per minute in the 1930s, so the opening rate under-states a century by about a third. The per-decade curves and the
cumulative budget table are in MODDING_NOTES → *Automated headless runs*; regenerate them with
`node tools/testbed/run_timing.mjs <sessionDir>`.

Current magnitudes for a full 1836→1936 century: vanilla ~165 min (the summer n=16 main median) and 178.5 min on the October n=6
(F248); recent books 170–195 min (F222, F247). Budget **~3–3.5 h per century run** including load, harvest and the occasional
crash-resume. `timeout_minutes` in use is 330–420; the margin is for a crash-resume, not for the curve. A five-year probe is
~6–8 min.

---

## 2. Arms, schedules and builds

### 2.1 The only entry point: `tools/testbed/run_schedule.ps1`

All measurement goes through `run_schedule.ps1 -Schedule <spec.json>`. It owns *schedule JSON → build each run's mod via
`build.ps1` → run it → harvest*. Never invoke the builder directly to produce test data — that bypasses the record of what was
built and why (`build.ps1 -DryRun` to check that a config lints is fine; it produces no measurements). A hand invocation of
`tools/testbed/run_observer.ps1` is a diagnostic only (e.g. the post-patch smoke test in ON_GAME_UPDATE): it has no build step and
runs a mod someone already built —
`powershell -ExecutionPolicy Bypass -File tools\testbed\run_observer.ps1 -Runs 1 -DumpDates 1836.3.1 -UntilDate 1836.4.1`, with
`-ModPath <dir>` to run an alternate build (`build.ps1 -SaveTo <name>`) without deploying it, and `-Label` / `-Notes <json>` /
`-BuildConfig` to fill `build_state.json`. Under the scheduler it is always `-Runs 1 -FlatOut` with the scheduler's `-Stamp`, so a
run has one identity across its folder, `build_state.json` and its telemetry token.

- **Schedules** live in `tools/testbed/schedules/`; results in `tools/testbed/sessions/<stamp>_<label>/` — the one results root.
  The schedule JSON is copied verbatim into the session folder.
- **The `runs` list is explicit and ordered**; each run carries its index. `-WhatIf` prints the plan, the builds it implies and a
  time estimate, and launches nothing.
- **`defaults`** may carry `tags`, `metrics`, `autosave_interval`, `timeout_minutes`, `dump_dates`, `game_args` and the
  wage / breakdown / wide / origin telemetry keys; any other key (not prefixed `_`, which marks a comment) is refused with its name
  (L16). A run's `dump_dates` default to 1 January of the year before `until`; each dump date must be the 1st of a month.
- **Setup shape is validated up front**, before the first run, so a malformed setup used only by the last run of an overnight
  schedule fails at launch, not hours in.
- **The mod is rebuilt for every run, never cached.** Builds are deterministic (same config + same vanilla ⇒ same output; the only
  nondeterminism is the build time stamped into the mod `name`, which any "did this rebuild change?" check must exclude). Each
  `mod_sched_<setup>/` is deleted when the schedule ends (`-KeepMods` keeps them). `{kind: recipe}` (ordered solver steps) is
  deliberately not implemented: author a config file and reference it.
- **An alternate config needs its paired tree twin** `config/tech_tree_options.<suffix>.json`, or the build dies half-way (L20,
  checked per setup before the estimate prints).
- **Extra game arguments**: schedule key `game_args` → `run_observer -ExtraGameArgs`. `-script_profiling` crashes a headless game.
- **Continuing a kept save**: run-level `continue_save` / `continue_expect_after` / `prior_wall_seconds` / `parent`; join the two
  halves into whole campaigns with `tools/testbed/stitch_session.mjs` before reading them (REPO_GUIDE has both).

### 2.2 The three arms

Telemetry belongs to the **builder**, not the harness: `tools/telemetry_lib.ps1` is the single generator of testbed logging script,
dot-sourced by `build.ps1`, which emits `common/on_actions/zzz_v3tb_telemetry.txt` into whatever mod it builds (flags `-Telemetry
<spec.json>`, `-TelemetryOn`, `-TelemetryToken <tok>`). One generator is what makes arms comparable: control and modded builds emit
byte-identical telemetry apart from the build stamp. There is no fallback generator in the harness and there must never be one (the
old one had drifted and logged fewer columns); the observer refuses to launch a mod that carries no telemetry rather than spend the
game time harvesting nothing. There is no `-NoMod`: the control arm is a real mod, so every arm loads a mod and instruments
identically.

| arm | schedule | built by | carries | guard |
|---|---|---|---|---|
| **control** | `{kind: control}` | `build.ps1 -ControlOnly` (needs `-SaveTo` or `-DryRun`, never writes `mod/`) | metadata + telemetry, nothing else | throws if handed a config with content, and the scheduler throws on `{kind: control}` with any `config`; L7 checks the emitted mod |
| **overlay** | `{kind: overlay, config: X}` | `build.ps1 -Overlay -Config X` | vanilla + telemetry + one declared overlay (today only the pop-need weight rescaling) | throws if the config produces no overlay; own mod id `com.yurcick.v3_testbed_overlay`; a second overlay kind must be named and allow-listed |
| **config** | `{kind: config, config: X}` | `build.ps1 -SaveTo …` | the full mod built from book X | the build's linters and preflight |

**The control rule is absolute: the only thing a control may vary is its telemetry.** Not one gameplay file, not one field. An arm
that needs any gameplay change is an overlay or a config and must not be built by, named after or reported as a control.

**The arm is recorded off the built mod.** Each run's `build_state.json` carries `deterministic.arm` (`control` / `overlay+<what>`
/ `config`), `deviates_from_vanilla` (every gameplay directory the built mod carries), `built_from_config` and `config_sha256`, plus
the git state, game version, harness arguments and the harness script's hash, plus the free-text `agentic` block (a stopgap for
hand-driven experiments; anything moved into `deterministic` must be machine-read, never described). Sessions before 2026-08-06 record
`control+pop_needs` for what is now `overlay+pop_needs`; read it as overlay and do not back-fill it (a session artifact is a
historical record, not a cache).

**The red-flag feed is on for every run** (ruled 2026-10-03, BALANCE_FRAMEWORK §10.94): the scheduler adds `market_goods_wide` on
1 July of every year on the eleven telemetry tags, merged with the schedule's own spec. `-NoRedFlagFeed` only for a re-run whose
telemetry must match an old batch byte for byte. Before adding any metric, read TESTBED_METRICS.md (§9 here for the rest of the
procedure).

**Autosave cadence.** The script default is `five_year`; schedules use **`yearly`**, because the save harvest (TESTBED_METRICS §7½),
the yearly summary series every reader expects and the slowdown quarantine (§7.6) all read the 1 January saves — and a batch that
measures the wall clock must use yearly saves and compare like cadence with like: quarterly runs read dearer per in-game year even
with the save ticks removed (F217), while what one autosave costs is not yet known (TESTBED_METRICS §7½). Autosaves overwrite
the player's own `autosave*.v3` slots on the batch machine.

---

## 3. Launching

### 3.1 Launch only through `tools/testbed/launch_detached.ps1`

```
& 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\run_schedule.ps1' -ArgumentList '-Schedule','tools\testbed\schedules\<spec>.json' -NoExit
```

- **Why the launcher.** The agent's tool shells run inside the desktop app's job objects (kill-on-close); a `Start-Process` child
  only breaks away into a second job of the app's, so an app restart kills scheduler, observer, game, archiver and harvester in the
  same second. The launcher creates the process through WMI in no job object and exits non-zero, killing the child, unless the
  kernel confirms that; the scheduler prints an ALERT if it finds itself inside a job (L30). A reboot still kills everything.
- **Call it directly from the PowerShell tool**, never wrapped as `powershell -File …launch_detached.ps1 …`: the wrapper flattens
  `-ArgumentList` into one token `-Schedule,<spec>`, the scheduler never binds its parameter, and an idle window sits on the error
  while the launcher reports success. **Check that the session folder appears within a minute** of any launch.
- **Keep the keys alive.** The visible window (`-NoExit`) is what gives the scheduler a real console for its keys (§5.1).
  Redirecting stdout/stderr silently disables them (`[Console]::KeyAvailable` throws, the harness drops to headless mode with the
  STOP file as its only control; the observer logs a `WARN` at startup when it has no console). Read progress from
  `tools/testbed/sessions/<stamp>/session.log`, never by capturing the process's stdio.
- `run_schedule.ps1` takes **no `-Label`** (the label comes from the schedule JSON); passing one kills the launch instantly.
- **One game at a time.** Do not start a game by hand while a batch runs; the harness refuses to start a run while
  `victoria3.exe` is up, and an orphaned game makes the next run fail instantly (L19). Two consecutive instant failures abort the
  schedule — kill the orphan or delete the STOP file, then relaunch the remaining runs.

**What starts with the scheduler, by default:** the autosave archiver (into `<run>\saves\`) and the concurrent save harvester (into
`<run>\save_summaries\`; `-NoSaveHarvest`, `-HarvestWorkers N`, `-KeepSaves`), and the machine-load monitor
`tools/testbed/machine_monitor.ps1` (a row every 20 s into `<session>\machine_load.tsv`, exits on `SCHEDULE DONE`;
`-NoMachineMonitor` drops it). For a batch started without the monitor:
`& 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\machine_monitor.ps1' -ArgumentList '-Session','<stamp>' -Hidden`.

### 3.2 Always run the background waiter

The batch window is invisible to the agent harness, so nothing signals when the batch ends. Pair every launch with
`tools/testbed/wait_for_session.ps1`, run with the tool's `run_in_background`, whose exit wakes the agent:

```
powershell -ExecutionPolicy Bypass -File tools\testbed\wait_for_session.ps1 -Session tools\testbed\sessions\<stamp> -MaxMinutes 30
```

| prints | exit | meaning |
|---|---|---|
| `DONE` | 0 | the session finished |
| `RUNNING` | 0 | the `-MaxMinutes` heartbeat (default 30) — re-launch the waiter to keep waiting |
| `DEAD` | 2 | no game process and no completion marker for `-DeadGraceSeconds` (default 900) |
| `STALLED` | 3 | nothing anywhere in the session tree written for `-StallMinutes` (default 20), whatever the processes claim (L21) |
| — | 4 | the session path does not exist (a mangled argument, never reported as a stall) |

Read the printed status, not the exit code (DONE and RUNNING are both 0). A watcher that matched only success could not be told
apart from a broken one, which is why STALLED and the heartbeat exist.

**DEAD can be a false positive during a long harvest.** Between runs the game is gone and no completion marker exists yet, while
the observer parses a large log mirror for minutes. Before treating DEAD as real, check `run.log`'s tail for a `run N finished`
line and whether the harness PowerShell is alive. Never relaunch a schedule on DEAD alone — that kills a healthy batch and restarts
a run from 1836.

Two different graces, not to be confused: the waiter's DEAD grace (900 s) and the observer's crash grace
(`run_observer.ps1 -StopGraceSeconds`, 60 s, how long an unexplained game exit waits for a keypress before it is treated as a CTD;
without a console the observer treats it as a crash at once).

### 3.3 The stop watcher (2+1 batches only)

For a 2+1 test (§6.2), arm the run-level stop watcher right after launch:

```
& 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\stop_watch.ps1' -ArgumentList '-Session','<stamp>','-Poll','30' -Hidden
```

- When a run completes it runs `tools/testbed/ledger/criteria.mjs` on the session; a run **broken by stall or by runoff** (a hard
  line of the criteria register) makes it write `tools/testbed/STOP` (and `<run>\STOP_RULE.txt`), so the next run is abandoned at
  1836 and excluded by L17. If the register cannot be read it falls back to a 1936 world GDP above 1.3× vanilla's median. It never
  acts mid-run and removes the STOP file once the scheduler has exited.
- **`-Session` takes the session name.** A path is normalised, and a session that does not exist is refused with exit 2.
  **Confirm `tools/testbed/sessions/<stamp>/stop_watch.log` exists** (~90 s after arming) — it is the only proof the watcher is on.
- **Single-config schedules only.** On a schedule with several setups the watcher's register call is refused and it silently falls
  back to the GDP rule for the rest of the batch (L37, detector owed).
- A running watcher keeps the code it loaded: re-arm it after the register or the watcher changes.
- Do not arm it on a fixed-n, full-run or long-sequence batch (§6.3).

---

## 4. The smoke check, ~5 minutes after each run starts

A run botched at minute one is still botched at hour three, and the harness will not say so (it can report `SESSION DONE` on a run
that loaded no mod). Five minutes in, the game has booted, loaded, started and written its first ticks. Look then, for every run of
the batch, not only the first. `bash tools/testbed/batch_heartbeat.sh <stamp>` does items 1–4 for the newest run in one read-only
command (and gives L33's define rejection its own alarm).

1. **Our mod loaded.** `grep PM_TECH_REHAUL <run>/logs_live/debug.log` — the builder's init marker. Absent ⇒ stop the run.
   `mod_loaded=False` in the harness summary is not authoritative either way; check the marker.
2. **Game version matches.** `does not match game version` in `error.log`. A Steam update between two runs makes them
   incomparable and is invisible unless looked for.
3. **Errors from this run only** (procedure below), with the vanilla noise classes discarded, then `grep -c zzz_pm_rehaul` on the
   window: our emitted files are all `zzz_pm_rehaul*`, so 0 means no error names anything we wrote.
4. **The clock advances** — the tail of `<run>/run.log` shows `in-game <date>` moving.
5. **The construction mix is plausible** — once the first save summary lands (~10 min, the 1837 autosave):
   `node tools/testbed/queue_mix.mjs <runDir>` (`--all` post-run). One building family dominating a major's queue (≥ 60% of ≥ 3
   items) is a red flag that can void the run (F66's port spam read 100% port on GBR and FRA at the first summary). The WARN is
   advisory: a queue is a backlog, so its length measures drain rate, and a short queue makes any concentration look extreme. Never
   read a queue count without the construction sector and GDP beside it — together they say whether a thin queue is starvation or
   speed.

### 4.1 Reading a run's own error window

`logs_live/error.log` is a mirror of a ring shared by every run, so it starts with whatever the ring already held — a four-minute-old
run can sit at line 12,639 of 12,675, the rest from a previous night. A raw line count is meaningless, and so is comparing
`HH:MM:SS` strings (`"21:52:27" >= "15:24:00"` is true as a string), and so is a time-shaped grep for the first line
(`grep -n "^[1[23]:"` admits an earlier session's 12:18 line when the run began at 12:48).

- Parse each stamp to seconds of day and compare it numerically to the run's start (from its `meta.json` or the first `run.log`
  line).
- Take the window as a **range from the run's start to now, wrap-safe**: `START <= t <= NOW`, or `t >= START OR t <= NOW` when now
  is past midnight. A bare `t >= START` admits the whole previous evening for a run that starts just after midnight (one in nine
  century runs does). An unstamped continuation line inherits the state of the stamped line above it. `batch_heartbeat.sh`
  implements exactly this.
- Count distinct error shapes, not lines; the game repeats one line thousands of times.
- Compare a class's count against the vanilla baseline, never a raw total. When a class is absent from the pinned vanilla sixteen,
  sweep every vanilla session before calling it ours.

### 4.2 Known error classes that are not new defects

All but one are vanilla's, many of them playthrough-dependent (absent in most runs, thousands of lines in one). The heartbeat filters
the first six rows.

| class | signature | evidence |
|---|---|---|
| spline flood | `jomini_spline_network_graphics` | vanilla, every run |
| relocated main-method references | `is_production_method_active` PostValidate | **mod-caused** by the tier split, catalogued (TIER_REFERENCE_AUDIT.md, superseding MISSING_PM_REFERENCES.md); `emit_vanilla_refs.mjs` (2026-10-21) rewrites the references, so a rise is worth a look |
| landlocked navy law | `lawgroup_navy_model has no active law` | every navy law is visible only to a coastal country, so a country landlocked by conquest logs it every tick; up to ~500k lines in one run, none in its sibling; vanilla `20260813_083557` run001 carries 140,249. Telemetry is in `debug.log`, so it is unharmed, but `error.log` is useless past the flood |
| interest-group leader | `Could not get leader of interest group '<IG>' in country '<X>'` + `jomini_script_system.cpp:247` + a `Script location:` in `01_power_bloc_values.txt` or `00_scripted_triggers.txt` | vanilla n=16 runs 1–3: 2,220 / 3,559 / 10,133; 4–5 lines per occurrence |
| invalid country handle | `untyped trigger [ Scoped object of type 'country' is not valid (Country (4294967295)) ]`, location `<unknown>:0` | vanilla n=16 runs 1–2: 925 / 946 |
| religion-less entity | the trio `Div/0 near common/political_movements/…`, `Event target link 'religion' returned an invalid object`, the assertion `The null hierarchy will never have social classes associated with it` — starting together mid-campaign | vanilla n=16 run 7 (8,195 / 10,038 / 1) and run 8 (7,827 religion lines); absent from the other fourteen |
| naval battle loc | `pdx_data_localize.cpp:136 Data error in loc string 'BATTLE_SHIPS_BREAKDOWN_*'` with `pdx_data_factory.cpp:1662 Invalid promote 'NAVAL_BATTLE'(0)` | 3,004–6,766 lines in each pinned vanilla seed |
| diplomatic tooltip loc | `Data error in loc string 'DIPLOMATIC_ACCEPTANCE_DIFFERENT_RELIGION_BUT_SAME_TRAIT'` | **zero in all 16 pinned vanilla seeds**, so a baseline comparison flags it — but present on vanilla arms elsewhere (`20260803_030101_wages-n3` run002 130, `20260803_220658_vanilla-percapita-n3` run002 296, `20260807_005246_popsplit-debut-vanilla` run001 296) |

A watch item, not a noise class: `Failed to create battle in <Front> due to 'land_battle_size'` (`battle_manager.cpp`) runs 0–4 a run
in vanilla but reached thousands in a few runs of the ai_value-3^tier books. Judge it per batch: recurring across many runs of an
arm could mean the arm fields armies too small to spawn battles.

---

## 5. While a batch runs

### 5.1 Controls

- **Scheduler window keys:** `[p]` pause · `[r]` resume · `[s]` stop after this run · `[x]` stop now. Pause suspends the watchdog
  and crash detection, so a paused session is never mistaken for a crash; it does not pause the game (do that in the game). On
  `[r]` the runner checks whether `victoria3.exe` is up: if so it keeps watching, if not it resumes the run from its last autosave.
  A hand-run observer takes `q` (finish this run, then stop) and `x`/`Esc` (close the game, stop now).
- **`tools/testbed/STOP`** (or `STOP` in the session folder) is the file twin of `[x]` and the only control of a headless launch;
  a keypress also writes it, which is how it reaches the scheduler from the observer.
- **`tools/testbed/NO_NEW_RUNS`** is the file twin of `[s]`: checked before every run, it lets the running game finish and starts
  nothing further — the tool for a deadline on starting games. Drop it at a set local time with `tools/testbed/no_new_runs_at.ps1
  -At 'yyyy-MM-dd HH:mm'` (launched detached, `-Hidden`; it logs to `no_new_runs_at.log`). **Remove it after the batch**: while it
  exists every schedule refuses to start a run (it says so in `session.log`). Both files are gitignored.
- **Watching live files:** use short reads (a background loop that runs `tail -n 3` and exits each poll). A reader that keeps a
  file open — `tail -F`, an agent Monitor — can block the harness's log writes and lose lines; stopping such a Monitor under Git
  Bash on Windows does not kill the `tail.exe` it spawned. After any stopped watcher, check for a leftover `tail.exe` (L29).

### 5.2 Never edit the build while a batch runs

`run_schedule.ps1` rebuilds the mod before every run, so an edit lands in run 2 and later but not run 1, and the arms silently stop
being comparable. This covers `tools/build.ps1`, `tools/telemetry_lib.ps1` (including a cosmetic `TELEMETRY_VERSION` bump), every
emitter `build.ps1` calls, the configs a setup names, and every file under `tools/testbed/**` — preflight walks the testbed scripts
inside every build (L27), so adding or editing an analysis script mid-batch can fail the next run's build and abort the schedule.
Run `powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -RepoOnly` before committing any such script while a batch plays;
a script that passes it cannot break a build. Queue the rest until `SCHEDULE DONE`, and where a doc must describe the new state in
the meantime, say which session it affects (L10, MANUAL — the `preflight` skill walks it).

### 5.3 Crashes and resumes

The mechanics are engine behaviour (MODDING_NOTES → *Surviving a crash* and *Resuming*); the policy:

- **Detection.** A CTD is a new `crashes\victoria3_*` minidump inside the attempt, never an exit code. An unexplained early exit with
  no minidump waits the 60 s crash grace for a keypress (console only), then is treated as a crash.
- **Before the first autosave.** The run restarts as a **fresh 1836 game**, never with `-continuelastsave` (which would load the
  previous run's endpoint, L34). **Three deaths before the first autosave abort the whole schedule** — at that point the mod under
  test is almost certainly broken.
- **After it: the deterministic resume feeder (L32).** The engine resumes the save its own `continue_game.json` pointer names, not
  the newest file, so on a crash the observer opens a *resume process*: the whole autosave set is quarantined into
  `<run>\resume_set_<n>\`, newest first, and each attempt feeds one member as a copy under the pointer's title; whatever the engine
  writes meanwhile goes to `resume_attempts\` and is never fed. A re-crash within `-ResumeWindowYears` (5) in-game years of the
  process's first crash feeds the next-older original; beyond the window a new process opens. One attempt per member, at most
  `-MaxResumes` (5) per process; an exhausted set abandons the run. `meta.json` carries `resume_processes`.
- **Evidence copies.** A save that a crashed resume loaded is kept in `<run>\quarantined_saves\` and recorded in `meta.json` →
  `quarantined_saves` (reason `loaded by a crashed resume`; F56). The copy is taken at launch, because slot rotation and the
  harvester remove the original within minutes; the folder is invisible to the harvester and to L12. The first crashed resume
  analysed under these hooks should confirm that the folder and the meta record agree (no live proof was recorded when they were
  added). Not to be confused with `quarantine_saves\`, the slowdown quarantine (§7.6).
- **Landing checks.** Each resume's first tick is checked: ahead of the kill point ⇒ a foreign save, at a fresh 1836 ⇒ the load
  failed. Tick lines are trusted only by their own `[HH:MM:SS]` stamp, compared as a signed gap normalised to ±12 h, because for
  ~100 s after a launch the tail serves the previous session's ticks (BUGS_AND_FIXES, the stale-tail resume verdict and its two
  midnight bugs). Post-run, L26 catches a folder holding two campaigns.
- **The resume keeps observer mode** (`continue_game.json` reads `Observing Great Britain`); `-handsoff` does not override
  `-continuelastsave`.
- **A dump date can fire twice** after a resume; the harvest keeps the last emission per (date, tag, good) and reports `re-dumped`.

---

## 6. Deciding between configs

### 6.1 One config per schedule; do not alternate

A decision-driven test — two runs of one config, a decision on a third, then the next config — runs each config's runs back to back
as its own schedule and decides between schedules (ruled 2026-09-13). The only conceivable case for interleaving configs is a long
predetermined batch, and even there no machine-load or time-of-day confounder is recorded for the *economic* readings.

**The wall clock is the exception** (amended 2026-10-21, F248): vanilla on the same game version played ×1.06–1.08 slower per unit
of world in October than in August, so a play time is not comparable across months. Economic readings still pool across months;
a wall-clock comparison needs both arms measured in the same days (§7.3). The alternating batch
`tools/testbed/schedules/alt_vanilla_canon_n16.json` (vanilla and the canon run by run, n=16 each, ~4 days) is the planned re-measurement.

### 6.2 The 2+1 quick config test

Two runs of one config, then
`node tools/testbed/ledger/alignment_check.mjs --arm <session[,session]>:<setup>`, then a third run **only where the two diverge**;
the config is read as the consensus of its intact runs (GLOSSARY §4).

- The divergence test: world GDP and productive workers per capita at 1935, as ratios to the vanilla per-run median, each in five
  bands; a pair diverges on an axis only when the two runs sit in different bands **and** ≥ 0.15 (GDP) / ≥ 0.10 (workers) apart. The
  bands and their calibration are F114; the third run is the norm for this family's seed spread, by choice.
- Exit codes: 0 aligned, 2 divergent (run the third), 3 the run-level stop. The tie-breaker schedule is usually prepared beside the
  pair (`<name>_n2.json` + `<name>_tb.json`).
- **What a config is judged by is the criteria register** (`tools/testbed/ledger/criteria.mjs`; BALANCE_FRAMEWORK §10.83 and
  CLAUDE.md §3.2, including the reading gate on world GDP). The bands only decide whether a third run is owed.

### 6.3 The run-level stop

In a 2+1 batch, **one run broken by a hard line of the register ends the config** — that run is its last, be it run 1, 2 or 3.
The stop watcher (§3.3) enforces it between runs; the fallback (the register unreadable) is a 1936 world GDP above 1.3× vanilla's
median. Never mid-run: a stopped config still leaves a comparable 1836→1936 result. Being far below stops nothing by itself (a stall
is a hard break only below the world-product floor). **Scope: 2+1 batches only.** A fixed-n, full-run or long-sequence batch is not
subject to it — every run plays; do not arm the watcher, and `alignment_check.mjs --stop-above 0` is the "full runs" switch.

The 2026-09-15 capital-abundance flag (`tools/testbed/ledger/capital_flags.mjs`) is superseded as a criterion by the register's
capital-abundance hard line (§10.83); the script stays as a diagnostic printer.

### 6.4 References

- **Economic readings:** `lib_runs.VANILLA_REF` in `tools/testbed/ledger/lib_runs.mjs` — the summer n=18 + the October n=6 = n=24;
  the default of `criteria.mjs`, `fill_ledger.sh` and the other readers. Where a job needs a market only the eleven-tag n=3 vanilla
  carries, say so where the number is quoted (CLAUDE.md, the instrumented-tags section).
- **Wall clock:** `lib_runs.VANILLA_WALL_REF` — the most recent same-harness vanilla (the October six), interim until the alternating
  batch.
- Absolute figures do not travel between sessions; ratios do.

---

## 7. The wall clock

### 7.1 The constraint

Victoria 3 must stay about as fast to play as the base game. **The budget is +10% of total play time over a century against the
same days' vanilla.** It is row **P** of the ledger's verdict table with its own section directly beneath it
(`tools/testbed/ledger/README.md`); P is the median over clusters 1 + 2 (§7.4), read by `fill_build_perf.mjs` from
`wall_clusters.json`, with the +10% line as its yellow edge.

### 7.2 What is graded, and how it is measured

- **The grade is the raw total — what a player waits through** (ruled 2026-08-31). Shrinking what the engine is asked to simulate
  is a legitimate way to meet the budget, not a way of cheating the metric.
- **The total is the century's play time rebuilt from the observer's tick lines** (`tools/testbed/ledger/lib_wall.mjs`, the default
  of `tools/testbed/ledger/report_perf.mjs`; `--wall meta` restores `meta.json`'s `wall_seconds`; `node tools/testbed/ledger/wall_from_ticks.mjs
  <session>` prints the per-run table). `wall_seconds` spans every attempt (a crash-resume adds its grace, reload and replay,
  1.5–2 min per CTD, F110 §9) and a run continued by hand carries only its last launch. The tick lines carry elapsed seconds and the
  in-game date every 20 s per attempt; the crash overhead is printed per arm beside the total; `-PriorWallSeconds` records a
  continuation's earlier play.
- **The pop-matched figure is a diagnostic**, never the grade: seconds per in-game year compared at the same
  `world.pop_objects_live`. It answers whether the engine is dearer per unit of work — useful when the total moves and the cause is
  in question. It is valid only within one `pop_consolidation` game rule, and if the arms overlap in under about a third of the bins
  it cannot be computed for that batch (say so). The total is always answerable. TESTBED_METRICS §7⅜ lists the data sources.
- Intervals spanning a resume are dropped, not smoothed; an archive stamp lags the engine's write by a near-constant margin (fine in
  a rate, wrong as an instant).

### 7.3 The reference and external load

- Compare against **vanilla measured in the same days** (`VANILLA_WALL_REF`, §6.4), never a summer reference for an October run.
- **A slowdown counts unless there is hard evidence of a machine-wide one** (ruled 2026-10-06). The evidence is the machine-load
  monitor (§3.1), read with `node tools/testbed/ledger/machine_load.mjs <session> [--years 5] [--run runNNN_setup]`: game CPU per
  in-game year against the other runs of the same period, other load, P/E-core load, the canary, memory. More game CPU per in-game
  year means the game did more work; more wall at flat CPU means it waited.
- A summary's file time minus its save's stamp is **not** a melt time: in watch mode the harvester holds the newest save until the
  next one exists, so the gap is one autosave interval — the game's own pace — and "the melts slowed with the game" read that way
  is circular (BUGS_AND_FIXES 2026-10-06). Real melt times are the harvest log's in-flight lines.
- F230's war tax on tick time is explanatory only and is never deducted from a wall-clock measurement.

### 7.4 The three run clusters (ruled 2026-10-07)

Only a run whose slowdown is caused by a **listed vanilla bug, directly observed**, leaves the main reading.

| cluster | definition | reported as |
|---|---|---|
| 1 normal | no slowdown episode (§7.6) | count + median play time |
| 2 inexplicably slowed | a slowdown episode and no directly observed listed bug | count + its own median |
| 3 listed bug | during an episode, a save shows a fleet recalled for repairs with **≥ 200 path moves and ≥ 125k distance sailed**, and the loop is gone once the slowdown ends (an episode that runs to the end of the game needs only the loop present in its last year) | count + which bug, no time |

- **The main reading is the median over clusters 1 + 2.** Every cluster is reported in absolute numbers.
  `node tools/testbed/ledger/wall_clusters.mjs <label>=<session>[:<setup>] [...] [--runs] [--json <file>]` applies both rules from
  the tick log and the v16+ summaries and prints the three clusters with the medians (`fill_ledger.sh` runs it with `--json`).
- **The list holds one bug: the fleet path loop** (F218 — a fleet recalled for repairs whose travel path the engine keeps appending
  to). The standard of proof is direct observation of that state in a save.
- **No tick pattern is a criterion** — a sub-tick rising alone for a period can guide an investigation but never classify a run;
  `tools/testbed/ledger/fleet_loop_runs.mjs` and `tick_profile.mjs` are investigation aids.
- A run where the bug was observed stays cluster 3 **whole**, even when most of its excess lies outside the episode (ruled
  2026-10-13).
- A run with no v16 summaries in its episode years is unobservable and stays cluster 2. A kept save from inside an episode (e.g.
  hand copies in `<run>\diag_saves\`) can establish the loop by hand (`node tools/testbed/ledger/fleet_loops.mjs <save.v3>`), but not
  that it ended.
- Why a yearly save is enough: the loop is persistent state that grows ~340 path moves and ~21k distance a year (one German fleet in
  run 4 of `20261006_193418`: 220 → 2,248 moves, 15k → 145k over 1899–1905 — recorded only here), so a loop of material size has
  been visible in ~5 consecutive yearly saves before it costs anything.
- Reference reading: the summer vanilla n=16 splits 9 / 7 / 0 with a main median of 165.0 min (F219 §4; the October six are in
  F248).

### 7.5 Factorised reporting

Beside the clusters, report the wall clock as diverging branches rather than one line (ruled 2026-10-06), so "everything is 10%
slower" is never conflated with "half the runs are 10% faster and half 30% slower": the **normal branch** (Σ each period's median
pace over the arm's runs), the **share of runs with a slowdown episode**, and an **episode's cost in minutes**, each against
vanilla's — `node tools/testbed/ledger/slow_episodes.mjs <label>=<session>[,<session>][:<setup>] ... [--ref <label>]`.

### 7.6 The slowdown quarantine

Non-agentic: the harvester keeps the saves around each slowdown so they can later be loaded in debug mode, where the game shows each
subtask's tick time in milliseconds (MODDING_NOTES → *Debugging & validation*) — the investigation tool for cluster 2. The judge is
`tools/testbed/slow_quarantine.mjs`, called by `harvest_saves.ps1` before every reap; its header holds the full rule and constants.

- **The measure:** t(Y), wall seconds per in-game year from the per-tick log, month-boundary ticks dropped, years with too few usable
  ticks skipped; differences are growth-adjusted by the corpus's expected yearly growth.
- **An episode** starts at the first year X where t(X) exceeds t(X−L) by more than 3σ_L at X, X+1 and X+2, for a lag L tried in the
  order 3, 6, 10 (σ 0.092 / 0.102 / 0.109 ⇒ lines of +32% / +36% / +39%). Three lags because a fleet loop's cost ramps a few percent
  a year for a decade and never gains +32% within three years. Missed by design: two-year bursts and slowness spread thinly over a
  whole run.
- **It ends** when t falls back within +15% (2σ1) of the pre-episode speed (median of X−L−2 … X−L, growth-projected); an episode
  that never recovers runs to the end of the game.
- **Kept per episode:** the save of year X−L (`before`), the first four years (`in1`–`in4`), the last (`last`) and the two years after
  (`after1`, `after2`, unless the game ended), moved to `<run>\quarantine_saves\` as
  `<session>__<run>__<YYYY-MM-DD>__ep<N>_<role>.v3`, with `MANIFEST.md` (each episode, the speeds through it, every kept file and
  what to compare with what) and `<run>\slow_periods.json`.
- **Decisions:** `keep` / `release` (reaped) / `wait`. A save of year Y is judged once year Y + 12 is complete (~13 saves, ~650 MB
  unjudged at any time); the post-run drain passes `--final`; a judge failure reaps nothing. `harvest_saves.ps1 -NoQuarantine`
  restores immediate reaping.

### 7.7 What a wall-clock report contains

Per arm, against the same days' vanilla: the main median (clusters 1 + 2) and its ratio to the budget line; the cluster counts and
the cluster 1 and cluster 2 medians; the cluster-3 count and its bug; the factorised branches; the crash overhead; the pop-matched
diagnostic where it is computable; and any machine-load evidence used to set a run aside.

---

## 8. After a batch

### 8.1 Harvest and post-run checks

- The save harvest runs concurrently and a final synchronous drain follows every run; a dead watcher costs time, nothing else.
  Once a save is reaped **its summary is the record** (everywhere else the raw log is the record and summaries are caches), so the
  harvester verifies each summary before deleting its save and keeps each run's newest save permanently (L12). Details: TESTBED_METRICS §7½.
- Walk the post-run landmines: `powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -Session tools\testbed\sessions\<stamp>`
  (L12 reaped saves, L17 failed runs recorded `ok`, L26 two campaigns in one folder, L28 mirror re-copies, L29 lost session-log
  lines, L32 failed loads, L33 rejected or dead defines, L34 runs complete in minutes, L38 dropped country records).
- `session.json`'s `status: ok` is derived from the observer's exit code and is not evidence that a run completed.

### 8.2 Which runs count

- **Usable** = a run that reached its own `until` date with no `abandoned_reason` and is not an L34 stub;
  `tools/testbed/ledger/lib_runs.mjs` `usableRuns()` is the only definition, and every exclusion is printed with its reason.
- **Run counts in a session's name are not evidence; the run logs are.** Verdict-writing has found batches named n=3 holding n=2.
- A group of runs may be pooled across sessions only within one config family (the same tier/building structure;
  `lib_runs.configFamilies`); `fill_ledger.sh` stops on more than one family.
- The standard report is the ledger: `bash tools/testbed/ledger/fill_ledger.sh <session> <setup> <book> <outName>` and the fill
  procedure in `tools/testbed/ledger/README.md`.
- After each arm's FIRST run, before the batch completes, report the first-run decomposition — GDP = population × productive workers
  per capita × GDP per productive worker, world and pool, beside vanilla's median (`tools/testbed/ledger/first_run_decomp.mjs`).

### 8.3 Every session gets a `VERDICT.md` — the deadline is the handover

Every session that ran gets `tools/testbed/sessions/<stamp>/VERDICT.md`, sound ones included: their numbers are what later readers
compare against, and "sound" is itself a finding. The moment cannot be pinned to the end of the run (a verdict often needs the user's
ruling on what is void or confounded), so the rule is: **no handover may be written while a session from this session's work lacks a
verdict.** Check it mechanically as the last step before the handover:

```bash
for d in tools/testbed/sessions/*/; do b=$(basename "$d"); [ "${b:0:8}" -ge 20260812 ] 2>/dev/null && { [ -f "$d/VERDICT.md" ] || echo "MISSING VERDICT: $b"; }; done
```

The glob starts at 2026-08-12 on purpose: the convention began that day and 77 earlier sessions have none; widen it only to write a
retrospective verdict deliberately.

**Then add a one-line row to the committed `tools/testbed/SESSION_VERDICTS.md`** (status + the correction). The session folder and
its verdict are gitignored and not backed up; the row is the half that survives.

**What a verdict contains:**

- What is void, what still reads, and how far — distinguishing the measured quantity from the proposed cause (the numbers usually
  outlive the first explanation).
- For a defect: what it did and by what mechanism, not just its name ("military technology gated on conditions true far too often,
  so it was shared free and fast", not "the military channel was ungated"), and its knock-ons through the rest of the system, listed
  even when they cannot be measured — an unlisted confound reads as an absent one. Say which channels a control is actually
  independent of.
- The trajectory, not only the endpoint: whether a leader plateaued or the century merely ended, when milestones moved, whether the
  runs of one arm agree.
- A verdict written retrospectively, from documents rather than live analysis, says so at the top.

### 8.4 Record the batch in FINDINGS.md

After a batch, append or update a finding: the claim and its effect size; arms, n per arm, span and dates; the actual numbers
(tables copied in full — a finding must outlive its raw data, its config and the game version); the session folder(s) and arm(s);
the confidence; and an explicit **"what it does NOT say"**, including stated confounds and unmeasured questions. Check the next
F-number at the moment of writing (a peer session may have taken it), and commit with explicit paths.

### 8.5 Sessions are never deleted

Everything under `tools/testbed/sessions/` is permanent, obsolete sessions included. It is gitignored because it is bulky, not
because it is disposable — and therefore it is **not backed up**: deleted results are on no branch and in no reflog. A session is a
historical observation (a game version, a config that may no longer exist, a set of RNG playthroughs), and re-running never
reproduces it. Do not delete one during a cleanup, a refactor or a results-root consolidation (one such consolidation destroyed the
raw data of the F1/F2 tiering-vs-vanilla batch). If disk becomes a real problem, ask the user and propose archiving — zip the
session, or drop only `logs/`, `logs_live/` and `_settings_backup/` while keeping `markets_all.tsv`, `events.tsv`, `meta.json`,
`build_state.json`, `schedule.json` and the save summaries.

### 8.6 The session folder

| path | what |
|---|---|
| `schedule.json` | the plan, verbatim |
| `session.json`, `session.log` | what ran with status (not evidence of completion), the driver's log |
| `markets_all.tsv` | all runs' market rows, each prefixed `run_index` + `setup` — the cross-run aggregate |
| `machine_load.tsv` (+ `.log`) | the machine-load monitor |
| `stop_watch.log` | the stop watcher, when armed |
| `VERDICT.md`, `STITCHED.md` | written by us; a stitched session's provenance |
| `runNNN_<setup>/` | one flat folder per run (no `runNN/` level, no per-run aggregate) |
| … `build.log`, `build_state.json`, `telemetry.json` | the build, what was under test, the telemetry spec |
| … `run.log`, `harness.log`, `meta.json` | the observer's tick log, its harness log, the run record (`reached_ingame_date`, `abandoned_reason`, `attempt_log`, `resume_processes`, `quarantined_saves`) |
| … `markets.tsv`, `events.tsv` | the run's harvested telemetry |
| … `logs_live/` | continuous mirrors of `debug.log`, `error.log`, `dedicated_server.log` — authoritative; `logs/` is the exit-time snapshot and can hold another run's files |
| … `saves/`, `save_summaries/` | archived autosaves (the newest kept), the yearly summaries (+ `save_provenance.json`) |
| … `quarantine_saves/`, `slow_periods.json` | the slowdown quarantine (§7.6) |
| … `quarantined_saves/`, `resume_set_<n>/`, `resume_attempts/` | crash-resume evidence and the resume feeder's sets (§5.3) |
| … `continuation.json`, `criteria.json`, `STOP_RULE.txt`, `diag_saves/` | a continuation's parent; the stop watcher's register read and reason; hand-copied saves |

---

## 9. Changing the harness itself

- **Never during a batch** (§5.2).
- **A new defect where nothing fails goes into the landmine register**: the entry in TESTBED_LANDMINES.md first (ID, story, numbers,
  fix), then `Test-Lm<ID>` in `tools/preflight.ps1` reading the emitted artifact, then **prove the tripwire trips** by breaking the
  thing on purpose (TESTBED_LANDMINES → *Adding a landmine*). A comment beside the code is not a guardrail, and a hand pass is not
  equivalent to a detector. Preflight runs inside every `build.ps1` (canonical, `-SaveTo`, `-DryRun`, and before the control arm's
  early exit) and in `run_schedule.ps1` before the first run; `-NoPreflight` is for a broken detector, not a hurry. The `preflight`
  skill walks the two MANUAL entries (L3, L10).
- **Telemetry:** read TESTBED_METRICS.md first. Any change to the emitted telemetry needs a `TELEMETRY_VERSION` bump or an explicit
  fingerprint update (`preflight.ps1 -UpdateFingerprint`, L8); every spec key must be threaded through the scheduler (L5); a metric
  name must match something (L36).
- **The log tail:** after any change to how the observer tails the log ring, run `tools/testbed/test_log_tail.ps1` (L28).
- **Harness log writers must never throw** — a reader holding a file open must not be able to kill a run (L29).
