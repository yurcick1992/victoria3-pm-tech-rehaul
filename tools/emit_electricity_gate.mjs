// THE ELECTRICITY BUILD CONDITION (user-ruled 2026-10-26, BALANCE_FRAMEWORK §10.106).
//
// ⚠ DEFERRED TO MOD 1.1 OR LATER (the user, 2026-10-26): it works (seen in the motor-t2 probe: blocked without electricity, allowed with a
//   power plant), but a `possible` scanning the state's buildings "can have unexpected performance consequences". build.ps1 does not call
//   it, and lint_pm_combos check 10 prints the affected buildings as a known issue. To restore: the call in build.ps1 (commented there,
//   after emit_value_overrides) and check 10 back to a failure.
//
//   node tools/emit_electricity_gate.mjs <modRoot> [configPath]        # meant to run in tools/build.ps1, after every building writer
//
// A method that consumes electricity carries vanilla's `required_input_goods = electricity` (lint_pm_combos check 9), which stops it
// being CHOSEN in a state without electricity but not a building being BUILT there. Vanilla never needs more: every gated vanilla method
// has an ungated alternative in its group. A building of ours whose group offers nothing else (explosives t3, motor t2, art academy t3
// in the canon) could be built where it can never run. This emitter, from the built mod laid over the game:
//   1. PRODUCERS: every building with a method that outputs electricity. A clause per building: one built level (`level >= 1`), and, if
//      only some of its group's methods produce, one of those active (the urban centre's electric streetlights). Canon: the power plant,
//      the four dam types, the urban centre. Derived, so a new producer joins without an edit here;
//   2. writes the scripted trigger `pmr_state_produces_electricity` (state scope) over them, under a custom tooltip;
//   3. GATED: every building in the mod's own building files with a production-method group in which EVERY method requires electricity.
//      Its `possible` gets `pmr_state_produces_electricity = yes` (a `possible` block is opened where the building has none).
// Nothing happens to a built building whose state later loses electricity (the user: acceptable). The ruling allows this one kind of
// build condition only — an input the building's only methods cannot run without — and not build blocks in general (§10.69 stands).
// lint_pm_combos check 10 fails a gated building that lacks the condition.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_electricity_gate.mjs <modRoot> [configPath]'); process.exit(2); }
const CFG = JSON.parse(readFileSync(process.argv[3] || join(REPO, 'config', 'mod_config.json'), 'utf8'));
const TRIGGER = 'pmr_state_produces_electricity';

const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const strip = s => s.replace(/#[^\n]*/g, '');
function blocks(text) {   // top-level `key = { … }` blocks: key -> { body, start, end } (offsets into the text as given)
  const out = new Map(); const re = /^([A-Za-z0-9_\-]+)\s*=\s*\{/gm; let m;
  const t = text.replace(/#[^\n]*/g, c => ' '.repeat(c.length));   // comments blanked, offsets kept
  while ((m = re.exec(t))) {
    let d = 0, i = m.index + m[0].length - 1;
    for (; i < t.length; i++) { if (t[i] === '{') d++; else if (t[i] === '}' && --d === 0) break; }
    out.set(m[1], { body: t.slice(m.index, i + 1), start: m.index, end: i }); re.lastIndex = i + 1;
  }
  return out;
}
function layered(rel) {   // what the engine loads: the game's files, a mod file of the same name replacing it, the mod's own added
  const files = new Map();
  for (const root of [GAME, MOD]) { const d = join(root, rel); if (existsSync(d)) for (const f of readdirSync(d).filter(f => f.endsWith('.txt'))) files.set(f, join(d, f)); }
  const o = new Map(); for (const f of [...files.keys()].sort()) for (const [k, v] of blocks(rd(files.get(f)))) o.set(k, v.body);
  return o;
}
const listOf = (b, k) => { const m = new RegExp('\\b' + k + '\\s*=\\s*\\{([^}]*)\\}').exec(b || ''); return m ? m[1].trim().split(/\s+/).filter(Boolean) : []; };
const BLD = layered('common/buildings'), PMG = layered('common/production_method_groups'), PM = layered('common/production_methods');
const produces = k => /goods_output_electricity_add\s*=\s*([0-9.]+)/.test(PM.get(k) || '') && Number(/goods_output_electricity_add\s*=\s*([0-9.]+)/.exec(PM.get(k))[1]) > 0;
const requires = k => /\brequired_input_goods\s*=\s*electricity\b/.test(strip(PM.get(k) || ''));

// 1. producers
const clauses = [], producers = [];
for (const [bk, body] of BLD) {
  for (const g of listOf(body, 'production_method_groups')) {
    const pms = listOf(PMG.get(g), 'production_methods'), prod = pms.filter(produces);
    if (!prod.length) continue;
    producers.push(prod.length === pms.length ? bk : `${bk} (${prod.join(', ')})`);
    clauses.push(prod.length === pms.length
      ? `\t\t\tany_scope_building = { is_building_type = ${bk}  level >= 1 }`
      : `\t\t\tany_scope_building = { is_building_type = ${bk}  level >= 1  OR = { ${prod.map(p => `has_active_production_method = ${p}`).join('  ')} } }`);
    break;
  }
}
if (!producers.length) throw new Error('emit_electricity_gate: no building produces electricity — the methods moved, or the reader broke');

// 2. the trigger and its tooltip
const out = (rel, s) => { const f = join(MOD, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, '\uFEFF' + s, 'utf8'); };
out('common/scripted_triggers/zzz_pm_rehaul_electricity.txt', [
  '# AUTO-GENERATED by tools/emit_electricity_gate.mjs - do not edit by hand.',
  '# State scope: the state produces electricity. The build condition of a building whose methods all need it (BALANCE_FRAMEWORK §10.106).',
  `${TRIGGER} = {`, '\tcustom_tooltip = {', `\t\ttext = ${TRIGGER}_tt`, '\t\tOR = {', ...clauses, '\t\t}', '\t}', '}', ''].join('\n'));
const TT = 'This state produces electricity: a power plant, a hydroelectric dam, or electric streetlights in its urban centre';
for (const lang of CFG.languages) out(`localization/${lang}/replace/zzz_pm_rehaul_electricity_l_${lang}.yml`, `l_${lang}:\n ${TRIGGER}_tt:0 "${TT}"\n`);

// 3. the gated buildings, in the mod's own building files
const gated = [];
const bdir = join(MOD, 'common/buildings');
for (const f of (existsSync(bdir) ? readdirSync(bdir).filter(f => f.endsWith('.txt')) : [])) {
  const p = join(bdir, f); const raw = readFileSync(p, 'utf8'); const bom = raw.startsWith('\uFEFF'); let text = bom ? raw.slice(1) : raw;
  const edits = [];
  for (const [bk, { body, start, end }] of blocks(text)) {
    const allElectric = listOf(body, 'production_method_groups').some(g => { const pms = listOf(PMG.get(g), 'production_methods'); return pms.length && pms.every(requires); });
    if (!allElectric) continue;
    if (body.includes(TRIGGER)) { gated.push(bk); continue; }
    const pm = /\n(\t)possible\s*=\s*\{[^\n]*\n/.exec(body);
    edits.push(pm ? { at: start + pm.index + pm[0].length, s: `\t\t${TRIGGER} = yes\n` }
                  : { at: end, s: `\tpossible = {\n\t\t${TRIGGER} = yes\n\t}\n` });
    gated.push(bk);
  }
  for (const e of edits.sort((a, b) => b.at - a.at)) text = text.slice(0, e.at) + e.s + text.slice(e.at);
  if (edits.length) writeFileSync(p, (bom ? '\uFEFF' : '') + text, 'utf8');
}
console.log(`  electricity gate: producers ${producers.join(', ')}; build condition on ${gated.length}: ${gated.join(', ') || '(none)'}`);
