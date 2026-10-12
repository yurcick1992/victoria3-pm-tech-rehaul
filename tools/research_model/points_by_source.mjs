// WHERE TECHNOLOGY POINTS CAME FROM, FROM THE RUNS THEMSELVES (2026-10-12, the user: "for all three trees and country categories based on their
// status in 1935, tell which share of points came from what source, in the whole century … base the calculation on main factors").
// Unlike sources.mjs (the model's SIMULATED accounting), this reads what each run recorded, year by year (v18 save summaries + the debug log):
//   · RESEARCH: 52 × min(innovation, cap) a year (F223's flow_check: obs ÷ formula 1.000), all of it on the tree of the technology the country
//     was researching at the year's first summary (a point sample of a weekly choice; unbiased over many country-years, noisy for one country);
//   · SPREAD: per tree with a technology spreading at the sample, 52 × (25 + 75 × literacy + 0.2 × unspent innovation) × (1 + rank and law
//     multipliers) — F223's measured formula (the book leaves the spread constants at vanilla's); the U(0.5, 1.5) draw averages to 1;
//   · ENTRIES: every research-entry stage completed (PMR_JE lines, lib_grants: the stage's grant = grant_fraction × the era base cost), on the
//     technology's own tree.
// GROSS inflows: what each source added, including any part that overshot a technology's remaining cost (lost in game). Not counted: the 1836
// starting technologies, event grants, research-speed modifiers (IG traits, companies, tree-wide event bonuses).
// GROUPS by each run's 1935 summary: the overall tech LEADER (most technologies held); the next TEN by technologies held among countries with
// GDP ≥ £50M; the next TEN by GDP not already in those; EVERYONE ELSE (countries gone by 1935 included). A country's earlier tags count with
// its 1935 form (PRU / NGF → GER, NET → UNL) where that form stands in 1935.
// usage: node tools/research_model/points_by_source.mjs --arm <label>=<session>[:<setup>] [--arm …] --mod <emitted mod for the tree> [--from 1836] [--to 1936]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { loadTree } from './lib_tree.mjs'; import { loadPaths } from './lib_paths.mjs'; import { extractGrants } from './lib_grants.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'testbed', 'sessions');
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const arms = args.flatMap((a, i) => a === '--arm' ? [args[i + 1]] : []); const MOD = opt('--mod', null);
const FROM = +opt('--from', 1836), TO = +opt('--to', 1936);
if (!arms.length || !MOD) { console.error('usage: --arm <label>=<session>[:<setup>] … --mod <emitted mod>'); process.exit(1); }
const tree = loadTree(MOD); const cats = tree.cats;
const RANK = { recognized: 0, colonial: 0, unrecognized: -0.234, decentralized: -0.234, company: 0 };   // F223 / lib_sim DEFAULT_LEVERS
const LAWS = { law_outlawed_dissent: -0.15, law_censorship: -0.10, law_protected_speech: 0.25, law_isolationism: -0.15, law_canton_system: -0.10, law_sakoku: -0.20 };
const FAM = { PRU: ['GER', 'NGF'], NGF: ['GER'], NET: ['UNL'] };
const GROUPS = ['leader', 'tech runners-up (10, GDP ≥ £50M)', 'GDP runners-up (next 10)', 'everyone else'];
const catOf = id => tree.techs[id]?.category;
function yearly(sd) {
  const out = {};
  for (const f of fs.readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f)))); } catch { continue; }
    const y = +String(j.provenance?.date ?? '').split('.')[0]; if (!y || out[y]) continue; out[y] = j;
  }
  return out;
}
for (const spec of arms) {
  const [label, rest] = spec.split(/=(.*)/s); const [sess, setup] = rest.split(':');
  const runs = fs.readdirSync(path.join(ROOT, sess)).filter(d => /^run\d/.test(d) && (!setup || d.endsWith('_' + setup))).sort();
  const T = {}; for (const g of GROUPS) { T[g] = {}; for (const c of cats) T[g][c] = { res: 0, spr: 0, je: 0 }; T[g].n = new Set(); }
  const notes = [];
  for (const rd of runs) {
    const runDir = path.join(ROOT, sess, rd), sd = path.join(runDir, 'save_summaries');
    const Y = yearly(sd); const ys = Object.keys(Y).map(Number).sort((a, b) => a - b);
    const y35 = Y[1935] || Y[ys.filter(y => y <= 1935).at(-1)];
    if (!y35) { notes.push(`${rd}: no 1935 summary`); continue; }
    if (!('max_innovation' in (Y[ys[0]].countries.GBR || {}))) { notes.push(`${rd}: summaries before v18 (no innovation cap) — skipped`); continue; }
    const main = Object.entries(y35.countries).filter(([k]) => !k.includes('@'));
    const nTech = c => Array.isArray(c.technologies_held) ? c.technologies_held.length : 0;
    const byTech = main.slice().sort((a, b) => nTech(b[1]) - nTech(a[1]));
    const leader = byTech[0][0];
    const techRun = byTech.slice(1).filter(([, c]) => (c.gdp || 0) >= 5e7).slice(0, 10).map(([k]) => k);
    const gdpRun = main.filter(([k]) => k !== leader && !techRun.includes(k)).sort((a, b) => (b[1].gdp || 0) - (a[1].gdp || 0)).slice(0, 10).map(([k]) => k);
    const in35 = k => !!y35.countries[k];
    const resolve = k => { if (in35(k)) return k; for (const f of FAM[k] || []) if (in35(f)) return f; return k; };
    const groupOf = k => { const r = resolve(k.split('@')[0] === k ? k : '#'); return r === leader ? GROUPS[0] : techRun.includes(r) ? GROUPS[1] : gdpRun.includes(r) ? GROUPS[2] : GROUPS[3]; };
    notes.push(`${rd}: leader ${leader} (${nTech(y35.countries[leader])} techs) · tech runners-up ${techRun.join(' ')} · GDP runners-up ${gdpRun.join(' ')}`);
    for (const y of ys) {
      if (y < FROM || y >= TO) continue; const j = Y[y];
      for (const [k, c] of Object.entries(j.countries)) {
        const g = T[groupOf(k)]; g.n.add(`${rd}|${resolve(k)}`);
        const innov = c.innovation ?? 0, cap = c.max_innovation ?? innov;
        const rc = c.researching && catOf(c.researching); if (rc) g[rc].res += 52 * Math.min(innov, cap);
        const lit = c.literacy ?? 0;
        const mult = 1 + (RANK[c.country_type] ?? 0) + (c.laws || []).reduce((a, l) => a + (LAWS[l] || 0), 0);
        const sp = 52 * (25 + 75 * lit + 0.2 * Math.max(0, innov - cap)) * Math.max(0, mult);
        const seen = new Set(); for (const id of c.spreading || []) { const sc = catOf(id); if (sc && !seen.has(sc)) { seen.add(sc); g[sc].spr += sp; } }
      }
    }
    const paths = loadPaths(sd);
    const { grants, stats } = extractGrants(runDir, tree, paths, { modDir: MOD });
    if (stats.unmapped) notes.push(`${rd}: ${stats.unmapped} of ${stats.completions} entry completions not mapped to a country key (display names), left out`);
    for (const [k, list] of Object.entries(grants)) for (const gr of list) { if (gr.y < FROM || gr.y >= TO) continue; const c = catOf(gr.tech); if (c) T[groupOf(k)][c].je += gr.pts; }
  }
  console.log(`\n=== ${label} (${sess}${setup ? ':' + setup : ''}, ${runs.length} run(s), ${FROM}–${TO}; gross points by source, pooled over runs) ===`);
  for (const n of notes) console.log('  ' + n);
  console.log('  group                                tree         research  spread  entries   points (M)  per country-run (k)');
  for (const g of GROUPS) {
    const nC = T[g].n.size || 1; let all = { res: 0, spr: 0, je: 0 };
    for (const c of [...cats, 'all']) {
      const t = c === 'all' ? all : T[g][c]; if (c !== 'all') { all.res += t.res; all.spr += t.spr; all.je += t.je; }
      const s = t.res + t.spr + t.je; if (!s) continue;
      console.log(`  ${(c === cats[0] ? g : '').padEnd(36)} ${c.padEnd(11)} ${(100 * t.res / s).toFixed(0).padStart(7)}% ${(100 * t.spr / s).toFixed(0).padStart(6)}% ${(100 * t.je / s).toFixed(0).padStart(7)}%   ${(s / 1e6).toFixed(1).padStart(9)}   ${(s / nC / 1e3).toFixed(0).padStart(8)}`);
    }
  }
}
