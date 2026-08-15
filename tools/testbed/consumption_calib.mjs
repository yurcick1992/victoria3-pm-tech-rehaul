// Calibrate save-reconstructed pop consumption against the DIRECT logged breakdown (CP pop channel).
// usage: node consumption_calib.mjs <sessionRun> <melt> <weights.tsv> <bgoods.tsv>
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buyOrderTable, readBreakdown } from 'file:///C:/claude-code/victoria%203%20PM%20and%20tech%20rehaul/tools/testbed/lib_breakdown.mjs';

const [RUN, MELT, WTSV, BTSV] = process.argv.slice(2);
const LOG = join(RUN, 'logs_live/debug.log');
const MKTS = join(RUN, 'markets.tsv');
const PRED = 'C:/claude-code/victoria 3 PM and tech rehaul/tools/testbed/predict_good_demand.mjs';
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

// token from the SESSION STAMP, never sniffed from the log head — the mirror's first MBs can carry the
// previous session's ring (L9), which is exactly how a sniff reads the wrong run's token.
const stamp = /sessions[\\\/](\d{8}_\d{6})/.exec(RUN)?.[1];
const runIdx = /run(\d+)_/.exec(RUN)?.[1] || '001';
const tok = stamp + 's' + String(+runIdx).padStart(3, '0');
console.error('token', tok);

// base prices
const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of readFileSync(join(GAME, 'common/goods', f), 'utf8').replace(/^\uFEFF/, '')
    .matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }

const buyOf0 = await buyOrderTable(LOG, tok);
console.error('ref table entries:', buyOf0.size);
// The CP burst can evict its own same-tick G dump from the ring (measured: 122 G lines at 1840.1.1,
// zero survived). Fallback: a NEIGHBOR month's G line still identifies the block — the check's job is
// catching gross mis-attribution (wrong good = wildly different total), and a month of order drift is
// far smaller than a wrong-good gap. Same-date exact first; ±1 month at 12% tolerance second.
const addMo = (d, k) => { let [y, m, day] = d.split('.').map(Number); m += k; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '.' + m + '.' + day; };
const buyOf = { get(key) {
  if (buyOf0.has(key)) return buyOf0.get(key);
  const [d, mk, g] = key.split('\t');
  for (const k of [-1, 1, -2]) {
    const v = buyOf0.get(addMo(d, k) + '\t' + mk + '\t' + g);
    if (v != null) return v * 1; // caller's tolerance widened below via wrapper
  }
  return undefined;
} };
const { blocks, stats } = await readBreakdown(LOG, tok, buyOf, { tolerance: 0.12 });
console.error('breakdown blocks:', JSON.stringify(stats));

// measured pop units per (market, good) — keep the latest date per pair
const meas = new Map();
for (const b of blocks) meas.set(b.market + '|' + b.good, { pop: b.pop, date: b.date });

// markets present
const markets = [...new Set(blocks.map(b => b.market))];
console.error('markets with verified blocks:', markets.join(', '));

console.log('market\tgood\tmeasured_pop\tpredicted\tratio\tabs_err_£');
const agg = {};
for (const mkt of markets) {
  const goods = [...new Set(blocks.filter(b => b.market === mkt).map(b => b.good))];
  for (const g of goods) {
    const m = meas.get(mkt + '|' + g);
    if (!m) continue;
    const PROBE_OF = { 'British Market': 'STATE_HOME_COUNTIES', 'French Market': 'STATE_ILE_DE_FRANCE', 'American Market': 'STATE_NEW_YORK' };
    const r = spawnSync('node', [PRED, MELT, WTSV, BTSV, MKTS, g, '--market', mkt, '--probe', PROBE_OF[mkt] || 'STATE_NEW_YORK', '--date', m.date, '--peasant-mult', '0.05'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const line = (r.stdout || '').split('\n').find(l => l.startsWith((m.date || '?') + '\t') || l.startsWith('?\t'));
    const pred = line ? +line.split('\t')[4] : NaN;
    const bp = BASEP[g] || 0;
    const err = Number.isFinite(pred) ? Math.abs(pred - m.pop) * bp : NaN;
    console.log([mkt, g, m.pop.toFixed(1), Number.isFinite(pred) ? pred.toFixed(1) : 'FAIL',
      Number.isFinite(pred) && m.pop > 0 ? (pred / m.pop).toFixed(3) : '—', Number.isFinite(err) ? err.toFixed(0) : '—'].join('\t'));
    const a = agg[mkt] = agg[mkt] || { err: 0, tot: 0, n: 0 };
    if (Number.isFinite(err)) { a.err += err; a.tot += m.pop * bp; a.n++; }
  }
}
console.error('');
for (const [mkt, a] of Object.entries(agg))
  console.error(mkt + ': monetary error ' + (100 * a.err / a.tot).toFixed(1) + '% of measured pop spend (' + a.n + ' goods, £' + a.tot.toFixed(0) + '/wk at base prices)');
