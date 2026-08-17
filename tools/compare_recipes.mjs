// READABLE RECIPE DIFF — what a re-solve actually changed, by INDUSTRY and TIER.
//
// WHY IT EXISTS. A re-solve touches every tier, so the raw diff is a 100+ line list of decimals that
// nobody can read and nobody can rule on (user, 2026-08-17: "a _readable_ summary on changes by industry
// and tier, not just a 100+ entries list of deltas"). This groups by industry, states each industry's
// story in one line, and then shows only the tiers that MOVED — with the quantities a balance decision
// actually turns on: the break-even, the output:input ratio at base prices, and the size of the input cut.
//
// ⚠ Output volumes are NOT expected to move: §8 solves INPUTS and leaves `output_qty` alone. The tool
// reports an output change loudly if it finds one, because that would mean something other than the
// recipe solve ran.
//
// Usage:  node tools/compare_recipes.mjs --before <cfg> --after <cfg> [--all] [--threshold 2]
//   --all        also list industries with no material change
//   --threshold  percent input-value change below which a tier counts as unchanged (default 2)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const abs = p => isAbsolute(p) ? p : join(REPO, p);
const THRESH = +argOf('--threshold', '2');
const SHOW_ALL = args.includes('--all');

const PRICES = {};
for (const ln of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) {
  const [g, p] = ln.split(/\t+/);
  if (g && p && !isNaN(+p)) PRICES[g.trim()] = +p;
}
const load = p => {
  const cfg = JSON.parse(readFileSync(abs(p), 'utf8'));
  const m = new Map();
  for (const ind of cfg.industries || []) for (const t of ind.tiers || []) {
    const og = t.output_good || ind.output_good;
    const O = (t.output_qty || 0) * (PRICES[og] || 0);
    let I = 0; for (const [g, q] of Object.entries(t.inputs || {})) I += q * (PRICES[g] || 0);
    const wp = t.wage_pct != null ? +t.wage_pct : 0.25;
    m.set(t.key, {
      ind: ind.id, era: t.era, name: t.name, O, I, wp, outQty: t.output_qty,
      inputs: { ...(t.inputs || {}) }, be: O > 0 ? I / ((1 - wp) * O) * 100 : NaN,
      ratio: I > 0 ? O / I : Infinity,
    });
  }
  return m;
};
const A = load(argOf('--before', 'config/mod_config.json'));
const B = load(argOf('--after', 'config/mod_config.solvent175.json'));

const pc = (x, y) => (y - x) / (x || 1) * 100;
const sign = v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%';
const CAP = 175;

// group by industry
const inds = new Map();
for (const [k, b] of B) {
  const a = A.get(k); if (!a) continue;
  const dI = pc(a.I, b.I);
  const e = inds.get(b.ind) || { tiers: [], moved: 0 };
  e.tiers.push({ key: k, a, b, dI, moved: Math.abs(dI) >= THRESH });
  if (Math.abs(dI) >= THRESH) e.moved++;
  inds.set(b.ind, e);
}

// ---- headline -------------------------------------------------------------------------------------
const allT = [...inds.values()].flatMap(e => e.tiers);
const movedT = allT.filter(t => t.moved);
const wasOver = allT.filter(t => t.a.be > CAP);
const nowOver = allT.filter(t => t.b.be > CAP);
const outMoved = allT.filter(t => Math.abs(pc(t.a.outQty, t.b.outQty)) > 0.5);

console.log('='.repeat(96));
console.log('RECIPE DIFF — ' + argOf('--before', '?') + '  ->  ' + argOf('--after', '?'));
console.log('='.repeat(96));
console.log(`${movedT.length} of ${allT.length} tiers moved by ≥${THRESH}% of input value, across `
  + `${[...inds.values()].filter(e => e.moved).length} of ${inds.size} industries.`);
console.log(`Over the ${CAP}% break-even cap:  before ${wasOver.length}  ->  after ${nowOver.length}`
  + (nowOver.length ? '   ⚠ STILL OVER: ' + nowOver.map(t => t.key).join(', ') : '   ✓ all clear'));
if (outMoved.length) {
  console.log(`⚠⚠ ${outMoved.length} tier(s) changed OUTPUT volume, which a recipe solve should not do:`);
  for (const t of outMoved) console.log(`     ${t.key}  ${t.a.outQty} -> ${t.b.outQty}`);
} else console.log('Output volumes unchanged in every tier, as §8 requires.');

// total input bill, a one-number read on how much cheaper the whole book got
const sumA = allT.reduce((s, t) => s + t.a.I, 0), sumB = allT.reduce((s, t) => s + t.b.I, 0);
console.log(`Whole-book input bill at base prices: £${sumA.toFixed(0)} -> £${sumB.toFixed(0)}  (${sign(pc(sumA, sumB))})`);

// ---- per industry ---------------------------------------------------------------------------------
const order = [...inds.entries()].sort((x, y) => {
  const mx = Math.max(...x[1].tiers.map(t => Math.abs(t.dI)), 0);
  const my = Math.max(...y[1].tiers.map(t => Math.abs(t.dI)), 0);
  return my - mx;
});
for (const [id, e] of order) {
  if (!e.moved && !SHOW_ALL) continue;
  const biggest = e.tiers.reduce((m, t) => Math.abs(t.dI) > Math.abs(m.dI) ? t : m, e.tiers[0]);
  const iA = e.tiers.reduce((s, t) => s + t.a.I, 0), iB = e.tiers.reduce((s, t) => s + t.b.I, 0);
  // one-line story for the industry
  let story;
  if (!e.moved) story = 'unchanged';
  else if (e.moved === e.tiers.length) story = `all ${e.tiers.length} tiers re-solved`;
  else story = `${e.moved} of ${e.tiers.length} tiers re-solved`;
  console.log('\n' + '-'.repeat(96));
  console.log(`${id.toUpperCase()}  —  ${story}, industry input bill ${sign(pc(iA, iB))}`
    + (e.moved ? `, largest move ${biggest.key.replace(/^building_/, '')} ${sign(biggest.dI)}` : ''));
  const hdr = e.tiers.some(t => t.a.be > CAP);
  if (hdr) console.log(`  ⚠ this industry held a tier over the ${CAP}% cap`);
  console.log('   era  tier                              target BE        O:I        input value');
  for (const t of e.tiers) {
    if (!t.moved && !SHOW_ALL) continue;
    const flagA = t.a.be > CAP ? '!' : ' ', flagB = t.b.be > CAP ? '!' : ' ';
    const changed = t.moved ? '' : '   (unchanged)';
    console.log(`   e${t.b.era}   ${t.key.replace(/^building_/, '').padEnd(32)}`
      + `${flagA}${t.a.be.toFixed(0).padStart(4)} ->${flagB}${t.b.be.toFixed(0).padStart(4)}   `
      + `${t.a.ratio.toFixed(2).padStart(5)} -> ${t.b.ratio.toFixed(2).padStart(5)}   `
      + `£${t.a.I.toFixed(0).padStart(6)} -> £${t.b.I.toFixed(0).padStart(6)}  ${sign(t.dI).padStart(6)}`
      + changed);
    // name the goods that actually moved, so a reader can see WHAT got cheaper
    if (t.moved) {
      const gs = new Set([...Object.keys(t.a.inputs), ...Object.keys(t.b.inputs)]);
      const parts = [];
      for (const g of gs) {
        const qa = t.a.inputs[g] || 0, qb = t.b.inputs[g] || 0;
        if (Math.abs(qb - qa) < 1e-9) continue;
        parts.push(`${g} ${qa} -> ${qb}`);
      }
      if (parts.length) console.log('          ' + parts.join(' · '));
    }
  }
}
console.log('\n' + '='.repeat(96));
