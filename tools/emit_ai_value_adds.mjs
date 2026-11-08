// ⭐ VANILLA'S JOURNAL-ENTRY-CONDITIONAL AI DESIRE, CARRIED ONTO THE RUNGS (BALANCE_FRAMEWORK §10.109.2; user-ruled 2026-11-08,
//   GAME_UPDATE_1_15.md Q7: "A").
//
// WHY. Vanilla raises an industry building's `ai_value` while some journal entries run — game 1.15: the five-year plan +2,500 on twelve
//   industries while its light-industry goal is unmet, the Tsar's Great Reforms on munitions, a bureaucratic reform on paper, the art
//   academy's renaissances, Metternich (since 1.13). Each rung of ours is its own building with ONE value from the tier ladder, so the
//   build dropped every one of those adds. They are vanilla's own steering of its AI toward its journal goals, not a lever of ours (§2.4),
//   so they are carried as vanilla wrote them.
//
// WHAT. For every tiered industry, the conditional children of its vanilla building's `ai_value = { value = N … }` (vanilla's key is the
//   industry's first rung) are appended to the ai_value of every NON-CRAFT building of the industry, ON TOP of its tier value: a scalar
//   `ai_value = V` becomes `ai_value = { value = V <vanilla's children> }`; a merge host's conditional block (§10.91.2) receives them before
//   its close. Crafts are left out (cheap craft levels would meet a five-year plan's level goal, GAME_UPDATE_1_15.md Q11).
//   A child naming a tiered industry's vanilla key is rewritten: `is_building_type = <key>` becomes an OR over that industry's non-craft
//   buildings; any other form of such a reference THROWS (rule it first). vanilla's `value = N` must be the block's first child, and any
//   other top-level child than if / else_if / else THROWS. Prints, per industry, what it carried and what it left out.
//
// CHECK MODE (`--check`, landmine L47, run by preflight.ps1): reads the BUILT mod and fails unless every non-craft building of every
//   industry whose vanilla building has conditional adds carries them exactly once, with vanilla's count of children, and no craft does.
//
// Run by build.ps1 after emit_vanilla_refs.mjs, before emit_value_overrides.mjs.
//   node tools/emit_ai_value_adds.mjs <modDir> <config.json> [--check]
import fs from 'node:fs'; import path from 'node:path';

const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const [MOD, CFG] = argv.filter(a => a !== '--check');
const die = m => { console.error('emit_ai_value_adds: ' + m); process.exit(1); };
if (!MOD || !CFG) die('usage: node tools/emit_ai_value_adds.mjs <modDir> <config.json> [--check]');
const unbom = s => s.replace(/^\uFEFF/, '');
const rd = p => unbom(fs.readFileSync(p, 'utf8'));
const cfg = JSON.parse(rd(CFG));
const MARK = "# pm_tech_rehaul: vanilla's journal-entry-conditional adds of ";
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------- a minimal Clausewitz reader (comments and strings skipped)
function blockEnd(t, open) {                       // index of the '}' matching the '{' at `open`
  let d = 0;
  for (let i = open; i < t.length; i++) {
    const c = t[i];
    if (c === '#') { const j = t.indexOf('\n', i); if (j < 0) break; i = j; continue; }
    if (c === '"') { const j = t.indexOf('"', i + 1); if (j < 0) break; i = j; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}
function children(t, from, to) {                   // the direct children of a block body t[from, to)
  const out = []; let i = from;
  const ws = () => { while (i < to) { if (/\s/.test(t[i])) i++; else if (t[i] === '#') { const j = t.indexOf('\n', i); i = j < 0 || j > to ? to : j + 1; } else break; } };
  for (;;) {
    ws(); if (i >= to) break;
    const start = i;
    const km = /^[^\s={}<>!?]+/.exec(t.slice(i, to)); if (!km) die(`unparsable text at ${t.slice(i, i + 40)}`);
    const key = km[0]; i += key.length; ws();
    const om = /^(\?=|>=|<=|!=|=|>|<)/.exec(t.slice(i, to));
    if (!om) { out.push({ key, start, end: i - 1, block: false }); continue; }   // a bare token (list item)
    i += om[0].length; ws();
    if (t[i] === '{') { const e = blockEnd(t, i); if (e < 0 || e >= to) die(`block ${key} does not close`); out.push({ key, start, end: e, open: i, block: true }); i = e + 1; }
    else { const vm = /^("[^"]*"|[^\s{}#]+)/.exec(t.slice(i, to)); if (!vm) die(`no value after ${key}`); out.push({ key, start, end: i + vm[0].length - 1, value: vm[0], block: false }); i += vm[0].length; }
  }
  return out;
}
function topBlock(t, name, rel) {                  // `name = {` at column 0: [start, open, end] or null
  const hits = [...t.matchAll(new RegExp(`^${esc(name)}\\s*=\\s*\\{`, 'gm'))];
  if (hits.length > 1) die(`${rel}: ${hits.length} top-level blocks ${name}`);
  if (!hits.length) return null;
  const open = hits[0].index + hits[0][0].length - 1, end = blockEnd(t, open);
  if (end < 0) die(`${rel}: ${name} does not close`);
  return [hits[0].index, open, end];
}
const buildingFiles = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => path.join(dir, f)) : [];
function findBuilding(dir, key) {                  // the one file of `dir` holding top-level `key = {`
  const found = [];
  for (const f of buildingFiles(dir)) { const t = rd(f); const b = topBlock(t, key, f); if (b) found.push({ f, t, b }); }
  if (found.length > 1) die(`${key} is defined in ${found.length} files of ${dir}`);
  return found[0] || null;
}

// ---------------------------------------------------------------- the model: tiered industries, their buildings, vanilla's key
const INDS = [];
const VKEY = new Map();                            // vanilla key -> industry
const RUNGKEY = new Set();
for (const ind of cfg.industries || []) {
  if (ind.disabled || !(ind.tiers || []).length) continue;
  const tiers = [...ind.tiers].sort((a, b) => +a.era - +b.era);
  const blds = tiers.filter(t => !t.method_of);    // merged rungs and variants are methods of a host, not buildings
  if (!blds.length) continue;
  const x = { id: ind.id, vkey: blds[0].key, nc: blds.filter(t => !t.craft).map(t => t.key), crafts: blds.filter(t => t.craft).map(t => t.key),
    cond: new Set(tiers.filter(t => t.ai_value_cond).map(t => t.key)) };
  INDS.push(x); VKEY.set(x.vkey, x); for (const t of tiers) RUNGKEY.add(t.key);
}

// vanilla's conditional children of one building's ai_value (null when the value is a plain number or absent)
function vanillaAdds(x) {
  const hit = findBuilding(path.join(GAME, 'common/buildings'), x.vkey);
  if (!hit) die(`${x.id}: vanilla has no building ${x.vkey}`);
  const { t, b } = hit;
  const aiv = children(t, b[1] + 1, b[2]).filter(c => c.key === 'ai_value');
  if (aiv.length > 1) die(`${x.vkey}: ${aiv.length} ai_value entries`);
  if (!aiv.length || !aiv[0].block) return null;
  const kids = children(t, aiv[0].open + 1, aiv[0].end);
  if (!kids.length || kids[0].key !== 'value' || kids[0].block) die(`${x.vkey}: vanilla's ai_value block does not open with value = N`);
  const rest = kids.slice(1);
  const odd = rest.filter(k => !['if', 'else_if', 'else'].includes(k.key));
  if (odd.length) die(`${x.vkey}: vanilla's ai_value carries ${odd.map(k => k.key).join(', ')} beside if / else_if / else - rule how to carry it`);
  if (!rest.length) return null;
  // the text from the first child to the end of the last, comments inside kept; references to tiered keys rewritten
  let text = t.slice(rest[0].start, rest[rest.length - 1].end + 1).split(String.fromCharCode(13)).join('');   // vanilla's CRLF
  const rewrites = [];
  text = text.replace(/\bbuilding_[a-z0-9_]+\b/g, (tok, off, s) => {
    const line = s.slice(s.lastIndexOf('\n', off - 1) + 1, off);
    if (line.includes('#')) return tok;            // inside a comment
    const y = VKEY.get(tok);
    if (!y) { if (RUNGKEY.has(tok)) die(`${x.vkey}: vanilla's ai_value names our rung key ${tok}?`); return tok; }
    if (!/is_building_type\s*=\s*$/.test(line)) die(`${x.vkey}: vanilla's ai_value names ${tok} as "${line.trim()} ${tok}" - only is_building_type is carried; rule the form first`);
    rewrites.push(`${tok} -> ${y.id} non-craft (${y.nc.length})`);
    return '\u0000' + tok;                         // marked; expanded below with its is_building_type
  });
  text = text.replace(/is_building_type\s*=\s*\u0000(building_[a-z0-9_]+)/g, (_, tok) =>
    `OR = { ${VKEY.get(tok).nc.map(k => `is_building_type = ${k}`).join(' ')} }`);
  if (text.includes('\u0000')) die(`${x.vkey}: a rewrite was left half-done`);
  return { base: kids[0].value, n: rest.length, text, rewrites, file: path.relative(GAME, hit.f).replace(/\\/g, '/') };
}

// ---------------------------------------------------------------- emit, or check the emitted mod
const MDIR = path.join(MOD, 'common/buildings');
const report = []; const faults = []; let carried = 0;
for (const x of INDS) {
  const v = vanillaAdds(x);
  if (!v) { report.push(`  ${x.id}: ${x.vkey}'s vanilla ai_value has no conditional adds - nothing carried`); continue; }
  for (const key of [...x.nc, ...x.crafts]) {
    const hit = findBuilding(MDIR, key);
    if (!hit) { (CHECK ? faults : []).push(`${key}: not in the built mod`); if (!CHECK) die(`${key}: not in ${MDIR}`); continue; }
    const { f, t, b } = hit;
    const body = t.slice(b[1], b[2] + 1);
    const marks = body.split(MARK).length - 1;
    const craft = x.crafts.includes(key);
    if (CHECK) {
      if (craft) { if (marks) faults.push(`${key}: a craft carries vanilla's adds`); continue; }
      if (marks !== 1) { faults.push(`${key}: carries vanilla's adds ${marks} times, not once`); continue; }
      const aiv = children(t, b[1] + 1, b[2]).filter(c => c.key === 'ai_value');
      const n = aiv.length === 1 && aiv[0].block ? children(t, aiv[0].open + 1, aiv[0].end).filter(c => ['if', 'else_if', 'else'].includes(c.key)).length : 0;
      const own = x.cond.has(key) ? 1 : 0;       // a merge host's own technology condition (§10.91.2) is one of them
      if (n < v.n + own) faults.push(`${key}: ${n} conditional children in its ai_value, vanilla ${x.vkey} has ${v.n}${own ? ' (+1 the merge host\'s own)' : ''}`);
      carried++; continue;
    }
    if (craft) continue;
    if (marks) die(`${key}: already carries vanilla's adds (a second run?)`);
    const aiv = children(t, b[1] + 1, b[2]).filter(c => c.key === 'ai_value');
    if (aiv.length !== 1) die(`${key}: ${aiv.length} ai_value entries in the built mod (every rung carries one)`);
    const a = aiv[0];
    const ins = `\t\t${MARK}${x.vkey} (${v.file}; BALANCE_FRAMEWORK §10.109.2)\n\t\t${v.text}\n`;
    let out;
    if (a.block) { const ls = t.lastIndexOf('\n', a.end) + 1; out = t.slice(0, ls) + ins + t.slice(ls); }
    else out = t.slice(0, a.start) + `ai_value = {\n\t\tvalue = ${a.value}\n${ins}\t}` + t.slice(a.end + 1);
    fs.writeFileSync(f, out);
    carried++;
  }
  report.push(`  ${x.id}: ${x.vkey} (vanilla value ${v.base}, ${v.n} conditional block(s)) -> ${x.nc.join(', ')}`
    + (x.crafts.length ? `; left out (craft): ${x.crafts.join(', ')}` : '') + (v.rewrites.length ? `; rewritten: ${v.rewrites.join('; ')}` : ''));
}
if (CHECK) {
  if (faults.length) { console.log(`AI-VALUE ADDS CHECK FAILED (${faults.length}):`); for (const l of faults) console.log('  ' + l); process.exit(1); }
  console.log(`AI-VALUE ADDS CHECK PASSED: ${carried} non-craft rung building(s) carry vanilla's journal-entry-conditional ai_value adds, no craft does`);
  process.exit(0);
}
console.log(`vanilla ai_value adds: carried onto ${carried} rung building(s) (BALANCE_FRAMEWORK §10.109.2)`);
for (const l of report) console.log(l);
