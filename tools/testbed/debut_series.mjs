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

console.log(`\n=== 1. THE ORDER BOOK, both goods, raw units ===`);
console.log(`date        | ${GOOD.padEnd(9)} sell     buy  bldgs  residual | ${RIVAL.padEnd(9)} sell     buy   bldgs  residual`);
for (const x of rows)
  console.log(`${x.date.padEnd(11)} | ${' '.repeat(10)}${f(x.g.sell, 8, 1)}${f(x.g.buy, 8, 1)}${f(x.npG, 7, 0)}${f(x.g.buy - x.npG - x.g.exports, 10, 1)} |` +
    `${' '.repeat(10)}${f(x.r.sell, 8, 0)}${f(x.r.buy, 8, 0)}${f(x.npR, 8, 0)}${f(x.r.buy - x.npR - x.r.exports, 10, 0)}`);

console.log(`\n=== 2. THE SAME TWO GOODS AS RESIDUAL DEMAND VALUED AT BASE PRICE (£) ===`);
console.log(`  the shares below are of VALUE, so this is the quantity they are shares of`);
console.log(`date        | ${GOOD.padEnd(14)} £ | ${RIVAL.padEnd(14)} £ |  ${GOOD}'s % of the two`);
for (const x of rows) {
  const vg = (x.g.buy - x.npG - x.g.exports) * bg, vr = (x.r.buy - x.npR - x.r.exports) * br;
  console.log(`${x.date.padEnd(11)} | ${f(vg, 16, 0)} | ${f(vr, 16, 0)} | ${pc(vg / (vg + vr), 20)}`);
}

console.log(`\n=== 3. WHAT SHARE OF THE NEED ${GOOD.toUpperCase()} GETS, step by step ===`);
console.log(`date        | naive unit | + valued at | + ${RIVAL} seen | x prestige |  OBSERVED  | vs the`);
console.log(`            | supply share| base price  |    LOCALLY     |  (measured)| (from save)| 25% line`);
for (const x of rows) {
  const naive = x.g.sell + x.r.sell > 0 ? x.g.sell / (x.g.sell + x.r.sell) : 0;
  const aG = Math.max(0, x.g.sell - 0.5 * x.npG) * bg;
  const aRm = Math.max(0, x.r.sell - 0.5 * x.npR) * br;
  const eff = x.ownS + 0.25 * x.prodR;
  const aRl = Math.max(0, eff - 0.5 * x.ownNP) * br;
  const local = aG + aRl > 0 ? aG / (aG + aRl) : 0;
  console.log(`${x.date.padEnd(11)} | ${pc(naive, 11)} | ${pc(aG + aRm > 0 ? aG / (aG + aRm) : 0, 11)} | ${pc(local, 14)} | ` +
    `${pc(local * (1 + 0.5 * x.prestG), 10)} | ${pc(x.sG, 10)} | ${x.sG > 0.25 ? 'ABOVE' : 'below'}`);
}
console.log(`\n=== 4. BOTH GOODS' STORED SHARES (they are what the game actually used) ===`);
console.log(`date        | ${GOOD.padEnd(14)} | ${RIVAL.padEnd(14)} |  sum  | ${GOOD} prestige share of supply`);
for (const x of rows)
  console.log(`${x.date.padEnd(11)} | ${pc(x.sG, 14)} | ${pc(x.sR, 14)} | ${pc(x.sG + x.sR, 6)} | ${pc(x.prestG, 12)}`);
console.log(`\n"the 25% line" = what ${RIVAL}'s max_supply_share of 0.75 would leave if the cap bound and the`);
console.log(`complement were handed over. It is not a rule — it is the quantity F37 tested and rejected.`);
