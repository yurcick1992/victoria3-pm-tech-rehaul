// lib_wall.mjs — THE TRUE WALL CLOCK OF A RUN, rebuilt from the observer's own tick lines (2026-09-13).
//
// WHY. meta.json's wall_seconds spans EVERY attempt of a run: a crash-resume adds the crash grace, the
// reload, and the REPLAY of the in-game span between the last autosave and the crash (up to one autosave
// interval, ~2-3 min at the late-century pace). So the observer's total over-counts a run by a few minutes
// per CTD, and row P's "total" compared arms that crash at different rates on different footing
// (the user, 2026-09-13: "all previous wall-clock reports were distorted, and more so for more
// prone-to-CTD builds"). A killed-and-continued run has the opposite defect: its meta carries only the
// last launch.
//
// WHAT. run.log carries, every 20 s, `...N s  in-game DATE` — the elapsed seconds OF THAT ATTEMPT (the
// counter restarts on each launch) and the in-game date — plus the attempt boundaries ("run N/M starting",
// "run N resume attempt K from the last autosave (was at DATE)", "run N finished"). From those:
//   load_first  = the first attempt's seconds to its landing tick (starting the game: a player waits for it)
//   play_i      = seconds from attempt i's landing tick to its last tick (or its recorded end)
//   replay_i    = for i > 1, seconds from the landing until the date the previous attempt had reached
//   wall_play   = load_first + Σ play_i − Σ replay_i          ← the century, once, without crash overhead
//   overhead    = wall_meta − wall_play                        ← grace + reloads + replays (+ any gap)
// The landing tick is the first tick whose date lies inside [previous end − 6 y, previous end + 1 y]
// (the autosave ring), which also discards STALE ticks — the observer trusts the previous session's log
// lines for its first seconds after a launch (BUGS_AND_FIXES 2026-09-10 and 2026-09-13), so a fresh 1836
// start can log "in-game 1934.8.10" at 20 s; a date window is the only filter that survives that.
// A launch whose ticks never enter the window (a failed continuation) contributes nothing.
//
// CROSS-CHECK. The yearly save-archive stamps carry the same clock per year (report_perf's rate curve
// reads them); the two agree to the tick cadence on a clean run. On the hand-continued run 1 of
// 20260910_151220 this reproduces the by-hand reconstruction exactly (12,952 s).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const asYear = d => { const [y, m = 1, dd = 1] = String(d).split('.').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
const TICK = /^\[(\d\d):(\d\d):(\d\d)\] \[INFO\]\s+\.\.\.\s*([\d\s   ]+)s\s+in-game (\S+)/;
const START = /^\[(\d\d):(\d\d):(\d\d)\] \[INFO\] run \d+\/\d+ starting/;
const RESUME = /^\[(\d\d):(\d\d):(\d\d)\] \[INFO\] run \d+ resume attempt (\d+) from the last autosave \(was at ([\d.]+)\)/;
const FINISH = /^\[(\d\d):(\d\d):(\d\d)\] \[INFO\] run \d+ finished: ([\d\s   ]+)[,.](\d)s wall over (\d+) attempt/;

/** Parse a run folder's run.log into attempts with their ticks. */
export function parseRunLog(runDir) {
  const p = join(runDir, 'run.log');
  if (!existsSync(p)) return null;
  const attempts = [];
  let cur = null;
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '');
    let m;
    if ((m = START.exec(line))) { cur = { kind: 'start', resumedFrom: null, ticks: [], finished: null }; attempts.push(cur); continue; }
    if ((m = RESUME.exec(line))) { cur = { kind: 'resume', resumedFrom: m[5], ticks: [], finished: null }; attempts.push(cur); continue; }
    if (cur && (m = TICK.exec(line))) {
      const secs = Number(m[4].replace(/\D/g, ''));
      if (m[5] === 'loading') continue;
      cur.ticks.push({ secs, date: m[5], year: asYear(m[5]) });
      continue;
    }
    if (cur && (m = FINISH.exec(line))) { cur.finished = Number(m[4].replace(/\D/g, '') + '.' + m[5]); continue; }
  }
  return attempts;
}

/**
 * The true wall clock of one run. Returns null when run.log is absent or has no usable attempt.
 * @param runDir  the run folder
 * @param meta    its meta.json (for wall_seconds; optional)
 */
export function wallFromTicks(runDir, meta = null) {
  const attempts = parseRunLog(runDir);
  if (!attempts || !attempts.length) return null;
  let prevEndYear = asYear('1836.1.1'), prevEndDate = '1836.1.1';
  let loadFirst = null, play = 0, replay = 0, used = 0;
  const detail = [];
  for (const a of attempts) {
    const lo = prevEndYear - 6, hi = prevEndYear + 1;
    // After a launch the observer serves the PREVIOUS attempt's last tick lines for up to ~100 s (the stale tail,
    // BUGS_AND_FIXES 2026-09-10); their dates sit just below the previous end and would pass the window as a
    // landing at 20 s. The real landing is the tick after the LAST backward date jump inside the first 400 s.
    let li = -1;
    const t0 = a.ticks.length ? a.ticks[0].secs : 0;   // the counter runs from the observer's start, across resumes
    for (let i = 1; i < a.ticks.length && a.ticks[i].secs - t0 <= 400; i++) if (a.ticks[i].year < a.ticks[i - 1].year) li = i;
    if (li < 0 || !(a.ticks[li].year >= lo && a.ticks[li].year <= hi)) li = a.ticks.findIndex(t => t.year >= lo && t.year <= hi);
    if (li < 0) { detail.push({ kind: a.kind, used: false, ticks: a.ticks.length, note: 'no landing inside the autosave window' }); continue; }
    const land = a.ticks[li];
    const last = a.ticks[a.ticks.length - 1];
    const end = Math.max(last.secs, land.secs);
    const p = end - land.secs;
    let r = 0;
    if (used > 0) {                       // a resume or a continuation: drop the ground it re-treads
      const ri = a.ticks.findIndex((t, i) => i >= li && t.year >= prevEndYear);
      r = ri >= 0 ? a.ticks[ri].secs - land.secs : p;   // never caught up with the previous end: all of it is replay
    } else { loadFirst = land.secs; }
    play += p; replay += r; used++;
    detail.push({ kind: a.kind, used: true, landing: land.date, landing_secs: land.secs, end: last.date, end_secs: end, play_secs: p, replay_secs: r, resumed_from: a.resumedFrom, previous_end: prevEndDate });
    if (last.year > prevEndYear) { prevEndYear = last.year; prevEndDate = last.date; }
  }
  if (!used) return null;
  const wallPlay = Math.round((loadFirst ?? 0) + play - replay);
  const wallMeta = meta && Number.isFinite(+meta.wall_seconds) ? +meta.wall_seconds : null;
  return {
    wall_play: wallPlay, load_first: loadFirst, play_secs: Math.round(play), replay_secs: Math.round(replay),
    wall_meta: wallMeta, overhead_secs: wallMeta != null ? Math.round(wallMeta - wallPlay) : null,
    attempts_seen: attempts.length, attempts_used: used, detail,
  };
}
