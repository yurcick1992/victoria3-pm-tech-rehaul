// WHAT WOULD BE LOST IF THIS TECHNOLOGY WERE MERGED AWAY OR DELETED?
//
//   node tools/audit_tech_content.mjs <tech> [tech...]
//   node tools/audit_tech_content.mjs --all-new        # every technology the mod adds
//
// ⭐⭐ THE RULE THIS ENFORCES (user, 2026-08-12): **THERE ARE NO TRULY CONTENTLESS TECHNOLOGIES IN THIS
// GAME.** A technology that unlocks no building still carries modifiers, still gates production methods,
// still gates combat unit types, and is still named by vanilla script. So before any merge or removal:
// enumerate everything the technology carries, and make the survivor carry all of it.
//
// A technology that "unlocks nothing" in the tech-tree viewer is precisely the dangerous case — the
// viewer only counts BUILDING unlocks. This file counts the other five kinds.
//
// ⚠ THE ID CLASS ADMITS A HYPHEN. `pm_ammonia-soda_process`, `pm_coal-fired_plant`, `pm_oil-fired_plant`
// and `pan-nationalism` are real vanilla keys, and an [a-z_0-9]+ class does not open their blocks at all
// — so their gate reads as EMPTY, which is the permissive direction. See BUGS_AND_FIXES 2026-08-12.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const ID = '[A-Za-z_0-9-]+';
const strip = s => s.replace(/^\uFEFF/, '');
const read = f => strip(readFileSync(f, 'utf8'));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.txt')) out.push(p);
  }
  return out;
}
function blocks(txt) {
  const out = {}; const re = new RegExp('^(' + ID + ')\\s*=\\s*\\{', 'gm'); let m;
  while ((m = re.exec(txt))) {
    let i = re.lastIndex, d = 1;
    while (i < txt.length && d > 0) { if (txt[i] === '{') d++; else if (txt[i] === '}') d--; i++; }
    out[m[1]] = txt.slice(re.lastIndex, i - 1);
  }
  return out;
}
const gateOf = b => { const u = b.match(/unlocking_technologies\s*=\s*\{([^}]*)\}/); return u ? u[1].trim().split(/\s+/).filter(Boolean) : []; };

// ---- the technology blocks themselves (mod overrides vanilla) ----
const techBody = {};
for (const root of [GAME, join(REPO, 'mod')])
  for (const f of walk(join(root, 'common/technology/technologies')))
    for (const [k, v] of Object.entries(blocks(read(f)))) techBody[k] = { body: v, file: relative(root, f), root: root === GAME ? 'vanilla' : 'MOD' };

// ---- everything gated on a technology ----
const gatedBy = {};                                  // tech -> [{kind, key}]
function collectGates(kind, dir) {
  for (const root of [GAME, join(REPO, 'mod')])
    for (const f of walk(join(root, dir)))
      for (const [k, v] of Object.entries(blocks(read(f))))
        for (const g of gateOf(v)) (gatedBy[g] ||= []).push({ kind, key: k, root: root === GAME ? 'v' : 'MOD' });
}
collectGates('production method', 'common/production_methods');
collectGates('building', 'common/buildings');
collectGates('combat unit', 'common/combat_unit_types');
collectGates('decree', 'common/decrees');
collectGates('company', 'common/company_types');

// ---- every textual reference in vanilla script, anywhere ----
const refs = {};                                     // tech -> [file:line]
const SCAN = ['common', 'events'];
const scanFiles = SCAN.flatMap(d => walk(join(GAME, d)));

const args = process.argv.slice(2);
let targets = args.filter(a => !a.startsWith('--'));
if (args.includes('--all-new')) {
  const opt = JSON.parse(read(join(REPO, 'config/tech_tree_options.json'))).options.find(o => o.ships);
  targets = opt.techs.filter(t => t.origin === 'new').map(t => t.id);
}
if (!targets.length) { console.error('usage: node tools/audit_tech_content.mjs <tech> [tech...] | --all-new'); process.exit(2); }

const want = new Set(targets);
for (const f of scanFiles) {
  const lines = read(f).split(/\r?\n/);
  lines.forEach((ln, i) => {
    for (const t of want) {
      if (!ln.includes(t)) continue;
      // a bare word match, so `steel` does not hit `steelworking`
      if (!new RegExp('(^|[^A-Za-z_0-9-])' + t + '([^A-Za-z_0-9-]|$)').test(ln)) continue;
      // the technology's own definition is not a reference to it
      if (/^\s*era\s*=/.test(ln)) continue;
      (refs[t] ||= []).push(`${relative(GAME, f)}:${i + 1}  ${ln.trim().slice(0, 96)}`);
    }
  });
}

const opt = JSON.parse(read(join(REPO, 'config/tech_tree_options.json'))).options.find(o => o.ships);
const T = Object.fromEntries(opt.techs.map(t => [t.id, t]));

let verdictClean = 0, verdictCarry = 0;
for (const id of targets) {
  const t = T[id], b = techBody[id];
  console.log('\n' + '='.repeat(100));
  console.log(`${id}${t ? `   "${t.name}"   ${t.category} era ${t.era}   ${t.origin}${t.onset ? `   onset ${t.onset}` : ''}` : '   (NOT IN THE SHIPPING TREE)'}`);
  console.log('='.repeat(100));
  if (!b) { console.log('  ⚠ no technology block found in vanilla or the mod'); continue; }
  console.log(`  defined in: ${b.root} ${b.file}`);

  // 1. the modifier block — the content the viewer never shows
  const mod = b.body.match(/modifier\s*=\s*\{([\s\S]*?)\n\t\}/);
  const modLines = mod ? mod[1].split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')) : [];
  console.log(`  MODIFIERS (${modLines.length}):${modLines.length ? '' : '  none'}`);
  for (const l of modLines) console.log('      ' + l);

  // 2. anything else inside the block that is not era/prereq/texture/ai_weight
  const other = b.body.split(/\r?\n/).map(s => s.trim())
    .filter(s => s && !s.startsWith('#'))
    .filter(s => !/^(era|texture|category|ai_weight|unlocking_technologies|modifier|can_research)\b/.test(s))
    .filter(s => !/^[{}]$/.test(s));
  const inMod = new Set(modLines);
  const extra = other.filter(s => !inMod.has(s) && !/^\}$/.test(s));
  if (extra.length) { console.log(`  OTHER FIELDS IN THE BLOCK (${extra.length}):`); for (const l of extra.slice(0, 20)) console.log('      ' + l); }

  // 3. what it gates
  const g = gatedBy[id] || [];
  const byKind = {};
  for (const x of g) (byKind[x.kind] ||= []).push(x.key + (x.root === 'MOD' ? ' [ours]' : ''));
  console.log(`  GATES (${g.length}):${g.length ? '' : '  nothing'}`);
  for (const [k, v] of Object.entries(byKind)) console.log(`      ${k}: ${[...new Set(v)].join(', ')}`);

  // 4. named by vanilla script anywhere else
  const r = (refs[id] || []).filter(x => !x.startsWith('common/technology/technologies/'));
  console.log(`  NAMED IN VANILLA SCRIPT ELSEWHERE (${r.length}):${r.length ? '' : '  nowhere'}`);
  for (const x of r.slice(0, 14)) console.log('      ' + x);
  if (r.length > 14) console.log(`      … and ${r.length - 14} more`);

  const carries = modLines.length || g.length || r.length || extra.length;
  if (carries) verdictCarry++; else verdictClean++;
  console.log(`  ⇒ ${carries ? 'CARRIES CONTENT — the survivor must absorb all of the above' : 'carries nothing found by this audit'}`);
}
console.log(`\n${targets.length} technolog(ies) audited — ${verdictCarry} carry content, ${verdictClean} appear empty.`);
console.log('⚠ "appears empty" is this audit\'s reach, not a proof: localisation, gfx and the AI\'s own');
console.log('  weighting are not scanned, and a technology is still a research decision in its own right.');
