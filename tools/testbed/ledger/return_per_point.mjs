// PROFIT PER CONSTRUCTION POINT, PER BUILDING TYPE, BESIDE ITS AI DESIRE (2026-10-03, FINDINGS F211) — does the investment AI's desire track
// what a building actually returns on the capital it costs? Per building type, in the shortlist pool (main records) or the world, at one year:
// Σ profit ÷ Σ staffed levels (the summary's own `profit`, £ a week, i.e. revenue − inputs − wages before dividends) ÷ the type's
// construction points (a rung's `building_cost` from the run's own book, else vanilla's `required_construction`), MEDIAN over the arm's
// usable runs; the payback at a flat £600 a point (the iron-frame rate is £720, steel £540 — F53); the type's ai_value from the book;
// and its staffed levels. Types with under 5 staffed levels (median) are left out. ⚠ Merge hosts are one building type: their profit and
// levels include every main method they run. ⚠ Profit per STAFFED level is what a new, staffed level would earn at that year's prices — the
// same reading misplaced_capital.mjs builds its payback from, without its validity rule (free deposits, labour) or its per-country £/point.
//   node tools/testbed/ledger/return_per_point.mjs [--year 1935] [--scope pool|world] [--filter <regex>] <label>=<session>[:<setup>] [...]
import fs from 'node:fs'; import path from 'node:path';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { indexRun, firstOf, readSum, SESSIONS, med } from './lib_sumidx.mjs';
import { POOL as POOL_LIST } from './lib_markets.mjs';
import { requiredConstruction } from '../../vanilla_construction.mjs';
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const YEAR = +opt('--year', '1935'), SCOPE = opt('--scope', 'pool'), FILTER = opt('--filter', null);
if (!argv.length) { console.error('usage: return_per_point.mjs [--year Y] [--scope pool|world] [--filter re] <label>=<session>[:<setup>] […]'); process.exit(1); }
const POOL = new Set(POOL_LIST); const RC = requiredConstruction(); const dropped = [];
for (const arg of argv) {
  const [label, spec] = arg.split('='); const [sess, setup] = spec.split(':'); const u = usableRuns(SESSIONS, sess, setup || ''); dropped.push(...u.dropped);
  const per = {};
  for (const rel of u.runs) {
    const dir = path.join(SESSIONS, rel); let cfg = { industries: [] };
    try { const bs = JSON.parse(fs.readFileSync(path.join(dir, 'build_state.json'), 'utf8').replace(/^﻿/, '')); const cp = bs.deterministic?.mod_under_test?.built_from_config; if (cp && fs.existsSync(cp)) cfg = JSON.parse(fs.readFileSync(cp, 'utf8').replace(/^﻿/, '')); } catch {}
    const tier = {}; for (const I of cfg.industries || []) { if (I.disabled) continue; for (const t of I.tiers) if (!t.method_of) tier[t.key] = { cost: t.building_cost, ai: t.ai_value, era: t.era }; }
    const idx = indexRun(dir); const f = firstOf(idx, YEAR); if (!f) continue; const s = readSum(idx[f]); const acc = {};
    for (const [key, c] of Object.entries(s.countries)) { if (key.includes('@')) continue; if (SCOPE === 'pool' && !POOL.has(key)) continue;
      for (const [k, b] of Object.entries(c.buildings || {})) { const a = (acc[k] ||= { st: 0, profit: 0 }); a.st += b.staffing || 0; a.profit += b.profit || 0; } }
    for (const [k, a] of Object.entries(acc)) { if (a.st < 3) continue; const cost = tier[k]?.cost ?? RC[k]; if (!cost) continue;
      (per[k] ||= { r: [], st: [], cost, ai: tier[k]?.ai ?? cfg.building_ai_value?.[k] ?? null, era: tier[k]?.era }); per[k].r.push(a.profit / a.st / cost); per[k].st.push(a.st); }
  }
  const rows = Object.entries(per).map(([k, p]) => ({ k, r: med(p.r), st: med(p.st), cost: p.cost, ai: p.ai, era: p.era })).filter(x => x.st >= 5 && (!FILTER || new RegExp(FILTER).test(x.k))).sort((a, b) => b.r - a.r);
  console.log(`\n${label} ${YEAR} ${SCOPE}: £ profit per staffed level per week ÷ construction points (median of ${u.runs.length} runs) · payback at £600 a point · cost · ai_value · staffed levels`);
  for (const x of rows) console.log(`  ${x.k.replace('building_', '').padEnd(46)} ${x.r.toFixed(2).padStart(6)} £/wk/pt · ${(600 / (x.r * 52)).toFixed(1).padStart(5)} y · ${String(x.cost).padStart(5)} pt · ai ${String(x.ai ?? '-').padStart(6)} · ${x.st.toFixed(0).padStart(5)} staffed${x.era != null ? ' · e' + x.era : ''}`);
}
reportDropped(dropped);
