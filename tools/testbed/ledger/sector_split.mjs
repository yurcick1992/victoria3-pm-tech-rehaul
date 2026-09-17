// ⭐ THE SECTOR SPLIT (FINDINGS F127, 2026-09-16): world building value added and staffing at one date, split into the tiered eras
// (the config's keys, by era) and the untiered sectors by key pattern — agriculture, extraction (mines, logging, oil, rubber, fishing,
// whaling), urban centres + infrastructure, construction, subsistence, state/ownership, military — plus the shortlist's rung-0 workers.
// The reading behind F127 (the found book's tiered sector at 72% of building VA against vanilla's 32%; extraction at 59–63% of vanilla's
// levels) and the KEY-1 raw-pull predictions of the B/A-axis batches.
//   node tools/testbed/ledger/sector_split.mjs <config> <year> <runDir> [<runDir>...]
// Moved from the 2026-09-16 session scratchpad on 2026-09-17 (a batch boundary; L27 walks this directory in every build).
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [cfgPath, year, ...runDirs] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const tier = {}; for (const ind of cfg.industries) { if (ind.disabled) continue; for (const t of ind.tiers) tier[t.key] = t.era; }
const grp = k => k in tier ? 'tiered e' + tier[k] : /farm|plantation|ranch|orchard|vineyard/.test(k) ? 'agriculture' : /_mine|logging|oil_rig|rubber|fishing|whaling|gold_field/.test(k) ? 'extraction' : /subsistence/.test(k) ? 'subsistence' : /urban_center|trade_center|port|railway|power_plant/.test(k) ? 'urban+infra' : /construction/.test(k) ? 'construction' : /barracks|conscription|naval_base|military|arms|artillery|munition|explosives/.test(k) ? 'military/other' : /government|university|financial|manor|company/.test(k) ? 'state/ownership' : 'other';
for (const runDir of runDirs) {
  const dir = runDir + '/save_summaries';
  const files = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).map(x => { const o = JSON.parse(gunzipSync(readFileSync(dir + '/' + x)).toString()); return { d: o.provenance.date, o }; });
  const f = files.filter(o => o.d.startsWith(year + '.')).sort((a, b) => a.d.localeCompare(b.d))[0]; if (!f) continue;
  const g = {}; let gdp = 0, wk = null; const shortlist = new Set(['GBR', 'USA', 'FRA', 'GER', 'NGF', 'PRU']); let slE0 = 0;
  for (const [tag, c] of Object.entries(f.o.countries)) {
    gdp += c.gdp || 0; if (!wk) wk = Object.keys(c.workforce_by_profession || {});
    for (const [k, b] of Object.entries(c.buildings || {})) { const x = g[grp(k)] ||= { lv: 0, st: 0, va: 0, n: 0 }; x.lv += b.levels || 0; x.st += b.staffing || 0; x.va += (b.va_out || 0) - (b.va_in || 0); x.n += b.n || 0; if (tier[k] === 0 && shortlist.has(tag)) slE0 += (b.staffing || 0) * 5000; }
  }
  const tot = Object.values(g).reduce((s, x) => s + x.va, 0);
  console.log('\n' + runDir.split('/').slice(-2).join('/'), f.d, 'GDP £' + (gdp / 1e6).toFixed(0) + 'M', '| Σ building VA ×52 = £' + (tot * 52 / 1e6).toFixed(0) + 'M', '| shortlist rung-0 workers (×5000/level) ' + (slE0 / 1e6).toFixed(2) + 'M');
  console.log('workforce keys:', wk.join(' '));
  for (const [k, x] of Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${k.padEnd(16)} levels ${String(x.lv).padStart(7)} staffed ${x.st.toFixed(0).padStart(7)} (${(100 * x.st / Math.max(1, x.lv)).toFixed(0).padStart(3)}%)  VA £${(x.va / 1e3).toFixed(0).padStart(6)}k/wk = ${(100 * x.va / tot).toFixed(1).padStart(5)}% of building VA`);
}
