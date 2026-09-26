// CONSTRUCTION COST OF A PRESERVED VANILLA BUILDING — config `building_required_construction`
// { building_key: points } (user-ruled 2026-09-26, BALANCE_FRAMEWORK §10.89: the power plant at 4 × vanilla's
// 400 = 1,600, its recipe, staff and everything else vanilla's — electricity was a CAPITAL-INTENSIVE industry
// and the game prices it like any other building: in the canon a plant carries 2.3 years of revenue in
// capital, the same as the average building, where 1930s utilities carried ~4–5 against manufacturing's ~1).
//
//   node tools/emit_building_costs.mjs <modRoot> [configPath]     # called by tools/build.ps1 AFTER the buildings
//
// It patches the `required_construction` line of each named building INSIDE the building files this build
// already owns (common/buildings/*.txt written by build.ps1); a building in a file the build does not own
// THROWS rather than silently doing nothing — owning a whole vanilla file for one number is a decision.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_building_costs.mjs <modRoot> [configPath]'); process.exit(2); }
const CFG = JSON.parse(readFileSync(process.argv[3] || join(REPO, 'config/mod_config.json'), 'utf8'));
const BRC = CFG.building_required_construction || {};
if (!Object.keys(BRC).length) { console.log('building costs: vanilla (no building_required_construction) - nothing patched'); process.exit(0); }
const dir = join(MOD, 'common/buildings');
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.txt')) : [];
const done = [];
for (const [key, pts] of Object.entries(BRC)) {
  if (!(Number.isInteger(pts) && pts > 0)) throw new Error(`emit_building_costs: ${key} needs a positive integer (got ${pts})`);
  let hit = 0;
  for (const f of files) {
    const p = join(dir, f);
    const raw = readFileSync(p, 'utf8');
    const lines = raw.split(/\r?\n/);
    let depth = 0, inside = false, changed = false;
    for (let i = 0; i < lines.length; i++) {
      const c = lines[i].replace(/#.*$/, '');
      if (depth === 0 && new RegExp(`^\\uFEFF?${key}\\s*=\\s*\\{`).test(c)) inside = true;
      if (inside && depth === 1 && /^\s*required_construction\s*=/.test(c)) {
        const old = /=\s*(\S+)/.exec(c)[1];
        lines[i] = lines[i].replace(/required_construction\s*=\s*\S+/, `required_construction = ${pts} # pm_tech_rehaul: vanilla ${old} (BALANCE_FRAMEWORK §10.89)`);
        hit++; changed = true;
      }
      for (const ch of c) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (depth === 0) inside = false;
    }
    if (changed) writeFileSync(p, lines.join(raw.includes('\r\n') ? '\r\n' : '\n'), 'utf8');
  }
  if (hit !== 1) throw new Error(`emit_building_costs: ${key} matched ${hit} required_construction lines in the owned building files (${files.join(', ') || 'none'}) - expected exactly 1`);
  done.push(`${key} ${pts}`);
}
console.log(`building costs: ${done.join(' · ')}`);
