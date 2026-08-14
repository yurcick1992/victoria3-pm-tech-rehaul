// Minimal minidump parser: extract exception thread's stack, map qwords to victoria3.exe offsets,
// and report the repeating recursion cycle. Usage: node dumpstack.mjs <minidump.dmp>
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const buf = readFileSync(file);

// --- header ---
if (buf.readUInt32LE(0) !== 0x504d444d) throw new Error('not MDMP');
const numStreams = buf.readUInt32LE(8);
const dirRva = buf.readUInt32LE(12);

const streams = {};
for (let i = 0; i < numStreams; i++) {
  const off = dirRva + i * 12;
  const type = buf.readUInt32LE(off);
  const size = buf.readUInt32LE(off + 4);
  const rva = buf.readUInt32LE(off + 8);
  streams[type] = { size, rva };
}

// --- module list (type 4) ---
const ml = streams[4];
if (!ml) throw new Error('no module list');
const modCount = buf.readUInt32LE(ml.rva);
const mods = [];
for (let i = 0; i < modCount; i++) {
  const off = ml.rva + 4 + i * 108; // MINIDUMP_MODULE is 108 bytes
  const base = buf.readBigUInt64LE(off);
  const size = buf.readUInt32LE(off + 8);
  const nameRva = buf.readUInt32LE(off + 20);
  const nameLen = buf.readUInt32LE(nameRva);
  const name = buf.toString('utf16le', nameRva + 4, nameRva + 4 + nameLen);
  mods.push({ base, size, name });
}
const exe = mods.find(m => /victoria3\.exe$/i.test(m.name));
if (!exe) throw new Error('victoria3.exe not in module list');

// --- exception stream (type 6) ---
const ex = streams[6];
if (!ex) throw new Error('no exception stream');
const exThreadId = buf.readUInt32LE(ex.rva);
const exCode = buf.readUInt32LE(ex.rva + 8);
const exAddr = buf.readBigUInt64LE(ex.rva + 8 + 8 + 8); // ExceptionRecord.ExceptionAddress
// thread context of exception: MINIDUMP_LOCATION_DESCRIPTOR after ExceptionRecord (size 152 incl align)
const ctxSize = buf.readUInt32LE(ex.rva + 4 + 4 + 152);
const ctxRva = buf.readUInt32LE(ex.rva + 4 + 4 + 152 + 4);
// x64 CONTEXT: Rsp at offset 0x98, Rip at 0xF8
const rsp = buf.readBigUInt64LE(ctxRva + 0x98);
const rip = buf.readBigUInt64LE(ctxRva + 0xf8);

// --- thread list (type 3): find the exception thread's stack descriptor ---
const tl = streams[3];
const tCount = buf.readUInt32LE(tl.rva);
let stackDesc = null;
for (let i = 0; i < tCount; i++) {
  const off = tl.rva + 4 + i * 48; // MINIDUMP_THREAD is 48 bytes
  const tid = buf.readUInt32LE(off);
  if (tid === exThreadId) {
    const startAddr = buf.readBigUInt64LE(off + 24); // Stack.StartOfMemoryRange
    const memSize = buf.readUInt32LE(off + 32); // Stack.Memory.DataSize
    const memRva = buf.readUInt32LE(off + 36); // Stack.Memory.Rva
    stackDesc = { startAddr, memSize, memRva };
  }
}
if (!stackDesc) throw new Error('exception thread not found in thread list');

const exeBase = exe.base, exeEnd = exe.base + BigInt(exe.size);
console.log('streams present: ' + Object.keys(streams).join(','));

// --- look for the faulting-context stack in the memory lists ---
// MemoryListStream (5): MINIDUMP_MEMORY_DESCRIPTOR { StartOfMemoryRange u64, DataSize u32, Rva u32 }
// Memory64ListStream (9): { NumberOfMemoryRanges u64, BaseRva u64, [ { Start u64, Size u64 } ] } data packed sequentially
const regions = [];
if (streams[5]) {
  const n = buf.readUInt32LE(streams[5].rva);
  for (let i = 0; i < n; i++) {
    const off = streams[5].rva + 4 + i * 16;
    regions.push({ start: buf.readBigUInt64LE(off), size: BigInt(buf.readUInt32LE(off + 8)), rva: BigInt(buf.readUInt32LE(off + 12)) });
  }
}
if (streams[9]) {
  const n = Number(buf.readBigUInt64LE(streams[9].rva));
  let dataRva = buf.readBigUInt64LE(streams[9].rva + 8);
  for (let i = 0; i < n; i++) {
    const off = streams[9].rva + 16 + i * 16;
    const start = buf.readBigUInt64LE(off);
    const size = buf.readBigUInt64LE(off + 8);
    regions.push({ start, size, rva: dataRva });
    dataRva += size;
  }
}
console.log(`memory regions listed: ${regions.length}`);
// find regions covering [rsp, rsp + 4MB)
const hits = regions.filter(r => r.start <= rsp + 0x400000n && (r.start + r.size) > rsp);
console.log(`regions overlapping rsp..rsp+4MB: ${hits.length}`);
for (const r of hits.slice(0, 10)) console.log(`  region start=0x${r.start.toString(16)} size=0x${r.size.toString(16)}`);
if (hits.length) {
  // scan from rsp upward within these regions, in address order
  hits.sort((a, b) => (a.start < b.start ? -1 : 1));
  const offs2 = [];
  for (const r of hits) {
    const lo = rsp > r.start ? rsp : r.start;
    const hi = r.start + r.size;
    for (let a = lo & ~7n; a + 8n <= hi && offs2.length < 200000; a += 8n) {
      const frva = Number(r.rva + (a - r.start));
      if (frva + 8 > buf.length) break;
      const v = buf.readBigUInt64LE(frva);
      if (v >= exeBase && v < exeEnd) offs2.push(Number(v - exeBase));
    }
  }
  console.log(`in-module qwords above rsp: ${offs2.length}`);
  const freq2 = new Map();
  for (const o of offs2) freq2.set(o, (freq2.get(o) || 0) + 1);
  const top2 = [...freq2.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log('top repeated offsets above rsp (offset,count):');
  for (const [o, c] of top2) console.log(`  +0x${o.toString(16)}  x${c}`);
  const seq2 = offs2.slice(0, 6000);
  for (let p = 1; p <= 96; p++) {
    let match = 0, totalCmp = 0;
    for (let i = 0; i + p < seq2.length; i++) { totalCmp++; if (seq2[i] === seq2[i + p]) match++; }
    if (totalCmp && match / totalCmp > 0.9) {
      console.log(`RECURSION CYCLE period ${p} (${(100 * match / totalCmp).toFixed(1)}%): ` + seq2.slice(0, p).map(o => '+0x' + o.toString(16)).join(' '));
      break;
    }
  }
}
console.log(`file: ${file}`);
console.log(`exe: base=0x${exeBase.toString(16)} size=0x${exe.size.toString(16)}`);
console.log(`exception: code=0x${exCode.toString(16)} thread=${exThreadId} addr_off=+0x${(exAddr - exeBase).toString(16)} rip_off=+0x${(rip - exeBase).toString(16)}`);
console.log(`stack: start=0x${stackDesc.startAddr.toString(16)} captured=${stackDesc.memSize} bytes (rsp=0x${rsp.toString(16)})`);

// --- walk the captured stack, collect victoria3.exe offsets in order (low addr = most recent) ---
const offs = [];
for (let o = 0; o + 8 <= stackDesc.memSize; o += 8) {
  const v = buf.readBigUInt64LE(stackDesc.memRva + o);
  if (v >= exeBase && v < exeEnd) offs.push(Number(v - exeBase));
}
console.log(`in-module qwords on stack: ${offs.length}`);

// --- frequency table ---
const freq = new Map();
for (const o of offs) freq.set(o, (freq.get(o) || 0) + 1);
const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
console.log('top repeated offsets (offset,count):');
for (const [o, c] of top) console.log(`  +0x${o.toString(16)}  x${c}`);

// --- detect the repeating cycle near the top of the stack ---
// take first 4000 in-module offsets and find smallest period p (2..64) such that seq[i]==seq[i+p] for most i
const seq = offs.slice(0, 4000);
let best = null;
for (let p = 1; p <= 64; p++) {
  let match = 0, totalCmp = 0;
  for (let i = 0; i + p < seq.length; i++) { totalCmp++; if (seq[i] === seq[i + p]) match++; }
  const rate = match / totalCmp;
  if (rate > 0.9) { best = { p, rate }; break; }
}
if (best) {
  console.log(`recursion cycle period: ${best.p} (match rate ${(best.rate * 100).toFixed(1)}%)`);
  console.log('one cycle (offsets in stack order):');
  console.log('  ' + seq.slice(0, best.p).map(o => '+0x' + o.toString(16)).join(' '));
} else {
  console.log('no dominant cycle detected in first 4000 in-module qwords');
  console.log('first 40 offsets: ' + seq.slice(0, 40).map(o => '+0x' + o.toString(16)).join(' '));
}
