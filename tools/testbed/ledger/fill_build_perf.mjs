// Build the template's PERF const from perf.json's per-run curves. n=6 on the mod side: the
// INCOMPLETE run007 is dropped here as report_perf already drops it from its own analysis (L17).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const DIR = process.argv[2];
const p = JSON.parse(readFileSync(join(DIR, 'perf_raw.json'), 'utf8'));
const runs = p.runs.filter(r => r.complete);
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
const PERF = {
  // ⚠ DERIVED, never a literal. This line names the sessions compared; hardcoding it republished
  //   canon-n7 provenance under every later batch. fill_verify catches it as a staleness hit.
  source: (p.runs && p.runs.length ? [...new Set(p.runs.map(r => String(r.label||"").split("/")[0]))].join(" vs ") : "unknown") + " — DIFFERENT NIGHTS unless stated",
  runs: runs.map(r => ({ label: r.label.split('/').pop(), van: !!r.isVanilla, min: +(r.wall_seconds / 60).toFixed(1), pops: r.endPops, levels: r.endLevels })),
  byYear, pops, levels,
  model: { c0: 0.39, cPop: 0.180, cLv: 0.590 },   // F72: sec/yr = c0 + cPop*kpops + cLv*klevels
  grade: { green: 5, yellow: 15 },
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
