// THE "WAR TAX" ON WALL CLOCK — how much of a century run's tick time do heavy wars explain? (2026-10-13, user-asked: "Does vanilla data
// support a measurable 'war tax' on performance of any sort? … the slowdown episodes are explained by ultra-heavy wars, and that makes up
// 80% of the slowdowns, so removing them would remove 3% of overall 100-year wall clock time"). EXPLANATORY ONLY — by the user's ruling the
// tax is never deducted from a wall-clock measurement (FINDINGS F230).
//
//   node tools/testbed/ledger/war_tax.mjs [--runs <session>[:<setup>][,…]] [--window 7] [--detail] [--wars] [--json <file>]
//   (no --runs = every vanilla century run with a tick log and yearly save summaries)
//
// THE MEASURES, per run and in-game year Y (1838 … 1935):
//   t(Y)   wall seconds per in-game year from the game's own per-tick log — slow_quarantine.mjs's yearTimes(): every tick except those on a
//          month boundary (the autosave and the monthly pulse), scaled to 1,460 ticks. The shares below are shares of that TICK time.
//   War    THE WAR INDEX, from events.tsv (independent of the tick log): the number of MAJOR-v-MAJOR wars on during Y, each weighted by the
//          fraction of Y it covers. A war ENDS on a date where ≥ 2 major powers log PEACE (its two leaders) and STARTED at the latest earlier
//          WARSTART whose target is one of those leaders (≤ 12 years before, each WARSTART used once) — F218 §4's reconstruction, tightened;
//          on 20261012_224416 run 3 it recovers the three wars that save's war_manager holds (716, 728, 736) to the day.
//   M      A SECOND, weaker war index: the world's military workforce share minus its ±W-year rolling median (pp), Y = mean of 1.1.Y and
//          1.1.(Y+1). It catches mass mobilisation and misses naval / far-away wars (run 3 above: 1.76% → 1.91% during its heaviest war).
//   size   ln of the world's live pop objects and ln of world GDP (same averaging) — F120's tick-cost drivers.
// THE MODEL, pooled over every run-year with run fixed effects (within-run demeaned OLS):
//   ln t = a_run + b_pop·ln pops + b_gdp·ln GDP + c_w·War + c_m·M⁺ + ε
// THE TAX in a year = t − t·exp(−c_w·War − c_m·M⁺): the seconds the model attributes to the wars; summed and ÷ Σ t.
// THE EPISODES are the ruled slowdown episodes (slow_quarantine.mjs's episodes()); each one's EXCESS = Σ over its years of
// t − exp(model with the war terms at 0); its war share = the war tax over its years ÷ that excess. The major wars overlapping it are listed.
// ⚠ Pre-v12 summaries can drop a country record that shares a definition (landmine L38), biasing M toward zero in civil wars.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { yearTimes, episodes } from '../slow_quarantine.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const W = +opt('--window', 7), DETAIL = a.includes('--detail'), JSON_OUT = opt('--json', null);
const med = v => { const s = [...v].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

// ---- which runs
function runDirs() {
  const spec = opt('--runs', null); const out = [];
  if (spec) for (const s of spec.split(',')) {
    const [sess, setup] = s.split(':'); const dir = path.join(ROOT, sess);
    if (fs.existsSync(path.join(dir, 'meta.json'))) { out.push(dir); continue; }
    for (const r of fs.readdirSync(dir).filter(r => r.startsWith('run') && (!setup || r.endsWith('_' + setup)))) out.push(path.join(dir, r));
  } else for (const sess of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, sess); if (!fs.statSync(dir).isDirectory()) continue;
    for (const r of fs.readdirSync(dir).filter(r => /^run\d+_vanilla$/.test(r))) out.push(path.join(dir, r));
  }
  return out.filter(d => {
    try { const m = JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8'));
      // events.tsv is required: a run without one would read as a century of peace (four vanilla runs of 2026-08-14/09-20 carry none)
      return String(m.reached_ingame_date || '').startsWith('1936') && !m.abandoned_reason && fs.existsSync(path.join(d, 'save_summaries'))
        && fs.existsSync(path.join(d, 'events.tsv')); } catch { return false; }
  });
}

// ---- per-run yearly series from the summaries (the 1 January summary of each year)
function series(dir) {
  const S = {}; const sd = path.join(dir, 'save_summaries');
  for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json.gz')).sort()) {
    let s; try { s = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(sd, f)))); } catch { continue; }
    const d = String(s.provenance?.date || s.date || ''); const [y, mo, dd] = d.split('.').map(Number);
    if (!y || mo !== 1 || dd !== 1 || S[y]) continue;
    let mil = 0, wf = 0;
    for (const c of Object.values(s.countries)) {
      mil += c.pop_statistics?.population_military_workforce || 0;
      for (const v of Object.values(c.workforce_by_profession || {})) wf += v;
    }
    S[y] = { mil, wf, share: wf ? 100 * mil / wf : NaN, pops: s.world.pop_objects_live || s.world.pop_objects || NaN, gdp: s.world.gdp };
  }
  return S;
}

// ---- major-v-major wars from events.tsv (see the header)
const MAJOR = /Great Britain|British Republic|France|French Republic|French Empire|French Commune|Russia|Prussia|German|Austria|United States|Spain|Ottoman|Japan|Qing|China|Netherlands|Italy|Sardinia|Sweden|Bengal|India|Mughal|Brazil|Mexico/;
const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
function majorWars(dir) {
  const f = path.join(dir, 'events.tsv'); if (!fs.existsSync(f)) return { wars: [], unmatched: 0 };
  const ev = [];
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const p = line.split('\t'); if (p[1] !== 'PEACE' && p[1] !== 'WARSTART') continue;
    const name = p[1] === 'PEACE' ? p[2] : p[3], d = p[1] === 'PEACE' ? p[3] : p[4];
    const m = /(\w+) (\d+), (\d+)/.exec(d || ''); if (!m || !MAJOR.test(name) || /Revolt|Uprising|Revolutionary/.test(name)) continue;
    ev.push({ k: p[1], name, y: +m[3] + (MONTHS[m[1]] - 1) / 12 + (+m[2] - 1) / 365, date: `${m[3]}-${String(MONTHS[m[1]]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` });
  }
  const starts = ev.filter(e => e.k === 'WARSTART'), used = new Set(), wars = []; let unmatched = 0;
  const pairs = {}; for (const e of ev.filter(e => e.k === 'PEACE')) (pairs[e.date] ||= { y: e.y, who: new Set() }).who.add(e.name);
  for (const [date, p] of Object.entries(pairs).sort((x, y) => x[1].y - y[1].y)) {
    if (p.who.size < 2) continue;
    const st = starts.filter(w => !used.has(w) && p.who.has(w.name) && w.y < p.y && p.y - w.y <= 12).pop();
    if (!st) { unmatched++; continue; }
    used.add(st); wars.push({ from: st.y, to: p.y, start: st.date, end: date, who: [...p.who].join(' – ') });
  }
  return { wars, unmatched };
}
const overlap = (wars, y) => wars.reduce((s, w) => s + Math.max(0, Math.min(w.to, y + 1) - Math.max(w.from, y)), 0);

// ---- build the panel
const runs = runDirs(); const P = []; const R = [];
for (const dir of runs) {
  const { ty, complete } = yearTimes(dir); const S = series(dir);
  const label = path.basename(path.dirname(dir)).slice(0, 15) + '/' + path.basename(dir).slice(0, 6);
  const years = Object.keys(S).map(Number).sort((x, y) => x - y); if (years.length < 60) continue;
  const share = y => S[y]?.share;
  const rollMed = y => med(years.filter(z => Math.abs(z - y) <= W && Number.isFinite(share(z))).map(share));
  const mex = {}; for (const y of years) mex[y] = share(y) - rollMed(y);
  const mw = majorWars(dir); const rows = [];
  for (let y = 1838; y <= Math.min(1935, complete); y++) {
    if (!ty[y] || !S[y] || !S[y + 1]) continue;
    const M = (mex[y] + mex[y + 1]) / 2;
    const row = { y, t: ty[y], lt: Math.log(ty[y]), lp: Math.log((S[y].pops + S[y + 1].pops) / 2), lg: Math.log((S[y].gdp + S[y + 1].gdp) / 2),
                  War: overlap(mw.wars, y), M, Mp: Math.max(M, 0) };
    if ([row.lp, row.lg, row.M].every(Number.isFinite)) rows.push(row);
  }
  if (rows.length < 60) continue;
  R.push({ dir, label, rows, wars: mw.wars, unmatched: mw.unmatched, ep: episodes(ty, { through: complete }) });
  P.push(...rows.map(r => ({ ...r, run: R.length - 1 })));
}
if (!R.length) { console.error('no usable runs'); process.exit(1); }

// ---- within-run OLS
function ols(X, y) {
  const k = X[0].length, A = Array.from({ length: k }, () => Array(k).fill(0)), b = Array(k).fill(0);
  for (let i = 0; i < X.length; i++) for (let p = 0; p < k; p++) { b[p] += X[i][p] * y[i]; for (let q = 0; q < k; q++) A[p][q] += X[i][p] * X[i][q]; }
  for (let p = 0; p < k; p++) { let mx = p; for (let r = p + 1; r < k; r++) if (Math.abs(A[r][p]) > Math.abs(A[mx][p])) mx = r;
    [A[p], A[mx]] = [A[mx], A[p]]; [b[p], b[mx]] = [b[mx], b[p]];
    for (let r = 0; r < k; r++) if (r !== p) { const f = A[r][p] / A[p][p]; for (let q = p; q < k; q++) A[r][q] -= f * A[p][q]; b[r] -= f * b[p]; } }
  return b.map((v, p) => v / A[p][p]);
}
function fit(vars) {
  const dm = {}; for (const [i, r] of R.entries()) for (const v of [...vars, 'lt']) dm[i + v] = r.rows.reduce((s, x) => s + x[v], 0) / r.rows.length;
  const row = (i, r) => vars.map(v => r[v] - dm[i + v]);
  const beta = ols(P.map(r => row(r.run, r)), P.map(r => r.lt - dm[r.run + 'lt']));
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; const bs = vars.map(() => []);
  for (let b = 0; b < 400; b++) { const pick = R.map(() => Math.floor(rnd() * R.length)); const Xb = [], Yb = [];
    for (const i of pick) for (const r of R[i].rows) { Xb.push(row(i, r)); Yb.push(r.lt - dm[i + 'lt']); }
    ols(Xb, Yb).forEach((v, p) => bs[p].push(v)); }
  bs.forEach(v => v.sort((x, y) => x - y));
  const res = P.map(r => r.lt - dm[r.run + 'lt'] - row(r.run, r).reduce((s, x, p) => s + x * beta[p], 0));
  const sd = Math.sqrt(res.reduce((s, e) => s + e * e, 0) / res.length);
  const warPart = r => vars.reduce((s, v, p) => s + (v === 'War' || v === 'Mp' ? beta[p] * r[v] : 0), 0);   // ln-time the war terms add
  return { vars, beta, ci: bs.map(v => [v[20], v[379]]), sd, warPart, nowar: (i, r) => Math.exp(dm[i + 'lt'] + row(i, r).reduce((s, x, p) => s + x * beta[p], 0) - warPart(r)) };
}

// ---- report one model
const pct = v => (100 * v).toFixed(1) + '%', min = s => Math.round(s / 60);
function report(F, name) {
  let T = 0, TAX = 0; const perRun = [], eps = [];
  for (const [i, r] of R.entries()) {
    let t = 0, tax = 0;
    for (const x of r.rows) { t += x.t; tax += x.t * (1 - Math.exp(-F.warPart(x))); }
    for (const e of r.ep) {
      let ex = 0, wt = 0, wars = 0, n = 0;
      for (const x of r.rows) if (x.y >= e.start && x.y <= e.end) { ex += x.t - F.nowar(i, x); wt += x.t * (1 - Math.exp(-F.warPart(x))); wars += x.War; n++; }
      const ws = r.wars.filter(w => w.to > e.start && w.from < e.end + 1).map(w => `${w.start}→${w.end} ${w.who}`);
      eps.push({ run: r.label, start: e.start, end: e.end, open: e.open, peak_pct: e.peak_pct, excess_s: ex, war_s: wt, wars_mean: n ? wars / n : 0, wars: ws });
    }
    T += t; TAX += tax; perRun.push({ run: r.label, tick_s: t, tax_s: tax });
  }
  console.log(`\n=== MODEL ${name}: ln t = run + ${F.vars.map((v, p) => `${F.beta[p].toFixed(3)} [${F.ci[p][0].toFixed(3)} … ${F.ci[p][1].toFixed(3)}]·${v}`).join(' + ')}   (residual sd ${F.sd.toFixed(3)})`);
  console.log(`THE TAX: ${min(TAX)} of ${min(T)} tick-minutes = ${pct(TAX / T)} of the pooled century tick time`);
  const sh = perRun.map(p => p.tax_s / p.tick_s).sort((x, y) => x - y);
  console.log(`  per run: median ${pct(med(sh))} (≈ ${min(med(perRun.map(p => p.tax_s)))} min of ${min(med(perRun.map(p => p.tick_s)))}), range ${pct(sh[0])} … ${pct(sh[sh.length - 1])}`);
  if (DETAIL) for (const p of perRun) console.log(`  ${p.run.padEnd(23)} ${String(min(p.tick_s)).padStart(4)} min  tax ${String(min(p.tax_s)).padStart(3)} min ${pct(p.tax_s / p.tick_s).padStart(6)}`);
  const exAll = eps.reduce((s, e) => s + Math.max(e.excess_s, 0), 0), warAll = eps.reduce((s, e) => s + Math.min(Math.max(e.war_s, 0), Math.max(e.excess_s, 0)), 0);
  console.log(`SLOWDOWN EPISODES (the ruled judge): ${eps.length} in ${new Set(eps.map(e => e.run)).size} of ${R.length} runs; their excess over the no-war model ${min(exAll)} min = ${pct(exAll / T)} of all tick time;`);
  console.log(`  explained by the war terms: ${min(warAll)} min = ${pct(warAll / Math.max(exAll, 1))} of the episodes' excess = ${pct(warAll / T)} of all tick time`);
  for (const e of eps.sort((x, y) => y.excess_s - x.excess_s))
    console.log(`  ${e.run.padEnd(23)} ${e.start}–${e.end}${e.open ? '+' : ' '} peak +${String(e.peak_pct).padStart(3)}%  excess ${String(min(e.excess_s)).padStart(3)} min  war ${String(min(e.war_s)).padStart(3)} min  major wars on ${e.wars_mean.toFixed(1)}  ${e.wars.slice(0, 3).join('; ')}`);
  return { model: name, vars: F.vars, beta: F.beta, ci: F.ci, residual_sd: F.sd, tick_s: T, tax_s: TAX, tax_share: TAX / T, episodes: eps, episode_excess_s: exAll, episode_war_s: warAll };
}

console.log(`WAR TAX — ${R.length} runs, ${P.length} run-years (major wars per run: median ${med(R.map(r => r.wars.length))}, peace pairs unmatched: median ${med(R.map(r => r.unmatched))})`);
// excess by the number of major wars on, against the size-only model
const F0 = fit(['lp', 'lg']);
const bins = [[0, 0.01], [0.01, 1], [1, 2], [2, 3], [3, 99]].map(([lo, hi]) => ({ lo, hi, n: 0, s: 0 }));
for (const [i, r] of R.entries()) for (const x of r.rows) { const b = bins.find(b => x.War >= b.lo && x.War < b.hi); b.n++; b.s += Math.log(x.t / F0.nowar(i, x)); }
console.log('tick time against the size-only model (run FE + ln pops + ln GDP), by major-v-major wars on in the year:');
for (const b of bins) console.log(`  wars ${String(b.lo).padStart(4)}–${String(b.hi).padEnd(4)} n ${String(b.n).padStart(5)}  ${b.n ? (b.s / b.n >= 0 ? '+' : '') + pct(Math.exp(b.s / b.n) - 1) : '—'}`);
const out = { runs: R.length, run_years: P.length, window: W, by_wars: bins.map(b => ({ wars: `${b.lo}-${b.hi}`, n: b.n, mean_excess: b.n ? Math.exp(b.s / b.n) - 1 : null })), models: [] };
out.models.push(report(fit(['lp', 'lg', 'War']), 'A (major wars)'));
out.models.push(report(fit(['lp', 'lg', 'War', 'Mp']), 'B (major wars + mobilisation)'));
if (a.includes('--wars')) for (const r of R) { console.log(`\n${r.label}: ${r.wars.length} major-v-major wars (${r.unmatched} peace pairs unmatched)`); for (const w of r.wars) console.log(`  ${w.start} → ${w.end}  ${(w.to - w.from).toFixed(1)} y  ${w.who}`); }
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
