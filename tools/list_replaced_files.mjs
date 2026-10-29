// THE MOD'S COMPATIBILITY FOOTPRINT, FOR THE README (POLISH_1_0.md H9, 2026-10-26; the key-level lines 2026-10-30).
// A file under the built mod whose relative path also exists in the game folder replaces vanilla's file WHOLE, so another mod that edits
// the same file conflicts silently by load order. This lists them, grouped by folder, plus the metadata's `replace_paths` (whole folders).
// Then what a file list cannot show: the defines the mod sets key by key, any vanilla object an ADDED file redefines (on-action hooks are
// left out: the engine joins every file's lists for one on-action), and the vanilla English localization keys the replace/ files override.
// It writes all of it into README.md between the markers <!-- replaced-files:start --> and <!-- replaced-files:end --> (throws without them).
// Run it on the build you ship (normally the release build in mod/).
//   node tools/list_replaced_files.mjs [--mod mod] [--readme README.md] [--print]
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MOD = join(REPO, opt('--mod', 'mod'));
const README = join(REPO, opt('--readme', 'README.md'));
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
if (!existsSync(join(GAME, 'common'))) throw new Error(`no game folder at ${GAME} (set VIC3_GAME): cannot tell which files replace vanilla's`);
if (!existsSync(join(MOD, 'common'))) throw new Error(`no built mod at ${MOD}`);
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(MOD).map(p => relative(MOD, p).replace(/\\/g, '/'))
  .filter(r => !r.startsWith('.metadata') && existsSync(join(GAME, r))).sort();
const meta = JSON.parse(readFileSync(join(MOD, '.metadata', 'metadata.json'), 'utf8').replace(/^\uFEFF/, ''));
const byDir = new Map(); for (const f of files) { const d = f.slice(0, f.lastIndexOf('/')); (byDir.get(d) || byDir.set(d, []).get(d)).push(f.slice(f.lastIndexOf('/') + 1)); }

// Top-level `key = {` blocks of a script file, by brace depth (comments stripped, BOM stripped).
const topKeys = p => {
  const keys = []; let depth = 0;
  for (const raw of readFileSync(p, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '');
    if (depth === 0) { const m = /^\s*([A-Za-z0-9_.:@-]+)\s*=\s*\{/.exec(line); if (m) keys.push(m[1]); }
    for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  }
  return keys;
};
const added = ['common', 'events'].filter(d => existsSync(join(MOD, d))).flatMap(d => walk(join(MOD, d)))
  .map(p => relative(MOD, p).replace(/\\/g, '/')).filter(r => r.endsWith('.txt') && !existsSync(join(GAME, r)));

// The defines, NAME.KEY, from every added defines file.
const defines = [];
for (const r of added.filter(r => r.startsWith('common/defines/'))) {
  let block = null;
  for (const raw of readFileSync(join(MOD, r), 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, ''); let m;
    if ((m = /^(\w+)\s*=\s*\{/.exec(line))) block = m[1];
    else if (block && (m = /^\s+(\w+)\s*=/.exec(line))) defines.push(`${block}.${m[1]}`);
    else if (/^\}/.test(line)) block = null;
  }
}

// Vanilla objects an added file redefines: its top-level keys that vanilla's same folder also defines.
const SKIP = ['common/defines/', 'common/on_actions/', 'common/history/'];
const vanKeys = new Map();
const redefined = [];
for (const r of added.filter(r => !SKIP.some(s => r.startsWith(s)))) {
  const d = r.slice(0, r.lastIndexOf('/'));
  if (!existsSync(join(GAME, d))) continue;
  if (!vanKeys.has(d)) vanKeys.set(d, new Set(walk(join(GAME, d)).filter(p => p.endsWith('.txt')).flatMap(topKeys)));
  for (const k of topKeys(join(MOD, r))) if (vanKeys.get(d).has(k)) redefined.push(`\`${k}\` (${r})`);
}

// Vanilla localization keys the mod's replace/ files override, per language, and the English ones by kind.
const LOC_KEY = /^\s+([A-Za-z0-9_.\-]+):\d*\s*"/;
const locKeys = dir => existsSync(dir) ? walk(dir).filter(p => p.endsWith('.yml'))
  .flatMap(p => readFileSync(p, 'utf8').split(/\r?\n/).map(l => LOC_KEY.exec(l)?.[1]).filter(Boolean)) : [];
const overridden = lang => { const van = new Set(locKeys(join(GAME, 'localization', lang)));
  return [...new Set(locKeys(join(MOD, 'localization', lang, 'replace')))].filter(k => van.has(k)); };
const langs = existsSync(join(MOD, 'localization')) ? readdirSync(join(MOD, 'localization')).filter(l => statSync(join(MOD, 'localization', l)).isDirectory()) : [];
const perLang = new Map(langs.map(l => [l, overridden(l).length]));
const modLoc = overridden('english');
const kindOf = k => k.endsWith('_lens_option') ? 'map-lens labels' : k.startsWith('building_') ? 'building names' : /^pmg?_/.test(k) ? 'method or group names' : 'other';
const locCount = new Map(); for (const k of modLoc) locCount.set(kindOf(k), (locCount.get(kindOf(k)) || 0) + 1);
const sameEverywhere = [...perLang.values()].every(n => n === modLoc.length);
const locOthers = sameEverywhere ? `the same ${modLoc.length} in each of the other ${langs.length - 1} languages`
  : [...perLang].filter(([l]) => l !== 'english').map(([l, n]) => `${l} ${n}`).join(', ');

const out = [
  `The mod replaces **${files.length} vanilla files** whole, in ${byDir.size} folders (generated from the ${meta.version} build by \`tools/list_replaced_files.mjs\`),`,
  `and the whole folder${(meta.replace_paths || []).length > 1 ? 's' : ''} ${(meta.replace_paths || []).map(p => '`' + p + '/`').join(', ')} (the converted 1836 start). Another mod that changes`,
  'any of these files conflicts with this one: the one loaded later wins the whole file.', '',
  '<details><summary>The replaced files, by folder</summary>', '',
  ...[...byDir].map(([d, fs]) => `- \`${d}/\` (${fs.length}): ${fs.map(f => '`' + f + '`').join(', ')}`), '', '</details>', '',
  'Beyond whole files, from the same build:',
  `- **Defines**, set key by key (another mod that sets the same key wins or loses by load order): ${defines.map(k => '`' + k + '`').join(', ') || 'none'}.`,
  `- **Vanilla objects redefined by a file the mod adds:** ${redefined.join(', ') || 'none'}. The mod's on-action hooks are not counted: the engine`,
  '  joins them to vanilla\'s.',
  `- **Vanilla localization overridden:** ${modLoc.length} English keys (${[...locCount].map(([name, n]) => `${n} ${name}`).join(', ')})${langs.length > 1 ? `, and ${locOthers}` : ''}.`,
  '  A translation or renaming mod that sets them conflicts key by key.'];
if (args.includes('--print')) { console.log(out.join('\n')); process.exit(0); }
const S = '<!-- replaced-files:start -->', E = '<!-- replaced-files:end -->';
const txt = readFileSync(README, 'utf8');
const a = txt.indexOf(S), b = txt.indexOf(E);
if (a < 0 || b < a) throw new Error(`${relative(REPO, README)} has no ${S} … ${E} block to fill`);
writeFileSync(README, txt.slice(0, a + S.length) + '\n' + out.join('\n') + '\n' + txt.slice(b));
console.log(`README: ${files.length} replaced vanilla files in ${byDir.size} folders, plus replace_paths ${(meta.replace_paths || []).join(', ') || 'none'}`);
