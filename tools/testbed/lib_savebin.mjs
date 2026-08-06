// lib_savebin.mjs — THE reader for Clausewitz binary gamestate. One implementation, like lib_breakdown.
//
// FORMAT (established by inspection 2026-08-06, not from documentation):
//   a stream of little-endian uint16 tokens. Structural ones are fixed; everything else is a FIELD NAME
//   whose ID→name table lives in the executable and is NOT in the save.
//     0x0001 =    0x0003 {    0x0004 }
//     0x000C int32   0x0014 uint32   0x000D fixed(/100000)   0x000E bool
//     0x000F string (uint16 len + bytes)   0x0017 string   0x0167 int64   0x0290 fixed64
//
// ⚠⚠ PARSE RECURSIVELY, NOT WITH A FLAT STATE MACHINE. The first attempt tracked "the last name token
// seen" and assigned the next scalar to it. That silently mis-assigns as soon as a nested map appears —
// and pop records contain two, one of which (`0x5f73`) uses BARE INTEGERS as keys, e.g.
// `0x5f73 = { 1046 = 256  1284 = 1272 }`. Those keys look exactly like values to a flat reader. The
// symptom was quiet and plausible: a field that should have read 83 came out as 1, and two fields came
// out empty on every one of 138 881 records. Nothing errored.
//
// ⚠ A KEY IS NOT ALWAYS A NAME TOKEN. Inside those maps the key is an int (a packed handle: the high
// byte is a type tag, e.g. 16777289 = 0x01000049). So a node's children are (key, value) pairs where
// the key may be a token id, an int, or a string.
//
// ⚠ STREAMED. A 1925 gamestate is 259 MB; the caller gets one record at a time and must not accumulate.
//
// ⚠⚠ KNOWN LIMIT — THE BRACE BALANCE DRIFTS AFTER ~104 MB. Measured on the 1925 autosave: depth returns
// to 0–3 constantly through the first ~104 MB (the POP TABLE, and everything save_pops/save_summary
// read), then goes negative around 113.6 MB and diverges, ending at depth 146 over the whole file. So a
// rare token — ~150 occurrences in 259 MB — carries a payload this decoder does not consume, swallowing
// an OPEN. Ruled OUT as the cause: tokens appearing in VALUE position that are not known scalars (31
// distinct, 163 k uses) — those are ENUM values and take no payload, and the pop table is full of them
// and parses clean.
// ⇒ TRUST THIS READER BEFORE ~104 MB ONLY. The states, buildings and market databases live past the
// drift, which is why per-market pop analysis and per-state goods supply are NOT yet available. Anything
// read from the far region must be treated as suspect until this is fixed. The next step is a bisect for
// the first offset at which a known-good structure breaks, not more token-frequency counting.
import { openSync, readSync, closeSync, statSync } from 'node:fs';

export const TOK = { EQ:0x0001, OPEN:0x0003, CLOSE:0x0004, I32:0x000C, U32:0x0014,
                     FIX:0x000D, BOOL:0x000E, STR:0x000F, STR2:0x0017, I64:0x0167, FIX64:0x0290 };

export function createReader(path, { chunk = 1 << 22 } = {}) {
  const fd = openSync(path, 'r'), size = statSync(path).size;
  let buf = Buffer.alloc(chunk), base = 0, len = 0, pos = 0;
  const need = n => {
    if (pos + n <= len) return true;
    const keep = len - pos; buf.copy(buf, 0, pos, len); base += pos;
    len = keep + readSync(fd, buf, keep, chunk - keep, base + keep); pos = 0;
    return len >= n;
  };
  const at = () => base + pos;
  const eof = () => !need(2);
  // Read one item. Returns {t} for structural/name tokens, or {t, v} for scalars.
  function item() {
    if (!need(2)) return null;
    const t = buf.readUInt16LE(pos); pos += 2;
    switch (t) {
      case TOK.I32:   if (!need(4)) return null; { const v = buf.readInt32LE(pos);  pos += 4; return { t, v }; }
      case TOK.U32:   if (!need(4)) return null; { const v = buf.readUInt32LE(pos); pos += 4; return { t, v }; }
      case TOK.FIX:   if (!need(4)) return null; { const v = buf.readInt32LE(pos) / 100000; pos += 4; return { t, v }; }
      case TOK.BOOL:  if (!need(1)) return null; { const v = !!buf[pos]; pos += 1; return { t, v }; }
      case TOK.I64:   if (!need(8)) return null; { const v = Number(buf.readBigInt64LE(pos)); pos += 8; return { t, v }; }
      case TOK.FIX64: if (!need(8)) return null; { const v = Number(buf.readBigInt64LE(pos)) / 100000; pos += 8; return { t, v }; }
      case TOK.STR: case TOK.STR2: {
        if (!need(2)) return null; const n = buf.readUInt16LE(pos); pos += 2;
        if (!need(n)) return null; const v = buf.toString('latin1', pos, pos + n); pos += n; return { t, v };
      }
      default: return { t };
    }
  }
  // Parse the block whose '{' has just been consumed. Returns a plain object:
  //   scalars under their key, sub-blocks as nested objects, repeats collected into arrays.
  // `maxDepth` stops the recursion descending into blocks nobody asked for — the pop table alone is
  // 139k records and materialising every leaf of all of them is what exhausts memory.
  function block(depth = 0, maxDepth = 3) {
    const out = {};
    for (;;) {
      const k = item();
      if (!k || k.t === TOK.CLOSE) return out;
      if (k.t === TOK.OPEN) { const sub = block(depth + 1, maxDepth); push(out, '_', sub); continue; }
      if (k.t === TOK.EQ) continue;
      const key = ('v' in k) ? k.v : k.t;                 // token id, int handle, or string
      const nx = item();
      if (!nx) return out;
      if (nx.t === TOK.EQ) {
        const val = item(); if (!val) return out;
        if (val.t === TOK.OPEN) push(out, key, depth + 1 <= maxDepth ? block(depth + 1, maxDepth) : skip());
        else push(out, key, 'v' in val ? val.v : val.t);
      } else if (nx.t === TOK.OPEN) {
        push(out, key, depth + 1 <= maxDepth ? block(depth + 1, maxDepth) : skip());
      } else if (nx.t === TOK.CLOSE) { push(out, key, true); return out; }
      else if ('v' in nx) push(out, key, nx.v);
    }
  }
  function skip() { let d = 1; for (;;) { const i = item(); if (!i) return null; if (i.t === TOK.OPEN) d++; else if (i.t === TOK.CLOSE && --d === 0) return null; } }
  function push(o, k, v) { if (o[k] === undefined) o[k] = v; else if (Array.isArray(o[k])) o[k].push(v); else o[k] = [o[k], v]; }
  return { item, block, skip, at, eof, size, close: () => closeSync(fd) };
}
