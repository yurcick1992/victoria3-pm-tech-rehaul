# Polish for mod 1.0 — the register (started 2026-10-21)

Mod 1.0 ships **2026-10-30** on game 1.13. The user opened the polish on 2026-10-21 with five items: (1) research-entry texts and bar
tooltips, (2) every vanilla script position that references a tiered building or one of its production methods, (3) features deferred to
polishing, (4) bug fixes deferred to polishing, (5) anything else that needs fixing. A second pass the same evening brought balance and
research into scope (Q1–Q11).

**The timing rule.** The alternating vanilla + canon batch measures the 1.0 build, so everything that moves script or economics landed
before it (2026-10-21, below). While the batch runs, nothing it rebuilds from may be edited (CLAUDE.md §4.4, §5.1 rule 7); text, icons and
metadata follow it.

This file is the decision layer. The evidence for item 2 is **`TIER_REFERENCE_AUDIT.md`** (every reference with file:line, verdict and
fix). The register was built from two read-only subagent reports of 2026-10-21 — the sweep of everything deferred to polishing (items 3
and 4) and an independent hunt over the generated mod and six canon centuries' error logs (item 5). Every item they raised is carried
below or in `BACKLOG.md`; the source notes at the end say where.

Status words: **DONE** · **RULING** (needs the user) · **READY** (clear-cut, can be done without a ruling) · **VERIFY** (look in game
first) · **OPEN** · **DEFERRED**.

---

## Where it stands (2026-10-26)

**Built and canonised 2026-10-21 (night).** Every ruling that changes script or economics went into the canon before the batch (the
user, correcting a launch prepared without them:
*"all changes we just introduced are instantly canonised, and the batch goes with them"*): Q1, Q3 and its switch fix, R2.3, U5,
U8, Q8 + U3, C1, H6 and H7 in commit `ad1b306`; the reference fix of §2 in commit `94ae51c`.
Both canon copies carry `secondary_goods_override`, `vanilla_value_overrides`, the two subsidies at `none`,
`research_events.marks_whole_levels` and the `_polish_2026_10_21b` record — sha256 `728f2c7f84e6f467`, built, linted and deployed
(`83dcd0f`). Smoke run 1 × 1836→1841, `20261021_220806_polish-final-smoke`: loads clean, zero invalid-production-method lines (were 46),
none naming a file the build writes.

**The alternating batch is read** (FINDINGS F249, 2026-10-26): vanilla + canon run by run, n=16 each, in `20261021_224949_alt-vanilla-canon-n16`
(runs 1–12; run 13 void, L41), `20261023_161802_alt-vanilla-canon-rest20` (run 20 void, L42) and `20261026_032622_alt-canon-replace20`. 16 intact, world
GDP 1.07× vanilla n=40, loss 6.60, play time ×1.010 of the same sessions' vanilla. Nothing read badly enough to revert. Its reader updates are done
(`lib_runs.mjs`'s references, the red-flag vanilla twin, `fill_research.mjs`); the readers still on the summer vanilla n=16 stay in BACKLOG F.

**Before the release build:**
- **The no-DLC load test** — SCHEDULED by the user 2026-10-21 (*"Run the no-DLC load test after the batch, before the release build"*): a
  load with no DLC enabled and an `error.log` read, the only proof of the DLC rule (§2) beyond the file comparison; never done. The harness
  option is BUILT (2026-10-26): schedule key `no_dlc` → `run_observer -DisableAllDlc`, which writes every installed DLC's `pops_id` as
  `{"paradoxAppId": …}` into `content_load.json` (the launcher's own format) and checks `debug.log`'s DLC mount lines; dry-tested, unproven in
  game. The test is `tools/testbed/schedules/no_dlc_load_test.json` (vanilla and canon, 2 × 1836→1841), waiting on the user's go-ahead.

**For the release build (~26–27.10)** — text, metadata and build switches, no economics:
- **H8** the debug/release switch in `build.ps1`.
- **R1 + Q9 + N1** release metadata (version, no build stamp, short description, `supported_game_version` "1.13.\*") and "Recipe BE" out
  of the names.
- **R2** thumbnail, LICENSE, CHANGELOG · **R3 + H9** the player README with the replaced-file list · **R4** proofread · **R5** the three
  technology icons (waiting on the user's images) · **H10** builders off the default paths · **C7** the stray tracked root file.
- A final build, every lint, an in-game load and an `error.log` read by position. Of the hunt's suggested manual pass, the Military
  Industry principle tooltip is the one panel no in-game check opened; its lines name every arms, artillery and automotive rung since §2
  (`mod/common/power_bloc_principles/00_power_bloc_principles.txt:903–908`).
- The release build drops telemetry (H8), so it is a build no run has timed: the cause of vanilla's October ×1.08 drift (telemetry tags,
  summary version or machine) is not separated (F248). Unmeasured; the direction is harmless.

**Deferred to mod 1.1 or later:** B2 (stale looms), B3 (craft secondary lines), F1 (artisanal ownership), R6 (rung building art), Q5
(military research), Q7 (rubber, a watch item), Q4's two book levers (the cost ladder, paper's own lift); and, ruled 2026-10-24, the
urban-centre electricity ×2 or ×3 (`pm_electric_streetlights` from 1 to 2–3 electricity a level, with a reasonable coal increase; measure the
canon's urban-centre and total electricity at 1935 first; more hydro variety within the four dam types was dropped — BALANCE_FRAMEWORK
§10.89.15, BACKLOG D). Not polish, carried in BACKLOG: F2, F3, C2–C4, N2.

---

## 1. Research entries — DONE 2026-10-21 (commits `70daba8`, `0986b5f`), seen in game (check 1)

- Every condition is a line of the bar tooltip, always: each source, each counted condition, the war and fleet gates (literacy only in the
  body, user-ruled after check 1), worth their tick or 0 (BUGS_AND_FIXES 2026-10-21; MODDING_NOTES → *A scripted progress bar's tooltip
  lists only the add terms evaluated*).
- One wording, in levels: `<buildings>: N fully staffed levels (now X)`; one body template for every entry.

## 2. Vanilla references to the tiered industries — DONE 2026-10-21 (commit `94ae51c`)

**What was found** (`TIER_REFERENCE_AUDIT.md`): 86 distinct script blocks referenced a tiered industry's vanilla building key or one of its
vanilla production methods. 22 were DEAD (could never fire or complete — among them the art journals, so realism, camera, film and mass
propaganda lost their research progress, which §10.98 had assumed vanilla supplied), 49 NARROW (counted only rung 0; in 10 of them a
500-worker craft, so a vanilla level threshold was ~10× easier), 5 SHIFT (fired, but meant something else). Plus ~48 throughput modifiers in
20 files that boosted rung 0 only, and 44 `Invalid Production Method` load errors per run.

**What was built** — `tools/emit_vanilla_refs.mjs` (the audit's §5 and PART 2): additive helper triggers per industry, main method and
renamed secondary; whole-file transforms of 63 vanilla files, regenerated from the live game text on every build with every match count
asserted (a patch that moves a line makes the build throw — a rebuild obligation, `ON_GAME_UPDATE.md`); each throughput line expanded into
every ruled rung, with six new modifier types; a scan that throws on any tiered reference left in a file nobody owns (L40).

**The rulings** — `TIER_REFERENCE_AUDIT.md` PART 2 implements them:

| # | Question | Ruling |
|---|---|---|
| R2.1 | "N levels" tests (grand exhibition and the rest) | ~~one building of any rung at level N, everywhere~~ → **the user (2026-10-21): "go one by one and assess, whether it makes sense narratively"** — DONE as `TIER_REFERENCE_AUDIT.md` PART 2: 30 any-rung, 6 non-craft, 15 a technology's tier set, 12 whatever runs a named method, 1 highest rung held, 1 every rung removed, 7 left as they are; judgement calls listed there (F) |
| R2.2 | crafts in vanilla "industry building" tests | ~~count them at a tenth~~ → **the user leans "exclude craft ones completely", unless the test is about traditional production** — the highlighted cases are PART 2 (B): "Industry Suffers" and the Serbian slander button (recommended in), Occitan food, haute couture, Japan's calendar malus; all ruled row by row the same night and implemented |
| R2.3 | the admin-strategy tools/explosives subsidies (a file we already own) | ~~extend to every non-craft rung~~ → **REJECTED by the user**: "such decisions are stopgaps … for now we don't mandate subsidies, except for infrastructure". Vanilla's own two entries (which subsidised the crude-tools craft and the Leblanc rung): **RULED 2026-10-21, both go** (the user: "remove crude-tool craft and Leblanc shouldn't be subsidised either") — `building_subsidies` none for `building_tooling_workshop` and `building_explosives_factory`; built |
| R2.4 | scope (how many vanilla files the fix takes over) | ~~scope tier 1 (22 files) + the throughput modifiers + the negotiation promises~~ → **RULED 2026-10-21: everything, flavour included — scope tiers 1 + 2, 60 files** (the user: "The scope does include flavour files. Basically option B"); built over 63 |

**DLC content stays behind its DLC — a hard rule** (CLAUDE.md §5.1 rule 1; the user, 2026-10-21:
*"This isn't my intention, and that's explicitly prohibited by PDS"*). The reference fix took over DLC event files (Montenegro
`dlc014`/ip3, Japan `ep2`, the immersion-pack modifiers), so it was built to keep the rule: the generator throws unless every `has_dlc_feature` and `dlc =` line of a vanilla file
survives unchanged in our copy; `tools/check_dlc_gates.mjs` re-counts them over every owned file on every build (L39; 131 replaced files at
the first canon build); a check of ours that fires vanilla DLC content carries that content's own DLC condition (the Montenegro check is
ip3-gated). The file check of 2026-10-21 also established that the mod's own systems only READ gated things: the dams' family rule reads
investment-rights treaties, which exist only with the `foreign_investment` / `mp1_treaties` features, and a building's `can_build_*`
conditions can only restrict construction, never allow what the engine would not. The load with no DLC is still owed (above).

## 3–4. Deferred to polishing — the ones for 1.0

| # | Item | Status | Effort |
|---|---|---|---|
| R1 | Release metadata (`mod/.metadata/metadata.json`): `version` 0.1.0 → 1.0.0; a release build without the "(built yyyy-MM-dd HH:mm)" name stamp `build.ps1` appends; a current `short_description` (today: "Removes main-PM diversity … splits each tier into its own tech-gated building type" — nothing of crafts, merges, dams, research entries or the monopoly threshold); `supported_game_version` "1.13.\*" (Q9) | DEFERRED to ~2026-10-26 (user: "this is still a prefinal version"); the final build also drops the recipe detail ("Recipe BE N%") from the names | S |
| R2 | No `thumbnail.png` in the mod root (a Paradox Mods or Steam listing needs one); no LICENSE in the repo; no CHANGELOG | DEFERRED to ~2026-10-26 (user) | S |
| R3 | The player README. Its stale design statements were corrected 2026-10-24 (scope: 17 industries, ports/railways/power plants vanilla's; the canon's name; the empty start-rules file — commit `5943ded`). Still missing: a player install route (copy the prebuilt `mod/` to `Documents\…\mod\pm_tech_rehaul`; building from source needs Node.js ≥ 24, not listed under Requirements); "new game only" (the 1836 history is replaced; dam site traits and research placement run on `on_game_started_after_lobby`); "do not remove the mod mid-campaign" (the tier building types disappear); the compatibility list (H9); how to read the building names ("Tier N" is the rung's tier, not the tech tree's era) | DEFERRED to ~2026-10-26 (user) | S |
| R4 | Proofread every generated player-facing text: the 3 minted technologies (`spray_finishing`, `continuous_web_processing`, `catalytic_synthesis`; their descriptions read fine at a glance), the 50 building names, the dam strings, the craft group name, the secondary-copy names, the company-modifier lines | READY | S–M |
| R5 | The three minted technologies share one placeholder icon (`gfx/interface/icons/invention_icons/zzz_pm_rehaul_placeholder.dds`) | READY — the specification below; waiting on the user's images | S |
| R6 | Per-rung building icons (every rung shows the vanilla picture; all dams the power plant's) | DEFERRED: vanilla pictures for 1.0, new art in 1.1 or later (user, 2026-10-21). The cheap variant was dropped: method icons are 104 px against the buildings' 256 px | S–M / L |
| R7 | Era dividers in the tech-tree GUI | CLOSED 2026-10-21 by in-game check 5: the bands line up, no fix | S |
| R8 | Dam texts predated private dam construction ("in our own state or a subject's", "each owning what it builds") | DONE 2026-10-21 (the text pass) | S |
| R9 | Two vanilla technologies named for a later invention than what they unlock: Pumpjacks (unlocks the oil rig; the pumpjack is 1925, drilled wells 1859) and Threshing Machines (unlocks steam threshers; the bare machine is 1786). Renamed "Oil Drilling" / "Steam Threshing" in the six-rung book, dropped in the 2026-09-04 rebuild, left awaiting a ruling | RULED 2026-10-24 (the user): **keep vanilla's names** in every language; `TECH_RENAMES_RULED` stays empty (its comment is updated after the batch, BACKLOG G) | — |
| B1 | Dam level cap with two foreign builders on one site unverified | ✅ ANSWERED 2026-10-21 by measurement: since the resource-slot layout (§10.89.13) a dam level is a resource slot the engine caps for every builder, and F247's four canon centuries (`dam_slots.mjs`: every builder's standing + queued levels against each site's slots, every year) found no slot breached (`3680eb4`) | S |
| B2 | Mandated looms not enforced on the merged textile building (1–2 stale levels a game) | ACCEPTED for 1.0, revisit in 1.1 (user, 2026-10-21); BACKLOG A | M |
| B3 | Crafts carry no secondary line (no canning, stills, luxury) | DEFERRED to mod 1.1 or later (user, 2026-10-21); BACKLOG A | M |
| F1 | Artisanal ownership — "the last feature pass", live since the crafts were canonised | DEFERRED to mod 1.1 or later (user, 2026-10-21); BACKLOG A | L |
| F2 | Craft extras: a Muskets craft; spreading the 1836 craft levels over the largest states; trimming automation that duplicates a main-method upgrade | DEFERRED, not polish; BACKLOG A | M |
| F3 | Company mandates: the first cut (shipped 2026-08-23) never measured — the company-held rung mix (ROADMAP step 5) | READ 2026-10-26 (F249 §5, `company_check.mjs`): 277 companies at 1935 against vanilla's 298, company-held levels 26% against 33% — smaller than vanilla's, not absent; no change proposed; BACKLOG D | S |
| N1 | "Recipe BE N%" rides along wherever a building name is referenced (company modifiers: "Era 2. Arms Industries (Bolt Action Rifles). Recipe BE 55% building Throughput") | DONE 2026-10-21 for the company modifiers and the research texts (the per-language short name `<key>_pmr_short`); company FORMATION lines still print the full name until "Recipe BE" goes at release (R1) | S |
| N2 | Ten non-English languages ship English stubs for new content (by design, MODDING_NOTES) | not for 1.0; at most a line in the release notes | — |
| C1 | `TECH_AHEAD_OF_TIME_PENALTY_FACTOR = 0.25` shipped at vanilla's value with a false comment | DONE 2026-10-21 (emitted only when it differs from vanilla's) | S |
| C2 | The UI's "Mod changes" page is stale (`ui/builder.html` `renderModChanges`): "BE target" where the game says "Recipe BE"; nothing on crafts, dams, the monopoly define, the finish boost, the research levers or AI schooling | OPEN, developer-facing; BACKLOG F (the balance sheet on the canon) | M |
| C3 | The tech-tree page (`ui/techdata.js`, generated 2026-08-12) shows the six-rung candidate trees | OPEN, developer-facing; BACKLOG F | M |
| C4 | `builder.html` carries a ~260-line fork of `econ.js` (change both or neither) | OPEN, developer-facing; BACKLOG F | M |
| C5 | Stale "open" lines in the docs that were done or moot | DONE 2026-10-21 (`ac46068`): in ROADMAP the BOM warning (fixed 2026-09-25), "deleting vanilla techs deferred to final polish" (moot: the tree is vanilla's), "30% of the start on the wrong tier" (fixed, L13), "the AI subsidises only the obsolete infrastructure tier" (moot: infrastructure is vanilla's), "drop steel's tier-1 rung" (moot); in BACKLOG the technology re-peg validator (done, `lint_tech_content.mjs`), the `emit_techs.mjs` grant-side blind spot (fixed), the vanilla batch with the order-book feed (exists: October's vanilla n=6), the fleet-loop wiring into row P (superseded by `wall_clusters.mjs`), the stage-length note (48 months ruled out, F237); CLAUDE.md's canon open items; ON_GAME_UPDATE's urban-centre line; BUGS_AND_FIXES' vacuum-canning caveat (moot under the `top` rule); MISSING_PM_REFERENCES.md retired. The settled BACKLOG rulings this pass named but left open (textile host, crafts + merges, craft cost ÷50, FDI, survey concurrency, tick overhead) were closed 2026-10-24 | S |
| C6 | BACKLOG's "tech era 5 fell 20 → 14 technologies after the merges" | CLOSED 2026-10-24: that was the six-rung tree; the canon's tech era 5 holds 26 (vanilla's 23 + the 3 minted; `config/tech_tree_options.json`) | S |
| C7 | The stray tracked root file `gdp_gap_series.tsv` (an output of `tools/testbed/ledger/analyse_gdp_gap.mjs`) | OPEN — remove or move with the release cleanup | S |

### R5 — the three technology icons: the specification (2026-10-21; no image generation here, the user draws or sources them)

Measured from vanilla's own 180 invention icons (`game/gfx/interface/icons/invention_icons/*.dds`, e.g. vulcanization, mechanized_workshops,
nitrogen_fixation):
- **File:** DDS, **256 × 256 px**, **uncompressed 32-bit BGRA** (A8R8G8B8 — masks R 0x00ff0000, G 0x0000ff00, B 0x000000ff, A 0xff000000), **full
  mip chain (9 levels, 256 → 1)**, 349,652 bytes. (The placeholder has no mips; it works, vanilla's all have them.) A 256 × 256 PNG with
  transparency is enough to hand over — converting it to this DDS is mechanical and can be done here.
- **Names:** `gfx/interface/icons/invention_icons/catalytic_synthesis.dds`, `continuous_web_processing.dds`, `spray_finishing.dds`; `emit_techs.mjs`
  then points each technology's `texture` at its own file.
- **Style:** ONE isolated object, no background, frame or text — 40–65% of the pixels fully transparent; painted, near-photographic rendering in
  a three-quarter view from slightly above; soft key light from the upper left; muted, low-saturation metal and wood; centred, filling ~85–90% of
  the canvas; anti-aliased edges.
- **Subjects** (each distinct from the vanilla icon of the technology before it):
  - **Spray Finishing** (furniture t3, 1923): a period compressed-air spray gun with its paint cup, a fine mist hitting a glossy lacquered panel or
    chair back. (Vanilla's lathe and mechanized-workshops icons are a lathe and a steam hammer.)
  - **Continuous Web Processing** (paper t3, 1930): steel drying cylinders with one unbroken white paper web running over them onto a large reel —
    the reel is the clearest read at small size.
  - **Catalytic Synthesis** (fertilizer t3, 1937): a tall VERTICAL converter or reformer column with pipework and a gauge, perhaps white fertilizer
    prills at its foot — vanilla's nitrogen fixation is a horizontal bolted high-pressure tube, so avoid that shape.

## 5. Found by the independent hunt

| # | Item | Status | Effort |
|---|---|---|---|
| H1 | Non-English players saw English names where vanilla translates: the 17 rung-0 keys overrode vanilla's translated names and lens texts; all 56 main-method names were English though 53 are vanilla methods with translations | DONE 2026-10-21 (vanilla building and method names and lens texts per language) | M |
| H2 | Crafts showed method groups whose only option is "off" (Bakeries: canning, distillery) — against §10.93; the drop was missing on `emit_secondaries`' rescaled path | DONE 2026-10-21 (emit_secondaries drops them; lint_pm_combos check 8 guards it) | S |
| H3 | Dam build tooltips probably listed every project of the class (10/13/38/61 branches) | CLOSED 2026-10-21 by in-game check 4: no requirement list renders | S |
| H4 | Dam decisions showed internals (`pmr_dam_bur_headroom > 1500` with no loc; a raw variable name) | DONE 2026-10-21 (the text pass: requirements as sentences, the AI cooldown hidden) | S |
| H5 | ~3,700 lines of dead `pmr_dam_driver` script shipped, registered nowhere | DONE 2026-10-21 (emitted only when registered; probe `20261021_132934_polish-dam-probe`: the AI still surveys and builds) | S |
| H6 | `00_starting_inventions.txt` shipped identical to vanilla (L14/L15 read it) | DONE 2026-10-21 (not shipped when identical; `verify_start_techs` and L14/L15 fall back to vanilla's) | S |
| H7 | Builds off the default Steam path: emitters hard-coded the game path although the README promises `VIC3_GAME` | DONE 2026-10-21 (the ten `.mjs` tools that hard-coded it read `VIC3_GAME` first, the form the others use); the remainder is H10 | S |
| H8 | Release logging: ~12k debug-log lines a century (dams 5.6k, research 6.3k) | RULED 2026-10-21 — **two build kinds**: DEBUG builds (run locally, full telemetry and logging) and RELEASE builds (designated explicitly; no telemetry or logging at all except a start-up manifest line saying mod version X is loaded). The 1.0 build (~27.10) is the first release build; the alternating batch runs on a debug build. To build: a release switch in `build.ps1` — not built yet (2026-10-24) | S |
| H9 | Compatibility footprint: the README should list the vanilla files the mod replaces wholesale | READY (with R3). Generate the list from the build: 83 files at the hunt (22 `company_types`, 16 `history/buildings` plus `replace_paths`, 13 `history/pops`, 15 `state_regions`, …); the reference fix added 63, so `mod/` holds ~146 vanilla-path files (2026-10-24). Map mods and company, technology or pop-history overhauls conflict silently by load order | S |
| H10 | Builders off the default paths, the part of the hunt's finding 9 that H7 left: `tools/preflight.ps1:64` hard-codes the game path (it reads vanilla's on_action names for L22 and falls back without the game), and the deploy writes to `$env:USERPROFILE\Documents\…` (`tools/build.ps1:1869`), which misses OneDrive-redirected Documents, a common Windows 11 default — `[Environment]::GetFolderPath('MyDocuments')` is correct | OPEN (found unaddressed 2026-10-24); builders only; a `build.ps1` edit, so after the batch | S |
| — | Error logs of six canon-family century runs against ten vanilla: **no error line names a mod file**; the only mod-caused classes were item 2's (gone in the final smoke run) | — | — |

## Text pass — the generated texts made uniform (DONE 2026-10-21; the user: "make sure that they're all uniform in style unless need to be, and match current mod design")

An inventory of every player-facing string the build writes (48 issues), then the rewrites: the research entries
(`emit_research_events.mjs`), the rung short names (`build.ps1`, `<key>_pmr_short` per language — what research texts and company
modifiers call a rung), the config labels (both canon copies and their generators; display only) and the dam texts (`emit_dams.mjs`;
presentation only — every dam file byte-identical but the decisions, whose changed lines are tooltips around the same triggers; 252 dead
keys no longer written).

**The style it set — new text follows it:**
- the "we / our" voice;
- one requirement template, `<what>: <mark> (now <figure>)`, a qualifier after a semicolon (e.g. "2.5 fully staffed levels of 5,000
  workers", "(now X); needs <tech>", "Literacy 52% (45% needed)");
- vanilla loc keys wherever vanilla names the thing (`$building_x$`, `$pm_x$`, `$law_x$`, `$STATE_X$`, `$region_x$`), and a rung by its
  short name, never its full building name;
- digits with thousands separators; American spelling, as vanilla;
- the typographic ’, never an ASCII apostrophe (a law name that carries one in some language stays out of a bar line — today only English
  "Workers' Protections");
- no script names, variables or internal words in front of the player.

| # | Question | Ruling |
|---|---|---|
| U1 | 31 dam projects are named "… Dam(s)" — rename them after the site? | LEFT AS THEY ARE (user, 2026-10-21; 33 names, counted) |
| U2 | Dam building names in the plural? | KEPT SINGULAR (user, 2026-10-21) |
| U3 | Should the craft rungs say they are crafts in their name? | RULED 2026-10-21: "Era 0 craft. <Building> (<method>)" (the user) — AMENDED the same evening by Q8 to **"Tier 0 craft. <Building> (<method>)"**; "craft" stays English in every language. Built |
| U4 | The dam build-requirement tooltip (H3) | CLOSED 2026-10-21 by in-game check 4: no requirement list renders, no change needed |
| U5 | Fractional marks: round to whole levels, or leave? | RULED 2026-10-21: every research mark rounded UP to whole levels, the halved ones included, BEFORE the batch (the user) — so the floored "(now N)" is always honest. Built (`research_events.marks_whole_levels`) |
| U7 | Vanilla's Krka Falls and Niagara Falls traits are left empty by the dams | RULED 2026-10-21: no state-level electricity bonus anywhere (the user: "Nothing can have a state-level electricity bonus"), so both stay empty. Krka's state, Dalmatia, is the one hydro-trait state with NO dam project; a Cetina project (~800 MW, one Mountain Power Station level) was proposed and DECLINED (user, 2026-10-21: "No Dalmatia dam site") |
| U8 | Research `_desc` = `$…_reason$` (no visible change; 336 duplicate bodies × 11 languages) | RULED 2026-10-21: yes, each `_desc` becomes a reference to its `_reason` (the user). Built |

## In-game checks (the user, one at a time, 2026-10-21)

| # | What | Result |
|---|---|---|
| 1 | A research entry's body, bar label and bar tooltip (Britain 1836, Bessemer Process) | ✅ the lines render. Changed on the user's notes (`0986b5f`): no literacy line in the tooltip (the body states it); "(now 8)", rounded down; the stage rule one sentence, "Each 36-month stage grants 50% of the technology’s base research cost"; the implementation counter shows no cap ("effectively 'this fires until the deed is done'") |
| 2 | The craft buildings' method groups and method names | ✅ no "off"-only groups; method names render |
| 3 | The dam survey decision, its requirements, the site trait and the survey entry | ✅ (on `mod_playtest_damcheck/`). The site trait shows only its name on hover — the game renders no description for it; the user: "I don't think it's that bad" — left as it is |
| 4 | The build-menu tooltip of a dam (U4 / H3) | ✅ no requirements listed at all; a dam shows in the build menu only once its site is surveyed |
| 5 | The tech-tree era dividers (R7) | ✅ Vulcanization in era IV, the three minted technologies in era V; the bands line up now that the tree is vanilla's + 3 |
| 6 | The translated building, method and research names in another language | SKIPPED by the user: "If someone doesn't bother to learn English and needs improved localisation, they can make a pull request … What I do is try to not diverge from vanilla when it doesn't cost me anything." The names come from vanilla's own keys; the build checks every rung name against vanilla English |
| 7 | The company throughput modifier names | ✅ "+15% Textile Mills (Dye Workshops) building Throughput" (J. & P. Coats). The requirement lines carry the building's full name because the engine writes them from `is_building_type`; a rename to match was declined (the user: "The naming isn't a problem, I just want to sure the game understands what's referenced"). The bonus names both non-craft textile buildings, Dye Workshops (t1) and the Sewing Machines building (t2, which also runs Electric Sewing Machines, t3), so every rung but the craft gets it (crafts are out of companies by ruling, and so cannot count toward founding one either). No line of the canon run's error.log names a company modifier, and vanilla's `modifier_types.md` says a modifier's KEY decides what it acts on. **Measured** in the canon's 1936 save (`20261019_225952` run 1): each textile mill's throughput minus economy of scale, less the same for the furniture / glass / paper mills in the same state (state and country modifiers cancel) — no prosperous textile company: dye workshops +0.007 (45 buildings), sewing machines +0.012 (39); a +5% company (Britain's HBC, Russia's RAC): +0.059 (5) and +0.064 (5), 7 of 10 within 0.02 of the bonus; a +10% company: +0.09 to +0.50 (16). So the engine applies the bonus to both rungs. Readings above the bonus are textile-specific extras, most likely the prestige-goods input bonus (`PRESTIGE_GOODS_INPUT_THROUGHPUT_BONUS` 0.2 × the prestige share of input value; the dye workshops of the basic-fabrics countries read about +0.2 above the bonus, their sewing-machine mills about the bonus) — a vanilla 1936 save shows the same overshoot (+10% company: +0.158 median, 41 mills) |

## Q — the second pass's decisions (all ruled 2026-10-21)

The user, the evening of 2026-10-21:
*"Now is likely the time to finalise everything except 1) picture assets 2) telemetry removal. Make another thorough pass, highlight everything."*
— after asking why the power-bloc and company research bonuses and the power-bloc food method had never come up (the sweep had filed
research and balance under "not polish", a table never put to the user). Q4 then set how the rulings land: canonised at once, measured by
the alternating batch.

| # | Decision | Facts | Ruling |
|---|---|---|---|
| Q1 | **Flat research bonuses sized for vanilla** — how far to scale them | Philips company (prosperity) +15 innovation cap and +5% innovation; Advanced Research III principle +5 cap **per level of the schools institution**, plus +5% spread and −5% ahead-of-time penalty; the Central Africa expedition modifier +10 weekly innovation (`02_event_modifiers.txt:492`); Cuba's modernisation success +30 cap, +15% production spread and research (`cuban_modifiers.txt:86`). The mod cut innovation base, cap base and the cap's literacy term to 25 (vanilla 50 / 50 / 150) and universities to 1/6, so a literate major's cap is ~0.26–0.33 of vanilla's and a flat add weighs 3–4× as much against it; multipliers scale on their own | ✅ **×1/3 on all four** — Philips +15 → **+5** cap, Advanced Research III +5 → **+1.5** cap per schools level, Cuba +30 → **+10** cap, the expedition +10 → **+3** innovation; the multipliers untouched. Restores each bonus's vanilla share of a literate major's cap. Built: `tools/emit_value_overrides.mjs` over config `vanilla_value_overrides` (vanilla values asserted; the company file edited in `emit_companies`' copy, the principle, the expedition and Cuba in whole-file copies read live from vanilla, every `has_dlc_feature` kept — the principles file has three `power_bloc_features` gates; each an ON_GAME_UPDATE coupling); BALANCE_FRAMEWORK §10.101.1 |
| Q2 | **Vanilla's event research grants** | 65 real `add_technology_progress` grants in 24 files: 3,500 ×16, 4,150 ×14, 6,000 ×13, 5,850 ×8, 2,500 ×8, 5,000 ×2, 4,000 ×2, 8,000, 6,250, 666. Vanilla sizes them as "an approximate third" of the era's technology cost (`common/technology/eras/00_eras.txt`: "When changing these, don't forget to update progress bonuses in events and JEs"), and the mod left technology costs alone (§10.97 item 6). Against a country's own weekly research a grant weighs 2× (a country on the base) to ~3× (a literate major on its cap) as much as in vanilla; against total technology gained (own research + the research entries, the majors at 0.97 of vanilla, F227) about vanilla's share. §2 revived the art chain's 4,150 / 6,000 / 5,850 grants | ✅ **LEFT AS THEY ARE** — a grant is a third of a technology, as vanilla sizes it, and technology costs are unchanged; unlike Q1's bonuses it is not a weekly rate |
| Q3 | **The Food Standardization 3 canning method** | One copy, `pm_vacuum_canning_principle_3_food`, on the only non-craft food building (Sweeteners, t1, which also runs Baking Powder, t2): the same inputs as plain vacuum canning, 83.42 groceries against 71.5 (vanilla 70 against 60 — the same ×1.17); vanilla's `is_hidden_when_unavailable` and principle gate kept (the principle sits behind `power_bloc_features`). The user: "this PM needs a balance decision". At base prices the value added over the inputs is 964 a level for vacuum canning and 1,322 for this one (vanilla 600 → 900); the host's main methods add 450 (Sweeteners) and 1,831 (Baking Powder). A bug found the same day: our `pm_vacuum_canning_food` carried vanilla's `replacement_if_valid = pm_vacuum_canning_principle_3`, a key our food building does not carry, so the engine's switch of a principle holder's buildings pointed at nothing | ✅ **85 groceries** (the user: "Round up for smoothness, go with 85 for bloc version") in place of the scaled 83.42; inputs and jobs unchanged (+19% over plain vacuum canning's 71.5). Built: one recorded override in `emit_secondaries.mjs` (it asserts the method exists and the scaled value it replaces), and the switch re-pointed at our copy (BUGS_AND_FIXES) |
| Q4 | **Ship the canon's measured balance as is, or move a book lever first** | F247 (n=4): 3 intact + 1 stall, consensus loss 8.21, world GDP 1.08, PI 0.96 not falling, pool W 1.00 at the soft line. Unchosen levers: the cost ladder C 1.8 × cost1 1.2 (F234: loss 5.37 against 7.28, measured on the x25 canon before the engine unlift, private dams and the threshold — unmeasured on today's canon) and paper's own lift (§10.101 item 5). The user's 2026-10-15 request: *"Final balance passes until going to polishing. Maybe 3-5 more n=8 runs … propose other approaches to cost1, in1, C, A and B to increase obsolescence but not kill early- to mid-game markets and overall GDP trends"* — never done, never waived in writing | ✅ (the user: *"We canonise all minor balance changes we make now instantly, and thus the n=16 will be run on the current canon."*): every minor balance change ruled in this polish goes into the canon at once, with no test batch of its own, and the alternating n=16 measures the canon as it then stands. Read (stated to the user): the cost ladder and paper's lift are not minor and wait for 1.1; the 2026-10-15 request for more n=8 balance batches is overtaken |
| Q5 | **Military research ~10 technologies behind vanilla; no tech-era-5 military technology held anywhere** | Tech spread ×2 and a society research multiplier were deferred (§10.97 item 8: "let's see how it all works, first"). Players see it, and 1.0 is the last release on game 1.13. Re-counted 2026-10-21 (`tech_census.mjs`, the canon F247 n=4 against October's vanilla n=6; total, then production / military / society): Britain 158.0 (56.3 / **41.0** / 60.8) against 159.5 (49.2 / **50.2** / 60.2), the USA 146.5 (49.0 / **40.0** / 57.5) against 159.3 (49.2 / **49.7** / 60.5); no country holds any of the ten tech-era-5 military technologies in any canon run, where vanilla ends with 1–8 holders of most | ✅ **LEFT FOR 1.1.** The approach the user expects to try first: *"a bit higher ai weights for military techs over societal techs over most production techs (exceptions with also higher priority on production where there are no JEs, like Shift Work)"* (BACKLOG C) |
| Q6 | **The dam consumers' recipes** | §10.89.1 deferred judgement "until tests"; its signal was electricity at the 175% ceiling in the majors' markets by ~1920. On the canon (F247, n=4) electricity reads 25–122% at 1920 (vanilla October 73–140%) and touches 175 in one American market in one run at 1930 — the dams supply cheap power the 4× plant cost does not touch | ✅ **KEPT AS THEY ARE** — the signal did not fire (§10.89.1) |
| Q7 | **Rubber (F242)** — the user's Qing playtest | The Qing's own industry wanted ~8× the world's rubber (world price at the ceiling 975 of 1,092 weeks); vanilla's 8-week no-reduction trade lock synchronises its trade centres into a 9–10-week import cycle. The canon's AI games show no such shortage (British market 104–129% of base at 1920 and 1930, F247). Our rubber rungs use about vanilla's rubber per unit of output (Rubber Grips 0.082 per tool against 0.091; telephones 0.30 per telephone against 0.33) — ~2× per level because a level makes ~2× as much. Our only amplifier is the trade unit (24 rubber per capacity unit against vanilla's 5, F159) | ✅ **ACCEPTED for 1.0** (the user: *"I don't see any feasible approach to solving it. I'm reasonably sure vanilla has this as well. While it is problematic (as phantom imports at scale allow for nullifying input shortages penalties when they should be accumulated), I don't think we can do much or should do much."*) — a 1.1 watch item (BACKLOG B) |
| Q8 | **"Era N" in building names against the game's tech eras** (the hunt's finding 7) | "Era 2" electrics are unlocked by a tech-era-4 technology; R1 already drops "Recipe BE" | ✅ **"Tier N"** (the user: *"Name 'Tier N'. Add 'craft' for Tier 0 when appropriate"*) — "Tier 2. Electrics Industries (Telephones)", the six crafts "Tier 0 craft. <Building> (<method>)" (U3 amended), a merged building "Tier 1-2. Paper Mills"; "Tier" stays English in every language, like "Era" did. The number is unchanged (the rung's tier). Built in `build.ps1`'s name format. The docs moved to the "tier" terminology the same night (the user: "every MD, dated records included; config and tool names stay era"); GLOSSARY §5 records the rename |
| Q9 | **`supported_game_version`** | 1.13.11 today; "1.13.\*" keeps a hotfix from marking the mod outdated | ✅ **"1.13.\*" for the release** — with R1's release metadata |
| Q10 | **The three minted top rungs are almost never reached** (F227: catalytic synthesis in 1 run) | Re-counted on the canon (F247 n=4, `tech_census.mjs`): spray finishing held by 2.0 countries a run (3 runs of 4), continuous web processing 2.3 (3 of 4), catalytic synthesis 0.8 (2 of 4) — as often as vanilla's own era-5 production technologies (October vanilla: compression ignition 1.0, oil turbine 0.3, arc welding 0.2) | ✅ **MOOT**. R5 stands as planned |
| Q11 | **Accept as watch items for 1.0** | AI schooling unmeasured beyond a smoke probe (F226); crafts as a channel into early revolutions (BACKLOG A); the percussion-cap chain (BACKLOG B); the monopoly threshold's decade-scale effect cannot be separated from private dams (F247) | ✅ **all four ACCEPTED as they are for 1.0** |

---

## Source notes — the two subagent reports of 2026-10-21

Both reports were read-only (nothing edited, built or launched) and stood here in full as Appendix 1 and Appendix 2 until 2026-10-24;
git keeps their text. Every item is carried.

**Appendix 1 — the sweep of items deferred to polishing** (22 items, checked against `mod/` as deployed 2026-10-21 10:36, the canon
config and the error.log of `20261019_225952_wm99-n4`):
- R1–R8, B1–B3, F1–F3, C1–C6 and N1–N2 → the §3–4 table above, same numbers.
- Its schedule for after the first round of polish: A1 the alternating batch (launched — Where it stands); A2 the reboot risk over the
  batch's days (BACKLOG G, L30); A3 `fill_research.mjs` on the retired six-rung tree (BACKLOG F); A4 `fill_consts.mjs`'s productive-workers
  defect (closed 2026-10-24, BACKLOG Done); A5 the vanilla references after the batch (BACKLOG F); A6 the questions the batch answers
  (the canon's century with private dams — already F247; the dam consumers — Q6; company mandates — F3; the urban-centre override —
  BACKLOG B; the red-flag twin — BACKLOG F); A7 harness changes only before or after a batch (`deviates_from_vanilla`, BACKLOG F).
- Deferred to mod 1.1: treaty ports (BACKLOG D, §10.103); the ON_GAME_UPDATE pass for 1.15.N, with the foreign dam builder's
  `has_max_level` re-test and the 1836 starting-technology check (L14/L15).
- Its out-of-scope lists: the research-entry texts → §1 (its residual, "tooltips should read in people, not levels", was overruled:
  levels); the vanilla references → §2, which also covered MISSING_PM_REFERENCES.md, the renamed secondaries, the `pm_events`
  industrialisation checks, the `has_building` narrowing and BUGS_AND_FIXES 2026-07-18's known limitation — but not the art academy's
  conditional desire in MISSING_BUILDING_CONDITIONS.md (BACKLOG E); the balance and research table → Q1–Q7 and BACKLOG B/C; the tooling
  debts (BACKLOG F/G — "paid when an item above needs them"; not polish) → BACKLOG F/G, where two were added 2026-10-24 (the post-run
  check for a tier technology held by nobody, and the readers still on the summer vanilla n=16).

**Appendix 2 — the independent pre-release hunt** (the canon mod built 2026-10-21 10:36, and the error logs of six canon-family centuries
— runs 2–4 of `20261019_225952_wm99-n4`, runs 1–3 of `20261016_092158_rs-m10ac-n3` — against ten vanilla runs):
- Findings → items: #1 README → R3, H9 · #2 vanilla throughput modifiers reaching only rung 0 → §2 · #3 English names → H1 · #4 "off"-only
  craft groups → H2 · #5 dam build tooltips → H3 · #6 release metadata → R1, R2, Q9, C7 · #7 "Era N" against the tech eras → Q8 ("Recipe
  BE" unexplained → R1 removes it) · #8 dam internals → H4, R8 · #9 the game path and the deploy path → H7, H10 · #10 starting inventions
  → H6 · #11 dead dam driver → H5 · #12 no-op define → C1 · #13 logs and the compatibility footprint → H8, H9.
- **Its error-log scan** (entries classified by source, normalised message and script location; each mirror begins at the game's own log
  rotation). 0 error lines named a mod file (`zzz_pm_rehaul*`) or a `pmr_` key in any canon run; no load-time errors (no duplicate keys,
  no unknown modifiers, no `defines.cpp` rejection; debug.log "successfully matched game version 1.13.11"); totals without the navy-model
  flood: canon 10k–72k lines a run, vanilla 12k–152k. Mod-only classes then: `is_production_method_active` PostValidate (6/6 runs) and
  `production_tech_events.txt:460–461` (4/6: event 300, telephone, fired on the building check while its `immediate` needed
  `pm_telephones`) — both item 2's class (no invalid-production-method line in the final smoke run, 1836→1841). Classes that look mod-only but are vanilla and playthrough-dependent: `country_bic.txt:1270`
  "state vs state_region comparison" (3/6 canon, 0/10 vanilla — vanilla's own `this = s:STATE_HYDERABAD` inside `any_scope_state`);
  `ip3_hungary_events`, `ip4_cuba_values`, `india_non_cooperation` (one run each); `trade_route_events` invalid object (also 3/10
  vanilla); the `concept_religious_trait` data-function failures (also in vanilla). Generated content was clean then: the same 3,671 loc
  keys in all 11 languages with correct headers and BOMs, no broken `$ref$`; every decision, journal entry, building, method, group,
  state trait, technology and progress bar named; all 644 icon and texture paths present; all 2,377 modifier names defined; no probe-only
  keys in the canon config; the Documents copy identical to `mod/`. ⚠ Headless runs render no GUI, so tooltip-only failures cannot show in
  these logs — the in-game checks above covered that; a DLC-less install was untested (scheduled, above).
