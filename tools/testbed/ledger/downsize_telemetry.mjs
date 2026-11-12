// Auto-downsizing read from the telemetry poll (telemetry v15, metric `downsizing`, on by default through the scheduler's downsize
// feed; FINDINGS F260 for the engine's rule and the save-based reading this replaces).
//
//   node tools/testbed/ledger/downsize_telemetry.mjs <label>=<group>[:<setup>] [...] [--list] [--types N] [--from Y] [--to Y]
//        [--config <book>] [--json <out.json>]
//
// <group> = a session, a comma list of sessions, or <session>/runNNN_<setup> folders (lib_runs: usable runs only). Each run's harness.log
// carries, per monthly poll, a DZ line for every producing building that qualified for auto-downsizing at the previous poll (not wholly
// owned by a country, under 90% staffed, at least one empty level) and has fewer levels now (DZ|date|country|state|type|level before|
// level now|private before|private now|employment now) and a DZM line closing the poll (tracked, read, drops, over). A run with no DZM
// line carried no poll (an older schema, or the feed was off): it is left out of the arm and printed, never read as a zero.
//
// A drop is AUTO-DOWNSIZING when its private levels fell, its government levels did not, and it lost at most 5 levels since the last
// poll (the engine takes one level a week; a month holds at most five weekly ticks). The levels counted are the private levels lost. Every
// other drop is printed by its reason, never silently skipped. A building that lost its LAST level is still logged, from its state's list,
// with an empty country, the state NULL_STATE and id -1: it counts, and is printed apart. Drops in a state where three or more buildings
// dropped in the same poll are printed apart too, but kept: the poll tracks only buildings that already qualify, and such clusters were a
// state in decline in the probes, not a split (F261; F260's save route needed that rule as a filter). The VOLUME comes first (the user,
// 2026-10-30: "what's important is to catch the downsize volumes reasonably reliably ... we don't absolutely have to measure the reason"):
// per run, every level lost on a tracked building, then the auto-downsizing subset. Per arm: auto-downsized private levels per run
// (mean), by decade and by building type.
//
// ⭐ THE RULED READING (BALANCE_FRAMEWORK §10.107, 2026-10-31; in this reader since the 2026-10-30 batch ended):
//   - LEVELS, by tier class: t0 crafts · t0 non-craft · t1 · t2 · t3 · outside the ladder. A merged host's levels are split by the share of
//     its levels on each main method at the nearest sampled save; a vanilla industry building's by the canon rung made from its active
//     method (the --config book maps vanilla methods to rungs). A total across classes is printed only beside its parts.
//   - Beside the levels, never instead of them: POSSIBLE WORKFORCE (levels lost × the jobs a level of the type offered, its methods'
//     building_employment_*_add weighted by the type's world-wide method mix at the nearest sampled save) and CAPITAL DESTROYED (levels lost
//     × the type's required_construction, construction points). Both read from the run's own built mod over vanilla's files (a control:
//     vanilla alone). ⚠ The built mod is the scheduler's build folder (build_state.json), which the NEXT batch overwrites: read a batch
//     before another one builds. Vanilla's files come from VIC3_GAME (default the Steam path): after a game patch, point VIC3_GAME at a
//     copy of the version the batch ran on.
//   - LEFT OUT OF EVERY MEASURE (§10.107.5), volumes included: gold fields, auto-scaling buildings (subsistence of any kind, urban centres,
//     manor houses, financial districts, company and regional HQs) and non-economic ones (military, government, universities,
//     construction sectors, monuments, canals). Printed by type.
//   - A poll on the 1st reports the month before it, so a drop logged on 1 January belongs to the year before.
//   - WORLD and SHORTLIST (lib_markets POOL; §10.107.6). ⚠ A DZ line names its country by DISPLAY name (telemetry v15), so a drop is placed
//     by the game's own name tables: a name is the shortlist's when every tag that can bear it (its base name, its dynamic names) is in the
//     pool. A revolution that takes a shortlist country's name counts with it; a name shared with a tag outside the pool, an unknown name
//     and a building's last level (no country) count in the world only — each printed with its levels. From 2026-11-08 the DZX line carries the
//     owner's tag (tag=): a drop that has one is placed by it, exactly.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { SESSIONS } from './lib_sumidx.mjs';
import { POOL } from './lib_markets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LIST = args.includes('--list'), TYPES = +opt('--types', 15), FROM = +opt('--from', 0), TO = +opt('--to', 9999);
const BOOK = path.resolve(ROOT, opt('--config', 'config/mod_config.json')), JSON_OUT = opt('--json', null);
// --mod-path <dir> (2026-11-12): the built mod to read a config run's jobs and costs from when the folder its build_state.json records is gone
//   (the scheduler's build folder is overwritten or removed by the next build). Without it a missing folder THROWS: the reader used to fall
//   back to vanilla's files alone, which know none of the rungs, and only warned that their methods' jobs count 0. Name a build of the same
//   book on the same game version.
const MOD_PATH = opt('--mod-path', null) ? path.resolve(ROOT, opt('--mod-path', null)) : null;
const armArgs = args.filter((a, i) => a.includes('=') && !args[i - 1]?.startsWith('--'));
if (!armArgs.length) {
  console.error('usage: downsize_telemetry.mjs <label>=<group>[:<setup>] [...] [--list] [--types N] [--from Y] [--to Y] [--config <book>] [--mod-path <dir>] [--json <out>]');
  process.exit(2);
}

const CLASSES = ['t0 craft', 't0 non-craft', 't1', 't2', 't3', 'outside the ladder'];
// left out of every measure (§10.107.5, the user, 2026-10-31)
const EXCLUDED = t => t === 'building_gold_field' || /^building_subsistence_/.test(t) || /^building_company_/.test(t)
  || ['building_urban_center', 'building_manor_house', 'building_financial_district', 'building_regional_hq', 'building_barrack',
    'building_barracks', 'building_conscription_center', 'building_government_administration', 'building_university',
    'building_construction_sector', 'building_power_bloc_statue'].includes(t)
  || /^building_naval_/.test(t) || /_canal$/.test(t) || /monument|statue/.test(t);

// ---- the ladder of a book: the tier class of every rung building, of every main method, and of the vanilla method each rung was made from
const ladderCache = new Map();
function ladderOf(cfgPath) {
  if (!ladderCache.has(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
    const L = { types: {}, pm: {}, vanPm: {}, vanTypes: new Set() };
    const cls = t => t.era === 0 ? (t.craft ? 't0 craft' : 't0 non-craft') : `t${t.era}`;
    for (const I of cfg.industries || []) {
      if (I.disabled) continue;
      if (I.tiers?.[0]) L.vanTypes.add(I.tiers[0].key);
      for (const k of I.building?.aliases || []) L.vanTypes.add(k);
      for (const t of I.tiers || []) {
        if (t.pm_key) L.pm[t.pm_key] = cls(t);
        if (t.vanilla_pm) L.vanPm[t.vanilla_pm] = cls(t);
        if (!t.method_of) L.types[t.key] = cls(t);
      }
    }
    ladderCache.set(cfgPath, L);
  }
  return ladderCache.get(cfgPath);
}

// ---- game files: top-level blocks, vanilla's files minus those the mod replaces by name, then the mod's (a later key wins)
function blocks(text) {
  const res = {}, re = /^([A-Za-z0-9_-]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(text))) {
    let i = re.lastIndex, d = 1;
    while (i < text.length && d) { const c = text[i++]; if (c === '{') d++; else if (c === '}') d--; }
    res[m[1]] = text.slice(re.lastIndex, i - 1); re.lastIndex = i;
  }
  return res;
}
const readScript = f => fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/#[^\n]*/g, '');
function scriptFiles(sub, modPath) {
  const vdir = path.join(GAME, 'common', sub), mdir = modPath ? path.join(modPath, 'common', sub) : null;
  const mf = mdir && fs.existsSync(mdir) ? fs.readdirSync(mdir).filter(f => f.endsWith('.txt')).sort() : [];
  return [...fs.readdirSync(vdir).filter(f => f.endsWith('.txt') && !mf.includes(f)).sort().map(f => path.join(vdir, f)),
    ...mf.map(f => path.join(mdir, f))];
}
const gameCache = new Map();
function gameData(modPath) {
  const key = modPath || '<vanilla>';
  if (gameCache.has(key)) return gameCache.get(key);
  const emp = {}, sv = {}, cost = {};
  for (const f of scriptFiles('production_methods', modPath)) for (const [k, body] of Object.entries(blocks(readScript(f)))) {
    let e = 0; for (const x of body.matchAll(/building_employment_[a-z_]+_add\s*=\s*(-?[\d.]+)/g)) e += +x[1];
    emp[k] = e;
  }
  for (const f of scriptFiles('script_values', modPath)) for (const m of readScript(f).matchAll(/^([A-Za-z0-9_]+)\s*=\s*(-?[\d.]+)\s*$/gm)) sv[m[1]] = +m[2];
  for (const f of scriptFiles('buildings', modPath)) for (const [k, body] of Object.entries(blocks(readScript(f)))) {
    const m = /required_construction\s*=\s*([A-Za-z0-9_.]+)/.exec(body);
    if (m) cost[k] = /^[\d.]+$/.test(m[1]) ? +m[1] : sv[m[1]];
  }
  const d = { emp, cost };
  gameCache.set(key, d);
  return d;
}

// ---- the shortlist by display name: every name a tag can bear (localization base name + dynamic names) → the tags bearing it
let NAMES = null;
function names() {
  if (NAMES) return NAMES;
  const loc = new Map(), walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.yml')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/^\s*([A-Za-z0-9_.\-]+):\d*\s*"(.*)"\s*$/gm)) loc.set(m[1], m[2]);
  } };
  walk(path.join(GAME, 'localization', 'english'));
  NAMES = new Map();
  const bear = (name, tag) => { if (!name) return; const s = NAMES.get(name) || new Set(); s.add(tag); NAMES.set(name, s); };
  for (const [k, v] of loc) if (/^[A-Z][A-Z0-9]{2}$/.test(k)) bear(v, k);
  const dyn = path.join(GAME, 'common', 'dynamic_country_names');
  for (const f of fs.readdirSync(dyn).filter(f => f.endsWith('.txt')))
    for (const [tag, body] of Object.entries(blocks(readScript(path.join(dyn, f)))))
      for (const m of body.matchAll(/\bname\s*=\s*([A-Za-z0-9_.]+)/g)) bear(loc.get(m[1]), tag);
  return NAMES;
}
const scopeOf = country => {
  if (!country) return 'no country (a last level)';
  const tags = names().get(country);
  if (!tags) return 'unknown name';
  const inPool = [...tags].filter(t => POOL.includes(t)).length;
  return inPool === tags.size ? 'pool' : inPool ? 'name shared with a tag outside the pool' : 'world';
};

// ---- one run
const usedModPath = new Set();
const SAMPLE = new Set([1935]); for (let y = 1836; y <= 1935; y += 3) SAMPLE.add(y);
function readRun(rel) {
  const dir = path.join(SESSIONS, rel), log = path.join(dir, 'harness.log');
  if (!fs.existsSync(log)) throw new Error(`${rel}: no harness.log`);
  const bs = JSON.parse(fs.readFileSync(path.join(dir, 'build_state.json'), 'utf8')).deterministic;
  const control = bs.arm === 'control', cfgPath = bs.mod_under_test?.built_from_config;
  const L = ladderOf(!control && cfgPath && fs.existsSync(cfgPath) ? cfgPath : BOOK);
  const dz = [], polls = new Map(), excluded = {};
  // the date is the engine's display string ("January 1, 1836"); the year is its last number
  const yearOf = d => { const m = /(\d{3,4})\s*$/.exec(d); if (!m) throw new Error(`${rel}: unreadable date '${d}'`); return +m[1]; };
  // a poll on the 1st reports the month before it: a drop logged on 1 January belongs to the year before (§10.107)
  const yearFor = d => yearOf(d) - (/^January 1,/.test(d) ? 1 : 0);
  const kv = fields => Object.fromEntries(fields.map(x => x.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, +v]));
  // ⚠ harness.log can hold one line twice, its place names decoded two ways (the live mirror and the streamed copy), so a drop is
  // keyed by its date and its building id (the DZX line that follows it) and counted once
  const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/), seen = new Set();
  let dupes = 0;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split('|');
    if (f[2] === 'DZ' && f.length >= 12) {
      const [date, country, state, type] = f.slice(3, 7), [l0, l1, p0, p1] = f.slice(7, 11).map(Number), emp = f[11];
      if ([l0, l1, p0, p1].some(x => !Number.isFinite(x))) throw new Error(`${rel}: unreadable DZ line: ${lines[i]}`);
      const x = (lines[i + 1] || '').split('|');
      const id = x[2] === 'DZX' && x[3] === date && x[6] === type ? (/id=([^|\s]+)/.exec(lines[i + 1]) || [])[1] : null;
      // a destroyed building (its last level gone) prints id -1 and NULL_STATE; its lines carry no place name, so they never repeat
      const vanished = id === '-1' || state === 'NULL_STATE';
      // since 2026-11-08 the DZX line carries the owner's TAG (tag=, GetTagName); older lines place a drop by its country's display name
      const tag = x[2] === 'DZX' && x[3] === date && x[6] === type ? (/tag=([A-Za-z0-9_]+)/.exec(lines[i + 1]) || [])[1] || null : null;
      const key = vanished ? `vanished|${i}` : `${date}|${id ?? `${type}|${l0}|${l1}|${p0}|${p1}|${emp}`}`;
      if (seen.has(key)) { dupes++; continue; }
      seen.add(key);
      if (EXCLUDED(type)) { excluded[type] = (excluded[type] || 0) + Math.max(0, p0 - p1); continue; }
      dz.push({ date, year: yearFor(date), country, state, type, l0, l1, p0, p1, emp, id, tag, vanished });
    } else if (f[2] === 'DZM') polls.set(`${yearOf(f[3])}|${f[3].split(' ')[0]}`, { year: yearFor(f[3]), ...kv(f.slice(4)) });
  }
  // state clusters: three or more buildings of one state dropping in the same poll (printed, kept)
  const perState = new Map();
  for (const d of dz) if (!d.vanished) { const k = `${d.date}|${d.country}|${d.state}`; perState.set(k, (perState.get(k) || 0) + 1); }
  for (const d of dz) {
    const gov0 = d.l0 - d.p0, gov1 = d.l1 - d.p1;
    d.priv = d.p0 - d.p1;
    d.cluster = !d.vanished && perState.get(`${d.date}|${d.country}|${d.state}`) >= 3;
    d.reason = gov1 < gov0 ? 'government levels fell' : d.priv <= 0 ? 'no private level lost'
      : d.l0 - d.l1 > 5 ? 'too fast (> 5 levels a month)' : 'auto';
  }
  let modPath = control ? null : bs.mod_under_test?.path;
  if (modPath && !fs.existsSync(path.join(modPath, 'common'))) {
    if (!MOD_PATH) throw new Error(`${rel}: its built mod ${modPath} is gone; pass --mod-path <a build of the same book on the same game version>`);
    if (!usedModPath.has(modPath)) { usedModPath.add(modPath); console.log(`  ⚠ ${modPath} is gone: jobs and costs read from --mod-path ${path.relative(ROOT, MOD_PATH)}`); }
    modPath = MOD_PATH;
  }
  return { rel, dir, control, modPath, L, polls, excluded, dupes,
    dz: dz.filter(d => d.year >= FROM && d.year < TO) };
}

// the method mix and jobs per level of every building type, from the run's own save summaries (the LAST summary of a sampled year: a
// resume's replayed branch overwrites the abandoned one)
function mixOf(R) {
  const sdir = path.join(R.dir, 'save_summaries'), G = gameData(R.modPath), PM = R.control ? R.L.vanPm : R.L.pm;
  const shares = {}, jobs = {}, missingPM = new Set();
  for (const f of fs.readdirSync(sdir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sdir, f))).toString('utf8'));
    const yr = +String(j.provenance.date).split('.')[0];
    if (!SAMPLE.has(yr)) continue;
    shares[yr] = {}; jobs[yr] = {};
    for (const [t, b] of Object.entries(j.world.buildings || {})) {
      const m = {}; let s = 0, e = 0;
      for (const [pm, n] of Object.entries(b.pms || {})) {
        if (PM[pm]) { m[PM[pm]] = (m[PM[pm]] || 0) + n; s += n; }
        if (pm in G.emp) e += n * G.emp[pm]; else missingPM.add(pm);
      }
      if (s) { for (const k in m) m[k] /= s; shares[yr][t] = m; }
      if (b.levels) jobs[yr][t] = e / b.levels;
    }
  }
  const years = Object.keys(shares).map(Number);
  const nearest = (y, get) => { for (const yy of [...years].sort((a, b) => Math.abs(a - y) - Math.abs(b - y))) { const v = get(yy); if (v != null) return v; } return null; };
  return { share: (y, t) => nearest(y, yy => shares[yy][t]), jobs: (y, t) => nearest(y, yy => jobs[yy][t]), cost: t => G.cost[t], missingPM };
}

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const sd = a => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : NaN; };
const k1 = x => Number.isFinite(x) ? (x / 1e3).toFixed(1) + 'k' : '—';
const out = {};
console.log(`game files: ${GAME}${process.env.VIC3_GAME ? ' (VIC3_GAME)' : ''} · vanilla methods mapped by ${path.relative(ROOT, BOOK)}`);
for (const a of armArgs) {
  const [label, spec] = a.split(/=(.*)/s);
  const [group, setup = ''] = spec.split(':');
  const { runs: usable, dropped } = usableRuns(SESSIONS, group, setup);
  console.log(`\n=== ${label}: ${usable.length} usable run(s) of ${group}${setup ? ':' + setup : ''}`);
  reportDropped(dropped);
  const per = [], byDecade = new Map(), byType = new Map(), reasons = new Map(), apart = { vanished: [0, 0], cluster: [0, 0] };
  const excluded = {}, unresolved = { jobs: {}, cost: {} }, scopes = {}, missingPM = new Set(), noPoll = [];
  const decades = { world: {}, pool: {} }, runsOut = [];
  const add = (o, c, v) => { const x = o[c] || (o[c] = [0, 0, 0]); v.forEach((z, i) => x[i] += z); };
  let kind = null;
  for (const rel of usable) {
    const R = readRun(rel);
    const months = [...R.polls.values()].filter(p => p.year >= FROM && p.year < TO);
    if (!months.length) { noPoll.push(rel); continue; }
    kind ??= R.control ? 'control' : 'config';
    const auto = R.dz.filter(d => d.reason === 'auto');
    per.push({ rel, allDrops: R.dz.length, allLevels: R.dz.reduce((s, d) => s + d.l0 - d.l1, 0),
      drops: auto.length, levels: auto.reduce((s, d) => s + d.priv, 0), polls: months.length,
      tracked: mean(months.map(p => p.tracked)), over: months.reduce((s, p) => s + (p.over || 0), 0), dupes: R.dupes });
    for (const [t, v] of Object.entries(R.excluded)) excluded[t] = (excluded[t] || 0) + v;
    for (const d of R.dz) { const r = reasons.get(d.reason) || { drops: 0, levels: 0 }; r.drops++; r.levels += d.l0 - d.l1; reasons.set(d.reason, r); }
    const X = auto.length ? mixOf(R) : null, run = { rel, world: {}, pool: {} };
    if (X) X.missingPM.forEach(p => missingPM.add(p));
    for (const d of auto) {
      for (const k of ['vanished', 'cluster']) if (d[k]) { apart[k][0]++; apart[k][1] += d.priv; }
      const dec = Math.floor(d.year / 10) * 10;
      byDecade.set(dec, (byDecade.get(dec) || 0) + d.priv);
      const ladder = R.control ? R.L.vanTypes.has(d.type) : d.type in R.L.types;
      const t = byType.get(d.type) || { levels: 0, drops: 0, tier: R.control ? (ladder ? 'industry' : '-') : (R.L.types[d.type] || '-') };
      t.levels += d.priv; t.drops++; byType.set(d.type, t);
      // the two like-for-like measures, then the tier split
      const jobs = X.jobs(d.year, d.type), cp = X.cost(d.type);
      if (jobs == null) unresolved.jobs[d.type] = (unresolved.jobs[d.type] || 0) + d.priv;
      if (cp == null) unresolved.cost[d.type] = (unresolved.cost[d.type] || 0) + d.priv;
      const v = [d.priv, d.priv * (jobs || 0), d.priv * (cp || 0)];
      const sh = !ladder ? { 'outside the ladder': 1 } : X.share(d.year, d.type) || { [R.control ? 'industry, method unknown' : R.L.types[d.type]]: 1 };
      const sc = d.tag ? (POOL.includes(d.tag) ? 'pool' : 'world') : scopeOf(d.vanished ? '' : d.country), nm = d.vanished ? '(a last level)' : d.country;
      const s = scopes[sc] || (scopes[sc] = { levels: 0, names: {} });
      s.levels += d.priv;
      if (sc !== 'pool' && sc !== 'world') s.names[nm] = (s.names[nm] || 0) + d.priv;
      for (const [c, w] of Object.entries(sh)) {
        const vw = v.map(z => z * w);
        add(run.world, c, vw); add(decades.world[dec] || (decades.world[dec] = {}), c, vw);
        if (sc === 'pool') { add(run.pool, c, vw); add(decades.pool[dec] || (decades.pool[dec] = {}), c, vw); }
      }
      if (LIST) console.log(`  ${rel}  ${d.date}  ${d.country} / ${d.state}  ${d.type}  ${d.l0}->${d.l1}  private ${d.p0}->${d.p1}  employment ${d.emp}`);
    }
    runsOut.push(run);
  }
  if (noPoll.length) console.log(`  ⚠ ${noPoll.length} run(s) carried no downsizing poll (no DZM line: an older schema, or the feed was off) - left out of the arm, not read as zero`);
  const n = per.length;
  if (!n) { out[label] = { group, setup, n: 0, noPoll }; continue; }
  console.log('\nper run: ALL drops · ALL levels lost (the volume) · auto-downsizing drops · their private levels · polls read · buildings tracked per poll (mean) · duplicate lines dropped');
  for (const p of per) console.log(`  ${p.rel.padEnd(60)} ${String(p.allDrops).padStart(6)} ${String(p.allLevels).padStart(7)} ${String(p.drops).padStart(6)} ${String(p.levels).padStart(7)} ${String(p.polls).padStart(6)} ${p.tracked.toFixed(0).padStart(7)} ${String(p.dupes).padStart(6)}`);
  if (per.some(p => p.over)) console.log(`  ⚠ ${per.reduce((s, p) => s + p.over, 0)} building-polls too large to remember (4,096 levels or more) - not tracked`);
  console.log(`  mean of ${n}: ${mean(per.map(p => p.allLevels)).toFixed(1)} levels lost a run in ${mean(per.map(p => p.allDrops)).toFixed(1)} drops; `
    + `auto-downsizing ${mean(per.map(p => p.levels)).toFixed(1)} private levels in ${mean(per.map(p => p.drops)).toFixed(1)} drops`);
  const ex = Object.entries(excluded).sort((x, y) => y[1] - x[1]);
  console.log(`  left out of every measure (§10.107.5; private levels lost, all runs): ${ex.length ? ex.map(([t, v]) => `${t} ${v}`).join(' · ') : 'none'}`);
  console.log('\nall level drops on tracked buildings, by reason (levels = total levels lost, all runs):');
  for (const [r, v] of [...reasons].sort((x, y) => y[1].levels - x[1].levels)) console.log(`  ${r.padEnd(30)} ${String(v.drops).padStart(6)} drops ${String(v.levels).padStart(7)} levels`);
  console.log(`  of the auto drops: ${apart.vanished[0]} took a building's last level (${apart.vanished[1]} private levels; no country, state or id), `
    + `${apart.cluster[0]} fell in a state where 3+ buildings dropped in the same poll (${apart.cluster[1]} private levels; kept)`);
  console.log('\nauto-downsized private levels by decade (mean a run; a 1 January poll counts in the year before):');
  console.log('  ' + [...byDecade].sort((x, y) => x[0] - y[0]).map(([d, v]) => `${d}s ${(v / n).toFixed(1)}`).join(' · '));
  if (TYPES > 0) {
    console.log(`\nby building type (top ${TYPES}; private levels lost, mean a run · drops, all runs · tier):`);
    for (const [k, v] of [...byType].sort((x, y) => y[1].levels - x[1].levels).slice(0, TYPES))
      console.log(`  ${k.padEnd(48)} ${(v.levels / n).toFixed(1).padStart(7)} ${String(v.drops).padStart(6)}  ${v.tier}`);
  }
  // §10.107: by tier class, levels · possible workforce · construction points, mean a run with its spread
  const cats = [...CLASSES, ...new Set(runsOut.flatMap(r => Object.keys(r.world)).filter(c => !CLASSES.includes(c)))];
  const totals = {};
  for (const scope of ['world', 'pool']) {
    totals[scope] = {};
    console.log(`\n§10.107 by tier class, ${scope === 'pool' ? 'shortlist' : 'world'} (mean a run ± sd over runs): levels · possible workforce · construction points`);
    for (const c of [...cats, 'all']) {
      const vals = i => runsOut.map(r => c === 'all' ? Object.values(r[scope]).reduce((s, v) => s + v[i], 0) : (r[scope][c] || [0, 0, 0])[i]);
      const m = [0, 1, 2].map(i => mean(vals(i))), s = [0, 1, 2].map(i => sd(vals(i)));
      totals[scope][c] = { mean: m, sd: s };
      console.log(`  ${c.padEnd(26)} ${m[0].toFixed(1).padStart(7)} ± ${s[0].toFixed(1).padEnd(6)} ${k1(m[1]).padStart(8)} jobs ± ${k1(s[1]).padEnd(7)} ${k1(m[2]).padStart(8)} pts ± ${k1(s[2])}`);
    }
  }
  const top = o => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ');
  console.log(`\nplaced by display name (private levels, all runs): ${Object.entries(scopes).map(([k, v]) => `${k} ${v.levels}`).join(' · ')}`);
  for (const [k, v] of Object.entries(scopes)) if (k !== 'pool' && k !== 'world') console.log(`  ${k} (world only): ${top(v.names)}`);
  if (Object.keys(unresolved.jobs).length) console.log(`  ⚠ no jobs per level found (counted as 0 jobs): ${top(unresolved.jobs)}`);
  if (Object.keys(unresolved.cost).length) console.log(`  ⚠ no construction cost found (counted as 0 points): ${top(unresolved.cost)}`);
  if (missingPM.size) console.log(`  ⚠ ${missingPM.size} production method(s) in the summaries with no definition in the game files read (their jobs count 0): ${[...missingPM].slice(0, 6).join(', ')}`);
  const meanDec = D => Object.fromEntries(Object.entries(D).map(([dec, o]) => [dec, Object.fromEntries(Object.entries(o).map(([c, v]) => [c, v.map(z => z / n)]))]));
  out[label] = { group, setup, n, noPoll, kind, classes: cats, totals, decades: { world: meanDec(decades.world), pool: meanDec(decades.pool) },
    runs: runsOut, excluded, placed: Object.fromEntries(Object.entries(scopes).map(([k, v]) => [k, v.levels])), unresolved };
}
if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(out)); console.log(`\nwrote ${JSON_OUT}`); }
