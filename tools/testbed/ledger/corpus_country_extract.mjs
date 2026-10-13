// A FEW COUNTRIES' YEARLY RECORD, PER RUN (FINDINGS F231, 2026-10-13 — the closed-major capital-abundance question after F229).
// For every run named, one JSON line: per year and per label, the country's GDP, population (strata), U* (unemployed + peasants ÷
// salaried + unemployed + peasants), strict unemployment, the investment pool, H (pool ÷ GDP), W (productive workers ÷ population)
// and the tag that stood for the label. Labels: GER = GER, else NGF, else PRU (user-ruled 2026-10-13: "GER > NGF > PRU"); the
// others are their own tag, plus UNL beside NET/BEL where it forms. Read-only.
// usage: node tools/testbed/ledger/corpus_country_extract.mjs <out.jsonl> <rel> [<rel> ...]   (rel = <session>/<run folder>)
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const SES = join(fileURLToPath(new URL('../../..', import.meta.url)), 'tools/testbed/sessions');
const LABELS = { GER: ['GER', 'NGF', 'PRU'], USA: ['USA'], FRA: ['FRA'], BEL: ['BEL'], NET: ['NET'], UNL: ['UNL'], RUS: ['RUS'] };
const [out, ...rels] = process.argv.slice(2);
function rec(c, tag) {
  const p = c.pop_statistics || {}; const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0,
    pe = (+p.population_subsisting_workforce || 0) * 1e5, pop = Object.values(c.strata || {}).reduce((a, b) => a + b, 0), gdp = +c.gdp || 0, pool = +c.investment_pool || 0;
  const prod = sal - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0);
  return { tag, gdp, pop, U: (sal + un + pe) ? (un + pe) / (sal + un + pe) : null, Us: (sal + un) ? un / (sal + un) : null,
    pe: (sal + un + pe) ? pe / (sal + un + pe) : null, pool, H: gdp ? pool / gdp : null, W: pop ? prod / pop : null };
}
for (const rel of rels) {
  const sd = join(SES, rel, 'save_summaries'); if (!existsSync(sd)) continue; const years = {};
  for (const fn of readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, fn))).toString('utf8')); } catch { continue; }
    const y = +String((j.provenance || {}).date || '').split('.')[0]; if (!y || years[y]) continue;
    const C = j.countries || {}; const row = { wgdp: +(j.world || {}).gdp || null };
    for (const [lab, cands] of Object.entries(LABELS)) { const t = cands.find(t => C[t]); if (t) row[lab] = rec(C[t], t); }
    years[y] = row;
  }
  appendFileSync(out, JSON.stringify({ rel, years }) + '\n'); process.stderr.write('.');
}
