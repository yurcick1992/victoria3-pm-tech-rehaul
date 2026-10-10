// THE RESEARCH LEVERS (BALANCE_FRAMEWORK §10.96, the last tech rework): numbers the game already has, changed — nothing invented.
// Config `research_levers` (absent → this emits NOTHING):
//   static: { <static modifier block>: { <modifier key>: <value> } }   e.g. { country_literacy_rate: { country_weekly_innovation_max_add: 50 } }
//     → common/static_modifiers/00_code_static_modifiers.txt, a WHOLE-FILE copy (static modifiers cannot be patched partially). If an earlier
//       emitter already wrote that file (emit_dams' base_values cap lines), ITS copy is edited, so both survive. Each named key must sit
//       EXACTLY ONCE inside its block — the line's value is replaced, nothing is inserted (throws otherwise).
//   university_innovation_mult: k
//     → common/production_methods/07_government.txt, a WHOLE-FILE copy with `country_weekly_innovation_add` × k in the three university base
//       methods (pm_scholastic_education 1, pm_philosophy_department 1.5, pm_analytical_philosophy_department 2 in vanilla 1.13); throws unless
//       each holds exactly one such line. ⚠ If the mod ever owns that file for another reason, edit its copy here the same way.
// Called by build.ps1 after emit_dams.mjs. usage: node tools/emit_research_levers.mjs <modDir> <config.json>
import fs from 'node:fs'; import path from 'node:path';
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const [MOD, CFG] = process.argv.slice(2);
const die = m => { console.error('emit_research_levers: ' + m); process.exit(1); };
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); const RL = cfg.research_levers;
if (!RL) { console.log('research levers: none (vanilla)'); process.exit(0); }
const stripBom = s => s.replace(/^\uFEFF/, '');
const readOwnedOrVanilla = rel => { const m = path.join(MOD, rel); return stripBom(fs.readFileSync(fs.existsSync(m) ? m : path.join(GAME, rel), 'utf8')); };
const write = (rel, txt) => { const p = path.join(MOD, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '\uFEFF' + txt); };
// the line range of a top-level block `<name> = {` … its closing `}`
function blockRange(lines, name, rel) {
  const starts = lines.map((l, i) => new RegExp(`^${name}\\s*=\\s*\\{`).test(l) ? i : -1).filter(i => i >= 0);
  if (starts.length !== 1) die(`${rel}: expected one top-level block ${name}, found ${starts.length}`);
  let depth = 0;
  for (let i = starts[0]; i < lines.length; i++) {
    for (const ch of lines[i].replace(/#.*$/, '')) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0) return [starts[0], i];
  }
  die(`${rel}: block ${name} does not close`);
}
const report = [];
if (RL.static) {
  const rel = 'common/static_modifiers/00_code_static_modifiers.txt';
  const lines = readOwnedOrVanilla(rel).split(/\r?\n/);
  for (const [blk, kv] of Object.entries(RL.static)) {
    const [a, b] = blockRange(lines, blk, rel);
    for (const [key, val] of Object.entries(kv)) {
      if (typeof val !== 'number' || !Number.isFinite(val)) die(`${blk}.${key}: not a number (${val})`);
      const hits = []; for (let i = a; i <= b; i++) if (new RegExp(`^\\s*${key}\\s*=`).test(lines[i])) hits.push(i);
      if (hits.length !== 1) die(`${rel}: ${blk}.${key} occurs ${hits.length} times (need exactly 1 — this emitter replaces, it never inserts)`);
      const old = /=\s*(-?[\d.]+)/.exec(lines[hits[0]])?.[1];
      lines[hits[0]] = lines[hits[0]].replace(/=\s*-?[\d.]+/, `= ${val}`) + `   # pm_tech_rehaul research lever (vanilla ${old}; BALANCE_FRAMEWORK §10.96)`;
      report.push(`${blk}.${key} ${old} → ${val}`);
    }
  }
  write(rel, lines.join('\n'));
}
if (RL.university_innovation_mult != null) {
  const k = RL.university_innovation_mult; if (!(k > 0)) die(`university_innovation_mult must be > 0 (${k})`);
  const rel = 'common/production_methods/07_government.txt';
  const lines = readOwnedOrVanilla(rel).split(/\r?\n/);
  for (const pm of ['pm_scholastic_education', 'pm_philosophy_department', 'pm_analytical_philosophy_department']) {
    const [a, b] = blockRange(lines, pm, rel);
    const hits = []; for (let i = a; i <= b; i++) if (/^\s*country_weekly_innovation_add\s*=/.test(lines[i])) hits.push(i);
    if (hits.length !== 1) die(`${rel}: ${pm} holds ${hits.length} country_weekly_innovation_add lines (need 1)`);
    const old = +/=\s*(-?[\d.]+)/.exec(lines[hits[0]])[1]; const nv = +(old * k).toFixed(4);
    lines[hits[0]] = lines[hits[0]].replace(/=\s*-?[\d.]+/, `= ${nv}`) + `   # pm_tech_rehaul research lever: vanilla ${old} × ${k} (BALANCE_FRAMEWORK §10.96)`;
    report.push(`${pm} innovation ${old} → ${nv}`);
  }
  write(rel, lines.join('\n'));
}
console.log('research levers: ' + report.join('; '));
