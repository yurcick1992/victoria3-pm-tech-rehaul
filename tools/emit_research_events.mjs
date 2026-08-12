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
if (!MOD) { console.error('usage: node tools/emit_research_events.mjs <modRoot>'); process.exit(2); }

const CFG = JSON.parse(readFileSync(join(REPO, 'config/mod_config.json'), 'utf8'));
const RE = CFG.research_events;
if (!RE || !RE.enabled) { console.log('research events: DISABLED in config - nothing emitted (this is the `techs` arm)'); process.exit(0); }

const TREEFILE = join(REPO, 'config/tech_tree_options.json');
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
      const emp = Object.values(prev.employment || {}).reduce((a, b) => a + b, 0);
      if (!emp) return;                                       // art academy: jobs live in the ownership PMG
      addSource(t.tech, t.era, 'improvement', { building: prev.key, emp });
    } else {
      const list = (RE.necessity_anchors || {})[ind.id];
      if (!list) return;                                      // deliberately unanchored (era-1 freebies etc.)
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
    const front = (inner) => w.require_front
      ? `any_scope_war = {\n${T}${T}${T}${T}${T}any_scope_front = {\n${T}${T}${T}${T}${T}${T}any_scope_general = {\n${T}${T}${T}${T}${T}${T}${T}owner = ROOT\n${T}${T}${T}${T}${T}${T}${T}${inner}\n${T}${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}${T}}\n${T}${T}${T}${T}}`
      : `any_scope_general = { ${inner} }`;
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
    const share = w.mobilised_share_min;
    const gate = `is_at_war = yes\n${T}${T}${T}${T}${share ? `pmr_mob_share >= ${share}\n${T}${T}${T}${T}` : ''}OR = {\n${T}${T}${T}${T}${T}${front(`num_mobilized_battalions >= ${w.general_battalions_high ?? 100}`)}\n${T}${T}${T}${T}${T}${front(`count >= ${w.generals_low_count ?? 2}\n${T}${T}${T}${T}${T}${T}${T}num_mobilized_battalions >= ${w.general_battalions_low ?? 50}`)}\n${T}${T}${T}${T}}`;
    terms.push({ desc: `pmr_term_war_pressed`, trigger: gate, value: 1 });
    terms.push({
      desc: `pmr_term_war_enemy_has_it`,
      trigger: `${gate}\n${T}${T}${T}${T}any_enemy_in_war = {\n${T}${T}${T}${T}${T}has_technology_researched = ${tech}\n${T}${T}${T}${T}}`,
      value: 2,
    });
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

  const span = a.rule === 'war' ? (RE.war_bar_weeks ?? 26) : (RE.industry_bar_months ?? 36);
  const cadence = a.rule === 'war' ? 'weekly_progress' : 'monthly_progress';
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
for (const lang of (CFG.languages || ['english']))
  W(`localization/${lang}/replace/zzz_pm_rehaul_research_l_${lang}.yml`,
    `l_${lang}:\n` + loc.map(([k, v]) => ` ${k}:0 "${v.replace(/"/g, '')}"`).join('\n') + '\n');

console.log(`research events: ${Object.keys(anchors).length} technologies (${nInd} industry, ${nWar} war) -> ` +
  `${jes.length} journal entries, ${bars.length} bars, ${sv.length} script values, ${loc.length} loc keys x ${(CFG.languages || ['english']).length} languages`);
