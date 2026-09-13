// THE FOUR-RUNG STRUCTURE, FROM VANILLA — writes config/mod_config.<suffix>.json (suffix TIER4_SUFFIX, default tier4).
//
// ⭐⭐⭐ Reads the GAME and tools/lib_tier4_spec.mjs. Nothing else. (user-ruled 2026-09-04, the third time: "no six-rung-
//   canon data should be consulted whatsoever in preparing the canon4rungs". The previous generator cloned every rung
//   from the canonical six-rung config and copied that book's top-level blocks — hoard defines, the streetlight override,
//   the trade-centre ai_value, the NET tech grant — into the four-rung candidate. All of that is gone.)
//
// A tiered industry IS a vanilla building. Each rung IS one of its main-group methods, in vanilla order:
//   name     = vanilla's method name (English loc; the builder stubs every language from it)
//   gate     = the method's own unlocking technology, else the building's
//   recipe / staffing / pollution / icon = the method's own (the A/B book re-scales the recipe on rungs 1+)
//   key      = the vanilla building key for rung 0; <building>_<method> above it
//   building = "<vanilla building> (<vanilla method>)"
// ⭐⭐ RUNG ERAS COME FROM THE TECHNOLOGIES' GAME ERAS — THE ERA RULE (user-ruled 2026-09-13, lib_tier4_spec.mjs header,
//   BALANCE_FRAMEWORK §10.78): each rung's narrative era is derived from its gate's game era (1 → e0, 2 → e1, 3 → e1,
//   4 → e2, 5 → e3), bumped up only to keep one rung per era in vanilla order; a ladder that overflows needs a PLACEMENT
//   ruling in the spec, and every placement — derived or ruled — must keep each rung within ERA_TOLERANCE of its
//   technology's era, or this THROWS. Rung ORDER is never the key: it used to be (four methods → 0,1,2,3 by order, five
//   short industries hand-placed), which put electrics' telephone rung (a game-era-4 technology) on e1.
// The spec's ADDITIONS append a top rung. building_cost and ai_value are the A/B tool's (make_ab_config.mjs); the
// structure carries only what vanilla says.
//
// Pipeline: node tools/make_tier4_config.mjs -> node tools/make_tier4_techs.mjs -> node tools/make_ab_config.mjs --A 2.0
//   --B 1.5 --suffix <canon> --ai-steep glass,tooling:3 -> (research_events transplant) -> build.ps1 -Config ... -DryRun
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks } from './lib_vanilla_ladder.mjs';
import { N, ERA_YEARS, LOC, INDUSTRIES, PLACEMENT, ADDITIONS, ERA_MOVES, RESEARCH_EVENTS, CANON, bldName, slug,
         GAME_ERA_OF_ERA, ERA_TOLERANCE, eraOfGameEra, gameEraOfYear, derivePlacement, placementFaults } from './lib_tier4_spec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const SUFFIX = process.env.TIER4_SUFFIX || 'tier4';
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');

// ---- the game -------------------------------------------------------------------------------------------------
const BLD = {}, BLDFILE = {}, PMG = {}, PM = {};
for (const f of readdirSync(join(GAME, 'common/buildings'))) if (f.endsWith('.txt'))
  for (const [k, body] of Object.entries(blocks(rd(join(GAME, 'common/buildings', f))))) { BLD[k] = body; BLDFILE[k] = f.replace(/\.txt$/, ''); }
for (const f of readdirSync(join(GAME, 'common/production_method_groups'))) if (f.endsWith('.txt'))
  for (const [k, body] of Object.entries(blocks(rd(join(GAME, 'common/production_method_groups', f))))) PMG[k] = body;
for (const f of readdirSync(join(GAME, 'common/production_methods'))) if (f.endsWith('.txt'))
  for (const [k, body] of Object.entries(blocks(rd(join(GAME, 'common/production_methods', f))))) PM[k] = body;
// English localisation, key -> string
const ENLOC = (() => { const loc = {}; const walk = d => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('_l_english.yml')) { for (const line of rd(p).split(/\r?\n/)) { const m = line.match(/^\s*([A-Za-z_0-9\-.]+):\d*\s*"(.*)"\s*$/); if (m && !(m[1] in loc)) loc[m[1]] = m[2]; } } } }; walk(join(GAME, 'localization/english')); return loc; })();
// The narrative onset of every vanilla technology — tools/tech_tree_spec.mjs's ONSET table, OUR dating of VANILLA's
// technologies (first practical commercial use). Read from that file's source so there is one table.
const ONSET = (() => { const src = rd(join(REPO, 'tools/tech_tree_spec.mjs')); const i = src.indexOf('const ONSET = {'); if (i < 0) throw new Error('tech_tree_spec.mjs: ONSET table not found'); let j = i + 'const ONSET = '.length, d = 0; const st = j; do { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } while (d > 0); return new Function('return (' + src.slice(st, j) + ')')(); })();

const list = (body, key) => { const m = body.match(new RegExp('(^|\\s)' + key + '\\s*=\\s*\\{([^}]*)\\}')); return m ? m[2].trim().split(/\s+/).filter(Boolean) : []; };
// every vanilla technology's GAME era as the MOD ships it: vanilla's, or the spec's ERA_MOVES where one is ruled higher
const TECH_ERA = (() => { const out = {}; for (const f of readdirSync(join(GAME, 'common/technology/technologies'))) if (f.endsWith('.txt'))
  for (const [id, body] of Object.entries(blocks(rd(join(GAME, 'common/technology/technologies', f))))) { const e = +(body.match(/^\s*era\s*=\s*era_(\d)/m) || [])[1]; if (!e) throw new Error(`vanilla technology ${id}: no era`); out[id] = ERA_MOVES[id] != null && ERA_MOVES[id] > e ? ERA_MOVES[id] : e; }
  return out; })();
const scalar = (body, key) => { const m = body.match(new RegExp('^\\s*' + key + '\\s*=\\s*"?([^"\\r\\n#]+?)"?\\s*(#.*)?$', 'm')); return m ? m[1].trim() : null; };
const name = k => { const s = ENLOC[k]; if (!s) throw new Error(`no English name for ${k}`); return s; };
const goodsOf = b => ({ in: Object.fromEntries([...b.matchAll(/goods_input_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]])),
                        out: Object.fromEntries([...b.matchAll(/goods_output_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)].map(m => [m[1], +m[2]])) });
const employmentOf = b => Object.fromEntries([...b.matchAll(/building_employment_([a-z_]+)_add\s*=\s*([0-9]+)/g)].map(m => [m[1], +m[2]]));
const pollutionOf = b => { const m = b.match(/state_pollution_generation_add\s*=\s*([0-9.]+)/); return m ? +m[1] : 0; };

// ---- the structure ----------------------------------------------------------------------------------------------
const report = [], out = { industries: [] };
for (const { id, building } of INDUSTRIES) {
  const bb = BLD[building]; if (!bb) throw new Error(`${id}: vanilla building ${building} not found`);
  const pmgs = list(bb, 'production_method_groups'); if (!pmgs.length) throw new Error(`${id}: ${building} has no production_method_groups`);
  const [base, ...secondaries] = pmgs;
  const methods = list(PMG[base] || '', 'production_methods'); if (!methods.length) throw new Error(`${id}: base group ${base} has no methods`);
  if (methods.length > N) throw new Error(`${id}: vanilla has ${methods.length} main methods, more than ${N} rungs — needs a ruling`);
  const bldGate = list(bb, 'unlocking_technologies')[0] || null;
  const vb = name(building);
  // ⭐⭐ RUNG ERAS — THE ERA RULE. The gate of every vanilla method (its own technology, else the building's; a method
  //   with no gate at all is an 1836 method, game era 1) and of every ruled addition (its minted technology, placed by
  //   its own year) gives a game era; derivePlacement turns those into narrative eras. A ruled PLACEMENT entry replaces
  //   the derivation for the industries it names, and every placement is checked against ERA_TOLERANCE.
  const adds = ADDITIONS.filter(x => x.industry === id);
  const gateOf = pm => list(PM[pm] || '', 'unlocking_technologies')[0] || bldGate;
  const gameEras = [...methods.map(pm => { const g = gateOf(pm); if (!g) return 1; if (TECH_ERA[g] == null) throw new Error(`${id}: ${pm} is gated on ${g}, not a vanilla technology`); return TECH_ERA[g]; }),
                    ...adds.map(a => gameEraOfYear(a.year))];
  const derived = derivePlacement(gameEras);
  let eras = PLACEMENT[id];
  if (eras) {
    if (eras.length !== gameEras.length) throw new Error(`${id}: PLACEMENT has ${eras.length} eras for ${gameEras.length} rungs (${methods.length} vanilla methods + ${adds.length} additions)`);
  } else if (derived.overflow) {
    throw new Error(`${id}: the era rule cannot place this ladder — derived e${derived.eras.join('/e')} from game eras ${gameEras.join('/')} overflows e${N - 1}. `
      + `It needs a PLACEMENT ruling in tools/lib_tier4_spec.mjs (an early rung one era below its technology's, or a dropped addition).`);
  } else eras = derived.eras;
  const faults = placementFaults(id, eras, gameEras);
  if (faults.length) throw new Error(`THE ERA RULE (2026-09-13) is broken:\n  ${faults.join('\n  ')}`);
  const placed = PLACEMENT[id] ? 'ruled' : 'derived';
  const tiers = methods.map((pm, k) => {
    const body = PM[pm]; if (body == null) throw new Error(`${id}: method ${pm} not found`);
    const tech = gateOf(pm);
    if (!tech && eras[k] > 0) throw new Error(`${id}: ${pm} has no gate and neither has ${building}`);
    const g = goodsOf(body);
    const s = slug(pm);
    return {
      key: k === 0 ? building : `${building}_${s}`,
      name: bldName(vb, name(pm)),
      pm_key: `pm_main_${id}_${s}`, pmg_key: `pmg_main_${id}_${s}`,
      pm_name: name(pm), vanilla_pm: pm, tech,
      output_qty: null, inputs: g.in, output_good: null,
      employment: employmentOf(body), pollution: pollutionOf(body),
      texture: scalar(body, 'texture'),
      era: eras[k], tech_year: (tech && ONSET[tech]) || null, natural_year: ERA_YEARS[eras[k]],
      _out: g.out,
    };
  });
  // the industry's output good: what rung 0 makes most of
  const outGood = Object.entries(tiers[0]._out).sort((a, b) => b[1] - a[1])[0];
  if (!outGood) throw new Error(`${id}: ${tiers[0].vanilla_pm} outputs nothing`);
  for (const t of tiers) { t.output_qty = t._out[outGood[0]] ?? 0; t.output_good = outGood[0]; delete t._out; }
  // the vanilla building block, the fields the builder emits
  const bld = {};
  const al = list(bb, 'aliases'); if (al.length) bld.aliases = al;
  bld.building_group = scalar(bb, 'building_group');
  bld.icon = scalar(bb, 'icon');
  bld.city_type = scalar(bb, 'city_type');
  bld.levels_per_mesh = +scalar(bb, 'levels_per_mesh');
  const nat = scalar(bb, 'ai_nationalization_desire'); if (nat != null) bld.ai_nationalization_desire = +nat;
  bld.required_construction = scalar(bb, 'required_construction');
  bld.ownership_type = scalar(bb, 'ownership_type');
  bld.background = scalar(bb, 'background');
  if (/law_industry_banned/.test(bb)) bld.heavy_industry_law = true;
  if (/is_coastal\s*=\s*yes/.test(bb)) bld.coastal_only = true;
  for (const k of ['building_group', 'icon', 'city_type', 'required_construction', 'ownership_type', 'background']) if (!bld[k]) throw new Error(`${id}: ${building} has no ${k}`);
  // ⭐ RULE 1's mechanical twin: an addition may not be pegged to a technology that gates one of the industry's OWN
  //   secondary methods (that method under another name). Checked for every addition of this industry.
  const secBy = new Map();
  for (const g of secondaries) for (const pm of list(PMG[g] || '', 'production_methods')) for (const tech of list(PM[pm] || '', 'unlocking_technologies')) if (!secBy.has(tech)) secBy.set(tech, `${pm} in ${g}`);
  // ⭐ ADDITIONS (rule 2): the ruled top rung, if any
  const added = [];
  for (const a of ADDITIONS.filter(x => x.industry === id)) {
    if (secBy.has(a.tech)) throw new Error(`${id}: addition ${a.tech} duplicates the industry's own secondary method ${secBy.get(a.tech)} — RULE 1 (2026-09-04)`);
    if (tiers.length >= N) throw new Error(`${id}: addition ${a.tech} has no free slot — an addition never displaces a vanilla method`);
    const below = tiers[tiers.length - 1]; const era = eras[tiers.length];   // its placed era (the derivation saw the addition's game era)
    if (!(era > below.era)) throw new Error(`${id}: addition ${a.tech} placed at e${era}, not above the rung below (e${below.era})`);
    tiers.push({ key: a.key, name: bldName(vb, a.pm_name), pm_key: `pm_main_${id}_${a.tech}`, pmg_key: `pmg_main_${id}_${a.tech}`,
      pm_name: a.pm_name, tech: a.tech, output_qty: below.output_qty, inputs: { ...below.inputs }, output_good: below.output_good,
      employment: { ...below.employment }, pollution: below.pollution, texture: below.texture,
      era, tech_year: a.year, natural_year: a.year });
    added.push(a.tech);
  }
  const ind = { id, output_good: outGood[0], building: bld };
  // the builder whole-file-owns the vanilla file a tiered building lives in; 01_industry is its default
  if (BLDFILE[building] !== '01_industry') ind.source_file = `common/buildings/${BLDFILE[building]}.txt`;
  ind.secondary_pmgs = secondaries;
  ind.tiers = tiers;
  out.industries.push(ind);
  report.push({ id, n: tiers.length, placed, note: tiers.map((t, k) => { const imp = eraOfGameEra(gameEras[k]); const d = t.era - imp; return `e${t.era}${d ? (d > 0 ? '+' : '') + d : ''}:${t.pm_name}${t.vanilla_pm ? '' : '*'} [${t.tech} ge${gameEras[k]}]`; }).join(' · ') });
}

// ---- top level ----------------------------------------------------------------------------------------------------
const cfg = {
  _comment: `FOUR-RUNG STRUCTURE (${SUFFIX}) written by tools/make_tier4_config.mjs from the GAME FILES and tools/lib_tier4_spec.mjs `
    + `alone (user-ruled 2026-09-04: no six-rung data). Rungs are vanilla methods — vanilla name, gate, recipe, staffing, icon — `
    + `in vanilla order, each on the NARRATIVE ERA its technology's GAME era implies (THE ERA RULE, 2026-09-13: era_game_era ${GAME_ERA_OF_ERA.join('/')} `
    + `for e0..e${N - 1}, game era 2 rounds up to e1, bumped only to keep one rung per era; PLACEMENT holds the ruled adjustments; tolerance ±${ERA_TOLERANCE}); `
    + `the spec's ADDITIONS append a top rung. Recipes above era 0, building_cost and ai_value are make_ab_config.mjs's (the A/B book, keyed on ERA). `
    + `${ERA_YEARS.join('/')} are the era anchors.`,
  loc_basename: LOC.basename, languages: LOC.languages,
  // ⭐ THE ERA RULE, carried by the book: narrative era -> game era (era_pm.mjs gates methods through it; lint_tier_eras.mjs
  //   checks placement through its inverse), the anchor years, and the tolerance every rung was checked against.
  era_game_era: [...GAME_ERA_OF_ERA],
  era_anchor_years: [...ERA_YEARS],
  _era_rule: `rung era = narrative era (0..${N - 1}, anchors ${ERA_YEARS.join('/')}) derived from the gate technology's GAME era through era_game_era (game era 2 rounds up to e1), bumped up only to keep one rung per era; every rung within ${ERA_TOLERANCE} era of its technology's; the rung index is never a key (user-ruled 2026-09-13, BALANCE_FRAMEWORK §10.78)`,
  // the four-rung canon's 1836 start is vanilla's, converted; the six-rung chain seed does not apply
  start_exceptions_file: 'config/start_exceptions.vanilla.json',
  // the ruled research-event parameters (§10.69) live in the spec — validated here against the industries that exist
  research_events: structuredClone(RESEARCH_EVENTS),
  _canon: CANON,
  industries: out.industries,
};
for (const [k, v] of Object.entries(cfg.research_events.necessity_anchors)) {
  if (!cfg.industries.some(i => i.id === k)) throw new Error(`research_events.necessity_anchors names ${k}, which this ladder does not tier`);
  // an anchor entry is a building key, a bg_ group, a good:, or a LIST of building keys (= one summed source, 2026-09-04)
  for (const a of v.flatMap(x => Array.isArray(x) ? x : [x])) if (typeof a === 'string' && a.startsWith('building_') && !cfg.industries.some(i => i.tiers.some(t => t.key === a)) && !BLD[a]) throw new Error(`research_events anchor ${k} -> ${a}: neither one of our rungs nor a vanilla building`);
}
writeFileSync(join(REPO, `config/mod_config.${SUFFIX}.json`), JSON.stringify(cfg));

console.log(`THE FOUR-RUNG LADDER FROM VANILLA — ${N} rungs, era anchors ${ERA_YEARS.join(' / ')} ↔ game eras ${GAME_ERA_OF_ERA.join(' / ')} (era 2 rounds up to e1)`);
console.log('  industry     rungs  placement  (* = addition; ±n = eras from the technology\'s own era, tolerance ±' + ERA_TOLERANCE + '; "ruled" = a PLACEMENT entry)');
for (const r of report) console.log('  ' + r.id.padEnd(12) + String(r.n).padStart(3) + '   ' + r.placed.padEnd(8) + r.note);
const nb = out.industries.reduce((a, i) => a + i.tiers.length, 0);
console.log(`\n  ${out.industries.length} tiered industries · ${nb} tier buildings · ${ADDITIONS.length} additions · vanilla untouched: port, shipyards, railway, power`);
console.log(`  wrote config/mod_config.${SUFFIX}.json — next: node tools/make_tier4_techs.mjs`);
