// tools/lint_bom.mjs — landmine L53: a shipped script or localization file without its UTF-8 byte-order mark.
//
// The engine's lexer reads such a file anyway and logs `File '<path>' should be in utf8-bom encoding (will try to use it anyways)` once
// per load, so nothing fails. It happened twice: emit_secondaries (fixed 2026-09-24) and emit_ai_value_adds (shipped so in mods
// 1.1.0-1.1.1, found 2026-11-19), each a writer that read through a BOM-stripping helper and wrote back without the mark.
//
// usage: node tools/lint_bom.mjs <modDir> [<config.json>]      (the config is accepted for preflight's Invoke-ModLint and not read)
// Every .txt under common/ and events/ and every .yml under localization/ must start with EF BB BF, unless the vanilla file at the same
// path (VIC3_GAME, default the Steam game folder) has none either: an owned copy follows vanilla's encoding.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MOD = process.argv[2];
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
if (!MOD || !existsSync(join(MOD, 'common'))) { console.error('lint_bom: usage: node tools/lint_bom.mjs <modDir> - no common/ in ' + MOD); process.exit(2); }

const hasBom = p => { const b = readFileSync(p); return b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF; };
function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p); else yield p;
  }
}
let checked = 0; const missing = [], followed = [];
for (const [sub, ext] of [['common', '.txt'], ['events', '.txt'], ['localization', '.yml']]) {
  const root = join(MOD, sub);
  if (!existsSync(root)) continue;
  for (const p of walk(root)) {
    if (!p.endsWith(ext)) continue;
    checked++;
    if (hasBom(p)) continue;
    const rel = relative(MOD, p).replace(/\\/g, '/');
    const van = join(GAME, rel.replace(/^localization\/replace\//, 'localization/'));
    if (existsSync(van) && !hasBom(van)) { followed.push(rel); continue; }
    missing.push(rel);
  }
}
if (followed.length) console.log(`lint_bom: ${followed.length} file(s) without a BOM, as vanilla's own are: ${followed.join(', ')}`);
if (missing.length) {
  console.error(`L53 FAIL: ${missing.length} shipped file(s) without a UTF-8 BOM (the engine logs "should be in utf8-bom encoding" for each on every load):`);
  for (const m of missing) console.error('  ' + m);
  console.error('FIX: the writer that last wrote the file must prepend \\uFEFF (a reader that strips the BOM must write it back).');
  process.exit(1);
}
console.log(`BOM CHECK PASSED (L53): ${checked} script and localization files, every one with its UTF-8 BOM${followed.length ? ` or vanilla's encoding (${followed.length})` : ''}.`);
