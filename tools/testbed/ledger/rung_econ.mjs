// ⭐ PER-INDUSTRY PER-ERA RUNG ECONOMICS AT ONE DATE (FINDINGS F127, 2026-09-16): buildings, levels, staffed levels, value added per
// staffed level and per worker, margin = profit ÷ (VA − profit) (F92), each rung's share of its industry's staffed levels, and VA per
// worker ÷ the industry's frontier — the reading that put the found book's old rung at 1–5% of its frontier's value added per worker,
// and the realised-VA-per-level comparison behind F128 / F129 (the price channel on the frontier).
//   node tools/testbed/ledger/rung_econ.mjs <runDir> <config> <year>
// Moved from the 2026-09-16 session scratchpad on 2026-09-17 (a batch boundary; L27 walks this directory in every build).
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [runDir, cfgPath, year] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const meta = {}; for (const ind of cfg.industries) { if (ind.disabled) continue; for (const t of ind.tiers) meta[t.key] = { ind: ind.id, era: t.era, emp: Object.values(t.employment || {}).reduce((a, b) => a + b, 0) }; }
const dir = runDir + '/save_summaries';
const files = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).map(x => { const o = JSON.parse(gunzipSync(readFileSync(dir + '/' + x)).toString()); return { d: o.provenance.date, o }; });
const f = files.filter(o => o.d.startsWith(year + '.')).sort((a, b) => a.d.localeCompare(b.d))[0];
const agg = {};
for (const c of Object.values(f.o.countries)) for (const [k, b] of Object.entries(c.buildings || {})) {
  const m = meta[k]; if (!m) continue; const id = m.ind + '|' + m.era; const a = agg[id] ||= { ind: m.ind, era: m.era, emp: m.emp, n: 0, lv: 0, st: 0, out: 0, inn: 0, pr: 0 };
  a.n += b.n || 0; a.lv += b.levels || 0; a.st += b.staffing || 0; a.out += b.va_out || 0; a.inn += b.va_in || 0; a.pr += b.profit || 0;
}
const rows = Object.values(agg).sort((x, y) => x.ind.localeCompare(y.ind) || x.era - y.era);
const byInd = {}; for (const r of rows) (byInd[r.ind] ||= []).push(r);
console.log(f.d, 'ind era | bldgs levels staffed(%) | VA/staffed lvl  VA/worker(£/wk) | margin=profit/(VA-profit) | rung share of ind staffed | VA/worker ÷ frontier');
for (const [ind, rs] of Object.entries(byInd)) {
  const totSt = rs.reduce((s, r) => s + r.st, 0);
  const front = rs.filter(r => r.st > 20).sort((a, b) => b.era - a.era)[0];
  const vaw = r => r.st > 0 ? (r.out - r.inn) / r.st / r.emp : 0;
  for (const r of rs) {
    const va = r.out - r.inn, vpl = r.st > 0 ? va / r.st : 0, mg = (va - r.pr) > 0 ? r.pr / (va - r.pr) : NaN;
    console.log(`${ind.padEnd(11)} e${r.era} | ${String(r.n).padStart(5)} ${String(r.lv).padStart(6)} ${r.st.toFixed(0).padStart(6)} (${(100 * r.st / Math.max(1, r.lv)).toFixed(0).padStart(3)}%) | ${vpl.toFixed(0).padStart(8)} ${vaw(r).toFixed(3).padStart(8)} | ${(100 * mg).toFixed(0).padStart(5)}% | ${(100 * r.st / Math.max(1, totSt)).toFixed(1).padStart(5)}% | ${front ? (vaw(r) / vaw(front)).toFixed(2) : '—'}`);
  }
}
