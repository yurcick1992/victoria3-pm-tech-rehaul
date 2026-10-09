// THE HYDRO-DAM MEGAPROJECTS, EMITTED (ROADMAP step 6, BALANCE_FRAMEWORK §10.89, user-ruled 2026-09-26).
//
//   node tools/emit_dams.mjs <modRoot> [configPath]        # called by tools/build.ps1
//
// Config `dams` absent or `enabled: false` → emits nothing. Enabled → per project (config/dam_projects.json,
// one per state; the numbers are tools/lib_dams.mjs's — ONE derivation):
//   • ONE building per project, `building_dam_<id>`, with up to `stages` LEVELS. The cap is the ENGINE's (`has_max_level`,
//     the max level a per-project state trait `pmr_dam_<id>_site` carries — since 2026-10-05, because the scripted cap,
//     vanilla's trade-centre idiom `level_after_queued_constructions`, let a shift+click queue five levels past it, and is
//     removed). Its group is NOT government-funded (a government-funded building
//     cannot be built by another country), `can_build_private = { always = no }` keeps the private queue out (the
//     skyscraper idiom), and `can_build_government` reads the BUILDER through `scope:investor_country`: it must be
//     the anchor owner or above it in the overlord chain, must have completed its OWN survey, and must hold the
//     technology of the next level's class. Several such builders share the levels like a deposit: the cap counts
//     everyone's queued levels, and each owns what it built. `ownership_type = self` lets an overlord build a level in a
//     subject's state through its own government queue (the engine refuses a building with no ownership type in a foreign
//     state). ⭐ THE ENGINE BUILDS EVERY LEVEL (user-ruled 2026-09-27, FINDINGS F173/F174): with an ownership type and
//     local electricity demand the AI builds dams itself, at home and in its subjects, so nothing here queues, finances or
//     creates a dam level — the scripted owner-queue starts and the overlord financing are gone. `potential` shows the dam
//     only in the split part of the state holding the ANCHOR PROVINCE, once someone has surveyed it.
//   • a SURVEY decision for the anchor owner and every country above it in its overlord chain — never a great power
//     as such, never an investor — once the first level's technology is held (the SAME technology building level 1
//     needs, so a country that cannot survey cannot build either): a bureaucracy-cost modifier and a counter journal
//     entry (vanilla's canal pattern). One survey at a time per project; a completed survey is a two-year claim nobody
//     else may survey through. The AI does not take the decision (F168): it scores every visible decision in one pass.
//     AI countries SURVEY through the quarterly DRIVER below — the only thing the driver does.
//   • the non-power effects (config/dam_projects.json `effects`): arable land and state-trait swaps, fired from
//     on_building_built / on_building_expanded when the dam first reaches the named level; `start` at the campaign start.
//   • the electricity lines of the vanilla hydro-narrative state traits (config `dams.strip_trait_modifiers`)
//     removed by WHOLE-FILE copies of their vanilla trait files — every other line vanilla's, asserted.
//   • telemetry: debug.log lines `PMR_DAM|<event>|<project>|<country name>|<date>|bur <produced>/<used>` (TESTBED_METRICS).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { REPO, deriveAll } from './lib_dams.mjs';

const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_dams.mjs <modRoot> [configPath]'); process.exit(2); }
const CFGPATH = process.argv[3] || join(REPO, 'config/mod_config.json');
const CFG = JSON.parse(readFileSync(CFGPATH, 'utf8'));
if (!CFG.dams?.enabled) { console.log('dams: disabled - nothing emitted'); process.exit(0); }

const die = m => { throw new Error('emit_dams: ' + m); };
// A PERFORMANCE PROBE SWITCH (2026-10-08, the tick-cost isolation batches): `dams.perf_off` lists dam parts to leave out —
// 'static' (the base_values copy with the 144 level caps, and their modifier types), 'traits' (the site traits added at the
// campaign start), 'events' (decisions, journal entries and every on_action but the campaign start), 'buildings' (the dam
// buildings, methods, groups and building group; needs 'events', which name them). No book ships with it: a dam left without
// its static cap cannot be built at all, which a 1836-1856 probe never reaches anyway.
const PERF_OFF = new Set(CFG.dams.perf_off || []);
const STATIC_MODE = CFG.dams.static_mode || 'base_values';
if (!['base_values', 'country_modifier', 'country_modifier_tech'].includes(STATIC_MODE)) die(`static_mode '${STATIC_MODE}'`);
for (const k of PERF_OFF) if (!['static', 'traits', 'events', 'buildings'].includes(k)) die(`perf_off: unknown part '${k}'`);
if (PERF_OFF.has('buildings') && !PERF_OFF.has('events')) die(`perf_off: 'buildings' needs 'events' (the decisions and journal entries name the buildings)`);
const W = (rel, s) => { const f = join(MOD, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, '\uFEFF' + s, 'utf8'); };
const T = '\t';
const stripBom = s => s.replace(/^\uFEFF/, '');
const { P, projects } = deriveAll(CFG);
const HDR = `# AUTO-GENERATED by tools/emit_dams.mjs from ${CFGPATH.replace(/\\/g, '/').split('/').slice(-2).join('/')} + ${P.projects_file} - do not edit by hand.\n\n`;
const DATE = '[TimeKeeper.GetCurrentDate.GetString]';
// the country's bureaucracy at the moment of a log line: produced / used (script values emitted below)
const BUR = "bur [THIS.GetCountry.MakeScope.ScriptValue('pmr_dam_bur_produced')|0]/[THIS.GetCountry.MakeScope.ScriptValue('pmr_dam_bur_used')|0]";
// ⚠ there is NO country-tag data function (TESTBED_METRICS §3: GetTag voids the line) - logs carry the NAME
const TAG = '[THIS.GetCountry.GetNameNoFormatting]';
const ACTIVE = 'pmr_dam_active_surveys';   // per country: dam surveys under way (the AI runs one at a time)

// ---------------------------------------------------------------- validation against the game
const stateProv = {};
for (const f of readdirSync(join(GAME, 'map_data/state_regions'))) {
  const txt = stripBom(readFileSync(join(GAME, 'map_data/state_regions', f), 'utf8'));
  for (const m of txt.matchAll(/^(STATE_[A-Z0-9_]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const pm = /provinces\s*=\s*\{([^}]*)\}/.exec(m[2]);
    stateProv[m[1]] = new Set((pm ? pm[1] : '').match(/x[0-9A-Fa-f]{6}/g)?.map(s => 'x' + s.slice(1).toUpperCase()) || []);
  }
}
const techFiles = readdirSync(join(GAME, 'common/technology/technologies')).map(f => readFileSync(join(GAME, 'common/technology/technologies', f), 'utf8')).join('\n');
for (const t of new Set(Object.values(P.tech_by_class))) if (!new RegExp(`^${t}\\s*=\\s*\\{`, 'm').test(techFiles)) die(`technology ${t} not in the game`);
for (const p of projects) {
  if (!stateProv[p.state]) die(`${p.id}: ${p.state} is not a state region`);
  if (!stateProv[p.state].has(p.anchor_province)) die(`${p.id}: anchor ${p.anchor_province} is not a province of ${p.state}`);
}

// ---------------------------------------------------------------- shared triggers
// the country in scope (ROOT) owns the anchor province, or sits above its owner in the overlord chain
const chainOf = p => `p:${p.anchor_province} ?= {\n${T}${T}${T}state ?= {\n${T}${T}${T}${T}owner ?= {\n${T}${T}${T}${T}${T}OR = {\n${T}${T}${T}${T}${T}${T}this = ROOT\n${T}${T}${T}${T}${T}${T}any_overlord_or_above = { this = ROOT }\n${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}}\n${T}${T}${T}}\n${T}${T}}`;
const isOwnerOf = p => `p:${p.anchor_province} ?= { state ?= { owner ?= ROOT } }`;
// ⭐ dams.rules = 'family' (user-ruled 2026-09-28, FINDINGS F176): CONSTRUCTION RIGHTS = the anchor owner, any country above it in the
// overlord chain, or a country holding foreign investment rights in the owner OR in any country of that chain (p26b: Prussia built in
// Norway, Sweden's subject, on its rights with Sweden). No siblings, no power-bloc route. WHO is ROOT (a decision, a journal entry)
// or scope:investor_country (a building).
// ⚠ NOT vanilla's has_treaty_foreign_investment_rights_with: it is a SCRIPTED trigger that pastes $TARGET$ inside any_scope_treaty,
// so a TARGET = PREV resolves to the treaty (probe p29: 111,923 "left was 'country', right was 'treaty'" errors in three minutes).
// The test is written from the HOST's side instead: it holds a treaty binding WHO with an investment-rights article whose TARGET is
// WHO (vanilla's article: source = the country granting the rights, target = the holder; a treaty binds two countries)
const hostGrants = WHO => `any_scope_treaty = { binds = ${WHO}  any_scope_article = { has_type = foreign_investment_rights  target_country = ${WHO} } }`;
const R2 = CFG.dams.rules === 'family';
// the monthly dam level log (built level / level counting queued constructions, per dam): the contest probe, or dams.log_levels
// (the prod-like batches read stalls from it; user, 2026-09-28)
const LOGLV = !!(P.probe?.contest || CFG.dams.log_levels);
const rightsOf = (p, WHO) => `p:${p.anchor_province} ?= {\n${T}${T}${T}state ?= {\n${T}${T}${T}${T}owner ?= {\n${T}${T}${T}${T}${T}OR = {\n` +
  `${T}${T}${T}${T}${T}${T}this = ${WHO}\n${T}${T}${T}${T}${T}${T}any_overlord_or_above = { this = ${WHO} }\n` +
  `${T}${T}${T}${T}${T}${T}${hostGrants(WHO)}\n` +
  `${T}${T}${T}${T}${T}${T}any_overlord_or_above = { ${hostGrants(WHO)} }\n` +
  `${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}}\n${T}${T}${T}}\n${T}${T}}`;
// the family survey: a survey completed by a country inside the anchor owner's top-overlord family stores that family's top
// (global_var:<v>_family); every member of that family with construction rights may then build without its own survey
const inFamily = (p, WHO) => `${WHO} ?= { OR = { this = global_var:${V(p)}_family  top_overlord ?= { this = global_var:${V(p)}_family } } }`;
const hasSurvey = (p, WHO) => `OR = {\n${T}${T}${T}${T}${WHO} ?= { has_variable = ${V(p)}_surveyed }\n` +
  `${T}${T}${T}${T}AND = { has_global_variable = ${V(p)}_family  ${inFamily(p, WHO)} }\n${T}${T}${T}}`;
if (R2 && (P.probe?.open_builders || P.probe?.decision_ai)) die(`dams.rules = family sets the builders and the AI survey itself - drop probe.open_builders / probe.decision_ai`);
const V = p => `pmr_dam_${p.id}`;     // variable / key stem

// ---------------------------------------------------------------- building group
// NOT government-funded (user, 2026-09-26): a government-funded group (administration, army) cannot be built by
// another country, and the overlord must be able to build and own the dam in a subject's state. So the group sits
// under bg_private_infrastructure like the trade centre, and each dam forbids the private queue itself
// (can_build_private = { always = no }, vanilla's skyscraper idiom).
// ⭐ THE LEVEL CAP IS THE ENGINE'S (user's playtest, 2026-10-05): the scripted cap in can_build_government
// (level_after_queued_constructions) is evaluated ONCE per click, so a shift+click queued five levels past it and all
// were built. Each dam now carries vanilla's `has_max_level = yes` (the barracks / construction-sector mechanism): its
// max level is state_building_dam_<id>_max_level_add, carried by vanilla's `base_values` (every country; see the site traits
// below for why not a state trait). A per-project state trait (pmr_dam_<id>_site, added at the campaign start —
// pmr_dam_add_caps; it shows in every split part of the region, user-accepted 2026-10-05) is the visible label. The scripted cap is gone. `stateregion_max_level` makes the cap count
// the whole state REGION (vanilla's bg_infrastructure flag), so the split parts of a state can never add up past it.
W('common/building_groups/zzz_pm_rehaul_dams.txt', HDR +
`bg_pmr_hydro_dams = {
${T}parent_group = bg_private_infrastructure
${T}lens = special
${T}is_government_funded = no
${T}subsidized = yes
${T}inheritable_construction = yes
${T}economy_of_scale = no
${T}urbanization = 10
${T}stateregion_max_level = yes
}
`);

// PROBE: the AI takes the survey DECISION itself (vanilla's canal pattern) instead of the driver - dams.probe.decision_ai
// ⭐ dams.rules = 'family': the AI takes the survey decision itself (no driver), gated in `possible` on spare bureaucracy >= the
// survey's cost, and - FOR THE AI ONLY - on a 30-day "just took a survey" variable (F176 §4: without it one AI pass takes several
// surveys against one stale bureaucracy reading; the user prefers no forced pause for players)
const DAI = R2 ? { weight: 10, gate: 'headroom', headroom_mult: 1 } : (P.probe?.decision_ai || null);
const TCD = R2 ? 30 : P.probe?.take_cooldown_days;
const TCD_AI_ONLY = R2;
// PROBE: open builders - no chain requirement in can_build_government, the engine's own rules (investment rights) decide
const OPEN = !!P.probe?.open_builders;
// ---------------------------------------------------------------- buildings, methods, groups
const bld = [], pms = [], pmgs = [], mods = [], decs = [], jes = [], loc = [], seff = [];
const surveyOpen = new Map();
const BKEY = p => `building_dam_${p.id}`;
// the builder (scope:investor_country, vanilla's trade-centre idiom) is the anchor owner or above it in its overlord chain
const builderInChain = p => `scope:investor_country ?= {\n${T}${T}${T}${T}OR = {\n${T}${T}${T}${T}${T}this = p:${p.anchor_province}.state.owner\n` +
  `${T}${T}${T}${T}${T}p:${p.anchor_province}.state.owner ?= { any_overlord_or_above = { this = scope:investor_country } }\n${T}${T}${T}${T}}\n${T}${T}${T}}`;
const levelsAtLeast = (p, n) => `any_scope_building = { is_building_type = ${BKEY(p)}  level_after_queued_constructions >= ${n} }`;
for (const p of projects) {
  const v = V(p), key = BKEY(p);
  pmgs.push(`pmg_dam_${p.id} = {\n${T}texture = "gfx/interface/icons/generic_icons/mixed_icon_base.dds"\n${T}ai_selection = most_productive\n${T}production_methods = {\n${T}${T}pm_dam_${p.id}\n${T}}\n}`);
  pms.push(`pm_dam_${p.id} = {\n${T}texture = "gfx/interface/icons/production_method_icons/hydroelectric_plant.dds"\n\n` +
    `${T}building_modifiers = {\n${T}${T}workforce_scaled = {\n` +
    Object.entries(p.inputs).map(([g, q]) => `${T}${T}${T}goods_input_${g}_add = ${q}\n`).join('') +
    `${T}${T}${T}goods_output_electricity_add = ${p.stage_units}\n${T}${T}}\n\n${T}${T}level_scaled = {\n` +
    Object.entries(p.staff).map(([prof, q]) => `${T}${T}${T}building_employment_${prof}_add = ${q}\n`).join('') +
    `${T}${T}}\n${T}}\n}`);
  loc.push([`pmg_dam_${p.id}`, 'Hydroelectric Station'], [`pm_dam_${p.id}`, `${p.name} Hydroelectric Station`]);
  // the technology each LEVEL needs: from the first level of a later class on, the builder must hold that class's technology
  const classGates = [];
  p.stage_classes.forEach((c, i) => { if (i > 0 && c !== p.stage_classes[i - 1]) classGates.push({ level: i + 1, tech: P.tech_by_class[c] }); });
  bld.push(`${key} = {\n` +
    `${T}building_group = bg_pmr_hydro_dams\n` +
    `${T}icon = "gfx/interface/icons/building_icons/power_plant.dds"\n` +
    `${T}city_type = city\n${T}levels_per_mesh = 50\n` +
    `${T}expandable = yes\n${T}downsizeable = no\n` +
    // the engine-enforced cap: max level = state_building_<key>_max_level_add, set to p.stages by the site trait
    `${T}has_max_level = yes\n` +
    `${T}required_construction = ${p.stage_points}\n\n` +
    // ⚠ NO unlocking_technologies: the first level's technology is checked on the BUILDER in can_build_government, so an
    // overlord can build in a subject that lacks it (the user's Ceylon test in the Britain-only build, 2026-09-27) — identical
    // for a country building its own dam. It is the same technology the survey needs (surveyOpen below).
    // Only the split part of the state that holds the anchor province LISTS the dam (user, 2026-09-26: Lawpita Falls showed in
    // three parts of Pegu), and only once someone in the chain has surveyed it (so no state lists it from 1836).
    `${T}potential = {\n${T}${T}state_region = s:${p.state}\n${T}${T}owner ?= p:${p.anchor_province}.state.owner\n${T}${T}has_global_variable = ${v}_surveyed_any\n${T}}\n\n` +
    `${T}can_build_government = {\n` +
    (OPEN ? '' : `${T}${T}custom_tooltip = {\n${T}${T}${T}text = ${v}_builder_tt\n${T}${T}${T}${R2 ? rightsOf(p, 'scope:investor_country') : builderInChain(p)}\n${T}${T}}\n`) +
    `${T}${T}custom_tooltip = {\n${T}${T}${T}text = ${v}_tech_1_tt\n${T}${T}${T}scope:investor_country ?= { has_technology_researched = ${p.stage_techs[0]} }\n${T}${T}}\n` +
    `${T}${T}custom_tooltip = {\n${T}${T}${T}text = ${v}_surveyed_tt\n${T}${T}${T}${R2 ? hasSurvey(p, 'scope:investor_country') : `scope:investor_country ?= { has_variable = ${v}_surveyed }`}\n${T}${T}}\n` +
    // NO scripted level cap here (removed 2026-10-05): the engine's has_max_level enforces it, counting every builder's queued
    // levels, so concurrent builders share the project's levels the way mines share a state's deposit; each owns what it built
    classGates.map(g => `${T}${T}custom_tooltip = {\n${T}${T}${T}text = ${v}_tech_${g.level}_tt\n${T}${T}${T}OR = {\n${T}${T}${T}${T}NOT = { ${levelsAtLeast(p, g.level - 1)} }\n` +
      `${T}${T}${T}${T}scope:investor_country ?= { has_technology_researched = ${g.tech} }\n${T}${T}${T}}\n${T}${T}}\n`).join('') +
    `${T}}\n\n` +
    `${T}can_build_private = {\n${T}${T}always = no\n${T}}\n\n` +
    // ⚠ WITHOUT an ownership_type the engine treats the building like an administration or a monument and refuses it in a
    // FOREIGN state ("<building> cannot be constructed in a foreign state", CANNOT_EXPAND_BUILDING_NOT_OWNABLE — user's
    // playtest, 2026-09-27). `self` is what the trade centre, ports and power plant carry, all of which a foreign
    // government can build: the overlord's own government queue then builds the level in its subject's state
    `${T}ownership_type = self\n\n` +
    // added to the AI's nationalization_desire: it privatises below NATIONALIZATION_DESIRE_PRIVATIZE_THRESHOLD 0.0 and
    // nationalises above ..._NATIONALIZE_THRESHOLD 1.0 (vanilla industries ±0.25). 0.75 = never privatised, and never
    // high enough to nationalise a dam another country owns. ⚠ buildings.md documents `ai_privatization_deisre`: the
    // engine REJECTS that key (probe p6, "Unexpected token") - the real one is vanilla's `ai_nationalization_desire`.
    // A law that FORCES privatisation (Laissez-faire) only makes it available for sale to the private investment pool,
    // i.e. to a real private owner (probe p6/p7 read the ownership from the save)
    `${T}ai_nationalization_desire = 0.75\n\n` +
    `${T}ai_value = {\n${T}${T}value = ${P.ai.stage_ai_value}\n` +
    `${T}${T}if = {\n${T}${T}${T}limit = {\n${T}${T}${T}${T}owner ?= {\n${T}${T}${T}${T}${T}OR = {\n${T}${T}${T}${T}${T}${T}in_default = yes\n${T}${T}${T}${T}${T}${T}is_at_war = yes\n${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}}\n${T}${T}${T}}\n${T}${T}${T}multiply = 0.1\n${T}${T}}\n${T}}\n\n` +
    `${T}production_method_groups = {\n${T}${T}pmg_dam_${p.id}\n${T}}\n\n` +
    `${T}background = "gfx/interface/icons/building_icons/backgrounds/building_panel_bg_monuments.dds"\n}`);
  loc.push([key, p.name], [`${key}_lens_option`, `Construct $${key}$`],
    [`${v}_builder_tt`, R2 ? `The builder owns the dam site's province, stands above its owner in the overlord chain, or holds investment rights in the owner or one of its overlords`
      : `The builder owns the dam site's province, or stands above its owner in the overlord chain`],
    [`${v}_surveyed_tt`, R2 ? `The builder has surveyed the ${p.name}, or a country of the builder's own overlord family has`
      : `The builder has completed its own survey of the ${p.name}`],
    ...(R2 ? [[`${v}_block_tt`, `No other survey of the ${p.name} has started in the last 12 months`],
      [`${v}_queued_tt`, `No level of the ${p.name} is waiting in a construction queue`]] : []));
  for (const g of classGates) loc.push([`${v}_tech_${g.level}_tt`, `From level ${g.level} on, the builder needs the technology $${g.tech}$`]);
  loc.push([`${v}_tech_1_tt`, `The builder needs the technology $${p.stage_techs[0]}$`]);

  // survey modifier, scripted effect, decisions, journal entry
  mods.push(`${v}_surveying = {\n${T}icon = gfx/interface/icons/timed_modifier_icons/modifier_documents_negative.dds\n${T}country_bureaucracy_cost_add = ${p.survey_bureaucracy}\n}`);
  loc.push([`${v}_surveying`, `Surveying: ${p.name}`]);
  seff.push(`${v}_begin_survey = {\n${T}set_variable = { name = ${v}_months value = 0 }\n${T}set_global_variable = ${v}_surveying\n` +
    (R2 ? `${T}set_global_variable = { name = ${v}_block  days = 365 }\n` : '') +
    `${T}add_modifier = { name = ${v}_surveying }\n${T}add_journal_entry = { type = je_${v}_survey }\n` +
    `${T}if = {\n${T}${T}limit = { NOT = { has_variable = ${ACTIVE} } }\n${T}${T}set_variable = { name = ${ACTIVE} value = 0 }\n${T}}\n${T}change_variable = { name = ${ACTIVE} add = 1 }\n` +
    `${T}debug_log = "PMR_DAM|survey_start|${p.id}|${TAG}|${DATE}|${BUR}"\n}`);
  // open to ROOT: the FIRST LEVEL's technology (the same one can_build_government asks of a builder), ROOT has not surveyed it, nobody is surveying it, no other country's
  // two-year claim stands, the dam still has a free level, and ROOT is in the anchor owner's overlord chain
  surveyOpen.set(p.id, R2
    // rules 'family': shown to every country with construction rights that holds the first level's technology and has no survey
    // of its own or of its family; the 12-month block and a queued level only make it UNAVAILABLE (possible), never hidden
    ? `has_technology_researched = ${p.stage_techs[0]}\n${T}${T}NOT = { ${hasSurvey(p, 'ROOT')} }\n${T}${T}NOT = { has_variable = ${v}_months }\n` +
      `${T}${T}NOT = { p:${p.anchor_province}.state ?= { ${levelsAtLeast(p, p.stages)} } }\n${T}${T}${rightsOf(p, 'ROOT')}`
    : `has_technology_researched = ${p.stage_techs[0]}\n${T}${T}NOT = { has_variable = ${v}_surveyed }\n${T}${T}NOT = { has_global_variable = ${v}_surveying }\n` +
    `${T}${T}NOT = { has_global_variable = ${v}_claim }\n${T}${T}NOT = { p:${p.anchor_province}.state ?= { ${levelsAtLeast(p, p.stages)} } }\n${T}${T}${chainOf(p)}`);
  // ⚠ the AI does NOT take this decision (ai_chance 0): it scores every visible decision in one pass (F168); it surveys through the driver
  decs.push(`${v}_survey_decision = {\n` +
    `${T}is_shown = {\n${T}${T}${surveyOpen.get(p.id)}\n${T}}\n\n` +
    `${T}possible = {\n${T}${T}produced_bureaucracy > ${p.survey_bureaucracy}\n` +
      (DAI && DAI.gate === 'possible' ? `${T}${T}pmr_dam_active < 1\n` : '') +
      // gate 'headroom' (user, 2026-09-28: "the bureaucracy cost is a sufficient gate by itself"): no survey count at all - the country
      // may start a survey only while its spare bureaucracy (produced - used) exceeds this survey's cost
      (DAI && DAI.gate === 'headroom' ? `${T}${T}pmr_dam_bur_headroom > ${p.survey_bureaucracy}\n` : '') +
      // PROBE take_cooldown_days (F176): a survey's bureaucracy cost reaches bureaucracy_usage only at the next recalculation, so one AI
      // pass sees the old spare for every survey; a short-lived "just took a survey" variable, set on the spot, allows one take per pass
      (TCD ? (TCD_AI_ONLY ? `${T}${T}OR = { is_player = yes  NOT = { has_variable = pmr_dam_took_survey } }\n` : `${T}${T}NOT = { has_variable = pmr_dam_took_survey }\n`) : '') +
      // rules 'family': the 12-month block from the START of anyone's survey (removed at once if that survey is abandoned), and no
      // survey while a level is queued but not built (user, 2026-09-28: a dam in the construction queue blocks surveys for everyone)
      (R2 ? `${T}${T}custom_tooltip = {\n${T}${T}${T}text = ${v}_block_tt\n${T}${T}${T}NOT = { has_global_variable = ${v}_block }\n${T}${T}}\n` +
        `${T}${T}custom_tooltip = {\n${T}${T}${T}text = ${v}_queued_tt\n${T}${T}${T}NOT = { p:${p.anchor_province}.state ?= { any_scope_building = { is_building_type = ${key}\n` +
        Array.from({ length: p.stages }, (_, i) => `${T}${T}${T}${T}${i ? '' : 'OR = { '}AND = { level < ${i + 1}  level_after_queued_constructions >= ${i + 1} }\n`).join('') +
        `${T}${T}${T}} } } }\n${T}${T}}\n` : '') + `${T}}\n\n` +
    `${T}when_taken = {\n${T}${T}${v}_begin_survey = yes\n` +
      (TCD ? `${T}${T}set_variable = { name = pmr_dam_took_survey  days = ${TCD} }\n` : '') + `${T}}\n\n` +
    (DAI ? `${T}ai_chance = {\n${T}${T}value = 0\n${T}${T}if = {\n${T}${T}${T}limit = { pmr_dam_bur_headroom > ${Math.round(p.survey_bureaucracy * (DAI.headroom_mult ?? 1))} }\n${T}${T}${T}add = ${DAI.weight ?? 10}\n${T}${T}}\n` +
      (DAI.gate === 'weight' ? `${T}${T}if = {\n${T}${T}${T}limit = { pmr_dam_active > 0 }\n${T}${T}${T}multiply = 0\n${T}${T}}\n` : '') +
      `${T}${T}if = {\n${T}${T}${T}limit = { OR = { is_at_war = yes  is_diplomatic_play_committed_participant = yes  in_default = yes } }\n${T}${T}${T}multiply = 0\n${T}${T}}\n${T}}\n}`
      : `${T}ai_chance = {\n${T}${T}value = 0\n${T}}\n}`));
  decs.push(`${v}_stop_survey_decision = {\n${T}is_shown = { has_variable = ${v}_months }\n${T}possible = { has_variable = ${v}_months }\n` +
    `${T}when_taken = {\n${T}${T}remove_variable = ${v}_months\n` +
    `${T}${T}debug_log = "PMR_DAM|survey_stop|${p.id}|${TAG}|${DATE}|${BUR}"\n${T}}\n` +
    `${T}ai_chance = {\n${T}${T}value = 0\n${T}${T}if = {\n${T}${T}${T}limit = { in_default = yes }\n${T}${T}${T}add = 50\n${T}${T}}\n${T}}\n}`);
  loc.push([`${v}_survey_decision`, `Survey the ${p.name}`],
    [`${v}_survey_decision_desc`, `Commission a ${p.survey_months}-month hydrographic and geological survey of the ${p.name} (up to ${p.stages} level${p.stages > 1 ? 's' : ''}, each about ${p.stage_points} construction points and ${p.stage_units} electricity a week). ` + (R2
      ? `Once it is complete we may build the dams, and so may every country of our overlord family with construction rights there. For twelve months after we start, no other country may begin a survey of the site. Builders share its levels, each owning what it builds.`
      : `Once it is complete we may build the dams ourselves, in our own state or in a subject's; for two years no other country may survey the site. Countries that have surveyed it share its levels, each owning what it builds.`)],
    [`${v}_stop_survey_decision`, `Cancel the ${p.name} survey`],
    [`${v}_stop_survey_decision_desc`, `Abandon the survey of the ${p.name}. Its cost stops; a later attempt starts from scratch.`]);
  jes.push(`je_${v}_survey = {\n${T}icon = "gfx/interface/icons/event_icons/event_map.dds"\n${T}group = je_group_technology\n\n` +
    `${T}on_monthly_pulse = {\n${T}${T}effect = {\n${T}${T}${T}if = {\n${T}${T}${T}${T}limit = { has_variable = ${v}_months }\n${T}${T}${T}${T}change_variable = { name = ${v}_months add = 1 }\n${T}${T}${T}${T}debug_log = "PMR_DAM|survey_month|${p.id}|${TAG}|${DATE}|${BUR}"\n${T}${T}${T}}\n${T}${T}}\n${T}}\n\n` +
    `${T}complete = {\n${T}${T}scope:journal_entry = { is_goal_complete = yes }\n${T}}\n\n` +
    `${T}on_complete = {\n${T}${T}remove_modifier = ${v}_surveying\n${T}${T}remove_variable = ${v}_months\n${T}${T}remove_global_variable = ${v}_surveying\n` +
    `${T}${T}set_variable = ${v}_surveyed\n${T}${T}set_global_variable = ${v}_surveyed_any\n` +
    (R2
      // rules 'family': no claim (user: the 12-month head start does its job); a surveyor inside the owner's top-overlord family opens
      // the dam to the whole family - the family's top is stored, and members with construction rights build without their own survey
      ? `${T}${T}p:${p.anchor_province}.state.owner ?= {\n${T}${T}${T}if = {\n${T}${T}${T}${T}limit = { is_subject = yes }\n${T}${T}${T}${T}top_overlord = { save_scope_as = pmr_dam_famtop }\n${T}${T}${T}}\n` +
        `${T}${T}${T}else = { save_scope_as = pmr_dam_famtop }\n${T}${T}}\n` +
        `${T}${T}if = {\n${T}${T}${T}limit = { OR = { this = scope:pmr_dam_famtop  top_overlord ?= { this = scope:pmr_dam_famtop } } }\n` +
        `${T}${T}${T}set_global_variable = { name = ${v}_family  value = scope:pmr_dam_famtop }\n` +
        `${T}${T}${T}debug_log = "PMR_DAM|family_survey|${p.id}|${TAG}|${DATE}"\n${T}${T}}\n`
      : `${T}${T}set_global_variable = { name = ${v}_claim days = 730 }\n`) +
    `${T}${T}change_variable = { name = ${ACTIVE} add = -1 }\n` +
    (P.probe ? `${T}${T}p:${p.anchor_province} = {\n${T}${T}${T}state = {\n` +
      `${T}${T}${T}${T}if = {\n${T}${T}${T}${T}${T}limit = { can_construct_building = ${key} }\n${T}${T}${T}${T}${T}debug_log = "PMR_DAM|probe_can_build|${p.id}|yes|${DATE}"\n${T}${T}${T}${T}}\n` +
      `${T}${T}${T}${T}else = {\n${T}${T}${T}${T}${T}debug_log = "PMR_DAM|probe_can_build|${p.id}|no|${DATE}"\n${T}${T}${T}${T}}\n${T}${T}${T}}\n${T}${T}}\n` +
      '' : '') +
    `${T}${T}debug_log = "PMR_DAM|survey_complete|${p.id}|${TAG}|${DATE}|${BUR}"\n${T}}\n\n` +
    `${T}current_value = {\n${T}${T}value = 0\n${T}${T}if = {\n${T}${T}${T}limit = { has_variable = ${v}_months }\n${T}${T}${T}value = root.var:${v}_months\n${T}${T}}\n${T}}\n\n${T}goal_add_value = {\n${T}${T}value = ${p.survey_months}\n${T}}\n\n` +
    `${T}invalid = {\n${T}${T}OR = {\n${T}${T}${T}NOT = { has_variable = ${v}_months }\n${T}${T}${T}NOT = {\n${T}${T}${T}${T}${(R2 ? rightsOf(p, 'ROOT') : chainOf(p)).replace(/\n/g, `\n${T}${T}`)}\n${T}${T}${T}}\n${T}${T}}\n${T}}\n\n` +
    `${T}on_invalid = {\n${T}${T}if = {\n${T}${T}${T}limit = { has_variable = ${v}_months }\n${T}${T}${T}remove_variable = ${v}_months\n${T}${T}}\n` +
    // rules 'family': an abandoned survey (cancelled, or the surveyor lost its construction rights) lifts the 12-month block at once
    (R2 ? `${T}${T}remove_global_variable = ${v}_block\n` : '') +
    `${T}${T}remove_global_variable = ${v}_surveying\n${T}${T}remove_modifier = ${v}_surveying\n${T}${T}change_variable = { name = ${ACTIVE} add = -1 }\n` +
    `${T}${T}debug_log = "PMR_DAM|survey_ended|${p.id}|${TAG}|${DATE}|${BUR}"\n${T}}\n\n` +
    `${T}progressbar = yes\n${T}weight = 10\n${T}transferable = no\n${T}should_be_pinned_by_default_uninvolved_or_context = no\n}`);
  loc.push([`je_${v}_survey`, `Surveying the ${p.name}`],
    [`je_${v}_survey_reason`, `Our engineers are surveying the ${p.name} in ${p.state_name}: river gauging, foundation borings and the reservoir line. When they finish we may build the dams, in our own state or in a subject's.`],
    [`je_${v}_survey_goal`, `Await the completion of the #bold ${p.survey_months} month#! survey`]);
}
W('common/buildings/zzz_pm_rehaul_dams.txt', HDR + bld.join('\n\n') + '\n');
W('common/production_methods/zzz_pm_rehaul_dams.txt', HDR + pms.join('\n\n') + '\n');
W('common/production_method_groups/zzz_pm_rehaul_dams.txt', HDR + pmgs.join('\n\n') + '\n');
// PROBE bureaucracy_bonus (granted with the probe technologies, below)
if (P.probe?.bureaucracy_bonus) {
  mods.push(`pmr_dam_probe_bureaucracy = {\n${T}icon = gfx/interface/icons/timed_modifier_icons/modifier_documents_positive.dds\n${T}country_bureaucracy_add = ${P.probe.bureaucracy_bonus}\n}`);
  loc.push(['pmr_dam_probe_bureaucracy', 'Probe: dam survey bureaucracy']);
}
W('common/static_modifiers/zzz_pm_rehaul_dams.txt', HDR + mods.join('\n\n') + '\n');

// ---------------------------------------------------------------- traits and effects
const E = CFG.dams.effects || {};
const newTraits = E.traits || {};
const traitTxt = Object.entries(newTraits).map(([k, t]) =>
  `${k} = {\n${T}icon = "${t.icon || 'gfx/interface/icons/state_trait_icons/river.dds'}"\n\n${T}modifier = {\n` +
  Object.entries(t.modifier).map(([m, q]) => `${T}${T}${m} = ${q}\n`).join('') + `${T}}\n}`);
for (const [k, t] of Object.entries(newTraits)) loc.push([k, t.name], [`${k}_desc`, t.desc || '']);
// THE ENGINE LEVEL CAP (see the building group above): one site trait per project, carrying the dam's max level. The modifier
// type is declared explicitly, as vanilla declares its four has_max_level buildings' (barrack, conscription centre, naval
// fortification, construction sector) — the name is state_ + the building key + _max_level_add
const capMod = p => `state_${BKEY(p)}_max_level_add`;
const siteTrait = p => `${V(p)}_site`;
// ⚠⚠ THE CAP SITS IN `base_values`, NOT IN THE TRAIT (the user's hand tests, 2026-10-05): carried by the site trait, i.e. a
// STATE modifier, it held for the state's OWNER (France built 4 of 4 in Provence, Serbia 1 of 1 in Western Serbia) and was 0 for
// every FOREIGN builder (the Ottomans in Western Serbia, Britain in its colony Oregon) — the engine evidently reads a foreign
// builder's own COUNTRY modifiers for the max level (buildings.md: "a dynamic country modifier"). `base_values` is the static
// modifier every country carries (vanilla's own `state_building_naval_fortification_max_level_add = 5` sits there), so every
// country holds the cap and every state inherits it. The trait stays as the visible site label, with no modifier.
for (const p of projects) {
  if (newTraits[siteTrait(p)]) die(`trait ${siteTrait(p)} is both a site trait and a configured trait`);
  traitTxt.push(`${siteTrait(p)} = {\n${T}icon = "gfx/interface/icons/state_trait_icons/river.dds"\n\n${T}modifier = {\n${T}}\n}`);
  loc.push([siteTrait(p), `Dam Site: ${p.name}`],
    [`${siteTrait(p)}_desc`, `The ${p.name} can hold up to ${p.stages} level${p.stages > 1 ? 's' : ''} of hydroelectric dams.`],
    [capMod(p), `$${BKEY(p)}$ Max Level`],
    [`${capMod(p)}_desc`, `A bonus or penalty to the maximum level of $${BKEY(p)}$ buildings.`]);
}
W('common/modifier_type_definitions/zzz_pm_rehaul_dam_modifiers.txt', HDR +
  projects.map(p => `${capMod(p)}={\n${T}decimals=0\n${T}color=good\n${T}game_data={\n${T}${T}ai_value=0\n${T}}\n}`).join('\n\n') + '\n');
// a WHOLE-FILE copy of vanilla's code static modifiers, the cap lines appended inside `base_values` (exactly one block, asserted;
// every other line vanilla's) — static modifiers cannot be patched partially
{
  const rel = 'common/static_modifiers/00_code_static_modifiers.txt';
  const lines = stripBom(readFileSync(join(GAME, rel), 'utf8')).split(/\r?\n/);
  const starts = lines.map((l, i) => /^base_values\s*=\s*\{/.test(l) ? i : -1).filter(i => i >= 0);
  if (starts.length !== 1) die(`${rel}: expected exactly one base_values block, found ${starts.length}`);
  let depth = 0, end = -1;
  for (let i = starts[0]; i < lines.length; i++) {
    for (const ch of lines[i].replace(/#.*$/, '')) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0) { end = i; break; }
  }
  if (end < 0 || !/^\}\s*$/.test(lines[end])) die(`${rel}: base_values does not close on a line of its own`);
  for (const p of projects) if (lines.some(l => new RegExp(`^\\s*${capMod(p)}\\s*=`).test(l))) die(`${rel}: vanilla already sets ${capMod(p)}`);
  lines.splice(end, 0, '', `${T}# pm_tech_rehaul: the hydro-dam level caps (tools/emit_dams.mjs) - every country carries them, see the comment there`,
    ...projects.map(p => `${T}${capMod(p)} = ${p.stages}`));
  if (STATIC_MODE === 'base_values') W(rel, lines.join('\n'));
}
// ⚗ PERF PROBE / CANDIDATE FIX (2026-10-08, the tick-cost batches: 144 base_values cap lines cost ~2 s per in-game year, because
// base_values sits on every country and flows into every state): `dams.static_mode` = 'country_modifier' carries the caps as ONE
// static modifier `pmr_dam_caps`, added to every country at the campaign start (is the route cheaper?); 'country_modifier_tech' adds
// it only to a country holding the first dam technology, on its yearly pulse (no cost before then). Default 'base_values' = the book.
if (STATIC_MODE !== 'base_values') W('common/static_modifiers/zzz_pm_rehaul_dam_caps.txt', HDR +
  `pmr_dam_caps = {\n${T}icon = "gfx/interface/icons/timed_modifier_icons/modifier_documents_positive.dds"\n` +
  projects.map(p => `${T}${capMod(p)} = ${p.stages}\n`).join('') + `}\n`);
const capAddStart = STATIC_MODE === 'country_modifier' ? `${T}${T}every_country = { add_modifier = { name = pmr_dam_caps } }\n` : '';
const capAddYearly = STATIC_MODE === 'country_modifier_tech' ?
  `${T}${T}if = {\n${T}${T}${T}limit = { has_technology_researched = ${P.tech_by_class.A}  NOT = { has_modifier = pmr_dam_caps } }\n${T}${T}${T}add_modifier = { name = pmr_dam_caps }\n${T}${T}}\n` : '';
if (traitTxt.length) W('common/state_traits/zzz_pm_rehaul_dam_traits.txt', HDR + traitTxt.join('\n\n') + '\n');
// added at the campaign start only. ⚠ NO catch-up for saves begun on an earlier build (user-ruled 2026-10-05: no legacy-save
// contingency unless asked — it would run forever for a case that never occurs)
seff.push(`pmr_dam_add_caps = {\n` +
  (PERF_OFF.has('traits') ? '' : projects.map(p => `${T}s:${p.state} = { add_state_trait = ${siteTrait(p)} }\n`).join('')) + `}`);

const regionEffect = (e) => {
  const lines = [];
  if (e.remove_trait) lines.push(`remove_state_trait = ${e.remove_trait}`);
  if (e.add_trait) lines.push(`add_state_trait = ${e.add_trait}`);
  if (e.arable) lines.push(`add_arable_land = ${e.arable}`);
  if (!stateProv[e.state]) die(`effect on unknown state ${e.state}`);
  return `s:${e.state} = {\n${T}${T}${T}${T}${lines.join(`\n${T}${T}${T}${T}`)}\n${T}${T}${T}}`;
};
const start = (E.start || []).map(e => `${T}${T}${regionEffect(e).replace(/\n\t/g, '\n')}`);
// PROBE BUILDS ONLY: grant the class technologies to named countries at the start, so an 1836 probe exercises
// the whole chain (config `dams.probe` = { grant_tags: [..], survey_months, cost_mult }).
// PROBE BUILDS ONLY: switch named countries to Laissez-faire, to see who owns a dam where privatisation is forced
if (P.probe?.laissez_faire_tags?.length) for (const tag of P.probe.laissez_faire_tags) {
  if (!/^[A-Z]{3}$/.test(tag)) die(`probe tag ${tag}`);
  start.push(`${T}${T}if = {\n${T}${T}${T}limit = { exists = c:${tag} }\n${T}${T}${T}c:${tag} = {\n${T}${T}${T}${T}activate_law = law_type:law_laissez_faire\n` +
    `${T}${T}${T}${T}debug_log = "PMR_DAM|probe_laissez_faire|-|${TAG}|${DATE}"\n${T}${T}${T}}\n${T}${T}}`);
}
if (P.probe?.grant_tags?.length) for (const tag of P.probe.grant_tags) {
  if (!/^[A-Z]{3}$/.test(tag)) die(`probe tag ${tag}`);
  start.push(`${T}${T}if = {\n${T}${T}${T}limit = { exists = c:${tag} }\n${T}${T}${T}c:${tag} = {\n` + [...new Set(Object.values(P.tech_by_class))].map(t => `${T}${T}${T}${T}add_technology_researched = ${t}\n`).join('') +
    // PROBE bureaucracy_bonus: a permanent flat bureaucracy grant, so the majors hold room for several surveys from the start
    (P.probe.bureaucracy_bonus ? `${T}${T}${T}${T}add_modifier = { name = pmr_dam_probe_bureaucracy }\n` : '') +
    `${T}${T}${T}${T}debug_log = "PMR_DAM|probe_grant|-|${TAG}|${DATE}"\n${T}${T}${T}}\n${T}${T}}`);
}
// PROBE BUILDS ONLY — THE CONTEST (user, 2026-09-27: "the probes need to have multiple possible investors to check that once one
// starts building, others got locked out and don't waste a lot of money there"). At the start every dam site whose owner is a
// SUBJECT gets several eligible builders at once: the owner and every country above it receive the class technologies and a
// completed survey. Monthly, every standing dam logs its built level and its level counting every queued construction
// (probe_lvl / probe_q): queued above the cap = the lock-out failed; queued falling while built stays = a cancelled construction.
// `contest_grant` says who the seeding gives the TECHNOLOGIES to (the surveys go to the whole chain either way): 'chain' (default, p13)
// the owner and every overlord; 'overlords' only the countries above the owner; 'top' only the TOP overlord - no subject at all, since a
// mid-chain overlord (the East India Company over Travancore) is itself a subject (user, 2026-09-27: "to ensure that the subjects don't
// start, let's leave the techs only at the overlord"); 'none' nobody (the grant_tags list alone decides)
if (P.probe?.contest) {
  const mode = P.probe.contest_grant || 'chain';
  if (!['chain', 'overlords', 'top', 'none'].includes(mode)) die(`probe.contest_grant '${mode}'`);
  const grant = [...new Set(Object.values(P.tech_by_class))].map(t => `add_technology_researched = ${t}`).join(' ');
  const gOwner = mode === 'chain' ? `${grant}\n${T}${T}${T}${T}` : '';
  const gOver = ['chain', 'overlords'].includes(mode) ? `${grant}\n${T}${T}${T}${T}${T}` : '';
  const gTop = mode === 'top' ? `top_overlord ?= { ${grant} }\n${T}${T}${T}${T}` : '';
  for (const p of projects) start.push(
    `${T}${T}p:${p.anchor_province}.state.owner ?= {\n${T}${T}${T}if = {\n${T}${T}${T}${T}limit = { is_subject = yes }\n` +
    `${T}${T}${T}${T}${gOwner}set_variable = ${V(p)}_surveyed\n` +
    `${T}${T}${T}${T}every_overlord_or_above = {\n${T}${T}${T}${T}${T}${gOver}set_variable = ${V(p)}_surveyed\n${T}${T}${T}${T}}\n` +
    `${T}${T}${T}${T}${gTop}set_global_variable = ${V(p)}_surveyed_any\n` +
    `${T}${T}${T}${T}debug_log = "PMR_DAM|probe_contest_seed|${p.id}|${TAG}|${DATE}"\n${T}${T}${T}}\n${T}${T}}`);
}
// PROBE BUILDS ONLY — TARGETED ELECTRICITY DEMAND, with a CONTROL (user, 2026-09-27: "adding explicit electricity consumers in potential
// dam states. Leave some for control"). Electricity is a LOCAL good, so demand has to sit in the dam's own state. `probe.elec_sink` =
// { per_level } places a government-funded consumer (clerks, electricity in) in the anchor state of every other project (sorted by id:
// even index = TREATED, odd = CONTROL), sized to take about one dam level's output (levels = stage_units / per_level).
const sinkPlan = [];
if (P.probe?.elec_sink) {
  const per = P.probe.elec_sink.per_level || 10;
  [...projects].sort((a, b) => a.id.localeCompare(b.id)).forEach((p, i) =>
    sinkPlan.push({ p, treated: i % 2 === 0, levels: Math.max(1, Math.min(60, Math.round(p.stage_units / per))) }));
  W('common/building_groups/zzz_pm_rehaul_dam_probe.txt', HDR + `bg_pmr_probe_sink = {\n${T}parent_group = bg_government\n${T}lens = special\n${T}is_government_funded = yes\n${T}economy_of_scale = no\n}\n`);
  W('common/buildings/zzz_pm_rehaul_dam_probe.txt', HDR + `building_pmr_probe_sink = {\n${T}building_group = bg_pmr_probe_sink\n${T}city_type = city\n${T}levels_per_mesh = 50\n` +
    `${T}buildable = no\n${T}expandable = no\n${T}downsizeable = no\n${T}required_construction = construction_cost_very_low\n` +
    `${T}production_method_groups = {\n${T}${T}pmg_pmr_probe_sink\n${T}}\n` +
    `${T}icon = "gfx/interface/icons/building_icons/power_plant.dds"\n${T}background = "gfx/interface/icons/building_icons/backgrounds/building_panel_bg_monuments.dds"\n}\n`);
  W('common/production_method_groups/zzz_pm_rehaul_dam_probe.txt', HDR + `pmg_pmr_probe_sink = {\n${T}texture = "gfx/interface/icons/generic_icons/mixed_icon_base.dds"\n${T}production_methods = {\n${T}${T}pm_pmr_probe_sink\n${T}}\n}\n`);
  W('common/production_methods/zzz_pm_rehaul_dam_probe.txt', HDR + `pm_pmr_probe_sink = {\n${T}texture = "gfx/interface/icons/production_method_icons/hydroelectric_plant.dds"\n` +
    `${T}building_modifiers = {\n${T}${T}workforce_scaled = {\n${T}${T}${T}goods_input_electricity_add = ${per}\n${T}${T}}\n${T}${T}level_scaled = {\n${T}${T}${T}building_employment_clerks_add = 500\n${T}${T}}\n${T}}\n}\n`);
  loc.push(['building_pmr_probe_sink', 'Probe Electricity Consumer'], ['pmg_pmr_probe_sink', 'Probe Consumer'], ['pm_pmr_probe_sink', 'Probe Consumer']);
  for (const { p, treated, levels } of sinkPlan) start.push(treated
    ? `${T}${T}p:${p.anchor_province}.state ?= {\n${T}${T}${T}create_building = { building = building_pmr_probe_sink level = ${levels} }\n` +
      `${T}${T}${T}debug_log = "PMR_DAM|probe_sink|${p.id}|treated|${levels} levels x ${per}|${DATE}"\n${T}${T}}`
    : `${T}${T}debug_log = "PMR_DAM|probe_sink|${p.id}|control|-|${DATE}"`);
}
// PROBE: dams.probe.release_after = 'Y.M.D' - from that date, every month: a SUBJECT whose state holds a dam under construction is
// released (make_independent), once per project. Asks what happens to a construction when the builder loses its standing mid-build.
const releaseLines = [];
if (P.probe?.release_after) for (const p of projects) {
  // "under construction" = a level queued above the built one (is_under_construction stays false on a queued level: p17 of
  // session 20260928_134653 never fired while the Qing built in Korea for five years)
  // dams.probe.withdraw_rights (with open_builders + open_survey_tags): the host is an INDEPENDENT country outside the surveyed
  // majors (so the builder is a foreign major holding investment rights, p18), and in place of a release the host withdraws from
  // every treaty carrying foreign investment rights - the direct form of "the builder loses its standing mid-build"
  const WR = !!P.probe.withdraw_rights;
  const who = WR ? `owner ?= { is_subject = no  NOT = { has_variable = pmr_probe_major } }` : `owner ?= { is_subject = yes }`;
  const act = WR
    ? `owner = {\n${T}${T}${T}${T}${T}debug_log = "PMR_DAM|probe_withdraw|${p.id}|${TAG}|${DATE}"\n${T}${T}${T}${T}${T}save_scope_as = pmr_host\n` +
      `${T}${T}${T}${T}${T}every_scope_treaty = {\n${T}${T}${T}${T}${T}${T}limit = { any_scope_article = { has_type = foreign_investment_rights } }\n` +
      `${T}${T}${T}${T}${T}${T}withdraw = { country = scope:pmr_host }\n${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}}`
    : `owner = { debug_log = "PMR_DAM|probe_release|${p.id}|${TAG}|${DATE}"  make_independent = yes }`;
  const building = `${T}${T}${T}${T}${T}${who}\n${T}${T}${T}${T}${T}any_scope_building = {\n${T}${T}${T}${T}${T}${T}is_building_type = ${BKEY(p)}\n` +
    `${T}${T}${T}${T}${T}${T}OR = {\n` + Array.from({ length: p.stages }, (_, i) => `${T}${T}${T}${T}${T}${T}${T}AND = { level < ${i + 1}  level_after_queued_constructions >= ${i + 1} }\n`).join('') +
    `${T}${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}${T}}\n`;
  // dams.probe.release_delay_days: the first month a construction is seen ARMS the dam and starts a timer; the release waits until
  // the timer has expired with the construction still standing (p17b released within a month of queuing, so no progress was at stake)
  const D = P.probe.release_delay_days;
  const arm = D ? `${T}${T}${T}if = {\n${T}${T}${T}${T}limit = {\n${T}${T}${T}${T}${T}NOT = { has_global_variable = pmr_dam_${p.id}_armed }\n` + building + `${T}${T}${T}${T}}\n` +
    `${T}${T}${T}${T}set_global_variable = pmr_dam_${p.id}_armed\n${T}${T}${T}${T}set_global_variable = { name = pmr_dam_${p.id}_timer  days = ${D} }\n` +
    `${T}${T}${T}${T}owner = { debug_log = "PMR_DAM|probe_armed|${p.id}|${TAG}|${DATE}" }\n${T}${T}${T}}\n` : '';
  releaseLines.push(`${T}${T}p:${p.anchor_province}.state ?= {\n` + arm +
    `${T}${T}${T}if = {\n${T}${T}${T}${T}limit = {\n${T}${T}${T}${T}${T}NOT = { has_global_variable = pmr_dam_${p.id}_released }\n` + building +
    (D ? `${T}${T}${T}${T}${T}has_global_variable = pmr_dam_${p.id}_armed\n${T}${T}${T}${T}${T}NOT = { has_global_variable = pmr_dam_${p.id}_timer }\n` : '') +
    `${T}${T}${T}${T}}\n${T}${T}${T}${T}set_global_variable = pmr_dam_${p.id}_released\n` +
    `${T}${T}${T}${T}${act}\n${T}${T}${T}}\n${T}${T}}`);
}
// PROBE: dams.probe.open_survey_tags = [TAGS] - those countries hold a completed survey of EVERY project from the start
// (the exists guard, not `?=`: landmine L1's detector accepts only the explicit form)
if (P.probe?.open_survey_tags?.length) for (const tag of P.probe.open_survey_tags) start.push(
  `${T}${T}if = {\n${T}${T}${T}limit = { exists = c:${tag} }\n${T}${T}${T}c:${tag} = {\n${T}${T}${T}${T}set_variable = pmr_probe_major\n` + projects.map(p => `${T}${T}${T}${T}set_variable = ${V(p)}_surveyed\n`).join('') + `${T}${T}${T}}\n${T}${T}}\n` +
  projects.map(p => `${T}${T}set_global_variable = ${V(p)}_surveyed_any`).join('\n'));
// PLAYTEST BUILDS ONLY: dams.probe.player_open = true - at the start (after the lobby, when players are assigned) every PLAYER country
// holds the three class technologies and a completed survey of every project, so a human can queue dams in 1836 (user, 2026-10-05:
// testing the engine level cap by hand). AI countries are untouched
if (P.probe?.player_open) start.push(
  `${T}${T}every_country = {\n${T}${T}${T}limit = { is_player = yes }\n` +
  [...new Set(Object.values(P.tech_by_class))].map(t => `${T}${T}${T}add_technology_researched = ${t}\n`).join('') +
  projects.map(p => `${T}${T}${T}set_variable = ${V(p)}_surveyed\n`).join('') +
  `${T}${T}${T}debug_log = "PMR_DAM|playtest_open|-|${TAG}|${DATE}"\n${T}${T}}\n` +
  projects.map(p => `${T}${T}set_global_variable = ${V(p)}_surveyed_any`).join('\n'));
// on_building_built (a dam's first level) and on_building_expanded (every later level) both land here, root = the building.
// An effect named for level k fires once, the first time the dam stands at k levels or more; 'last' = at its final level.
const onBuilt = [];
for (const p of projects) {
  const lvls = Array.from({ length: p.stages }, (_, i) => p.stages - i);   // n .. 1, so the first true branch names the level
  const fxAt = k => (p.effects || []).filter(e => (e.stage === 'last' ? p.stages : (e.stage || 1)) === k);
  // building scope: log the level, mark completion, fire each level's effects once. Shared by on_building_built /
  // on_building_expanded.
  seff.push(`${V(p)}_on_level = {\n` +
    lvls.map((k, j) => `${T}${j ? 'else_if' : 'if'} = {\n${T}${T}limit = { level >= ${k} }\n` +
      `${T}${T}owner ?= { debug_log = "PMR_DAM|built|${p.id}|${TAG}|${DATE}|level ${k}/${p.stages}" }\n${T}}\n`).join('') +
    `${T}if = {\n${T}${T}limit = { level >= ${p.stages}  NOT = { has_global_variable = ${V(p)}_complete } }\n` +
    `${T}${T}set_global_variable = ${V(p)}_complete\n${T}${T}owner ?= { debug_log = "PMR_DAM|complete|${p.id}|${TAG}|${DATE}" }\n${T}}\n` +
    Array.from({ length: p.stages }, (_, i) => i + 1).filter(k => fxAt(k).length).map(k =>
      `${T}if = {\n${T}${T}limit = { level >= ${k}  NOT = { has_global_variable = ${V(p)}_fx_${k} } }\n` +
      `${T}${T}set_global_variable = ${V(p)}_fx_${k}\n` + fxAt(k).map(e => `${T}${T}${regionEffect(e)}\n`).join('') + `${T}}\n`).join('') + `}`);
  onBuilt.push(`${T}${T}${T}if = {\n${T}${T}${T}${T}limit = { is_building_type = ${BKEY(p)} }\n${T}${T}${T}${T}${V(p)}_on_level = yes\n${T}${T}${T}}`);
}

W('common/decisions/zzz_pm_rehaul_dams.txt', HDR + decs.join('\n\n') + '\n');
W('common/journal_entries/zzz_pm_rehaul_dams.txt', HDR + jes.join('\n\n') + '\n');
W('common/scripted_effects/zzz_pm_rehaul_dams.txt', HDR + seff.join('\n\n') + '\n');
W('common/on_actions/zzz_pm_rehaul_dams.txt', HDR +
  `on_game_started_after_lobby = {\n${T}on_actions = { pmr_dam_campaign_start }\n}\n\n` +
  `on_building_built = {\n${T}on_actions = { pmr_dam_built }\n}\n\n` +
  `on_building_expanded = {\n${T}on_actions = { pmr_dam_built }\n}\n\n` +
  `pmr_dam_campaign_start = {\n${T}effect = {\n${T}${T}debug_log = "PMR_DAM|start|${projects.length} projects|-|${DATE}"\n${T}${T}pmr_dam_add_caps = yes\n${capAddStart}${start.join('\n')}\n${T}}\n}\n\n` +
  `pmr_dam_built = {\n${T}effect = {\n${T}${T}if = {\n${T}${T}${T}limit = { is_building_group = bg_pmr_hydro_dams }\n${onBuilt.join('\n')}\n${T}${T}}\n${T}}\n}\n\n` +
  // PROBE (contest): every standing dam's built level and its level after every queued construction, monthly. Checked up to
  // two above the cap, so an over-queue shows. A dam whose first level is only queued already has a (level-0) building record.
  ((releaseLines.length || LOGLV) ? `on_monthly_pulse = {\n${T}on_actions = { ${[releaseLines.length ? 'pmr_dam_probe_release' : '', LOGLV ? 'pmr_dam_probe_levels' : ''].filter(Boolean).join(' ')} }\n}\n\n` : '') +
  (releaseLines.length ? `pmr_dam_probe_release = {\n${T}effect = {\n${T}${T}if = {\n${T}${T}${T}limit = { game_date >= ${P.probe.release_after} }\n` + releaseLines.join('\n') + `\n${T}${T}}\n${T}}\n}\n\n` : '') +
  (LOGLV ? `` +
    `pmr_dam_probe_levels = {\n${T}effect = {\n` + projects.map(p => {
      const chain = (trig, tag) => Array.from({ length: p.stages + 3 }, (_, i) => p.stages + 2 - i).map((k, j) =>
        `${T}${T}${T}${T}${j ? 'else_if' : 'if'} = {\n${T}${T}${T}${T}${T}limit = { ${k ? `${trig} >= ${k}` : 'always = yes'} }\n` +
        `${T}${T}${T}${T}${T}debug_log = "PMR_DAM|${tag}|${p.id}|${k}/${p.stages}|${DATE}"\n${T}${T}${T}${T}}\n`).join('');
      return `${T}${T}p:${p.anchor_province}.state ?= {\n${T}${T}${T}random_scope_building = {\n${T}${T}${T}${T}limit = { is_building_type = ${BKEY(p)} }\n` +
        chain('level', 'probe_lvl') + chain('level_after_queued_constructions', 'probe_q') + `${T}${T}${T}}\n${T}${T}}\n`;
    }).join('') + `${T}}\n}\n\n` : '') +
  // the bureaucracy baseline around the survey events (user, 2026-09-26)
  `on_yearly_pulse_country = {\n${T}on_actions = { pmr_dam_yearly }\n}\n\n` +
  `pmr_dam_yearly = {\n${T}effect = {\n${capAddYearly}${T}${T}if = {\n${T}${T}${T}limit = { has_technology_researched = ${P.tech_by_class.A} }\n` +
  `${T}${T}${T}debug_log = "PMR_DAM|bur_year|-|${TAG}|${DATE}|${BUR}|surveys [THIS.GetCountry.MakeScope.ScriptValue('pmr_dam_active')|0] building [THIS.GetCountry.MakeScope.ScriptValue('pmr_dam_building_now')|0]"\n` +
  `${T}${T}}\n${T}}\n}\n\n` +
  // THE AI DRIVER (F168) — SURVEYS ONLY since 2026-09-27 (user-ruled: the engine builds every level itself, F173/F174). Every
  // three months an unburdened AI country starts at most ONE survey: the first open project in its chain; a SUBJECT surveys a
  // site in its own state only when no overlord above it holds the technology unburdened (the rich overlord goes first).
  (DAI ? '' : `on_monthly_pulse_country = {\n${T}on_actions = { pmr_dam_driver }\n}\n\n`) +
  `pmr_dam_driver = {\n${T}effect = {\n${T}${T}if = {\n${T}${T}${T}limit = {\n` +
  `${T}${T}${T}${T}is_player = no\n${T}${T}${T}${T}has_technology_researched = ${P.tech_by_class.A}\n${T}${T}${T}${T}NOT = { has_variable = pmr_dam_driver_cd }\n` +
  `${T}${T}${T}${T}is_at_war = no\n${T}${T}${T}${T}in_default = no\n${T}${T}${T}${T}scaled_debt < 0.5\n` +
  `${T}${T}${T}${T}OR = {\n${T}${T}${T}${T}${T}is_subject = no\n${T}${T}${T}${T}${T}AND = { scaled_debt < 0.1  net_fixed_income > 0 }\n${T}${T}${T}${T}}\n${T}${T}${T}}\n` +
  `${T}${T}${T}set_variable = { name = pmr_dam_driver_cd days = 90 }\n` +
  `${T}${T}${T}if = {\n${T}${T}${T}${T}limit = { pmr_dam_survey_headroom > 0 }\n` +
  projects.map((p, i) => `${T}${T}${T}${T}${i ? 'else_if' : 'if'} = {\n${T}${T}${T}${T}${T}limit = {\n${T}${T}${T}${T}${T}${T}${surveyOpen.get(p.id).replace(/\n/g, `\n${T}${T}${T}${T}`)}\n` +
    `${T}${T}${T}${T}${T}${T}produced_bureaucracy > ${p.survey_bureaucracy}\n` +
    `${T}${T}${T}${T}${T}${T}OR = {\n${T}${T}${T}${T}${T}${T}${T}NOT = { ${isOwnerOf(p)} }\n${T}${T}${T}${T}${T}${T}${T}is_subject = no\n` +
    `${T}${T}${T}${T}${T}${T}${T}NOT = { any_overlord_or_above = { has_technology_researched = ${p.stage_techs[0]}  is_at_war = no  in_default = no  scaled_debt < 0.5 } }\n${T}${T}${T}${T}${T}${T}}\n` +
    `${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}${T}${V(p)}_begin_survey = yes\n${T}${T}${T}${T}}\n`).join('') +
  `${T}${T}${T}}\n` +
  `${T}${T}}\n${T}}\n}\n`);
const gdpSlots = (tiers) => tiers.map(g => `${T}if = {\n${T}${T}limit = { gdp >= ${g} }\n${T}${T}add = 1\n${T}}\n`).join('');
W('common/script_values/zzz_pm_rehaul_dams.txt', HDR +
  `pmr_dam_bur_produced = {\n${T}value = produced_bureaucracy\n}\n\npmr_dam_bur_used = {\n${T}value = bureaucracy_usage\n}\n\n` +
  (DAI ? `pmr_dam_bur_headroom = {\n${T}value = produced_bureaucracy\n${T}subtract = bureaucracy_usage\n}\n\n` : '') +
  `pmr_dam_active = {\n${T}value = 0\n${T}if = {\n${T}${T}limit = { has_variable = ${ACTIVE} }\n${T}${T}value = var:${ACTIVE}\n${T}}\n}\n\n` +
  `pmr_dam_building_now = {\n${T}value = 0\n${T}every_scope_state = {\n${T}${T}every_scope_building = {\n${T}${T}${T}limit = {\n${T}${T}${T}${T}is_building_group = bg_pmr_hydro_dams\n${T}${T}${T}${T}is_under_construction = yes\n${T}${T}${T}}\n${T}${T}${T}add = 1\n${T}${T}}\n${T}}\n}\n\n` +
  `pmr_dam_survey_slots = {\n${T}value = 1\n${gdpSlots(P.ai.survey_slot_gdp)}}\n\n` +
  `pmr_dam_survey_headroom = {\n${T}value = pmr_dam_survey_slots\n${T}subtract = pmr_dam_active\n}\n`);

// strip the vanilla hydro-narrative electricity lines (whole-file copies, every other line vanilla's)
const strip = CFG.dams.strip_trait_modifiers || {};
if (Object.keys(strip).length) {
  const dir = join(GAME, 'common/state_traits');
  const want = new Map(Object.entries(strip));
  const done = new Set();
  for (const f of readdirSync(dir)) {
    const raw = readFileSync(join(dir, f), 'utf8');
    const lines = stripBom(raw).split(/\r?\n/);
    let cur = null, depth = 0, changed = 0;
    const out = [];
    for (const l of lines) {
      const c = l.replace(/#.*$/, '');
      const m = depth === 0 && /^([a-z_0-9]+)\s*=\s*\{/.exec(c);
      if (m) cur = m[1];
      let drop = false;
      if (cur && want.has(cur) && depth >= 1) {
        for (const mod of want.get(cur)) if (new RegExp(`^\\s*${mod}\\s*=`).test(c)) { drop = true; done.add(cur + ':' + mod); }
      }
      if (drop) { out.push(l.replace(/^(\s*)/, '$1# pm_tech_rehaul (dams replace it): ')); changed++; }
      else out.push(l);
      for (const ch of c) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (depth === 0) cur = null;
    }
    if (changed) W(`common/state_traits/${f}`, out.join('\n'));
  }
  for (const [t, ms] of want) for (const m of ms) if (!done.has(t + ':' + m)) die(`strip: ${t} has no ${m} line in vanilla`);
}

// ---------------------------------------------------------------- localization (English text in every language)
loc.push(['bg_pmr_hydro_dams', 'Hydroelectric Dams']);
const LANGS = CFG.languages || ['english'];
const esc = s => String(s).replace(/"/g, '\\"');
for (const lang of LANGS)
  W(`localization/${lang}/replace/zzz_pm_rehaul_dams_l_${lang}.yml`, `l_${lang}:\n` + loc.map(([k, s]) => ` ${k}:0 "${esc(s)}"`).join('\n') + '\n');

// THE PERFORMANCE PROBE SWITCH, applied to the emitted files (see PERF_OFF at the top)
if (PERF_OFF.size) {
  const { rmSync } = await import('node:fs');
  const rm = rel => rmSync(join(MOD, rel), { force: true });
  if (PERF_OFF.has('static')) { rm('common/static_modifiers/00_code_static_modifiers.txt'); rm('common/modifier_type_definitions/zzz_pm_rehaul_dam_modifiers.txt'); }
  if (PERF_OFF.has('events')) {
    rm('common/decisions/zzz_pm_rehaul_dams.txt'); rm('common/journal_entries/zzz_pm_rehaul_dams.txt'); rm('common/script_values/zzz_pm_rehaul_dams.txt');
    W('common/scripted_effects/zzz_pm_rehaul_dams.txt', HDR + seff.filter(s => s.startsWith('pmr_dam_add_caps')).join('\n\n') + '\n');
    W('common/on_actions/zzz_pm_rehaul_dams.txt', HDR + `on_game_started_after_lobby = {\n${T}on_actions = { pmr_dam_campaign_start }\n}\n\n` +
      `pmr_dam_campaign_start = {\n${T}effect = {\n${T}${T}debug_log = "PMR_DAM|start|${projects.length} projects|-|${DATE}"\n${T}${T}pmr_dam_add_caps = yes\n${start.join('\n')}\n${T}}\n}\n`);
  }
  if (PERF_OFF.has('buildings')) for (const d of ['buildings', 'production_methods', 'production_method_groups', 'building_groups']) rm(`common/${d}/zzz_pm_rehaul_dams.txt`);
  console.log(`dams: ⚠ PERF PROBE - left out: ${[...PERF_OFF].join(', ')}`);
}
// ⚗ THE PERFORMANCE PROBE AMPLIFIER (2026-10-08, the user's "tests to worsen"): `dams.perf_amplify` = { buildings, static, traits,
// decisions: k } appends k − 1 renamed COPIES (`_a<i>`) of that part — dam building types (sharing the originals' methods, each with
// its own declared max-level modifier type), base_values cap lines (with declared types), site traits added at the start, survey
// decisions (thresholds + i × 0.001, so no two are identical). Copies are never buildable or takeable within a 1836–1856 probe
// (steam_turbine gates them all), so they cost evaluation only. No book ships with it.
const AMP = CFG.dams.perf_amplify || {};
for (const k of Object.keys(AMP)) if (!['buildings', 'static', 'traits', 'decisions', 'buildings_potential', 'static_types_only', 'jes'].includes(k)) die(`perf_amplify: unknown part '${k}'`);
if (Object.keys(AMP).length) {
  const K = part => Math.max(1, Math.round(AMP[part] || 1));
  const copies = (part, f) => Array.from({ length: K(part) - 1 }, (_, j) => f(`_a${j + 1}`, j + 1));
  const H = part => `\n\n# ⚗ PERF PROBE: ${K(part) - 1} amplified copies follow (dams.perf_amplify.${part} = ${K(part)})\n`;
  const newTypes = [];
  if (K('buildings') > 1) {
    // `buildings_potential: 'never'` gives the copies `potential = { always = no }` (does the cost come from evaluating the potential?)
    const never = AMP.buildings_potential === 'never';
    const add = copies('buildings', s => {
      let t = bld.join('\n\n').replace(/\bbuilding_dam_([a-z0-9_]+)\b/g, m => m + s);
      if (never) { const n0 = (t.match(/\n\tpotential = \{\n[\s\S]*?\n\t\}/g) || []).length; if (n0 !== projects.length) die(`buildings_potential: ${n0} potential blocks, expected ${projects.length}`); t = t.replace(/\n\tpotential = \{\n[\s\S]*?\n\t\}/g, '\n\tpotential = { always = no }'); }
      return t;
    });
    W('common/buildings/zzz_pm_rehaul_dams.txt', HDR + bld.join('\n\n') + H('buildings') + add.join('\n\n') + '\n');
    copies('buildings', s => projects.forEach(p => newTypes.push(`state_${BKEY(p)}${s}_max_level_add`)));
  }
  if (K('static') > 1) {
    const rel = 'common/static_modifiers/00_code_static_modifiers.txt';
    const txt = stripBom(readFileSync(join(MOD, rel), 'utf8'));
    const lines = copies('static', s => projects.map(p => `${T}state_${BKEY(p)}_st${s}_max_level_add = ${p.stages}`).join('\n'));
    copies('static', s => projects.forEach(p => newTypes.push(`state_${BKEY(p)}_st${s}_max_level_add`)));
    const at = txt.indexOf('# pm_tech_rehaul: the hydro-dam level caps'); if (at < 0) die('perf_amplify.static: the cap block is not in base_values');
    // `static_types_only: true` declares the copies' modifier TYPES but writes no base_values line (is it the types or the lines?)
    if (!AMP.static_types_only) W(rel, txt.slice(0, at) + `# ⚗ PERF PROBE: amplified cap lines\n${lines.join('\n')}\n${T}` + txt.slice(at));
  }
  if (newTypes.length) {
    const rel = 'common/modifier_type_definitions/zzz_pm_rehaul_dam_modifiers.txt';
    const txt = stripBom(readFileSync(join(MOD, rel), 'utf8'));
    W(rel, txt + '\n' + newTypes.map(t => `${t}={\n${T}decimals=0\n${T}color=good\n${T}game_data={\n${T}${T}ai_value=0\n${T}}\n}`).join('\n\n') + '\n');
  }
  if (K('traits') > 1) {
    const defs = copies('traits', s => projects.map(p => `${siteTrait(p)}${s} = {\n${T}icon = "gfx/interface/icons/state_trait_icons/river.dds"\n\n${T}modifier = {\n${T}}\n}`).join('\n\n'));
    W('common/state_traits/zzz_pm_rehaul_dam_traits.txt', HDR + traitTxt.join('\n\n') + H('traits') + defs.join('\n\n') + '\n');
    const adds = copies('traits', s => projects.map(p => `${T}s:${p.state} = { add_state_trait = ${siteTrait(p)}${s} }\n`).join('')).join('');
    const rel = 'common/scripted_effects/zzz_pm_rehaul_dams.txt';
    const txt = stripBom(readFileSync(join(MOD, rel), 'utf8'));
    if (!txt.includes('pmr_dam_add_caps = {\n')) die('perf_amplify.traits: pmr_dam_add_caps not found');
    W(rel, txt.replace('pmr_dam_add_caps = {\n', `pmr_dam_add_caps = {\n${adds}`));
  }
  if (K('jes') > 1) {
    // dam survey journal entries, renamed copies: never added by anything (no is_shown_when_inactive), so they cost existence only
    const add = copies('jes', s => jes.join('\n\n').replace(/^(je_pmr_dam_[a-z0-9_]+) = \{/gm, (m, k) => `${k}${s} = {`));
    W('common/journal_entries/zzz_pm_rehaul_dams.txt', HDR + jes.join('\n\n') + H('jes') + add.join('\n\n') + '\n');
  }
  if (K('decisions') > 1) {
    const add = copies('decisions', (s, i) => decs.join('\n\n')
      .replace(/^(pmr_dam_[a-z0-9_]+) = \{/gm, (m, k) => `${k}${s} = {`)
      .replace(/(> |>= )(\d+)(?![\d.])/g, (m, op, n) => `${op}${(+n + i * 0.001).toFixed(3)}`));
    W('common/decisions/zzz_pm_rehaul_dams.txt', HDR + decs.join('\n\n') + H('decisions') + add.join('\n\n') + '\n');
  }
  console.log(`dams: ⚠ PERF PROBE - amplified ${JSON.stringify(AMP)}`);
}

const stages = projects.reduce((s, p) => s + p.stages, 0);
const mw = projects.reduce((s, p) => s + p.mw, 0);
console.log(`dams: ${projects.length} projects, ${stages} stages, ${Math.round(mw)} MW -> ${projects.reduce((s, p) => s + p.stage_units * p.stages, 0)} electricity/week; ` +
  `power plant ${P.power_plant_points} pts (${P.coal_points_per_unit}/unit); ${loc.length} loc keys x ${LANGS.length} languages` +
  (P.probe ? `  ⚠ PROBE: ${JSON.stringify(P.probe)}` : ''));
