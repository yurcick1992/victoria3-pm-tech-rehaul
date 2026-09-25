// HOW WELL DOES AN EARLY READING PREDICT THE END STATE? (FINDINGS F165, 2026-09-25) — over the corpus written by
// corpus_extract.mjs: world GDP ÷ vanilla at a decade against the 1932–36 mean, across runs, WITHIN a config (seed
// deviations from the config mean) and BETWEEN configs (config means); Britain's U* the same way; how early a stall
// (< 0.66) or a runoff (> 1.38) can be flagged. Read-only.  node tools/testbed/ledger/corpus_early.mjs [corpus.jsonl]
import { load, med, mean, sd, corr, spearman, f } from './lib_corpus_stats.mjs';
const C = load(process.argv[2] || new URL('corpus_runs.jsonl', import.meta.url));
const van = C.filter(r => r.arm === 'vanilla' && r.session.startsWith('20260821_131149'));
const mod = C.filter(r => r.arm === 'mod');
console.log('runs: vanilla ref', van.length, '· mod', mod.length, '· configs', new Set(mod.map(r => r.config)).size);
const win = (r, k, sub) => mean([1932, 1933, 1934, 1935, 1936].map(y => r.years[y] && r.years[y][k][sub]));
const at = (r, y, k, sub) => r.years[y] ? r.years[y][k][sub] : NaN;
const vW = {}; for (let y = 1836; y <= 1936; y++) vW[y] = { gdp: med(van.map(r => at(r, y, 'w', 'gdp'))), pgdp: med(van.map(r => at(r, y, 'p', 'gdp'))) };
const vEnd = med(van.map(r => win(r, 'w', 'gdp')));
for (const r of mod) {
  r.E = win(r, 'w', 'gdp') / vEnd; r.EU = win(r, 'g', 'U'); r.EH = win(r, 'p', 'H');
  const Tend = [0, 1, 2, 3].map(i => mean([1932, 1933, 1934, 1935, 1936].map(y => r.years[y] && r.years[y].T[i])));
  r.ET0 = Tend[0] / (Tend[1] + Tend[2] + Tend[3]);
  r.g = {}; r.u = {}; for (let y = 1840; y <= 1930; y += 5) { r.g[y] = at(r, y, 'w', 'gdp') / vW[y].gdp; r.u[y] = at(r, y, 'g', 'U'); }
}
// config means for the within-config decomposition
const byCfg = {}; for (const r of mod) (byCfg[r.config] ||= []).push(r);
const years = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930];
console.log('\n=== world GDP ÷ vanilla median at year Y  vs  end-state (1932–36 mean) ===');
console.log('year | all runs r (Spearman) | within-config r (deviation from config mean, configs n≥2) | between-config r (config means, n≥2) | R² of log-log fit');
for (const y of years) {
  const x = mod.map(r => Math.log(r.g[y])), e = mod.map(r => Math.log(r.E));
  const a = corr(x, e), s = spearman(x, e);
  const wx = [], we = [], bx = [], be = [];
  for (const rs of Object.values(byCfg)) { if (rs.length < 2) continue; const mx = mean(rs.map(r => Math.log(r.g[y]))), me = mean(rs.map(r => Math.log(r.E))); bx.push(mx); be.push(me);
    for (const r of rs) { wx.push(Math.log(r.g[y]) - mx); we.push(Math.log(r.E) - me); } }
  const w = corr(wx, we), b = corr(bx, be);
  console.log(y, '|', f(a.r), '(' + f(s.r) + ') n=' + a.n, '|', f(w.r), 'n=' + w.n, '|', f(b.r), 'n=' + b.n, '|', f(a.r ** 2));
}
console.log('\n=== Britain U* (incl. peasants) at year Y vs end-state GBR U* ===');
for (const y of [1880, 1900, 1910, 1920, 1930]) {
  const a = corr(mod.map(r => r.u[y]), mod.map(r => r.EU));
  const wx = [], we = []; for (const rs of Object.values(byCfg)) { if (rs.length < 2) continue; const mx = mean(rs.map(r => r.u[y])), me = mean(rs.map(r => r.EU)); for (const r of rs) { wx.push(r.u[y] - mx); we.push(r.EU - me); } }
  console.log(y, 'all r', f(a.r), 'n=' + a.n, '· within-config r', f(corr(wx, we).r));
}
console.log('\n=== early GDP vs other end-state lines (all runs, r) ===');
for (const y of [1880, 1900, 1920]) console.log(y, 'vs GBR U*', f(corr(mod.map(r => r.g[y]), mod.map(r => r.EU)).r), '· vs pool H', f(corr(mod.map(r => r.g[y]), mod.map(r => r.EH)).r), '· vs T0 share', f(corr(mod.map(r => r.g[y]), mod.map(r => r.ET0)).r));
// stall screening: can a run be flagged as broken-by-stall (end < 0.66) or runoff (> 1.38) early?
console.log('\n=== screening: end-state < 0.66 (stall) / > 1.38 (runoff) from world GDP at year Y ===');
const stall = mod.filter(r => r.E < 0.66), run = mod.filter(r => r.E > 1.38);
console.log('stalls', stall.length, '· runoffs', run.length, 'of', mod.length);
for (const y of [1870, 1880, 1890, 1900, 1910, 1920]) {
  const gs = mod.map(r => r.g[y]).filter(Number.isFinite).sort((a, b) => a - b);
  // the best threshold that catches every stall, and how many non-stalls it also flags
  const tS = Math.max(...stall.map(r => r.g[y])); const fpS = mod.filter(r => r.E >= 0.66 && r.g[y] <= tS).length;
  const tR = Math.min(...run.map(r => r.g[y])); const fpR = mod.filter(r => r.E <= 1.38 && r.g[y] >= tR).length;
  console.log(y, '| stalls: all caught at ≤', f(tS), 'also flags', fpS, 'healthy', '| stall values', stall.map(r => f(r.g[y])).join(' '), '| runoffs caught at ≥', f(tR), 'also flags', fpR);
}
// residual noise: within-config sd of end-state, and how much a given year's reading would shrink it
console.log('\n=== within-config spread of ln(end GDP) and what is left after conditioning on year Y (configs n≥2) ===');
const wE = []; for (const rs of Object.values(byCfg)) if (rs.length >= 2) { const me = mean(rs.map(r => Math.log(r.E))); for (const r of rs) wE.push(Math.log(r.E) - me); }
console.log('within-config sd of ln end GDP', f(sd(wE), 3), '(×' + f(Math.exp(sd(wE)), 3) + ')');
for (const y of years) { const wx = [], we = []; for (const rs of Object.values(byCfg)) { if (rs.length < 2) continue; const mx = mean(rs.map(r => Math.log(r.g[y]))), me = mean(rs.map(r => Math.log(r.E))); for (const r of rs) { wx.push(Math.log(r.g[y]) - mx); we.push(Math.log(r.E) - me); } }
  const c = corr(wx, we); console.log(y, 'residual sd', f(sd(we) * Math.sqrt(1 - c.r ** 2), 3), '— fraction of seed variance explained', f(c.r ** 2)); }
// vanilla itself: does vanilla's 1880 predict vanilla's end?
const vv = van.map(r => ({ E: win(r, 'w', 'gdp') / vEnd, g: Object.fromEntries(years.map(y => [y, at(r, y, 'w', 'gdp') / vW[y].gdp])) }));
console.log('\nvanilla n=' + vv.length + ':', years.map(y => y + ' r ' + f(corr(vv.map(r => Math.log(r.g[y])), vv.map(r => Math.log(r.E))).r)).join(' · '));
