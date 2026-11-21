// THE IN-MARKET BACKWARD-INDUSTRY TEST, as a library (2026-11-21, for the register's old-plants term, BALANCE_FRAMEWORK §10.121.1 / §10.123).
// Section A of laggard_pressure.mjs moved here unchanged in substance, so the scorecard's reading (laggard_pressure --json) and the loss's
// term (criteria.mjs) are one computation. Manufacturing only (lib_industries.mjs): the deposit rungs never, agriculture not for now.
//   A case: a country's industry with >= 5,000 workers at year y whose BEST rung (a rung with > 5% of its workers) has a rung above it, and
//   which LACKS that rung's technology at y (stuck 'y'; 'y10' = still lacking it at y+10; 'none' = no condition). Its class:
//     inm   — its own market's frontier is >= 2 tiers above its best rung (a far better producer in the same market);
//     trade — not so in its market, but the world's frontier is;
//     ctrl  — its market's frontier is at or under its best rung.
//   kept = the industry's workers on every rung at y+10 ÷ at y (a later build-up or switch counts as surviving).
//   A frontier is the highest tier holding >= 10% of the workers of that industry in the market (or the world).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { manufacturing } from './lib_industries.mjs';
export const LAG_YEARS = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
const CONSUMER = ['food_industry', 'textile_mill', 'furniture_manufactory', 'glassworks', 'paper_mill', 'art_academy'];
const sum = a => a.reduce((x, y) => x + y, 0);

/** pm → {ind, era, emp} for the mod (pm_key) and for vanilla (vanilla_pm); the next rung's technology per industry and tier. */
export function laggardMaps(cfg) {
  const MOD = {}, VAN = {}, NEXT = {}, TIERKEYS = new Set(), INDNAME = {};
  const { kept, skipped } = manufacturing(cfg);
  for (const [id, ind] of kept) {
    INDNAME[id] = (ind.tiers[0].key || id).replace(/^building_/, '');
    const byEra = {}; for (const t of ind.tiers) { byEra[t.era] = t; TIERKEYS.add(t.key); }
    for (const t of ind.tiers) {
      const base = Object.values(t.employment || {}).reduce((a, b) => a + b, 0) || 5000;
      if (t.pm_key) MOD[t.pm_key] = { ind: id, era: t.era, emp: base * (t.workforce_mult || 1) };
      if (t.vanilla_pm) VAN[t.vanilla_pm] = { ind: id, era: t.era, emp: base };
    }
    const eras = Object.keys(byEra).map(Number).sort((a, b) => a - b);
    NEXT[id] = {}; eras.forEach((e, i) => { const n = eras[i + 1]; NEXT[id][e] = n == null ? null : byEra[n].tech; });
  }
  return { MOD, VAN, NEXT, TIERKEYS, INDNAME, skipped };
}

/** one summary's countries → { key: {tag, m, gdp, pop, sol, techs, ntech, U, W: {ind: {era: workers}}, va, prof, overlord} } */
export function laggardCountries(j, map, TIERKEYS) {
  const C = {};
  for (const [ck, c] of Object.entries(j.countries || {})) {
    const W = {}; let va = 0; const prof = {}; const pop = Object.values(c.strata || {}).reduce((a, b) => a + b, 0);
    for (const [bk, b] of Object.entries(c.buildings || {})) {
      const lv = b.levels || 0; if (!lv) continue; const sf = Math.min(1, (b.staffing || 0) / lv);
      let indOf = null;
      for (const [pm, l] of Object.entries(b.pms || {})) { const r = map[pm]; if (!r) continue; indOf = r.ind;
        const w = l * sf * r.emp; if (w > 0) ((W[r.ind] ||= {})[r.era] = (W[r.ind][r.era] || 0) + w); }
      if (TIERKEYS.has(bk) || indOf) { if (b.va_out != null) va += 52 * ((+b.va_out || 0) - (+b.va_in || 0));
        if (indOf) prof[indOf] = (prof[indOf] || 0) + (+b.profit || 0); }
    }
    const ps = c.pop_statistics || {}; const sal = +ps.population_salaried_workforce || 0, un = +ps.population_unemployed_workforce || 0, pe = (+ps.population_subsisting_workforce || 0) * 1e5;
    C[ck] = { tag: c.tag || ck.split('@')[0], m: c.market, gdp: +c.gdp || 0, pop, sol: +c.avg_sol, techs: new Set(c.technologies_held || []), ntech: (c.technologies_held || []).length,
      U: (sal + un + pe) > 0 ? (un + pe) / (sal + un + pe) : NaN, W, va, prof, overlord: c.overlord };
  }
  return C;
}
/** the 1 January summary of each LAG_YEARS year → laggardCountries (the LAST summary of a date wins: a replayed branch overwrites the abandoned one) */
export function readLaggardRun(runDir, map, TIERKEYS) {
  const sd = join(runDir, 'save_summaries'); if (!existsSync(sd)) return {};
  const byYear = {};
  for (const f of readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f))).toString()); } catch { continue; }
    const y = lagYearOf(j); if (y == null) continue;
    byYear[y] = laggardCountries(j, map, TIERKEYS);
  }
  return byYear;
}
/** the LAG_YEARS year a summary stands for (dated y.1.1), else null */
export function lagYearOf(j) { const p = String(j.provenance && j.provenance.date || '').split('.').map(Number); return (p[1] === 1 && p[2] === 1 && LAG_YEARS.includes(p[0])) ? p[0] : null; }

export function frontier(byEra) { const tot = sum(Object.values(byEra)); if (tot <= 0) return -1; let f = -1; for (const [e, w] of Object.entries(byEra)) if (w >= 0.1 * tot && +e > f) f = +e; return f; }
/** markets → members, the world's frontier per industry (GF) and each market's (F[market][industry]) */
export function marketFrontiers(d) {
  const mk = {}; for (const [ck, c] of Object.entries(d)) (mk[c.m] ||= []).push(ck);
  const GW = {}; for (const c of Object.values(d)) for (const [i, eras] of Object.entries(c.W)) for (const [e, w] of Object.entries(eras)) ((GW[i] ||= {})[e] = (GW[i][e] || 0) + w);
  const GF = {}; for (const [i, eras] of Object.entries(GW)) GF[i] = frontier(eras);
  const F = {}; for (const [m, ks] of Object.entries(mk)) { const M = {}; for (const k of ks) for (const [i, eras] of Object.entries(d[k].W)) for (const [e, w] of Object.entries(eras)) ((M[i] ||= {})[e] = (M[i][e] || 0) + w); F[m] = {}; for (const [i, eras] of Object.entries(M)) F[m][i] = frontier(eras); }
  return { mk, F, GF };
}
/** the cases at y (d) against y+10 (d2): [{ y, st: 'inm'|'trade'|'ctrl'|null, legacy: 'stuck'|'ctrl'|null, chain, got, has, w, w2, p }]
 *  `legacy` is section A's older split, kept for laggard_pressure's first line: 'stuck' = in-market, 'ctrl' = its market's frontier at or under
 *  its best rung (which, unlike st 'ctrl', also takes cases whose better producers are abroad). */
export function stuckCases(y, d, d2, F, GF, NEXT, INDNAME, STUCK = 'y') {
  const out = [];
  for (const [ck, c] of Object.entries(d)) { if (!d2[ck]) continue;
    for (const [i, eras] of Object.entries(c.W)) { const w = sum(Object.values(eras)); if (w < 5000) continue;
      const best = Math.max(...Object.entries(eras).filter(([, x]) => x > 0.05 * w).map(([e]) => +e)); const nx = NEXT[i][best];
      if (!nx) continue;                                          // no rung above: nothing to be stuck under
      if (STUCK === 'y' && c.techs.has(nx)) continue;             // it could switch / build up already at y
      if (STUCK === 'y10' && d2[ck].techs.has(nx)) continue;      // it could within the decade (the size-filtered first version)
      const fm = F[c.m][i]; const w2 = sum(Object.values(d2[ck].W[i] || {}));
      const st = fm >= best + 2 ? 'inm' : GF[i] >= best + 2 ? 'trade' : fm <= best ? 'ctrl' : null;
      out.push({ y, tag: c.tag, ind: i, st, legacy: fm >= best + 2 ? 'stuck' : fm <= best ? 'ctrl' : null,
        chain: CONSUMER.includes(INDNAME[i]) ? 'consumer' : 'heavy+war', got: d2[ck].techs.has(nx) ? 'got' : 'not', has: c.techs.has(nx) ? 'holds' : 'lacks',
        w, w2, p: (c.prof[i] || 0) / w * 1000 });   // p: weekly profit per 1,000 workers
    } }
  return out;
}
/** a run's in-market cases summed by decade: { byDec: {y: {w, w2, n}}, w, w2, n } */
export function inMarketByDecade(Y, NEXT, INDNAME, STUCK = 'y') {
  const byDec = {}; let w = 0, w2 = 0, n = 0;
  for (const y of LAG_YEARS) { const d = Y[y], d2 = Y[y + 10]; if (!d || !d2) continue; const { F, GF } = marketFrontiers(d);
    for (const cs of stuckCases(y, d, d2, F, GF, NEXT, INDNAME, STUCK)) { if (cs.st !== 'inm') continue;
      const o = (byDec[y] ||= { w: 0, w2: 0, n: 0 }); o.w += cs.w; o.w2 += cs.w2; o.n++; w += cs.w; w2 += cs.w2; n++; } }
  return { byDec, w, w2, n };
}
