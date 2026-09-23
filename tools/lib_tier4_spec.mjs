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
//   - the enrichment is the A/B book (make_ab_config.mjs: output ×A^era, input value ×B^era, cost by era, ai_value by
//     era — ERA, never rung index, see THE ERA RULE below), the research events (the ruled four-rung parameters) and
//     the keys/names a rung needs to exist as its own building;
//   - EVERYTHING that alters vanilla is an explicit entry in this file with its ruling: ADDITIONS (rule 2), ERA_MOVES,
//     PLACEMENT (the ruled adjustments where the era rule cannot place a ladder by itself), TECH_RENAMES_RULED (empty).
//
// ⭐⭐⭐ THE ERA RULE (user-ruled 2026-09-13 — "the final ladder realignment"; BALANCE_FRAMEWORK §10.78):
//   TWO ERA KINDS, NEVER CONFLATED. A TECHNOLOGY is referred to by its GAME era (1–5), which has mechanical meaning
//   (the era base cost; unfinished technologies of the eras below N add to an era-N technology's cost). A RUNG is
//   referred to by its NARRATIVE era (0–3; the anchors ERA_YEARS, 1836 / 1875 / 1905 / 1940), and a narrative era is a
//   statement about UNLOCK TIME: the rungs of one era unlock at roughly the same time in every industry, so an industry
//   that starts around 1900 starts at e2, never at e0 ("if I ever see a t0 automobile industry, I will riot").
//   The narrative era is ALSO the rung's place on the ladder — output × A^era, input value × B^era, the ×lift on era 0
//   alone, building cost by era, ai_value by era, the research marks by the unlocked rung's era — so a rung on the wrong
//   era is a mis-priced rung, and "late tiers are uniformly more effective than earlier ones" holds only if every rung
//   carries its era. THE RUNG INDEX WITHIN AN INDUSTRY IS NEVER THE KEY to anything.
//   The mapping is GAME_ERA_OF_ERA (the config's `era_game_era`): e0 ↔ game era 1 (held at the 1836 start), e1 ↔ 3,
//   e2 ↔ 4, e3 ↔ 5. Game era 2 (researched 1836–1861) sits in the gap and rounds UP to e1, the first researched tier.
//   A rung's DERIVED era is its technology's narrative era, bumped up only as far as one-rung-per-era requires in
//   vanilla's method order — vanilla's own ladders are front-loaded (a textile mill's methods sit on game eras 1,1,2,4),
//   so the bump is what places a four-method industry on 0,1,2,3, and nothing else ever did. TOLERANCE: a rung may sit at
//   most ERA_TOLERANCE (one) era from its technology's narrative era ("adjustments can be made as we don't have too many
//   tiers for good alignment"); further off is a defect. make_tier4_config.mjs THROWS on it at generation, and
//   tools/lint_tier_eras.mjs (landmine L31) re-checks every config on every build — placement AND the era-keyed book.
export const GAME_ERA_OF_ERA = [1, 3, 4, 5];
export const ERA_TOLERANCE = 1;
// a technology's game era -> the narrative era of a rung it gates (era 2, the gap, rounds up to the first researched tier)
export const eraOfGameEra = ge => { const e = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 }[ge]; if (e == null) throw new Error(`no narrative era for game era ${ge}`); return e; };
// vanilla's era windows (calendar), for placing a MINTED technology by its own year — the game's, not the ladder's anchors
export const gameEraOfYear = y => y < 1836 ? 1 : y <= 1861 ? 2 : y <= 1886 ? 3 : y <= 1911 ? 4 : 5;
// THE DERIVATION: rung eras from the gate technologies' game eras (vanilla method order, additions last), bumped up
// only to keep one rung per era. Returns { eras, overflow } — overflow = true when the ladder does not fit under N,
// in which case the industry needs a PLACEMENT ruling (the generator throws and says so).
export function derivePlacement(gameEras) {
  const eras = []; let prev = -1;
  for (const ge of gameEras) { const e = Math.max(eraOfGameEra(ge), prev + 1); eras.push(e); prev = e; }
  return { eras, overflow: eras.some(e => e > N - 1) };
}
// THE TOLERANCE CHECK on a full placement (derived or ruled): every rung within ERA_TOLERANCE of its technology's
// narrative era, strictly increasing, inside 0..N-1. Returns the list of violations (empty = fine).
export function placementFaults(id, eras, gameEras) {
  const out = [];
  if (eras.length !== gameEras.length) out.push(`${id}: ${eras.length} eras for ${gameEras.length} rungs`);
  eras.forEach((e, k) => {
    if (!(Number.isInteger(e) && e >= 0 && e <= N - 1)) out.push(`${id}: rung ${k} era ${e} outside 0..${N - 1}`);
    if (k && !(e > eras[k - 1])) out.push(`${id}: rung ${k} era ${e} not above rung ${k - 1}'s ${eras[k - 1]} — one rung per era`);
    const imp = eraOfGameEra(gameEras[k]);
    if (Math.abs(e - imp) > ERA_TOLERANCE) out.push(`${id}: rung ${k} sits at e${e} but its technology is game era ${gameEras[k]} → e${imp}, ${Math.abs(e - imp)} eras off (tolerance ${ERA_TOLERANCE})`);
  });
  return out;
}
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

// ⭐ PLACEMENT — THE RULED ADJUSTMENTS (the era rule above places every other industry by itself). An entry is the FULL
//   era list in vanilla method order with the additions last, and it is accepted only if every rung is within
//   ERA_TOLERANCE of its technology's narrative era (placementFaults). The generator THROWS when the derivation
//   overflows and no entry exists, naming the industry: a ruling is needed, not a guess.
//   Derived, no entry (2026-09-13, from the technologies' game eras): food [0,1,2]; textile, furniture, glass, tooling,
//   paper, steel, arms, artillery, art_academy [0,1,2,3]; automotive [2,3] (combustion_engine game era 4, compression_
//   ignition 5); munition [1,2] (percussion_cap era 2 → e1, dynamite era 3 → e1 bumped to e2 — the 2026-09-04 ruling
//   reproduced); synthetics [1] (aniline, era 3); electrics [2] (telephone, GAME ERA 4 — the ruled e1 of 2026-09-04 was
//   one era low, and the ladder priced its only rung as an 1836 one; CORRECTED by the era rule).
//   The three entries below are the industries whose FIRST method is a game-era-2 technology (→ e1) with three
//   researched rungs above it: the ladder fits only with that first rung at e0 — an 1840s method treated as the 1836
//   rung, the one the ×lift is meant to kill.
export const PLACEMENT = {
  fertilizer: [0, 1, 2, 3],   // intensive_agriculture (2 → e0, −1); improved_fertilizer (3); nitrogen_fixation (4); catalytic_synthesis (minted, 5)
  explosives: [0, 1, 2, 3],   // intensive_agriculture (2 → e0, −1); nitroglycerin (2); dynamite (3, +1); electrical_capacitors (4, +1)
  motor: [0, 2, 3],           // atmospheric_engine (2 → e0, −1: the ladder overflows at e1 — electric_railway 4 → e2, compression_ignition 5 → e3); see below
  // motor — NO ENTRY (user-ruled 2026-09-13, "option B"): the derivation places it [0, 2, 3] by itself once the minted
  //   high_speed_diesel addition is gone — atmospheric_engine (2 → e0 by the same first-rung reasoning as fertilizer and
  //   explosives, but here the ladder FITS: e0 is forced only because electric engines (electric_railway, GAME ERA 4 → e2) and
  //   diesel (compression_ignition, 5 → e3) take the two slots above), so it needs no ruling. e1 is empty: no engine method
  //   exists between 1836 and the electric engine. The rejected alternative ("option A", the state from 2026-09-04 to
  //   2026-09-13) was [0,1,2,3] with the addition, which put electric engines and diesel one era BELOW their technologies.
  //   Munition stays [1,2] — "earliest munition is t1" (user, 2026-09-13), which is what the derivation gives.
};

// ⭐ THE ADDITIONS (rule 2): a rung vanilla does not have, appended as the industry's TOP rung, each with its own key,
//   building name, method name, year and MINTED technology. Its recipe, staffing, pollution and icon are the rung
//   below's (the A/B book re-scales the recipe). THREE, each where vanilla's top method sits on a game era below 5 so the
//   e3 (1940) slot is EMPTY under the era rule, and no secondary group of the building covers the theme (rule 3). "Mint
//   them" was ruled 2026-08-30; four survived the 2026-09-04 rules; motor's fell to the era rule on 2026-09-13 (below).
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
  // ⚠ REMOVED 2026-09-13 (user-ruled, "option B" of the era pass): motor's high_speed_diesel (1935, minted era 5). Under the era
  //   rule compression_ignition — an ERA-5 technology — IS motor's e3 (1940) rung, so the addition had no slot; keeping it meant
  //   electric engines (game era 4) on e1 and diesel (era 5) on e2, each one era below its technology. Motor now derives
  //   [0, 2, 3]. Its text, for the record: "Small fast-running diesels on welded frames, built by the thousand for lorries,
  //   launches and generators rather than one at a time for ships."
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

// ⭐⭐ PER-PM OVERRIDES ON VANILLA'S OWN METHODS — the four-rung book's copy of the rulings that are NOT about our rungs.
//   Emitted as the config's top-level `pm_goods` / `pm_employment`, which build.ps1 writes into the owned production-method
//   files. REPLACEMENT semantics: the override IS that method's whole goods block, so it both adds and removes goods.
//
// ⭐⭐ THE URBAN CENTRE IS AN ELECTRICITY **SOURCE**, NOT A SINK (user-ruled, BALANCE_FRAMEWORK §10.43) — restored here
//   2026-09-19 after the user caught it missing mid-batch ("fix the electricity and restart"). The 1900 MUNICIPAL
//   engine-house is modelled inside urban centres rather than as a power-plant rung: `pm_electric_streetlights` PRODUCES
//   +1 electricity and burns 2 coal, and its workforce becomes 250 engineers. Vanilla's own method is the opposite —
//   `goods_input_electricity_add = 3`, 200 laborers + 50 engineers — so without this the power chain starts life with its
//   sign flipped at exactly the point it begins to matter.
//   ⚠⚠ WHY IT WAS ABSENT: the 2026-09-04 rebuild-from-vanilla (§10.72) deliberately carries NOTHING from the six-rung
//   book, and these two keys went with everything else. Every four-rung book from `canon4v` to `canon-c19-in12` shipped
//   without them; it is ROADMAP step 8 **P2**. The six-rung config is where they survived.
//   ⚠ The 2-coal figure is the RULED one (§10.43.2): 1 coal left the mandate too profitable, 3 would force a loss-maker.
//   ⚠ It belongs HERE, in the spec, rather than in a hand-edited config — a hand edit is exactly how it was lost.
export const PM_GOODS_RULED = {
  pm_electric_streetlights: { in: { coal: 2 }, out: { services: 10, electricity: 1 } },
};
export const PM_EMPLOYMENT_RULED = {
  pm_electric_streetlights: { engineers: 250 },
};

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
    "finish_boost": {
      "enabled": true,
      "unresearchable": "skip",
      "add": 10000,
      "_why": "User-ruled 2026-09-23: a technology the journal entries have paid for in full (2 stages and no ahead-of-time penalty, or 3 stages and a penalty the third grant still covers) gets +add AI research weight, so the AI takes an infinitesimally cheap benefit. Thresholds and the penalty are DERIVED from the emitted tree by tools/emit_tech_finish.mjs. 'skip' = the engine does not count can_research = no technologies (sericulture) toward the penalty, measured 26,492/26,492 (FINDINGS F160). ⚠ F160 also found that a grant reaching the cost completes the technology on the spot, so the boost is expected to fire rarely if ever; it covers the one untested route, a penalty that falls below banked progress. diag: true adds the probe diagnostics — probe builds only."
    },
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
  name: 'canon4v-hai3', declared: '2026-09-04', canonised: '2026-09-05', reruled: '2026-09-06', era_rule: '2026-09-13',
  era_rule_note: 'THE ERA RULE (user-ruled 2026-09-13, BALANCE_FRAMEWORK §10.78; the header of this file): every rung on the narrative era its gate technology\'s game era implies, the A/B book keyed on the era; electrics e1 → e2; motor placed by the rule alone at [0,2,3] with the minted high_speed_diesel addition dropped ("option B"); munition [1,2] confirmed ("earliest munition is t1"). Canonised the same day ("Canonize the outcome config"): 56 buildings, 182 technologies (3 minted). The book F106/F107 measured is commit 880f098\'s copy.',
  ruled_by: 'user: 4 vanilla methods -> 4 rungs; additions only where ruled; rules 1-3 on names and additions; NO six-rung data consulted (the third ruling, 2026-09-04); canonised 2026-09-05 with the art academy on the REGULAR ladder (rung 0 at vanilla’s own 400-point cost, then ×2 per rung) — the ×3 film rung of canon4v-art3 reverted as gameable, an infinite money printer; 2026-09-06: the ruled set of §10.75 (ai_value 3^era on every industry, the investment-pool defines) canonised after F106 ("Canonise the latest config")',
  from: 'tools/make_tier4_config.mjs (the GAME + tools/lib_tier4_spec.mjs, nothing else) -> make_tier4_techs.mjs (vanilla technologies at vanilla eras/names/prerequisites + ERA_MOVES + the additions’ minted technologies) -> make_ab_config --A 2.0 --B 1.5 --ai-steep glass,tooling:3',
  not_carried: 'the six-rung book’s ai_defines (hoard levers), pm_goods/pm_employment (electric streetlights), building_ai_value (trade centre 5000), building_subsidies, start_tech_grants (NET), technology renames, era alignment, and the start_exceptions chain seed (start_exceptions_file -> config/start_exceptions.vanilla.json)',
  status: 'THE CANON since 2026-09-06 is canon4v-hai3: this structure through the A/B book (A 2.0 / B 1.5, divisor 0.000125) WITH ai_value 1000×3^era on all 17 industries and the investment-pool defines of §10.75 (measured F106) — config/mod_config.json + config/tech_tree_options.json are config/mod_config.canon4v-hai3.json + twin verbatim (regenerate: make_ab_config --A 2.0 --B 1.5 --suffix canon4v-hai3 --ai-steep <all 17>:3 --divisor 0.000125 --ai-defines <the five>). config/mod_config.canon4v.json is the plain book that was the canon on 2026-09-05 (measured as canon4v-art3, F104/F105); the six-rung canon is retired to config/mod_config.six_rung.json + twin; canon-4rung remains the record of F98-F103',
};
