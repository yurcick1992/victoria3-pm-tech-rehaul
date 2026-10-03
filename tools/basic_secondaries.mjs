#!/usr/bin/env node
// THE MOST BASIC SECONDARY METHODS OF EVERY RUNG — what build.ps1 adds to a building's recipe for the "Recipe BE" in its name
// (user-ruled 2026-10-03, BALANCE_FRAMEWORK §10.93: "BE numbers should mean 'under most basic of all secondary PMs available for the
// building'. Not 'main PM only'").
//
//   node tools/basic_secondaries.mjs --config <book>
//   node tools/basic_secondaries.mjs --config <book> --options   # the balance sheet's per-rung secondary OPTIONS instead (ui/data.js sec_options)
//
// --options prints { "<tier key>": { "<pmg>": [vanilla member, …] } } for every rung whose legal members differ from vanilla's group list — the
// reviewed table, vanilla's PM gates, a mandate, the rung's exclusions (lib_secondary_compat secondaryOptions); an empty list = the building does
// not carry that group. The sheet offers exactly these and defaults to the first, so its BE matches the book's target_be and the game.
//
// Prints ONE JSON object on stdout: { "<tier key>": { "in": {good: qty}, "out": {good: qty}, "methods": [pm, …] } } for every rung whose
// basic secondaries carry goods; a rung absent from it runs only "off" methods beside its main one. QUANTITIES, not £ — the builder prices
// them with its own table, so a price can never differ between the label and the recipe beside it.
// ⭐ The same library as make_ab_config's target_be restatement and restate_basic_be.mjs (lib_secondary_compat basicTotals), and the
//   profitability lint reads the EMITTED mod on the same rule — so the name, the book and the lint agree by construction.
// ⚠ A goods-less basic method (an "off" member, or a labour-saving one that only removes jobs) moves the WAGE term and nothing else, and the
//   name's label is goods-only (wages ignored, user-ruled 2026-09-18) — so it is left out here, not printed as an empty entry.
import { readFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVanilla } from './lib_vanilla_ladder.mjs';
import { basicTotals, secondaryOptions } from './lib_secondary_compat.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CFGP = (p => isAbsolute(p) ? p : join(REPO, p))(argOf('--config', 'config/mod_config.json'));

const cfg = JSON.parse(readFileSync(CFGP, 'utf8').replace(/^\uFEFF/, ''));
const V = readVanilla(GAME);
const out = {};
const nonzero = o => Object.values(o || {}).some(q => q !== 0);
const OPTIONS = args.includes('--options');
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  for (const t of ind.tiers || []) {
    if (OPTIONS) {
      const o = secondaryOptions(ind, t, V), diff = {};
      for (const [g, ms] of Object.entries(o)) if (ms.join(' ') !== ((V.PMG || {})[g] || []).join(' ')) diff[g] = ms;
      if (Object.keys(diff).length) out[t.key] = diff;
      continue;
    }
    const bt = basicTotals(ind, t, V);
    if (!nonzero(bt.in) && !nonzero(bt.out)) continue;
    out[t.key] = { in: bt.in, out: bt.out, methods: bt.methods };
  }
}
process.stdout.write(JSON.stringify(out));
