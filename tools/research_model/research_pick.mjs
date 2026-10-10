// HOW DOES THE AI PICK ITS RESEARCH? (BALANCE_FRAMEWORK §10.96) — every NEW research pick between consecutive v18 summaries (the tech researched
// at B differs from A's and A's is held at B), against the set researchable at B. The documented rule (defines/00_ai.txt): tendency =
// ai_weight ÷ (1 + TECH_COST_PENALTY_FACTOR 5 × ahead-of-time penalty ÷ era cost), with TECH_RANDOM_FACTOR 1.0 of randomness. ai_weight here is
// the BASE value only (the conditional parts depend on strategies). Scores the picks under
//   (a) P ∝ s^k (a soft-max family; k 0 = uniform) and
//   (b) argmax of s × (1 + RF × U) with U uniform on [0,1) (one reading of a "random factor"), by simulation of each choice,
// and reports the share of picks that were the country's currently SPREADING tech of that tree, the tree mix, and the era gap.
// usage: node tools/research_model/research_pick.mjs <dir of summaries .json.gz> [--mod <emitted mod>]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadTree, canResearch, techCost } from './lib_tree.mjs';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DIR = args[0]; const tree = loadTree(opt('--mod', null));
const day = d => { const [y, m, dd] = d.split('.').map(Number); return Date.UTC(y, m - 1, dd) / 864e5; };
const sums = fs.readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort().map(f => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f)))));
for (const s of sums) s.date = s.provenance.date; sums.sort((a, b) => day(a.date) - day(b.date));
const rows = [];
for (let i = 1; i < sums.length; i++) {
  const A = sums[i - 1], B = sums[i];
  for (const [k, b] of Object.entries(B.countries)) {
    const a = A.countries[k]; if (!a || !b.researching || b.researching === a.researching) continue;
    const held = new Set(b.technologies_held); if (a.researching && !held.has(a.researching)) continue;   // a switch, not a completion
    const E = Object.values(tree.techs).filter(t => canResearch(tree, t.id, held) || t.id === b.researching);
    if (!E.some(t => t.id === b.researching) || E.length < 2) continue;
    const sc = E.map(t => { const c = techCost(tree, t.id, held); const pen = c - tree.eraCost[t.era]; return t.ai / (1 + 5 * pen / tree.eraCost[t.era]); });
    rows.push({ k, d: B.date, E: E.map(t => t.id), sc, pick: E.findIndex(t => t.id === b.researching), spreading: new Set(b.spreading || []),
      prog: E.map(t => (a.progress_unheld || {})[t.id] ?? 0) });
  }
}
console.log(`${sums.length} summaries ${sums[0].date} → ${sums.at(-1).date}; ${rows.length} new research picks; mean choice set ${(rows.reduce((s, r) => s + r.E.length, 0) / rows.length).toFixed(1)}`);
console.log('(a) mean log-likelihood per pick, P ∝ score^k:');
for (const k of [0, 0.5, 1, 2, 3, 5]) { let ll = 0; for (const r of rows) { const w = r.sc.map(s => s ** k); ll += Math.log(w[r.pick] / w.reduce((x, y) => x + y, 0)); } console.log(`   k ${k}: ${(ll / rows.length).toFixed(4)}`); }
console.log('(b) share of picks reproduced by argmax(score × (1 + RF·U)), expected over 400 draws:');
for (const RF of [0.25, 0.5, 1, 2, 4]) { let hit = 0; for (const r of rows) { let h = 0; for (let n = 0; n < 400; n++) { let bi = 0, bv = -1; r.sc.forEach((s, j) => { const v = s * (1 + RF * Math.random()); if (v > bv) { bv = v; bi = j; } }); if (bi === r.pick) h++; } hit += h / 400; } console.log(`   RF ${RF}: ${(hit / rows.length * 100).toFixed(1)}% (uniform ${(rows.reduce((s, r) => s + 1 / r.E.length, 0) / rows.length * 100).toFixed(1)}%)`); }
const sp = rows.filter(r => r.spreading.has(r.E[r.pick])).length;
const spAvail = rows.reduce((s, r) => s + r.E.filter(t => r.spreading.has(t)).length / r.E.length, 0);
console.log(`pick is a currently spreading tech: ${(sp / rows.length * 100).toFixed(1)}% (uniform would give ${(spAvail / rows.length * 100).toFixed(1)}%)`);
const pr = rows.filter(r => r.prog[r.pick] > 0).length; const prAvail = rows.reduce((s, r) => s + r.prog.filter(p => p > 0).length / r.E.length, 0);
console.log(`pick had progress at the EARLIER save: ${(pr / rows.length * 100).toFixed(1)}% (uniform ${(prAvail / rows.length * 100).toFixed(1)}%)`);
const pct = (v, arr) => (arr.filter(x => x < v).length + arr.filter(x => x === v).length / 2) / arr.length;
console.log(`percentile of the pick's score in its set (0.5 uniform): ${(rows.reduce((s, r) => s + pct(r.sc[r.pick], r.sc), 0) / rows.length).toFixed(3)}`);
const eraP = rows.reduce((s, r) => s + pct(tree.techs[r.E[r.pick]].era, r.E.map(t => tree.techs[t].era)), 0) / rows.length;
console.log(`percentile of the pick's era (0.5 uniform): ${eraP.toFixed(3)}`);
const cats = {}; for (const r of rows) { const c = tree.techs[r.E[r.pick]].category; cats[c] = (cats[c] || 0) + 1; } console.log('tree mix of picks:', JSON.stringify(cats));
// separate exponents: P ∝ ai^a × (1 + 5 × pen ÷ base)^−b, grid search on the mean log-likelihood
{
  const R2 = rows.map(r => ({ ...r, ai: r.E.map(id => tree.techs[id].ai), pen: r.E.map((id, j) => r.sc[j] > 0 ? tree.techs[id].ai / r.sc[j] : 1) }));
  let best = null;
  for (const a of [0, 1, 2, 3, 4, 5]) for (const b of [1, 2, 3, 4, 5, 6, 8, 10]) {
    let ll = 0; for (const r of R2) { const w = r.ai.map((x, j) => x ** a * r.pen[j] ** -b); ll += Math.log(w[r.pick] / w.reduce((s, x) => s + x, 0)); }
    ll /= R2.length; if (!best || ll > best.ll) best = { a, b, ll };
  }
  console.log(`separate exponents, best: ai^${best.a} × penalty-term^−${best.b}  (ll ${best.ll.toFixed(4)})`);
  for (const b of [2, 3, 4, 6, 8]) { let ll = 0; for (const r of R2) { const w = r.ai.map((x, j) => x ** best.a * r.pen[j] ** -b); ll += Math.log(w[r.pick] / w.reduce((s, x) => s + x, 0)); } console.log(`   a ${best.a} b ${b}: ${(ll / R2.length).toFixed(4)}`); }
  const pen0 = R2.filter(r => r.pen[r.pick] <= 1.0001).length;
  const pen0Avail = R2.reduce((s, r) => s + r.pen.filter(p => p <= 1.0001).length / r.E.length, 0);
  console.log(`pick carries NO ahead-of-time penalty: ${(pen0 / R2.length * 100).toFixed(1)}% (uniform ${(pen0Avail / R2.length * 100).toFixed(1)}%; picks with a penalty-free option available: ${(R2.filter(r => r.pen.some(p => p <= 1.0001)).length / R2.length * 100).toFixed(1)}%)`);
}
{ // is the pick in the LOWEST era of the researchable set — overall, and within its own tree?
  let lowAll = 0, lowAllU = 0, lowTree = 0, lowTreeU = 0;
  for (const r of rows) {
    const eras = r.E.map(id => tree.techs[id].era), pe = tree.techs[r.E[r.pick]].era, cat = tree.techs[r.E[r.pick]].category;
    const minAll = Math.min(...eras); if (pe === minAll) lowAll++; lowAllU += eras.filter(e => e === minAll).length / eras.length;
    const te = r.E.filter(id => tree.techs[id].category === cat).map(id => tree.techs[id].era); const minT = Math.min(...te);
    if (pe === minT) lowTree++; lowTreeU += te.filter(e => e === minT).length / te.length;
  }
  console.log(`pick in the researchable set's lowest era: ${(lowAll / rows.length * 100).toFixed(1)}% (uniform ${(lowAllU / rows.length * 100).toFixed(1)}%); in its own tree's lowest: ${(lowTree / rows.length * 100).toFixed(1)}% (uniform ${(lowTreeU / rows.length * 100).toFixed(1)}%)`);
  const gaps = {}; for (const r of rows) { const pe = tree.techs[r.E[r.pick]].era; const g = pe - Math.min(...r.E.map(id => tree.techs[id].era)); gaps[g] = (gaps[g] || 0) + 1; }
  console.log('pick era − lowest researchable era:', JSON.stringify(gaps));
}
{ // restricted choice set: each tree's lowest researchable era; P ∝ ai^a × (1 + 5 pen/base)^−b
  const R3 = rows.map(r => { const lowest = {}; r.E.forEach(id => { const t = tree.techs[id]; lowest[t.category] = Math.min(lowest[t.category] ?? 9, t.era); });
    const keep = r.E.map((id, j) => tree.techs[id].era === lowest[tree.techs[id].category] ? j : -1).filter(j => j >= 0);
    const pk = keep.indexOf(r.pick); return pk < 0 ? null : { ai: keep.map(j => tree.techs[r.E[j]].ai), pen: keep.map(j => tree.techs[r.E[j]].ai / r.sc[j]), pick: pk, cats: keep.map(j => tree.techs[r.E[j]].category) }; }).filter(Boolean);
  let best = null;
  for (const a of [0, 0.5, 1, 1.5, 2, 3, 4]) for (const b of [0, 1, 2, 3]) { let ll = 0; for (const r of R3) { const w = r.ai.map((x, j) => x ** a * r.pen[j] ** -b); ll += Math.log(w[r.pick] / w.reduce((s, x) => s + x, 0)); }
    ll /= R3.length; if (!best || ll > best.ll) best = { a, b, ll }; }
  console.log(`restricted to each tree's lowest era (${R3.length} picks, mean set ${(R3.reduce((s, r) => s + r.ai.length, 0) / R3.length).toFixed(1)}): best ai^${best.a} × pen^−${best.b}, ll ${best.ll.toFixed(4)}`);
  // predicted vs observed tree mix under the best fit
  const pm = {}, om = {}; for (const r of R3) { const w = r.ai.map((x, j) => x ** best.a * r.pen[j] ** -best.b), tw = w.reduce((s, x) => s + x, 0);
    w.forEach((x, j) => pm[r.cats[j]] = (pm[r.cats[j]] || 0) + x / tw); om[r.cats[r.pick]] = (om[r.cats[r.pick]] || 0) + 1; }
  console.log('tree mix observed', JSON.stringify(om), 'predicted', JSON.stringify(Object.fromEntries(Object.entries(pm).map(([k, v]) => [k, Math.round(v)]))));
}
{ // does PROGRESS pull the pick? Within each tree's lowest era AND across all researchable techs: P ∝ ai^4 × (cost ÷ remaining)^c
  const build = restrict => rows.map(r => {
    const held = null; const lowest = {}; r.E.forEach(id => { const t = tree.techs[id]; lowest[t.category] = Math.min(lowest[t.category] ?? 9, t.era); });
    const keep = r.E.map((id, j) => (!restrict || tree.techs[id].era === lowest[tree.techs[id].category]) ? j : -1).filter(j => j >= 0);
    const pk = keep.indexOf(r.pick); if (pk < 0) return null;
    // cost here: the score's penalty term inverted back to a cost multiple (score = ai / (1 + 5 pen/base) ⇒ pen/base = (ai/score − 1)/5)
    const rem = keep.map(j => { const id = r.E[j], t = tree.techs[id]; const pb = (t.ai / r.sc[j] - 1) / 5; const cost = tree.eraCost[t.era] * (1 + pb); return Math.max(0.02, 1 - r.prog[j] / cost); });
    return { ai: keep.map(j => tree.techs[r.E[j]].ai), rem, pick: pk };
  }).filter(Boolean);
  for (const restrict of [true, false]) { const R4 = build(restrict); let best = null;
    for (const c of [0, 0.5, 1, 2, 3, 4]) { let ll = 0; for (const r of R4) { const w = r.ai.map((x, j) => x ** 4 * r.rem[j] ** -c); ll += Math.log(w[r.pick] / w.reduce((s, x) => s + x, 0)); } ll /= R4.length;
      console.log(`  ${restrict ? 'tree-lowest set' : 'all researchable'}: c ${c} ll ${ll.toFixed(4)}`); } }
}
{ // majors vs the rest: share of picks in the tree's lowest era, and the mean cost multiple (cost ÷ era base) of the pick
  const MAJ = new Set(['GBR', 'FRA', 'USA', 'PRU', 'RUS', 'AUS', 'BEL', 'NET', 'SAR', 'SPA', 'JAP', 'TUR']);
  for (const [lab, sel] of [['majors', r => MAJ.has(r.k)], ['others', r => !MAJ.has(r.k)]]) {
    const rs = rows.filter(sel); let low = 0, mult = 0;
    for (const r of rs) { const id = r.E[r.pick], t = tree.techs[id]; const lowest = Math.min(...r.E.filter(x => tree.techs[x].category === t.category).map(x => tree.techs[x].era)); if (t.era === lowest) low++;
      mult += 1 + (t.ai / r.sc[r.pick] - 1) / 5; }
    console.log(`${lab}: ${rs.length} picks, in tree-lowest era ${(low / rs.length * 100).toFixed(1)}%, mean cost multiple of the pick ${(mult / rs.length).toFixed(3)}`);
  }
}
