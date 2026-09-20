#!/usr/bin/env node
// ⭐⭐ WHERE THE WAGE MODEL'S TWO COEFFICIENTS COME FROM — the fit behind `tools/lib_wage_model.mjs` (FINDINGS F152 §8).
//
// Read-only. It answers the question the user put on 2026-09-20 — *"you do take into account the workforce composition,
// right? … actual wages are higher, as buildings are not filled with labourers"* — by testing it rather than asserting it.
//
// The actual wage bill per (country × year × building type) is `R − I − profit`, with R and I re-priced from BASE to
// MARKET the F152 way. Against it, three things are measured:
//
//   1. THE PER-PROFESSION FIT. `impW = normal rate × Σ_p r_p × employees_p`, least squares for r_p, reported relative to
//      laborers and against vanilla's own `wage_weight`. ⚠ NOT ADOPTED — see F152 §8: it buys only 0.394 → 0.338 of mean
//      |log| scatter and returns −11.5 for clergymen, an impossible number that says the design matrix is not clean
//      enough to trust coefficient by coefficient. It is here to be re-run, not to be believed line by line.
//   2. ⭐ THE TWO-TERM FIT, WHICH IS WHAT SHIPS: `W = a × (normal rate × wage units) + b × the building's own profit`.
//      a = 1.19, b = 0.30, the split identified (collinearity 0.76) and stable across all seven instrumented countries.
//      The engine raises a building's wage where it can afford to (`BUILDING_PROFIT_TARGET_TO_RAISE_WAGES` 0.25), so the
//      wage ANSWERS BACK and `P = (R − I − a·Wm) ÷ (1 + b)`.
//   3. WHICH FORM PREDICTS THE BUILDING'S OWN PROFIT BEST — the test that decides. Two-term 26.5% median error against
//      the flat premium's 38.7%, with the bias gone.
//
// ⚠ Rows are weighted 1/heads: the question is the RATE, not the total bill, so one enormous building must not set it.
// ⚠ Shipyards (unmodelled naval income) and subsistence (its own wage rules) are excluded by name, as everywhere.
// ⚠ Measured on VANILLA. The coefficients are assumed transferable to a mod arm on the same grounds F152 §4's flat
//   premium was — it read 1.52 vanilla against 1.54 on a mod arm — and that assumption has not been re-tested here.
//
// usage: node tools/fit_wage_model.mjs <session/run> [<session/run> …]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { readVanilla } from './lib_vanilla_ladder.mjs';
import { WAGE_WEIGHT, POP_SIZE_PACKAGE, wageUnits, priceMultiplier } from './lib_wage_model.mjs';

const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SES = join(REPO, 'tools/testbed/sessions');
const MARKET_OF = { GBR: 'British Market', USA: 'American Market', FRA: 'French Market', NET: 'Dutch Market', PRU: 'Prussian Market', RUS: 'Russian Market', JAP: 'Japanese Market' };
const SKIP = /^building_(subsistence_|shipyard)/;
const YEARS = [1840, 1860, 1880, 1900, 1920, 1935];
const BASE = Object.fromEntries(readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));
const V = readVanilla(GAME);
const ec = new Map();
const vanEmp = p => { if (!ec.has(p)) ec.set(p, Object.fromEntries([...(V.PMBODY[p] || '').matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]]))); return ec.get(p); };

const obs = [];
for (const rel of process.argv.slice(2)) {
  const P = {};
  for (const line of readFileSync(join(SES, rel, 'markets.tsv'), 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (c.length < 8) continue; const p = +c[7]; if (p > 0) ((P[c[1]] ||= {})[c[2]] ||= {})[c[4]] = p;
  }
  const d = join(SES, rel, 'save_summaries');
  for (const fn of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(d, fn))).toString('utf8')); } catch { continue; }
    const dt = String(j.provenance.date), y = +dt.split('.')[0];
    if (!YEARS.includes(y) || !dt.endsWith('.1.1')) { j = null; continue; }
    for (const [tag, mkt] of Object.entries(MARKET_OF)) {
      const C = j.countries[tag]; if (!C) continue;
      const price = (P[dt] || {})[mkt]; if (!price) continue;
      const bw = +C.base_wage / POP_SIZE_PACKAGE; if (!(bw > 0)) continue;
      for (const [key, b] of Object.entries(C.buildings || {})) {
        if (SKIP.test(key)) continue;
        const lv = +b.levels || 0, st = +b.staffing || 0;
        if (!(lv >= 4) || !(+b.va_out > 0) || (+b.subsidised_levels || 0) > 0 || !(st > 0)) continue;
        const mix = { out: {}, in: {} }, emp = {}; let bad = false;
        for (const [pk, plv] of Object.entries(b.pms || {})) {
          if (!V.PMBODY[pk]) { bad = true; break; }
          const g = V.goodsOf(pk), e = vanEmp(pk), w = +plv / lv;
          for (const [k, v] of Object.entries(g.out)) mix.out[k] = (mix.out[k] || 0) + v * w;
          for (const [k, v] of Object.entries(g.in)) mix.in[k] = (mix.in[k] || 0) + v * w;
          for (const [k, v] of Object.entries(e)) emp[k] = (emp[k] || 0) + v * w;
        }
        if (bad) continue;
        const mo = priceMultiplier(mix.out, price, BASE), mi = priceMultiplier(mix.in, price, BASE);
        if (!(mo.missing <= 0.02) || !(mi.missing <= 0.02) || !Number.isFinite(mo.mult)) continue;
        const R = (+b.va_out) * mo.mult, I = (+b.va_in || 0) * (Number.isFinite(mi.mult) ? mi.mult : ((+b.va_in || 0) === 0 ? 1 : NaN));
        if (!Number.isFinite(I)) continue;
        const impW = R - I - (+b.profit || 0);
        if (!(impW > 0)) continue;
        const E = {}; let heads = 0;
        for (const [p, n] of Object.entries(emp)) { const v = n * st; if (v > 0) { E[p] = v; heads += v; } }
        if (!(heads > 0)) continue;
        obs.push({ tag, y, key, bw, impW, E, heads, units: wageUnits(emp) * st, R, profit: +b.profit || 0 });
      }
    }
    j = null;
  }
}
console.log('observations: ' + obs.length);

// professions present in enough observations to be identified
const cnt = {};
for (const o of obs) for (const p of Object.keys(o.E)) cnt[p] = (cnt[p] || 0) + 1;
const PROF = Object.entries(cnt).filter(([, n]) => n >= 40).map(([p]) => p).sort();
console.log('professions fitted (>=40 obs): ' + PROF.map(p => p + '(' + cnt[p] + ')').join(' '));

// y_i = SUM_p r_p * x_{i,p}, where y = impW/bw and x = employees.  Weight each row by 1/heads so a huge
// building does not set the answer on its own; the question is the RATE, not the total bill.
const n = PROF.length;
const A = Array.from({ length: n }, () => new Array(n).fill(0)), bv = new Array(n).fill(0);
for (const o of obs) {
  const w = 1 / o.heads;
  const x = PROF.map(p => o.E[p] || 0), yv = o.impW / o.bw;
  for (let i = 0; i < n; i++) { for (let k = 0; k < n; k++) A[i][k] += w * x[i] * x[k]; bv[i] += w * x[i] * yv; }
}
// Gaussian elimination with partial pivoting
const M = A.map((r, i) => [...r, bv[i]]);
for (let c = 0; c < n; c++) {
  let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
  [M[c], M[piv]] = [M[piv], M[c]];
  if (Math.abs(M[c][c]) < 1e-12) continue;
  for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
}
const r = PROF.map((_, i) => M[i][n] / M[i][i]);
const base = r[PROF.indexOf('laborers')] || 1;
console.log('\n=== FITTED EFFECTIVE WAGE MULTIPLIER, relative to laborers ===');
console.log('profession      vanilla wage_weight   FITTED   fitted ÷ vanilla');
for (let i = 0; i < n; i++) {
  const van = WAGE_WEIGHT[PROF[i]] ?? 1, fit = r[i] / base;
  console.log('  ' + PROF[i].padEnd(14) + String(van).padStart(12) + fit.toFixed(2).padStart(11) + (fit / van).toFixed(2).padStart(15));
}
console.log('\n  laborers\' own absolute level: ' + base.toFixed(2) + '× the country\'s normal rate');

// how well do the two models predict?
const err = (f) => { const e = obs.map(o => f(o) / o.impW); e.sort((a, b) => a - b);
  const m = e[e.length >> 1]; const lo = e[Math.floor(e.length * 0.1)], hi = e[Math.floor(e.length * 0.9)];
  return 'median ' + m.toFixed(2) + '  p10 ' + lo.toFixed(2) + '  p90 ' + hi.toFixed(2)
    + '  |log| mean ' + (obs.reduce((a, o) => a + Math.abs(Math.log(f(o) / o.impW)), 0) / obs.length).toFixed(3); };
console.log('\n=== PREDICTED ÷ ACTUAL wage bill (1.00 is perfect; |log| mean is the scatter) ===');
console.log('  vanilla weights, flat 1.52 premium : ' + err(o => o.bw * o.units * 1.52));
console.log('  vanilla weights, no premium        : ' + err(o => o.bw * o.units));
console.log('  FITTED per-profession rates        : ' + err(o => o.bw * PROF.reduce((a, p, i) => a + (o.E[p] || 0) * r[i], 0)));

// ---- IS THE RESIDUAL WAGES, OR WAGES + SOMETHING PROPORTIONAL TO PROFIT (dividends)?
// residual = a x modelled wages + b x profit.  b near 0 => it is wages.
{
  let saa = 0, sab = 0, sbb = 0, say = 0, sby = 0;
  for (const o of obs) { const a = o.bw * o.units, b = o.profit, yv = o.impW, w = 1 / Math.max(1, o.heads);
    saa += w * a * a; sab += w * a * b; sbb += w * b * b; say += w * a * yv; sby += w * b * yv; }
  const det = saa * sbb - sab * sab;
  const A2 = (say * sbb - sby * sab) / det, B2 = (sby * saa - say * sab) / det;
  console.log('\n=== IS THE RESIDUAL WAGES, OR WAGES + DIVIDENDS? residual = a × modelled wages + b × profit ===');
  console.log('  a, the wage premium      = ' + A2.toFixed(3));
  console.log('  b, the share of profit   = ' + B2.toFixed(3) + '   <- near 0 means the residual is wages; near 1 means profit is reported NET of it');
  console.log('  one-variable a (b := 0)  = ' + (say / saa).toFixed(3));
  console.log('  collinearity of the two regressors (weighted cos) = ' + (sab / Math.sqrt(saa * sbb)).toFixed(3)
    + '   <- above ~0.95 and the split is not identified');
  const byC = {};
  for (const o of obs) (byC[o.tag] ||= []).push(o);
  console.log('  per-country split (n >= 150) — a stable split across countries is evidence it is real:');
  for (const [t, rs] of Object.entries(byC)) {
    if (rs.length < 150) continue;
    let aa = 0, ab = 0, bb = 0, ay = 0, by = 0;
    for (const o of rs) { const a = o.bw * o.units, b = o.profit, yv = o.impW, w = 1 / Math.max(1, o.heads);
      aa += w * a * a; ab += w * a * b; bb += w * b * b; ay += w * a * yv; by += w * b * yv; }
    const dd = aa * bb - ab * ab;
    console.log('    ' + t + '  n=' + String(rs.length).padStart(4) + '   a ' + ((ay * bb - by * ab) / dd).toFixed(2)
      + '   b ' + ((by * aa - ay * ab) / dd).toFixed(2) + '   one-var a ' + (ay / aa).toFixed(2)
      + '   collin ' + (ab / Math.sqrt(aa * bb)).toFixed(2));
  }
  // ---- WHICH FORM PREDICTS THE BUILDING'S OWN PROFIT BEST?
  // flat:      P = R - I - k x Wmodel
  // two-term:  W = a x Wmodel + b x P   =>   P = (R - I - a x Wmodel) / (1 + b)
  const RI = o => o.impW + o.profit;              // R - I, by construction
  const score = (lab, f) => {
    const e = obs.map(o => f(o) - o.profit).map((d, i) => d / Math.max(1, Math.abs(obs[i].profit)));
    const ae = e.map(Math.abs).sort((x, y) => x - y);
    const sgn = obs.map((o, i) => f(o) - o.profit);
    const bias = sgn.reduce((x, y) => x + y, 0) / obs.reduce((x, o) => x + Math.abs(o.profit), 0);
    console.log('  ' + lab.padEnd(42) + 'median |err| ' + (100 * ae[ae.length >> 1]).toFixed(1) + '%   p90 ' + (100 * ae[Math.floor(ae.length * 0.9)]).toFixed(1)
      + '%   bias ' + (bias >= 0 ? '+' : '') + (100 * bias).toFixed(1) + '%');
  };
  console.log('\n=== PREDICTING THE BUILDING\'S OWN PROFIT (err ÷ |actual profit|; bias = Σerr ÷ Σ|profit|) ===');
  score('flat premium 1.52', o => RI(o) - 1.52 * o.bw * o.units);
  score('flat premium 1.20', o => RI(o) - 1.20 * o.bw * o.units);
  score('two-term a=1.19 b=0.30', o => (RI(o) - 1.186 * o.bw * o.units) / 1.302);
  score('no premium (raw normal rate)', o => RI(o) - o.bw * o.units);
}
