// ⭐⭐ WHICH SECONDARY AND AUTOMATION METHODS MAY RUN BESIDE WHICH MAIN METHOD — reviewed ONE COMBINATION AT A TIME (user-ruled 2026-10-02,
// BALANCE_FRAMEWORK §10.93). ONE table, read by tools/emit_secondaries.mjs (a building does not carry a method beside a main method it is
// marked incompatible with) and by tools/lint_pm_combos.mjs (which fails a build that carries one, and warns on a pair nobody reviewed).
//
// The user, 2026-10-02 evening, rejecting a universal rule (no method two narrative eras ahead of its main method) the same session had built:
// *"No, no universal rule. Go through all vanilla combinations one by one, it's not like there are thousands of them. I agree that the assembly
// line on muskets doesn't make much sense though."* So every vanilla secondary or automation method of every tiered industry was judged beside
// every vanilla main method of that industry, on one question asked case by case: COULD A FACTORY WORKING THIS WAY PLAUSIBLY HAVE RUN THIS METHOD?
// — the main method still in use when the secondary's technology appeared, and the secondary not contradicting what the main method IS (a
// handcraft method with powered automation). The answer is recorded per pair; nothing is derived from a formula.
//
// What is NOT here, because it is decided elsewhere and stays decided there:
//   • vanilla's own PM gates (`unlocking_production_methods`: Elastics only beside the sewing-machine methods, Precision Tools beside the lathe and
//     mechanized-workshop methods, Bone China beside crystal glass and houseware plastics) — emit_secondaries honours them, the linter checks them;
//   • the craft rungs' exclusions (§10.91.1: automation, Vacuum Canning ×2, Patent Stills) — config-side, `exclude_secondary_pmgs` / `_pms`.
// A minted ADDITION (a rung with no `vanilla_pm`: Spray Finishing, Continuous Web Processing, Catalytic Synthesis) takes the verdicts of the
// vanilla method below it, the same inheritance the PM gates use.
import { readFileSync, readdirSync } from 'node:fs';

// main vanilla method -> { secondary vanilla method: why it may not run beside it }
export const NOT_BESIDE = {
  pm_handsewn_clothes: {
    pm_automatic_power_looms: 'electric automatic looms arrive around 1900, half a century after the sewing machine ended hand-sewing as a factory method',
  },
  pm_handcrafted_furniture: {
    pm_watertube_boiler_building_furniture_manufactory: 'a handcraft method: powering its machinery is what the Lathes method is',
    pm_rotary_valve_engine_building_furniture_manufactory: 'a handcraft method: powering its machinery is what the Lathes method is',
    pm_assembly_lines_building_furniture_manufactory: 'a handcraft method beside conveyor mass production',
  },
  pm_forest_glass: {
    pm_automatic_bottle_blowers: 'wood-fired forest glasshouses were gone long before the automatic bottle machine (1903)',
  },
  pm_crude_tools: {
    pm_watertube_boiler_building_tooling_workshop: 'a village-smithy method: powering it is what the Wrought Iron Tools method is',
    pm_rotary_valve_engine_building_tooling_workshop: 'a village-smithy method: powering it is what the Wrought Iron Tools method is',
    pm_assembly_lines_building_tooling_workshop: 'a village-smithy method beside conveyor mass production',
  },
  pm_pig_iron: {
    pm_assembly_lines_building_tooling_workshop: 'wrought-iron tools gave way to mild steel by the 1890s; conveyor lines arrive in the 1910s',
  },
  pm_muskets: {
    pm_assembly_lines_building_arms_industry: 'smoothbore muskets left military production in the 1860s; conveyor lines arrive in the 1910s (the user agreed, 2026-10-02)',
  },
  pm_rifles: {
    pm_assembly_lines_building_arms_industry: 'rifle-muskets and single-shot breechloaders left military production by the 1890s; conveyor lines arrive in the 1910s',
  },
  pm_cannons: {
    pm_assembly_lines_building_arms_industry: 'cast smoothbore cannon were obsolete by the 1870s; conveyor lines arrive in the 1910s',
  },
  pm_smoothbores: {
    pm_assembly_lines_building_arms_industry: 'smoothbore shell guns were obsolete by the 1870s; conveyor lines arrive in the 1910s',
  },
  pm_percussion_caps: {
    pm_assembly_lines_building_munition_plant: 'cap-and-ball ammunition gave way to the metallic cartridge in the 1870s; conveyor lines arrive in the 1910s',
  },
};

// ⭐⭐ AN AUTOMATION THAT IS NARRATIVELY THE SAME AS A MAIN METHOD (user-ruled 2026-10-02, late evening: "1) remove them from lower, 'not
// yet upgraded' rungs 2) mandate them as is to primary rungs they match with"). Three pairs in the tiered industries — two sharing the main
// method's own technology, one the same idea under another technology. On the matching main method the building's automation group offers
// ONLY this method (vanilla quantities, always on — the group has no "off"), as a copy gated to that main method and carrying no technology or
// law gate of its own: the main method's technology IS this one (Mass Production needs Compression Ignition, which does not require Conveyors, so
// a copy keeping Conveyors would leave the group with nothing to run). Beside every main method listed BEFORE it in its industry's REVIEWED
// mains (the lower, not-yet-upgraded rungs) it is not allowed at all (derived into NOT_BESIDE below).
export const MANDATED = {
  pm_sewing_machines: { method: 'pm_mechanized_looms', why: 'the same technology (Mechanized Workshops) unlocks both' },
  pm_electric_sewing_machines: { method: 'pm_automatic_power_looms', why: 'the same technology (Electrical Capacitors) unlocks both' },
  pm_mass_automobile_production: { method: 'pm_assembly_lines_building_automotive_industry', why: 'mass production is the conveyor assembly line' },
};

// every pair the 2026-10-02 review looked at, per industry: each main x each secondary. A pair carried by a building and missing here was never
// reviewed (a patch added a method, or a book added an industry) — lint_pm_combos.mjs WARNS on it so the review can be extended.
// ⚠ Borderline pairs judged COMPATIBLE, recorded so the user can overturn them: Muskets / Cannons beside the Rotary Valve Engine (steam-powered
// armories of the 1850s-60s, as the products died out); Handsewn Clothes beside Mechanized Looms (weaving was mechanised while sewing was still
// by hand); Dye Workshops beside Automatic Power Looms; Leaded Glass beside Automatic Bottle Blowers; Pulp Pressing beside steam (paper mills
// were among the first steam-powered industries); Steam Engines beside Assembly Lines (steam engines were built into the 1940s); the Automated
// Bakery beside Sweeteners (the biscuit industry's lines).
export const REVIEWED = {
  food: { mains: ['pm_bakery', 'pm_sweeteners', 'pm_baking_powder'],
    secondaries: ['pm_cannery', 'pm_cannery_fish', 'pm_vacuum_canning', 'pm_vacuum_canning_principle_3', 'pm_pot_stills', 'pm_patent_stills', 'pm_automated_bakery'] },
  textile: { mains: ['pm_handsewn_clothes', 'pm_dye_workshops', 'pm_sewing_machines', 'pm_electric_sewing_machines'],
    secondaries: ['pm_craftsman_sewing', 'pm_elastics', 'pm_mechanized_looms', 'pm_automatic_power_looms'] },
  furniture: { mains: ['pm_handcrafted_furniture', 'pm_lathe', 'pm_mechanized_workshops'],
    secondaries: ['pm_luxury_furniture', 'pm_precision_tools', 'pm_watertube_boiler_building_furniture_manufactory',
      'pm_rotary_valve_engine_building_furniture_manufactory', 'pm_assembly_lines_building_furniture_manufactory'] },
  glass: { mains: ['pm_forest_glass', 'pm_leaded_glass', 'pm_crystal_glass', 'pm_houseware_plastics'],
    secondaries: ['pm_ceramics', 'pm_bone_china', 'pm_automatic_bottle_blowers'] },
  tooling: { mains: ['pm_crude_tools', 'pm_pig_iron', 'pm_steel', 'pm_rubber_grips'],
    secondaries: ['pm_watertube_boiler_building_tooling_workshop', 'pm_rotary_valve_engine_building_tooling_workshop', 'pm_assembly_lines_building_tooling_workshop'] },
  paper: { mains: ['pm_pulp_pressing', 'pm_sulfite_pulping', 'pm_bleached_paper'],
    secondaries: ['pm_watertube_boiler_building_paper_mill', 'pm_rotary_valve_engine_building_paper_mill'] },
  steel: { mains: ['pm_blister_steel_process', 'pm_bessemer_process', 'pm_open_hearth_process', 'pm_electric_arc_process'],
    secondaries: ['pm_watertube_boiler_building_steel_mill', 'pm_rotary_valve_engine_building_steel_mill'] },
  motor: { mains: ['pm_steam_engines', 'pm_electric_engines', 'pm_diesel_engines'],
    secondaries: ['pm_watertube_boiler_building_motor_industry', 'pm_rotary_valve_engine_building_motor_industry', 'pm_assembly_lines_building_motor_industry'] },
  automotive: { mains: ['pm_automobile_production', 'pm_mass_automobile_production'],
    secondaries: ['pm_aeroplane_production', 'pm_tank_production', 'pm_assembly_lines_building_automotive_industry'] },
  arms: { mains: ['pm_muskets', 'pm_rifles', 'pm_repeaters', 'pm_bolt_action_rifles'],
    secondaries: ['pm_rotary_valve_engine_building_arms_industry', 'pm_assembly_lines_building_arms_industry'] },
  artillery: { mains: ['pm_cannons', 'pm_smoothbores', 'pm_breech_loaders', 'pm_recoiled_barrels'],
    secondaries: ['pm_rotary_valve_engine_building_arms_industry', 'pm_assembly_lines_building_arms_industry'] },
  munition: { mains: ['pm_percussion_caps', 'pm_explosive_shells'],
    secondaries: ['pm_rotary_valve_engine_building_munition_plant', 'pm_assembly_lines_building_munition_plant'] },
  synthetics: { mains: ['pm_dye_production'], secondaries: ['pm_rayon'] },
  electrics: { mains: ['pm_telephones'], secondaries: ['pm_radios'] },
  art_academy: { mains: ['pm_traditional_art', 'pm_realist_art', 'pm_photographic_art', 'pm_film_art'],
    secondaries: ['pm_traditional_patronage', 'pm_bourgeoisie_patronage', 'pm_independent_artists'] },
};
export const REVIEWED_ON = '2026-10-02';

const REVIEWED_PAIR = new Set();
for (const { mains, secondaries } of Object.values(REVIEWED)) for (const m of mains) for (const s of secondaries) REVIEWED_PAIR.add(m + '|' + s);

// rule 1 of the mandate, derived: a mandated automation is not allowed beside any main method listed before its own (vanilla order, lowest first)
const LOC_NAME = { pm_sewing_machines: 'Sewing Machines', pm_electric_sewing_machines: 'Electric Sewing Machines', pm_mass_automobile_production: 'Mass Production' };
for (const { mains } of Object.values(REVIEWED)) mains.forEach((m, i) => {
  const md = MANDATED[m]; if (!md) return;
  for (const lower of mains.slice(0, i)) {
    const why = `kept for the ${LOC_NAME[m] || m} rung it is the same thing as (${md.why}), not offered to the rungs below it`;
    (NOT_BESIDE[lower] ||= {})[md.method] ||= why;
  }
});

// why `sec` may not run beside `main` (both VANILLA method keys), or null
export const notBeside = (main, sec) => (main && NOT_BESIDE[main] && NOT_BESIDE[main][sec]) || null;
export const reviewed = (main, sec) => REVIEWED_PAIR.has(main + '|' + sec);
// the automation method a main method must always run (a VANILLA key), or null
export const mandatedFor = main => (main && MANDATED[main] && MANDATED[main].method) || null;

// ⭐⭐ THE MOST BASIC SECONDARY METHOD AVAILABLE BESIDE A RUNG'S MAIN METHOD (user-ruled 2026-10-03: "BE numbers should mean 'under most basic of
//   all secondary PMs available for the building'. Not 'main PM only'"). Per secondary group the rung carries, the group's FIRST member that the
//   vanilla PM gate, the compatibility table and the mandates allow beside it (a principle-gated member is skipped: it needs a power-bloc principle).
//   Normally the "off" method — no goods, no jobs — so nothing changes; beside a mandated main method it is the mandated automation, and for the art
//   academy (whose jobs live in its ownership group) it is Traditional Patronage, which is what `tierEmployment()` already charged it. The DESIGN-side
//   reading: the book generator restates `target_be` / `wage_pct` with it and build.ps1 labels the building with it; `lint_profitability.awk` reads the
//   EMITTED mod the same way and checks the two agree. V = readVanilla(GAME) (lib_vanilla_ladder.mjs).
const listIn = (b, k) => { const m = new RegExp('\\b' + k + '\\s*=\\s*\\{([^}]*)\\}').exec(b || ''); return m ? (m[1].match(/[A-Za-z_0-9-]+/g) || []) : []; };
export const vanillaMainOfTier = (industry, t) => t.vanilla_pm ||
  ((industry.tiers || []).filter(x => (x.era ?? 0) <= (t.era ?? 0) && x.vanilla_pm).slice(-1)[0] || {}).vanilla_pm || null;
export function basicSecondaries(industry, t, V) {
  const main = vanillaMainOfTier(industry, t), mand = mandatedFor(main);
  const exclG = new Set(t.exclude_secondary_pmgs || []), exclP = new Set(t.exclude_secondary_pms || []);
  const out = [];
  for (const g of industry.secondary_pmgs || []) {
    if (exclG.has(g)) continue;
    const members = ((V.PMG || {})[g] || []).filter(p => !exclP.has(p));
    if (mand && members.includes(mand)) { out.push(mand); continue; }
    const pick = members.find(p => {
      const b = (V.PMBODY || {})[p] || '';
      if (/unlocking_principles/.test(b)) return false;
      const gate = listIn(b, 'unlocking_production_methods');
      if (gate.length && !gate.includes(main)) return false;
      return !notBeside(main, p);
    });
    if (pick) out.push(pick);
  }
  return out;
}
// WHAT THE BALANCE SHEET MAY OFFER BESIDE A RUNG'S MAIN METHOD (2026-10-03): per secondary group, the VANILLA members legal there under the same
// rules — the rung's exclusions, vanilla's PM gates against its vanilla main method, the reviewed table, a mandate as the group's only member — in
// vanilla order (the sheet prices vanilla methods; the mod's per-rung copies are their scaled twins). A group left with nothing but an "off"
// method (a body with no field but its texture) comes back EMPTY: the building does not carry it (emit_secondaries drops it the same way).
const isOffBody = b => b != null && !/=/.test(b.replace(/texture\s*=\s*"[^"]*"/g, '').replace(/^[^{]*\{/, '').replace(/\}\s*$/, ''));
export function secondaryOptions(industry, t, V) {
  const main = vanillaMainOfTier(industry, t), mand = mandatedFor(main);
  const exclG = new Set(t.exclude_secondary_pmgs || []), exclP = new Set(t.exclude_secondary_pms || []);
  const out = {};
  for (const g of industry.secondary_pmgs || []) {
    if (exclG.has(g)) { out[g] = []; continue; }
    const members = ((V.PMG || {})[g] || []).filter(p => !exclP.has(p));
    if (mand && members.includes(mand)) { out[g] = [mand]; continue; }
    const legal = members.filter(p => {
      const gate = listIn((V.PMBODY || {})[p] || '', 'unlocking_production_methods');
      if (gate.length && !gate.includes(main)) return false;
      return !notBeside(main, p);
    });
    out[g] = legal.every(p => isOffBody((V.PMBODY || {})[p])) ? [] : legal;
  }
  return out;
}
// their goods (vanilla quantities — a basic method is an "off" method or a labour-saving one, never a rescaled conversion) and their jobs, the
// jobs × the rung's workforce_mult as emit_secondaries scales them
export function basicTotals(industry, t, V) {
  const wm = t.workforce_mult != null ? +t.workforce_mult : 1;
  const tot = { in: {}, out: {}, emp: {}, methods: basicSecondaries(industry, t, V) };
  for (const p of tot.methods) {
    const b = (V.PMBODY || {})[p] || '';
    for (const m of b.matchAll(/goods_(input|output)_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) { const d = m[1] === 'input' ? 'in' : 'out'; tot[d][m[2]] = (tot[d][m[2]] || 0) + +m[3]; }
    for (const m of b.matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) tot.emp[m[1]] = (tot.emp[m[1]] || 0) + +m[2] * wm;
  }
  return tot;
}
// the rung's employment on the same basis: its own (× workforce_mult) plus its basic secondaries' — for every rung but the mandated ones and the art
// academy this is exactly `tierEmployment()` (an off method employs nobody; the academy's own employment is empty, so tierEmployment fell back to
// the same ownership method)
export function basicEmployment(industry, t, V) {
  const wm = t.workforce_mult != null ? +t.workforce_mult : 1;
  const out = {};
  for (const [p, n] of Object.entries(t.employment || {})) out[p] = (+n || 0) * wm;
  for (const [p, n] of Object.entries(basicTotals(industry, t, V).emp)) out[p] = (out[p] || 0) + n;
  return out;
}

// ⭐ THE TECHNOLOGY CLOSURE OF A MAIN METHOD (user-ruled 2026-10-03, §10.93: conveyors made a prerequisite of compression_ignition so Mass
// Production's mandated Assembly Lines can keep their own gate). A mandated copy keeps vanilla's technology gate only where every technology in
// it is IMPLIED by the main method's own - the building's technology and the method's, with all their prerequisites - in the tree the engine
// loads: the game's technology files, the mod's same-named files over them, and the mod's additive ones. Anything else would let a country hold
// the main method without the copy's technology, and a mandated group has nothing else to run.
// readTechPrereqs(GAME, MOD) -> id => [prerequisite ids]; techClosure(prereqOf, seeds) -> Set of the seeds and everything they need.
const blocksOf = s => {
  const out = {}; const L = s.split(/\r?\n/); let cur = null, depth = 0, buf = [];
  for (const l of L) { const c = l.split('#')[0];
    if (depth === 0) { const m = /^([a-zA-Z_][a-zA-Z_0-9-]*)\s*=\s*\{/.exec(c);
      if (m) { cur = m[1]; buf = [l]; depth = (c.match(/\{/g) || []).length - (c.match(/\}/g) || []).length;
        if (depth === 0) { out[cur] = buf.join('\n'); cur = null; } continue; } }
    else { buf.push(l); depth += (c.match(/\{/g) || []).length - (c.match(/\}/g) || []).length;
      if (depth <= 0) { out[cur] = buf.join('\n'); cur = null; } } }
  return out;
};
export function readTechPrereqs(GAME, MOD) {
  const d = 'common/technology/technologies', files = {};
  for (const root of [GAME, MOD]) { if (!root) continue; let fs = []; try { fs = readdirSync(root + '/' + d); } catch { continue; }
    for (const f of fs) if (f.endsWith('.txt')) files[f] = root + '/' + d + '/' + f; }
  const T = {};
  for (const f of Object.keys(files).sort()) Object.assign(T, blocksOf(readFileSync(files[f], 'utf8').replace(/^﻿/, '')));
  return id => { if (!(id in T)) throw new Error(`readTechPrereqs: no technology ${id} in the tree the engine loads`); return listIn(T[id].split(/\r?\n/).map(l => l.split('#')[0]).join('\n'), 'unlocking_technologies'); };
}
export function techClosure(prereqOf, seeds) {
  const seen = new Set(), st = [...seeds].filter(Boolean);
  while (st.length) { const t = st.pop(); if (seen.has(t)) continue; seen.add(t); for (const p of prereqOf(t)) st.push(p); }
  return seen;
}

// a stale table is a silent no-op, so every key is checked against the game's own method files: throws on a method vanilla does not define,
// and on an incompatibility the review never looked at
export function validateCompat(GAME) {
  const keys = new Set();
  for (const f of readdirSync(GAME + '/common/production_methods')) if (f.endsWith('.txt'))
    for (const m of readFileSync(GAME + '/common/production_methods/' + f, 'utf8').replace(/^﻿/, '').matchAll(/^([A-Za-z_][A-Za-z_0-9-]*)\s*=\s*\{/gm)) keys.add(m[1]);
  const bad = [];
  for (const [main, secs] of Object.entries(NOT_BESIDE)) {
    if (!keys.has(main)) bad.push('main ' + main);
    for (const s of Object.keys(secs)) { if (!keys.has(s)) bad.push('secondary ' + s); if (!reviewed(main, s)) bad.push(`${main} | ${s} is marked incompatible but not in REVIEWED`); }
  }
  for (const { mains, secondaries } of Object.values(REVIEWED)) for (const k of [...mains, ...secondaries]) if (!keys.has(k)) bad.push('reviewed ' + k);
  for (const [main, { method }] of Object.entries(MANDATED)) {
    if (!keys.has(main) || !keys.has(method)) bad.push(`mandate ${main} -> ${method}`);
    if (!reviewed(main, method)) bad.push(`mandate ${main} -> ${method} is not a reviewed pair`);
    if (NOT_BESIDE[main] && NOT_BESIDE[main][method]) bad.push(`mandate ${main} -> ${method} is also marked incompatible`);
  }
  if (bad.length) throw new Error('lib_secondary_compat: the table names methods the game does not define, or is inconsistent — ' + bad.join('; '));
}
