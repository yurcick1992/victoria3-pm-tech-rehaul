// VALUE-ADDED COMPOSITION BY SECTOR, measured from v6+ save summaries (va_out/va_in per building
// type — the game's own GDP basis, F45: VA = outputs − inputs at market prices; wages are paid OUT
// of VA, not subtracted; construction/trade/government consume goods and sell nothing, so 'support'
// is legitimately NEGATIVE). Written 2026-08-24 to answer "what are these shares in vanilla?"
// against the inverse solver's per-era table (BALANCE_FRAMEWORK §10.65.2) — FINDINGS F80.
//
//   node tools/testbed/ledger/va_composition.mjs                       # the pinned vanilla n=18 baseline
//   node tools/testbed/ledger/va_composition.mjs --session <stamp> …   # any session(s) with v6+ summaries
//   node tools/testbed/ledger/va_composition.mjs --years 1837,1900     # default 1837,1870,1900,1920,1936
//
// Scopes: world · USA · pooled7 (GBR+USA+FRA+NET+BEL+PRU+GER — the advanced_panel's group, so the
// figure is comparable with the tiered_panel's mod-arm "tiered share of VA"). Medians of per-run
// shares; runs gated by usableRuns (landmine L17), drops printed.
// ⚠ Sectors mirror the inverse solver's buckets: extraction = mines/oil/rubber (+gold — note gold IS
// here, unlike the scenario model, which excludes it; its VA is real in a save), agriculture =
// farms/plantations/ranches/fishing/whaling, tiered = the vanilla anchors of the mod's 22 industries.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SES = path.resolve(HERE, '..', 'sessions');
const argSessions = [];
const argv = process.argv.slice(2);
let YEARS = [1837, 1870, 1900, 1920, 1936];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--session') argSessions.push(argv[++i]);
  else if (argv[i] === '--years') YEARS = argv[++i].split(',').map(Number);
}
const SESSIONS = argSessions.length ? argSessions
  : ['20260821_131149_vanilla-baseline-n16', '20260823_113218_vanilla-baseline-extra-n2'];
const POOL7 = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'PRU', 'GER'];

const TIERED = new Set(['building_food_industry', 'building_textile_mill', 'building_furniture_manufactory',
  'building_glassworks', 'building_tooling_workshop', 'building_paper_mill', 'building_chemical_plant',
  'building_explosives_factory', 'building_steel_mill', 'building_motor_industry', 'building_shipyard',
  'building_military_shipyard', 'building_arms_industry', 'building_artillery_foundry', 'building_munition_plant',
  'building_synthetics_plant', 'building_electrics_industry', 'building_power_plant', 'building_port',
  'building_railway', 'building_automotive_industry', 'building_arts_academy']);
function sectorOf(b) {
  if (/subsistence/.test(b)) return 'subsistence';
  if (b === 'building_urban_center') return 'urban';
  if (b === 'building_logging_camp') return 'logging';
  if (/_(mine|fields)$|oil_rig|rubber_plantation/.test(b)) return 'extraction';
  if (/_farm$|_plantation$|livestock_ranch|fishing_wharf|whaling_station/.test(b)) return 'agriculture';
  if (TIERED.has(b)) return 'tiered';
  return 'support';
}
const SECTORS = ['extraction', 'agriculture', 'logging', 'subsistence', 'urban', 'tiered', 'support'];

const acc = {}, gdpChk = {}, tieredDetail = {};
let nRuns = 0;
for (const ses of SESSIONS) {
  const { runs, dropped } = usableRuns(SES, ses);
  reportDropped(dropped);
  for (const run of runs) {
    const dir = path.join(SES, run, 'save_summaries');
    if (!fs.existsSync(dir)) { console.error(`  no summaries: ${run}`); continue; }
    nRuns++;
    // L25: never glob the harvester's in-progress temp file — it can skip a year or count it twice
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
    const byYear = {};
    for (const f of files) {
      const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))));
      byYear[+String(j.provenance.date).split('.')[0]] = j;
    }
    for (const y of YEARS) {
      const j = byYear[y];
      if (!j) { console.error(`  ${run}: no ${y} summary`); continue; }
      // pooled7: sum the seven countries' building maps into one (PRU and GER both listed — one
      // usually becomes the other, so summing whichever exists is the composition-stable read)
      const pooled = {};
      for (const tag of POOL7) {
        const c = j.countries[tag];
        if (!c || !c.buildings) continue;
        for (const b in c.buildings) {
          const p = pooled[b] = pooled[b] || { va_out: 0, va_in: 0 };
          p.va_out += c.buildings[b].va_out || 0; p.va_in += c.buildings[b].va_in || 0;
        }
      }
      const pooledGdp = POOL7.reduce((a, t) => a + ((j.countries[t] || {}).gdp || 0), 0);
      for (const [scope, blds, gdp] of [
        ['world', j.world.buildings, j.world.gdp],
        ['USA', (j.countries.USA || {}).buildings, (j.countries.USA || {}).gdp],
        ['pooled7', pooled, pooledGdp],
      ]) {
        if (!blds || !Object.keys(blds).length) continue;
        const va = {}; let tot = 0;
        for (const b in blds) {
          const v = (blds[b].va_out || 0) - (blds[b].va_in || 0);
          const s = sectorOf(b);
          va[s] = (va[s] || 0) + v; tot += v;
          if (scope === 'world' && s === 'tiered')
            (((tieredDetail[y] = tieredDetail[y] || {})[b] = tieredDetail[y][b] || [])).push(v);
        }
        for (const s of SECTORS)
          (acc[`${scope}|${y}|${s}`] = acc[`${scope}|${y}|${s}`] || []).push((va[s] || 0) / Math.max(1, tot));
        if (gdp) (gdpChk[`${scope}|${y}`] = gdpChk[`${scope}|${y}`] || []).push(gdp / (52 * tot));
        if (scope === 'world') (acc[`world|${y}|__tot`] = acc[`world|${y}|__tot`] || []).push(tot);
      }
    }
  }
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
console.log(`sessions: ${SESSIONS.join(', ')} — ${nRuns} usable run(s)`);
for (const scope of ['world', 'USA', 'pooled7']) {
  console.log(`\n=== ${scope} — median VA share by sector ===`);
  console.log('sector      ' + YEARS.map(y => String(y).padStart(8)).join(''));
  for (const s of SECTORS) {
    console.log(s.padEnd(12) + YEARS.map(y => {
      const a = acc[`${scope}|${y}|${s}`];
      return a ? (100 * med(a)).toFixed(1).padStart(7) + '%' : '     —';
    }).join(''));
  }
  console.log('gdp/(52·VA) ' + YEARS.map(y => { const a = gdpChk[`${scope}|${y}`]; return a ? med(a).toFixed(2).padStart(8) : '       —'; }).join(''));
}
console.log('\n=== world tiered detail (median VA share of TOTAL world VA) ===');
const totBy = {}; for (const y of YEARS) totBy[y] = med(acc[`world|${y}|__tot`] || [1]);
for (const y of YEARS) {
  const det = tieredDetail[y] || {};
  const rows = Object.entries(det).map(([b, a]) => [b.replace('building_', ''), med(a) / totBy[y]])
    .sort((a, b) => b[1] - a[1]).filter(([, v]) => Math.abs(v) > 0.001);
  console.log(`${y}: ` + rows.map(([b, v]) => `${b} ${(100 * v).toFixed(1)}%`).join(' · '));
}
