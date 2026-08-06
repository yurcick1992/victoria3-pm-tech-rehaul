// exact_25pct_line.mjs — where EXACTLY does the 25% line sit, on the buy-order ratio axis?
//
//   node tools/testbed/exact_25pct_line.mjs --session <dir> [--market "British Market"]
//
// `test_cap_binding_prediction.mjs` draws its line at a flat 5.70. That is 10 × POPMIN, a deliberately
// worst-case constant, and it answers "from when is 75/25 CERTAINLY wrong" rather than "when did
// automobiles pass 25 %" (user, 2026-08-06: "what would give precisely the 25% line?").
//
// THE EXACT LINE. Automobiles are at 25 % of `free_movement` when
//     transportation_pop_money(free_movement) = 3 × automobiles_pop_money
// which in POP-DEMAND UNITS is 10 : 1, because automobiles cost £100 against transportation's £30 and
// 3 × (100/30) = 10. The table's axis is BUY ORDERS, not pop demand, so each side needs converting by
// the fraction of that good's buying which is pops:
//     transportation_BUY × fT  =  10 × automobiles_BUY × fA
//     ⇒  line  =  transportation_BUY / automobiles_BUY  =  10 × fA / fT
// Both fractions are MEASURED, from the same verified breakdown blocks, at the same date.
//
// ⚠ THIS IS THE LINE'S LOWEST POSSIBLE POSITION. It credits ALL of transportation's pop money to
// `free_movement`; whatever `popneed_communication` actually takes raises the line further, and a
// higher line means automobiles crossed 25 % EARLIER still. So `measured ratio < line` is decisive in
// the direction it is used here.
// ⚠ It can only be computed where BOTH goods have a verified block at the SAME date — three dates
// across two campaigns, because the channel split keeps transportation early and automobiles late.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buyOrderTable, readBreakdown } from './lib_breakdown.mjs';
import { REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
const MARKET  = argOf('--market', 'British Market');
if (!SESSION) { console.error('usage: exact_25pct_line.mjs --session <dir> [--market M]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));
const PT = 30, PA = 100, UNIT_LINE = (PA / PT) * 3;   // = 10.0

console.log(`market ${MARKET}`);
console.log(`the 25% line on the buy-order axis = ${UNIT_LINE.toFixed(1)} × (automobile pop fraction) / (transportation pop fraction)\n`);

const rows = [];
for (const r of readdirSync(SDIR).filter(d => /^run\d+_/.test(d)).sort()) {
  const dir = join(SDIR, r), metaP = join(dir, 'meta.json'), log = join(dir, 'logs_live', 'debug.log');
  if (!existsSync(metaP) || !existsSync(log)) continue;
  const meta = JSON.parse(readFileSync(metaP, 'utf8'));
  const buyOf = await buyOrderTable(log, meta.token);
  const { blocks } = await readBreakdown(log, meta.token, buyOf);
  const cell = new Map();
  for (const b of blocks) {
    if (b.market !== MARKET) continue;
    if (b.good !== 'transportation' && b.good !== 'automobiles') continue;
    const k = b.date;
    if (!cell.has(k)) cell.set(k, {});
    cell.get(k)[b.good] = { pop: b.pop, buy: b.total };
  }
  for (const [date, c] of [...cell.entries()].sort()) {
    if (!c.transportation || !c.automobiles) continue;
    if (!(c.automobiles.pop > 0) || !(c.transportation.buy > 0) || !(c.automobiles.buy > 0)) continue;
    const fA = c.automobiles.pop / c.automobiles.buy;
    const fT = c.transportation.pop / c.transportation.buy;
    const line  = UNIT_LINE * fA / fT;
    const ratio = c.transportation.buy / c.automobiles.buy;
    const shareLB = (c.automobiles.pop * PA) / (c.automobiles.pop * PA + c.transportation.pop * PT);
    rows.push({
      run: r, date,
      'automobiles pop / its buy orders':    +fA.toFixed(3),
      'transportation pop / its buy orders': +fT.toFixed(3),
      'EXACT 25% line (ratio)':              +line.toFixed(2),
      'MEASURED ratio':                      +ratio.toFixed(2),
      'automobiles vs 25%':                  ratio < line ? 'ABOVE 25%' : 'below 25%',
      'their share (lower bound)':           (100 * shareLB).toFixed(1) + '%'
    });
  }
}
if (!rows.length) { console.log('no date has both goods verified'); process.exit(0); }
console.table(rows);
console.log('flat proxy used by test_cap_binding_prediction.mjs: 5.70 — compare the EXACT column above.');
