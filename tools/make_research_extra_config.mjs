// в­ђв­ђ THE EXTRA RESEARCH ENTRIES BOOK вЂ” production technologies outside the tier ladder get a journal-entry set of their own
// (user-ruled 2026-10-05; ROADMAP step 2, "COVERAGE AUDIT OF THE PRODUCTION TREE").
//
//   node tools/make_research_extra_config.mjs --base <config> --suffix <suffix>
//
// Writes config/mod_config.<suffix>.json = the base + `research_events.extra_entries` (the table below) + `research_events.era1_rule_a`
// (an era-1 technology gating a rung WITH a predecessor keeps its entry: lathe, distillation, steelworking) + `_research_extra_variant`,
// and the base's tech-tree twin (landmine L20). No other key of the base changes. emit_research_events.mjs applies whatever the config
// says; THIS FILE IS THE ONLY PLACE THE TABLE LIVES.
//
// THE MARKS were calibrated on the 18 complete artmerge century runs (ROADMAP step 2's table, 2026-10-05): the year the SECOND country
// would start the clock lands on the technology's narrative onset decade, and in no more than 10% of runs does any country start it more
// than 20 years early; four were set by the user (watertube boiler 30k, bottle blowers 200k, art silk 25k, radio 25k); onsets before 1836
// are exempt, sized so a Russian, Chinese or Ottoman speed-up is possible. Every mark is a whole number of fully staffed levels of what it
// counts (the user's rounding rule; emit_research_events THROWS otherwise). Dropped by ruling: shift_work (an absolute workforce mark
// rewards playing wide, FINDINGS-level read in ROADMAP step 2) and pumpjacks (no precursor).
// вљ  The runs the marks were read on carry none of these entries; a batch with them built must re-read the marks.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', null), SFX = argOf('--suffix', null);
if (!BASE || !SFX) { console.error('usage: node tools/make_research_extra_config.mjs --base <config> --suffix <suffix>'); process.exit(2); }
const die = m => { throw new Error('make_research_extra_config: ' + m); };

const MINES_STEAM = Object.fromEntries(['coal', 'iron'].map(m => [`building_${m}_mine`, [`pm_atmospheric_engine_pump_building_${m}_mine`, `pm_condensing_engine_pump_building_${m}_mine`, `pm_diesel_pump_building_${m}_mine`]]));
const GRAIN = ['building_wheat_farm', 'building_rye_farm', 'building_maize_farm', 'building_millet_farm'];
const TOOLS = ['pm_tools', 'pm_steam_threshers', 'pm_tractors', 'pm_compression_ignition_tractors'];
const TABLE = {
  cotton_gin: { sources: [{ buildings: ['building_cotton_plantation'] }], mark: 48000 },
  canneries: { sources: [{ industries: ['food'], label: 'the food industry (every rung)' }], mark: 100000 },
  fractional_distillation: { sources: [{ industries: ['food'], label: 'the food industry (every rung)' }], mark: 10000 },
  railways: { sources: [{ buildings: ['building_coal_mine', 'building_iron_mine'], methods: MINES_STEAM, label: 'coal and iron mines on steam pumps' }], mark: 30000 },
  rubber_mastication: { sources: [{ industries: ['textile'], label: 'the textile industry (every rung)' }], mark: 100000 },
  watertube_boiler: { sources: [{ industries: ['motor'], label: 'the motor industry' }], mark: 30000 },
  rotary_valve_engine: { sources: [{ industries: ['motor'], label: 'the motor industry' }], mark: 10000 },
  electrical_generation: { sources: [{ industries: ['motor'], label: 'the motor industry' }], mark: 15000, requires: ['electric_telegraph'] },
  conveyors: { sources: [{ industries: ['motor', 'automotive'], label: 'the motor and automotive industries' }], mark: 180000 },
  reinforced_concrete: { sources: [{ buildings: ['building_construction_sector'], methods: ['pm_iron_frame_buildings', 'pm_steel_frame_buildings', 'pm_arc_welded_buildings'], label: 'construction sectors building iron frames or later' }], mark: 61000 },
  pneumatic_tools: { sources: [{ buildings: ['building_construction_sector'], methods: ['pm_iron_frame_buildings', 'pm_steel_frame_buildings', 'pm_arc_welded_buildings'], label: 'construction sectors building iron frames or later' }], mark: 9000 },
  vacuum_canning: { sources: [{ industries: ['food'], crafts: false, label: 'the food industry (factory rungs)' }], mark: 75000 },
  steel_railway_cars: { sources: [{ buildings: ['building_railway'] }], mark: 56000, requires: ['bessemer_process'] },
  radio: { sources: [{ industries: ['electrics'], label: 'the electrics industry' }], mark: 25000, requires: ['electric_telegraph'] },
  art_silk: { sources: [{ industries: ['synthetics'], label: 'synthetics plants' }], mark: 25000 },
  automatic_bottle_blowers: { sources: [{ industries: ['glass'], crafts: false, label: 'the glass industry (factory rungs)' }], mark: 200000 },
  steam_turbine: { sources: [{ buildings: ['building_power_plant'] }], mark: 13000 },
  steam_donkey: { sources: [{ buildings: ['building_logging_camp'], methods: ['pm_saw_mills', 'pm_electric_saw_mills'], label: 'logging camps with saw mills' }], mark: 10000, requires: ['rotary_valve_engine'] },
  threshing_machine: { sources: [{ buildings: [...GRAIN, 'building_rice_farm'], methods: Object.fromEntries([...GRAIN.map(b => [b, TOOLS]), ['building_rice_farm', ['pm_tools_building_rice_farm', 'pm_steam_threshers_building_rice_farm']]]), label: 'grain farms using tools' }], mark: 100000 },
  mechanized_farming: { sources: [{ buildings: GRAIN, methods: ['pm_steam_threshers'], label: 'grain farms with steam threshers' }], mark: 75000, requires: ['combustion_engine'] },
  pasteurization: { sources: [{ buildings: ['building_livestock_ranch'], methods: ['pm_slaughterhouses', 'pm_mechanized_slaughtering'], label: 'livestock ranches with slaughterhouses' }], mark: 55000 },
  flash_freezing: { sources: [{ buildings: ['building_fishing_wharf', 'building_whaling_station'], methods: { building_fishing_wharf: ['pm_steam_trawlers'], building_whaling_station: ['pm_steam_whaling_ships'] }, label: 'steam trawlers and steam whalers' }], mark: 75000, requires: ['steam_turbine'] },
  dough_rollers: { sources: [{ industries: ['food'], crafts: false, label: 'the food industry (factory rungs)' }], mark: 85000 },
  arc_welding: { sources: [{ buildings: ['building_shipyard'], methods: ['pm_metal_shipbuilding'], label: 'shipyards building metal ships' }], mark: 5000 },
  oil_turbine: { sources: [{ buildings: ['building_power_plant'], methods: ['pm_coal-fired_plant'], label: 'coal-fired power plants' }], mark: 19000, requires: ['pumpjacks'] },
};

const baseRaw = readFileSync(join(REPO, BASE));
const cfg = JSON.parse(baseRaw.toString('utf8').replace(/^п»ї/, ''));
if (!cfg.research_events || !cfg.research_events.enabled) die('the base has no enabled research_events');
if (cfg.research_events.extra_entries) die('the base already carries extra_entries');
cfg.research_events.extra_entries = TABLE;
cfg.research_events.era1_rule_a = true;
cfg._research_extra_variant = {
  name: SFX, base: BASE, base_sha256: createHash('sha256').update(baseRaw).digest('hex'),
  ruled_by: 'user 2026-10-05: "Drop the Shift Work JE set. Build it and go with n=16." (the table: ROADMAP step 2, calibrated the same day)',
  delta: `research_events.extra_entries (${Object.keys(TABLE).length} technologies) + research_events.era1_rule_a; nothing else`,
  command: `node tools/make_research_extra_config.mjs --base ${BASE} --suffix ${SFX}`,
};
writeFileSync(join(REPO, 'config', `mod_config.${SFX}.json`), JSON.stringify(cfg), 'utf8');
const baseName = basename(BASE);
const baseTwin = baseName === 'mod_config.json' ? 'tech_tree_options.json' : baseName.replace(/^mod_config\./, 'tech_tree_options.');
if (!existsSync(join(REPO, 'config', baseTwin))) die(`the base's tech-tree twin ${baseTwin} does not exist`);
copyFileSync(join(REPO, 'config', baseTwin), join(REPO, 'config', `tech_tree_options.${SFX}.json`));
console.log(`wrote config/mod_config.${SFX}.json (+ tech_tree_options.${SFX}.json from ${baseTwin}): ${Object.keys(TABLE).length} extra entries, era1_rule_a on`);
