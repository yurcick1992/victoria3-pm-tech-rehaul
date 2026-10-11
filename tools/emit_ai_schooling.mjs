// THE AI'S WILLINGNESS TO EDUCATE (BALANCE_FRAMEWORK §10.97 item 7, user-ruled 2026-10-11) — willingness levers only, no hard blocks.
// Config `ai_schooling` (absent → this emits NOTHING):
//   institution_score: N
//     → `institution_scores = { institution_schools = { value = N } }` added to every administrative AI strategy in
//       common/ai_strategies/01_admin_strategies.txt (vanilla: "Using this value in other strategies will function additively"; the default
//       strategy gives every institution 10, the reformist political strategies give schools 100). Every AI runs exactly one administrative
//       strategy, so every AI gets it. Edits the mod's own copy where the subsidy emitter already wrote one, else a whole-file copy of
//       vanilla's. Throws if a strategy already carries institution_scores (this emitter inserts, it never merges).
//   law_enact_add: N
//     → common/laws/01_education_system.txt, a WHOLE-FILE copy: the religious, private and public school laws' `ai_enact_weight_modifier`
//       gains `+N while the country has no schools`. ⚠ Vanilla ALREADY gives the religious schools law +500 for that case; what keeps
//       Russia at no schools is not desire but the laws' own gates (serfdom disallows religious and public schools, state religion
//       disallows private schools, each needs its technology) — this lever cannot and does not touch those.
// Called by build.ps1 after emit_research_levers.mjs. usage: node tools/emit_ai_schooling.mjs <modDir> <config.json>
import fs from 'node:fs'; import path from 'node:path';
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const [MOD, CFG] = process.argv.slice(2);
const die = m => { console.error('emit_ai_schooling: ' + m); process.exit(1); };
const AS = JSON.parse(fs.readFileSync(CFG, 'utf8')).ai_schooling;
if (!AS) { console.log('ai schooling: none (vanilla)'); process.exit(0); }
const stripBom = s => s.replace(/^\uFEFF/, '');
const readOwnedOrVanilla = rel => { const m = path.join(MOD, rel); return stripBom(fs.readFileSync(fs.existsSync(m) ? m : path.join(GAME, rel), 'utf8')); };
const write = (rel, txt) => { const p = path.join(MOD, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '\uFEFF' + txt); };
// [start, end] line indices of a top-level block that opens on line `s`
const blockEnd = (lines, s, rel) => { let d = 0; for (let i = s; i < lines.length; i++) { for (const ch of lines[i].replace(/#.*$/, '')) { if (ch === '{') d++; else if (ch === '}') d--; } if (d === 0) return i; } die(`${rel}: block at line ${s + 1} does not close`); };
const report = [];
for (const k of Object.keys(AS)) if (!['institution_score', 'law_enact_add'].includes(k) && !k.startsWith('_')) die(`unknown key ai_schooling.${k}`);

if (AS.institution_score != null) {
  const N = AS.institution_score; if (!(typeof N === 'number' && N > 0)) die(`institution_score must be > 0 (${N})`);
  const rel = 'common/ai_strategies/01_admin_strategies.txt';
  const lines = readOwnedOrVanilla(rel).split(/\r?\n/);
  const starts = lines.map((l, i) => /^ai_strategy_[a-z_0-9]+\s*=\s*\{/.test(l) ? i : -1).filter(i => i >= 0);
  if (starts.length < 6) die(`${rel}: found ${starts.length} strategies (vanilla 1.13 has 6)`);
  for (const s of starts.slice().reverse()) {   // bottom-up, so earlier indices stay valid
    const e = blockEnd(lines, s, rel);
    if (lines.slice(s, e + 1).some(l => /^\s*institution_scores\s*=/.test(l))) die(`${rel}: ${lines[s].trim()} already carries institution_scores`);
    if (lines[e].trim() !== '}') die(`${rel}: ${lines[s].trim()} does not end on its own closing brace line`);
    lines.splice(e, 0, `\t# pm_tech_rehaul (BALANCE_FRAMEWORK §10.97): schools ranked for spare bureaucracy, additive to the other strategies' scores`,
      `\tinstitution_scores = {`, `\t\tinstitution_schools = {`, `\t\t\tvalue = ${N}`, `\t\t}`, `\t}`);
  }
  write(rel, lines.join('\n'));
  report.push(`institution_schools +${N} in ${starts.length} administrative strategies`);
}

if (AS.law_enact_add != null) {
  const N = AS.law_enact_add; if (!(typeof N === 'number' && N > 0)) die(`law_enact_add must be > 0 (${N})`);
  const rel = 'common/laws/01_education_system.txt';
  const lines = readOwnedOrVanilla(rel).split(/\r?\n/);
  for (const law of ['law_religious_schools', 'law_private_schools', 'law_public_schools']) {
    const s = lines.findIndex(l => new RegExp(`^${law}\\s*=\\s*\\{`).test(l)); if (s < 0) die(`${rel}: no ${law}`);
    const e = blockEnd(lines, s, rel);
    const m = []; for (let i = s; i <= e; i++) if (/^\s*ai_enact_weight_modifier\s*=\s*\{/.test(lines[i])) m.push(i);
    if (m.length !== 1) die(`${rel}: ${law} holds ${m.length} ai_enact_weight_modifier blocks (need 1)`);
    const v = lines.findIndex((l, i) => i > m[0] && i <= e && /^\s*value\s*=\s*0\s*$/.test(l));
    if (v < 0 || v > m[0] + 3) die(`${rel}: ${law}'s ai_enact_weight_modifier does not open on "value = 0"`);
    lines.splice(v + 1, 0, `\t\tif = { limit = { has_law_or_variant = law_type:law_no_schools }  add = ${N} }   # pm_tech_rehaul (BALANCE_FRAMEWORK §10.97)`);
  }
  write(rel, lines.join('\n'));
  report.push(`+${N} enact weight to leave no schools on religious / private / public schools`);
}
console.log('ai schooling: ' + report.join('; '));
