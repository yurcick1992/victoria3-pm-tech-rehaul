// ⭐⭐ WHAT DRIVES THE TICK COST — THE DRIVER HORSE RACE (FINDINGS F72, re-run and extended F120)
//
//   node tools/testbed/ledger/fit_cost_drivers.mjs [--cache <path>] [--refresh] [--min-saves 50]
//
// The ledger's row-P tripwire models engine cost as `sec/in-game-year = c0 + cPop·kpops + cLv·klevels`
// (fill_build_perf.mjs's `model` block, drawn as "÷ modelled cost"). This is the tool that says whether
// those are the right DRIVERS. It pools every archived run in tools/testbed/sessions and races:
//
//   live pop OBJECTS  (world.pop_objects_live)        — the shipped pop term
//   building LEVELS   (Σ world.buildings[*].levels)   — the shipped building term
//   building OBJECTS  (Σ world.buildings[*].n)        — one record per (state, building type): what the
//                                                       engine actually iterates, and the obvious rival
//   GDP, population   — the "is the building term just a size proxy?" controls
//
// ⚠⚠ THE TRAP THIS TOOL EXISTS FOR: all four drivers grow together over a campaign, so a pooled
// regression that just fits the century's growth curve cannot tell them apart — every spec scores well
// and the coefficient SPLIT is meaningless. Three things buy identification, and all three are printed:
//   (1) LEAVE-ONE-RUN-OUT cv, because samples inside one run are not independent;
//   (2) WITHIN POP BANDS — hold live pop objects roughly fixed and ask what is left;
//   (3) the ARM-LEVEL RATIO table, which is regression-free: does a book with more objects per pop
//       actually cost more?
// ⚠ Cadence is instrumentation, not economy: a monthly-save run writes 12× as often and the engine
// stalls on every write, so non-yearly runs are EXCLUDED by cause rather than fitted around (F72).
// ⚠ Nothing here is a target. Row P grades the TOTAL a player waits through (user-ruled 2026-08-31);
// this model is the tripwire that says whether a BUILD made each unit of world dearer.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const optOf = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = optOf('root', 'tools/testbed/sessions');
const CACHE = optOf('cache', 'tools/testbed/ledger/cost_drivers_pool.json');
const MIN_SAVES = +optOf('min-saves', 50);
const REFRESH = args.includes('--refresh');

const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const asYear = d => { const [y, m = 1, dd = 1] = String(d).split('.').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
// 0100_20260813_111129_autosave.json.gz -> epoch seconds. ⚠ This is the ARCHIVE stamp, so it carries a
// roughly constant lag; it cancels in a RATE (a difference of two stamps) and is never read on its own.
const stampOf = f => { const m = basename(f).match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/); if (!m) return null;
  const [, Y, Mo, D, H, Mi, S] = m.map(Number); return Date.UTC(Y, Mo - 1, D, H, Mi, S) / 1000; };

// ---- pool -------------------------------------------------------------------------------------
function buildPool() {
  const out = [];
  for (const sess of readdirSync(ROOT)) {
    const sp = join(ROOT, sess);
    if (!statSync(sp).isDirectory()) continue;
    let cadence = 'yearly';
    try { cadence = JSON.parse(readFileSync(join(sp, 'schedule.json'), 'utf8')).defaults?.autosave_interval || 'yearly'; } catch { }
    for (const rd of readdirSync(sp)) {
      const rp = join(sp, rd);
      let st; try { st = statSync(rp); } catch { continue; }
      if (!st.isDirectory()) continue;
      const sd = join(rp, 'save_summaries');
      if (!existsSync(join(rp, 'meta.json')) || !existsSync(sd)) continue;
      const files = readdirSync(sd).filter(x => x.endsWith('.gz')).sort();
      if (files.length < MIN_SAVES) continue;
      const meta = JSON.parse(readFileSync(join(rp, 'meta.json'), 'utf8'));
      // L17: the observer exits 0 even when it abandons a run, so status is not evidence — the date is.
      if (meta.reached_ingame_date !== meta.until_date || meta.abandoned_reason) continue;
      let arm = null;
      try { arm = JSON.parse(readFileSync(join(rp, 'build_state.json'), 'utf8'))?.deterministic?.arm ?? null; } catch { }
      const setup = basename(rp).replace(/^run\d+_/, '');
      const series = [];
      for (const f of files) {
        const w = stampOf(f); if (w == null) continue;
        let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f)))); } catch { continue; }
        const date = j?.provenance?.date; if (!date) continue;
        let lv = 0, nb = 0, miss = 0;
        for (const b of Object.values(j?.world?.buildings ?? {})) { lv += b.levels || 0; if (b.n == null) miss++; else nb += b.n; }
        series.push({ wall: w, year: asYear(date), pops: j?.world?.pop_objects_live ?? null,
          pop: j?.world?.population ?? null, gdp: j?.world?.gdp ?? null, levels: lv, nbld: miss ? null : nb });
      }
      series.sort((a, b) => a.wall - b.wall);
      const pts = [];
      for (let i = 1; i < series.length; i++) {
        const dy = series[i].year - series[i - 1].year, dw = series[i].wall - series[i - 1].wall;
        if (dy <= 0 || dw <= 0 || dw > 3600) continue;          // a resume / stall / clock gap: drop, never smooth
        const s = series[i];
        pts.push({ year: +s.year.toFixed(3), spy: +(dw / dy).toFixed(3), pops: s.pops, pop: s.pop, gdp: s.gdp, levels: s.levels, nbld: s.nbld });
      }
      out.push({ label: sess + '/' + rd, setup, cadence,
        isVanilla: arm === 'control' || /vanilla|control/i.test(setup),
        endPops: series.at(-1)?.pops ?? null, endLevels: series.at(-1)?.levels ?? null, endNbld: series.at(-1)?.nbld ?? null, pts });
      process.stderr.write(`\r  pooled ${out.length} runs`);
    }
  }
  process.stderr.write('\n');
  return { generated_utc: new Date().toISOString(), min_saves: MIN_SAVES, runs: out };
}

let POOL;
if (!REFRESH && existsSync(CACHE)) { POOL = JSON.parse(readFileSync(CACHE, 'utf8')); console.log(`cache ${CACHE} (${POOL.generated_utc}) — --refresh to rebuild`); }
else { POOL = buildPool(); writeFileSync(CACHE, JSON.stringify(POOL)); console.log(`wrote ${CACHE}`); }

const rows = [], runMeta = new Map();
let skipCad = 0;
for (const r of POOL.runs) {
  if (r.cadence && r.cadence !== 'yearly') { skipCad++; continue; }
  const pts = r.pts.filter(p => p.spy > 0 && p.pops > 0 && p.levels > 0 && p.nbld > 0);
  if (!pts.length) continue;
  runMeta.set(r.label, r);
  for (const p of pts) rows.push({ run: r.label, van: r.isVanilla, y: p.spy,
    a: p.pops / 1e3, b: p.levels / 1e3, c: p.nbld / 1e3, g: (p.gdp || 0) / 1e6, pop: (p.pop || 0) / 1e6 });
}
const nVan = [...runMeta.values()].filter(r => r.isVanilla).length;
console.log(`samples ${rows.length} over ${runMeta.size} runs (${nVan} vanilla, ${runMeta.size - nVan} mod); ${skipCad} non-yearly-cadence runs excluded`);

// ---- least squares ------------------------------------------------------------------------------
function fit(pts, cols) {
  const k = cols.length, S = Array.from({ length: k }, () => new Array(k).fill(0)), T = new Array(k).fill(0);
  for (const p of pts) { const x = cols.map(f => f(p));
    for (let i = 0; i < k; i++) { T[i] += x[i] * p.y; for (let j = 0; j < k; j++) S[i][j] += x[i] * x[j]; } }
  const M = S.map((r, i) => [...r, T[i]]);
  for (let i = 0; i < k; i++) { let mx = i; for (let q = i + 1; q < k; q++) if (Math.abs(M[q][i]) > Math.abs(M[mx][i])) mx = q;
    [M[i], M[mx]] = [M[mx], M[i]];
    for (let q = 0; q < k; q++) { if (q === i) continue; const f = M[q][i] / M[i][i]; for (let j = i; j <= k; j++) M[q][j] -= f * M[i][j]; } }
  return M.map((r, i) => M[i][k] / M[i][i]);
}
const pred = (cols, c) => p => cols.reduce((s, f, i) => s + c[i] * f(p), 0);
const cv = (pts, pr) => { const v = pts.map(p => p.y / pr(p)), m = mean(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) / m; };
function loo(pts, cols) {                       // leave one RUN out — samples inside a run are not independent
  const rs = [...new Set(pts.map(p => p.run))], v = [];
  for (const rn of rs) { const pr = pred(cols, fit(pts.filter(p => p.run !== rn), cols));
    for (const p of pts) if (p.run === rn) v.push(p.y / pr(p)); }
  const m = mean(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) / m;
}
const corr = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy); };

const SPECS = {
  'pops only'                : [[p => 1, p => p.a], ['c0', 'kpops']],
  'levels only'              : [[p => 1, p => p.b], ['c0', 'klevels']],
  'objects only'             : [[p => 1, p => p.c], ['c0', 'kobjects']],
  'GDP only'                 : [[p => 1, p => p.g], ['c0', 'MGDP']],
  'population only'          : [[p => 1, p => p.pop], ['c0', 'Mpeople']],
  'pops + levels  (SHIPPED)' : [[p => 1, p => p.a, p => p.b], ['c0', 'kpops', 'klevels']],
  'pops + objects'           : [[p => 1, p => p.a, p => p.c], ['c0', 'kpops', 'kobjects']],
  'pops + GDP'               : [[p => 1, p => p.a, p => p.g], ['c0', 'kpops', 'MGDP']],
  'pops + levels + objects'  : [[p => 1, p => p.a, p => p.b, p => p.c], ['c0', 'kpops', 'klevels', 'kobjects']],
  'pops + levels + GDP'      : [[p => 1, p => p.a, p => p.b, p => p.g], ['c0', 'kpops', 'klevels', 'MGDP']],
};
console.log('\n=== 1. THE HORSE RACE (cost = sec per in-game year) ===');
console.log('spec                       in-sample cv   LOO-run cv   coefficients');
for (const [nm, [cols, names]] of Object.entries(SPECS)) {
  const c = fit(rows, cols);
  console.log(`${nm.padEnd(26)} ${cv(rows, pred(cols, c)).toFixed(4).padStart(8)} ${loo(rows, cols).toFixed(4).padStart(12)}   ${c.map((v, i) => `${names[i]} ${v.toFixed(3)}`).join('  ')}`);
}

console.log('\n=== 2. WITHIN POP-OBJECT BANDS (the century growth trend held out) ===');
console.log('  band(kpops)      n   corr(cost,levels)  corr(cost,objects)   levels/object spread');
for (const [lo, hi] of [[40, 60], [60, 80], [80, 100], [100, 120], [120, 140], [140, 170]]) {
  const s = rows.filter(p => p.a >= lo && p.a < hi);
  if (s.length < 50) { console.log(`  ${(lo + '-' + hi + 'k').padEnd(13)} ${String(s.length).padStart(5)}   (too few)`); continue; }
  const lv = s.map(p => p.b / p.c);
  console.log(`  ${(lo + '-' + hi + 'k').padEnd(13)} ${String(s.length).padStart(5)} ${corr(s.map(p => p.y), s.map(p => p.b)).toFixed(3).padStart(16)} ${corr(s.map(p => p.y), s.map(p => p.c)).toFixed(3).padStart(18)}      ${Math.min(...lv).toFixed(1)}-${Math.max(...lv).toFixed(1)}`);
}

console.log('\n=== 3. ARM-LEVEL RATIOS (regression-free) — each book against vanilla ===');
const per = [];
for (const r of runMeta.values()) {
  const pts = r.pts.filter(p => p.spy > 0 && p.pops > 0 && p.levels > 0 && p.nbld > 0);
  if (pts.length < 80) continue;                     // near-complete curves only
  per.push({ setup: r.isVanilla ? 'VANILLA' : r.setup, van: r.isVanilla,
    total: pts.reduce((s, p) => s + p.spy, 0), mPops: mean(pts.map(p => p.pops)), mLv: mean(pts.map(p => p.levels)), mNb: mean(pts.map(p => p.nbld)) });
}
const G = {}; for (const r of per) (G[r.setup] ??= []).push(r);
const V = G['VANILLA'] || [];
if (V.length) {
  const v = { t: med(V.map(r => r.total)), p: med(V.map(r => r.mPops)), l: med(V.map(r => r.mLv)), b: med(V.map(r => r.mNb)) };
  console.log(`  vanilla (n=${V.length}): century ${(v.t / 60).toFixed(1)} min · mean pops ${Math.round(v.p)} · levels ${Math.round(v.l)} · objects ${Math.round(v.b)}`);
  console.log('  arm                       n   ×time   ×pops  ×levels  ×objects | time/pops  lv/pops  obj/pops');
  const rowsA = [];
  for (const [k, rs] of Object.entries(G)) {
    if (k === 'VANILLA' || rs.length < 2) continue;
    rowsA.push({ k, n: rs.length, t: med(rs.map(r => r.total)) / v.t, p: med(rs.map(r => r.mPops)) / v.p,
      l: med(rs.map(r => r.mLv)) / v.l, b: med(rs.map(r => r.mNb)) / v.b });
  }
  rowsA.sort((a, b) => a.t - b.t);
  for (const o of rowsA) console.log(`  ${o.k.padEnd(24)} ${String(o.n).padStart(2)}  ${o.t.toFixed(3).padStart(6)}  ${o.p.toFixed(3).padStart(6)}  ${o.l.toFixed(3).padStart(7)}  ${o.b.toFixed(3).padStart(8)} | ${(o.t / o.p).toFixed(3).padStart(9)} ${(o.l / o.p).toFixed(3).padStart(8)} ${(o.b / o.p).toFixed(3).padStart(9)}`);
  const tp = rowsA.map(o => o.t / o.p);
  console.log(`\n  across ${rowsA.length} books:  corr(time/pops, levels/pops)  = ${corr(tp, rowsA.map(o => o.l / o.p)).toFixed(3)}`);
  console.log(`                        corr(time/pops, objects/pops) = ${corr(tp, rowsA.map(o => o.b / o.p)).toFixed(3)}   ⚠ a negative value means a book with MORE objects per pop ran FASTER`);
}

console.log('\n=== 4. COLLINEARITY (why the coefficient split is weakly identified) ===');
console.log(`  corr(pops, levels)  ${corr(rows.map(p => p.a), rows.map(p => p.b)).toFixed(3)}    corr(pops, objects) ${corr(rows.map(p => p.a), rows.map(p => p.c)).toFixed(3)}    corr(levels, objects) ${corr(rows.map(p => p.b), rows.map(p => p.c)).toFixed(3)}`);
const lpb = rows.map(p => p.b / p.c);
console.log(`  levels per building object: ${Math.min(...lpb).toFixed(2)}-${Math.max(...lpb).toFixed(2)} (median ${med(lpb).toFixed(2)})  — this is the variation the race runs on`);

console.log('\n=== 5. THE SHIPPED CONSTANTS (fill_build_perf.mjs `model`) AGAINST TODAY\'S POOL ===');
const shipped = p => 0.39 + 0.180 * p.a + 0.590 * p.b;
console.log(`  0.39 + 0.180·kpops + 0.590·klevels : cv ${cv(rows, shipped).toFixed(4)}  mean actual/predicted ${mean(rows.map(p => p.y / shipped(p))).toFixed(3)}`);
for (const [nm, set] of [['vanilla', rows.filter(p => p.van)], ['mod', rows.filter(p => !p.van)]])
  console.log(`     ${nm.padEnd(8)} ${mean(set.map(p => p.y / shipped(p))).toFixed(3)}  (n ${set.length})`);
const cN = fit(rows, SPECS['pops + levels  (SHIPPED)'][0]);
console.log(`  a refit on this pool would be ${cN[0].toFixed(2)} + ${cN[1].toFixed(3)}·kpops + ${cN[2].toFixed(3)}·klevels (cv ${cv(rows, pred(SPECS['pops + levels  (SHIPPED)'][0], cN)).toFixed(4)})`);
console.log('  ⚠ the tripwire wants a STABLE baseline more than a tighter one — do not refit without a ruling.');
