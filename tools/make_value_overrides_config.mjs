// THE VALUE-OVERRIDE BOOK — appends a ruled SET of entries to `vanilla_value_overrides` (emitted by tools/emit_value_overrides.mjs).
//
//   node tools/make_value_overrides_config.mjs --base config/mod_config.<book>.json --suffix <suffix> --set <name>
//
// Writes config/mod_config.<suffix>.json — the base with the named set's entries appended to `vanilla_value_overrides`, plus
// `_value_overrides_variant` carrying the exact command, and the base's tree twin (landmine L20). Every other key is the base's.
// Throws on an unknown set, and on an entry whose file + block + key the base already overrides (a set is added once, never twice).
// The vanilla value each entry names is asserted at BUILD time by emit_value_overrides.mjs, against the game being built for — a patch
// that moves it stops the build there.
//
// The sets, each a user ruling:
//   g115-research-adds — BALANCE_FRAMEWORK §10.109.1 (user, 2026-11-08, GAME_UPDATE_1_15.md Q6): game 1.15's two new flat innovation adds
//     ×1/3, as POLISH_1_0.md Q1 ruled for the four of game 1.13 — the Russo-Baltic Wagon Factory company's cap (+15 → +5, IP5) and the
//     social revolution modifier's cap (+25 → +8.33, je_social_revolution).
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const WHY_Q6 = 'x1/3, GAME_UPDATE_1_15.md Q6 (user-ruled 2026-11-08): flat research adds sized for vanilla research, scaled to the mod\'s';
const SETS = {
  'g115-research-adds': {
    ruling: 'BALANCE_FRAMEWORK §10.109.1 (user, 2026-11-08, GAME_UPDATE_1_15.md Q6)',
    entries: [
      { file: 'common/company_types/00_companies_ip5.txt', block: 'company_russo-baltic_wagon_factory',
        key: 'country_weekly_innovation_max_add', vanilla: 15, value: 5, why: WHY_Q6 },
      { file: 'common/static_modifiers/content_1_modifiers.txt', block: 'modifier_social_revolution',
        key: 'country_weekly_innovation_max_add', vanilla: 25, value: 8.33, why: WHY_Q6 },
    ],
  },
};

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', null), SFX = argOf('--suffix', null), SET = argOf('--set', null);
if (!BASE || !SFX || !SET) { console.error(`usage: node tools/make_value_overrides_config.mjs --base <config> --suffix <suffix> --set <${Object.keys(SETS).join('|')}>`); process.exit(2); }
const die = m => { throw new Error('make_value_overrides_config: ' + m); };
const set = SETS[SET]; if (!set) die(`no set '${SET}' (known: ${Object.keys(SETS).join(', ')})`);
const cfg = JSON.parse(readFileSync(join(REPO, BASE), 'utf8'));
const list = Array.isArray(cfg.vanilla_value_overrides) ? cfg.vanilla_value_overrides : [];
const id = e => `${e.file}|${e.block}|${e.key}`;
const have = new Set(list.map(id));
for (const e of set.entries) if (have.has(id(e))) die(`${BASE} already overrides ${e.block}.${e.key} (${e.file})`);
cfg.vanilla_value_overrides = [...list, ...set.entries];
const prev = cfg._value_overrides_variant;
cfg._value_overrides_variant = { name: SFX, base: basename(BASE), set: SET, ruling: set.ruling,
  command: `node tools/make_value_overrides_config.mjs ${args.join(' ')}`,
  added: set.entries.map(e => `${e.block}.${e.key} ${e.vanilla} -> ${e.value}`), generated: new Date().toISOString(),
  ...(prev ? { previous: prev } : {}) };
writeFileSync(join(REPO, 'config', `mod_config.${SFX}.json`), JSON.stringify(cfg), 'utf8');
const twin = basename(BASE).replace(/^mod_config\./, 'tech_tree_options.');
if (!existsSync(join(REPO, 'config', twin))) die(`no tree twin ${twin} beside ${BASE} (landmine L20)`);
copyFileSync(join(REPO, 'config', twin), join(REPO, 'config', `tech_tree_options.${SFX}.json`));
for (const e of set.entries) console.log(`  + ${e.file.split('/').pop()}: ${e.block}.${e.key} ${e.vanilla} -> ${e.value}`);
console.log(`  vanilla_value_overrides: ${list.length} -> ${cfg.vanilla_value_overrides.length} entries`);
console.log(`wrote config/mod_config.${SFX}.json + tech_tree_options.${SFX}.json (base ${BASE})`);
