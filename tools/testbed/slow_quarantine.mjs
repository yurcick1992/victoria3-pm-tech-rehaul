// THE SLOWDOWN QUARANTINE JUDGE (user-ruled 2026-10-07, the rule amended the same day): which yearly autosaves of a run are KEPT for a
// later debug-mode look at what slowed the game (the game shows each subtask's tick time in ms in debug mode — MODDING_NOTES), and which
// the harvester may reap. Called by harvest_saves.ps1 before it deletes a summarised save; non-agentic.
//
//   node tools/testbed/slow_quarantine.mjs <runDir> [--final] [--k 3] [--restore 2]
//   → JSON on stdout: { complete_through, episodes:[…], decisions:{ <save file>: { action: keep|release|wait, as?: <quarantine name> } } }
//     and <runDir>/slow_periods.json; when an episode exists, <runDir>/quarantine_saves/MANIFEST.md (what to compare with what).
//
// THE RULING: "An 'episode' is when at least three consecutive years the difference between year X and year X-3 is over 3 sigma. The end of
// the episode is when the speed is restored. We quarantine all saves during the episode and two after, but no more than 5 within episode
// (earliest four and the last one stays)" — and the two after only "unless the game ended".
// THE MEASURE: t(Y) = wall seconds per in-game year from the game's own per-tick log (logs_live/dedicated_server.log via tick_profile.mjs's
// parseTicks), the ticks either side of every month boundary dropped (the autosave and the monthly pulse; the same for any save cadence),
// the rest scaled to 1,460 ticks; a year with under 1,100 usable ticks (a crash-resume, a partial last year) is SKIPPED.
// dL(X) = ln t(X) − ln t(X−L) − the corpus's expected growth over those L years (G below), for L = 3 (the ruling) AND — user-approved
// the same day, after the 3-year form was measured to miss half the real slowdowns — L = 6 and L = 10: a fleet loop's cost RAMPS ~6–8% a
// year for a decade and then drops off a cliff, so it never gains +32% within three years (canon-je24 run 18: 81 → 272 s/yr over 1882–99;
// b-gradient run 1: 89 → 364 over 1858–89, never flagged). σ_L, the robust (MAD) spread of dL over the 354 century runs of
// 2026-07-31 → 2026-10-07: 0.092 / 0.102 / 0.109 ⇒ the 3σ lines are +32% / +36% / +39%.
// AN EPISODE starts at the first X with dL > 3σ_L at X, X+1 and X+2 for one lag L (tried 3, 6, 10 in that order). ITS END ("speed restored")
// = the last year before the first year after X+2 whose t falls back within 2σ1 (+15%; σ1 = 0.070, the one-year spread of the same corpus)
// of the PRE-EPISODE SPEED — the median of t(X−L−2 … X−L), projected to that year by G — the reading of "restored" the user accepted
// (2026-10-07). Then the search resumes after the end. On the corpus: 78 of 354 runs carry an episode (12 of 56 vanilla runs; the 3-year
// form alone 51 and 9); of 36 slow runs the 3-year form missed, the three lags catch 18 — every large ramp; still missed by design are
// two-year bursts and slowness spread thinly over a whole run.
// KEPT, per episode: the 1 January save of year X−L (the year the rule compares against — "before", user-asked 2026-10-07), those of its
// first four years and of its LAST year (≤ 5), and of the two years after it unless the run ended first. Saves are RENAMED on the way in —
// <session>__<run>__<YYYY-MM-DD>__ep<N>_<role>.v3, role ∈ before / in1..in4 / last / after1 / after2 (a save serving two episodes keeps
// the first name it got; the MANIFEST points at it from both) — so a copy taken anywhere still says what it is; the MANIFEST says what to
// compare with what.
// DECISIONS: a save of year Y is judged once years up to Y + 12 are complete (it may be the "before" of a 10-year-lag episode starting at
// Y + 10, which is only known at Y + 12 — so ~13 saves, ~650 MB, sit unjudged in saves\ at any time); a save in an
// episode beyond its fourth year waits until the episode ends (only the last of them is kept). With --final (the run is over) everything
// is judged on what exists. A save that is not 1 January (a quarterly cadence) is released. ⚠ The judge never deletes anything.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { parseTicks } from './ledger/tick_profile.mjs';

// expected yearly growth of ln t (1837 … 1935): the corpus median of ln t(Y)/t(Y−1), smoothed ±5 years — the same 354 runs as σ
const G = [0.012,0.012,0.013,0.011,0.012,0.012,0.017,0.015,0.012,0.008,0.005,0.007,0.007,0.006,0.006,0.004,0.004,0.004,0.005,0.005,0.005,
  0.005,0.004,0.004,0.004,0.005,0.005,0.004,0.004,0.002,0.002,0.001,0.004,0.004,0.004,0.004,0.002,0.003,0.004,0.005,0.005,0.006,0.007,0.005,
  0.006,0.005,0.006,0.007,0.007,0.007,0.007,0.008,0.007,0.008,0.009,0.009,0.01,0.01,0.011,0.01,0.012,0.012,0.012,0.013,0.012,0.013,0.013,
  0.013,0.014,0.013,0.013,0.013,0.014,0.014,0.014,0.014,0.014,0.014,0.013,0.013,0.012,0.014,0.013,0.012,0.013,0.012,0.013,0.011,0.012,0.014,
  0.013,0.013,0.013,0.013,0.014,0.014,0.014,0.014,0.016];
const g = y => G[y - 1837] ?? 0.012;
const gs = (a, b) => { let s = 0; for (let z = a + 1; z <= b; z++) s += g(z); return s; };
export const SIGMA3 = 0.092, SIGMA1 = 0.070;
// the comparison lags and their σ (MAD of the growth-adjusted ln t(X)/t(X−L) over the same 354 runs; 3σ ⇒ +32% / +36% / +39%)
export const LAGS = [{ L: 3, sigma: 0.092 }, { L: 6, sigma: 0.102 }, { L: 10, sigma: 0.109 }];
export const HOLD = Math.max(...LAGS.map(l => l.L)) + 2;    // a save of year Y may be the `before` of an episode known only at Y + HOLD
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

// episodes over the complete years; `open` = still running at the last complete year
export function episodes(ty, { k = 3, restore = 2, through = 1936 } = {}) {
  const dL = (y, L) => ty[y] && ty[y - L] ? Math.log(ty[y] / ty[y - L]) - gs(y - L, y) : null;
  const E = []; let y = 1839;
  while (y + 2 <= through) {
    // the first lag (3, then 6, then 10) whose difference stays over its 3σ for X, X+1 and X+2
    const lag = LAGS.find(({ L, sigma }) => [0, 1, 2].every(i => { const v = dL(y + i, L); return v !== null && v > k * sigma; }));
    if (!lag) { y++; continue; }
    const x0 = y, L = lag.L, pre = [x0 - L - 2, x0 - L - 1, x0 - L].filter(z => ty[z]);
    const base = z => med(pre.map(p => Math.log(ty[p]) + gs(p, z)));
    let end = x0 + 2, peak = 0, open = true;
    for (let z = x0; z <= through; z++) {
      if (!ty[z]) continue;
      const ex = Math.log(ty[z]) - base(z);
      if (z > x0 + 2 && ex < restore * SIGMA1) { open = false; break; }
      end = z; peak = Math.max(peak, ex);
    }
    E.push({ start: x0, end, open, lag: L, before: x0 - L, pre_speed_s_per_year: Math.round(Math.exp(base(x0))), peak_pct: Math.round(100 * (Math.exp(peak) - 1)),
             speed_s_per_year: Object.fromEntries(Array.from({ length: end - x0 + 1 }, (_, i) => x0 + i).filter(z => ty[z]).map(z => [z, Math.round(ty[z])])) });
    y = end + 1;
  }
  return E;
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
  if (!runDir) { console.error('usage: slow_quarantine.mjs <runDir> [--final] [--k 3] [--restore 2]'); process.exit(2); }
  const FINAL = a.includes('--final'), K = +opt('--k', 3), RESTORE = +opt('--restore', 2);
  const abs = path.resolve(runDir), RUN = path.basename(abs), SESSION = path.basename(path.dirname(abs));
  const { ty, complete } = yearTimes(runDir);
  const E = episodes(ty, { k: K, restore: RESTORE, through: complete });
  // per episode the (year, role) pairs the ruling keeps; year → the FIRST { ep, role } it got (one save, one name)
  const roleOf = new Map(), pending = new Set();          // pending = in an episode beyond its 4th year, the episode still running
  E.forEach((e, i) => {
    const n = i + 1; e.parts = [[e.before, 'before']];
    for (let y = e.start; y <= e.end; y++) {
      const k = y - e.start + 1;
      if (k <= 4) e.parts.push([y, 'in' + k]);
      else if (y === e.end && (!e.open || FINAL)) e.parts.push([y, 'last']);
      else if (e.open && !FINAL) pending.add(y);
    }
    if (!e.open) e.parts.push([e.end + 1, 'after1'], [e.end + 2, 'after2']);
    for (const [y, role] of e.parts) if (!roleOf.has(y)) roleOf.set(y, { ep: n, role });
  });
  const nameOf = (d, r) => `${SESSION}__${RUN}__${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}__ep${r.ep}_${r.role}.v3`;
  const decisions = {}, planned = [];
  const sv = path.join(runDir, 'saves');
  for (const f of fs.existsSync(sv) ? fs.readdirSync(sv).filter(x => x.endsWith('.v3')).sort() : []) {
    const d = saveDate(runDir, f); if (!d) { decisions[f] = { action: 'wait' }; continue; }   // not summarised yet: the harvester's job first
    if (!(d.m === 1 && d.d === 1)) { decisions[f] = { action: 'release' }; continue; }
    const r = roleOf.get(d.y);
    if (r) { decisions[f] = { action: 'keep', as: nameOf(d, r) }; continue; }
    if (pending.has(d.y)) { decisions[f] = { action: 'wait' }; continue; }
    decisions[f] = FINAL || d.y + HOLD <= complete ? { action: 'release' } : { action: 'wait' };
  }
  const out = { judged_at: new Date().toISOString(), final: FINAL, session: SESSION, run: RUN,
                rule: { k: K, lags: LAGS.map(l => ({ ...l, line_pct: Math.round(100 * (Math.exp(K * l.sigma) - 1)) })), hold_years: HOLD, restore_sigma1: RESTORE, sigma1: SIGMA1,
                        restore_pct: Math.round(100 * (Math.exp(RESTORE * SIGMA1) - 1)) },
                complete_through: complete, episodes: E, decisions };
  try { fs.writeFileSync(path.join(runDir, 'slow_periods.json'), JSON.stringify(out, null, 1)); } catch {}
  // THE MANIFEST: one file a reader opens first — what each kept save is, and what to compare it with
  if (E.length) {
    const qd = path.join(runDir, 'quarantine_saves'); fs.mkdirSync(qd, { recursive: true });
    const have = new Set(fs.readdirSync(qd));
    const L = [`# Slowdown quarantine — ${SESSION} / ${RUN}`, '',
      `Written by tools/testbed/slow_quarantine.mjs (judged ${out.judged_at}${FINAL ? ', final' : ', run still playing'}). Rule (user-ruled 2026-10-07): an EPISODE`,
      `starts when, for three consecutive years X, the wall seconds per in-game year exceed those of year X−L by more than 3σ_L (growth-adjusted), for a lag L of`,
      `${out.rule.lags.map(l => `${l.L} y (+${l.line_pct}%)`).join(', ')} — the longer lags catch a slow steady ramp, the fleet loop's usual shape;`,
      `it ends when the speed is back within +${out.rule.restore_pct}% of the pre-episode speed. Kept: the first four years and the last year of each`,
      `episode, the year X−L it is compared against ('before'), and the two years after it (unless the run ended). Files are 1 January autosaves:`,
      '`<session>__<run>__<in-game date>__ep<N>_<role>.v3`.', '',
      '**What to compare:** in debug mode, load the episode\'s `before` save (normal speed — the year the rule compares against), an `in*` /',
      '`last` save (slowed) and an `after1` / `after2` save (speed restored), and compare each subtask\'s tick time in ms.', ''];
    E.forEach((e, i) => {
      L.push(`## Episode ${i + 1}: ${e.start} → ${e.end}${e.open ? (FINAL ? ' (still slowed when the run ended)' : ' (still running)') : ''}`, '',
        `Pre-episode speed: ~${e.pre_speed_s_per_year} s per in-game year (median of ${e.before - 2}–${e.before}; triggered on the ${e.lag}-year lag). Peak: +${e.peak_pct}% over it.`,
        `Speed in the episode (s per in-game year): ${Object.entries(e.speed_s_per_year).map(([y, s]) => `${y} ${s}`).join(' · ')}`, '');
      const what = role => role === 'before' ? `year ${e.before} = X−${e.lag}, before the episode (normal speed)` : role.startsWith('in') ? `episode year ${role.slice(2)} (slowed)`
        : role === 'last' ? 'the episode\'s last year (slowed)' : `${role === 'after1' ? 'first' : 'second'} year after it (restored)`;
      for (const [y, role] of e.parts) {
        const r = roleOf.get(y), nm = nameOf({ y, m: 1, d: 1 }, r);
        L.push(`- \`${nm}\` — ${what(role)}${r.ep !== i + 1 ? ` (the same save as episode ${r.ep}'s ${r.role})` : ''}${have.has(nm) ? '' : ' — not (yet) here'}`);
      }
      L.push('');
    });
    try { fs.writeFileSync(path.join(qd, 'MANIFEST.md'), L.join('\n')); } catch {}
  }
  console.log(JSON.stringify(out));
}
