// WHO GETS WHAT TECHNOLOGY, AND WHEN (BALANCE_FRAMEWORK §10.96, 2026-10-11) — observed, per arm, per country GROUP: the leader (most held
// that year), the tech majors (lib_metrics MAJORS present), and the quarters by technologies held of every main record that is not
// DECENTRALIZED (those hold no technology and research nothing: Q1 top … Q4 laggards; main
// records only). Per decade: median technologies held; median share held of game eras 2–5; and the YEAR a group's median member first holds
// half of game era 3 / 4 / 5. With --je: the share of the group's acquisitions in the decade that had at least one research-entry stage
// (lib_grants, from each run's debug.log). Medians over runs. A run may be STITCHED (parent+continuation summaries joined by '+').
// usage: node tools/research_model/tech_by_group.mjs [--mod <emitted mod>] [--je] label=<runDir>[+<runDir>],… [label=…]
//   (a runDir is a run folder; its save_summaries are read, and with --je its logs_live/debug.log)
import path from 'node:path';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { median, MAJORS } from './lib_metrics.mjs';
import { extractGrants } from './lib_grants.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MOD = opt('--mod', null); const tree = loadTree(MOD); const JE = args.includes('--je');
const arms = args.filter(a => /^[^-][^=]*=/.test(a)).map(a => { const [label, list] = a.split(/=(.*)/s); return { label, runs: list.split(',') }; });
const DEC = [1846, 1856, 1866, 1876, 1886, 1896, 1906, 1916, 1926, 1936];
const GROUPS = ['leader', 'majors', 'Q1 top', 'Q2', 'Q3', 'Q4 laggards'];
const eraIds = e => new Set(Object.values(tree.techs).filter(t => t.era === e).map(t => t.id));
const ERA = { 2: eraIds(2), 3: eraIds(3), 4: eraIds(4), 5: eraIds(5) };
const share = (h, e) => h.filter(t => ERA[e].has(t)).length / ERA[e].size;
const yearOf = (p, y) => p.at[y] ? y : p.years.filter(v => v <= y).sort((a, b) => b - a)[0];
function groupsAt(p, y) {
  const yy = yearOf(p, y); if (!yy) return null;
  const rows = Object.entries(p.at[yy]).filter(([k, c]) => !k.includes('@') && c.ctype !== 'decentralized').map(([k, c]) => ({ k, h: c.held })).sort((a, b) => b.h.length - a.h.length);
  const N = rows.length, g = Object.fromEntries(GROUPS.map(x => [x, []]));
  rows.forEach((r, i) => { g[['Q1 top', 'Q2', 'Q3', 'Q4 laggards'][Math.min(3, Math.floor(4 * i / N))]].push(r); if (i === 0) g.leader.push(r); if (MAJORS.includes(r.k)) g.majors.push(r); });
  return g;
}
for (const arm of arms) {
  const per = [];   // per run: { [group]: { [dec]: {n, e2..e5, je} }, reach: { [group]: {3:y,4:y,5:y} } }
  for (const run of arm.runs) {
    const dirs = run.split('+'); const p = loadPaths(dirs.map(d => path.join(d, 'save_summaries')));
    let jeSet = null;
    if (JE) { jeSet = new Set(); for (const d of dirs) { const g = extractGrants(d, tree, loadPaths(path.join(d, 'save_summaries')), { modDir: MOD }).grants; for (const [k, l] of Object.entries(g)) for (const x of l) jeSet.add(k + '|' + x.tech); } }
    const R = { dec: {}, reach: {} };
    for (const gname of GROUPS) { R.dec[gname] = {}; R.reach[gname] = {}; }
    for (const y of DEC) { const G = groupsAt(p, y); if (!G) continue;
      const prev = groupsAt(p, y - 10);
      for (const gname of GROUPS) { const rs = G[gname]; if (!rs.length) continue;
        const o = { n: median(rs.map(r => r.h.length)) }; for (const e of [2, 3, 4, 5]) o['e' + e] = median(rs.map(r => share(r.h, e)));
        if (jeSet && prev) { let acq = 0, je = 0; const pk = Object.fromEntries(Object.entries(p.at[yearOf(p, y - 10)] || {}).map(([k, c]) => [k, new Set(c.held)]));
          for (const r of rs) { const before = pk[r.k]; if (!before) continue; for (const t of r.h) if (!before.has(t)) { acq++; if (jeSet.has(r.k + '|' + t)) je++; } }
          o.je = acq ? je / acq : NaN; }
        R.dec[gname][y] = o; } }
    for (const gname of GROUPS) for (const e of [3, 4, 5]) for (const y of p.years) { const G = groupsAt(p, y); const rs = G?.[gname]; if (!rs?.length) continue;
      if (median(rs.map(r => share(r.h, e))) >= 0.5) { R.reach[gname][e] = y; break; } }
    per.push(R);
  }
  const pc = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '—';
  console.log(`\n=== ${arm.label} (${arm.runs.length} run(s))`);
  console.log('group         year at which the median member first holds HALF of game era 3 / 4 / 5');
  for (const gname of GROUPS) console.log(`${gname.padEnd(13)} ` + [3, 4, 5].map(e => { const v = per.map(R => R.reach[gname][e]).filter(Number.isFinite); return v.length === per.length ? String(median(v)) : (v.length ? `${median(v)} (${v.length}/${per.length})` : 'not by 1936'); }).join(' / '));
  for (const gname of GROUPS) {
    console.log(`${gname}: ` + DEC.map(y => { const xs = per.map(R => R.dec[gname][y]).filter(Boolean); if (!xs.length) return null; const m = k => median(xs.map(x => x[k]).filter(Number.isFinite));
      return `${y} ${m('n').toFixed(0)} [e3 ${pc(m('e3'))} e4 ${pc(m('e4'))} e5 ${pc(m('e5'))}]${JE && Number.isFinite(m('je')) ? ' je ' + pc(m('je')) : ''}`; }).filter(Boolean).join(' · '));
  }
}
