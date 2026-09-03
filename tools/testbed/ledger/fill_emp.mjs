// Tier employment by era, computed EXACTLY: staffed levels from the summaries x the config's own
// per-tier employment (workforce_mult applied, as the builder emits it). No proxy, no guesswork.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
// ⭐⭐ ERA-COUNT AGNOSTIC (2026-08-31). The ledger serves TWO semi-canonical books now — the six-rung
//   canonical one and the four-rung vanilla-ladder arm — so nothing here may assume six eras or a
//   particular config. The arm's OWN config comes in on `--config`; the era count is derived from it.
//   ⚠ Hardcoding `config/mod_config.canon_n7.json` and `[0,0,0,0,0,0]` produced a report claiming
//   `topEra: 5` for a book whose top rung is 3, with two empty era buckets and every tier4-only
//   building unresolved. A panel that is wrong is worse than one that is absent.
const CFGP = (() => { const i = process.argv.indexOf('--config'); return i > 0 && process.argv[i+1] ? process.argv[i+1] : 'config/mod_config.canon_n7.json'; })();
const cfg = JSON.parse(readFileSync(CFGP, 'utf8'));
// the era count IS the config's, never a literal
const NERA = Math.max(...cfg.industries.filter(i => !i.disabled).flatMap(i => (i.tiers||[]).map(t => t.era ?? 0))) + 1;
const ERAS = Array.from({length: NERA}, (_, i) => i);
const tier = {};                                  // key -> {era, empPerLevel}
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;   // ⚠ a DISABLED industry (port/shipyard/railway/power on the four-rung books) keeps its tiers in the config and its rung-0 KEY IS THE VANILLA BUILDING — counting it put Britain's shipyards and ports into "e0" (BUGS_AND_FIXES 2026-09-03)
  for (const t of ind.tiers || []) {
    const wm = t.workforce_mult ?? 1;
    let e = 0;
    for (const v of Object.values(t.employment || {})) e += (+v || 0);
    tier[t.key] = { era: t.era ?? 0, emp: e * wm };
  }
}
const SES = 'tools/testbed/sessions';
// ⚠⚠ --mod IS REQUIRED. This used to hardcode canon-n7 while accepting other flags, so a fill for
//   ANY other batch silently reported canon-n7’s numbers under the new batch’s title — the tier employment-by-era table
//   came from the wrong world. Found 2026-09-01 by a census after the same defect turned up in
//   fill_consts and fill_payback: when a tool is parameterised, sweep it for EVERY hardcoded
//   session, not just the one that prompted the change.
const RUNS = (() => {
  const i = process.argv.indexOf('--mod');
  if (i > 0 && process.argv[i+1]) return process.argv[i+1].split(',').map(s => s.trim()).filter(Boolean);
  throw new Error('fill_emp.mjs: --mod <sess/run[,...]> is REQUIRED (it used to default to canon-n7 and '
    + "report that batch numbers under whatever title it was given).");
})();
const YEARS = [1840,1860,1880,1900,1920,1935];
const per = {};
for (const r of RUNS) {
  const dir = join(SES, r, 'save_summaries'); if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    if (!YEARS.includes(y)) continue;
    const eras = new Array(NERA).fill(0);
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
for (const y of YEARS) if (per[y]) EMP[y] = ERAS.map(i => +(med(per[y].map(r => r[i])) / 1e6).toFixed(2));
writeFileSync(join(process.argv[2], 'emp.json'), JSON.stringify(EMP));
console.log('tier types:', Object.keys(tier).length);
for (const y of YEARS) if (EMP[y]) console.log(y, EMP[y].join(' / '), ' total', EMP[y].reduce((a,b)=>a+b,0).toFixed(1)+'M');
