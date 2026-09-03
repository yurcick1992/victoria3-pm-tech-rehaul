// A MID-BATCH HEADLINE READ — deliberately small, deliberately caveated.
//
// Three questions, at 1935, for the world and the twelve majors:
//   1. GDP against vanilla, DECOMPOSED as productive workers x GDP per productive worker (goal G5).
//   2. Did the distribution of industry shift — standing levels by sector/industry/era.
//   3. Do the industry research events still fire often enough.
//
// ⚠⚠ THIS IS NOT A REPORT AND ITS n IS WHATEVER HAS FINISHED. canon-n7 measured 71% spread on world
// GDP across six byte-identical runs, so a single run says nothing about GDP in either direction; the
// figures below are quoted so the SHAPE can be watched, not so a verdict can be taken on them. The
// per-run spread of the comparison arm is printed beside every world number for exactly that reason.
//
// ⭐ QUESTION 3 IS NOT INDEPENDENT OF THE LADDER, and that is the point of asking it. The research
// bars are fed by EMPLOYMENT IN THE PREDECESSOR TIER, so an ai_value ladder that stops the AI building
// low rungs necessarily starves the bars that those rungs fill. A fall here is a predicted side effect,
// not a surprise.
//
// ⚠ JE firings are counted as DISTINCT (stage, technology, country) triples, never raw log lines —
// landmine L23 measured raw lines overcounting 2.25x in burst ticks.
// ⚠ "Productive workers" is the panel's own definition: salaried workforce minus the staffing of
// government administration, universities and the military buildings (fill_consts.mjs's NONPROD).
//
// USAGE: node tools/testbed/ledger/peek_run.mjs --session <stamp> [--vs <stamp>] [--van <stamp>]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { usableRuns } from './lib_runs.mjs';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SES = 'tools/testbed/sessions';
const YEAR = +argOf('--year', '1935');
const MAJORS = ['GBR', 'RUS', 'FRA', 'USA', 'PRU', 'TUR', 'AUS', 'SPA', 'BRZ', 'SIC', 'POR', 'NET'];

const NONPROD = k => k === 'building_government_administration' || k === 'building_university'
  || /barracks|barrack|conscription|naval_base|port_military|army_logistics/.test(k);

const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = n => Math.round(n).toLocaleString();
const rat = (a, b) => b ? (a / b).toFixed(2) + '×' : '—';

// ---------------------------------------------------------------- ladder ----
const cfg = JSON.parse(readFileSync(argOf('--config', 'config/mod_config.json'), 'utf8'));
const KEY2 = {};
for (const ind of (cfg.industries || []).filter(i => !i.disabled))   // a disabled industry's rung-0 key IS the vanilla building (BUGS_AND_FIXES 2026-09-03)
  (ind.tiers || []).forEach((t, i) => { if (t.key) KEY2[t.key] = { ind: ind.id, idx: i, era: t.era ?? 0, wm: +(t.workforce_mult ?? 1) }; });

// ---------------------------------------------------------------- one run at YEAR ----
function snapshot(runDir) {
  const dir = join(SES, runDir, 'save_summaries');
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    if (+(j.provenance.date || '0').split('.')[0] !== YEAR) continue;
    const W = { gdp: 0, sal: 0, gov: 0, lv: 0, ind: {}, era: {}, tierLv: 0 };
    const T = {};
    for (const [tag, c] of Object.entries(j.countries)) {
      const g = +c.gdp || 0, sal = +(c.pop_statistics?.population_salaried_workforce) || 0;
      let gov = 0, lv = 0;
      for (const [k, b] of Object.entries(c.buildings || {})) {
        const n = b.levels || 0; lv += n;
        if (NONPROD(k)) gov += b.staffing || 0;
        const t = KEY2[k];
        if (t) { W.ind[t.ind] = (W.ind[t.ind] || 0) + n; W.era[t.era] = (W.era[t.era] || 0) + n; W.tierLv += n; }
      }
      W.gdp += g; W.sal += sal; W.gov += gov; W.lv += lv;
      if (MAJORS.includes(tag)) T[tag] = { gdp: g, w: Math.max(0, sal - gov), lv };
    }
    W.w = Math.max(0, W.sal - W.gov);
    return { world: W, tags: T };
  }
  return null;
}

// accepts '<session>' or '<session>:<setup>' — a multi-arm session REQUIRES the suffix
function split(spec) { const i = spec.indexOf(':'); return i < 0 ? [spec, ''] : [spec.slice(0, i), spec.slice(i + 1)]; }
function arm(spec, label) {
  const [session, setup] = split(spec);
  const { runs } = usableRuns(SES, session, setup);
  const snaps = runs.map(snapshot).filter(Boolean);
  if (!snaps.length) return null;
  return { label, session, spec, n: snaps.length, snaps };
}

const wv = (a, f) => a.snaps.map(s => f(s.world));
const worldMed = (a, f) => med(wv(a, f));
const worldRange = (a, f) => { const v = wv(a, f); return [Math.min(...v), Math.max(...v)]; };

// ---------------------------------------------------------------- research ----
function jeCount(spec) {
  const [session, setup] = split(spec);
  const { runs } = usableRuns(SES, session, setup);
  const per = [];
  for (const r of runs) {
    const log = join(SES, r, 'logs_live', 'debug.log');
    if (!existsSync(log)) continue;
    const seen = new Set(); const byStage = {};
    for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('PMR_JE|'); if (i < 0) continue;
      const p = line.slice(i + 7).trim().split('|'); if (p.length < 3) continue;
      const key = p[0] + '|' + p[1] + '|' + p[2];
      if (seen.has(key)) continue; seen.add(key);
      byStage[p[0]] = (byStage[p[0]] || 0) + 1;
    }
    if (Object.keys(byStage).length) per.push({ byStage, distinct: seen.size, techs: new Set([...seen].map(k => k.split('|')[1])).size });
  }
  return per;
}

// ---------------------------------------------------------------- main ----
const A = arm(argOf('--session', ''), 'ARM');
if (!A) { console.error('no usable runs in --session'); process.exit(1); }
const B = argOf('--vs', '') ? arm(argOf('--vs', ''), 'canon') : null;
const V = argOf('--van', '') ? arm(argOf('--van', ''), 'vanilla') : null;

console.log(`\n================ HEADLINE READ AT ${YEAR} ================`);
console.log(`  arm      ${A.spec}  n=${A.n}`);
if (B) console.log(`  vs       ${B.spec}  n=${B.n}`);
if (V) console.log(`  vanilla  ${V.spec}  n=${V.n}`);
console.log(`\n⚠ n=${A.n} on the arm. canon-n7 measured a 71% spread on world GDP across six byte-identical`);
console.log(`  runs, so the comparison arm's own RANGE is printed beside every world figure. A number`);
console.log(`  inside that range is not a result.`);

console.log('\n--- 1. WORLD GDP, DECOMPOSED (G5) ---');
const cols = [['arm', A], B && ['canon-n7', B], V && ['vanilla', V]].filter(Boolean);
console.log('                       GDP £M            prod. workers        GDP / worker');
for (const [name, a] of cols) {
  const g = worldMed(a, w => w.gdp / 1e6), gr = worldRange(a, w => w.gdp / 1e6);
  const w = worldMed(a, x => x.w / 1e6), wr = worldRange(a, x => x.w / 1e6);
  const p = worldMed(a, x => x.gdp / (x.w || 1)), pr = worldRange(a, x => x.gdp / (x.w || 1));
  console.log(`  ${(name + ' (n=' + a.n + ')').padEnd(18)} ${fmt(g).padStart(7)} [${fmt(gr[0])}–${fmt(gr[1])}]   ${w.toFixed(1).padStart(6)}M [${wr[0].toFixed(1)}–${wr[1].toFixed(1)}]   £${p.toFixed(0).padStart(4)} [${pr[0].toFixed(0)}–${pr[1].toFixed(0)}]`);
}
if (V) {
  const r = (a, f) => worldMed(a, f) / worldMed(V, f);
  console.log('\n  ÷ vanilla:            GDP        workers    GDP/worker    (G5 wants workers ≤0.90×, GDP/worker ≥1.11×)');
  for (const [name, a] of cols) {
    if (a === V) continue;
    console.log(`  ${name.padEnd(20)} ${rat(worldMed(a, w => w.gdp), worldMed(V, w => w.gdp)).padStart(6)}     ${rat(worldMed(a, w => w.w), worldMed(V, w => w.w)).padStart(6)}       ${rat(worldMed(a, w => w.gdp / (w.w || 1)), worldMed(V, w => w.gdp / (w.w || 1))).padStart(6)}`);
  }
}

console.log('\n--- 1b. THE SAME, PER MAJOR (arm ÷ vanilla, and arm ÷ canon-n7) ---');
console.log('  tag     GDP £M   GDP÷van  GDP÷canon   workers÷van  GDP/wkr÷van  GDP/wkr÷canon');
const tagMed = (a, tag, f) => { const v = a.snaps.map(s => s.tags[tag]).filter(Boolean).map(f); return v.length ? med(v) : null; };
for (const tag of MAJORS) {
  const g = tagMed(A, tag, t => t.gdp);
  if (g == null) { console.log(`  ${tag}     (absent from the arm at ${YEAR} — dissolved or annexed)`); continue; }
  const gv = V && tagMed(V, tag, t => t.gdp), gc = B && tagMed(B, tag, t => t.gdp);
  const w = tagMed(A, tag, t => t.w), wv2 = V && tagMed(V, tag, t => t.w);
  const pw = tagMed(A, tag, t => t.gdp / (t.w || 1));
  const pwv = V && tagMed(V, tag, t => t.gdp / (t.w || 1)), pwc = B && tagMed(B, tag, t => t.gdp / (t.w || 1));
  console.log(`  ${tag}   ${fmt(g / 1e6).padStart(7)}   ${(gv ? rat(g, gv) : '—').padStart(7)}  ${(gc ? rat(g, gc) : '—').padStart(8)}    ${(wv2 ? rat(w, wv2) : '—').padStart(8)}     ${(pwv ? rat(pw, pwv) : '—').padStart(8)}      ${(pwc ? rat(pw, pwc) : '—').padStart(8)}`);
}

console.log('\n--- 2. INDUSTRY DISTRIBUTION: STANDING TIER LEVELS AT ' + YEAR + ' ---');
console.log('  (share of all levels standing in OUR tier buildings; absolute beside it)');
const indAll = [...new Set([...cols.flatMap(([, a]) => a.snaps.flatMap(s => Object.keys(s.world.ind)))])];
const indMed = (a, id) => med(a.snaps.map(s => s.world.ind[id] || 0));
const tierMed = a => med(a.snaps.map(s => s.world.tierLv));
console.log('  industry          arm lv   arm %    canon lv  canon %     Δshare   arm/canon');
const rows2 = indAll.map(id => {
  const aa = indMed(A, id), bb = B ? indMed(B, id) : null;
  const as = 100 * aa / (tierMed(A) || 1), bs = bb == null ? null : 100 * bb / (tierMed(B) || 1);
  return { id, aa, bb, as, bs };
}).sort((x, y) => (y.bs == null ? y.as : Math.abs(y.as - y.bs)) - (x.bs == null ? x.as : Math.abs(x.as - x.bs)));
for (const r of rows2)
  console.log(`  ${r.id.padEnd(16)} ${fmt(r.aa).padStart(7)}  ${r.as.toFixed(2).padStart(6)}%  ${(r.bb == null ? '—' : fmt(r.bb)).padStart(9)}  ${(r.bs == null ? '—' : r.bs.toFixed(2) + '%').padStart(7)}   ${(r.bs == null ? '—' : ((r.as - r.bs >= 0 ? '+' : '') + (r.as - r.bs).toFixed(2) + 'pp')).padStart(8)}   ${(r.bb == null ? '—' : rat(r.aa, r.bb)).padStart(7)}`);

console.log('\n  --- era mix of STANDING tier levels (the ladder is aimed straight at this) ---');
console.log('  era      arm lv   arm %    canon lv  canon %     Δshare   arm/canon');
for (const e of [0, 1, 2, 3, 4, 5]) {
  const aa = med(A.snaps.map(s => s.world.era[e] || 0));
  const bb = B ? med(B.snaps.map(s => s.world.era[e] || 0)) : null;
  const as = 100 * aa / (tierMed(A) || 1), bs = bb == null ? null : 100 * bb / (tierMed(B) || 1);
  console.log(`  e${e}     ${fmt(aa).padStart(7)}  ${as.toFixed(2).padStart(6)}%  ${(bb == null ? '—' : fmt(bb)).padStart(9)}  ${(bs == null ? '—' : bs.toFixed(2) + '%').padStart(7)}   ${(bs == null ? '—' : ((as - bs >= 0 ? '+' : '') + (as - bs).toFixed(2) + 'pp')).padStart(8)}   ${(bb == null ? '—' : rat(aa, bb)).padStart(7)}`);
}

console.log('\n--- 3. RESEARCH EVENTS: distinct (stage, tech, country) triples per run ---');
console.log('  ⭐ NOT independent of the ladder: the bars are fed by EMPLOYMENT IN THE PREDECESSOR TIER,');
console.log('     so fewer low rungs built => fewer bar ticks. A fall here is a predicted side effect.');
for (const [name, a] of cols) {
  if (!a) continue;
  const per = jeCount(a.spec);
  if (!per.length) { console.log(`  ${name.padEnd(12)} no PMR_JE lines (research_events off, or logs rotated away)`); continue; }
  const stages = [...new Set(per.flatMap(p => Object.keys(p.byStage)))].sort();
  const line = stages.map(s => `${s} ${fmt(med(per.map(p => p.byStage[s] || 0)))}`).join(' · ');
  console.log(`  ${name.padEnd(12)} n=${per.length}  total ${fmt(med(per.map(p => p.distinct)))} · techs ${fmt(med(per.map(p => p.techs)))} · ${line}`);
  if (per.length > 1) console.log(`  ${' '.padEnd(12)} per-run totals: ${per.map(p => fmt(p.distinct)).join(' / ')}`);
}
console.log('');
