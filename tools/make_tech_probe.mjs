// TECH PROBE: turn a `build.ps1 -SaveTo <name>` build into a separate local mod in which the PLAYER's country holds technologies from
// the start, so rungs and methods can be built and looked at in game. A local check only; never shipped.
//   powershell -ExecutionPolicy Bypass -File tools\tech_probe.ps1 [-Techs a,b]   # build, patch and deploy in one step (the usual way)
//   node tools/make_tech_probe.mjs <built mod dir> [--techs a,b,…]  # the patch alone
// - without --techs: every technology (the built mod's technology files plus vanilla's files the mod does not shadow);
//   with --techs: those technologies and every prerequisite of theirs, in the tree the mod loads;
// - an on_action on on_game_started_after_lobby (the on_actions list form, which appends: an `effect` on a vanilla on_action would
//   replace vanilla's, L22) granting each to every country with is_player = yes;
// - metadata: its own id (the same for every probe, so the launcher keeps it selected) and a name saying what it grants.
// ⚠ Granting all 182 at once made the 1836 start take 5-10 minutes in the user's game (2026-10-26; the regular mod starts in seconds; not
//   explained — each grant fires on_acquired_technology, vanilla's handler posts a notification). Grant a chain with --techs where you can.
//   Turn the probe off in the playset before any release check: it shares every file of the real mod.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MOD = process.argv[2];
const ti = process.argv.indexOf('--techs');
const WANT = ti > 0 ? process.argv[ti + 1].split(',').filter(Boolean) : null;
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const REL = 'common/technology/technologies';
// top-level technology blocks and their prerequisites (pan-nationalism has a hyphen)
function techBlocks(text) {
  const out = new Map(); text = text.replace(/^\uFEFF/, '').replace(/#[^\n]*/g, '');
  const re = /^([a-z][a-z0-9_-]*)\s*=\s*\{/gm; let m;
  while ((m = re.exec(text))) {
    let d = 0, i = m.index + m[0].length - 1;
    for (; i < text.length; i++) { if (text[i] === '{') d++; else if (text[i] === '}' && --d === 0) break; }
    const u = /unlocking_technologies\s*=\s*\{([^}]*)\}/.exec(text.slice(m.index, i + 1));
    out.set(m[1], u ? u[1].trim().split(/\s+/).filter(Boolean) : []); re.lastIndex = i + 1;
  }
  return out;
}
const modFiles = existsSync(join(MOD, REL)) ? readdirSync(join(MOD, REL)).filter(f => f.endsWith('.txt')) : [];
const tree = new Map();
for (const f of readdirSync(join(GAME, REL)).filter(f => f.endsWith('.txt') && !modFiles.includes(f)))
  for (const [k, v] of techBlocks(readFileSync(join(GAME, REL, f), 'utf8'))) tree.set(k, v);
for (const f of modFiles) for (const [k, v] of techBlocks(readFileSync(join(MOD, REL, f), 'utf8'))) tree.set(k, v);
if (tree.size < 170) throw new Error(`only ${tree.size} technologies found — the file shape moved`);

let techs;
if (!WANT) techs = new Set(tree.keys());
else {
  techs = new Set(); const stack = [...WANT];
  while (stack.length) { const t = stack.pop(); if (techs.has(t)) continue; if (!tree.has(t)) throw new Error(`unknown technology ${t}`); techs.add(t); stack.push(...tree.get(t)); }
}
const what = WANT ? `${WANT.join(', ')} + prerequisites` : 'every technology';

const L = [`# TECH PROBE (local check only, never shipped): the player holds ${what} (${techs.size}) from the start.`, '',
  'on_game_started_after_lobby = {', '\ton_actions = { pmr_probe_alltech }', '}', '',
  'pmr_probe_alltech = {', '\teffect = {', '\t\tevery_country = {', '\t\t\tlimit = { is_player = yes }'];
for (const t of [...techs].sort()) L.push(`\t\t\tadd_technology_researched = ${t}`);
L.push('\t\t}', `\t\tdebug_log = "PM_TECH_REHAUL PROBE: ${techs.size} technologies granted to the player"`, '\t}', '}', '');
writeFileSync(join(MOD, 'common/on_actions/zzz_pm_rehaul_probe_alltech.txt'), '\uFEFF' + L.join('\n'), 'utf8');

const metaPath = join(MOD, '.metadata/metadata.json');
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const stamp = (/\(built [^)]*\)/.exec(meta.name) || [''])[0];
meta.id = 'com.yurcick.pm_tech_rehaul_probe_alltech';
meta.name = `PM and Tech Rehaul PROBE: ${WANT ? WANT.join(', ') : 'all technologies'} ${stamp}`.trim();
meta.short_description = `Local check only: the canon with ${what} (${techs.size} technologies) granted to the player at the start.`;
writeFileSync(metaPath, JSON.stringify(meta, null, '\t'), 'utf8');
console.log(`probe: ${techs.size} technologies granted to the player (${what}): ${[...techs].sort().join(' ')}`);
console.log(`probe: metadata "${meta.name}" (${meta.id})`);
