// THE UNITED STATES' CENTURY, PER RUN — the political history a reading of "the USA is agrarian" has to be checked against before it is read as
// economics (2026-10-03, written for the user's questions on F210: "Did the Mexican-American war happen more or less historically in all of the
// runs (litmus test: is California American in 1886?) Did the ACW happen?").
// Per usable run (lib_runs), from the run's own events.tsv:
//   · the 1836 Texas revolt — crushed (CAPIT Texas) or won (a TEX country in an early summary), and the year the USA holds Texas land;
//   · every diplomatic play between the USA and Mexico, and every capitulation of Mexico;
//   · every secession or revolution the USA faced: the uprising's name from the same-day play (secessions name their side, e.g. "Confederate
//     Uprising", "New African Uprising" — New Africa is the afro_american secession, tag ASA, capital Georgia), the winner from the first
//     CIVILWARWON of the USA, the CSA or New Africa within six years (on_civil_war_won's root is the winner; it fires for every country, which
//     is why the side filter is needed);
// and from the save summaries (`states` map, v8+): the first year an American owns any of California, the owners of the Mexican cession at 1886,
// the Confederacy's lifetime as a country, and the USA's GDP ÷ vanilla's median USA GDP with its U* (criteria.mjs's definition) along the century.
//   node tools/testbed/ledger/us_history.mjs <label>=<session>[:<setup>] [...]
// A label "van" (a vanilla session) sets the GDP denominator; without one the GDP ratios are left out. Reading every yearly summary of a 16-run
// session takes about a minute.
import fs from 'node:fs'; import path from 'node:path';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { indexRun, firstOf, readSum, SESSIONS, med } from './lib_sumidx.mjs';
const PATH_YEARS = [1840, 1845, 1850, 1855, 1860, 1865, 1870, 1875, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
const CESSION = ['STATE_CALIFORNIA', 'STATE_TEXAS', 'STATE_NEW_MEXICO', 'STATE_ARIZONA', 'STATE_NEVADA', 'STATE_UTAH'];
const SHORT = { STATE_CALIFORNIA: 'CA', STATE_TEXAS: 'TX', STATE_NEW_MEXICO: 'NM', STATE_ARIZONA: 'AZ', STATE_NEVADA: 'NV', STATE_UTAH: 'UT' };
const tagOf = k => String(k || '?').split('@')[0];
const isUS = n => /^United States/.test(n || '');
const yr = d => +(String(d || '').match(/(\d{4})/) || [])[1];
const pop = c => Object.values(c?.strata || {}).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);
const ustar = c => { const p = c?.pop_statistics || {}; const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5; return (un + pe) / (sal + un + pe); };
const args = process.argv.slice(2);
if (!args.length) { console.error('usage: us_history.mjs <label>=<session>[:<setup>] [...]  (label "van" = the GDP denominator)'); process.exit(1); }
const rows = [], dropped = [];
for (const arg of args) {
  const [label, spec] = arg.includes('=') ? arg.split('=') : [arg.split('_').pop(), arg]; const [sess, setup] = spec.split(':');
  const u = usableRuns(SESSIONS, sess, setup || ''); dropped.push(...u.dropped);
  for (const rel of u.runs) {
    const dir = path.join(SESSIONS, rel); const idx = indexRun(dir);
    // pooled sessions share run numbers, so a pooled arm names each run by its session's time stamp too (e.g. 2357/run001)
    const runName = (sess.includes(',') ? rel.slice(9, 13) + '/' : '') + rel.split('/')[1].replace(/_.*/, '');
    const r = { label, run: runName, caUS: null, txUS: null, tex: false, csa: [], asa: [], cess1886: {}, gdp: {}, u: {}, pop: {}, end: null };
    for (let y = 1836; y <= 1936; y++) {
      const f = firstOf(idx, y); if (!f) continue; const s = readSum(idx[f]);
      const own = {}; for (const st of Object.values(s.states || {})) if (SHORT[st.region]) (own[st.region] ||= new Set()).add(tagOf(st.country));
      if (r.caUS === null && own.STATE_CALIFORNIA?.has('USA')) r.caUS = y;
      if (r.txUS === null && own.STATE_TEXAS?.has('USA')) r.txUS = y;
      if (y <= 1846 && s.countries?.TEX) r.tex = true;
      if (Object.keys(s.countries || {}).some(k => tagOf(k) === 'CSA')) r.csa.push(y);
      if (Object.keys(s.countries || {}).some(k => tagOf(k) === 'ASA')) r.asa.push(y);
      if (y === 1886) r.cess1886 = own;
      if (PATH_YEARS.includes(y) && s.countries?.USA) { r.gdp[y] = s.countries.USA.gdp; r.u[y] = ustar(s.countries.USA); r.pop[y] = pop(s.countries.USA); }
      if (y === 1935) r.end = { us: pop(s.countries?.USA), csa: pop(s.countries?.CSA) };
    }
    const ef = path.join(dir, 'events.tsv');
    const ev = fs.existsSync(ef) ? fs.readFileSync(ef, 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(l => l.split('\t')) : [];
    r.events = ev.length > 0;
    const tCap = ev.find(e => e[1] === 'CAPIT' && e[2] === 'Texas' && yr(e[3]) <= 1846);
    r.texas = tCap ? `crushed by Mexico ${yr(tCap[3])}` : r.tex ? `Texas won${r.txUS ? `, American land from ${r.txUS}` : ''}` : (ev.some(e => e[1] === 'DIPPLAY' && e[2] === 'Texas') ? 'no outcome logged' : 'no revolt logged');
    r.usmex = ev.filter(e => e[1] === 'DIPPLAY' && ((isUS(e[2]) && e[3] === 'Mexico') || (e[2] === 'Mexico' && isUS(e[3])))).map(e => `${isUS(e[2]) ? 'US→MEX' : 'MEX→US'} ${yr(e[4])}`);
    r.mexCap = ev.filter(e => e[1] === 'CAPIT' && e[2] === 'Mexico').map(e => yr(e[3]));
    r.cw = [];
    ev.forEach((e, i) => {
      if ((e[1] !== 'SECESSION' && e[1] !== 'REVOLT') || !isUS(e[2])) return;
      const play = ev.find(p => p[1] === 'DIPPLAY' && isUS(p[3]) && p[4] === e[3] && /Uprising|Revolt|Revolution|Rising|Revolutionary/.test(p[2]));
      // the uprising's side is matched on its adjective ('Confederate' -> Confederate States of America, 'New African' -> New Africa)
      const adj = play ? play[2].replace(/ (Uprising|Revolt|Rising)$/, '') : '', stem = adj.length > 6 ? adj.slice(0, adj.length - 2) : adj;
      r.cw.push({ kind: e[1] === 'SECESSION' ? 'secession' : 'revolution', name: play ? play[2] : '?', start: yr(e[3]), at: i, stem, winner: null, end: null });
    });
    // Winners, in two passes, because secessions can run at the same time (e1a12 run 1: a Mexican and a New African uprising a week apart in
    // 1890, won by the USA and by New Africa a day apart in 1891): first each uprising side's OWN win goes to its latest open secession, then each
    // win of the USA to the earliest secession still open. A secession is open from its line to six years on.
    const open = (c, i, d) => c.winner === null && c.at < i && d >= c.start && d <= c.start + 6;
    const wins = ev.map((p, i) => [p, i]).filter(([p]) => p[1] === 'CIVILWARWON');
    for (const [p, i] of wins) { if (isUS(p[2])) continue; const c = r.cw.filter(c => c.stem && p[2].startsWith(c.stem) && open(c, i, yr(p[3]))).pop(); if (c) { c.winner = p[2].replace('Confederate States of America', 'CSA'); c.end = yr(p[3]); } }
    for (const [p, i] of wins) { if (!isUS(p[2])) continue; const c = r.cw.find(c => open(c, i, yr(p[3]))); if (c) { c.winner = 'USA'; c.end = yr(p[3]); } }
    // the USA's own defeats and defaults: a capitulation (it lost a war) and a declared bankruptcy (the modifier poll, TESTBED_METRICS)
    r.capit = ev.filter(e => e[1] === 'CAPIT' && isUS(e[2])).map(e => yr(e[3]));
    r.bankrupt = ev.filter(e => e[1] === 'BANKRUPTCY' && isUS(e[2])).map(e => yr(e[3]));
    rows.push(r);
  }
}
const van = rows.filter(r => r.label === 'van'); const vg = {}, vu = {}, vp = {}, vpc = {};
for (const y of PATH_YEARS) { vg[y] = med(van.map(r => r.gdp[y])); vu[y] = med(van.map(r => r.u[y])); vp[y] = med(van.map(r => r.pop[y])); vpc[y] = med(van.map(r => r.gdp[y] / r.pop[y])); }
const span = a => a.length ? `${a[0]}–${a[a.length - 1]}${a.length < a[a.length - 1] - a[0] + 1 ? ` (${a.length} yearly summaries)` : ''}` : 'never';
for (const r of rows) {
  console.log(`${r.label} ${r.run}: California first American ${r.caUS ?? 'NEVER'} · Texas revolt ${r.texas} · US–Mexico plays ${r.usmex.join(', ') || 'none'} (Mexico capitulated ${r.mexCap.join(', ') || 'never'})`);
  console.log(`    civil wars of the USA: ${r.cw.map(c => `${c.kind} "${c.name}" ${c.start} → ${c.winner ? c.winner + ' won ' + c.end : 'no winner logged'}`).join('; ') || 'none'}${r.events ? '' : ' (no events.tsv)'} · the CSA a country ${span(r.csa)} · New Africa ${span(r.asa)}`);
  console.log(`    the USA capitulated ${r.capit.join(', ') || 'never'} · bankrupt ${r.bankrupt.join(', ') || 'never'}`);
  console.log(`    1886 owners: ${CESSION.map(g => `${SHORT[g]} ${r.cess1886[g] ? [...r.cess1886[g]].join('+') : '-'}`).join(' ')}` + (r.end ? ` · 1935 population: USA ${(r.end.us / 1e6).toFixed(1)}M${r.end.csa ? `, CSA ${(r.end.csa / 1e6).toFixed(1)}M` : ''}` : ''));
}
if (van.length) {
  console.log(`\nTHE USA'S PATH: GDP ÷ vanilla's median USA GDP (n=${van.length}), and U* in brackets`);
  console.log('arm    run     ' + PATH_YEARS.map(y => String(y).padEnd(13)).join(''));
  console.log('van    median  ' + PATH_YEARS.map(y => (`1.00 (${(100 * vu[y]).toFixed(0)}%)`).padEnd(13)).join(''));
  for (const r of rows.filter(r => r.label !== 'van')) console.log(`${r.label.padEnd(6)} ${r.run.padEnd(7)} ` + PATH_YEARS.map(y => (r.gdp[y] ? `${(r.gdp[y] / vg[y]).toFixed(2)} (${(100 * r.u[y]).toFixed(0)}%)` : '-').padEnd(13)).join(''));
  // the same path split into territory and development: population ÷ vanilla's median population, and GDP per head ÷ vanilla's median per head
  const table = (title, val) => {
    console.log('\n' + title); console.log('arm    run     ' + PATH_YEARS.map(y => String(y).padEnd(6)).join(''));
    const labels = [...new Set(rows.map(r => r.label))].filter(l => l !== 'van');
    for (const l of labels) {
      const g = rows.filter(r => r.label === l);
      for (const r of g) console.log(`${l.padEnd(6)} ${r.run.padEnd(7)} ` + PATH_YEARS.map(y => { const v = val(r, y); return (Number.isFinite(v) ? v.toFixed(2) : '-').padEnd(6); }).join(''));
      console.log(`${l.padEnd(6)} median  ` + PATH_YEARS.map(y => { const v = med(g.map(r => val(r, y))); return (Number.isFinite(v) ? v.toFixed(2) : '-').padEnd(6); }).join(''));
    }
  };
  table("POPULATION ÷ vanilla's median USA population", (r, y) => r.pop[y] / vp[y]);
  table("GDP PER HEAD ÷ vanilla's median USA GDP per head", (r, y) => (r.gdp[y] / r.pop[y]) / vpc[y]);
  table("GDP ÷ vanilla's median USA GDP (finer years)", (r, y) => r.gdp[y] / vg[y]);
  console.log('vanilla seeds with a Confederacy at 1935: ' + van.filter(r => r.csa.includes(1935)).map(r => `${r.run} ${(r.gdp[1935] / vg[1935]).toFixed(2)} (${(100 * r.u[1935]).toFixed(0)}%)`).join(', '));
}
console.log('\nTALLY');
for (const l of [...new Set(rows.map(r => r.label))]) {
  const g = rows.filter(r => r.label === l);
  const ca = g.filter(r => r.caUS && r.caUS <= 1886).length, conf = g.filter(r => r.cw.some(c => /^Confederate/.test(c.name))).length;
  const by1900 = g.filter(r => r.cw.some(c => /^Confederate/.test(c.name) && c.winner === 'CSA' && c.end <= 1900)).length, at1936 = g.filter(r => r.csa.includes(1936)).length, crushed = g.filter(r => /crushed/.test(r.texas)).length;
  const bk = g.filter(r => r.bankrupt.some(y => y < 1890)).length, cap = g.filter(r => r.capit.length).length;
  console.log(`  ${l} n=${g.length}: California American by 1886 in ${ca} · Texas revolt crushed in ${crushed} · a Confederate secession in ${conf} · the CSA won its independence by 1900 in ${by1900} and is a country at 1936 in ${at1936} · the USA bankrupt before 1890 in ${bk}, ever capitulated in ${cap}`);
}
reportDropped(dropped);
