// WHAT DO UNIVERSITIES PRODUCE? (BALANCE_FRAMEWORK §10.96) — v18 summaries carry the AI's innovation snapshot beside the university buildings,
// so the mapping innovation = 50 + Σ_method rate × staffed levels on that method × k can be read directly (rates 1 / 1.5 / 2 from vanilla
// 07_government.txt); k > 1 would mean throughput (economy of scale, events) scales the country modifier. Pre-v18 sessions (every mod run)
// have no innovation field, so the research model estimates it this way.
// usage: node tools/research_model/innovation_fit.mjs <dir of summaries .json.gz>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
export const UNI_RATE = { pm_scholastic_education: 1, pm_philosophy_department: 1.5, pm_analytical_philosophy_department: 2 };
// modelled innovation from a summary's country record (50 base + universities); null if no building record
export function uniInnovation(c, k = 1) {
  const u = c.buildings?.building_university; if (!u || !u.levels) return 50;
  const share = u.staffing / u.levels; let s = 0;
  for (const [pm, lv] of Object.entries(u.pms || {})) if (UNI_RATE[pm]) s += UNI_RATE[pm] * lv * share;
  return 50 + k * s;
}
if (process.argv[1]?.endsWith('innovation_fit.mjs')) {
  const DIR = process.argv[2];
  const rows = [];
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort()) {
    const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))));
    for (const [k, c] of Object.entries(s.countries)) if (c.innovation != null && c.buildings?.building_university?.levels) rows.push({ k, d: s.provenance.date, obs: c.innovation - 50, mod: uniInnovation(c) - 50, lv: c.buildings.building_university.levels });
  }
  let sxy = 0, sxx = 0; for (const r of rows) { sxy += r.obs * r.mod; sxx += r.mod * r.mod; }
  const k = sxy / sxx; const rat = rows.filter(r => r.mod > 1).map(r => r.obs / r.mod).sort((a, b) => a - b);
  console.log(`${rows.length} country-dates with universities; through-origin fit: (innovation − 50) = ${k.toFixed(3)} × Σ rate × staffed levels`);
  console.log(`ratio obs ÷ model: p10 ${rat[Math.floor(rat.length * .1)].toFixed(3)} median ${rat[rat.length >> 1].toFixed(3)} p90 ${rat[Math.floor(rat.length * .9)].toFixed(3)}`);
  for (const [lo, hi] of [[1, 5], [5, 20], [20, 50], [50, 1e9]]) { const r = rows.filter(x => x.lv >= lo && x.lv < hi && x.mod > 1).map(x => x.obs / x.mod).sort((a, b) => a - b); if (r.length) console.log(`  ${lo}–${hi} levels: n ${r.length} median ratio ${r[r.length >> 1].toFixed(3)}`); }
  for (const t of ['GBR', 'FRA', 'PRU', 'USA', 'RUS']) { const r = rows.filter(x => x.k === t); const last = r.at(-1); if (last) console.log(`  ${t} ${last.d}: levels ${last.lv} innovation−50 ${last.obs.toFixed(1)} model ${last.mod.toFixed(1)}`); }
}
