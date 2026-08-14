// Scan victoria3.exe around given RVAs for RIP-relative string references (LEA/MOV disp32).
// Usage: node exestrings.mjs <exe> <rva-hex> [<rva-hex> ...]
import { readFileSync } from 'node:fs';

const exePath = process.argv[2];
const rvas = process.argv.slice(3).map(s => parseInt(s, 16));
const buf = readFileSync(exePath);

// PE parse
const e_lfanew = buf.readUInt32LE(0x3c);
const numSections = buf.readUInt16LE(e_lfanew + 6);
const optSize = buf.readUInt16LE(e_lfanew + 20);
const secTable = e_lfanew + 24 + optSize;
const sections = [];
for (let i = 0; i < numSections; i++) {
  const off = secTable + i * 40;
  const name = buf.toString('ascii', off, off + 8).replace(/\0+$/, '');
  const vsize = buf.readUInt32LE(off + 8);
  const vaddr = buf.readUInt32LE(off + 12);
  const rsize = buf.readUInt32LE(off + 16);
  const raw = buf.readUInt32LE(off + 20);
  sections.push({ name, vaddr, vsize, raw, rsize });
}
function rvaToRaw(rva) {
  for (const s of sections) if (rva >= s.vaddr && rva < s.vaddr + s.vsize) return s.raw + (rva - s.vaddr);
  return -1;
}
function sectionOf(rva) {
  for (const s of sections) if (rva >= s.vaddr && rva < s.vaddr + s.vsize) return s.name;
  return '?';
}
function readCStr(rva, max = 200) {
  const raw = rvaToRaw(rva);
  if (raw < 0) return null;
  let out = '';
  for (let i = 0; i < max; i++) {
    const c = buf[raw + i];
    if (c === 0) return out.length >= 4 ? out : null;
    if (c < 9 || (c > 13 && c < 32) || c > 126) return null;
    out += String.fromCharCode(c);
  }
  return out.length >= 4 ? out : null;
}
function readWStr(rva, max = 200) {
  const raw = rvaToRaw(rva);
  if (raw < 0) return null;
  let out = '';
  for (let i = 0; i < max; i++) {
    const c = buf.readUInt16LE(raw + i * 2);
    if (c === 0) return out.length >= 4 ? out : null;
    if (c < 32 || c > 126) return null;
    out += String.fromCharCode(c);
  }
  return out.length >= 4 ? out : null;
}

const WINDOW = 0x2800;
for (const rva of rvas) {
  console.log(`\n===== around RVA +0x${rva.toString(16)} (section ${sectionOf(rva)}) =====`);
  const lo = rva - WINDOW, hi = rva + WINDOW;
  const rawLo = rvaToRaw(lo);
  if (rawLo < 0) { console.log('  not mapped'); continue; }
  const seen = new Set();
  for (let r = lo; r < hi; r++) {
    const raw = rvaToRaw(r);
    if (raw < 0 || raw + 7 > buf.length) continue;
    const b0 = buf[raw], b1 = buf[raw + 1], b2 = buf[raw + 2];
    // REX.W LEA/MOV with RIP-relative operand: 48/4C 8D/8B modrm(mod=00 rm=101)
    if ((b0 === 0x48 || b0 === 0x4c) && (b1 === 0x8d || b1 === 0x8b) && (b2 & 0xc7) === 0x05) {
      const disp = buf.readInt32LE(raw + 3);
      const target = r + 7 + disp;
      if (target < 0 || target > 0xffffffff) continue;
      if (seen.has(target)) continue;
      const sec = sectionOf(target);
      if (sec !== '.rdata' && sec !== '.data') continue;
      const s = readCStr(target) || readWStr(target);
      if (s) { seen.add(target); console.log(`  +0x${r.toString(16)} -> "${s}"`); }
    }
  }
}
