// save_pops.mjs — extract the POP TABLE from a gamestate, and identify its numeric fields against a
// quantity we can predict independently.
//
//   node tools/testbed/save_pops.mjs <file.gamestate> [--tsv out.tsv]
//
// ⭐ WHY THIS IS THE POINT OF THE SAVE EXERCISE. Every question that stalled stalled on per-pop or
// per-state detail the log could not carry: the wealth distribution behind the need budgets (which
// forced the leisure and communication ratios to be SWEPT rather than measured), per-pop consumption,
// and per-state supply of a `local` good. The channel split drops ~40 % of goods per dump and keeps
// `transportation` and `automobiles` in disjoint eras. The save has every pop, exactly, at one instant.
//
// THE RECORD, as read by lib_savebin:
//     <pop id> = { 0x00e1 = "<profession>"  0x2fd5 = <int>  0x573a = <int>  0x2819 = <int>
//                  0x5afb = { 0x5afa = { … } }        small nested map
//                  0x5f73 = { <handle> = <int> … }    large keyed map — bare-int keys
//                  0x27dd = <int>  0x330b = <int>  0x27e3 = "<religion>" … }
//
// ⚠ FIELD NAMES ARE NOT IN THE SAVE. Every column is named by TOKEN and any semantic label is a
// HYPOTHESIS until something independent confirms it. The check here is world population: the true
// pop-size field, summed over every pop, must land near 1.5–2 bn for 1925. Do not promote a hypothesis
// to a name without recording what confirmed it.
import { existsSync, writeFileSync } from 'node:fs';
import { createReader, TOK } from './lib_savebin.mjs';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TSV = argOf('--tsv', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: save_pops.mjs <file.gamestate> [--tsv f]'); process.exit(1); }

const POPTYPES = new Set(['laborers','farmers','machinists','clerks','shopkeepers','engineers','clergymen',
  'bureaucrats','academics','officers','aristocrats','capitalists','peasants','slaves','soldiers','servicemen']);
const T_TYPE = 0x00e1, T_REL = 0x27e3, T_TAG = 0x07dd;
const SCALARS = [0x2fd5, 0x573a, 0x2819, 0x27dd, 0x330b, 0x5556, 0x5559, 0x5360, 0x535f];

// ⭐ THE COUNTRY TABLE RIDES ALONG, and not for convenience: a pop carries its owner as an INDEX
// (0x27dd, 0–316), so the pop table is unlabelled without it and every per-market question is
// unanswerable. It is one streaming pass over 259 MB either way. Country records are
// `<index> = { 0x07dd = "GBR" … }` — recognised by the tag, keyed by the container key.
const rd = createReader(SRC);
const pops = [];
const tags = new Map();                          // country index -> tag
// Walk the token stream; whenever a '{' opens, parse that block shallowly and keep it only if it looks
// like a pop record (has the profession token with a known profession string).
// ⚠⚠ STACK-BASED, NOT RECURSIVE-WITH-A-DEPTH-LIMIT. Two earlier attempts returned ZERO records and
// neither errored:
//   1. a flat "remember the last name token" reader mis-assigned scalars as soon as a nested map
//      appeared — and pop records contain one (`0x5f73`) whose keys are BARE INTEGERS, indistinguishable
//      from values to such a reader;
//   2. a recursive reader with maxDepth: the FIRST '{' in the file is the outermost gamestate block, so
//      one call swallowed the entire file and the depth limit skipped every pop record inside it.
// Both failed silently, which is the failure mode this project keeps paying for. A stack that mirrors
// the braces cannot lose its place: every '{' pushes a frame, every '}' pops one and is inspected.
// Depth stays ≤ 6 and only completed records are retained, so 259 MB streams in bounded memory.
const stack = [];
let pendingKey = null;
while (!rd.eof()) {
  const it = rd.item();
  if (!it) break;
  if (it.t === TOK.OPEN) { stack.push({ key: pendingKey, obj: {} }); pendingKey = null; continue; }
  if (it.t === TOK.CLOSE) {
    const fr = stack.pop(); if (!fr) continue;
    const ty = fr.obj[T_TYPE];
    if (typeof ty === 'string' && POPTYPES.has(ty)) {
      const rec = { type: ty, religion: typeof fr.obj[T_REL] === 'string' ? fr.obj[T_REL] : '' };
      for (const f of SCALARS) if (typeof fr.obj[f] === 'number') rec[f] = fr.obj[f];
      pops.push(rec);
    }
    const tag = fr.obj[T_TAG];
    if (typeof tag === 'string' && /^[A-Z]{3}$/.test(tag) && typeof fr.key === 'number') tags.set(fr.key, tag);
    continue;                                   // the frame is dropped here — nothing accumulates
  }
  if (it.t === TOK.EQ) continue;
  const val = ('v' in it) ? it.v : null;
  if (val === null) { pendingKey = it.t; continue; }        // a name token: it is the next key
  const top = stack[stack.length - 1];
  if (pendingKey !== null && top) { if (top.obj[pendingKey] === undefined) top.obj[pendingKey] = val; pendingKey = null; }
  else pendingKey = val;                                    // a bare scalar acting as the next key
}
rd.close();

console.log(`pops parsed : ${pops.length.toLocaleString()}`);
const sum = f => pops.reduce((a, p) => a + (p[f] || 0), 0);
const cnt = f => pops.filter(p => p[f] !== undefined).length;
console.log(`\nWHICH FIELD IS POP SIZE?  summed over every pop, against ~1.5–2 bn world population in 1925`);
for (const f of SCALARS) {
  const s = sum(f), n = cnt(f); if (!n) continue;
  const flag = s > 5e8 && s < 4e9 ? '   <-- PLAUSIBLE as pop size' : '';
  console.log(`  0x${f.toString(16).padStart(4,'0')}  sum ${s.toLocaleString().padStart(18)}  on ${n.toLocaleString().padStart(9)} pops${flag}`);
}
const byType = new Map(); for (const p of pops) byType.set(p.type, (byType.get(p.type)||0)+1);
console.log(`\nRECORDS BY PROFESSION`);
console.log('  ' + [...byType.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v.toLocaleString()}`).join('  '));

console.log(`\nCOUNTRY TABLE: ${tags.size} tags`);
console.log('  ' + [...tags.entries()].sort((a,b)=>a[0]-b[0]).slice(0,14).map(([i,t])=>`${i}=${t}`).join('  ') + ' …');

if (TSV) {
  // ⚠ The columns are named by TOKEN, not by meaning, wherever meaning is still a hypothesis. Confirmed
  // so far: 0x573a size, 0x5556 wealth level, 0x2fd5 workforce, 0x27dd country index. See save_summary.
  const cols = ['type','religion','tag', ...SCALARS.map(f=>'0x'+f.toString(16).padStart(4,'0'))];
  const rows = [cols.join('\t')];
  for (const p of pops) rows.push([p.type, p.religion, tags.get(p[0x27dd]) ?? '', ...SCALARS.map(f=>p[f]??'')].join('\t'));
  writeFileSync(TSV, rows.join('\n'));
  const CSV = TSV.replace(/\.tsv$/, '') + '.countries.tsv';
  writeFileSync(CSV, ['idx\ttag', ...[...tags.entries()].sort((a,b)=>a[0]-b[0]).map(([i,t])=>`${i}\t${t}`)].join('\n'));
  console.log(`\nwrote ${pops.length.toLocaleString()} rows -> ${TSV}`);
  console.log(`wrote ${tags.size} tags -> ${CSV}`);
}
