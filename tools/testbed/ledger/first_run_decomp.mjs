#!/usr/bin/env node
// THE FIRST-RUN DECOMPOSITION (user-ruled 2026-09-02: report after each arm's first run, before the batch
// completes): GDP = population × (productive workers per capita) × (GDP per productive worker), for the
// WORLD and for the SHORTLIST (GBR USA FRA NET BEL PRU GER pooled), against the vanilla n=16 baseline and
// any reference arms, at the ledger's sample years. Same definitions as advanced_panel.mjs:
//   productive = population_salaried_workforce − population_government_workforce − population_military_workforce
//   population = Σ strata (workforce + dependents; equals Σ professions, verified)
//   world      = the save's own world.gdp / world.population; productive summed over every country
// A ratio is printed WITH both its terms (numerator, denominator), per the repo's ratio rule.
//
//   node tools/testbed/ledger/first_run_decomp.mjs --arm <session>[:<setup>] [--arm …] --van <session>
//        [--years 1860,1880,1900,1920,1935]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SES = join(HERE, '..', 'sessions');
const argv = process.argv.slice(2);
const arms = [], vans = []; let YEARS = [1860, 1880, 1900, 1920, 1935];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--arm') arms.push(argv[++i]);
  else if (argv[i] === '--van') vans.push(argv[++i]);
  else if (argv[i] === '--years') YEARS = argv[++i].split(',').map(Number);
}
if (!arms.length) { console.error('usage: --arm <session>[:<setup>] [--van <session>] [--years a,b,c]'); process.exit(1); }
const SHORT = new Set(['GBR', 'USA', 'FRA', 'NET', 'BEL', 'PRU', 'GER']);
const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function runDirs(spec) {
  const [session, setup] = spec.split(':');
  const root = join(SES, session);
  return readdirSync(root).filter(d => /^run\d+/.test(d) && statSync(join(root, d)).isDirectory() && (!setup || d.endsWith('_' + setup)))
    .map(d => ({ session, setup, dir: join(root, d), name: d }));
}
// per run: year -> { world: {gdp,pop,prod}, short: {...} }; a run counts only for the years it reached
function readRun(r) {
  const out = {};
  const sdir = join(r.dir, 'save_summaries'); if (!existsSync(sdir)) return out;
  const seen = new Set();
  for (const f of readdirSync(sdir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sdir, f))).toString('utf8')); } catch { continue; }
    const date = j.provenance && j.provenance.date; if (!date) continue;
    const y = +String(date).split('.')[0]; if (!YEARS.includes(y) || seen.has(y)) continue; seen.add(y);
    const W = { gdp: +j.world.gdp || 0, pop: +j.world.population || 0, prod: 0 }, S = { gdp: 0, pop: 0, prod: 0 };
    for (const [tag, c] of Object.entries(j.countries || {})) {
      const p = c.pop_statistics || {};
      const prod = (+p.population_salaried_workforce || 0) - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0);
      const pop = Object.values(c.strata || {}).reduce((a, b) => a + b, 0);
      W.prod += prod;
      if (SHORT.has(tag)) { S.gdp += +c.gdp || 0; S.pop += pop; S.prod += prod; }
    }
    out[y] = { world: W, short: S };
  }
  return out;
}
const groups = [...vans.map(s => ({ label: 'vanilla ' + s.split('_')[0], spec: s, isVan: true })), ...arms.map(s => ({ label: s, spec: s, isVan: false }))];
for (const g of groups) { g.runs = runDirs(g.spec).map(r => ({ ...r, data: readRun(r) })); }
const V = groups.find(g => g.isVan);
const fmt = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '  —  ';
console.log('GDP = population × productive workers per capita × GDP per productive worker  (productive = salaried − government − military)');
for (const scope of ['world', 'short']) {
  console.log(`\n=== ${scope === 'world' ? 'WORLD' : 'SHORTLIST GBR/USA/FRA/NET/BEL/PRU/GER pooled'} ===`);
  console.log('year  arm                                   run(s)   GDP £M     pop M   prod/capita  £GDP/prod-worker   | ÷vanilla: GDP   prod/cap   £/worker');
  for (const y of YEARS) {
    const vRows = V ? V.runs.map(r => r.data[y]).filter(Boolean).map(d => d[scope]) : [];
    const vG = med(vRows.map(d => d.gdp)), vPC = med(vRows.map(d => d.prod / d.pop)), vPW = med(vRows.map(d => d.gdp / d.prod));
    for (const g of groups) {
      const rows = g.runs.map(r => ({ name: r.name, d: r.data[y] && r.data[y][scope] })).filter(r => r.d);
      if (!rows.length) continue;
      const line = (name, d, n) => {
        const pc = d.prod / d.pop, pw = d.gdp / d.prod;
        console.log(`${y}  ${(g.label + (n ? ' [' + n + ']' : '')).slice(0, 37).padEnd(38)} ${String(rows.length).padStart(5)}  ${fmt(d.gdp / 1e6, 0).padStart(8)}  ${fmt(d.pop / 1e6, 0).padStart(7)}   ${fmt(pc, 4).padStart(9)}    ${fmt(pw, 1).padStart(12)}   | ${g.isVan ? '     —' : fmt(d.gdp / vG).padStart(6) + '×'}   ${g.isVan ? '   —' : fmt(pc / vPC).padStart(6) + '×'}   ${g.isVan ? '   —' : fmt(pw / vPW).padStart(6) + '×'}`);
      };
      if (g.isVan || rows.length === 1) line(g.label, g.isVan ? { gdp: vG, pop: med(vRows.map(d => d.pop)), prod: med(vRows.map(d => d.prod)) } : rows[0].d, g.isVan ? 'median' : rows[0].name);
      else { const m = { gdp: med(rows.map(r => r.d.gdp)), pop: med(rows.map(r => r.d.pop)), prod: med(rows.map(r => r.d.prod)) }; line(g.label, m, 'median'); for (const r of rows) line(g.label, r.d, r.name); }
    }
  }
}
console.log('\n⚠ different nights unless stated: ratios travel, absolute £ do not. A run appears only for the years it reached.');
