// THE DAM UPKEEP BOOK — sets a dam's upkeep per 50 electricity, `dams.inputs_per_50` (lib_dams.mjs DAM_DEFAULTS: 1 tools + 1 engines).
//
//   node tools/make_dam_inputs_config.mjs --base config/mod_config.<book>.json --suffix <suffix> --inputs tools:1,engines:0.5,copper:0.75
//
// Writes config/mod_config.<suffix>.json — the base with `dams.inputs_per_50` set, plus `_dam_inputs_variant` carrying the exact command,
// and the base's tree twin (landmine L20). Every other key is the base's. Prints the upkeep's value at base prices (tools/goods_prices.tsv)
// before and after, a 300- and a 600-electricity level's goods, and throws on a good with no price.
//
// The ruling it was written for: BALANCE_FRAMEWORK §10.108 (user, 2026-11-07, game 1.15's copper): "dams have copper proportionally" —
// per 50 electricity 1 tools + 0.5 engines + 0.75 copper, the copper taken out of the engines value for value (£100 either way).
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', null), SFX = argOf('--suffix', null), IN = argOf('--inputs', null);
if (!BASE || !SFX || !IN) { console.error('usage: node tools/make_dam_inputs_config.mjs --base <config> --suffix <suffix> --inputs good:q[,good:q]'); process.exit(2); }
const die = m => { throw new Error('make_dam_inputs_config: ' + m); };
const cfg = JSON.parse(readFileSync(join(REPO, BASE), 'utf8'));
if (!cfg.dams || !cfg.dams.enabled) die(`${BASE} has no dams`);
if (cfg._dam_inputs_variant) die(`${BASE} already carries _dam_inputs_variant`);
const PRICE = {};
for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) { const c = l.split('\t'); if (!l.startsWith('#') && c[1]) PRICE[c[0].trim()] = +c[1]; }
const inputs = {};
for (const s of IN.split(',')) {
  const [g, q] = s.split(':'); if (!g || !(+q > 0)) die(`--inputs ${s}: want good:quantity`);
  if (PRICE[g] == null) die(`--inputs ${g}: no base price in tools/goods_prices.tsv`);
  inputs[g] = +q;
}
const before = cfg.dams.inputs_per_50 || { tools: 1, engines: 1 };
const val = o => Object.entries(o).reduce((s, [g, q]) => s + q * PRICE[g], 0);
cfg.dams.inputs_per_50 = inputs;
cfg._dam_inputs_variant = { name: SFX, base: basename(BASE), command: `node tools/make_dam_inputs_config.mjs ${args.join(' ')}`,
  delta: `dams.inputs_per_50 ${JSON.stringify(before)} -> ${JSON.stringify(inputs)}`, generated: new Date().toISOString() };
writeFileSync(join(REPO, 'config', `mod_config.${SFX}.json`), JSON.stringify(cfg), 'utf8');
const twin = basename(BASE).replace(/^mod_config\./, 'tech_tree_options.');
if (!existsSync(join(REPO, 'config', twin))) die(`no tree twin ${twin} beside ${BASE} (landmine L20)`);
copyFileSync(join(REPO, 'config', twin), join(REPO, 'config', `tech_tree_options.${SFX}.json`));
const per = (o, k) => Object.entries(o).map(([g, q]) => `${g} ${Math.round(q * k * 10) / 10}`).join(' + ');
console.log(`  per 50 electricity: ${per(before, 1)} (£${val(before)}) -> ${per(inputs, 1)} (£${val(inputs)})`);
console.log(`  a 300-electricity level: ${per(inputs, 6)}; a 600 one: ${per(inputs, 12)}`);
console.log(`wrote config/mod_config.${SFX}.json + tech_tree_options.${SFX}.json (base ${BASE})`);
