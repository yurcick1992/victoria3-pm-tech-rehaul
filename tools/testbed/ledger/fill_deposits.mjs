#!/usr/bin/env node
// THE TIERED DEPOSITS IN THE LEDGER (2026-11-22; the user accepted the forms proposed with FINDINGS F285: "I agree on your suggestion on
// deposits. Implement it"). The mod 1.2 book tiers nine deposit buildings (coal, iron, lead, sulfur, copper, gold, fishing, whaling, oil;
// BALANCE_FRAMEWORK §10.115): each main method is a building with slots of its own, so a newer rung ADDS capacity beside the old pits rather
// than replacing them. The manufacturing panels (T0–T3, old plants, below the best tier) do not apply and never read them (landmine L55); this
// section reads them on their own terms, the mod against vanilla's one building of the same resource:
//   (1) output by rung, stacked, one small chart per deposit, by decade, with vanilla's same building as a line;
//   (2) slot fill and staffed share by rung, world, at 1880 / 1900 / 1920 / 1936 (vanilla's one building beside it);
//   (3) raw supply: world output of each deposit good ÷ vanilla's, and its world price ÷ base, mod / vanilla, by decade;
//   (4) labour and capital: workers in the deposits as a share of productive workers, and the construction points held in them, against vanilla's
//       same buildings — two scorecard readings (no aim) — and a by-rung table in both views;
//   (5) years to repay by rung at realised prices (£720 a construction point, fill_payback.mjs's convention);
//   (6) the 1836–1845 supply of each deposit good against vanilla's 90% range (±10%) — one scorecard line under "Are the runs sound?".
// HOW THE QUANTITIES ARE READ (save summaries, first summary of each year; medians over each arm's runs):
//   a rung's OUTPUT = its value of output at base prices (`va_out`, which carries throughput, company bonuses and the output-adding secondary
//   lines) × the main good's share of its recipe's base-priced output (whaling makes meat beside its oil) ÷ the main good's base price;
//   WORKERS = staffing × one level's employment under its active methods (lib_workforce_groups.mjs: the methods read live from the game and the
//   build the runs played); CAPITAL = levels × the rung's construction cost (the book's; vanilla's own for vanilla's building);
//   SLOTS = the state regions' capped resources in the BUILD's map (`--map`; a deposit's slots are split over its rungs by emit_deposit_slots.mjs),
//   summed per region, which is exact at the world level. Gold's and oil's slots change in play (gold fields deplete into the gold rungs; a
//   found oil block opens the second rung): both are shown against their FULL potential (every field depleted, every block found), an upper
//   bound on the slots open at the time — labelled so. Vanilla's gold fields and the buildings no rung replaces are left out of both arms.
//   node tools/testbed/ledger/fill_deposits.mjs <outDir> --mod <sess/run,…> --van <sess/run,…> --config <book> [--map <build dir>]
// Writes deposits.json (fill_scorecard.mjs reads the scorecard lines from it), deposits_world.html and deposits_pool.html (fill_assemble.mjs
// splices them as __DEPOSITS_W__ / __DEPOSITS_S__). A book without tiered deposits writes a one-line card saying so.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { indexRun, firstOf, readSum, SESSIONS, ROOT, med } from './lib_sumidx.mjs';
import { POOL } from './lib_markets.mjs';
import { depositList } from './lib_industries.mjs';
import { workforceModel, DEFAULT_GAME } from './lib_workforce_groups.mjs';
import { requiredConstruction } from '../../vanilla_construction.mjs';

const argv = process.argv.slice(2), DIR = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf(k); return i > 0 && argv[i + 1] ? argv[i + 1] : d; };
const MODS = (opt('--mod') || '').split(',').filter(Boolean), VANS = (opt('--van') || '').split(',').filter(Boolean), BOOK = opt('--config');
const MAPDIR = opt('--map', 'mod'), GAME = opt('--game', DEFAULT_GAME);
if (!DIR || !MODS.length || !VANS.length || !BOOK) { console.error('usage: fill_deposits.mjs <outDir> --mod <runs> --van <runs> --config <book> [--map <build dir>]'); process.exit(2); }
const cfg = JSON.parse(readFileSync(BOOK, 'utf8').replace(/^﻿/, ''));
// L55: REVIEWED — this reader takes the tiered deposits alone (depositList), never a tier reading of manufacturing
const DEP = depositList(cfg);
const card = (h, body) => `<div class="card"><h3>${h}</h3>${body}</div>`;
if (!DEP.length) {
  const c = card('Tiered deposits', '<p class="dim">This book carries no tiered deposits (BALANCE_FRAMEWORK §10.115): its mines, wharves and rigs are vanilla’s buildings.</p>');
  writeFileSync(join(DIR, 'deposits.json'), JSON.stringify({ none: true, book: BOOK }));
  for (const f of ['deposits_world.html', 'deposits_pool.html']) writeFileSync(join(DIR, f), c);
  console.log('deposits: the book carries no tiered deposits — one card says so'); process.exit(0);
}
const D = cfg._deposits || { industries: {} };
const BASE = Object.fromEntries(readFileSync(join(ROOT, 'tools', 'goods_prices.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));
const VCOST = requiredConstruction(GAME);
const NAME = { coal_mine: 'Coal', iron_mine: 'Iron', lead_mine: 'Lead', sulfur_mine: 'Sulfur', copper_mine: 'Copper', gold_mine: 'Gold', fishing_wharf: 'Fishing', whaling_station: 'Whaling', oil_rig: 'Oil' };
// the industries, their rungs (by tier) and vanilla's building (the first rung's key IS vanilla's)
const IND = DEP.map(ind => {
  const rungs = (ind.tiers || []).filter(t => t.key && !t.method_of).slice().sort((a, b) => a.era - b.era).map(t => {
    const good = t.output_good || ind.output_good, main = (+t.output_qty || 0) * (BASE[good] || 0);
    const extra = Object.entries(t.extra_outputs || {}).reduce((s, [g, q]) => s + q * (BASE[g] || 0), 0);
    return { key: t.key, era: t.era, out: +t.output_qty || 0, cost: +t.building_cost || 0, good, share: main + extra > 0 ? main / (main + extra) : 1, name: t.pm_name || t.name };
  });
  const R = D.industries?.[ind.id] || {};
  return { id: ind.id, name: NAME[ind.id] || ind.id, good: ind.output_good, rungs, van: rungs[0].key, vanShare: rungs[0].share, vanCost: VCOST[rungs[0].key] ?? null,
    mult: +R.slot_mult || null, discover: R.discover || null, upper: !!R.discover };
});
const RUNG = Object.fromEntries(IND.flatMap(I => I.rungs.map(r => [r.key, { ...r, ind: I.id }])));
const GOODS = [...new Set(IND.map(I => I.good))];

// ---- the slots: state regions, vanilla's files with the build's own replacing them by name
function regions(files) {
  const R = {};
  for (const fp of files) {
    const txt = readFileSync(fp, 'utf8').replace(/^﻿/, '').replace(/#[^\n]*/g, ''); const re = /^(STATE_[A-Z0-9_]+)\s*=\s*\{/gm; let m;
    while ((m = re.exec(txt))) { let i = re.lastIndex, d = 1; while (d > 0 && i < txt.length) { const c = txt[i++]; if (c === '{') d++; else if (c === '}') d--; }
      const body = txt.slice(re.lastIndex, i - 1), r = { cap: {}, res: [] };
      const cr = /capped_resources\s*=\s*\{([^}]*)\}/.exec(body); if (cr) for (const q of cr[1].matchAll(/([a-z_0-9]+)\s*=\s*(\d+)/g)) r.cap[q[1]] = +q[2];
      for (const q of body.matchAll(/resource\s*=\s*\{([^}]*)\}/g)) { const ty = /type\s*=\s*"([a-z_0-9]+)"/.exec(q[1]); if (!ty) continue;
        const dt = /depleted_type\s*=\s*"([a-z_0-9]+)"/.exec(q[1]), da = /discovered_amount\s*=\s*(\d+)/.exec(q[1]), ua = /undiscovered_amount\s*=\s*(\d+)/.exec(q[1]);
        r.res.push({ type: ty[1], depleted: dt ? dt[1] : null, amount: (da ? +da[1] : 0) + (ua ? +ua[1] : 0) }); }
      R[m[1]] = r; re.lastIndex = i; }
  }
  return R;
}
const SR = d => join(d, 'map_data', 'state_regions');
const vanFiles = new Map(readdirSync(SR(GAME)).filter(f => f.endsWith('.txt')).map(f => [f, join(SR(GAME), f)]));
const modFiles = new Map(vanFiles);
if (!existsSync(SR(MAPDIR))) throw new Error('fill_deposits: --map ' + MAPDIR + ' has no map_data/state_regions — pass the build the runs played (e.g. mod_m12b)');
for (const f of readdirSync(SR(MAPDIR)).filter(f => f.endsWith('.txt'))) modFiles.set(f, join(SR(MAPDIR), f));
const REG_MOD = regions([...modFiles.values()]), REG_VAN = regions([...vanFiles.values()]);
// world slots per rung (mod) and per vanilla building; gold and oil at their full potential (§10.124 item 2: the hooks)
const slotsMod = {}, slotsVan = {};
for (const I of IND) {
  for (const r of I.rungs) slotsMod[r.key] = 0; slotsVan[I.van] = 0;
  for (const R of Object.values(REG_MOD)) {
    for (const r of I.rungs) slotsMod[r.key] += R.cap[r.key] || 0;
    for (const x of R.res) {
      if (I.discover === 'linked_second_rung' && x.type === I.rungs[0].key) for (const r of I.rungs) slotsMod[r.key] += x.amount;   // the found block's share, each rung
      if (I.discover === 'depleted_from_gold_fields' && x.depleted === I.rungs[0].key) for (const r of I.rungs) slotsMod[r.key] += Math.ceil(x.amount * (I.mult || 2) / I.rungs.length - 1e-9);
    }
  }
  for (const R of Object.values(REG_VAN)) {
    slotsVan[I.van] += R.cap[I.van] || 0;
    for (const x of R.res) if (x.type === I.van || x.depleted === I.van) slotsVan[I.van] += x.amount;
  }
}

// ---- the runs
const YEARS = [...Array.from({ length: 10 }, (_, i) => 1836 + i), 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1932, 1933, 1934, 1935, 1936];
const DEC = [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1936];
const FILLY = [1880, 1900, 1920, 1936], PAYY = [1880, 1900, 1920, 1935], END = [1932, 1933, 1934, 1935, 1936];
const WG_MOD = workforceModel({ game: GAME, mod: MAPDIR }), WG_VAN = workforceModel({ game: GAME, mod: join(DIR, '__no_mod__') });
function readRun(rel, isMod) {
  const idx = indexRun(join(SESSIONS, rel)), out = {};
  const keys = isMod ? Object.keys(RUNG) : IND.map(I => I.van), WG = isMod ? WG_MOD : WG_VAN;
  for (const y of YEARS) {
    const f = firstOf(idx, y); if (!f) continue;
    let s; try { s = readSum(idx[f]); } catch { continue; }
    const o = { b: { world: {}, pool: {} }, prod: { world: 0, pool: 0 }, gout: {}, price: {} };
    for (const k of keys) for (const sc of ['world', 'pool']) o.b[sc][k] = { lv: 0, st: 0, va: 0, pr: 0, w: 0 };
    for (const [tag, c] of Object.entries(s.countries || {})) {
      const sc = POOL.includes(tag) ? ['world', 'pool'] : ['world'];
      const p = c.pop_statistics || {}; const prod = (+p.population_salaried_workforce || 0) - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0);
      for (const x of sc) o.prod[x] += prod;
      for (const k of keys) { const b = c.buildings?.[k]; if (!b || !b.levels) continue; const w = WG.workersOf(b);
        for (const x of sc) { const a = o.b[x][k]; a.lv += +b.levels || 0; a.st += +b.staffing || 0; a.va += +b.va_out || 0; a.pr += +b.profit || 0; a.w += w; } }
    }
    for (const g of GOODS) { o.gout[g] = +(s.top_producers?.[g]?.world) || NaN; const pr = s.world?.world_market_price?.[g]; o.price[g] = pr && BASE[g] ? (+pr.mean52 || +pr.last) / BASE[g] : NaN; }
    out[y] = o;
  }
  return out;
}
const MR = MODS.map(r => readRun(r, true)), VR = VANS.map(r => readRun(r, false));
const M = (runs, f) => med(runs.map(r => { try { return f(r); } catch { return NaN; } }));
const endMean = (r, f) => { const v = END.map(y => r[y] ? f(r[y]) : NaN).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
const outOf = (a, share, good) => a && BASE[good] ? a.va * share / BASE[good] : NaN;   // a building record's main-good output, units a week

// (1) output by rung and vanilla's building, per decade, world and the shortlist
const OUT = {};
for (const sc of ['world', 'pool']) { OUT[sc] = {};
  for (const I of IND) OUT[sc][I.id] = { rungs: I.rungs.map(r => DEC.map(y => M(MR, R => outOf(R[y].b[sc][r.key], r.share, r.good)))), van: DEC.map(y => M(VR, R => outOf(R[y].b[sc][I.van], I.vanShare, I.good))) }; }
// (2) slot fill and staffed share, world
const FILL = {};
for (const I of IND) FILL[I.id] = { upper: I.upper,
  rungs: I.rungs.map(r => ({ key: r.key, era: r.era, slots: slotsMod[r.key], years: FILLY.map(y => [M(MR, R => R[y].b.world[r.key].lv), M(MR, R => R[y].b.world[r.key].st / R[y].b.world[r.key].lv)]) })),
  van: { key: I.van, slots: slotsVan[I.van], years: FILLY.map(y => [M(VR, R => R[y].b.world[I.van].lv), M(VR, R => R[y].b.world[I.van].st / R[y].b.world[I.van].lv)]) } };
// (3) raw supply by good
const SUP = {};
for (const g of GOODS) SUP[g] = DEC.map(y => ({ m: M(MR, R => R[y].gout[g]), v: M(VR, R => R[y].gout[g]), pm: M(MR, R => R[y].price[g]), pv: M(VR, R => R[y].price[g]) }));
// (4) labour and capital at the end (the 1932–1936 mean), world and the shortlist
const LAB = {};
for (const sc of ['world', 'pool']) {
  const mk = Object.keys(RUNG), vk = IND.map(I => I.van);
  const sum = (o, ks, f) => ks.reduce((s, k) => s + f(o.b[sc][k], k), 0);
  LAB[sc] = {
    mod: { workers: M(MR, R => endMean(R, o => sum(o, mk, a => a.w))), prod: M(MR, R => endMean(R, o => o.prod[sc])), points: M(MR, R => endMean(R, o => sum(o, mk, (a, k) => a.lv * RUNG[k].cost))) },
    van: { workers: M(VR, R => endMean(R, o => sum(o, vk, a => a.w))), prod: M(VR, R => endMean(R, o => o.prod[sc])), points: M(VR, R => endMean(R, o => sum(o, vk, (a, k) => a.lv * (IND.find(I => I.van === k).vanCost || 0)))) },
    rungs: Object.fromEntries(mk.map(k => [k, ['lv', 'st', 'w'].map(q => M(MR, R => endMean(R, o => o.b[sc][k][q])))])),
    vanB: Object.fromEntries(vk.map(k => [k, ['lv', 'st', 'w'].map(q => M(VR, R => endMean(R, o => o.b[sc][k][q])))])),
  };
  for (const a of ['mod', 'van']) LAB[sc][a].share = LAB[sc][a].workers / LAB[sc][a].prod;
}
// (5) payback by rung at realised prices (world): cost × £720 ÷ (52 × profit per level); null = a loss
const PPP = 720;
const payOf = (a, cost) => { if (!a || !(a.lv > 0) || !(cost > 0)) return NaN; const yr = 52 * a.pr / a.lv; return yr > 0 ? cost * PPP / yr : Infinity; };
// the median keeps a loss (+∞) as a value — lib_sumidx's med drops non-finite values, which would hide a rung losing money in most runs
const medInf = a => { const s = a.filter(x => !Number.isNaN(x) && x != null).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const MI = (runs, f) => medInf(runs.map(r => { try { return f(r); } catch { return NaN; } }));
const PAY = {};
for (const I of IND) PAY[I.id] = { rungs: I.rungs.map(r => PAYY.map(y => MI(MR, R => payOf(R[y].b.world[r.key], r.cost)))), van: PAYY.map(y => MI(VR, R => payOf(R[y].b.world[I.van], I.vanCost))) };
// (6) the 1836–1845 supply of each good against vanilla's 90% range ± 10% (the world-GDP start line's rule, criteria.mjs)
const pct = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const START = {};
for (const g of GOODS) {
  const flagged = MR.map(R => { let viol = 0; for (let y = 1836; y <= 1845; y++) { const v = VR.map(V => V[y]?.gout[g]).filter(Number.isFinite); const x = R[y]?.gout[g];
    if (v.length < 4 || !Number.isFinite(x)) continue; const lo = pct(v, 0.05), hi = pct(v, 0.95); if (x < 0.9 * lo || x > 1.1 * hi) viol++; } return viol; });
  const mid = y => [M(MR, R => R[y].gout[g]), M(VR, R => R[y].gout[g])];
  START[g] = { viol: flagged, flaggedRuns: flagged.filter(v => v > 2).length, runs: MR.length, y1840: mid(1840), y1845: mid(1845) };
}
const startFlagged = GOODS.filter(g => START[g].flaggedRuns >= MR.length / 2);
writeFileSync(join(DIR, 'deposits.json'), JSON.stringify({ book: BOOK, map: MAPDIR, runs: { mod: MR.length, van: VR.length }, dec: DEC, fillYears: FILLY, payYears: PAYY, end: END,
  industries: IND, goods: GOODS, out: OUT, fill: FILL, supply: SUP, labour: LAB, payback: PAY, start: START, startFlagged,
  missingMethods: { mod: [...WG_MOD.missing], van: [...WG_VAN.missing] } }, (k, v) => v === Infinity ? 'loss' : v));   // a payback at a loss stays "loss", not null

// ================================================================ the HTML
const fin = Number.isFinite;
const k1 = x => !fin(x) ? '—' : Math.abs(x) >= 1e4 ? Math.round(x / 1e3).toLocaleString('en-GB') + 'k' : Math.abs(x) >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : Math.round(x).toLocaleString('en-GB');
const pc = (x, d = 0) => fin(x) ? (100 * x).toFixed(d) + '%' : '—';
const x2 = x => fin(x) ? '×' + x.toFixed(2) : '—';
const yrs = x => x === Infinity ? 'loss' : fin(x) ? x.toFixed(0) + ' y' : '—';
const TC = ['var(--e1)', 'var(--e2)', 'var(--e3)', 'var(--e5)'];   // tier 0 … 3, the darker the newer
const tierLabel = r => `tier ${r.era}`;
function chart(I, data, title) {
  const W = 300, H = 168, L = 40, R = 8, T = 10, B = 22, xs = DEC;
  const stack = DEC.map((_, i) => data.rungs.reduce((s, row) => s + (fin(row[i]) ? row[i] : 0), 0));
  const max = Math.max(1, ...stack, ...data.van.filter(fin)) * 1.08;
  const X = y => L + (y - xs[0]) / (xs[xs.length - 1] - xs[0]) * (W - L - R), Y = v => T + (1 - v / max) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}: output by rung against vanilla" style="width:100%;height:auto">`;
  for (const f of [0, 0.5, 1]) { const v = max / 1.08 * f; s += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" style="stroke:var(--line)"/><text x="${L - 4}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" style="fill:var(--ink3)">${k1(v)}</text>`; }
  for (const y of [1840, 1880, 1920]) s += `<text x="${X(y).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" style="fill:var(--ink3)">${y}</text>`;
  let lower = DEC.map(() => 0);
  data.rungs.forEach((row, ri) => {
    const upper = lower.map((v, i) => v + (fin(row[i]) ? row[i] : 0));
    if (upper.some((v, i) => v > lower[i])) {
      const top = DEC.map((y, i) => `${X(y).toFixed(1)},${Y(upper[i]).toFixed(1)}`), bot = DEC.map((y, i) => `${X(y).toFixed(1)},${Y(lower[i]).toFixed(1)}`).reverse();
      s += `<polygon points="${[...top, ...bot].join(' ')}" style="fill:${TC[I.rungs[ri].era] || TC[3]};stroke:var(--panel);stroke-width:0.6"><title>${tierLabel(I.rungs[ri])}: ${DEC.map((y, i) => y + ' ' + k1(row[i])).join(', ')}</title></polygon>`;
    }
    lower = upper;
  });
  const vp = DEC.map((y, i) => [X(y), data.van[i]]).filter(([, v]) => fin(v));
  if (vp.length > 1) s += `<polyline points="${vp.map(([x, v]) => x.toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}" style="fill:none;stroke:var(--ink);stroke-width:1.6;stroke-dasharray:4 3"><title>vanilla: ${DEC.map((y, i) => y + ' ' + k1(data.van[i])).join(', ')}</title></polyline>`;
  s += '</svg>';
  const last = DEC.length - 1;
  return `<figure style="margin:0"><div class="small"><b>${title}</b> <span class="dim">${I.good}, units a week · 1936: ${k1(stack[last])} vs ${k1(data.van[last])} (${x2(stack[last] / data.van[last])})</span></div>${s}</figure>`;
}
const legend = `<div class="legend">${[0, 1, 2, 3].map(e => `<span><span class="sw" style="background:${TC[e]}"></span>tier ${e}</span>`).join('')}<span><span class="sw" style="background:none;border-top:2px dashed var(--ink);height:0;width:16px;border-radius:0"></span>vanilla’s one building</span></div>`;
const grid = inner => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px;margin-top:10px">${inner}</div>`;
function outputCard(sc) {
  const who = sc === 'pool' ? 'the shortlist' : 'world';
  return `<figure class="card">
  <h3>Tiered deposits — output by rung <span class="dim">— ${who}</span></h3>
  ${legend}
  ${grid(IND.map(I => chart(I, OUT[sc][I.id], I.name)).join(''))}
  <figcaption>Each deposit (BALANCE_FRAMEWORK §10.115) is a ladder of buildings, one per method, each on slots of its own, so a newer rung is expected to <b>add</b> output beside the older pits rather than replace them: the coloured layers should stack up, not swap. The dashed line is vanilla’s one building of the same resource, all its methods together. Output = the building’s value of output at base prices ÷ the good’s base price (throughput, companies and the output-adding secondary lines included; whaling’s meat left out), the median over ${MR.length} runs against ${VR.length} vanilla runs, by decade (1936 = 1 January).${sc === 'pool' ? ' Shortlist = Britain, the USA, France, the Netherlands, Belgium, the United Netherlands, Prussia, the North German Federation and Germany, main records; the country selection above does not change it.' : ''}</figcaption>
</figure>`;
}
function fillCard() {
  const head = `<tr><th>deposit · rung</th><th class="num">slots</th>${FILLY.map(y => `<th class="num">${y}</th>`).join('')}</tr>`;
  const cell = (lv, st, slots) => `<td class="num">${fin(lv) && slots > 0 ? pc(lv / slots) : '—'}<br><span class="dim">${fin(st) ? pc(st) + ' staffed' : ''}</span></td>`;
  const rows = IND.flatMap(I => {
    const F = FILL[I.id];
    return [...F.rungs.map((r, i) => `<tr><td>${i === 0 ? '<b>' + I.name + '</b> · ' : ''}${tierLabel(r)}</td><td class="num">${k1(r.slots)}${I.upper ? '*' : ''}</td>${r.years.map(([lv, st]) => cell(lv, st, r.slots)).join('')}</tr>`),
      `<tr><td class="dim">${I.name} · vanilla’s building</td><td class="num dim">${k1(F.van.slots)}${I.upper ? '*' : ''}</td>${F.van.years.map(([lv, st]) => `<td class="num dim">${fin(lv) && F.van.slots > 0 ? pc(lv / F.van.slots) : '—'}<br>${fin(st) ? pc(st) + ' staffed' : ''}</td>`).join('')}</tr>`];
  });
  return `<div class="card tablewrap">
  <h3>Tiered deposits — slots filled and staffed, by rung <span class="dim">— world</span></h3>
  <table>${head}${rows.join('')}</table>
  <p class="small">Each cell: the rung’s built levels ÷ its slots in the world’s state regions (the map of the build the runs played; a deposit’s vanilla slots are split over its rungs, two methods × 1.5, three or four × 2), and below it the share of those levels staffed. Addition reads as each rung’s column filling in its turn while the older rungs stay full and staffed. * Gold and oil change in play (gold fields deplete into the gold rungs; a found oil field opens the second oil rung): their slots are the full potential, every field depleted and found, so their fill is a lower bound. Vanilla’s one building beside each, on vanilla’s map. Median over ${MR.length} runs against ${VR.length} vanilla runs.</p>
  </div>`;
}
function supplyCard() {
  const YS = [1850, 1880, 1900, 1920, 1936], at = y => DEC.indexOf(y);
  const head = `<tr><th>good</th>${YS.map(y => `<th class="num">${y}</th>`).join('')}</tr>`;
  const outRows = GOODS.map(g => `<tr><td><b>${g}</b></td>${YS.map(y => { const o = SUP[g][at(y)]; return `<td class="num">${k1(o.m)} <span class="dim">/ ${k1(o.v)}</span><br><span class="dim">${x2(o.m / o.v)}</span></td>`; }).join('')}</tr>`);
  const priceRows = GOODS.filter(g => SUP[g].some(o => fin(o.pm) || fin(o.pv))).map(g => `<tr><td><b>${g}</b></td>${YS.map(y => { const o = SUP[g][at(y)]; return `<td class="num">${fin(o.pm) ? o.pm.toFixed(2) : '—'} <span class="dim">/ ${fin(o.pv) ? o.pv.toFixed(2) : '—'}</span></td>`; }).join('')}</tr>`);
  return `<div class="card tablewrap">
  <h3>Raw supply — world output and world price of the deposit goods</h3>
  <table>${head}${outRows.join('')}</table>
  <p class="small">World output, units a week (every producer of the good, the save’s own count): <b>this batch <span class="dim">/ vanilla</span></b>, and the ratio this batch ÷ vanilla below. Oil counts the whaling stations’ oil with the rigs’; gold counts vanilla’s gold fields.</p>
  <table style="margin-top:10px">${head}${priceRows.join('')}</table>
  <p class="small">World price ÷ base price (the 52-week mean): <b>this batch <span class="dim">/ vanilla</span></b>. Read the two tables together: less output at an unchanged price is less demand, less output at a higher price is a shortage. Gold has no market price. Median over ${MR.length} runs against ${VR.length} vanilla runs.</p>
  </div>`;
}
function rungCard(sc) {
  const L = LAB[sc], who = sc === 'pool' ? 'the shortlist' : 'world';
  const head = '<tr><th>deposit · rung</th><th class="num">levels</th><th class="num">staffed</th><th class="num">workers</th><th class="num">construction points</th></tr>';
  const rows = IND.flatMap(I => [...I.rungs.map((r, i) => { const [lv, st, w] = L.rungs[r.key]; return `<tr><td>${i === 0 ? '<b>' + I.name + '</b> · ' : ''}${tierLabel(r)}</td><td class="num">${k1(lv)}</td><td class="num">${fin(st / lv) ? pc(st / lv) : '—'}</td><td class="num">${k1(w)}</td><td class="num">${k1(lv * r.cost)}</td></tr>`; }),
    (() => { const [lv, st, w] = L.vanB[I.van]; return `<tr><td class="dim">${I.name} · vanilla’s building</td><td class="num dim">${k1(lv)}</td><td class="num dim">${fin(st / lv) ? pc(st / lv) : '—'}</td><td class="num dim">${k1(w)}</td><td class="num dim">${k1(lv * (I.vanCost || NaN))}</td></tr>`; })()]);
  const tot = `<tr><td><b>all tiered deposits</b> <span class="dim">/ vanilla’s buildings</span></td><td></td><td></td><td class="num"><b>${k1(L.mod.workers)}</b> <span class="dim">/ ${k1(L.van.workers)}</span></td><td class="num"><b>${k1(L.mod.points)}</b> <span class="dim">/ ${k1(L.van.points)}</span></td></tr>`
    + `<tr><td>share of the productive workers</td><td></td><td></td><td class="num"><b>${pc(L.mod.share, 1)}</b> <span class="dim">/ ${pc(L.van.share, 1)}</span></td><td></td></tr>`;
  const payHead = `<tr><th>deposit · rung</th>${PAYY.map(y => `<th class="num">${y}</th>`).join('')}</tr>`;
  const payRows = IND.flatMap(I => [...I.rungs.map((r, i) => `<tr><td>${i === 0 ? '<b>' + I.name + '</b> · ' : ''}${tierLabel(r)} <span class="dim">(${k1(r.cost)} points)</span></td>${PAY[I.id].rungs[i].map(v => `<td class="num">${yrs(v)}</td>`).join('')}</tr>`),
    `<tr><td class="dim">${I.name} · vanilla’s building (${k1(I.vanCost)} points)</td>${PAY[I.id].van.map(v => `<td class="num dim">${yrs(v)}</td>`).join('')}</tr>`]);
  return `<div class="card tablewrap">
  <h3>Tiered deposits — labour and capital by rung, ${END[0]}–${String(END[END.length - 1]).slice(2)} <span class="dim">— ${who}</span></h3>
  <table>${head}${rows.join('')}${tot}</table>
  <p class="small">The mean of the yearly summaries ${END[0]}–${END[END.length - 1]}, the median over ${MR.length} runs (vanilla’s same building, the median over ${VR.length} vanilla runs, in grey). Workers = staffing × one level’s employment under its active methods; construction points = levels × the rung’s building cost (vanilla’s own for its building); productive workers = the salaried outside government and the military.${sc === 'pool' ? ' Shortlist = the nine tags of the register, main records.' : ''}</p>
  ${sc === 'world' ? `<details><summary class="small">Years for a level to repay its construction at realised prices, by rung</summary><div class="tablewrap"><table>${payHead}${payRows.join('')}</table></div>
  <p class="small">Construction cost (points × £720, the iron-frame rate) ÷ the year’s profit per level at realised prices, world, the median over the runs; “loss” = the rung’s levels lost money that year. A rung that never pays explains its empty slots.</p></details>` : ''}
  </div>`;
}
const head = sc => `<h2 style="margin-top:6px">Tiered deposits <span class="dim" style="font-weight:400;font-size:14px">— mines, wharves and oil rigs, read as addition</span></h2>`;
writeFileSync(join(DIR, 'deposits_world.html'), [head('world'), outputCard('world'), fillCard(), supplyCard(), rungCard('world')].join('\n'));
writeFileSync(join(DIR, 'deposits_pool.html'), [head('pool'), outputCard('pool'), rungCard('pool')].join('\n'));
const lw = LAB.world;
console.log(`deposits: ${MR.length} mod runs, ${VR.length} vanilla runs, ${IND.length} deposits, map ${MAPDIR} · end workers ${k1(lw.mod.workers)} (${pc(lw.mod.share, 1)} of productive) vs ${k1(lw.van.workers)} (${pc(lw.van.share, 1)}) · points ${k1(lw.mod.points)} vs ${k1(lw.van.points)} · 1836–45 goods flagged: ${startFlagged.join(', ') || 'none'}`
  + (WG_MOD.missing.size || WG_VAN.missing.size ? ` · ⚠ methods with no employment entry: mod ${WG_MOD.missing.size}, vanilla ${WG_VAN.missing.size}` : ''));
