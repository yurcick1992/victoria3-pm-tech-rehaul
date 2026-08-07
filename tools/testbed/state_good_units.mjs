// state_good_units.mjs — pop demand for a good, PER STATE, in ABSOLUTE UNITS, under two readings of the
// split beside the game's own.
//
//   node tools/testbed/state_good_units.mjs <melt> --cells old.tsv,new.tsv [--cells old2.tsv,new2.tsv ...]
//        --states STATE_NEW_YORK,STATE_TEXAS --goods automobiles,transportation [--peasant-mult 0.05]
//
// WHY THIS EXISTS. A share says how a need's money divides; it does not say how much of anything anyone
// buys, and two goods with the same share can differ by two orders of magnitude in units. A pp error says
// even less. This prints the three quantities a reader actually wants side by side:
//
//   OLD    units under our pre-F43 split (local goods at full market supply)
//   NEW    units under the shipped split (local goods at 0.40)
//   GAME   units under the purchase weights THE SAVE ITSELF STORES
//
// ⭐ THE BUDGET TERM IS IDENTICAL IN ALL THREE COLUMNS. Every column multiplies the same per-pop money by
// a different split of it, so the comparison isolates the split — which is the only thing F43 changed. The
// budget's own ~18 % error against measured consumption (F24) therefore CANNOT flatter or damage the
// comparison; it shifts all three columns together. That also means GAME is not an independent
// order-book measurement: it is the game's own stored split applied to the game's own pops. The
// order-book measurement exists only at MARKET level (buy − building input − exports, F42), because that
// is the only level at which an order book exists.
//
//   units(state, good) = SUM over pops in that state, over needs containing the good:
//       buy_package[wealth][need] x (workforce + 0.5 x dependents) / 10 000 x consumption_mult
//       x  purchase weight(good) / SUM purchase weights over the need's goods in that cell
//       /  base price(good)
//
// ⚠ The peasant multiplier defaults to 0.05, not 1: F41 confirmed in game that a peasant allocates a full
// need budget but only 5 % of it reaches the market. It cancels out of OLD-vs-NEW, but it sets the LEVEL,
// and a level 1.4-2.2x too high is what F42 measured without it.
import { readFileSync, createReadStream, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const allOf = n => args.reduce((a, x, i) => (x === n && args[i + 1] ? a.concat(args[i + 1]) : a), []);
const MELT = pos[0];
const CELLSETS = allOf('--cells').map(s => s.split(','));
const STATES = argOf('--states', '').split(',').filter(Boolean);
const GOODS = argOf('--goods', '').split(',').filter(Boolean);
const PEAS = +argOf('--peasant-mult', '0.05');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const DEP = 0.5, PKG = 10000;
if (!MELT || !CELLSETS.length) { console.error('usage: state_good_units.mjs <melt> --cells old.tsv,new.tsv [...] --states A,B --goods x,y'); process.exit(1); }

const strip = s => s.replace(/^\uFEFF/, '');
const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
const PACK = {};
for (const m of strip(readFileSync(join(GAME, 'common/buy_packages/00_buy_packages.txt'), 'utf8'))
  .matchAll(/^wealth_(\d+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
  const w = +m[1], g = {};
  const gm = /goods\s*=\s*\{([\s\S]*?)\}/.exec(m[2]);
  if (gm) for (const e of gm[1].matchAll(/popneed_([a-z_]+)\s*=\s*([\d.]+)/g)) g[e[1]] = +e[2];
  PACK[w] = g;
}

// ---- cells: (state|culture|need) -> { good -> {old,new,obs} }, merged across markets.
// States are disjoint between markets, so merging several dumps cannot collide.
const CELL = new Map(), stateRegion = new Map(), wantState = new Set();
const rdCells = (path, slot) => {
  const L = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const h = L[0].split('\t'), ix = Object.fromEntries(h.map((x, i) => [x, i]));
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split('\t');
    stateRegion.set(c[ix.state], c[ix.region]);
    if (STATES.length && !STATES.includes(c[ix.region])) continue;
    wantState.add(c[ix.state]);
    const k = c[ix.state] + '|' + c[ix.culture] + '|' + c[ix.need];
    if (!CELL.has(k)) CELL.set(k, {});
    const e = (CELL.get(k)[c[ix.good]] = CELL.get(k)[c[ix.good]] || { w: +c[ix.w], old: 0, new: 0, obs: 0 });
    e[slot] = +c[ix.pred]; e.obs = +c[ix.obs];
  }
};
for (const [o, n] of CELLSETS) { rdCells(o, 'old'); rdCells(n, 'new'); }
// pre-sum each cell's purchase weights under each reading — the denominator of the split
const SUMS = new Map();
for (const [k, gs] of CELL) {
  const s = { old: 0, new: 0, obs: 0 };
  for (const g in gs) { s.old += gs[g].w * gs[g].old; s.new += gs[g].w * gs[g].new; s.obs += gs[g].w * gs[g].obs; }
  SUMS.set(k, s);
}
console.error(`cells: ${CELL.size} (state,culture,need) over ${wantState.size} state record(s)`);

// ---- walk the melt's pop table (same reader as predict_good_demand.mjs) ----
const OUT = new Map();                       // state|good -> {old,new,obs}
const add = (st, g, slot, v) => {
  const k = st + '|' + g; if (!OUT.has(k)) OUT.set(k, { old: 0, new: 0, obs: 0 });
  OUT.get(k)[slot] += v;
};
let sec = false, depth = 0, cur = null, popsUsed = 0;
const flush = () => {
  if (!cur || cur.state == null || cur.wealth == null) { cur = null; return; }
  const st = String(cur.state);
  if (!wantState.has(st)) { cur = null; return; }
  const size = (cur.workforce || 0) + DEP * (cur.dependents || 0);
  if (!(size > 0)) { cur = null; return; }
  const pk = PACK[cur.wealth] || {};
  const cm = cur.type === 'peasants' ? PEAS : 1;
  for (const nd in pk) {
    const money = pk[nd] * size / PKG * cm;
    if (!(money > 0)) continue;
    const k = st + '|' + cur.culture + '|' + nd, gs = CELL.get(k), sums = SUMS.get(k);
    if (!gs || !sums) continue;
    for (const g of GOODS) {
      const e = gs[g]; if (!e) continue;
      const bp = BASEP[g] || 1;
      for (const slot of ['old', 'new', 'obs'])
        if (sums[slot] > 0) add(st, g, slot, money * (e.w * e[slot] / sums[slot]) / bp);
    }
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
console.error(`pops used: ${popsUsed}`);

// ⚠ Several STATE RECORDS can share a region (a split state owned by two countries), so sum to the region
// before printing — a region-keyed reader that kept only the last record was a real bug once (F40).
const byRegion = new Map();
for (const [k, v] of OUT) {
  const [st, g] = k.split('|');
  const rk = (stateRegion.get(st) || st) + '\t' + g;
  const e = byRegion.get(rk) || { old: 0, new: 0, obs: 0 };
  e.old += v.old; e.new += v.new; e.obs += v.obs; byRegion.set(rk, e);
}
console.log(['region', 'good', 'OLD_units', 'NEW_units', 'GAME_units', 'old/game', 'new/game'].join('\t'));
for (const [k, v] of [...byRegion].sort())
  console.log(`${k}\t${v.old.toFixed(1)}\t${v.new.toFixed(1)}\t${v.obs.toFixed(1)}\t` +
    `${v.obs > 0 ? (v.old / v.obs).toFixed(3) : '-'}\t${v.obs > 0 ? (v.new / v.obs).toFixed(3) : '-'}`);
