// RULED VANILLA VALUES, CHANGED IN PLACE — one line of a named top-level block of a vanilla file, nothing else.
// Config `vanilla_value_overrides` (absent or empty → this emits NOTHING): a list of
//   { file: "common/…/<vanilla file>.txt", block: "<top-level block>", key: "<line key>", vanilla: <number>, value: <number>, why: "…" }
// First use (2026-10-21, POLISH_1_0.md Q1, user-ruled ×1/3): the four FLAT research bonuses sized for vanilla's research — the Philips company's
// innovation cap, the Advanced Research III principle's cap per schools level, the expedition modifier's weekly innovation and Cuba's
// modernisation cap. The mod cut innovation and the cap to roughly a third of vanilla's for a literate major, and a flat add does not scale.
// Rules:
//   • the key must sit EXACTLY ONCE inside its block, at the stated `vanilla` value (a patch that moves either makes the build THROW — read
//     the new vanilla file and re-rule; never re-point silently);
//   • a file the mod already ships when this runs (emit_companies' company files, emit_vanilla_refs' transforms, emit_dams' static modifiers)
//     is edited IN THAT COPY; any other file is copied whole from vanilla (an ON_GAME_UPDATE coupling);
//   • every `has_dlc_feature` and `dlc =` line survives (counted before and after; THROWS otherwise) — the DLC rule, CLAUDE.md §5.1 rule 1.
// Called by build.ps1 LAST among the content emitters (after emit_vanilla_refs). usage: node tools/emit_value_overrides.mjs <modDir> <config.json>
import fs from 'node:fs'; import path from 'node:path';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const [MOD, CFG] = process.argv.slice(2);
const die = m => { console.error('emit_value_overrides: ' + m); process.exit(1); };
if (!MOD || !CFG) die('usage: node tools/emit_value_overrides.mjs <modDir> <config.json>');
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8').replace(/^\uFEFF/, ''));
const list = (cfg.vanilla_value_overrides || []).filter(e => e && typeof e === 'object' && !Array.isArray(e));
if (!list.length) { console.log('vanilla value overrides: none'); process.exit(0); }
const stripBom = s => s.replace(/^\uFEFF/, '');
const gates = t => (t.match(/^\s*(has_dlc_feature\s*=|dlc\s*=)/gm) || []).length;

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

const byFile = new Map();
for (const e of list) {
  for (const f of ['file', 'block', 'key']) if (typeof e[f] !== 'string' || !e[f]) die(`an entry lacks "${f}": ${JSON.stringify(e)}`);
  for (const f of ['vanilla', 'value']) if (typeof e[f] !== 'number' || !Number.isFinite(e[f])) die(`${e.block}.${e.key}: "${f}" must be a number`);
  if (!/^common\/[a-z0-9_\/]+\.txt$/.test(e.file)) die(`${e.file}: not a vanilla common/ path`);
  (byFile.get(e.file) || byFile.set(e.file, []).get(e.file)).push(e);
}
const report = [];
for (const [rel, entries] of byFile) {
  const own = path.join(MOD, rel), van = path.join(GAME, rel);
  if (!fs.existsSync(van)) die(`${rel}: no such vanilla file`);
  const src = fs.existsSync(own) ? own : van;
  const text = stripBom(fs.readFileSync(src, 'utf8'));
  const lines = text.split(/\r?\n/);
  for (const e of entries) {
    const [a, b] = blockRange(lines, e.block, rel);
    const hits = []; for (let i = a; i <= b; i++) if (new RegExp(`^\\s*${e.key}\\s*=`).test(lines[i])) hits.push(i);
    if (hits.length !== 1) die(`${rel}: ${e.block}.${e.key} occurs ${hits.length} times (need exactly 1 — this emitter replaces, it never inserts)`);
    const old = +/=\s*(-?[\d.]+)/.exec(lines[hits[0]])?.[1];
    if (old !== e.vanilla) die(`${rel}: ${e.block}.${e.key} is ${old}, not the ruled vanilla ${e.vanilla} — vanilla moved; re-rule it`);
    lines[hits[0]] = lines[hits[0]].replace(/=\s*-?[\d.]+/, `= ${e.value}`).replace(/\s*#.*$/, '') + `   # pm_tech_rehaul: vanilla ${old}${e.why ? ' — ' + e.why : ''}`;
    report.push(`${rel.split('/').pop()}: ${e.block}.${e.key} ${old} → ${e.value}`);
  }
  const out = lines.join('\n');
  if (gates(out) !== gates(stripBom(fs.readFileSync(van, 'utf8')))) die(`${rel}: the DLC gate count differs from vanilla's (${gates(out)} against ${gates(stripBom(fs.readFileSync(van, 'utf8')))})`);
  fs.mkdirSync(path.dirname(own), { recursive: true });
  fs.writeFileSync(own, '\uFEFF' + out);
  report.push(`  (${src === own ? 'edited the build\'s own copy' : 'copied from vanilla'}: ${rel})`);
}
console.log('vanilla value overrides: ' + list.length + ' line(s) in ' + byFile.size + ' file(s)');
for (const r of report) console.log('  ' + r);
