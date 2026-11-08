#!/usr/bin/env node
// lint_protected_vanilla.mjs — VANILLA AI DRAWS THE MOD MUST NOT TOUCH (2026-11-08, the user on the Tsar's educational reform: "It's important
// to not have something in our mod that breaks this AI draw").
//
// WHY. Some of vanilla's AI behaviour is a draw that only vanilla script decides: the Tsar's educational reform (State and Revolution, dlc019)
// is picked when the ruler has a reformer-type ideology, completes on public schools / the schools institution / literacy / innovation, and
// pushes the AI's school laws through `ai_has_enact_weight_modifier_journal_entries` (FINDINGS F268 §5). The mod owns two files of that chain
// (08_tsarpoints.txt, ip5_je_values.txt, both regenerated from vanilla with craft-excluding rewrites elsewhere in them) and adds the AI-schooling
// weight to the school laws (BALANCE_FRAMEWORK §10.97). Nothing would fail if a later change reached into the chain: the draw would just stop
// happening. This lint fails the build instead.
//
// WHAT, on the FINAL mod state (after every emitter):
//   1. NOT_SHIPPED — vanilla files the chain's logic lives in that the mod must not ship at all;
//   2. SAME_BLOCKS — in a vanilla file the mod does own, these top-level blocks must stay identical to vanilla's (whitespace-normalised);
//   3. ADD_ONLY   — in an owned file the mod may add tagged lines; with them removed the block is vanilla's, and every tagged line is a plain
//                   `if = { limit = { … } add = <number> }` (a pure add: it cannot lower or reset the weight it joins);
//   4. KEYS       — no other file of the mod defines a top-level key of the chain (a zzz_ file redefining it would override vanilla's).
// Every check prints what it looked at; a check that finds nothing to look at throws (the vanilla text moved).
//
//   node tools/lint_protected_vanilla.mjs [--mod <dir>] [--game <dir>]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, '..');
const argv = process.argv.slice(2); const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MOD = argOf('--mod', join(REPO, 'mod'));
const GAME = argOf('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const norm = s => s.replace(/#[^\n]*/g, '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n+/g, '\n').trim();
const fail = []; const done = [];

// ---- the chain (game 1.15.0; ON_GAME_UPDATE §2.2.11 lists it as a coupling)
const NOT_SHIPPED = [
  'common/scripted_effects/05_tsarpoints_scripted_effects.txt',   // the agenda draw (tp_pool_lean, tp_pool_chosen_educational_reform)
  'common/scripted_triggers/05_tsarpoints_scripted_triggers.txt', // je_tsarpoints_ruler_is_reformer
  'common/script_values/tsarpoints_values.txt',
  'common/scripted_triggers/00_ai_triggers.txt',                  // ai_has_enact_weight_modifier_journal_entries (the +750 push)
  'common/ai_strategies/03_political_strategies.txt',             // the AI's law stances while the reform runs
  'common/decrees/00_decree.txt',                                 // the tsar-point decree (+30% education access)
  'common/buildings/07_government.txt',
];
const SAME_BLOCKS = [
  ['common/journal_entries/08_tsarpoints.txt', ['je_tp_pool_educational_reform', 'je_tsarpoints_master']],
  ['common/script_values/ip5_je_values.txt', ['expected_literacy_rate_year']],
];
const ADD_ONLY = [
  ['common/laws/01_education_system.txt', ['law_no_schools', 'law_religious_schools', 'law_private_schools', 'law_public_schools'], /#\s*pm_tech_rehaul \(BALANCE_FRAMEWORK §10\.97\)\s*$/],
];
const KEYS = ['je_tp_pool_educational_reform', 'je_tsarpoints_master', 'je_tsarpoints_determine_missions', 'je_tsarpoints_draw_random_pool_mission',
  'je_tsarpoints_ruler_is_reformer', 'ai_has_enact_weight_modifier_journal_entries', 'expected_literacy_rate_year', 'decree_promote_social_mobility_tsarpoints'];

// ---- a top-level block's text by key (brace-matched, comments and strings respected)
function blockOf(t, key) {
  const re = new RegExp(`^${key}\\s*=\\s*\\{`, 'm'); const m = re.exec(t); if (!m) return null;
  let d = 0, q = false; const s = m.index;
  for (let i = m.index + m[0].length - 1; i < t.length; i++) {
    const c = t[i]; if (q) { if (c === '"') q = false; continue; }
    if (c === '"') { q = true; continue; } if (c === '#') { const nl = t.indexOf('\n', i); i = nl < 0 ? t.length : nl; continue; }
    if (c === '{') d++; else if (c === '}' && --d === 0) return t.slice(s, i + 1);
  }
  return null;
}
const topKeys = t => [...t.matchAll(/^([A-Za-z_][\w.:-]*)\s*=\s*\{/gm)].map(m => m[1]);

// 1. NOT_SHIPPED
for (const rel of NOT_SHIPPED) {
  if (!existsSync(join(GAME, rel))) fail.push(`${rel}: not in the game any more — the chain moved; re-read it (F268 §5) and update this list`);
  if (existsSync(join(MOD, rel))) fail.push(`${rel}: the mod ships this vanilla file — it holds the Tsar's reform draw and must stay vanilla's`);
}
done.push(`${NOT_SHIPPED.length} vanilla files not shipped`);
// 2. SAME_BLOCKS
for (const [rel, keys] of SAME_BLOCKS) {
  const v = existsSync(join(GAME, rel)) ? rd(join(GAME, rel)) : null; if (!v) { fail.push(`${rel}: not in the game`); continue; }
  const m = existsSync(join(MOD, rel)) ? rd(join(MOD, rel)) : null;
  for (const k of keys) {
    const vb = blockOf(v, k); if (!vb) { fail.push(`${rel}: vanilla has no ${k} — the chain moved`); continue; }
    if (m == null) continue;                                   // not owned: vanilla's own copy loads
    const mb = blockOf(m, k); if (!mb) { fail.push(`${rel}: the mod's copy lost ${k}`); continue; }
    if (norm(mb) !== norm(vb)) fail.push(`${rel}: ${k} differs from vanilla's — the mod's copy must leave it untouched`);
  }
  done.push(`${rel}: ${keys.length} block(s) ${m == null ? 'not owned (vanilla loads)' : 'identical to vanilla'}`);
}
// 3. ADD_ONLY
for (const [rel, keys, tag] of ADD_ONLY) {
  const v = existsSync(join(GAME, rel)) ? rd(join(GAME, rel)) : null; if (!v) { fail.push(`${rel}: not in the game`); continue; }
  const m = existsSync(join(MOD, rel)) ? rd(join(MOD, rel)) : null; let tagged = 0;
  for (const k of keys) {
    const vb = blockOf(v, k); if (!vb) { fail.push(`${rel}: vanilla has no ${k}`); continue; }
    if (m == null) continue;
    const mb = blockOf(m, k); if (!mb) { fail.push(`${rel}: the mod's copy lost ${k}`); continue; }
    const lines = mb.split('\n'); const ours = lines.filter(l => tag.test(l)); tagged += ours.length;
    for (const l of ours) if (!/^\s*if\s*=\s*\{\s*limit\s*=\s*\{[^{}]*\}\s*add\s*=\s*\d+(\.\d+)?\s*\}\s*#/.test(l)) fail.push(`${rel}: ${k}: a tagged line is not a plain add: "${l.trim()}"`);
    if (norm(lines.filter(l => !tag.test(l)).join('\n')) !== norm(vb)) fail.push(`${rel}: ${k} differs from vanilla's beyond the tagged adds`);
  }
  done.push(`${rel}: ${keys.length} block(s), ${tagged} tagged add line(s), vanilla's otherwise`);
}
// 4. KEYS: no file of the mod defines a chain key, except the owned vanilla copies checked above
const owned = new Set(SAME_BLOCKS.map(([r]) => r));
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.txt') ? [p] : []; });
let scanned = 0;
for (const p of existsSync(join(MOD, 'common')) ? walk(join(MOD, 'common')) : []) {
  const rel = relative(MOD, p).split('\\').join('/'); if (owned.has(rel)) continue; scanned++;
  for (const k of topKeys(rd(p))) if (KEYS.includes(k)) fail.push(`${rel}: defines ${k} — a chain key of the Tsar's reform draw, which must stay vanilla's`);
}
if (!scanned) fail.push(`no files under ${join(MOD, 'common')} — wrong --mod?`);
done.push(`${scanned} other mod files scanned for ${KEYS.length} chain keys`);

if (fail.length) { console.error('PROTECTED-VANILLA CHECK FAILED:\n  ' + fail.join('\n  ')); process.exit(1); }
console.log(`PROTECTED-VANILLA CHECK PASSED (the Tsar's educational reform draw): ${done.join('; ')}.`);
