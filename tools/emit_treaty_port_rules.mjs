// THE TREATY-PORT ELIGIBILITY RULE, WITHOUT THE PORT-BUILDING REQUIREMENT (2026-10-19, user-asked; FINDINGS F244 §6–§7; UNDER PROBE).
// The engine trigger `is_potential_treaty_port` admits a state only if it holds a port building (§6: 798 / 723 states at the 1836 start), so a
// treaty port can only be an existing port town. Config `treaty_port_rules` (absent → this emits NOTHING):
//   no_port_building: true   the three places the SCRIPT asks that trigger — the treaty-port article's `possible` and `state_valid_trigger`
//                            (common/treaty_articles/14_treaty_port.txt) and the war goal's `valid` (common/war_goal_types/25_take_treaty_port.txt)
//                            — ask our own `pmr_treaty_port_candidate` instead: coastal, not already a treaty port, holding the region's treaty-port
//                            province (`controls_treaty_port_province`), not the taker's own; and the war goal's code-side `validate_take_treaty_port`
//                            setting is removed (the likely source of "Target state has no valid treaty port province"). Whole-file copies of the
//                            two vanilla files; every replacement asserts its match count. ⚠ Whether the engine's own cession (`cede_treaty_port`)
//                            and its own candidate lists accept a state without a port is exactly what the probe below tests.
//   probe: { cede: [[STATE, HOST, TAKER], ...], treaty: [...], play: [...], log: [TAKER, ...] }   PROBE BUILDS ONLY: at the campaign start,
//                            `cede_treaty_port` / `create_treaty` with a treaty-port article / `create_diplomatic_play` (dp_take_treaty_port) per entry,
//                            each logged with whether the state held a port building; then every month, for the `log` countries, one line per
//                            treaty-port state they own and whether it holds a port building (PMR_TPR lines in debug.log).
//   trade_center_gate: true | { log: true }   THE AI'S TRADE-CENTRE GDP GATE, MOVED INTO SCRIPT WITH TREATY PORTS EXEMPT (2026-10-19, user-asked,
//                            FINDINGS F245: 11 of 24 new ports never traded, the likely cause being this gate). The engine refuses to let the AI build a
//                            trade centre in a state below `TRADE_CENTER_MINIMUM_GDP_*` (00_ai.txt), with no treaty-port term. The book sets the two
//                            base thresholds to £1 / £2 in `ai_defines` (REQUIRED — this throws otherwise, so the pair cannot ship half-applied; the engine
//                            rejects 0, and a NON_MARKET_CAPITAL not above MARKET_CAPITAL, at load — L33) and this
//                            writes vanilla's test back as the trade centre's `can_build_government` / `can_build_private` condition: the state's
//                            GDP ≥ pmr_tc_gdp_threshold, unless it is a treaty port, or (government construction only) the builder is a player.
//                            The threshold is read LIVE from vanilla's five defines: market capital 100k / other 500k, × (1 + 1 inland + 1 unrecognised
//                            owner + 0.02 × years since 1836) — the defines' "(additive)" read as one summed multiplier (an inference). The trade
//                            centre's building file is patched in the mod's own copy where the build owns it, else in a whole-file copy of vanilla's.
//                            `log: true` (PROBE BUILDS ONLY): yearly, one PMR_TCG line per treaty-port state — its GDP, threshold, trade-centre levels.
// Called by build.ps1 after emit_ai_treaty_ports.mjs. usage: node tools/emit_treaty_port_rules.mjs <modDir> <config.json>
import fs from 'node:fs'; import path from 'node:path';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const [MOD, CFG] = process.argv.slice(2);
const die = m => { console.error('emit_treaty_port_rules: ' + m); process.exit(1); };
const BOOK = JSON.parse(fs.readFileSync(CFG, 'utf8'));
const R = BOOK.treaty_port_rules;
if (!R) { console.log('treaty port rules: none (vanilla)'); process.exit(0); }
for (const k of Object.keys(R)) if (!['no_port_building', 'seed_port_on_cession', 'trade_center_gate', 'probe'].includes(k) && !k.startsWith('_')) die(`unknown key treaty_port_rules.${k}`);
// ⚠ PROBED 2026-10-19 (session 20261019_120025, FINDINGS F244 §8): `no_port_building` ALONE is harmful — a portless state's demand is enforced and
// the engine splits the treaty-port province off to the taker, but WITHOUT the treaty-port status (the save's state record lacks treaty_port=yes)
// and with a level-0 port: a one-province conquest, not a treaty port. `seed_port_on_cession: true` builds a level-1 port in the host state inside
// the article's on_entry_into_force, immediately before vanilla's cede_treaty_port, if the state has none — the candidate fix, under probe.
const T = '\t';
const write = (r, txt) => { const p = path.join(MOD, r); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '\uFEFF' + txt); };
const readVanilla = r => fs.readFileSync(path.join(GAME, r), 'utf8').replace(/^\uFEFF/, '');
const replaceN = (txt, from, to, n, where) => {
  const parts = txt.split(from); if (parts.length - 1 !== n) die(`${where}: expected ${n} × "${from}", found ${parts.length - 1} (vanilla changed — fix the transform)`);
  return parts.join(to);
};
if (R.no_port_building || R.seed_port_on_cession) {
  const art = 'common/treaty_articles/14_treaty_port.txt';
  let a = readVanilla(art); const notes = [];
  if (R.no_port_building) {
    write('common/scripted_triggers/zzz_pm_rehaul_treaty_port_rules.txt',
      '# AUTO-GENERATED by tools/emit_treaty_port_rules.mjs - do not edit by hand.\n' +
      '# State scope. The engine\'s is_potential_treaty_port without its port-building requirement (FINDINGS F244 §6): $TAKER$ = the would-be holder.\n' +
      `pmr_treaty_port_candidate = {\n${T}is_coastal = yes\n${T}is_treaty_port = no\n${T}controls_treaty_port_province = yes\n${T}NOT = { owner = $TAKER$ }\n}\n`);
    a = replaceN(a, 'is_potential_treaty_port = scope:other_country', 'pmr_treaty_port_candidate = { TAKER = scope:other_country }', 2, art);
    notes.push('is_potential_treaty_port replaced by pmr_treaty_port_candidate');
  }
  if (R.seed_port_on_cession) {
    a = replaceN(a, '\t\t\t\t\t\tcede_treaty_port = scope:state_taker\n',
      `\t\t\t\t\t\t# pm_tech_rehaul: a level-1 port first where the state has none (FINDINGS F244 §8)\n` +
      `\t\t\t\t\t\tif = { limit = { NOT = { any_scope_building = { is_building_type = building_port } } } create_building = { building = building_port  level = 1 } }\n` +
      `\t\t\t\t\t\tcede_treaty_port = scope:state_taker\n`, 1, art);
    notes.push('a level-1 port seeded before the cession');
  }
  write(art, `# pm_tech_rehaul (tools/emit_treaty_port_rules.mjs): vanilla with ${notes.join('; ')}\n` + a);
}
if (R.no_port_building) {
  const wg = 'common/war_goal_types/25_take_treaty_port.txt';
  let w = readVanilla(wg);
  w = replaceN(w, 'is_potential_treaty_port = root', 'pmr_treaty_port_candidate = { TAKER = root }', 1, wg);
  w = replaceN(w, '\t\tvalidate_take_treaty_port\n', '\t\t# validate_take_treaty_port  (removed by pm_tech_rehaul: the port-building requirement)\n', 1, wg);
  write(wg, '# pm_tech_rehaul (tools/emit_treaty_port_rules.mjs): vanilla with is_potential_treaty_port replaced and validate_take_treaty_port removed\n' + w);
  console.log('treaty port rules: NO PORT-BUILDING REQUIREMENT — article possible + state_valid_trigger and the war goal valid ask pmr_treaty_port_candidate; validate_take_treaty_port removed');
}
if (R.trade_center_gate) {
  const TG = R.trade_center_gate === true ? {} : R.trade_center_gate;
  for (const k of Object.keys(TG)) if (k !== 'log' && !k.startsWith('_')) die(`unknown key treaty_port_rules.trade_center_gate.${k}`);
  // the engine's own gate must be OFF, or the script gate is dead weight and treaty ports stay gated by the engine
  const AD = BOOK.ai_defines || {};
  // ⚠ The engine VALIDATES both at load and a rejected key keeps vanilla's value (landmine L33): MARKET_CAPITAL must be > 0
  //   (0 was rejected, session 20261019_172655) and NON_MARKET_CAPITAL must be > MARKET_CAPITAL (1 / 1 was rejected, "Must be greater
  //   than 1", session 20261019_174541). "Off" is therefore £1 / £2 a year.
  const mc = AD.TRADE_CENTER_MINIMUM_GDP_MARKET_CAPITAL, nm = AD.TRADE_CENTER_MINIMUM_GDP_NON_MARKET_CAPITAL;
  if (!(mc > 0 && mc <= 1)) die(`trade_center_gate needs ai_defines.TRADE_CENTER_MINIMUM_GDP_MARKET_CAPITAL in (0, 1] (found ${mc}): the engine gate must be off (1 = £1 a year; 0 is rejected at load) for the script gate to replace it`);
  if (!(nm > mc && nm <= 2)) die(`trade_center_gate needs ai_defines.TRADE_CENTER_MINIMUM_GDP_NON_MARKET_CAPITAL in (MARKET_CAPITAL, 2] (found ${nm}, MARKET_CAPITAL ${mc}): the engine rejects a value not greater than MARKET_CAPITAL`);
  // vanilla's five defines, read live (a patch that moves them flows through)
  const ai = readVanilla('common/defines/00_ai.txt'); const def = k => { const m = new RegExp(`^\\s*${k}\\s*=\\s*([\\d.]+)`, 'm').exec(ai); if (!m) die(`00_ai.txt has no ${k}`); return +m[1]; };
  const V = { cap: def('TRADE_CENTER_MINIMUM_GDP_MARKET_CAPITAL'), other: def('TRADE_CENTER_MINIMUM_GDP_NON_MARKET_CAPITAL'), inland: def('TRADE_CENTER_MINIMUM_GDP_NON_COASTAL_MULT'),
    unrec: def('TRADE_CENTER_MINIMUM_GDP_UNRECOGNIZED_MULT'), years: def('TRADE_CENTER_MINIMUM_GDP_PASSED_YEARS_MULT') };
  write('common/script_values/zzz_pm_rehaul_trade_center_gate.txt', '# AUTO-GENERATED by tools/emit_treaty_port_rules.mjs (treaty_port_rules.trade_center_gate) - do not edit by hand.\n' +
    `# State scope. Vanilla's trade-centre GDP gate (00_ai.txt TRADE_CENTER_MINIMUM_GDP_*: ${V.cap} / ${V.other}, inland ×${V.inland}, unrecognised ×${V.unrec}, +${V.years} a year),\n` +
    `# the "(additive)" multipliers read as one summed multiplier. Used by the trade centre's can_build conditions with the engine's own gate set to 0.\n` +
    `pmr_tc_gdp_threshold = {\n${T}value = ${V.other}\n${T}if = { limit = { market.owner.market_capital ?= this } value = ${V.cap} }\n` +
    `${T}multiply = {\n${T}${T}value = 1\n${T}${T}if = { limit = { is_coastal = no } add = ${V.inland - 1} }\n` +
    `${T}${T}if = { limit = { owner = { is_country_type = unrecognized } } add = ${V.unrec - 1} }\n` +
    `${T}${T}add = { value = years_since_game_start  multiply = ${V.years} }\n${T}}\n}\n` +
    (TG.log ? `pmr_tc_levels = {\n${T}value = 0\n${T}every_scope_building = { limit = { is_building_type = building_trade_center } add = level }\n}\n` : ''));
  write('common/scripted_triggers/zzz_pm_rehaul_trade_center_gate.txt', '# AUTO-GENERATED by tools/emit_treaty_port_rules.mjs (treaty_port_rules.trade_center_gate) - do not edit by hand.\n' +
    '# State scope, inside the trade centre\'s can_build conditions: vanilla\'s AI GDP gate, with treaty ports exempt (FINDINGS F245).\n' +
    `pmr_tc_gdp_gate_government = {\n${T}OR = {\n${T}${T}is_treaty_port = yes\n${T}${T}scope:investor_country ?= { is_player = yes }\n${T}${T}gdp >= pmr_tc_gdp_threshold\n${T}}\n}\n` +
    `pmr_tc_gdp_gate_private = {\n${T}OR = {\n${T}${T}is_treaty_port = yes\n${T}${T}gdp >= pmr_tc_gdp_threshold\n${T}}\n}\n`);
  // the building file: the mod's own copy where the build owns it (books with port/railway tiers), else a whole-file copy of vanilla's
  const bf = 'common/buildings/11_private_infrastructure.txt'; const owned = fs.existsSync(path.join(MOD, bf));
  let b = owned ? fs.readFileSync(path.join(MOD, bf), 'utf8').replace(/^﻿/, '') : readVanilla(bf);
  b = replaceN(b, '\tcan_build_government = {\n\t\ttrade_center_construction_allowed = yes\n\t}', '\tcan_build_government = {\n\t\ttrade_center_construction_allowed = yes\n\t\tpmr_tc_gdp_gate_government = yes\n\t}', 1, bf);
  b = replaceN(b, '\tcan_build_private = {\n\t\ttrade_center_construction_allowed = yes\n\t}', '\tcan_build_private = {\n\t\ttrade_center_construction_allowed = yes\n\t\tpmr_tc_gdp_gate_private = yes\n\t}', 1, bf);
  write(bf, (owned ? '' : '# pm_tech_rehaul (tools/emit_treaty_port_rules.mjs): vanilla with the trade centre\'s AI GDP gate in its can_build conditions\n') + b);
  if (TG.log) {
    write('common/on_actions/zzz_pm_rehaul_trade_center_gate_log.txt', '# PROBE ONLY (tools/emit_treaty_port_rules.mjs, trade_center_gate.log). A named on_action (L22).\n' +
      `on_yearly_pulse_country = {\n${T}on_actions = { pmr_tcg_log }\n}\n\npmr_tcg_log = {\n${T}effect = {\n${T}${T}every_scope_state = {\n${T}${T}${T}limit = { is_treaty_port = yes }\n` +
      `${T}${T}${T}set_variable = { name = pmr_tcg_gdp  value = gdp }\n${T}${T}${T}set_variable = { name = pmr_tcg_thr  value = pmr_tc_gdp_threshold }\n${T}${T}${T}set_variable = { name = pmr_tcg_lv  value = pmr_tc_levels }\n` +
      `${T}${T}${T}debug_log = "PMR_TCG|[THIS.GetState.GetOwner.GetNameNoFormatting]|[THIS.GetState.GetNameNoFormatting]|gdp [THIS.GetState.MakeScope.Var('pmr_tcg_gdp').GetValue|0]|thr [THIS.GetState.MakeScope.Var('pmr_tcg_thr').GetValue|0]|tc [THIS.GetState.MakeScope.Var('pmr_tcg_lv').GetValue|0]|[TimeKeeper.GetCurrentDate.GetString]"\n` +
      `${T}${T}}\n${T}}\n}\n`);
  }
  console.log(`treaty port rules: TRADE-CENTRE GDP GATE IN SCRIPT — the engine gate off (£${mc} / £${nm}), vanilla's (${V.cap}/${V.other}) in the trade centre's can_build, treaty ports exempt; ${owned ? 'patched the build\'s own' : 'whole-file copy of vanilla\'s'} ${bf}${TG.log ? '; yearly PMR_TCG log' : ''}`);
}
if (R.probe) {
  const P = R.probe, tag = t => /^[A-Z][A-Z0-9]{2}$/.test(t) || die(`probe: bad tag ${t}`), st = s => /^STATE_[A-Z_0-9]+$/.test(s) || die(`probe: bad state ${s}`);
  // [STATE, HOST, TAKER] — a cede entry may carry a 4th element "seed": build a level-1 port in the state first, then cede
  const rows = k => (P[k] || []).map(e => { if (!Array.isArray(e) || e.length < 3 || e.length > 4 || (e.length === 4 && (k !== 'cede' || e[3] !== 'seed'))) die(`probe.${k}: entries are [STATE, HOST, TAKER] (cede: optional "seed")`); st(e[0]); tag(e[1]); tag(e[2]); return e; });
  const cede = rows('cede'), treaty = rows('treaty'), play = rows('play'), logT = (P.log || []).map(t => (tag(t), t));
  // every c:TAG behind an exists guard in an enclosing block (landmine L1)
  const guard = (e, body) => `${T}${T}if = {\n${T}${T}${T}limit = { exists = c:${e[1]}  exists = c:${e[2]} }\n${T}${T}${T}s:${e[0]}.region_state:${e[1]} ?= {\n${body}${T}${T}${T}}\n${T}${T}}\n`;
  const portLine = (kind, e) => `${T}${T}${T}${T}if = { limit = { any_scope_building = { is_building_type = building_port } } debug_log = "PMR_TPR|${kind}|${e[0]}|${e[1]}>${e[2]}|port yes" }\n` +
    `${T}${T}${T}${T}else = { debug_log = "PMR_TPR|${kind}|${e[0]}|${e[1]}>${e[2]}|port no" }\n`;
  // ⚠ 20261019_120025: cede_treaty_port at on_game_started_after_lobby did NOTHING, even for a state with a port (Veracruz) — so the cession and
  // treaty tests run at the FIRST MONTHLY PULSE (a global one-shot), the plays at the start (they worked there)
  let start = '', month = '';
  for (const e of cede) month += guard(e, portLine('cede', e) +
    (e[3] === 'seed' ? `${T}${T}${T}${T}if = { limit = { NOT = { any_scope_building = { is_building_type = building_port } } } create_building = { building = building_port  level = 1 } }\n` : '') +
    `${T}${T}${T}${T}cede_treaty_port = c:${e[2]}\n`);
  // a distinct saved-scope name per entry, so no entry can read another's state; first/target_country name the taker directly (root here is no
  // country: "A treaty must have a valid _FirstCountry", 20261019_120025)
  treaty.forEach((e, i) => { month += guard(e, portLine('treaty', e) + `${T}${T}${T}${T}save_scope_as = pmr_tpr_t${i}\n${T}${T}${T}${T}c:${e[2]} = {\n` +
    `${T}${T}${T}${T}${T}create_treaty = {\n${T}${T}${T}${T}${T}${T}name = pmr_tpr_treaty\n${T}${T}${T}${T}${T}${T}first_country = c:${e[2]}\n${T}${T}${T}${T}${T}${T}second_country = c:${e[1]}\n` +
    `${T}${T}${T}${T}${T}${T}is_draft = no\n${T}${T}${T}${T}${T}${T}binding_period = { years = 10 }\n${T}${T}${T}${T}${T}${T}articles_to_create = {\n` +
    `${T}${T}${T}${T}${T}${T}${T}{ article = treaty_port  source_country = c:${e[1]}  target_country = c:${e[2]}  inputs = { { state = scope:pmr_tpr_t${i} } } }\n` +
    `${T}${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}}\n`); });
  play.forEach((e, i) => { start += guard(e, portLine('play', e) + `${T}${T}${T}${T}save_scope_as = pmr_tpr_p${i}\n${T}${T}${T}${T}c:${e[2]} = {\n` +
    `${T}${T}${T}${T}${T}create_diplomatic_play = { name = pmr_tpr_play  target_state = scope:pmr_tpr_p${i}  type = dp_take_treaty_port }\n${T}${T}${T}${T}}\n`); });
  const eff = start;
  const logLim = logT.map(t => `AND = { exists = c:${t}  this = c:${t} }`).join('  ');
  write('common/on_actions/zzz_pm_rehaul_treaty_port_rules_probe.txt', '# PROBE ONLY (tools/emit_treaty_port_rules.mjs, treaty_port_rules.probe). Named on_actions (L22).\n' +
    `on_game_started_after_lobby = {\n${T}on_actions = { pmr_tpr_probe }\n}\n\non_monthly_pulse = {\n${T}on_actions = { pmr_tpr_month }\n}\n\non_monthly_pulse_country = {\n${T}on_actions = { pmr_tpr_log }\n}\n\n` +
    `pmr_tpr_probe = {\n${T}effect = {\n${eff}${T}${T}debug_log = "PMR_TPR|start done"\n${T}}\n}\n\n` +
    `pmr_tpr_month = {\n${T}trigger = { NOT = { has_global_variable = pmr_tpr_done } }\n${T}effect = {\n${T}${T}set_global_variable = pmr_tpr_done\n${month}${T}${T}debug_log = "PMR_TPR|month done|[TimeKeeper.GetCurrentDate.GetString]"\n${T}}\n}\n\n` +
    `pmr_tpr_log = {\n${T}trigger = { OR = { ${logLim} } }\n${T}effect = {\n${T}${T}every_scope_state = {\n${T}${T}${T}limit = { is_treaty_port = yes }\n` +
    `${T}${T}${T}if = { limit = { any_scope_building = { is_building_type = building_port } } debug_log = "PMR_TPR|held|[THIS.GetState.GetOwner.GetNameNoFormatting]|[THIS.GetState.GetNameNoFormatting]|port yes|[TimeKeeper.GetCurrentDate.GetString]" }\n` +
    `${T}${T}${T}else = { debug_log = "PMR_TPR|held|[THIS.GetState.GetOwner.GetNameNoFormatting]|[THIS.GetState.GetNameNoFormatting]|port no|[TimeKeeper.GetCurrentDate.GetString]" }\n` +
    `${T}${T}}\n${T}}\n}\n`);
  for (const lang of ['braz_por', 'english', 'french', 'german', 'japanese', 'korean', 'polish', 'russian', 'simp_chinese', 'spanish', 'turkish'])
    write(`localization/${lang}/replace/zzz_pm_rehaul_treaty_port_rules_l_${lang}.yml`, `l_${lang}:\n pmr_tpr_treaty:0 "Probe Treaty Port Treaty"\n pmr_tpr_play:0 "Probe Treaty Port Demand"\n`);
  console.log(`treaty port rules: PROBE — ${cede.length} cede, ${treaty.length} treaty, ${play.length} play tests (plays at the start, cessions and treaties at the first monthly pulse); monthly treaty-port log for ${logT.join(' ')}`);
}
