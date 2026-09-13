// wall_from_ticks.mjs — the true wall clock of every run in a session, from the observer's tick lines.
//   node tools/testbed/ledger/wall_from_ticks.mjs <sessionDir|runDir> [...] [--detail]
// Per run: the observer's meta wall (every attempt, crash overhead included), the rebuilt play time
// (load once + play − replays), the overhead, and the attempt count. See lib_wall.mjs for the method
// and why (2026-09-13: row P over-counted crash-prone arms by the reload + replay of every CTD).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { wallFromTicks } from './lib_wall.mjs';

const args = process.argv.slice(2);
const DETAIL = args.includes('--detail');
const dirs = args.filter(a => !a.startsWith('--'));
if (!dirs.length) { console.error('usage: wall_from_ticks.mjs <sessionDir|runDir> [...] [--detail]'); process.exit(1); }

const runDirs = [];
for (const d of dirs) {
  if (existsSync(join(d, 'run.log')) && existsSync(join(d, 'meta.json'))) { runDirs.push(d); continue; }
  if (!existsSync(d)) { console.error(`not found: ${d}`); continue; }
  for (const e of readdirSync(d).sort()) {
    const p = join(d, e);
    if (statSync(p).isDirectory() && existsSync(join(p, 'run.log'))) runDirs.push(p);
  }
}
const fm = s => s == null ? '      —' : (s / 60).toFixed(1).padStart(7);
console.log('run                                                    meta(min)  play(min)  overhead  attempts  landing→end');
let sumMeta = 0, sumPlay = 0, n = 0;
for (const rp of runDirs) {
  const meta = existsSync(join(rp, 'meta.json')) ? JSON.parse(readFileSync(join(rp, 'meta.json'), 'utf8')) : null;
  const w = wallFromTicks(rp, meta);
  const label = rp.split(/[\\/]/).slice(-2).join('/');
  if (!w) { console.log(`${label.padEnd(54)} ${fm(meta?.wall_seconds)}        —         —         —  (no usable ticks)`); continue; }
  const used = w.detail.filter(d => d.used);
  const span = used.length ? `${used[0].landing}→${used[used.length - 1].end}` : '—';
  console.log(`${label.padEnd(54)} ${fm(w.wall_meta)} ${fm(w.wall_play)} ${fm(w.overhead_secs)}  ${String(w.attempts_used).padStart(3)}/${String(w.attempts_seen).padEnd(3)}  ${span}`);
  if (DETAIL) for (const d of w.detail) console.log('    ' + JSON.stringify(d));
  if (w.wall_meta != null && meta?.reached_ingame_date === meta?.until_date) { sumMeta += w.wall_meta; sumPlay += w.wall_play; n++; }
}
if (n) console.log(`\ncomplete runs ${n}: Σ meta ${(sumMeta / 60).toFixed(0)} min, Σ play ${(sumPlay / 60).toFixed(0)} min, overhead ${((sumMeta - sumPlay) / 60).toFixed(1)} min (${(100 * (sumMeta - sumPlay) / sumPlay).toFixed(1)}% of play)`);
