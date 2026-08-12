// THE 1836 STARTING-TECHNOLOGY CHECK, PER COUNTRY — landmine L14 (ON_GAME_UPDATE.md).
//
//   node tools/verify_start_techs.mjs [modDir]      # report gaps in one build
//   node tools/verify_start_techs.mjs --vs-vanilla  # FAIL only on gaps vanilla does not already have
//
// The question: for every country, does its 1836 starting technology set unlock every production method
// its own 1836 buildings are told to activate, and every building they are told to build?
//
// It reads THE EMITTED MOD's history, because `replace_paths` makes our copy the only history the engine
// reads — and vanilla's production methods and buildings, overridden by ours where we own the file.
//
// ⚠⚠ WHY `--vs-vanilla` EXISTS. Vanilla itself fails this check on six countries, so an absolute pass is
// unreachable and a build that demanded one could never go green. What we can hold ourselves to is
// introducing NO NEW gap, which is the actual requirement — and the difference is computable, because the
// same analysis runs unchanged against the game's own directory.
//
// ⚠⚠ THE UTF-8 BOM. Every Paradox script file starts with one, so a naive `^name = {` match makes the
// FIRST block of every file invisible. That silently dropped 8 of 110 PMs from a hand-rolled version of
// this check and produced a clean result that was not earned. `strip()` exists for that.
// ⚠⚠ A VACUOUS PASS IS THE FAILURE MODE. The first run of this logic matched zero countries — wrong tag
// regexes for these file shapes — and reported PASSED. Hence `assertNonTrivial()`: it refuses to report
// success unless it actually found countries, buildings and starting sets. A check that cannot fail is
// worse than no check.
// ⚠ THE UNION ACROSS COUNTRIES IS NOT SUFFICIENT: a leader's generous set covers gaps a tier-3 or tier-4
// country's does not, and the lower tiers are exactly where 1836 drifts from vanilla. Report per country.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

const strip = s => s.replace(/^\uFEFF/, '');
const read = f => strip(readFileSync(f, 'utf8'));
const txts = d => existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.txt')).map(f => join(d, f)) : [];

function blocks(txt) {
  const out = {}; const re = /^([A-Za-z_0-9]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(txt))) {
    let i = re.lastIndex, d = 1;
    while (i < txt.length && d > 0) { if (txt[i] === '{') d++; else if (txt[i] === '}') d--; i++; }
    out[m[1]] = txt.slice(re.lastIndex, i - 1);
  }
  return out;
}
const gateOf = body => { const u = body.match(/unlocking_technologies\s*=\s*\{([^}]*)\}/); return u ? u[1].trim().split(/\s+/).filter(Boolean) : []; };

// Vanilla's explicit named grant covers technologies whose onset postdates 1836 but which the 1836 map
// depends on. OURS adds `steel_toolmaking` for the same reason (emit_techs documents why). Both are
// legitimate; what this check is for is a case that is NOT named.
const NAMED = new Set(['central_archives', 'mechanical_tools', 'intensive_agriculture']);

// Analyse one root (our built mod, or the game itself) -> { gaps: {TAG: [tech]}, stats }
function analyse(root) {
  const pmTech = {}, bTech = {}, techEra = {};
  for (const dir of [join(GAME, 'common/production_methods'), join(root, 'common/production_methods')])
    for (const f of txts(dir)) for (const [k, v] of Object.entries(blocks(read(f)))) pmTech[k] = gateOf(v);
  for (const dir of [join(GAME, 'common/buildings'), join(root, 'common/buildings')])
    for (const f of txts(dir)) for (const [k, v] of Object.entries(blocks(read(f)))) bTech[k] = gateOf(v);
  for (const dir of [join(GAME, 'common/technology/technologies'), join(root, 'common/technology/technologies')])
    for (const f of txts(dir)) for (const [k, v] of Object.entries(blocks(read(f)))) {
      const e = v.match(/\bera\s*=\s*era_(\d)/); if (e) techEra[k] = +e[1];
    }

  // ⚠⚠ THE SHORTHAND IS MOST OF THE GRANT. `add_era_researched = era_1` hands a country the WHOLE of
  // mechanical era 1 without naming anything, and both tier 1 and tier 2 use it. Reading only
  // `add_technology_researched` reported Britain and France as lacking `manufacturies` — 24 countries of
  // false positives. Expand it, from THIS root's technology eras, since our re-eras change who gets what.
  const tiers = {};
  const sePath = join(root, 'common/scripted_effects/00_starting_inventions.txt');
  for (const [k, v] of Object.entries(blocks(read(sePath)))) {
    const m = k.match(/^effect_starting_technology_tier_(\d)_tech$/); if (!m) continue;
    const set = new Set([...v.matchAll(/add_technology_researched\s*=\s*([a-z_0-9]+)/g)].map(x => x[1]));
    for (const e of v.matchAll(/add_era_researched\s*=\s*era_(\d)/g))
      for (const [t, era] of Object.entries(techEra)) if (era <= +e[1]) set.add(t);
    tiers[+m[1]] = set;
  }
  // the sets nest: a tier may call the tier above it
  for (const [k, v] of Object.entries(blocks(read(sePath)))) {
    const m = k.match(/^effect_starting_technology_tier_(\d)_tech$/); if (!m) continue;
    for (const c of v.matchAll(/effect_starting_technology_tier_(\d)_tech\s*=\s*yes/g))
      for (const t of (tiers[+c[1]] || [])) tiers[+m[1]].add(t);
  }

  const cTier = {};
  for (const f of txts(join(GAME, 'common/history/countries'))) {
    const t = read(f);
    for (const m of t.matchAll(/c:([A-Z]{3})\s*\??=\s*\{/g)) {
      let i = t.indexOf('{', m.index) + 1, d = 1;
      while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; }
      const e = t.slice(m.index, i).match(/effect_starting_technology_tier_(\d)_tech\s*=\s*yes/);
      if (e) cTier[m[1]] = +e[1];
    }
  }

  // shape: BUILDINGS = { s:STATE_X = { region_state:TAG = { create_building = { … } } } }
  const need = {}, owns = {};
  for (const f of txts(join(root, 'common/history/buildings'))) {
    const t = read(f);
    for (const rs of t.matchAll(/region_state:([A-Z]{3})\s*=\s*\{/g)) {
      let i = t.indexOf('{', rs.index) + 1, d = 1;
      while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; }
      const body = t.slice(rs.index, i), tag = rs[1];
      for (const cb of body.matchAll(/create_building\s*=\s*\{/g)) {
        let j = body.indexOf('{', cb.index) + 1, e = 1;
        while (j < body.length && e > 0) { if (body[j] === '{') e++; else if (body[j] === '}') e--; j++; }
        const blk = body.slice(cb.index, j);
        const bk = (blk.match(/building\s*=\s*"([a-z_0-9]+)"/) || [])[1];
        if (!bk) continue;
        owns[tag] = (owns[tag] || 0) + 1;
        const set = need[tag] = need[tag] || new Set();
        for (const g of (bTech[bk] || [])) set.add(g);
        const act = blk.match(/activate_production_methods\s*=\s*\{([^}]*)\}/);
        for (const q of (act ? act[1].match(/"([a-z_0-9]+)"/g) || [] : []))
          for (const g of (pmTech[q.replace(/"/g, '')] || [])) set.add(g);
      }
    }
  }

  const stats = { pms: Object.keys(pmTech).length, blds: Object.keys(bTech).length,
                  tiers: Object.keys(tiers).length, tiered: Object.keys(cTier).length, owners: Object.keys(need).length };
  const fail = [];
  if (stats.pms < 300) fail.push(`only ${stats.pms} production methods parsed`);
  if (stats.blds < 100) fail.push(`only ${stats.blds} buildings parsed`);
  if (stats.tiers < 4) fail.push(`only ${stats.tiers} starting tiers parsed`);
  if (stats.tiered < 50) fail.push(`only ${stats.tiered} countries have a starting tier`);
  if (stats.owners < 50) fail.push(`only ${stats.owners} countries own 1836 buildings`);
  if (fail.length) { console.error(`REFUSING TO REPORT for ${root}: the check did not find enough to be meaningful —\n  ` + fail.join('\n  ')); process.exit(2); }

  const gaps = {};
  for (const [tag, reqs] of Object.entries(need)) {
    const tier = cTier[tag]; if (tier == null) continue;
    const set = tiers[tier] || new Set();
    const missing = [...reqs].filter(r => !set.has(r) && !NAMED.has(r)).sort();
    if (missing.length) gaps[tag] = { tier, owns: owns[tag], missing };
  }
  return { gaps, stats };
}

// ---- main ------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const vs = args.includes('--vs-vanilla');
const arg = args.find(a => !a.startsWith('--')) || 'mod';
const MOD = /^[A-Za-z]:|^\//.test(arg) ? arg : join(REPO, arg);

const mine = analyse(MOD);
console.log(`parsed ${mine.stats.pms} PMs · ${mine.stats.blds} buildings · ${mine.stats.tiers} starting tiers · ` +
  `${mine.stats.tiered} countries tiered · ${mine.stats.owners} own 1836 buildings`);

if (!vs) {
  for (const [tag, g] of Object.entries(mine.gaps).sort())
    console.log(`  ${tag} (tier ${g.tier}, ${g.owns} buildings) MISSING: ${g.missing.join(', ')}`);
  const n = Object.keys(mine.gaps).length;
  console.log(n ? `\n${n} country/countries start with a building or method their technologies do not unlock`
                : `\nPASSED: every tiered country's starting set covers its own buildings and methods`);
  process.exit(0);
}

// --vs-vanilla: only a gap the BASE GAME does not already have is ours, and only ours is a failure
const base = analyse(GAME);
const introduced = [];
for (const [tag, g] of Object.entries(mine.gaps)) {
  const had = new Set((base.gaps[tag] || { missing: [] }).missing);
  const extra = g.missing.filter(t => !had.has(t));
  if (extra.length) introduced.push(`${tag} (tier ${g.tier}, ${g.owns} buildings): ${extra.join(', ')}`);
}
const inherited = Object.keys(base.gaps).length;
console.log(`vanilla itself has gaps in ${inherited} country/countries — inherited, not ours`);
if (introduced.length) {
  console.error(`\nFAILED: this build introduces a starting-technology gap vanilla does not have:\n  ` +
    introduced.join('\n  ') +
    `\n\n  Either the 1836 map should not place that building (config/start_exceptions.json), or the ` +
    `technology belongs in our own named grant (see emit_techs.mjs, section 4).`);
  process.exit(1);
}
console.log('\nPASSED: this build introduces no starting-technology gap beyond vanilla\'s own');
