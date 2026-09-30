// WHO IS TO BLAME FOR AN UNDERSTAFFED CRAFT? (BALANCE_FRAMEWORK §10.91.1, FINDINGS F184 §4 and F185, 2026-09-30)
//
//   node tools/testbed/ledger/craft_fill.mjs <save.v3> <book.json> --mod <emitted mod dir> [--game <game dir>]
//        [--max-occ 0.8] [--min-missing 2] [--top 40] [--states] [--built]
//
// Out of one save (streamed rakaly melt), per craft building: levels, staffed levels (`staffing` IS staffed levels), its JOB SLOTS per
// profession (every active production method's level_scaled employment × levels, read from the EMITTED mod over vanilla), the workers
// it holds per profession (the pop table's `workplace`), the BINDING profession (the lowest fill), and the building's own hiring state:
// establishment date, last layoff, last failed hire, hiring rate, profit ÷ revenue, cash reserves, wage. Beside it, its STATE: literacy by
// stratum, the unemployed and the peasants, and the people QUALIFIED for machinist / shopkeeper work who do not hold that job yet.
//
// ⭐ WHY THE BINDING PROFESSION AND NOT "FILL PER PROFESSION": `EMPLOYMENT_PROPORTIONALITY_LIMIT = 0.1` (common/defines) — no two
//   professions of one building may differ by more than 10 points of fill. A building missing its machinists therefore cannot hire its
//   laborers either, and every profession reads short alike: equal fills are what ANY single-profession shortage looks like.
// ⭐ THE ENGINE'S HIRING RULES THE CLASSES READ (common/defines): a building TRIES to hire at a profit margin ≥ 0.25
//   (BUILDING_PROFIT_TARGET_TO_HIRE_EMPLOYEES); it may PAUSE hiring once it holds ≥ 10% of its jobs and makes < 20% of revenue in profit
//   (BUILDING_MIN_EMPLOYMENT_FRACTION_TO_PAUSE_HIRES / BUILDING_MAX_PROFIT_TO_PAUSE_HIRES) — unless its cash reserves are high and it is
//   under half employed; a pop only switches jobs for ≥ 10% more wage (MIN_RAISE_TO_HIRE); weekly hiring is 1–10% of full employment per
//   profession (DEFAULT_MIN/MAX_HIRING_RATE). A FAILED hire (`last_failed_hire_date`) means it tried and found nobody at its wage.
// ⚠⚠ A POP'S `workplace` IS THE BUILDING RECORD'S FULL ID — a reused slot's id carries a generation prefix (slot + k·2^24). Never reduce it.
// ⚠ "Lower / middle / upper" = the professions of the DEFAULT social hierarchy (common/social_classes/00_default.txt), read live; a pop's
//   own `social_class` follows its country's hierarchy (castes, the Edo classes) and is not used. Literacy = literate ÷ WORKFORCE.
// ⚠ Qualifications are the save's own per-pop `qualifications` (index = the alphabetical pop-type order), in workforce units.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--states', '--built'].includes(args[i - 1])));
const [SAVE, BOOK] = pos;
const MOD = argOf('--mod', null);
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
if (!SAVE || !BOOK || !MOD) { console.error('usage: node tools/testbed/ledger/craft_fill.mjs <save.v3> <book.json> --mod <emitted mod dir> [--max-occ 0.8] [--min-missing 2] [--top 40] [--states] [--built]'); process.exit(2); }
const MAXOCC = +argOf('--max-occ', 0.8), MINMISS = +argOf('--min-missing', 2), TOP = +argOf('--top', 40);
const SHOW_STATES = args.includes('--states'), SHOW_BUILT = args.includes('--built');

// --- the book: craft keys
const cfg = JSON.parse(readFileSync(BOOK, 'utf8'));
const CRAFT = {};
for (const ind of cfg.industries) if (!ind.disabled) for (const t of ind.tiers) if (t.craft) CRAFT[t.key] = { ind: ind.id, pm: t.pm_key };
if (!Object.keys(CRAFT).length) throw new Error(`craft_fill: ${BOOK} carries no craft rung (tier.craft)`);

// --- production-method employment (level_scaled building_employment_<profession>_add per level): vanilla's files, then the emitted
//     mod's \u2014 a mod file with vanilla's name REPLACES that vanilla file (whole-file ownership), a zzz file adds methods
const EMP = {};
const vanDir = join(GAME, 'common/production_methods'), modDir = join(MOD, 'common/production_methods');
if (!existsSync(modDir)) throw new Error(`craft_fill: no production_methods in ${MOD} \u2014 pass --mod <the book's emitted mod dir> (build.ps1 -SaveTo <name> -Config <book>)`);
const modFiles = new Set(readdirSync(modDir));
const readPmFiles = (dir, skip) => {
  for (const f of readdirSync(dir).filter(x => x.endsWith('.txt') && !(skip && skip.has(x)))) {
    const lines = readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
    let depth = 0, pm = null, lsDepth = -1;
    for (const raw of lines) {
      const line = raw.replace(/#.*/, '');
      if (depth === 0) { const m = /^([A-Za-z0-9_\-]+)\s*=\s*\{/.exec(line); if (m) { pm = m[1]; EMP[pm] = {}; } }
      if (pm && lsDepth < 0 && /level_scaled\s*=\s*\{/.test(line)) lsDepth = depth + 1;
      if (pm && lsDepth >= 0) { const e = /building_employment_([a-z_]+)_add\s*=\s*(-?[\d.]+)/.exec(line); if (e) EMP[pm][e[1]] = (EMP[pm][e[1]] || 0) + +e[2]; }
      for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (lsDepth >= 0 && depth < lsDepth) lsDepth = -1; if (depth === 0) pm = null; } }
    }
  }
};
readPmFiles(vanDir, modFiles);
readPmFiles(modDir, null);
for (const [key, c] of Object.entries(CRAFT)) if (!EMP[c.pm] || !Object.keys(EMP[c.pm]).length) throw new Error(`craft_fill: no employment found for ${key}'s main method ${c.pm} in ${modDir}`);

// --- pop types (qualification index = alphabetical order) and the default hierarchy's strata
const POP_TYPES = readdirSync(join(GAME, 'common/pop_types')).filter(x => x.endsWith('.txt')).sort().map(x => x.replace(/\.txt$/, ''));
const QI = { machinists: POP_TYPES.indexOf('machinists'), shopkeepers: POP_TYPES.indexOf('shopkeepers'), laborers: POP_TYPES.indexOf('laborers') };
const STRATUM = {};
{ const t = readFileSync(join(GAME, 'common/social_classes/00_default.txt'), 'utf8');
  for (const [cls, st] of [['lower_class', 'lower'], ['middle_class', 'middle'], ['upper_class', 'upper']]) {
    const m = new RegExp(cls + '\\s*=\\s*\\{[\\s\\S]*?allowed_professions\\s*=\\s*\\{([^}]*)\\}').exec(t);
    if (!m) throw new Error(`craft_fill: no ${cls} in common/social_classes/00_default.txt`);
    for (const p of m[1].trim().split(/\s+/)) STRATUM[p] = st;
  } }
const QRE = new RegExp('(?:^|\\s)(\\d+)=([\\d.]+)', 'g');

// --- the melt
const rak = spawn(join(REPO, 'tools/vendor/rakaly/rakaly.exe'), ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', SAVE]);
let rakErr = ''; rak.stderr.on('data', d => { rakErr += d; });
const rakDone = new Promise((res, rej) => rak.on('close', code => code === 0 ? res() : rej(new Error(`rakaly exited ${code}: ${rakErr.slice(0, 300)}`))));
const rl = createInterface({ input: rak.stdout, crlfDelay: Infinity });
let mode = 'top', date = null, id = null, rec = null, pop = null, cid = null, sid = null, inPM = false, inQual = false, inTr = false, tr = null;
const tagOf = new Map(), stateCountry = new Map(), stateName = new Map(), B = new Map(), baseWage = new Map(); // baseWage: country id -> its normal wage rate
const work = new Map(), S = new Map();
const st = s => { let x = S.get(s); if (!x) S.set(s, x = { wf: {}, lit: {}, unemp: 0, qm: 0, qs: 0, strata: { lower: [0, 0], middle: [0, 0], upper: [0, 0] } }); return x; };
const closePop = () => {
  if (pop && pop.type && pop.w > 0) {
    if (pop.wp != null) { const w = work.get(pop.wp) || {}; w[pop.type] = (w[pop.type] || 0) + pop.w; work.set(pop.wp, w); }
    if (pop.loc >= 0) {
      const x = st(pop.loc); x.wf[pop.type] = (x.wf[pop.type] || 0) + pop.w; x.lit[pop.type] = (x.lit[pop.type] || 0) + pop.lit;
      const sg = STRATUM[pop.type]; if (sg) { x.strata[sg][0] += pop.w; x.strata[sg][1] += pop.lit; }
      if (pop.wp == null) x.unemp += pop.w;
      if (pop.type !== 'machinists') x.qm += pop.q[QI.machinists] || 0;
      if (pop.type !== 'shopkeepers') x.qs += pop.q[QI.shopkeepers] || 0;
    }
  }
  pop = null; inQual = false;
};
const closeBld = () => {};
for await (const line of rl) {
  if (mode === 'top') {
    if (!date) { const d = /^date=(\d+\.\d+\.\d+)/.exec(line); if (d) { date = d[1]; continue; } }
    const s = /^([a-z_]+)=\{$/.exec(line); if (!s) continue;
    mode = ['building_manager', 'pops', 'country_manager', 'states'].includes(s[1]) ? s[1] : 'skip'; continue;
  }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
  if (line.charCodeAt(0) === 125) { if (mode === 'pops') closePop(); if (mode === 'building_manager') closeBld(); mode = 'top'; id = cid = sid = null; rec = null; continue; }
  if (line.startsWith('\t\t') && !line.startsWith('\t\t\t')) {
    const m = /^\t\t(\d+)=\{$/.exec(line);
    if (mode === 'pops') { closePop(); if (m) pop = { type: null, w: 0, lit: 0, loc: -1, wp: null, q: {} }; }
    else if (mode === 'building_manager') { closeBld(); id = m ? +m[1] : null; rec = null; inPM = false; }
    else if (mode === 'country_manager') cid = m ? +m[1] : null;
    else if (mode === 'states') sid = m ? +m[1] : null;
    continue;
  }
  if (mode === 'pops' && pop) {
    if (line.startsWith('\t\t\t\t')) { if (inQual) { let q; QRE.lastIndex = 0; const t = line.trim(); while ((q = QRE.exec(t))) { if (+q[1] < POP_TYPES.length + 1) pop.q[+q[1]] = +q[2]; } } continue; }
    if (!line.startsWith('\t\t\t')) continue;
    inQual = false; const t = line.slice(3);
    if (t.startsWith('type="')) pop.type = t.slice(6, -1);
    else if (t.startsWith('workforce=')) pop.w = +t.slice(10);
    else if (t.startsWith('num_literate=')) pop.lit = +t.slice(13);
    else if (t.startsWith('location=')) pop.loc = +t.slice(9);
    else if (t.startsWith('workplace=')) pop.wp = +t.slice(10);   // the FULL record id
    else if (t === 'qualifications={') inQual = true;
    continue;
  }
  if (mode === 'building_manager' && id !== null) {
    // the active methods sit on ONE line, several quoted names side by side
    if (line.startsWith('\t\t\t\t')) {
      if (inPM && rec) for (const p of line.matchAll(/"([^"]+)"/g)) rec.pms.push(p[1]);
      // employee_transfers: the building's recent job moves; an INBOUND one names this building type as new_employment and another
      // (or none — the unemployment pool) as old_employment
      if (inTr && rec) {
        if (line === '\t\t\t\t{') tr = {};
        else if (line === '\t\t\t\t}' && tr) { if (tr.to === rec.key && tr.from !== rec.key) { rec.inN = (rec.inN || 0) + 1; rec.inTot = (rec.inTot || 0) + (tr.total || 0); rec.inTypes = rec.inTypes || {}; rec.inTypes[tr.newType] = (rec.inTypes[tr.newType] || 0) + (tr.total || 0); } else if (tr.from === rec.key && tr.to !== rec.key) { rec.outN = (rec.outN || 0) + 1; } tr = null; }
        else if (tr) { const t5 = line.trim(); let y;
          if ((y = /^new_employment="([^"]+)"$/.exec(t5))) tr.to = y[1]; else if ((y = /^old_employment="([^"]+)"$/.exec(t5))) tr.from = y[1];
          else if ((y = /^new_pop_type="([^"]+)"$/.exec(t5))) tr.newType = y[1]; else if ((y = /^transfer_total=([\d.]+)$/.exec(t5))) tr.total = +y[1]; }
      }
      continue;
    }
    inTr = false;
    if (!line.startsWith('\t\t\t')) continue;
    inPM = false; const t = line.slice(3); let x;
    if (t.startsWith('building="')) { const bk = t.slice(10, -1); if (CRAFT[bk]) { rec = { id, key: bk, pms: [], staffing: 0, levels: 0 }; B.set(id, rec); } continue; }
    if (!rec) continue;
    if ((x = /^state=(\d+)$/.exec(t))) { rec.state = +x[1]; continue; }
    if ((x = /^salary_rate=([\d.]+)$/.exec(t))) { rec.salary = +x[1]; continue; }
    if ((x = /^staffing=([\d.]+)$/.exec(t))) { rec.staffing = +x[1]; continue; }
    if (t === 'production_methods={') { inPM = true; continue; }
    if (t === 'employee_transfers={') { inTr = true; continue; }
    if ((x = /^levels=(\d+)$/.exec(t))) rec.levels = +x[1];
    else if ((x = /^last_updated_level=(\d+)$/.exec(t))) rec.lastLevel = +x[1];
    else if ((x = /^establishment_date=([\d.]+)$/.exec(t))) rec.est = x[1];
    else if ((x = /^last_layoff_date=([\d.]+)$/.exec(t))) rec.layoff = x[1];
    else if ((x = /^last_failed_hire_date=([\d.]+)$/.exec(t))) rec.failed = x[1];
    else if ((x = /^auto_downsize_start_date=([\d.]+)$/.exec(t))) rec.downsize = x[1];
    else if ((x = /^hiring_rate=([\d.]+)$/.exec(t))) rec.hire = +x[1];
    else if ((x = /^cash_reserves=(-?[\d.]+)$/.exec(t))) rec.cash = +x[1];
    else if ((x = /^goods_sales=(-?[\d.]+)$/.exec(t))) rec.sales = +x[1];
    else if ((x = /^goods_cost=(-?[\d.]+)$/.exec(t))) rec.cost = +x[1];
    else if ((x = /^profit_after_reserves=(-?[\d.]+)$/.exec(t))) rec.profit = +x[1];
    else if ((x = /^previous_staffing=([\d.]+)$/.exec(t))) rec.prevStaff = +x[1];
    continue;
  }
  // a country's normal wage rate sits in its budget block, one level down
  if (mode === 'country_manager' && cid !== null && line.startsWith('\t\t\t\tbase_wage=') && !baseWage.has(cid)) { baseWage.set(cid, +line.slice(14)); continue; }
  if (!line.startsWith('\t\t\t') || line.startsWith('\t\t\t\t')) continue;
  const t = line.slice(3);
  if (mode === 'country_manager' && cid !== null && t.startsWith('definition="')) tagOf.set(cid, t.slice(12, -1));
  else if (mode === 'states' && sid !== null) { if (t.startsWith('country=')) stateCountry.set(sid, +t.slice(8)); else if (t.startsWith('region="')) stateName.set(sid, t.slice(8, -1).replace(/^STATE_/, '')); }
}
closePop(); closeBld();
await rakDone;
if (!date || !tagOf.size || !stateCountry.size || !B.size) throw new Error(`craft_fill: read date ${date}, ${tagOf.size} countries, ${stateCountry.size} states, ${B.size} craft buildings — the melt's layout moved?`);

// --- per building: slots, employed, binding profession, class
const ymd = s => { const [y, m, d] = s.split('.').map(Number); return y + (m - 1) / 12 + (d - 1) / 365; };
const now = ymd(date);
const med = a => { if (!a || !a.length) return NaN; const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const rows = [];
for (const r of B.values()) {
  const slots = {};
  for (const pm of r.pms) for (const [p, v] of Object.entries(EMP[pm] || {})) slots[p] = (slots[p] || 0) + v * r.levels;
  const emp = work.get(r.id) || {};
  const fills = Object.entries(slots).filter(([, v]) => v > 0).map(([p, v]) => [p, (emp[p] || 0) / v]).sort((a, b) => a[1] - b[1]);
  const occ = r.levels ? r.staffing / r.levels : 0;
  const margin = r.sales > 0 ? r.profit / r.sales : NaN;
  const recentLayoff = r.layoff && now - ymd(r.layoff) <= 1, recentFail = r.failed && now - ymd(r.failed) <= 1;
  // class: what the engine's own rules say stops this building hiring
  let cls;
  if (recentFail) cls = 'FAILED-HIRE';               // it tried and found nobody willing at its wage
  else if (recentLayoff) cls = 'LAYING-OFF';          // shedding workers: pays less than their target wealth, or loses money
  else if (!(margin >= 0.2) && occ >= 0.1) cls = 'PAUSED';   // profit under 20% of revenue: allowed to stop hiring
  else cls = 'RAMPING';                                // none of the above: hiring at its rate, or just built
  const cty = stateCountry.get(r.state), tag = tagOf.get(cty) || '?';
  const empTot = Object.values(emp).reduce((a, v) => a + v, 0);
  rows.push({ ...r, tag, occ, missing: r.levels - r.staffing, slots, emp, fills, bind: fills[0] ? fills[0][0] : '-', margin, cls, recentLayoff, recentFail,
    wageRel: r.salary / baseWage.get(cty), empTot,
    // annual £ per employee — BUILDING_DEFAULT_MIN_EARNINGS_TO_HIRE_EMPLOYEES (3): a building will not hire below it; read two ways
    vaPerEmp: empTot > 0 ? (r.sales - r.cost) * 52 / empTot : NaN, profitPerEmp: empTot > 0 ? r.profit * 52 / empTot : NaN });
}

const f0 = v => Number.isFinite(v) ? v.toFixed(0) : '—', f2 = v => Number.isFinite(v) ? v.toFixed(2) : '—', pc = v => Number.isFinite(v) ? (v * 100).toFixed(0) + '%' : '—';
const k = v => !Number.isFinite(v) ? '—' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : v.toFixed(0);
const all = rows.length, totLv = rows.reduce((a, r) => a + r.levels, 0), totMiss = rows.reduce((a, r) => a + r.missing, 0);
console.log(`${date}: ${all} craft buildings, ${totLv} levels, ${totMiss.toFixed(0)} levels unstaffed (${pc(totMiss / totLv)}).`);
console.log(`Unstaffed levels by the class the engine's hiring rules put a building in (FAILED-HIRE and LAYING-OFF: within the last year):`);
const byCls = {};
for (const r of rows) { const c = byCls[r.cls] ||= { n: 0, lv: 0, miss: 0, bind: {} }; c.n++; c.lv += r.levels; c.miss += r.missing; c.bind[r.bind] = (c.bind[r.bind] || 0) + r.missing; }
for (const [c, x] of Object.entries(byCls).sort((a, b) => b[1].miss - a[1].miss))
  console.log(`  ${c.padEnd(12)} ${String(x.n).padStart(4)} buildings ${String(x.lv).padStart(6)} levels, ${x.miss.toFixed(0).padStart(5)} unstaffed — binding profession (unstaffed levels): ${Object.entries(x.bind).sort((a, b) => b[1] - a[1]).map(([p, v]) => `${p} ${v.toFixed(0)}`).join(', ')}`);

// --- the blame split over EVERY understaffed craft, in the order the engine's own rules bind (common/defines):
//   QUALIFICATION: the binding profession needs a qualification (machinists, shopkeepers) and the state holds fewer people qualified for it,
//                  outside that job, than the building is missing — no wage or margin could fill it;
//   NO FREE LABOUR: laborers bind and the state has neither unemployed nor peasants to spare (their sum under the building's own laborer gap);
//   MARGIN < 25%:  profit under a quarter of revenue — below BUILDING_PROFIT_TARGET_TO_HIRE_EMPLOYEES and _TO_RAISE_WAGES (0.25), so the
//                  building neither hires actively nor raises its wage to win workers (under 0.20 it may also pause outright);
//   OTHER:         margin ≥ 25% with candidates in the state — the hiring-rate ramp, or a wage that loses to the alternatives.
const blame = {}, blameLv = {};
const under = rows.filter(r => r.missing > 0.5 && r.occ < 0.9);
for (const r of under) {
  const s = S.get(r.state) || st(r.state), gap = p => (r.slots[p] || 0) - (r.emp[p] || 0);
  let why;
  if (r.bind === 'machinists' && s.qm < gap('machinists')) why = 'QUALIFICATION (machinists)';
  else if (r.bind === 'shopkeepers' && s.qs < gap('shopkeepers')) why = 'QUALIFICATION (shopkeepers)';
  else if (r.bind === 'laborers' && (s.unemp + (s.wf.peasants || 0)) < gap('laborers')) why = 'NO FREE LABOUR';
  else if (!(r.margin >= 0.25)) why = 'MARGIN < 25%';
  else why = 'OTHER';
  r.why = why;
  blame[why] = (blame[why] || 0) + 1; blameLv[why] = (blameLv[why] || 0) + r.missing;
}
const underMiss = under.reduce((a, r) => a + r.missing, 0);
console.log(`\nWHO IS TO BLAME — every craft under 90% staffed (${under.length} buildings, ${underMiss.toFixed(0)} unstaffed levels), by the first rule that binds:`);
for (const [w, n] of Object.entries(blame).sort((a, b) => blameLv[b[0]] - blameLv[a[0]])) console.log(`  ${w.padEnd(28)} ${String(n).padStart(4)} buildings, ${blameLv[w].toFixed(0).padStart(5)} unstaffed levels (${pc(blameLv[w] / underMiss)})`);
const wr = under.map(r => r.wageRel).filter(Number.isFinite), mg = under.map(r => r.margin).filter(Number.isFinite);
console.log(`  their wage ÷ the country's normal rate: median ${f2(med(wr))} (under 0.5 in ${wr.filter(v => v < 0.5).length} of ${wr.length}); profit ÷ revenue: median ${pc(med(mg))} (under 20% in ${mg.filter(v => v < 0.2).length} of ${mg.length})`);
const okRows = rows.filter(r => r.occ >= 0.9), wo = okRows.map(r => r.wageRel).filter(Number.isFinite), mo = okRows.map(r => r.margin).filter(Number.isFinite);
console.log(`  for contrast, the ${okRows.length} crafts at ≥ 90%: wage median ${f2(med(wo))}, profit ÷ revenue median ${pc(med(mo))}`);
const vu = under.map(r => r.vaPerEmp).filter(Number.isFinite), pu = under.map(r => r.profitPerEmp).filter(Number.isFinite);
const vo = okRows.map(r => r.vaPerEmp).filter(Number.isFinite), po = okRows.map(r => r.profitPerEmp).filter(Number.isFinite);
console.log(`  annual £ per employee (the min-earnings-to-hire rule, 3): value added — understaffed median ${f2(med(vu))} (under 3 in ${vu.filter(v => v < 3).length} of ${vu.length}), staffed median ${f2(med(vo))} (under 3 in ${vo.filter(v => v < 3).length} of ${vo.length}); profit — understaffed median ${f2(med(pu))} (under 3 in ${pu.filter(v => v < 3).length}), staffed median ${f2(med(po))} (under 3 in ${po.filter(v => v < 3).length})`);
// does the value-added reading hold? a building under the floor should record no INBOUND hires
for (const [lab, set] of [['understaffed, value added < £3', under.filter(r => r.vaPerEmp < 3)], ['understaffed, value added ≥ £3', under.filter(r => r.vaPerEmp >= 3)], ['staffed ≥ 90%', okRows]]) {
  const withIn = set.filter(r => (r.inN || 0) > 0);
  console.log(`  ${lab.padEnd(34)}: ${String(set.length).padStart(4)} buildings, ${String(withIn.length).padStart(4)} with an inbound hire in their transfer log (${pc(withIn.length / Math.max(1, set.length))})`);
}
const qmRatio = under.filter(r => r.bind === 'machinists').map(r => { const s = S.get(r.state); const g = (r.slots.machinists || 0) - (r.emp.machinists || 0); return g > 0 ? s.qm / g : Infinity; });
if (qmRatio.length) console.log(`  where machinists bind (${qmRatio.length} buildings): people qualified as machinists in the state ÷ the building's machinist gap — min ${f2(Math.min(...qmRatio))}, median ${f2(med(qmRatio))}`);

// --- the cases, biggest shortfall first
const cases = rows.filter(r => r.occ < MAXOCC && r.missing >= MINMISS).sort((a, b) => b.missing - a.missing);
console.log(`\nTHE CASES — occupancy < ${pc(MAXOCC)} and ≥ ${MINMISS} levels unstaffed: ${cases.length} buildings, ${cases.reduce((a, r) => a + r.missing, 0).toFixed(0)} levels unstaffed. Biggest first.`);
console.log(`Per building: fill per profession (workers ÷ slots, slots from every active method); profit ÷ revenue; cash in weeks of revenue; its wage ÷ its`);
console.log(`country's normal wage rate. Per state: literacy by stratum (lower / middle / upper, literate ÷ workforce), unemployed, peasants, and the`);
console.log(`people QUALIFIED as machinists / shopkeepers who do not hold that job (the stock a machinist or shopkeeper vacancy can hire from).`);
const shownStates = new Set();
for (const r of cases.slice(0, TOP)) {
  const s = S.get(r.state) || st(r.state);
  const fillTxt = r.fills.map(([p, v]) => `${p} ${pc(v)} of ${k(r.slots[p])}`).join(' · ');
  console.log(`\n${r.tag} ${(stateName.get(r.state) || r.state)} — ${CRAFT[r.key].ind} craft #${r.id}: ${r.levels} levels, ${f2(r.staffing)} staffed (${pc(r.occ)}), est. ${r.est}; ${r.cls} → ${r.why || '—'}`);
  console.log(`   fill: ${fillTxt}   → binding ${r.bind}   [methods: ${r.pms.join(', ')}]`);
  console.log(`   profit £${f0(r.profit)}/wk on sales £${f0(r.sales)} (${pc(r.margin)} of revenue) · per employee a year: value added £${f2(r.vaPerEmp)}, profit £${f2(r.profitPerEmp)} · cash ${f0(r.cash / Math.max(1, r.sales))} wk of sales · hiring rate ${r.hire} · wage ${f2(r.wageRel)}× the country's normal rate · last layoff ${r.layoff || '—'} · last failed hire ${r.failed || '—'}${r.downsize ? ' · DOWNSIZING since ' + r.downsize : ''}`);
  if (!shownStates.has(r.state)) {
    shownStates.add(r.state);
    const L = s.strata; const lit = x => x[0] ? pc(x[1] / x[0]) : '—';
    console.log(`   state: literacy lower ${lit(L.lower)} (${k(L.lower[0])}) / middle ${lit(L.middle)} (${k(L.middle[0])}) / upper ${lit(L.upper)} (${k(L.upper[0])}) · unemployed ${k(s.unemp)} · peasants ${k(s.wf.peasants || 0)} · laborers ${k(s.wf.laborers || 0)} · machinists ${k(s.wf.machinists || 0)} · shopkeepers ${k(s.wf.shopkeepers || 0)}`);
    console.log(`          qualified, not holding the job: machinists ${k(s.qm)} · shopkeepers ${k(s.qs)}   (this craft's gap: machinists ${k((r.slots.machinists || 0) - (r.emp.machinists || 0))}, shopkeepers ${k((r.slots.shopkeepers || 0) - (r.emp.shopkeepers || 0))})`);
  }
}

// --- built during the game: did they staff?
//   A building's establishment date is also reset when its state changes hands (a conquered or split state gets a new building record),
//   so a date after 1836 is NOT construction by itself. The emitted 1836 map separates the two: a craft in a region (and owner) that
//   held NO craft of that key in 1836 was CONSTRUCTED; one where the 1836 map had it was RE-ESTABLISHED; a building still dated
//   1836.1.1 with more levels than the map gave it was EXPANDED.
if (SHOW_BUILT) {
  const hist = new Map();   // "REGION|TAG|key" -> 1836 levels
  const hdir = join(MOD, 'common/history/buildings');
  for (const f of readdirSync(hdir).filter(x => x.endsWith('.txt'))) {
    let region = null, tag = null, key = null, lv = 0, inCb = false, depthCb = 0, depth = 0;
    for (const raw of readFileSync(join(hdir, f), 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
      const line = raw.replace(/#.*/, '');
      let m;
      if ((m = /s:(STATE_[A-Za-z0-9_]+)\s*=\s*\{/.exec(line))) region = m[1].replace(/^STATE_/, '');
      if ((m = /region_state:([A-Za-z0-9]+)\s*=\s*\{/.exec(line))) tag = m[1];
      if (!inCb && /create_building\s*=\s*\{/.test(line)) { inCb = true; depthCb = depth; key = null; lv = 0; }
      if (inCb) { if ((m = /building\s*=\s*"([^"]+)"/.exec(line)) && !key) key = m[1]; if ((m = /\blevels?\s*=\s*(\d+)/.exec(line))) lv += +m[1]; }
      for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (inCb && depth === depthCb) { inCb = false; if (key && CRAFT[key]) { const h = `${region}|${tag}|${key}`; hist.set(h, (hist.get(h) || 0) + lv); } } } }
    }
  }
  const regKey = new Set([...hist.keys()].map(h => { const [r, , kk] = h.split('|'); return `${r}|${kk}`; }));
  const orig = rows.filter(r => r.est === '1836.1.1'), later = rows.filter(r => r.est && r.est !== '1836.1.1');
  const constructed = later.filter(r => !regKey.has(`${stateName.get(r.state)}|${r.key}`)), reest = later.filter(r => regKey.has(`${stateName.get(r.state)}|${r.key}`));
  const sumLS = a => [a.reduce((x, r) => x + r.levels, 0), a.reduce((x, r) => x + r.staffing, 0)];
  const [oL, oS] = sumLS(orig), [cL, cS] = sumLS(constructed), [rL, rS] = sumLS(reest);
  console.log(`\nBUILT OR EXPANDED DURING THE GAME, against the emitted 1836 map (${hist.size} craft entries):`);
  console.log(`   dated 1836.1.1 (the original buildings):             ${String(orig.length).padStart(4)} buildings, ${String(oL).padStart(5)} levels, ${pc(oS / oL)} staffed`);
  console.log(`   CONSTRUCTED (no such craft in the region in 1836):    ${String(constructed.length).padStart(4)} buildings, ${String(cL).padStart(5)} levels, ${pc(cS / cL)} staffed`);
  console.log(`   re-established (the region had one — a state that changed hands, or a rebuild): ${reest.length} buildings, ${rL} levels, ${pc(rS / rL)} staffed`);
  let expL = 0, expAdd = 0, expStaffBeyond = 0, expN = 0; const expRows = [];
  for (const r of orig) {
    const h = hist.get(`${stateName.get(r.state)}|${r.tag}|${r.key}`); if (h == null || r.levels <= h) continue;
    expN++; expL += r.levels; expAdd += r.levels - h; const beyond = Math.max(0, r.staffing - h); expStaffBeyond += beyond; expRows.push({ r, h, beyond });
  }
  console.log(`   EXPANDED originals (more levels than the 1836 map gave them): ${expN} buildings, +${expAdd} levels added; staffed levels beyond the original count: ${expStaffBeyond.toFixed(1)} (${pc(expStaffBeyond / Math.max(1, expAdd))} of the added levels at most)`);
  const bins = [[0, 0.1], [0.1, 0.5], [0.5, 0.8], [0.8, 1.01]];
  console.log(`   constructed, by occupancy: ` + bins.map(([lo, hi]) => { const b = constructed.filter(r => r.occ >= lo && r.occ < hi); return `${pc(lo)}–${pc(Math.min(hi, 1))}: ${b.length} bldg / ${b.reduce((a, r) => a + r.levels, 0)} lv`; }).join(' · '));
  const byAge = {};
  for (const r of constructed) { const age = now - ymd(r.est); const b = age < 1 ? 'a <1y' : age < 3 ? 'b 1–3y' : age < 10 ? 'c 3–10y' : 'd 10y+'; const x = byAge[b] ||= { n: 0, lv: 0, st: 0 }; x.n++; x.lv += r.levels; x.st += r.staffing; }
  console.log(`   constructed, by age: ` + Object.entries(byAge).sort().map(([b, x]) => `${b.slice(2)} ago ${x.n} bldg / ${x.lv} lv / ${pc(x.st / x.lv)} staffed`).join(' · '));
  const byInd = {};
  for (const r of constructed) { const x = byInd[CRAFT[r.key].ind] ||= { n: 0, lv: 0, st: 0 }; x.n++; x.lv += r.levels; x.st += r.staffing; }
  console.log(`   constructed, by industry: ` + Object.entries(byInd).sort((a, b) => b[1].lv - a[1].lv).map(([i, x]) => `${i} ${x.n}/${x.lv} lv/${pc(x.st / x.lv)}`).join(' · '));
  const byTag = {};
  for (const r of constructed) { const x = byTag[r.tag] ||= { n: 0, lv: 0, st: 0 }; x.n++; x.lv += r.levels; x.st += r.staffing; }
  console.log(`   constructed, by country (bldg/levels/staffed): ` + Object.entries(byTag).sort((a, b) => b[1].lv - a[1].lv).slice(0, 25).map(([t, x]) => `${t} ${x.n}/${x.lv}/${pc(x.st / x.lv)}`).join('  '));
  const cls = {};
  for (const r of constructed.filter(x => x.occ < 0.5)) { cls[r.cls] = (cls[r.cls] || 0) + r.levels; }
  console.log(`   constructed and under half staffed, levels by hiring state: ` + Object.entries(cls).map(([c, v]) => `${c} ${v}`).join(' · ') + `; their profit ÷ revenue median ${pc(med(constructed.filter(x => x.occ < 0.5).map(x => x.margin).filter(Number.isFinite)))}, wage ÷ normal median ${f2(med(constructed.filter(x => x.occ < 0.5).map(x => x.wageRel).filter(Number.isFinite)))}`);
  if (expRows.length) {
    console.log(`   the largest expansions of originals:`);
    for (const { r, h, beyond } of expRows.sort((a, b) => (b.r.levels - b.h) - (a.r.levels - a.h)).slice(0, 15))
      console.log(`     ${r.tag} ${stateName.get(r.state)} ${CRAFT[r.key].ind}: ${h} → ${r.levels} levels, staffed ${f2(r.staffing)} (${pc(r.occ)}), staffed beyond the original ${f2(beyond)}; ${r.cls}, profit ${pc(r.margin)} of revenue, wage ${f2(r.wageRel)}×`);
  }
}
if (SHOW_BUILT && false) {
  const built = rows.filter(r => r.est && r.est !== '1836.1.1');
  console.log(`\nCRAFT BUILDINGS ESTABLISHED AFTER 1836.1.1: ${built.length} of ${all} (${built.reduce((a, r) => a + r.levels, 0)} levels).`);
  const bins = [[0, 0.1], [0.1, 0.5], [0.5, 0.8], [0.8, 1.01]];
  for (const [lo, hi] of bins) { const b = built.filter(r => r.occ >= lo && r.occ < hi); console.log(`   occupancy ${pc(lo)}–${pc(Math.min(hi, 1))}: ${b.length} buildings, ${b.reduce((a, r) => a + r.levels, 0)} levels`); }
  const byAge = {};
  for (const r of built) { const age = now - ymd(r.est); const b = age < 1 ? '<1y' : age < 3 ? '1–3y' : age < 10 ? '3–10y' : '10y+'; const x = byAge[b] ||= { n: 0, lv: 0, st: 0 }; x.n++; x.lv += r.levels; x.st += r.staffing; }
  for (const [b, x] of Object.entries(byAge)) console.log(`   built ${b.padEnd(6)} ago: ${x.n} buildings, ${x.lv} levels, ${pc(x.st / x.lv)} staffed`);
  const byYear = {};
  for (const r of built) { const y = r.est.split('.')[0]; const b = byYear[y] ||= { n: 0, lv: 0, st: 0 }; b.n++; b.lv += r.levels; b.st += r.staffing; }
  console.log(`   by establishment year: ` + Object.entries(byYear).sort().map(([y, b]) => `${y} ${b.n}/${b.lv}lv/${pc(b.st / b.lv)}`).join('  '));
  const byTag = {};
  for (const r of built) { const b = byTag[r.tag] ||= { n: 0, lv: 0, st: 0 }; b.n++; b.lv += r.levels; b.st += r.staffing; }
  console.log(`   by country (buildings/levels/staffed): ` + Object.entries(byTag).sort((a, b) => b[1].lv - a[1].lv).slice(0, 20).map(([t, b]) => `${t} ${b.n}/${b.lv}/${pc(b.st / b.lv)}`).join('  '));
  const low = built.filter(r => r.occ < 0.2).sort((a, b) => b.levels - a.levels);
  if (low.length) { console.log(`   under 20% staffed:`); for (const r of low.slice(0, 25)) console.log(`     ${r.tag} ${stateName.get(r.state) || r.state} ${CRAFT[r.key].ind} #${r.id}: ${r.levels} levels, ${pc(r.occ)} staffed, est. ${r.est}, ${r.cls}, binding ${r.bind}, profit £${f0(r.profit)} on £${f0(r.sales)}`); }
}

// --- per-state literacy table for every state holding crafts
if (SHOW_STATES) {
  const agg = new Map();
  for (const r of rows) { let a = agg.get(r.state); if (!a) agg.set(r.state, a = { tag: r.tag, lv: 0, st: 0, bind: {} }); a.lv += r.levels; a.st += r.staffing; a.bind[r.bind] = (a.bind[r.bind] || 0) + r.missing; }
  // craft staffing by the state's LOWER-class literacy, level-weighted — is literacy where the crafts go empty?
  const bands = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 1.01]], bt = bands.map(() => ({ n: 0, lv: 0, st: 0 }));
  for (const [sid, a] of agg) { const L = (S.get(sid) || st(sid)).strata.lower; if (!L[0]) continue; const lit = L[1] / L[0]; const i = bands.findIndex(([lo, hi]) => lit >= lo && lit < hi); if (i < 0) continue; bt[i].n++; bt[i].lv += a.lv; bt[i].st += a.st; }
  console.log(`\nCRAFT STAFFING BY THE STATE'S LOWER-CLASS LITERACY (level-weighted): ` + bands.map(([lo, hi], i) => `${pc(lo)}–${pc(Math.min(hi, 1))}: ${bt[i].n} states, ${bt[i].lv} lv, ${pc(bt[i].st / bt[i].lv)} staffed`).join(' · '));
  console.log(`\nEVERY CRAFT STATE, least staffed first: craft levels, staffed, literacy by stratum, unemployed, peasants, qualified machinists / shopkeepers`);
  const share = a => a.lv ? a.st / a.lv : 2;
  for (const [sid, a] of [...agg].sort((p, q) => share(p[1]) - share(q[1]))) {
    const s = S.get(sid) || st(sid), L = s.strata, lit = x => x[0] ? pc(x[1] / x[0]) : '—';
    console.log(`  ${a.tag.padEnd(4)} ${(stateName.get(sid) || sid).toString().padEnd(26)} ${String(a.lv).padStart(5)} lv ${pc(a.st / a.lv).padStart(5)}  lit L/M/U ${lit(L.lower).padStart(4)} ${lit(L.middle).padStart(4)} ${lit(L.upper).padStart(4)}  unemp ${k(s.unemp).padStart(6)} peas ${k(s.wf.peasants || 0).padStart(6)}  q-mach ${k(s.qm).padStart(6)} q-shop ${k(s.qs).padStart(6)}`);
  }
}
