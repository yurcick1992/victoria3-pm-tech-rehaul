// WHERE TECHNOLOGY POINTS CAME FROM, FROM THE RUNS THEMSELVES (2026-10-12, the user: "for all three trees and country categories based on their
// status in 1935, tell which share of points came from what source, in the whole century … base the calculation on main factors").
// Unlike sources.mjs (the model's SIMULATED accounting), this reads what each run recorded, save by save (v18 save summaries + the debug log):
//   · RESEARCH: min(innovation, cap) a week (F223's flow_check: obs ÷ formula 1.000), all of it on the tree of the technology the country was
//     researching at the save (a point sample of a weekly choice; unbiased over many country-saves, noisy for one country);
//   · SPREAD: per tree with a technology spreading at the save, (25 + 75 × literacy + 0.2 × unspent innovation) × (1 + rank and law multipliers)
//     a week — F223's measured formula (the books leave the spread constants at vanilla's); the U(0.5, 1.5) draw averages to 1;
//   · ENTRIES: every research-entry stage completed (PMR_JE lines, lib_grants: grant_fraction × the era base cost), on the technology's own tree.
//   Each save stands for the weeks until the next save (yearly or quarterly saves alike; a gap is capped at 1.25 years).
// GROSS inflows: what each source added, including any part that overshot a technology's remaining cost (lost in game). Not counted: the 1836
// starting technologies, event grants, research-speed modifiers (IG traits, companies, tree-wide event bonuses).
// GROUPS by each run's standing in `--group-year` (default 1935): the overall tech LEADER (most technologies held); the next TEN by technologies
// held among countries with GDP ≥ £50M; the next TEN by GDP not already in those; EVERYONE ELSE (countries gone by then included). A country's
// earlier tags count with its later form (PRU / NGF → GER, NET → UNL) where that form stands in the group year.
// usage: node tools/research_model/points_by_source.mjs --arm <label>=<session>[:<setup>] | <label>=dir:<summaries dir> [--arm …]
//        --mod <emitted mod for the tree> [--from 1836] [--to 1936] [--group-year 1935]
//   `dir:` = a bare folder of save summaries with no run around it (no debug log ⇒ no entries; for vanilla, e.g. tools/testbed/saves_debut/summaries_v18).
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { extractGrants } from './lib_grants.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'testbed', 'sessions');
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const arms = args.flatMap((a, i) => a === '--arm' ? [args[i + 1]] : []); const MOD = opt('--mod', null);
const FROM = +opt('--from', 1836), TO = +opt('--to', 1936), GY = +opt('--group-year', 1935);
if (!arms.length || !MOD) { console.error('usage: --arm <label>=<session>[:<setup>] | <label>=dir:<summaries dir> … --mod <emitted mod>'); process.exit(1); }
const tree = loadTree(MOD); const cats = tree.cats;
const RANK = { recognized: 0, colonial: 0, unrecognized: -0.234, decentralized: -0.234, company: 0 };   // F223 / lib_sim DEFAULT_LEVERS
const LAWS = { law_outlawed_dissent: -0.15, law_censorship: -0.10, law_protected_speech: 0.25, law_isolationism: -0.15, law_canton_system: -0.10, law_sakoku: -0.20 };
const FAM = { PRU: ['GER', 'NGF'], NGF: ['GER'], NET: ['UNL'] };
const GROUPS = ['leader', 'tech runners-up (10, GDP ≥ £50M)', 'GDP runners-up (next 10)', 'everyone else'];
const catOf = id => tree.techs[id]?.category;
const dnum = d => { const [y, m, dd] = String(d).split('.').map(Number); return y + ((m || 1) - 1) / 12 + ((dd || 1) - 1) / 365; };
// every summary, sorted by DATE (file order is not date order in an archive read from a rotating slot ring), one per date
function samples(sd) {
  const out = new Map();
  for (const f of fs.readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f)))); } catch { continue; }
    const d = j.provenance?.date; if (!d || out.has(d)) continue; out.set(d, { t: dnum(d), y: +String(d).split('.')[0], j });
  }
  const s = [...out.values()].sort((a, b) => a.t - b.t);
  s.forEach((x, i) => { const nx = s[i + 1]; x.w = 52 * Math.min(1.25, nx ? nx.t - x.t : (i ? x.t - s[i - 1].t : 1)); });
  return s;
}
for (const spec of arms) {
  const [label, rest] = spec.split(/=(.*)/s);
  let runs;
  if (rest.startsWith('dir:')) { const d = path.resolve(rest.slice(4)); runs = [{ name: path.basename(path.dirname(d)) + '/' + path.basename(d), sd: d, runDir: null }]; }
  else { const [sess, setup] = rest.split(':'); runs = fs.readdirSync(path.join(ROOT, sess)).filter(d => /^run\d/.test(d) && (!setup || d.endsWith('_' + setup))).sort()
    .map(rd => ({ name: rd, runDir: path.join(ROOT, sess, rd), sd: path.join(ROOT, sess, rd, 'save_summaries') })); }
  const T = {}; for (const g of GROUPS) { T[g] = {}; for (const c of cats) T[g][c] = { res: 0, spr: 0, je: 0 }; T[g].n = new Set(); }
  const notes = [];
  for (const r of runs) {
    const S = samples(r.sd); if (!S.length) { notes.push(`${r.name}: no summaries`); continue; }
    if (!('max_innovation' in (S[0].j.countries.GBR || {}))) { notes.push(`${r.name}: summaries before v18 (no innovation cap) — skipped`); continue; }
    const gs = S.find(x => x.y === GY) || S.filter(x => x.y <= GY).at(-1);
    const gc = gs.j.countries;
    const main = Object.entries(gc).filter(([k]) => !k.includes('@'));
    const nTech = c => Array.isArray(c.technologies_held) ? c.technologies_held.length : 0;
    const byTech = main.slice().sort((a, b) => nTech(b[1]) - nTech(a[1]));
    const leader = byTech[0][0];
    const techRun = byTech.slice(1).filter(([, c]) => (c.gdp || 0) >= 5e7).slice(0, 10).map(([k]) => k);
    const gdpRun = main.filter(([k]) => k !== leader && !techRun.includes(k)).sort((a, b) => (b[1].gdp || 0) - (a[1].gdp || 0)).slice(0, 10).map(([k]) => k);
    const inG = k => !!gc[k];
    const resolve = k => { if (inG(k)) return k; for (const f of FAM[k] || []) if (inG(f)) return f; return k; };
    const groupOf = k => { const r_ = k.includes('@') ? '#' : resolve(k); return r_ === leader ? GROUPS[0] : techRun.includes(r_) ? GROUPS[1] : gdpRun.includes(r_) ? GROUPS[2] : GROUPS[3]; };
    const inWin = S.filter(x => x.t >= FROM && x.t < TO);
    notes.push(`${r.name}: ${inWin.length} saves ${inWin[0]?.j.provenance.date}–${inWin.at(-1)?.j.provenance.date}; standing at ${gs.j.provenance.date}: leader ${leader} (${nTech(gc[leader])} techs) · tech runners-up ${techRun.join(' ')} · GDP runners-up ${gdpRun.join(' ')}`);
    for (const x of inWin) {
      for (const [k, c] of Object.entries(x.j.countries)) {
        const g = T[groupOf(k)]; g.n.add(`${r.name}|${resolve(k)}`);
        const innov = c.innovation ?? 0, cap = c.max_innovation ?? innov;
        const rc = c.researching && catOf(c.researching); if (rc) g[rc].res += x.w * Math.min(innov, cap);
        const lit = c.literacy ?? 0;
        const mult = 1 + (RANK[c.country_type] ?? 0) + (c.laws || []).reduce((a, l) => a + (LAWS[l] || 0), 0);
        const sp = x.w * (25 + 75 * lit + 0.2 * Math.max(0, innov - cap)) * Math.max(0, mult);
        const seen = new Set(); for (const id of c.spreading || []) { const sc = catOf(id); if (sc && !seen.has(sc)) { seen.add(sc); g[sc].spr += sp; } }
      }
    }
    if (r.runDir && fs.existsSync(path.join(r.runDir, 'logs_live/debug.log'))) {
      const paths = loadPaths(r.sd);
      const { grants, stats } = extractGrants(r.runDir, tree, paths, { modDir: MOD });
      if (stats.unmapped) notes.push(`${r.name}: ${stats.unmapped} of ${stats.completions} entry completions not mapped to a country key (display names), left out`);
      for (const [k, list] of Object.entries(grants)) for (const gr of list) { if (gr.y < FROM || gr.y >= TO) continue; const c = catOf(gr.tech); if (c) T[groupOf(k)][c].je += gr.pts; }
    } else notes.push(`${r.name}: no run log — no entries counted`);
  }
  console.log(`\n=== ${label} (${rest}, ${runs.length} run(s), ${FROM}–${TO}, groups by ${GY} standing; gross points by source, pooled over runs) ===`);
  for (const n of notes) console.log('  ' + n);
  console.log('  group                                tree         research  spread  entries   points (M)  per country-run (k)');
  for (const g of GROUPS) {
    const nC = T[g].n.size || 1; const all = { res: 0, spr: 0, je: 0 };
    for (const c of [...cats, 'all']) {
      const t = c === 'all' ? all : T[g][c]; if (c !== 'all') { all.res += t.res; all.spr += t.spr; all.je += t.je; }
      const s = t.res + t.spr + t.je; if (!s) continue;
      console.log(`  ${(c === cats[0] ? g : '').padEnd(36)} ${c.padEnd(11)} ${(100 * t.res / s).toFixed(0).padStart(7)}% ${(100 * t.spr / s).toFixed(0).padStart(6)}% ${(100 * t.je / s).toFixed(0).padStart(7)}%   ${(s / 1e6).toFixed(1).padStart(9)}   ${(s / nC / 1e3).toFixed(0).padStart(8)}`);
    }
  }
}
