// THE VANILLA FILES THE MOD REPLACES, FOR THE PLAYER README (POLISH_1_0.md H9, 2026-10-26).
// A file under the built mod whose relative path also exists in the game folder replaces vanilla's file WHOLE, so another mod that edits
// the same file conflicts silently by load order. This lists them, grouped by folder, plus the metadata's `replace_paths` (whole folders),
// and writes the list into README.md between the markers <!-- replaced-files:start --> and <!-- replaced-files:end --> (throws without them).
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
const out = [
  `The mod replaces **${files.length} vanilla files** whole, in ${byDir.size} folders (generated from the ${meta.version} build by \`tools/list_replaced_files.mjs\`),`,
  `and the whole folder${(meta.replace_paths || []).length > 1 ? 's' : ''} ${(meta.replace_paths || []).map(p => '`' + p + '/`').join(', ')} (the converted 1836 start). Another mod that changes`,
  'any of these files conflicts with this one: the one loaded later wins the whole file.', '',
  '<details><summary>The replaced files, by folder</summary>', '',
  ...[...byDir].map(([d, fs]) => `- \`${d}/\` (${fs.length}): ${fs.map(f => '`' + f + '`').join(', ')}`), '', '</details>'];
if (args.includes('--print')) { console.log(out.join('\n')); process.exit(0); }
const S = '<!-- replaced-files:start -->', E = '<!-- replaced-files:end -->';
const txt = readFileSync(README, 'utf8');
const a = txt.indexOf(S), b = txt.indexOf(E);
if (a < 0 || b < a) throw new Error(`${relative(REPO, README)} has no ${S} … ${E} block to fill`);
writeFileSync(README, txt.slice(0, a + S.length) + '\n' + out.join('\n') + '\n' + txt.slice(b));
console.log(`README: ${files.length} replaced vanilla files in ${byDir.size} folders, plus replace_paths ${(meta.replace_paths || []).join(', ') || 'none'}`);
