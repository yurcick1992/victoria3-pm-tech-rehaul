// THE MERCHANT-MARINE CHAIN WATCH — clipper / steamer / merchant-marine prices and colonial market
// access, read live off a run's own mirrored debug.log while the game is still playing.
//
// WHY IT EXISTS. The chain shipyard->clippers / shipyard_steam->steamers / port->merchant_marine is
// the one the §10.60.3 chain seed intervenes in, and the chain-seed probe read merchant marine PINNED
// AT THE +75% CEILING. A pin is visible in the first in-game decade, so it is worth reading at minute
// ten rather than at hour six — this is what turns the standing "smoke-check every run" rule into an
// actual number for this batch (user-directed 2026-08-17).
//
// ⚠ IT FILTERS BY THE RUN'S OWN TOKEN (landmine L9). The game's log ring is shared by every session on
// the machine, so an unfiltered read mixes other runs' lines into the series silently.
// ⚠ THE CEILING IS A PROPERTY OF THE ENGINE, NOT OF THIS TOOL: V3 clamps price to 25–175% of base, so
// a good sitting at 175.0% is not "expensive", it is a market that can no longer signal scarcity at
// all (BALANCE_FRAMEWORK §10.15). That is why `pin` is reported as its own column and not as a price.
//
// Reads two line kinds, both emitted by tools/telemetry_lib.ps1:
//   GW |date|market|good|buy|sell|price|production          (market_goods_wide — the yearly price watch)
//   G  |date|market|good|buy|sell|price|imports|exports|prod (market_goods_scoped — the dump dates)
//   SMA|date|tag|state|access|infra|infra_usage              (state_access — the colonial-access half)
//
// Usage:  node tools/testbed/watch_mm_chain.mjs <run-dir> [--goods a,b,c] [--tag GBR] [--access-only]
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const RUN = args[0];
if (!RUN) { console.error('usage: watch_mm_chain.mjs <run-dir> [--goods ...] [--tag GBR]'); process.exit(2); }

const GOODS = argOf('--goods', 'clippers,steamers,merchant_marine').split(',');
const ACCESS_TAG = argOf('--tag', 'GBR');
// Base prices: the single source is tools/goods_prices.tsv, never a copy inside a script.
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
const BASE = {};
for (const ln of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) {
  const [g, p] = ln.split(/\t+/); if (g && p && !isNaN(+p)) BASE[g.trim()] = +p;
}

// ⚠ meta.json is written when a run ENDS, and the whole point of this tool is to read a run that is
// still playing — so the token is derived from the folder names when it is absent. The observer's own
// rule is `<session stamp>s<run index, 3 digits>`; --token overrides for anything hand-run.
function resolveToken() {
  const cli = argOf('--token', null); if (cli) return cli;
  const mp = join(RUN, 'meta.json');
  if (existsSync(mp)) { try { const t = JSON.parse(readFileSync(mp, 'utf8')).token; if (t) return t; } catch { } }
  const parts = RUN.replace(/\\/g, '/').split('/').filter(Boolean);
  const leaf = parts[parts.length - 1] || '', sess = parts[parts.length - 2] || '';
  const idx = /^run(\d+)/.exec(leaf), stamp = /^(\d{8}_\d{6})/.exec(sess);
  if (idx && stamp) return stamp[1] + 's' + idx[1];
  return null;
}
const TOKEN = resolveToken();
if (!TOKEN) { console.error('cannot determine this run\'s token — pass --token; an unfiltered read of the shared ring is not safe (L9)'); process.exit(2); }

// Prefer the continuously-mirrored copy; logs/ is only the exit-time snapshot and can hold a
// previous run's rotated segments.
const logDirs = ['logs_live', 'logs'].map(d => join(RUN, d)).filter(existsSync);
let lines = [];
for (const d of logDirs) {
  for (const f of readdirSync(d).filter(f => f.startsWith('debug'))) {
    try { lines = lines.concat(readFileSync(join(d, f), 'utf8').split(/\r?\n/)); } catch { }
  }
  if (lines.length) break;                       // logs_live wins outright when it has content
}

let foreign = 0;
const price = {};       // date -> market -> good -> {buy,sell,price,prod}
const access = {};      // date -> [{state, acc, infra, used}]
for (const ln of lines) {
  const i = ln.indexOf('V3TB|'); if (i < 0) continue;
  const f = ln.slice(i).split('|');
  if (f[1] !== TOKEN) { foreign++; continue; }   // L9: another session's line
  const kind = f[2], date = f[3];
  if (kind === 'GW' || kind === 'G') {
    const [market, good, buy, sell, prc] = [f[4], f[5], +f[6], +f[7], +f[8]];
    const prod = kind === 'GW' ? +f[9] : +f[11];
    if (!GOODS.includes(good)) continue;
    ((price[date] ||= {})[market] ||= {})[good] = { buy, sell, price: prc, prod };
  } else if (kind === 'SMA' && f[4] === ACCESS_TAG) {
    (access[date] ||= []).push({ state: f[5], acc: +f[6], infra: +f[7], used: +f[8] });
  }
}

const pct = (g, p) => BASE[g] ? (100 * p / BASE[g]) : NaN;
const f1 = n => (isFinite(n) ? n.toFixed(1) : '—');
const dsort = a => a.sort((x, y) => x.split('.').map(Number).reduce((s, v, i) => s + v * [1e4, 1e2, 1][i], 0)
  - y.split('.').map(Number).reduce((s, v, i) => s + v * [1e4, 1e2, 1][i], 0));

if (!args.includes('--access-only')) {
  console.log('=== PRICE / ORDER BOOK  (price shown as % of base; ⛔ = pinned at an engine band edge)');
  console.log('    base prices: ' + GOODS.map(g => g + ' £' + (BASE[g] ?? '?')).join('  '));
  const markets = new Set();
  for (const d of Object.keys(price)) for (const m of Object.keys(price[d])) markets.add(m);
  for (const m of [...markets].sort()) {
    const dates = dsort(Object.keys(price).filter(d => price[d][m]));
    if (!dates.length) continue;
    console.log('\n--- market: ' + m);
    console.log('date        ' + GOODS.map(g => (g.slice(0, 9) + '  %base   buy    sell    prod').padEnd(40)).join(''));
    for (const d of dates) {
      let row = d.padEnd(12);
      for (const g of GOODS) {
        const e = price[d][m][g];
        if (!e) { row += '—'.padEnd(40); continue; }
        const p = pct(g, e.price);
        const pin = p >= 174.5 ? '⛔' : p <= 25.5 ? '⛔' : '  ';
        row += (pin + f1(p).padStart(7) + f1(e.buy).padStart(8) + f1(e.sell).padStart(8) + f1(e.prod).padStart(8) + '   ').padEnd(40);
      }
      console.log(row);
    }
  }
}

// --- THE VERDICT VIEW (user-ruled 2026-08-17). Merchant marine is the break indicator, and the
// question is not its LEVEL but its SHAPE: a steady climb that clamps at +75% and stays there is a
// broken market; a climb that decelerates, stalls or turns over is a market finding its level. So this
// prints the annualised increment beside the price — a rising price with a shrinking increment is the
// second case, and the two are indistinguishable from the level alone.
if (args.includes('--mm') || args.includes('--verdict')) {
  const G = 'merchant_marine';
  // the newest year ANY market was observed — the yardstick every series' staleness is measured against
  const MAX_YEAR = Math.max(...Object.keys(price).map(d => +d.split('.')[0]), 0);
  console.log('\n=== MERCHANT MARINE — THE BREAK INDICATOR  (% of base £' + BASE[G] + ')');
  console.log('    steady climb into ⛔175 and staying = broken · decelerating / stalling / turning over = finding its level');
  const markets = new Set();
  for (const d of Object.keys(price)) for (const m of Object.keys(price[d])) if (price[d][m][G]) markets.add(m);
  for (const m of [...markets].sort()) {
    const ds = dsort(Object.keys(price).filter(d => price[d][m]?.[G]));
    if (ds.length < 2) continue;
    const yr = d => { const [y, mo] = d.split('.').map(Number); return y + (mo - 1) / 12; };
    let prev = null, out = [];
    for (const d of ds) {
      const p = pct(G, price[d][m][G].price);
      const inc = prev ? (p - prev.p) / (yr(d) - yr(prev.d)) : NaN;
      out.push({ d, p, inc, buy: price[d][m][G].buy, sell: price[d][m][G].sell });
      prev = { d, p };
    }
    const first = out[0].p, last = out[out.length - 1].p;
    // ⚠⚠ A SERIES THAT STOPPED IS NOT A STATE THAT PERSISTED. A market vanishes when its owner does —
    // Prussia became the North German Federation in 1855, which was not in the tag list — and the last
    // observation then sits there looking like the present. Read as a live reading, PRU's 1852 value of
    // 175.0 became "pinned at the ceiling for fifty-eight years"; it was two observations and then a
    // dead country. So every line states how stale its last point is, and a series that ends well before
    // the others is called DEAD rather than given a shape at all.
    const lastYr = +out[out.length - 1].d.split('.')[0];
    const stale = MAX_YEAR - lastYr;
    // deceleration: mean annual increment over the last third vs the first third
    const k = Math.max(1, Math.floor(out.length / 3));
    const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
    const early = mean(out.slice(1, 1 + k).map(o => o.inc).filter(isFinite));
    const late = mean(out.slice(-k).map(o => o.inc).filter(isFinite));
    const shape = stale > 10 ? 'SERIES ENDS ' + lastYr + ' (market gone — NOT a current reading)'
      : last >= 174.5 ? 'AT THE CEILING'
        : late <= 0 ? 'turned over'
          : late < early * 0.5 ? 'decelerating'
            : late > early * 1.1 ? 'ACCELERATING' : 'steady climb';
    // the peak matters as much as the endpoint: a market that touched 175 once and recovered is a very
    // different object from one that sits there, and the endpoint alone cannot tell them apart either
    const peak = out.reduce((a, o) => (o.p > a.p ? o : a), out[0]);
    console.log('\n--- ' + m + '   ' + f1(first) + '% -> ' + f1(last) + '%'
      + (stale > 10 ? '' : '   early ' + f1(early) + ' pp/yr, late ' + f1(late) + ' pp/yr')
      + '  =>  ' + shape);
    console.log('    peak ' + f1(peak.p) + '% at ' + peak.d.replace(/\.\d+$/, '')
      + (peak.p >= 174.5 ? '  ⛔ TOUCHED THE CEILING' : '')
      + (stale > 10 ? '' : '   ·   ' + (out.filter(o => o.p >= 174.5).length) + ' of '
        + out.length + ' readings at the ceiling'));
    console.log('    ' + out.map(o => o.d.replace(/\.\d+$/, '') + ':' + f1(o.p)).join('  '));
    const l = out[out.length - 1];
    console.log('    latest order book: buy ' + f1(l.buy) + '  sell ' + f1(l.sell)
      + '   (buy/sell ' + f1(l.buy / (l.sell || NaN)) + ')');
  }
}

const adates = dsort(Object.keys(access));
if (adates.length) {
  console.log('\n=== MARKET ACCESS — ' + ACCESS_TAG + ' states  (1.0000 = unthrottled)');
  console.log('date          n   mean     min    <0.95  <0.75   worst states');
  for (const d of adates) {
    const a = access[d];
    const accs = a.map(x => x.acc).filter(isFinite);
    if (!accs.length) continue;
    const mean = accs.reduce((s, v) => s + v, 0) / accs.length;
    const lo95 = a.filter(x => x.acc < 0.95).length, lo75 = a.filter(x => x.acc < 0.75).length;
    const worst = [...a].sort((x, y) => x.acc - y.acc).slice(0, 3)
      .filter(x => x.acc < 0.999).map(x => x.state + ' ' + x.acc.toFixed(3)).join(', ');
    console.log(d.padEnd(12) + String(accs.length).padStart(4) + mean.toFixed(4).padStart(8)
      + Math.min(...accs).toFixed(3).padStart(8) + String(lo95).padStart(7) + String(lo75).padStart(7)
      + '   ' + (worst || 'all 1.000'));
  }
}
if (foreign) console.log('\n(skipped ' + foreign + ' lines from other sessions in the shared ring)');
if (!Object.keys(price).length && !adates.length) console.log('no telemetry for this token yet — the first dump may not have fired');
