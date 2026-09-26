// THE DAM REPORT — who surveyed what, when, at what bureaucracy balance, and what got built (BALANCE_FRAMEWORK §10.89,
// FINDINGS F168). Reads one run: its debug.log mirror (the PMR_DAM lines emit_dams.mjs writes) and its yearly save summaries.
//
//   node tools/testbed/ledger/dam_report.mjs <runDir> [--years 1880,1900,1920,1935] [--surveys] [--bur <country name>]
//
// Sections: (1) per country: surveys started / completed / ended incomplete, stages started / built; (2) the survey list
// (--surveys) with start and end dates, months, and produced/used bureaucracy at each end; (3) --bur <name>: that country's
// yearly bureaucracy line with its survey and stage events interleaved; (4) per year from the summaries: dam stages standing,
// dam electricity (va_out ÷ 30, the base price) against all electricity produced, power-plant levels, by country for the top five.
// ⚠ The log carries country NAMES (no tag function), and a mirror can hold re-read chunks (landmine L28): lines are de-duplicated.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

const run = process.argv[2];
if (!run) { console.error('usage: node tools/testbed/ledger/dam_report.mjs <runDir> [--years ...] [--surveys] [--bur <name>]'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const years = arg('--years', '1880,1900,1910,1920,1930,1935').split(',').map(Number);

// ---- the log
const dbg = join(run, 'logs_live', 'debug.log');
if (!existsSync(dbg)) throw new Error(`no ${dbg}`);
const seen = new Set();
const ev = [];
for (const l of readFileSync(dbg, 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('PMR_DAM|');
  if (i < 0 || l.includes('Data error')) continue;
  const s = l.slice(i).replace(/'$/, '');
  if (seen.has(s)) continue;
  seen.add(s);
  const f = s.split('|');
  const bur = /bur (-?[\d.]+)\/(-?[\d.]+)/.exec(s);
  ev.push({ e: f[1], p: f[2], c: f[3], d: f[4], prod: bur ? +bur[1] : null, used: bur ? +bur[2] : null, rest: f.slice(5).join('|') });
}
const ym = d => { const m = /(\w+) (\d+), (\d+)/.exec(d || ''); if (!m) return null; const mo = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(m[1]); return +m[3] + (mo + (+m[2] - 1) / 31) / 12; };

// (1) per country
const C = {};
const bump = (c, k) => { (C[c] ??= { survey_start: 0, survey_complete: 0, survey_ended: 0, stage_start: 0, built: 0 })[k]++; };
for (const x of ev) if (['survey_start', 'survey_complete', 'survey_ended', 'stage_start', 'built'].includes(x.e)) bump(x.c, x.e);
const rows = Object.entries(C).sort((a, b) => b[1].built - a[1].built || b[1].survey_start - a[1].survey_start);
console.log(`\nDAM ACTIVITY BY COUNTRY (${run.split(/[\\/]/).slice(-2).join('/')})`);
console.log('country'.padEnd(34) + 'surveys started / completed / ended-incomplete   stages started / built');
for (const [c, v] of rows) console.log(c.padEnd(34) + `${v.survey_start} / ${v.survey_complete} / ${v.survey_ended}`.padEnd(47) + `${v.stage_start} / ${v.built}`);
const first = e => ev.find(x => x.e === e);
console.log(`\nfirst survey ${first('survey_start')?.d || '-'} (${first('survey_start')?.c || ''}) · first stage built ${first('built')?.d || '-'} (${first('built')?.c || ''}) · ` +
  `projects surveyed ${new Set(ev.filter(x => x.e === 'survey_complete').map(x => x.p)).size} · projects complete ${new Set(ev.filter(x => x.e === 'complete').map(x => x.p)).size} · stages built ${ev.filter(x => x.e === 'built').length}`);

// (2) surveys
if (process.argv.includes('--surveys')) {
  console.log('\nSURVEYS (start → end; bureaucracy produced/used at each end)');
  const open = new Map();
  for (const x of ev) {
    if (x.e === 'survey_start') open.set(x.p, x);
    if (x.e === 'survey_complete' || x.e === 'survey_ended') {
      const s = open.get(x.p); open.delete(x.p);
      console.log(`  ${x.p.padEnd(28)} ${(s?.c || '?').padEnd(28)} ${(s?.d || '?').padEnd(18)} → ${x.d.padEnd(18)} ${x.e === 'survey_complete' ? 'done ' : 'ENDED'} ` +
        `bur ${s?.prod ?? '?'}/${s?.used ?? '?'} → ${x.prod ?? '?'}/${x.used ?? '?'}`);
    }
  }
  for (const [p, s] of open) console.log(`  ${p.padEnd(28)} ${s.c.padEnd(28)} ${s.d.padEnd(18)} → (running at the end)`);
}

// (3) one country's bureaucracy dynamics
const who = arg('--bur', null);
if (who) {
  console.log(`\nBUREAUCRACY — ${who} (yearly line, survey and stage events interleaved)`);
  for (const x of ev.filter(x => x.c === who && x.e !== 'survey_month')) console.log(`  ${(x.d || '').padEnd(18)} ${x.e.padEnd(16)} ${x.p.padEnd(26)} ${x.prod != null ? `bur ${x.prod}/${x.used} (balance ${Math.round(x.prod - x.used)})` : ''} ${x.e === 'bur_year' ? x.rest.replace(/^bur [^|]*\|?/, '') : ''}`);
}

// (4) the summaries
const sd = join(run, 'save_summaries');
if (existsSync(sd)) {
  const files = readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  console.log('\nPER YEAR (save summaries): dam stages standing · dam electricity / all electricity (per week) · power-plant levels · top dam countries');
  for (const f of files) {
    const j = JSON.parse(zlib.gunzipSync(readFileSync(join(sd, f))));
    const date = j.provenance?.date || ''; const y = +String(date).split('.')[0];
    if (!years.includes(y)) continue;
    let st = 0, damE = 0, allE = 0, pp = 0; const by = {};
    for (const [t, c] of Object.entries(j.countries)) {
      allE += c.goods_out?.electricity || 0;
      pp += c.buildings?.building_power_plant?.levels || 0;
      for (const [k, b] of Object.entries(c.buildings || {})) if (k.startsWith('building_dam_')) { st += b.levels; const e = (b.va_out || 0) / 30; damE += e; by[t] = (by[t] || 0) + e; }
    }
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, e]) => `${t} ${Math.round(e)}`).join(', ');
    console.log(`  ${date.padEnd(10)} stages ${String(st).padStart(4)} · dam ${String(Math.round(damE)).padStart(6)} / all ${String(Math.round(allE)).padStart(6)} (${allE ? (100 * damE / allE).toFixed(0) : 0}%) · power plants ${pp} · ${top}`);
  }
}
