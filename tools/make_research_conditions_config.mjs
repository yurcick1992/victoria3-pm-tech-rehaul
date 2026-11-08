// THE RESEARCH-CONDITIONS BOOK — applies a ruled SET of exact text edits to the research entries' condition strings
// (`research_events.condition_entries.<tech>.label` / `.trigger`, `research_events.monthly_global_effect`), emitted by emit_research_events.mjs.
//
//   node tools/make_research_conditions_config.mjs --base config/mod_config.<book>.json --suffix <suffix> --set <name>
//
// Writes config/mod_config.<suffix>.json — the base with the set's edits applied, plus `_research_conditions_variant` carrying the exact
// command, and the base's tree twin (landmine L20). Every other key is the base's. Each edit names a path and replaces `from` with `to`;
// `from` must occur EXACTLY ONCE in the string at that path, or the maker throws (a base that moved, or a set applied twice). The names an
// edit introduces are checked against the game at build time (lint_vanilla_names.mjs), so a set written for one game version fails on another.
//
// The sets, each a user ruling:
//   g115-idea-laws — BALANCE_FRAMEWORK §10.109.3 (user, 2026-11-08, GAME_UPDATE_1_15.md Q9): the contagious-ideas entries (§10.98) follow
//     game 1.15's laws — Socialism counts factory councils as a law OR as the IP5 amendment (vanilla's has_factory_councils_law_or_amendment);
//     Political Agitation also counts law_extraordinary_commission, which the same technology unlocks.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SETS = {
  'g115-idea-laws': {
    ruling: 'BALANCE_FRAMEWORK §10.109.3 (user, 2026-11-08, GAME_UPDATE_1_15.md Q9)',
    edits: [
      { path: ['research_events', 'condition_entries', 'socialism', 'label'],
        from: '$law_factory_councils$ or', to: '$law_factory_councils$ (as a law or an amendment) or' },
      { path: ['research_events', 'monthly_global_effect'],
        from: 'has_law = law_type:law_factory_councils', to: 'has_factory_councils_law_or_amendment = yes' },
      { path: ['research_events', 'condition_entries', 'political_agitation', 'label'],
        from: 'lives under $law_single_party_state$ or $law_outlawed_dissent$',
        to: 'lives under $law_single_party_state$, $law_outlawed_dissent$ or $law_extraordinary_commission$' },
      { path: ['research_events', 'monthly_global_effect'],
        from: 'has_law = law_type:law_outlawed_dissent }',
        to: 'has_law = law_type:law_outlawed_dissent  has_law = law_type:law_extraordinary_commission }' },
    ],
  },
};

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', null), SFX = argOf('--suffix', null), SET = argOf('--set', null);
if (!BASE || !SFX || !SET) { console.error(`usage: node tools/make_research_conditions_config.mjs --base <config> --suffix <suffix> --set <${Object.keys(SETS).join('|')}>`); process.exit(2); }
const die = m => { throw new Error('make_research_conditions_config: ' + m); };
const set = SETS[SET]; if (!set) die(`no set '${SET}' (known: ${Object.keys(SETS).join(', ')})`);
const cfg = JSON.parse(readFileSync(join(REPO, BASE), 'utf8'));
const done = [];
for (const e of set.edits) {
  const parent = e.path.slice(0, -1).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), cfg);
  const leaf = e.path[e.path.length - 1];
  if (!parent || typeof parent[leaf] !== 'string') die(`${e.path.join('.')}: not a string in ${BASE}`);
  const n = parent[leaf].split(e.from).length - 1;
  if (n !== 1) die(`${e.path.join('.')}: "${e.from}" occurs ${n} times (need exactly 1 - the base moved, or the set is applied twice)`);
  parent[leaf] = parent[leaf].replace(e.from, e.to);
  done.push(`${e.path.slice(1).join('.')}: "${e.from}" -> "${e.to}"`);
}
const prev = cfg._research_conditions_variant;
cfg._research_conditions_variant = { name: SFX, base: basename(BASE), set: SET, ruling: set.ruling,
  command: `node tools/make_research_conditions_config.mjs ${args.join(' ')}`, edits: done, generated: new Date().toISOString(),
  ...(prev ? { previous: prev } : {}) };
writeFileSync(join(REPO, 'config', `mod_config.${SFX}.json`), JSON.stringify(cfg), 'utf8');
const twin = basename(BASE).replace(/^mod_config\./, 'tech_tree_options.');
if (!existsSync(join(REPO, 'config', twin))) die(`no tree twin ${twin} beside ${BASE} (landmine L20)`);
copyFileSync(join(REPO, 'config', twin), join(REPO, 'config', `tech_tree_options.${SFX}.json`));
for (const l of done) console.log('  ' + l);
console.log(`wrote config/mod_config.${SFX}.json + tech_tree_options.${SFX}.json (base ${BASE})`);
