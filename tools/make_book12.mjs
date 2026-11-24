// THE MOD 1.2 BOOK — the canon's recorded chain (tools/replay_canon_chain.mjs, then the 1.15 steps of the 1.1.1 canon) with the 1.2
// rulings carried through it, every intermediate book under a prefix so nothing existing is touched.
//
//   node tools/make_book12.mjs [--prefix m12] [--name m12-first] [--naval-lowered 0.8] [--tech-pass 1]
//        [--A 2.2] [--craft-cost-div 50] [--deposit-cost-level 1] [--country-effects 1]
//
// --A, --craft-cost-div, --deposit-cost-level (BALANCE_FRAMEWORK §10.132, ruled 2026-11-23; the defaults regenerate every earlier book):
//   the output step per tier (make_ab_config --A; the canon 2.2, the book g1152-canon12b 2.35), the craft rule's cost divisor
//   (make_artisan_config --cost-div; 50, then 10: a craft at 30 points) and the level on every derived deposit cost (make_deposit_config
//   --cost-level; 1, then 0.75: the five mines and gold 300 / 300 / 390 / 507, fishing and whaling 150 / 150 / 195, oil's own 200 / 200 kept).
//
// --tech-pass 1: the mod 1.2 technology pass (BALANCE_FRAMEWORK §10.129, §10.130, ruled 2026-11-22 after F286 and F287); off by default, so
// m12b-first and m12c-first regenerate from their recorded commands. It carries:
//   - the research-entry references the 1.2 book broke: railways on the coal and iron engine-pump rungs, flash freezing on the steam trawler
//     and steam whaling rungs (`min_tier` on an industries source), no entry for navigation (its only source needed navigation itself),
//     combustion engine on the motor's Compound Engines rung or its Electric Engines rung (two sources, never summed) beside the first oil rung;
//   - pumpjacks ← steam donkey + rotary valve engine, dynamite dropped (`make_tier4_techs.mjs --prereq-swap pumping-engines`);
//   - mining workers as a source for nitroglycerin (150,000) and dynamite (250,000) (`merge: true` extra entries);
//   - the financial-district entries held, 40 / 60 / 80 / 100 levels → 100 / 150 / 400 / 700, their follower mark a quarter; macroeconomics
//     on 200 administration levels (from 30), its follower mark the usual half (a quarter at --tech-pass 2);
//   - the research marks of arms, artillery and munition at × 0.25 (from × 0.5; explosives and synthetics stay × 0.5);
//   - shift work's AI research weight × 1.2 (`tech_ai_weight_bespoke`);
//   - `research_events.require_live_sources`: a research source that cannot exist fails the build from this book on (landmine L56).
// --tech-pass 2 (§10.131, 2026-11-22; the 1.2 canon): all of the above, and the administration and urban-centre entries held, every held
//   entry's follower mark a quarter: identification documents 18 -> 90 administration levels, mass surveillance 30 -> 220, macroeconomics
//   200 (follower 50), elevator 80 -> 130 levels of the largest urban centre, paved roads 160 -> 310.
//
// --name <major>.<minor>.d<n>[.<m>] (the debug build numbering, BALANCE_FRAMEWORK §10.134; the user decides the number): the book carries it as
//   `_debug_version`, and its debug builds show it in the mod's name and the init marker.
// --country-effects 1 (found 2026-11-24, FINDINGS F296; off by default, so every earlier book regenerates): the tiered deposits carry their
//   vanilla methods' country effects — gold's minting, 500 a level on every rung (§10.133; make_deposit_config --country-effects).
//
// --naval-lowered: the standing multiply on a technology with a NAVAL research entry (`entry_weight_rule.naval_lowered`). The default
// 0.8 is the rule `m12b-first` was built with (its recorded command has no flag and still reproduces it); since BALANCE_FRAMEWORK §10.127
// (2026-11-22) the ruled value is 1 — no standing penalty, only the -50% while the entry ticks — so a book after m12b-first passes
// `--naval-lowered 1`.
//
// What differs from the canon's chain, each with its ruling (BALANCE_FRAMEWORK; NEXT_BOOK_SPEC.md is the build order):
//   - the motor ladder: t0 Steam Engines, t1 Compound Engines on pumpjacks (shown as "Pumping Engines"), t2 Electric, t3 Diesel — the
//     structure's `--insert motor` in place of `--derive motor` (§10.116 ruling 4, §10.116.2);
//   - cost slope C 2.0 (§10.117) and the manufacturing AI desire ladder 455 / 1000 / 2200 / 4840 (§10.124 item 9);
//   - the quarter: Electric Engines' electricity and Diesel Engines' oil at a quarter of vanilla's in the mix (§10.116 ruling 3);
//     the engines' own lift stays 1.0 (`--in0-for motor:1`, §10.124 item 5);
//   - the tiered deposits, cost step 1.3 (§10.115, §10.124, §10.125) — make_deposit_config.mjs; since 2026-11-21 without logging and with
//     the 1836 pair (`--start-1836 pair`, §10.126), first built as `--prefix m12b` (m12-first, the book before it, keeps its record but no
//     longer regenerates: its chain had logging in DEPOSITS and no start rule);
//   - the book fields the emitters read: the higher tier's research mark (§10.119 item 6a, `research_events.mark_rule`), the AI research
//     weight rule −20% / −50% with the ticking signal (§10.119 item 3, `entry_weight_rule`), tier-scaled secondary lines and craft lines
//     (§10.119 item 2, `secondary_sizing`), the power lines' engines (§10.116 ruling 8, `power_lines_engines`), the two craft seeding fixes
//     (§10.119 item 7, `craft_seed_fixes`), the same-acre steps on the world's technology and irrigation's two drives (§10.124 items 1 and 3,
//     `agri_steps`);
//   - the AI research weights step LAST (§10.111.3: 1.13.11's weights on every technology with a research entry), on a build of the book
//     before it, because the deposit rungs and Compound Engines give technologies new entries.
// Writes config/mod_config.<name>.json + its tree twin.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(REPO);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const P = opt('--prefix', 'm12'); if (!/^[a-z0-9]+$/.test(P)) throw new Error('--prefix <lowercase letters/digits>');
const NAME = opt('--name', `${P}-first`);
const NAVAL_LOWERED = +opt('--naval-lowered', '0.8');
const TECH_PASS_LEVEL = +opt('--tech-pass', '0'); if (![0, 1, 2].includes(TECH_PASS_LEVEL)) throw new Error('--tech-pass 0 | 1 | 2');
const TECH_PASS = TECH_PASS_LEVEL >= 1;
const A_STEP = opt('--A', '2.2'), CRAFT_DIV = opt('--craft-cost-div', '50'), DEP_LEVEL = opt('--deposit-cost-level', '1'), EFFECTS = opt('--country-effects', '0');
if (!['0', '1'].includes(EFFECTS)) throw new Error('--country-effects 0 | 1');
if (!(+A_STEP > 1)) throw new Error('--A <the output step per tier, > 1>');
if (!(+CRAFT_DIV >= 1)) throw new Error('--craft-cost-div <n >= 1>');
if (!(+DEP_LEVEL > 0 && +DEP_LEVEL <= 2)) throw new Error('--deposit-cost-level <L in (0, 2]>');
const A_SET = +A_STEP !== 2.2, CRAFT_SET = +CRAFT_DIV !== 50, DEP_SET = +DEP_LEVEL !== 1;
if (!(NAVAL_LOWERED > 0 && NAVAL_LOWERED <= 1)) throw new Error('--naval-lowered <a multiplier in (0, 1]>');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const SNAP_OLD = 'C:/claude-code/vic3_game_1.13.11/game';
const gameVersion = (() => { try { return JSON.parse(readFileSync(join(GAME, '..', 'launcher', 'launcher-settings.json'), 'utf8')).rawVersion; } catch { return 'unknown'; } })();
const SNAP_NOW = `C:/claude-code/vic3_game_${gameVersion}/game`;
if (!existsSync(SNAP_NOW)) throw new Error(`no snapshot of the installed game ${gameVersion} at ${SNAP_NOW} (the AI-weights step reads it)`);
const run = (args, extraEnv = {}) => {
  console.log('\n$ ' + args.join(' '));
  const out = execFileSync('node', args, { env: { ...process.env, ...extraEnv }, encoding: 'utf8', maxBuffer: 1 << 28 });
  console.log(out.split('\n').filter(Boolean).slice(-3).join('\n'));
};
const b = s => `config/mod_config.${P}-${s}.json`;
const T4 = `${P}-tier4`;

// ---- the canon's chain, with the 1.2 structure, slope, desire and the quarter ------------------------------------------------------------
run(['tools/make_tier4_config.mjs', '--insert', 'motor'], { TIER4_SUFFIX: T4 });
run(['tools/make_tier4_techs.mjs', ...(TECH_PASS ? ['--prereq-swap', 'pumping-engines'] : [])], { TIER4_SUFFIX: T4 });
run(['tools/make_ab_config.mjs', '--base', `config/mod_config.${T4}.json`, '--A', A_STEP, '--B', '1.64', '--in0', '1.2', '--cost-ratio', '2.0',
  '--in0-for', 'motor:1', '--divisor', '0.000125', '--anchor-cost', '--ai-ladder', '455,1000,2200,4840', '--ai-defines',
  'MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR=0.95,MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD=1.0,MONEY_SPENDING_CONSTRUCTION_EXCESSIVE_THRESHOLD=2.0,CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED=0.1,PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD=160,PRODUCTION_BUILDING_VERY_LONG_CONSTRUCTION_TIME_THRESHOLD=240',
  '--bar-months', '24', '--anchor-for', 'food:1,textile:1,furniture:1,glass:1,tooling:1,paper:1,fertilizer:1,explosives:1,steel:1,motor:1,automotive:1,arms:1,artillery:1,munition:1,synthetics:1,electrics:1,art_academy:1',
  '--down-step', '1.5', '--in1-pop', '1.2', '--mix-scale', 'pm_electric_engines:electricity:0.25,pm_diesel_engines:oil:0.25', '--suffix', `${P}-ab`,
  '--variant', `${P}-ab|the canon's A/B book (e1a12-ai1135-m10ac)|BALANCE_FRAMEWORK 10.116, 10.117, 10.124 (the mod 1.2 book)|C 2.0, the desire ladder 455/1000/2200/4840, the motor insertion (Compound Engines) and the quarter${A_SET ? `; A ${A_STEP} (BALANCE_FRAMEWORK 10.132)` : ''}`]);
run(['tools/make_trade_config.mjs', '--base', b('ab'), '--suffix', `${P}-trade`, '--ruled-by', 'user 2026-10-01: the e1-anchor book on the canon\'s trade table (x1)']);
run(['tools/make_dam_config.mjs', '--base', b('trade'), '--suffix', `${P}-dams`]);
{ const f = b('dams'); const j = JSON.parse(readFileSync(f, 'utf8'));
  j.dams.rules = 'family'; delete j.dams.log_levels;
  j._dams_family = 'dams.rules = family, as the canon (canon-dams-family-nolog: BALANCE_FRAMEWORK 10.89.12); no monthly dam log (the canon dropped it 2026-09-29)';
  writeFileSync(f, JSON.stringify(j)); console.log(`\n(hand) ${f}: dams.rules = family, log_levels dropped`); }
run(['tools/make_artisan_config.mjs', '--base', b('dams'), '--suffix', `${P}-art`, '--staffing', 'pb', '--hire-floor', '2', '--craft-rule', '0.6,0.89', '--seed', '5', '--craft-ai', '800', ...(CRAFT_SET ? ['--cost-div', CRAFT_DIV] : [])]);
run(['tools/make_merge_config.mjs', '--base', b('art'), '--suffix', `${P}-merge`, '--host-cost', 'textile:own', '--ai-rule', 'cond']);
run(['tools/make_research_extra_config.mjs', '--base', b('merge'), '--suffix', `${P}-jex`]);
run(['tools/make_dam4_config.mjs', '--base', `${P}-jex`, '--suffix', `${P}-dam4`, '--script-placement']);
run(['tools/make_research_levers_config.mjs', '--base', b('dam4'), '--suffix', `${P}-rl`, '--innov-x', '25']);
run(['tools/make_research_rework_config.mjs', '--base', b('rl'), '--suffix', `${P}-rb`]);
run(['tools/make_research_society_config.mjs', '--base', b('rb'), '--suffix', `${P}-rs`]);
// the canon's hand steps, copied from the 1.0 canon exactly as tools/replay_canon_chain.mjs copies them
{
  const HAND_FROM = 'config/mod_config.jex-dam4s-rs-x25-m10ac-dpriv-wm99.json';
  const canon = JSON.parse(readFileSync(HAND_FROM, 'utf8'));
  const j = JSON.parse(readFileSync(b('rs'), 'utf8'));
  j.dams.private = canon.dams.private;
  for (const [t, v] of Object.entries(canon.dams.effects.traits)) { if (!j.dams.effects.traits[t]) throw new Error(`dam trait ${t} missing`); j.dams.effects.traits[t].desc = v.desc; }
  for (const k of ['building_subsidies', 'game_defines', 'secondary_goods_override', 'vanilla_value_overrides']) j[k] = canon[k];
  const RE = j.research_events, CR = canon.research_events;
  for (const e of ['modern_sewerage', 'organized_sports', 'elevator', 'paved_roads'])
    for (const f of ['trigger', 'half_trigger']) RE.condition_entries[e][f] = CR.condition_entries[e][f];
  RE.condition_values.pmr_cv_urban = CR.condition_values.pmr_cv_urban;
  RE.count_display.pmr_cv_urban = CR.count_display.pmr_cv_urban;
  RE.marks_whole_levels = CR.marks_whole_levels;
  if (j._canon) { j._canon_canon4v_hai3_inherited = j._canon; delete j._canon; }
  for (const r of ['_dam_private_variant', '_canon_2026_10_16', '_wm99_variant', '_polish_2026_10_21', '_polish_2026_10_21b', '_polish_2026_10_26_proofread', '_polish_2026_10_27']) j[r] = canon[r];
  writeFileSync(b('c'), JSON.stringify(j));
  writeFileSync(`config/tech_tree_options.${P}-c.json`, readFileSync(`config/tech_tree_options.${P}-rs.json`));
  console.log(`\n(hand) ${b('c')}: the canon's hand steps (from ${HAND_FROM})`);
}
// the 1.15 steps of the 1.1.1 canon (their recorded commands)
run(['tools/make_variant_config.mjs', '--base', b('c'), '--suffix', `${P}-bz`]);
run(['tools/make_dam_inputs_config.mjs', '--base', b('bz'), '--suffix', `${P}-dcu`, '--inputs', 'tools:1,engines:0.5,copper:0.75']);
run(['tools/make_value_overrides_config.mjs', '--base', b('dcu'), '--suffix', `${P}-ra`, '--set', 'g115-research-adds']);
run(['tools/make_research_conditions_config.mjs', '--base', b('ra'), '--suffix', `${P}-il`, '--set', 'g115-idea-laws']);
// ---- the 1.2 additions --------------------------------------------------------------------------------------------------------------
run(['tools/make_deposit_config.mjs', '--base', b('il'), '--suffix', `${P}-dep`, '--cost-step', '1.3', '--start-1836', 'pair', ...(DEP_SET ? ['--cost-level', DEP_LEVEL] : []), ...(EFFECTS === '1' ? ['--country-effects', '1'] : [])]);
{
  const j = JSON.parse(readFileSync(b('dep'), 'utf8'));
  // the same-acre steps on the world's technology: every vanilla method of the four named steps (§10.124 item 1), read from the game
  const strip = s => s.replace(/^\uFEFF/, '');
  const pmKeys = []; for (const f of readdirSync(join(GAME, 'common/production_methods'))) for (const m of strip(readFileSync(join(GAME, 'common/production_methods', f), 'utf8')).matchAll(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{/gm)) pmKeys.push(m[1]);
  const irrigation = pmKeys.filter(k => /^automatic_irrigation_building_/.test(k)).sort();
  // + the untiered logging camp's electric saw mills (tech era 4), so a foreign timber concession is not held to the locals' methods
  //   (§10.126 ruling 5, the user 2026-11-21)
  const worldGate = [...pmKeys.filter(k => /^(pm_fertilization|pm_chemical_fertilizer|pm_mechanized_slaughtering)(_building_[a-z_]+)?$/.test(k)).sort(), ...irrigation, 'pm_electric_saw_mills'];
  if (irrigation.length < 8) throw new Error(`only ${irrigation.length} automatic irrigation methods found`);
  if (!pmKeys.includes('pm_electric_saw_mills')) throw new Error('pm_electric_saw_mills not found in the game');
  j.research_events.mark_rule = 'higher';
  j.research_events.entry_weight_rule = { lowered: 0.8, advancing: 0.5, signal: 'tick' };
  if (NAVAL_LOWERED !== 0.8) j.research_events.entry_weight_rule.naval_lowered = NAVAL_LOWERED;   // §10.127 (absent = the 0.8 m12b-first carries)
  j.secondary_sizing = 'tier';
  j.power_lines_engines = true;
  j.craft_seed_fixes = true;
  j.agri_steps = { world_gate: worldGate,
    irrigation: { methods: irrigation, steam_coal_per_engine: 1, diesel: { engines_mult: 0.5, oil_value_of_steam_coal: 0.5, tech: 'compression_ignition', name: 'Diesel Pump Irrigation' } } };
  // ---- the technology pass (§10.129, §10.130) -----------------------------------------------------------------------------------------
  let techPass = null;
  if (TECH_PASS) {
    const RE = j.research_events; const X = RE.extra_entries; const C = RE.condition_entries;
    const need = (o, k, what) => { if (!o || o[k] == null) throw new Error(`tech pass: ${what} has no '${k}' - the chain moved, re-rule before building`); return o[k]; };
    // 1. the references the tiered deposits and the motor ladder broke (F287 §1)
    need(X, 'railways', 'extra_entries').sources = [{ industries: ['coal_mine', 'iron_mine'], min_tier: 1, label: 'Coal Mines and Iron Mines (Tier 1 and later)' }];
    need(X, 'flash_freezing', 'extra_entries').sources = [{ industries: ['fishing_wharf', 'whaling_station'], min_tier: 2, label: 'Fishing Wharves and Whaling Stations (Tier 2)' }];
    if ((RE.exclude_techs || []).includes('navigation')) throw new Error('tech pass: navigation is already excluded');
    RE.exclude_techs = [...(RE.exclude_techs || []), 'navigation'];
    need(RE.necessity_anchors, 'automotive', 'necessity_anchors');
    // two sources, each at its own mark, as every rung anchor is (the user, 2026-11-22: "We usually don't go into sums"); the Diesel rung,
    //   which needs combustion engine itself, is left out
    RE.necessity_anchors.automotive = ['building_motor_industry_compound_engines', 'building_motor_industry_electric_engines'];
    // from this book on a source that cannot exist FAILS the build (tools/lint_research_sources.mjs, landmine L56)
    RE.require_live_sources = true;
    // 2. mining workers: the explosives' customers (§10.129 item 2)
    const mines = ['coal_mine', 'iron_mine', 'lead_mine', 'sulfur_mine', 'copper_mine', 'gold_mine'];
    for (const m of mines) if (!j.industries.some(i => i.id === m && i.deposit && !i.disabled)) throw new Error(`tech pass: '${m}' is not a tiered deposit of this book`);
    for (const [t, mark] of [['nitroglycerin', 150000], ['dynamite', 250000]]) { if (X[t]) throw new Error(`tech pass: extra_entries already has ${t}`);
      X[t] = { merge: true, sources: [{ industries: mines, label: 'Mines of every kind (every tier)' }], mark }; }
    // 3. the entries that ran ahead, held; the financial ones' follower mark a quarter (§10.129 item 3, §10.130)
    const FIN = { 40: 100, 60: 150, 80: 400, 100: 700 }; const held = [];
    for (const [k, e] of Object.entries(C)) { const m = /^pmr_cv_fin >= (\d+)\b/.exec(e.trigger || ''); if (!m) continue;
      const to = FIN[m[1]]; if (!to) throw new Error(`tech pass: ${k} sits on ${m[1]} financial-district levels, which the ruling does not name`);
      const q = Math.ceil(to / 4); const hm = /^pmr_cv_fin >= (\d+)\b/.exec(e.half_trigger || ''); if (!hm) throw new Error(`tech pass: ${k} has no follower mark`);
      if (!e.label.includes(`at least ${m[1]} levels`)) throw new Error(`tech pass: ${k}'s label does not state its mark`);
      e.trigger = e.trigger.replace(m[0], `pmr_cv_fin >= ${to}`); e.half_trigger = e.half_trigger.replace(hm[0], `pmr_cv_fin >= ${q}`); e.label = e.label.replace(`at least ${m[1]} levels`, `at least ${to} levels`);
      held.push(`${k} ${m[1]} -> ${to} (follower ${q})`); }
    if (held.length !== 9) throw new Error(`tech pass: ${held.length} financial entries found, 9 expected`);
    { const e = need(C, 'macroeconomics', 'condition_entries'); if (e.trigger !== 'pmr_cv_gov >= 30' || e.half_trigger !== 'pmr_cv_gov >= 15') throw new Error('tech pass: macroeconomics is not on 30 / 15 administration levels');
      e.trigger = 'pmr_cv_gov >= 200'; e.half_trigger = 'pmr_cv_gov >= 100'; e.label = e.label.replace('at least 30 ', 'at least 200 '); held.push('macroeconomics 30 -> 200 administration levels (follower 100)'); }
    // 3b. --tech-pass 2: the administration and urban-centre entries held too, every held entry's follower a quarter (§10.131, the user,
    //     2026-11-22: "macroeconomics, as well as other gov admins and autoscaling-based JEs, do need a huge increase ... for these techs,
    //     the ruled followers discount to the threshold is -75%"). The marks are the builder's (§10.131), set so the 2nd-3rd largest
    //     administration of the m12b-first runs reaches them near the tier anchor; the urban ones estimated from the half-majors path.
    if (TECH_PASS_LEVEL >= 2) {
      const HOLD = { identification_documents: ['pmr_cv_gov', 18, 90], mass_surveillance: ['pmr_cv_gov', 30, 220], macroeconomics: ['pmr_cv_gov', 200, 200],
        elevator: ['pmr_cv_urban', 80, 130], paved_roads: ['pmr_cv_urban', 160, 310] };
      for (const [k, [cv, from, to]] of Object.entries(HOLD)) { const e = need(C, k, 'condition_entries');
        if (e.trigger !== `${cv} >= ${from}`) throw new Error(`tech pass 2: ${k} is not on ${cv} >= ${from} (${e.trigger})`);
        if (!/^pmr_cv_[a-z]+ >= \d+$/.test(e.half_trigger || '')) throw new Error(`tech pass 2: ${k} has no plain follower mark`);
        const q = Math.ceil(to / 4); e.trigger = `${cv} >= ${to}`; e.half_trigger = `${cv} >= ${q}`;
        if (from !== to) { const lbl = e.label.replace(`at least ${from} `, `at least ${to} `).replace(`: ${from} levels`, `: ${to} levels`);
          if (lbl === e.label) throw new Error(`tech pass 2: ${k}'s label does not state its mark`); e.label = lbl; }
        held.push(`${k} ${from} -> ${to} (follower ${q})`); }
    }
    // 4. the military industries' marks (§10.130)
    for (const k of ['arms', 'artillery', 'munition']) { if (RE.threshold_mult[k] !== 0.5) throw new Error(`tech pass: threshold_mult.${k} is not 0.5`); RE.threshold_mult[k] = 0.25; }
    // 5. shift work: no entry, a bespoke AI research weight (§10.130)
    j.tech_ai_weight_bespoke = { shift_work: 1.2 };
    techPass = { ruled: '2026-11-22, BALANCE_FRAMEWORK §10.129 and §10.130 (after F286, F287)',
      references: 'railways -> coal and iron mines, tier 1 and later; flash_freezing -> fishing wharves and whaling stations, tier 2; navigation excluded; automotive necessity anchor -> the motor\'s Compound Engines rung, or its Electric Engines rung (two sources)',
      prerequisite: 'pumpjacks <- steam_donkey + rotary_valve_engine (dynamite dropped; lib_tier4_spec PREREQ_SWAPS pumping-engines)',
      mining_sources: 'nitroglycerin 150000, dynamite 250000 workers in the six tiered mines (merge)', held, threshold_mult: 'arms, artillery, munition 0.5 -> 0.25',
      tech_ai_weight_bespoke: 'shift_work 1.2' };
    if (TECH_PASS_LEVEL >= 2) techPass.level2 = 'the administration and urban-centre entries held, every held follower a quarter (§10.131, ruled 2026-11-22)';
    j._tech_pass = techPass;
  }
  if (/^\d+\.\d+\.d\d+(\.\d+)?$/.test(NAME)) j._debug_version = NAME;
  j._book12 = { name: NAME, game_version: gameVersion, generated: new Date().toISOString(), command: 'node tools/make_book12.mjs ' + argv.join(' '),
    rulings: {
      'motor ladder (insert motor)': '§10.116 ruling 4, §10.116.2 (Compound Engines on pumpjacks, shown as Pumping Engines)',
      'C 2.0': '§10.117', 'AI desire 455/1000/2200/4840': '§10.124 item 9', 'the quarter (mix-scale)': '§10.116 ruling 3', 'engines lift 1.0': '§10.124 item 5',
      'tiered deposits, cost step 1.3': '§10.115, §10.124 items 2/6/7/9, §10.125',
      'logging not a deposit; the 1836 pair (start_1836 pair); electric saw mills on the world gate': '§10.126',
      'research_events.mark_rule higher': '§10.119 item 6a', 'research_events.entry_weight_rule 0.8 / 0.5, tick': '§10.119 item 3 (ruled 2026-11-21)',
      'secondary_sizing tier': '§10.119 item 2', 'power_lines_engines': '§10.116 ruling 8', 'craft_seed_fixes': '§10.119 item 7',
      'agri_steps': '§10.124 items 1 and 3; §10.116.1',
      ...(NAVAL_LOWERED !== 0.8 ? { [`research_events.entry_weight_rule.naval_lowered ${NAVAL_LOWERED}`]: '§10.127 (ruled 2026-11-22)' } : {}),
      ...(TECH_PASS ? { 'the technology pass (_tech_pass)': '§10.129, §10.130 (ruled 2026-11-22)' } : {}),
      ...(TECH_PASS_LEVEL >= 2 ? { 'the administration and urban-centre holds, followers a quarter': '§10.131 (ruled 2026-11-22)' } : {}),
      ...(A_SET ? { [`A ${A_STEP}`]: '§10.132 item 8 (ruled 2026-11-23)' } : {}),
      ...(CRAFT_SET ? { [`craft cost divisor ${CRAFT_DIV}`]: '§10.132 item 5 (ruled 2026-11-23)' } : {}),
      ...(DEP_SET ? { [`deposit cost level ${DEP_LEVEL} (every derived deposit cost; oil's own list kept)`]: '§10.132 items 1, 4 and 6 (ruled 2026-11-23)' } : {}) } };
  writeFileSync(b('pre'), JSON.stringify(j));
  writeFileSync(`config/tech_tree_options.${P}-pre.json`, readFileSync(`config/tech_tree_options.${P}-dep.json`));
  console.log(`\n(hand) ${b('pre')}: the 1.2 book fields (mark rule, weight rule, tier-scaled lines, engines on the power lines, craft fixes, ${worldGate.length} world-gated methods, ${irrigation.length} irrigation drives)`);
}
// ---- the AI research weights LAST, on a build of the book before it -------------------------------------------------------------------
{
  const modName = `${P}pre`;
  console.log(`\n$ build.ps1 -SaveTo ${modName} -Config ${b('pre')} -NoDeploy`);
  execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'tools\\build.ps1', '-SaveTo', modName, '-Config', b('pre'), '-NoDeploy'], { stdio: 'inherit' });
  run(['tools/make_tech_ai_weights_config.mjs', '--base', b('pre'), '--suffix', NAME, '--old-game', SNAP_OLD, '--game', SNAP_NOW,
    '--keep', 'central_archives,egalitarianism,general_staff,nationalism,rifling', '--mod', `mod_${modName}`]);
}
console.log(`\nTHE MOD 1.2 BOOK: config/mod_config.${NAME}.json + config/tech_tree_options.${NAME}.json (game ${gameVersion})`);
