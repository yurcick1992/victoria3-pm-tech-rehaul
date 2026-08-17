// THE SOLVENCY LINTER — §10.62 / landmine L18, user-ruled 2026-08-17.
//
// THE RULE. A tier's BASE production method must be able to break even at SOME price the engine can
// actually produce. Concretely: with its output at the +75% band edge and every input at the −75% edge —
// the most favourable combination the game allows — output revenue must still cover input goods plus
// wages. A tier that fails is insolvent at EVERY reachable price, which is not a balance opinion but an
// arithmetic fact about a building that can never pay for itself.
//
// ⚠⚠ THIS IS DELIBERATELY *NOT* "a recipe may not destroy value at base prices" (user ruling, same day).
// That easy rule is wrong for this ladder: an early tier is MEANT to be insolvent at base prices — its
// whole design is to be carried by a high output price and then driven out as later tiers deflate that
// price. A sub-1 output:input ratio at base is legitimate (§10.50.1). Only the UNREACHABLE case is
// forbidden. Today six tiers destroy value at base prices and all six are legal.
//
// ⚠ WAGES ARE INCLUDED, on the repo's standard full-break-even basis: `wage_pct` is the wage fraction of
// TOTAL cost, so W = Ibase·wp/(1−wp), the same quantity `lint_profitability.awk` uses. They matter more
// here than anywhere else, because wages do NOT scale with goods prices — at the favourable extreme the
// discounted goods bill is 0.25·Ibase while wages are still 0.333·Ibase, i.e. wages become the LARGER
// term. Goods-only the threshold is O:I ≥ 0.143; wage-inclusive it is O:I ≥ 0.333.
//
// ⚠ WHY THIS EXISTS AS ITS OWN CHECK rather than a line in lint_profitability.awk — both reasons are
// load-bearing and both are why the port slipped through for months (F67):
//   1. SCOPE. That linter reads `tools/ladder_tiers.txt`, which `build.ps1` writes only for industries
//      with neither `follows_be:false` nor `no_mass_be`. Port, railway and power are excluded, so three
//      of the offenders are invisible to it. THIS check must see every tier, and does.
//   2. CIRCULARITY. That linter compares a recipe against `target_be`, and `target_be` is restated BY the
//      solver FROM that same recipe — deviation 0 by construction, which its own source comment admits
//      ("it can no longer tell us the balance is wrong"). So this check must never read `target_be`; it
//      recomputes from the goods block against the shared price table.
//
// Usage:  node tools/lint_solvency.mjs [--config <path>] [--census] [--goods-only]
//   exit 0 = pass · exit 1 = at least one tier is insolvent at every reachable price
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CFG = (p => isAbsolute(p) ? p : join(REPO, p))(argOf('--config', 'config/mod_config.json'));

// The engine's own band: price = base × [1 + 0.75·clamp(±1)] ⇒ 25%…175% of base. GAME CONSTANTS.
const BAND_HI = 1.75, BAND_LO = 0.25, DEFAULT_WAGE_PCT = 0.25;
const GOODS_ONLY = args.includes('--goods-only');   // A/B only: drops the wage term. Not the shipped rule.

// Prices come from the ONE table, never a copy inside a script (same rule as the awks' -v PRICES=).
const PRICES = {};
for (const ln of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) {
  const [g, p] = ln.split(/\t+/);
  if (g && p && !isNaN(+p)) PRICES[g.trim()] = +p;
}

const cfg = JSON.parse(readFileSync(CFG, 'utf8'));
const rows = [];
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  for (const t of ind.tiers || []) {
    const outGood = t.output_good || ind.output_good;
    const Obase = (t.output_qty || 0) * (PRICES[outGood] || 0);
    let Ibase = 0, missing = [];
    for (const [g, q] of Object.entries(t.inputs || {})) {
      if (PRICES[g] == null) missing.push(g);
      Ibase += q * (PRICES[g] || 0);
    }
    // A tier with no priced output or no inputs has nothing to test — a labour-only building cannot be
    // insolvent by this rule. Report unpriced goods rather than scoring them as free.
    if (missing.length) console.error(`  ! ${t.key}: no base price for ${missing.join(', ')} — treated as £0`);
    if (!(Obase > 0) || !(Ibase > 0)) continue;
    const wp = t.wage_pct != null ? +t.wage_pct : DEFAULT_WAGE_PCT;
    const W = GOODS_ONLY ? 0 : Ibase * wp / (1 - wp);        // wages do NOT scale with goods prices
    const bestRevenue = BAND_HI * Obase;
    const bestCost = BAND_LO * Ibase + W;
    rows.push({
      key: t.key, ind: ind.id, era: t.era,
      ratio: Obase / Ibase, Obase, Ibase, wp,
      margin: bestRevenue / bestCost,
      needBe: Math.round(Ibase / ((1 - wp) * Obase) * 100),   // output %-of-base needed to break even
    });
  }
}

rows.sort((a, b) => a.margin - b.margin);
const fails = rows.filter(r => r.margin < 1);

if (args.includes('--census')) {
  console.log(`SOLVENCY CENSUS — ${rows.length} tiers, closest to the line first`
    + (GOODS_ONLY ? '  [--goods-only: WAGES EXCLUDED, not the shipped rule]' : ''));
  console.log('  best-case    O:I   needs out%   tier');
  for (const r of rows.slice(0, 12)) {
    console.log(`  ×${r.margin.toFixed(2).padStart(6)}  ${r.ratio.toFixed(2).padStart(6)}`
      + `   ${String(r.needBe).padStart(6)}%    ${r.key} (${r.ind}, e${r.era})`);
  }
  const sub1 = rows.filter(r => r.ratio < 1);
  console.log(`\n  ${sub1.length} tier(s) destroy value at BASE prices — legal by §10.50.1, listed for context:`);
  for (const r of sub1) console.log(`    O:I ${r.ratio.toFixed(2)}  needs out ${r.needBe}%  ${r.key}`);
}

if (fails.length) {
  console.error(`\nSOLVENCY LINT FAILED: ${fails.length} tier(s) cannot break even at ANY price the engine `
    + `can produce (output +75%, inputs −75%, wages included).`);
  for (const r of fails) {
    console.error(`  ${r.key} (${r.ind}, e${r.era}): needs its output at ${r.needBe}% of base to break `
      + `even; the engine stops at 175%. Best case ×${r.margin.toFixed(2)} `
      + `(out £${r.Obase.toFixed(0)}, in £${r.Ibase.toFixed(0)}, wage_pct ${r.wp}).`);
  }
  console.error(`\nThe remedy is more output or a leaner recipe — NOT relaxing the bound, and NOT a hand `
    + `edit of target_be (which is restated from the recipe and would simply follow it).`);
  process.exit(1);
}
console.log(`SOLVENCY CHECK PASSED: ${rows.length} tiers can each break even somewhere inside the engine's `
  + `25–175% price band.`);
