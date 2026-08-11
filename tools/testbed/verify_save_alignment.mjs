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
//
// ⚠⚠ AND POPULATION ALONE IS NOT A KEY. That was the first design here and it produced confident
// nonsense: tag `PCO` joined to "Tripolitania", `CUB` to "Kokand", `GAR` to "Tuscany" — each matching
// to within 0.1 % of population and disagreeing on GDP by 500-1700 %. Across ~250 countries, many of
// them small and formulaically populated, a coincidence inside 0.1 % is ordinary, and an
// "is the runner-up far away?" guard cannot see it because the coincidence beats every alternative.
// Tightening the tolerance 20x did not remove a single bad pair, which is what proved these were joins
// rather than measurements.
//
// ⇒ SO THE JOIN USES TWO INDEPENDENT KEYS, AND THE SCORED QUANTITY IS NEVER ONE OF THEM.
// Two passes, each excluding what it scores:
//     pass A  join on (population, BUILDINGS)  ->  score GDP
//     pass B  join on (population, GDP)        ->  score BUILDINGS
// Matching on GDP and then reporting GDP agreement would be circular; this is not. The building count
// is what rejects every bad pair above (40 vs 27, 21 vs 115), and population is what stops the GDP key
// from simply finding the nearest GDP.
// ⭐ The two passes also CHECK EACH OTHER: where both assign a save country to the same telemetry
// country, the join is corroborated by two different keys, and the report says how often they disagree.
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
// ⚠ 5 %, not 2 %, and the loosening is safe BECAUSE there are two keys. Swept on run 1 of
// 20260811_094048: 2 % -> 5 % adds an observation and leaves the GDP error identical (|mean| 1.61 %),
// because the corroborating field does the disambiguating; 10 % starts to admit worse pairs. What forced
// it is that GBR's population disagrees between the two instruments by 2.8 % at 1935 (save 86.36 M
// against telemetry 88.85 M) — a real residual worth chasing, and NOT a reason to drop the largest
// country in the game from the check.
const TOL = +argOf('--tol', '0.05');
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
  // ⚠ THE FIELD ORDER IS THE PARSING CONTRACT, so it is written out here rather than indexed by magic
  // number. Slicing from `V3TB|` INCLUSIVE shifts every index by one against the way these lines are
  // usually quoted, which is how `pop` was read off the unemployment RATE column on the first run —
  // every country came back with a population of 0.013 and the join matched nothing.
  //   GDP  V3TB|tok|GDP|date|name|gdp|foreign_share|foreign_gdp|?|market
  //   BLD  V3TB|tok|BLD|date|name|total|mfg|extract|agri|subsist|gold
  //   POP  V3TB|tok|POP|date|name|wf_total|wf_peasants|wf_slaves|dependents|unemp_rate|TOTAL_POPULATION
  const want = new RegExp(`V3TB\\|${token}\\|(GDP|BLD|POP)\\|`);
  let popBad = 0;
  for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
    if (!want.test(line)) continue;
    const f = line.slice(line.indexOf('V3TB|')).split('|');
    const [, , kind, date, name] = f;      // f[0]='V3TB', f[1]=token, f[2]=kind, f[3]=date, f[4]=name
    if (!byDate.has(date)) byDate.set(date, new Map());
    const m = byDate.get(date);
    const r = m.get(name) ?? m.set(name, {}).get(name);
    if (kind === 'GDP') { r.gdp = +f[5]; r.foreign_gdp = +f[7]; r.market = f[9]; }
    else if (kind === 'BLD') r.bld = +f[5];
    else if (kind === 'POP') {
      r.pop = +f[10];
      // ⚠ a sanity gate on the CONTRACT, not on the data: a country's population is a whole number of
      // people. Anything under 1 means the column moved, and that must fail here rather than surface as
      // "the two instruments disagree".
      if (Number.isFinite(r.pop) && r.pop > 0 && r.pop < 1) popBad++;
    }
  }
  if (popBad) throw new Error(`${popBad} POP line(s) parsed to a population below 1 — the field order has moved; fix the contract above before trusting any of this`);
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
    // `keyed` = join on population plus ONE corroborating field, returning the save row or null.
    // ⚠ the corroborating field is always the one we are NOT about to score.
    const keyed = (t, field, tolB) => {
      let best = null;
      for (const s of saveRows) {
        const dp = Math.abs(s.pop - t.pop) / t.pop;
        if (dp > TOL) continue;
        const a = t[field], b = s[field];
        if (!(a > 0) || !(b > 0)) continue;
        const db = Math.abs(b - a) / a;
        if (db > tolB) continue;
        const d = dp + db;
        if (!best || d < best.d) best = { s, d };
      }
      return best?.s ?? null;
    };
    let disagree = 0;
    for (const [name, t] of telRows) {
      const forGdp = keyed(t, 'bld', 0.10);      // joined on population + buildings -> score GDP
      const forBld = keyed(t, 'gdp', 0.10);      // joined on population + GDP       -> score buildings
      if (!forGdp && !forBld) { unmatched.push(`${name} (pop ${t.pop.toLocaleString('en-US')})`); nUnmatched++; continue; }
      if (forGdp && forBld && forGdp.tag !== forBld.tag) disagree++;
      nMatched++;
      if (forGdp && t.gdp && forGdp.gdp) { const e = pct(forGdp.gdp, t.gdp); gErr.push(e); gAll.push(e); }
      if (forBld && t.bld && forBld.bld) { const e = pct(forBld.bld, t.bld); bErr.push(e); bAll.push(e); }
    }
    const stat = a => a.length ? `mean ${fmt(a.reduce((x, y) => x + y, 0) / a.length)} · median ${fmt(a.slice().sort((x, y) => x - y)[a.length >> 1])} · worst ${fmt(a.slice().sort((x, y) => Math.abs(y) - Math.abs(x))[0])}` : 'none';
    console.log(`  ${date}  joined ${telRows.length - unmatched.length}/${telRows.length}` +
                `\n      GDP        ${stat(gErr)}   (join: population + buildings)` +
                `\n      buildings  ${stat(bErr)}   (join: population + GDP)`);
    if (disagree) console.log(`      ⚠ ${disagree} country(ies) where the two joins picked DIFFERENT save countries — treat those rows as unproven`);
    if (unmatched.length) console.log(`      not joined: ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? ` (+${unmatched.length - 5})` : ''}`);
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
