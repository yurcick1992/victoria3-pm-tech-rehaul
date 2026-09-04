// THE FOUR-RUNG TECH TREE, FROM VANILLA — writes config/tech_tree_options.<suffix>.json (the L20 twin of
// config/mod_config.<suffix>.json), with every tier's technology stamped into its `unlocks`.
//
// ⭐⭐⭐ Reads the GAME, the four-rung config and tools/lib_tier4_spec.mjs. Nothing else (user-ruled 2026-09-04: no
//   six-rung data). The previous tool copied the six-rung twin's vanilla technologies — with THAT ladder's era alignment
//   (dynamite, repeaters, breech-loading artillery, combustion engine, telephone, aniline all lowered), its fourteen
//   renames and its inserted prerequisites — and only re-pointed the unlocks. Every vanilla technology now carries
//   vanilla's era, vanilla's name and vanilla's prerequisites, and every departure is an explicit spec entry:
//   ERA_MOVES (the top-rung rule), TECH_RENAMES_RULED (empty), and the ADDITIONS' minted technologies.
//
// Run AFTER make_tier4_config.mjs.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks } from './lib_vanilla_ladder.mjs';
import { INDUSTRIES, ADDITIONS, ERA_MOVES, TECH_RENAMES_RULED } from './lib_tier4_spec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const SUFFIX = process.env.TIER4_SUFFIX || 'tier4';
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const CFG_PATH = `config/mod_config.${SUFFIX}.json`;
const cfg = JSON.parse(rd(join(REPO, CFG_PATH)));

// vanilla's era windows (calendar), for placing a MINTED technology by its own year
const gameEra = y => y < 1836 ? 1 : y <= 1861 ? 2 : y <= 1886 ? 3 : y <= 1911 ? 4 : 5;
const ERA_COST = { 1: 7500, 2: 10000, 3: 12500, 4: 15000, 5: 17500 };   // the era base costs, as the viewer shows them

// ---- the game ---------------------------------------------------------------------------------------------------
const list = (body, key) => { const m = body.match(new RegExp('(^|\\s)' + key + '\\s*=\\s*\\{([^}]*)\\}')); return m ? m[2].trim().split(/\s+/).filter(Boolean) : []; };
const ENLOC = (() => { const loc = {}; const walk = d => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('_l_english.yml')) { for (const line of rd(p).split(/\r?\n/)) { const m = line.match(/^\s*([A-Za-z_0-9\-.]+):\d*\s*"(.*)"\s*$/); if (m && !(m[1] in loc)) loc[m[1]] = m[2]; } } } }; walk(join(GAME, 'localization/english')); return loc; })();
const ONSET = (() => { const src = rd(join(REPO, 'tools/tech_tree_spec.mjs')); const i = src.indexOf('const ONSET = {'); if (i < 0) throw new Error('tech_tree_spec.mjs: ONSET table not found'); let j = i + 'const ONSET = '.length, d = 0; const st = j; do { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } while (d > 0); return new Function('return (' + src.slice(st, j) + ')')(); })();
const VT = {};   // vanilla technologies
for (const f of readdirSync(join(GAME, 'common/technology/technologies'))) if (f.endsWith('.txt'))
  for (const [id, body] of Object.entries(blocks(rd(join(GAME, 'common/technology/technologies', f))))) {
    const era = +(body.match(/^\s*era\s*=\s*era_(\d)/m) || [])[1]; const category = (body.match(/^\s*category\s*=\s*([a-z_]+)/m) || [])[1];
    if (!era || !category) throw new Error(`vanilla technology ${id}: no era or category`);
    VT[id] = { era, category, prereqs: list(body, 'unlocking_technologies'), modLines: [...body.matchAll(/^\s*([a-z_]+_(?:add|mult))\s*=\s*(-?[0-9.]+)/gm)].map(m => `${m[1]} = ${m[2]}`) };
  }
// what vanilla gates on each technology (viewer data)
const vanillaUnlocks = {}, pmUnlocks = {};
for (const f of readdirSync(join(GAME, 'common/buildings'))) if (f.endsWith('.txt')) for (const [k, body] of Object.entries(blocks(rd(join(GAME, 'common/buildings', f))))) for (const t of list(body, 'unlocking_technologies')) (vanillaUnlocks[t] ||= []).push(k);
for (const f of readdirSync(join(GAME, 'common/production_methods'))) if (f.endsWith('.txt')) for (const [k, body] of Object.entries(blocks(rd(join(GAME, 'common/production_methods', f))))) for (const t of list(body, 'unlocking_technologies')) (pmUnlocks[t] ||= []).push(k);

// ---- the tree ---------------------------------------------------------------------------------------------------
const techs = Object.entries(VT).map(([id, v]) => {
  const vname = ENLOC[id] || id; const ruled = TECH_RENAMES_RULED[id];
  const era = ERA_MOVES[id] != null && ERA_MOVES[id] > v.era ? ERA_MOVES[id] : v.era;
  return { id, name: ruled ? ruled[0] : vname, vanillaName: vname, renamed: ruled ? ruled[1] : null, desc: null,
    category: v.category, era, vanillaEra: v.era, reEra: era !== v.era, year: null, onset: ONSET[id] ?? null, idea: false, mod: null,
    origin: 'vanilla', filler: false, platform: null, industry: null, prereqs: v.prereqs, unlocks: [],
    vanillaUnlocks: vanillaUnlocks[id] || [], pmUnlocks: pmUnlocks[id] || [], otherGates: [], modLines: v.modLines, blocks: [] };
});
const moved = techs.filter(t => t.reEra).map(t => `${t.id} ${t.vanillaEra}→${t.era}`);
for (const a of ADDITIONS) {
  if (VT[a.tech]) throw new Error(`addition ${a.tech} names a VANILLA technology — an addition mints its own (rule 3 keeps vanilla's for vanilla's methods)`);
  const m = a.minted; if (!m) throw new Error(`addition ${a.tech} carries no minted technology`);
  techs.push({ id: a.tech, name: m.name, vanillaName: null, renamed: null, desc: m.desc || null, category: m.category, era: gameEra(a.year), vanillaEra: null,
    reEra: false, year: a.year, onset: a.year, idea: false, mod: 'pm_tech_rehaul', origin: 'new', filler: false, platform: null, industry: a.industry,
    prereqs: m.prereqs, unlocks: [], vanillaUnlocks: [], pmUnlocks: [], otherGates: [], modLines: [], blocks: [] });
}
const byId = Object.fromEntries(techs.map(t => [t.id, t]));
for (const t of techs) for (const p of t.prereqs) if (byId[p]) byId[p].blocks.push(t.id);

// every tier's gate, stamped as an unlock
const missing = [];
for (const ind of cfg.industries) for (const t of ind.tiers) {
  const T = byId[t.tech]; if (!T) { missing.push(`${ind.id} e${t.era} → ${t.tech}`); continue; }
  T.unlocks.push({ key: t.key, name: t.name, era: t.era, year: t.tech_year ?? null, ind: ind.id });
}
if (missing.length) { console.error('⚠⚠ tiers whose technology is in NEITHER vanilla nor the additions:\n  ' + missing.join('\n  ')); process.exit(1); }

// ---- guardrails -------------------------------------------------------------------------------------------------
const errs = [];
for (const t of techs) {
  if (t.origin === 'new') {
    if (t.era <= 1) errs.push(`${t.id} is in era ${t.era} — a NEW technology may never land in era 1 (add_era_researched hands every era-1 technology to the 1836 start)`);
    if (!t.unlocks.length) errs.push(`${t.id} unlocks nothing — there are no contentless technologies`);
  }
  for (const p of t.prereqs) {
    if (!byId[p]) errs.push(`${t.id} has an unknown prerequisite ${p}`);
    else if (byId[p].category !== t.category) errs.push(`${t.id} (${t.category}) depends on ${p} (${byId[p].category}) — the engine refuses a cross-category prerequisite`);
    else if (byId[p].era > t.era) errs.push(`${t.id} (era ${t.era}) depends on ${p} (era ${byId[p].era}) — a prerequisite may not sit in a LATER era`);
  }
}
// one technology may not gate two rungs of one industry
for (const ind of cfg.industries) { const seen = new Map(); for (const t of ind.tiers) { if (seen.has(t.tech)) errs.push(`${ind.id}: ${t.tech} gates two rungs (${seen.get(t.tech)} and ${t.key})`); seen.set(t.tech, t.key); } }
if (errs.length) { console.error('⚠⚠ TREE VALIDATION FAILED:\n  ' + errs.join('\n  ')); process.exit(1); }

// ---- write ------------------------------------------------------------------------------------------------------
const newT = techs.filter(t => t.origin === 'new');
const out = { generated: new Date().toISOString().slice(0, 19), eraCost: ERA_COST,
  indOrder: INDUSTRIES.map(i => i.id), indLabel: Object.fromEntries(INDUSTRIES.map(i => [i.id, ENLOC[i.building] || i.id])),
  options: [{ id: 'tier4', ships: true, label: 'Four-rung, vanilla', tagline: `${newT.length} added technologies; everything else is vanilla — eras, names, prerequisites.`,
    blurb: 'Written by tools/make_tier4_techs.mjs from the game files and tools/lib_tier4_spec.mjs.', techs }] };
writeFileSync(join(REPO, `config/tech_tree_options.${SUFFIX}.json`), JSON.stringify(out));

console.log(`THE FOUR-RUNG TECH TREE FROM VANILLA — ${techs.length} technologies, ${newT.length} of them minted`);
console.log('  minted technology                 year  era  serves');
for (const t of newT) console.log('  ' + t.id.padEnd(33) + t.year + '   ' + t.era + '   ' + t.unlocks.map(u => u.ind + ' e' + u.era).join(' + '));
console.log(`  era moves against vanilla (ERA_MOVES): ${moved.join(', ') || 'none'}`);
console.log(`  vanilla technologies renamed: ${techs.filter(t => t.renamed).length}`);
console.log(`  technologies that gate at least one of our tiers: ${techs.filter(t => t.unlocks.length).length}`);
console.log(`\n  wrote config/tech_tree_options.${SUFFIX}.json — next: node tools/make_ab_config.mjs --A 2.0 --B 1.5 --suffix <canon> --ai-steep glass,tooling:3`);
