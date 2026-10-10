// THE RESEARCH-LEVER BOOK (BALANCE_FRAMEWORK §10.96): `--base <config> --suffix <sfx> [--cap-lit N] [--cap-base N] [--innov-base N]
// [--spread-base N] [--spread-lit N] [--uni-mult k] [--dam-staff L,M,E]` writes config/mod_config.<sfx>.json = the base + `research_levers`
// (only the levers named) + `_research_levers_variant`, and copies the base's tree twin (landmine L20). The emitter is emit_research_levers.mjs.
// `--dam-staff` pins `dams.staff_per_50` (laborers, machinists, engineers per 50 electricity) so a probe can match a book AS MEASURED.
import fs from 'node:fs'; import path from 'node:path';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base'), SFX = opt('--suffix'); if (!BASE || !SFX) { console.error('usage: --base <config> --suffix <sfx> …'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(BASE, 'utf8'));
if (cfg.research_levers) { console.error('the base already carries research_levers'); process.exit(1); }
const st = {}; const put = (blk, key, flag) => { const v = opt(flag, null); if (v != null) (st[blk] ||= {})[key] = +v; };
put('country_literacy_rate', 'country_weekly_innovation_max_add', '--cap-lit');
put('base_values', 'country_weekly_innovation_max_add', '--cap-base');
put('base_values', 'country_weekly_innovation_add', '--innov-base');
put('base_values', 'country_tech_spread_add', '--spread-base');
put('country_literacy_rate', 'country_tech_spread_add', '--spread-lit');
const RL = {}; if (Object.keys(st).length) RL.static = st;
if (opt('--uni-mult', null) != null) RL.university_innovation_mult = +opt('--uni-mult');
if (!Object.keys(RL).length) { console.error('no lever given'); process.exit(1); }
cfg.research_levers = RL;
const staff = opt('--dam-staff', null);
if (staff) { const [l, m, e] = staff.split(',').map(Number); cfg.dams = { ...cfg.dams, staff_per_50: { laborers: l, machinists: m, engineers: e } }; }
const cmd = 'node tools/make_research_levers_config.mjs ' + args.join(' ');
cfg._research_levers_variant = { name: SFX, base: path.basename(BASE), ruled_by: 'BALANCE_FRAMEWORK §10.96 (user, 2026-10-10)', command: cmd,
  delta: 'research_levers' + (staff ? ' + dams.staff_per_50 pinned' : '') };
const out = `config/mod_config.${SFX}.json`; fs.writeFileSync(out, JSON.stringify(cfg));
const twinIn = BASE.replace(/mod_config\.([^/\\]+)\.json$/, 'tech_tree_options.$1.json'), twinOut = `config/tech_tree_options.${SFX}.json`;
fs.copyFileSync(fs.existsSync(twinIn) ? twinIn : 'config/tech_tree_options.json', twinOut);
console.log(`${out}: research_levers ${JSON.stringify(RL)}${staff ? ' · dams.staff_per_50 ' + staff : ''}; tree twin ${twinOut} (from ${fs.existsSync(twinIn) ? twinIn : 'the canon'})`);
