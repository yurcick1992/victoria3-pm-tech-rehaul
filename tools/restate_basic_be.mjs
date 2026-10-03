#!/usr/bin/env node
// RESTATE A BOOK'S target_be / wage_pct UNDER THE MOST BASIC SECONDARY METHODS AVAILABLE (user-ruled 2026-10-03, BALANCE_FRAMEWORK §10.93: "BE
// numbers should mean 'under most basic of all secondary PMs available for the building'. Not 'main PM only'. Skipping checks is wrong, rather we
// should check properly so that it'd match").
//
//   node tools/restate_basic_be.mjs --config <book> [--write]
//
// make_ab_config.mjs restates every A/B rung this way since the ruling; this re-applies the SAME formula to a book generated before it, so the book
// need not be regenerated through its whole chain (tier4 → techs → A/B → trade → dams → crafts → merges) to carry it. The formula, per rung:
//   I = the recipe's inputs + its basic secondaries' inputs, O = its output + theirs, W = the rung's era reference wage × the wage units of its own
//   jobs plus its basic secondaries' (lib_secondary_compat basicTotals / basicEmployment); wage_pct = W / (I + W), target_be = (I + W) / O.
// ⭐ IT PROVES ITSELF: an "off" method adds nothing, so every rung whose basic secondaries are "off" must come back with its stored numbers to the
//   last digit — that is the check that this reproduces make_ab_config's (and make_artisan_config's) restatement. Any other rung that moves is
//   reported UNEXPECTED and nothing is written.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wageUnits, eraReferenceWage } from './lib_wage_model.mjs';
import { readVanilla } from './lib_vanilla_ladder.mjs';
import { basicTotals, basicEmployment, mandatedFor, vanillaMainOfTier } from './lib_secondary_compat.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CFGP = (p => isAbsolute(p) ? p : join(REPO, p))(argOf('--config', 'config/mod_config.json'));
const WRITE = args.includes('--write');

const raw = readFileSync(CFGP, 'utf8');
const cfg = JSON.parse(raw.replace(/^\uFEFF/, ''));
if (!Array.isArray(cfg.era_anchor_years)) throw new Error('restate_basic_be: the book carries no era_anchor_years (not a four-rung book)');
const eraWage = eraReferenceWage(cfg.era_anchor_years);
const V = readVanilla(GAME);
const PRICE = {};
for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) { const c = l.trim().split(/\t|\s+/); if (c.length >= 2 && +c[1] > 0) PRICE[c[0]] = +c[1]; }
const val = o => Object.entries(o || {}).reduce((s, [g, q]) => s + q * (PRICE[g] || 0), 0);

const changed = [], unexpected = [];
let n = 0;
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  for (const t of ind.tiers || []) {
    if (t.target_be == null || t.output_qty == null) continue;
    n++;
    const O = t.output_qty * (PRICE[t.output_good || ind.output_good] || 0), I = val(t.inputs);
    const bt = basicTotals(ind, t, V);
    const Ib = I + val(bt.in), Ob = O + val(bt.out);
    const W = eraWage(t.era ?? 0) * wageUnits(basicEmployment(ind, t, V));
    const wp = Math.round(W / (Ib + W) * 10000) / 10000, be = Math.round((Ib + W) / Ob * 100);
    if (wp === +t.wage_pct && be === +t.target_be) continue;
    const row = { ind: ind.id, key: t.key, era: t.era, basic: bt.methods.filter(p => !/^pm_(no_|disabled_|automation_disabled|traditional_looms|manual_)/.test(p)),
      before: { target_be: t.target_be, wage_pct: t.wage_pct }, after: { target_be: be, wage_pct: wp } };
    if (mandatedFor(vanillaMainOfTier(ind, t))) { changed.push(row); t.target_be = be; t.wage_pct = wp; }
    else unexpected.push(row);
  }
}
console.log(`restate_basic_be: ${n} rung(s) of ${CFGP.replace(REPO + '\\', '').replace(REPO + '/', '')}`);
for (const r of changed) console.log(`  ${r.ind.padEnd(11)} e${r.era} ${r.key.padEnd(52)} target_be ${r.before.target_be} -> ${r.after.target_be}   wage_pct ${r.before.wage_pct} -> ${r.after.wage_pct}   (basic: ${r.basic.join(', ')})`);
if (unexpected.length) {
  console.log(`UNEXPECTED: ${unexpected.length} rung(s) WITHOUT a mandated automation moved — the formula does not reproduce the book's restatement; nothing written:`);
  for (const r of unexpected) console.log(`  ${r.ind} e${r.era} ${r.key}: target_be ${r.before.target_be} -> ${r.after.target_be}, wage_pct ${r.before.wage_pct} -> ${r.after.wage_pct}`);
  process.exit(1);
}
console.log(`  every other rung reproduces its stored target_be and wage_pct exactly (${n - changed.length} of ${n})`);
if (WRITE && changed.length) {
  cfg._basic_be = { ruled_by: 'BALANCE_FRAMEWORK §10.93 (user, 2026-10-03): target_be / wage_pct under the most basic secondary methods available',
    by: 'node tools/restate_basic_be.mjs --config <this book> --write (make_ab_config restates the same way since that day)',
    changed: changed.map(r => ({ key: r.key, ...r.after, before: r.before })) };
  writeFileSync(CFGP, JSON.stringify(cfg), 'utf8');
  console.log(`  --write: ${changed.length} rung(s) restated, recorded as _basic_be`);
} else if (WRITE) console.log('  --write: nothing to restate');
