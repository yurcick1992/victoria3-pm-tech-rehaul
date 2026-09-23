// FINISH WHAT THE JOURNAL ENTRIES PAID FOR — the AI research-weight boost for a technology that one tick of
// research would complete (user-ruled 2026-09-23).
//
//   node tools/emit_tech_finish.mjs <modRoot> [configPath]        # called by tools/build.ps1, AFTER
//                                                                   # emit_techs.mjs and emit_research_events.mjs
//
// WHY. The research journal entries grant `grant_fraction` of the era base cost per completed stage. Once the
// granted progress covers the technology's whole cost — base cost plus the ahead-of-time penalty — a single
// weekly tick of research finishes it, which is immediate value the AI's own chooser cannot see: vanilla's
// pick formula divides by the ahead-of-time penalty (NAI TECH_COST_PENALTY_FACTOR) and has no term for
// progress already banked. So a paid-for technology sits unpicked for years.
//
// THE RULE, AS RULED: the AI gets a very high weight for technology X when
//   1) at least two of X's journal entries have fired for the country AND X carries no ahead-of-time penalty, or
//   2) all three have fired AND the penalty is not high enough to exceed the banked progress.
// ⭐ BOTH ARE DERIVED HERE, NOT TYPED IN. After k completed stages a country holds k × grant of progress, and
// the technology costs  era_cost × (1 + F × Σ),  F = TECH_AHEAD_OF_TIME_PENALTY_FACTOR and
// Σ = Σ over the unresearched technologies of the same category in earlier eras of (era − their era)
// (the wiki's "Tech cost = Era cost + # of unresearched tech · (era difference · 0.25 · Era cost)").
// So X is finishable after k stages iff  Σ ≤ (k × grant / era_cost − 1) / F.  At the shipped 0.5 and 0.25 that
// is Σ ≤ 0 after two stages and Σ ≤ 2 after three — the ruling's two cases — and it follows the config if
// grant_fraction, the stage list or the define ever changes. One stage (0.5 × cost) can never finish anything.
//
// ⭐⭐ Σ IS COMPUTED FROM THE TREE THE BUILD ACTUALLY EMITS. The tree is read as the engine will load it —
// vanilla's technology files, each replaced by the mod's same-named file where emit_techs.mjs wrote one,
// plus the mod's additive files — so moving a technology between eras, adding one, or changing which
// techs a category holds re-derives every penalty value on the next build with nothing to edit by hand.
//
// ⚠⚠ SERICULTURE — THE ONE TECHNOLOGY NOBODY CAN RESEARCH. It is era 1, production, `can_research = no`, and
// vanilla hands it to exactly eight tags (CAM CHI DAI JAP KOR SIA TIB WAL) plus their successor states;
// `add_era_researched = era_1` does NOT grant it (checked in the save summaries of the vanilla n=16 baseline
// and the canon). Whether the engine counts it toward the penalty decides whether ~99% of countries carry a
// permanent penalty on every production technology above era 1. `finish_boost.unresearchable` states which
// reading ships — 'count' or 'skip' — and is REQUIRED, so the choice is always on the record. Measured by the
// diagnostic probe of 2026-09-23 (FINDINGS; `diag: true` below logs the engine's own cost beside both readings).
//
// Conservative by construction: progress from tech spread and from the country's own research is ignored,
// and so is the one power-bloc principle that REDUCES the penalty (country_ahead_of_time_research_penalty_mult
// −0.05/level). Both can only make a technology finishable earlier than we claim, never later.
//
// WHAT IT WRITES
//   common/script_values/zzz_pm_rehaul_finish_values.txt  — the penalty values (+ the diagnostic flags)
//   common/technology/technologies/<file>.txt              — each covered technology's ai_weight gets one
//       conditional `add`, appended LAST (after any tech_ai_weight_mult `multiply`, so it is not scaled).
//       A vanilla file emit_techs.mjs did not own is regenerated from vanilla here and becomes owned.
//   common/on_actions/zzz_pm_rehaul_finish_diag.txt       — ONLY with `diag: true` (probe builds)
//
// ⚠ An undefined script value reads ZERO in this engine, and Σ = 0 means "no penalty" — so a reference to a
// value nobody defines would boost the wrong technologies silently. The last step re-reads what was written
// and throws on any `pmr_aot*` name that is read but not defined.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageVar, aotValue, stageFlagged, BOOST_MARKER } from './lib_tech_finish.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_tech_finish.mjs <modRoot> [configPath]'); process.exit(2); }
const CFGPATH = process.argv[3] || join(REPO, 'config/mod_config.json');
const CFG = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const RE = CFG.research_events;
const FB = RE && RE.enabled ? RE.finish_boost : null;
if (!FB || (!FB.enabled && !FB.diag)) {
  console.log('tech finish: off (research_events.finish_boost absent or neither enabled nor diag) - nothing emitted');
  process.exit(0);
}
const die = msg => { throw new Error('emit_tech_finish: ' + msg); };
if (!['count', 'skip'].includes(FB.unresearchable))
  die(`research_events.finish_boost.unresearchable must be 'count' or 'skip' (got ${JSON.stringify(FB.unresearchable)}) - ` +
    `it decides whether sericulture penalises the ~99% of countries that can never hold it`);
if (FB.enabled && !(typeof FB.add === 'number' && FB.add > 0)) die(`finish_boost.add must be a positive number when enabled`);

const T = '\t';
const BOM = '\uFEFF';
const read = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const write = (rel, text) => { const p = join(MOD, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, BOM + text, 'utf8'); };

// ---- a Clausewitz scanner that is not fooled by braces in comments or strings ---------------------------
// Everything below does its brace matching and its regexes on a MASK — the same text with comments and string
// contents blanked to spaces, same length — and patches the ORIGINAL at the same offsets.
const mask = t => t.replace(/"[^"\n]*"/g, s => '"' + ' '.repeat(s.length - 2) + '"').replace(/#[^\n]*/g, s => ' '.repeat(s.length));
function children(m, from, to) {               // `key = { … }` blocks at relative depth 0 inside [from, to)
  const out = []; let d = 0;
  for (let i = from; i < to; i++) {
    const c = m[i];
    if (c === '{') {
      if (d === 0) { const km = m.slice(Math.max(from, i - 120), i).match(/([A-Za-z_0-9.:-]+)\s*=\s*$/); out.push({ key: km ? km[1] : null, open: i, close: -1 }); }
      d++;
    } else if (c === '}') {
      d--;
      if (d < 0) die(`unbalanced braces at offset ${i}`);
      if (d === 0) out[out.length - 1].close = i;
    }
  }
  if (d !== 0) die(`unbalanced braces (depth ${d} at end)`);
  return out;
}
// depth-0 scalars of a block: its body with every child block blanked, so a nested `era =` can never match
function flat(m, blk) {
  let body = m.slice(blk.open + 1, blk.close);
  for (const c of children(m, blk.open + 1, blk.close))
    body = body.slice(0, c.open - blk.open - 1) + ' '.repeat(c.close - c.open + 1) + body.slice(c.close - blk.open);
  return body;
}

// ===================================================================================================
// 1. THE TREE AS THE ENGINE WILL LOAD IT
// ===================================================================================================
const VDIR = join(GAME, 'common/technology/technologies');
const MDIR = join(MOD, 'common/technology/technologies');
const vanFiles = readdirSync(VDIR).filter(f => f.endsWith('.txt'));
const modFiles = existsSync(MDIR) ? readdirSync(MDIR).filter(f => f.endsWith('.txt')) : [];
const files = {};                                   // filename -> { text, owned (already in the mod) }
for (const f of vanFiles) files[f] = { text: read(join(VDIR, f)), owned: false };
for (const f of modFiles) files[f] = { text: read(join(MDIR, f)), owned: true };
const TECH = {};                                    // id -> { era, category, canResearch, file }
for (const [f, F] of Object.entries(files)) {
  const m = mask(F.text);
  for (const b of children(m, 0, m.length)) {
    if (!b.key || !/^[a-z_0-9-]+$/.test(b.key)) continue;
    const s = flat(m, b);
    const era = s.match(/\bera\s*=\s*era_(\d)\b/), cat = s.match(/\bcategory\s*=\s*([a-z_]+)/);
    if (!era || !cat) die(`${f}: technology ${b.key} has no era or no category`);
    let canResearch = true;
    const cr = s.match(/\bcan_research\s*=\s*(\S+)/);
    if (cr) {
      if (cr[1] === 'no') canResearch = false;
      else if (cr[1] !== 'yes') die(`${f}: ${b.key} has a CONDITIONAL can_research - decide how the penalty treats it before shipping`);
    }
    // a conditional can_research lives in a child block, which flat() blanks — look for the key itself too
    if (!cr && children(m, b.open + 1, b.close).some(c => c.key === 'can_research'))
      die(`${f}: ${b.key} has a CONDITIONAL can_research - decide how the penalty treats it before shipping`);
    if (TECH[b.key]) die(`technology ${b.key} is defined in both ${TECH[b.key].file} and ${f}`);
    TECH[b.key] = { era: +era[1], category: cat[1], canResearch, file: f };
  }
}
const nTech = Object.keys(TECH).length;
if (nTech < 150) die(`only ${nTech} technologies parsed - the tree files moved or changed shape`);
const unres = Object.entries(TECH).filter(([, t]) => !t.canResearch).map(([id]) => id);

// ===================================================================================================
// 2. WHAT THE JOURNAL ENTRIES PAY, AND WHEN THAT IS ENOUGH
// ===================================================================================================
const STAGES = RE.stages;
if (!Array.isArray(STAGES) || STAGES.length < 2) die('research_events.stages must list at least two stages');
const GF = RE.grant_fraction ?? 0.5;                // the same default emit_research_events.mjs uses
const ERACOST = {};
for (const f of readdirSync(join(GAME, 'common/technology/eras')))
  for (const mm of read(join(GAME, 'common/technology/eras', f)).matchAll(/era_(\d+)\s*=\s*\{[^}]*?technology_cost\s*=\s*(\d+)/g)) ERACOST[+mm[1]] = +mm[2];
if (Object.keys(ERACOST).length < 5) die('the era cost file moved or changed shape');
// the define as it SHIPS: our partial override if we emit one, vanilla's otherwise
const factor = (() => {
  const re = /TECH_AHEAD_OF_TIME_PENALTY_FACTOR\s*=\s*([0-9.]+)/;
  const ours = join(MOD, 'common/defines/01_pm_rehaul_defines.txt');
  const hit = (existsSync(ours) && read(ours).match(re)) || read(join(GAME, 'common/defines/00_defines.txt')).match(re);
  if (!hit) die('TECH_AHEAD_OF_TIME_PENALTY_FACTOR not found in our defines or vanilla\'s');
  return +hit[1];
})();
// maxSigma(k, era): the largest penalty sum at which k stages' progress still covers the cost. The grant is
// rounded exactly as emit_research_events.mjs rounds it, so the two cannot disagree by a rounding step.
const maxSigma = (k, era) => {
  const grant = Math.round(ERACOST[era] * GF);
  const x = (k * grant / ERACOST[era] - 1) / factor;
  return x < -1e-9 ? null : Math.floor(x + 1e-9);
};

// the covered technologies, read from the journal entries this build actually emitted
const JEF = join(MOD, 'common/journal_entries/zzz_pm_rehaul_research.txt');
if (!existsSync(JEF)) die(`${JEF} not found - research events must be emitted before this step`);
const JEtext = read(JEF);
const covered = [...JEtext.matchAll(new RegExp(`^je_pmr_([a-z_0-9]+)_${STAGES[0]} = \\{`, 'gm'))].map(x => x[1]).sort();
if (!covered.length) die('no research journal entries found');
// every stage a condition (or the diagnostics) will read must be flagged by the JE — and only those are
const readsStage = (t, k) => !!FB.diag || maxSigma(k, TECH[t].era) != null;
for (const t of covered) {
  if (!TECH[t]) die(`journal entries cover ${t}, which the emitted tree does not define`);
  STAGES.forEach((st, i) => {
    const k = i + 1, set = JEtext.includes(`set_variable = ${stageVar(t, st)}`);
    if (readsStage(t, k) && !stageFlagged(k, GF, FB.diag))
      die(`${t}: stage ${k} would be read but lib_tech_finish.stageFlagged says it is never set - the rounding of the grant disagrees with the rule`);
    if (readsStage(t, k) && !set) die(`the ${st} entry of ${t} does not set ${stageVar(t, st)} - emit_research_events.mjs and this step disagree`);
  });
}

// ===================================================================================================
// 3. THE PENALTY VALUES
// ===================================================================================================
// one value per (category, era) — the penalty does not depend on the technology, only on its category and era
const sigmaBody = (cat, era, countUnresearchable) => {
  const terms = Object.entries(TECH)
    .filter(([id, t]) => t.category === cat && t.era < era && (countUnresearchable || t.canResearch))
    .sort((a, b) => a[1].era - b[1].era || a[0].localeCompare(b[0]));
  return `{\n${T}value = 0\n` + terms.map(([id, t]) =>
    `${T}if = { limit = { NOT = { has_technology_researched = ${id} } }  add = ${era - t.era} }`).join('\n') + '\n}';
};
const SHIP_COUNT = FB.unresearchable === 'count';
const sv = [];
const needed = new Set();                           // "cat|era" the shipping condition reads
for (const t of covered) if (TECH[t].era >= 2) needed.add(TECH[t].category + '|' + TECH[t].era);
const cats = [...new Set(Object.values(TECH).map(t => t.category))].sort();
const eras = [...new Set(Object.values(TECH).map(t => t.era))].sort();
for (const key of [...needed].sort()) {
  const [cat, era] = key.split('|');
  sv.push(`# penalty of a ${cat} technology in game era ${era}, in units of ${factor} x its era cost` +
    (unres.length ? ` (unresearchable technologies ${SHIP_COUNT ? 'COUNTED' : 'skipped'}: ${unres.join(', ')})` : ''));
  sv.push(`${aotValue(cat, +era)} = ${sigmaBody(cat, +era, SHIP_COUNT)}`);
}

// the eligibility condition of one technology, as trigger text at a given indent
function eligibility(t, ind) {
  const { category: cat, era } = TECH[t];
  const P = T.repeat(ind);
  const rules = [];
  for (let k = STAGES.length; k >= 1; k--) {
    const ms = maxSigma(k, era);
    if (ms == null) continue;
    rules.push(era >= 2 ? `has_variable = ${stageVar(t, STAGES[k - 1])}  ${aotValue(cat, era)} <= ${ms}` : `has_variable = ${stageVar(t, STAGES[k - 1])}`);
  }
  if (!rules.length) return null;
  return rules.length === 1
    ? `${P}${rules[0]}`
    : `${P}OR = {\n` + rules.map(r => `${P}${T}AND = { ${r} }`).join('\n') + `\n${P}}`;
}

// ===================================================================================================
// 4. THE AI WEIGHT
// ===================================================================================================
const report = [];
if (FB.enabled) {
  const byFile = {};
  for (const t of covered) (byFile[TECH[t].file] ||= []).push(t);
  for (const [f, list] of Object.entries(byFile)) {
    let txt = files[f].text;
    if (txt.includes(BOOST_MARKER)) die(`${f} already carries the finish boost - it would be applied twice`);
    // patch back to front so earlier offsets stay valid
    const m0 = mask(txt);
    const blocks = children(m0, 0, m0.length).filter(b => list.includes(b.key)).sort((a, b) => b.open - a.open);
    if (blocks.length !== list.length) die(`${f}: found ${blocks.length} of ${list.length} covered technologies`);
    for (const b of blocks) {
      const cond = eligibility(b.key, 4);
      if (!cond) die(`${b.key}: no stage count can ever cover its cost - check grant_fraction and the stage list`);
      const ins = `${T}${T}${BOOST_MARKER} — the research journal entries have paid for this technology; one tick of research completes it\n` +
        `${T}${T}if = {\n${T}${T}${T}limit = {\n${cond}\n${T}${T}${T}}\n${T}${T}${T}add = ${FB.add}\n${T}${T}}\n`;
      const m = mask(txt);
      const aw = children(m, b.open + 1, b.close).filter(c => c.key === 'ai_weight');
      if (aw.length > 1) die(`${b.key} has ${aw.length} ai_weight blocks`);
      // Insert immediately before a closing brace. When the brace sits alone on its line, the insertion goes
      // at the start of that line; when it shares a line with content (`ai_weight = { value = 1 }`), the
      // "start of the line" would be OUTSIDE the block, so the brace is pushed onto a line of its own instead.
      const before = (close, what, braceIndent) => {
        const ls = txt.lastIndexOf('\n', close) + 1;
        if (txt.slice(ls, close).trim() === '') return txt.slice(0, ls) + what + txt.slice(ls);
        return txt.slice(0, close) + '\n' + what + braceIndent + txt.slice(close);
      };
      if (aw.length) txt = before(aw[0].close, ins, `${T}`);
      else txt = before(b.close, `${T}ai_weight = {\n${T}${T}value = 1\n` + ins + `${T}}\n`, '');
      report.push(`${b.key} (${TECH[b.key].category} e${TECH[b.key].era})`);
    }
    write(`common/technology/technologies/${f}`, txt);
    console.log(`  ${f}: ${list.length} technologies boosted${files[f].owned ? '' : ' (file now OWNED - regenerated from vanilla)'}`);
  }
}

// ===================================================================================================
// 5. DIAGNOSTICS (probe builds only)
// ===================================================================================================
// Logs the ENGINE'S OWN cost and progress beside both penalty readings, so the reconstruction and the
// sericulture question are checked against the game rather than argued. Lines carry no telemetry token: read
// them from a run's own logs_live mirror, after its telemetry token line (as je_tally.mjs does).
// ⚠ Each logging job is its own named on_action, so a data function the engine rejects can take down only
// its own job. `THIS.GetCountry` — not ROOT — is the form verified in effect-scope loc.
if (FB.diag) {
  for (const cat of cats) for (const era of eras) if (era >= 2) {
    sv.push(`${aotValue(cat, era, 'all')} = ${sigmaBody(cat, era, true)}`);
    sv.push(`${aotValue(cat, era, 'res')} = ${sigmaBody(cat, era, false)}`);
  }
  const flag = (name, trig) => `${name} = {\n${T}value = 0\n${T}if = { limit = { ${trig} }  add = 1 }\n}`;
  const minK = Math.min(...covered.map(t => { for (let k = 1; k <= STAGES.length; k++) if (maxSigma(k, TECH[t].era) != null) return k; return 99; }));
  for (const t of covered) {
    sv.push(`pmr_fd_k_${t} = {\n${T}value = 0\n` + STAGES.map(st => `${T}if = { limit = { has_variable = ${stageVar(t, st)} }  add = 1 }`).join('\n') + '\n}');
    sv.push(`pmr_fd_el_${t} = {\n${T}value = 0\n${T}if = {\n${T}${T}limit = {\n${eligibility(t, 3)}\n${T}${T}}\n${T}${T}add = 1\n${T}}\n}`);
    sv.push(flag(`pmr_fd_h50_${t}`, `has_technology_progress = { technology = ${t}  progress >= 0.5 }`));
    sv.push(flag(`pmr_fd_h100_${t}`, `has_technology_progress = { technology = ${t}  progress >= 1 }`));
    sv.push(flag(`pmr_fd_cur_${t}`, `is_researching_technology = ${t}`));
  }
  sv.push(`pmr_fd_nel = {\n${T}value = 0\n` + covered.map(t =>
    `${T}if = { limit = { NOT = { has_technology_researched = ${t} }  pmr_fd_el_${t} > 0 }  add = 1 }`).join('\n') + '\n}');
  const name = `[THIS.GetCountry.GetNameNoFormatting]`;
  const SV = s => `[THIS.GetCountry.MakeScope.ScriptValue('${s}')|0]`;
  const kGate = STAGES[minK - 1];
  const fin = covered.map(t => { const { category: c, era: e } = TECH[t];
    return `${T}${T}if = {\n${T}${T}${T}limit = { has_variable = ${stageVar(t, kGate)}  NOT = { has_technology_researched = ${t} } }\n` +
      `${T}${T}${T}debug_log = "PMR_FIN|${name}|${t}|${c}|${e}|k=${SV('pmr_fd_k_' + t)}|el=${SV('pmr_fd_el_' + t)}|sa=${e >= 2 ? SV(aotValue(c, e, 'all')) : 0}|sr=${e >= 2 ? SV(aotValue(c, e, 'res')) : 0}|h50=${SV('pmr_fd_h50_' + t)}|h100=${SV('pmr_fd_h100_' + t)}|cur=${SV('pmr_fd_cur_' + t)}"\n` +
      `${T}${T}}`; }).join('\n');
  const finc = covered.map(t =>
    `${T}${T}if = {\n${T}${T}${T}limit = { has_variable = ${stageVar(t, kGate)}  NOT = { has_technology_researched = ${t} } }\n` +
    `${T}${T}${T}debug_log = "PMR_FINC|${name}|${t}|[GetTechnology('${t}').GetCost(THIS.GetCountry.Self)|0]|[GetTechnology('${t}').GetProgress(THIS.GetCountry.Self)|0]"\n` +
    `${T}${T}}`).join('\n');
  const dates = FB.diag_cost_dates || ['1836.2.1', '1840.1.1'];
  const nextMonth = d => { const [y, mo] = d.split('.').map(Number); return mo === 12 ? `${y + 1}.1.1` : `${y}.${mo + 1}.1`; };
  const win = dates.map(d => `AND = { game_date >= ${d}  game_date < ${nextMonth(d)} }`).join('  ');
  const aot = Object.entries(TECH).filter(([, t]) => t.era >= 2).sort((a, b) => a[1].category.localeCompare(b[1].category) || a[1].era - b[1].era || a[0].localeCompare(b[0]))
    .map(([id, t]) => `${T}${T}${T}if = { limit = { NOT = { has_technology_researched = ${id} } }  debug_log = "PMR_AOT|${name}|${id}|${t.category}|${t.era}|[GetTechnology('${id}').GetCost(THIS.GetCountry.Self)|0]|${SV(aotValue(t.category, t.era, 'all'))}|${SV(aotValue(t.category, t.era, 'res'))}" }`).join('\n');
  const serHeld = unres.map(u => `${T}${T}${T}if = { limit = { has_technology_researched = ${u} } debug_log = "PMR_UNRES|${name}|${u}|held" }`).join('\n');
  write('common/on_actions/zzz_pm_rehaul_finish_diag.txt',
`# AUTO-GENERATED by tools/emit_tech_finish.mjs (finish_boost.diag) - do not edit by hand. PROBE BUILDS ONLY.
# Registered with \`on_actions = { }\`, never a second \`effect\` (landmine L22: effects do not merge across files).
on_monthly_pulse_country = {
${T}on_actions = {
${T}${T}pmr_finish_diag_state
${T}${T}pmr_finish_diag_costs
${T}${T}pmr_finish_diag_aot
${T}}
}
on_research_technology_started = {
${T}on_actions = {
${T}${T}pmr_finish_diag_pick
${T}}
}

# what each country is researching, and every covered technology it has banked at least ${minK} stage(s) of
pmr_finish_diag_state = {
${T}effect = {
${T}${T}debug_log = "PMR_RS|${name}|[THIS.GetCountry.GetCurrentlyResearchedTechnology.GetName]|nel=${SV('pmr_fd_nel')}|d=[TimeKeeper.GetCurrentDate.GetString]"
${fin}
${T}}
}

# the engine's own cost and progress for the same technologies — the ground truth "finishable" is judged by
pmr_finish_diag_costs = {
${T}effect = {
${finc}
${T}}
}

# once a window: the engine's cost of every unresearched technology of game era 2+, beside both penalty readings
pmr_finish_diag_aot = {
${T}effect = {
${T}${T}if = {
${T}${T}${T}limit = { OR = { ${win} } }
${serHeld}
${aot}
${T}${T}}
${T}}
}

# every research choice the country makes, with how many paid-for technologies it had to choose from
pmr_finish_diag_pick = {
${T}effect = {
${T}${T}debug_log = "PMR_PICK|${name}|[THIS.GetCountry.GetCurrentlyResearchedTechnology.GetName]|nel=${SV('pmr_fd_nel')}|d=[TimeKeeper.GetCurrentDate.GetString]"
${T}}
}
`);
}

write('common/script_values/zzz_pm_rehaul_finish_values.txt',
  '# AUTO-GENERATED by tools/emit_tech_finish.mjs - do not edit by hand.\n' + sv.join('\n\n') + '\n');

// ===================================================================================================
// 6. VERIFY WHAT WAS WRITTEN — an undefined script value reads zero, and zero means "no penalty"
// ===================================================================================================
{
  const svText = read(join(MOD, 'common/script_values/zzz_pm_rehaul_finish_values.txt'));
  const defined = new Set([...svText.matchAll(/^(pmr_[a-z_0-9]+)\s*=\s*\{/gm)].map(x => x[1]));
  const readers = [join(MDIR), join(MOD, 'common/on_actions'), join(MOD, 'common/script_values')];
  const used = new Set();
  for (const d of readers) if (existsSync(d)) for (const f of readdirSync(d).filter(x => x.endsWith('.txt'))) {
    const s = read(join(d, f));
    for (const x of s.matchAll(/\b(pmr_(?:aot|aotdiag|fd)_[a-z_0-9]+)\b/g)) used.add(x[1]);
  }
  const missing = [...used].filter(u => !defined.has(u));
  if (missing.length) die(`${missing.length} script value(s) read but never defined (they would read ZERO): ${missing.slice(0, 8).join(', ')}`);
  if (FB.enabled) {
    let n = 0;
    for (const f of readdirSync(MDIR).filter(x => x.endsWith('.txt'))) n += (read(join(MDIR, f)).split(BOOST_MARKER).length - 1);
    if (n !== covered.length) die(`${n} boost blocks written for ${covered.length} covered technologies`);
  }
}

const thr = STAGES.map((st, i) => { const v = [...new Set(eras.filter(e => e >= 2).map(e => maxSigma(i + 1, e)))]; return `${i + 1} stage${i ? 's' : ''} -> ${v[0] == null ? 'never' : 'Σ ≤ ' + v.join('/')}`; }).join(', ');
console.log(`tech finish: ${covered.length} covered technologies, grant ${GF} x era cost per stage, penalty factor ${factor}: ${thr}; ` +
  `unresearchable ${unres.join(', ') || '(none)'} ${SHIP_COUNT ? 'COUNTED' : 'skipped'}; ` +
  `${FB.enabled ? `boost +${FB.add} on ${report.length}` : 'boost OFF'}${FB.diag ? '; DIAGNOSTICS ON (probe build)' : ''}`);
