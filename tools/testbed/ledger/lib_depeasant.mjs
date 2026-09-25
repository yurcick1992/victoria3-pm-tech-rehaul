// Shared by corpus_depeasant.mjs and corpus_depeasant_extrap.mjs (FINDINGS F165 §4–§5): the lever vector, the first
// year Britain's U* crosses a threshold, the stuck-Britain test, and a right-censored normal (Tobit) regression.
import { mean, sd } from './lib_corpus_stats.mjs';
export const LEV = ['lnA', 'lnB', 'lnC', 'in0', 'crit', 'trade', 'slide'];
export const X = r => { const l = r.lev;
  const lnB = l.in_ladder ? Math.log(l.in_ladder[l.in_ladder.length - 1]) / l.in_ladder.length : Math.log(l.B);
  const lnC = l.cost_ladder ? Math.log(l.cost_ladder[l.cost_ladder.length - 1]) / l.cost_ladder.length : Math.log(l.cost_ratio ?? l.A);
  return [Math.log(l.A), lnB, lnC, l.in0, l.crit ?? 0.75, typeof l.trade === 'object' ? l.trade.k : l.trade, l.anchor_n > 0 ? 1 : 0]; };
export const cross = (r, t) => { for (let y = 1840; y <= 1936; y++) { const v = r.years[y] && r.years[y].g.U; if (v != null && v < t) return y; } return null; };
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2)); const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
// Tobit, right-censored at c: maximise by gradient ascent (Adam) on [beta, ln sigma]
export function tobit(rows, c = 1936.5, iters = 20000) {   // rows: {x:[..], y, cens}
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
export const isStuck = r => [1900, 1910, 1920, 1930, 1936].every(y => r.years[y] && r.years[y].g.U >= 0.45);
