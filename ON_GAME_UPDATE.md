# On a Victoria 3 game update

What to do when Paradox patches the game, and every place the mod depends on a vanilla file, a vanilla number or an engine behaviour. The mod is
built against **1.13.11** (`mod/.metadata/metadata.json` → `supported_game_version`). Mod 1.1 moves to game 1.15 (BACKLOG: 1.15 on 2026-11-05, a
stable 1.15.N about 11-12, mod 1.1 about 11-16), and this file is that pass's checklist; §4 lists what 1.15's patch notes touch. Add a coupling here
in the same pass that creates it (CLAUDE.md §5.1 rule 10).

**How the mod meets a patch.** Every build re-reads the installed game (`VIC3_GAME`, default the Steam path). Each vanilla file the mod owns is a
fresh copy of the installed file with our edits re-applied, and every edit asserts how often it matched, so a moved anchor stops the build instead of
shipping a silent miss. A rebuild does not fix three things:
1. **A build made before the patch** — the deployed mod, any released version — overrides the patched game with pre-patch copies of the files it
   owns (146 today, §2.1) until it is rebuilt.
2. **Values the repository stores instead of re-reading** — the canon's recipes, its tree twin, the measured snapshots (§2.4) — keep the old
   version's numbers, mostly without failing anything.
3. **Engine behaviour** that the design and the testbed rest on (§2.3) can change while no script file does.

---

## 1. The update routine

1. **Read the patch notes themselves**, from the forum changelog, not a search summary of it (one called 1.13.10 "localization-only"; it was a
   substantial hotfix). Check whether `binaries\victoria3.exe` changed: engine changes live there, and a count of touched script files cannot see
   them. If you can, keep the old version's `game\common`, `game\events` and `game\map_data` aside. Their diff against the new ones is the fastest map
   of what moved, and the save readers need the old good order to read pre-patch saves (§2.3.3).
2. **Mark the version boundary** with an entry in §3. Steam can update the game between two launches with nothing announced; the heartbeat counts
   `does not match game version` lines. A batch that straddles a patch is two batches. Every vanilla reference — `VANILLA_REF`, `VANILLA_WALL_REF`,
   `config/measured_base_wages.json`, the error-noise catalogue, the fleet-loop calibration — is the old version's until step 10 replaces it. Until
   then compare only arms run on the new version, in one batch.
3. **Refresh the two extracts the build reads before it rewrites them**, in a checkout no batch runs from (CLAUDE.md §5.1 rule 7):
   ```
   $env:VIC3_GAME = "C:\path\to\Victoria 3\game"      # only if the game is not at the default Steam path
   powershell -ExecutionPolicy Bypass -File tools\extract_start.ps1
   powershell -ExecutionPolicy Bypass -File tools\extract_vanilla.ps1
   ```
   Both are refreshed only by a canonical build: `config/start_baseline.json` (gitignored; the 1836 inventory the starting-technology grant is
   derived from) before the technology emitter, `ui/vanilla.js` (which the research-entry emitter reads) only after that emitter has run. Without this
   step a dry run derives the 1836 grant from the pre-patch map, and a dry run and the first canonical build both build the research entries from the
   pre-patch extract. `extract_start` prints `DRIFT: N split-industry factories have an unrecognized main PM` when a main method was
   renamed or added.
4. **Dry-run the canon against the patched game:** `powershell -ExecutionPolicy Bypass -File tools\build.ps1 -DryRun`. Each throw names its coupling
   (§2.1, §2.2). Fix the spec table, the pattern or the recorded count it names, never the assertion. Do not run the legacy solvers
   (`solve_be_targets.ps1`, `solve_volumes.ps1`, `solve_building_cost.ps1`): they rewrite a book's volumes by the retired break-even method and would
   overwrite the A/B ladder.
5. **Regenerate the canon from the patched game into a new named book, and field-diff it** against `config/mod_config.json` (CLAUDE.md §4.4):
   ```
   $env:TIER4_SUFFIX = 'tier4-e1'
   node tools\make_tier4_config.mjs --derive motor
   node tools\make_tier4_techs.mjs
   ```
   then the book's recorded commands in order (`_ab`, `_trade_variant`, `_dams_variant` … `_polish_*`), and read `node tools\lint_tier_eras.mjs
   --census` on the result against §10.78's table. This is the only check on what the build stores rather than re-reads: rung staffing and input
   mixes, technology eras and prerequisites (§2.2.2). Anything that moved is a canonisation, so it goes to the user with the diff.
   ⚠ **Never skip this step:** the user ruled on 2026-10-24 against an automatic detector for era and prerequisite moves, so this regeneration is
   the only thing that finds one. In the same step, check by hand that every key in the book's `ai_defines` still appears in the patched
   `common/defines/00_ai.txt` — neither the build nor the regeneration checks it, and a renamed key is ignored silently (§2.2.1).
6. **Refresh the snapshots the patch touched** (§2.4). Two feed the build or every reading: `tools/goods_prices.tsv` (the comparison command is in
   §2.4) and `config/measured_1836_pop_identity.json` (the craft seeding; it needs one vanilla 1836.2.1 save of the new version).
7. **Bump `supported_game_version`** in `mod/.metadata/metadata.json`, the one hand-maintained file in `mod/` (keep its `id`). An unbumped stamp logs a
   version-mismatch line in every run.
8. **Build:** `powershell -ExecutionPolicy Bypass -File tools\build.ps1`. It must reach `MOD CHECKS PASSED` and pass preflight. `lint.sh` prints
   `LINT PASSED` and `NEGATIVE-GOODS CHECK PASSED` without enforcing them: read them. Compare the build's count lines (§2.1) with the last canonical
   build's; a count that moves on an unchanged config means vanilla moved. Read preflight's L14 and L15 lines against §2.2.7.
9. **The post-patch smoke test.** First the harness: the observer diagnostic (§2.3.2, about a minute). Then the content: one canon run and one control
   run of a few in-game years through `run_schedule.ps1` (patterns: `tools/testbed/schedules/polish_final_smoke.json`, `vanilla_baseline_smoke.json`).
   Both launch the game, so both need the user's go-ahead (CLAUDE.md §5.1 rule 4). Read: the init marker and the version line; `error.log` by
   position, where nothing may name a `zzz_pm_rehaul` file or an owned path beyond the classes the control run also shows (re-baseline the
   error-noise catalogue of TESTBED_OPERATIONS §4 from the control); the define lines of §2.2.1, through `preflight.ps1 -Session <session>`; the
   `PMR_` research and dam lines in `debug.log`.
10. **Re-verify the engine behaviours the patch notes touch** (§2.3), then **re-baseline vanilla**: a vanilla batch on the new version (go-ahead), and
    from it `VANILLA_REF` / `VANILLA_WALL_REF` in `tools/testbed/ledger/lib_runs.mjs`, `measured_base_wages.json`, the fleet-loop calibration and the
    error-noise catalogue.
11. **Release the rebuilt mod.** Until then every installed copy overrides the patched game with pre-patch copies of the files in §2.1.
12. **Record** the §3 entry, the measurements in FINDINGS.md, and any new coupling in §2, in the same pass.

---

## 2. The couplings

Every reader of a game file strips the UTF-8 BOM first; a naive `^name = {` match makes each file's first block invisible (MODDING_NOTES). A new
reader must do the same.

### 2.1 Vanilla files the mod owns

A mod file at a vanilla path replaces vanilla's file whole. The canon build (`mod/`, 2026-10-21, book sha256 `728f2c7f84e6f467`) owns **146**
vanilla files. To list the owned files of any build (from the repo root, `mod` or `mod_<name>`):
```
Get-ChildItem mod\common, mod\events, mod\map_data -Recurse -File | Where-Object { $_.Name -notlike 'zzz_pm_rehaul*' -and $_.Name -ne '01_pm_rehaul_defines.txt' }
```
What holds for all of them: each is regenerated from the installed game on every build, so a patch reaches the game through the next build and not
before. `tools/check_dlc_gates.mjs` fails the build if a copy under `common/` or `events/` has a different number of `has_dlc_feature` lines or
`dlc =` fields than vanilla's file (L39; `map_data/` is not checked). The clean step wipes every emitted folder except `common/history` before each
build, so a file whose emitter stops writing it does not linger; `convert_history.ps1` clears `history/buildings` itself, and `emit_craft_start.mjs`
removes the pops files it wrote earlier, by their header.

**`common/buildings/01_industry.txt`, `06_urban_center.txt`** (2) — `build.ps1`; the power plant's cost by `emit_building_costs.mjs`.
- *What:* each tiered industry's vanilla building block is replaced by its rungs (16 industries in 01, the art academy in 06); every other block is
  copied verbatim. In 06 the power plant's `required_construction` becomes 1,600 (§10.89.1: 4 × vanilla's `construction_cost_medium`, 400); the
  line's comment names vanilla's value.
- *Breaks:* a renamed or moved vanilla building the config names throws. A rung is generated from config fields (group, icon, city type, cost,
  ownership type, background, the industry-ban `possible`, the coastal `potential`): any other field a patch adds to a tiered vanilla building — a
  conditional `ai_value`, `unique`, a new `potential` — does not reach the rungs (a new DLC gate does fail the build, through L39). If vanilla's
  power-plant cost moves, 1,600 is no longer 4 × vanilla: re-rule.
- *Check:* `emit_building_costs` throws unless exactly one `required_construction` line matches; re-audit the tiered vanilla buildings as
  `MISSING_BUILDING_CONDITIONS.md` says; read the power plant line's comment.

**`common/production_methods/01_industry.txt`, `06_urban_center.txt`, `07_government.txt`** (3) — `build.ps1`; `emit_research_levers.mjs`.
- *What:* `build.ps1` writes a vanilla methods file only when a transform changes it. 01: the gate remap (each `unlocking_production_methods` list
  that names a vanilla main method gains our rung's method). 06: the electric streetlights, 2 coal in, 10 services and 1 electricity out, 250
  engineers (§10.43.0; `pm_goods` / `pm_employment`, held in `lib_tier4_spec.mjs` as `PM_GOODS_RULED` / `PM_EMPLOYMENT_RULED`). 07: the three
  university base methods' `country_weekly_innovation_add` × 1/6 (`research_levers.university_innovation_mult`, §10.101.1).
- *Breaks:* an override naming an unknown method throws; a streetlights method without a `building_modifiers` workforce or level sub-block throws;
  each university method must hold exactly one innovation line (throws). The copies carry vanilla's other methods (06 holds the power plant's), which
  follow the patch on rebuild.
- *Check:* the build line `production_methods: owning N file(s) [...]`. A new name there means a transform matched a file it did not before.

**`common/ai_strategies/01_admin_strategies.txt`** — `build.ps1` (`building_subsidies`), then `emit_ai_schooling.mjs`.
- *What:* the `subsidies` block of every administrative strategy: the four dam types `must_have` (§10.89.14), the tooling workshop and the
  explosives factory removed (`none`, §10.92). `ai_strategy_default`'s own subsidies, read live from vanilla's `00_default_strategy.txt`, are restated only into
  strategies with no block of their own (§2.3.1, AI subsidies). Then `institution_scores = { institution_schools = { value = 100 } }` in each
  (`ai_schooling`, §10.97).
- *Breaks:* the builder keys on `type = administrative`, so a new administrative strategy is covered, and one that stops being administrative loses
  the subsidy policy silently. `ai_strategy_industrial_expansion` gaining a `possible` gate would end universal coverage (every AI runs exactly one administrative
  strategy today). `emit_ai_schooling` throws on fewer than six strategies or one already carrying `institution_scores`.
- *Check:* the copy's strategies (seven in 1.13.11) and their `type` lines.

**`common/laws/01_education_system.txt`** — `emit_ai_schooling.mjs`.
- *What:* the religious, private and public schools laws gain `+500 while the country has no schools` in `ai_enact_weight_modifier` (§10.97).
- *Breaks:* throws if a school law, or its single `ai_enact_weight_modifier` opening on `value = 0`, moves. `law_no_schools` itself is not checked.

**`common/static_modifiers/00_code_static_modifiers.txt`** — `emit_research_levers.mjs`.
- *What:* `base_values` weekly innovation 25 and innovation cap 25 (vanilla 50 / 50), `country_literacy_rate` cap 25 (vanilla 150) — the one
  innovation parameter x = 25 (`research_levers.static`, §10.101.1).
- *Breaks:* each key must sit exactly once in its block (throws). The file is the engine's always-applied global block: any patch to it reaches the
  game only through a rebuild.

**The four flat research adds** — `emit_value_overrides.mjs` (config `vanilla_value_overrides`, POLISH_1_0.md Q1, ×1/3).
- *What:* `company_philips` innovation cap 15 → 5 (`company_types/00_companies_europe.txt`), `principle_advanced_research_3` cap 5 → 1.5
  (`power_bloc_principles/00_power_bloc_principles.txt`), `modifier_expedition_geographic_study` weekly innovation 10 → 3
  (`static_modifiers/02_event_modifiers.txt`), `cuba_success_modernise` cap 30 → 10 (`static_modifiers/cuban_modifiers.txt`). Only
  `cuban_modifiers.txt` is owned for this alone; the other three are edited in the copies `emit_companies` and `emit_vanilla_refs` already write.
- *Breaks:* each entry states vanilla's value. A patch that moves the line or changes the value throws: read the new vanilla line and re-rule. DLC
  lines are counted before and after.

**`common/company_types/*.txt`** (22) — `emit_companies.mjs` (§10.64).
- *What:* every company reference to a tiered industry expanded to the whole chain; the anchor throughput-modifier types are copied for the rung keys
  (`zzz_pm_rehaul_company_modifiers.txt`, loc from each language's `modifiers_l_<lang>.yml`).
- *Breaks:* throws on a no-op transform, a mapped key in an unhandled context, or a missing anchor modifier type. Engine-side and unchecked: the five
  charter types and the formation rules (the technology for one listed building type, 5 levels in one state).
- *Check:* the line `emit_companies: N company files rewritten, M companies touched` against the last build.

**`common/goods/00_goods.txt`** — `emit_goods.mjs`.
- *What:* the `traded_quantity` of 35 goods (`goods_traded_quantity`, the five-class rule of §10.88, F159). Every other byte is vanilla's, including
  the order of the goods, which a save's indices follow (§2.3.3).
- *Breaks:* throws on an unknown good, a `local` or untradeable one, a good without a `traded_quantity` line, or a value below 1. The classes were
  derived from vanilla's `cost` (W = cost × traded_quantity, `make_trade_config.mjs`, the book's `_trade_variant`): a re-priced good keeps its old
  quantity until the chain is regenerated, and the maker throws on a new tradeable good until it is classed.

**`common/history/buildings/*.txt`** (16, under `replace_paths`) — `convert_history.ps1`, then `emit_secondaries.mjs` and `emit_craft_start.mjs`.
- *What:* vanilla's 1836 buildings, each factory placed on the rung its main method belongs to (the canon's start rules are empty,
  `config/start_exceptions.vanilla.json`); `emit_secondaries` re-points the activated secondary methods at the per-rung copies, and
  `emit_craft_start` sets the craft blocks' ownership and adds the seeded craft levels.
- *Breaks:* a renamed or added main method leaves its factories nowhere to land: the converter's `WARNING: N split-industry blocks had no recognized
  main PM`, the `unmapped` list in `start_baseline.json`, and L13's coverage check (`lint_start_conversion.mjs`, fatal). `Invoke-ModChecks` fails on a
  file count different from vanilla's or no `create_building` blocks. Because `replace_paths` makes this the only history the engine reads, an empty
  conversion would delete every starting building.

**`common/history/pops/*.txt`** (13) — `emit_craft_start.mjs` (§10.91.1, §10.91.5).
- *What:* in each state with craft levels, the craft workforce (every profession but laborers) is carved out of untyped pops into typed blocks; the
  output-matched seeding adds craft levels in each country's five most urbanised states and takes the same number of people from peasants. Identity,
  peasants and spare infrastructure come from `config/measured_1836_pop_identity.json` (§2.4).
- *Breaks:* throws on a craft state the pops history lacks, too few untyped pops to carve, or an unreadable level. A patch to 1836 populations,
  cultures or infrastructure makes the snapshot stale without failing anything.
- *Check:* the `craft start:` report lines (`SEEDING SCALED DOWN`, `SEEDING DROPPED`, fallbacks) against the last build.

**`common/state_traits/{01_scandinavia,03_north_america,06_eastern_europe,11_far_east_asia}_traits.txt`** (4) — `emit_dams.mjs`.
- *What:* the `goods_output_electricity_mult` line of five hydro traits (niagara_falls, krka_falls, angara_river, trondhjemsfjorden,
  hardangerfjorden) is removed; the dams replace them (§10.89).
- *Breaks:* throws if a named line is gone. A new hydro electricity bonus elsewhere is not caught: grep `goods_output_electricity_mult` in
  `common/state_traits`.

**`common/technology/technologies/{10_production,20_military,30_society}.txt`** (3) — `emit_techs.mjs`, then `emit_tech_finish.mjs`.
- *What:* 10 moves vulcanization to tech era 4 (the spec's `ERA_MOVES`) and adds conveyors to compression_ignition's prerequisites (`PREREQ_ADDS`,
  §10.93). In all three, the finish boost is appended to every researchable technology's `ai_weight` (+10,000 at ≥ 0.99 progress, F160).
- *Breaks:* every transform asserts its count. `emit_techs` throws if compression_ignition's vanilla prerequisites are no longer the tree's recorded
  `[combustion_engine]`; `emit_tech_finish` throws on a conditional `can_research`. A patch that moves any other technology's era or prerequisites
  does not throw: the game reads the new era and the tree twin keeps the old one (§2.2.2).

**`map_data/state_regions/*.txt`** (15) — `emit_dams.mjs` (`dams.layout = resource4`).
- *What:* each dam project's state region gets `building_dam_<class> = <slots>` in its `capped_resources` block (a new block where it has none): the
  engine's resource-slot cap, the logging-camp mechanism. Every other line is vanilla's.
- *Breaks:* throws if a project's region is not found exactly once. These are whole map files: arable land, resources and provinces in them reach the
  game only through a rebuild, and `check_dlc_gates` does not read `map_data`.

**63 vanilla script files that name a tiered industry** — `emit_vanilla_refs.mjs` (POLISH_1_0.md §2, `TIER_REFERENCE_AUDIT.md`).
- *What:* each reference rewritten to the rung set ruled for it. The generator's `SPEC` table is the list (under `common/` unless `events/`):
  - `ai_strategies/00_default_strategy`; `amendments/00_amendments_enactment_04`; `decisions/grand_exhibition_decision`;
    `laws/01_economic_system`; `power_bloc_principles/00_power_bloc_principles`; `scripted_triggers/00_scripted_triggers`;
  - `journal_entries/` (8): 00_art_jes, 00_belle_epoque, 00_liberalism, 00_player_objectives_economic_dominance, 00_prohibition_laws,
    00_trade_route_event_missions, 03_russia, 06_economic_regeneration;
  - `scripted_buttons/` (4): 00_balkan_wars_buttons, 03_paraguay_scripted_buttons, 05_serbia_buttons, 06_vernacular_buttons;
  - `scripted_effects/` (3): 00_scripted_effects, 00_victoria_scripted_effects, 04_negotiation_scripted_effects;
  - `static_modifiers/` (17): 00_ip3_02/03/04_modifiers, 00_ip4_03/04_modifiers, 02_event_modifiers, 104_modifiers, 105_modifiers,
    agitators_4_modifiers, agitators_4_revolution_modifiers, brazil_2_modifiers, content_1/2/3/4_modifiers, japan_single_fire_events_modifiers,
    montenegrin_modifiers;
  - `events/` (25): assassination_events, belle_epoque_events, decree_events, decree_events_02, fascism_events, ig_suppression_events,
    industrial_accidents_events, krakatoa_events, liberalism, pm_events, trade_route_events; balkans_events/ 03_ip3_austria_events, montenegro_events,
    national_awakening; brazil/ amazonas, paraguay; iberia_events/ip4_anarchism_events; japan_events/ep2_japan_events_03; law_events/
    citizenship_laws, economy_laws; tech_events/ camera_film_pm_events, military_tech_events, production_tech_events, society_tech_events,
    war_crimes_events.
- *Breaks:* every snippet and token count is asserted (throws). A scan of the whole game tree throws on a tiered vanilla key, a vanilla main method or
  a renamed secondary in any file nobody owns, unless `ACCEPTED` names it (8 files today, each with its reason).
- *Check:* re-read the file's `TIER_REFERENCE_AUDIT.md` row; on a kept build (`-SaveTo`), `$env:REFS_LEARN = '1'; node tools\emit_vanilla_refs.mjs
  <modDir> config\mod_config.json` prints every file's counts beside the spec's without dying; record the new counts in `SPEC`.

**Owned only when a book asks for it** (the canon does not):

| file | when | emitter, and its guard |
|---|---|---|
| `common/scripted_effects/00_starting_inventions.txt` | the 1836 grant derived from the map adds to vanilla's (POLISH_1_0.md H6) | `emit_techs`; throws if the file's shape moves |
| `common/pop_needs/00_pop_needs.txt` | `pop_need_weight_mult` (the overlay arm, `config/vanilla_weight_x10.json`) | `build.ps1`; log `pop needs: scaled N weight line(s)` |
| `common/building_groups/00_building_groups.txt` | `building_group_ai` | `emit_building_groups`; throws if a named group or field is gone |
| `common/production_method_groups/<file>` | `pmg_drop_methods` | `build.ps1`; throws if no group file contains the method |
| `common/buildings/11_private_infrastructure.txt` | a tiered industry with that `source_file`, or `treaty_port_rules.trade_center_gate` | `build.ps1` / `emit_treaty_port_rules` (§2.2.10) |
| `common/treaty_articles/14_treaty_port.txt`, `common/war_goal_types/25_take_treaty_port.txt` | `treaty_port_rules` | `emit_treaty_port_rules` (§2.2.10) |
| `base_values` dam level caps in `00_code_static_modifiers.txt` | `dams.layout = per_project` | `emit_dams`; throws unless `base_values` is one block |

**Additive files** — every `zzz_pm_rehaul*` file (121 in the canon build, the localization `replace/` files among them) and
`common/defines/01_pm_rehaul_defines.txt`, a partial override in which only the named keys change. They own no vanilla file, but they lean on
vanilla names (§2.2): they hook vanilla on-actions (`on_game_started_after_lobby`, `on_monthly_pulse[_country]`, `on_yearly_pulse[_country]`,
`on_acquired_technology`, `on_building_built`, `on_building_expanded`; L22 forbids an `effect` block on a vanilla on-action), the crafts' group
`bg_pmr_crafts` names `bg_light_industry` as its parent, and the dam and research files point at vanilla icons (`hydroelectric_plant.dds`, `power_plant.dds`,
`event_industry.dds` and others). A renamed on-action, group or icon fails only in the engine (`error.log`, or missing art).

### 2.2 Vanilla numbers, keys and defines the mod reads or overrides

#### 2.2.1 The defines the canon sets

`common/defines/01_pm_rehaul_defines.txt`, written by `emit_techs.mjs`:
- **NAI** (config `ai_defines`, §10.75, F158): `PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING` 0.000125,
  `MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR` 0.95, `MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD` 1,
  `MONEY_SPENDING_CONSTRUCTION_EXCESSIVE_THRESHOLD` 2, `CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED` 0.1,
  `PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD` 160, `PRODUCTION_BUILDING_VERY_LONG_CONSTRUCTION_TIME_THRESHOLD` 240.
- **NEconomy** (config `game_defines`, §10.102): `WORLD_MARKET_MONOPOLY_THRESHOLD` 0.99 — an engine-only key, registered in the exe and set by no
  vanilla file (vanilla's own `WORLD_MARKET_MONOPOLY_MIN_SHARE` is dead, F241). `emit_techs` lists such keys in `ENGINE_ONLY_DEFINES`.

How a patch breaks them, none of it failing the build:
- The engine range-checks each value at load and keeps vanilla's on a rejection (L33): `error.log` `Define 'X' not valid with given value`.
- A key the engine stops reading is dead: `debug.log` `Define 'X' defined in '<file>' not specified`.
- A renamed NAI key is not caught by the build: `emit_techs` checks `game_defines` keys against `00_defines.txt` (and refuses the nine dead keys of
  `00_defines.txt` listed in `DEAD_DEFINES`), but it does not check `ai_defines` against `00_ai.txt`.
- An engine-only key the exe no longer registers is simply dead.

Checks: `powershell -File tools\preflight.ps1 -RepoOnly -Only L33` (the static half, against the hand-kept `BOUNDS` table); after the smoke run,
`preflight.ps1 -Session <session>` reads every run's rejections and any dead key our file sets; the heartbeat prints `DEFINE REJECTED AT LOAD`. For
the engine-only key:
```
node -e "console.log(require('fs').readFileSync(process.argv[1]).includes('AVCDefineRegistryHelper_NEconomyWORLD_MARKET_MONOPOLY_THRESHOLD'))" "C:\path\to\Victoria 3\binaries\victoria3.exe"
```
must print `true`. Re-read the dead-key list from a fresh run's `debug.log` (F241 found 15 in 1.13.11, across `00_defines`, `00_ai` and
`00_graphics`) and update `DEAD_DEFINES`; add any new bound the engine states to L33's `BOUNDS`.

#### 2.2.2 What the ladder is computed from

The canon's recipes, costs and AI values were computed from vanilla 1.13 by the generator chain (CLAUDE.md §1.3, §4.4): each rung's vanilla main
method (output, input mix, staffing, pollution, icon, gate technology), K₁ from the vanilla building's construction-cost script value, and the tier
from the gate technology's tech era (the tier rule, §10.78). The book stores the results. The tree twin `config/tech_tree_options.json` stores
vanilla's technology eras, names and prerequisites as they were at generation.

What re-reads the game on every build:
- `lint_tier_eras.mjs` (L31) recomputes each rung's output and input value from the live anchor method: a patch that changes an anchor recipe fails
  the build.
- L13's coverage check reads vanilla's main methods live: a new main method on a tiered building fails the build.
- `build.ps1` checks each rung's config name against vanilla's English localization, `<building> (<method>)`, and the method names likewise (the
  translated names reuse vanilla's keys in all 11 languages): a patch that retitles a tiered building or method in English makes the build throw.
- `emit_techs` re-reads compression_ignition's prerequisites (above).

What nothing compares to the game: a rung's staffing, its input mix at equal value, a non-anchor rung's own method, and every technology's era and
prerequisites in the twin. A patch that moves a gate technology's era re-places rungs on regeneration: `make_tier4_config` prints each rung's
deviation and throws beyond ±1 tier or on an unruled overflow — the answer is a `PLACEMENT` ruling in `tools/lib_tier4_spec.mjs`, not a guess.
⚠ The check for all of this is routine step 5: regenerate and field-diff.

Two more silent couplings of the ladder:
- **The construction-cost anchors** 200 / 400 / 600 / 800 (`construction_cost_low` … `_very_high` in `common/script_values/building_values.txt`) are
  hardcoded in `make_ab_config.mjs`, `lint_tier_eras.mjs`, `ladder_options.mjs` and `ui/builder.html` (`VANILLA_CONSTRUCTION`). Change all four if
  vanilla's move. The sheet's copy feeds Bring to vanilla and lists only these four: a building on `construction_cost_very_low`, or on no script
  value, would get `undefined` there (harmless while those groups stay locked).
- **Main-method modifiers.** A rung's method carries only the goods, employment and pollution the config holds. Any other modifier a patch puts on a
  tiered industry's vanilla main method is dropped without a word. Read those methods for anything else after a patch (the last such case was the
  shipyard's `country_ship_construction_add`, and shipyards are no longer tiered).

#### 2.2.3 Spec tables that name vanilla keys

Tables and rules in our code that name vanilla keys or lean on vanilla's order; all but the last bullet throw when a key is gone:
- **`tools/lib_tier4_spec.mjs`** — `INDUSTRIES` (vanilla building keys), `PLACEMENT`, `ERA_MOVES`, `PREREQ_ADDS`, `ADDITIONS`, `PM_GOODS_RULED` /
  `PM_EMPLOYMENT_RULED`. `make_tier4_config` throws on a missing building, method or technology, on more than four main methods, and on an era-rule
  overflow; `make_tier4_techs` throws on a stale `PREREQ_ADDS` entry (a technology gone, or the prerequisite already vanilla's).
- **`tools/lib_secondary_compat.mjs`** — the reviewed compatibility table (`REVIEWED`, `NOT_BESIDE`, `MANDATED`) names vanilla secondary methods;
  `validateCompat` throws on a renamed key. `lint_pm_combos.mjs` (fatal, §10.93) prints `WARN … carried pair(s) the compatibility review never
  looked at` when a patch adds a secondary to a tiered industry's group: review the new pairs and add them. Read `emit_secondaries`' "not
  carried" list and each mandated automation's `keeps its own gate` / `dropped` line; lint check 7 fails a kept gate the main method's prerequisite
  closure does not cover. `lint_pm_combos` checks vanilla's own buildings too: if a vanilla building's combination goes negative, confirm it is
  vanilla's before touching ours.
- **`emit_secondaries.mjs`** — a copied `replacement_if_valid` must name its own copy (the Food Standardization 3 canning switch, 85 groceries,
  POLISH_1_0.md Q3); a new vanilla `replacement_if_valid` on a tiered building's secondary throws until it has a copy.
- **`tools/lib_dams.mjs`** `tech_by_class` (electrical_generation, steam_turbine, arc_welding) and **`config/dam_projects.json`** (state keys, anchor
  provinces): `emit_dams` throws on a missing technology, state region or anchor province. The fix for a redrawn region is a new anchor province in
  the same state, never dropping the check. A class technology that changes era moves every dam of its class.
- **The "most basic secondaries" basis** (§10.93) — the building names' Recipe BE, the book's stored `target_be` and `lint_profitability.awk` take
  each group's first member that is legal beside the main method. A patch that reorders a vanilla group's members, or puts a non-"off" method first,
  moves those break-evens without failing anything: `node tools\restate_basic_be.mjs --config config\mod_config.json` (without `--write`, which would
  edit the canon in place) reports every rung whose BE moved.

#### 2.2.4 The research entries

`emit_research_events.mjs` (§10.95–§10.98):
- **Read live, throws on a miss:** era base costs (`common/technology/eras`, fewer than five throws); `law_isolationism` in `common/laws`, tested with
  `has_law_or_variant`, so a new variant is covered and a renamed key throws; the shipping tree's technologies; and since 2026-10-28 (ruled
  2026-10-24) the war and naval channels' reads — the land unit technologies from `common/combat_unit_types/00_land*` (marines skipped by unit
  group; fewer than 8 throws, 1.13 has 10), the fleet technologies from `common/ship_types/00_ship_types.txt` (an unreadable file, or fewer than
  8, throws; 1.13 has 11 over 19 ship types), and the battalion manpower (no `max_manpower` value throws; it used to fall back to 1,000). A patch
  that legitimately cuts a channel below its floor: check it by hand, then lower `UNIT_TECHS_FLOOR` / `SHIP_TECHS_FLOOR` in the same pass.
- **Read from `ui/vanilla.js`:** building groups and the anchor buildings' per-level employment — refreshed after this emitter (routine step 3).
- **Raw script, not validated by the build:** the condition entries, condition values and monthly global effect name vanilla laws (law_council_republic,
  law_factory_councils, law_collectivized_agriculture, law_traditionalism, law_no_colonial_affairs and others), regions, subject types,
  `rank_value:major_power`, and building types (building_university, building_government_administration, building_financial_district,
  building_chemical_plant, building_urban_center). A renamed key fails only in the engine.
- *Check:* the build line `research events: N technologies (n industry, n war) -> …` against the last build; `error.log` lines naming
  `zzz_pm_rehaul_research*`.

#### 2.2.5 Vanilla values the canon rides without owning them

- **The gold mine's `ai_value` 5000** — vanilla's own line under `building_gold_mine` in `common/buildings/03_mines.txt`, ruled to stay (§10.92.1).
  The mod does not own that file, so a patch that moves the line moves ours silently. Restoring it would need a new owned copy (the `emit_goods`
  pattern).
- **The Nile start maluses** (§10.89) — `Basin Irrigation` (−0.1) in Middle and Upper Egypt is sized against vanilla's `state_trait_nile_river`
  agriculture bonus (+0.2); a patch that changes that bonus changes the net 1836 value.
- **The power plant's 1,600** and **the trade weights' classes** (§2.1) — each defined relative to a vanilla number.

#### 2.2.6 The wage model

`tools/lib_wage_model.mjs` (CLAUDE.md §2.10) reads `wage_weight` from `common/pop_types` and `POP_SIZE_PACKAGE` (the wage rate's denominator) from
`common/defines` live; both throw if the key moves (fewer than 10 weighted pop types, or no `POP_SIZE_PACKAGE`). The measured wage path is a snapshot
(§2.4).

#### 2.2.7 The 1836 start checks

Preflight's L14 and L15 run `tools/verify_start_techs.mjs` on every build: does each country hold the technology for every building and method its
own 1836 history activates (L14), and does it keep every starting technology vanilla gives it (L15)? Both compare against the same analysis of pure
vanilla, because vanilla itself fails L14 on six countries — AUS, FRA, PRU and RUS (`fractional_distillation`), BAV (`railways`), SPA
(`atmospheric_engine`), measured on 1.13.10, unchanged on 1.13.11. A patch that fixes or adds a vanilla gap changes L14's `inherited, not ours` line.
The canon's grant is derived from the 1836 map and repeats vanilla's named grants, read live from `00_starting_inventions.txt` (vanilla names three
technologies its map needs before their onset: central_archives 1838, mechanical_tools 1840, intensive_agriculture 1842; TESTBED_LANDMINES L14). If
a patch adds a fourth such case and does not name it, L14 is what finds it.

#### 2.2.8 The research model

`tools/research_model/` (F223, §10.96) reads the tree, era costs and AI weights live (`lib_tree.mjs`), but `lib_sim.mjs` holds vanilla 1.13's engine
constants in `DEFAULT_LEVERS`: innovation base and cap base 50 / 50, cap per literacy 150, spread 25 + 75 × literacy, unspent innovation 0.2
(`base_values`, `country_literacy_rate`, `excess_innovation`), the ahead-of-time penalty 0.25 (NTechnology), the measured rank malus −0.234; and
`LAW_SPREAD`, the law spread multipliers (`02_free_speech.txt`, `01_trade_policy.txt`). Its behavioural rules were measured on vanilla 1.13 saves:
spread picks uniformly in the oldest missing era; the AI researches in each tree's oldest era with P ∝ ai_weight⁴. After a patch, re-run
`flow_check.mjs`, `spread_pick.mjs` and `research_pick.mjs` on a fresh vanilla series and compare.

#### 2.2.9 The balance editor's extracts

UI only, never shipped; regenerated by every canonical build.
- **`ui/vanilla.js`** (`extract_vanilla.ps1`) — every vanilla building, group and method with all their gates; a method with `unlocking_principles` is
  marked `gated`. Also read by the research emitter (§2.2.4).
- **`ui/icons.js`** (`extract_icons.ps1`, gitignored: Paradox art) — each good's `texture` from `00_goods.txt`, decoded only from uncompressed 32-bit
  BGRA `.dds`. If a patch switches the icons to DXT/BC compression, every icon is skipped with a note and the sheet shows text only.
- **`ui/presets.js`** (`extract_presets.ps1`) — reads the 1836 history, `map_data/state_regions` (`arable_land`, `subsistence_building`), the
  `SLAVE_BASKET_*` defines (with fallbacks 8 / 1 / 12 / 0.5 / 1.0 / 0.05, warned per key), `buy_packages`, `pop_needs`, `pop_types`
  (`working_adult_ratio`, `consumption_mult`) and the building files. Engine-side assumptions written into the tool: `$STRATA` (a new profession warns
  and is treated as lower), `$SUBJECT_TYPES` (a new subject type silently drops out of its overlord's market), every subject shares its overlord's
  market unless a `grant_own_market` pact exists, an ownership building has one level per owned level, subsistence staffing 5,000 a level (rice
  10,000). Mirrored as constants: `POP_SIZE_PACKAGE` 10,000 (the sheet's fallback), `WORKING_ADULT_RATIO_BASE` 0.25, `DEPENDENT_CONSUMPTION_RATIO`
  0.5. The rules are in REPO_GUIDE (Country preset derivation).

#### 2.2.10 Treaty ports — deferred to mod 1.1 on game 1.15

Not in the canon (§10.103): deferred because 1.14's AI rework, folded into 1.15, may change the engine behaviour the layers were built around. Before
deciding which layers 1.1 ships, re-measure in this order; each item is an engine fact measured on 1.13.11:
- **The pursuit filter** (F244 §2): the AI starts treaty-port plays only against unrecognised or decentralised hosts, whatever the desire. Re-run the
  extreme desire without a driver (`tools/testbed/schedules/tp_extreme_10y.json`, book `…-wm99-tpx`) and count recognised-host treaty-port goals with
  `ledger/war_goal_mix.mjs`; in a debug game, `ai_evaluate_treaty_port` prints the engine's score for one state.
- **The never-added rule** (F244 §5): a treaty-port demand is only ever a play's opening goal (opened against added in `war_goal_mix.mjs`, any
  30-year run). The untested script candidate is `skip_build_list` in `common/war_goal_types/25_take_treaty_port.txt`.
- **The port-building requirement** (F244 §6–§8): `is_potential_treaty_port` fails for portless states, and treaty-port status is set only where the
  state holds a port at the cession (`tp_potential_probe.json`, `tp_rules_probe2.json`).
- **The stances** (F244 §10): the `country_goal` records, the reason `AI_REASON_WANTS_TREATY_PORTS` under the secret goal `conquer`, and what script
  can read (`has_secret_goal`, `has_attitude`) — `ledger/ai_country_goals.mjs` on a kept save. The rework may rename them.
- **The defines:** `TREATY_PORT_INITIAL_MIGRATION`, `TRADE_CENTER_ADVANTAGE_TREATY_PORT_FACTOR`, `PRODUCTION_BUILDING_TREATY_PORT_TRADE_CENTER_FACTOR`,
  `WAR_GOAL_TREATY_PORT_BUILDING_LEVEL`, the `DIPLO_PLAY_CONFIDENCE_*` terms an organic driver would mirror, and the five
  `TRADE_CENTER_MINIMUM_GDP_*` in `00_ai.txt`: the AI's eligibility filter for trade centres — market capital 100,000, other states 500,000 yearly
  GDP, ×2 non-coastal, ×2 unrecognised, × (1 + years since 1836 × 0.02). Their load-time bounds: both > 0, `NON_MARKET_CAPITAL` > `MARKET_CAPITAL`
  (L33). The gate is not absolute: the AI built trade centres in Qing treaty ports at a quarter and a tenth of it (F246).
- **The save fields** the readers use (save summary v19): `war_goal_manager`, `treaty_article_manager`, a state's `treaty_port=yes`, `country_goal`.

The emitters, when a book enables them:
- **`emit_ai_treaty_ports.mjs`** (`ai_treaty_ports`, F243): a block appended to each administrative strategy. It throws on a law key vanilla lacks, a
  variant listed before its parent, or a strategy already carrying `treaty_port_value`. Not checked: the rank keys (`common/country_ranks`; a renamed
  one never matches — read `error.log` for `rank_value`), the protectorate subject type's `valid_subject_ranks`, and whether the engine still reads
  `treaty_port_value` from an administrative strategy. The driver also depends on `dp_take_treaty_port` and its `possible`, `create_diplomatic_play`,
  `ordered_state`, `ai_treaty_port_value(<country>)`, `is_diplomatic_play_committed_participant`, `aggressive_diplomatic_plays_permitted` and
  `infamy_threshold:infamous`; a renamed one silences it (no `PMR_TPD` lines in `debug.log`).
- **`emit_treaty_port_rules.mjs`** (`treaty_port_rules`, F244 §6–§8): whole-file copies of `treaty_articles/14_treaty_port.txt` and
  `war_goal_types/25_take_treaty_port.txt` with exact lines replaced (`is_potential_treaty_port = scope:other_country` twice,
  `is_potential_treaty_port = root`, `validate_take_treaty_port`, the six-tab `cede_treaty_port = scope:state_taker`), each asserted. Its
  `trade_center_gate` adds a copy of `buildings/11_private_infrastructure.txt` (the trade centre's two `can_build` blocks must read exactly
  `trade_center_construction_allowed = yes`) and reads the five `TRADE_CENTER_MINIMUM_GDP_*` live, plus `years_since_game_start`
  (`script_values/ip4_je_values.txt`), the state-scope `gdp` and `is_treaty_port` triggers and the `market.owner.market_capital` link. If a patch puts
  a treaty-port term into the engine's own gate, the script copy is redundant.

1.13.10 added the `on_treaty_ports_inherited` on-action and the `renege_treaty_ports_with` effect.

### 2.3 Engine behaviours the mod and the testbed rely on

#### 2.3.1 The design

- **Vanilla's electricity gate** (2026-10-26): every vanilla method that consumes electricity carries `required_input_goods = electricity`
  (30 of 30 in 1.13), and `build.ps1` writes the same on our main methods from their recipes. `lint_pm_combos.mjs` check 9 holds the rule over
  every method the game loads, vanilla's included, so a patch that adds a gated method fails nothing, while a patch that changes the rule (a
  consumer without the gate, another good gated) fails the build: re-read vanilla's methods and decide whether the rule moved.
- **The electricity build condition** (§10.106; DEFERRED to mod 1.1, not emitted in 1.0 — the lines below apply once it is restored):
  `emit_electricity_gate.mjs` derives the producers from every method that outputs electricity and gates the buildings whose groups run only
  on electricity. A patch that makes `required_input_goods` block construction by itself makes the
  condition redundant (harmless); one that renames `building_power_plant`, `pm_electric_streetlights` or the trigger `level` changes the
  producer clauses — the emitter prints the producers it found, so compare that line with the previous build's.

- **Defines** are a partial override, and each value is range-checked at load against hardcoded, undocumented bounds that are not always what
  vanilla's comment says (`MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR`: "capped at 1", validated as [0, 1)). A bound can refer to a
  sibling define. Rejected values keep vanilla's (L33, §2.2.1).
- **The world-market monopoly markup** (F241 addendum, §10.102): a good's world price × (1 + `MONOPOLY_PRICE_IMPACT` 0.2 × the top exporting market's
  share of world exports) once that share exceeds `WORLD_MARKET_MONOPOLY_THRESHOLD` (built-in default below 0.36 in 1.13.11; the canon sets 0.99). A
  patch that renames the key or changes the rule voids §10.102. Re-measure with a continuation A/B: a game continued from a save is deterministic, so
  n=1 per arm is exact (F241).
- **Trade** (F155, §10.88): a trade centre's merchant marine is paid per staffed level, not per unit traded; world-market trade pays no convoys
  (`convoy_cost_multiplier` is a military and shipping-lane field); idle capacity makes trade centres downsize
  (`AUTO_DOWNSIZE_BUILDING_MIN_UNUSED_TRADE_CAPACITY` 20, `_FRACTION` 0.1). The per-good trade weights rest on all three: if a patch makes trade volume
  cost convoys, raising traded quantity stops being free. Re-read F155 §2–§3 against the patched files (`state_trade_quantity_mult` had three users
  in 1.13).
- **Research** (F160): `has_technology_progress` reads progress as a fraction of the penalised cost (219 of 219 readings), and a grant that reaches the
  cost acquires the technology on the spot. If the patch notes touch research or the AI, re-run the force test (schedule
  `finish_boost_p45_force_ab.json`, reader `ledger/finish_force.mjs`, two short runs; 1.13 read 52/52 on against 0/42 off), and check that vanilla's
  heaviest `ai_weight` (101.5 in 1.13) stays far below `finish_boost.add` 10,000.
- **Dams** (F168, F173/F174, §10.89): with an ownership type and local electricity demand, the AI builds dam levels itself; the AI scores every visible
  decision in one pass, so AI surveys go through the quarterly driver; `capped_resources` caps a building type per state region for every builder
  (resource4); `start_building_construction` builds into the state owner's queue; no data function returns a country tag (log lines carry the name).
- **The 1836 start:** a history `create_building` is checked against the technology of the region_state's own country, not the one `add_ownership`
  names, and it fails silently (L14, F68). `replace_paths` makes the mod's history the only one the engine reads.
- **AI subsidies:** whether a typed strategy's `subsidies` merge with `ai_strategy_default`'s per key or replace them is unsettled. The one probe
  (2026-07-23, removed since) read the power-plant subsidy state by strategy group in 2078: every AI power plant was subsidised, both in strategies
  with their own block (142 of 142) and in the control group (43 of 43). That is late-game data only — `debug.log` had rotated away 1836–2077, the
  early-electrification window where a cash-strapped AI would show replacement — and the autonomous subsidy model (`NAI` `SUBSIDIZE_*`) can subsidise
  power plants on their merits, so it is suggestive, not decisive. The builder's rule is right under both readings (MODDING_NOTES); a patch may settle
  the question.
- **Economy constants used everywhere:** the price band of 25–175% of base (`lint_solvency.mjs` L18, the red flags, the sheet's band flags) and a
  weekly economy tick, 52 a year (every £-per-week figure, every payback, displayed GDP = 52 × weekly value added).

#### 2.3.2 The testbed harness

The observer drives the executable and the launcher's settings files, none of them moddable data; a patch can change them silently. Detail:
MODDING_NOTES, "Automated headless runs". **The observer diagnostic** (the harness half of routine step 9; it launches the game):
```
powershell -ExecutionPolicy Bypass -File tools\build.ps1 -SaveTo smoke -TelemetryOn
powershell -ExecutionPolicy Bypass -File tools\testbed\run_observer.ps1 -Runs 1 -DumpDates 1836.3.1 -UntilDate 1836.4.1 -ModPath "$PWD\mod_smoke"
```
About a minute; the session lands in `tools\testbed\sessions\<stamp>\`. The observer refuses a mod without telemetry. `meta.json`'s `mod_loaded`,
`dump_complete`, `goods_rows` and `mirrored_lines` are the assertion.

| coupling | where | how a break shows |
|---|---|---|
| CLI arguments `-handsoff`, `-run_until=`, `-disable_renderframeifneeded` | `victoria3.exe` | the game sits in the main menu or never exits; the watchdog kills it and flags `timed_out` |
| mod enabling through `content_load.json` (objects with an absolute `path`) | `Documents\Paradox Interactive\Victoria 3\` | `mod_loaded=false`; `debug.log` says `Missing path for dlc/mod` or `No subdirs mounted` |
| `pdx_settings.json` keys `Graphics.display_mode`, `game.autosave` | same folder; the game rewrites the file on exit and drops default-valued keys | fullscreen runs, or a changed autosave cadence (how much a crash resume loses) |
| crash artifacts `crashes\victoria3_<stamp>\` (`exception.txt`, `minidump.dmp`) | the engine's crash handler | a crash reads as a manual kill; the 60-s grace prompt goes unanswered and the run resumes when it should stop |
| `-continuelastsave` loads the newest save on the machine | `frontendidlerlogic.cpp` | resume guards fire and runs are abandoned with `abandoned_reason` |
| data functions `GetMarketGoods.GetGoods.{GetKey,GetMarketBuyOrders,GetMarketSellOrders,GetMarketPrice}`, the `every_market_goods` iterator | engine, through `debug_log` | `goods_rows = 0` and `Data error in loc string` in `error.log`; one bad function voids the whole line |
| wage and pop-income data functions (TESTBED_METRICS §5) | engine | the `PW` / `SW` lines stop appearing; re-probe with `wage_probe.json` |
| `on_monthly_pulse` on the 1st of each month, no root scope | `00_code_on_actions.txt` + engine | `dump_complete=false` |
| `on_game_started_after_lobby` reads an initialised market | engine start order | the `EARLY\|boot` lines come back all zero |
| `trigger_event = { id = … days = N }` from the start hook; `events/` read from a mod | engine | no `EARLY\|day7` lines (the `scenario_probe` metric only) |
| `market = c:TAG.market` as a country-scope trigger | vanilla idiom (`01_silkworm_diseases.txt`) | ⚠ silent: an invalid trigger in a `limit` is ignored and the sweep covers all ~285 countries, flooding the log; count the `MEMBER` lines (6 for BEL + AUS in 1836) |
| `building_urban_center` as `URBAN_CENTER_BUILDING` | `00_defines.txt`, read by `v3tb_lvl_urban_center` | urban-centre levels read 0 |
| the stratum map (aristocrats, capitalists … peasants, slaves) | `telemetry_lib.ps1` and `extract_presets.ps1` `$STRATA`, which must agree | a new profession is treated as lower by the extractor and is missing from the telemetry sums |
| `wage_weight` per pop type | `common/pop_types`, mirrored in `extract_measured.ps1` `$WW`, `telemetry_lib.ps1` `Get-WagePopTypes`, `ui/builder.html` `WAGE_WEIGHT` | a changed weight rescales every measured base wage; a new pop type reads `v3tb_poptype_id` 0. Update all three together; `Get-WagePopTypes` is append-only (its order encodes every recorded session) |
| `WORKING_ADULT_RATIO_BASE` 0.25, `_SKEW_MAXIMUM` 2.0 | `00_defines.txt` (aristocrats 0.2 and slaves 0.5 override it in `pop_types`) | Q3's baseline moves |
| log names and rotation (`debug.log` 512 KB × 5, `dedicated_server.log` tick lines) | `platform_specific_game_data/log_settings_live.json` | blank progress or missing rows; check that `mirrored_lines` is non-zero |
| the quarter-day tick schedule (F218 §7–§8) | `ledger/tick_profile.mjs`, `fleet_loop_runs.mjs` | silent; see below |
| named country tags (L1 guards each with `exists`) | the schedules' tag lists, `ledger/lib_markets.mjs` | a removed or renamed tag keeps the game quiet and drops that country from the metrics; check the tag lists, not only preflight |

Notes to the table:
- **Autosave values** are the exe's `SETTING_AUTOSAVE` cluster: `never`, `monthly`, `quarteryear`, `halfyear`, `five_year`, `yearly` (`halfyear` has
  no underscore, `five_year` has one). The `save_interval` string in the exe is a different enum. The harness default is `five_year`
  (`-AutosaveInterval`). `-loadsave=<path>` does not work (rejected in 1.13.9).
- **Wage functions:** `State.GetAverageAnnualWage`, `State.GetNumSubsistenceWorkingAdults`, `State.GetNumUnemployedWorkingAdults`, and on Pop
  `GetIncome`, `GetWorkforceIncome`, `GetDependentIncome`, `GetExpenses`, `GetNumWorkforce`, `GetDependentsSize`, `GetTotalSize`.
  `Country.GetAverageAnnualWage` does not exist (it voids the line); if a patch adds it, the state sweep can become one line per country.
- **The tick schedule** the fleet-loop disqualification rests on: `Processing Tick: Y.M.D[.H]` lines at hours 0, 6, 12, 18; autosaves and monthly or
  scripted pulses on hour 0; per-country work staggered by country id mod 4 (≡1 → hour 6: GBR, PRU/GER, USA, NET, BEL, JAP, SPA; ≡0 → hour 12: FRA,
  AUS, CHI; ≡2 → hour 0 alone; ≡3 → hour 18, presumed); the 25-second line calibrated in wall seconds on the user's machine. A changed line format
  makes `parseTicks` return nothing (runs read `no tick log` and stay in); a save or pulse moved onto 6, 12 or 18, or a re-staggered country list,
  makes the test fire on ordinary runs or never; another machine moves the borderline verdicts (±10% speed flips 3 of 21). After a patch or a hardware
  change, re-run F218 §7's per-tick check and the calibration over the new vanilla batch and one mod arm.
- **L8** hashes our own emitted telemetry (`tools/telemetry_fingerprint.json`), not vanilla: an L8 failure after a patch means our code changed.

#### 2.3.3 The save layout the readers use

- **`tools/testbed/save_state_summary.mjs`** (v19) takes its reference tables from the game folder it is given: the goods (their order and base
  `cost`), the pop types (sorted file names; it throws if the save's count differs), the interest groups (alphabetical file order; it throws unless
  there are 8) and the law groups (it throws if no law carries `lawgroup_trade_policy`). ⚠ A save keys goods by POSITION — `trade.goods.<n>`,
  `world_market.price_trend.channels.<n>` and the tariff blocks (F159 §1; 0 = ammunition … 52 = fine_art in 1.13.11). A patch that inserts, removes or
  reorders a good shifts every later index, so summarise a pre-patch save against a pre-patch game folder.
- **Silent if re-nested** (an empty section prints a `WARN` on stderr):
  - laws, from the top-level `laws.database` (`law=`, `country=`, `active=yes`): check that a fresh summary still gives most countries a
    `trade_policy`. The tariff level vocabulary and meaning come from `TARIFF_LEVEL_EFFECT_*` / `SUBVENTION_LEVEL_EFFECT_*` (`00_defines.txt`) times
    each law's `state_tariff_import_add` (`01_trade_policy.txt`); F161 §6's "low tariffs = 12.5% of base price" is their product.
  - military formations, from `military_formation_manager.database` (`country=`, `type=`, `is_recalled_for_repairs=yes`, a typed `target_location`,
    `travel_progress.path.moves` with `to_node=` at depth 7 and the path's `distance=` / `cost=` at depth 5) and `ship_manager` (`fleet=`,
    `hit_points=`); the same layout `ledger/fleet_loops.mjs` reads. Check on a kept late-game save that `world.formations.moving` is non-zero and
    `hist_moves` looks like 1.13.11's (about a dozen moving formations of ~800, most under 50 moves).
- **Not in a 1.13.11 save:** trade advantage and local import or export prices. If a patch starts saving them, the importer premium can be read
  directly instead of through producer prices.
- **rakaly** melts the saves (TESTBED_METRICS §7 records the release); a changed save format needs a rakaly that reads it.
- **`ledger/input_price_flags.mjs`** (§10.94) parses every vanilla building, group and method by brace depth. It throws if the coal, iron, lead and
  sulfur mines, the steel mill, the explosives factory or the tooling workshop stop being the one-good producers of their goods. A new
  production-methods file of a non-industry kind must join its `NOT_INDUSTRY` list, or its inputs count as industrially consumed.

#### 2.3.4 Crashes

1.13.10 shipped an engine crash: infinite recursion in diplomatic-play sway evaluation (F56). 1.13.11 fixed that recursion, but crashes continue (the
alternating batch's first twelve runs had five, all resumed). The kit to test a patch against the archived poisoned 1.13.10 saves stays:
`tools/testbed/ctd_probe/probe_ctd_repro.ps1 -Variant plain` per save (paths in F56); a fixed engine reads `CLEAN_EXIT` where 1.13.10 read
`CRASH_STACK_OVERFLOW` about 90 s in. No re-test on 1.13.11 is recorded. On a new version, compare the resumes per run with the last batch's.

### 2.4 Static snapshots committed to the repository

Nothing warns when one of these goes stale.

- **`tools/goods_prices.tsv`** — vanilla's base price (`cost` in `common/goods/00_goods.txt`) for each of the 53 goods: the one price table, read by
  `build.ps1` (the Recipe BE in building names), `make_ab_config`, `lint_tier_eras`, `lint_solvency`, `restate_basic_be`, `emit_secondaries`, the
  linters through `lint.sh`, and the ledger (`criteria.mjs`'s PI and PP are £ ÷ base). A good it lacks is priced £0. A new or renamed good also
  belongs in `GOOD_GROUPS` in `ui/builder.html` (an unlisted good lands in "Other"). Compare it with the installed game, in PowerShell from the
  repo root (the closing `'@` must start its line):
  ```
  @'
  const fs = require('fs');
  const G = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
  const van = {}; let cur = null;
  for (const line of fs.readFileSync(G + '/common/goods/00_goods.txt', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const c = line.replace(/#.*/, ''); let m;
    if ((m = /^([a-z_]+)\s*=\s*\{/.exec(c))) cur = m[1];
    else if (cur && (m = /^\s*cost\s*=\s*([\d.]+)/.exec(c))) van[cur] = +m[1];
  }
  const tsv = {};
  for (const line of fs.readFileSync('tools/goods_prices.tsv', 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (!line.startsWith('#') && c[1]) tsv[c[0].trim()] = +c[1];
  }
  let n = 0;
  for (const g of new Set([...Object.keys(van), ...Object.keys(tsv)]))
    if (van[g] !== tsv[g]) { n++; console.log(g, 'vanilla', van[g], 'tsv', tsv[g]); }
  console.log(n ? n + ' difference(s)' : 'goods_prices.tsv matches vanilla (' + Object.keys(van).length + ' goods)');
  '@ | node -
  ```
- **`config/mod_config.json` and `config/tech_tree_options.json`** — vanilla's recipes, staffing, eras and prerequisites as of generation (§2.2.2).
  Refresh: routine step 5.
- **`config/measured_1836_pop_identity.json`** — per country and profession the most numerous culture-religion group, and per state its peasants,
  people and infrastructure, from a melted vanilla 1836.2.1 save (session `20261001_114627`, 1.13.11). Read by `emit_craft_start` in every canon
  build. Refresh: `node tools\testbed\melted_pop_identity.mjs <melt> --json config\measured_1836_pop_identity.json`.
- **`config/measured_1836_professions.json`** — population by profession per country, from the same melt; the balance editor's population. Refresh:
  `node tools\testbed\melted_pops_by_profession.mjs <melt> --json config\measured_1836_professions.json`. It encodes the pop-type list and the
  profession-to-stratum map, `$PROF_STRATUM` in `extract_presets.ps1` and `PROF_STRATUM` in `ui/builder.html` (change both); a new pop type sits at
  zero everywhere with nothing failing.
- **`config/measured_1836.json`** — what the history files cannot give, per market at 1836.2.1 (trade, orders, SoL per stratum, military and
  urban-centre levels, wages). Read by `extract_presets.ps1`. Refresh: `tools/extract_measured.ps1` from a session built with the `boot_dump`,
  `scenario` and `building_inventory` metrics.
- **`config/measured_base_wages.json`** — vanilla's wage path per tag and year (the n=16 baseline `20260821_131149`, 1.13.11). Read by
  `lib_wage_model.mjs`. Refresh: `node tools\measure_wage_share.mjs --write-wages --van <new vanilla session>`.
- **`VANILLA_REF` and `VANILLA_WALL_REF`** in `tools/testbed/ledger/lib_runs.mjs` — the vanilla sessions every reading compares against, all 1.13.11.
  Refresh: a vanilla batch on the new version.
- **`config/dam_projects.json`** — state keys and anchor provinces of the 144 projects; `emit_dams` throws on a missing one (§2.2.3).
- **The construction-cost anchors** — four mirrors of `building_values.txt` (§2.2.2).
- **The define tables** — `DEAD_DEFINES` and `ENGINE_ONLY_DEFINES` in `emit_techs.mjs`, `BOUNDS` in `preflight.ps1`'s `Test-LmL33` (§2.2.1).
- **`ERA_COST`** 7,500 / 10,000 / 12,500 / 15,000 / 17,500 in `make_tier4_techs.mjs` and `tech_tree_spec.mjs` — written into the tree twin for the tree
  viewer. The research emitter reads era costs live.
- **`BCM.poundPerPoint = 720`** in `ui/builder.html` — £ per construction point of iron-frame construction (`pm_iron_frame_buildings` in
  `13_construction.txt`: wood 40 + fabric 20 + iron 50 + tools 10 = £3,600 a week ÷ 5 points). Only the sheet's "model" build-cost hint uses it; the
  stored costs come from the book.
- **`LOCAL_GOODS` and `LOCAL_MULT_DEFAULT`** in `ui/econ.js` (mirrored in `ui/builder.html`) — the goods with `local = yes` (services, transportation,
  electricity) and the share of market supply a state sees of them, 0.40, from `LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR` 0.25 (F43).
  `node tools\econ_selftest.mjs`'s F43 cases pin both. The rest of the pop-need substitution rule (F40) rests on `TABOO_DEMAND_MULT`,
  `DEFAULT_OBSESSION_DEMAND_MIN` / `_MULT`, `DEFAULT_PRESTIGE_GOODS_DEMAND_INCREASE` (overridden per need in `common/pop_needs`), the
  `MAX_DEMAND_ADJUSTMENT_*` trio (it does not bind at annual sampling in 1.13; tightened, stored weights would trail their targets and save-based
  readings would need a lag term), and `common/prestige_goods`. The measurement tools read cultures' obsessions and religions' taboos from the save,
  not the files; keep it that way.
- **The error-noise catalogue** (TESTBED_OPERATIONS §4) — vanilla's own error classes on 1.13.11.
- **The fleet-loop calibration** (F218 §7) — on the 1.13.11 vanilla n=16.
- **`supported_game_version`** in `mod/.metadata/metadata.json`.

---

## 3. Version log

One entry per game version the project has run on: the dates it was in use, the session boundary, and what the update pass found. Sessions on
different versions are not comparable without saying so.

- **1.13.9** — until 2026-08-12 15:17; the last session on it is `20260812_093402`.
- **1.13.10** — 2026-08-12 15:21 to 2026-08-19; the first session on it is `20260812_152101`. It arrived between two sessions with nothing announced
  (one `error.log` line). A substantial hotfix with a new exe
  ([changelog](https://forum.paradoxplaza.com/forum/threads/hotfix-1-13-10-is-now-live-not-for-problem-reports.1938098/)); it shipped the sway crash
  (F56). The vanilla data the build derives from did not move.
- **1.13.11** — from 2026-08-19, the current version. It fixes the sway recursion. The update pass found no vanilla data change (all 53 base prices
  unchanged, no unmapped method, the same inherited 1836 gaps). Its behaviour was not compared directly: "more war from the sway fix" did not show at
  n=18, and revolts ran ×1.30 (F79). Every `VANILLA_REF` session and the 2026-10-21 canon are 1.13.11; the older pins `20260813_083557` (vanilla
  n=4) and `20260818_221216_canon-n7` are 1.13.10.
- **1.15** — expected 2026-11-05, with 1.14's AI rework. Mod 1.1 follows this file's routine; treaty ports are re-measured (§2.2.10). What the
  preliminary patch notes touch: §4.

---

## 4. Game 1.15: what the patch notes touch

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
