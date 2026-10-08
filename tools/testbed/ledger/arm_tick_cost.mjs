// THE WALL CLOCK PER IN-GAME YEAR, ARM AGAINST ARM, FROM THE ENGINE'S OWN TICK STAMPS (2026-10-08, the feature-switch probe
// perf_isolate_5y.json: which part of the mod costs the extra seconds per year the Tick Task List screenshots showed).
//
//   node tools/testbed/ledger/arm_tick_cost.mjs <session>[,<session>] [--ref vanilla] [--from 1836] [--to 1841] [--runs]
//
// Per run: Σ tick gaps (tick_profile.mjs's parseTicks — 1-s stamps, exact to ±1 s when every sub-tick is summed) per in-game
// year, WITHOUT the 1 January tick day (the yearly autosave stall) and split three ways: the hour-0 sub-tick of the 1st of a month
// (where the monthly pulse runs), the other hour-0 sub-ticks, and hours 6/12/18. Per arm (= setup): mean and its standard error
// over runs, and the difference to the --ref arm with its SE. Every year is reported, so a 1836-only burst is visible as such.
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTicks } from './tick_profile.mjs';
const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const sessions = (args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--')) || '').split(',').filter(Boolean);
if (!sessions.length) { console.error('usage: arm_tick_cost.mjs <session>[,<session>] [--ref vanilla] [--from Y] [--to Y] [--runs]'); process.exit(2); }
const REF = opt('--ref', 'vanilla'), FROM = +opt('--from', 1836), TO = +opt('--to', 1841), SHOWRUNS = args.includes('--runs');
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const se = a => a.length < 2 ? NaN : Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1) / a.length);
const years = []; for (let y = FROM; y < TO; y++) years.push(y);
const arms = {};
for (const s of sessions) for (const r of readdirSync(join(SES, s)).filter(d => /^run\d+_/.test(d)).sort()) {
  const T = parseTicks(join(SES, s, r)); if (!T || !T.length) { console.log(`skip ${s}/${r}: no ticks`); continue; }
  const setup = r.replace(/^run\d+_/, '');
  const Y = {}; for (const y of years) Y[y] = { tot: 0, mon: 0, h0: 0, oth: 0, n: 0 };
  for (const t of T) {
    if (!Y[t.y]) continue; if (t.m === 1 && t.d === 1) continue;          // the autosave day
    const o = Y[t.y]; o.tot += t.t; o.n++;
    if (t.h === 0 && t.d === 1) o.mon += t.t; else if (t.h === 0) o.h0 += t.t; else o.oth += t.t;
  }
  // THE ENGINE'S OWN AUTOMATION STATS (logs/custom_automated_stats.log, the `automation_stats` logger in vanilla's
  // log_settings_live.json — written by every observer run): per in-game year the game-LOGIC time, split by tick rate. A line labelled
  // [Y] is written at Y.1.1 and covers year Y−1. "Year - Average sum time" = all tick logic of the year (ms); "Day/Week/Month - Average
  // tick time" = one daily / weekly / monthly tick's own cost. Logic is only ~1/3 of the observer's wall clock in vanilla.
  for (const f of ['logs_live/custom_automated_stats.log', 'logs/custom_automated_stats.log']) {
    const p = join(SES, s, r, f); if (!existsSync(p)) continue;
    const { readFileSync } = await import('node:fs');
    for (const l of readFileSync(p, 'latin1').split('\n')) {
      const m = /\[AUTOMATION_STATS\]\[(Year - Average sum time|Day - Average tick time|Week - Average tick time|Month - Average tick time)\]\[Year\]\[Milliseconds\]:\[(\d+)\]\[(\d+)\]/.exec(l);
      if (!m || !Y[+m[3] - 1]) continue;
      Y[+m[3] - 1][{ 'Year - Average sum time': 'logic', 'Day - Average tick time': 'day', 'Week - Average tick time': 'week', 'Month - Average tick time': 'month' }[m[1]]] = +m[2];
    }
    break;
  }
  const full = years.filter(y => Y[y].n >= 1440);                          // a complete year minus its first day (1456 ticks)
  if (full.length < years.length) console.log(`note ${s}/${r}: complete years ${full.join(',') || 'none'}`);
  (arms[setup] ||= []).push({ run: `${s}/${r}`, Y, full });
}
const fmt = (x, w = 6) => (Number.isFinite(x) ? x.toFixed(1) : '–').padStart(w);
const col = (runs, y, k) => runs.filter(r => r.full.includes(y)).map(r => r.Y[y][k]);
const allYears = (r, k) => r.full.length === years.length ? years.reduce((s, y) => s + r.Y[y][k], 0) / years.length : null;
const order = Object.keys(arms).sort((a, b) => (a === REF ? -1 : b === REF ? 1 : a.localeCompare(b)));
console.log(`\nwall seconds per in-game year (1 Jan autosave day excluded), mean ± SE over runs; Δ = arm − ${REF}`);
console.log('arm      n  ' + years.map(y => String(y).padStart(13)).join('') + '      all-years   Δ vs ref ± SE   | of which: 1st-of-month h0 / other h0 / h6-18');
const refAll = (arms[REF] || []).map(r => allYears(r, 'tot')).filter(x => x != null);
for (const a of order) {
  const runs = arms[a];
  const per = years.map(y => { const v = col(runs, y, 'tot'); return `${fmt(mean(v))}±${fmt(se(v), 4)}`.padStart(13); }).join('');
  const all = runs.map(r => allYears(r, 'tot')).filter(x => x != null);
  const d = mean(all) - mean(refAll), dse = Math.sqrt((se(all) ** 2 || 0) + (se(refAll) ** 2 || 0));
  const parts = ['mon', 'h0', 'oth'].map(k => fmt(mean(runs.map(r => allYears(r, k)).filter(x => x != null)), 5)).join(' /');
  console.log(`${a.padEnd(8)} ${String(runs.length).padStart(1)}  ${per}   ${fmt(mean(all), 8)}±${fmt(se(all), 4)}   ${a === REF ? '' : `${fmt(d)} ± ${fmt(dse, 4)}`.padStart(15)}   | ${parts}`);
  if (SHOWRUNS) for (const r of runs) console.log(`   ${r.run.padEnd(60)} ${years.map(y => fmt(r.Y[y].tot)).join(' ')}`);
}
console.log(`\nGAME LOGIC per in-game year from custom_automated_stats.log (s), and one daily / weekly / monthly tick's own cost (ms); mean over runs`);
console.log('arm      ' + years.map(y => String(y).padStart(8)).join('') + '   all-yrs   Δ ref   |  day ms  week ms  month ms (all-years means)');
const lg = (r, k) => { const v = years.map(y => r.Y[y][k]).filter(x => x != null); return v.length === years.length ? mean(v) : null; };
const refLg = mean((arms[REF] || []).map(r => lg(r, 'logic')).filter(x => x != null)) / 1000;
for (const a of order) {
  const runs = arms[a];
  const per = years.map(y => fmt(mean(runs.map(r => r.Y[y].logic).filter(x => x != null)) / 1000, 8)).join('');
  const all = mean(runs.map(r => lg(r, 'logic')).filter(x => x != null)) / 1000;
  const k3 = ['day', 'week', 'month'].map(k => fmt(mean(runs.map(r => lg(r, k)).filter(x => x != null)), 8)).join(' ');
  console.log(`${a.padEnd(8)} ${per}  ${fmt(all, 8)}  ${a === REF ? '      ' : fmt(all - refLg)}   | ${k3}`);
}
