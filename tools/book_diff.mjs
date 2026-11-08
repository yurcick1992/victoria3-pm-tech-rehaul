#!/usr/bin/env node
// tools/book_diff.mjs — the FIELD DIFF of two books (CLAUDE.md §4.4: a canonisation is proven by field diff, only the intended keys move).
//
// Flattens both books to `path = value` lines and prints every path whose value differs, every path only one book has, and a count per
// top-level key. Industries are keyed by id and their rungs by rung key (never by array position), so a rung added or removed shows as its
// own paths rather than shifting every rung after it. Objects are walked to the leaves; arrays of scalars compare as one value.
//
// USAGE: node tools/book_diff.mjs <book A> <book B> [--ignore <key,key>] [--only <key,key>] [--max n] [--json out.json]
//   --ignore drops top-level keys (e.g. the provenance records `_*`: --ignore _); --only keeps only the named top-level keys.
//   Exit code 0 when the books are equal on what was compared, 1 when they differ.

import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [A, B] = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!A || !B) { console.error('usage: node tools/book_diff.mjs <book A> <book B> [--ignore k,k] [--only k,k] [--max n] [--json f]'); process.exit(2); }
const ignore = (opt('--ignore', '') || '').split(',').filter(Boolean);
const only = (opt('--only', '') || '').split(',').filter(Boolean);
const MAX = +opt('--max', 400);
const read = f => JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));
const keep = k => (!only.length || only.includes(k)) && !ignore.some(x => x === '_' ? k.startsWith('_') : x === k);

function flatten(v, path, out) {
  if (Array.isArray(v)) {
    if (v.every(x => x === null || typeof x !== 'object')) { out.set(path, JSON.stringify(v)); return; }
    // arrays of objects: key by a stable id where one exists and is unique in the array (industries by id, rungs by key), else by position
    const idOf = x => x && typeof x === 'object' ? (x.id ?? x.key ?? x.name ?? null) : null;
    const ids = v.map(idOf);
    const unique = ids.every(x => x != null) && new Set(ids).size === ids.length;
    v.forEach((x, i) => flatten(x, `${path}[${unique ? ids[i] : i}]`, out));
    return;
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v);
    if (!ks.length) { out.set(path, '{}'); return; }
    for (const k of ks) flatten(v[k], path ? `${path}.${k}` : k, out);
    return;
  }
  out.set(path, JSON.stringify(v));
}

const fa = new Map(), fb = new Map();
const ba = read(A), bb = read(B);
for (const k of Object.keys(ba)) if (keep(k)) flatten(ba[k], k, fa);
for (const k of Object.keys(bb)) if (keep(k)) flatten(bb[k], k, fb);

const changed = [], onlyA = [], onlyB = [];
for (const [p, v] of fa) { if (!fb.has(p)) onlyA.push([p, v]); else if (fb.get(p) !== v) changed.push([p, v, fb.get(p)]); }
for (const [p, v] of fb) if (!fa.has(p)) onlyB.push([p, v]);
const top = p => p.split(/[.[]/)[0];
const perTop = {};
for (const [p] of [...changed, ...onlyA, ...onlyB]) perTop[top(p)] = (perTop[top(p)] || 0) + 1;

console.log(`book diff: ${A}  →  ${B}`);
console.log(`  ${fa.size} / ${fb.size} leaf paths compared${ignore.length ? ` (ignored: ${ignore.join(', ')})` : ''}${only.length ? ` (only: ${only.join(', ')})` : ''}`);
console.log(`  changed ${changed.length} · only in A ${onlyA.length} · only in B ${onlyB.length}`);
for (const [k, n] of Object.entries(perTop).sort((a, b) => b[1] - a[1])) console.log(`    ${k}: ${n}`);
const show = (title, rows, fmt) => {
  if (!rows.length) return;
  console.log(`\n${title} (${rows.length}${rows.length > MAX ? `, first ${MAX}` : ''}):`);
  for (const r of rows.slice(0, MAX)) console.log('  ' + fmt(r));
};
show('CHANGED', changed, ([p, a, b]) => `${p}: ${a} → ${b}`);
show('ONLY IN A', onlyA, ([p, v]) => `${p} = ${v}`);
show('ONLY IN B', onlyB, ([p, v]) => `${p} = ${v}`);
const json = opt('--json', null);
if (json) writeFileSync(json, JSON.stringify({ A, B, changed, onlyA, onlyB, perTop }, null, 1));
process.exit(changed.length + onlyA.length + onlyB.length ? 1 : 0);
