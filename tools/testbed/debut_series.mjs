// debut_series.mjs — a time series of a debut good and its need-mate, in RAW QUANTITIES.
//
//   node tools/testbed/debut_series.mjs <session> <need> <good> <rival> [--market "American Market"]
//        [--probe STATE_NEW_YORK] [--work tools/testbed/_score_work]
//
// ⭐ WHY RAW, NOT A RATIO (CLAUDE.md, "a reported ratio carries its own numerator and denominator"). The
// automobile story reads backwards as a ratio: what looks like a newcomer displacing an incumbent is
// mostly the incumbent's EFFECTIVE supply being small, and the newcomer's price being high. Both terms
// have to be on the page or the reader cannot see which one moved.
//
// Pop demand is not logged directly by this run's telemetry (metric `market_goods_scoped` only), so it is
// taken as a RESIDUAL: market buy orders − every building's input demand − exports. The building term is
// summed from each save's own `input_goods`, so it is measured rather than modelled. ⚠ The residual still
// contains the slave-basket channel and anything else non-building; at these volumes that is small, and it
// is labelled as a residual rather than as "pop demand" wherever it matters.
import { readFileSync, readdirSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [SESSION, NEED, GOOD, RIVAL] = pos;
const MARKET = argOf('--market', 'American Market'), PROBE = argOf('--probe', 'STATE_NEW_YORK');
const WORK = argOf('--work', 'tools/testbed/_score_work');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const strip = s => s.replace(/^\uFEFF/, '');

const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
const LOCAL = new Set(['services', 'transportation', 'electricity']);

// order book, all dump dates
const M = readFileSync(join(SESSION, 'markets_all.tsv'), 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = new Map();
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.tag] !== MARKET) continue;
  OB.set(c[mi.dump_date] + '|' + c[mi.good], {
    buy: +c[mi.buy_orders], sell: +c[mi.sell_orders], price: +c[mi.price],
    imports: +c[mi.imports], exports: +c[mi.exports], production: +c[mi.production],
  });
}

// every extracted gamestate in the work dir
const stems = [...new Set(readdirSync(WORK).filter(f => f.endsWith('.weights.tsv')).map(f => f.replace('.weights.tsv', '')))];
const rows = [];
for (const stem of stems) {
  const wf = join(WORK, stem + '.weights.tsv'), bf = join(WORK, stem + '.bgoods.tsv');
  if (!existsSync(wf) || !existsSync(bf)) continue;
  // the gamestate's date: the melt is deleted after scoring, so take it from the archive name via the
  // one place it survives — the weights file has none, so fall back to matching a dump date by content.
  const B = readFileSync(bf, 'utf8').split('\n').filter(Boolean);
  const bh = B[0].split('\t'), bi = Object.fromEntries(bh.map((x, i) => [x, i]));
  let mid = null;
  const np = new Map(), prodM = new Map(), prestP = new Map(); let ownS = 0, ownNP = 0;
  for (let i = 1; i < B.length; i++) {
    const c = B[i].split('\t');
    if (c[bi.region] === PROBE && mid === null) mid = c[bi.market];
  }
  for (let i = 1; i < B.length; i++) {
    const c = B[i].split('\t');
    if (c[bi.market] === mid) {
      np.set(c[bi.good], (np.get(c[bi.good]) || 0) + +c[bi.input]);
      prodM.set(c[bi.good], (prodM.get(c[bi.good]) || 0) + +c[bi.output]);
      prestP.set(c[bi.good], (prestP.get(c[bi.good]) || 0) + +(c[bi.prestige_out] || 0));
    }
    if (c[bi.region] === PROBE && c[bi.good] === RIVAL) { ownS += +c[bi.output]; ownNP += +c[bi.input]; }
  }
  // ⚠ the gamestate's date comes from the MELT, not from a heuristic. Matching a save to a dump date by
  // "whose production is closest" would silently pair a save with the wrong month whenever production is
  // flat, which is exactly when a debut series is most delicate.
  const mf = join(WORK, stem + '.melted.txt');
  if (!existsSync(mf)) continue;
  const fd = openSync(mf, 'r'), buf = Buffer.alloc(3000);
  readSync(fd, buf, 0, 3000, 0); closeSync(fd);
  const head = buf.toString('utf8');
  const dm = /^date=(\d+\.\d+\.\d+)/m.exec(head);
  if (!dm) continue;
  const best = dm[1];
  if (!OB.has(best + '|' + RIVAL)) { console.error(`(no telemetry dump at ${best} — skipped)`); continue; }
  // the stored share, from the save, for the probe state
  const W = readFileSync(wf, 'utf8').split('\n').filter(Boolean);
  const wh = W[0].split('\t'), wx = Object.fromEntries(wh.map((x, i) => [x, i]));
  let sG = null, sR = null;
  for (let i = 1; i < W.length; i++) {
    const c = W[i].split('\t');
    if (c[wx.region] !== PROBE || c[wx.need] !== NEED) continue;
    if (c[wx.good] === GOOD && sG === null) sG = +c[wx.share];
    if (c[wx.good] === RIVAL && sR === null) sR = +c[wx.share];
  }
  // ⚠ a good that has never traded has NO row in the order book. That is a real zero, not missing data —
  // and dropping the date would delete exactly the pre-debut baseline the series exists to show.
  const ZERO = { buy: 0, sell: 0, price: 0, imports: 0, exports: 0, production: 0 };
  const g = OB.get(best + '|' + GOOD) || ZERO, r = OB.get(best + '|' + RIVAL);
  if (!r) continue;
  const prestG = (prodM.get(GOOD) || 0) > 0 ? (prestP.get(GOOD) || 0) / (prodM.get(GOOD) || 1) : 0;
  rows.push({ date: best, g, r, npG: np.get(GOOD) || 0, npR: np.get(RIVAL) || 0, sG, sR, ownS, ownNP, prodR: r.production, prestG });
}
rows.sort((a, b) => a.date.split('.').map(Number).reduce((x, y, i) => x + y / Math.pow(100, i), 0)
  - b.date.split('.').map(Number).reduce((x, y, i) => x + y / Math.pow(100, i), 0));

const f = (v, w = 9, d = 0) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d)).padStart(w);
const pc = (v, w = 7) => (v == null || Number.isNaN(v) ? '—' : (v * 100).toFixed(2) + '%').padStart(w);
const bg = BASEP[GOOD], br = BASEP[RIVAL];

console.log(`\n${MARKET} · ${PROBE} · popneed_${NEED} · base prices: ${GOOD} £${bg}, ${RIVAL} £${br}` +
  (LOCAL.has(RIVAL) ? `   (⚠ ${RIVAL} is a LOCAL good)` : ''));

// per-need prestige increase and the entry bounds, so the last two steps are not hand-waved
const PN = {};
for (const m of strip(readFileSync(join(GAME, 'common/pop_needs/00_pop_needs.txt'), 'utf8')).matchAll(/^popneed_([a-z_]*)\s*=\s*\{([\s\S]*?)\n\}/gm)) {
  const b = m[2], e = {};
  for (const x of b.matchAll(/entry\s*=\s*\{([\s\S]*?)\}/g)) {
    const g = /goods\s*=\s*([a-z_]+)/.exec(x[1]); if (!g) continue;
    e[g[1]] = { max: +(/max_supply_share\s*=\s*([\d.]+)/.exec(x[1])?.[1] ?? 1), min: +(/min_supply_share\s*=\s*([\d.]+)/.exec(x[1])?.[1] ?? 0) };
  }
  PN[m[1]] = { e, prestige: +(/prestige_goods_demand_increase\s*=\s*([\d.]+)/.exec(b)?.[1] ?? 0.5) };
}
const ND = PN[NEED] || { e: {}, prestige: 0.5 };
const eG = ND.e[GOOD] || { max: 1, min: 0 }, eR = ND.e[RIVAL] || { max: 1, min: 0 };

console.log(`\n=== 1. ${GOOD.toUpperCase()} — every number MEASURED, then the one derived quantity ===`);
console.log(`  tradeable, so its availability uses the MARKET's sell orders and the MARKET's building demand`);
console.log(`date        |   sell |    buy |  bldg |  sell-0.5*bldg |  x £${bg} = availability`);
for (const x of rows) {
  const u = Math.max(0, x.g.sell - 0.5 * x.npG);
  console.log(`${x.date.padEnd(11)} |${f(x.g.sell, 8, 1)} |${f(x.g.buy, 7, 1)} |${f(x.npG, 6, 0)} |${f(u, 15, 1)} |${f(u * bg, 16, 0)}`);
}

console.log(`\n=== 2. ${RIVAL.toUpperCase()} — same, but it is a ${LOCAL.has(RIVAL) ? 'LOCAL' : 'tradeable'} good ===`);
if (LOCAL.has(RIVAL)) {
  console.log(`  so the state sees its OWN supply + 0.25 x the market's production, and deducts its OWN`);
  console.log(`  building demand (LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR = 0.25, state GDP share taken as 0)`);
  console.log(`date        | mkt sell | mkt prod | ${PROBE.replace('STATE_', '').slice(0, 8).padEnd(8)} own | own bldg |  own+0.25*prod | -0.5*bldg | x £${br} = avail`);
  for (const x of rows) {
    const eff = x.ownS + 0.25 * x.prodR, u = Math.max(0, eff - 0.5 * x.ownNP);
    console.log(`${x.date.padEnd(11)} |${f(x.r.sell, 9, 0)} |${f(x.prodR, 9, 0)} |${f(x.ownS, 12, 0)} |${f(x.ownNP, 9, 0)} |${f(eff, 15, 0)} |${f(u, 10, 0)} |${f(u * br, 15, 0)}`);
  }
} else {
  console.log(`date        |   sell |    buy |  bldg |  sell-0.5*bldg |  x £${br} = availability`);
  for (const x of rows) {
    const u = Math.max(0, x.r.sell - 0.5 * x.npR);
    console.log(`${x.date.padEnd(11)} |${f(x.r.sell, 8, 0)} |${f(x.r.buy, 7, 0)} |${f(x.npR, 6, 0)} |${f(u, 15, 0)} |${f(u * br, 16, 0)}`);
  }
}

console.log(`\n=== 3. THE FORMULA, END TO END — nothing here is fitted ===`);
console.log(`  raw = avail(${GOOD}) / (avail(${GOOD}) + avail(${RIVAL}));  clamp to [${eG.min}, ${eG.max}];  x (1 + ${ND.prestige} x prestige share)`);
console.log(`date        | avail ${GOOD.slice(0, 6).padEnd(6)} £ | avail ${RIVAL.slice(0, 6).padEnd(6)} £ |    raw | clamped | prestige |  PREDICTED |  OBSERVED | miss`);
for (const x of rows) {
  const aG = Math.max(0, x.g.sell - 0.5 * x.npG) * bg;
  const eff = x.ownS + 0.25 * x.prodR;
  const aR = LOCAL.has(RIVAL) ? Math.max(0, eff - 0.5 * x.ownNP) * br : Math.max(0, x.r.sell - 0.5 * x.npR) * br;
  const raw = aG + aR > 0 ? aG / (aG + aR) : 0;
  const cl = Math.min(Math.max(raw, eG.min), eG.max);
  const mult = 1 + ND.prestige * x.prestG;
  const pred = cl * mult;
  console.log(`${x.date.padEnd(11)} |${f(aG, 15, 0)} |${f(aR, 15, 0)} |${pc(raw, 7)} |${pc(cl, 8)} |${('x' + mult.toFixed(2)).padStart(9)} |${pc(pred, 11)} |${pc(x.sG, 10)} |${((pred - x.sG) * 100).toFixed(2).padStart(6)} pp`);
}

console.log(`\n=== 4. THE RIVAL'S OWN SHARE, and what the pair sums to ===`);
console.log(`  ${RIVAL}'s max_supply_share is ${eR.max}. If the cap's complement were handed to the newcomer,`);
console.log(`  the pair would always sum to 1 — watch the pre-debut row.`);
console.log(`date        | ${GOOD.padEnd(14)} | ${RIVAL.padEnd(14)} |  sum   | ${GOOD} prestige share of supply`);
for (const x of rows)
  console.log(`${x.date.padEnd(11)} | ${pc(x.sG, 14)} | ${pc(x.sR, 14)} | ${pc(x.sG + x.sR, 6)} | ${pc(x.prestG, 12)}`);
console.log(`\n"the 25% line" = what ${RIVAL}'s max_supply_share of 0.75 would leave if the cap bound and the`);
console.log(`complement were handed over. It is not a rule — it is the quantity F37 tested and rejected.`);
