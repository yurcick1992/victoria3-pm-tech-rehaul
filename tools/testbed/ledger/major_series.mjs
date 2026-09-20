// ⭐ THE PER-MAJOR SERIES the plateau test is read from (user-ruled 2026-09-16, CORRECTED 2026-09-17 — BALANCE_FRAMEWORK §10.82.1):
// per major and year, strict unemployment (unemployed ÷ (salaried + unemployed)), the peasants share of the workforce (subsisting ÷
// total) and the salaried workforce. A PLATEAU is CAPITAL ABUNDANCE PERSISTING at the frictional residual — total unemployment
// INCLUDING peasants ≤ 10% in EVERY year 1919 → 1935 while the pool exceeds 2 GDP in any of 1931–1935 — NOT slow depeasantation (a
// stall at 20% peasants is a development reading). capital_flags.mjs prints the verdict (PERSISTENT ABUNDANCE); this prints the
// columns behind it. Minors are not judged. Reads the yearly save summaries pop_statistics fields (the same ones
// capital_flags.mjs reads). Columns per year: strict unemp% / peasants% of workforce / salaried M.
//   node tools/testbed/ledger/major_series.mjs 1900,1910,1919,1925,1930,1935 <runDir> [<runDir>...]
// Written in the 2026-09-16 session scratchpad for F127 / §10.82; moved here between batches (L27 walks this directory in every build).
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [yearsArg, ...runDirs] = process.argv.slice(2);
const YEARS = yearsArg.split(',');
const TAGS = ['GBR', 'FRA', 'USA', 'PRU', 'NGF', 'GER', 'RUS', 'JAP', 'AUS', 'NET', 'BEL', 'UNL', 'SAR', 'ITA', 'SPA', 'TUR', 'SWE'];
const rd = c => { const p = c.pop_statistics || {}; const sal = p.population_salaried_workforce || 0, un = p.population_unemployed_workforce || 0, pe = (p.population_subsisting_workforce || 0) * 100000; return { sal, un, pe }; };
for (const runDir of runDirs) {
  const dir = runDir + '/save_summaries';
  const files = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).map(x => { const o = JSON.parse(gunzipSync(readFileSync(dir + '/' + x)).toString()); return { d: o.provenance.date, o }; });
  const byYear = {}; for (const y of YEARS) { const f = files.filter(o => o.d.startsWith(y + '.')).sort((a, b) => a.d.localeCompare(b.d))[0]; if (f) byYear[y] = f.o; }
  console.log('\n' + runDir.split('/').slice(-2).join('/') + '   columns per year: strict unemp% / peasants% of workforce / salaried M');
  for (const tag of TAGS) {
    const cells = YEARS.map(y => { const s = byYear[y]; const c = s && s.countries[tag]; if (!c) return '     -     '; const r = rd(c); const tot = r.sal + r.un + r.pe; if (!tot) return '     -     '; return (100 * r.un / (r.sal + r.un)).toFixed(1).padStart(4) + '/' + (100 * r.pe / tot).toFixed(0).padStart(2) + '/' + (r.sal / 1e6).toFixed(1).padStart(4); });
    if (cells.every(x => x.trim() === '-')) continue;
    console.log('  ' + tag.padEnd(4) + cells.join(' '));
  }
  // world
  const cells = YEARS.map(y => { const s = byYear[y]; if (!s) return '-'; let sal = 0, un = 0, pe = 0; for (const c of Object.values(s.countries)) { const r = rd(c); sal += r.sal; un += r.un; pe += r.pe; } return (100 * un / (sal + un)).toFixed(1).padStart(4) + '/' + (100 * pe / (sal + un + pe)).toFixed(0).padStart(2) + '/' + (sal / 1e6).toFixed(0).padStart(4); });
  console.log('  WORLD' + cells.join(' '));
}
console.log('\nyears: ' + YEARS.join('  '));
