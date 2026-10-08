// THE WALL CLOCK IN THREE RUN CLUSTERS (user-ruled 2026-10-07; CLAUDE.md's wall-clock bullet is the record).
//   (1) NORMAL runs · (2) INEXPLICABLY SLOWED runs = a slowdown EPISODE (slow_quarantine.mjs's rule: wall s per in-game year > 3σ3 = +32%
//   over year X−3, growth-adjusted, three years running; it ends when the speed is back within +15% of the pre-episode speed) with no
//   directly observed listed bug · (3) runs affected by a LISTED vanilla bug, OBSERVED DIRECTLY.
// THE LIST holds one bug: the FLEET PATH LOOP (F218). OBSERVED DIRECTLY (ruled) = during the episode a save shows a fleet recalled for
// repairs with ≥ 200 path moves and ≥ 125k distance sailed, AND the loop is gone once the slowdown ends (the same fleet no longer on a
// ≥ 200-move recalled path in the save of the year after the episode, or the one after that). An episode still open when the run ended
// needs only the loop present in its last year. Read from the v16 save summaries' world.formations.worst (the 40 worst paths); a run
// whose episode years carry no v16 summary is reported as UNOBSERVABLE and stays in cluster 2 (no evidence, no exclusion).
// ⚠ NO tick pattern is a criterion (ruled): the sub-tick split is printed for investigation only.
// REPORTING (ruled): every cluster in ABSOLUTE numbers; separate wall-clock medians for 1 and 2 in writing, the MAIN figure = 1 + 2
// combined; for 3 only the count and which bug.
//
//   node tools/testbed/ledger/wall_clusters.mjs <label>=<session>[,<session>][:<setup>] [...] [--runs] [--json <file>]
//   --json: per label, every usable run's cluster, bug, reason and play time — fill_build_perf.mjs reads it, so the ledger's row P takes
//   its MAIN figure over clusters 1 + 2 and reports cluster 3 as a count (2026-10-08).
import { join, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { wallFromTicks } from './lib_wall.mjs';
import { indexRun, firstOf, readSum, med } from './lib_sumidx.mjs';
import { yearTimes, episodes } from '../slow_quarantine.mjs';
const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const args = process.argv.slice(2), RUNS = args.includes('--runs');
const JSON_OUT = (() => { const i = args.indexOf('--json'); return i >= 0 ? args.splice(i, 2)[1] : null; })();
const OUTJ = {};
const specs = args.filter(a => a.includes('='));
if (!specs.length) { console.error('usage: wall_clusters.mjs <label>=<session>[,<session>][:<setup>] [...] [--runs]'); process.exit(2); }
const LOOP_MOVES = 200, LOOP_DIST = 125000;

function loopsAt(idx, y) {                       // recalled ≥ 200-move paths in the first summary of year y; null = no v16 data
  const d = firstOf(idx, y); if (!d) return null;
  const F = readSum(idx[d]).world?.formations; if (!F) return null;
  return (F.worst || []).filter(w => w.recalled && w.moves >= LOOP_MOVES);
}
function classify(runDir) {
  const { ty, complete } = yearTimes(runDir);
  const E = episodes(ty, { through: complete });
  if (!E.length) return { cluster: 1, E, why: 'no episode' };
  const idx = indexRun(runDir); const ev = []; let unobs = false;
  for (const e of E) {
    const big = new Map();                       // fleet id → the largest sighting in the episode
    let any = false;
    for (let y = e.start; y <= e.end + 1; y++) {   // the save at 1 Jan of y+1 closes year y
      const L = loopsAt(idx, y); if (L === null) continue; any = true;
      for (const w of L) if (w.dist >= LOOP_DIST && (!big.has(w.id) || big.get(w.id).dist < w.dist)) big.set(w.id, { ...w, y });
    }
    if (!any) { unobs = true; continue; }
    for (const w of big.values()) {
      let gone = e.open;                         // an episode running to the end needs only the loop present in its last year
      if (e.open) gone = (loopsAt(idx, e.end) || []).concat(loopsAt(idx, e.end + 1) || []).some(x => x.id === w.id);
      else for (const y of [e.end + 1, e.end + 2, e.end + 3]) { const L = loopsAt(idx, y); if (L && !L.some(x => x.id === w.id && x.moves >= w.moves)) { gone = true; break; } }
      if (gone) ev.push(`episode ${e.start}–${e.end}: ${w.owner} fleet ${w.id} recalled, ${w.moves} moves / ${Math.round(w.dist / 1000)}k sailed (${w.y})${e.open ? ', to the end' : ', gone after'}`);
    }
  }
  if (ev.length) return { cluster: 3, E, bug: 'fleet path loop', why: ev.join('; ') };
  return { cluster: 2, E, why: unobs ? 'episode with no v16 save data — UNOBSERVABLE (no evidence, stays in 2)' : 'episode, no listed bug observed' };
}

const fmt = s => s == null ? '—' : `${(s / 60).toFixed(1)} min`;
for (const spec of specs) {
  const [label, rest] = spec.split('='); const [ses, setup = ''] = rest.split(':');
  const { runs, dropped } = usableRuns(SES, ses, setup);
  const C = { 1: [], 2: [], 3: [] }, bugs = {};
  console.log(`\n== ${label}: ${runs.length} usable run(s)` + (dropped.length ? ` (${dropped.length} not usable, excluded as for every metric)` : ''));
  for (const r of runs) {
    const dir = join(SES, r), c = classify(dir), w = wallFromTicks(dir);
    C[c.cluster].push(w?.wall_play ?? null);
    ((OUTJ[label] ||= {}).runs ||= {})[r] = { cluster: c.cluster, bug: c.bug ?? null, why: c.why, wall_play: w?.wall_play ?? null };
    if (c.cluster === 3) bugs[c.bug] = (bugs[c.bug] || 0) + 1;
    if (RUNS || c.cluster !== 1) console.log(`   ${r.padEnd(58)} cluster ${c.cluster}  ${fmt(w?.wall_play).padStart(10)}  ${c.E.map(e => `${e.start}–${e.end}${e.open ? '(to end)' : ''} +${e.peak_pct}%`).join(', ') || ''}${c.cluster !== 1 ? '  · ' + c.why : ''}`);
  }
  const m = v => { const x = v.filter(Number.isFinite); return x.length ? med(x) : null; };
  console.log(`   (1) normal: ${C[1].length} run(s), median ${fmt(m(C[1]))}`);
  console.log(`   (2) inexplicably slowed: ${C[2].length} run(s), median ${fmt(m(C[2]))}`);
  console.log(`   ⇒ MAIN wall clock (1 + 2): ${C[1].length + C[2].length} run(s), median ${fmt(m([...C[1], ...C[2]]))}`);
  console.log(`   (3) listed bug: ${C[3].length} run(s)${C[3].length ? ' — ' + Object.entries(bugs).map(([b, n]) => `${b} ${n}`).join(', ') : ''}`);
}
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(OUTJ, null, 1)); console.log(`\nwrote ${JSON_OUT}`); }
