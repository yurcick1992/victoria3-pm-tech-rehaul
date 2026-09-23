// FINISH WHAT IS ALREADY PAID FOR — the AI research-weight boost for a technology whose banked progress already
// covers (almost) all of its cost (user-ruled 2026-09-23).
//
//   node tools/emit_tech_finish.mjs <modRoot> [configPath]        # called by tools/build.ps1, AFTER
//                                                                   # emit_techs.mjs and emit_research_events.mjs
//
// WHY. The AI's research chooser has no term for progress already banked: vanilla's pick formula divides by the
// ahead-of-time penalty (NAI TECH_COST_PENALTY_FACTOR) and nothing else. So a technology one tick from done can sit
// unpicked while the AI researches something else — an infinitesimally cheap benefit left on the table.
//
// THE RULE (the FLAT form, user-ruled 2026-09-23, replacing the same day's JE-stage + penalty-reconstruction form):
//   every researchable technology's ai_weight ends in
//       if = { limit = { has_technology_progress = { technology = X  progress >= <threshold> } }  add = <add> }
//   `has_technology_progress` reads progress as a FRACTION OF THE PENALISED COST — verified against the engine's own
//   GetProgress ÷ GetCost on 219 of 219 readings (FINDINGS F160) — so it already includes the ahead-of-time penalty
//   and every source of progress (research journal entries, tech spread, the country's own research). Nothing is
//   reconstructed, so moving technologies between eras or adding new ones needs nothing by hand.
// ⭐ `add`, not `multiply`: the ahead-of-time divisor applies OUTSIDE ai_weight, and a technology can reach the
//   threshold with a large penalty attached; an add of 10000 beats vanilla's heaviest weight (101.5) at any divisor
//   the tree can produce. It is appended LAST, after any tech_ai_weight_mult `multiply`, because ai_weight evaluates
//   top to bottom with no order of operations.
// ⚠ EXPECT IT TO FIRE RARELY. F160: a grant that reaches the cost completes the technology inside the granting
//   effect, and research/spread cross the 99–100% band in about a week. What it catches is the leftover — research
//   switched away, a spread target that moved on, a penalty that fell below banked progress.
//
// WHAT IT WRITES
//   common/technology/technologies/<file>.txt — every file holding a researchable technology: vanilla's three
//   (regenerated from vanilla here when emit_techs.mjs did not already own them) and our additive file.
//
// SKIPPED: technologies with `can_research = no` (sericulture) — they can never be picked. A CONDITIONAL
// can_research makes the build THROW, so a patch that introduces one forces a decision.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_tech_finish.mjs <modRoot> [configPath]'); process.exit(2); }
const CFGPATH = process.argv[3] || join(REPO, 'config/mod_config.json');
const CFG = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const FB = CFG.research_events?.finish_boost;
const die = msg => { throw new Error('emit_tech_finish: ' + msg); };
if (FB && ('diag' in FB || 'unresearchable' in FB))
  die(`finish_boost carries 'diag'/'unresearchable', keys of the RETIRED JE-stage form (commit 11a5b90, FINDINGS F160). ` +
    `The flat form takes { enabled, threshold, add } only — rebuild such a probe config from that commit if it must be reproduced.`);
if (!FB || (!FB.enabled && !FB.force_test)) { console.log('tech finish: off (research_events.finish_boost absent or not enabled) - nothing emitted'); process.exit(0); }
if (!(typeof FB.threshold === 'number' && FB.threshold > 0 && FB.threshold <= 1)) die(`finish_boost.threshold must be a fraction in (0, 1] (got ${FB.threshold})`);
if (!(typeof FB.add === 'number' && FB.add > 0)) die(`finish_boost.add must be a positive number (got ${FB.add})`);
const MARKER = '# pmr_finish_boost';

const T = '\t';
const BOM = '\uFEFF';
const read = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const write = (rel, text) => { const p = join(MOD, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, BOM + text, 'utf8'); };

// ---- a Clausewitz scanner that is not fooled by braces in comments or strings ---------------------------
// Brace matching and regexes run on a MASK — the text with comments and string contents blanked, same length —
// and the ORIGINAL is patched at the same offsets.
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
function flat(m, blk) {                        // depth-0 text of a block, every child block blanked
  let body = m.slice(blk.open + 1, blk.close);
  for (const c of children(m, blk.open + 1, blk.close))
    body = body.slice(0, c.open - blk.open - 1) + ' '.repeat(c.close - c.open + 1) + body.slice(c.close - blk.open);
  return body;
}

// ---- the tree as the engine loads it: vanilla's files, the mod's same-named files over them, plus additive ones
const VDIR = join(GAME, 'common/technology/technologies');
const MDIR = join(MOD, 'common/technology/technologies');
const files = {};
for (const f of readdirSync(VDIR).filter(x => x.endsWith('.txt'))) files[f] = { text: read(join(VDIR, f)), owned: false };
if (existsSync(MDIR)) for (const f of readdirSync(MDIR).filter(x => x.endsWith('.txt'))) files[f] = { text: read(join(MDIR, f)), owned: true };

const seen = {};
const researchable = new Set();
let nBoost = 0, nSkip = 0;
const skipped = [];
for (const [f, F] of Object.entries(files)) {
  let txt = F.text;
  if (txt.includes(MARKER)) die(`${f} already carries the finish boost - it would be applied twice`);
  const m0 = mask(txt);
  const techs = children(m0, 0, m0.length).filter(b => b.key && /^[a-z_0-9-]+$/.test(b.key));
  let n = 0;
  for (const b of techs.sort((a, c) => c.open - a.open)) {      // back to front, so earlier offsets stay valid
    if (seen[b.key]) die(`technology ${b.key} is defined in both ${seen[b.key]} and ${f}`);
    seen[b.key] = f;
    const s = flat(m0, b);
    if (!/\bera\s*=\s*era_\d\b/.test(s) || !/\bcategory\s*=\s*[a-z_]+/.test(s)) die(`${f}: ${b.key} has no era or no category - not a technology?`);
    const cr = s.match(/\bcan_research\s*=\s*([a-z]+)\b/);
    if (children(m0, b.open + 1, b.close).some(c => c.key === 'can_research') || (cr && !['yes', 'no'].includes(cr[1])))
      die(`${f}: ${b.key} has a CONDITIONAL can_research - decide whether it should be boosted before shipping`);
    if (cr && cr[1] === 'no') { nSkip++; skipped.push(b.key); continue; }
    researchable.add(b.key);
    if (!FB.enabled) continue;              // a force_test control arm: parse the tree, patch nothing
    const ins = `${T}${T}${MARKER} — its banked progress covers ${FB.threshold * 100}% of its cost: one tick of research completes it\n` +
      `${T}${T}if = {\n${T}${T}${T}limit = { has_technology_progress = { technology = ${b.key}  progress >= ${FB.threshold} } }\n` +
      `${T}${T}${T}add = ${FB.add}\n${T}${T}}\n`;
    // insert immediately before a closing brace: at the start of its line when it stands alone, otherwise push the
    // brace onto a line of its own (a one-line `ai_weight = { value = 1 }` would put "start of line" OUTSIDE it)
    const before = (close, what, braceIndent) => {
      const ls = txt.lastIndexOf('\n', close) + 1;
      if (txt.slice(ls, close).trim() === '') return txt.slice(0, ls) + what + txt.slice(ls);
      return txt.slice(0, close) + '\n' + what + braceIndent + txt.slice(close);
    };
    const aw = children(mask(txt), b.open + 1, b.close).filter(c => c.key === 'ai_weight');
    if (aw.length > 1) die(`${b.key} has ${aw.length} ai_weight blocks`);
    txt = aw.length ? before(aw[0].close, ins, T) : before(b.close, `${T}ai_weight = {\n${T}${T}value = 1\n` + ins + `${T}}\n`, '');
    n++;
  }
  if (n) {
    write(`common/technology/technologies/${f}`, txt);
    console.log(`  ${f}: ${n} technologies boosted${F.owned ? '' : ' (file now OWNED - regenerated from vanilla)'}`);
    nBoost += n;
  }
}
const nTech = Object.keys(seen).length;
if (nTech < 150) die(`only ${nTech} technologies parsed - the tree files moved or changed shape`);

// verify the artifact: one boost per researchable technology, each naming its own technology
if (FB.enabled) {
  let blocks = 0;
  for (const f of readdirSync(MDIR).filter(x => x.endsWith('.txt'))) {
    const s = read(join(MDIR, f));
    blocks += s.split(MARKER).length - 1;
    const m = mask(s);
    for (const b of children(m, 0, m.length)) {
      const body = s.slice(b.open, b.close);
      const hit = body.match(/has_technology_progress = \{ technology = ([a-z_0-9-]+)/);
      if (hit && hit[1] !== b.key) die(`${f}: ${b.key}'s boost tests ${hit[1]}`);
    }
  }
  if (blocks !== nBoost || nBoost !== nTech - nSkip) die(`${blocks} boost blocks written, ${nBoost} counted, ${nTech - nSkip} researchable technologies`);
}
if (FB.enabled) console.log(`tech finish: +${FB.add} AI weight at has_technology_progress >= ${FB.threshold} on all ${nBoost} researchable technologies ` +
  `(of ${nTech}; skipped as unresearchable: ${skipped.join(', ') || 'none'})`);
else console.log(`tech finish: boost OFF (force_test control arm) - ${researchable.size} researchable technologies parsed, none patched`);

// ===================================================================================================
// FORCE TEST (probe builds only) — does the boost change what the AI picks?
// ===================================================================================================
// `finish_boost.force_test` {from, to, techs[]}: once, in the monthly pulse between `from` and `to`, each country
// gets ONE technology — the first of `techs` it can research and is not already researching — pushed to between
// `threshold` and 100% of its cost. Progress is added in steps until has_technology_progress ITSELF reports the
// threshold, so the forcing also re-verifies the trigger. ⚠ It must never reach 100%: a grant reaching the cost
// completes the technology on the spot (F160), which would test nothing. So the fine step is below half of
// (1 − threshold) of the cheapest candidate's era cost, and the coarse step below half of the last 10%.
// Every research choice is logged afterwards. Run it with `enabled: true` and `enabled: false` — the only difference
// between the two arms — and compare whether the next choice after forcing is the forced technology.
if (FB.force_test) {
  const ft = FB.force_test;
  if (!Array.isArray(ft.techs) || !ft.techs.length || !ft.from || !ft.to) die('force_test needs { from, to, techs[] }');
  for (const t of ft.techs) if (!researchable.has(t)) die(`force_test names ${t}, which is not a researchable technology of this tree`);
  if (!(typeof FB.threshold === 'number' && FB.threshold < 1)) die('force_test needs finish_boost.threshold < 1 (the band below completion)');
  const ERACOST = {};
  for (const f of readdirSync(join(GAME, 'common/technology/eras')))
    for (const mm of read(join(GAME, 'common/technology/eras', f)).matchAll(/era_(\d+)\s*=\s*\{[^}]*?technology_cost\s*=\s*(\d+)/g)) ERACOST[+mm[1]] = +mm[2];
  const eraOf = t => +mask(files[seen[t]].text).match(new RegExp(`^${t} = \\{[\\s\\S]*?\\bera = era_(\\d)`, 'm'))[1];
  const minCost = Math.min(...ft.techs.map(t => ERACOST[eraOf(t)]));   // the penalty only ADDS, so this is the floor
  const COARSE_TO = 0.9;
  const coarse = Math.floor((1 - COARSE_TO) * minCost / 2), fine = Math.floor((1 - FB.threshold) * minCost / 2);
  if (fine < 1) die(`threshold ${FB.threshold} leaves no room below completion for a step on a ${minCost}-point technology`);
  const name = `[THIS.GetCountry.GetNameNoFormatting]`, date = `[TimeKeeper.GetCurrentDate.GetString]`;
  const pc = t => `prog=[GetTechnology('${t}').GetProgress(THIS.GetCountry.Self)|0]|cost=[GetTechnology('${t}').GetCost(THIS.GetCountry.Self)|0]`;
  const hp = (t, p) => `has_technology_progress = { technology = ${t}  progress >= ${p} }`;
  const branches = ft.techs.map((t, i) =>
`${T}${T}${T}${i ? 'else_if' : 'if'} = {
${T}${T}${T}${T}limit = { can_research = ${t}  NOT = { is_researching_technology = ${t} } }
${T}${T}${T}${T}debug_log = "PMR_FORCE_PRE|${name}|${t}|${pc(t)}|d=${date}"
${T}${T}${T}${T}while = { limit = { NOT = { ${hp(t, COARSE_TO)} } }  add_technology_progress = { progress = ${coarse}  technology = ${t} } }
${T}${T}${T}${T}while = { limit = { NOT = { ${hp(t, FB.threshold)} } }  add_technology_progress = { progress = ${fine}  technology = ${t} } }
${T}${T}${T}${T}debug_log = "PMR_FORCE|${name}|${t}|${pc(t)}|cur=[THIS.GetCountry.GetCurrentlyResearchedTechnology.GetName]|d=${date}"
${T}${T}${T}}`).join('\n');
  write('common/on_actions/zzz_pm_rehaul_finish_test.txt',
`# AUTO-GENERATED by tools/emit_tech_finish.mjs (finish_boost.force_test) - do not edit by hand. PROBE BUILDS ONLY.
# Registered with \`on_actions = { }\`, never a second \`effect\` (landmine L22: effects do not merge across files).
on_monthly_pulse_country = {
${T}on_actions = {
${T}${T}pmr_finish_test_force
${T}}
}
on_research_technology_started = {
${T}on_actions = {
${T}${T}pmr_finish_test_pick
${T}}
}

# once per country, in the window: push one technology into [${FB.threshold}, 1) of its cost
pmr_finish_test_force = {
${T}effect = {
${T}${T}if = {
${T}${T}${T}limit = { NOT = { has_variable = pmr_ft_done }  game_date >= ${ft.from}  game_date < ${ft.to} }
${T}${T}${T}set_variable = pmr_ft_done
${branches}
${T}${T}${T}else = { debug_log = "PMR_FORCE_NONE|${name}|d=${date}" }
${T}${T}}
${T}}
}

# every research choice, the chosen technology read two ways (the second from the country, as a fallback)
pmr_finish_test_pick = {
${T}effect = {
${T}${T}debug_log = "PMR_TPICK|[SCOPE.GetRootScope.GetCountry.GetNameNoFormatting]|[SCOPE.sTechnology('technology').GetNameNoFormatting]|d=${date}"
${T}${T}debug_log = "PMR_TPICK2|${name}|[THIS.GetCountry.GetCurrentlyResearchedTechnology.GetName]|d=${date}"
${T}}
}
`);
  console.log(`tech finish: FORCE TEST ON (probe build) - ${ft.techs.length} candidate technologies, window ${ft.from}..${ft.to}, steps ${coarse} to ${COARSE_TO} then ${fine} to ${FB.threshold}`);
}
