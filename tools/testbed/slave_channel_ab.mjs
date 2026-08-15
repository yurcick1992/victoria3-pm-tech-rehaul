// slave_channel_ab.mjs — THE SLAVE-CHANNEL A/B (handover 2026-08-16, calib3's blocker).
//
//   node tools/testbed/slave_channel_ab.mjs <melt> <weights.tsv> <bgoods.tsv> <calibRunDir>
//
// QUESTION. On 1.13.10 the US pop-consumption line reads ~x1.0 WITH slave pops and a uniform x0.85
// WITHOUT, while the separate "purchased for slaves" line is far smaller than slave pops' full
// baskets (calib3). F27's channel model (buildings buy the whole slave basket; slaves are not on the
// pop-consumption path) cannot be right as stated on this patch. This tool decomposes slave pops BY
// EMPLOYER TYPE from the pop table's own `workplace` (subsistence building / real building / none)
// and computes, per market and per good:
//   S_own_<class>    — the class's demand at each pop's OWN wealth through the save's stored
//                      purchase weights (the pop-line hypothesis: slaves consume like pops)
//   S_bask_<class>   — the same pops priced at the F27 BASKET wealth (SLAVE_BASKET_DEFAULT 8,
//                      clamped per market to the lowest non-slave wealth)  (the building-buys
//                      hypothesis: the line covers baskets)
//   P_nonslave       — every non-slave pop at own wealth (peasants x0.05), the baseline the
//                      pop line is judged against
// and reads the MEASURED pop + "purchased for slaves" lines from the calib run's own logs
// (lib_breakdown, token from the session stamp — L9).
//
// The report then scores the NAMED structural hypotheses (no fitted coefficients):
//   pop line  ≈ P_nonslave + S_own_all | + S_own_emp+none | + S_own_sub+none | P_nonslave alone
//   slave line ≈ S_bask_emp + 0.05*S_bask_sub (F27) | S_bask_emp | 0.05*S_bask_all | S_own_sub ...
import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { buyOrderTable, readBreakdown } from 'file:///C:/claude-code/victoria%203%20PM%20and%20tech%20rehaul/tools/testbed/lib_breakdown.mjs';

const argv = process.argv.slice(2);
const [MELT, WTSV, BTSV, RUN] = argv.filter(a => !a.startsWith('--'));
const NO_OBS = argv.includes('--no-obsession-term');   // clear the F44 budget term (it is REFUTED on 1.13.10 — see the 2026-08-16 runs)
const ACTUAL = argv.includes('--actual-budget');       // scale each pop's package by its own persisted weekly_budget spend (slot 7)
const DATEF = (() => { const i = argv.indexOf('--date'); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; })();  // keep only breakdown blocks of this date (a run may carry several sweeps)
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const DEP = 0.5, PKG = 10000, PEASANT_MULT = 0.05, BASKET_DEFAULT = 8;
const strip = s => s.replace(/^\uFEFF/, '');

// market display name <-> probe region (the same probe idiom predict_good_demand uses)
const PROBES = [['American Market', 'STATE_NEW_YORK'], ['British Market', 'STATE_LANCASHIRE'], ['French Market', 'STATE_ILE_DE_FRANCE']];

// ---- game files: base prices, buy packages, pop-need goods sets
const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
const PACK = {};
for (const m of strip(readFileSync(join(GAME, 'common/buy_packages/00_buy_packages.txt'), 'utf8'))
  .matchAll(/^wealth_(\d+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
  const w = +m[1], g = {};
  const gm = /goods\s*=\s*\{([\s\S]*?)\}/.exec(m[2]);
  if (gm) for (const e of gm[1].matchAll(/popneed_([a-z_]+)\s*=\s*([\d.]+)/g)) g[e[1]] = +e[2];
  PACK[w] = g;
}
// pop-need goods sets + the cross-need obsession/taboo budget shift (F44), ported from
// predict_good_demand.mjs --obsession-budget: ±25% of a need's money per obsession/taboo in it,
// renormalised so the pop's total package is conserved. Obsessions are RUNTIME per-culture state
// read from THIS melt; taboos are static per-religion file data.
const OBSMULT = 0.25;
const NEEDG = {};
for (const m of strip(readFileSync(join(GAME, 'common/pop_needs/00_pop_needs.txt'), 'utf8')).matchAll(/^popneed_([a-z_]*)\s*=\s*\{([\s\S]*?)\n\}/gm))
  NEEDG[m[1]] = new Set([...m[2].matchAll(/goods\s*=\s*([a-z_]+)/g)].map(x => x[1]));
const RELTABOO = {};
for (const f of readdirSync(join(GAME, 'common/religions')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/religions', f), 'utf8')).matchAll(/^([a-z_]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const tb = /taboos\s*=\s*\{([\s\S]*?)\}/.exec(m[2]);
    RELTABOO[m[1]] = new Set(tb ? tb[1].split(/\s+/).filter(g => /^[a-z_]+$/.test(g)) : []);
  }
const CULTOBS = new Map();
const shiftCache = new Map();
function needFactors(cultureId, religion, wealth) {
  const key = cultureId + '|' + religion + '|' + wealth;
  let f = shiftCache.get(key);
  if (f !== undefined) return f;
  const pk = PACK[wealth] || {};
  const obs = (CULTOBS.get(String(cultureId)) || []).slice(0, 3);
  const tab = RELTABOO[religion] || new Set();
  let T = 0, A = 0; const s = {};
  for (const nd of Object.keys(pk)) {
    let sh = 0;
    for (const g of obs) if (NEEDG[nd] && NEEDG[nd].has(g)) sh += OBSMULT;
    for (const g of tab) if (NEEDG[nd] && NEEDG[nd].has(g)) sh -= OBSMULT;
    s[nd] = 1 + sh;
    T += pk[nd]; A += pk[nd] * (1 + sh);
  }
  const norm = A > 0 ? T / A : 1;
  f = {}; for (const nd of Object.keys(pk)) f[nd] = s[nd] * norm;
  shiftCache.set(key, f);
  return f;
}

// ---- joins from the two TSVs
const B = readFileSync(BTSV, 'utf8').split('\n').filter(Boolean);
const bh = Object.fromEntries(B[0].split('\t').map((x, i) => [x, i]));
const stateMkt = new Map(), regionMkt = new Map();
for (let i = 1; i < B.length; i++) {
  const c = B[i].split('\t');
  stateMkt.set(+c[bh.state], c[bh.market]);
  if (!regionMkt.has(c[bh.region])) regionMkt.set(c[bh.region], c[bh.market]);
}
const mktName = new Map();  // numeric market id -> display name, via the probes
for (const [name, region] of PROBES) {
  const id = regionMkt.get(region);
  if (id != null) mktName.set(id, name); else console.error(`⚠ probe region ${region} not in bgoods`);
}

// weights: state|culture -> need -> { good -> w, sum }
const WMAP = new Map();
{
  const rl = readFileSync(WTSV, 'utf8').split('\n');
  const wh = Object.fromEntries(rl[0].split('\t').map((x, i) => [x, i]));
  for (let i = 1; i < rl.length; i++) {
    if (!rl[i]) continue;
    const c = rl[i].split('\t');
    const key = c[wh.state] + '|' + c[wh.key];
    let m = WMAP.get(key); if (!m) { m = {}; WMAP.set(key, m); }
    const nd = c[wh.need].replace(/^popneed_/, '');
    let n = m[nd]; if (!n) { n = { g: {}, sum: 0 }; m[nd] = n; }
    const w = +c[wh.weight];
    n.g[c[wh.good]] = (n.g[c[wh.good]] || 0) + w; n.sum += w;
  }
}
// pop-need key normalisation: PACK uses the popneed_ key; weights need names may differ in prefix
// (both sides stripped of 'popneed_' above / below).

// ---- melt pass 1: building id -> building type, and culture id -> runtime obsessions
const bType = new Map();
{
  let sec = false, depth = 0, cur = null;
  let inC = false, cDepth = 0, cid = null, inObs = false;
  const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (inC) {
      const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
      let x;
      if ((x = /^(\d+)=\{$/.exec(t)) && cDepth === 2) { cid = x[1]; CULTOBS.set(cid, []); }
      else if (cid != null && t === 'obsessions={') inObs = true;
      else if (inObs) {
        if (t === '}') inObs = false;
        // ⚠ obsession goods are QUOTED in a melt ("meat") — an unquoted-only test reads zero
        else for (const g of t.split(/\s+/)) { const q = /^"?([a-z_]+)"?$/.exec(g); if (q) CULTOBS.get(cid).push(q[1]); }
      }
      cDepth += o - c;
      if (inObs && c > 0 && !t.includes('{')) inObs = false;
      if (cDepth <= 0) inC = false;
      continue;
    }
    if (!sec) {
      if (t === 'building_manager={') { sec = true; depth = 1; }
      // ⚠ COLUMN-0 ANCHOR, not the trimmed line: every country record carries an indented
      // `cultures={ <ids> }` list, and a trimmed match enters (and, in predict_good_demand's
      // original loop, BREAKS on) the first of those — the real culture database at top level
      // is then never read and the obsession term is a silent no-op. Same lesson as
      // score_save.ps1's date anchor.
      else if (line === 'cultures={') { inC = true; cDepth = 1; }
      continue;
    }
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    let x;
    if ((x = /^(\d+)=\{$/.exec(t)) && depth === 2) cur = +x[1];
    else if (cur != null && (x = /^building="([a-z_0-9]+)"$/.exec(t))) { bType.set(cur, x[1]); cur = null; }
    depth += o - c;
    if (depth <= 0) { sec = false; }
  }
}
if (NO_OBS) { CULTOBS.clear(); for (const k of Object.keys(RELTABOO)) RELTABOO[k] = new Set(); shiftCache.clear(); }
console.error(`buildings ${bType.size} · cultures with obsessions ${[...CULTOBS.values()].filter(v => v.length).length} · actual-budget ${ACTUAL}`);

// ---- melt pass 2: pops. Slaves decomposed by employer class; everyone else -> P_nonslave.
// class: sub (workplace is a building_subsistence_*), emp (any other building), none (no workplace)
const S = new Map();   // market -> { good -> { own: {sub,emp,none}, bask: {sub,emp,none} } }  (base-£/wk)
const P = new Map();   // market -> { good -> nonslave predicted base-£/wk }
const CLS = new Map(); // market -> people + workforce tallies per class
const lowestNonSlaveWealth = new Map();  // market -> min wealth among non-slave pops (for the basket clamp)
let popN = 0, slaveN = 0, slaveNoW = 0;
{
  let sec = false, depth = 0, cur = null, inWB = false;
  const flush = () => {
    if (!cur || cur.state == null || !cur.type) { cur = null; return; }
    const size = (cur.workforce || 0) + (cur.dependents || 0);
    if (!(size > 0)) { cur = null; return; }
    const mkt = stateMkt.get(cur.state);
    if (mkt == null || !mktName.has(mkt)) { cur = null; return; }   // only the three calibrated markets
    popN++;
    const units = ((cur.workforce || 0) + DEP * (cur.dependents || 0)) / PKG;
    const wm = WMAP.get(cur.state + '|' + cur.culture);
    if (!wm) { cur = null; return; }
    const isSlave = cur.type === 'slaves';
    if (!isSlave) {
      const w0 = lowestNonSlaveWealth.get(mkt);
      if (w0 == null || cur.wealth < w0) lowestNonSlaveWealth.set(mkt, cur.wealth);
    }
    const mult = cur.type === 'peasants' ? PEASANT_MULT : 1;
    const headUnits = size / PKG;   // every head at full rate — the building-buys-per-slave reading
    const nf = needFactors(cur.culture, cur.religion, cur.wealth);
    // --actual-budget: the pop's own persisted consumption spend (weekly_budget slot 7, negative)
    // over the package total. Slaves exempt (their budgets are all-zero — buildings pay for them).
    let acFac = 1;
    if (ACTUAL && cur.type !== 'slaves' && cur.wb && cur.wb.length >= 8) {
      const pk = PACK[cur.wealth];
      if (pk) {
        const tot = Object.values(pk).reduce((a, b) => a + b, 0) * (((cur.workforce || 0) + DEP * (cur.dependents || 0)) / PKG);
        const sp = Math.abs(cur.wb[7] || 0);
        if (tot > 0 && sp > 0) acFac = Math.min(2, sp / tot);
      }
    }
    const spend = (wealth, u, into, klass) => {
      const pk = PACK[wealth]; if (!pk) return;
      for (const nd of Object.keys(pk)) {
        const n = wm[nd]; if (!n || !(n.sum > 0)) continue;
        const money = pk[nd] * u * mult * (nf[nd] ?? 1) * acFac;
        for (const g of Object.keys(n.g)) {
          const gbp = money * n.g[g] / n.sum;
          if (!(gbp > 0)) continue;
          let mm = into.get(mkt); if (!mm) { mm = {}; into.set(mkt, mm); }
          let gg = mm[g]; if (!gg) gg = mm[g] = isSlave ? { own: { sub: 0, emp: 0, none: 0 }, head: { sub: 0, emp: 0, none: 0 } } : 0;
          if (isSlave) gg[klass.kind][klass.cls] += gbp; else mm[g] = gg + gbp;
        }
      }
    };
    if (!isSlave) spend(cur.wealth, units, P, null);
    else {
      slaveN++;
      const wt = cur.workplace != null ? bType.get(cur.workplace) : null;
      if (cur.workplace != null && !wt) slaveNoW++;
      const cls = wt == null ? 'none' : (wt.startsWith('building_subsistence_') ? 'sub' : 'emp');
      let cm = CLS.get(mkt); if (!cm) { cm = { sub: 0, emp: 0, none: 0, sub_wf: 0, emp_wf: 0, none_wf: 0, wealthSum: 0, n: 0, wByCls: { sub: 0, emp: 0, none: 0 }, types: new Map() }; CLS.set(mkt, cm); }
      cm[cls] += size; cm[cls + '_wf'] += (cur.workforce || 0); cm.wealthSum += cur.wealth * size; cm.n += size;
      cm.wByCls[cls] += cur.wealth * size;
      if (cls === 'emp') { const tt = cm.types.get(wt) || { people: 0, headGBP: 0 }; tt.people += size; tt.headGBP += (PACK[cur.wealth] ? Object.entries(PACK[cur.wealth]).reduce((a, [nd, v]) => a + (wm[nd] && wm[nd].sum > 0 ? v : 0), 0) : 0) * headUnits; cm.types.set(wt, tt); }
      spend(cur.wealth, units, S, { kind: 'own', cls });
      spend(cur.wealth, headUnits, S, { kind: 'head', cls });
    }
    cur = null;
  };
  const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!sec) { if (t === 'pops={') { sec = true; depth = 1; } continue; }
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    const m = /^(\d+)=\{$/.exec(t);
    if (m && depth === 2) { flush(); cur = { state: null, type: null, workforce: 0, dependents: 0, culture: null, wealth: null, workplace: null, religion: null, wb: [] }; inWB = false; }
    else if (cur) {
      let x;
      if (inWB) { if (t === '}') inWB = false; else cur.wb.push(...t.split(/\s+/).map(Number).filter(v => !Number.isNaN(v))); }
      else if (t === 'weekly_budget={') inWB = true;
      else if ((x = /^location=(\d+)$/.exec(t))) cur.state = +x[1];
      else if ((x = /^type="([a-z_]+)"$/.exec(t))) cur.type = x[1];
      else if ((x = /^workforce=(\d+)$/.exec(t))) cur.workforce = +x[1];
      else if ((x = /^dependents=(\d+)$/.exec(t))) cur.dependents = +x[1];
      else if ((x = /^culture=(\d+)$/.exec(t))) cur.culture = +x[1];
      else if ((x = /^wealth=(\d+)$/.exec(t))) cur.wealth = +x[1];
      else if ((x = /^workplace=(\d+)$/.exec(t))) cur.workplace = +x[1];
      else if ((x = /^religion="([a-z_]+)"$/.exec(t))) cur.religion = x[1];
    }
    depth += o - c;
    if (depth <= 0) { flush(); break; }
  }
}
console.error(`pops in calibrated markets ${popN} · slave pops ${slaveN} · slave workplace ids missing from buildings db ${slaveNoW}`);
// ⚠ the basket clamp uses lowestNonSlaveWealth accumulated DURING the same pass — pops stream in db
// order, so early slave pops may see a not-yet-final minimum. Wealth minima are small integers that
// stabilise within the first states; report the final clamp so a reader can judge.
for (const [mkt, name] of mktName) console.error(`${name}: lowest non-slave wealth ${lowestNonSlaveWealth.get(mkt)}`);

// ---- measured side: pop + slave lines from the calib run's own logs
const stamp = /sessions[\\\/](\d{8}_\d{6})/.exec(RUN)?.[1];
const runIdx = /run(\d+)_/.exec(RUN)?.[1] || '001';
const tok = stamp + 's' + String(+runIdx).padStart(3, '0');
const LOG = join(RUN, 'logs_live/debug.log');
const buyOf0 = await buyOrderTable(LOG, tok);
const addMo = (d, k) => { let [y, m, day] = d.split('.').map(Number); m += k; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '.' + m + '.' + day; };
const buyOf = { get(key) {
  if (buyOf0.has(key)) return buyOf0.get(key);
  const [d, mk, g] = key.split('\t');
  for (const k of [-1, 1, -2]) { const v = buyOf0.get(addMo(d, k) + '\t' + mk + '\t' + g); if (v != null) return v; }
  return undefined;
} };
const { blocks, stats } = await readBreakdown(LOG, tok, buyOf, { tolerance: 0.12 });
console.error('breakdown blocks:', JSON.stringify(stats));
const meas = new Map();  // marketName|good -> { pop, slaves }
for (const b of blocks) { if (DATEF && b.date !== DATEF) continue; meas.set(b.market + '|' + b.good, { pop: b.pop, slaves: b.slaves }); }
if (DATEF) console.error(`date filter ${DATEF}: ${[...meas.keys()].length} (market,good) pairs kept`);

// ---- report
const f0 = x => Math.round(x).toLocaleString('en-US');
const r2 = x => (Math.round(x * 1000) / 1000).toFixed(3);
function sumBy(m, sel) { let s = 0; for (const g of Object.keys(m)) s += sel(m[g], g) || 0; return s; }
for (const [mkt, name] of mktName) {
  const cm = CLS.get(mkt) || { sub: 0, emp: 0, none: 0, sub_wf: 0, emp_wf: 0, none_wf: 0, wealthSum: 0, n: 0, wByCls: { sub: 0, emp: 0, none: 0 }, types: new Map() };
  console.log(`\n=== ${name} — slave people by employer class: sub ${f0(cm.sub)} · emp ${f0(cm.emp)} · none ${f0(cm.none)}`);
  console.log(`mean wealth: all ${cm.n ? r2(cm.wealthSum / cm.n) : '—'} · sub ${cm.sub ? r2(cm.wByCls.sub / cm.sub) : '—'} · emp ${cm.emp ? r2(cm.wByCls.emp / cm.emp) : '—'} · none ${cm.none ? r2(cm.wByCls.none / cm.none) : '—'}`);
  if (cm.types.size) {
    console.log(`employed-slave workplaces (people · per-head package £/wk):`);
    for (const [ty, tt] of [...cm.types].sort((a, b) => b[1].headGBP - a[1].headGBP).slice(0, 10))
      console.log(`  ${ty}\t${f0(tt.people)}\t£${f0(tt.headGBP)}`);
  }
  const sm = S.get(mkt) || {}, pm = P.get(mkt) || {};
  let measPop = 0, measSlv = 0, predNon = 0, covered = 0;
  const rows = [];
  for (const g of Object.keys(pm).concat(Object.keys(sm).filter(g => !(g in pm)))) {
    const mv = meas.get(name + '|' + g);
    if (!mv) continue;
    covered++;
    const sv = sm[g] || { own: { sub: 0, emp: 0, none: 0 }, head: { sub: 0, emp: 0, none: 0 } };
    const pOnly = (pm[g] || 0);
    measPop += mv.pop * (BASEP[g] || 0); measSlv += mv.slaves * (BASEP[g] || 0); predNon += pOnly;
    rows.push({ g, mvPop: mv.pop * (BASEP[g] || 0), mvSlv: mv.slaves * (BASEP[g] || 0), pOnly, own: sv.own, head: sv.head });
  }
  console.log(`\n=== ${name} — ${covered} measured goods · base-£/wk (all sums over covered goods only)`);
  console.log(`measured: pop line ${f0(measPop)} · slave line ${f0(measSlv)} · P_nonslave ${f0(predNon)}`);
  // structural hypotheses, £ ratio predicted/measured over covered goods
  const hyp = (label, fn) => {
    let s = 0; for (const r of rows) s += fn(r);
    console.log(`  ${label}: ${f0(s)}  ratio vs pop line ${r2(s / (measPop || 1))}`);
  };
  console.log(`POP-LINE hypotheses (predicted composition -> ratio to measured pop line):`);
  hyp('P_nonslave alone                 ', r => r.pOnly);
  hyp('P_nonslave + S_own_all           ', r => r.pOnly + r.own.sub + r.own.emp + r.own.none);
  hyp('P_nonslave + S_own_emp+none      ', r => r.pOnly + r.own.emp + r.own.none);
  hyp('P_nonslave + S_own_sub+none      ', r => r.pOnly + r.own.sub + r.own.none);
  const shyp = (label, fn) => {
    let s = 0; for (const r of rows) s += fn(r);
    console.log(`  ${label}: ${f0(s)}  ratio vs slave line ${r2(s / (measSlv || 1))}`);
  };
  console.log(`SLAVE-LINE hypotheses (predicted -> ratio to measured "purchased for slaves"):`);
  shyp('S_head_emp (per-head, emp only)    ', r => r.head.emp);
  shyp('S_head_emp + 0.05*S_head_sub       ', r => r.head.emp + 0.05 * r.head.sub);
  shyp('S_own_emp (0.5-dependent units)    ', r => r.own.emp);
  shyp('S_head_all                         ', r => r.head.sub + r.head.emp + r.head.none);
  shyp('0.05 * S_head_sub                  ', r => 0.05 * r.head.sub);
  // spend-weighted mean |ratio-1| per good under the winning compositions
  const score = (label, fnP, fnS) => {
    let e = 0, wsum = 0;
    for (const r of rows) {
      const target = fnS ? r.mvSlv : r.mvPop;
      if (!(target > 0)) continue;
      const pred = fnP(r);
      e += Math.abs(pred / target - 1) * target; wsum += target;
    }
    console.log(`  ${label}: spend-weighted mean |err| ${(100 * e / (wsum || 1)).toFixed(1)}%  (over £${f0(wsum)})`);
  };
  console.log(`PER-GOOD scores:`);
  score('pop line <- P_nonslave + S_own_all', r => r.pOnly + r.own.sub + r.own.emp + r.own.none, false);
  score('pop line <- P_nonslave alone      ', r => r.pOnly, false);
  score('slave line <- S_head_emp          ', r => r.head.emp, true);
  // per-good detail for the biggest 14 goods by measured pop £
  rows.sort((a, b) => b.mvPop - a.mvPop);
  console.log(`good\tmeas_pop£\tpred_pop£\tratio\tmeas_slave£\thead_emp£\tratio`);
  for (const r of rows.slice(0, 14)) {
    const pp = r.pOnly + r.own.sub + r.own.emp + r.own.none;
    console.log([r.g, f0(r.mvPop), f0(pp), r2(pp / (r.mvPop || 1)), f0(r.mvSlv), f0(r.head.emp), r.mvSlv > 0 ? r2(r.head.emp / r.mvSlv) : '—'].join('\t'));
  }
}
