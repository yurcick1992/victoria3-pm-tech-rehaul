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
  OPEN (in hand).
- **U03** · T · the entity diff · `tools/game_diff.mjs`, written 2026-11-07 and tested on 1.13.11 (no change found) and on synthetic changes · run
  it 1.13.11 → 1.15 when 1.15 is installed; every item it prints gets a line here · OPEN (1.15 session).
- **U04** · T · the final patch notes · the preliminary notes were read on 2026-10-30 (appendix); read the forum changelog itself for engine
  behaviour the diff cannot show · OPEN (1.15 session).

## Phase 2 — breakage: a 1.0 install on 1.15, and the rebuild

- **U10** · R · `ship_interest_gain_mult` removed · the owned 1.0 copy of `power_bloc_principles/00_power_bloc_principles.txt`
  (`principle_navy_1`–`_3`) · follows 1.15 on rebuild; confirm on the diff and the count lines · OPEN (mechanical).
- **U11** · N · AI strategies gain `will_incorporate_state` and regional objectives · the owned copies of `ai_strategies/00_default_strategy.txt`
  and `01_admin_strategies.txt` · follow on rebuild; check the administrative strategies' count and `type` lines (seven in 1.13.11, ON_GAME_UPDATE
  §2.1) · OPEN (mechanical).
- **U12** · C · new base values in `static_modifiers/00_code_static_modifiers.txt` · the owned copy (the innovation levers) · follows on rebuild;
  each lever key must still sit once in its block · OPEN (mechanical).
- **U13** · C · the map and 1836 population: harbour connections, a lake in China, North Angola's population · the 15 owned `state_regions` files,
  the owned 1836 history, `config/measured_1836_pop_identity.json` · the diff decides; a moved 1836 population needs a new vanilla 1836.2.1 melt ·
  OPEN.
- **U14** · R · script the notes rename or remove (`pop_type_percent_country`, the war-exhaustion commands, `enemy_contested_wargoals`,
  `strait_trade_importance_by`, `has_employee_slots_filled`, `primary_cultures_percent_*`) · none in `tools/` or the built `mod/` (checked
  2026-10-30) · DONE; the vanilla-names check (U19) confirms it on 1.15.
- **U15** · R · `country_war_exhaustion_casualties_mult` in four vanilla copies · refreshed by the rebuild · OPEN (mechanical).
- **U16** · B · no substitution of script arguments inside quoted strings · no emitted file puts a `$arg$` inside quotes · DONE.
- **U17** · C · an event's or journal entry's `dlc` field may list several DLCs · L39 compares each copy with vanilla's file from the same game
  folder · OPEN (read its PASSED line).
- **U18** · T · the innovation override writes 25 over whatever vanilla holds and does not check that vanilla still holds 50 (the four flat bonuses
  do check) · `tools/emit_research_levers.mjs` should assert vanilla's 50 / 50 / 150 · DEFERRED to the 1.15 session (an emitter: frozen while the
  batch runs, CLAUDE.md §5.1 rule 7).
- **U19** · T · the vanilla names in our own generated script · `tools/lint_vanilla_names.mjs`, written 2026-11-07 and calibrated on the 1.13.11
  build · run it on the 1.15 rebuild; wire it into `build.ps1` or `preflight.ps1` · the wiring DEFERRED to the 1.15 session (`build.ps1` is frozen
  while the batch runs).
- **U20** · N · a 1.0 install on 1.15: the owned 1.13 method files lack `pm_bronze_cannons` / `pm_bronze_smoothbores` that 1.15's
  `pmg_foundries` names (expect `error.log` lines), and the power plants, telephones, motor and munition methods, sewing, stills, assembly lines
  and arcades consume no copper (appendix) · a player on 1.15 before mod 1.1 sees it · OPEN: whether KNOWN_ISSUES gets a line until 1.1 (the
  user's call; nothing there names 1.15 today).

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
- **U35** · T · the rest of the premises table (ON_GAME_UPDATE §5.1), feature by feature, against the diff · OPEN (1.15 session).

## Phase 4 — adoption: what 1.15 adds, against what we author

- **U40** · N · **copper**, a new good (base price 40) · ruled frame (§10.108): *"everywhere where vanilla does, and in similar cases that simply
  don't exist in vanilla. By default, proportionally, everything else needs to be argued."* · the lines U41–U48.
- **U41** · C · copper in vanilla's main methods (value-neutral swaps at base prices) · the rungs' input mixes: only the regeneration of
  ON_GAME_UPDATE §1 step 5 brings copper into them; a rebuild of the 1.0 book ships every rung on its 1.13 mix and nothing throws · OPEN (phase 2,
  step 5).
- **U42** · N · copper on the dams · per 50 electricity 1 tools + 0.5 engines + 0.75 copper (6 + 3 + 4.5 a 300 level), the book field
  `dams.inputs_per_50`, copper at 40 in `lib_dams.mjs` `BASE_PRICE` · RULED §10.108, not built.
- **U43** · N · copper on the electric streetlights · none: 1.0's recipe and staffing exactly; the field diff must show `pm_goods` /
  `pm_employment` unchanged · RULED §10.108.1 (all streetlight work DEFERRED to mod 1.2 or later).
- **U44** · N · bronze cannons and bronze smoothbores (the foundry now has six main methods; `make_tier4_config` throws above four) · a switchable
  second main method on the t0 and t1 rungs at the rung's own input value (t0 12.8 copper + 19.2 hardwood, t1 24 + 24) · RULED §10.108.2, not
  built (the generator's pairing, L31, the combination lint, the research counts, the 1836 converter).
- **U45** · N · copper's trade class · `make_trade_config` throws on a tradeable good in no class; F159 §5's historical wedge (32.7% falling to ~0)
  puts it with B or C · OPEN: needs a ruling.
- **U46** · N · copper in `tools/goods_prices.tsv` (40) and in `GOOD_GROUPS` of `ui/builder.html` · OPEN (mechanical, phase 2 step 6).
- **U47** · N · where copper is mined: `building_copper_mine`, a capped resource unlocked by shaft mining with the lead mine's methods; 609 levels
  in 84 states by a third-party copy of the files; France and Belgium none · OPEN: confirm on the installed files.
- **U48** · T · the rest of the what-we-author walk for copper (ON_GAME_UPDATE §5.3): the minted top rungs, the crafts, the research entries
  (does an entry that counts mines need the copper mine?), the PI basket (copper is now a building input), the red-flag goods, the telemetry's
  good lists · OPEN (1.15 session).
- **U50** · N · new script hooks: `global_average_gdp_per_capita`, `has_building_levels_in_state_region`, `gdp_owned_by`; progress bars taking a
  script value or a math block for `min_value` / `max_value` · candidates that could simplify our script (the urban-centre entries); not needed
  for 1.1 · OPEN (note only).
- **U51** · N · the console command `print_world_gdp` · a direct check of the displayed world GDP the register reads (F45, F257), in one debug
  game · OPEN.
- **U52** · B · profit predictions and goods availability no longer show no supply until the first day passes · the telemetry's `EARLY|boot`
  lines, read from `on_game_started_after_lobby` · OPEN: compare with a 1.13 session's.

## Phase 6 — re-measure

- **U60** · T · a vanilla batch on 1.15 · `VANILLA_REF` / `VANILLA_WALL_REF`, `config/measured_base_wages.json` (the hiring and wage fixes move it
  more than an ordinary patch does: refresh it before any profit is quoted on 1.15), the error-noise catalogue, the fleet-loop calibration ·
  OPEN (needs the go-ahead).
- **U61** · B · the fleet path loop (F218, the one listed bug of wall-clock cluster 3) is plausibly fixed by *"fleet repair progress"* and the
  return of beaten fleets to their mission · `fleet_loop_runs.mjs` over the 1.15 vanilla batch: no signature empties cluster 3's list; one opens
  a fix again (the user, 2026-10-15) · OPEN.
- **U62** · T · a canon batch on 1.15 against the 1.15 vanilla, read through the criteria register and U30–U33 · OPEN (needs the go-ahead).

## Phase 7 — release and record

- **U70** · T · `supported_game_version`, the release build, README's list of replaced files (`tools/list_replaced_files.mjs`), KNOWN_ISSUES, the
  changelog, the Workshop text, the version log (ON_GAME_UPDATE §3), the findings, new couplings into ON_GAME_UPDATE §2 · OPEN.

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
