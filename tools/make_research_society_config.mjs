// THE §10.98 BOOK (BALANCE_FRAMEWORK §10.98, user-ruled 2026-10-12): research entries beyond production. `--base <config> --suffix <sfx> [--wild]`
// writes config/mod_config.<sfx>.json = the base (a §10.97 book) + the ruled entries, and copies the base's tree twin (landmine L20).
// THE RULED TABLE LIVES HERE ONLY:
//   · ships back on: ours, a rival's OR a great power's ship ticks the bar once; 36-month stages; the frontline entries 12-month stages;
//     war and naval entries repeat (20 stages) like the rest;
//   · contagious ideas: a law in force in a country that is not a revolt — radical laws from ANY such country, advanced laws from a great power
//     or a neighbour; recomputed monthly (a repealed law drops the flag);
//   · tropical empire (quinine, malaria prevention): land in West / Equatorial / East / Southern Africa or Indonesia, ours or an integrated
//     subject's (colony, dominion, personal union, crown land, puppet, vassal, chartered company — NOT protectorate, NOT tributary);
//     civilizing mission: a great or major power with a colonial-affairs law other than none;
//   · the state apparatus (government administration) and universities: 3 × N staffed levels for a game-era-N technology;
//   · capital needs institutions: 10 × N financial-district levels, and the economic-system law is not traditionalism;
//   · cities: the largest urban centre — modern sewerage 15, organized sports 20, elevator 40, paved roads 80 levels (followers; ×2 first);
//   · antibiotics: 500,000 workers (first acquisition; 250,000 for followers) in the chemical industries (fertilizer, explosives, synthetics) — the top country's level in 1925–30 on the §10.97 book (vanilla's leaders pass it ~1920);
//   · the art chain (realism, camera, film) left to vanilla's own entries; mass propaganda gets none.
//   Every counted mark (incl. the cities) is the FOLLOWER's; the first acquisition needs double (§10.98); yes/no conditions carry no mark. Literacy by game era on every non-military entry.
// --wild: the SMOKE book — 3-month stages everywhere and every mark at its minimum, so each entry fires within a decade. Never measured.
import fs from 'node:fs'; import path from 'node:path';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base'), SFX = opt('--suffix'), WILD = args.includes('--wild');
if (!BASE || !SFX) { console.error('usage: --base <config> --suffix <sfx> [--wild]'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(BASE, 'utf8')); const RE = cfg.research_events;
if (!RE || RE.sources_additive !== false || !RE.implementation_repeats) { console.error('the base is not a §10.97 book'); process.exit(1); }
if (RE.condition_entries) { console.error('the base already carries §10.98'); process.exit(1); }
const twinIn = BASE.replace(/mod_config\.([^/\\]+)\.json$/, 'tech_tree_options.$1.json');
const TREE = JSON.parse(fs.readFileSync(twinIn, 'utf8')).options.find(o => o.ships).techs; const eraOf = id => { const t = TREE.find(x => x.id === id); if (!t) throw new Error('no tech ' + id); return t.era; };
const W = (n) => WILD ? 1 : n;
const CE = {}, CV = {}; const G = [];
const law = l => `has_law = law_type:${l}`;
// contagion
const RADICAL = { socialism: ['law_council_republic', 'law_factory_councils', 'law_collectivized_agriculture'], anarchism: ['law_anarchy'],
  corporatism: ['law_corporate_state', 'law_corporatized_unions'], political_agitation: ['law_single_party_state', 'law_outlawed_dissent'],
  central_planning: ['law_command_economy'], nationalism: ['law_ethnostate'] };
const ADVANCED = { egalitarianism: ['law_universal_suffrage'], human_rights: ['law_multicultural', 'law_protected_speech', 'law_compulsory_primary_school', 'law_worker_protections', 'law_old_age_pension'],
  feminism: ['law_women_in_the_workplace', 'law_womens_suffrage'], labor_movement: ['law_restricted_child_labor', 'law_regulatory_bodies', 'law_wage_subsidies'],
  pharmaceuticals: ['law_private_health_insurance', 'law_public_health_insurance'] };
const stable = `NOT = { is_revolutionary = yes }`;
const anyLaw = ls => `OR = { ${ls.map(law).join('  ')} }`;
// "A, B or C" (2026-10-21, the generated-text pass)
const lawsText = ls => { const n = ls.map(l => '$' + l + '$'); return n.length > 1 ? n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1] : n[0]; };
for (const [t, ls] of Object.entries(RADICAL)) {
  G.push(`if = { limit = { any_country = { ${stable}  ${anyLaw(ls)} } }  set_global_variable = pmr_idea_${t} }\nelse_if = { limit = { has_global_variable = pmr_idea_${t} }  remove_global_variable = pmr_idea_${t} }`);
  CE[t] = { trigger: `has_global_variable = pmr_idea_${t}`, label: `A country not in revolt, anywhere, lives under ${lawsText(ls)}`,
    intro: 'An idea in practice anywhere is an idea within reach everywhere.' };
}
for (const [t, ls] of Object.entries(ADVANCED)) {
  G.push(`if = { limit = { any_country = { ${stable}  country_rank >= rank_value:great_power  ${anyLaw(ls)} } }  set_global_variable = pmr_ideagp_${t} }\nelse_if = { limit = { has_global_variable = pmr_ideagp_${t} }  remove_global_variable = pmr_ideagp_${t} }`);
  G.push(`every_country = { limit = { ${stable}  ${anyLaw(ls)} }  every_country = { limit = { is_adjacent_to_country = PREV }  set_variable = { name = pmr_ideanb_${t}  days = 40 } } }`);
  CE[t] = { trigger: `OR = { has_global_variable = pmr_ideagp_${t}  has_variable = pmr_ideanb_${t} }`,
    label: `A great power or a neighbor of ours, not in revolt, lives under ${lawsText(ls)}`,
    intro: 'What the great powers and our neighbors practice, our own reformers can point to.' };
}
// tropical empire, civilizing mission
const REG = `OR = { ${['west_africa', 'equatorial_africa', 'east_africa', 'southern_africa', 'indonesia'].map(r => `region = sr:region_${r}`).join('  ')} }`;
const SUBJ = `OR = { ${['colony', 'dominion', 'personal_union', 'crown_land', 'puppet', 'vassal', 'chartered_company'].map(s => `is_subject_type = subject_type_${s}`).join('  ')} }`;
for (const t of ['quinine', 'malaria_prevention'])
  CE[t] = { trigger: `OR = { any_scope_state = { ${REG} }  any_subject_or_below = { ${SUBJ}  any_scope_state = { ${REG} } } }`,
    label: 'We or a subject of ours other than a $subject_type_tributary_no_icon$ hold land in $region_west_africa$, $region_equatorial_africa$, $region_east_africa$, $region_southern_africa$ or $region_indonesia$',
    intro: 'Those who rule the tropics must learn to survive them.' };
CE.civilizing_mission = { trigger: `country_rank >= rank_value:major_power  NOT = { ${law('law_no_colonial_affairs')} }`,
  label: 'We are a great or major power and do not have $law_no_colonial_affairs$', intro: 'An empire looks for a mission.' };
// script values: staffed levels of a building type
const staffed = b => `value = 0\nevery_scope_building = {\n\tlimit = { is_building_type = ${b} }\n\tadd = { value = this.level  multiply = occupancy }\n}`;
CV.pmr_cv_uni = staffed('building_university'); CV.pmr_cv_gov = staffed('building_government_administration');
CV.pmr_cv_fin = `value = 0\nevery_scope_building = {\n\tlimit = { is_building_type = building_financial_district }\n\tadd = this.level\n}`;
// ⭐ THE RULED NUMBER IS THE FOLLOWER'S MARK; THE FIRST ACQUISITION NEEDS DOUBLE (user, 2026-10-12: 'let's have the ruled numbers as the halved ones, and for
//   the initial acquisition they should double'). `follower` = the ruled number; the full trigger is 2 × it, the half trigger it.
const markEntry = (t, sv, follower, label, intro, extra = '') => {
  const f = W(follower), full = WILD ? 1 : 2 * follower;
  CE[t] = { trigger: `${sv} >= ${full}${extra ? '  ' + extra : ''}`, half_trigger: `${sv} >= ${f}${extra ? '  ' + extra : ''}`,
    label: label.replace('{m}', full.toLocaleString('en-US')), intro, lines: [`now [ROOT.GetCountry.MakeScope.ScriptValue('${sv}')|0]`] };
};
for (const t of ['central_archives', 'identification_documents', 'macroeconomics', 'mass_surveillance'])
  markEntry(t, 'pmr_cv_gov', 3 * eraOf(t), 'Government administration: at least {m} fully staffed levels', 'A large state needs better tools to know itself.');
for (const t of ['dialectics', 'psychiatry', 'philosophical_pragmatism', 'psychoanalysis', 'behaviorism', 'analytical_philosophy'])
  markEntry(t, 'pmr_cv_uni', 3 * eraOf(t), 'Universities: at least {m} fully staffed levels', 'Learned men argue, and from the argument a school is born.');
for (const t of ['joint_stock_companies', 'corporate_charters', 'central_banking', 'postal_savings', 'mutual_funds', 'investment_banks', 'corporate_management', 'international_exchange_standards', 'modern_financial_instruments'])
  markEntry(t, 'pmr_cv_fin', 10 * eraOf(t), 'Financial districts: at least {m} levels, under any economic system but traditionalism', 'Capital needs institutions.', `NOT = { ${law('law_traditionalism')} }`);
// chemical industries' workers
const chemTypes = {};
for (const ind of cfg.industries) if (['fertilizer', 'explosives', 'synthetics'].includes(ind.id) && !ind.disabled) for (const t of ind.tiers) {
  const b = t.method_of || t.key; const e = Object.values(t.employment || {}).reduce((a, x) => a + x, 0) * (t.workforce_mult ?? 1); if (e > 0) chemTypes[b] = Math.max(chemTypes[b] || 0, e); }
for (const [b, e] of Object.entries(chemTypes)) CV[`pmr_cv_chem_${b.replace(/^building_/, '')}`] = staffed(b);
CV.pmr_cv_chem = 'value = 0\n' + Object.entries(chemTypes).map(([b, e]) => `add = { value = pmr_cv_chem_${b.replace(/^building_/, '')}  multiply = ${e} }`).join('\n');
markEntry('antibiotics', 'pmr_cv_chem', 250000,   // first acquisition 500,000 = the top country's level 1925-30
   'Workers in the chemical industries (fertilizer, explosives, synthetics): at least {m}', 'The chemists already have the bench; medicine needs only the question.');
// cities: the largest urban centre
for (const [t, m] of [['modern_sewerage', 15], ['organized_sports', 20], ['elevator', 40], ['paved_roads', 80]])
  CE[t] = { trigger: `any_scope_building = { is_building_type = building_urban_center  level >= ${WILD ? 1 : 2 * m} }`, half_trigger: `any_scope_building = { is_building_type = building_urban_center  level >= ${W(m)} }`,
    label: `Our largest $building_urban_center$: ${WILD ? 1 : 2 * m} levels`, intro: 'A great city makes its own demands.' };
for (const [t, e] of Object.entries(CE)) eraOf(t);   // every technology must exist (throws otherwise)
// ⭐ HOW THE COUNTED CONDITIONS READ (2026-10-21, polish): emit_research_events.mjs words a condition whose trigger compares one of these script values
//   exactly like an industry source — "<name>: N fully staffed levels (now X)" in the entry and in the bar tooltip. `per_level` shows a people
//   count in levels of that many workers (the tick still compares people); `unit` and `note` complete the sentence. Display only.
//   (The canon book was given this key in place on 2026-10-21, `_polish_2026_10_21`, rather than by re-running its chain.)
const COUNT_DISPLAY = {
  pmr_cv_gov: { name: '$building_government_administration$' },
  pmr_cv_uni: { name: '$building_university$' },
  pmr_cv_fin: { name: '$building_financial_district$', unit: 'levels', note: 'not under $law_traditionalism$' },
  pmr_cv_chem: { name: 'Chemical Industries (Fertilizer Plants, Explosives Factory, Synthetics Plants)', per_level: 5000 },
};
Object.assign(RE, {
  exclude_techs: ['realism', 'camera', 'film'],
  naval_channel: true, naval_any: true, naval_bar_months: WILD ? 3 : 36, war_bar_months: WILD ? 3 : 12, repeat_all: true,
  condition_entries: CE, condition_values: CV, count_display: COUNT_DISPLAY, monthly_global_effect: G.join('\n'),
});
if (WILD) { RE.industry_bar_months = 3; RE.literacy_by_era = { 1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.05 }; }
// --stage-months N (user, 2026-10-13: 'change JE length (3y per stage to 4y per stage) to dampen techs a bit'): every 36-month stage — the industry
//   bar (every non-war entry, the condition entries included) and the naval bar — becomes N months; the frontline (war) entries keep 12.
//   Written into the variant record only when given, so every earlier book regenerates byte for byte.
const STAGE = opt('--stage-months'); if (STAGE != null) { if (WILD || !(+STAGE > 0)) throw new Error('--stage-months N (N > 0), not with --wild'); RE.industry_bar_months = +STAGE; RE.naval_bar_months = +STAGE; }
const cmd = 'node tools/make_research_society_config.mjs ' + args.join(' ');
cfg._research_society_variant = { name: SFX, base: path.basename(BASE), wild: WILD, ruled_by: 'BALANCE_FRAMEWORK §10.98 (user, 2026-10-12)', command: cmd,
  delta: 'research_events: exclude_techs, naval_channel/naval_any/naval_bar_months/war_bar_months/repeat_all, condition_entries, condition_values, monthly_global_effect' };
if (STAGE != null) cfg._research_society_variant.stage_months = +STAGE;
const out = `config/mod_config.${SFX}.json`; fs.writeFileSync(out, JSON.stringify(cfg));
fs.copyFileSync(twinIn, `config/tech_tree_options.${SFX}.json`);
console.log(`${out}${WILD ? ' (WILD smoke book)' : ''}: ${Object.keys(CE).length} condition entries, ${Object.keys(CV).length} script values, ${G.length} monthly global blocks`);
