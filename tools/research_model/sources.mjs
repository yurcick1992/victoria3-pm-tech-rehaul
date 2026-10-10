// WHERE A COUNTRY'S TECHNOLOGY POINTS COME FROM (BALANCE_FRAMEWORK §10.96) — the model's accounting (lib_sim `acct`): per country and year the
// points directed research, spread and research-entry grants put into technologies (only what went toward a completion), grouped by the
// country's RANK by technologies held at that year: the leader, the tech majors, and the all-country quartiles (Q1 = the top quarter … Q4 =
// the laggards), main records only, over periods. Read with the model's validated flows (F223); it is the model's split, not a save's.
// usage: node tools/research_model/sources.mjs --runs <dir,…> [--mod <emitted mod>] [--je] [--seeds 2] [--eff 0.95] [--lever k=v …]
import path from 'node:path';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { simulate } from './lib_sim.mjs';
import { MAJORS } from './lib_metrics.mjs'; import { extractGrants } from './lib_grants.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MOD = opt('--mod', null); const tree = loadTree(MOD); const SEEDS = +opt('--seeds', 2); const EFF = +opt('--eff', 0.95);
const L = { resEff: EFF }; args.forEach((a, i) => { if (a === '--lever') { const [k, v] = args[i + 1].split('='); L[k] = isNaN(+v) ? v : +v; } });
const PERIODS = [[1836, 1866], [1866, 1900], [1900, 1936]];
const GROUPS = ['leader', 'majors', 'Q1 top', 'Q2', 'Q3', 'Q4 laggards'];
const tot = {}; for (const p of PERIODS) for (const g of GROUPS) tot[`${p[0]}|${g}`] = { res: 0, spr: 0, je: 0, n: 0 };
for (const d of opt('--runs').split(',')) {
  const paths = loadPaths(d); const g = args.includes('--je') ? extractGrants(path.dirname(d), tree, paths, { modDir: MOD }).grants : null;
  for (let s = 1; s <= SEEDS; s++) {
    const acct = {}; const S = simulate(tree, paths, L, { seed: s, grants: g && structuredClone(g), acct });
    for (const y of paths.years) {
      const p = PERIODS.find(([a, b]) => y >= a && y < b); if (!p || !S[y]) continue;
      const rows = Object.entries(S[y]).filter(([k]) => !k.includes('@')).map(([k, h]) => ({ k, n: h.length })).sort((a, b) => b.n - a.n);
      const N = rows.length;
      rows.forEach((r, i) => {
        const a = acct[r.k]?.[y]; if (!a) return;
        const groups = [`Q${Math.min(4, 1 + Math.floor(4 * i / N))}`]; if (i === 0) groups.push('leader'); if (MAJORS.includes(r.k)) groups.push('majors');
        for (const gname of groups) { const key = `${p[0]}|${gname === 'Q1' ? 'Q1 top' : gname === 'Q4' ? 'Q4 laggards' : gname}`; const t = tot[key]; if (!t) continue;
          t.res += a.res; t.spr += a.spr; t.je += a.je; t.n++; }
      });
    }
  }
}
console.log(`share of technology points by source (model accounting, ${SEEDS} seeds per run, resEff ${EFF}${Object.keys(L).length > 1 ? ', levers ' + JSON.stringify(L) : ''})`);
console.log('period      group          research  spread  entries   points/country-year');
for (const p of PERIODS) for (const gname of GROUPS) { const t = tot[`${p[0]}|${gname}`]; const all = t.res + t.spr + t.je; if (!t.n) continue;
  console.log(`${p[0]}–${p[1]}  ${gname.padEnd(13)} ${(100 * t.res / all).toFixed(0).padStart(7)}% ${(100 * t.spr / all).toFixed(0).padStart(6)}% ${(100 * t.je / all).toFixed(0).padStart(7)}%   ${(all / t.n).toFixed(0).padStart(8)}`); }
