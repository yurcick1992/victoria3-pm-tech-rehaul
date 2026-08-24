// Splice every const this batch can support into the ledger template, and NEUTRALISE the ones it
// cannot. Leaving the template's shipped values in place would publish the PREVIOUS batch's numbers
// under this batch's title, which is the one failure mode a batch report must not have.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const DIR = process.argv[2];
const J = n => JSON.parse(readFileSync(join(DIR, n), 'utf8'));
const C = J('consts.json'), EMP = J('emp.json'), PERF = J('perf_panel.json'), RD = J('report_data.json');
const D2raw = JSON.parse(readFileSync(join(DIR, 'report_data2.json'), 'utf8'));
const R = J('research.json'); const PB = J('payback.json'); const TIERC = J('tierchoice.json');
D2raw.techsT = R.techsT; D2raw.jeT = R.jeT;   // sections report_data2.mjs does not emit yet
const D2 = JSON.stringify(D2raw);
let s = readFileSync('tools/testbed/ledger/ledger_template.html', 'utf8');
const rep = (re, val, label) => {
  if (!re.test(s)) { console.error('ANCHOR MISSING: ' + label); process.exit(1); }
  s = s.replace(re, () => val);
};
// --- construction ratio completes TRAJ's third slot -------------------------------------------
const YEARS = [1840,1860,1880,1900,1920,1935];
// THE LADDER IS COMPUTED, NOT BLANKED: most-built era and e0 share from the decade additions;
// frontier / stale rung payback from payback.json (build cost x GBP720 over annual profit per
// level at realised prices); stale staffing from the era census.
const LADDER = {};
for (const y of YEARS) {
  const p = PB[y], yr = RD.flat.years[y]; if (!p || !yr) continue;
  const adds = RD.flat.addsByDecade[Math.floor(y / 10) * 10] || [0,0,0,0,0,0];
  const tot = adds.reduce((a, b) => a + b, 0) || 1;
  LADDER[y] = ['e' + adds.indexOf(Math.max(...adds)), +(100 * adds[0] / tot).toFixed(0),
               'e' + p.topEra, p.frontier ?? 0, 'e0', p.stale ?? 0,
               +((yr.era && yr.era['0'] && yr.era['0'].staff) || 0)];
}
const TRAJ = {};
for (const y of YEARS) {
  const t = C.TRAJ[y]; if (!t) continue;
  const cm = RD.flat.years[y]?.ptsAdd, cv = RD.vanMean[y]?.ptsAdd;
  TRAJ[y] = [t[0], t[1], cm && cv ? +(cm / cv).toFixed(2) : 0];
}
// --- WATCH: what this batch measured; the two columns it cannot source are marked 0/'—' -------
const WATCH = {};
for (const y of YEARS) {
  const yr = RD.flat.years[y]; if (!yr) continue;
  WATCH[y] = [C.TRAJ[y]?.[0] ?? 0, +(yr.era ? Object.entries(yr.era).reduce((a,[k,v])=>a+(+k)*v.lv,0)/Object.values(yr.era).reduce((a,v)=>a+v.lv,0) : 0).toFixed(2),
              +(yr.gbr?.meanEra ?? 0).toFixed(2), 0,
              +(100*(yr.frontierShareMedian ?? 0)).toFixed(1), 0, 0];
}
rep(/^const GDP_FLAT=\{.*$/m, 'const GDP_FLAT=' + JSON.stringify(C.GDP_FLAT) + ';', 'GDP_FLAT');
rep(/^const GDP_VAN=\{.*$/m,  'const GDP_VAN='  + JSON.stringify(C.GDP_VAN)  + ';', 'GDP_VAN');
rep(/^const GDP_NB=\{.*$/m,   'const GDP_NB='   + JSON.stringify(C.GDP_NB)   + ';', 'GDP_NB');
rep(/^const EMP=\{.*$/m,      'const EMP='      + JSON.stringify(EMP)        + ';', 'EMP');
rep(/^const PROD_FLAT=\{.*$/m,'const PROD_FLAT='+ JSON.stringify(C.PROD_FLAT)+ ';', 'PROD_FLAT');
rep(/^const PROD_VAN=\{.*$/m, 'const PROD_VAN=' + JSON.stringify(C.PROD_VAN) + ';', 'PROD_VAN');
rep(/^const TRAJ=\{.*$/m,     'const TRAJ='     + JSON.stringify(TRAJ)       + ';', 'TRAJ');
rep(/^const WORLD_FULL=\{.*$/m,'const WORLD_FULL='+JSON.stringify(C.WORLD_FULL)+';', 'WORLD_FULL');
rep(/^const WORLD_PURE=\{.*$/m,'const WORLD_PURE='+JSON.stringify(C.WORLD_PURE)+';', 'WORLD_PURE');
rep(/^const WATCH=\{.*$/m,    'const WATCH='    + JSON.stringify(WATCH)      + ';', 'WATCH');
rep(/^const LADDER=\{.*$/m,   'const LADDER=' + JSON.stringify(LADDER) + ';', 'LADDER');
rep(/^const PERF=\{.*$/m,     'const PERF='     + JSON.stringify(PERF)       + ';', 'PERF');
rep(/^const TIERC=\{.*$/m,    'const TIERC='    + JSON.stringify(TIERC)      + ';', 'TIERC');
rep(/^const VA=\{flat:\{\},.*$/m, 'const VA=' + JSON.stringify(RD.VA) + ';', 'VA');
s = s.replace('__D2__', () => D2);
// LADDER is empty -> its loop would throw. Guard it.
s = s.replace('  const l=LADDER[y];', '  const l=LADDER[y]; if(!l) continue;');
writeFileSync(join(DIR, 'REPORT.html'), s);
console.log('assembled ->', join(DIR, 'REPORT.html'), (s.length/1024).toFixed(0) + ' KB');
