// Britain's U* (unemployed + peasants ÷ workforce, criteria.mjs's definition) and its hoard (investment pool ÷ GDP) at
// 1926.1.1 / 1931.1.1 / 1936.1.1, per usable run, beside vanilla n=16's medians.  (user-asked 2026-09-25)
//   node tools/testbed/ledger/country_ustar_hoard.mjs --arm <session>:<setup>[:<label>] [--arm …] [--tag GBR]
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul'; const SES = REPO + '/tools/testbed/sessions';
const { usableRuns } = await import(pathToFileURL(REPO + '/tools/testbed/ledger/lib_runs.mjs').href);
const argv = process.argv.slice(2); const TAG = argv.includes('--tag') ? argv[argv.indexOf('--tag') + 1] : 'GBR';
const ARMS = argv.flatMap((a, i) => a === '--arm' ? [argv[i + 1]] : []).map(s => { const [session, setup, label] = s.split(':'); return { session, setup, label: label || setup }; });
const YEARS = [1926, 1931, 1936];
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
function read(runDir) {
  const sd = path.join(runDir, 'save_summaries'); const out = {};
  const files = fs.readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort();
  for (const y of YEARS) {   // the index prefix is roughly the year − 1836; read a few around it and trust only provenance.date
    const idx = y - 1836; const cand = files.filter(f => { const n = +f.slice(0, 4); return n >= idx - 1 && n <= idx + 3; });
    for (const f of cand) { let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f)))); } catch { continue; }
      if (j.provenance?.date !== `${y}.1.1`) continue; const c = j.countries[TAG]; if (!c) break; const p = c.pop_statistics || {};
      const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
      out[y] = { u: (un + pe) / (sal + un + pe), h: (+c.investment_pool || 0) / (+c.gdp || NaN), gdp: +c.gdp }; break; } }
  return out;
}
const pc = x => Number.isFinite(x) ? (100 * x).toFixed(1).padStart(5) + '%' : '    —'; const f2 = x => Number.isFinite(x) ? x.toFixed(2).padStart(5) : '    —';
const V = usableRuns(SES, '20260821_131149_vanilla-baseline-n16').runs.map(r => read(path.join(SES, r)));
console.log(`${TAG}: U* (unemployed + peasants ÷ workforce) and hoard (investment pool ÷ GDP), at ${YEARS.join(' / ')}`);
console.log('run'.padEnd(34) + YEARS.map(y => `   U* ${y}  H ${y}`).join(''));
console.log('vanilla n=16 median'.padEnd(34) + YEARS.map(y => `  ${pc(med(V.map(v => v[y]?.u)))}  ${f2(med(V.map(v => v[y]?.h)))}`).join(''));
for (const A of ARMS) for (const rel of usableRuns(SES, A.session, A.setup).runs) { const r = read(path.join(SES, rel));
  console.log(`${A.label} ${rel.split('/')[1].slice(0, 6)}`.padEnd(34) + YEARS.map(y => `  ${pc(r[y]?.u)}  ${f2(r[y]?.h)}`).join('')); }
