// THE SOLVENCY LINTER — §10.63 / landmine L18, user-ruled 2026-08-17.
//
// THE RULE. **A tier's target BE may not exceed 175.** That is the tier's full, wage-inclusive
// break-even — the OUTPUT price, as a % of base, at which its BASE production method covers its input
// goods plus wages, with inputs at base prices — against the engine's own +75% band edge:
//
//     target_be = Ibase / ((1 − wage_pct) · Obase) · 100  ≤  175   ⟺   Ibase ≤ 1.75 · (1 − wp) · Obase
//                                                                  ⟺   O:I ≥ 0.762 at wp = 0.25
//
// A tier that fails is insolvent at EVERY output price the engine can produce. That is not a balance
// opinion, it is arithmetic about a building that can never pay for itself.
//
// ⚠⚠ THIS IS THE SECOND, STRICTER RULING (2026-08-17). The first allowed BOTH prices to their favourable
// edges — output ×1.75 AND inputs ×0.25, i.e. `target_be ≤ 400` — which was measured at **0 of 105** before
// it shipped and could not catch the defect that prompted it. Holding INPUTS AT BASE is what makes the
// bound bite. `--band` still scores that older, weaker line for comparison.
//
// ⚠ IT IS STILL NOT "a recipe may not destroy value at base prices" (that would be ≤ 100, and is
// rejected): an early tier is MEANT to be insolvent at base and carried by a higher output price. What is
// forbidden is only the UNREACHABLE case. ⚠ **The §10.50 recipe ratchet is untouched and orthogonal** —
// that one is relative (a tier against the one below), this one absolute (a tier against the engine).
// ⚠ **Shipyards are NOT exempt** (user, same ruling); they cost nothing today, all seven sitting at ≤128.
//
// ⚠ WAGES ARE INCLUDED, on the repo's standard full-break-even basis: `wage_pct` is the wage fraction of
// TOTAL cost, so W = Ibase·wp/(1−wp) — the same quantity `lint_profitability.awk` uses. Excluding them
// would slacken the bound to O:I ≥ 0.571.
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
// Usage:  node tools/lint_solvency.mjs [--config <path>] [--census] [--goods-only] [--band]
//   exit 0 = pass · exit 1 = at least one tier is insolvent at every reachable output price
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CFG = (p => isAbsolute(p) ? p : join(REPO, p))(argOf('--config', 'config/mod_config.json'));

// The engine's own band: price = base × [1 + 0.75·clamp(±1)] ⇒ 25%…175% of base. GAME CONSTANTS, not
// tuning knobs — deliberately not env-overridable.
const MAX_TARGET_BE = 175, BAND_LO = 0.25, DEFAULT_WAGE_PCT = 0.25;
const GOODS_ONLY = args.includes('--goods-only');   // A/B only: drops the wage term. Not the shipped rule.
const BAND_MODE = args.includes('--band');          // A/B only: the SUPERSEDED both-edges line (≤400).

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
    // needBe = the output price, as a % of base, at which this tier breaks even WITH INPUTS AT BASE.
    // `--band` scores the superseded line instead, in which inputs also fall to the −75% edge.
    const goodsBill = BAND_MODE ? BAND_LO * Ibase : Ibase;
    const needBe = (goodsBill + W) / Obase * 100;
    rows.push({
      key: t.key, ind: ind.id, era: t.era,
      ratio: Obase / Ibase, Obase, Ibase, wp,
      needBe: Math.round(needBe),
      headroom: MAX_TARGET_BE / needBe,        // >1 = passes; how much slack it has
    });
  }
}

rows.sort((a, b) => b.needBe - a.needBe);
const fails = rows.filter(r => r.needBe > MAX_TARGET_BE);
const mode = (BAND_MODE ? '  [--band: SUPERSEDED both-edges line]' : '')
  + (GOODS_ONLY ? '  [--goods-only: WAGES EXCLUDED, not the shipped rule]' : '');

if (args.includes('--census')) {
  console.log(`SOLVENCY CENSUS — ${rows.length} tiers, worst break-even first (cap ${MAX_TARGET_BE}%)${mode}`);
  console.log('  target BE    O:I   headroom   tier');
  for (const r of rows.slice(0, 12)) {
    console.log(`  ${String(r.needBe).padStart(7)}%  ${r.ratio.toFixed(2).padStart(6)}`
      + `   ×${r.headroom.toFixed(2).padStart(5)}   ${r.key} (${r.ind}, e${r.era})`
      + (r.needBe > MAX_TARGET_BE ? '   <<< OVER' : ''));
  }
  const sub1 = rows.filter(r => r.ratio < 1);
  console.log(`\n  ${sub1.length} tier(s) destroy value at BASE prices. That is LEGAL (§10.50.1) and stays`
    + ` legal — only the ones over ${MAX_TARGET_BE}% fail:`);
  for (const r of sub1) console.log(`    O:I ${r.ratio.toFixed(2)}  target BE ${r.needBe}%  ${r.key}`
    + (r.needBe > MAX_TARGET_BE ? '   <<< OVER' : '   ok'));
}

if (fails.length) {
  console.error(`\nSOLVENCY LINT FAILED: ${fails.length} tier(s) have a target BE above ${MAX_TARGET_BE}% — `
    + `they cannot break even at ANY output price the engine can produce (wages included, inputs at base).`);
  for (const r of fails) {
    console.error(`  ${r.key} (${r.ind}, e${r.era}): break-even at ${r.needBe}% of base, cap is `
      + `${MAX_TARGET_BE}% (out £${r.Obase.toFixed(0)}, in £${r.Ibase.toFixed(0)}, wage_pct ${r.wp}; `
      + `needs input value ≤ £${(MAX_TARGET_BE / 100 * (1 - r.wp) * r.Obase).toFixed(0)}).`);
  }
  console.error(`\nThe remedy is more output or a leaner recipe — NOT relaxing the bound, and NOT a hand `
    + `edit of target_be (which is restated from the recipe and would simply follow it).`);
  process.exit(1);
}
console.log(`SOLVENCY CHECK PASSED: all ${rows.length} tiers break even at or below ${MAX_TARGET_BE}% of `
  + `base output price — inside the engine's own band.${mode}`);
