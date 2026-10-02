// THE POP-GOODS PRICE INDEX, GOOD BY GOOD AND MARKET BY MARKET (promoted from the session scratchpad 2026-10-02; FINDINGS F209 quotes it).
// The register's PP is one median over markets; this splits it: per market and good, an arm's price ÷ base (pounds) beside vanilla's, and the
// arm's price in WAGE UNITS (÷ the market owner's normal wage) ÷ vanilla's — at 1900 / 1920 / 1935, medians over each side's runs. Read
// straight from markets.tsv and the yearly summaries' base_wage, the sources criteria.mjs's PP uses. Vanilla = the pinned n=16 baseline.
//   node tools/testbed/ledger/pp_goods.mjs --arm label:session[:setup] [--markets "British Market,American Market,French Market"]
//   ⚠ Markets resolve by NAME to a leader tag (MKT below); a German market under another name (NGF/PRU) needs its name in --markets.
import path from 'node:path'; import fs from 'node:fs';
import { indexRun, readSum, runsOf, firstOf, med, ROOT } from './lib_sumidx.mjs';
const args = process.argv.slice(2); const all = n => args.flatMap((a, i) => a === n ? [args[i + 1]] : []);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const GOODS = ['groceries', 'clothes', 'furniture', 'glass', 'fine_art', 'automobiles', 'telephones', 'radios', 'tools', 'steel', 'paper'];
const BASE = Object.fromEntries(fs.readFileSync(path.join(ROOT, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));
const MKT = { 'British Market': 'GBR', 'American Market': 'USA', 'French Market': 'FRA', 'German Market': 'GER', 'North German Market': 'NGF', 'Prussian Market': 'PRU', 'Dutch Market': 'NET' };
const YEARS = [1900, 1920, 1935];
const MARKETS = argOf('--markets', process.env.MK || 'British Market,American Market,French Market').split(',');
function read(sess, setup) {
  const out = [];   // per run: { [y]: { [market]: { wage, [good]: price } } }
  for (const r of runsOf(sess, setup || null)) { const f = path.join(r, 'markets.tsv'); if (!fs.existsSync(f)) continue; const idx = indexRun(r); const R = {};
    const rows = fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(1).map(l => l.split('\t')).filter(c => c.length > 7);
    for (const y of YEARS) { const d = firstOf(idx, y); if (!d) continue; const j = readSum(idx[d]); R[y] = {};
      for (const c of rows) { if (!c[1].startsWith(y + '.')) continue; const tag = MKT[c[2]]; if (!tag) continue; const C = j.countries?.[tag]; const w = +C?.base_wage; if (!(w > 0)) continue;
        const M = R[y][c[2]] ??= { wage: w }; if (GOODS.includes(c[4])) M[c[4]] = +c[7]; } }
    out.push(R); }
  return out;
}
if (!all('--arm').length) { console.error('usage: pp_goods.mjs --arm label:session[:setup] [--markets a,b]'); process.exit(1); }
const [, aSess, aSetup] = all('--arm')[0].split(':');
const arm = read(aSess, aSetup); const van = read('20260821_131149_vanilla-baseline-n16', null);
console.log(`pop goods: arm (${arm.length} run) ÷ vanilla's median — price ÷ base in pounds · price ÷ normal wage (wage units) · the arm's normal wage ÷ vanilla's`);
for (const y of YEARS) for (const m of MARKETS) {
  const vw = med(van.map(R => R[y]?.[m]?.wage)); const aw = med(arm.map(R => R[y]?.[m]?.wage));
  const cells = GOODS.map(g => { const ap = med(arm.map(R => R[y]?.[m]?.[g])), vp = med(van.map(R => R[y]?.[m]?.[g]));
    return `${g.slice(0, 9)} ${Number.isFinite(ap) ? (ap / BASE[g]).toFixed(2) : ' - '}/${Number.isFinite(vp) ? (vp / BASE[g]).toFixed(2) : ' - '}→${Number.isFinite(ap / aw / (vp / vw)) ? (ap / aw / (vp / vw)).toFixed(2) : ' - '}`; });
  console.log(`${y} ${m.padEnd(16)} wage ${aw ? (aw / 1e4).toFixed(4) : '-'} vs ${vw ? (vw / 1e4).toFixed(4) : '-'} (${(aw / vw).toFixed(2)}×)  ` + cells.join('  '));
}
