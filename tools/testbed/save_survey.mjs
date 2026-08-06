// save_survey.mjs — what is actually IN a Victoria 3 gamestate, and can it be read without the
// token table?
//
//   node tools/testbed/save_survey.mjs <file.gamestate> [--limit-mb N]
//
// THE FORMAT. Clausewitz binary: a stream of little-endian uint16 tokens. A handful are structural and
// the rest are FIELD NAMES whose ID→name table ships inside the executable, not the save. The
// structural ones are stable across Paradox titles:
//     0x0001 =        0x0003 {        0x0004 }        0x000B ; (list separator, rare)
//     0x000C int32    0x000D fixed    0x000E bool     0x000F string (uint16 len + bytes)
//     0x0014 uint32   0x0017 string2  0x0167 int64    0x0290 fixed64
// Anything else is a name token. So the STRUCTURE and every VALUE are readable; only the field names
// are missing, and they are exactly what a semantic reader needs.
//
// ⭐ WHY THIS IS STILL WORTH DOING. The names can be recovered EMPIRICALLY, because this project has a
// Rosetta Stone the usual reverse-engineer does not: the telemetry already tells us, for this very run
// and date, what many of these numbers ARE — Britain's buy and sell orders per good, pop counts,
// building levels. Find a known value in the stream and the token in front of it is identified. This
// survey is the first half of that: establish the structure, count the tokens, and surface the string
// tables that anchor the search.
//
// ⚠ STREAMED IN CHUNKS. 259 MB of gamestate; do not materialise parsed nodes for the whole file.
import { openSync, readSync, closeSync, statSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const LIMIT = (() => { const i = args.indexOf('--limit-mb'); return i >= 0 ? parseInt(args[i + 1], 10) * 1048576 : Infinity; })();
if (!SRC || !existsSync(SRC)) { console.error('usage: save_survey.mjs <file.gamestate> [--limit-mb N]'); process.exit(1); }

const SIZE = statSync(SRC).size;
const END  = Math.min(SIZE, LIMIT);
const fd   = openSync(SRC, 'r');
const CH   = 1 << 22;                      // 4 MB window
let buf = Buffer.alloc(CH), base = 0, len = 0, pos = 0;

function need(n) {                          // ensure n bytes available at pos
  if (pos + n <= len) return true;
  const keep = len - pos;
  buf.copy(buf, 0, pos, len);
  base += pos;
  len = keep + readSync(fd, buf, keep, CH - keep, base + keep);
  pos = 0;
  return len >= n;
}

const tokCount = new Map();                 // token id -> times seen in NAME position
const strCount = new Map();                 // string value -> count
let depth = 0, maxDepth = 0, nStr = 0, nInt = 0, nFix = 0, nBool = 0, nOpen = 0, nClose = 0, bad = 0;
const depthHist = new Map();

while (base + pos < END) {
  if (!need(2)) break;
  const t = buf.readUInt16LE(pos); pos += 2;
  switch (t) {
    case 0x0001: break;                                          // '='
    case 0x0003: depth++; nOpen++; maxDepth = Math.max(maxDepth, depth);
                 depthHist.set(depth, (depthHist.get(depth) || 0) + 1); break;
    case 0x0004: depth--; nClose++; break;
    case 0x000C: if (!need(4)) { pos = len; break; } pos += 4; nInt++; break;
    case 0x0014: if (!need(4)) { pos = len; break; } pos += 4; nInt++; break;
    case 0x000D: if (!need(4)) { pos = len; break; } pos += 4; nFix++; break;
    case 0x000E: if (!need(1)) { pos = len; break; } pos += 1; nBool++; break;
    case 0x0167: if (!need(8)) { pos = len; break; } pos += 8; nInt++; break;
    case 0x0290: if (!need(8)) { pos = len; break; } pos += 8; nFix++; break;
    case 0x000F: case 0x0017: {
      if (!need(2)) { pos = len; break; }
      const n = buf.readUInt16LE(pos); pos += 2;
      if (!need(n)) { pos = len; break; }
      const s = buf.toString('latin1', pos, pos + n); pos += n; nStr++;
      if (s.length >= 2 && /^[\x20-\x7e]+$/.test(s)) strCount.set(s, (strCount.get(s) || 0) + 1);
      break;
    }
    default:
      tokCount.set(t, (tokCount.get(t) || 0) + 1);
      break;
  }
  if (pos >= len && base + pos >= END) break;
}
closeSync(fd);

const scanned = Math.min(base + pos, END);
console.log(`scanned      : ${scanned.toLocaleString()} of ${SIZE.toLocaleString()} bytes`);
console.log(`structure    : ${nOpen.toLocaleString()} open / ${nClose.toLocaleString()} close, max depth ${maxDepth}, unbalanced ${nOpen - nClose}`);
console.log(`values       : ${nInt.toLocaleString()} int · ${nFix.toLocaleString()} fixed · ${nStr.toLocaleString()} string · ${nBool.toLocaleString()} bool`);
console.log(`name tokens  : ${tokCount.size.toLocaleString()} distinct, ${[...tokCount.values()].reduce((a, b) => a + b, 0).toLocaleString()} uses`);

const top = [...tokCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(`\nMOST FREQUENT NAME TOKENS (id → uses) — these are the fields worth identifying first`);
console.log('  ' + top.map(([id, c]) => `0x${id.toString(16).padStart(4, '0')}:${c.toLocaleString()}`).join('  '));

const strs = [...strCount.entries()].sort((a, b) => b[1] - a[1]);
console.log(`\nSTRINGS: ${strCount.size.toLocaleString()} distinct. Most frequent:`);
console.log('  ' + strs.slice(0, 30).map(([s, c]) => `${s}(${c})`).join('  '));

// The anchors a semantic pass will navigate by: strings that name things we care about.
const want = /^(transportation|automobiles|telephones|services|fine_art|wood|grain|clothes|furniture|luxury_furniture)$/;
const goods = strs.filter(([s]) => want.test(s));
console.log(`\nGOOD-NAME STRINGS PRESENT (the anchors for a semantic pass):`);
console.log(goods.length ? '  ' + goods.map(([s, c]) => `${s}×${c}`).join('  ') : '  none in the scanned region');
