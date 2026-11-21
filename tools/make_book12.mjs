// THE MOD 1.2 BOOK — the canon's recorded chain (tools/replay_canon_chain.mjs, then the 1.15 steps of the 1.1.1 canon) with the 1.2
// rulings carried through it, every intermediate book under a prefix so nothing existing is touched.
//
//   node tools/make_book12.mjs [--prefix m12] [--name m12-first]
//
// What differs from the canon's chain, each with its ruling (BALANCE_FRAMEWORK; NEXT_BOOK_SPEC.md is the build order):
//   - the motor ladder: t0 Steam Engines, t1 Compound Engines on pumpjacks (shown as "Pumping Engines"), t2 Electric, t3 Diesel — the
//     structure's `--insert motor` in place of `--derive motor` (§10.116 ruling 4, §10.116.2);
//   - cost slope C 2.0 (§10.117) and the manufacturing AI desire ladder 455 / 1000 / 2200 / 4840 (§10.124 item 9);
//   - the quarter: Electric Engines' electricity and Diesel Engines' oil at a quarter of vanilla's in the mix (§10.116 ruling 3);
//     the engines' own lift stays 1.0 (`--in0-for motor:1`, §10.124 item 5);
//   - the tiered deposits, cost step 1.3 (§10.115, §10.124, §10.125) — make_deposit_config.mjs;
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
run(['tools/make_tier4_techs.mjs'], { TIER4_SUFFIX: T4 });
run(['tools/make_ab_config.mjs', '--base', `config/mod_config.${T4}.json`, '--A', '2.2', '--B', '1.64', '--in0', '1.2', '--cost-ratio', '2.0',
  '--in0-for', 'motor:1', '--divisor', '0.000125', '--anchor-cost', '--ai-ladder', '455,1000,2200,4840', '--ai-defines',
  'MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR=0.95,MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD=1.0,MONEY_SPENDING_CONSTRUCTION_EXCESSIVE_THRESHOLD=2.0,CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED=0.1,PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD=160,PRODUCTION_BUILDING_VERY_LONG_CONSTRUCTION_TIME_THRESHOLD=240',
  '--bar-months', '24', '--anchor-for', 'food:1,textile:1,furniture:1,glass:1,tooling:1,paper:1,fertilizer:1,explosives:1,steel:1,motor:1,automotive:1,arms:1,artillery:1,munition:1,synthetics:1,electrics:1,art_academy:1',
  '--down-step', '1.5', '--in1-pop', '1.2', '--mix-scale', 'pm_electric_engines:electricity:0.25,pm_diesel_engines:oil:0.25', '--suffix', `${P}-ab`,
  '--variant', `${P}-ab|the canon's A/B book (e1a12-ai1135-m10ac)|BALANCE_FRAMEWORK 10.116, 10.117, 10.124 (the mod 1.2 book)|C 2.0, the desire ladder 455/1000/2200/4840, the motor insertion (Compound Engines) and the quarter`]);
run(['tools/make_trade_config.mjs', '--base', b('ab'), '--suffix', `${P}-trade`, '--ruled-by', 'user 2026-10-01: the e1-anchor book on the canon\'s trade table (x1)']);
run(['tools/make_dam_config.mjs', '--base', b('trade'), '--suffix', `${P}-dams`]);
{ const f = b('dams'); const j = JSON.parse(readFileSync(f, 'utf8'));
  j.dams.rules = 'family'; delete j.dams.log_levels;
  j._dams_family = 'dams.rules = family, as the canon (canon-dams-family-nolog: BALANCE_FRAMEWORK 10.89.12); no monthly dam log (the canon dropped it 2026-09-29)';
  writeFileSync(f, JSON.stringify(j)); console.log(`\n(hand) ${f}: dams.rules = family, log_levels dropped`); }
run(['tools/make_artisan_config.mjs', '--base', b('dams'), '--suffix', `${P}-art`, '--staffing', 'pb', '--hire-floor', '2', '--craft-rule', '0.6,0.89', '--seed', '5', '--craft-ai', '800']);
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
run(['tools/make_deposit_config.mjs', '--base', b('il'), '--suffix', `${P}-dep`, '--cost-step', '1.3']);
{
  const j = JSON.parse(readFileSync(b('dep'), 'utf8'));
  // the same-acre steps on the world's technology: every vanilla method of the four named steps (§10.124 item 1), read from the game
  const strip = s => s.replace(/^\uFEFF/, '');
  const pmKeys = []; for (const f of readdirSync(join(GAME, 'common/production_methods'))) for (const m of strip(readFileSync(join(GAME, 'common/production_methods', f), 'utf8')).matchAll(/^([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{/gm)) pmKeys.push(m[1]);
  const irrigation = pmKeys.filter(k => /^automatic_irrigation_building_/.test(k)).sort();
  const worldGate = [...pmKeys.filter(k => /^(pm_fertilization|pm_chemical_fertilizer|pm_mechanized_slaughtering)(_building_[a-z_]+)?$/.test(k)).sort(), ...irrigation];
  if (irrigation.length < 8) throw new Error(`only ${irrigation.length} automatic irrigation methods found`);
  j.research_events.mark_rule = 'higher';
  j.research_events.entry_weight_rule = { lowered: 0.8, advancing: 0.5, signal: 'tick' };
  j.secondary_sizing = 'tier';
  j.power_lines_engines = true;
  j.craft_seed_fixes = true;
  j.agri_steps = { world_gate: worldGate,
    irrigation: { methods: irrigation, steam_coal_per_engine: 1, diesel: { engines_mult: 0.5, oil_value_of_steam_coal: 0.5, tech: 'compression_ignition', name: 'Diesel Pump Irrigation' } } };
  j._book12 = { name: NAME, game_version: gameVersion, generated: new Date().toISOString(), command: 'node tools/make_book12.mjs ' + argv.join(' '),
    rulings: {
      'motor ladder (insert motor)': '§10.116 ruling 4, §10.116.2 (Compound Engines on pumpjacks, shown as Pumping Engines)',
      'C 2.0': '§10.117', 'AI desire 455/1000/2200/4840': '§10.124 item 9', 'the quarter (mix-scale)': '§10.116 ruling 3', 'engines lift 1.0': '§10.124 item 5',
      'tiered deposits, cost step 1.3': '§10.115, §10.124 items 2/6/7/9, §10.125',
      'research_events.mark_rule higher': '§10.119 item 6a', 'research_events.entry_weight_rule 0.8 / 0.5, tick': '§10.119 item 3 (ruled 2026-11-21)',
      'secondary_sizing tier': '§10.119 item 2', 'power_lines_engines': '§10.116 ruling 8', 'craft_seed_fixes': '§10.119 item 7',
      'agri_steps': '§10.124 items 1 and 3; §10.116.1' } };
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
