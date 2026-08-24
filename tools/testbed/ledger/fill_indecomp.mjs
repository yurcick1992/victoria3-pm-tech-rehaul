// The INDUSTRY DECOMPOSITION panel (user-ruled 2026-08-24: "we clearly need some industry type
// decomposition chart, not only now, but always"): each tiered industry's share of the tiered
// sector's weekly value added, world-wide, at the anchor years — mod arm beside vanilla.
// VA is the direct v6+ summary fields (va_out − va_in); the vanilla side reads the same 22
// industries through their base-building keys (tier-1 key = the vanilla base building).
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
const cfg = JSON.parse(readFileSync(argOf('--config', 'config/mod_config.json'), 'utf8'));

const MODIND = {}, VANIND = {};              // building key -> industry id, per arm's ladder
for (const ind of cfg.industries || []) {
  const tiers = (ind.tiers || []).filter(t => t.key);
  for (const t of tiers) MODIND[t.key] = ind.id;
  if (tiers.length) VANIND[tiers[0].key] = ind.id;
}

function walk(runDir, INDOF) {
  const dir = join(SES, runDir, 'save_summaries');
  const out = {};                            // year -> {byInd: {id: £/wk}, tot: £/wk}
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0]; if (!YEARS.includes(y)) continue;
    const byInd = {}; let tot = 0;
    for (const c of Object.values(j.countries))
      for (const [k, b] of Object.entries(c.buildings || {})) {
        const id = INDOF[k]; if (!id || b.va_out === undefined) continue;
        const v = (b.va_out || 0) - (b.va_in || 0);
        byInd[id] = (byInd[id] || 0) + v; tot += v;
      }
    out[y] = { byInd, tot };
  }
  return out;
}
const mod = walk(argOf('--mod', ''), MODIND);
const vans = argOf('--van', '').split(',').filter(Boolean).map(r => walk(r, VANIND));

const INDS = [...new Set(Object.values(MODIND))];
const pctRow = (w, y, id) => w[y] && w[y].tot ? +(100 * (w[y].byInd[id] || 0) / w[y].tot).toFixed(1) : null;
const rows = INDS.map(id => {
  const m = {}, v = {};
  for (const y of YEARS) {
    m[y] = pctRow(mod, y, id);
    const vs = vans.map(w => pctRow(w, y, id)).filter(x => x != null);
    v[y] = vs.length ? +(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) : null;
  }
  return { id, mod: m, van: v };
}).sort((a, b) => (b.mod[1935] ?? -1) - (a.mod[1935] ?? -1));
const tot = { mod: {}, van: {} };
for (const y of YEARS) {
  tot.mod[y] = mod[y] ? +(mod[y].tot / 1e6).toFixed(2) : null;
  const vs = vans.map(w => w[y] ? w[y].tot / 1e6 : null).filter(x => x != null);
  tot.van[y] = vs.length ? +(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2) : null;
}
writeFileSync(join(OUT, 'indecomp.json'), JSON.stringify({ years: YEARS, rows, tot }));
console.log('indecomp.json:', rows.length, 'industries; 1935 top:',
  rows.slice(0, 4).map(r => r.id + ' ' + r.mod[1935] + '%').join(' · '), '| tiered VA £M/wk mod/van 1935:', tot.mod[1935], '/', tot.van[1935]);
