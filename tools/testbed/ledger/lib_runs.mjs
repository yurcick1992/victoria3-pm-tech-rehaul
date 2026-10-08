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
import { createHash } from 'node:crypto';

const parseDate = s => String(s || '').split('.').map(Number);
const reached = (got, want) => {
  const a = parseDate(got), b = parseDate(want);
  if (a.length < 3 || b.length < 3 || a.some(isNaN) || b.some(isNaN)) return false;
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return true;
};

// ⭐ POOLING TWO SESSIONS OF ONE ARM. `session` may be a COMMA-SEPARATED list, in which case each is
//   walked by the SAME rule and the results concatenate. This exists because a batch is sometimes
//   split across nights — the flat-cost arm ran n=2 and then n=5 at a byte-identical setup, and the
//   two only answer the question TOGETHER.
// ⚠⚠ POOLING IS ONLY LEGITIMATE WHEN THE SETUP IS IDENTICAL. Two sessions built from different
//   configs are two arms, and folding them is the same error the multi-arm guard below refuses —
//   it just cannot be detected from the folder names. The CALLER must have checked; state it in the
//   schedule’s _why, as 20260831_192428 does ("byte-identical setup ... mtime predates that batch").
// ⭐ A GROUP OF RUNS, NOT ONLY OF SESSIONS (2026-10-08, the user: "support random grouping of similar-config runs"): an item of the
//   list may also be ONE run folder, `<session>/runNNN_<setup>`, judged by the same rule — so a report can pool two sessions of one
//   book, or pick runs out of several. `configGroups()` below is the check that the group really is one configuration.
export function usableRunsPooled(sesRoot, sessions, setup = '') {
  const list = String(sessions).split(',').map(s => s.trim()).filter(Boolean);
  const runs = [], dropped = [];
  for (const s of list) {
    if (s.includes('/')) {
      const [ses, d] = s.split('/'); const r = usableRuns(sesRoot, ses, d.replace(/^run\d+_/, ''));
      const hit = r.runs.filter(x => x === `${ses}/${d}`), miss = r.dropped.filter(x => x.run === d);
      if (!hit.length && !miss.length) throw new Error(`no such run: ${s}`);
      runs.push(...hit); dropped.push(...miss); continue;
    }
    const r = usableRuns(sesRoot, s, setup); runs.push(...r.runs); dropped.push(...r.dropped);
  }
  return { runs, dropped };
}

// ⭐ IS A GROUP OF RUNS ONE FAMILY? (user-ruled 2026-10-08: "the hard requirement for the build to be identical is an overkill. It should
//   belong to the same family … shouldn't have different tier or building structure. But lumping together slightly different approaches to
//   ladder coefficients could have merit. And joining together before-fix and after-fix builds on minor bugfixes is definitely OK.")
//   A FAMILY = the same tier / building STRUCTURE: every enabled industry, each rung's key and era, and which rungs are crafts or merged
//   methods — read from the config each run was built from (build_state.json → mod_under_test.built_from_config). Coefficients (A, B, cost,
//   recipes, ai_value), defines and the emitted build may differ inside a family; configFamilies() reports those differences so the report
//   can say them, and the caller STOPS only on more than one family. A run whose config cannot be read is its own family ("unknown").
//   ⚠ The config is read from its path TODAY: if that file was regenerated after the run, its sha256 no longer matches the recorded one and
//   the row says so (`config_changed`) — the structure then comes from the current file, which is usually still right but is not proven.
export function configFamilies(sesRoot, runs) {
  const fams = new Map();
  for (const r of runs) {
    let struct = 'unknown:' + r, cfgSha = '?', build = '?', changed = false, cfgPath = '?';
    try {
      const m = JSON.parse(readFileSync(join(sesRoot, r, 'build_state.json'), 'utf8')).deterministic.mod_under_test;
      cfgSha = m.config_sha256 || '?'; build = `${m.fingerprint?.layout_sha256 || '?'}|${m.fingerprint?.bytes ?? '?'}`; cfgPath = m.built_from_config || '?';
      const raw = readFileSync(cfgPath, 'utf8');
      changed = cfgSha !== '?' && !cfgSha.startsWith(createHash('sha256').update(raw).digest('hex').slice(0, cfgSha.length));
      const cfg = JSON.parse(raw);
      struct = JSON.stringify((cfg.industries || []).filter(i => !i.disabled).map(i => [i.id, (i.tiers || []).map(t => [t.key, t.era, t.method_of || null, !!t.craft])])
        .sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    } catch {}
    const key = createHash('sha256').update(struct).digest('hex').slice(0, 12);
    if (!fams.has(key)) fams.set(key, { family: key, runs: [], configs: new Map(), builds: new Set(), changed: [] });
    const f = fams.get(key); f.runs.push(r); f.builds.add(build);
    if (!f.configs.has(cfgSha)) f.configs.set(cfgSha, { sha: cfgSha, path: cfgPath, runs: 0 }); f.configs.get(cfgSha).runs++;
    if (changed) f.changed.push(r);
  }
  return [...fams.values()].map(f => ({ ...f, configs: [...f.configs.values()], builds: [...f.builds] }));
}

// the stricter, older test: one group per (config sha256, emitted build) — kept as a reading (a family with more than one group pools
// coefficient variants or bugfix rebuilds, which is allowed and should be stated)
export function configGroups(sesRoot, runs) {
  const groups = new Map();
  for (const r of runs) {
    let key = 'unknown:' + r;
    try {
      const m = JSON.parse(readFileSync(join(sesRoot, r, 'build_state.json'), 'utf8')).deterministic.mod_under_test;
      key = `${m.config_sha256 || '?'}|${m.fingerprint?.layout_sha256 || '?'}|${m.fingerprint?.bytes ?? '?'}`;
    } catch {}
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r);
  }
  return [...groups].map(([key, rs]) => ({ key, runs: rs }));
}

export function usableRuns(sesRoot, session, setup = '') {
  if (String(session).includes(',') || String(session).includes('/')) return usableRunsPooled(sesRoot, session, setup);
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
    // L34 (2026-09-17): a run that 'reached' its until date with NO CAMPAIGN behind it - a crash before the first autosave, the
    // restart launched with -continuelastsave, the machine's newest save (another run's endpoint) loaded AT the target, 169 s, 'complete'.
    // A century run carries >= 15 yearly-or-five-yearly summaries; a foreign landing carries one or two.
    const span = (parseDate(m.until_date)[0] || 0) - 1836;
    const sums = readdirSync(join(root, d, 'save_summaries')).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).length;
    if (span >= 5 && sums <= 2) {
      dropped.push({ run: d, reached: m.reached_ingame_date, until: m.until_date, reason: `reached its until date in ${Math.round(+m.wall_seconds || 0)} s with ${sums} summary(ies) - a resume loaded a FOREIGN save at the target (L34)` });
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
