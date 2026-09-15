// Rung 0 over time on one run: world building COUNT vs LEVELS for era-0 keys (new buildings vs expansions), and the rung-0 share
// of the PRIVATE and GOVERNMENT queues (items and points left) at each year. Args: <runDir> <cfg> [years...]
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [runDir, cfgPath, ...years] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const era = {}; for (const ind of cfg.industries) { if (ind.disabled) continue; for (const t of ind.tiers) era[t.key] = t.era; }
const dir = runDir + '/save_summaries';
const files = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).map(x => { const o = JSON.parse(gunzipSync(readFileSync(dir + '/' + x)).toString()); return { d: o.provenance.date, o }; });
let shownKeys = false;
for (const y of years) {
  const f = files.filter(o => o.d.startsWith(y + '.')).sort((a, b) => a.d.localeCompare(b.d))[0]; if (!f) { console.log(y, 'no summary'); continue; }
  const s = f.o; let cnt = 0, lv = 0, staffed = 0; const q = { private: { e0i: 0, i: 0, e0p: 0, p: 0 }, government: { e0i: 0, i: 0, e0p: 0, p: 0 } };
  for (const c of Object.values(s.countries)) {
    for (const [k, b] of Object.entries(c.buildings || {})) { if (era[k] !== 0) continue; if (!shownKeys) { console.log('building entry keys:', Object.keys(b).join(', ')); shownKeys = true; } cnt += b.n ?? b.count ?? 0; lv += b.levels ?? 0; staffed += b.staffing ?? 0; }
    for (const kind of ['private', 'government']) { const qq = c.queues && c.queues[kind] && c.queues[kind].by_type; if (!qq) continue; for (const [k, v] of Object.entries(qq)) { q[kind].i += v.n; q[kind].p += v.left; if (era[k] === 0) { q[kind].e0i += v.n; q[kind].e0p += v.left; } } }
  }
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
  console.log(`${s.provenance.date}: rung-0 buildings ${cnt}, levels ${lv}, staffed ${staffed.toFixed(0)} (${pct(staffed, lv)}) · private queue rung-0 ${pct(q.private.e0i, q.private.i)} of ${q.private.i} items (${pct(q.private.e0p, q.private.p)} of points) · government queue rung-0 ${pct(q.government.e0i, q.government.i)} of ${q.government.i} items (${pct(q.government.e0p, q.government.p)} of points)`);
}
