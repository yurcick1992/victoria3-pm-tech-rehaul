#!/usr/bin/env node
// ⭐⭐ THE LADDER OPTION TABLE — what a candidate (A, B, cost, in0) does to the THREE things that fight each other.
//
// Read-only. Written 2026-09-19 after the user closed the per-industry `--in0-level` axis ("this is 'the solver' all over again ... too complex.
// Vanilla values + uniform ladders and penalties stay, although ladders can be more complex than anchor*A^era") and asked what is left, ladder-wise,
// to cut the money printing — "maybe a significantly lower A, with vanilla B".
//
// ⭐⭐ THE WAGE IS THE ECONOMY'S AND THE DECADE'S, NOT A FLAT 25% (user-ruled 2026-09-20: *"in predictions, try assuming the actual wage share by
// estimating individual wages and applying profession multipliers. Note that an industry tier doesn't have a 'predicted wage', the decade and the
// economy does (e.g. 'stalling GBR in 1920')"*). So this tool is now asked WHICH economy it is predicting — `--economy GBR@1920` — and builds the
// wage bill as `wage(GBR, 1920) × Σ(employees × profession wage_weight)` per level, through tools/lib_wage_model.mjs. It used to charge every rung
// `wage_pct` 0.25 of goods — ⚠ which, measured exactly (F152 §10), is NOT far out for manufacturing (15–23% across the century; it is the WHOLE
// economy that runs 54% → 29%). It goes because it is a CONSTANT where the truth is a property of the economy and the decade, and because a share
// OF GOODS charged the ART ACADEMY almost nothing: its jobs live in its ownership PMG and `t.employment` is empty (F143 §1a).
// ⭐ AND THE HEADLINE IS PROFIT IN £ PER LEVEL PER WEEK, not the margin (the same ruling's first half).
//
// ⭐⭐ AND THE WAGE BILL IS JUST `wage × wage units` — NO premium, NO profit term (F152 §10, correcting §8's
// `1.19 + 0.30 × profit`, which was an artefact of approximating revenue). Measured against the exact bill
// a save reports (`goods_sales − goods_cost − profit`), `base_wage/10,000 × wage units × staffed levels`
// reproduces it to ~1% in the median from 1857 on. `predictProfit()` keeps the closed form only so that
// `--profit-wage-share` can still reproduce the retired reading; at the default 0 it is `O − I − W`.
//
// The three quantities a ladder has to satisfy at once, all computed at BASE prices from the book's own arithmetic (⚠ §10.86.2: base-price margins
// are a design coordinate, NOT a prediction of what a building earns — F139 measured the market compressing a designed 5/55/127/233 into a realised
// 26/31/47/46):
//   1. PROFIT per level per era = output − inputs − wages, all at base prices; the margin beside it is profit ÷ (inputs + wages). This is the
//      money printer, and it is now charged a real wage bill.
//   2. OBSOLESCENCE, F97's death test: a rung two behind must hold LESS THAN ~0.20 of the frontier's VALUE ADDED PER WORKER. Employment per level
//      is constant across an industry's rungs, so the ratio is just VA per level: (out_e - in_e) / (out_E - in_E).
//   3. CAPITAL per unit of output = cost_e / out_e, the dial F113/F117 swept — dearer means fewer frontier levels and less labour absorbed.
//   plus 4. THE 1836 ANCHOR ERROR (F137): a starting factory converted onto rung e produces `vanilla method 1 x out_e` where the vanilla method it
//      stands in for produces its OWN quantity, so the 1836 map over-produces by out_e / (that method's output). Measured EXACTLY here — per industry,
//      per rung, weighted by the LEVELS the emitted 1836 history actually places on that rung — not by F137's flat 1.33^e approximation.
//
// A ladder is given as either a ratio (geometric, `A=2.2`) or an explicit per-era list (`out=1,2,3.6,6`), which is what "more complex than
// anchor*A^era" means and what `make_ab_config --cost-ladder` already does for cost.
//
// usage: node tools/ladder_options.mjs [--book "name:out=<A|list>,in=<B|list>,cost=<C|list>,in0=<x>" ...] [--config <book>]
//                                      [--industry textile] [--economy GBR@1920] [--wage-premium 1.0] [--profit-wage-share 0]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVanilla } from './lib_vanilla_ladder.mjs';
import { tierEmployment, wageUnits, economyWage, predictProfit, WAGE_PREMIUM, PROFIT_WAGE_SHARE } from './lib_wage_model.mjs';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const argAll = k => process.argv.reduce((a, v, i) => (v === k && process.argv[i + 1] ? [...a, process.argv[i + 1]] : a), []);
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const CFG = argOf('--config', 'config/mod_config.json');

const PRICE = {};
for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) { const m = l.trim().split(/\t|\s+/); if (m.length >= 2 && +m[1] > 0) PRICE[m[0]] = +m[1]; }
const strip = s => s.replace(/^\uFEFF/, '').replace(/#.*$/mg, '');
const blocks = txt => { const out = {}; let d = 0, n = null, b = '';
  for (const l of strip(txt).split(/\r?\n/)) { if (d === 0) { const m = l.match(/^\s*([A-Za-z0-9_\-]+)\s*=\s*\{/); if (m) { n = m[1]; b = ''; } }
    if (n) b += l + '\n';
    for (const c of l) { if (c === '{') d++; else if (c === '}') { d--; if (d === 0 && n) { out[n] = b; n = null; } } } }
  return out; };
const PM = {}; for (const f of readdirSync(join(GAME, 'common/production_methods'))) Object.assign(PM, blocks(readFileSync(join(GAME, 'common/production_methods', f), 'utf8')));
const rec = pm => { const b = PM[pm]; if (!b) return null; const io = { in: {}, out: {} };
  for (const m of b.matchAll(/goods_(input|output)_([a-z_]+)_add\s*=\s*(-?[\d.]+)/g)) io[m[1] === 'input' ? 'in' : 'out'][m[2]] = +m[3];
  return io; };
const val = o => Object.entries(o).reduce((s, [g, q]) => s + q * (PRICE[g] || 0), 0);
const ANCH = { construction_cost_low: 200, construction_cost_medium: 400, construction_cost_high: 600, construction_cost_very_high: 800 };

// ---- the industries, their rungs, and each rung's own vanilla method output (the 1836 anchor reference)
const VAN = readVanilla(GAME);
const [ECON_TAG, ECON_YEAR] = (argOf('--economy', 'GBR@1920') + '@1920').split('@');
const PREMIUM = +argOf('--wage-premium', WAGE_PREMIUM);
const PSHARE = +argOf('--profit-wage-share', PROFIT_WAGE_SHARE);
const ECON = economyWage(ECON_TAG, +ECON_YEAR, { premium: PREMIUM });
const cfg = JSON.parse(readFileSync(join(REPO, CFG), 'utf8'));
const IND = [];
for (const ind of cfg.industries) { if (ind.disabled) continue;
  const tiers = ind.tiers.slice().sort((a, b) => a.era - b.era), t0 = tiers[0], r0 = rec(t0.vanilla_pm);
  if (!r0 || !Object.keys(r0.in).length) continue;
  const og = t0.output_good || ind.output_good, out0 = r0.out[og]; if (!(out0 > 0)) continue;
  const anchor = ANCH[(ind.building || {}).required_construction || ind.required_construction] || 600;
  // wage UNITS per level, per era — the profession mix changes up the ladder (textile 6,000 → 7,500 units) and the
  // ART ACADEMY has none of its own, so tierEmployment falls back to its ownership PMG (9,500 units, the F143 defect).
  const units = {};
  for (const t of tiers) units[t.era] = wageUnits(tierEmployment(t, ind, VAN));
  IND.push({ id: ind.id, og, out0, I0: val(r0.in), O0: out0 * PRICE[og], units, anchor,
    rungs: tiers.map(t => ({ key: t.key, era: t.era, vpm: t.vanilla_pm, vanOut: (rec(t.vanilla_pm) || { out: {} }).out[og] || null })) });
}

// ---- the 1836 map: levels per rung key, from the EMITTED history
const LEV = {};
const hdir = join(REPO, 'mod/common/history/buildings');
for (const f of readdirSync(hdir)) { const txt = strip(readFileSync(join(hdir, f), 'utf8'));
  for (const m of txt.matchAll(/create_building\s*=\s*\{([\s\S]*?)\n\t\t\t\}/g)) { const b = m[1];
    const k = (b.match(/building\s*=\s*"([a-z_0-9]+)"/) || [])[1]; if (!k) continue;
    let lv = 0; for (const o of b.matchAll(/levels\s*=\s*(\d+)/g)) lv += +o[1];
    LEV[k] = (LEV[k] || 0) + (lv || 1); } }

// ---- a ladder spec: a number (geometric) or an explicit per-era list
const ladder = (spec, eras) => { const parts = String(spec).split('/'); if (parts.length > 1) return parts.map(Number);
  const r = +spec; return Array.from({ length: eras }, (_, e) => Math.pow(r, e)); };
const BOOKS = argAll('--book').map(s => { const [name, rest] = s.split(':'); const o = { name };
  for (const kv of rest.split(',')) { const [k, v] = kv.split('='); o[k.trim()] = v.trim(); }
  return o; });
if (!BOOKS.length) { console.error('usage: --book "name:out=2.2,in=1.5,cost=1.9,in0=1.2" [--book ...]'); process.exit(2); }

const f1 = x => Number.isFinite(x) ? x.toFixed(1) : '—';
const f2 = x => Number.isFinite(x) ? x.toFixed(2) : '—';
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '—';
const ERAS = 4;
const ONE = argOf('--industry', '');

console.log('LADDER OPTIONS — designed at BASE prices (a design coordinate, never a prediction: the market compresses a designed ladder, F139)');
console.log('book = out/in/cost ladders (a ratio = geometric, or a /-separated per-era list) and the era-0 input penalty in0');
console.log('WAGES are the ECONOMY\'s and the DECADE\'s (user-ruled 2026-09-20), not a flat share: ' + ECON.tag + ' @ ' + ECON.year
  + ' — £' + ECON.wage.toFixed(4) + '/employee/wk × Σ(employees × profession wage_weight) per level'
  + (PREMIUM !== 1 ? '  [× a ' + PREMIUM + ' premium, NOT the default]' : '')
  + '  (the measured rate, vanilla n=' + ECON.n + ' seeds; --economy TAG@YEAR to move it)');
console.log('⭐ There is NO premium and NO profit term: measured against the exact wage bill, this reproduces it to ~1% in the median'
  + ' from 1857 on (F152 §10)' + (PSHARE ? '.  ⚠ --profit-wage-share ' + PSHARE + ' is ON: the retired §8 form.' : '') + '\n');

for (const B of BOOKS) {
  const out = ladder(B.out, ERAS), inn = ladder(B.in, ERAS), cost = ladder(B.cost, ERAS), in0 = +B.in0;
  console.log('=== ' + B.name + ' — out ' + out.map(f2).join(' / ') + ' · in ' + inn.map(f2).join(' / ') + ' · cost ' + cost.map(f2).join(' / ') + ' · in0 ' + in0 + ' ===');
  const rows = [], anchor = { our: {}, van: {} };
  for (const i of IND) {
    if (ONE && i.id !== ONE) { /* still counted for the anchor */ }
    const m = [], va = [], cap = [], be = [], pr = [], wg = [], inp = [];
    const eras = Object.keys(i.units).map(Number);
    for (let e = 0; e < ERAS; e++) { const O = i.O0 * out[e], I = i.I0 * in0 * inn[e], C = i.anchor * cost[e];
      // the rung at this era if the industry has one, else its nearest — the profession mix, not a flat share
      const ue = i.units[e] != null ? i.units[e] : i.units[eras.reduce((a, b) => Math.abs(b - e) < Math.abs(a - e) ? b : a)];
      // ⭐ the wage ANSWERS BACK: W = premium × normal-rate bill + PROFIT_WAGE_SHARE × profit (F152 §8), so the
      // profit is the closed form, not O − I − a fixed W. A design margin is damped by 1/1.30 before any price moves.
      const P = predictProfit({ revenue: O, inputs: I, employment: { laborers: ue }, wage: ECON.wage, profitShare: PSHARE });
      wg[e] = P.wages; inp[e] = I; pr[e] = P.profit; m[e] = P.margin; va[e] = O - I; cap[e] = C / (O / i.O0); be[e] = (I + P.wages) / O * 100; }
    const top = Math.max(...i.rungs.map(r => r.era));
    rows.push({ id: i.id, m, va, be, pr, wg, inp, top, d2: va[Math.max(0, top - 2)] / va[top], d3: top >= 3 ? va[top - 3] / va[top] : NaN });
    // the 1836 anchor: levels x our output vs levels x that rung's own vanilla method output
    for (const r of i.rungs) { const lv = LEV[r.key] || 0; if (!lv) continue;
      anchor.our[i.id] = (anchor.our[i.id] || 0) + lv * i.out0 * out[r.era];
      anchor.van[i.id] = (anchor.van[i.id] || 0) + lv * (r.vanOut != null ? r.vanOut : i.out0 * out[r.era]); }
  }
  const show = ONE ? rows.filter(r => r.id === ONE) : rows;
  const gbp = x => Number.isFinite(x) ? (x < 0 ? '-£' : '£') + Math.abs(Math.round(x)).toLocaleString('en-US') : '—';
  console.log('industry      PROFIT £/level/wk at base, e0 / e1 / e2 / e3          margin (profit ÷ (inputs+wages))   BE%          VA(t-2)/VA(t)  VA(t-3)/VA(t)');
  for (const r of show) console.log('  ' + r.id.padEnd(12) + r.pr.map(x => gbp(x).padStart(9)).join(' ') + '   ' + r.m.map(x => pc(x).padStart(6)).join(' ')
    + '   ' + r.be.map(x => x.toFixed(0)).join('/').padEnd(16) + f2(r.d2).padStart(6) + (r.d2 < 0.2 ? ' ✓' : ' ✗') + f2(r.d3).padStart(12) + (r.d3 < 0.2 ? ' ✓' : r.d3 ? ' ✗' : '  '));
  const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  console.log('  MEDIAN        ' + [0, 1, 2, 3].map(e => gbp(med(rows.map(r => r.pr[e]))).padStart(9)).join(' ') + '   ' + [0, 1, 2, 3].map(e => pc(med(rows.map(r => r.m[e]))).padStart(6)).join(' ')
    + '   death test (F97, < 0.20): ' + rows.filter(r => r.d2 < 0.2).length + '/' + rows.length + ' at two rungs back');
  console.log('  wage share of total cost (wages ÷ (inputs + wages)): ' + [0, 1, 2, 3].map(e => pc(med(rows.map(r => r.wg[e] / (r.wg[e] + r.inp[e]))))).join(' / ')
    + '   [measured exactly, F152 §10: MANUFACTURING runs 15–23% across the century; the whole economy 54% → 29%. The flat wage_pct was 25%]');
  console.log('  capital per unit of output (cost / output, e0=1.00): ' + [0, 1, 2, 3].map(e => f2(cost[e] / out[e])).join(' / '));
  // the 1836 anchor error, world-wide
  let ours = 0, vans = 0; const per = [];
  for (const id of Object.keys(anchor.our)) { ours += anchor.our[id]; vans += anchor.van[id];
    const x = anchor.our[id] / anchor.van[id]; if (x > 1.001) per.push(id + ' +' + ((x - 1) * 100).toFixed(0) + '%'); }
  console.log('  ⭐ 1836 ANCHOR (F137): the emitted map produces ' + ((ours / vans - 1) * 100).toFixed(1) + '% more than the vanilla methods it stands in for'
    + (per.length ? '  —  ' + per.sort((a, b) => +b.split('+')[1].slice(0, -1) - +a.split('+')[1].slice(0, -1)).slice(0, 6).join(' · ') : ''));
  console.log('');
}
