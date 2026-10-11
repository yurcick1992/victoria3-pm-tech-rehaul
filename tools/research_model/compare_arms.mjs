// §10.96'S TARGETS, OBSERVED, ACROSS ARMS (2026-10-11) — per arm the median over its runs of: world GDP every decade ÷ the reference arm's
// per-run median (Σ of every country record's gdp, as displayed); the leader's share of game era 3 at 1875, era 4 at 1905, era 5 at 1936 (with
// its p/m/s split); the tech majors' median count at 1886 / 1906 / 1936; the all-country median at 1900 / 1936; the most held at 1936; and the
// production techs whose half-majors year lands within ten years of their narrative onset. A run may be STITCHED: parent and continuation
// folders joined by '+' (run_schedule continue_save) — the later folder's years win.
// usage: node tools/research_model/compare_arms.mjs --ref vanilla --tree <tech_tree_options json> [--mod <emitted mod>]
//          label=<summaries dir>[+<dir>],<summaries dir>…  [label=…]
import fs from 'node:fs';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { metricsAt, median, MAJORS } from './lib_metrics.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const tree = loadTree(opt('--mod', null)); const REF = opt('--ref', null);
const twin = JSON.parse(fs.readFileSync(opt('--tree'), 'utf8')); const OPT = twin.options.find(o => o.ships) || twin.options[0];
const ONSET = Object.fromEntries((OPT.techs || []).map(t => [t.id, t.onset]));
const PROD = Object.values(tree.techs).filter(t => t.category === 'production' && ONSET[t.id] >= 1826 && ONSET[t.id] <= 1926).map(t => t.id);
const DEC = [1846, 1856, 1866, 1876, 1886, 1896, 1906, 1916, 1926, 1936];
const arms = args.filter(a => /^[^-][^=]*=/.test(a)).map(a => { const [label, list] = a.split(/=(.*)/s); return { label, dirs: list.split(',') }; });
const yearOf = (Y, y) => Y[y] ? y : Object.keys(Y).map(Number).filter(v => v <= y).sort((a, b) => b - a)[0];
function read(dir) {
  const p = loadPaths(dir); const Y = {}; const gdp = {};
  for (const y of p.years) { Y[y] = {}; let g = 0; for (const [k, c] of Object.entries(p.at[y])) { Y[y][k] = c.held; g += c.gdp || 0; } gdp[y] = g; }
  const at = y => { const yy = yearOf(Y, y); return yy ? metricsAt(tree, Y[yy]) : null; };
  const m1936 = at(1936), lead = m1936 ? Y[yearOf(Y, 1936)][m1936.leader] : [];
  const cat = c => { const ids = Object.values(tree.techs).filter(t => t.era === 5 && t.category === c).map(t => t.id); return ids.filter(t => lead.includes(t)).length / ids.length; };
  const ys = Object.keys(Y).map(Number).sort((a, b) => a - b); let on = 0;
  for (const t of PROD) { let hy = null; for (const y of ys) { const maj = MAJORS.filter(m => Y[y][m]); if (maj.length < 2) continue; if (maj.filter(m => Y[y][m].includes(t)).length >= maj.length / 2) { hy = y; break; } }
    if (Math.abs((hy ?? 1946) - ONSET[t]) <= 10) on++; }
  return { gdp, e3: at(1875)?.eraShare(3), e4: at(1905)?.eraShare(4), e5: m1936?.eraShare(5), e5p: cat('production'), e5m: cat('military'), e5s: cat('society'),
    maj1886: median(Object.values(at(1886)?.majors || {})), maj1906: median(Object.values(at(1906)?.majors || {})), maj1936: median(Object.values(m1936?.majors || {})),
    med1900: at(1900)?.median, med1936: m1936?.median, max1936: m1936?.max, onT: on, last: ys.at(-1) };
}
const R = Object.fromEntries(arms.map(a => [a.label, a.dirs.map(read)]));
const refG = Object.fromEntries(DEC.map(y => [y, median((R[REF] || []).map(r => r.gdp[y]).filter(Number.isFinite))]));
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '—', n0 = x => Number.isFinite(x) ? x.toFixed(0) : '—';
console.log(`world GDP ÷ ${REF}'s per-run median (median over runs; runs per arm in brackets)`);
console.log('arm'.padEnd(14) + DEC.map(y => String(y).padStart(7)).join(''));
for (const [lab, rs] of Object.entries(R)) console.log(`${lab} (${rs.length})`.padEnd(14) + DEC.map(y => { const v = median(rs.map(r => r.gdp[y] / refG[y]).filter(Number.isFinite)); return (Number.isFinite(v) ? v.toFixed(2) : '—').padStart(7); }).join(''));
console.log('\narm            leader e3@1875 e4@1905 e5@1936 (p/m/s)   majors 1886/1906/1936   median 1900/1936   max 1936   onsets on target');
for (const [lab, rs] of Object.entries(R)) { const m = k => median(rs.map(r => r[k]).filter(Number.isFinite));
  console.log(`${lab.padEnd(14)} ${pc(m('e3')).padStart(6)} ${pc(m('e4')).padStart(7)} ${pc(m('e5')).padStart(7)} (${pc(m('e5p'))}/${pc(m('e5m'))}/${pc(m('e5s'))})   ${n0(m('maj1886'))}/${n0(m('maj1906'))}/${n0(m('maj1936'))}`.padEnd(78) + `   ${n0(m('med1900'))}/${n0(m('med1936'))}`.padEnd(19) + `${n0(m('max1936'))}`.padStart(8) + `   ${n0(m('onT'))}/${PROD.length}`); }
