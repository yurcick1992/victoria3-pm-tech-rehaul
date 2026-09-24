// OBSOLESCENCE, IN-MARKET vs TRADE — one metric set for both kinds of competition (FINDINGS F161 §4; user-asked 2026-09-24:
// "bonus points if the plan is in similar obsolescence terms for in-market and trade-based competition").
//
// Every (country, tiered rung) cell of every usable run, at each date, from the yearly save summaries — EVERY country, not the
// instrumented markets (v9+: goods_sales / goods_cost / profit / va_out per building type; v10 adds the per-country trade capacity
// per good; v11 adds each country's import tariff levels and trade-policy law).
//   price p     = goods_sales ÷ va_out              the rung's realised output price as a multiple of base (its own output mix)
//   margin      = profit ÷ (goods_sales − profit)    TRUE margin, wages inside (CLAUDE.md, the 2026-09-20 ruling) = p ÷ break-even − 1
//   frontier    = the highest ERA holding ≥ thr of the industry's OUTPUT (va_out) — in the cell's own MARKET and in the WORLD —
//                 so supply decides who competes (an unstaffed level produces nothing)
//   regime      IN-MARKET   own market's frontier ≥ 2 eras above the rung       (the ladder's death test)
//               TRADE-ONLY  own market's frontier < 2 above, the world's ≥ 2 above  (a laggard market facing the world's frontier)
//               UNCONTESTED everything else
//   world price pW = the world's output-weighted realised price of the industry (Σ sales ÷ Σ va_out) — comparable across arms,
//                 which the v10 world market price is not (a v9 run has none)
// ⚠ Eras, never rung indices (§10.78). ⚠ Disabled industries skipped (L27). ⚠ Staffing alone is not death — labour supply can
// empty a profitable building; read the loss share and the margin with it.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
export const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
export const SES = path.join(REPO, 'tools/testbed/sessions');
export const REGIMES = ['IN-MARKET', 'TRADE-ONLY', 'UNCONTESTED'];
const load = f => JSON.parse(f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)) : fs.readFileSync(f, 'utf8'));
export function wmedian(pairs) { const s = pairs.filter(([v, w]) => Number.isFinite(v) && w > 0).sort((a, b) => a[0] - b[0]); const W = s.reduce((a, [, w]) => a + w, 0); let c = 0; for (const [v, w] of s) { c += w; if (c >= W / 2) return v; } return NaN; }
// one summary per year (Y.1.1), found by date near its positional file index; `override` = a directory of re-summaries named
// <session>__<run>.json.gz that REPLACES the run's own file for the year it carries (e.g. v11 re-summaries of the kept 1936 save)
export function summariesByYear(runDir, years, overrideDir = null) {
  const out = {};
  if (overrideDir) { const f = path.join(overrideDir, path.basename(path.dirname(runDir)) + '__' + path.basename(runDir) + '.json.gz');
    if (fs.existsSync(f)) { const j = load(f); const y = +j.provenance.date.slice(0, 4); if (years.includes(y) && j.provenance.date === y + '.1.1') out[y] = j; } }
  const sd = path.join(runDir, 'save_summaries'); if (!fs.existsSync(sd)) return out;
  const files = fs.readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort();
  for (const y of years) { if (out[y]) continue; const guess = y - 1835;
    for (const f of files.filter(f => Math.abs(+f.slice(0, 4) - guess) <= 3)) { let j; try { j = load(path.join(sd, f)); } catch { continue; } if (j.provenance?.date === y + '.1.1') { out[y] = j; break; } } }
  return out;
}
export function usableRuns(session, setup) {
  return fs.readdirSync(path.join(SES, session)).filter(d => /^run\d+/.test(d) && (!setup || d.endsWith('_' + setup))).filter(d => {
    try { const m = JSON.parse(fs.readFileSync(path.join(SES, session, d, 'meta.json'), 'utf8')); return String(m.reached_ingame_date).startsWith('1936') && !m.abandoned_reason; } catch { return false; } });
}
const newCell = () => ({ lv: 0, st: 0, lossLv: 0, marg: [], stNow: 0, stNext: 0, add: 0, wbe: [], wbeLossLv: 0, gap: [], split: {}, tariff: {}, policy: {} });
const newSub = () => ({ lv: 0, lossLv: 0, marg: [], sg: [] });
export function measure({ session, setup, config, years, thr = 0.10, overrideDir = null, industries = null }) {
  const cfg = JSON.parse(fs.readFileSync(path.isAbsolute(config) ? config : path.join(REPO, config), 'utf8'));
  const rung = {}; for (const ind of cfg.industries) { if (ind.disabled) continue; if (industries && !industries.includes(ind.id)) continue;
    for (const t of ind.tiers) rung[t.key] = { ind: ind.id, era: t.era, good: t.output_good || ind.output_good }; }
  const runs = usableRuns(session, setup);
  const acc = {}, tags = {}, link = {};
  const cell = (ind, y, reg) => (((acc[ind] ??= {})[y] ??= {})[reg] ??= newCell());
  const front = shares => { const T = Object.values(shares).reduce((a, b) => a + b, 0); let f = -1; for (const [e, v] of Object.entries(shares)) if (v / T >= thr && +e > f) f = +e; return f; };
  const regime = (fl, fw, era) => (fl - era >= 2) ? 'IN-MARKET' : (fw - era >= 2) ? 'TRADE-ONLY' : 'UNCONTESTED';
  for (const run of runs) {
    const S = summariesByYear(path.join(SES, session, run), years, overrideDir);
    for (let yi = 0; yi < years.length; yi++) { const y = years[yi], j = S[y]; if (!j) continue; const jn = S[years[yi + 1]]; const ver = j.save_summary_version || 0;
      const cells = [];
      for (const [tag, c] of Object.entries(j.countries)) for (const [k, b] of Object.entries(c.buildings || {})) { const r = rung[k]; if (!r || !b.levels) continue;
        cells.push({ tag, mkt: c.market, key: k, ...r, lv: b.levels, st: b.staffing || 0, prof: b.profit, sales: b.goods_sales, vaout: b.va_out,
          tariff: c.tariffs ? (c.tariffs.import?.[r.good] ?? 'unset') : 'nodata', policy: c.trade_policy ?? 'nodata' }); }
      const out = {}; for (const x of cells) { if (!(x.vaout > 0)) continue; const F = (out[x.ind] ??= { world: {}, mkt: {} }); const m = (F.mkt[x.mkt] ??= {}); m[x.era] = (m[x.era] || 0) + x.vaout; F.world[x.era] = (F.world[x.era] || 0) + x.vaout; }
      const mktNet = {}; for (const c of Object.values(j.countries)) for (const [g, v] of Object.entries(c.trade?.goods || {})) { const M = (mktNet[c.market] ??= {}); M[g] = (M[g] || 0) + v.exp - v.imp; }
      const pw = {}; for (const x of cells) if (x.vaout > 0 && x.sales > 0) { const q = (pw[x.ind] ??= { n: 0, d: 0 }); q.n += x.sales; q.d += x.vaout; }
      for (const x of cells) {
        const F = out[x.ind]; if (!F) continue; const reg = regime(F.mkt[x.mkt] ? front(F.mkt[x.mkt]) : -1, front(F.world), x.era);
        const a = cell(x.ind, y, reg); a.lv += x.lv; a.st += x.st; if (x.prof < 0) a.lossLv += x.lv;
        const T = ((((tags[x.tag] ??= {})[x.ind] ??= {})[y] ??= {})[reg] ??= { lv: 0, st: 0, lossLv: 0 }); T.lv += x.lv; T.st += x.st; if (x.prof < 0) T.lossLv += x.lv;
        const m = x.sales > 0 ? x.prof / (x.sales - x.prof) : NaN; if (Number.isFinite(m)) a.marg.push([m, x.lv]);
        const pWorld = pw[x.ind] ? pw[x.ind].n / pw[x.ind].d : NaN, p = x.vaout > 0 ? x.sales / x.vaout : NaN;
        if (Number.isFinite(p) && Number.isFinite(pWorld)) { a.gap.push([Math.log(p / pWorld), x.lv]); ((link[x.ind] ??= {})[y] ??= { gapAll: [] }).gapAll.push([Math.abs(Math.log(p / pWorld)), x.vaout]); }
        if (Number.isFinite(pWorld) && x.sales - x.prof > 0 && x.vaout > 0) { const r2 = pWorld * x.vaout / (x.sales - x.prof); a.wbe.push([r2, x.lv]); if (r2 < 1) a.wbeLossLv += x.lv; }
        if (reg === 'TRADE-ONLY') {
          const pos = ver < 10 ? 'nodata' : mktNet[x.mkt] === undefined ? 'notrade' : (mktNet[x.mkt][x.good] < 0 ? 'imp' : 'notimp');
          for (const [bag, key] of [[a.split, pos], [a.tariff, x.tariff], [a.policy, x.policy]]) { const q = (bag[key] ??= newSub()); q.lv += x.lv; if (x.prof < 0) q.lossLv += x.lv; if (Number.isFinite(m)) q.marg.push([m, x.lv]); if (Number.isFinite(p) && Number.isFinite(pWorld)) q.sg.push([Math.log(p / pWorld), x.lv]); }
        }
        if (jn) { a.stNow += x.st; a.stNext += jn.countries[x.tag]?.buildings?.[x.key]?.staffing || 0; }
      }
      if (jn) for (const [tag, c] of Object.entries(jn.countries)) for (const [k, b] of Object.entries(c.buildings || {})) { const r = rung[k]; if (!r) continue;
        const addv = (b.levels || 0) - (j.countries[tag]?.buildings?.[k]?.levels || 0); if (addv <= 0) continue; const F = out[r.ind]; if (!F) continue;
        const mk = j.countries[tag]?.market ?? c.market; cell(r.ind, y, regime(F.mkt[mk] ? front(F.mkt[mk]) : -1, front(F.world), r.era)).add += addv; acc[r.ind][y]._addTot = (acc[r.ind][y]._addTot || 0) + addv; }
    }
  }
  return { session, setup, config, runs, years, thr, acc, tags, link };
}
// Compact, JSON-safe reading pooled over `pool` years — what the ledger panel and the CLI print.
export function summarise(R, pool) {
  const sub = s => s && s.lv ? { lv: s.lv, loss: s.lossLv / s.lv, marg: wmedian(s.marg), prem: wmedian(s.sg) } : null;
  const merge = (list) => { const t = newSub(); for (const q of list) { if (!q) continue; t.lv += q.lv; t.lossLv += q.lossLv; t.marg.push(...q.marg); t.sg.push(...q.sg); } return t; };
  const industries = {};
  for (const ind of Object.keys(R.acc)) {
    const o = {};
    for (const reg of REGIMES) { const s = newCell(); for (const y of pool) { const a = R.acc[ind]?.[y]?.[reg]; if (!a) continue; s.lv += a.lv; s.st += a.st; s.lossLv += a.lossLv; s.marg.push(...a.marg); s.wbe.push(...a.wbe); s.wbeLossLv += a.wbeLossLv; }
      o[reg] = s.lv ? { lv: s.lv, loss: s.lossLv / s.lv, marg: wmedian(s.marg), staffed: s.st / s.lv, wbe: wmedian(s.wbe), wbeBelow: s.wbeLossLv / s.lv } : null; }
    const tr = y => R.acc[ind]?.[y]?.['TRADE-ONLY'];
    const keysOf = f => [...new Set(pool.flatMap(y => Object.keys(tr(y)?.[f] || {})))];
    for (const f of ['split', 'tariff', 'policy']) o[f] = Object.fromEntries(keysOf(f).map(k => [k, sub(merge(pool.map(y => tr(y)?.[f]?.[k])))]));
    o.gap = wmedian(pool.flatMap(y => R.link[ind]?.[y]?.gapAll || []));
    industries[ind] = o;
  }
  const tags = {};
  for (const [tag, T] of Object.entries(R.tags)) for (const [ind, byY] of Object.entries(T)) for (const y of pool) for (const [reg, v] of Object.entries(byY[y] || {})) {
    const d = ((tags[tag] ??= {})[ind] ??= {})[reg] ??= { lv: 0, st: 0, lossLv: 0 }; d.lv += v.lv; d.st += v.st; d.lossLv += v.lossLv; }
  return { session: R.session, setup: R.setup, runs: R.runs.length, pool, thr: R.thr, industries, tags };
}
