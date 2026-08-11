// verify_save_alignment.mjs — DO THE TWO INSTRUMENTS AGREE?
//
//   node tools/testbed/verify_save_alignment.mjs <session dir> [--run run002_mod] [--top 25]
//
// ⭐⭐ THE GATE ROADMAP STEP 3.5 REFUSES TO SKIP. Before any state-of-process metric is moved off the
// log telemetry and onto savegame summaries, the replacement has to be validated AGAINST the thing it
// replaces — the same discipline that caught F39's bad solve. This script is that check: for every
// (run, date) where a save summary and a telemetry dump coincide, it compares the three quantities the
// roadmap names — GDP, building COUNT and POPULATION — country by country.
//
// ⚠⚠ THE JOIN IS THE HARD PART, AND IT IS THE WHOLE REASON SAVES ARE WORTH HAVING.
// Log telemetry identifies a country by its DISPLAY NAME (`GetNameNoFormatting` — there is no tag data
// function, TESTBED_METRICS §3), and a display name CHANGES MID-CAMPAIGN: F48 fell into exactly this.
// A save identifies a country by its TAG, which never changes. In the 2026-08-11 batch's own kept save
// the country telemetry calls "India" is tag `BHT` — Bhutan, having formed India — so a name join is
// not merely fiddly, it is wrong.
// ⇒ SO THE JOIN IS ON POPULATION, and that choice is deliberate: population is measured independently
// on both sides, is ~8 significant figures wide, and is NOT one of the quantities being scored on the
// GDP axis. Matching on GDP and then reporting GDP agreement would be circular; matching on population
// and then reporting GDP and building agreement is not. A match is accepted only when it is within
// --tol (default 2%) AND is unambiguous (the runner-up is at least 4x further away).
//
// ⚠ A RESIDUAL OF A FEW PERCENT IS EXPECTED AND IS NOT DISAGREEMENT. The save's `gdp` field is a weekly
// TREND whose last sample is dated a few weeks before the save (1934.12.8 in a 1935.1.1 save), while
// the telemetry fires on the dump date itself. On a fast-growing economy that is worth low single
// digits. What would be a real failure is a systematic bias, a wrong SIGN, or a country appearing in
// one instrument and not the other.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = args.filter(a => !a.startsWith('--'))[0];
const ONLY = argOf('--run', '');
const TOP = +argOf('--top', '25');
const TOL = +argOf('--tol', '0.02');
if (!SESSION || !existsSync(SESSION)) { console.error('usage: verify_save_alignment.mjs <session dir> [--run runNNN_setup]'); process.exit(1); }

const pct = (a, b) => (b ? (a - b) / b * 100 : NaN);
const fmt = n => Number.isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(2) + '%' : '  n/a';

// ---- telemetry side: GDP / BLD / POP lines, filtered by the run's OWN token (the log ring carries
//      other runs' lines — one run folder once held 976 foreign pop lines for a 187-pop country).
function readTelemetry(runDir) {
  const meta = JSON.parse(readFileSync(join(runDir, 'meta.json'), 'utf8'));
  const token = meta.token;
  const log = join(runDir, 'logs_live', 'debug.log');
  if (!existsSync(log)) return { token, byDate: new Map() };
  const byDate = new Map();                      // date -> name -> {gdp,bld,pop}
  const want = new RegExp(`V3TB\\|${token}\\|(GDP|BLD|POP)\\|`);
  for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
    if (!want.test(line)) continue;
    const f = line.slice(line.indexOf('V3TB|')).split('|');
    const [, , kind, date, name] = f;
    if (!byDate.has(date)) byDate.set(date, new Map());
    const m = byDate.get(date);
    const r = m.get(name) ?? m.set(name, {}).get(name);
    if (kind === 'GDP') { r.gdp = +f[5]; r.foreign_gdp = +f[7]; r.market = f[8]; }
    else if (kind === 'BLD') r.bld = +f[5];
    else if (kind === 'POP') r.pop = +f[9];      // last field = total population
  }
  return { token, byDate };
}

// ---- save side
function readSummaries(runDir) {
  const dir = join(runDir, 'save_summaries');
  if (!existsSync(dir)) return new Map();
  const out = new Map();                          // date -> summary
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    try {
      const s = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString('utf8'));
      out.set(s.provenance.date, s);
    } catch (e) { console.error(`  ⚠ unreadable summary ${f}: ${e.message}`); }
  }
  return out;
}

let gAll = [], bAll = [], nMatched = 0, nUnmatched = 0, nDates = 0;
const runs = readdirSync(SESSION).filter(d => /^run\d+_/.test(d) && statSync(join(SESSION, d)).isDirectory())
  .filter(d => !ONLY || d === ONLY).sort();
if (!runs.length) { console.error('no run folders found'); process.exit(1); }

for (const run of runs) {
  const runDir = join(SESSION, run);
  const { token, byDate } = readTelemetry(runDir);
  const sums = readSummaries(runDir);
  const shared = [...byDate.keys()].filter(d => sums.has(d)).sort();
  console.log(`\n=== ${run}  (token ${token})  —  telemetry dumps ${byDate.size} · save summaries ${sums.size} · SHARED DATES ${shared.length}`);
  if (!shared.length) { console.log('  no coinciding dates — nothing to align on'); continue; }

  for (const date of shared) {
    nDates++;
    const tel = byDate.get(date), sum = sums.get(date);
    const saveRows = Object.entries(sum.countries).map(([tag, c]) => ({
      tag, pop: Object.values(c.professions).reduce((a, x) => a + x, 0),
      gdp: c.gdp || 0, bld: Object.values(c.buildings).reduce((a, r) => a + r.n, 0),
    })).filter(r => r.pop > 0);

    const gErr = [], bErr = [], unmatched = [];
    // biggest telemetry economies first — those are the ones a finding would ever quote
    const telRows = [...tel].filter(([, r]) => r.pop > 0).sort((a, b) => (b[1].gdp || 0) - (a[1].gdp || 0)).slice(0, TOP);
    for (const [name, t] of telRows) {
      let best = null, second = Infinity;
      for (const s of saveRows) {
        const d = Math.abs(s.pop - t.pop) / t.pop;
        if (!best || d < best.d) { second = best ? best.d : second; best = { s, d }; }
        else if (d < second) second = d;
      }
      // unambiguous = the runner-up is at least 4x further away, so a near-tie is reported, not guessed
      if (!best || best.d > TOL || second < best.d * 4) { unmatched.push(`${name} (pop ${t.pop.toLocaleString('en-US')})`); nUnmatched++; continue; }
      nMatched++;
      if (t.gdp && best.s.gdp) { const e = pct(best.s.gdp, t.gdp); gErr.push(e); gAll.push(e); }
      if (t.bld && best.s.bld) { const e = pct(best.s.bld, t.bld); bErr.push(e); bAll.push(e); }
    }
    const stat = a => a.length ? `mean ${fmt(a.reduce((x, y) => x + y, 0) / a.length)} · median ${fmt(a.slice().sort((x, y) => x - y)[a.length >> 1])} · worst ${fmt(a.slice().sort((x, y) => Math.abs(y) - Math.abs(x))[0])}` : 'none';
    console.log(`  ${date}  matched ${telRows.length - unmatched.length}/${telRows.length}` +
                `\n      GDP        ${stat(gErr)}` +
                `\n      buildings  ${stat(bErr)}`);
    if (unmatched.length) console.log(`      ⚠ unmatched on population: ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? ` (+${unmatched.length - 5})` : ''}`);
  }
}

const agg = a => a.length ? `mean ${fmt(a.reduce((x, y) => x + y, 0) / a.length)} · |mean| ${(a.reduce((x, y) => x + Math.abs(y), 0) / a.length).toFixed(2)}% · worst ${fmt(a.slice().sort((x, y) => Math.abs(y) - Math.abs(x))[0])}` : 'none';
console.log(`\n=== ALIGNMENT, ${nDates} shared date(s), ${nMatched} country-observations matched (${nUnmatched} not)`);
console.log(`  GDP        ${agg(gAll)}`);
console.log(`  buildings  ${agg(bAll)}`);
// The verdict is deliberately about |mean|, not the worst case: the trend-sample lag makes individual
// misses inevitable, while a systematic divergence is what would actually invalidate the replacement.
const mg = gAll.length ? gAll.reduce((x, y) => x + Math.abs(y), 0) / gAll.length : NaN;
const mb = bAll.length ? bAll.reduce((x, y) => x + Math.abs(y), 0) / bAll.length : NaN;
console.log(`\n  VERDICT: ${(mg < 5 && mb < 2) ? 'ALIGNED — the save summaries may stand in for the log metrics'
  : '⚠ NOT ALIGNED — do not strip anything from log telemetry'}  (thresholds: |GDP| < 5%, |buildings| < 2%)`);
