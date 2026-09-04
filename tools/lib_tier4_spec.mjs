// THE FOUR-RUNG SPEC — the ONLY authored input the four-rung generator has beside the game files.
//
// ⭐⭐⭐ THE RULE (user-ruled 2026-09-04, the third time): "the four-rung generator takes vanilla rungs (up to four) and
//   ENRICHES them. Very rarely alters them. No six-rung-canon data should be consulted whatsoever in preparing the
//   canon4rungs." So:
//   - a tiered industry IS a vanilla building; its rungs ARE that building's main-group production methods, in vanilla
//     order, with vanilla's method NAME, vanilla's GATE (the method's own technology, else the building's), vanilla's
//     recipe, staffing, pollution and icon. make_tier4_config.mjs reads all of that from the game and nothing from any
//     other config;
//   - the tree is vanilla's technologies at vanilla's eras, names and prerequisites (make_tier4_techs.mjs reads the game),
//     plus the minted technologies the ADDITIONS below carry, plus the ERA_MOVES ruled here;
//   - the enrichment is the A/B book (make_ab_config.mjs: output ×A^k, input value ×B^k, cost ×A^k, ai_value 1000×A^era),
//     the research events (transplanted from canon4-je, the ruled four-rung parameters) and the keys/names a rung needs
//     to exist as its own building;
//   - EVERYTHING that alters vanilla is an explicit entry in this file with its ruling: ADDITIONS (rule 2), ERA_MOVES,
//     PLACEMENT (where an industry has fewer than four methods), TECH_RENAMES_RULED (empty).
//
// ⭐⭐ RULES 1-3 ON NAMES AND ADDITIONS (user-ruled 2026-09-04):
//   1. vanilla names and gating techs stay vanilla (PM-N -> tier N) unless explicitly ruled otherwise;
//   2. additions only where a vanilla method is missing or grossly out of place, each discussed explicitly;
//   3. no addition out of place — in particular no secondary method of the same industry supplies an addition's theme.
//   Removed under 1-3 the same day: food's dough_rollers (= the food industry's Automated Bakery automation method),
//   synthetics' art_silk (= Rayon, its Synthetic Silk group) and polyamide (artificial fibres, the same group's theme),
//   electrics' radio (= Radio Production, its Radios group) and electrical_generation (a POWER-PLANT technology on a
//   telephone factory), munition's automatic lines (the plant's Assembly Lines automation method), furniture's pneumatic
//   tools (powered machinery, its automation group), motor's watertube boiler (its Water-tube Boiler automation method).
//   The generator THROWS on any addition pegged to a technology that gates one of the industry's own secondary methods.

export const N = 4;
export const ERA_YEARS = [1836, 1875, 1905, 1940];   // the four anchors (BALANCE_FRAMEWORK §10.66); labels, not gates

// loc conventions the builder needs (schema, not data)
export const LOC = { basename: 'zzz_pm_rehaul',
  languages: ['english', 'braz_por', 'french', 'german', 'japanese', 'korean', 'polish', 'russian', 'simp_chinese', 'spanish', 'turkish'] };

// The tiered industries: id (what every tool, anchor and ledger calls it) -> the vanilla building it IS.
// Port, shipyard, railway and power are NOT here: they stay vanilla, untouched, and appear in no config.
export const INDUSTRIES = [
  { id: 'food',        building: 'building_food_industry' },
  { id: 'textile',     building: 'building_textile_mill' },
  { id: 'furniture',   building: 'building_furniture_manufactory' },
  { id: 'glass',       building: 'building_glassworks' },
  { id: 'tooling',     building: 'building_tooling_workshop' },
  { id: 'paper',       building: 'building_paper_mill' },
  { id: 'fertilizer',  building: 'building_chemical_plant' },
  { id: 'explosives',  building: 'building_explosives_factory' },
  { id: 'steel',       building: 'building_steel_mill' },
  { id: 'motor',       building: 'building_motor_industry' },
  { id: 'automotive',  building: 'building_automotive_industry' },
  { id: 'arms',        building: 'building_arms_industry' },
  { id: 'artillery',   building: 'building_artillery_foundry' },
  { id: 'munition',    building: 'building_munition_plant' },
  { id: 'synthetics',  building: 'building_synthetics_plant' },
  { id: 'electrics',   building: 'building_electrics_industry' },
  { id: 'art_academy', building: 'building_art_academy' },
];

// Four vanilla methods -> rungs 0..3 by vanilla order, no dates involved. An industry with FEWER methods is placed
// explicitly here (rung index = era; the labels are 1836/1875/1905/1940). These are the five, ruled 2026-09-04:
//   food       bakeries / sweeteners / baking powder          -> e0 e1 e2
//   automotive automobile production / mass production        -> e2 e3 (combustion_engine 1886, vanilla era 4)
//   munition   percussion caps / explosive shells             -> e1 e2 (the plant does not exist at 1836: vanilla gates
//                                                                it on percussion_cap, an era-2 technology)
//   synthetics synthetic dye                                  -> e1 (aniline, vanilla era 3)
//   electrics  telephone production                          -> e1 (telephone, vanilla era 4)
export const PLACEMENT = { food: [0, 1, 2], automotive: [2, 3], munition: [1, 2], synthetics: [1], electrics: [1] };

// ⭐ THE ADDITIONS (rule 2): a rung vanilla does not have, appended as the industry's TOP rung, each with its own key,
//   building name, method name, year and MINTED technology. Its recipe, staffing, pollution and icon are the rung
//   below's (the A/B book re-scales the recipe). Four, all where vanilla's ladder stops 25+ years short of 1940 and no
//   secondary group of the building covers the theme (rule 3). "Mint them" was ruled 2026-08-30; these four survive the
//   2026-09-04 rules.
export const ADDITIONS = [
  { industry: 'furniture', tech: 'spray_finishing', year: 1923,
    key: 'building_furniture_manufactory_spray_finishing', pm_name: 'Spray Finishing',
    why: 'vanilla stops at 1850 mechanized workshops; finishing is no secondary group’s theme (luxury, automation)',
    minted: { category: 'production', name: 'Spray Finishing', prereqs: ['pneumatic_tools'],
      desc: 'Nitrocellulose lacquer laid on with a compressed-air gun dries in minutes rather than days, and a finishing shop stops being the slowest room in the factory.' } },
  { industry: 'paper', tech: 'continuous_web_processing', year: 1930,
    key: 'building_paper_mill_continuous_web', pm_name: 'Continuous Web Processing',
    why: 'vanilla stops at bleaching; the mill’s secondary group is boilers and engines',
    minted: { category: 'production', name: 'Continuous Web Processing', prereqs: ['chemical_bleaching', 'shift_work'],
      desc: 'A paper machine that forms, presses and dries an unbroken web at speed, so the mill’s output stops being a count of sheets and becomes a rate.' } },
  { industry: 'fertilizer', tech: 'catalytic_synthesis', year: 1937,
    key: 'building_chemical_plant_catalytic_synthesis', pm_name: 'Catalytic Synthesis',
    why: 'vanilla stops at nitrogen fixation; the plant has no secondary group at all',
    minted: { category: 'production', name: 'Catalytic Synthesis', prereqs: ['nitrogen_fixation', 'plastics'],
      desc: 'Promoted iron catalysts and continuous high-pressure reformers turn fixed nitrogen from a laboratory triumph into a commodity produced by the shipload.' } },
  { industry: 'motor', tech: 'high_speed_diesel', year: 1935,
    key: 'building_motor_industry_high_speed_diesel', pm_name: 'High-Speed Diesel',
    why: 'vanilla stops at diesel engines; a product step, not the automation group’s theme',
    minted: { category: 'production', name: 'High-Speed Diesel', prereqs: ['compression_ignition'],
      desc: 'Small fast-running diesels on welded frames, built by the thousand for lorries, launches and generators rather than one at a time for ships.' } },
];

// ⭐ ERA MOVES (user-ruled 2026-08-30): a TOP rung may not be gated below era 4 ("e3 techs will be discovered en masse in
//   the late 19th century, we can't have narratively 1940s industries gated by them"). Read against VANILLA's eras, only
//   vulcanization (era 3, tooling's top rung) actually moves; the other four already sit in era 4 in the game files and
//   are listed so the rule stays visible. Raising a technology raises everything that depends on it — the tree tool
//   checks that no prerequisite ends up in a later era than its dependent.
export const ERA_MOVES = { electrical_capacitors: 4, plastics: 4, vulcanization: 4, bolt_action_rifles: 4, electric_railway: 4 };

// Rule 1 for TECHNOLOGY names: vanilla's, unless ruled here as { id: [name, why] }. Empty. (The six-rung tree renamed
// fourteen; none is ruled for this line. The two dating corrections — pumpjacks "Oil Drilling", threshing_machine "Steam
// Threshing" — await a ruling of their own.)
export const TECH_RENAMES_RULED = {};

// A rung's building name is derived, never authored: "<vanilla building> (<vanilla method>)".
export const bldName = (building, method) => `${building} (${method})`;
export const slug = pm => pm.replace(/^pm_/, '').replace(/-/g, '_');

// ⭐ THE RESEARCH-EVENT PARAMETERS OF THE FOUR-RUNG LINE (user-ruled 2026-09-03/04, BALANCE_FRAMEWORK §10.69): marks by the
//   unlocked rung's era 25k/25k/75k/235k, 60-month bars, the military war channel on land unit types, the necessity anchors.
//   Kept HERE so the pipeline opens no other config (they used to be transplanted from config/mod_config.canon4-je.json).
//   `necessity_anchors.motor` = coal + iron mines as ONE summed source (a list = one source; user-ruled 2026-09-04): the motor
//   industry's first rung sits on atmospheric_engine, vanilla era 2, a researchable technology with no rung below it, and the
//   technology's own vanilla content is the mine pump. Every term is phrased for the player ("Workers in Coal Mines and Iron
//   Mines: at least 25,000; now N") — no bg_ key is ever player-facing.
export const RESEARCH_EVENTS = {
    "_comment": "ROADMAP step 2. Industry-driven research events. enabled:false builds the plain techs arm, enabled:true the techs+events arm - which is what makes the arm a CONFIG VARIANT rather than a code flag (user ruling 2026-08-11).",
    "enabled": true,
    "stages": [
      "inception",
      "development",
      "implementation"
    ],
    "grant_fraction": 0.5,
    "industry_bar_months": 60,
    "thresholds_by_era": {
      "0": 25000,
      "1": 25000,
      "2": 75000,
      "3": 235000,
      "4": 235000,
      "5": 235000
    },
    "employment_per_level_default": 5000,
    "war_gate": {
      "general_battalions_flat": 50,
      "front_casualties_min": 0,
      "gate_variable_days": 40,
      "_note": "user-ruled 2026-09-03: a general of ours with at least 50 mobilised battalions on a front against an enemy who holds the technology; no casualties clause; 6 monthly ticks per stage, two stages grant the technology at base cost"
    },
    "necessity_anchors": {
      "fertilizer": [
        "bg_staple_crops"
      ],
      "synthetics": [
        "building_textile_mill",
        "bg_light_industry"
      ],
      "automotive": [
        "building_motor_industry_electric_engines",
        "building_motor_industry_diesel_engines"
      ],
      "electrics": [
        "building_trade_center"
      ],
      "munition": [
        "bg_military_industry"
      ],
      "explosives": [
        "bg_staple_crops"
      ],
      "motor": [["building_coal_mine", "building_iron_mine"]]
    },
    "war_bar_months": 6,
    "_why_war_gate": "Ruled 2026-08-18. All three clauses bind inside ONE front inside ONE war: our general with >= general_battalions_high mobilised battalions; an ENEMY general on that same front whose owner already holds the technology; and >= front_casualties_min of OUR casualties there. Computed in on_monthly_pulse_country (a progress bar has no valid ROOT) and handed to the bar as an expiring country variable, gate_variable_days. The old two-term structure is gone - a bare state of war must not tick. war_bar_months 6 = one journal entry per six qualifying months, granting grant_fraction x the era base cost.",
    "naval_bar_months": 60,
    "_naval_note": "Fleet technologies leave the battle gate entirely: they tick on POSSESSION of a qualifying ship, ours (+2, supersedes) or a declared rival's (+1), no war required. 60 monthly ticks = 5 years per stage at the normal rate. Ship types are derived live from common/ship_types.",
    "_why_tier4": "Four-rung ladder, 2026-08-29: thresholds ×4 from 30000 (measured against a leading country's real predecessor workforce), and twice the firings for the same total grant (6 stages × 0.25 in place of 3 × 0.5). See BALANCE_FRAMEWORK §10.67.",
    "_je_restore_note": "canon4-je (user-ruled 2026-09-03): marks by the UNLOCKED rung's ERA — t1 25k · t2 75k · t3 235k workers at full staffing in the predecessor rung (rule-D keys 4/5 → 235k); 60-month bars per stage; ONE multiplier ×0.5 for arms, artillery, explosives, munition, synthetics; every JE names its sources and live figures. A late-appearing industry's rungs take the marks of their ERA, never of their rung index.",
    "threshold_mult": {
      "arms": 0.5,
      "artillery": 0.5,
      "explosives": 0.5,
      "munition": 0.5,
      "synthetics": 0.5
    },
    "_anchor_note": "user-ruled 2026-09-03: combustion engine on the motor industry's rungs (the engine trade), telephone on trade centres, percussion cap and the explosives first rung on the army (bg_army, people-counted at the barracks method's 1,000 a level); later rungs keep their predecessor rung (rule A). Urban centres and financial districts — auto-scaling buildings — gate nothing.",
    "war_channel": "unit_types",
    "naval_channel": false,
    "consumption_thresholds": {
      "_note": "the good:<name> anchor stays implemented (market = { mg:<good> = { market_goods_buy_orders >= T } }) but is UNUSED since 2026-09-04: measured in canon4-je-n5, a market term ticks for every MEMBER of the market (the princely states got percussion cap off Britain's small-arms demand; Britain never). Percussion cap now rides bg_military_industry — arms + artillery employment across every rung, user-ruled 2026-09-04."
    },
    "_military_note": "user-ruled 2026-09-03: (1) unit-type technologies → the war channel (flat 50 battalions, no casualties, 6-tick stages); (2) military rungs with a predecessor → the industry rule; (3) military first rungs (percussion cap → ammunition, the explosives first rung → explosives) → the market's buy orders of the good at industry tick speed; (4) no naval entries.",
    "_anchor_note_vanilla4": "2026-09-04: anchors pruned to the tiered industries; automotive re-pointed to the electric and diesel motor rungs; motor (first rung on atmospheric_engine, vanilla era 2, researchable, no rung below it) anchored on COAL + IRON MINES as one summed source — user-ruled 2026-09-04 (the technology's own vanilla content is the mine pump; lead, sulfur and gold mines left out)."
  };

// the candidate's own record, stamped into the config
export const CANON = {
  name: 'canon4v (candidate)', declared: '2026-09-04',
  ruled_by: 'user: 4 vanilla methods -> 4 rungs; additions only where ruled; rules 1-3 on names and additions; NO six-rung data consulted (the third ruling, 2026-09-04)',
  from: 'tools/make_tier4_config.mjs (the GAME + tools/lib_tier4_spec.mjs, nothing else) -> make_tier4_techs.mjs (vanilla technologies at vanilla eras/names/prerequisites + ERA_MOVES + the additions’ minted technologies) -> make_ab_config --A 2.0 --B 1.5 --ai-steep glass,tooling:3',
  not_carried: 'the six-rung book’s ai_defines (hoard levers), pm_goods/pm_employment (electric streetlights), building_ai_value (trade centre 5000), building_subsidies, start_tech_grants (NET), technology renames, era alignment, and the start_exceptions chain seed (start_exceptions_file -> config/start_exceptions.vanilla.json)',
  status: 'NOT yet the canon - awaiting ratification; canon-4rung remains the measured book (F98-F103)',
};
