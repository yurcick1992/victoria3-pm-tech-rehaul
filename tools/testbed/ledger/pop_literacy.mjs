// LOWER-CLASS LITERACY PER COUNTRY, OUT OF ONE SAVE — who can become a machinist (FINDINGS F183, 2026-09-30).
//
//   node tools/testbed/ledger/pop_literacy.mjs <save.v3> [--json out.json] [--top N] [--game <game dir>]
//
// The machinist qualification GROWS at (pop literacy − 0.1) × 20 a pop (× 2 for laborers, × 0.05 for peasants under serfdom;
// common/pop_types/machinists.txt), so a pop at or under 10% literacy adds nobody to the pool. Per country this prints the lower
// class's literacy, how many lower-class pops sit above 10% and what share of the lower-class WORKFORCE lives in them, the most
// literate lower-class pop, the stock of people already qualified as machinists (the save's own `qualifications`, summed over every
// non-machinist pop), the machinists employed, and the six light industries' e0 levels (the future craft holders, BALANCE_FRAMEWORK
// §10.91.1) from the run's matching save summary.
// ⚠ LITERACY IS OVER THE WORKFORCE: pop literacy = num_literate ÷ workforce. Over workforce + dependents it reads about a quarter of
//   the game's own figure; over the workforce it reproduces the country literacy the game reports to within 0.3 points for most
//   countries (Britain and France read 4–6 points under, both colonial empires).
// ⚠ "LOWER CLASS" = THE PROFESSIONS the default social hierarchy puts there (common/social_classes/00_default.txt: clerks, laborers,
//   machinists, peasants, slaves, soldiers — farmers are MIDDLE class in 1.13), read live. A pop's own `social_class` record follows its
//   country's hierarchy instead (India's castes, Japan's Edo system), so it is not used for the cut.
// ⚠ The pop table is read from the melt (rakaly, in-process); a pop's state resolves to its owner through the states database.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const SAVE = args.find(a => a.endsWith('.v3'));
if (!SAVE) { console.error('usage: node tools/testbed/ledger/pop_literacy.mjs <save.v3> [--json out.json] [--top N] [--game <dir>]'); process.exit(2); }
const JOUT = argOf('--json', null), TOP = +argOf('--top', 25);
const POP_TYPES = readdirSync(join(GAME, 'common/pop_types')).filter(x => x.endsWith('.txt')).sort().map(x => x.replace(/\.txt$/, ''));
const IMACH = POP_TYPES.indexOf('machinists');
if (IMACH < 0) throw new Error('pop_literacy: no machinists pop type in the game files');
const LOWER = (() => {
  const t = readFileSync(join(GAME, 'common/social_classes/00_default.txt'), 'utf8');
  const m = /lower_class\s*=\s*\{[\s\S]*?allowed_professions\s*=\s*\{([^}]*)\}/.exec(t);
  if (!m) throw new Error('pop_literacy: no lower_class in common/social_classes/00_default.txt');
  return new Set(m[1].trim().split(/\s+/));
})();
const QUAL_RE = new RegExp('(?:^|\\s)' + IMACH + '=([\\d.]+)');

const rak = spawn(join(REPO, 'tools/vendor/rakaly/rakaly.exe'), ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', SAVE]);
let rakErr = ''; rak.stderr.on('data', d => { rakErr += d; });
const rakDone = new Promise((res, rej) => rak.on('close', code => code === 0 ? res() : rej(new Error(`rakaly exited ${code}: ${rakErr.slice(0, 300)}`))));
const rl = createInterface({ input: rak.stdout, crlfDelay: Infinity });
let mode = 'top', date = null, cid = null, sid = null, pop = null, inQual = false;
const tagOf = new Map(), stateCountry = new Map(), pops = [];
const closePop = () => { if (pop && pop.type) pops.push(pop); pop = null; inQual = false; };
for await (const line of rl) {
  if (mode === 'top') {
    if (!date) { const d = /^date=(\d+\.\d+\.\d+)/.exec(line); if (d) { date = d[1]; continue; } }
    const s = /^([a-z_]+)=\{$/.exec(line); if (!s) continue;
    mode = ['country_manager', 'states', 'pops'].includes(s[1]) ? s[1] : 'skip'; continue;
  }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
  if (line.charCodeAt(0) === 125) { if (mode === 'pops') closePop(); mode = 'top'; cid = sid = null; continue; }
  // records open at two tabs ("\t\t<id>={", or "\t\t<id>=none" for a freed slot); their own fields sit at three tabs
  if (line.startsWith('\t\t') && !line.startsWith('\t\t\t')) {
    const m = /^\t\t(\d+)=\{$/.exec(line);
    if (mode === 'pops') { closePop(); if (m) pop = { type: null, w: 0, d: 0, lit: 0, loc: -1, qm: 0 }; }
    else if (mode === 'country_manager') cid = m ? +m[1] : null;
    else if (mode === 'states') sid = m ? +m[1] : null;
    continue;
  }
  if (mode === 'country_manager' && cid !== null && line.startsWith('\t\t\tdefinition="')) { tagOf.set(cid, line.slice(15, -1)); continue; }
  if (mode === 'states' && sid !== null && line.startsWith('\t\t\tcountry=')) { stateCountry.set(sid, +line.slice(11)); continue; }
  if (mode === 'pops' && pop) {
    if (line.startsWith('\t\t\t\t')) { if (inQual) { const m = QUAL_RE.exec(line.trim()); if (m) pop.qm = +m[1]; } continue; }
    if (line.startsWith('\t\t\t')) {
      inQual = false;
      const t = line.slice(3);
      if (t.startsWith('type="')) pop.type = t.slice(6, -1);
      else if (t.startsWith('workforce=')) pop.w = +t.slice(10);
      else if (t.startsWith('dependents=')) pop.d = +t.slice(11);
      else if (t.startsWith('location=')) pop.loc = +t.slice(9);
      else if (t.startsWith('num_literate=')) pop.lit = +t.slice(13);
      else if (t === 'qualifications={') inQual = true;
    }
  }
}
closePop();
await rakDone;
if (!pops.length || !tagOf.size || !stateCountry.size) throw new Error(`pop_literacy: read ${pops.length} pops, ${tagOf.size} countries, ${stateCountry.size} states — the melt's layout moved?`);

// the six industries' e0 levels (future craft holders) from the run's own summary of the same save, when it exists
const sumPath = join(dirname(dirname(SAVE)), 'save_summaries', basename(SAVE, '.v3') + '.json.gz');
const E0 = ['building_food_industry', 'building_textile_mill', 'building_furniture_manufactory', 'building_glassworks', 'building_tooling_workshop', 'building_paper_mill'];
const e0 = {};
if (existsSync(sumPath)) {
  const j = JSON.parse(gunzipSync(readFileSync(sumPath)));
  // the melt rows below are keyed by TAG with every record of a definition summed, so fold a v12 TAG@<id> key back into its tag
  // (a pre-v12 summary kept only ONE record per tag — its other record's levels are simply absent, FINDINGS F186)
  for (const [key, c] of Object.entries(j.countries)) { let lv = 0; for (const k of E0) lv += (c.buildings && c.buildings[k] && c.buildings[k].levels) || 0; if (lv) { const tag = c.tag ?? key.split('@')[0]; e0[tag] = (e0[tag] || 0) + lv; } }
}
const C = {};
for (const p of pops) {
  const tag = tagOf.get(stateCountry.get(p.loc)); if (!tag) continue;
  const size = p.w + p.d; if (!(size > 0)) continue;
  const c = C[tag] ||= { pop: 0, wf: 0, lit: 0, lowerWf: 0, lowerLit: 0, lowerAboveWf: 0, lowerPops: 0, lowerPopsAbove: 0, maxLowerLit: 0, qm: 0, mach: 0 };
  const l = p.w > 0 ? p.lit / p.w : 0;
  c.pop += size; c.wf += p.w; c.lit += p.lit;
  if (p.type === 'machinists') c.mach += p.w; else c.qm += p.qm;
  if (LOWER.has(p.type)) {
    c.lowerWf += p.w; c.lowerLit += p.lit; c.lowerPops++; if (l > c.maxLowerLit) c.maxLowerLit = l;
    if (p.w > 0 && l > 0.10) { c.lowerAboveWf += p.w; c.lowerPopsAbove++; }
  }
}
const rows = Object.entries(C).map(([tag, c]) => ({ tag, pop: c.pop, lowerWf: c.lowerWf, litRate: c.wf ? c.lit / c.wf : 0,
  lowerRate: c.lowerWf ? c.lowerLit / c.lowerWf : 0, share: c.lowerWf ? c.lowerAboveWf / c.lowerWf : 0, lowerPops: c.lowerPops,
  lowerPopsAbove: c.lowerPopsAbove, maxLowerLit: c.maxLowerLit, qm: c.qm, mach: c.mach, e0: e0[tag] || 0 })).sort((a, b) => b.pop - a.pop);
if (JOUT) writeFileSync(JOUT, JSON.stringify({ save: SAVE, date, lower: [...LOWER], rows }));
const pct = v => (v * 100).toFixed(1) + '%', k = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : Math.round(v) + '';
const none = rows.filter(r => r.lowerPops > 0 && r.lowerPopsAbove === 0);
console.log(`${basename(SAVE)} ${date}: ${pops.length} pops, ${rows.length} countries; lower class = ${[...LOWER].join(', ')}; literacy over the workforce`);
console.log(`NO lower-class pop above 10% literacy: ${none.length} countries, ${k(none.reduce((s, r) => s + r.pop, 0))} people, holding ${none.reduce((s, r) => s + r.e0, 0)} of ${rows.reduce((s, r) => s + r.e0, 0)} e0 levels of the six industries${none.length ? ` — largest: ${none.slice(0, 12).map(r => r.tag).join(' ')}` : ''}`);
console.log('country     people   literacy  lower-class lit  lower workforce  in pops >10%  lower pops >10%  machinist-qualified  machinists  e0 lv');
for (const r of rows.filter(r => r.e0 > 0).sort((a, b) => a.share - b.share).slice(0, TOP))
  console.log(`${r.tag.padEnd(8)} ${k(r.pop).padStart(9)} ${pct(r.litRate).padStart(10)} ${pct(r.lowerRate).padStart(16)} ${k(r.lowerWf).padStart(16)} ${pct(r.share).padStart(13)} ${(r.lowerPopsAbove + ' of ' + r.lowerPops).padStart(16)} ${k(r.qm).padStart(20)} ${k(r.mach).padStart(11)} ${String(r.e0).padStart(6)}`);
