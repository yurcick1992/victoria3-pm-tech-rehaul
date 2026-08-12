// THE INDUSTRY TECH TREE — three candidate designs, authored here, rendered by ui/techtree.html.
//
//   node tools/tech_tree_spec.mjs            # report: counts, research budget, validation
//   node tools/tech_tree_spec.mjs --write    # + write config/tech_tree_options.json and ui/techdata.js
//
// ROADMAP.md step 1. The mod has 100 building tiers and the game has technologies for 67 of them; the
// other 33 are `model_only` — solved by the balance model, never emitted, because nothing in the game
// could unlock them. This file is where that gap is closed, and it is a DESIGN DOCUMENT as much as a
// generator: the three options below are three different philosophies about what a technology IS.
//
// ---------------------------------------------------------------------------------------------------
// WHAT THE ENGINE IMPOSES (measured off the 1.13 game files, 2026-08-10 — see ROADMAP.md step 1)
//
//   * The tech tree is AUTO-LAID-OUT (`TechTreePanel.GetProductionTechTreeItems`/`…Lines`). Adding
//     techs needs no GUI work. Only the era band dividers are hardcoded, and those are cosmetic.
//   * COST IS PER ERA, never per tech: 7500 / 10000 / 12500 / 15000 / 17500.
//   * The AHEAD-OF-TIME PENALTY scales with the SIZE of the tree:
//         cost = eraCost + (unresearched techs in earlier eras OF THIS CATEGORY) x (eraGap x 0.25 x eraCost)
//     so every technology added to production era 1 taxes every later production technology. This is
//     the mechanism that makes a deep industrial tree punish a country that neglects industry.
//   * A tech's era must be >= the era of every prerequisite.
//   * era_1 is granted WHOLESALE (`add_era_researched = era_1`) to the tier-1 and tier-2 starting
//     countries — Britain, USA, France, Belgium, Austria, Prussia, Sweden. Everyone else gets a hand-
//     listed subset. So era-1 bulk is FREE for the leaders and a wall for everybody else, which is
//     exactly the asymmetry the mod wants. ⚠ Whichever option ships, our new era-1 techs must be added
//     to `effect_starting_technology_tier_3..6_tech` where the 1836 start places the matching building,
//     or those countries begin with factories they could not have built.
//
// ---------------------------------------------------------------------------------------------------
// SHARED DESIGN DECISIONS (true in all three options)
//
//   1. ERA-0 TIERS CARRY NO TECHNOLOGY AT ALL. A bloomery forge, a village joinery and a gunsmith's
//      shop are not inventions — they are what exists before industry. They emit with no
//      `unlocking_technologies`, like vanilla's logging camp and fishing wharf. This also gives the
//      least developed countries something they are always allowed to build.
//   2. THE GAME ERA OF A NEW TECH COMES FROM ITS DATE, using vanilla's own era windows
//      (pre-1836 / 1836-61 / 1862-86 / 1887-1911 / 1912+). Our five-era ladder is a balance device;
//      the game's eras are calendar windows, and `tech_year` is a calendar date, so the mapping is
//      direct. Two tiers of one industry may land in the same game era — that is honest (viscose 1905
//      and synthetic indigo 1897 really are both "era 4") and the engine allows it.
//   3. MILITARY AND SOCIETY INDUSTRIES STAY IN THEIR OWN TREES (user ruling). Arms, artillery,
//      munitions and both shipyard chains keep military gating; the art academy keeps society gating.
//      Their missing rungs get new techs in THAT tree, not in production.
//   4. EVERY VANILLA PRODUCTION TECH SURVIVES. Most of them gate secondary production methods we keep
//      (canning, automation, luxury lines, mining pumps) or a raw-producer building, and several are
//      referenced from journal entries, events and monuments. Deleting one to save research budget
//      would break references for a saving the era cost cannot even express.
//   5. TWO VANILLA TECHS ARE DELIBERATELY RE-ERA'D, both already declared as historical corrections in
//      build_era_ladder.mjs: `aniline` era 3 -> 2 (Perkin's mauveine is 1856) and `telephone` era 4 -> 3
//      (Bell 1876, first exchange 1878).
//
// ---------------------------------------------------------------------------------------------------
// THE THREE OPTIONS
//
//   1  VANILLA-SHAPED  — a technology is an INVENTION, and an invention lifts several industries at
//      once. Keeps vanilla's topology and its shared techs (`manufacturies` still unlocks six
//      industries' first rung), and extends it only where our ladder has rungs vanilla never had.
//      Smallest tree, cheapest research, most familiar to a returning player.
//      ⚠ Costs the most for ROADMAP step 2: a shared tech cannot be rewarded to one industry.
//
//   2  INDUSTRY LADDERS — a technology is a STEP IN ONE INDUSTRY'S HISTORY. One dedicated tech per
//      tier, 22 near-independent verticals, cross-links only where a recipe literally cannot exist
//      without another industry's product. Maximum per-industry targeting, which is what step 2 wants;
//      reads like an industry's own story. Weakest at making a tech lead in one sector lift the others.
//
//   3  PLATFORM & APPLICATION — a technology is either a GENERAL-PURPOSE CAPABILITY or its APPLICATION
//      to one industry. Option 2's ladders plus a backbone of ~9 platform techs (interchangeable parts,
//      high-pressure steam, precision measurement, electric drive, alloy steels, scientific management,
//      industrial catalysis, light alloys, process control); each tier tech also requires the platform
//      of its generation. Strongest realisation of "a technological edge should really matter" — neglect
//      steel or electricity and every industry stalls. Biggest and densest.
//
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const WRITE = process.argv.includes('--write');
// ⚠⚠ FOLLOWS MOD_CONFIG, like every other step. The tree is DERIVED from the tier ladder, so generating
// it against one config and shipping it beside another is the same defect that has now been fixed in
// five tools; here it would produce technologies unlocking buildings that do not exist and tiers no
// technology unlocks — the two failure modes emit_techs' coverage guard exists to catch.
const CFGPATH = join(REPO, process.env.MOD_CONFIG || join('config', 'mod_config.json'));
const SFX = (() => { const b = (process.env.MOD_CONFIG || '').split(/[\\/]/).pop() || '';
  const m = b.match(/^mod_config\.(.+)\.json$/); return m ? '.' + m[1] : ''; })();

// ===================================================================================================
// 1. VANILLA — parsed live, never transcribed, so a patch cannot leave this file quietly wrong.
// ===================================================================================================
const ERA_COST = { 1: 7500, 2: 10000, 3: 12500, 4: 15000, 5: 17500 };

function parseVanillaTechs() {
  const out = {};
  for (const [file, cat] of [['10_production', 'production'], ['20_military', 'military'], ['30_society', 'society']]) {
    const txt = readFileSync(join(GAME, 'common/technology/technologies', file + '.txt'), 'utf8').replace(/^\uFEFF/, '');
    // Top-level blocks only: a tech starts at column 0.
    // ⚠ The hyphen is load-bearing: `pan-nationalism` is a real society technology, and a naive
    // [a-z_0-9]+ silently drops it — 63 blocks parsed against 64 `era =` lines.
    const re = /^([a-z_0-9-]+) = \{$/gm;
    let m;
    const starts = [];
    while ((m = re.exec(txt))) starts.push({ id: m[1], at: m.index });
    starts.forEach((s, i) => {
      const body = txt.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : txt.length);
      const era = +(body.match(/^\tera = era_(\d)/m)?.[1] ?? 0);
      const pre = body.match(/unlocking_technologies = \{([^}]*)\}/);
      const prereqs = pre ? pre[1].split(/\s+/).filter(Boolean) : [];
      out[s.id] = { id: s.id, category: cat, era, prereqs, vanilla: true };
    });
  }
  return out;
}

// Which vanilla buildings each vanilla tech unlocks — parsed too, so the tree can state what a
// technology is FOR without a hand-kept list drifting away from the game.
function parseVanillaBuildingUnlocks() {
  const byTech = {};
  const dir = join(GAME, 'common/buildings');
  for (const f of ['01_industry', '02_agro', '03_mines', '04_plantations', '05_military', '06_urban_center',
                   '07_government', '09_misc_resource', '11_private_infrastructure', '13_construction']) {
    const txt = readFileSync(join(dir, f + '.txt'), 'utf8').replace(/^\uFEFF/, '');
    const re = /^(building_[a-z_0-9]+) = \{$/gm;
    let m; const starts = [];
    while ((m = re.exec(txt))) starts.push({ id: m[1], at: m.index });
    starts.forEach((s, i) => {
      const body = txt.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : txt.length);
      const pre = body.match(/unlocking_technologies = \{([^}]*)\}/);
      if (!pre) return;
      for (const t of pre[1].split(/\s+/).filter(Boolean)) (byTech[t] ||= []).push(s.id);
    });
  }
  return byTech;
}

// Display names for the vanilla technologies, read from the game's own localization so the tree shows
// what a player sees rather than a script id.
function parseVanillaLoc() {
  const out = {};
  const txt = readFileSync(join(GAME, 'localization/english/inventions_l_english.yml'), 'utf8').replace(/^﻿/, '');
  const title = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  for (const m of txt.matchAll(/^ ([a-z_0-9-]+):\d* "(.*)"$/gm)) {
    if (m[1].endsWith('_desc')) continue;
    // Several naval technology names are themselves loc references — "$ship_type_modern_ironclad$".
    // Resolving them properly means reading another file for a display string we only show as a node
    // label, so they are title-cased in place instead.
    out[m[1]] = m[2].replace(/\$([a-z_0-9]+)\$/g, (_, k) => title(k.replace(/^ship_type_/, '')));
  }
  return out;
}

// Every modifier type the game knows. A modifier name we invent does NOT error in game — it silently
// does nothing, and the technology carrying it becomes exactly the empty tech we are forbidding. So the
// names are checked against the game's own definitions here, at authoring time.
function parseModifierTypes() {
  const dir = join(GAME, 'common/modifier_type_definitions');
  const out = new Set();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.txt')) continue;
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/^([a-z_0-9]+)\s*=\s*\{/gm)) out.add(m[1]);
  }
  return out;
}

const VAN = parseVanillaTechs();
const VAN_UNLOCKS = parseVanillaBuildingUnlocks();
const VAN_LOC = parseVanillaLoc();
const MOD_TYPES = parseModifierTypes();

// ===================================================================================================
// 2. OUR TIERS — from the config, which is authoritative for key/era/tech_year/name.
// ===================================================================================================
const cfg = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const TIERS = [];
for (const ind of cfg.industries) {
  for (const t of ind.tiers) {
    TIERS.push({ ind: ind.id, era: t.era, year: t.tech_year, key: t.key, name: t.name, pm: t.pm_name,
                 good: t.output_good ?? ind.output_good, modelOnly: !!t.model_only, curTech: t.tech ?? null });
  }
}
const tier = (ind, era) => TIERS.find(t => t.ind === ind && t.era === era);

// Which tree an industry's ladder lives in (shared decision 3).
const TREE = {
  arms: 'military', artillery: 'military', munition: 'military',
  shipyard: 'military', shipyard_steam: 'military', port: 'military',
  art_academy: 'society',
};
const treeOf = ind => TREE[ind] || 'production';

// Display order of the industry columns in the UI. Raw/general first, then the chains roughly by
// how far downstream they sit.
const IND_ORDER = ['_platform', '_general', '_raw', 'steel', 'tooling', 'motor', 'automotive', 'power', 'railway', 'port',
  'fertilizer', 'explosives', 'synthetics', 'electrics', 'glass', 'paper', 'textile', 'furniture', 'food',
  'arms', 'artillery', 'munition', 'shipyard', 'shipyard_steam', 'art_academy'];

const IND_LABEL = {
  _platform: 'Platforms (opt. 3)', _general: 'General / shared', _raw: 'Raw producers',
  steel: 'Steel', tooling: 'Tooling', motor: 'Engines', automotive: 'Automotive', power: 'Electricity',
  railway: 'Railways', port: 'Ports', fertilizer: 'Fertilizer', explosives: 'Explosives',
  synthetics: 'Synthetics', electrics: 'Electrics', glass: 'Glass', paper: 'Paper', textile: 'Textiles',
  furniture: 'Furniture', food: 'Food', arms: 'Small arms', artillery: 'Artillery', munition: 'Munitions',
  shipyard: 'Sail shipyards', shipyard_steam: 'Steam shipyards', art_academy: 'Art academies',
};

const gameEra = y => y < 1836 ? 1 : y <= 1861 ? 2 : y <= 1886 ? 3 : y <= 1911 ? 4 : 5;

// ===================================================================================================
// 3. NEW TECHNOLOGIES — the authored half. `era` is omitted where it follows from `year`.
//    `in` lists which options use it: any of '1','2','3'.
// ===================================================================================================
const NEW = {
  // ⭐ THE RE-BAND'S FIFTEEN RUNGS (2026-08-12). One technology per interior gap and per era-5 hole the
  // ruled anchors opened — see ROADMAP step 1b. Each names a specific historical step; `era` is stated
  // rather than derived from the year, because gameEra() maps to VANILLA's era windows and ours are a
  // different scale (a 1909 process is our era 3 and vanilla's era 4).
  fat_hydrogenation:         { name: "Fat Hydrogenation", year: 1909, era: 3, in: '123', ind: 'food',
    desc: "Normann's nickel catalyst hardens cheap liquid oils into a solid cooking fat, and the food industry stops depending on animal tallow and the dairy herd." },
  long_draft_spinning:       { name: "Long-Draft Spinning", year: 1925, era: 4, in: '123', ind: 'textile',
    desc: "Drafting the roving further in one passage removes whole banks of machinery from the spinning room, and with individual electric drive the mill is rebuilt around the operative rather than the shaft." },
  rotary_veneer:             { name: "Rotary-Cut Veneer", year: 1900, era: 3, in: '123', ind: 'furniture',
    desc: "Peeling a log on a rotary lathe and gluing the sheets crosswise gives a panel stronger than the timber it came from, and furniture stops being carpentry and starts being assembly." },
  glass_fibre:               { name: "Glass Fibre", year: 1938, era: 5, in: '123', ind: 'glass',
    desc: "Glass drawn continuously into filaments finer than wool is no longer a glazing material at all — it insulates, reinforces and filters, and the glassworks acquires a market that has nothing to do with windows." },
  tracer_control:            { name: "Hydraulic Tracer Control", year: 1936, era: 5, in: '123', ind: 'tooling',
    desc: "A stylus follows a master form and hydraulics repeat it on the cutter, so a complex profile no longer needs a skilled machinist — only a first article to copy." },
  semi_chemical_pulping:     { name: "Semi-Chemical Pulping", year: 1925, era: 4, in: '123', ind: 'paper',
    desc: "A mild sulfite cook followed by mechanical defibring opens hardwoods the chemical mills could not use, and the corrugated box gets a cheap domestic furnish." },
  ammoniacal_liquor:         { name: "Ammoniacal Liquor Recovery", year: 1865, era: 2, in: '123', ind: 'fertilizer',
    desc: "The gasworks and the coke oven were throwing away their ammonia; recovered as sulphate it becomes the first nitrogen fertilizer a country can make rather than import." },
  cyclonite_process:         { name: "Cyclonite Process", year: 1940, era: 5, in: '123', ind: 'explosives',
    desc: "Nitrating hexamine gives an explosive half again as powerful as TNT, and continuous plant makes it in quantities that change what a bomb and a torpedo can do." },
  compound_engines:          { name: "Compound Expansion", year: 1860, era: 2, in: '123', ind: 'motor',
    desc: "Working the steam twice, through a high-pressure and then a low-pressure cylinder, roughly halves the coal per horsepower-hour — and makes the engine works a supplier to shipping rather than to mills alone." },
  steel_hulls:               { name: "Steel Hulls", year: 1875, era: 2, in: '123', ind: 'shipyard_steam', cat: 'military',
    desc: "Mild steel plate is stronger than iron for the same weight, so the same hull carries more cargo or more armour, and the yard's berths are laid out for a material that will not be replaced this century." },
  light_machine_guns:        { name: "Light Machine Guns", year: 1915, era: 4, in: '123', ind: 'arms', cat: 'military',
    desc: "An automatic weapon a section can carry moves sustained fire from the strongpoint into the assault, and the arms industry starts making mechanisms rather than barrels." },
  automatic_aa_guns:         { name: "Automatic Anti-Aircraft Guns", year: 1936, era: 5, in: '123', ind: 'artillery', cat: 'military',
    desc: "A fast-traversing automatic gun on a welded mounting, laid by a mechanical director, is the first artillery designed for a target that moves faster than the shell's flight time." },
  shell_filling:             { name: "Mass Shell Filling", year: 1915, era: 4, in: '123', ind: 'munition', cat: 'military',
    desc: "The filling factory is a distinct industry from the case plant: acres of separated sheds, women's labour at scale, and an output measured in millions of rounds a week." },
  wireless_telegraphy:       { name: "Wireless Telegraphy", year: 1901, era: 3, in: '123', ind: 'electrics',
    desc: "Spark transmitters put a telegraph office on a ship and then across an ocean, and the electrical trade acquires a product that needs no line at all." },
  superheated_steam:         { name: "Superheating", year: 1915, era: 4, in: '123', ind: 'railway',
    desc: "Passing the steam back through the firebox before it reaches the cylinders cuts coal and water by about a quarter per ton-mile, and is why the steam locomotive survived the electric one by forty years." },
  // ---- production: rungs vanilla has no technology for (used by ALL three options) ---------------
  beet_sugar_refining:     { name: 'Beet Sugar Refining',        year: 1815, in: '123', ind: 'food',
    desc: 'Marggraf and Achard\'s beet process frees the sugar trade from the cane colonies, and puts a refinery within reach of any temperate country with a food industry.' },
  calico_printing:         { name: 'Calico Printing',            year: 1830, in: '123', ind: 'textile',
    desc: 'Roller printing and the integrated dye works turn cloth finishing from a craft into a chemical trade, and make patterned cloth a mass commodity.' },
  fourdrinier_machine:     { name: 'Fourdrinier Machine',        year: 1830, in: '123', ind: 'paper',
    desc: 'Continuous web papermaking replaces the vatman\'s mould. Paper stops being sold by the sheet and starts being sold by the mile.' },
  leblanc_process:         { name: 'Leblanc Process',            year: 1820, in: '123', ind: 'explosives',
    desc: 'Soda from salt and sulfuric acid founds the heavy chemical trade — and with it the first works able to make explosives on an industrial scale.' },
  // ⭐ THE PORT LADDER SITS IN THE MILITARY TREE (user ruling 2026-08-11, "ports being in the military
  // tree complement this idea very naturally"). It is not a stretch to reach a number — it is vanilla's
  // own logic: `hydraulic_cranes`, `gantry_cranes`, `floating_harbor` and `concrete_dockyards` are all
  // MILITARY technologies already, so dock engineering was never in the production tree to begin with.
  // Every prerequisite below is therefore a military technology; see the same-tree constraint.
  steamship_bunkering:     { name: 'Steamship Bunkering',        year: 1840, in: '123', ind: 'port', cat: 'military',
    desc: 'A steamer cannot cross an ocean without a coaling station at the other end. Ports rebuild themselves around the bunker, the tug and the tide dock.' },
  regenerative_furnace:    { name: 'Regenerative Furnace',       year: 1867, in: '123', ind: 'glass',
    desc: 'Siemens\' heat-recovery tank furnace runs continuously instead of in pots, halving the fuel a glasshouse burns for every ton it melts.' },
  steel_toolmaking:        { name: 'Steel Toolmaking',           year: 1865, in: '123', ind: 'tooling',
    desc: 'Cheap bulk steel reaches the toolmaker. Cutters that once had to be forged from crucible stock are now made from mill steel and hardened in quantity.' },
  deep_water_docks:        { name: 'Deep Water Docks',           year: 1875, in: '123', ind: 'port', cat: 'military',
    desc: 'Hydraulic cranes, dredged approaches and enclosed basins let a port handle an iron steamer of a draught no tidal quay could ever take.' },
  kraft_process:           { name: 'Kraft Process',              year: 1890, in: '123', ind: 'paper',
    desc: 'Sulfate pulping digests resinous softwoods that sulfite cannot touch, and recovers its own chemicals — the strongest and cheapest pulp yet made.' },
  high_speed_steel:        { name: 'High Speed Steel',           year: 1901, in: '123', ind: 'tooling',
    desc: 'Taylor and White\'s tungsten steel cuts red-hot without losing its edge. Machine shop speeds go from five metres a minute to thirty.' },
  ostwald_process:         { name: 'Ostwald Process',            year: 1908, in: '123', ind: 'explosives',
    desc: 'Catalytic oxidation of ammonia makes nitric acid without a nitrate mine, and cuts the last colonial tether on the explosives trade.' },
  electric_motors:         { name: 'Electric Motors',            year: 1893, in: '123', ind: 'motor',
    desc: 'The polyphase induction motor gives every machine its own prime mover. Line shafting, and the mill built around it, begins to disappear.' },
  diesel_engine:           { name: 'Diesel Engine',              year: 1904, in: '123', ind: 'motor',
    desc: 'Compression ignition burns a fuel no boiler would take, at an efficiency no steam plant can reach, in a works that can build one to order.' },
  synthetic_indigo:        { name: 'Synthetic Indigo',           year: 1897, in: '123', ind: 'synthetics',
    desc: 'Seventeen years and a fortune later, BASF sells indigo made from coal tar — and the Bengal indigo districts have nothing left to sell.' },
  concrete_quays:          { name: 'Reinforced Concrete Quays',  year: 1908, in: '123', ind: 'port', cat: 'military',
    desc: 'Monolithic concrete replaces the timber pile and the masonry block, and a berth can be built where no quarry could ever have supplied one.' },
  nitrocellulose_lacquer:  { name: 'Nitrocellulose Lacquers',    year: 1923, in: '123', ind: 'furniture',
    desc: 'Sprayed lacquer dries in minutes where varnish took days. Furniture finishing stops being the bottleneck of the whole trade.' },
  ribbon_machine:          { name: 'Ribbon Machine',             year: 1926, in: '123', ind: 'glass',
    desc: 'Corning\'s ribbon machine blows bulbs from a moving ribbon of glass at a rate no gathering machine can approach.' },
  cemented_carbide:        { name: 'Cemented Carbide',           year: 1927, in: '123', ind: 'tooling',
    desc: 'Tungsten carbide sintered in cobalt cuts four to seven times faster than high speed steel, and wears out far more slowly.' },
  high_speed_papermaking:  { name: 'High Speed Papermaking',     year: 1930, in: '123', ind: 'paper',
    desc: 'Suction presses, steam drying and precision drives take the Fourdrinier past a quarter mile of paper a minute.' },
  steam_reforming:         { name: 'Steam Reforming',            year: 1931, in: '123', ind: 'fertilizer',
    desc: 'Hydrogen from methane instead of coke. The ammonia plant sheds its gasworks and its coal yard together.' },
  continuous_nitration:    { name: 'Continuous Nitration',       year: 1928, in: '123', ind: 'explosives',
    desc: 'Nitration in a flowing stream rather than a batch pot — safer, steadier, and limited only by how fast acid can be pumped.' },
  continuous_strip_mill:   { name: 'Continuous Wide Strip Mill', year: 1926, in: '123', ind: 'steel',
    desc: 'Armco\'s continuous mill rolls a coil of wide sheet in one pass. It is the largest single step interwar steel takes, and vanilla has no tier for it at all.' },
  high_speed_diesel:       { name: 'High Speed Diesel',          year: 1935, in: '123', ind: 'motor',
    desc: 'Welded frames and light alloys take the diesel from a stationary engine to something a lorry, a locomotive or a submarine can carry.' },
  transfer_machining:      { name: 'Transfer Machining',         year: 1936, in: '123', ind: 'automotive',
    desc: 'Workpieces are indexed automatically from station to station. The assembly line finally reaches the machine shop feeding it.' },
  polyamide_synthesis:     { name: 'Polyamide Synthesis',        year: 1939, in: '123', ind: 'synthetics',
    desc: 'Carothers\' nylon is the first fibre owing nothing to a plant or an animal — and the first that competes with silk on its own terms.' },
  vacuum_tube_electronics: { name: 'Vacuum Tube Electronics',    year: 1935, in: '123', ind: 'electrics',
    desc: 'Amplification makes the valve a component rather than a curiosity, and turns the telephone works into an electronics industry.' },
  pulverized_coal_firing:  { name: 'Pulverized Coal Firing',     year: 1920, in: '123', ind: 'power',
    desc: 'Coal ground to flour and blown into the furnace burns like a gas. Station units jump from single megawatts to tens of them.' },
  mechanised_cargo_handling:{ name: 'Mechanised Cargo Handling', year: 1930, in: '123', ind: 'port', cat: 'military',
    desc: 'Travelling gantries, conveyors and motor trucks on the quay. A motor ship\'s turnaround is measured in days rather than weeks.' },

  // ---- production: the SPLITS that make one tech serve exactly one industry (options 2 and 3) ----
  bakehouse_manufactories: { name: 'Bakehouse Manufactories',    year: 1750, in: '23', ind: 'food',
    desc: 'Victualling contracts for fleets and garrisons turn baking from a town trade into a manufactory with an oven that never goes cold.' },
  ready_made_clothing:     { name: 'Ready-Made Clothing',        year: 1800, in: '23', ind: 'textile',
    desc: 'Standard sizing and cut-to-pattern work let clothing be made before it is ordered — the beginning of the garment trade proper.' },
  manufactory_joinery:     { name: 'Manufactory Joinery',        year: 1800, in: '23', ind: 'furniture',
    desc: 'Gillows-scale firms divide the cabinetmaker\'s craft into stations, and furniture leaves the workshop for the warehouse.' },
  coal_fired_glasshouse:   { name: 'Coal-Fired Glasshouse',      year: 1750, in: '23', ind: 'glass',
    desc: 'The coal cone frees the glassmaker from the forest, and puts the glasshouse next to the coalfield instead.' },
  toolmakers_workshops:    { name: 'Toolmakers\' Workshops',     year: 1770, in: '23', ind: 'tooling',
    desc: 'Birmingham and Sheffield make edge tools by the gross rather than by the order, and sell them to trades that never met a toolmaker.' },
  pulp_pressing_mills:     { name: 'Pulp Pressing Mills',        year: 1750, in: '23', ind: 'paper',
    desc: 'Water-powered stampers and the Hollander beater put pulp preparation on a mill footing, well before the paper machine exists.' },
  sewing_machine_works:    { name: 'Sewing Machine Works',       year: 1855, in: '23', ind: 'textile',
    desc: 'Howe and Singer\'s machine reaches the factory floor. A seam that took an hour takes minutes, and the garment trade industrialises around it.' },
  bentwood_furniture:      { name: 'Bentwood Furniture',         year: 1855, in: '23', ind: 'furniture',
    desc: 'Steam-bent components, standardised and shipped flat. Thonet sells the same chair on three continents.' },
  electric_drive_looms:    { name: 'Electric Drive Looms',       year: 1905, in: '23', ind: 'textile',
    desc: 'Individual motor drive per loom ends the overhead shaft, and lets a weaving shed be laid out for the cloth instead of for the belting.' },
  superphosphate:          { name: 'Superphosphate',             year: 1842, in: '23', ind: 'fertilizer',
    desc: 'Lawes treats bone and coprolite with sulfuric acid and patents the first manufactured fertilizer. Chemistry enters the field.' },
  pig_iron_tooling:        { name: 'Pig Iron Tooling',           year: 1830, in: '23', ind: 'tooling',
    desc: 'Foundry practice and malleable castings put cheap iron tools within reach of trades that could never afford forged steel.' },
  sulfite_pulping:         { name: 'Sulfite Pulping',            year: 1874, in: '23', ind: 'paper',
    desc: 'Tilghman\'s acid digestion turns standing timber into paper, and rag supply stops being the ceiling on how much a country can print.' },

  // ---- production: PLATFORMS (option 3 only) ----------------------------------------------------
  // Four domains, each a short chain. An industry belongs to one domain (PLATFORM_DOMAIN below) and a
  // rung requires the latest platform of its domain at or below its own era — so a domain may have
  // gaps, and an early rung may need no platform at all.
  interchangeable_parts:   { name: 'Interchangeable Parts',      year: 1798, in: '3', ind: '_platform', platform: 'MECH',
    mod: { building_economy_of_scale_level_cap_add: 5, goods_output_tools_mult: 0.05 },
    desc: 'Gauges, jigs and go/no-go limits in place of the fitter\'s file. The armoury practice that every assembled trade eventually copies.' },
  precision_measurement:   { name: 'Precision Measurement',      year: 1867, in: '3', ind: '_platform', platform: 'MECH',
    mod: { building_group_bg_manufacturing_throughput_add: 0.05, goods_output_tools_mult: 0.05 },
    desc: 'Whitworth\'s standards and the millionth-of-an-inch comparator. A tolerance stops being a workshop opinion and becomes a number.' },
  scientific_management:   { name: 'Scientific Management',      year: 1911, in: '3', ind: '_platform', platform: 'MECH',
    mod: { building_economy_of_scale_level_cap_add: 10 },
    desc: 'Time study, routing and the planning department. The bottleneck moves from what a machine can do to how the work reaches it.' },
  light_alloys:            { name: 'Light Alloys',               year: 1920, in: '3', ind: '_platform', platform: 'MECH',
    mod: { building_group_bg_manufacturing_throughput_add: 0.05, building_group_bg_military_industry_throughput_add: 0.05 },
    desc: 'Duralumin and its relatives: strength without weight, and a machining problem every industry has to learn.' },
  high_pressure_steam:     { name: 'High Pressure Steam',        year: 1840, in: '3', ind: '_platform', platform: 'POWER',
    mod: { building_group_bg_heavy_industry_throughput_add: 0.05, building_group_bg_mining_throughput_add: 0.05 },
    desc: 'Trevithick\'s pressures make an engine small enough to put where the work is, instead of building the work around the engine.' },
  electric_drive:          { name: 'Electric Drive',             year: 1893, in: '3', ind: '_platform', platform: 'POWER',
    mod: { building_group_bg_light_industry_throughput_add: 0.1 },
    desc: 'Power delivered as wire rather than as shafting. Every industry gets to rebuild its floor plan around its process.' },
  process_control:         { name: 'Process Control',            year: 1930, in: '3', ind: '_platform', platform: 'POWER',
    mod: { building_group_bg_heavy_industry_throughput_add: 0.1 },
    desc: 'Instruments that hold a process on its setpoint without a hand on the valve — continuous production\'s missing precondition.' },
  // 1746, not 1830: Roebuck's lead chamber process. Dating it later would put it AFTER the Leblanc
  // works that consume its acid.
  mineral_acids:           { name: 'Mineral Acids',              year: 1746, in: '3', ind: '_platform', platform: 'CHEM',
    mod: { building_group_bg_manufacturing_throughput_add: 0.05 },
    desc: 'Roebuck\'s lead chamber puts sulfuric acid on a works footing. Every chemical trade after this one is downstream of it.' },
  industrial_catalysis:    { name: 'Industrial Catalysis',       year: 1902, in: '3', ind: '_platform', platform: 'CHEM',
    mod: { building_group_bg_manufacturing_throughput_add: 0.1 },
    desc: 'A bed of platinum, and a reaction that would not otherwise run. The chemical works stops distilling nature and starts building molecules.' },
  alloy_steels:            { name: 'Alloy Steels',               year: 1900, in: '3', ind: '_platform', platform: 'MAT',
    mod: { building_group_bg_heavy_industry_throughput_add: 0.05, building_group_bg_military_industry_throughput_add: 0.05 },
    desc: 'Manganese, nickel, chromium, tungsten. Steel stops being one material and becomes a catalogue of them.' },

  // ---- military: the rungs vanilla is missing (ALL options) -------------------------------------
  iron_screw_steamers:     { name: 'Iron Screw Steamers',        year: 1843, in: '123', ind: 'shipyard_steam', cat: 'military',
    desc: 'The Great Britain: iron hull, screw propeller, no sail worth the name. A yard that can build her is not a yard that built clippers.' },
  explosive_shells:        { name: 'Filled Explosive Shells',    year: 1875, in: '123', ind: 'munition', cat: 'military',
    desc: 'Shells filled and fused on a production line rather than in a laboratory, in quantities a siege can actually spend.' },
  marine_steam_turbine:    { name: 'Marine Steam Turbine',       year: 1903, in: '123', ind: 'shipyard_steam', cat: 'military',
    desc: 'Parsons\' turbine at sea: fewer moving parts, no reciprocating mass, and speeds a triple-expansion engine cannot reach.' },
  drawn_brass_cartridges:  { name: 'Drawn Brass Cartridges',     year: 1895, in: '123', ind: 'munition', cat: 'military',
    desc: 'Deep-drawn cases and smokeless powder, loaded by automatic machinery. Ammunition becomes a volume manufacture like any other.' },
  recoil_carriages:        { name: 'Recoil Carriages',           year: 1897, in: '123', ind: 'artillery', cat: 'military',
    desc: 'The French 75\'s hydro-pneumatic recoil keeps the barrel on target between rounds, and multiplies a battery\'s rate of fire.' },
  oil_fired_boilers:       { name: 'Oil-Fired Boilers',          year: 1913, in: '123', ind: 'shipyard_steam', cat: 'military',
    desc: 'Oil firing halves the stokehold crew and doubles the range. The yard\'s customers stop specifying coal bunkers.' },
  autofrettage:            { name: 'Autofrettage',               year: 1925, in: '123', ind: 'artillery', cat: 'military',
    desc: 'Pre-stressing a barrel from within replaces built-up hoop construction — a lighter gun of the same power, made in fewer operations.' },
  stamped_receivers:       { name: 'Stamped Receivers',          year: 1938, in: '123', ind: 'arms', cat: 'military',
    desc: 'Pressed and welded sheet metal in place of milled forgings. A weapon a bicycle works can make, in the numbers a war needs.' },
  automatic_cartridge_lines:{ name: 'Automatic Cartridge Lines', year: 1940, in: '123', ind: 'munition', cat: 'military',
    desc: 'Case, primer, powder and bullet joined by machines that need a setter rather than an operator.' },
  gunsmith_workshops:      { name: 'Gunsmith Workshops',         year: 1770, in: '23', ind: 'arms', cat: 'military',
    desc: 'The Birmingham gun quarter: barrel, lock and stock made by separate trades and assembled to a contract.' },
  bronze_gun_founding:     { name: 'Bronze Gun Founding',        year: 1750, in: '23', ind: 'artillery', cat: 'military',
    desc: 'Solid casting and Maritz boring turn the cannon foundry from a bell-founder\'s sideline into a state arsenal.' },

  // ---- society: the one rung vanilla is missing (ALL options) ------------------------------------
  sound_film:              { name: 'Sound Film',                 year: 1927, in: '123', ind: 'art_academy', cat: 'society',
    desc: 'Synchronised sound, and then colour. The academy\'s product stops being a picture and becomes a performance.' },


};

// ===================================================================================================
// 3b. NARRATIVE ONSET — the year the thing a technology NAMES was first practically available.
//     Authored for every VANILLA technology (our own carry their own `year`), because a mod that dates
//     its own ladder to the year and inherits an undated one around it is only half honest.
//
// ⚠ THIS IS A DATE FOR THE NAME, NOT FOR THE SLOT. Where vanilla's name and vanilla's placement
// disagree, that disagreement is the finding — `pumpjacks` (1925) unlocks oil drilling (1859) in era 3,
// and no single number can make both true. The report prints every such conflict; do not "fix" one by
// quietly redating it to whatever its era wants.
// ⚠ Where a name spans a long development, the date is FIRST PRACTICAL COMMERCIAL USE, not first
// demonstration — the same rule `build_era_ladder.mjs` uses for tech_year.
const ONSET = {
  // --- production, era 1 ---
  sericulture: 1600,            // European sericulture at scale; the practice itself is millennia old
  enclosure: 1750,              // parliamentary enclosure
  manufacturies: 1700,
  shaft_mining: 1712,           // Newcomen's engine is what makes a deep shaft drainable
  cotton_gin: 1793,
  lathe: 1800,                  // Maudslay's screw-cutting lathe
  distillation: 1700,
  steelworking: 1740,           // Huntsman's crucible steel
  prospecting: 1750,
  // --- production, era 2 ---
  crystal_glass: 1674,          // Ravenscroft's lead crystal
  intensive_agriculture: 1842,  // vanilla's own comment: this unlocks chemical plants — superphosphate
  fractional_distillation: 1830,// Coffey still
  canneries: 1813,              // Donkin & Hall's tin cannery
  watertube_boiler: 1867,       // Babcock & Wilcox; earlier experiments never left the workshop
  atmospheric_engine: 1712,     // Newcomen
  railways: 1825,               // Stockton & Darlington
  chemical_bleaching: 1799,     // Tennant's bleaching powder
  nitroglycerin: 1847,          // Sobrero
  bessemer_process: 1856,
  baking_powder: 1843,
  mechanized_workshops: 1850,
  mechanical_tools: 1840,       // Whitworth's standard machine tools
  // --- production, era 3 ---
  improved_fertilizer: 1878,    // Thomas slag
  steam_donkey: 1881,           // Dolbeer
  dynamite: 1867,
  rubber_mastication: 1820,     // Hancock's masticator; vulcanization is 1839 and has its own tech
  rotary_valve_engine: 1849,    // Corliss
  reinforced_concrete: 1867,    // Monier
  // ⚠ These two are dated to what we RENAME them to, not to vanilla's name — that is the whole point of
  // the rename. The vanilla name's own date is in the RENAME note, so nothing is hidden.
  threshing_machine: 1842,      // STEAM threshing, which vanilla's own comment says it unlocks
  pumpjacks: 1859,              // Drake's well — the oil rig it unlocks
  aniline: 1856,                // Perkin's mauveine — the reason we re-era it
  open_hearth_process: 1865,    // Siemens-Martin
  vulcanization: 1839,          // Goodyear
  vacuum_canning: 1874,         // Shriver's retort
  shift_work: 1870,
  steel_railway_cars: 1867,
  electrical_generation: 1882,  // Pearl Street
  // --- production, era 4 ---
  mechanized_farming: 1892,     // Froelich's tractor
  art_silk: 1905,               // commercial viscose rayon
  automatic_bottle_blowers: 1903,
  conveyors: 1913,              // Ford's moving assembly line
  pasteurization: 1864,         // Pasteur; commercial milk pasteurization is 1890
  electric_railway: 1895,       // Baltimore & Ohio mainline
  combustion_engine: 1886,      // Benz Patent-Motorwagen
  pneumatic_tools: 1871,        // pneumatic rock drill
  nitrogen_fixation: 1913,      // Oppau
  electric_arc_process: 1903,   // first commercial Héroult steel plants
  steam_turbine: 1900,          // Elberfeld station
  plastics: 1907,               // Bakelite
  electrical_capacitors: 1891,  // dated as POLYPHASE AC DISTRIBUTION, which is what it actually gates;
                                // a capacitor as such is the Leyden jar, 1745
  radio: 1920,                  // broadcast radio as a good; Marconi's wireless telegraphy is 1895
  telephone: 1878,              // first exchange — the reason we re-era it
  // --- production, era 5 ---
  arc_welding: 1919,            // coated electrodes make it a production process
  compression_ignition: 1897,   // Diesel's engine; the diesel LOCOMOTIVE vanilla means is 1934
  dough_rollers: 1920,
  flash_freezing: 1924,         // Birdseye
  oil_turbine: 1920,            // oil-fired central stations

  // --- military ---
  standing_army: 1650, navigation: 1700, gunsmithing: 1700, artillery: 1700, military_drill: 1700,
  line_infantry: 1700, drydocks: 1700, admiralty: 1700, mandatory_service: 1793, // levée en masse
  army_reserves: 1813,          // Prussian Landwehr
  napoleonic_warfare: 1805, paddle_steamer: 1807, // Fulton's North River
  shell_gun: 1822,              // Paixhans
  percussion_cap: 1822, rifling: 1849, // Minié ball
  screw_frigate: 1843, hydraulic_cranes: 1846, // Armstrong
  general_staff: 1857,          // Moltke's staff — the version other armies actually copied; the
                                // Prussian original is 1806 and was nobody else's institution
  field_works: 1855, logistics: 1855, power_of_the_purse: 1830, triage: 1846,
  repeaters: 1860,              // Henry rifle
  breech_loading_artillery: 1859, // Armstrong gun
  ironclad_tech: 1859,          // Gloire
  monitor_tech: 1862, gantry_cranes: 1875,
  floating_harbor: 1868,        // floating dry dock; the Mulberry harbour is 1944
  self_propelled_torpedoes: 1866, // Whitehead
  jeune_ecole: 1880, electric_telegraph: 1837, handcranked_machine_gun: 1862, // Gatling
  modern_nursing: 1854,         // Nightingale at Scutari
  enlistment_offices: 1860, military_statistics: 1865,
  bolt_action_rifles: 1886,     // Lebel
  automatic_machine_guns: 1884, // Maxim
  concrete_dockyards: 1900, defense_in_depth: 1917, dreadnought_tech: 1906,
  landing_craft: 1915,          // Gallipoli
  military_aviation: 1911,      // Italo-Turkish war
  pre_dreadnought_tech: 1889, sea_lane_strategies: 1890, // Mahan
  submarine: 1900,              // Holland VI
  trench_works: 1904,           // Port Arthur
  war_propaganda: 1914,
  wargaming: 1824,              // Reisswitz's Kriegsspiel
  battlefleet_tactics: 1916, battleship_tech: 1912, carrier_tech: 1918,
  chemical_warfare: 1915, concrete_fortifications: 1930, // Maginot
  destroyer: 1893,              // HMS Havock
  flamethrowers: 1915, mobile_armor: 1916, nco_training: 1900, stormtroopers: 1918,

  // --- society ---
  urbanization: 1700, rationalism: 1650, tech_bureaucracy: 1700, urban_planning: 1750,
  centralization: 1700, international_trade: 1700, international_relations: 1648, // Westphalia
  democracy: 1789, academia: 1700, romanticism: 1800, medical_degrees: 1750,
  currency_standards: 1717,     // Newton's gold standard
  banking: 1694, stock_exchange: 1698, colonization: 1500,
  law_enforcement: 1829,        // Peel's Metropolitan Police
  mass_communication: 1814,     // steam-powered press at The Times
  empiricism: 1700,
  central_archives: 1838,       // the Public Record Office — the model everyone copied; the French
                                // Archives Nationales is 1790 but was nobody's export
  central_banking: 1844,        // Bank Charter Act
  corporate_charters: 1844, dialectics: 1807, egalitarianism: 1789,
  joint_stock_companies: 1856, labor_movement: 1834, modern_sewerage: 1858,
  nationalism: 1789, organized_sports: 1863, // the Football Association
  pharmaceuticals: 1827,        // Merck's alkaloid works
  postal_savings: 1861, psychiatry: 1808, quinine: 1820, realism: 1850,
  anarchism: 1840, camera: 1839, // daguerreotype
  civilizing_mission: 1870, corporatism: 1891, // Rerum Novarum
  feminism: 1848,               // Seneca Falls
  human_rights: 1789, identification_documents: 1860,
  investment_banks: 1852,       // Crédit Mobilier
  mutual_funds: 1868,           // Foreign & Colonial Government Trust
  'pan-nationalism': 1848, philosophical_pragmatism: 1878, socialism: 1848,
  steel_frame_buildings: 1884,  // Home Insurance Building
  central_planning: 1917, corporate_management: 1900,
  elevator: 1889,               // the ELECTRIC lift, which is what makes a steel frame worth building
                                // tall; Otis's safety lift is 1857 and only reaches five storeys
  film: 1895, international_exchange_standards: 1922, // Genoa
  malaria_prevention: 1897,     // Ross
  multilateral_alliances: 1900, political_agitation: 1900, psychoanalysis: 1899,
  zeppelins: 1900,
  analytical_philosophy: 1912, antibiotics: 1928, behaviorism: 1913,
  macroeconomics: 1936,         // the General Theory
  mass_propaganda: 1917, mass_surveillance: 1920, modern_financial_instruments: 1920,
  paved_roads: 1872,            // sheet asphalt, Washington DC
};

// The game's eras are CALENDAR WINDOWS, and that is what makes an onset date checkable against them.
const ERA_WINDOW = { 1: [null, 1835], 2: [1836, 1861], 3: [1862, 1886], 4: [1887, 1911], 5: [1912, 1936] };
// A technology gated an era or so after the thing existed is normal — research is not invention. The
// grace is one era width, so only real outliers are reported.
const LATE_GRACE = 25;

// ⚠⚠ "FIRST PRACTICAL USE" DOES NOT TRANSFER TO AN IDEA, and pretending it does manufactures absurdities
// that are not there. Nationalism was articulated in 1789 and became a force that moved armies in 1848;
// egalitarianism, human rights and dialectics are the same shape. Vanilla gates these by when they
// became a MASS movement, which is the right call and the only one a game can act on. So they are dated
// to first articulation — the honest date for the name — and reported in their own bucket rather than
// counted as errors. An ANACHRONISTIC idea is still a real fault: you cannot hold a doctrine that has
// not been thought of.
const IDEA_TECH = new Set([
  'rationalism', 'empiricism', 'democracy', 'romanticism', 'realism', 'dialectics', 'egalitarianism',
  'nationalism', 'pan-nationalism', 'human_rights', 'feminism', 'anarchism', 'socialism', 'corporatism',
  'philosophical_pragmatism', 'psychiatry', 'psychoanalysis', 'behaviorism', 'analytical_philosophy',
  'sociology', 'civilizing_mission', 'labor_movement', 'political_agitation', 'macroeconomics',
]);

// ⭐ RENAMES. A vanilla technology we reuse for a slot it does not describe keeps its KEY — 457 vanilla
// references depend on those — but gets a new DISPLAY NAME through our localization. Ruled 2026-08-10:
// "don't leave the vanilla name at all if the tech means something drastically different."
const RENAME = {
  crystal_glass: ['Lead Crystal',
    'It unlocks the LEADED glassworks; the crystal tier is a rung above it, on the regenerative furnace.'],
  electrical_capacitors: ['Alternating Current',
    'It gates electric drive in mills, brine electrolysis and electric saws — polyphase distribution, not a component. A capacitor is the Leyden jar, 1745.'],
  pumpjacks: ['Oil Drilling',
    'It unlocks the oil rig, which is Drake 1859. The pumpjack itself is 1925 and cannot be what gates an era-3 building.'],
  threshing_machine: ['Steam Threshing',
    'Vanilla\'s own comment says it unlocks Steam Threshers. The bare threshing machine is Meikle, 1786, and does not belong in era 3.'],
  dough_rollers: ['Mechanised Bakeries',
    'It unlocks the whole automated bakery, of which the dough roller is one machine — and in our ladder it is a tier building.'],
};

// ===================================================================================================
// 4. THE LADDERS — which technology unlocks each tier, per option.
//    o1 = Vanilla-Shaped · o2 = Industry Ladders · o3 = Platform & Application (ids follow o2).
//    `null` = no unlocking technology at all (shared decision 1, and vanilla's own untech'd ports).
//    `x:` = the extra, NON-ladder prerequisites that make narrative sense. Deliberately sparse in o2
//    per the brief ("do not overdo on prerequisites"); o3 adds its platform on top.
// ===================================================================================================
const LADDER = {
  food: [
    { era: 0, o1: 'manufacturies',       o2: 'bakehouse_manufactories' },
    { era: 1, o1: 'beet_sugar_refining', o2: 'beet_sugar_refining' },
    { era: 2, o1: 'baking_powder',       o2: 'baking_powder' },
    { era: 3, o1: 'fat_hydrogenation', o2: 'fat_hydrogenation' },
    { era: 4, o1: 'dough_rollers',       o2: 'dough_rollers',        x: ['conveyors'] },
  ],
  textile: [
    { era: 0, o1: 'manufacturies',       o2: 'ready_made_clothing' },
    { era: 1, o1: 'calico_printing',     o2: 'calico_printing' },
    { era: 2, o1: 'mechanized_workshops',o2: 'sewing_machine_works',  x: ['mechanical_tools'] },
    { era: 3, o1: 'electrical_capacitors', o2: 'electric_drive_looms', x: ['electrical_generation'] },
    { era: 4, o1: 'long_draft_spinning', o2: 'long_draft_spinning' },
  ],
  furniture: [
    { era: 0, o1: 'manufacturies',       o2: 'manufactory_joinery' },
    { era: 1, o1: 'lathe',               o2: 'lathe' },
    { era: 2, o1: 'mechanized_workshops',o2: 'bentwood_furniture' },
    { era: 3, o1: 'rotary_veneer', o2: 'rotary_veneer' },
    { era: 4, o1: 'nitrocellulose_lacquer', o2: 'nitrocellulose_lacquer', x: ['art_silk'] },
  ],
  glass: [
    { era: 0, o1: 'manufacturies',       o2: 'coal_fired_glasshouse' },
    { era: 1, o1: 'crystal_glass',       o2: 'crystal_glass' },
    { era: 2, o1: 'regenerative_furnace',o2: 'regenerative_furnace' },
    { era: 3, o1: 'plastics',            o2: 'plastics' },
    { era: 4, o1: 'ribbon_machine',      o2: 'ribbon_machine',        x: ['automatic_bottle_blowers'] },
    { era: 5, o1: 'glass_fibre', o2: 'glass_fibre' },
  ],
  tooling: [
    { era: 0, o1: 'manufacturies',       o2: 'toolmakers_workshops' },
    { era: 1, o1: 'steelworking',        o2: 'pig_iron_tooling' },
    { era: 2, o1: 'steel_toolmaking',    o2: 'steel_toolmaking',      x: ['bessemer_process'] },
    { era: 3, o1: 'high_speed_steel',    o2: 'high_speed_steel' },
    { era: 4, o1: 'cemented_carbide',    o2: 'cemented_carbide',      x: ['electric_arc_process'] },
    { era: 5, o1: 'tracer_control', o2: 'tracer_control' },
  ],
  paper: [
    { era: 0, o1: 'manufacturies',       o2: 'pulp_pressing_mills' },
    { era: 1, o1: 'fourdrinier_machine', o2: 'fourdrinier_machine' },
    { era: 2, o1: 'chemical_bleaching',  o2: 'sulfite_pulping' },
    { era: 3, o1: 'kraft_process',       o2: 'kraft_process' },
    { era: 4, o1: 'semi_chemical_pulping', o2: 'semi_chemical_pulping' },
    { era: 5, o1: 'high_speed_papermaking', o2: 'high_speed_papermaking' },
  ],
  fertilizer: [
    { era: 1, o1: 'intensive_agriculture', o2: 'superphosphate' },
    { era: 2, o1: 'ammoniacal_liquor', o2: 'ammoniacal_liquor' },
    { era: 3, o1: 'improved_fertilizer', o2: 'improved_fertilizer' },
    { era: 4, o1: 'nitrogen_fixation',   o2: 'nitrogen_fixation' },
    { era: 5, o1: 'steam_reforming',     o2: 'steam_reforming' },
  ],
  explosives: [
    { era: 1, o1: 'leblanc_process',     o2: 'leblanc_process' },
    { era: 2, o1: 'dynamite',            o2: 'dynamite' },
    { era: 3, o1: 'ostwald_process',     o2: 'ostwald_process' },
    { era: 4, o1: 'continuous_nitration',o2: 'continuous_nitration' },
    { era: 5, o1: 'cyclonite_process', o2: 'cyclonite_process' },
  ],
  steel: [
    { era: 0, o1: 'steelworking',        o2: 'steelworking' },
    { era: 2, o1: 'bessemer_process',    o2: 'bessemer_process' },
    { era: 3, o1: 'open_hearth_process', o2: 'open_hearth_process' },
    { era: 4, o1: 'electric_arc_process',o2: 'electric_arc_process' },
    { era: 5, o1: 'continuous_strip_mill', o2: 'continuous_strip_mill' },
  ],
  motor: [
    { era: 1, o1: 'atmospheric_engine',  o2: 'atmospheric_engine' },
    { era: 2, o1: 'compound_engines', o2: 'compound_engines' },
    { era: 3, o1: 'electric_motors',     o2: 'electric_motors',       x: ['electrical_generation'] },
    { era: 4, o1: 'diesel_engine',       o2: 'diesel_engine',         x: ['combustion_engine'] },
    { era: 5, o1: 'high_speed_diesel',   o2: 'high_speed_diesel' },
  ],
  automotive: [
    { era: 3, o1: 'combustion_engine',   o2: 'combustion_engine' },
    { era: 4, o1: 'conveyors',           o2: 'conveyors' },
    { era: 5, o1: 'transfer_machining',  o2: 'transfer_machining',    x: ['high_speed_steel'] },
  ],
  synthetics: [
    { era: 2, o1: 'aniline',             o2: 'aniline' },
    { era: 3, o1: 'synthetic_indigo',    o2: 'synthetic_indigo' },
    { era: 4, o1: 'art_silk',            o2: 'art_silk' },
    { era: 5, o1: 'polyamide_synthesis', o2: 'polyamide_synthesis',   x: ['nitrogen_fixation'] },
  ],
  electrics: [
    { era: 2, o1: 'telephone',           o2: 'telephone' },
    { era: 3, o1: 'wireless_telegraphy', o2: 'wireless_telegraphy' },
    { era: 4, o1: 'radio',               o2: 'radio' },
    { era: 5, o1: 'vacuum_tube_electronics', o2: 'vacuum_tube_electronics' },
  ],
  power: [
    { era: 3, o1: 'steam_turbine',       o2: 'steam_turbine' },
    { era: 4, o1: 'pulverized_coal_firing', o2: 'pulverized_coal_firing' },
    { era: 5, o1: 'oil_turbine',         o2: 'oil_turbine' },
  ],
  railway: [
    { era: 1, o1: 'railways',            o2: 'railways' },
    { era: 2, o1: 'steel_railway_cars',  o2: 'steel_railway_cars' },
    { era: 3, o1: 'electric_railway',    o2: 'electric_railway' },
    { era: 4, o1: 'superheated_steam', o2: 'superheated_steam' },
    { era: 5, o1: 'compression_ignition',o2: 'compression_ignition' },
  ],
  port: [
    { era: 0, o1: null,                  o2: null },
    { era: 1, o1: 'steamship_bunkering', o2: 'steamship_bunkering' },
    { era: 2, o1: 'deep_water_docks',    o2: 'deep_water_docks' },
    { era: 3, o1: 'concrete_quays',      o2: 'concrete_quays',        x: ['gantry_cranes'] },
    { era: 4, o1: 'mechanised_cargo_handling', o2: 'mechanised_cargo_handling', x: ['concrete_dockyards'] },
  ],
  arms: [
    { era: 0, o1: 'gunsmithing',         o2: 'gunsmith_workshops' },
    { era: 1, o1: 'rifling',             o2: 'rifling' },
    { era: 2, o1: 'repeaters',           o2: 'repeaters' },
    { era: 3, o1: 'bolt_action_rifles',  o2: 'bolt_action_rifles' },
    { era: 4, o1: 'light_machine_guns', o2: 'light_machine_guns' },
    { era: 5, o1: 'stamped_receivers',   o2: 'stamped_receivers' },
  ],
  artillery: [
    { era: 0, o1: 'artillery',           o2: 'bronze_gun_founding' },
    { era: 1, o1: 'shell_gun',           o2: 'shell_gun' },
    { era: 2, o1: 'breech_loading_artillery', o2: 'breech_loading_artillery' },
    { era: 3, o1: 'recoil_carriages',    o2: 'recoil_carriages' },
    { era: 4, o1: 'autofrettage',        o2: 'autofrettage' },
    { era: 5, o1: 'automatic_aa_guns', o2: 'automatic_aa_guns' },
  ],
  munition: [
    { era: 1, o1: 'percussion_cap',      o2: 'percussion_cap' },
    { era: 2, o1: 'explosive_shells',    o2: 'explosive_shells' },
    { era: 3, o1: 'drawn_brass_cartridges', o2: 'drawn_brass_cartridges' },
    { era: 4, o1: 'shell_filling', o2: 'shell_filling' },
    { era: 5, o1: 'automatic_cartridge_lines', o2: 'automatic_cartridge_lines' },
  ],
  shipyard: [
    { era: 0, o1: 'navigation',          o2: 'navigation' },
    { era: 1, o1: 'screw_frigate',       o2: 'screw_frigate' },
  ],
  shipyard_steam: [
    { era: 1, o1: 'iron_screw_steamers', o2: 'iron_screw_steamers' },
    { era: 2, o1: 'steel_hulls', o2: 'steel_hulls' },
    { era: 3, o1: 'marine_steam_turbine',o2: 'marine_steam_turbine' },
    { era: 4, o1: 'oil_fired_boilers',   o2: 'oil_fired_boilers' },
    { era: 5, o1: 'arc_welding',         o2: 'arc_welding' },
  ],
  art_academy: [
    { era: 1, o1: 'romanticism',         o2: 'romanticism' },
    { era: 2, o1: 'realism',             o2: 'realism' },
    { era: 3, o1: 'camera',              o2: 'camera' },
    { era: 4, o1: 'film',                o2: 'film' },
    { era: 5, o1: 'sound_film',          o2: 'sound_film' },
  ],
};

// Prerequisites for the NEW techs, in OPTION 1 (which has no per-industry ladder to inherit from, so
// every link is stated). In options 2 and 3 a tier tech inherits "the rung below me in my own
// industry" automatically and these are used only for the techs that have no rung below.
const O1_PREREQ = {
  // the re-band's fifteen, each rooted on the rung below it IN ITS OWN TREE (shared decision 3)
  fat_hydrogenation: ["baking_powder"],
  long_draft_spinning: ["electrical_capacitors"],
  rotary_veneer: ["mechanized_workshops"],
  glass_fibre: ["ribbon_machine"],
  tracer_control: ["cemented_carbide"],
  semi_chemical_pulping: ["kraft_process"],
  ammoniacal_liquor: ["intensive_agriculture"],
  cyclonite_process: ["continuous_nitration"],
  compound_engines: ["atmospheric_engine"],
  steel_hulls: ["iron_screw_steamers"],
  light_machine_guns: ["bolt_action_rifles"],
  automatic_aa_guns: ["autofrettage"],
  shell_filling: ["drawn_brass_cartridges"],
  wireless_telegraphy: ["telephone"],
  superheated_steam: ["electric_railway"],
  beet_sugar_refining: ['manufacturies', 'distillation'],
  calico_printing: ['manufacturies'],
  fourdrinier_machine: ['manufacturies', 'lathe'],
  leblanc_process: ['manufacturies', 'shaft_mining'],
  steamship_bunkering: ['paddle_steamer'],
  regenerative_furnace: ['crystal_glass', 'bessemer_process'],
  steel_toolmaking: ['mechanical_tools', 'bessemer_process'],
  deep_water_docks: ['steamship_bunkering', 'hydraulic_cranes'],
  kraft_process: ['chemical_bleaching', 'nitroglycerin'],
  high_speed_steel: ['steel_toolmaking', 'open_hearth_process'],
  ostwald_process: ['dynamite', 'improved_fertilizer'],
  electric_motors: ['electrical_generation'],
  diesel_engine: ['combustion_engine'],
  synthetic_indigo: ['aniline', 'chemical_bleaching'],
  concrete_quays: ['deep_water_docks', 'gantry_cranes'],
  nitrocellulose_lacquer: ['art_silk', 'plastics'],
  ribbon_machine: ['automatic_bottle_blowers', 'electrical_capacitors'],
  cemented_carbide: ['high_speed_steel', 'electric_arc_process'],
  high_speed_papermaking: ['kraft_process', 'conveyors'],
  steam_reforming: ['nitrogen_fixation'],
  continuous_nitration: ['ostwald_process', 'conveyors'],
  continuous_strip_mill: ['electric_arc_process', 'conveyors'],
  high_speed_diesel: ['diesel_engine', 'arc_welding'],
  transfer_machining: ['conveyors', 'high_speed_steel'],
  polyamide_synthesis: ['art_silk', 'nitrogen_fixation'],
  vacuum_tube_electronics: ['radio'],
  pulverized_coal_firing: ['steam_turbine', 'conveyors'],
  mechanised_cargo_handling: ['concrete_quays', 'concrete_dockyards'],
  // military
  iron_screw_steamers: ['paddle_steamer'],
  explosive_shells: ['percussion_cap', 'shell_gun'],
  marine_steam_turbine: ['iron_screw_steamers', 'ironclad_tech'],
  drawn_brass_cartridges: ['explosive_shells', 'rifling'],
  recoil_carriages: ['breech_loading_artillery'],
  oil_fired_boilers: ['marine_steam_turbine'],
  autofrettage: ['recoil_carriages'],
  stamped_receivers: ['bolt_action_rifles'],
  automatic_cartridge_lines: ['drawn_brass_cartridges'],
  // splits (options 2/3 only, but stated here so the table is one thing)
  bakehouse_manufactories: ['manufacturies'],
  ready_made_clothing: ['manufacturies'],
  manufactory_joinery: ['manufacturies'],
  coal_fired_glasshouse: ['manufacturies'],
  toolmakers_workshops: ['manufacturies'],
  pulp_pressing_mills: ['manufacturies'],
  sewing_machine_works: ['mechanized_workshops'],
  bentwood_furniture: ['mechanized_workshops'],
  electric_drive_looms: ['electrical_capacitors'],
  superphosphate: ['intensive_agriculture'],
  pig_iron_tooling: ['steelworking'],
  sulfite_pulping: ['chemical_bleaching'],
  gunsmith_workshops: ['gunsmithing'],
  bronze_gun_founding: ['artillery'],
  // society
  sound_film: ['film'],
  // platforms (option 3 only)
  interchangeable_parts: ['manufacturies'],
  precision_measurement: ['mechanical_tools', 'interchangeable_parts'],
  scientific_management: ['precision_measurement', 'shift_work'],
  light_alloys: ['alloy_steels', 'electric_drive'],
  high_pressure_steam: ['atmospheric_engine'],
  electric_drive: ['electrical_generation', 'high_pressure_steam'],
  process_control: ['scientific_management', 'electrical_capacitors'],
  mineral_acids: ['manufacturies'],
  industrial_catalysis: ['mineral_acids', 'improved_fertilizer'],
  alloy_steels: ['open_hearth_process'],
};

// OPTION 3's platform layer. Each industry belongs to ONE domain; a rung requires the LATEST platform
// of that domain whose era is <= its own. A domain may have gaps, and an early rung may need nothing.
// ⚠ Platforms are production-category, so they are applied ONLY to production-tree rungs — a military
// technology must not depend on a production one, or the tech screen draws an edge to another tab.
const PLATFORM_DOMAIN = {
  food: 'MECH', textile: 'MECH', furniture: 'MECH', automotive: 'MECH', motor: 'MECH',
  power: 'POWER', railway: 'POWER', port: 'POWER', glass: 'POWER', electrics: 'POWER',
  fertilizer: 'CHEM', explosives: 'CHEM', synthetics: 'CHEM', paper: 'CHEM',
  steel: 'MAT', tooling: 'MAT',
};
// A handful of rungs are better explained by a platform outside their industry's domain.
const PLATFORM_OVERRIDE = {
  transfer_machining: 'scientific_management',      // the machine shop catching up with the line
  conveyors: 'scientific_management',
  mechanised_cargo_handling: 'scientific_management',
  continuous_strip_mill: 'process_control',
  high_speed_steel: 'alloy_steels',
};

// ===================================================================================================
// 5. BUILD THE THREE OPTIONS
// ===================================================================================================
// Fail at authoring time, loudly, on any modifier the game does not define. Placed here rather than
// beside MOD_TYPES because `NEW` is declared further down and a const is not hoisted.
{
  const bad = [];
  for (const [id, n] of Object.entries(NEW))
    for (const m of Object.keys(n.mod ?? {})) if (!MOD_TYPES.has(m)) bad.push(`${id}: ${m}`);
  if (bad.length) throw new Error(`unknown modifier type(s) — the game defines no such modifier, so it ` +
    `would silently do nothing, leaving an EMPTY technology:\n  ` + bad.join('\n  '));
}

const OPTION_META = [
  // ⭐ OPTION 1 SHIPS (user ruling, 2026-08-10 — "I'm really unsure. Let's go with vanilla-shaped").
  // The other two stay in the file and the viewer: the ruling was made without confidence, and the
  // alternatives cost nothing to keep and would cost a week to re-derive.
  { id: 'o1', n: 1, ships: true, label: 'Vanilla-Shaped',
    tagline: 'A technology is an invention, and an invention lifts several industries at once.',
    blurb: 'Keeps vanilla\'s topology and its shared technologies — `manufacturies` still unlocks six industries\' first rung — and extends it only where our ladder has rungs vanilla never had. Smallest tree, cheapest research, most familiar to a returning player. Its cost is paid at roadmap step 2: a shared technology cannot be rewarded to one industry.' },
  { id: 'o2', n: 2, label: 'Industry Ladders',
    tagline: 'A technology is a step in one industry\'s history.',
    blurb: 'One dedicated technology per tier: 22 near-independent verticals, with cross-links only where a recipe literally cannot exist without another industry\'s product. Maximum per-industry targeting, which is what the industry-driven research events need; reads like an industry\'s own story. Weakest at making a technological lead in one sector lift the others.' },
  { id: 'o3', n: 3, label: 'Platform & Application',
    tagline: 'A technology is either a general-purpose capability or its application to one industry.',
    blurb: 'Option 2\'s ladders plus a backbone of nine platform technologies, each tier technology also requiring the platform of its generation. The strongest realisation of "a technological edge should really matter": neglect steel, precision or electricity and every industry stalls at once. Biggest and densest tree, and the one that leans hardest on the ahead-of-time penalty.' },
];

function buildOption(optN) {
  const key = 'o' + (optN === 3 ? 2 : optN);   // option 3 reuses option 2's tech ids
  const techs = new Map();

  const ensure = id => {
    if (techs.has(id)) return techs.get(id);
    const n = NEW[id], v = VAN[id];
    if (!n && !v) throw new Error(`unknown technology '${id}'`);
    const t = {
      id,
      // ⚠ `artillery` is the one vanilla technology with NO entry in inventions_l_english.yml — it
      // shares its key with the GOOD of the same name in goods_l_english.yml. Hence the title-case
      // fallback rather than a lookup that silently yields a script id.
      name: RENAME[id]?.[0] ?? n?.name ?? VAN_LOC[id] ??
            id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      vanillaName: VAN_LOC[id] ?? null,
      renamed: RENAME[id]?.[1] ?? null,
      desc: n?.desc ?? null,
      category: n?.cat ?? v?.category ?? 'production',
      era: n ? (n.era ?? gameEra(n.year)) : v.era,
      year: n?.year ?? null,
      onset: n?.year ?? ONSET[id] ?? null,      // NARRATIVE ONSET — see the table
      idea: IDEA_TECH.has(id),                  // dated by first articulation, gated by mainstreaming
      mod: n?.mod ?? null,                      // the modifier block, for a tech whose content IS one
      origin: n ? 'new' : 'vanilla',
      filler: !!n?.filler,
      platform: n?.platform ?? null,      // the domain string (MECH/POWER/CHEM/MAT), or null
      industry: n?.ind ?? null,
      prereqs: new Set(),
      unlocks: [],                                  // our tier buildings
      vanillaUnlocks: VAN_UNLOCKS[id] ?? [],        // vanilla buildings
    };
    if (t.origin === 'vanilla') for (const p of v.prereqs) t.prereqs.add(p);
    // Deliberate re-eras (shared decision 5). Moving a technology earlier can strand it behind a
    // prerequisite that did not move, so each re-era restates the prerequisites it needs.
    if (id === 'aniline') {
      t.era = 2; t.reEra = 'era 3 -> 2: Perkin\'s mauveine is 1856';
      // vanilla requires rubber_mastication (era 3), which has nothing to do with coal-tar dyes and
      // would now sit AFTER its own dependent.
      t.prereqs = new Set(['chemical_bleaching']);
    }
    if (id === 'telephone') { t.era = 3; t.reEra = 'era 4 -> 3: Bell 1876, first exchange 1878'; }
    // ⭐ USER RULING 2026-08-11 — the two worst datings in the whole tree move to era 1, where their own
    // dates put them. Both keep prerequisites that are already era 1, so neither creates an inversion.
    // ⚠ Almost free in practice: vanilla already hands `atmospheric_engine` to the tier-1 and tier-2
    // starting countries by name, and era 1 is granted to them wholesale — so this changes nothing for
    // the powers and makes it cheaper for everyone else, which is the direction we want.
    if (id === 'atmospheric_engine') { t.era = 1; t.reEra = 'era 2 -> 1: Newcomen 1712, 124 years before era 2 opens'; }
    if (id === 'crystal_glass')      { t.era = 1; t.reEra = 'era 2 -> 1: Ravenscroft 1674, 162 years before era 2 opens'; }
    techs.set(id, t);
    return t;
  };

  // Every vanilla technology stays in the tree (shared decision 4).
  for (const v of Object.values(VAN)) ensure(v.id);

  // Ladders.
  for (const [ind, rungs] of Object.entries(LADDER)) {
    let prevId = null;
    for (const r of rungs) {
      const id = r[key] ?? null;
      const t = tier(ind, r.era);
      if (!t) throw new Error(`${ind}: config has no era-${r.era} tier`);
      if (!id) { prevId = null; continue; }         // era-0 rung: no technology at all
      const tech = ensure(id);
      tech.industry ||= ind;
      tech.unlocks.push({ key: t.key, name: t.name, era: t.era, year: t.year, ind });
      if (optN === 1) {
        for (const p of (O1_PREREQ[id] ?? [])) if (NEW[id]) tech.prereqs.add(p);
      } else {
        // Ladder link first — but it YIELDS to the same-tree constraint. The steam shipyard's top rung
        // is vanilla's `arc_welding`, a PRODUCTION technology, while the rung below it is military; the
        // convenience of chaining an industry's ladder does not license an edge the engine has never
        // been asked to draw.
        if (prevId && techs.get(prevId).category === tech.category) tech.prereqs.add(prevId);
        else for (const p of (O1_PREREQ[id] ?? [])) if (NEW[id]) tech.prereqs.add(p);
        // …then the sparse, deliberate cross-links…
        for (const p of (r.x ?? [])) tech.prereqs.add(p);
        // …then, in option 3 only, the domain platform contemporary with this rung.
        if (optN === 3 && tech.category === 'production') {
          const dom = PLATFORM_DOMAIN[ind];
          const plat = PLATFORM_OVERRIDE[id] ?? (dom
            ? Object.entries(NEW).filter(([, n]) => n.platform === dom && gameEra(n.year) <= tech.era)
                .sort((a, b) => b[1].year - a[1].year)[0]?.[0]
            : null);
          if (plat && plat !== id) { ensure(plat); tech.prereqs.add(plat); }
        }
      }
      prevId = id;
    }
  }

  // Techs that exist only in this option (splits in 2/3, platforms in 3) still need their own prereqs.
  for (const [id, n] of Object.entries(NEW)) {
    if (!n.in.includes(String(optN))) { techs.delete(id); continue; }
    const t = ensure(id);
    if (t.prereqs.size === 0) for (const p of (O1_PREREQ[id] ?? [])) t.prereqs.add(p);
    if (optN === 3 && n.platform) {
      // platforms chain off each other where stated, nothing more
    }
  }
  // Drop techs belonging to other options entirely.
  for (const [id, t] of [...techs]) {
    const n = NEW[id];
    if (n && !n.in.includes(String(optN))) techs.delete(id);
  }
  // Prune dangling prereqs (a split that does not exist in this option).
  for (const t of techs.values()) t.prereqs = new Set([...t.prereqs].filter(p => techs.has(p) && p !== t.id));

  // ---- THE TWO STRUCTURAL CONSTRAINTS (user-ruled 2026-08-10) ----------------------------------
  const problems = [];
  //  1. No technology may require a LATER-era prerequisite. The engine's cost arithmetic assumes it,
  //     and it is also just false as history.
  for (const t of techs.values())
    for (const p of t.prereqs)
      if (techs.get(p).era > t.era)
        problems.push(`ERA INVERSION: ${t.id} (era ${t.era}) requires ${p} (era ${techs.get(p).era})`);
  //  2. Every technology of era 2 and above must have at least one prerequisite — nothing may float
  //     free in the middle of the tree. Only era 1 may be a root.
  for (const t of techs.values())
    if (t.era >= 2 && t.prereqs.size === 0)
      problems.push(`ROOTLESS: ${t.id} (era ${t.era}, ${t.category}) has no prerequisite`);
  //  3. A PREREQUISITE MUST BE IN THE SAME TREE. Measured, not assumed: vanilla has **zero**
  //     cross-category prerequisites across all 179 of its technologies, so a technology that reaches
  //     into another tab is something the engine has never been asked to draw. This is the constraint
  //     that decides which industries may be SHIFTED between trees — a shifted ladder has to be
  //     re-rooted on technologies of its new tree, and an industry with no plausible re-rooting simply
  //     cannot move. (It is why ports moved and electrics did not: a telephone works cannot stop
  //     requiring electrical generation just to sit in the society tab.)
  for (const t of techs.values())
    for (const p of t.prereqs)
      if (techs.get(p).category !== t.category)
        problems.push(`CROSS-TREE: ${t.category}:${t.id} requires ${techs.get(p).category}:${p}`);
  //  4. NO EMPTY TECHNOLOGIES (user-ruled 2026-08-11). One we ADD must unlock something or carry a
  //     modifier; a technology that costs innovation and does nothing is not content, it is a toll.
  //     ⚠ Scoped to OUR technologies on purpose. Vanilla ships several genuinely empty ones —
  //     `screw_frigate`, `monitor_tech` and `admiralty` have modifier blocks holding only comments —
  //     and repairing those is a different decision from not committing the fault ourselves.
  for (const t of techs.values())
    if (t.origin === 'new' && !t.unlocks.length && !t.vanillaUnlocks.length && !t.mod)
      problems.push(`EMPTY: ${t.id} (era ${t.era}, ${t.category}) unlocks nothing and has no modifier`);

  // Reverse edges.
  for (const t of techs.values()) t.blocks = [];
  for (const t of techs.values()) for (const p of t.prereqs) techs.get(p).blocks.push(t.id);

  return { techs, problems };
}

// ===================================================================================================
// 6. EMIT + REPORT
// ===================================================================================================
const out = { generated: new Date().toISOString(), eraCost: ERA_COST, indOrder: IND_ORDER, indLabel: IND_LABEL,
              vanilla: null,      // filled below, from the parse — the viewer must not carry its own copy
              options: [] };

const uncovered = [];
for (const meta of OPTION_META) {
  const { techs, problems } = buildOption(meta.n);
  const list = [...techs.values()].map(t => ({ ...t, prereqs: [...t.prereqs] }))
                                  .sort((a, b) => a.era - b.era || a.id.localeCompare(b.id));
  // budget
  const budget = {};
  for (const cat of ['production', 'military', 'society']) {
    const inCat = list.filter(t => t.category === cat);
    budget[cat] = { n: inCat.length, cost: inCat.reduce((s, t) => s + ERA_COST[t.era], 0),
                    perEra: [1, 2, 3, 4, 5].map(e => inCat.filter(t => t.era === e).length) };
  }
  out.options.push({ ...meta, budget, problems, techs: list });
}

// Coverage: every tier must be either era-0/untech'd or attached to a technology in every option.
for (const t of TIERS) {
  const rung = (LADDER[t.ind] ?? []).find(r => r.era === t.era);
  if (!rung) uncovered.push(`${t.ind} era ${t.era} (${t.key})`);
}

console.log('=== INDUSTRY TECH TREE — three options ===\n');
console.log(`tiers in config: ${TIERS.length}  (model_only today: ${TIERS.filter(t => t.modelOnly).length})`);
console.log(`tiers with no ladder entry: ${uncovered.length}${uncovered.length ? '  !! ' + uncovered.join(', ') : ''}\n`);

// ⚠ VANILLA'S OWN FIGURES ARE COMPUTED FROM THE PARSED TREE, never transcribed. An earlier version of
// this report carried a hand-typed "vanilla 285k" for the rush cost; the real number is 542k, and the
// wrong one made every option look roughly twice as punishing as it is.
const vanPerEra = cat => [1, 2, 3, 4, 5].map(e =>
  Object.values(VAN).filter(t => t.category === cat && t.era === e).length);
const vanCost = Object.fromEntries(['production', 'military', 'society'].map(cat =>
  [cat, vanPerEra(cat).reduce((s, n, i) => s + n * ERA_COST[i + 1], 0)]));

// THE AHEAD-OF-TIME PENALTY, and the one number that decides how much a deep tree really costs.
//   cost(era N) = eraCost(N) x [ 1 + F x SUM over earlier eras e of (unresearched techs in e) x (N - e) ]
// F is `NTechnology.TECH_AHEAD_OF_TIME_PENALTY_FACTOR`, 0.25 in vanilla. It is one of the few defines a
// mod may override WITHOUT owning the whole file (see MODDING_NOTES), so it is a live design knob.
// `--aot=0.15` sweeps it.
const AOT_VANILLA = 0.25;
const AOT = (() => { const a = process.argv.find(x => x.startsWith('--aot=')); return a ? +a.split('=')[1] : AOT_VANILLA; })();
// Worst case: one era-N technology with EVERY earlier-era technology of its category still unresearched.
const rushCost = (perEra, era, F) =>
  ERA_COST[era] * (1 + F * perEra.slice(0, era - 1).reduce((s, n, i) => s + n * (era - (i + 1)), 0));

out.vanilla = {
  aot: AOT_VANILLA,
  perEra: Object.fromEntries(['production', 'military', 'society'].map(c => [c, vanPerEra(c)])),
  n: Object.fromEntries(['production', 'military', 'society'].map(c =>
    [c, Object.values(VAN).filter(t => t.category === c).length])),
  cost: vanCost,
  rush5: rushCost(vanPerEra('production'), 5, AOT_VANILLA),
};

for (const o of out.options) {
  console.log(`--- Option ${o.n}: ${o.label} ---`);
  for (const cat of ['production', 'military', 'society']) {
    const b = o.budget[cat];
    const dv = ((b.cost / vanCost[cat] - 1) * 100).toFixed(0);
    console.log(`  ${cat.padEnd(11)} ${String(b.n).padStart(3)} techs  per-era ${b.perEra.join('/')}  ` +
                `budget ${(b.cost / 1000).toFixed(0)}k  (vanilla ${(vanCost[cat] / 1000).toFixed(0)}k, ${dv >= 0 ? '+' : ''}${dv}%)`);
  }
  const tot = Object.values(o.budget).reduce((s, b) => s + b.cost, 0);
  console.log(`  TOTAL      ${(tot / 1000).toFixed(0)}k innovation  (vanilla 2158k, ` +
              `${((tot / 2157500 - 1) * 100).toFixed(0)}%)`);
  const newN = o.techs.filter(t => t.origin === 'new').length;
  console.log(`  new technologies: ${newN}`);
  // The ahead-of-time penalty is what a DEEP tree actually costs, and it is superlinear in tree size.
  const pe = o.budget.production.perEra, vpe = vanPerEra('production');
  o.rushCost = rushCost(pe, 5, AOT);
  o.rushCostVanillaAot = rushCost(pe, 5, AOT_VANILLA);
  o.rushCostByAot = Object.fromEntries([0.25, 0.20, 0.15, 0.125, 0.10].map(f => [f, rushCost(pe, 5, f)]));
  console.log(`  worst-case era-5 production tech (nothing below it researched), F=${AOT}: ` +
              `${(o.rushCost / 1000).toFixed(0)}k  ` +
              `(vanilla tree at F=${AOT_VANILLA}: ${(rushCost(vpe, 5, AOT_VANILLA) / 1000).toFixed(0)}k)`);
  if (o.problems.length) console.log(`  !! era violations:\n     ` + o.problems.join('\n     '));
  console.log();
}

// ---------------------------------------------------------------------------------------------------
// THE AHEAD-OF-TIME SWEEP. Two questions at once:
//   (a) what F holds our deeper tree at vanilla's own worst-case cost, and
//   (b) under the ruling that the industry-research channel must COVER an era-5 technology completely at
//       the reduced penalty, how big a grant is that? — it is the same number, so this table sizes the
//       step-2 reward directly.
{
  const vpe = vanPerEra('production');
  const vanRush = rushCost(vpe, 5, AOT_VANILLA);
  console.log(`=== AHEAD-OF-TIME PENALTY SWEEP ===`);
  console.log(`vanilla production tree (${vpe.join('/')}) at F=0.25: worst-case era-5 tech = ` +
              `${vanRush.toLocaleString()}\n`);
  console.log(`  F     ` + out.options.map(o => `opt${o.n} era-5 worst`.padStart(18)).join('') +
              `     <- also the grant that "covers it completely"`);
  for (const f of [0.25, 0.20, 0.15, 0.125, 0.10, 0.05, 0]) {
    console.log(`  ${f.toFixed(3)} ` + out.options.map(o => {
      const c = rushCost(o.budget.production.perEra, 5, f);
      return `${c.toLocaleString()} (${(c / vanRush).toFixed(2)}x)`.padStart(18);
    }).join(''));
  }
  console.log(`\n  F that holds each option AT vanilla's worst case:  ` + out.options.map(o => {
    const S = o.budget.production.perEra.slice(0, 4).reduce((s, n, i) => s + n * (5 - (i + 1)), 0);
    return `opt${o.n} ${((vanRush / ERA_COST[5] - 1) / S).toFixed(3)}`;
  }).join('   '));
  // A grant only means something against what a country can generate. The innovation CAP is
  // 50 + 1.5 x literacy, so 200/week at full literacy before institutions and companies.
  console.log(`  for scale: a fully literate country generates ~200 innovation/week, so ` +
              `${(rushCost(out.options[2].budget.production.perEra, 5, 0.15) / 200 / 52).toFixed(1)} years ` +
              `of its ENTIRE research output equals one opt-3 era-5 tech at F=0.15\n`);
}

// ---------------------------------------------------------------------------------------------------
// TECH SPREAD. The three constants are static modifiers, not defines — see MODDING_NOTES. What matters
// for the tree is the SHARE of a tree that spread alone hands a laggard over the campaign, because that
// is the part of "runners-up should have less advanced industry" that spread can undo.
//   weekly spread = (FLAT + LIT x literacy + 0.2 x unspent) x (1 + Σ mult) x rand(0.5, 1.5)
// rand averages 1, so expectation is the bracket. 1836-1936 is 5 218 weeks.
{
  const WEEKS = 5218, LIT = 0.5, CATS = ['production', 'military', 'society'];
  const ourCost = Object.fromEntries(CATS.map(c =>
    [c, (out.options.find(o => o.ships) ?? out.options[0]).budget[c].cost]));
  // A row is (flat, lit, per-category multiplier, which cost book).
  const arms = [
    ['vanilla spread, vanilla trees',      25,  75, {},                    vanCost],
    ['vanilla spread, our trees',          25,  75, {},                    ourCost],
    ['global 50/100, our trees',           50, 100, {},                    ourCost],
    ['production-only +50%, our trees',    25,  75, { production: 0.5 },   ourCost],
  ];
  const base = {};   // vanilla's own share, per tree — the bar every other arm is judged against
  console.log('=== TECH SPREAD: how much of a tree a laggard is handed for free ===');
  console.log(`at ${LIT * 100}% literacy, no unspent innovation, over 1836-1936. ` +
              `Spread only ever delivers what someone else already has, so this is the share of the gap it closes.\n`);
  console.log('  arm                                production        military         society');
  for (const [label, flat, lit, mult, cost] of arms) {
    const wk = flat + lit * LIT;
    const cells = CATS.map(c => {
      const pct = 100 * wk * (1 + (mult[c] ?? 0)) * WEEKS / cost[c];
      if (!Object.keys(base).length || base[c] === undefined) base[c] = pct;
      const d = pct - base[c];
      return `${pct.toFixed(0)}%${label.startsWith('vanilla spread, vanilla') ? '' : ` (${d >= 0 ? '+' : ''}${d.toFixed(0)}pp)`}`.padStart(16);
    });
    console.log(`  ${label.padEnd(34)}${cells.join(' ')}`);
  }
  console.log(`\n  ⇒ A GLOBAL boost cannot be right once the filler technologies are gone: it overshoots`);
  console.log(`    society badly, because society gained one technology and production gained 24.`);
  console.log(`    ⇒ \`country_production_tech_spread_mult\` is PER CATEGORY. Boosting production alone`);
  console.log(`    puts all three trees within a few points of vanilla's own catch-up rate, changes no`);
  console.log(`    vanilla constant, and needs no technology invented to absorb it.\n`);
}

// ---------------------------------------------------------------------------------------------------
// NARRATIVE ONSET vs ERA. Two ways a technology can be absurd, and they are not symmetrical:
//   ANACHRONISTIC — you can research it before the thing existed. The worse fault.
//   LATE-GATED    — the thing existed long before you may research it. Tolerable up to LATE_GRACE,
//                   because research is not invention and adoption lags.
{
  const shipped = out.options.find(o => o.ships) ?? out.options[0];
  const rows = [];
  for (const t of shipped.techs) {
    if (t.onset == null) { rows.push({ t, kind: 'UNDATED', gap: 0 }); continue; }
    const [lo, hi] = ERA_WINDOW[t.era];
    if (t.onset > hi) rows.push({ t, kind: 'ANACHRONISTIC', gap: t.onset - hi });
    else if (lo != null && t.onset < lo - LATE_GRACE)
      rows.push({ t, kind: IDEA_TECH.has(t.id) ? 'IDEA(late)' : 'LATE-GATED', gap: lo - t.onset });
  }
  rows.sort((a, b) => (a.kind === b.kind ? b.gap - a.gap : a.kind < b.kind ? -1 : 1));
  console.log(`=== NARRATIVE ONSET vs ERA  (option ${shipped.n}, ${shipped.techs.length} technologies) ===`);
  console.log(`dated: ${shipped.techs.filter(t => t.onset != null).length}  ` +
              `conflicts: ${rows.length}  (grace for late gating: ${LATE_GRACE}y)\n`);
  for (const r of rows) {
    console.log(`  ${r.kind.padEnd(14)} ${String(r.gap).padStart(3)}y  ${r.t.category.slice(0, 4)} e${r.t.era} ` +
                `${(r.t.name).padEnd(30)} onset ${r.t.onset}  ` +
                `[era window ${ERA_WINDOW[r.t.era][0] ?? '…'}–${ERA_WINDOW[r.t.era][1]}]` +
                `${r.t.unlocks.length ? '  unlocks ' + r.t.unlocks.map(u => u.name).join(' / ') : ''}`);
  }
  console.log();
}

if (process.argv.includes('--chains')) {
  for (const o of out.options) {
    console.log(`\n=== Option ${o.n}: ${o.label} — ladders ===`);
    const byId = Object.fromEntries(o.techs.map(t => [t.id, t]));
    for (const ind of IND_ORDER) {
      const rungs = LADDER[ind]; if (!rungs) continue;
      console.log(`\n  ${IND_LABEL[ind]}  [${treeOf(ind)}]`);
      for (const r of rungs) {
        const t = tier(ind, r.era);
        const id = r[o.n === 3 ? 'o2' : o.id];
        if (!id) { console.log(`    e${r.era} ${String(t.year).padEnd(5)} ${t.name.padEnd(44)} (no technology)`); continue; }
        const tech = byId[id];
        const extra = tech.prereqs.filter(p => {
          const prevRung = rungs[rungs.indexOf(r) - 1];
          return p !== (prevRung && prevRung[o.n === 3 ? 'o2' : o.id]);
        });
        console.log(`    e${r.era} ${String(t.year).padEnd(5)} ${t.name.padEnd(44)} ${(tech.name ?? id + ' (vanilla)').padEnd(30)}` +
                    ` era${tech.era} ${tech.origin === 'new' ? 'NEW' : '   '}  <- ${extra.join(', ') || '(ladder only)'}`);
      }
    }
  }
}

if (WRITE) {
  const optPath = join(REPO, 'config', 'tech_tree_options' + SFX + '.json');
  writeFileSync(optPath, JSON.stringify(out, null, 1));
  writeFileSync(join(REPO, 'ui', 'techdata' + SFX + '.js'), 'window.TECHDATA = ' + JSON.stringify(out) + ';\n');
  console.log(`wrote ${optPath} and ui/techdata${SFX}.js`);

  // ⭐ CLOSE THE LOOP: stamp each tier's `tech` back into the config the tree was generated from. It is
  // the ROADMAP step-1 deliverable ("every tier's tech field pointing at it") and nothing did it — the
  // covered tiers had been assigned by hand, so a tier added later silently had none and only
  // emit_techs' coverage guard would say so, at build time, after the fact.
  // ⚠ The mapping is the INVERSE of each technology's own `unlocks`, so it cannot drift from the tree.
  // A tier claimed by two technologies is an authoring error and throws rather than being picked between.
  const ship = out.options.find(o => o.ships);
  const byTier = {};
  for (const t of ship.techs) for (const u of (t.unlocks || [])) (byTier[u.key] = byTier[u.key] || []).push(t.id);
  const dup = Object.entries(byTier).filter(([, v]) => v.length > 1);
  if (dup.length) throw new Error('tier(s) unlocked by more than one technology: ' +
    dup.map(([k, v]) => `${k} <- ${v.join(', ')}`).join(' · '));
  const cfgOut = JSON.parse(readFileSync(CFGPATH, 'utf8'));
  let set = 0, cleared = 0, emitted = 0; const bare = [];
  for (const ind of cfgOut.industries) for (const t of (ind.tiers || [])) {
    const got = (byTier[t.key] || [])[0] || null;
    if (got) { if (t.tech !== got) set++; t.tech = got; }
    else { if (t.tech) cleared++; delete t.tech; bare.push(`${ind.id}/${t.key}`); }
    // ⭐ `model_only` MEANS "the game has no technology that could unlock this", and that is exactly the
    // condition this pass resolves. A tier that now has one must stop being model-only, or the builder
    // goes on skipping it and the mod ships the old, shorter ladder while the config describes the new
    // one — the ROADMAP step-1 deliverable is precisely "the model_only flags gone".
    if (got && t.model_only) { t.model_only = false; emitted++; }
  }
  writeFileSync(CFGPATH, JSON.stringify(cfgOut), 'utf8');
  console.log(`stamped tier -> technology into ${CFGPATH}: ${set} changed, ${cleared} cleared, ` +
    `${emitted} tier(s) promoted out of model_only, ` +
    `${bare.length} left with none (available at the 1836 start): ${bare.join(', ') || '-'}`);
} else {
  console.log(`(report only — pass --write to emit config/tech_tree_options${SFX}.json + ui/techdata${SFX}.js)`);
}
