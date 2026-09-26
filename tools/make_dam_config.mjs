// THE DAM BOOK — a config = a base book + the power plant at 4 × vanilla's cost + the hydro-dam megaprojects
// (ROADMAP step 6, BALANCE_FRAMEWORK §10.89, user-ruled 2026-09-26). No base key is changed.
//
//   node tools/make_dam_config.mjs [--base config/mod_config.json] [--suffix canon-dams] [--probe]
//
// Writes config/mod_config.<suffix>.json and its tech-tree twin (landmine L20: a copy of the base's twin).
// --probe adds `dams.probe` (1836-probe builds ONLY: the class technologies granted to named countries at the
// start, 2-month surveys, stage cost × 0.05), so a two-year probe exercises survey → construction → effects.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'config/mod_config.json');
const probe = process.argv.includes('--probe');
const suffix = arg('--suffix', probe ? 'canon-dams-probe' : 'canon-dams');
const cfg = JSON.parse(readFileSync(join(REPO, base), 'utf8'));
for (const k of ['dams', 'building_required_construction']) if (cfg[k]) throw new Error(`make_dam_config: the base already carries '${k}'`);

cfg.building_required_construction = { building_power_plant: 1600 };
cfg.dams = {
  enabled: true,
  projects_file: 'config/dam_projects.json',
  // the vanilla hydro-narrative electricity bonuses: the dams are those sites now
  strip_trait_modifiers: {
    state_trait_niagara_falls: ['goods_output_electricity_mult'],
    state_trait_krka_falls: ['goods_output_electricity_mult'],
    state_trait_angara_river: ['goods_output_electricity_mult'],
    state_trait_trondhjemsfjorden: ['goods_output_electricity_mult'],
    state_trait_hardangerfjorden: ['goods_output_electricity_mult'],
  },
  effects: {
    traits: {
      state_trait_pmr_basin_irrigation: {
        name: 'Basin Irrigation',
        desc: 'The Nile flood waters these fields once a year. Without storage there is no summer crop, and the land yields well below the perennially irrigated Delta.',
        modifier: { building_group_bg_agriculture_throughput_add: -0.1, building_group_bg_plantations_throughput_add: -0.1 },
      },
      state_trait_pmr_rainfed_plain: {
        name: 'Rain-fed Plain',
        desc: 'Between the two Niles the plain is farmed on uncertain summer rains and grazed; the river irrigates only a narrow strip.',
        modifier: { building_group_bg_agriculture_throughput_add: -0.2, building_group_bg_plantations_throughput_add: -0.2 },
      },
      state_trait_pmr_steppe_irrigation: {
        name: 'Steppe Irrigation',
        desc: 'Canals from the great reservoir water the dry steppe, taking the edge off its droughts.',
        modifier: { state_harvest_condition_drought_impact_mult: -0.15 },
      },
      state_trait_pmr_flood_control: {
        name: 'River Flood Control',
        desc: 'A chain of storage dams holds back the spring floods that used to drown the valley bottoms.',
        modifier: { state_harvest_condition_flood_impact_mult: -0.15 },
      },
      state_trait_pmr_flood_control_minor: {
        name: 'River Flood Control',
        desc: 'Storage dams upstream and on this reach hold back the worst of the floods.',
        modifier: { state_harvest_condition_flood_impact_mult: -0.1 },
      },
    },
    // the 1836 situation before the dams (user-ruled: maluses where the land was worse, removed by the dam)
    start: [
      { state: 'STATE_MIDDLE_EGYPT', add_trait: 'state_trait_pmr_basin_irrigation' },
      { state: 'STATE_UPPER_EGYPT', add_trait: 'state_trait_pmr_basin_irrigation' },
      { state: 'STATE_BLUE_NILE', add_trait: 'state_trait_pmr_rainfed_plain' },
    ],
  },
};
if (probe) cfg.dams.probe = { grant_tags: ['GBR', 'FRA', 'USA', 'RUS', 'PRU', 'AUS', 'SWE', 'SAR', 'SWI', 'TUR'], survey_months: 2, cost_mult: 0.05, force_build_every: 0 };
cfg._dams_variant = {
  name: suffix, base: basename(base),
  ruled_by: 'user 2026-09-26: power plants at 4x construction cost, recipes unchanged; hydro-dam megaprojects (survey decision + staged unique buildings, one project per state)',
  delta: 'building_required_construction + dams' + (probe ? ' (+ PROBE: techs granted, 2-month surveys, cost x0.05)' : ''),
};
const dst = join(REPO, `config/mod_config.${suffix}.json`);
writeFileSync(dst, JSON.stringify(cfg));
const twinSrc = join(REPO, base.replace(/mod_config(\.[^/]*)?\.json$/, (m, s) => `tech_tree_options${s || ''}.json`));
if (!existsSync(twinSrc)) throw new Error(`make_dam_config: no tech-tree twin at ${twinSrc}`);
copyFileSync(twinSrc, join(REPO, `config/tech_tree_options.${suffix}.json`));
console.log(`wrote config/mod_config.${suffix}.json + tech_tree_options.${suffix}.json (base ${base})`);
