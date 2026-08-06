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
const UNIT_LINE = (PA / PT) * 3;             // the 25% clamp, expressed as a POP-DEMAND UNIT ratio
const THRESHOLD = UNIT_LINE * POPMIN;        // the same line, degraded into a buy-order proxy

// ⚠⚠ TWO DIFFERENT NUMBERS, AND THE EARLIER VERSION OF THIS TOOL PRESENTED ONE AS THE OTHER
// (user, 2026-08-06: "5.70 means what specifically? Where would the clamp of 25% be?").
//
//   THE CLAMP ITSELF is a ratio of 3 : 1 in MONEY (75 % ÷ 25 %), which is 10 : 1 in POP-DEMAND UNITS,
//   because automobiles cost £100 against transportation's £30 and 3 × (100/30) = 10. Where the
//   channel split captured both goods, that line can be tested EXACTLY, with no assumption at all.
//
//   5.70 IS NOT THAT LINE. It is 10 × POPMIN — the same condition degraded into something the monthly
//   ORDER BOOK can answer, by bounding pop demand below by POPMIN × buy orders. It is deliberately
//   CONSERVATIVE: everything under it is certainly a violation, but the true crossing happens EARLIER,
//   at a ratio between 5.70 and 10 depending on what fraction of each good's buying is pops.
//
// So read the buy-order table as "when is a violation CERTAIN", not "when did automobiles pass 25 %".
//
// ⚠⚠ AND READ IT FROM TRANSPORTATION'S SIDE, NOT AUTOMOBILES' (user, 2026-08-06: "how does MORE
// consumption than the supposed clamp violate anything?"). It does not — and automobiles were never the
// constrained good. Their `max_supply_share` is **1.0**; they have no binding ceiling whatsoever.
// What the cap constrains is TRANSPORTATION, at 0.75. In a TWO-good need the clamped excess has nowhere
// to go but the other good, so a binding cap forces EXACTLY 75/25 rather than "at least 25 % for the
// newcomer". The measurement is therefore inconsistent because transportation comes in BELOW 75 %
// (≤ 68.4 % at 1915), not because automobiles came in above 25 %.
// ⇒ The anomaly is **transportation being under-consumed** relative to every reading (A predicts 90.6 %,
//   B predicts 75.0 %, measured ≤ 68.4 %). Automobiles are the residual, not the cause.
// ⇒ That points at the one confound flagged and never tested: `transportation` is one of only three
//   `local` goods, and this whole calculation assumes market-wide sell orders mean the same for it as
//   for a tradeable good. If availability is really evaluated per state, states thin on transportation
//   would hand automobiles a larger share, and the market-level aggregate would look exactly like this.
//   See BALANCE_FRAMEWORK §10.35.1a.
console.log(`market ${MARKET}`);
console.log(`  the 25% clamp, exactly:  transportation : automobiles = 3 : 1 in MONEY`);
console.log(`                        =  ${UNIT_LINE.toFixed(1)} : 1 in POP-DEMAND UNITS (automobiles £${PA} vs transportation £${PT})`);
console.log(`  conservative proxy    :  transportation_BUY / automobiles_BUY >= ${THRESHOLD.toFixed(2)}  (= ${UNIT_LINE.toFixed(1)} × POPMIN ${POPMIN})`);
console.log(`  POPMIN is the measured LOW end of pops' share of automobile buy orders, so a breach below`);
console.log(`  ${THRESHOLD.toFixed(2)} is certain — but automobiles cross 25% somewhere ABOVE it, nearer ${UNIT_LINE.toFixed(1)}.\n`);

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
