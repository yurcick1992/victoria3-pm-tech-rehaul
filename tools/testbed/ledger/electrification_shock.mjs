#!/usr/bin/env node
// ⭐⭐ THE ELECTRIFICATION SHOCK — country by country, does discovering electricity cost anything?
//
// Written 2026-09-20 (user: "check, country by country, that there's no significant economic shock after discovering
// electricity ... do all Urban Centers switch immediately? Do other industries switch and allow temporary shortages if
// Urban Center electricity doesn't cover it?"). The question exists because BALANCE_FRAMEWORK §10.43 makes the urban
// centre's electric-streetlights method a SOURCE (+1 electricity, 2 coal, 250 ENGINEERS) where vanilla makes it a SINK
// (3 electricity in, 200 laborers + 50 engineers) — so at `electrical_generation` a country's urban centres could flip
// from consuming to producing, and everything downstream that wants electricity arrives around the same technology.
//
// Read-only, off the yearly save summaries (v8+: per-country `technologies_held`, and per-building-type `pms`, the
// pm key -> LEVELS map).
//
// ⚠⚠ THE TRAP THIS SCRIPT EXISTS TO AVOID, and which its first version fell into: "GDP growth in the five years after
//    adoption, against that country's own norm" is dominated by WARS AND ANNEXATIONS, not by electrification. Its worst
//    offenders were -99% years belonging to conquered countries and civil-war tags. A raw window statistic cannot answer
//    the question. So:
//      · a PLACEBO — the identical statistic computed at OFFSET years (the same country, the same window width, a
//        different date). Electrification is a shock only if the adoption window is WORSE than the placebo windows.
//      · a SURVIVORSHIP filter — a country whose population falls by more than `--max-pop-drop` across the window, or
//        whose GDP goes to zero, was conquered or partitioned; it is excluded and counted, not scored.
//
// usage: node tools/testbed/ledger/electrification_shock.mjs --session <stamp>[:<setup>] [--tech electrical_generation]
//        [--window 5] [--min-gdp 1000000] [--max-pop-drop 0.15] [--placebo -20,-12,12,20] [--top 10]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SESSION = arg('--session', '');
if (!SESSION) { console.error('usage: --session <stamp>[:<setup>]'); process.exit(2); }
const [STAMP, SETUP] = SESSION.split(':');
const TECH = arg('--tech', 'electrical_generation');
const W = +arg('--window', 5);
const TOP = +arg('--top', 10);
const MINGDP = +arg('--min-gdp', 1000000);
const MAXPOPDROP = +arg('--max-pop-drop', 0.15);
const PLACEBO = arg('--placebo', '-20,-12,12,20').split(',').map(Number);

const root = join(REPO, 'tools/testbed/sessions', STAMP);
if (!existsSync(root)) { console.error('no such session: ' + root); process.exit(2); }
const runs = readdirSync(root).filter(d => d.startsWith('run') && (!SETUP || d.includes(SETUP))).sort();

const UC = 'building_urban_center';
const ELEC_PM = 'pm_electric_streetlights', GAS_PM = 'pm_gas_streetlights', NONE_PM = 'pm_no_street_lighting';
const median = a => { const b = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };

const byRun = [];
for (const r of runs) {
  const d = join(root, r, 'save_summaries');
  if (!existsSync(d)) continue;
  const years = {};
  for (const f of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    let j;
    try { j = JSON.parse(gunzipSync(readFileSync(join(d, f)))); } catch { continue; }
    const y = +String((j.provenance || {}).date || '').split('.')[0];
    if (!y) continue;
    const per = {};
    for (const [tag, c] of Object.entries(j.countries || {})) {
      const held = Array.isArray(c.technologies_held) ? c.technologies_held : null;
      const uc = (c.buildings || {})[UC] || null;
      const pms = (uc && uc.pms) ? uc.pms : {};
      const ps = c.pop_statistics || {};
      per[tag] = {
        gdp: c.gdp || 0,
        pop: ps.population || ps.population_total || (c.strata ? Object.values(c.strata).reduce((a, b) => a + (b || 0), 0) : 0),
        hasTech: held ? held.includes(TECH) : null,
        e: pms[ELEC_PM] || 0, g: pms[GAS_PM] || 0, n: pms[NONE_PM] || 0,
      };
    }
    years[y] = per;
  }
  if (Object.keys(years).length) byRun.push({ run: r, years });
}
if (!byRun.length) { console.error('no usable summaries'); process.exit(2); }

console.log(`ELECTRIFICATION SHOCK — ${STAMP}${SETUP ? ':' + SETUP : ''} · ${byRun.length} run(s) · technology "${TECH}" · window ±${W}y`);
console.log(`Survivorship filter: a country losing more than ${(100 * MAXPOPDROP).toFixed(0)}% of its population across a window is excluded (conquest, not electrification).`);
console.log(`Placebo offsets: ${PLACEBO.join(', ')} years. Electrification is a shock only if the ADOPTION window is worse than these.\n`);

// one country's worst growth year inside a window starting at `y0`, and whether the window is usable
function windowStat(at, y0, w) {
  const g0 = at(y0), gW = at(y0 + w);
  if (!g0 || !gW || !(g0.gdp > 0) || !(gW.gdp > 0)) return null;
  if (g0.pop > 0 && gW.pop > 0 && (gW.pop / g0.pop) < (1 - MAXPOPDROP)) return { conquered: true };
  let worst = null;
  for (let k = 0; k <= w; k++) {
    const a = at(y0 + k - 1), b = at(y0 + k);
    if (!a || !b || !(a.gdp > 0) || !(b.gdp > 0)) continue;
    const gr = b.gdp / a.gdp - 1;
    if (worst == null || gr < worst.gr) worst = { gr, y: y0 + k };
  }
  return worst ? { worst, ratio: gW.gdp / g0.gdp } : null;
}

const allRows = [];
for (const { run, years } of byRun) {
  const ys = Object.keys(years).map(Number).sort((a, b) => a - b);
  const tags = new Set();
  for (const y of ys) for (const t of Object.keys(years[y])) tags.add(t);
  let noTech = 0, tooSmall = 0, conquered = 0;
  const rows = [];
  for (const tag of tags) {
    const at = y => (years[y] ? years[y][tag] : null) || null;
    const adopt = ys.find(y => { const p = at(y); return p && p.hasTech === true; });
    if (!adopt) { noTech++; continue; }
    const a0 = at(adopt);
    if (!a0 || a0.gdp < MINGDP) { tooSmall++; continue; }
    const norm = (() => {
      const g = [];
      for (let i = 1; i < ys.length; i++) {
        const y0 = ys[i - 1], y1 = ys[i];
        if (y1 < 1850 || y1 > 1930) continue;
        const a = at(y0), b = at(y1);
        if (a && b && a.gdp > 0 && b.gdp > 0) g.push(b.gdp / a.gdp - 1);
      }
      return median(g);
    })();
    if (norm == null) continue;
    const real = windowStat(at, adopt, W);
    if (!real || real.conquered) { conquered++; continue; }
    const plac = [];
    for (const off of PLACEBO) {
      const s = windowStat(at, adopt + off, W);
      if (s && !s.conquered && s.worst) plac.push(s.worst.gr - norm);
    }
    const uc = {};
    for (let k = 0; k <= 30; k++) { const p = at(adopt + k); if (p) uc[k] = p; }
    rows.push({
      tag, adopt, norm, gdp: a0.gdp,
      dev: real.worst.gr - norm, worstGr: real.worst.gr, worstY: real.worst.y, ratio: real.ratio,
      placeboDev: plac.length ? median(plac) : null, nPlacebo: plac.length, uc,
    });
  }
  allRows.push({ run, rows, noTech, tooSmall, conquered, years, ys });
}

console.log('=== 1. DO URBAN CENTRES SWITCH? — electric share of the streetlight method group, by years since the technology ===');
console.log('(share = electric ÷ (electric + gas + unlit) levels; median over the countries that hold the technology)');
console.log('run                    n      +0y   +2y   +5y  +10y  +15y  +20y  +25y  +30y    countries EVER above 10%');
for (const { run, rows, noTech, tooSmall, conquered } of allRows) {
  const cols = [0, 2, 5, 10, 15, 20, 25, 30].map(k => {
    const sh = rows.map(r => { const p = r.uc[k]; if (!p) return null; const tot = p.e + p.g + p.n; return tot > 0 ? p.e / tot : null; }).filter(x => x != null);
    return sh.length ? (100 * median(sh)).toFixed(0) + '%' : '—';
  });
  const ever = rows.filter(r => Object.values(r.uc).some(p => { const tot = p.e + p.g + p.n; return tot > 0 && p.e / tot > 0.10; })).length;
  console.log(run.padEnd(22), String(rows.length).padStart(4), ' ', cols.map(s => s.padStart(5)).join(' '), '  ', `${ever} of ${rows.length}`, `  (${noTech} never got the tech, ${tooSmall} too small, ${conquered} conquered)`);
}

console.log('\n=== 2. IS THERE A SHOCK? — the adoption window against PLACEBO windows of the same country ===');
for (const { run, rows } of allRows) {
  const withP = rows.filter(r => r.placeboDev != null);
  console.log(`  ${run}: ${rows.length} countries scored, ${withP.length} with a placebo`);
  console.log(`     worst-year deviation from own norm — ADOPTION window : ${(100 * median(rows.map(r => r.dev))).toFixed(1)} pp`);
  console.log(`     worst-year deviation from own norm — PLACEBO windows : ${(100 * median(withP.map(r => r.placeboDev))).toFixed(1)} pp`);
  const diff = withP.map(r => r.dev - r.placeboDev);
  const worseN = diff.filter(x => x < 0).length;
  console.log(`     ADOPTION minus PLACEBO (negative = electrification is worse): median ${(100 * median(diff)).toFixed(1)} pp · worse in ${worseN} of ${withP.length} (${(100 * worseN / withP.length).toFixed(0)}%)`);
  console.log(`     GDP ${W}y after adoption ÷ at adoption: median ×${(median(rows.map(r => r.ratio)) || 0).toFixed(2)}`);
  const worst = withP.filter(r => r.dev - r.placeboDev < 0).sort((a, b) => (a.dev - a.placeboDev) - (b.dev - b.placeboDev)).slice(0, TOP);
  if (worst.length) console.log('     worst vs their own placebo: ' + worst.map(r => `${r.tag}@${r.adopt} ${(100 * (r.dev - r.placeboDev)).toFixed(0)}pp`).join(' · '));
}

console.log('\n=== 3. THE CHAIN — urban-centre streetlight levels world-wide, by year ===');
for (const { run, years, ys, rows } of allRows) {
  const adoptYears = rows.map(r => r.adopt).sort((a, b) => a - b);
  const first = adoptYears[0], med = median(adoptYears);
  console.log(`  ${run}: first adopter ${first}, median adopter ${med}`);
  console.log('    year     electric      gas    unlit    electric share');
  for (const y of ys) {
    if (y < first - 2 || y > 1936) continue;
    if ((y - (first - 2)) % 5) continue;
    let e = 0, g = 0, n = 0;
    for (const p of Object.values(years[y])) { e += p.e; g += p.g; n += p.n; }
    const tot = e + g + n;
    console.log('    ' + String(y).padEnd(8), String(Math.round(e)).padStart(9), String(Math.round(g)).padStart(8), String(Math.round(n)).padStart(8), '   ' + (tot > 0 ? (100 * e / tot).toFixed(1) + '%' : '—'));
  }
}
