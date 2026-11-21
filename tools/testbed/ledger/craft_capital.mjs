// CRAFT CAPITAL — how much new capital the AI puts into the t0 crafts, and what a pound of it earns against the same country's other new
// capital (FINDINGS F282; BACKLOG A, the crafts' AI desire). Promoted 2026-11-21 from the session scratchpad with its logic unchanged.
//
//   node tools/testbed/ledger/craft_capital.mjs --arm <label>=<group>[:<setup>] [--arm …] [--json <out.json>]
//   <group> = a session, a comma list of sessions, or <session>/runNNN_<setup> folders (lib_runs: usable runs only). Point VIC3_GAME at a
//   copy of the game version the runs played (C:/claude-code/vic3_game_<version>/game): the VALID benchmark reads its state regions and the
//   untiered types' construction costs from it.
//
// The step logic is misplaced_capital.mjs's (F206/F207, GLOSSARY "misplaced capital"), with the crafts split out of manufacturing and the
// tiered rungs split by tier. ⚠ The state-region caps, validity() and the benchmark are COPIES of misplaced_capital.mjs's (it runs on import,
// so it cannot be imported): change both or neither.
//   Yearly steps (the first summary of each year), per country; a country whose total levels jump more than 25% in a step is skipped
//   (annexation, a civil-war record coming back).
//   NEW CAPITAL of a type = Δlevels⁺ × its construction points (a rung's `building_cost`, else vanilla's `required_construction`) × the
//     country's £ per point at the step's start (construction sector va_in ÷ government + private queue speed; the world median where the
//     country has no sector). Levels that change hands count as built by the receiver; levels built and lost inside one year are not seen
//     (downsize_telemetry.mjs counts the losses independently).
//   EXPECTED RETURN = Δlevels⁺ × 52 × the type's profit per staffed level at the step's start (the country's own, else its market's, else the
//     world's) ÷ the new capital — the AI's view when it builds. A new level that never staffs earns nothing, so the STOCK table is the check.
//   MISPLACED = the share of a class's graded capital that loses money or pays back more than 3× slower than the country's best sector over
//     VALID types that year (misplaced_capital's rule: ≥ 25k peasants + unemployed in the state; free deposits / arable land for mines and
//     farms; valid types with ≥ 2 staffed levels; the sector ≥ 5% of the country's capital). Ungraded where no valid benchmark exists.
//   CLASSES: craft (a tier with `craft`) · t0 … t3 (every other rung of a non-disabled industry outside infrastructure and shipyards, by its
//     tier; merged rungs are methods of their host and count as the host) · mines (logging, fishing, whaling, oil, rubber; no gold) ·
//     agriculture. Government buildings, infrastructure, shipyards and trade are left out, as in misplaced_capital.
//   THE STOCK at each decade's first summary (1846, 1856, …): levels, staffed levels, craft workers (staffed levels × 500, a craft level's
//     staffing), capital at that date's £ per point, annual profit, annual value added at market (goods sales − goods cost).
//   THE FLOW (column "÷ flow pts") = Σ (government + private queue speed) × weeks, read at the yearly steps only: a coarser flow than
//     construction_spend.mjs's, which reads every summary.
// ⚠ Points from the country_gdp_construction base modifier cost no goods (F187), so a poor country's £ per point and its £ shares run low;
//   the points shares are the cleaner reading of HOW MUCH, the £ returns the reading of WHAT IT EARNS.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { requiredConstruction, GAME } from '../../vanilla_construction.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const S = path.join(ROOT, 'tools/testbed/sessions');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const all = n => args.flatMap((a, i) => a === n ? [args[i + 1]] : []);
if (!all('--arm').length) { console.error('usage: node tools/testbed/ledger/craft_capital.mjs --arm <label>=<group>[:<setup>] [--arm …] [--json <out.json>]'); process.exit(2); }
const RC = requiredConstruction(); const LAB = 25000; const CRAFT_JOBS = 500;
const med = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const toDay = d => { const [y, m, dd] = d.split('.').map(Number); return y * 365 + (m - 1) * 30.4 + dd; };
const readGz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
// date → summary file of one run (the provenance sits in the first bytes of each gz), as misplaced_capital.mjs
function indexRun(runDir) {
  const sd = path.join(runDir, 'save_summaries'); if (!fs.existsSync(sd)) return {};
  const idx = {};
  for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    const fd = fs.openSync(path.join(sd, f), 'r'); const buf = Buffer.alloc(4096); const n = fs.readSync(fd, buf, 0, 4096, 0); fs.closeSync(fd);
    let txt = ''; try { txt = zlib.gunzipSync(buf.subarray(0, n), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8'); } catch { continue; }
    const m = /"date":"([0-9.]+)"/.exec(txt); if (m && !idx[m[1]]) idx[m[1]] = path.join(sd, f);
  }
  return idx;
}
// ---- static state-region caps (COPY of misplaced_capital.mjs)
const REG = {};
for (const f of fs.readdirSync(path.join(GAME, 'map_data/state_regions'))) {
  const txt = fs.readFileSync(path.join(GAME, 'map_data/state_regions', f), 'utf8').replace(/^\uFEFF/, '');
  const re = /^(STATE_[A-Z0-9_]+)\s*=\s*\{/gm; let m;
  while ((m = re.exec(txt))) { let i = re.lastIndex, d = 1; while (d > 0 && i < txt.length) { const c = txt[i++]; if (c === '{') d++; else if (c === '}') d--; } const body = txt.slice(re.lastIndex, i - 1);
    const r = { arable: 0, crops: new Set(), cap: {} };
    const al = /arable_land\s*=\s*(\d+)/.exec(body); if (al) r.arable = +al[1];
    const ar = /arable_resources\s*=\s*\{([^}]*)\}/.exec(body); if (ar) for (const q of ar[1].matchAll(/"([a-z_0-9]+)"/g)) r.crops.add(q[1]);
    const cr = /capped_resources\s*=\s*\{([^}]*)\}/.exec(body); if (cr) for (const q of cr[1].matchAll(/([a-z_0-9]+)\s*=\s*(\d+)/g)) r.cap[q[1]] = +q[2];
    for (const q of body.matchAll(/resource\s*=\s*\{([^}]*)\}/g)) { const ty = /type\s*=\s*"([a-z_0-9]+)"/.exec(q[1]); const da = /discovered_amount\s*=\s*(\d+)/.exec(q[1]); if (ty) r.cap[ty[1]] = (r.cap[ty[1]] || 0) + (da ? +da[1] : 0); }
    REG[m[1]] = r; }
}
// ---- the run's own book
const NEVER_IND = new Set(['port', 'railway', 'power', 'shipyard', 'shipyard_steam']);
function bookOf(runDir) {
  const b = JSON.parse(fs.readFileSync(path.join(runDir, 'build_state.json'), 'utf8'));
  const p = b.deterministic?.mod_under_test?.built_from_config;
  if (!p || !fs.existsSync(p)) throw new Error(`craft_capital: ${runDir} names no readable config (${p}) — a control has no crafts`);
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8')); const mfg = new Set(), craft = new Set(), cost = new Map(), tier = new Map();
  for (const I of cfg.industries) { if (I.disabled || NEVER_IND.has(I.id)) continue; for (const t of I.tiers) { if (t.method_of) continue; mfg.add(t.key); tier.set(t.key, t.era ?? 0); if (t.craft) craft.add(t.key); if (t.building_cost != null) cost.set(t.key, t.building_cost); } }
  return { mfg, craft, cost, tier, sha: b.deterministic?.mod_under_test?.config_sha256?.slice(0, 8) };
}
const isAgri = k => /_farm$|_plantation$|_ranch$|orchards?$|vineyard$/.test(k) && !/subsistence|rubber/.test(k);
const isMine = k => /_mine$|logging_camp|fishing_wharf|whaling_station|oil_rig|rubber_plantation/.test(k) && !/gold/.test(k);
const sectorOf = (k, B) => B.mfg.has(k) ? 'manufacturing' : /subsistence|gold_/.test(k) ? null : isMine(k) ? 'mines' : isAgri(k) ? 'agriculture' : null;
const classOf = (k, B) => B.craft.has(k) ? 'craft' : B.mfg.has(k) ? ('t' + B.tier.get(k)) : sectorOf(k, B);
const costOf = (k, B) => B.cost.get(k) ?? RC[k];
// ---- validity from a v15 summary (COPY of misplaced_capital.mjs)
function validity(v15) {
  const V = {};
  for (const s of Object.values(v15.states || {})) {
    if (!s.country || s.country.includes('@')) continue; const v = V[s.country] ??= { res: new Set(), mfgOK: false };
    const lab = (s.lab?.peas || 0) + (s.lab?.unemp || 0); if (lab < LAB) continue;
    v.mfgOK = true; const R = REG[s.region]; if (!R) continue; const lv = k => s.res?.[k]?.[0] || 0;
    for (const [k, c] of Object.entries(R.cap)) if (c - lv(k) > 0) v.res.add(k);
    let used = 0; for (const [k, a] of Object.entries(s.res || {})) if (isAgri(k)) used += a[0];
    if (R.arable - used > 0) for (const k of R.crops) v.res.add(k);
  }
  return V;
}
const pricePerPoint = j => { const pv = [], ppt = {};
  for (const [tag, c] of Object.entries(j.countries || {})) { const sp = (c.queues?.private?.speed || 0) + (c.queues?.government?.speed || 0); const vi = c.buildings?.building_construction_sector?.va_in || 0; if (sp > 5 && vi > 0) { ppt[tag] = vi / sp; pv.push(vi / sp); } }
  return { ppt, pm: med(pv) || 600 }; };
const CL = ['craft', 't0', 't1', 't2', 't3', 'mines', 'agriculture'];
const Z = () => ({ lv: 0, pts: 0, gbp: 0, prof: 0, gbpKnown: 0, loss: 0, gross: 0, graded: 0, fine: 0 });
function readRun(runDir) {
  const B = bookOf(runDir); const idx = indexRun(runDir);
  const dates = Object.keys(idx).sort((a, b) => toDay(a) - toDay(b));
  const years = [...new Set(dates.map(d => +d.split('.')[0]))]; const first = y => dates.find(d => d.startsWith(y + '.'));
  const dec = {}, stock = {}, flow = {}; let prev = null, prevY = null, prevD = null;
  for (const y of years) {
    const d = first(y); const j1 = readGz(idx[d]);
    if ((y - 1836) % 10 === 0) { // the stock at a decade's first summary
      const { ppt, pm } = pricePerPoint(j1); const st = stock[y] = Object.fromEntries(CL.map(c => [c, { lv: 0, staffed: 0, gbp: 0, pts: 0, prof: 0, va: 0 }]));
      for (const [tag, c] of Object.entries(j1.countries || {})) { if (tag.includes('@')) continue; const P = ppt[tag] ?? pm;
        for (const [k, x] of Object.entries(c.buildings || {})) { const cl = classOf(k, B); if (!cl) continue; const ck = costOf(k, B); if (ck == null) continue; const a = st[cl];
          a.lv += x.levels || 0; a.staffed += Math.min(x.levels || 0, x.staffing || 0); a.pts += ck * (x.levels || 0); a.gbp += ck * (x.levels || 0) * P; a.prof += 52 * (x.profit || 0);
          a.va += 52 * ((x.goods_sales || 0) - (x.goods_cost || 0)); } }
    }
    if (prev) {
      const jt = prev; const weeks = (toDay(d) - toDay(prevD)) / 7; const D = Math.floor((prevY - 1836) / 10) * 10 + 1836;
      const acc = dec[D] ??= Object.fromEntries(CL.map(c => [c, Z()])); const fl = flow[D] ??= { pts: 0 };
      for (const c of Object.values(jt.countries || {})) fl.pts += ((c.queues?.private?.speed || 0) + (c.queues?.government?.speed || 0)) * weeks;
      const mkAgg = {}, wAgg = {};
      for (const c of Object.values(jt.countries || {})) for (const [k, x] of Object.entries(c.buildings || {})) { if (!classOf(k, B) || !(x.staffing > 0)) continue;
        const m = mkAgg[c.market] ??= {}; const a = m[k] ??= { p: 0, s: 0 }; a.p += x.profit || 0; a.s += x.staffing; const w = wAgg[k] ??= { p: 0, s: 0 }; w.p += x.profit || 0; w.s += x.staffing; }
      const { ppt, pm } = pricePerPoint(jt); const VAL = Object.values(jt.states || {}).some(s => s && s.lab) ? validity(jt) : null;
      for (const [tag, c1] of Object.entries(j1.countries || {})) {
        if (tag.includes('@')) continue; const c0 = jt.countries?.[tag]; if (!c0) continue;
        const tot = c => Object.values(c.buildings || {}).reduce((s, x) => s + (x.levels || 0), 0); const t0 = tot(c0); if (t0 > 0 && tot(c1) / t0 > 1.25) continue;
        const P = ppt[tag] ?? pm; const val = VAL ? VAL[tag] : null;
        const isValid = k => { if (!val) return false; const s = sectorOf(k, B); return s === 'manufacturing' ? val.mfgOK : val.res.has(k); };
        const secVal = {}; let capAll = 0;
        for (const [k, x] of Object.entries(c0.buildings || {})) { const s = sectorOf(k, B); if (!s) continue; const ck = costOf(k, B); if (ck == null) continue; capAll += ck * (x.levels || 0);
          if (isValid(k) && x.staffing >= 2) { const b = secVal[s] ??= { scap: 0, prof: 0 }; b.scap += ck * x.staffing; b.prof += x.profit || 0; } }
        let bVal = Infinity; for (const a of Object.values(secVal)) { if (!(a.prof > 0) || !(a.scap > 0) || a.scap < 0.05 * capAll) continue; const pb = a.scap * P / (52 * a.prof); if (pb < bVal) bVal = pb; }
        for (const [k, x1] of Object.entries(c1.buildings || {})) {
          const cl = classOf(k, B); if (!cl) continue; const dl = (x1.levels || 0) - (c0.buildings?.[k]?.levels || 0); if (dl <= 0) continue; const ck = costOf(k, B); if (ck == null) continue;
          const x0 = c0.buildings?.[k]; let ppl = null;
          if (x0 && x0.staffing > 0.5) ppl = (x0.profit || 0) / x0.staffing; else { const m = mkAgg[c0.market]?.[k], w = wAgg[k]; if (m && m.s > 0.5) ppl = m.p / m.s; else if (w && w.s > 0.5) ppl = w.p / w.s; else if (x1.staffing > 0.5) ppl = (x1.profit || 0) / x1.staffing; }
          const a = acc[cl]; a.lv += dl; a.pts += dl * ck; a.gbp += dl * ck * P;
          if (ppl == null) continue; a.gbpKnown += dl * ck * P; a.prof += dl * 52 * ppl; if (!(ppl > 0)) a.loss += dl * ck * P;
          if (Number.isFinite(bVal)) { a.graded += dl * ck * P; const pay = ppl > 0 ? ck * P / (52 * ppl) : Infinity; if (!(ppl > 0) || pay / bVal > 3) a.gross += dl * ck * P; else if (pay / bVal <= 1.5) a.fine += dl * ck * P; }
        }
      }
    }
    prev = j1; prevY = y; prevD = d;
  }
  return { sha: B.sha, dec, stock, flow, last: dates.at(-1) };
}
// ---- report
const p = (x, d = 1) => Number.isFinite(x) ? (100 * x).toFixed(d) + '%' : '-';
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '-';
const K = x => Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '-';
const OUT = {};
for (const spec of all('--arm')) {
  const e = spec.indexOf('='); const label = e > 0 ? spec.slice(0, e) : spec; const rest = e > 0 ? spec.slice(e + 1) : spec; const c = rest.lastIndexOf(':');
  const group = c > 0 && !rest.slice(c + 1).includes('/') ? rest.slice(0, c) : rest, setup = c > 0 && !rest.slice(c + 1).includes('/') ? rest.slice(c + 1) : '';
  const r = usableRuns(S, group, setup); for (const d of r.dropped) console.error(`  EXCLUDED ${d.run}: ${d.reason}`);
  const runs = r.runs.map(x => ({ run: x, ...readRun(path.join(S, x)) })); OUT[label] = runs;
  if (!runs.length) { console.log(`\n=== ${label}: no usable runs`); continue; }
  const decs = [...new Set(runs.flatMap(R => Object.keys(R.dec)))].sort();
  console.log(`\n=== ${label}: ${runs.length} usable run(s) of ${group}${setup ? ':' + setup : ''}, book ${[...new Set(runs.map(R => R.sha))].join('/')}, to ${[...new Set(runs.map(R => R.last))].join('/')}; game files ${GAME}`);
  console.log('\nA. NEW CAPITAL BY DECADE — mean a run (levels, points, £M), pooled over runs; the crafts\' share of the four classes\' new capital and of the flow\'s points');
  console.log('decade      craft lv  craft pts  craft £M  classes £M  craft ÷ classes  craft ÷ flow pts');
  const T = Object.fromEntries(CL.map(c => [c, Z()]));
  for (const d of decs) { const rs = runs.filter(R => R.dec[d]); const n = rs.length; const s = (c, k) => rs.reduce((a, R) => a + (R.dec[d][c]?.[k] || 0), 0);
    const cls = CL.reduce((a, c) => a + s(c, 'gbp'), 0); const flow = rs.reduce((a, R) => a + (R.flow[d]?.pts || 0), 0);
    console.log(`${d}s ${('n=' + n).padStart(5)} ${K(s('craft', 'lv') / n).padStart(8)} ${K(s('craft', 'pts') / n).padStart(10)} ${f(s('craft', 'gbp') / n / 1e6, 2).padStart(9)} ${f(cls / n / 1e6, 0).padStart(11)}   ${p(s('craft', 'gbp') / cls, 2).padStart(12)}   ${p(s('craft', 'pts') / flow, 2).padStart(14)}`);
    for (const c of CL) for (const k of Object.keys(T[c])) T[c][k] += s(c, k); }
  const perRun = runs.map(R => { const s = (c, k) => Object.values(R.dec).reduce((a, D) => a + (D[c]?.[k] || 0), 0); const fl = Object.values(R.flow).reduce((a, x) => a + x.pts, 0);
    return { lv: s('craft', 'lv'), pts: s('craft', 'pts'), gbp: s('craft', 'gbp'), ofCls: s('craft', 'gbp') / CL.reduce((a, c) => a + s(c, 'gbp'), 0), ofFlow: s('craft', 'pts') / fl }; });
  const rng = k => `${K(med(perRun.map(x => x[k])))} [${K(Math.min(...perRun.map(x => x[k])))}–${K(Math.max(...perRun.map(x => x[k])))}]`;
  const rngP = k => `${p(med(perRun.map(x => x[k])), 2)} [${p(Math.min(...perRun.map(x => x[k])), 2)}–${p(Math.max(...perRun.map(x => x[k])), 2)}]`;
  console.log(`per run, median [min–max]: craft levels ${rng('lv')} · points ${rng('pts')} · £${f(med(perRun.map(x => x.gbp)) / 1e6, 1)}M [${f(Math.min(...perRun.map(x => x.gbp)) / 1e6, 1)}–${f(Math.max(...perRun.map(x => x.gbp)) / 1e6, 1)}M] · of the classes' £ ${rngP('ofCls')} · of the flow's points ${rngP('ofFlow')}`);
  console.log('\nB. WHAT THE NEW CAPITAL EARNS — pooled over runs, capital-weighted');
  const head = 'decade   ' + CL.map(c => c.padStart(17)).join('');
  const tab = (title, fn) => { console.log('\n' + title); console.log(head); for (const d of [...decs, 'all']) { const row = CL.map(c => { let a; if (d === 'all') a = T[c]; else { a = Z(); for (const R of runs) { const x = R.dec[d]?.[c]; if (x) for (const [k, v] of Object.entries(x)) a[k] += v; } } return fn(a).padStart(17); }); console.log(`${d.padEnd(8)} ${row.join('')}`); } };
  tab('expected return a year on new capital (payback in years)', a => a.gbpKnown > 0 && a.prof > 0 ? `${p(a.prof / a.gbpKnown, 0)} (${f(a.gbpKnown / a.prof, 1)} y)` : '-');
  tab('misplaced share of the graded new capital (loss-making share of all)', a => a.graded > 0 ? `${p(a.gross / a.graded, 0)} (${p(a.loss / a.gbpKnown, 0)})` : '-');
  tab('new capital, £M a run', a => f(a.gbp / runs.length / 1e6, a.gbp / runs.length < 1e7 ? 2 : 0));
  console.log('\nC. THE STANDING STOCK at each decade\'s first summary — pooled over runs; return = annual profit ÷ capital at that date\'s £ per point');
  console.log('year        craft lv  staffed  craft workers  craft £M   craft return   t0 / t1 / t2 / t3 / mines / agriculture return    craft VA ÷ capital  others VA ÷ capital');
  for (const y of [...new Set(runs.flatMap(R => Object.keys(R.stock)))].sort()) { const rs = runs.filter(R => R.stock[y]); const n = rs.length; const s = (c, k) => rs.reduce((a, R) => a + (R.stock[y][c]?.[k] || 0), 0);
    const ret = c => s(c, 'gbp') > 0 ? p(s(c, 'prof') / s(c, 'gbp'), 0) : '-'; const oth = CL.slice(1);
    const ova = oth.reduce((a, c) => a + s(c, 'va'), 0) / oth.reduce((a, c) => a + s(c, 'gbp'), 0);
    console.log(`${y} ${('n=' + n).padStart(5)} ${K(s('craft', 'lv') / n).padStart(9)} ${p(s('craft', 'staffed') / s('craft', 'lv'), 0).padStart(8)} ${K(CRAFT_JOBS * s('craft', 'staffed') / n).padStart(14)} ${f(s('craft', 'gbp') / n / 1e6, 2).padStart(9)} ${ret('craft').padStart(12)}   ${oth.map(ret).join(' / ').padEnd(44)} ${f(s('craft', 'va') / s('craft', 'gbp'), 2).padStart(10)} ${f(ova, 2).padStart(20)}`); }
}
{ const jf = argOf('--json', null); if (jf) { fs.writeFileSync(jf, JSON.stringify(OUT)); console.log('json → ' + jf); } }
