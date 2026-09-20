#!/usr/bin/env node
// ⭐⭐ THE ERA-0 SOLVENCY CENSUS — WHAT AN INPUT PENALTY DOES TO THE 1836 MAP, AT THE PRICES THE GAME ACTUALLY PRODUCES.
//
// Read-only. Written 2026-09-19 for the user's two standing principles (BALANCE_FRAMEWORK §10.86: realised prices are far off base,
// mostly by design and significantly by seed; they are hardly transferable between configs; understand where prices GO first, and plan
// the config around that) and for the question they attach to it: if the era-0 input penalty (`--in0` / `--in0-level` in
// make_ab_config) is raised so the 1836 rung cannot pay its way at BASE prices, how many of the industries standing on the 1836 map are
// insolvent at the prices the game actually realises, and which of them are dead beyond rescue?
//
// THE BASIS, stated because it is what makes the comparison honest:
//   • Each industry's era-0 recipe is rebuilt exactly as `make_ab_config.mjs` builds it — vanilla's own FIRST main method, output
//     untouched, inputs rescaled so their BASE-price value is I0 × lift, the mix kept, the same 0.1 rounding. lift = 1.0 IS vanilla's
//     own recipe, which is why the vanilla column is like-for-like and not a different model.
//   • Prices are the MEDIAN over the vanilla baseline's sixteen seeds, per market, per good, at a dump date (default 1836.2.1 — the
//     anchor; `--date 1840.1.1` for the settled early game). Seven markets are instrumented.
//   • ⭐ THE WAGE IS THE ECONOMY'S AND THE DECADE'S (user-ruled 2026-09-20): the market leader's own NORMAL WAGE RATE at this date,
//     median over the vanilla seeds (config/measured_base_wages.json), × the measured **1.19×** premium — through
//     tools/lib_wage_model.mjs. It was a seven-entry hardcoded table derived from F92's identity, which F150 showed to be a
//     mixed-units ratio.
//     ⭐⭐ NO PREMIUM AND NO PROFIT TERM (F152 §10, correcting §8): measured against the exact wage bill a save reports
//     (`goods_sales − goods_cost − profit`), `rate × wage units × staffed levels` reproduces it to ~1% in the median from
//     1857 on. `--profit-wage-share 0.30` reproduces the retired §8 reading.
//     ⭐ Employment comes from `tierEmployment`, so the ART ACADEMY is charged the 9,500 wage units of its OWNERSHIP PMG
//     instead of the zero its empty `employment` used to give it (F143 §1a).
//   • PROFIT in £ per level per week is the reported quantity (user-ruled 2026-09-20); margin = (O − I − W) ÷ (I + W) beside it.
//   • BASE METHOD ONLY — no secondary PMs and no throughput. Both sides of every comparison are on that basis, so the DIFFERENCE
//     between two lifts is exact; the LEVEL is a few points pessimistic (the +20% economy-of-scale case is carried internally as `thr`).
//
// THE TWO VERDICTS:
//   insolvent      margin < 0 at that market's realised prices.
//   VERY DEAD      margin < the `--dead` threshold (default −20%) AND still < 0 after the output good's sell orders are DIVIDED BY 3
//                  and the price re-derived from the engine's own formula (price = base × (1 + 0.75 × clamp((buy−sell)/min, ±1)),
//                  band 25–175%) — i.e. scarcity cannot rescue it. The absolute test (`ceiling`) is the same margin at the 175% band
//                  edge: dead there is dead at ANY price the engine can quote.
//   ⚠ Input prices are held at their realised values in both tests. A dying industry stops buying, so its inputs would cheapen — the
//     test is therefore conservative in the direction of calling things dead.
//
// usage: node tools/era0_solvency.mjs [--lifts 1.0,1.2,1.4,1.6] [--levels -0.1,-0.2,-0.3] [--date 1836.2.1]
//                                     [--van <session>] [--config <book>] [--dead -0.20] [--detail] [--markets a,b]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVanilla } from './lib_vanilla_ladder.mjs';
import { tierEmployment, wageUnits, economyWage, PROFIT_WAGE_SHARE } from './lib_wage_model.mjs';
import { MARKET_NAMES } from './testbed/ledger/lib_markets.mjs';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const LIFTS = argOf('--lifts', '1.0,1.2,1.4,1.6').split(',').filter(Boolean).map(Number);
const LEVELS = argOf('--levels', '-0.10,-0.20,-0.30').split(',').filter(Boolean).map(Number);
const DATE = argOf('--date', '1836.2.1');
const VAN = argOf('--van', '20260821_131149_vanilla-baseline-n16');
const CFG = argOf('--config', 'config/mod_config.json');
const DEAD = +argOf('--dead', '-0.20');
const PSHARE = +argOf('--profit-wage-share', PROFIT_WAGE_SHARE);
const DETAIL = process.argv.includes('--detail');
const ONLY = (argOf('--markets', '') || '').split(',').filter(Boolean);

// ---- base prices, vanilla methods, wage weights
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
const WW = {}; for (const f of readdirSync(join(GAME, 'common/pop_types'))) { const bs = blocks(readFileSync(join(GAME, 'common/pop_types', f), 'utf8'));
  for (const [k, b] of Object.entries(bs)) { const m = b.match(/wage_weight\s*=\s*([\d.]+)/); WW[k] = m ? +m[1] : 1; } }
const val = o => Object.entries(o).reduce((s, [g, q]) => s + q * (PRICE[g] || 0), 0);
const r1 = x => Math.round(x * 10) / 10;

const VLAD = readVanilla(GAME);   // the live game (vanilla PMGs/methods), for tierEmployment - VAN is the vanilla SESSION
// ---- the industries' era-0 anchors, from the book's own first rung
const cfg = JSON.parse(readFileSync(join(REPO, CFG), 'utf8'));
const IND = [];
for (const ind of cfg.industries) { if (ind.disabled) continue;
  const tiers = ind.tiers.slice().sort((a, b) => a.era - b.era), t0 = tiers[0], r0 = rec(t0.vanilla_pm);
  if (!r0 || !Object.keys(r0.in).length) continue;
  const og = t0.output_good || ind.output_good, out0 = r0.out[og]; if (!(out0 > 0)) continue;
  const wp = t0.wage_pct != null ? +t0.wage_pct : 0.25;
  // ⭐ wage units through tierEmployment (2026-09-20): a tier with no `employment` of its own — the ART ACADEMY, whose
  // jobs live in its ownership PMG — used to score ZERO wage units here and so looked free to run (F143 §1a).
  IND.push({ id: ind.id, pm: t0.vanilla_pm, og, out0, mix: r0.in, I0: val(r0.in), O0: out0 * PRICE[og], wp,
    units: wageUnits(tierEmployment(t0, ind, VLAD)),
    firstEra: t0.era, onMap: t0.era === 0 });
}
// the recipe a lift produces (the make_ab_config rule, rounding included)
const recipeAt = (i, lift) => { const V = i.I0 * lift, inp = {};
  for (const [g, q] of Object.entries(i.mix)) { const share = q * PRICE[g] / i.I0, qty = r1(share * V / PRICE[g]); if (qty > 0) inp[g] = qty; }
  return inp; };
// the per-industry lift that lands the notional era-0 margin on m at base prices (make_ab_config --in0-level)
const levelLift = (i, m) => i.O0 * (1 - i.wp) / (i.I0 * (1 + m));

// ---- realised prices: the median over the vanilla baseline's seeds
const rows = readFileSync(join(REPO, 'tools/testbed/sessions', VAN, 'markets_all.tsv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(l => l.split('\t'));
const acc = {};
for (const r of rows) { if (r[2] !== DATE) continue; const mk = r[3], g = r[5];
  ((acc[mk] ||= {})[g] ||= { p: [], buy: [], sell: [], prod: [] });
  acc[mk][g].p.push(+r[8]); acc[mk][g].buy.push(+r[6]); acc[mk][g].sell.push(+r[7]); acc[mk][g].prod.push(+r[11]); }
const med = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); if (!b.length) return NaN; return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const MK = {}; for (const [mk, gs] of Object.entries(acc)) { MK[mk] = {}; for (const [g, v] of Object.entries(gs)) MK[mk][g] = { price: med(v.p), buy: med(v.buy), sell: med(v.sell), prod: med(v.prod), n: v.p.length, spread: [Math.min(...v.p), Math.max(...v.p)] }; }
// ⭐⭐ THE BASE WAGE PER MARKET, MEASURED, AT THIS DATE'S DECADE (2026-09-20). It used to be a seven-entry hardcoded
// table "the wage rate F92 implies" — i.e. derived from the identity F150 found to be a mixed-units ratio, so it was
// wrong by whatever the market's price level was. Now it is the market leader's own NORMAL WAGE RATE from
// config/measured_base_wages.json (the save's `base_wage` ÷ POP_SIZE_PACKAGE, median over the vanilla seeds) × the
// measured 1.19× premium (the wage bill's first term; the second is 0.30 × the profit, applied in `read()` below). The
// table grows with the instrumented markets: add a tag to
// lib_markets.MARKET_NAMES and it appears here.
const YEAR = +String(DATE).split('.')[0];
const WAGE = {}, WAGE_SRC = {};
for (const [tag, names] of Object.entries(MARKET_NAMES)) {
  let e = null; try { e = economyWage(tag, YEAR); } catch { continue; }
  for (const n of names) if (!(n in WAGE)) { WAGE[n] = e.wage; WAGE_SRC[n] = e; }
}
const MARKETS = Object.keys(MK).filter(m => WAGE[m] && (!ONLY.length || ONLY.some(o => m.toLowerCase().startsWith(o.toLowerCase()))));

// ---- the engine's own price formula
const priceOf = (base, buy, sell) => { if (!(buy > 0) && !(sell > 0)) return base;
  const m = Math.min(buy, sell); const d = m > 0 ? (buy - sell) / m : (buy > 0 ? 1 : -1);
  return base * (1 + 0.75 * Math.max(-1, Math.min(1, d))); };

// ---- one (industry, market, lift) reading
function read(i, mk, lift) {
  const P = MK[mk], out = P[i.og]; if (!out || !(out.prod > 0)) return null;   // not on this market's 1836 map
  const inp = recipeAt(i, lift); let I = 0;
  for (const [g, q] of Object.entries(inp)) { const p = P[g] && P[g].price; if (!(p > 0)) return null; I += q * p; }
  // ⭐ THE WAGE ANSWERS BACK (F152 §8): W = the normal-rate bill × 1.19 + 0.30 × the profit itself, so the
  // profit is the closed form `(O − I − Wn) ÷ 1.30` and not `O − I − a fixed W`. Wn is the normal-rate part;
  // WAGE[mk] already carries the 1.19. A LOSS-MAKING rung is charged LESS wage, which is the engine's own
  // lower-wages rule and is why the closed form must be used on both sides of every comparison here.
  const O = i.out0 * out.price, Wn = i.units * WAGE[mk];
  const at = (rev, inp, mult = 1) => { const P = (rev - inp - Wn) / (1 + PSHARE); const w = rev - inp - P; return { P, w, m: (inp + w) > 0 ? P / (inp + w) : NaN }; };
  const base = at(O, I);
  const W = base.w, margin = base.m, goods = (O - I) / I;
  const thr = at(1.2 * O, 1.2 * I).m;
  const p3 = Math.max(0.25 * PRICE[i.og], Math.min(1.75 * PRICE[i.og], priceOf(PRICE[i.og], out.buy, out.sell / 3)));
  const m3 = at(i.out0 * p3, I).m;
  const mCap = at(i.out0 * 1.75 * PRICE[i.og], I).m;
  return { margin, goods, thr, m3, mCap, O, I, W, Wn, profit: base.P, price: out.price, pShare: out.price / PRICE[i.og], p3, prod: out.prod };
}

// ---- the option set
const OPTIONS = [
  ...LIFTS.map(L => ({ key: (L === 1 ? 'vanilla x1.0' : 'x' + L), kind: 'scalar', L })),
  ...LEVELS.map(m => ({ key: 'level ' + (m >= 0 ? '+' : '') + (m * 100).toFixed(0) + '%', kind: 'level', m })),
];
const liftFor = (o, i) => o.kind === 'scalar' ? o.L : levelLift(i, o.m);
const pc0 = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '—';

const seeds = MK[MARKETS[0]] ? MK[MARKETS[0]][Object.keys(MK[MARKETS[0]])[0]].n : 0;
console.log('ERA-0 SOLVENCY CENSUS — ' + CFG.replace(/^config\//, '') + ' | prices = the median of ' + VAN + ' at ' + DATE + ' (n=' + seeds + ' seeds) | ' + MARKETS.length + ' markets');
console.log('margin = (O - I - W)/(I + W), base method only. VERY DEAD = margin < ' + pc0(DEAD) + ' AND still negative with the output sell orders / 3.');
console.log('WAGES: each market leader\'s own measured wage rate at ' + YEAR + ' (£/employee/wk) x the rung\'s profession-weighted employment — '
  + MARKETS.map(m => m.split(' ')[0] + ' GBP' + WAGE[m].toFixed(4) + (WAGE_SRC[m] && WAGE_SRC[m].year !== YEAR ? '@' + WAGE_SRC[m].year : '')).join(' · '));
console.log('   no premium and no profit term (F152 §10): that reproduces the exact wage bill a save reports to ~1% in the median'
  + (PSHARE ? '.  ⚠ --profit-wage-share ' + PSHARE + ' is ON: the retired §8 form.' : '') + '\n');

// ---- 1. the book side
console.log('=== 1. THE RECIPES - what each option asks of the OUTPUT PRICE (target_be = the % of base at which the rung breaks even) ===');
const onMap = IND.filter(i => i.onMap);
let head = 'industry      era  ';
for (const o of OPTIONS) head += (o.key + '              ').slice(0, 15);
console.log(head);
for (const i of IND) { let l = (i.id + (i.onMap ? '' : ' *')).padEnd(14) + ('e' + i.firstEra).padEnd(5);
  for (const o of OPTIONS) { const lift = liftFor(o, i); const I = val(recipeAt(i, lift));
    const be = I / ((1 - i.wp) * i.O0) * 100;
    l += ('x' + lift.toFixed(2) + ' ' + be.toFixed(0) + '%').padEnd(15); }
  console.log(l); }
console.log('  (the number after the lift is target_be: the output price, as % of base, at which that rung covers goods + wages.');
console.log('   * = no era-0 rung, so nothing of it stands on the 1836 map - shown because the same lift anchors its ladder.)\n');

// ---- 2. the census
console.log('=== 2. THE 1836 MAP AT REALISED PRICES - ' + DATE + ' ===');
const cells = [];
for (const i of onMap) for (const mk of MARKETS) { const v0 = read(i, mk, 1.0); if (v0) cells.push({ i, mk }); }
console.log('present (industry x market) cells: ' + cells.length + ' over ' + onMap.length + ' era-0 industries and ' + MARKETS.length + ' markets\n');
const table = [];
const VANC = {};   // the vanilla margin of every cell, the like-for-like reference
for (const { i, mk } of cells) VANC[i.id + '|' + mk] = read(i, mk, 1.0).margin;
const prodOf = (i, mk) => MK[mk][i.og].prod;   // that market's own output of the good — how much of the map the cell is
const PTOT = cells.reduce((s, c) => s + prodOf(c.i, c.mk) * PRICE[c.i.og], 0);
for (const o of OPTIONS) {
  const row = { key: o.key, ins: 0, dead: 0, deadCap: 0, insW: 0, byMarket: {}, worst: [], m: [], byInd: {} };
  for (const { i, mk } of cells) { const v = read(i, mk, liftFor(o, i)); if (!v) continue;
    row.m.push(v.margin); (row.byInd[i.id] ||= []).push(v.margin);
    (row.byMarket[mk] ||= { n: 0, ins: 0, dead: 0 }).n++;
    if (v.margin < 0) { row.ins++; row.byMarket[mk].ins++; row.insW += prodOf(i, mk) * PRICE[i.og]; }
    if (v.margin < DEAD && v.m3 < 0) { row.dead++; row.byMarket[mk].dead++; row.worst.push({ i, mk, v }); }
    if (v.mCap < 0) row.deadCap++; }
  table.push(row); }
console.log('option          insolvent    by OUTPUT   VERY DEAD   dead at the   median   per-market insolvent (of present)');
console.log('                of ' + String(cells.length).padStart(3) + '       VALUE       (/3 test)   175% ceiling  margin');
for (const r of table) {
  const perM = MARKETS.map(m => (m.split(' ')[0].slice(0, 4) + ' ' + (r.byMarket[m] ? r.byMarket[m].ins + '/' + r.byMarket[m].n : '-'))).join('  ');
  console.log(r.key.padEnd(15) + String(r.ins).padStart(4) + ' (' + (100 * r.ins / cells.length).toFixed(0).padStart(3) + '%)' +
    ((100 * r.insW / PTOT).toFixed(0) + '%').padStart(10) + String(r.dead).padStart(11) + String(r.deadCap).padStart(13) + '   ' + pc0(med(r.m)).padStart(5) + '   ' + perM); }
console.log('  (by OUTPUT VALUE = the share of the seven markets\' 1836 production of these goods, at base prices, that sits in a loss-making cell.)\n');

// ---- 2b. which industries carry it
console.log('=== 2b. THE MEDIAN MARGIN PER INDUSTRY, ACROSS THE MARKETS IT STANDS IN ===');
let h2 = 'industry      mkts  '; for (const o of OPTIONS) h2 += (o.key + '          ').slice(0, 11); console.log(h2);
for (const i of onMap) { let l = i.id.padEnd(14) + String((table[0].byInd[i.id] || []).length).padStart(3) + '   ';
  for (const r of table) l += pc0(med(r.byInd[i.id] || [])).padStart(9) + '  ';
  console.log(l); }
console.log('');

// ---- 3. the very dead, named
console.log('=== 3. WHAT IS VERY DEAD (margin < ' + pc0(DEAD) + ' and scarcity cannot rescue it) ===');
for (const r of table) {
  if (!r.worst.length) { console.log(r.key.padEnd(15) + '- none'); continue; }
  const byInd = {}; for (const w of r.worst) (byInd[w.i.id] ||= []).push(w);
  console.log(r.key.padEnd(15) + r.worst.length + ' cells:');
  for (const [id, ws] of Object.entries(byInd)) console.log('    ' + id.padEnd(12) + ws.map(w => w.mk.split(' ')[0] + ' ' + pc0(w.v.margin) + '->' + pc0(w.v.m3) + (w.v.mCap < 0 ? '!!' : '') + ' [vanilla ' + pc0(VANC[id + '|' + w.mk]) + ']').join(' | ')); }
console.log('  (x->y = the margin now, and after the output sell orders are divided by 3. !! = still negative at the 175% band edge: dead at any price.');
console.log('   [vanilla n%] = the SAME cell on vanilla\'s own recipe at the same prices — the like-for-like reference.)\n');

// ---- 4. what the penalty does to the ANCHOR before anyone reacts: value added, and the input goods' own prices
console.log('=== 4. THE FIRST-ORDER COST TO THE 1836 ANCHOR (the same seven markets, at ' + DATE + ') ===');
console.log('The penalty buys more input per unit of output, so on the day it ships — before a single building is rebuilt — the tiered sector\'s');
console.log('VALUE ADDED falls and the input goods\' BUY ORDERS rise. Both are first-order and both push on the register\'s HARD 1836-1845 anchor.');
console.log('VA is Sigma over markets of production x (price - input cost per unit of output) at that market\'s realised prices.\n');
const inputUnits = (i, mk, lift) => { const P = MK[mk], out = P[i.og]; if (!out || !(out.prod > 0)) return null;
  const inp = recipeAt(i, lift), per = out.prod / i.out0, u = {};
  for (const [g, q] of Object.entries(inp)) u[g] = per * q; return u; };
console.log('option          tiered VA of the 7 markets   vs vanilla   input goods whose price the extra demand moves (first-order)');
for (const o of OPTIONS) {
  let VA = 0; const extra = {};
  for (const { i, mk } of cells) { const P = MK[mk], out = P[i.og], inp = recipeAt(i, liftFor(o, i));
    let perUnit = 0; for (const [g, q] of Object.entries(inp)) perUnit += q * (P[g] ? P[g].price : 0);
    VA += out.prod * out.price - out.prod / i.out0 * perUnit;
    const u1 = inputUnits(i, mk, 1.0), uL = inputUnits(i, mk, liftFor(o, i));
    for (const g of Object.keys(uL)) ((extra[mk] ||= {})[g] = (extra[mk][g] || 0) + (uL[g] - u1[g])); }
  let VA1 = 0; for (const { i, mk } of cells) { const P = MK[mk], out = P[i.og], inp = recipeAt(i, 1.0);
    let pu = 0; for (const [g, q] of Object.entries(inp)) pu += q * (P[g] ? P[g].price : 0); VA1 += out.prod * out.price - out.prod / i.out0 * pu; }
  const moves = [];
  for (const [mk, gs] of Object.entries(extra)) for (const [g, du] of Object.entries(gs)) { if (!(du > 0)) continue;
    const q = MK[mk][g]; if (!q) continue; const p0 = q.price, p1 = Math.max(0.25 * PRICE[g], Math.min(1.75 * PRICE[g], priceOf(PRICE[g], q.buy + du, q.sell)));
    if (p1 / p0 > 1.05) moves.push(mk.split(' ')[0].slice(0, 4) + ' ' + g + ' ' + (100 * p0 / PRICE[g]).toFixed(0) + '->' + (100 * p1 / PRICE[g]).toFixed(0) + '%'); }
  console.log(o.key.padEnd(15) + ('£' + (VA / 1000).toFixed(0) + 'k/wk').padStart(14) + '            ' + (100 * VA / VA1).toFixed(0).padStart(4) + '%      ' + (moves.length ? moves.slice(0, 6).join(' · ') + (moves.length > 6 ? ' · +' + (moves.length - 6) + ' more' : '') : '-'));
}
console.log('  (the input-price move is FIRST ORDER: the extra demand of the era-0 buildings that already stand, against that market\'s own');
console.log('   order book, through the engine\'s price formula. It feeds straight back into the margins above, which do NOT include it.)\n');

// ---- 5. the whole century, in vanilla's own price environment
if (process.argv.includes('--century')) {
  console.log('=== 5. THE SAME RUNG THROUGH VANILLA\'S WHOLE CENTURY (share of market x date cells where the era-0 rung pays its way) ===');
  console.log('Directional only: our own late-century prices are NOT vanilla\'s (the mod drives them down, PI 0.84). What it does say is how');
  console.log('often a given break-even is reachable AT ALL in a real price environment.\n');
  const DATES = ['1836.2.1', '1840.1.1', '1850.1.1', '1860.1.1', '1870.1.1', '1880.1.1', '1890.1.1', '1900.1.1', '1910.1.1', '1920.1.1', '1930.1.1', '1935.1.1'];
  const acc2 = {};
  for (const r of rows) { const d = r[2]; if (!DATES.includes(d)) continue; const mk = r[3], g = r[5];
    ((((acc2[d] ||= {})[mk] ||= {})[g] ||= { p: [], buy: [], sell: [], prod: [] }));
    acc2[d][mk][g].p.push(+r[8]); acc2[d][mk][g].buy.push(+r[6]); acc2[d][mk][g].sell.push(+r[7]); acc2[d][mk][g].prod.push(+r[11]); }
  const snap = {}; for (const [d, mks] of Object.entries(acc2)) { snap[d] = {}; for (const [mk, gs] of Object.entries(mks)) { snap[d][mk] = {}; for (const [g, v] of Object.entries(gs)) snap[d][mk][g] = { price: med(v.p), prod: med(v.prod) }; } }
  console.log('option          ' + DATES.map(d => d.split('.')[0].slice(2)).map(x => ('  ' + x).slice(-4)).join('') + '     mean');
  for (const o of OPTIONS) { let l = o.key.padEnd(15); const all = [];
    for (const d of DATES) { let n = 0, ok = 0;
      for (const i of onMap) for (const mk of MARKETS) { const P = snap[d][mk]; const out = P && P[i.og]; if (!out || !(out.prod > 0)) continue;
        const inp = recipeAt(i, liftFor(o, i)); let I = 0, bad = false;
        for (const [g, q] of Object.entries(inp)) { const p = P[g] && P[g].price; if (!(p > 0)) { bad = true; break; } I += q * p; }
        if (bad) continue; n++; if ((i.out0 * out.price - I - i.units * WAGE[mk]) > 0) ok++; }
      const s = n ? 100 * ok / n : NaN; all.push(s); l += (Number.isFinite(s) ? s.toFixed(0) + '%' : '-').padStart(4); }
    console.log(l + '   ' + (all.reduce((a, b) => a + b, 0) / all.length).toFixed(0).padStart(4) + '%'); }
  console.log('');
}

// ---- 6. per-industry detail
if (DETAIL) { console.log('=== 6. PER INDUSTRY x MARKET ===');
  for (const i of onMap) { console.log('\n--- ' + i.id + ' (' + i.pm + ' -> ' + i.out0 + ' ' + i.og + ', wage units ' + i.units + ') ---');
    console.log('market        out£  %base   ' + OPTIONS.map(o => (o.key + '          ').slice(0, 10)).join(''));
    for (const mk of MARKETS) { const v0 = read(i, mk, 1.0); if (!v0) continue;
      let l = mk.split(' ')[0].padEnd(12) + String(v0.price.toFixed(0)).padStart(5) + (100 * v0.pShare).toFixed(0).padStart(6) + '%   ';
      for (const o of OPTIONS) { const v = read(i, mk, liftFor(o, i)); l += pc0(v.margin).padStart(8) + '  '; }
      console.log(l); } } }
