#!/usr/bin/env node
// tools/lint_vanilla_names.mjs — every vanilla name our own generated script uses must still exist in the game it is built against.
//
// The build already throws on a missing tiered key (L40) or dam site, but the names our emitted `zzz_pm_rehaul*` files take from vanilla — laws,
// regions, building and ship types, technologies, on-actions, journal entries, triggers, effects, event targets, modifier types, icons — fail
// only in the engine, as error.log lines (ON_GAME_UPDATE §2.2.4; the game-update skill, phase 2). This reads every token of our emitted script
// (and every key of 01_pm_rehaul_defines.txt) and resolves it against, in order:
//   - the game's databases: every top-level key under common/, events/ and map_data/state_regions, the defines' keys, the 1836 history's
//     states and tags, the provinces (not vanilla's localization keys: an orphaned one would hide a removal);
//   - the mod's own definitions: every top-level key in mod/ (our files and the owned vanilla copies), its localization keys, and the runtime
//     names our script sets (variables, saved scopes);
//   - the engine's own vocabulary: the identifier strings of the game executable (or the script_docs logs, with --docs);
//   - the names vanilla's script itself uses in the same position (a saved scope, a link), and the engine-generated modifier families
//     (goods_input_<good>_add, building_employment_<pop type>_add, …), which need their good, pop type or building to exist.
// A token none of these resolves is printed with its first file and line, and the exit code is 1 unless every such token is in ACCEPTED, which
// carries a reason for each and is printed. Paths in quoted strings (gfx/…) must exist under the game's or the mod's folder.
//
// USAGE: node tools/lint_vanilla_names.mjs [--mod <dir>] [--game <game dir>] [--exe <victoria3.exe>] [--docs <script_docs dir>] [--all]
//   --mod defaults to mod/, --game to $VIC3_GAME or the Steam path, --exe to <game>/../binaries/victoria3.exe. --all also lists resolved
//   tokens by how they resolved (a calibration aid).
// Run it on a build made from the same game: the owned vanilla copies count as the mod's names, so a stale build's 1.13 copies would hide a
// name 1.15 removed.
// Status: standalone (2026-11-07). Calibrated on the 1.0 release build against 1.13.11 (passes); proven by planting a removed law, trigger,
// building, state, icon and define in a copy of the mod (all six caught). Wiring it into build.ps1 / preflight.ps1 waits for the 1.15 session
// (GAME_UPDATE_1_15.md U19).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parse, stripBom, exeIdentifiers } from './lib_pdx_script.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MOD = resolve(opt('--mod', 'mod'));
const GAME = resolve(opt('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game'));
const EXE = resolve(opt('--exe', join(GAME, '..', 'binaries', 'victoria3.exe')));
const DOCS = opt('--docs');
const ALL = argv.includes('--all');

// Tokens no rule can resolve and that are known to be fine, each with its reason. Keep this short: a new entry needs a reason a reader can check.
const ACCEPTED = {
};

const walk = (dir, acc = []) => { if (!existsSync(dir)) return acc; for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p, acc); else acc.push(p); } return acc; };
const rel = (root, p) => relative(root, p).split(sep).join('/');
const read = p => stripBom(readFileSync(p, 'utf8'));

// ---------- what is known ----------
const GAMEKEYS = new Set(), MODKEYS = new Set(), RUNTIME = new Set(), VANILLA_TOKENS = new Set(), PROVINCES = new Set();
const fails = [];
function collect(root, keys, isGame) {
  const files = [...walk(join(root, 'common')), ...walk(join(root, 'events')), ...walk(join(root, 'map_data', 'state_regions'))].filter(p => p.endsWith('.txt'));
  for (const p of files) {
    let tree; try { tree = parse(read(p)); } catch (e) { if (isGame) fails.push(`${rel(root, p)}: ${e.message}`); continue; }
    const r = rel(root, p);
    for (const st of tree) {
      if (st.k === undefined) continue;
      keys.add(st.k);
      // One level down where the file is a wrapper (history's BUILDINGS = { s:STATE_X = … }, the defines' NAI = { KEY = … }).
      if (st.v.b && (/^[A-Z_]+$/.test(st.k) || r.startsWith('common/defines/') || r.startsWith('common/history/'))) for (const s2 of st.v.b) if (s2.k) { keys.add(s2.k); if (r.startsWith('common/defines/')) keys.add(`${st.k}.${s2.k}`); }
    }
    if (isGame) gatherTokens(tree, VANILLA_TOKENS);
    gatherRuntime(tree);
  }
  // Only OUR localization keys count (our desc = pmr_… lines). Vanilla's are left out: a law or building 1.15 removed may keep an orphaned
  // localization key, which would hide the removal. (Calibrated 2026-11-07: the 1.13.11 build resolves without them.)
  if (!isGame) for (const p of walk(join(root, 'localization')).filter(p => /english/.test(p) && p.endsWith('.yml')))
    for (const l of read(p).split(/\r?\n/)) { const m = /^\s+([A-Za-z0-9_.\-]+):\d*\s/.exec(l); if (m) keys.add(m[1]); }
}
// The names a script gives at runtime: set_variable = x / { name = x }, save_scope_as = x, has_global_variable = x, and the like. Only the
// variable and saved-scope commands count: a broader rule (every has_… trigger) would take `has_law = law_x` for a variable and hide a removed law.
function gatherRuntime(tree) {
  const visit = stmts => { for (const st of stmts) {
    if (st.k && /(variable|variable_list|scope_as|scope_value_as)$/.test(st.k)) {
      if (st.v.s !== undefined) RUNTIME.add(st.v.s);
      else if (st.v.b) for (const s2 of st.v.b) if (s2.k === 'name' && s2.v.s !== undefined) RUNTIME.add(s2.v.s);
    }
    if (st.v.b) visit(st.v.b);
  } };
  visit(tree);
}
function gatherTokens(tree, set) {
  const visit = stmts => { for (const st of stmts) { if (st.k) set.add(st.k); if (st.v.s !== undefined) set.add(st.v.s); if (st.v.w) set.add(st.v.w); if (st.v.b) visit(st.v.b); } };
  visit(tree);
}
collect(GAME, GAMEKEYS, true);
for (const p of walk(join(GAME, 'map_data', 'state_regions'))) for (const m of read(p).matchAll(/"(x[0-9A-Fa-f]{6})"/g)) PROVINCES.add(m[1].toLowerCase());
collect(MOD, MODKEYS, false);
const ENGINE = new Set(), sources = [];
if (DOCS && existsSync(DOCS)) { for (const p of walk(DOCS)) for (const l of read(p).split(/\r?\n/)) { const x = /^\s*#*\s*([A-Za-z_][\w.:]*)/.exec(l); if (x) ENGINE.add(x[1]); } sources.push(`script_docs ${DOCS}`); }
if (existsSync(EXE)) { for (const x of exeIdentifiers(readFileSync(EXE))) ENGINE.add(x); sources.push(`exe ${EXE}`); }
const engineSource = sources.join(' + ');
// The scope prefixes vanilla itself writes (c:, s:, p:, sr:, je:, bt: …: one or two letters, too short for the exe scan).
const VANILLA_PREFIXES = new Set([...VANILLA_TOKENS].map(t => /^([a-z_]+):/.exec(t)?.[1]).filter(Boolean));
if (!sources.length) { console.error(`lint_vanilla_names: no engine vocabulary (no exe at ${EXE}, no --docs); every trigger and effect would read as unknown`); process.exit(2); }

// The engine-generated modifier families and what each needs.
const GOODS = new Set(), POPTYPES = new Set(), BUILDINGS = new Set();
for (const [dir, set] of [['goods', GOODS], ['pop_types', POPTYPES], ['buildings', BUILDINGS]])
  for (const p of walk(join(GAME, 'common', dir)).filter(p => p.endsWith('.txt'))) for (const st of parse(read(p))) if (st.k) set.add(st.k);
for (const p of walk(join(MOD, 'common', 'buildings')).filter(p => p.endsWith('.txt'))) for (const st of parse(read(p))) if (st.k) BUILDINGS.add(st.k);
const FAMILIES = [
  [/^goods_(input|output)_([a-z0-9_]+?)_(add|mult)$/, m => GOODS.has(m[2]), 'good'],
  [/^building_employment_([a-z0-9_]+?)_(add|mult)$/, m => POPTYPES.has(m[1]), 'pop type'],
  [/^(building_[a-z0-9_]+?)_throughput_(add|mult)$/, m => BUILDINGS.has(m[1]), 'building'],
  // An iterator is the engine's list name behind any of the four prefixes (ordered_scope_building: the list scope_building).
  [/^(every|any|ordered|random)_([a-z0-9_]+)$/, m => ENGINE.has(m[2]) || ['every', 'any', 'ordered', 'random'].some(x => VANILLA_TOKENS.has(`${x}_${m[2]}`) || ENGINE.has(`${x}_${m[2]}`)), 'iterator list'],
];

// ---------- resolve every token of our script ----------
const resolvedBy = {}; const unknown = {};
const isLiteral = s => /^-?[\d.]+%?$/.test(s) || /^(yes|no|always|never|none|all|root|this|prev|from)$/i.test(s) || /[$@\[\]|]/.test(s) || /^\d+\.\d+\.\d+$/.test(s);
function known(tok) {
  if (GAMEKEYS.has(tok)) return 'game';
  if (MODKEYS.has(tok)) return 'mod';
  if (RUNTIME.has(tok)) return 'runtime';
  if (ENGINE.has(tok)) return 'engine';
  if (PROVINCES.has(tok.toLowerCase())) return 'province';
  if (VANILLA_TOKENS.has(tok)) return 'vanilla-usage';
  for (const [re, ok] of FAMILIES) { const m = re.exec(tok); if (m && ok(m)) return 'family'; }
  return null;
}
function check(tok, file, ln) {
  if (tok === undefined || isLiteral(tok)) return;
  if (/^".*"$/.test(tok) || /^[a-z_]+\/[^:]*\.[a-z0-9]{2,4}$/i.test(tok)) { // a quoted string (only a path is checked) or a bare path
    const s = tok.replace(/^"(.*)"$/, '$1');
    if (/^(gfx|common|events|map_data|localization|gui)\/.*\.[a-z0-9]{2,4}$/i.test(s)) {
      if (!existsSync(join(GAME, s)) && !existsSync(join(MOD, s)) && existsSync(join(GAME, 'gfx'))) note(s, file, ln, 'path');
    }
    return;
  }
  // A chain (scope:x.owner.capital) and prefixed forms (c:GBR, law_type:law_x, s:STATE_X) resolve piece by piece.
  for (const piece of tok.split('.')) {
    if (!piece || isLiteral(piece)) continue;
    const m = /^([a-z_]+):(.+)$/.exec(piece);
    if (m) {
      const [, pfx, name] = m;
      if (!VANILLA_PREFIXES.has(pfx) && !ENGINE.has(pfx)) note(`${pfx}:`, file, ln, 'prefix');
      if (/^(scope|var|global_var|local_var)$/.test(pfx)) { if (!RUNTIME.has(name) && !VANILLA_TOKENS.has(`${pfx}:${name}`) && !ENGINE.has(name)) note(piece, file, ln, 'runtime name'); else tally('runtime'); continue; }
      const how = known(name); if (how) tally(how); else note(piece, file, ln, 'prefixed name');
      continue;
    }
    const how = known(piece); if (how) tally(how); else note(piece, file, ln, 'name');
  }
}
const tally = how => { resolvedBy[how] = (resolvedBy[how] || 0) + 1; };
function note(tok, file, ln, kind) { (unknown[tok] ??= { n: 0, at: `${file}:${ln}`, kind }).n++; }

const OURS = walk(MOD).filter(p => /(^|[\\/])(zzz_pm_rehaul[^\\/]*|01_pm_rehaul_defines)\.txt$/.test(p) && !/[\\/]localization[\\/]/.test(p));
let nTok = 0;
for (const p of OURS) {
  const r = rel(MOD, p); let tree;
  try { tree = parse(read(p)); } catch (e) { console.error(`lint_vanilla_names: ${r} does not parse: ${e.message}`); process.exit(1); }
  const isDefines = r.startsWith('common/defines/');
  const visit = (stmts, depth, parent) => { for (const st of stmts) {
    if (st.k !== undefined) {
      // A top-level key is our own definition, except where the file adds to a vanilla object (an on-action, a define namespace).
      if (depth > 0 || GAMEKEYS.has(st.k)) { nTok++; if (isDefines && depth === 1) { if (!GAMEKEYS.has(`${parent}.${st.k}`) && !ENGINE.has(`AVCDefineRegistryHelper_${parent}${st.k}`)) note(`${parent}.${st.k}`, r, st.ln, 'define'); else tally('define'); } else check(st.k, r, st.ln); }
    }
    if (st.v.s !== undefined && !(isDefines && depth === 1)) { nTok++; check(st.v.s, r, st.v.ln); }
    if (st.v.w) { nTok++; check(st.v.w, r, st.v.ln); }
    if (st.v.b) visit(st.v.b, depth + 1, st.k);
  } };
  visit(tree, 0, null);
}

// ---------- report ----------
const ukeys = Object.keys(unknown).sort((a, b) => unknown[b].n - unknown[a].n || a.localeCompare(b));
const open = ukeys.filter(k => !(k in ACCEPTED)), accepted = ukeys.filter(k => k in ACCEPTED);
console.log(`lint_vanilla_names: ${OURS.length} files of ours, ${nTok} tokens, against ${GAME}`);
console.log(`  known: ${GAMEKEYS.size} game names, ${MODKEYS.size} mod names, ${RUNTIME.size} runtime names, ${ENGINE.size} engine names (${engineSource}), ${PROVINCES.size} provinces`);
if (fails.length) console.log(`  game files that did not parse, their names unread (${fails.length}): ${fails.join('; ')}`);
if (!existsSync(join(GAME, 'gfx'))) console.log(`  paths not checked: ${GAME} has no gfx/ folder`);
if (ALL) console.log(`  resolved: ${Object.entries(resolvedBy).map(([k, v]) => `${k} ${v}`).join(', ')}`);
for (const k of accepted) console.log(`  ACCEPTED ${k} (${unknown[k].n}×, ${unknown[k].at}): ${ACCEPTED[k]}`);
for (const k of Object.keys(ACCEPTED)) if (!(k in unknown)) console.log(`  stale ACCEPTED entry (no longer seen): ${k}`);
if (!open.length) { console.log('VANILLA NAMES PASSED: every name our script takes from vanilla resolves'); process.exit(0); }
console.log(`VANILLA NAMES FAILED: ${open.length} name(s) resolve nowhere`);
for (const k of open) console.log(`  ${k}  [${unknown[k].kind}] ${unknown[k].n}×, first at ${unknown[k].at}`);
process.exit(1);
