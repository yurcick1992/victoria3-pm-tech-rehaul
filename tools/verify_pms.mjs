// Verify every production method the era presets select is (a) a REAL vanilla PM and (b) one this
// scenario's country could legally run. Reads the game files directly rather than our extract, so it
// cannot be fooled by a bug in the extractor.
//   node tools/verify_pms.mjs
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {REPO} from './econ_host.mjs';
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const PMDIR = join(GAME, 'common/production_methods');
// THE RULE (must match tools/era_solver.mjs). Technology is the only gate the solver may satisfy freely.
// Every unlocking_* gate other than technology counts as NOT fulfilled. Law gates are read against a
// two-law stance — the smallest one that makes the scenario coherent — in the direction vanilla means
// them: `unlocking_laws` needs one of ours, `disallowing_laws` blocks only if it names one of ours.
const SCENARIO_LAWS = new Set(['law_slavery_banned', 'law_commercialized_agriculture']);
const NEVER_KEYS = ['unlocking_geographic_regions', 'unlocking_company_categories',
  'unlocking_identity', 'unlocking_religions', 'unlocking_principles'];

// ⚠ Strip the UTF-8 BOM. Every one of these files starts with one, so the FIRST production method in
// each file is invisible to a naive `^name = {` match — which made six perfectly real PMs look
// hallucinated on the first pass of this check.
const blocks = {};
for (const f of readdirSync(PMDIR).filter(x => x.endsWith('.txt'))) {
  const txt = readFileSync(join(PMDIR, f), 'utf8').replace(/^\uFEFF/, '');
  let cur = null, depth = 0, gate = null;
  for (const ln of txt.split(/\r?\n/)) {
    if (!cur) {
      const m = ln.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{/);
      if (m) { cur = m[1]; blocks[cur] = { file: f, gates: {} }; depth = 1; }
      continue;
    }
    const g = ln.match(/^\s*(unlocking_[a-z_]+|disallowing_[a-z_]+)\s*=\s*\{/);
    if (g) { gate = g[1]; blocks[cur].gates[gate] = []; }
    else if (gate) {
      const tok = ln.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)/);
      if (tok) blocks[cur].gates[gate].push(tok[1]);
      if (/\}/.test(ln)) gate = null;
    }
    depth += (ln.match(/\{/g) || []).length - (ln.match(/\}/g) || []).length;
    if (depth <= 0) { cur = null; gate = null; }
  }
}

// REPO comes from econ_host, which resolves it with fileURLToPath — a raw URL pathname leaves the
// repo's spaces percent-encoded and fails to open.
const pre = JSON.parse(readFileSync(join(REPO, 'config', 'era_presets.json'), 'utf8'));
const used = new Map();
pre.presets.forEach((p, i) => { for (const b in p.pms) for (const pmg in p.pms[b]) {
  const pm = p.pms[b][pmg]; if (!used.has(pm)) used.set(pm, new Set()); used.get(pm).add('e' + (i + 1)); } });

const missing = [], illegal = [];
for (const [pm, eras] of used) {
  if (/^pm_main_/.test(pm)) continue;                       // ours, by design
  const r = blocks[pm];
  if (!r) { missing.push(pm); continue; }
  // ⚠ An EMPTY gate block is not a gate. Vanilla ships `unlocking_geographic_regions = { }` on
  // coffee_plantation_dry_process — a vestigial placeholder that restricts nothing. Treating the key's
  // presence as a restriction wrongly condemns a PM every country can run.
  const g = r.gates, why = [], has = k => g[k] && g[k].length;
  for (const k of NEVER_KEYS) if (has(k)) why.push(`${k}=${g[k].join('/')}`);
  if (has('unlocking_laws') && !g.unlocking_laws.some(l => SCENARIO_LAWS.has(l))) why.push(`needs a law we lack: ${g.unlocking_laws.join('/')}`);
  if (has('disallowing_laws') && g.disallowing_laws.some(l => SCENARIO_LAWS.has(l))) why.push(`blocked by our ${g.disallowing_laws.filter(l => SCENARIO_LAWS.has(l)).join('/')}`);
  if (why.length) illegal.push({ pm, why, eras: [...eras].join(',') });
}
console.log(`${used.size} distinct PMs selected across ${pre.presets.length} era presets; ${Object.keys(blocks).length} vanilla PMs parsed.`);
console.log(`\nNOT A REAL VANILLA PM: ${missing.length ? '\n  ' + missing.join('\n  ') : 'none'}`);
console.log(`\nSELECTED BUT THIS COUNTRY COULD NOT RUN IT: ${illegal.length ? '' : 'none'}`);
for (const x of illegal) console.log(`  ${x.pm.padEnd(50)} ${x.why.join('; ')}   [${x.eras}]`);
process.exit(missing.length || illegal.length ? 1 : 0);
