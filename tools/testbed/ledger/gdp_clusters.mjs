// Is the four-rung world-GDP outcome distribution multimodal (stall / regular / runoff), or a continuum?
// usage: node clusters.mjs <corpus.jsonl> [<more.jsonl> ...]
import { readFileSync } from 'node:fs';
const files = process.argv.slice(2);
const L = files.flatMap(f => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
// de-duplicate by rel
const seen = new Set(); const R = L.filter(r => !seen.has(r.rel) && seen.add(r.rel));
const van = R.filter(r => r.arm === 'vanilla'), mod = R.filter(r => r.arm === 'mod');
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const YRS = []; for (let y = 1840; y <= 1935; y += 5) YRS.push(y);
const vmed = {}; for (let y = 1837; y <= 1936; y++) { const v = van.map(r => r.years[y]?.w?.gdp).filter(Boolean); if (v.length) vmed[y] = med(v); }
const endOf = r => { const v = []; for (let y = 1932; y <= 1936; y++) if (r.years[y] && vmed[y]) v.push(r.years[y].w.gdp / vmed[y]); return v.length >= 3 ? mean(v) : null; };
const traj = r => YRS.map(y => { const yy = [y, y + 1, y - 1].find(z => r.years[z] && vmed[z]); return yy ? Math.log(r.years[yy].w.gdp / vmed[yy]) : null; });
let rng = 12345; const rnd = () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296;
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ---- Silverman critical-bandwidth test (H0: at most k modes) ----
function nModes(x, h) { const lo = Math.min(...x) - 3 * h, hi = Math.max(...x) + 3 * h, G = 512; let prev = -1, up = false, m = 0;
  for (let i = 0; i <= G; i++) { const t = lo + (hi - lo) * i / G; let d = 0; for (const xi of x) d += Math.exp(-0.5 * ((t - xi) / h) ** 2);
    if (prev >= 0) { if (d > prev) up = true; else if (d < prev && up) { m++; up = false; } } prev = d; } return m + (up ? 1 : 0); }
function hcrit(x, k) { let lo = 1e-4, hi = 5 * sd(x); for (let i = 0; i < 40; i++) { const h = (lo + hi) / 2; if (nModes(x, h) <= k) hi = h; else lo = h; } return hi; }
function silverman(x, k, B = 500) { const h = hcrit(x, k), s = sd(x), m = mean(x), c = 1 / Math.sqrt(1 + h * h / (s * s)); let exc = 0;
  for (let b = 0; b < B; b++) { const y = x.map(() => { const xi = x[Math.floor(rnd() * x.length)]; return m + c * (xi - m + h * gauss()); }); if (nModes(y, h) > k) exc++; }
  return { h, p: exc / B }; }
// ---- 1-D Gaussian mixture by EM, BIC ----
function gmm(x, k, starts = 30) { let best = null; const n = x.length; const sx = [...x].sort((a, b) => a - b);
  for (let s = 0; s < starts; s++) { let mu = Array.from({ length: k }, (_, j) => s === 0 ? sx[Math.floor((j + 0.5) / k * n)] : x[Math.floor(rnd() * n)]), sg = Array(k).fill(sd(x)), pi = Array(k).fill(1 / k), ll = -Infinity;
    for (let it = 0; it < 500; it++) { const R = x.map(xi => { const p = mu.map((m, j) => pi[j] * Math.exp(-0.5 * ((xi - m) / sg[j]) ** 2) / (sg[j] * Math.sqrt(2 * Math.PI))); const t = p.reduce((a, b) => a + b, 0) || 1e-300; return { p: p.map(v => v / t), t }; });
      const nll = R.reduce((a, r) => a + Math.log(r.t), 0);
      for (let j = 0; j < k; j++) { const w = R.reduce((a, r) => a + r.p[j], 0); if (w < 1e-6) continue; mu[j] = R.reduce((a, r, i) => a + r.p[j] * x[i], 0) / w; sg[j] = Math.max(0.01, Math.sqrt(R.reduce((a, r, i) => a + r.p[j] * (x[i] - mu[j]) ** 2, 0) / w)); pi[j] = w / n; }
      if (Math.abs(nll - ll) < 1e-9) break; ll = nll; }
    if (!best || ll > best.ll) best = { ll, mu: [...mu], sg: [...sg], pi: [...pi] }; }
  best.bic = -2 * best.ll + (3 * k - 1) * Math.log(n); return best; }
// ---- k-means + silhouette on vectors ----
const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
function kmeans(X, k, starts = 20) { let best = null;
  for (let s = 0; s < starts; s++) { let C = [X[Math.floor(rnd() * X.length)]]; while (C.length < k) { const d = X.map(x => Math.min(...C.map(c => dist(x, c))) ** 2); let r = rnd() * d.reduce((a, b) => a + b, 0), i = 0; while (r > d[i]) r -= d[i++]; C.push(X[Math.min(i, X.length - 1)]); }
    let lab = [];
    for (let it = 0; it < 100; it++) { const nl = X.map(x => { let bi = 0, bd = Infinity; C.forEach((c, j) => { const d = dist(x, c); if (d < bd) { bd = d; bi = j; } }); return bi; });
      if (nl.join() === lab.join()) break; lab = nl; C = C.map((c, j) => { const m = X.filter((_, i) => lab[i] === j); return m.length ? c.map((_, d) => mean(m.map(v => v[d]))) : c; }); }
    const sse = X.reduce((a, x, i) => a + dist(x, C[lab[i]]) ** 2, 0); if (!best || sse < best.sse) best = { sse, lab, C }; }
  return best; }
function silhouette(X, lab, k) { let s = 0; for (let i = 0; i < X.length; i++) { const d = Array(k).fill(0), c = Array(k).fill(0); for (let j = 0; j < X.length; j++) if (j !== i) { d[lab[j]] += dist(X[i], X[j]); c[lab[j]]++; }
    if (c[lab[i]] === 0) continue; const a = d[lab[i]] / c[lab[i]]; let b = Infinity; for (let q = 0; q < k; q++) if (q !== lab[i] && c[q]) b = Math.min(b, d[q] / c[q]); s += (b - a) / Math.max(a, b); } return s / X.length; }
// within/between ratio: mean intra-cluster pair distance / mean inter-cluster pair distance
function wb(X, lab) { let wi = 0, wn = 0, bi = 0, bn = 0; for (let i = 0; i < X.length; i++) for (let j = i + 1; j < X.length; j++) { const d = dist(X[i], X[j]); if (lab[i] === lab[j]) { wi += d; wn++; } else { bi += d; bn++; } } return (wi / wn) / (bi / bn); }
// PCA top-q projection (power iteration)
function pca(X, q) { const m = X[0].map((_, d) => mean(X.map(x => x[d]))); const Z = X.map(x => x.map((v, d) => v - m[d])); const D = m.length;
  const Cv = Array.from({ length: D }, (_, a) => Array.from({ length: D }, (_, b) => Z.reduce((s, z) => s + z[a] * z[b], 0) / (Z.length - 1)));
  const vecs = [], vals = []; let M = Cv.map(r => [...r]);
  for (let k = 0; k < q; k++) { let v = Array(D).fill(1).map(() => rnd() - 0.5); for (let it = 0; it < 500; it++) { const w = M.map(r => r.reduce((s, x, i) => s + x * v[i], 0)); const n = Math.hypot(...w); v = w.map(x => x / n); }
    const lam = M.map(r => r.reduce((s, x, i) => s + x * v[i], 0)).reduce((s, x, i) => s + x * v[i], 0); vecs.push(v); vals.push(lam); M = M.map((r, a) => r.map((x, b) => x - lam * v[a] * v[b])); }
  const tot = Cv.reduce((s, r, i) => s + r[i], 0);
  return { P: Z.map(z => vecs.map(v => z.reduce((s, x, i) => s + x * v[i], 0))), vals, tot }; }
// Gaussian null for clustering statistic: same mean/cov (in the projected space)
function nullSil(P, k, B = 200) { const q = P[0].length, n = P.length; const m = P[0].map((_, d) => mean(P.map(x => x[d]))); const sds = P[0].map((_, d) => sd(P.map(x => x[d])));
  const out = []; for (let b = 0; b < B; b++) { const Y = Array.from({ length: n }, () => m.map((mm, d) => mm + sds[d] * gauss())); const km = kmeans(Y, k, 8); out.push({ s: silhouette(Y, km.lab, k), w: wb(Y, km.lab) }); } return out; }

const rows = mod.map(r => ({ r, e: endOf(r), t: traj(r) })).filter(x => x.e && x.t.every(v => v != null));
console.log(`mod runs with full trajectory: ${rows.length} (of ${mod.length}); vanilla runs ${van.length}; configs ${new Set(rows.map(x => x.r.config)).size}`);
const vrows = van.map(r => ({ e: endOf(r) })).filter(x => x.e);
const E = rows.map(x => Math.log(x.e));
const hist = (vals, lo, hi, bw) => { const out = []; for (let b = lo; b < hi - 1e-9; b += bw) { const c = vals.filter(v => v >= b && v < b + bw).length; out.push(`${b.toFixed(2)}–${(b + bw).toFixed(2)} ${String(c).padStart(3)} ${'#'.repeat(c)}`); } return out.join('\n'); };
console.log('\n== END STATE (1932–36 mean world GDP ÷ vanilla median), all four-rung runs ==');
console.log(hist(rows.map(x => x.e), 0.3, 2.3, 0.05));
console.log('\nvanilla runs on the same scale:'); console.log(hist(vrows.map(x => x.e), 0.75, 1.25, 0.05));
function report1d(name, x) {
  const s1 = silverman(x, 1), s2 = silverman(x, 2); const g = [1, 2, 3, 4].map(k => gmm(x, k));
  console.log(`\n-- ${name}: n=${x.length}, sd(ln)=${sd(x).toFixed(3)}`);
  console.log(`   Silverman: H0 ≤1 mode p=${s1.p.toFixed(3)} (h=${s1.h.toFixed(3)});  H0 ≤2 modes p=${s2.p.toFixed(3)} (h=${s2.h.toFixed(3)})`);
  console.log(`   GMM BIC k=1..4: ${g.map(v => v.bic.toFixed(1)).join(' / ')}  (lower is better)`);
  for (const k of [2, 3]) { const gg = g[k - 1]; const ord = gg.mu.map((m, j) => j).sort((a, b) => gg.mu[a] - gg.mu[b]);
    console.log(`   k=${k}: ` + ord.map(j => `${Math.exp(gg.mu[j]).toFixed(2)}× (σ ${gg.sg[j].toFixed(2)}, w ${gg.pi[j].toFixed(2)})`).join(' | ')); }
  // separation test for 3 bands: Ashman's D between adjacent components
}
report1d('end state, pooled, all configs', E);
// within-config residuals
const byCfg = {}; for (const x of rows) (byCfg[x.r.config] ??= []).push(x);
const resid = [], residT = [];
for (const [c, xs] of Object.entries(byCfg)) if (xs.length >= 3) { const m = med(xs.map(x => Math.log(x.e))); for (const x of xs) resid.push(Math.log(x.e) - m);
  const mt = YRS.map((_, i) => med(xs.map(x => x.t[i]))); for (const x of xs) residT.push(x.t.map((v, i) => v - mt[i])); }
report1d('end state, within-config residual (configs with n≥3)', resid);
console.log('\nconfigs with n≥3:'); for (const [c, xs] of Object.entries(byCfg).sort((a, b) => b[1].length - a[1].length)) if (xs.length >= 3) console.log(`   ${c.padEnd(52)} n=${String(xs.length).padStart(2)}  end ×: ${xs.map(x => x.e.toFixed(2)).sort().join(' ')}`);
for (const [c, xs] of Object.entries(byCfg)) if (xs.length >= 10) report1d(`single config ${c}`, xs.map(x => Math.log(x.e)));
report1d('vanilla end state', vrows.map(x => Math.log(x.e)));

// ---- trajectories ----
function reportTraj(name, X) {
  const p = pca(X, 3); console.log(`\n== TRAJECTORIES: ${name}, n=${X.length}, PCs explain ${p.vals.map(v => (100 * v / p.tot).toFixed(0)).join('/')}% ==`);
  for (const k of [2, 3, 4]) { const km = kmeans(p.P, k); const s = silhouette(p.P, km.lab, k), w = wb(p.P, km.lab); const nl = nullSil(p.P, k);
    const ps = nl.filter(v => v.s >= s).length / nl.length, pw = nl.filter(v => v.w <= w).length / nl.length;
    const sizes = Array.from({ length: k }, (_, j) => km.lab.filter(l => l === j).length);
    console.log(`   k=${k}: silhouette ${s.toFixed(3)} (Gaussian null median ${med(nl.map(v => v.s)).toFixed(3)}, p=${ps.toFixed(3)});  within/between pair distance ${w.toFixed(3)} (null ${med(nl.map(v => v.w)).toFixed(3)}, p=${pw.toFixed(3)}); sizes ${sizes.join('/')}`); }
  return p; }
const P = reportTraj('pooled, ln(world GDP ÷ vanilla median) every 5y 1840–1935', rows.map(x => x.t));
reportTraj('within-config residual (configs n≥3)', residT);
// also 3-cluster k-means centres on raw trajectories, to describe the shapes
const km3 = kmeans(rows.map(x => x.t), 3); const ord = [0, 1, 2].sort((a, b) => km3.C[a][19] - km3.C[b][19]);
console.log('\n3-means centres on the raw trajectory (ratio to vanilla), years ' + [1850, 1875, 1900, 1915, 1935].join(' / '));
for (const j of ord) console.log(`   n=${String(km3.lab.filter(l => l === j).length).padStart(3)}: ` + [1850, 1875, 1900, 1915, 1935].map(y => Math.exp(km3.C[j][YRS.indexOf(y)]).toFixed(2)).join(' / '));
// gaps: largest gaps in sorted end state vs expected under normal
const se = [...E].sort((a, b) => a - b); const gaps = se.slice(1).map((v, i) => ({ g: v - se[i], at: Math.exp((v + se[i]) / 2) })).sort((a, b) => b.g - a.g).slice(0, 5);
console.log('\nlargest gaps in sorted end-state ln ratio: ' + gaps.map(g => `${g.g.toFixed(3)} at ${g.at.toFixed(2)}×`).join(', '));
const ng = []; for (let b = 0; b < 500; b++) { const y = E.map(() => gauss()).sort((a, b) => a - b); ng.push(Math.max(...y.slice(1).map((v, i) => v - y[i])) * sd(E)); }
console.log(`   null (normal, same n and sd) max gap median ${med(ng).toFixed(3)}, 95th pct ${[...ng].sort((a, b) => a - b)[475].toFixed(3)}`);

// ================= PART 2: refined tests =================
console.log('\n\n================ PART 2 ================');
// leave-one-out within-config residuals (configs n>=3)
const loo = [], looT = [], looLab = [];
for (const [c, xs] of Object.entries(byCfg)) if (xs.length >= 3) xs.forEach((x, i) => { const o = xs.filter((_, j) => j !== i);
  loo.push(Math.log(x.e) - med(o.map(z => Math.log(z.e)))); looT.push(x.t.map((v, d) => v - med(o.map(z => z.t[d])))); looLab.push(c); });
report1d('end state, LEAVE-ONE-OUT within-config residual (n≥3 configs)', loo);
// unimodal-shaped null: Silverman smoothed bootstrap at the 1-mode critical bandwidth
function uniNull(x) { const h = hcrit(x, 1), s = sd(x), m = mean(x), c = 1 / Math.sqrt(1 + h * h / (s * s)); return () => x.map(() => { const xi = x[Math.floor(rnd() * x.length)]; return m + c * (xi - m + h * gauss()); }); }
function trajTest(name, X, B = 300) {
  const p = pca(X, 3); const pc1 = p.P.map(v => v[0]);
  const s1 = silverman(pc1, 1, 800), s2 = silverman(pc1, 2, 800);
  console.log(`\n== ${name}: n=${X.length}; PC1 = ${(100 * p.vals[0] / p.tot).toFixed(0)}% of variance; Silverman on PC1: ≤1 mode p=${s1.p.toFixed(3)}, ≤2 modes p=${s2.p.toFixed(3)}`);
  const gen = uniNull(pc1); const sds = [1, 2].map(d => sd(p.P.map(v => v[d])));
  for (const k of [2, 3]) { const km = kmeans(p.P, k); const s = silhouette(p.P, km.lab, k), w = wb(p.P, km.lab);
    const nl = []; for (let b = 0; b < B; b++) { const a = gen(); const Y = a.map(v => [v, sds[0] * gauss(), sds[1] * gauss()]); const kk = kmeans(Y, k, 6); nl.push({ s: silhouette(Y, kk.lab, k), w: wb(Y, kk.lab) }); }
    console.log(`   k=${k}: silhouette ${s.toFixed(3)} vs UNIMODAL-shaped null median ${med(nl.map(v => v.s)).toFixed(3)} p=${(nl.filter(v => v.s >= s).length / B).toFixed(3)};  within/between ${w.toFixed(3)} vs null ${med(nl.map(v => v.w)).toFixed(3)} p=${(nl.filter(v => v.w <= w).length / B).toFixed(3)}`); }
  return pc1; }
trajTest('pooled trajectories', rows.map(x => x.t));
trajTest('pooled trajectories, flat/low-cost runaway configs removed (end > 1.5×)', rows.filter(x => x.e < 1.5).map(x => x.t));
trajTest('LOO within-config residual trajectories', looT);
// per-year: is there a gap at any date?
console.log('\nper-year Silverman (≤1 mode p) on ln ratio — pooled | LOO residual:');
for (const y of [1860, 1880, 1900, 1915, 1925, 1935]) { const i = YRS.indexOf(y); console.log(`   ${y}: ${silverman(rows.map(x => x.t[i]), 1, 400).p.toFixed(3)} | ${silverman(looT.map(v => v[i]), 1, 400).p.toFixed(3)}`); }
// band occupancy & density at the register's hard lines vs at the band centres
const kde = (x, h, t) => x.reduce((a, xi) => a + Math.exp(-0.5 * ((t - xi) / h) ** 2), 0) / (x.length * h * Math.sqrt(2 * Math.PI));
const hS = 1.06 * sd(E) * E.length ** -0.2;
console.log(`\nKDE (Silverman rule h=${hS.toFixed(3)}) density of ln end ratio at:`);
for (const v of [0.5, 0.6, 0.66, 0.75, 0.9, 1.0, 1.1, 1.2, 1.38, 1.6, 1.9]) console.log(`   ${v.toFixed(2)}×: ${kde(E, hS, Math.log(v)).toFixed(3)}`);
const band = v => v < 0.66 ? 'stall' : v > 1.38 ? 'runoff' : 'intact';
const bc = {}; rows.forEach(x => bc[band(x.e)] = (bc[band(x.e)] || 0) + 1); console.log('register hard-band counts (0.66 / 1.38):', bc);
console.log('\nruns above 1.5×:'); rows.filter(x => x.e > 1.5).forEach(x => console.log(`   ${x.e.toFixed(2)}  ${x.r.config}  ${x.r.rel}`));
// variance decomposition between configs vs within
const big = Object.entries(byCfg).filter(([, xs]) => xs.length >= 2); let ssw = 0, nw = 0; const cm = [];
for (const [, xs] of big) { const l = xs.map(x => Math.log(x.e)), m = mean(l); ssw += l.reduce((a, v) => a + (v - m) ** 2, 0); nw += l.length - 1; cm.push(m); }
console.log(`\nwithin-config sd(ln) ${Math.sqrt(ssw / nw).toFixed(3)} (pooled over ${big.length} configs with n≥2); sd of config means ${sd(cm).toFixed(3)}; total sd ${sd(E).toFixed(3)}; vanilla seed sd ${sd(vrows.map(x => Math.log(x.e))).toFixed(3)}`);
// configs n>=10 and their own histograms
for (const [c, xs] of Object.entries(byCfg)) if (xs.length >= 10) { console.log(`\n${c} n=${xs.length}:`); console.log(hist(xs.map(x => x.e), 0.4, 1.5, 0.05)); }
