// THE SLOWDOWN QUARANTINE JUDGE (user-ruled 2026-10-07): which yearly autosaves of a run are KEPT for a later debug-mode look at what
// slowed the game, and which the harvester may reap. Called by harvest_saves.ps1 before it deletes a summarised save; non-agentic.
//
//   node tools/testbed/slow_quarantine.mjs <runDir> [--final] [--k 3] [--sigma 0.070] [--min-len 2]
//   → JSON on stdout: { complete_through, periods:[{start,end,peak}], keep_years:[…], decisions:{ <save file name>: keep|release|wait } }
//     and the same written to <runDir>/slow_periods.json (overwritten each call).
//
// THE RULING: "every year during a meaningfully slowed period is quarantined and then two in a row when the period ends, unless the game
// ended", with a strong meaningfulness line (the user's preference: at least three sigma over last year).
// THE MEASURE: wall seconds per in-game year from the game's own per-tick log (logs_live/dedicated_server.log, tick_profile.mjs's
// parseTicks), the ticks either side of every month boundary dropped (the autosave and the monthly pulse — the same for every save
// cadence) and the rest scaled to 1,460 ticks; a year with under 1,100 usable ticks (a crash-resume, the run's last partial year) is
// SKIPPED, neither normal nor slowed.
// THE LINE: year Y is SLOWED when ln t(Y) exceeds the BASELINE by more than K·σ (default 3 × 0.070 ⇒ +23%). The baseline is the median of
// the last three NORMAL years' ln t, each projected forward to Y by the corpus's expected growth G; it is FROZEN while a period runs (a
// trailing baseline would absorb a long slowdown — jex-n16 run 3, 3–4× in 1890–1903, read only +30–40% against one). σ = 0.070 is the
// robust (MAD) spread of exactly this residual over 32,005 run-years of 354 century runs (2026-07-31 → 2026-10-07), median +0.0002.
// "Last year" is read as "the last three normal years" so one unusually fast year cannot fake a jump.
// A PERIOD = consecutive slowed years; it counts only at ≥ --min-len (default 2) years — a one-year spike (a war's opening, a big event)
// is released. Quarantined: every save dated 1 January of a year in a counted period, and of the TWO years after it ends (unless the
// game ended first). On the corpus: 182 of 354 runs carry such a period, ~4 saves a run on average (~0.2 GB).
// DECISIONS: a save of year Y can be judged once years up to Y + min-len − 1 are complete (so a period's length and end are known);
// before that it is `wait`. With --final (the run is over) every save is judged on what exists. A save that is not 1 January (a
// quarterly cadence) is released: the ruling keeps one save per year. ⚠ The judge never deletes anything — the harvester acts.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { parseTicks } from './ledger/tick_profile.mjs';

// expected yearly growth of ln t (1837 … 1935): the corpus median of ln t(Y)/t(Y−1), smoothed ±5 years — the same 354 runs as σ
const G = [0.012,0.012,0.013,0.011,0.012,0.012,0.017,0.015,0.012,0.008,0.005,0.007,0.007,0.006,0.006,0.004,0.004,0.004,0.005,0.005,0.005,
  0.005,0.004,0.004,0.004,0.005,0.005,0.004,0.004,0.002,0.002,0.001,0.004,0.004,0.004,0.004,0.002,0.003,0.004,0.005,0.005,0.006,0.007,0.005,
  0.006,0.005,0.006,0.007,0.007,0.007,0.007,0.008,0.007,0.008,0.009,0.009,0.01,0.01,0.011,0.01,0.012,0.012,0.012,0.013,0.012,0.013,0.013,
  0.013,0.014,0.013,0.013,0.013,0.014,0.014,0.014,0.014,0.014,0.014,0.013,0.013,0.012,0.014,0.013,0.012,0.013,0.012,0.013,0.011,0.012,0.014,
  0.013,0.013,0.013,0.013,0.014,0.014,0.014,0.014,0.016];
const g = y => G[y - 1837] ?? 0.012;
const ML = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const med = v => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

export function yearTimes(runDir) {
  const T = parseTicks(runDir); if (!T || !T.length) return { ty: {}, complete: 1836 };
  const Y = {};
  for (const t of T) { if (t.d === 1 || (t.d === ML[t.m - 1] && t.h === 18)) continue; const o = (Y[t.y] ||= [0, 0]); o[0] += t.t; o[1]++; }
  const ty = {}; for (const [y, [s, n]] of Object.entries(Y)) if (n >= 1100) ty[y] = s * 1460 / n;
  // a year is COMPLETE once the log has reached its last tick (31 December, 18:00) or the next year
  const L = T[T.length - 1];
  return { ty, complete: L.m === 12 && L.d === 31 && L.h === 18 ? L.y : L.y - 1 };
}

export function slowPeriods(ty, { k = 3, sigma = 0.070, through = 1936 } = {}) {
  const P = []; let hist = [], cur = null;
  for (let y = 1837; y <= through; y++) {
    const t = ty[y]; if (!t) continue;                                  // a skipped year neither extends nor resets anything
    const lt = Math.log(t);
    if (hist.length >= 3) {
      const base = med(hist.map(([yy, l]) => { let s = l; for (let z = yy + 1; z <= y; z++) s += g(z); return s; }));
      const ex = lt - base;
      if (ex > k * sigma) { if (!cur) cur = { start: y, end: y, peak: ex }; else { cur.end = y; cur.peak = Math.max(cur.peak, ex); } continue; }
    }
    if (cur) { P.push(cur); cur = null; }
    hist.push([y, lt]); if (hist.length > 3) hist.shift();
  }
  if (cur) P.push({ ...cur, open: true });
  return P.map(p => ({ ...p, peak_pct: Math.round(100 * (Math.exp(p.peak) - 1)) }));
}

function saveDate(runDir, file) {
  const stem = path.basename(file, '.v3'), sum = path.join(runDir, 'save_summaries', stem + '.json.gz');
  if (!fs.existsSync(sum)) return null;
  const fd = fs.openSync(sum, 'r'); const b = Buffer.alloc(4096); const n = fs.readSync(fd, b, 0, 4096, 0); fs.closeSync(fd);
  let txt = ''; try { txt = zlib.gunzipSync(b.subarray(0, n), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8'); } catch { return null; }
  const m = /"date":"(\d+)\.(\d+)\.(\d+)"/.exec(txt); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

if ((process.argv[1] || '').endsWith('slow_quarantine.mjs')) {
  const a = process.argv.slice(2), opt = (key, d) => { const i = a.indexOf(key); return i >= 0 ? a[i + 1] : d; };
  const runDir = a.find((x, i) => !x.startsWith('--') && !a[i - 1]?.startsWith('--'));
  if (!runDir) { console.error('usage: slow_quarantine.mjs <runDir> [--final] [--k 3] [--sigma 0.070] [--min-len 2]'); process.exit(2); }
  const FINAL = a.includes('--final'), K = +opt('--k', 3), SIG = +opt('--sigma', 0.070), MINLEN = +opt('--min-len', 2);
  const { ty, complete } = yearTimes(runDir);
  const periods = slowPeriods(ty, { k: K, sigma: SIG, through: complete });
  const counted = periods.filter(p => p.end - p.start + 1 >= MINLEN);
  const keep = new Set();
  for (const p of counted) { for (let y = p.start; y <= p.end; y++) keep.add(y); if (!p.open) { keep.add(p.end + 1); keep.add(p.end + 2); } }
  const decisions = {};
  const sv = path.join(runDir, 'saves');
  for (const f of fs.existsSync(sv) ? fs.readdirSync(sv).filter(x => x.endsWith('.v3')) : []) {
    const d = saveDate(runDir, f); if (!d) { decisions[f] = 'wait'; continue; }           // not summarised yet: the harvester's job first
    if (!(d.m === 1 && d.d === 1)) { decisions[f] = 'release'; continue; }
    const Y = d.y;
    if (keep.has(Y)) decisions[f] = 'keep';
    else if (FINAL || Y + MINLEN - 1 <= complete) {
      // an OPEN period (the slowdown still running at the last complete year) keeps the years after it too, once they come
      const open = periods.find(p => p.open && Y >= p.start);
      decisions[f] = open && (FINAL ? open.end - open.start + 1 >= MINLEN : true) ? (FINAL ? 'keep' : 'wait') : 'release';
    } else decisions[f] = 'wait';
  }
  const out = { judged_at: new Date().toISOString(), final: FINAL, rule: { k: K, sigma: SIG, min_len: MINLEN, line_pct: Math.round(100 * (Math.exp(K * SIG) - 1)) },
                complete_through: complete, periods, keep_years: [...keep].sort(), decisions };
  try { fs.writeFileSync(path.join(runDir, 'slow_periods.json'), JSON.stringify(out, null, 1)); } catch {}
  console.log(JSON.stringify(out));
}
