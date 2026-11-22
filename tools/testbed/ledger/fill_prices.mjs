// THE PRICE PANEL — PRICES BY GOODS CLASS, MARKET AND DECADE (BALANCE_FRAMEWORK §10.128, FINDINGS F285 §5; user, 2026-11-22: "What we need
// is a decade-by-decade comparison, for the largest markets separately and an aggregate. Separately for 2-4 different types of goods … regular
// scalable industry output -- noticeably down, and the latter is the main reading"; the layout "Option A": one chart per goods class, the
// aggregate by default, one market on demand).
//
// ⭐ A price decline is an aim of the mod's OWN class (§10.128): vanilla's line is drawn beside the mod's as a reference, never as its yardstick.
// ⭐ The arithmetic (classes, markets, the both-sides rule, the geometric mean, the median over markets) is lib_prices.mjs, ONE definition
//   shared with criteria.mjs's industry-price term, so the panel and the loss read the same numbers. Here: each then the median over runs
//   (the aggregate also carries its runs' min and max).
//
//   node tools/testbed/ledger/fill_prices.mjs <outDir> --mod <session/run,…> --van <session/run,…>       (fill_ledger.sh passes them)
// Writes <outDir>/prices.json.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSES, YEARS, MARKETS, SERIES, med, readMarketRun, classIndex, aggPath, IND_FROM, IND_TO } from './lib_prices.mjs';
const SES = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
const OUT = process.argv[2];
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const list = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);
const MOD = list(argOf('--mod', '')), VAN = list(argOf('--van', ''));
if (!OUT || !MOD.length || !VAN.length) { console.error('usage: fill_prices.mjs <outDir> --mod <session/run,…> --van <session/run,…>'); process.exit(2); }
const fin = Number.isFinite, r3 = x => fin(x) ? Math.round(x * 1000) / 1000 : null;

function arm(label, rels) {
  const read = rels.map(rel => ({ rel, r: readMarketRun(join(SES, rel)) })), missing = read.filter(x => !x.r).map(x => x.rel), runs = read.filter(x => x.r).map(x => x.r.P);
  if (missing.length) console.error('fill_prices: no markets.tsv in ' + missing.join(', ') + ' (left out)');
  const out = { label, n: runs.length, missing, kept: read.reduce((a, x) => a + (x.r ? x.r.kept : 0), 0), oneSided: read.reduce((a, x) => a + (x.r ? x.r.oneSided : 0), 0), classes: {} };
  for (const k of Object.keys(CLASSES)) {
    const perRun = runs.map(P => aggPath(P, k));
    out.classes[k] = {
      agg: YEARS.map((_, i) => r3(med(perRun.map(r => r[i])))),
      lo: YEARS.map((_, i) => { const v = perRun.map(r => r[i]).filter(fin); return v.length ? r3(Math.min(...v)) : null; }),
      hi: YEARS.map((_, i) => { const v = perRun.map(r => r[i]).filter(fin); return v.length ? r3(Math.max(...v)) : null; }),
      markets: Object.fromEntries(SERIES.map(ser => [ser, YEARS.map(y => r3(med(runs.map(P => classIndex(P, k, ser, y)))))])),
    };
  }
  return out;
}
const mod = arm('mod', MOD), van = arm('vanilla', VAN);
if (!mod.n || !van.n) { console.error('fill_prices: no market dumps read (mod ' + mod.n + ', vanilla ' + van.n + ')'); process.exit(1); }
writeFileSync(join(OUT, 'prices.json'), JSON.stringify({ years: YEARS, markets: MARKETS, classes: CLASSES, mod, van, indWindow: [IND_FROM, IND_TO] }));
const at = (a, y) => a[YEARS.indexOf(y)], pc = (a, b) => fin(a) && fin(b) && a > 0 ? ((b / a - 1) * 100).toFixed(0) + '%' : '—';
console.log('prices.json: mod n=' + mod.n + ', vanilla n=' + van.n + ' · readings kept ' + mod.kept + ' / ' + van.kept + ', one-sided left out ' + mod.oneSided + ' / ' + van.oneSided);
for (const [k, C] of Object.entries(CLASSES)) console.log('  ' + C.label.padEnd(32) + ' 1900 → 1935: mod ' + at(mod.classes[k].agg, 1900) + ' → ' + at(mod.classes[k].agg, 1935) + ' (' + pc(at(mod.classes[k].agg, 1900), at(mod.classes[k].agg, 1935)) + ')'
  + ', vanilla ' + at(van.classes[k].agg, 1900) + ' → ' + at(van.classes[k].agg, 1935) + ' (' + pc(at(van.classes[k].agg, 1900), at(van.classes[k].agg, 1935)) + ')');
