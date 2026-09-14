// THE 2+1 QUICK CONFIG TEST — THE ALIGNMENT RULE (user-ruled 2026-09-14; FINDINGS F114 has the calibration).
//
// A quick config test is two runs of one config, then this check, then a third run only where the two DIVERGE. Two
// criteria, both at 1935 and both as ratios to the vanilla baseline's per-run MEDIAN:
//   1. world GDP ÷ vanilla median
//   2. productive workers per capita ÷ vanilla median   (productive = salaried − government − military; per capita over
//      the three strata's population — the same definition as first_run_decomp.mjs / advanced_panel.mjs)
// Each axis has FIVE BANDS (way below · noticeably below · target · noticeably above · way above). A pair of runs FAILS an
// axis only when the two sit in DIFFERENT BANDS *and* differ by at least the axis's absolute threshold (points of the
// vanilla median). Any failed axis ⇒ the config gets its tie-breaker run and is read as the median of three.
//
//   GDP:     way below < 0.60 · below 0.60–0.90 · TARGET 0.90–1.10 · above 1.10–1.50 · way above > 1.50 · threshold 0.15
//   workers: way below < 0.40 · below 0.40–0.55 · TARGET 0.55–0.72 · above 0.72–0.90 · way above > 0.90 · threshold 0.10
//
// The workers target is centred on the design's own goal, NOT on vanilla: phase 2 (canon-je24-a22, n=11, F109 — GDP
// 0.915× vanilla with productive workers at two thirds of vanilla's and 1.39× the product per worker) has a per-run
// median worker share of 0.634× vanilla, so vanilla itself reads "way above" on that axis (17 of 18 baseline runs). The
// GDP target is narrow on purpose: the design aims at vanilla's GDP path.
//
// CALIBRATION (F114): under this rule 47% of phase 1's own 435 pairs, 40% of phase 2's 55 and 69% of vanilla's 153 pass —
// i.e. the third run is the NORM for the four-rung family's seed spread, by the user's choice ("go with mine 0.15/0.1").
// The earlier five-criterion rule (GDP within 0.15 and the same band side, workers within 0.10, rung-0 direction, stale
// payback side, below-best within 5 pp) is retired: its rung-0 and payback terms never failed inside a config (they are
// cliff detectors, kept in the VERDICT as flags), and its GDP/workers terms failed 42% of vanilla's pairs.
//
// USAGE: node tools/testbed/ledger/alignment_check.mjs --arm <session[,session]>:<setup> [--van <session>] [--year 1935]
//   --arm   the config's runs (usable = reached their until date, L17), pooled over the sessions named
//   --van   the vanilla baseline session (default 20260821_131149_vanilla-baseline-n16); its per-run medians are the
//           denominators, computed live from its summaries
// Exit 0 = aligned (no tie-breaker), 2 = divergent (run the third), 3 = THE RUN-LEVEL STOP (a run above --stop-above × vanilla's
// 1936 GDP; read even at n=1, since run 1 alone can end a config), 1 = cannot read / only one run and no stop.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { usableRuns, reportDropped } from './lib_runs.mjs';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SES = 'tools/testbed/sessions';
const YEAR = argOf('--year', '1935');
const armArg = argOf('--arm', null);
if (!armArg) { console.error('usage: alignment_check.mjs --arm <session[,session]>:<setup> [--van <session>] [--year 1935]'); process.exit(1); }
const [armSessions, armSetup] = armArg.split(':');
const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16');

export const RULE = {
  gdp: { edges: [0.60, 0.90, 1.10, 1.50], threshold: 0.15 },
  workers: { edges: [0.40, 0.55, 0.72, 0.90], threshold: 0.10 },
};
const NAMES = ['way below', 'noticeably below', 'target', 'noticeably above', 'way above'];
export const band = (x, e) => x < e[0] ? 0 : x < e[1] ? 1 : x <= e[2] ? 2 : x <= e[3] ? 3 : 4;
export const pairFails = (a, b, axis) => band(a, RULE[axis].edges) !== band(b, RULE[axis].edges) && Math.abs(a - b) >= RULE[axis].threshold;

function summaryAt(runRel, yr) {
  const dir = join(SES, runRel, 'save_summaries'); if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    if (((j.provenance && j.provenance.date) || '').startsWith(yr + '.')) return j;
  }
  return null;
}
function readRun(runRel) {
  const j = summaryAt(runRel, YEAR); if (!j) return null;
  let pop = 0, sal = 0, gov = 0, mil = 0;
  for (const c of Object.values(j.countries || {})) {
    const p = c.pop_statistics || {};
    pop += (p.population_lower_strata || 0) + (p.population_middle_strata || 0) + (p.population_upper_strata || 0);
    sal += p.population_salaried_workforce || 0; gov += p.population_government_workforce || 0; mil += p.population_military_workforce || 0;
  }
  return { run: runRel, gdp: j.world.gdp, prodPerCap: (sal - gov - mil) / pop };
}
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const van = usableRuns(SES, VAN);
const vanRows = van.runs.map(readRun).filter(Boolean);
if (vanRows.length < 4) { console.error(`vanilla baseline ${VAN}: only ${vanRows.length} readable runs at ${YEAR}`); process.exit(1); }
const vanGdp = med(vanRows.map(r => r.gdp)), vanPc = med(vanRows.map(r => r.prodPerCap));

const arm = usableRuns(SES, armSessions, armSetup);
reportDropped(arm.dropped);
const rows = arm.runs.map(readRun).filter(Boolean);
if (rows.length < 1) { console.error(`arm ${armArg}: no readable run at ${YEAR}`); process.exit(1); }

console.log(`ALIGNMENT CHECK — ${armArg} · ${rows.length} usable run(s) at ${YEAR} · vanilla ${VAN} n=${vanRows.length}: median GDP £${Math.round(vanGdp / 1e6).toLocaleString('en-US')}M, median productive workers per capita ${vanPc.toFixed(4)}`);
console.log('run                                                    GDP÷van   band                 wkr/cap÷van   band');
for (const r of rows) {
  r.g = r.gdp / vanGdp; r.w = r.prodPerCap / vanPc;
  console.log(`${r.run.padEnd(54)} ${r.g.toFixed(3).padStart(7)}   ${NAMES[band(r.g, RULE.gdp.edges)].padEnd(18)} ${r.w.toFixed(3).padStart(11)}   ${NAMES[band(r.w, RULE.workers.edges)]}`);
}
// THE RUN-LEVEL STOP (user-ruled 2026-09-14): unless a schedule says "full runs", ANY run of a 2+1 test that ends above
// STOP_ABOVE × vanilla's 1936 GDP (the eighteen-run vanilla median at the 1936.1.1 endpoint) is the config's LAST run —
// the config stops there, be it run 1, 2 or 3. Read on the endpoint summary, never mid-run: a failure still leaves a
// comparable 1836→1936 result. `--stop-above 0` disables it (a "full runs" schedule). SCOPE: 2+1 batches ONLY — a long
// sequence, or any batch not explicitly set up as a series of 2+1 tests under changing configs, is not subject to it.
export const STOP_ABOVE = +argOf('--stop-above', '1.3');
if (STOP_ABOVE > 0) {
  const van36 = van.runs.map(r => { const j = summaryAt(r, '1936'); return j ? j.world.gdp : null; }).filter(x => x != null);
  if (van36.length >= 4) {
    const vm36 = med(van36);
    let stopped = null;
    for (const r of rows) { const j = summaryAt(r.run, '1936'); if (!j) continue; r.g36 = j.world.gdp / vm36; if (r.g36 > STOP_ABOVE && !stopped) stopped = r; }
    console.log(`stop rule: a run above ${STOP_ABOVE}× vanilla's 1936 GDP (median £${Math.round(vm36 / 1e6).toLocaleString('en-US')}M, n=${van36.length}) is the config's last — ` + rows.map(r => `${r.run.split('/')[1]} ${r.g36 == null ? '(no 1936 summary)' : r.g36.toFixed(2) + '×'}`).join(' · '));
    if (stopped) { console.log(`STOP: ${stopped.run} ended at ${stopped.g36.toFixed(2)}× vanilla's 1936 GDP — THE CONFIG STOPS HERE (no further run of it, whatever the alignment says).`); process.exit(3); }
  }
}
if (rows.length < 2) { console.log(`one usable run at ${YEAR} — the pair check needs two (no stop triggered); run 2 decides the tie-breaker`); process.exit(1); }
let divergent = 0;
console.log(`\npairs (fail = different bands AND ≥ ${RULE.gdp.threshold} GDP / ≥ ${RULE.workers.threshold} workers apart):`);
for (let i = 0; i < rows.length; i++) for (let k = i + 1; k < rows.length; k++) {
  const a = rows[i], b = rows[k];
  const fg = pairFails(a.g, b.g, 'gdp'), fw = pairFails(a.w, b.w, 'workers');
  if (fg || fw) divergent++;
  console.log(`  ${a.run.split('/')[1]} vs ${b.run.split('/')[1]}: GDP ${a.g.toFixed(2)} / ${b.g.toFixed(2)} ${fg ? '✗' : '✓'} · workers ${a.w.toFixed(2)} / ${b.w.toFixed(2)} ${fw ? '✗' : '✓'}${fg || fw ? '   → DIVERGENT' : ''}`);
}
const gm = med(rows.map(r => r.g)), wm = med(rows.map(r => r.w));
console.log(`\nmedians: GDP ${gm.toFixed(3)}× (${NAMES[band(gm, RULE.gdp.edges)]}) · workers per capita ${wm.toFixed(3)}× (${NAMES[band(wm, RULE.workers.edges)]})`);

if (divergent && rows.length === 2) { console.log(`VERDICT: DIVERGENT — the pair fails; run the tie-breaker and read the median of three.`); process.exit(2); }
if (divergent) { console.log(`VERDICT: ${divergent} of ${rows.length * (rows.length - 1) / 2} pairs diverge at n=${rows.length}; the reading is the median of ${rows.length} (the tie-breaker has run — no further run).`); process.exit(0); }
console.log(`VERDICT: ALIGNED — the reading stands at n=${rows.length}; no tie-breaker.`);
