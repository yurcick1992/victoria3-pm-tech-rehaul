// THE ENGINE OVERHEAD A BOOK ADDS, PERIOD BY PERIOD — seconds per in-game year beyond what vanilla's engine would need for a world
// of the same size (FINDINGS F217, 2026-10-04: "dive deep and try explaining the early-game wall-clock dip").
//
//   node tools/testbed/ledger/tick_overhead.mjs --van <label>=<session[,session]>[:<setup>] [--van …]
//        --arm <label>=<session[,session]>[:<setup>] [--arm …] [--json out.json]
//
// Per usable run (lib_runs: reached its until date, no abandoned_reason):
//   1. COST from the observer's 20-second tick lines in run.log (elapsed wall, in-game date), summed per period over ticks that do
//      NOT contain an autosave (the ticks crossing the 1st of a save month under the session's own autosave_interval), so batches of
//      different save cadence compare. ⚠ Quarterly-cadence runs still read dearer than yearly ones with the save ticks out (the
//      early game writes a save every ~15 s of wall), so compare like cadence with like; a `monthly` session is skipped.
//      The save-archive stamps report_perf.mjs uses carry the save stall and a near-constant archive lag; this reads the game's own
//      progress, which is what resolves a 2–3 s difference.
//   2. SIZE from the save summaries at each period's anchor year: live pop objects, summed building levels, world GDP.
// Per arm and period: overhead = observed − vanilla's mean × the run's size ratio, mean ± 2·SE over the arm's runs, under the two
// size models FINDINGS F120 fitted on 170 runs — `pops+GDP` (38.0 + 0.525·kpops + 0.012·£M GDP, the best linear fit) and `log`
// (pops^0.272 × levels^0.708). ⚠ They disagree where a book changes LEVELS without changing the economy (the craft rungs carry ×10
// levels for their employment): the log model charges those levels as size, the pops+GDP model does not (F120 §4: levels are a size
// proxy, not a per-level charge). Quote both where they differ.
// ⚠ Different nights: the vanilla reference ran on other nights than the arm. Early-game vanilla reproduced to ±1 s over a month
// (2026-08-21 vs 2026-09-20); mid-August vanilla sessions with heavier telemetry ran ~8% dearer. Read a same-night A/B where one exists.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SESS = path.join(ROOT, 'tools/testbed/sessions');
const args = process.argv.slice(2);
const all = k => args.flatMap((a, i) => a === k ? [args[i + 1]] : []);
const jsonOut = all('--json')[0];
const vanSpecs = all('--van'), armSpecs = all('--arm');
if (!vanSpecs.length || !armSpecs.length) { console.error('usage: tick_overhead.mjs --van label=session[,session][:setup] --arm label=session[,session][:setup] [--arm …] [--json out]'); process.exit(1); }
const PERIODS = [[1836, 1840], [1840, 1845], [1845, 1850], [1850, 1860], [1860, 1870], [1870, 1880], [1880, 1890], [1890, 1900], [1900, 1910], [1910, 1920], [1920, 1930], [1930, 1936]];
const ANCHOR = [1840, 1840, 1840, 1860, 1860, 1880, 1880, 1900, 1900, 1920, 1920, 1935];
const SAVE_MONTHS = { yearly: [1], quarteryear: [1, 4, 7, 10], halfyear: [1, 7], five_year: [], never: [] };
const hms = s => { const [h, m, x] = s.split(':').map(Number); return h * 3600 + m * 60 + x; };
const parseDate = d => { const [y, m, dd] = d.split('.').map(Number); return { y, m, day: y * 365.25 + (m - 1) * 30.44 + dd }; };
const asYear = d => { const [y, m = 1, dd = 1] = d.split('.').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };

function readRun(rel) {
  const rd = path.join(SESS, rel);
  const session = rel.split('/')[0];
  let cad = 'yearly';
  try { const s = JSON.parse(fs.readFileSync(path.join(SESS, session, 'schedule.json'), 'utf8')); cad = s?.defaults?.autosave_interval || s?.runs?.[0]?.autosave_interval || 'five_year'; } catch {}
  const months = SAVE_MONTHS[cad]; if (!months) return null;
  // 1. cost from the ticks
  const tk = []; let off = 0, last = -1;
  for (const l of fs.readFileSync(path.join(rd, 'run.log'), 'utf8').split(/\r?\n/)) {
    const m = /^\[(\d\d:\d\d:\d\d)\].*?\.\.\.\s*[\d\s]+s\s+in-game (\d+\.\d+\.\d+)/.exec(l); if (!m) continue;
    let t = hms(m[1]) + off; if (t < last - 3600) { off += 86400; t += 86400; } last = t; tk.push({ t, ...parseDate(m[2]) });
  }
  const acc = PERIODS.map(() => ({ w: 0, d: 0 }));
  for (let i = 1; i < tk.length; i++) {
    const a = tk[i - 1], b = tk[i], dt = b.t - a.t, dd = b.day - a.day;
    if (dt < 10 || dt > 40 || dd <= 0 || dd > 400) continue;   // a resume, a stall, a backward jump: dropped, never smoothed
    if ((a.y !== b.y || a.m !== b.m) && months.includes(b.m)) continue;   // the tick that wrote an autosave
    const k = PERIODS.findIndex(([p0, p1]) => a.day / 365.25 >= p0 && a.day / 365.25 < p1); if (k < 0) continue;
    acc[k].w += dt; acc[k].d += dd;
  }
  const spy = acc.map(a => a.d > 200 ? 365.25 * a.w / a.d : null);
  // 2. size at the anchor years (the first summary of each year; the provenance date sits in the first 4 KB of the gz)
  const sd2 = path.join(rd, 'save_summaries'); const first = {};
  for (const f of fs.readdirSync(sd2).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.'))) {
    const fd = fs.openSync(path.join(sd2, f), 'r'); const b = Buffer.alloc(4096); const n = fs.readSync(fd, b, 0, 4096, 0); fs.closeSync(fd);
    let t = ''; try { t = zlib.gunzipSync(b.subarray(0, n), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString(); } catch { continue; }
    const m = /"date":"([0-9.]+)"/.exec(t); if (!m) continue; const y = Math.floor(asYear(m[1]) + 1e-9);
    if (ANCHOR.includes(y) && (!first[y] || asYear(m[1]) < first[y].y)) first[y] = { y: asYear(m[1]), f: path.join(sd2, f) };
  }
  const size = {};
  for (const [y, e] of Object.entries(first)) {
    try { const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(e.f)));
      size[y] = { pops: j.world?.pop_objects_live, lv: Object.values(j.world?.buildings || {}).reduce((s, x) => s + (x.levels || 0), 0), gdp: j.world?.gdp }; } catch {}
  }
  return { rel, cad, spy, size };
}
function readSpec(spec) {
  const [label, rest] = spec.split('='); const [sessions, setup] = rest.split(':');
  const { runs, dropped } = usableRuns(SESS, sessions, setup || '');
  for (const d of dropped) console.log(`  [${label}] dropped ${d.run}: ${d.reason}`);
  return { label, runs: runs.map(readRun).filter(Boolean) };
}
const van = vanSpecs.map(readSpec); const vRuns = van.flatMap(v => v.runs);
const vCost = k => mean(vRuns.map(r => r.spy[k]).filter(Number.isFinite));
const vSize = (y, f) => mean(vRuns.map(r => r.size[y]?.[f]).filter(Number.isFinite));
const MODEL = {
  'pops+GDP': (s, y) => (38.0 + 0.525 * s.pops / 1e3 + 0.012 * s.gdp / 1e6) / (38.0 + 0.525 * vSize(y, 'pops') / 1e3 + 0.012 * vSize(y, 'gdp') / 1e6),
  'log': (s, y) => Math.pow(s.pops / vSize(y, 'pops'), 0.272) * Math.pow(s.lv / vSize(y, 'lv'), 0.708),
};
const label = p => `${p[0]}-${String(p[1]).slice(2)}`;
console.log(`\nREFERENCE ${van.map(v => v.label + ' n' + v.runs.length).join(' + ')}: seconds per in-game year (clean ticks)`);
console.log('  ' + PERIODS.map((p, k) => (label(p) + ' ' + vCost(k).toFixed(1)).padEnd(15)).join(''));
const out = { reference: van.map(v => v.label), vanilla: PERIODS.map((p, k) => vCost(k)), arms: {} };
for (const spec of armSpecs) {
  const a = readSpec(spec);
  out.arms[a.label] = { n: a.runs.length, cadence: [...new Set(a.runs.map(r => r.cad))], periods: {} };
  console.log(`\nARM ${a.label} n${a.runs.length} (${[...new Set(a.runs.map(r => r.cad))].join('/')} saves): observed · overhead (mean ± 2·SE) under each size model · (size ratio)`);
  for (const [k, p] of PERIODS.entries()) {
    const y = ANCHOR[k]; const obs = a.runs.map(r => r.spy[k]).filter(Number.isFinite); if (obs.length < 2) continue;
    const row = { observed: mean(obs), vanilla: vCost(k) };
    let line = `  ${label(p).padEnd(8)} ${mean(obs).toFixed(1).padStart(6)} vs ${vCost(k).toFixed(1).padStart(6)}`;
    for (const [mName, f] of Object.entries(MODEL)) {
      const ov = [], sr = [];
      for (const r of a.runs) { const o = r.spy[k], s = r.size[y]; if (!Number.isFinite(o) || !s?.pops) continue; const q = f(s, y); sr.push(q); ov.push(o - vCost(k) * q); }
      if (ov.length < 2) continue;
      row[mName] = { overhead: mean(ov), se2: 2 * sd(ov) / Math.sqrt(ov.length), size: mean(sr) };
      line += `  | ${mName} ${(mean(ov) >= 0 ? '+' : '') + mean(ov).toFixed(1)}±${(2 * sd(ov) / Math.sqrt(ov.length)).toFixed(1)} (${mean(sr).toFixed(2)})`;
    }
    out.arms[a.label].periods[label(p)] = row;
    console.log(line);
  }
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
