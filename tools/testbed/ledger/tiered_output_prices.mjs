// THE TIERED INDUSTRIES' OUTPUT PRICES, DECADE BY DECADE (2026-10-29, the user: "the ledger reads building-input prices … What about output?
// For tiered industries"). The ledger's PI / PP / PM lines read the tiered industries' main goods split by BUYER (other buildings, pops,
// armies), as unweighted medians over goods × markets; this reads them by SELLER, weighted by output value, main and secondary goods together:
//   output price ÷ base = Σ goods_sales ÷ Σ va_out over the tiered industries' buildings in scope (goods_sales at market, va_out the same output
//   at base prices, both weekly £ — save summary v9+; CLAUDE.md §2.10's margin identity), so the secondary lines (luxury clothes and furniture,
//   porcelain, liquor, silk, tanks, aeroplanes) count by their value, which no price line of the register carries.
// Scopes: the world, the shortlist pool (lib_markets POOL, main records); per industry at the last year. The mod reads every rung's building
// (crafts included; a merged rung is its host's method, inside the host's figures); vanilla reads each industry's base building (the book's
// first rung's key, as fill_indecomp.mjs does). The first summary of each year. A run without goods_sales (summaries before v9: the summer
// vanilla n=18) is left out and counted.
//   node tools/testbed/ledger/tiered_output_prices.mjs --mod <group>:<setup> [--van <group>:vanilla] --config <book> [--json <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { usableRuns, VANILLA_REF } from './lib_runs.mjs';
import { POOL } from './lib_markets.mjs';
import { indexRun, firstOf, readSum, SESSIONS, med } from './lib_sumidx.mjs';
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const MODSPEC = opt('--mod'), VANSPEC = opt('--van') || VANILLA_REF + ':vanilla', BOOK = opt('--config');
if (!MODSPEC || !BOOK) { console.error('usage: tiered_output_prices.mjs --mod <group>:<setup> [--van <group>:vanilla] --config <book> [--json <file>]'); process.exit(2); }
const cfg = JSON.parse(readFileSync(BOOK, 'utf8').replace(/^﻿/, ''));
const MODKEY = {}, VANKEY = {};
for (const [k, ind] of Object.entries(cfg.industries)) { if (ind.disabled) continue; const id = ind.id || k;
  for (const t of ind.tiers || []) if (!t.method_of) MODKEY[t.key] = id;
  if (ind.tiers && ind.tiers.length) VANKEY[ind.tiers[0].key] = id; }
const YEARS = [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935], LAST = YEARS[YEARS.length - 1];
const POOLS = new Set(POOL);
const split = s => { const i = s.lastIndexOf(':'); return [s.slice(0, i), s.slice(i + 1)]; };
function readArm(spec, keys) {
  const [group, setup] = split(spec); const { runs } = usableRuns(SESSIONS, group, setup);
  const out = { world: [], pool: [], ind: { world: {}, pool: {} }, used: [], skipped: [] };
  for (const rel of runs) {
    const idx = indexRun(join(SESSIONS, rel)); const w = YEARS.map(() => [0, 0]), p = YEARS.map(() => [0, 0]), iw = {}, ip = {}; let ok = true;
    YEARS.forEach((y, yi) => { const d = firstOf(idx, y); if (!d || !ok) return; const j = readSum(idx[d]);
      for (const [ck, c] of Object.entries(j.countries || {})) { const tag = c.tag || ck.split('@')[0], inPool = POOLS.has(tag) && !ck.includes('@');
        for (const [bk, b] of Object.entries(c.buildings || {})) { const ind = keys[bk]; if (!ind) continue;
          if (b.goods_sales == null) { if (+b.va_out > 0) ok = false; continue; }
          const s = +b.goods_sales || 0, v = +b.va_out || 0; if (!(v > 0)) continue;
          w[yi][0] += s; w[yi][1] += v; if (inPool) { p[yi][0] += s; p[yi][1] += v; }
          if (y === LAST) { const a = iw[ind] ||= [0, 0]; a[0] += s; a[1] += v; if (inPool) { const q = ip[ind] ||= [0, 0]; q[0] += s; q[1] += v; } } } } });
    if (!ok) { out.skipped.push(rel); continue; }
    out.used.push(rel); out.world.push(w.map(([s, v]) => v > 0 ? s / v : null)); out.pool.push(p.map(([s, v]) => v > 0 ? s / v : null));
    for (const [sc, src] of [['world', iw], ['pool', ip]]) for (const [ind, [s, v]] of Object.entries(src)) (out.ind[sc][ind] ||= []).push(v > 0 ? s / v : null);
  }
  const col = (rows, i) => rows.map(r => r[i]).filter(Number.isFinite);
  const sum = rows => ({ med: YEARS.map((_, i) => med(col(rows, i))), lo: YEARS.map((_, i) => Math.min(...col(rows, i))), hi: YEARS.map((_, i) => Math.max(...col(rows, i))) });
  return { n: out.used.length, skipped: out.skipped.length, world: sum(out.world), pool: sum(out.pool),
    ind: Object.fromEntries(['world', 'pool'].map(sc => [sc, Object.fromEntries(Object.entries(out.ind[sc]).map(([k, v]) => [k, med(v.filter(Number.isFinite))]))])) };
}
const mod = readArm(MODSPEC, MODKEY), van = readArm(VANSPEC, VANKEY);
const res = { years: YEARS, last: LAST, mod, van, generated: new Date().toISOString().slice(0, 10), modSpec: MODSPEC, book: BOOK };
const f2 = x => Number.isFinite(x) ? x.toFixed(2) : '—';
console.log(`tiered output prices (Σ goods_sales ÷ Σ va_out, median of runs) — mod n=${mod.n}${mod.skipped ? ' (' + mod.skipped + ' without goods_sales left out)' : ''}, vanilla n=${van.n}${van.skipped ? ' (' + van.skipped + ' without goods_sales left out)' : ''}`);
for (const sc of ['pool', 'world']) {
  console.log(`  ${sc === 'pool' ? 'shortlist' : 'world'}   ` + YEARS.map(y => String(y).padStart(6)).join(''));
  console.log('    mod     ' + mod[sc].med.map(v => f2(v).padStart(6)).join('') + '\n    vanilla ' + van[sc].med.map(v => f2(v).padStart(6)).join(''));
}
console.log(`  per industry at ${LAST}, shortlist (mod / vanilla): ` + Object.keys(mod.ind.pool).sort().map(k => `${k} ${f2(mod.ind.pool[k])}/${f2(van.ind.pool[k])}`).join(' · '));
const J = opt('--json'); if (J) { writeFileSync(J, JSON.stringify(res)); console.log('json → ' + J); }
