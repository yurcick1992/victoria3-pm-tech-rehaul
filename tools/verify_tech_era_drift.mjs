// DOES ANY VANILLA TECHNOLOGY SIT IN A DIFFERENT MECHANICAL ERA IN OUR MOD THAN IN VANILLA?
// Read-only. Reads the EMITTED mod, not the spec — same principle as verify_pms.mjs and
// verify_start_techs.mjs: a generator bug cannot hide behind its own intent.
//
//   node tools/verify_tech_era_drift.mjs [modDir]
//
// ⭐⭐ WHY THIS MATTERS, AND IT CUTS BOTH WAYS (user, 2026-08-13).
//
// RAISED (ours > vanilla) is the dangerous direction. `add_era_researched = era_1` is the ONLY era
// granted at the 1836 start, so a technology vanilla calls era 1 is held by every tier-1/2 country for
// free. Call it era 2 and that free grant stops covering it — which our derived 1836 grant then has to
// restore by NAMING it, and the country ends up holding an **era-2 technology at 1836**. The result is a
// world that looks more advanced at the start than vanilla's, for no design reason: it inflates the
// apparent technological level, and mechanical era is what the ERA BASE COST and the AHEAD-OF-TIME
// PENALTY are computed from, so the distortion is not cosmetic.
//
// LOWERED into era 1 is the mirror, and it is the one that shows up as "we are more permissive than
// vanilla at 1836": a technology vanilla makes you research becomes free at the start for every tier-1/2
// country, so a building vanilla will not let you build in 1836 becomes buildable. ⚠ That is NOT covered
// by the ruling that our 1836 must keep every building and PM vanilla allows — that ruling is about not
// LOSING capability. Gaining it is a separate decision, and it needs its own justification per case.
//
// LOWERED but still era 2+ is the ladder-era alignment doing its job (BALANCE_FRAMEWORK, 2026-08-12):
// a technology gating one of our tiers is placed in the mechanical era that tier maps to. It only ever
// lowers, and it is barred from landing in era 1 for exactly the reason above. Reported, not flagged.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2] || join(REPO, 'mod');

const strip = s => s.replace(/^\uFEFF/, '');
const txts = d => (existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.txt')).map(f => join(d, f)) : []);
// ⚠ the hyphen belongs in the id class: `pan-nationalism` is a real technology, and an [a-z_0-9] class
// does not mis-name it, it fails to open the block at all — so the entry is absent and reads as "no era".
const ID = '[A-Za-z_0-9-]+';

// technology -> mechanical era, from one directory of technology files
function eras(dir) {
  const out = {};
  for (const f of txts(dir)) {
    const t = strip(readFileSync(f, 'utf8'));
    const re = new RegExp(`^(${ID})\\s*=\\s*\\{`, 'gm');
    let m, prev = null, ps = 0;
    const close = (name, body) => {
      const e = /^\s*era\s*=\s*era_(\d)/m.exec(body);
      if (e) out[name] = { era: +e[1], file: f };
    };
    while ((m = re.exec(t))) { if (prev) close(prev, t.slice(ps, m.index)); prev = m[1]; ps = m.index; }
    if (prev) close(prev, t.slice(ps));
  }
  return out;
}

const van = eras(join(GAME, 'common/technology/technologies'));
const ours = eras(join(MOD, 'common/technology/technologies'));
if (!Object.keys(van).length) throw new Error('no vanilla technologies parsed — the game path or file shape has moved');
if (!Object.keys(ours).length) throw new Error(`no technologies parsed from ${MOD} — build the mod first`);

const raised = [], lowered = [], loweredToOne = [], added = [];
for (const [id, o] of Object.entries(ours)) {
  const v = van[id];
  if (!v) { added.push({ id, era: o.era }); continue; }
  if (o.era > v.era) raised.push({ id, from: v.era, to: o.era });
  else if (o.era < v.era) (o.era === 1 ? loweredToOne : lowered).push({ id, from: v.era, to: o.era });
}
const missing = Object.keys(van).filter(id => !ours[id]);

const pad = (s, n) => String(s).padEnd(n);
console.log(`vanilla technologies: ${Object.keys(van).length}   ·   in the emitted mod: ${Object.keys(ours).length}`
  + `   (${added.length} added by us, ${missing.length} vanilla ones absent)\n`);

console.log(`### RAISED — ours later than vanilla — ${raised.length}`);
console.log('    ⚠ every one of these puts an era-2+ technology into somebody\'s 1836 set that vanilla does not.');
for (const r of raised) console.log(`    ${pad(r.id, 30)} vanilla era ${r.from} -> ours era ${r.to}`);
if (!raised.length) console.log('    (none)');

console.log(`\n### LOWERED INTO ERA 1 — free at the 1836 start where vanilla makes you research it — ${loweredToOne.length}`);
console.log('    ⚠ this is us being MORE permissive than vanilla at 1836. Not covered by the "lose nothing" ruling.');
for (const r of loweredToOne) console.log(`    ${pad(r.id, 30)} vanilla era ${r.from} -> ours era 1`);
if (!loweredToOne.length) console.log('    (none)');

console.log(`\n### LOWERED, still era 2+ — the ladder-era alignment, no 1836 effect — ${lowered.length}`);
for (const r of lowered) console.log(`    ${pad(r.id, 30)} vanilla era ${r.from} -> ours era ${r.to}`);

if (missing.length) console.log(`\n### VANILLA TECHNOLOGIES ABSENT FROM THE EMITTED FILES — ${missing.length}\n    ${missing.join(', ')}`);

process.exit(raised.length ? 1 : 0);
