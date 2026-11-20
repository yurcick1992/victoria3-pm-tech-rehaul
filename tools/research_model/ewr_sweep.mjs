// THE ENTRY-WEIGHT RULE IN THE RESEARCH MODEL (BALANCE_FRAMEWORK §10.119 item 3; the pre-1.2 probe 6, 2026-11-21). Runs lib_sim over a
// book's measured runs (their literacy and innovation paths and research-entry grants) with candidate figures of the rule and prints, at
// 1906 and 1936, the majors' median technologies held by tree, the leader's share of tech era 5 by tree, and the military technologies of
// tech era 5 any major holds — against the book's own observed holdings and, with --van, vanilla's.
// The pick exponent is probe 4's measured one (--k, default 3.73: F275's companion reading in session 20261121_000535), not F223's 4.
// The rule's kinds are read off the built mod's research bars, as emit_tech_finish.mjs reads them.
// usage: node tools/research_model/ewr_sweep.mjs --runs <summaries dir,…> --mod <built mod> [--van <summaries dir,…>] [--seeds 2]
//        [--eff 0.95] [--k 3.73] --set "name:lowered=0.8,advancing=0.1" [--set …]   (a set with no figures = the rule off)
import fs from 'node:fs'; import path from 'node:path';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { simulate } from './lib_sim.mjs';
import { MAJORS, median } from './lib_metrics.mjs'; import { extractGrants } from './lib_grants.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MOD = opt('--mod'); const tree = loadTree(MOD); const SEEDS = +opt('--seeds', 2), EFF = +opt('--eff', 0.95), K = +opt('--k', 3.73);
// the rule's kinds, off the built bars and entries
const jt = fs.readFileSync(path.join(MOD, 'common/journal_entries/zzz_pm_rehaul_research.txt'), 'utf8');
const bt = fs.readFileSync(path.join(MOD, 'common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt'), 'utf8');
const barBody = {}; { const b = [...bt.matchAll(/^(pmr_bar_[a-z0-9_]+) = \{/gm)]; b.forEach((m, i) => { barBody[m[1]] = bt.slice(m.index, i + 1 < b.length ? b[i + 1].index : bt.length); }); }
const kinds = {}; { const j = [...jt.matchAll(/^(je_pmr_[a-z0-9_]+) = \{/gm)];
  j.forEach((m, i) => { const body = jt.slice(m.index, i + 1 < j.length ? j[i + 1].index : jt.length);
    const cr = body.match(/can_research\s*=\s*([a-z_0-9-]+)/), bar = body.match(/scripted_progress_bar\s*=\s*([a-z_0-9]+)/); if (!cr || !bar) return;
    const s = barBody[bar[1]] || ''; const lit = s.match(/literacy_rate >= ([0-9.]+)/);
    kinds[cr[1]] = { kind: /pmr_wargate_/.test(s) ? 'frontline' : lit ? 'literacy' : 'naval', lit: lit ? +lit[1] : null }; }); }
const nk = k => Object.values(kinds).filter(e => e.kind === k).length;
console.log(`rule kinds off ${MOD}: ${Object.keys(kinds).length} technologies with an entry - literacy ${nk('literacy')}, naval ${nk('naval')}, frontline ${nk('frontline')}; pick exponent ${K}, resEff ${EFF}, seeds ${SEEDS}`);
const sets = []; args.forEach((a, i) => { if (a === '--set') { const [name, kv] = args[i + 1].split(':'); const L = {};
  for (const p of (kv || '').split(',').filter(Boolean)) { const [k, v] = p.split('='); L[k] = +v; } sets.push({ name, L }); } });
const runs = opt('--runs').split(',').map(d => { const paths = loadPaths(d); return { d, paths, g: extractGrants(path.dirname(d), tree, paths, { modDir: MOD }).grants }; });
const T = tree.techs; const TREES = ['production', 'military', 'society'];
const e5 = c => Object.values(T).filter(t => t.era === 5 && t.category === c).map(t => t.id);
const yearOf = (Y, y) => Y[y] ? y : Object.keys(Y).map(Number).filter(v => v <= y).sort((a, b) => b - a)[0];
function score(Y) {
  const r = {};
  for (const y of [1906, 1936]) {
    const H = Y[yearOf(Y, y)]; const maj = MAJORS.filter(m => H[m]);
    for (const c of TREES) r[`${c[0]}${y}`] = median(maj.map(m => H[m].filter(t => T[t]?.category === c).length));
    if (y === 1936) {
      let lead = null, best = -1; for (const [k, h] of Object.entries(H)) if (h.length > best) { best = h.length; lead = k; }
      for (const c of TREES) { const ids = e5(c); r[`e5${c[0]}`] = ids.filter(t => H[lead].includes(t)).length / ids.length; }
      r.milE5any = new Set(maj.flatMap(m => H[m].filter(t => T[t]?.category === 'military' && T[t].era === 5))).size;
    }
  }
  return r;
}
const agg = list => Object.fromEntries(Object.keys(list[0]).map(k => [k, median(list.map(x => x[k]))]));
const fmt = r => `majors 1906 p/m/s ${r.p1906.toFixed(0)}/${r.m1906.toFixed(0)}/${r.s1906.toFixed(0)} · 1936 ${r.p1936.toFixed(0)}/${r.m1936.toFixed(0)}/${r.s1936.toFixed(0)} | leader e5@1936 p/m/s ${[r.e5p, r.e5m, r.e5s].map(x => (100 * x).toFixed(0)).join('/')}% | military e5 held by any major ${r.milE5any.toFixed(1)}`;
const obsY = p => Object.fromEntries(p.years.map(y => [y, Object.fromEntries(Object.entries(p.at[y]).map(([k, v]) => [k, v.held]))]));
if (opt('--van', null)) console.log('VANILLA observed      ' + fmt(agg(opt('--van').split(',').map(d => score(obsY(loadPaths(d)))))));
console.log('BOOK observed         ' + fmt(agg(runs.map(r => score(obsY(r.paths))))));
for (const s of sets) {
  // milExempt=1: every MILITARY-tree technology keeps its full weight (a variant the user has not ruled: the ruled scope lowers naval and
  // the military industry entries)
  const K2 = s.L.milExempt ? Object.fromEntries(Object.entries(kinds).map(([id, e]) => [id, T[id]?.category === 'military' ? { ...e, kind: 'frontline' } : e])) : kinds;
  const L = { resEff: EFF, aiK: K }; if (s.L.lowered != null) L.ewr = { lowered: s.L.lowered, advancing: s.L.advancing ?? s.L.lowered, kinds: K2, horizon: s.L.horizon ?? 3 };
  const res = []; const t0 = Date.now();
  for (const r of runs) for (let sd = 1; sd <= SEEDS; sd++) res.push(score(simulate(tree, r.paths, L, { seed: sd, grants: structuredClone(r.g) })));
  console.log(`${s.name.padEnd(21)} ${fmt(agg(res))}  [${((Date.now() - t0) / 1000).toFixed(0)} s]`);
}
