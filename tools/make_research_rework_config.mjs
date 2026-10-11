// THE RESEARCH-ENTRY REWORK BOOK (BALANCE_FRAMEWORK §10.97, user-ruled 2026-10-11): `--base <config> --suffix <sfx> [--wild]` writes
// config/mod_config.<sfx>.json = the base + the ruled research_events keys + `ai_schooling` + `_research_rework_variant`, and copies the
// base's tree twin (landmine L20). THE RULED NUMBERS LIVE HERE ONLY. The research LEVERS (innovation base / cap / literacy term, universities)
// are make_research_levers_config.mjs's — run it first and pass its book as --base.
//   · industry stages 36 months; sources not additive; literacy 25/35/45/55/65% by the technology's game era (industry entries only, a
//     pause); the mark halved once a non-isolationist country holds the technology, for non-isolationist entry countries; the
//     implementation stage repeats up to 18 times (2 + 18 = 20 stages); AI schooling: schools institution score 100 in every
//     administrative strategy, +500 enact weight to leave no schools.
//   · --wild: the SMOKE-PROBE book (user: "go wild with the numbers to ensure the effects are seen") — 3-month stages, literacy 50% for
//     every era, institution score 1000, enact weight 5000. Never a measured book.
import fs from 'node:fs'; import path from 'node:path';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base'), SFX = opt('--suffix'), WILD = args.includes('--wild');
if (!BASE || !SFX) { console.error('usage: --base <config> --suffix <sfx> [--wild]'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const RE = cfg.research_events; if (!RE || !RE.enabled) { console.error('the base has no research_events'); process.exit(1); }
if (RE.sources_additive === false || RE.implementation_repeats || cfg.ai_schooling) { console.error('the base already carries the rework'); process.exit(1); }
if (RE.placement !== 'script') { console.error('the rework assumes script placement (research_events.placement = script)'); process.exit(1); }
if (cfg.dams && cfg.dams.staff_per_50) { console.error('the base pins dams.staff_per_50 - the arm runs the historical 10/15/10 (§10.97 build note a)'); process.exit(1); }
const LIT = WILD ? { 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5 } : { 1: 0.25, 2: 0.35, 3: 0.45, 4: 0.55, 5: 0.65 };
Object.assign(RE, {
  industry_bar_months: WILD ? 3 : 36,
  sources_additive: false,
  literacy_by_era: LIT,
  follower_halving: { isolationist_law: 'law_isolationism' },
  implementation_repeats: 18,
});
if (JSON.stringify(RE.stages) !== JSON.stringify(['inception', 'development', 'implementation'])) { console.error('unexpected stage list ' + JSON.stringify(RE.stages)); process.exit(1); }
cfg.ai_schooling = WILD ? { institution_score: 1000, law_enact_add: 5000 } : { institution_score: 100, law_enact_add: 500 };
const cmd = 'node tools/make_research_rework_config.mjs ' + args.join(' ');
cfg._research_rework_variant = { name: SFX, base: path.basename(BASE), wild: WILD, ruled_by: 'BALANCE_FRAMEWORK §10.97 (user, 2026-10-11)', command: cmd,
  delta: 'research_events: industry_bar_months, sources_additive, literacy_by_era, follower_halving, implementation_repeats; ai_schooling' };
const out = `config/mod_config.${SFX}.json`; fs.writeFileSync(out, JSON.stringify(cfg));
const twinIn = BASE.replace(/mod_config\.([^/\\]+)\.json$/, 'tech_tree_options.$1.json'), twinOut = `config/tech_tree_options.${SFX}.json`;
if (!fs.existsSync(twinIn)) { console.error('no tree twin ' + twinIn); process.exit(1); }
fs.copyFileSync(twinIn, twinOut);
console.log(`${out}${WILD ? ' (WILD smoke book)' : ''}: ${cfg._research_rework_variant.delta}; tree twin ${twinOut}`);
