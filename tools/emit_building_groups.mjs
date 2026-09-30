// BUILDING-GROUP AI WEIGHTS — a whole-file copy of vanilla's common/building_groups/00_building_groups.txt with named
// fields of named groups changed (FINDINGS F178; the capital-export arm of 2026-09-30).
//
//   node tools/emit_building_groups.mjs <modRoot> [configPath]        # called by tools/build.ps1
//
// WHY. Vanilla weights a FOREIGN private investment by the building group's `foreign_investment_ai_factor`:
// manufacturing 0.25 (and urban facilities), power 0.5, agriculture / ranching / infrastructure 0.75, mining / logging /
// oil / rubber 1.0, plantations 1.25. So the engine's autonomous investment sends capital abroad for raw extraction and
// keeps factories at home — and British capital barely leaves Britain in either game (F178 §2: 5–568 levels owned
// abroad at 1935 against 10–31k at home). The capital-export hypothesis: raise manufacturing's weight and the leaders'
// private pools build factories where labour idles, so a leader's own depeasantation slows without cutting world GDP.
//
// CONFIG. Top-level `building_group_ai` = { <group>: { <field>: <number> } }. Absent or empty → nothing is emitted and
// vanilla's file stands (the canon). Present → a WHOLE-FILE replacement in which exactly those fields differ; every
// other byte is vanilla's.
//
// THROWS on: a group the file does not define; a field that is not a direct child of that group's block (nothing is
// ever inserted — a field vanilla does not set has a default this emitter cannot see); more than one match; a value
// that is not a finite number.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_building_groups.mjs <modRoot> [configPath]'); process.exit(2); }
const CFGPATH = process.argv[3] || join(REPO, 'config/mod_config.json');
const CFG = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const BG = CFG.building_group_ai;
const die = msg => { throw new Error('emit_building_groups: ' + msg); };
if (!BG || !Object.keys(BG).length) { console.log('building groups: vanilla (no building_group_ai) - nothing emitted'); process.exit(0); }

const REL = 'common/building_groups/00_building_groups.txt';
const SRC = join(GAME, REL);
if (!existsSync(SRC)) die(`vanilla ${REL} not found at ${SRC}`);
let txt = readFileSync(SRC, 'utf8');
const BOM = txt.charCodeAt(0) === 0xFEFF ? '\uFEFF' : '';
if (BOM) txt = txt.slice(1);
const eol = txt.includes('\r\n') ? '\r\n' : '\n';

// top-level block extent of a group: `^<group> = {` ... its matching brace (comments are stripped only for brace counting)
function groupSpan(t, g) {
  const re = new RegExp('^' + g + '\\s*=\\s*\\{', 'm'); const m = re.exec(t); if (!m) return null;
  let i = m.index + m[0].length, d = 1;
  while (i < t.length && d > 0) { const ch = t[i]; if (ch === '#') { while (i < t.length && t[i] !== '\n') i++; continue; } if (ch === '{') d++; else if (ch === '}') d--; i++; }
  if (d !== 0) die(`unbalanced braces in ${g}`);
  return [m.index + m[0].length, i - 1];
}
const changes = [];
for (const [g, fields] of Object.entries(BG)) {
  if (!/^[a-z_0-9]+$/.test(g)) die(`bad group key ${g}`);
  for (const [f, v] of Object.entries(fields)) {
    if (!/^[a-z_0-9]+$/.test(f)) die(`bad field ${f}`);
    if (typeof v !== 'number' || !Number.isFinite(v)) die(`${g}.${f}: value ${v} is not a finite number`);
    const span = groupSpan(txt, g); if (!span) die(`group ${g} is not defined in vanilla ${REL}`);
    const body = txt.slice(span[0], span[1]);
    // direct children only: walk the body tracking depth, collect `<field> = <number>` at depth 0
    let d = 0, lineStart = 0; const hits = [];
    for (let i = 0; i <= body.length; i++) {
      if (i === body.length || body[i] === '\n') {
        const line = body.slice(lineStart, i); const code = line.replace(/#.*/, '');
        const depthAtStart = d;
        const mm = new RegExp('^(\\s*' + f + '\\s*=\\s*)(-?[0-9.]+)').exec(code);
        if (mm && depthAtStart === 0) hits.push({ off: lineStart, pre: mm[1], old: mm[2] });
        for (const ch of code) { if (ch === '{') d++; else if (ch === '}') d--; }
        lineStart = i + 1;
      }
    }
    if (hits.length !== 1) die(`${g}.${f}: expected exactly one direct-child line in vanilla, found ${hits.length} (nothing is ever inserted)`);
    const h = hits[0]; const abs = span[0] + h.off;
    const lineEnd = txt.indexOf('\n', abs);
    const oldLine = txt.slice(abs, lineEnd === -1 ? txt.length : lineEnd);
    const cr = oldLine.endsWith('\r'); const base = cr ? oldLine.slice(0, -1) : oldLine;
    const newLine = base.replace(new RegExp('^(\\s*' + f + '\\s*=\\s*)(-?[0-9.]+)'), `$1${v}`) + `   # PM & Tech Rehaul: vanilla ${h.old} -> ${v} (building_group_ai)` + (cr ? '\r' : '');
    txt = txt.slice(0, abs) + newLine + txt.slice(abs + oldLine.length);
    changes.push(`${g}.${f} ${h.old} -> ${v}`);
  }
}
const header = `# GENERATED by tools/emit_building_groups.mjs from vanilla ${REL} (config ${CFGPATH.replace(/\\/g, '/').split('/').pop()}) - do not hand-edit.${eol}` +
  `# Every byte is vanilla's except: ${changes.join('; ')}.${eol}`;
const out = join(MOD, REL);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, BOM + header + txt, 'utf8');
console.log(`building groups: ${changes.length} field(s) changed (${changes.join('; ')}) -> ${REL}`);
