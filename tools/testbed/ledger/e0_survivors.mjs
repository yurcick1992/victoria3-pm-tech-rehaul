#!/usr/bin/env node
// ⭐ WHICH ERA-0 RUNGS ARE STILL ALIVE *AND* PROFITABLE, PER MARKET (user-asked 2026-09-20:
// "for GBR/USA/GER/NET/BEL markets separately, are there any noticeable number of e0 industries with staff of at least
// half of a level (usually 2500 workers) AND making profits (at least +10%)?")
//
// The design wants the 1836 rung DEAD in the developed world. A rung that is merely small is not the failure; a rung that
// is BOTH staffed and comfortably profitable is, because it has no reason to go away. So both thresholds must bind at once.
//
// Grouped by MARKET, not by country: the summaries carry a numeric `market` id per country, and a market is the unit
// prices and supply are actually set in — a British-market Indian textile mill competes with a British one. A market is
// named by its largest member by GDP, so "GBR" here means the British market including its subjects.
//
// margin = profit ÷ (va_out − profit), F92's identity — the game's own profitability, no wage model.
// ⚠ `staffing` counts STAFFED LEVELS, not people; the user's "half a level" threshold is therefore staffing ≥ 0.5,
//   which at the usual 5,000 per level is about 2,500 workers.
// ⚠ `disabled` industries are skipped (L27); the era is the rung's own `era` from the run's own config, never an index.
//
// usage: node tools/testbed/ledger/e0_survivors.mjs --session <stamp>[:<setup>] --config <book>
//        [--year 1935] [--markets GBR,USA,GER,NET,BEL] [--min-staff 0.5] [--min-margin 0.10] [--era 0]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const [STAMP, SETUP] = arg('--session', '').split(':');
if (!STAMP) { console.error('usage: --session <stamp>[:<setup>] --config <book>'); process.exit(2); }
const CFG = arg('--config', 'config/mod_config.json');
const YEAR = +arg('--year', 1935);
const WANT = arg('--markets', 'GBR,USA,GER,NET,BEL').split(',');
const MINSTAFF = +arg('--min-staff', 0.5);
const MINMARGIN = +arg('--min-margin', 0.10);
const ERA = +arg('--era', 0);

const cfg = JSON.parse(readFileSync(join(REPO, CFG), 'utf8'));
const RUNG = {};
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  for (const t of ind.tiers || []) if (t.era === ERA) RUNG[t.key] = { ind: ind.id, era: t.era };
}

const root = join(REPO, 'tools/testbed/sessions', STAMP);
const runs = readdirSync(root).filter(d => d.startsWith('run') && (!SETUP || d.includes(SETUP))).sort();

for (const r of runs) {
  const d = join(root, r, 'save_summaries');
  if (!existsSync(d)) continue;
  let hit = null;
  for (const f of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    let j;
    try { j = JSON.parse(gunzipSync(readFileSync(join(d, f)))); } catch { continue; }
    if (+String((j.provenance || {}).date || '').split('.')[0] === YEAR) { hit = j; break; }
  }
  if (!hit) { console.log(`${r}: no summary at ${YEAR}`); continue; }

  // markets: id -> { members, gdp, leader }
  const mkt = {};
  for (const [tag, c] of Object.entries(hit.countries || {})) {
    const id = c.market;
    if (id == null) continue;
    const m = mkt[id] || (mkt[id] = { id, members: [], gdp: 0, leader: null, leaderGdp: -1, rungs: {} });
    m.members.push(tag); m.gdp += c.gdp || 0;
    if ((c.gdp || 0) > m.leaderGdp) { m.leaderGdp = c.gdp || 0; m.leader = tag; }
    for (const [key, b] of Object.entries(c.buildings || {})) {
      if (!RUNG[key]) continue;
      const a = m.rungs[key] || (m.rungs[key] = { lv: 0, st: 0, prof: 0, vo: 0 });
      a.lv += b.levels || 0; a.st += b.staffing || 0; a.prof += b.profit || 0; a.vo += b.va_out || 0;
    }
  }

  console.log(`\n=== ${r} · ${YEAR} · e${ERA} rungs that are BOTH staffed ≥ ${MINSTAFF} level(s) AND earning ≥ ${(100 * MINMARGIN).toFixed(0)}% ===`);
  console.log('(margin = profit ÷ (va_out − profit); a market is named by its largest member by GDP and includes its subjects)\n');
  for (const want of WANT) {
    const m = Object.values(mkt).find(x => x.leader === want);
    if (!m) { console.log(`  ${want} market — not found (no country leads a market with that tag at ${YEAR})`); continue; }
    const rows = [];
    let totSt = 0, totLv = 0;
    for (const [key, a] of Object.entries(m.rungs)) {
      totSt += a.st; totLv += a.lv;
      const margin = (a.vo - a.prof) > 0 ? a.prof / (a.vo - a.prof) : null;
      if (a.st >= MINSTAFF && margin != null && margin >= MINMARGIN) rows.push({ ind: RUNG[key].ind, st: a.st, lv: a.lv, margin });
    }
    rows.sort((x, y) => y.st - x.st);
    const memberList = m.members.length > 6 ? m.members.slice(0, 6).join(',') + ` +${m.members.length - 6}` : m.members.join(',');
    console.log(`  ${want} MARKET (${m.members.length} member(s): ${memberList}) — e${ERA} total ${totLv.toFixed(0)} levels, ${totSt.toFixed(1)} staffed`);
    if (!rows.length) { console.log(`     NONE pass both thresholds.\n`); continue; }
    console.log(`     ${rows.length} rung(s) pass BOTH:`);
    for (const x of rows) console.log(`       ${x.ind.padEnd(13)} staffed ${x.st.toFixed(2).padStart(7)} lv (~${Math.round(x.st * 5000).toLocaleString('en-US')} workers)   margin ${(100 * x.margin).toFixed(0).padStart(4)}%   of ${x.lv.toFixed(0)} built`);
    console.log('');
  }
}
