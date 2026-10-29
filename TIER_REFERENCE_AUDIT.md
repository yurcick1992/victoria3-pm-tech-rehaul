# TIER REFERENCE AUDIT — vanilla script that names a tiered industry

> **Status and implementation.** This file catalogues every vanilla script position that names a tiered industry: a rung-0 building key, a
> vanilla main method, a renamed vanilla secondary method, or a `building_<key>_throughput_add`. For each it gives what the line does in the mod
> if left untransformed, the rung set the user ruled for it, and how the build rewrites it. The audit ran on game 1.13.11 (2026-10-21), the user
> ruled every case the same day (PART 2), and the fix was built that night as **`tools/emit_vanilla_refs.mjs`**, a build step. It regenerates
> **63 vanilla files** from the live game text on every build (213 token rewrites, 23 snippets, 52 throughput lines expanded into the ruled rung
> keys) and adds 58 helper triggers, 4 effects, 1 script value, 6 throughput modifier types with loc in 11 languages, and one additive on_action
> (the Montenegro check, DLC-gated). The file list is §5.1 C; the per-file counts are the emitter's `SPEC`. Seven vanilla files keep their
> tiered references on purpose (seven of the eight entries of the emitter's `ACCEPTED` list, §5.1 D). The admin-strategy subsidies are removed
> by the config, not by this emitter (PART 2 (E)).
>
> **In game:** the smoke run of the final canon (`20261021_220806_polish-final-smoke`, 1836→1841, canon `728f2c7f84e6f467`) logged no
> invalid-production-method line (the canon logged 46 before the fix) and no error naming a file the build writes (SESSION_VERDICTS). Whether
> the restored chains fire over a century has not been measured.
>
> **Guards:** every count is asserted and drift throws; the scan throws on a tiered reference left in any file the emitter neither transforms
> nor accepts (landmine L40, build half); `tools/check_dlc_gates.mjs` fails a replaced file that lost a DLC gate (L39). After a patch, or when a
> new reference turns up: §5.2. New cases are catalogued here first, never fixed inline (CLAUDE.md §5.4).

Line numbers in this file are game 1.13.11's. Rungs are named by TIER (t0–t3, CLAUDE.md §2.3); the emitter's set names keep the old letter
(`e2plus` = tier 2 and up). The other half of the family is `MISSING_BUILDING_CONDITIONS.md`: conditional fields inside the vanilla buildings the
build regenerates (today one, the art academy's Metternich `ai_value`). `MISSING_PM_REFERENCES.md` is this file's retired predecessor.

## 0. Summary

**Positions found (lines of vanilla script, game 1.13.11):**

| Pattern | Lines | Files | Notes |
|---|---|---|---|
| (a) a tiered industry's vanilla building key (rung 0 in the mod) | **410** | 49 | 85 are Russian grammatical-case loc (`99_ru_custom_loc.txt`), 1 a map-graphics trigger, 1 an achievement → **323 gameplay lines** (appendix A) |
| (b) a tiered industry's vanilla MAIN production method | **30** | 9 | all inside building or state checks on rung 0 (appendix A) |
| (b′) a vanilla SECONDARY method of a tiered building, renamed by the per-rung copies | **49** | 7 | appendix B |
| (e) `building_<tiered key>_throughput_add` in modifiers, power-bloc principles, an amendment | **60** | 20 | 49 modifier blocks (table D), two without a vanilla user; the bonus reaches rung 0 only (appendix D) |
| (c) the tiered industries' building groups (`bg_light_industry`, `bg_heavy_industry`, `bg_military_industry`, `bg_arts`, `bg_manufacturing`) | **79** | 20 | still match every rung and the crafts (§2); **9 lines change meaning** through the crafts' ×10 levels (A-g, appendix C) |
| indirect: callers of the affected scripted triggers and effects | 35 | 7 | not references themselves; listed so the blast radius is visible (appendix E) |
| graphics: city meshes per building key | 170 | 11 (6 base + 4 DLC + 1 route file) | cosmetic (appendix F) |

**Distinct script blocks** (event, journal entry, decision, trigger, effect, button, law, strategy) with an (a)/(b)/(b′) reference, Russian loc
and graphics excluded: **86**.

| Untransformed verdict | Blocks | What it means | In the build |
|---|---|---|---|
| **DEAD** — can never fire, complete or be true | **22** | a vanilla main or secondary method checked on rung 0, which never runs it (5 of them — the two industrialisation triggers, the paired effect, pm_events.3, japan_events.32 — fail validation at load with `Invalid Production Method`; the rest are silently false); plus **4 event groups dead through those triggers** (pm_events.1, .2, industrial_accident_events.5, prohibition_events.\*) | each test points at the rung or method its row rules |
| **NARROW** — fires, but only rung 0 counts | **49** (10 where rung 0 is a 500-worker CRAFT with ×10 levels, so a vanilla level threshold is ~10× easier) | the main case (`has_building`, `is_building_type`) | widened to the ruled rung set |
| **SHIFT** — fires but means something else | **5** script blocks + **3** group-level blocks | an accident on crafts, an arms event for the wrong countries, subsidies and promises pointing the AI at the obsolete rung, craft levels inflating progress counters | re-pointed |
| OK — meaning preserved | 5 | a single-rung industry, or the creation of a t0 rung that is thematic | left, or guarded against every rung |
| UNUSED (no vanilla caller) / VANILLA-DEAD (already broken in vanilla) | 2 / 1 | | rewritten with their files; the vanilla-dead one stays impossible |
| COSMETIC | 2 + loc + gfx | achievement, map-train trigger, Russian loc, city meshes | left (ACCEPTED, or outside the scan) |
| **Throughput modifiers** (e) | 49 blocks in 20 files, all NARROW | e.g. the power-bloc military-industry principles boost muskets, cannons and the t2 car plant only | each line duplicated per ruled rung key (table D) |

The 22 company files are a separate emitter's (`emit_companies.mjs`: OR-wraps over the chain, craft keys removed, prosperity throughput per
rung) and are outside this catalogue.

## 1. What the tier split changed that these references hit

* **Building keys** (config `industries[].tiers[]`; 17 tiered industries, none `disabled`). Rung 0 keeps the vanilla key; 50 building keys plus
  6 merged rungs (main methods on the rung below, not buildings):

  | Industry (vanilla key = rung 0) | Building keys (tier) | Merged method (host) |
  |---|---|---|
  | food `building_food_industry` (CRAFT t0) | `_sweeteners` t1 | baking powder t2 → `pm_main_food_baking_powder` on `_sweeteners` |
  | textile `building_textile_mill` (CRAFT t0) | `_dye_workshops` t1, `_sewing_machines` t2 | electric sewing t3 → on `_sewing_machines` |
  | furniture `building_furniture_manufactory` (CRAFT t0) | `_lathe` t1, `_mechanized_workshops` t2 | spray finishing t3 (minted) → on `_mechanized_workshops` |
  | glass `building_glassworks` (CRAFT t0) | `_leaded_glass` t1, `_crystal_glass` t2, `_houseware_plastics` t3 | — |
  | tooling `building_tooling_workshop` (CRAFT t0) | `_pig_iron` t1, `_steel` t2, `_rubber_grips` t3 | — |
  | paper `building_paper_mill` (CRAFT t0) | `_sulfite_pulping` t1, `_continuous_web` t3 (minted) | bleached t2 → on `_sulfite_pulping` |
  | fertilizer `building_chemical_plant` t0 | `_nitrogen_fixation` t2, `_catalytic_synthesis` t3 (minted) | improved fertilizer t1 → on `building_chemical_plant` |
  | explosives `building_explosives_factory` t0 | `_ammonia_soda_process` t1, `_vacuum_evaporation` t2, `_brine_electrolysis` t3 | — |
  | steel `building_steel_mill` t0 | `_bessemer_process` t1, `_open_hearth_process` t2 | electric arc t3 → on `_open_hearth_process` |
  | motor `building_motor_industry` **t1** | `_electric_engines` t2, `_diesel_engines` t3 | — |
  | automotive `building_automotive_industry` **t2** | `_mass_automobile_production` t3 | — |
  | arms `building_arms_industry` t0 | `_rifles` t1, `_repeaters` t2, `_bolt_action_rifles` t3 | — |
  | artillery `building_artillery_foundry` t0 | `_smoothbores` t1, `_breech_loaders` t2, `_recoiled_barrels` t3 | — |
  | munition `building_munition_plant` **t1** | `_explosive_shells` t2 | — |
  | synthetics `building_synthetics_plant` t1 | single rung: key references unchanged | — |
  | electrics `building_electrics_industry` t2 | single rung: key references unchanged | — |
  | art academy `building_art_academy` t0 | `_realist_art` t1, `_photographic_art` t2, `_film_art` t3 | — |

* **Main methods are renamed:** each rung runs `pm_main_<ind>_<method>` (e.g. `pm_main_art_academy_realist_art`), never the vanilla
  `pm_realist_art`, for single-rung industries too. The vanilla methods stay DEFINED (the build ships whole-file copies of `01_industry.txt` and
  `06_urban_center.txt` methods), but no building lists them. So `has_active_production_method = pm_<vanilla>` is silently false, and
  `is_production_method_active = { building_type = building_X production_method = pm_<vanilla> }` fails validation at load
  (`PostValidate of trigger 'is_production_method_active' returned false` + `Invalid Production Method '<pm>'`): 44 sites, 19 distinct methods,
  in the error.log of `20261019_225952_wm99-n4` run 1; 46 in the pre-fix smoke comparison (SESSION_VERDICTS). What an invalid trigger evaluates
  to at run time is not measured; this catalogue assumes false (as F181 §8 reads it). Under a `NOT` (industrial_accident_events.1) that flips to
  TRUE.
* **Secondary methods are renamed per industry** (emit_secondaries' `top` rule, one name per industry and line; the emitter reads the
  vanilla → copy map from the emitted loc, 38 vanilla secondaries today): `pm_mechanized_looms → pm_mechanized_looms_textile_mill_sewing_machines`,
  `pm_automatic_power_looms → pm_automatic_power_looms_textile_mill_electric_sewing_machines`, `pm_watertube_boiler_building_<X> →
  pm_watertube_boiler_building_<X>_<short>` (furniture, tooling, paper, steel, motor), `pm_rotary_valve_engine_building_<X>_<short>`,
  `pm_assembly_lines_building_<X>_<short>`, `pm_pot_stills → pm_pot_stills_food`, `pm_patent_stills → pm_patent_stills_food`,
  `pm_craftsman_sewing → pm_craftsman_sewing_textile`, `pm_radios → pm_radios_electrics`, `pm_cannery → pm_cannery_food`, …;
  `pm_traditional_looms` exists on no building. Defaults keep vanilla names (`pm_automation_disabled`, `pm_disabled_distillery`, `pm_no_radios`,
  `pm_no_luxury_clothes`, …). The craft rungs carry no automation group, and the food craft's distillery group holds only `pm_disabled_distillery`.
* **Crafts:** the six light-industry rung-0 keys are 500-worker crafts in `bg_pmr_crafts` (child of `bg_light_industry`), `workforce_mult` 0.1,
  and the 1836 start multiplies their levels ×10. A vanilla `level >= N` on those keys means a tenth of the vanilla capacity.
* **Per-building modifier types** are hand-enumerated in vanilla. `emit_companies.mjs` declares `building_<rung>_throughput_add` for the 27 rung
  keys company prosperity names; `emit_vanilla_refs.mjs` declares the six the throughput rules need beyond those
  (`building_glassworks_{leaded_glass,crystal_glass,houseware_plastics}` and `building_explosives_factory_{ammonia_soda_process,vacuum_evaporation,brine_electrolysis}`),
  each body copied from the rung-0 type, loc from the rung-0 type's vanilla line in every configured language.

## 2. Building groups — does `is_building_group` match child groups?

**Yes, verified** for `is_building_group`: TESTBED_METRICS measured `is_building_group = bg_manufacturing` catching light, heavy and military
industry and ship construction (GBR 1836: 28 manufacturing buildings), and F180 §1 notes that vanilla's decrees test `bg_manufacturing`, which
holds no building directly. So every `is_building_group = bg_light_industry` / `bg_manufacturing` reaches the crafts, and the group modifiers
(`building_group_bg_light_industry_*`) reach them too. **Not verified, likely:** that `state_has_building_group_levels`,
`country_has_building_group_levels` and `pop_employment_building_group` also count child groups. The one case that depends on it (G3) is built
so that it does not matter.

Where the groups DO change meaning (the other 70 group lines are fine — appendix C):
* **Craft levels inflate level thresholds and level sums:** `06_vernacular_buttons.txt:137,210,449,618` (`bg_light_industry level >= 5/6/10/8` on
  ONE building — a 5-level craft is 2,500 workers against vanilla's 25,000); `00_victoria_scripted_effects.txt:2264`
  `fra_weekly_pulse_orleanist_progress` (Σ `prev.level` of every profitable `bg_manufacturing` building ÷ 100, the Orleanist progress of
  `je_french_monarchism`); `06_economic_regeneration.txt:449,481,538,589` (`state_has_building_group_levels bg_light_industry >= 16 / 7`, Spain) — the
  same inflation if that counter includes child groups. All three are built crafts-out (A-g).
* **Per-building level thresholds split across rungs:** `level >= 5` on one heavy or military building (vernacular 355/471, `ideology_luddite`
  6530–6629, `adopt_random_antigovernment_ideology` 841/857) is harder when a state's capacity is spread over two rung buildings. Minor; left.

## 3. Findings by pattern

Each subsection gives what the vanilla lines do in the mod untransformed and what the build does. The rung sets and their reasons are PART 2's
rows (A1–A78, G1–G3, D1–D49); the helper names are §5.1 A's.

### 3.1 The art-academy chain — dead untransformed, restored by the build (7 blocks in 3 files; A5–A8, A65, A66, A76, A77)

| Where | Vanilla test | Untransformed | Lost while dead |
|---|---|---|---|
| `common/journal_entries/00_art_jes.txt:27–28` je_romanticism `complete` | an academy running `pm_traditional_art`, level ≥ 2, occupancy ≥ 0.9 | rung 0 runs `pm_main_art_academy_traditional_art` → never | the chain stops at its first step |
| `00_art_jes.txt:63` (possible), `:70,73` (complete) je_realism | complete: `percent = 1` of academies on `pm_realist_art`, occupancy ≥ 0.9 | possible needs rung 0; complete never | |
| `00_art_jes.txt:103` / `:110–119` je_camera | a photographic academy level ≥ 5 and > 75% of academies photographic | never | |
| `00_art_jes.txt:150` / `:157–166` je_film | the same with film | never | |
| `events/tech_events/society_tech_events.txt:219,227–228` society_tech_events.302 (fired by je_romanticism) | picks a traditional-art academy | never fired; its immediate's method dead | realism +3,500, `romantic_building_modifier` |
| `society_tech_events.txt:447–460` dt_society_events.2 (fired by je_realism; `order_by = b:building_art_academy.level` at 452) | | never | camera +4,150, `realist_art` / `grim_realism` |
| `events/tech_events/camera_film_pm_events.txt:31–32 / 94–95` (.1 / .2, fired by je_camera / je_film) | | never | film +6,000, mass_propaganda +5,850 |

**Built:** the three files are regenerated with every academy test widened to all four rungs and each method test resolved to its rung:
je_romanticism and society_tech_events.302 on a traditional-art academy (t0); je_realism and dt_society_events.2 on a realist one (t1; states
ordered by `b:building_art_academy_realist_art.level`); je_camera and camera_film_pm_events.1 on a photographic one (t2); je_film and
camera_film_pm_events.2 on a film one (t3). The share clauses are gone ((F) 1 (c)): je_realism completes on one realist academy ≥ 90% staffed,
je_camera and je_film on one level-5 academy of their rung. The `possible` clauses accept an academy of any rung.

**For BALANCE_FRAMEWORK §10.98 (item 10).** §10.98 gives realism, camera, film and mass propaganda no research entry of the mod's own,
because vanilla's universal art journals advance them. Untransformed, those journals are dead (above). From the 2026-10-21 canon
(`728f2c7f84e6f467`) on, the build restores them and the files load clean (no invalid-production-method line in the smoke run), so the premise
holds again in the files. That the chain completes and pays its 19,500 points of progress over a century is not yet measured.

### 3.2 Belle Époque — dead at `possible` (A9, A10, A39–A43)

**Untransformed:** `common/journal_entries/00_belle_epoque.txt:40,43–44` (`je_belle_epoque` possible) needs an academy level ≥ 3 running
photographic or film art, so **the journal entry never activates and the belle_epoque_events chain it drives never runs**. Its monthly launcher
for belle_epoque_events.14 (`:260`) and that event's own trigger (`events/belle_epoque_events.txt:1375`) test the renamed secondary
`pm_craftsman_sewing` → dead. `.2` (`:135,151`), `.3` (`:280,287`) and `.6` option b (`:631,636`) test an academy level ≥ 3 → narrow; `.6`'s
trigger (`:602,610`) tests electrics, a single rung, and is unaffected; `.8` (`:781`) tests automotive rung 0 (the t2 car plant) → narrow; `.14`'s
option (`:1418`) tests the textile craft → narrow, craft.

**Built:** possible = an academy of any rung at level ≥ 3 running photographic or film art (t2+); the launcher and the trigger test
`pm_craftsman_sewing_textile` (textile t1+); `.2`, `.3` any academy rung; `.6` option b t0–t2; `.8` any automotive rung; `.14` the textile
factory rungs ((F) 5).

### 3.3 The grand exhibition and the other academy tests — narrow (A4, A11, A22, A33, A36–A38, A44, A45, A47–A49, A54–A56)

**Untransformed:** `common/decisions/grand_exhibition_decision.txt:13` possible, `any_scope_building = { is_building_type = building_art_academy
level >= 10 }`, accepts only a 10-level traditional-art academy, so a country that modernised its academies cannot hold the exhibition. The
same rung-0 narrowing in `00_liberalism.txt:137` (je_liberalism_3, level ≥ 3, occupancy > 0.9); `events/liberalism.txt:71,122,166`;
`assassination_events.txt:287,304`; `balkans_events/03_ip3_austria_events.txt:433,558` (exhibition participation prestige, cultural exchange);
`balkans_events/national_awakening.txt:368,387,392`; `decree_events.txt:498,517`; `fascism_events.txt:949,1011,1017`;
`iberia_events/ip4_anarchism_events.txt:379`; `ig_suppression_events.txt:853` (dialectics +3,500); `krakatoa_events.txt:683,696,701`;
`law_events/citizenship_laws.txt:142,175`; `scripted_buttons/06_vernacular_buttons.txt:50,67,293,558` (Catalan, Galician, Breton: a university
or an academy); `scripted_effects/00_victoria_scripted_effects.txt:3004` (`calculate_national_identity_progress`: the South American national
identity journal entry counts academy levels); `events/brazil/amazonas.txt:420,425` (creates an academy if the state has no rung-0 one, so it can
add one beside a modern academy). `events/japan_events/ep2_japan_events_03.txt:157–179` (japan_events.32, ukiyo-e) tests
`is_production_method_active` traditional art on `building_art_academy` → invalid at load → dead.

**Built:** one academy of any rung at level 10 (the user's own rule; the summed-state-levels alternative was not built); every other test above
accepts any academy rung (the art academy has no craft, so `level` keeps its meaning); amazonas.5 creates an academy only where the state has
none of any rung, and the created one stays t0; japan_events.32 stays on rung 0 (traditional art IS ukiyo-e), its method pairs resolved to
`has_building = building_art_academy`.

### 3.4 Industry-ban laws — demolish rung 0 only (A17)

**Untransformed:** `common/laws/01_economic_system.txt:263–307` (`law_industry_banned`) and `:379–417` (`law_extraction_economy`) remove the
chemical plant, synthetics, steel, motor, automotive, electrics and munition plant (and the power plant) in every state on activation — rung 0
only. Bessemer and open-hearth mills, electric and diesel engine plants, mass car plants, nitrogen and catalytic fertilizer plants and shell plants
survive the ban (their `possible` blocks only stop new construction). Vanilla never removes the explosives factory under these laws.

**Built:** the file is owned. Each `if = { limit = { has_building = K } remove_building = K }` is expanded into one block per building key of
the industry (15 blocks matched, 10 of them on tiered industries; merged rungs are methods and need nothing). Explosives stay out.

### 3.5 Player objectives, missions, reforms — narrow (A12, A13, A15, A16, A19–A21)

**Untransformed:** `00_player_objectives_economic_dominance.txt:73,82` je_refining_goods (a steel mill level ≥ 4, occupancy ≥ 0.9,
unsubsidised) accepts only the blister-steel rung, so a player who builds Bessemer cannot complete it; `:103,112` je_specialized_goods (motor
level ≥ 2) only the steam-engine rung. `00_trade_route_event_missions.txt:8` je_build_local_arms_industry (`any_scope_state = { has_active_building
= building_arms_industry }`) completes only on a musket rung, and `events/trade_route_events.txt:25` (`NOT` any state `has_building` arms) fires for
countries that DO have rifle or repeater factories → **SHIFT** (a spurious mission that then demands muskets). `03_russia.txt:1277`
je_great_reforms_military (munition level ≥ 3); `scripted_buttons/00_balkan_wars_buttons.txt:187–189,213–215` (in 1912 effectively never);
`03_paraguay_scripted_buttons.txt:69` (arms level ≥ 2); `05_serbia_buttons.txt:15` (the paper craft).

**Built:** every rung of the industry; the Serbian button counts the paper craft too ((F) 3).

### 3.6 Industrialisation, distilleries, industrial accidents — mostly dead (A25–A31, A50–A53, A58, A59, A61–A64)

`common/scripted_triggers/00_scripted_triggers.txt` holds the shared triggers; their callers are events (appendix E).

| Trigger (lines) | Untransformed | Callers |
|---|---|---|
| `has_industrialized_pm` 141–215 (15 `is_production_method_active` pairs: looms; watertube / rotary valve / assembly lines on furniture, tooling, paper, steel, motor; `pm_mechanized_workshops`) | every pair invalid at load → DEAD | `pm_events.txt:29,110,117` → **pm_events.1 (Dangerous Equipment) and .2 (Untrained Hands) never fire** |
| `using_watertube_boiler` 217–262 | DEAD | `industrial_accidents_events.txt:413,419` → **industrial_accident_events.5 (Boiler Explosion) never fires** |
| `has_distillery` / `is_distillery` 933–947 (secondaries `pm_pot_stills`, `pm_patent_stills`) | always false (renamed `_food`; the food craft cannot distil) | `00_prohibition_laws.txt:12,31` → **je_prohibition never shown**; `prohibition_events.txt:26,42,349,355` never; `:259,268` (`has_distillery = no`) always true, moot while the journal entry is dead |
| `has_industry_building` 451–460, `is_industry_building` 462–471 (the six light-industry keys) | the six CRAFTS only; a craft's `level >= 3/5` is a tenth of vanilla's capacity | `revolution_events_03.txt:372–638` (`level >= 3`), `election_other_parties_events.txt:36–68` (`level >= 5`), `economy_laws.txt:442–456` |
| `has_heavy_industry_building` 473–483, `is_heavy_industry_building` 486–496 (chemical, synthetics, steel, motor, automotive, electrics, munition, power) | rung 0 (+ the untiered power plant) | the same callers |
| `has_government_building` 437, `is_production_building` 812–855 | NARROW | **no vanilla caller** (UNUSED) |

`common/scripted_effects/00_scripted_effects.txt:75–180` `save_industrialized_pm_building_and_state` (paired with `has_industrialized_pm`) is DEAD.
Events: `industrial_accidents_events.txt:53–56,97–100` accident .1 tests `has_building textile_mill` AND NOT `pm_traditional_looms` active; the
method is invalid on the craft, so if it evaluates false the NOT is true → **SHIFT: the mechanised-loom accident fires in every state with a
textile craft**. `:169,184` accident .2 tests the textile craft (narrow, craft). `:327–345` accident .4 tests a food building whose distillery is not
disabled; the craft's only distillery method IS `pm_disabled_distillery` → DEAD. `pm_events.txt:181–211` pm_events.3 (pot and patent stills on
rung 0) is invalid at load → DEAD; `:316,325` pm_events.4 (arms) narrow.

**Built:** both files owned. `has_industrialized_pm` becomes `any_scope_building = { pmr_is_industrialized_building = yes }`, the method list read
from vanilla's own block at build time (each secondary → its per-rung copies; `pm_mechanized_workshops` → the whole furniture t2 host, so spray
finishing counts); the effect's `limit` takes the same helper. `using_watertube_boiler` → `pmr_runs_watertube_boiler` (furniture t1–t2,
tooling t1–t3, paper t1 and t3, steel t0–t2, motor t1–t3). `has_distillery` / `is_distillery` test the `_food` stills (the food t1 host).
`has_industry_building` keeps every rung, crafts in (its caller economy_laws.6, (F) 2); `is_industry_building` and `is_production_building` take the
non-craft rungs ((F) 10); the heavy-industry pair every rung. Accident .1 → textile t2+ (`pmr_has_textile_e2plus`: the sewing-machine host,
either method; dye workshops carry no looms); .2 → textile t1+; .4 → `has_distillery = yes`; pm_events.3 → the `_food` stills.

### 3.7 Technology events with research progress — dead or narrow (A67–A78)

| Event (`events/tech_events/…`) | Lines | Vanilla | Untransformed | Lost while untransformed | Built |
|---|---|---|---|---|---|
| military_tech_events.401 | 27–62 | arms level ≥ 3 on rifles, repeaters or bolt action | the musket rung never runs them → **DEAD** | repeaters +4,150, `modern_rifle_arsenal` / `arsenal_proving_ground` | arms t1+ (`pmr_is_arms_e1plus`) |
| production_tech_events.200 | 239–256 | ≥ 50% of glassworks on houseware plastics, level ≥ 5 | the glass craft → **DEAD** | plastics +6,000 | one level-5 plastics (t3) glassworks ((F) 1 (c)); the immediate picks a t3 glassworks |
| production_tech_events.210 | 329–344 + secondary 337 | ≥ 50% of electrics plants running `pm_radios` | renamed `pm_radios_electrics` → **DEAD** | radio +6,000 | `pmr_runs_sec_pm_radios`; the immediate's random glassworks (a vanilla slip) any rung |
| production_tech_events.300 | 414–442 | electrics level ≥ 5 (trigger) + `pm_telephones` (immediate) | trigger fine (single rung); the immediate's method never → `scope:electrics_state` unset → **SHIFT** | option b's modifier | `pmr_runs_pm_telephones` (= the electrics building) |
| production_tech_events.102 | 83, 91 | munition plant or mines + an explosives factory | the Leblanc rung and the percussion-cap rung → NARROW | `dynamite_production_modifier` | any rung of both |
| production_tech_events.501 | 762–879 | motor industry | the steam-engine rung only → NARROW | steel_railway_cars +4,150 | any motor rung |
| production_tech_events.700 | 1065–1105 | motor level ≥ 3, "the manufacture of steam engines" | the steam-engine rung → right as it is | — | left on rung 0 (`keep`) |
| production_tech_events.103 | 167–170 | a motor building running `pm_automobile_production` | VANILLA-DEAD (already impossible) | — | rewritten with its file; still impossible |
| society_tech_events.104 | 8, 11 | a steel mill and a glassworks | the blister rung and the glass craft → NARROW, craft | `elevator_goods_production_modifier` | steel any rung, glass t1+ |
| war_crimes.2 | 143, 154 | munition plant level ≥ 5 | the percussion-cap rung → NARROW | rifling +3,500 | any munition rung |

The art chain's four boosts are §3.1.

### 3.8 Per-building throughput modifiers — rung 0 only (table D)

**Untransformed:** every `building_<key>_throughput_add` in appendix D boosts rung 0 only. The significant ones: the power-bloc
**principle_military_industry_1/2/3** (`00_power_bloc_principles.txt:902–904, 947–949, 967–969`, +10% arms, artillery, automotive) boost muskets,
cannons and the t2 car plant; the tech-event rewards in `02_event_modifiers.txt` reward MODERNISING by boosting the OBSOLETE rung
(`plastic_production_modifier` +33% → the forest-glass craft, `dynamite_production_modifier` +33% → Leblanc, `engine_production_modifier` +33% →
steam engines); and twelve art-academy modifiers plus `amendment_degenerate_art`.

**Built:** 52 lines in 19 files are duplicated into one line per ruled rung key at the same value; 8 lines stay as written (D5 ukiyo-e, its file
ACCEPTED; D26 romantic architecture, t0; D40 steam engines, t1; D31 and D43, no vanilla user; the two electrics lines, D23 and D32, single rung).
The six modifier types vanilla lacks (glass t1–t3, explosives t1–t3) are declared with loc (§1).

### 3.9 AI behaviour — pointed at the obsolete rung (A2, A3, A34)

**Untransformed:** `ai_strategies/01_admin_strategies.txt:210–211, 574` subsidise `building_tooling_workshop` and `building_explosives_factory`,
i.e. the crude-tools CRAFT and the Leblanc rung — a subsidy propping up exactly the rungs the ladder retires. `00_default_strategy.txt:5033,5040,5047`
(goods stances for dye and silk ← textile mill, hardwood ← furniture manufactory) hold only while the country owns the CRAFT, which consumes none of
the three goods (inverted). `scripted_effects/04_negotiation_scripted_effects.txt:461–467, 601–629` (`set_promised_building_type`): a negotiation
can promise `bt:building_art_academy` / `_artillery_foundry` / `_munition_plant` / `_arms_industry`, so the player must then build levels of the
rung-0 type (and `building_can_be_promised` requires already owning rung 0) → SHIFT. The light and heavy random picks at 403–413 and 542–549 are
fine (they pick a real type; `building_levels_to_increase_value` divides by `required_construction`, so a craft promise is cost-normalised).

**Built:** the two subsidies are removed (R2.3, the config's `building_subsidies` set to `none`; `build.ps1` writes the admin strategies, not
this emitter). The stances point at textile and furniture t1+. A promise names the most advanced rung of that industry the owner already holds
(`pmr_can_promise_<ind>`, `pmr_promise_highest_<ind>`: highest rung first, each guarded by `building_can_be_promised`).

### 3.10 Decrees, flavour, Montenegro, creation effects (A18, A20, A23, A24, A35, A44, A46, A57)

**Untransformed:** `events/decree_events_02.txt:29–44,71–86` (decree_events.100) and `:150–165,194–209` (.101) OR over 15 manufacturing keys
(vanilla omits the artillery foundry) with `weekly_profit > 0` → rung 0 and the crafts only. `common/on_actions/00_code_on_actions.txt:958` (the
monthly Montenegro check, `has_active_building = building_arms_industry`) and `events/balkans_events/montenegro_events.txt:1859–1877` (a
`b:building_arms_industry` link) → muskets only. `06_vernacular_buttons.txt:634` (Occitan agricultural branch: a food craft level ≥ 3 is trivially
met), `:694` (Walloon: steel rung 0 level ≥ 6); `economy_laws.txt:444,455` (arms). Creation effects: `events/brazil/paraguay.txt:355,360` and
`03_paraguay_scripted_buttons.txt:98,103` create a 2-level steel mill if the state has no rung-0 mill (so they can put one next to a modern mill);
`events/agitators_events/land_ownership_law_events.txt:1577` starts a `building_steel_mill` ("an ad hoc steel mill", backyard steel) — right as it
is.

**Built:** decree_events.100/.101 count the factory rungs only, the artillery foundry still left out ((F) 8). Montenegro: vanilla's check stays
untouched (its file ACCEPTED) and an additive monthly on_action (`pmr_mon_first_arms_factory`) fires `mon_state_formation.13` when Montenegro has
an active arms building of any rung and vanilla's musket-rung check would not fire; the event's `b:` link becomes a random arms building of any
rung ((F) 11). Occitan: food factory rungs at level 3 ((F) 4); Walloon and economy_laws.6's arms: any rung. The creation guards test every rung; the
created mill stays t0; the backyard steel event is ACCEPTED.

### 3.11 Cosmetic / harmless (A1, A32)

* `common/customizable_localization/99_ru_custom_loc.txt` — 85 lines (17 keys × 5 grammatical cases): higher rungs take the default form in Russian
  text. ACCEPTED.
* `gfx/map/city_data/city_types/*.txt` and the DLC city files — 170 lines mapping each vanilla key to a factory mesh; higher rungs have none, so modern
  cities show fewer factory meshes. `gfx/map/spline_network/route_graphics/02_railroad_vehicles.txt` and
  `common/scripted_triggers/00_gfx_route_graphics_triggers.txt:128` (`gfx_mining_train_trigger`, steel mill) — train visuals. Outside the scan
  (`gfx/`) or ACCEPTED.
* `common/achievements/mp1_charters_of_commerce_achievements.txt:146` (Systembolaget: a monopoly on `bt:building_food_industry`) — achievements are
  unavailable with any mod. ACCEPTED.
* `has_subsistence_building` (scripted_triggers 499) is unaffected (it tests `is_subsistence_building`).

## 4. The ten cases that matter most

1. **je_belle_epoque could never activate** (§3.2).
2. **The art chain could never complete:** −3,500 realism, −4,150 camera, −6,000 film, −5,850 mass propaganda and four art modifiers in every
   country, a research-pacing bias against the vanilla reference (§3.1).
3. **The industry-ban and extraction-economy laws left rungs 1–3 standing** (§3.4).
4. **Tech-boost events dead or narrowed:** repeaters, plastics and radio dead; steel railway cars, rifling, dynamite only for the old rungs (§3.7).
5. **The power-bloc Military Industry principles and ~48 event throughput rewards boosted rung 0 only**, rewards for modernising included (§3.8).
6. **The grand exhibition needed a 10-level TRADITIONAL academy** (§3.3).
7. **Player objectives and missions demanded the obsolete rung**, and trade_route_events.1 fired for countries that already make rifles (§3.5).
8. **je_prohibition was never shown** (§3.6).
9. **The industrialisation events were dead**, while the mechanised-loom accident fired on artisan crafts (§3.6).
10. **AI levers pointed at the retired rung** (subsidies, negotiation promises), and craft levels inflated the Orleanist progress and the
    vernacular light-industry thresholds (§3.9, A-g).

All ten are fixed in the build.

## 5. The emitter — `tools/emit_vanilla_refs.mjs`

### 5.1 What it emits

Run by `build.ps1` after `emit_secondaries.mjs` (it reads the minted secondary names from the EMITTED mod) and `emit_craft_start.mjs`, and before
`emit_value_overrides.mjs` (which then edits two of its copies in place: `02_event_modifiers.txt` and `00_power_bloc_principles.txt`) and
`check_dlc_gates.mjs`. `node tools/emit_vanilla_refs.mjs <modDir> [config]`; `VIC3_GAME` overrides the game path. Its model comes from the config:
each industry's tiers (`key`, `era`, `craft`, `pm_key`, `vanilla_pm`, `method_of`); a single-rung industry's KEY references are left alone, but its
main methods are renamed too and are rewritten.

**A. Additive files** (generated, only the helpers a transform uses):
* `common/scripted_triggers/zzz_pm_rehaul_industry_triggers.txt` — 58 triggers today. Building scope: `pmr_is_<ind>[_<set>]` (an OR of
  `is_building_type`; a merged rung is `AND = { is_building_type = <host> has_active_production_method = <its pm_key> }`), `pmr_runs_<vanilla main
  method>` (its rung's building, or host + method), `pmr_runs_sec_<vanilla secondary>` (an OR over its per-rung copies), the two method-list
  helpers `pmr_is_industrialized_building` and `pmr_runs_watertube_boiler`, and `pmr_can_promise_<ind>`. State or country scope:
  `pmr_has_<ind>[_<set>]`, `pmr_has_active_<ind>`, `pmr_state_runs_<pm>`, `pmr_state_runs_sec_<pm>`.
  **Set names:** none = every rung; `_nc` = crafts out; `_e<k>plus` = tier k and up; `_e<k>` = tier k; `_e<a>_e<b>` = tiers a to b (keyed by the
  rung's tier, never its position).
* `common/scripted_effects/zzz_pm_rehaul_industry_effects.txt` — `pmr_promise_highest_<ind>` for arms, art academy, artillery, munition (A34).
* `common/script_values/zzz_pm_rehaul_industry_values.txt` — `pmr_light_industry_levels_nc` (state scope: light-industry levels, crafts out; G3).
* `common/on_actions/zzz_pm_rehaul_vanilla_refs.txt` — the Montenegro first-arms-factory check (A18), registered through `on_actions`, never an
  `effect` block (L22), carrying `has_dlc_feature = ip3_content` (the event is `dlc = dlc014`).
* `common/modifier_type_definitions/zzz_pm_rehaul_vanilla_refs_modifiers.txt` — the six throughput modifier types (§1), and
  `localization/<lang>/replace/zzz_pm_rehaul_vanilla_refs_l_<lang>.yml` in every configured language (their loc and the script value's name).

**B. Whole-file transforms.** Each file is regenerated from the live game text (or from the build's own copy where an earlier emitter already
wrote that path — never from a copy this emitter wrote), headed `# PM & Tech Rehaul: regenerated from vanilla every build by
tools/emit_vanilla_refs.mjs`, in three passes:
1. **Snippets** from the `SPEC` table, for what a token rule cannot say: the art journals' share clauses, the plastics event, the ban-law
   demolitions, the two industrialisation triggers and the effect's `limit`, the vernacular and Orleanist crafts-out lines, the Spanish
   regeneration counter, the negotiation `bt:` options, the Montenegro `b:` link, the realist `order_by`, the arsenal event's method OR, the
   textile and molasses accidents. Each asserts its match count.
2. **Method tests:** `is_production_method_active = { building_type = … production_method = pm_Y }` → `pmr_state_runs_[sec_]pm_Y = yes`.
3. **Token rules, line by line** (comments untouched): `is_building_type` / `has_building` / `has_active_building = <rung-0 key>` →
   `pmr_is_` / `pmr_has_` / `pmr_has_active_<ind>[_<set>] = yes`, the set taken from the file's `mode`, overridden per top-level block by `byBlock`
   (`keep` leaves the token as vanilla wrote it); `has_active_production_method = pm_Y` → `pmr_runs_[sec_]pm_Y = yes`; a
   `building_<rung-0 key>_throughput_add = v` line → one line per key of its `tp` set (default every rung, `keep` = rung 0 only).

**C. The 63 files it owns** (the user ruled the whole scope in, flavour included — R2.4):

| Directory | Files |
|---|---|
| `common/decisions` (1) | grand_exhibition_decision |
| `common/journal_entries` (8) | 00_art_jes, 00_belle_epoque, 00_liberalism, 00_player_objectives_economic_dominance, 00_prohibition_laws, 00_trade_route_event_missions, 03_russia, 06_economic_regeneration |
| `common/laws` (1) | 01_economic_system |
| `common/scripted_triggers` (1) | 00_scripted_triggers |
| `common/scripted_effects` (3) | 00_scripted_effects, 00_victoria_scripted_effects, 04_negotiation_scripted_effects |
| `common/ai_strategies` (1) | 00_default_strategy |
| `common/scripted_buttons` (4) | 00_balkan_wars_buttons, 03_paraguay_scripted_buttons, 05_serbia_buttons, 06_vernacular_buttons |
| `common/amendments` (1) | 00_amendments_enactment_04 |
| `common/power_bloc_principles` (1) | 00_power_bloc_principles |
| `common/static_modifiers` (17) | 00_ip3_02, 00_ip3_03, 00_ip3_04, 00_ip4_03, 00_ip4_04, 02_event, 104, 105, agitators_4, agitators_4_revolution, brazil_2, content_1, content_2, content_3, content_4, japan_single_fire_events, montenegrin (each `_modifiers`) |
| `events` (25) | assassination_events, balkans_events/{03_ip3_austria_events, montenegro_events, national_awakening}, belle_epoque_events, brazil/{amazonas, paraguay}, decree_events, decree_events_02, fascism_events, iberia_events/ip4_anarchism_events, ig_suppression_events, industrial_accidents_events, japan_events/ep2_japan_events_03, krakatoa_events, law_events/{citizenship_laws, economy_laws}, liberalism, pm_events, tech_events/{camera_film_pm_events, military_tech_events, production_tech_events, society_tech_events, war_crimes_events}, trade_route_events |

Patch exposure is a REBUILD obligation, not a freeze: every file is regenerated from vanilla on each build, and a patch that moves a matched line
makes the build throw instead of shipping stale script. ON_GAME_UPDATE.md records the coupling. There is no less invasive route for most of it:
events, journal entries, decisions, scripted triggers and effects, buttons and static modifiers cannot be patched in place, and a same-key
definition in a differently named file is rejected (verified for buildings; assumed for scripted triggers and effects).

**D. Guards.**
* Per file: every snippet's match count, the file's token rewrites (`n`) and throughput lines (`tpn`) must equal the `SPEC`'s; a `tp` rule naming a
  block that matched nothing throws; a `b:` / `bt:` link to a rung-0 key left after the rules throws (it needs a snippet); a throughput line in a form
  the rule cannot rewrite throws; the `has_dlc_feature` and `dlc =` counts must survive unchanged; braces must balance.
* **The scan:** every `.txt` under the game's `common/` and `events/` is read, except the domains other emitters own (`common/history`,
  `production_methods`, `production_method_groups`, `buildings`, `company_types`) and any file the build ships at that path. A rung-0 key, a
  `building_<rung-0 key>_*` modifier name, a vanilla main method or a renamed vanilla secondary in any other file THROWS, unless the file is on
  `ACCEPTED` with its reason. An ACCEPTED file that no longer carries a reference is reported. Landmine L40 holds both halves of the guard; its
  second half (no `Invalid Production Method` line from a vanilla path in a run's error.log) is a manual smoke-check item.
  The scan's blind spot: a vanilla-path copy written by ANOTHER emitter is skipped, so a tiered reference inside it is that emitter's job. Checked
  by hand 2026-10-24 on the canon's build: the twelve such copies outside the skipped domains (the admin strategies, goods, education laws, four
  state-trait files, the code static modifiers, the Cuban modifiers, three technology files) carry none.
* **`ACCEPTED`** (eight entries): `achievements/mp1_charters_of_commerce_achievements.txt` (A1, achievements are off with any mod),
  `customizable_localization/99_ru_custom_loc.txt` (Russian forms, cosmetic), `modifier_type_definitions/01_building_modifier_types.txt` (vanilla's
  own declarations of the rung-0 types), `scripted_triggers/00_gfx_route_graphics_triggers.txt` (A32), `on_actions/00_code_on_actions.txt` (A18,
  vanilla's Montenegro check stays; the additive check covers the other rungs), `static_modifiers/00_ep2_03_modifiers.txt` (D5, ukiyo-e is
  traditional art), `events/agitators_events/land_ownership_law_events.txt` (A35, backyard steel), and `ai_strategies/01_admin_strategies.txt`
  (R2.3: `build.ps1` writes this file from the config's `building_subsidies`, which the canon sets, so the scan skips it; the entry covers a book
  that leaves the file vanilla — its subsidies are the config's business, not this emitter's).

Proposed and not built: `pmr_level_v` (craft levels at vanilla capacity) and per-industry state-level values — every craft question was ruled in or
out instead, and the grand exhibition counts one building; the additive `on_law_activated` hook for the ban laws — a direct rewrite of the owned
law file is what the engine certainly runs.

### 5.2 After a game patch, and when a new reference turns up

* **A count assertion throws** (a vanilla line moved or changed): find the file in appendices A–E (1.13.11 line numbers) and its PART 2 row; run
  `REFS_LEARN=1 node tools/emit_vanilla_refs.mjs <modDir> [config]`, which prints every file's token and throughput counts beside the `SPEC`'s
  without dying; read the new vanilla lines. If the meaning is unchanged, update the count in `SPEC` and the line numbers here. If it changed, re-rule
  the row (a judgement call is the user's). A new or moved throughput modifier is ruled in table D before its count changes.
* **The scan throws** (a patch added a tiered reference to an unowned file): catalogue it first — an appendix line and a PART 2 row with the proposed
  rung set — then add the file to `SPEC` with its rulings, or to `ACCEPTED` with the reason.
* **A secondary's name changed:** `runsSecH` throws ("has no minted copy"); the fix is in `emit_secondaries.mjs`, not here.
* Afterwards: a build, the preflight, and at the next smoke check the L40 count of `Invalid Production Method` lines from vanilla paths (must be 0).

---

# PART 2 — the rulings, case by case (2026-10-21)

The user's four general rulings (POLISH_1_0.md §2):

| # | Question | Ruling |
|---|---|---|
| R2.1 | "N levels" tests (grand exhibition and the rest) | "go one by one and assess, whether it makes sense narratively" — "any rung" is the grand exhibition's answer, not the default. Table (A) is that assessment. |
| R2.2 | crafts in vanilla "industry building" tests | lean to "exclude craft ones completely", unless the test is really about traditional production — the craft-fit cases are (B), each ruled in (F) |
| R2.3 | the admin-strategy tools and explosives subsidies | not extended ("for now we don't mandate subsidies, except for infrastructure"); vanilla's own two entries removed ("remove crude-tool craft and Leblanc shouldn't be subsidised either") — (E) |
| R2.4 | scope | everything, flavour included ("The scope does include flavour files. Basically option B") |

Every case below was read in the vanilla game files (1.13.11): the trigger, the event or journal-entry text and its English loc. The question
for each: **which rungs should satisfy this test, given what the vanilla script is about?** Row numbers A1… are this part's own; the emitter's
`SPEC` comments cite them.

### Key

**Rungs** are named by TIER. A merged rung is a main method on the rung below, so "t2+" for an industry with a merge means the host building
under either of its main methods:

| Industry | t0 | t1 | t2 | t3 |
|---|---|---|---|---|
| food | **craft** (bakery) | sweeteners (host) | baking powder (method on t1 host) | — |
| textile | **craft** (handsewn) | dye workshops | sewing machines (host) | electric sewing (method on t2 host) |
| furniture | **craft** (handcrafted) | lathe | mechanized workshops (host) | spray finishing (method on t2 host) |
| glass | **craft** (forest glass) | leaded | crystal | houseware plastics |
| tooling | **craft** (crude tools) | pig iron | steel | rubber grips |
| paper | **craft** (pulp pressing) | sulfite pulping (host) | bleached (method on t1 host) | continuous web |
| fertilizer | artificial (host) | improved (method on t0 host) | nitrogen fixation | catalytic synthesis |
| explosives | Leblanc | ammonia-soda | vacuum evaporation (dynamite) | brine electrolysis |
| steel | blister | Bessemer | open hearth (host) | electric arc (method on t2 host) |
| motor | — | steam engines | electric engines | diesel engines |
| automotive | — | — | automobile production | mass production |
| arms | muskets | rifles | repeaters | bolt action |
| artillery | cannons | smoothbores | breech loaders | recoiled barrels |
| munition | — | percussion caps | explosive shells | — |
| art academy | traditional art | realist art | photographic art | film art |
| synthetics / electrics | single rung, key references unchanged | | | |

**Types** (the assessment's): `ANY` every rung (the industry has no craft) · `ANY−C` every non-craft rung · `ANY+C` every rung including the craft ·
`ERA` a named tier set tied to a technology or practice · `METHOD` whatever building runs a named production method (the rung set follows from where
the method exists) · `HIGHEST` the most advanced rung the owner already holds · `ALL-REMOVE` an effect over every rung · `LEAVE` keep the vanilla
line (narrow is right, unused, dead, or cosmetic). Of the 78 rows: 30 ANY, 6 ANY−C, 15 ERA, 12 METHOD, 1 HIGHEST, 1 ALL-REMOVE and 7 LEAVE; the
four craft questions (A21, A23, A43, A57) were put to the user and ruled in (F); A3 and A28 point elsewhere.

**Built** (the emitter's mechanism): `all`, `nc`, `e<k>plus`, `e<k>`, `e<a>_e<b>` — the token rules with that rung set; `keep` — the token left as
vanilla wrote it; `method` — the rung follows from the method test; `snippet` — a hand-written rewrite in `SPEC`; `ACCEPTED` — the file stays
vanilla.

**Crafts on the 1836 map** (the emitted `mod/common/history/buildings`, rechecked 2026-10-24): 66 countries own a tiered light-industry building;
**42 own ONLY crafts** in light industry (Japan, Portugal, Egypt, Denmark, Switzerland, Tuscany, the Papal States, Korea, Finland, Morocco, Tunis,
Argentina, Colombia, Peru, Bolivia, a dozen Indian states, …). The larger agrarian powers (Russia, Austria, the Ottomans, Spain, China, Sweden,
Brazil, Mexico, Sardinia) hold crafts in most light industries plus at least one factory rung, usually tooling. **GBR, FRA, PRU and BEL own no craft
at all** (nor do Saxony and Chile); the USA owns only a food craft. By industry, countries holding only the craft / countries with a factory rung:
**textile 42 / 6** (only GBR FRA USA PRU NET BEL have a textile factory rung; Russia, Austria, the Ottomans, Spain, China and Japan are
textile-craft-only) · paper 24 / 5 · furniture 21 / 10 · glass 15 / 6 · food 9 / 8 · tooling 8 / 17. So excluding crafts silences 1836-era
light-industry content for most of the world, never for the industrial core.

---

### (A) Per-case table

| # | Block · file:line | What it is about | Rungs (ruled) | Type | Built |
|---|---|---|---|---|---|
| A1 | achievement_systembolaget · `achievements/mp1_charters_of_commerce_achievements.txt:146` | Swedish liquor monopoly achievement | — (achievements are off with mods) | LEAVE | ACCEPTED |
| A2 | ai_strategy_default goods stances · `ai_strategies/00_default_strategy.txt:5033,5040,5047` | the AI wants a high supply of dye (textile mill + lathe), silk (textile mill), hardwood (furniture) — the inputs of dye workshops, craftsman sewing and luxury furniture; untransformed they fire ONLY for craft holders (inverted) | dye, silk → textile t1+; hardwood → furniture t1+. Crafts out — they consume none of the three | ERA | `nc` (textile, furniture) |
| A3 | admin-strategy subsidies · `ai_strategies/01_admin_strategies.txt:210,211,574` | — | removed — see (E) | — | config `building_subsidies` |
| A4 | grand_exhibition_decision · `decisions/grand_exhibition_decision.txt:13` | a world's fair needs an art scene (academy level ≥ 10) | one academy of any rung at level ≥ 10 (the user's own rule) | ANY | `all` |
| A5 | je_romanticism complete · `journal_entries/00_art_jes.txt:27–28` | patronise Romanticism: an academy running traditional art, level ≥ 2, occupancy ≥ 0.9; fails when realism is researched | **t0 only** (traditional art IS the romantic method) | ERA | `all` + `method` |
| A6 | je_realism · `00_art_jes.txt:63` (possible) / `:70–73` (complete) | possible: has an academy. complete: **every** academy runs realist art, occupancy ≥ 0.9 | possible: any rung. complete: **one t1** (realist) academy ≥ 90% staffed — the share clause dropped, (F) 1 | ERA | `all` + `snippet` |
| A7 | je_camera · `00_art_jes.txt:103` / `:110–119` | possible: academy level ≥ 3. complete: a photographic academy level ≥ 5 AND > 75% of academies photographic | possible: any rung. complete: one **t2** academy at level 5 (the journal entry is invalid once film exists, so t2+ ≡ t2); the share clause dropped, (F) 1 | ERA | `all` + `method` + `snippet` |
| A8 | je_film · `00_art_jes.txt:150` / `:157–166` | the same with film | possible: any rung. complete: one **t3** academy at level 5; the share clause dropped, (F) 1 | ERA | `all` + `method` + `snippet` |
| A9 | je_belle_epoque possible · `journal_entries/00_belle_epoque.txt:40–44` | a modern art scene: academy level ≥ 3 on photographic OR film | **t2+** | ERA | `all` + `method` |
| A10 | Belle Époque launcher · `00_belle_epoque.txt:260` + belle_epoque_events.14 trigger · `events/belle_epoque_events.txt:1375` | a neighbouring Belle Époque country has a fashion trade (craftsman sewing) | the method `pm_craftsman_sewing_textile` (textile t1+; the craft cannot carry it) | METHOD | `method` |
| A11 | je_liberalism_3 · `00_liberalism.txt:137` + liberalism.1 · `events/liberalism.txt:71,122,166` | "Freedom of Thought": a university AND an academy level ≥ 3 | academy of any rung | ANY | `all` |
| A12 | je_refining_goods · `00_player_objectives_economic_dominance.txt:73,82` | objective "refine your raw goods": steel mill level ≥ 4, unsubsidised | steel of any rung | ANY | `all` |
| A13 | je_specialized_goods · `…:103,112` | objective "make more expensive goods": motor industry level ≥ 2 | motor of any rung | ANY | `all` |
| A14 | je_prohibition · `00_prohibition_laws.txt:12,30–31` (+ `has_distillery`) | the temperance movement: a food building distilling liquor, level ≥ 5 | buildings running `pm_pot_stills_food` / `pm_patent_stills_food` = the food t1 host under either method; the food craft cannot distil | METHOD | `all` + A31 |
| A15 | je_build_local_arms_industry · `00_trade_route_event_missions.txt:8` + trade_route_events.1 · `events/trade_route_events.txt:25` | "build a domestic arms industry" / the event that asks for it fires when you have none | an active arms building of any rung; the event's absence test is NOT any rung | ANY | `all` |
| A16 | je_great_reforms_military · `journal_entries/03_russia.txt:1277` | Alexander II's army reform: a munition plant level ≥ 3 | munition of any rung (t1 percussion caps or t2 shells) | ANY | `all` |
| A17 | law_industry_banned · `laws/01_economic_system.txt:263–307`; law_extraction_economy `:379–417` | the ban demolishes every heavy-industry building | remove EVERY rung of fertilizer (t0–t3), synthetics, steel (t0–t2 + the arc method), motor (t1–t3), automotive (t2–t3), electrics, munition (t1–t2); explosives NOT added (vanilla never removes it) | ALL-REMOVE | `snippet` (15 blocks, 10 tiered) |
| A18 | Montenegro monthly check · `on_actions/00_code_on_actions.txt:958` + mon_state_formation.13 · `balkans_events/montenegro_events.txt:1859–1877` | "True Aim": pride in the country's FIRST arms factory | arms of any rung; the `b:` link → the state's arms building of any rung; fired by our own additive check, (F) 11 | ANY (or LEAVE) | `all` + `snippet` + on_action; vanilla's check ACCEPTED |
| A19 | Balkan League "Overwork Arms Industries" · `scripted_buttons/00_balkan_wars_buttons.txt:187–215` | 1912 war mobilisation of the military industry | arms, artillery, munition of any rung (untransformed only muskets, cannons, percussion caps qualify — in 1912 effectively never) | ANY | `all` |
| A20 | ybycui_iron_works_button · `scripted_buttons/03_paraguay_scripted_buttons.txt:69,98,103` + paraguay.3 · `events/brazil/paraguay.txt:355,360` | the Rosada foundry: an arms works level ≥ 2 is a precondition; the effect creates a 2-level steel mill if the state has none | possible: arms of any rung. Creation guard: "no steel mill of any rung" (else the 1.5× modifier); the created building stays t0 (an 1850s charcoal foundry is the t0 rung) | ANY | `all` |
| A21 | je_tot_slander_button · `scripted_buttons/05_serbia_buttons.txt:15` | Serbian dynastic struggle: "we have the power of imagery" — print pamphlets; needs a paper mill + mass_communication (game era 1) | **paper of any rung INCLUDING the craft** ((F) 3): pamphlets need no factory, and the first non-craft paper rung needs mechanical_tools (game era 2) | ANY+C | `all` |
| A22 | vernacular buttons Catalan / Galician / Breton · `scripted_buttons/06_vernacular_buttons.txt:50,67,293,558` | a cultural centre: a university OR an academy (level ≥ 3 / ≥ 2) in the homeland | academy of any rung | ANY | `all` |
| A23 | vernacular button Occitan, agricultural branch · `06_vernacular_buttons.txt:634` | an AGRARIAN Occitania: vineyards level ≥ 8 + a food industry level ≥ 3 + the agricultural decree (the manufacturing branch is the light-industry test at line 618, G1) | **food factory rungs only, at level 3**; the craft does not count ((F) 4) | ANY+C or ANY−C | `nc` (food) |
| A24 | vernacular button Walloon · `06_vernacular_buttons.txt:694` | the Walloon coal-and-steel basin: mining level ≥ 8 + steel mill level ≥ 6 | steel of any rung | ANY | `all` |
| A25 | save_industrialized_pm_building_and_state · `scripted_effects/00_scripted_effects.txt:75–180` + has_industrialized_pm · `scripted_triggers/00_scripted_triggers.txt:141–215` | "a state runs mechanised production" (callers pm_events.1 Dangerous Equipment, .2 Untrained Hands) | the minted mechanised secondaries (watertube / rotary valve / assembly lines per industry; mechanised and automatic power looms) + the furniture t2 host (mechanized workshops, also spray finishing) for vanilla's main-method pair. Textile resolves to t2+ (the looms are mandated there). Crafts never | METHOD | `snippet` (`pmr_is_industrialized_building`) |
| A26 | using_watertube_boiler · `00_scripted_triggers.txt:217–262` | caller industrial_accident_events.5, Boiler Explosion | buildings running the watertube secondary (furniture t1–t2, tooling t1–t3, paper t1/t3, steel t0–t2, motor t1–t3) | METHOD | `snippet` (`pmr_runs_watertube_boiler`) |
| A27 | has_government_building · `00_scripted_triggers.txt:437` | university or academy | no vanilla caller | LEAVE (ANY if rewritten) | `all` (the file is owned) |
| A28 | has_industry_building / is_industry_building · `00_scripted_triggers.txt:451–471` | the six light industries | a shared trigger whose callers want different answers: `has_industry_building` every rung, crafts in (its caller A57); `is_industry_building` non-craft (its callers A62–A64) — (F) 10 | — | `all` / `nc` by block |
| A29 | has_heavy_industry_building / is_heavy_industry_building · `:473–496` | chemical, synthetics, steel, motor, automotive, electrics, munition, power | any rung (no crafts in the set) | ANY | `all` |
| A30 | is_production_building · `:812–855` | every manufacturing type | no vanilla caller | LEAVE (ANY−C if rewritten) | `nc` (the file is owned) |
| A31 | has_distillery / is_distillery · `:933–947` | liquor production | the `_food` stills methods | METHOD | `method` |
| A32 | gfx_mining_train_trigger · `scripted_triggers/00_gfx_route_graphics_triggers.txt:128` | map train visuals | cosmetic | LEAVE | ACCEPTED |
| A33 | calculate_national_identity_progress · `scripted_effects/00_victoria_scripted_effects.txt:3004` | South American national identity grows with Σ levels of academies, universities, administrations | academy levels of any rung | ANY | `all` |
| A34 | set_promised_building_type · `scripted_effects/04_negotiation_scripted_effects.txt:461–467` (Intelligentsia: art) and `:601–629` (Armed Forces: artillery, munition, arms) | an IG demands more of a building type the country already has | the **most advanced rung of that industry the owner already holds** (an army promised muskets in 1900, or a film-age intelligentsia promised a traditional academy, is absurd); vanilla's "must already own one" rule kept | HIGHEST | `snippet` (`pmr_promise_highest_<ind>`) |
| A35 | land_ownership_law_events.12 · `events/agitators_events/land_ownership_law_events.txt:1577` | "an ad hoc steel mill should suffice" — backyard steel | starts a t0 steel mill: primitive steel is the point | LEAVE | ACCEPTED |
| A36 | assassination_events.4 · `events/assassination_events.txt:287,304` | "the high spheres": a state with an urban centre level ≥ 10 and a university or academy | academy of any rung | ANY | `all` |
| A37 | austria_events.33 / .34 · `balkans_events/03_ip3_austria_events.txt:433,558` | Vienna world's fair; Japonisme pavilion and cultural-exchange modifier per academy state | any rung | ANY | `all` |
| A38 | national_awakening.5 · `balkans_events/national_awakening.txt:368–392` | "National Romanticism": an academy produces a romanticist painting of the founding myth | any rung (vanilla is style-agnostic; national-romantic painting ran into the realist era) | ANY | `all` |
| A39 | belle_epoque_events.2 · `events/belle_epoque_events.txt:135,151` | Art Nouveau: academy level ≥ 3 | any rung | ANY | `all` |
| A40 | belle_epoque_events.3 · `:280,287` | Symbolism: academy level ≥ 3 | any rung | ANY | `all` |
| A41 | belle_epoque_events.6 option b · `:631,636` (the trigger at `:602,610` is electrics, single rung, unchanged) | "Cinema has no commercial future" → **Supported Traditional Arts** in an academy state | **t0–t2** (not film) — the option chooses painting and photography over cinema | ERA | `e0_e2` (by block) |
| A42 | belle_epoque_events.8 · `:781` | Peugeot-Serpollet steam car / steam omnibus — the country has a car industry | automotive of any rung (t2–t3) | ANY | `all` |
| A43 | belle_epoque_events.14 option b · `:1418` | "The [neighbour] must not outdo us!" — answering haute couture with a +25% textile boost in a textile state | **textile factory rungs only**; the craft does not count ((F) 5) | ANY+C or ANY−C | `nc` (by block) |
| A44 | amazonas.5 · `events/brazil/amazonas.txt:420,425` | "Manaus, Paris of the Tropics": the opera house — create an academy if the state has none, else a bigger modifier | guard: no academy of any rung; the created building stays t0 | ANY | `all` |
| A45 | decree_events.5 · `events/decree_events.txt:498,517` | "Night at the Opera": commission a national opera from an academy | any rung | ANY | `all` |
| A46 | decree_events.100 / .101 · `events/decree_events_02.txt:29–86, 150–209` | "Industrial Boom" / "Credit Where Credit's Due": a profitable, cash-rich manufacturing building in a state under the manufacturing decree reports a surplus | **factory rungs only** (non-craft rungs of the six light industries, every rung of the rest); vanilla's list kept, the artillery foundry still left out ((F) 8) | ANY−C | `nc` (52 rewrites) |
| A47 | fascism_events.8 · `events/fascism_events.txt:949–1017` | "The Voice of the Nation": academy composers write an anthem | any rung | ANY | `all` |
| A48 | anarchism_events.3 · `iberia_events/ip4_anarchism_events.txt:379` | bombs in a theatre's orchestra pit — a cultural city | any rung | ANY | `all` |
| A49 | ig_suppression_events.1000 · `events/ig_suppression_events.txt:853` | dialectics +3,500 if the country has an academy | any rung | ANY | `all` |
| A50 | industrial_accident_events.1 · `events/industrial_accidents_events.txt:53–101` | Triangle Shirtwaist: a garment factory (mechanised looms, not traditional) burns | **textile t2+** (the sewing-machine host, either method; the craft and dye workshops carry no looms). Untransformed it fires on every textile craft | ERA | `snippet` (`pmr_has_textile_e2plus`) |
| A51 | industrial_accident_events.2 · `:169,184` | Dyeworks Accident: "an industrial-sized tub of hot dye" | **textile t1+** (crafts out; the dye-workshop rung is the literal fit). At 1836 only 6 countries qualify (untransformed: every textile holder) | ANY−C | `nc` (textile) |
| A52 | industrial_accident_events.4 · `:327–346` | Great Molasses Flood: a tank of molasses for RUM distillation bursts | buildings running a still (food t1 host) | METHOD | `snippet` (→ `has_distillery`) |
| A53 | industrial_accident_events.5 (via A26) · `:413,419` | Boiler Explosion | the watertube secondary | METHOD | via A26 |
| A54 | japan_events.32 · `japan_events/ep2_japan_events_03.txt:157–179` | ukiyo-e woodblock prints from a TRADITIONAL-art academy | **t0 only** (`has_building = building_art_academy` is already exact) | ERA | `keep` + `method` |
| A55 | krakatoa.4 · `events/krakatoa_events.txt:683–701` | red sunsets of 1883: "only a painting could capture such beauty" | any rung | ANY | `all` |
| A56 | citizenship_laws.2 · `law_events/citizenship_laws.txt:142,175` | debate at an Art Academy about minority artists | any rung | ANY | `all` |
| A57 | economy_laws.6 · `law_events/economy_laws.txt:442–456` | "Industry Suffers": foreign competition under a free-trade enactment hurts a state's producers (light industry, shipyard, arms, heavy industry) | **light industry of any rung INCLUDING the craft** (artisans ruined by cheap imports is THE historical case, (F) 2); arms and heavy any rung | ANY+C | `all` + A28 |
| A58 | pm_events.1 / .2 (via A25) · `events/pm_events.txt:29,110,117` | injuries from mechanisation; child labour at machinery | mechanised secondaries | METHOD | via A25 |
| A59 | pm_events.3 · `pm_events.txt:181–212` | temperance protest at liquor production | the stills methods | METHOD | `method` |
| A60 | pm_events.4 · `pm_events.txt:316,325` | pacifists protest weapons manufacturing | arms of any rung | ANY | `all` |
| A61 | prohibition_events.\* (via A31) · `events/prohibition_events.txt:26,42,259,268,349,355` | the prohibition chain | stills methods | METHOD | via A31 |
| A62 | revolution_pulse2_events.3 · `agitators_events/revolution_events_03.txt:372–465` | "Our Friends Across the Border": a violent strike at a FACTORY, its shareholders call in foreign gendarmes | non-craft light rungs + any heavy rung, level ≥ 3 | ANY−C | via A28 |
| A63 | revolution_pulse2_events.4 · `:596–641` | company-store scrip riot at a "major" building (raw industries also qualify) | non-craft light rungs + any heavy rung | ANY−C | via A28 |
| A64 | election_other_parties_events.1 · `election_events/election_other_parties_events.txt:36–68` | "Man Over Machine": agrarians complain that technology replaces the dignity of manual labour | non-craft light rungs + any heavy rung, level ≥ 5 — the craft IS the manual labour, it cannot be the machine | ANY−C | via A28 |
| A65 | camera_film_pm_events.1 · `tech_events/camera_film_pm_events.txt:31–32` | "Captured Light and Shadow" (film +6,000) | **t2** photographic | ERA | `all` + `method` |
| A66 | camera_film_pm_events.2 · `:94–95` | "The Moving Picture" (mass_propaganda +5,850) | **t3** film | ERA | `all` + `method` |
| A67 | military_tech_events.401 · `tech_events/military_tech_events.txt:27–62` | "Modernizing the Arsenal": the switch from smoothbore muskets to rifles (repeaters +4,150) | **arms t1+** (rifles or newer), level ≥ 3 | ERA | `snippet` (`pmr_is_arms_e1plus`) |
| A68 | production_tech_events.102 · `tech_events/production_tech_events.txt:83,91` | "Exploding Demand" after dynamite: military and mining compete for explosives | munition plant (or mines) and explosives factory, both any rung | ANY | `all` |
| A69 | production_tech_events.103 · `:167–170` | motor industry running automobiles | dead in vanilla already | LEAVE | `all` + `method` (still impossible) |
| A70 | production_tech_events.200 · `:239–256` | "Plastic Production": half the glassworks on houseware plastics, level ≥ 5 (plastics +6,000 to a neighbour) | **glass t3**: one level-5 plastics glassworks, the share clause dropped ((F) 1); the immediate's random glassworks → a t3 building | ERA | `e3` (by block) + `snippet` |
| A71 | production_tech_events.210 · `:329–344` | "Radio Production": half the electrics plants on radios | the method `pm_radios_electrics` (electrics single rung). The immediate saving a random GLASSWORKS is a vanilla copy-paste slip — any rung, harmless | METHOD | `method` |
| A72 | production_tech_events.300 · `:414–442` | telephone: electrics level ≥ 5 (option b loses its scope untransformed) | the electrics building itself (its main method is telephones) | METHOD | `method` |
| A73 | production_tech_events.501 · `:762–879` | "Railroad Boom": locomotive builders benefit | motor of any rung (steam, electric and diesel locomotives) | ANY | `all` |
| A74 | production_tech_events.700 · `:1065,1105` | "The Engines of Progress": "the manufacture of **steam engines** has become profitable … locomotive technology" | **motor t1 only** — rung 0 IS steam engines, so the untransformed line is right | LEAVE | `keep` (by block) |
| A75 | society_tech_events.104 · `tech_events/society_tech_events.txt:8,11` | "Rising to New Heights": elevators and arcades need steel and plate glass | steel any rung; glass non-craft (t1+) — forest glass is not arcade glass | ANY / ANY−C | `all` / `nc` (glass, by block) |
| A76 | society_tech_events.302 · `:219–228` | "Isn't It Romantic?" (realism +3,500) | **t0** | ERA | `all` + `method` |
| A77 | dt_society_events.2 · `:447–460` (+ `b:building_art_academy.level`, `:452`) | "The Realist Movement" (camera +4,150) | **t1**; states ordered by their realist-rung levels | ERA | `all` + `method` + `snippet` (`order_by`) |
| A78 | war_crimes.2 · `tech_events/war_crimes_events.txt:143,154` | "Dealing in Arms": an established munition plant level ≥ 5 (rifling +3,500) | munition of any rung | ANY | `all` |

#### A-g. Building-GROUP lines whose meaning the crafts change (appendix C, the 9 lines)

| # | Where | About | Ruled | Built |
|---|---|---|---|---|
| G1 | vernacular Aragonese / Asturleonese / Francoprovençal / Occitan manufacturing branch · `06_vernacular_buttons.txt:137,210,449,618` (`bg_light_industry` level ≥ 5 / 6 / 10 / 8 on ONE building, with the MANUFACTURING decree) | the homeland is an industrial region | crafts out — a 5-level craft is 2,500 workers against vanilla's 25,000, and Spain starts with textile and paper crafts, so untransformed these are near-free | `snippet`: `NOT = { is_building_group = bg_pmr_crafts }` beside the group test |
| G2 | fra_weekly_pulse_orleanist_progress · `00_victoria_scripted_effects.txt:2264` | July-Monarchy progress from Σ levels of profitable manufacturing ÷ 100 | crafts out; France starts with no craft, so the 1836 anchor is untouched and only later cheap crafts are kept from inflating it | `snippet`, the same NOT |
| G3 | je_spa_economic_regeneration · `journal_entries/06_economic_regeneration.txt:449,481,538,589` (`state_has_building_group_levels bg_light_industry ≥ 16 / 7`) | Regeneracionismo: industrialise four states | crafts out ((F) 12) | `snippet`: `pmr_light_industry_levels_nc >= N`, a state script value summing non-craft light-industry levels — right whichever way the vanilla counter treats child groups |

---

### (B) Craft cases where the craft IS the right fit

R2.2's lean is to exclude crafts from vanilla "industry building" tests. These are the cases where the test is really about traditional,
small-scale or artisan production, or where excluding the craft would silence content in the very period it describes:

1. **A57 · economy_laws.6 "Industry Suffers" (free-trade enactment).** Foreign competition ruining domestic producers is the textbook artisan
   story (handloom weavers against imported cloth). Excluding the craft would silence the setback where a country has no other qualifying building
   (no shipyard, arms works or heavy industry — most small craft-only countries) and elsewhere move the "suffering state" from the craft region to a
   factory state. **Ruled: crafts count** ((F) 2).
2. **A21 · the Serbian slander button.** Printing propaganda imagery needs paper, not a paper factory; mass communication is a game-era-1
   technology, while the first non-craft paper rung needs mechanical_tools (game era 2), so excluding the craft would push the button decades past
   the dynastic struggle it belongs to. **Ruled: any paper rung, the craft included** ((F) 3).
3. **A23 · the Occitan button, agricultural branch.** An agrarian wine-and-food region, so artisanal food processing fits — but a craft at level 3 is
   1,500 workers. **Ruled: food factory rungs only, at level 3** ((F) 4).
4. **A43 · Belle Époque haute couture, option b,** and its modifier `modifier_haute_couture_competition` (D33). Couture is handwork and vanilla's
   mill included handsewn clothes, but the mod's craft carries no luxury-clothing line, so the bonus would boost plain artisan clothes. **Ruled: textile
   factory rungs only** ((F) 5).
5. **D47 · `japan_calendar_clockwork_administration_mod`** (−10% food industry after the 1873 calendar reform): a malus on traditional, season-bound
   production; Japan's food sector at that date is the craft (83 craft levels, no factory rung at 1836). **Ruled: every food rung, the craft included.**

Checked and found NOT to fit the craft (crafts out): A51 dyeworks ("industrial-sized tub"), A50 garment-factory fire, A64 "Man Over Machine" (the
craft is the man), A62/A63 factory strikes and company stores, A46 "Industrial Boom", A75 arcade glass, A2 the dye/silk/hardwood stances (crafts
consume none), G1–G3.

**What excluding crafts costs elsewhere** (everything involving the six craft industries):
- 1836–1860s content in countries whose light industry is crafts waits until they build a t1 rung: the dyeworks accident (only GBR FRA USA PRU NET BEL
  qualify at the start, against 48 textile holders untransformed), the Industrial Boom decree events in craft-only states, the AI's dye, silk and
  hardwood stances. None is a research boost or a journal entry; the dyeworks accident is a one-off per country.
- The revolution and election callers (A62–A64) fire only in civil wars or election campaigns with intensive agriculture researched — mid-century on,
  when most such countries hold t1 rungs or heavy industry; .4 also accepts raw industries.
- No research boost is lost: every dead research boost (the art chain, repeaters, plastics, radio) concerns non-craft rungs.

---

### (C) Cases where "any rung" is wrong, and why

| # | Rungs | Why not any rung |
|---|---|---|
| A5, A76 | art **t0** | Romanticism is the traditional-art method; the journal entry fails once realism exists |
| A54 | art **t0** | ukiyo-e is traditional art; a film academy making woodblock prints is nonsense |
| A6, A77 | art **t1** | "Patronise Realist Art" / "The Realist Movement" |
| A7, A65 | art **t2** | "Establish the Photographic Arts" |
| A8, A66 | art **t3** | "Establish the Film Arts" |
| A9 | art **t2+** | Belle Époque needs a MODERN art scene (vanilla: photographic or film) |
| A41 | art **t0–t2** | "Cinema has no commercial future" → traditional arts, i.e. not film |
| A67 | arms **t1+** | "the change from smoothbore muskets to rifles" — a musket works is exactly what it is not about |
| A70 | glass **t3** | "the switch to plastic in our Glassworks" |
| A74 | motor **t1 only** (LEAVE) | "the manufacture of steam engines … locomotive technology" — vanilla never checked the method because only one existed |
| A50 | textile **t2+** | a garment factory with mechanised looms (Triangle Shirtwaist); dye workshops carry no looms |
| A51 | textile **t1+** | "an industrial-sized tub of hot dye" — the dye-workshop rung is the fit, the craft is not |
| A14, A31, A52, A59, A61 | food rungs **running a still** (t1 host) | liquor production; the craft cannot distil (it carries no distillery line) |
| A25, A26, A53, A58 | **the mechanised secondary itself** | mechanisation, boilers: a rung without the method is not mechanised whatever its tier (steel t0 carries watertube boilers; the textile dye-workshop rung carries no looms) |
| A10 | **craftsman sewing** (textile t1+) | a fashion trade |
| A2 | textile t1+ (dye, silk), furniture t1+ (hardwood) | the stance exists to feed rungs that consume those goods; the crafts consume none |
| A34 | **highest rung held** | an IG demanding "more arms" in 1900 wants modern arms; any-rung would let the pick land on muskets |
| A17 | **every rung, removed** | a demolition effect: all rungs, not "any" — and explosives stay out as in vanilla |

---

### (D) Throughput modifiers — which rungs each bonus reaches

Default when nothing narrower is argued: **every rung of the industry, crafts included** — vanilla's single building ran every method including the
handicraft one, and a throughput bonus on a 500-worker craft is harmless. Narrowing applies where the reward is for a technology or practice, or
where a malus hits something specific; every bonus on a craft industry was ruled row by row ((F) 9). The six missing modifier types (glass t1–t3,
explosives t1–t3) are declared by the emitter (§1). "Built" is the line's `tp` rule; blank = every rung.

| # | Modifier · file:line | Bonus · source | Rungs (ruled) | Built |
|---|---|---|---|---|
| D1 | amendment_degenerate_art · `amendments/00_amendments_enactment_04.txt:688` | −10% art, the degenerate-art amendment | all rungs | |
| D2–4 | principle_military_industry_1/2/3 · `power_bloc_principles/00_power_bloc_principles.txt:902–904, 947–949, 967–969` | +10% arms, artillery, automotive (+ shipyards) for bloc members | **all rungs of arms, artillery and automotive** — a principle a player chooses must reach the arsenal they actually run. Munition is not in vanilla's list; not added | |
| D5 | modifier_ukiyo_e_production · `static_modifiers/00_ep2_03_modifiers.txt:25` | +5% art, state, "Woodblock Print Production" (A54) | **t0** (traditional art) | file ACCEPTED |
| D6 | modifier_budapest_paris_of_the_east · `00_ip3_02_modifiers.txt:215` | +10% art | all | |
| D7 | modifier_ottonian_renaissance · `00_ip3_02_modifiers.txt:388` | +10% art | all | |
| D8 | cultural_exchange_art · `00_ip3_03_modifiers.txt:161` | +25% art per academy state, Japonisme (A37) | all | |
| D9 | kaiserforum_loc_efforts · `00_ip3_03_modifiers.txt:230` | +25% art, "Ringstrasse Reimagined" | all | |
| D10 | modifier_kunsthistorisches · `00_ip3_03_modifiers.txt:240` | +10% art | all | |
| D11 | modifier_national_awakening_domestic_works · `00_ip3_04_modifiers.txt:210` | +10% art, "Vernacular Publishing" | all | |
| D12–13 | metternich_modifier_t2 / t4 · `00_ip3_04_modifiers.txt:342,359` | +5% art each, "Legacy of Metternich" | all | |
| D14 | sagrada_familia_construction · `00_ip4_03_modifiers.txt:140` | +5% art | all | |
| D15 | modifier_portugal_education_reforms · `00_ip4_04_modifiers.txt:306` | +15% art | all | |
| D16 | modifier_bg_diminished_rum_production · `02_event_modifiers.txt:512` | **−50% food**, state, after the molasses flood (A52) | **food t1+** (the distilling host) — a rum-tank disaster should not halve the state's bakeries | `nc` |
| D17 | automobile_regulations · `02_event_modifiers.txt:1254` | −10% MOTOR industry, "Unregulated Automobiles" (combustion engine) | all motor rungs (vanilla's own odd target — engine makers, not car plants — kept) | |
| D18 | plastic_production_modifier · `02_event_modifiers.txt:1515` | +33% glass, reward of A70 | **glass t3** (plastics) — the event requires the plastics rung, so the reward reaches it; boosting the forest-glass craft is the anti-design case | `e3` |
| D19 | dynamite_production_modifier · `02_event_modifiers.txt:1525` | +33% explosives, "Exploding Demand" option a ("increasing supply will lift all boats") | **every explosives rung** ((F) 6) — the event is about supply against a demand spike and does not require the dynamite rung | |
| D20 | munitions_production_modifier · `02_event_modifiers.txt:1538` | +33% munition, A68 option c | all | |
| D21 | motor_industry_production_modifier · `02_event_modifiers.txt:1543` | +33% motor, from A69 (dead in vanilla) | moot; all motor rungs | |
| D22 | engine_production_modifier · `02_event_modifiers.txt:1553` | +33% motor, "Railroad Boom" option b (locomotive builders) | all motor rungs | |
| D23 | electrics_building_modifier · `02_event_modifiers.txt:1563` | electrics, single rung | unchanged | not a tiered key |
| D24 | elevator_goods_production_modifier · `02_event_modifiers.txt:1720–1721` | +20% steel and glass (A75) | steel all; **glass t1+** (crafts out, consistent with A75) | `nc` (glass) |
| D25 | realist_art · `02_event_modifiers.txt:1746` | +15% art, "Supporting the Realist Movement" (A77) | **t1** | `e1` |
| D26 | romantic_building_modifier · `02_event_modifiers.txt:1757` | +20% art, state, "Romantic Architecture" (A76) | **t0** | `keep` |
| D27 | krakatoa_art_modifier · `104_modifiers.txt:636` | +15% art, state (A55) | all | |
| D28 | art_nouveau_strike_modifier · `104_modifiers.txt:794` | −50% art, state, an academy strike | all | |
| D29 | art_nouveau_love_modifier · `104_modifiers.txt:799` | +20% art (A39) | all | |
| D30 | free_arts · `105_modifiers.txt:176` | +10% art (liberalism) | all | |
| D31 | banned_degenerate_art · `105_modifiers.txt:284` | −10% art | **no vanilla user** — no action | `keep` |
| D32 | modifier_film_industry_bonus · `agitators_4_modifiers.txt:713` | electrics, single rung | unchanged | not a tiered key |
| D33 | modifier_haute_couture_competition · `agitators_4_modifiers.txt:772` | +25% textile, state (A43) | **textile factory rungs only** ((F) 5) | `nc` |
| D34 | modifier_trad_arts_bonus · `agitators_4_modifiers.txt:788` | +10% art, "Supported Traditional Arts" (A41) | **t0–t2** (not film) | `e0_e2` |
| D35–36 | modifier_fin_de_sicle / _more · `agitators_4_modifiers.txt:804,810` | +10% / +25% art | all | |
| D37 | modifier_intelligentsia_plan · `agitators_4_revolution_modifiers.txt:487` | +10% paper, "the government will run its own presses" | **every paper rung, the craft included** | |
| D38 | amazon_theatre · `brazil_2_modifiers.txt:214` | +10% art, state (A44) | all | |
| D39 | ybycui_steelworks · `brazil_2_modifiers.txt:299` | +10% steel, state (A20) | all | |
| D40 | steam_engine_production · `content_1_modifiers.txt:1072` | +15% motor, "Steam Engine Time" (A74 option b) | **motor t1 only** — rung 0 | `keep` |
| D41 | munitions_modifier · `content_1_modifiers.txt:1267` | +15% munition, state, "Munitions Mania" (A78) | all | |
| D42 | high_distribution_news_cycle · `content_2_modifiers.txt:515` | +20% paper, an election news cycle | **paper t1+** (mass newsprint is the wood-pulp revolution) | `nc` |
| D43 | wartime_production_act · `content_3_modifiers.txt:438–439` | +20% arms and artillery | **no vanilla user** — no action | `keep` |
| D44 | modern_rifle_arsenal · `content_3_modifiers.txt:455–456` | +20% arms and artillery in the arsenal state, A67 option a | **every arms and artillery rung in the state**, as in vanilla ((F) 7); the event's own trigger still wants a rifle rung or newer (A67) | |
| D45 | arsenal_proving_ground · `content_3_modifiers.txt:462–463` | +5% arms and artillery, A67 option b | the same as D44 ((F) 7) | |
| D46 | modifier_second_crusade_against_manchu · `content_4_modifiers.txt:358–359` | +15% arms and artillery (Taiping) | all | |
| D47 | japan_calendar_clockwork_administration_mod · `japan_single_fire_events_modifiers.txt:56` | −10% food, country, the 1873 calendar reform | **every food rung, the craft included** ((B) 5) | |
| D48 | mon_many_guns · `montenegrin_modifiers.txt:360` | +50% arms, "Make lots of guns" (A18) | all | |
| D49 | modifier_reliable_supply · `montenegrin_modifiers.txt:402` | +20% arms, reward of A15 | all | |

---

### (E) Subsidies in AI strategies — removed (R2.3)

| Strategy · vanilla file:line | Entry | Untransformed |
|---|---|---|
| ai_strategy_resource_expansion · `01_admin_strategies.txt:210` | `building_tooling_workshop = nice_to_have` | subsidises the **crude-tools CRAFT** (t0) only; the pig-iron, steel and rubber-grip workshops get nothing. 10 countries hold a tooling craft at 1836 (Russia, Japan, Mexico, Brazil …) |
| ai_strategy_resource_expansion · `:211` | `building_explosives_factory = nice_to_have` | subsidises the **Leblanc** rung (t0) only |
| ai_strategy_colonial_extraction · `:574` | `building_tooling_workshop = wants_to_have` | the crude-tools craft only |

Extending them to the factory rungs was rejected ("for now we don't mandate subsidies, except for infrastructure"), and vanilla's own entries were
ruled out too ("remove crude-tool craft and Leblanc shouldn't be subsidised either"). The canon's `building_subsidies` sets both keys to `none`
(beside the dams' `must_have`); `build.ps1` writes `01_admin_strategies.txt` from it, and the built file names neither key. Vanilla's intent (tools and
explosives for the mines) is left to the market.

---

### (F) The judgement calls and their rulings (2026-10-21, the user)

1. **The percent clauses** — je_realism (`percent = 1` of academies realist), je_camera and je_film (> 75%), production_tech_events.200 (≥ 50% of
   glassworks on plastics). Vanilla switches a building's method; in the mod the old rung is a separate building, so these would demand that every old
   academy or glassworks be demolished (glass sheds its old rung least of all — F136 — and the glass craft sits in the denominator). Options were
   (a) keep the percent over buildings of all rungs, (b) count the share of LEVELS on the target rung or newer, (c) drop the percent. **Ruled (c):**
   "drop the share; one building of the right rung at the right level is enough". je_realism completes on one realist (t1) academy ≥ 90% staffed
   (vanilla's own clause; it has no level); je_camera / je_film on one level-5 academy of their rung (t2 / t3); production_tech_events.200 on one
   level-5 plastics (t3) glassworks. The percent clauses and their occupancy lines go. (Noted 2026-10-29 in the changelog pass: the emitted
   production_tech_events.200 also drops vanilla's `weekly_profit > 10`, `cash_reserves_ratio > 0.25` and `weekly_profit > 0`, so one level-5
   plastics glassworks fires it whatever its profit; the ruling did not name those clauses.)
2. **Crafts in economy_laws.6 "Industry Suffers"** ((B) 1). **Ruled:** crafts count, beside every factory rung.
3. **Crafts in the Serbian slander button** ((B) 2). **Ruled:** any paper rung, the craft and every industrial rung.
4. **The Occitan agricultural branch** ((B) 3). **Ruled:** food factory rungs only, at level 3; the craft does not count.
5. **Haute couture** (A43 option b and D33). **Ruled:** textile factory rungs only; the craft does not count.
6. **dynamite_production_modifier** (D19): all explosives rungs, or t2+ (the rung dynamite unlocks). **Ruled:** every explosives rung.
7. **modern_rifle_arsenal / arsenal_proving_ground** (D44–45): t1+ or all rungs. **Ruled:** every arms and artillery rung in the state, as in
   vanilla. The event's own trigger still looks for a rifle rung or newer (A67).
8. **The Industrial Boom decree events** (A46). **Ruled:** factory rungs only, crafts do not count; vanilla's list kept otherwise, the artillery
   foundry still left out.
9. **The default for throughput modifiers on crafts.** **Resolved row by row** instead of by a default: D16 / D24 / D42 factory rungs only, D37
   every paper rung including the craft, D33 factory rungs only, D47 every food rung including the craft; the rest of table D concerns industries
   without a craft.
10. **The shared light-industry trigger** (A28): its callers want different answers (A57 crafts in, A62–A64 crafts out), so it takes two answers —
    `has_industry_building` keeps every rung, `is_industry_building` takes the non-craft rungs. Follows from (F) 2 and rows A62–A64.
11. **Montenegro's "first arms factory"** (A18): fix through the code on_actions file (7,963 lines) or accept the narrow line. **Ruled:** neither —
    our own additive monthly check fires `mon_state_formation.13` when Montenegro has an active arms building of any rung (the user: "OK to go with
    your recommendation"). It carries `has_dlc_feature = ip3_content` explicitly (the event is `dlc = dlc014`, National Awakening), beside the
    event's own gate; vanilla's check in `00_code_on_actions.txt` stays untouched.
12. **The Spanish regeneration journal entry** (G3): whether `state_has_building_group_levels` counts the craft child group was never verified.
    Built crafts out (R2.2's lean) through the state script value `pmr_light_industry_levels_nc`, which is right whichever way the vanilla counter
    treats child groups.

---

# Appendices — the line catalogue (game 1.13.11)

What a re-audit after a patch compares against: every vanilla line of the patterns in §0, with its block, its PART 2 row and what it does in the mod
untransformed. Russian loc and graphics are listed in appendix F only.

## Appendix A — every (a) key and (b) main-method line (355 lines in 48 files)

| File | Block | Row | Untransformed | Lines (token) |
|---|---|---|---|---|
| common/achievements/mp1_charters_of_commerce_achievements.txt | achievement_systembolaget | A1 | COSMETIC | `building_food_industry` 146 |
| common/ai_strategies/00_default_strategy.txt | ai_strategy_default | A2 | NARROW+CRAFT | `building_textile_mill` 5033, 5040 · `building_furniture_manufactory` 5047 |
| common/ai_strategies/01_admin_strategies.txt | ai_strategy_resource_expansion | A3 | SHIFT (props up the craft / t0) | `building_tooling_workshop` 210 · `building_explosives_factory` 211 |
| common/ai_strategies/01_admin_strategies.txt | ai_strategy_colonial_extraction | A3 | SHIFT (props up the craft) | `building_tooling_workshop` 574 |
| common/decisions/grand_exhibition_decision.txt | grand_exhibition_decision | A4 | NARROW | `building_art_academy` 13 |
| common/journal_entries/00_art_jes.txt | je_romanticism | A5 | DEAD (complete) | `building_art_academy` 27 · `pm_traditional_art` (main method) 28 |
| common/journal_entries/00_art_jes.txt | je_realism | A6 | DEAD (complete) / NARROW (possible) | `building_art_academy` 63, 70 · `pm_realist_art` (main method) 73 |
| common/journal_entries/00_art_jes.txt | je_camera | A7 | DEAD (complete) / NARROW (possible) | `building_art_academy` 103, 110, 116 · `pm_photographic_art` (main method) 112, 119 |
| common/journal_entries/00_art_jes.txt | je_film | A8 | DEAD (complete) / NARROW (possible) | `building_art_academy` 150, 157, 163 · `pm_film_art` (main method) 159, 166 |
| common/journal_entries/00_belle_epoque.txt | je_belle_epoque | A9 | DEAD (possible) | `building_art_academy` 40 · `pm_photographic_art` (main method) 43 · `pm_film_art` (main method) 44 |
| common/journal_entries/00_liberalism.txt | je_liberalism_3 | A11 | NARROW | `building_art_academy` 137 |
| common/journal_entries/00_player_objectives_economic_dominance.txt | je_refining_goods | A12 | NARROW | `building_steel_mill` 73, 82 |
| common/journal_entries/00_player_objectives_economic_dominance.txt | je_specialized_goods | A13 | NARROW | `building_motor_industry` 103, 112 |
| common/journal_entries/00_prohibition_laws.txt | je_prohibition | A14 | DEAD (possible) | `building_food_industry` 30 |
| common/journal_entries/00_trade_route_event_missions.txt | je_build_local_arms_industry | A15 | NARROW | `building_arms_industry` 8 |
| common/journal_entries/03_russia.txt | je_great_reforms_military | A16 | NARROW (mild) | `building_munition_plant` 1277 |
| common/laws/01_economic_system.txt | law_industry_banned | A17 | NARROW (effect misses rungs 1-3) | `building_chemical_plant` 263, 265 · `building_synthetics_plant` 269, 271 · `building_steel_mill` 275, 277 · `building_motor_industry` 287, 289 · `building_automotive_industry` 293, 295 · `building_electrics_industry` 299, 301 · `building_munition_plant` 305, 307 |
| common/laws/01_economic_system.txt | law_extraction_economy | A17 | NARROW (effect misses rungs 1-3) | `building_chemical_plant` 379, 381 · `building_synthetics_plant` 385, 387 · `building_steel_mill` 391, 393 · `building_motor_industry` 397, 399 · `building_automotive_industry` 403, 405 · `building_electrics_industry` 409, 411 · `building_munition_plant` 415, 417 |
| common/on_actions/00_code_on_actions.txt | on_monthly_pulse_country | A18 | NARROW | `building_arms_industry` 958 |
| common/scripted_buttons/00_balkan_wars_buttons.txt | je_the_balkan_league_overwork_arms_industries_start_button | A19 | NARROW | `building_arms_industry` 187, 213 · `building_artillery_foundry` 188, 214 · `building_munition_plant` 189, 215 |
| common/scripted_buttons/03_paraguay_scripted_buttons.txt | ybycui_iron_works_button | A20 | NARROW (+ may create a 2nd steel building) | `building_arms_industry` 69 · `building_steel_mill` 98, 103 |
| common/scripted_buttons/05_serbia_buttons.txt | je_tot_slander_button | A21 | NARROW+CRAFT | `building_paper_mill` 15 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_catalan_button | A22 | NARROW | `building_art_academy` 50, 67 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_galician_button | A22 | NARROW | `building_art_academy` 293 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_breton_button | A22 | NARROW | `building_art_academy` 558 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_occitan_button | A23 | NARROW+CRAFT | `building_food_industry` 634 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_wallonian_button | A24 | NARROW | `building_steel_mill` 694 |
| common/scripted_effects/00_scripted_effects.txt | save_industrialized_pm_building_and_state | A25 | DEAD | `building_textile_mill` 80, 84, 88 · `building_furniture_manufactory` 95, 99, 103, 107, 111 · `pm_mechanized_workshops` (main method) 100 · `building_tooling_workshop` 118, 122, 126, 130 · `building_paper_mill` 137, 141, 145 · `building_steel_mill` 152, 156, 160 · `building_motor_industry` 167, 171, 175 |
| common/scripted_effects/00_victoria_scripted_effects.txt | calculate_national_identity_progress | A33 | NARROW | `building_art_academy` 3004 |
| common/scripted_effects/04_negotiation_scripted_effects.txt | set_promised_building_type | A34 | SHIFT (promises the obsolete rung) | `building_art_academy` 461, 467 · `building_artillery_foundry` 601, 607 · `building_munition_plant` 612, 618 · `building_arms_industry` 623, 629 |
| common/scripted_triggers/00_gfx_route_graphics_triggers.txt | gfx_mining_train_trigger | A32 | COSMETIC | `building_steel_mill` 128 |
| common/scripted_triggers/00_scripted_triggers.txt | has_industrialized_pm | A25 | DEAD | `building_textile_mill` 145, 149 · `building_furniture_manufactory` 155, 159, 163, 167 · `pm_mechanized_workshops` (main method) 156 · `building_tooling_workshop` 173, 177, 181 · `building_paper_mill` 187, 191 · `building_steel_mill` 197, 201 · `building_motor_industry` 207, 211 |
| common/scripted_triggers/00_scripted_triggers.txt | using_watertube_boiler | A26 | DEAD | `building_furniture_manufactory` 220, 222 · `building_tooling_workshop` 227, 229, 255, 257 · `building_paper_mill` 234, 236 · `building_steel_mill` 241, 243 · `building_motor_industry` 248, 250 |
| common/scripted_triggers/00_scripted_triggers.txt | has_government_building | A27 | UNUSED (no vanilla caller) | `building_art_academy` 440 |
| common/scripted_triggers/00_scripted_triggers.txt | has_industry_building | A28 | NARROW+CRAFT | `building_food_industry` 453 · `building_textile_mill` 454 · `building_furniture_manufactory` 455 · `building_glassworks` 456 · `building_tooling_workshop` 457 · `building_paper_mill` 458 |
| common/scripted_triggers/00_scripted_triggers.txt | is_industry_building | A28 | NARROW+CRAFT | `building_food_industry` 464 · `building_textile_mill` 465 · `building_furniture_manufactory` 466 · `building_glassworks` 467 · `building_tooling_workshop` 468 · `building_paper_mill` 469 |
| common/scripted_triggers/00_scripted_triggers.txt | has_heavy_industry_building | A29 | NARROW | `building_chemical_plant` 475 · `building_synthetics_plant` 476 · `building_steel_mill` 477 · `building_motor_industry` 478 · `building_automotive_industry` 479 · `building_electrics_industry` 480 · `building_munition_plant` 481 |
| common/scripted_triggers/00_scripted_triggers.txt | is_heavy_industry_building | A29 | NARROW | `building_chemical_plant` 488 · `building_synthetics_plant` 489 · `building_steel_mill` 490 · `building_motor_industry` 491 · `building_automotive_industry` 492 · `building_electrics_industry` 493 · `building_munition_plant` 494 |
| common/scripted_triggers/00_scripted_triggers.txt | is_production_building | A30 | UNUSED (no vanilla caller) | `building_food_industry` 837 · `building_textile_mill` 838 · `building_furniture_manufactory` 839 · `building_glassworks` 840 · `building_tooling_workshop` 841 · `building_paper_mill` 842 · `building_chemical_plant` 843 · `building_synthetics_plant` 844 · `building_steel_mill` 845 · `building_motor_industry` 846 · `building_electrics_industry` 848 · `building_automotive_industry` 849 · `building_arms_industry` 850 · `building_artillery_foundry` 851 · `building_munition_plant` 852 |
| events/agitators_events/land_ownership_law_events.txt | land_ownership_law_events.12 | A35 | OK (builds the t0 rung - thematic) | `building_steel_mill` 1577 |
| events/assassination_events.txt | assassination_events.4 | A36 | NARROW | `building_art_academy` 287, 304 |
| events/balkans_events/03_ip3_austria_events.txt | austria_events.33 | A37 | NARROW | `building_art_academy` 433 |
| events/balkans_events/03_ip3_austria_events.txt | austria_events.34 | A37 | NARROW | `building_art_academy` 558 |
| events/balkans_events/montenegro_events.txt | mon_state_formation.13 | A18 | NARROW | `building_arms_industry` 1859, 1866, 1875, 1877 |
| events/balkans_events/national_awakening.txt | national_awakening.5 | A38 | NARROW | `building_art_academy` 368, 387, 392 |
| events/belle_epoque_events.txt | belle_epoque_events.2 | A39 | NARROW | `building_art_academy` 135, 151 |
| events/belle_epoque_events.txt | belle_epoque_events.3 | A40 | NARROW | `building_art_academy` 280, 287 |
| events/belle_epoque_events.txt | belle_epoque_events.6 | A41 | OK (electrics, 1 rung) / NARROW (art academy) | `building_electrics_industry` 602, 610 · `building_art_academy` 631, 636 |
| events/belle_epoque_events.txt | belle_epoque_events.8 | A42 | NARROW | `building_automotive_industry` 781 |
| events/belle_epoque_events.txt | belle_epoque_events.14 | A43 | NARROW+CRAFT (option) ; launcher DEAD (secondary PM) | `building_textile_mill` 1418 |
| events/brazil/amazonas.txt | amazonas.5 | A44 | OK (creates t0; may duplicate) | `building_art_academy` 420, 425 |
| events/brazil/paraguay.txt | paraguay.3 | A20 | OK (creates t0; may duplicate) | `building_steel_mill` 355, 360 |
| events/decree_events.txt | decree_events.5 | A45 | NARROW | `building_art_academy` 498, 517 |
| events/decree_events_02.txt | decree_events.100 | A46 | NARROW+CRAFT | `building_food_industry` 29, 71 · `building_textile_mill` 30, 72 · `building_furniture_manufactory` 31, 73 · `building_glassworks` 32, 74 · `building_tooling_workshop` 33, 75 · `building_paper_mill` 34, 76 · `building_chemical_plant` 35, 77 · `building_explosives_factory` 36, 78 · `building_synthetics_plant` 37, 79 · `building_steel_mill` 38, 80 · `building_motor_industry` 39, 81 · `building_automotive_industry` 41, 83 · `building_electrics_industry` 42, 84 · `building_arms_industry` 43, 85 · `building_munition_plant` 44, 86 |
| events/decree_events_02.txt | decree_events.101 | A46 | NARROW+CRAFT | `building_food_industry` 150, 194 · `building_textile_mill` 151, 195 · `building_furniture_manufactory` 152, 196 · `building_glassworks` 153, 197 · `building_tooling_workshop` 154, 198 · `building_paper_mill` 155, 199 · `building_chemical_plant` 156, 200 · `building_explosives_factory` 157, 201 · `building_synthetics_plant` 158, 202 · `building_steel_mill` 159, 203 · `building_motor_industry` 160, 204 · `building_automotive_industry` 162, 206 · `building_electrics_industry` 163, 207 · `building_arms_industry` 164, 208 · `building_munition_plant` 165, 209 |
| events/fascism_events.txt | fascism_events.8 | A47 | NARROW | `building_art_academy` 949, 1011, 1017 |
| events/iberia_events/ip4_anarchism_events.txt | anarchism_events.3 | A48 | NARROW | `building_art_academy` 379 |
| events/ig_suppression_events.txt | ig_suppression_events.1000 | A49 | NARROW | `building_art_academy` 853 |
| events/industrial_accidents_events.txt | industrial_accident_events.1 | A50 | SHIFT (fires on crafts) | `building_textile_mill` 53, 56, 97, 100 |
| events/industrial_accidents_events.txt | industrial_accident_events.2 | A51 | NARROW+CRAFT | `building_textile_mill` 169, 184 |
| events/industrial_accidents_events.txt | industrial_accident_events.4 | A52 | DEAD | `building_food_industry` 327, 330, 342, 345 |
| events/japan_events/ep2_japan_events_03.txt | japan_events.32 | A54 | DEAD | `building_art_academy` 157, 161, 173, 179 · `pm_traditional_art` (main method) 158, 174 |
| events/krakatoa_events.txt | krakatoa.4 | A55 | NARROW | `building_art_academy` 683, 696, 701 |
| events/law_events/citizenship_laws.txt | citizenship_laws.2 | A56 | NARROW | `building_art_academy` 142, 175 |
| events/law_events/economy_laws.txt | economy_laws.6 | A57 | NARROW | `building_arms_industry` 444, 455 |
| events/liberalism.txt | liberalism.1 | A11 | NARROW | `building_art_academy` 71, 122, 166 |
| events/pm_events.txt | pm_events.3 | A59 | DEAD | `building_food_industry` 181, 185, 207, 211 |
| events/pm_events.txt | pm_events.4 | A60 | NARROW | `building_arms_industry` 316, 325 |
| events/tech_events/camera_film_pm_events.txt | camera_film_pm_events.1 | A65 | DEAD (chained from je_camera) | `building_art_academy` 31 · `pm_photographic_art` (main method) 32 |
| events/tech_events/camera_film_pm_events.txt | camera_film_pm_events.2 | A66 | DEAD (chained from je_film) | `building_art_academy` 94 · `pm_film_art` (main method) 95 |
| events/tech_events/military_tech_events.txt | military_tech_events.401 | A67 | DEAD | `building_arms_industry` 27, 43, 56 · `pm_rifles` (main method) 31, 47, 60 · `pm_repeaters` (main method) 32, 48, 61 · `pm_bolt_action_rifles` (main method) 33, 49, 62 |
| events/tech_events/production_tech_events.txt | production_tech_events.102 | A68 | NARROW | `building_munition_plant` 83 · `building_explosives_factory` 91 |
| events/tech_events/production_tech_events.txt | production_tech_events.103 | A69 | VANILLA-DEAD (motor + automobile PM) | `building_motor_industry` 167 · `pm_automobile_production` (main method) 170 |
| events/tech_events/production_tech_events.txt | production_tech_events.200 | A70 | DEAD | `building_glassworks` 239, 256 · `pm_houseware_plastics` (main method) 249 |
| events/tech_events/production_tech_events.txt | production_tech_events.210 | A71 | DEAD (secondary pm_radios renamed) | `building_electrics_industry` 329 · `building_glassworks` 344 |
| events/tech_events/production_tech_events.txt | production_tech_events.300 | A72 | OK trigger / SHIFT (option b loses its scope) | `building_electrics_industry` 414, 428, 438 · `pm_telephones` (main method) 432, 442 |
| events/tech_events/production_tech_events.txt | production_tech_events.501 | A73 | NARROW | `building_motor_industry` 762, 840, 845, 879 |
| events/tech_events/production_tech_events.txt | production_tech_events.700 | A74 | NARROW | `building_motor_industry` 1065, 1105 |
| events/tech_events/society_tech_events.txt | society_tech_events.104 | A75 | NARROW+CRAFT | `building_steel_mill` 8 · `building_glassworks` 11 |
| events/tech_events/society_tech_events.txt | society_tech_events.302 | A76 | DEAD (chained from je_romanticism) | `building_art_academy` 219, 227 · `pm_traditional_art` (main method) 228 |
| events/tech_events/society_tech_events.txt | dt_society_events.2 | A77 | DEAD (chained from je_realism) | `building_art_academy` 447, 458 · `pm_realist_art` (main method) 449, 460 · `b:building_art_academy.level` (b: link) 452 |
| events/tech_events/war_crimes_events.txt | war_crimes.2 | A78 | NARROW | `building_munition_plant` 143, 154 |
| events/trade_route_events.txt | trade_route_events.1 | A15 | SHIFT (fires for countries with modern arms) | `building_arms_industry` 25 |

## Appendix B — (b′) secondary-method lines (49 lines; all DEAD untransformed: the names were minted per industry)

| File | Block | Row | Lines (method) |
|---|---|---|---|
| common/journal_entries/00_belle_epoque.txt | the Belle Époque launcher | A10 | `pm_craftsman_sewing` 260 |
| common/scripted_effects/00_scripted_effects.txt | save_industrialized_pm_building_and_state | A25 | `pm_mechanized_looms` 85 · `pm_automatic_power_looms` 89 · `pm_watertube_boiler_building_furniture_manufactory` 104 · `pm_rotary_valve_engine_building_furniture_manufactory` 108 · `pm_assembly_lines_building_furniture_manufactory` 112 · `pm_watertube_boiler_building_tooling_workshop` 123 · `pm_rotary_valve_engine_building_tooling_workshop` 127 · `pm_assembly_lines_building_tooling_workshop` 131 · `pm_watertube_boiler_building_paper_mill` 142 · `pm_rotary_valve_engine_building_paper_mill` 146 · `pm_watertube_boiler_building_steel_mill` 157 · `pm_rotary_valve_engine_building_steel_mill` 161 · `pm_watertube_boiler_building_motor_industry` 172 · `pm_rotary_valve_engine_building_motor_industry` 176 |
| common/scripted_triggers/00_scripted_triggers.txt | has_industrialized_pm | A25 | `pm_mechanized_looms` 146 · `pm_automatic_power_looms` 150 · `pm_watertube_boiler_building_furniture_manufactory` 160 · `pm_rotary_valve_engine_building_furniture_manufactory` 164 · `pm_assembly_lines_building_furniture_manufactory` 168 · `pm_watertube_boiler_building_tooling_workshop` 174 · `pm_rotary_valve_engine_building_tooling_workshop` 178 · `pm_assembly_lines_building_tooling_workshop` 182 · `pm_watertube_boiler_building_paper_mill` 188 · `pm_rotary_valve_engine_building_paper_mill` 192 · `pm_watertube_boiler_building_steel_mill` 198 · `pm_rotary_valve_engine_building_steel_mill` 202 · `pm_watertube_boiler_building_motor_industry` 208 · `pm_rotary_valve_engine_building_motor_industry` 212 |
| common/scripted_triggers/00_scripted_triggers.txt | using_watertube_boiler | A26 | `pm_watertube_boiler_building_furniture_manufactory` 223 · `pm_watertube_boiler_building_tooling_workshop` 230, 258 · `pm_watertube_boiler_building_paper_mill` 237 · `pm_watertube_boiler_building_steel_mill` 244 · `pm_watertube_boiler_building_motor_industry` 251 |
| common/scripted_triggers/00_scripted_triggers.txt | has_distillery / is_distillery | A31 | `pm_pot_stills` 936, 944 · `pm_patent_stills` 937, 945 |
| events/belle_epoque_events.txt | belle_epoque_events.14 trigger | A10 | `pm_craftsman_sewing` 1375 |
| events/industrial_accidents_events.txt | industrial_accident_events.1 | A50 | `pm_traditional_looms` 57, 101 |
| events/industrial_accidents_events.txt | industrial_accident_events.4 | A52 | `pm_disabled_distillery` 331, 346 |
| events/pm_events.txt | pm_events.3 | A59 | `pm_pot_stills` 182, 208 · `pm_patent_stills` 186, 212 |
| events/tech_events/production_tech_events.txt | production_tech_events.210 | A71 | `pm_radios` 337 |

The `has_active_production_method` form is used at 00_belle_epoque 260, 00_scripted_triggers 936–945, belle_epoque_events 1375 and
production_tech_events 337; every other line is the `production_method =` field of an `is_production_method_active` pair.
`pm_disabled_distillery` keeps its vanilla name; the accident .4 test fails because the craft runs nothing else.

## Appendix C — building-group lines (c) (79 lines in 20 files)

| File | Block | Verdict | Lines (text) |
|---|---|---|---|
| common/ai_strategies/01_admin_strategies.txt | ai_strategy_agricultural_expansion | OK (group matches children) | `bg_manufacturing = 0.5` 11 |
| common/ai_strategies/01_admin_strategies.txt | ai_strategy_plantation_economy | OK (group matches children) | `bg_manufacturing = 0.5` 136 |
| common/ai_strategies/01_admin_strategies.txt | ai_strategy_industrial_expansion | OK (group matches children) | `bg_manufacturing = 1.25` 341 |
| common/ai_strategies/01_admin_strategies.txt | ai_strategy_placate_population | OK (group matches children) | `bg_manufacturing = 0.25` 487 |
| common/ai_strategies/01_admin_strategies.txt | ai_strategy_montenegro_admin | OK (group matches children) | `bg_manufacturing = 0.5` 621 |
| common/ai_strategies/02_diplomatic_strategies.txt | ai_strategy_unify_germany | OK (group matches children) | `bg_military_industry = 1.5` 1509 |
| common/ai_strategies/02_diplomatic_strategies.txt | ai_strategy_prussia_of_the_balkans | OK (group matches children) | `bg_military_industry = 1.5` 3354 |
| common/ai_strategies/02_subject_diplomatic_strategies.txt | ai_strategy_subject_break_free | OK (group matches children) | `bg_military_industry = 1.5` 48 |
| common/ai_strategies/02_subject_diplomatic_strategies.txt | ai_strategy_subject_strengthen_self | OK (group matches children) | `bg_military_industry = 1.5` 224 |
| common/decrees/00_decree.txt | decree_encourage_manufacturing_industry | OK (group matches children) | `is_building_group = bg_manufacturing` 598, 606, 615 |
| common/ideologies/01_character_ideologies.txt | ideology_luddite | OK (group matches children) | `is_building_group = bg_heavy_industry` 6530, 6547, 6615, 6629 |
| common/interest_groups/00_armed_forces.txt | ig_armed_forces | OK (group matches children) | `pop_employment_building_group = bg_military_industry` 402 |
| common/interest_groups/00_intelligentsia.txt | ig_intelligentsia | OK (group matches children) | `pop_employment_building_group = bg_arts` 346 |
| common/interest_groups/00_petty_bourgeoisie.txt | ig_petty_bourgeoisie | OK (group matches children) | `pop_employment_building_group = bg_manufacturing` 260 |
| common/journal_entries/00_strike_je.txt | je_strike | OK (group matches children) | `pop_employment_building_group = bg_manufacturing` 55 |
| common/journal_entries/06_economic_regeneration.txt | je_spa_economic_regeneration_light_industry | SHIFT? (craft levels ×10, if group-level counters include child groups — unverified) → G3 | `type = bg_light_industry` 449, 481, 538, 589 |
| common/journal_entries/06_economic_regeneration.txt | je_spa_economic_regeneration_light_industry | OK (group matches children) | `type = bg_heavy_industry` 453, 485, 542, 593 · `type = bg_military_industry` 457, 489, 546, 597 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_aragonese_button | SHIFT (one craft building passes a factory-sized level threshold) → G1 | `is_building_group = bg_light_industry` 137 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_asturleonese_button | SHIFT (one craft building passes a factory-sized level threshold) → G1 | `is_building_group = bg_light_industry` 210 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_basque_button | OK (group matches children) | `is_building_group = bg_heavy_industry` 355 · `is_building_group = bg_military_industry` 356 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_francoprovencal_button | SHIFT (one craft building passes a factory-sized level threshold) → G1 | `is_building_group = bg_light_industry` 449 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_francoprovencal_button | OK (group matches children) | `is_building_group = bg_heavy_industry` 471 · `is_building_group = bg_military_industry` 472 |
| common/scripted_buttons/06_vernacular_buttons.txt | je_vernacular_policy_accept_occitan_button | SHIFT (one craft building passes a factory-sized level threshold) → G1 | `is_building_group = bg_light_industry` 618 |
| common/scripted_effects/00_victoria_scripted_effects.txt | adopt_random_antigovernment_ideology | OK (group matches children) | `is_building_group = bg_heavy_industry` 841, 857 · `is_building_group = bg_military_industry` 842, 858 |
| common/scripted_effects/00_victoria_scripted_effects.txt | fra_weekly_pulse_orleanist_progress | SHIFT (craft levels ×10 inflate Orleanist progress) → G2 | `is_building_group = bg_manufacturing` 2264 |
| common/scripted_effects/04_negotiation_scripted_effects.txt | set_promised_building_type | OK (picks a real type; a craft costs 6 points, so the promised level count is cost-normalised) | `is_building_group = bg_heavy_industry` 403, 413 · `is_building_group = bg_light_industry` 542, 549 |
| events/agitators_events/coup_events.txt | coup_pulse_events.4 | OK (group matches children) | `is_building_group = bg_light_industry` 320, 367 · `is_building_group = bg_heavy_industry` 321, 379 |
| events/agitators_events/luddite_law_events.txt | luddite_law_events.3 | OK (group matches children) | `is_building_group = bg_light_industry` 212, 238, 250 · `is_building_group = bg_heavy_industry` 213, 239, 251 |
| events/agitators_events/revolution_events_02.txt | revolution_pulse_events.33 | OK (group matches children) | `is_building_group = bg_light_industry` 5368, 5411 · `is_building_group = bg_heavy_industry` 5369, 5412 |
| events/discrimination_events.txt | discrimination_events.4 | OK (group matches children) | `is_building_group = bg_manufacturing` 472, 512 · `pop_employment_building_group = bg_manufacturing` 479, 519, 535 |
| events/law_events/labour_associations_events.txt | labour_associations_events.4 | OK (group matches children) | `is_building_group = bg_manufacturing` 327, 347 |
| events/law_events/technocracy_law.txt | technocracy.2 | OK (group matches children) | `pop_employment_building_group = bg_light_industry` 167, 184, 194 · `pop_employment_building_group = bg_heavy_industry` 168, 185, 195 |
| events/strike_events.txt | strike.1 | OK (group matches children) | `pop_employment_building_group = bg_manufacturing` 53, 69, 80 |

## Appendix D — per-building throughput modifier lines (e) (60 lines in 20 files; the rung each reaches is table D)

| File | Lines (text) |
|---|---|
| common/amendments/00_amendments_enactment_04.txt | 688 `building_art_academy_throughput_add = -0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 902 `building_automotive_industry_throughput_add = 0.1` · 903 `building_arms_industry_throughput_add = 0.1` · 904 `building_artillery_foundry_throughput_add = 0.1` · 947 `building_automotive_industry_throughput_add = 0.1` · 948 `building_arms_industry_throughput_add = 0.1` · 949 `building_artillery_foundry_throughput_add = 0.1` · 967 `building_automotive_industry_throughput_add = 0.1` · 968 `building_arms_industry_throughput_add = 0.1` · 969 `building_artillery_foundry_throughput_add = 0.1` |
| common/static_modifiers/00_ep2_03_modifiers.txt | 25 `building_art_academy_throughput_add = 0.05` |
| common/static_modifiers/00_ip3_02_modifiers.txt | 215 `building_art_academy_throughput_add = 0.1` · 388 `building_art_academy_throughput_add = 0.1` |
| common/static_modifiers/00_ip3_03_modifiers.txt | 161 `building_art_academy_throughput_add = 0.25` · 230 `building_art_academy_throughput_add = 0.25` · 240 `building_art_academy_throughput_add = 0.1` |
| common/static_modifiers/00_ip3_04_modifiers.txt | 210 `building_art_academy_throughput_add = 0.10` · 342 `building_art_academy_throughput_add = 0.05` · 359 `building_art_academy_throughput_add = 0.05` |
| common/static_modifiers/00_ip4_03_modifiers.txt | 140 `building_art_academy_throughput_add = 0.05` |
| common/static_modifiers/00_ip4_04_modifiers.txt | 306 `building_art_academy_throughput_add = 0.15` |
| common/static_modifiers/02_event_modifiers.txt | 512 `building_food_industry_throughput_add = -0.5` · 1254 `building_motor_industry_throughput_add = -0.1` · 1515 `building_glassworks_throughput_add = 0.33` · 1525 `building_explosives_factory_throughput_add = 0.33` · 1538 `building_munition_plant_throughput_add = 0.33` · 1543 `building_motor_industry_throughput_add = 0.33` · 1553 `building_motor_industry_throughput_add = 0.33` · 1563 `building_electrics_industry_throughput_add = 0.33` · 1720 `building_steel_mill_throughput_add = 0.2` · 1721 `building_glassworks_throughput_add = 0.2` · 1746 `building_art_academy_throughput_add = 0.15` · 1757 `building_art_academy_throughput_add = 0.2` |
| common/static_modifiers/104_modifiers.txt | 636 `building_art_academy_throughput_add = 0.15` · 794 `building_art_academy_throughput_add = -0.5` · 799 `building_art_academy_throughput_add = 0.2` |
| common/static_modifiers/105_modifiers.txt | 176 `building_art_academy_throughput_add = 0.1` · 284 `building_art_academy_throughput_add = -0.1` |
| common/static_modifiers/agitators_4_modifiers.txt | 713 `building_electrics_industry_throughput_add = 0.10` · 772 `building_textile_mill_throughput_add = 0.25` · 788 `building_art_academy_throughput_add = 0.10` · 804 `building_art_academy_throughput_add = 0.10` · 810 `building_art_academy_throughput_add = 0.25` |
| common/static_modifiers/agitators_4_revolution_modifiers.txt | 487 `building_paper_mill_throughput_add = 0.1` |
| common/static_modifiers/brazil_2_modifiers.txt | 214 `building_art_academy_throughput_add = 0.1` · 299 `building_steel_mill_throughput_add = 0.1` |
| common/static_modifiers/content_1_modifiers.txt | 1072 `building_motor_industry_throughput_add = 0.15` · 1267 `building_munition_plant_throughput_add = 0.15` |
| common/static_modifiers/content_2_modifiers.txt | 515 `building_paper_mill_throughput_add = 0.2` |
| common/static_modifiers/content_3_modifiers.txt | 438 `building_arms_industry_throughput_add = 0.20` · 439 `building_artillery_foundry_throughput_add = 0.20` · 455 `building_arms_industry_throughput_add = 0.20` · 456 `building_artillery_foundry_throughput_add = 0.20` · 462 `building_arms_industry_throughput_add = 0.05` · 463 `building_artillery_foundry_throughput_add = 0.05` |
| common/static_modifiers/content_4_modifiers.txt | 358 `building_arms_industry_throughput_add = 0.15` · 359 `building_artillery_foundry_throughput_add = 0.15` |
| common/static_modifiers/japan_single_fire_events_modifiers.txt | 56 `building_food_industry_throughput_add = -0.1` |
| common/static_modifiers/montenegrin_modifiers.txt | 360 `building_arms_industry_throughput_add = 0.5` · 402 `building_arms_industry_throughput_add = 0.20` |

## Appendix E — indirect callers of the affected scripted triggers and effects (35 lines in 7 files)

| File | Row | Lines (text) |
|---|---|---|
| events/agitators_events/revolution_events_03.txt | A62, A63 | `is_industry_building = yes` 372, 433, 462, 596, 626, 637 · `is_heavy_industry_building = yes` 373, 434, 463, 597, 627, 638 |
| events/election_events/election_other_parties_events.txt | A64 | `is_industry_building = yes` 36, 67 · `is_heavy_industry_building = yes` 40, 68 |
| events/industrial_accidents_events.txt | A53 | `using_watertube_boiler = yes` 413, 419 |
| events/law_events/economy_laws.txt | A57 | `has_industry_building = yes` 442, 453 · `has_heavy_industry_building = yes` 445, 456 |
| events/pm_events.txt | A58 | `has_industrialized_pm = yes` 29, 110, 117 · `save_industrialized_pm_building_and_state = yes` 38, 119 |
| events/prohibition_events.txt | A61 | `has_distillery = yes` 26, 42, 349, 355 · `has_distillery = no` 259, 268 |
| common/journal_entries/00_prohibition_laws.txt | A14 | `has_distillery = yes` 12 · `is_distillery = yes` 31 |

## Appendix F — Russian custom loc and graphics (cosmetic)

* `common/customizable_localization/99_ru_custom_loc.txt`: 85 lines, one `is_building_type = building_<X>` per key in each of the blocks RU_BL_RP /
  RU_BL_DP / RU_BL_VP / RU_BL_TP / RU_BL_PP (lines 19–415, 598–994, 1177–1573, 1756–2152, 2335–2731).
* `gfx/map/city_data/city_types/{african,arabic,asian,default,latin,southasian}_city.txt` and DLC `dlc004/french_city.txt`, `dlc011/indian_city.txt`,
  `dlc014/balkan_city.txt`, `dlc018/japan_city.txt`: 17 lines each (the 15 in `00_example.txt` are commented out);
  `gfx/map/spline_network/route_graphics/02_railroad_vehicles.txt` (+ the dlc009 copy); `common/scripted_triggers/00_gfx_route_graphics_triggers.txt:128`.
