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
const report = [];
let minted = 0, groupsMinted = 0;
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
    for (const g of groups) {
      const gb = PMG[g];
      if (!gb || /^pmg_main_/.test(g)) { newGroups.push(g); continue; }
      const members = listOf(gb, 'production_methods');
      const rescalable = members.filter(p => PM[p] && !LABOUR_SAVING.test(p) &&
        /goods_(input|output)_[a-z_]+_add/.test(PM[p]));
      if (!rescalable.length) { newGroups.push(g); continue; }

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
        const pb = PM[p];
        if (!pb || !rescalable.includes(p)) { newMembers.push(p); continue; }
        // ⚠⚠ A PM-GATED SECONDARY KEEPS ITS RESTRICTION. Minting a per-tier copy and pointing its
        //   `unlocking_production_methods` at that tier's own method would make it available on EVERY
        //   rung — vanilla restricts bone china to advanced glassworks, elastics to sewing-machine
        //   mills, precision tools to lathe workshops, and the builder's own gate remap preserves
        //   that ("the secondary unlocks at exactly the tiers whose main PM satisfied it in vanilla").
        //   So a tier that does NOT satisfy the vanilla gate keeps the ORIGINAL vanilla method, which
        //   names main PMs it does not have and therefore stays unavailable — the restriction intact.
        const gatedOn = listOf(pb, 'unlocking_production_methods');
        if (gatedOn.length) {
          const mine = [t.vanilla_pm, ...(t.vanilla_pm_aliases || [])].filter(Boolean);
          if (!mine.some(v => gatedOn.includes(v))) { newMembers.push(p); continue; }
        }
        const ref = refFor(p);
        const g0 = t.output_good || industry.output_good || industry.good;
        const mainOutRef = ref ? val(ref.out) : 0;
        const mainInRef = ref ? val(ref.inp) : 0;
        const tierOut = (t.output_qty || 0) * (PRICE[g0] ?? 0);
        const tierIn = val(t.inputs || {});
        const Rout = mainOutRef > 0 ? tierOut / mainOutRef : 1;
        const Rin = mainInRef > 0 ? tierIn / mainInRef : Rout;
        const nk = p + '_' + bkey.replace(/^building_/, '');
        let nb = pb;
        nb = nb.replace(/goods_output_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g,
          (_, g2, q) => 'goods_output_' + g2 + '_add = ' + (+(q * Rout).toFixed(2)));
        // ⚠⚠ A REDUCTION SCALES WITH ITS OWN GOOD, NOT WITH THE INPUT BILL. `pm_cannery` carries
        //   `goods_input_grain_add = -20`, i.e. "20 less grain than the main method uses". Scaling
        //   that by the AGGREGATE input-value ratio overshoots whenever the tier's recipe holds a
        //   different grain proportion than the reference method — which drove grain NEGATIVE on
        //   three food tiers and was caught by lint_negative_goods. So a good the reference method
        //   also consumes scales by THIS TIER'S share of THAT good; anything else falls back to the
        //   aggregate ratio.
        nb = nb.replace(/goods_input_([a-z_]+)_adds*=s*(-?[0-9.]+)/g, (_, g2, q) => {
          const mine = (t.inputs || {})[g2], theirs = ref && ref.inp ? ref.inp[g2] : null;
          const k = (mine != null && theirs) ? (mine / theirs) : Rin;
          return 'goods_input_' + g2 + '_add = ' + (+(q * k).toFixed(2));
        });
        // a gate naming a vanilla main PM must name OUR tier's method instead, or it never unlocks
        nb = nb.replace(/unlocking_production_methods\s*=\s*\{[\s\S]*?\}/,
          'unlocking_production_methods = { ' + t.pm_key + ' }');
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
        (RESOLVED[bkey] ||= {})[nk] = { from: p, ref: ref ? ref.pm : null, ...rg };
        (RENAME[bkey] ||= {})[p] = nk;
        outPMs.push(nk + ' = {' + nb + '}');
        locPairs.push([nk, p]);
        newMembers.push(nk); minted++;
        report.push({ bkey, pm: p, Rout: +Rout.toFixed(2), Rin: +Rin.toFixed(2), ref: ref ? ref.pm : '(none)' });
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
  writeFileSync(path, text);
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
  let files = 0, swaps = 0;
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
        const map = RENAME[bkey]; if (!map) return whole;
        let out = list, hit = false;
        for (const [van, mint] of Object.entries(map)) {
          const re = new RegExp('"' + van + '"', 'g');
          if (re.test(out)) { out = out.replace(re, '"' + mint + '"'); hit = true; }
        }
        if (hit) swaps++;
        return 'building = "' + bkey + '"' + mid + 'activate_production_methods = {' + out + '}';
      });
    // ⚠ rd() strips the BOM; write it back, or every converted history file ships without one and the engine's lexer
    //   notes `should be in utf8-bom encoding` for each (seen in every run's error.log until 2026-09-04)
    if (t !== before) { writeFileSync(fp, BOM + t); files++; }
  }
  console.log('  history re-pointed: ' + swaps + ' block(s) in ' + files + ' file(s)');
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
  new Set(report.map(r => r.bkey)).size + ' building(s)');
const byPm = {};
for (const r of report) (byPm[r.pm] ||= []).push(r);
for (const p of Object.keys(byPm).sort())
  console.log('  ' + p.padEnd(30) + ' ref ' + String(byPm[p][0].ref).padEnd(24) +
    ' Rout ' + byPm[p].map(r => r.Rout).join(' / '));
