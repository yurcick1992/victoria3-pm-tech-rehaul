// THE POOLED LEVER MODEL (FINDINGS F165, 2026-09-25): OLS of each end-state line (ln world GDP, ln pool GDP, GBR U*,
// pool U*, ln pool H, T0 share) on the lever vector every book records in `_ab` (ln A, effective ln B and ln C — a
// per-era ladder enters as its top step's geometric mean — in0, ln of the ai_value ratio, the spending CRITICAL
// threshold, trade scale, the anchor slide, the finish boost, the research bar), over every usable century run of the
// four-rung A/B books; leave-one-CONFIG-out prediction against the pooled mean; the EXCHANGE RATE (GBR U* pp and the
// hoard's factor per +10% world GDP bought with each lever); the seed-level residual correlation; the within-config
// seed spread. ⚠ Runs of one config share a lever vector, so the standard errors are optimistic (effective n is
// nearer the config count); levers that change together over the project's history are only partly separable.
//   node tools/testbed/ledger/corpus_levers.mjs [corpus.jsonl] [lever,lever,…] [since-session-prefix]
import { load, med, mean, sd, corr, ols, f } from './lib_corpus_stats.mjs';
const C = load(process.argv[2] || new URL('corpus_runs.jsonl', import.meta.url));
const van = C.filter(r => r.arm === 'vanilla' && r.session.startsWith('20260821_131149'));
const win = (r, k, sub) => mean([1932, 1933, 1934, 1935, 1936].map(y => r.years[y] && r.years[y][k][sub]));
const vEnd = med(van.map(r => win(r, 'w', 'gdp'))), vPool = med(van.map(r => win(r, 'p', 'gdp'))), vPH = med(van.map(r => win(r, 'p', 'H'))), vGU = med(van.map(r => win(r, 'g', 'U')));
console.log('vanilla n', van.length, '· GBR U* median', f(vGU * 100, 1) + '%', '· pool H', f(vPH));
const L = r => { const l = r.lev;
  const lnB = l.in_ladder ? Math.log(l.in_ladder[l.in_ladder.length - 1]) / l.in_ladder.length : Math.log(l.B);
  const lnC = l.cost_ladder ? Math.log(l.cost_ladder[l.cost_ladder.length - 1]) / l.cost_ladder.length : Math.log(l.cost_ratio ?? l.A);
  const lnAI = l.ai_ladder ? Math.log(l.ai_ladder[3] / l.ai_ladder[0]) / 3 : Math.log(l.ai_ratio ?? l.A);
  return { lnA: Math.log(l.A), lnB, lnC, in0: l.in0, lnAI, crit: l.crit ?? 0.75, trade: typeof l.trade === "object" ? l.trade.k : l.trade, slide: l.anchor_n > 0 ? 1 : 0, finish: +l.finish, bar: l.bar, elec: +l.elec, qcap: l.qcap ?? 0.05, rnd: l.rnd ?? 10, stage: +(l.in0_stage || l.in0_level) }; };
const mod = C.filter(r => r.arm === 'mod' && r.lev).map(r => {
  const Tend = [0, 1, 2, 3].map(i => mean([1932, 1933, 1934, 1935, 1936].map(y => r.years[y] && r.years[y].T[i])));
  return { ...r, x: L(r), E: win(r, 'w', 'gdp') / vEnd, EP: win(r, 'p', 'gdp') / vPool, GU: win(r, 'g', 'U'), PU: win(r, 'p', 'U'), PH: win(r, 'p', 'H'), GH: win(r, 'g', 'H'), PW: win(r, 'p', 'W'), T0: Tend[0] / (Tend[1] + Tend[2] + Tend[3]) };
});
const cfgs = {}; for (const r of mod) (cfgs[r.config] ||= []).push(r);
console.log('mod runs', mod.length, '· configs', Object.keys(cfgs).length);
// lever coverage: which values each lever takes, and in how many configs
const keys = Object.keys(mod[0].x);
for (const k of keys) { const vals = {}; for (const [c, rs] of Object.entries(cfgs)) { const v = f(rs[0].x[k], 3); (vals[v] ||= []).push(c); } console.log(k.padEnd(7), Object.entries(vals).map(([v, cs]) => v + '×' + cs.length).join('  ')); }
// the model: pick levers that actually vary; drop near-constant ones
const OUT = { 'ln world GDP': r => Math.log(r.E), 'ln pool GDP': r => Math.log(r.EP), 'GBR U*': r => r.GU, 'pool U*': r => r.PU, 'ln pool H': r => Math.log(r.PH), 'T0 share': r => r.T0 };
const use = process.argv[3] ? process.argv[3].split(',') : ['lnA', 'lnB', 'lnC', 'in0', 'lnAI', 'crit', 'trade', 'slide', 'finish', 'bar'];
const since = process.argv[4] || '';
const M = mod.filter(r => r.session >= since);
console.log('\nmodel on', M.length, 'runs since', since || 'all', '· levers', use.join(' '));
const fits = {};
for (const [name, fn] of Object.entries(OUT)) {
  const X = M.map(r => use.map(k => r.x[k])), y = M.map(fn);
  try { const o = ols(X, y, use); fits[name] = o;
    console.log('\n' + name + ': R² ' + f(o.r2) + ' · residual sd ' + f(o.rmse, 3) + ' · n ' + o.n);
    o.names.forEach((nm, i) => { const t = o.beta[i] / o.se[i]; console.log('   ' + nm.padEnd(7) + f(o.beta[i], 3).padStart(9) + ' ± ' + f(o.se[i], 3).padEnd(7) + (Math.abs(t) > 2 ? ' *' : Math.abs(t) > 1 ? ' .' : '')); });
  } catch (e) { console.log(name, 'singular:', e.message); }
}
// leave-one-CONFIG-out: does the model predict a book it has not seen better than the pooled mean does?
console.log('\n=== leave-one-config-out prediction of a config\'s mean (ln world GDP, GBR U*) ===');
for (const name of ['ln world GDP', 'GBR U*', 'ln pool H']) {
  const fn = OUT[name]; let se = 0, se0 = 0, n = 0; const rows = [];
  for (const c of Object.keys(cfgs)) { const tr = M.filter(r => r.config !== c), te = M.filter(r => r.config === c); if (!te.length) continue;
    let o; try { o = ols(tr.map(r => use.map(k => r.x[k])), tr.map(fn), use); } catch { continue; }
    const pred = o.beta[0] + use.reduce((s, k, i) => s + o.beta[i + 1] * te[0].x[k], 0); const act = mean(te.map(fn)); const base = mean(tr.map(fn));
    se += (pred - act) ** 2; se0 += (base - act) ** 2; n++; rows.push([c, te.length, act, pred]); }
  console.log(name + ': LOCO rmse ' + f(Math.sqrt(se / n), 3) + ' vs predicting the pooled mean ' + f(Math.sqrt(se0 / n), 3) + ' (n configs ' + n + ')');
  if (process.env.SHOW) for (const [c, k, a, p] of rows) console.log('   ' + c.padEnd(40) + ' n' + k + ' actual ' + f(a, 3) + ' pred ' + f(p, 3));
}
// the exchange rate: per lever, d(GBR U*) per +10% world GDP
console.log('\n=== exchange rate: GBR U* change (pp) per +10% world GDP bought with each lever ===');
const g = fits['ln world GDP'], u = fits['GBR U*'], h = fits['ln pool H'];
if (g && u) use.forEach((k, i) => { const bg = g.beta[i + 1], bu = u.beta[i + 1], bh = h.beta[i + 1]; if (Math.abs(bg / g.se[i + 1]) < 1) return;
  console.log('  ' + k.padEnd(7) + ' U* ' + f(100 * bu / bg * Math.log(1.1), 1) + 'pp · pool H ×' + f(Math.exp(bh / bg * Math.log(1.1)), 3) + ' per +10% GDP  (GDP t=' + f(bg / g.se[i + 1], 1) + ', U* t=' + f(bu / u.se[i + 1], 1) + ')'); });
// residual correlation between outcomes: the seed-level trade-off the levers cannot separate
if (g && u) { console.log('\nresidual (seed) correlation, ln world GDP vs GBR U*:', f(corr(g.res, u.res).r), '· vs ln pool H:', f(corr(g.res, h.res).r)); }
// within-config spread (the seed noise floor)
const wsd = fn => { const d = []; for (const rs of Object.values(cfgs)) if (rs.length >= 2) { const m = mean(rs.map(fn)); for (const r of rs) d.push(fn(r) - m); } return sd(d) * Math.sqrt(d.length / (d.length - Object.values(cfgs).filter(rs => rs.length >= 2).length)); };
console.log('within-config sd (seed noise): ln world GDP', f(wsd(OUT['ln world GDP']), 3), '· GBR U*', f(wsd(OUT['GBR U*']), 3), '· ln pool H', f(wsd(OUT['ln pool H']), 3), '· T0 share', f(wsd(OUT['T0 share']), 3));
