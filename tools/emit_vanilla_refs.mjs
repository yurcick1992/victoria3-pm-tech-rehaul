// ⭐⭐ THE VANILLA-REFERENCE FIX — every vanilla script position that names a tiered industry, rewritten to the rung set the
//   user ruled for it (POLISH_1_0.md §2, TIER_REFERENCE_AUDIT.md §5.1 and PART 2, all rulings of 2026-10-21).
//
// WHY. The tier split keeps each industry's VANILLA building key on rung 0 (a 500-worker craft in six light industries) and gives
//   every later rung its own key and a renamed main method (`pm_main_<ind>_<method>`); the per-rung secondaries are minted under new
//   names too (emit_secondaries' `top` rule). So vanilla's `is_building_type = building_art_academy`, `has_building = …`,
//   `has_active_production_method = pm_realist_art`, `is_production_method_active = { … pm_mechanized_looms }` and
//   `building_<key>_throughput_add` now see rung 0 only — or nothing at all: the art journals never complete (realism, camera, film
//   and mass propaganda progress lost), Belle Époque never activates, the industry ban demolishes only rung 0, the industrialisation
//   and prohibition chains are dead, the power-bloc military-industry principles boost muskets and cannons. 22 blocks DEAD, 49 NARROW,
//   5 SHIFT, ~48 throughput modifiers on rung 0 (the audit's §0).
//
// HOW. (A) ADDITIVE helpers, generated from the config: per industry `pmr_is_<ind>[_<set>]` (building scope), `pmr_has_<ind>[_<set>]`
//   and `pmr_has_active_<ind>` (state or country), per vanilla main method `pmr_runs_<pm>` / `pmr_state_runs_<pm>`, per renamed
//   secondary `pmr_runs_sec_<pm>` / `pmr_state_runs_sec_<pm>`; a set is `all`, `nc` (crafts out), `e<k>plus`, `e<k>`, `e<a>_e<b>`,
//   a merged rung being its host running its method. Plus the negotiation-promise effects, one state script value and the additive
//   Montenegro check. Only the helpers a transform actually uses are written.
//   (B) WHOLE-FILE TRANSFORMS of the vanilla files that carry a reference, regenerated from the LIVE game text every build (or from
//   the build's own copy where an earlier emitter already wrote that path): hand-written snippets for what a token rule cannot say,
//   then token rules per industry with the ruled set (file default, overridden per top-level block), then the throughput lines one per
//   ruled rung key. EVERY count is asserted: a snippet's matches and each file's token rewrites — a patch that moves a line makes the
//   build THROW instead of shipping stale script (a rebuild obligation, not a freeze — ON_GAME_UPDATE.md).
//   (C) GUARDS: every `has_dlc_feature` and `dlc =` line of a copied file must survive (Paradox forbids unlocking DLC content — the
//   user, 2026-10-21); braces must balance; and a scan of the whole game tree THROWS on any reference to a tiered vanilla key, a
//   vanilla main method or a renamed vanilla secondary left in a file nobody owns, unless the ACCEPTED list below names the file and
//   says why.
//
// Run by build.ps1 AFTER emit_secondaries.mjs (it reads the minted secondary names from the EMITTED mod) and emit_craft_start.mjs, and
//   BEFORE emit_value_overrides.mjs (which edits some of these copies in place).
//   node tools/emit_vanilla_refs.mjs <modDir> [config]
// After a game patch a count assertion may THROW: re-read the audit row, then `REFS_LEARN=1 node tools/emit_vanilla_refs.mjs <modDir>`
//   prints every file's token and throughput counts beside the spec's, without dying, so the new counts can be checked and recorded.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';

const MOD = process.argv[2] || 'mod';
const CFGP = process.argv[3] || process.env.MOD_CONFIG || 'config/mod_config.json';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const BOM = '\uFEFF';
const rd = p => readFileSync(p, 'utf8');
const unbom = s => s.replace(/^\uFEFF/, '');
const cfg = JSON.parse(unbom(rd(CFGP)));
const die = m => { throw new Error('emit_vanilla_refs: ' + m); };
const san = s => s.replace(/-/g, '_');

// ------------------------------------------------------------------------------------------------ the model
const IND = {};            // id -> { id, rungs, buildings: Map bkey -> rungs, r0, craft }
const R0 = new Map();      // the vanilla key kept by rung 0 -> industry id (industries with more than one rung only)
const MAIN = new Map();    // vanilla main method -> { ind, rung } (every industry, single-rung ones included: their methods are renamed too)
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  const rungs = (ind.tiers || []).map(t => ({ key: t.key, era: +t.era, craft: !!t.craft, pm: t.pm_key, vpm: t.vanilla_pm || null,
    bkey: t.method_of || t.key, merged: !!t.method_of })).sort((a, b) => a.era - b.era);
  if (!rungs.length) continue;
  const buildings = new Map();
  for (const r of rungs) { if (!buildings.has(r.bkey)) buildings.set(r.bkey, []); buildings.get(r.bkey).push(r); }
  const r0 = rungs.find(r => !r.merged);
  IND[ind.id] = { id: ind.id, rungs, buildings, r0: r0.key, craft: rungs.some(r => r.craft) };
  if (rungs.length > 1) R0.set(r0.key, ind.id);
  for (const r of rungs) if (r.vpm) MAIN.set(r.vpm, { ind: ind.id, rung: r });
}
if (!R0.size) die('no tiered industry in ' + CFGP);
const HAS_CRAFTS = Object.values(IND).some(i => i.craft);

// the minted secondaries: source vanilla method -> copies, read from the EMITTED mod (emit_secondaries' loc names each copy after its source)
const SEC = new Map();
{
  const pmFile = join(MOD, 'common/production_methods/zzz_pm_rehaul_secondaries.txt');
  const locFile = join(MOD, 'localization/english/replace/zzz_pm_rehaul_secondaries_l_english.yml');
  if (!existsSync(pmFile) || !existsSync(locFile)) die(`no emitted secondaries in ${MOD} — run after emit_secondaries.mjs`);
  const defined = new Set([...unbom(rd(pmFile)).matchAll(/^(pm_[\w-]+)\s*=\s*\{/gm)].map(m => m[1]));
  for (const m of unbom(rd(locFile)).matchAll(/^ (pm_[\w-]+):\d* "\$(pm_[\w-]+)\$/gm)) {
    if (m[1] === m[2] || !defined.has(m[1])) continue;
    if (!SEC.has(m[2])) SEC.set(m[2], []);
    SEC.get(m[2]).push(m[1]);
  }
  for (const v of SEC.values()) v.sort();
}

// ------------------------------------------------------------------------------------------------ the helpers (registered on use)
const TRIG = new Map(), EFF = new Map(), VAL = new Map();
const reg = (map, name, make) => { if (!map.has(name)) map.set(name, make()); return name; };
const ind = x => IND[x] || die(`unknown industry ${x}`);
function rungSet(x, mode) {
  const I = ind(x); let m;
  let s;
  if (mode === 'all') s = I.rungs;
  else if (mode === 'nc') s = I.rungs.filter(r => !r.craft);
  else if ((m = /^e(\d)plus$/.exec(mode))) s = I.rungs.filter(r => r.era >= +m[1]);
  else if ((m = /^e(\d)$/.exec(mode))) s = I.rungs.filter(r => r.era === +m[1]);
  else if ((m = /^e(\d)_e(\d)$/.exec(mode))) s = I.rungs.filter(r => r.era >= +m[1] && r.era <= +m[2]);
  else die(`unknown rung set '${mode}' for ${x}`);
  if (!s.length) die(`rung set '${mode}' of ${x} is empty`);
  return s;
}
// building-scope terms for a rung set: a whole building where every main method it runs is in the set, else building + method
function bTerms(x, set) {
  const I = ind(x), terms = [], whole = [];
  for (const [bk, rs] of I.buildings) {
    const inSet = rs.filter(r => set.includes(r));
    if (!inSet.length) continue;
    if (inSet.length === rs.length) { terms.push(`is_building_type = ${bk}`); whole.push(bk); }
    else for (const r of inSet) terms.push(`AND = { is_building_type = ${bk} has_active_production_method = ${r.pm} }`);
  }
  return { terms, whole, partial: terms.length !== whole.length };
}
const orBody = terms => terms.length === 1 ? `\t${terms[0]}\n` : `\tOR = {\n${terms.map(t => '\t\t' + t + '\n').join('')}\t}\n`;
const sfx = mode => mode === 'all' ? '' : '_' + mode;
function isH(x, mode) {
  return reg(TRIG, `pmr_is_${x}${sfx(mode)}`, () => orBody(bTerms(x, rungSet(x, mode)).terms));
}
function hasH(x, mode) {
  return reg(TRIG, `pmr_has_${x}${sfx(mode)}`, () => {
    const b = bTerms(x, rungSet(x, mode));
    return b.partial ? `\tany_scope_building = {\n\t\t${isH(x, mode)} = yes\n\t}\n` : orBody(b.whole.map(k => `has_building = ${k}`));
  });
}
function hasActiveH(x, mode) {
  return reg(TRIG, `pmr_has_active_${x}${sfx(mode)}`, () => {
    const b = bTerms(x, rungSet(x, mode));
    if (b.partial) die(`has_active_building over a method-specific set (${x} ${mode}) is not supported`);
    return orBody(b.whole.map(k => `has_active_building = ${k}`));
  });
}
function runsMainH(vpm) {
  const e = MAIN.get(vpm) || die(`${vpm} is not a main method of a tiered industry`);
  return reg(TRIG, `pmr_runs_${san(vpm)}`, () => {
    const rs = ind(e.ind).buildings.get(e.rung.bkey);
    return orBody([rs.length === 1 ? `is_building_type = ${e.rung.bkey}` : `AND = { is_building_type = ${e.rung.bkey} has_active_production_method = ${e.rung.pm} }`]);
  });
}
function stateRunsMainH(vpm) {
  const e = MAIN.get(vpm) || die(`${vpm} is not a main method`);
  return reg(TRIG, `pmr_state_runs_${san(vpm)}`, () => {
    const rs = ind(e.ind).buildings.get(e.rung.bkey);
    return rs.length === 1 ? `\thas_building = ${e.rung.bkey}\n` : `\tany_scope_building = {\n\t\t${runsMainH(vpm)} = yes\n\t}\n`;
  });
}
function runsSecH(src) {
  const c = SEC.get(src) || die(`${src} has no minted copy in ${MOD} — the secondary's name changed?`);
  return reg(TRIG, `pmr_runs_sec_${san(src)}`, () => orBody(c.map(k => `has_active_production_method = ${k}`)));
}
function stateRunsSecH(src) {
  return reg(TRIG, `pmr_state_runs_sec_${san(src)}`, () => `\tany_scope_building = {\n\t\t${runsSecH(src)} = yes\n\t}\n`);
}
// a set of vanilla methods (main or secondary) read out of a vanilla block -> one building-scope OR (a main method counts its whole host)
function methodsH(name, pms) {
  return reg(TRIG, name, () => {
    const terms = [];
    for (const p of [...new Set(pms)]) {
      if (SEC.has(p)) for (const k of SEC.get(p)) terms.push(`has_active_production_method = ${k}`);
      else if (MAIN.has(p)) terms.push(`is_building_type = ${MAIN.get(p).rung.bkey}`);
      else die(`${name}: ${p} is neither a renamed secondary nor a main method of a tiered industry`);
    }
    return orBody([...new Set(terms)]);
  });
}
// the negotiation promises (A34, HIGHEST): the most advanced rung of the industry the owner already holds
function promiseH(x) {
  const keys = [...ind(x).buildings.keys()];
  const desc = keys.slice().reverse();
  const can = reg(TRIG, `pmr_can_promise_${x}`, () => orBody(keys.map(k => `bt:${k} = { building_can_be_promised = yes }`)));
  const eff = reg(EFF, `pmr_promise_highest_${x}`, () => desc.map((k, i) =>
    `\t${i ? 'else_if' : 'if'} = {\n\t\tlimit = { bt:${k} = { building_can_be_promised = yes } }\n\t\tset_variable = {\n\t\t\tname = promised_building_type\n\t\t\tvalue = bt:${k}\n\t\t}\n\t}\n`).join(''));
  return { can, eff };
}

// ------------------------------------------------------------------------------------------------ text utilities
// the index just past the brace block opening at `open` (text[open] === '{'), braces in comments and strings ignored
function blockEnd(t, open) {
  let d = 0, i = open, q = false;
  for (; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') q = false; continue; }
    if (c === '"') { q = true; continue; }
    if (c === '#') { const nl = t.indexOf('\n', i); i = nl < 0 ? t.length : nl; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return i + 1; }
  }
  die('unbalanced block');
}
// top-level blocks: [{ name, start, open, end }]
function topBlocks(t) {
  const out = []; let i = 0;
  const re = /^([A-Za-z_][\w.:-]*)\s*=\s*\{/gm;
  let m;
  while ((m = re.exec(t))) {
    if (m.index < i) continue;
    const open = m.index + m[0].length - 1, end = blockEnd(t, open);
    out.push({ name: m[1], start: m.index, open, end });
    re.lastIndex = end; i = end;
  }
  return out;
}
const lineOf = (t, idx) => t.slice(t.lastIndexOf('\n', idx - 1) + 1, idx);
const inComment = (t, idx) => lineOf(t, idx).includes('#');
const countDlc = t => ({ feat: (t.match(/has_dlc_feature\s*=/g) || []).length, dlc: (t.match(/^\s*dlc\s*=/gm) || []).length });
function braceBalance(t) {
  let d = 0, q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') q = false; continue; }
    if (c === '"') { q = true; continue; }
    if (c === '#') { const nl = t.indexOf('\n', i); i = nl < 0 ? t.length : nl; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d < 0) return d; }
  }
  return d;
}

// ------------------------------------------------------------------------------------------------ the rulings, file by file
// mode: the rung set per industry for the file's token rules (default 'all'; 'keep' leaves that industry's keys alone);
// byBlock: per top-level block (event, trigger, modifier), overriding mode; tp: per modifier block, the rung set of its throughput
// lines (default 'all', 'keep' = rung 0 only, as vanilla wrote it); n: the token rewrites the file must take, exactly.
const CRAFT_INDS = Object.values(IND).filter(i => i.craft).map(i => i.id);
const ncAll = Object.fromEntries(CRAFT_INDS.map(x => [x, 'nc']));
const SPEC = {
  // ---------------------------------------------------------------- tier 1: gameplay and research pacing
  'common/decisions/grand_exhibition_decision.txt': { n: 1 },                                   // A4: any academy rung at level 10
  'common/journal_entries/00_art_jes.txt': {                                                   // A5–A8, F1 (c)
    snips: [
      // je_realism complete: one realist (e1) academy >= 90% staffed — the share clause goes (F1 c)
      { re: /any_scope_building\s*=\s*\{\s*filter\s*=\s*\{\s*is_building_type\s*=\s*building_art_academy\s*\}\s*occupancy\s*>=\s*0\.9\s*has_active_production_method\s*=\s*pm_realist_art\s*percent\s*=\s*1\s*\}/g,
        to: () => `any_scope_building = {\n\t\t\t${runsMainH('pm_realist_art')} = yes\n\t\t\toccupancy >= 0.9\n\t\t}`, n: 1 },
      // je_camera / je_film complete: the "> 75% of academies" clause goes; the level-5 academy of the rung stays (F1 c)
      { re: /\n[ \t]*any_scope_building\s*=\s*\{\s*filter\s*=\s*\{\s*is_building_type\s*=\s*building_art_academy\s*\}\s*percent\s*>\s*0\.75\s*has_active_production_method\s*=\s*pm_(?:photographic|film)_art\s*occupancy\s*>\s*0\.75\s*\}/g,
        to: '', n: 2 },
    ], n: 9 },
  'common/journal_entries/00_belle_epoque.txt': { n: 4 },                                      // A9 (e2+ through the method rule), A10
  'common/journal_entries/00_liberalism.txt': { n: 1 },                                        // A11
  'common/journal_entries/00_player_objectives_economic_dominance.txt': { n: 4 },              // A12, A13
  'common/journal_entries/00_prohibition_laws.txt': { n: 1 },                                  // A14 (the stills through is_distillery)
  'common/journal_entries/00_trade_route_event_missions.txt': { n: 1 },                        // A15
  'common/journal_entries/03_russia.txt': { n: 1 },                                            // A16
  'common/journal_entries/06_economic_regeneration.txt': {                                     // G3: light industry, crafts out
    crafts: true,
    snips: [{ re: /state_has_building_group_levels\s*=\s*\{\s*type\s*=\s*bg_light_industry\s*value\s*>=\s*(\d+)\s*\}/g,
      to: (_, v) => `${reg(VAL, 'pmr_light_industry_levels_nc', lightLevelsNc)} >= ${v}`, n: 4 }], n: 0 },
  'common/laws/01_economic_system.txt': {                                                      // A17: the ban demolishes EVERY rung
    snips: [{ re: /if\s*=\s*\{\s*limit\s*=\s*\{\s*has_building\s*=\s*(building_[a-z_0-9]+)\s*\}\s*remove_building\s*=\s*\1\s*\}/g,
      to: (whole, k) => {
        if (!R0.has(k)) return whole;
        const keys = [...ind(R0.get(k)).buildings.keys()];
        const pad = '\t\t\t\t';
        return keys.map((b, i) => `${i ? '\n' + pad : ''}if = {\n${pad}\tlimit = {\n${pad}\t\thas_building = ${b}\n${pad}\t}\n${pad}\tremove_building = ${b}\n${pad}}`).join('');
      }, n: 15, counted: k => R0.has(k), nTiered: 10 }],
    // the expansion writes rung 0's own if-block back: the token rules leave the file alone
    mode: Object.fromEntries([...R0.values()].map(x => [x, 'keep'])), n: 0 },
  'common/scripted_triggers/00_scripted_triggers.txt': {                                       // A25–A31, F10
    snips: [
      { block: 'has_industrialized_pm', body: () => `\tany_scope_building = {\n\t\t${methodsH('pmr_is_industrialized_building', vanillaPms('common/scripted_triggers/00_scripted_triggers.txt', 'has_industrialized_pm'))} = yes\n\t}\n` },
      { block: 'using_watertube_boiler', body: () => `\tany_scope_building = {\n\t\t${methodsH('pmr_runs_watertube_boiler', vanillaPms('common/scripted_triggers/00_scripted_triggers.txt', 'using_watertube_boiler'))} = yes\n\t}\n` },
    ],
    // has_industry_building (caller economy_laws.6, "Industry Suffers": crafts IN, the user) stays every rung; is_industry_building
    // (callers revolution_events_03 .3/.4 and election_other_parties .1: factories, crafts OUT) takes the non-craft rungs (F10).
    // is_production_building has no vanilla caller (A30: ANY-C if rewritten).
    byBlock: { is_industry_building: ncAll, is_production_building: ncAll }, n: 40 },
  'common/scripted_effects/00_scripted_effects.txt': {                                         // A25: the building that runs the method
    snips: [{ within: 'save_industrialized_pm_building_and_state', sub: 'limit', body: () => `\t\t\t${methodsH('pmr_is_industrialized_building', vanillaPms('common/scripted_triggers/00_scripted_triggers.txt', 'has_industrialized_pm'))} = yes\n\t\t` }],
    n: 0 },
  'common/ai_strategies/00_default_strategy.txt': { mode: { textile: 'nc', furniture: 'nc' }, n: 3 },   // A2: the rungs that eat dye, silk, hardwood
  // ---------------------------------------------------------------- tier 2: flavour and narrowing
  'common/scripted_buttons/00_balkan_wars_buttons.txt': { n: 6 },                              // A19
  'common/scripted_buttons/03_paraguay_scripted_buttons.txt': { n: 2 },                        // A20 (the created mill stays e0)
  'common/scripted_buttons/05_serbia_buttons.txt': { n: 1 },                                   // A21: any paper rung, the craft included
  'common/scripted_buttons/06_vernacular_buttons.txt': {                                       // A22, A23 (food factory rungs, level 3), A24, G1
    mode: { food: 'nc' }, crafts: true,
    snips: [{ re: /is_building_group\s*=\s*bg_light_industry(\s+)level\s*>=\s*(\d+)/g,
      to: (_, ws, v) => `is_building_group = bg_light_industry${ws}NOT = { is_building_group = bg_pmr_crafts }${ws}level >= ${v}`, n: 4 }],
    n: 6 },
  'common/scripted_effects/00_victoria_scripted_effects.txt': {                                // A33, G2
    crafts: true,
    snips: [{ within: 'fra_weekly_pulse_orleanist_progress', re: /is_building_group\s*=\s*bg_manufacturing(\s+)weekly_profit\s*>\s*0/g,
      to: (_, ws) => `is_building_group = bg_manufacturing${ws}NOT = { is_building_group = bg_pmr_crafts }${ws}weekly_profit > 0`, n: 1 }],
    n: 1 },
  'common/scripted_effects/04_negotiation_scripted_effects.txt': {                             // A34: the highest rung held
    snips: ['art_academy', 'artillery', 'munition', 'arms'].flatMap(x => {
      const k = ind(x).r0;
      return [
        { re: new RegExp(`bt:${k}\\s*=\\s*\\{\\s*building_can_be_promised\\s*=\\s*yes\\s*\\}`, 'g'), to: () => `${promiseH(x).can} = yes`, n: 1 },
        { re: new RegExp(`set_variable\\s*=\\s*\\{\\s*name\\s*=\\s*promised_building_type\\s*value\\s*=\\s*bt:${k}\\s*\\}`, 'g'), to: () => `${promiseH(x).eff} = yes`, n: 1 },
      ];
    }), n: 0 },
  'common/amendments/00_amendments_enactment_04.txt': { tpn: 1 },                                      // D1
  'common/power_bloc_principles/00_power_bloc_principles.txt': { tpn: 9 },                             // D2–D4: every arms, artillery, automotive rung
  'common/static_modifiers/00_ip3_02_modifiers.txt': { tpn: 2 },                                       // D6, D7
  'common/static_modifiers/00_ip3_03_modifiers.txt': { tpn: 3 },                                       // D8–D10
  'common/static_modifiers/00_ip3_04_modifiers.txt': { tpn: 3 },                                       // D11–D13
  'common/static_modifiers/00_ip4_03_modifiers.txt': { tpn: 1 },                                       // D14
  'common/static_modifiers/00_ip4_04_modifiers.txt': { tpn: 1 },                                       // D15
  'common/static_modifiers/02_event_modifiers.txt': { tpn: 10, tp: {                                    // D16–D26
    modifier_bg_diminished_rum_production: { food: 'nc' },                                     // D16: the distilling host, not the bakeries
    plastic_production_modifier: { glass: 'e3' },                                              // D18: the plastics rung the event requires
    elevator_goods_production_modifier: { glass: 'nc' },                                       // D24: steel every rung, glass e1+
    realist_art: { art_academy: 'e1' },                                                        // D25
    romantic_building_modifier: { art_academy: 'keep' },                                       // D26: e0 (traditional art)
  } },
  'common/static_modifiers/104_modifiers.txt': { tpn: 3 },                                             // D27–D29
  'common/static_modifiers/105_modifiers.txt': { tpn: 1, tp: { banned_degenerate_art: { art_academy: 'keep' } } },   // D30; D31 has no vanilla user
  'common/static_modifiers/agitators_4_modifiers.txt': { tpn: 4, tp: {                                 // D33–D36
    modifier_haute_couture_competition: { textile: 'nc' },                                     // D33: textile factory rungs only (the user)
    modifier_trad_arts_bonus: { art_academy: 'e0_e2' },                                        // D34: not film
  } },
  'common/static_modifiers/agitators_4_revolution_modifiers.txt': { tpn: 1 },                          // D37: every paper rung, the craft included
  'common/static_modifiers/brazil_2_modifiers.txt': { tpn: 2 },                                        // D38, D39
  'common/static_modifiers/content_1_modifiers.txt': { tpn: 1, tp: { steam_engine_production: { motor: 'keep' } } }, // D40 steam engines only; D41
  'common/static_modifiers/content_2_modifiers.txt': { tpn: 1, tp: { high_distribution_news_cycle: { paper: 'nc' } } }, // D42: e1+
  'common/static_modifiers/content_3_modifiers.txt': { tpn: 4, tp: { wartime_production_act: { arms: 'keep', artillery: 'keep' } } }, // D43 no user; D44–D45 every rung (the user)
  'common/static_modifiers/content_4_modifiers.txt': { tpn: 2 },                                       // D46
  'common/static_modifiers/japan_single_fire_events_modifiers.txt': { tpn: 1 },                        // D47: every food rung, the craft included
  'common/static_modifiers/montenegrin_modifiers.txt': { tpn: 2 },                                     // D48, D49
  'events/assassination_events.txt': { n: 2 },                                                 // A36
  'events/balkans_events/03_ip3_austria_events.txt': { n: 2 },                                 // A37
  'events/balkans_events/montenegro_events.txt': {                                             // A18: the first arms factory of any rung
    snips: [{ re: /b:building_arms_industry\s*=\s*\{\s*save_scope_as\s*=\s*arms\s*\}/g,
      to: () => `random_scope_building = {\n\t\t\t\tlimit = { ${isH('arms', 'all')} = yes }\n\t\t\t\tsave_scope_as = arms\n\t\t\t}`, n: 1 }],
    n: 3 },
  'events/balkans_events/national_awakening.txt': { n: 3 },                                    // A38
  'events/belle_epoque_events.txt': {                                                          // A39–A43
    byBlock: { 'belle_epoque_events.6': { art_academy: 'e0_e2' }, 'belle_epoque_events.14': { textile: 'nc' } }, n: 9 },
  'events/brazil/amazonas.txt': { n: 1 },                                                      // A44 (the created academy stays e0)
  'events/brazil/paraguay.txt': { n: 1 },                                                      // A20
  'events/decree_events.txt': { n: 2 },                                                        // A45
  'events/decree_events_02.txt': { mode: ncAll, n: 52 },                                       // A46: crafts out, vanilla's list kept
  'events/fascism_events.txt': { n: 3 },                                                       // A47
  'events/iberia_events/ip4_anarchism_events.txt': { n: 1 },                                   // A48
  'events/ig_suppression_events.txt': { n: 1 },                                                // A49
  'events/industrial_accidents_events.txt': {                                                  // A50–A53
    snips: [
      // .1 Triangle Shirtwaist: a garment factory with mechanised looms = textile e2+ (the sewing-machine host)
      { re: /has_building\s*=\s*building_textile_mill\s*NOT\s*=\s*\{\s*is_production_method_active\s*=\s*\{\s*building_type\s*=\s*building_textile_mill\s*production_method\s*=\s*pm_traditional_looms\s*\}\s*\}/g,
        to: () => `${hasH('textile', 'e2plus')} = yes`, n: 2 },
      // .4 the Great Molasses Flood: a food building running a still
      { re: /has_building\s*=\s*building_food_industry\s*NOT\s*=\s*\{\s*is_production_method_active\s*=\s*\{\s*building_type\s*=\s*building_food_industry\s*production_method\s*=\s*pm_disabled_distillery\s*\}\s*\}/g,
        to: 'has_distillery = yes', n: 2 },
    ],
    mode: { textile: 'nc' }, n: 2 },                                                           // .2 the dyeworks: textile e1+
  'events/japan_events/ep2_japan_events_03.txt': { mode: { art_academy: 'keep' }, n: 2 },     // A54: e0 only
  'events/krakatoa_events.txt': { n: 3 },                                                      // A55
  'events/law_events/citizenship_laws.txt': { n: 2 },                                          // A56
  'events/law_events/economy_laws.txt': { n: 2 },                                              // A57 (light industry through has_industry_building)
  'events/liberalism.txt': { n: 3 },                                                           // A11
  'events/pm_events.txt': { n: 6 },                                                            // A59, A60
  'events/tech_events/camera_film_pm_events.txt': { n: 4 },                                    // A65, A66
  'events/tech_events/military_tech_events.txt': {                                             // A67: rifles or newer
    snips: [{ re: /OR\s*=\s*\{\s*has_active_production_method\s*=\s*pm_rifles\s*has_active_production_method\s*=\s*pm_repeaters\s*has_active_production_method\s*=\s*pm_bolt_action_rifles\s*\}/g,
      to: () => `${isH('arms', 'e1plus')} = yes`, n: 3 }], n: 3 },
  'events/tech_events/production_tech_events.txt': {                                           // A68–A74
    snips: [
      // .200 Plastic Production: one level-5 plastics (e3) glassworks — the share clause goes (F1 c)
      { re: /any_scope_building\s*=\s*\{\s*filter\s*=\s*\{\s*is_building_type\s*=\s*building_glassworks\s*\}\s*percent\s*>=\s*0\.5\s*occupancy\s*>\s*0\.75\s*weekly_profit\s*>\s*10\s*cash_reserves_ratio\s*>\s*0\.25\s*weekly_profit\s*>\s*0\s*level\s*>=\s*5\s*has_active_production_method\s*=\s*pm_houseware_plastics\s*\}/g,
        to: () => `any_scope_building = {\n\t\t\t${runsMainH('pm_houseware_plastics')} = yes\n\t\t\tlevel >= 5\n\t\t}`, n: 1 },
    ],
    byBlock: { 'production_tech_events.200': { glass: 'e3' }, 'production_tech_events.700': { motor: 'keep' } }, n: 13 },
  'events/tech_events/society_tech_events.txt': {                                              // A75–A77
    snips: [{ re: /order_by\s*=\s*b:building_art_academy\.level/g, to: () => `order_by = b:${MAIN.get('pm_realist_art').rung.bkey}.level`, n: 1 }],
    byBlock: { 'society_tech_events.104': { glass: 'nc' } }, n: 9 },
  'events/tech_events/war_crimes_events.txt': { n: 2 },                                        // A78
  'events/trade_route_events.txt': { n: 1 },                                                   // A15
};

// the ACCEPTED list: files that still name a tiered vanilla key / main method / renamed secondary, and why that is right
const ACCEPTED = {
  'common/achievements/mp1_charters_of_commerce_achievements.txt': 'A1: achievements are off with any mod',
  'common/customizable_localization/99_ru_custom_loc.txt': 'Russian grammatical forms of the rung-0 names; cosmetic (higher rungs take the default form)',
  'common/modifier_type_definitions/01_building_modifier_types.txt': "vanilla's own declarations of the rung-0 modifier types",
  'common/scripted_triggers/00_gfx_route_graphics_triggers.txt': 'A32: map train visuals; cosmetic',
  'common/on_actions/00_code_on_actions.txt': "A18/F11: vanilla's Montenegro check stays (7,963 lines); the additive check in zzz_pm_rehaul_vanilla_refs.txt covers every other arms rung",
  'common/static_modifiers/00_ep2_03_modifiers.txt': 'D5: ukiyo-e is traditional art, rung 0 by ruling',
  'events/agitators_events/land_ownership_law_events.txt': 'A35: "an ad hoc steel mill" starts the e0 rung on purpose',
  'common/ai_strategies/01_admin_strategies.txt': 'R2.3: the tooling and explosives subsidies are the config\'s building_subsidies (the coordinator\'s step), not this emitter\'s',
};

// ------------------------------------------------------------------------------------------------ helper bodies needing the game
function lightLevelsNc() {
  return `\tvalue = 0\n\tevery_scope_building = {\n\t\tlimit = {\n\t\t\tis_building_group = bg_light_industry\n\t\t\tNOT = { is_building_group = bg_pmr_crafts }\n\t\t}\n\t\tadd = this.level\n\t}\n`;
}
// the build's own copy where an earlier emitter wrote this path (theirs, regenerated from vanilla), else the live game text; never a copy
// this emitter wrote itself (a re-run over the same folder would transform twice)
const HEAD = '# PM & Tech Rehaul: regenerated from vanilla every build by tools/emit_vanilla_refs.mjs';
const srcOf = rel => {
  const p = join(MOD, rel);
  return existsSync(p) && !unbom(rd(p)).startsWith(HEAD) ? p : join(GAME, rel);
};
function vanillaPms(rel, block) {
  const t = unbom(rd(join(GAME, rel)));
  const b = topBlocks(t).find(x => x.name === block) || die(`${rel}: no top-level ${block}`);
  const pms = [...t.slice(b.open, b.end).matchAll(/production_method\s*=\s*(pm_[\w-]+)/g)].map(m => m[1]);
  if (!pms.length) die(`${rel} ${block}: no production_method left to read — the vanilla block changed`);
  return pms;
}

// ------------------------------------------------------------------------------------------------ the transform
const stats = { files: 0, tokens: 0, snips: 0, tp: 0, collisions: [] };
const TP_KEYS = new Set();
function transform(rel, spec) {
  const src = srcOf(rel);
  if (src.startsWith(join(MOD))) stats.collisions.push(rel);
  if (!existsSync(src)) die(`${rel}: no such file in the game`);
  const raw = rd(src), hadBom = raw.startsWith(BOM);
  let t = unbom(raw);
  const before = countDlc(t);
  if (spec.crafts && !HAS_CRAFTS) spec = { ...spec, snips: [] };
  // 1. snippets
  for (const s of spec.snips || []) {
    if (s.block) {
      const b = topBlocks(t).filter(x => x.name === s.block);
      if (b.length !== 1) die(`${rel}: top-level ${s.block} found ${b.length}×`);
      t = t.slice(0, b[0].open + 1) + '\n' + s.body() + t.slice(b[0].end - 1);
      stats.snips++; continue;
    }
    if (s.within && s.sub) {
      const b = topBlocks(t).filter(x => x.name === s.within);
      if (b.length !== 1) die(`${rel}: top-level ${s.within} found ${b.length}×`);
      const m = new RegExp(`\\b${s.sub}\\s*=\\s*\\{`).exec(t.slice(b[0].open, b[0].end));
      if (!m) die(`${rel}: no ${s.sub} block in ${s.within}`);
      const open = b[0].open + m.index + m[0].length - 1, end = blockEnd(t, open);
      t = t.slice(0, open + 1) + '\n' + s.body() + t.slice(end - 1);
      stats.snips++; continue;
    }
    let lo = 0, hi = t.length;
    if (s.within) {
      const b = topBlocks(t).filter(x => x.name === s.within);
      if (b.length !== 1) die(`${rel}: top-level ${s.within} found ${b.length}×`);
      lo = b[0].open; hi = b[0].end;
    }
    let n = 0, nTiered = 0;
    const seg = t.slice(lo, hi).replace(s.re, (...a) => {
      const off = a[a.length - 2];
      if (inComment(t, lo + off)) return a[0];
      n++; if (s.counted && s.counted(a[1])) nTiered++;
      return typeof s.to === 'function' ? s.to(...a) : s.to;
    });
    if (n !== s.n) die(`${rel}: snippet ${s.re} matched ${n}×, expected ${s.n} — the vanilla text moved`);
    if (s.nTiered != null && nTiered !== s.nTiered) die(`${rel}: snippet ${s.re} hit ${nTiered} tiered industries, expected ${s.nTiered}`);
    t = t.slice(0, lo) + seg + t.slice(hi);
    stats.snips++;
  }
  // 2. multi-line method tests: is_production_method_active = { building_type = … production_method = … } (state scope)
  let n = 0, tpc = 0;
  t = t.replace(/is_production_method_active\s*=\s*\{\s*building_type\s*=\s*(building_[a-z_0-9]+)\s*production_method\s*=\s*(pm_[\w-]+)\s*\}/g, (whole, bt, pm, off) => {
    if (inComment(t, off)) return whole;
    if (SEC.has(pm)) { n++; return `${stateRunsSecH(pm)} = yes`; }
    if (MAIN.has(pm)) { n++; return `${stateRunsMainH(pm)} = yes`; }
    return whole;
  });
  // 3. token rules, line by line (comments untouched), with the ruled set per industry
  const blocks = topBlocks(t);
  const lines = t.split('\n');
  let pos = 0, bi = 0;
  const tpUsed = new Set();
  for (let i = 0; i < lines.length; i++) {
    while (bi < blocks.length && blocks[bi].end <= pos) bi++;
    const blk = (bi < blocks.length && blocks[bi].start <= pos) ? blocks[bi].name : null;
    const line = lines[i];
    const h = line.indexOf('#');
    let code = h < 0 ? line : line.slice(0, h);
    const rest = h < 0 ? '' : line.slice(h);
    const modeOf = x => (spec.byBlock && blk && spec.byBlock[blk] && spec.byBlock[blk][x]) || (spec.mode && spec.mode[x]) || 'all';
    // throughput lines: one line per ruled rung key
    const tm = /^(\s*)(building_[a-z_0-9]+)_throughput_add(\s*=\s*)(\S+)\s*$/.exec(code);
    if (!tm) for (const m of code.matchAll(/\b(building_[a-z_0-9]+)_throughput_add\b/g))
      if (R0.has(m[1])) die(`${rel}:${i + 1}: ${m[1]}_throughput_add in a line form the throughput rule cannot rewrite: "${line.trim()}"`);
    if (tm && R0.has(tm[2])) {
      const x = R0.get(tm[2]);
      const rule = (spec.tp && blk && spec.tp[blk] && spec.tp[blk][x]) || 'all';
      if (spec.tp && blk && spec.tp[blk]) tpUsed.add(blk);
      if (rule !== 'keep') {
        const keys = bTerms(x, rungSet(x, rule)).whole;
        if (bTerms(x, rungSet(x, rule)).partial) die(`${rel} ${blk}: a throughput set cannot name a method (${x} ${rule})`);
        for (const k of keys) TP_KEYS.add(k);
        lines[i] = keys.map(k => `${tm[1]}${k}_throughput_add${tm[3]}${tm[4]}`).join('\n') + (rest ? ' ' + rest : '');
        stats.tp++; tpc++;
      }
      pos += line.length + 1; continue;
    }
    code = code.replace(/\b(is_building_type|has_building|has_active_building)(\s*=\s*)(building_[a-z_0-9]+)\b/g, (whole, op, eq, k) => {
      if (!R0.has(k)) return whole;
      const x = R0.get(k), mode = modeOf(x);
      if (mode === 'keep') return whole;
      n++;
      const name = op === 'is_building_type' ? isH(x, mode) : op === 'has_building' ? hasH(x, mode) : hasActiveH(x, mode);
      return `${name} = yes`;
    });
    code = code.replace(/\bhas_active_production_method(\s*=\s*)(pm_[\w-]+)/g, (whole, eq, pm) => {
      if (SEC.has(pm)) { n++; return `${runsSecH(pm)} = yes`; }
      if (MAIN.has(pm)) { const x = MAIN.get(pm).ind; if (modeOf(x) === 'keep') return whole; n++; return `${runsMainH(pm)} = yes`; }
      return whole;
    });
    lines[i] = code + rest;
    pos += line.length + 1;
  }
  t = lines.join('\n');
  for (const b of Object.keys(spec.tp || {})) if (!tpUsed.has(b)) die(`${rel}: throughput rule for ${b} matched no line — the vanilla modifier moved`);
  // residue: a b:/bt: link to a rung-0 key means a form the rules missed (a throughput line in an odd form dies in the loop above)
  for (const m of t.matchAll(/\b(?:b|bt):(building_[a-z_0-9]+)\b/g))
    if (R0.has(m[1]) && !inComment(t, m.index)) die(`${rel}: ${m[0]} left — a link to rung 0 needs a snippet`);
  if (process.env.REFS_LEARN) console.log(`  learn: ${rel} n=${n} (spec ${spec.n}) tpn=${tpc} (spec ${spec.tpn})`);
  else if (tpc !== (spec.tpn || 0)) die(`${rel}: ${tpc} throughput line(s) expanded, expected ${spec.tpn || 0} — a vanilla modifier was added or moved; rule it (TIER_REFERENCE_AUDIT.md table D) and update the count`);
  else if (n !== (spec.n || 0)) die(`${rel}: ${n} token rewrite(s), expected ${spec.n} — the vanilla text changed; re-read the audit row and update the count`);
  stats.tokens += n;
  // guards: DLC gates survive, braces balance, nothing tiered left in a form the rules missed
  const after = countDlc(t);
  if (after.feat !== before.feat || after.dlc !== before.dlc) die(`${rel}: DLC gates changed (has_dlc_feature ${before.feat} -> ${after.feat}, dlc = ${before.dlc} -> ${after.dlc}) — never unlock DLC content`);
  if (braceBalance(t) !== 0) die(`${rel}: brace imbalance after the transform`);
  const head = `# PM & Tech Rehaul: regenerated from vanilla every build by tools/emit_vanilla_refs.mjs (the tier-reference fix, TIER_REFERENCE_AUDIT.md). Do not hand-edit.\n`;
  W(rel, (hadBom ? BOM : '') + head + t);
  stats.files++;
  return n;
}
const W = (rel, text) => { const p = join(MOD, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };

const perFile = {};
for (const [rel, spec] of Object.entries(SPEC)) perFile[rel] = transform(rel, spec);

// ------------------------------------------------------------------------------------------------ additive files
const GEN = '# GENERATED by tools/emit_vanilla_refs.mjs from the config — the tier-reference fix (TIER_REFERENCE_AUDIT.md). Do not hand-edit.\n';
const emitMap = (map, rel, note) => {
  if (!map.size) return;
  const body = [...map].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => `${k} = {\n${v}}\n`).join('\n');
  if (braceBalance(body) !== 0) die(`${rel}: brace imbalance`);
  W(rel, BOM + GEN + note + '\n' + body);
};
emitMap(EFF, 'common/scripted_effects/zzz_pm_rehaul_industry_effects.txt',
  '# The negotiation promises (A34): the most advanced rung of the industry the IG\'s country already holds.\n');
emitMap(VAL, 'common/script_values/zzz_pm_rehaul_industry_values.txt',
  '# State scope: light-industry levels with the crafts left out (G3, je_spa_economic_regeneration).\n');

// the Montenegro "True Aim" event (A18/F11): vanilla's monthly check sees only the musket rung; this fires it for any other arms rung,
// with the event's own DLC gate (dlc014, National Awakening = ip3_content) carried explicitly. Registered through on_actions (L22).
W('common/on_actions/zzz_pm_rehaul_vanilla_refs.txt', BOM + GEN +
`# A18: mon_state_formation.13 for Montenegro's first arms factory of ANY rung. Vanilla's own check (00_code_on_actions.txt, musket rung
# only) is untouched; this one fires only where vanilla's would not, so the event is never queued twice.
on_monthly_pulse_country = {
\ton_actions = {
\t\tpmr_mon_first_arms_factory
\t}
}

pmr_mon_first_arms_factory = {
\ttrigger = {
\t\thas_dlc_feature = ip3_content
\t\texists = c:MON
\t\tTHIS = c:MON
\t\tNOT = { has_variable = mon_state_formation_13_fired }
\t\tany_scope_state = { ${hasActiveH('arms', 'all')} = yes }
\t\tNOT = { any_scope_state = { has_active_building = ${ind('arms').r0} } }
\t}
\teffect = {
\t\ttrigger_event = { id = mon_state_formation.13 popup = yes }
\t}
}
`);
// the triggers, last: the on_action above registers one too
emitMap(TRIG, 'common/scripted_triggers/zzz_pm_rehaul_industry_triggers.txt',
  '# Building scope: pmr_is_<industry>[_<set>], pmr_runs_<vanilla main method>, pmr_runs_sec_<vanilla secondary>, pmr_can_promise_*.\n' +
  '# State or country scope: pmr_has_<industry>[_<set>], pmr_has_active_<industry>, pmr_state_runs_*. A set is all, nc (crafts out), e<k>plus,\n' +
  '# e<k> or e<a>_e<b> by the rung\'s narrative era; a merged rung is its host building running its main method.\n');

// ------------------------------------------------------------------------------------------------ throughput modifier types
// vanilla hand-enumerates building_<key>_throughput_add; emit_companies declares the ones company prosperity names. Declare the rest.
const declared = new Set();
const vanillaDef = new Map();
for (const [d, isGame] of [[join(GAME, 'common/modifier_type_definitions'), true], [join(MOD, 'common/modifier_type_definitions'), false]])
  if (existsSync(d)) for (const f of readdirSync(d).filter(x => x.endsWith('.txt'))) {
    if (f === 'zzz_pm_rehaul_vanilla_refs_modifiers.txt') continue;
    const t = unbom(rd(join(d, f)));
    for (const b of topBlocks(t)) { declared.add(b.name); if (isGame) vanillaDef.set(b.name, t.slice(b.start, b.end)); }
  }
const newTypes = [...TP_KEYS].filter(k => !declared.has(`${k}_throughput_add`)).sort();
if (newTypes.length) {
  const out = ['# GENERATED by tools/emit_vanilla_refs.mjs - the throughput modifier types of the rung keys the vanilla modifiers now name and', '# nothing else declares (vanilla hand-enumerates building_<key>_throughput_add). Body copied from the rung-0 type.', ''];
  for (const k of newTypes) {
    const r0 = ind(Object.values(IND).find(i => i.buildings.has(k)).id).r0;
    const def = vanillaDef.get(`${r0}_throughput_add`) || die(`no vanilla modifier type ${r0}_throughput_add to copy for ${k}`);
    out.push(def.replace(`${r0}_throughput_add`, `${k}_throughput_add`), '');
  }
  W('common/modifier_type_definitions/zzz_pm_rehaul_vanilla_refs_modifiers.txt', BOM + out.join('\n'));
}
// loc, in every configured language: the rung-0 type's own vanilla line, its building reference re-pointed at the rung's short name
const LANGS = cfg.languages || ['english'];
for (const lang of LANGS) {
  let van = '';
  try { van = unbom(rd(join(GAME, `localization/${lang}/modifiers_l_${lang}.yml`))); } catch { van = ''; }
  const out = [`l_${lang}:`];
  for (const k of newTypes) {
    const r0 = ind(Object.values(IND).find(i => i.buildings.has(k)).id).r0;
    for (const suff of ['', '_desc']) {
      const m = new RegExp(`^\\s*(${r0}_throughput_add${suff}):(\\S*)\\s*(".*")\\s*$`, 'm').exec(van);
      if (!m) continue;
      out.push(` ${k}_throughput_add${suff}:${m[2]} ${m[3].replaceAll(`$${r0}$`, () => `$${k}_pmr_short$`)}`);
    }
  }
  if (VAL.has('pmr_light_industry_levels_nc')) out.push(` pmr_light_industry_levels_nc:0 "Light industry levels (crafts excluded)"`);
  W(`localization/${lang}/replace/zzz_pm_rehaul_vanilla_refs_l_${lang}.yml`, BOM + out.join('\n') + '\n');
}

// ------------------------------------------------------------------------------------------------ the scan (§5.1 D)
// every reference left in the game tree must sit in a file the mod ships at that path (this emitter's, or another's) or on ACCEPTED.
const KEYS = new Set(R0.keys()), MAINS = new Set(MAIN.keys()), SECS = new Set(SEC.keys());
const SKIP = /^(common\/(history|production_methods|production_method_groups|buildings|company_types)|localization|gfx|map_data|dlc|tests)\//;
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const left = [];
const acceptedHit = new Set();
for (const root of ['common', 'events']) for (const f of walk(join(GAME, root)).filter(x => x.endsWith('.txt'))) {
  const rel = relative(GAME, f).split(sep).join('/');
  if (SKIP.test(rel) || existsSync(join(MOD, rel))) continue;
  const hits = [];
  unbom(rd(f)).split('\n').forEach((l, i) => {
    const c = l.replace(/#.*/, '');
    for (const m of c.matchAll(/\b(building_[a-z_0-9]+|pm_[\w-]+)\b/g)) {
      const tok = m[1];
      const k = KEYS.has(tok) ? 'key' : [...KEYS].some(x => tok.startsWith(x + '_') && !Object.values(IND).some(I => I.buildings.has(tok))) ? 'modifier' : MAINS.has(tok) ? 'main method' : SECS.has(tok) ? 'secondary' : null;
      if (k) hits.push(`${i + 1} ${k} ${tok}`);
    }
  });
  if (!hits.length) continue;
  if (ACCEPTED[rel]) { acceptedHit.add(rel); continue; }
  left.push(`${rel}: ${hits.slice(0, 6).join(' | ')}${hits.length > 6 ? ` (+${hits.length - 6})` : ''}`);
}
if (left.length) die(`${left.length} file(s) still reference a tiered industry and are neither transformed nor ACCEPTED:\n  ` + left.join('\n  '));
for (const a of Object.keys(ACCEPTED)) if (!acceptedHit.has(a) && !existsSync(join(MOD, a))) console.log(`  note: ACCEPTED ${a} no longer references a tiered industry — drop it from the list`);

console.log(`emit_vanilla_refs: ${stats.files} vanilla file(s) transformed, ${stats.tokens} token rewrite(s), ${stats.snips} snippet(s), ` +
  `${stats.tp} throughput line(s) expanded; ${TRIG.size} trigger(s), ${EFF.size} effect(s), ${VAL.size} script value(s), ${newTypes.length} new modifier type(s); ` +
  `${acceptedHit.size} ACCEPTED file(s) left as vanilla wrote them` + (stats.collisions.length ? `; transformed the build's own copy of ${stats.collisions.join(', ')}` : '') + '.');
