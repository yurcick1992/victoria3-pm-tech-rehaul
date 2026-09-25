// BRITAIN'S YEARLY RECORD, PER RUN (FINDINGS F166, 2026-09-26 — the stuck-Britain runs of F165 §4). For every run in the
// corpus written by corpus_extract.mjs, one JSON line: per year, GBR's government, money, credit, investment pool, GDP,
// population, peasants / laborers / machinists, U*, bankruptcy date, owned states and the regions they sit in, the
// construction queues, budget income/expense, SoL, literacy, technologies held, and laws where the summary carries them
// (save summary v11+). Read-only.   node tools/testbed/ledger/corpus_gbr_extract.mjs <out.jsonl> <rel> [<rel> ...]
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const SES = join(fileURLToPath(new URL('../../..', import.meta.url)), 'tools/testbed/sessions');
const [out, ...rels] = process.argv.slice(2);
for (const rel of rels) {
  const sd = join(SES, rel, 'save_summaries'); if (!existsSync(sd)) continue; const years = {};
  for (const fn of readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, fn))).toString('utf8')); } catch { continue; }
    const y = +String((j.provenance || {}).date || '').split('.')[0]; if (!y || years[y]) continue;
    const g = (j.countries || {}).GBR; if (!g) { years[y] = { gone: true }; continue; }
    const p = g.pop_statistics || {}; const w = g.workforce_by_profession || {};
    const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
    const regions = {}; let states = 0; for (const s of Object.values(j.states || {})) if (s.country === 'GBR') { states++; regions[s.region] = 1; }
    const q = g.queues || {}; const bud = g.building_budget || {};
    years[y] = { gov: g.government, money: g.money, credit: g.credit, pool: g.investment_pool, gdp: g.gdp, pop: Object.values(g.strata || {}).reduce((a, b) => a + b, 0),
      U: (sal + un + pe) ? (un + pe) / (sal + un + pe) : null, pe: w.peasants || 0, lab: w.laborers || 0, mach: w.machinists || 0, eng: w.engineers || 0,
      bank: g.last_bankruptcy_date || null, states, regions: Object.keys(regions), qg: (q.government || {}).left || 0, qp: (q.private || {}).left || 0,
      inc: bud.income, exp: bud.expense, sol: g.avg_sol, lit: g.literacy, tech: (g.technologies_held || []).length, overlord: g.overlord,
      laws: g.laws || null, cons: ((g.buildings || {}).building_construction_sector || {}).levels || 0 };
  }
  appendFileSync(out, JSON.stringify({ rel, years }) + '\n'); process.stderr.write('.');
}
