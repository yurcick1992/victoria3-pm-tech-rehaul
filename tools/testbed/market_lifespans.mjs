// market_lifespans.mjs — how long did each tracked market actually last?
//
//   node tools/testbed/market_lifespans.mjs --session tools/testbed/sessions/<stamp>_<label>
//
// WHY THIS EXISTS. A schedule names the markets it tracks, and a named country can be annexed, form
// into a successor, or join someone else's market partway through a century. When that happens the
// metric simply stops producing rows for it — **nothing fails**. The run completes, the TSV is
// well-formed, preflight is green, and the market is just quietly absent from 1845 onwards.
//
// Measured 2026-08-06, session `20260806_110926_vanilla-retest-2` run 1: Belgium was tracked in both
// the order book AND the (expensive) channel split, and its market ended at **1844**. It produced 300
// rows against ~47 000 each for Britain and the USA, and **zero** channel-split blocks — so the whole
// breakdown budget spent on it bought nothing past 1844, and that was only noticed because someone
// went looking.
//
// ⭐ THE POINT IS NOT TO STOP TRACKING SMALL COUNTRIES. Belgium is deliberately chosen: few contiguous
// states, urbanised, resourced, coastal, and not in any unification pool — which makes it the closest
// real analogue to what the balance sheet models (full employment, no market-access gradients, one
// coherent market). Survival is a per-run lottery and some runs will keep it. The point is that the
// lottery must be VISIBLE, so a run that lost its market is known to have lost it rather than being
// silently averaged in with runs that did not.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
if (!SESSION) { console.error('usage: market_lifespans.mjs --session <dir>'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));
if (!existsSync(SDIR)) { console.error(`session not found: ${SDIR}`); process.exit(1); }

const yearOf = d => parseInt(String(d).split('.')[0], 10);

for (const r of readdirSync(SDIR).filter(d => /^run\d+_/.test(d)).sort()) {
  const tsv = join(SDIR, r, 'markets.tsv');
  if (!existsSync(tsv)) { console.log(`${r}: no markets.tsv (run may still be in flight)`); continue; }
  // markets.tsv columns: run | dump_date | market | owner | good | buy | sell | price | ...
  // ⚠ markets_ALL.tsv has TWO prefix columns (run_index, setup) and therefore DIFFERENT offsets.
  // Reading one with the other's indices silently yields the owner column where the market is
  // expected — which produced a completely wrong first pass at exactly this question.
  const lines = readFileSync(tsv, 'utf8').split(/\r?\n/);
  const seen = new Map();   // market -> {first, last, rows}
  let allDates = new Set();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split('\t');
    if (c.length < 5) continue;
    const date = c[1], mkt = c[2];
    allDates.add(date);
    const e = seen.get(mkt) || { first: date, last: date, rows: 0 };
    if (yearOf(date) < yearOf(e.first)) e.first = date;
    if (yearOf(date) > yearOf(e.last))  e.last  = date;
    e.rows++;
    seen.set(mkt, e);
  }
  const dates = [...allDates].sort((a, b) => yearOf(a) - yearOf(b));
  const runEnd = dates.length ? dates[dates.length - 1] : '?';
  console.log(`\n${r}   run ends ${runEnd}`);
  const rows = [...seen.entries()]
    .map(([mkt, e]) => ({
      market: mkt, first: e.first, last: e.last, rows: e.rows,
      // "survived" means present at the run's own final dump - not at some fixed date, because a run
      // that was truncated has not lost its markets, it has simply stopped.
      survived: yearOf(e.last) >= yearOf(runEnd) ? 'yes' : `NO - ended ${e.last}`
    }))
    .sort((a, b) => b.rows - a.rows);
  console.table(rows);
  const lost = rows.filter(x => x.survived !== 'yes');
  if (lost.length) {
    console.log(`  ⚠ ${lost.length} tracked market(s) did NOT last the run: ${lost.map(x => x.market).join(', ')}`);
    console.log(`    Data after those dates is absent, not zero. Any cross-market comparison must exclude them,`);
    console.log(`    and any expensive metric aimed at them bought nothing past that point.`);
  } else {
    console.log('  every tracked market lasted to the end of the run.');
  }
}
