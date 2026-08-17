// THE CAPITAL-SIDE CENSUS — what does a level of each tier COST against what it EARNS, across the six
// era scenarios? Measuring is read-only; `--write` is the ONE thing here that writes, and it writes
// exactly one field.
//
//   node tools/payback_census.mjs              # the census, as shipped
//   node tools/payback_census.mjs --rule       # ...plus the cost book the payback ladder produces
//   node tools/payback_census.mjs --rule --write            # ...and write building_cost into the config
//
// WHY IT EXISTS. `solve_building_cost.ps1` sets every tier's cost from a TEN-YEAR payback — but it
// computes the profit that pays it back from an ASSUMED 20% return on operating cost, and the economy
// the solver actually ships earns 56–104% (median, dominant rungs). So the realised payback is ~2 years
// everywhere, not 10: the model is right and its one assumption is 3–6× off. Nothing measured that until
// this file, because payback is a property of the RECIPE BOOK and the SCENARIO together, and the two
// live in different tools.
//
// ⭐⭐ THE RULED COST BOOK IS EXACTLY VANILLA'S OWN, FLAT (user, 2026-08-17 — supersedes §10.57's
// two-band ×1.5^(era−1) ladder):
//     building_cost = vanilla required_construction (the industry's anchor), × workforce_mult where set
// See "THE RULE" below for the full statement. Two things worth carrying in the head while reading:
// ⚠ IT IS NOT PAYBACK-DERIVED. An earlier version set cost from each tier's own output value and a
// measured profit ratio; the user rejected it as "still per-building fitting". §10.57's ladder was then
// rejected in turn as DOUBLE JEOPARDY — having to construct the next tier at all IS the modernisation
// cost, and an era exponent priced the same thing twice. Payback figures below remain a READING, and
// they will spread wider than the old book's (late tiers earn more against the same flat cost); that is
// the accepted consequence, not a defect to re-fit away.
// ⚠ £720 PER POINT IS KEPT FLAT BY THE SAME RULING, and it is the IRON-FRAME method's rate. The real
// rate is 1000/720/720/540/540/527 across the eras (wooden → iron → steel → arc), so a late-era
// building really pays back ~27% faster than this file's £ figures say, and era-0 ~28% slower. That is
// an ACCEPTED, KNOWN bias, not an oversight — see F53 for the table and CLAUDE.md for the standing
// caveat. Every £ figure below reads on the 720 basis and is self-consistent within it.
//
// THREE QUANTITIES, and the third is the one that decides:
//   payback   = build cost × £720 ÷ annual profit, per level, at the scenario's own realised prices
//   K/GDP     = the scenario's whole capital stock over its annual GDP (real economies run ~3–4)
//   rebuild   = K ÷ the era's construction budget — how many years of full construction spend the
//               standing capital stock represents. THIS is the buildability constraint: a century-long
//               game wants a number a country can plausibly cover a few times over, and today's cost
//               book puts era 5 at under three years, which is the capital glut stated as one figure.
//
// ⚠ A TIER'S PAYBACK IS READ IN THE ERA WHERE IT IS DOMINANT (era == the scenario's era), the same
// convention the recipe solve uses — a tier's recipe is solved once, in the era it is the workhorse of.
// Reading it anywhere else measures a rung on its way up or its way out, not the investment case.
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { loadEcon, REPO } from './econ_host.mjs';
import { GAME, requiredConstruction, constructionCostValues } from './vanilla_construction.mjs';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const RULE = argv.includes('--rule') || WRITE;        // writing without deriving the book is meaningless

const { E, S, presets, config } = loadEcon({ quiet: true });
const SV = constructionCostValues(GAME);
const PPP = 720;                                   // £ of construction goods per construction point
const ERAS = ['era0_1780', 'era1_1836', 'era2_1870', 'era3_1900', 'era4_1920', 'era5_1945'];
const CONSTR = { 0: 0.08, 1: 0.08, 2: 0.10, 3: 0.13, 4: 0.16, 5: 0.18 };   // ERA_CONSTR_RAMP, share of GDP
// The reference the DELIVERED payback is judged against — vanilla's own 1836 reading, both instruments
// (FINDINGS F53). It is a yardstick here, never an input: nothing in the cost rule targets it.
const VAN_REF = 'vanilla 1836: 11.4 modelled / 14.8 measured';

const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '∞');
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : '∞');
const M = x => (x / 1e6).toFixed(1) + 'M';
const pad = (s, n) => String(s).padStart(n);

// ---------- the INDUSTRY MACROTYPE, the unit the coefficient is equalised over ----------
// User ruling (2026-08-13): the coefficient is one number per (macrotype, era) — never per building.
// A per-building fit would pin every tier to exactly ten years, which is both false precision and
// undefined for the ~7 tiers per era that lose money in their own era. Same split the balance sheet's
// aggregated ladder chart and era_scenarios' mfg_high/mfg_low use, classified per TIER because a ladder
// can cross the line as it modernises.
const INFRA = new Set(['port', 'railway', 'power']);
const MANU = new Set(); for (const i of S.IND) for (const t of i.tiers) MANU.add(E.tierOut(i, t));
const SECTORS = ['mfg_raw', 'mfg_mfg', 'infra', 'arts'];
const sectorOf = (i, t) => (i.id === 'art_academy' ? 'arts'
  : INFRA.has(i.id) ? 'infra'
    : Object.keys(t.inputs || {}).some(g => MANU.has(g)) ? 'mfg_mfg' : 'mfg_raw');

// ---------- the census, as shipped ----------
console.log('=== PAYBACK AS SHIPPED — every PRESENT tier, at its scenario\'s own realised prices ===');
console.log('scen         tiers  profitable   p25    med    p75    capital-weighted   loss-makers');
const shipped = [];
for (const id of ERAS) {
  const p = presets.find(x => x.id === id); if (!p) continue;
  E.applyPreset(p);
  const se = +id[3], rows = [];
  for (const i of S.IND) for (const t of i.tiers) {
    const n = S.BLDNUM[t.key] || 0; if (!n) continue;
    const prof = E.weeklyProfit(i, t), cap = E.storedBuildCost(i, t) * PPP;
    rows.push({ n, prof, cap, era: t.era, pb: prof > 0 ? cap / (52 * prof) : Infinity, margin: E.TPthr(i, t) });
  }
  const ok = rows.filter(x => Number.isFinite(x.pb));
  const capW = ok.reduce((s, x) => s + x.cap * x.n, 0) / (52 * ok.reduce((s, x) => s + x.prof * x.n, 0));
  const pbs = ok.map(x => x.pb);
  shipped.push({ id, se, rows, gdp: E.scenarioGDP() });
  console.log(`${id.padEnd(12)} ${pad(rows.length, 5)} ${pad(ok.length, 11)} ${pad(f1(q(pbs, .25)), 6)} ${pad(f1(q(pbs, .5)), 6)} `
    + `${pad(f1(q(pbs, .75)), 6)} ${pad(f1(capW), 18)} ${pad(rows.length - ok.length, 13)}`);
}

console.log('\n=== WHY: the realised margin of the DOMINANT rungs, against the +5…+50% band ===');
console.log('scen         rungs   p25 / med / p75 %      above the +50% band top');
for (const s of shipped) {
  const m = s.rows.filter(x => x.era === s.se).map(x => x.margin);
  console.log(`${s.id.padEnd(12)} ${pad(m.length, 5)} ${pad(`${q(m, .25).toFixed(0)} / ${q(m, .5).toFixed(0)} / ${q(m, .75).toFixed(0)}`, 18)} `
    + `${pad(`${m.filter(x => x > 50).length}/${m.length}`, 26)}`);
}

console.log('\n=== CAPITAL STOCK as shipped ===');
console.log('scen         GDP/yr      K       K/GDP   profit share of GDP   constr £/yr   yrs of construction to rebuild K');
for (const s of shipped) {
  let k = 0, pr = 0;
  for (const r of s.rows) { k += r.cap * r.n; pr += r.prof * r.n; }
  const c = CONSTR[s.se] * s.gdp;
  console.log(`${s.id.padEnd(12)} ${pad(M(s.gdp), 8)} ${pad(M(k), 9)} ${pad(f2(k / s.gdp), 7)} ${pad((52 * pr / s.gdp * 100).toFixed(0) + '%', 21)} `
    + `${pad(M(c), 13)} ${pad(f1(k / c), 33)}`);
}

if (!RULE) {
  console.log('\n(pass --rule to see the cost book a payback ladder would produce)');
  process.exit(0);
}

// ==================== THE RULE — EXACTLY VANILLA'S OWN COST BOOK, FLAT ====================
// (user-ruled 2026-08-17, superseding §10.57's two-band ×1.5^(era−1) ladder — BALANCE_FRAMEWORK §10.61)
//
//   building_cost (points) = VANILLA's required_construction for the industry's anchor building
//                            × the tier's workforce_mult where set (the §10.60 graded ports: ×0.1/×0.2)
//
// FLAT ACROSS TIERS — no band, no era exponent. The exponential ladder was DOUBLE JEOPARDY (the user's
// word): the whole point of the tier split is that modernising already costs the full price of a NEW
// building, so an era exponent priced the same thing twice, and the ×2 band compounded it. The
// 2026-08-16 handover had already ruled the parity restart onto "×1.0 flat vanilla anchors (exactly
// vanilla cost book)" and the vancost arm ran it; this makes that book CANONICAL. An era's premium is
// now exactly vanilla's own — none: eras are priced by what their recipes eat and the research it takes
// to unlock them, not by a cost multiplier.
//
// ⚠ NOTHING HERE TOUCHES PROFIT (unchanged from §10.57): the inputs are a vanilla constant and a config
// multiplier, so no cost can go negative or infinite, and no building is fitted individually.
//
// ⭐ THE GRADED PORTS RIDE workforce_mult — §10.60.2's regeneration trap ("--write would un-divide the
// port book") is CLOSED: a factored tier's cost is vanilla × its own workforce_mult (400 → 40/40/40/
// 80/80), read from the same tier field emission and the 1836 converter key on.
const RC = requiredConstruction(GAME);
// The industry's vanilla anchor: its base building's own required_construction. `shipyard_steam` is an
// all-new chain with no vanilla building at all, so it falls back to the class named in the config's
// own `building` block — the same value the builder would have emitted for it.
const anchorOf = i => {
  const v = RC[i.tiers[0].key];
  if (v > 0) return v;
  const named = (config.industries.find(x => x.id === i.id) || {}).building?.required_construction;
  const w = SV[named] != null ? SV[named] : +named;
  if (!(w > 0)) throw new Error(`${i.id}: no vanilla required_construction for ${i.tiers[0].key} and no `
    + `usable building.required_construction in the config — the cost book has nothing to anchor on.`);
  return w;
};

const newCost = {};
for (const i of S.IND) {
  const anchor = anchorOf(i);
  for (const t of i.tiers) {
    const wm = (t.workforce_mult != null ? +t.workforce_mult : 1);
    newCost[t.key] = Math.max(5, Math.round(anchor * wm / 5) * 5);
  }
}
console.log('\n=== THE FLAT VANILLA BOOK   (anchor × workforce_mult; flat across tiers) ===');
{
  const seen = new Map();
  for (const i of S.IND) {
    const a = anchorOf(i);
    const costs = i.tiers.map(t => newCost[t.key]);
    const line = [...new Set(costs)].join(' / ');
    const k = a + '|' + line;
    if (!seen.has(k)) seen.set(k, { a, line, ids: [] });
    seen.get(k).ids.push(i.id);
  }
  console.log('anchor   cost per level   industries');
  for (const { a, line, ids } of [...seen.values()].sort((x, y) => x.a - y.a))
    console.log(`  ${pad(a, 4)}   ${pad(line, 14)}   ${ids.join(', ')}`);
}

console.log('\n=== THE COST BOOK IT PRODUCES (construction points per level) ===');
console.log('era  tiers   median now   median new     ×      min → max new');
for (let e = 0; e <= 5; e++) {
  const now = [], neu = [], seen = new Set();
  for (const i of S.IND) for (const t of i.tiers) {
    if (t.era !== e || seen.has(t.key)) continue; seen.add(t.key);
    now.push(E.storedBuildCost(i, t)); neu.push(newCost[t.key]);
  }
  if (!neu.length) continue;
  console.log(`e${e} ${pad(neu.length, 6)} ${pad(Math.round(q(now, .5)), 12)} ${pad(Math.round(q(neu, .5)), 12)} `
    + `${pad(f1(q(neu, .5) / q(now, .5)), 7)}   ${Math.min(...neu)} → ${Math.max(...neu)}`);
}

console.log(`\n=== PAYBACK IT DELIVERS — the CHECK, against ${VAN_REF} — and the LADDER TEST ===`);
console.log('scen                 DOMINANT p25/med/p75      STALE med (era<scen)   loss-making stale');
for (const id of ERAS) {
  const p = presets.find(x => x.id === id); if (!p) continue;
  E.applyPreset(p);
  const se = +id[3];
  const grab = pred => {
    const out = [];
    for (const i of S.IND) for (const t of i.tiers) {
      if (!(S.BLDNUM[t.key] || 0) || !pred(t)) continue;
      const prof = E.weeklyProfit(i, t);
      out.push(prof > 0 ? newCost[t.key] * PPP / (52 * prof) : Infinity);
    }
    return out;
  };
  const D = grab(t => t.era === se), St = grab(t => t.era < se);
  const fin = a => a.filter(Number.isFinite);
  console.log(`${id.padEnd(11)} ${pad('', 6)}  ${pad(`${f1(q(fin(D), .25))} / ${f1(q(fin(D), .5))} / ${f1(q(fin(D), .75))}`, 22)} `
    + `${pad(f1(q(fin(St), .5)), 20)}   ${pad(`${St.length - fin(St).length}/${St.length}`, 17)}`);
}

console.log('\n=== MACRO CONSEQUENCES OF THE RULE ===');
console.log('scen         K(new)    K/GDP    yrs of construction to rebuild K    levels/yr the budget buys');
for (const s of shipped) {
  const p = presets.find(x => x.id === s.id); E.applyPreset(p);
  let k = 0; const med = [];
  for (const i of S.IND) for (const t of i.tiers) {
    const n = S.BLDNUM[t.key] || 0; if (n) k += n * newCost[t.key] * PPP;
    if (t.era === s.se) med.push(newCost[t.key]);
  }
  const c = CONSTR[s.se] * s.gdp;
  console.log(`${s.id.padEnd(12)} ${pad(M(k), 8)} ${pad(f2(k / s.gdp), 8)} ${pad(f1(k / c), 35)} ${pad(f1(c / PPP / q(med, .5)), 28)}`);
}

// Diagnostic only — the flat vanilla rule aims at nothing per macrotype, so this is a READING of what
// the vanilla-anchored book happens to deliver, not a target it missed. infra sits high because
// vanilla's own ports and railways pay back slowly (31.7 modelled / 41.8 measured, F53); that is
// faithfulness. Expect a wider spread than the old ladder's: late tiers earn more against a flat cost.
console.log('\n=== DELIVERED PAYBACK BY MACROTYPE — a reading of the book, not a target ===');
console.log('macrotype   rungs   p10 / p25 / MEDIAN / p75 / p90      at a loss (no payback)');
{
  const bySec = {};
  for (const id of ERAS) {
    const p = presets.find(x => x.id === id); if (!p) continue;
    E.applyPreset(p); const se = +id[3];
    for (const i of S.IND) for (const t of i.tiers) {
      if (t.era !== se || !(S.BLDNUM[t.key] || 0)) continue;
      const prof = E.weeklyProfit(i, t);
      (bySec[sectorOf(i, t)] ??= []).push(prof > 0 ? newCost[t.key] * PPP / (52 * prof) : Infinity);
    }
  }
  for (const sec of SECTORS) {
    const a = bySec[sec] || []; if (!a.length) continue;
    const fin = a.filter(Number.isFinite);
    console.log(`${sec.padEnd(11)} ${pad(a.length, 5)}   `
      + `${pad([.1, .25, .5, .75, .9].map(x => f1(q(fin, x))).join(' / '), 32)}   ${pad(`${a.length - fin.length}/${a.length}`, 12)}`);
  }
}

if (!WRITE) { console.log('\n(pass --write to store this cost book in the config)'); process.exit(0); }

// ---------- --write: the ONE field this file writes ----------
// building_cost is a pure OUTPUT of the pipeline — nothing in the solve reads it back (verified: no
// reference in era_scenarios/era_solver, and build_era_ladder only nulls it for a freshly minted tier).
// So this needs no re-solve and cannot disturb the fixed point. It rewrites `building_cost` and nothing
// else, straight onto the parsed config, which preserves key order because JSON.parse does.
const cfgRel = process.env.MOD_CONFIG || join('config', 'mod_config.json');
const cfgPath = isAbsolute(cfgRel) ? cfgRel : join(REPO, cfgRel);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
let wrote = 0, moved = 0, missing = [];
for (const ind of cfg.industries) for (const t of ind.tiers) {
  const v = newCost[t.key];
  if (v == null) { missing.push(t.key); continue; }
  if (t.building_cost !== v) moved++;
  t.building_cost = v; wrote++;
}
if (missing.length) throw new Error(`${missing.length} config tier(s) got no cost — the model and the config disagree on the ladder. `
  + `Re-run build_era_ladder.mjs first. Missing: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`);
writeFileSync(cfgPath, JSON.stringify(cfg), 'utf8');
console.log(`\n✓ WROTE building_cost for ${wrote} tiers (${moved} changed) -> ${cfgRel}`);
console.log('  Nothing else was touched. Run tools\\build.ps1 to emit it as required_construction.');
