// THE TREATY-PORT DESIRE BOOK — `node tools/make_treaty_port_config.mjs --base <config> --suffix <sfx> [--extreme]` writes
// config/mod_config.<sfx>.json = the base + `ai_treaty_ports` + `_treaty_port_variant`, and copies the base's tech-tree twin (L20).
// THE TABLE LIVES HERE ONLY (BACKLOG D, FINDINGS F243; user-directed 2026-10-18). `--extreme` adds +400 to every eligible target and lifts
// the cap to 1,000 — the PROBE that the engine reads the value at all, never a book to play.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2); const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const base = opt('base'), suffix = opt('suffix'), extreme = args.includes('--extreme');
if (!base || !suffix) { console.error('usage: make_treaty_port_config.mjs --base <config> --suffix <sfx> [--extreme]'); process.exit(2); }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(base, 'utf8'));
if (cfg.ai_treaty_ports) throw new Error(`${base} already carries ai_treaty_ports`);
// the production values (the user's design of 2026-10-18): additive; variants before their parent
const TABLE = {
  law: { sakoku: 35, canton_system: 35, isolationism: 40, mercantilism: 12, protectionism: 10, free_trade: -10 },
  pop: { divisor: 2500000, max: 40 },
  state_pop: { divisor: 400000, max: 5 },
  state_gdp: { divisor: 400000, max: 5 },
  flat: 0,
  conquer_stance_mult: 0,
  protectorate_mult: 0.25,
  existing_port_mult: 0.5,
  max: 100,
  tech_margin: 5,
  tech_add: -1000,
};
if (extreme) { TABLE.flat = 400; TABLE.max = 1000; }
// `--scale k`: every desire term × k (law points, the caps, the cap on the block; divisors ÷ k), the ranking unchanged. Calibration showed the
// driven plays FAIL at production magnitudes (15–40: the demanding AI lets the play lapse) and SUCCEED at extreme ones (400+: it escalates and
// weaker hosts cede) — 20261019_011240 against 20261018_235301. The driver's min_value scales with it.
const scale = +(opt('scale') || 1);
if (!(scale > 0)) throw new Error('--scale must be > 0');
if (scale !== 1) {
  for (const k of Object.keys(TABLE.law)) TABLE.law[k] *= scale;
  for (const k of ['pop', 'state_pop', 'state_gdp']) { TABLE[k].divisor /= scale; TABLE[k].max *= scale; }
  TABLE.max *= scale;
}
// `--driver extreme|production`: the yearly driver that starts dp_take_treaty_port plays against RECOGNISED hosts (the engine itself pursues
// treaty ports only against unrecognised ones — FINDINGS F243 addendum). extreme = every eligible AI every year at any positive desire.
const driver = opt('driver');
if (driver === 'extreme') TABLE.driver = { chance: 100, min_value: 1, min_rank: 'major_power', cooldown_years: 2 };
// production, revised after 20261019_002008 (20% / ≥ 25 / 5 y put treaty-port demands at 6–40% of active war goals, nearly all on Russia and
// the Ottomans — the only hosts that clear 25): rarer, a lower bar so mid-sized lagging hosts qualify, longer cooldown
else if (driver === 'production') TABLE.driver = { chance: 10, min_value: 15, min_rank: 'major_power', cooldown_years: 8 };
// production-nogp: the same, but no great-power hosts (a great power never backs down to a treaty-port demand)
else if (driver === 'production-nogp') TABLE.driver = { chance: 10, min_value: 15, min_rank: 'major_power', cooldown_years: 8, max_host_rank: 'major_power' };
else if (driver) throw new Error(`--driver '${driver}': extreme, production or production-nogp`);
if (TABLE.driver && driver !== 'extreme') TABLE.driver.min_value *= scale;
cfg.ai_treaty_ports = TABLE;
cfg._treaty_port_variant = {
  name: suffix, base: path.relative(REPO, path.resolve(base)).replace(/\\/g, '/'),
  ruled_by: extreme ? 'PROBE ONLY (2026-10-18): +400 for every eligible target, cap 1,000 — does the engine read an administrative strategy\'s treaty_port_value?'
                    : 'user-directed 2026-10-18 (under probe, not ruled): additive desire by trade law and population, conquest/protectorate route factors, technology-parity cancel',
  command: `node tools/make_treaty_port_config.mjs --base ${path.relative(REPO, path.resolve(base)).replace(/\\/g, '/')} --suffix ${suffix}${extreme ? ' --extreme' : ''}${driver ? ' --driver ' + driver : ''}${scale !== 1 ? ' --scale ' + scale : ''}`,
};
const out = path.join(REPO, 'config', `mod_config.${suffix}.json`);
fs.writeFileSync(out, JSON.stringify(cfg));
const twinOf = p => p.replace(/mod_config(\.[^/\\]*)?\.json$/, (m, s) => `tech_tree_options${s || ''}.json`);
const twinSrc = twinOf(path.resolve(base)), twinDst = path.join(REPO, 'config', `tech_tree_options.${suffix}.json`);
if (!fs.existsSync(twinSrc)) throw new Error(`no tech-tree twin beside the base: ${twinSrc}`);
fs.copyFileSync(twinSrc, twinDst);
console.log(`wrote ${path.relative(REPO, out)} + ${path.relative(REPO, twinDst)}${extreme ? '  (EXTREME probe book)' : ''}`);
