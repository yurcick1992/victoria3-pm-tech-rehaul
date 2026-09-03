// The INDUSTRY COMPOSITION panel (user-ruled 2026-08-24: "we clearly need some industry type
// decomposition chart, not only now, but always"; extended same day: the panel exists on BOTH pages
// and follows the SCOPE control — whole economy = BROAD SECTORS, tiered sector = the exact
// industries — and the watchlist copy follows the country selection).
//
// Emits ABSOLUTE weekly VA (£/wk), world AND per watchlist tag, both arms, at the anchor years —
// shares are computed by the renderer from whatever selection is active, because a share baked in
// here could not follow the chips. VA = the direct v6+ summary fields (va_out − va_in). The vanilla
// arm reads the same 22 industries through their base-building keys (tier-1 key = vanilla base).
// Broad sectors: tiered / extraction / agriculture / subsistence / urban & trade / state & military
// / ownership / other — pattern-mapped; anything left in 'other' is PRINTED by name (never swept
// silently, the analyse_build_allocation convention).
//
// USAGE: node tools/testbed/ledger/fill_indecomp.mjs <outDir> --mod <sess/run> --van <sess/run[,...]>
//        --config <arm config>
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const ARGV = process.argv.slice(2);
const OUT = ARGV[0];
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SES = 'tools/testbed/sessions';
const YEARS = [1840, 1860, 1880, 1900, 1920, 1935];
const TAGS = ['GBR', 'RUS', 'FRA', 'USA', 'PRU', 'TUR', 'AUS', 'SPA', 'BRZ', 'SIC', 'POR', 'NET'];
const cfg = JSON.parse(readFileSync(argOf('--config', 'config/mod_config.json'), 'utf8'));

const MODIND = {}, VANIND = {};              // building key -> industry id, per arm's ladder
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;   // ⚠ a DISABLED industry (port/shipyard/railway/power on the four-rung books) keeps its tiers in the config and its rung-0 KEY IS THE VANILLA BUILDING — counting it put Britain's shipyards and ports into "e0" (BUGS_AND_FIXES 2026-09-03)
  const tiers = (ind.tiers || []).filter(t => t.key);
  for (const t of tiers) MODIND[t.key] = ind.id;
  if (tiers.length) VANIND[tiers[0].key] = ind.id;
}
const BROAD = [
  ['extraction', /_mine$|logging_camp|oil_rig|rubber_plantation|fishing_wharf|whaling_station|gold_field/],
  ['agriculture', /_farm$|_plantation$|livestock_ranch|vineyard/],
  ['subsistence', /subsistence/],
  ['urban & trade', /urban_center|trade_center/],
  // the industries a four-rung book hands BACK to vanilla (disabled: true — their keys are the vanilla buildings); on the
  // six-rung canon these keys are tiered and MODIND claims them first, so this bucket is empty there (L27, 2026-09-03)
  ['infrastructure & shipping (vanilla)', /^building_(port|railway|shipyard|power_plant)$/],
  ['state & military', /government_administration|university|construction_sector|barrack|naval_base|conscription_center|port_military|logistics_center|naval_fortification|naval_administration/],
  ['ownership & companies', /manor_house|financial_district|company_|_estate$/],
  ['monuments & canals', /_canal$|skyscraper|cathedral|white_house|capitol_hill|mosque|hagia|forbidden_city|statue|big_ben|eiffel|vatican|kremlin|mausoleum|taj_mahal|angkor|dojo|shwedagon/],
];
const broadOf = (k, INDOF) => {
  if (INDOF[k]) return 'tiered industries';
  for (const [name, re] of BROAD) if (re.test(k)) return name;
  return 'other';
};

const other = new Map();
function walk(runDir, INDOF) {
  const dir = join(SES, runDir, 'save_summaries');
  const out = {};                            // year -> {ind:{id:£/wk}, broad:{name:£/wk}, tags:{tag:{ind,broad}}}
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0]; if (!YEARS.includes(y)) continue;
    const acc = () => ({ ind: {}, broad: {} });
    const add = (dst, k, b) => {
      if (b.va_out === undefined) return;
      const v = (b.va_out || 0) - (b.va_in || 0);
      const br = broadOf(k, INDOF);
      dst.broad[br] = (dst.broad[br] || 0) + v;
      if (br === 'other') other.set(k, (other.get(k) || 0) + Math.abs(v));
      const id = INDOF[k]; if (id) dst.ind[id] = (dst.ind[id] || 0) + v;
    };
    const world = acc(); const tags = {};
    for (const [tag, c] of Object.entries(j.countries)) {
      const t = TAGS.includes(tag) ? (tags[tag] = acc()) : null;
      for (const [k, b] of Object.entries(c.buildings || {})) { add(world, k, b); if (t) add(t, k, b); }
    }
    const rnd = o => { for (const k in o) o[k] = +o[k].toFixed(0); return o; };
    out[y] = { ind: rnd(world.ind), broad: rnd(world.broad),
               tags: Object.fromEntries(Object.entries(tags).map(([t, a]) => [t, { ind: rnd(a.ind), broad: rnd(a.broad) }])) };
  }
  return out;
}
// --mod takes a comma list like --van (one run used to be assumed, and a two-run list silently walked nothing)
const modsRaw = argOf('--mod', '').split(',').filter(Boolean).map(r => walk(r, MODIND));
const mod = {};
for (const y of YEARS) {
  const rows = modsRaw.map(w => w[y]).filter(Boolean); if (!rows.length) continue;
  const meanM = objs => { const o = {}; const ks = new Set(); objs.forEach(x => Object.keys(x).forEach(k => ks.add(k)));
    for (const k of ks) o[k] = +(objs.reduce((s, x) => s + (x[k] || 0), 0) / rows.length).toFixed(0); return o; };
  const tags = {}; const tk = new Set(); rows.forEach(r => Object.keys(r.tags || {}).forEach(k => tk.add(k)));
  for (const k of tk) { const tr = rows.map(r => (r.tags || {})[k]).filter(Boolean); tags[k] = { ind: meanM(tr.map(x => x.ind)), broad: meanM(tr.map(x => x.broad)) }; }
  mod[y] = { ind: meanM(rows.map(r => r.ind)), broad: meanM(rows.map(r => r.broad)), tags };
}
const vansRaw = argOf('--van', '').split(',').filter(Boolean).map(r => walk(r, VANIND));
// vanilla: element-wise mean across runs
const van = {};
for (const y of YEARS) {
  const rows = vansRaw.map(w => w[y]).filter(Boolean); if (!rows.length) continue;
  const mean = objs => { const o = {}; const ks = new Set(); objs.forEach(x => Object.keys(x).forEach(k => ks.add(k)));
    for (const k of ks) o[k] = +(objs.reduce((a, x) => a + (x[k] || 0), 0) / rows.length).toFixed(0); return o; };
  van[y] = { ind: mean(rows.map(r => r.ind)), broad: mean(rows.map(r => r.broad)), tags: {} };
  for (const tag of TAGS) {
    const tr = rows.map(r => r.tags[tag]).filter(Boolean); if (!tr.length) continue;
    van[y].tags[tag] = { ind: mean(tr.map(x => x.ind)), broad: mean(tr.map(x => x.broad)) };
  }
}
writeFileSync(join(OUT, 'indecomp.json'), JSON.stringify({ years: YEARS, mod, van }));
const top = Object.entries(mod[1935]?.ind || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
console.log('indecomp.json: 1935 tiered top:', top.map(([k, v]) => k + ' £' + (v / 1e3).toFixed(0) + 'k/wk').join(' · '));
console.log('  broad 1935 (mod):', JSON.stringify(mod[1935]?.broad));
if (other.size) console.log('  ⚠ unclassified ("other") keys by |VA|:', [...other.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' £' + (v / 1e3).toFixed(0) + 'k').join(' · '));
