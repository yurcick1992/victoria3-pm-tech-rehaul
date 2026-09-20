#!/usr/bin/env node
// ⭐ A REGION'S GDP, DEFINED BY TERRITORY RATHER THAN BY TAG (user-asked 2026-09-20: "examine and explain Chinese GDP swings").
//
// ⚠⚠ THE TRAP THIS EXISTS TO AVOID: a TAG's GDP series is dominated by territory changing hands. Qing China fragments,
//   loses states to European powers and to released warlord tags, and may be partly reunified — so "CHI's GDP halved" is
//   usually a border moving, not an economy shrinking. The same mistake ruined the first cut of electrification_shock.mjs.
//   So the region is defined ONCE, from the states a seed tag owns at an anchor year, and thereafter it is WHOEVER OWNS
//   THOSE STATES. Internal transfers then cancel and only real growth or real conquest-by-outsiders moves the total.
//
// Per year it reports, for the region: total GDP, total population, GDP per head, the number of tags holding any of it,
// the share still held by the seed tag, and the share held by tags OUTSIDE the region's own set at the anchor (i.e. taken
// by foreign powers). A swing in GDP that is NOT matched by a swing in GDP per head is a border, not an economy.
//
// usage: node tools/testbed/ledger/region_gdp.mjs --session <stamp>[:<setup>] [--seed CHI] [--anchor 1836]
//        [--runs run001] [--per-tag 6]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const [STAMP, SETUP] = arg('--session', '').split(':');
if (!STAMP) { console.error('usage: --session <stamp>[:<setup>] [--seed CHI]'); process.exit(2); }
const SEED = arg('--seed', 'CHI');
const ANCHOR = +arg('--anchor', 1836);
const PERTAG = +arg('--per-tag', 6);
const ONLY = arg('--runs', '');

const root = join(REPO, 'tools/testbed/sessions', STAMP);
const runs = readdirSync(root).filter(d => d.startsWith('run') && (!SETUP || d.includes(SETUP)) && (!ONLY || ONLY.split(',').some(o => d.includes(o)))).sort();

for (const r of runs) {
  const d = join(root, r, 'save_summaries');
  if (!existsSync(d)) continue;
  const years = {};
  for (const f of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    let j;
    try { j = JSON.parse(gunzipSync(readFileSync(join(d, f)))); } catch { continue; }
    const y = +String((j.provenance || {}).date || '').split('.')[0];
    if (!y) continue;
    years[y] = j;
  }
  const ys = Object.keys(years).map(Number).sort((a, b) => a - b);
  if (!ys.length) continue;

  // the region = the states the seed tag owns at the anchor year (or the earliest year we have)
  const base = years[ANCHOR] || years[ys[0]];
  const REGION = new Set();
  for (const [sid, s] of Object.entries(base.states || {})) if (s.country === SEED) REGION.add(sid);
  if (!REGION.size) { console.log(`${r}: seed ${SEED} owns no states at ${ANCHOR} — nothing to measure`); continue; }

  console.log(`\n=== ${r} — the region is the ${REGION.size} states ${SEED} owned at ${Object.keys(years).includes(String(ANCHOR)) ? ANCHOR : ys[0]} ===`);
  console.log('⚠ GDP is apportioned to a state by that state’s share of its OWNER’s infrastructure, the only per-state weight a summary carries.');
  console.log('  So the levels are approximate; the SHAPE and the ownership columns are what the question turns on.\n');
  console.log('year    region GDP £M   pop M   GDP/head   tags/markets      seed keeps   held by outsiders   biggest holders');
  const anchorHolders = new Set([SEED]);
  for (const y of ys) {
    if (y % 5 && y !== ys[ys.length - 1]) continue;
    const j = years[y];
    // per-owner weight of the region: a state's share of its owner's total infrastructure
    const ownerTotal = {}, ownerRegion = {};
    for (const [sid, s] of Object.entries(j.states || {})) {
      const w = (s.infrastructure || 0) + 1;    // +1 so a zero-infrastructure state still counts
      ownerTotal[s.country] = (ownerTotal[s.country] || 0) + w;
      if (REGION.has(sid)) ownerRegion[s.country] = (ownerRegion[s.country] || 0) + w;
    }
    let gdp = 0, pop = 0;
    const holders = [];
    for (const [tag, w] of Object.entries(ownerRegion)) {
      const c = (j.countries || {})[tag];
      if (!c) continue;
      const share = w / (ownerTotal[tag] || w);
      const g = (c.gdp || 0) * share;
      const ps = c.pop_statistics || {};
      const p = ((ps.population_lower_strata || 0) + (ps.population_middle_strata || 0) + (ps.population_upper_strata || 0)) * share;
      gdp += g; pop += p;
      holders.push({ tag, g, mkt: c.market });
    }
    holders.sort((a, b) => b.g - a.g);
    const markets = new Set(holders.map(h => h.mkt).filter(x => x != null)).size;
    const seedShare = gdp > 0 ? (holders.find(h => h.tag === SEED)?.g || 0) / gdp : 0;
    // "outsiders" = tags that held none of the region at the anchor year
    if (y === ys[0] || y === ANCHOR) for (const h of holders) anchorHolders.add(h.tag);
    const outs = gdp > 0 ? holders.filter(h => !anchorHolders.has(h.tag)).reduce((a, h) => a + h.g, 0) / gdp : 0;
    console.log(String(y).padEnd(7),
      String(Math.round(gdp / 1e6)).padStart(12), String((pop / 1e6).toFixed(0)).padStart(8),
      (pop > 0 ? (gdp / pop).toFixed(1) : '—').padStart(10), (holders.length + '/' + markets).padStart(16),
      ((100 * seedShare).toFixed(0) + '%').padStart(12), ((100 * outs).toFixed(0) + '%').padStart(18),
      '   ' + holders.slice(0, PERTAG).map(h => `${h.tag} ${Math.round(h.g / 1e6)}`).join(' · '));
  }
}
