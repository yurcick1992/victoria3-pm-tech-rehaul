// Can the savegame's own `base_wage` stand in for the telemetry wage measurement?
// The telemetry figure is per MARKET and pop-weighted; the save's base_wage is per COUNTRY. The save
// also carries each country's `market`, so the like-for-like comparison is a pop-weighted average of
// base_wage over the market's members.
import { readFileSync } from 'node:fs';
const S = process.argv[2];
const sv = JSON.parse(readFileSync(`${S}/cal_fresh_autosave_1.json`, 'utf8'));
const tel = JSON.parse(readFileSync('config/measured_1836.json', 'utf8')).markets;

const pop = c => { const p = c.pop_statistics || {}; return (p.population_lower_strata || 0) + (p.population_middle_strata || 0) + (p.population_upper_strata || 0); };
// group countries by market id
const byMarket = new Map();
for (const [tag, c] of Object.entries(sv.countries)) {
  if (c.market == null) continue;
  (byMarket.get(c.market) || byMarket.set(c.market, []).get(c.market)).push({ tag, bw: c.base_wage, pop: pop(c) });
}
// which market id holds a given lead tag
const leadMarket = tag => sv.countries[tag]?.market;

const f = (x, n = 4) => (Number.isFinite(x) ? x.toFixed(n) : '—');
const pad = (s, n) => String(s).padEnd(n); const p = (s, n) => String(s).padStart(n);

console.log(`save ${sv.provenance.date} · ${byMarket.size} markets\n`);
console.log(pad('market (lead)', 16) + p('members', 9) + p('lead bw', 10) + p('popwt bw', 10)
  + p('telemetry wk', 14) + p('ratio lead', 12) + p('ratio popwt', 13));
for (const [tag, mkt] of [['AUS', 'Austrian Market'], ['BEL', 'Belgian Market']]) {
  const mid = leadMarket(tag);
  const ms = byMarket.get(mid) || [];
  const tp = ms.reduce((a, m) => a + m.pop, 0) || 1;
  const wt = ms.reduce((a, m) => a + m.bw * m.pop, 0) / tp;
  const t = tel[mkt]?.wages?.base_weekly_wage;
  console.log(pad(`${mkt} (${tag})`, 16) + p(ms.length, 9) + p(f(sv.countries[tag].base_wage, 1), 10)
    + p(f(wt, 1), 10) + p(f(t, 6), 14) + p(f(sv.countries[tag].base_wage / t, 0), 12) + p(f(wt / t, 0), 13));
  console.log('    members: ' + ms.sort((a, b) => b.pop - a.pop).slice(0, 6)
    .map(m => `${m.tag} bw=${m.bw.toFixed(0)} pop=${(m.pop / 1e6).toFixed(1)}M`).join(' · '));
}
