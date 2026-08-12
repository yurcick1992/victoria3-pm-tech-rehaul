// THE CAPITAL-SIDE CENSUS — what does a level of each tier COST against what it EARNS, across the six
// era scenarios? Read-only: it writes nothing, it measures the shipped state.
//
//   node tools/payback_census.mjs              # the census
//   node tools/payback_census.mjs --rule       # ...plus the cost book a payback ladder would produce
//   node tools/payback_census.mjs --rule --p0 10 --p5 20     # with a different ladder
//
// WHY IT EXISTS. `solve_building_cost.ps1` sets every tier's cost from a TEN-YEAR payback — but it
// computes the profit that pays it back from an ASSUMED 20% return on operating cost, and the economy
// the solver actually ships earns 56–104% (median, dominant rungs). So the realised payback is ~2 years
// everywhere, not 10: the model is right and its one assumption is 3–6× off. Nothing measured that until
// this file, because payback is a property of the RECIPE BOOK and the SCENARIO together, and the two
// live in different tools.
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
import { loadEcon } from './econ_host.mjs';

const argv = process.argv.slice(2);
const numArg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? +argv[i + 1] : d; };
const RULE = argv.includes('--rule');
const P0 = numArg('--p0', 10), P5 = numArg('--p5', 20);

const { E, S, presets } = loadEcon({ quiet: true });
const PPP = 720;                                   // £ of construction goods per construction point
const ERAS = ['era0_1780', 'era1_1836', 'era2_1870', 'era3_1900', 'era4_1920', 'era5_1945'];
const CONSTR = { 0: 0.08, 1: 0.08, 2: 0.10, 3: 0.13, 4: 0.16, 5: 0.18 };   // ERA_CONSTR_RAMP, share of GDP
// The payback ladder: flat below 1836 (era 0 is the pre-industrial rung and shares era 1's anchor),
// then linear in ERA INDEX to P5 at era 5. Linear in the era rather than in the anchor YEAR, because
// the era is the mod's own unit and a year-linear ramp puts era 0 (1750) at an absurd 2.7 years.
const P = e => (e <= 1 ? P0 : P0 + (P5 - P0) * (e - 1) / 4);

const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '∞');
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : '∞');
const M = x => (x / 1e6).toFixed(1) + 'M';
const pad = (s, n) => String(s).padStart(n);

// ---------- pass 1: every tier's reading in the era where it is DOMINANT ----------
const dom = {};                       // tier key -> { profit £/wk realised, O base-price output £/wk, era }
for (const id of ERAS) {
  const p = presets.find(x => x.id === id); if (!p) continue;
  E.applyPreset(p);
  const se = +id[3];
  for (const i of S.IND) for (const t of i.tiers) {
    if (t.era !== se || !(S.BLDNUM[t.key] || 0)) continue;
    dom[t.key] = { profit: E.weeklyProfit(i, t), O: E.outputValue(i, t, false), era: se };
  }
}

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

// ---------- the candidate rule ----------
// building_cost = c(era) × weekly OUTPUT VALUE at BASE prices,   c(era) = P(era) × 52 × ρ(era) / £720
// ρ(era) = the median, over that era's dominant rungs, of realised weekly profit ÷ base output value.
// Base output rather than realised profit as the anchor, deliberately: it is defined for the ~7 tiers
// per era that LOSE money in their own era (a profit anchor is not), it does not move when the solver
// re-prices, and output already climbs ×1.5 per rung, so the cost ladder is that ×1.5 times the payback
// ramp and can be checked by hand. The price is scatter — see the delivered spread below.
console.log('\n=== ρ(era) AND THE COEFFICIENT TABLE ===');
console.log(`payback ladder: ${[0, 1, 2, 3, 4, 5].map(e => `e${e} ${P(e)}y`).join(' · ')}`);
console.log('era   rungs   ρ = profit÷base output   c(era) = P·52·ρ/720');
const C = {};
for (let e = 0; e <= 5; e++) {
  const r = Object.values(dom).filter(d => d.era === e && d.profit > 0).map(d => d.profit / d.O);
  if (!r.length) continue;
  C[e] = P(e) * 52 * q(r, .5) / PPP;
  console.log(`e${e} ${pad(r.length, 7)} ${pad(`${f2(q(r, .25))} / ${f2(q(r, .5))} / ${f2(q(r, .75))}`, 22)} ${pad(C[e].toFixed(3), 20)}`);
}

const newCost = {};
for (const i of S.IND) for (const t of i.tiers)
  newCost[t.key] = Math.max(5, Math.round(C[t.era] * E.outputValue(i, t, false) / 5) * 5);

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

console.log('\n=== PAYBACK IT DELIVERS, and the LADDER TEST (does the newer rung out-earn the older?) ===');
console.log('scen        target   DOMINANT p25/med/p75      STALE med (era<scen)   loss-making stale');
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
  console.log(`${id.padEnd(11)} ${pad(P(se) + 'y', 6)}  ${pad(`${f1(q(fin(D), .25))} / ${f1(q(fin(D), .5))} / ${f1(q(fin(D), .75))}`, 22)} `
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
