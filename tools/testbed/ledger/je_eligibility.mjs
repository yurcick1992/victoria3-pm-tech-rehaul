// ⭐ WHY A RESEARCH ENTRY DOES NOT TICK (2026-11-22, the mod 1.2 technology pass): every research entry's own conditions, as the build
//   emitted them, replayed against each run's yearly save summaries, country by country.
//
//   node tools/testbed/ledger/je_eligibility.mjs extract <label>=<group> --mod mod_m12b --tree config/tech_tree_options.m12b-first.json --cache <dir>
//   node tools/testbed/ledger/je_eligibility.mjs report  --cache <dir> [--json <file>] [--tech a,b] [--section entries|sources|prereq|spread|all]
//
// EXTRACT reads, per run: every yearly summary (technologies held, literacy, laws, buildings by type with staffing and active methods) and
// the run's debug.log mirror (PMR_JE stage completions, dated by the last dated line before them). It parses the build's OWN files
// (`common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt`, `common/script_values/zzz_pm_rehaul_research_values.txt`), so the marks and
// sources are the shipped ones, never recomputed from the book. One cache file per run.
// REPORT classifies every (run, year, focus country, entry technology not yet held) into:
//   tick      prerequisites held, literacy at the gate, a source at its mark — the entry advances
//   pre       literacy and a source are there, a PREREQUISITE technology is missing (the entry does not exist yet: `can_research`)
//   lit       prerequisites and a source are there, literacy under the gate
//   src       prerequisites and literacy are there, no source at its mark (`req` = the source is there but its required technology is not)
//   lit+src   prerequisites there, neither literacy nor a source
//   far       prerequisites missing and the entry would not tick anyway
// The focus countries are the technology majors of tech_census.mjs (GBR USA NET BEL FRA PRU SWE UNL NGF GER) and, separately, the top 15
// independent countries by GDP of that year. A source is evaluated as the script does: staffed levels (level × occupancy), a merged rung by
// the levels on its method, crafts at 500 a level.
// ⚠ NOT MODELLED (reported as `cond`: prerequisites and literacy only): the frontline, naval, contagious-idea, colony and rank entries (their
//   conditions are script flags no save summary carries), and the urban-centre entries (the largest city's level is not in the summaries).
// ⚠ The yearly summaries see a state on 1 January; a stage needs 36 ticking months, so a `tick` year is a year the entry could advance.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { usableRunsPooled } from './lib_runs.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SES = join(REPO, 'tools/testbed/sessions');
const args = process.argv.slice(2);
const MODE = args[0];
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const MAJ = ['GBR', 'USA', 'NET', 'BEL', 'FRA', 'PRU', 'SWE', 'UNL', 'NGF', 'GER'];
const NAMES = { GBR: ['Great Britain', 'British Republic', 'United Kingdom', 'British Empire'], USA: ['United States of America', 'United States'],
  FRA: ['France', 'French Republic', 'French Commune', 'French Empire', 'Kingdom of France'], NET: ['Netherlands'], BEL: ['Belgium', 'United Belgian States'],
  UNL: ['United Netherlands'], PRU: ['Prussia'], NGF: ['North German Federation'], GER: ['German Empire', 'Germany'], SWE: ['Sweden'] };
const MAJ_NAMES = new Set(Object.values(NAMES).flat());
const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

// ---------------------------------------------------------------- the build's own conditions
function blocks(text) {   // top-level `name = { … }` blocks, brace-matched
  const out = {}; const re = /^([a-z_0-9]+) = \{/gm; let m;
  while ((m = re.exec(text))) { let i = re.lastIndex, d = 1; while (i < text.length && d > 0) { if (text[i] === '{') d++; else if (text[i] === '}') d--; i++; } out[m[1]] = text.slice(re.lastIndex, i - 1); re.lastIndex = i; }
  return out;
}
function parseMod(mod) {
  const V = blocks(readFileSync(join(mod, 'common/script_values/zzz_pm_rehaul_research_values.txt'), 'utf8').replace(/^﻿/, ''));
  const B = blocks(readFileSync(join(mod, 'common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt'), 'utf8').replace(/^﻿/, ''));
  const values = {};
  for (const [n, body] of Object.entries(V)) {
    const flat = body.replace(/\s+/g, ' ');
    const node = { terms: [], refs: [], div: 1, max: null, opaque: false };
    for (const m of flat.matchAll(/(every|ordered)_scope_building = \{ limit = \{ is_building_type = ([a-z_0-9]+)(.*?)\} (?:order_by = this\.level )?add = (\{ value = this\.level multiply = occupancy \}|this\.level)/g)) {
      const pms = [...m[3].matchAll(/has_active_production_method = ([a-z_0-9-]+)/g)].map(x => x[1]);
      if (m[1] === 'ordered') node.max = m[2]; else node.terms.push({ type: m[2], pms, occ: m[4] !== 'this.level' });
    }
    for (const m of flat.matchAll(/add = \{ value = ([a-z_][a-z_0-9]*) multiply = ([\d.]+) \}/g)) node.refs.push({ ref: m[1], mult: +m[2] });
    const v = flat.match(/^ ?value = ([a-z_][a-z_0-9]*)/); if (v) node.refs.push({ ref: v[1], mult: 1 });
    const d = flat.match(/ divide = ([\d.]+)/); if (d) node.div = +d[1];
    if (!node.terms.length && !node.refs.length && node.max == null) node.opaque = true;
    values[n] = node;
  }
  const bars = {};
  for (const [n, body] of Object.entries(B)) {
    const tech = n.replace(/^pmr_bar_/, ''); const months = +(body.match(/max_value = (\d+)/) || [])[1];
    // every `limit` line of the bar. A second source's line is followed by a nested `limit = { NOT = { OR = { … } } }` (non-additive
    // sources: it ticks only where no earlier source does) — that nested line is the earlier sources' condition negated, never a branch;
    // a line with nothing to compare (the "held elsewhere" display rows, value 0) is dropped below.
    const lims = [...body.matchAll(/limit = \{\n\s*(.*)\n\s*\}/g)].map(m => m[1]).filter(L => !/^NOT = \{ OR = \{/.test(L));
    const branches = [], kinds = new Set();
    for (const L of lims) {
      const lit = +(L.match(/literacy_rate >= ([\d.]+)/) || [])[1] || null;
      const half = /^(literacy_rate >= [\d.]+\s+)?has_global_variable = pmr_held_/.test(L) ? 'half' : /NOT = \{ AND = \{ has_global_variable = pmr_held_/.test(L) ? 'full' : 'any';
      const tail = L.replace(/literacy_rate >= [\d.]+/, '').replace(/NOT = \{ AND = \{ has_global_variable = pmr_held_\S+\s+NOT = \{ has_law_or_variant = law_type:law_isolationism \} \} \}/, '').replace(/has_global_variable = pmr_held_\S+\s+NOT = \{ has_law_or_variant = law_type:law_isolationism \}/, '');
      const cmps = [...tail.matchAll(/(pmr_[a-z_0-9]+) >= ([\d.]+)/g)].map(x => ({ name: x[1], min: +x[2] }));
      const req = [...tail.matchAll(/has_technology_researched = ([a-z_0-9]+)/g)].map(x => x[1]);
      const notLaw = [...tail.matchAll(/NOT = \{ has_law = law_type:([a-z_0-9]+) \}/g)].map(x => x[1]);
      let kind = 'industry';
      if (/pmr_wargate_/.test(L)) kind = 'war'; else if (/pmr_nav/.test(L)) kind = 'naval'; else if (/pmr_idea/.test(L)) kind = 'idea';
      else if (/region = sr:/.test(L)) kind = 'colony'; else if (/country_rank/.test(L)) kind = 'rank';
      else if (cmps.some(c => /^pmr_cv_urban/.test(c.name))) kind = 'urban'; else if (cmps.some(c => /^pmr_cv_/.test(c.name))) kind = 'condition';
      if (!cmps.length && kind === 'industry') continue;
      kinds.add(kind);
      branches.push({ lit, half, cmps, req, notLaw, kind });
    }
    if (!branches.length) throw new Error(`bar ${n}: no ticking branch parsed`);
    bars[tech] = { months, branches, kind: [...kinds][0], lit: branches[0].lit };
  }
  return { values, bars };
}
function evalValue(values, name, c, memo = {}) {
  if (name in memo) return memo[name];
  const node = values[name]; if (!node) throw new Error(`script value ${name} not in the build`);
  if (node.opaque || node.max != null) return (memo[name] = null);
  let x = 0;
  for (const t of node.terms) { const b = c.buildings[t.type]; if (!b || !b.levels) continue;
    let lv = t.occ ? (b.staffing ?? b.levels) : b.levels;
    if (t.pms.length) { const on = t.pms.reduce((s, p) => s + ((b.pms || {})[p] || 0), 0); lv *= Math.min(1, on / b.levels); }
    x += lv; }
  for (const r of node.refs) { const v = evalValue(values, r.ref, c, memo); if (v == null) return (memo[name] = null); x += v * r.mult; }
  return (memo[name] = x / node.div);
}

// ---------------------------------------------------------------- extract
if (MODE === 'extract') {
  const MOD = join(REPO, opt('--mod', 'mod'));
  const TREE = JSON.parse(readFileSync(join(REPO, opt('--tree', 'config/tech_tree_options.json')), 'utf8')).options.find(o => o.ships);
  const CACHE = opt('--cache', null); if (!CACHE) throw new Error('--cache <dir> is required');
  mkdirSync(CACHE, { recursive: true });
  const { values, bars } = parseMod(MOD);
  const ids = TREE.techs.map(t => t.id); const IDX = Object.fromEntries(ids.map((id, i) => [id, i]));
  const cmpNames = [...new Set(Object.values(bars).flatMap(b => b.branches.flatMap(br => br.cmps.map(c => c.name))))];
  const thresholds = {}; for (const b of Object.values(bars)) for (const br of b.branches) for (const c of br.cmps) (thresholds[c.name] ||= new Set()).add(c.min);
  writeFileSync(join(CACHE, 'meta.json'), JSON.stringify({ ids, bars, techs: TREE.techs.map(t => ({ id: t.id, era: t.era, category: t.category, onset: t.onset, prereqs: t.prereqs || [], name: t.name })), cmpNames }));
  const arm = args.find((a, i) => i > 0 && a.includes('=') && !args[i - 1].startsWith('--')); if (!arm) throw new Error('extract needs <label>=<group>');
  const [label, group] = arm.split('=');
  const [grp, setup = ''] = group.split(':'); const { runs, dropped } = usableRunsPooled(SES, grp, setup); for (const d of dropped) console.log(`DROPPED ${d.run}: ${d.reason}`);
  let k = 0;
  for (const rel of runs) {
    const dir = join(SES, rel, 'save_summaries'); const years = []; const seen = new Set();
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
      const j = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString());
      const y = +String(j.provenance.date).split('.')[0]; if (seen.has(y)) continue; seen.add(y);
      const all = Object.entries(j.countries).filter(([t]) => !t.includes('@'));
      const top = new Set(all.filter(([, v]) => !v.overlord).sort((a, b) => (b[1].gdp || 0) - (a[1].gdp || 0)).slice(0, 15).map(([t]) => t));
      const reach = {};   // per compared value: how many countries reach each threshold, and the three largest
      const rows = [];
      for (const [tag, v] of all) {
        const c = { buildings: v.buildings || {} }; const memo = {}; const vals = {};
        for (const n of cmpNames) { const x = evalValue(values, n, c, memo); if (x == null) continue;
          if (x > 0) { const r = (reach[n] ||= { n: Object.fromEntries([...thresholds[n]].map(t => [t, 0])), top: [] });
            for (const t of thresholds[n]) if (x >= t) r.n[t]++;
            r.top.push([tag, Math.round(x * 100) / 100]); r.top.sort((a, b) => b[1] - a[1]); r.top.length = Math.min(r.top.length, 5); }
          if (x > 0) vals[n] = Math.round(x * 100) / 100; }
        if (!(MAJ.includes(tag) || top.has(tag))) continue;
        rows.push({ tag, maj: MAJ.includes(tag), top: top.has(tag), gdp: Math.round(v.gdp || 0), lit: v.literacy ?? null, laws: (v.laws || []).filter(l => /isolationism|traditionalism/.test(l)),
          held: (v.technologies_held || []).map(t => IDX[t]).filter(x => x != null), vals, innov: v.innovation ?? null, maxInnov: v.max_innovation ?? null,
          researching: v.researching || null, spreading: v.spreading || [] });
      }
      const heldAny = new Set(); for (const [, v] of all) for (const t of v.technologies_held || []) heldAny.add(IDX[t]);
      // spread: how many countries hold each technology (for the world-first and diffusion readings)
      const holders = {}; for (const [, v] of all) for (const t of v.technologies_held || []) holders[IDX[t]] = (holders[IDX[t]] || 0) + 1;
      years.push({ y, n: all.length, rows, reach, holders });
    }
    // the run's stage completions, dated by the last dated line before each
    const comp = []; const dbg = join(SES, rel, 'logs_live', 'debug.log');
    if (existsSync(dbg)) {
      const [session, run] = rel.split('/'); const lines = readFileSync(dbg, 'utf8').split('\n');
      const bs = existsSync(join(SES, rel, 'save_provenance.json')) ? readFileSync(join(SES, rel, 'save_provenance.json'), 'utf8') : '';
      const tokM = bs.match(/(\d{8}_\d{6}s\d{3})/); const token = tokM ? tokM[1] : `${session.slice(0, 15)}s${run.slice(3, 6)}`;
      let start = lines.findIndex(l => l.includes(token)); if (start < 0) { console.log(`⚠ ${rel}: token ${token} not in debug.log — reading the whole mirror`); start = 0; }
      let year = 1836; const seenC = new Set();
      for (let i = start; i < lines.length; i++) {
        const l = lines[i]; const d = l.match(/(January|February|March|April|May|June|July|August|September|October|November|December) \d+, (\d{4})/); if (d) year = +d[2] + (MONTHS[d[1]] - 1) / 12;
        const m = l.match(/PMR_JE\|([a-z]+\d*)\|([a-z_0-9]+)\|(.*?)\s*$/); if (!m || m[2] === '-') continue;
        const key = `${m[3].trim()}|${m[2]}|${m[1]}`; if (seenC.has(key)) continue; seenC.add(key);
        comp.push({ tech: m[2], stage: m[1], name: m[3].trim(), y: Math.round(year * 100) / 100 });
      }
    }
    writeFileSync(join(CACHE, `run_${label}_${String(++k).padStart(2, '0')}.json`), JSON.stringify({ rel, years, comp }));
    console.log(`${rel}: ${years.length} years, ${comp.length} stage completions`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------- report
if (MODE !== 'report') { console.error('usage: je_eligibility.mjs extract|report … (see the header)'); process.exit(2); }
const CACHE = opt('--cache', null);
const META = JSON.parse(readFileSync(join(CACHE, 'meta.json'), 'utf8'));
const T = Object.fromEntries(META.techs.map(t => [t.id, t])); const IDX = Object.fromEntries(META.ids.map((id, i) => [id, i]));
const RUNS = readdirSync(CACHE).filter(f => /^run_.*\.json$/.test(f)).sort().map(f => JSON.parse(readFileSync(join(CACHE, f), 'utf8')));
const SECTION = opt('--section', 'all'); const ONLY = opt('--tech', null) ? new Set(opt('--tech', '').split(',')) : null;
const med = a => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const pc = (x, n) => n ? Math.round(100 * x / n) + '%' : '—';
const f1 = x => x == null ? '—' : (Math.round(x * 10) / 10).toString();
const STATES = ['tick', 'pre', 'lit', 'src', 'req', 'lit+src', 'far', 'cond', 'cond-pre', 'cond-lit'];

function classify(bar, tech, row, heldSet, worldHeld) {
  const pre = (T[tech].prereqs || []).every(p => heldSet.has(IDX[p]));
  const iso = row.laws.includes('law_isolationism'); const halfOn = worldHeld && !iso;
  const modelled = ['industry', 'condition'].includes(bar.kind);
  const lit = bar.lit == null || (row.lit != null && row.lit >= bar.lit);
  if (!modelled) return { state: !pre ? 'cond-pre' : !lit ? 'cond-lit' : 'cond', pre, lit, best: null };
  let src = false, lvl = false, best = 0;
  for (const br of bar.branches) {
    if (br.half === 'half' && !halfOn) continue; if (br.half === 'full' && halfOn) continue;
    if (br.notLaw.some(l => row.laws.includes(l))) continue;
    const okL = br.cmps.every(c => (row.vals[c.name] || 0) >= c.min); const okR = br.req.every(t => heldSet.has(IDX[t]));
    for (const c of br.cmps) best = Math.max(best, (row.vals[c.name] || 0) / c.min);
    if (okL) lvl = true; if (okL && okR) src = true;
  }
  const state = pre && lit && src ? 'tick' : !pre && lit && src ? 'pre' : pre && !lit && src ? 'lit' : pre && lit && !src ? (lvl ? 'req' : 'src') : pre ? 'lit+src' : 'far';
  return { state, pre, lit, src, best };
}

const out = {};
for (const tech of Object.keys(META.bars).sort()) {
  if (ONLY && !ONLY.has(tech)) continue;
  const bar = META.bars[tech]; const t = T[tech]; const onset = t.onset ?? 1836;
  const R = { tech, era: t.era, cat: t.category, onset: t.onset, kind: bar.kind, lit: bar.lit, months: bar.months,
    marks: bar.branches.map(b => `${b.half}:${b.cmps.map(c => `${c.name.replace(/^pmr_(src|cv)_/, '')}>=${c.min}`).join('&')}${b.req.length ? ' +' + b.req.join('+') : ''}`),
    st: { maj: Object.fromEntries(STATES.map(s => [s, 0])), top: Object.fromEntries(STATES.map(s => [s, 0])) }, missing: {}, bestWhenSrc: [], firstTick: [], acq: [], stages: [], firers: [], majFirers: [], firstFire: [],
    majHeldEnd: [], worldFirst: [], litShort: [] };
  for (const run of RUNS) {
    const firstTickBy = {}, acqBy = {}; let worldFirst = null;
    for (const Y of run.years) {
      if ((Y.holders[IDX[tech]] || 0) > 0 && worldFirst == null) worldFirst = Y.y;
      const worldHeld = (Y.holders[IDX[tech]] || 0) > 0;
      for (const row of Y.rows) {
        const held = new Set(row.held);
        if (held.has(IDX[tech])) { if (row.maj && acqBy[row.tag] == null) acqBy[row.tag] = Y.y; continue; }
        if (Y.y < onset - 5) continue;
        const c = classify(bar, tech, row, held, worldHeld);
        for (const g of ['maj', 'top']) if (row[g]) R.st[g][c.state]++;
        if (row.maj) {
          if (c.state === 'pre' || c.state === 'cond-pre') for (const p of t.prereqs || []) if (!held.has(IDX[p])) R.missing[p] = (R.missing[p] || 0) + 1;
          if (c.state === 'src' || c.state === 'lit+src') R.bestWhenSrc.push(c.best);
          if ((c.state === 'lit' || c.state === 'lit+src' || c.state === 'cond-lit') && row.lit != null) R.litShort.push(bar.lit - row.lit);
          if (c.state === 'tick' && firstTickBy[row.tag] == null) firstTickBy[row.tag] = Y.y;
        }
      }
    }
    const last = run.years[run.years.length - 1];
    const majLast = last.rows.filter(r => r.maj); R.majHeldEnd.push(majLast.length ? majLast.filter(r => r.held.includes(IDX[tech])).length / majLast.length : null);
    R.worldFirst.push(worldFirst); R.firstTick.push(...Object.values(firstTickBy)); R.acq.push(...Object.values(acqBy));
    const cs = run.comp.filter(c => c.tech === tech);
    R.stages.push(cs.length); const names = new Set(cs.map(c => c.name)); R.firers.push(names.size); R.majFirers.push([...names].filter(n => MAJ_NAMES.has(n)).length);
    R.firstFire.push(cs.length ? Math.min(...cs.map(c => c.y)) : null);
  }
  out[tech] = R;
}

if (SECTION === 'all' || SECTION === 'entries') {
  console.log(`\nA. EVERY ENTRY, ${RUNS.length} run(s): stage completions and what the technology majors' unheld country-years look like from onset − 5 on`);
  console.log('   tech'.padEnd(34) + 'era kind       lit  onset  stages/run  countries (majors)  first   maj held@end | majors unheld years: tick  pre  lit  src  req  l+s  far  [n]');
  const rows = Object.values(out).sort((a, b) => a.kind.localeCompare(b.kind) || a.era - b.era || (a.onset ?? 0) - (b.onset ?? 0));
  for (const R of rows) {
    const s = R.st.maj; const n = STATES.reduce((x, k) => x + s[k], 0);
    const cells = ['industry', 'condition'].includes(R.kind) ? ['tick', 'pre', 'lit', 'src', 'req', 'lit+src', 'far'].map(k => pc(s[k], n).padStart(5)).join('') : `  cond ${pc(s.cond, n)} · prereq ${pc(s['cond-pre'], n)} · literacy ${pc(s['cond-lit'], n)}`;
    console.log(`   ${R.tech.padEnd(31)}${String(R.era).padEnd(4)}${R.kind.padEnd(11)}${String(R.lit ?? '—').padEnd(5)}${String(R.onset ?? '?').padEnd(7)}${f1(mean(R.stages)).padStart(6)}      ${f1(mean(R.firers)).padStart(5)} (${f1(mean(R.majFirers))})`.padEnd(88) +
      `${String(med(R.firstFire) != null ? Math.floor(med(R.firstFire)) : '—').padEnd(8)}${pc(mean(R.majHeldEnd.filter(x => x != null)), 1).padEnd(6)}       | ${cells}  [${n}]`);
  }
}
if (SECTION === 'all' || SECTION === 'prereq') {
  console.log('\nB. THE PREREQUISITES THAT BLOCK: majors\' country-years in `pre` (everything else is there), by the missing technology');
  for (const R of Object.values(out).filter(R => R.st.maj.pre + R.st.maj['cond-pre'] > 0).sort((a, b) => (b.st.maj.pre + b.st.maj['cond-pre']) - (a.st.maj.pre + a.st.maj['cond-pre'])))
    console.log(`   ${R.tech.padEnd(31)}${String(R.st.maj.pre + R.st.maj['cond-pre']).padStart(5)} years  ← ` + Object.entries(R.missing).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(' · '));
}
if (SECTION === 'all' || SECTION === 'sources') {
  console.log('\nC. THE MARKS AGAINST THE WORLD: per compared source, the countries at or above each mark and the largest holders, at the onset, +10 and +20 years (median over runs)');
  for (const R of Object.values(out).filter(R => ['industry', 'condition'].includes(R.kind)).sort((a, b) => a.era - b.era || (a.onset ?? 0) - (b.onset ?? 0))) {
    const bar = META.bars[R.tech]; const names = [...new Set(bar.branches.flatMap(b => b.cmps.map(c => c.name)))];
    console.log(`   ${R.tech}  (tech era ${R.era}, onset ${R.onset}, literacy ${R.lit ?? '—'}; majors short of the mark hold a median ${f1(100 * (med(R.bestWhenSrc) ?? NaN))}% of it over ${R.bestWhenSrc.length} years)`);
    for (const n of names) {
      const mins = [...new Set(bar.branches.flatMap(b => b.cmps.filter(c => c.name === n).map(c => c.min)))].sort((a, b) => a - b);
      const cells = [0, 10, 20, 40].map(dy => { const y = Math.max(1837, (R.onset ?? 1836) + dy); if (y > 1935) return null;
        const per = RUNS.map(run => { const Y = run.years.find(z => z.y >= y); const r = Y && Y.reach[n]; return { cnt: mins.map(m => r ? (r.n[m] || 0) : 0), top: r ? r.top.slice(0, 3) : [] }; });
        const cnt = mins.map((m, i) => med(per.map(p => p.cnt[i]))); const best = per.slice().sort((a, b) => ((b.top[0] || [0, 0])[1]) - ((a.top[0] || [0, 0])[1]))[Math.floor(per.length / 2)];
        return `${y}: ${cnt.join('/')} ctry; top ${best.top.map(x => `${x[0]} ${x[1]}`).join(', ') || '—'}`; }).filter(Boolean);
      console.log(`      ${n.replace(/^pmr_/, '').padEnd(34)} marks ${mins.join(' / ')}  |  ` + cells.join('  |  '));
    }
  }
}
if (opt('--json', null)) { writeFileSync(opt('--json'), JSON.stringify(out, null, 1)); console.log('json → ' + opt('--json')); }
