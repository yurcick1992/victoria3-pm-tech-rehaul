// TEXTILE'S RUNGS AND THEIR LUXURY LINES IN THE SHORTLIST (2026-10-03, FINDINGS F211) — why the e1 textile rung survives in one book and dies
// in another. Per rung (a merge host's levels split by the main method each runs, from the summary's `pms`), summed over the shortlist pool
// (main records), MEDIAN over runs: levels, staffed levels, the levels running Craftsman Sewing (clothes + silk -> luxury clothes) and
// Elastics, and the rung's profit per staffed level (£ a week; a host's profit shared by its levels). The luxury lines are each rung's own
// minted copy (`pm_craftsman_sewing_<rung key>`), or any copy on a building with one main method.
//   node tools/testbed/ledger/textile_luxury.mjs [--year 1935] [--scope pool|world] [--runs] <label>=<session>[:<setup>] [...]
//   --scope world sums every country record instead of the pool's main records; --runs adds one line per run under each median (2026-10-03,
//   for placing a one-seed probe inside or outside its references' spread).
import fs from 'node:fs'; import path from 'node:path';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { indexRun, firstOf, readSum, SESSIONS, med } from './lib_sumidx.mjs';
import { POOL as POOL_LIST } from './lib_markets.mjs';
const argv = process.argv.slice(2); const i = argv.indexOf('--year'); const YEAR = i >= 0 ? +argv.splice(i, 2)[1] : 1935;
const j = argv.indexOf('--scope'); const SCOPE = j >= 0 ? argv.splice(j, 2)[1] : 'pool';
if (!['pool', 'world'].includes(SCOPE)) { console.error('--scope is pool or world'); process.exit(1); }
const k = argv.indexOf('--runs'); const RUNS = k >= 0 ? !!argv.splice(k, 1) : false;
if (!argv.length) { console.error('usage: textile_luxury.mjs [--year Y] [--scope pool|world] [--runs] <label>=<session>[:<setup>] […]'); process.exit(1); }
const POOL = new Set(POOL_LIST); const dropped = [];
for (const arg of argv) {
  const [label, spec] = arg.split('='); const [sess, setup] = spec.split(':'); const u = usableRuns(SESSIONS, sess, setup || ''); dropped.push(...u.dropped); const per = [];
  for (const rel of u.runs) {
    const dir = path.join(SESSIONS, rel); const bs = JSON.parse(fs.readFileSync(path.join(dir, 'build_state.json'), 'utf8').replace(/^﻿/, ''));
    const cfg = JSON.parse(fs.readFileSync(bs.deterministic.mod_under_test.built_from_config, 'utf8').replace(/^﻿/, ''));
    const T = cfg.industries.find(x => x.id === 'textile'); if (!T || T.disabled) continue;
    const idx = indexRun(dir); const f = firstOf(idx, YEAR); if (!f) continue; const s = readSum(idx[f]); const acc = {};
    for (const [tag, c] of Object.entries(s.countries)) { if (SCOPE === 'pool' && !POOL.has(tag)) continue;
      for (const t of T.tiers) { if (t.method_of) continue; const b = c.buildings?.[t.key]; if (!b) continue;
        const mains = T.tiers.filter(x => (x.method_of || x.key) === t.key);
        const byMain = {}; for (const m of mains) byMain['e' + m.era] = mains.length === 1 ? b.levels : (b.pms?.[m.pm_key] || 0);
        const lvTot = Object.values(byMain).reduce((x, y) => x + y, 0) || b.levels;
        for (const [e, lv] of Object.entries(byMain)) { const share = lvTot ? lv / lvTot : 0; const a = (acc[e] ||= { lv: 0, st: 0, profit: 0, cs: 0, el: 0 });
          a.lv += lv; a.st += (b.staffing || 0) * share; a.profit += (b.profit || 0) * share;
          const sfx = '_' + mains.find(m => 'e' + m.era === e).key.replace(/^building_/, '');
          for (const [pm, n] of Object.entries(b.pms || {})) { if (!(pm.endsWith(sfx) || mains.length === 1)) continue; if (/^pm_craftsman_sewing/.test(pm)) a.cs += n; else if (/^pm_elastics/.test(pm)) a.el += n; } } } }
    acc._run = rel.split(/[\\/]/).pop().slice(0, 6);
    per.push(acc);
  }
  const rungs = [...new Set(per.flatMap(a => Object.keys(a)))].filter(e => e !== '_run').sort();
  console.log(`${label} ${YEAR} (n=${per.length}; medians of the ${SCOPE === 'pool' ? "pool's" : "world's"} sums):`);
  for (const e of rungs) { const m = k => med(per.map(a => a[e]?.[k] || 0));
    console.log(`  ${e}: ${m('lv').toFixed(0).padStart(4)} levels (${m('st').toFixed(0).padStart(4)} staffed) · Craftsman Sewing on ${m('cs').toFixed(0).padStart(4)} · Elastics on ${m('el').toFixed(0)} · profit £${(m('profit') / Math.max(1, m('st'))).toFixed(0)} a staffed level a week`);
    if (RUNS) for (const a of per) { const r = a[e] || { lv: 0, st: 0, profit: 0, cs: 0 };
      console.log(`      ${a._run}: ${r.lv.toFixed(0).padStart(4)} levels (${r.st.toFixed(0).padStart(4)} staffed) · Craftsman Sewing on ${r.cs.toFixed(0).padStart(4)} · profit £${(r.profit / Math.max(1, r.st)).toFixed(0)} a staffed level a week`); } }
}
reportDropped(dropped);
