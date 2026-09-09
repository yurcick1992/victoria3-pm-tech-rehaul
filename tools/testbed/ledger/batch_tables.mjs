// THE BATCH TABLES — the F106-layout readings for a batch whose arm may span SEVERAL sessions (2026-09-09, written for
// F107: the 60-run plan's phase 1 lives in two folders after the L29 harness race). Prints, over the arm's USABLE runs
// (lib_runs' rule, L17) pooled across the sessions named:
//   1. POOLS   — investment pool ÷ GDP at the anchor year: world, GBR, USA (medians over runs), arm / nb / van
//   2. PRICES  — the tiered industries' output goods, price ÷ base, British market and the seven-market pool, at the dump
//                dates, medians over runs, arm beside vanilla, and the 1935 ratio arm ÷ vanilla
//   3. WAGE UNITS — British price at 1935 ÷ price at 1840, divided by the same ratio of Britain's base wage (F97's unit)
//   4. PRODUCTION — British goods_out at 1900 and 1935 as a share of vanilla's median
//   5. GDP     — world and shortlist ÷ vanilla median (the same as first_run_decomp, for the record)
// Nothing here is a new definition: prices are the market table's own `price`, base prices tools/goods_prices.tsv, pools and
// GDP the save's own fields; medians over runs everywhere, and every ratio prints both its terms.
//
// usage: node tools/testbed/ledger/batch_tables.mjs --arm <sess[,sess]>:<setup> [--nb <sess>:<setup>] [--van <sess>]
//        [--config <path>] [--year 1935] [--exclude <sess/run[,...]>]   (--exclude = name the stalls, they are reported separately)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SES = join(HERE, '..', 'sessions');
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ARM = argOf('--arm', null), NB = argOf('--nb', null), VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16');
const CFG = argOf('--config', 'config/mod_config.json'), YEAR = argOf('--year', '1935');
const EXCL = new Set((argOf('--exclude', '') || '').split(',').map(s => s.trim()).filter(Boolean));
if (!ARM) { console.error('usage: batch_tables.mjs --arm <sess[,sess]>:<setup> [--nb <sess>:<setup>] [--van <sess>] [--config <path>] [--year 1935] [--exclude <sess/run,...>]'); process.exit(2); }

const DUMPS = ['1880.1.1', '1900.1.1', '1920.1.1', YEAR + '.1.1'];
const SHORT = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'PRU', 'GER'];
const med = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const f2 = x => Number.isFinite(x) ? x.toFixed(2) : '—';
const f0 = x => Number.isFinite(x) ? x.toFixed(0) : '—';
const pct = x => Number.isFinite(x) ? (100 * x).toFixed(0) : '—';

// ---- the arm's output goods, from the config (rung 0's output per tiered industry; disabled industries skipped — L27) ----
const cfg = JSON.parse(readFileSync(join(ROOT, CFG), 'utf8'));
const inds = Array.isArray(cfg.industries) ? cfg.industries : Object.entries(cfg.industries).map(([k, v]) => ({ id: k, ...v }));
const GOODS = [];
for (const ind of inds) {
  if (ind.disabled) continue;
  const t = (ind.tiers || [])[0]; if (!t) continue;
  const g = t.output_good || ind.output_good || t.output || null; if (!g) continue;
  if (!GOODS.some(x => x.good === g)) GOODS.push({ good: g, ind: ind.id || ind.key || ind.name });
}
const BASE = {};
for (const line of readFileSync(join(ROOT, 'tools', 'goods_prices.tsv'), 'utf8').split(/\r?\n/)) {
  const c = line.split('\t'); if (c.length >= 2 && Number.isFinite(+c[1])) BASE[c[0].trim()] = +c[1];
}

// ---- run lists ----
const runsOf = spec => { // "sess[,sess]:setup" -> [sess/run...], usable only, minus --exclude
  if (!spec) return [];
  const [sesList, setup] = spec.includes(':') ? [spec.slice(0, spec.lastIndexOf(':')), spec.slice(spec.lastIndexOf(':') + 1)] : [spec, ''];
  const out = [];
  for (const s of sesList.split(',').map(x => x.trim()).filter(Boolean)) { const u = usableRuns(SES, s, setup); out.push(...u.runs); }
  return out;
};
const armRuns = runsOf(ARM).filter(r => !EXCL.has(r)), armStalls = runsOf(ARM).filter(r => EXCL.has(r));
const nbRuns = runsOf(NB), vanRuns = usableRuns(SES, VAN).runs;
console.log(`BATCH TABLES — arm ${ARM}: ${armRuns.length} usable run(s)${armStalls.length ? ` + ${armStalls.length} excluded by --exclude (${armStalls.map(r => r.split('/')[1]).join(', ')})` : ''} · nb ${NB || '—'}: ${nbRuns.length} · van ${VAN}: ${vanRuns.length}`);

// ---- summaries ----
const lastSummary = (run, year) => {
  const dir = join(SES, run, 'save_summaries'); if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  for (const f of files) { const s = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString()); if (String(s.provenance?.date || '').startsWith(String(year))) return s; }
  return null;
};
const firstSummaryAt = (run, year) => lastSummary(run, year);

// 1. POOLS
const poolRow = (runs, year) => {
  const w = [], g = [], u = [];
  for (const r of runs) { const s = lastSummary(r, year); if (!s) continue;
    let pool = 0; for (const c of Object.values(s.countries)) pool += (+c.investment_pool || 0);
    w.push(pool / (+s.world.gdp || NaN)); const G = s.countries.GBR, U = s.countries.USA;
    if (G) g.push((+G.investment_pool || 0) / (+G.gdp || NaN)); if (U) u.push((+U.investment_pool || 0) / (+U.gdp || NaN)); }
  return { world: med(w), gbr: med(g), usa: med(u), n: w.length };
};
console.log(`\n=== 1. POOLS at ${YEAR} — investment pool ÷ a year's GDP (medians over runs) ===`);
console.log('arm'.padEnd(12), 'n'.padStart(3), 'world'.padStart(7), 'GBR'.padStart(7), 'USA'.padStart(7));
for (const [label, runs] of [['arm', armRuns], ['stalls', armStalls], ['nb', nbRuns], ['vanilla', vanRuns]]) { if (!runs.length) continue; const p = poolRow(runs, YEAR); console.log(label.padEnd(12), String(p.n).padStart(3), f2(p.world).padStart(7), f2(p.gbr).padStart(7), f2(p.usa).padStart(7)); }

// 2. PRICES — from each session's markets_all.tsv (run_index, setup, dump_date, tag(market name), market(owner), good, buy, sell, price, ...)
const loadMarkets = sessions => { // -> Map runKey(sess/run_index) -> Map date -> Map market -> Map good -> price
  const M = new Map();
  for (const s of sessions) { const p = join(SES, s, 'markets_all.tsv'); if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf8').split(/\r?\n/); const H = lines[0].split('\t'); const ix = Object.fromEntries(H.map((h, i) => [h, i]));
    for (let i = 1; i < lines.length; i++) { const c = lines[i].split('\t'); if (c.length < 9) continue;
      const key = `${s}/${c[ix.run_index]}`; const d = c[ix.dump_date], m = c[ix.tag], g = c[ix.good], pr = +c[ix.price];
      if (!Number.isFinite(pr)) continue;
      const byDate = M.get(key) || M.set(key, new Map()).get(key); const byM = byDate.get(d) || byDate.set(d, new Map()).get(d);
      const byG = byM.get(m) || byM.set(m, new Map()).get(m); byG.set(g, pr); } }
  return M;
};
const runKeyOf = r => { const [s, run] = r.split('/'); const idx = +(run.match(/^run(\d+)/) || [])[1]; return `${s}/${idx}`; };
const SEVEN = ['British Market', 'French Market', 'American Market', 'Prussian Market', 'Russian Market', 'Japanese Market', 'Dutch Market'];
const priceTable = (runs, sessions) => {
  const M = loadMarkets(sessions); const out = {}; // good -> date -> {gbr:[...], pool:[...]}
  for (const r of runs) { const byDate = M.get(runKeyOf(r)); if (!byDate) continue;
    for (const d of DUMPS) { const byM = byDate.get(d); if (!byM) continue;
      for (const { good } of GOODS) { const base = BASE[good]; if (!base) continue;
        const gb = byM.get('British Market')?.get(good); const pool = SEVEN.map(m => byM.get(m)?.get(good)).filter(Number.isFinite);
        const o = out[good] = out[good] || {}; const od = o[d] = o[d] || { gbr: [], pool: [] };
        if (Number.isFinite(gb)) od.gbr.push(gb / base); if (pool.length) od.pool.push(med(pool) / base); } } }
  return out;
};
const armSessions = [...new Set(armRuns.map(r => r.split('/')[0]))], vanSessions = [VAN], nbSessions = [...new Set(nbRuns.map(r => r.split('/')[0]))];
const PA = priceTable(armRuns, armSessions), PV = priceTable(vanRuns, vanSessions), PN = nbRuns.length ? priceTable(nbRuns, nbSessions) : {};
console.log(`\n=== 2. PRICES — price ÷ base (%), medians over runs; British market | seven-market pool; arm / vanilla; last column = ${YEAR} pool ratio arm ÷ vanilla ===`);
console.log('good'.padEnd(14) + DUMPS.map(d => d.slice(0, 4).padStart(12)).join('') + '   ratio'.padStart(9));
for (const { good } of GOODS) {
  if (!PA[good]) continue;
  const cells = DUMPS.map(d => { const a = PA[good][d] || { gbr: [], pool: [] }, v = (PV[good] || {})[d] || { gbr: [], pool: [] };
    return `${pct(med(a.gbr))}|${pct(med(a.pool))}/${pct(med(v.gbr))}|${pct(med(v.pool))}`.padStart(12); });
  const a35 = med((PA[good][DUMPS[3]] || {}).pool || []), v35 = med(((PV[good] || {})[DUMPS[3]] || {}).pool || []);
  console.log(good.padEnd(14) + cells.join('') + f2(a35 / v35).padStart(9));
}
console.log('  (each cell: British|pool for the arm / British|pool for vanilla, in % of base; nb arm below)');
if (nbRuns.length) { for (const { good } of GOODS) { if (!PN[good]) continue; const a35 = med((PN[good][DUMPS[3]] || {}).pool || []), v35 = med(((PV[good] || {})[DUMPS[3]] || {}).pool || []); console.log('  nb '.padEnd(14) + good.padEnd(14) + `${YEAR} pool ${pct(a35)}% · ratio ÷ vanilla ${f2(a35 / v35)}`); } }

// 3. WAGE UNITS — British price at YEAR ÷ price at 1840, over the same ratio of Britain's base_wage (F97's unit)
const wageIndex = (runs, sessions) => {
  const M = loadMarkets(sessions); const out = {};
  for (const r of runs) { const s40 = firstSummaryAt(r, '1840'), sY = lastSummary(r, YEAR); const byDate = M.get(runKeyOf(r));
    if (!s40 || !sY || !byDate) continue; const w40 = +s40.countries.GBR?.base_wage, wY = +sY.countries.GBR?.base_wage; if (!(w40 > 0 && wY > 0)) continue;
    const p40 = byDate.get('1840.1.1')?.get('British Market'), pY = byDate.get(YEAR + '.1.1')?.get('British Market'); if (!p40 || !pY) continue;
    for (const { good } of GOODS) { const a = p40.get(good), b = pY.get(good); if (!(a > 0 && b > 0)) continue; (out[good] = out[good] || []).push((b / a) / (wY / w40)); }
    (out.__wage = out.__wage || []).push(wY / w40); }
  return out;
};
const WA = wageIndex(armRuns, armSessions), WV = wageIndex(vanRuns, vanSessions), WN = nbRuns.length ? wageIndex(nbRuns, nbSessions) : {};
console.log(`\n=== 3. WAGE UNITS — British price ${YEAR} ÷ 1840, divided by Britain's base wage ${YEAR} ÷ 1840 (medians over runs) ===`);
console.log(`base wage ×: arm ${f2(med(WA.__wage || []))} · nb ${f2(med(WN.__wage || []))} · vanilla ${f2(med(WV.__wage || []))}`);
console.log('good'.padEnd(14), 'arm'.padStart(7), 'nb'.padStart(7), 'vanilla'.padStart(8));
for (const { good } of GOODS) { if (!WA[good]) continue; console.log(good.padEnd(14), f2(med(WA[good])).padStart(7), f2(med(WN[good] || [])).padStart(7), f2(med(WV[good] || [])).padStart(8)); }

// 4. PRODUCTION — British goods_out at 1900 and YEAR, arm median ÷ vanilla median
const prodAt = (runs, year) => { const o = {}; for (const r of runs) { const s = lastSummary(r, year); const g = s?.countries?.GBR?.goods_out; if (!g) continue; for (const { good } of GOODS) (o[good] = o[good] || []).push(+g[good] || 0); } return o; };
console.log(`\n=== 4. PRODUCTION — British goods_out, arm median ÷ vanilla median (arm / vanilla units a week) ===`);
for (const y of ['1900', YEAR]) { const A = prodAt(armRuns, y), V = prodAt(vanRuns, y), N = nbRuns.length ? prodAt(nbRuns, y) : {};
  console.log(`-- ${y}`); console.log('good'.padEnd(14), 'ratio'.padStart(7), 'arm'.padStart(9), 'vanilla'.padStart(9), 'nb ratio'.padStart(9));
  for (const { good } of GOODS) { const a = med(A[good] || []), v = med(V[good] || []), n = med(N[good] || []); console.log(good.padEnd(14), f2(a / v).padStart(7), f0(a).padStart(9), f0(v).padStart(9), f2(n / v).padStart(9)); } }

// 5. GDP — world and shortlist ÷ vanilla median
const gdpAt = (runs, year) => { const w = [], s = []; for (const r of runs) { const j = lastSummary(r, year); if (!j) continue; w.push(+j.world.gdp || NaN); s.push(SHORT.reduce((t, c) => t + (+j.countries[c]?.gdp || 0), 0)); } return { w, s }; };
const GA = gdpAt(armRuns, YEAR), GV = gdpAt(vanRuns, YEAR), GN = gdpAt(nbRuns, YEAR), GS = gdpAt(armStalls, YEAR);
console.log(`\n=== 5. GDP at ${YEAR} ÷ vanilla median (world £${f0(med(GV.w) / 1e6)}M, shortlist £${f0(med(GV.s) / 1e6)}M) ===`);
console.log(`arm     n ${GA.w.length}: world median ${f2(med(GA.w) / med(GV.w))}× (mean ${f2(GA.w.reduce((a, b) => a + b, 0) / GA.w.length / med(GV.w))}×, min ${f2(Math.min(...GA.w) / med(GV.w))}, max ${f2(Math.max(...GA.w) / med(GV.w))}) · shortlist median ${f2(med(GA.s) / med(GV.s))}×`);
if (GS.w.length) console.log(`stalls  n ${GS.w.length}: world ${GS.w.map(x => f2(x / med(GV.w))).join(' / ')}`);
if (GN.w.length) console.log(`nb      n ${GN.w.length}: world median ${f2(med(GN.w) / med(GV.w))}× · shortlist ${f2(med(GN.s) / med(GV.s))}×`);
