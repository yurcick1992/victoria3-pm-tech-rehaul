// THE CRAFT RUNGS' 1836 START: WHO OWNS THEM, AND THEIR WORKFORCE IN THE RIGHT PROFESSIONS (BALANCE_FRAMEWORK §10.91.1 item 6,
// user-ruled 2026-09-30: "We also need to remember to convert the converted factories' workforce into correct professions as well,
// that's a must" and "Don't forget to tune 1836 workers to recipes").
//
//   node tools/emit_craft_start.mjs <modRoot> [configPath]       # called by tools/build.ps1, AFTER convert_history + emit_secondaries
//
// ⭐ PART 1 — OWNERSHIP (found by the first probe, session 20260930_171147, FINDINGS F181). convert_history multiplies EVERY
// `levels=` line of a craft block by 1/workforce_mult, ownership entries included — and the engine SIZES an owner building (a
// financial district, a manor house) by the levels it owns at the start. So a financial district that owned 2 levels of a canon
// e0 grew to own 20 craft levels and got 20 levels itself: world-wide +693 financial-district levels (Austria 36 → 164), +5
// urbanization each (Austria's urban centres 25 → 33), and their capitalist and clerk jobs. The capital did not change, only the
// level count. So an owner-building entry of a craft block keeps its ORIGINAL level count, and the other (div − 1)/div of those
// levels become SELF-owned in the craft's own state — the masters own the rest (76% of the 1836 craft levels were self-owned
// already). Government (`country={…}`) entries create no owner building and keep the ×div. Owner buildings, urbanization and
// the capitalists' jobs stay at the canon's; only the dividend split of the ~15% financial-district-owned craft capital moves.
//
// PART 2 — THE WORKFORCE (below).
//
// ⭐ PART S — OUTPUT-MATCHED SEEDING (user-ruled 2026-10-01, BALANCE_FRAMEWORK §10.91.5, FINDINGS F197 §4), only when the book carries
// `_artisan.seed` (make_artisan_config --seed <cities>). Per country and craft industry, the craft levels the vanilla e0 factories became
// (the emitted map, after the ×10) are topped up until they make what those factories made in vanilla; the extra levels go to the country's
// `cities` most urbanised states (Σ building levels × the group's urbanization, subsistence excluded — the F13 sum), in proportion, each city
// capped by its spare 1836.2.1 infrastructure (the excess spills down the urbanisation order; what fits nowhere is dropped and reported). The
// seeded workforce is NEW typed pops — each profession with the country's most numerous culture-religion of that profession at 1836.2.1
// (config/measured_1836_pop_identity.json, tools/testbed/melted_pop_identity.mjs; none → the first primary culture + state religion,
// reported) — and the SAME number of people comes off the untyped pops of that state (never more than its 1836.2.1 peasants, never under 10%
// of a block, any culture or religion), else off the country's state with the most peasants left: vanilla's head count holds. A country
// whose peasants cannot cover its seeding is seeded as far as they do and reported. Seeded levels join the state's own craft block of that
// type (its self-owned entry) or a new self-owned block. Without `_artisan.seed` this file emits exactly what it did before (proven by
// building one book with both versions and diffing common/history: identical).
//
// WHY. Vanilla's 1836 pops are almost all UNTYPED (`create_pop = { culture = X size = N }`; of 4,454 blocks the typed ones are slaves
// and a few elites), and the engine hands them to the jobs it finds at game start. A craft rung employs 30–50% machinists in the ruled
// staffing, and machinists can only be recruited from pops above 10% literacy — while the crafts stand mostly in China, Russia, India,
// Austria and the Ottoman lands (FINDINGS F180 §2: vanilla China has 31,831 machinists in 1837; its crafts need ~392k). So the pops
// that WORK in the converted factories are converted into their professions in the history itself.
//
// WHAT. For every state holding craft levels on the emitted 1836 map (history/buildings, after the ×10 conversion), per region_state:
//   workforce(p) = Σ over its craft buildings of levels × (base employment × workforce_mult + the active secondaries' employment)
// for every profession but laborers (the untyped remainder fills the laborer slots as it always did), and pop size = workforce ÷
// WORKING_ADULT_RATIO_BASE (0.25, read from the defines). That many people are CARVED out of the state's own untyped pops — the largest
// simple block first (same culture, same religion), never more than 90% of a block — into typed blocks. POPULATION IS UNCHANGED.
//
// HOW IT SHIPS. The vanilla pops files that contain such a state are copied WHOLE into <mod>/common/history/pops/ under their own names
// (a same-path file shadows vanilla's), with exactly those size lines changed and those typed blocks added; every other byte is
// vanilla's. Files without a craft state are not emitted. ⚠ build.ps1 never wipes common/history, so a book without crafts REMOVES any
// file this tool wrote earlier (recognised by its header), or a canon build would keep an earlier craft book's pops.
//
// THROWS on: a craft building in a state/region_state the pops history does not define; not enough untyped pops to carve; a history
// block whose levels cannot be read; a secondary method whose employment is unknown.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_craft_start.mjs <modRoot> [configPath]'); process.exit(2); }
const CFGP = process.argv[3] || join(REPO, 'config/mod_config.json');
const CFG = JSON.parse(readFileSync(CFGP, 'utf8').replace(/^\uFEFF/, ''));
const die = m => { throw new Error('emit_craft_start: ' + m); };
const rd = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const MARK = '# GENERATED by tools/emit_craft_start.mjs';
const OLD_MARKS = [MARK, '# GENERATED by tools/emit_craft_pops.mjs'];   // the tool's first name (2026-09-30)
const POPDIR = join(MOD, 'common/history/pops');

// ---- craft rungs in this book
const CRAFT = {};
for (const ind of CFG.industries || []) { if (ind.disabled) continue; for (const t of ind.tiers || []) if (t.craft) CRAFT[t.key] = { ind, t }; }

// ---- stale output from an earlier book goes first, whatever this book does
let removed = 0;
if (existsSync(POPDIR)) for (const f of readdirSync(POPDIR)) {
  const p = join(POPDIR, f);
  try { const t = rd(p); if (OLD_MARKS.some(m => t.startsWith(m))) { unlinkSync(p); removed++; } } catch { /* not ours */ }
}
if (!Object.keys(CRAFT).length) {
  console.log(`craft start: no craft rungs in this book - nothing emitted${removed ? `; removed ${removed} stale file(s) an earlier craft book left` : ''}`);
  process.exit(0);
}

// ---- the working-adult ratio the engine uses for a fresh pop (defines)
let WAR = 0.25;
{ const m = /WORKING_ADULT_RATIO_BASE\s*=\s*([0-9.]+)/.exec(rd(join(GAME, 'common/defines/00_defines.txt'))); if (m) WAR = +m[1]; }

// ---- employment per level of every method a craft building can name: the emitted per-rung secondaries first, vanilla second
const blocksOf = t => { const o = {}; const re = /^([A-Za-z_0-9-]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(t))) { let i = re.lastIndex, d = 1; while (i < t.length && d > 0) { if (t[i] === '{') d++; else if (t[i] === '}') d--; i++; } o[m[1]] = t.slice(re.lastIndex, i - 1); re.lastIndex = i; }
  return o; };
const PMB = {};
for (const f of readdirSync(join(GAME, 'common/production_methods'))) Object.assign(PMB, blocksOf(rd(join(GAME, 'common/production_methods', f))));
{ const own = join(MOD, 'common/production_methods'); if (existsSync(own)) for (const f of readdirSync(own)) Object.assign(PMB, blocksOf(rd(join(own, f)))); }
const empOf = pm => { const b = PMB[pm]; if (b == null) return null; const e = {};
  for (const m of b.matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) e[m[1]] = (e[m[1]] || 0) + +m[2];
  return e; };

// ---- a brace walker that reports every block with its path of named ancestors
function walk(text, onBlock) {
  const stack = []; const re = /([A-Za-z_0-9:.\-]+)\s*=\s*\{|\{|\}|#[^\n]*/g; let m;
  while ((m = re.exec(text))) {
    if (m[0][0] === '#') continue;
    if (m[0] === '}') { const b = stack.pop(); if (b && b.name) onBlock(b, stack, m.index + 1); continue; }
    stack.push({ name: m[1] || null, start: m.index, open: re.lastIndex });
  }
  if (stack.length) die('unbalanced braces');
}
const ctx = stack => {
  let st = null, tag = null;
  for (const b of stack) { if (b.name && b.name.startsWith('s:')) st = b.name.slice(2); if (b.name && b.name.startsWith('region_state:')) tag = b.name.slice(13); }
  return { st, tag };
};

// ---- 0. ownership: owner-building entries of craft blocks back to their original levels, the rest self-owned
const HB0 = join(MOD, 'common/history/buildings');
if (!existsSync(HB0)) die(`no emitted history at ${HB0} — run after convert_history`);
const own = { entries: 0, restored: 0, toSelf: 0, blocks: 0, byType: {} };
for (const f of readdirSync(HB0).filter(x => x.endsWith('.txt'))) {
  const raw = readFileSync(join(HB0, f), 'utf8');
  const bom = raw.charCodeAt(0) === 0xFEFF ? '﻿' : ''; const text = bom ? raw.slice(1) : raw;
  const reps = [];   // { start, end, text } replacements of whole create_building blocks
  walk(text, (b, stack, end) => {
    if (b.name !== 'create_building') return;
    const body = text.slice(b.open, end - 1);
    const km = /building\s*=\s*"([a-z_0-9-]+)"/.exec(body); if (!km || !CRAFT[km[1]]) return;
    const key = km[1]; const { t } = CRAFT[key];
    const div = Math.round(1 / (+t.workforce_mult || 1)); if (div <= 1) return;
    const { st, tag } = ctx(stack);
    const ao = /add_ownership\s*=\s*\{/.exec(body); if (!ao) die(`${f}: a ${key} block in ${st} has no add_ownership`);
    // the ownership block's extent inside the body
    let i = ao.index + ao[0].length, d = 1; while (i < body.length && d > 0) { if (body[i] === '{') d++; else if (body[i] === '}') d--; i++; }
    const aoOpen = ao.index + ao[0].length, aoClose = i - 1;   // aoClose = the ownership block's closing brace
    let inner = body.slice(aoOpen, aoClose);
    let moved = 0, selfEntry = false;
    inner = inner.replace(/(building\s*=\s*\{)([^{}]*)(\})/g, (whole, a, e, z) => {
      own.entries++;
      const ty = (/type\s*=\s*"([a-z_0-9-]+)"/.exec(e) || [])[1];
      const rg = (/region\s*=\s*"([A-Za-z_0-9-]+)"/.exec(e) || [])[1];
      if (ty === key) { if (rg === st) selfEntry = true; return whole; }
      const lm = /levels\s*=\s*(\d+)/.exec(e); if (!lm) die(`${f}: ${key} in ${st}: an ownership entry of ${ty} has no levels`);
      const L = +lm[1]; if (L % div) die(`${f}: ${key} in ${st}: ${ty} owns ${L} levels, not a multiple of ${div} — was the ×${div} applied?`);
      moved += L - L / div; own.restored++; own.byType[ty] = (own.byType[ty] || 0) + (L - L / div);
      return a + e.replace(/levels\s*=\s*\d+/, 'levels=' + (L / div)) + z;
    });
    if (moved > 0) {
      const movedHere = moved;
      if (selfEntry) {
        // add the moved levels to the existing self entry of this state
        inner = inner.replace(/(building\s*=\s*\{)([^{}]*)(\})/g, (whole, a, e, z) => {
          const ty = (/type\s*=\s*"([a-z_0-9-]+)"/.exec(e) || [])[1]; const rg = (/region\s*=\s*"([A-Za-z_0-9-]+)"/.exec(e) || [])[1];
          if (moved <= 0 || ty !== key || rg !== st) return whole;
          const lm = /levels\s*=\s*(\d+)/.exec(e); const nL = +lm[1] + moved; moved = 0;
          return a + e.replace(/levels\s*=\s*\d+/, 'levels=' + nL) + z;
        });
      }
      if (moved > 0) {
        const ind = (inner.match(/\n(\s*)building\s*=\s*\{/) || inner.match(/\n(\s*)country\s*=\s*\{/) || [null, '\t\t\t\t\t'])[1];
        const nl = inner.includes('\r\n') ? '\r\n' : '\n';
        const trail = inner.match(/\s*$/)[0];
        inner = inner.slice(0, inner.length - trail.length) + `${nl}${ind}building={${nl}${ind}\ttype="${key}"${nl}${ind}\tcountry="c:${tag}"${nl}${ind}\tlevels=${moved}${nl}${ind}\tregion="${st}"${nl}${ind}}` + trail;
      }
      own.toSelf += movedHere;
      own.blocks++;
      const nb = body.slice(0, aoOpen) + inner + body.slice(aoClose);
      reps.push({ start: b.open, end: end - 1, text: nb });
    }
  });
  if (!reps.length) continue;
  reps.sort((a, b) => b.start - a.start);
  let out = text; for (const r of reps) out = out.slice(0, r.start) + r.text + out.slice(r.end);
  writeFileSync(join(HB0, f), bom + out, 'utf8');
}
const movedTotal = Object.values(own.byType).reduce((a, b) => a + b, 0);


// ---- 1. the craft workforce per (state, region_state), from the EMITTED 1836 map
const need = new Map();   // "STATE|TAG" -> { prof: workforce }
const perCountry = {};
let craftBlocks = 0, craftLevels = 0;
const siteLevels = {};    // TAG -> craft key -> levels on the emitted map (the vanilla e0 sites, after the ×10)
const actLists = {};      // craft key -> activate_production_methods list -> blocks carrying it (a seeded block copies the commonest)
const HB = join(MOD, 'common/history/buildings');
if (!existsSync(HB)) die(`no emitted history at ${HB} — run after convert_history`);
for (const f of readdirSync(HB).filter(x => x.endsWith('.txt'))) {
  const text = rd(join(HB, f));
  walk(text, (b, stack, end) => {
    if (b.name !== 'create_building') return;
    const body = text.slice(b.open, end - 1);
    const km = /building\s*=\s*"([a-z_0-9-]+)"/.exec(body); if (!km || !CRAFT[km[1]]) return;
    const { st, tag } = ctx(stack); if (!st || !tag) die(`${f}: a ${km[1]} block outside s:/region_state:`);
    // a building's level is the sum of its ownership entries' levels (after convert_history's ×10)
    let levels = 0; for (const lm of body.matchAll(/levels\s*=\s*(\d+)/g)) levels += +lm[1];
    if (!(levels > 0)) die(`${f}: ${km[1]} in ${st}/${tag} has no readable levels`);
    const { t } = CRAFT[km[1]]; const wm = +t.workforce_mult || 1;
    const e = {}; for (const [p, n] of Object.entries(t.employment || {})) e[p] = (e[p] || 0) + n * wm;
    const act = /activate_production_methods\s*=\s*\{([^}]*)\}/.exec(body);
    const pms = (act ? act[1].match(/"([^"]+)"/g) || [] : []).map(s => s.slice(1, -1));
    for (const pm of pms) {
      if (pm === t.pm_key) continue;
      const se = empOf(pm); if (se == null) die(`${f}: ${km[1]} in ${st} activates ${pm}, whose employment is unknown`);
      for (const [p, n] of Object.entries(se)) e[p] = (e[p] || 0) + n;
    }
    const k = st + '|' + tag; const acc = need.get(k) || {}; need.set(k, acc);
    for (const [p, n] of Object.entries(e)) if (p !== 'laborers' && n > 0) acc[p] = (acc[p] || 0) + n * levels;
    craftBlocks++; craftLevels += levels;
    ((siteLevels[tag] ||= {})[km[1]] = (siteLevels[tag]?.[km[1]] || 0) + levels);
    const ls = JSON.stringify(pms); const am = (actLists[km[1]] ||= new Map()); am.set(ls, (am.get(ls) || 0) + 1);
  });
}

// ---- S. THE OUTPUT-MATCHED SEEDING PLAN (BALANCE_FRAMEWORK §10.91, user-ruled 2026-10-01; FINDINGS F197 §4) — only when the book asks
//   (`_artisan.seed`). Per country and craft industry, the craft levels the vanilla e0 factories became are topped up until they make what
//   those factories made in vanilla (levels × the vanilla method's output); the extra levels go to the country's `cities` most urbanised
//   states (urbanization = Σ building levels × its group's urbanization, the sum that sets 1836 urban-centre levels, F13; subsistence
//   excluded), in proportion. Their workforce is NEW typed pops — each profession with the country's most numerous culture-religion of that
//   profession at 1836.2.1 (config/measured_1836_pop_identity.json; missing → the country's first primary culture + state religion,
//   REPORTED) — and the same number of people is taken from the PEASANTS of that state, else of the country's state with the most
//   peasants (the 1836.2.1 peasant count is the ceiling per state, any culture or religion), so vanilla's head count holds. A country whose
//   peasants cannot cover its seeding gets its seeding scaled down to what they cover, and is REPORTED.
const SEED = (CFG._artisan && CFG._artisan.seed) || null;
const seedPlan = [];      // { st, tag, key, levels }
const seedReport = { countries: 0, levels: 0, people: {}, fromSame: 0, fromOther: 0, scaled: [], fallbacks: [], ucBefore: 0, ucAfter: 0, cities: 0 };
let IDENT = null, RS = null, URB = null;
if (SEED) {
  const idPath = join(REPO, SEED.identity || 'config/measured_1836_pop_identity.json');
  if (!existsSync(idPath)) die(`the seeding needs ${idPath} (tools/testbed/melted_pop_identity.mjs on a vanilla 1836.2.1 melt)`);
  IDENT = JSON.parse(rd(idPath));
  // building -> group (vanilla, then the mod's own files over it), group -> urbanization (inherited from the parent; subsistence 0)
  const bGroup = {}, gUrb = {}, gParent = {}, gSubs = {};
  const scanBuildings = d => { if (!existsSync(d)) return; for (const f of readdirSync(d).filter(x => x.endsWith('.txt'))) { const txt = rd(join(d, f));
    const re = /^([A-Za-z_0-9-]+)\s*=\s*\{/gm; let m; while ((m = re.exec(txt))) { let i = re.lastIndex, dd = 1; while (i < txt.length && dd > 0) { if (txt[i] === '{') dd++; else if (txt[i] === '}') dd--; i++; }
      const body = txt.slice(re.lastIndex, i - 1); const g = /^\s*building_group\s*=\s*([a-z_0-9]+)/m.exec(body); if (g) bGroup[m[1]] = g[1]; re.lastIndex = i; } } };
  scanBuildings(join(GAME, 'common/buildings')); scanBuildings(join(MOD, 'common/buildings'));
  const scanGroups = d => { if (!existsSync(d)) return; for (const f of readdirSync(d).filter(x => x.endsWith('.txt'))) { const txt = rd(join(d, f)).replace(/#[^\n]*/g, '');
    const re = /^([A-Za-z_0-9-]+)\s*=\s*\{/gm; let m; while ((m = re.exec(txt))) { let i = re.lastIndex, dd = 1; while (i < txt.length && dd > 0) { if (txt[i] === '{') dd++; else if (txt[i] === '}') dd--; i++; }
      const body = txt.slice(re.lastIndex, i - 1); const u = /\burbanization\s*=\s*([0-9.]+)/.exec(body); const p = /\bparent_group\s*=\s*([a-z_0-9]+)/.exec(body);
      if (u) gUrb[m[1]] = +u[1]; if (p) gParent[m[1]] = p[1]; if (/\bis_subsistence\s*=\s*yes/.test(body)) gSubs[m[1]] = true; re.lastIndex = i; } } };
  scanGroups(join(GAME, 'common/building_groups')); scanGroups(join(MOD, 'common/building_groups'));
  const urbOf = g => { for (let x = g, n = 0; x && n < 12; x = gParent[x], n++) { if (gSubs[x]) return 0; if (gUrb[x] != null) return gUrb[x]; } return 0; };
  // the emitted map: urbanization per (state, owner), every region_state block (for insertion), every craft block (for merging)
  URB = new Map(); RS = new Map(); const craftAt = new Map();
  for (const f of readdirSync(HB).filter(x => x.endsWith('.txt'))) {
    const text = rd(join(HB, f));
    walk(text, (b, stack, end) => {
      if (b.name && b.name.startsWith('region_state:')) { const { st } = ctx(stack); const tag = b.name.slice(13);
        const ind = (text.slice(text.lastIndexOf('\n', b.start) + 1, b.start).match(/^\s*/) || [''])[0];
        if (st) RS.set(st + '|' + tag, { file: f, indent: ind }); return; }
      if (b.name !== 'create_building') return;
      const { st, tag } = ctx(stack); if (!st || !tag) return;
      const body = text.slice(b.open, end - 1);
      const km = /building\s*=\s*"([a-z_0-9-]+)"/.exec(body); if (!km) return;
      let levels = 0; for (const lm of body.matchAll(/levels\s*=\s*(\d+)/g)) levels += +lm[1];
      URB.set(st + '|' + tag, (URB.get(st + '|' + tag) || 0) + levels * urbOf(bGroup[km[1]]));
      if (CRAFT[km[1]]) craftAt.set(`${st}|${tag}|${km[1]}`, { file: f });
    });
  }
  for (const [k, u] of URB) seedReport.ucBefore += Math.floor(u / 100);
  // the gap per (country, craft) and its cities
  const VAN = (() => { const o = {}; for (const f of readdirSync(join(GAME, 'common/production_methods'))) Object.assign(o, blocksOf(rd(join(GAME, 'common/production_methods', f)))); return o; })();
  const vanOut = (pm, good) => { const b = VAN[pm]; if (b == null) die(`vanilla method ${pm} not found`); const m = new RegExp(`goods_output_${good}_add\\s*=\\s*([0-9.]+)`).exec(b); if (!m) die(`vanilla ${pm} makes no ${good}`); return +m[1]; };
  const nCities = +SEED.cities || 5;
  // ⭐ infrastructure: a seeded city takes no more craft levels than its spare 1836.2.1 infrastructure carries (capacity − usage, from the
  //   identity table, ÷ the craft group's usage per level); the excess spills to the country's next most urbanised states, and what fits
  //   nowhere is DROPPED and reported, like a peasant shortage — an over-capacity state would throttle every building in it.
  const perLevel = (() => { const g = (CFG.building_groups_add || {}).bg_pmr_crafts; return g && g.infrastructure_usage_per_level != null ? +g.infrastructure_usage_per_level : 0; })();
  const infraLeft = new Map(Object.entries(IDENT.states || {}).filter(([, v]) => v.infrastructure != null).map(([k, v]) => [k, v.infrastructure - v.infrastructure_usage]));
  // a split state shares one infrastructure pool among its owners: keyed by the STATE alone
  const poolOf = k => k.split('|')[0]; const pool = new Map(); for (const [k, v] of infraLeft) if (!pool.has(poolOf(k))) pool.set(poolOf(k), v);
  const roomLevels = k => perLevel > 0 && pool.has(poolOf(k)) ? Math.max(0, Math.floor(pool.get(poolOf(k)) / perLevel + 1e-9)) : Infinity;
  const useRoom = (k, n) => { if (perLevel > 0 && pool.has(poolOf(k))) pool.set(poolOf(k), pool.get(poolOf(k)) - n * perLevel); };
  seedReport.infraDropped = []; seedReport.spilled = 0;
  for (const [tag, keys] of Object.entries(siteLevels).sort()) {
    const cand = [...URB].filter(([k, u]) => k.endsWith('|' + tag) && u > 0 && RS.has(k)).sort((a, b) => b[1] - a[1]);
    const cities = cand.slice(0, nCities);
    if (!cities.length) die(`${tag}: no urbanised state of its own on the emitted map to seed into`);
    const uSum = cities.reduce((s, [, u]) => s + u, 0);
    let any = false; const used = new Set();
    for (const [key, lv] of Object.entries(keys)) {
      const { ind, t } = CRAFT[key]; const wm = +t.workforce_mult || 1; const og = t.output_good || ind.output_good;
      const target = Math.round(lv * wm * vanOut(t.vanilla_pm, og) / t.output_qty);
      const gap = target - lv; if (gap <= 0) continue;
      // largest remainder over the cities, in proportion to urbanization
      const shares = cities.map(([k, u]) => ({ k, x: gap * u / uSum })); let given = 0;
      for (const s of shares) { s.n = Math.floor(s.x); given += s.n; }
      for (const s of shares.slice().sort((a, b) => (b.x - b.n) - (a.x - a.n)).slice(0, gap - given)) s.n++;
      // the infrastructure cap, then the spill down the country's urbanisation order
      let excess = 0; const put = new Map();
      for (const s of shares) { const n = Math.min(s.n, roomLevels(s.k)); if (n > 0) { put.set(s.k, n); useRoom(s.k, n); } excess += s.n - n; }
      for (const [k] of cand) { if (excess <= 0) break; const n = Math.min(excess, roomLevels(k)); if (n > 0) { put.set(k, (put.get(k) || 0) + n); useRoom(k, n); excess -= n; seedReport.spilled += n; } }
      if (excess > 0) seedReport.infraDropped.push(`${tag} ${key.replace('building_', '')}: ${excess} of ${gap}`);
      for (const [k, n] of put) { const [st] = k.split('|'); seedPlan.push({ st, tag, key, levels: n, merge: craftAt.has(`${st}|${tag}|${key}`) }); used.add(k); any = true; }
    }
    if (any) { seedReport.countries++; seedReport.cities += used.size; }
  }
}
// the people one seeded level needs, per profession (the craft's base staffing × workforce_mult; a seeded block runs the defaults)
const seedPeople = (key, levels) => { const { t } = CRAFT[key]; const wm = +t.workforce_mult || 1; const o = {};
  for (const [p, n] of Object.entries(t.employment || {})) if (n > 0) o[p] = Math.round(levels * n * wm / WAR); return o; };

// ---- 2. carve typed pops out of the vanilla pops history (the vanilla sites), then the seeding's typed pops and its peasant takes
//   Phase A reads every vanilla pops file; B carves for the vanilla-site crafts exactly as before; C plans the seeding against the same
//   donors (a block never drops under 10% of its vanilla size, whoever takes from it); D writes the touched files.
const VP = join(GAME, 'common/history/pops');
const FILES = new Map();     // file -> { text, bom, eol, edits[] }
const donorsOf = new Map();  // "STATE|TAG" -> [{ file, end, sizeAt, sizeLen, size, culture, religion, indent }]
const closeAt = new Map();   // "STATE|TAG" -> { file, at, indent }
for (const f of readdirSync(VP).filter(x => x.endsWith('.txt'))) {
  const raw = readFileSync(join(VP, f), 'utf8');
  const bom = raw.charCodeAt(0) === 0xFEFF ? '\uFEFF' : ''; const text = bom ? raw.slice(1) : raw;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  FILES.set(f, { text, bom, eol, edits: [] });
  walk(text, (b, stack, end) => {
    if (b.name && b.name.startsWith('region_state:')) {
      const { st } = ctx(stack); const tag = b.name.slice(13);
      const ind = (text.slice(text.lastIndexOf('\n', b.start) + 1, b.start).match(/^\s*/) || [''])[0];
      // insert before the closing brace's LINE when the brace opens its line (keeps the layout), else right before the brace
      const ls = text.lastIndexOf('\n', end - 1) + 1; const at = /^\s*$/.test(text.slice(ls, end - 1)) ? ls : end - 1;
      if (st) closeAt.set(st + '|' + tag, { file: f, at, indent: ind });
      return;
    }
    if (b.name !== 'create_pop') return;
    const { st, tag } = ctx(stack); if (!st || !tag) return;
    const body = text.slice(b.open, end - 1);
    const code = body.replace(/#[^\n]*/g, '');
    if (/pop_type|cultures|split_religion|split_culture/.test(code)) return;   // only simple untyped blocks donate
    const cm = /culture\s*=\s*([a-z_0-9]+)/.exec(code); const sm = /size\s*=\s*(\d+)/.exec(code);
    if (!cm || !sm) return;
    const rm = /religion\s*=\s*([a-z_0-9]+)/.exec(code);
    // the size number's absolute offset (the first `size =` in the raw body, comments included, matches the code's)
    const rs = /size\s*=\s*(\d+)/.exec(body);
    const ind = (text.slice(text.lastIndexOf('\n', b.start) + 1, b.start).match(/^\s*/) || [''])[0];
    const k = st + '|' + tag; const arr = donorsOf.get(k) || []; donorsOf.set(k, arr);
    arr.push({ file: f, end, sizeAt: b.open + rs.index + rs[0].length - rs[1].length, sizeLen: rs[1].length, size: +sm[1], culture: cm[1], religion: rm ? rm[1] : null, indent: ind });
  });
}
const left = new Map();      // donor -> people still in it
const capOf = d => Math.floor(d.size * 0.9) - (d.size - (left.has(d) ? left.get(d) : d.size));
const takeFrom = (d, n) => { left.set(d, (left.has(d) ? left.get(d) : d.size) - n); };
// B. the vanilla sites, as before
const done = new Set();
const typedTotal = {};
for (const [k, prof] of need) {
  if (!closeAt.has(k)) continue;
  const arr = (donorsOf.get(k) || []).slice().sort((a, b) => b.size - a.size);
  const adds = [];   // typed blocks, keyed per donor (one insertion per donor, in profession order — the pre-2026-10-01 output, byte for byte)
  for (const [p, wf] of Object.entries(prof).sort()) {
    let people = Math.round(wf / WAR);
    for (const d of arr) {
      if (people <= 0) break;
      const take = Math.min(people, Math.max(0, capOf(d)));
      if (take <= 0) continue;
      takeFrom(d, take); people -= take;
      adds.push({ d, p, n: take });
      typedTotal[k.split('|')[1]] = typedTotal[k.split('|')[1]] || {};
      typedTotal[k.split('|')[1]][p] = (typedTotal[k.split('|')[1]][p] || 0) + take;
    }
    if (people > 0) die(`${k}: not enough untyped pops to carve ${Math.round(wf / WAR)} ${p} (short by ${people})`);
  }
  for (const d of arr) {
    const mine = adds.filter(a => a.d === d); if (!mine.length) continue;
    const eolF = FILES.get(d.file).eol;
    FILES.get(d.file).edits.push({ at: d.end, del: 0, order: 1, ins: mine.map(a => `${eolF}${d.indent}create_pop = { pop_type = ${a.p} culture = ${d.culture}${d.religion ? ` religion = ${d.religion}` : ''} size = ${a.n} }   # craft rung workforce (emit_craft_start)`).join('') });
  }
  done.add(k);
}
// C. the seeding: per country, the people its seeded levels need, taken from peasants
if (SEED && seedPlan.length) {
  const fallbackIdentity = (() => { const memo = {}; return tag => { if (memo[tag]) return memo[tag];
    // the country's first primary culture (common/country_definitions) and its state religion (history/countries), else that culture's religion
    let culture = null, religion = null;
    for (const f of readdirSync(join(GAME, 'common/country_definitions'))) { const txt = rd(join(GAME, 'common/country_definitions', f)); const m = new RegExp(`^${tag}\\s*=\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(txt); if (m) { const c = /cultures\s*=\s*\{\s*([a-z_0-9]+)/.exec(m[1]); if (c) culture = c[1]; const r = /religion\s*=\s*([a-z_0-9]+)/.exec(m[1]); if (r) religion = r[1]; break; } }
    if (!religion) for (const f of readdirSync(join(GAME, 'common/history/countries'))) { const txt = rd(join(GAME, 'common/history/countries', f)); const m = new RegExp(`c:${tag}\\s*\\??=\\s*\\{[\\s\\S]*?set_state_religion\\s*=\\s*rel:([a-z_0-9]+)`).exec(txt); if (m) { religion = m[1]; break; } }
    if (!religion && culture) for (const f of readdirSync(join(GAME, 'common/cultures'))) { const txt = rd(join(GAME, 'common/cultures', f)); const m = new RegExp(`^${culture}\\s*=\\s*\\{[\\s\\S]*?religion\\s*=\\s*([a-z_0-9]+)`, 'm').exec(txt); if (m) { religion = m[1]; break; } }
    return (memo[tag] = { culture, religion }); }; })();
  const peasantsLeft = new Map(Object.entries(IDENT.states || {}).map(([k, v]) => [k, +v.peasants || 0]));
  const byTag = {}; for (const s of seedPlan) (byTag[s.tag] ||= []).push(s);
  for (const [tag, rows] of Object.entries(byTag)) {
    const avail = k => Math.min(peasantsLeft.get(k) || 0, (donorsOf.get(k) || []).reduce((s, d) => s + Math.max(0, capOf(d)), 0));
    const tagStates = [...donorsOf.keys()].filter(k => k.endsWith('|' + tag));
    const total = rows.reduce((s, r) => s + Object.values(seedPeople(r.key, r.levels)).reduce((a, b) => a + b, 0), 0);
    let shortLevels = 0;
    for (const r of rows) {
      if (r.levels <= 0) continue;
      const k = `${r.st}|${tag}`; if (!closeAt.has(k)) die(`${k}: a seeded state with no region_state block in the pops history`);
      // trim this row, level by level, to what the country's peasants can still give (head count is never broken)
      const room = tagStates.reduce((s, x) => s + avail(x), 0);
      const want = r.levels; while (r.levels > 0 && Object.values(seedPeople(r.key, r.levels)).reduce((a, b) => a + b, 0) > room) r.levels--;
      shortLevels += want - r.levels; if (r.levels <= 0) continue;
      const ppl = seedPeople(r.key, r.levels);
      // the new typed pops
      const ca = closeAt.get(k); const F = FILES.get(ca.file);
      for (const [p, n] of Object.entries(ppl).sort()) {
        let idt = IDENT.countries?.[tag]?.[p];
        if (!idt || !idt.culture || idt.culture === '?' || !idt.religion || idt.religion === '?') {
          const fb = fallbackIdentity(tag); if (!fb.culture || !fb.religion) die(`${tag}: no ${p} at 1836.2.1 and no primary culture / religion to fall back on`);
          idt = fb; if (!seedReport.fallbacks.includes(`${tag} ${p}`)) seedReport.fallbacks.push(`${tag} ${p} → ${fb.culture} / ${fb.religion}`);
        }
        F.edits.push({ at: ca.at, del: 0, ins: `${ca.indent}\tcreate_pop = { pop_type = ${p} culture = ${idt.culture} religion = ${idt.religion} size = ${n} }   # seeded craft workforce (emit_craft_start, F197)${F.eol}`, order: 2 });
        seedReport.people[p] = (seedReport.people[p] || 0) + n;
      }
      // the same people out of the peasants: this state first, then the country's state with the most peasants left
      let owe = Object.values(ppl).reduce((a, b) => a + b, 0);
      const order = [k, ...tagStates.filter(x => x !== k).sort((a, b) => avail(b) - avail(a))];
      for (const sk of order) {
        if (owe <= 0) break;
        let can = Math.min(owe, avail(sk)); if (can <= 0) continue;
        for (const d of (donorsOf.get(sk) || []).slice().sort((a, b) => (left.has(b) ? left.get(b) : b.size) - (left.has(a) ? left.get(a) : a.size))) {
          if (can <= 0) break; const t2 = Math.min(can, Math.max(0, capOf(d))); if (t2 <= 0) continue;
          takeFrom(d, t2); can -= t2; owe -= t2; peasantsLeft.set(sk, (peasantsLeft.get(sk) || 0) - t2);
          if (sk === k) seedReport.fromSame += t2; else seedReport.fromOther += t2;
        }
      }
      if (owe > 0) die(`${k}: ${owe} seeded people found no peasants to come from after the coverage check — a bookkeeping error`);
      seedReport.levels += r.levels;
    }
    if (shortLevels > 0) seedReport.scaled.push(`${tag}: ${shortLevels} of ${shortLevels + rows.reduce((s, r) => s + Math.max(0, r.levels), 0)} seeded level(s) dropped — its peasants (and the 10% floor kept in every pop block) cover only part of the ${Math.round(total).toLocaleString('en-US')} people the full seeding needs`);
  }
}
// D. the size edits of every donor touched, then write the files
for (const [d, v] of left) if (v !== d.size) FILES.get(d.file).edits.push({ at: d.sizeAt, del: d.sizeLen, ins: String(v), order: 0 });
for (const [f, F] of FILES) {
  if (!F.edits.length) continue;
  F.edits.sort((a, b) => b.at - a.at || b.order - a.order);
  let out = F.text;
  for (const e of F.edits) out = out.slice(0, e.at) + e.ins + out.slice(e.at + e.del);
  mkdirSync(POPDIR, { recursive: true });
  writeFileSync(join(POPDIR, f), F.bom + MARK + ` from vanilla common/history/pops/${f} (config ${CFGP.replace(/\\/g, '/').split('/').pop()}): craft-rung workforce carved into typed pops${SEED ? ', and the seeded craft workforce taken from peasants (F197)' : ''}. Do not hand-edit.${F.eol}` + out, 'utf8');
}
const missing = [...need.keys()].filter(k => !done.has(k));
if (missing.length) die(`${missing.length} craft state(s) have no region_state block in the pops history: ${missing.slice(0, 8).join(', ')}`);

// ---- S2. the seeded craft levels onto the emitted map: added to the state's own craft block of that type (its self-owned entry), else a new block
if (SEED && seedPlan.some(r => r.levels > 0)) {
  const byFile = {};
  for (const r of seedPlan) if (r.levels > 0) { const rs = RS.get(`${r.st}|${r.tag}`); (byFile[rs.file] ||= []).push(r); }
  for (const [f, rows] of Object.entries(byFile)) {
    const raw = readFileSync(join(HB, f), 'utf8'); const bom = raw.charCodeAt(0) === 0xFEFF ? '\uFEFF' : ''; const text = bom ? raw.slice(1) : raw;
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const reps = [];
    const want = new Map(rows.map(r => [`${r.st}|${r.tag}|${r.key}`, r]));
    const rsClose = new Map();
    walk(text, (b, stack, end) => {
      if (b.name && b.name.startsWith('region_state:')) { const { st } = ctx(stack); const tag = b.name.slice(13);
        const ind = (text.slice(text.lastIndexOf('\n', b.start) + 1, b.start).match(/^\s*/) || [''])[0];
        const ls = text.lastIndexOf('\n', end - 1) + 1; const at = /^\s*$/.test(text.slice(ls, end - 1)) ? ls : end - 1;
        rsClose.set(`${st}|${tag}`, { at, ind }); return; }
      if (b.name !== 'create_building') return;
      const { st, tag } = ctx(stack); const body = text.slice(b.open, end - 1);
      const km = /building\s*=\s*"([a-z_0-9-]+)"/.exec(body); if (!km) return;
      const r = want.get(`${st}|${tag}|${km[1]}`); if (!r) return;
      // merge: add to the self-owned entry of this state, else append one
      let done2 = false;
      let nb = body.replace(/(building\s*=\s*\{)([^{}]*)(\})/g, (whole, a, e, z) => {
        if (done2) return whole; const ty = (/type\s*=\s*"([a-z_0-9-]+)"/.exec(e) || [])[1]; const rg = (/region\s*=\s*"([A-Za-z_0-9-]+)"/.exec(e) || [])[1];
        const ct = (/country\s*=\s*"c:([A-Z0-9_]+)"/.exec(e) || [])[1];
        if (ty !== km[1] || rg !== st || ct !== tag) return whole;
        const lm = /levels\s*=\s*(\d+)/.exec(e); done2 = true; return a + e.replace(/levels\s*=\s*\d+/, 'levels=' + (+lm[1] + r.levels)) + z; });
      if (!done2) {
        const ao = /add_ownership\s*=\s*\{/.exec(nb); if (!ao) die(`${f}: ${km[1]} in ${st}/${tag} has no add_ownership to merge into`);
        let i = ao.index + ao[0].length, dd = 1; while (i < nb.length && dd > 0) { if (nb[i] === '{') dd++; else if (nb[i] === '}') dd--; i++; }
        const close = i - 1; const ind = (nb.match(/\n(\s*)building\s*=\s*\{/) || [null, '\t\t\t\t\t'])[1];
        nb = nb.slice(0, close).replace(/\s*$/, '') + `${eol}${ind}building={${eol}${ind}\ttype="${km[1]}"${eol}${ind}\tcountry="c:${tag}"${eol}${ind}\tlevels=${r.levels}${eol}${ind}\tregion="${st}"${eol}${ind}}${eol}${ind.slice(1)}` + nb.slice(close);
      }
      reps.push({ start: b.open, end: end - 1, text: nb }); r.placed = true;
    });
    for (const r of rows) if (!r.placed) {
      const rc = rsClose.get(`${r.st}|${r.tag}`); if (!rc) die(`${f}: no region_state:${r.tag} block in ${r.st} to seed into`);
      const ind = rc.ind + '\t'; const list = [...(actLists[r.key] || new Map())].sort((a, b) => b[1] - a[1])[0];
      const pms = list ? JSON.parse(list[0]) : [CRAFT[r.key].t.pm_key];
      const blk = `${ind}create_building={${eol}${ind}\tbuilding="${r.key}"${eol}${ind}\tadd_ownership={${eol}${ind}\t\tbuilding={${eol}${ind}\t\t\ttype="${r.key}"${eol}${ind}\t\t\tcountry="c:${r.tag}"${eol}${ind}\t\t\tlevels=${r.levels}${eol}${ind}\t\t\tregion="${r.st}"${eol}${ind}\t\t}${eol}${ind}\t}${eol}${ind}\treserves=1${eol}${ind}\tactivate_production_methods={ ${pms.map(p => `"${p}"`).join(' ')} }${eol}${ind}}${eol}`;
      reps.push({ start: rc.at, end: rc.at, text: blk }); r.placed = true;
    }
    reps.sort((a, b) => b.start - a.start);
    let out = text; for (const r of reps) out = out.slice(0, r.start) + r.text + out.slice(r.end);
    writeFileSync(join(HB, f), bom + out, 'utf8');
  }
  const unplaced = seedPlan.filter(r => r.levels > 0 && !r.placed); if (unplaced.length) die(`${unplaced.length} seeded craft block(s) were not placed: ${unplaced.slice(0, 5).map(r => `${r.st}/${r.tag}/${r.key}`).join(', ')}`);
  // the urban centres the seeded levels add (estimate, F13: floor(state urbanization / 100))
  const craftUrb = (() => { const g = (CFG.building_groups_add || {}).bg_pmr_crafts; return g && g.urbanization != null ? +g.urbanization : 0; })();
  const add = new Map(); for (const r of seedPlan) if (r.levels > 0) add.set(`${r.st}|${r.tag}`, (add.get(`${r.st}|${r.tag}`) || 0) + r.levels * craftUrb);
  for (const [k, u] of URB) seedReport.ucAfter += Math.floor((u + (add.get(k) || 0)) / 100);
}

const sumP = o => Object.values(o).reduce((a, b) => a + b, 0);
const byTag = Object.entries(typedTotal).sort((a, b) => sumP(b[1]) - sumP(a[1]));
const tot = {}; for (const [, o] of byTag) for (const [p, n] of Object.entries(o)) tot[p] = (tot[p] || 0) + n;
console.log(`craft start: ownership — ${own.restored} owner-building entr(ies) in ${own.blocks} craft block(s) back to their original levels, ` +
  `${own.toSelf} craft levels moved to self-ownership (${Object.entries(own.byType).map(([k, n]) => `${k.replace('building_', '')} ${n}`).join(', ') || 'none'})`);
console.log(`craft start: workforce — ${craftBlocks} craft building(s), ${craftLevels} levels in ${need.size} state(s); typed ` +
  Object.entries(tot).map(([p, n]) => `${p} ${n.toLocaleString('en-US')}`).join(', ') + ` people (workforce ÷ ${WAR}); ` +
  `top: ${byTag.slice(0, 6).map(([t, o]) => `${t} ${Math.round(sumP(o) / 1000)}k`).join(', ')}${removed ? `; removed ${removed} stale file(s)` : ''}`);
if (SEED) {
  console.log(`craft start: SEEDING (output-matched, F197) — ${seedReport.countries} countries, ${seedReport.levels} craft levels over ${seedReport.cities} city state(s); new typed pops ` +
    Object.entries(seedReport.people).map(([p, n]) => `${p} ${n.toLocaleString('en-US')}`).join(', ') + `; taken from peasants ${(seedReport.fromSame).toLocaleString('en-US')} in the same state, ` +
    `${(seedReport.fromOther).toLocaleString('en-US')} from the country's other states (head count unchanged); urban centres (F13 estimate) ${seedReport.ucBefore} → ${seedReport.ucAfter}`);
  if (seedReport.fallbacks.length) console.log(`craft start: ⚠ IDENTITY FALLBACKS (no such profession at 1836.2.1 → first primary culture + state religion): ${seedReport.fallbacks.join('; ')}`);
  if (seedReport.scaled.length) console.log(`craft start: ⚠ SEEDING SCALED DOWN (not enough peasants): ${seedReport.scaled.join('; ')}`);
  if (seedReport.spilled) console.log(`craft start: infrastructure — ${seedReport.spilled} seeded level(s) spilled past the top ${SEED.cities} cities to the country's next most urbanised states`);
  if (seedReport.infraDropped && seedReport.infraDropped.length) console.log(`craft start: ⚠ SEEDING DROPPED (no spare infrastructure in any of the country's urbanised states): ${seedReport.infraDropped.join('; ')}`);
}
