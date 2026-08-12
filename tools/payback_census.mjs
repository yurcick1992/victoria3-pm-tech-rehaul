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
// ⭐⭐ THE RULED COST BOOK IS TWO BANDS OFF VANILLA'S OWN NUMBERS (user, 2026-08-13 — §10.57):
//     building_cost = vanilla required_construction × band × 1.5^(era − 1),   band = 2 or 1
// See "THE RULE" below for the full statement and why each term is what it is. Two things about it are
// worth carrying in the head while reading this file:
// ⚠ IT IS NOT PAYBACK-DERIVED. An earlier version set cost from each tier's own output value and a
// measured profit ratio; the user rejected it as "still per-building fitting". Ten years is now a
// CHECK, not a construction — and the book delivers a median 11.1 against vanilla's own 11.4 modelled /
// 14.8 measured (FINDINGS F53), which is the whole argument for anchoring on vanilla in the first place.
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

// ==================== THE RULE — TWO BANDS OFF VANILLA'S OWN COST BOOK ====================
// (user-ruled 2026-08-13, BALANCE_FRAMEWORK §10.57)
//
//   building_cost (points) = VANILLA's required_construction × band × 1.5^(era − 1)
//   band = 2 for the EXPENSIVE set, 1 for everything else
//
// ⭐⭐ VANILLA'S COST IS THE ERA-1 RUNG, NOT THE INDUSTRY'S FIRST ONE. The exponent is `era − 1`, so an
// era-0 rung is vanilla ÷ 1.5 and an era-5 rung is vanilla × 1.5⁴. Keying on the ERA rather than on the
// tier's position is what makes a late-starting industry expensive from its first building: automotive
// debuts at era 3 and pays 1.5² over its vanilla anchor, instead of being handed the era-1 price for
// being new. Legal because no industry may hold two tiers in one era — `build_era_ladder.mjs` throws on
// that — so era ↔ rung is one-to-one within an industry.
//
// ⭐ THE WHOLE COST BOOK IS THEREFORE TWO SEQUENCES OF SIX NUMBERS, and that is the point of the ruling:
//   regular   (vanilla 600)   400 ·  600 ·  900 · 1350 · 2025 · 3040
//   expensive (vanilla 800)  1065 · 1600 · 2400 · 3600 · 5400 · 8100
// Everything is hand-checkable from vanilla's own number, and no building is fitted individually. It
// replaces an output-value-proportional rule that was per-building fitting in all but name.
//
// ⚠ NOTHING HERE TOUCHES PROFIT, so a loss-making tier costs exactly what its era says and nothing can
// go negative or infinite. That was an explicit user requirement and it now holds by construction rather
// than by a guard: the inputs are a vanilla constant, a band, and an era.
//
// ⚠ THE EXPENSIVE SET IS DERIVED, NOT LISTED — it is vanilla's own `construction_cost_very_high` (800)
// class, so a patch that reclassifies a building carries through instead of leaving a stale literal.
// Infrastructure is excluded by hand: railway is very_high in vanilla, but the three infra industries
// were ruled onto the plain vanilla anchor (they sell `state_infrastructure`, which is not a priced
// good, so nothing about them belongs in a profit-facing band). The resolved set is PRINTED every run —
// a derived rule that never shows its result is one nobody can check.
const RC = requiredConstruction(GAME);
const LADDER_R = 1.5, EXPENSIVE_MULT = 2, VERY_HIGH = 800;

// ⭐ NAMED EXCEPTIONS TO THE DERIVED BAND (user-ruled 2026-08-13, from the delivered-payback census).
// Four industries paid back in 3.6–6.5 years against the book's own 11.1 centre — the derived rule reads
// vanilla's class, and vanilla's class is wrong about them FOR THIS ECONOMY. Each carries its reason,
// because an exception whose argument is not written down cannot be re-checked after a patch.
// ⚠ Deliberately NOT a wholesale reclassification: `paper` (6.6y) and `motor` (18.0y) were both offered
// and left alone by the same ruling. And the industries that look like far worse outliers — synthetics
// 210y, automotive 55y, shipyard_steam 484y, railway 70y, power 62y — are NOT band problems: each has
// most of its dominant rungs AT A LOSS (the §10.29/§10.35 new-economy undersizes) or is infra priced off
// an unpriced `state_infrastructure` output. Doubling or halving a cost cannot fix a building that does
// not earn, and moving one would only hide the real fault.
const BAND_OVERRIDE = {
  arms:      EXPENSIVE_MULT,   // 5.6y. Its own family's other half (munition, explosives) is vanilla-800
  artillery: EXPENSIVE_MULT,   // 4.2y. and lands at 11.4–11.6 — same customer, same army-fed demand.
  shipyard:  EXPENSIVE_MULT,   // 3.6y, AND it carries the −30pp naval handicap, so its profit is
                               //   understated here and the true payback is faster still.
  tooling:   EXPENSIVE_MULT,   // 6.5y. An intermediate-goods producer; every other light industry on
                               //   vanilla's 600 lands 11–17.
};
const bandOf = i => {
  const derived = (!INFRA.has(i.id) && RC[i.tiers[0].key] === VERY_HIGH ? EXPENSIVE_MULT : 1);
  return BAND_OVERRIDE[i.id] ?? derived;
};
// A stale exception is worse than none: if vanilla ever reclassifies one of these, the override silently
// becomes a no-op and the reason above stops being true with nothing to say so. Same discipline as
// emit_techs.mjs asserting its match counts — fail, don't quietly agree.
for (const id in BAND_OVERRIDE) {
  const ind = S.IND.find(x => x.id === id);
  if (!ind) throw new Error(`BAND_OVERRIDE names '${id}', which is not an industry in the config — renamed or removed?`);
  const derived = (!INFRA.has(id) && RC[ind.tiers[0].key] === VERY_HIGH ? EXPENSIVE_MULT : 1);
  if (derived === BAND_OVERRIDE[id]) throw new Error(`BAND_OVERRIDE for '${id}' is a NO-OP — vanilla now `
    + `derives the same band. Delete the exception (and its reason) rather than leaving it to rot.`);
}
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
  const anchor = anchorOf(i), band = bandOf(i);
  for (const t of i.tiers) newCost[t.key] = Math.max(5, Math.round(anchor * band * Math.pow(LADDER_R, t.era - 1) / 5) * 5);
}
const mark = i => i.id + (BAND_OVERRIDE[i.id] != null ? '*' : '');
console.log('\n=== THE TWO BANDS   (* = named exception to vanilla\'s own class) ===');
console.log(`expensive (×${EXPENSIVE_MULT}, vanilla's very_high class): `
  + S.IND.filter(i => bandOf(i) === EXPENSIVE_MULT).map(mark).join(', '));
console.log('regular  (×1):                                ' + S.IND.filter(i => bandOf(i) === 1).map(mark).join(', '));
// One line per DISTINCT (anchor × band) actually in play. There is more than one anchor per band since
// the exceptions moved vanilla-600 industries into the expensive column, so printing a single example
// ladder per band would misdescribe half the book.
{
  const seen = new Map();
  for (const i of S.IND) {
    const a = anchorOf(i), b = bandOf(i), k = a + '|' + b;
    if (!seen.has(k)) seen.set(k, { a, b, ids: [] });
    seen.get(k).ids.push(i.id);
  }
  console.log('anchor × band   ladder e0…e5                                    industries');
  for (const { a, b, ids } of [...seen.values()].sort((x, y) => x.a * x.b - y.a * y.b)) {
    console.log(`  ${pad(a, 4)} × ${b}      `
      + pad([0, 1, 2, 3, 4, 5].map(e => Math.round(a * b * Math.pow(LADDER_R, e - 1) / 5) * 5).join(' · '), 42)
      + `   ${ids.join(', ')}`);
  }
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

// The rule aims the MACROTYPE's median at P years; a building lands where its own margin puts it. This
// is the check that the aim is true, and the honest statement of how wide the scatter is.
// Diagnostic only — the two-band rule aims at nothing per macrotype, so this is a READING of what the
// vanilla-anchored book happens to deliver, not a target it missed. infra sits high because vanilla's
// own ports and railways pay back slowly (31.7 modelled / 41.8 measured, F53); that is faithfulness.
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
