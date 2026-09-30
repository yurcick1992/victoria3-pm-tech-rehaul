// THE ARTISANSHIP CRAFT BOOK — a base config with its six light-industry e0 rungs turned into craft rungs (BALANCE_FRAMEWORK
// §10.91.1, user-ruled 2026-09-30; FINDINGS F180; ROADMAP step 12).
//
//   node tools/make_artisan_config.mjs --base config/mod_config.json --suffix artisan6 [--staffing ruled|shop] [--hire-floor X|none]
//
// Writes config/mod_config.<suffix>.json — the base, byte-for-byte in every other key and rung, with the six e0 rungs replaced and
// `building_groups_add`, `_artisan`, `_artisan_variant` added — and its tech-tree twin (landmine L20), copied from the base's own.
// A post-processor, like make_trade_config / make_dam_config, so e1–e3 of the six industries are the base's by construction (the
// ruling requires them byte-identical to the canon) and every other key survives untouched.
//
// ⭐ THE CRAFT TABLE LIVES HERE AND ONLY HERE. build.ps1, emit_secondaries, emit_companies, emit_craft_start and L31 read what the
// config says (`craft`, `workforce_mult`, `building_group`, `exclude_secondary_pmgs`, `exclude_secondary_pms`, `levels_per_mesh`,
// `_artisan`), never this table.
//
// WHAT A CRAFT RUNG IS (the rulings, §10.91.1):
//   • a 500-worker level: a 5,000-head staffing block × `workforce_mult` 0.1 (the graded-port path) — every product an integer;
//   • the cloud session's tuned recipe per level (below), NO ×1.2 input lift (e1–e3 keep theirs);
//   • construction cost = the base e0's ÷ 50 (600 → 12, 316 → 6) — kept by ruling: "Faster payback is narratively deliberate";
//   • the child building group `bg_pmr_crafts` (parent bg_light_industry): no economy of scale, urbanization 2, infrastructure ×1/10;
//   • automation stripped, plus Vacuum Canning (both variants) and Patent Stills; the kept secondaries' employment × 0.1;
//   • companies can neither build nor form off it (`craft: true`, read by emit_companies);
//   • ai_value untouched ("Don't touch for now");
//   • map meshes per level × 10 (levels_per_mesh 500), so the ×10 levels do not multiply the models on the map.
//
// --staffing ruled (default): the cloud session's skilled mix — shopkeepers (masters) / machinists (journeymen) / laborers.
//   ⭐ The variant in use (user-ruled 2026-09-30 evening: "The one with the machinists").
// --staffing shop: masters as shopkeepers + laborers at the SAME wage units (±0.1%), for the probe that asks whether machinists'
//   literacy gate (qualification = (literacy − 0.1) × 20) throttles the crafts where they stand (F180 §2; ruled 2026-09-30:
//   "probe both"). DROPPED by the same evening's ruling; the flag stays so its book can be regenerated as a record.
// --hire-floor X: the craft group's own hiring floor, `min_productivity_to_hire = X` on bg_pmr_crafts — the per-group override of
//   the engine's `BUILDING_DEFAULT_MIN_EARNINGS_TO_HIRE_EMPLOYEES` (3: "non-subsidized buildings will not hire if it would result
//   in their annual earnings/employee falling below this threshold"; vanilla sets 10 on its owner buildings). FINDINGS F185 §3/§5:
//   the craft recipes clear £3 only at output prices of 100–124% of base, so the floor blocks hiring where local prices sit low.
//   ⭐ DEFAULT 0.01 — RULED 2026-09-30 late evening (BALANCE_FRAMEWORK §10.91.3, on FINDINGS F188): *"This threshold reduction is now a
//   firm part of the 'artisans + merges' arm"*. A craft book without the floor is no longer the arm.
//   --hire-floor none = the engine's default (3) — only to regenerate the pre-ruling records (artisan6, artisan6-shop, and artmerge6 on
//   top of artisan6), whose recorded commands predate the default and carry no --hire-floor. Every command this tool records now spells
//   the floor out, so a book's own command reproduces it whatever the default becomes.
//   ⚠ For "no floor" use a small positive number (0.01), not 0: for some group fields the engine reads 0 as "unset, take the parent's /
//   the default" (the documentation says so for cash_reserves_max), and a 0 read that way would silently restore the £3 floor.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { tierEmployment, wageUnits, eraReferenceWage } from './lib_wage_model.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'config/mod_config.json');
const SFX = argOf('--suffix', null);
const STAFFING = argOf('--staffing', 'ruled');
const HIRE_FLOOR_ARG = argOf('--hire-floor', '0.01');   // the ruled floor (§10.91.3); 'none' = the engine's default
if (!SFX) { console.error('usage: node tools/make_artisan_config.mjs --base <config> --suffix <suffix> [--staffing ruled|shop] [--hire-floor X|none]'); process.exit(2); }
const die = m => { throw new Error('make_artisan_config: ' + m); };
if (!['ruled', 'shop', 'pb'].includes(STAFFING)) die(`--staffing must be ruled, shop or pb (got ${STAFFING})`);
const HIRE_FLOOR = HIRE_FLOOR_ARG === 'none' ? null : Number(HIRE_FLOOR_ARG);
if (HIRE_FLOOR != null && !(Number.isFinite(HIRE_FLOOR) && HIRE_FLOOR > 0))
  die(`--hire-floor must be a positive number or none (got ${HIRE_FLOOR_ARG}); for "no floor" pass a small one such as 0.01 — 0 may read as unset`);

const WM = 0.1;          // a craft level is a tenth of a 5,000-head level
const COST_DIV = 50;     // construction cost = the base e0's ÷ 50
const GROUP = 'bg_pmr_crafts';
// per industry: the per-LEVEL recipe (500 heads), the two 5,000-head staffing blocks, and what the craft rung does not carry
// --staffing pb (user-ruled 2026-10-01, BALANCE_FRAMEWORK §10.91.4): EVERY craft staffed 30% shopkeepers / 70% laborers (no machinists —
// "I want the Petite Bourgeoisie interest group to represent those new artisans"; FINDINGS F190: the machinist mix did not lift it), with
// each craft's OUTPUT × its `pb_out` so the craft can pay about 0.6 of its country's normal wage at 20% profit on revenue at the realised
// 1838–1846 prices of F188's runs (the canon e0's wage level; F190 §3). Textile and furniture need none. Inputs, cost, everything else
// unchanged.
const PB_STAFF = { shopkeepers: 1500, laborers: 3500 };
const CRAFTS = {
  food: {
    pb_out: 1.10, out: 3.37, in: { grain: 3.6 },
    ruled: { shopkeepers: 900, machinists: 1500, laborers: 2600 }, shop: { shopkeepers: 1270, laborers: 3730 },
    exclude_pmgs: ['pmg_automation_building_food_industry'],
    exclude_pms: ['pm_vacuum_canning', 'pm_vacuum_canning_principle_3', 'pm_patent_stills'],
  },
  textile: {
    pb_out: 1.00, out: 1.95, in: { fabric: 1.95 },
    ruled: { shopkeepers: 650, machinists: 2100, laborers: 2250 }, shop: { shopkeepers: 1180, laborers: 3820 },
    exclude_pmgs: ['pmg_automation_building_textile_mill'], exclude_pms: [],
  },
  furniture: {
    pb_out: 1.00, out: 2.0, in: { wood: 1.38, fabric: 0.46 },
    ruled: { shopkeepers: 900, machinists: 2500, laborers: 1600 }, shop: { shopkeepers: 1520, laborers: 3480 },
    exclude_pmgs: ['pmg_automation_building_furniture_manufactory'], exclude_pms: [],
  },
  glass: {
    pb_out: 1.30, out: 1.32, in: { wood: 1.59 },
    ruled: { shopkeepers: 500, machinists: 2500, laborers: 2000 }, shop: { shopkeepers: 1120, laborers: 3880 },
    exclude_pmgs: ['pmg_glassblowing'], exclude_pms: [],
  },
  tooling: {
    pb_out: 1.20, out: 1.59, in: { wood: 2.23 },
    ruled: { shopkeepers: 750, machinists: 2250, laborers: 2000 }, shop: { shopkeepers: 1310, laborers: 3690 },
    exclude_pmgs: ['pmg_automation_building_tooling_workshop'], exclude_pms: [],
  },
  paper: {
    pb_out: 1.20, out: 2.43, in: { wood: 3.06 },
    ruled: { shopkeepers: 500, machinists: 2000, laborers: 2500 }, shop: { shopkeepers: 1000, laborers: 4000 },
    exclude_pmgs: ['pmg_automation_building_paper_mill'], exclude_pms: [],
  },
};

const basePath = join(REPO, BASE);
if (!existsSync(basePath)) die(`base ${BASE} not found`);
const baseRaw = readFileSync(basePath, 'utf8');
const cfg = JSON.parse(baseRaw.replace(/^﻿/, ''));
if (cfg._artisan) die(`the base ${BASE} already carries _artisan — build from a book without crafts`);
if (!Array.isArray(cfg.era_anchor_years)) die('the base carries no era_anchor_years (not a four-rung book)');
const eraWage = eraReferenceWage(cfg.era_anchor_years);
const W0 = eraWage(0);
const PRICE = {};
for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) { const c = l.trim().split(/\t|\s+/); if (c.length >= 2 && +c[1] > 0) PRICE[c[0]] = +c[1]; }
const val = o => Object.entries(o).reduce((s, [g, q]) => { if (!(PRICE[g] > 0)) die(`no base price for ${g}`); return s + q * PRICE[g]; }, 0);

const recipes = {};
const rows = [];
for (const [id, c] of Object.entries(CRAFTS)) {
  const ind = (cfg.industries || []).find(i => i.id === id);
  if (!ind) die(`the base has no industry ${id}`);
  if (ind.disabled) die(`${id} is disabled in the base`);
  const t = (ind.tiers || []).find(x => x.era === 0);
  if (!t) die(`${id} has no e0 rung in the base`);
  // the rung must be the vanilla-keyed e0 the ruling is about: vanilla staffing, vanilla key, not already a craft
  if (t.craft || t.workforce_mult != null) die(`${id} e0 (${t.key}) already carries craft/workforce_mult`);
  const emp = t.employment || {};
  if (emp.shopkeepers !== 500 || emp.laborers !== 4500 || Object.keys(emp).length !== 2) die(`${id} e0 (${t.key}) staffing is not vanilla's 500/4500 — is this a canon-shaped book?`);
  for (const g of c.exclude_pmgs) if (!(ind.secondary_pmgs || []).includes(g)) die(`${id}: excluded group ${g} is not one of the industry's secondary groups`);
  const block = STAFFING === 'pb' ? PB_STAFF : c[STAFFING];
  const heads = Object.values(block).reduce((a, b) => a + b, 0);
  if (heads !== 5000) die(`${id} ${STAFFING} staffing sums to ${heads}, not 5,000`);
  for (const [p, n] of Object.entries(block)) if (Math.round(n * WM) !== n * WM) die(`${id}: ${p} ${n} × ${WM} is not an integer (build.ps1 would throw)`);
  const baseCost = t.building_cost;
  if (!(baseCost > 0)) die(`${id} e0 has no building_cost in the base`);

  t.craft = true;
  t.output_qty = STAFFING === 'pb' ? Math.round(c.out * c.pb_out * 100) / 100 : c.out;
  t.inputs = { ...c.in };
  t.employment = { ...block };
  t.workforce_mult = WM;
  t.building_cost = Math.round(baseCost / COST_DIV);
  t.building_group = GROUP;
  t.levels_per_mesh = 500;
  t.exclude_secondary_pmgs = [...c.exclude_pmgs];
  if (c.exclude_pms.length) t.exclude_secondary_pms = [...c.exclude_pms];
  // the base-price break-even, restated exactly as make_ab_config does it: W = the e0 reference wage × the rung's wage units
  const O = t.output_qty * PRICE[t.output_good || ind.output_good], I = val(t.inputs);
  const W = W0 * wageUnits(tierEmployment(t, ind, {}));
  t.wage_pct = Math.round(W / (I + W) * 10000) / 10000;
  t.target_be = Math.round((I + W) / O * 100);
  recipes[id] = { key: t.key, output_qty: t.output_qty, inputs: t.inputs, employment: t.employment, workforce_mult: WM, building_cost: t.building_cost, base_cost: baseCost };
  rows.push({ id, key: t.key, out: t.output_qty, O, I, W, be: t.target_be, labour: W / (I + W), cost: t.building_cost, profit: O - I - W });
}

cfg.building_groups_add = {
  [GROUP]: {
    name: 'Crafts',
    parent_group: 'bg_light_industry',
    lens: 'light_industry',
    urbanization: 2,
    infrastructure_usage_per_level: 0.15,
    economy_of_scale: 'no',
    construction_efficiency_modifier: 'yes',
    ...(HIRE_FLOOR != null ? { min_productivity_to_hire: HIRE_FLOOR } : {}),
  },
};
const sha = createHash('sha256').update(baseRaw).digest('hex').slice(0, 16);
cfg._artisan = {
  staffing: STAFFING,
  workforce_mult: WM,
  cost_div: COST_DIV,
  group: GROUP,
  e0_reference_wage: +W0.toFixed(6),
  base: basename(BASE),
  base_sha256: sha,
  recipes,
  hire_floor: HIRE_FLOOR,
  ruled_by: STAFFING === 'pb' ? 'BALANCE_FRAMEWORK §10.91.1 + §10.91.4 (user, 2026-10-01: "30% it is"); FINDINGS F180, F190' : 'BALANCE_FRAMEWORK §10.91.1 (user, 2026-09-30); FINDINGS F180',
  command: `node tools/make_artisan_config.mjs --base ${BASE} --suffix ${SFX} --staffing ${STAFFING}` + ` --hire-floor ${HIRE_FLOOR ?? 'none'}`,
};
cfg._artisan_variant = {
  name: SFX,
  base: basename(BASE),
  delta: `six light-industry e0 rungs -> 500-worker craft rungs (${STAFFING} staffing), cost /${COST_DIV}, group ${GROUP}` +
    (HIRE_FLOOR != null ? `, the group's hiring floor min_productivity_to_hire ${HIRE_FLOOR} (engine default 3)` : '') + `; every other key and rung the base's`,
};
const outCfg = join(REPO, 'config', `mod_config.${SFX}.json`);
writeFileSync(outCfg, JSON.stringify(cfg), 'utf8');

const baseName = basename(BASE);
const baseTwin = baseName === 'mod_config.json' ? 'tech_tree_options.json' : baseName.replace(/^mod_config\./, 'tech_tree_options.');
const twinSrc = join(REPO, 'config', baseTwin);
if (!existsSync(twinSrc)) die(`the base's tech-tree twin ${baseTwin} does not exist`);
copyFileSync(twinSrc, join(REPO, 'config', `tech_tree_options.${SFX}.json`));

console.log(`wrote config/mod_config.${SFX}.json (+ config/tech_tree_options.${SFX}.json from ${baseTwin}) — ${STAFFING} staffing, e0 reference wage £${W0.toFixed(5)}/wage unit/wk`);
console.log('  industry   key                              out/lv   O £     I £     W £    base-price BE  labour  profit £/lv  cost');
for (const r of rows) console.log(`  ${r.id.padEnd(10)} ${r.key.padEnd(32)} ${String(r.out).padStart(5)} ${r.O.toFixed(1).padStart(7)} ${r.I.toFixed(1).padStart(7)} ${r.W.toFixed(1).padStart(6)}   ${String(r.be).padStart(5)}%      ${(100 * r.labour).toFixed(0).padStart(3)}%  ${r.profit.toFixed(1).padStart(8)}   ${String(r.cost).padStart(4)}`);
