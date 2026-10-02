// THE SHORTLIST'S DEPEASANTATION, YEAR BY YEAR (promoted from the session scratchpad 2026-10-02; FINDINGS F209 quotes it).
// U* = (unemployed + peasants) ÷ (salaried + unemployed + peasants) — criteria.mjs's definition (peasants = population_subsisting_workforce × 1e5)
// for the shortlist pooled and per member (GER = GER, else NGF, else PRU; NET = NET, else UNL), every year; then the first year each goes under
// 10% and 5% and the count of years under 5% (the register's HARD line is the POOLED figure under 10% at the end state).
//   node tools/testbed/ledger/ustar_path.mjs <session>[:<setup>] [years, default 1850,1870,1890,1900,1910,1920,1925,1930,1935]
import path from 'node:path'; import fs from 'node:fs';
import { indexRun, readSum, runsOf, firstOf } from './lib_sumidx.mjs';
const [sess, setup] = (process.argv[2] || '').split(':');
if (!sess) { console.error('usage: ustar_path.mjs <session>[:<setup>] [years]'); process.exit(1); }
const PRINT = (process.argv[3] || '1850,1870,1890,1900,1910,1920,1925,1930,1935').split(',').map(Number);
const MEMBERS = { GBR: ['GBR'], USA: ['USA'], FRA: ['FRA'], GER: ['GER', 'NGF', 'PRU'], NET: ['NET', 'UNL'], BEL: ['BEL'] };
const out = [];
for (const r of runsOf(sess, setup || null)) { if (!fs.existsSync(path.join(r, 'meta.json'))) continue; const idx = indexRun(r); const ser = {};
  for (let y = 1837; y <= 1936; y++) { const d = firstOf(idx, y); if (!d) continue; const j = readSum(idx[d]); const row = {}; let P = [0, 0];
    for (const [m, tags] of Object.entries(MEMBERS)) { const tag = tags.find(t => j.countries?.[t]); const c = tag && j.countries[tag]; if (!c) continue; const p = c.pop_statistics || {};
      const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
      row[m] = (un + pe) / (sal + un + pe); if (m !== 'NET' || !j.countries?.UNL || tag === 'UNL') { P[0] += un + pe; P[1] += sal + un + pe; } }
    row.pool = P[0] / P[1]; ser[y] = row; }
  out.push([path.basename(r), ser]); }
for (const [rn, ser] of out) {
  console.log(`${rn}: U* by year (pooled shortlist and members)`);
  console.log('  year   pool   ' + Object.keys(MEMBERS).map(m => m.padEnd(6)).join(' '));
  for (const y of PRINT) { const r = ser[y]; if (!r) continue; console.log(`  ${y}  ${(r.pool * 100).toFixed(1).padStart(5)}%  ` + Object.keys(MEMBERS).map(m => r[m] != null ? ((r[m] * 100).toFixed(1) + '%').padEnd(6) : '  -   ').join(' ')); }
  for (const k of ['pool', ...Object.keys(MEMBERS)]) { const yrs = Object.keys(ser).map(Number).sort((a, b) => a - b); const u10 = yrs.find(y => ser[y][k] < 0.10), u5 = yrs.find(y => ser[y][k] < 0.05);
    const min = Math.min(...yrs.map(y => ser[y][k]).filter(Number.isFinite)); const ymin = yrs.find(y => ser[y][k] === min);
    console.log(`  ${k.padEnd(4)} first < 10%: ${u10 ?? '—'} · first < 5%: ${u5 ?? '—'} · lowest ${(min * 100).toFixed(1)}% (${ymin})${u5 ? ' · years < 5%: ' + yrs.filter(y => ser[y][k] < 0.05).length : ''}`); }
}
