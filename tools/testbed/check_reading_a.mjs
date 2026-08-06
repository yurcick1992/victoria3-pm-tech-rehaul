// check_reading_a.mjs — what does OUR OWN needSplit() predict for free_movement, at a measured date?
//
//   node tools/testbed/check_reading_a.mjs
//
// WHY IT EXISTS. The predicted share was first worked out by hand, and a hand calculation of this rule
// is exactly the kind of thing that quietly omits a term. It omitted one: the **−0.5 × non-pop buy
// orders** correction (FINDINGS F22), which is the single most load-bearing part of the split and is
// worth ~14 pp of accuracy on its own. So the prediction is taken from `needSplit()` in ui/econ.js —
// the shared implementation the balance sheet and the solvers both use — rather than re-derived.
//
// ⚠ It reads MEASURED inputs, not modelled ones: sell orders and total buy orders from the run's own
// order book, and the pop/non-pop split from the run's own verified breakdown blocks. Nothing here
// depends on our building model.
import { loadEcon } from '../econ_host.mjs';
const { E, S } = loadEcon({ quiet: true });

// 1915.3.1, British Market, session 20260806_110926_vanilla-retest-2 run 2 (control arm, vanilla).
const sell   = { transportation: 24099.3, automobiles: 2198.4 };
const buyTot = { transportation: 25676.0, automobiles: 4041.7 };
const pop    = { transportation: 15800,   automobiles: 2190   };  // verified breakdown blocks
const price  = { transportation: 30,      automobiles: 100    };  // BASE prices (money = units × base)
const nonpop = { transportation: buyTot.transportation - pop.transportation,
                 automobiles:    buyTot.automobiles    - pop.automobiles };

// popneed_free_movement, verbatim from common/pop_needs/00_pop_needs.txt
const def = { entries: [ { g: 'transportation', w: 1,    max: 0.75, min: 0 },
                         { g: 'automobiles',    w: 1.25, max: 1.00, min: 0 } ] };

console.log('MEASURED INPUTS (British Market, 1915.3.1, run 2)');
console.log('  sell orders   :', JSON.stringify(sell));
console.log('  total buy     :', JSON.stringify(buyTot));
console.log('  pop buy       :', JSON.stringify(pop));
console.log('  => non-pop buy:', JSON.stringify(nonpop), '  <- the -0.5x term acts on this');
const rawShare = sell.automobiles / (sell.automobiles + sell.transportation);
console.log('  automobile RAW supply share:', (100 * rawShare).toFixed(2) + '%\n');

console.log('PREDICTIONS from ui/econ.js needSplit() — the shipped implementation, not hand arithmetic');
for (const mode of ['raw', 'final']) {
  S.SPLIT_MODE = mode;
  const r = E.needSplit('popneed_free_movement', def, sell, nonpop);
  const lbl = mode === 'raw' ? 'raw   (reading A, shipped)' : 'final (reading B, the cap-complement)';
  console.log('  ' + lbl.padEnd(38) + r.map(x => `${x.g} ${(100 * x.s).toFixed(2)}%`).join('   '));
}

const mA = pop.automobiles * price.automobiles, mT = pop.transportation * price.transportation;
console.log('\nMEASURED');
console.log('  automobiles    £' + mA.toLocaleString() + '   transportation £' + mT.toLocaleString());
console.log('  automobile share of free_movement, LOWER BOUND: ' + (100 * mA / (mA + mT)).toFixed(1) + '%');
console.log('  (a LOWER bound because it credits ALL transportation pop money to free_movement;');
console.log('   whatever popneed_communication takes makes the true automobile share HIGHER)');

// ---------------------------------------------------------------------------------------------
// IS `weight` APPLIED CORRECTLY? (user, 2026-08-06) Rather than assert that it is, enumerate every
// plausible way it could be applied and show what each predicts. If the shipped one is wrong, one of
// the alternatives should land near the measurement; none does.
const target = mA / (mA + mT);
const effT = sell.transportation - 0.5 * nonpop.transportation;
const effA = sell.automobiles    - 0.5 * nonpop.automobiles;
const share = (a, b) => a / (a + b);
const norm  = (a, b) => a / (a + b);
const V = [];
// 1. SHIPPED: clamp the within-need supply share, then multiply by weight.
{ const sT = Math.min(0.75, share(effT, effA)), sA = Math.min(1, share(effA, effT));
  V.push(['shipped — weight × clamp(within-need share), non-pop subtracted', norm(1.25 * sA, 1.0 * sT)]); }
// 2. Same, but WITHOUT the -0.5 × non-pop term (which the shipped comment does not mention).
{ const sT = Math.min(0.75, share(sell.transportation, sell.automobiles)), sA = share(sell.automobiles, sell.transportation);
  V.push(['no non-pop subtraction', norm(1.25 * sA, 1.0 * sT)]); }
// 3. No clamp at all — weight × raw share.
{ const sT = share(effT, effA), sA = share(effA, effT);
  V.push(['no max_supply_share clamp', norm(1.25 * sA, 1.0 * sT)]); }
// 4. Weight NOT applied — clamped shares normalised alone.
{ const sT = Math.min(0.75, share(effT, effA)), sA = Math.min(1, share(effA, effT));
  V.push(['weight ignored entirely', norm(sA, sT)]); }
// 5. Weight applied to SUPPLY before the share is taken, rather than to the share.
{ const wT = 1.0 * effT, wA = 1.25 * effA;
  V.push(['weight × supply, then share (weight applied too early)', norm(wA, wT)]); }
// 6. Clamp applied to the WEIGHTED value rather than to the share.
{ const wT = Math.min(0.75, 1.0 * share(effT, effA)), wA = Math.min(1, 1.25 * share(effA, effT));
  V.push(['clamp applied AFTER the weight', norm(wA, wT)]); }
console.log('\nEVERY PLAUSIBLE WEIGHT APPLICATION, against the measurement');
console.table(V.map(([label, s]) => ({
  'how weight is applied': label,
  'predicted automobile share': (100 * s).toFixed(2) + '%',
  'measured (lower bound)':     (100 * target).toFixed(1) + '%',
  'explains it?':               s >= target ? 'yes' : 'no — too low'
})));
const needShare = (0.75 * target) / (1.25 * (1 - target));
const needW     = (0.75 * target) / (share(effA, effT) * (1 - target));
console.log('SENSITIVITY — what would have to be true for the SHIPPED rule to produce the measurement:');
console.log('  automobiles would need a supply share of ' + (100 * needShare).toFixed(1) +
            '% (measured: ' + (100 * rawShare).toFixed(2) + '%)');
console.log('  …or a weight of ' + needW.toFixed(2) + ' instead of 1.25 (a ' + (needW / 1.25).toFixed(1) + '× increase)');
