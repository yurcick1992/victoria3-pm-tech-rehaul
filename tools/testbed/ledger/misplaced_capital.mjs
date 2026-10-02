// MISPLACED CAPITAL — expected payback of the year's new capital against the best VALID alternative (FINDINGS F206/F207, BALANCE_FRAMEWORK
// §10.92, GLOSSARY "misplaced capital"). Promoted 2026-10-02 from the session scratchpad (payback_valid2.mjs) with its logic unchanged —
// the imports and paths are the only edits, proven by identical output on 20261002_120946.
//   expected payback of a level = its build cost (points × the country's own £ per construction point) ÷ the annual profit per staffed
//   level of that building type (the country's own, else its market's, else the world's, at the step's start); classed against the
//   country's BEST SECTOR's capital-weighted payback: fine ≤ 1.5× · a bit ≤ 3× · GROSS > 3× or loss-making · none = no valid benchmark
//   (ungraded — vanilla's late full employment). Sectors: tiered manufacturing (minus infrastructure / shipyards, NEVER_IND), mines
//   (logging, fishing, whaling, oil, rubber; no gold), agriculture. Benchmarks ALL / OPEN (sectors with a valid type) / VALID (valid types
//   with ≥ 2 staffed levels, sector ≥ 5% of capital). A VALID option (user, 2026-10-02): free deposits / free arable land for the type in
//   the state AND ≥ 25k peasants + unemployed there; manufacturing needs the labour alone. Validity needs save summary v15 (per-state lab/res).
//   ⚠ OUT OF THE REGISTER BY RULING — "an important metric to consider", never a loss term (§10.92.1).
// UNDER-INVESTMENT AS PAYBACK, AGAINST VALID OPTIONS ONLY (user, 2026-10-02): "Only consider investment option 'valid' if there are empty deposits
// at the time of investment AND there is at least some labour in the state (peasants+unemployment at least 25k)."
// Per state (save summary v15: `lab` {peas, unemp} workforce, `res` {type: [levels, staffing, profit]}) against the static caps of its state region
// (common/map_data/state_regions: capped_resources, arable_land + arable_resources, discovered resources):
//   a mine / logging / fishing / whaling / oil / rubber type is valid in a state with free capped (or discovered) slots and ≥ 25k labour;
//   a farm / plantation / ranch type is valid in a state whose region allows the crop, with free arable land and ≥ 25k labour;
//   a manufacturing type is valid in any state with ≥ 25k labour.
// The benchmark of a country-year is then its best sector over VALID types only (capital-weighted payback of the valid types it runs), and the
// year's new capital is classed against it — beside the old benchmark (all types), so the effect of the rule is visible.
//   --series <dir of v15 summaries of ONE campaign, ~yearly>              exact: every year's validity from that year's own summary
//   --arm label:session[:setup] --snap <dir of v15 kept-save summaries>   the decade before each run's kept save; validity from that save
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { requiredConstruction, GAME } from '../../vanilla_construction.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const S = path.join(ROOT, 'tools/testbed/sessions');
// date → summary file of one run (the provenance sits in the first bytes of each gz; no cache — a few ms a run)
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
const readSum = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const runsOf = (sessDir, setup) => fs.readdirSync(sessDir).filter(d => /^run\d+/.test(d) && (!setup || d.endsWith('_' + setup))).sort().map(d => path.join(sessDir, d));
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const all = n => args.flatMap((a, i) => a === n ? [args[i + 1]] : []);
const FINE = 1.5, GROSS = 3, LAB = +argOf('--lab', 25000);
const RC = requiredConstruction();
const REFCFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/mod_config.json'), 'utf8'));
const med = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const toDay = d => { const [y, m, dd] = d.split('.').map(Number); return y * 365 + (m - 1) * 30.4 + dd; };
const readGz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
// ---- static state-region caps
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
// ---- books
// OUT OF SCOPE BY RULING (user, 2026-10-02, §10.92): infrastructure (railways, ports, power plants, dams), shipyards, trade centres, every
// government-funded building and gold mines/fields are never measured, even where they earn through goods — their AI values are exempt from
// the misplaced-capital aim. Untiered, they never enter (the scope is tiered manufacturing + the mine and farm patterns below); a book that
// TIERS one of these industries must not leak it in either, hence NEVER_IND. --exclude-ind a,b drops more industries for a what-if reading.
const NEVER_IND = new Set(['port', 'railway', 'power', 'shipyard', 'shipyard_steam']);
const EXCL_IND = new Set((argOf('--exclude-ind', '') || '').split(',').filter(Boolean));
const bookCache = new Map();
function bookOf(runDir) {
  let p = null;
  if (runDir) for (const f of [path.join(runDir, 'build_state.json'), path.join(path.dirname(runDir), 'build_state.json')]) if (fs.existsSync(f)) { try { const b = JSON.parse(fs.readFileSync(f, 'utf8')); p = b.deterministic?.mod_under_test?.built_from_config || b.deterministic?.built_from_config; if (p) break; } catch {} }
  const key = p || '(vanilla)'; if (bookCache.has(key)) return bookCache.get(key);
  const cfg = p ? JSON.parse(fs.readFileSync(p, 'utf8')) : REFCFG; const mfg = new Set(), cost = new Map(), ind = new Map();
  for (const I of cfg.industries) { if (I.disabled) continue; for (const t of I.tiers) { if (NEVER_IND.has(I.id) || EXCL_IND.has(I.id)) continue; mfg.add(t.key); ind.set(t.key, I.id); if (p && t.building_cost != null) cost.set(t.key, t.building_cost); } }
  const r = { mfg, cost, ind }; bookCache.set(key, r); return r;
}
const isAgri = k => /_farm$|_plantation$|_ranch$|orchards?$|vineyard$/.test(k) && !/subsistence|rubber/.test(k);
const isMine = k => /_mine$|logging_camp|fishing_wharf|whaling_station|oil_rig|rubber_plantation/.test(k) && !/gold/.test(k);
function sectorOf(k, B) { if (B.mfg.has(k)) return 'manufacturing'; if (/subsistence|gold_/.test(k)) return null; if (isMine(k)) return 'mines'; if (isAgri(k)) return 'agriculture'; return null; }
const costOf = (k, B) => B.cost.get(k) ?? RC[k];
// ---- validity from a v15 summary: country tag -> { mines: Set(types), agri: Set(types), mfgOK: bool }
function validity(v15) {
  const V = {};
  for (const s of Object.values(v15.states || {})) {
    if (!s.country || s.country.includes('@')) continue; const tag = s.country; const v = V[tag] ??= { res: new Set(), mfgOK: false };
    const lab = (s.lab?.peas || 0) + (s.lab?.unemp || 0); if (lab < LAB) continue;
    v.mfgOK = true; const R = REG[s.region]; if (!R) continue; const lv = k => s.res?.[k]?.[0] || 0;
    for (const [k, c] of Object.entries(R.cap)) if (c - lv(k) > 0) v.res.add(k);
    let used = 0; for (const [k, a] of Object.entries(s.res || {})) if (isAgri(k)) used += a[0];
    if (R.arable - used > 0) for (const k of R.crops) v.res.add(k);
  }
  return V;
}
// ---- one year step: classify the new capital of every country between summaries jt and j1
function step(jt, j1, B, VAL, acc) {
  const mkAgg = {}, wAgg = {};
  for (const c of Object.values(jt.countries || {})) for (const [k, x] of Object.entries(c.buildings || {})) { if (!sectorOf(k, B) || !(x.staffing > 0)) continue;
    const m = mkAgg[c.market] ??= {}; const a = m[k] ??= { p: 0, s: 0 }; a.p += x.profit || 0; a.s += x.staffing; const w = wAgg[k] ??= { p: 0, s: 0 }; w.p += x.profit || 0; w.s += x.staffing; }
  const pv = []; const ppt = {};
  for (const [tag, c] of Object.entries(jt.countries || {})) { const sp = (c.queues?.private?.speed || 0) + (c.queues?.government?.speed || 0); const vi = c.buildings?.building_construction_sector?.va_in || 0; if (sp > 5 && vi > 0) { ppt[tag] = vi / sp; pv.push(vi / sp); } }
  const pptMed = med(pv) || 600;
  for (const [tag, c1] of Object.entries(j1.countries || {})) {
    if (tag.includes('@')) continue; const c0 = jt.countries?.[tag]; if (!c0) continue; const P = ppt[tag] ?? pptMed; const val = VAL ? VAL[tag] : null;
    const isValid = k => { if (!val) return null; const s = sectorOf(k, B); return s === 'manufacturing' ? val.mfgOK : val.res.has(k); };
    const secAll = {}, secVal = {}, openSec = new Set(); let capAll = 0;
    for (const [k, x] of Object.entries(c0.buildings || {})) { const s = sectorOf(k, B); if (!s) continue; const ck = costOf(k, B); if (ck == null) continue; capAll += ck * (x.levels || 0);
      const a = secAll[s] ??= { cap: 0, scap: 0, prof: 0 }; a.cap += ck * (x.levels || 0); if (x.staffing > 0) { a.scap += ck * x.staffing; a.prof += x.profit || 0; }
      if (isValid(k) && x.staffing >= 2) { const b = secVal[s] ??= { scap: 0, prof: 0, ty: {} }; b.scap += ck * x.staffing; b.prof += x.profit || 0; b.ty[k] = (b.ty[k] || 0) + ck * x.staffing; } if (isValid(k)) openSec.add(s); }
    let bAll = Infinity, bAllSec = null; for (const [s, a] of Object.entries(secAll)) { if (a.cap < 0.05 * capAll || !(a.prof > 0) || !(a.scap > 0)) continue; const pb = a.scap * P / (52 * a.prof); if (pb < bAll) { bAll = pb; bAllSec = s; } }
    let bVal = Infinity, bValSec = null; if (val) for (const [s, a] of Object.entries(secVal)) { if (!(a.prof > 0) || !(a.scap > 0) || a.scap < 0.05 * capAll) continue; const pb = a.scap * P / (52 * a.prof); if (pb < bVal) { bVal = pb; bValSec = s; } }
    let bOpen = Infinity, bOpenSec = null; if (val) for (const [s, a] of Object.entries(secAll)) { if (!openSec.has(s) || a.cap < 0.05 * capAll || !(a.prof > 0) || !(a.scap > 0)) continue; const pb = a.scap * P / (52 * a.prof); if (pb < bOpen) { bOpen = pb; bOpenSec = s; } }
    for (const [k, x1] of Object.entries(c1.buildings || {})) {
      const s = sectorOf(k, B); if (!s) continue; const dl = (x1.levels || 0) - (c0.buildings?.[k]?.levels || 0); if (dl <= 0) continue; const ck = costOf(k, B); if (ck == null) continue;
      const x0 = c0.buildings?.[k]; let ppl = null;
      if (x0 && x0.staffing > 0.5) ppl = (x0.profit || 0) / x0.staffing; else { const m = mkAgg[c0.market]?.[k], w = wAgg[k]; if (m && m.s > 0.5) ppl = m.p / m.s; else if (w && w.s > 0.5) ppl = w.p / w.s; else if (x1.staffing > 0.5) ppl = (x1.profit || 0) / x1.staffing; }
      if (ppl == null) continue; const inv = dl * ck; const pay = ppl > 0 ? ck * P / (52 * ppl) : Infinity;
      const cls = b => !(ppl > 0) ? 'gross' : !Number.isFinite(b) ? 'none' : pay / b <= FINE ? 'fine' : pay / b <= GROSS ? 'bit' : 'gross';
      const A = acc.all, Vv = acc.val; A[cls(bAll)] += inv; A.sec[s][cls(bAll)] += inv;
      if (val) { const cv = cls(bVal); Vv[cv] += inv; Vv.sec[s][cv] += inv; const co = cls(bOpen); acc.open[co] += inv; acc.open.sec[s][co] += inv; if (bAllSec && bOpenSec !== bAllSec) acc.openMoved += inv; acc.withVal += inv; if (bAllSec && bValSec !== bAllSec) acc.benchMoved += inv; if (bAllSec && val && bAllSec !== 'manufacturing' && bValSec === 'manufacturing') acc.benchToMfg += inv; }
      else acc.noVal += inv;
      if (val && s === 'manufacturing' && cls(bVal) === 'gross' && ppl > 0 && bValSec) { const gb = acc.gb ??= { sec: {}, ty: {} }; gb.sec[bValSec] = (gb.sec[bValSec] || 0) + inv; const sv = secVal[bValSec]; for (const [k2, c2] of Object.entries(sv.ty)) gb.ty[k2] = (gb.ty[k2] || 0) + inv * c2 / sv.scap; } if (val && s === 'manufacturing' && cls(bVal) === 'gross') { const gk = acc.gk ??= {}; const tag2 = ppl > 0 ? 'slow' : 'loss'; gk[tag2] = (gk[tag2] || 0) + inv; }
      const ct = acc.cty[tag] ??= { all: { fine: 0, bit: 0, gross: 0, none: 0 }, val: { fine: 0, bit: 0, gross: 0, none: 0 } }; ct.all[cls(bAll)] += inv; if (val) ct.val[cls(bVal)] += inv;
    }
  }
}
const newAcc = () => ({ all: { fine: 0, bit: 0, gross: 0, none: 0, sec: { mines: { fine: 0, bit: 0, gross: 0, none: 0 }, agriculture: { fine: 0, bit: 0, gross: 0, none: 0 }, manufacturing: { fine: 0, bit: 0, gross: 0, none: 0 } } },
  val: { fine: 0, bit: 0, gross: 0, none: 0, sec: { mines: { fine: 0, bit: 0, gross: 0, none: 0 }, agriculture: { fine: 0, bit: 0, gross: 0, none: 0 }, manufacturing: { fine: 0, bit: 0, gross: 0, none: 0 } } }, withVal: 0, noVal: 0, benchMoved: 0, benchToMfg: 0, openMoved: 0, cty: {}, open: { fine: 0, bit: 0, gross: 0, none: 0, sec: { mines: { fine: 0, bit: 0, gross: 0, none: 0 }, agriculture: { fine: 0, bit: 0, gross: 0, none: 0 }, manufacturing: { fine: 0, bit: 0, gross: 0, none: 0 } } } });
const sh = (o, k) => { const t = o.fine + o.bit + o.gross + (o.none || 0); return t > 0 ? (o[k] || 0) / t : NaN; };
const p0 = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '-';
const line = (lab, A) => `  ${lab.padEnd(18)} ALL: ${p0(sh(A.all, 'gross'))}/${p0(sh(A.all, 'bit'))}/${p0(sh(A.all, 'none'))}  OPEN: ${p0(sh(A.open, 'gross'))}/${p0(sh(A.open, 'bit'))}/${p0(sh(A.open, 'none'))}  VALID: ${p0(sh(A.val, 'gross'))}/${p0(sh(A.val, 'bit'))}/${p0(sh(A.val, 'none'))}` +
  `   mfg gross ${p0(sh(A.all.sec.manufacturing, 'gross'))} / ${p0(sh(A.open.sec.manufacturing, 'gross'))} / ${p0(sh(A.val.sec.manufacturing, 'gross'))}; mines ${p0(sh(A.all.sec.mines, 'gross'))} / ${p0(sh(A.open.sec.mines, 'gross'))}; agri ${p0(sh(A.all.sec.agriculture, 'gross'))} / ${p0(sh(A.open.sec.agriculture, 'gross'))}   open moved the benchmark for ${p0(A.openMoved / A.withVal)} of the capital`;
// ---- what the better (valid) alternative is, behind the GROSS manufacturing capital
if (args.includes('--why')) {
  globalThis.__why = (lab, gb, gk) => {
    const T = Object.values(gb.sec).reduce((a, b) => a + b, 0); const K = (gk.slow || 0) + (gk.loss || 0);
    console.log(`  ${lab}: gross manufacturing capital = loss-making ${p0((gk.loss || 0) / K)} / profitable but slow ${p0((gk.slow || 0) / K)}; the benchmark behind the slow part: ` +
      Object.entries(gb.sec).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + p0(v / T)).join(', '));
    console.log("     the benchmark sector's valid types (capital-weighted): " + Object.entries(gb.ty).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k.replace('building_', '') + ' ' + p0(v / T)).join(', '));
  };
}
// ---- series mode
const SER = argOf('--series', null);
if (SER) {
  const files = fs.readdirSync(SER).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort().map(f => readGz(path.join(SER, f))).sort((a, b) => toDay(a.provenance.date) - toDay(b.provenance.date));
  const B = bookOf(null); const byDec = {};
  for (let i = 0; i + 1 < files.length; i++) { const jt = files[i], j1 = files[i + 1]; const y = +jt.provenance.date.split('.')[0]; const dec = Math.floor((y - 1836) / 10) * 10 + 1836;
    const acc = byDec[dec] ??= newAcc(); step(jt, j1, B, validity(jt), acc); }
  console.log(`SERIES ${SER} — ${files.length} summaries ${files[0].provenance.date} → ${files.at(-1).provenance.date}; validity from each year's own summary (labour ≥ ${LAB})`);
  for (const [d, A] of Object.entries(byDec)) console.log(line(`${d}-${String(+d + 10).slice(2)}`, A));
  if (globalThis.__why) { const gb = { sec: {}, ty: {} }, gk = {}; for (const A of Object.values(byDec)) { for (const [k, v] of Object.entries(A.gb?.sec || {})) gb.sec[k] = (gb.sec[k] || 0) + v; for (const [k, v] of Object.entries(A.gb?.ty || {})) gb.ty[k] = (gb.ty[k] || 0) + v; for (const [k, v] of Object.entries(A.gk || {})) gk[k] = (gk[k] || 0) + v; } globalThis.__why('series (pooled)', gb, gk); }
}
// ---- snapshot mode
const SNAP = argOf('--snap', null);
if (SNAP) for (const a of all('--arm')) {
  const [l, s, st] = a.split(':'); const accs = [];
  for (const r of runsOf(path.join(S, s), st || null)) {
    const f = path.join(SNAP, `${s}__${path.basename(r)}.json.gz`); if (!fs.existsSync(f)) continue; const snap = readGz(f); const sy = +snap.provenance.date.split('.')[0];
    const VAL = validity(snap); const B = bookOf(r); const idx = indexRun(r); const acc = newAcc();
    const first = y => Object.keys(idx).filter(d => d.startsWith(y + '.')).sort((p, q) => toDay(p) - toDay(q))[0];
    let prev = null; for (let y = sy - 10; y <= sy; y++) { const d = first(y); if (!d) continue; const j = readSum(idx[d]); if (prev) step(prev, j, B, VAL, acc); prev = j; }
    accs.push([path.basename(r), acc, snap.provenance.date]);
  }
  console.log(`\nSNAPSHOT ${l}: the decade before each run's kept save, validity from that save (labour ≥ ${LAB})`);
  for (const [rn, A, d] of accs) console.log(line(`${rn.slice(0, 6)} →${d}`, A));
  if (globalThis.__why) { const gb = { sec: {}, ty: {} }, gk = {}; for (const [, A] of accs) { for (const [k, v] of Object.entries(A.gb?.sec || {})) gb.sec[k] = (gb.sec[k] || 0) + v; for (const [k, v] of Object.entries(A.gb?.ty || {})) gb.ty[k] = (gb.ty[k] || 0) + v; for (const [k, v] of Object.entries(A.gk || {})) gk[k] = (gk[k] || 0) + v; } globalThis.__why(l + ' (pooled)', gb, gk); }
  const M = k => med(accs.map(([, A]) => k(A)));
  console.log(`  ${'MEDIAN'.padEnd(18)} ALL: ${p0(M(A => sh(A.all, 'gross')))}/${p0(M(A => sh(A.all, 'bit')))}/${p0(M(A => sh(A.all, 'none')))}  OPEN: ${p0(M(A => sh(A.open, 'gross')))}/${p0(M(A => sh(A.open, 'bit')))}/${p0(M(A => sh(A.open, 'none')))}  VALID: ${p0(M(A => sh(A.val, 'gross')))}/${p0(M(A => sh(A.val, 'bit')))}/${p0(M(A => sh(A.val, 'none')))}   mfg gross ${p0(M(A => sh(A.all.sec.manufacturing, 'gross')))} / ${p0(M(A => sh(A.open.sec.manufacturing, 'gross')))} / ${p0(M(A => sh(A.val.sec.manufacturing, 'gross')))}`);
}
// ---- batch mode: a session whose OWN summaries are v15 — exact validity from each year's summary, yearly steps (the first summary of each
// year, as everywhere else), per run and decade; plus the like-for-like line (the decade before the run's last summary, validity from it),
// i.e. what --snap gives the older books. A pre-v15 summary in the series is stepped with no validity (counted under ALL only).
const isV15 = j => Object.values(j.states || {}).some(s => s && s.lab);
const merge = (T, A) => { for (const b of ['all', 'val', 'open']) { for (const c of ['fine', 'bit', 'gross', 'none']) T[b][c] += A[b][c]; for (const s of ['mines', 'agriculture', 'manufacturing']) for (const c of ['fine', 'bit', 'gross', 'none']) T[b].sec[s][c] += A[b].sec[s][c]; }
  for (const k of ['withVal', 'noVal', 'benchMoved', 'benchToMfg', 'openMoved']) T[k] += A[k];
  if (A.gb) { const g = T.gb ??= { sec: {}, ty: {} }; for (const [k, v] of Object.entries(A.gb.sec)) g.sec[k] = (g.sec[k] || 0) + v; for (const [k, v] of Object.entries(A.gb.ty)) g.ty[k] = (g.ty[k] || 0) + v; }
  if (A.gk) { const g = T.gk ??= {}; for (const [k, v] of Object.entries(A.gk)) g[k] = (g[k] || 0) + v; } return T; };
const secLine = A => ['mines', 'agriculture', 'manufacturing'].map(s => { const o = A.all.sec[s]; const t = o.fine + o.bit + o.gross + o.none; const T = ['fine', 'bit', 'gross', 'none'].reduce((x, c) => x + A.all[c], 0); return `${s} ${p0(t / T)} of capital, ${p0(sh(o, 'gross'))} gross`; }).join(' · ');
for (const a of all('--batch')) {
  const [l, s, st] = a.split(':'); const runs = [];
  for (const r of runsOf(path.join(S, s), st || null)) {
    const idx = indexRun(r); const dates = Object.keys(idx).sort((p, q) => toDay(p) - toDay(q)); if (dates.length < 2) continue;
    const B = bookOf(r); const lastD = dates.at(-1); const last = readSum(idx[lastD]); const ly = +lastD.split('.')[0]; const VALlast = isV15(last) ? validity(last) : null;
    const first = y => dates.find(d => d.startsWith(y + '.'));
    const years = [...new Set(dates.map(d => +d.split('.')[0]))];
    const byDec = {}, accLast = newAcc(), cent = newAcc(); let prev = null, prevY = null, nV15 = 0;
    for (const y of years) { const j = readSum(idx[first(y)]); if (prev) { const v = isV15(prev); if (v) nV15++; const dec = Math.floor((prevY - 1836) / 10) * 10 + 1836;
        const A = byDec[dec] ??= newAcc(); step(prev, j, B, v ? validity(prev) : null, A); if (prevY >= ly - 10) step(prev, j, B, VALlast, accLast); } prev = j; prevY = y; }
    for (const A of Object.values(byDec)) merge(cent, A);
    runs.push({ rn: path.basename(r), byDec, accLast, cent, lastD, nV15, nSteps: years.length - 1 });
  }
  console.log(`\nBATCH ${l} (${s}${st ? ':' + st : ''}): yearly steps, validity from each year's own v15 summary (labour ≥ ${LAB}); gross / a bit / no valid alternative`);
  for (const R of runs) {
    console.log(` ${R.rn} → ${R.lastD}  (${R.nV15} of ${R.nSteps} steps with per-year validity)`);
    for (const [d, A] of Object.entries(R.byDec)) console.log(line(`${d}-${String(+d + 10).slice(2)}`, A));
    console.log(line('century', R.cent)); console.log(`   ${secLine(R.cent)}`);
    console.log(line(`like-for-like ${+R.lastD.split('.')[0] - 10}-${R.lastD.split('.')[0].slice(2)}`, R.accLast));
  }
  const decs = [...new Set(runs.flatMap(R => Object.keys(R.byDec)))].sort();
  if (runs.length > 1) { console.log(` MEDIAN over ${runs.length} runs:`); for (const d of decs) { const As = runs.map(R => R.byDec[d]).filter(Boolean);
      const M = k => med(As.map(k)); console.log(`  ${(d + '-' + String(+d + 10).slice(2)).padEnd(18)} ALL: ${p0(M(A => sh(A.all, 'gross')))}/${p0(M(A => sh(A.all, 'bit')))}  VALID: ${p0(M(A => sh(A.val, 'gross')))}/${p0(M(A => sh(A.val, 'bit')))}/${p0(M(A => sh(A.val, 'none')))}   mfg gross ${p0(M(A => sh(A.all.sec.manufacturing, 'gross')))} / ${p0(M(A => sh(A.val.sec.manufacturing, 'gross')))}  (n=${As.length})`); } }
  if (globalThis.__why) { const T = newAcc(); for (const R of runs) merge(T, R.cent); if (T.gb) globalThis.__why(l + ' (century, pooled)', T.gb, T.gk || {}); const L = newAcc(); for (const R of runs) merge(L, R.accLast); if (L.gb) globalThis.__why(l + ' (like-for-like decade, pooled)', L.gb, L.gk || {}); }
}
