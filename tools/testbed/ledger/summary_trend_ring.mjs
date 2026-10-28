// summary_trend_ring.mjs — landmine L43's detector: the save summary must read a country's trend RING (gdp, prestige, literacy,
// avgsoltrend) at its current slot, (index − 1) mod n, never at the array's last position.
//
//   node tools/testbed/ledger/summary_trend_ring.mjs --selftest        (L43, every build and every batch gate; exit 1 on a breach)
//
// ⭐⭐ WHAT BROKE (2026-10-28, BUGS_AND_FIXES, F257). A trend's `values` array is a ring of weekly samples. A country alive since 1836 fills
// its 5,214 slots at the turn of 1936; from then on the channel's `index` keeps counting and new samples overwrite slot 0, 1, 2 …
// save_state_summary.mjs took the LAST number, so in any save after the wrap every old country's GDP froze at its early-January-1936
// sample while younger countries read correctly: the price-band probe read world GDP +6.2% where the saves held +25.5%. Nothing
// failed: the summaries verified, the totals looked plausible, and a batch that stops at 1936.1.1 never reaches the wrap, so only a
// continuation into 1936 (or a longer run) shows it.
//
// The self-test feeds a synthetic melt through the REAL writer: one country whose ring has wrapped (n 5, index 7: the current
// sample sits in slot 1, the last slot is two samples stale) and one whose ring is not full (index = n: the last slot is current).
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const WRITER = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'save_state_summary.mjs');
if (!process.argv.includes('--selftest')) { console.error('usage: summary_trend_ring.mjs --selftest'); process.exit(2); }

const ring = (index, values) => ['\t\t\tgdp={', '\t\t\t\tsample_rate=7', `\t\t\t\tcount=${values.length}`, '\t\t\t\tchannels={', '\t\t\t\t\t0={',
  '\t\t\t\t\t\tdate=1936.3.1', `\t\t\t\t\t\tindex=${index}`, '\t\t\t\t\t\tvalues={', `\t\t\t\t\t\t\t${values.join(' ')}`, '\t\t\t\t\t\t}', '\t\t\t\t\t}', '\t\t\t\t}', '\t\t\t}'];
const melt = [
  'date=1936.3.1',
  'country_manager={', '\tdatabase={',
  // wrapped: samples 6 and 7 overwrote slots 0 and 1; the current one (index 7) is slot 1 = 600, the last slot (30) is stale
  '\t\t1={', '\t\t\tdefinition="AAA"', '\t\t\tis_main_tag=yes', ...ring(7, [500, 600, 10, 20, 30]), '\t\t}',
  // not full: index = n, the last slot is the current one
  '\t\t2={', '\t\t\tdefinition="BBB"', '\t\t\tis_main_tag=yes', ...ring(3, [5, 6, 7]), '\t\t}',
  '\t}', '}',
  'states={', '\tdatabase={', '\t\t10={', '\t\t\tcountry=1', '\t\t}', '\t}', '}',
  'building_manager={', '\tdatabase={', '\t\t100={', '\t\t\tbuilding="building_selftest"', '\t\t\tstate=10', '\t\t\tlevels=1', '\t\t}', '\t}', '}', ''].join('\n');

const tmp = mkdtempSync(join(tmpdir(), 'l43-'));
let rc = 0;
try {
  const src = join(tmp, 'selftest_melt.txt'), out = join(tmp, 'selftest.json');
  writeFileSync(src, melt);
  const p = spawnSync(process.execPath, [WRITER, src, '--out', out], { encoding: 'utf8' });
  if (p.status !== 0) { console.log(`L43 FAIL: the summary writer threw on the self-test melt: ${(p.stderr || '').trim().slice(-400)}`); rc = 1; }
  else {
    const j = JSON.parse(readFileSync(out, 'utf8')), C = j.countries || {}, why = [];
    if (+C.AAA?.gdp !== 600) why.push(`countries.AAA.gdp ${C.AAA?.gdp}, expected 600 (slot (7 − 1) mod 5 = 1 of a wrapped ring; 30 is the stale last slot)`);
    if (+C.BBB?.gdp !== 7) why.push(`countries.BBB.gdp ${C.BBB?.gdp}, expected 7 (a ring that is not full: the last slot is current)`);
    if (+j.world?.gdp !== 607) why.push(`world.gdp ${j.world?.gdp}, expected 607`);
    if (why.length) { console.log(`L43 FAIL: save_state_summary.mjs reads a trend ring by position, not by its index: ${why.join('; ')}`); rc = 1; }
    else console.log('L43 self-test: a wrapped GDP ring is read at its index (600, not the stale 30); an unfilled ring at its last slot (7)');
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
process.exit(rc);
