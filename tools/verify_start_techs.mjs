// THE 1836 STARTING-TECHNOLOGY CHECK, PER COUNTRY (ON_GAME_UPDATE.md).
//
//   node tools/verify_start_techs.mjs [modDir]      # default: mod
//
// The question: for every country, does its 1836 starting technology set unlock every production method
// its own 1836 buildings are told to activate, and every building they are told to build?
//
// It reads THE EMITTED MOD's history, because `replace_paths` makes our copy the only history the engine
// reads — and vanilla's production methods and buildings, overridden by ours where we own the file.
//
// ⚠⚠ THE UTF-8 BOM. Every Paradox script file starts with one, so a naive `^name = {` match makes the
// FIRST block of every file invisible. That silently dropped 8 of 110 PMs from a hand-rolled version of
// this check on 2026-08-12 and produced a clean result that was not earned. `strip()` exists for that.
// ⚠⚠ A VACUOUS PASS IS THE FAILURE MODE. The first run of this logic matched zero countries — wrong tag
// regexes for these file shapes — and reported PASSED. Hence `assertNonTrivial()`: the check refuses to
// report success unless it actually found countries, buildings and starting sets.
// ⚠ THE UNION ACROSS COUNTRIES IS NOT SUFFICIENT: a leader's generous set covers gaps a tier-3 or tier-4
// country's does not, and the lower tiers are exactly where 1836 drifts from vanilla. Report per country.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
// an absolute path is taken as-is, so the SAME check can be pointed at pure vanilla — which is the only
// way to tell a gap WE introduced from one the base game has always had
const ARG = process.argv[2] || 'mod';
const MOD = /^[A-Za-z]:|^\//.test(ARG) ? ARG : join(REPO, ARG);

const strip = s => s.replace(/^\uFEFF/, '');
const read = f => strip(readFileSync(f, 'utf8'));
const txts = d => existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.txt')).map(f => join(d, f)) : [];

// top-level blocks of a file, by name -> body
function blocks(txt) {
  const out = {}; const re = /^([A-Za-z_0-9]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(txt))) {
    let i = re.lastIndex, d = 1;
    while (i < txt.length && d > 0) { if (txt[i] === '{') d++; else if (txt[i] === '}') d--; i++; }
    out[m[1]] = txt.slice(re.lastIndex, i - 1);
  }
  return out;
}
const gate = body => { const u = body.match(/unlocking_technologies\s*=\s*\{([^}]*)\}/); return u ? u[1].trim().split(/\s+/).filter(Boolean) : []; };

// ---- what each production method and building requires -------------------------------------------
const pmTech = {}, bTech = {};
for (const dir of [join(GAME, 'common/production_methods'), join(MOD, 'common/production_methods')])
  for (const f of txts(dir)) for (const [k, v] of Object.entries(blocks(read(f)))) pmTech[k] = gate(v);
for (const dir of [join(GAME, 'common/buildings'), join(MOD, 'common/buildings')])
  for (const f of txts(dir)) for (const [k, v] of Object.entries(blocks(read(f)))) bTech[k] = gate(v);

// ---- every technology's era, so `add_era_researched` can be expanded ------------------------------
// ⚠⚠ THE SHORTHAND IS MOST OF THE GRANT. `add_era_researched = era_1` hands a country the WHOLE of
// mechanical era 1 without naming anything, and both tier-1 and tier-2 use it. A check that reads only
// `add_technology_researched` therefore reports Britain and France as missing `manufacturies` — 24
// countries' worth of false positives on the first run of this file. Expand the shorthand.
// ⚠ It reads the eras from the MOD's technology files where we own them, vanilla otherwise, because our
// re-eras (atmospheric_engine and crystal_glass to era 1) change who gets what for free.
const techEra = {};
for (const dir of [join(GAME, 'common/technology/technologies'), join(MOD, 'common/technology/technologies')])
  for (const f of txts(dir)) for (const [k, v] of Object.entries(blocks(read(f)))) {
    const e = v.match(/\bera\s*=\s*era_(\d)/); if (e) techEra[k] = +e[1];
  }

// ---- the starting sets ---------------------------------------------------------------------------
const tiers = {};
for (const [k, v] of Object.entries(blocks(read(join(MOD, 'common/scripted_effects/00_starting_inventions.txt'))))) {
  const m = k.match(/^effect_starting_technology_tier_(\d)_tech$/);
  if (!m) continue;
  const set = new Set([...v.matchAll(/add_technology_researched\s*=\s*([a-z_0-9]+)/g)].map(x => x[1]));
  for (const e of v.matchAll(/add_era_researched\s*=\s*era_(\d)/g))
    for (const [t, era] of Object.entries(techEra)) if (era <= +e[1]) set.add(t);
  tiers[+m[1]] = set;
}
// ⚠ the sets NEST: tier 1 is the richest and each lower tier is a subset declared by calling the one above
for (const [k, v] of Object.entries(blocks(read(join(MOD, 'common/scripted_effects/00_starting_inventions.txt'))))) {
  const m = k.match(/^effect_starting_technology_tier_(\d)_tech$/); if (!m) continue;
  for (const c of v.matchAll(/effect_starting_technology_tier_(\d)_tech\s*=\s*yes/g))
    for (const t of (tiers[+c[1]] || [])) tiers[+m[1]].add(t);
}

// ---- country -> which tier it is granted ----------------------------------------------------------
const cTier = {};
for (const f of txts(join(GAME, 'common/history/countries'))) {
  const t = read(f);
  for (const m of t.matchAll(/c:([A-Z]{3})\s*\??=\s*\{/g)) {
    const from = m.index; let i = t.indexOf('{', from) + 1, d = 1;
    while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; }
    const body = t.slice(from, i);
    const e = body.match(/effect_starting_technology_tier_(\d)_tech\s*=\s*yes/);
    if (e) cTier[m[1]] = +e[1];
  }
}

// ---- what each country's own 1836 buildings need ---------------------------------------------------
// shape: BUILDINGS = { s:STATE_X = { region_state:TAG = { create_building = { … } } } }
const need = {}, owns = {};
for (const f of txts(join(MOD, 'common/history/buildings'))) {
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

// ---- the check -------------------------------------------------------------------------------------
function assertNonTrivial() {
  const fail = [];
  if (Object.keys(pmTech).length < 300) fail.push(`only ${Object.keys(pmTech).length} production methods parsed`);
  if (Object.keys(bTech).length < 100) fail.push(`only ${Object.keys(bTech).length} buildings parsed`);
  if (Object.keys(tiers).length < 4) fail.push(`only ${Object.keys(tiers).length} starting tiers parsed`);
  if (Object.keys(cTier).length < 50) fail.push(`only ${Object.keys(cTier).length} countries have a starting tier`);
  if (Object.keys(need).length < 50) fail.push(`only ${Object.keys(need).length} countries own 1836 buildings`);
  if (fail.length) { console.error('REFUSING TO REPORT: the check did not find enough to be meaningful —\n  ' + fail.join('\n  ')); process.exit(2); }
}
assertNonTrivial();

// Vanilla's explicit named grant covers three technologies whose onset postdates 1836; that list is what
// it is for. A FOURTH such case appearing unnamed is exactly what this check exists to find.
const NAMED = new Set(['central_archives', 'mechanical_tools', 'intensive_agriculture']);
console.log(`parsed ${Object.keys(pmTech).length} PMs · ${Object.keys(bTech).length} buildings · ` +
  `${Object.keys(tiers).length} starting tiers (sizes ${Object.entries(tiers).sort().map(([k, v]) => k + ':' + v.size).join(' ')}) · ` +
  `${Object.keys(cTier).length} countries tiered · ${Object.keys(need).length} own 1836 buildings`);

let bad = 0, unt = 0;
for (const [tag, reqs] of Object.entries(need).sort()) {
  const tier = cTier[tag];
  if (tier == null) { unt++; continue; }
  const set = tiers[tier] || new Set();
  const missing = [...reqs].filter(r => !set.has(r) && !NAMED.has(r));
  if (missing.length) { bad++; console.log(`  ${tag} (tier ${tier}, ${owns[tag]} buildings) MISSING: ${missing.join(', ')}`); }
}
if (unt) console.log(`  (${unt} countries own buildings but declare no starting tier — vanilla grants them nothing by name)`);
console.log(bad ? `\nFAILED: ${bad} country/countries start with a building or method their technologies do not unlock`
                : `\nPASSED: every tiered country's starting set covers its own buildings and methods`);
process.exit(bad ? 1 : 0);
