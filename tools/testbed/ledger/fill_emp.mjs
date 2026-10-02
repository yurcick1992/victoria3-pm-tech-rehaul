// Tier employment by era, computed EXACTLY: staffed levels from the summaries x the config's own
// per-tier employment (workforce_mult applied, as the builder emits it). No proxy, no guesswork.
//   node tools/testbed/ledger/fill_emp.mjs <outDir> --mod <sess/run[,...]> --config <the arm's book>
//   → emp.json {year: [workers M per column]} + emp_cols.json [the column labels] + emp_b2.json {year: {w, p, pAll}} (old rungs beside
//     their replacement, world and the shortlist pool), all read by fill_assemble / fill_goals.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { eraCols } from './lib_era_cols.mjs';
import { POOL } from './lib_markets.mjs';
// ⭐⭐ ERA-COUNT AGNOSTIC (2026-08-31). The ledger serves TWO semi-canonical books now — the six-rung
//   canonical one and the four-rung vanilla-ladder arm — so nothing here may assume six eras or a
//   particular config. The arm's OWN config comes in on `--config`; the era count is derived from it.
//   ⚠ Hardcoding `config/mod_config.canon_n7.json` and `[0,0,0,0,0,0]` produced a report claiming
//   `topEra: 5` for a book whose top rung is 3, with two empty era buckets and every tier4-only
//   building unresolved. A panel that is wrong is worse than one that is absent.
// ⭐⭐ THE COLUMNS COME FROM lib_era_cols.mjs SINCE 2026-10-02: e0 split into ARTISANS (craft rungs) and OTHER when the book has
//   crafts (user-ruled the same day, for the artisan books), and a merge host's workers shared out over its main methods at each
//   method's own era. The same helper feeds report_data2.mjs's per-country columns, so the two pages cannot disagree.
// ⭐ ONE SUMMARY PER YEAR PER RUN — the FIRST of the year, as criteria.mjs and the other readers take it. This read EVERY summary
//   in a sample year, which on a quarterly-autosave batch put four quarters of each run into one median.
// ⭐ DECADE SAMPLES (1840 … 1930, 1935) in place of the six anchor years, so the panel shows WHEN an old rung starts shedding —
//   the obsolescence reading this panel exists for is a trajectory, and six points every twenty years hid its timing.
const CFGP = (() => { const i = process.argv.indexOf('--config'); return i > 0 && process.argv[i+1] ? process.argv[i+1] : 'config/mod_config.canon_n7.json'; })();
const cfg = JSON.parse(readFileSync(CFGP, 'utf8'));
const E = eraCols(cfg);
const SES = 'tools/testbed/sessions';
// ⚠⚠ --mod IS REQUIRED. This used to hardcode canon-n7 while accepting other flags, so a fill for
//   ANY other batch silently reported canon-n7’s numbers under the new batch’s title — the tier employment-by-era table
//   came from the wrong world. Found 2026-09-01 by a census after the same defect turned up in
//   fill_consts and fill_payback: when a tool is parameterised, sweep it for EVERY hardcoded
//   session, not just the one that prompted the change.
const RUNS = (() => {
  const i = process.argv.indexOf('--mod');
  if (i > 0 && process.argv[i+1]) return process.argv[i+1].split(',').map(s => s.trim()).filter(Boolean);
  throw new Error('fill_emp.mjs: --mod <sess/run[,...]> is REQUIRED (it used to default to canon-n7 and '
    + "report that batch numbers under whatever title it was given).");
})();
const YEARS = [1840,1850,1860,1870,1880,1890,1900,1910,1920,1930,1935];
// ⭐ OLD RUNGS BESIDE THEIR REPLACEMENT (2026-10-02): per column, the workers on a rung two or more eras behind the best rung their OWN
//   country staffs in the same industry (lib_era_cols countrySplit's b2), world-wide and in the register's shortlist POOL — the
//   ladder failing to retire a rung, separated from backward countries that run nothing newer. → emp_b2.json → EMP_B2.
const POOLSET = new Set(POOL);
const per = {}, perB = {};
for (const r of RUNS) {
  const dir = join(SES, r, 'save_summaries'); if (!existsSync(dir)) continue;
  const seen = new Set();
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    if (!YEARS.includes(y) || seen.has(y)) continue;   // the save files sort chronologically: the first one of a year is its first summary
    seen.add(y);
    const n = E.labels.length, cols = new Array(n).fill(0), wB2 = new Array(n).fill(0), pB2 = new Array(n).fill(0), pAll = new Array(n).fill(0);
    for (const [key, c] of Object.entries(j.countries)) {
      const s = E.countrySplit(c.buildings);
      // a pool member is the plain TAG, i.e. the country's MAIN record (summary v12+ keys the others TAG@<id>; landmine L38)
      const inPool = POOLSET.has(key);
      for (let i = 0; i < n; i++) {
        cols[i] += s.all[i]; wB2[i] += s.b2[i];
        if (inPool) { pB2[i] += s.b2[i]; pAll[i] += s.all[i]; }
      }
    }
    (per[y] ||= []).push(cols);
    (perB[y] ||= []).push({ wB2, pB2, pAll });
  }
}
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const EMP = {}, EMP_B2 = {};
const M2 = x => +(x / 1e6).toFixed(2);
for (const y of YEARS) if (per[y]) {
  EMP[y] = E.labels.map((_, i) => M2(med(per[y].map(r => r[i]))));
  const B = perB[y];
  EMP_B2[y] = { w: E.labels.map((_, i) => M2(med(B.map(b => b.wB2[i])))),
                p: E.labels.map((_, i) => M2(med(B.map(b => b.pB2[i])))),
                pAll: E.labels.map((_, i) => M2(med(B.map(b => b.pAll[i])))) };
}
writeFileSync(join(process.argv[2], 'emp.json'), JSON.stringify(EMP));
writeFileSync(join(process.argv[2], 'emp_cols.json'), JSON.stringify(E.labels));
writeFileSync(join(process.argv[2], 'emp_b2.json'), JSON.stringify(EMP_B2));
console.log('tier types:', Object.keys(E.tier).length, '· columns:', E.labels.join(' / '), E.hasCraft ? '(e0 split: artisans / other)' : '');
const sum = a => a.reduce((x, y) => x + y, 0);
for (const y of YEARS) if (EMP[y]) console.log(y, EMP[y].join(' / '), ' total', sum(EMP[y]).toFixed(1) + 'M',
  ' · beside a rung 2+ eras newer:', sum(EMP_B2[y].w).toFixed(2) + 'M world (' + (100 * sum(EMP_B2[y].w) / (sum(EMP[y]) || 1)).toFixed(1) + '%), '
  + sum(EMP_B2[y].p).toFixed(2) + 'M of the pool’s ' + sum(EMP_B2[y].pAll).toFixed(1) + 'M');
