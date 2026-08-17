// Compute every cell of the flatcost-n1 batch report -> report_data.json
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { requiredConstruction } from 'file:///C:/claude-code/victoria%203%20PM%20and%20tech%20rehaul/tools/vanilla_construction.mjs';

const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
const SES = join(REPO, 'tools/testbed/sessions');
const OUT = (() => { const a = process.argv.slice(2), i = a.indexOf('--out'); return i >= 0 && a[i + 1] ? a[i + 1] : '.'; })();  // default: cwd
// --config <path>: the ARM's config — tier costs come from ITS building_cost (an arm's cost book is
// its own; the flatcost 0.65x map below is only the fallback for the original hardcoded run).
const args0 = process.argv.slice(2);
const cfgPath0 = (() => { const i = args0.indexOf('--config'); return i >= 0 && args0[i + 1] ? args0[i + 1] : join(REPO, 'config/mod_config.json'); })();
const CFG_GIVEN = args0.includes('--config');
const cfg = JSON.parse(readFileSync(cfgPath0, 'utf8'));
const vanCost = requiredConstruction();
const A = { power: 260, port: 260, art_academy: 260, food: 390, textile: 390, furniture: 390, glass: 390, paper: 390, shipyard_steam: 390, tooling: 390, shipyard: 390, arms: 390, artillery: 390, railway: 520, fertilizer: 520, explosives: 520, steel: 520, motor: 520, automotive: 520, munition: 520, synthetics: 520, electrics: 520 };
const tierEra = {}, tierCost = {}, indTiers = {};
for (const ind of cfg.industries) {
  indTiers[ind.id] = { good: ind.output_good, tiers: [] };
  for (const t of ind.tiers || []) {
    tierEra[t.key] = t.era; tierCost[t.key] = CFG_GIVEN ? t.building_cost : A[ind.id];
    indTiers[ind.id].tiers.push({ era: t.era, tech: t.tech });
  }
}
const FRONTIER_INDS = ['tooling', 'steel', 'motor', 'automotive', 'fertilizer', 'explosives', 'munition', 'arms', 'artillery', 'electrics', 'paper', 'glass', 'shipyard', 'shipyard_steam', 'synthetics'];
const PANEL = ['GBR', 'RUS', 'FRA', 'USA', 'PRU', 'TUR', 'AUS', 'SPA', 'BRZ', 'SIC', 'POR', 'NET'];
const YEARS = [1840, 1860, 1880, 1900, 1920, 1935];
const classOf = k => {
  if (k === 'building_construction_sector') return 'c';
  if (k === 'building_manor_house' || k === 'building_financial_district' || k === 'building_company_headquarter') return 'o';
  if (k.startsWith('building_subsistence')) return 's';
  if (k === 'building_urban_center') return 'u';
  if (k === 'building_government_administration' || k === 'building_university' || k === 'building_arts_academy') return 'g';
  if (/barracks|conscription|naval_base|port_military/.test(k)) return 'm';
  if (k === 'building_trade_center') return 't';
  return 'e';
};
function walk(runDir, isFlat) {
  const dir = join(SES, runDir, 'save_summaries');
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
  const out = { years: {}, addsByDecade: {}, gdpByYear: {} };
  let prev = null;
  for (const f of files) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    const lv = {};
    for (const [k, b] of Object.entries(j.world.buildings || {})) lv[k] = b.levels || 0;
    let gdpW = 0;
    for (const c of Object.values(j.countries)) gdpW += c.gdp || 0;
    out.gdpByYear[y] = gdpW / 1e6;
    let ptsAdd = 0;
    if (prev) {
      const d = Math.floor(y / 10) * 10;
      for (const k of new Set([...Object.keys(lv), ...Object.keys(prev)])) {
        const dd = (lv[k] || 0) - (prev[k] || 0);
        if (dd > 0) {
          ptsAdd += dd * (isFlat && tierCost[k] != null ? tierCost[k] : (vanCost[k] || 400));
          if (tierEra[k] != null) (out.addsByDecade[d] = out.addsByDecade[d] || [0, 0, 0, 0, 0, 0])[tierEra[k]] += dd;
        }
      }
    }
    prev = lv;
    if (!YEARS.includes(y)) continue;
    // world aggregates
    let gdp = 0, pool = 0, sal = 0, unemp = 0, peasW = 0, wfAll = 0, econ = 0;
    for (const c of Object.values(j.countries)) {
      gdp += c.gdp || 0; pool += c.investment_pool || 0;
      const ps = c.pop_statistics || {};
      sal += ps.population_salaried_workforce || 0; unemp += ps.population_unemployed_workforce || 0;
      for (const [p, n] of Object.entries(c.workforce_by_profession || {})) { wfAll += n; if (p === 'peasants') peasW += n; }
    }
    for (const [k, v] of Object.entries(lv)) if (classOf(k) === 'e') econ += v;
    // per-era profit/staffing (sum over countries)
    const era = {};
    for (const c of Object.values(j.countries)) {
      for (const [k, b] of Object.entries(c.buildings || {})) {
        if (tierEra[k] == null) continue;
        const a = era[tierEra[k]] = era[tierEra[k]] || { lv: 0, p: 0, s: 0, cost: 0 };
        a.lv += b.levels; a.p += b.profit || 0; a.s += b.staffing || 0;
        a.cost += b.levels * (isFlat ? tierCost[k] : (vanCost[k] || 400));
      }
    }
    // panel + GBR
    const pm = { u: 0, sal: 0, wf: 0, peas: 0 }; let gbr = null;
    const meanEraByTag = {};
    for (const tag of PANEL) {
      const c = j.countries[tag]; if (!c) continue;
      const ps = c.pop_statistics || {};
      const m = { u: ps.population_unemployed_workforce || 0, sal: ps.population_salaried_workforce || 0, wf: 0, peas: 0 };
      for (const [p, n] of Object.entries(c.workforce_by_profession || {})) { m.wf += n; if (p === 'peasants') m.peas += n; }
      for (const k in m) pm[k] += m[k];
      let se = 0, sl = 0;
      for (const [k, b] of Object.entries(c.buildings || {})) if (tierEra[k] != null) { se += b.levels * tierEra[k]; sl += b.levels; }
      meanEraByTag[tag] = sl ? se / sl : null;
      if (tag === 'GBR') gbr = { ...m, gdp: c.gdp, meanEra: meanEraByTag[tag] };
    }
    // frontier-producers share (median over FRONTIER_INDS)
    const shares = [];
    for (const id of FRONTIER_INDS) {
      const I = indTiers[id]; if (!I || !I.good) continue;
      const sorted = [...I.tiers].sort((a, b) => b.era - a.era);
      let ftech = null;
      for (const t of sorted) { if (Object.values(j.countries).some(c => (c.technologies_held || []).includes(t.tech))) { ftech = t.tech; break; } }
      if (!ftech) continue;
      let fOut = 0, wOut = 0;
      for (const c of Object.values(j.countries)) {
        const q = (c.goods_out || {})[I.good] || 0; wOut += q;
        if ((c.technologies_held || []).includes(ftech)) fOut += q;
      }
      if (wOut > 0) shares.push(fOut / wOut);
    }
    shares.sort((a, b) => a - b);
    const perCountryGdp = {};
    for (const tag of PANEL) if (j.countries[tag]) perCountryGdp[tag] = j.countries[tag].gdp / 1e6;
    out.years[y] = {
      gdp: gdp / 1e6, pool: pool / 1e6, econ, sal, unemp, peasW, wfAll, ptsAdd,
      pure: 100 * unemp / (unemp + sal), full: 100 * (unemp + peasW) / (wfAll + unemp),
      panelPure: 100 * pm.u / (pm.u + pm.sal), panelFull: 100 * (pm.u + pm.peas) / (pm.wf + pm.u),
      era: Object.fromEntries(Object.entries(era).map(([e, a]) => [e, { lv: a.lv, ppl: a.p / a.lv, staff: a.s / a.lv, cpl: a.cost / a.lv }])),
      meanEraByTag, frontierShareMedian: shares.length ? shares[Math.floor(shares.length / 2)] : null,
      frontierShareN: shares.length, perCountryGdp, gbr,
    };
  }
  return out;
}
// --mod <sess/run[,sess/run...]>: the mod arm's run(s). Several runs -> per-run series kept AND a
// flatMean the template can plot; `flat` stays the FIRST run for shape compatibility.
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const MODRUNS = argOf('--mod', '20260815_153825_flatcost-n1/run001_flatcost').split(',');
const flats = MODRUNS.map(r => walk(r, true));
const flat = flats[0];
const van = ['run001_vanilla', 'run003_vanilla', 'run005_vanilla', 'run007_vanilla'].map(r => walk('20260813_083557_vanilla-vs-mod-n4/' + r, false));
const nb = ['run002_mod', 'run006_mod'].map(r => walk('20260813_083557_vanilla-vs-mod-n4/' + r, false)); // cost map irrelevant for GDP series
// vanilla means at years
const vanMean = {};
for (const y of YEARS) {
  const rows = van.map(v => v.years[y]).filter(Boolean);
  const m = k => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  vanMean[y] = { gdp: m('gdp'), econ: m('econ'), ptsAdd: m('ptsAdd'), pure: m('pure'), full: m('full'), panelPure: m('panelPure'), panelFull: m('panelFull') };
  vanMean[y].perCountryGdp = {};
  for (const tag of PANEL) {
    const vals = rows.map(r => r.perCountryGdp[tag]).filter(x => x != null);
    if (vals.length) vanMean[y].perCountryGdp[tag] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
}
const nbGdp = {};
for (const y of [...YEARS, 1850, 1870, 1890, 1910, 1930]) {
  const vals = nb.map(v => v.gdpByYear[y]).filter(Boolean);
  if (vals.length) nbGdp[y] = vals.reduce((a, b) => a + b, 0) / vals.length;
}
const vanGdpByYear = {};
for (const y of Object.keys(van[0].gdpByYear)) {
  const vals = van.map(v => v.gdpByYear[y]).filter(Boolean);
  vanGdpByYear[y] = vals.reduce((a, b) => a + b, 0) / vals.length;
}
const flatAll = flats.map(f => f.gdpByYear);   // per-run world GDP series (n=2 agreement is a finding)
writeFileSync(join(OUT, 'report_data.json'), JSON.stringify({ flat, flats, flatAll, vanMean, nbGdp, vanGdpByYear, nbAdds: nb[0].addsByDecade }, null, 1));
console.log('written. flat years:', Object.keys(flat.years).join(','));
console.log('frontier share medians:', YEARS.map(y => y + ':' + (flat.years[y]?.frontierShareMedian?.toFixed(2) ?? '-') + '(n=' + (flat.years[y]?.frontierShareN ?? 0) + ')').join('  '));
console.log('GBR meanEra:', YEARS.map(y => y + ':' + (flat.years[y]?.gbr?.meanEra?.toFixed(2) ?? '-')).join('  '));
