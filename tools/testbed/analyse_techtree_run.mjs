// THE READER FOR THE FULL-LENGTH TECH-TREE BATCH (ROADMAP step 4, first pass).
//
//   node tools/testbed/analyse_techtree_run.mjs tools/testbed/sessions/<stamp>
//
// Answers the four questions the batch was launched for: GDP sizes, the technology picture by decade,
// whether a century is stable, and wall clock.
//
// ⚠ WHAT THIS CANNOT ANSWER, and it matters: ROADMAP step 4's sharpest criterion is that runners-up
// should hold "drastically fewer engineers, machinists and capitalists". Telemetry v11's `population`
// metric carries workforce TOTALS (total / peasants / slaves / dependents / unemployment) and **no
// per-profession split**, so that criterion needs a metric we do not have yet. Do not read the
// workforce columns below as if they answered it.
//
// ⚠ Every line is filtered by the run's OWN token. The log ring carries other sessions' lines — see
// analyse_errors.mjs for what that costs when you forget.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/testbed/analyse_techtree_run.mjs <sessionDir>'); process.exit(2); }

const runs = readdirSync(dir).map(e => join(dir, e))
  .filter(p => statSync(p).isDirectory() && existsSync(join(p, 'logs_live', 'debug.log')));
if (!runs.length) { console.error('no runs with a mirrored debug.log found'); process.exit(1); }

const TAGS = ['Great Britain', 'France', 'United States of America', 'Prussia', 'Russia', 'Japan'];
const fmtM = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(Math.round(v));

for (const rp of runs) {
  const name = rp.split(/[\\/]/).pop();
  // the run's own token — the only safe filter
  const tok = (readFileSync(join(rp, 'run.log'), 'utf8').match(/token ([A-Za-z0-9_]+)\)/) ?? [])[1];
  const runlog = readFileSync(join(rp, 'run.log'), 'utf8');
  const fin = runlog.match(/run \d+ finished: ([\d,.]+)s wall[^\n]*in-game ([\d.]+), exit ([a-z \-()]+)/);
  console.log(`\n===== ${name} =====`);
  console.log(`token ${tok ?? '(none)'} · wall ${fin ? fin[1] + 's (' + (parseFloat(fin[1].replace(',', '.')) / 60).toFixed(0) + ' min)' : 'UNFINISHED'}` +
    `${fin ? ' · reached ' + fin[2] + ' · exit ' + fin[3].trim() : ''}`);
  if (!tok) { console.log('  no token — cannot filter, skipping'); continue; }

  const gdp = {}, pop = {}, tech = {}, world = {};
  for (const l of readFileSync(join(rp, 'logs_live', 'debug.log'), 'utf8').split('\n')) {
    const i = l.indexOf('V3TB|');
    if (i < 0) continue;
    const f = l.slice(i).split('|');
    if (f[1] !== tok) continue;                         // another run's line, sitting in our ring
    if (f[2] === 'GDP') { (gdp[f[3]] ??= {})[f[4]] = +f[5]; }
    else if (f[2] === 'POP') { (pop[f[3]] ??= {})[f[4]] = { wf: +f[5], peas: +f[6], dep: +f[8], unemp: +f[9], total: +f[10] }; }
    else if (f[2] === 'WORLD') { world[f[3]] = +f[4]; }
    // ⚠ TECH carries the DISPLAY date — "January 1, 1836", not 1836.1.1. The dump-date metrics use the
    // numeric form, so the two are not parsed the same way and assuming they are yields a silent NaN.
    else if (f[2] === 'TECH') {
      const yr = (f[4] ?? '').match(/(\d{4})\s*$/)?.[1];
      if (yr) ((tech[f[3]] ??= {})[yr] = (tech[f[3]][yr] ?? 0) + 1);
    }
  }

  const dates = [...new Set([...Object.keys(gdp), ...Object.keys(world)])].sort();
  if (!dates.length) { console.log('  no dumps landed'); continue; }

  console.log(`\n  GDP by dump (£M)         ` + TAGS.map(t => t.slice(0, 7).padStart(9)).join('') + '     world');
  for (const d of dates) {
    const row = TAGS.map(t => (gdp[d]?.[t] != null ? fmtM(gdp[d][t]) : '·').padStart(9)).join('');
    console.log(`  ${d.padEnd(24)}${row}  ${world[d] != null ? fmtM(world[d]).padStart(8) : ''}`);
  }

  // TECHNOLOGY BY DECADE: cumulative acquisitions per country. tech_log is an EVENT stream, so a
  // cumulative count IS the size of a country's tree at that date — which is the whole question.
  const yrs = [...new Set(Object.values(tech).flatMap(o => Object.keys(o)))].map(Number).sort((a, b) => a - b);
  if (yrs.length) {
    const decades = [...new Set(yrs.map(y => Math.floor(y / 10) * 10))].sort((a, b) => a - b);
    console.log(`\n  TECH ACQUISITIONS LOGGED, cum.` + TAGS.map(t => t.slice(0, 7).padStart(9)).join(''));
    for (const dec of decades) {
      const row = TAGS.map(t => {
        const o = tech[t]; if (!o) return '·'.padStart(9);
        let n = 0; for (const [y, c] of Object.entries(o)) if (+y <= dec + 9) n += c;
        return String(n).padStart(9);
      }).join('');
      console.log(`  by ${dec + 9}`.padEnd(31) + row);
    }
    const total = Object.values(tech).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b, 0), 0);
    console.log(`  (${total.toLocaleString()} acquisitions across every country; 217 technologies exist.`);
    console.log('   ⚠ This is what the LOG captured, not certified holdings: the 1836 starting grants fire');
    console.log('   before the first pulse and are only partly caught. Comparable BETWEEN arms, which is the point.)');
  } else console.log('\n  no TECH lines — tech_log did not fire');

  const lastPop = dates.filter(d => pop[d]).pop();
  if (lastPop) {
    console.log(`\n  workforce at ${lastPop}   ` + TAGS.map(t => t.slice(0, 7).padStart(9)).join(''));
    for (const k of [['wf', 'workforce'], ['peas', 'peasants'], ['unemp', 'unemp %']])
      console.log(`  ${k[1].padEnd(24)}` + TAGS.map(t => (pop[lastPop][t] ? fmtM(pop[lastPop][t][k[0]]) : '·').padStart(9)).join(''));
    console.log('  ⚠ no per-profession split exists in this metric — see the header.');
  }
}
console.log(`\nerrors: node tools/testbed/analyse_errors.mjs ${dir}`);
