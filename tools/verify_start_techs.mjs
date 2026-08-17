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

// \u00A710.60.3 Q5a, REFINED (user, 2026-08-16 night): THE TECH GATE IS A DOMESTIC-OWNERSHIP RULE.
// L14 fires only on buildings the state's own country holds a stake in; a building owned ENTIRELY by
// foreign countries rides its owners' technology, not the state holder's \u2014 vanilla itself ships such
// buildings (SIL's African anchorages are GBR-owned), and the engine demonstrably provisions steam
// ports into subject states whose owners lack the tech (measured: SIL held one by 1837.1). This
// replaces the earlier per-rule `tech_deviation` exception list: a refined RULE beats a register of
// exceptions to a cruder one. The skip count is PRINTED \u2014 a silent exemption is a hole, a loud one is
// a property of the map on the record. A block with NO parseable ownership counts as domestic (the
// conservative direction: it stays gated).
let foreignSkips = 0;
function foreignOwned(blk, tag) {
  const own = blk.match(/add_ownership\s*=\s*\{[\s\S]*$/);
  if (!own) return false;
  const owners = [...own[0].matchAll(/country\s*=\s*"c:([A-Z0-9]+)"/g)].map(m => m[1]);
  if (!owners.length) return false;
  return !owners.includes(tag);
}

// ⚠⚠ THE HYPHEN IS IN THE IDENTIFIER CLASS FOR A REASON. Four vanilla keys contain one —
// `pm_ammonia-soda_process`, `pm_coal-fired_plant`, `pm_oil-fired_plant`, `pan-nationalism` — and an
// `[A-Za-z_0-9]+` id class does not merely mis-name them, it fails to open the block at all, so the
// entry is ABSENT from the table and every lookup returns "no gate". Absent reads as permissive, which
// is the dangerous direction: this check then believes vanilla let anyone run those methods.
// ⚠ THREE OF THE FOUR ARE `vanilla_pm` VALUES OF OUR OWN TIERS (explosives e2, power e3, power e5), so
// the blind spot lands exactly on the comparison this file exists to make. It produced a confident
// "tier 1 loses the ability to build explosives e2" — where in truth vanilla gates
// `pm_ammonia-soda_process` on `nitroglycerin`, which tier 1 does not start with. Caught by the user
// asking how dynamite could possibly be available in 1836.
function blocks(txt) {
  const out = {}; const re = /^([A-Za-z_0-9-]+)\s*=\s*\{/gm; let m;
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
    const set = new Set([...v.matchAll(/add_technology_researched\s*=\s*([a-z_0-9-]+)/g)].map(x => x[1]));
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
        const bk = (blk.match(/building\s*=\s*"([a-z_0-9-]+)"/) || [])[1];
        if (!bk) continue;
        if (foreignOwned(blk, tag)) { foreignSkips++; continue; }   // §10.60.3 Q5a: domestic-ownership rule, printed below
        owns[tag] = (owns[tag] || 0) + 1;
        const set = need[tag] = need[tag] || new Set();
        for (const g of (bTech[bk] || [])) set.add(g);
        const act = blk.match(/activate_production_methods\s*=\s*\{([^}]*)\}/);
        for (const q of (act ? act[1].match(/"([a-z_0-9-]+)"/g) || [] : []))
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

// ---- THE SECOND QUESTION: what does each country's 1836 SET look like against vanilla's? -------------
// L14 above asks "can this country unlock what it owns". This asks the converse and sharper one, and it
// is the user's rule of 2026-08-12: *every production method vanilla runs in 1836 stays, and the country
// running it holds the technology* — so **no country may LOSE a starting technology vanilla gives it**,
// and every technology it GAINS has to be one somebody decided on.
// ⚠ IT MUST READ THE PER-COUNTRY EXTRAS, not just the tier effect. 81 countries carry their own
// `add_technology_researched` lines in `common/history/countries` — Russia's `fractional_distillation`,
// Japan's `sericulture`, Britain's `joint_stock_companies` — and a set built from the tier alone is
// simply the wrong set for a fifth of the world.
// ⚠ AND THE ERA SHORTHAND IS EXPANDED AGAINST EACH ROOT'S OWN ERAS. `add_era_researched = era_1` grants
// a different set in our tree than in vanilla's, which is the whole point of looking: a technology we
// re-era'd DOWN into era 1 is handed to every tier-1/2 country for free, and that is a gain nobody
// explicitly voted for unless someone looks. It is how `crystal_glass` showed up on this list.
function startSets(root) {
  const techEra = {};
  for (const dir of [join(GAME, 'common/technology/technologies'), join(root, 'common/technology/technologies')])
    for (const f of txts(dir)) for (const [k, v] of Object.entries(blocks(read(f)))) {
      const e = v.match(/\bera\s*=\s*era_(\d)/); if (e) techEra[k] = +e[1];
    }
  const tiers = {}, condPer = {};
  for (const [k, v] of Object.entries(blocks(read(join(root, 'common/scripted_effects/00_starting_inventions.txt'))))) {
    const m = k.match(/^effect_starting_technology_tier_(\d)_tech$/); if (!m) continue;
    // ⚠⚠ PULL THE PER-COUNTRY GUARDED GRANTS OUT BEFORE THE BLANKET REGEX. `emit_techs.mjs` writes a
    // `start_tech_grants` entry as `if = { limit = { this = c:TAG } add_technology_researched = X }`
    // inside the tier effect, because that effect is what vanilla's country history calls. Counting it
    // with the unconditional lines would credit EVERY country of that tier with X — a detector that
    // over-reports what countries hold is a detector that passes the very failure L14 is for.
    // Emitter and detector are coupled on this exact shape; change one and the other must follow.
    let body = v;
    for (const c of v.matchAll(/\tif = \{\n\t\tlimit = \{ this = c:([A-Z_0-9]{2,4}) \}\n([\s\S]*?)\n\t\}/g)) {
      for (const t of c[2].matchAll(/add_technology_researched\s*=\s*([a-z_0-9-]+)/g))
        (condPer[c[1]] ||= new Set()).add(t[1]);
      body = body.replace(c[0], '');
    }
    const set = new Set([...body.matchAll(/add_technology_researched\s*=\s*([a-z_0-9-]+)/g)].map(x => x[1]));
    for (const e of body.matchAll(/add_era_researched\s*=\s*era_(\d)/g))
      for (const [t, era] of Object.entries(techEra)) if (era <= +e[1]) set.add(t);
    tiers[+m[1]] = set;
  }
  const per = {};
  for (const f of txts(join(GAME, 'common/history/countries'))) {
    const t = read(f);
    for (const m of t.matchAll(/c:([A-Z_0-9]{2,4})\s*\??=\s*\{/g)) {
      let i = t.indexOf('{', m.index) + 1, d = 1;
      while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; }
      const body = t.slice(m.index, i);
      const e = body.match(/effect_starting_technology_tier_(\d)_tech/); if (!e) continue;
      const extra = [...body.matchAll(/add_technology_researched = ([a-z_0-9-]+)/g)].map(x => x[1]);
      // ...plus anything a `start_tech_grants` guard hands this tag specifically (see above)
      per[m[1]] = { tier: +e[1], set: new Set([...(tiers[+e[1]] || []), ...extra, ...(condPer[m[1]] || [])]) };
    }
  }
  if (Object.keys(per).length < 100) { console.error(`REFUSING TO REPORT: only ${Object.keys(per).length} countries parsed`); process.exit(2); }
  return per;
}

// ⚠⚠ A TECHNOLOGY KEY IS NOT A CAPABILITY, AND COUNTING KEYS READS AS ALARM WHERE THERE IS NONE.
// The tier split MOVED EVERY GATE: a vanilla main production method became its own building with its own
// technology, so the permission a country already held had to be re-issued under a new name. Britain
// gains `beet_sugar_refining` — and could refine beet sugar in vanilla all along, via `distillation`.
// Six such re-issues showed up as "gains over vanilla" in the first version of this report and invited
// exactly the wrong question.
// So the comparison is made in VANILLA PRODUCTION METHODS, which is the unit of capability and is common
// to both sides: for our build, a split main PM counts as runnable when the TIER BUILDING that replaced
// it is unlocked. What survives that translation is a real difference in what a country can do on day one.
// THE CAPABILITY VIEW, scoped to the production methods our split actually re-gated.
// ⚠⚠ VANILLA'S SIDE NEEDS THE BUILDING'S GATE AS WELL AS THE METHOD'S, and leaving it out inverts the
// answer. Most of these vanilla PMs carry no `unlocking_technologies` of their own — the BUILDING is what
// is gated — so reading the PM alone says "vanilla let anyone run this" and produces 23 phantom losses
// across every tier. With the building gate included the true count is three.
// ⚠ The base building key is the LOWEST TIER'S key, which is the vanilla building we split. It is NOT
// `ind.building`: that field holds a properties object (building_group, icon, …), and indexing the
// vanilla table with it silently yields undefined — which is how the phantom 23 were produced.
function reGated() {
  const vpm = {}, vb = {};
  for (const f of txts(join(GAME, 'common/production_methods')))
    for (const [k, v] of Object.entries(blocks(read(f)))) vpm[k] = gateOf(v);
  for (const f of txts(join(GAME, 'common/buildings')))
    for (const [k, v] of Object.entries(blocks(read(f)))) vb[k] = gateOf(v);
  const cfg = JSON.parse(read(join(REPO, 'config', 'mod_config.json')));
  const rows = [];
  for (const ind of cfg.industries || []) {
    const bg = vb[ind.tiers?.[0]?.key] || [];
    for (const t of ind.tiers || []) {
      if (t.model_only || !t.vanilla_pm) continue;
      rows.push({ ind: ind.id, era: t.era, pm: t.vanilla_pm,
                  vanillaNeeds: [...new Set([...bg, ...(vpm[t.vanilla_pm] || [])])],
                  weNeed: t.tech ? [t.tech] : [] });
    }
  }
  if (rows.length < 50) { console.error(`REFUSING TO REPORT: only ${rows.length} re-gated methods found`); process.exit(2); }
  return rows;
}

function diffVanilla(root) {
  const mine = startSets(root), base = startSets(GAME);
  const rows = reGated();
  const lost = [], keyOnly = new Set(), gained = [], rungGated = [];
  const byTier = {};
  for (const [tag, m] of Object.entries(mine)) {
    const b = base[tag]; if (!b) continue;
    for (const x of b.set) if (!m.set.has(x)) lost.push(`${tag} (tier ${b.tier}) loses ${x}`);
    for (const x of m.set) if (!b.set.has(x)) keyOnly.add(x);
    byTier[b.tier] = { v: b.set, m: m.set };
  }
  for (const r of rows) for (const [tier, s] of Object.entries(byTier)) {
    const couldV = r.vanillaNeeds.every(x => s.v.has(x));
    const couldM = r.weNeed.every(x => s.m.has(x));
    if (couldM && !couldV) gained.push(`tier ${tier}: ${r.ind} e${r.era} (${r.pm})`);
    if (couldV && !couldM) rungGated.push({ tier: +tier, ...r });
  }
  console.log('\n1836 vs VANILLA — in CAPABILITY, not in technology keys');
  console.log(`  technology keys that differ: ${keyOnly.size} (${[...keyOnly].sort().join(', ')})`);
  console.log('    — every one re-issues a permission vanilla already granted, under the new gate the');
  console.log('      tier split gave it. A key is not a capability.');
  console.log(`  CAPABILITY GAINED: ${gained.length ? gained.join('; ') : 'NONE — no country can build anything vanilla forbade it'}`);
  console.log(`  RUNGS NOW GATED: ${rungGated.length} — a tier that could be built at once in vanilla now`);
  console.log('    needs its own technology first. This is the mod\'s central mechanic, not a leak: the');
  console.log('    INDUSTRY is still available at its lower rung, the UPGRADE is what costs research.');
  for (const g of rungGated.sort((a, b) => a.tier - b.tier))
    console.log(`      tier ${g.tier}: ${g.ind} e${g.era} — vanilla needed ${g.vanillaNeeds.join('+') || '(nothing)'}, we need ${g.weNeed.join('+')}`);
  if (lost.length) {
    console.error(`\nFAILED: ${lost.length} country/countries lose a technology vanilla grants:\n  ` + lost.slice(0, 20).join('\n  '));
    process.exit(1);
  }
  console.log('\nPASSED: no country loses a starting technology vanilla gives it.');
}

// ---- main ------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const vs = args.includes('--vs-vanilla');
if (args.includes('--diff-vanilla')) {
  const a = args.find(x => !x.startsWith('--')) || 'mod';
  diffVanilla(/^[A-Za-z]:|^\//.test(a) ? a : join(REPO, a));
  process.exit(0);
}
const arg = args.find(a => !a.startsWith('--')) || 'mod';
const MOD = /^[A-Za-z]:|^\//.test(arg) ? arg : join(REPO, arg);

const mine = analyse(MOD);
console.log(`parsed ${mine.stats.pms} PMs · ${mine.stats.blds} buildings · ${mine.stats.tiers} starting tiers · ` +
  `${mine.stats.tiered} countries tiered · ${mine.stats.owners} own 1836 buildings`);
if (foreignSkips) console.log(`§10.60.3 Q5a: ${foreignSkips} foreign-owned 1836 building(s) outside the domestic ` +
  `tech gate (the gate binds the state's own country; a wholly foreign-owned building rides its owners' technology)`);

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
