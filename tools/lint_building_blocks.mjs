// THE BUILDING-BLOCK DIFF (landmine L49; GAME_UPDATE_1_15.md Q10, the user 2026-11-08: "A") — every field of a tiered industry's VANILLA building
// definition must reach every non-craft rung the build emits for that industry, with vanilla's content, unless this file says why not.
//
// WHY. The non-clone builder (build.ps1) writes each rung's building block from the config, not by copying vanilla's block, so a field vanilla
//   has and the builder does not write is dropped without a sound: game 1.15 gave sixteen of the seventeen industries a conditional ai_value
//   (GAME_UPDATE_1_15 U54, now carried by emit_ai_value_adds.mjs and checked by L47), and nothing failed. MISSING_BUILDING_CONDITIONS.md
//   proposed this diff in 1.0.
// WHAT. For each tiered industry (config `industries`, not disabled): vanilla's block = the one named by the industry's first building rung
//   (its key is vanilla's), read from the game's common/buildings; the rungs = every building rung that is not a craft (merged rungs and
//   variants are methods, not buildings). Each top-level field of vanilla's block is compared, comments stripped and whitespace collapsed,
//   with the same field of every rung:
//     • PER_RUNG fields differ by design and are skipped (the rung's own technology, method groups, construction cost);
//     • ai_value: the rung's tier value replaces vanilla's `value`; vanilla's conditional adds are L47's to check;
//     • aliases: only the anchor rung, which keeps vanilla's key, may carry them (a duplicate alias is an engine conflict);
//     • every other field must be present with vanilla's content, or listed in KNOWN with its reason — else the lint FAILS.
//   A field a rung has and vanilla lacks is printed, not failed.
// usage: node tools/lint_building_blocks.mjs <modDir> <config.json>     (exit 1 on a fault; VIC3_GAME for the game)
import fs from 'node:fs'; import path from 'node:path';

const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const [MOD, CFG] = process.argv.slice(2);
if (!MOD || !CFG) { console.error('usage: node tools/lint_building_blocks.mjs <modDir> <config.json>'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8').replace(/^\uFEFF/, ''));

const PER_RUNG = new Set(['unlocking_technologies', 'production_method_groups', 'required_construction']);
// fields known to differ from vanilla on purpose, per industry ('*' = every industry): { field: reason }
const KNOWN = {
};

const strip = l => l.replace(/"[^"]*"/g, m => m.replace(/#/g, '\u0001')).replace(/#.*$/, '').replace(/\u0001/g, '#');
// the top-level fields of the block `key = {` in any .txt of `dir`: Map field -> normalised content (a repeated field keeps every copy)
function fieldsOf(dir, key) {
  const hits = [];
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.endsWith('.txt')) : []) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(strip);
    const s = lines.findIndex(l => new RegExp('^' + key + '\\s*=\\s*\\{').test(l));
    if (s >= 0) hits.push({ f, lines, s });
  }
  if (hits.length > 1) throw new Error(`lint_building_blocks: ${key} is defined in ${hits.map(h => h.f).join(', ')}`);
  if (!hits.length) return null;
  const { lines, s } = hits[0];
  const out = new Map(); let d = 0, cur = null, buf = [];
  const flush = () => { if (cur) { const v = buf.join(' ').replace(/\s+/g, ' ').trim(); out.set(cur, out.has(cur) ? out.get(cur) + ' || ' + v : v); } cur = null; buf = []; };
  for (let i = s; i < lines.length; i++) {
    let c = lines[i];
    if (i === s) c = c.slice(c.indexOf('{') + 1);
    if (d === 0 && i > s) { /* closed */ }
    if (d === (i === s ? 0 : 1) && i > s) { const m = /^\s*([A-Za-z_0-9]+)\s*([?<>!]?=)\s*(.*)$/.exec(c); if (m) { flush(); cur = m[1]; buf.push(m[3]); } else if (cur) buf.push(c); }
    else if (cur) buf.push(c);
    for (const ch of (i === s ? '{' + c : c)) { if (ch === '{') d++; else if (ch === '}') d--; }
    if (i > s && d <= 0) { if (cur) { buf[buf.length - 1] = buf[buf.length - 1].replace(/\}\s*$/, ''); } flush(); break; }
  }
  return out;
}

const faults = [], notes = [];
let compared = 0;
for (const ind of cfg.industries || []) {
  if (ind.disabled || !(ind.tiers || []).length) continue;
  const tiers = [...ind.tiers].sort((a, b) => +a.era - +b.era);
  const blds = tiers.filter(t => !t.method_of);
  const vkey = blds[0].key;
  const V = fieldsOf(path.join(GAME, 'common/buildings'), vkey);
  if (!V) { faults.push(`${ind.id}: vanilla has no building ${vkey}`); continue; }
  for (const t of blds.filter(x => !x.craft)) {
    const R = fieldsOf(path.join(MOD, 'common/buildings'), t.key);
    if (!R) { faults.push(`${ind.id}: ${t.key} is not in the built mod`); continue; }
    compared++;
    for (const [k, v] of V) {
      if (PER_RUNG.has(k) || k === 'ai_value') continue;
      if (k === 'aliases') { if (t.key !== vkey && R.has(k)) faults.push(`${t.key}: carries aliases, which only the anchor ${vkey} may`); continue; }
      const known = (KNOWN[ind.id] || {})[k] || (KNOWN['*'] || {})[k];
      if (!R.has(k)) { if (known) continue; faults.push(`${t.key}: drops vanilla's ${k} = ${v.slice(0, 140)}`); continue; }
      if (R.get(k) !== v) { if (known) continue; faults.push(`${t.key}: ${k} differs — vanilla "${v.slice(0, 120)}" / ours "${R.get(k).slice(0, 120)}"`); }
    }
    for (const k of R.keys()) if (!V.has(k) && !PER_RUNG.has(k) && k !== 'ai_value') notes.push(`${t.key}: has ${k}, which vanilla's ${vkey} lacks`);
  }
}
for (const n of [...new Set(notes)]) console.log('  note: ' + n);
if (faults.length) {
  console.log(`BUILDING-BLOCK DIFF FAILED (${faults.length}) — a vanilla building field the build drops or changes; carry it, or list it in KNOWN with its reason and in MISSING_BUILDING_CONDITIONS.md:`);
  for (const f of faults) console.log('  ' + f);
  process.exit(1);
}
console.log(`BUILDING-BLOCK DIFF PASSED: ${compared} non-craft rung building(s) carry every field of their industry's vanilla building (technology, method groups and cost per rung; ai_value's adds checked by L47)`);
