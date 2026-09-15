// Which rungs does the PRIVATE queue carry at a year, on a run? Sums queues.private.by_type over the world and the shortlist,
// classifies each building key by its era in the config (rung 0 / 1 / 2 / 3 / untiered), prints levels-in-queue shares.
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [runDir, year, cfgPath] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const era = {}; for (const ind of cfg.industries) { if (ind.disabled) continue; for (const t of ind.tiers) era[t.key] = t.era; }
const dir = runDir + '/save_summaries';
const f = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).map(x => ({ x, d: (o => o.date || (o.provenance && (o.provenance.date || o.provenance.game_date)) || (o.world && o.world.date) || '')(JSON.parse(gunzipSync(readFileSync(dir + '/' + x)).toString())) })).filter(o => o.d.startsWith(year + '.')).sort((a, b) => a.d.localeCompare(b.d))[0];
if (!f) { console.log('no summary at', year); process.exit(0); }
const s = JSON.parse(gunzipSync(readFileSync(dir + '/' + f.x)).toString());
const SHORT = new Set(['GBR', 'USA', 'FRA', 'GER', 'PRU']);
const tally = (tags) => { const acc = { e0: 0, e1: 0, e2: 0, e3: 0, untiered: 0, total: 0 }; const top = {}; for (const [tag, c] of Object.entries(s.countries || {})) { if (tags && !tags.has(tag)) continue; const q = c.queues && c.queues.private && c.queues.private.by_type; if (!q) continue; for (const [k, v] of Object.entries(q)) { const n = typeof v === 'number' ? v : (v.n ?? v.count ?? v.levels ?? 0); const e = era[k]; const cls = e == null ? 'untiered' : 'e' + e; acc[cls] += n; acc.total += n; top[k] = (top[k] || 0) + n; } } return { acc, top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 8) }; };
const one = (label, tags) => { const { acc, top } = tally(tags); const pct = k => acc.total ? (100 * acc[k] / acc.total).toFixed(1) + '%' : '—'; console.log(`${label} @ ${s.date || (s.provenance && (s.provenance.date || s.provenance.game_date)) || (s.world && s.world.date)}: private queue items ${acc.total} — rung 0 ${pct('e0')} · e1 ${pct('e1')} · e2 ${pct('e2')} · e3 ${pct('e3')} · untiered ${pct('untiered')}`); console.log('   top keys: ' + top.map(([k, n]) => `${k}${era[k] != null ? '(e' + era[k] + ')' : ''} ${n}`).join(', ')); };
one('WORLD', null); one('SHORTLIST', SHORT);
