// THE LEVER SWEEP (BALANCE_FRAMEWORK §10.96): run the research model over a book's measured runs (their literacy / innovation paths and
// research-entry grants) under candidate lever settings, and score each on §10.96's targets:
//   · the leader's share of game era 4 at 1905 (aim ~50%) and of game era 5 at 1936 (aim somewhat under 50%; its anchor is 1940);
//   · the all-country median count at 1900 and 1936 (aim: vanilla's, printed from the vanilla runs' OBSERVED holdings);
//   · production techs whose half-majors year lands within ten years of the tree's narrative onset (onsets 1826–1926; aim ≥ today's).
// The book's own observed readings and the model's no-change reading are printed first, so a lever's effect is read against the model's
// own baseline (the model's bias cancels in the difference). ⚠ Inputs are fixed paths: literacy, universities and GDP do not answer back.
// usage: node tools/research_model/sweep.mjs --runs <dir,dir,…> --mod <emitted mod> --tree <tech_tree_options json> [--van <dir,dir,…>]
//        [--seeds 2] [--eff 0.95] --set "name:key=v,key=v" [--set …]
import fs from 'node:fs'; import path from 'node:path';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { simulate } from './lib_sim.mjs';
import { metricsAt, median, MAJORS } from './lib_metrics.mjs'; import { extractGrants } from './lib_grants.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MOD = opt('--mod', null); const tree = loadTree(MOD); const SEEDS = +opt('--seeds', 2); const EFF = +opt('--eff', 0.95);
const twin = JSON.parse(fs.readFileSync(opt('--tree'), 'utf8')); const OPT = twin.options.find(o => o.ships) || twin.options[0];
const ONSET = Object.fromEntries((OPT.techs || []).map(t => [t.id, t.onset]));
const PROD = Object.values(tree.techs).filter(t => t.category === 'production' && ONSET[t.id] >= 1826 && ONSET[t.id] <= 1926).map(t => t.id);
const sets = []; args.forEach((a, i) => { if (a === '--set') { const [name, kv] = args[i + 1].split(':'); const L = {};
  for (const p of (kv || '').split(',').filter(Boolean)) { const [k, v] = p.split('='); L[k] = isNaN(+v) ? v : +v; } sets.push({ name, L }); } });
if (!sets.length) sets.push({ name: 'book as is', L: {} });
const runs = opt('--runs').split(',').map(d => { const paths = loadPaths(d); return { d, paths, g: extractGrants(path.dirname(d), tree, paths, { modDir: MOD }).grants }; });
// the scored readings of one { year: { key: [held] } } map
const yearOf = (Y, y) => Y[y] ? y : Object.keys(Y).map(Number).filter(v => v <= y).sort((a, b) => b - a)[0];
function score(Y) {
  const at = y => metricsAt(tree, Y[yearOf(Y, y)]);
  const m1905 = at(1905), m1900 = at(1900), m1936 = at(1936);
  // half-majors year per production tech
  const ys = Object.keys(Y).map(Number).sort((a, b) => a - b); let on = 0, early = 0, late = 0, lags = [];
  for (const t of PROD) { let hy = null;
    for (const y of ys) { const maj = MAJORS.filter(m => Y[y][m]); if (maj.length < 2) continue; const n = maj.filter(m => Y[y][m].includes(t)).length; if (n >= maj.length / 2) { hy = y; break; } }
    const lag = (hy ?? 1946) - ONSET[t]; lags.push(lag); if (Math.abs(lag) <= 10) on++; else if (lag < -10) early++; else late++; }
  const lead = Y[yearOf(Y, 1936)][m1936.leader] || []; const catShare = c => { const ids = Object.values(tree.techs).filter(t => t.era === 5 && t.category === c).map(t => t.id); return ids.filter(t => lead.includes(t)).length / ids.length; };
  return { e4_1905: m1905.eraShare(4), e5_1936: m1936.eraShare(5), e5p: catShare('production'), e5m: catShare('military'), e5s: catShare('society'), med1900: m1900.median, med1936: m1936.median, max1936: m1936.max,
    maj1936: median(Object.values(m1936.majors)), maj1886: median(Object.values(at(1886).majors)), maj1906: median(Object.values(at(1906).majors)), onT: on, early, late, lag: median(lags) };
}
const agg = list => { const k = Object.keys(list[0]); return Object.fromEntries(k.map(x => [x, median(list.map(r => r[x]))])); };
const fmt = r => `leader e4@1905 ${(100 * r.e4_1905).toFixed(0)}%  e5@1936 ${(100 * r.e5_1936).toFixed(0)}% (p/m/s ${[r.e5p, r.e5m, r.e5s].map(x => (100 * x).toFixed(0)).join('/')}) | median 1900 ${r.med1900.toFixed(0)} 1936 ${r.med1936.toFixed(0)} | max 1936 ${r.max1936.toFixed(0)} majors' median 1886/1906/1936 ${r.maj1886.toFixed(0)}/${r.maj1906.toFixed(0)}/${r.maj1936.toFixed(0)} | onset on-target ${r.onT.toFixed(0)}/${PROD.length} (early ${r.early.toFixed(0)}, late ${r.late.toFixed(0)}, median lag ${r.lag.toFixed(0)} y)`;
const obsY = p => Object.fromEntries(p.years.map(y => [y, Object.fromEntries(Object.entries(p.at[y]).map(([k, v]) => [k, v.held]))]));
console.log(`book runs ${runs.length}, seeds ${SEEDS}, resEff ${EFF}; ${PROD.length} production techs with onsets 1826–1926`);
if (opt('--van', null)) { const V = opt('--van').split(',').map(d => score(obsY(loadPaths(d)))); console.log('VANILLA observed         ' + fmt(agg(V))); }
console.log('BOOK observed            ' + fmt(agg(runs.map(r => score(obsY(r.paths))))));
for (const s of sets) {
  const t0 = Date.now(); const res = [];
  for (const r of runs) for (let sd = 1; sd <= SEEDS; sd++) res.push(score(simulate(tree, r.paths, { resEff: EFF, ...s.L }, { seed: sd, grants: structuredClone(r.g) })));
  console.log(`${s.name.padEnd(24)} ${fmt(agg(res))}  [${((Date.now() - t0) / 1000).toFixed(0)} s]`);
}
