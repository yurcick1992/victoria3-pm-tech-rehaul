// floor_necessary_condition.mjs — a MONTHLY test of whether the 25% floor can be binding.
//
//   node tools/testbed/floor_necessary_condition.mjs --session <dir> [--market "British Market"]
//
// THE PROBLEM. Pop demand is only readable from the channel split, which truncates ~40% of goods per
// dump and keeps `transportation` in early dumps and `automobiles` in late ones — so across two whole
// campaigns only THREE dates carry both. Three scattered points cannot show the shape of a trajectory,
// and a single point at three months cannot distinguish "the floor is refuted" from "it is still
// climbing toward the floor" (user, 2026-08-06 — a fair objection to an over-read).
//
// ⭐ THE WAY ROUND IT: test a NECESSARY CONDITION that needs only the ORDER BOOK, which is monthly and
// never truncates.
//
//   If the 0.75 cap binds, transportation takes 3/4 of free_movement and automobiles 1/4, so
//        transportation_pop_money(free_movement) = 3 x automobiles_pop_money.
//   transportation's pop money across BOTH its needs is >= its free_movement part, so
//        transportation_pop_money(total) >= 3 x automobiles_pop_money.
//   Bound each side by something measured monthly:
//        transportation_pop_money <= transportation_BUY x 30      (pops are at most all of the buying)
//        automobiles_pop_money    >= POPMIN x automobiles_BUY x 100
//   giving a condition in measured quantities alone:
//        transportation_BUY / automobiles_BUY  >=  100/30 x 3 x POPMIN
//
// ⚠ POPMIN is the ONLY assumption, and it is measured rather than guessed: across every verified
// automobile block in these sessions, pops are 57-99% of automobile buy orders. Using the LOW end makes
// the test conservative — it can only under-report violations, never invent one.
// ⚠ A violation is decisive; satisfaction is NOT. The condition is necessary, not sufficient, exactly
// as the ratio>=3 test was: transportation's other need can absorb any surplus.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
const MARKET  = argOf('--market', 'British Market');
const POPMIN  = parseFloat(argOf('--popmin', '0.57'));
if (!SESSION) { console.error('usage: floor_necessary_condition.mjs --session <dir> [--market M] [--popmin f]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));

const PT = 30, PA = 100;                     // base prices, read from the game and verified
const THRESHOLD = (PA / PT) * 3 * POPMIN;    // transportation_BUY / automobiles_BUY must be at least this
console.log(`market ${MARKET} · POPMIN ${POPMIN} (measured low end of pops' share of automobile buy orders)`);
console.log(`floor requires  transportation_BUY / automobiles_BUY  >=  ${THRESHOLD.toFixed(2)}\n`);

const ymd = d => { const p = String(d).split('.'); return +p[0] + (+p[1] - 1) / 12; };

for (const r of readdirSync(SDIR).filter(d => /^run\d+_/.test(d)).sort()) {
  const tsv = join(SDIR, r, 'markets.tsv');
  if (!existsSync(tsv)) { console.log(`${r}: no markets.tsv yet`); continue; }
  // markets.tsv: run | dump_date | market | owner | good | buy | sell | price | ...
  const lines = readFileSync(tsv, 'utf8').split(/\r?\n/);
  const buy = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split('\t');
    if (c.length < 7 || c[2] !== MARKET) continue;
    if (c[4] !== 'transportation' && c[4] !== 'automobiles') continue;
    if (!buy.has(c[1])) buy.set(c[1], {});
    buy.get(c[1])[c[4]] = parseFloat(c[5]);
  }
  const rows = [...buy.entries()]
    .filter(([, v]) => v.transportation > 0 && v.automobiles > 0)
    .sort((a, b) => ymd(a[0]) - ymd(b[0]))
    .map(([d, v]) => ({ date: d, ratio: v.transportation / v.automobiles,
                        transp_buy: +v.transportation.toFixed(0), auto_buy: +v.automobiles.toFixed(1) }));
  if (!rows.length) { console.log(`${r}: no month has both goods being bought`); continue; }
  const bad = rows.filter(x => x.ratio < THRESHOLD);
  const first = rows[0], firstBad = bad[0];
  console.log(`\n${'='.repeat(96)}`);
  console.log(`  ${r}  —  ${rows.length} month(s) with both goods bought, ${first.date} to ${rows[rows.length-1].date}`);
  console.log(`  ${bad.length} of them violate the floor's necessary condition` +
              (firstBad ? `, first at ${firstBad.date}` : ''));
  console.log('='.repeat(96));
  // ⚠ A RATIO MUST SHOW ITS OWN NUMERATOR AND DENOMINATOR (user, 2026-08-06). A bare "1907: 2033" is
  // unreadable without carrying the definition in your head, and a reader who mis-remembers which way
  // up it goes reads the whole trajectory backwards.
  const seen = new Set();
  const traj = rows.filter(x => { const y = x.date.split('.')[0]; if (seen.has(y)) return false; seen.add(y); return true; });
  console.table(traj.map(x => ({
    date: x.date,
    'NUMERATOR transportation buy orders': x.transp_buy,
    'DENOMINATOR automobiles buy orders':  x.auto_buy,
    'ratio (transp / auto)':               +x.ratio.toFixed(2),
    'floor needs >= 5.70':                 x.ratio < THRESHOLD ? 'VIOLATED' : 'ok'
  })));
}
