// Derive every world-level const the ledger template carries, from THIS batch's save summaries.
// n=6: run007 is INCOMPLETE (L17) and is excluded everywhere.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const SES = 'tools/testbed/sessions';
const OUT = process.argv[2];
// ⚠⚠ THESE WERE HARDCODED to canon-n7 and the RETIRED 20260813 vanilla baseline, so a fill for any
//   other batch silently published canon-n7's numbers under the new batch's title — the exact failure
//   fill_manifest.json exists to prevent, sitting inside the fill pipeline itself. Caught 2026-08-31
//   when GDP_FLAT read 3562M at 1935 against the batch's own median of 2668M.
//   Now: --mod / --van / --nb, comma-separated `session/run` lists, defaults preserved for continuity.
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i+1] ? process.argv[i+1] : d; };
const list = (v, d) => v ? v.split(',').map(x => x.trim()).filter(Boolean) : d;
const MOD = list(argOf('--mod', null), [1,2,3,4,5,6].map(i => `20260818_221216_canon-n7/run00${i}_canonfull`));
const VAN = list(argOf('--van', null), ['run001_vanilla','run003_vanilla','run005_vanilla','run007_vanilla'].map(r => '20260813_083557_vanilla-vs-mod-n4/' + r));
const NB  = list(argOf('--nb',  null), ['run002_mod','run006_mod'].map(r => '20260813_083557_vanilla-vs-mod-n4/' + r));

// ⚠⚠ CORRECTED 2026-08-20 (user-ruled). This used to derive government + military payrolls from the
// STAFFING of government/university/military BUILDINGS. `staffing` in a save summary is a count of
// STAFFED LEVELS, NOT PEOPLE — Britain at 1935 reads **677** against the save's own
// population_government_workforce + population_military_workforce of **1,204,779**, five thousandths
// of one percent of it. So "productive workers" was the SALARIED WORKFORCE under a label it did not
// earn, and every G5 figure published before this date is that quantity.
//
// The save books both payrolls directly, so the subtraction is now real:
//     productive = population_salaried_workforce
//                    − population_government_workforce − population_military_workforce
//
// ⚠ This MOVES the published number, and deliberately so — gov+military are not the same share of the
// workforce in a mod arm as in vanilla, which is exactly why the subtraction was meant to be there.
// The ledger README carries the before/after so older reports stay reconcilable rather than merely
// contradicted. Same definition as advanced_panel.mjs / tiered_panel.mjs; keep the three in step.

function series(runDir) {
  const dir = join(SES, runDir, 'save_summaries');
  if (!existsSync(dir)) return null;
  const out = {};
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const y = +(j.provenance.date || '0').split('.')[0];
    let gdp = 0, sal = 0, unemp = 0, peas = 0, wfAll = 0, govMilStaff = 0;
    for (const c of Object.values(j.countries)) {
      gdp += c.gdp || 0;
      const ps = c.pop_statistics || {};
      sal += ps.population_salaried_workforce || 0;
      unemp += ps.population_unemployed_workforce || 0;
      // the real payrolls, booked by the save itself — see the note at the top of this file
      govMilStaff += (ps.population_government_workforce || 0) + (ps.population_military_workforce || 0);
      for (const [p, n] of Object.entries(c.workforce_by_profession || {})) { wfAll += n; if (p === 'peasants') peas += n; }
    }
    let lv = 0;
    for (const b of Object.values(j.world.buildings || {})) lv += b.levels || 0;
    out[y] = { gdp: gdp / 1e6, sal, unemp, peas, wfAll, lv, govMilStaff, pops: j.world.pop_objects_live ?? null };
  }
  return out;
}
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const merge = dirs => {
  const runs = dirs.map(series).filter(Boolean);
  const yrs = new Set(); runs.forEach(r => Object.keys(r).forEach(y => yrs.add(+y)));
  const o = {};
  for (const y of [...yrs].sort((a, b) => a - b)) {
    const rows = runs.map(r => r[y]).filter(Boolean);
    if (!rows.length) continue;
    o[y] = {};
    for (const k of Object.keys(rows[0])) o[y][k] = med(rows.map(r => r[k] ?? 0));
    o[y].n = rows.length;
  }
  return o;
};
const mod = merge(MOD), van = merge(VAN), nb = merge(NB);
// productive workers, millions
const prod = s => Object.fromEntries(Object.entries(s).map(([y, r]) =>
  [y, { w: +((r.sal - r.govMilStaff) / 1e6).toFixed(1), g: Math.round(r.gdp) }]));
// non-productive adults % and pure unemployment %
const full = r => 100 * (r.unemp + r.peas) / (r.wfAll || 1);
const pure = r => 100 * r.unemp / ((r.wfAll - r.peas) || 1);
const YEARS = [1840, 1860, 1880, 1900, 1920, 1935];
const out = {
  GDP_FLAT: Object.fromEntries(Object.entries(mod).map(([y, r]) => [y, Math.round(r.gdp)])),
  GDP_VAN:  Object.fromEntries(Object.entries(van).map(([y, r]) => [y, Math.round(r.gdp)])),
  GDP_NB:   Object.fromEntries(Object.entries(nb).map(([y, r]) => [y, Math.round(r.gdp)])),
  PROD_FLAT: prod(mod), PROD_VAN: prod(van),
  TRAJ: Object.fromEntries(YEARS.filter(y => mod[y] && van[y]).map(y =>
    [y, [+(mod[y].gdp / van[y].gdp).toFixed(2), +(mod[y].lv / van[y].lv).toFixed(2), null]])),
  WORLD_FULL: Object.fromEntries(YEARS.filter(y => mod[y] && van[y]).map(y => [y, [+full(mod[y]).toFixed(1), +full(van[y]).toFixed(1)]])),
  WORLD_PURE: Object.fromEntries(YEARS.filter(y => mod[y] && van[y]).map(y => [y, [+pure(mod[y]).toFixed(1), +pure(van[y]).toFixed(1)]])),
  _n: { mod: MOD.length, van: VAN.length, nb: NB.length },
};
writeFileSync(join(OUT, 'consts.json'), JSON.stringify(out, null, 1));
console.log('mod years', Object.keys(mod).length, '| van years', Object.keys(van).length, '| nb years', Object.keys(nb).length);
for (const y of YEARS) if (mod[y] && van[y]) console.log(y, 'GDP mod', Math.round(mod[y].gdp), 'van', Math.round(van[y].gdp), 'ratio', (mod[y].gdp/van[y].gdp).toFixed(2), '| lv ratio', (mod[y].lv/van[y].lv).toFixed(2), '| prodW', prod(mod)[y].w, 'vs', prod(van)[y].w);
