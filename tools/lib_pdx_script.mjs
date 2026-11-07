// tools/lib_pdx_script.mjs — a small parser for Paradox script (Victoria 3's common/, events/, map_data/ files), shared by game_diff.mjs and
// lint_vanilla_names.mjs.
//
// parse(src) → statements: { k, op, v, ln } for `key op value`, { v, ln } for a bare value or an anonymous block. A value is { s } (a word or a
// quoted string, quotes kept), { b: [statements] } (a block), or { w, b } (a word directly followed by a block: `rgb { … }`). `ln` is the
// 1-based line of the statement's first token. Comments run from # to the end of the line outside quotes. A BOM is stripped. Throws on an
// unclosed or unexpected brace, with the line.
// flatten(v, path, out) → `path = value` lines: repeated keys get #2, #3 …; the bare values of a block are one order-free set.

export const stripBom = s => s.replace(/^﻿/, '');

export function tokenize(src) {
  const t = [], L = []; let i = 0, line = 1; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '{' || c === '}') { t.push(c); L.push(line); i++; continue; }
    if (c === '"') {
      let j = i + 1; while (j < n && src[j] !== '"') { if (src[j] === '\\') j++; j++; }
      const s = src.slice(i, j + 1); t.push(s); L.push(line); for (const ch of s) if (ch === '\n') line++; i = j + 1; continue;
    }
    if ('=<>!?'.includes(c)) { let j = i + 1; while (j < n && '=<>'.includes(src[j])) j++; t.push(src.slice(i, j)); L.push(line); i = j; continue; }
    let j = i; while (j < n && !' \t\r\n{}#="<>!?'.includes(src[j])) j++;
    if (j === i) j++;
    t.push(src.slice(i, j)); L.push(line); i = j;
  }
  return { t, L };
}

const isOp = s => /^(=|==|<|>|<=|>=|!=|\?=)$/.test(s);

export function parse(src) {
  const { t, L } = tokenize(stripBom(src)); let p = 0;
  const err = m => new Error(`${m} (line ${L[Math.min(p, L.length - 1)] ?? 0})`);
  function block() {
    const out = [];
    while (p < t.length && t[p] !== '}') out.push(statement());
    if (t[p] !== '}') throw err('unclosed {');
    p++; return out;
  }
  function value() {
    const ln = L[p];
    if (t[p] === '{') { p++; return { b: block(), ln }; }
    const w = t[p++];
    if (w === undefined) throw err('missing value');
    if (t[p] === '{' && /^[A-Za-z_]+$/.test(w)) { p++; return { w, b: block(), ln }; }
    return { s: w, ln };
  }
  function statement() {
    const ln = L[p];
    if (t[p] === '{') { p++; return { v: { b: block(), ln }, ln }; }
    if (t[p] === '}') throw err('unexpected }');
    const k = t[p++];
    if (isOp(t[p] ?? '')) { const op = t[p++]; return { k, op, v: value(), ln }; }
    return { v: { s: k, ln }, ln };
  }
  const out = [];
  while (p < t.length) { if (t[p] === '}') throw err('unexpected } at top level'); out.push(statement()); }
  return out;
}

export function flatten(v, path, out) {
  if (v.s !== undefined) { out.push(`${path} = ${v.s}`); return; }
  if (v.w) path += `(${v.w})`;
  const seen = {}; const bare = [];
  for (const st of v.b) {
    if (st.k === undefined) { if (st.v.s !== undefined) bare.push(st.v.s); else flatten(st.v, path + '.{}', out); continue; }
    const n = (seen[st.k] = (seen[st.k] || 0) + 1);
    const key = n > 1 ? `${st.k}#${n}` : st.k;
    const p2 = path ? `${path}.${key}` : key;
    if (st.op !== '=') { if (st.v.s !== undefined) out.push(`${p2} ${st.op} ${st.v.s}`); else flatten(st.v, `${p2}${st.op}`, out); }
    else flatten(st.v, p2, out);
  }
  if (bare.length) out.push(`${path || '.'}[] = ${[...bare].sort().join(' ')}`);
  if (!v.b.length) out.push(`${path || '.'} = {}`);
}

// Every identifier-like run (letters, digits, underscore; 5–100 long) in a binary: the engine's registered names (triggers, effects, event
// targets, modifier types, data functions, defines) sit in the executable's string table.
export function exeIdentifiers(buf) {
  const set = new Set(); let s = -1;
  for (let i = 0; i <= buf.length; i++) {
    const c = i < buf.length ? buf[i] : 0;
    const ok = (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95;
    if (ok) { if (s < 0) s = i; }
    else if (s >= 0) { if (i - s >= 3 && i - s <= 100) set.add(buf.toString('latin1', s, i)); s = -1; }
  }
  return set;
}
