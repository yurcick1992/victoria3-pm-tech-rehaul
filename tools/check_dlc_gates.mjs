// 🛑 DLC GATES SURVIVE IN EVERY VANILLA FILE THE MOD REPLACES — Paradox forbids a mod that unlocks DLC content (the user, 2026-10-21:
//   "This isn't my intention, and that's explicitly prohibited by PDS"). Every DLC's gameplay ships in the BASE game folder behind
//   `has_dlc_feature = <feature>` triggers and the `dlc = dlcNNN` field of events; game/dlc/ holds only art, music and sound. A whole-file
//   copy that loses one of those lines hands the content to everyone.
//
// For a mod folder: every .txt it ships under a path vanilla also has must carry the same number of `has_dlc_feature` lines and `dlc =`
//   fields (comments excluded) as vanilla's file. Exits 1 with the list otherwise. Additive files (paths vanilla lacks) are not checked —
//   our own hooks that fire vanilla DLC content must carry the condition themselves (the Montenegro check in zzz_pm_rehaul_vanilla_refs.txt).
//   node tools/check_dlc_gates.mjs [modDir]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MOD = process.argv[2] || 'mod';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const count = t => {
  const c = t.replace(/^\uFEFF/, '').split('\n').map(l => l.replace(/#.*/, '')).join('\n');
  return { feat: (c.match(/\bhas_dlc_feature\s*=/g) || []).length, dlc: (c.match(/^\s*dlc\s*=/gm) || []).length };
};
const bad = [];
let checked = 0, gated = 0;
for (const root of ['common', 'events']) {
  const dir = join(MOD, root);
  if (!existsSync(dir)) continue;
  for (const f of walk(dir).filter(x => x.endsWith('.txt'))) {
    const rel = relative(MOD, f).split(sep).join('/');
    const van = join(GAME, rel);
    if (!existsSync(van)) continue;
    checked++;
    const a = count(readFileSync(van, 'utf8')), b = count(readFileSync(f, 'utf8'));
    if (a.feat || a.dlc) gated++;
    if (a.feat !== b.feat || a.dlc !== b.dlc) bad.push(`${rel}: has_dlc_feature ${a.feat} -> ${b.feat}, dlc = ${a.dlc} -> ${b.dlc}`);
  }
}
if (bad.length) {
  console.error(`DLC-GATE CHECK FAILED: ${bad.length} replaced vanilla file(s) lost or gained a DLC gate — never unlock DLC content:\n  ` + bad.join('\n  '));
  process.exit(1);
}
console.log(`DLC-GATE CHECK PASSED: ${checked} vanilla file(s) replaced by ${MOD}, ${gated} of them DLC-gated, every has_dlc_feature and dlc = line kept.`);
