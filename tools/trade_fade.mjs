// TRADE FADE — why a mod arm's lead in world trade over vanilla shrinks, and where trade stops. The user's questions of 2026-11-01/02
// (FINDINGS F263). Written while the 2026-10-30 batch froze tools/testbed/**; it belongs in tools/testbed/ledger/ once that batch ends.
//   A. Per run and yearly save summary (1 January): the world's trade capacity and its usage, the capacity units traded ((imports +
//      exports) ÷ 2 over world.trade_goods), the goods they move (units × the arm's traded quantity per unit) by F159 trade class, their
//      value at the world market price (mean52) — the "trade value" line of the four-metric page — and the trade centres' levels and
//      weekly profit. Printed as each arm's median over runs and the ratio mod ÷ vanilla.
//   B. Per run, decade dump (1840.1.1 … 1930.1.1, 1935.1.1), tracked market (markets.tsv) and tradeable good with buy orders: the gap
//      (market price − world market price `last` at that date) ÷ base price, and whether the market imports (imports > 0) or exports it.
//      The gap is read AFTER trade has acted on it. Printed: share importing by gap, the importers' residual gap by class / decade /
//      market, and PAIRED on the same market × good × date (each arm's median over the runs importing it, ≥ 3 runs each).
//   A run without world.trade_goods or world_market_price in its summaries (save summary < v19) is skipped and listed.
// USAGE: node tools/trade_fade.mjs <mod group>[:<setup>] <vanilla group>[:<setup>] [--config <book>]
//        <group> = a session, a comma list of sessions or <session>/runNNN_<setup> folders (lib_runs.usableRunsPooled);
//        --config = the mod arm's book, for its traded quantities (default config/mod_config.json); the vanilla arm reads the game's.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './testbed/ledger/lib_runs.mjs';
import { goodsTable, tradedQuantity, tradeClasses } from './testbed/ledger/lib_goods.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const POS = ARGV.filter((a, i) => !a.startsWith('--') && !(i > 0 && ARGV[i - 1].startsWith('--')));
if (POS.length < 2) { console.error('usage: node tools/trade_fade.mjs <mod group>[:<setup>] <vanilla group>[:<setup>] [--config <book>]'); process.exit(2); }
const SES = join(ROOT, 'tools/testbed/sessions');
const G = goodsTable(), { classOf } = tradeClasses(null);
const CFG = JSON.parse(readFileSync(resolve(ROOT, argOf('--config', 'config/mod_config.json')), 'utf8'));
const CLS = ['A', 'B', 'C', 'D', 'E'], WT = { A: '×4', B: '×2.83', C: '×2', D: '×1.41', E: '×1 vanilla' };
const ARMS = [['mod', POS[0], tradedQuantity(CFG, G)], ['vanilla', POS[1], tradedQuantity(null, G)]];
const DECADE = /^(18[4-9]0|19[0-3]0)\.1\.1$|^1935\.1\.1$/;
const load = f => JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));

const A = { mod: [], vanilla: [] }, rows = [];
for (const [arm, spec, TQ] of ARMS) {
  const [grp, setup = ''] = spec.split(':');
  const { runs, dropped } = usableRuns(SES, grp, setup); reportDropped(dropped);
  const skipped = [];
  for (const rel of runs) {
    const sd = join(SES, rel, 'save_summaries'), R = {}, WP = {};
    for (const f of readdirSync(sd).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()) {
      let j; try { j = load(join(sd, f)); } catch { continue; }
      const d = String(j.provenance?.date || ''), m = /^(\d{4})\.1\.1$/.exec(d);
      if (!m || R[m[1]] || !j.world?.trade_goods || !j.world?.world_market_price) continue;
      const x = R[m[1]] = { cap: j.world.trade?.capacity || 0, use: j.world.trade?.usage || 0, units: 0, value: 0, cls: {}, tc: 0, tcp: 0 };
      for (const [good, t] of Object.entries(j.world.trade_goods)) {
        const u = (t.imp + t.exp) / 2, c = classOf[good] || '?', k = x.cls[c] || (x.cls[c] = { units: 0, goods: 0, value: 0 });
        const v = u * (TQ[good] || 0) * (j.world.world_market_price[good]?.mean52 ?? G[good]?.cost ?? 0);
        x.units += u; x.value += v; k.units += u; k.goods += u * (TQ[good] || 0); k.value += v;
      }
      for (const c of Object.values(j.countries)) { const b = c.buildings?.building_trade_center; if (b) { x.tc += b.levels || 0; x.tcp += b.profit || 0; } }
      if (DECADE.test(d)) WP[d] = j.world.world_market_price;
    }
    if (!Object.keys(R).length) { skipped.push(rel); continue; }
    A[arm].push(R);
    const mf = join(SES, rel, 'markets.tsv'); if (!existsSync(mf)) continue;
    for (const line of readFileSync(mf, 'utf8').split(/\r?\n/).slice(1)) {
      const c = line.split('\t'); if (c.length < 11) continue;
      const [, date, mkt, , good] = c, wp = WP[date]?.[good]?.last, base = G[good]?.cost;
      if (!wp || !base || G[good].local || !G[good].tradeable || good === 'merchant_marine' || !(+c[5] > 0)) continue;
      rows.push({ arm, run: rel, yr: +date.slice(0, 4), mkt, good, cls: classOf[good] || '?', gap: (+c[7] - wp) / base, imp: +c[8] > 0, exp: +c[9] > 0 });
    }
  }
  console.log(`${arm}: ${A[arm].length} runs with trade fields (${spec})` + (skipped.length ? `; skipped ${skipped.length} without them (save summary < v19): ${skipped.join(', ')}` : ''));
}

const q = (a, p) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo); };
const med = a => q(a, 0.5);
const f = (x, d = 2, w = 6) => Number.isFinite(x) ? x.toFixed(d).padStart(w) : '–'.padStart(w);
const M = (arm, y, fn) => med(A[arm].map(R => R[y] ? fn(R[y]) : NaN));
const ratio = (y, fn) => M('mod', y, fn) / M('vanilla', y, fn);

console.log('\n== A. World trade, per arm: medians over runs, and mod ÷ vanilla');
console.log('year | value at world prices mod÷van | capacity mod÷van | capacity used mod van | units traded mod÷van | goods moved mod÷van | trade-centre levels mod÷van | profit £/wk per trade-centre level mod van mod÷van');
const YEARS = [1837, 1845, 1855, 1865, 1875, 1885, 1895, 1905, 1915, 1925, 1935];
const goods = x => Object.values(x.cls).reduce((s, k) => s + k.goods, 0);
for (const y of YEARS) {
  const pm = M('mod', y, x => x.tcp / x.tc), pv = M('vanilla', y, x => x.tcp / x.tc);
  console.log(`${y} | ${f(ratio(y, x => x.value))} | ${f(ratio(y, x => x.cap))} | ${f(100 * M('mod', y, x => x.use / x.cap), 0, 4)}% ${f(100 * M('vanilla', y, x => x.use / x.cap), 0, 3)}% | ${f(ratio(y, x => x.units))} | ${f(ratio(y, goods))} | ${f(ratio(y, x => x.tc))} | ${f(pm, 0)} ${f(pv, 0)} ${f(pm / pv)}`);
}
console.log('\n-- goods moved by trade class, mod ÷ vanilla (units × traded quantity), and the class\'s share of the mod\'s trade value');
console.log('year | ' + CLS.map(c => `${c} ${WT[c]}`.padEnd(13)).join(' | '));
for (const y of YEARS) console.log(`${y} | ` + CLS.map(c => `${f(ratio(y, x => x.cls[c]?.goods || 0))} ${f(100 * M('mod', y, x => (x.cls[c]?.value || 0) / x.value), 0, 3)}%`.padEnd(13)).join(' | '));

console.log('\n== B. Where trade stops: gap = (market price − world price) ÷ base, tracked markets with buy orders, decade dumps');
const BINS = [-1.5, -0.5, -0.35, -0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35, 0.5, 0.75, 1.5];
console.log('gap bin | n mod van | share importing mod van | share exporting mod van');
for (let i = 0; i < BINS.length - 1; i++) {
  const b = arm => rows.filter(r => r.arm === arm && r.gap >= BINS[i] && r.gap < BINS[i + 1]); const bm = b('mod'), bv = b('vanilla');
  const sh = (a, k) => a.length ? `${(100 * a.filter(r => r[k]).length / a.length).toFixed(0)}%` : '–';
  console.log(`${f(BINS[i])} … ${f(BINS[i + 1], 2, 5)} | ${String(bm.length).padStart(5)} ${String(bv.length).padStart(5)} | ${sh(bm, 'imp').padStart(4)} ${sh(bv, 'imp').padStart(4)} | ${sh(bm, 'exp').padStart(4)} ${sh(bv, 'exp').padStart(4)}`);
}
for (const arm of ['mod', 'vanilla']) {
  const far = rows.filter(r => r.arm === arm && r.gap >= 0.35), none = far.filter(r => !r.imp), by = {};
  for (const r of none) by[r.mkt] = (by[r.mkt] || 0) + 1;
  console.log(`${arm}: at a gap ≥ 0.35 of base ${(100 * none.length / far.length).toFixed(0)}% of ${far.length} market-good-dates import nothing; by market: ` +
    Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([m, n]) => `${m} ${(100 * n / none.length).toFixed(0)}%`).join(', '));
}
const line = (label, sel) => {
  const s = arm => rows.filter(r => r.arm === arm && sel(r)), m = s('mod'), v = s('vanilla');
  const I = a => a.filter(r => r.imp).map(r => r.gap), E = a => a.filter(r => r.exp).map(r => r.gap);
  console.log(`${label.padEnd(26)} | importers n ${String(I(m).length).padStart(5)} ${String(I(v).length).padStart(5)} | gap p25/p50/p75 mod ${f(q(I(m), .25), 3)} ${f(q(I(m), .5), 3)} ${f(q(I(m), .75), 3)}  van ${f(q(I(v), .25), 3)} ${f(q(I(v), .5), 3)} ${f(q(I(v), .75), 3)} | share importing ${f(100 * I(m).length / m.length, 0, 3)}% ${f(100 * I(v).length / v.length, 0, 3)}% | exporters' gap p50 mod ${f(q(E(m), .5), 3)} van ${f(q(E(v), .5), 3)}`);
};
console.log('\n-- importers\' residual gap');
line('all', () => true);
for (const c of CLS) line(`class ${c} ${WT[c]}`, r => r.cls === c);
for (const y of [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935]) line(String(y), r => r.yr === y);
for (const mk of [...new Set(rows.map(r => r.mkt))].sort()) line(mk, r => r.mkt === mk);

const P = {};
for (const r of rows.filter(r => r.imp)) (P[`${r.mkt}|${r.good}|${r.yr}`] ||= { mkt: r.mkt, good: r.good, cls: r.cls, yr: r.yr, mod: [], vanilla: [] })[r.arm].push(r.gap);
const pairs = Object.values(P).filter(p => p.mod.length >= 3 && p.vanilla.length >= 3).map(p => ({ ...p, m: med(p.mod), v: med(p.vanilla), d: med(p.mod) - med(p.vanilla) }));
const PER = [[1840, 1870], [1880, 1900], [1910, 1935]];
const cell = ps => `${f(med(ps.map(p => p.d)), 3)} (${ps.length})`;
console.log('\n-- paired on market × good × date (each arm\'s median over the runs importing it, ≥ 3 runs each): median of (mod − vanilla), (pairs)');
console.log(`all ${cell(pairs)}; mod lower in ${(100 * pairs.filter(p => p.d < 0).length / pairs.length).toFixed(0)}% of pairs`);
for (const [label, sel] of [['all markets', () => true], ['without Japan and Russia', p => !/^(Japanese|Russian) Market$/.test(p.mkt)]]) {
  console.log(`${label}:  class | ${PER.map(([a, b]) => `${a}–${b}`.padEnd(14)).join(' | ')} | whole span`);
  for (const c of CLS) { const ps = pairs.filter(p => sel(p) && p.cls === c); console.log(`  ${c} ${WT[c]}`.padEnd(15) + ' | ' + PER.map(([a, b]) => cell(ps.filter(p => p.yr >= a && p.yr <= b)).padEnd(14)).join(' | ') + ' | ' + cell(ps)); }
}
console.log('\n-- the tiered industries\' goods, paired, without Japan and Russia: mod median · vanilla median · Δ (pairs) per period');
for (const g of ['groceries', 'clothes', 'fabric', 'furniture', 'luxury_furniture', 'glass', 'tools', 'paper', 'fertilizer', 'explosives', 'steel', 'engines', 'automobiles', 'small_arms', 'artillery', 'ammunition', 'dye', 'telephones', 'fine_art']) {
  const ps = pairs.filter(p => p.good === g && !/^(Japanese|Russian) Market$/.test(p.mkt));
  console.log(`${g.padEnd(17)} ${classOf[g] || '?'} | ` + PER.map(([a, b]) => { const s = ps.filter(p => p.yr >= a && p.yr <= b); return `${f(med(s.map(p => p.m)), 3)} ${f(med(s.map(p => p.v)), 3)} ${f(med(s.map(p => p.d)), 3)} (${String(s.length).padStart(2)})`; }).join(' | '));
}
