// THE FOUR-CLASS DAM BOOK — `node tools/make_dam4_config.mjs --base <book> --suffix <sfx> [--script-placement]`
//
// Writes config/mod_config.<sfx>.json = the base book + the dams on the engine's RESOURCE SLOTS with the RULED class table (user,
// 2026-10-09, "go with the revised classes"; FINDINGS F221 measured the layout's tick cost with the probe's median classes):
//   • `dams.layout = resource4` + `dams.resource4` (THE TABLE LIVES HERE ONLY): size by the project's scale (≥ 1.5 GW → large),
//     price by its head type (the high-head types holding ≥ half its MW → cheap); levels
//       small cheap  "Mountain Power Station"  300 electricity  4,800 points  electrical_generation
//       small dear   "River Dam"               300 electricity  7,200 points  steam_turbine
//       large cheap  "Great Mountain Scheme"   600 electricity  6,000 points  steam_turbine
//       large dear   "Great River Dam"         600 electricity  9,000 points  arc_welding
//     — cheap 1.5× cheaper per electricity than dear in both sizes, large 37.5% cheaper per electricity than small, every level
//     under ~5 years at the 35 points a week a country builds at when dams open, payback at base prices 4–10 years (e2 rungs 6.7);
//     a project under 150 electricity is dropped unless its farm effects are large (Aswan's First Cataract, Sennar: one river-dam level);
//   • the per-project must_have subsidies replaced by the four class types;
//   • `--script-placement`: `research_events.placement = script` (F221's V2: the first research stage placed by on_acquired_technology).
// Copies the base's tech-tree twin (L20) and records `_dam4_variant` with the command.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAll, resourceLayout, damParams } from './lib_dams.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const base = arg('--base'), sfx = arg('--suffix'), script = process.argv.includes('--script-placement');
if (!base || !sfx) { console.error('usage: node tools/make_dam4_config.mjs --base <book> --suffix <sfx> [--script-placement]'); process.exit(2); }

const RESOURCE4 = {
  _ruled: 'user, 2026-10-09: "go with the revised classes" (small 300 / large 600 electricity, cheap 1.5x cheaper than dear, every level under 5 years; drop under 150 electricity unless the farm effects are large)',
  large_mw: 1500,
  cheap_resources: ['falls_diversion', 'high_head_diversion', 'high_head_alpine', 'escarpment_high_head', 'plateau_diversion',
    'lake_outlet', 'lake_outlet_cascade', 'lake_high_head', 'canal_cascade'],
  min_units: 150,
  keep: ['first_cataract', 'sennar_blue_nile'],
  keep_class: 'small_dear',
  classes: {
    small_cheap: { units: 300, points: 4800, tech: 'A', name: 'Mountain Power Station' },
    small_dear: { units: 300, points: 7200, tech: 'B', name: 'River Dam' },
    large_cheap: { units: 600, points: 6000, tech: 'B', name: 'Great Mountain Scheme' },
    large_dear: { units: 600, points: 9000, tech: 'C', name: 'Great River Dam' },
  },
};

const basePath = base.includes('/') || base.includes('\\') ? base : join(REPO, 'config', `mod_config.${base}.json`);
const cfg = JSON.parse(readFileSync(basePath, 'utf8'));
if (!cfg.dams?.enabled) throw new Error('make_dam4_config: the base book carries no dams');
if (cfg.dams.layout) throw new Error(`make_dam4_config: the base book already sets dams.layout '${cfg.dams.layout}'`);
cfg.dams.layout = 'resource4';
cfg.dams.resource4 = RESOURCE4;
// the subsidies: per-project keys out, the four class keys in
const subs = cfg.building_subsidies || {};
let removed = 0;
for (const k of Object.keys(subs)) if (/^building_dam_/.test(k)) { delete subs[k]; removed++; }
for (const c of Object.keys(RESOURCE4.classes)) subs[`building_dam_${c}`] = 'must_have';
cfg.building_subsidies = subs;
if (script) { if (!cfg.research_events?.enabled) throw new Error('make_dam4_config: --script-placement on a book without research entries'); cfg.research_events.placement = 'script'; }
// prove the table derives (throws on an unprofitable class, an unknown resource type or keep id)
const { P, projects } = deriveAll(cfg);
const L = resourceLayout(damParams(cfg), projects);
const baseName = basePath.replace(/\\/g, '/').split('/').pop().replace(/^mod_config\.|\.json$/g, '');
cfg._dam4_variant = {
  base: baseName, script_placement: script, removed_project_subsidies: removed,
  classes: Object.fromEntries(Object.entries(L.classes).map(([c, C]) => [c, { projects: C.n, slots: C.slots, units: C.units, points: C.points, tech: P.tech_by_class[C.tcls], worst_profit: C.worst_profit }])),
  dropped: L.dropped.map(d => d.id),
  command: `node tools/make_dam4_config.mjs --base ${baseName} --suffix ${sfx}${script ? ' --script-placement' : ''}`,
};
const out = join(REPO, 'config', `mod_config.${sfx}.json`);
writeFileSync(out, JSON.stringify(cfg));
const twinFrom = join(REPO, 'config', `tech_tree_options.${baseName}.json`), twinTo = join(REPO, 'config', `tech_tree_options.${sfx}.json`);
if (!existsSync(twinFrom)) throw new Error(`make_dam4_config: no tree twin ${twinFrom}`);
copyFileSync(twinFrom, twinTo);
console.log(`wrote ${out} (+ tree twin)`);
for (const [c, C] of Object.entries(cfg._dam4_variant.classes)) console.log(`  ${c.padEnd(12)} ${String(C.projects).padStart(3)} projects ${String(C.slots).padStart(3)} slots  ${C.units} el. ${C.points} pts  ${C.tech}  worst-price profit ${C.worst_profit}/wk`);
console.log(`  dropped ${L.dropped.length}: ${L.dropped.map(d => d.id).join(', ')}`);
console.log(`  subsidies: ${removed} per-project keys out, 4 class keys in; research placement ${script ? 'script' : 'unchanged'}`);
