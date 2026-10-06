// FLEETS AGAINST EXCESS WALL CLOCK, YEAR BY YEAR (2026-10-06, for the v16 batch 20261006_193418_jex-n8-v16; FINDINGS F218 is the mechanism).
// Joins the game's own per-tick log (tick_profile.mjs's parseTicks: seconds per in-game year per sub-tick, hours 0 / 6 / 12 / 18) with the
// v16 save summaries' `world.formations` (the military formations and their travel paths), so a slowdown can be read against the fleets that
// were sailing THAT year rather than against the run's newest kept save.
//
//   node tools/testbed/ledger/fleet_excess.mjs --arm <session>[,<session>][:<setup>] [--ref <session>[,…][:<setup>]] [--min 15] [--list] [--partial]
//
// EXCESS: per run, year and sub-tick, the seconds charged to that sub-tick (the five ticks around 1 January dropped — the yearly autosave —
// and the rest scaled to 1,460 ticks), MINUS the median of that sub-tick in that year over every run read (--arm and --ref pooled: the ref
// only widens the median, it is not analysed). Total excess = the sum over the four sub-ticks.
// FLEET READING for year Y: the summaries at Y.1.1 and (Y+1).1.1 — the larger of the two per measure, because a loop that ENDS inside the
// year shows only at the start and one that STARTS shows only at the end. Measures, all from `world.formations` (v16):
//   loopK2  = Σ (dist/1000)² over `worst` paths that are recalled AND ≥ 200 moves (F218's loop line) — the superlinear form F218 suggested;
//   loopMax = the longest such path's distance;  loops = the count;  allK2 = world dist_k2 over every moving formation (armies included).
// Per sub-tick, the same loop measures split by the OWNER BUCKET (owner id mod 4) and mapped to the hour F218 §8 inferred: 1 → 6, 0 → 12,
// 2 → 0, 3 → 18 (presumed) — so "is the excess on the sub-tick the looping owner's bucket says?" is tested directly.
// ⚠ PRELIMINARY by construction at a few runs: a run-year is not an independent observation (a loop lasts years, a war lasts years), so the
//   correlations are DESCRIPTIVE, and the median baseline from few runs is itself noisy (±4–5 s a sub-tick a year at late-game levels, F218 §7).
// ⚠ A summary with no `world.formations` (pre-v16) is skipped and counted; the ref may be pre-v16 — it only feeds the medians.
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { parseTicks } from './tick_profile.mjs';
import { indexRun, firstOf, readSum, med, runsOf as allRunDirs } from './lib_sumidx.mjs';
const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const args = process.argv.slice(2);
const all = k => args.flatMap((a, i) => a === k ? [args[i + 1]] : []);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MIN = +opt('--min', 15), LIST = args.includes('--list'), PARTIAL = args.includes('--partial');
if (!all('--arm').length) { console.error('usage: fleet_excess.mjs --arm <session>[,…][:<setup>] [--ref …] [--min 15] [--list]'); process.exit(2); }
const HOUR_OF_BUCKET = { 1: 6, 0: 12, 2: 0, 3: 18 };          // F218 §8 (3 → 18 presumed)
// --partial: every run folder of an --arm session, finished or not (a live run's years so far) — for monitoring only, never a report
const runsOf = (spec, partial) => { const [s, setup = ''] = spec.split(':');
  if (partial) return s.split(',').flatMap(x => allRunDirs(x, setup).map(d => x + '/' + basename(d)));
  return usableRuns(SES, s, setup).runs; };

function tickYears(dir) {
  const T = parseTicks(dir); if (!T) return null;
  const Y = {};
  for (const t of T) {
    if ((t.m === 1 && t.d === 1) || (t.m === 12 && t.d === 31 && t.h === 18)) continue;   // the yearly autosave tick and its neighbours
    const o = (Y[t.y] ||= [0, 0, 0, 0, 0]); o[t.h / 6] += t.t; o[4]++;
  }
  const out = {};
  for (const [y, v] of Object.entries(Y)) if (v[4] >= 1200) out[y] = v.slice(0, 4).map(x => x * 1460 / v[4]);
  return out;
}
function fleetYears(dir) {
  const idx = indexRun(dir), byY = {}; let pre = 0;
  for (let y = 1836; y <= 1936; y++) {
    const d = firstOf(idx, y); if (!d) continue;
    const s = readSum(idx[d]), F = s.world?.formations; if (!F) { pre++; continue; }
    const loopsW = (F.worst || []).filter(w => w.recalled && w.moves >= 200);
    const byHour = { 0: 0, 6: 0, 12: 0, 18: 0 }, maxByHour = { 0: 0, 6: 0, 12: 0, 18: 0 }, who = [];
    for (const w of loopsW) { const h = HOUR_OF_BUCKET[w.bucket]; if (h == null) continue; byHour[h] += (w.dist / 1000) ** 2; maxByHour[h] = Math.max(maxByHour[h], w.dist); who.push(`${w.owner}#${w.owner_id}(b${w.bucket})${Math.round(w.dist / 1000)}k`); }
    byY[y] = { loopK2: Object.values(byHour).reduce((a, x) => a + x, 0), loopMax: Math.max(0, ...loopsW.map(w => w.dist)), loops: loopsW.length,
               allK2: F.dist_k2 || 0, recalledMoving: F.recalled_moving || 0, byHour, maxByHour, who };
  }
  // the larger of the two boundary readings, per measure
  const out = {};
  for (let y = 1836; y < 1936; y++) {
    const a = byY[y], b = byY[y + 1]; if (!a && !b) continue;
    const mx = k => Math.max(a?.[k] ?? 0, b?.[k] ?? 0);
    out[y] = { loopK2: mx('loopK2'), loopMax: mx('loopMax'), loops: mx('loops'), allK2: mx('allK2'), recalledMoving: mx('recalledMoving'),
               byHour: Object.fromEntries([0, 6, 12, 18].map(h => [h, Math.max(a?.byHour[h] ?? 0, b?.byHour[h] ?? 0)])),
               maxByHour: Object.fromEntries([0, 6, 12, 18].map(h => [h, Math.max(a?.maxByHour[h] ?? 0, b?.maxByHour[h] ?? 0)])),
               who: [...new Set([...(a?.who || []), ...(b?.who || [])])] };
  }
  return { years: out, pre };
}

const armRuns = all('--arm').flatMap(a => runsOf(a, PARTIAL)), refRuns = all('--ref').flatMap(a => runsOf(a, false));
const T = new Map();
for (const r of [...armRuns, ...refRuns]) { const t = tickYears(join(SES, r)); if (t) T.set(r, t); }
const medY = {};
for (let y = 1836; y < 1936; y++) for (let h = 0; h < 4; h++) { const v = [...T.values()].map(t => t[y]?.[h]).filter(Number.isFinite); if (v.length >= 3) (medY[y] ||= [])[h] = med(v); }
console.log(`median baseline: ${T.size} run(s) with a tick log (${armRuns.length} analysed + ${refRuns.length} reference)`);

const rows = []; let preTotal = 0;
for (const r of armRuns) {
  const t = T.get(r); if (!t) { console.log(`  ${r}: no tick log — skipped`); continue; }
  const { years: F, pre } = fleetYears(join(SES, r)); preTotal += pre;
  for (let y = 1836; y < 1936; y++) {
    if (!t[y] || !medY[y] || medY[y].length < 4 || !F[y]) continue;
    const ex = t[y].map((s, h) => s - medY[y][h]);
    rows.push({ run: r.split('/').pop(), y, ex, tot: ex.reduce((a, x) => a + x, 0), raw: t[y].reduce((a, x) => a + x, 0), F: F[y] });
  }
}
if (preTotal) console.log(`  ${preTotal} summary year(s) carried no world.formations (pre-v16) and were skipped`);
if (!rows.length) { console.log('no run-year with both ticks and v16 formations'); process.exit(1); }

const pear = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN; };
const rank = v => { const s = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length); for (let i = 0; i < s.length;) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const spear = (x, y) => pear(rank(x), rank(y));
const ols = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } const b = sxx ? sxy / sxx : NaN; return { a: my - b * mx, b }; };
const f1 = x => (x >= 0 ? '+' : '') + x.toFixed(1);

// 1. per run: the years worth reading
console.log(`\n1. RUN-YEARS WITH TOTAL EXCESS ≥ ${MIN} s OR A LOOP (excess per sub-tick 0/6/12/18 over the median; loops = recalled AND ≥ 200 moves)`);
for (const run of [...new Set(rows.map(r => r.run))]) {
  const R = rows.filter(r => r.run === run), hot = R.filter(r => r.tot >= MIN || r.F.loops > 0);
  const sumPos = R.reduce((a, r) => a + Math.max(0, r.tot), 0);
  console.log(`  ${run}: ${R.length} years, Σ positive excess ${Math.round(sumPos)} s (${(sumPos / 60).toFixed(1)} min), ${hot.length} year(s) listed`);
  for (const r of LIST ? hot : hot.filter(r => r.tot >= MIN))
    console.log(`    ${r.y}  total ${f1(r.tot).padStart(7)} s  [${r.ex.map(f1).join(' / ')}]  loops ${r.F.loops}  loopMax ${Math.round(r.F.loopMax / 1000)}k  loopK2 ${Math.round(r.F.loopK2)}  allK2 ${Math.round(r.F.allK2)}${r.F.who.length ? '  ' + r.F.who.join(' ') : ''}`);
}

// 2. correlations, run-years pooled
const tot = rows.map(r => r.tot);
console.log(`\n2. TOTAL EXCESS vs FLEET MEASURES, ${rows.length} run-years pooled (descriptive — years are not independent)`);
for (const [k, lab] of [['loopK2', 'Σ (loop dist/1000)²'], ['loopMax', 'longest loop distance'], ['loops', 'loop count'], ['recalledMoving', 'recalled + moving formations'], ['allK2', 'Σ (dist/1000)², every moving formation']]) {
  const x = rows.map(r => r.F[k]);
  console.log(`  ${lab.padEnd(42)} Pearson ${pear(x, tot).toFixed(2).padStart(5)}  Spearman ${spear(x, tot).toFixed(2).padStart(5)}`);
}

// 3. sub-tick attribution: excess on hour H against the loops whose owner bucket maps to H
console.log(`\n3. SUB-TICK ATTRIBUTION — excess on hour H vs the loops of the owner bucket F218 maps to H (1 → 6, 0 → 12, 2 → 0, 3 → 18 presumed)`);
const px = [], py = [];
for (const [hi, H] of [[0, 0], [1, 6], [2, 12], [3, 18]]) {
  const x = rows.map(r => r.F.byHour[H]), y = rows.map(r => r.ex[hi]);
  const o = rows.map(r => Math.max(...[0, 6, 12, 18].filter(h => h !== H).map(h => r.F.byHour[h])));   // loops elsewhere
  const fit = ols(x, y); px.push(...x); py.push(...y);
  const withL = rows.filter(r => r.F.maxByHour[H] >= 125000), noL = rows.filter((r, i) => r.F.maxByHour[H] === 0 && o[i] === 0);
  console.log(`  hour ${String(H).padStart(2)}: Pearson ${pear(x, y).toFixed(2).padStart(5)}  slope ${fit.b.toFixed(3)} s per 1k² · ${withL.length} run-year(s) with a ≥125k loop here: median excess on hour ${H} ${withL.length ? f1(med(withL.map(r => r.ex[hi]))) : '—'} s, on the other three ${withL.length ? f1(med(withL.map(r => r.ex.reduce((a, x, j) => a + (j === hi ? 0 : x), 0) / 3))) : '—'} s each · no loop anywhere: ${f1(med(noL.map(r => r.ex[hi])))} s`);
}
console.log(`  pooled over the four sub-ticks: Pearson ${pear(px, py).toFixed(2)}, Spearman ${spear(px, py).toFixed(2)}`);

// 4. the F218 cost-vs-distance shape: excess on the mapped sub-tick by the longest loop there
console.log(`\n4. EXCESS ON THE LOOPING OWNER'S SUB-TICK BY THE LONGEST LOOP THERE (F218: ≲125k ~0–10 s/yr, ~150–200k ~20–30 s, ~470k ~100–200 s)`);
const bins = [[1, 125e3, '<125k'], [125e3, 200e3, '125–200k'], [200e3, 350e3, '200–350k'], [350e3, 600e3, '350–600k'], [600e3, Infinity, '≥600k']];
for (const [lo, hi, lab] of bins) {
  const v = []; for (const r of rows) for (const [i, H] of [[0, 0], [1, 6], [2, 12], [3, 18]]) if (r.F.maxByHour[H] >= lo && r.F.maxByHour[H] < hi) v.push(r.ex[i]);
  console.log(`  ${lab.padEnd(9)} n ${String(v.length).padStart(3)}  median ${v.length ? f1(med(v)) : '—'} s  range ${v.length ? f1(Math.min(...v)) + ' … ' + f1(Math.max(...v)) : '—'}`);
}

// 5. where the positive excess sits
console.log(`\n5. WHERE THE POSITIVE EXCESS SITS (run-year classes, Σ max(0, total excess))`);
const cls = r => {
  if (r.F.loopMax >= 125000) return 'a loop ≥ 125k sailing';
  const pos = r.ex.filter(x => x >= 5).length; if (pos >= 3 && r.tot >= MIN) return 'three+ sub-ticks up (war-like), no big loop';
  return r.F.loops ? 'a short loop only' : 'other';
};
const C = {}; for (const r of rows) { const k = cls(r), o = (C[k] ||= { n: 0, s: 0 }); o.n++; o.s += Math.max(0, r.tot); }
const S = Object.values(C).reduce((a, o) => a + o.s, 0);
for (const [k, o] of Object.entries(C).sort((a, b) => b[1].s - a[1].s)) console.log(`  ${k.padEnd(44)} ${String(o.n).padStart(4)} run-years  ${(o.s / 60).toFixed(1).padStart(6)} min  ${(100 * o.s / S).toFixed(0).padStart(3)}%`);
