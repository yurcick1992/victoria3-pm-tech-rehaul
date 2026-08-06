// within_need_test.mjs — the tightest possible test of the substitution rule: INSIDE ONE NEED.
//
//   node tools/testbed/within_need_test.mjs <needs.tsv> <markets_all.tsv> [--region R] [--market M] [--date D] [--run N]
//
// ⭐ WHY WITHIN A NEED. If share(need,good) = availability(good) / sum over the need, then within one
// need the observed shares ARE the availability shares, exactly, with no unknown scale at all. Testing
// there needs no cross-need linking — and cross-need linking is precisely what cannot be trusted: the
// need graph splits into components that share no good, so their relative scales are unidentified and
// a global fit silently invents one.
//
// A need qualifies when NOTHING in it is contaminated: no clamped entry, no obsessed or tabooed good,
// no local good, and sum(share) == 1 (which is what says no good in it carries a prestige multiplier).
import { readFileSync, readdirSync } from 'node:fs';
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

const M = readFileSync(MKT_TSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = {};
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.run_index] !== RUN || c[mi.dump_date] !== DATE || c[mi.tag] !== MARKET) continue;
  OB[c[mi.good]] = { buy: +c[mi.buy_orders], sell: +c[mi.sell_orders], price: +c[mi.price], imports: +c[mi.imports], exports: +c[mi.exports], production: +c[mi.production] };
}

const cands = {
  'sell': o => o.sell,
  'sell x base': (o, g) => o.sell * BASEP[g],
  'sell x current': o => o.sell * o.price,
  'production x base': (o, g) => o.production * BASEP[g],
  'production': o => o.production,
  '(sell-0.25*buy) x base': (o, g) => (o.sell - 0.25 * o.buy) * BASEP[g],
  '(sell-0.5*buy) x base': (o, g) => (o.sell - 0.5 * o.buy) * BASEP[g],
  '(sell-0.75*buy) x base': (o, g) => (o.sell - 0.75 * o.buy) * BASEP[g],
  '(sell-buy) x base': (o, g) => (o.sell - o.buy) * BASEP[g],
  '(sell-0.5*exports) x base': (o, g) => (o.sell - 0.5 * o.exports) * BASEP[g],
  '(sell+imports-exports) x base': (o, g) => (o.sell + o.imports - o.exports) * BASEP[g],
  'buy x base': (o, g) => o.buy * BASEP[g],
};

const needSum = {};
for (const r of rows) needSum[r.need] = (needSum[r.need] || 0) + r.share;
const good = [];
for (const n of [...new Set(rows.map(r => r.need))]) {
  const rs = rows.filter(r => r.need === n);
  if (rs.length < 2) continue;
  if (rs.some(r => r.clamp)) continue;
  if (rs.some(r => cult.obs.includes(r.good) || taboo.includes(r.good))) continue;
  if (rs.some(r => LOCAL.has(r.good))) continue;
  if (rs.some(r => !OB[r.good] || OB[r.good].sell <= 0)) continue;
  if (Math.abs(needSum[n] - 1) > 0.002) continue;
  good.push({ need: n, rs });
}
console.log(`${REGION} culture ${KEY} (${cult.name}) @ ${DATE} / ${MARKET}`);
console.log(`fully clean needs (no clamp, no obsession/taboo, no local good, sum(share)==1, all goods traded): ${good.map(x => x.need).join(', ') || 'NONE'}`);
for (const { need, rs } of good) console.log(`   ${need}: ${rs.map(r => r.good + '=' + r.share.toFixed(5)).join('  ')}`);

console.log('\nmean |relative error| of the predicted within-need share, per candidate:');
const scores = [];
for (const [name, f] of Object.entries(cands)) {
  let tot = 0, n = 0, det = [];
  let ok = true;
  for (const { need, rs } of good) {
    const vs = rs.map(r => f(OB[r.good], r.good));
    if (vs.some(v => !(v > 0))) { ok = false; continue; }
    const S = vs.reduce((a, b) => a + b, 0);
    let e = 0;
    for (let i = 0; i < rs.length; i++) e += Math.abs(vs[i] / S - rs[i].share);
    det.push(`${need} ${(e / rs.length * 100).toFixed(2)}%`);
    tot += e; n += rs.length;
  }
  if (!n) { console.log(`${name.padEnd(32)} (not evaluable)`); continue; }
  scores.push({ name, err: tot / n, det, ok });
  console.log(`${name.padEnd(32)} ${(tot / n * 100).toFixed(3).padStart(8)} pp   ${det.join('  ')}${ok ? '' : '  (some needs skipped: non-positive)'}`);
}
scores.sort((a, b) => a.err - b.err);
console.log(`\nbest: ${scores[0].name} at ${(scores[0].err * 100).toFixed(3)} pp mean absolute share error`);
console.log('\nper-good detail for the best candidate:');
const f = cands[scores[0].name];
for (const { need, rs } of good) {
  const vs = rs.map(r => f(OB[r.good], r.good)); const S = vs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rs.length; i++)
    console.log(`  ${need.padEnd(14)} ${rs[i].good.padEnd(12)} observed ${rs[i].share.toFixed(5)}  predicted ${(vs[i] / S).toFixed(5)}  ${((vs[i] / S - rs[i].share) * 100).toFixed(2)} pp`);
}
