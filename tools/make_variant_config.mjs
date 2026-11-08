// THE VARIANT BOOK — a vanilla main method that is the same step as another in a different material becomes a switchable second main
// method of that method's rung (BALANCE_FRAMEWORK §10.108.2, user-ruled 2026-11-07; game 1.15's bronze artillery).
//
//   node tools/make_variant_config.mjs --base config/mod_config.<book>.json --suffix <suffix>
//
// Writes config/mod_config.<suffix>.json — the base plus, for every VARIANTS entry (tools/lib_tier4_spec.mjs) whose method the installed
// game has, one rung entry `method_of: <host key>, variant: true` right after its host — plus `_method_variants` (the record L31 checks) and
// `_method_variants_variant`, and the base's tech-tree twin (landmine L20). Every other key and rung is the base's.
//
// THE RULE (§10.108.2): "a switchable second main method on the t0 and t1 rungs, at the same input value". The variant takes its host's
// tier, output, building_cost, ai_value, wage_pct and target_be; its input VALUE is the host's at base prices, spread over its own vanilla
// method's input mix by value (rounded to 0.1, as make_ab_config.mjs rounds); its staffing, pollution, icon and gate are its own vanilla
// method's. The builder puts its method into the host's main group gated by its technology (build.ps1, `method_of`), exactly as a merged
// rung's; unlike a merged rung it sits at its host's own tier, so the host keeps its own cost and desire and its name reads one tier.
// A variant missing from the installed game (game 1.13) is skipped and printed; a host missing from the base throws.
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VARIANTS, slug } from './lib_tier4_spec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', null), SFX = argOf('--suffix', null);
if (!BASE || !SFX) { console.error('usage: node tools/make_variant_config.mjs --base <config> --suffix <suffix>'); process.exit(2); }
const die = m => { throw new Error('make_variant_config: ' + m); };
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

const cfg = JSON.parse(readFileSync(join(REPO, BASE), 'utf8'));
if (cfg._method_variants) die(`${BASE} already carries _method_variants`);
const PRICE = {};
for (const l of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) { const c = l.split('\t'); if (!l.startsWith('#') && c[1]) PRICE[c[0].trim()] = +c[1]; }

// vanilla's main methods, top-level blocks of common/production_methods
const PM = {};
for (const f of readdirSync(join(GAME, 'common/production_methods')).filter(f => f.endsWith('.txt'))) {
  const t = readFileSync(join(GAME, 'common/production_methods', f), 'utf8').replace(/^\uFEFF/, '').replace(/#[^\n]*/g, '');
  for (const m of t.matchAll(/^([A-Za-z0-9_\-]+)\s*=\s*\{/gm)) {
    let d = 0, i = t.indexOf('{', m.index), j = i;
    for (; j < t.length; j++) { if (t[j] === '{') d++; else if (t[j] === '}' && --d === 0) break; }
    PM[m[1]] = t.slice(i, j + 1);
  }
}
const goodsIn = b => Object.fromEntries([...b.matchAll(/goods_input_([a-z_]+)_add\s*=\s*([0-9.]+)/g)].map(m => [m[1], +m[2]]));
const employment = b => Object.fromEntries([...b.matchAll(/building_employment_([a-z_]+)_add\s*=\s*([0-9]+)/g)].map(m => [m[1], +m[2]]));
const pollution = b => { const m = b.match(/state_pollution_generation_add\s*=\s*([0-9.]+)/); return m ? +m[1] : 0; };
const gate = b => { const m = b.match(/unlocking_technologies\s*=\s*\{\s*([a-z_0-9]+)/); return m ? m[1] : null; };
const texture = b => { const m = b.match(/texture\s*=\s*"([^"]+)"/); return m ? m[1] : null; };
const ENLOC = {};
for (const f of readdirSync(join(GAME, 'localization/english'), { recursive: true }).filter(f => String(f).endsWith('.yml')))
  for (const m of readFileSync(join(GAME, 'localization/english', String(f)), 'utf8').matchAll(/^\s*(pm_[a-z_0-9\-]+):\d*\s*"([^"]*)"/gm)) ENLOC[m[1]] ??= m[2];
const val = inputs => Object.entries(inputs).reduce((s, [g, q]) => s + q * (PRICE[g] ?? die(`no price for ${g} (tools/goods_prices.tsv)`)), 0);
const r1 = x => Math.round(x * 10) / 10;

const record = {};
const lines = [];
for (const [id, table] of Object.entries(VARIANTS)) {
  const ind = cfg.industries.find(x => x.id === id) || die(`${BASE} has no industry ${id}`);
  if (ind.disabled) { lines.push(`${id}: disabled in the base — no variants`); continue; }
  for (const [vpm, hostPm] of Object.entries(table)) {
    const body = PM[vpm];
    if (!body) { lines.push(`${id}: ${vpm} is not in the installed game (${GAME}) — skipped`); continue; }
    const host = ind.tiers.find(t => t.vanilla_pm === hostPm) || die(`${id}: no rung of ${BASE} runs ${hostPm} (the host of ${vpm})`);
    if (host.method_of || host.craft) die(`${id}: ${host.key} is ${host.craft ? 'a craft rung' : 'itself a method of another rung'} — a variant needs a building of its own`);
    const vin = goodsIn(body), vval = val(vin);
    if (!(vval > 0)) die(`${id}: ${vpm} has no priced inputs`);
    const V = val(host.inputs);
    const inputs = Object.fromEntries(Object.entries(vin).map(([g, q]) => [g, r1(V * (q * PRICE[g] / vval) / PRICE[g])]));
    const pmName = ENLOC[vpm] || die(`no English name for ${vpm}`);
    const baseName = host.name.replace(/\s*\([^()]*\)\s*$/, '').trim();
    const t = {
      ...host,
      key: `${host.key}_${slug(vpm)}`, name: `${baseName} (${pmName})`,
      pm_key: `pm_main_${id}_${slug(vpm)}`, pmg_key: `pmg_main_${id}_${slug(vpm)}`, pm_name: pmName, vanilla_pm: vpm,
      tech: gate(body) || host.tech, inputs, employment: employment(body), pollution: pollution(body), texture: texture(body) || host.texture,
      method_of: host.key, variant: true,
    };
    delete t.ai_value_cond;
    const at = ind.tiers.indexOf(host);
    if (ind.tiers.some(x => x.key === t.key)) die(`${id}: ${t.key} already in the base`);
    ind.tiers.splice(at + 1, 0, t);
    (record[id] ??= []).push({ key: t.key, host: host.key, vanilla_pm: vpm, host_pm: hostPm, era: host.era, tech: t.tech, value: Math.round(val(inputs)), host_value: Math.round(V), inputs });
    lines.push(`${id}: ${t.key} (${pmName}) on ${host.key} e${host.era} — ${Object.entries(inputs).map(([g, q]) => `${g} ${q}`).join(' + ')} = £${Math.round(val(inputs))} against the host's £${Math.round(V)} (${Object.entries(host.inputs).map(([g, q]) => `${g} ${q}`).join(' + ')}); output ${t.output_qty}; ${t.tech}`);
  }
}
if (!Object.keys(record).length) die(`no variant of VARIANTS is in the installed game — nothing to add (${lines.join('; ')})`);
cfg._method_variants = {
  rule: 'BALANCE_FRAMEWORK §10.108.2 (user, 2026-11-07): a switchable second main method of its rung at the rung\'s own tier, output and input value; its input mix, staffing, pollution, icon and gate its own vanilla method\'s; cost, ai_value, wage_pct and target_be the host\'s',
  variants: record,
};
cfg._method_variants_variant = { name: SFX, base: basename(BASE), command: `node tools/make_variant_config.mjs ${args.join(' ')}`,
  delta: 'vanilla main-method variants (tools/lib_tier4_spec.mjs VARIANTS) -> second main methods of their rungs (method_of, variant)', generated: new Date().toISOString() };
writeFileSync(join(REPO, 'config', `mod_config.${SFX}.json`), JSON.stringify(cfg), 'utf8');
const twin = basename(BASE).replace(/^mod_config\./, 'tech_tree_options.');
if (!existsSync(join(REPO, 'config', twin))) die(`no tree twin ${twin} beside ${BASE} (landmine L20)`);
copyFileSync(join(REPO, 'config', twin), join(REPO, 'config', `tech_tree_options.${SFX}.json`));
for (const l of lines) console.log('  ' + l);
console.log(`wrote config/mod_config.${SFX}.json + tech_tree_options.${SFX}.json (base ${BASE})`);
