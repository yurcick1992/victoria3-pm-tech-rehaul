// ⭐⭐ WALL CLOCK — DOES OUR MOD MAKE THE GAME SLOWER THAN VANILLA?
//
//   node tools/testbed/ledger/report_perf.mjs <sessionDir|runDir> [...] [--json <out>] [--bins N]
//
// ⚠⚠ THE WHOLE POINT, AND THE TRAP IT EXISTS TO AVOID: **A RAW WALL-CLOCK COMPARISON IS
// MEANINGLESS, AND ON OUR OWN DATA IT POINTS THE WRONG WAY.** In session 20260813_083557 the modded
// arm finished a century in 134.6-137.2 min against vanilla's 155.5-186.7 — the mod looks ~15% FASTER.
// It is not faster. It builds ~62% as many building levels and ends at a THIRD of vanilla's world GDP,
// so the engine simply had less economy to simulate. A smaller economy is cheaper per in-game year,
// and an underdeveloped one can hide a real per-unit slowdown completely.
//
// So the reading that counts is the **POP-MATCHED** one: the engine's cost scales with how many
// distinct pop objects it is stepping, so we compare seconds-per-in-game-year between the arms
// **at the same live pop-object count**, never at the same date and never in total.
//
// THE BUDGET (user-ruled 2026-08-18): **10% overall slowdown is acceptable**, measured pop-matched.
//
// Inputs, both already produced by every batch — nothing new is instrumented:
//   - <run>/meta.json                     -> wall_seconds, reached_ingame_date, resumes, abandoned_reason
//   - <run>/save_summaries/*.json.gz      -> per YEARLY save: provenance.date (in-game),
//                                            world.pop_objects_live, world.gdp, world buildings
//     and the archive FILENAME carries the wall-clock stamp (`NNNN_yyyymmdd_HHMMSS_autosave...`).
//
// ⚠ The filename stamp is the ARCHIVE time, not the engine's write time: archive_autosaves.ps1 only
// copies a save once its size and mtime have been stable for -StableSeconds. That lag is roughly
// constant, so it cancels in a RATE (a difference of two stamps) and is not corrected for. Do not
// read a single stamp as "the moment the game reached this date".
// ⚠ A RESUMED run restarts the game process, so an interval spanning a resume carries the crash and
// reload in its wall time. Those intervals are DROPPED, not smoothed, and counted in the report.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const optOf = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
// ⚠ an option's VALUE is not a directory — drop both the flag and the token after it, or
// `--json out.json` gets scanned as a session folder and the tool dies on ENOENT.
const OPTS = ['json', 'bins'];
const consumed = new Set();
for (const k of OPTS) { const i = args.indexOf('--' + k); if (i >= 0) { consumed.add(i); consumed.add(i + 1); } }
const dirs = args.filter((a, i) => !a.startsWith('--') && !consumed.has(i));
const BINS = +(optOf('bins') ?? 14);
const JSON_OUT = optOf('json');
if (!dirs.length) { console.error('usage: report_perf.mjs <sessionDir|runDir> [...] [--json out.json] [--bins N]'); process.exit(1); }

const asYear = d => { const [y, m = 1, dd = 1] = String(d).split('.').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
const stampOf = f => {                       // 0100_20260813_111129_autosave.json.gz -> epoch seconds
  const m = basename(f).match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi, S] = m.map(Number);
  return Date.UTC(Y, Mo - 1, D, H, Mi, S) / 1000;   // UTC throughout; only differences are used
};

// ---- collect runs -----------------------------------------------------------------------------
const runDirs = [];
for (const d of dirs) {
  if (existsSync(join(d, 'meta.json'))) { runDirs.push(d); continue; }
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory() && existsSync(join(p, 'meta.json'))) runDirs.push(p);
  }
}

const runs = [];
for (const rp of runDirs) {
  const meta = JSON.parse(readFileSync(join(rp, 'meta.json'), 'utf8'));
  const label = rp.split(/[\\/]/).slice(-2).join('/');
  // arm: prefer the machine-read build_state, fall back to the folder name
  let arm = null;
  const bs = join(rp, 'build_state.json');
  if (existsSync(bs)) { try { arm = JSON.parse(readFileSync(bs, 'utf8'))?.deterministic?.arm ?? null; } catch { } }
  const setup = basename(rp).replace(/^run\d+_/, '');
  const isVanilla = arm === 'control' || /vanilla|control/i.test(setup);

  const sd = join(rp, 'save_summaries');
  const series = [];
  if (existsSync(sd)) {
    for (const f of readdirSync(sd).filter(x => x.endsWith('.gz')).sort()) {
      const w = stampOf(f); if (w == null) continue;
      let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f)))); } catch { continue; }
      const date = j?.provenance?.date; if (!date) continue;
      const lv = Object.values(j?.world?.buildings ?? {}).reduce((s, b) => s + (b.levels || 0), 0);
      series.push({
        wall: w, year: asYear(date), date,
        pops: j?.world?.pop_objects_live ?? null,
        population: j?.world?.population ?? null,
        gdp: j?.world?.gdp ?? null,
        levels: lv,
      });
    }
  }
  series.sort((a, b) => a.wall - b.wall);

  // per-interval rate: seconds of wall clock per in-game year
  const pts = [];
  let dropped = 0;
  for (let i = 1; i < series.length; i++) {
    const dy = series[i].year - series[i - 1].year;
    const dw = series[i].wall - series[i - 1].wall;
    // a resume, a clock oddity, or a stall: drop rather than smooth
    if (dy <= 0 || dw <= 0 || dw > 3600) { dropped++; continue; }
    pts.push({ year: series[i].year, pops: series[i].pops, gdp: series[i].gdp, levels: series[i].levels, secPerYear: dw / dy });
  }

  const complete = meta.reached_ingame_date === meta.until_date && !meta.abandoned_reason;
  runs.push({
    label, setup, arm: arm ?? (isVanilla ? 'control' : 'config'), isVanilla,
    wall_seconds: meta.wall_seconds, reached: meta.reached_ingame_date, until: meta.until_date,
    resumes: meta.resumes ?? 0, abandoned: meta.abandoned_reason || '', complete,
    endPops: series.at(-1)?.pops ?? null, endGdp: series.at(-1)?.gdp ?? null, endLevels: series.at(-1)?.levels ?? null,
    nSaves: series.length, droppedIntervals: dropped, pts, series,
  });
}

// ---- 1. the naive reading (shown so it can be dismissed on the page) --------------------------
const fmtMin = s => (s / 60).toFixed(1);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

console.log('\n=== RUNS ===');
console.log('run                                  arm       wall(min)  reached      pops(live)   levels   status');
for (const r of runs) {
  console.log(`${r.label.padEnd(36)} ${(r.isVanilla ? 'vanilla' : 'mod').padEnd(8)} ${fmtMin(r.wall_seconds).padStart(9)}  ${String(r.reached).padEnd(12)} ` +
    `${String(r.endPops ?? '-').padStart(10)} ${String(r.endLevels ?? '-').padStart(8)}   ${r.complete ? 'ok' : 'INCOMPLETE:' + (r.abandoned || 'short')}`);
}

const good = runs.filter(r => r.complete);
const van = good.filter(r => r.isVanilla), mod = good.filter(r => !r.isVanilla);
console.log('\n=== 1. NAIVE TOTAL WALL CLOCK  (⚠ NOT the verdict — see 3) ===');
const tot = a => a.length ? `${a.map(r => fmtMin(r.wall_seconds)).join(' / ')} min   median ${fmtMin(median(a.map(r => r.wall_seconds)))}` : '(none)';
console.log(`  vanilla (n=${van.length}): ${tot(van)}`);
console.log(`  mod     (n=${mod.length}): ${tot(mod)}`);
if (van.length && mod.length) {
  const rr = median(mod.map(r => r.wall_seconds)) / median(van.map(r => r.wall_seconds));
  console.log(`  raw ratio mod/vanilla = ${rr.toFixed(3)}  (${rr < 1 ? 'mod finishes SOONER' : 'mod finishes LATER'})`);
  const pr = median(mod.map(r => r.endPops)) / median(van.map(r => r.endPops));
  const lr = median(mod.map(r => r.endLevels)) / median(van.map(r => r.endLevels));
  console.log(`  ⚠ but the arms did not simulate the same thing: live pop objects ×${pr.toFixed(2)}, building levels ×${lr.toFixed(2)} of vanilla.`);
}

// ---- 2. per-decade rate (the shape, for the chart) ---------------------------------------------
const byDecade = rs => {
  const b = {};
  for (const r of rs) for (const p of r.pts) { const d = Math.floor(p.year / 10) * 10; (b[d] ??= []).push(p.secPerYear); }
  return Object.fromEntries(Object.entries(b).map(([d, v]) => [d, median(v)]));
};
const decV = byDecade(van), decM = byDecade(mod);
console.log('\n=== 2. SECONDS PER IN-GAME YEAR, BY DECADE (median) ===');
console.log('  decade   vanilla    mod     mod/van');
for (const d of [...new Set([...Object.keys(decV), ...Object.keys(decM)])].map(Number).sort((a, b) => a - b)) {
  const a = decV[d], c = decM[d];
  console.log(`  ${d}s   ${(a ? a.toFixed(1) : '-').padStart(7)}  ${(c ? c.toFixed(1) : '-').padStart(7)}   ${a && c ? (c / a).toFixed(3).padStart(7) : '      -'}`);
}

// ---- 3. ⭐ THE VERDICT: POP-MATCHED SLOWDOWN ---------------------------------------------------
// Bin both arms by LIVE POP OBJECTS and compare only bins where both arms have samples. This is the
// reading the 10% budget is written against.
let matched = null;
if (van.length && mod.length) {
  const allPops = [...van, ...mod].flatMap(r => r.pts.map(p => p.pops)).filter(Number.isFinite);
  const lo = Math.min(...allPops), hi = Math.max(...allPops);
  const edge = i => lo + (hi - lo) * i / BINS;
  const binOf = p => Math.min(BINS - 1, Math.max(0, Math.floor((p - lo) / (hi - lo) * BINS)));
  const acc = () => Array.from({ length: BINS }, () => []);
  const bv = acc(), bm = acc();
  for (const r of van) for (const p of r.pts) if (Number.isFinite(p.pops)) bv[binOf(p.pops)].push(p.secPerYear);
  for (const r of mod) for (const p of r.pts) if (Number.isFinite(p.pops)) bm[binOf(p.pops)].push(p.secPerYear);

  console.log('\n=== 3. ⭐ POP-MATCHED: seconds per in-game year at the SAME live pop-object count ===');
  console.log('  live pop objects        vanilla    mod    mod/van   (nV,nM)');
  const rows = [], ratios = [];
  for (let i = 0; i < BINS; i++) {
    const a = median(bv[i]), c = median(bm[i]);
    const lab = `${(edge(i) / 1000).toFixed(0)}-${(edge(i + 1) / 1000).toFixed(0)}k`;
    rows.push({ bin: lab, lo: edge(i), hi: edge(i + 1), vanilla: a, mod: c, nV: bv[i].length, nM: bm[i].length });
    if (a && c) {
      ratios.push(c / a);
      console.log(`  ${lab.padEnd(20)} ${a.toFixed(1).padStart(8)} ${c.toFixed(1).padStart(7)}  ${(c / a).toFixed(3).padStart(8)}   (${bv[i].length},${bm[i].length})`);
    } else {
      console.log(`  ${lab.padEnd(20)} ${(a ? a.toFixed(1) : '-').padStart(8)} ${(c ? c.toFixed(1) : '-').padStart(7)}         -   (${bv[i].length},${bm[i].length})`);
    }
  }
  if (ratios.length) {
    const overall = median(ratios);
    const pct = (overall - 1) * 100;
    const verdict = pct <= 10 ? (pct <= 0 ? 'PASS (no slowdown)' : 'PASS') : 'OVER BUDGET';
    console.log(`\n  overlapping bins: ${ratios.length}/${BINS}   range ${Math.min(...ratios).toFixed(3)}-${Math.max(...ratios).toFixed(3)}`);
    console.log(`  ⭐ POP-MATCHED SLOWDOWN = ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%   budget +10%   => ${verdict}`);
    if (ratios.length < BINS / 3) console.log('  ⚠ FEW OVERLAPPING BINS — the arms barely reached the same size; treat the figure as indicative only.');
    matched = { bins: rows, overlapping: ratios.length, ratio: overall, pct, verdict, budgetPct: 10 };
  } else {
    console.log('  ⚠⚠ NO OVERLAPPING BINS AT ALL — the two arms never simulated a comparable economy, so');
    console.log('     wall clock CANNOT be compared between them. Report this, do not substitute the raw total.');
    matched = { bins: rows, overlapping: 0, ratio: null, pct: null, verdict: 'NOT COMPARABLE', budgetPct: 10 };
  }
}

const dropped = runs.reduce((s, r) => s + r.droppedIntervals, 0);
if (dropped) console.log(`\n⚠ ${dropped} interval(s) dropped across all runs (resume / stall / clock gap).`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({
    generated_utc: new Date().toISOString(),
    runs: runs.map(({ pts, series, ...r }) => ({ ...r, curve: pts.map(p => ({ y: +p.year.toFixed(2), pops: p.pops, gdp: p.gdp, levels: p.levels, spy: +p.secPerYear.toFixed(2) })) })),
    byDecade: { vanilla: decV, mod: decM },
    matched,
  }, null, 1));
  console.log(`\nwrote ${JSON_OUT}`);
}
