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

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
