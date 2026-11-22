// ⭐ CAN EVERY RESEARCH ENTRY'S SOURCE EXIST? (2026-11-22, F286 §5: the mod 1.2 book turned the methods two entries count into deposit rungs,
//   and nothing failed — the entries simply never ticked for five centuries.)
//
//   node tools/lint_research_sources.mjs <modRoot> [configPath] [--tree config/tech_tree_options.<book>.json] [--warn-only] [--strict]
//
// With a configPath (how tools/preflight.ps1 calls it, landmine L56): the tree twin is the config's own, and the errors FAIL only when the
// book asks for it (`research_events.require_live_sources: true`, set by the mod 1.2 technology pass, make_book12 --tech-pass). A book
// without the key predates the check — the canon (one dead source) and m12b-first / m12c-first (three dead entries) are records that must
// still build — so its defects are PRINTED as known and the exit is 0. --strict fails on them regardless; --warn-only never fails.
//
// Reads the BUILD (the mod's own files over vanilla's, a mod file replacing the vanilla file of the same name) and walks every script value
// a research bar compares (`pmr_src_*`, `pmr_cv_*`, through their `pmr_lx_*` / `pmr_lv_*` parts) down to its building terms. Per term:
//   DEAD-BUILDING   the building type is defined nowhere
//   DEAD-METHOD     a term counts levels on a production method that none of the building's method groups offers
//   AFTER-ITSELF    the building (or every method the term counts) is unlocked by the entry's own technology or by one that needs it,
//                   so the source cannot exist while the entry is open
// and per entry: DEAD SOURCE (every term of a source is dead or after itself), DEAD ENTRY (every source is), and — a warning, never an
// error — LATE SOURCE: a source whose own gate has a later narrative onset than the technology it is to deliver, by --late-years (10).
// Also: every technology an entry requires (`has_technology_researched` beside a source) must not need the entry's own technology, and
// every ship type a naval entry names must exist.
// Exit 1 on any error under the rule above.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './lib_pdx_script.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const MOD = args[0]; if (!MOD) { console.error('usage: node tools/lint_research_sources.mjs <modRoot> [--tree <twin>] [--warn-only]'); process.exit(2); }
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LATE = +opt('--late-years', '10');
const modRoot = existsSync(MOD) ? MOD : join(REPO, MOD);
const CFGPATH = args[1] && !args[1].startsWith('--') ? args[1] : null;
const CFG = CFGPATH ? JSON.parse(readFileSync(existsSync(CFGPATH) ? CFGPATH : join(REPO, CFGPATH), 'utf8')) : null;
if (CFG && !(CFG.research_events && CFG.research_events.enabled)) { console.log('RESEARCH SOURCES: the book has no research entries - nothing to check'); process.exit(0); }
if (!existsSync(join(modRoot, 'common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt'))) { console.log(CFG ? 'RESEARCH SOURCES: FAILED - the book has research entries and the build has no research bars' : 'RESEARCH SOURCES: no research bars in this build - nothing to check'); process.exit(CFG ? 1 : 0); }
const REQUIRED = !!(CFG && CFG.research_events.require_live_sources);
const WARN_ONLY = args.includes('--warn-only') || (!!CFG && !REQUIRED && !args.includes('--strict'));
const TREE_DEFAULT = CFGPATH ? (() => { const bn = CFGPATH.replace(/\\/g, '/').split('/').pop(); const m = bn.match(/^mod_config\.(.+)\.json$/); const f = 'config/tech_tree_options' + (m ? '.' + m[1] : '') + '.json'; return existsSync(join(REPO, f)) ? f : null; })() : null;

// ---- the database the game will load: vanilla's files, minus those the mod replaces by name, then the mod's
function loadDb(rel) {
  const out = {}; const mdir = join(modRoot, 'common', rel), vdir = join(GAME, 'common', rel);
  const mfiles = existsSync(mdir) ? readdirSync(mdir).filter(f => f.endsWith('.txt')) : [];
  const files = [...(existsSync(vdir) ? readdirSync(vdir).filter(f => f.endsWith('.txt') && !mfiles.includes(f)).sort().map(f => join(vdir, f)) : []), ...mfiles.sort().map(f => join(mdir, f))];
  for (const f of files) for (const st of parse(readFileSync(f, 'utf8'))) if (st.k && st.v && st.v.b) out[st.k] = st.v.b;
  return out;
}
const words = (blk, key) => { const st = (blk || []).find(s => s.k === key); return st && st.v && st.v.b ? st.v.b.map(x => x.v && x.v.s).filter(Boolean) : []; };
const B = loadDb('buildings'), PMG = loadDb('production_method_groups'), PM = loadDb('production_methods'), TECH = loadDb('technology/technologies'), SHIP = loadDb('ship_types');
if (Object.keys(B).length < 50 || Object.keys(TECH).length < 150) throw new Error(`the database read short (${Object.keys(B).length} buildings, ${Object.keys(TECH).length} technologies) - the game path or the layout moved`);
const prereq = t => words(TECH[t], 'unlocking_technologies');
const anc = {}; const ancestors = t => { if (anc[t]) return anc[t]; const s = new Set(); anc[t] = s; for (const p of prereq(t)) { s.add(p); for (const q of ancestors(p)) s.add(q); } return s; };
const needs = (gate, tech) => gate === tech || ancestors(gate).has(tech);   // holding `gate` implies holding `tech`
const pmsOf = b => new Set(words(B[b], 'production_method_groups').flatMap(g => words(PMG[g], 'production_methods')));
const TREE = (() => { const p = opt('--tree', TREE_DEFAULT); if (!p) return null; return Object.fromEntries(JSON.parse(readFileSync(join(REPO, p), 'utf8')).options.find(o => o.ships).techs.map(t => [t.id, t])); })();
const onset = t => TREE && TREE[t] ? TREE[t].onset : null;

// ---- the entries' values and bars, as emitted
const blocks = text => { const out = {}; const re = /^([a-z_0-9]+) = \{/gm; let m; while ((m = re.exec(text))) { let i = re.lastIndex, d = 1; while (i < text.length && d > 0) { if (text[i] === '{') d++; else if (text[i] === '}') d--; i++; } out[m[1]] = text.slice(re.lastIndex, i - 1).replace(/\s+/g, ' '); re.lastIndex = i; } return out; };
const V = blocks(readFileSync(join(modRoot, 'common/script_values/zzz_pm_rehaul_research_values.txt'), 'utf8').replace(/^\uFEFF/, ''));
const BARS = blocks(readFileSync(join(modRoot, 'common/scripted_progress_bars/zzz_pm_rehaul_research_bars.txt'), 'utf8').replace(/^\uFEFF/, ''));
function terms(name, seen = new Set()) {   // the building terms a script value sums, through its parts
  if (seen.has(name) || !V[name]) return []; seen.add(name); const body = V[name]; const out = [];
  for (const m of body.matchAll(/(?:every|ordered)_scope_building = \{ limit = \{ is_building_type = ([a-z_0-9]+)(.*?)\} (?:order_by = this\.level )?add = /g))
    out.push({ building: m[1], pms: [...m[2].matchAll(/has_active_production_method = ([a-z_0-9-]+)/g)].map(x => x[1]) });
  for (const m of body.matchAll(/value = ([a-z_][a-z_0-9]*)/g)) if (V[m[1]]) out.push(...terms(m[1], seen));
  return out;
}
const errors = [], warns = []; let nEntries = 0, nSources = 0, nTerms = 0;
for (const [bar, body] of Object.entries(BARS)) {
  const tech = bar.replace(/^pmr_bar_/, ''); if (!TECH[tech]) { errors.push(`${tech}: the bar names a technology the build does not define`); continue; }
  nEntries++;
  const names = [...new Set([...body.matchAll(/(pmr_(?:src|cv)_[a-z_0-9]+) >= /g)].map(m => m[1]))];
  for (const r of new Set([...body.matchAll(/has_technology_researched = ([a-z_0-9-]+)/g)].map(m => m[1]))) {
    if (!TECH[r]) errors.push(`${tech}: requires '${r}', which the build does not define`);
    else if (needs(r, tech)) errors.push(`${tech}: AFTER-ITSELF - the entry requires ${r}, which needs ${tech}`);
    else if (onset(r) != null && onset(tech) != null && onset(r) - onset(tech) > LATE) warns.push(`${tech} (onset ${onset(tech)}): LATE REQUIREMENT - the entry requires ${r} (onset ${onset(r)})`);
  }
  for (const s of new Set([...body.matchAll(/is_ship_type = ship_type:([a-z_0-9]+)/g)].map(m => m[1]))) if (!SHIP[s]) errors.push(`${tech}: ship type '${s}' is not defined`);
  if (!names.length) continue;
  let liveSources = 0;
  for (const n of names) {
    nSources++; const ts = terms(n); let live = 0; const why = []; const lateTerms = []; let early = 0;
    if (!ts.length) { if (!/every_scope_building|ordered_scope_building/.test(V[n] || '')) { live++; } else why.push('no building term parsed'); }
    for (const t of ts) {
      nTerms++;
      if (!B[t.building]) { why.push(`DEAD-BUILDING ${t.building}`); continue; }
      const gates = words(B[t.building], 'unlocking_technologies');
      if (gates.some(g => needs(g, tech))) { why.push(`AFTER-ITSELF ${t.building} is unlocked by ${gates.filter(g => needs(g, tech)).join(', ')}`); continue; }
      if (t.pms.length) {
        const have = pmsOf(t.building); const offered = t.pms.filter(p => have.has(p)); const missing = t.pms.filter(p => !have.has(p));
        if (!offered.length) { why.push(`DEAD-METHOD ${t.building} offers none of ${t.pms.join(', ')}`); continue; }
        if (missing.length) warns.push(`${tech}: ${t.building} does not offer ${missing.join(', ')} (it offers ${offered.join(', ')})`);
        const usable = offered.filter(p => !words(PM[p], 'unlocking_technologies').some(g => needs(g, tech)));
        if (!usable.length) { why.push(`AFTER-ITSELF every counted method of ${t.building} (${offered.join(', ')}) needs ${tech}`); continue; }
        const late = usable.map(p => Math.max(...words(PM[p], 'unlocking_technologies').map(g => onset(g) ?? -Infinity), ...gates.map(g => onset(g) ?? -Infinity)));
        if (onset(tech) != null && late.every(y => y - onset(tech) > LATE)) lateTerms.push(`${t.building} on ${usable.join(' / ')} (onset ${Math.min(...late)})`); else early++;
      } else {
        const y = Math.max(...gates.map(g => onset(g) ?? -Infinity));
        if (onset(tech) != null && y - onset(tech) > LATE) lateTerms.push(`${t.building} (${gates.join(', ')}, onset ${y})`); else early++;
      }
      live++;
    }
    if (live && !early && lateTerms.length) warns.push(`${tech} (onset ${onset(tech)}): LATE SOURCE ${n} - everything it counts is gated more than ${LATE} years later: ${lateTerms.join('; ')}`);
    if (live) liveSources++; else errors.push(`${tech}: DEAD SOURCE ${n} - ${why.join('; ') || 'nothing to count'}`);
    if (live && why.length) warns.push(`${tech}: ${n} has dead parts - ${why.join('; ')}`);
  }
  if (!liveSources) errors.push(`${tech}: DEAD ENTRY - none of its ${names.length} source(s) can exist while the entry is open`);
}
console.log(`research sources: ${nEntries} entries, ${nSources} compared values, ${nTerms} building terms read from ${modRoot}`);
for (const w of warns) console.log('  warn  ' + w);
for (const e of errors) console.log((WARN_ONLY ? '  KNOWN ' : '  ERROR ') + e);
console.log(!errors.length ? `RESEARCH SOURCES OK: every source of ${nEntries} entries can exist (${warns.length} warning(s))`
  : WARN_ONLY ? `RESEARCH SOURCES: ${errors.length} known defect(s) listed, not enforced${CFG && !REQUIRED ? ' (the book predates research_events.require_live_sources)' : ''}; ${warns.length} warning(s)`
  : `RESEARCH SOURCES FAILED: ${errors.length} error(s), ${warns.length} warning(s)`);
if (errors.length && !WARN_ONLY) process.exit(1);
