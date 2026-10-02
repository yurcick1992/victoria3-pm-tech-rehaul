// Which rungs die, and how: per industry and rung ERA, by year — workers (staffed levels × the rung's own per-level staffing), the realised
// output price (goods_sales ÷ va_out = market ÷ base for the rung's own output mix), the input price (goods_cost ÷ va_in), the TRUE margin
// profit ÷ (sales − profit), and the wage the rung pays ÷ its countries' normal wage (exact wages = sales − cost − profit, per worker).
// A merge host's numbers are shared out over its main methods by the levels running each (the summary's `pms`), as criteria.mjs does.
//   node tools/testbed/ledger/rung_fate.mjs --arm label:session[:setup] [--arm …] [--scope pool|world] [--years …] [--ind a,b]   (LV=1: workers · levels · occupancy · margin)
// Promoted from the session scratchpad 2026-10-02 (FINDINGS F209's run-1 report quoted it); the pool is lib_markets.mjs's POOL, main records only.
import path from 'node:path'; import fs from 'node:fs';
import { indexRun, readSum, runsOf, firstOf } from './lib_sumidx.mjs';
import { POOL as POOL_LIST } from './lib_markets.mjs';
const args = process.argv.slice(2); const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const all = n => args.flatMap((a, i) => a === n ? [args[i + 1]] : []);
const POOL = new Set(POOL_LIST);
const YEARS = argOf('--years', '1860,1880,1900,1910,1920,1930,1935').split(',').map(Number);
const SCOPE = argOf('--scope', 'pool');
const ONLY = argOf('--ind', null) ? new Set(argOf('--ind').split(',')) : null;
const first = firstOf;
function bookOf(runDir) {
  for (const f of [path.join(runDir, 'build_state.json'), path.join(path.dirname(runDir), 'build_state.json')]) if (fs.existsSync(f)) {
    const b = JSON.parse(fs.readFileSync(f, 'utf8')); const p = b.deterministic?.mod_under_test?.built_from_config || b.deterministic?.built_from_config; if (p) return JSON.parse(fs.readFileSync(p, 'utf8')); }
  throw new Error('no book for ' + runDir);
}
const empOf = t => Object.values(t.employment || {}).reduce((a, b) => a + b, 0) * (t.workforce_mult ?? 1);
for (const a of all('--arm')) {
  const [label, sess, setup] = a.split(':');
  const runs = runsOf(sess, setup || null).filter(r => fs.existsSync(path.join(r, 'meta.json')));
  // acc[ind][era][year] = sums, pooled over runs (each run's sums averaged by dividing by the run count at print)
  const acc = {}; let nRuns = 0; let book = null;
  for (const r of runs) {
    const cfg = bookOf(r); book = cfg; nRuns++;
    const tier = {}; for (const I of cfg.industries) { if (I.disabled) continue; for (const t of I.tiers) tier[t.key] = { ind: I.id, era: t.era, craft: !!t.craft, pm: t.pm_key, emp: empOf(t) }; }
    for (const I of cfg.industries) { if (I.disabled) continue; for (const t of I.tiers) if (t.method_of && tier[t.method_of]) (tier[t.method_of].methods ||= [{ pm: tier[t.method_of].pm, era: tier[t.method_of].era, emp: tier[t.method_of].emp, key: t.method_of }]).push({ pm: t.pm_key, era: t.era, emp: tier[t.key].emp, key: t.key }); }
    const idx = indexRun(r);
    for (const y of YEARS) { const d = first(idx, y); if (!d) continue; const j = readSum(idx[d]);
      for (const [ck, c] of Object.entries(j.countries || {})) {
        const tag = c.tag ?? ck.split('@')[0]; if (SCOPE === 'pool' && (!POOL.has(tag) || ck.includes('@'))) continue;
        const nw = (+c.base_wage || 0) / 1e4;   // £ per employee per week (the normal wage)
        for (const [k, b] of Object.entries(c.buildings || {})) { const t = tier[k]; if (!t) continue; if (ONLY && !ONLY.has(t.ind)) continue;
          let parts = [{ era: t.era, emp: t.emp, sh: 1, craft: t.craft }];
          if (t.methods && b.pms) { const lv = t.methods.map(m => +b.pms[m.pm] || 0); const tot = lv.reduce((x, z) => x + z, 0); if (tot > 0) parts = t.methods.map((m, i) => ({ era: m.era, emp: m.emp, sh: lv[i] / tot, craft: false })); }
          for (const p of parts) { if (!(p.sh > 0)) continue; const e = acc[t.ind] ??= {}; const E = e[(p.craft ? 'C' : '') + p.era] ??= {}; const A = E[y] ??= { workers: 0, staffed: 0, levels: 0, profit: 0, sales: 0, cost: 0, vaout: 0, vain: 0, normW: 0 };
            const st = (+b.staffing || 0) * p.sh, w = st * p.emp; A.workers += w; A.staffed += st; A.levels += (+b.levels || 0) * p.sh; A.profit += (+b.profit || 0) * p.sh;
            A.sales += (+b.goods_sales || 0) * p.sh; A.cost += (+b.goods_cost || 0) * p.sh; A.vaout += (+b.va_out || 0) * p.sh; A.vain += (+b.va_in || 0) * p.sh; A.normW += w * nw; } } } }
  }
  console.log(`\n=== ${label} (${sess}${setup ? ':' + setup : ''}) — ${SCOPE === 'pool' ? 'the shortlist pool' : 'the world'}, ${nRuns} run(s) pooled; per rung: workers k · output price ÷ base · input price ÷ base · true margin · wage paid ÷ the normal wage`);
  const order = ['food', 'textile', 'furniture', 'glass', 'paper', 'tooling', 'fertilizer', 'explosives', 'steel', 'motor', 'automotive', 'arms', 'artillery', 'munition', 'synthetics', 'electrics', 'art_academy'];
  const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '  - ';
  for (const ind of order) { if (!acc[ind]) continue;
    console.log(` ${ind}`);
    for (const er of Object.keys(acc[ind]).sort((p, q) => (+p.replace('C', '')) - (+q.replace('C', '')))) {
      const row = YEARS.map(y => { const A = acc[ind][er][y]; if (!A || A.workers < 1) return '        ·         '.padEnd(31);
        const wages = A.sales - A.cost - A.profit; const wpp = A.workers > 0 ? wages / A.workers : NaN; const nwp = A.normW / A.workers;
        if (process.env.LV) return `${String(Math.round(A.workers / nRuns / 1e3)).padStart(5)}k ${String(Math.round(A.levels / nRuns)).padStart(5)}lv ${(A.staffed / A.levels * 100).toFixed(0).padStart(3)}% ${(f(A.profit / (A.sales - A.profit) * 100, 0) + "%").padStart(4)}`;
        return `${String(Math.round(A.workers / nRuns / 1e3)).padStart(5)}k ${f(A.sales / A.vaout)} ${f(A.cost / A.vain)} ${(f(A.profit / (A.sales - A.profit) * 100, 0) + '%').padStart(4)} ${f(wpp / nwp)}`; });
      console.log(`  ${('e' + er.replace('C', '') + (er.startsWith('C') ? ' craft' : '')).padEnd(9)} ` + row.join(' │'));
    }
  }
  console.log(`  years: ${YEARS.join(' │ ')}   (cells: workers · out-price · in-price · margin · wage÷normal)`);
}
