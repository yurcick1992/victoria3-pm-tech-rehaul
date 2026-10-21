# TIER REFERENCE AUDIT — vanilla script that references a tiered industry

> **Status (2026-10-21): a PROPOSAL awaiting the rulings in `POLISH_1_0.md` §2; nothing here is implemented.** Written by a read-only audit
> subagent; the headline cases (Belle Époque, the grand exhibition, the industry-ban laws, the military-industry principles, the art journals)
> were re-checked by hand against the game files and the built mod. It **supersedes `MISSING_PM_REFERENCES.md`** (stale: it still lists
> railway and shipyard methods, old file paths, and no renamed secondaries) and extends `MISSING_BUILDING_CONDITIONS.md` (still accurate).
> The scanner it mentions (`scan.mjs`, `rows.json`) lived in a session scratchpad and is not kept; the generator proposed in §5 would
> carry the same scan as its build-time guard.
>
> ⚠ Cross-reference the audit could not see: BALANCE_FRAMEWORK §10.98 excluded realism, camera and film from the mod's OWN research
> entries because "vanilla's own universal entries advance them" — §3.1 below shows those vanilla entries are dead in the mod.


Read-only audit, 2026-10-21. Game 1.13.11 at `C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game`; the mod as built in
`mod/` (built 2026-10-21 10:36) from the canon `config/mod_config.json` (`jex-dam4s-rs-x25-m10ac-dpriv-wm99`). Nothing in the repo was
edited, built or run. The scanner and generated tables are in this scratchpad (`scan.mjs`, `rows.json`, `appendix.mjs`).

## 0. Summary

**Positions found (lines of vanilla script):**

| Pattern | Lines | Files | Notes |
|---|---|---|---|
| (a) a tiered industry's vanilla building key (= rung 0 in the mod) | **410** | 49 | 85 of them are Russian grammatical-case loc (`99_ru_custom_loc.txt`), 1 a map-graphics trigger, 1 an achievement → **323 gameplay-script lines** |
| (b) a tiered industry's vanilla MAIN production method | **30** | 9 | all inside building/state checks on rung 0 |
| (b′) a vanilla SECONDARY method of a tiered building (renamed by the mod's per-rung minting) | **49** | 7 | outside history/PM files; not in the brief but the same failure, and the bigger one (BACKLOG E already names it) |
| (e) `building_<tiered key>_throughput_add` in modifiers / power-bloc principles / an amendment | **59** | 20 | ≈48 modifiers; the bonus now reaches rung 0 only |
| (c) the tiered industries' building groups (`bg_light_industry` / `bg_heavy_industry` / `bg_military_industry` / `bg_arts` / `bg_manufacturing`) | **79** | 20 | still match every rung and the crafts (verified, §2); **9 lines change meaning** through the crafts' ×10 levels |
| indirect: callers of the broken scripted triggers/effects | 35 | 8 | not references themselves; listed so the blast radius is visible |
| graphics: city meshes per building key | 170 live | 11 (6 base + 4 DLC + 1 route file) | cosmetic |

**Distinct script blocks** (an event, JE, decision, trigger, effect, button, law, strategy) with an (a)/(b)/(b′) reference, Russian loc and
graphics excluded: **86**.

| Verdict in the mod | Blocks | What it means |
|---|---|---|
| **DEAD** — can never fire / complete / be true | **22** | a vanilla main or secondary method checked on rung 0, which never runs it (5 of them — the two industrialisation triggers, the paired effect, pm_events.3, japan_events.32 — fail validation at load with `Invalid Production Method`, 44 sites in error.log; the rest are silently false); plus **4 more event groups dead through those triggers** (pm_events.1, .2, industrial_accident_events.5, prohibition_events.*) |
| **NARROW** — still fires, but only rung 0 counts; a country on rung 1–3 is ignored | **49** (10 of them where rung 0 is a 500-worker CRAFT with ×10 levels, so a vanilla level threshold is ~10× easier on the craft) | the brief's main case (`has_building`, `is_building_type`) |
| **SHIFT** — still fires but means something else | **5** script blocks + **3** group-level blocks | inverted (accident on crafts), fires for the wrong countries (arms trade event), subsidies/promises pointing the AI at the obsolete rung, craft levels inflating progress counters |
| OK — meaning preserved (single-rung industry, or creation of an e0 rung that is thematic) | 5 | |
| UNUSED (no vanilla caller) / VANILLA-DEAD (broken in vanilla already) | 2 / 1 | |
| COSMETIC | 2 + loc + gfx | achievement, map-train trigger, Russian loc, city meshes |
| **Throughput modifiers** (e) | ≈48 modifiers in 20 files, all NARROW | e.g. the power-bloc military-industry principles boost muskets/cannons/the e2 car plant only |

**Owned whole-file copies of vanilla in `mod/`:** only `common/ai_strategies/01_admin_strategies.txt` still carries an unexpanded key
(the tooling-workshop and explosives-factory subsidies → craft / Leblanc rung only). The 22 company files are correctly expanded
(OR-wraps over the chain, craft keys removed, prosperity throughput per rung). `laws/01_education_system.txt`, the technology files,
`00_starting_inventions.txt`, `00_code_static_modifiers.txt`, the state traits, `06_urban_center.txt`/`07_government.txt` PMs and the
goods file reference none of the industries.

## 1. What the mod changed that these references hit

* **Building keys** (config `industries[].tiers[]`; 17 tiered industries, none `disabled` — port/railway/shipyard/power are not in the
  canon config at all). Rung 0 keeps the vanilla key; 50 building keys + 6 merged rungs (methods on the rung below, not buildings):

  | Industry (vanilla key = rung 0) | Building keys (era) | Merged method (host) |
  |---|---|---|
  | food `building_food_industry` (CRAFT e0) | `_sweeteners` e1 | baking powder e2 → `pm_main_food_baking_powder` on `_sweeteners` |
  | textile `building_textile_mill` (CRAFT e0) | `_dye_workshops` e1, `_sewing_machines` e2 | electric sewing e3 → on `_sewing_machines` |
  | furniture `building_furniture_manufactory` (CRAFT e0) | `_lathe` e1, `_mechanized_workshops` e2 | spray finishing e3 (minted) → on `_mechanized_workshops` |
  | glass `building_glassworks` (CRAFT e0) | `_leaded_glass` e1, `_crystal_glass` e2, `_houseware_plastics` e3 | — |
  | tooling `building_tooling_workshop` (CRAFT e0) | `_pig_iron` e1, `_steel` e2, `_rubber_grips` e3 | — |
  | paper `building_paper_mill` (CRAFT e0) | `_sulfite_pulping` e1, `_continuous_web` e3 (minted) | bleached e2 → on `_sulfite_pulping` |
  | fertilizer `building_chemical_plant` e0 | `_nitrogen_fixation` e2, `_catalytic_synthesis` e3 (minted) | improved fertilizer e1 → on `building_chemical_plant` |
  | explosives `building_explosives_factory` e0 | `_ammonia_soda_process` e1, `_vacuum_evaporation` e2, `_brine_electrolysis` e3 | — |
  | steel `building_steel_mill` e0 | `_bessemer_process` e1, `_open_hearth_process` e2 | electric arc e3 → on `_open_hearth_process` |
  | motor `building_motor_industry` **e1** | `_electric_engines` e2, `_diesel_engines` e3 | — |
  | automotive `building_automotive_industry` **e2** | `_mass_automobile_production` e3 | — |
  | arms `building_arms_industry` e0 | `_rifles` e1, `_repeaters` e2, `_bolt_action_rifles` e3 | — |
  | artillery `building_artillery_foundry` e0 | `_smoothbores` e1, `_breech_loaders` e2, `_recoiled_barrels` e3 | — |
  | munition `building_munition_plant` **e1** | `_explosive_shells` e2 | — |
  | synthetics `building_synthetics_plant` e1 | (single rung — references UNCHANGED) | — |
  | electrics `building_electrics_industry` e2 | (single rung — references UNCHANGED) | — |
  | art academy `building_art_academy` e0 | `_realist_art` e1, `_photographic_art` e2, `_film_art` e3 | — |

* **Main methods are renamed**: each rung runs `pm_main_<ind>_<method>` (e.g. `pm_main_art_academy_realist_art`), never the vanilla
  `pm_realist_art`. The vanilla methods are still DEFINED (the mod's whole-file `01_industry.txt`/`06_urban_center.txt` PM copies keep
  them), but no building's groups list them. ⇒ `has_active_production_method = pm_<vanilla>` is **silently false**; 
  `is_production_method_active = { building_type = building_X production_method = pm_<vanilla> }` **fails validation at load**
  (`PostValidate of trigger 'is_production_method_active' returned false` + `Invalid Production Method '<pm>'`): **44 sites** in
  `tools/testbed/sessions/20261019_225952_wm99-n4/run001_wm99/logs_live/error.log` (the canon's own batch), 19 distinct methods.
  ⚠ What an invalid trigger evaluates to at run time is not measured; everything below assumes false (consistent with
  MISSING_PM_REFERENCES' reading). Where it sits under a `NOT` (industrial_accident_events.1) that flips to TRUE.
* **Secondary methods are renamed per industry** (emit_secondaries' `top` rule, one name per (industry, line)):
  `pm_mechanized_looms → pm_mechanized_looms_textile_mill_sewing_machines`, `pm_automatic_power_looms →
  pm_automatic_power_looms_textile_mill_electric_sewing_machines`, `pm_watertube_boiler_building_<X> →
  pm_watertube_boiler_building_<X>_<short>` (furniture/tooling/paper/steel/motor), `pm_rotary_valve_engine_building_<X>_<short>`,
  `pm_assembly_lines_building_<X>_<short>`, `pm_pot_stills → pm_pot_stills_food`, `pm_patent_stills → pm_patent_stills_food`,
  `pm_craftsman_sewing → pm_craftsman_sewing_textile`, `pm_radios → pm_radios_electrics`, `pm_cannery → pm_cannery_food`, …;
  `pm_traditional_looms` no longer exists on any building. Defaults keep vanilla names (`pm_automation_disabled`, `pm_disabled_distillery`,
  `pm_no_radios`, `pm_no_luxury_clothes`, …). The craft rungs carry no automation group and the food craft's distillery group holds
  only `pm_disabled_distillery`.
* **Crafts**: the six light-industry rung-0 keys are 500-worker crafts in `bg_pmr_crafts` (child of `bg_light_industry`),
  `workforce_mult` 0.1, and the 1836 start multiplies their levels ×10. A vanilla `level >= N` on those keys now means a tenth of the
  vanilla capacity.
* **Per-building modifier types** are hand-enumerated in vanilla; `emit_companies.mjs` declares `building_<rung>_throughput_add` for 27
  rung keys (the ones company prosperity names). **Not declared:** `building_glassworks_{leaded_glass,crystal_glass,houseware_plastics}`
  and `building_explosives_factory_{ammonia_soda_process,vacuum_evaporation,brine_electrolysis}`.

## 2. Building groups — does `is_building_group` match child groups?

**Yes, VERIFIED** for `is_building_group`: TESTBED_METRICS §3.1 measured `is_building_group = bg_manufacturing` catching light + heavy +
military + ship construction (GBR 1836: 28 manufacturing buildings), and FINDINGS F180 §1 notes vanilla's decrees test `bg_manufacturing`,
which holds no building directly. So every `is_building_group = bg_light_industry` / `bg_manufacturing` reaches the crafts, and the
group modifiers (`building_group_bg_light_industry_*`) reach them too. **Confidence high.**
**Not verified, likely (medium):** that `state_has_building_group_levels` / `country_has_building_group_levels` and
`pop_employment_building_group` also count child groups.

Where the groups DO change meaning (the other 70 group lines are fine — appendix C):
* **Craft levels inflate level thresholds and level sums.** `06_vernacular_buttons.txt:137,210,449,618` (`bg_light_industry level >= 5/6/10/8`
  on ONE building — a 5-level craft is 2,500 workers against vanilla's 25,000); `00_victoria_scripted_effects.txt:2264`
  `fra_weekly_pulse_orleanist_progress` sums `prev.level` of every profitable `bg_manufacturing` building ÷100 → the French crafts'
  ×10 levels inflate the Orleanist progress of `je_french_monarchism`; `06_economic_regeneration.txt:449,481,538,589`
  (`state_has_building_group_levels bg_light_industry >= 16 / 7`, Spain) — the same inflation IF that counter includes child groups.
* **Per-building level thresholds now split across rungs**: `level >= 5` on one heavy/military building (vernacular 355/471,
  `ideology_luddite` 6530–6629, `adopt_random_antigovernment_ideology` 841/857) is harder when a state's capacity is spread over two
  rung buildings. Minor; no fix proposed.

## 3. Findings by pattern

Verdict codes: DEAD / NARROW / NARROW+CRAFT / SHIFT / OK / COSMETIC. "Fix" names the generated helpers of §5 (`pmr_is_<ind>`,
`pmr_has_<ind>`, `pmr_runs_<pm>`, …).

### 3.1 The art-academy chain — DEAD, and it carries research boosts (7 blocks, 1 file + 2 event files)

| Where | Vanilla | Mod | Verdict |
|---|---|---|---|
| `common/journal_entries/00_art_jes.txt:27–28` je_romanticism `complete` | an academy running `pm_traditional_art`, lvl≥2, occ≥0.9 | rung 0 runs `pm_main_art_academy_traditional_art` → never | DEAD (fails at realism) |
| `00_art_jes.txt:63` (possible) `:70,73` (complete, `percent = 1` of academies on `pm_realist_art`) je_realism | | possible needs rung 0; complete never | DEAD |
| `00_art_jes.txt:103` / `110–119` je_camera | photographic academy lvl≥5 and >75% of academies photographic | never | DEAD |
| `00_art_jes.txt:150` / `157–166` je_film | same with film | never | DEAD |
| `events/tech_events/society_tech_events.txt:219,227–228` society_tech_events.302 (fired by je_romanticism) | picks a traditional-art academy | never triggered; immediate PM dead | DEAD → **lost: realism +3,500 progress, `romantic_building_modifier`** |
| `society_tech_events.txt:447–460` dt_society_events.2 (fired by je_realism; `order_by = b:building_art_academy.level` at 452) | | never | DEAD → **lost: camera +4,150, `realist_art`/`grim_realism`** |
| `events/tech_events/camera_film_pm_events.txt:31–32 / 94–95` (.1/.2, fired by je_camera/je_film) | | never | DEAD → **lost: film +6,000, mass_propaganda +5,850** |

**Fix:** replace each (`is_building_type = building_art_academy` + `has_active_production_method = pm_<x>_art`) pair by
`pmr_runs_pm_<x>_art = yes`, i.e. `is_building_type = building_art_academy[_realist_art|_photographic_art|_film_art]`; the `filter`
clauses by `pmr_is_art_academy = yes`; the `possible` clauses (`level >= 3`) by `pmr_is_art_academy = yes`; `b:building_art_academy.level`
by `pmr_art_academy_state_levels` (state script value). One owned file each: `00_art_jes.txt`, `society_tech_events.txt`,
`camera_film_pm_events.txt`. ⚠ These events feed the research calendar the mod tunes against vanilla's volumes — four vanilla tech
boosts silently missing is a research-pacing bias, not just flavour.

### 3.2 Belle Époque — DEAD at `possible` (2 blocks)

* `common/journal_entries/00_belle_epoque.txt:40,43–44` `je_belle_epoque` **possible**: an academy lvl≥3 running photographic or film →
  never true → **the JE never activates and the whole belle_epoque_events chain it drives never runs.** Fix:
  `any_scope_building = { pmr_is_art_academy_e2plus = yes  level >= 3 }` (photographic/film = rungs e2/e3).
* `00_belle_epoque.txt:260` (its `on_monthly_pulse` launcher for belle_epoque_events.14): a neighbour's building with `pm_craftsman_sewing`
  → renamed → DEAD. Fix: `pmr_runs_sec_pm_craftsman_sewing = yes` (= `has_active_production_method = pm_craftsman_sewing_textile`).
* `events/belle_epoque_events.txt:1375` (the event's own trigger, same secondary) DEAD; `:135,151` (.2), `:280,287` (.3), `:631,636` (.6 option b)
  art academy lvl≥3 → NARROW; `:602,610` (.6, electrics, single rung) OK; `:781` (.8, automotive rung 0 = e2 car plant) NARROW;
  `:1418` (.14 option, textile craft) NARROW+CRAFT.

### 3.3 The grand exhibition (the user's example) — NARROW

* `common/decisions/grand_exhibition_decision.txt:13` `possible`: `any_scope_building = { is_building_type = building_art_academy  level >= 10 }`
  → only a 10-level traditional-art academy (rung 0) qualifies; a country that modernised its academies cannot hold the exhibition.
* **Fix (simplest correct, as asked):** one building of ANY rung at level 10 —
  ```
  any_scope_building = {
      pmr_is_art_academy = yes   # OR over building_art_academy, _realist_art, _photographic_art, _film_art
      level >= 10
  }
  ```
  (wrap in a `custom_tooltip` "an Art Academy of any era with 10 levels" so the tooltip does not list four building types). If a state
  part-way through modernising (6 traditional + 5 realist) should pass too, use the summed form
  `any_scope_state = { pmr_art_academy_state_levels >= 10 }` instead — one generated state script value.
* Related (same file pattern, NARROW, art academy rung 0 only): `00_liberalism.txt:137` je_liberalism_3 (lvl≥3, occ>0.9);
  `events/liberalism.txt:71,122,166`; `assassination_events.txt:287,304`; `balkans_events/03_ip3_austria_events.txt:433,558`
  (exhibition participation prestige / cultural exchange); `balkans_events/national_awakening.txt:368,387,392`; `decree_events.txt:498,517`;
  `fascism_events.txt:949,1011,1017`; `iberia_events/ip4_anarchism_events.txt:379`; `ig_suppression_events.txt:853` (dialectics +3,500);
  `krakatoa_events.txt:683,696,701`; `law_events/citizenship_laws.txt:142,175`; `scripted_buttons/06_vernacular_buttons.txt:50,67,293,558`
  (Catalan/Galician/Breton: university OR academy); `scripted_effects/00_victoria_scripted_effects.txt:3004`
  `calculate_national_identity_progress` (South American national identity JE counts academy levels — only rung 0 counts);
  `scripted_effects/04_negotiation_scripted_effects.txt:461,467` (promise an academy — see 3.9). Fix for all: `has_building` →
  `pmr_has_art_academy`, `is_building_type` → `pmr_is_art_academy`. **No crafts in this industry, so `level` needs no rescaling.**
* `events/japan_events/ep2_japan_events_03.txt:157–158,161,173–174,179` japan_events.32 (ukiyo-e): `is_production_method_active
  traditional art` on `building_art_academy` → invalid at load → DEAD. Fix: `has_building = building_art_academy` (rung 0 IS traditional art).

### 3.4 Industry-ban laws — NARROW in an EFFECT (higher rungs survive a ban)

* `common/laws/01_economic_system.txt:263–307` (law_industry_banned) and `:379–417` (law_extraction_economy): on activation every state
  `remove_building`s chemical plant, synthetics, steel, motor, automotive, electrics, munition plant (and power plant) — **rung 0 only.**
  Bessemer/open-hearth mills, electric/diesel engine plants, mass car plants, nitrogen/catalytic fertilizer plants and shell plants
  survive the ban (their `possible` blocks only stop NEW construction). Tooltip text lists rung 0 too (harmless).
* **Fix, less invasive (no file ownership):** an additive `on_law_activated = { on_actions = { pmr_industry_ban_cleanup } }` whose effect
  runs in `owner` (root = the law, owner = the country, per vanilla's comment at `00_code_on_actions.txt:5020`) and, if the owner holds
  `law_industry_banned` or `law_extraction_economy` (or variants), calls a generated `pmr_remove_<ind> = yes` per state for the same seven
  industries (one `if = { limit = { has_building = K } remove_building = K }` per rung key; merged rungs need nothing). Idempotent if it
  re-runs on later law changes. ⚠ Probe it once (a cheap `force_tech`/law-set probe) before relying on it. Fallback: own
  `01_economic_system.txt` (727 lines) and rewrite each `if` pair.
* Vanilla never removes `building_explosives_factory` under these laws; mirror that (do not add explosives).

### 3.5 Player objectives, missions, reforms — NARROW (the player is asked to build the obsolete rung)

* `common/journal_entries/00_player_objectives_economic_dominance.txt:73,82` je_refining_goods: a steel mill lvl≥4, occ≥0.9, unsubsidised
  → only the blister-steel e0 rung; a player who builds Bessemer cannot complete the objective. `:103,112` je_specialized_goods: motor
  industry lvl≥2 → only the steam-engine rung. Fix: `pmr_is_steel` / `pmr_is_motor` (keep `level`, no crafts).
* `00_trade_route_event_missions.txt:8` je_build_local_arms_industry `complete = { any_scope_state = { has_active_building =
  building_arms_industry } }` → only a musket rung completes it; and `events/trade_route_events.txt:25` (`NOT any state has_building
  arms_industry`) now fires for countries that DO have rifle/repeater factories → **SHIFT** (spurious mission, then demands muskets).
  Fix both: `pmr_has_arms` / `pmr_has_active_arms` (OR of `has_active_building` over the four keys).
* `03_russia.txt:1277` je_great_reforms_military (munition plant lvl≥3 = percussion caps, e1 — era-appropriate for the 1860s; a Russia
  with only shell plants fails). Low priority; same fix.
* `common/scripted_buttons/00_balkan_wars_buttons.txt:187–189,213–215`, `03_paraguay_scripted_buttons.txt:69` (arms lvl≥2),
  `05_serbia_buttons.txt:15` (paper craft) — NARROW / NARROW+CRAFT; fix as above.

### 3.6 Industrialisation and industrial accidents — mostly DEAD (one scripted-trigger file fixes most)

`common/scripted_triggers/00_scripted_triggers.txt` (2,403 lines) holds the shared triggers; its callers are in events:

| Trigger (lines) | Vanilla | Mod | Callers (indirect) |
|---|---|---|---|
| `has_industrialized_pm` 141–215 (15 `is_production_method_active` pairs: looms, watertube/rotary/assembly on furniture/tooling/paper/steel/motor, `pm_mechanized_workshops`) | a state runs a mechanised secondary | every pair invalid at load → DEAD | `pm_events.txt:29,110,117` → **pm_events.1 (lacking safety) and pm_events.2 (child labour) never fire** |
| `using_watertube_boiler` 217–262 | | DEAD | `industrial_accidents_events.txt:413,419` → **industrial_accident_events.5 (boiler explosion) never fires** |
| `has_distillery` / `is_distillery` 933–947 (secondary `pm_pot_stills`/`pm_patent_stills`) | | always false (renamed `_food`; the food craft cannot distill) | `00_prohibition_laws.txt:12,31` → **je_prohibition never shown**; `prohibition_events.txt:26,42,349,355` never; `:259,268` `has_distillery = no` always true (moot while the JE is dead) |
| `has_industry_building` 451–460, `is_industry_building` 462–471 (the six light-industry keys) | any light-industry factory | the six CRAFTS only; a craft's `level >= 3/5` = a tenth of vanilla's capacity | `revolution_events_03.txt:372–638` (12 lines, `level >= 3`), `election_other_parties_events.txt:36–68` (`level >= 5`), `economy_laws.txt:442–456` |
| `has_heavy_industry_building` 473–483, `is_heavy_industry_building` 486–496 (chemical, synthetics, steel, motor, automotive, electrics, munition, power) | | rung 0 (+ power plant, untiered) | same callers |
| `has_government_building` 437, `is_production_building` 812–855 | | NARROW | **no vanilla caller** (UNUSED) |

`common/scripted_effects/00_scripted_effects.txt:75–180` `save_industrialized_pm_building_and_state` (paired with has_industrialized_pm) DEAD.

Fix: own the two files; generator rewrites `is_production_method_active = { building_type = building_X production_method = pm_S }` to
`pmr_state_runs_sec_pm_S = yes` (state: `any_scope_building = { has_active_production_method = <minted S> }` over the rungs carrying it),
the main `pm_mechanized_workshops` pair to `pmr_state_runs_pm_mechanized_workshops`, `has_building`/`is_building_type` to the
`pmr_has_*`/`pmr_is_*` helpers, `has_distillery`/`is_distillery` to the `_food` names, and inside the industry triggers' callers keep
`level` but (for the crafts) use the vanilla-equivalent level `pmr_level_v` — or simply EXCLUDE crafts from "industry building" (decision
for the user: a 500-worker workshop is arguably not what an "industry building" uprising/election event means).

Events (own the files):
* `events/industrial_accidents_events.txt:53–56,97–100` accident .1: `has_building textile_mill` AND NOT `pm_traditional_looms` active.
  The PM is invalid on the craft → if it evaluates false the NOT is TRUE → **SHIFT: the mechanised-loom accident fires on every state
  with a textile craft.** Fix: `any_scope_building = { pmr_is_textile_e2plus = yes }` (non-traditional looms exist only beside sewing
  machines e2 and electric sewing e3; the dye-workshop rung has no automation group).
* `:169,184` accident .2: textile craft — NARROW+CRAFT; `pmr_has_textile`.
* `:327–345` accident .4: food industry with a distillery not disabled → the craft's only distillery method IS `pm_disabled_distillery` →
  DEAD. Fix: `any_scope_building = { pmr_is_food = yes  NOT = { has_active_production_method = pm_disabled_distillery } }`.
* `events/pm_events.txt:181–211` pm_events.3 (pot/patent stills on rung 0) invalid at load → DEAD; same `_food` rename. `:316,325`
  pm_events.4 (arms) NARROW.

### 3.7 Technology events with research progress — DEAD or NARROW

| Event (file `events/tech_events/…`) | Lines | Vanilla | Mod | Verdict / loss |
|---|---|---|---|---|
| military_tech_events.401 | 27–62 | arms lvl≥3 on rifles/repeaters/bolt-action | muskets rung never runs them | **DEAD** — repeaters +4,150, `modern_rifle_arsenal`/`arsenal_proving_ground` |
| production_tech_events.200 | 239–256 | ≥50% of glassworks on houseware plastics, lvl≥5 | glass craft | **DEAD** — plastics +6,000 |
| production_tech_events.210 | 329–344 + secondary 337 | ≥50% electrics running `pm_radios` | renamed `pm_radios_electrics` | **DEAD** — radio +6,000 (BACKLOG E already names it) |
| production_tech_events.300 | 414–442 | electrics lvl≥5 (trigger) + `pm_telephones` (immediate) | trigger OK (single rung); immediate's PM never → `scope:electrics_state` unset | **SHIFT** — option b's modifier lost |
| production_tech_events.102 | 83, 91 | munition/mines + explosives factory | Leblanc rung 0 + percussion-cap rung | NARROW — `dynamite_production_modifier` |
| production_tech_events.501 / .700 | 762–879 / 1065–1105 | motor industry (lvl≥3 at .700) | steam-engine rung only | NARROW — steel_railway_cars +4,150 |
| production_tech_events.103 | 167–170 | motor industry + `pm_automobile_production` | — | VANILLA-DEAD (already impossible in vanilla; leave) |
| society_tech_events.104 | 8, 11 | steel mill + glassworks | blister rung + glass craft | NARROW+CRAFT — `elevator_goods_production_modifier` |
| war_crimes.2 | 143, 154 | munition plant lvl≥5 | percussion-cap rung | NARROW — rifling +3,500 |

Fix: `pmr_is_arms_e1plus` (rifles or newer) for .401; `pmr_runs_pm_houseware_plastics` + `pmr_is_glass` filter for .200;
`pmr_runs_sec_pm_radios` for .210; `pmr_runs_pm_telephones` (= `is_building_type = building_electrics_industry`) for .300; the any-rung
helpers for the rest.

### 3.8 Per-building throughput modifiers — NARROW (rewards reach rung 0 only) — 59 lines, 20 files

Every `building_<key>_throughput_add` listed in appendix D boosts only rung 0. The significant ones:
* `common/power_bloc_principles/00_power_bloc_principles.txt:902–904, 947–949, 967–969` — **principle_military_industry_1/2/3**: +10%
  arms, artillery, automotive → muskets, cannons and the e2 car plant only.
* Tech-event rewards in `static_modifiers/02_event_modifiers.txt`: `plastic_production_modifier` (+33% glassworks → the forest-glass
  CRAFT), `dynamite_production_modifier` (+33% explosives → Leblanc), `munitions_production_modifier`, `motor_industry_production_modifier`,
  `engine_production_modifier` (+33% motor → steam engines), `electrics_building_modifier` (single rung, OK), `elevator_goods_production_modifier`,
  `realist_art`, `romantic_building_modifier`; `content_1_modifiers.txt` `steam_engine_production`, `munitions_modifier`;
  `content_3_modifiers.txt` `wartime_production_act`, `modern_rifle_arsenal`, `arsenal_proving_ground`; `content_4` (Taiping crusade);
  `montenegrin_modifiers.txt` `mon_many_guns` (+50%), `modifier_reliable_supply` (the je_build_local_arms_industry reward).
  ⚠ A reward for MODERNISING that boosts the OBSOLETE rung works against the mod's obsolescence design.
* Art-academy throughput in 12 modifiers across ip3/ip4/ep2/104/105/agitators/brazil files and `amendment_degenerate_art` (−10%).
* Fix: duplicate each line per building key of the industry (same value), and declare the six missing modifier types (glassworks ×3,
  explosives ×3) beside emit_companies' 27, with loc. Needs whole-file ownership of all 20 files (no merge route for modifiers);
  the power-bloc file and `02_event_modifiers.txt` + `content_1/3` carry most of the value.

### 3.9 AI behaviour — SHIFT (AI levers pointing at the obsolete rung)

* **`mod/common/ai_strategies/01_admin_strategies.txt:230–231` (vanilla :210–211) and `:629` (vanilla :574)** — ALREADY OWNED by the
  build: `ai_strategy_resource_expansion` subsidises `building_tooling_workshop` (nice_to_have) and `building_explosives_factory`;
  `ai_strategy_colonial_extraction` subsidises `building_tooling_workshop` (wants_to_have). In the mod that subsidises the crude-tools CRAFT
  and the Leblanc rung — **a subsidy propping up exactly the rungs the ladder wants retired**, never the pig-iron/steel/rubber-grip
  workshops. Cheapest fix of all (the file is already emitted). ⚠ **RULING needed:** expand to every rung (vanilla-faithful) or to the
  non-craft rungs only (vanilla's intent "keep tools flowing to the mines" is better served by the factory rungs; §10.92 says AI levers
  should make the AI follow profit, not prop up a rung).
* `common/ai_strategies/00_default_strategy.txt:5033,5040,5047` goods stances (dye, silk ← textile mill; hardwood ← furniture
  manufactory): true only while the country holds the CRAFT → NARROW+CRAFT. Low value; the file is 8,792 lines — leave unless owned for
  another reason.
* `common/scripted_effects/04_negotiation_scripted_effects.txt:461–467, 601–629` `set_promised_building_type`: a negotiation can promise
  `bt:building_art_academy` / `_artillery_foundry` / `_munition_plant` / `_arms_industry` → the player must then build levels of the
  **rung-0 type** (and `building_can_be_promised` requires already owning rung 0). SHIFT. Fix: replace each fixed `bt:` option with
  `owner = { random_scope_building = { limit = { pmr_is_<ind> = yes } type = { save_temporary_scope_as = potential_building_type } } }`
  (vanilla's own idiom from the light/heavy-industry options at 403–413, 542–549), preferring the highest era the owner holds.
  The light/heavy random picks are fine (they pick a real type; `building_levels_to_increase_value` divides by
  `required_construction`, so a 6-point craft promise is cost-normalised).

### 3.10 Decrees, flavour, Montenegro, creation effects

* `events/decree_events_02.txt:29–44,71–86` (.100) and `:150–165,194–209` (.101): an OR over 15 manufacturing keys (vanilla omits the
  artillery foundry) with `weekly_profit > 0` → only rung 0 / the crafts; NARROW+CRAFT. Fix: `is_building_group = bg_manufacturing`
  would widen to shipyards/power; better OR the `pmr_is_<ind>` helpers (keeps vanilla's list).
* `common/on_actions/00_code_on_actions.txt:958` (monthly Montenegro check, `has_active_building = building_arms_industry`) and
  `events/balkans_events/montenegro_events.txt:1859,1866,1875,1877` (`b:building_arms_industry` link) — NARROW (muskets only). Owning the
  7,963-line code on_actions file is not worth it; accept, or own `montenegro_events.txt` and add an additive monthly on_action that
  fires the event for the other rungs.
* `scripted_buttons/06_vernacular_buttons.txt:634` (Occitan: food craft lvl≥3 → trivially met) NARROW+CRAFT, `:694` (Walloon: steel
  rung 0 lvl≥6) NARROW; `economy_laws.txt:444,455` (arms) NARROW; `belle_epoque_events.txt:1418` textile craft NARROW+CRAFT.
* Creation effects (OK, minor): `events/brazil/amazonas.txt:420,425` (creates an art academy if the state has no rung-0 academy),
  `events/brazil/paraguay.txt:355,360` and `scripted_buttons/03_paraguay_scripted_buttons.txt:98,103` (create a 2-level steel mill if no
  rung-0 mill) — they create the e0 rung, and can put it NEXT TO a modern mill. Fix: guard with `pmr_is_<ind>` in the NOT. Leave the
  building rung 0. `events/agitators_events/land_ownership_law_events.txt:1577` (`start_building_construction = building_steel_mill`,
  "backyard steel") — OK as is; primitive steel is the point.

### 3.11 Cosmetic / harmless

* `common/customizable_localization/99_ru_custom_loc.txt` — 85 lines (17 keys × 5 grammatical cases): higher rungs fall back to the
  default form in Russian text. Cosmetic.
* `gfx/map/city_data/city_types/*.txt` + DLC `french/indian/balkan/japan_city.txt` — 170 lines mapping each vanilla key to a factory mesh;
  higher rungs have none → fewer factory meshes in modern cities. `gfx/map/spline_network/route_graphics/02_railroad_vehicles.txt` and
  `common/scripted_triggers/00_gfx_route_graphics_triggers.txt:128` (`gfx_mining_train_trigger`, steel mill) — train visuals.
* `common/achievements/mp1_charters_of_commerce_achievements.txt:146` (Systembolaget: monopoly on `bt:building_food_industry`) —
  achievements are unavailable with this mod.
* `has_subsistence_building` (scripted_triggers 499) is unaffected (it tests `is_subsistence_building`).

## 4. Top 10 by gameplay significance

1. **je_belle_epoque can never activate** (`00_belle_epoque.txt:40–44`): its `possible` needs a rung-0 academy on photographic/film art.
2. **The art JE chain (romanticism → realism → camera → film) can never complete** (`00_art_jes.txt`), so society_tech_events.302,
   dt_society_events.2 and camera_film_pm_events.1/.2 never fire: **−3,500 realism, −4,150 camera, −6,000 film, −5,850 mass_propaganda
   progress** plus four art modifiers lost in every country — a research-pacing bias against the vanilla reference.
3. **Industry-ban / extraction-economy laws leave rungs 1–3 standing** (`01_economic_system.txt:263–417`) — a law whose whole point is
   demolition demolishes only the e0 (or e1/e2 for motor/automotive) buildings.
4. **Tech-boost events dead or narrowed**: military_tech_events.401 (−4,150 repeaters), production_tech_events.200 (−6,000 plastics),
   .210 (−6,000 radio) DEAD; .501/.700 (steel_railway_cars), war_crimes.2 (rifling), .102 only for the old rungs.
5. **Power-bloc `principle_military_industry_1/2/3`** and ≈48 event/JE throughput rewards boost rung 0 only — including rewards for
   modernising (plastics → the forest-glass craft, dynamite → Leblanc, engines → steam engines).
6. **The grand exhibition** (`grand_exhibition_decision.txt:13`) needs a 10-level TRADITIONAL academy.
7. **Player objectives and missions demand the obsolete rung**: je_refining_goods (blister steel lvl 4), je_specialized_goods (steam
   engines), je_build_local_arms_industry (muskets) — and trade_route_events.1 now fires for countries that already make rifles.
8. **je_prohibition is never shown** (`has_distillery`/`is_distillery` test vanilla still names; the food craft cannot distill): the
   prohibition JE and all its events are gone.
9. **Industrialisation events**: has_industrialized_pm / save_industrialized_pm / using_watertube_boiler dead → pm_events.1 (safety),
   pm_events.2 (child labour), industrial_accident_events.4/.5 never fire, while accident .1 (mechanised looms) fires on artisan crafts.
10. **AI levers pointing at the retired rung**: admin-strategy subsidies for the crude-tools craft and Leblanc (already-owned file),
    negotiation promises of rung-0 arms/artillery/munition/academy; plus craft levels ×10 inflating Orleanist progress (France) and
    the light-industry level thresholds of the vernacular buttons, and South American national identity counting only rung-0 academies.

## 5. Proposed implementation (a generator, not hand edits)

### 5.1 One emitter: `tools/emit_vanilla_refs.mjs` (sibling of `emit_companies.mjs`)

Run by `build.ps1` AFTER `emit_secondaries.mjs` (it needs the minted secondary names) and after `emit_companies.mjs` (it extends the
modifier-type declarations). Inputs: the config (tiers with `key`, `pm_key`, `vanilla_pm`, `era`, `craft`, `method_of`,
`workforce_mult`), the EMITTED secondary groups (or a sidecar map `vanilla secondary PM → minted name(s) + rung keys` that emit_secondaries
writes — preferable, one definition), and the live vanilla files.

**A. Additive files (new keys only — no ownership, no patch freeze):**
* `common/scripted_triggers/zzz_pm_rehaul_industry_triggers.txt`, per industry:
  * `pmr_is_<ind>` (building scope) = `OR { is_building_type = <each building key> }` (merged rungs are methods, not keys);
  * `pmr_has_<ind>` (state or country scope) = `OR { has_building = … }`; `pmr_has_active_<ind>` = `OR { has_active_building = … }`;
  * `pmr_is_<ind>_e<k>plus` (building scope) = the rung buildings with era ≥ k, plus `AND { is_building_type = <host>
    has_active_production_method = <merged pm_key> }` for merged rungs (keyed by ERA, per the era rule);
  * per vanilla main method (53): `pmr_runs_<vanilla_pm>` (building) = its rung's `is_building_type`, or `AND { host + its pm_key }` for
    a merged method AND for a host's own method; `pmr_state_runs_<vanilla_pm>` (state) = `any_scope_building = { pmr_runs_… = yes }`;
  * per vanilla secondary method of a tiered building (≈40): `pmr_runs_sec_<pm>` (building) = `OR { has_active_production_method =
    <minted name> }`, `pmr_state_runs_sec_<pm>` (state).
* `common/script_values/zzz_pm_rehaul_industry_values.txt`: `pmr_level_v` (building scope: `level`, × 0.1 on `bg_pmr_crafts` — derived
  from `workforce_mult`, so a threshold keeps its vanilla capacity meaning) and `pmr_<ind>_state_levels` (state scope, Σ `pmr_level_v`
  over `pmr_is_<ind>` buildings) for "N levels in a state".
* `common/scripted_effects/zzz_pm_rehaul_industry_effects.txt`: `pmr_remove_<ind>` (state scope: one `if/has_building/remove_building`
  per key).
* `common/on_actions/zzz_pm_rehaul_industry_laws.txt`: `on_law_activated = { on_actions = { pmr_industry_ban_cleanup } }` (§3.4) —
  registered by `on_actions`, never `effect` (landmine L22).
* Extend the modifier-type file: declare `building_<key>_throughput_add` for EVERY rung key (6 missing today), loc in 11 languages,
  copying emit_companies' method.

**B. Whole-file transforms of live vanilla (emit only files that change; every transform asserts its match count and THROWS on a
no-op — the emit_companies discipline):**
* token rewrites: `is_building_type = building_X` → `pmr_is_X = yes`; `has_building = building_X` → `pmr_has_X = yes`;
  `has_active_building` → `pmr_has_active_X`; `is_production_method_active = { building_type = building_X  production_method = pm_Y }` →
  `pmr_state_runs_[sec_]pm_Y = yes`; `has_active_production_method = pm_Y` → `pmr_runs_[sec_]pm_Y = yes`; `building_X_throughput_add = v`
  → one line per key; `level` beside a rewritten CRAFT-industry type test → `pmr_level_v` (or exclude crafts — ruling);
  single-rung industries (synthetics, electrics) are left verbatim except their method references;
* a short hand-authored SPECIAL-CASE table for the ~10 sites a token rule cannot express: the `percent` filters of the art JEs, the `NOT
  traditional looms` (→ `pmr_is_textile_e2plus`), the distillery accident, the `b:building_*` links (montenegro 1877, dt_society 452),
  the negotiation `bt:` options, the creation effects' guards, the vanilla omission of artillery in decree 100/101 (keep it omitted).

**C. Files to own (count):**

| Tier | Files | Lines | What it fixes |
|---|---|---|---|
| 1 (gameplay, research pacing) | `decisions/grand_exhibition_decision.txt`; JEs `00_art_jes`, `00_belle_epoque`, `00_liberalism`, `00_player_objectives_economic_dominance`, `00_prohibition_laws`, `00_trade_route_event_missions`; `scripted_triggers/00_scripted_triggers.txt`; `scripted_effects/00_scripted_effects.txt`; events `tech_events/{military,production,society}_tech_events`, `tech_events/camera_film_pm_events`, `tech_events/war_crimes_events`, `belle_epoque_events`, `pm_events`, `industrial_accidents_events`, `trade_route_events`; `power_bloc_principles/00_power_bloc_principles.txt`; `static_modifiers/{02_event,content_1,content_3}_modifiers.txt` | **22 files, 17,057 lines** | §3.1–3.8 core, the 44 load errors, all research boosts |
| 2 (flavour, narrowing) | the other 16 event files, 4 scripted-button files, `04_negotiation_scripted_effects`, `00_victoria_scripted_effects` (5,167 lines: national identity, Orleanist), 15 more static-modifier files, `amendments/00_amendments_enactment_04` | **38 files, 32,378 lines** | the NARROW tail |
| avoided | `laws/01_economic_system.txt` (additive on_law_activated), `on_actions/00_code_on_actions.txt` (accept Montenegro), `ai_strategies/00_default_strategy.txt` (8,792 lines, low value), `journal_entries/03_russia.txt` (mild) | — | |
| already owned | `ai_strategies/01_admin_strategies.txt` | — | the subsidies (ruling) |
| cosmetic, optional | 6 base + 4 DLC city-type gfx files, the RU custom loc | — | meshes, Russian declension |

Tier 1 is 22 files, 17,057 lines of someone else's script; tier 1+2 is 60 files, 49,435 lines (the 25 event files 20,705; the 18
static-modifier files + power-bloc file + amendment file 16,160). **Patch exposure is a REBUILD obligation, not a freeze**, because every file is regenerated from the live vanilla text on each
build (as the 22 company files already are); a patch that moves a matched line makes the build THROW instead of shipping stale script.
Each owned file goes into ON_GAME_UPDATE.md.

**There is no less invasive route for most of it**: events, JEs, decisions, scripted triggers/effects, buttons and static modifiers
cannot be patched in place, and per MODDING_NOTES a same-key definition in a differently named file is rejected (verified for
buildings; assumed for scripted triggers/effects — verify once in error.log before relying on it either way). The only additive routes
are the on_action for the laws and the helper triggers/values/effects themselves. Keeping the vanilla key on a DIFFERENT rung (e.g.
the frontier) would only move the problem; a building has one type.

**D. Guards (so a patch cannot reintroduce this silently):**
* the emitter's own scan (this audit's `scan.mjs` logic) over the WHOLE game tree at build time: every reference to a tiered vanilla
  key, vanilla main method, renamed vanilla secondary or `building_<tiered key>_*` modifier must sit in an owned-and-transformed file
  or on an explicit ACCEPTED list with a reason (RU loc, gfx, achievement, the four avoided files) — otherwise THROW;
* a TESTBED_LANDMINES entry with a detector: zero `Invalid Production Method` PostValidate lines from vanilla paths in a run's error.log
  (44 today);
* regenerate (or retire) MISSING_PM_REFERENCES.md from the same scan — it is stale: it still lists railway/shipyard methods (those
  industries are vanilla now), points at `military_tech_events_01.txt` / `society_events_0x.txt` (now `military_tech_events.txt` /
  `society_tech_events.txt`) and has no secondaries. MISSING_BUILDING_CONDITIONS.md is still accurate (the art academy's conditional
  `ai_value` — +500 for Metternich's Austria — is still flattened to `ai_value = 1000` in `mod/common/buildings/06_urban_center.txt`).

### 5.2 Rulings the generator needs before it is written
1. Craft rungs in "industry building" tests: include with `pmr_level_v` (vanilla capacity) or exclude (a workshop is not a factory).
2. Admin-strategy subsidies: every tooling/explosives rung, or the non-craft rungs only.
3. Grand exhibition (and the other "N levels in a state" tests): one building of any rung (OR form, the simplest) or the summed state levels.
4. Tier 1 only, or tier 1 + 2.

## Appendix A — every (a) key and (b) main-method line, with its block and verdict (Russian loc excluded; generated from `rows.json`)

| File | Line | Kind | Token | Block | Verdict |
|---|---|---|---|---|---|
| common/achievements/mp1_charters_of_commerce_achievements.txt | 146 | key | `building_food_industry` | achievement_systembolaget | COSMETIC |
| common/ai_strategies/00_default_strategy.txt | 5033 | key | `building_textile_mill` | ai_strategy_default | NARROW+CRAFT |
| common/ai_strategies/00_default_strategy.txt | 5040 | key | `building_textile_mill` | ai_strategy_default | NARROW+CRAFT |
| common/ai_strategies/00_default_strategy.txt | 5047 | key | `building_furniture_manufactory` | ai_strategy_default | NARROW+CRAFT |
| common/ai_strategies/01_admin_strategies.txt | 210 | key | `building_tooling_workshop` | ai_strategy_resource_expansion | SHIFT (props up the craft / e0) |
| common/ai_strategies/01_admin_strategies.txt | 211 | key | `building_explosives_factory` | ai_strategy_resource_expansion | SHIFT (props up the craft / e0) |
| common/ai_strategies/01_admin_strategies.txt | 574 | key | `building_tooling_workshop` | ai_strategy_colonial_extraction | SHIFT (props up the craft) |
| common/decisions/grand_exhibition_decision.txt | 13 | key | `building_art_academy` | grand_exhibition_decision | NARROW |
| common/journal_entries/00_art_jes.txt | 27 | key | `building_art_academy` | je_romanticism | DEAD (complete) |
| common/journal_entries/00_art_jes.txt | 28 | main PM | `pm_traditional_art` | je_romanticism | DEAD (complete) |
| common/journal_entries/00_art_jes.txt | 63 | key | `building_art_academy` | je_realism | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 70 | key | `building_art_academy` | je_realism | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 73 | main PM | `pm_realist_art` | je_realism | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 103 | key | `building_art_academy` | je_camera | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 110 | key | `building_art_academy` | je_camera | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 112 | main PM | `pm_photographic_art` | je_camera | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 116 | key | `building_art_academy` | je_camera | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 119 | main PM | `pm_photographic_art` | je_camera | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 150 | key | `building_art_academy` | je_film | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 157 | key | `building_art_academy` | je_film | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 159 | main PM | `pm_film_art` | je_film | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 163 | key | `building_art_academy` | je_film | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_art_jes.txt | 166 | main PM | `pm_film_art` | je_film | DEAD (complete) / NARROW (possible) |
| common/journal_entries/00_belle_epoque.txt | 40 | key | `building_art_academy` | je_belle_epoque | DEAD (possible) |
| common/journal_entries/00_belle_epoque.txt | 43 | main PM | `pm_photographic_art` | je_belle_epoque | DEAD (possible) |
| common/journal_entries/00_belle_epoque.txt | 44 | main PM | `pm_film_art` | je_belle_epoque | DEAD (possible) |
| common/journal_entries/00_liberalism.txt | 137 | key | `building_art_academy` | je_liberalism_3 | NARROW |
| common/journal_entries/00_player_objectives_economic_dominance.txt | 73 | key | `building_steel_mill` | je_refining_goods | NARROW |
| common/journal_entries/00_player_objectives_economic_dominance.txt | 82 | key | `building_steel_mill` | je_refining_goods | NARROW |
| common/journal_entries/00_player_objectives_economic_dominance.txt | 103 | key | `building_motor_industry` | je_specialized_goods | NARROW |
| common/journal_entries/00_player_objectives_economic_dominance.txt | 112 | key | `building_motor_industry` | je_specialized_goods | NARROW |
| common/journal_entries/00_prohibition_laws.txt | 30 | key | `building_food_industry` | je_prohibition | DEAD (possible) |
| common/journal_entries/00_trade_route_event_missions.txt | 8 | key | `building_arms_industry` | je_build_local_arms_industry | NARROW |
| common/journal_entries/03_russia.txt | 1277 | key | `building_munition_plant` | je_great_reforms_military | NARROW (mild) |
| common/laws/01_economic_system.txt | 263 | key | `building_chemical_plant` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 265 | key | `building_chemical_plant` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 269 | key | `building_synthetics_plant` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 271 | key | `building_synthetics_plant` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 275 | key | `building_steel_mill` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 277 | key | `building_steel_mill` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 287 | key | `building_motor_industry` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 289 | key | `building_motor_industry` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 293 | key | `building_automotive_industry` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 295 | key | `building_automotive_industry` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 299 | key | `building_electrics_industry` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 301 | key | `building_electrics_industry` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 305 | key | `building_munition_plant` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 307 | key | `building_munition_plant` | law_industry_banned | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 379 | key | `building_chemical_plant` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 381 | key | `building_chemical_plant` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 385 | key | `building_synthetics_plant` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 387 | key | `building_synthetics_plant` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 391 | key | `building_steel_mill` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 393 | key | `building_steel_mill` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 397 | key | `building_motor_industry` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 399 | key | `building_motor_industry` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 403 | key | `building_automotive_industry` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 405 | key | `building_automotive_industry` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 409 | key | `building_electrics_industry` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 411 | key | `building_electrics_industry` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 415 | key | `building_munition_plant` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/laws/01_economic_system.txt | 417 | key | `building_munition_plant` | law_extraction_economy | NARROW (effect misses rungs 1-3) |
| common/on_actions/00_code_on_actions.txt | 958 | key | `building_arms_industry` | on_monthly_pulse_country | NARROW |
| common/scripted_buttons/00_balkan_wars_buttons.txt | 187 | key | `building_arms_industry` | je_the_balkan_league_overwork_arms_industries_start_button | NARROW |
| common/scripted_buttons/00_balkan_wars_buttons.txt | 188 | key | `building_artillery_foundry` | je_the_balkan_league_overwork_arms_industries_start_button | NARROW |
| common/scripted_buttons/00_balkan_wars_buttons.txt | 189 | key | `building_munition_plant` | je_the_balkan_league_overwork_arms_industries_start_button | NARROW |
| common/scripted_buttons/00_balkan_wars_buttons.txt | 213 | key | `building_arms_industry` | je_the_balkan_league_overwork_arms_industries_start_button | NARROW |
| common/scripted_buttons/00_balkan_wars_buttons.txt | 214 | key | `building_artillery_foundry` | je_the_balkan_league_overwork_arms_industries_start_button | NARROW |
| common/scripted_buttons/00_balkan_wars_buttons.txt | 215 | key | `building_munition_plant` | je_the_balkan_league_overwork_arms_industries_start_button | NARROW |
| common/scripted_buttons/03_paraguay_scripted_buttons.txt | 69 | key | `building_arms_industry` | ybycui_iron_works_button | NARROW (+ may create a 2nd steel building) |
| common/scripted_buttons/03_paraguay_scripted_buttons.txt | 98 | key | `building_steel_mill` | ybycui_iron_works_button | NARROW (+ may create a 2nd steel building) |
| common/scripted_buttons/03_paraguay_scripted_buttons.txt | 103 | key | `building_steel_mill` | ybycui_iron_works_button | NARROW (+ may create a 2nd steel building) |
| common/scripted_buttons/05_serbia_buttons.txt | 15 | key | `building_paper_mill` | je_tot_slander_button | NARROW+CRAFT |
| common/scripted_buttons/06_vernacular_buttons.txt | 50 | key | `building_art_academy` | je_vernacular_policy_accept_catalan_button | NARROW |
| common/scripted_buttons/06_vernacular_buttons.txt | 67 | key | `building_art_academy` | je_vernacular_policy_accept_catalan_button | NARROW |
| common/scripted_buttons/06_vernacular_buttons.txt | 293 | key | `building_art_academy` | je_vernacular_policy_accept_galician_button | NARROW |
| common/scripted_buttons/06_vernacular_buttons.txt | 558 | key | `building_art_academy` | je_vernacular_policy_accept_breton_button | NARROW |
| common/scripted_buttons/06_vernacular_buttons.txt | 634 | key | `building_food_industry` | je_vernacular_policy_accept_occitan_button | NARROW+CRAFT |
| common/scripted_buttons/06_vernacular_buttons.txt | 694 | key | `building_steel_mill` | je_vernacular_policy_accept_wallonian_button | NARROW |
| common/scripted_effects/00_scripted_effects.txt | 80 | key | `building_textile_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 84 | key | `building_textile_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 88 | key | `building_textile_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 95 | key | `building_furniture_manufactory` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 99 | key | `building_furniture_manufactory` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 100 | main PM | `pm_mechanized_workshops` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 103 | key | `building_furniture_manufactory` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 107 | key | `building_furniture_manufactory` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 111 | key | `building_furniture_manufactory` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 118 | key | `building_tooling_workshop` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 122 | key | `building_tooling_workshop` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 126 | key | `building_tooling_workshop` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 130 | key | `building_tooling_workshop` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 137 | key | `building_paper_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 141 | key | `building_paper_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 145 | key | `building_paper_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 152 | key | `building_steel_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 156 | key | `building_steel_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 160 | key | `building_steel_mill` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 167 | key | `building_motor_industry` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 171 | key | `building_motor_industry` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_scripted_effects.txt | 175 | key | `building_motor_industry` | save_industrialized_pm_building_and_state | DEAD |
| common/scripted_effects/00_victoria_scripted_effects.txt | 3004 | key | `building_art_academy` | calculate_national_identity_progress | NARROW |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 461 | key | `building_art_academy` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 467 | key | `building_art_academy` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 601 | key | `building_artillery_foundry` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 607 | key | `building_artillery_foundry` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 612 | key | `building_munition_plant` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 618 | key | `building_munition_plant` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 623 | key | `building_arms_industry` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 629 | key | `building_arms_industry` | set_promised_building_type | SHIFT (promises the obsolete rung) |
| common/scripted_triggers/00_gfx_route_graphics_triggers.txt | 128 | key | `building_steel_mill` | gfx_mining_train_trigger | COSMETIC |
| common/scripted_triggers/00_scripted_triggers.txt | 145 | key | `building_textile_mill` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 149 | key | `building_textile_mill` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 155 | key | `building_furniture_manufactory` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 156 | main PM | `pm_mechanized_workshops` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 159 | key | `building_furniture_manufactory` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 163 | key | `building_furniture_manufactory` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 167 | key | `building_furniture_manufactory` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 173 | key | `building_tooling_workshop` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 177 | key | `building_tooling_workshop` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 181 | key | `building_tooling_workshop` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 187 | key | `building_paper_mill` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 191 | key | `building_paper_mill` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 197 | key | `building_steel_mill` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 201 | key | `building_steel_mill` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 207 | key | `building_motor_industry` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 211 | key | `building_motor_industry` | has_industrialized_pm | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 220 | key | `building_furniture_manufactory` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 222 | key | `building_furniture_manufactory` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 227 | key | `building_tooling_workshop` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 229 | key | `building_tooling_workshop` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 234 | key | `building_paper_mill` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 236 | key | `building_paper_mill` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 241 | key | `building_steel_mill` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 243 | key | `building_steel_mill` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 248 | key | `building_motor_industry` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 250 | key | `building_motor_industry` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 255 | key | `building_tooling_workshop` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 257 | key | `building_tooling_workshop` | using_watertube_boiler | DEAD |
| common/scripted_triggers/00_scripted_triggers.txt | 440 | key | `building_art_academy` | has_government_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 453 | key | `building_food_industry` | has_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 454 | key | `building_textile_mill` | has_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 455 | key | `building_furniture_manufactory` | has_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 456 | key | `building_glassworks` | has_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 457 | key | `building_tooling_workshop` | has_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 458 | key | `building_paper_mill` | has_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 464 | key | `building_food_industry` | is_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 465 | key | `building_textile_mill` | is_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 466 | key | `building_furniture_manufactory` | is_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 467 | key | `building_glassworks` | is_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 468 | key | `building_tooling_workshop` | is_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 469 | key | `building_paper_mill` | is_industry_building | NARROW+CRAFT |
| common/scripted_triggers/00_scripted_triggers.txt | 475 | key | `building_chemical_plant` | has_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 476 | key | `building_synthetics_plant` | has_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 477 | key | `building_steel_mill` | has_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 478 | key | `building_motor_industry` | has_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 479 | key | `building_automotive_industry` | has_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 480 | key | `building_electrics_industry` | has_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 481 | key | `building_munition_plant` | has_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 488 | key | `building_chemical_plant` | is_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 489 | key | `building_synthetics_plant` | is_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 490 | key | `building_steel_mill` | is_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 491 | key | `building_motor_industry` | is_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 492 | key | `building_automotive_industry` | is_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 493 | key | `building_electrics_industry` | is_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 494 | key | `building_munition_plant` | is_heavy_industry_building | NARROW |
| common/scripted_triggers/00_scripted_triggers.txt | 837 | key | `building_food_industry` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 838 | key | `building_textile_mill` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 839 | key | `building_furniture_manufactory` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 840 | key | `building_glassworks` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 841 | key | `building_tooling_workshop` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 842 | key | `building_paper_mill` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 843 | key | `building_chemical_plant` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 844 | key | `building_synthetics_plant` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 845 | key | `building_steel_mill` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 846 | key | `building_motor_industry` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 848 | key | `building_electrics_industry` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 849 | key | `building_automotive_industry` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 850 | key | `building_arms_industry` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 851 | key | `building_artillery_foundry` | is_production_building | UNUSED (no vanilla caller) |
| common/scripted_triggers/00_scripted_triggers.txt | 852 | key | `building_munition_plant` | is_production_building | UNUSED (no vanilla caller) |
| events/agitators_events/land_ownership_law_events.txt | 1577 | key | `building_steel_mill` | land_ownership_law_events.12 | OK (builds the e0 rung - thematic) |
| events/assassination_events.txt | 287 | key | `building_art_academy` | assassination_events.4 | NARROW |
| events/assassination_events.txt | 304 | key | `building_art_academy` | assassination_events.4 | NARROW |
| events/balkans_events/03_ip3_austria_events.txt | 433 | key | `building_art_academy` | austria_events.33 | NARROW |
| events/balkans_events/03_ip3_austria_events.txt | 558 | key | `building_art_academy` | austria_events.34 | NARROW |
| events/balkans_events/montenegro_events.txt | 1859 | key | `building_arms_industry` | mon_state_formation.13 | NARROW |
| events/balkans_events/montenegro_events.txt | 1866 | key | `building_arms_industry` | mon_state_formation.13 | NARROW |
| events/balkans_events/montenegro_events.txt | 1875 | key | `building_arms_industry` | mon_state_formation.13 | NARROW |
| events/balkans_events/montenegro_events.txt | 1877 | key | `building_arms_industry` | mon_state_formation.13 | NARROW |
| events/balkans_events/national_awakening.txt | 368 | key | `building_art_academy` | national_awakening.5 | NARROW |
| events/balkans_events/national_awakening.txt | 387 | key | `building_art_academy` | national_awakening.5 | NARROW |
| events/balkans_events/national_awakening.txt | 392 | key | `building_art_academy` | national_awakening.5 | NARROW |
| events/belle_epoque_events.txt | 135 | key | `building_art_academy` | belle_epoque_events.2 | NARROW |
| events/belle_epoque_events.txt | 151 | key | `building_art_academy` | belle_epoque_events.2 | NARROW |
| events/belle_epoque_events.txt | 280 | key | `building_art_academy` | belle_epoque_events.3 | NARROW |
| events/belle_epoque_events.txt | 287 | key | `building_art_academy` | belle_epoque_events.3 | NARROW |
| events/belle_epoque_events.txt | 602 | key | `building_electrics_industry` | belle_epoque_events.6 | OK (electrics, 1 rung) / NARROW (art academy) |
| events/belle_epoque_events.txt | 610 | key | `building_electrics_industry` | belle_epoque_events.6 | OK (electrics, 1 rung) / NARROW (art academy) |
| events/belle_epoque_events.txt | 631 | key | `building_art_academy` | belle_epoque_events.6 | OK (electrics, 1 rung) / NARROW (art academy) |
| events/belle_epoque_events.txt | 636 | key | `building_art_academy` | belle_epoque_events.6 | OK (electrics, 1 rung) / NARROW (art academy) |
| events/belle_epoque_events.txt | 781 | key | `building_automotive_industry` | belle_epoque_events.8 | NARROW |
| events/belle_epoque_events.txt | 1418 | key | `building_textile_mill` | belle_epoque_events.14 | NARROW+CRAFT (option) ; launcher DEAD (secondary PM) |
| events/brazil/amazonas.txt | 420 | key | `building_art_academy` | amazonas.5 | OK (creates e0; may duplicate) |
| events/brazil/amazonas.txt | 425 | key | `building_art_academy` | amazonas.5 | OK (creates e0; may duplicate) |
| events/brazil/paraguay.txt | 355 | key | `building_steel_mill` | paraguay.3 | OK (creates e0; may duplicate) |
| events/brazil/paraguay.txt | 360 | key | `building_steel_mill` | paraguay.3 | OK (creates e0; may duplicate) |
| events/decree_events.txt | 498 | key | `building_art_academy` | decree_events.5 | NARROW |
| events/decree_events.txt | 517 | key | `building_art_academy` | decree_events.5 | NARROW |
| events/decree_events_02.txt | 29 | key | `building_food_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 30 | key | `building_textile_mill` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 31 | key | `building_furniture_manufactory` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 32 | key | `building_glassworks` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 33 | key | `building_tooling_workshop` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 34 | key | `building_paper_mill` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 35 | key | `building_chemical_plant` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 36 | key | `building_explosives_factory` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 37 | key | `building_synthetics_plant` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 38 | key | `building_steel_mill` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 39 | key | `building_motor_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 41 | key | `building_automotive_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 42 | key | `building_electrics_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 43 | key | `building_arms_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 44 | key | `building_munition_plant` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 71 | key | `building_food_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 72 | key | `building_textile_mill` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 73 | key | `building_furniture_manufactory` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 74 | key | `building_glassworks` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 75 | key | `building_tooling_workshop` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 76 | key | `building_paper_mill` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 77 | key | `building_chemical_plant` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 78 | key | `building_explosives_factory` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 79 | key | `building_synthetics_plant` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 80 | key | `building_steel_mill` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 81 | key | `building_motor_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 83 | key | `building_automotive_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 84 | key | `building_electrics_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 85 | key | `building_arms_industry` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 86 | key | `building_munition_plant` | decree_events.100 | NARROW+CRAFT |
| events/decree_events_02.txt | 150 | key | `building_food_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 151 | key | `building_textile_mill` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 152 | key | `building_furniture_manufactory` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 153 | key | `building_glassworks` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 154 | key | `building_tooling_workshop` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 155 | key | `building_paper_mill` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 156 | key | `building_chemical_plant` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 157 | key | `building_explosives_factory` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 158 | key | `building_synthetics_plant` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 159 | key | `building_steel_mill` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 160 | key | `building_motor_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 162 | key | `building_automotive_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 163 | key | `building_electrics_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 164 | key | `building_arms_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 165 | key | `building_munition_plant` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 194 | key | `building_food_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 195 | key | `building_textile_mill` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 196 | key | `building_furniture_manufactory` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 197 | key | `building_glassworks` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 198 | key | `building_tooling_workshop` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 199 | key | `building_paper_mill` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 200 | key | `building_chemical_plant` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 201 | key | `building_explosives_factory` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 202 | key | `building_synthetics_plant` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 203 | key | `building_steel_mill` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 204 | key | `building_motor_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 206 | key | `building_automotive_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 207 | key | `building_electrics_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 208 | key | `building_arms_industry` | decree_events.101 | NARROW+CRAFT |
| events/decree_events_02.txt | 209 | key | `building_munition_plant` | decree_events.101 | NARROW+CRAFT |
| events/fascism_events.txt | 949 | key | `building_art_academy` | fascism_events.8 | NARROW |
| events/fascism_events.txt | 1011 | key | `building_art_academy` | fascism_events.8 | NARROW |
| events/fascism_events.txt | 1017 | key | `building_art_academy` | fascism_events.8 | NARROW |
| events/iberia_events/ip4_anarchism_events.txt | 379 | key | `building_art_academy` | anarchism_events.3 | NARROW |
| events/ig_suppression_events.txt | 853 | key | `building_art_academy` | ig_suppression_events.1000 | NARROW |
| events/industrial_accidents_events.txt | 53 | key | `building_textile_mill` | industrial_accident_events.1 | SHIFT (fires on crafts) |
| events/industrial_accidents_events.txt | 56 | key | `building_textile_mill` | industrial_accident_events.1 | SHIFT (fires on crafts) |
| events/industrial_accidents_events.txt | 97 | key | `building_textile_mill` | industrial_accident_events.1 | SHIFT (fires on crafts) |
| events/industrial_accidents_events.txt | 100 | key | `building_textile_mill` | industrial_accident_events.1 | SHIFT (fires on crafts) |
| events/industrial_accidents_events.txt | 169 | key | `building_textile_mill` | industrial_accident_events.2 | NARROW+CRAFT |
| events/industrial_accidents_events.txt | 184 | key | `building_textile_mill` | industrial_accident_events.2 | NARROW+CRAFT |
| events/industrial_accidents_events.txt | 327 | key | `building_food_industry` | industrial_accident_events.4 | DEAD |
| events/industrial_accidents_events.txt | 330 | key | `building_food_industry` | industrial_accident_events.4 | DEAD |
| events/industrial_accidents_events.txt | 342 | key | `building_food_industry` | industrial_accident_events.4 | DEAD |
| events/industrial_accidents_events.txt | 345 | key | `building_food_industry` | industrial_accident_events.4 | DEAD |
| events/japan_events/ep2_japan_events_03.txt | 157 | key | `building_art_academy` | japan_events.32 | DEAD |
| events/japan_events/ep2_japan_events_03.txt | 158 | main PM | `pm_traditional_art` | japan_events.32 | DEAD |
| events/japan_events/ep2_japan_events_03.txt | 161 | key | `building_art_academy` | japan_events.32 | DEAD |
| events/japan_events/ep2_japan_events_03.txt | 173 | key | `building_art_academy` | japan_events.32 | DEAD |
| events/japan_events/ep2_japan_events_03.txt | 174 | main PM | `pm_traditional_art` | japan_events.32 | DEAD |
| events/japan_events/ep2_japan_events_03.txt | 179 | key | `building_art_academy` | japan_events.32 | DEAD |
| events/krakatoa_events.txt | 683 | key | `building_art_academy` | krakatoa.4 | NARROW |
| events/krakatoa_events.txt | 696 | key | `building_art_academy` | krakatoa.4 | NARROW |
| events/krakatoa_events.txt | 701 | key | `building_art_academy` | krakatoa.4 | NARROW |
| events/law_events/citizenship_laws.txt | 142 | key | `building_art_academy` | citizenship_laws.2 | NARROW |
| events/law_events/citizenship_laws.txt | 175 | key | `building_art_academy` | citizenship_laws.2 | NARROW |
| events/law_events/economy_laws.txt | 444 | key | `building_arms_industry` | economy_laws.6 | NARROW |
| events/law_events/economy_laws.txt | 455 | key | `building_arms_industry` | economy_laws.6 | NARROW |
| events/liberalism.txt | 71 | key | `building_art_academy` | liberalism.1 | NARROW |
| events/liberalism.txt | 122 | key | `building_art_academy` | liberalism.1 | NARROW |
| events/liberalism.txt | 166 | key | `building_art_academy` | liberalism.1 | NARROW |
| events/pm_events.txt | 181 | key | `building_food_industry` | pm_events.3 | DEAD |
| events/pm_events.txt | 185 | key | `building_food_industry` | pm_events.3 | DEAD |
| events/pm_events.txt | 207 | key | `building_food_industry` | pm_events.3 | DEAD |
| events/pm_events.txt | 211 | key | `building_food_industry` | pm_events.3 | DEAD |
| events/pm_events.txt | 316 | key | `building_arms_industry` | pm_events.4 | NARROW |
| events/pm_events.txt | 325 | key | `building_arms_industry` | pm_events.4 | NARROW |
| events/tech_events/camera_film_pm_events.txt | 31 | key | `building_art_academy` | camera_film_pm_events.1 | DEAD (chained from je_camera) |
| events/tech_events/camera_film_pm_events.txt | 32 | main PM | `pm_photographic_art` | camera_film_pm_events.1 | DEAD (chained from je_camera) |
| events/tech_events/camera_film_pm_events.txt | 94 | key | `building_art_academy` | camera_film_pm_events.2 | DEAD (chained from je_film) |
| events/tech_events/camera_film_pm_events.txt | 95 | main PM | `pm_film_art` | camera_film_pm_events.2 | DEAD (chained from je_film) |
| events/tech_events/military_tech_events.txt | 27 | key | `building_arms_industry` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 31 | main PM | `pm_rifles` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 32 | main PM | `pm_repeaters` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 33 | main PM | `pm_bolt_action_rifles` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 43 | key | `building_arms_industry` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 47 | main PM | `pm_rifles` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 48 | main PM | `pm_repeaters` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 49 | main PM | `pm_bolt_action_rifles` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 56 | key | `building_arms_industry` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 60 | main PM | `pm_rifles` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 61 | main PM | `pm_repeaters` | military_tech_events.401 | DEAD |
| events/tech_events/military_tech_events.txt | 62 | main PM | `pm_bolt_action_rifles` | military_tech_events.401 | DEAD |
| events/tech_events/production_tech_events.txt | 83 | key | `building_munition_plant` | production_tech_events.102 | NARROW |
| events/tech_events/production_tech_events.txt | 91 | key | `building_explosives_factory` | production_tech_events.102 | NARROW |
| events/tech_events/production_tech_events.txt | 167 | key | `building_motor_industry` | production_tech_events.103 | VANILLA-DEAD (motor + automobile PM) |
| events/tech_events/production_tech_events.txt | 170 | main PM | `pm_automobile_production` | production_tech_events.103 | VANILLA-DEAD (motor + automobile PM) |
| events/tech_events/production_tech_events.txt | 239 | key | `building_glassworks` | production_tech_events.200 | DEAD |
| events/tech_events/production_tech_events.txt | 249 | main PM | `pm_houseware_plastics` | production_tech_events.200 | DEAD |
| events/tech_events/production_tech_events.txt | 256 | key | `building_glassworks` | production_tech_events.200 | DEAD |
| events/tech_events/production_tech_events.txt | 329 | key | `building_electrics_industry` | production_tech_events.210 | DEAD (secondary pm_radios renamed) |
| events/tech_events/production_tech_events.txt | 344 | key | `building_glassworks` | production_tech_events.210 | DEAD (secondary pm_radios renamed) |
| events/tech_events/production_tech_events.txt | 414 | key | `building_electrics_industry` | production_tech_events.300 | OK trigger / SHIFT (option b loses its scope) |
| events/tech_events/production_tech_events.txt | 428 | key | `building_electrics_industry` | production_tech_events.300 | OK trigger / SHIFT (option b loses its scope) |
| events/tech_events/production_tech_events.txt | 432 | main PM | `pm_telephones` | production_tech_events.300 | OK trigger / SHIFT (option b loses its scope) |
| events/tech_events/production_tech_events.txt | 438 | key | `building_electrics_industry` | production_tech_events.300 | OK trigger / SHIFT (option b loses its scope) |
| events/tech_events/production_tech_events.txt | 442 | main PM | `pm_telephones` | production_tech_events.300 | OK trigger / SHIFT (option b loses its scope) |
| events/tech_events/production_tech_events.txt | 762 | key | `building_motor_industry` | production_tech_events.501 | NARROW |
| events/tech_events/production_tech_events.txt | 840 | key | `building_motor_industry` | production_tech_events.501 | NARROW |
| events/tech_events/production_tech_events.txt | 845 | key | `building_motor_industry` | production_tech_events.501 | NARROW |
| events/tech_events/production_tech_events.txt | 879 | key | `building_motor_industry` | production_tech_events.501 | NARROW |
| events/tech_events/production_tech_events.txt | 1065 | key | `building_motor_industry` | production_tech_events.700 | NARROW |
| events/tech_events/production_tech_events.txt | 1105 | key | `building_motor_industry` | production_tech_events.700 | NARROW |
| events/tech_events/society_tech_events.txt | 8 | key | `building_steel_mill` | society_tech_events.104 | NARROW+CRAFT |
| events/tech_events/society_tech_events.txt | 11 | key | `building_glassworks` | society_tech_events.104 | NARROW+CRAFT |
| events/tech_events/society_tech_events.txt | 219 | key | `building_art_academy` | society_tech_events.302 | DEAD (chained from je_romanticism) |
| events/tech_events/society_tech_events.txt | 227 | key | `building_art_academy` | society_tech_events.302 | DEAD (chained from je_romanticism) |
| events/tech_events/society_tech_events.txt | 228 | main PM | `pm_traditional_art` | society_tech_events.302 | DEAD (chained from je_romanticism) |
| events/tech_events/society_tech_events.txt | 447 | key | `building_art_academy` | dt_society_events.2 | DEAD (chained from je_realism) |
| events/tech_events/society_tech_events.txt | 449 | main PM | `pm_realist_art` | dt_society_events.2 | DEAD (chained from je_realism) |
| events/tech_events/society_tech_events.txt | 458 | key | `building_art_academy` | dt_society_events.2 | DEAD (chained from je_realism) |
| events/tech_events/society_tech_events.txt | 460 | main PM | `pm_realist_art` | dt_society_events.2 | DEAD (chained from je_realism) |
| events/tech_events/war_crimes_events.txt | 143 | key | `building_munition_plant` | war_crimes.2 | NARROW |
| events/tech_events/war_crimes_events.txt | 154 | key | `building_munition_plant` | war_crimes.2 | NARROW |
| events/trade_route_events.txt | 25 | key | `building_arms_industry` | trade_route_events.1 | SHIFT (fires for countries with modern arms) |
| events/tech_events/society_tech_events.txt | 452 | key (b: link) | `b:building_art_academy.level` | dt_society_events.2 | DEAD (chained from je_realism) |

## Appendix B — (b′) secondary-method lines (all DEAD: the names were minted per industry)

| File | Line | Text |
|---|---|---|
| common/journal_entries/00_belle_epoque.txt | 260 | `has_active_production_method = pm_craftsman_sewing` |
| common/scripted_effects/00_scripted_effects.txt | 85 | `production_method = pm_mechanized_looms` |
| common/scripted_effects/00_scripted_effects.txt | 89 | `production_method = pm_automatic_power_looms` |
| common/scripted_effects/00_scripted_effects.txt | 104 | `production_method = pm_watertube_boiler_building_furniture_manufactory` |
| common/scripted_effects/00_scripted_effects.txt | 108 | `production_method = pm_rotary_valve_engine_building_furniture_manufactory` |
| common/scripted_effects/00_scripted_effects.txt | 112 | `production_method = pm_assembly_lines_building_furniture_manufactory` |
| common/scripted_effects/00_scripted_effects.txt | 123 | `production_method = pm_watertube_boiler_building_tooling_workshop` |
| common/scripted_effects/00_scripted_effects.txt | 127 | `production_method = pm_rotary_valve_engine_building_tooling_workshop` |
| common/scripted_effects/00_scripted_effects.txt | 131 | `production_method = pm_assembly_lines_building_tooling_workshop` |
| common/scripted_effects/00_scripted_effects.txt | 142 | `production_method = pm_watertube_boiler_building_paper_mill` |
| common/scripted_effects/00_scripted_effects.txt | 146 | `production_method = pm_rotary_valve_engine_building_paper_mill` |
| common/scripted_effects/00_scripted_effects.txt | 157 | `production_method = pm_watertube_boiler_building_steel_mill` |
| common/scripted_effects/00_scripted_effects.txt | 161 | `production_method = pm_rotary_valve_engine_building_steel_mill` |
| common/scripted_effects/00_scripted_effects.txt | 172 | `production_method = pm_watertube_boiler_building_motor_industry` |
| common/scripted_effects/00_scripted_effects.txt | 176 | `production_method = pm_rotary_valve_engine_building_motor_industry` |
| common/scripted_triggers/00_scripted_triggers.txt | 146 | `production_method = pm_mechanized_looms` |
| common/scripted_triggers/00_scripted_triggers.txt | 150 | `production_method = pm_automatic_power_looms` |
| common/scripted_triggers/00_scripted_triggers.txt | 160 | `production_method = pm_watertube_boiler_building_furniture_manufactory` |
| common/scripted_triggers/00_scripted_triggers.txt | 164 | `production_method = pm_rotary_valve_engine_building_furniture_manufactory` |
| common/scripted_triggers/00_scripted_triggers.txt | 168 | `production_method = pm_assembly_lines_building_furniture_manufactory` |
| common/scripted_triggers/00_scripted_triggers.txt | 174 | `production_method = pm_watertube_boiler_building_tooling_workshop` |
| common/scripted_triggers/00_scripted_triggers.txt | 178 | `production_method = pm_rotary_valve_engine_building_tooling_workshop` |
| common/scripted_triggers/00_scripted_triggers.txt | 182 | `production_method = pm_assembly_lines_building_tooling_workshop` |
| common/scripted_triggers/00_scripted_triggers.txt | 188 | `production_method = pm_watertube_boiler_building_paper_mill` |
| common/scripted_triggers/00_scripted_triggers.txt | 192 | `production_method = pm_rotary_valve_engine_building_paper_mill` |
| common/scripted_triggers/00_scripted_triggers.txt | 198 | `production_method = pm_watertube_boiler_building_steel_mill` |
| common/scripted_triggers/00_scripted_triggers.txt | 202 | `production_method = pm_rotary_valve_engine_building_steel_mill` |
| common/scripted_triggers/00_scripted_triggers.txt | 208 | `production_method = pm_watertube_boiler_building_motor_industry` |
| common/scripted_triggers/00_scripted_triggers.txt | 212 | `production_method = pm_rotary_valve_engine_building_motor_industry` |
| common/scripted_triggers/00_scripted_triggers.txt | 223 | `production_method = pm_watertube_boiler_building_furniture_manufactory` |
| common/scripted_triggers/00_scripted_triggers.txt | 230 | `production_method = pm_watertube_boiler_building_tooling_workshop` |
| common/scripted_triggers/00_scripted_triggers.txt | 237 | `production_method = pm_watertube_boiler_building_paper_mill` |
| common/scripted_triggers/00_scripted_triggers.txt | 244 | `production_method = pm_watertube_boiler_building_steel_mill` |
| common/scripted_triggers/00_scripted_triggers.txt | 251 | `production_method = pm_watertube_boiler_building_motor_industry` |
| common/scripted_triggers/00_scripted_triggers.txt | 258 | `production_method = pm_watertube_boiler_building_tooling_workshop` |
| common/scripted_triggers/00_scripted_triggers.txt | 936 | `has_active_production_method = pm_pot_stills` |
| common/scripted_triggers/00_scripted_triggers.txt | 937 | `has_active_production_method = pm_patent_stills` |
| common/scripted_triggers/00_scripted_triggers.txt | 944 | `has_active_production_method = pm_pot_stills` |
| common/scripted_triggers/00_scripted_triggers.txt | 945 | `has_active_production_method = pm_patent_stills` |
| events/belle_epoque_events.txt | 1375 | `has_active_production_method = pm_craftsman_sewing` |
| events/industrial_accidents_events.txt | 57 | `production_method = pm_traditional_looms` |
| events/industrial_accidents_events.txt | 101 | `production_method = pm_traditional_looms` |
| events/industrial_accidents_events.txt | 331 | `production_method = pm_disabled_distillery` |
| events/industrial_accidents_events.txt | 346 | `production_method = pm_disabled_distillery` |
| events/pm_events.txt | 182 | `production_method = pm_pot_stills` |
| events/pm_events.txt | 186 | `production_method = pm_patent_stills` |
| events/pm_events.txt | 208 | `production_method = pm_pot_stills` |
| events/pm_events.txt | 212 | `production_method = pm_patent_stills` |
| events/tech_events/production_tech_events.txt | 337 | `has_active_production_method = pm_radios` |

## Appendix C — building-group lines (c)

| File | Line | Text | Block | Verdict |
|---|---|---|---|---|
| common/ai_strategies/01_admin_strategies.txt | 11 | `bg_manufacturing = 0.5` | ai_strategy_agricultural_expansion | OK (group matches children) |
| common/ai_strategies/01_admin_strategies.txt | 136 | `bg_manufacturing = 0.5` | ai_strategy_plantation_economy | OK (group matches children) |
| common/ai_strategies/01_admin_strategies.txt | 341 | `bg_manufacturing = 1.25` | ai_strategy_industrial_expansion | OK (group matches children) |
| common/ai_strategies/01_admin_strategies.txt | 487 | `bg_manufacturing = 0.25` | ai_strategy_placate_population | OK (group matches children) |
| common/ai_strategies/01_admin_strategies.txt | 621 | `bg_manufacturing = 0.5` | ai_strategy_montenegro_admin | OK (group matches children) |
| common/ai_strategies/02_diplomatic_strategies.txt | 1509 | `bg_military_industry = 1.5` | ai_strategy_unify_germany | OK (group matches children) |
| common/ai_strategies/02_diplomatic_strategies.txt | 3354 | `bg_military_industry = 1.5` | ai_strategy_prussia_of_the_balkans | OK (group matches children) |
| common/ai_strategies/02_subject_diplomatic_strategies.txt | 48 | `bg_military_industry = 1.5` | ai_strategy_subject_break_free | OK (group matches children) |
| common/ai_strategies/02_subject_diplomatic_strategies.txt | 224 | `bg_military_industry = 1.5` | ai_strategy_subject_strengthen_self | OK (group matches children) |
| common/decrees/00_decree.txt | 598 | `is_building_group = bg_manufacturing` | decree_encourage_manufacturing_industry | OK (group matches children) |
| common/decrees/00_decree.txt | 606 | `is_building_group = bg_manufacturing` | decree_encourage_manufacturing_industry | OK (group matches children) |
| common/decrees/00_decree.txt | 615 | `is_building_group = bg_manufacturing` | decree_encourage_manufacturing_industry | OK (group matches children) |
| common/ideologies/01_character_ideologies.txt | 6530 | `is_building_group = bg_heavy_industry` | ideology_luddite | OK (group matches children) |
| common/ideologies/01_character_ideologies.txt | 6547 | `is_building_group = bg_heavy_industry` | ideology_luddite | OK (group matches children) |
| common/ideologies/01_character_ideologies.txt | 6615 | `is_building_group = bg_heavy_industry` | ideology_luddite | OK (group matches children) |
| common/ideologies/01_character_ideologies.txt | 6629 | `is_building_group = bg_heavy_industry` | ideology_luddite | OK (group matches children) |
| common/interest_groups/00_armed_forces.txt | 402 | `pop_employment_building_group = bg_military_industry` | ig_armed_forces | OK (group matches children) |
| common/interest_groups/00_intelligentsia.txt | 346 | `pop_employment_building_group = bg_arts` | ig_intelligentsia | OK (group matches children) |
| common/interest_groups/00_petty_bourgeoisie.txt | 260 | `pop_employment_building_group = bg_manufacturing` | ig_petty_bourgeoisie | OK (group matches children) |
| common/journal_entries/00_strike_je.txt | 55 | `pop_employment_building_group = bg_manufacturing` | je_strike | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 449 | `type = bg_light_industry` | je_spa_economic_regeneration_light_industry | SHIFT? (craft levels x10, if group-level counters include child groups - unverified) |
| common/journal_entries/06_economic_regeneration.txt | 453 | `type = bg_heavy_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 457 | `type = bg_military_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 481 | `type = bg_light_industry` | je_spa_economic_regeneration_light_industry | SHIFT? (craft levels x10, if group-level counters include child groups - unverified) |
| common/journal_entries/06_economic_regeneration.txt | 485 | `type = bg_heavy_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 489 | `type = bg_military_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 538 | `type = bg_light_industry` | je_spa_economic_regeneration_light_industry | SHIFT? (craft levels x10, if group-level counters include child groups - unverified) |
| common/journal_entries/06_economic_regeneration.txt | 542 | `type = bg_heavy_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 546 | `type = bg_military_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 589 | `type = bg_light_industry` | je_spa_economic_regeneration_light_industry | SHIFT? (craft levels x10, if group-level counters include child groups - unverified) |
| common/journal_entries/06_economic_regeneration.txt | 593 | `type = bg_heavy_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/journal_entries/06_economic_regeneration.txt | 597 | `type = bg_military_industry` | je_spa_economic_regeneration_light_industry | OK (group matches children) |
| common/scripted_buttons/06_vernacular_buttons.txt | 137 | `is_building_group = bg_light_industry` | je_vernacular_policy_accept_aragonese_button | SHIFT (one craft building passes a factory-sized level threshold) |
| common/scripted_buttons/06_vernacular_buttons.txt | 210 | `is_building_group = bg_light_industry` | je_vernacular_policy_accept_asturleonese_button | SHIFT (one craft building passes a factory-sized level threshold) |
| common/scripted_buttons/06_vernacular_buttons.txt | 355 | `is_building_group = bg_heavy_industry` | je_vernacular_policy_accept_basque_button | OK (group matches children) |
| common/scripted_buttons/06_vernacular_buttons.txt | 356 | `is_building_group = bg_military_industry` | je_vernacular_policy_accept_basque_button | OK (group matches children) |
| common/scripted_buttons/06_vernacular_buttons.txt | 449 | `is_building_group = bg_light_industry` | je_vernacular_policy_accept_francoprovencal_button | SHIFT (one craft building passes a factory-sized level threshold) |
| common/scripted_buttons/06_vernacular_buttons.txt | 471 | `is_building_group = bg_heavy_industry` | je_vernacular_policy_accept_francoprovencal_button | OK (group matches children) |
| common/scripted_buttons/06_vernacular_buttons.txt | 472 | `is_building_group = bg_military_industry` | je_vernacular_policy_accept_francoprovencal_button | OK (group matches children) |
| common/scripted_buttons/06_vernacular_buttons.txt | 618 | `is_building_group = bg_light_industry` | je_vernacular_policy_accept_occitan_button | SHIFT (one craft building passes a factory-sized level threshold) |
| common/scripted_effects/00_victoria_scripted_effects.txt | 841 | `is_building_group = bg_heavy_industry` | adopt_random_antigovernment_ideology | OK (group matches children) |
| common/scripted_effects/00_victoria_scripted_effects.txt | 842 | `is_building_group = bg_military_industry` | adopt_random_antigovernment_ideology | OK (group matches children) |
| common/scripted_effects/00_victoria_scripted_effects.txt | 857 | `is_building_group = bg_heavy_industry` | adopt_random_antigovernment_ideology | OK (group matches children) |
| common/scripted_effects/00_victoria_scripted_effects.txt | 858 | `is_building_group = bg_military_industry` | adopt_random_antigovernment_ideology | OK (group matches children) |
| common/scripted_effects/00_victoria_scripted_effects.txt | 2264 | `is_building_group = bg_manufacturing` | fra_weekly_pulse_orleanist_progress | SHIFT (craft levels x10 inflate Orleanist progress) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 403 | `is_building_group = bg_heavy_industry` | set_promised_building_type | OK (picks a real type; craft costs 6 points so the promised level count is cost-normalised) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 413 | `is_building_group = bg_heavy_industry` | set_promised_building_type | OK (picks a real type; craft costs 6 points so the promised level count is cost-normalised) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 542 | `is_building_group = bg_light_industry` | set_promised_building_type | OK (picks a real type; craft costs 6 points so the promised level count is cost-normalised) |
| common/scripted_effects/04_negotiation_scripted_effects.txt | 549 | `is_building_group = bg_light_industry` | set_promised_building_type | OK (picks a real type; craft costs 6 points so the promised level count is cost-normalised) |
| events/agitators_events/coup_events.txt | 320 | `is_building_group = bg_light_industry` | coup_pulse_events.4 | OK (group matches children) |
| events/agitators_events/coup_events.txt | 321 | `is_building_group = bg_heavy_industry` | coup_pulse_events.4 | OK (group matches children) |
| events/agitators_events/coup_events.txt | 367 | `is_building_group = bg_light_industry` | coup_pulse_events.4 | OK (group matches children) |
| events/agitators_events/coup_events.txt | 379 | `is_building_group = bg_heavy_industry` | coup_pulse_events.4 | OK (group matches children) |
| events/agitators_events/luddite_law_events.txt | 212 | `is_building_group = bg_light_industry` | luddite_law_events.3 | OK (group matches children) |
| events/agitators_events/luddite_law_events.txt | 213 | `is_building_group = bg_heavy_industry` | luddite_law_events.3 | OK (group matches children) |
| events/agitators_events/luddite_law_events.txt | 238 | `is_building_group = bg_light_industry` | luddite_law_events.3 | OK (group matches children) |
| events/agitators_events/luddite_law_events.txt | 239 | `is_building_group = bg_heavy_industry` | luddite_law_events.3 | OK (group matches children) |
| events/agitators_events/luddite_law_events.txt | 250 | `is_building_group = bg_light_industry` | luddite_law_events.3 | OK (group matches children) |
| events/agitators_events/luddite_law_events.txt | 251 | `is_building_group = bg_heavy_industry` | luddite_law_events.3 | OK (group matches children) |
| events/agitators_events/revolution_events_02.txt | 5368 | `is_building_group = bg_light_industry` | revolution_pulse_events.33 | OK (group matches children) |
| events/agitators_events/revolution_events_02.txt | 5369 | `is_building_group = bg_heavy_industry` | revolution_pulse_events.33 | OK (group matches children) |
| events/agitators_events/revolution_events_02.txt | 5411 | `is_building_group = bg_light_industry` | revolution_pulse_events.33 | OK (group matches children) |
| events/agitators_events/revolution_events_02.txt | 5412 | `is_building_group = bg_heavy_industry` | revolution_pulse_events.33 | OK (group matches children) |
| events/discrimination_events.txt | 472 | `is_building_group = bg_manufacturing` | discrimination_events.4 | OK (group matches children) |
| events/discrimination_events.txt | 479 | `pop_employment_building_group = bg_manufacturing` | discrimination_events.4 | OK (group matches children) |
| events/discrimination_events.txt | 512 | `is_building_group = bg_manufacturing` | discrimination_events.4 | OK (group matches children) |
| events/discrimination_events.txt | 519 | `pop_employment_building_group = bg_manufacturing` | discrimination_events.4 | OK (group matches children) |
| events/discrimination_events.txt | 535 | `pop_employment_building_group = bg_manufacturing` | discrimination_events.4 | OK (group matches children) |
| events/law_events/labour_associations_events.txt | 327 | `is_building_group = bg_manufacturing` | labour_associations_events.4 | OK (group matches children) |
| events/law_events/labour_associations_events.txt | 347 | `is_building_group = bg_manufacturing` | labour_associations_events.4 | OK (group matches children) |
| events/law_events/technocracy_law.txt | 167 | `pop_employment_building_group = bg_light_industry` | technocracy.2 | OK (group matches children) |
| events/law_events/technocracy_law.txt | 168 | `pop_employment_building_group = bg_heavy_industry` | technocracy.2 | OK (group matches children) |
| events/law_events/technocracy_law.txt | 184 | `pop_employment_building_group = bg_light_industry` | technocracy.2 | OK (group matches children) |
| events/law_events/technocracy_law.txt | 185 | `pop_employment_building_group = bg_heavy_industry` | technocracy.2 | OK (group matches children) |
| events/law_events/technocracy_law.txt | 194 | `pop_employment_building_group = bg_light_industry` | technocracy.2 | OK (group matches children) |
| events/law_events/technocracy_law.txt | 195 | `pop_employment_building_group = bg_heavy_industry` | technocracy.2 | OK (group matches children) |
| events/strike_events.txt | 53 | `pop_employment_building_group = bg_manufacturing` | strike.1 | OK (group matches children) |
| events/strike_events.txt | 69 | `pop_employment_building_group = bg_manufacturing` | strike.1 | OK (group matches children) |
| events/strike_events.txt | 80 | `pop_employment_building_group = bg_manufacturing` | strike.1 | OK (group matches children) |

## Appendix D — per-building throughput modifier lines (e), all NARROW to rung 0

| File | Line | Text |
|---|---|---|
| common/amendments/00_amendments_enactment_04.txt | 688 | `building_art_academy_throughput_add = -0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 902 | `building_automotive_industry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 903 | `building_arms_industry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 904 | `building_artillery_foundry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 947 | `building_automotive_industry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 948 | `building_arms_industry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 949 | `building_artillery_foundry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 967 | `building_automotive_industry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 968 | `building_arms_industry_throughput_add = 0.1` |
| common/power_bloc_principles/00_power_bloc_principles.txt | 969 | `building_artillery_foundry_throughput_add = 0.1` |
| common/static_modifiers/00_ep2_03_modifiers.txt | 25 | `building_art_academy_throughput_add = 0.05` |
| common/static_modifiers/00_ip3_02_modifiers.txt | 215 | `building_art_academy_throughput_add = 0.1` |
| common/static_modifiers/00_ip3_02_modifiers.txt | 388 | `building_art_academy_throughput_add = 0.1` |
| common/static_modifiers/00_ip3_03_modifiers.txt | 161 | `building_art_academy_throughput_add = 0.25` |
| common/static_modifiers/00_ip3_03_modifiers.txt | 230 | `building_art_academy_throughput_add = 0.25` |
| common/static_modifiers/00_ip3_03_modifiers.txt | 240 | `building_art_academy_throughput_add = 0.1` |
| common/static_modifiers/00_ip3_04_modifiers.txt | 210 | `building_art_academy_throughput_add = 0.10` |
| common/static_modifiers/00_ip3_04_modifiers.txt | 342 | `building_art_academy_throughput_add = 0.05` |
| common/static_modifiers/00_ip3_04_modifiers.txt | 359 | `building_art_academy_throughput_add = 0.05` |
| common/static_modifiers/00_ip4_03_modifiers.txt | 140 | `building_art_academy_throughput_add = 0.05` |
| common/static_modifiers/00_ip4_04_modifiers.txt | 306 | `building_art_academy_throughput_add = 0.15` |
| common/static_modifiers/02_event_modifiers.txt | 512 | `building_food_industry_throughput_add = -0.5` |
| common/static_modifiers/02_event_modifiers.txt | 1254 | `building_motor_industry_throughput_add = -0.1` |
| common/static_modifiers/02_event_modifiers.txt | 1515 | `building_glassworks_throughput_add = 0.33` |
| common/static_modifiers/02_event_modifiers.txt | 1525 | `building_explosives_factory_throughput_add = 0.33` |
| common/static_modifiers/02_event_modifiers.txt | 1538 | `building_munition_plant_throughput_add = 0.33` |
| common/static_modifiers/02_event_modifiers.txt | 1543 | `building_motor_industry_throughput_add = 0.33` |
| common/static_modifiers/02_event_modifiers.txt | 1553 | `building_motor_industry_throughput_add = 0.33` |
| common/static_modifiers/02_event_modifiers.txt | 1563 | `building_electrics_industry_throughput_add = 0.33` |
| common/static_modifiers/02_event_modifiers.txt | 1720 | `building_steel_mill_throughput_add = 0.2` |
| common/static_modifiers/02_event_modifiers.txt | 1721 | `building_glassworks_throughput_add = 0.2` |
| common/static_modifiers/02_event_modifiers.txt | 1746 | `building_art_academy_throughput_add = 0.15` |
| common/static_modifiers/02_event_modifiers.txt | 1757 | `building_art_academy_throughput_add = 0.2` |
| common/static_modifiers/104_modifiers.txt | 636 | `building_art_academy_throughput_add = 0.15` |
| common/static_modifiers/104_modifiers.txt | 794 | `building_art_academy_throughput_add = -0.5` |
| common/static_modifiers/104_modifiers.txt | 799 | `building_art_academy_throughput_add = 0.2` |
| common/static_modifiers/105_modifiers.txt | 176 | `building_art_academy_throughput_add = 0.1` |
| common/static_modifiers/105_modifiers.txt | 284 | `building_art_academy_throughput_add = -0.1` |
| common/static_modifiers/agitators_4_modifiers.txt | 713 | `building_electrics_industry_throughput_add = 0.10` |
| common/static_modifiers/agitators_4_modifiers.txt | 772 | `building_textile_mill_throughput_add = 0.25` |
| common/static_modifiers/agitators_4_modifiers.txt | 788 | `building_art_academy_throughput_add = 0.10` |
| common/static_modifiers/agitators_4_modifiers.txt | 804 | `building_art_academy_throughput_add = 0.10` |
| common/static_modifiers/agitators_4_modifiers.txt | 810 | `building_art_academy_throughput_add = 0.25` |
| common/static_modifiers/agitators_4_revolution_modifiers.txt | 487 | `building_paper_mill_throughput_add = 0.1` |
| common/static_modifiers/brazil_2_modifiers.txt | 214 | `building_art_academy_throughput_add = 0.1` |
| common/static_modifiers/brazil_2_modifiers.txt | 299 | `building_steel_mill_throughput_add = 0.1` |
| common/static_modifiers/content_1_modifiers.txt | 1072 | `building_motor_industry_throughput_add = 0.15` |
| common/static_modifiers/content_1_modifiers.txt | 1267 | `building_munition_plant_throughput_add = 0.15` |
| common/static_modifiers/content_2_modifiers.txt | 515 | `building_paper_mill_throughput_add = 0.2` |
| common/static_modifiers/content_3_modifiers.txt | 438 | `building_arms_industry_throughput_add = 0.20` |
| common/static_modifiers/content_3_modifiers.txt | 439 | `building_artillery_foundry_throughput_add = 0.20` |
| common/static_modifiers/content_3_modifiers.txt | 455 | `building_arms_industry_throughput_add = 0.20` |
| common/static_modifiers/content_3_modifiers.txt | 456 | `building_artillery_foundry_throughput_add = 0.20` |
| common/static_modifiers/content_3_modifiers.txt | 462 | `building_arms_industry_throughput_add = 0.05` |
| common/static_modifiers/content_3_modifiers.txt | 463 | `building_artillery_foundry_throughput_add = 0.05` |
| common/static_modifiers/content_4_modifiers.txt | 358 | `building_arms_industry_throughput_add = 0.15` |
| common/static_modifiers/content_4_modifiers.txt | 359 | `building_artillery_foundry_throughput_add = 0.15` |
| common/static_modifiers/japan_single_fire_events_modifiers.txt | 56 | `building_food_industry_throughput_add = -0.1` |
| common/static_modifiers/montenegrin_modifiers.txt | 360 | `building_arms_industry_throughput_add = 0.5` |
| common/static_modifiers/montenegrin_modifiers.txt | 402 | `building_arms_industry_throughput_add = 0.20` |

## Appendix E — indirect callers of the broken scripted triggers / effects

| File | Line | Text |
|---|---|---|
| events/agitators_events/revolution_events_03.txt | 372 | `is_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 373 | `is_heavy_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 433 | `is_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 434 | `is_heavy_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 462 | `is_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 463 | `is_heavy_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 596 | `is_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 597 | `is_heavy_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 626 | `is_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 627 | `is_heavy_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 637 | `is_industry_building = yes` |
| events/agitators_events/revolution_events_03.txt | 638 | `is_heavy_industry_building = yes` |
| events/election_events/election_other_parties_events.txt | 36 | `is_industry_building = yes` |
| events/election_events/election_other_parties_events.txt | 40 | `is_heavy_industry_building = yes` |
| events/election_events/election_other_parties_events.txt | 67 | `is_industry_building = yes` |
| events/election_events/election_other_parties_events.txt | 68 | `is_heavy_industry_building = yes` |
| events/industrial_accidents_events.txt | 413 | `using_watertube_boiler = yes` |
| events/industrial_accidents_events.txt | 419 | `using_watertube_boiler = yes` |
| events/law_events/economy_laws.txt | 442 | `has_industry_building = yes` |
| events/law_events/economy_laws.txt | 445 | `has_heavy_industry_building = yes` |
| events/law_events/economy_laws.txt | 453 | `has_industry_building = yes` |
| events/law_events/economy_laws.txt | 456 | `has_heavy_industry_building = yes` |
| events/pm_events.txt | 29 | `has_industrialized_pm = yes` |
| events/pm_events.txt | 38 | `save_industrialized_pm_building_and_state = yes` |
| events/pm_events.txt | 110 | `has_industrialized_pm = yes` |
| events/pm_events.txt | 117 | `has_industrialized_pm = yes` |
| events/pm_events.txt | 119 | `save_industrialized_pm_building_and_state = yes` |
| events/prohibition_events.txt | 26 | `has_distillery = yes` |
| events/prohibition_events.txt | 42 | `has_distillery = yes` |
| events/prohibition_events.txt | 259 | `has_distillery = no` |
| events/prohibition_events.txt | 268 | `has_distillery = no` |
| events/prohibition_events.txt | 349 | `has_distillery = yes` |
| events/prohibition_events.txt | 355 | `has_distillery = yes` |
| common/journal_entries/00_prohibition_laws.txt | 12 | `has_distillery = yes` |
| common/journal_entries/00_prohibition_laws.txt | 31 | `is_distillery = yes` |

## Appendix F — Russian custom loc and graphics (cosmetic)

* `common/customizable_localization/99_ru_custom_loc.txt`: 85 lines, one `is_building_type = building_<X>` per key in each of the blocks RU_BL_RP / RU_BL_DP / RU_BL_VP / RU_BL_TP / RU_BL_PP (lines 19–415, 598–994, 1177–1573, 1756–2152, 2335–2731).
* `gfx/map/city_data/city_types/{african,arabic,asian,default,latin,southasian}_city.txt` and DLC `dlc004/french_city.txt`, `dlc011/indian_city.txt`, `dlc014/balkan_city.txt`, `dlc018/japan_city.txt`: 17 lines each (the 15 in `00_example.txt` are commented out); `gfx/map/spline_network/route_graphics/02_railroad_vehicles.txt` (+ the dlc009 copy); `common/scripted_triggers/00_gfx_route_graphics_triggers.txt:128`.


---

# PART 2 — the narrative assessment, case by case (2026-10-21, after the user's rulings)

> The user, 2026-10-21: for each case decide narratively which rungs should count ("any rung" is the grand-exhibition default, not automatic);
> lean to EXCLUDE the crafts from vanilla industry tests unless the test is really about traditional production (those are highlighted in B);
> subsidies are NOT extended ("for now we don't mandate subsidies, except for infrastructure"). Written by a read-only subagent from the
> vanilla script, event text and loc of each case; two cases (economy_laws.6, je_realism's percent clause) re-checked by hand. Row numbers A1… are
> this part's own.


Read-only. Every case below was read in the vanilla game files (1.13.11): the trigger, the event or JE text and its English loc. Nothing in the
repo was changed. The question for each case: **which rungs should satisfy this test, given what the vanilla script is about?** It is not
"any rung" by default.

### Key

**Rungs** are named by narrative ERA. A merged rung is a main method on the rung below, so "e2+" for an industry with a merge means the
host building under either of its main methods:

| Industry | e0 | e1 | e2 | e3 |
|---|---|---|---|---|
| food | **craft** (bakery) | sweeteners (host) | baking powder (method on e1 host) | — |
| textile | **craft** (handsewn) | dye workshops | sewing machines (host) | electric sewing (method on e2 host) |
| furniture | **craft** (handcrafted) | lathe | mechanized workshops (host) | spray finishing (method on e2 host) |
| glass | **craft** (forest glass) | leaded | crystal | houseware plastics |
| tooling | **craft** (crude tools) | pig iron | steel | rubber grips |
| paper | **craft** (pulp pressing) | sulfite pulping (host) | bleached (method on e1 host) | continuous web |
| fertilizer | artificial (host) | improved (method on e0 host) | nitrogen fixation | catalytic synthesis |
| explosives | Leblanc | ammonia-soda | vacuum evaporation (dynamite) | brine electrolysis |
| steel | blister | Bessemer | open hearth (host) | electric arc (method on e2 host) |
| motor | — | steam engines | electric engines | diesel engines |
| automotive | — | — | automobile production | mass production |
| arms | muskets | rifles | repeaters | bolt action |
| artillery | cannons | smoothbores | breech loaders | recoiled barrels |
| munition | — | percussion caps | explosive shells | — |
| art academy | traditional art | realist art | photographic art | film art |
| synthetics / electrics | single rung, references unchanged | | | |

**Proposal types:** `ANY` every rung (industry has no craft) · `ANY−C` every non-craft rung (crafts excluded) · `ANY+C` every rung including the
craft · `ERA` a named era set tied to a technology or practice · `METHOD` whatever building runs a named production method (the rung set
follows from where the method exists) · `HIGHEST` the most advanced rung the owner already holds · `ALL-REMOVE` an effect over every rung ·
`LEAVE` keep the vanilla line (narrow is right, unused, dead, or cosmetic). **Confidence:** clear / judgement. **ASK** = the user should decide.

**Crafts on the 1836 map** (counted on the emitted `mod/common/history/buildings`): 66 countries own a tiered light-industry building; **42 own
ONLY crafts** in light industry (Japan, Portugal, Egypt, Denmark, Switzerland, Tuscany, the Papal States, Korea, Finland, Morocco, Tunis,
Argentina, Colombia, Peru, Bolivia, a dozen Indian states, …). The larger agrarian powers (Russia, Austria, the Ottomans, Spain, China, Sweden,
Brazil, Mexico, Sardinia) hold crafts in most light industries plus at least one factory rung, usually tooling. **GBR, FRA, PRU and BEL own no
craft at all** (their 1836 light factories convert to e1 methods); the USA owns only a food craft. By industry, countries holding only the craft /
countries with a factory rung: **textile 42 / 6** (only GBR FRA USA PRU NET BEL have a textile factory rung; Russia, Austria, the Ottomans, Spain,
China and Japan are textile-craft-only) · paper 24 / 5 · furniture 21 / 10 · glass 15 / 6 · food 9 / 8 · tooling 8 / 17. ⇒ Excluding crafts
silences 1836-era light-industry content for most of the world, never for the industrial core.

---

### (A) Per-case table, in the audit's order

| # | Block · file:line | What it is about | Proposed rungs | Type | Conf. | |
|---|---|---|---|---|---|---|
| A1 | achievement_systembolaget · `achievements/mp1_charters_of_commerce_achievements.txt:146` | Swedish liquor monopoly achievement | — (achievements are off with mods) | LEAVE | clear | |
| A2 | ai_strategy_default goods stances · `ai_strategies/00_default_strategy.txt:5033,5040,5047` | the AI wants a high supply of dye (textile mill + lathe), silk (textile mill), hardwood (furniture) — the inputs of dye workshops, craftsman sewing and luxury furniture | dye → textile e1+; silk → textile e1+ (the rungs carrying craftsman sewing); hardwood → furniture e1+ (luxury furniture). Crafts out — they consume none of the three. Today the stances fire ONLY for craft holders, i.e. inverted. Low value: the audit "avoids" this 8,792-line file | ERA | clear | |
| A3 | admin-strategy subsidies · `ai_strategies/01_admin_strategies.txt:210,211,574` | — | see (E) | — | — | |
| A4 | grand_exhibition_decision · `decisions/grand_exhibition_decision.txt:13` | a world's fair needs an art scene (academy lvl ≥ 10) | one academy of any rung at level ≥ 10 (user's own rule) | ANY | clear | |
| A5 | je_romanticism complete · `journal_entries/00_art_jes.txt:27–28` | patronise Romanticism: an academy running traditional art, lvl ≥ 2, occ ≥ 0.9; fails when realism is researched | **e0 only** (traditional art IS the romantic method) | ERA | clear | |
| A6 | je_realism · `00_art_jes.txt:63` (possible) / `:70–73` (complete) | possible: has an academy. complete: **every** academy runs realist art, occ ≥ 0.9 | possible: any rung. complete: **e1** (realist); film/photography cannot exist while the JE runs. The `percent = 1` clause demands every older academy be gone — see F1 | ERA | judgement | ASK |
| A7 | je_camera · `00_art_jes.txt:103` / `:110–119` | possible: academy lvl ≥ 3. complete: a photographic academy lvl ≥ 5 AND > 75% of academies photographic | possible: any rung. complete: **e2** (photographic; the JE is invalid once film exists, so e2+ ≡ e2). Percent clause: F1 | ERA | judgement | ASK |
| A8 | je_film · `00_art_jes.txt:150` / `:157–166` | same with film | possible: any rung. complete: **e3**. Percent clause: F1 | ERA | judgement | ASK |
| A9 | je_belle_epoque possible · `journal_entries/00_belle_epoque.txt:40–44` | a modern art scene: academy lvl ≥ 3 on photographic OR film | **e2+** | ERA | clear | |
| A10 | Belle Époque launcher · `00_belle_epoque.txt:260` + belle_epoque_events.14 trigger · `events/belle_epoque_events.txt:1375` | a neighbouring Belle Époque country has a fashion trade (craftsman sewing) | the method `pm_craftsman_sewing_textile` (textile e1+; the craft cannot carry it) | METHOD | clear | |
| A11 | je_liberalism_3 · `00_liberalism.txt:137` + liberalism.1 · `events/liberalism.txt:71,122,166` | "Freedom of Thought": a university AND an academy lvl ≥ 3 | academy of any rung | ANY | clear | |
| A12 | je_refining_goods · `00_player_objectives_economic_dominance.txt:73,82` | objective "refine your raw goods": steel mill lvl ≥ 4, unsubsidised | steel of any rung | ANY | clear | |
| A13 | je_specialized_goods · `…:103,112` | objective "make more expensive goods": motor industry lvl ≥ 2 | motor of any rung | ANY | clear | |
| A14 | je_prohibition · `00_prohibition_laws.txt:12,30–31` (+ `has_distillery`) | the temperance movement: a food building distilling liquor, lvl ≥ 5 | buildings running `pm_pot_stills_food` / `pm_patent_stills_food` = the food e1 host under either method; the food craft cannot distil | METHOD | clear | |
| A15 | je_build_local_arms_industry · `00_trade_route_event_missions.txt:8` + trade_route_events.1 · `events/trade_route_events.txt:25` | "build a domestic arms industry" / the event that asks for it fires when you have none | an active arms building of any rung; the event's absence test must be NOT any rung | ANY | clear | |
| A16 | je_great_reforms_military · `journal_entries/03_russia.txt:1277` | Alexander II's army reform: a munition plant lvl ≥ 3 | munition of any rung (e1 percussion caps or e2 shells) | ANY | clear | |
| A17 | law_industry_banned · `laws/01_economic_system.txt:263–307`; law_extraction_economy `:379–417` | the ban demolishes every heavy-industry building | remove EVERY rung of fertilizer (e0–e3), synthetics, steel (e0–e2 + arc method), motor (e1–e3), automotive (e2–e3), electrics, munition (e1–e2); do NOT add explosives (vanilla never removes it) | ALL-REMOVE | clear | |
| A18 | Montenegro monthly check · `on_actions/00_code_on_actions.txt:958` + mon_state_formation.13 · `balkans_events/montenegro_events.txt:1859–1877` | "True Aim": pride in the country's FIRST arms factory | arms of any rung (the `b:` link → the state's arms building of any rung). Accepting the narrow line (the audit's "avoid owning the code on_actions") is tolerable: Montenegro's first factory will normally be a musket or rifle rung | ANY (or LEAVE) | judgement | |
| A19 | Balkan League "Overwork Arms Industries" · `scripted_buttons/00_balkan_wars_buttons.txt:187–215` | 1912 war mobilisation of the military industry | arms, artillery, munition of any rung (today only muskets / cannons / percussion caps qualify — in 1912 effectively never) | ANY | clear | |
| A20 | ybycui_iron_works_button · `scripted_buttons/03_paraguay_scripted_buttons.txt:69,98,103` + paraguay.3 · `events/brazil/paraguay.txt:355,360` | the Rosada foundry: an arms works lvl ≥ 2 is a precondition; the effect creates a 2-level steel mill if the state has none | possible: arms of any rung. Creation guard: "no steel mill of any rung" (else the 1.5× modifier); the created building stays e0 (an 1850s charcoal foundry is the e0 rung) | ANY | clear | |
| A21 | je_tot_slander_button · `scripted_buttons/05_serbia_buttons.txt:15` | Serbian dynastic struggle: "we have the power of imagery" — print pamphlets; needs a paper mill + mass_communication (era 1) | **paper of any rung INCLUDING the craft**: pamphlets do not need a factory, and excluding the craft would require a sulfite mill (mechanical_tools, game era 2) in 1840s–1900s Serbia | ANY+C | judgement | ASK · (B) |
| A22 | vernacular buttons Catalan / Galician / Breton · `scripted_buttons/06_vernacular_buttons.txt:50,67,293,558` | a cultural centre: a university OR an academy (lvl ≥ 3 / ≥ 2) in the homeland | academy of any rung | ANY | clear | |
| A23 | vernacular button Occitan, agricultural branch · `06_vernacular_buttons.txt:634` | an AGRARIAN Occitania: vineyards lvl ≥ 8 + a food industry lvl ≥ 3 + the agricultural decree (the manufacturing branch is a separate light-industry test, line 618) | either food e1+ only (crafts out, keep lvl 3), or the craft IN at vanilla-equivalent size (craft lvl ≥ 30, i.e. 15,000 workers). Regional agro-processing fits a craft; a 3-level craft (1,500 workers) passing it does not. France starts with no food craft | ANY+C at ×0.1, or ANY−C | judgement | ASK · (B) |
| A24 | vernacular button Walloon · `06_vernacular_buttons.txt:694` | the Walloon coal-and-steel basin: mining lvl ≥ 8 + steel mill lvl ≥ 6 | steel of any rung | ANY | clear | |
| A25 | save_industrialized_pm_building_and_state · `scripted_effects/00_scripted_effects.txt:75–180` + has_industrialized_pm · `scripted_triggers/00_scripted_triggers.txt:141–215` | "a state runs mechanised production" (callers pm_events.1 Dangerous Equipment, .2 Untrained Hands — injuries from mechanisation) | the minted mechanised secondaries (watertube / rotary valve / assembly lines per industry; mechanised and automatic power looms) + the furniture e2 host (mechanized workshops, also spray finishing) for vanilla's main-method pair. Textile resolves to e2+ (looms are mandated there). Crafts never | METHOD | clear | |
| A26 | using_watertube_boiler · `00_scripted_triggers.txt:217–262` | caller industrial_accident_events.5, Boiler Explosion | buildings running the watertube secondary (furniture e1–e2, tooling e1–e3, paper e1/e3, steel e0–e2, motor e1–e3) | METHOD | clear | |
| A27 | has_government_building · `00_scripted_triggers.txt:437` | university or academy | no vanilla caller | LEAVE (ANY if rewritten) | clear | |
| A28 | has_industry_building / is_industry_building · `00_scripted_triggers.txt:451–471` | the six light industries | **a shared trigger whose callers want different answers** (A57 wants crafts IN, A62–A64 OUT) → the generator needs two helper variants or per-caller rewrites | — | — | ASK (F10) |
| A29 | has_heavy_industry_building / is_heavy_industry_building · `:473–496` | chemical, synthetics, steel, motor, automotive, electrics, munition, power | any rung (no crafts in the set) | ANY | clear | |
| A30 | is_production_building · `:812–855` | every manufacturing type | no vanilla caller | LEAVE (ANY−C if rewritten) | clear | |
| A31 | has_distillery / is_distillery · `:933–947` | liquor production | the `_food` stills methods | METHOD | clear | |
| A32 | gfx_mining_train_trigger · `scripted_triggers/00_gfx_route_graphics_triggers.txt:128` | map train visuals | cosmetic | LEAVE | clear | |
| A33 | calculate_national_identity_progress · `scripted_effects/00_victoria_scripted_effects.txt:3004` | South American national identity grows with Σ levels of academies, universities, administrations | academy levels of any rung | ANY | clear | |
| A34 | set_promised_building_type · `scripted_effects/04_negotiation_scripted_effects.txt:461–467` (Intelligentsia: art) and `:601–629` (Armed Forces: artillery, munition, arms) | an IG demands more of a building type the country already has | the **most advanced rung of that industry the owner already holds** (an army promised muskets in 1900, or a film-age intelligentsia promised a traditional academy, is absurd); vanilla's "must already own one" rule kept | HIGHEST | judgement (highest vs any held) | |
| A35 | land_ownership_law_events.12 · `events/agitators_events/land_ownership_law_events.txt:1577` | "an ad hoc steel mill should suffice" — backyard steel | starts an e0 steel mill: primitive steel is the point | LEAVE | clear | |
| A36 | assassination_events.4 · `events/assassination_events.txt:287,304` | "the high spheres": a state with an urban centre lvl ≥ 10 and a university or academy | academy of any rung | ANY | clear | |
| A37 | austria_events.33 / .34 · `balkans_events/03_ip3_austria_events.txt:433,558` | Vienna world's fair; Japonisme pavilion and cultural-exchange modifier per academy state | any rung | ANY | clear | |
| A38 | national_awakening.5 · `balkans_events/national_awakening.txt:368–392` | "National Romanticism": an academy produces a romanticist painting of the founding myth | any rung (vanilla is style-agnostic; national-romantic painting ran into the realist era). Arguable alternative: e0–e1 | ANY | judgement | |
| A39 | belle_epoque_events.2 · `events/belle_epoque_events.txt:135,151` | Art Nouveau: academy lvl ≥ 3 | any rung | ANY | clear | |
| A40 | belle_epoque_events.3 · `:280,287` | Symbolism: academy lvl ≥ 3 | any rung | ANY | clear | |
| A41 | belle_epoque_events.6 option b · `:631,636` (the trigger at `:602,610` is electrics, single rung, unchanged) | "Cinema has no commercial future" → **Supported Traditional Arts** in an academy state | **e0–e2** (non-film) — the option is choosing painting/photography over cinema | ERA | judgement | |
| A42 | belle_epoque_events.8 · `:781` | Peugeot-Serpollet steam car / steam omnibus — the country has a car industry | automotive of any rung (e2–e3) | ANY | clear | |
| A43 | belle_epoque_events.14 option b · `:1418` | "The [neighbour] must not outdo us!" — answering haute couture with a +25% textile boost in a textile state | either every rung INCLUDING the craft (couture is handwork; vanilla's mill included handsewn clothes), or e1+ (the rungs that can make luxury clothes — the mod's craft cannot) | ANY+C or ANY−C | judgement | ASK · (B) |
| A44 | amazonas.5 · `events/brazil/amazonas.txt:420,425` | "Manaus, Paris of the Tropics": the opera house — create an academy if the state has none, else a bigger modifier | guard: no academy of any rung; the created building stays e0 | ANY | clear | |
| A45 | decree_events.5 · `events/decree_events.txt:498,517` | "Night at the Opera": commission a national opera from an academy | any rung | ANY | clear | |
| A46 | decree_events.100 / .101 · `events/decree_events_02.txt:29–86, 150–209` | "Industrial Boom" / "Credit Where Credit's Due": a profitable, cash-rich manufacturing building in a state under the manufacturing decree reports a surplus in industrial goods | non-craft rungs of the six light industries, every rung of the rest; keep vanilla's list as it is (artillery foundry omitted) | ANY−C | judgement | ASK (F8) |
| A47 | fascism_events.8 · `events/fascism_events.txt:949–1017` | "The Voice of the Nation": academy composers write an anthem | any rung | ANY | clear | |
| A48 | anarchism_events.3 · `iberia_events/ip4_anarchism_events.txt:379` | bombs in a theatre's orchestra pit — a cultural city | any rung | ANY | clear | |
| A49 | ig_suppression_events.1000 · `events/ig_suppression_events.txt:853` | dialectics +3,500 if the country has an academy | any rung | ANY | clear | |
| A50 | industrial_accident_events.1 · `events/industrial_accidents_events.txt:53–101` | Triangle Shirtwaist: a garment factory (mechanised looms, not traditional) burns | **textile e2+** (the sewing-machine host, either method; the craft and dye workshops carry no looms). Today it fires on every textile craft | ERA | clear | |
| A51 | industrial_accident_events.2 · `:169,184` | Dyeworks Accident: "an industrial-sized tub of hot dye" | **textile e1+** (crafts out; the dye-workshop rung is the literal fit). At 1836 only 6 countries qualify (was: every textile holder) | ANY−C | clear | |
| A52 | industrial_accident_events.4 · `:327–346` | Great Molasses Flood: a tank of molasses for RUM distillation bursts | buildings running a still (food e1 host) | METHOD | clear | |
| A53 | industrial_accident_events.5 (via A26) · `:413,419` | Boiler Explosion | the watertube secondary | METHOD | clear | |
| A54 | japan_events.32 · `japan_events/ep2_japan_events_03.txt:157–179` | ukiyo-e woodblock prints from a TRADITIONAL-art academy | **e0 only** (`has_building = building_art_academy` is already exact) | ERA | clear | |
| A55 | krakatoa.4 · `events/krakatoa_events.txt:683–701` | red sunsets of 1883: "only a painting could capture such beauty" | any rung | ANY | clear | |
| A56 | citizenship_laws.2 · `law_events/citizenship_laws.txt:142,175` | debate at an Art Academy about minority artists | any rung | ANY | clear | |
| A57 | economy_laws.6 · `law_events/economy_laws.txt:442–456` | "Industry Suffers": foreign competition under a free-trade enactment hurts a state's producers (light industry, shipyard, arms, heavy industry) | **light industry of any rung INCLUDING the craft** (artisans ruined by cheap imports is THE historical case); arms and heavy any rung | ANY+C | judgement | ASK · (B) |
| A58 | pm_events.1 / .2 (via A25) · `events/pm_events.txt:29,110,117` | injuries from mechanisation; child labour at machinery | mechanised secondaries | METHOD | clear | |
| A59 | pm_events.3 · `pm_events.txt:181–212` | temperance protest at liquor production | the stills methods | METHOD | clear | |
| A60 | pm_events.4 · `pm_events.txt:316,325` | pacifists protest weapons manufacturing | arms of any rung | ANY | clear | |
| A61 | prohibition_events.* (via A31) · `events/prohibition_events.txt:26,42,259,268,349,355` | the prohibition chain | stills methods | METHOD | clear | |
| A62 | revolution_pulse2_events.3 · `agitators_events/revolution_events_03.txt:372–465` | "Our Friends Across the Border": a violent strike at a FACTORY, its shareholders call in foreign gendarmes | non-craft light rungs + any heavy rung, lvl ≥ 3 | ANY−C | judgement | |
| A63 | revolution_pulse2_events.4 · `:596–641` | company-store scrip riot at a "major" building (raw industries also qualify) | non-craft light rungs + any heavy rung | ANY−C | judgement | |
| A64 | election_other_parties_events.1 · `election_events/election_other_parties_events.txt:36–68` | "Man Over Machine": agrarians complain that technology replaces the dignity of manual labour | non-craft light rungs + any heavy rung, lvl ≥ 5 — the craft IS the manual labour, it cannot be the machine | ANY−C | clear | |
| A65 | camera_film_pm_events.1 · `tech_events/camera_film_pm_events.txt:31–32` | "Captured Light and Shadow" (film +6,000) | **e2** photographic | ERA | clear | |
| A66 | camera_film_pm_events.2 · `:94–95` | "The Moving Picture" (mass_propaganda +5,850) | **e3** film | ERA | clear | |
| A67 | military_tech_events.401 · `tech_events/military_tech_events.txt:27–62` | "Modernizing the Arsenal": the switch from smoothbore muskets to rifles (repeaters +4,150) | **arms e1+** (rifles or newer), lvl ≥ 3 | ERA | clear | |
| A68 | production_tech_events.102 · `tech_events/production_tech_events.txt:83,91` | "Exploding Demand" after dynamite: military and mining compete for explosives | munition plant (or mines) and explosives factory, both any rung | ANY | clear | |
| A69 | production_tech_events.103 · `:167–170` | motor industry running automobiles | dead in vanilla already | LEAVE | clear | |
| A70 | production_tech_events.200 · `:239–256` | "Plastic Production": half the glassworks on houseware plastics, lvl ≥ 5 (plastics +6,000 to a neighbour) | **glass e3**, lvl ≥ 5; the ≥ 50% clause see F1 (crafts in the denominator make it near-impossible: glass sheds its old rung least of all, F136). The immediate's random glassworks → an e3 building | ERA | judgement | ASK (F1) |
| A71 | production_tech_events.210 · `:329–344` | "Radio Production": half the electrics plants on radios | the method `pm_radios_electrics` (electrics single rung). The immediate saving a random GLASSWORKS is a vanilla copy-paste slip — any rung, harmless | METHOD | clear | |
| A72 | production_tech_events.300 · `:414–442` | telephone: electrics lvl ≥ 5 (option b loses its scope today) | the electrics building itself (its main method is telephones) | METHOD | clear | |
| A73 | production_tech_events.501 · `:762–879` | "Railroad Boom": locomotive builders benefit | motor of any rung (steam, electric and diesel locomotives) | ANY | clear | |
| A74 | production_tech_events.700 · `:1065,1105` | "The Engines of Progress": "the manufacture of **steam engines** has become profitable … locomotive technology" | **motor e1 only** — today's narrow behaviour (rung 0 = steam engines) is narratively right | LEAVE | clear | (C) |
| A75 | society_tech_events.104 · `tech_events/society_tech_events.txt:8,11` | "Rising to New Heights": elevators and arcades need steel and plate glass | steel any rung; glass non-craft (e1+) — forest glass is not arcade glass | ANY / ANY−C | judgement | |
| A76 | society_tech_events.302 · `:219–228` | "Isn't It Romantic?" (realism +3,500) | **e0** | ERA | clear | |
| A77 | dt_society_events.2 · `:447–460` (+ `b:building_art_academy.level`, `:452`) | "The Realist Movement" (camera +4,150) | **e1**; order states by their realist-rung levels | ERA | clear | |
| A78 | war_crimes.2 · `tech_events/war_crimes_events.txt:143,154` | "Dealing in Arms": an established munition plant lvl ≥ 5 (rifling +3,500) | munition of any rung | ANY | clear | |

#### A-g. Building-GROUP lines whose meaning the crafts change (audit appendix C, the 9 lines)

| # | Where | About | Proposal | Conf. | |
|---|---|---|---|---|---|
| G1 | vernacular Aragonese / Asturleonese / Francoprovençal / Occitan manufacturing branch · `06_vernacular_buttons.txt:137,210,449,618` (`bg_light_industry` level ≥ 5 / 6 / 10 / 8 on ONE building, with the MANUFACTURING decree) | the homeland is an industrial region | exclude crafts (`NOT = { is_building_group = bg_pmr_crafts }` beside the group test) — a 5-level craft is 2,500 workers against vanilla's 25,000. Spain starts with textile and paper crafts, so today these are near-free | clear | |
| G2 | fra_weekly_pulse_orleanist_progress · `00_victoria_scripted_effects.txt:2264` | July-Monarchy progress from Σ levels of profitable manufacturing ÷ 100 | exclude crafts; **France starts with no craft**, so exclusion leaves the 1836 anchor untouched and only stops later cheap crafts from inflating it (the alternative, craft level × 0.1, is equivalent at the start) | judgement | |
| G3 | je_spa_economic_regeneration · `journal_entries/06_economic_regeneration.txt:449,481,538,589` (`state_has_building_group_levels bg_light_industry ≥ 16 / 7`) | Regeneracionismo: industrialise four states | exclude crafts — but `state_has_building_group_levels` cannot take a NOT, so it needs a generated state value; and whether that counter includes child groups is unverified | judgement | ASK (verify first) |

---

### (B) Craft cases where the craft IS the right fit (highlighted)

The user's lean is to exclude crafts from vanilla "industry building" tests. These are the cases where the test is really about
traditional, small-scale or artisan production — or where excluding the craft would silence content in the very period it describes:

1. ⭐ **A57 · economy_laws.6 "Industry Suffers" (free-trade enactment).** Foreign competition ruining domestic producers under free trade is the
   textbook artisan story (handloom weavers against imported cloth). Mechanically, excluding the craft silences the setback only where a country
   has no other qualifying building (no shipyard, arms works or heavy industry — most small craft-only countries) and elsewhere moves the
   "suffering state" from the craft region to a factory state; both are backwards. **Recommend craft IN.**
2. ⭐ **A21 · Serbian slander button** (`05_serbia_buttons.txt:15`). Printing propaganda imagery needs paper, not a paper factory; mass
   communication is a game-era-1 technology, while the first non-craft paper rung needs mechanical_tools (game era 2). Excluding the craft
   would push the button decades past the dynastic struggle it belongs to. **Recommend craft IN** (any rung).
3. **A23 · Occitan button, agricultural branch** (`06_vernacular_buttons.txt:634`). The branch is about an agrarian wine-and-food region
   (vineyards + the agricultural decree), so artisanal food processing fits — but at vanilla size: a craft at level 3 is 1,500 workers.
   **Recommend craft IN at vanilla-equivalent level (craft lvl ≥ 30)**, or e1+ only if the generator should carry no level scaling.
4. **A43 · Belle Époque haute couture, option b** (`belle_epoque_events.txt:1418`) and its modifier `modifier_haute_couture_competition` (D33).
   Couture is handwork; vanilla's mill included handsewn clothes. But in the mod the craft carries no luxury-clothing line, so the bonus would
   boost plain artisan clothes. Weak case — **ASK**.
5. **D47 · `japan_calendar_clockwork_administration_mod`** (−10% food industry after the 1873 calendar reform): a malus on traditional,
   season-bound production — Japan's food sector at that date is the craft (83 craft levels, no factory rung at 1836). **Recommend craft IN.**

Cases checked and found NOT to fit the craft (crafts out, with the reason in the row): A51 dyeworks ("industrial-sized tub"), A50 garment-factory
fire, A64 "Man Over Machine" (the craft is the man), A62/A63 factory strikes and company stores, A46 "Industrial Boom", A75 arcade glass, A2 the
dye/silk/hardwood stances (crafts consume none), G1–G3.

**What excluding crafts costs elsewhere** (everything involving the six craft industries):
- 1836–1860s content in countries whose light industry is crafts waits until they build an e1 rung: the dyeworks accident (only GBR FRA USA
  PRU NET BEL qualify at start, against every textile holder in vanilla — 48 countries), the Industrial Boom decree events in craft-only
  states, and the AI's dye/silk/hardwood stances. None of these is a research boost or a JE; the dyeworks accident is a one-off per country. Acceptable.
- The revolution/election callers (A62–A64) fire only in civil wars or election campaigns with intensive agriculture researched — mid-century
  onward, when most such countries hold e1 rungs or heavy industry; .4 also accepts raw industries.
- Nothing in this list removes a research boost: every DEAD research boost (art chain, repeaters, plastics, radio) concerns non-craft rungs.

---

### (C) Cases where "any rung" is wrong, and why

| # | Proposal | Why not any rung |
|---|---|---|
| A5, A76 | art **e0** | Romanticism is the traditional-art method; the JE fails once realism exists |
| A54 | art **e0** | ukiyo-e is traditional art; a film academy painting woodblock prints is nonsense |
| A6, A77 | art **e1** | "Patronise Realist Art" / "The Realist Movement" |
| A7, A65 | art **e2** | "Establish the Photographic Arts" |
| A8, A66 | art **e3** | "Establish the Film Arts" |
| A9 | art **e2+** | Belle Époque needs a MODERN art scene (vanilla: photographic or film) |
| A41 | art **e0–e2** | "Cinema has no commercial future" → traditional arts, i.e. not film |
| A67 | arms **e1+** | "the change from smoothbore muskets to rifles" — a musket works is exactly what it is not about |
| A70 | glass **e3** | "the switch to plastic in our Glassworks" |
| A74 | motor **e1 only** (LEAVE) | "the manufacture of steam engines … locomotive technology" — vanilla never checked the method because only one existed |
| A50 | textile **e2+** | a garment factory with mechanised looms (Triangle Shirtwaist); dye workshops carry no looms |
| A51 | textile **e1+** | "an industrial-sized tub of hot dye" — the dye-workshop rung is the fit, the craft is not |
| A14, A31, A52, A59, A61 | food rungs **running a still** (e1 host) | liquor production; the craft cannot distil (it carries no distillery line) |
| A25, A26, A53, A58 | **the mechanised secondary itself** | mechanisation, boilers: a rung without the method is not mechanised whatever its era (steel e0 carries watertube boilers; the textile dye-workshop rung carries no looms) |
| A10 | **craftsman sewing** (textile e1+) | a fashion trade |
| A2 | textile e1+ (dye, silk), furniture e1+ (hardwood) | the stance exists to feed rungs that consume those goods; the crafts consume none |
| A34 | **highest rung held** | an IG demanding "more arms" in 1900 wants modern arms; any-rung would let the random pick land on muskets |
| A17 | **every rung, removed** | a demolition effect: all rungs, not "any" — and explosives stay out as in vanilla |

---

### (D) Throughput modifiers — which rungs each bonus should reach

Default when nothing narrower is argued: **every rung of the industry, crafts included** — vanilla's single building ran every method
including the handicraft one, and a throughput bonus on a 500-worker craft is harmless. Narrowing applies where the reward is for a
technology or practice, or where a malus hits something specific. `building_<key>_throughput_add` must be declared for the six missing keys
(glass e1–e3, explosives e1–e3) before any glass/explosives line can reach them.

| # | Modifier · file:line | Bonus · source | Proposed rungs | Conf. |
|---|---|---|---|---|
| D1 | amendment_degenerate_art · `amendments/00_amendments_enactment_04.txt:688` | −10% art, the degenerate-art amendment | all rungs | clear |
| D2–4 | principle_military_industry_1/2/3 · `power_bloc_principles/00_power_bloc_principles.txt:902–904, 947–949, 967–969` | +10% arms, artillery, automotive (+ shipyards) for bloc members | **all rungs of arms, artillery and automotive** — a principle a player chooses must reach the arsenal they actually run. Munition is not in vanilla's list; do not add | clear |
| D5 | modifier_ukiyo_e_production · `static_modifiers/00_ep2_03_modifiers.txt:25` | +5% art, state, "Woodblock Print Production" (A54) | **e0** (traditional art) | judgement |
| D6 | modifier_budapest_paris_of_the_east · `00_ip3_02_modifiers.txt:215` | +10% art | all | clear |
| D7 | modifier_ottonian_renaissance · `00_ip3_02_modifiers.txt:388` | +10% art | all | clear |
| D8 | cultural_exchange_art · `00_ip3_03_modifiers.txt:161` | +25% art per academy state, Japonisme (A37) | all | clear |
| D9 | kaiserforum_loc_efforts · `00_ip3_03_modifiers.txt:230` | +25% art, "Ringstrasse Reimagined" | all | clear |
| D10 | modifier_kunsthistorisches · `00_ip3_03_modifiers.txt:240` | +10% art | all | clear |
| D11 | modifier_national_awakening_domestic_works · `00_ip3_04_modifiers.txt:210` | +10% art, "Vernacular Publishing" | all | clear |
| D12–13 | metternich_modifier_t2 / t4 · `00_ip3_04_modifiers.txt:342,359` | +5% art each, "Legacy of Metternich" | all | clear |
| D14 | sagrada_familia_construction · `00_ip4_03_modifiers.txt:140` | +5% art | all | clear |
| D15 | modifier_portugal_education_reforms · `00_ip4_04_modifiers.txt:306` | +15% art | all | clear |
| D16 | modifier_bg_diminished_rum_production · `02_event_modifiers.txt:512` | **−50% food**, state, after the molasses flood (A52) | **food e1+** (the distilling host) — a rum-tank disaster should not halve the state's bakeries | clear |
| D17 | automobile_regulations · `02_event_modifiers.txt:1254` | −10% MOTOR industry, "Unregulated Automobiles" (combustion engine) | all motor rungs (vanilla's own odd target — engine makers, not car plants — kept) | judgement |
| D18 | plastic_production_modifier · `02_event_modifiers.txt:1515` | +33% glass, reward of A70 | **glass e3** (plastics) — the event requires the plastics rung, so the reward reaches it; boosting the forest-glass craft is the anti-design case the audit names | clear |
| D19 | dynamite_production_modifier · `02_event_modifiers.txt:1525` | +33% explosives, "Exploding Demand" option a ("increasing supply will lift all boats") | all explosives rungs (the event is about supply against a demand spike and does not require the dynamite rung, which is rarely built at that moment); alternative e2+ (the rung gated on dynamite) | judgement · ASK |
| D20 | munitions_production_modifier · `02_event_modifiers.txt:1538` | +33% munition, A68 option c | all | clear |
| D21 | motor_industry_production_modifier · `02_event_modifiers.txt:1543` | +33% motor, from A69 (dead in vanilla) | moot; all motor rungs if ever reached | clear |
| D22 | engine_production_modifier · `02_event_modifiers.txt:1553` | +33% motor, "Railroad Boom" option b (locomotive builders) | all motor rungs | clear |
| D23 | electrics_building_modifier · `02_event_modifiers.txt:1563` | electrics, single rung | unchanged | clear |
| D24 | elevator_goods_production_modifier · `02_event_modifiers.txt:1720–1721` | +20% steel and glass (A75) | steel all; glass e1+ (crafts out, consistent with A75) | judgement |
| D25 | realist_art · `02_event_modifiers.txt:1746` | +15% art, "Supporting the Realist Movement" (A77) | **e1** | judgement |
| D26 | romantic_building_modifier · `02_event_modifiers.txt:1757` | +20% art, state, "Romantic Architecture" (A76) | **e0** | judgement |
| D27 | krakatoa_art_modifier · `104_modifiers.txt:636` | +15% art, state (A55) | all | clear |
| D28 | art_nouveau_strike_modifier · `104_modifiers.txt:794` | −50% art, state, an academy strike | all | clear |
| D29 | art_nouveau_love_modifier · `104_modifiers.txt:799` | +20% art (A39) | all | clear |
| D30 | free_arts · `105_modifiers.txt:176` | +10% art (liberalism) | all | clear |
| D31 | banned_degenerate_art · `105_modifiers.txt:284` | −10% art | **no vanilla user** — no action | clear |
| D32 | modifier_film_industry_bonus · `agitators_4_modifiers.txt:713` | electrics, single rung | unchanged | clear |
| D33 | modifier_haute_couture_competition · `agitators_4_modifiers.txt:772` | +25% textile, state (A43) | all rungs incl. craft, or e1+ — follows A43 | judgement · ASK |
| D34 | modifier_trad_arts_bonus · `agitators_4_modifiers.txt:788` | +10% art, "Supported Traditional Arts" (A41) | **e0–e2** (not film) | judgement |
| D35–36 | modifier_fin_de_sicle / _more · `agitators_4_modifiers.txt:804,810` | +10% / +25% art | all | clear |
| D37 | modifier_intelligentsia_plan · `agitators_4_revolution_modifiers.txt:487` | +10% paper, "the government will run its own presses" | all paper rungs incl. craft | clear |
| D38 | amazon_theatre · `brazil_2_modifiers.txt:214` | +10% art, state (A44) | all | clear |
| D39 | ybycui_steelworks · `brazil_2_modifiers.txt:299` | +10% steel, state (A20) | all | clear |
| D40 | steam_engine_production · `content_1_modifiers.txt:1072` | +15% motor, "Steam Engine Time" (A74 option b) | **motor e1 only** — leave as is | clear |
| D41 | munitions_modifier · `content_1_modifiers.txt:1267` | +15% munition, state, "Munitions Mania" (A78) | all | clear |
| D42 | high_distribution_news_cycle · `content_2_modifiers.txt:515` | +20% paper, an election news cycle | e1+ (mass newsprint is the wood-pulp revolution); craft-in would also be harmless | judgement |
| D43 | wartime_production_act · `content_3_modifiers.txt:438–439` | +20% arms/artillery | **no vanilla user** — no action | clear |
| D44 | modern_rifle_arsenal · `content_3_modifiers.txt:455–456` | +20% arms and artillery in the arsenal state, A67 option a | **arms e1+ and artillery e1+** — a reward for modernising; boosting muskets beside the new rifle works runs against the obsolescence design. Alternative: all rungs (vanilla's state-wide bonus) | judgement · ASK |
| D45 | arsenal_proving_ground · `content_3_modifiers.txt:462–463` | +5% arms/artillery, A67 option b | same as D44 | judgement · ASK |
| D46 | modifier_second_crusade_against_manchu · `content_4_modifiers.txt:358–359` | +15% arms/artillery (Taiping) | all | clear |
| D47 | japan_calendar_clockwork_administration_mod · `japan_single_fire_events_modifiers.txt:56` | −10% food, country, the 1873 calendar reform | **all rungs incl. craft** (B5) | judgement |
| D48 | mon_many_guns · `montenegrin_modifiers.txt:360` | +50% arms, "Make lots of guns" (A18) | all | clear |
| D49 | modifier_reliable_supply · `montenegrin_modifiers.txt:402` | +20% arms, reward of A15 | all | clear |

---

### (E) Subsidies in AI strategies (listed only — extending them is rejected, "for now we don't mandate subsidies, except for infrastructure")

| Strategy · file:line (vanilla → owned copy) | Entry | What it does in the mod |
|---|---|---|
| ai_strategy_resource_expansion · `01_admin_strategies.txt:210` → `mod/…:230` | `building_tooling_workshop = nice_to_have` | subsidises the **crude-tools CRAFT** (e0) only; the pig-iron, steel and rubber-grip workshops get nothing. 10 countries hold a tooling craft at 1836 (Russia, Japan, Mexico, Brazil …) |
| ai_strategy_resource_expansion · `:211` → `mod/…:231` | `building_explosives_factory = nice_to_have` | subsidises the **Leblanc** rung (e0) only |
| ai_strategy_colonial_extraction · `:574` → `mod/…:629` | `building_tooling_workshop = wants_to_have` | the crude-tools craft only |

The file is already owned (the dam subsidies are `must_have` in every administrative strategy), so nothing new would be owned to change these;
by ruling they stay as vanilla wrote them. Vanilla's own intent (tools and explosives for the mines) is now served only by the two retired rungs.

---

### (F) Judgement calls for the user

1. **The percent clauses** — je_realism (`percent = 1` of academies realist), je_camera and je_film (> 75%), production_tech_events.200 (≥ 50% of
   glassworks on plastics). Vanilla switches a building's method; in the mod the old rung stays a separate building, so these demand that
   every old academy/glassworks be demolished (glass sheds its old rung least of all — F136 — and the glass craft sits in the denominator).
   Options: (a) keep the percent over buildings of all rungs (strict: the JEs and the plastics event will rarely complete); (b) count the
   share of LEVELS on the target rung or newer, through a generated country value (the capacity meaning of vanilla's test); (c) drop the
   percent and keep only the "one building of the rung at level N" clause. Recommend (b); (c) if no script values are wanted.
2. **Craft IN for economy_laws.6 "Industry Suffers"** (B1). Recommend yes.
3. **Craft IN for the Serbian slander button** (B2). Recommend yes.
4. **Occitan agricultural branch** (B3): craft in at vanilla-equivalent level (lvl ≥ 30), or e1+ only.
5. **Haute couture** (A43 option b and D33): craft in (vanilla-faithful) or e1+ (luxury clothing).
6. **dynamite_production_modifier** (D19): all explosives rungs, or e2+ (the rung dynamite unlocks).
7. **modern_rifle_arsenal / arsenal_proving_ground** (D44–45): e1+ (modern weapons only), or all rungs.
8. **Industrial Boom decree events** (A46): crafts out per the lean — confirm; and keep vanilla's omission of the artillery foundry.
9. **The default for throughput modifiers on crafts**: include (vanilla's building ran the handicraft method too), except where a row says
   otherwise. Confirm.
10. **The shared light-industry trigger** (A28): its callers want different answers (A57 craft in, A62–A64 craft out), so the generator needs
    two helpers (or per-caller rewrites) rather than one rewrite of `has_industry_building`.
11. **Montenegro "first arms factory"** (A18): fix through the code on_actions file (7,963 lines) or accept the narrow line (the first factory
    is normally a musket or rifle rung anyway).
12. **The Spanish regeneration JE** (G3): verify whether `state_has_building_group_levels` counts the craft child group before deciding.
