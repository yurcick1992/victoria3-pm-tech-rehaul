// THE WORLD-TECHNOLOGY GATE IN PLAY (BALANCE_FRAMEWORK §10.115 ruling 7; the pre-1.2 probe 2, 2026-11-20). For each run's yearly
// summaries: grain-farm levels on Soil-Enriching Farming (pm_soil_enriching_farming, and the rice farm's twin), split by whether the
// owning country holds Intensive Agriculture; the sheep-farm method on the same technology (pm_sheep_farms, host-gated in every arm)
// beside it as the in-run check that the host gate still bites. On the probe-2 overlay the farm methods are gated on the WORLD's
// technology, so levels in non-holders are the gate working; on vanilla they must be zero.
// usage: node tools/testbed/ledger/world_gate_uptake.mjs <label>=<runDir>[,<runDir>…] [...]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const TECH = 'intensive_agriculture';
const GRAIN = ['building_rye_farm', 'building_wheat_farm', 'building_rice_farm', 'building_maize_farm', 'building_millet_farm'];
const SEF = ['pm_soil_enriching_farming', 'pm_soil_enriching_farming_building_rice_farm'];
const day = d => { const [y, m, dd] = d.split('.').map(Number); return Date.UTC(y, m - 1, dd) / 864e5; };
const groups = process.argv.slice(2).map(a => { const [l, d] = a.split('='); return { label: l, dirs: d.split(',') }; });
if (!groups.length) { console.error('usage: <label>=<runDir>[,<runDir>] ...'); process.exit(2); }
for (const g of groups) {
  const byYear = {};
  for (const dir of g.dirs) {
    const sd = path.join(dir, 'save_summaries');
    for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.'))) {
      const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f))));
      const d = j.provenance.date; if (!/\.1\.1$/.test(d)) continue;
      const y = +d.split('.')[0];
      const a = byYear[y] ||= { runs: 0, holders: 0, hold: { grain: 0, sef: 0, sheepRanch: 0, sheep: 0 }, non: { grain: 0, sef: 0, sheepRanch: 0, sheep: 0, countriesWithSef: 0 } };
      a.runs++;
      for (const c of Object.values(j.countries)) {
        const has = (c.technologies_held || []).includes(TECH);
        if (has) a.holders++;
        const side = has ? a.hold : a.non;
        let sefHere = 0;
        for (const [bt, b] of Object.entries(c.buildings || {})) {
          if (GRAIN.includes(bt)) { side.grain += b.levels || 0; for (const p of SEF) { side.sef += (b.pms || {})[p] || 0; sefHere += (b.pms || {})[p] || 0; } }
          if (bt === 'building_livestock_ranch') { side.sheepRanch += b.levels || 0; side.sheep += (b.pms || {}).pm_sheep_farms || 0; }
        }
        if (!has && sefHere > 0) a.non.countriesWithSef++;
      }
    }
  }
  console.log(`\n== ${g.label} (${g.dirs.length} run(s)); per run means; SEF = Soil-Enriching Farming levels ÷ grain-farm levels; sheep = sheep-farm levels ÷ ranch levels`);
  console.log('year   holders   holders: SEF share  sheep share   |  non-holders: grain lv   SEF share  countries w/ SEF   sheep share');
  for (const y of Object.keys(byYear).map(Number).sort((a, b) => a - b)) {
    const a = byYear[y], r = a.runs, sh = (x, n) => n ? (100 * x / n).toFixed(1) + '%' : '-';
    console.log(`${y}   ${(a.holders / r).toFixed(0).padStart(5)}     ${sh(a.hold.sef, a.hold.grain).padStart(10)}  ${sh(a.hold.sheep, a.hold.sheepRanch).padStart(10)}   |  ${(a.non.grain / r).toFixed(0).padStart(12)}   ${sh(a.non.sef, a.non.grain).padStart(9)}  ${(a.non.countriesWithSef / r).toFixed(1).padStart(10)}       ${sh(a.non.sheep, a.non.sheepRanch).padStart(9)}`);
  }
}
