// WHICH RUNS OF A SESSION MAY BE COUNTED — one implementation, because two analyses of the same
// batch that disagree about n produce two incomparable answers to the same question.
//
// The rule is landmine L17's: a run counts only if it REACHED its own `until` date and carries no
// `abandoned_reason`. The scheduler derives a run's status from the observer's EXIT CODE, and the
// observer exits 0 even when it abandons a run, so `status: ok` in session.json is not evidence.
// Everything needed is in the run's own meta.json and nothing else reads it — hence this.
//
// ⚠ It DISCOVERS the run folders rather than taking a list. A hardcoded list is how canon-n7's
// stopped-at-1853 run007 would silently enter an n=6 baseline, and how a later run that did finish
// would silently be left out of it.
//
// Usage:  const { runs, dropped } = usableRuns(SES, SESSION)
//         runs    -> ['<session>/run001_x', ...]  relative to SES, sorted
//         dropped -> [{ run, reached, until, reason }]  ALWAYS PRINT THIS; a silent exclusion is
//                    indistinguishable from a run that never existed.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const parseDate = s => String(s || '').split('.').map(Number);
const reached = (got, want) => {
  const a = parseDate(got), b = parseDate(want);
  if (a.length < 3 || b.length < 3 || a.some(isNaN) || b.some(isNaN)) return false;
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return true;
};

export function usableRuns(sesRoot, session) {
  const root = join(sesRoot, session);
  if (!existsSync(root)) throw new Error(`no such session: ${root}`);
  const runs = [], dropped = [];
  for (const d of readdirSync(root).filter(x => /^run\d+_/.test(x)).sort()) {
    const rel = `${session}/${d}`;
    if (!existsSync(join(root, d, 'save_summaries'))) {
      dropped.push({ run: d, reached: '-', until: '-', reason: 'no save_summaries' });
      continue;
    }
    let m = {};
    try { m = JSON.parse(readFileSync(join(root, d, 'meta.json'), 'utf8')); }
    catch { dropped.push({ run: d, reached: '-', until: '-', reason: 'no readable meta.json' }); continue; }
    const why = m.abandoned_reason || '';
    if (why) { dropped.push({ run: d, reached: m.reached_ingame_date, until: m.until_date, reason: why }); continue; }
    if (!reached(m.reached_ingame_date, m.until_date)) {
      dropped.push({ run: d, reached: m.reached_ingame_date, until: m.until_date, reason: 'short of its until date (L17)' });
      continue;
    }
    runs.push(rel);
  }
  return { runs, dropped };
}

export function reportDropped(dropped) {
  if (!dropped.length) return;
  console.log(`\n⚠ ${dropped.length} run(s) EXCLUDED from n (landmine L17):`);
  for (const d of dropped) console.log(`    ${d.run}  reached ${d.reached} of ${d.until}  — ${d.reason}`);
}
