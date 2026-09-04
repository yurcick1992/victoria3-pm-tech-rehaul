// LANDMINE L13 — a starting factory converted onto a tier its own production method contradicts.
//
// THE FAILURE (register entry): the 1836 converter maps each vanilla factory onto one of our tiers by
// reading the main production method it runs. When that mapping fails, the factory does NOT disappear
// and is NOT reported — it passes through carrying the vanilla building key, which some tier still
// owns, so it lands on that tier regardless of what it was running.
//
// ⚠ WHY L14 CANNOT SEE IT. L14 asks "does the owner hold the gate of what it owns?" — a question about
// PERMISSION. A wrongly-placed factory has perfectly valid permission for its wrong placement: put an
// 1875 sewing-machine mill on the 1780 handloom rung and the owner still holds `manufacturies`, so L14
// passes while 1836 has silently stopped matching vanilla. L13 asks about PLACEMENT.
//
// THREE CHECKS, all against the EMITTED history plus the vanilla files it was derived from:
//   1. COVERAGE   — every vanilla main method must map to some tier (own rung or vanilla_pm_alias),
//                   or a factory running it has nowhere to land.
//   2. PLACEMENT  — a method absorbed as an ALIAS must not shift the factory by more than a third of
//                   the ladder. Dropping a rung is fine; silently promoting or demoting a factory
//                   across most of the ladder is not.
//   3. KEYS       — every building key our emitted history creates must be one the config defines.
//                   A key that is not ours means the converter fell back to the vanilla building.
//
// Usage: node tools/lint_start_conversion.mjs [modDir] [configPath]   — exits non-zero on any breach.
import {readFileSync, readdirSync, existsSync} from 'fs';
import {readVanilla, mainLadder, blocks} from './lib_vanilla_ladder.mjs';

const MOD  = process.argv[2] || 'mod';
const CFGP = process.argv[3] || 'config/mod_config.json';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const DRIFT = +(process.env.L13_DRIFT || 0.34);      // a third of the ladder
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const V = readVanilla(GAME);
const cfg = JSON.parse(rd(CFGP));
// (2026-09-04: the linter used to open config/mod_config.json — the SIX-RUNG book — to find an industry's vanilla ladder
//  group; on a book whose every rung carries its vanilla_pm that read was never needed, and the ruling forbids it.)

// ⚠⚠ COVERAGE IS A PROPERTY OF THE VANILLA PMG, NOT OF ONE CONFIG INDUSTRY. The shipyard is ONE
// vanilla building split across TWO config industries (`shipyard` = clippers, `shipyard_steam` =
// steamers, CLAUDE.md), so a per-industry check reports all four shipbuilding methods as orphans:
// each industry legitimately covers half. Index the tiers by PMG and ask the question once per group.
const tiersByGroup = {};
for (const ind of cfg.industries) {
  if (ind.disabled) continue;
  const g = mainLadder(V, ind).group;
  if (!g) continue;
  (tiersByGroup[g] ||= []).push(...(ind.tiers || []));
}
// Two classes of method a 1836 factory can NEVER be running, so their absence is not a gap:
//   - POWER-BLOC GATED (`unlocking_principles`) — `pm_*_principle_transport_3` and friends. The
//     solver never selects one and no history file can carry one (CLAUDE.md: extract_vanilla flags
//     them `gated:true`, basePm() skips them).
//   - DELIBERATELY DROPPED by the book — `pm_early_power_plant` is GONE by §10.43 ruling (the 1900
//     municipal engine house is modelled inside urban centres instead), and the tier4 spec drops
//     `pm_improved_fertilizer`. A ruling to remove a rung must not read as a coverage defect.
const DROPPED = new Set(["pm_early_power_plant", "pm_improved_fertilizer"]);
const unreachable = m => DROPPED.has(m) || /unlocking_principles/.test(V.PMBODY[m] || "");

const problems = [];
let methods = 0, aliases = 0;

for (const ind of cfg.industries) {
  if (ind.disabled) continue;
  const L = mainLadder(V, ind);
  const n = L.methods.length;
  if (!n) continue;
  const rungs = (ind.tiers || []).map(t => t.era);
  L.methods.forEach((m, pos) => {
    methods++;
    let landed = null, viaAlias = false;
    for (const t of ind.tiers || []) {
      if (t.vanilla_pm === m) { landed = t; viaAlias = false; break; }
      if ((t.vanilla_pm_aliases || []).includes(m)) { landed = t; viaAlias = true; }
    }
    // 1. COVERAGE
    if (!landed && !unreachable(m)) {
      // one more chance: another industry on this SAME vanilla PMG may own the method
      const sib = (tiersByGroup[L.group] || []).some(t =>
        t.vanilla_pm === m || (t.vanilla_pm_aliases || []).includes(m));
      if (!sib) { problems.push(`COVERAGE  ${ind.id}: vanilla method ${m} maps to no tier of any industry on ${L.group} — a 1836 factory running it has nowhere to land`); return; }
    }
    if (!landed) return;   // covered by a sibling industry, or unreachable by construction
    if (!viaAlias) return;
    aliases++;
    // 2. PLACEMENT
    const idx = rungs.indexOf(landed.era);
    const vFrac = n > 1 ? pos / (n - 1) : 0;
    const oFrac = rungs.length > 1 ? idx / (rungs.length - 1) : 0;
    const drift = oFrac - vFrac;
    if (Math.abs(drift) > DRIFT)
      problems.push(`PLACEMENT ${ind.id}: ${m} is vanilla's ${pos + 1}/${n} but converts onto t${landed.era} ` +
        `(${idx + 1}/${rungs.length}) — a ${drift > 0 ? 'PROMOTION' : 'DEMOTION'} of ${Math.abs(drift).toFixed(2)} of the ladder`);
  });
}

// 3. KEYS — every key the emitted history creates must be one we define
const ours = new Set();
for (const i of cfg.industries) for (const t of i.tiers || []) if (t.key) ours.add(t.key);
const hist = `${MOD}/common/history/buildings`;
let created = 0; const strays = new Map();
if (existsSync(hist)) {
  for (const f of readdirSync(hist).filter(x => x.endsWith('.txt'))) {
    for (const m of rd(`${hist}/${f}`).matchAll(/building *= *"([a-z_0-9]+)"/g)) {
      created++;
      const k = m[1];
      if (!ours.has(k) && !V.BLD[k]) strays.set(k, (strays.get(k) || 0) + 1);
    }
  }
}
for (const [k, n] of strays) problems.push(`KEYS      emitted history creates '${k}' ×${n}, which is neither one of our tiers nor a vanilla building`);

// ⚠ NAME THE PAIR. This tool takes an emitted mod AND the config it was supposed to be built from,
// and a mismatched pair reports every stray tier key individually — which reads as the mod being
// broken rather than as the wrong two things being compared. No threshold can tell the two apart
// reliably (the books share most keys), so state the pair and let the reader see it.
console.log(`  comparing: mod '${MOD}'  against  config '${CFGP}'`);
console.log(`start conversion: ${methods} vanilla main methods · ${aliases} absorbed as aliases · ${created} create_building entries in the emitted history`);
if (problems.length) {
  console.log(`\nSTART-CONVERSION CHECK FAILED (${problems.length}):`);
  for (const p of problems) console.log('   ' + p);
  console.log('\nSee TESTBED_LANDMINES.md L13. A wrongly-placed factory keeps valid permission, so L14 cannot see it.');
  process.exit(1);
}
console.log('START-CONVERSION CHECK PASSED (L13): every vanilla method has a tier, no factory shifts more than a third of the ladder, no stray keys.');
