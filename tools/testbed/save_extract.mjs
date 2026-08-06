// save_extract.mjs — pull the `gamestate` out of a Victoria 3 .v3 save.
//
//   node tools/testbed/save_extract.mjs <save.v3> [--out <file>]
//
// THE LAYOUT, established 2026-08-06 by inspection rather than documentation:
//   bytes 0..23      ASCII header, e.g. `SAV0103316c71b10000049b\n`
//   bytes 24..1202   a metadata block in Clausewitz BINARY token form — the bit the launcher reads:
//                    country name, government type, DLC list, game rules, and the MOD NAME
//   byte  1203..EOF  a ZIP archive with exactly one entry, `gamestate`
//
// A 1925 autosave is 45.5 MB and its gamestate inflates to **259 MB**, so everything downstream must
// stream. Do not read the inflated file whole; two 500 MB log mirrors already exhausted a 4 GB heap
// once in this project (lib_breakdown.mjs carries the same warning).
//
// ⚠ THE GAMESTATE IS BINARY-TOKENISED, NOT TEXT. Field names are uint16 token IDs whose name table
// lives in the executable, not in the save. Values — including all the strings — ARE in the file. So a
// structural parse is easy and a SEMANTIC one is not; see save_survey.mjs for how far that gets.
// ⚠ There is no text-save option: the exe contains no `save_as_text`/`save_as_binary`/`plaintext` flag
// and `pdx_settings.json` has no save-format key. Checked, so nobody re-checks.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const OUT = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i + 1] : (SRC ? SRC + '.gamestate' : ''); })();
if (!SRC || !existsSync(SRC)) { console.error('usage: save_extract.mjs <save.v3> [--out <file>]'); process.exit(1); }

const buf = readFileSync(SRC);
const header = buf.toString('latin1', 0, 24);
// Locate the zip rather than trusting the fixed 1203: the metadata block's length varies with the
// country name, the DLC list and the mod name, and a hardcoded offset would break on another save.
let zipAt = -1;
for (let i = 0; i < Math.min(buf.length - 4, 65536); i++) {
  if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) { zipAt = i; break; }
}
if (zipAt < 0) { console.error('no PK zip found in the first 64 KB — save layout changed?'); process.exit(1); }

// Minimal local-file-header parse: we only ever need the single `gamestate` entry, so a full zip
// implementation would be more code than the format warrants here.
const nameLen  = buf.readUInt16LE(zipAt + 26);
const extraLen = buf.readUInt16LE(zipAt + 28);
const name     = buf.toString('latin1', zipAt + 30, zipAt + 30 + nameLen);
const method   = buf.readUInt16LE(zipAt + 8);
const dataAt   = zipAt + 30 + nameLen + extraLen;
let   compSize = buf.readUInt32LE(zipAt + 18);
// A streamed zip writes 0 here and puts the sizes in a trailing descriptor; fall back to "to EOF minus
// the central directory", which is safe because there is exactly one entry.
if (compSize === 0) {
  const cd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  compSize = (cd > dataAt ? cd : buf.length) - dataAt;
}
console.log(`header      : ${JSON.stringify(header)}`);
console.log(`zip at      : ${zipAt}`);
console.log(`entry       : ${name}  method ${method}  compressed ${compSize.toLocaleString()}`);
if (method !== 8) { console.error(`unexpected compression method ${method} (expected 8 = deflate)`); process.exit(1); }

const raw = inflateRawSync(buf.subarray(dataAt, dataAt + compSize), { maxOutputLength: 1 << 30 });
writeFileSync(OUT, raw);
console.log(`gamestate   : ${raw.length.toLocaleString()} bytes -> ${OUT}`);
console.log(`ratio       : ${(raw.length / compSize).toFixed(1)}x`);
