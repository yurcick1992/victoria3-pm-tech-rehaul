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

// What supply share would reading A need in order to explain the measurement?
const target = mA / (mA + mT);
const need = (0.75 * target) / (1.25 * (1 - target));
console.log('\nSENSITIVITY — for reading A to produce the measured share, automobiles would need a');
console.log('  supply share of ' + (100 * need).toFixed(1) + '% (with transportation pinned at its 0.75 cap).');
console.log('  Measured supply share is ' + (100 * rawShare).toFixed(2) + '%.');
