// "DO OLD PLANTS DIE?" — the ledger's obsolescence table (user, 2026-10-29: the old in-market vs trade table reworked "completely, and it must
// contain less data"; promoted from the session that proposed it). Per tiered industry: the workers on OLD plants at their peak over the
// century, what is left at the last reading, and their share of the industry's workers then.
//   OLD = a rung two or more tiers below its own MARKET's frontier, the frontier being the highest tier holding at least 10% of that market's
//   workers in the industry — laggard_census.mjs's in-market rule and the old in-market table's (F161 §4), so nothing new is defined: on the
//   1.0 canon's 16 runs it reproduces F249 §4's per-industry 1935 shares exactly (textile 17.2%, art academy 23.9%, …).
//   Workers = levels running a rung's main method × the building's staffing share × the rung's per-level employment (crafts × workforce_mult);
//   a merge host's levels are its methods' (`pms`), so a merged rung counts at its own tier. The LAST 1 January summary of a year is read (a
//   resume's replayed branch overwrites the abandoned one), as laggard_census.mjs does.
// Mod only: a vanilla factory upgrades in place, so vanilla has no old plant to count (the like-for-like vanilla comparison is
// laggard_pressure.mjs, a scorecard line).
// Writes <outDir>/old_plants.json: per year the MEAN over the runs (a run without the tag counts zero) of old and all workers, per industry, for
// the world, the shortlist pool (lib_markets POOL, main records) and each watchlist tag (the page sums a selection).
//   node tools/testbed/ledger/fill_old_plants.mjs <outDir> --mod <runs> --config <book>
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { usableRuns } from './lib_runs.mjs';
import { POOL } from './lib_markets.mjs';
import { SESSIONS } from './lib_sumidx.mjs';
const argv = process.argv.slice(2), DIR = argv[0];
const opt = k => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : null; };
const MODS = opt('--mod'), BOOK = opt('--config');
if (!DIR || !MODS || !BOOK) { console.error('usage: fill_old_plants.mjs <outDir> --mod <runs> --config <book>'); process.exit(2); }
const cfg = JSON.parse(readFileSync(BOOK, 'utf8').replace(/^﻿/, ''));
const MAP = {}, NAME = {};
for (const [k, ind] of Object.entries(cfg.industries)) { if (ind.disabled) continue; const id = ind.id || k;
  NAME[id] = id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  for (const t of ind.tiers || []) { const base = Object.values(t.employment || {}).reduce((a, b) => a + b, 0) || 5000;
    if (t.pm_key) MAP[t.pm_key] = { ind: id, era: t.era, emp: base * (t.workforce_mult || 1) }; } }
// the watchlist page's tags (ledger_template.html TAGS) — the page sums whichever of them the reader selects
const WATCH = ['GBR', 'RUS', 'FRA', 'USA', 'PRU', 'TUR', 'AUS', 'SPA', 'BRZ', 'SIC', 'POR', 'NET', 'BEL', 'NGF', 'GER', 'UNL'];
const POOLS = new Set(POOL);
const YEARS = [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
const CONSUMER = new Set(['food', 'textile', 'furniture', 'glass', 'paper', 'art_academy']);   // bought by pops (F136, F249 §4)
const frontier = by => { const tot = Object.values(by).reduce((a, b) => a + b, 0); let f = -1; for (const [e, w] of Object.entries(by)) if (w >= 0.1 * tot && +e > f) f = +e; return f; };
const { runs, dropped } = usableRuns(SESSIONS, MODS, '');
for (const d of dropped) console.error('  EXCLUDED ' + d.run + ': ' + d.reason);
if (!runs.length) { console.error('fill_old_plants: no usable run in --mod'); process.exit(1); }
const zero = () => YEARS.map(() => 0);
const acc = { world: {}, pool: {}, tags: Object.fromEntries(WATCH.map(t => [t, {}])) };
const add = (o, ind, yi, old, tot) => { const A = o[ind] ||= { old: zero(), tot: zero() }; A.old[yi] += old; A.tot[yi] += tot; };
for (const rel of runs) {
  const sd = join(SESSIONS, rel, 'save_summaries'); if (!existsSync(sd)) continue;
  const last = {};
  for (const f of readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(sd, f)))); } catch { continue; }
    const d = String(j.provenance?.date || '').split('.').map(Number); if (d[1] !== 1 || d[2] !== 1 || !YEARS.includes(d[0])) continue; last[d[0]] = j; }
  YEARS.forEach((y, yi) => { const j = last[y]; if (!j) return;
    const W = {}, M = {};                         // W[country key][ind][era]; M[market][ind][era]
    for (const [ck, c] of Object.entries(j.countries || {})) for (const b of Object.values(c.buildings || {})) { const lv = b.levels || 0; if (!lv) continue;
      const sf = Math.min(1, (b.staffing || 0) / lv);
      for (const [pm, l] of Object.entries(b.pms || {})) { const r = MAP[pm]; if (!r) continue; const w = l * sf * r.emp; if (!(w > 0)) continue;
        const a = ((W[ck] ||= {})[r.ind] ||= {}); a[r.era] = (a[r.era] || 0) + w;
        const m = ((M[c.market] ||= {})[r.ind] ||= {}); m[r.era] = (m[r.era] || 0) + w; } }
    const F = {}; for (const [m, inds] of Object.entries(M)) { F[m] = {}; for (const [i, by] of Object.entries(inds)) F[m][i] = frontier(by); }
    for (const [ck, inds] of Object.entries(W)) { const c = j.countries[ck], tag = c.tag || ck.split('@')[0], main = !ck.includes('@');
      for (const [i, by] of Object.entries(inds)) { const f = F[c.market]?.[i] ?? -1; let old = 0, tot = 0;
        for (const [e, w] of Object.entries(by)) { tot += w; if (+e <= f - 2) old += w; }
        add(acc.world, i, yi, old, tot);
        if (main && POOLS.has(tag)) add(acc.pool, i, yi, old, tot);
        if (main && acc.tags[tag]) add(acc.tags[tag], i, yi, old, tot); } }
  });
}
const n = runs.length, r0 = x => Math.round(x / n);
const scale = o => Object.fromEntries(Object.entries(o).map(([i, A]) => [i, { old: A.old.map(r0), tot: A.tot.map(r0) }]));
const out = { years: YEARS, n, rule: 'two or more tiers below its own market’s frontier (the highest tier with ≥ 10% of the market’s workers in the industry)',
  names: NAME, consumer: [...CONSUMER].filter(i => NAME[i]), world: scale(acc.world), pool: scale(acc.pool),
  tags: Object.fromEntries(Object.entries(acc.tags).map(([t, o]) => [t, scale(o)])) };
writeFileSync(join(DIR, 'old_plants.json'), JSON.stringify(out));
const last = YEARS.length - 1;
console.log(`old plants, world, ${n} runs — industry: peak → ${YEARS[last]} (share of the industry then)`);
for (const [i, A] of Object.entries(out.world).sort((a, b) => b[1].old[last] / (b[1].tot[last] || 1) - a[1].old[last] / (a[1].tot[last] || 1))) {
  const pk = Math.max(...A.old); if (!pk) continue;
  console.log(`  ${i.padEnd(14)} ${(pk / 1e3).toFixed(0)}k (${YEARS[A.old.indexOf(pk)]}) → ${(A.old[last] / 1e3).toFixed(0)}k  (${(100 * A.old[last] / A.tot[last]).toFixed(1)}%)`); }
