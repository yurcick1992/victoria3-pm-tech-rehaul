// THE SOLVER-2 ARM CONFIG (user-directed 2026-08-24: "Build this Solver 2, add the flat ai_value
// ladder (500+1000*(era+1))"). Derives config/mod_config.solver2.json from the CANONICAL config:
//
//   1. every tier's `output_qty` + `inputs` <- the INVERSE SOLVE's recipe book
//      (config/era_inverse.json `recipes`, §10.65.2 — the design ladder with pop-limited yields);
//   2. `target_be` RESTATED from the new recipe under the linter's own legacy wage_pct model —
//      the same demotion-to-drift-guard rule era_solver.mjs applies when it writes the canonical
//      book (Ibase / ((1 − wp) · Obase) · 100), so lint_profitability stays a drift guard;
//   3. `ai_value` = 500 + 1000 × (era + 1) on EVERY tier (e0 1500 … e5 6500) — the next rung of the
//      F76 ladder family (canon flat → aival 500×(era+1) → aival2 1000×(era+1)); every rung now sits
//      ABOVE the untiered field's engine default of 1000, which F76 measured as the operative
//      contrast. ⚠ power (3 tiers) and railway (4) will NOT emit it — New-ClonedBuilding refuses to
//      override their complex vanilla ai_value blocks (standing user ruling from aival; the builder
//      Write-Warnings it) — so the ladder ships on 98 of 105 tiers, same as the aival family.
//
// Also copies config/tech_tree_options.json -> config/tech_tree_options.solver2.json (landmine L20:
// an alternate config without its tech-tree twin kills the build at emit_techs).
// Nothing canonical is touched. Deterministic: same inputs ⇒ byte-identical output.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(REPO, 'config', 'mod_config.json'), 'utf8').replace(/^﻿/, ''));
const inv = JSON.parse(readFileSync(join(REPO, 'config', 'era_inverse.json'), 'utf8'));

// prices from the single source (goods_prices.tsv is what data.js embeds; read the tsv directly so
// this does not depend on a build having run)
const PRICES = {};
for (const line of readFileSync(join(REPO, 'tools', 'goods_prices.tsv'), 'utf8').split(/\r?\n/)) {
  const m = line.split('\t');
  if (m.length >= 2 && !/^#|^good/i.test(m[0]) && +m[1] > 0) PRICES[m[0].trim()] = +m[1];
}

// §10.65.6 opt-in flags (user-approved 2026-08-25):
//   --aival-exp   ai_value = round(750 × 1.8^era) — early rungs at/below the untiered default 1000,
//                 the frontier far above it (the F76 contrast lever, sharpened in both directions)
//   --cost-book   building_cost from the inverse artifact's payback-normalized book (own-era design
//                 payback = 10y at £720/pt; floored at the §10.61 vanilla anchor). Supersedes the
//                 flat §10.61 rule ONLY for arms passing this flag.
const AIVAL_EXP = process.argv.includes('--aival-exp');
const COST_BOOK = process.argv.includes('--cost-book');
let recipes = 0, restated = 0, aival = 0, costed = 0;
for (const ind of cfg.industries) {
  for (const t of ind.tiers) {
    const r = inv.recipes[t.key];
    if (r && ind.follows_be !== false) {
      t.output_qty = r.output_qty;
      t.inputs = { ...r.inputs };
      recipes++;
      const outGood = t.output_good || ind.output_good;
      const Obase = t.output_qty * (PRICES[outGood] || 0);
      let Ibase = 0; for (const g in t.inputs) Ibase += t.inputs[g] * (PRICES[g] || 0);
      const wp = t.wage_pct != null ? +t.wage_pct : 0.25;
      if (Obase > 0) { t.target_be = Math.round(Ibase / ((1 - wp) * Obase) * 100); restated++; }
    }
    if (t.era != null) { t.ai_value = AIVAL_EXP ? Math.round(750 * Math.pow(1.8, t.era)) : 500 + 1000 * (t.era + 1); aival++; }
    if (COST_BOOK && inv.cost_book && inv.cost_book[t.key] != null) { t.building_cost = inv.cost_book[t.key]; costed++; }
  }
}

// optional argv suffix (default 'solver2') so each arm generation gets its own frozen file —
// the aival-family convention: the dead batch's build_state keeps pointing at ITS config untouched
const SFX = process.argv[2] || 'solver2';
const outPath = join(REPO, 'config', `mod_config.${SFX}.json`);
const body = JSON.stringify(cfg);
writeFileSync(outPath, body);
copyFileSync(join(REPO, 'config', 'tech_tree_options.json'), join(REPO, 'config', `tech_tree_options.${SFX}.json`));
console.log(`wrote ${outPath}`);
console.log(`  recipes from the inverse book: ${recipes} · target_be restated: ${restated} · ai_value ${AIVAL_EXP ? 'EXP 750×1.8^era' : 'ladder'} set: ${aival}` + (COST_BOOK ? ` · cost book applied: ${costed}` : ''));
console.log(`  sha256: ${createHash('sha256').update(body).digest('hex').toUpperCase()}`);
console.log(`  tech-tree twin: config/tech_tree_options.${SFX}.json (L20)`);
