// WHAT THE PARADOX LAUNCHER KNOWS ABOUT EACH MOD — read-only, from a copy of its database (it holds the original open).
//
//   node tools/launcher_mods.mjs [--db <launcher-v2.sqlite>]
//
// Prints every mod in the launcher's `mods` table: name, source (local / steam), directory, and where its picture comes from
// (`thumbnailPath`, `thumbnailUrl`). This is how 2026-10-26 established that the launcher shows a local mod's picture only from
// `.metadata/thumbnail.png` (MODDING_NOTES); after the Workshop upload it shows which picture Steam got. Node's built-in sqlite
// (prints an ExperimentalWarning).
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const i = process.argv.indexOf('--db');
const src = i > 0 ? process.argv[i + 1] : join(homedir(), 'Documents', 'Paradox Interactive', 'Victoria 3', 'launcher-v2.sqlite');
if (!existsSync(src)) { console.error(`no launcher database at ${src} (pass --db)`); process.exit(2); }
const copy = join(tmpdir(), `launcher-v2.copy.${process.pid}.sqlite`);
copyFileSync(src, copy);
const db = new DatabaseSync(copy, { readOnly: true });
for (const r of db.prepare('select displayName, name, source, status, dirPath, thumbnailPath, thumbnailUrl, steamId, pdxId from mods order by displayName').all()) {
  console.log(`${r.displayName || r.name}  [${r.source}${r.steamId ? ' ' + r.steamId : ''}${r.pdxId ? ' pdx ' + r.pdxId : ''}, ${r.status}]`);
  console.log(`   dir:       ${r.dirPath}`);
  console.log(`   thumbnail: ${r.thumbnailPath || '(none)'}${r.thumbnailUrl ? `\n   url:       ${r.thumbnailUrl}` : ''}`);
}
db.close();
