// WHEN DOES BRITAIN DEPEASANT? (FINDINGS F165 §4, user-proposed 2026-09-25: "expected year when GBR is at 5% U* will be
// more uniform and more obviously connected with the levers; the bimodality is just us lumping 'depeasanted by 1935',
// 'by 1930' and 'by 1925' together"). Per run, the first year Britain's U* (incl. peasants) falls under a threshold;
// a run that never crosses by 1936 is RIGHT-CENSORED, not dropped and not set to 1936. Fitted on the corpus levers by a
// censored-normal (Tobit) regression, beside the same model on the end-state U* (OLS), so the two readings' signal
// can be compared: the share of variance the levers explain, and the leave-one-config-out error.
//   node tools/testbed/ledger/corpus_depeasant.mjs [corpus.jsonl] [since-session-prefix]
import { load, mean, sd, ols, f } from './lib_corpus_stats.mjs';
const C = load(process.argv[2] || new URL('corpus_runs.jsonl', import.meta.url)); const since = process.argv[3] || '';
const LEV = ['lnA', 'lnB', 'lnC', 'in0', 'crit', 'trade', 'slide'];
const X = r => { const l = r.lev;
  const lnB = l.in_ladder ? Math.log(l.in_ladder[l.in_ladder.length - 1]) / l.in_ladder.length : Math.log(l.B);
  const lnC = l.cost_ladder ? Math.log(l.cost_ladder[l.cost_ladder.length - 1]) / l.cost_ladder.length : Math.log(l.cost_ratio ?? l.A);
  return [Math.log(l.A), lnB, lnC, l.in0, l.crit ?? 0.75, typeof l.trade === 'object' ? l.trade.k : l.trade, l.anchor_n > 0 ? 1 : 0]; };
const cross = (r, t) => { for (let y = 1840; y <= 1936; y++) { const v = r.years[y] && r.years[y].g.U; if (v != null && v < t) return y; } return null; };
const win = r => mean([1932, 1933, 1934, 1935, 1936].map(y => r.years[y] && r.years[y].g.U));
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2)); const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
// Tobit, right-censored at c: maximise by gradient ascent (Adam) on [beta, ln sigma]
function tobit(rows, c = 1936.5, iters = 20000) {   // rows: {x:[..], y, cens}
  const k = rows[0].x.length + 1; const ys = rows.filter(r => !r.cens).map(r => r.y);
  let p = [mean(ys), ...new Array(k - 1).fill(0), Math.log(sd(ys) || 10)]; const m = p.map(() => 0), v = p.map(() => 0);
  const ll = q => { const s = Math.exp(q[k]); let L = 0; for (const r of rows) { const mu = q[0] + r.x.reduce((a, x, i) => a + x * q[i + 1], 0);
    if (r.cens) L += Math.log(Math.max(1e-300, 1 - Phi((c - mu) / s))); else { const z = (r.y - mu) / s; L += -Math.log(s) - z * z / 2; } } return L; };
  for (let it = 1; it <= iters; it++) { const g = p.map((_, i) => { const h = 1e-5; const a = p.slice(), b = p.slice(); a[i] += h; b[i] -= h; return (ll(a) - ll(b)) / (2 * h); });
    for (let i = 0; i <= k; i++) { m[i] = 0.9 * m[i] + 0.1 * g[i]; v[i] = 0.999 * v[i] + 0.001 * g[i] * g[i]; p[i] += 0.02 * (m[i] / (1 - 0.9 ** it)) / (Math.sqrt(v[i] / (1 - 0.999 ** it)) + 1e-8); } }
  // standard errors from the numerical Hessian
  const H = p.map(() => p.map(() => 0)); const h = 1e-3;
  for (let i = 0; i <= k; i++) for (let j = 0; j <= k; j++) { const pp = (di, dj) => { const q = p.slice(); q[i] += di; q[j] += dj; return ll(q); };
    H[i][j] = (pp(h, h) - pp(h, -h) - pp(-h, h) + pp(-h, -h)) / (4 * h * h); }
  const inv = invert(H.map(r => r.map(x => -x))); return { beta: p.slice(0, k), sigma: Math.exp(p[k]), se: inv.map((r, i) => Math.sqrt(Math.max(0, r[i]))), ll: ll(p) };
}
function invert(M) { const n = M.length; const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => +(i === j))]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c]; for (let j = 0; j < 2 * n; j++) A[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const q = A[r][c]; if (q) for (let j = 0; j < 2 * n; j++) A[r][j] -= q * A[c][j]; } }
  return A.map(r => r.slice(n)); }
const isStuck = r => [1900, 1910, 1920, 1930, 1936].every(y => r.years[y] && r.years[y].g.U >= 0.45);
const mod = C.filter(r => r.arm === 'mod' && r.lev && r.session >= since && !(process.env.NO_STUCK && isStuck(r)));
const van = C.filter(r => r.arm === 'vanilla' && r.session.startsWith('20260821_131149'));
console.log('mod runs', mod.length, since ? '(since ' + since + ')' : '', '· configs', new Set(mod.map(r => r.config)).size);
// the "stuck" mode: Britain never leaves the peasant economy (U* ≥ 45% at every point 1900–1936)
const stuck = mod.filter(r => [1900, 1910, 1920, 1930, 1936].every(y => r.years[y] && r.years[y].g.U >= 0.45));
console.log('stuck (U* ≥ 45% at every decade 1900–1936):', stuck.length, '—', stuck.map(r => r.rel.split('/')[0].slice(0, 15) + ' ' + f(win(r) * 100, 0) + '%').join(' · '));
const cfgOf = {}; mod.forEach(r => (cfgOf[r.config] ||= []).push(r));
for (const t of [0.30, 0.20, 0.10, 0.05]) {
  const rows = mod.map(r => { const y = cross(r, t); return { x: X(r), y: y ?? 1936.5, cens: y == null, cfg: r.config }; });
  const fit = tobit(rows); const nul = tobit(rows.map(r => ({ ...r, x: [] })), 1936.5, 6000);
  const vy = van.map(r => cross(r, t)).filter(Boolean).sort((a, b) => a - b);
  console.log('\n=== first year Britain\'s U* < ' + t * 100 + '% — crossed in ' + rows.filter(r => !r.cens).length + '/' + rows.length + ' (vanilla ' + vy.length + '/16, median ' + vy[vy.length >> 1] + ') ===');
  console.log('  Tobit σ with levers ' + f(fit.sigma, 1) + ' y · without ' + f(nul.sigma, 1) + ' y → variance explained ' + f(1 - (fit.sigma / nul.sigma) ** 2));
  ['const', ...LEV].forEach((n, i) => { const tt = fit.beta[i] / fit.se[i]; console.log('   ' + n.padEnd(6) + f(fit.beta[i], 1).padStart(8) + ' ± ' + f(fit.se[i], 1).padEnd(6) + (Math.abs(tt) > 2 ? ' *' : Math.abs(tt) > 1 ? ' .' : '')); });
  // years per ln-unit → years per a step one would actually take
  const b = i => fit.beta[LEV.indexOf(i) + 1];
  console.log('  per step: B 1.58→1.64 ' + f(b('lnB') * Math.log(1.64 / 1.58), 1) + ' y · A 2.0→2.2 ' + f(b('lnA') * Math.log(1.1), 1) + ' y · cost 1.9→2.05 ' + f(b('lnC') * Math.log(2.05 / 1.9), 1) + ' y · trade 0→1 ' + f(b('trade'), 1) + ' y');
  // within-config spread of the crossing year, uncensored configs with ≥ 3 runs
  const w = Object.entries(cfgOf).filter(([, rs]) => rs.length >= 3).map(([c, rs]) => [c, rs.map(r => cross(r, t))]);
  if (t === 0.10) for (const [c, ys] of w) console.log('   ' + c.replace('mod_config.', '').padEnd(34) + ys.map(y => y ?? '  —').join(' '));
}
// the end-state U* on the same levers, for comparison (OLS on a bounded, floored quantity)
const o = ols(mod.map(X), mod.map(win), LEV); console.log('\nend-state GBR U* (OLS, same levers): R² ' + f(o.r2) + ' · residual sd ' + f(o.rmse * 100, 1) + ' pp');
