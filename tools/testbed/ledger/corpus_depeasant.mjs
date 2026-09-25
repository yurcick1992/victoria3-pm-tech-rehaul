// WHEN DOES BRITAIN DEPEASANT? (FINDINGS F165 §4, user-proposed 2026-09-25: "expected year when GBR is at 5% U* will be
// more uniform and more obviously connected with the levers; the bimodality is just us lumping 'depeasanted by 1935',
// 'by 1930' and 'by 1925' together"). Per run, the first year Britain's U* (incl. peasants) falls under a threshold;
// a run that never crosses by 1936 is RIGHT-CENSORED, not dropped and not set to 1936. Fitted on the corpus levers by a
// censored-normal (Tobit) regression, beside the same model on the end-state U* (OLS), so the two readings' signal
// can be compared: the share of variance the levers explain, and the leave-one-config-out error.
//   node tools/testbed/ledger/corpus_depeasant.mjs [corpus.jsonl] [since-session-prefix]
import { load, mean, sd, ols, f } from './lib_corpus_stats.mjs';
import { LEV, X, cross, tobit, isStuck } from './lib_depeasant.mjs';
const C = load(process.argv[2] || new URL('corpus_runs.jsonl', import.meta.url)); const since = process.argv[3] || '';
const win = r => mean([1932, 1933, 1934, 1935, 1936].map(y => r.years[y] && r.years[y].g.U));
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
