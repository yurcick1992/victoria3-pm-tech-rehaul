// DOES NEW FRONTIER CAPACITY STALL WHILE IT STILL EARNS? — the supply half of "why prices do not fall" (FINDINGS F249 §4d, 2026-10-26).
// The mechanism under test: in a capital-scarce economy the investment AI builds where returns are best; when a good's price starts to slide,
// new capacity in it stops being the best use of capital and goes elsewhere, so supply only tracks demand, the frontier's lower cost shows up as
// MARGIN rather than a lower price, and the old rung stays the marginal supplier. If it holds: a consumer industry's newest building earns about
// what the rest of new capital earns and gets capital in proportion; if instead it earns far MORE than the capital that went elsewhere and
// still gets little, the AI is not following profit (misplaced capital, §10.92), which is a different defect with a different lever.
// Per run, between consecutive yearly summaries (the LAST summary of each 1 January — a replayed branch overwrites the abandoned one):
//   points built   = Σ positive Δlevels × the type's construction points (the book's building_cost, else vanilla's required_construction)
//   return / point = 52 × Σ profit ÷ Σ staffed levels ÷ points, pooled over the scope's countries at the step's start (£ a year per point)
//   price index    = Σ goods_sales ÷ Σ va_out (market sales over base-priced output, the type's whole output mix incl. secondaries)
//   margin         = Σ profit ÷ (Σ goods_sales − Σ profit) (§2.10's identity; v9+ summaries)
// Scope: the shortlist pool (GBR USA FRA NET BEL UNL PRU NGF GER, main records) or --scope world. Profit-seeking sectors only for the
// opportunity average (tiered manufacturing, mines, agriculture — misplaced capital's scope); infrastructure and government shown apart.
//   node tools/testbed/ledger/frontier_supply.mjs <book> <label>=<group>:<setup> [--scope pool|world] [--industries food,textile,…]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { requiredConstruction } from '../../vanilla_construction.mjs';
const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const SES = join(REPO, 'tools', 'testbed', 'sessions');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : d; };
const SCOPE = opt('--scope', 'pool');
const POOL = new Set(['GBR', 'USA', 'FRA', 'NET', 'BEL', 'UNL', 'PRU', 'NGF', 'GER']);
const SHOW = opt('--industries', 'food,textile,furniture,glass,paper,art_academy,tooling,steel').split(',');
const cfg = JSON.parse(readFileSync(join(REPO, args[0]), 'utf8'));
const group = args.slice(1).find(a => a.includes('=') && !a.startsWith('--')); const [LABEL, rest] = group.split('='); const [SESS, SETUP] = rest.split(':');
const RC = requiredConstruction();
const VAN = /vanilla/.test(SETUP || '');           // a vanilla arm: one building per industry, the rung-0 key, at vanilla's cost
const TYPE = {};                                 // building type -> { ind, era, cost }
for (const I of cfg.industries) { if (I.disabled) continue; for (const t of I.tiers) { if (t.method_of) continue; if (VAN && t.era !== Math.min(...I.tiers.map(x => x.era))) continue;
  TYPE[t.key] = VAN ? { ind: I.id, era: 'v', cost: RC[t.key], craft: false } : { ind: I.id, era: t.era, cost: t.building_cost ?? RC[t.key], craft: !!t.craft }; } }
const isAgri = k => /_farm$|_plantation$|_ranch$|orchards?$|vineyard$/.test(k) && !/subsistence|rubber/.test(k);
const isMine = k => /_mine$|logging_camp|fishing_wharf|whaling_station|oil_rig|rubber_plantation/.test(k) && !/gold/.test(k);
const INFRA = k => /railway|port$|power_plant|dam_|trade_center/.test(k);
const sectorOf = k => TYPE[k] ? (['port', 'railway', 'power', 'shipyard', 'shipyard_steam'].includes(TYPE[k].ind) ? 'infrastructure' : 'manufacturing') : /subsistence|gold_/.test(k) ? null : isMine(k) ? 'mines' : isAgri(k) ? 'agriculture' : INFRA(k) ? 'infrastructure' : 'other';
const costOf = k => TYPE[k] ? TYPE[k].cost : RC[k];
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const DECADES = [[1840, 1850], [1850, 1860], [1860, 1870], [1870, 1880], [1880, 1890], [1890, 1900], [1900, 1910], [1910, 1920], [1920, 1930], [1930, 1936]];
const decOf = y => DECADES.findIndex(([a, b]) => y >= a && y < b);
function readRun(runDir) {
  const sd = join(runDir, 'save_summaries'); if (!existsSync(sd)) return {}; const Y = {};
  for (const f of readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f))).toString()); } catch { continue; }
    const p = String(j.provenance?.date || '').split('.').map(Number); if (p[1] !== 1 || p[2] !== 1) continue;
    const B = {};                                // type -> pooled { lv, st, profit, sales, va }
    for (const [ck, c] of Object.entries(j.countries || {})) { if (ck.includes('@')) continue; if (SCOPE === 'pool' && !POOL.has(c.tag || ck)) continue;
      for (const [k, b] of Object.entries(c.buildings || {})) { const o = (B[k] ||= { lv: 0, st: 0, profit: 0, sales: 0, va: 0, cost: 0, vain: 0, byC: {} });
        o.lv += b.levels || 0; o.st += b.staffing || 0; o.profit += b.profit || 0; o.sales += b.goods_sales || 0; o.va += b.va_out || 0; o.cost += b.goods_cost || 0; o.vain += b.va_in || 0; o.byC[ck] = b.levels || 0; } }
    Y[p[0]] = B;
  }
  return Y;
}
// per run, per decade: points built per type, the type's return/point (median of the decade's yearly values), price index, margin
const runs = usableRuns(SES, SESS, SETUP).runs;
const R = [];                                    // per run: dec -> { built: {k: pts}, ret: {k: [..]}, idx: {ind: [sales, va]}, mar: {k: [p, s]}, st0: {k}, st1: {k} }
for (const rel of runs) {
  const Y = readRun(join(SES, rel)); const out = DECADES.map(() => ({ built: {}, ret: {}, ind: {}, mar: {}, st0: {}, st1: {}, pin: {} }));
  const years = Object.keys(Y).map(Number).sort((a, b) => a - b);
  for (const y of years) { const d = decOf(y); if (d < 0) continue; const A = Y[y], N = Y[y + 1]; const o = out[d];
    for (const [k, b] of Object.entries(A)) { const ck = costOf(k); if (!ck) continue;
      if (b.st > 0.5) (o.ret[k] ||= []).push(52 * b.profit / b.st / ck);
      const m = (o.mar[k] ||= [0, 0, 0]); m[0] += b.profit; m[1] += b.sales; m[2] += b.va;
      if (TYPE[k]) { const t = (o.ind[TYPE[k].ind] ||= [0, 0, 0, 0]); t[0] += b.sales; t[1] += b.va; t[2] += b.cost; t[3] += b.vain; }
      const pi = (o.pin[k] ||= [0, 0]); pi[0] += b.cost; pi[1] += b.vain;
      if (y === DECADES[d][0]) o.st0[k] = b.st; }
    if (N) for (const [k, b] of Object.entries(N)) { const ck = costOf(k); if (!ck) continue; const a = A[k];
      // new levels: per country (a country's demolition never offsets another's build)
      let dl = 0; for (const [c, l] of Object.entries(b.byC)) { const l0 = a?.byC?.[c] || 0; if (l > l0) dl += l - l0; }
      if (dl > 0) o.built[k] = (o.built[k] || 0) + dl * ck; }
    if (y + 1 === DECADES[d][1] || (d === DECADES.length - 1 && y + 1 === 1936)) { const E = Y[y + 1] || A; for (const [k, b] of Object.entries(E)) o.st1[k] = b.st; }
  }
  R.push(out);
}
const f0 = x => Number.isFinite(x) ? x.toFixed(0) : '—', f2 = x => Number.isFinite(x) ? x.toFixed(2) : '—', pc = x => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '—';
console.log(`FRONTIER SUPPLY — ${LABEL} (${runs.length} runs), scope ${SCOPE === 'pool' ? 'the shortlist pool' : 'the world'}; medians over runs; points = construction points; return = £ a year per construction point of a staffed level (a payback in years = £ per point ÷ return; a point costs ~£540–720)`);
// the opportunity: capital-weighted return of ALL new profit-seeking capital, and where the points went
console.log('\ndecade     points built: profit sectors (manufacturing · mines · agriculture) · infrastructure · other   capital-weighted return of new profit-seeking capital   top types built (points · return)');
for (let d = 0; d < DECADES.length; d++) {
  const per = R.map(o => o[d]); const sec = s => med(per.map(o => Object.entries(o.built).filter(([k]) => sectorOf(k) === s).reduce((a, [, v]) => a + v, 0)));
  const cw = med(per.map(o => { let w = 0, r = 0; for (const [k, v] of Object.entries(o.built)) { const s = sectorOf(k); if (!['manufacturing', 'mines', 'agriculture'].includes(s)) continue; const rk = med(o.ret[k] || []); if (!Number.isFinite(rk)) continue; w += v; r += v * rk; } return w > 0 ? r / w : NaN; }));
  const tot = {}; for (const o of per) for (const [k, v] of Object.entries(o.built)) tot[k] = (tot[k] || 0) + v / per.length;
  const top = Object.entries(tot).filter(([k]) => ['manufacturing', 'mines', 'agriculture'].includes(sectorOf(k))).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => `${k.replace('building_', '')} ${f0(v)}·${f0(med(per.map(o => med(o.ret[k] || []))))}`).join(', ');
  console.log(`${DECADES[d][0]}s     ${f0(sec('manufacturing')).padStart(6)} · ${f0(sec('mines')).padStart(6)} · ${f0(sec('agriculture')).padStart(6)} · ${f0(sec('infrastructure')).padStart(6)} · ${f0(sec('other')).padStart(6)}        £${f2(cw)}            ${top}`);
}
for (const ind of SHOW) {
  const types = Object.entries(TYPE).filter(([, t]) => t.ind === ind).sort((a, b) => a[1].era - b[1].era).map(([k]) => k); if (!types.length) continue;
  console.log(`\n${ind.toUpperCase()} — output price index (sales ÷ base-priced output) / input price index (goods cost ÷ base-priced inputs) · per building type: points built · return £/pt/yr · margin · input price index · staffed levels start→end of the decade`);
  for (let d = 2; d < DECADES.length; d++) { const per = R.map(o => o[d]);
    const idx = med(per.map(o => o.ind[ind] && o.ind[ind][1] > 0 ? o.ind[ind][0] / o.ind[ind][1] : NaN)); const idxIn = med(per.map(o => o.ind[ind] && o.ind[ind][3] > 0 ? o.ind[ind][2] / o.ind[ind][3] : NaN));
    const cells = types.map(k => { const t = TYPE[k]; const b = med(per.map(o => o.built[k] || 0)); const r = med(per.map(o => med(o.ret[k] || [])));
      const m = med(per.map(o => o.mar[k] && o.mar[k][1] > o.mar[k][0] ? o.mar[k][0] / (o.mar[k][1] - o.mar[k][0]) : NaN));
      const s0 = med(per.map(o => o.st0[k] || 0)), s1 = med(per.map(o => o.st1[k] || 0)); const pin = med(per.map(o => o.pin[k] && o.pin[k][1] > 0 ? o.pin[k][0] / o.pin[k][1] : NaN)); const pout = med(per.map(o => o.mar[k] && o.mar[k][2] > 0 ? o.mar[k][1] / o.mar[k][2] : NaN));
      return `t${t.era}${t.craft ? 'c' : ''}: ${f0(b).padStart(5)} · ${f0(r).padStart(4)} · ${pc(m).padStart(5)} · out ${f2(pout)} in ${f2(pin)} · ${f0(s0)}→${f0(s1)}`; });
    console.log(`  ${DECADES[d][0]}s  ${f2(idx)} / ${f2(idxIn)}   ${cells.join('   |   ')}`); }
}
