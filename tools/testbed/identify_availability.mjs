// identify_availability.mjs — what IS the `availability` the game substitutes goods by?
//
//   node tools/testbed/identify_availability.mjs <needs.tsv> <markets_all.tsv> [--region R] [--market M] [--date D] [--run N]
//
// ⭐ THE CLEAN SET. The stored shares give availability up to one global scale (share = a/D per need,
// linked across needs by shared goods). Three things contaminate `a` and each is EXCLUDED here rather
// than modelled:
//   · culture OBSESSION and religion TABOO — identified from the game files, dropped.
//   · the PRESTIGE-GOODS demand multiplier (defines DEFAULT_PRESTIGE_GOODS_DEMAND_INCREASE = 0.5,
//     scaled by the prestige fraction of local supply). It is per GOOD, so it inflates `a` silently.
//     A need whose shares sum to exactly 1 can have no inflated good in it — so every good of such a
//     need is prestige-clean, and that is how the clean set is built rather than assumed.
//   · LOCAL goods, whose substitution supply is the state's own plus a GDP-share-weighted slice of the
//     market's (defines LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR = 0.25) and therefore is NOT the
//     market order book at all.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [NEEDS_TSV, MKT_TSV] = pos;
const REGION = argOf('--region', 'STATE_MIDLANDS'), MARKET = argOf('--market', 'British Market');
const DATE = argOf('--date', '1925.1.1'), RUN = argOf('--run', '3');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const strip = s => s.replace(/^\uFEFF/, '');

const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
const CULT = {}, RELTABOO = {};
{
  const t = strip(readFileSync(join(GAME, 'common/cultures/00_cultures.txt'), 'utf8'));
  const names = [...t.matchAll(/^([a-z_]+)\s*=\s*\{/gm)];
  for (let k = 0; k < names.length; k++) {
    const seg = t.slice(names[k].index, names[k + 1] ? names[k + 1].index : t.length);
    const o = /obsessions\s*=\s*\{([^}]*)\}/.exec(seg), r = /religion\s*=\s*([a-z_]+)/.exec(seg);
    CULT[k] = { name: names[k][1], obs: o && o[1].trim() ? o[1].trim().split(/\s+/) : [], religion: r ? r[1] : '' };
  }
  for (const f of readdirSync(join(GAME, 'common/religions')))
    for (const m of strip(readFileSync(join(GAME, 'common/religions', f), 'utf8')).matchAll(/^([a-z_]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
      const tb = /taboos\s*=\s*\{([^}]*)\}/.exec(m[2]);
      RELTABOO[m[1]] = tb && tb[1].trim() ? tb[1].trim().split(/\s+/) : [];
    }
}
const LOCAL = new Set(['services', 'transportation', 'electricity']);

const L = readFileSync(NEEDS_TSV, 'utf8').split('\n').filter(Boolean);
const h = L[0].split('\t'), ix = Object.fromEntries(h.map((x, i) => [x, i]));
let rows = [];
for (let i = 1; i < L.length; i++) {
  const c = L[i].split('\t'); if (c[ix.region] !== REGION) continue;
  rows.push({ key: +c[ix.key], need: c[ix.need], good: c[ix.good], share: +c[ix.share], clamp: c[ix.clamp] || '' });
}
const KEY = +argOf('--key', [...new Set(rows.map(r => r.key))][0]);
const cult = CULT[KEY] || { obs: [], religion: '' }, taboo = RELTABOO[cult.religion] || [];
rows = rows.filter(r => r.key === KEY);
const usable = rows.filter(r => r.share > 1e-9 && !r.clamp && !cult.obs.includes(r.good) && !taboo.includes(r.good));

// fit share = a/D
const goods = [...new Set(usable.map(r => r.good))], needs = [...new Set(usable.map(r => r.need))];
const gi = Object.fromEntries(goods.map((g, i) => [g, i])), ni = Object.fromEntries(needs.map((n, i) => [n, i]));
let la = new Float64Array(goods.length), lD = new Float64Array(needs.length);
for (let it = 0; it < 50000; it++) {
  const s = new Float64Array(goods.length), c = new Float64Array(goods.length);
  for (const r of usable) { const k = gi[r.good]; s[k] += Math.log(r.share) + lD[ni[r.need]]; c[k]++; }
  for (let k = 0; k < goods.length; k++) if (c[k]) la[k] = s[k] / c[k];
  const s2 = new Float64Array(needs.length), c2 = new Float64Array(needs.length);
  for (const r of usable) { const k = ni[r.need]; s2[k] += la[gi[r.good]] - Math.log(r.share); c2[k]++; }
  for (let k = 0; k < needs.length; k++) if (c2[k]) lD[k] = s2[k] / c2[k];
}
const A = Object.fromEntries(goods.map(g => [g, Math.exp(la[gi[g]])]));

// ---- the prestige-clean set: goods of needs whose shares sum to 1 ----
const needSum = {};
for (const r of rows) needSum[r.need] = (needSum[r.need] || 0) + r.share;
const cleanNeeds = needs.filter(n => Math.abs(needSum[n] - 1) < 0.002 && !rows.some(r => r.need === n && r.clamp));
const clean = [...new Set(rows.filter(r => cleanNeeds.includes(r.need)).map(r => r.good))]
  .filter(g => A[g] && !LOCAL.has(g));
console.log(`${REGION} culture ${KEY} (${cult.name}) @ ${DATE}`);
console.log(`needs with sum(share) == 1 (so every good in them is prestige-clean): ${cleanNeeds.join(', ')}`);
console.log(`sum(share) per need: ${Object.entries(needSum).map(([n, v]) => n + '=' + v.toFixed(4)).join('  ')}`);
console.log(`clean, non-local, fitted goods: ${clean.join(', ')}\n`);

// ---- order book ----
const M = readFileSync(MKT_TSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = {};
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.run_index] !== RUN || c[mi.dump_date] !== DATE || c[mi.tag] !== MARKET) continue;
  OB[c[mi.good]] = { buy: +c[mi.buy_orders], sell: +c[mi.sell_orders], price: +c[mi.price], imports: +c[mi.imports], exports: +c[mi.exports], production: +c[mi.production] };
}
const test = clean.filter(g => OB[g] && OB[g].sell > 0);

const cands = {
  'sell': (o) => o.sell,
  'sell x base': (o, g) => o.sell * BASEP[g],
  'sell x current': (o) => o.sell * o.price,
  'sell - 0.5*buy': (o) => o.sell - 0.5 * o.buy,
  '(sell - 0.5*buy) x base': (o, g) => (o.sell - 0.5 * o.buy) * BASEP[g],
  '(sell - 0.5*buy) x current': (o) => (o.sell - 0.5 * o.buy) * o.price,
  '(sell - 0.5*(buy+exports)) x base': (o, g) => (o.sell - 0.5 * (o.buy + o.exports)) * BASEP[g],
  'production x base': (o, g) => o.production * BASEP[g],
  '(sell - exports) x base': (o, g) => (o.sell - o.exports) * BASEP[g],
  'buy x base': (o, g) => o.buy * BASEP[g],
};
console.log('candidate                                slope    R^2    rms log-spread of a/candidate');
const results = [];
for (const [name, f] of Object.entries(cands)) {
  const xs = [], ys = [], gs = [];
  for (const g of test) { const v = f(OB[g], g); if (v > 0) { xs.push(Math.log(v)); ys.push(Math.log(A[g])); gs.push(g); } }
  if (xs.length < 4) { console.log(`${name.padEnd(38)} (only ${xs.length} goods)`); continue; }
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxy / sxx, r2 = (sxy * sxy) / (sxx * syy);
  const rs = gs.map((g, i) => ys[i] - xs[i]);
  const mr = rs.reduce((a, b) => a + b) / rs.length;
  const spread = Math.sqrt(rs.reduce((a, b) => a + (b - mr) ** 2, 0) / rs.length);
  results.push({ name, slope, r2, spread, gs, rs, mr });
  console.log(`${name.padEnd(38)} ${slope.toFixed(4).padStart(7)} ${r2.toFixed(4).padStart(7)} ${(spread * 100).toFixed(1).padStart(9)} %  (n=${xs.length})`);
}
results.sort((a, b) => a.spread - b.spread);
const best = results[0];
console.log(`\nbest by proportionality: ${best.name}`);
console.log('good              a(save)   candidate    a/cand (relative to the geometric mean)');
for (let i = 0; i < best.gs.length; i++) {
  const g = best.gs[i];
  console.log(`  ${g.padEnd(16)} ${A[g].toFixed(5).padStart(9)}  ${cands[best.name](OB[g], g).toExponential(3).padStart(11)}   ${Math.exp(best.rs[i] - best.mr).toFixed(4)}`);
}
