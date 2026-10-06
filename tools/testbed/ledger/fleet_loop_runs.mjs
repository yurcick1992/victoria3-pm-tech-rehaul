// WHICH RUNS ARE DISQUALIFIED FROM THE WALL-CLOCK COMPARISON BY A FLEET REPAIR LOOP (user-ruled 2026-10-06, FINDINGS F218).
// A fleet loop is a VANILLA engine defect (a lone ship recalled for repairs, its travel path appended to for decades); a run that carries
// one is DISQUALIFIED for wall-clock speed — on BOTH sides, the configs compared and the vanilla reference — and for nothing else.
// Every other slowdown (great-power wars, the unexplained ones, however sharp) STAYS in the wall clock.
//
//   node tools/testbed/ledger/fleet_loop_runs.mjs <label>=<session>[,<session>][:<setup>] [...] [--threshold 25] [--years 3] [--dirs]
//
// THE RULE, read from the game's own per-tick log (logs_live/dedicated_server.log, parsed by tick_profile.mjs): per in-game year, the
// seconds charged to each of the day's four sub-ticks (hours 0 / 6 / 12 / 18). A FLEET-LOOP EPISODE = ONE of the 06 / 12 / 18 sub-ticks
// standing ≥ --threshold (25) seconds a year above BOTH of the other two, the same sub-tick, for ≥ --years (3) consecutive years.
// In a normal year the three sit level (~10–30 s each); a long war lifts all three together (so it never fires); a fleet loop lifts one.
// Calibrated on all 291 century runs of 2026-07-31 → 2026-10-05: 248 never have a year above the line, 22 have one or two isolated years,
// 21 fire (1 of 31 vanilla, 20 of 260 mod) — every fleet-loop episode F218 found, including the two confirmed by save, and no war run.
// ⚠ Checked against other slowdowns (F218 §7): wars, autosaves, scripted pulses, stalls, log artifacts and bigger worlds cannot fire it;
//   a SUSTAINED MACHINE-WIDE slowdown can (it scales hour 6's normal lead — GBR, USA and GER all sit in that sub-tick — and pushes cheap
//   loops over the line): where the run has a machine_load.tsv, look at the canary over the streak before disqualifying. Borderline
//   verdicts move with machine speed (±10% flips 3 of the 21).
// ⚠ A loop whose cost lands in hour 0 alone cannot be told from other hour-0 load, so it is NOT detected and STAYS — like any unexplained
//   slowdown. ⚠ Needs a mirrored dedicated_server.log; a run without one is printed as `no tick log` and stays IN (no evidence).
// Output: per run the verdict and its evidence; per arm the SHARE OF RUNS DISQUALIFIED (the reports must show it) and the century's play
// time (lib_wall) over all runs and over the qualifying runs. `--dirs` prints the qualifying run folders, ready for report_perf.mjs.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { parseTicks } from './tick_profile.mjs';
import { wallFromTicks } from './lib_wall.mjs';
const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TH = +opt('--threshold', 25), YRS = +opt('--years', 3), DIRS = args.includes('--dirs');
const specs = args.filter((a, i) => a.includes('=') && !args[i - 1]?.startsWith('--'));
if (!specs.length) { console.error('usage: fleet_loop_runs.mjs <label>=<session>[,<session>][:<setup>] [...] [--threshold 25] [--years 3] [--dirs]'); process.exit(2); }

export function detect(runDir, th = TH, yrs = YRS) {
  const T = parseTicks(runDir); if (!T || !T.length) return null;
  const Y = {}; for (const t of T) { const o = (Y[t.y] ||= [0, 0, 0, 0, 0]); o[t.h / 6] += t.t; o[4]++; }
  let cur = null, best = null;
  for (let y = 1836; y <= 1936; y++) {
    const v = Y[y]; if (!v || v[4] < 1200) { cur = null; continue; }           // a nearly complete year only
    const s = [v[1], v[2], v[3]].map(x => x * 1460 / v[4]);
    let X = -1, d = -Infinity; for (let i = 0; i < 3; i++) { const e = s[i] - Math.max(...s.filter((_, j) => j !== i)); if (e > d) { d = e; X = i; } }
    if (d >= th) { if (cur && cur.X === X && cur.end === y - 1) { cur.end = y; cur.sum += d; } else cur = { X, start: y, end: y, sum: d }; if (!best || cur.end - cur.start > best.end - best.start || (cur.end - cur.start === best.end - best.start && cur.sum > best.sum)) best = { ...cur }; }
    else cur = null;
  }
  const hit = best && best.end - best.start + 1 >= yrs;
  return { disqualified: !!hit, evidence: best ? `sub-tick ${[6, 12, 18][best.X]}h ${best.start}–${best.end} (${best.end - best.start + 1} y, +${Math.round(best.sum)} s over the other two)` : 'none' };
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const fmtMin = s => s == null ? '—' : `${(s / 60).toFixed(1)} min`;
for (const spec of specs) {
  const [label, rest] = spec.split('='); const [ses, setup = ''] = rest.split(':');
  const { runs, dropped } = usableRuns(SES, ses, setup);
  console.log(`\n== ${label}: ${runs.length} usable run(s)` + (dropped.length ? ` (${dropped.length} not usable, excluded as for every metric)` : ''));
  const all = [], kept = [], keptDirs = []; let dq = 0, noLog = 0;
  for (const r of runs) {
    const dir = join(SES, r), d = detect(dir), w = wallFromTicks(dir);
    if (!d) noLog++; else if (d.disqualified) dq++;
    if (w) { all.push(w.wall_play); if (!d?.disqualified) kept.push(w.wall_play); }
    if (!d?.disqualified) keptDirs.push(dir);
    console.log(`   ${r.padEnd(60)} ${!d ? 'no tick log — stays IN' : d.disqualified ? 'DISQUALIFIED (fleet loop)' : 'qualifies'.padEnd(25)}  ${w ? fmtMin(w.wall_play).padStart(10) : ''}  ${d ? d.evidence : ''}`);
  }
  console.log(`   ⇒ DISQUALIFIED for wall clock: ${dq} of ${runs.length} (${runs.length ? Math.round(100 * dq / runs.length) : 0}%)` + (noLog ? ` · ${noLog} without a tick log (kept)` : ''));
  console.log(`   ⇒ play time, mean: all runs ${fmtMin(mean(all))} (n=${all.length}) · qualifying runs ${fmtMin(mean(kept))} (n=${kept.length})`);
  if (DIRS) console.log(`   qualifying run folders:\n` + keptDirs.map(x => `     "${x}"`).join('\n'));
}
