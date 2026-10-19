// THE AI'S DESIRE FOR TREATY PORTS, OPENED TO EVERY COUNTRY (BACKLOG D, FINDINGS F243; user-directed 2026-10-18, under probe).
// Config `ai_treaty_ports` (absent → this emits NOTHING): a `treaty_port_value` block appended to every ADMINISTRATIVE AI strategy in
// common/ai_strategies/01_admin_strategies.txt — vanilla: "Using this value in other strategies will function additively", and every AI runs
// exactly one administrative strategy, so every AI gets it once, ON TOP of vanilla's own terms (the default strategy's unrecognised-target term
// and Economic Imperialism's isolationist one, both untouched). Edits the mod's own copy where an earlier emitter wrote one (the subsidy policy,
// emit_ai_schooling), else a whole-file copy of vanilla's. THROWS if a strategy already carries treaty_port_value (this inserts, never merges).
//   law            { <law key without "law_">: points }  — the target's trade policy, the first match in the order given (list the
//                  variants BEFORE their parent: has_law for a variant, has_law_or_variant for the rest); keys checked against vanilla's laws
//   pop            { divisor, max }   + the target COUNTRY's population ÷ divisor, ≤ max
//   state_pop      { divisor, max }   + the host STATE's population ÷ divisor, ≤ max   (which port within a country)
//   state_gdp      { divisor, max }   + the host STATE's GDP ÷ divisor, ≤ max
//   flat           points added to every eligible target (0 in production; the probes' "extreme" book uses it)
//   conquer_stance_mult   × where we hold stance_conquer_region on the state's strategic region (conquest instead)
//   protectorate_mult     × where a protectorate is possible: the target minor / insignificant / unrecognised regional / unrecognised, and
//                         outranked by us (vanilla's subject_type_protectorate rank rule)
//   existing_port_mult    × where we already hold a treaty port in their market
//   max                   cap on this block's positive part
//   tech_margin, tech_add if our techs_researched − theirs ≤ tech_margin, add tech_add (−1000: cancels every other strategy's desire too)
// Eligibility (×0 otherwise): we are not isolationist, the state is reachable, the target is not in our market.
// Called by build.ps1 after emit_ai_schooling.mjs. usage: node tools/emit_ai_treaty_ports.mjs <modDir> <config.json>
import fs from 'node:fs'; import path from 'node:path';
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const [MOD, CFG] = process.argv.slice(2);
const die = m => { console.error('emit_ai_treaty_ports: ' + m); process.exit(1); };
const TP = JSON.parse(fs.readFileSync(CFG, 'utf8')).ai_treaty_ports;
if (!TP) { console.log('ai treaty ports: none (vanilla)'); process.exit(0); }
const KEYS = ['law', 'pop', 'state_pop', 'state_gdp', 'flat', 'conquer_stance_mult', 'protectorate_mult', 'existing_port_mult', 'max', 'tech_margin', 'tech_add', 'probe', 'driver'];
for (const k of Object.keys(TP)) if (!KEYS.includes(k) && !k.startsWith('_')) die(`unknown key ai_treaty_ports.${k}`);
const num = (v, name) => { if (typeof v !== 'number' || !Number.isFinite(v)) die(`${name} must be a number (${v})`); return v; };
for (const k of ['flat', 'conquer_stance_mult', 'protectorate_mult', 'existing_port_mult', 'max', 'tech_margin', 'tech_add']) num(TP[k], k);
for (const k of ['pop', 'state_pop', 'state_gdp']) { if (!TP[k]) die(`${k} missing`); if (!(num(TP[k].divisor, k + '.divisor') > 0)) die(`${k}.divisor must be > 0`); num(TP[k].max, k + '.max'); }
if (!TP.law || !Object.keys(TP.law).length) die('law table missing');
// every law key must be a vanilla law, and a variant must come before its parent (else the parent's has_law_or_variant catches it first)
const lawsDir = path.join(GAME, 'common/laws'); const parentOf = {}, known = new Set();
for (const f of fs.readdirSync(lawsDir).filter(f => f.endsWith('.txt'))) {
  let cur = null;
  for (const l of fs.readFileSync(path.join(lawsDir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    let m; if ((m = /^(law_[a-z_0-9]+)\s*=\s*\{/.exec(l))) { cur = m[1]; known.add(cur); }
    else if (cur && (m = /^\tparent\s*=\s*(law_[a-z_0-9]+)/.exec(l))) parentOf[cur] = m[1];
  }
}
const order = Object.keys(TP.law).map(k => 'law_' + k);
order.forEach((law, i) => {
  if (!known.has(law)) die(`law table: '${law}' is not a vanilla law`); num(TP.law[law.slice(4)], `law.${law}`);
  const p = parentOf[law]; if (p && order.indexOf(p) >= 0 && order.indexOf(p) < i) die(`law table: variant ${law} must come before its parent ${p}`);
});
const T = '\t';
const lawLines = order.map((law, i) => `${T}${T}${T}${i ? 'else_if' : 'if'} = { limit = { scope:target_country = { ${parentOf[law] ? 'has_law' : 'has_law_or_variant'} = law_type:${law} } } add = ${TP.law[law.slice(4)]} }`);
const block = [
  `${T}# pm_tech_rehaul (BACKLOG D, FINDINGS F243): the desire for a treaty port, for every country, additive with the default and diplomatic strategies`,
  `${T}treaty_port_value = {`,
  `${T}${T}value = 0`,
  `${T}${T}if = {`,
  `${T}${T}${T}limit = {`,
  `${T}${T}${T}${T}NOT = { has_law_or_variant = law_type:law_isolationism }`,
  `${T}${T}${T}${T}can_reach_target_state = yes`,
  `${T}${T}${T}${T}NOT = { market_capital.market ?= scope:target_country.market_capital.market }`,
  `${T}${T}${T}}`,
  ...(TP.flat ? [`${T}${T}${T}add = ${TP.flat}`] : []),
  ...lawLines,
  `${T}${T}${T}add = { value = scope:target_country.total_population  divide = ${TP.pop.divisor}  max = ${TP.pop.max} }`,
  `${T}${T}${T}add = { value = scope:target_state.state_population  divide = ${TP.state_pop.divisor}  max = ${TP.state_pop.max} }`,
  `${T}${T}${T}add = { value = scope:target_state.gdp  divide = ${TP.state_gdp.divisor}  max = ${TP.state_gdp.max} }`,
  `${T}${T}${T}if = {`,
  `${T}${T}${T}${T}limit = { any_country_strategic_region = { scope:target_state.region = this  root = { has_region_stance = { region = prev  stance = stance_conquer_region } } } }`,
  `${T}${T}${T}${T}multiply = ${TP.conquer_stance_mult}`,
  `${T}${T}${T}}`,
  `${T}${T}${T}else_if = {`,
  `${T}${T}${T}${T}limit = {`,
  `${T}${T}${T}${T}${T}scope:target_country = { OR = { country_rank = rank_value:minor_power  country_rank = rank_value:insignificant_power  country_rank = rank_value:unrecognized_regional_power  country_rank = rank_value:unrecognized_power } }`,
  `${T}${T}${T}${T}${T}country_rank > scope:target_country.country_rank`,
  `${T}${T}${T}${T}}`,
  `${T}${T}${T}${T}multiply = ${TP.protectorate_mult}`,
  `${T}${T}${T}}`,
  `${T}${T}${T}if = { limit = { has_treaty_port_in_market = scope:target_country.market } multiply = ${TP.existing_port_mult} }`,
  `${T}${T}${T}max = ${TP.max}`,
  `${T}${T}}`,
  `${T}${T}if = { limit = { pmr_tp_tech_lead <= ${TP.tech_margin} } add = ${TP.tech_add} }`,
  `${T}}`,
];
// the strategies
const rel = 'common/ai_strategies/01_admin_strategies.txt';
const owned = path.join(MOD, rel);
const lines = fs.readFileSync(fs.existsSync(owned) ? owned : path.join(GAME, rel), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
const blockEnd = s => { let d = 0; for (let i = s; i < lines.length; i++) { for (const ch of lines[i].replace(/#.*$/, '')) { if (ch === '{') d++; else if (ch === '}') d--; } if (d === 0) return i; } die(`${rel}: block at line ${s + 1} does not close`); };
const starts = lines.map((l, i) => /^ai_strategy_[a-z_0-9]+\s*=\s*\{/.test(l) ? i : -1).filter(i => i >= 0);
if (starts.length < 6) die(`${rel}: found ${starts.length} strategies (vanilla 1.13 has 6)`);
for (const s of starts.slice().reverse()) {
  const e = blockEnd(s);
  if (lines.slice(s, e + 1).some(l => /^\s*treaty_port_value\s*=/.test(l))) die(`${rel}: ${lines[s].trim()} already carries treaty_port_value`);
  if (lines[e].trim() !== '}') die(`${rel}: ${lines[s].trim()} does not end on its own closing brace line`);
  lines.splice(e, 0, ...block);
}
const write = (r, txt) => { const p = path.join(MOD, r); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '\uFEFF' + txt); };
write(rel, lines.join('\n'));
// the technology-lead helper: our count of researched technologies minus the target's (vanilla's Knowledge Sharing compares the same two)
write('common/script_values/zzz_pm_rehaul_treaty_ports.txt', '# AUTO-GENERATED by tools/emit_ai_treaty_ports.mjs - do not edit by hand.\n' +
  '# Read inside treaty_port_value (root = the would-be taker, scope:target_country = the host).\n' +
  `pmr_tp_tech_lead = {\n${T}value = techs_researched\n${T}subtract = scope:target_country.techs_researched\n}\n` +
  (TP.driver ? `# the driver's score of a state (state scope; root = the would-be taker): the engine's own treaty-port desire, every strategy summed\n` +
    `pmr_tp_state_desire = {\n${T}value = "ai_treaty_port_value(root)"\n}\n` : ''));
// ⭐ THE DRIVER — `driver: { chance, min_value, min_rank, cooldown_years }` (2026-10-18, overnight probes, FINDINGS F243 addendum). The engine
// turns treaty_port_value into a pursuit (an antagonise reason, a play) ONLY against unrecognised or decentralised hosts — the extreme probe's
// 1846 save carried 14 such pairs and none against a recognised host, though the desire for recognised hosts was 400+ and their states pass
// is_potential_treaty_port. So the desire alone cannot open recognised markets. The driver does what vanilla's own scripted cases do (the
// Opium War, the Samana lease, Meiji Japan): once a year an AI country — recognised, of at least `min_rank`, at peace, in no committed play,
// permitted aggressive plays, not infamous, off cooldown — rolls `chance` (percent); on success it takes the coastal state of a RECOGNISED
// host where its own engine-computed treaty-port desire (ai_treaty_port_value, i.e. every strategy's value: vanilla's terms, ours and the
// parity cancel) is highest and at least `min_value`, and starts a dp_take_treaty_port play on it. Unrecognised hosts stay the engine's.
// The play is an ordinary play from there: the AI's own escalation, swaying, war or back-down decide it.
if (TP.driver) {
  const D = TP.driver;
  for (const k of Object.keys(D)) if (!['chance', 'min_value', 'min_rank', 'cooldown_years', 'max_host_rank'].includes(k) && !k.startsWith('_')) die(`unknown key driver.${k}`);
  // `max_host_rank` (optional): the highest host rank the driver may target. A great power never backs down to a treaty-port demand (its AI
  // acceptance is −1,000), so plays against one only fizzle or escalate (calibration 20261019_004649: 7 driven plays, all on Russia and the
  // Ottomans, no port).
  if (D.max_host_rank != null && !['great_power', 'major_power', 'minor_power'].includes(D.max_host_rank)) die(`driver.max_host_rank '${D.max_host_rank}'`);
  const hostRank = D.max_host_rank ? `  country_rank <= rank_value:${D.max_host_rank}` : '';
  if (!(num(D.chance, 'driver.chance') > 0 && D.chance <= 100)) die('driver.chance must be in (0, 100]');
  num(D.min_value, 'driver.min_value');
  if (!['great_power', 'major_power', 'minor_power'].includes(D.min_rank)) die(`driver.min_rank '${D.min_rank}'`);
  if (!(Number.isInteger(D.cooldown_years) && D.cooldown_years >= 1)) die('driver.cooldown_years must be a whole number ≥ 1');
  write('common/on_actions/zzz_pm_rehaul_treaty_port_driver.txt', '# AUTO-GENERATED by tools/emit_ai_treaty_ports.mjs (ai_treaty_ports.driver) - do not edit by hand. A named on_action (L22).\n' +
    `on_yearly_pulse_country = {\n${T}on_actions = { pmr_tp_driver }\n}\n\npmr_tp_driver = {\n${T}trigger = {\n` +
    `${T}${T}is_player = no\n${T}${T}is_country_type = recognized\n${T}${T}country_rank >= rank_value:${D.min_rank}\n${T}${T}is_at_war = no\n` +
    `${T}${T}is_diplomatic_play_committed_participant = no\n${T}${T}aggressive_diplomatic_plays_permitted = yes\n` +
    `${T}${T}NOT = { infamy >= infamy_threshold:infamous }\n${T}${T}NOT = { has_variable = pmr_tp_cooldown }\n${T}}\n` +
    `${T}effect = {\n${T}${T}random = {\n${T}${T}${T}chance = ${D.chance}\n` +
    `${T}${T}${T}ordered_state = {\n${T}${T}${T}${T}limit = {\n${T}${T}${T}${T}${T}is_coastal = yes\n${T}${T}${T}${T}${T}is_treaty_port = no\n` +
    // the host must be in no committed play (production calibration 20261019_002008: without it up to five AIs demanded Kherson at once)
    `${T}${T}${T}${T}${T}owner = { NOT = { this = root }  is_country_type = recognized  NOT = { is_subject_of = root }  is_diplomatic_play_committed_participant = no${hostRank} }\n` +
    `${T}${T}${T}${T}${T}is_potential_treaty_port = root\n${T}${T}${T}${T}${T}pmr_tp_state_desire >= ${D.min_value}\n${T}${T}${T}${T}}\n` +
    `${T}${T}${T}${T}order_by = pmr_tp_state_desire\n${T}${T}${T}${T}position = 0\n${T}${T}${T}${T}check_range_bounds = no\n${T}${T}${T}${T}save_scope_as = pmr_tp_target\n${T}${T}${T}}\n` +
    `${T}${T}${T}if = {\n${T}${T}${T}${T}limit = { exists = scope:pmr_tp_target }\n` +
    `${T}${T}${T}${T}create_diplomatic_play = {\n${T}${T}${T}${T}${T}name = pmr_treaty_port_demand\n${T}${T}${T}${T}${T}target_state = scope:pmr_tp_target\n${T}${T}${T}${T}${T}type = dp_take_treaty_port\n${T}${T}${T}${T}}\n` +
    `${T}${T}${T}${T}set_variable = { name = pmr_tp_cooldown  years = ${D.cooldown_years} }\n` +
    `${T}${T}${T}${T}scope:pmr_tp_target = { debug_log = "PMR_TPD|[ROOT.GetCountry.GetNameNoFormatting]|[THIS.GetState.GetOwner.GetNameNoFormatting]|[THIS.GetState.GetNameNoFormatting]|[TimeKeeper.GetCurrentDate.GetString]" }\n` +
    `${T}${T}${T}}\n${T}${T}}\n${T}}\n}\n`);
  // the driven play's name (an English stub in every language: an untranslated key shows as a raw <key>, CLAUDE.md → Localization)
  for (const lang of ['braz_por', 'english', 'french', 'german', 'japanese', 'korean', 'polish', 'russian', 'simp_chinese', 'spanish', 'turkish'])
    write(`localization/${lang}/replace/zzz_pm_rehaul_treaty_ports_l_${lang}.yml`, `l_${lang}:\n pmr_treaty_port_demand:0 "Treaty Port Demand"\n`);
  console.log(`ai treaty ports: DRIVER — yearly, ${D.chance}% per eligible AI (recognised, ≥ ${D.min_rank}), the best recognised host state at desire ≥ ${D.min_value}, cooldown ${D.cooldown_years}y`);
}
// ⚗ PROBE BUILDS ONLY — `probe: { takers: [tags], hosts: [tags] }`: at the campaign start, for every taker and every coastal state of every host,
// one debug.log line PMR_TPP|<taker>|<host>|<state>|<potential yes/no>|<the engine's own ai_treaty_port_value of that state for that taker>.
// It answers what the engine's is_potential_treaty_port admits (FINDINGS F243 left it open) and whether the desire reaches a state at all.
if (TP.probe) {
  const tk = TP.probe.takers || [], hs = TP.probe.hosts || [];
  if (!tk.length || !hs.length) die('probe needs takers and hosts');
  const tagOk = t => /^[A-Z][A-Z0-9]{2}$/.test(t) || die(`probe: bad tag ${t}`); tk.forEach(tagOk); hs.forEach(tagOk);
  // ⚠ a saved scope is NOT visible inside log text (the first probe printed an empty taker and a 0 value everywhere): the taker is printed
  //   on its own header line from its own scope, and the value is stored on the state as a variable first, in the effect, where saved
  //   scopes are visible
  const line = pot => `set_variable = { name = pmr_tpv  value = pmr_tpp_val }  debug_log = "PMR_TPP|[THIS.GetState.GetOwner.GetNameNoFormatting]|[THIS.GetState.GetNameNoFormatting]|${pot}|[THIS.GetState.MakeScope.Var('pmr_tpv').GetValue|0]"`;
  write('common/script_values/zzz_pm_rehaul_treaty_port_probe.txt', '# PROBE ONLY (emit_ai_treaty_ports.mjs, ai_treaty_ports.probe): the engine\'s treaty-port desire of a state for the saved taker.\n' +
    `pmr_tpp_val = {\n${T}value = "ai_treaty_port_value(scope:pmr_tpp_taker)"\n}\n` +
    `pmr_tpp_techs = {\n${T}value = techs_researched\n}\n`);
  write('common/on_actions/zzz_pm_rehaul_treaty_port_probe.txt', '# PROBE ONLY (emit_ai_treaty_ports.mjs, ai_treaty_ports.probe). A named on_action (L22).\n' +
    `on_game_started_after_lobby = {\n${T}on_actions = { pmr_tpp_probe }\n}\n\npmr_tpp_probe = {\n${T}effect = {\n` +
    // every tag behind an exists guard on the same line (landmine L1: a c:TAG of a country that does not exist raises an error, not false)
    `${T}${T}every_country = {\n${T}${T}${T}limit = { OR = { ${tk.map(t => `AND = { exists = c:${t}  this = c:${t} }`).join('  ')} } }\n${T}${T}${T}save_scope_as = pmr_tpp_taker\n` +
    `${T}${T}${T}debug_log = "PMR_TPP_T|[THIS.GetCountry.GetNameNoFormatting]|techs [THIS.GetCountry.MakeScope.ScriptValue('pmr_tpp_techs')|0]"\n` +
    `${T}${T}${T}every_state = {\n${T}${T}${T}${T}limit = { is_coastal = yes  owner = { OR = { ${hs.map(t => `AND = { exists = c:${t}  this = c:${t} }`).join('  ')} } }  NOT = { owner = scope:pmr_tpp_taker } }\n` +
    `${T}${T}${T}${T}if = { limit = { is_potential_treaty_port = scope:pmr_tpp_taker } ${line('yes')} }\n` +
    `${T}${T}${T}${T}else = { ${line('no')} }\n${T}${T}${T}}\n${T}${T}}\n${T}${T}debug_log = "PMR_TPP|done"\n${T}}\n}\n`);
  console.log(`ai treaty ports: PROBE — logs is_potential_treaty_port + ai_treaty_port_value for ${tk.length} takers × the coastal states of ${hs.length} hosts at the campaign start`);
}
console.log(`ai treaty ports: treaty_port_value in ${starts.length} administrative strategies (flat ${TP.flat}, laws ${order.map(l => l.slice(4) + ' ' + TP.law[l.slice(4)]).join(' / ')}, max ${TP.max}, parity margin ${TP.tech_margin} → ${TP.tech_add})`);
