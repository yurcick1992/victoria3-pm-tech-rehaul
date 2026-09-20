#!/usr/bin/env node
// ⭐⭐ THE BUILDING'S OWN LEDGER, STRAIGHT OUT OF A MELTED SAVE — no model, no inference, no fitted coefficient.
//
// Written 2026-09-20 when the user said of the wage work *"I'm asking for quite a simple thing displayed in the
// interface, that doesn't contain any 'premiums' or whatever"* — and was right. A building record in the melt carries
// its OWN ledger, which two regressions had been inferring:
//
//     levels · staffing · throughput
//     salary_rate            THE BUILDING'S OWN wage rate — the country's `base_wage` is a different, country-level number
//     goods_cost             inputs at MARKET prices
//     goods_sales            revenue at MARKET prices
//     profit_after_reserves  what tools/testbed/save_state_summary.mjs calls `profit`
//     income_taxes · cash_reserves · <owner>_dividends
//
// ⇒ `goods_sales`/`goods_cost` make F150's price-multiplier repair unnecessary wherever they are available; the repair
//   exists because the SUMMARY extracts base-priced `va_out`/`va_in` instead of these. Bumping the summary schema to
//   carry all three is the owed fix (FINDINGS F152 §9).
//
// What it prints: implied wages (`goods_sales − goods_cost − profit_after_reserves`) against the modelled bill
// (`salary_rate/10000 × Σ(employees × wage_weight) × staffing`), the regression that says what ELSE is in the residual,
// and a set of candidate identities scored head to head — including the no-weights control that proves the profession
// weights belong (median 1.70 without them against 1.15 with).
//
// usage: rakaly melt --format vic3 --unknown-key stringify -c <save.v3> > melt.txt
//        node tools/building_ledger.mjs melt.txt
// ⚠ The melt is ~310 MB for a late save; this streams it line by line and holds only the building records.
import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';

const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MELT = process.argv[2];
const WW = {};
for (const f of readdirSync(GAME + '/common/pop_types')) {
  const m = /wage_weight\s*=\s*([\d.]+)/.exec(readFileSync(GAME + '/common/pop_types/' + f, 'utf8'));
  if (m) WW[f.replace(/\.txt$/, '')] = +m[1];
}
// per-PM employment, live
const EMP = {};
for (const f of readdirSync(GAME + '/common/production_methods')) {
  if (!f.endsWith('.txt')) continue;
  const txt = readFileSync(GAME + '/common/production_methods/' + f, 'utf8').replace(/^\uFEFF/, '');
  const re = /^([a-zA-Z0-9_\-]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(txt))) {
    let i = re.lastIndex, d = 1;
    while (i < txt.length && d > 0) { if (txt[i] === '{') d++; else if (txt[i] === '}') d--; i++; }
    const body = txt.slice(re.lastIndex, i - 1);
    const e = {};
    for (const x of body.matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)) e[x[1]] = (e[x[1]] || 0) + +x[2];
    EMP[m[1]] = e;
  }
}

const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
let inBM = false, cur = null, depth = 0, bmDepth = 0;
const rows = [];
let lineNo = 0;
for await (const line of rl) {
  lineNo++;
  const t = line.trim();
  if (!inBM) { if (t === 'building_manager={') { inBM = true; bmDepth = 0; } else continue; }
  // track depth inside building_manager
  for (const c of line) { if (c === '{') depth++; else if (c === '}') depth--; }
  if (t === 'building_manager={') continue;
  if (depth <= 0) break;                       // left building_manager
  let m;
  if ((m = /^building="([a-z_0-9]+)"$/.exec(t))) { cur = { key: m[1] }; rows.push(cur); continue; }
  if (!cur) continue;
  if ((m = /^levels=([\d.]+)$/.exec(t))) cur.levels = +m[1];
  else if ((m = /^staffing=([\d.]+)$/.exec(t))) cur.staffing = +m[1];
  else if ((m = /^salary_rate=([\-\d.]+)$/.exec(t))) cur.rate = +m[1];
  else if ((m = /^goods_cost=([\-\d.]+)$/.exec(t))) cur.cost = +m[1];
  else if ((m = /^goods_sales=([\-\d.]+)$/.exec(t))) cur.sales = +m[1];
  else if ((m = /^profit_after_reserves=([\-\d.]+)$/.exec(t))) cur.profit = +m[1];
  else if ((m = /^income_taxes=([\-\d.]+)$/.exec(t))) cur.tax = +m[1];
  else if (/_dividends=/.test(t)) { const x = /_dividends=([\-\d.]+)$/.exec(t); if (x) cur.div = +x[1]; }
  else if ((m = /^throughput=([\-\d.]+)$/.exec(t))) cur.thr = +m[1];
  else if ((m = /^cash_reserves=([\-\d.]+)$/.exec(t))) cur.reserves = +m[1];
  else if ((m = /^profit_after_investments=([\-\d.]+)$/.exec(t))) cur.profitInv = +m[1];
  else if ((m = /^subsidized=(yes|no)$/.exec(t))) cur.sub = m[1] === 'yes';
  else if (t.startsWith('"pm_') || t.startsWith('"default_') || /^"[a-z_0-9]+"( "[a-z_0-9]+")*$/.test(t)) {
    const pms = t.match(/"([a-zA-Z_0-9\-]+)"/g);
    if (pms && pms.some(p => EMP[p.replace(/"/g, '')] !== undefined)) cur.pms = pms.map(p => p.replace(/"/g, ''));
  }
}
console.log('building records parsed: ' + rows.length);

const scored = [];
for (const r of rows) {
  if (!(r.levels > 0) || !(r.staffing > 0) || !r.pms || r.rate == null || r.sales == null || r.cost == null || r.profit == null) continue;
  const emp = {};
  for (const p of r.pms) { const e = EMP[p]; if (!e) continue; for (const [k, v] of Object.entries(e)) emp[k] = (emp[k] || 0) + v; }
  const units = Object.entries(emp).reduce((a, [p, n]) => a + n * (WW[p] ?? 1), 0);
  const heads = Object.values(emp).reduce((a, n) => a + n, 0);
  if (!(units > 0)) continue;
  const implied = r.sales - r.cost - r.profit;
  const modelled = r.rate / 10000 * units * r.staffing;
  scored.push({ ...r, units, heads, implied, modelled, ratio: implied / modelled });
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const ok = scored.filter(r => Number.isFinite(r.ratio) && r.modelled > 0 && r.implied > 0);
console.log('scored (goods on both sides, positive implied wage): ' + ok.length + ' of ' + scored.length);
console.log('\nimplied ÷ modelled wage bill:  median ' + med(ok.map(r => r.ratio)).toFixed(4)
  + '   p10 ' + q(ok.map(r => r.ratio), 0.1).toFixed(3) + '   p25 ' + q(ok.map(r => r.ratio), 0.25).toFixed(3)
  + '   p75 ' + q(ok.map(r => r.ratio), 0.75).toFixed(3) + '   p90 ' + q(ok.map(r => r.ratio), 0.9).toFixed(3));
const within = (lo, hi) => (100 * ok.filter(r => r.ratio >= lo && r.ratio <= hi).length / ok.length).toFixed(1);
console.log('  within ±1% of 1.00: ' + within(0.99, 1.01) + '%   ±5%: ' + within(0.95, 1.05) + '%   ±10%: ' + within(0.90, 1.10) + '%');

// ---- WHAT ELSE IS IN THE RESIDUAL? regress implied = a·modelled + b·profit + c·tax
{
  const X = ok.filter(r => Number.isFinite(r.tax));
  const cols = [r => r.modelled, r => r.profit, r => r.tax];
  const n = cols.length, A = Array.from({ length: n }, () => new Array(n).fill(0)), bv = new Array(n).fill(0);
  for (const r of X) { const w = 1 / Math.max(1, r.heads * r.staffing); const x = cols.map(f => f(r));
    for (let i = 0; i < n; i++) { for (let k = 0; k < n; k++) A[i][k] += w * x[i] * x[k]; bv[i] += w * x[i] * r.implied; } }
  const M = A.map((row, i) => [...row, bv[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r2 = c + 1; r2 < n; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[p][c])) p = r2;
    [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-12) continue;
    for (let r2 = 0; r2 < n; r2++) { if (r2 === c) continue; const f = M[r2][c] / M[c][c]; for (let k = c; k <= n; k++) M[r2][k] -= f * M[c][k]; } }
  console.log('\n=== WHAT IS IN THE RESIDUAL? implied = a·(salary_rate/1e4 × units × staffing) + b·profit + c·income_taxes  (n=' + X.length + ') ===');
  console.log('  a (the wage term)   = ' + (M[0][n] / M[0][0]).toFixed(3) + '   <- 1.000 would mean the wage formula is exactly right');
  console.log('  b (profit)          = ' + (M[1][n] / M[1][1]).toFixed(3));
  console.log('  c (income taxes)    = ' + (M[2][n] / M[2][2]).toFixed(3));
}
// ---- candidate identities, scored directly
{
  const test = (lab, f) => { const v = ok.map(f).filter(Number.isFinite);
    const within = (lo, hi) => (100 * v.filter(x => x >= lo && x <= hi).length / v.length).toFixed(1);
    console.log('  ' + lab.padEnd(52) + 'median ' + med(v).toFixed(4) + '   ±1% ' + within(0.99, 1.01) + '%   ±5% ' + within(0.95, 1.05) + '%'); };
  console.log('\n=== CANDIDATE IDENTITIES (ratio to the modelled wage bill; 1.0000 and a high ±1% is the answer) ===');
  test('implied ÷ modelled', r => r.implied / r.modelled);
  test('(implied − tax) ÷ modelled', r => (r.implied - (r.tax || 0)) / r.modelled);
  test('(implied + tax) ÷ modelled', r => (r.implied + (r.tax || 0)) / r.modelled);
  test('using profit_after_investments instead', r => (r.sales - r.cost - (r.profitInv ?? r.profit)) / r.modelled);
  test('staffing→levels in the wage', r => r.implied / (r.rate / 1e4 * r.units * r.levels));
  test('no wage weights (heads only)', r => r.implied / (r.rate / 1e4 * r.heads * r.staffing));
  const noRes = ok.filter(r => !(r.reserves > 0));
  if (noRes.length > 30) { const v = noRes.map(r => r.implied / r.modelled);
    console.log('  ' + 'implied ÷ modelled, buildings with NO cash reserves'.padEnd(52) + 'median ' + med(v).toFixed(4) + '   n=' + noRes.length); }
  const full = ok.filter(r => r.reserves > 0);
  if (full.length > 30) { const v = full.map(r => r.implied / r.modelled);
    console.log('  ' + 'implied ÷ modelled, buildings WITH cash reserves'.padEnd(52) + 'median ' + med(v).toFixed(4) + '   n=' + full.length); }
}

// by building type, the ten most common
const byT = {};
for (const r of ok) (byT[r.key] ||= []).push(r);
console.log('\nby building type (the 14 most common):');
console.log('  type                              n   median implied÷modelled   median wage units/level');
for (const [k, rs] of Object.entries(byT).sort((a, b) => b[1].length - a[1].length).slice(0, 14))
  console.log('  ' + k.replace('building_', '').padEnd(32) + String(rs.length).padStart(4)
    + med(rs.map(r => r.ratio)).toFixed(3).padStart(18) + med(rs.map(r => r.units)).toFixed(0).padStart(22));
