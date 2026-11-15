// Per-country dataset for the Shortlist page: yearly GDP (the mean over the mod runs + the same mean over the vanilla runs), sample-year
// labour + tier-employment-by-era, and anomaly flags (dissolution / civil-war / annexation jumps).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { eraCols } from './lib_era_cols.mjs';
import { workforceModel, DEFAULT_GAME } from './lib_workforce_groups.mjs';
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
const SES = join(REPO, 'tools/testbed/sessions');
const OUT = (() => { const a = process.argv.slice(2), i = a.indexOf('--out'); return i >= 0 && a[i + 1] ? a[i + 1] : '.'; })();  // default: cwd
// --config <path>: the ARM's config — tier keys/eras/employment AND workforce_mult come from it
// (⚠ tierEmp used to omit workforce_mult, so graded port workers were counted ×10/×5 — the exact
// trap tiered_panel.mjs documents; fixed 2026-08-24 together with the sector set)
const cfgPath = (() => { const a = process.argv.slice(2), i = a.indexOf('--config'); return i >= 0 && a[i + 1] ? a[i + 1] : join(REPO, 'config/mod_config.json'); })();
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
// ⭐ The per-country employment-by-era columns come from lib_era_cols.mjs (2026-10-02): e0 split into artisans / other on a book with
//   crafts, a merge host's workers shared out over its main methods at each method's era — the SAME columns fill_emp.mjs writes for
//   the world page, so the two pages cannot disagree. The `emp_cols` the template labels them with ship in the output beside them.
const ERA_COLS = eraCols(cfg);

// ⭐ 2026-11-15: the whole workforce outside the tier buildings, in groups (lib_workforce_groups.mjs) — method employment read live from the
//   game folder (VIC3_GAME) and the build of the book the runs played (--mod-build, default mod/: the per-run builds are deleted after a batch)
const MODBUILD = (() => { const i = process.argv.indexOf('--mod-build'); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'mod'; })();
const WG = workforceModel({ game: DEFAULT_GAME, mod: MODBUILD, tierKeys: ERA_COLS.tier });
console.log('workforce groups: game ' + DEFAULT_GAME + ' · mod build ' + MODBUILD);
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
// ⭐ BEL, NGF, GER and UNL join 2026-10-02 so the watchlist can show THE SHORTLIST POOL (lib_markets.mjs: GBR USA FRA NET BEL UNL PRU
//   NGF GER) — the countries the criteria register reads; the template's "shortlist" button selects exactly them.
const TAGS = ['GBR', 'RUS', 'FRA', 'USA', 'PRU', 'TUR', 'AUS', 'SPA', 'BRZ', 'SIC', 'POR', 'NET', 'BEL', 'NGF', 'GER', 'UNL'];
const SAMPLE = [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
function walk(runDir, isMod) {
  const dir = join(SES, runDir, 'save_summaries');
  const out = {};
  const EMP = isMod ? tierEmp : vanEmp;   // which ladder this arm's building keys live on
  for (const tag of TAGS) out[tag] = { gdp: {}, pop: {}, lab: {}, emp: {}, b2: {}, grp: {}, pw: {} };
  out._sector = { world: {}, tags: {} };  // [workers M, workers M, weekly VA £M] per year
  const seen = new Set();
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    // ⭐ ONE SUMMARY PER YEAR — the first (2026-10-02). On a quarterly-autosave batch this read all four and kept the LAST, so a
    //   "1935" figure was really October 1935's while every other reader takes January's.
    if (seen.has(y)) continue; seen.add(y);
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
        // every tier worker per column (emp) and the part on a rung 2+ eras behind the best rung this country staffs in the same
        // industry (b2 — the old rung beside its replacement; lib_era_cols countrySplit, the world page's EMP_B2 per tag)
        const s = ERA_COLS.countrySplit(c.buildings);
        out[tag].emp[y] = s.all.map(x => +(x / 1e6).toFixed(3));
        out[tag].b2[y] = s.b2.map(x => +(x / 1e6).toFixed(3));
        // the whole workforce outside the tier buildings, in groups (2026-11-15, lib_workforce_groups) — the second view of the selection's "who works where"
        out[tag].grp[y] = WG.groups(c).map(x => x == null ? null : +(x / 1e6).toFixed(3));
      }
    }
  }
  return out;
}
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
if (!argOf('--mod', null) || !argOf('--van', null)) { console.error('report_data2.mjs: --mod and --van required (fill_ledger.sh passes them; the old defaults named retired sessions, removed 2026-10-28)'); process.exit(2); }
const MODRUNS = argOf('--mod').split(',');
// ⭐ EVERY RUN, BOTH ARMS, ONE RULE (user, 2026-11-15). Until this day the mod side was the FIRST run alone (`flat = flatRuns[0]`, since the
//   2026-08-16 generalisation to many runs; the aggregation was never written) against the MEAN of the vanilla runs, so every multi-run report's
//   Shortlist page read one seed against a mean (F271's run 1 was Britain's poorest of ten). Now both arms go through agg():
//   - an ADDITIVE quantity (GDP, population, productive workers, workers by tier column, old-rung workers) is the mean over ALL the arm's runs,
//     a country absent from a run counting ZERO there — so a selection's sum is the mean of the selection's totals, and a formation
//     (Prussia → North German Federation → Germany, the Netherlands and Belgium → the United Netherlands) is not double-counted when its whole
//     chain is selected (the vanilla side used the mean over the runs where the tag existed, which counted each link of a chain in full);
//   - a SHARE (the labour percentages) is the population-weighted mean over the runs where the tag exists;
//   - a year with the tag in no run is absent (null), as before.
//   `n` per tag and year is how many runs held the tag; nRuns is the arm's run count.
const modRuns = MODRUNS.map(r => walk(r, true));
// --van <sess/run[,sess/run...]>: the vanilla-baseline run list (required since 2026-10-28)
const vanRuns = argOf('--van').split(',').map(r => walk(r, false));
function agg(runs) {
  const N = runs.length, o = {};
  const r3 = x => +x.toFixed(3);
  for (const tag of TAGS) {
    const d = o[tag] = { gdp: {}, pop: {}, pw: {}, lab: {}, emp: {}, b2: {}, grp: {}, n: {} };
    const yrs = new Set(); runs.forEach(r => Object.keys(r[tag].gdp).forEach(y => yrs.add(+y)));
    for (const y of [...yrs].sort((p, q) => p - q)) {
      const here = runs.filter(r => r[tag].gdp[y] != null);
      d.n[y] = here.length;
      d.gdp[y] = Math.round(here.reduce((t, r) => t + r[tag].gdp[y], 0) / N * 10) / 10;
      d.pop[y] = Math.round(here.reduce((t, r) => t + (r[tag].pop[y] || 0), 0) / N * 100) / 100;
      const pw = here.filter(r => r[tag].pw[y] != null);
      if (pw.length) d.pw[y] = +(pw.reduce((t, r) => t + r[tag].pw[y], 0) / N).toFixed(2);
      const lab = here.filter(r => r[tag].lab[y] && r[tag].pop[y]);
      if (lab.length) { const W = lab.reduce((t, r) => t + r[tag].pop[y], 0);
        d.lab[y] = [0, 1].map(i => +(lab.reduce((t, r) => t + r[tag].pop[y] * r[tag].lab[y][i], 0) / W).toFixed(1)); }
      for (const k of ['emp', 'b2', 'grp']) {
        const rows = here.map(r => r[tag][k][y]).filter(Boolean);
        // a group a run could not read (null: a summary before v14) stays null for the year
        if (rows.length) d[k][y] = rows[0].map((_, i) => rows.some(row => row[i] == null) ? null : r3(rows.reduce((t, row) => t + row[i], 0) / N));
      }
    }
  }
  return o;
}
const mod = agg(modRuns), van = agg(vanRuns);
// sector (tier-equivalent buildings: workers + weekly VA), world and per tag: the mean over ALL the arm's runs, a tag absent from a run
// counting zero there (as agg). Shape [workers M, workers M, weekly VA £M] — the renderer reads value/workers, so slot 2 repeats slot 1 by
// construction (VA is measured directly since summaries v6, both arms).
const meanSector = runs => {
  const o = { world: {}, tags: {} }, N = runs.length;
  const acc = (dst, y, row) => { const a = (dst[y] ||= [0, 0, 0]); a[0] += row[0]; a[1] += row[1]; a[2] += row[2]; };
  for (const r of runs) {
    for (const [y, row] of Object.entries(r._sector.world)) acc(o.world, y, row);
    for (const [tg, ys] of Object.entries(r._sector.tags)) for (const [y, row] of Object.entries(ys)) acc((o.tags[tg] ||= {}), y, row);
  }
  const fin = dst => { for (const y in dst) dst[y] = dst[y].map(v => +(v / N).toFixed(3)); };
  fin(o.world); for (const tg in o.tags) fin(o.tags[tg]);
  return o;
};
const sector = { mod: meanSector(modRuns), van: meanSector(vanRuns) };
// anomaly flags, per run, then counted over the arm's runs: "civil war 1886 in 2 of 10 runs" — a notch in a mean is a share of the runs
function runFlags(r, tag) {
  const yrs = Object.keys(r[tag].gdp).map(Number).sort((a, b) => a - b), fl = [];
  if (!yrs.length) return [['absent', null]];
  if (yrs[yrs.length - 1] < 1935) fl.push(['dissolved', yrs[yrs.length - 1]]);
  if (yrs[0] > 1837) fl.push(['formed', yrs[0]]);
  let maxUp = 0, upY = 0, maxDn = 0, dnY = 0;
  for (let i = 1; i < yrs.length; i++) {
    if (yrs[i] - yrs[i - 1] !== 1) continue;
    const p0 = r[tag].pop[yrs[i - 1]], p1 = r[tag].pop[yrs[i]];
    if (!p0 || !p1) continue;
    const d = (p1 - p0) / p0;
    if (d > maxUp) { maxUp = d; upY = yrs[i]; }
    if (d < maxDn) { maxDn = d; dnY = yrs[i]; }
  }
  if (maxDn < -0.25) fl.push([maxUp > 0.25 ? 'civil war' : 'collapse', dnY]);
  if (maxUp > 0.25 && maxDn >= -0.25) fl.push(['annexation-scale jump', upY]);
  return fl;
}
const countFlags = (runs, tag, prefix) => {
  const by = {};
  for (const r of runs) for (const [k, y] of runFlags(r, tag)) (by[k] ||= []).push(y);
  return Object.entries(by).map(([k, ys]) => prefix + k + ' in ' + ys.length + ' of ' + runs.length + ' runs' +
    (ys[0] != null ? ' (' + [...new Set(ys)].sort((a, b) => a - b).join(', ') + ')' : ''));
};
const flags = {};
for (const tag of TAGS) flags[tag] = countFlags(modRuns, tag, '').concat(countFlags(vanRuns, tag, 'van: ').filter(f => /dissolved|absent/.test(f)));
writeFileSync(join(OUT, 'report_data2.json'), JSON.stringify({ mod, van, nMod: modRuns.length, nVan: vanRuns.length, flags, sector }));
for (const tag of TAGS) console.log(tag, JSON.stringify(flags[tag]));
if (WG.missing.size) console.log('⚠ methods with no employment entry (counted as 0): ' + [...WG.missing].join(' '));
console.log('runs: mod ' + modRuns.length + ', vanilla ' + vanRuns.length + ' · bytes:', readFileSync(join(OUT, 'report_data2.json')).length);
