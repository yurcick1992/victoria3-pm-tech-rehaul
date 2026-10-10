// WHICH TECHNOLOGY SPREADS? (BALANCE_FRAMEWORK §10.96) — for every NEW spreading pick between consecutive v18 summaries, the eligible set at B
// (same tree, researchable by the country: prerequisites held, not held; held by at least one other country present) and where the pick sits in
// it: its rank by the number of countries holding it, by era, by ai_weight, and whether it is the country's researched tech. A uniform pick
// gives a mean percentile of 0.5 on every axis.
// usage: node tools/research_model/spread_pick.mjs <dir of summaries .json.gz> [--mod <emitted mod>]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadTree, canResearch } from './lib_tree.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DIR = args[0]; const tree = loadTree(opt('--mod', null));
const day = d => { const [y, m, dd] = d.split('.').map(Number); return Date.UTC(y, m - 1, dd) / 864e5; };
const sums = fs.readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort().map(f => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f)))));
for (const s of sums) s.date = s.provenance.date; sums.sort((a, b) => day(a.date) - day(b.date));
const pct = (v, arr) => { const lo = arr.filter(x => x < v).length, eq = arr.filter(x => x === v).length; return (lo + eq / 2) / arr.length; };
const acc = { holders: [], era: [], ai: [], minEra: 0, n: 0, outside: 0, outsideEx: [], sizes: [], frontierShare: [] };
for (let i = 1; i < sums.length; i++) {
  const A = sums[i - 1], B = sums[i];
  const holders = {}; for (const c of Object.values(B.countries)) for (const t of c.technologies_held) holders[t] = (holders[t] || 0) + 1;
  for (const [k, b] of Object.entries(B.countries)) {
    const a = A.countries[k]; if (!a) continue; const held = new Set(b.technologies_held);
    for (const st of b.spreading || []) {
      if ((a.spreading || []).includes(st)) continue;   // not a new pick
      const cat = tree.techs[st]?.category; if (!cat) continue;
      const E = Object.values(tree.techs).filter(t => t.category === cat && canResearch(tree, t.id, held) && (holders[t.id] || 0) >= 1).map(t => t.id);
      if (!E.includes(st)) { acc.outside++; if (acc.outsideEx.length < 8) acc.outsideEx.push(`${k} ${B.date} ${st}`); continue; }
      acc.n++; acc.sizes.push(E.length);
      acc.holders.push(pct(holders[st], E.map(t => holders[t])));
      acc.era.push(pct(tree.techs[st].era, E.map(t => tree.techs[t].era)));
      acc.ai.push(pct(tree.techs[st].ai, E.map(t => tree.techs[t].ai)));
      const minE = Math.min(...E.map(t => tree.techs[t].era)); if (tree.techs[st].era === minE) acc.minEra++;
      acc.frontierShare.push(E.filter(t => tree.techs[t].era === minE).length / E.length);
    }
  }
}
const mean = v => v.reduce((s, x) => s + x, 0) / v.length;
console.log(`${sums.length} summaries ${sums[0].date} → ${sums.at(-1).date}; new spreading picks ${acc.n} (+${acc.outside} outside the computed eligible set: ${acc.outsideEx.join('; ')})`);
console.log(`eligible set size: mean ${mean(acc.sizes).toFixed(1)}`);
console.log(`percentile of the pick inside its eligible set (0.5 = uniform): holders ${mean(acc.holders).toFixed(3)}  era ${mean(acc.era).toFixed(3)}  ai_weight ${mean(acc.ai).toFixed(3)}`);
console.log(`pick is in the eligible set's lowest era: ${(acc.minEra / acc.n * 100).toFixed(1)}% (uniform would give ${(mean(acc.frontierShare) * 100).toFixed(1)}%)`);
const hist = v => { const h = Array(5).fill(0); for (const x of v) h[Math.min(4, Math.floor(x * 5))]++; return h.map(x => (x / v.length * 100).toFixed(0) + '%').join(' '); };
console.log(`holders-percentile quintiles (uniform 20% each): ${hist(acc.holders)}`);
// within the lowest era of the eligible set: log-likelihood of the picks under P ∝ holders^γ, for a few γ (γ 0 = uniform)
{
  const rows = [];
  for (let i = 1; i < sums.length; i++) {
    const A = sums[i - 1], B = sums[i];
    const holders = {}; for (const c of Object.values(B.countries)) for (const t of c.technologies_held) holders[t] = (holders[t] || 0) + 1;
    for (const [k, b] of Object.entries(B.countries)) {
      const a = A.countries[k]; if (!a) continue; const held = new Set(b.technologies_held);
      for (const st of b.spreading || []) {
        if ((a.spreading || []).includes(st)) continue; const cat = tree.techs[st]?.category; if (!cat) continue;
        const E = Object.values(tree.techs).filter(t => t.category === cat && canResearch(tree, t.id, held) && (holders[t.id] || 0) >= 1);
        const minE = Math.min(...E.map(t => t.era)); const L = E.filter(t => t.era === minE);
        if (L.length < 2 || !L.some(t => t.id === st)) continue;
        rows.push({ h: L.map(t => holders[t.id]), pick: L.findIndex(t => t.id === st), total: Object.keys(B.countries).length });
      }
    }
  }
  console.log(`\nwithin the lowest era (sets of ≥ 2: ${rows.length} picks): log-likelihood per pick under P ∝ holders^γ`);
  for (const g of [0, 0.5, 1, 1.5, 2, 3]) {
    let ll = 0; for (const r of rows) { const w = r.h.map(h => h ** g); ll += Math.log(w[r.pick] / w.reduce((s, x) => s + x, 0)); }
    console.log(`  γ ${g}: ${(ll / rows.length).toFixed(4)}`);
  }
}
