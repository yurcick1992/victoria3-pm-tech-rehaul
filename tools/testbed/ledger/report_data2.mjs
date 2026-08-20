// Per-country dataset for the watchlist page: yearly GDP (flat + vanilla mean), sample-year
// labour + tier-employment-by-era, and anomaly flags (dissolution / civil-war / annexation jumps).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
const SES = join(REPO, 'tools/testbed/sessions');
const OUT = (() => { const a = process.argv.slice(2), i = a.indexOf('--out'); return i >= 0 && a[i + 1] ? a[i + 1] : '.'; })();  // default: cwd
const cfg = JSON.parse(readFileSync(join(REPO, 'config/mod_config.json'), 'utf8'));
const tierEra = {}, tierEmp = {};
for (const ind of cfg.industries) for (const t of ind.tiers || []) {
  tierEra[t.key] = t.era;
  tierEmp[t.key] = Object.values(t.employment || {}).reduce((a, b) => a + b, 0);
}
// NET joins the panel 2026-08-17: it is the third colonial-port power and the one the §10.60.3 chain
// seed deliberately withheld from (the seed is GBR/FRA markets only), so it is the control for
// "does an unseeded overseas empire fall behind once it researches the port tech?".
const TAGS = ['GBR', 'RUS', 'FRA', 'USA', 'PRU', 'TUR', 'AUS', 'SPA', 'BRZ', 'SIC', 'POR', 'NET'];
const SAMPLE = [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
function walk(runDir, wantEmp) {
  const dir = join(SES, runDir, 'save_summaries');
  const out = {};
  for (const tag of TAGS) out[tag] = { gdp: {}, pop: {}, lab: {}, emp: {} };
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    for (const tag of TAGS) {
      const c = j.countries[tag]; if (!c) continue;
      out[tag].gdp[y] = Math.round(c.gdp / 1e6 * 10) / 10;
      out[tag].pop[y] = Math.round(Object.values(c.strata || {}).reduce((a, b) => a + b, 0) / 1e5) / 10;
      if (!SAMPLE.includes(y)) continue;
      const ps = c.pop_statistics || {};
      const u = ps.population_unemployed_workforce || 0, sal = ps.population_salaried_workforce || 0;
      let wf = 0, peas = 0;
      for (const [p, n] of Object.entries(c.workforce_by_profession || {})) { wf += n; if (p === 'peasants') peas += n; }
      out[tag].lab[y] = [+(100 * u / (u + sal)).toFixed(1), +(100 * (u + peas) / (wf + u)).toFixed(1)];
      if (wantEmp) {
        const e = [0, 0, 0, 0, 0, 0];
        for (const [k, b] of Object.entries(c.buildings || {}))
          if (tierEra[k] != null) e[tierEra[k]] += (b.staffing || 0) * (tierEmp[k] || 0);
        out[tag].emp[y] = e.map(x => +(x / 1e6).toFixed(2));
      }
    }
  }
  return out;
}
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const MODRUNS = argOf('--mod', '20260815_153825_flatcost-n1/run001_flatcost').split(',');
const flatRuns = MODRUNS.map(r => walk(r, true));
const flat = flatRuns[0];
const vans = ['run001_vanilla', 'run003_vanilla', 'run005_vanilla', 'run007_vanilla']
  .map(r => walk('20260813_083557_vanilla-vs-mod-n4/' + r, false));
// vanilla mean per tag per year over runs where present
const van = {};
for (const tag of TAGS) {
  van[tag] = { gdp: {}, lab: {} };
  const yrs = new Set(); vans.forEach(v => Object.keys(v[tag].gdp).forEach(y => yrs.add(+y)));
  for (const y of yrs) {
    const g = vans.map(v => v[tag].gdp[y]).filter(x => x != null);
    if (g.length) van[tag].gdp[y] = { m: Math.round(g.reduce((a, b) => a + b, 0) / g.length * 10) / 10, n: g.length };
    const l = vans.map(v => v[tag].lab[y]).filter(Boolean);
    if (l.length) van[tag].lab[y] = [+(l.reduce((a, r) => a + r[0], 0) / l.length).toFixed(1), +(l.reduce((a, r) => a + r[1], 0) / l.length).toFixed(1)];
  }
}
// anomaly flags off the flat run (+ vanilla presence)
const flags = {};
for (const tag of TAGS) {
  const yrs = Object.keys(flat[tag].gdp).map(Number).sort((a, b) => a - b);
  const fl = [];
  if (!yrs.length) { flags[tag] = ['absent all run']; continue; }
  if (yrs[yrs.length - 1] < 1935) fl.push('dissolved ~' + yrs[yrs.length - 1]);
  let maxUp = 0, upY = 0, maxDn = 0, dnY = 0;
  for (let i = 1; i < yrs.length; i++) {
    if (yrs[i] - yrs[i - 1] !== 1) continue;
    const p0 = flat[tag].pop[yrs[i - 1]], p1 = flat[tag].pop[yrs[i]];
    if (!p0 || !p1) continue;
    const d = (p1 - p0) / p0;
    if (d > maxUp) { maxUp = d; upY = yrs[i]; }
    if (d < maxDn) { maxDn = d; dnY = yrs[i]; }
  }
  if (maxDn < -0.25) fl.push((maxUp > 0.25 ? 'civil war ' : 'collapse ') + dnY + ' (pop ' + Math.round(100 * maxDn) + '%)');
  if (maxUp > 0.25 && maxDn >= -0.25) fl.push('annexation-scale jump ' + upY + ' (pop +' + Math.round(100 * maxUp) + '%)');
  else if (maxUp > 0.25 && maxDn < -0.25) fl.push('recovered ' + upY);
  // vanilla-side dissolution
  const vy = Object.keys(van[tag].gdp).map(Number).sort((a, b) => a - b);
  if (vy.length && vy[vy.length - 1] < 1935) fl.push('van: gone ~' + vy[vy.length - 1]);
  flags[tag] = fl;
}
writeFileSync(join(OUT, 'report_data2.json'), JSON.stringify({ flat, flatRuns, van, flags }));
for (const tag of TAGS) console.log(tag, JSON.stringify(flags[tag]));
console.log('bytes:', readFileSync(join(OUT, 'report_data2.json')).length);
