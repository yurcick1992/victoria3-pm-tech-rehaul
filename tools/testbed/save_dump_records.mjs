// save_dump_records.mjs — print the raw token/value sequence around an anchor string, so the shape of
// a repeating record can be read off directly.
//
//   node tools/testbed/save_dump_records.mjs <file.gamestate> --anchor laborers [--records 3] [--before 12] [--after 40]
//
// WHY. save_survey.mjs establishes that the first ~40 MB is a pop table: ~18 distinct name tokens each
// appearing EXACTLY 53 196 times, alongside strings like `laborers`, `lower_class` and religion names.
// That is a fixed-field record repeated once per pop. To read it we need the field ORDER, and the fastest
// way to get that is to look at one record in full rather than guess.
//
// ⭐ THE IDENTIFICATION STRATEGY. Field NAMES are token IDs whose table is not in the save, but this
// project has a Rosetta Stone: the telemetry already reports, for this exact run and date, quantities
// the save must also contain (pop counts, building levels, market orders). Dump the record, then match
// its numbers against known ones. A token in front of a recognised value is an identified field.
import { openSync, readSync, closeSync, statSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ANCHOR  = argOf('--anchor', 'laborers');
const RECORDS = parseInt(argOf('--records', '2'), 10);
const BEFORE  = parseInt(argOf('--before', '10'), 10);
const AFTER   = parseInt(argOf('--after', '46'), 10);
if (!SRC || !existsSync(SRC)) { console.error('usage: save_dump_records.mjs <file.gamestate> --anchor <string>'); process.exit(1); }

const fd = openSync(SRC, 'r'), SIZE = statSync(SRC).size;
const CH = 1 << 22;
let buf = Buffer.alloc(CH), base = 0, len = 0, pos = 0;
const need = n => {
  if (pos + n <= len) return true;
  const keep = len - pos; buf.copy(buf, 0, pos, len); base += pos;
  len = keep + readSync(fd, buf, keep, CH - keep, base + keep); pos = 0;
  return len >= n;
};

// Decode one item; return a printable description plus whether it was our anchor string.
function step() {
  if (!need(2)) return null;
  const at = base + pos;
  const t = buf.readUInt16LE(pos); pos += 2;
  const T = id => `0x${id.toString(16).padStart(4, '0')}`;
  switch (t) {
    case 0x0001: return { at, kind: 'op', text: '=' };
    case 0x0003: return { at, kind: 'open', text: '{' };
    case 0x0004: return { at, kind: 'close', text: '}' };
    case 0x000C: { if (!need(4)) return null; const v = buf.readInt32LE(pos); pos += 4; return { at, kind: 'int', v, text: String(v) }; }
    case 0x0014: { if (!need(4)) return null; const v = buf.readUInt32LE(pos); pos += 4; return { at, kind: 'uint', v, text: String(v) }; }
    case 0x000D: { if (!need(4)) return null; const v = buf.readInt32LE(pos) / 100000; pos += 4; return { at, kind: 'fixed', v, text: v.toFixed(5) }; }
    case 0x000E: { if (!need(1)) return null; const v = buf[pos]; pos += 1; return { at, kind: 'bool', v, text: v ? 'yes' : 'no' }; }
    case 0x0167: { if (!need(8)) return null; const v = buf.readBigInt64LE(pos); pos += 8; return { at, kind: 'i64', v, text: String(v) }; }
    case 0x0290: { if (!need(8)) return null; const v = Number(buf.readBigInt64LE(pos)) / 100000; pos += 8; return { at, kind: 'f64', v, text: v.toFixed(5) }; }
    case 0x000F: case 0x0017: {
      if (!need(2)) return null; const n = buf.readUInt16LE(pos); pos += 2;
      if (!need(n)) return null; const s = buf.toString('latin1', pos, pos + n); pos += n;
      return { at, kind: 'str', s, text: `"${s}"` };
    }
    default: return { at, kind: 'name', id: t, text: T(t) };
  }
}

const ring = []; let found = 0;
while (base + pos < SIZE && found < RECORDS) {
  const it = step(); if (!it) break;
  ring.push(it); if (ring.length > BEFORE) ring.shift();
  if (it.kind === 'str' && it.s === ANCHOR) {
    found++;
    console.log(`\n${'='.repeat(90)}\n  RECORD ${found} — anchor "${ANCHOR}" at byte ${it.at.toLocaleString()}\n${'='.repeat(90)}`);
    const out = [...ring];
    for (let i = 0; i < AFTER; i++) { const n = step(); if (!n) break; out.push(n); }
    let line = [], d = 0;
    for (const x of out) {
      if (x.kind === 'open') d++;
      if (x.kind === 'close') d--;
      line.push(x.kind === 'name' ? `\n  ${'  '.repeat(Math.max(0, d))}${x.text} ` : x.text);
    }
    console.log(line.join(' ').replace(/\n\s*\n/g, '\n'));
    ring.length = 0;
  }
}
closeSync(fd);
console.log(`\n(name tokens print as 0xNNNN — those are the unnamed fields; values print literally)`);
