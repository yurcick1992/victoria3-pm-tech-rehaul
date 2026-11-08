// THE CANON'S CHAIN, REPLAYED — re-runs every maker the canon was built by (its records: `_ab.command`, the `_*_variant` records;
// CLAUDE.md §4.4), against a chosen game folder, every book under a prefixed suffix so no existing book is touched; then applies
// the canon's HAND STEPS, copied from config/mod_config.json (their values are rulings, not game data).
//
//   node tools/replay_canon_chain.mjs --prefix r113 --game C:/claude-code/vic3_game_1.13.11/game   (the proof: reproduces the canon)
//   node tools/replay_canon_chain.mjs --prefix g115                                                 (the installed game)
//
// Writes config/mod_config.<prefix>-canon.json + its tree twin, in the canon's key order, with `_replay` (the command, the game
// version read from the launcher settings, the canon's sha256 prefix). The intermediate books are config/mod_config.<prefix>-*.json.
// ⭐ PROOF (2026-11-08): `--prefix r113` on the kept game 1.13.11 reproduces config/mod_config.json field for field
// (`node tools/book_diff.mjs config/mod_config.json config/mod_config.r113-canon.json --ignore _` → 0 differences); the tree twin
// differs only in its timestamp. Re-prove it whenever the canon or a maker changes: a replay that no longer reproduces the canon on
// the game it was built on carries the drift into every later version.
// Written for the game 1.15 update pass (GAME_UPDATE_1_15.md): a new game version changes the vanilla methods every rung is derived
// from, and the replay carries every change through the formula (copper in five rungs on 1.15).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const P = opt('--prefix'); if (!P || !/^[a-z0-9]+$/.test(P)) throw new Error('replay_canon_chain: --prefix <lowercase letters/digits> required');
const env = { ...process.env };
const game = opt('--game', null); if (game) env.VIC3_GAME = game;
const GAME = env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
let gameVersion = 'unknown';
try { const ls = JSON.parse(readFileSync(join(GAME, '..', 'launcher', 'launcher-settings.json'), 'utf8')); gameVersion = ls.version || ls.rawVersion; } catch {}
if (gameVersion === 'unknown' && existsSync(join(GAME, '..', 'SNAPSHOT.txt'))) gameVersion = readFileSync(join(GAME, '..', 'SNAPSHOT.txt'), 'utf8').replace(/^﻿/, '').split(/\r?\n/)[0];
const run = (args, extraEnv = {}) => {
  console.log('\n$ ' + args.join(' '));
  const out = execFileSync('node', args, { env: { ...env, ...extraEnv }, encoding: 'utf8', maxBuffer: 1 << 28 });
  console.log(out.split('\n').filter(Boolean).slice(-4).join('\n'));
};
const b = s => `config/mod_config.${P}-${s}.json`;
const T4 = `${P}-tier4-e1`;
run(['tools/make_tier4_config.mjs', '--derive', 'motor'], { TIER4_SUFFIX: T4 });
run(['tools/make_tier4_techs.mjs'], { TIER4_SUFFIX: T4 });
run(['tools/make_ab_config.mjs', '--base', `config/mod_config.${T4}.json`, '--A', '2.2', '--B', '1.64', '--in0', '1.2', '--cost-ratio', '1.9',
  '--in0-for', 'motor:1', '--divisor', '0.000125', '--anchor-cost', '--ai-ladder', '1000,1000,3000,5000', '--ai-defines',
  'MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR=0.95,MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD=1.0,MONEY_SPENDING_CONSTRUCTION_EXCESSIVE_THRESHOLD=2.0,CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED=0.1,PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD=160,PRODUCTION_BUILDING_VERY_LONG_CONSTRUCTION_TIME_THRESHOLD=240',
  '--bar-months', '24', '--anchor-for', 'food:1,textile:1,furniture:1,glass:1,tooling:1,paper:1,fertilizer:1,explosives:1,steel:1,motor:1,automotive:1,arms:1,artillery:1,munition:1,synthetics:1,electrics:1,art_academy:1',
  '--down-step', '1.5', '--in1-pop', '1.2', '--suffix', `${P}-e1a12-ai1135-m10ac`,
  '--variant', 'e1a12-ai1135-m10ac|e1a12-ai1135 (the arm\'s A/B book)|user 2026-10-16: the canon with engines unlifted; merge hosts\' desire conditional on the merged technology|as e1a12-ai1135 with --cost-ratio 1.9 --in0-for motor:1']);
run(['tools/make_trade_config.mjs', '--base', b('e1a12-ai1135-m10ac'), '--suffix', `${P}-e1a12-ai1135-trade-m10ac`, '--ruled-by', 'user 2026-10-01: the e1-anchor book on the canon\'s trade table (x1)']);
run(['tools/make_dam_config.mjs', '--base', b('e1a12-ai1135-trade-m10ac'), '--suffix', `${P}-e1a12-ai1135-dams-m10ac`]);
{ // the recorded hand step of the dam book (_dams_family): dams.rules = family, no monthly dam log
  const f = b('e1a12-ai1135-dams-m10ac'); const j = JSON.parse(readFileSync(f, 'utf8'));
  j.dams.rules = 'family'; delete j.dams.log_levels;
  j._dams_family = 'dams.rules = family, as the canon (canon-dams-family-nolog: BALANCE_FRAMEWORK 10.89.12); no monthly dam log (the canon dropped it 2026-09-29)';
  writeFileSync(f, JSON.stringify(j)); console.log(`\n(hand) ${f}: dams.rules = family, log_levels dropped`);
}
run(['tools/make_artisan_config.mjs', '--base', b('e1a12-ai1135-dams-m10ac'), '--suffix', `${P}-e1a12-ai1135-art-m10ac`, '--staffing', 'pb', '--hire-floor', '2', '--craft-rule', '0.6,0.89', '--seed', '5', '--craft-ai', '800']);
run(['tools/make_merge_config.mjs', '--base', b('e1a12-ai1135-art-m10ac'), '--suffix', `${P}-e1a12-ai1135-tex1140-artmerge-m10ac`, '--host-cost', 'textile:own', '--ai-rule', 'cond']);
run(['tools/make_research_extra_config.mjs', '--base', b('e1a12-ai1135-tex1140-artmerge-m10ac'), '--suffix', `${P}-e1a12-ai1135-tex1140-jex-artmerge-m10ac`]);
run(['tools/make_dam4_config.mjs', '--base', `${P}-e1a12-ai1135-tex1140-jex-artmerge-m10ac`, '--suffix', `${P}-jex-dam4s-m10ac`, '--script-placement']);
run(['tools/make_research_levers_config.mjs', '--base', b('jex-dam4s-m10ac'), '--suffix', `${P}-jex-dam4s-rl-x25-m10ac`, '--innov-x', '25']);
run(['tools/make_research_rework_config.mjs', '--base', b('jex-dam4s-rl-x25-m10ac'), '--suffix', `${P}-jex-dam4s-rb-x25-m10ac`]);
run(['tools/make_research_society_config.mjs', '--base', b('jex-dam4s-rb-x25-m10ac'), '--suffix', `${P}-jex-dam4s-rs-x25-m10ac`]);
console.log(`\nchain done: ${b('jex-dam4s-rs-x25-m10ac')}`);
// THE HAND STEPS, copied from the canon (the 1.13.11 proof showed these fields and no others):
//   dams.private = all (_dam_private_variant); the monopoly define (_wm99_variant); the 2026-10-21 polish (building_subsidies R2.3,
//   secondary_goods_override Q3, vanilla_value_overrides Q1, research_events.count_display / marks_whole_levels); the 2026-10-26 proofread
//   (three dam trait descriptions); the 2026-10-27 urban-centre script value (four condition entries, pmr_cv_urban) and the record rename.
// ⚠ game_defines and vanilla_value_overrides carry vanilla anchors of the version the canon was built on: a new game version owes them a
//   check against its own files (ON_GAME_UPDATE §1) — the replay copies the rulings, it does not re-read vanilla for them.
{
  const canonRaw = readFileSync('config/mod_config.json');
  const canon = JSON.parse(canonRaw.toString('utf8'));
  const j = JSON.parse(readFileSync(b('jex-dam4s-rs-x25-m10ac'), 'utf8'));
  j.dams.private = canon.dams.private;
  for (const [t, v] of Object.entries(canon.dams.effects.traits)) { if (!j.dams.effects.traits[t]) throw new Error(`replay_canon_chain: dam trait ${t} missing`); j.dams.effects.traits[t].desc = v.desc; }
  for (const k of ['building_subsidies', 'game_defines', 'secondary_goods_override', 'vanilla_value_overrides']) j[k] = canon[k];
  const RE = j.research_events, CR = canon.research_events;
  for (const e of ['modern_sewerage', 'organized_sports', 'elevator', 'paved_roads'])
    for (const f of ['trigger', 'half_trigger']) RE.condition_entries[e][f] = CR.condition_entries[e][f];
  RE.condition_values.pmr_cv_urban = CR.condition_values.pmr_cv_urban;
  RE.count_display.pmr_cv_urban = CR.count_display.pmr_cv_urban;
  RE.marks_whole_levels = CR.marks_whole_levels;
  if (j._canon) { j._canon_canon4v_hai3_inherited = j._canon; delete j._canon; }
  for (const r of ['_dam_private_variant', '_canon_2026_10_16', '_wm99_variant', '_polish_2026_10_21', '_polish_2026_10_21b', '_polish_2026_10_26_proofread', '_polish_2026_10_27'])
    j[r] = canon[r];
  j._replay = { name: `${P}-canon`, command: `node tools/replay_canon_chain.mjs ${argv.join(' ')}`, game: GAME, game_version: gameVersion,
    canon_sha256: createHash('sha256').update(canonRaw).digest('hex').slice(0, 16),
    rule: 'the canon\'s recorded chain re-run on this game; the hand steps copied from the canon (game_defines and vanilla_value_overrides unchecked against this game by the replay)',
    generated: new Date().toISOString() };
  // keep the canon's key order, so the two books read side by side
  const ordered = {}; for (const k of Object.keys(canon)) if (k in j) ordered[k] = j[k]; for (const k of Object.keys(j)) if (!(k in ordered)) ordered[k] = j[k];
  writeFileSync(b('canon'), JSON.stringify(ordered));
  writeFileSync(`config/tech_tree_options.${P}-canon.json`, readFileSync(`config/tech_tree_options.${P}-jex-dam4s-rs-x25-m10ac.json`));
  console.log(`(hand) ${b('canon')} + its tree twin: the canon's hand steps applied (game ${gameVersion})`);
}
