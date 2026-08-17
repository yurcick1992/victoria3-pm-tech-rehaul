// EMIT THE INDUSTRY-DRIVEN RESEARCH EVENTS (ROADMAP step 2).
//
//   node tools/emit_research_events.mjs <modRoot>        # called by tools/build.ps1
//
// Driven entirely by `research_events` in config/mod_config.json. `enabled: false` emits NOTHING,
// which is what makes `techs` and `techs+events` two CONFIG VARIANTS of one build rather than a
// code flag (user ruling 2026-08-11) — the arm is then expressible as {kind: config, config: …}
// and lands in build_state.json without any harness change.
//
// ⚠⚠ EVERY LOOKUP BELOW THROWS WHEN ITS ANCHOR IS MISSING, for the reason emit_techs.mjs does: a
// silent no-op here produces a mod that builds, loads, runs, and simply has no research events.
//
// THE ENGINE FACTS THIS RELIES ON ARE ALL MEASURED, NOT ASSUMED — see MODDING_NOTES.md →
// "What a tech-granting event can CONDITION on", probes 1-5 of 2026-08-11:
//   · `can_research = X` is exactly "prerequisites met AND not yet researched"
//   · a journal entry auto-activates from is_shown_when_inactive + possible, for EVERY country,
//     including tags that do not exist yet — which `add_journal_entry` could never reach
//   · occupancy is a WEIGHT, not a filter: Σ(level × occupancy) matched per-building data functions
//     to five decimals in seven countries
//   · a script value CAN be used as a trigger, and `count >= N` works inside a list trigger
//   · `root.` is mandatory when comparing against ROOT from inside an inner scope — without it the
//     value silently resolves in the inner scope
//   · `THIS.GetCountry` works in a JE effect; `ROOT.GetCountry` does not
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_research_events.mjs <modRoot> [configPath]'); process.exit(2); }

// ⚠⚠ THE CONFIG PATH IS AN ARGUMENT, AND IT USED TO BE HARDCODED. `build.ps1 -Config <alt>` threads that
// path through every other step; this one read `config/mod_config.json` regardless, so an alternate-config
// build emitted BUILDINGS from the alternate config and RESEARCH EVENTS from the canonical one — silently,
// because nothing compared them. It was caught while checking a pending measurement: the batch measuring
// DOUBLED employment thresholds would have emitted the canonical config's original thresholds and come
// back an exact rerun of the batch it was meant to be compared against.
const CFGPATH = process.argv[3] || join(REPO, 'config/mod_config.json');
const CFG = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const RE = CFG.research_events;
if (!RE || !RE.enabled) { console.log('research events: DISABLED in config - nothing emitted (this is the `techs` arm)'); process.exit(0); }

const TREE_SFX = (() => {
  const raw = process.env.MOD_CONFIG || process.argv[3] || '';
  const bn = raw.split('\\').join('/').split('/').pop();
  const m = bn.match(/^mod_config\.(.+)\.json$/);
  return m ? '.' + m[1] : '';
})();
const TREEFILE = join(REPO, 'config/tech_tree_options' + TREE_SFX + '.json');
const OPT = JSON.parse(readFileSync(TREEFILE, 'utf8')).options.find(o => o.ships);
if (!OPT) throw new Error('no option marked `ships` in config/tech_tree_options.json');
const TECH = Object.fromEntries(OPT.techs.map(t => [t.id, t]));

// ---- era base costs, read LIVE from the game so a patch cannot leave the grants wrong -----------
const ERACOST = {};
for (const f of readdirSync(join(GAME, 'common/technology/eras'))) {
  const s = readFileSync(join(GAME, 'common/technology/eras', f), 'utf8');
  for (const m of s.matchAll(/(era_\d+)\s*=\s*\{[^}]*?technology_cost\s*=\s*(\d+)/g)) ERACOST[m[1]] = +m[2];
}
if (Object.keys(ERACOST).length < 5) throw new Error(`only found ${Object.keys(ERACOST).length} era costs - the eras file moved or changed shape`);

// ---- building -> group, from the generated vanilla extract --------------------------------------
const vsrc = readFileSync(join(REPO, 'ui/vanilla.js'), 'utf8');
const VAN = JSON.parse(vsrc.slice(vsrc.indexOf('{'), vsrc.lastIndexOf(';')));
const GROUPS = new Set(Object.keys(VAN.groups || {}));

// ---- tech -> production methods it unlocks, for the rule-D anchoring ----------------------------
const techPM = {};
for (const f of readdirSync(join(GAME, 'common/production_methods'))) {
  if (!f.endsWith('.txt')) continue;
  const s = readFileSync(join(GAME, 'common/production_methods', f), 'utf8');
  const re = /^([a-z_0-9]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(s))) {
    let i = re.lastIndex, d = 1;
    while (i < s.length && d > 0) { if (s[i] === '{') d++; else if (s[i] === '}') d--; i++; }
    const ut = s.slice(re.lastIndex, i - 1).match(/unlocking_technologies\s*=\s*\{([^}]*)\}/);
    if (!ut) continue;
    for (const t of ut[1].trim().split(/\s+/).filter(Boolean)) (techPM[t] = techPM[t] || new Set()).add(m[1]);
  }
}
const pmBld = {};
for (const [bk, b] of Object.entries(VAN.buildings))
  for (const g of (b.pmgs || []))
    for (const pm of ((VAN.pmgs[g] || {}).pms || [])) (pmBld[pm] = pmBld[pm] || new Set()).add(bk);

// ---- derive the anchor table --------------------------------------------------------------------
// A tech's sources ACCUMULATE. `mechanized_workshops` unlocks both the textile and the furniture
// tier-3 building, so it gets both, and a country holding either fills its bar — the "several
// industries work towards one technology" case (user, 2026-08-11).
const anchors = {};
function addSource(tech, era, rule, src) {
  const a = anchors[tech] = anchors[tech] || { rule, era, sources: [] };
  if (rule === 'improvement') a.rule = 'improvement';        // improvement outranks a weaker rule
  a.era = Math.min(a.era, era);
  if (!a.sources.some(s => s.building === src.building && s.group === src.group)) a.sources.push(src);
}

for (const ind of CFG.industries) {
  const ts = ind.tiers || [];
  ts.forEach((t, i) => {
    if (!t.tech) return;
    const T = TECH[t.tech];
    if (!T) throw new Error(`tier ${t.key} names technology '${t.tech}', which is not in the shipping tree`);
    if (T.era === 1) return;                                  // granted free at the 1836 start
    if (i > 0) {
      const prev = ts[i - 1];
      // §10.60: a factored tier (ports) EMPLOYS config × workforce_mult per level — the script value
      // multiplies emp by in-game levels, so full-size emp here would fill the bar ~10× too fast.
      const wfM = prev.workforce_mult != null ? +prev.workforce_mult : 1;
      const emp = Math.round(Object.values(prev.employment || {}).reduce((a, b) => a + b, 0) * wfM);
      if (!emp) return;                                       // art academy: jobs live in the ownership PMG
      addSource(t.tech, t.era, 'improvement', { building: prev.key, emp });
    } else {
      // ⚠⚠ A RESEARCHABLE FIRST RUNG WITHOUT AN ANCHOR IS A BAR THAT CAN NEVER FILL, and it used to be a
      // silent `return`. The comment said "deliberately unanchored (era-1 freebies etc.)", which is true
      // only while that rung's technology sits in era 1 — those are handed out at the 1836 start and are
      // skipped above. `percussion_cap` is exactly the case that breaks it: the ladder-era alignment holds
      // it back at era 2 (moving it to era 1 would hand the powers percussion caps in 1836), so it IS
      // researchable, munition's first rung is its own, and munition had no anchor. Before the merges that
      // meant percussion_cap had NO sources at all and therefore no journal entry; after them it had one,
      // for artillery only, and the munition half of the same technology contributed nothing. Nothing
      // failed at any point.
      const list = (RE.necessity_anchors || {})[ind.id];
      if (!list) throw new Error(
        `research_events: ${ind.id}'s first rung (${t.key}) is gated on '${t.tech}', which is era ${T.era} ` +
        `and therefore RESEARCHABLE — but ${ind.id} has no necessity_anchors entry, so its research bar ` +
        `would have no source from this industry and could never fill. Add an anchor (a building or ` +
        `bg_ group whose presence is the demand pull for it), or give the industry an earlier rung.`);
      for (const s of list) {
        if (s.startsWith('bg_')) { if (!GROUPS.has(s)) throw new Error(`necessity_anchors[${ind.id}] names unknown building group '${s}'`); addSource(t.tech, t.era, 'necessity', { group: s }); }
        else addSource(t.tech, t.era, 'necessity', { building: s });
      }
    }
  });
}
// rule D: production technologies outside our ladder, anchored on what they unlock
for (const t of OPT.techs.filter(x => x.category === 'production' && x.era > 1 && !anchors[x.id])) {
  const g = new Set();
  for (const b of (t.vanillaUnlocks || [])) { const grp = (VAN.buildings[b] || {}).group; if (grp) g.add(grp); }
  for (const pm of (techPM[t.id] || [])) for (const b of (pmBld[pm] || [])) { const grp = (VAN.buildings[b] || {}).group; if (grp) g.add(grp); }
  for (const grp of g) addSource(t.id, Math.max(2, t.era), 'necessity', { group: grp });
}
// rule C: the military tree, on the war gate
for (const t of OPT.techs.filter(x => x.category === 'military' && x.era > 1 && !anchors[x.id]))
  anchors[t.id] = { rule: 'war', era: Math.max(2, t.era), sources: [] };

// ---- emit ----------------------------------------------------------------------------------------
const T = '\t';
const sv = [], bars = [], jes = [], loc = [];
const thresholdPeople = (era) => {
  const v = (RE.thresholds_by_era || {})[String(era)];
  if (v == null) throw new Error(`no threshold configured for era ${era}`);
  return v;
};
const perLevel = RE.employment_per_level_default || 5000;
const svName = (tech, i) => `pmr_src_${tech}_${i}`;
const barName = (tech) => `pmr_bar_${tech}`;
const jeName = (tech, s) => `je_pmr_${tech}_${s}`;
// The war gate's country variable, one per covered war technology. The bar reads `has_variable`;
// `on_monthly_pulse_country` sets it. See the war-term comment below and ROADMAP.md.
const wgVar = (tech) => `pmr_wargate_${tech}`;
const WAR_TECHS = [];
const keep = (tech) => WAR_TECHS.push(tech);

// the two country-scope values the war gate needs, emitted once
if ((RE.war_gate || {}).mobilised_share_min) {
  sv.push(`pmr_army_consc = { value = army_size_including_raised_conscripts }`);
  sv.push(`pmr_mob_share = {\n${T}value = 0\n${T}every_scope_general = { add = num_mobilized_battalions }\n${T}if = { limit = { pmr_army_consc > 0 }  divide = pmr_army_consc }\n}`);
}

let nWar = 0, nInd = 0;
for (const [tech, a] of Object.entries(anchors).sort()) {
  const T0 = TECH[tech];
  const grant = Math.round(ERACOST['era_' + T0.era] * (RE.grant_fraction ?? 0.5));
  if (!grant) throw new Error(`no era cost for ${tech} (era ${T0.era})`);
  const terms = [];

  if (a.rule === 'war') {
    nWar++;
    const w = RE.war_gate || {};
    // ⭐⭐ THE GATE IS NOT WRITTEN HERE ANY MORE — it is computed in `on_monthly_pulse_country` and
    // handed to the bar as an EXPIRING COUNTRY VARIABLE. (User-ruled 2026-08-18; full design in
    // ROADMAP.md → "The war channel — RULED IN DETAIL".)
    //
    // WHY. A `scripted_progress_bar` has no valid ROOT — vanilla uses ROOT zero times across all 14
    // of its bar files, and we used it 160 times. Every one of those lines threw
    // `Event target link 'owner' returned an invalid object`, ~117 times each, **18,720 error lines a
    // run**, and the war gate could never pass (BUGS_AND_FIXES 2026-08-17). A bar can evaluate any
    // COUNTRY-scoped trigger but nothing that needs US as a target — which rules out `owner = ROOT`,
    // the front restriction, and casualties, all at once.
    //
    // ⚠⚠ AND THE OLD GATE WAS ALREADY WRONG INDEPENDENTLY OF THAT. Its two clauses were ANDed but
    // UNCOUPLED: *some* war had *some* front with a big general of ours, AND *some* enemy in *some*
    // war held the technology. Britain, at war with both the USA and the Qing, learned a US
    // technology by fighting in China. No fix that stays inside the bar can close that, because the
    // binding is exactly what needs ROOT.
    keep(tech);
    // ⚠ THE MOBILISED SHARE IS A ONE-SIDED GATE, DELIBERATELY. Probe 5 measured
    // Σ(per-general mobilised battalions) ÷ army_size_including_raised_conscripts and it is
    // well-behaved for most belligerents (Carlist Spain 1.00, Brazil 0.88) but STILL EXCEEDS 1 for
    // some (Mexico 1.50) — the two quantities are not perfectly on one basis, so this is not a true
    // fraction. It is used only as a `>=` threshold, where an overshoot can produce a false
    // POSITIVE but never a false negative. In practice mobilisation is near-total when it happens
    // at all (peacetime reads 0 for every country measured), so 0.5 reads as "you have actually
    // mobilised", which is the intent.
    // ⚠⚠ BOTH war terms carry the SAME gate. The first build shipped the second term with only
    // `is_at_war = yes` + an enemy holding the technology — no battalions, no front, no mobilised
    // share — and at +2/week against a 26-week bar that completes in 13 weeks of ANY war against a
    // more advanced enemy. Session 20260812_010659 measured the result: military took 70% of all
    // completions and the top firing countries were micro-states (Selangor, Warsangali, Jambi) that
    // cannot field the intended 100 battalions. The design ruling was "we are at war, HAVE THOSE
    // BATTALIONS MOBILISED, THE ENEMIES ARE STRONG **and** our enemies have the tech already" — the
    // second term is the first term PLUS a clause, never a weaker condition beside it.
    // ⚠ THE TWO-TERM STRUCTURE IS RETIRED. There used to be `pmr_term_war_pressed` (+1 for a bare
    // state of war) beside `pmr_term_war_enemy_has_it` (+2). User ruling 2026-08-18: **a state of war
    // must not tick by itself**, so the weaker term is gone and the enemy clause folds into the one
    // gate. One qualifying month, one tick.
    terms.push({ desc: `pmr_term_war_engaged`, trigger: `has_variable = ${wgVar(tech)}`, value: 1 });
  } else {
    nInd++;
    const people = thresholdPeople(a.era);
    a.sources.forEach((s, i) => {
      const n = svName(tech, i);
      // Σ(level × occupancy): occupancy is a WEIGHT. A `limit = { occupancy >= x }` FILTER would score
      // seven half-staffed levels as zero while passing three full ones - measured and rejected.
      const filter = s.group ? `is_building_group = ${s.group}` : `is_building_type = ${s.building}`;
      // ⚠ A source only carries `emp` when it is one of OUR tiers (rule A), where the config states
      // employment per level. A hand-authored necessity anchor naming a VANILLA building, and every
      // building-GROUP anchor, has no such figure — so those are counted in STAFFED LEVELS against a
      // level threshold instead. Emitting `multiply = ${undefined}` here is exactly the bug the first
      // smoke run caught: five script values read `multiply = undefined` and the engine logged
      // "Badly read script value undefined" without the build noticing.
      const inPeople = s.emp != null;
      const mult = inPeople ? `\n${T}${T}multiply = ${s.emp}` : '';
      sv.push(`${n} = {\n${T}value = 0\n${T}every_scope_building = {\n${T}${T}limit = { ${filter} }\n${T}${T}add = { value = this.level  multiply = occupancy }\n${T}}${mult}\n}`);
      const need = inPeople ? people : Math.max(1, Math.round(people / perLevel));
      terms.push({ desc: `pmr_term_${a.rule}`, trigger: `${n} >= ${need}`, value: 1 });
    });
    if (!terms.length) continue;
  }

  // ⭐ WAR BARS ARE MONTHLY NOW, six ticks to a stage (user-ruled 2026-08-18). They were
  // `weekly_progress` over 26 weeks with terms worth +1 and +2, i.e. ~9 weeks when both held.
  // Monthly also puts the bar IN STEP WITH ITS GATE: `on_monthly_pulse_country` is the finest country
  // pulse vanilla has (verified), so a weekly bar reading a monthly flag would have accrued up to
  // three weeks on a stale reading. At monthly there is no stale window at all.
  const span = a.rule === 'war' ? (RE.war_bar_months ?? 6) : (RE.industry_bar_months ?? 36);
  const cadence = 'monthly_progress';
  // ⚠ A bar's `name` is a LOC KEY, not a label. The first smoke run logged 122 lines of
  // "Unrecognized loc key pmr_bar_<tech>" because only the shared `desc` had one.
  loc.push([barName(tech), `Towards ${(TECH[tech].name || tech).replace(/"/g, '')}`]);
  bars.push(`${barName(tech)} = {\n${T}name = "${barName(tech)}"\n${T}desc = "pmr_bar_desc"\n${T}default_green = yes\n${T}start_value = 0\n${T}min_value = 0\n${T}max_value = ${span}\n${T}${cadence} = {\n` +
    terms.map(t => `${T}${T}add = {\n${T}${T}${T}desc = "${t.desc}"\n${T}${T}${T}if = {\n${T}${T}${T}${T}limit = {\n${T}${T}${T}${T}${t.trigger}\n${T}${T}${T}${T}}\n${T}${T}${T}${T}value = ${t.value}\n${T}${T}${T}}\n${T}${T}}`).join('\n') +
    `\n${T}}\n}`);

  RE.stages.forEach((stage, si) => {
    const key = jeName(tech, stage);
    const first = si === 0;
    const next = RE.stages[si + 1];
    jes.push(
      `${key} = {\n` +
      `${T}icon = "gfx/interface/icons/event_icons/event_industry.dds"\n` +
      `${T}group = je_group_technology\n\n` +
      // Only the FIRST stage auto-activates. is_shown_when_inactive defaults to `no`, so stages 2
      // and 3 simply never appear until add_journal_entry places them.
      (first ? `${T}is_shown_when_inactive = { can_research = ${tech} }\n${T}possible = { can_research = ${tech} }\n\n` : '') +
      `${T}scripted_progress_bar = ${barName(tech)}\n\n` +
      `${T}complete = {\n${T}${T}scope:journal_entry ?= { "scripted_bar_progress(${barName(tech)})" >= ${span} }\n${T}}\n\n` +
      `${T}on_complete = {\n` +
      `${T}${T}if = {\n${T}${T}${T}limit = { can_research = ${tech} }\n${T}${T}${T}add_technology_progress = { progress = ${grant}  technology = ${tech} }\n${T}${T}}\n` +
      (next ? `${T}${T}if = {\n${T}${T}${T}limit = { can_research = ${tech} }\n${T}${T}${T}add_journal_entry = { type = ${jeName(tech, next)} }\n${T}${T}}\n` : '') +
      `${T}${T}debug_log = "PMR_JE|${stage}|${tech}|[THIS.GetCountry.GetNameNoFormatting]"\n` +
      `${T}}\n\n` +
      `${T}invalid = { has_technology_researched = ${tech} }\n\n` +
      `${T}weight = 1\n${T}transferable = no\n${T}can_revolution_inherit = yes\n` +
      `${T}should_be_pinned_by_default_uninvolved_or_context = no\n}`);
    const nice = (TECH[tech].name || tech).replace(/"/g, '');
    loc.push([key, `${nice}: ${stage.charAt(0).toUpperCase() + stage.slice(1)}`]);
    loc.push([key + '_desc', a.rule === 'war'
      ? `Hard fighting concentrates the mind. While our armies are committed to a front in strength — and the more so when the enemy already fields it — work towards ${nice} advances.`
      : `The trade already knows its own shortcomings. Where enough hands are employed at the work that ${nice} would improve, the improvement follows.`]);
    loc.push([key + '_reason', `Our position makes ${nice} worth pursuing.`]);
  });
}

loc.push(['pmr_bar_desc', 'Progress towards this discovery.']);
loc.push(['pmr_term_improvement', 'Employed in the industry this would improve']);
loc.push(['pmr_term_necessity', 'Employed in the industries that would use it']);
loc.push(['pmr_term_war_pressed', 'Committed to a front in strength']);
loc.push(['pmr_term_war_enemy_has_it', 'An enemy already fields it']);

const BOM = '\uFEFF';
const W = (rel, text) => { const p = join(MOD, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, BOM + text, 'utf8'); };
W('common/script_values/zzz_pm_rehaul_research_values.txt', '# AUTO-GENERATED by tools/emit_research_events.mjs - do not edit by hand.\n' + sv.join('\n\n') + '\n');
W('common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt', '# AUTO-GENERATED by tools/emit_research_events.mjs - do not edit by hand.\n' + bars.join('\n\n') + '\n');
W('common/journal_entries/zzz_pm_rehaul_research.txt', '# AUTO-GENERATED by tools/emit_research_events.mjs - do not edit by hand.\n' + jes.join('\n\n') + '\n');

// ===================================================================================================
// THE WAR GATE — evaluated where ROOT resolves, handed to the bars as expiring country variables
// ===================================================================================================
// Ruled 2026-08-18; design in ROADMAP.md. All three clauses bind inside ONE front, inside ONE war:
//   · a general of OURS on that front with >= <general_battalions_high> mobilised battalions
//   · an ENEMY general on that SAME front whose owner already holds the technology
//   · >= <front_casualties_min> of OUR casualties at that front
//
// ⭐ WHY THIS NEEDS NO `is_at_war_with`: that trigger DOES NOT EXIST in the game (checked against the
// full trigger list). It is not needed — a general on the far side of a front we are bleeding on is
// the enemy there by construction, so `NOT = { owner = ROOT }` is sufficient and exact. The
// state-ownership route first proposed for front-binding is therefore dropped.
//
// ⚠ L3/L4 — THE COST IS CONTAINED BY ORDERING, NOT BY LUCK. This is 40 technologies × a war/front
// sweep per country per month, which is squarely "a scope bounded today and unbounded in 1900" plus
// "two heavy sweeps in one tick". So: countries at peace exit immediately on `is_at_war = yes`, and
// the per-technology loop is reached only after that. Do not hoist a technology test above the war
// test.
//
// ⚠ `num_front_casualties` IS NOT BATTLE-ONLY. Its own loc reads "Total number of [Country]
// casualties at [Front]" — a LOCATION filter, not a CAUSE filter — and the engine exposes no counter
// separating battle deaths from attrition (only modifiers, and the boolean `has_high_attrition`). At
// this threshold, on a front that also holds a superior enemy army, attrition alone is unlikely to
// carry it; but the term is not battle-pure and must not be described as such.
if (WAR_TECHS.length) {
  const w = RE.war_gate || {};
  const batt = w.general_battalions_high ?? 100;
  const cas  = w.front_casualties_min ?? 50000;
  // The variable outlives one pulse so the bar never reads a hole between evaluations, and lapses by
  // itself so no clearing pass is needed - which is also why nothing here ever removes it.
  const days = w.gate_variable_days ?? 40;
  const blocks = WAR_TECHS.map(tech =>
`${T}${T}if = {
${T}${T}${T}limit = {
${T}${T}${T}${T}any_scope_war = {
${T}${T}${T}${T}${T}any_scope_front = {
${T}${T}${T}${T}${T}${T}any_scope_general = {
${T}${T}${T}${T}${T}${T}${T}owner = ROOT
${T}${T}${T}${T}${T}${T}${T}num_mobilized_battalions >= ${batt}
${T}${T}${T}${T}${T}${T}}
${T}${T}${T}${T}${T}${T}any_scope_general = {
${T}${T}${T}${T}${T}${T}${T}NOT = { owner = ROOT }
${T}${T}${T}${T}${T}${T}${T}owner = { has_technology_researched = ${tech} }
${T}${T}${T}${T}${T}${T}}
${T}${T}${T}${T}${T}${T}num_front_casualties = {
${T}${T}${T}${T}${T}${T}${T}target = ROOT
${T}${T}${T}${T}${T}${T}${T}value >= ${cas}
${T}${T}${T}${T}${T}${T}}
${T}${T}${T}${T}${T}}
${T}${T}${T}${T}}
${T}${T}${T}}
${T}${T}${T}set_variable = { name = ${wgVar(tech)}  days = ${days} }
${T}${T}}`).join('\n');
  W('common/on_actions/zzz_pm_rehaul_wargate.txt',
`# AUTO-GENERATED by tools/emit_research_events.mjs - do not edit by hand.
# The war research gate. Computed here because a scripted_progress_bar has no valid ROOT; the bars
# read the variables this sets. See ROADMAP.md -> "The war channel - RULED IN DETAIL".
on_monthly_pulse_country = {
${T}effect = {
${T}${T}if = {
${T}${T}${T}limit = { is_at_war = yes }
${blocks}
${T}${T}}
${T}}
}
`);
}
for (const lang of (CFG.languages || ['english']))
  W(`localization/${lang}/replace/zzz_pm_rehaul_research_l_${lang}.yml`,
    `l_${lang}:\n` + loc.map(([k, v]) => ` ${k}:0 "${v.replace(/"/g, '')}"`).join('\n') + '\n');

console.log(`research events: ${Object.keys(anchors).length} technologies (${nInd} industry, ${nWar} war) -> ` +
  `${jes.length} journal entries, ${bars.length} bars, ${sv.length} script values, ${loc.length} loc keys x ${(CFG.languages || ['english']).length} languages`);
