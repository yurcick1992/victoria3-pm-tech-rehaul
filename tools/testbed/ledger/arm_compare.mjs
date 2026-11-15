#!/usr/bin/env node
// ARM AGAINST ARM, ANY NUMBER OF ARMS: world GDP, each major's GDP, depeasantation, hoarding and play time, side by side.
// Written 2026-11-15 for the three-arm batch (vanilla 1.15.1, No Free Upgrades 1.1.1, Salty's Production Method Rework 0.4.0); the
// user: "We do not need the standartized ledger for this comparison, a smaller bespoke reporter will do just fine." It is NOT the
// criteria register (no aims, no boundaries, no loss): a third-party mod has no aims of ours to be read against. It reads what any
// arm's save summaries and run log carry, with the register's own definitions (criteria.mjs addC / fin):
//   GDP   world: the save's displayed world.gdp; a country: its displayed gdp
//   U*    (unemployed + peasants) / (salaried + unemployed + peasants), printed as a percentage
//   peasants  peasants / the same workforce, a percentage (U* without the unemployed)
//   W     productive workers per capita = (salaried - government - military) / population (the three strata)
//   H     the investment pool / yearly GDP
//   END   the mean over the yearly summaries 1932.1.1 ... 1936.1.1 (the register's end state)
// An arm's figure is the MEDIAN over its usable runs, with the lowest and highest run beside it. A ratio names its direction and
// prints both terms (the arm's median and the reference arm's median are both in the row).
//
//   node tools/testbed/ledger/arm_compare.mjs --arm <label>=<group> [--arm ...] [--wall <label>=<group> ...] [--ref <label>]
//        [--years 1846,1856,...] [--majors "GBR,USA,FRA,GER/NGF/PRU,RUS,AUS,JAP,LOW:UNL+NET+BEL"]
//   <group> = <session>[,<session>...][:<setup>], several joined with + when the setups differ by session:
//        --arm vanilla=20261112_113429_g1151-alt-vanilla10-canon10:vanilla+<new session>:vanilla
//   --arm   the ECONOMY's runs (every usable run pools: lib_runs.usableRuns, L17)
//   --wall  the PLAY-TIME runs, one session's alternating arms only (a wall clock compares the same days, never across sessions);
//           without --wall no play time is printed
//   --ref   the arm every ratio divides by (default: the first --arm)
//   A major is TAG, a succession TAG/TAG/TAG (the first that exists that year), or LABEL:TAG+TAG+TAG (the sum of those present).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { POOL } from './lib_markets.mjs';
import { wallFromTicks } from './lib_wall.mjs';
import { yearTimes } from '../slow_quarantine.mjs';

const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const argv = process.argv.slice(2);
const armSpecs = [], wallSpecs = [];
let REF = null, YEARS = [1846, 1856, 1866, 1876, 1886, 1896, 1906, 1916, 1926, 1936];
let MAJORS = 'GBR,USA,FRA,GER/NGF/PRU,RUS,AUS,JAP,LOW:UNL+NET+BEL';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--arm') armSpecs.push(argv[++i]);
  else if (argv[i] === '--wall') wallSpecs.push(argv[++i]);
  else if (argv[i] === '--ref') REF = argv[++i];
  else if (argv[i] === '--years') YEARS = argv[++i].split(',').map(Number);
  else if (argv[i] === '--majors') MAJORS = argv[++i];
  else { console.error(`unknown argument: ${argv[i]}`); process.exit(2); }
}
if (!armSpecs.length) { console.error('usage: arm_compare.mjs --arm <label>=<session>[,<session>][:<setup>][+...] [--arm ...] [--wall <label>=<group> ...] [--ref <label>]'); process.exit(2); }
const E0 = 1932, E1 = 1936;

// ---- which runs
function groupRuns(spec) {
  const eq = spec.indexOf('='); if (eq < 1) throw new Error(`an arm is <label>=<group>: ${spec}`);
  const label = spec.slice(0, eq), runs = [], dropped = [];
  for (const part of spec.slice(eq + 1).split('+')) {
    const [ses, setup = ''] = part.split(':');
    const r = usableRuns(SES, ses, setup); runs.push(...r.runs); dropped.push(...r.dropped.map(d => ({ ...d, of: part })));
  }
  return { label, spec, runs, dropped };
}

// ---- the majors
const majors = MAJORS.split(',').map(s => s.trim()).filter(Boolean).map(s => {
  if (s.includes(':')) { const [label, tags] = s.split(':'); return { label, tags: tags.split('+'), mode: 'sum' }; }
  const tags = s.split('/'); return { label: tags[0], tags, mode: 'first' };
});

// ---- one run: year -> { world, pool, majors: { label -> agg | null } }   (criteria.mjs addC / fin)
const agg = () => ({ gdp: 0, pop: 0, prod: 0, sal: 0, un: 0, pe: 0, pool: 0, n: 0 });
const addC = (a, c) => {
  const p = c.pop_statistics || {};
  const sal = +p.population_salaried_workforce || 0, un = +p.population_unemployed_workforce || 0, pe = (+p.population_subsisting_workforce || 0) * 1e5;
  a.gdp += +c.gdp || 0; a.pop += Object.values(c.strata || {}).reduce((x, y) => x + y, 0);
  a.prod += sal - (+p.population_government_workforce || 0) - (+p.population_military_workforce || 0);
  a.sal += sal; a.un += un; a.pe += pe; a.pool += +c.investment_pool || 0; a.n++;
};
const fin = a => { const wf = a.sal + a.un + a.pe; return { ...a,
  W: a.pop > 0 ? a.prod / a.pop : NaN, U: wf > 0 ? (a.un + a.pe) / wf : NaN, P: wf > 0 ? a.pe / wf : NaN,
  H: a.gdp > 0 ? a.pool / a.gdp : NaN, Y: a.prod > 0 ? a.gdp / a.prod : NaN }; };
function readRun(rel) {
  const dir = join(SES, rel, 'save_summaries'), years = new Map();
  for (const fn of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn))).toString('utf8')); } catch { continue; }
    const y = +String(j.provenance?.date || '').split('.')[0]; if (!y || years.has(y)) continue;
    const C = j.countries || {}, world = agg(), pool = agg(), M = {};
    for (const [tag, c] of Object.entries(C)) { addC(world, c); if (POOL.includes(tag)) addC(pool, c); }
    world.gdp = +j.world?.gdp || world.gdp;
    for (const m of majors) {
      const a = agg();
      if (m.mode === 'sum') { for (const t of m.tags) if (C[t]) addC(a, C[t]); }
      else { const t = m.tags.find(x => C[x]); if (t) addC(a, C[t]); }
      M[m.label] = a.n ? fin(a) : null;
    }
    years.set(y, { world: fin(world), pool: fin(pool), majors: M });
  }
  return years;
}

// ---- statistics
const fnum = v => v.filter(Number.isFinite);
const med = v => { const s = fnum(v).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const lo = v => { const s = fnum(v); return s.length ? Math.min(...s) : NaN; }, hi = v => { const s = fnum(v); return s.length ? Math.max(...s) : NaN; };
const mean = v => { const s = fnum(v); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN; };
// a run's value of `get(scopeObject)` at a year, or its END-state mean
const at = (run, y, pick, get) => { const o = run.years.get(y); const s = o && pick(o); return s ? get(s) : NaN; };
const end = (run, pick, get) => mean([...run.years.entries()].filter(([y]) => y >= E0 && y <= E1).map(([, o]) => { const s = pick(o); return s ? get(s) : NaN; }));
const val = (run, y, pick, get) => y === 'END' ? end(run, pick, get) : at(run, y, pick, get);

// ---- load
const arms = armSpecs.map(groupRuns);
for (const a of arms) a.data = a.runs.map(rel => ({ rel, years: readRun(rel) }));
const ref = REF ? arms.find(a => a.label === REF) : arms[0];
if (!ref) { console.error(`--ref ${REF}: no such arm (${arms.map(a => a.label).join(', ')})`); process.exit(2); }

const pad = (s, n) => String(s).padStart(n), padE = (s, n) => String(s).padEnd(n);
const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '-';
const LW = Math.max(8, ...arms.map(a => a.label.length));

console.log('ARM AGAINST ARM   (medians over each arm\'s usable runs; [lowest .. highest run]; END = the 1932-1936 mean)');
console.log(`reference arm for every ratio: ${ref.label}\n`);
console.log('RUNS');
for (const a of arms) {
  console.log(`  ${padE(a.label, LW)}  n = ${a.runs.length}${a === ref ? '   (reference)' : ''}   ${a.spec.slice(a.label.length + 1)}`);
  for (const d of a.dropped) console.log(`  ${padE('', LW)}    NOT USABLE, left out (L17): ${d.run} of ${d.of}: reached ${d.reached} of ${d.until} - ${d.reason}`);
}

// one block: rows = years (or END), per arm "median [lo .. hi]" and, for non-reference arms, the ratio to the reference median
function block(title, note, rows, pick, get, { scale = 1, d = 2, unit = '', ratio = true, pct = false } = {}) {
  console.log(`\n${title}`); if (note) console.log(`  ${note}`);
  const cellW = 30;
  console.log('  ' + padE('', 6) + arms.map(a => padE(`${a.label}${unit ? ' ' + unit : ''}`, cellW) + (ratio && a !== ref ? padE(`/ ${ref.label}`, 9) : '')).join(''));
  for (const y of rows) {
    const refM = med(ref.data.map(r => val(r, y, pick, get)));
    let line = '  ' + padE(y, 6);
    for (const a of arms) {
      const v = a.data.map(r => val(r, y, pick, get)), m = med(v);
      const k = pct ? 100 : scale;
      line += padE(`${f(m * k, d)} [${f(lo(v) * k, d)} .. ${f(hi(v) * k, d)}]`, cellW);
      if (ratio && a !== ref) line += padE(Number.isFinite(m / refM) ? `${f(m / refM, 2)}x` : '-', 9);
    }
    console.log(line);
  }
}
const ROWS = [...YEARS.filter(y => arms.some(a => a.data.some(r => r.years.has(y)))), 'END'];

// 1. world GDP
block('1. WORLD GDP, as the game displays it (GBP M a year)', 'ratio = the arm\'s median / the reference arm\'s median, both in the row', ROWS, o => o.world, s => s.gdp, { scale: 1e-6, d: 0 });
block('   SHORTLIST GDP (GBR USA FRA NET BEL UNL PRU NGF GER, pooled; GBP M a year)', '', ROWS, o => o.pool, s => s.gdp, { scale: 1e-6, d: 0 });

// 2. the majors' GDP
function majorTable(title, note, get, { scale = 1, d = 2, pct = false, ratio = true } = {}) {
  console.log(`\n${title}`); if (note) console.log(`  ${note}`);
  for (const y of [1876, 1906, 'END'].filter(y => y === 'END' || arms.some(a => a.data.some(r => r.years.has(y))))) {
    console.log(`  -- ${y === 'END' ? 'END (1932-1936 mean)' : y}`);
    console.log('  ' + padE('', 6) + arms.map(a => padE(a.label, 30) + (ratio && a !== ref ? padE(`/ ${ref.label}`, 9) : '')).join(''));
    for (const m of majors) {
      const pick = o => o.majors[m.label];
      const refM = med(ref.data.map(r => val(r, y, pick, get)));
      let line = '  ' + padE(m.label, 6);
      for (const a of arms) {
        const v = a.data.map(r => val(r, y, pick, get)), mm = med(v), k = pct ? 100 : scale, nSeen = fnum(v).length;
        line += padE(`${f(mm * k, d)} [${f(lo(v) * k, d)} .. ${f(hi(v) * k, d)}]${nSeen < a.data.length ? ` n${nSeen}` : ''}`, 30);
        if (ratio && a !== ref) line += padE(Number.isFinite(mm / refM) ? `${f(mm / refM, 2)}x` : '-', 9);
      }
      console.log(line);
    }
  }
}
const majorNote = `majors: ${majors.map(m => m.mode === 'sum' ? `${m.label} = ${m.tags.join(' + ')}` : (m.tags.length > 1 ? `${m.label} = ${m.tags.join(' else ')}` : m.label)).join(', ')}.  nK = the major exists in only K of the arm's runs.`;
majorTable('2. THE MAJORS\' GDP (GBP M a year)', majorNote, s => s.gdp, { scale: 1e-6, d: 0 });

// 3. depeasantation
block('3. DEPEASANTATION', 'WORLD U* = (unemployed + peasants) / workforce, % (no ratio: read the percentages)', ROWS, o => o.world, s => s.U, { pct: true, d: 1, ratio: false });
block('   WORLD peasants / workforce, %', '', ROWS, o => o.world, s => s.P, { pct: true, d: 1, ratio: false });
block('   SHORTLIST U*, %', '', ROWS, o => o.pool, s => s.U, { pct: true, d: 1, ratio: false });
block('   WORLD W = productive workers per capita (salaried - government - military, / population)', 'ratio = the arm\'s median / the reference arm\'s median', ROWS, o => o.world, s => s.W, { d: 4 });
block('   SHORTLIST W', '', ROWS, o => o.pool, s => s.W, { d: 4 });
block('   WORLD GDP per productive worker (GBP a year)', 'W x this = GDP per capita', ROWS, o => o.world, s => s.Y, { d: 1 });
majorTable('   THE MAJORS\' U*, %', '', s => s.U, { pct: true, d: 1, ratio: false });

// 4. hoarding
block('4. HOARDING: the investment pool / yearly GDP', 'WORLD (every country\'s pool / world GDP; no ratio: read the levels)', ROWS, o => o.world, s => s.H, { d: 3, ratio: false });
block('   SHORTLIST pool / GDP', '', ROWS, o => o.pool, s => s.H, { d: 3, ratio: false });
// a rump state (Austria at 0.2M people and no GDP) reads as a hoard of thousands of GDP: a major under 5M people that year is left out
const HMIN = 5e6, bigH = s => s.pop >= HMIN ? s.H : NaN;
majorTable('   THE MAJORS\' pool / GDP', 'a major under 5M people that year is left out of the pool readings (a rump state; nK then counts it as absent)', bigH, { d: 2, ratio: false });
{ // how many majors sit above 0.5 GDP in 1935-36, per run (BALANCE_FRAMEWORK 10.113's level), and the 3-GDP flag
  console.log('\n   MAJORS WITH A POOL ABOVE 0.5 GDP IN 1935-36 (the mean of the two years), per run');
  for (const a of arms) {
    const counts = a.data.map(r => majors.filter(m => { const v = mean([1935, 1936].map(y => at(r, y, o => o.majors[m.label], bigH))); return v > 0.5; }).length);
    const who = {}; for (const r of a.data) for (const m of majors) { const v = mean([1935, 1936].map(y => at(r, y, o => o.majors[m.label], bigH))); if (v > 0.5) who[m.label] = (who[m.label] || 0) + 1; }
    console.log(`  ${padE(a.label, LW)}  median ${f(med(counts), 1)} of ${majors.length}  [${lo(counts)} .. ${hi(counts)}]   runs above, by major: ${Object.entries(who).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}/${a.data.length}`).join(', ') || 'none'}`);
  }
  console.log('\n   FLAG: a major with a pool above 3 GDP in 5 or more consecutive years while its U* is under 5% (10.113, provisional)');
  for (const a of arms) {
    const hits = [];
    for (const r of a.data) for (const m of majors) {
      let run = 0, best = 0, from = 0, bestFrom = 0;
      for (const y of [...r.years.keys()].sort((x, z) => x - z)) {
        const s = r.years.get(y).majors[m.label];
        if (s && s.pop >= HMIN && s.H > 3 && s.U < 0.05) { if (!run) from = y; run++; if (run > best) { best = run; bestFrom = from; } } else run = 0;
      }
      if (best >= 5) hits.push(`${m.label} ${bestFrom}-${bestFrom + best - 1} (${r.rel.split('/')[1]})`);
    }
    console.log(`  ${padE(a.label, LW)}  ${hits.length ? hits.length + ': ' + hits.join(', ') : 'none'}`);
  }
}

// 5. play time
if (wallSpecs.length) {
  const W = wallSpecs.map(groupRuns);
  for (const w of W) w.wall = w.runs.map(rel => { const dir = join(SES, rel); let meta = null; try { meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')); } catch {} return { rel, w: wallFromTicks(dir, meta), ty: yearTimes(dir).ty, resumes: +meta?.resumes || 0 }; });
  const wref = W.find(w => w.label === ref.label) || W[0];
  const sessions = new Set(W.flatMap(w => w.runs.map(r => r.split('/')[0])));
  console.log('\n5. PLAY TIME for the century, minutes (a player\'s wait: load + play, crash replays taken out)');
  if (sessions.size > 1) console.log(`  WARNING: these runs come from ${sessions.size} sessions (${[...sessions].join(', ')}). A wall clock compares only runs that alternated in ONE session.`);
  const refMed = med(wref.wall.map(x => x.w?.wall_play));
  for (const w of W) {
    const v = w.wall.map(x => x.w?.wall_play ?? NaN), m = med(v);
    console.log(`  ${padE(w.label, LW)}  n = ${fnum(v).length}   median ${f(m / 60, 1)}  [${f(lo(v) / 60, 1)} .. ${f(hi(v) / 60, 1)}]` +
      (w !== wref ? `   / ${wref.label} (${f(refMed / 60, 1)}) = ${f(m / refMed, 3)}x` : '   (reference)') + `   crash resumes: ${w.wall.reduce((s, x) => s + x.resumes, 0)}`);
  }
  console.log('\n   SECONDS PER IN-GAME YEAR, by decade (the median over runs of each run\'s mean over the decade)');
  const decs = []; for (let d = 1836; d < 1936; d += 10) decs.push(d);
  console.log('  ' + padE('', 11) + W.map(w => padE(w.label, 12) + (w !== wref ? padE(`/ ${wref.label}`, 10) : '')).join(''));
  for (const d of decs) {
    const dv = w => med(w.wall.map(x => mean(Array.from({ length: 10 }, (_, i) => +x.ty[d + i]))));
    const r0 = dv(wref); let line = '  ' + padE(`${d}-${d + 9}`, 11);
    for (const w of W) { const v = dv(w); line += padE(f(v, 1), 12) + (w !== wref ? padE(Number.isFinite(v / r0) ? `${f(v / r0, 2)}x` : '-', 10) : ''); }
    console.log(line);
  }
  console.log('  The fleet path loop cannot be observed on game 1.15 (landmine L52), so no run is set aside: every usable run counts.');
} else console.log('\n5. PLAY TIME: not printed (no --wall group; a wall clock is read inside one session only)');

console.log('\nNOTES');
console.log('  U*, W and the pool are read as criteria.mjs reads them. Cossack Hosts (game 1.15; BALANCE_FRAMEWORK 10.112) are not yet moved to the peasants.');
console.log('  Observer games: every country is played by the AI. A third-party arm is that mod as published + this repository\'s telemetry.');
console.log('  A country\'s LEVEL of GDP moves with its territory; its U* and pool / GDP are shares and travel better between runs.');
