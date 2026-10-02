// THE SIX CRAFTS OVER A CENTURY (promoted from the session scratchpad 2026-10-02; FINDINGS F209 quotes it): per run and year, the craft rungs
// (`craft: true`, BALANCE_FRAMEWORK §10.91.1) summed — levels, occupancy (staffed ÷ levels), workers (staffed × 500), the TRUE margin
// profit ÷ (sales − profit), and the wage they pay ÷ their countries' normal wage (exact wages = goods_sales − goods_cost − profit, v9+) —
// world-wide and in the register's shortlist pool (main records only). Each run's book is its own build_state's.
//   node tools/testbed/ledger/craft_path.mjs <session>[:<setup>] [years, default 1837,1840,1845,1850,1855,1860,1870,1880,1900,1920,1935]
import path from 'node:path'; import fs from 'node:fs';
import { indexRun, readSum, runsOf, firstOf } from './lib_sumidx.mjs';
import { POOL } from './lib_markets.mjs';
const [sess, setup] = (process.argv[2] || '').split(':');
if (!sess) { console.error('usage: craft_path.mjs <session>[:<setup>] [years]'); process.exit(1); }
const YEARS = (process.argv[3] || '1837,1840,1845,1850,1855,1860,1870,1880,1900,1920,1935').split(',').map(Number);
const POOLSET = new Set(POOL);
function z() { return { lv: 0, st: 0, pr: 0, sa: 0, co: 0, nw: 0 }; }
for (const r of runsOf(sess, setup || null)) {
  if (!fs.existsSync(path.join(r, 'meta.json'))) continue;
  const bs = JSON.parse(fs.readFileSync(path.join(r, 'build_state.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(bs.deterministic.mod_under_test?.built_from_config || bs.deterministic.built_from_config, 'utf8'));
  const crafts = {};
  for (const I of cfg.industries) { if (I.disabled) continue; for (const t of I.tiers || []) if (t.craft) crafts[t.key] = I.id; }
  if (!Object.keys(crafts).length) { console.log(`${path.basename(r)} — the book has no craft rungs`); continue; }
  const idx = indexRun(r);
  console.log(`${path.basename(r)} — the six crafts summed: levels · occupancy · workers (k) · true margin · wage ÷ normal   [world | pool]`);
  for (const y of YEARS) { const d = firstOf(idx, y); if (!d) continue; const j = readSum(idx[d]); const A = { w: z(), p: z() };
    for (const [ck, c] of Object.entries(j.countries || {})) { const tag = c.tag ?? ck.split('@')[0]; const nw = (+c.base_wage || 0) / 1e4;
      for (const [k, b] of Object.entries(c.buildings || {})) { if (!crafts[k]) continue; for (const s of ['w', ...(POOLSET.has(tag) && !ck.includes('@') ? ['p'] : [])]) { const X = A[s];
        X.lv += +b.levels || 0; X.st += +b.staffing || 0; X.pr += +b.profit || 0; X.sa += +b.goods_sales || 0; X.co += +b.goods_cost || 0; X.nw += (+b.staffing || 0) * 500 * nw; } } }
    const fmt = X => `${String(Math.round(X.lv)).padStart(5)} ${(X.st / X.lv * 100).toFixed(0).padStart(3)}% ${String(Math.round(X.st * 500 / 1e3)).padStart(5)}k ${(X.pr / (X.sa - X.pr) * 100).toFixed(0).padStart(3)}% ${((X.sa - X.co - X.pr) / X.nw).toFixed(2)}`;
    console.log(`  ${d.padEnd(10)} ${fmt(A.w)}  |  ${fmt(A.p)}`); }
}
