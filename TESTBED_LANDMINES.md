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
