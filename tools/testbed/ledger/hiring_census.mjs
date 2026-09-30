// WHO WORKS WHERE, AND WHO CAN HIRE — every building of one save, by sector and building type (FINDINGS F188, 2026-09-30).
//
//   node tools/testbed/ledger/hiring_census.mjs <save.v3> --mod <the book's emitted mod dir> [--book <config.json>] [--json out.json]
//   node tools/testbed/ledger/hiring_census.mjs --diff <A.json> <B.json> [--top 30]
//
// Written for the crafts' hiring-floor probe (BALANCE_FRAMEWORK §10.91.3): a setting on ONE building group can reach the rest of the
// economy two ways, and this reads both —
//   DIRECTLY, if the engine applied the group's field beyond the group (min_productivity_to_hire on bg_pmr_crafts, a child of
//     bg_light_industry): then non-craft buildings under the £3 earnings floor would hire in the changed arm as the crafts do;
//   INDIRECTLY, through the labour pool, wages and prices: crafts that hire more take workers from somewhere (the unemployed, the
//     peasants, other buildings) and sell more goods.
// Out of the melt (streamed, never written): every building's levels, staffed levels, active methods (→ its JOB SLOTS per profession,
// level-scaled employment read from the emitted mod over vanilla), workers per profession (the pop table's `workplace`, the FULL record
// id), sales / input cost / profit, wage (salary_rate) against its country's normal rate, hiring state (last failed hire, last layoff,
// hiring rate) and inbound hires (its transfer log); the labour pool (unemployed and peasants, per profession and country).
// Per building the class the engine's hiring rules put it in (common/defines): FAILED-HIRE (a failed hire within the last year — it tried
// and found nobody at its wage, or the earnings floor stopped it), LAYING-OFF (a layoff within the last year), FULL (≥ 98% staffed),
// PAUSED (profit under 20% of revenue and ≥ 10% employed: BUILDING_MAX_PROFIT_TO_PAUSE_HIRES), RAMPING (the rest).
// The earnings floor, BUILDING_DEFAULT_MIN_EARNINGS_TO_HIRE_EMPLOYEES = 3 ("non-subsidized buildings will not hire if it would result in
// their annual earnings/employee falling below this threshold"), is read as VALUE ADDED per employee a year — F185 §2 found that reading
// separates staffed from understaffed crafts and the profit reading does not. Subsidised buildings are exempt from it and are counted apart.
// Sectors: the book's crafts and tiered rungs (by industry and ERA), then vanilla's building-group tree (manufacturing, agriculture,
// plantations, ranching, extraction, infrastructure, urban, government, military, construction, subsistence, owners).
// ⚠ n=1 a save: two runs are two seeds, so a difference in any one sector is read against the seed-to-seed spread, never alone.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const pc = v => Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—';
const k = v => !Number.isFinite(v) ? '—' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : v.toFixed(0);
const f2 = v => Number.isFinite(v) ? v.toFixed(2) : '—';
const strip = s => s.replace(/^\uFEFF/, '');

// ================================================================= --diff mode
if (args[0] === '--diff') {
  const [A, B] = [args[1], args[2]].map(f => JSON.parse(readFileSync(f, 'utf8')));
  const TOP = +argOf('--top', 30);
  const d = (a, b) => (b - a >= 0 ? '+' : '') + k(b - a);
  const dp = (a, b) => (b - a >= 0 ? '+' : '') + (100 * (b - a)).toFixed(1) + 'pp';
  console.log(`A = ${A.save} (${A.date}, ${A.book})\nB = ${B.save} (${B.date}, ${B.book})`);
  console.log(`\n== THE LABOUR POOL (workforce, world)`);
  for (const key of ['workforce', 'employed', 'unemployed', 'peasants']) console.log(`  ${key.padEnd(11)} A ${k(A.labour[key]).padStart(8)}  B ${k(B.labour[key]).padStart(8)}  Δ ${d(A.labour[key], B.labour[key])}`);
  console.log(`  unemployed by profession: ` + [...new Set([...Object.keys(A.labour.unempBy), ...Object.keys(B.labour.unempBy)])].sort((x, y) => (B.labour.unempBy[y] || 0) - (B.labour.unempBy[x] || 0)).slice(0, 8).map(p => `${p} ${k(A.labour.unempBy[p] || 0)}→${k(B.labour.unempBy[p] || 0)}`).join(' · '));
  console.log(`\n== BY SECTOR — workers (employed headcount) · staffed levels ÷ levels · value added £/yr · levels failed-hire / laying-off / paused`);
  const secs = [...new Set([...Object.keys(A.sectors), ...Object.keys(B.sectors)])].sort((x, y) => (B.sectors[y]?.workers || 0) - (B.sectors[x]?.workers || 0));
  for (const s of secs) {
    const a = A.sectors[s] || {}, b = B.sectors[s] || {};
    const occ = x => x.levels ? x.staffed / x.levels : NaN, cl = (x, c) => x.levels ? (x.cls?.[c]?.levels || 0) / x.levels : NaN;
    console.log(`  ${s.padEnd(26)} workers ${k(a.workers).padStart(7)} → ${k(b.workers).padStart(7)} (${d(a.workers || 0, b.workers || 0).padStart(7)}) · staffed ${pc(occ(a)).padStart(6)} → ${pc(occ(b)).padStart(6)} · VA £${k(a.va)} → £${k(b.va)} · failed ${pc(cl(a, 'FAILED-HIRE'))}→${pc(cl(b, 'FAILED-HIRE'))} layoff ${pc(cl(a, 'LAYING-OFF'))}→${pc(cl(b, 'LAYING-OFF'))} paused ${pc(cl(a, 'PAUSED'))}→${pc(cl(b, 'PAUSED'))}`);
  }
  console.log(`\n== THE EARNINGS FLOOR, OUTSIDE THE CRAFTS — non-subsidised buildings with value added under £3 per employee a year: do they hire?`);
  console.log(`   (if the crafts' floor leaked to other groups, B's non-craft rows would show fewer failed hires and more inbound hires than A's)`);
  for (const key of Object.keys(A.floorTest)) {
    const a = A.floorTest[key], b = B.floorTest[key] || {};
    const row = x => `${String(x.n || 0).padStart(5)} bldg, failed-hire ${pc((x.failed || 0) / Math.max(1, x.n))}, inbound hire ${pc((x.inbound || 0) / Math.max(1, x.n))}, staffed ${pc(x.staffed / Math.max(1e-9, x.levels))}`;
    console.log(`  ${key.padEnd(34)} A: ${row(a)}   B: ${row(b)}`);
  }
  console.log(`\n== BUILDING TYPES, biggest change in workers first (top ${TOP})`);
  const types = [...new Set([...Object.keys(A.types), ...Object.keys(B.types)])].map(t => ({ t, a: A.types[t] || {}, b: B.types[t] || {} }));
  types.sort((x, y) => Math.abs((y.b.workers || 0) - (y.a.workers || 0)) - Math.abs((x.b.workers || 0) - (x.a.workers || 0)));
  for (const { t, a, b } of types.slice(0, TOP))
    console.log(`  ${t.replace(/^building_/, '').padEnd(46)} [${(b.sector || a.sector || '').slice(0, 14).padEnd(14)}] workers ${k(a.workers || 0).padStart(7)} → ${k(b.workers || 0).padStart(7)} (${d(a.workers || 0, b.workers || 0).padStart(7)}) · levels ${a.levels || 0} → ${b.levels || 0} · staffed ${pc((a.staffed || 0) / Math.max(1, a.levels || 0))} → ${pc((b.staffed || 0) / Math.max(1, b.levels || 0))} · VA/worker £${f2(a.va / a.workers)} → £${f2(b.va / b.workers)}`);
  process.exit(0);
}

// ================================================================= census mode
const SAVE = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const MOD = argOf('--mod', null);
if (!SAVE || !MOD) { console.error('usage: node tools/testbed/ledger/hiring_census.mjs <save.v3> --mod <emitted mod dir> [--book <config>] [--json out]  |  --diff A.json B.json'); process.exit(2); }
let BOOK = argOf('--book', null);
if (!BOOK) {   // the save's own run folder names its config
  const bs = join(dirname(dirname(resolve(SAVE))), 'build_state.json');
  if (existsSync(bs)) BOOK = JSON.parse(readFileSync(bs, 'utf8')).deterministic?.mod_under_test?.built_from_config;
}
if (!BOOK || !existsSync(BOOK)) throw new Error(`hiring_census: no book (pass --book; the save's run folder names none readable: ${BOOK})`);
const cfg = JSON.parse(readFileSync(BOOK, 'utf8'));
const TIER = {};
for (const ind of cfg.industries || []) { if (ind.disabled) continue;
  for (const t of ind.tiers || []) if (!t.method_of) TIER[t.key] = { ind: ind.id, era: t.era ?? 0, craft: !!t.craft };
}

// --- layered game files: a mod file with vanilla's name replaces it, any other mod file adds
const layered = sub => {
  const v = join(GAME, sub), m = join(MOD, sub), mf = existsSync(m) ? readdirSync(m).filter(x => x.endsWith('.txt')) : [];
  const skip = new Set(mf);
  return [...readdirSync(v).filter(x => x.endsWith('.txt') && !skip.has(x)).map(x => join(v, x)), ...mf.map(x => join(m, x))];
};
const braces = t => (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;
const EMP = {};                    // pm -> {profession: level-scaled employment}
for (const f of layered('common/production_methods')) {
  let depth = 0, pm = null, lsDepth = -1;
  for (const raw of strip(readFileSync(f, 'utf8')).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '');
    if (depth === 0) { const m = /^([A-Za-z0-9_\-]+)\s*=\s*\{/.exec(line); if (m) { pm = m[1]; EMP[pm] = {}; } }
    if (pm && lsDepth < 0 && /level_scaled\s*=\s*\{/.test(line)) lsDepth = depth + 1;
    if (pm && lsDepth >= 0) { const e = /building_employment_([a-z_]+)_add\s*=\s*(-?[\d.]+)/.exec(line); if (e) EMP[pm][e[1]] = (EMP[pm][e[1]] || 0) + +e[2]; }
    for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (lsDepth >= 0 && depth < lsDepth) lsDepth = -1; if (depth === 0) pm = null; } }
  }
}
const GROUP = {}, PARENT = {};
for (const f of layered('common/buildings')) {
  let cur = null, depth = 0;
  for (const raw of strip(readFileSync(f, 'utf8')).split(/\r?\n/)) {
    const t = raw.replace(/#.*$/, '');
    if (depth === 0) { const m = /^([a-z_0-9]+)\s*=\s*\{/.exec(t.trim()); if (m) cur = m[1]; }
    else if (cur && depth === 1) { const m = /^\s*building_group\s*=\s*(\S+)/.exec(t); if (m && !GROUP[cur]) GROUP[cur] = m[1]; }
    depth += braces(t); if (depth <= 0) { depth = 0; cur = null; }
  }
}
for (const f of layered('common/building_groups')) {
  let cur = null, depth = 0;
  for (const raw of strip(readFileSync(f, 'utf8')).split(/\r?\n/)) {
    const t = raw.replace(/#.*$/, '');
    if (depth === 0) { const m = /^(bg_[a-z_0-9]+)\s*=\s*\{/.exec(t.trim()); if (m) { cur = m[1]; if (!(cur in PARENT)) PARENT[cur] = null; } }
    else if (cur && depth === 1) { const m = /^\s*parent_group\s*=\s*(\S+)/.exec(t); if (m) PARENT[cur] = m[1]; }
    depth += braces(t); if (depth <= 0) { depth = 0; cur = null; }
  }
}
const SECTOR_OF_GROUP = {
  bg_subsistence_agriculture: 'subsistence', bg_subsistence_ranching: 'subsistence', bg_service: 'urban', bg_owner_buildings: 'owners',
  bg_construction: 'construction', bg_military: 'military', bg_government: 'government', bg_staple_crops: 'agriculture',
  bg_agriculture: 'agriculture', bg_plantations: 'plantations', bg_ranching: 'ranching', bg_extraction: 'extraction',
  bg_private_infrastructure: 'infrastructure', bg_power: 'infrastructure', bg_public_infrastructure: 'infrastructure', bg_canals: 'infrastructure',
  bg_light_industry: 'light industry (untiered)', bg_heavy_industry: 'heavy industry (untiered)', bg_military_industry: 'arms industry (untiered)',
  bg_manufacturing: 'manufacturing (untiered)', bg_arts: 'arts (untiered)', bg_urban_facilities: 'urban',
  bg_monuments: 'monuments', bg_monuments_hidden: 'monuments',
};
// the floor test's groups: the crafts; the rest of their PARENT group bg_light_industry (where a leak would show first); the other tiered
// rungs; and the untiered sectors that sell goods. Government, military, construction and owner buildings sell nothing (value added ≤ 0 by
// construction) and owner buildings carry their own floor (vanilla's 10), so they are read apart.
const floorGroupOf = (key, sec) => sec === 'crafts' ? 'crafts'
  : lightGroupOf(key) ? 'light industry, not crafts'
  : sec.startsWith('tiered') ? 'other tiered rungs'
  : ['agriculture', 'plantations', 'ranching'].includes(sec) ? 'agriculture, plantations, ranching'
  : sec === 'extraction' ? 'extraction'
  : ['infrastructure', 'urban'].includes(sec) ? 'infrastructure, urban'
  : sec === 'owners' ? 'owner buildings (floor 10)'
  : 'government, military, construction, other';
const sectorOf = key => {
  const t = TIER[key];
  if (t) return t.craft ? 'crafts' : `tiered e${t.era}`;
  if (/^building_(regional_)?company_/.test(key)) return 'owners';
  for (let g = GROUP[key], hop = 0; g && hop < 12; g = PARENT[g], hop++) if (SECTOR_OF_GROUP[g]) return SECTOR_OF_GROUP[g];
  return 'other';
};
const lightGroupOf = key => { for (let g = GROUP[key], hop = 0; g && hop < 12; g = PARENT[g], hop++) if (g === 'bg_light_industry') return true; return false; };

// --- the melt
const rak = spawn(join(REPO, 'tools/vendor/rakaly/rakaly.exe'), ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', SAVE]);
let rakErr = ''; rak.stderr.on('data', x => { rakErr += x; });
const rakDone = new Promise((res, rej) => rak.on('close', code => code === 0 ? res() : rej(new Error(`rakaly exited ${code}: ${rakErr.slice(0, 300)}`))));
const rl = createInterface({ input: rak.stdout, crlfDelay: Infinity });
let mode = 'top', date = null, id = null, rec = null, pop = null, cid = null, sid = null, inPM = false, inTr = false, tr = null;
const tagOf = new Map(), stateCountry = new Map(), baseWage = new Map(), B = new Map(), work = new Map();
const labour = { workforce: 0, employed: 0, unemployed: 0, peasants: 0, unempBy: {}, wfBy: {} };
const ctryLab = {};
const closePop = () => {
  if (pop && pop.type && pop.w > 0) {
    labour.workforce += pop.w; labour.wfBy[pop.type] = (labour.wfBy[pop.type] || 0) + pop.w;
    const c = ctryLab[pop.loc] ||= { wf: 0, unemp: 0, peas: 0 }; c.wf += pop.w;
    if (pop.type === 'peasants') { labour.peasants += pop.w; c.peas += pop.w; }
    if (pop.wp != null) { labour.employed += pop.w; const w = work.get(pop.wp) || {}; w[pop.type] = (w[pop.type] || 0) + pop.w; work.set(pop.wp, w); }
    else { labour.unemployed += pop.w; labour.unempBy[pop.type] = (labour.unempBy[pop.type] || 0) + pop.w; c.unemp += pop.w; }
  }
  pop = null;
};
for await (const line of rl) {
  if (mode === 'top') {
    if (!date) { const m = /^date=(\d+\.\d+\.\d+)/.exec(line); if (m) { date = m[1]; continue; } }
    const s = /^([a-z_]+)=\{$/.exec(line); if (!s) continue;
    mode = ['building_manager', 'pops', 'country_manager', 'states'].includes(s[1]) ? s[1] : 'skip'; continue;
  }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
  if (line.charCodeAt(0) === 125) { if (mode === 'pops') closePop(); mode = 'top'; id = cid = sid = null; rec = null; continue; }
  if (line.startsWith('\t\t') && !line.startsWith('\t\t\t')) {
    const m = /^\t\t(\d+)=\{$/.exec(line);
    if (mode === 'pops') { closePop(); if (m) pop = { type: null, w: 0, loc: -1, wp: null }; }
    else if (mode === 'building_manager') { id = m ? +m[1] : null; rec = null; inPM = false; inTr = false; }
    else if (mode === 'country_manager') cid = m ? +m[1] : null;
    else if (mode === 'states') sid = m ? +m[1] : null;
    continue;
  }
  if (mode === 'pops' && pop) {
    if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
    const t = line.slice(3);
    if (t.startsWith('type="')) pop.type = t.slice(6, -1);
    else if (t.startsWith('workforce=')) pop.w = +t.slice(10);
    else if (t.startsWith('location=')) pop.loc = +t.slice(9);
    else if (t.startsWith('workplace=')) pop.wp = +t.slice(10);      // the FULL record id
    continue;
  }
  if (mode === 'building_manager' && id !== null) {
    if (line.startsWith('\t\t\t\t')) {
      if (inPM && rec) for (const p of line.matchAll(/"([^"]+)"/g)) rec.pms.push(p[1]);
      if (inTr && rec) {
        if (line === '\t\t\t\t{') tr = {};
        else if (line === '\t\t\t\t}' && tr) { if (tr.to === rec.key && tr.from !== rec.key) { rec.inN++; rec.inTot += tr.total || 0; } tr = null; }
        else if (tr) { const t5 = line.trim(); let y;
          if ((y = /^new_employment="([^"]+)"$/.exec(t5))) tr.to = y[1]; else if ((y = /^old_employment="([^"]+)"$/.exec(t5))) tr.from = y[1];
          else if ((y = /^transfer_total=([\d.]+)$/.exec(t5))) tr.total = +y[1]; }
      }
      continue;
    }
    inTr = false;
    if (!line.startsWith('\t\t\t')) continue;
    inPM = false; const t = line.slice(3); let x;
    if (t.startsWith('building="')) { rec = { id, key: t.slice(10, -1), pms: [], staffing: 0, levels: 0, sales: 0, cost: 0, profit: 0, inN: 0, inTot: 0, sub: false }; B.set(id, rec); continue; }
    if (!rec) continue;
    if ((x = /^state=(\d+)$/.exec(t))) rec.state = +x[1];
    else if ((x = /^levels=(\d+)$/.exec(t))) rec.levels = +x[1];
    else if ((x = /^staffing=([\d.]+)$/.exec(t))) rec.staffing = +x[1];
    else if ((x = /^salary_rate=([\d.]+)$/.exec(t))) rec.salary = +x[1];
    else if (t === 'production_methods={') inPM = true;
    else if (t === 'employee_transfers={') inTr = true;
    else if ((x = /^last_layoff_date=([\d.]+)$/.exec(t))) rec.layoff = x[1];
    else if ((x = /^last_failed_hire_date=([\d.]+)$/.exec(t))) rec.failed = x[1];
    else if ((x = /^goods_sales=(-?[\d.]+)$/.exec(t))) rec.sales = +x[1];
    else if ((x = /^goods_cost=(-?[\d.]+)$/.exec(t))) rec.cost = +x[1];
    else if ((x = /^profit_after_reserves=(-?[\d.]+)$/.exec(t))) rec.profit = +x[1];
    else if ((x = /^subsidies=(-?[\d.]+)$/.exec(t))) rec.sub = +x[1] > 0;   // the save books the subsidy PAID, no yes/no flag
    continue;
  }
  if (mode === 'country_manager' && cid !== null && line.startsWith('\t\t\t\tbase_wage=') && !baseWage.has(cid)) { baseWage.set(cid, +line.slice(14)); continue; }
  if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
  const t = line.slice(3);
  if (mode === 'country_manager' && cid !== null && t.startsWith('definition="')) tagOf.set(cid, t.slice(12, -1));
  else if (mode === 'states' && sid !== null && t.startsWith('country=')) stateCountry.set(sid, +t.slice(8));
}
closePop();
await rakDone;
if (!date || !tagOf.size || !stateCountry.size || !B.size || !labour.workforce) throw new Error(`hiring_census: read date ${date}, ${tagOf.size} countries, ${stateCountry.size} states, ${B.size} buildings, workforce ${labour.workforce} — the melt's layout moved?`);

// --- per building, then aggregates
const ymd = s => { const [y, m, d] = s.split('.').map(Number); return y + (m - 1) / 12 + (d - 1) / 365; };
const now = ymd(date);
const unknownPm = new Set();
const sectors = {}, types = {};
const floorTest = {};
const Z = () => ({ n: 0, levels: 0, staffed: 0, slots: 0, workers: 0, va: 0, profit: 0, sales: 0, cls: {}, byProf: {}, wageW: [], marginW: [], inbound: 0 });
const add = (o, r) => {
  o.n++; o.levels += r.levels; o.staffed += r.staffing; o.slots += r.slotsTot; o.workers += r.workers; o.va += r.va; o.profit += r.profit * 52; o.sales += r.sales * 52;
  const c = o.cls[r.cls] ||= { n: 0, levels: 0, unstaffed: 0 }; c.n++; c.levels += r.levels; c.unstaffed += r.levels - r.staffing;
  for (const [p, v] of Object.entries(r.emp)) o.byProf[p] = (o.byProf[p] || 0) + v;
  if (Number.isFinite(r.wageRel)) o.wageW.push([r.wageRel, r.levels]); if (Number.isFinite(r.margin)) o.marginW.push([r.margin, r.levels]);
  if (r.inN > 0) o.inbound++;
};
for (const r of B.values()) {
  if (!r.levels) continue;
  let slotsTot = 0; for (const pm of r.pms) { if (!EMP[pm]) { unknownPm.add(pm); continue; } for (const v of Object.values(EMP[pm])) slotsTot += v * r.levels; }
  r.slotsTot = slotsTot;
  r.emp = work.get(r.id) || {}; r.workers = Object.values(r.emp).reduce((a, v) => a + v, 0);
  r.va = (r.sales - r.cost) * 52; r.margin = r.sales > 0 ? r.profit / r.sales : NaN;
  const occ = r.staffing / r.levels;
  const cty = stateCountry.get(r.state); r.wageRel = r.salary / baseWage.get(cty);
  if (r.failed && now - ymd(r.failed) <= 1) r.cls = 'FAILED-HIRE';
  else if (r.layoff && now - ymd(r.layoff) <= 1) r.cls = 'LAYING-OFF';
  else if (occ >= 0.98) r.cls = 'FULL';
  else if (!(r.margin >= 0.2) && occ >= 0.1) r.cls = 'PAUSED';
  else r.cls = 'RAMPING';
  const sec = sectorOf(r.key);
  add(sectors[sec] ||= Z(), r);
  const T = types[r.key] ||= { ...Z(), sector: sec }; add(T, r);
  // the earnings-floor test: non-subsidised buildings holding workers, value added per employee under / over £3 a year
  if (!r.sub && r.workers > 0 && sec !== 'subsistence') {
    const vpw = r.va / r.workers, under = vpw < 3 ? 'under £3' : 'at/over £3';
    const kk = `${floorGroupOf(r.key, sec)}, ${under}`, o = floorTest[kk] ||= { n: 0, levels: 0, staffed: 0, failed: 0, inbound: 0 };
    o.n++; o.levels += r.levels; o.staffed += r.staffing; if (r.cls === 'FAILED-HIRE') o.failed++; if (r.inN > 0) o.inbound++;
  }
}
const wmed = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x[0] - y[0]); const tot = s.reduce((z, x) => z + x[1], 0); let acc = 0; for (const [v, w] of s) { acc += w; if (acc >= tot / 2) return v; } return s[s.length - 1][0]; };
const finish = o => { o.wageMed = wmed(o.wageW); o.marginMed = wmed(o.marginW); delete o.wageW; delete o.marginW; return o; };
for (const o of Object.values(sectors)) finish(o);
for (const o of Object.values(types)) finish(o);

// --- report
console.log(`${date} — ${SAVE}\n  book ${BOOK} · ${B.size} building records · workforce ${k(labour.workforce)}: employed ${k(labour.employed)}, unemployed ${k(labour.unemployed)}, peasants ${k(labour.peasants)}`);
if (unknownPm.size) console.log(`  ⚠ ${unknownPm.size} active method(s) with no employment found in the game or mod files (their slots counted as 0): ${[...unknownPm].slice(0, 8).join(', ')}`);
console.log(`\nBY SECTOR — buildings · levels · staffed ÷ levels · workers · value added £/yr (per worker) · profit ÷ revenue (level-weighted median) · wage ÷ normal · levels by hiring class`);
for (const [s, o] of Object.entries(sectors).sort((a, b) => b[1].workers - a[1].workers))
  console.log(`  ${s.padEnd(26)} ${String(o.n).padStart(6)} bldg ${String(o.levels).padStart(7)} lv ${pc(o.staffed / o.levels).padStart(6)} · ${k(o.workers).padStart(7)} workers · VA £${k(o.va)} (£${f2(o.va / o.workers)}) · margin ${pc(o.marginMed)} · wage ${f2(o.wageMed)} · ` +
    ['FULL', 'RAMPING', 'PAUSED', 'LAYING-OFF', 'FAILED-HIRE'].map(c => `${c.toLowerCase()} ${pc((o.cls[c]?.levels || 0) / o.levels)}`).join(' '));
console.log(`\nTHE EARNINGS FLOOR — non-subsidised buildings holding workers, split at £3 of value added per employee a year:`);
for (const [kk, o] of Object.entries(floorTest).sort()) console.log(`  ${kk.padEnd(40)} ${String(o.n).padStart(6)} bldg · staffed ${pc(o.staffed / o.levels)} · failed-hire ${pc(o.failed / o.n)} · inbound hire ${pc(o.inbound / o.n)}`);
const json = argOf('--json', null);
if (json) {
  const ctry = {};   // labour by country (pops' state -> country)
  for (const [st, c] of Object.entries(ctryLab)) { const tag = tagOf.get(stateCountry.get(+st)) || '?'; const o = ctry[tag] ||= { wf: 0, unemp: 0, peas: 0 }; o.wf += c.wf; o.unemp += c.unemp; o.peas += c.peas; }
  writeFileSync(json, JSON.stringify({ date, save: SAVE, book: BOOK, labour, sectors, types, floorTest, countries: ctry }));
  console.log(`\nwrote ${json}`);
}
