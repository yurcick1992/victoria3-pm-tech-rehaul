// VALIDATE THE RESEARCH MODEL against what a run actually did (BALANCE_FRAMEWORK §10.96): simulate from the run's first summary, driven by its
// measured literacy / innovation paths, and compare the technology stock year by year — the all-country distribution, the leader's share of
// each game era, and named countries. Several seeds; the model is stochastic like the game.
// usage: node tools/research_model/validate.mjs <summaries dir> [--mod <emitted mod>] [--seeds 5] [--years 1846,1866,…] [--tags GBR,FRA,…]
//        [--lever key=value …] [--grants <grants.json>] [--je]  (--je: the run's own research-entry grants, from its debug.log)
import fs from 'node:fs';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { simulate } from './lib_sim.mjs';
import { metricsAt, median } from './lib_metrics.mjs'; import { extractGrants } from './lib_grants.mjs'; import path from 'node:path';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DIR = args[0]; const tree = loadTree(opt('--mod', null));
const SEEDS = +opt('--seeds', 5);
const YEARS = opt('--years', '1846,1856,1866,1876,1886,1896,1906,1916,1926,1936').split(',').map(Number);
const TAGS = opt('--tags', 'GBR,FRA,USA,PRU,RUS,JAP,AUS,TUR,CHI').split(',');
const L = {}; args.forEach((a, i) => { if (a === '--lever') { const [k, v] = args[i + 1].split('='); L[k] = isNaN(+v) ? v : +v; } });
const grants = opt('--grants', null) ? JSON.parse(fs.readFileSync(opt('--grants'), 'utf8')) : null;
const paths = loadPaths(DIR);
let G2 = grants; if (args.includes('--je')) { const g = extractGrants(path.dirname(DIR), tree, paths, { modDir: opt('--mod', null) }); G2 = g.grants; console.log('research-entry grants:', JSON.stringify(g.stats)); }
const t0 = Date.now(); const sims = [];
for (let s = 1; s <= SEEDS; s++) sims.push(simulate(tree, paths, L, { seed: s, grants: G2 && structuredClone(G2) }));
console.log(`${paths.years.length} yearly inputs ${paths.years[0]}–${paths.years.at(-1)}; ${SEEDS} seeds in ${((Date.now() - t0) / 1000).toFixed(1)} s; levers ${JSON.stringify(L)}`);
const obsY = y => Object.fromEntries(Object.entries(paths.at[y]).map(([k, p]) => [k, p.held]));
const f = x => Number.isFinite(x) ? x.toFixed(0) : '—', pc = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '—';
console.log('\nyear  | median obs/sim | p90 obs/sim | max obs/sim (leader) | leader era2 / era3 / era4 / era5 share obs → sim');
for (const y of YEARS.filter(y => paths.at[y])) {
  const o = metricsAt(tree, obsY(y)); const ss = sims.map(S => metricsAt(tree, S[y]));
  const m = k => median(ss.map(x => x[k])); const me = (e, fn = 'eraShare') => median(ss.map(x => x[fn](e)));
  console.log(`${y}  | ${f(o.median)} / ${f(m('median'))} | ${f(o.p90)} / ${f(m('p90'))} | ${f(o.max)} / ${f(m('max'))} (${o.leader}/${ss[0].leader}) | `
    + [2, 3, 4, 5].map(e => `${pc(o.eraShare(e))}→${pc(me(e))}`).join('  '));
}
console.log('\nnamed countries, technologies held obs / sim (median over seeds):');
console.log('year  ' + TAGS.map(t => t.padStart(10)).join(''));
for (const y of YEARS.filter(y => paths.at[y])) {
  console.log(`${y}  ` + TAGS.map(t => { const o = paths.at[y][t]?.held.length; const s = median(sims.map(S => S[y][t]?.length).filter(Number.isFinite));
    return (o == null ? '—' : `${o}/${f(s)}`).padStart(10); }).join(''));
}
// a scalar error: mean |sim − obs| technologies per country over the scored years (countries present at the first year, main records)
let e = 0, n = 0; for (const y of YEARS.filter(y => paths.at[y])) for (const [k, p] of Object.entries(paths.at[y])) { if (k.includes('@')) continue;
  const s = median(sims.map(S => S[y][k]?.length).filter(Number.isFinite)); if (Number.isFinite(s)) { e += Math.abs(s - p.held.length); n++; } }
console.log(`\nmean |sim − obs| per country-year: ${(e / n).toFixed(2)} technologies (n ${n})`);
