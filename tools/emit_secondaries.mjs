// ⭐⭐ PER-TIER SECONDARY PRODUCTION METHODS — the scaling the tier split forgot.
//
// THE DEFECT (user-found 2026-09-01): a tier building's MAIN recipe is scaled up the ladder
// (x2.5 per rung, x15.6 end to end) while its SECONDARY methods keep VANILLA quantities, because
// they are vanilla PMs shared by every rung. Measured on electrics: `pm_radios` converts 33.3% of
// an e1 building's telephone output, 13.3% of e2's and 5.3% of e3's — and since it is the only
// radio source in the mod, world radio supply is capped at 40/level however big the plant is.
// That is why radios sat at the +75% input ceiling on 48 units of supply.
//
// THE RULE (user-ruled 2026-09-01): every tier's secondary must hold the SAME RATIO to its main
// output as vanilla does UNDER THE LOWEST PRIMARY PM THAT ALLOWS THAT SECONDARY. Inputs follow the
// tier's own output/input logic rather than the output scale, so a secondary is as input-efficient
// as the rung carrying it. One PM cannot hold per-tier numbers, so each (tier, secondary) pair gets
// its own minted PM and PMG.
//
// FOUR RULINGS baked in, all user-ruled the same day:
//   1. `pm_rayon` IS rescaled. It sorts with the labour-savers because it cuts laborers, but its
//      net employment is ZERO (-1000 laborers, +1000 machinists) — a skill-mix shift wrapped around
//      a goods conversion (wood -> silk), not an automation method.
//   2. EMPLOYMENT DOES NOT SCALE. `level_scaled` employment is copied verbatim. A tier-3 cannery
//      makes 15.6x the groceries with the same 500 extra machinists, deliberately.
//      ⭐ AMENDED 2026-09-30 for rungs with `workforce_mult` < 1 (the craft rungs, BALANCE_FRAMEWORK §10.91.1): their
//      secondaries' employment is × workforce_mult, because the LEVEL itself is a tenth of a 5,000-head level.
//   3. CROSS-INDUSTRY OUTPUTS RESCALE TOO — porcelain, luxury_clothes, luxury_furniture, liquor,
//      aeroplanes, tanks, radios. These reach their markets through a side door that is not on the
//      tier ladder, and the ruling is that the side door scales with the building anyway.
//   4. `pm_vacuum_canning_principle_3` rescales, though the solver never selects a power-bloc-gated
//      method, so it is invisible in every scenario we measure and visible only in play.
//
// ⚠ LABOUR-SAVING METHODS ARE EXCLUDED BY RULING and keep vanilla quantities: every
//   `pm_assembly_lines_*`, `pm_rotary_valve_engine_*`, `pm_watertube_boiler_*`, plus
//   `pm_automated_bakery`, `pm_automatic_bottle_blowers`, `pm_automatic_power_looms`,
//   `pm_mechanized_looms`. Each spends goods purely to cut laborers and outputs nothing, so there
//   is no output ratio to preserve.
// ⚠ The "off" methods (`pm_no_radios`, `pm_automation_disabled`, …) carry no goods and no jobs and
//   are kept by reference, not minted.
//
// It reads the EMITTED mod and rewrites it — the same principle as verify_pms.mjs: an emitter bug
// cannot hide behind the generator's own view of what it meant to write.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
const BOM = '﻿';
import { join } from 'node:path';
import { notBeside, validateCompat, mandatedFor, MANDATED, readTechPrereqs, techClosure } from './lib_secondary_compat.mjs';

const MOD = process.argv[2] || 'mod';
const CFGP = process.argv[3] || process.env.MOD_CONFIG || 'config/mod_config.json';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');

function blocks(t) {
  const o = {}; const re = /^([a-z_0-9-]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(t))) {
    let i = re.lastIndex, d = 1;
    while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; }
    o[m[1]] = t.slice(re.lastIndex, i - 1); re.lastIndex = i;
  }
  return o;
}

// the labour-saving exclusion, by RULING. Matched on the vanilla PM key.
const LABOUR_SAVING = /^(pm_assembly_lines_|pm_rotary_valve_engine_|pm_watertube_boiler_)|^pm_(automated_bakery|automatic_bottle_blowers|automatic_power_looms|mechanized_looms)$/;

const PMG = {}, PM = {};
for (const f of readdirSync(GAME + '/common/production_method_groups'))
  Object.assign(PMG, blocks(rd(GAME + '/common/production_method_groups/' + f)));
for (const f of readdirSync(GAME + '/common/production_methods'))
  Object.assign(PM, blocks(rd(GAME + '/common/production_methods/' + f)));
const TECH = {};
for (const f of readdirSync(GAME + '/common/technology/technologies'))
  Object.assign(TECH, blocks(rd(GAME + '/common/technology/technologies/' + f)));
const techGates = b => listOf(b || '', 'unlocking_technologies');
// the tree THIS build emitted (the game's technology files with the mod's over them) - read once, on first use, by the mandated copies
let PREREQ_OF = null;
const PREREQ = () => (PREREQ_OF ||= readTechPrereqs(GAME, MOD));
// ⚠⚠ A TECH GATE CAN IMPLY A LATER MAIN METHOD (user-caught 2026-09-01). `pm_radios` needs `radio`,
//   and radio's PREREQUISITE CLOSURE contains `electrical_generation` — the technology our e2 rung
//   stands on. So anyone able to run the radio method necessarily already has the e2 main method,
//   and the lowest primary PM that ALLOWS the secondary is e2, not rung 0. Taking rung 0 made the
//   radio ratio 2.5x too generous. Walk the closure and take the HIGHEST rung it implies.
const closure = (t, seen = new Set()) => {
  if (!t || seen.has(t)) return seen;
  seen.add(t);
  for (const p of techGates(TECH[t])) closure(p, seen);
  return seen;
};

const cfg = JSON.parse(rd(CFGP));

// ⭐⭐ NARRATIVE COMPATIBILITY, PAIR BY PAIR (user-ruled 2026-10-02, BALANCE_FRAMEWORK §10.93): "ensure that all secondary and automation
//   PMs are narratively compatible with the primary PMs of our tiered industries" — and, the same evening, "No, no universal rule. Go through
//   all vanilla combinations one by one". tools/lib_secondary_compat.mjs holds the reviewed table (Assembly Lines not beside Muskets, Rifles,
//   Cannons, Smoothbores, Percussion Caps or Wrought Iron Tools; no powered automation beside the handcraft methods; …). A rung is judged by
//   its VANILLA main method — a minted addition by the vanilla method below it, the inheritance the PM gates use. ⚠ The rule acts on every
//   member of a group, the labour-saving automation kept by reference included: such a group is copied per building where a member has to go.
//   (A first cut the same evening used a universal formula — no method two narrative eras ahead of its main method — which the user rejected.)
validateCompat(GAME);
const vanillaMainOf = (industry, v) => v.vanilla_pm ||
  ((industry.tiers || []).filter(x => (x.era ?? 0) <= (v.era ?? 0) && x.vanilla_pm).slice(-1)[0] || {}).vanilla_pm || null;
const compatOk = (industry, p, v) => !notBeside(vanillaMainOf(industry, v), p);
// an "off" method — Traditional Looms, Automation Disabled, No Luxuries …: a vanilla method whose body is a texture and nothing else
const isOffMethod = p => { const b = PM[p]; return b != null && !/=/.test(b.replace(/texture\s*=\s*"[^"]*"/g, '')); };
const DROPPED = [];   // [building, group, method, why] — what a building no longer shows, printed so the build log says so

const PRICE = {};
for (const line of rd('tools/goods_prices.tsv').split(/\r?\n/).slice(1)) {
  const c = line.split('\t'); if (c.length >= 2 && c[0]) PRICE[c[0].trim()] = +c[1];
}

const goodsOf = b => {
  const inp = {}, out = {};
  for (const m of b.matchAll(/goods_input_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) inp[m[1]] = +m[2];
  for (const m of b.matchAll(/goods_output_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) out[m[1]] = +m[2];
  return { inp, out };
};
const val = o => Object.entries(o).reduce((a, [g, q]) => a + q * (PRICE[g] ?? 0), 0);
const listOf = (b, key) => {
  const m = new RegExp(key + '\\s*=\\s*\\{([\\s\\S]*?)\\}').exec(b);
  return m ? (m[1].match(/[a-z_0-9-]+/g) || []) : [];
};

// vanilla method -> the group that lists it, so a secondary's reference can be found in VANILLA's
// own main ladder rather than in ours. Ours is the wrong place to look: a RESTORED rung carries no
// `vanilla_pm` at all (electrics e2/e3), so walking our tiers silently fell back to rung 0 and left
// pm_radios referenced against pm_telephones when `radio` plainly implies `electrical_generation`.
const GROUP_OF = {};
for (const [g, gb] of Object.entries(PMG))
  for (const p of listOf(gb, 'production_methods')) if (!GROUP_OF[p]) GROUP_OF[p] = g;

const TIERS = {}, IND = {};
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  IND[ind.id] = ind;
  for (const t of ind.tiers || []) if (t.key) TIERS[t.key] = { ind: ind.id, t };
}

const outPMs = [], outPMGs = [];
const RESOLVED = {};   // building key -> minted pm key -> { from, ref, in, out }
const RENAME = {};     // building key -> vanilla pm -> minted pm, for the 1836 history
// ⭐ THE CRAFT RUNGS (BALANCE_FRAMEWORK §10.91.1, 2026-09-30) amend two rules for a rung carrying `workforce_mult` < 1:
//   RULE 2 BECOMES "EMPLOYMENT SCALES WITH THE LEVEL": a craft level is a tenth of a 5,000-head level, so a kept secondary's
//     employment is × workforce_mult (Craftsman Sewing +500 shopkeepers → +50). Unscaled, luxury / canning / distilling would add
//     50–200% to a 500-head level. The goods already scale with the rung's output through Rout/Rin.
//   EXCLUSIONS: `exclude_secondary_pmgs` groups are not on the building at all (build.ps1 drops them) and `exclude_secondary_pms`
//     members are dropped from the minted copy of their group (Vacuum Canning, Patent Stills). The 1836 history then names methods
//     of groups the building no longer has (pm_traditional_looms, pm_automation_disabled, pm_manual_glassblowing,
//     pm_manual_dough_processing), and the engine REJECTS a whole create_building over one invalid method — so the history pass
//     below strips them per building and asserts none survive.
const STRIP = {};      // building key -> Set of methods its 1836 history must not name
const craftChecked = [];
const report = [];
let minted = 0, groupsMinted = 0, hiddenCopies = 0;
// every copied method and group gets a loc line pointing at its vanilla source — the copies shipped WITHOUT one for
// every run since ab1 (700–1,000 `missing loc key` lines a run, raw keys in the building panel; BUGS_AND_FIXES 2026-09-03)
const locPairs = [];

for (const bfile of ['01_industry.txt', '06_urban_center.txt', '11_private_infrastructure.txt']) {
  const path = join(MOD, 'common/buildings', bfile);
  if (!existsSync(path)) continue;
  let text = rd(path);
  for (const [bkey, body] of Object.entries(blocks(text))) {
    const rec = TIERS[bkey]; if (!rec) continue;
    const { ind, t } = rec;
    const industry = IND[ind];
    const rung0 = (industry.tiers || []).slice().sort((a, b) => a.era - b.era)[0];
    const wmT = t.workforce_mult != null ? +t.workforce_mult : 1;
    // the building's main methods: its own rung, then the rungs merged into it (method_of, §10.91.2)
    const variants = [t, ...(industry.tiers || []).filter(x => x.method_of === bkey)];
    if (variants.length > 1 && wmT < 1) throw new Error(`emit_secondaries: ${bkey} is a craft rung (workforce_mult ${wmT}) and a merge host — the two amendments were never designed together`);
    // ⭐ ONE NAME, ONE VISIBLE ENTRY (user, 2026-10-05: "My problem is the UI clatter"). A merged building gets one copy of a secondary per
    //   main method, each scaled to that method and gated to it, so exactly one is valid at a time — but the panel listed BOTH, with the same
    //   name and icon, the other one greyed. Vanilla's own idiom for variants of one line (pm_steam_trains / pm_steam_trains_principle_transport_3,
    //   pm_vacuum_canning_principle_3) is `is_hidden_when_unavailable = yes`, so every copy that shares its name with another copy in the group
    //   carries it, and the dropdown shows only the copy beside the running main method. No number changes.
    //   ⚠ The field hides on ANY unavailability (MODDING_NOTES): a technology-gated line (cannery, stills, vacuum canning, elastics, precision
    //   tools) does not appear at all on a merged building until the technology is held, where a plain building shows it greyed. Accepted.
    const hideCopy = nb => /is_hidden_when_unavailable/.test(nb) ? nb : '\n\tis_hidden_when_unavailable = yes' + nb;
    const exclPms = new Set(t.exclude_secondary_pms || []);
    if ((t.exclude_secondary_pmgs || []).length || exclPms.size) {
      const s = STRIP[bkey] = new Set(exclPms);
      for (const g of (t.exclude_secondary_pmgs || [])) {
        if (!PMG[g]) throw new Error(`emit_secondaries: ${bkey} excludes group ${g}, which vanilla does not define`);
        for (const p of listOf(PMG[g], 'production_methods')) s.add(p);
      }
    }
    const gmatch = /production_method_groups\s*=\s*\{([\s\S]*?)\}/.exec(body);
    if (!gmatch) continue;
    // ⚠ IDEMPOTENT. build.ps1 runs this tool, so a mod built by the normal path already carries the
    //   MINTED group names — and on a second pass those are not vanilla PMG keys, so every group was
    //   skipped and the run reported "0 methods across 0 buildings". Strip our own suffix first, so
    //   the tool always reasons about the VANILLA groups whatever state the mod folder is in.
    const sfx = '_' + bkey.replace(/^building_/, '');
    const groups = (gmatch[1].match(/[a-z_0-9-]+/g) || [])
      .map(g => (!PMG[g] && g.endsWith(sfx) && PMG[g.slice(0, -sfx.length)]) ? g.slice(0, -sfx.length) : g);
    const newGroups = [];
    // a member kept at VANILLA quantities (an "off" method, or a labour-saving one) under the compatibility table: kept by name where
    // every main method of the building may run it, dropped where none may, and — in a merged building whose main methods disagree —
    // copied once per main method that may, each copy gated to that method (vanilla quantities: these methods carry no output ratio)
    const byName = (p, g) => {
      if (!PM[p]) return [p];
      const ok = variants.filter(v => compatOk(industry, p, v));
      if (ok.length === variants.length) return [p];
      if (!ok.includes(t)) (STRIP[bkey] ||= new Set()).add(p);   // the 1836 history runs the host's own method: it may not name p
      const why = v => notBeside(vanillaMainOf(industry, v), p);
      if (!ok.length) { DROPPED.push([bkey, g, p, why(variants[0])]); return []; }
      for (const v of variants) if (!ok.includes(v)) DROPPED.push([bkey, g, p, `beside ${v.pm_key}: ${why(v)}`]);
      return ok.map(v => {
        const nk = p + '_' + v.key.replace(/^building_/, '');
        let nb = PM[p];
        nb = /unlocking_production_methods/.test(nb) ? nb.replace(/unlocking_production_methods\s*=\s*\{[\s\S]*?\}/, 'unlocking_production_methods = { ' + v.pm_key + ' }')
          : '\n\tunlocking_production_methods = { ' + v.pm_key + ' }' + nb;
        if (ok.length > 1) { nb = hideCopy(nb); hiddenCopies++; }   // two copies of one name: show only the one beside the running main method
        outPMs.push(nk + ' = {' + nb + '}'); locPairs.push([nk, p]); minted++;
        return nk;
      });
    };
    for (const g of groups) {
      const gb = PMG[g];
      if (!gb || /^pmg_main_/.test(g)) { newGroups.push(g); continue; }
      const members = listOf(gb, 'production_methods');
      const rescalable = members.filter(p => PM[p] && !LABOUR_SAVING.test(p) &&
        /goods_(input|output)_[a-z_]+_add/.test(PM[p]));
      if (!rescalable.length) {
        // a group kept BY REFERENCE cannot drop a member or scale its employment — refuse rather than ship it wrong on a craft rung
        if (members.some(p => exclPms.has(p))) throw new Error(`emit_secondaries: ${bkey} excludes a member of ${g}, which is not minted per rung — exclude the whole group instead`);
        if (wmT < 1 && members.some(p => /building_employment_[a-z_]+_add\s*=\s*-?[1-9]/.test(PM[p] || '')))
          throw new Error(`emit_secondaries: ${bkey} (workforce_mult ${wmT}) keeps ${g} by reference, whose methods employ people at vanilla scale — exclude the group or give it goods`);
        // ⭐ A MANDATED AUTOMATION (lib_secondary_compat MANDATED, user-ruled 2026-10-02): on a main method whose automation is narratively
        //   the same thing (Sewing Machines ↔ Mechanized Looms, Electric Sewing Machines ↔ Automatic Power Looms, Mass Production ↔
        //   Assembly Lines), the group offers ONLY that method — a vanilla-quantity copy gated to the main method, with no law gate and no
        //   technology gate the main method does not already imply (below), so it runs whenever the main method runs and nothing else of the group can. A merged building gets one copy per main
        //   method (each gated to its own), so exactly one member is valid at a time; the vanilla members leave its 1836 history (none names them
        //   today). A building whose main methods are only partly mandated in one group was never designed: THROW.
        //   ⭐ (2026-10-03) A COPY KEEPS VANILLA'S OWN TECHNOLOGY GATE WHERE ITS MAIN METHOD IMPLIES IT: every technology of the gate within the
        //   prerequisite closure of the building's technology and the method's, in the tree THIS build emitted (emit_techs runs first) - Mechanized
        //   Looms on Sewing Machines (both Mechanized Workshops), Assembly Lines on Mass Production once conveyors is a prerequisite of
        //   compression_ignition (lib_tier4_spec PREREQ_ADDS, user-ruled the same day). A gate the main method does NOT imply is dropped as before:
        //   the group has nothing else to run, and a country holding the main method without it would be left with no valid method.
        const mand = variants.map(v => { const a = mandatedFor(vanillaMainOf(industry, v)); return a && members.includes(a) ? a : null; });
        let kept;
        if (mand.some(Boolean)) {
          if (!mand.every(Boolean)) throw new Error(`emit_secondaries: ${bkey}'s main methods are only partly mandated in ${g} (${variants.map((v, i) => v.pm_key + '=' + (mand[i] || 'none')).join(', ')}) — not designed`);
          kept = variants.map((v, i) => {
            const a = mand[i], nk = a + '_' + v.key.replace(/^building_/, '');
            const own = listOf(PM[a], 'unlocking_technologies'), seeds = (v === t ? [t.tech] : [t.tech, v.tech]).filter(Boolean);
            const implied = techClosure(PREREQ(), seeds), keepTech = own.length > 0 && own.every(x => implied.has(x));
            let nb = (keepTech ? PM[a] : PM[a].replace(/\n\s*unlocking_technologies\s*=\s*\{[^}]*\}/, '')).replace(/\n\s*(disallowing_laws|unlocking_laws)\s*=\s*\{[^}]*\}/g, '');
            nb = /unlocking_production_methods/.test(nb) ? nb.replace(/unlocking_production_methods\s*=\s*\{[\s\S]*?\}/, 'unlocking_production_methods = { ' + v.pm_key + ' }')
              : '\n\tunlocking_production_methods = { ' + v.pm_key + ' }' + nb;
            outPMs.push(nk + ' = {' + nb + '}'); locPairs.push([nk, a]); minted++;
            DROPPED.push([bkey, g, '(mandated) ' + a, `always on beside ${v.pm_key}: ${MANDATED[vanillaMainOf(industry, v)].why}` +
              (!own.length ? '' : keepTech ? `; keeps its own gate (${own.join(' ')}), implied by ${seeds.join(' + ')}` : `; its own gate (${own.join(' ')}) dropped - not implied by ${seeds.join(' + ') || 'no technology'}`)]);
            return nk;
          });
          for (const p of members) (STRIP[bkey] ||= new Set()).add(p);
        } else {
          // the compatibility table: where a member has to go (or be gated per main method), the group is copied for this building
          kept = members.flatMap(p => byName(p, g));
        }
        if (kept.join(' ') === members.join(' ')) { newGroups.push(g); continue; }
        // nothing left but an "off" method (Traditional Looms, Automation Disabled …): the group has no choice to offer — the building
        // does not carry it (and its 1836 history may not name it)
        if (kept.every(isOffMethod)) {
          for (const p of members) (STRIP[bkey] ||= new Set()).add(p);
          DROPPED.push([bkey, g, '(group) ' + g, 'nothing but an off method left']);
          continue;
        }
        const ng = g + '_' + bkey.replace(/^building_/, '');
        const tex = /texture\s*=\s*"[^"]*"/.exec(gb);
        const sel = /ai_selection\s*=\s*[a-z_]+/.exec(gb);
        outPMGs.push(ng + ' = {\n\t' + (tex ? tex[0] : '') + (sel ? '\n\t' + sel[0] : '') +
          '\n\tproduction_methods = {\n' + kept.map(x => '\t\t' + x).join('\n') + '\n\t}\n}');
        newGroups.push(ng); groupsMinted++;
        locPairs.push([ng, g]);
        continue;
      }

      // THE REFERENCE — the lowest primary PM that allows this secondary.
      //   PM-gated   -> the named method (bone china, elastics, precision tools).
      //   tech-gated -> the building's FIRST main PM: a technology gate does not require any
      //                 particular main method, so the earliest rung already allows it.
      const refFor = p => {
        const gated = listOf(PM[p], 'unlocking_production_methods');
        let refPm = gated.length ? gated[0] : null;
        if (!refPm) {
          // tech-gated: the closure of its own gate may already IMPLY a later rung's method, in
          // which case that later method is the lowest one that can actually run it.
          const cl = new Set();
          for (const tg of techGates(PM[p])) closure(tg, cl);
          // walk VANILLA's own main group for this building, in its listed order, and take the LAST
          // method the closure implies — that is the most advanced main PM guaranteed to be present.
          let best = null;
          const mainG = rung0 && rung0.vanilla_pm ? GROUP_OF[rung0.vanilla_pm] : null;
          for (const vpm of (mainG ? listOf(PMG[mainG], 'production_methods') : [])) {
            if (!PM[vpm]) continue;
            const need = techGates(PM[vpm]);
            if (!need.length || need.every(x => cl.has(x))) best = vpm;
          }
          refPm = best || (rung0 && rung0.vanilla_pm);
        }
        return refPm && PM[refPm] ? { pm: refPm, ...goodsOf(PM[refPm]) } : null;
      };

      const newMembers = [];
      for (const p of members) {
        if (exclPms.has(p)) continue;   // a craft rung does not carry it (Vacuum Canning, Patent Stills)
        const pb = PM[p];
        if (!pb || !rescalable.includes(p)) { newMembers.push(...byName(p, g)); continue; }
        const gatedOn = listOf(pb, 'unlocking_production_methods');
        // ⭐ ONE COPY PER MAIN METHOD OF THE BUILDING (BALANCE_FRAMEWORK §10.91.2, 2026-09-30): its own rung, then any rung
        //   merged into it as a second main method (`method_of`). Each copy is scaled to ITS method's output and input bill
        //   and is available only beside that method, so a merged building's secondaries stay in proportion to whichever
        //   main method it runs. A plain building has one variant and mints exactly what it always did, under the same names.
        let mintedHere = 0;
        const mineIdx = [];   // where this method's copies sit in outPMs: more than one ⇒ each is hidden when unavailable (hideCopy above)
        for (const v of variants) {
          // ⚠⚠ A PM-GATED SECONDARY KEEPS ITS RESTRICTION. Minting a per-tier copy and pointing its
          //   `unlocking_production_methods` at that tier's own method would make it available on EVERY
          //   rung — vanilla restricts bone china to advanced glassworks, elastics to sewing-machine
          //   mills, precision tools to lathe workshops, and the builder's own gate remap preserves
          //   that ("the secondary unlocks at exactly the tiers whose main PM satisfied it in vanilla").
          //   So a tier that does NOT satisfy the vanilla gate gets NO copy of it.
          //   ⚠⚠ UNTIL 2026-10-02 SUCH A TIER KEPT THE *ORIGINAL* VANILLA METHOD, on the theory that a method gated on main methods
          //   the building lacks "stays unavailable — the restriction intact". It did stay unavailable, AND THE GAME SHOWED IT, at
          //   vanilla numbers: Elastics (−70 clothes) on the Handsewn Clothes craft and on Dye Workshops, Precision Tools (−55
          //   furniture) on the Handcrafted Furniture craft, Bone China (−20 glass) on the Forest Glass craft and on Leaded Glass —
          //   deductions many times what a 500-worker craft level makes (the user's playtest of e1a12-ai1135). The user: "If those
          //   PMs are actually disallowed by something, we need to not show them (or not have)". Now the building simply does not
          //   carry them, and tools/lint_pm_combos.mjs FAILS the build on any method gated on main methods its building lacks.
          if (gatedOn.length) {
            // ⚠⚠ A MINTED RUNG HAS NO `vanilla_pm`, so `mine` used to be EMPTY and the rung always failed the
            //   gate — it kept the original vanilla secondary, which names main methods it does not have, so the
            //   method was silently unselectable. Furniture's e3 (spray finishing) could not take precision tools
            //   at all: reported from a live campaign, 2026-09-18 (ROADMAP step 8 P7; landmine L35). THE RULE, the
            //   same one build.ps1's gate remap uses: a rung with no `vanilla_pm` inherits the method of the
            //   nearest rung BELOW it that has one — the rung the generator already copies its recipe, staffing
            //   and icon from, so an addition is "the method after X" and belongs wherever X belongs. A gate that
            //   does not name that lower method still excludes the addition, which is correct.
            const below = (industry.tiers || []).filter(x => (x.era ?? 0) <= (v.era ?? 0) && x.vanilla_pm);
            const inherited = below.length ? below[below.length - 1] : null;
            const mine = [v.vanilla_pm || (inherited && inherited.vanilla_pm),
              ...(v.vanilla_pm_aliases || (inherited && inherited.vanilla_pm_aliases) || [])].filter(Boolean);
            if (!mine.some(x => gatedOn.includes(x))) continue;
          }
          // the compatibility table (lib_secondary_compat.mjs): no copy beside a main method the review marked it incompatible with
          if (!compatOk(industry, p, v)) { DROPPED.push([bkey, g, p, `beside ${v.pm_key}: ${notBeside(vanillaMainOf(industry, v), p)}`]); continue; }
          const ref = refFor(p);
          const g0 = v.output_good || industry.output_good || industry.good;
          const mainOutRef = ref ? val(ref.out) : 0;
          const mainInRef = ref ? val(ref.inp) : 0;
          const tierOut = (v.output_qty || 0) * (PRICE[g0] ?? 0);
          const tierIn = val(v.inputs || {});
          const Rout = mainOutRef > 0 ? tierOut / mainOutRef : 1;
          const Rin = mainInRef > 0 ? tierIn / mainInRef : Rout;
          const nk = p + '_' + v.key.replace(/^building_/, '');
          let nb = pb;
          // a NEGATIVE quantity (a reduction of the main good, or a saved input) rounds TOWARD ZERO at two decimals, so the
          // reductions of a full conversion can never sum past the main output by rounding alone (2026-09-13)
          const r2 = x => x < 0 ? -Math.floor(-x * 100 + 1e-9) / 100 : +x.toFixed(2);
          nb = nb.replace(/goods_output_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g,
            (_, g2, q) => 'goods_output_' + g2 + '_add = ' + r2(q * Rout));
          // ⚠⚠ A REDUCTION SCALES WITH ITS OWN GOOD, NOT WITH THE INPUT BILL. `pm_cannery` carries
          //   `goods_input_grain_add = -20`, i.e. "20 less grain than the main method uses". Scaling
          //   that by the AGGREGATE input-value ratio overshoots whenever the tier's recipe holds a
          //   different grain proportion than the reference method — which drove grain NEGATIVE on
          //   three food tiers and was caught by lint_negative_goods. So a good the reference method
          //   also consumes scales by THIS TIER'S share of THAT good; anything else falls back to the
          //   aggregate ratio.
          // ⚠⚠ THIS REGEX SHIPPED WITHOUT ITS BACKSLASHES FROM 2026-09-01 TO 2026-09-13 (`_adds*=s*`, i.e. "add, any number of
          //   the letter s, =, any number of the letter s"), so it matched NO vanilla line (`goods_input_grain_add = -20`) and
          //   every secondary's INPUTS stayed at vanilla quantities on every rung while its outputs scaled by Rout — an e2
          //   cannery made 4× vanilla's groceries for vanilla's meat and iron. Nothing failed; the cannery's saved grain simply
          //   never went negative. BUGS_AND_FIXES 2026-09-13; every four-rung measurement before that date carried it.
          nb = nb.replace(/goods_input_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g, (_, g2, q) => {
            const mine = (v.inputs || {})[g2], theirs = ref && ref.inp ? ref.inp[g2] : null;
            const k = (mine != null && theirs) ? (mine / theirs) : Rin;
            return 'goods_input_' + g2 + '_add = ' + r2(q * k);
          });
          // a gate naming a vanilla main PM must name OUR tier's method instead, or it never unlocks
          nb = nb.replace(/unlocking_production_methods\s*=\s*\{[\s\S]*?\}/,
            'unlocking_production_methods = { ' + v.pm_key + ' }');
          // a merged building's copies are each available only beside their own main method, gated or not in vanilla
          if (variants.length > 1 && !/unlocking_production_methods/.test(nb))
            nb = '\n\tunlocking_production_methods = { ' + v.pm_key + ' }' + nb;
          // the craft amendment to RULE 2: a fractional-unit rung's secondaries employ in proportion to its level
          if (wmT < 1) {
            nb = nb.replace(/building_employment_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g, (_, pr, q) => {
              const v = +q * wmT;
              if (v < 0) throw new Error(`emit_secondaries: ${bkey} keeps ${p}, which REMOVES ${pr} (${q}) — a craft rung must not carry labour-saving methods`);
              if (Math.abs(v - Math.round(v)) > 1e-9) throw new Error(`emit_secondaries: ${bkey} ${p}: ${pr} ${q} × ${wmT} is not whole`);
              return 'building_employment_' + pr + '_add = ' + Math.round(v);
            });
            craftChecked.push(`${bkey}:${p}`);
          }
          // ⭐⭐ THE RESOLVED GOODS GO IN THE CONFIG, NOT ONLY IN THE EMITTED TEXT. The first cut of
          //   this tool rewrote the mod alone, which left THREE disagreeing views of a good's supply:
          //   the GAME got scaled secondaries, the BALANCE UI read vanilla's flat quantities out of
          //   ui/vanilla.js, and era_inverse modelled no secondaries at all — so radios stayed a
          //   `fixed-supply` phantom at 48 and the ceiling warning survived a fix that had actually
          //   worked. The repo's rule is one implementation per quantity (ladderFaults, needSplit,
          //   recipeSnapshot); this is that rule applied to secondary goods.
          const rg = {};
          for (const m of nb.matchAll(/goods_input_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) (rg.in ||= {})[m[1]] = +m[2];
          for (const m of nb.matchAll(/goods_output_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) (rg.out ||= {})[m[1]] = +m[2];
          (RESOLVED[v.key] ||= {})[nk] = { from: p, ref: ref ? ref.pm : null, ...rg };
          // the 1836 history runs the HOST's own method (convert_history throws on a start block that lands on a merged rung)
          if (v === t) (RENAME[bkey] ||= {})[p] = nk;
          mineIdx.push(outPMs.length);
          outPMs.push(nk + ' = {' + nb + '}');
          locPairs.push([nk, p]);
          newMembers.push(nk); minted++; mintedHere++;
          report.push({ bkey: v.key, pm: p, Rout: +Rout.toFixed(2), Rin: +Rin.toFixed(2), ref: ref ? ref.pm : '(none)' });
        }
        if (mineIdx.length > 1) for (const i of mineIdx) {
          const at = outPMs[i].indexOf(' = {') + 4;
          outPMs[i] = outPMs[i].slice(0, at) + hideCopy(outPMs[i].slice(at, -1)) + '}';
          hiddenCopies += 1;
        }
        // no main method of this building may run it (the vanilla gate, or the era rule): the building does not carry it at all.
        // (It used to keep the vanilla ORIGINAL, which the game then showed at vanilla numbers — see the gate note above.)
        if (!mintedHere && gatedOn.length) DROPPED.push([bkey, g, p, 'gated on ' + gatedOn.join('/') + ', which no main method here is']);
        // the 1836 history runs the host's own method: if that method got no copy, no start block may name the vanilla method
        if (!(RENAME[bkey] && RENAME[bkey][p])) (STRIP[bkey] ||= new Set()).add(p);
      }
      const ng = g + '_' + bkey.replace(/^building_/, '');
      const tex = /texture\s*=\s*"[^"]*"/.exec(gb);
      outPMGs.push(ng + ' = {\n\t' + (tex ? tex[0] : '') +
        '\n\tproduction_methods = {\n' + newMembers.map(x => '\t\t' + x).join('\n') + '\n\t}\n}');
      newGroups.push(ng); groupsMinted++;
      locPairs.push([ng, g]);
    }
    if (newGroups.join(' ') !== groups.join(' ')) {
      const newBlock = body.replace(/production_method_groups\s*=\s*\{[\s\S]*?\}/,
        'production_method_groups = {\n' + newGroups.map(x => '\t\t' + x).join('\n') + '\n\t}');
      text = text.replace(body, newBlock);
    }
  }
  // ⚠ rd() strips the BOM; write it back, as the history write below does, or the engine's lexer logs
  //   `should be in utf8-bom encoding` for 01_industry.txt and 06_urban_center.txt on every load (seen 2026-09-24)
  writeFileSync(path, BOM + text);
}

// `--write` stores the resolved goods on each tier as `secondary_goods`, so the solver and the sheet
// read the SAME numbers the game gets. Without it the tool only emits, which is how the split arose.
if (process.argv.includes('--write')) {
  let n = 0;
  for (const ind of cfg.industries || []) for (const t of ind.tiers || []) {
    if (!t.key) continue;
    if (RESOLVED[t.key]) { t.secondary_goods = RESOLVED[t.key]; n++; }
    else delete t.secondary_goods;
  }
  writeFileSync(CFGP, JSON.stringify(cfg));
  console.log('  --write: secondary_goods stored on ' + n + ' tier(s) in ' + CFGP);
}

// ⭐⭐ THE 1836 HISTORY NAMES THESE METHODS, AND REPLACING A PMG ORPHANS EVERY REFERENCE TO IT.
//   convert_history.ps1 writes `activate_production_methods={ … "pm_craftsman_sewing" }` for a starting
//   factory, and once this tool swaps that method out of the building's group for a minted per-tier
//   copy, the engine rejects the whole create_building: `Invalid production method: pm_craftsman_sewing`.
//   Measured 2026-09-01: 130 such errors in the first two minutes of a run, i.e. 130 starting factories
//   lost. Nothing failed at build time — every linter passed, because the history and the PMGs are
//   checked separately and neither knows the other moved.
// ⚠ Re-point per BUILDING, never globally: the same vanilla method maps to a different minted copy in
//   each tier, and a global rename would send every rung to one rung's numbers.
{
  const histDir = join(MOD, 'common/history/buildings');
  let files = 0, swaps = 0, stripped = 0;
  for (const f of (existsSync(histDir) ? readdirSync(histDir).filter(x => x.endsWith('.txt')) : [])) {
    const fp = join(histDir, f);
    let t = rd(fp); const before = t;
    // walk each create_building block and rename only within the block for THAT building
    // ⚠ THE MIDDLE MAY NOT CROSS A create_building BOUNDARY. A block with no activate_production_methods
    //   of its own otherwise lets its  run forward and swallow the NEXT block's activate line,
    //   so that block is judged under the WRONG building's rename map and silently left alone. Two
    //   starting factories survived the first two attempts at this rewrite for exactly that reason.
    t = t.replace(/building\s*=\s*"([a-z_0-9-]+)"((?:(?!create_building)[\s\S]){0,40000}?)activate_production_methods\s*=\s*\{([^}]*)\}/g,
      (whole, bkey, mid, list) => {
        const map = RENAME[bkey], strip = STRIP[bkey]; if (!map && !strip) return whole;
        let out = list, hit = false;
        for (const [van, mint] of Object.entries(map || {})) {
          const re = new RegExp('"' + van + '"', 'g');
          if (re.test(out)) { out = out.replace(re, '"' + mint + '"'); hit = true; }
        }
        // a craft rung's dropped groups: their methods leave the list (the engine rejects the whole block over one)
        for (const s of (strip || [])) {
          const re = new RegExp('\\s*"' + s + '"', 'g');
          if (re.test(out)) { out = out.replace(re, ''); hit = true; stripped++; }
        }
        if (!hit) return whole;   // nothing to re-point or strip: leave the block byte for byte
        swaps++;
        return 'building = "' + bkey + '"' + mid + 'activate_production_methods = {' + out + '}';
      });
    // ⚠ rd() strips the BOM; write it back, or every converted history file ships without one and the engine's lexer
    //   notes `should be in utf8-bom encoding` for each (seen in every run's error.log until 2026-09-04)
    if (t !== before) { writeFileSync(fp, BOM + t); files++; }
  }
  console.log('  history re-pointed: ' + swaps + ' block(s) in ' + files + ' file(s)' + (stripped ? `; ${stripped} method(s) of dropped groups stripped from craft blocks` : ''));
  // ⚠ the craft strip is asserted PER BUILDING: the same vanilla method (pm_automation_disabled) is legitimately named by every
  //   non-craft rung's block, so only the craft buildings' own blocks are checked
  if (Object.keys(STRIP).length) {
    const left = [];
    const reB = /building\s*=\s*"([a-z_0-9-]+)"((?:(?!create_building)[\s\S]){0,40000}?)activate_production_methods\s*=\s*\{([^}]*)\}/g;
    for (const f of (existsSync(histDir) ? readdirSync(histDir).filter(x => x.endsWith('.txt')) : [])) {
      const t = rd(join(histDir, f)); let m;
      while ((m = reB.exec(t))) { const s = STRIP[m[1]]; if (!s) continue;
        for (const x of s) if (m[3].includes('"' + x + '"')) left.push(`${f}: ${m[1]} still names ${x}`); }
    }
    if (left.length) throw new Error('emit_secondaries: ' + left.length + ' craft history block(s) still name a method of a dropped group — the engine would reject them: ' + left.slice(0, 8).join(' | '));
  }
  // ⚠⚠ VERIFY, DO NOT ASSUME. A vanilla secondary name left in the history names a method its building
  //   no longer has, and the engine rejects the WHOLE create_building — 130 starting factories vanished
  //   that way on 2026-09-01 with every linter green, because the history and the PMGs are checked
  //   separately and neither knows the other moved. The first cut of this rewrite also missed two
  //   blocks whose ownership list ran past a 4000-character window, so the cap is now 40000 AND the
  //   result is asserted rather than trusted.
  {
    const vanNames = new Set();
    for (const m of Object.values(RENAME)) for (const v of Object.keys(m)) vanNames.add(v);
    const left = [];
    for (const f of (existsSync(histDir) ? readdirSync(histDir).filter(x => x.endsWith('.txt')) : [])) {
      const t = rd(join(histDir, f));
      for (const v of vanNames) { const n = (t.match(new RegExp('"' + v + '"', 'g')) || []).length;
        if (n) left.push(f + ': ' + v + ' x' + n); }
    }
    if (left.length) throw new Error('emit_secondaries: ' + left.length + ' history reference(s) still name a '
      + 'vanilla secondary whose building no longer has it — the engine would reject those create_building '
      + 'blocks and the starting factories would vanish silently. ' + left.join(' | '));
  }
}
if (minted) {
  // ⚠ UTF-8 BOM: the engine's lexer warns `should be in utf8-bom encoding` on every load without it (two lines per run in
  // error.log, seen 2026-09-02/03); every vanilla script file carries one, so match it.
  writeFileSync(join(MOD, 'common/production_methods/zzz_pm_rehaul_secondaries.txt'), BOM +
    '# GENERATED by tools/emit_secondaries.mjs - per-tier secondary methods. Do not hand-edit.\n' + outPMs.join('\n') + '\n');
  writeFileSync(join(MOD, 'common/production_method_groups/zzz_pm_rehaul_secondary_groups.txt'), BOM +
    '# GENERATED by tools/emit_secondaries.mjs - per-tier secondary groups. Do not hand-edit.\n' + outPMGs.join('\n') + '\n');
  // ⭐ LOC FOR EVERY COPY, in every configured language: the copy's name IS its source's name (`$pm_cannery$`), so a
  //   translation flows through untouched; vanilla defines no `_desc` for these methods or groups, so none is referenced.
  //   Emitted into replace/ like the rest of the mod's loc, one file per language, UTF-8 BOM.
  const LANGS = cfg.languages || ['english'];
  const seenLoc = new Set(); const locLines = [];
  for (const [nk, src] of locPairs) { if (seenLoc.has(nk)) continue; seenLoc.add(nk); locLines.push(` ${nk}:0 "$${src}$"`); }
  for (const lang of LANGS) {
    const dir = join(MOD, 'localization', lang, 'replace'); if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `zzz_pm_rehaul_secondaries_l_${lang}.yml`), BOM + `l_${lang}:\n# GENERATED by tools/emit_secondaries.mjs - names of the per-tier secondary copies (each references its vanilla source).\n` + locLines.join('\n') + '\n');
  }
  console.log('secondaries loc: ' + locLines.length + ' key(s) x ' + LANGS.length + ' language(s)');
}
console.log('secondaries: ' + minted + ' per-tier method(s) in ' + groupsMinted + ' group(s) across ' +
  new Set(report.map(r => r.bkey)).size + ' building(s)' +
  (craftChecked.length ? `; ${craftChecked.length} on fractional-unit (craft) rungs with employment × workforce_mult` : '') +
  (hiddenCopies ? `; ${hiddenCopies} per-main-method copies on merged buildings hidden when unavailable` : ''));
// what a building no longer carries (or carries beside one of its main methods only): the vanilla gate, or the compatibility table
if (DROPPED.length) {
  console.log('  not carried, or mandated (' + DROPPED.length + '):');
  for (const [b, g, p, why] of DROPPED) console.log('    ' + b.padEnd(48) + ' ' + p.padEnd(44) + ' ' + why);
}
const byPm = {};
for (const r of report) (byPm[r.pm] ||= []).push(r);
for (const p of Object.keys(byPm).sort())
  console.log('  ' + p.padEnd(30) + ' ref ' + String(byPm[p][0].ref).padEnd(24) +
    ' Rout ' + byPm[p].map(r => r.Rout).join(' / '));
