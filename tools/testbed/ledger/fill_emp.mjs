// Tier employment by era, computed EXACTLY: staffed levels from the summaries x the config's own
// per-tier employment (workforce_mult applied, as the builder emits it). No proxy, no guesswork.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const cfg = JSON.parse(readFileSync('config/mod_config.canon_n7.json', 'utf8'));
const tier = {};                                  // key -> {era, empPerLevel}
for (const ind of cfg.industries || []) {
  for (const t of ind.tiers || []) {
    const wm = t.workforce_mult ?? 1;
    let e = 0;
    for (const v of Object.values(t.employment || {})) e += (+v || 0);
    tier[t.key] = { era: t.era ?? 0, emp: e * wm };
  }
}
const SES = 'tools/testbed/sessions';
const RUNS = [1,2,3,4,5,6].map(i => `20260818_221216_canon-n7/run00${i}_canonfull`);
const YEARS = [1840,1860,1880,1900,1920,1935];
const per = {};
for (const r of RUNS) {
  const dir = join(SES, r, 'save_summaries'); if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    if (!YEARS.includes(y)) continue;
    const eras = [0,0,0,0,0,0];
    for (const c of Object.values(j.countries))
      for (const [k, b] of Object.entries(c.buildings || {})) {
        const t = tier[k]; if (!t) continue;
        eras[t.era] += (b.staffing || 0) * t.emp;
      }
    (per[y] ||= []).push(eras);
  }
}
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const EMP = {};
for (const y of YEARS) if (per[y]) EMP[y] = [0,1,2,3,4,5].map(i => +(med(per[y].map(r => r[i])) / 1e6).toFixed(2));
writeFileSync(join(process.argv[2], 'emp.json'), JSON.stringify(EMP));
console.log('tier types:', Object.keys(tier).length);
for (const y of YEARS) if (EMP[y]) console.log(y, EMP[y].join(' / '), ' total', EMP[y].reduce((a,b)=>a+b,0).toFixed(1)+'M');
