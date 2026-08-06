// map_saves_to_dates.mjs — label each archived autosave with the in-game date it was written at, by
// crossing the archiver's log against the observer's tick log. Both stamp wall-clock time, so the join is
// exact enough (ticks are logged every 20 s) and costs nothing — the alternative is melting 300 saves to
// read one field.
//
//   node tools/testbed/map_saves_to_dates.mjs <saves dir> <run.log> [--near 1905.1.1] [--every 4]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [DIR, RUNLOG] = pos;
const NEAR = argOf('--near', ''), EVERY = +argOf('--every', '0');
const secs = t => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
// ticks: "[HH:MM:SS] [INFO]   ... 1234s  in-game 1877.1.14"
const ticks = [];
for (const l of readFileSync(RUNLOG, 'utf8').split('\n')) {
  const m = /^\[(\d\d:\d\d:\d\d)\].*in-game (\d+)\.(\d+)\.(\d+)/.exec(l);
  if (m) ticks.push({ t: secs(m[1]), y: +m[2], mo: +m[3], d: +m[4] });
}
if (!ticks.length) { console.error('no tick lines in ' + RUNLOG); process.exit(1); }
const frac = k => k.y + (k.mo - 1) / 12 + (k.d - 1) / 365;
// archive log: "[HH:MM:SS] INFO  #12   autosave.v3   12 345 678 bytes"
const arch = [];
for (const l of readFileSync(join(DIR, 'archive.log'), 'utf8').split('\n')) {
  const m = /^\[(\d\d:\d\d:\d\d)\] INFO  #(\d+)\s+(\S+)/.exec(l);
  if (m) arch.push({ t: secs(m[1]), n: +m[2], slot: m[3] });
}
const files = readdirSync(DIR).filter(f => f.endsWith('.v3')).sort();
const byN = new Map(); for (const f of files) { const n = +f.slice(0, 4); byN.set(n, f); }
const out = [];
for (const a of arch) {
  const f = byN.get(a.n); if (!f) continue;
  // the save was WRITTEN a little before it was copied; take the tick nearest the copy time
  let best = ticks[0];
  for (const k of ticks) if (Math.abs(k.t - a.t) < Math.abs(best.t - a.t)) best = k;
  out.push({ n: a.n, file: f, date: `${best.y}.${best.mo}.${best.d}`, y: frac(best) });
}
out.sort((a, b) => a.y - b.y);
if (NEAR) {
  const [ny, nm] = NEAR.split('.').map(Number);
  const target = ny + (nm - 1) / 12;
  out.sort((a, b) => Math.abs(a.y - target) - Math.abs(b.y - target));
  for (const o of out.slice(0, 12)) console.log(`${o.date.padEnd(12)} ${o.file}`);
} else {
  for (let i = 0; i < out.length; i++) if (!EVERY || i % EVERY === 0) console.log(`${out[i].date.padEnd(12)} ${out[i].file}`);
  console.log(`\n${out.length} archived saves spanning ${out[0].date} .. ${out[out.length - 1].date}`);
}
