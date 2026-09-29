// WHAT BECOMES OF A FINISHED DAM SURVEY (user-asked 2026-09-29): did the surveyor build on it, did its family build on it through a family
// survey, did someone else build the dam on their own survey, or did nothing come of it by 1936? Reads the DUMP of dam_outcomes.mjs
// (DUMP=<file> node tools/testbed/ledger/dam_outcomes.mjs <modDir> <runDir>...), so the relations, dates and construction outcomes are that
// tool's. A survey is matched to the first construction on its dam that started at or after its completion (one quarter of slack, the saves
// being quarterly).
// Usage: node tools/testbed/ledger/dam_survey_use.mjs <dump.json>
import fs from 'node:fs';
const { surveys, builds } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const Q = 92 * 864e5, Y = 365.25 * 864e5;
const fin = surveys.filter(s => s.outcome === 'finished' && s.actor && s.tEnd);
const rows = [];
for (const s of fin) {
  const later = builds.filter(b => b.run === s.run && b.dam === s.dam && b.tFirst >= s.tEnd - Q).sort((a, b) => a.tFirst - b.tFirst);
  const own = later.find(b => b.builder === s.actor);
  // a family survey opens the dam to the host's top-overlord family: a family member building without a finished survey of its own
  const famSurvey = s.top && s.top === s.hostTop;
  const famBuild = famSurvey && later.find(b => b.builder !== s.actor && b.top === s.hostTop &&
    !fin.some(o => o.run === s.run && o.dam === s.dam && o.actor === b.builder && o.tEnd <= b.tFirst + Q));
  const already = builds.some(b => b.run === s.run && b.dam === s.dam && b.tFirst < s.tEnd - Q && b.tLast >= s.tEnd - Q);
  let use, b = null;
  if (own) { use = 'the surveyor built'; b = own; }
  else if (famBuild) { use = 'its family built on it'; b = famBuild; }
  else if (later.length) { use = 'someone else built (own survey)'; b = later[0]; }
  else if (already) use = 'already being built by another';
  else use = 'nothing by 1936';
  rows.push({ ...s, use, b, wait: b ? (b.tFirst - s.tEnd) / Y : null, famSurvey });
}
const REL = ['own', 'overlord', 'outside', 'unknown host'];
const USES = ['the surveyor built', 'its family built on it', 'someone else built (own survey)', 'already being built by another', 'nothing by 1936'];
const pct = (a, b) => b ? `${(100 * a / b).toFixed(0)}%` : '-';
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)].toFixed(1) : '-'; };
console.log(`finished surveys: ${fin.length} (of ${surveys.length} started)\n`);
console.log('surveyor relation  finished | ' + USES.map(u => u.padEnd(14).slice(0, 14)).join(' | ') + ' | median years survey->construction');
for (const r of REL) {
  const x = rows.filter(y => y.rel === r); if (!x.length) continue;
  console.log(`${r.padEnd(18)} ${String(x.length).padStart(8)} | ` + USES.map(u => `${x.filter(y => y.use === u).length} (${pct(x.filter(y => y.use === u).length, x.length)})`.padEnd(14)).join(' | ') +
    ` | ${med(x.filter(y => y.b).map(y => y.wait))}`);
}
console.log('\nsurveys that led to a construction BY THE SURVEYOR - how those constructions ended:');
for (const r of REL) {
  const x = rows.filter(y => y.rel === r && y.use === 'the surveyor built'); if (!x.length) continue;
  const c = o => x.filter(y => y.b.outcome === o).length;
  console.log(`  ${r.padEnd(16)} ${x.length}: finished ${c('finished')} · lost ${c('lost (log)')} · vanished ${c('vanished')} · still queued ${c('still queued')}`);
}
console.log('\nfamily surveys (surveyor inside the host\'s top-overlord family) vs outside ones:');
for (const f of [true, false]) {
  const x = rows.filter(y => y.famSurvey === f);
  console.log(`  ${f ? 'family ' : 'outside'} ${x.length}: ` + USES.map(u => `${u} ${pct(x.filter(y => y.use === u).length, x.length)}`).join(' · '));
}
// per dam: how many finished surveys a dam collected before its first construction started
const perDam = {};
for (const s of fin) { const k = s.run + '|' + s.dam; (perDam[k] ??= []).push(s); }
let built = 0, surveysOnBuilt = 0, surveysBeforeFirst = [], neverBuilt = 0, surveysOnUnbuilt = 0;
for (const [k, ss] of Object.entries(perDam)) {
  const [run, dam] = k.split('|'); const bs = builds.filter(b => b.run === run && b.dam === dam);
  if (bs.length) { built++; surveysOnBuilt += ss.length; const t0 = Math.min(...bs.map(b => b.tFirst)); surveysBeforeFirst.push(ss.filter(s => s.tEnd <= t0 + Q).length); }
  else { neverBuilt++; surveysOnUnbuilt += ss.length; }
}
console.log(`\nper dam (run x dam): ${built} surveyed dams got a construction, carrying ${surveysOnBuilt} finished surveys (median ${med(surveysBeforeFirst)} before the first construction); ` +
  `${neverBuilt} surveyed dams got none by 1936, carrying ${surveysOnUnbuilt}`);
