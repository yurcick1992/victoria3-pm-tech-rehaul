#!/usr/bin/env node
// tools/game_diff.mjs — the ENTITY DIFF of two Victoria 3 game versions: the intake of the game-update skill (phase 1).
//
// A text diff of thousands of files buries a change as large as a new good (one block in 00_goods.txt among thousands of changed lines). This
// reads both game trees as databases and prints, in this order:
//   1. the count of entities per database, old → new (the databases that changed only);
//   2. every NEW entity, by database, the ones the mod reads first (goods, buildings, methods, technologies …), each with the entities of the
//      new version that name it (a new building with its methods' groups and the technologies, journal entries and events that refer to it);
//      a new good in full, every method that makes or uses it and every other entity that names it;
//   3. every REMOVED entity, a removal and an addition with near-identical content paired as a RENAME;
//   4. CHANGED fields of entities in both versions, with old and new values (the read databases first);
//   5. ORDER changes the save readers depend on (goods by position, the pop types' sorted file names, the interest groups);
//   6. the ENGINE VOCABULARY: identifier strings in the two executables (triggers, effects, modifier types, defines), and the script_docs logs where
//      both versions have them;
//   7. every other changed file (localization, gui, csv, files that did not parse), with its changed line counts.
// Every section says "none" when it is empty, and every file it could not parse is listed (section 7).
//
// USAGE: node tools/game_diff.mjs <old game dir> <new game dir> [--out <file>] [--only <db,...>] [--old-exe <exe>] [--new-exe <exe>]
//        [--old-docs <dir>] [--new-docs <dir>] [--max <n>]
//   <game dir> is the folder holding common/, events/, map_data/ (Steam: …/Victoria 3/game; the 1.13.11 copy: C:\claude-code\vic3_game_1.13.11\game).
//   The executables default to <game dir>/../binaries/victoria3.exe, the docs to <game dir>/../docs, each read only if it exists in both.
//   --only restricts sections 1–5 to the named databases (e.g. goods,production_methods) and skips 6–7. --max caps the lines per list (default 400).
// Refs: ON_GAME_UPDATE.md §1 and §5, GAME_UPDATE_1_15.md U03, the game-update skill.

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, basename, sep } from 'node:path';
import { parse, flatten, stripBom, exeIdentifiers } from './lib_pdx_script.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const POS = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (POS.length < 2) { console.error('usage: node tools/game_diff.mjs <old game dir> <new game dir> [--out <file>] [--only <db,...>] [--max <n>]'); process.exit(2); }
const [OLD, NEW] = POS.map(p => resolve(p));
for (const r of [OLD, NEW]) if (!existsSync(join(r, 'common'))) { console.error(`not a game dir (no common/): ${r}`); process.exit(2); }
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const MAX = +opt('--max', 400);
const OUT = [];
const say = (s = '') => OUT.push(s);

// ---------- the databases ----------
const strip = s => s.replace(/^\uFEFF/, '');
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}
const rel = (root, p) => relative(root, p).split(sep).join('/');
// A database is a script file's folder (common/<…>, events, map_data/state_regions); a file directly in common/ is its own.
function dbOf(r) {
  if (r.startsWith('events/')) return 'events';
  if (r.startsWith('map_data/state_regions/')) return 'state_regions';
  if (r.startsWith('common/')) { const parts = r.split('/'); return parts.length === 2 ? parts[1].replace(/\.txt$/, '') : parts.slice(1, -1).join('/'); }
  return null;
}
// The order of sections 2–4: what the mod reads (ON_GAME_UPDATE §2) first, the rest alphabetically.
const FIRST = ['goods', 'buildings', 'production_methods', 'production_method_groups', 'technology/technologies', 'technology/eras',
  'building_groups', 'pop_types', 'laws', 'law_groups', 'modifier_type_definitions', 'state_regions', 'defines', 'script_values', 'on_actions',
  'combat_unit_types', 'ship_types', 'company_types', 'company_charter_types', 'journal_entries', 'decisions', 'static_modifiers', 'state_traits',
  'ai_strategies', 'pop_needs', 'buy_packages', 'interest_groups', 'country_definitions', 'history/buildings', 'history/pops', 'history/states',
  'history/countries', 'power_bloc_principles', 'scripted_triggers', 'scripted_effects', 'scripted_progress_bars', 'strategic_regions',
  'country_ranks', 'subject_types', 'institutions', 'events'];
const dbRank = d => { const i = FIRST.indexOf(d); return i >= 0 ? i : FIRST.length; };
const dbSort = (a, b) => dbRank(a) - dbRank(b) || a.localeCompare(b);

function loadTree(root) {
  const files = [...walk(join(root, 'common')), ...walk(join(root, 'events')), ...walk(join(root, 'map_data', 'state_regions'))]
    .filter(p => p.endsWith('.txt')).sort();
  const db = {}; const failed = []; const goodsOrder = []; const popTypeFiles = []; const igFiles = [];
  for (const p of files) {
    const r = rel(root, p); const d = dbOf(r); if (!d) continue;
    if (ONLY && !ONLY.has(d)) continue;
    let tree;
    try { tree = parse(strip(readFileSync(p, 'utf8'))); } catch (e) { failed.push(`${r}: ${e.message}`); continue; }
    const D = (db[d] ??= {});
    let stmts = tree;
    // A history file wraps everything in one CAPS key (BUILDINGS = { s:STATE_X = { … } }): its entities are one level down.
    if (d.startsWith('history/') && tree.length === 1 && tree[0].k && /^[A-Z_]+$/.test(tree[0].k) && tree[0].v.b) stmts = tree[0].v.b.map(s => ({ ...s, k: s.k && `${tree[0].k}/${s.k}` }));
    for (const st of stmts) {
      if (st.k === undefined) continue;
      if (d === 'defines' && st.v.b) { // NAI = { KEY = value }: one entity per define
        for (const s2 of st.v.b) if (s2.k) { const lines = []; flatten(s2.v, '', lines); put(D, `${st.k}.${s2.k}`, r, lines); }
        continue;
      }
      if (d === 'events' && st.k === 'namespace') continue;
      const lines = []; flatten(st.v, '', lines);
      put(D, st.k, r, lines);
      if (d === 'goods') goodsOrder.push(st.k);
    }
    if (d === 'pop_types') popTypeFiles.push(basename(p));
    if (d === 'interest_groups') igFiles.push(basename(p));
  }
  return { db, failed, goodsOrder, popTypeFiles: popTypeFiles.sort(), igFiles: igFiles.sort() };
}
// Two entities of one key in one database (load order decides in the game) are both kept, the later one's key marked with its file.
function put(D, k, file, lines) {
  if (D[k]) { k = `${k} @${file}`; }
  D[k] = { file, lines };
}

// ---------- 1–5 ----------
const A = loadTree(OLD), B = loadTree(NEW);
const dbs = [...new Set([...Object.keys(A.db), ...Object.keys(B.db)])].sort(dbSort);
const cap = (arr, f = x => x) => { const out = arr.slice(0, MAX).map(f); if (arr.length > MAX) out.push(`… ${arr.length - MAX} more`); return out; };
const jacc = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

say(`# Game diff: ${OLD}  →  ${NEW}`);
say(`(${new Date().toISOString().slice(0, 16)}Z${ONLY ? `; only ${[...ONLY].join(', ')}` : ''})`);
say();
say('## 1. Entities per database (changed counts only)');
let any = false;
for (const d of dbs) {
  const a = Object.keys(A.db[d] || {}).length, b = Object.keys(B.db[d] || {}).length;
  if (a !== b) { say(`- ${d}: ${a} → ${b} (${b - a > 0 ? '+' : ''}${b - a})`); any = true; }
}
if (!any) say('- none: every database has the same number of entities');
say();

const added = {}, removed = {}, renamed = {};
for (const d of dbs) {
  const a = A.db[d] || {}, b = B.db[d] || {};
  const add = Object.keys(b).filter(k => !(k in a)), rem = Object.keys(a).filter(k => !(k in b));
  // Pair a removal with its most similar addition (≥ 0.8 of their path = value lines shared) as a rename.
  const used = new Set(); const pairs = [];
  for (const k of rem) {
    let best = null, bs = 0.8;
    for (const k2 of add) { if (used.has(k2)) continue; const s = jacc(a[k].lines, b[k2].lines); if (s >= bs) { best = k2; bs = s; } }
    if (best) { used.add(best); pairs.push([k, best, bs]); }
  }
  added[d] = add.filter(k => !used.has(k)); removed[d] = rem.filter(k => !pairs.some(p => p[0] === k)); renamed[d] = pairs;
}

say('## 2. New entities');
any = false;
// Who names each new entity in the new version: an index of every name-like token of every entity (a dotted run and its pieces, so an event
// id `ns.12` and a path segment both match), built once.
let NAMED = null;
function namedBy(key) {
  if (!NAMED) {
    NAMED = new Map();
    for (const d of Object.keys(B.db)) for (const [k, e] of Object.entries(B.db[d])) {
      const toks = new Set();
      for (const l of e.lines) for (const run of l.match(/[A-Za-z0-9_.\-]+/g) || []) { toks.add(run); if (run.includes('.')) for (const p of run.split('.')) toks.add(p); }
      for (const t of toks) { let s = NAMED.get(t); if (!s) NAMED.set(t, (s = [])); s.push(`${d}: ${k}`); }
    }
  }
  return NAMED.get(key) || [];
}
const INLINE = 10;
for (const d of dbs) {
  if (!added[d].length) continue; any = true;
  say(`### ${d} (+${added[d].length})`);
  if (d === 'goods') { for (const g of added[d]) { say(`- ${g}  (${B.db[d][g].file})`); usersOf(g.split(' @')[0]); } continue; }
  for (const l of cap(added[d], k => {
    const refs = namedBy(k.split(' @')[0]).filter(r => r !== `${d}: ${k}`);
    const tail = refs.length ? ` — named by ${refs.length}: ${refs.slice(0, INLINE).join('; ')}${refs.length > INLINE ? ` … (+${refs.length - INLINE})` : ''}` : ' — named by nothing';
    return `- ${k}  (${B.db[d][k].file})${tail}`;
  })) say(l);
}
if (!any) say('- none');
say();

// Every method that makes or uses a new good, and every other entity that names it.
function usersOf(g) {
  say(`#### who makes, uses or names the new good \`${g}\``);
  const re = new RegExp(`(^|[^a-z0-9_])${g}([^a-z0-9_]|$)`);
  const io = new RegExp(`goods_(input|output)_${g}_(add|mult)`);
  const methods = [], others = [];
  for (const d of Object.keys(B.db).sort(dbSort)) for (const [k, e] of Object.entries(B.db[d])) {
    if (d === 'goods' && k === g) continue;
    const hits = e.lines.filter(l => io.test(l));
    if (hits.length) methods.push(`- ${d}: ${k}  ${hits.map(l => l.replace(/^.*\.(goods_(input|output)_[a-z0-9_]+) = /, '$1 = ')).join(', ')}`);
    else if (re.test(k) || e.lines.some(l => re.test(l))) others.push(`- ${d}: ${k}`);
  }
  say(methods.length ? `makers and users (${methods.length}):` : 'makers and users: none');
  for (const l of cap(methods)) say(l);
  say(others.length ? `named by (${others.length}):` : 'named by: nothing else');
  for (const l of cap(others)) say(l);
}

say('## 3. Removed and renamed entities');
any = false;
for (const d of dbs) {
  if (!removed[d].length && !renamed[d].length) continue; any = true;
  say(`### ${d} (−${removed[d].length}, renamed ${renamed[d].length})`);
  for (const [o, n, s] of renamed[d]) say(`- RENAMED ${o} → ${n}  (${Math.round(s * 100)}% of its lines unchanged)`);
  for (const l of cap(removed[d], k => `- removed ${k}  (${A.db[d][k].file})`)) say(l);
}
if (!any) say('- none');
say();

say('## 4. Changed entities');
any = false;
for (const d of dbs) {
  const a = A.db[d] || {}, b = B.db[d] || {};
  const pairs = Object.keys(a).filter(k => k in b).map(k => [k, k]).concat(renamed[d].map(([o, n]) => [o, n]));
  const blocks = [];
  for (const [ko, kn] of pairs) {
    const L1 = a[ko].lines, L2 = b[kn].lines;
    const S1 = new Set(L1), S2 = new Set(L2);
    const gone = L1.filter(l => !S2.has(l)), come = L2.filter(l => !S1.has(l));
    if (!gone.length && !come.length && a[ko].file === b[kn].file) continue;
    // Pair a vanished line with an arrived line of the same path as a changed value.
    const pathOf = l => l.replace(/ (=|==|<|>|<=|>=|!=|\?=) .*$/, '');
    const out = []; const usedC = new Set();
    for (const g of gone) {
      const j = come.findIndex((c, i) => !usedC.has(i) && pathOf(c) === pathOf(g));
      if (j >= 0) { usedC.add(j); out.push(`    ${pathOf(g)}: ${g.slice(pathOf(g).length).replace(/^ \S+ /, '')} → ${come[j].slice(pathOf(come[j]).length).replace(/^ \S+ /, '')}`); }
      else out.push(`    − ${g}`);
    }
    come.forEach((c, i) => { if (!usedC.has(i)) out.push(`    + ${c}`); });
    if (a[ko].file !== b[kn].file) out.unshift(`    moved: ${a[ko].file} → ${b[kn].file}`);
    blocks.push([ko === kn ? ko : `${ko} → ${kn}`, out]);
  }
  if (!blocks.length) continue; any = true;
  say(`### ${d} (${blocks.length} changed)`);
  for (const [k, out] of blocks.slice(0, MAX)) { say(`- ${k}`); for (const l of out.slice(0, 40)) say(l); if (out.length > 40) say(`    … ${out.length - 40} more lines`); }
  if (blocks.length > MAX) say(`… ${blocks.length - MAX} more entities`);
}
if (!any) say('- none');
say();

say('## 5. Order the save readers depend on');
const ord = (name, x, y) => {
  if (JSON.stringify(x) === JSON.stringify(y)) { say(`- ${name}: unchanged (${x.length})`); return; }
  say(`- ${name}: CHANGED, ${x.length} → ${y.length}`);
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) { say(`    from index ${i}: ${x.slice(i, i + 6).join(' ')} … → ${y.slice(i, i + 6).join(' ')} …`); break; }
};
if (!ONLY || ONLY.has('goods')) ord('goods (a save keys them by position)', A.goodsOrder, B.goodsOrder);
if (!ONLY || ONLY.has('pop_types')) ord('pop types (sorted file names)', A.popTypeFiles, B.popTypeFiles);
if (!ONLY || ONLY.has('interest_groups')) ord('interest groups (sorted file names; the summariser needs 8)', A.igFiles, B.igFiles);
say();

// ---------- 6. the engine vocabulary ----------
if (!ONLY) {
  say('## 6. Engine vocabulary');
  const exeOld = opt('--old-exe', join(OLD, '..', 'binaries', 'victoria3.exe')), exeNew = opt('--new-exe', join(NEW, '..', 'binaries', 'victoria3.exe'));
  if (existsSync(exeOld) && existsSync(exeNew)) {
    const idents = f => new Set([...exeIdentifiers(readFileSync(f))].filter(x => x.length >= 5));
    const I1 = idents(exeOld), I2 = idents(exeNew);
    if (exeOld === exeNew) say(`- the same executable on both sides (${exeOld})`);
    const scriptLike = x => /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(x);
    const defs = x => x.startsWith('AVCDefineRegistryHelper_');
    for (const [label, f] of [['script-like identifiers (lower_snake: triggers, effects, modifier types, data keys)', scriptLike], ['define registry entries (AVCDefineRegistryHelper_*)', defs]]) {
      const plus = [...I2].filter(x => f(x) && !I1.has(x)).sort(), minus = [...I1].filter(x => f(x) && !I2.has(x)).sort();
      const n1 = [...I1].filter(f).length, n2 = [...I2].filter(f).length;
      say(`- ${label}: ${n1} → ${n2}, +${plus.length} / −${minus.length}`);
      for (const l of cap(plus, x => `    + ${x}`)) say(l);
      for (const l of cap(minus, x => `    − ${x}`)) say(l);
    }
  } else say(`- executables: not compared (old ${existsSync(exeOld) ? 'found' : 'missing'}: ${exeOld}; new ${existsSync(exeNew) ? 'found' : 'missing'}: ${exeNew})`);
  const docOld = opt('--old-docs', join(OLD, '..', 'docs')), docNew = opt('--new-docs', join(NEW, '..', 'docs'));
  if (existsSync(docOld) && existsSync(docNew)) {
    const names = dir => { const m = {}; for (const p of walk(dir)) { const r = rel(dir, p); const s = new Set(); for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) { const x = /^\s*#*\s*([A-Za-z_][\w.:]*)/.exec(l); if (x) s.add(x[1]); } m[r] = s; } return m; };
    const D1 = names(docOld), D2 = names(docNew);
    for (const f of [...new Set([...Object.keys(D1), ...Object.keys(D2)])].sort()) {
      const s1 = D1[f] || new Set(), s2 = D2[f] || new Set();
      const plus = [...s2].filter(x => !s1.has(x)).sort(), minus = [...s1].filter(x => !s2.has(x)).sort();
      say(`- docs ${f}: +${plus.length} / −${minus.length}${!D1[f] ? ' (new file)' : !D2[f] ? ' (gone)' : ''}`);
      for (const l of cap(plus, x => `    + ${x}`)) say(l);
      for (const l of cap(minus, x => `    − ${x}`)) say(l);
    }
  } else say(`- script docs: not compared (old ${existsSync(docOld) ? 'found' : 'missing'}: ${docOld}; new ${existsSync(docNew) ? 'found' : 'missing'}: ${docNew})`);
  say();

  // ---------- 7. every other file ----------
  say('## 7. Other files (changed line counts)');
  // A script file that did not parse on either side is line-diffed here, so its changes are not lost.
  const unparsed = new Set([...A.failed, ...B.failed].map(f => f.replace(/: .*$/, '')));
  const others = root => walk(root).map(p => rel(root, p)).filter(r => {
    if (/\.(png|dds|dat|heightmap|map|tga|bin|mesh|anim|fxh?|shader|ttf|otf)$/i.test(r)) return false;
    if (r.startsWith('common/') || r.startsWith('events/') || r.startsWith('map_data/state_regions/')) return !r.endsWith('.txt') || unparsed.has(r);
    return r.startsWith('localization/') || r.startsWith('gui/') || r.startsWith('map_data/');
  });
  const F1 = new Set(others(OLD)), F2 = new Set(others(NEW));
  const rows = [];
  for (const r of [...new Set([...F1, ...F2])].sort()) {
    if (!F1.has(r)) { rows.push(`- + ${r} (new, ${lines(join(NEW, r)).length} lines)`); continue; }
    if (!F2.has(r)) { rows.push(`- − ${r} (gone)`); continue; }
    const x = lines(join(OLD, r)), y = lines(join(NEW, r));
    if (x.length === y.length && x.every((l, i) => l === y[i])) continue;
    const c = {}; for (const l of x) c[l] = (c[l] || 0) + 1; let plus = 0; for (const l of y) { if (c[l] > 0) c[l]--; else plus++; } const minus = Object.values(c).reduce((s, v) => s + v, 0);
    rows.push(`- ${r}: +${plus} −${minus}`);
  }
  // Localization in one language is enough to see new concepts: list English keys added and removed.
  const locKeys = root => { const s = new Set(); for (const p of walk(join(root, 'localization', 'english'))) for (const l of lines(p)) { const m = /^\s+([A-Za-z0-9_.\-]+):\d*\s/.exec(l); if (m) s.add(m[1]); } return s; };
  const K1 = locKeys(OLD), K2 = locKeys(NEW);
  const kp = [...K2].filter(k => !K1.has(k)).sort(), km = [...K1].filter(k => !K2.has(k)).sort();
  say(`- English localization keys: +${kp.length} / −${km.length}`);
  for (const l of cap(kp, x => `    + ${x}`)) say(l);
  for (const l of cap(km, x => `    − ${x}`)) say(l);
  const fails = [...A.failed.map(f => `old ${f}`), ...B.failed.map(f => `new ${f}`)];
  say(fails.length ? `- files that did not parse (${fails.length}; their changes show only here):` : '- every script file parsed');
  for (const f of fails) say(`    ${f}`);
  if (!rows.length) say('- no other file changed');
  for (const l of cap(rows)) say(l);
}

function lines(p) { return strip(readFileSync(p, 'utf8')).split(/\r?\n/); }

const text = OUT.join('\n') + '\n';
if (opt('--out')) { writeFileSync(opt('--out'), text); console.log(`game_diff: written ${opt('--out')} (${OUT.length} lines)`); }
else process.stdout.write(text);
