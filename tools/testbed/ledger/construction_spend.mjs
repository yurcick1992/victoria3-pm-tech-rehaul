// WHERE DID THE CONSTRUCTION MONEY GO, AND HOW MUCH OF WHAT WAS BUILT STANDS EMPTY?  (FINDINGS F187)
//
// Written for the craft book (BALANCE_FRAMEWORK §10.91.1): a craft level costs a fiftieth of its factory, so "the crafts are
// understaffed" (F185) only matters as much as the capital they tied up. Three readings of one run's construction, from the start
// to --until, each in construction POINTS (the engine's unit: a level costs its building type's `required_construction`) and in £:
//
//   1. THE FLOW — every point the building queues received, Σ (government + private queue speed) × the weeks between summaries,
//      and the money, Σ the construction sector's goods bill (market prices, the budget's construction-goods line) × weeks.
//      This is ALL CONSTRUCTION SPEND. £ per point is then a property of the country (its construction methods and its market),
//      and a country's run average prices everything it built below.
//      ⚠ Every country also gets up to 10 points a week from the country_gdp_construction static modifier, with no sector behind
//      it; those points are in the flow and cost no goods, so a country with no construction sector builds at £0 a point.
//   2. LEVELS ADDED — positive level changes per country and building type between consecutive summaries × the type's cost.
//      Country-quarters whose total levels jump more than 25% are skipped (annexations, a civil-war record coming back); smaller
//      state transfers still count as construction by the receiver, and demolitions are not netted (a construction is a decision,
//      a demolition another). Types the engine sizes itself are not construction and are left out: urban centres, subsistence,
//      owner buildings (manor houses, financial districts, company headquarters).
//   3. THE STOCK AT THE END SAVE (--stock: the run's kept save, used only if it IS the --until date) — every building record against
//      the build's own 1836 map (common/history/buildings of the emitted mod, the same map the run started from):
//        CONSTRUCTED = established after 1836.1.1 in a region that held no building of that type in 1836;
//        EXPANDED    = an original (still dated 1836.1.1) with more levels than the map gave it — its added levels carry the
//                      building's own occupancy (proportional; the originals-staff-first reading would flatter the new levels);
//        re-established = established later in a region that DID hold one — a state that changed hands resets the date, so these
//                      are reported apart and never counted as construction.
//      Each carries its staffed levels at the end, so the money standing EMPTY is readable: Σ cost × (levels − staffed levels).
//      Net of demolition within a region; blind to buildings built and removed again; military buildings the engine sizes at init
//      are not in the map, so their later expansions are missed (the flow has them).
//
// CLASSES: craft (a tier with `craft`) · tiered (every other rung of a non-disabled industry) · economic untiered (building groups
// under manufacturing, agriculture, ranching, plantations, extraction, power, private infrastructure incl. trade, arts) ·
// non-economic (government, military, construction sector, canals, monuments). "e0 of the six" = the e0 rung of --e0-of's
// industries, which ARE the crafts in a craft book and 316/600-point factories in the canon — the like-for-like line across books.
//
// ⚠ A summary before v12 (2026-09-30) keeps ONE record per definition tag, so during a same-tag civil war one side's queues, goods
// bill and buildings are missing: the flow undercounts by that side's share, and its return is a >25% jump that the levels-added
// reading skips. `summary_drops.mjs --session <stamp>` sizes it per summary.
//
// USAGE
//   node tools/testbed/ledger/construction_spend.mjs --arm <session>[:<setup>] --mod <emitted mod dir> [--arm … --mod …]
//        [--until 1866.1.1] [--stock] [--e0-of food,textile,furniture,glass,tooling,paper] [--game <dir>]
//   The config is each run's own (build_state.json); --mod is only for the building definitions of UNTIERED types and the 1836 map,
//   so any build of that book serves (the canon's is mod/, a craft book's is `build.ps1 -SaveTo <name> -Config <book>`).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SES = join(REPO, 'tools/testbed/sessions');
const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const allOf = n => ARGV.flatMap((a, i) => (a === n && ARGV[i + 1] ? [ARGV[i + 1]] : []));
const GAME = argOf('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const UNTIL = argOf('--until', null);
const STOCK = ARGV.includes('--stock');
const E0_OF = argOf('--e0-of', 'food,textile,furniture,glass,tooling,paper').split(',');
const ARMS = allOf('--arm'), MODS = allOf('--mod');
if (!ARMS.length || MODS.length !== ARMS.length) {
  console.error('usage: node tools/testbed/ledger/construction_spend.mjs --arm <session>[:<setup>] --mod <emitted mod dir> [--arm … --mod …] [--until 1866.1.1] [--stock] [--e0-of a,b]');
  process.exit(2);
}
const ANNEX_JUMP = 1.25, START = '1836.1.1';
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const days = s => { const [y, m, d] = String(s).split('.').map(Number); return y * 365 + CUM[(m || 1) - 1] + (d || 1) - 1; };
const strip = s => s.replace(/^\uFEFF/, '');
const braces = t => (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;

// ---------------------------------------------------------------- building definitions (vanilla, the mod's files over it) ----
const DEFS = new Map();
function defsOf(mod) {
  if (DEFS.has(mod)) return DEFS.get(mod);
  const SV = {};
  for (const l of strip(readFileSync(join(GAME, 'common/script_values/building_values.txt'), 'utf8')).split('\n')) {
    const m = /^\s*(construction_cost_[a-z_]+)\s*=\s*([\d.]+)/.exec(l); if (m) SV[m[1]] = +m[2];
  }
  const cost = {}, group = {}, parent = {};
  // a mod file with vanilla's NAME replaces that vanilla file; any other mod file adds
  const layered = sub => {
    const v = join(GAME, sub), m = join(mod, sub), mf = existsSync(m) ? readdirSync(m).filter(x => x.endsWith('.txt')) : [];
    const skip = new Set(mf);
    return [...readdirSync(v).filter(x => x.endsWith('.txt') && !skip.has(x)).map(x => join(v, x)), ...mf.map(x => join(m, x))];
  };
  for (const f of layered('common/buildings')) {
    let cur = null, depth = 0;
    for (const raw of strip(readFileSync(f, 'utf8')).split(/\r?\n/)) {
      const t = raw.replace(/#.*$/, '');
      if (depth === 0) { const m = /^([a-z_0-9]+)\s*=\s*\{/.exec(t.trim()); if (m) cur = m[1]; }
      else if (cur && depth === 1) {
        let m;
        if ((m = /^\s*required_construction\s*=\s*(\S+)/.exec(t)) && cost[cur] == null) cost[cur] = SV[m[1]] != null ? SV[m[1]] : +m[1];
        if ((m = /^\s*building_group\s*=\s*(\S+)/.exec(t)) && group[cur] == null) group[cur] = m[1];
      }
      depth += braces(t); if (depth <= 0) { depth = 0; cur = null; }
    }
  }
  for (const f of layered('common/building_groups')) {
    let cur = null, depth = 0;
    for (const raw of strip(readFileSync(f, 'utf8')).split(/\r?\n/)) {
      const t = raw.replace(/#.*$/, '');
      if (depth === 0) { const m = /^(bg_[a-z_0-9]+)\s*=\s*\{/.exec(t.trim()); if (m) { cur = m[1]; if (!(cur in parent)) parent[cur] = null; } }
      else if (cur && depth === 1) { const m = /^\s*parent_group\s*=\s*(\S+)/.exec(t); if (m) parent[cur] = m[1]; }
      depth += braces(t); if (depth <= 0) { depth = 0; cur = null; }
    }
  }
  if (!cost.building_steel_mill || !group.building_wheat_farm) throw new Error(`construction_spend: building definitions not found under ${GAME} / ${mod}`);
  const d = { cost, group, parent };
  DEFS.set(mod, d); return d;
}

const ECON = new Set(['bg_manufacturing', 'bg_agriculture', 'bg_ranching', 'bg_plantations', 'bg_extraction', 'bg_power', 'bg_private_infrastructure', 'bg_arts']);
const AUTO = new Set(['bg_subsistence_agriculture', 'bg_subsistence_ranching', 'bg_service', 'bg_owner_buildings']);
const CLASSES = ['craft', 'tiered', 'econ', 'nonecon'];
const LABEL = { craft: 'crafts', tiered: 'tiered, other rungs', econ: 'economic, untiered', nonecon: 'non-economic', e0six: 'e0 of the six' };

function armOf(spec, mod) {
  const i = spec.indexOf(':');
  const session0 = i < 0 ? spec : spec.slice(0, i), setup = i < 0 ? '' : spec.slice(i + 1);
  const session = readdirSync(SES).find(x => x === session0 || x.startsWith(session0 + '_')) || session0;
  const { runs, dropped } = usableRuns(SES, session, setup);
  reportDropped(dropped);
  if (!runs.length) throw new Error(`construction_spend: no usable runs under ${session}${setup ? ':' + setup : ''}`);
  return { spec, session, setup, mod: resolve(REPO, mod), runs };
}

function bookOf(runRel) {
  const bs = JSON.parse(readFileSync(join(SES, runRel, 'build_state.json'), 'utf8'));
  const cfgPath = bs.deterministic?.mod_under_test?.built_from_config;
  if (!cfgPath || !existsSync(cfgPath)) throw new Error(`construction_spend: ${runRel} names no readable config (${cfgPath})`);
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const craft = new Set(), tier = new Set(), e0six = new Set(), tierCost = {};
  for (const ind of cfg.industries || []) { if (ind.disabled) continue;
    for (const t of ind.tiers || []) {
      if (t.method_of) continue;                       // a merged rung is a method of its host, not a building
      tier.add(t.key); tierCost[t.key] = +t.building_cost;
      if (t.craft) craft.add(t.key);
      if ((t.era ?? 0) === 0 && E0_OF.includes(ind.id)) e0six.add(t.key);
    }
  }
  return { cfgPath, craft, tier, e0six, tierCost, override: cfg.building_required_construction || {} };
}

function classify(key, book, defs) {
  if (book.craft.has(key)) return 'craft';
  if (book.tier.has(key)) return 'tiered';
  const g = defs.group[key];
  if (!g) return /^building_(regional_)?company_/.test(key) ? 'auto' : 'unknown';
  for (let x = g, hop = 0; x && hop < 12; x = defs.parent[x], hop++) { if (AUTO.has(x)) return 'auto'; if (ECON.has(x)) return 'econ'; }
  return 'nonecon';
}
const costOf = (key, book, defs) => book.tierCost[key] ?? book.override[key] ?? defs.cost[key];

// ---------------------------------------------------------------- 1 + 2: the summaries ----
function readSummaries(runRel, book, defs) {
  const dir = join(SES, runRel, 'save_summaries');
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  const R = { flowPts: 0, flowGBP: 0, byTag: {}, addTagKey: {}, skipped: 0, quarters: 0, first: null, last: null, versions: new Set(), unknown: {}, lastFile: null };
  let prev = null, prevDate = START;
  for (const f of files) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const date = j.provenance?.date; if (!date) continue;
    if (UNTIL && days(date) > days(UNTIL)) break;
    const weeks = (days(date) - days(prevDate)) / 7; if (weeks <= 0) continue;
    R.versions.add(j.version ?? j.save_summary_version); R.quarters++; R.first ||= date; R.last = date; R.lastFile = f;
    const cur = {};
    for (const [tag, c] of Object.entries(j.countries || {})) {
      const sp = (c.queues?.government?.speed || 0) + (c.queues?.private?.speed || 0);
      const gc = c.buildings?.building_construction_sector?.goods_cost || 0;
      R.flowPts += sp * weeks; R.flowGBP += gc * weeks;
      const bt = R.byTag[tag] ||= { pts: 0, gbp: 0 }; bt.pts += sp * weeks; bt.gbp += gc * weeks;
      const lv = {}; let total = 0;
      for (const [k, b] of Object.entries(c.buildings || {})) { lv[k] = b.levels || 0; total += b.levels || 0; }
      cur[tag] = { lv, total };
    }
    if (prev) {
      for (const [tag, now] of Object.entries(cur)) {
        const was = prev[tag]; if (!was) continue;
        if (was.total > 0 && now.total / was.total > ANNEX_JUMP) { R.skipped++; continue; }
        for (const [k, n] of Object.entries(now.lv)) {
          const add = n - (was.lv[k] || 0); if (add <= 0) continue;
          const cls = classify(k, book, defs); if (cls === 'auto') continue;
          if (cls === 'unknown') { R.unknown[k] = (R.unknown[k] || 0) + add; continue; }
          const tk = R.addTagKey[tag] ||= {}; tk[k] = (tk[k] || 0) + add;
        }
      }
    }
    prev = cur; prevDate = date;
  }
  const worldP = R.flowGBP / R.flowPts;
  R.pOf = tag => { const b = R.byTag[tag]; return b && b.pts > 0 ? b.gbp / b.pts : worldP; };
  R.worldP = worldP;
  const A = Object.fromEntries([...CLASSES, 'e0six'].map(c => [c, { lv: 0, pts: 0, gbp: 0 }]));
  const noCost = {};
  for (const [tag, ks] of Object.entries(R.addTagKey)) for (const [k, lv] of Object.entries(ks)) {
    const cls = classify(k, book, defs), c = costOf(k, book, defs);
    if (!(c > 0)) { noCost[k] = (noCost[k] || 0) + lv; continue; }
    const pts = lv * c, gbp = pts * R.pOf(tag);
    for (const x of [cls, ...(book.e0six.has(k) ? ['e0six'] : [])]) { A[x].lv += lv; A[x].pts += pts; A[x].gbp += gbp; }
  }
  R.added = A; R.noCost = noCost;
  return R;
}

// ---------------------------------------------------------------- 3: the stock at the end save ----
function history(mod) {
  const hist = new Map(), hdir = join(mod, 'common/history/buildings');
  if (!existsSync(hdir)) throw new Error(`construction_spend: no 1836 map in ${hdir}`);
  for (const f of readdirSync(hdir).filter(x => x.endsWith('.txt'))) {
    let region = null, tag = null, key = null, lv = 0, inCb = false, depthCb = 0, depth = 0;
    for (const raw of strip(readFileSync(join(hdir, f), 'utf8')).split(/\r?\n/)) {
      const line = raw.replace(/#.*/, ''); let m;
      if ((m = /s:(STATE_[A-Za-z0-9_]+)\s*=\s*\{/.exec(line))) region = m[1].replace(/^STATE_/, '');
      if ((m = /region_state:([A-Za-z0-9]+)\s*=\s*\{/.exec(line))) tag = m[1];
      if (!inCb && /create_building\s*=\s*\{/.test(line)) { inCb = true; depthCb = depth; key = null; lv = 0; }
      // a building's size in history is the sum of its ownership entries' levels (create_building has no level field of its own)
      if (inCb) { if ((m = /building\s*=\s*"([^"]+)"/.exec(line)) && !key) key = m[1]; if ((m = /\blevels?\s*=\s*(\d+)/.exec(line))) lv += +m[1]; }
      for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (inCb && depth === depthCb) { inCb = false; if (key) { const h = `${region}|${tag}|${key}`; hist.set(h, (hist.get(h) || 0) + lv); } } } }
    }
  }
  return hist;
}

async function readStock(savePath) {
  const rak = spawn(join(REPO, 'tools/vendor/rakaly/rakaly.exe'), ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', savePath]);
  let err = ''; rak.stderr.on('data', d => { err += d; });
  const done = new Promise((res, rej) => rak.on('close', code => (code === 0 ? res() : rej(new Error(`rakaly exited ${code}: ${err.slice(0, 300)}`)))));
  const rl = createInterface({ input: rak.stdout, crlfDelay: Infinity });
  let mode = 'top', date = null, id = null, rec = null, cid = null, sid = null;
  const recs = [], tagOf = new Map(), stateCountry = new Map(), stateName = new Map();
  for await (const line of rl) {
    if (mode === 'top') {
      if (!date) { const d = /^date=(\d+\.\d+\.\d+)/.exec(line); if (d) { date = d[1]; continue; } }
      const s = /^([a-z_]+)=\{$/.exec(line); if (!s) continue;
      mode = ['building_manager', 'country_manager', 'states'].includes(s[1]) ? s[1] : 'skip'; continue;
    }
    if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
    if (line.charCodeAt(0) === 125) { mode = 'top'; id = cid = sid = null; rec = null; continue; }
    if (line.startsWith('\t\t') && !line.startsWith('\t\t\t')) {
      const m = /^\t\t(\d+)=\{$/.exec(line);
      if (mode === 'building_manager') { id = m ? +m[1] : null; rec = null; }
      else if (mode === 'country_manager') cid = m ? +m[1] : null;
      else if (mode === 'states') sid = m ? +m[1] : null;
      continue;
    }
    if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
    const t = line.slice(3); let x;
    if (mode === 'building_manager' && id !== null) {
      if (t.startsWith('building="')) { rec = { key: t.slice(10, -1), levels: 0, staffing: 0, est: null, state: null }; recs.push(rec); continue; }
      if (!rec) continue;
      if ((x = /^state=(\d+)$/.exec(t))) rec.state = +x[1];
      else if ((x = /^levels=(\d+)$/.exec(t))) rec.levels = +x[1];
      else if ((x = /^staffing=([\d.]+)$/.exec(t))) rec.staffing = +x[1];
      else if ((x = /^establishment_date=([\d.]+)$/.exec(t))) rec.est = x[1];
      continue;
    }
    if (mode === 'country_manager' && cid !== null && t.startsWith('definition="')) tagOf.set(cid, t.slice(12, -1));
    else if (mode === 'states' && sid !== null) {
      if ((x = /^country=(\d+)$/.exec(t))) stateCountry.set(sid, +x[1]);
      else if ((x = /^region="STATE_([^"]+)"$/.exec(t))) stateName.set(sid, x[1]);
    }
  }
  await done;
  return { date, recs, tagOf, stateCountry, stateName };
}

function stockOf(S, book, defs, hist, pOf) {
  const regKey = new Set([...hist.keys()].map(h => { const [r, , k] = h.split('|'); return `${r}|${k}`; }));
  const Z = () => ({ lv: 0, staffed: 0, pts: 0, emptyPts: 0, gbp: 0, emptyGbp: 0, n: 0 });
  const out = Object.fromEntries([...CLASSES, 'e0six'].map(c => [c, { built: Z(), expanded: Z(), reest: Z() }]));
  for (const r of S.recs) {
    if (!r.levels || r.state == null) continue;
    const cls = classify(r.key, book, defs); if (cls === 'auto' || cls === 'unknown') continue;
    const region = S.stateName.get(r.state), tag = S.tagOf.get(S.stateCountry.get(r.state));
    const c = costOf(r.key, book, defs); if (!(c > 0)) continue;
    const occ = Math.min(1, r.staffing / r.levels);
    let kind, added, staffed;
    if (r.est === START) {
      const h = hist.get(`${region}|${tag}|${r.key}`); if (h == null || r.levels <= h) continue;
      kind = 'expanded'; added = r.levels - h; staffed = added * occ;
    } else if (!regKey.has(`${region}|${r.key}`)) { kind = 'built'; added = r.levels; staffed = Math.min(r.levels, r.staffing); }
    else { kind = 'reest'; added = r.levels; staffed = Math.min(r.levels, r.staffing); }
    const p = pOf(tag);
    for (const x of [cls, ...(book.e0six.has(r.key) ? ['e0six'] : [])]) {
      const b = out[x][kind]; b.n++; b.lv += added; b.staffed += staffed; b.pts += added * c; b.emptyPts += (added - staffed) * c;
      b.gbp += added * c * p; b.emptyGbp += (added - staffed) * c * p;
    }
  }
  return out;
}

// ---------------------------------------------------------------- report ----
const M = v => `£${(v / 1e6).toFixed(v >= 1e8 ? 0 : 2)}M`;
const K = v => Math.round(v).toLocaleString('en-US');
const pc = (a, b) => (b > 0 ? (100 * a / b).toFixed(a / b < 0.01 ? 2 : 1) + '%' : '—');
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const table = [];

for (let ai = 0; ai < ARMS.length; ai++) {
  const arm = armOf(ARMS[ai], MODS[ai]);
  const defs = defsOf(arm.mod);
  console.log(`\n=========== ${arm.session}${arm.setup ? ':' + arm.setup : ''} — ${arm.runs.length} usable run(s), building definitions from ${arm.mod}`);
  for (const run of arm.runs) {
    const book = bookOf(run);
    const R = readSummaries(run, book, defs);
    const A = R.added, econAll = A.craft.pts + A.tiered.pts + A.econ.pts, tierAll = A.craft.pts + A.tiered.pts, addAll = econAll + A.nonecon.pts;
    const econAllG = A.craft.gbp + A.tiered.gbp + A.econ.gbp, tierAllG = A.craft.gbp + A.tiered.gbp;
    console.log(`\n--- ${run}  (${book.cfgPath.split(/[\\/]/).pop()}; ${R.first} → ${R.last}, ${R.quarters} summaries, version ${[...R.versions].join('/')})`);
    if ([...R.versions].some(v => v < 12)) console.log(`   ⚠ summaries before v12 drop one side of every same-tag civil war: the flow and the levels added undercount by that side (summary_drops.mjs --session ${arm.session})`);
    console.log(`1. THE FLOW — all construction: ${K(R.flowPts)} points into the building queues; construction goods bill ${M(R.flowGBP)} (market) = £${R.worldP.toFixed(0)} a point`);
    console.log(`2. LEVELS ADDED (summaries; ${R.skipped} country-quarters skipped as annexation-scale jumps) — ${K(addAll)} points = ${pc(addAll, R.flowPts)} of the flow`);
    console.log(`   class                     levels      points          £     of flow  of econ  of tiered`);
    for (const c of [...CLASSES, 'e0six']) {
      const x = A[c];
      console.log(`   ${LABEL[c].padEnd(22)} ${K(x.lv).padStart(9)} ${K(x.pts).padStart(11)} ${M(x.gbp).padStart(10)}   ${pc(x.pts, R.flowPts).padStart(7)}  ${c === 'nonecon' ? '     —' : pc(x.pts, econAll).padStart(6)}  ${['craft', 'tiered', 'e0six'].includes(c) ? pc(x.pts, tierAll).padStart(7) : '      —'}`);
    }
    console.log(`   (in £ the same shares read: crafts ${pc(A.craft.gbp, R.flowGBP)} of the goods bill, ${pc(A.craft.gbp, econAllG)} of economic, ${pc(A.craft.gbp, tierAllG)} of tiered; e0 of the six ${pc(A.e0six.gbp, R.flowGBP)} / ${pc(A.e0six.gbp, econAllG)} / ${pc(A.e0six.gbp, tierAllG)})`);
    const unk = Object.entries(R.unknown).sort((a, b) => b[1] - a[1]); if (unk.length) console.log(`   ⚠ unclassified types (no building group found), levels left out: ${unk.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    const nc = Object.entries(R.noCost).sort((a, b) => b[1] - a[1]); if (nc.length) console.log(`   ⚠ types with no construction cost found, levels left out: ${nc.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    const row = { run, flowPts: R.flowPts, flowGBP: R.flowGBP, A, econAll, tierAll };
    if (STOCK) {
      const saves = existsSync(join(SES, run, 'saves')) ? readdirSync(join(SES, run, 'saves')).filter(x => x.endsWith('.v3')).sort() : [];
      const kept = saves[saves.length - 1], keptSum = kept && readdirSync(join(SES, run, 'save_summaries')).find(x => x.startsWith(kept.split('_')[0] + '_'));
      let keptDate = null; try { keptDate = keptSum && JSON.parse(gunzipSync(readFileSync(join(SES, run, 'save_summaries', keptSum)))).provenance.date; } catch {}
      if (!kept || keptDate !== R.last) console.log(`3. STOCK — skipped: the kept save (${kept || 'none'}, ${keptDate || '?'}) is not the run's ${R.last}`);
      else {
        const S = await readStock(join(SES, run, 'saves', kept));
        const O = stockOf(S, book, defs, history(arm.mod), R.pOf);
        console.log(`3. STOCK AT ${S.date} (${kept}; against ${arm.mod}'s 1836 map) — built or expanded since 1836, and how much of it stands empty`);
        console.log(`   class                     levels  staffed      points   empty pts        £    empty £   empty share`);
        for (const c of [...CLASSES, 'e0six']) {
          const b = O[c].built, e = O[c].expanded, lv = b.lv + e.lv, st = b.staffed + e.staffed, pts = b.pts + e.pts, ep = b.emptyPts + e.emptyPts, g = b.gbp + e.gbp, eg = b.emptyGbp + e.emptyGbp;
          console.log(`   ${LABEL[c].padEnd(22)} ${K(lv).padStart(9)} ${pc(st, lv).padStart(7)} ${K(pts).padStart(11)} ${K(ep).padStart(11)} ${M(g).padStart(9)} ${M(eg).padStart(9)}   ${pc(ep, pts).padStart(6)}  (built ${K(b.lv)} lv in ${b.n} bldg, expanded +${K(e.lv)} lv; re-established apart: ${K(O[c].reest.lv)} lv)`);
        }
        const tot = k => CLASSES.reduce((a, c) => a + O[c].built[k] + O[c].expanded[k], 0), econ = k => ['craft', 'tiered', 'econ'].reduce((a, c) => a + O[c].built[k] + O[c].expanded[k], 0), tier = k => ['craft', 'tiered'].reduce((a, c) => a + O[c].built[k] + O[c].expanded[k], 0);
        const cr = k => O.craft.built[k] + O.craft.expanded[k];
        console.log(`   crafts: ${pc(cr('pts'), R.flowPts)} of the flow's points, ${pc(cr('pts'), econ('pts'))} of economic and ${pc(cr('pts'), tier('pts'))} of tiered construction standing; their EMPTY part ${pc(cr('emptyPts'), R.flowPts)} / ${pc(cr('emptyPts'), econ('pts'))} / ${pc(cr('emptyPts'), tier('pts'))}`);
        console.log(`   all standing construction ${K(tot('pts'))} points = ${pc(tot('pts'), R.flowPts)} of the flow; economic ${pc(econ('emptyPts'), econ('pts'))} empty, tiered ${pc(tier('emptyPts'), tier('pts'))} empty`);
        row.O = O;
      }
    }
    table.push({ arm: arm.spec, ...row });
  }
}

if (table.length > 1) {
  console.log(`\n=========== THE SIX e0 RUNGS ACROSS RUNS (levels added, summaries; ${E0_OF.join(', ')})`);
  console.log(`   run                                              flow pts   e0 lv   e0 pts   of flow  of econ  of tiered      e0 £`);
  const byArm = {};
  for (const t of table) {
    const x = t.A.e0six; (byArm[t.arm] ||= []).push(t);
    console.log(`   ${t.run.padEnd(48)} ${K(t.flowPts).padStart(9)} ${K(x.lv).padStart(7)} ${K(x.pts).padStart(8)}   ${pc(x.pts, t.flowPts).padStart(6)}  ${pc(x.pts, t.econAll).padStart(6)}  ${pc(x.pts, t.tierAll).padStart(7)}  ${M(x.gbp).padStart(9)}`);
  }
  for (const [a, ts] of Object.entries(byArm)) if (ts.length > 1)
    console.log(`   median of ${a} (${ts.length}): flow ${K(med(ts.map(t => t.flowPts)))} pts, e0 of the six ${K(med(ts.map(t => t.A.e0six.pts)))} pts = ${(100 * med(ts.map(t => t.A.e0six.pts / t.flowPts))).toFixed(2)}% of the flow, ${(100 * med(ts.map(t => t.A.e0six.pts / t.econAll))).toFixed(1)}% of economic, ${(100 * med(ts.map(t => t.A.e0six.pts / t.tierAll))).toFixed(1)}% of tiered; ${M(med(ts.map(t => t.A.e0six.gbp)))}`);
}
