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
// ⭐⭐ IT REPORTS TRUE PROFIT IN £ (user-ruled 2026-09-20: *"in reports, always report true profits, not margins"*).
// `profit` is the game's own weekly bottom line for that rung in that market; the annualised figure (×52) is beside it.
// The MARGIN is an optional second column and is F150's REPAIRED identity, not F92's:
//     margin = profit ÷ (R − profit),   R = va_out × (the rung's output price in this market ÷ its base price)
// because `va_out` is priced at BASE cost and `profit` at MARKET — the old ratio mixed the two, and the better the
// mod's price decline works the more wrong it got. It needs this market's prices; where markets.tsv has none (an
// uninstrumented market), the margin column reads "—" and the PROFIT still reports. See tools/lib_wage_model.mjs.
// ⚠ `staffing` counts STAFFED LEVELS, not people; the user's "half a level" threshold is therefore staffing ≥ 0.5,
//   which at the usual 5,000 per level is about 2,500 workers.
// ⚠ `disabled` industries are skipped (L27); the era is the rung's own `era` from the run's own config, never an index.
//
// usage: node tools/testbed/ledger/e0_survivors.mjs --session <stamp>[:<setup>] --config <book>
//        [--year 1935] [--markets GBR,USA,GER,NET,BEL,UNL] [--min-staff 0.5] [--min-margin 0.10] [--era 0]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { MARKET_NAMES } from './lib_markets.mjs';
import { trueMargin } from '../../lib_wage_model.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const [STAMP, SETUP] = arg('--session', '').split(':');
if (!STAMP) { console.error('usage: --session <stamp>[:<setup>] --config <book>'); process.exit(2); }
const CFG = arg('--config', 'config/mod_config.json');
const YEAR = +arg('--year', 1935);
const WANT = arg('--markets', 'GBR,USA,GER,NET,BEL,UNL').split(',');
const MINSTAFF = +arg('--min-staff', 0.5);
const MINMARGIN = +arg('--min-margin', 0.10);
const ERA = +arg('--era', 0);

const cfg = JSON.parse(readFileSync(join(REPO, CFG), 'utf8'));
const RUNG = {};
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  for (const t of ind.tiers || []) if (t.era === ERA) RUNG[t.key] = { ind: ind.id, era: t.era, good: t.output_good || ind.output_good };
}
const BASE = Object.fromEntries(readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));

const root = join(REPO, 'tools/testbed/sessions', STAMP);
const runs = readdirSync(root).filter(d => d.startsWith('run') && (!SETUP || d.includes(SETUP))).sort();
const gbp = x => (x < 0 ? '-£' : '£') + Math.abs(Math.round(x)).toLocaleString('en-US');

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

  // this run's market prices at YEAR, by market display NAME (the telemetry writes GetNameNoFormatting)
  const PRICE = {};
  const mf = join(root, r, 'markets.tsv');
  if (existsSync(mf)) for (const line of readFileSync(mf, 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (c.length < 8) continue;
    if (+String(c[1]).split('.')[0] !== YEAR) continue;
    const p = +c[7]; if (p > 0) (PRICE[c[2]] ||= {})[c[4]] = p;
  }

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
  console.log('PROFIT is the game\'s own weekly bottom line, in £ (annual = ×52). The margin beside it is F150\'s repaired identity');
  console.log('profit ÷ (R − profit) with R = va_out re-priced to this market; "—" means the market is not instrumented, not that it is zero.');
  console.log('A market is named by its largest member by GDP and includes its subjects.\n');
  for (const want of WANT) {
    const m = Object.values(mkt).find(x => x.leader === want);
    if (!m) { console.log(`  ${want} market — not found (no country leads a market with that tag at ${YEAR})`); continue; }
    const price = (MARKET_NAMES[want] || []).map(n => PRICE[n]).find(Boolean) || null;
    const rows = [];
    let totSt = 0, totLv = 0, totProf = 0;
    for (const [key, a] of Object.entries(m.rungs)) {
      totSt += a.st; totLv += a.lv; totProf += a.prof;
      const g = RUNG[key].good;
      const mult = price && price[g] > 0 && BASE[g] > 0 ? price[g] / BASE[g] : null;
      const margin = mult != null ? trueMargin(a.prof, a.vo * mult) : null;
      // the profit test is the ruled headline; the margin test binds only where a margin exists
      const pass = a.st >= MINSTAFF && a.prof > 0 && (margin == null || margin >= MINMARGIN);
      if (pass) rows.push({ ind: RUNG[key].ind, st: a.st, lv: a.lv, margin, prof: a.prof, priced: mult != null });
    }
    rows.sort((x, y) => y.prof - x.prof);
    const memberList = m.members.length > 6 ? m.members.slice(0, 6).join(',') + ` +${m.members.length - 6}` : m.members.join(',');
    console.log(`  ${want} MARKET (${m.members.length} member(s): ${memberList}) — e${ERA} total ${totLv.toFixed(0)} levels, ${totSt.toFixed(1)} staffed, profit ${gbp(totProf)}/wk (${gbp(totProf * 52)}/yr)`
      + (price ? '' : '   ⚠ no market prices in this session — margins unavailable'));
    if (!rows.length) { console.log(`     NONE pass both thresholds.\n`); continue; }
    console.log(`     ${rows.length} rung(s) pass BOTH (ranked by profit):`);
    for (const x of rows) console.log(`       ${x.ind.padEnd(13)} profit ${gbp(x.prof).padStart(10)}/wk (${gbp(x.prof * 52).padStart(11)}/yr)   staffed ${x.st.toFixed(2).padStart(7)} lv (~${Math.round(x.st * 5000).toLocaleString('en-US')} workers)   margin ${x.margin == null ? '   —' : (100 * x.margin).toFixed(0).padStart(4) + '%'}   of ${x.lv.toFixed(0)} built`);
    console.log('');
  }
}
