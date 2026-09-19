#!/usr/bin/env node
// ⭐⭐ ONE GOOD'S ORDER BOOK ACROSS ARMS — buy, sell, production and the producing industry's size, not price alone.
//
// Read-only. Written 2026-09-19 because F147 left a reading that price could not settle: adding the supplier point took engine CONSUMPTION from
// 0.62 to 0.95 of vanilla while the share of engine prices at the +75% ceiling ROSE from 30% to 45%. Price alone cannot tell "the market is bigger
// and just as tight" from "the extra demand is unmet" — the ORDER BOOK can:
//   SUPPLY SUCCESS: production up, the producer's staffed levels up, buy/sell roughly unchanged.
//   SUPPLY FAILURE:  production flat, buy orders up, buy/sell UP.
//
// ⚠ A price at the band edge (25% or 175% of base) means the market can no longer signal scarcity at all (§10.15), so past that point the price
//   carries no information and only the quantities do. That is exactly the regime this tool exists for.
//
// usage: node tools/testbed/ledger/good_market.mjs --good engines --arm <session>:<setup>[,<session>:<setup>] [--arm …] [--dates a,b,c]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SES = join(REPO, 'tools/testbed/sessions');
const { usableRuns } = await import(pathToFileURL(join(REPO, 'tools/testbed/ledger/lib_runs.mjs')).href);
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const argAll = k => process.argv.reduce((a, v, i) => (v === k && process.argv[i + 1] ? [...a, process.argv[i + 1]] : a), []);
const GOOD = argOf('--good', 'engines');
const DATES = argOf('--dates', '1836.2.1,1836.7.1,1837.1.1,1837.7.1,1837.12.1').split(',');
const ARMS = argAll('--arm');
if (!ARMS.length) { console.error('usage: --good <good> --arm <session>:<setup> [--arm …]'); process.exit(2); }
const PRICE = Object.fromEntries(readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f0 = x => Number.isFinite(x) ? x.toFixed(0) : '—';
const f2 = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';

// which of OUR building types make this good (from a run's own config), so the producer's size can be read beside the market
function producersOf(runDir) {
  let p = ''; try { const bs = JSON.parse(readFileSync(join(runDir, 'build_state.json'), 'utf8')); const d = bs.deterministic || {};
    p = (d.mod_under_test || {}).built_from_config || d.built_from_config || ''; } catch { }
  if (!p) return null; const abs = existsSync(p) ? p : join(REPO, p); if (!existsSync(abs)) return null;
  const cfg = JSON.parse(readFileSync(abs, 'utf8')); const keys = [];
  for (const ind of cfg.industries || []) { if (ind.disabled) continue;
    const og = ind.output_good || (ind.tiers[0] || {}).output_good;
    if (og === GOOD) for (const t of ind.tiers) keys.push(t.key); }
  return keys;
}
function readRun(rel) {
  const out = { mk: {}, lv: NaN, st: NaN };
  const f = join(SES, rel, 'markets.tsv');
  if (existsSync(f)) for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (c.length < 11) continue; const d = c[1]; if (!DATES.includes(d) || c[4] !== GOOD) continue;
    const o = (out.mk[d] ||= { buy: 0, sell: 0, prod: 0, px: [] });
    o.buy += +c[5] || 0; o.sell += +c[6] || 0; o.prod += +c[10] || 0; if (+c[7] > 0) o.px.push(100 * (+c[7]) / PRICE[GOOD]); }
  const keys = producersOf(join(SES, rel)); const dir = join(SES, rel, 'save_summaries');
  if (keys && keys.length && existsSync(dir)) { let last = null;
    for (const fn of readdirSync(dir).filter(x => x.endsWith('.gz')).sort()) { let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, fn))).toString('utf8')); } catch { continue; }
      let lv = 0, st = 0; for (const c of Object.values(j.countries || {})) for (const k of keys) { const b = (c.buildings || {})[k]; if (b) { lv += +b.levels || 0; st += +b.staffing || 0; } }
      last = { lv, st }; }
    if (last) { out.lv = last.lv; out.st = last.st; } }
  return out;
}
console.log('THE ' + GOOD.toUpperCase() + ' MARKET — the instrumented markets summed, median over each arm\'s usable runs');
console.log('⚠ a price at 175% of base is the band EDGE: past it the price carries no information and only the quantities do.\n');
console.log('arm                    n   ' + DATES.map(d => d.split('.').slice(0, 2).join('.').padStart(9)).join('') + '   producer at the end');
for (const spec of ARMS) {
  const [ses, setup] = spec.split(':');
  let runs = []; try { runs = usableRuns(SES, ses, setup || '').runs; } catch { }
  const rs = runs.map(readRun).filter(r => Object.keys(r.mk).length);
  if (!rs.length) { console.log('  ' + (setup || ses).padEnd(20) + ' (no usable run)'); continue; }
  const lab = (setup || ses).replace(/^probe-/, '');
  const row = (name, pick) => console.log('  ' + (name === 'price %base' ? lab.padEnd(14) : ''.padEnd(14)) + name.padEnd(11) + (name === 'price %base' ? String(rs.length).padStart(2) : '  ') + '  '
    + DATES.map(d => pick(d).padStart(9)).join(''));
  row('price %base', d => f0(med(rs.flatMap(r => (r.mk[d] || { px: [] }).px))));
  row('buy', d => f0(med(rs.map(r => (r.mk[d] || {}).buy))));
  row('sell', d => f0(med(rs.map(r => (r.mk[d] || {}).sell))));
  row('production', d => f0(med(rs.map(r => (r.mk[d] || {}).prod))));
  row('buy/sell', d => f2(med(rs.map(r => { const o = r.mk[d]; return o && o.sell > 0 ? o.buy / o.sell : NaN; }))));
  const all = rs.flatMap(r => DATES.flatMap(d => (r.mk[d] || { px: [] }).px));
  console.log('  ' + ''.padEnd(14) + 'at ceiling ' + (100 * all.filter(x => x >= 174).length / all.length).toFixed(0).padStart(4) + '%'
    + '   producer levels ' + f2(med(rs.map(r => r.lv)), 1) + ' / staffed ' + f2(med(rs.map(r => r.st)), 1) + '\n');
}
