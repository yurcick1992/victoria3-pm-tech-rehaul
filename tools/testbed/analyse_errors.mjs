// THE READER FOR error.log — the one log the harness cannot tokenise.
//
//   node tools/testbed/analyse_errors.mjs <sessionDir> [<sessionDir> ...]
//   node tools/testbed/analyse_errors.mjs <sessionDir> --shapes      # list every distinct shape
//
// ⚠⚠ WHY THIS EXISTS. Every telemetry line carries a per-run token so one run cannot read another's
// output. `error.log` carries nothing of the kind, and it is the same rotating 5x512 KB ring the game
// reuses across launches — so a run's `logs_live/error.log` mirror contains OTHER SESSIONS' lines, out
// of order. Measured 2026-08-11: a control-arm mirror opened on a line stamped 01:44:32, closed on one
// stamped 01:28:26, and carried nine `Duplicated key` errors belonging to a different arm that had run
// nine minutes earlier. Comparing raw `wc -l` between arms read 15 294 against 7 516 where the runs'
// own windows held 139 and 12.
//
// So: filter every line by its OWN [HH:MM:SS] stamp against the run's window (taken from harness.log,
// which is per-run and trustworthy), then DE-DUPLICATE — the game repeats one error line thousands of
// times, and a single naval battle emits hundreds of vanilla localization errors that swamp anything
// our mod could say. What is comparable between arms is the set of DISTINCT SHAPES, not the line count.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const SHAPES = args.includes('--shapes');
const dirs = args.filter(a => !a.startsWith('--'));
if (!dirs.length) { console.error('usage: node tools/testbed/analyse_errors.mjs <sessionDir> [...] [--shapes]'); process.exit(2); }

const secs = t => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
// A shape is the line with volatile parts removed: timestamps, line numbers, ids, country names.
const shapeOf = l => l.replace(/^\[[\d:]+\]/, '').replace(/\d{2,}/g, 'N').replace(/'[^']*'/g, "'X'").trim();
// Anything naming OUR content. A run's errors are only interesting to us if one of these appears.
const OURS = /pm_rehaul|zzz_pm|pm_main_|pmg_main_|Duplicated key/i;

// A run folder is either <session>/runNNN_*/ (scheduler) or <session>/run01/ (bare observer).
function runsIn(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (!statSync(p).isDirectory()) continue;
    if (existsSync(join(p, 'logs_live', 'error.log'))) out.push({ name: e, path: p });
    else if (existsSync(join(p, 'run01', 'logs_live', 'error.log'))) out.push({ name: e, path: join(p, 'run01') });
  }
  if (existsSync(join(dir, 'logs_live', 'error.log'))) out.push({ name: '.', path: dir });
  return out;
}

// The window comes from the run's OWN harness log; without it we would be back to trusting the ring.
function windowOf(runPath) {
  // ⚠ `run.log` FIRST. Under the scheduler that is the observer's own log for this run; `harness.log`
  // exists too but does not carry the start/finish markers. Getting this wrong is silent — the window
  // comes back null, nothing is filtered, and a VANILLA arm cheerfully reports nine `Duplicated key`
  // errors belonging to a modded run that happened forty minutes earlier.
  for (const f of ['run.log', 'harness.log', '../session.log', 'session.log']) {
    const p = join(runPath, f);
    if (!existsSync(p)) continue;
    const t = readFileSync(p, 'utf8');
    const a = t.match(/\[(\d\d:\d\d:\d\d)\][^\n]*run \d+\/?\d* starting/);
    const b = [...t.matchAll(/\[(\d\d:\d\d:\d\d)\][^\n]*run \d+ finished/g)].pop();
    if (a && b) return [secs(a[1]), secs(b[1])];
  }
  return null;
}

console.log('run                                        window   lines  distinct  OURS   top shape');
const perRun = [];
for (const dir of dirs) for (const r of runsIn(dir)) {
  const w = windowOf(r.path);
  const raw = readFileSync(join(r.path, 'logs_live', 'error.log'), 'utf8').split('\n');
  const seen = new Map();
  let inWin = 0;
  for (const l of raw) {
    const m = l.match(/^\[(\d\d:\d\d:\d\d)\]/);
    if (!m) continue;
    const t = secs(m[1]);
    if (w && (t < w[0] || t > w[1])) continue;      // another session's line, sitting in our ring
    inWin++;
    const s = shapeOf(l);
    if (s) seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  const ours = [...seen.keys()].filter(s => OURS.test(s));
  const top = [...seen].sort((a, b) => b[1] - a[1])[0];
  const label = `${dir.split(/[\\/]/).pop()}/${r.name}`.slice(0, 40);
  // A missing window means NO FILTERING HAPPENED, so every number on this row is contaminated by other
  // sessions' lines. Say so loudly rather than printing a plausible-looking figure.
  if (!w) console.log(`  !! ${label}: no run window found — numbers below are UNFILTERED and not comparable`);
  console.log(`${label.padEnd(42)} ${w ? 'yes ' : 'NONE'}  ${String(inWin).padStart(6)}  ${String(seen.size).padStart(8)}  ${String(ours.length).padStart(4)}   ${top ? top[0].slice(0, 60) : '-'}`);
  // ⚠ Keep the UNTRUNCATED folder name for arm detection — `label` is cut to 40 chars for the table,
  // which turns `run002_vanilla` into `run002_va` and makes every arm look like the mod arm.
  perRun.push({ label, arm: r.name, seen, ours });
}

if (!perRun.length) { console.log('\nno runs with a mirrored error.log found'); process.exit(0); }
console.log(`\n⚠ "lines" is only comparable WITHIN a run — the game repeats one error thousands of times.`);
console.log(`  What is comparable between arms is "distinct". "OURS" counts shapes naming our own content.`);

// Shapes unique to one arm are the only ones worth chasing.
const byArm = {};
for (const r of perRun) {
  const arm = /vanilla|control|ctl/i.test(r.arm) ? 'vanilla' : 'mod';
  byArm[arm] ??= new Set();
  for (const s of r.seen.keys()) byArm[arm].add(s);
}
if (byArm.mod && byArm.vanilla) {
  const only = [...byArm.mod].filter(s => !byArm.vanilla.has(s));
  console.log(`\nshapes seen in the MOD arm and never in the VANILLA arm: ${only.length}`);
  for (const s of only) console.log(`   ${OURS.test(s) ? '!! ' : '   '}${s.slice(0, 150)}`);
  const back = [...byArm.vanilla].filter(s => !byArm.mod.has(s));
  console.log(`\nshapes seen ONLY in vanilla (for symmetry — these are the game's own): ${back.length}`);
  for (const s of back.slice(0, 8)) console.log(`      ${s.slice(0, 150)}`);
}

if (SHAPES) for (const r of perRun) {
  console.log(`\n=== ${r.label} — all ${r.seen.size} distinct shapes ===`);
  for (const [s, n] of [...r.seen].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}x ${s.slice(0, 150)}`);
}
