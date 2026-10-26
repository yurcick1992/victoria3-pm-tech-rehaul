// WHY AN OLD RUNG SELLS DEARER THAN THE FRONTIER — output mix or location (FINDINGS F249 §4d, 2026-10-26).
// frontier_supply.mjs showed the old consumer rungs realising a higher output price index than their frontier in the same country (1930: furniture
// t1 1.02 against t2 0.69). Two candidates: OUTPUT MIX (the rung runs a secondary whose side good holds its price better than the main good) or
// LOCATION (it sits in markets, or states, where the good is dearer). This reader rebuilds every staffed tiered building's output from its ACTIVE
// methods (the built mod's production_methods, workforce-scaled goods), values it at base and at its country's own market's 1 January price
// (markets.tsv), and compares that prediction with the summary's realised index (goods_sales ÷ va_out):
//   predicted ≈ actual     → market prices and mix explain the index; a residual is state-local pricing within the market
//   main / side            → the price index of the main good / of the side goods, each at the base-value weights of what the rung makes
//   side share             → the side goods' share of the rung's output at base prices
//   decomposition          → each rung against the next rung up: MIX = its index minus its index at the upper rung's side share; LOCATION = the rest
// Section B buckets each rung's records by the share of its levels running a side-good secondary (a non-main method that adds a good other than
// the industry's own) and prints realised index, margin (§2.10) and profit per staffed level, in £ a week.
// Scope: pool countries (GBR USA FRA NET BEL UNL PRU NGF GER) that lead a market in markets.tsv; a country inside another's market is skipped and
// counted. Weights are base-priced output (va_out). ⚠ --mod must be a build of the SAME book the runs played (default mod/, the canon's build).
//   node tools/testbed/ledger/price_mix.mjs <book> <group>:<setup> [--years 1910,1930] [--industries textile,furniture,glass] [--mod mod]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { usableRuns } from './lib_runs.mjs';
import { MARKET_NAMES } from './lib_markets.mjs';
const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const SES = join(REPO, 'tools', 'testbed', 'sessions');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : d; };
const YEARS = opt('--years', '1910,1930').split(',').map(Number);
const SHOW = opt('--industries', 'textile,furniture,glass').split(',');
const cfg = JSON.parse(readFileSync(join(REPO, args[0]), 'utf8'));
const [SESS, SETUP] = args[1].split(':');
const BASE = {}; for (const l of readFileSync(join(REPO, 'tools', 'goods_prices.tsv'), 'utf8').split(/\r?\n/)) { if (!l || l.startsWith('#')) continue; const [g, p] = l.split('\t'); BASE[g] = +p; }
const PM = {};                                    // method -> { out: {good: qty} } (workforce-scaled goods_output_*_add; inputs are not needed)
const pmDir = join(REPO, opt('--mod', 'mod'), 'common', 'production_methods');
for (const f of readdirSync(pmDir).filter(f => f.endsWith('.txt'))) {
  const s = readFileSync(join(pmDir, f), 'utf8').replace(/#[^\n]*/g, ''); const re = /^([A-Za-z0-9_]+)[ \t]*=[ \t]*\{/gm; let m;
  while ((m = re.exec(s))) { let d = 0, j = m.index + m[0].length - 1; for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; }
    const out = {}; for (const g of s.slice(m.index, j + 1).matchAll(/goods_output_([a-z_]+?)_add[ \t]*=[ \t]*(-?[0-9.]+)/g)) out[g[1]] = (out[g[1]] || 0) + +g[2];
    PM[m[1]] = { out }; re.lastIndex = j + 1; } }
const TYPE = {}; const MAIN = {};
for (const I of cfg.industries) { if (I.disabled || !SHOW.includes(I.id)) continue; MAIN[I.id] = I.output_good;
  for (const t of I.tiers) if (!t.method_of) TYPE[t.key] = { ind: I.id, tier: t.craft ? '0c' : String(t.era) }; }
for (const [ind, g] of Object.entries(MAIN)) if (!g) throw new Error(`industry ${ind} has no output_good in the book`);
const sideLine = (pm, ind) => !/^pm_main_/.test(pm) && Object.entries(PM[pm]?.out || {}).some(([g, q]) => q > 0 && g !== MAIN[ind]);
const POOL = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'UNL', 'PRU', 'NGF', 'GER'];
const runs = usableRuns(SES, SESS, SETUP).runs;
if (!runs.length) throw new Error(`no usable runs for ${args[1]}`);
const unknown = new Set(); let used = 0, skipped = 0, unpricedRec = 0; const seenSide = {};
const A = {}, B = {};
for (const rel of runs) {
  const mt = join(SES, rel, 'markets.tsv'); if (!existsSync(mt)) { console.log(`  ${rel}: no markets.tsv — skipped`); continue; }
  const mk = {}; for (const l of readFileSync(mt, 'utf8').split(/\r?\n/).slice(1)) { const c = l.split('\t'); if (c.length >= 8) ((mk[c[1]] ||= {})[c[2]] ||= {})[c[4]] = +c[7]; }
  const sd = join(SES, rel, 'save_summaries'); const last = {};
  for (const f of readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f))).toString()); } catch { continue; }
    const p = String(j.provenance?.date || '').split('.').map(Number); if (YEARS.includes(p[0]) && p[1] === 1 && p[2] === 1) last[p[0]] = j; }
  for (const [y, j] of Object.entries(last)) for (const tag of POOL) { const c = j.countries[tag]; if (!c || c.is_main_tag === false) continue;
    const name = (MARKET_NAMES[tag] || []).find(n => mk[`${y}.1.1`]?.[n]); const price = name && mk[`${y}.1.1`][name];
    for (const [k, b] of Object.entries(c.buildings || {})) { const t = TYPE[k]; if (!t || !(b.staffing > 0.5) || !(b.va_out > 0) || !(b.levels > 0)) continue;
      const w = b.va_out;
      const sl = Object.entries(b.pms || {}).filter(([pm]) => sideLine(pm, t.ind)); for (const [pm] of sl) (seenSide[t.ind] ||= new Set()).add(pm);
      const lux = sl.reduce((a, [, n]) => a + n, 0) / b.levels;
      const bk = lux < 0.2 ? 'none' : lux >= 0.8 ? 'full' : 'part';
      const o = (B[`${y}|${t.ind}|${t.tier}|${bk}`] ||= { n: 0, st: 0, profit: 0, sales: 0, va: 0 }); o.n++; o.st += b.staffing; o.profit += b.profit; o.sales += b.goods_sales; o.va += b.va_out;
      if (!price) { skipped++; continue; }
      const q = {}; for (const [pm, n] of Object.entries(b.pms || {})) { if (!PM[pm]) { unknown.add(pm); continue; } for (const [g, v] of Object.entries(PM[pm].out)) q[g] = (q[g] || 0) + n * v; }
      let vb = 0, vm = 0, mb = 0, mm = 0, miss = 0;
      for (const [g, v] of Object.entries(q)) { if (!(v > 0)) continue; if (!(price[g] > 0) || !(BASE[g] > 0)) { miss++; continue; }
        vb += v * BASE[g]; vm += v * price[g]; if (g === MAIN[t.ind]) { mb += v * BASE[g]; mm += v * price[g]; } }
      if (miss || !(vb > 0) || !(mb > 0)) { unpricedRec++; continue; } used++;
      const a = (A[`${y}|${t.ind}|${t.tier}`] ||= { n: 0, w: 0, act: 0, pred: 0, main: 0, sh: 0, sideW: 0, sideV: 0 });
      const sh = 1 - mb / vb; a.n++; a.w += w; a.act += w * b.goods_sales / b.va_out; a.pred += w * vm / vb; a.main += w * mm / mb; a.sh += w * sh;
      if (sh > 1e-6) { a.sideW += w * sh; a.sideV += w * sh * (vm - mm) / (vb - mb); } } }
}
console.log(`PRICE MIX — ${SESS}:${SETUP}, ${runs.length} runs; building records priced ${used}; skipped: ${skipped} in another country's market, ${unpricedRec} with a good unpriced in markets.tsv; methods missing from ${opt('--mod', 'mod')}: ${[...unknown].join(' ') || 'none'}`);
for (const [ind, set] of Object.entries(seenSide)) console.log(`  side lines seen in ${ind}: ${[...set].map(pm => `${pm} (${Object.entries(PM[pm].out).filter(([, q]) => q > 0).map(([g, q]) => `+${q} ${g}`).join(', ')})`).join('; ')}`);
const f2 = x => Number.isFinite(x) ? x.toFixed(2) : '—';
for (const y of YEARS) for (const ind of SHOW) {
  const rows = ['0c', '1', '2', '3'].map(tr => { const a = A[`${y}|${ind}|${tr}`]; if (!a) return null;
    const side = a.sideW > 0 ? a.sideV / a.sideW : NaN, main = a.main / a.w;
    return { tr, n: a.n, act: a.act / a.w, pred: a.pred / a.w, main, side, sh: a.sh / a.w, at: s => (1 - s) * main + s * (Number.isFinite(side) ? side : main) }; }).filter(Boolean);
  if (!rows.length) continue;
  console.log(`\n${y} ${ind.toUpperCase()} (main good ${MAIN[ind]}) — rung · records · ACTUAL index · PREDICTED from active methods at the market's 1 January price · main good · side goods · side goods' share of base output value`);
  for (const r of rows) console.log(`  t${r.tr.padEnd(3)} ${String(r.n).padStart(4)}   actual ${f2(r.act)}   predicted ${f2(r.pred)}   main ${f2(r.main)}   side ${f2(r.side)}   side share ${(100 * r.sh).toFixed(0)}%`);
  const tiered = rows.filter(r => r.tr !== '0c');
  for (let i = 0; i + 1 < tiered.length; i++) { const lo = tiered[i], hi = tiered[i + 1]; const atHi = lo.at(hi.sh);
    console.log(`  t${lo.tr} − t${hi.tr} predicted gap ${f2(lo.pred - hi.pred)} = MIX ${f2(lo.pred - atHi)} (t${lo.tr} at t${hi.tr}'s side share) + LOCATION ${f2(atHi - hi.pred)} (where each rung sells)`); }
  console.log(`  by side line on its levels — rung · none (< 20%) / part / full (≥ 80%): country-runs · staffed levels · realised index · margin · profit £ per staffed level a week`);
  for (const tr of ['0c', '1', '2', '3']) { const cells = ['none', 'part', 'full'].map(bk => { const o = B[`${y}|${ind}|${tr}|${bk}`]; return o ? `${bk} ${o.n}·${o.st.toFixed(0)}·${f2(o.sales / o.va)}·${(100 * o.profit / (o.sales - o.profit)).toFixed(0)}%·£${(o.profit / o.st).toFixed(0)}` : null; }).filter(Boolean);
    if (cells.length) console.log(`    t${tr.padEnd(3)} ${cells.join('   ')}`); }
}
