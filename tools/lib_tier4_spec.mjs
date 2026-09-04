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
