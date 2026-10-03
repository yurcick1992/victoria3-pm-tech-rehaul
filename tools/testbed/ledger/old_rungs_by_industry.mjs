// OLD RUNGS BESIDE THEIR REPLACEMENT, PER INDUSTRY, ACROSS ARMS (2026-10-03, written for the user's question on F210: "Is this isolated to
// textile, or do more e0/e1 survive in various industries, compared to canon?").
// The rule is lib_era_cols' countrySplit, the ledger's "Who works where" table: a worker counts when his rung is two or more eras behind the
// best rung the SAME country staffs in the SAME industry (a merged host's workers are shared over its main methods at each method's era; on a
// craft book e0 splits into artisans and the rest). Per industry, the MEDIAN over each arm's usable runs of (a) those workers, (b) their share of
// the industry's tiered workers, and [c] the share of the industry's workers on e0/e1 rungs at all, beside a newer rung or not — for the
// shortlist pool (GBR USA FRA NET BEL UNL PRU NGF GER, main records only) and for the world, at one year. Each run is read with its OWN book
// (build_state.json). ⚠ The industries' ladders differ between books (motor is [0,2,3] on the canon and [1,2,3] on the e1-anchor books), so an
// industry's line compares what each book's own ladder calls two eras behind, not the same buildings.
//   node tools/testbed/ledger/old_rungs_by_industry.mjs <year> <label>=<session>[:<setup>] [...]
import fs from 'node:fs'; import path from 'node:path';
import { eraCols } from './lib_era_cols.mjs';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { indexRun, firstOf, readSum, SESSIONS, med } from './lib_sumidx.mjs';
const [year, ...args] = process.argv.slice(2);
if (!year || !args.length) { console.error('usage: old_rungs_by_industry.mjs <year> <label>=<session>[:<setup>] [...]'); process.exit(1); }
const POOL = new Set(['GBR', 'USA', 'FRA', 'NET', 'BEL', 'UNL', 'PRU', 'NGF', 'GER']);
const arms = [], dropped = [];
for (const arg of args) {
  const [label, spec] = arg.split('='); const [sess, setup] = spec.split(':');
  const u = usableRuns(SESSIONS, sess, setup || ''); dropped.push(...u.dropped); const runs = [];
  for (const rel of u.runs) {
    const dir = path.join(SESSIONS, rel); const idx = indexRun(dir); const f = firstOf(idx, +year); if (!f) continue; const s = readSum(idx[f]);
    const bs = JSON.parse(fs.readFileSync(path.join(dir, 'build_state.json'), 'utf8').replace(/^﻿/, ''));
    const cfgPath = bs.deterministic?.mod_under_test?.built_from_config || s.provenance?.built_from_config;
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
    const E = eraCols(cfg); const indOf = {}; for (const I of cfg.industries) { if (I.disabled) continue; for (const t of I.tiers) indOf[t.key] = I.id; }
    const r = { b2: { world: {}, pool: {} }, tot: { world: {}, pool: {} }, low: { world: {}, pool: {} } };
    for (const [key, c] of Object.entries(s.countries)) {
      const tag = key.split('@')[0]; const scopes = ['world', ...(POOL.has(tag) && !key.includes('@') ? ['pool'] : [])];
      const per = {};
      for (const [k, b] of Object.entries(c.buildings || {})) { const ind = indOf[k]; if (!ind) continue;
        for (const [ci, w] of E.parts(k, b)) { if (!(w > 0)) continue; const p = (per[ind] ||= { w: new Array(E.labels.length).fill(0), top: -1 }); p.w[ci] += w; if (E.eraOfCol[ci] > p.top) p.top = E.eraOfCol[ci]; } }
      for (const [ind, p] of Object.entries(per)) p.w.forEach((w, ci) => { for (const sc of scopes) {
        r.tot[sc][ind] = (r.tot[sc][ind] || 0) + w;
        if (E.eraOfCol[ci] <= 1) r.low[sc][ind] = (r.low[sc][ind] || 0) + w;
        if (p.top - E.eraOfCol[ci] >= 2) r.b2[sc][ind] = (r.b2[sc][ind] || 0) + w; } });
    }
    runs.push(r);
  }
  arms.push({ label, runs });
}
const inds = [...new Set(arms.flatMap(a => a.runs.flatMap(r => Object.keys(r.tot.world))))];
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
for (const sc of ['pool', 'world']) {
  console.log(`\n=== ${sc === 'pool' ? 'THE SHORTLIST POOL' : 'THE WORLD'} ${year}: workers on a rung two+ eras behind their country's best in the industry (M, median of runs) · % of the industry's workers · [e0+e1 share of the industry's workers]`);
  console.log('industry'.padEnd(12) + arms.map(a => `${a.label} (n=${a.runs.length})`.padEnd(30)).join(''));
  console.log('ALL TIERED'.padEnd(12) + arms.map(a => { const b = med(a.runs.map(r => sum(r.b2[sc]))), t = med(a.runs.map(r => sum(r.tot[sc]))), p = med(a.runs.map(r => 100 * sum(r.b2[sc]) / sum(r.tot[sc])));
    return `${(b / 1e6).toFixed(2)}M ${p.toFixed(1)}% of ${(t / 1e6).toFixed(1)}M`.padEnd(30); }).join(''));
  const order = inds.map(ind => [ind, Math.max(...arms.map(a => med(a.runs.map(r => r.b2[sc][ind] || 0))))]).sort((x, y) => y[1] - x[1]);
  for (const [ind] of order) console.log(ind.padEnd(12) + arms.map(a => {
    const b = med(a.runs.map(r => r.b2[sc][ind] || 0)), p = med(a.runs.map(r => r.tot[sc][ind] ? 100 * (r.b2[sc][ind] || 0) / r.tot[sc][ind] : 0)), lo = med(a.runs.map(r => r.tot[sc][ind] ? 100 * (r.low[sc][ind] || 0) / r.tot[sc][ind] : 0));
    return `${(b / 1e6).toFixed(2)}M ${p.toFixed(0).padStart(2)}% [${lo.toFixed(0)}%]`.padEnd(30); }).join(''));
}
reportDropped(dropped);
