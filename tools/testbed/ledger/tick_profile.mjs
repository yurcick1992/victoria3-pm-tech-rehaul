// WHERE A RUN'S WALL CLOCK WENT, TICK BY TICK (2026-10-06, FINDINGS F218). The game writes `Processing Tick: Y.M.D[.H]` to
// dedicated_server.log at the start of every quarter-day tick (hours 0 / 6 / 12 / 18), with a 1-second wall stamp, and the observer
// mirrors that log into logs_live/. Each gap between two consecutive ticks is charged to the EARLIER tick, so the four sub-ticks of a
// day can be told apart — and they separate the slowdown mechanisms the episodes of slow_episodes.mjs are made of:
//   · hour 0 + ONE other sub-tick rising by about the same amount, growing for years, then dropping to normal within days
//       = a fleet stuck on a repair loop (F218; the sub-tick follows the OWNER's id mod 4 — ≡ 1 → hour 6, confirmed USA, Siam; ≡ 0 →
//         hour 12, confirmed Bulgaria; ≡ 2 → hour 0 alone, Portugal; ≡ 3 → hour 18 presumed — F218 §8). Read a save with fleet_loops.mjs.
//   · all four sub-ticks rising together, ending at a peace = a long war between major powers (F218: every heavy all-sub-tick year
//         of the corpus falls inside one).
//   · a few multi-second ticks on a fixed cycle (canon-dams-v2-n1: pairs every 28 days) = something periodic; unexplained.
//
//   node tools/testbed/ledger/tick_profile.mjs <session>/<run> [--from 1836] [--to 1936]          per in-game year
//        … --long 3                                       list every tick of ≥ 3 s in the range
//        … --days 1930.8.1,1930.12.1 [--slots 6,12,18] [--bin 5]   seconds in the chosen sub-ticks per --bin days (pin a start / end)
// ⚠ 1-second stamps: a single tick's figure is integer noise. Only a sum over ALL FOUR sub-ticks telescopes (exact to ±1 s); one
//   sub-tick's sum adds every 4th gap and keeps the quantization — ~±4–5 s (1σ) per in-game year at late-game levels (F218 §7), so a
//   single-sub-tick bin of a few days is mostly noise. Default --days slots (all four) are exact.
// ⚠ A mirror can start with an earlier session's lines and carry re-copied chunks (L28); only the last campaign start (the last
//   `1836.1.1.6` tick) and strictly forward ticks are read, so a crash-resume's replay is never counted twice.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const RE = /^\[(\d\d):(\d\d):(\d\d)\]\[jominiapplication\.cpp:\d+\]: Processing Tick: (\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/;
const ML = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CUM = ML.reduce((a, x, i) => (a.push(i ? a[i - 1] + ML[i - 1] : 0), a), []);

export function parseTicks(runDir) {
  const p = join(runDir, 'logs_live', 'dedicated_server.log'); if (!existsSync(p)) return null;
  const lines = readFileSync(p, 'latin1').split('\n');
  let start = 0; for (let i = 0; i < lines.length; i++) if (lines[i].includes('Processing Tick: 1836.1.1.6')) start = i;
  const out = []; let maxKey = -1, prevAbs = null, day = 0, prevClk = null, prev = null;
  for (let i = start; i < lines.length; i++) {
    const m = RE.exec(lines[i]); if (!m) continue;
    const clk = +m[1] * 3600 + +m[2] * 60 + +m[3];
    const y = +m[4], mo = +m[5], d = +m[6], h = m[7] ? +m[7] : 0;
    const dayIdx = (y - 1836) * 365 + CUM[mo - 1] + d - 1, key = dayIdx * 4 + h / 6;
    if (prevClk != null && clk < prevClk - 43200) day++;
    prevClk = clk; const abs = day * 86400 + clk;
    if (key <= maxKey) { prevAbs = abs; prev = null; continue; }        // a replay or a re-copied chunk: break the chain
    if (prev && key === maxKey + 1 && prevAbs != null) { const dt = abs - prevAbs; if (dt >= 0 && dt < 600) prev.t = dt; }
    const rec = { y, m: mo, d, h, dayIdx, t: null }; out.push(rec); prev = rec; maxKey = key; prevAbs = abs;
  }
  return out.filter(r => r.t != null);
}

if ((process.argv[1] || '').endsWith('tick_profile.mjs')) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const run = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!run) { console.error('usage: tick_profile.mjs <session>/<run> [--from Y] [--to Y] [--long S] [--days a,b [--slots 6,12,18] [--bin 5]]'); process.exit(2); }
  const dir = isAbsolute(run) || existsSync(run) ? run : join(SES, run);
  const T = parseTicks(dir); if (!T) { console.error(`no logs_live/dedicated_server.log under ${dir}`); process.exit(1); }
  const from = +opt('--from', 1836), to = +opt('--to', 1936);
  if (args.includes('--days')) {
    const [a, b] = opt('--days').split(',').map(s => s.split('.').map(Number)); const slots = opt('--slots', '0,6,12,18').split(',').map(Number), bin = +opt('--bin', 5);
    const k = x => x[0] * 10000 + x[1] * 100 + x[2];
    const S = T.filter(t => k([t.y, t.m, t.d]) >= k(a) && k([t.y, t.m, t.d]) < k(b)); const out = [];
    for (let i = 0; i < S.length; i += 4 * bin) { const sl = S.slice(i, i + 4 * bin); out.push(`${sl[0].y}.${sl[0].m}.${sl[0].d} ${sl.filter(t => slots.includes(t.h)).reduce((s, t) => s + t.t, 0)}`); }
    console.log(`seconds in sub-ticks ${slots.join('/')} per ${bin} days:`); console.log(out.join(' · '));
  } else if (args.includes('--long')) {
    const th = +opt('--long', 3);
    console.log(T.filter(t => t.y >= from && t.y < to && t.t >= th).map(t => `${t.y}.${t.m}.${t.d}.${t.h}:${t.t}s`).join('  '));
  } else {
    const Y = {};
    for (const t of T) { if (t.y < from || t.y >= to) continue; const o = (Y[t.y] ||= { tot: 0, n: 0, h: [0, 0, 0, 0], long: 0, longS: 0 }); o.tot += t.t; o.n++; o.h[t.h / 6] += t.t; if (t.t >= 3) { o.long++; o.longS += t.t; } }
    console.log('year   s/yr   h0   h6  h12  h18   ticks≥3s (their s)   [ticks counted]');
    for (const [y, o] of Object.entries(Y)) console.log(`${y} ${String(o.tot).padStart(6)} ${o.h.map(x => String(x).padStart(4)).join(' ')}   ${String(o.long).padStart(4)} (${o.longS})`.padEnd(48) + (o.n < 1440 ? `   [${o.n} of 1460]` : ''));
  }
}
