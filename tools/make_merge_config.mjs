// THE MERGE BOOK — six add-on rungs become second main methods of the rung below (BALANCE_FRAMEWORK §10.91.2, user-ruled 2026-09-30;
// FINDINGS F180 §5; ROADMAP step 13).
//
//   node tools/make_merge_config.mjs --base config/mod_config.json --suffix merge6
//   node tools/make_merge_config.mjs --base config/mod_config.json --suffix merge6-probe --grant GBR,FRA --grant-industries food,paper
//     (a PROBE book: the named merged methods' technologies granted at the 1836 start; the suffix must contain "probe")
//
// Writes config/mod_config.<suffix>.json — the base with, for each merged pair, `method_of: <host key>` on the removed rung and the
// host's `building_cost` / `ai_value` set to the geometric midpoint of the two rungs' own — plus `_merge` (the record L31 checks) and
// `_merge_variant`, and the base's tech-tree twin (landmine L20). Every other key and rung is the base's.
//
// ⭐ THE PAIR TABLE LIVES HERE AND ONLY HERE. The builder reads `method_of` (emit no building; put the rung's method into the host's
// main group, gated by the rung's own technology); emit_secondaries mints the host's secondaries per METHOD; emit_research_events,
// emit_companies and L31 read `method_of` / `_merge`.
//
// THE RULINGS (§10.91.2): "the 6 options you say should be merged, removing higher tiers and recreating them as new PMs, unlockable by
// the same techs that now unlock tiers"; one constant cost per merged building with nothing that depends on the builder, "reasonable
// payback time at realised prices for both tierN PM in its era and tierN+1 PM in its era"; "midpoint first" (2026-09-30):
//   cost     = round(√(host cost × removed rung's cost))        = host × √1.9 on the canon's cost ladder
//   ai_value = round(√(host ai_value × removed rung's ai_value)) = 1,000 × 3^(e + 0.5)
// Recipes and staffing verbatim (the ruled default). Staffing totals already match within every pair (checked here).
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'config/mod_config.json');
const SFX = argOf('--suffix', null);
if (!SFX) { console.error('usage: node tools/make_merge_config.mjs --base <config> --suffix <suffix>'); process.exit(2); }
const die = m => { throw new Error('make_merge_config: ' + m); };

// industry -> [host era, added era]: the six single add-ons (period retrofits at 5–20% of a new plant, §10.91.2)
const PAIRS = {
  food: [1, 2],        // Sweeteners + Baking Powder
  textile: [2, 3],     // Sewing Machines + Electric Sewing Machines
  furniture: [2, 3],   // Mechanized Workshops + Spray Finishing
  paper: [1, 2],       // Sulfite Pulping + Paper Bleaching
  fertilizer: [0, 1],  // Artificial Fertilizers + Improved Fertilizers
  steel: [2, 3],       // Open Hearth + Electric Arc
};

const baseRaw = readFileSync(join(REPO, BASE), 'utf8');
const cfg = JSON.parse(baseRaw.replace(/^﻿/, ''));
if (cfg._merge) die(`the base ${BASE} already carries _merge`);
const sum = o => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);
const pairs = {};
const rows = [];
for (const [id, [he, ae]] of Object.entries(PAIRS)) {
  const ind = (cfg.industries || []).find(i => i.id === id);
  if (!ind || ind.disabled) die(`the base has no enabled industry ${id}`);
  const host = (ind.tiers || []).find(t => t.era === he), add = (ind.tiers || []).find(t => t.era === ae);
  if (!host || !add) die(`${id}: no e${he} host or no e${ae} rung in the base`);
  if (host.method_of || add.method_of) die(`${id}: a rung already carries method_of`);
  if (host.craft || add.craft) die(`${id}: a craft rung cannot host or be merged (build the merge book from a craft-free base)`);
  if (!add.tech) die(`${id} e${ae} (${add.key}) has no technology to gate its method`);
  if (sum(host.employment) * (host.workforce_mult ?? 1) !== sum(add.employment) * (add.workforce_mult ?? 1))
    die(`${id}: staffing totals differ (${sum(host.employment)} vs ${sum(add.employment)}) — a merged building would change size by method`);
  if (!(host.building_cost > 0 && add.building_cost > 0)) die(`${id}: a rung has no building_cost`);
  const cost = Math.round(Math.sqrt(host.building_cost * add.building_cost));
  const aiv = Math.round(Math.sqrt((host.ai_value ?? 1000) * (add.ai_value ?? 1000)));
  pairs[id] = { host: host.key, added: add.key, host_era: he, added_era: ae, tech: add.tech,
    host_cost_before: host.building_cost, added_cost: add.building_cost, cost,
    host_ai_before: host.ai_value ?? null, added_ai: add.ai_value ?? null, ai_value: aiv };
  rows.push({ id, host: host.key, add: add.key, tech: add.tech, c0: host.building_cost, c1: add.building_cost, cost, a0: host.ai_value, a1: add.ai_value, aiv });
  add.method_of = host.key;
  host.building_cost = cost;
  host.ai_value = aiv;
}

// ⚗ PROBE BUILDS ONLY: `--grant TAG,TAG --grant-industries food,paper` hands the named merged methods' technologies to those
//   countries at the 1836 start (config `start_tech_grants`), so a two-year probe can watch buildings that already exist switch
//   to the merged method. The suffix must say "probe", so a grant can never reach a book that is measured as a design.
let probeGrant = null;
if (argOf('--grant', null)) {
  if (!/probe/.test(SFX)) die(`--grant is for probe books only; the suffix '${SFX}' does not contain 'probe'`);
  const tags = argOf('--grant', '').split(',').filter(Boolean);
  const inds = argOf('--grant-industries', Object.keys(pairs).join(',')).split(',').filter(Boolean);
  for (const id of inds) if (!pairs[id]) die(`--grant-industries names ${id}, which is not merged`);
  const techs = inds.map(id => pairs[id].tech);
  if (cfg.start_tech_grants) die('the base already carries start_tech_grants — merge the two by hand is not supported');
  cfg.start_tech_grants = Object.fromEntries(tags.map(t => [t, techs]));
  probeGrant = { tags, industries: inds, techs };
}

cfg._merge = {
  rule: 'geometric midpoint of the two rungs\' cost and ai_value (user: "midpoint first", 2026-09-30); recipes and staffing verbatim',
  pairs,
  ...(probeGrant ? { probe_grant: probeGrant } : {}),
  base: basename(BASE),
  base_sha256: createHash('sha256').update(baseRaw).digest('hex').slice(0, 16),
  ruled_by: 'BALANCE_FRAMEWORK §10.91.2 (user, 2026-09-30); FINDINGS F180 §5',
  command: `node tools/make_merge_config.mjs ${args.join(' ')}`,
};
cfg._merge_variant = { name: SFX, base: basename(BASE), delta: 'six add-on rungs -> second main methods of the rung below (method_of), host cost and ai_value at the geometric midpoint; every other key and rung the base\'s' };
writeFileSync(join(REPO, 'config', `mod_config.${SFX}.json`), JSON.stringify(cfg), 'utf8');
const bn = basename(BASE);
const twin = bn === 'mod_config.json' ? 'tech_tree_options.json' : bn.replace(/^mod_config\./, 'tech_tree_options.');
if (!existsSync(join(REPO, 'config', twin))) die(`the base's tech-tree twin ${twin} does not exist`);
copyFileSync(join(REPO, 'config', twin), join(REPO, 'config', `tech_tree_options.${SFX}.json`));

console.log(`wrote config/mod_config.${SFX}.json (+ config/tech_tree_options.${SFX}.json from ${twin})`);
console.log('  industry    host (building kept)                                  + method of                                    tech                    cost          ai_value');
for (const r of rows) console.log(`  ${r.id.padEnd(11)} ${r.host.padEnd(52)} ${r.add.padEnd(46)} ${r.tech.padEnd(22)} ${r.c0}|${r.c1} -> ${r.cost}   ${r.a0}|${r.a1} -> ${r.aiv}`);
