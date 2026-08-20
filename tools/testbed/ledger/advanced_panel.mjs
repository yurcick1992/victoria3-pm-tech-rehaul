// THE ADVANCED-MAJORS PANEL — "fewer productive workers, each more productive", read where it should
// actually be visible (user-ruled 2026-08-20).
//
// The world-level G5 reading is dominated by countries that never industrialise, and the per-tag
// reading is dominated by SIZE: whether France holds Piedmont or the Rhineland barely changes how
// industrialised France is, but it moves its worker count a lot. So this reports two RATIOS over a
// FIXED, POOLED group of technologically advanced majors — GBR USA FRA NET BEL PRU GER:
//
//   1. PRODUCTIVE SHARE  = productive workers / total workforce
//   2. PRODUCTIVITY      = GDP / productive worker
//
// Both are internal ratios, so a province changing hands inside the group moves numerator and
// denominator together and cancels. Tags that do not exist in a run are simply absent — PRU usually
// becomes GER, which is exactly why both are listed. Pooling is what makes that a non-event.
//
// ⚠ A province changing hands OUT of the group (Russia annexing Prussia) does not cancel, so the
// group's total workforce is printed per run as a composition check. Read a ratio move against it.
//
// ⭐⭐ THE DEFINITIONS, AND WHY THEY ARE NOT THE PANEL'S (measured 2026-08-20)
//
//   total workforce   = Σ workforce_by_profession
//                       ( = salaried + unemployed + peasants, an exact identity in the save )
//   productive        = population_salaried_workforce
//                         − population_government_workforce − population_military_workforce
//
// The ledger's existing G5 row subtracts the STAFFING of government/university/military BUILDINGS
// instead. That field is a levels-scale quantity, NOT a headcount: for Britain at 1935 it is
// **677** against the save's own gov+military workforce of **1,204,779**. So the published
// "productive workers ÷ vanilla = 0.86×" is, to four decimal places, just the salaried-workforce
// ratio with a label it does not earn. Both are computed here — `direct` and `legacy` — so this
// connects to what is already published while not repeating its mistake.
//
// ⚠ `population_subsisting_workforce` is peasants ÷ 100,000 (verified exactly), i.e. a scaled field,
// not a headcount. Do not sum it with the others.
//
// USAGE
//   node tools/testbed/ledger/advanced_panel.mjs \
//     --arm 20260819_215528_aival-n4 --arm 20260818_221216_canon-n7 \
//     --van 20260813_083557_vanilla-vs-mod-n4:vanilla [--year 1935] [--group GBR,USA,...]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { usableRuns } from './lib_runs.mjs';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const allOf = n => ARGV.reduce((a, v, i) => (v === n && ARGV[i + 1] ? [...a, ARGV[i + 1]] : a), []);
const SES = 'tools/testbed/sessions';
const YEAR = +argOf('--year', '1935');
const GROUP = argOf('--group', 'GBR,USA,FRA,NET,BEL,PRU,GER').split(',').map(s => s.trim()).filter(Boolean);

const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
const fmt = n => Math.round(n).toLocaleString('en-GB');

function split(spec) { const i = spec.indexOf(':'); return i < 0 ? [spec, ''] : [spec.slice(0, i), spec.slice(i + 1)]; }

// one run -> the pooled group at YEAR
function runRow(runDir) {
  const dir = join(SES, runDir, 'save_summaries');
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    if (+(j.provenance.date || '0').split('.')[0] !== YEAR) continue;
    let gdp = 0, wfAll = 0, sal = 0, gov = 0, mil = 0, legacyNonProd = 0;
    const present = [];
    for (const tag of GROUP) {
      const c = j.countries[tag]; if (!c) continue;
      present.push(tag);
      const p = c.pop_statistics || {};
      gdp += +c.gdp || 0;
      wfAll += Object.values(c.workforce_by_profession || {}).reduce((a, b) => a + b, 0);
      sal += +p.population_salaried_workforce || 0;
      gov += +p.population_government_workforce || 0;
      mil += +p.population_military_workforce || 0;
      for (const [k, b] of Object.entries(c.buildings || {}))
        if (k === 'building_government_administration' || k === 'building_university'
            || /barrack|conscription|naval_base|port_military|army_logistics/.test(k))
          legacyNonProd += b.staffing || 0;
    }
    if (!present.length) return null;
    const prod = Math.max(0, sal - gov - mil);
    return {
      run: runDir.split('/')[1], present, gdp, wfAll, sal, gov, mil, prod,
      share: prod / (wfAll || 1),
      perWorker: gdp / (prod || 1),
      legacyProd: Math.max(0, sal - legacyNonProd),
      legacyShare: Math.max(0, sal - legacyNonProd) / (wfAll || 1),
      legacyPerWorker: gdp / (Math.max(0, sal - legacyNonProd) || 1),
    };
  }
  return null;
}

function arm(spec) {
  const [session, setup] = split(spec);
  const { runs } = usableRuns(SES, session, setup);
  const rows = runs.map(runRow).filter(Boolean);
  if (!rows.length) throw new Error(`no run of ${spec} has a ${YEAR} summary`);
  return { spec, rows, n: rows.length };
}

const armSpecs = allOf('--arm');
const vanSpec = argOf('--van', '');
if (!armSpecs.length || !vanSpec) { console.error('need at least one --arm and a --van'); process.exit(1); }
const V = arm(vanSpec);
const arms = armSpecs.map(arm);

const M = (a, f) => med(a.rows.map(f));

console.log(`\n================ ADVANCED-MAJORS PANEL AT ${YEAR} ================`);
console.log(`  group (pooled): ${GROUP.join(' ')}`);
console.log('  productive = salaried − government − military workforce (the save\'s own fields)');
console.log('  total workforce = Σ workforce_by_profession = salaried + unemployed + peasants');
console.log('  Both metrics are ratios INTERNAL to the pooled group, so territory moving between');
console.log('  members cancels. Territory leaving the group does not — watch the workforce column.');

console.log('\n--- per run ---');
console.log('  arm / run                    tags present                    GDP £M   workforce   prod.share   £/prod.worker');
for (const a of [V, ...arms]) {
  for (const r of a.rows) {
    const miss = GROUP.filter(t => !r.present.includes(t));
    console.log(`  ${(a.spec.split('_').slice(1).join('_') || a.spec).slice(0, 14).padEnd(15)} ${r.run.padEnd(12)} ${r.present.join(',').padEnd(30)} ${fmt(r.gdp / 1e6).padStart(7)}  ${(r.wfAll / 1e6).toFixed(1).padStart(7)}M   ${(100 * r.share).toFixed(2).padStart(6)}%     £${r.perWorker.toFixed(1).padStart(6)}${miss.length ? '   (no ' + miss.join(',') + ')' : ''}`);
  }
}

// ⚠⚠ GDP FIRST, because "GDP per productive worker" is a RATIO and reporting it without its
// numerator invites the reading that the mod produces more. It does not: output is at or slightly
// below vanilla's and EMPLOYMENT falls faster, which is what lifts the quotient. That is the design
// goal — labour released rather than output added — but it is a different claim and must not be
// allowed to arrive disguised as the other one. (Repo convention: a reported ratio carries both terms.)
console.log('\n--- 0. THE NUMERATOR: pooled group GDP ---');
console.log('  arm                    median    range              ÷ vanilla');
const vGdp = M(V, r => r.gdp);
for (const a of [V, ...arms]) {
  const v = a.rows.map(r => r.gdp / 1e6);
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} ${fmt(med(v)).padStart(6)}   ${fmt(Math.min(...v))}–${fmt(Math.max(...v))}        ${a === V ? '   —' : (M(a, r => r.gdp) / vGdp).toFixed(3) + '×'}`);
}

console.log('\n--- 1. PRODUCTIVE SHARE OF THE WORKFORCE ---');
console.log('  arm                    median    range              sd       ÷ vanilla');
const vShare = M(V, r => r.share);
for (const a of [V, ...arms]) {
  const v = a.rows.map(r => 100 * r.share);
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} ${M(a, r => 100 * r.share).toFixed(2).padStart(6)}%   ${Math.min(...v).toFixed(2)}–${Math.max(...v).toFixed(2)}%     ${sd(v).toFixed(2).padStart(5)}pp    ${a === V ? '   —' : (M(a, r => r.share) / vShare).toFixed(3) + '×'}`);
}

console.log('\n--- 2. PRODUCTIVITY: GDP PER PRODUCTIVE WORKER ---');
console.log('  arm                    median    range              sd       ÷ vanilla');
const vPw = M(V, r => r.perWorker);
for (const a of [V, ...arms]) {
  const v = a.rows.map(r => r.perWorker);
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} £${M(a, r => r.perWorker).toFixed(1).padStart(6)}   £${Math.min(...v).toFixed(1)}–${Math.max(...v).toFixed(1)}   ${sd(v).toFixed(2).padStart(6)}    ${a === V ? '   —' : (M(a, r => r.perWorker) / vPw).toFixed(3) + '×'}`);
}

console.log('\n--- for continuity: the SAME two, on the ledger\'s legacy building-staffing definition ---');
console.log('  ⚠ that proxy subtracts ~0.05% of the real gov+military payroll, so "productive workers"');
console.log('     there is the salaried workforce under another name. Shown only to connect to the');
console.log('     published G5 figures, NOT as a second opinion.');
const vLs = M(V, r => r.legacyShare), vLp = M(V, r => r.legacyPerWorker);
console.log('  arm                    share    ÷van      £/worker   ÷van');
for (const a of [V, ...arms])
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} ${(100 * M(a, r => r.legacyShare)).toFixed(2).padStart(6)}%  ${a === V ? '   —' : (M(a, r => r.legacyShare) / vLs).toFixed(3) + '×'}    £${M(a, r => r.legacyPerWorker).toFixed(1).padStart(6)}   ${a === V ? '   —' : (M(a, r => r.legacyPerWorker) / vLp).toFixed(3) + '×'}`);

console.log('\n--- composition check: is the group the same size across arms? ---');
for (const a of [V, ...arms]) {
  const w = a.rows.map(r => r.wfAll / 1e6);
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} workforce ${med(w).toFixed(1)}M  [${Math.min(...w).toFixed(1)}–${Math.max(...w).toFixed(1)}]  · tags ${med(a.rows.map(r => r.present.length))}/${GROUP.length}`);
}
console.log('');
