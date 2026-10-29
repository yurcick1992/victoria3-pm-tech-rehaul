// Build the template's PERF const from perf.json's per-run curves. n=6 on the mod side: the
// INCOMPLETE run007 is dropped here as report_perf already drops it from its own analysis (L17).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const DIR = process.argv[2];
const p = JSON.parse(readFileSync(join(DIR, 'perf_raw.json'), 'utf8'));
const runs = p.runs.filter(r => r.complete);
// ⭐ THE THREE RUN CLUSTERS (user-ruled 2026-10-07; TESTBED_OPERATIONS.md §7.4): wall_clusters.json (wall_clusters.mjs --json) tags
//   each run 1 normal / 2 inexplicably slowed / 3 a directly observed LISTED vanilla bug. The template's MAIN figure is the median over
//   1 + 2; a cluster-3 run leaves the grade and is reported as a count with its bug. Absent file ⇒ no tags, every run counts (as before).
const CL = {};
if (existsSync(join(DIR, 'wall_clusters.json'))) for (const L of Object.values(JSON.parse(readFileSync(join(DIR, 'wall_clusters.json'), 'utf8'))))
  for (const [run, v] of Object.entries(L.runs || {})) CL[run.replace(/\\/g, '/')] = v;
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const byYear = { van: {}, mod: {} }, pops = { van: {}, mod: {} }, levels = { van: {}, mod: {} };
for (const arm of ['van', 'mod']) {
  const set = runs.filter(r => (arm === 'van') === !!r.isVanilla);
  const acc = {};
  for (const r of set) for (const pt of r.curve || []) {
    const y = Math.round(pt.y); if (!Number.isFinite(pt.spy)) continue;
    (acc[y] ||= { spy: [], pops: [], lv: [] });
    acc[y].spy.push(pt.spy); if (pt.pops) acc[y].pops.push(pt.pops); if (pt.levels) acc[y].lv.push(pt.levels);
  }
  for (const [y, a] of Object.entries(acc)) {
    if (a.spy.length) byYear[arm][y] = +(60 / med(a.spy)).toFixed(3);   // years per minute
    if (a.pops.length) pops[arm][y] = Math.round(med(a.pops));
    if (a.lv.length) levels[arm][y] = Math.round(med(a.lv));
  }
}
// ⭐ BY SESSION (2026-10-29): the play-time ratio inside each session that holds BOTH arms (an alternating batch), clusters 1 + 2 — the
//   caveat a reader needs beside the pooled grade, since the machine's speed drifts between sessions (F248, F249: ×1.11 then ×0.996).
const bySession = [];
{ const ses = {};
  for (const r of runs) { const c = CL[r.label]; if (c && c.cluster === 3) continue; const s = String(r.label).split('/')[0];
    ((ses[s] ||= { mod: [], van: [] })[r.isVanilla ? 'van' : 'mod']).push(r.wall_seconds / 60); }
  for (const [s, o] of Object.entries(ses)) if (o.mod.length && o.van.length)
    bySession.push({ session: s, mod: +med(o.mod).toFixed(1), van: +med(o.van).toFixed(1), nMod: o.mod.length, nVan: o.van.length, ratio: +(med(o.mod) / med(o.van)).toFixed(3) }); }
const sessions = [...new Set(runs.map(r => String(r.label || '').split('/')[0]))];
const PERF = {
  // ⚠ DERIVED, never a literal. This line names the sessions compared; hardcoding it republished
  //   canon-n7 provenance under every later batch. fill_verify catches it as a staleness hit. It says whether the arms alternated in the
  //   same sessions (2026-10-29: it read "DIFFERENT NIGHTS unless stated" on the alternating batch itself).
  source: (sessions.length ? sessions.join(', ') : 'unknown') + (bySession.length ? ' — the two arms alternated within ' + (bySession.length === sessions.length ? 'every session' : bySession.length + ' of these sessions') : ' — the arms ran in different sessions, so machine drift is not controlled'),
  bySession,
  runs: runs.map(r => ({ label: r.label.split('/').pop(), van: !!r.isVanilla, min: +(r.wall_seconds / 60).toFixed(1), pops: r.endPops, levels: r.endLevels,
    ...(CL[r.label] ? { cluster: CL[r.label].cluster, ...(CL[r.label].bug ? { bug: CL[r.label].bug } : {}) } : {}) })),
  clustered: Object.keys(CL).length > 0,
  byYear, pops, levels,
  model: { c0: 0.39, cPop: 0.180, cLv: 0.590 },   // F72: sec/yr = c0 + cPop*kpops + cLv*klevels
  grade: { green: 5, yellow: 10 },   // +10% = the ruled budget (CLAUDE.md); yellow read 15 until 2026-10-08
  overlapping: p.matched.overlapping, pct: p.matched.pct,
  // ⚠ THE RENDERER'S SHAPE, NOT report_perf's. The template's pop-matched table reads {b, v, m, nV, nM} with v/m in
  //   IN-GAME YEARS PER MINUTE; report_perf emits {bin, lo, hi, vanilla, mod, nV, nM} in SECONDS PER YEAR. Passing the
  //   raw bins through printed `undefined` in the pop-objects column and 'no overlap' in EVERY row of every report
  //   from flatcost-n1 to ab3-n3 (2026-09-05), while the headline above the table said 12 bins overlapped — the
  //   gate's data check passed on the samples column's digits. A side with no samples is null, never 0.
  bins: p.matched.bins.map(b => ({ b: b.bin, v: b.nV && b.vanilla ? +(60 / b.vanilla).toFixed(3) : null,
                                   m: b.nM && b.mod ? +(60 / b.mod).toFixed(3) : null, nV: b.nV, nM: b.nM })),
};
writeFileSync(join(DIR, 'perf_panel.json'), JSON.stringify(PERF));
console.log('PERF built: runs', PERF.runs.length, '| van years', Object.keys(byYear.van).length, '| mod years', Object.keys(byYear.mod).length, '| pct', PERF.pct.toFixed(2));
