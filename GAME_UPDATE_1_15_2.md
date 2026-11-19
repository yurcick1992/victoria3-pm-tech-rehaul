# The 1.15.2 update register — game 1.15.1 → 1.15.2, mod 1.1.1 → 1.1.2

One line per change the update raises: its id, its class, what changed, what of ours it touches, the decision and its status, and where it is
argued. The procedure is the `game-update` skill (`.claude/skills/game-update/SKILL.md`); the coupling inventory and the reference tables are
ON_GAME_UPDATE.md §2 and §5. Opened 2026-11-19. It closes at the 1.1.2 release with every line DONE, RULED-and-built or DROPPED.

**Classes:** **N** new · **R** removed or renamed · **C** changed value · **B** engine behaviour · **T** a task of the pass itself.
**Statuses:** **OPEN** (to find out or to decide) · **RULED §x** (decided, not built) · **DONE** · **DEFERRED** (with where to) · **DROPPED**.

**The user's rulings on the pass (2026-11-19):** *"we push a small compatch today (1.1.2), and then run a batch of 1.15.2 vanilla runs to get
the reference points. After that, the balancing iterations start for 1.2, which will be built over 1.15.2, or whatever the current vanilla
version will be at that moment."* So mod 1.1.2 is a compatibility patch of the 1.1.1 canon on game 1.15.2: vanilla's 1.15.2 changes carried
into the files and values we own, no balance change of our own. The three-arm batch `20261116_005659_g1151-alt-pmr15-vanilla5-canon5` ended
on 1.15.1 (`SCHEDULE DONE` 2026-11-19 17:43 local) before Steam installed 1.15.2, so no session straddles the patch.

**The patch notes** were given by the user in full (forum post of 2026-11-19, checksum `fb14`); the lines below cite them by section
(Features, Improvements, AI, Balance, Content, Modding, Bugfixes).

## Phase 0–1 — the versions kept, the intake

- **W01** · T · keep 1.15.1 · DONE 2026-11-12 (GAME_UPDATE_1_15_1 V02): `C:\claude-code\vic3_game_1.15.1`, Steam build 26591675, exe sha256
  `fb4ec0698afd3d3b…`. Checked 2026-11-19: the installed game is still that build (`appmanifest_529340.acf` `buildid` 26591675, the exe dated
  2026-11-11 17:19), so the copy is of the version 1.15.2 replaces. No `script_docs` dump exists for 1.15.1; the exe strings stand in.
- **W02** · T · keep 1.15.2 · DONE 2026-11-19 18:55: Steam held the update back ("Update delayed for 48888 secs") until the user started it;
  committed 18:54:45 local (build 26763837, checksum `5bae45566db1e7b04a72a3a77db2fb14`, the notes' `fb14`). Kept at
  `C:\claude-code\vic3_game_1.15.2` (362 MB; `game\common`, `events`, `map_data`, `localization`, `gui`, `binaries\victoria3.exe` +
  `checksum.txt`, `launcher-settings.json` "1.15.2 (Ivan-Chai)"); exe sha256 `57c4950e9f1046d6…` (`binaries_hash.txt`).
- **W03** · T · the version boundary · DONE (ON_GAME_UPDATE §3): the last session on 1.15.1 is `20261116_005659`; no session has run on 1.15.2.
  The user set Victoria 3 to *Only update this game when I launch it* on 2026-11-19 (`AutoUpdateBehavior` 1), closing GAME_UPDATE_1_15_1 V03.
- **W04** · T · the intake · DONE: `node tools/game_diff.mjs C:\claude-code\vic3_game_1.15.1\game C:\claude-code\vic3_game_1.15.2\game` (4,392
  lines; the first full diff between two kept versions; the session's scratchpad). The good order, the pop types and the interest groups are
  unchanged (§5 of the diff). **46 of the mod's owned vanilla files changed** (a byte comparison of the two trees on every non-`zzz_pm_rehaul`
  file of `mod/common` and `mod/events`): `ai_strategies/00_default_strategy`, `amendments/00_amendments_enactment_04`, all 21 changed
  `company_types` files, 13 of the 16 `history/buildings` files, `journal_entries/00_communism` and `08_tsarpoints`,
  `production_methods/01_industry`, `script_values/ip5_je_values`, `scripted_effects/00_victoria_scripted_effects`,
  `scripted_progress_bars/00_victoria_progress_bars`, `scripted_triggers/00_scripted_triggers`, `static_modifiers/00_code_static_modifiers`
  and `02_event_modifiers`, `events/russia_events/ip5_russian_events_03`. Mod 1.1.1 overrides all of them with its 1.15.1 copies, and three of
  those break 1.15.2 content for its players: the eleven new `amendment_<party>_dominance` amendments (named by every party) are missing from
  our amendments file, `set_sps_dominant_party_effect` (called by the new `single_party_state.8`) from our scripted effects, and
  `regime_change_target_allowed_trigger` (called by the regime-change diplomatic action and war goal) from our scripted triggers. So
  Single-Party State's new party choice and regime change misbehave under 1.1.1 until 1.1.2 ships.

## The notes, item by item (first reading, 2026-11-19, before the diff)

What the notes say bears on something of ours; the diff will add what they do not say and settle what they do.

**Files we own — mod 1.1.1 overrides these 1.15.2 fixes until 1.1.2 is built from the new game (the trap of ON_GAME_UPDATE §1 point 1):**
- **W10** · C · companies (Bugfixes): MALAXA requires Motor Industries instead of Automotive Industries; Kharitonenko and Son is partly owned by
  Aristocrats · we own all 23 `common/company_types` files (`emit_companies.mjs`, the company chain extension §10.64); MALAXA's
  `building_types` already list the motor rungs, the changed field is elsewhere in its block · DONE (rebuilt from 1.15.2: MALAXA's formation test and its construction target follow vanilla to motor, W16; the
  formation requirement on motor reaches every motor rung, as GAME_UPDATE_1_15 line 40's rule does for `has_building_levels_in_state_region`).
- **W11** · C · the 1836 map (Improvements, Bugfixes): Texas gets a port instead of its naval administration; Finland and Travancore start with a
  naval administration · we own all 16 `common/history/buildings` files (the converted start, CLAUDE.md §5.4) · DONE (rebuilt; W14 lists the whole 1836 change;
  neither building is tiered; `extract_start.ps1` and the start-conversion lint confirm).
- **W12** · C · journal entries and events (Content, Bugfixes): Russia (the Holy Synod decision, the Ruler of the East treaties' infamy and
  tooltips, the Chinese treaty partner check, Maintain Russian Dominance, Empowered Ukase in subject states), Brazil's Populist Unrest, the
  Spectre Haunting the World, State and Revolution, King-in-Parliament, Re-establishing New Spain, Single-Party State, the Socialist World
  Republic · we own 12 `common/journal_entries` files and 26 event files (TIER_REFERENCE_AUDIT; `emit_vanilla_refs.mjs`) · DONE (the diff: `00_communism` and `08_tsarpoints` of ours changed, now 1.15.2's with our edits, W04; which of the
  changed files are ours: the diff).
- **W13** · C · laws, scripted effects/triggers/values, static modifiers (Improvements, Balance: Regime Change, Official Nationality, Single-Party
  State, the battle-casualty modifiers) · we own 2 law files, 4 scripted-effect, 2 scripted-trigger, 2 script-value and 21 static-modifier
  files · DONE (the diff, W04: the changed owned files are 1.15.2's copies with our edits; every lint passes).

**Removed and new script vocabulary (Modding):**
- **W20** · R · the subject-type key `breaks_if_subject_not_protected` and the on_actions `on_diplo_play_subject_released` /
  `_overlord` are removed · neither appears in the built mod (grep of `mod/`, 2026-11-19); `save_state_summary.mjs` reads `common/subject_types`
  live and does not use the key · DONE (the reference scan L40 and the vanilla-name lint pass on the 1.15.2 build).
- **W21** · N · a new effect `conclude_journal_entry` (concludes a journal entry with a given outcome) · a possible tool for the research
  entries, which end on the technology's acquisition today · DEFERRED to mod 1.2 (an adoption question; BACKLOG already holds "concluded research entries out of the journal").

**Engine behaviour that the mod's economy runs through (phase 3; measured by the 1.15.2 vanilla batch, not by the compatch):**
- **W30** · B · AI company formation (AI: "an issue that was frequently preventing the AI from successfully forming companies") · companies
  carry every rung of their industries (§10.64) and their throughput bonuses scale goods, not wages · read on 2026-11-19 (session scripts,
  not kept): on 1.15.1 the non-minors (≥ 1% of world GDP) filled their company capacity as well as on 1.13.11 — 18% of them below capacity in
  1936 against 24%, 0.20 slots unused against 0.26, almost always one short; the company-held share of goods producers' value added fell
  instead (world, 1936: 47.3% on 1.13.11, 43.7% on 1.15.0, 41.3% on 1.15.1). Capacity rebuilt as the five society technologies + Technocracy
  (base 0; 98% of country-years at or under it). Prediction for the 1.15.2 vanilla batch: company counts about unchanged; the company-held
  share is the reading to watch · DEFERRED to the vanilla 1.15.2 batch (W50).
- **W31** · C · military goods (Balance): default frigate and ship-of-the-line templates no longer need copper; troopships take grain instead of
  groceries, less artillery and engines, and no copper or coal · copper is the top input-price red flag on 1.15 (canon ~100 flag-years,
  vanilla ~62, F268); §10.110.4: our copper approach follows Paradox's · DEFERRED to the vanilla 1.15.2 batch (W50: copper and the war goods).
- **W32** · B · the map's stability (AI, Bugfixes, Balance): subjects no longer break free when a war starts without their overlord defending
  them; AI naval invasions progress; Belgium no longer starts wanting to conquer France; AI Austria no longer grants Hungary autonomy early;
  the Spectre and State and Revolution more threatening; a civil war country no longer stays revolutionary · the shortlist's territory and
  the seed spread; L38 (country records lost to civil wars) · DEFERRED to the vanilla 1.15.2 batch (W50).
- **W33** · B · casualties and conscription (Balance, Bugfixes): Recovery and Kill Rate shift a share of casualties between dead and wounded;
  Peasant Levies can conscript protected peasants · U\* counts peasants (CLAUDE.md §3.2) · DEFERRED to the vanilla 1.15.2 batch (W50; small).
- **W34** · B · trade (Improvements, Bugfixes): a lock and grace period on tariff and subvention switches; split states no longer border
  themselves (wrong "isolated state" trade blockers); ports and trade centres can auto-expand · trade weights (§10.88), treaty ports
  (§10.103) · DEFERRED to the vanilla 1.15.2 batch (W50).
- **W35** · B · fleets (Features, Bugfixes): sunk ships can be replaced automatically (a per-fleet toggle); defeated fleets recover once
  repaired and crewed as far as their sailors allow · the fleet path loop is absent on 1.15 (F270) and the summaries cannot see fleet paths
  (L52) · DEFERRED to the vanilla 1.15.2 batch (W50: play time).

**Found by the diff, not in the notes:**
- **W14** · C · the 1836 map, much more than Texas (`common/history/buildings`, 153 states; a content diff by state × owner × building, the
  session's `hist_buildings.mjs`: 181 changed entries) · trade centres −37 levels in 36 entries, logging +41, sulfur +11, shipyards −12;
  in the tiered industries: **China's glassworks redistributed** (Nanjing 10 → 3, Shandong 10 → 4, Zhili 6 → 0, and 2–4 levels new in
  nineteen other Chinese states), **Britain's food industry** (Leinster 4 → 16, East Anglia 5 → 8), **pot stills taken off every 1836 food
  industry** (`pm_disabled_distillery` in 13 states), Paris furniture 9 → 6, Britain's paper (Home Counties 5 → 8, Wales 5 → 7), Spain's arms
  1 → 4, a Swedish artillery foundry, Pennsylvania steel 2 → 3, Yorkshire motor 3 → 2, and more · the converted start re-tiers vanilla's
  map in every build (CLAUDE.md §5.4), so the canon's 1836 follows; the craft rungs follow it (the dry run: 231 craft buildings in 156
  states, from 218 in 149; 3,481 seeded craft levels, from 3,448) · DONE for the build. The craft seeding's
  `config/measured_1836_pop_identity.json` is a 1.15.0 vanilla 1836.2.1 save's (the pops history did not change; spare infrastructure
  and peasants at 1836.2.1 may, with the ports and buildings) · DONE (W45).
- **W15** · C · `pm_pot_stills` glass 4 → 5, copper 1 → 0, liquor 60 → 50, groceries −25 → −15; `pm_patent_stills` glass 7 → 5, copper
  3 → 5, liquor 100 → 75, groceries −40 → −20 (the second still pass in two hotfixes, GAME_UPDATE_1_15_1 V07) · our food secondaries are
  emitted from vanilla's live; the only change in `ui/vanilla.js` (`extract_vanilla.ps1`) · DONE (no book field).
- **W16** · C · companies, beyond the two in the notes (121 company types): every flavoured company's `possible` gains its home state
  region and `is_incorporated = yes`; the basic companies' `ai_will_do` drops its building-level test for `always = yes`; MALAXA's
  formation test and `ai_construction_targets` move from automotive to motor; Kharitonenko gains `category = aristocrat_owned` ·
  `emit_companies.mjs` re-derives every company from the installed file: 63 OR-wrapped triggers (from 81: the dropped `ai_will_do` tests),
  +186 `ai_construction_targets` entries (from 185: MALAXA's on motor) · DONE (mechanical on rebuild).
- **W17** · C · the AI (vanilla AI changes are questions, memory `update-pass-ai-changes-are-questions`): `NAI.AUTONOMOUS_INVESTMENT_COMPANY_
  TARGET_BUILDING_TYPE_CONSTRUCTION_FACTOR` 5 → 20 (private investment's weight on a building type a company of the country targets);
  `NAI.COMPANY_TYPE_FORMABLE_MULTIPLE_FREE_SLOTS_FACTOR` removed; `ai_strategy_default`'s journal-entry state values re-ordered (the
  Ecumenical Question added); every agenda's `max_regressiveness` re-cut around Factory Councils; `ai_subject_value_state_value_fraction`
  new · we set none of these keys (the book's `ai_defines` are seven others, all still present in 1.15.2); `00_default_strategy.txt` is
  ours and carries vanilla's changes on rebuild. The define touches us: our companies' `ai_construction_targets` list every rung of their
  industries, older ones included (`emit_companies`: "0 gated to the best unlocked rung"), and private investment now weighs those targets
  four times as much as on 1.15.1 · RULED (Q2: passes through; read in the first 1.2 runs, W51).

## Phase 2 — breakage: the mod builds and is correct

- **W40** · T · the extracts (routine step 3) · `extract_start.ps1`: 408 split-industry factories, no `DRIFT` line (no main method renamed or
  added); `extract_vanilla.ps1`: the two stills (W15) and nothing else · DONE.
- **W41** · T · the dry run (step 4), the canon on 1.15.2 · `build.ps1 -DryRun`: MOD CHECKS PASSED, PREFLIGHT PASSED, DLC gates (148 files
  replaced, 27 gated, every gate kept), vanilla names, the protected-vanilla check, LINT, negative goods, solvency, tech content, start
  conversion, the era rule, PM combinations. Against the 1.15.1 canon build of run 24 of `20261116_005659`, the count lines moved only
  where vanilla did (W14, W16): 3,406 history entries (3,409), the craft lines, the company lines · DONE.
- **W42** · T · the regeneration (step 5) · `node tools/replay_canon_chain.mjs --prefix g1152`, then the five recorded 1.15 steps (bz, dcu, ra,
  il; `build.ps1 -SaveTo g1152il -NoDeploy` of the il book; aw with `--mod mod_g1152il`) → `config/mod_config.g1152-canon-bz-dcu-ra-il-aw.json`
  + twin. The AI-weights step restores the same six technologies and declines the same twelve. **Field diff against the canon
  (`697d4869`): 2,150 leaf paths, 2 changed, both record labels (`tech_ai_weights.rule` and `.game`: "1.15.1" → "1.15.2"); the twin: its
  timestamp only.** Every key of the book's `ai_defines` is in 1.15.2's `00_ai.txt`; `WORLD_MARKET_MONOPOLY_THRESHOLD` is still registered in
  the exe · DONE (the book); which book ships is OPEN (Q1).
- **W43** · T · the smoke test (step 9) · `20261119_191707_g1152-smoke`, `SCHEDULE DONE` 3/3 at 19:44: the canon (`697d4869`) and a control
  1836 → 1846, a control 1836 → 1836.4.1 on monthly autosaves. The canon: the version line "successfully matched game version 1.15.2", `init OK`,
  the craft level-count tripwire holds, every DLC mounted, no crash, research entries firing (82 `PMR_` lines by 1846). `error.log`, every
  class judged by what it refers to and by its count against vanilla, not by its path (TESTBED_OPERATIONS §4 item 3, ruled the same
  evening): canon 187 lines, control 295. **Ours:** the lexer's "should be in utf8-bom encoding" on `common/buildings/01_industry.txt` and
  `06_urban_center.txt` (W44), and the telemetry's `v3tb_dz_p1` variable line (both arms; harness only). Every other class of the canon run
  appears in vanilla 1.15.1's fifteen runs, mostly in all fifteen, but one: `remove_lobby_member … not a member from lobby`
  (`soi_events/00_lobbies_events_04.txt:3275`, unchanged in 1.15.2), one line here and 2 lines in 2 of 30 modded runs on 1.15.1 (ours and
  PMR's), none in 15 vanilla; its chain names nothing the mod changes; UNEXPLAINED, rare. Rates in our arm on 1.15.1 run about 1.2–1.3 ×
  vanilla's on several playthrough classes (lobby events 5,011 against 3,909 lines over fifteen runs) · DONE.
- **W44** · T · the BOM regression found by W43 · `emit_ai_value_adds.mjs` (2026-11-08) wrote the two building files back without their
  BOM; shipped so in mods 1.1.0 and 1.1.1. Fixed (the write prepends it); landmine L53 (`tools/lint_bom.mjs`, every build), proven to fail on
  `mod_g1152il` and on the 1.1.1 release build and to pass after the fix; BUGS_AND_FIXES 2026-11-19 · DONE. Internal: no changelog line.
- **W45** · T · the 1836 pop-identity snapshot (W14, routine step 6) · refreshed from the 1836.2.1 save of W43's run 3 (1,157 states, 449
  countries, as on 1.15.0): small 1836.2.1 movements (2,539 country and 2,278 state fields), more infrastructure in use. The dry run after it:
  3,480 seeded craft levels over 157 city states (3,481 over 159 before), **756 seeded levels spilled past each country's five most urbanised
  states (467 before)**, as vanilla 1.15.2's 1836 leaves less spare infrastructure there · DONE (mechanical: the ruled seeding rule on
  vanilla's new data).
- `supported_game_version` is "1.15.*" already; the mod's own `version` becomes 1.1.2 at release (the `release` skill).

## Phase 6 — re-measure

- **W50** · T · the vanilla 1.15.2 reference batch (routine step 10: `VANILLA_REF`, `VANILLA_WALL_REF`, `measured_base_wages.json`, the
  error-noise catalogue) · DEFERRED to the next session, as five centuries of vanilla 1.15.2 (the user, 2026-11-19: "the vanilla 5 runs will go
  in the next session, and the 1.2 work -- in the one further"); its go-ahead is asked there. The questions it answers for this pass: W30
  (company formation; the prediction: counts about unchanged, the company-held share the reading to watch), W31 (copper and the war goods),
  W32–W35 (the map's stability, casualties, trade, fleets and play time).
- **W51** · T · what the company-target define does to our old rungs (W17, Q2) · DEFERRED to the first 1.2 runs (BACKLOG B).

## Phase 7 — release and record

- **W60** · T · mod 1.1.2 · DONE 2026-11-19: `metadata.json` version 1.1.2 and the name in the Workshop title's form (the user: "[1.15] No
  Free Upgrades: An industrial realism overhaul. Version 1.1.2"); `build.ps1 -Release`; README's replaced-file list (163 files, 29 folders);
  `verify_release_build.mjs --version 1.1.2` RELEASE BUILD VERIFIED on commit `5223be7`; the five texts in `release_notes/1.1.2/` (the checker:
  all pass; one count corrected, 79 vanilla files transformed where 1.1.1's texts said 78); CHANGELOG 1.1.2, KNOWN_ISSUES for 1.1.2. Uploaded and
  published by the user the same evening (the change note at 20:21 local; the Workshop title "… Version 1.1.2"); tag `v1.1.2` on `5223be7`; the
  change note as published `CHANGELOG_WORKSHOP/1.1.2.txt`, the draft's word for word. Not read back: the forum posts and the Workshop
  discussions as published (the user pastes the forum's from the editor's BBCode view if wanted).

**The register is closed for 1.1.2**: every line is DONE, RULED-and-built, DEFERRED with its destination, or a question answered.

## Phase 5 — the questions (2026-11-19)

- **Q1** · which book is 1.1.2's canon · NOT A QUESTION (withdrawn 2026-11-19): the two books build the same mod (the two labels are not
  emitted: `emit_tech_finish.mjs` reads `tech_ai_weights.techs` only), so the canon stays `697d4869` and no canonisation happens; the replay
  `g1152-canon-bz-dcu-ra-il-aw` is kept as the proof that the chain reproduces it on 1.15.2.
- **Q2** · W17's AI changes · RULED 2026-11-19 (BALANCE_FRAMEWORK §10.122): the user's standing rule, *"It's always yes, unless they
  affect us, and discuss details if they do"*; of W17 only the company-target define affects us (our companies' construction targets list
  every rung, and the ungated per-rung targets once kept old rungs rebuilt in companies' home states, emit_companies' 2026-09-02 note);
  offered (a) pass it through, (b) hold it at 1.15.1's 5 in the book, (c) the target gate back on; **the user chose (a)**: 1.1.2 runs
  vanilla's 20, and the first 1.2 runs read what it does to old rungs (§10.121's term) and misplaced capital · DONE (nothing to build).
- **Q3** · the smoke test of W43 · go-ahead 2026-11-19 ("Sure, as soon as we're done with the decisions"): schedule
  `tools/testbed/schedules/g1152_smoke.json` (canon and control to 1846, a control to 1836.4.1 on monthly autosaves for the 1836.2.1 save) ·
  RUNNING.
