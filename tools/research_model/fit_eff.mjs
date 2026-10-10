// FIT THE RESEARCH-EFFICIENCY FACTOR (BALANCE_FRAMEWORK §10.96): directed research × resEff, the one free parameter, standing for what the model
// leaves out (research-speed modifiers, switching, overflow). Scored on the named majors' technology counts across the scored years, over several
// runs. usage: node tools/research_model/fit_eff.mjs <summaries dir>[,<dir>…] [--mod <emitted mod>] [--je] [--grid 0.85,0.9,…] [--seeds 2]
import path from 'node:path';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { simulate } from './lib_sim.mjs';
import { median } from './lib_metrics.mjs'; import { extractGrants } from './lib_grants.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DIRS = args[0].split(','); const tree = loadTree(opt('--mod', null));
const GRID = opt('--grid', '0.85,0.9,0.95,1.0').split(',').map(Number); const SEEDS = +opt('--seeds', 2);
const YEARS = [1856, 1866, 1876, 1886, 1896, 1906, 1916, 1926, 1936];
const MAJ = ['GBR', 'FRA', 'USA', 'PRU', 'GER', 'RUS', 'AUS', 'JAP', 'BEL', 'NET', 'TUR', 'SPA'];
const runs = DIRS.map(d => { const paths = loadPaths(d); const g = args.includes('--je') ? extractGrants(path.dirname(d), tree, paths, { modDir: opt('--mod', null) }).grants : null; return { d, paths, g }; });
for (const e of GRID) {
  let err = 0, bias = 0, n = 0; const byYear = {};
  for (const r of runs) for (let s = 1; s <= SEEDS; s++) {
    const S = simulate(tree, r.paths, { resEff: e }, { seed: s, grants: r.g && structuredClone(r.g) });
    for (const y of YEARS) { if (!r.paths.at[y]) continue; for (const t of MAJ) { const o = r.paths.at[y][t]?.held.length, x = S[y]?.[t]?.length; if (o == null || x == null) continue;
      err += Math.abs(x - o); bias += x - o; n++; (byYear[y] ||= []).push(x - o); } }
  }
  console.log(`resEff ${e.toFixed(2)}: majors mean |sim − obs| ${(err / n).toFixed(2)}, mean bias ${(bias / n).toFixed(2)}  | bias by year ` + YEARS.filter(y => byYear[y]).map(y => `${y} ${median(byYear[y]).toFixed(0)}`).join(' '));
}
