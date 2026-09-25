// EXTRAPOLATING BRITAIN'S DEPEASANTATION YEAR PAST THE RUN'S END (FINDINGS F165 §5, user-proposed 2026-09-25: "maybe some
// predictions should be made on when the cross will happen, under the in-run speed (1940, 1950, later). Will this give an
// even better fit?"). Three parts:
//   1. BACK-TEST — pretend every run ended at a cutoff (1915 / 1920 / 1925), extrapolate each not-yet-crossed run from its own
//      last-decade descent (linear in U*, and log-linear), and score against the year it ACTUALLY crossed by 1936;
//   2. THE REFIT — outcome = the observed crossing year, else the extrapolated one (capped), fitted by OLS on the levers,
//      beside the censored Tobit of corpus_depeasant.mjs;
//   3. THE HONEST TEST — using data up to a cutoff only, which method recovers the lever effects that the full data
//      (Tobit censored at 1936) gives: Tobit censored at the cutoff, or OLS on extrapolated years?
//   node tools/testbed/ledger/corpus_depeasant_extrap.mjs [corpus.jsonl] [threshold 0.10]
import { load, mean, med, sd, ols, corr, f } from './lib_corpus_stats.mjs';
import { tobit, X, LEV, cross, isStuck } from './lib_depeasant.mjs';
const C = load(process.argv[2] || new URL('corpus_runs.jsonl', import.meta.url)); const T = +(process.argv[3] || 0.10);
const CAP = 2000, WIN = 10;
const mod = C.filter(r => r.arm === 'mod' && r.lev);
const U = (r, y) => r.years[y] && r.years[y].g.U;
// extrapolate from the WIN years ending at `end`: returns a year (possibly > end), or Infinity if not descending
function extrap(r, end, mode) {
  const pts = []; for (let y = end - WIN; y <= end; y++) { const u = U(r, y); if (u != null && u > 0) pts.push([y, mode === 'log' ? Math.log(u) : u]); }
  if (pts.length < 5) return NaN; const mx = mean(pts.map(p => p[0])), my = mean(pts.map(p => p[1]));
  let sxy = 0, sxx = 0; for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; } const b = sxy / sxx; if (!(b < 0)) return Infinity;
  const target = mode === 'log' ? Math.log(T) : T; const yr = mx + (target - my) / b; return Math.max(yr, end + 1);
}
const crossBy = (r, end) => { for (let y = 1840; y <= end; y++) { const u = U(r, y); if (u != null && u < T) return y; } return null; };
console.log('threshold U* <', T * 100 + '%', '· runs', mod.length, '· window', WIN, 'y · cap', CAP);
// ---- 1. back-test
console.log('\n=== 1. BACK-TEST: cut the run at a cutoff, extrapolate, compare with the year it actually crossed (runs crossing after the cutoff, by 1936) ===');
for (const cut of [1915, 1920, 1925]) for (const mode of ['lin', 'log']) {
  const rows = mod.filter(r => !crossBy(r, cut) && cross(r, T) && cross(r, T) > cut).map(r => ({ act: cross(r, T), pred: extrap(r, cut, mode) }));
  const e = rows.filter(q => Number.isFinite(q.pred)).map(q => q.pred - q.act); const nevr = rows.filter(q => q.pred === Infinity).length;
  // and the censored ones: of the runs NOT crossed by 1936, how many does the extrapolation put before 1936 (a false early call)?
  const cens = mod.filter(r => !cross(r, T)); const early = cens.filter(r => { const p = extrap(r, cut, mode); return Number.isFinite(p) && p <= 1936; }).length;
  console.log(cut + ' ' + mode.padEnd(3) + ' | n ' + rows.length + ' crossed later · error median ' + f(med(e), 1) + ' y, median |err| ' + f(med(e.map(Math.abs)), 1) + ' y, p90 |err| ' + f([...e.map(Math.abs)].sort((a, b) => a - b)[Math.floor(0.9 * (e.length - 1))], 1)
    + ' y · called "never" ' + nevr + ' | of ' + cens.length + ' never-crossed runs, ' + early + ' predicted to cross by 1936');
}
// ---- 2. the refit on the full data
const byMode = mode => mod.map(r => { const c = cross(r, T); let y = c ?? extrap(r, 1936, mode); const stuck = isStuck(r); return { r, x: X(r), y: Number.isFinite(y) ? Math.min(y, CAP) : CAP, obs: !!c, stuck }; });
console.log('\n=== 2. REFIT, full data: outcome = observed crossing, else extrapolated from 1926–36 (capped at ' + CAP + ') ===');
const tb = tobit(mod.map(r => { const c = cross(r, T); return { x: X(r), y: c ?? 1936.5, cens: !c }; }));
const tbn = tobit(mod.map(r => { const c = cross(r, T); return { x: [], y: c ?? 1936.5, cens: !c }; }), 1936.5, 6000);
console.log('Tobit (censored at 1936): variance explained ' + f(1 - (tb.sigma / tbn.sigma) ** 2) + ' · σ ' + f(tb.sigma, 1) + ' y');
for (const mode of ['lin', 'log']) for (const dropStuck of [false, true]) {
  const rows = byMode(mode).filter(q => !(dropStuck && q.stuck)); const o = ols(rows.map(q => q.x), rows.map(q => q.y), LEV);
  const ex = rows.filter(q => !q.obs).map(q => q.y).sort((a, b) => a - b);
  console.log(mode.padEnd(3) + (dropStuck ? ' no stuck ' : ' all      ') + '| n ' + o.n + ' · R² ' + f(o.r2) + ' · resid ' + f(o.rmse, 1) + ' y · extrapolated years p25/p50/p75 ' + ex[Math.floor(ex.length * 0.25)]?.toFixed(0) + ' / ' + ex[ex.length >> 1]?.toFixed(0) + ' / ' + ex[Math.floor(ex.length * 0.75)]?.toFixed(0) + ' (at cap ' + ex.filter(v => v >= CAP).length + ')');
  console.log('      ' + LEV.map((n, i) => n + ' ' + f(o.beta[i + 1], 0) + '±' + f(o.se[i + 1], 0)).join(' · '));
}
console.log('Tobit coefficients:  ' + LEV.map((n, i) => n + ' ' + f(tb.beta[i + 1], 0) + '±' + f(tb.se[i + 1], 0)).join(' · '));
// ---- 3. the honest test: data to a cutoff only — which method recovers the full-data (1936-censored Tobit) lever effects?
console.log('\n=== 3. DATA TO A CUTOFF ONLY: which method recovers the full-data Tobit effects? (lnA, lnB, lnC, in0, trade — the levers with |t| > 2) ===');
const key = ['lnA', 'lnB', 'lnC', 'in0', 'trade'].map(k => LEV.indexOf(k) + 1); const truth = key.map(i => tb.beta[i]);
const dist = b => Math.sqrt(mean(key.map((i, j) => ((b[i] - truth[j]) / tb.se[i]) ** 2)));   // rms error in units of the full-data SE
for (const cut of [1920, 1925, 1930]) {
  const tc = tobit(mod.map(r => { const c = crossBy(r, cut); return { x: X(r), y: c ?? cut + 0.5, cens: !c }; }), cut + 0.5);
  const line = [cut + ' | Tobit@' + cut + ': rms ' + f(dist(tc.beta)) + ' SE'];
  for (const mode of ['lin', 'log']) { const rows = mod.map(r => { const c = crossBy(r, cut); const y = c ?? extrap(r, cut, mode); return { x: X(r), y: Number.isFinite(y) ? Math.min(y, CAP) : CAP }; });
    const o = ols(rows.map(q => q.x), rows.map(q => q.y), LEV); line.push('extrap-' + mode + ' OLS: rms ' + f(dist(o.beta)) + ' SE'); }
  console.log(line.join(' · '));
}
