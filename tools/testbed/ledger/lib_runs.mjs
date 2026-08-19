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
// ⚠⚠ A SESSION CAN HOLD MORE THAN ONE ARM, and folding them together is worse than counting a short
// run — it averages two different experiments. `20260813_083557_vanilla-vs-mod-n4` is exactly that:
// four `runNNN_vanilla` folders and two `runNNN_mod` ones. Read whole, its "vanilla" world GDP spread
// comes out £1,181–5,662M, which looks like enormous variance and is actually two arms in one box.
// Hence the `setup` argument: it is the run folder's own suffix (`runNNN_<setup>`), the same name the
// schedule's `setups` block uses. Omit it only for a session you know is single-arm.
//
// Usage:  const { runs, dropped } = usableRuns(SES, SESSION[, setup])
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

export function usableRuns(sesRoot, session, setup = '') {
  const root = join(sesRoot, session);
  if (!existsSync(root)) throw new Error(`no such session: ${root}`);
  const all = readdirSync(root).filter(x => /^run\d+_/.test(x)).sort();
  const setups = [...new Set(all.map(d => d.replace(/^run\d+_/, '')))];
  if (!setup && setups.length > 1)
    throw new Error(`${session} holds ${setups.length} arms (${setups.join(', ')}) — pass a setup name; `
      + `folding two arms into one n averages two different experiments`);
  if (setup && !setups.includes(setup))
    throw new Error(`${session} has no arm '${setup}' — it holds: ${setups.join(', ')}`);
  const runs = [], dropped = [];
  for (const d of all) {
    if (setup && d.replace(/^run\d+_/, '') !== setup) continue;
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
