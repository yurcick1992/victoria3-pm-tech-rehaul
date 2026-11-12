# The 1.15.1 update register — game 1.15.0 → 1.15.1, mod 1.1 → 1.1.1

One line per change the update raises: its id, its class, what changed, what of ours it touches, the decision and its status, and where it is
argued. The procedure is the `game-update` skill (`.claude/skills/game-update/SKILL.md`); the coupling inventory and the reference tables are
ON_GAME_UPDATE.md §2 and §5. Opened 2026-11-12. It closes at the 1.1.1 release with every line DONE, RULED-and-built or DROPPED.

**Classes:** **N** new · **R** removed or renamed · **C** changed value · **B** engine behaviour · **T** a task of the pass itself.
**Statuses:** **OPEN** (to find out or to decide) · **RULED §x** (decided, not built) · **DONE** · **DEFERRED** (with where to) · **DROPPED**.

**The user's rulings on the pass (2026-11-12):** the batch `20261109_005943_g115-alt-canon24-vanilla24` is intact for mod 1.1 on 1.15.0 and
vanilla 1.15.0 (runs 1–20, all counted and reported); runs of mod 1.1 on 1.15.1 are discarded (run 21 from its 1908 resume, run 23); vanilla
1.15.1's run 22 goes to the next batch's results, glued to them, except its wall clock, which is ignored. Mod 1.1.1 is prepared for 1.15.1, its
open questions discussed with the user, then a batch of 1.1.1 against vanilla 1.15.1 runs to Sunday morning (2026-11-15) — re-ruled after Q8 as
10 vs 10, vanilla first (Q3 below). Every intermediate game version seen is kept for thorough file diffs from now on.

**The patch notes** were given by the user in full (checksum `f843`); the lines below cite them by section (Improvements, AI, Balance, …).

## Phase 0–1 — the versions kept, the intake

- **V01** · T · keep 1.15.0 for the diff · NOT KEPT: Steam applied 1.15.1 unannounced. What stands in: the committed 1.1.0 build (`mod/` at
  `8cbe4a0`), whose 148 owned vanilla files are 1.15.0 copies with our edits; the 1.15.0 extracts `ui/vanilla.js` and `config/start_baseline.json`
  (copies in the update session's scratchpad, `g1150/`). Not recoverable locally: the ~100 changed files the mod does not own and the 1.15.0 exe.
  A full 1.15.0 can still be fetched with the Steam console (`steam://open/console`): `download_depot 529340 529341 7727600027425614094` (the
  main depot's 1.15.0 manifest, from Steam's `logs/content_log.txt` of 2026-11-08 05:02, build 26453692) · OPEN (the user: fetch or not).
- **V02** · T · keep 1.15.1 · DONE 2026-11-12 00:52: `C:\claude-code\vic3_game_1.15.1` (363 MB; `game\common`, `events`, `map_data`,
  `localization`, `gui`, `binaries\victoria3.exe` + `checksum.txt`, `launcher-settings.json`); exe sha256 `fb4ec0698afd3d3b…`, checksum
  `79da2ab6b2f3b5a78c820ca38470f843`, Steam build 26591675 (`binaries_hash.txt`). The standing rule: every version seen is kept so (memory
  `snapshot-every-game-version`).
- **V03** · T · the version boundary · Steam's content log: the update was found at 17:03:44 on 2026-11-11 and committed at 17:19:14–17:19:33
  (438 files updated, 1 deleted; "not played for 234835 seconds": the observer starts `victoria3.exe` directly, so Steam does not count the runs
  as play). In `20261109_005943`, runs 1–20 played on 1.15.0; run 21 (canon) froze at 1908.6.11 around 17:32 and was resumed at 17:47 on
  1.15.1 (its `debug.log` version line); run 22 (vanilla) played on 1.15.1; run 23 (canon, 1.15.1) was stopped at 1923.11.21 by
  `tools\testbed\STOP` on 2026-11-12 00:52 (the session-folder STOP is not read by the observer when the scheduler runs it: its `$SessionDir` is
  the run folder). · DONE (ON_GAME_UPDATE §3). Prevention for the next batch: Steam's per-game setting *Only update this game when I launch it*
  · OPEN (the user's setting).
- **V04** · T · the intake · without a 1.15.0 tree `game_diff.mjs` cannot run; the changed-file list is the files the commit rewrote
  (modification time 2026-11-11): 437 files — localization in 11 languages (~290), 75 under `common` and `events`, 16 `map_data/state_regions`,
  21 `gui`, the exes, sound and art. Of these the mod owns 31 (below); their diff is the 1.1.0 build against a 1.15.1 release build of the same
  chain (`mod_g1151rel`), header lines aside. The other changed `common` files were read on 1.15.1 for anything that names what we split
  (V16, V17). · DONE.

## Phase 2 — breakage: the mod builds and is correct

- **V05** · T · the extracts · `extract_start.ps1`: the 1836 inventory of split-industry factories is unchanged (only the timestamp moved, so the
  derived 1836 grant is unchanged). `extract_vanilla.ps1`: five methods changed (V06–V09) · DONE.
- **V06** · C · telephones (Balance: "a pass over Copper availability … less consumed by industries") · `pm_telephones` iron 10 → 20, copper
  30 → 15, tools 10 → 15: input value unchanged at base prices (all three £40) · our electrics t2 rung follows through the formula: iron
  19.7 → 39.4, copper 59 → 29.5, tools 19.7 → 29.5, input value 3,936 unchanged — the regenerated book's only change (V19) · the canonisation
  is OPEN (Q1).
- **V07** · C · the still lines · `pm_pot_stills` glass 3 → 4, copper 2 → 1; `pm_patent_stills` glass 6 → 7, copper 4 → 3 · our food
  secondaries are emitted from vanilla's live: 2.95 / 1.97 → 3.93 / 0.98 and 5.9 / 3.93 → 6.89 / 2.95 · DONE (no book field).
- **V08** · C · `pm_arc_welded_buildings` (construction) copper 10 → 5, tools 30 → 35 · construction is vanilla's in the mod · DONE (nothing to do).
- **V09** · C · `pm_anchorage` (ports) gains 0.5 services out (AI: "the anchorage PM for ports when it has no need of Merchant Marine") · ports are
  vanilla's · DONE.
- **V10** · C · copper deposits · `map_data/state_regions`: 48 `building_copper_mine` capacities raised, 8 new; the mod owns all 16 files (the
  dam resource slots) and regenerates them from 1.15.1 · DONE. ⚠ Until 1.1.1 is released, mod 1.1.0 on 1.15.1 reverts every owned file to its
  1.15.0 copy: these deposits, the industry methods, the technologies' AI weights, the AI strategies, the Russian history, journals and
  scripts (V11–V15).
- **V11** · C · technologies (AI: "more priority on advanced industrial goods such as radios, telephones and oil") · AI research weights on
  **seven** technologies (corrected 2026-11-12: the first reading cut the block diff short and listed five): `telephone` (base 1 → 3, + 4 for
  each of nco_training, mobile_armor, defense_in_depth, battleship_tech, carrier_tech), `radio` (+ 4 for each of the same five),
  `pumpjacks` (+ 2 for an unrecognised major and above, + 4 for each of battleship_tech, carrier_tech, destroyer, mobile_armor, submarine),
  `combustion_engine` (+ 4 for mobile_armor, + 4 for carrier_tech), `electrical_generation` (base 1 → 2, + 2 for an unrecognised major and
  above), `oil_turbine` (+ 2 for an unrecognised major and above), all in 10_production; `percussion_cap` (+ 2 for general_staff, + 2 for
  power_of_the_purse; 20_military). No era, prerequisite, cost or content changed (the tree twin's field diff, V19). They reached the 1.1.1
  build with the files: **a design question that was not put to the user** — the research entries already lift these technologies by
  industry (§10.95, §10.97), and the user: *"I'm reasonably sure we'd want to override those, as our JEs affect the natural situation by a
  lot, extra pushes to AI are hardly needed. Why haven't you discussed this with me …?"* ⚠ 1.15.0 changed the AI weights of 11
  technologies in the same way and they reached mod 1.1 unraised (logistics, triage, rifling, general_staff, modern_nursing, wargaming,
  mass_communication, egalitarianism, central_archives, nationalism, pan-nationalism; the diff of `u115/game_diff.txt`) · DONE (Q8,
  §10.111.3): six restored to 1.13.11 (combustion_engine, electrical_generation, oil_turbine, percussion_cap, radio, telephone); the five with
  an entry whose push serves vanilla's story content keep 1.15.1's (central_archives, egalitarianism, general_staff, nationalism, rifling);
  the seven without an entry keep 1.15.1's (logistics, mass_communication, modern_nursing, pan-nationalism, pumpjacks, triage, wargaming).
- **V12** · C · AI strategies · default: `building_shipyard = should_have` in `subsidies`; goods stances `radios`, `telephones` (with a government
  administration and the technology), `oil` at `wants_high_supply`; the Persia weights' `OR` fixed. Admin: `building_shipyard = should_have` in
  three strategies; industrial expansion's coal, iron, lead and sulfur mine subsidies `nice_to_have` → `wants_to_have` · our dam lines follow
  vanilla's; the removed tooling and explosives subsidies (§10.75, §10.92) still match · DONE.
- **V12b** · C · `ai_strategy_resource_expansion` (not owned before 1.15.1's diff was complete): the tooling workshop's and explosives
  factory's subsidies `nice_to_have` → `wants_to_have` · the mod removes both (§10.75, §10.92) whatever their value: the built file has only
  the dam lines; vanilla's reference arm now subsidises them more · DONE (holds).
- **V12c** · C · the AI's new goods stances (V12: radios, telephones, oil at `wants_high_supply`) feed method scoring
  (`PRODUCTION_METHOD_FAVORED_GOODS_FACTOR`) and subsidies (`SUBSIDIZE_FAVORED_GOODS_MULT`) as well as construction · a push toward
  particular goods, which §2.4 leaves to recipes · DONE (Q9, §10.111.4): all three kept as vanilla's.
- **V12d** · C · `bg_private_infrastructure` `subsidized = yes → no` (the only building group that started the game subsidized: railways,
  ports, power plants under it; both arms) · our `bg_pmr_hydro_dams` keeps `subsidized = yes`, copied from that parent when it was written;
  the flag acts only at the campaign start, when no dam exists, so it does nothing either way · DONE (Q10, §10.111.5): `subsidized = no`
  (`emit_dams.mjs`, every build from 2026-11-12); the 1.15.1 batch reads the subsidy status of all infrastructure (railways, ports, power
  plants, dams), both arms, by year.
- **V13** · B · the subsidy rule (AI: "will no longer subsidize profitable buildings or buildings that it does not consider as genuinely
  necessary"; the strategy file's new comment: an entry is "the maximum spending priority … Profitable buildings will not be subsidized") ·
  touches the dams: the four dam types are `must_have` in every administrative strategy, which CLAUDE.md §1.2 states as "the AI always
  subsidises them"; it is now a ceiling, and a profitable dam gets nothing (the dams are designed profitable at worst-case prices, 2,288 £/week)
  · OPEN (Q2).
- **V14** · C · the 1836 history · Chelyabinsk's iron mine, financial district and pops move from `14_siberia` to `15_russia` (owned: the start
  conversion and the craft seeding); Waterboersland and Philippolis get new starting technologies (Balance; `history/countries`, not owned) · no
  tiered industry involved; the inventory is unchanged (V05) · DONE.
- **V15** · C · owned scripts and journals · `recently_conquered_state` and `recently_liberated_state` gain
  `state_disable_disband_prestige_penalty_bool`; `revoke_favorite_effect` culls the character; `can_have_favorites` excludes personal unions;
  `00_communism`, `03_russia`, `08_tsarpoints`, the Tsar-points buttons and the progress bars (Improvements, Bugfixes) · carried in the owned
  copies; the protected-vanilla lint (Tsar's educational reform) passes · DONE.
- **V16** · C · `interest_groups/00_armed_forces.txt` (Balance: capitalists drawn to the Armed Forces when their financial district or company
  HQ owns military industry) · it counts `bg_military_industry`, which the arms, artillery and munition rungs keep · DONE (verified).
- **V17** · C · defines (`00_defines.txt`, `00_ai.txt` changed) · the seven NAI keys the canon overrides are still at vanilla 0.75 / 0.75 / 1.05 /
  0.05 / 40 / 60 and divisor 0.001; `WORLD_MARKET_MONOPOLY_THRESHOLD` is still registered in the exe · DONE.
- **V18** · R · `Market.GetCountryTradeCapacity(Country)` removed (the exe no longer registers it; 1.15.1's market panel reads
  `Market.GetTradeCapacity`, `State.GetTradeCapacity` and the world-market hubs' capacity; Interface: "a World Market Hub filter …") · the
  telemetry's TRADE line and the treasury probe's `capacity_mkt`: two `error.log` lines per country per dump (563 + 563 in run 23's first eight
  minutes), the field empty · fixed 2026-11-12 in `tools/telemetry_lib.ps1`: the field is the country's MARKET's capacity,
  `Market.GetTradeCapacity` (TESTBED_METRICS §3.6); only `analyse_three_arm.mjs` read it · DONE; verify at the next batch's first smoke check.
- **V19** · T · the regeneration (routine step 5) · `node tools/replay_canon_chain.mjs --prefix g1151` + the four recorded 1.15 steps (bz, dcu,
  ra, il) → `config/mod_config.g1151-canon-bz-dcu-ra-il.json` + twin. Field diff against the canon: **3 fields, the electrics t2 rung's iron,
  copper and tools (V06)**; the twin: its timestamp and Socialism's name read live (the 1.1.0 playtest fix, not the patch). The replay's hand
  steps now come from `--hand-from` (default the 1.0 canon, `jex-dam4s-rs-x25-m10ac-dpriv-wm99`, sha256 `9a05d36d`): read from
  `config/mod_config.json`, which is now the 1.15 canon, they carried the 1.15 research adds already, and `make_value_overrides_config` then
  refused them twice · DONE (the book); canonisation OPEN (Q1).
- **V20** · T · the build (routine step 8) · `build.ps1 -SaveTo g1151rel -Release -NoDeploy -Config <the 1.15.1 book>` on 1.15.1: MOD CHECKS
  PASSED, preflight passed, 148 vanilla files replaced (27 DLC-gated, every gate kept), vanilla names resolve, the protected-vanilla check, LINT,
  negative goods, solvency, tech content, start conversion, era rule, PM combinations · DONE.
- **V21** · T · version and release · `mod/.metadata/metadata.json` 1.1.0 → 1.1.1 (`supported_game_version` "1.15.*" already covers 1.15.1);
  the release build; KNOWN_ISSUES, CHANGELOG, the Workshop text · OPEN (Q5: when).

## Phase 3 — reconciliation: our features against the new vanilla

- **V22** · B · the AI's method choice (AI: new jobs' wages counted as a cost and only real lay-offs as savings; goods output and input
  multipliers counted; methods that move jobs to more skilled workers no longer avoided, "especially … electrical PMs"; labour-saving methods
  scored higher where workforce is short) · premise moved for **the vanilla reference**: vanilla modernises by switching methods, and its AI
  now switches better, so the register's ratios to vanilla move; in the mod it reaches the six merged rungs (a method switch inside a
  building), the secondaries and automation, and electricity demand (electrical methods) · nothing to rule; measured by the 1.15.1 batch
  (T3, misplaced capital, PI/PP, the dams) · OPEN → measure.
- **V22b** · N · the method-scoring defines behind V22 (`00_ai.txt`, new): `PRODUCTION_METHOD_EMPLOYMENT_CHANGE_NO_AVAILABLE_LABOR_MULT`
  3.0 (labour-saving scored ×3 more where no working adult is unemployed or a peasant), `…_ABUNDANT_LABOR_FRACTION` 0.1, and
  `PRODUCTION_METHOD_SCORING_OVERRIDE_FACTOR` (with the methods' new `scoring_override` field, used only by two port methods; replaces the
  removed `PRODUCTION_METHOD_LOW_POP_FACTOR`); `SUBSIDIZE_REMOVE_PROFIT_MARGIN_BUFFER` 0.05 (V13). New AI levers in the sense of §2.5; none
  is a routine lever, none is proposed · information.
- **V22c** · C · `ig_armed_forces` counts `workplace.num_building_assets_of_group(bg_military_industry)` (×2, capped at 150) · the tier
  split can give one financial district several military rungs in a state where vanilla has one building, so the count runs higher; the
  cap bounds it · DROPPED (Q11, §10.111.6): the user, *"ignore, leave new vanilla"*; not catalogued.
- **V23** · B · investment (Bugfixes: paused construction sectors no longer counted in private investment considerations) · the investment-pool
  defines (§10.75) and the hoard (H) · measure.
- **V24** · B · the AI's mobilisation (capped by the enemy's potential military power; budgeted by the war's severity) · both arms; nothing of ours
  · measure (wars, the shortlist's territory).
- **V25** · B · fleets (Bugfixes: a fleet merging with a fleet it cannot reach no longer stays stuck) · not the listed fleet path loop (a fleet
  recalled for repairs, F218), but a neighbour · keep the listed bug; watch the wall clock's cluster 3.
- **V26** · B · prestige can no longer fall below 0 · prestige and rank scale with displayed GDP (§10.90) · nothing to do.

## Phase 4 — adoption

1.15.1 adds no good, building, method, technology or mechanic for the mod to adopt. The modding flag `can_secede_during_revolution`
(movements) touches nothing of ours. The copper pass (V06–V10) is value changes, carried by the regeneration (§10.110.4: copper scarcity
follows Paradox).

## Phase 5 — the questions (2026-11-12)

- **Q1** · canonise `g1151-canon-bz-dcu-ra-il` (V19: the telephone rung only) as mod 1.1.1's canon · OPEN.
- **Q2** · the dams under 1.15.1's subsidy rule (V13): keep `must_have` (a ceiling now) and measure, or rule otherwise · OPEN.
- **Q3** · the batch: 1.1.1 against vanilla 1.15.1, alternating, run 22 glued to the vanilla arm without its wall clock; the end time; the first
  run's smoke check as the post-patch smoke test (routine step 9) · OPEN (go-ahead).
- **Q4** · Steam's per-game update setting before the launch (V03) · OPEN (the user's setting).
- **Q5** · release 1.1.1 to the Workshop before the batch or after it (V10's ⚠, V21) · OPEN.
- **Q6** · fetch 1.15.0 through the Steam console for a full diff (V01) · OPEN.
- **Q7** · a landmine for telemetry data functions the installed exe no longer registers (V18 would have tripped it before a run) · the user,
  2026-11-12: *"why not now?"* · DONE 2026-11-12: **L51** (`tools/lint_data_functions.mjs`, `Test-LmL51`; TESTBED_LANDMINES), proven both ways.
- **Q1** ruled 2026-11-12 (*"yes, and let's start measuring it"*): the canon since 2026-11-12, `c1274f151e69c630` (§10.111.1). **Q2** ruled
  (*"agreed"*): keep `must_have`, measure (§10.111.2). **Q4**: remind the user on Sunday. **Q5**: the upload needs the user at the machine
  (no desktop control in this session; earlier releases were the user's own upload), so 1.1.1 is released after the batch.

- **The full intake** (2026-11-12, after the user's challenge): `game_diff.mjs` from the kept 1.13.11 to the kept 1.15.1, and that output
  diffed against the 1.15 pass's 1.13.11 → 1.15.0 output (`u115/game_diff.txt`): what differs is exactly what 1.15.1 changed, files the mod
  does not own included (1,142 lines, kept as `g1150/diff_of_diffs.txt` in the update session's scratchpad). It found V11's two missing
  technologies, V12b–V12d and V22b–V22c; no define changed value (only new keys), no building, good, era or prerequisite changed, the
  canals' strait definitions gained a grievance multiplier, and the rest is Russia, Favorites, Poland, regime change and art.
- **Q8** · the AI research weights: 1.15.1's seven (V11) and 1.15.0's eleven — keep vanilla's, restore the earlier version's, or set our own ·
  RULED 2026-11-12 (*"restore the weights to 1.13.11 on all techs that have our tech JEs. Leave them 1.15.1 where we don't have a JE."*), then
  refined the same day for five content-tied pushes (*"Let them keep their increased weights. Mostly because Russia is likely to have too low
  literacy to be affected by relevant JEs. If it was affected by them, they'd supercede. We will retune AI weighs for techs later anyway
  (perhaps 1.3)."*) · DONE: six restored (§10.111.3), the new canon `697d4869`.
- **Q9** · the AI's new goods stances for radios, telephones and oil (V12c) · RULED (*"keep all three"*) · DONE (§10.111.4).
- **Q10** · the dams' inert `subsidized = yes` (V12d) · RULED (*"align with vanilla, and watch subsidy status of all infrastructure in the
  1.15.1 runs, I'm curious how this will work"*) · DONE (§10.111.5); the reading goes into the batch report.
- **Q11** · the Armed Forces' asset count over the tier split (V22c) · RULED (*"ignore, leave new vanilla"*) · DROPPED (§10.111.6).
- **Q3**, re-ruled after Q8 (2026-11-12): the first launch, `20261112_013516_g1151-alt-canon-vanilla` (mod first, to Sunday 06:00), was
  stopped at its run 1 (1845, discarded) because Q8 changed the build. The user: *"launch the 10vs10, starting vanilla"* — 20 runs, odd runs
  vanilla 1.15.1, even runs the canon; run 22 of `20261109_005943` glued to the vanilla arm without its wall clock (V27).

## Phase 6 — re-measure

- **V27** · T · the vanilla 1.15.1 reference · the next batch's vanilla arm, with run 22 of `20261109_005943` glued to it (the user, 2026-11-12;
  its wall clock excluded) · OPEN (Q3).
