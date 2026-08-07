// predict_good_demand.mjs — PREDICTED vs MEASURED pop demand for one good, in UNITS.
//
//   node tools/testbed/predict_good_demand.mjs <melt> <weights.tsv> <bgoods.tsv> <markets_all.tsv>
//        <good> [--market "American Market"] [--probe STATE_NEW_YORK] [--date 1904.1.1] [--run 1]
//
// ⭐ WHY UNITS AND NOT SHARES. A purchase weight is an intermediate; it can exceed 1 and means nothing on
// its own. The end product is how many units of a good the pops of a market buy, and that is what a
// measurement has to be put beside (user, 2026-08-07).
//
//   units(good) = SUM over pops, over the needs that good belongs to:
//                   buy_package[pop wealth][need]            £ per 10 000 package-equivalents
//                 x (workforce + 0.5 x dependents) / 10 000  the pop's size in those units
//                 x purchase weight(good) / SUM purchase weights over the need   ← the SAVE's own numbers
//                 / base price(good)
//
// Everything on the right is measured: the pops (size, wealth, culture, state) and the purchase weights
// come out of the same save; the package table is `common/buy_packages`.
//
// ⚠ THE BUDGET HALF IS NOT THE PART THIS PROJECT SOLVED. F40 settled the within-need SPLIT to under 1 pp.
// The £ a need holds is the buy-package/wealth model, which still carries ~18 % error against measured
// 1836 consumption — so a level miss here is that, not the split. Reported as a ratio so the two are not
// confused.
import { createReadStream, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [MELT, WTSV, BTSV, MTSV, GOOD] = pos;
const MARKET = argOf('--market', 'American Market'), PROBE = argOf('--probe', 'STATE_NEW_YORK');
const DATE = argOf('--date', ''), RUN = argOf('--run', '1');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const DEP = +argOf('--dependent-factor', '0.5');      // DEPENDENT_CONSUMPTION_RATIO
const PKG = +argOf('--pop-size-package', '10000');    // POP_SIZE_PACKAGE
const strip = s => s.replace(/^\uFEFF/, '');

const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
// buy packages: wealth level -> { need -> £ }
const PACK = {};
for (const m of strip(readFileSync(join(GAME, 'common/buy_packages/00_buy_packages.txt'), 'utf8'))
  .matchAll(/^wealth_(\d+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
  const w = +m[1], g = {};
  const gm = /goods\s*=\s*\{([\s\S]*?)\}/.exec(m[2]);
  if (gm) for (const e of gm[1].matchAll(/popneed_([a-z_]+)\s*=\s*([\d.]+)/g)) g[e[1]] = +e[2];
  PACK[w] = g;
}
// which needs the good belongs to
const NEEDS_OF = [];
for (const m of strip(readFileSync(join(GAME, 'common/pop_needs/00_pop_needs.txt'), 'utf8')).matchAll(/^popneed_([a-z_]*)\s*=\s*\{([\s\S]*?)\n\}/gm))
  if ([...m[2].matchAll(/goods\s*=\s*([a-z_]+)/g)].some(x => x[1] === GOOD)) NEEDS_OF.push(m[1]);

// state -> market, and the market's building demand for the good
const B = readFileSync(BTSV, 'utf8').split('\n').filter(Boolean);
const bh = B[0].split('\t'), bi = Object.fromEntries(bh.map((x, i) => [x, i]));
const stateMarket = new Map(); let MID = null, bldg = 0;
for (let i = 1; i < B.length; i++) {
  const c = B[i].split('\t');
  stateMarket.set(c[bi.state], c[bi.market]);
  if (c[bi.region] === PROBE && MID === null) MID = c[bi.market];
}
for (let i = 1; i < B.length; i++) {
  const c = B[i].split('\t');
  if (c[bi.market] === MID && c[bi.good] === GOOD) bldg += +c[bi.input];
}

// purchase weights: (state, culture, need) -> { good -> pw } and the need's total
const W = readFileSync(WTSV, 'utf8').split('\n').filter(Boolean);
const wh = W[0].split('\t'), wx = Object.fromEntries(wh.map((x, i) => [x, i]));
const cellSum = new Map(), cellGood = new Map();
for (let i = 1; i < W.length; i++) {
  const c = W[i].split('\t');
  if (stateMarket.get(c[wx.state]) !== MID) continue;
  if (!NEEDS_OF.includes(c[wx.need])) continue;
  const k = c[wx.state] + '|' + c[wx.key] + '|' + c[wx.need];
  cellSum.set(k, (cellSum.get(k) || 0) + +c[wx.weight]);
  if (c[wx.good] === GOOD) cellGood.set(k, (cellGood.get(k) || 0) + +c[wx.weight]);
}

// ---- stream the melt's pop table ----
let sec = false, depth = 0, inPop = false;
let cur = null, units = 0, popsUsed = 0, moneyByNeed = {};
const flush = () => {
  if (!cur || cur.state == null || cur.wealth == null) { cur = null; return; }
  if (stateMarket.get(String(cur.state)) !== MID) { cur = null; return; }
  const size = (cur.workforce || 0) + DEP * (cur.dependents || 0);
  if (!(size > 0)) { cur = null; return; }
  const pk = PACK[cur.wealth] || {};
  for (const nd of NEEDS_OF) {
    const money = (pk[nd] || 0) * size / PKG;
    if (!(money > 0)) continue;
    moneyByNeed[nd] = (moneyByNeed[nd] || 0) + money;
    const k = cur.state + '|' + cur.culture + '|' + nd;
    const tot = cellSum.get(k), mine = cellGood.get(k);
    if (!(tot > 0) || !(mine > 0)) continue;
    units += money * (mine / tot) / (BASEP[GOOD] || 1);
  }
  popsUsed++; cur = null;
};
const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (!sec) { if (t === 'pops={') { sec = true; depth = 1; } continue; }
  const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
  const m = /^(\d+)=\{$/.exec(t);
  if (m && depth === 2) { flush(); cur = { state: null, wealth: null, culture: null, workforce: 0, dependents: 0 }; }
  else if (cur) {
    let x;
    if ((x = /^location=(\d+)$/.exec(t))) cur.state = +x[1];
    else if ((x = /^wealth=(\d+)$/.exec(t))) cur.wealth = +x[1];
    else if ((x = /^culture=(\d+)$/.exec(t))) cur.culture = +x[1];
    else if ((x = /^workforce=(\d+)$/.exec(t))) cur.workforce = +x[1];
    else if ((x = /^dependents=(\d+)$/.exec(t))) cur.dependents = +x[1];
  }
  depth += o - c;
  if (depth <= 0) { flush(); break; }
}

// ---- measured ----
const M = readFileSync(MTSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
let buy = null, sell = null, exp = 0;
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.run_index] !== RUN || c[mi.tag] !== MARKET || c[mi.good] !== GOOD) continue;
  if (DATE && c[mi.dump_date] !== DATE) continue;
  buy = +c[mi.buy_orders]; sell = +c[mi.sell_orders]; exp = +c[mi.exports];
  if (DATE) break;
}
// ⚠ EXPORTS ARE IN THE BUY ORDERS. A good leaving the market is demand on that market, so pop demand is
// buy − building input − exports. Missing this made automobiles read 0.447 of prediction at 1920 where
// every low-export good read ~1.0 — the 4 092 units the USA exported were being charged to its pops.
const measured = buy == null ? null : buy - bldg - exp;
const fmt = v => v == null ? '—' : v.toFixed(1);
console.log([DATE || '?', GOOD, MARKET, fmt(measured), fmt(units), measured ? (units / measured).toFixed(3) : '—',
  fmt(buy), fmt(bldg), fmt(exp), fmt(sell), popsUsed, NEEDS_OF.join('+'),
  Object.entries(moneyByNeed).map(([k, v]) => k + '=£' + v.toFixed(0)).join(' ')].join('\t'));
