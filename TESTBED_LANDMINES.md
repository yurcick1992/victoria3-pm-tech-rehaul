# TESTBED LANDMINES — the register the build walks on every change

**What a landmine is, here:** a defect where **nothing fails**. The build succeeds, the mod loads,
the run completes, the TSV has rows in it — and the damage is real and invisible. Half a million
error lines. A metric reading zero instead of erroring. A burst that evicts its own data from the
log ring. A key that never arrives, so the run looks like the *metric* failed rather than the
plumbing.

These do not get caught by the linters (which check economics), by `Invoke-ModChecks` (which checks
completeness), or by reading `error.log` (which nobody reads, because it is expected to carry
vanilla's noise). They get caught by someone happening to look, months later, usually while
investigating something else.

**So they are enumerated here and enforced by `tools/preflight.ps1`, which runs inside the build and
throws.** Every entry has an ID; every automated entry's ID is the name of a function in that script.

---

## How this is enforced

```
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1                 # walk them against mod\
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -Mod mod_foo    # against an alt build
powershell -ExecutionPolicy Bypass -File tools\preflight.ps1 -UpdateFingerprint
```

It runs **automatically**, and throws on any FAIL:

| Chokepoint | When | Why there |
|---|---|---|
| `tools/build.ps1` | end of **every** build, canonical / `-SaveTo` / `-DryRun` | any change to the mod, in the broad sense, passes through here |
| `tools/build.ps1`, control-arm path | before its **early exit** | the control arm exits before the bottom of the script — a check only at the end would never see the one arm whose whole promise is "carries nothing" |
| `tools/testbed/run_schedule.ps1` | before the first run of a batch | game time is the expensive thing; a landmine found after 8 h of campaign is found too late |

`-NoPreflight` exists **for a broken detector, not for a hurry.**

**It checks the ARTIFACT, not the intent.** Every detector reads the files the build emitted, never
the generator that produced them or the flags it was handed — the same principle as
`verify_pms.mjs` re-reading `common/production_methods` rather than our own extract. A generator bug
cannot hide behind a checker that only reads the generator.

---

## The register

Status column: **AUTO** = `preflight.ps1` decides it. **ADVISORY** = it warns, a human judges.
**MANUAL** = no detector is possible; the `preflight` skill walks it. **OPEN** = known live, not yet
closed.

| ID | Landmine | Status |
|---|---|---|
| L1 | A named country tag with no existence guard | AUTO |
| L2 | A data function written as script | AUTO |
| L3 | A scope that is bounded today and unbounded in 1900 | MANUAL |
| L4 | Two heavy sweeps in one tick | ADVISORY |
| L5 | A telemetry spec key the scheduler never passes on | AUTO |
| L6 | Telemetry reads a script value nothing defines | AUTO |
| L7 | A control arm carrying gameplay content | AUTO |
| L8 | The emitted telemetry changed and the schema version did not | AUTO |
| L9 | Reading the shared log ring without filtering by the run's own identity | AUTO (regression) + OPEN |
| L10 | Editing the generator while a batch is running | MANUAL |
| L11 | A named tag that is not the country you think it is | **PROPOSED — AUTO, detector not yet written** |
| L12 | Savegames reaped without a readable summary | AUTO (post-run, `-Session`) |
| L13 | A starting factory converted onto a tier its own production method contradicts | **MASKED, not fixed — detector not yet written** |
| L14 | A country starts with a building its own technologies cannot unlock | AUTO |
| L15 | A country LOSES a starting technology vanilla gives it | AUTO |
| L16 | A schedule key honoured in `defaults` for some fields and silently dropped for others | AUTO |
| L17 | A run that FAILED is recorded as `ok`, and the arm count silently shrinks | AUTO (post-run, `-Session`) |
| L18 | A tier that cannot break even at ANY price the engine can produce | AUTO |
| L19 | An orphaned game process makes the next run fail instantly and silently | **REGISTERED, DETECTOR OWED** |
| L20 | An alternate config with no paired `tech_tree_options.<sfx>.json` | AUTO |
| L21 | A failed build hangs the scheduler instead of aborting it | AUTO (bounded build + fail-aware waiter) |
| L22 | A mod `effect` block silently replacing a vanilla on_action's | AUTO |
| L23 | A telemetry line counted RAW when a burst repeats it | **REGISTERED, DETECTOR OWED** |

---

### L13 — a starting factory converted onto a tier its own production method contradicts · PROPOSED (AUTO)

**The failure.** The 1836 start converter maps each vanilla factory onto one of our tiers by reading the
main production method it runs. When the mapping silently fails, the factory does **not** disappear and
is **not** reported — it passes through carrying the vanilla building key, which some tier still owns, so
it lands on that tier regardless of what it was running.

Everything downstream looks healthy. The build succeeds, both linters pass, `Invoke-ModChecks` passes
(its test is that `create_building` blocks are *present*, which they are), the history files are the
right size, and `start_baseline.json`'s **`unmapped` list — the drift alarm built for exactly this
class — reads 0**, because a factory whose base key is absent from the map is never examined at all
rather than being examined and failing.

**Found live, 2026-08-12, at 30%.** `Get-SplitMaps` (`tools/history_lib.ps1:61`) keys the base-building
map on the **first** tier. That held while tier 1 was the vanilla building; the era ladder then minted
non-`model_only` **e0 rungs** for nine industries, so slot 0 became an invented key and the vanilla one
it displaced went invisible. **98 of 327 starting factories** were emitted on era 1 against their own
methods — textile 21, tooling 25 (nine of them a **two-era** demotion), furniture 18, glass 12, food 12,
paper 10. Vanilla and converted `create_building` counts were **identical** for all nine industries,
which is what proves no conversion ran. Full root cause and the fix in `ROADMAP.md` → *Deferred fixes*.

**The detector.** Walk the **emitted** history against vanilla's: for every `create_building`, read its
active main production method, look up the tier that method belongs to, and fail if the emitted building
key is not that tier's. It reads the artifact, never the generator — the same rule as `verify_pms.mjs`,
and the reason a check on the mapping code would not have caught this one. A second, cheaper assertion
is worth having beside it: **no vanilla base building key may survive into the emitted history unless a
tier legitimately owns it**, and `unmapped` must account for every factory the map declined.

⚠⚠ **CURRENTLY MASKED, NOT FIXED (2026-08-12).** The re-band dropped the seven invented ~1700 rungs, so
the vanilla building key is back in slot 0 and conversion works again — the 1836 start now genuinely
re-tiers, and block counts and ownership levels match vanilla exactly (2954 and 8224). **But
`Get-SplitMaps` still keys on `tiers[0]`**, so the day anyone mints a new first rung for an industry it
breaks again, silently and at the same scale. The detector below is still worth writing for exactly that
reason; the fix is one line and the guard is what makes it stay fixed.
⭐ **And it was hiding L14.** While conversion was broken, the mis-tiered workshops sat on a rung nothing
gated, so the starting-technology fault below was invisible. Fixing one landmine exposed another.

---

### L14 — a country starts with a building its own technologies cannot unlock · AUTO

**The failure.** The build succeeds, the mod loads, the game runs, and a great power simply owns a
factory it could never have constructed. Nothing errors: the engine places what history tells it to
place and never audits that against the country's technology set. The economy then comes out different
from vanilla's for a reason no log mentions — and the countries it bites are the ones whose 1836
industry matters most.

**Found live, 2026-08-12, and only because an unrelated bug was fixed first.** While the converter
silently failed to re-tier the 1836 start (**L13**), vanilla's steel-tooling workshops stayed on the base
rung and nothing was gated wrongly. The moment conversion started working, **five great powers — BEL,
FRA, GBR, PRU, USA — owned a tooling workshop gated on `steel_toolmaking`**, an 1865 technology of ours
that had replaced vanilla's `mechanical_tools` gate. 16 of the map's 35 tooling workshops run that
method in vanilla, and vanilla can run them because `mechanical_tools` sits in its own named grant.
⇒ **One landmine was hiding another.** Fixing L13 is what made L14 visible, which is the argument for
detectors over inspection: nobody would have gone looking.

**The fix that shipped** was to name `steel_toolmaking` in our own starting grant, tiers 1 and 2, exactly
as vanilla names the three technologies its own 1836 map needs (`central_archives`, `mechanical_tools`,
`intensive_agriculture`).

**The detector.** `tools/verify_start_techs.mjs --vs-vanilla`, over the EMITTED history — ours is the
only history the engine reads, via `replace_paths`. It resolves each building's and each production
method's `unlocking_technologies` against vanilla plus our owned files, expands
`add_era_researched` (which is most of the grant), and reports **per country**.

⭐⭐ **THE GATE BINDS EVERY BUILDING, WHOEVER OWNS IT** (re-established 2026-08-17, **FINDINGS F68**).
The engine checks a history `create_building` against the **region_state's own country**;
`add_ownership` is not consulted. Its own words, at world init:

```
Error: create_building effect [ … Dutch East Indies … must have invented … The Screw Steamer … ]
Script location: common/history/buildings/12_indonesia.txt:683
```

⚠⚠ **THIS ENTRY IS THE CASE STUDY FOR THE WHOLE REGISTER: THE DETECTOR WAS SWITCHED OFF AND 22 BROKEN
START RULES SHIPPED GREEN.** A "refinement" of 2026-08-16 night (§10.60.3 Q5a) made L14 SKIP any
building owned entirely by foreign countries, on the theory that it rides its owners' technology. It
was wrong, and it failed **twice over**:

1. **Its evidence was a snapshot taken a year late.** *"the engine provisions steam ports into subject
   states whose owners lack the tech (measured: SIL held one by 1837.1)"* — read at **1837.1.1**, so
   what it saw was **F66's engine provisioning wave** building that port over the intervening year, not
   our `create_building` succeeding. Re-measured at **1836.2.1 over 10 runs**: every subject-state stub
   rejected, **110 error lines, 22 locations, identical in all ten**.
2. **Its second leg was true but inert.** Vanilla does ship foreign-owned ports (GBR's in SIL's
   Senegal) — but they are t0 `building_port` gated on `navigation`, which every country holds, so
   vanilla never creates the conflict that would test the rule.

⚠⚠ **AND A SECOND BUG IN THE SAME FILE HID IT EVEN AFTER THE SKIP WAS REMOVED.** `analyse()` counted
`add_technology_researched` lines sitting inside a per-country guard —
`if = { limit = { this = c:NET } … }`, exactly how `emit_techs.mjs` writes `start_tech_grants` — as
though **every** country of that tier held them. Our NET-only `screw_frigate` grant was therefore
credited to all 60-odd tier-2 countries, so DEI, SMB, TID and PON looked entitled to steam ports they
cannot build. `startSets()` (L15's path) had already solved this and its own comment warned that
over-reporting holdings *"is a detector that passes the very failure L14 is for"* — correctly, about
the function beside it. **Both landmines now read `startSets()`**: one definition of what a country
starts with. That also removed three standing false positives (vanilla-inherited gaps **6 → 3**),
because the old path ignored the per-country extras 81 countries carry.

**Tripwire re-proved by sabotage, 2026-08-17.** Injecting one NET-owned `port_steam` into DEI's
territory in a copy of the emitted mod makes the check **exit 1** and print
`DEI (tier 2, 46 buildings): screw_frigate`; the real build exits 0. ⚠ It failed this same test
*before* the `startSets()` fix — passing a mod carrying the exact defect — which is why "removed the
skip" was not the end of the work.

⚠ **Do not re-introduce an ownership exemption without a reading taken at 1836.2.1.** A late snapshot
cannot tell "never created" from "created, then supplied by the engine anyway", and those demand
opposite fixes.

⚠ **IT COMPARES AGAINST VANILLA RATHER THAN DEMANDING ZERO.** Vanilla itself fails on three countries, so
an absolute pass is unreachable and a build demanding one could never go green. What we hold ourselves to
is introducing **no new** gap — the real requirement, and computable because the same analysis runs
unchanged against the game's own directory.

⚠ **Three ways this check reported a false answer before it worked**, all worth knowing because they are
the generic traps of this kind of detector:
- **It passed vacuously.** Wrong tag regexes for these file shapes matched zero countries and it printed
  PASSED. Hence `assertNonTrivial()`, which refuses to report success unless it found countries,
  buildings and starting sets. **A check that cannot fail is worse than no check.**
- **It failed spuriously on 24 countries.** The starting sets grant most of their content through
  `add_era_researched = era_1`, not by naming technologies, so reading only `add_technology_researched`
  made Britain and France look as though they lacked `manufacturies`.
- **It lost its own error message.** The detector called node with `2>&1`, and PowerShell 5.1 wraps a
  native executable's stderr lines in ErrorRecords — so a real FAIL reported `(detector error)` and named
  nobody. The tool now writes its verdict to **stdout** and signals only through the exit code.

**Tripwire proven** by deleting the two grant lines from the emitted file: preflight went
`L14 FAIL … PREFLIGHT FAILED: 1 landmine(s) live`, naming GBR, FRA and BEL. Restored, it passes.

---

### L12 — savegames reaped without a readable summary · AUTO (post-run)

**The failure.** The savegame instrument (ROADMAP step 3½, built 2026-08-11) archives every autosave,
melts it, writes one summary JSON, and then **deletes the save**. That inverts the rule the rest of the
repo runs on — *"the summary is a CACHE; the raw log is the record"*, which is exactly what makes
compressing raw logs safe. Here **the summary IS the record.** A save deleted without a readable summary
beside it is evidence that exists nowhere else, and re-running does not recover it: a different seed is
a different world, and after a patch a different game.

**Why nothing fails.** Every other signal stays green. The batch completes, `session.json` reports every
run finished, `markets_all.tsv` is full, the mod loaded, `error.log` is quiet — and the disk is
pleasantly empty, which is precisely the symptom read as success. Nothing anywhere announces that run 4
put 100 saves through a reader that crashed on all of them, or that a worker died mid-write and left
`.partial` files that look like summaries to anything that counts rather than reads.

**The design that makes it survivable, and which the detector checks is actually in force:**
1. `harvest_saves.ps1` writes to a temp name, **verifies the artifact** (gunzips, parses, requires a
   `save_summary_version`, a `provenance.date` and ≥10 countries), and only then renames it into place;
2. **only then** is the `.v3` deleted — a failed save is never reaped, so it stays as the only remaining
   copy of its own evidence, with a `.err` beside it;
3. the **newest save of every run is kept permanently** (user-agreed) as the escape hatch for questions
   the schema did not anticipate. ~57 MB per run against ~4 GB for the run's full set.

**Detector — `Test-LmL12`, run with `-Session <dir>`.** For every run folder holding `saves\`: require a
`save_summaries\` beside it; require it non-empty; **read one** and require a `save_summary_version`
(a directory of zero-byte files counts perfectly well); reject leftover `.partial.json.gz`; report any
`.err`; and require at least one `.v3` still kept. It reports **N/A** when no `-Session` is given, so it
costs a build nothing — this is the register's one post-run entry.

⚠ **Proved by breaking it** (2026-08-11), on both shapes: `save_summaries\` renamed away ⇒ FAIL; every
save reaped with none kept ⇒ FAIL *"the escape hatch is gone"*; restored ⇒ PASS; no `-Session` ⇒ N/A.

⚠ **Two bugs found while building the harvester, both of which produce this landmine's exact
signature** and are why the verify-before-reap order is not optional. `Start-Process -ArgumentList`
quotes nothing, and the repo path contains a space, so every worker was handed
`C:\claude-code\victoria` as its script and exited 1. And a local `$out` inside a function **is** the
script's `$Out` parameter — PowerShell variable names are case-insensitive — so the first launch rewrote
the output directory to a per-save path. Under a reap-first design either one would have deleted a
century of saves and left an empty folder.

---

### L11 — a named tag that is not the country you think it is · PROPOSED (AUTO)

**The failure.** A metric names countries by three-letter tag. A tag that resolves to **no** country
errors every tick and silently covers nothing; a tag that resolves to a **different** country covers
the wrong thing and looks entirely healthy. Neither shows up as a failure: the sweep runs, rows appear
for the tags that do resolve, and the missing country is simply never in the output.

**Found 2026-08-06, in `market_goods_wide`'s 50-tag list — two of the fifty are wrong:**

| tag in the list | what it actually is | intended |
|---|---|---|
| **`QIN`** | **not a country at all** — no definition exists | the Qing, which is **`CHI`** |
| **`COL`** | **British Columbia** (`capital = STATE_BRITISH_COLUMBIA`) | Colombia, which is **`CLM`** |

⚠ **The Qing is the largest economy in the game, and the wide sweep has never covered it.** That sweep
exists to answer *"did anyone, anywhere, produce this good first?"* — so **FINDINGS F33's "first
telephone production ANYWHERE (50-market sweep) = 1920.9, British Market" is weaker than it reads**: it
is first among the 48 tags that resolved, China not among them. The other 194 error lines per campaign
(L1's residual) are all `Failed to find country! Country: QIN` — not an annexation, a tag that never
existed.

**Detector (straightforward, not yet written).** Every `c:TAG` in the emitted telemetry must match a
country defined in `common/country_definitions/*.txt`. That catches `QIN` outright. It cannot catch
`COL`, because British Columbia is a perfectly real country — **only a human comparing intent against
`capital = STATE_…` catches that one**, which is why the entry also asks that any tag list carry a
comment naming what each unobvious tag is.

**How it happened, twice in one hour.** A three-letter tag was *assumed* to name a country without
being checked — first by the agent, asserting `DNK` was Denmark in a comparison of small nations (it is
an African minor owning `STATE_EQUATORIA`; Denmark is `DEN` and owns **eight** states including
Greenland, Iceland, the West Indies, the Gold Coast, Madras and Pegu), then discovered in the shipped
tag list. **Resolve a tag against the game files before believing it**, exactly as with everything else
here.

---

### L1 — a named country tag with no existence guard · AUTO

`c:TAG` on a country that no longer exists does **not** evaluate to false in Jomini; it raises
`Invalid right side during comparison 'c'`. Tags valid at 1836 are routinely gone by 1900 — annexed,
or formed into a successor — so any metric that names countries starts erroring partway through a
campaign and never stops. Because these filters sit inside `every_market`, the whole `OR` is
re-evaluated once per market: cost is *dead tags × markets × dump dates*.

**Measured:** 574 455 `error.log` lines over one campaign, **48 659 naming our own telemetry file**
(2026-08-06). Story and evidence: `BUGS_AND_FIXES.md`; the rule: `TESTBED_METRICS.md`.

**Fix idiom — one function, `Get-GuardedOwnerLimit` in `telemetry_lib.ps1`:**
```
limit = { OR = { AND = { exists = c:GBR owner = c:GBR }  AND = { exists = c:FRA owner = c:FRA } } }
```
or filter on a **property** instead of on identity. Entering a named country's scope takes
`Get-GuardedCountryBlock` (`if = { limit = { exists = c:X }  c:X = { … } }`).

**Detector:** brace-depth scan of the emitted `on_actions` / `events` files. A tag *use* is legal
only if `exists = c:<that same tag>` was asserted in its own block or an enclosing one.

⚠ **It does not judge tags inside loc strings** (`[c:GBR.market_capital…]` in a `debug_log`). Those
are data functions resolved by a different subsystem, which fails differently — a loc-string data
error, not a comparison error. Whether *that* also floods is **unmeasured**; the count is printed
each run so it stays visible rather than forgotten.

**✅ MEASURED 2026-08-06 — the guard removes 99.6%, and the residual is irreducible while tags are
named at all.** First guarded campaign (`20260806_110926_vanilla-retest-2` run 1, control arm, to
in-game 1882), counting only lines stamped inside the run's own window (L9):

| our error, in-window | before | after |
|---|--:|--:|
| `Invalid right side during comparison 'c'` | 48 659 | **0** |
| `Failed to find country! Country: QIN` (`eventtargetlinks.cpp`) | — | **194** |

⚠ **`exists = c:X` does not silence everything, and cannot.** The residual comes from
`eventtargetlinks.cpp`, i.e. **resolving** the scope link — which `exists` must do in order to test
it. So the guard removes the *comparison* error and leaves the *resolution* notice. 194 lines over 46
in-game years is ~4/year against 48 659, so this is a rounding error rather than a flood, but it means
**"anything naming our telemetry should be zero" is not reachable by guarding**; only by not naming
tags. Read the detection rule as *zero comparison errors*, and treat a `Failed to find country` count
that grows beyond a few hundred as the signal instead.

⚠ **Stated assumption, not proof:** guarding is treated as behaviour-preserving because the evidence
says the metric emitted correct lines for every country that did exist, i.e. the errored sub-trigger
was already behaving as false. It has not been separately verified that an errored comparison inside
an `OR` never evaluated *true*.

**History:** found at 6 sites, fixed, and the detector immediately found **13 more** — including a
`this = c:TAG` form nobody had considered. That gap between "I fixed it" and "it is fixed" is the
whole argument for the checker.

---

### L2 — a data function written as script · AUTO

Data functions (`GetGoods('grain')`, `THIS.GetCountry.GetGDP`) live **only** inside the quoted text
of a `debug_log`. Written as script they are a parse error, and Paradox **abandons the file from the
error onward** — so one bad `limit = { is_goods = GetGoods('grain') }` silently took all three dumps
defined below it, and that run harvested nothing.

**Detector:** `Test-TelemetryScript` in `telemetry_lib.ps1` — strip every quoted string, then require
what remains to contain no `Something(` and no `[`. It already ran on the generated text at build
time; preflight runs **the same one implementation** over the emitted files, which is the check that
survives someone bypassing the generator.

---

### L3 — a scope that is bounded today and unbounded in 1900 · MANUAL

`market = c:BEL.market` was never wrong — it was **unbounded**. Which market a country belongs to
*changes*: by 1850 Belgium had joined the British market, so a per-pop sweep verified cheap at 1836
(178 pops, 3 states) tried to emit **20 686** lines and only **5 212** survived the ring. Every
surviving line was individually valid, which is what made it dangerous — the data was a 75 % subset
chosen by ring position, and therefore biased in an unknown direction.

**No detector is possible.** How many markets a scope covers in 1900 is a property of the campaign,
not of the script. **Size it at the END date of the run, not at 1836**, with an untruncatable script
value rather than by counting the sweep's own lines. See `BUGS_AND_FIXES.md`.

---

### L4 — two heavy sweeps in one tick · ADVISORY

The game's log is a **5 × 512 KB ring shared by every run**. One unphased dump was ~1.96 MB — 78 % of
the whole ring — so segments rotated away before any poll could read them (**6 015 telemetry lines
lost**, measured). **No poll rate fixes this**: you cannot read a ring faster than it is destroyed.
Phasing exists to spread the burst, and stacking two heavy blocks on one date reintroduces it
(origins on phase 0 with market goods: **5 980 of ~6 000 lines lost**).

**Detector is advisory by necessity** — how many lines a sweep produces depends on how many markets
exist at that date, which is not knowable at build time. It counts **nested iterations**, the shape
that multiplies, per trigger date, and warns when a date carries more than one. A WARN is a prompt to
check the phasing, not a verdict.

---

### L5 — a telemetry spec key the scheduler never passes on · AUTO

`run_schedule.ps1` rebuilds each run's spec from an **explicit key list**. A key read by
`Read-TelemetrySpec` but missing from that list is silently dropped: it reaches neither the builder
nor the mod, the metric falls back to its default, and the run looks like the *metric* failed.

**Cost so far:** a probe run on 2026-08-05 (`breakdown_dates`, `breakdown_tags`, `wide_dates`,
`wide_tags` all emitted nothing), and then `origin_goods` — found by this detector on 2026-08-06,
requested by three schedules and threaded through nowhere. Session
`20260801_225108_paper-be20-n3` asked for `paper, wood, sulfur, dye, tools, steel, clothes, silk,
tea, coal`; its own `run001_paper/telemetry.json` carries `origins` in `metrics` and **no
`origin_goods` at all**, so it measured the hardcoded default instead — **wood, sulfur and dye were
never instrumented**, and `glass, iron, opium` were logged unasked. The other two schedules happened
to request exactly the default list, so they were unharmed by coincidence.

⚠ **A warning comment was already sitting on that key list**, added after the 2026-08-05 loss, and
`origin_goods` still slipped past it. That is the entire case for enforcement over documentation.

**Detector:** every key `Read-TelemetrySpec` consumes must appear somewhere in `run_schedule.ps1`.
Deliberately a mention test rather than a parse of its two hand-maintained lists — the lists move,
and a key that appears **nowhere** in the scheduler is unambiguously dropped.

---

### L6 — telemetry reads a script value nothing defines · AUTO

An undefined `ScriptValue` does not error. **It reads zero.** A run logged standard of living = 0 for
every one of ~285 countries, with the urban-centre figures on the *same line* correct, because
`v3tb_solw_*` lived in the probe values file and that file is only emitted when a probe metric asks
for it. No `error.log` line, no data-error line, nothing to notice.

**Detector:** every `v3tb_*` name the emitted telemetry reads must be defined in an emitted
`common/script_values` file. Only our own names are judged — vanilla's are not ours to account for.

---

### L7 — a control arm carrying gameplay content · AUTO

`CLAUDE.md`, hard rule: **the only thing a control may vary is its telemetry.** Not one file, not one
field. A reader who sees `{kind: control}` in a schedule must be able to assume vanilla without
opening the build. A whole day of measurement (2026-08-05, findings F32/F33) was lost to running the
wrong arm.

**Detector:** identify the arm by the **mod's own metadata id**, read off the built mod so it cannot
disagree with what loaded, then require every emitted path to be one of `.metadata`,
`common/on_actions`, `common/script_values`, `events`. Anything else fails **by name**.

✅ **The architectural fix landed the same day** (see `CLAUDE.md` → the three arms): `-ControlOnly`
now **throws** if handed a config carrying gameplay content, and the overlay arm — vanilla +
telemetry + one *declared* change — is its own flag with its own mod id
(`com.yurcick.v3_testbed_overlay`).

⚠ **Which means L7 keys on honesty, and that is deliberate.** The detector only applies to a mod
claiming the control id, so an overlay that lied about being a control would trip it, and one that
says what it is passes for the right reason. The guard and the naming hold each other up; neither
alone is sufficient, and a future arm that carries content while borrowing the control id is exactly
what this catches.

---

### L8 — the emitted telemetry changed and the schema version did not · AUTO

A finding cites the schema version it was measured under, and that citation has to keep meaning the
same thing forever. `TELEMETRY_VERSION` is bumped **by hand**, which means it is forgotten by hand:
nothing noticed that the emitted script changed while the number stayed put, and the cost lands
months later on whoever compares two sessions that were never comparable.

**Detector:** hash the **canonical telemetry** — every metric the library knows turned on, dates,
tags, token and build stamp all pinned — and store it beside the version in
`tools/telemetry_fingerprint.json`. If the hash moved and the version did not, **fail**.

The metric list is read out of the library's own source, not hardcoded, so a metric added tomorrow is
fingerprinted tomorrow without anyone remembering to add it here.

**This is the entry that makes the guardrail bite on "any change, including telemetry"** rather than
only on the changes someone thought to check. It is not a judgement about whether the change *was*
breaking — the script cannot know that. It is a forced decision point:

- the change **is** breaking → bump `$script:TELEMETRY_VERSION`, record it in the `TESTBED_METRICS.md`
  table and tag the affected findings, then `-UpdateFingerprint`;
- the change is **not** breaking → `-UpdateFingerprint`, and say so in the commit.

*(Worked example: the L1 guards changed the emitted script text and not the emitted data — dead tags
produced no lines before and produce no lines now — so the fingerprint was refreshed at v12 rather
than bumped.)*

---

### L9 — reading the shared log ring without filtering by the run's own identity · AUTO (regression) + **OPEN**

The game's logs are a ring shared by **every** run, and the game rotates them at startup. Anything
read out of them must be filtered by the run's own identity or it reads a previous session's output
as this one's. Three places, three outcomes:

| Reader | Filtered by | State |
|---|---|---|
| telemetry lines | the per-run **token** | fixed, long-standing |
| the in-game clock | the line's own `[HH:MM:SS]` | fixed — it had thrown away a *successful* resume verdict |
| **error counts** | *nothing* | **OPEN** |

⚠ So `meta.json` → **`error_log_lines` is not a per-run number** — it is an upper bound including
whatever the ring still held from earlier sessions. A run measured 313 508 error lines of which
**zero** were its own; the give-away was errors citing `zzz_v3tb_telemetry.txt:20954` while that run's
telemetry file was **41 lines long**.

**Detector is a regression test on the two fixes that exist**, not a proof of correctness — it
catches someone deleting the token filter, not a newly-written unfiltered reader.

**Next step to close the OPEN part:** count only lines stamped inside the run's own wall-clock window,
the same fix the clock got.

---

### L10 — editing the generator while a batch is running · MANUAL

`run_schedule.ps1` **rebuilds the mod before every run**, so an edit to `telemetry_lib.ps1` or
`build.ps1` lands in run 2 and run 3 but not run 1 — and the arms silently stop being comparable,
which is the one failure a control design cannot survive. This includes edits that look cosmetic,
such as bumping the schema version.

**No detector**: the build cannot tell whether the batch running beside it is one it belongs to.
Queue the edit; apply it once the session reports `SCHEDULE DONE`.

---

## Adding a landmine

When a run surfaces a new one:

1. **Write the entry here first** — it owns the ID, the story, the numbers and the fix idiom. Link
   out to `BUGS_AND_FIXES.md` for the root cause rather than restating it, so the two cannot drift.
2. **Write the detector** as `Test-Lm<ID>` in `tools/preflight.ps1` and register it in `$CHECKS`.
   Read the **emitted artifact**, not the generator.
3. **Prove the tripwire trips.** Break the thing on purpose, watch preflight fail, revert, watch it
   pass. A guardrail that has never failed is not known to work.

**A detector that can be code becomes code.** An entry that stays MANUAL forever is a smell: a manual
step is one that gets skipped, and the failures in this file are precisely the ones nobody notices
being skipped. L3 and L10 are MANUAL because the information genuinely is not available at build
time — not because writing the check was inconvenient.

## L15 — a country silently LOSES a starting technology vanilla gives it

**The shape.** L14 asks whether a country can unlock the buildings it owns. This asks the converse, and
it is the user's rule of 2026-08-12: *every production method vanilla runs in 1836 stays, and the country
running it holds the technology that unlocks it.* Nothing in the build enforced the "stays" half.

**Why nothing fails.** We whole-file-replace `common/scripted_effects/00_starting_inventions.txt`, so a
transform that drops a line removes that technology from every country of that tier. Worse and quieter:
tiers 1 and 2 get most of their set from `add_era_researched = era_1`, so **re-era-ing a technology OUT
of era 1 silently withdraws it from 59 countries** — no file mentions it, no check reads it, the mod
loads, and the first symptom is a production method a great power can no longer run. We move eras
routinely (the ladder-era alignment moved 32 technologies in one commit), which is exactly the operation
that can do this.

**The detector.** `tools/verify_start_techs.mjs --diff-vanilla`, over the EMITTED files. Two things make
it correct rather than approximately correct:
- it expands the era shorthand **against each root's own era assignments**, because the whole hazard is
  that ours differ from vanilla's;
- it includes the **per-country `add_technology_researched` extras** that 81 countries carry in their own
  history (Russia's `fractional_distillation`, Japan's `sericulture`, Britain's `joint_stock_companies`).
  A set built from the tier effect alone is the wrong set for a fifth of the world.

It FAILS on any loss and merely REPORTS the gains, grouped — gains are intended and ruled, but their
shape belongs on screen so an unexpected one is visible. Today: 338 countries gain nothing, tier 3 gains
`beet_sugar_refining`, tier 2 gains five era-1 technologies, tier 1 those five plus `steel_toolmaking`.

**Proven.** Deleting `add_technology_researched = railways` from the tier-1 grant makes it name FRA, GBR,
PRU and USA and exit non-zero.

**⚠⚠ L14 AND L15 ARE `N/A` FOR AN INSTRUMENT ARM, AND THAT EXEMPTION IS ITSELF A LANDMINE STORY
(2026-08-13).** Both read *our own* 1836 grant, which only a content arm has. A control emits
`.metadata` + telemetry and nothing else — the hard rule — so it carries no
`common/scripted_effects/00_starting_inventions.txt`, and both detectors died on **ENOENT** reading it.
That made **`build.ps1 -ControlOnly` THROW**, i.e. **the control arm was unbuildable from the moment
these two landed (2026-08-12) until it was fixed (2026-08-13)** — the purest form of the defect this
register exists for, sitting *inside* the register's own enforcement. Nobody noticed because every arm
built in between was a content arm.

It surfaced when a 20-hour vanilla-vs-mod batch stalled on its first run: `session.log` stopped at
`building setup 'vanilla'` with **neither** `build ok` **nor** `BUILD FAILED`, `build.log` ended
mid-build with no error, and the scheduler sat idle with no children and 1.1 s of CPU. The message went
to the scheduler's detached window — unreadable by design, since that window is what keeps `p/r/s/x`
alive. Diagnosis required reproducing the build by hand in the foreground.

**The skip is keyed on the mod's own METADATA ID** (`Get-InstrumentArmSkip`, the mechanism L7 already
uses, read off the BUILT mod), **never on the grant file being absent** — "the grant file is missing"
must stay a FAILURE for a content mod, which is exactly what L15 catches. **Proven both ways:** the
control now builds green with L14/L15 reporting `N/A`, and deleting the grant from the real mod still
fails both.

---

## L16 — a schedule key that works in `defaults` for some fields and is SILENTLY DROPPED for others

**Status: REGISTERED, DETECTOR OWED.** Found 2026-08-13; the fix could not be written the same hour
because `preflight.ps1` is invoked by `build.ps1` before every run and a 20-hour batch was live.

**The defect.** `run_schedule.ps1:153` resolves a run's dump dates as

```powershell
$dumps = @(Val $r "dump_dates" @())
```

— run-level only, with **no `$defaults` fallback**, unlike `tags`, `metrics`, `autosave_interval`,
`timeout_minutes`, `wide_dates`, `wide_tags` and `origin_goods`, which all have one. So a schedule that
puts `dump_dates` in `defaults` — the obvious place, and where every neighbouring key belongs — has it
**silently ignored**, and every run falls back to the built-in default of *1 January of the year before
`until`*: **one dump date instead of twelve**.

**Why nothing fails.** The build succeeds, the mod loads, the run completes, the TSVs have rows. The run
simply has one twelfth of the intended time series, and a metric that was supposed to be sampled per
decade is a single endpoint. Every trajectory question — when a technology arrived, when a rung was
first built, whether a leader plateaued — becomes unanswerable, and the summary looks perfectly normal.

**Caught by** the `-WhatIf` line, which prints the resolved dump list per run and read
`dumps: 1935.1.1`. That is luck, not a guard: `-WhatIf` is optional and the batch would have run
without it.

**Not covered by L5.** L5 walks the *telemetry* spec keys (`breakdown_dates`, `wide_dates`, `origin_goods`,
…) against what `Resolve-Setup` threads. `dump_dates` reaches the observer by a different path — a
`-DumpDates` argument — so it is outside L5's population entirely.

**DETECTOR (to write).** In `preflight.ps1 -RepoOnly`: parse every `tools/testbed/schedules/*.json` and
fail if any `defaults` block carries a key the resolver reads run-only. Derive the run-only set from
`run_schedule.ps1` itself rather than listing it, so a key that later gains a fallback stops being
flagged automatically. Prove it by putting `dump_dates` back into a schedule's `defaults`.

⚠ **The real fix is arguably in the scheduler** — give `dump_dates` the same `Val $r … (Val $defaults …)`
treatment as its neighbours. The detector is still wanted: it is the general case, and the next key added
without a fallback will be silent in the same way.

---

## L17 — a run that FAILED is recorded as `ok`, and the arm count silently shrinks

**Status: REGISTERED, DETECTOR OWED.** Found live 2026-08-13, mid-batch, in
`20260813_083557_vanilla-vs-mod-n4`.

**What happened.** Run 4 (the mod arm) crashed at **1851.1.27**, its resume made no progress, and
`run_observer.ps1` abandoned it — correctly, and it said so in its own log:

```
[16:31:59] [WARN] run 1: game CRASHED at 1851.1.27 (crash dump: victoria3_01260713_163156) - resuming
[16:32:37] [WARN] resume made no progress (still 1851.1.27) - abandoning run 1
[16:32:37] [INFO] run 1 finished: 1165,7s wall over 2 attempt(s), in-game 1851.1.27,
                  exit resume made no progress
```

The **session** log, one line later, says:

```
[16:32:55] [INFO] run 4 finished: ok
```

**Root cause.** `run_schedule.ps1:464` derives the status from the observer's EXIT CODE and nothing else:
`switch ($rc) { 0 { "ok" } 2 { "stopped_by_user" } 3 { "fatal_early_crashes" } ... }`. The observer exits
**0** when it abandons a run, so an abandoned run is indistinguishable from a completed one. That status
is then written into `session.json`'s index, which is what a later reader counts arms from.

**Why nothing fails.** The batch continues, the folder exists, the TSVs have rows, and the summary is
well-formed. The run simply covers **15 of 100 years** — 3 of 12 dump dates, 15 save summaries against a
century's 100 — and `n=4 per arm` is really n=3. Everything needed to know better is already in that
run's own `meta.json`: `reached_ingame_date: 1851.1.27`, `self_quit: false`, `resumes: 1`,
`abandoned_reason: "resume made no progress"`. The scheduler never reads it.

⚠⚠ **THIS IS THE MOST-REPEATED DEFECT IN THE WHOLE REGISTER'S HISTORY, seen from the generating side.**
`SESSION_VERDICTS.md` already carries four retrospective corrections of exactly this shape —
`techtree-full-n3` is n=2, `wages-n3` is n=2, `vanilla-retest`'s "19 runs" are 16 smoke probes, and
`vanilla-retest-2` reached 1936 once in three. Every one of them had to be reconstructed by hand from
run logs, long after the analysis that used the wrong n. This entry is why they keep happening.

**DETECTOR.** Two halves, and the first is a real fix rather than a check:
1. **In `run_schedule.ps1`**, after each run, read that run's `meta.json` and downgrade the status when
   `self_quit` is false, or `abandoned_reason` is non-empty, or `reached_ingame_date` is short of the
   plan's `until`. Record `partial(<date>)`, not `ok`. The information is already on disk.
2. **In `preflight.ps1 -Session <dir>`** (where L12 already runs post-run), fail if any run's recorded
   status disagrees with its own `meta.json`, and print a per-arm table of runs that actually reached
   `until`. That table is the thing a verdict should quote instead of the folder count.

Prove it by pointing the check at `20260813_083557_vanilla-vs-mod-n4`, where run 4 must come out
`partial(1851.1.27)` and the mod arm must count 3 completed, not 4.

⚠ Neither half could be written when this was found: `preflight.ps1` is invoked by `build.ps1` before
every run and the batch was live. Editing it mid-batch would have changed the instrument between arms.

---

## L18 — a tier that cannot break even at ANY price the engine can produce

**Status: DETECTOR BUILT AND PROVEN — build wiring owed.** Found 2026-08-17 while diagnosing F67, from
the economy's behaviour in flight rather than from any check. The rule was **ruled by the user the same
day (§10.63)** and both halves are implemented:

- **Solver** — `Xsolv`, a hard clamp in `solveInputsAt()` beside `Xmin` and the ratchet, plus
  `assertSolvency()`, which **throws before the config write** if the negative-goods floor pushes a tier
  back over the line after clamping. The solve refuses to write a config it knows is unsolvable.
- **Build** — `tools/lint_solvency.mjs`, standalone, covering **every** tier including the `no_mass_be`
  industries. Proven to trip: pointed at a config with `building_port` at 2.5 clippers it exits 1 with
  *"needs its output at 444% of base to break even; the engine stops at 175%"*, and stays silent on
  everything else.

⚠ **The one-line call in `build.ps1`/`lint.sh` is still owed.** `canon-ports-n2` was live when this was
written and the scheduler rebuilds the mod before every run, so editing the build path would have changed
the instrument between run 1 and run 2 — **L10**. Wire it the moment the batch reports.

⚠ **THE THRESHOLD WAS RULED TWICE ON THE SAME DAY, AND THE FIRST ONE WAS TOO WEAK TO MATTER.** The first
ruling let BOTH prices go to their favourable edges — output ×1.75 *and* inputs ×0.25, i.e.
`target_be ≤ 400` — which was measured at **0 of 105** before it shipped: the port is 270 and cleared it
by ×1.48. Holding **inputs at base** is what makes the bound bite, and that is the shipped rule
(`target_be ≤ 175`, §10.63). It catches port 270, railway 217 and synthetics 208, which is what forced
the re-solve. `lint_solvency.mjs --band` still scores the superseded line for comparison.

**The defect.** `building_port` (era 0) consumes **15.2 clippers to make 9 merchant marine** —
£912 of input for £450 of output at base prices, a ratio of **0.49**. Vanilla's own
`pm_basic_port` is 6 → 9, i.e. **+£90**. Its stored `target_be` is **270**, which states plainly
that the building needs its output at 270% of base to break even. **The engine's price band tops
out at 175%.** So the tier cannot break even at any price the game is capable of producing, and
it never could — it survives only on subsidy, and dies the moment subsidy lapses (F67 traces the
rest: coverage decays 87% → 78%, staffing follows, world merchant-marine output falls in absolute
terms, and two markets clamp at the +75% ceiling).

**Why nothing fails.** Four layers each had a reason to catch it, and each has a specific,
non-obvious reason it did not:

1. **Scope.** `build.ps1:584` writes the linter's tier map only for industries where
   `follows_be -ne $false -and -not $ind.no_mass_be`. Port, railway and power carry
   `no_mass_be: true`, so no port tier is ever in `tools/ladder_tiers.txt` — the map has 93 entries
   and the linter dutifully reports "93 in-scope buildings". The flag was introduced to keep the
   mass BE tools and the UI preset off the new-economy chains; that it also removes them from the
   linter is a side effect nobody chose.
2. **The test is circular.** `era_solver.mjs:764` writes
   `target_be = Ibase / ((1 − wage_pct) · Obase) · 100` — whatever the solved recipe implies — and
   `lint_profitability.awk:55` then recomputes exactly that quantity and compares. The deviation is
   **0 by construction**. The solver's own comment says so: *"demotes lint_profitability.awk from a
   design check to a DRIFT GUARD: it can no longer tell us the balance is wrong"*.
   ⚠ **This alone is sufficient, so fixing scope would not have helped**: `building_synthetics_plant`
   carries `target_be` **208**, IS in scope, IS linted, and PASSES.
3. **No absolute bound exists in the solver.** `era_scenarios.mjs:982` sets
   `Xmin = (Obase / ioCapFor(ind.id)) / unitBase` — a **hard floor on leanness** (the 4:1 cap) — and
   the only bound on richness is `monoCapInfo()`, the §10.50 ratchet, which is **relative to the tier
   below**. A ladder's bottom rung has no tier below it, so it is bounded on one side only.
   `building_port` is a bottom rung.
4. **The ruling that removed the floor is now argued from stale cases.** §10.50.1 states there is
   *"deliberately NO absolute floor"*, justified by *"fertilizer runs 0.98 for three eras, electrics
   debuts at 0.75, both viable at their realised prices"*. **Both now run 3.99** — later re-solves
   fixed them and the exemption stayed. The current sub-1 population is six tiers and the worst is
   **0.49**, twice as far under as the worst case the ruling was argued from.

**The census (2026-08-17, canonical config, 6 of 105 tiers destroy value at base prices):**

| O:I | era | target_be | in the linter? | tier |
|---|---|---|---|---|
| 0.49 | e0 | 270 | **no** (`no_mass_be`) | `building_port` |
| 0.61 | e1 | 217 | **no** (`no_mass_be`) | `building_railway` |
| 0.64 | e2 | 208 | **yes — and it passes** | `building_synthetics_plant` |
| 0.84 | e3 | 158 | **no** (`no_mass_be`) | `building_power_plant` |
| 0.96 | e2 | 139 | yes | `building_steel_mill_bessemer` |
| 0.96 | e0 | 135 | yes | `building_steel_mill` |

**DETECTOR — as RULED and as BUILT (§10.63).** Inputs stay at BASE; only the output price moves to its
band edge:

> For every tier, take the **base PM** and compute from the goods block and the shared
> `tools/goods_prices.tsv`: **THROW if `I_base / ((1 − wage_pct) · O_base) · 100 > 175`** — i.e. the
> output price, as a % of base, at which the tier breaks even, against the engine's own +75% band edge.
> 175 is a game constant rather than a tuning choice. Scope is **every tier**, explicitly including
> `no_mass_be` industries — two of the three offenders live inside them and are invisible to
> `lint_profitability.awk`. **Shipyards are not exempt.**

Implemented as `tools/lint_solvency.mjs` (build side) and `Xsolv` + `assertSolvency()` in
`solveInputsAt()` (solver side).

⚠ **Do not implement it as a bound on `target_be`.** That field is solver output restated from the
recipe, so a check against it inherits the circularity of layer 2. Recompute from the goods block.

⚠ **A ratio below 1 is NOT the trigger, and must not be.** §10.50.1's reasoning is still sound —
a tier may legitimately destroy value at base prices when realised prices carry it. The trigger is
the sharper claim: *no reachable price makes this building solvent*. Steel's two 0.96 rungs are fine
and must keep passing. **The §10.50 recipe ratchet is untouched and stays** — it is relative (a tier
against the one below), this is absolute (a tier against the engine), and neither subsumes the other.

**Proven on the real config.** `node tools/lint_solvency.mjs --census` against `acaf6ad` exits **1** and
names exactly three tiers — `building_port` 270%, `building_railway` 217%, `building_synthetics_plant`
208% — while staying silent on the three tiers that destroy value at base prices but remain reachable
(`building_power_plant` 158, `building_steel_mill_bessemer` 139, `building_steel_mill` 135). Those three
passing is as much a part of the proof as the three failing: the rule must not degenerate into "no sub-1
recipes", which §10.50.1 forbids.

---

## L19 — an ORPHANED GAME PROCESS makes the next run fail instantly, and nothing says so

**Status: REGISTERED, DETECTOR OWED.** Found live 2026-08-17, immediately after a run was stopped by
ruling. Cost one wasted launch; overnight it would have cost the night.

**What happened.** `canon-ports-n2` run 2 was stopped mid-campaign with the STOP file. The observer did
everything right — logged the stop, called `Stop-Process -Id $proc.Id -Force`, drained the harvest,
closed the session (`run 2 finished: failed(1)`, `SCHEDULE DONE`). **But `victoria3.exe` outlived it**:
PID 8420, started 13:33:01, still running at 14:58.

Victoria 3 is effectively single-instance, so the *next* schedule's game could never start. That run
reported `failed(1)` **twenty seconds** in, with zero rows, no `build_state.json`, no `logs/`, and a
`run.log` of exactly one line:

```
[14:55:42] [INFO] restored content_load.json + pdx_settings.json
```

Killing the orphan by hand and relaunching the identical schedule worked first time.

**Why nothing fails — and why this one is nastier than most.** The build succeeded and passed all four
gates. The archiver and the harvester both reported alive. The scheduler reported `SCHEDULE DONE: 1/1`.
The single log line describes the **tidy-up path**, so the only evidence reads like an orderly shutdown
rather than a failure to launch. Every visible signal points at the config or the mod, which are
blameless. ⚠ And the preceding batch looked *completely clean* — the orphan is invisible from inside the
session that created it, because that session had already written its last line.

**DETECTOR.** Two halves, and the first is a fix rather than a check:

1. **In `run_observer.ps1`, make the kill verifiable.** After `Stop-Process`, poll for the process to
   actually be gone (a few seconds, then a second `-Force`), and **log the outcome either way**. A kill
   that reports success and leaves the process running is the whole defect.
2. **At the START of every run — in `run_observer.ps1`, before the settings backup — refuse to launch
   while a `victoria3.exe` this session did not start is alive.** Fail loudly with the offending PID and
   its start time. That is the check that would have turned twenty silent seconds into one clear line.
   ⚠ Do NOT auto-kill it: a process from a *concurrent* session is somebody else's run, and killing it
   would convert a wasted launch into a destroyed campaign. Report and stop.

Worth adding to `preflight.ps1 -RepoOnly` as well, since that already runs before a batch is estimated —
a stale game process is exactly the kind of thing to catch before the first build rather than after it.

**Prove it** by starting the game by hand, then launching any schedule: the run must refuse with the PID
named, instead of exiting after one line.

---

### L16 — a `defaults` key honoured for some fields and silently dropped for others · AUTO

**The failure.** The schedule JSON accepts the key, nothing reads it, and the run proceeds on a
fallback. Nothing errors. The result looks like the METRIC failed rather than the plumbing.

**The case it was registered from:** `dump_dates` was read as `Val $r "dump_dates" @()` — from the RUN
ONLY — while `tags` and `metrics` on the next two lines both fall back to `$defaults`. A defaults-level
`dump_dates` therefore did nothing, and every run fell back to ONE computed dump date instead of the
twelve asked for. **A per-decade series silently becomes a single endpoint.**

**Fixed and guarded, 2026-08-17.** `dump_dates` now falls back to `$defaults` like its neighbours; and
the scheduler **throws on any `defaults` key it does not thread through**, naming the key, before it
builds or launches anything. Keys prefixed `_` are treated as comments. Adding a defaults key now means
adding it to `$KNOWN_DEFAULT_KEYS` and threading it, or the batch refuses to start.

⚠ **The guard matters more than the fix** — the next key added has the identical hazard. Same argument
as L5 about spec keys: a comment on the right line did not prevent this the first time.

**Tripwire proven both ways:** a real schedule passes `-WhatIf`; the same schedule with a
`dump_dates_typo` key added to `defaults` throws, naming `dump_dates_typo`.

---

### L17 — a run that FAILED is recorded as `ok`, and the arm's n silently shrinks · AUTO (post-run)

**The failure.** The scheduler derives a run's status from the **observer's exit code alone**, and the
observer exits 0 even when it ABANDONS a run — on a watchdog timeout, on a STOP file, on a resume it
gave up on. A run that reached 1838 of a planned 1936 is then counted beside three that reached 1936:
the arm reports n=4, and every mean is computed over a population that never existed.

**Nothing was missing to catch it.** Each run's own `meta.json` already carries `reached_ingame_date`,
`until_date`, `self_quit` and `abandoned_reason`. Nothing read them. This is the generating cause of the
**four retrospective n-corrections** in `SESSION_VERDICTS.md` — `techtree-full-n3` and `wages-n3` are
n=2, `vanilla-retest`'s nineteen runs are sixteen probes plus three failed resumes, and
`canon-ports-n2` is n=1 for the century.

**The detector** (`preflight.ps1 -Session <dir>`, N/A at build time like L12): for every ENDED run,
compare `reached_ingame_date` against `until_date` and report any run that fell short or carries a
non-empty `abandoned_reason`. It deliberately does **not** judge why — a deliberate STOP is as much a
shortfall for COUNTING as a crash is, and which it was belongs in the session's `VERDICT.md`.
⚠ Runs still in flight are counted separately and never failed; a detector that cries wolf on every
mid-batch check is one people learn to ignore, which loses the register.

**Tripwire proven both ways, 2026-08-17:** PASS on `20260817_225120_port-ramp-monthly-n3` (3 ended runs,
all reached 1841.2.1); **FAIL** on `20260817_152516_anchorage-netseed-n1`, a run killed by the STOP file
— and the whole preflight goes red with it.

---

## L20 — an ALTERNATE CONFIG WITHOUT ITS PAIRED `tech_tree_options.<sfx>.json` cannot be built, and the batch dies at the first build

**Status: ✅ FIXED AND GUARDED 2026-08-18 · AUTO.** Found 2026-08-18.
**Cost at discovery: 6 h 40 min of an overnight window, zero runs.**

**The convention nobody states.** `emit_techs.mjs` and `emit_research_events.mjs` derive a **parallel
tree file** from the config's *filename*:

```js
const m = bn.match(/^mod_config\.(.+)\.json$/);   // mod_config.foo.json -> '.foo'
const TREE_PATH = join(REPO, 'config', 'tech_tree_options' + SFX + '.json');
```

So `config/mod_config.foo.json` **requires** `config/tech_tree_options.foo.json` to exist. Every
alternate in the repo has one; nothing says so, and nothing checks it.

**What happened.** A full-century n=2 batch was launched against a *frozen byte copy* of the canonical
config (`mod_config.canon_n2.json`) — a deliberate L10 mitigation, so that a second agent session editing
`config/mod_config.json` mid-batch could not silently change the arm between run 1 and run 2. The freeze
had no paired tree, so the build threw:

```
Error: ENOENT: no such file or directory, open '…/config/tech_tree_options.canon_n2.json'
    at emit_techs.mjs:51
emit_techs.mjs failed (exit 1) - the mod would ship without its technologies.
```

⚠ **The mitigation was what broke it.** The freeze is still the right call — do not conclude "never
freeze". Conclude that a frozen config is a *new alternate* and needs its pair.

**Why it is silent for six hours.** The build fails in **3 seconds** with a perfectly clear message — but
into `build.log`, which nobody reads while a batch is believed to be running. The scheduler then failed
to abort (**L21**), so `session.log` ended mid-sentence at `building setup 'canonfull'…`, the harness sat
alive at 9.5 s CPU with no child process, and no game ever launched. From outside, an idle machine and a
silent log are indistinguishable from a healthy long run.

**Do NOT "fix" it by falling back to the canonical tree.** That would pair an alternate config's
BUILDINGS with the canonical config's TECHNOLOGIES — precisely the defect BUGS_AND_FIXES 2026-08-12
records, caught one run before it voided an overnight batch. It must fail; it must fail *loudly and
early*, naming the missing file and the one-line fix.

**Census at registration — 5 of 21 alternates are unbuildable today**, one of them a day old:
`2x_thresholds`, `baseline175ab` (2026-08-17), `paper_be20`, `vanilla_stub`, `x10`. So this is a live
trap, not a one-off self-inflicted wound.

✅ **DETECTOR: `Test-LmL20` in `tools/preflight.ps1`**, registered in $CHECKS as a REPO check (it reads
the config, not a built mod), and wired at **three** call sites:
- **`build.ps1`, immediately after the config is resolved and before a single file is emitted** —
  `preflight.ps1 -RepoOnly -Only L20 -Config $cfgPath`, which throws. The `-Only` filter exists for
  exactly this: the full walk still runs at the end, so the rule has ONE definition run twice, not a
  second copy that can drift.
- **`build.ps1`'s two full preflight calls**, which now pass `-Config` (the control arm's early exit
  included).
- **`run_schedule.ps1`, per SETUP, before the estimate is printed** — the repo-wide pass only WARNs
  because it does not know which config a batch will build; this names each setup's own config, so a
  batch pointed at an unpaired alternate dies in two seconds instead of at its first build.

**What it reports.** With `-Config`: PASS/FAIL for that one config, and the FAIL prints the exact
`Copy-Item` that fixes it. Without: a WARN listing every unpaired alternate in `config/`, which alone
would have caught this — `-WhatIf` ran `preflight -RepoOnly` seconds before the lost launch and printed
`PREFLIGHT PASSED`.

⚠ **It mirrors the emitters' suffix rule rather than restating it loosely**, `MOD_CONFIG` precedence
included (both `emit_techs.mjs` and `emit_research_events.mjs` read `process.env.MOD_CONFIG || argv[3]`).
A redirected run is therefore checked against the pair it will actually open, and the message names the
file the suffix came FROM — a message naming the wrong file is how a redirected run gets "fixed" in the
wrong place.

⚠ **Tripwire PROVEN on real data, all four paths (2026-08-18):** repo survey WARNs the same five
alternates the census below names; PASS on the canonical config; **FAIL + build refused before any
emission** on `mod_config.baseline175ab.json`, exit 1; and `MOD_CONFIG=…x10.json` overriding a
canonical `-Config` FAILs against the x10 tree. A full `-DryRun` on the canonical config passes with
the check live.

---

## L21 — a FAILED BUILD hangs the scheduler instead of aborting it, and the whole window is lost

**Status: ✅ FIXED AND GUARDED 2026-08-18 · AUTO.** Found 2026-08-18, the same incident as **L20**. This is the entry
that turned a 3-second, clearly-reported failure into a **6 h 40 min** loss, and it is the more dangerous
of the two because it is arm- and config-independent: *any* build failure, from any cause, costs the
whole window.

**The intended behaviour exists and is correct** (`run_schedule.ps1`):

```powershell
& powershell @($resolved.Args) 2>&1 | Out-File -FilePath (Join-Path $runDir "build.log") -Encoding utf8
if ($LASTEXITCODE -ne 0) { Log "BUILD FAILED for setup … - see build.log; aborting schedule" "ALERT" ; … }
```

**It never ran.** `session.log` — written by `Log` via `Add-Content`, so it is the record of what the
scheduler actually reached — contains no `BUILD FAILED`, no `ALERT`, no `aborting`. Its last line is
`building setup 'canonfull'…`. The scheduler was therefore blocked **on the pipeline itself**, never
reaching the exit-code test. Observed state: harness PowerShell alive, **9.5 s CPU over 6 h 40 min**, a
`conhost.exe` and **no build child at all**, `build.log` truncated mid-stream with the node error absent
from it.

⚠ **The exact blocking mechanism is NOT identified** and is not claimed here. Candidates, none confirmed:
`2>&1` on a native command in PS 5.1 wrapping stderr into `NativeCommandError` records (the hazard
CLAUDE.md already warns about for the Bash/PowerShell tools); `Out-File` holding the pipeline open; or a
console-selection freeze (QuickEdit) blocking a write. **Do not write the cause into the fix** — write
the *timeout*, which is correct regardless of which it is.

**Why nothing fails.** Every guardrail in the repo assumes the scheduler is running or has finished. A
scheduler that is *blocked* satisfies neither: `wait_for_session.ps1` sees no completion marker and a
live harness, so it reports `RUNNING` forever — the heartbeat is indistinguishable from a healthy
2½-hour run.

**And the agent-side failure is the same shape, which is the lesson worth keeping.** The smoke check
mandated in CLAUDE.md was armed as a background waiter conditioned on `logs_live/debug.log` **appearing**
— a happy-path signal. The build failed, that file was never created, the waiter never fired, and the
silence was read as "still running". **A watcher that matches only success is indistinguishable from a
broken watcher.** Every wait condition must also match failure, process death, and stall.

✅ **FIX + DETECTOR SHIPPED 2026-08-18, all three parts.** `run_schedule.ps1` builds through
**`Invoke-BoundedBuild`**:
1. **The build is BOUNDED.** `-BuildTimeoutMinutes`, default **10** against a ~7 s build. On expiry the
   child is killed as a **TREE** (`taskkill /T /F`, then `$proc.Kill()` as a backstop) — `Kill()` alone
   on PS 5.1 orphans the node and robocopy children the builder spawns.
2. **The verdict comes off the PROCESS OBJECT, never the pipeline.** `Start-Process -PassThru` +
   `WaitForExit(ms)` + `$proc.ExitCode`, with output redirected to **files** and merged into one
   greppable `build.log` (stdout, then a `----- stderr -----` fence). A **null** exit code is treated as
   **failure**, not success: the whole point of moving the verdict onto the object is that it can be
   trusted, and null means it cannot.
3. **The waiter is fail-aware.** `wait_for_session.ps1` gains **STALLED (exit 3)** — nothing anywhere in
   the session tree has been written for `-StallMinutes` (default 20) — beside the existing DEAD. It
   watches the newest write across the whole tree rather than one happy-path file, because the game
   mirrors its logs continuously, the concurrent harvest writes summaries, and a build writes
   `build.log`: under any healthy stage something ticks within seconds.

A failed or timed-out build now sets `$fatalExit`, so the schedule **still writes `session.json` and
still prints `SCHEDULE DONE`** (that marker is what the waiter wakes on — a batch that dies at the first
build must wake the agent in seconds, not look like a live run) with `[ABORTED]` appended, and then
**exits 3**. Per-run `status` is `build_failed` / `build_timeout`.

⚠ **THREE THINGS WERE PROVEN BY DELIBERATE BREAKAGE, and the third was a real bug found by proving:**
- **exit code**: a paired-but-invalid-JSON config → `BUILD FAILED … (exit 1)`, schedule exit 3, **1 s**.
  The first attempt reported `exit -1`, i.e. the unverifiable fallback — `Start-Process -PassThru`
  WITHOUT `-Wait` hands back a Process whose `ExitCode` reads `$null` unless the handle has been
  touched, so `$null = $proc.Handle` is load-bearing.
- **timeout**: `tools/build.ps1` temporarily replaced by a stub that hangs and spawns a child, run at
  `-BuildTimeoutMinutes 1` → `BUILD TIMED OUT … after 1 min - child killed`, exit 3, **63 s**; the
  child's survival marker never appeared, so the tree-kill holds. The real builder was restored and
  **sha256-verified**.
- ⚠⚠ **the empty-stream bug the timeout proof exposed:** `$x = [string](Get-Content -Raw)` on an
  **empty** file leaves `$x` **null**, not `""` — the cast has nothing to act on — and under
  `Set-StrictMode 2.0` the next `.Trim()` is a terminating error. That is precisely the TIMEOUT case (a
  hung build has usually written no stderr at all), so the first timeout run aborted with
  `InvokeMethodOnNull` and **never printed `BUILD TIMED OUT`**. A guard that has only been tested on the
  happy path is not known to work — this one was two lines from being another silent hang.

⚠⚠ **AND THE WAITER'S OWN STALL CHECK SHIPPED WITH TWO BUGS THAT HID EACH OTHER — caught within minutes
of shipping, on the live canon-n7 batch (2026-08-18).** It reported **STALLED against a run that was
healthy and advancing**, printing `newest write: 01.01.0001 0:00:00`, i.e. it had found *no files at all*.
Two independent faults, in series:
1. **The session path it was handed was mangled** (an escaping layer between the caller and the script ate
   the separators), so it watched a directory that never existed. **A watcher that cannot tell a broken
   ARGUMENT from a broken RUN is the same defect as one that cannot tell failure from success** — it just
   fails in the flattering direction. Fixed: a non-existent session is **BAD SESSION, exit 4**, named,
   before any waiting; and a tree that enumerates *nothing* is exit 4 too, not staleness.
2. **The exclusion filter was an invalid regex.** It tested the full path against a pattern of escaped
   separators, and the same escaping layer collapsed the doubling, leaving a regex that **threw on every
   file**. It could not surface while fault 1 was present, because an empty enumeration never reaches the
   filter. Fixed by removing the escaping entirely — the check now compares the parent **directory's
   name**, which nothing can mangle.
⭐ **The lesson is the register's own, turned on itself:** a guard is not known to work until it has been
run against the thing it guards. This one was proven against a fabricated stall and never against a real
session, and it had a 100% false-positive rate on the first live one. It now reports RUNNING correctly on
canon-n7 and sees writes 7 seconds old.

⚠ The blocking mechanism of the original incident is **still not identified**, and deliberately so: the
fix is the timeout, which is correct whichever candidate it was.

---

## L22 — a mod `effect` block on a VANILLA on_action SILENTLY REPLACES vanilla's, and the engine says so in one line nobody reads

**Status: ✅ FIXED AND GUARDED 2026-08-18 · AUTO.** `emit_research_events.mjs` now registers
`on_monthly_pulse_country = { on_actions = { pmr_wargate_eval } }` and puts the effect in that named
action, the idiom the telemetry and diag files already used. Verified against the EMITTED artifact: the
only direct `effect` child sits under `pmr_wargate_eval`, and `on_monthly_pulse_country` carries an
`on_actions` list. Vanilla's 1005-line effect is no longer displaced.
✅ **DETECTOR: `Test-LmL22` in `tools/preflight.ps1`**, registered in \$CHECKS as an artifact check, so
it runs inside every build. It reads the EMITTED `common/on_actions/*.txt`, and any top-level block that
is a VANILLA on_action must not carry a direct `effect = {` child. The **262 vanilla on_action names are
parsed LIVE from the game**, so a patch that adds one is covered without editing the check; an `on_` prefix
is the documented fallback when the game path is unreadable — preflight must keep working on a machine
with no game installed.
⚠ **Tripwire PROVEN by deliberate breakage.** Reintroducing the bare `effect` on
`on_monthly_pulse_country` made preflight exit 1 with
`L22 FAIL … 'on_monthly_pulse_country' declares its own effect block`, naming the file and printing the
two-line fix; restoring it returned PASS, and a full dry-run build passes with the check live.
⚠ It is deliberately **NOT** a grep for the engine's own warning string — that needs a RUN, and the point
is to fail at BUILD time. Same principle as reading the artifact rather than the generator, which is what
caught both this bug and the zero-fleet-technologies bug on the same day.

**Original status: REGISTERED, DETECTOR + FIX OWED** (both queued behind the live `canon-n2` batch — `emit_research_events.mjs`
is in the build path and the scheduler rebuilds between runs, so changing it mid-batch is an L10 breach).
Found 2026-08-18, while checking whether the rebuilt war gate fires as designed. **It was not what we were
looking for**, which is the point of reading `error.log` at all.

**The rule.** An on_action may carry `events`, `random_events` and `effect`. `events` lists *merge* across
files. **`effect` does NOT.** Two files defining an `effect` for the same on_action do not compose — the
engine keeps the **most recently loaded one** and discards the other, then logs exactly one line:

```
[08:43:14][jomini_onaction.cpp:124]: There is more than one 'effect' defined
          using most recent:common/on_actions/zzz_pm_rehaul_wargate.txt:5
```

**What happened.** `zzz_pm_rehaul_wargate.txt` declares `on_monthly_pulse_country = { effect = { … } }`.
Vanilla declares that same on_action in `common/on_actions/00_code_on_actions.txt:475` **with its own
`effect` block of 1 005 lines**. Our file is `zzz_`-prefixed, so it loads last and **wins**: vanilla's
entire monthly country effect is discarded for the whole campaign. It carries Ottoman and Portuguese
monarchy succession (`ottoman_monarchs.1`, `.2`), ruler-trait rolls, and content scoped to
**AUS BIC FRA GBR HAI HYD JAP MON MOR POR SPA SPC SWI TUR VEN**.

**Why it is silent.** Nothing fails. The mod loads, the build passes every gate, the run completes, the
war gate itself works. The only evidence is one `error.log` line among ~12 700, sitting in a file that is
*expected* to carry vanilla's own noise — the exact reason nobody reads it.

**THE CORRECT IDIOM, AND WE ALREADY USE IT EVERYWHERE ELSE.** Register a named action instead of writing a
bare `effect`:

```
on_monthly_pulse_country = { on_actions = { pmr_wargate_eval } }   # merges
pmr_wargate_eval = { effect = { … } }                              # our own block, no collision
```

`zzz_v3tb_telemetry.txt` does this for `on_game_started_after_lobby`, `on_monthly_pulse`,
`on_acquired_technology` and the rest; `zzz_pm_rehaul_diag.txt` does it for
`on_game_started_after_lobby`. **The war gate is the only file in the repo that does not** — so the
convention was established and simply not followed by the newest emitter. ✅ Both other files were audited
and are clean, which also means **every control arm is unaffected**.

**DETECTOR (owed).** Parse the EMITTED `common/on_actions/*.txt`. Any top-level block that is a **vanilla
on_action** (name parsed live from the game's own `common/on_actions/*.txt`; `on_`-prefixed is the
fallback rule) must **not** contain a direct `effect = {` child. FAIL naming the file, the on_action and
the two-line rewrite. Cheap, artifact-based, and it would have caught this at the first build.
⚠ Do not implement it by grepping for the engine's warning string — that requires a *run*, and the whole
point is to fail at build time.

**Prove it** by re-adding a bare `effect` to a vanilla on_action: preflight must fail before the game
is ever launched.

⚠ **What is NOT established:** that vanilla's monthly events *observably* stopped firing. The engine
message and the two declarations are conclusive about which block is kept; the gameplay consequence is
inferred, not measured. Confirming it is a probe on **vanilla + telemetry** for the baseline rate of
`ottoman_monarchs.1` against a modded arm — the shape of question that belongs on a control arm
(user ruling 2026-08-18).

**Scope of contamination.** The wargate file first shipped 2026-08-18, so only that day's sessions carry
it: the three `wargate-*` probes and the `canon-n2` batch. Earlier sessions are clean.
---

## L23 — a LOG LINE COUNTED RAW, when a burst repeats it: JE firing counts inflated 2.29x

**Status: REGISTERED, DETECTOR OWED.** Found 2026-08-19, ~2 h into canon-n7 run 1, while answering
"anything egregious in the first run?". Nothing in the run was wrong; the way its telemetry was being
COUNTED was.

**The failure.** `PMR_JE|<stage>|<tech>|<country>` is logged once when a research journal entry
completes, and every analysis so far has counted those LINES. In canon-n7 run 1 to 1926 the log holds
**12,143 PMR_JE lines against 5,293 distinct `(stage, tech, country)` triples — 2.29x inflation.**
It is not spread out: it lives in a handful of SECONDS, 136 duplicated lines in 22:24:42 alone, and
the steady state is clean. One country, Yogyakarta, appears **16 times** completing `percussion_cap`,
all at the same wall-clock second, in verbatim 655-line blocks that repeat — blocks whose md5s are
identical and which carry unrelated lines (party creation) along with the JE lines.

⚠ **THE CAUSE IS NOT IDENTIFIED, AND THE FIX DOES NOT DEPEND ON IT.** Two candidates: the observer's
continuous log MIRROR re-appending an overlapping chunk when the 5x512KB ring rotates rapidly under a
burst (the bursts are exactly where the game emits thousands of lines in one tick), or the engine
genuinely re-emitting. Evidence leans to the mirror — the repeated blocks are byte-identical including
unrelated content, and a line-for-line comparison against the GAME'S OWN live `debug.log` in a
steady-state window matches 1:1 (game=1, mirror=1 on three sampled lines). It could not be checked at
the burst itself: the ring had rotated that window away by the time it was found. **Do not write the
cause into the fix.**

**THE RULE: COUNT DISTINCT `(stage, tech, country)` TRIPLES, NEVER RAW LINES.** That is correct under
either cause, and a journal entry completes once per country per technology by construction, so a
triple cannot legitimately recur. Raw lines are an UPPER bound, distinct triples a LOWER bound; the
truth sits at or near the lower one.

⚠⚠ **IT REACHES BACK INTO A SHIPPED FINDING. F73's "10,093 firings", its 1840s peak of 2,221 and its
87.2%-to-minors split were all counted RAW**, and the inflation is concentrated in exactly the early
window that produced that peak. The SHAPE of F73 very likely survives — the duplication is not
selective by country or technology — but its MAGNITUDES do not, and no threshold ruling should be taken
on the raw numbers. Re-derive from distinct triples before using them.

**DETECTOR (owed).** Two halves, and the second is the one that lasts:
1. The analysis path: every reader of `PMR_JE` (and any other per-event telemetry line) de-duplicates on
   its identity tuple, and REPORTS the raw/distinct ratio rather than silently collapsing — a large ratio
   is itself a signal about the ring.
2. A mirror-fidelity check: after a run, compare the mirror against the game's own retained log over an
   overlapping window and fail if the mirror holds lines the source does not. That is the artifact-vs-
   generator principle applied to the instrument itself.

⚠ This is L9's sibling — that entry is about reading the shared ring without filtering by the run's own
token, this one about trusting line COUNTS from a ring under burst. The same instinct fixes both: a log
line is evidence that something happened, never evidence of how many times.
