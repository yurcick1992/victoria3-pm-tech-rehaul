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
| L16 | A schedule key honoured in `defaults` for some fields and silently dropped for others | **REGISTERED, DETECTOR OWED** |
| L17 | A run that FAILED is recorded as `ok`, and the arm count silently shrinks | **REGISTERED, DETECTOR OWED** |
| L18 | A tier that cannot break even at ANY price the engine can produce | **REGISTERED, DETECTOR OWED** |

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

⭐ **THE GATE IS A DOMESTIC-OWNERSHIP RULE (user-refined 2026-08-16 night, §10.60.3 Q5a).** It fires
only on buildings the state's own country holds a stake in; a building owned ENTIRELY by foreign
countries rides its owners' technology, not the state holder's. Vanilla itself ships such buildings
(SIL's African anchorages are GBR-owned), and the engine provisions steam ports into subject states
whose owners lack the tech (measured: SIL held one by 1837.1 in the vancost century run). This
replaced a short-lived per-rule `tech_deviation` exception list the same night — a refined rule beats
a register of exceptions to a cruder one. The skip count is PRINTED every run (78 foreign-owned 1836
buildings on the current map — 12 of ours, the §10.60.3 overlord-owned subject stubs, and 66 of
vanilla's own). **Tripwire proven both ways**: flipping one seeded stub's ownership to its subject
makes the check FAIL naming the country and `screw_frigate`; restored, it passes.

⚠ **IT COMPARES AGAINST VANILLA RATHER THAN DEMANDING ZERO.** Vanilla itself fails on six countries, so
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

**Status: REGISTERED, DETECTOR OWED.** Found 2026-08-17 while diagnosing F67, from the economy's
behaviour in flight rather than from any check. Detector not written the same hour because
`preflight.ps1` runs inside `build.ps1` before every run and the `canon-ports-n2` batch was live
(L10) — and because the check FAILS on three tiers today, so it has to ship with, or just before,
the fix.

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

**DETECTOR.** One line of arithmetic, on the EMITTED artifact, per the register's own rule that a
check reads the artifact and never the generator:

> For every emitted tier, compute `BE% = Ibase / ((1 − wage_pct) · Obase) · 100` from the emitted
> goods block and the shared `tools/goods_prices.tsv`. **THROW if `BE% > 175`** — the engine's own
> `1 + 0.75` band edge, so the threshold is a game constant, not a tuning choice. Scope is **every
> tier**, explicitly including `no_mass_be` industries; this check must not inherit the linter's
> exclusions, because three of the six offenders live inside them.

⚠ **Do not implement it as a bound on `target_be`.** That field is solver output restated from the
recipe, so a check against it inherits the circularity of layer 2. Recompute from the goods block.

⚠ **A ratio below 1 is NOT the trigger, and must not be.** §10.50.1's reasoning is still sound —
a tier may legitimately destroy value at base prices when realised prices carry it. The trigger is
the sharper and non-negotiable claim: *no reachable price makes this building solvent*. Steel's two
0.96 rungs are fine and must keep passing; 270 against a 175 ceiling is not a judgement call.

**Prove it** by running the check against the config as of commit `acaf6ad`: it must name exactly
`building_port` (270), `building_railway` (217) and `building_synthetics_plant` (208), and must be
silent on both steel rungs.
