// ⭐ SLOWDOWN EPISODES, AND THE WALL CLOCK FACTORISED INTO ITS BRANCHES (2026-10-06, user-asked: "factorise and visualise them
// separately as diverging branches rather than a single line, to not conflate cases of 'everything is 10% slower' and cases of 'half of
// the runs is 10% faster, half is 30% slower'" — and "needs control still: has this happened in vanilla as well?").
// From the observer's 20-s tick lines (lib_wall.parseRunLog) only, so every session ever run can be read, vanilla included.
// Per usable run and period (default 5 in-game years): seconds of wall clock per in-game year, counting only tick pairs inside one
// attempt that move the date FORWARD past anything already played (a crash-resume's reload and replay never count). Per arm and period
// the MEDIAN over its runs is the arm's normal pace; a run is in an EPISODE where it sits ≥ --ratio (1.4) × that median for at least
// --min (2) consecutive periods. Prints, per arm:
//   - each run's pace by period as × the arm median (! marks an episode period), and its episodes with their cost in minutes;
//   - THE FACTORISATION: the share of runs with an episode, the mean minutes an episode costs, and the century's play time on the
//     NORMAL branch (each period's median × its years, summed) beside the mean run's — total = normal branch + episode share × cost.
// ⚠ An arm of one run has no siblings: its periods are judged against --ref <label> (another arm's median per period) when given.
// ⚠ Different save cadences pace differently (the save stall) — compare an arm with its own runs, or arms of one cadence.
//   node tools/testbed/ledger/slow_episodes.mjs <label>=<session>[,<session>][:<setup>] [...] [--years 5] [--ratio 1.4] [--min 2] [--ref <label>]
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { parseRunLog } from './lib_wall.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SES = join(REPO, 'tools/testbed/sessions');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('--years', 5), RATIO = +opt('--ratio', 1.4), MIN = +opt('--min', 2), REF = opt('--ref', null);
const specs = []; for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) { i++; continue; } if (args[i].includes('=')) specs.push(args[i]); }
if (!specs.length) { console.error('usage: slow_episodes.mjs <label>=<session>[,<session>][:<setup>] ... [--years 5] [--ratio 1.4] [--min 2] [--ref <label>]'); process.exit(2); }
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const periodOf = y => 1836 + Math.floor((y - 1836) / W) * W;

// seconds per in-game year, per period, for one run
function pace(runDir) {
  const atts = parseRunLog(runDir); if (!atts) return null;
  const acc = {}; let reached = 1836;
  for (const a of atts) {
    for (let i = 1; i < a.ticks.length; i++) {
      const t0 = a.ticks[i - 1], t1 = a.ticks[i];
      const dt = t1.secs - t0.secs, dy = t1.year - t0.year;
      if (dt <= 0 || dt > 120 || dy <= 0 || dy > 2) continue;             // a gap, a reload, a stale tail or a jump
      if (t0.year < reached - 1e-9) continue;                              // ground already played: a replay after a resume
      const p = periodOf(t0.year); (acc[p] ||= { dt: 0, dy: 0 }); acc[p].dt += dt; acc[p].dy += dy;
      if (t1.year > reached) reached = t1.year;
    }
  }
  const out = {}; for (const [p, v] of Object.entries(acc)) if (v.dy >= 0.5 * Math.min(W, 1)) out[p] = v.dt / v.dy;
  return out;
}

const arms = specs.map(s => { const [label, rest] = s.split('='); const [ses, setup = ''] = rest.split(':');
  const runs = ses.split(',').flatMap(x => usableRuns(SES, x, setup).runs);
  return { label, runs: runs.map(r => ({ id: r, pace: pace(join(SES, r)) })).filter(r => r.pace && Object.keys(r.pace).length) }; });
for (const a of arms) {
  a.periods = [...new Set(a.runs.flatMap(r => Object.keys(r.pace).map(Number)))].sort((x, y) => x - y);
  a.median = Object.fromEntries(a.periods.map(p => [p, med(a.runs.map(r => r.pace[p]))]));
}
const refArm = REF ? arms.find(a => a.label === REF) : null;
if (REF && !refArm) { console.error(`--ref ${REF}: no such arm`); process.exit(2); }

for (const a of arms) {
  const base = (a.runs.length < 3 && refArm && refArm !== a) ? refArm : a;
  console.log(`\n== ${a.label}: ${a.runs.length} run(s)` + (base !== a ? ` — judged against ${base.label}'s median (too few siblings)` : '') +
    ` · episode = ≥ ${RATIO}× the median for ≥ ${MIN} consecutive ${W}-year period(s)`);
  console.log('   median s per in-game year: ' + a.periods.map(p => `${p} ${Math.round(a.median[p])}`).join(' · '));
  let nEp = 0, epMin = [], tot = [];
  for (const r of a.runs) {
    const ratios = a.periods.map(p => r.pace[p] != null && base.median[p] ? r.pace[p] / base.median[p] : null);
    const flag = ratios.map(x => x != null && x >= RATIO);
    const eps = []; let i = 0;
    while (i < flag.length) { if (!flag[i]) { i++; continue; } let j = i; while (j + 1 < flag.length && flag[j + 1]) j++; if (j - i + 1 >= MIN) eps.push([i, j]); i = j + 1; }
    const cost = eps.reduce((s, [i0, j0]) => { let c = 0; for (let k = i0; k <= j0; k++) c += (r.pace[a.periods[k]] - base.median[a.periods[k]]) * W; return s + c; }, 0) / 60;
    if (eps.length) { nEp++; epMin.push(cost); }
    tot.push(a.periods.reduce((s, p) => s + (r.pace[p] ?? base.median[p] ?? 0) * W, 0) / 60);
    const strip = ratios.map((x, k) => x == null ? '  —  ' : (eps.some(([i0, j0]) => k >= i0 && k <= j0) ? '!' : ' ') + x.toFixed(2).padStart(4)).join('');
    console.log(`   ${r.id.split('/').pop().padEnd(34)}${strip}` + (eps.length ? `   EPISODE ${eps.map(([i0, j0]) => `${a.periods[i0]}–${a.periods[j0] + W}`).join(', ')} (+${Math.round(cost)} min)` : ''));
  }
  const normal = a.periods.reduce((s, p) => s + (base.median[p] ?? 0) * W, 0) / 60;
  console.log(`   periods: ${a.periods.map(p => String(p).padStart(5)).join('')}`);
  console.log(`   FACTORISED: normal branch ${Math.round(normal)} min (Σ the median pace) · ${nEp}/${a.runs.length} run(s) with an episode` +
    (nEp ? `, costing ${Math.round(med(epMin))} min (median; ${epMin.map(Math.round).join(', ')})` : '') + ` · mean run ${Math.round(tot.reduce((x, y) => x + y, 0) / tot.length)} min`);
}
