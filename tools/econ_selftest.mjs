// Regression check for ui/econ.js, run headless. Every expected value below is a MEASURED number already
// recorded in CLAUDE.md / FINDINGS — not a snapshot of whatever the code happened to print. That is the
// point: if the extraction changed the model, these fail against the game, not against themselves.
//
//   node tools/econ_selftest.mjs
import { loadEcon } from './econ_host.mjs';

const { E, S, presets } = loadEcon();
let fails = 0;
const near = (label, got, want, tol, note) => {
  const ok = Number.isFinite(got) && Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(46)} got ${fmt(got)}  want ${fmt(want)} ±${tol}${note ? '   (' + note + ')' : ''}`);
};
const fmt = v => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(4)) : String(v));
const P = id => { const p = presets.find(x => x.id === id); if (!p) throw new Error(`preset ${id} missing`); return p; };

// ---- F27: the slave-basket multiplier is DERIVED from residual employment, and both large slave markets
// were measured directly. The published figures are the BASKET MULTIPLIER (share + 0.05 × the rest), not
// the bare share: USA derives 0.209 against a measured 0.224; Britain 0.05 against 0.044 — Britain's free
// lower stratum already exceeds every unqualified job, so its real share is 0 and only the 0.05
// subsistence floor remains.
E.applyPreset(P('usa_1836'));
near('F27  USA slave basket multiplier', E.slaveBasketMult(), 0.209, 0.010, 'measured 0.224');
near('F27  USA slaves in real jobs (share)', E.slaveRealShare(), 0.1676, 0.010, '⇒ the 0.209 above');
E.applyPreset(P('gbr_1836'));
near('F27  GBR slave basket multiplier', E.slaveBasketMult(), 0.05, 0.005, 'measured 0.044; free labour covers every job');
near('F27  GBR slaves in real jobs (share)', E.slaveRealShare(), 0.0, 0.001, 'floor only');

// ---- F26 / measured_1836: the per-market base wage rides in the preset and is applied by applyPreset.
// CANONICAL basis = base_weekly_wage (laborers + farmers + machinists, EMPLOYED only), NOT the superseded
// 11-profession base_weekly_labour, which reads 0.0490 / 0.0741 for these two markets.
E.applyPreset(P('aus_1836'));
near('F26  Austrian market base wage £/wk', S.BASE_WAGE, 0.060633, 0.0008);
E.applyPreset(P('bel_1836'));
near('F26  Belgian market base wage £/wk', S.BASE_WAGE, 0.078136, 0.0008);

// ---- The placeholder wage is derived, not measured: base = exp((SoL − 37.43) / 10.49).
for (const [id, sol] of [['ph_sol8', 8], ['ph_sol16', 16]]) {
  E.applyPreset(P(id));
  near(`F26  ${id} derived base wage`, S.BASE_WAGE, Math.exp((sol - 37.43) / 10.49), 1e-4);
}

// ---- The order book has to actually populate, and pop demand has to be a real share of it. A silent
// failure here (empty needs table, missing buy packages) would look like "prices at base" downstream.
E.applyPreset(P('bel_1836'));
const agg = E.scenarioAggregates();
const popGrain = (agg.pop.grain || 0), bldGrain = (agg.inAgg.grain || 0);
console.log(`\nBelgium 1836 order book: ${Object.keys(agg.outAgg).length} goods supplied, `
  + `grain buy = ${popGrain.toFixed(0)} pops + ${bldGrain.toFixed(0)} buildings`);
near('     Belgian pop grain demand > 0', popGrain > 0 ? 1 : 0, 1, 0);
near('     Belgian building grain demand > 0', bldGrain > 0 ? 1 : 0, 1, 0);

// ---- The V3 price formula, checked at its documented anchor points rather than on live data.
near('     price formula: balanced market', E.priceMultPct(100, 100), 100, 0);
near('     price formula: 2x buy  → +75% cap', E.priceMultPct(200, 100), 175, 0);
near('     price formula: 2x sell → −75% cap', E.priceMultPct(100, 200), 25, 0);
near('     price formula: buy = 1.667 × sell', E.priceMultPct(1667, 1000), 150, 1);

// ---- Wage units: food T1 is 500 shopkeepers (weight 3) + 4500 laborers (weight 1) = 6000.
const food = S.IND.find(i => i.id === 'food');
near('     food T1 wage units', E.wageUnits(E.tierEmp(food.tiers[0])), 6000, 0);

// ---- F31 / §10.34: the two readings of `max_supply_share`. 'raw' is what ships; 'final' is the rejected
// alternative, kept as an A/B switch. These pin the behaviour that made the comparison meaningful — above
// all the YIELD rule, without which a need whose other goods do not exist yet silently loses its budget.
const NC = S.POPM.needs.popneed_communication;
const splitOf = (mode, supply) => {
  S.SPLIT_MODE = mode;
  const r = E.needSplit('popneed_communication', NC, supply, {}) || [];
  S.SPLIT_MODE = 'raw';
  return Object.fromEntries(r.map(x => [x.g, x.s]));
};
near('     split: telephones unmade → raw yields 100%',
  splitOf('raw', { transportation: 1000, telephones: 0 }).transportation, 1, 0);
near('     split: telephones unmade → final YIELDS too',
  splitOf('final', { transportation: 1000, telephones: 0 }).transportation, 1, 0,
  'caps must yield when nothing with supply can absorb the money');
// ⚠ the expected number MOVED with F40's value-weighted availability, and the test's point did not: one
// unit of telephones (base 70) now carries 2.33x the availability of one unit of transportation (base 30),
// so the same 1000-vs-1 supply is a slightly less lopsided split. 0.997 was the count-based reading.
near('     split: one tiny producer, raw ≈ cancels the cap',
  splitOf('raw', { transportation: 1000, telephones: 1 }).transportation, 0.9938, 0.001,
  'the 0.75 cap moves it 0.6pp — §10.34');
near('     split: one tiny producer, final binds at the cap',
  splitOf('final', { transportation: 1000, telephones: 1 }).telephones, 0.25, 0.001,
  'the bootstrap the rejected reading would give a debut good');
near('     split: uncapped case — the modes agree',
  splitOf('final', { transportation: 1000, telephones: 1000 }).telephones
  - splitOf('raw', { transportation: 1000, telephones: 1000 }).telephones, 0, 1e-9);

// ---- F40: the split rule against a MEASURED GAMESTATE. Supply is that market's sell orders and non-pop
// demand is the sum of every building's input_goods, both read out of the 1925 save + its own telemetry
// (session 20260806_110926_vanilla-retest-2 run003). The expected values are the game's OWN stored purchase
// weights for that state, converted from `share` to the money share needSplit returns (money ∝ weight×share).
// ⭐ American basic_food is the discriminating case: grain and fish are base 20 against 30 for the other
// three, so a count-based availability gets it wrong (5.43 pp) where a value-based one does not (1.63 pp).
const splitNeed = (need, supply, nonpop) => {
  const def = S.POPM.needs[need];
  const r = E.needSplit(need, def, supply, nonpop) || [];
  return Object.fromEntries(r.map(x => [x.g, x.s]));
};
{
  const s = splitNeed('popneed_basic_food',
    { grain: 10405.34, fish: 2917.77, groceries: 6948.63, meat: 1201.18, fruit: 1138.68 },
    { grain: 4455.6, fish: 440.7, groceries: 822.5, meat: 293.8, fruit: 0 });
  const want = { grain: 0.28724, fish: 0.11094, groceries: 0.46611, meat: 0.06518, fruit: 0.07054 };
  for (const g of Object.keys(want))
    near(`     F40  American basic_food 1925 — ${g}`, s[g], want[g], 0.02, 'the game\'s own stored purchase weight');
}
{
  const s = splitNeed('popneed_luxury_food',
    { groceries: 5103.87, meat: 5467.65, fruit: 15935.76, sugar: 18035.08 },
    { groceries: 880.4, meat: 227.9, fruit: 0, sugar: 1494.5 });
  const want = { groceries: 0.20355, meat: 0.19620, fruit: 0.34788, sugar: 0.25237 };
  for (const g of Object.keys(want))
    near(`     F40  British luxury_food 1925 — ${g}`, s[g], want[g], 0.02, 'the game\'s own stored purchase weight');
}

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
