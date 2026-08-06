// fit_availability.mjs — recover the game's own per-good `availability` from a save's stored pop-need
// purchase weights, then ask which observable quantity it IS.
//
//   node tools/testbed/fit_availability.mjs <needs.tsv> <markets_all.tsv> \
//        --region STATE_MIDLANDS --market "British Market" --date 1925.1.1 --run 3
//
// ⭐ WHAT MAKES THIS AN IDENTIFICATION AND NOT A FIT. Within a need the stored shares give the RATIOS
// a(g1):a(g2):… directly, with no assumption about what a is. A good sitting in two needs then links
// the two needs' scales, and the whole graph collapses to ONE unknown global scale. So `a` is READ OFF
// the save, not fitted to the order book — and comparing it with the order book afterwards is a real
// test that the order book can fail.
//
// ⚠ CULTURE IS A CONFOUND AND MUST BE EXCLUDED, NOT AVERAGED. The weights are stored per (state,
// culture): a culture OBSESSED with a good has that good's entry raised, and a religion that TABOOS one
// has it halved — both measured, exactly, by comparing two cultures of the same state. An obsessed or
// tabooed entry says nothing about availability, so it is dropped.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [NEEDS_TSV, MKT_TSV] = pos;
const REGION = argOf('--region', 'STATE_MIDLANDS');
const MARKET = argOf('--market', 'British Market');
const DATE = argOf('--date', '1925.1.1');
const RUN = argOf('--run', '3');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
if (!NEEDS_TSV || !existsSync(NEEDS_TSV)) { console.error('need a needs.tsv'); process.exit(1); }

const strip = s => s.replace(/^\uFEFF/, '');
// ---- base prices ----
const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
// ---- culture obsessions / religion taboos ----
const CULT = {}, RELTABOO = {};
{
  const t = strip(readFileSync(join(GAME, 'common/cultures/00_cultures.txt'), 'utf8'));
  const names = [...t.matchAll(/^([a-z_]+)\s*=\s*\{/gm)];
  for (let k = 0; k < names.length; k++) {
    const seg = t.slice(names[k].index, names[k + 1] ? names[k + 1].index : t.length);
    const o = /obsessions\s*=\s*\{([^}]*)\}/.exec(seg);
    const r = /religion\s*=\s*([a-z_]+)/.exec(seg);
    CULT[k] = { name: names[k][1], obs: o && o[1].trim() ? o[1].trim().split(/\s+/) : [], religion: r ? r[1] : '' };
  }
  try {
    for (const f of readdirSync(join(GAME, 'common/religions'))) {
      const t2 = strip(readFileSync(join(GAME, 'common/religions', f), 'utf8'));
      for (const m of t2.matchAll(/^([a-z_]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
        const tb = /taboos\s*=\s*\{([^}]*)\}/.exec(m[2]);
        RELTABOO[m[1]] = tb && tb[1].trim() ? tb[1].trim().split(/\s+/) : [];
      }
    }
  } catch { }
}

// ---- the save's stored shares for this state ----
const L = readFileSync(NEEDS_TSV, 'utf8').split('\n').filter(Boolean);
const h = L[0].split('\t'), ix = Object.fromEntries(h.map((x, i) => [x, i]));
let rows = [];
for (let i = 1; i < L.length; i++) {
  const c = L[i].split('\t');
  if (c[ix.region] !== REGION) continue;
  rows.push({ key: +c[ix.key], need: c[ix.need], good: c[ix.good], w: +c[ix.weight], base: +c[ix.base], share: +c[ix.share], maxs: +c[ix.maxs], mins: +c[ix.mins], clamp: c[ix.clamp] || '' });
}
const keys = [...new Set(rows.map(r => r.key))];
console.log(`${REGION}: cultures present = ${keys.map(k => `${k}:${CULT[k]?.name ?? '?'}(${(CULT[k]?.obs || []).join(',') || 'no obsession'}${(RELTABOO[CULT[k]?.religion] || []).length ? ' taboo:' + RELTABOO[CULT[k].religion].join(',') : ''})`).join('  ')}`);
const KEY = +argOf('--key', keys[0]);
const cult = CULT[KEY] || { obs: [], religion: '' };
const taboo = RELTABOO[cult.religion] || [];
rows = rows.filter(r => r.key === KEY);

const dropped = rows.filter(r => cult.obs.includes(r.good) || taboo.includes(r.good));
const usable = rows.filter(r => r.share > 1e-9 && !r.clamp && !cult.obs.includes(r.good) && !taboo.includes(r.good));
console.log(`culture ${KEY} (${cult.name}): ${rows.length} entries · dropped ${dropped.length} obsessed/taboo (${[...new Set(dropped.map(d => d.good))].join(',') || '-'}) · ${rows.filter(r => r.clamp).length} clamped · ${usable.length} usable`);

// ---- solve share = a(good)/D(need) ----
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
const D = Object.fromEntries(needs.map(n => [n, Math.exp(lD[ni[n]])]));
let sse = 0; for (const r of usable) { const e = (A[r.good] / D[r.need]) / r.share - 1; sse += e * e; }
console.log(`fit share = a(good)/D(need):  rms ${(Math.sqrt(sse / usable.length) * 100).toFixed(4)} % over ${usable.length} observations`);
// which goods are identified relative to others (appear in >= 2 needs) vs floating with their need
const multi = new Set(); const cnt = {};
for (const r of usable) cnt[r.good] = (cnt[r.good] || 0) + 1;
for (const g of goods) if (cnt[g] >= 2) multi.add(g);
console.log(`goods pinned across needs (in >=2 usable needs): ${[...multi].join(', ')}`);

// ---- the order book at the same instant ----
if (!MKT_TSV || !existsSync(MKT_TSV)) { console.log('\n(no markets tsv given - stopping after the fit)'); process.exit(0); }
const M = readFileSync(MKT_TSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = {};
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  // ⚠ the market NAME is in the `tag` column; `market` holds "owner=<country>". Matching the wrong
  // one silently yields an empty order book and a comparison over zero goods.
  if (c[mi.run_index] !== RUN || c[mi.dump_date] !== DATE || c[mi.tag] !== MARKET) continue;
  OB[c[mi.good]] = { buy: +c[mi.buy_orders], sell: +c[mi.sell_orders], price: +c[mi.price], imports: +c[mi.imports], exports: +c[mi.exports], production: +c[mi.production] };
}
console.log(`\norder book: ${Object.keys(OB).length} goods for '${MARKET}' at ${DATE} (run ${RUN})`);

// candidate forms for availability
const cands = {
  'sell (units)': o => o.sell,
  'sell x current price': o => o.sell * o.price,
  'sell x base price': (o, g) => o.sell * (BASEP[g] ?? 0),
  'sell - 0.5*buy': o => o.sell - 0.5 * o.buy,
  'sell - 1.0*buy': o => o.sell - o.buy,
  '(sell-0.5*buy) x price': o => (o.sell - 0.5 * o.buy) * o.price,
  '(sell-0.5*buy) x base': (o, g) => (o.sell - 0.5 * o.buy) * (BASEP[g] ?? 0),
  'production (units)': o => o.production,
  'sell - 0.5*(exports+buy)': o => o.sell - 0.5 * (o.exports + o.buy),
  'buy (units)': o => o.buy,
};
// use only goods that are pinned across needs, so the comparison is not circular with D
const testGoods = [...multi].filter(g => OB[g] && Number.isFinite(A[g]));
console.log(`comparing on ${testGoods.length} cross-pinned goods: ${testGoods.join(', ')}`);
console.log('\ncandidate                          log-log slope   R^2     rms ratio spread');
for (const [name, f] of Object.entries(cands)) {
  const xs = [], ys = [];
  for (const g of testGoods) { const v = f(OB[g], g); if (v > 0) { xs.push(Math.log(v)); ys.push(Math.log(A[g])); } }
  if (xs.length < 3) { console.log(`${name.padEnd(34)} (only ${xs.length} usable goods)`); continue; }
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxy / sxx, r2 = (sxy * sxy) / (sxx * syy);
  // spread of A/candidate, i.e. how close to a pure proportionality
  const ratios = testGoods.filter(g => f(OB[g], g) > 0).map(g => A[g] / f(OB[g], g));
  const gm = Math.exp(ratios.reduce((a, b) => a + Math.log(b), 0) / ratios.length);
  const spread = Math.sqrt(ratios.reduce((a, b) => a + (Math.log(b / gm)) ** 2, 0) / ratios.length);
  console.log(`${name.padEnd(34)} ${slope.toFixed(4).padStart(10)} ${r2.toFixed(4).padStart(9)} ${(spread * 100).toFixed(1).padStart(10)} %  (n=${xs.length})`);
}

// ---- per-good table for the best-guess form ----
console.log('\ngood                a(save)      sell      buy     price   a / sell   a/(sell*p)  a/(sell-buy)');
const norm = testGoods.reduce((s, g) => s + A[g] / OB[g].sell, 0) / testGoods.length;
for (const g of [...goods].sort((x, y) => (A[y] ?? 0) - (A[x] ?? 0))) {
  const o = OB[g]; if (!o) continue;
  const pin = multi.has(g) ? '*' : ' ';
  console.log(`${pin}${g.padEnd(17)} ${A[g].toFixed(5).padStart(9)} ${o.sell.toFixed(0).padStart(9)} ${o.buy.toFixed(0).padStart(8)} ${o.price.toFixed(2).padStart(8)} ` +
    `${(A[g] / o.sell / norm).toFixed(4).padStart(10)} ${(A[g] / (o.sell * o.price)).toExponential(2).padStart(11)} ${(o.sell - o.buy > 0 ? (A[g] / (o.sell - o.buy)).toExponential(2) : '-').padStart(12)}`);
}
console.log('\nD(need) and the sum of a over that need\'s own goods:');
for (const n of needs) {
  const gs = rows.filter(r => r.need === n);
  const sum = gs.reduce((s, r) => s + (A[r.good] ?? NaN), 0);
  console.log(`  ${n.padEnd(20)} D=${D[n].toFixed(5).padStart(9)}  sum a=${(Number.isNaN(sum) ? NaN : sum).toFixed(5).padStart(9)}  D/sum=${(D[n] / sum).toFixed(5)}  (${gs.map(r => r.good).join(',')})`);
}
