// INTEREST-GROUP CLOUT, OUT OF ONE SAVE — the current clout and the WEEKLY clout history the save carries (user-asked 2026-10-01:
// "add interest group clout to telemetry, and if possible fill the data retrospectively, to understand whether we have indeed
// boosted early PB" — the craft redesign's Petite Bourgeoisie).
//
//   node tools/testbed/ledger/ig_clout.mjs <save.v3|melt.txt> [--tags GBR,FRA,...|all] [--ig ig_petty_bourgeoisie|all]
//        [--every 1] [--json out.json]
//
// ⭐ WHY THIS CAN BACK-FILL: every IG record in a save carries `clout_trend` — a RING of 521 WEEKLY samples (sample_rate=28 is
// not the interval: `index` advances 52 a year, 5211 by 1935.12.28), so a save holds the last TEN YEARS of every IG's clout in
// every country. A run's kept endpoint (the newest save, harvest_saves keeps it) therefore answers 1926–1936, a thirty-year
// run's 1856–1866, a ten-year probe's whole 1836–1846. The summaries (v13+) carry the CURRENT clout per save from 2026-10-01 on.
// ⚠ Ring order: newest at (index − 1) mod n, oldest at index mod n once the ring has wrapped (index ≥ n); before that, 0..index−1.
//   The channel's `date=` is the NEWEST sample's date; earlier samples are 7 days apart (±1 day; the tick is not exactly weekly).
// ⚠ Clout is the IG's share of its country's political strength AFTER the engine's modifiers (it need not equal ps ÷ Σ ps).
// ⚠ Countries are keyed by TAG on the MAIN record only (is_main_tag); a rebel/remnant record sharing the tag is skipped.
import { spawn } from 'node:child_process';
import { createReadStream, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SRC = args.filter(a => !a.startsWith('--') && !/^(--)/.test(a))[0];
const TAGS = argOf('--tags', 'GBR,USA,FRA,NET,BEL,UNL,PRU,NGF,GER,RUS,JAP,AUS,SPA,TUR,CHI');
const IG = argOf('--ig', 'ig_petty_bourgeoisie');
const EVERY = +argOf('--every', '1');          // print every N years
const OUT = argOf('--json', '');
if (!SRC) { console.error('usage: ig_clout.mjs <save.v3|melt.txt> [--tags …|all] [--ig …|all] [--every N] [--json out]'); process.exit(2); }

function lines(src) {
  if (!/\.v3$/i.test(src)) return createInterface({ input: createReadStream(src, { encoding: 'utf8' }), crlfDelay: Infinity });
  const rak = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'rakaly', 'rakaly.exe');
  if (!existsSync(rak)) throw new Error(`rakaly not found at ${rak}`);
  const p = spawn(rak, ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', src], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.setEncoding('utf8');
  return createInterface({ input: p.stdout, crlfDelay: Infinity });
}

const cm = new Map();          // country id -> {tag, main}
const igs = [];                // {country, def, clout, ps, date, index, values}
let saveDate = '', mode = 'top', depth = 0, cur = null, rec = null, inTrend = 0, inVals = false, trendDepth = 0;
for await (const line of lines(SRC)) {
  if (mode === 'top') {
    if (!saveDate) { const d = /^date=(\d+\.\d+\.\d+)/.exec(line); if (d) { saveDate = d[1]; continue; } }
    const s = /^([a-z_]+)=\{$/.exec(line);
    if (!s) continue;
    mode = s[1] === 'country_manager' || s[1] === 'interest_groups' ? s[1] : 'skip'; depth = 1; continue;
  }
  if (mode === 'skip') { if (line.charCodeAt(0) === 125) mode = 'top'; continue; }
  const t = line.trim();
  let o = 0, c = 0; for (let i = 0; i < t.length; i++) { const ch = t.charCodeAt(i); if (ch === 123) o++; else if (ch === 125) c++; }
  if (mode === 'country_manager') {
    if (depth === 2 && /^\d+=\{$/.test(t)) cur = { id: +t.slice(0, t.indexOf('=')), tag: null, main: false };
    else if (cur && depth === 3) {
      let x; if ((x = /^definition="([A-Z_0-9]+)"$/.exec(t))) cur.tag ??= x[1]; else if (t === 'is_main_tag=yes') cur.main = true;
    }
    const nd = depth + o - c;
    if (cur && nd <= 2) { cm.set(cur.id, cur); cur = null; }
    depth = nd; if (depth <= 0) mode = 'top';
    continue;
  }
  // interest_groups
  if (depth === 2 && /^\d+=\{$/.test(t)) rec = { country: null, def: null, clout: 0, ps: 0, date: null, index: 0, values: null };
  else if (rec) {
    let x;
    if (depth === 3 && !o) {
      if ((x = /^country=(\d+)$/.exec(t))) rec.country = +x[1];
      else if ((x = /^definition="([a-z_0-9]+)"$/.exec(t))) rec.def = x[1];
      else if ((x = /^clout=([-\d.e]+)$/.exec(t))) rec.clout = +x[1];
      else if ((x = /^political_strength=([-\d.e]+)$/.exec(t))) rec.ps = +x[1];
    } else if (depth === 3 && t === 'clout_trend={') { inTrend = 1; trendDepth = 3; }
    else if (inTrend && !rec.values) {
      if ((x = /^date=([\d.]+)$/.exec(t))) rec.date = x[1];
      else if ((x = /^index=(\d+)$/.exec(t))) rec.index = +x[1];
      else if (t === 'values={') inVals = true;
      else if (inVals) { rec.values = t.split(/\s+/).filter(Boolean).map(Number); inVals = false; }
    }
  }
  const nd = depth + o - c;
  if (inTrend && nd <= trendDepth) inTrend = 0;
  if (rec && nd <= 2) { if (rec.def && rec.country != null) igs.push(rec); rec = null; inTrend = 0; inVals = false; }
  depth = nd; if (depth <= 0) mode = 'top';
}
if (!saveDate) throw new Error('no top-level date — not a vic3 gamestate?');
if (!igs.length) throw new Error('no interest_groups records parsed — the save layout has moved');

// date arithmetic on the game's calendar (no leap years; months of fixed length)
const ML = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const toDay = s => { const [y, m, d] = s.split('.').map(Number); let n = y * 365; for (let i = 0; i < m - 1; i++) n += ML[i]; return n + d - 1; };
const fromDay = n => { const y = Math.floor(n / 365); let r = n - y * 365, m = 0; while (r >= ML[m]) { r -= ML[m]; m++; } return `${y}.${m + 1}.${r + 1}`; };
const series = rec => {
  if (!rec.values || !rec.date) return [];
  const n = rec.values.length, ord = rec.index >= n ? [...rec.values.slice(rec.index % n), ...rec.values.slice(0, rec.index % n)] : rec.values.slice(0, Math.min(rec.index, n));
  const end = toDay(rec.date);
  return ord.map((v, i) => [fromDay(end - 7 * (ord.length - 1 - i)), v]);
};

const out = { date: saveDate, source: SRC, countries: {} };
for (const r of igs) {
  const cc = cm.get(r.country); if (!cc || !cc.tag || !cc.main) continue;
  const c = out.countries[cc.tag] ??= {};
  c[r.def] = { clout: r.clout, ps: Math.round(r.ps), trend: series(r) };
}
if (OUT) writeFileSync(OUT, JSON.stringify(out));

const tags = TAGS === 'all' ? Object.keys(out.countries).sort() : TAGS.split(',').filter(t => out.countries[t]);
const defs = IG === 'all' ? [...new Set(igs.map(r => r.def))].sort() : IG.split(',');
for (const d of defs) {
  // yearly marks: the sample nearest each Jan 1 inside the trend window
  const years = new Set();
  for (const tg of tags) for (const [dt] of out.countries[tg][d]?.trend ?? []) years.add(+dt.split('.')[0]);
  const ys = [...years].sort((a, b) => a - b).filter((y, i, a) => (y - a[0]) % EVERY === 0);
  console.log(`\n${d} clout (%) — ${saveDate}, weekly trend sampled nearest 1 Jan`);
  console.log('tag   ' + ys.map(y => String(y).padStart(5)).join('') + '   now');
  const val = (tr, y) => { const tgt = toDay(`${y}.1.1`); let b = null; for (const [dt, v] of tr) { const dd = Math.abs(toDay(dt) - tgt); if (dd <= 10 && (!b || dd < b[0])) b = [dd, v]; } return b ? b[1] : null; };
  const fmt = v => v == null ? '    ·' : (100 * v).toFixed(1).padStart(5);
  for (const tg of tags) {
    const tr = out.countries[tg][d]?.trend ?? [];
    console.log(tg.padEnd(6) + ys.map(y => fmt(val(tr, y))).join('') + '  ' + fmt(out.countries[tg][d]?.clout ?? 0));
  }
  // ⭐ THE ROBUST LINES: one country's clout swings with revolutions and bans (an IG banned or crushed reads 0 for years), so a
  // lever is read on the spread over every main country holding the IG at that date — mean and median, and the count.
  const all = Object.values(out.countries).map(c => c[d]).filter(Boolean);
  const agg = (y, f) => { const v = all.map(x => val(x.trend, y)).filter(x => x != null).sort((a, b) => a - b); return v.length ? f(v) : null; };
  const mean = v => v.reduce((a, b) => a + b, 0) / v.length, med = v => v.length % 2 ? v[v.length >> 1] : (v[(v.length >> 1) - 1] + v[v.length >> 1]) / 2;
  const nowV = all.filter(x => x.trend.length).map(x => x.clout).sort((a, b) => a - b);   // a country with no trend is a dead record
  console.log('mean  ' + ys.map(y => fmt(agg(y, mean))).join('') + '  ' + fmt(mean(nowV)) + '   (all main countries)');
  console.log('median' + ys.map(y => fmt(agg(y, med))).join('') + '  ' + fmt(med(nowV)));
  console.log('n     ' + ys.map(y => String(agg(y, v => v.length) ?? '·').padStart(5)).join('') + '  ' + String(nowV.length).padStart(5));
}
