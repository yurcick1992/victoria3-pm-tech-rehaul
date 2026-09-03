// Per-country dataset for the watchlist page: yearly GDP (flat + vanilla mean), sample-year
// labour + tier-employment-by-era, and anomaly flags (dissolution / civil-war / annexation jumps).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
const SES = join(REPO, 'tools/testbed/sessions');
const OUT = (() => { const a = process.argv.slice(2), i = a.indexOf('--out'); return i >= 0 && a[i + 1] ? a[i + 1] : '.'; })();  // default: cwd
// --config <path>: the ARM's config — tier keys/eras/employment AND workforce_mult come from it
// (⚠ tierEmp used to omit workforce_mult, so graded port workers were counted ×10/×5 — the exact
// trap tiered_panel.mjs documents; fixed 2026-08-24 together with the sector set)
const cfgPath = (() => { const a = process.argv.slice(2), i = a.indexOf('--config'); return i >= 0 && a[i + 1] ? a[i + 1] : join(REPO, 'config/mod_config.json'); })();
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const tierEra = {}, tierEmp = {}, vanEmp = {};
for (const ind of cfg.industries) {
  if (ind.disabled) continue;   // ⚠ a DISABLED industry (port/shipyard/railway/power on the four-rung books) keeps its tiers in the config and its rung-0 KEY IS THE VANILLA BUILDING — counting it put Britain's shipyards and ports into "e0" (BUGS_AND_FIXES 2026-09-03)
  const tiers = (ind.tiers || []).filter(t => t.key);
  for (const t of tiers) {
    tierEra[t.key] = t.era;
    tierEmp[t.key] = Object.values(t.employment || {}).reduce((a, b) => a + b, 0) * (+(t.workforce_mult ?? 1));
  }
  // vanilla counterpart: the tier-1 key IS the vanilla base building; per-level employment = the
  // most advanced rung's (the tiered_panel.mjs convention — main-PM employment is constant per
  // level and vanilla's own values match the config's; the three that move, move at the same rungs)
  if (tiers.length) vanEmp[tiers[0].key] = Object.values(tiers[tiers.length - 1].employment || {}).reduce((a, b) => a + b, 0);
}
// NET joins the panel 2026-08-17: it is the third colonial-port power and the one the §10.60.3 chain
// seed deliberately withheld from (the seed is GBR/FRA markets only), so it is the control for
// "does an unseeded overseas empire fall behind once it researches the port tech?".
const TAGS = ['GBR', 'RUS', 'FRA', 'USA', 'PRU', 'TUR', 'AUS', 'SPA', 'BRZ', 'SIC', 'POR', 'NET'];
const SAMPLE = [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
function walk(runDir, isMod) {
  const dir = join(SES, runDir, 'save_summaries');
  const out = {};
  const EMP = isMod ? tierEmp : vanEmp;   // which ladder this arm's building keys live on
  for (const tag of TAGS) out[tag] = { gdp: {}, pop: {}, lab: {}, emp: {}, pw: {} };
  out._sector = { world: {}, tags: {} };  // [workers M, workers M, weekly VA £M] per year
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    // sector: EVERY country (the world row), tier-equivalent buildings only, VA from v6+ fields
    const secOf = c => {
      let w = 0, va = 0;
      for (const [k, b] of Object.entries(c.buildings || {})) {
        const per = EMP[k]; if (per == null) continue;
        w += (b.staffing || 0) * per;
        if (b.va_out !== undefined) va += (b.va_out || 0) - (b.va_in || 0);
      }
      return [w, va];
    };
    if (SAMPLE.includes(y)) {
      let W = 0, VA = 0;
      for (const c of Object.values(j.countries)) { const [w, va] = secOf(c); W += w; VA += va; }
      out._sector.world[y] = [+(W / 1e6).toFixed(2), +(W / 1e6).toFixed(2), +(VA / 1e6).toFixed(2)];
    }
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
      // productive workers (the corrected 2026-08-20 definition), for the selection decomposition
      out[tag].pw[y] = +((sal - (ps.population_government_workforce || 0) - (ps.population_military_workforce || 0)) / 1e6).toFixed(2);
      const [sw, sva] = secOf(c);
      (out._sector.tags[tag] ||= {})[y] = [+(sw / 1e6).toFixed(3), +(sw / 1e6).toFixed(3), +(sva / 1e6).toFixed(3)];
      if (isMod) {
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
// --van <sess/run[,sess/run...]>: the vanilla-baseline run list (default: the original pinned n4)
const vans = argOf('--van', ['run001_vanilla', 'run003_vanilla', 'run005_vanilla', 'run007_vanilla']
  .map(r => '20260813_083557_vanilla-vs-mod-n4/' + r).join(',')).split(',').map(r => walk(r, false));
// vanilla mean per tag per year over runs where present
const van = {};
for (const tag of TAGS) {
  van[tag] = { gdp: {}, lab: {}, pw: {} };
  const yrs = new Set(); vans.forEach(v => Object.keys(v[tag].gdp).forEach(y => yrs.add(+y)));
  for (const y of yrs) {
    const g = vans.map(v => v[tag].gdp[y]).filter(x => x != null);
    if (g.length) van[tag].gdp[y] = { m: Math.round(g.reduce((a, b) => a + b, 0) / g.length * 10) / 10, n: g.length };
    const l = vans.map(v => v[tag].lab[y]).filter(Boolean);
    if (l.length) van[tag].lab[y] = [+(l.reduce((a, r) => a + r[0], 0) / l.length).toFixed(1), +(l.reduce((a, r) => a + r[1], 0) / l.length).toFixed(1)];
    const pw = vans.map(v => v[tag].pw[y]).filter(x => x != null);
    if (pw.length) van[tag].pw[y] = +(pw.reduce((a, b) => a + b, 0) / pw.length).toFixed(2);
  }
}
// sector (tier-equivalent buildings: workers + weekly VA): flat = first mod run; van = element-wise
// mean across vanilla runs. Shape [workers M, workers M, weekly VA £M] — the renderer reads
// value/workers, so slot 2 repeats slot 1 by construction (no clean-subset restriction any more:
// VA is measured directly since summaries v6, both arms).
const meanSector = runs => {
  const o = { world: {}, tags: {} };
  const acc = (dst, y, row) => { const a = (dst[y] ||= [0, 0, 0, 0]); a[0] += row[0]; a[1] += row[1]; a[2] += row[2]; a[3]++; };
  for (const r of runs) {
    for (const [y, row] of Object.entries(r._sector.world)) acc(o.world, y, row);
    for (const [tg, ys] of Object.entries(r._sector.tags)) for (const [y, row] of Object.entries(ys)) acc((o.tags[tg] ||= {}), y, row);
  }
  const fin = dst => { for (const y in dst) { const a = dst[y]; dst[y] = [+(a[0] / a[3]).toFixed(3), +(a[1] / a[3]).toFixed(3), +(a[2] / a[3]).toFixed(3)]; } };
  fin(o.world); for (const tg in o.tags) fin(o.tags[tg]);
  return o;
};
const sector = { flat: meanSector([flatRuns[0]]), van: meanSector(vans) };
for (const f of flatRuns) delete f._sector;
for (const v of vans) delete v._sector;
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
writeFileSync(join(OUT, 'report_data2.json'), JSON.stringify({ flat, flatRuns, van, flags, sector }));
for (const tag of TAGS) console.log(tag, JSON.stringify(flags[tag]));
console.log('bytes:', readFileSync(join(OUT, 'report_data2.json')).length);
