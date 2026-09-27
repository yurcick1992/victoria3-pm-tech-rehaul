// THE DAM BOOK — a config = a base book + the power plant at 4 × vanilla's cost + the hydro-dam megaprojects
// (ROADMAP step 6, BALANCE_FRAMEWORK §10.89, user-ruled 2026-09-26). No base key is changed.
//
//   node tools/make_dam_config.mjs [--base config/mod_config.canon-b164-trade.json] [--suffix canon-dams] [--probe [--contest ...]]
//
// Writes config/mod_config.<suffix>.json and its tech-tree twin (landmine L20: a copy of the base's twin).
// --probe adds `dams.probe` (1836-probe builds ONLY: the class technologies granted to named countries at the
// start, 2-month surveys, stage cost × 0.05), so a two-year probe exercises survey → construction → effects.
// ⭐ Since 2026-09-27 the book builds nothing by script (F173/F174): the engine's AI builds every level; the driver only surveys.
// The `--ai-self` flag that switched the scripted construction off is gone with it — the canon IS that setup now.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'config/mod_config.canon-b164-trade.json');   // the canon the dam book was built on (the dam book IS the canon since 2026-09-27)
const probe = process.argv.includes('--probe');
// --contest (probe): the CONTEST probe (p13/p14) - several eligible builders seeded on every subject's site, the monthly level log,
// costs x0.25, and electricity demand (urban centres everywhere, or --elec-sink); it replaces the old --ai-self --probe pair.
// ⚠ throws on --ai-self, so an old command line cannot silently produce a different book
if (process.argv.includes('--ai-self')) throw new Error('make_dam_config: --ai-self is gone (the canon builds nothing by script since 2026-09-27); use --probe --contest');
const contest = process.argv.includes('--contest');
// --grant TAG,TAG (probe): who gets the dam technologies at the start, in place of the ten majors; --contest-grant chain|overlords|top|none
// (contest): who the contest seeding gives the technologies to (emit_dams.mjs). User, 2026-09-27: techs only at the overlord
const grantTags = arg('--grant', null), contestGrant = arg('--contest-grant', null);
// --ai-value N: the dams' ai_value (default lib_dams 30,000); --elec-sink PER (contest): electricity consumers in every other dam
// state instead of the urban-centre demand everywhere, PER electricity a level (emit_dams.mjs; user, 2026-09-27: "leave some for control")
const aiValue = arg('--ai-value', null), elecSink = arg('--elec-sink', null);
const suffix = arg('--suffix', 'canon-dams' + (probe ? (contest ? '-contest' : '-probe') : ''));
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
// ALWAYS SUBSIDISED, like infrastructure (user, 2026-09-26): must_have in every administrative strategy, through the
// existing building_subsidies machinery (build.ps1 then owns 01_admin_strategies.txt, restating vanilla's own entries)
if (cfg.building_subsidies && Object.values(cfg.building_subsidies).some(v => v && v !== 'vanilla')) throw new Error('make_dam_config: the base already sets building_subsidies - merge by hand');
const dp = JSON.parse(readFileSync(join(REPO, cfg.dams.projects_file), 'utf8'));
cfg.building_subsidies = Object.fromEntries((dp.projects || dp).map(p => [`building_dam_${p.id}`, 'must_have']));
if (aiValue) cfg.dams.ai = { ...(cfg.dams.ai || {}), stage_ai_value: +aiValue };
// the CONTEST probe (user, 2026-09-27): several eligible builders on every subject's site, the level log, and costs x0.25 rather
// than x0.05 so that constructions overlap in time long enough to collide
if (probe) cfg.dams.probe = { grant_tags: ['GBR', 'FRA', 'USA', 'RUS', 'PRU', 'AUS', 'SWE', 'SAR', 'SWI', 'TUR'], survey_months: 2, cost_mult: 0.05, laissez_faire_tags: ['USA', 'FRA'] };
if (probe && grantTags) cfg.dams.probe.grant_tags = grantTags.split(',');
if ((contest || contestGrant || elecSink) && !(probe && contest)) throw new Error('make_dam_config: --contest-grant / --elec-sink need --probe --contest');
if (probe && contest) {
  Object.assign(cfg.dams.probe, { contest: true, cost_mult: 0.25 });
  // ELECTRICITY DEMAND FROM 1836 (user, 2026-09-27: "If noone starts building dams, this could well be because there's no electricity
  // demand. Try adding some."). Nothing buys electricity before ~1880, so a probe AI would see a dam's output unsellable. Every
  // urban centre runs pm_no_public_transport from 1836 (ungated): it now also takes 1 electricity per level. With no supply the
  // price sits at the band's 175% edge - the strongest signal the market can send. PROBE ONLY: short of that input, urban centres
  // lose output.
  if (contestGrant) cfg.dams.probe.contest_grant = contestGrant;
  if (elecSink) cfg.dams.probe.elec_sink = { per_level: +elecSink };   // targeted demand with a control: no urban-centre demand
  else {
    if (cfg.pm_goods?.pm_no_public_transport) throw new Error('make_dam_config: the base already overrides pm_no_public_transport');
    cfg.pm_goods = { ...(cfg.pm_goods || {}), pm_no_public_transport: { in: { electricity: 1 }, out: { transportation: 2 } } };
  }
}
cfg._dams_variant = {
  name: suffix, base: basename(base),
  ruled_by: 'user 2026-09-26: power plants at 4x construction cost, recipes unchanged; hydro-dam megaprojects (survey decision + staged unique buildings, one project per state)',
  delta: 'building_required_construction + dams (the driver only surveys; the engine builds every level)' +
    (probe ? (contest ? ' (+ CONTEST PROBE: see dams.probe)' : ' (+ PROBE: techs granted, 2-month surveys, cost x0.05)') : ''),
};
const dst = join(REPO, `config/mod_config.${suffix}.json`);
writeFileSync(dst, JSON.stringify(cfg));
const twinSrc = join(REPO, base.replace(/mod_config(\.[^/]*)?\.json$/, (m, s) => `tech_tree_options${s || ''}.json`));
if (!existsSync(twinSrc)) throw new Error(`make_dam_config: no tech-tree twin at ${twinSrc}`);
copyFileSync(twinSrc, join(REPO, `config/tech_tree_options.${suffix}.json`));
console.log(`wrote config/mod_config.${suffix}.json + tech_tree_options.${suffix}.json (base ${base})`);
