// THE GROUP-LEVEL COUNT SCAN (landmine L48; GAME_UPDATE_1_15.md Q10, the user 2026-11-08: "A") — every count of a building group's LEVELS that
// would see the crafts must take them out, or be reviewed here with its reason.
//
// WHY. A craft level is 500 workers against a factory level's 5,000 and costs a fiftieth, so a count of levels sees the crafts ten times over per
//   worker and nearly free (TIER_REFERENCE_AUDIT G1–G7). The reference scan (L40) reads only building and method keys, so a game update that adds
//   a level count on light industry or manufacturing (1.15 added three, Q11) or a promise that counts a variable group (IP4's, missed by 1.0's
//   audit, G7) fails nothing.
// WHAT. Over the game's text AS THE MOD SHIPS IT (each common/ and events/ .txt of the game, the mod's copy where the mod ships that path, plus the
//   mod's own additive files): every `country_has_building_group_levels` / `state_has_building_group_levels`, as a data function ("…(X)") or a
//   trigger (`= { type = X … }`), whose group X contains the crafts (an ancestor of the craft group, from common/building_groups) or is a
//   variable (var:…, scope:…). Such a count is HANDLED when a `subtract = "…(<craft group>)"` follows it inside the same block (the native form
//   of §10.109.4); every other one must be in REVIEWED, file by file, with its exact count and reason — else the scan FAILS.
// usage: node tools/lint_group_levels.mjs <modDir> <config.json>     (exit 1 on a fault; VIC3_GAME for the game)
import fs from 'node:fs'; import path from 'node:path';

const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const [MOD, CFG] = process.argv.slice(2);
if (!MOD || !CFG) { console.error('usage: node tools/lint_group_levels.mjs <modDir> <config.json>'); process.exit(2); }
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const cfg = JSON.parse(rd(CFG));

// counts that see the crafts on purpose, file by file: { rel: { n, why } } — n is the exact number of unhandled counts the file holds
const REVIEWED = {
  'common/scripted_triggers/ip4_negotiation_triggers.txt': { n: 1, why: 'building_group_can_be_promised: an existence test (>= 1 level) - a craft is light industry, and promising to expand light industry where only crafts stand is sound (GAME_UPDATE_1_15 Q10)' },
  // debug builds only (a release build carries no tripwire, so the entry may find nothing there)
  'common/on_actions/zzz_pm_rehaul_diag.txt': { n: 1, optional: true, why: 'the init tripwire compares the engine\'s light-industry count, crafts included, with a loop on purpose (§10.109.4)' },
};

const craftBgs = [...new Set((cfg.industries || []).filter(i => !i.disabled).flatMap(i => (i.tiers || []).filter(t => t.craft).map(t => t.building_group)))];
if (!craftBgs.length) { console.log('GROUP-LEVEL COUNT SCAN: N/A - the book has no crafts'); process.exit(0); }
if (craftBgs.length > 1) { console.error(`lint_group_levels: the crafts sit in ${craftBgs.join(', ')} - one group expected`); process.exit(1); }
const CRAFT = craftBgs[0];

// the building-group tree: vanilla's files, then the mod's (a mod file of the same name replaces vanilla's; a new one adds)
const parent = {};
const groupFiles = new Map();
for (const root of [GAME, MOD]) {
  const dir = path.join(root, 'common/building_groups');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt'))) groupFiles.set(f, path.join(dir, f));
}
for (const p of groupFiles.values()) {
  let cur = null, d = 0;
  for (const raw of rd(p).split(/\r?\n/)) {
    const l = raw.replace(/#.*$/, '');
    const m = d === 0 && /^([A-Za-z_0-9]+)\s*=\s*\{/.exec(l); if (m) cur = m[1];
    const pm = cur && d === 1 && /^\s*parent_group\s*=\s*([A-Za-z_0-9]+)/.exec(l); if (pm) parent[cur] = pm[1];
    for (const ch of l) { if (ch === '{') d++; else if (ch === '}') d--; }
    if (d === 0) cur = null;
  }
}
if (!(CRAFT in parent)) { console.error(`lint_group_levels: the craft group ${CRAFT} has no parent_group in common/building_groups`); process.exit(1); }
const ANC = new Set(); for (let g = parent[CRAFT]; g; g = parent[g]) ANC.add(g);

// the files as the mod ships them
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const files = new Map();
for (const root of [GAME, MOD]) for (const top of ['common', 'events'])
  for (const f of walk(path.join(root, top)).filter(x => x.endsWith('.txt'))) files.set(path.relative(root, f).split(path.sep).join('/'), f);

const lineAt = (t, i) => t.slice(t.lastIndexOf('\n', i - 1) + 1, i);
function blockRest(t, i) {                       // the text from i to the end of the block that encloses i
  let d = 0;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (c === '#') { const k = t.indexOf('\n', j); if (k < 0) break; j = k; continue; }
    if (c === '"') { const k = t.indexOf('"', j + 1); if (k < 0) break; j = k; continue; }
    if (c === '{') d++; else if (c === '}') { if (d === 0) return t.slice(i, j); d--; }
  }
  return t.slice(i);
}
const RE = /\b(?:country|state)_has_building_group_levels(?:\(\s*([^)\s]+)\s*\)|\s*=\s*\{\s*type\s*=\s*([^\s}]+))/g;
const unhandled = new Map(); let handled = 0, seen = 0;
for (const [rel, p] of files) {
  const t = rd(p);
  for (const m of t.matchAll(RE)) {
    if (lineAt(t, m.index).includes('#')) continue;
    const g = m[1] || m[2];
    const variable = !/^bg_/.test(g);
    if (!variable && !ANC.has(g)) continue;
    seen++;
    const rest = blockRest(t, m.index + m[0].length);
    if (m[1] && new RegExp(`subtract\\s*=\\s*"[^"]*\\(${CRAFT}\\)"`).test(rest)) { handled++; continue; }
    const line = t.slice(0, m.index).split('\n').length;
    (unhandled.get(rel) || unhandled.set(rel, []).get(rel)).push(`${rel}:${line} ${m[0].replace(/\s+/g, ' ')}`);
  }
}
const faults = [];
for (const [rel, list] of unhandled) {
  const r = REVIEWED[rel];
  if (!r) { faults.push(...list.map(l => `${l} — sees the crafts (${CRAFT} under ${[...ANC].join(' < ')}), and nothing takes them out`)); continue; }
  if (r.n !== list.length) faults.push(`${rel}: ${list.length} unhandled count(s), the review says ${r.n} — the file moved; re-review it`);
}
for (const rel of Object.keys(REVIEWED)) if (!unhandled.has(rel) && !REVIEWED[rel].optional) faults.push(`${rel}: reviewed for ${REVIEWED[rel].n} count(s) and has none left — drop the entry`);
if (faults.length) {
  console.log(`GROUP-LEVEL COUNT SCAN FAILED (${faults.length}) — take the crafts out (the group's count minus ${CRAFT}'s, §10.109.4) or review the count in REVIEWED with its reason:`);
  for (const f of faults) console.log('  ' + f);
  process.exit(1);
}
console.log(`GROUP-LEVEL COUNT SCAN PASSED: ${seen} level count(s) on a craft-holding or variable group, ${handled} take the crafts out natively, ${seen - handled} reviewed (${Object.keys(REVIEWED).length} file(s))`);
