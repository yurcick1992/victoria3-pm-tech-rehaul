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
// ⭐ consumption_mult from common/pop_types. Peasants allocate a full need budget but only a fraction of
// it becomes MARKET demand — the rest is met inside the subsistence building (F41, confirmed in game).
const CLASSMULT = { peasants: +argOf('--peasant-mult', '1') };
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
const unitsByNeed = {}, goodMoneyByNeed = {}, byCell = new Map(); let example = null;
const flush = () => {
  if (!cur || cur.state == null || cur.wealth == null) { cur = null; return; }
  if (stateMarket.get(String(cur.state)) !== MID) { cur = null; return; }
  const size = (cur.workforce || 0) + DEP * (cur.dependents || 0);
  if (!(size > 0)) { cur = null; return; }
  const pk = PACK[cur.wealth] || {};
  const cm = CLASSMULT[cur.type] != null ? CLASSMULT[cur.type] : 1;
  for (const nd of NEEDS_OF) {
    const money = (pk[nd] || 0) * size / PKG * cm;
    if (!(money > 0)) continue;
    moneyByNeed[nd] = (moneyByNeed[nd] || 0) + money;
    const k = cur.state + '|' + cur.culture + '|' + nd;
    const tot = cellSum.get(k), mine = cellGood.get(k);
    if (!(tot > 0) || !(mine > 0)) continue;
    const gm = money * (mine / tot), u = gm / (BASEP[GOOD] || 1);
    units += u;
    unitsByNeed[nd] = (unitsByNeed[nd] || 0) + u;
    goodMoneyByNeed[nd] = (goodMoneyByNeed[nd] || 0) + gm;
    const ck = nd + "|" + cur.state + "|" + cur.culture;
    const e = byCell.get(ck) || { money: 0, units: 0, pw: mine, tot: tot }; e.money += money; e.units += u; byCell.set(ck, e);
    if (!example && nd === NEEDS_OF[0] && size > 3000) example = { wealth: cur.wealth, size, wf: cur.workforce, dep: cur.dependents, state: cur.state, culture: cur.culture, pkg: pk[nd], money, mine, tot, gm, u };
  }
  popsUsed++; cur = null;
};
const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (!sec) { if (t === 'pops={') { sec = true; depth = 1; } continue; }
  const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
  const m = /^(\d+)=\{$/.exec(t);
  if (m && depth === 2) { flush(); cur = { state: null, wealth: null, culture: null, workforce: 0, dependents: 0, type: null }; }
  else if (cur) {
    let x;
    if ((x = /^location=(\d+)$/.exec(t))) cur.state = +x[1];
    else if ((x = /^wealth=(\d+)$/.exec(t))) cur.wealth = +x[1];
    else if ((x = /^culture=(\d+)$/.exec(t))) cur.culture = +x[1];
    else if ((x = /^workforce=(\d+)$/.exec(t))) cur.workforce = +x[1];
    else if ((x = /^dependents=(\d+)$/.exec(t))) cur.dependents = +x[1];
    else if ((x = /^type="([a-z_]+)"$/.exec(t))) cur.type = x[1];
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

if (args.includes('--explain')) {
  console.log('');
  console.log('=== WHERE THE NUMBER COMES FROM ===');
  console.log('good: ' + GOOD + '  base price £' + BASEP[GOOD] + '   needs it belongs to: ' + NEEDS_OF.join(', '));
  console.log('pops of this market with a size and a wealth level: ' + popsUsed);
  console.log('');
  console.log('need              pop money £   -> to ' + GOOD + ' £   effective share      units = £/' + BASEP[GOOD]);
  let tm = 0, tg = 0, tu = 0;
  for (const nd of NEEDS_OF) {
    const m = moneyByNeed[nd] || 0, g = goodMoneyByNeed[nd] || 0, u = unitsByNeed[nd] || 0;
    tm += m; tg += g; tu += u;
    console.log(nd.padEnd(17) + m.toFixed(0).padStart(11) + g.toFixed(0).padStart(14) + ((g / m * 100).toFixed(2) + '%').padStart(16) + u.toFixed(1).padStart(20));
  }
  console.log('TOTAL'.padEnd(17) + tm.toFixed(0).padStart(11) + tg.toFixed(0).padStart(14) + ((tg / tm * 100).toFixed(2) + '%').padStart(16) + tu.toFixed(1).padStart(20));
  console.log('');
  console.log('=== the ten (state, culture) cells contributing most, and their stored weights ===');
  const top = [...byCell].sort((a, b) => b[1].units - a[1].units).slice(0, 10);
  console.log('need            state  culture |   money £ |  pw(' + GOOD + ') |  sum pw |   share |   units');
  for (const [k, v] of top) {
    const [nd, st, cu] = k.split('|');
    console.log(nd.padEnd(15) + st.padStart(6) + cu.padStart(9) + ' |' + v.money.toFixed(0).padStart(10) + ' |' +
      v.pw.toFixed(5).padStart(12) + ' |' + v.tot.toFixed(5).padStart(9) + ' |' + ((v.pw / v.tot * 100).toFixed(2) + '%').padStart(8) + ' |' + v.units.toFixed(1).padStart(8));
  }
  if (example) {
    console.log('');
    console.log('=== one pop, all the way through (' + NEEDS_OF[0] + ') ===');
    console.log('  workforce ' + example.wf + ' + 0.5 x ' + example.dep + ' dependents = ' + example.size.toFixed(1) + ' package-equivalents');
    console.log('  wealth level ' + example.wealth + ' -> buy_package popneed_' + NEEDS_OF[0] + ' = £' + example.pkg);
    console.log('  money  = £' + example.pkg + ' x ' + example.size.toFixed(1) + ' / 10000            = £' + example.money.toFixed(2));
    console.log('  share  = ' + example.mine.toFixed(5) + ' / ' + example.tot.toFixed(5) + ' (state ' + example.state + ', culture ' + example.culture + ') = ' + (example.mine / example.tot * 100).toFixed(2) + '%');
    console.log('  spend  = £' + example.money.toFixed(2) + ' x ' + (example.mine / example.tot).toFixed(5) + '           = £' + example.gm.toFixed(2));
    console.log('  units  = £' + example.gm.toFixed(2) + ' / £' + BASEP[GOOD] + '                        = ' + example.u.toFixed(4) + ' ' + GOOD);
  }
}
