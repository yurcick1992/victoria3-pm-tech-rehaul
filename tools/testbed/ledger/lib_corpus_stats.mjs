import { readFileSync } from 'node:fs';
export const load = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
export const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); if (!v.length) return NaN; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
export const mean = a => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
export const sd = a => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)); };
export const corr = (x, y) => { const p = x.map((v, i) => [v, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)); const mx = mean(p.map(q => q[0])), my = mean(p.map(q => q[1]));
  let sxy = 0, sxx = 0, syy = 0; for (const [a, b] of p) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; } return { r: sxy / Math.sqrt(sxx * syy), n: p.length }; };
export const spearman = (x, y) => { const p = x.map((v, i) => [v, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const rank = a => { const o = a.map((v, i) => [v, i]).sort((u, w) => u[0] - w[0]); const r = new Array(a.length); o.forEach(([, i], k) => r[i] = k); return r; };
  return corr(rank(p.map(q => q[0])), rank(p.map(q => q[1]))); };
// OLS with standard errors. X: rows of predictors (no intercept column; added here)
export function ols(X, y, names) {
  const rows = X.map((r, i) => [1, ...r, y[i]]).filter(r => r.every(Number.isFinite)); const n = rows.length, k = rows[0].length - 1;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0);
  for (const r of rows) for (let a = 0; a < k; a++) { Xty[a] += r[a] * r[k]; for (let b = 0; b < k; b++) XtX[a][b] += r[a] * r[b]; }
  const inv = invert(XtX); const beta = inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const res = rows.map(r => r[k] - r.slice(0, k).reduce((s, v, j) => s + v * beta[j], 0)); const sse = res.reduce((s, e) => s + e * e, 0);
  const s2 = sse / (n - k); const ym = mean(rows.map(r => r[k])); const sst = rows.reduce((s, r) => s + (r[k] - ym) ** 2, 0);
  return { n, k, beta, se: inv.map((row, i) => Math.sqrt(row[i] * s2)), names: ['const', ...names], r2: 1 - sse / sst, rmse: Math.sqrt(s2), res };
}
function invert(M) { const n = M.length; const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => +(i === j))]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c]; if (Math.abs(d) < 1e-12) throw new Error('singular at column ' + c); for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f) for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j]; } }
  return A.map(r => r.slice(n)); }
export const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
