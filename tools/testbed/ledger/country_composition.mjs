// ONE COUNTRY'S VALUE ADDED BY SECTOR, YEAR BY YEAR, ACROSS ARMS (2026-10-03, written for the user's question "What's the in-US GDP
// composition by decade, is it noticeably different between canon and current artmerge?").
// Value added = Σ over the country's building types of (va_out − va_in) × 52, at BASE prices — the basis every summary since v6 carries
// (vanilla's v8 baseline has no market-priced goods flows), and the one the game's displayed GDP tracks within ~0.94–1.08 (F178 §9.4).
// Sectors follow VANILLA's building groups (common/building_groups, walked up to a sector), read live from the game; a tiered rung takes
// its industry's vanilla anchor building's group (the rung whose key vanilla defines), a craft rung is "crafts", a dam is "power".
// Per arm and year: the MEDIAN over the arm's usable runs of each sector's value added (£M a year) and of its share of the country's
// total, and the arm's median total ÷ the vanilla arm's. Optional per-run lines (--runs).
//   node tools/testbed/ledger/country_composition.mjs [--tag USA] [--years 1840,1850,…] [--runs] <label>=<session>[:<setup>] [...]
//   (a label "van" is the reference the totals are divided by)
import fs from 'node:fs'; import path from 'node:path';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { indexRun, firstOf, readSum, SESSIONS, med } from './lib_sumidx.mjs';
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = k => { const i = argv.indexOf(k); if (i < 0) return false; argv.splice(i, 1); return true; };
const TAG = opt('--tag', 'USA'); const YEARS = opt('--years', '1840,1850,1860,1870,1880,1890,1900,1910,1920,1930,1936').split(',').map(Number); const PER_RUN = flag('--runs');
if (!argv.length) { console.error('usage: country_composition.mjs [--tag USA] [--years …] [--runs] <label>=<session>[:<setup>] […]'); process.exit(1); }
// top-level blocks of a Paradox script directory: name -> body text
function blocks(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt'))) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').replace(/#[^\n]*/g, '');
    const re = /(^|\n)([A-Za-z0-9_]+)\s*=\s*\{/g; let m;
    while ((m = re.exec(t))) { let d = 1, i = re.lastIndex; while (i < t.length && d) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; } out[m[2]] = t.slice(re.lastIndex, i - 1); re.lastIndex = i; }
  }
  return out;
}
const GRP = {}; for (const [g, body] of Object.entries(blocks(GAME + '/common/building_groups'))) GRP[g] = { parent: (/parent_group\s*=\s*([A-Za-z0-9_]+)/.exec(body) || [])[1], subs: /is_subsistence\s*=\s*yes/.test(body) };
const BGRP = {}; for (const [b, body] of Object.entries(blocks(GAME + '/common/buildings'))) { const m = /building_group\s*=\s*([A-Za-z0-9_]+)/.exec(body); if (m) BGRP[b] = m[1]; }
const SECTOR_OF_GROUP = [ // first match walking up from the building's group
  ['bg_ship_construction', 'shipyards'], ['bg_light_industry', 'light industry'], ['bg_heavy_industry', 'heavy industry'], ['bg_military_industry', 'arms industry'],
  ['bg_arts', 'arts'], ['bg_owner_buildings', 'owners'], ['bg_trade', 'trade centres'], ['bg_construction', 'construction'], ['bg_power', 'power'],
  ['bg_private_infrastructure', 'transport'], ['bg_public_infrastructure', 'state & military'], ['bg_canals', 'state & military'],
  ['bg_extraction', 'extraction'], ['bg_gold_mining', 'extraction'], ['bg_coal_mining', 'extraction'], ['bg_iron_mining', 'extraction'], ['bg_lead_mining', 'extraction'], ['bg_sulfur_mining', 'extraction'],
  ['bg_agriculture', 'agriculture'], ['bg_plantations', 'agriculture'], ['bg_ranching', 'agriculture'],
  ['bg_government', 'state & military'], ['bg_military', 'state & military'], ['bg_monuments_hidden', 'state & military'],
  ['bg_urban_facilities', 'urban centres'], ['bg_service', 'urban centres'],
];
const sectorOfGroup = g => { const seen = new Set(); let x = g; while (x && !seen.has(x)) { seen.add(x); if (GRP[x]?.subs) return 'subsistence'; const hit = SECTOR_OF_GROUP.find(([k]) => k === x); if (hit) return hit[1]; x = GRP[x]?.parent; }
  return /_farms$|_plantations$|_ranches$|_vineyard/.test(g || '') ? 'agriculture' : 'other'; };
const SECTORS = ['agriculture', 'subsistence', 'extraction', 'crafts', 'light industry', 'heavy industry', 'arms industry', 'shipyards', 'arts', 'transport', 'power', 'trade centres', 'urban centres', 'construction', 'owners', 'state & military', 'other'];
const cfgCache = {};
function sectorMap(cfgPath) {
  if (cfgCache[cfgPath]) return cfgCache[cfgPath];
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, '')); const map = {};
  for (const I of cfg.industries || []) { if (I.disabled) continue; const anchor = I.tiers.map(t => t.key).find(k => BGRP[k]); const sec = anchor ? sectorOfGroup(BGRP[anchor]) : 'other';
    for (const t of I.tiers) map[t.key] = t.craft ? 'crafts' : sec; }
  return (cfgCache[cfgPath] = map);
}
const sectorOf = (k, map) => map[k] || (k.startsWith('building_dam_') ? 'power' : BGRP[k] ? sectorOfGroup(BGRP[k]) : 'other');
const arms = [], dropped = [];
for (const arg of argv) {
  const [label, spec] = arg.split('='); const [sess, setup] = spec.split(':'); const u = usableRuns(SESSIONS, sess, setup || ''); dropped.push(...u.dropped);
  const runs = [];
  for (const rel of u.runs) {
    // pooled sessions share run numbers, so a pooled arm names each run by its session's time stamp too (e.g. 2357/run001)
    const dir = path.join(SESSIONS, rel); const idx = indexRun(dir); const r = { run: (sess.includes(',') ? rel.slice(9, 13) + '/' : '') + rel.split('/')[1].replace(/_.*/, ''), y: {} };
    let map = null;
    try { const bs = JSON.parse(fs.readFileSync(path.join(dir, 'build_state.json'), 'utf8').replace(/^\uFEFF/, '')); const cp = bs.deterministic?.mod_under_test?.built_from_config; if (cp && fs.existsSync(cp)) map = sectorMap(cp); } catch {}
    if (!map) map = {}; // a vanilla (control) run: every key is vanilla's own
    for (const y of YEARS) { const f = firstOf(idx, y); if (!f) continue; const c = readSum(idx[f]).countries?.[TAG]; if (!c) continue;
      const v = {}; let tot = 0; for (const [k, b] of Object.entries(c.buildings || {})) { const s = sectorOf(k, map); const x = ((b.va_out || 0) - (b.va_in || 0)) * 52; v[s] = (v[s] || 0) + x; tot += x; }
      r.y[y] = { v, tot, gdp: c.gdp }; }
    runs.push(r);
  }
  arms.push({ label, runs });
}
const van = arms.find(a => a.label === 'van');
const fmt = x => Number.isFinite(x) ? (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)) : '-';
for (const y of YEARS) {
  console.log(`\n=== ${TAG} ${y}: value added at base prices, £M a year (median of runs) and % of the total`);
  const cols = arms.map(a => { const rs = a.runs.filter(r => r.y[y]); const tot = med(rs.map(r => r.y[y].tot));
    const row = {}; for (const s of SECTORS) row[s] = { m: med(rs.map(r => r.y[y].v[s] || 0)), sh: med(rs.map(r => 100 * (r.y[y].v[s] || 0) / r.y[y].tot)) };
    return { a, n: rs.length, tot, row }; });
  const vanTot = van ? cols.find(c => c.a === van).tot : NaN;
  console.log('sector'.padEnd(17) + cols.map(c => `${c.a.label} (n=${c.n})`.padEnd(22)).join(''));
  console.log('TOTAL'.padEnd(17) + cols.map(c => `${fmt(c.tot / 1e6)} (${(c.tot / vanTot).toFixed(2)}× van)`.padEnd(22)).join(''));
  for (const s of SECTORS) { if (cols.every(c => Math.abs(c.row[s].m) < 1e5)) continue; console.log(s.padEnd(17) + cols.map(c => `${fmt(c.row[s].m / 1e6)} (${c.row[s].sh.toFixed(1)}%)`.padEnd(22)).join('')); }
  if (PER_RUN) for (const c of cols) for (const r of c.a.runs) { const d = r.y[y]; if (!d) continue; console.log(`   ${c.a.label} ${r.run}: total ${fmt(d.tot / 1e6)} · ` + SECTORS.filter(s => Math.abs(d.v[s] || 0) >= 1e5).map(s => `${s} ${(100 * d.v[s] / d.tot).toFixed(0)}%`).join(' · ')); }
}
reportDropped(dropped);
