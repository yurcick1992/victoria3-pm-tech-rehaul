# The 1.15 update register — game 1.13.11 → 1.15, mod 1.0 → 1.1

One line per change the update raises: its id, its class, what changed, what of ours it touches, the decision and its status, and where it is
argued. The procedure is the `game-update` skill (`.claude/skills/game-update/SKILL.md`); the coupling inventory and the reference tables are
ON_GAME_UPDATE.md §2 and §5. The register is opened by the preliminary reading of 2026-10-30 (moved here from ON_GAME_UPDATE §4 on 2026-11-07,
verbatim, as the appendix below) and filled by the pass. It closes at the 1.1 release with every line DONE, RULED-and-built or DROPPED.

**Classes:** **N** new · **R** removed or renamed · **C** changed value · **B** engine behaviour · **T** a task of the pass itself.
**Statuses:** **OPEN** (to find out or to decide) · **RULED §x** (decided, not built) · **DONE** · **DEFERRED** (with where to) · **DROPPED**.

**The user's rulings on the pass (2026-11-07):** one register file per version; everything that can be done without disturbing the n=64 batch
(`20261030_233342_alt-canon48-vanilla16`) or its report is done now, and the rest goes to the next session that works on the 1.15 adoption, not to
an intermediate one.

## Phase 0–1 — the old version kept, the intake

- **U01** · T · keep 1.13.11 for the diff · the game tree and the exe are in `C:\claude-code\vic3_game_1.13.11` (outside the repository) · DONE
  2026-11-07 (ON_GAME_UPDATE §3).
- **U02** · T · the engine's 1.13.11 vocabulary (`script_docs`, `dump_data_types`) · no game file holds it · the batch session runs the dump at its
  `SCHEDULE DONE`, before its report, with no mods and an exe-hash guard against a Steam update; the strings of the kept exe are the fallback ·
  DONE 2026-11-08 as the FALLBACK: the command-line route does not work. On the 1.13.11 exe, with no mods, every launch carrying
  `run_console_action_main` (as `-…=script_docs`, `--…=script_docs`, `-… script_docs`, with and without `-debug_mode` and `-handsoff`) quits
  with exit code 0 within 2–10 s, before the game writes a log; the same launch without it starts (logs written in 2 s), and `-debug_mode`
  alone starts. So no 1.13.11 script_docs or data-types dump exists, and `game_diff.mjs` section 6 reads the two executables' identifier
  strings (`--old-exe C:\claude-code\vic3_game_1.13.11\binaries\victoria3.exe`). The exe does carry both console commands, so a 1.15 dump
  is made BY HAND in game: a `-debug_mode` launch, the console (`` ` ``), `script_docs`, then `dump_data_types` (where the files land is not
  yet seen on this machine: look under the user folder `Documents\Paradox Interactive\Victoria 3\` first). ⭐ The same evening Steam's content log showed that it had tried to COMMIT the update on 2026-11-05 13:04 during a batch run
  (6,132 files) and stopped on `File locked` (`game\sound\banks\Ambient.bank`, held by the running game). Nothing was moved: no file of the
  install is newer than 2026-11-05 12:00 and the staged tree is whole in `steamapps\downloading\529340`, so the batch and the snapshot are
  1.13.11 throughout.
- **U03** · T · the entity diff · `tools/game_diff.mjs`, written 2026-11-07 and tested on 1.13.11 (no change found) and on synthetic changes · run
  it 1.13.11 → 1.15 when 1.15 is installed; every item it prints gets a line here · RUN 2026-11-08 (1.15.0 installed 05:02 local): 45,155 lines,
  kept outside the repository in the batch session's scratchpad (`u115/game_diff.txt`; regenerate with the command above). The counts: goods
  53 → 54 (copper), buildings 115 → 122 (the copper mine, Cossack Hosts, five Russian monuments), production methods 436 → 450, method groups
  197 → 203, technologies unchanged in number, state regions 781 → 782, defines +222 (58 removed; most of the 163 "renames" are one-line
  defines paired by equal values, not renames), journal entries +30 (17 removed), `on_journal_entry_completed` removed. The diff's items that
  bear on us are the lines below (U13, U21, U22, U41, U44, U47 confirmed or widened); the walk of sections 4–6 (changed fields, order, the exe
  vocabulary) is still OPEN — it is the next session's first reading.
- **U05** · T · the phase-2 dry run on 1.15 (2026-11-08), fix by fix, every one a spec table or a recorded count (none an assertion):
  `emit_companies` gains a rule for 1.15's `has_building_levels_in_state_region` formation tests (59: one copy per rung in an OR, the
  `is_building_type` wrap's reading); the Balakovo dam's state `STATE_TARTARIA` → `STATE_SARATOV` in `config/dam_projects.json` (its anchor province
  moved with the rename; the 143 other sites unchanged); `emit_vanilla_refs`: `00_art_jes` 9 → 12 token rewrites, G2 moved to
  `00_victoria_progress_bars`, nine new files ruled A79–A86 by the standing rules (TIER_REFERENCE_AUDIT), two ACCEPTED. The dry run then stops at the
  start-conversion lint (L13): `pm_bronze_cannons` / `pm_bronze_smoothbores` map to no rung — U44, which needs the generator. Steps not yet reached:
  the research entries (U21), secondaries, the remaining linters. · DONE 2026-11-08: with U44 built (`make_tier4_config` leaves the variants out of
  the ladder) and U28's gate, `build.ps1 -DryRun -Config config\mod_config.g115-canon-bz-dcu.json` passes on 1.15.0 — every linter (L31 on 58
  rungs, the combination lint on 1,317 combinations, 45 electricity-consuming methods gated), `MOD CHECKS PASSED`, `PREFLIGHT PASSED`.
- **U06** · T · the regeneration (ON_GAME_UPDATE §1 step 5; never skipped) · `tools/replay_canon_chain.mjs` re-runs the canon's recorded chain and
  copies its hand steps; PROVEN on the kept 1.13.11 game (`--prefix r113`: the canon field for field, 0 differences by `tools/book_diff.mjs
  --ignore _`), then run on 1.15.0 (`--prefix g115`) + `make_variant_config` (U44) + `make_dam_inputs_config` (U42) → the candidate
  **`config/mod_config.g115-canon-bz-dcu.json`** (committed, NOT the canon). Its field diff against the canon, in full: copper enters five rungs
  exactly where vanilla 1.15's own methods put it, value for value at base prices — textile t3 electric sewing machines (tools 12 → 9.6 + copper
  2.4), motor t2 electric engines (steel 33.9 → 32.8, electricity 25.4 → 16.4, + copper 8.2), munition t1 percussion caps (lead 24 → 18 + copper 6),
  munition t2 explosive shells (lead 33.2 → 22.1 + copper 11.1), electrics t2 telephones (lead 39.4 → none, iron 39.4 → 19.7, + copper 59); the two
  bronze variants (U44); copper's traded quantity 8.49 (U45); `dams.inputs_per_50` (U42). Nothing else moved: no staffing, no building cost, no
  technology era or prerequisite, no other input, no urban-centre key (U43). The tree twin is unchanged but for its timestamp. The `ai_defines`
  keys: U35's walk. · DONE; its canonisation is Q1 of the open questions below.
- **U07** · T · ⚠ **rakaly v0.8.19 cannot melt a 1.15 save**: `rakaly exited 1 … 0d04` on every autosave of the first 1.15 probe (10 of 10 by
  1846), so the harvest writes no save summary on 1.15 — and the register's GDP, W, U\*, H, T0–T3, misplaced capital, the downsizing comparison
  and every save reader go dark on 1.15. Telemetry (markets, research entries, events) is unaffected. rakaly compiles the games' tokens into each
  release; the newest is v0.8.22 (2026-10-13, before 1.15's release on 2026-11-05), so whether any release reads 1.15 is unknown. The failed saves
  stay on disk (the harvest deletes a save only once its summary verifies) and can be re-harvested — but a century batch on 1.15 then keeps
  every yearly save (~40 MB each late in a run; L44's disk watch matters) · OPEN (Q3): it blocks U60 / U62 · cost: one download to try.
  **WORKED AROUND 2026-11-08:** the melt stops at the save's LAST section (`state_has_building_group_levels`, new in 1.15), after every section
  the summariser reads; `save_state_summary.mjs` now keeps the summary in that one case (a bare token error, that trailing section, every wanted
  section read; `provenance.melt_tail_error` records it) and still throws on any other failure. Proven on the probe's 1856 autosave (401
  countries; Britain runs bronze cannons on 2 of 3 foundry levels) and refused on the same save cut short. The other melting readers
  (`melted_*.mjs`, `score_save.ps1`) still stop; a rakaly release with 1.15's tokens remains the real fix.
- **U08** · T · `save_state_summary.mjs` reads its tables (goods, pop types, interest groups) from `--game` (default the Steam path), not
  `VIC3_GAME`, and `harvest_saves.ps1` passes none; it throws on a changed pop-type or interest-group count but not on the goods count. A 1.13.11
  save summarised now would put 26 goods (hardwood onward) one place off with no error. Nothing is corrupted (the n=64 batch's last summary was
  written before the update) · the skill's trap and ON_GAME_UPDATE §2.3.3 say `VIC3_GAME`, which this reader ignores · OPEN (mechanical: a
  goods-count guard against the save, and `--game` from `VIC3_GAME`; `tools/testbed/` is frozen while the probe runs). DONE 2026-11-08: the
  reader compares the save's `meta_data` version with the game folder's and throws on a mismatch; `--game` defaults to `VIC3_GAME` (landmine L46,
  proven both ways).
- **U04** · T · the final patch notes · the preliminary notes were read on 2026-10-30 (appendix); read the forum changelog itself for engine
  behaviour the diff cannot show · DONE 2026-11-08 from Paradox's own Steam posts (the forum showed a bot check): DD#196 *State and Revolution
  & Update 1.15 NOW LIVE* (2026-11-05, the final notes, checksum fc93), DD#195 (the preliminary changelog, 2026-10-29), DD#194 *1.15 Modding*
  (2026-10-22). The version is **1.15.0 "Ivan-Chai"** (Steam's staged build 26453692); no Victoria 3 hotfix exists as of 2026-11-07 23:31 UTC
  ("Crown" is Crusader Kings III's 1.15). What the final notes add to the appendix is U21–U26, U36–U39, U49, U53 and U61's extra fixes. ⚠ The
  notes give **no per-method copper figures and no bronze artillery**: U41's swaps and U44 rest on the third-party parse until the diff (U03)
  confirms them.

## Phase 2 — breakage: a 1.0 install on 1.15, and the rebuild

- **U10** · R · `ship_interest_gain_mult` removed · the owned 1.0 copy of `power_bloc_principles/00_power_bloc_principles.txt`
  (`principle_navy_1`–`_3`) · follows 1.15 on rebuild; confirm on the diff and the count lines · DONE 2026-11-08 by the 1.15 build of the candidate (the dry run and the probe build): the build edits its own copy of the 1.15
  file (the research levers' Advanced Research 3 line, 5 → 1.5), and the vanilla-names check (U19) finds nothing of 1.13's left.
- **U11** · N · AI strategies gain `will_incorporate_state` and regional objectives · the owned copies of `ai_strategies/00_default_strategy.txt`
  and `01_admin_strategies.txt` · follow on rebuild; check the administrative strategies' count and `type` lines (seven in 1.13.11, ON_GAME_UPDATE
  §2.1) · DONE 2026-11-08 by the 1.15 build of the candidate (the dry run and the probe build): `ai subsidies: rewrote 7 administrative strategies`, the default
  strategy's trio read live (power plant, railway, port must-have); AI schooling in the same 7.
- **U12** · C · new base values in `static_modifiers/00_code_static_modifiers.txt` · the owned copy (the innovation levers) · follows on rebuild;
  each lever key must still sit once in its block · DONE 2026-11-08 by the 1.15 build of the candidate: the research levers write 150 → 25, 50 → 25, 50 → 25 over the 1.15 file
  (the printed old values are 1.15's own, so vanilla still holds 50 / 50 / 150).
- **U13** · C · the map and 1836 population: harbour connections, a lake in China, North Angola's population · the 15 owned `state_regions` files,
  the owned 1836 history, `config/measured_1836_pop_identity.json` · the diff decides; a moved 1836 population needs a new vanilla 1836.2.1 melt ·
  OPEN.
- **U14** · R · script the notes rename or remove (`pop_type_percent_country`, the war-exhaustion commands, `enemy_contested_wargoals`,
  `strait_trade_importance_by`, `has_employee_slots_filled`, `primary_cultures_percent_*`) · none in `tools/` or the built `mod/` (checked
  2026-10-30) · DONE; the vanilla-names check (U19) confirms it on 1.15.
- **U15** · R · `country_war_exhaustion_casualties_mult` in four vanilla copies · refreshed by the rebuild · DONE 2026-11-08 by the 1.15 build of the candidate: the copies are 1.15's, and the
  vanilla-names check (U19) resolves every name in them.
- **U16** · B · no substitution of script arguments inside quoted strings · no emitted file puts a `$arg$` inside quotes · DONE.
- **U17** · C · an event's or journal entry's `dlc` field may list several DLCs · L39 compares each copy with vanilla's file from the same game
  folder · DONE 2026-11-08 by the 1.15 build of the candidate: `DLC-GATE CHECK PASSED: 141 vanilla file(s) replaced …, 26 of them DLC-gated,
  every has_dlc_feature and dlc = line kept`.
- **U18** · T · the innovation override writes 25 over whatever vanilla holds and does not check that vanilla still holds 50 (the four flat bonuses
  do check) · `tools/emit_research_levers.mjs` should assert vanilla's 50 / 50 / 150 · DEFERRED to the 1.15 session (an emitter: frozen while the
  batch runs, CLAUDE.md §5.1 rule 7). 1.15 still holds 50 / 50 / 150 (U12). DONE 2026-11-08: `emit_research_levers.mjs` throws unless vanilla
  holds 150 / 50 / 50 and the universities 1 / 1.5 / 2.
- **U19** · T · the vanilla names in our own generated script · `tools/lint_vanilla_names.mjs`, written 2026-11-07 and calibrated on the 1.13.11
  build · run it on the 1.15 rebuild; wire it into `build.ps1` or `preflight.ps1` · the wiring DEFERRED to the 1.15 session (`build.ps1` is frozen
  while the batch runs). RUN 2026-11-08 on the 1.15 build of the candidate (`mod_sched_g115`): VANILLA NAMES PASSED — 103,904 tokens of 33 files
  of ours resolve against 1.15.0 (six vanilla `dna_data` files do not parse; their names are unread). DONE 2026-11-08: `build.ps1` runs it on the
  final state beside the DLC check, and throws on an unresolved name.
- **U20** · N · a 1.0 install on 1.15: the owned 1.13 method files lack `pm_bronze_cannons` / `pm_bronze_smoothbores` that 1.15's
  `pmg_foundries` names (expect `error.log` lines), and the power plants, telephones, motor and munition methods, sewing, stills, assembly lines
  and arcades consume no copper (appendix) · a player on 1.15 before mod 1.1 sees it · OPEN: whether KNOWN_ISSUES gets a line until 1.1 (the
  user's call; nothing there names 1.15 today).
- **U21** · B/R · ⚠ **journal-entry outcomes** (DD#194, not in the changelog): a new scripted outcome system replaces a journal entry's
  `complete` / `fail`; the diary says journal entries stay broken until updated and scripted progress bars must be retrofitted · the 1.0 build
  carries 452 `complete =` lines in `zzz_pm_rehaul_research.txt` (every research entry; ~126 progress bars, `zzz_pm_rehaul_research_bars.txt`),
  the dams' entry, and the owned vanilla copies in `common/journal_entries/` (10 files carry a `complete`; `03_russia.txt` is reworked by State
  and Revolution) · the research entries ARE the mod's research (§10.95–§10.98): without them every country researches at a quarter to a half of
  vanilla's pace · OPEN — the largest phase-2 item: read the new syntax in 1.15's own journal entries, then convert the emitters
  (`emit_research_events.mjs`, `emit_dams.mjs`) and re-own the vanilla copies from 1.15. Confirmed by the installed files (2026-11-08): no 1.15
  journal entry keeps a `complete` block (all 182 files use `outcome = { header … trigger = { … } effect = { … } }`, a failure being an outcome
  with the failure header), and `on_journal_entry_completed` / `on_journal_entry_failed` are gone. ⚠ No linter of ours reads journal-entry
  syntax, so a build can pass with every research entry dead: verify in game before anything is measured.
  **The emitters DONE 2026-11-08** (unverified in game): `emit_research_events.mjs` and `emit_dams.mjs` write 1.15's outcomes — `complete` +
  `on_complete` → a standard completion outcome (trigger = the old complete, effect = the old on_complete), `invalid` (+ `on_invalid`) → a hidden
  `invalid_outcome` (its effect = the old on_invalid); the kept 1.15 build (`mod_u115`) has 565 outcomes in the research entries and none of the
  old keys anywhere in `journal_entries/`, braces balanced; the ten owned vanilla copies come from 1.15 already. Guard: landmine **L45**
  (`Test-LmL45`, every build). Still OPEN: the in-game proof that a stage completes and grants (a `PMR_JE` line in `debug.log`; needs the go-ahead).
  **PROVEN IN GAME 2026-11-08** (probe `20261108_061520_g115-probe-1856`, run 1, the candidate on 1.15.0): `PM_TECH_REHAUL: init OK`; the entries
  are placed at start (`PMR_JE|placed_all`) and complete — 45 first stages by 1838.11, 62 first and 22 second stages by 1843.6 — each `PMR_JE`
  line written by the outcome's effect after its grant. No `error.log` line names a file of ours except U27's.
- **U27** · N · ⚠ every 1.15 journal entry carries `activation_description` (a trigger: 449 of 449 in vanilla, 369 of them `always = yes`);
  ours have none, and the engine writes `Journal entry je_pmr_… is missing an activation_description trigger!` once per entry type at load —
  461 lines in the first probe, all ours (the research entries and the dam surveys). It does not stop an entry (U21's proof ran with it) ·
  `emit_research_events.mjs` (three entry headers) and `emit_dams.mjs` (one) · DONE as a queued patch (`activation_description = { always = yes }`
  after each `group =`), applied when the probe batch ends (emitters are frozen while it runs); L45's detector widens to it. DONE 2026-11-08
  (339 research + 122 dam entries; L45 proven FAIL on the probe's build, PASS on the fixed one).
- **U28** · C · vanilla 1.15's `pm_automated_bakery` (the food industry's automation) consumes 5 electricity with no `required_input_goods`, the
  only one of 31 electricity consumers without it — our rule (ON_GAME_UPDATE §2.3.1, `lint_pm_combos` check 9) failed the dry run on it ·
  `build.ps1` transform (4) adds vanilla's gate to a vanilla method that consumes electricity without it and prints it; `emit_secondaries` does the
  same on its copies · DONE (mechanical: vanilla's own rule, applied to vanilla's one exception; a player could otherwise run an automated bakery
  without electricity, in vanilla as in ours).
- **U22** · C · the map: Tula split into Tula and Oryol; Kostroma split from Yaroslavl and Nizhny Novgorod; Chukotka and Kamchatka merged; Northern
  Kazakhstan redrawn; the North Caucasus's Russian pops cut; North Angola's pops made African (culture, not number) · the owned `state_regions`
  files, the dam table (a site in any of those states), the 1836 conversion, `measured_1836_pop_identity.json`, Russia's instrumented series ·
  OPEN (the diff; widens U13). The diff (U03): state regions `STATE_TARTARIA` → `STATE_SARATOV` and `STATE_KAUNAS` → `STATE_LITHUANIA`
  renamed, `STATE_CHUKOTKA` and `STATE_GALICH` removed, three added. DONE for the dams: only Balakovo was affected (U05); every other dam's state
  and anchor province holds on 1.15. Still open: `measured_1836_pop_identity.json` names KAUNAS / CHUKOTKA / GALICH and needs a 1.15 vanilla
  1836.2.1 save (a game run), `config/dam_sites_research.json` (the research notes behind the table) still says Tartaria. DONE 2026-11-08: the
  dam notes say Saratov (and `make_dam_projects.mjs` now reproduces the committed table); `measured_1836_pop_identity.json` refreshed from the
  probe's vanilla 1.15 1836.2.1 save (449 countries, was 443; 1,157 states, was 1,147; Kaunas, Chukotka, Galich and Tartaria gone), so the
  candidate's 1836 craft seeding moves from 3,393 to 3,448 levels in the same 61 countries.
- **U23** · C · starting technologies: Italian countries gain Empiricism (tech era 1), Nassau and Limburg Egalitarianism (tech era 2) · the 1836
  grant is derived from the map (§10.55) and these are not production technologies · DONE 2026-11-08 by the 1.15 build of the candidate: `1836 map grant: EMPTY` and `00_starting_inventions.txt
  not shipped` — the start keeps vanilla 1.15's own technologies, the Italian and Dutch-Belgian additions included.
- **U24** · N · a new ship type, Early Troopships, available from the start; AI ship categories move to `common/ai_ship_categories` · the naval
  research-entry emitter reads the ship types (the 2026-10-27 carrier fix) · OPEN (the emitter's floors: 8 land / 8 fleet technologies). DONE
  2026-11-08: ship types 21 → 22 (`ship_type_early_troop_ship`, no unlocking technology); the light cruiser moves from `dreadnought_tech` to
  `battleship_tech`; the fleet technologies stay 11 (floor 8), read live; `combat_unit_types` byte-identical.
- **U25** · N · five new Eastern European companies (some with prestige goods); requirement fixes for three companies; Fiume foundable in Croatia ·
  the company chain extension (§10.64) and the `building_<key>_throughput_add` declarations (`emit_companies.mjs`) · OPEN (mechanical on rebuild;
  check that every new company's tiered industry gets all its rungs).
- **U26** · N · Cossack Hosts, a subsistence-like building reserving up to 20% of a state's arable land (Russia at start) · every reader that
  excludes auto-scaling and subsistence buildings (`downsize_telemetry.mjs` §10.107.5, W and U\* by profession, misplaced capital's valid
  benchmark of free land) · OPEN (classify it in the readers; U53 for the design side).

## Phase 3 — reconciliation: the mod's premises against 1.15

- **U30** · B · *"buildings now compare their productivity against their own building type rather than all types when deciding whether to raise
  wages"* · here a rung is its own type, so a frontier rung compares itself only with frontier rungs: the wage competition that empties the old
  rung (CLAUDE.md §2.1, F97) narrows · OPEN: read the laggard test, the old-rung census and T0 on the first 1.15 canon batch against 1.15 vanilla.
- **U31** · B · no lay-off and rehire loop; a building still gaining workers keeps its hiring rate · new rungs likely fill faster; if
  `BUILDING_MAX_PROFIT_TO_PAUSE_HIRES` is now read, the PAUSED class of `hiring_census.mjs` / `craft_fill.mjs` can follow it (F185, F188) · OPEN.
- **U32** · B · new buildings take their own type's dominant methods · which secondaries a newly built rung opens on; the luxury-line problem
  (F249 §4d) · OPEN.
- **U33** · B · 1.14's AI rework · the investment-pool defines (§10.75, F158) and the AI desire ladder were calibrated on 1.13's AI · OPEN:
  misplaced capital on the first 1.15 canon batch (CLAUDE.md §2.4).
- **U34** · B · the treaty-port engine facts · ON_GAME_UPDATE §2.2.10's list, re-measured in its order; the notes add AI regional objectives,
  `will_incorporate_state`, the strait dependence links, `has_military_reach` and a release rule, none of which touches the pursuit filter, the
  never-added rule or the port-building requirement · OPEN (phase 6).
- **U35** · T · the rest of the premises table (ON_GAME_UPDATE §5.1), feature by feature, against the diff · DONE 2026-11-08 (a read-only walk of
  §5.1 and §5.2 against the diff, both game trees, both executables' define registries and the candidate; the working notes are outside the
  repository). **Unchanged:** a building for every technology step (no method-switch cost in 1.15; the 17 industries' buildings changed only
  their `ai_value`; `building_values.txt` identical); the crafts and merged methods; the 1836 start's mechanisms; the companies' rule; and every
  number of §5.2 — construction anchors 200/400/600/800, innovation 50 / 50 / 150, the universities, the four flat adds 15 / 5 / 10 / 30, every
  1.13 good's cost and traded quantity, the eras, the gold mine's 5000, the Nile trait, the AI subsidies, vulcanization and compression ignition;
  the power plants' input values move −4% / +1% / 0 by the copper swap (§10.89.15 holds). **The canon's defines** (C1 below): all seven NAI keys
  and the engine-only `WORLD_MARKET_MONOPOLY_THRESHOLD` are still registered, at vanilla defaults unchanged (0.75 / 0.75 / 1.05 / 0.05 / 40 / 60,
  divisor 0.001); the four `vanilla_value_overrides` read 15 / 5 / 10 / 30 at the same lines; the first 1.15 probe's `debug.log` names three dead
  define keys, all vanilla's (audio and graphics), none of ours; `emit_techs`' nine `DEAD_DEFINES` are all gone from 1.15's files (the table is
  moot). **Moved:** the lines U35a–U35k.
- **U35a** · C · `base_values.state_literacy_growth_add` 0.0005 → 0.002 (×4), in the owned `00_code_static_modifiers.txt` (not in the notes as
  read) · the research entries' literacy gates (25–65%), the cap's literacy term (x = 25), tech spread (75 × literacy), expected SoL from literacy
  (wages, U\*), AI schooling, the anchor principle (§2.2), and vanilla's own research pace — so "the majors gain 0.94–0.97 of vanilla's technology"
  and x = 25 (§10.101.1) are re-based against a faster vanilla · OPEN (Q5) · cost: free from U60 (literacy and technology in the save summaries).
- **U35b** · = U28 (the automated bakery's gate) · DONE.
- **U35c** · N · two new flat innovation adds sized for vanilla's research: `company_russo-baltic_wagon_factory` +15 cap (IP5-gated) and
  `modifier_social_revolution` +25 cap (the new `je_social_revolution`) · POLISH Q1's ×1/3 covers the four 1.13 adds only · RULED 2026-11-08
  (Q6, BALANCE_FRAMEWORK §10.109.1): ×1/3 → 5 and 8.33; BUILT in `tools/make_value_overrides_config.mjs --set g115-research-adds`, reaching a
  book at Q1's regeneration.
- **U35d** · N/B · vanilla now raises the tiered industries' `ai_value` while journal entries run: the new five-year plan (`je_five_year_plan`, no
  DLC) +2,500 on food, textile, furniture, glass, tooling, paper, explosives, synthetics, steel, motor, automotive, electrics; munitions
  +2,000 / +3,000 under the Tsar's Great Reform, paper +250, the art academy +1,000 twice (dlc019) · every rung carries the flat tier ladder, so
  the boosts vanish on the 17 industries (they stay on shipyards and power plants) · RULED 2026-11-08 (Q7, BALANCE_FRAMEWORK §10.109.2): carried
  onto every non-craft rung, flat; BUILT (`tools/emit_ai_value_adds.mjs`, a build step; L47). The plan covers thirteen industries, fertilizer
  among them (the list above missed it).
- **U35e** · B · `MONEY_SPENDING_CONSTRUCTION_MAX_INVESTMENT_POOL_WEEKS` 52 (new): a construction shortfall becomes a must-have once the pool holds a
  year of inflow — with the canon's CRITICAL 1.0, any shortfall; three private-scorer keys removed from file and exe · §10.75's set, H, misplaced
  capital (widens U33, U38) · OPEN (Q8): measure U62 on the canon's set, or add an arm with vanilla's pool defines.
- **U35f** · C · the contagious-ideas laws moved: council republic needs factory councils as a law or the IP5 amendment and a first proletarian
  revolution; ten new laws, none named by our entries; Russia starts with `law_internal_colonization` (passes the civilizing-mission entry's own
  condition, but not its other two gates: `can_research` needs Quinine and Nationalism, and tech era 3 needs 45% literacy — the 1.15 probe's
  Russia has neither by 1856, literacy 15% → 19–22%) · the socialism entry tests `has_law = law_type:law_factory_councils`, which misses the
  amendment · RULED 2026-11-08 (Q9, BALANCE_FRAMEWORK §10.109.3): vanilla's `has_factory_councils_law_or_amendment`; BUILT
  (`make_research_conditions_config.mjs --set g115-idea-laws`).
- **U35g** · B · `BUILDING_WAGES_EXPECTED_SOL_TARGET_FACTOR` 0.67 (new) scales the three wage targets: read literally, raise wages below ~0.60 of
  expected SoL (was 0.9), lower above ~0.80 (was 1.2), prefer layoffs below ~0.44 (was 0.66); hiring at a 15% margin (was 25%), raise 0.20 (0.25),
  lower 0.10 (0.15), withdraw 0.10 (0.15); firing only beyond a 0.3 proportionality imbalance (new 0.2 tolerance); and the productivity comparison
  is now against the building's own type (0.5 → 0.75, U30) — vanilla keeps the pay gap between old and new methods inside one type, each of our
  rungs is its own type. `PEASANT_STARTING_WAGE_RATE_FACTOR` removed (1836 wages). `RADICALS_MAX_FROM_LOW_SOL` 0.15 → 0.075 (U37) · CLAUDE.md
  §2.1's "~0.66×" and F97's ~0.2 line, `measured_base_wages.json`, the wage model's ~1% calibration, the crafts' 1836 fill · RULED 2026-11-08 (Q4):
  measure first, no pre-emptive change (§10.109.7) · cost: U60 + U62.
- **U35h** · T · the monopoly rule's built-in default on 1.15 (§10.102; the key is still registered) · OPEN · cost: F241's continuation A/B, two
  short deterministic continuations from one 1.15 save (a probe).
- **U35i** · T · the engine's named hiring states (`HIRING_ANALYSIS_*` tooltips) · DONE 2026-11-08: a melted 1.15 save (the probe's 1837 autosave)
  carries no hiring state per building — `hiring_rate` (read since 1.13 by `craft_fill.mjs`) and `hiring_rate_changed_last_week`; `failed_hires = yes`
  appears only in the AI's private-investment priority records. The PAUSED heuristic stays (U31).
- **U35j** · T · goods order: copper at index 27 shifts every good from hardwood on · every save reader · DONE as a rule (the skill's Traps:
  `VIC3_GAME` per session's version); `save_state_summary.mjs` reads the order from the game folder.
- **U35k** · note · vanilla 1.15 sets `is_hidden_when_unavailable = yes` on `pm_cannons` and `pm_bronze_cannons` (technology-gated, so CLAUDE.md
  §5.4's rule does not bite); our rung methods do not copy the flag · nothing to do.
- **U36** · B · a deliberate rebalance, in the final notes only: buildings are *"a bit more conservative when it comes to hiring and wage
  decisions"*, aimed at an easier stable equilibrium at partial employment · beside U30–U31 the largest premise move: obsolescence through wages
  (§2.1, F97), W and U\* (goal 4), `measured_base_wages.json`, the downsizing poll (§10.107) · OPEN (read on the first 1.15 canon batch against
  the 1.15 vanilla).
- **U37** · B · a standard of living below expected radicalises more slowly (to stop unemployment-driven revolution cycles) · the canon's pool runs
  at ~1.3–1.7× vanilla's U\*, so revolutions, civil wars and the broken seeds may move · OPEN (read with U36).
- **U38** · B · the AI: better predicted profitability of constructions and methods; more construction when short of it to tap the pool; always
  enough paper for its bureaucracy; prestige goods valued right for company buildings; no railways built against temporary infrastructure
  penalties · misplaced capital (§2.4) and the desire ladder (U33), the pool defines (§10.75, F158), H; paper is a tiered industry with a merged
  rung · OPEN (widens U33).
- **U39** · C/B · trade: starting trade routes and trade centres reworked so the majors start without severe shortages; Ottoman tea output halved
  at start (exports moved to China); up to four world-market hubs per market area with a fallback; the Cold system on frozen sea nodes; routes
  spread over sea paths of similar length · the 1836–1845 anchor, world trade (×2, F159/F161), the treaty-port facts (U34) · OPEN.

## Phase 4 — adoption: what 1.15 adds, against what we author

- **U40** · N · **copper**, a new good (base price 40) · ruled frame (§10.108): *"everywhere where vanilla does, and in similar cases that simply
  don't exist in vanilla. By default, proportionally, everything else needs to be argued."* · the lines U41–U48.
- **U41** · C · copper in vanilla's main methods (value-neutral swaps at base prices) · the rungs' input mixes: only the regeneration of
  ON_GAME_UPDATE §1 step 5 brings copper into them; a rebuild of the 1.0 book ships every rung on its 1.13 mix and nothing throws · OPEN (phase 2,
  step 5). Confirmed by the installed files (U03, 2026-11-08): copper enters pot stills 2 / patent stills 4, the automated bakery 1, electric
  sewing machines 2, automatic power looms 2, every assembly-lines automation 1, electric engines 10, telephones 30, percussion caps 5, explosive
  shells 10, arcades 1, the three power plants 2 / 4 / 5, refrigeration on wharves and whaling stations 1, arc-welded buildings 10, and five ship
  armour modifications; the copper mine makes 20 → 70 by its pump method. · DONE 2026-11-08 by the regeneration (U06): the five main methods of
  the 17 industries that take copper in 1.15 carry it in the candidate, value for value; the secondaries and automations (assembly lines, power
  looms, the automated bakery, stills) are copied from 1.15 at build time and carry vanilla's copper with their sizing rule; the power plants,
  wharves, whaling stations and construction methods are vanilla's own. The streetlights stay as 1.0 (U43).
- **U42** · N · copper on the dams · per 50 electricity 1 tools + 0.5 engines + 0.75 copper (6 + 3 + 4.5 a 300 level), the book field
  `dams.inputs_per_50`, copper at 40 in `lib_dams.mjs` `BASE_PRICE` · RULED §10.108; BUILT 2026-11-08 in the candidate (`tools/make_dam_inputs_config.mjs
  --inputs tools:1,engines:0.5,copper:0.75`, record `_dam_inputs_variant`; £100 per 50 electricity before and after).
- **U43** · N · copper on the electric streetlights · none: 1.0's recipe and staffing exactly; the field diff must show `pm_goods` /
  `pm_employment` unchanged · RULED §10.108.1 (all streetlight work DEFERRED to mod 1.2 or later).
- **U44** · N · bronze cannons and bronze smoothbores (the foundry now has six main methods; `make_tier4_config` throws above four) · a switchable
  second main method on the t0 and t1 rungs at the rung's own input value (t0 12.8 copper + 19.2 hardwood, t1 24 + 24) · RULED §10.108.2, not
  built (the generator's pairing, L31, the combination lint, the research counts, the 1836 converter). Confirmed by the installed files: in
  `pmg_foundries` beside cannons / smoothbores, `pm_bronze_cannons` 10 copper + 15 hardwood → 25 artillery (gated by artillery, like cannons),
  `pm_bronze_smoothbores` 20 copper; no 1836 factory runs either. ⚠ **It blocks the 1.15 build**: the start-conversion lint (L13) fails while
  either method maps to no rung (U05). · BUILT 2026-11-08 in the candidate (`tools/make_variant_config.mjs`, `VARIANTS` in `lib_tier4_spec.mjs`;
  BALANCE_FRAMEWORK §10.108.2 records what follows it): t0 12.8 copper + 19.2 hardwood = £1,280, t1 24 + 24 = £1,920, each a switchable second main
  method of its iron twin's building; the tier lint checks them (section 4b), the compatibility review covers them, the research entries count the
  host building whatever its method; no 1836 foundry runs bronze.
- **U45** · N · copper's trade class · `make_trade_config` throws on a tradeable good in no class; F159 §5's historical wedge (32.7% falling to ~0)
  puts it with B or C · RULED 2026-11-08: class C (Q2, BALANCE_FRAMEWORK §10.108.3), traded quantity 12 = 2 × 240 ÷ 40, in `make_trade_config.mjs`; it
  reaches a book at Q1's regeneration. The candidate keeps the provisional semi-bulk D it was generated and measured with (traded quantity 8.49 =
  √2 × 240 ÷ 40); vanilla prices copper as lead and iron (cost 40, traded quantity 5).
- **U46** · N · copper in `tools/goods_prices.tsv` (40) and in `GOOD_GROUPS` of `ui/builder.html` · DONE 2026-11-08 (the table matches 1.15's 54
  goods by ON_GAME_UPDATE §2.4's comparison; copper in the editor's raw-industrial group). Without it every reader priced copper at £0: the
  tier-rule lint (L31) read munition's and electrics' anchors £200 and £1,200 low and failed. With it L31 passes on the 1.0 book, so 1.15's copper
  swaps are value-neutral at base prices.
- **U47** · N · where copper is mined: `building_copper_mine`, a capped resource unlocked by shaft mining with the lead mine's methods; 609 levels
  in 84 states by a third-party copy of the files; France and Belgium none · OPEN: confirm on the installed files.
- **U48** · T · the rest of the what-we-author walk for copper (ON_GAME_UPDATE §5.3): the minted top rungs, the crafts, the research entries
  (does an entry that counts mines need the copper mine?), the PI basket (copper is now a building input), the red-flag goods, the telemetry's
  good lists · OPEN (1.15 session).
- **U49** · C · warship modules consume more artillery, ammunition and radios · artillery and munitions are tiered industries (their demand and
  the PM war-goods reading); radios sit in the PP basket · OPEN (read on the first 1.15 batch).
- **U53** · N · Cossack Hosts against what we author (ON_GAME_UPDATE §5.3): their arable-land reservation beside the dams that add arable land,
  Russia's peasants in U\* · OPEN (likely nothing to author; U26 for the readers). DONE 2026-11-08, nothing to author: the host (`bg_cossack_host`
  under `bg_ranching`, 4,500 laborers + 500 farmers a level) has no inputs and is not buildable; the five Russian monuments are cosmetic and
  DLC-gated. U26's reader classification stays open.
- **U48 (the walk, 2026-11-08)** · the §5.3 walk for every 1.15 addition (working notes outside the repository): copper needs no further
  authoring — the probe build carries it on the five rungs, the bronze pair, the secondaries (stills, the automated bakery, power looms, every
  assembly line), the dams (4.5 / 9), the power plants (2 / 4 / 5) and the arcades; the streetlights take none (U43). **Noes:** the minted rungs,
  the crafts and the merged rungs other than textile t3 (vanilla puts no copper on the electric-arc, brine-electrolysis or film methods, and its
  copper is not systematic — radios at 50 electricity take none); a research entry for the copper mine (shaft mining is tech era 1, held at start;
  the mine-counting entries stay at parity with lead and sulfur); a five-year-plan desire on the dams (their `ai_value` is already 30,000); the
  ladder, desire, research levers, hydro traits (the four new traits are copper traits) and start rules; the PI, PP and war-goods baskets (copper
  is a raw input, like iron and lead, which are in none); the red flags, telemetry, misplaced-capital and sector readers (they read the goods and
  buildings from the game files); the other new laws, defines, on-actions, modifier types, government methods and ship armour. **Proposals:**
  U54–U59. Once U45 is ruled, `lib_goods.mjs`'s `REF_TRADE_BOOK` (a 1.13 book without copper) is repointed — at Q1's regeneration, to the new
  book (U45 ruled C; a book with its own `_trade` is read from it, so only vanilla readings use the fallback) — or `trade_fade.mjs` and
  `ladder_headlines.mjs` class copper `?`; six 1836 trade routes carry copper, so its class reaches the 1836 anchor. · DONE (the walk).
- **U47 (the installed files)** · copper in 84 states, 603 levels (the third-party copy said 609); none in France, Belgium or the Netherlands;
  lead cut by 124 levels in nine states, mostly Japan; the 1836 tiered levels 1,045 → 1,044 (Russia −10, the new Poland +8, Turkey +1) · DONE.
- **U25 (the rebuild)** · all ten new companies get every rung of their industries, the craft keys kept out (`emit_companies`: 170 companies
  touched, 59 levels-in-region tests) · DONE.
- **U54** · N · = U35d: vanilla 1.15's journal-entry-conditional `ai_value` on 16 of the 17 tiered industries' buildings is dropped on every rung
  (the building emitter writes the flat tier value only; in the probe build only the shipyard and the power plant keep the block) ·
  `MISSING_BUILDING_CONDITIONS.md` already proposes the fix (one row today, 17 otherwise) · DONE 2026-11-08 (Q7): carried onto every non-craft
  rung on top of its tier value by `emit_ai_value_adds.mjs`; 36 rung buildings in 15 industries on 1.15.0; landmine L47 checks the build.
- **U55** · N · three new vanilla tests count building-group LEVELS, which the crafts inflate ×10 per worker: the five-year plan's light-industry
  goal (initial × 1.25, at least +10 levels — ten craft levels, ~60 construction points, meet it), the Tsar's favourite-industry mission (light
  industry picked), and the AI decree effect that takes the top five states by manufacturing levels (≥ 10) · TIER_REFERENCE_AUDIT G1–G3 (crafts
  out, R2.2's lean; each G row was ruled case by case) · OPEN (Q11): crafts out as rows G4–G6 in G3's form (a script value summing non-craft
  levels), RECOMMENDED · RULED and BUILT 2026-11-08 (Q11, §10.109.4) by native counts, not G3's old loop. It owns four new vanilla files (`journal_entries/00_communism.txt`, `script_values/ip5_je_values.txt`,
  `journal_entries/08_tsarpoints.txt`, `scripted_effects/00_ai_decree_effects.txt`; README's replaced-file list, L39's DLC gates), handles three
  syntaxes (a data function in a variable, a dynamic group variable, an `order_by` over states) and needs an in-game check, about an hour. Without
  it, KNOWN_ISSUES gets a line: a five-year plan's light-industry goal can be met with crafts.
- **U56** · T · the vanilla-references scan (L40) matches only `building_` / `pm_` tokens and skips `common/buildings`, so neither U54 nor U55
  tripped anything · RULED 2026-11-08 (Q10, §10.109.6) and BUILT: L48 (`tools/lint_group_levels.mjs`, the level-count scan) and L49
  (`tools/lint_building_blocks.mjs`, the building-block diff), both proven; L48's first run found IP4's negotiation promise (G7), fixed.
- **U57** · = U35e (the pool-weeks define) · OPEN (Q8).
- **U58** · N · `law_extraordinary_commission` is unlocked by Political Agitation, like the two laws that idea entry already counts · RULED
  2026-11-08 (Q9, §10.109.3): counted; BUILT in the same set as U35f, in a book at Q1's regeneration.
- **U59** · C · the bronze hosts' names read "Tier 0. Artillery Foundry. Recipe BE 61%/61%" — the merged-host naming, which drops "(Cannons)" /
  "(Smoothbores)" and prints two figures where §10.108.2 says one · RULED (§10.108.2: "the building's name carries one figure"): a host whose
  second methods are all variants is named as an ordinary rung · DONE 2026-11-08: "Tier 0. Artillery Foundry (Cannons). Recipe BE 61%", "Tier 1.
  Artillery Foundry (Smoothbores). Recipe BE 61%".
- **U50** · N · new script hooks: `global_average_gdp_per_capita`, `has_building_levels_in_state_region`, `gdp_owned_by`; progress bars taking a
  script value or a math block for `min_value` / `max_value` · candidates that could simplify our script (the urban-centre entries); not needed
  for 1.1 · OPEN (note only).
- **U51** · N · the console command `print_world_gdp` · a direct check of the displayed world GDP the register reads (F45, F257), in one debug
  game · OPEN.
- **U52** · B · profit predictions and goods availability no longer show no supply until the first day passes · the telemetry's `EARLY|boot`
  lines, read from `on_game_started_after_lobby` · OPEN: compare with a 1.13 session's.

## Phase 5 — the open questions for the user (2026-11-08)

The agenda of the skill's phase 5, from the pass of 2026-11-08 (phases 1–4 walked; everything already ruled is built in the candidate book or in
the build). Each question: what changed · what of ours it touches · the options · the recommendation. **Hard stops first** (a release, a
canonisation, a download), then the premise moves, then the adoptions, then the measurement plan.

**Q0 · mod 1.0 on game 1.15, today (U20, U21, U27).** Players who updated the game run 1.0's build: its research entries are written in the
old journal-entry syntax, which 1.15 no longer reads, so they never complete — every country researches at a quarter to a half of vanilla's
pace; the foundry group names two bronze methods 1.0's owned method file lacks; the owned static-modifier copy lacks three blocks the 1.15
engine expects. The 1.0 book alone cannot be rebuilt for 1.15 (the start conversion stops on the bronze methods), so any fix ships at least the
bronze variants. Options: (a) a KNOWN_ISSUES line and a Workshop notice now ("1.0 is for game 1.13; on 1.15 research is broken; 1.1 follows");
(b) an early release of the candidate (Q1), unmeasured over a century on 1.15; (c) both, (b) once Q1–Q3 are settled. **Recommended: (a) now,
then (b) after one century of the candidate reads intact.** **RULED 2026-11-08 (user): no KNOWN_ISSUES line** — *"The version compatibility is
explicitly declared. No-one would expect 1.0 to even launch with 1.15."* The published 1.0 declares `supported_game_version` 1.13.* (the
deployed copy confirms it), so the launcher marks it out of date on 1.15. The same reasoning covers the Workshop notice (an inference, not
ruled in words). With no player expected on the old build, the early release (b) loses its urgency: the 1.1 release waits on Q1 and Q12 like
any other. ⚠ The repository's `mod/.metadata/metadata.json` already says 1.15.* over the 1.0 build (U70), so the Workshop item must not be
re-uploaded from `mod/` until the 1.1 build replaces it. · CLOSED.

**Q1 · canonise the 1.15 candidate (U06; CLAUDE.md §4.4).** `config/mod_config.g115-canon-bz-dcu.json` is the canon's chain replayed on 1.15
(proven on 1.13.11: the canon field for field) + bronze artillery (§10.108.2) + dam copper (§10.108). Its whole field diff against the canon:
copper in five rungs where vanilla 1.15 puts it, value for value (textile t3 2.4, motor t2 8.2, munition t1 6 and t2 11.1, electrics t2 59);
the two bronze variants; copper's traded quantity (Q2); `dams.inputs_per_50`. Nothing else moved — no staffing, cost, technology era or
prerequisite, no urban-centre key. **Recommended: yes, regenerated with Q2's class (and Q6 / Q9 if ruled yes) under a new name, then
measured (Q12).** *The regeneration as the walk has ruled so far:* `node tools/replay_canon_chain.mjs --prefix <p>` (its trade step now classes
copper C, Q2) → `make_variant_config` and `make_dam_inputs_config` (the candidate's recorded commands) → `make_value_overrides_config --set
g115-research-adds` (Q6) → `make_research_conditions_config --set g115-idea-laws` (Q9) → the later rulings' steps; field-diff against the
canon and against the candidate. (Q7 is a build step, not a book change.) **Regenerated 2026-11-08 after Q11:**
`config/mod_config.g115c-canon-bz-dcu-ra-il.json` (sha256 `a52b0acacd6b6b6e`, its tree twin `db96307af17c22ee`, identical to the candidate's
but for the timestamp). Field diff against the candidate, in full: `goods_traded_quantity.copper` 8.49 → 12 (Q2); two
`vanilla_value_overrides` entries (Q6); the socialism and political-agitation labels and the monthly global effect (Q9) — nothing else.
Against the 1.0 canon: that plus the candidate's own diff above. A dry build on 1.15.0 passes every lint, the DLC-gate check (145 files) and the
preflight (L47 included). **RULED 2026-11-08 (user): "Yes, canonise now. The non-canon arms are for hypotheses-testing branches which can be
genuinely retracted if don't work. Canonisation is the declaration that the approach is main, not a quality stamp."** CANONISED the same day
(BALANCE_FRAMEWORK §10.109.5; CLAUDE.md Part 4 and §4.4): copied verbatim over `config/mod_config.json` + twin (`a52b0acacd6b6b6e` /
`db96307af17c22ee`), built, linted and deployed; `mod/` and the deployed copy are its debug build. · CLOSED.

**Q2 · copper's trade class (U45).** Vanilla prices copper as lead and iron (cost 40, traded quantity 5). The candidate classes it semi-bulk
(D, √2 × 240 ÷ 40 = 8.49) beside lead, PROVISIONALLY. F159 §5's yardstick: copper's price gap fell from 32.7% to about 0 by 1913 (cotton
textiles, class C, 13.7 → ~0), and copper's value per ton was ~4–5× lead's at similar freight. Options: D (as lead), C (manufactures and
colonial staples, ×2), B (×2√2). **Recommended: C.** **RULED 2026-11-08 (user): C** — BALANCE_FRAMEWORK §10.108.3; built in
`make_trade_config.mjs` (copper 12, checked on a scratch book); the candidate keeps D until Q1's regeneration. · CLOSED.

**Q3 · rakaly cannot read 1.15 saves (U07) — needs your OK for a download.** Every save summary on 1.15 fails (`0d04`), so the register's
GDP, W, U\*, H, T0–T3, misplaced capital and downsizing go dark; telemetry still works. rakaly compiles each game's tokens into its release;
the newest, **v0.8.22** (2026-10-13, `rakaly-0.8.22-x86_64-pc-windows-msvc.zip` from github.com/rakaly/cli, ~2 MB like 0.8.19's), predates
1.15 and may or may not read it. Options: (a) fetch 0.8.22 now and test it on the probe's kept saves; (b) wait for a release after 1.15;
(c) both. **Worked around since (U07):** the summariser keeps a 1.15 summary when rakaly stops in the save's trailing section, after
everything it reads, so the register reads 1.15 runs without a download; the other melting readers (`melted_*.mjs`) still stop. **Recommended:
(a) when convenient, no longer blocking.** **RULED 2026-11-08 (user): "Try it"** (1.15 was in open beta before 0.8.22's release, so it might
have 1.15's tokens). DONE: v0.8.22 downloaded (sha256 matching the release's), tested on the three probe saves and deleted — it behaves exactly
like v0.8.19. The test found the real shape of the problem: rakaly melts a 1.15 save WHOLE but for one unnamed key, `0x0d04` (1,223 lines
`= 0`, all inside `military_formation_manager`); under `--unknown-key stringify` it then exits 1 at the save's very last token, under `ignore`
it drops those lines and exits 0, and the two melts are otherwise byte-identical. The last section rakaly calls `state_has_building_group_levels`
holds AI regional objectives (rakaly's label, not the content). So nothing is lost: the summariser keeps its tolerance; `score_save.ps1` and
the eight ledger readers that spawn rakaly now melt with `--unknown-key ignore` and work on 1.15 (two proven on the probe's 1856 save);
TESTBED_METRICS §7 says how to melt by hand. v0.8.19 stays vendored. · CLOSED.

**Q4 · the wage and hiring rebalance moves §2.1's premise (U30, U31, U35g, U36, U37).** 1.15's new `BUILDING_WAGES_EXPECTED_SOL_TARGET_FACTOR`
0.67 scales the three wage targets (read literally: layoffs below ~0.44 of expected standard of living, was 0.66); buildings hire at a 15%
margin (was 25%); and a building now compares its productivity with its own type only — vanilla keeps the pay gap between old and new
methods inside one building type, while each of our rungs is its own type, so the frontier's pull on the old rung's workers narrows. All
three favour old rungs surviving (goal 2). Options: (a) change nothing until the 1.15 batch measures it (the laggard test, the old-rung census,
T0, W, U\*), and mark CLAUDE.md §2.1's numbers as game 1.13.11's; (b) pre-emptively steepen the ladder. **Recommended: (a).** **RULED 2026-11-08 (user): (a)** — *"A for now. We'll go an n=1 vs n=1 today and will see. I'm a bit skeptical of PDS ability to go where they need with balance, they seem to be less systematic and thorough than us with a one part-time human one AI workforce."* No pre-emptive change (BALANCE_FRAMEWORK §10.109.7); CLAUDE.md §2.1's ~0.66× marked as game 1.13.11's; a first canon-vs-vanilla century on 1.15, n=1 each, reads it (its schedule carries the predictions). · CLOSED.

**Q5 · literacy grows four times faster (U35a).** `state_literacy_growth_add` 0.0005 → 0.002 in the owned static-modifier file (not in the
notes). It moves the research entries' literacy gates (25–65%), the cap's literacy term (x = 25), tech spread and vanilla's own research
pace, so "0.94–0.97 of vanilla's technology" is re-based. **Recommended: keep x = 25 and the gates until the 1.15 vanilla batch measures
literacy and the technology pace (free from U60).**

**Q6 · two new flat innovation adds (U35c).** The Russo-Baltic company (IP5) +15 cap and `modifier_social_revolution` +25 cap are sized for
vanilla's research; POLISH Q1's ×1/3 covers the four 1.13 adds. **Recommended: extend `vanilla_value_overrides` to them (→ 5 and 8.33), a
book change in Q1's regeneration.** **RULED 2026-11-08 (user): "A", both ×1/3 (→ 5 and 8.33)** — BALANCE_FRAMEWORK §10.109.1; built as
`make_value_overrides_config.mjs --set g115-research-adds` (a scratch build of the candidate + the set on 1.15.0 emitted both lines and passed
every lint); in a book at Q1's regeneration. · CLOSED.

**Q7 · vanilla's journal-entry-conditional AI desire on the tiered industries (U35d, U54).** The new five-year plan (+2,500 on 12 industries,
no DLC), the Tsar's Great Reforms (munitions +2,000 / +3,000), paper +250, the art academy +1,000 twice (dlc019) — every rung carries the flat
tier value, so these vanish on the 17 industries. They are vanilla's own steering of its AI toward its journal goals, not a design lever of
ours (§2.4 concerns our levers). **Recommended: carry them onto every non-craft rung, on top of the tier value
(`MISSING_BUILDING_CONDITIONS.md`'s fix).** **RULED 2026-11-08 (user): "A", flat on every non-craft rung** — BALANCE_FRAMEWORK §10.109.2.
BUILT as a build step, `tools/emit_ai_value_adds.mjs` (after `emit_vanilla_refs`): 36 rung buildings in 15 industries carry vanilla's adds
(the five-year plan on thirteen, fertilizer included; munitions' Great Reforms with its `building_munition_plant` test widened to every
munition rung; paper +250; the art academy's three); landmine L47 (`Test-LmL47`) proven both ways; a dry build of the candidate passes. Not a
book field: every book built from now on carries it. · CLOSED.

**Q8 · the AI's new pool rule (U35e, U57).** `MONEY_SPENDING_CONSTRUCTION_MAX_INVESTMENT_POOL_WEEKS` 52 makes a construction shortfall a
must-have once the pool holds a year of inflow; with the canon's CRITICAL threshold 1.0 that is any shortfall; three private-scorer defines
were removed. Vanilla now does part of §10.75's job. **Recommended: measure the canon's set as it is (Q12) and decide a vanilla-defines arm
from its H and misplaced capital.**

**Q9 · the contagious-ideas laws (U35f, U58).** Council republic now needs factory councils as a law or as IP5's amendment (and a first
proletarian revolution); our socialism entry tests the law only; `law_extraordinary_commission` (new) is unlocked by Political Agitation like
the two laws that entry counts. **Recommended: test vanilla's `has_factory_councils_law_or_amendment`, and add the new law to the political-
agitation set (a book change in Q1's regeneration).** **RULED 2026-11-08 (user): "A", both** — BALANCE_FRAMEWORK §10.109.3. BUILT as
`make_research_conditions_config.mjs --set g115-idea-laws` (four exact edits, each asserted once); a scratch build of the candidate + Q6 + the set
on 1.15.0 emitted both conditions and both labels in 11 languages and passed every lint, the vanilla-name lint included. The user then asked
whether Russia's civilizing-mission entry really runs from 1836 (the agenda said so): it does not — `can_research` (Quinine, Nationalism) and
the 45% literacy line both hold it back, and the probe's Russia meets neither by 1856 (U35f). · CLOSED.

**Q10 · detectors (U56).** The reference scan (L40) reads only `building_` / `pm_` tokens outside `common/buildings`, so neither Q7 nor Q11
tripped it. **Recommended: a scan for level counts on the tiered building groups (both syntaxes) and the building-block diff.** (Q7's case
has its own detector since 2026-11-08, L47; Q11's four rewrites assert their counts at build, and its premise has an init tripwire.)
**RULED 2026-11-08 (user): "A"** — both detectors, and the negotiation promise crafts out (BALANCE_FRAMEWORK §10.109.6). BUILT: L48 found
exactly the promise's three counts on the canon build made before the fix (and the debug init tripwire, reviewed), and passes after it (10
counts: 8 native, 2 reviewed — the existence test `building_group_can_be_promised` and the tripwire); L49 passes (44 rungs, nothing catalogued)
and fails on a rung doctored to drop `possible` and on a vanilla building doctored to gain a field. G7 owns two more vanilla files. The
canon was rebuilt and deployed with it. · CLOSED.

**Q11 · crafts in 1.15's new level counts (U55).** The five-year plan's light-industry goal, the Tsar's favourite-industry mission and the AI's
decree targeting count group levels, which the crafts inflate tenfold per worker (ten craft levels meet the plan's +10). **Recommended: crafts
out (G4–G6, G3's form; about an hour and an in-game check); otherwise a KNOWN_ISSUES line.** The user asked first whether vanilla counts with a
script too, for performance: it does not (engine counters, one lookup each), and G3's form was a script loop over buildings, which in the
AI decree's monthly pulse would touch every building of every AI country. **RULED 2026-11-08 (user): "The recommended way"** — crafts out of
all three by NATIVE counts, the parent group's levels minus the craft group's (`bg_pmr_crafts`), G3 switched to the same form, with an init
tripwire on the child-group premise — BALANCE_FRAMEWORK §10.109.4, TIER_REFERENCE_AUDIT G4–G6. BUILT (`emit_vanilla_refs.mjs`, four new owned
files; `build.ps1`'s init tripwire); a build of the candidate + Q6 + Q9 on 1.15.0 passed every lint, the DLC-gate check and the preflight; the
tripwire's line is read in the first 1.15 batch run. With it the user asked to remember for mod 1.2 an audit of needless script iteration
(building groups the first candidate; BACKLOG). · CLOSED.

**Q12 · the re-measure (U60, U62, U35h, U34).** A 1.15 vanilla batch (it re-baselines `VANILLA_REF`, `VANILLA_WALL_REF`,
`measured_base_wages.json`, the noise catalogue, the fleet-loop calibration) and the canonised candidate against it, alternating; the
monopoly rule's continuation A/B (F241's method, two short continuations); the treaty-port facts (U34, §10.103) if 1.1 is to include them.
Needs Q3 first. Options: (a) 16 vanilla + 16 candidate alternating, 32 × ~3 h ≈ 4 days; (b) 8 + 8, ≈ 2 days, directional. **Recommended: (a)
if rakaly reads 1.15, starting once Q1–Q3 are ruled; write the predictions of Q4, Q5 and Q8 into its schedule.**

**Q13 · the electricity build condition (§10.106).** Deferred "to at least 1.1" for its performance risk; its restoration needs a tick-cost A/B,
which the late game alone exercises (the four buildings are t2/t3). **Recommended: keep it deferred for 1.1 (the known issue stays), unless
Q12 carries a third arm for it.**

**For information (done, no ruling asked):** the bakery gate (U28: vanilla 1.15's `pm_automated_bakery` consumes electricity ungated, the
only one of 31; the build adds vanilla's own gate to it and to our copy); the activation trigger on our journal entries (U27); the levers'
vanilla anchors (U18); the vanilla-name lint in the build (U19); the bronze hosts named as rungs (U59, §10.108.2); the dam table's generator
made to reproduce the committed file (U22: the five proofread names and Saratov moved into `config/dam_sites_research.json`).

**The first 1.15 probe** (`20261108_061520_g115-probe-1856`, 2026-11-08; one run each, so directions only, CLAUDE.md §2.9): U63, FINDINGS F265.

## Phase 6 — re-measure

- **U63** · T · the first 1.15 probe (`20261108_061520_g115-probe-1856`; FINDINGS F265): the candidate and vanilla 1.15 + telemetry 1836→1856,
  and a vanilla 1836.2.1 save · DONE: the mod loads (no error line of ours but U27's warnings, fixed since); the research entries complete (245
  stages by 1856); Britain runs bronze cannons on 2 of 3 foundry levels and mines ~170 copper a week; world GDP 0.99 / 0.98 / 0.94 / 0.96× the
  batch's vanilla 1.15 at 1840 / 1845 / 1850 / 1855 (the 1.0 canon on 1.13 per seed at 1855: 0.88–1.05×); vanilla 1.15 within ±3% of vanilla
  1.13's median over 1840–1855. n = 1 each: directions only.

- **U60** · T · a vanilla batch on 1.15 · `VANILLA_REF` / `VANILLA_WALL_REF`, `config/measured_base_wages.json` (the hiring and wage fixes move it
  more than an ordinary patch does: refresh it before any profit is quoted on 1.15), the error-noise catalogue, the fleet-loop calibration ·
  OPEN (needs the go-ahead).
- **U61** · B · the fleet path loop (F218, the one listed bug of wall-clock cluster 3) is plausibly fixed by *"fleet repair progress"* and the
  return of beaten fleets to their mission · `fleet_loop_runs.mjs` over the 1.15 vanilla batch: no signature empties cluster 3's list; one opens
  a fix again (the user, 2026-10-15) · OPEN. The final notes add more: the travel network rebuilt for consistent pathfinding, the AI no longer
  sends fleets out of port while they repair, a docked fleet can be recalled for repairs. The notes also list engine speed-ups (building-modifier
  re-evaluation, company availability by state, cached sway / laws / legitimacy, faster late naval battles) that touch our many rungs and
  companies: `VANILLA_WALL_REF` is re-measured in any case (U60).
- **U62** · T · a canon batch on 1.15 against the 1.15 vanilla, read through the criteria register and U30–U33 · OPEN (needs the go-ahead).

## Phase 7 — release and record

- **U70** · T · `supported_game_version`, the release build, README's list of replaced files (`tools/list_replaced_files.mjs`), KNOWN_ISSUES, the
  changelog, the Workshop text, the version log (ON_GAME_UPDATE §3), the findings, new couplings into ON_GAME_UPDATE §2 · OPEN. Done so far
  (2026-11-08): `supported_game_version` "1.15.*" in `mod/.metadata/metadata.json` (ON_GAME_UPDATE §1 step 7; `version` stays 1.0.0 until the
  release); the couplings of U27, U28, U42, U44 and U45 in ON_GAME_UPDATE §2.2.3 and §2.3.1; REPO_GUIDE entries for the four new tools. README's
  replaced-file list grows by ten files on 1.15 (`list_replaced_files.mjs` on the candidate's build against 1.0's `mod/`): `00_companies_ip5.txt`,
  `00_ip5_06_modifiers.txt`, `00_rlit_progress_bars.txt`, `00_rlit_scripted_triggers.txt`, `00_rlit_static_modifiers.txt`,
  `00_victoria_progress_bars.txt`, `08_tsarpoints_buttons.txt`, `ip5_russian_events_03.txt`, `rlit_cluster1_golden_age.txt`,
  `rlit_cluster2_crossroads.txt` (U05's A79–A86 and G2), and since Q11 four more: `ip5_je_values.txt`, `00_communism.txt`, `08_tsarpoints.txt`,
  `00_ai_decree_effects.txt`, and since Q10 two: `negotiation_values.txt`, `00_negotiation_quests_je.txt`; regenerate the list from the release build.
- **U71** · T · the docs that name the 2026-11-07 additions: REPO_GUIDE entries for `tools/game_diff.mjs`, `tools/lint_vanilla_names.mjs`,
  `tools/lib_pdx_script.mjs` and the `game-update` skill; a CLAUDE.md §5.2 row for the per-version register; a BACKLOG line pointing here ·
  DONE 2026-11-08 in the batch session's close-out commit (REPO_GUIDE: the three tools, this register beside ON_GAME_UPDATE with the skill's
  path; CLAUDE.md §5.2: the ON_GAME_UPDATE and `GAME_UPDATE_<version>.md` rows, the user's approval; BACKLOG §E and order item 5).
- **U72** · T · the repository builds for game 1.15 only since this pass: on the kept 1.13.11 game the build stops at `emit_dams` (the dam
  table names `STATE_SARATOV`, a 1.15 state region, U22) and `emit_vanilla_refs` at `00_art_jes.txt` (the 1.15 count, 12) · found 2026-11-08
  while testing Q11; nothing to fix: a hotfix of mod 1.0 on game 1.13 would build from a commit before the 1.15 pass began (2026-11-07; the
  1.0 release build is `796ce9f`, the player name `87f5744`), not from main · NOTED.

---

## Appendix — the preliminary reading of 2026-10-30 (moved from ON_GAME_UPDATE §4, verbatim)

Its section numbers (§2, §2.1, §2.2.10, routine step N) are ON_GAME_UPDATE's. The copper paragraph was added on 2026-11-07.

Read on 2026-10-30 from the preliminary 1.15 notes (the Modding and Bugfixes lists) against §2. The 1.1 pass re-reads the final changelog (routine
step 1) and confirms each item on the installed files; an item that turns out wrong is corrected here, not left.

**What a 1.0 install does on 1.15.** This is the first thing a rebuild does not fix (the list at the top of this file). Until mod 1.1 is released,
every 1.0 install overrides the 1.15 game with 1.13.11 copies of the 146 owned files (§2.1). The notes name these:
- `ship_interest_gain_mult` is removed (replaced by `ship_power_projection_mult` / `_add`). The 1.0 copy of
  `power_bloc_principles/00_power_bloc_principles.txt` still carries it in `principle_navy_1`, `_2` and `_3`.
- The AI rework adds `will_incorporate_state` and regional objectives to AI strategies. The 1.0 copies of `ai_strategies/00_default_strategy.txt` and
  `01_admin_strategies.txt` hold 1.13's strategies.
- `static_modifiers/00_code_static_modifiers.txt` is the engine's global block. Any base value 1.15 adds there is missing under the 1.0 copy.
- Map and history: the notes change harbour connections, a lake in China and North Angola's population. Only the diff of routine step 1 shows whether
  any of it sits in the 15 owned `state_regions` files or the owned 1836 history (`history/buildings` under `replace_paths`, 13 `history/pops` files).

On rebuild all of these follow 1.15. For 1.1 the work is to confirm that with the diff and the count lines (routine step 8).

**Script the notes rename or remove: none of it is ours.** None of these appears in `tools/` or the built `mod/` (checked 2026-10-30):
- `pop_type_percent_country` (now takes a script value);
- the war-exhaustion commands (now war support: `add_war_support_change`, …);
- `enemy_contested_wargoals`, `strait_trade_importance_by`;
- `has_employee_slots_filled` (operand order fixed);
- `primary_cultures_percent_state` / `_country` (now take a target country).

The only war-exhaustion name in the build is the modifier `country_war_exhaustion_casualties_mult`. It sits in four vanilla copies
(`technologies/20_military`, `power_bloc_principles/00_power_bloc_principles`, `static_modifiers/content_1_modifiers` and `content_4_modifiers`), which a
rebuild refreshes.

Two more fixes that do not reach us:
- 1.15 no longer substitutes script arguments inside quoted strings. No emitted `zzz_pm_rehaul*` file puts a `$arg$` inside quotes (the one `$…$` in
  `telemetry_lib.ps1` is PowerShell interpolation).
- The `dlc` field of events and journal entries may now list several DLCs. `check_dlc_gates.mjs` (L39) compares each copy with vanilla's file from the
  same game folder, so it holds whatever the syntax. Read its PASSED line.

**Engine behaviour the design rests on (§2.3.1, routine step 10).** Three bugfixes change how buildings hire and pay. The old-plant mechanism runs
through wages (CLAUDE.md §2.1, F97), and the direction of none of the three is argued. Read the laggard test (`laggard_pressure.mjs`), the old-rung
census and T0 on the first 1.15 canon batch against a 1.15 vanilla before carrying F249's readings over.
- *"Buildings now compare their productivity against their own building type rather than all types when deciding whether to raise wages."* In vanilla a
  building type is a whole industry. Here each rung is its own type, so a frontier rung now compares itself only with frontier rungs of its industry.
  That narrows the wage competition by which the frontier draws workers off the old rung.
- *Profitable buildings no longer lay off and rehire in a loop, and buildings still gaining workers no longer lower their hiring rate.* New rungs
  likely fill faster. Re-read the dead-define list (§2.2.1): if `BUILDING_MAX_PROFIT_TO_PAUSE_HIRES` is now read, the PAUSED class of
  `hiring_census.mjs` / `craft_fill.mjs` can follow the define instead of its heuristic (F185, F188).
- *New buildings take the dominant production methods of their own type, not of all types* (for countries born of a revolution too). This changes
  which secondaries a newly built rung opens on. Read it beside the luxury-line problem (F249 §4d).
- The wage and hiring changes move `config/measured_base_wages.json` (§2.4) more than an ordinary patch does. Refresh it from the 1.15 vanilla batch
  before any profit is quoted on 1.15.

**The testbed (§2.3.2).**
- **The fleet path loop** (F218, the one listed bug of wall-clock cluster 3). The notes fix *fleet repair progress* and send *fleets sent home after
  losing a naval battle back to their naval mission once repaired*, which plausibly is the loop. Run `fleet_loop_runs.mjs` over the 1.15 vanilla
  batch. If no run carries the signature, cluster 3's list empties and the calibration (F218 §7) is moot. If one does, a fix is open again (the user,
  2026-10-15: no fix unless 1.15 still has the loop).
- *Building profit predictions and goods availability no longer show no supply until the first day passes.* The `EARLY|boot` lines read the market
  from `on_game_started_after_lobby`, so compare them with a 1.13 session's.
- The console command `print_world_gdp` prints the combined yearly GDP of every country. One debug game is a direct check of the displayed world GDP
  the register reads (F45, F257).

**Research entries.** Scripted progress bars can take a script value or a math block for `min_value` / `max_value`. Since 2026-10-27 the urban-centre
entries read their figure through a script value (CLAUDE.md §4.1), and this could simplify them. Not needed for 1.1. New script hooks that may serve
later: `global_average_gdp_per_capita`, `has_building_levels_in_state_region` (country scope, one state region), `gdp_owned_by`.

**Treaty ports (§2.2.10).** The notes add:
- AI regional objectives, `will_incorporate_state`, the strait dependence links and `has_military_reach`;
- a rule that a country can no longer release one that could invalidate a treaty port it ceded inside its market.

Nothing in them touches the pursuit filter, the never-added rule or the port-building requirement, so the §2.2.10 list stands as written.

**Copper, the new good** (read 2026-11-07 from a third-party parse of the 1.15.0 files, `vanilla_parsed/` in the public repository
`jakeOmega/Vic3TimelineExtended`, game version 1.15.0 per its manifest; not from the installed files, so confirm in routine step 1). Base price 40.
- *Who consumes it, per level:* the power plant 2 / 4 / 5 (early / coal-fired / oil-fired, replacing 5 wood, 5 of 20 coal, 5 of 25 oil); arc-welded
  construction 10 (replacing 10 of 40 tools; tech era 5); telephones 30 (replacing 10 of 20 iron and all 20 lead); electric engines 10 (replacing 10
  of 30 electricity); percussion caps 5 and explosive shells 10 (replacing lead); two new artillery main methods, bronze cannons (10 copper for 15
  iron) and bronze smoothbores (20 for 25 iron), on the same technologies as cannons and smoothbores; 2 on electric sewing machines, automatic power
  looms and pot stills, 4 on patent stills, 1 on every assembly line, refrigeration method, the automated bakery and arcades. The copper mine makes
  20 / 40 / 60 / 70 by pump plus 12 / 20 by explosives. Neither our dams (6 tools + 6 engines per 300 electricity) nor our electric
  streetlights (2 coal) use any today. For 1.1 the dams take it in proportion, out of the engines (§10.108: 6 tools + 3 engines + 4.5 copper per
  300). The streetlights stay exactly as in 1.0, with no copper and no engines (§10.108.1); the field diff of routine step 5 must show
  their `pm_goods` and `pm_employment` unchanged.
- *Where it is mined:* `building_copper_mine` is a capped resource like lead's, unlocked by shaft mining, with the lead mine's methods. Read from a
  mod's copy of the 1.15 `state_regions` (`elfindel69/domus_iagiellonica`): **609 levels in 84 states**, against ~2,900 for lead and ~7,900 for
  iron. Two other copies agree state by state where they carry the file; a third (`real-tyrone/tyrone-mp`) adds 12 states of its own. The largest:
  Michigan 36, Katanga 30, Antofagasta 30, Zambia, Arizona and Tarapacá 18, South Australia 14, the West Country and Montana 12, Lower Silesia and
  Kanto 10. France and Belgium have none, and the Netherlands none in Europe. Confirm on the installed files in routine step 1.
- *The main methods' swaps are value-neutral at base prices* (copper 40 for iron, lead and tools at 40; the electric engines' +£100). The ladder's
  anchors (steam engines, percussion caps, telephones, cannons) keep their input values, so `lint_tier_eras.mjs` (L31), which checks a rung's input
  VALUE and not its mix, passes on the 1.0 book. **A rebuild of the 1.0 book on 1.15 therefore ships every rung on its 1.13 mix, with no copper, and
  nothing throws.** Only the regeneration of routine step 5 brings copper into the rungs.
- *Step 5 will throw on artillery:* `make_tier4_config.mjs` refuses more than four main methods, and the foundry now has six. Ruled (§10.108.2): the
  bronze pair becomes a switchable second main method on the t0 and t1 rungs at the same input value, so the generator must pair each with its iron
  twin instead of throwing.
- *Trade:* `make_trade_config.mjs` throws on a tradeable good in no class (§2.1, `goods/00_goods.txt`). F159 §5 has copper's historical wedge at
  32.7% falling to ~0, which puts it with the low-wedge classes (B or C). `tools/goods_prices.tsv` gains copper in step 6.
- *A 1.0 install on 1.15:* the owned 1.13 copies of `production_methods/01_industry.txt` and `06_urban_center.txt` replace 1.15's. Under them the
  power plants, telephones, motor and munition methods, sewing, stills, assembly lines and arcades consume no copper. The only vanilla consumers
  left are arc-welded construction and refrigeration. The copies also lack `pm_bronze_cannons` and `pm_bronze_smoothbores`, which 1.15's
  `pmg_foundries` names; expect `error.log` lines for them.
