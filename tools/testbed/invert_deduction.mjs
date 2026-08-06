// invert_deduction.mjs — given the availability vector recovered from a save's stored purchase
// weights, solve for the DEDUCTION the game makes from sell orders, and test whether that deduction
// is the non-pop (industry + export) demand.
//
//   node tools/testbed/invert_deduction.mjs <needs.tsv> <markets_all.tsv> [--region R] [--market M]
//        [--date D] [--run N] [--price base|current]
//
// ⭐ THE LOGIC. If availability(g) = (sell(g) - X(g)) x price(g), and the save gives availability up to
// ONE global scale k, then X(g) = sell(g) - a(g) / (k x price(g)). Every k gives a different X vector,
// but only a narrow band of k is admissible: X must be >= 0 (you cannot deduct more than exists) and
// <= buy(g) (the deduction is supposed to be part of the buy side). Inside that band the shape of
// X(g)/buy(g) is a PREDICTION - it should be near 1 for goods industry eats (fabric, coal, electricity)
// and near 0 for goods only pops buy (opium, wine, tobacco). That is a test the data can fail, and it
// does not need a channel-split measurement to run.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [NEEDS_TSV, MKT_TSV] = pos;
const REGION = argOf('--region', 'STATE_MIDLANDS'), MARKET = argOf('--market', 'British Market');
const DATE = argOf('--date', '1925.1.1'), RUN = argOf('--run', '3');
const PRICE = argOf('--price', 'base');
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
  try {
    for (const f of readdirSync(join(GAME, 'common/religions'))) {
      for (const m of strip(readFileSync(join(GAME, 'common/religions', f), 'utf8')).matchAll(/^([a-z_]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
        const tb = /taboos\s*=\s*\{([^}]*)\}/.exec(m[2]);
        RELTABOO[m[1]] = tb && tb[1].trim() ? tb[1].trim().split(/\s+/) : [];
      }
    }
  } catch { }
}

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

// needs whose scale is actually determined: those containing a good that appears in >= 2 usable needs
const cnt = {}; for (const r of usable) cnt[r.good] = (cnt[r.good] || 0) + 1;
const pinned = new Set(goods.filter(g => cnt[g] >= 2));
const detNeeds = new Set(needs.filter(n => usable.some(r => r.need === n && pinned.has(r.good))));
const detGoods = [...new Set(usable.filter(r => detNeeds.has(r.need)).map(r => r.good))];

const M = readFileSync(MKT_TSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = {};
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.run_index] !== RUN || c[mi.dump_date] !== DATE || c[mi.tag] !== MARKET) continue;
  OB[c[mi.good]] = { buy: +c[mi.buy_orders], sell: +c[mi.sell_orders], price: +c[mi.price], imports: +c[mi.imports], exports: +c[mi.exports], production: +c[mi.production] };
}
// LOCAL goods have state-level supply that a market-wide order book cannot describe
const LOCAL = new Set(['services', 'transportation', 'electricity']);
const test = detGoods.filter(g => OB[g] && OB[g].sell > 0 && !LOCAL.has(g));
const P = g => PRICE === 'current' ? OB[g].price : (BASEP[g] ?? 0);

console.log(`${REGION} / culture ${KEY} (${cult.name}) @ ${DATE} · price basis: ${PRICE}`);
console.log(`needs with a determined scale: ${[...detNeeds].join(', ')}`);
console.log(`goods testable: ${test.length}\n`);

// admissible band for k:  0 <= X(g) <= buy(g)  for all g
//   X = sell - a/(k*P)  =>  a/(k*P) <= sell  => k >= a/(P*sell)
//                           a/(k*P) >= sell-buy => k <= a/(P*(sell-buy)) when sell>buy
let kMin = 0, kMax = Infinity, argMin = '', argMax = '';
for (const g of test) {
  const lo = A[g] / (P(g) * OB[g].sell);
  if (lo > kMin) { kMin = lo; argMin = g; }
  if (OB[g].sell > OB[g].buy) { const hi = A[g] / (P(g) * (OB[g].sell - OB[g].buy)); if (hi < kMax) { kMax = hi; argMax = g; } }
}
console.log(`admissible scale band from X>=0 / X<=buy:  k in [${kMin.toExponential(4)} (set by ${argMin}), ${kMax.toExponential(4)} (set by ${argMax})]`);
if (kMin > kMax) console.log('  ⚠ EMPTY BAND - no single scale makes the deduction lie between 0 and the buy orders');

const ks = [];
for (let t = 0; t <= 10; t++) ks.push(kMin * Math.pow((Number.isFinite(kMax) ? kMax / kMin : 4), t / 10));
console.log('\nimplied deduction X(g) as a FRACTION OF BUY ORDERS, per candidate scale k:');
console.log('good           sell     buy   ' + ks.map((k, i) => ('k' + i).padStart(7)).join(''));
for (const g of test.sort((x, y) => OB[y].sell - OB[x].sell)) {
  const line = ks.map(k => { const X = OB[g].sell - A[g] / (k * P(g)); return (X / OB[g].buy).toFixed(2).padStart(7); }).join('');
  console.log(`${g.padEnd(14)}${OB[g].sell.toFixed(0).padStart(7)}${OB[g].buy.toFixed(0).padStart(8)}   ${line}`);
}
console.log('\nk values: ' + ks.map((k, i) => `k${i}=${k.toExponential(3)}`).join('  '));
