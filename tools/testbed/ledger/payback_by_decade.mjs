#!/usr/bin/env node
// ⭐ PAYBACK BY DECADE AND BY RUNG, AT THE PRICES A RUN ACTUALLY RECORDED (user-asked 2026-09-20, of the proposed
// cost-follows-the-anchor change: "What would payback periods by decade and industry by era be then? In total profits /
// cost, at realised prices in the decade? Under the prices recorded in this n=3, ignoring the fact that changing cost
// would shift supply and demand and change everything.")
//
// ⚠⚠ THE USER'S OWN CAVEAT IS THE HEADLINE AND IS NOT OPTIONAL: this holds the measured profit per level FIXED and
//   changes only the price of the building. A cheaper building would be built more, which moves supply, prices and
//   therefore profit — so every "proposed" column is an UPPER BOUND on how good the change looks, not a prediction.
//   It answers "what were these buildings worth at the prices we saw", not "what will happen".
//
// payback (years) = building_cost (construction points) × £/point ÷ (52 × weekly profit per level)
//   ⚠ £/point is F53's IRON-FRAME rate, 720, flat. The real cheapest rate falls 1000 / 720 / 720 / 540 / 540 / 527
//     across the eras, so late-era payback here reads roughly 27% LONG. A known, accepted bias (CLAUDE.md §10.61).
//   ⚠ A rung at a LOSS has no payback and is COUNTED, never folded into a median as a large number (the payback_census
//     convention). The capital-weighted aggregate — Σ(cost × levels) ÷ Σ(52 × profit × levels) — needs no distribution
//     and is the robust reading; it is printed beside the median.
//   ⚠ `disabled` industries are skipped (L27); the era is the rung's own `era`, never a rung index.
//
// usage: node tools/testbed/ledger/payback_by_decade.mjs --session <stamp>[:<setup>] --config <book>
//        [--years 1840,...] [--per-point 720] [--min-levels 5] [--detail-years 1900,1935]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const [STAMP, SETUP] = arg('--session', '').split(':');
if (!STAMP) { console.error('usage: --session <stamp>[:<setup>] --config <book>'); process.exit(2); }
const CFG = arg('--config', 'config/mod_config.json');
const YEARS = arg('--years', '1840,1850,1860,1870,1880,1890,1900,1910,1920,1930,1935').split(',').map(Number);
const DETAIL = arg('--detail-years', '1900,1935').split(',').map(Number);
const PER_POINT = +arg('--per-point', 720);
const MINLV = +arg('--min-levels', 5);
const median = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };

const cfg = JSON.parse(readFileSync(join(REPO, CFG), 'utf8'));
const AB = cfg._ab || {};
const ANCHORED = AB.anchor_for || {};
const C = AB.cost_ratio != null ? +AB.cost_ratio : (+AB.A || 2.2);
const RUNG = {};
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;
  for (const t of ind.tiers || []) {
    const era = t.era, cost = t.building_cost || 0;
    const slid = ANCHORED[ind.id] != null;
    // the PROPOSED book: a slid rung pays one era less, i.e. anchor × C^(era−1); everything else is unchanged
    const anchorCost = Math.pow(C, era) > 0 ? cost / Math.pow(C, era) : cost;
    const proposed = slid && era > 0 ? Math.round(anchorCost * Math.pow(C, era - 1)) : cost;
    RUNG[t.key] = { ind: ind.id, era, slid, cost, proposed };
  }
}

const root = join(REPO, 'tools/testbed/sessions', STAMP);
const runs = readdirSync(root).filter(d => d.startsWith('run') && (!SETUP || d.includes(SETUP))).sort();
const data = {};   // year -> run -> key -> {lv, profit}
for (const r of runs) {
  const d = join(root, r, 'save_summaries');
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
    let j;
    try { j = JSON.parse(gunzipSync(readFileSync(join(d, f)))); } catch { continue; }
    const y = +String((j.provenance || {}).date || '').split('.')[0];
    if (!y || !YEARS.includes(y)) continue;
    const acc = {};
    for (const c of Object.values(j.countries || {})) {
      for (const [key, b] of Object.entries(c.buildings || {})) {
        if (!RUNG[key]) continue;
        const a = acc[key] || (acc[key] = { lv: 0, profit: 0 });
        a.lv += b.levels || 0; a.profit += b.profit || 0;
      }
    }
    (data[y] || (data[y] = {}))[r] = acc;
  }
}
if (!Object.keys(data).length) { console.error('no usable summaries'); process.exit(2); }

console.log(`PAYBACK BY DECADE — ${STAMP}${SETUP ? ':' + SETUP : ''} · ${CFG} · £${PER_POINT}/construction point (F53 iron-frame, flat: late eras read ~27% LONG)`);
console.log('⚠⚠ STATIC: profit per level is held at what the run RECORDED and only the building’s price changes. A cheaper building');
console.log('   would be built more, which moves supply, prices and profit — so every "proposed" figure is an UPPER BOUND, not a prediction.');
console.log(`⚠ A rung at a loss has no payback and is counted, never averaged in. Rungs under ${MINLV} levels are excluded.\n`);

// capital-weighted aggregate + median, for a selector
function agg(year, sel, useProposed) {
  const perRun = [];
  for (const [, acc] of Object.entries(data[year] || {})) {
    let cap = 0, ann = 0, lossLv = 0, lv = 0;
    const each = [];
    for (const [key, a] of Object.entries(acc)) {
      const g = RUNG[key];
      if (!g || !sel(g) || a.lv < MINLV) continue;
      const cost = (useProposed ? g.proposed : g.cost) * PER_POINT;
      cap += cost * a.lv; ann += 52 * a.profit; lv += a.lv;
      if (a.profit <= 0) lossLv += a.lv; else each.push(cost / (52 * a.profit / a.lv));
    }
    if (lv > 0) perRun.push({ aggYears: ann > 0 ? cap / ann : null, med: median(each), lossShare: lossLv / lv, lv });
  }
  if (!perRun.length) return null;
  return { aggYears: median(perRun.map(x => x.aggYears)), med: median(perRun.map(x => x.med)),
    lossShare: median(perRun.map(x => x.lossShare)), lv: median(perRun.map(x => x.lv)) };
}

const fy = x => x == null ? '   —' : (x > 200 ? '>200' : x.toFixed(1));
console.log('=== 1. CAPITAL-WEIGHTED PAYBACK IN YEARS, BY ERA AND DECADE — Σ(cost×levels) ÷ Σ(52×profit×levels) ===');
console.log('        ——————— as built (current cost) ———————     ——————— with cost sliding (proposed) ———————');
console.log('year        e0     e1     e2     e3            e0     e1     e2     e3      loss-making share of levels');
for (const y of YEARS) {
  if (!data[y]) continue;
  const cur = [0, 1, 2, 3].map(e => agg(y, g => g.era === e, false));
  const pro = [0, 1, 2, 3].map(e => agg(y, g => g.era === e, true));
  const loss = [0, 1, 2, 3].map(e => cur[e] ? (100 * cur[e].lossShare).toFixed(0) + '%' : '—');
  console.log(String(y).padEnd(8),
    cur.map(x => fy(x && x.aggYears).padStart(6)).join(' '), '     ',
    pro.map(x => fy(x && x.aggYears).padStart(6)).join(' '), '   ',
    loss.map(s => s.padStart(5)).join(' '));
}

console.log('\n=== 2. THE SAME, SPLIT SLID vs UNSLID (only the slid group’s cost changes) ===');
console.log('                 ———— slid (anchored e1) ————        ———— unslid (anchored e0) ————');
console.log('year        e1 now  e1 prop   e2 now  e2 prop   e3 now  e3 prop       e1     e2     e3');
for (const y of YEARS) {
  if (!data[y]) continue;
  const s = e => [agg(y, g => g.era === e && g.slid, false), agg(y, g => g.era === e && g.slid, true)];
  const u = e => agg(y, g => g.era === e && !g.slid, false);
  const [s1c, s1p] = s(1), [s2c, s2p] = s(2), [s3c, s3p] = s(3);
  console.log(String(y).padEnd(8),
    fy(s1c && s1c.aggYears).padStart(7), fy(s1p && s1p.aggYears).padStart(8),
    fy(s2c && s2c.aggYears).padStart(8), fy(s2p && s2p.aggYears).padStart(8),
    fy(s3c && s3c.aggYears).padStart(8), fy(s3p && s3p.aggYears).padStart(8), '  ',
    [1, 2, 3].map(e => { const x = u(e); return fy(x && x.aggYears).padStart(6); }).join(' '));
}

console.log('\n=== 3. PER INDUSTRY × ERA, at the detail years — capital-weighted, current → proposed ===');
for (const y of DETAIL) {
  if (!data[y]) continue;
  console.log(`\n  ${y}`);
  console.log('  industry        e0            e1            e2            e3          (years; → shown only where cost changes)');
  const inds = [...new Set(Object.values(RUNG).map(g => g.ind))].sort();
  for (const ind of inds) {
    const cells = [0, 1, 2, 3].map(e => {
      const c = agg(y, g => g.ind === ind && g.era === e, false);
      const p = agg(y, g => g.ind === ind && g.era === e, true);
      if (!c) return '     —      ';
      const slid = Object.values(RUNG).some(g => g.ind === ind && g.era === e && g.slid && e > 0);
      const a = fy(c.aggYears), b = fy(p.aggYears);
      return (slid && a !== b ? `${a}→${b}` : a).padStart(12);
    });
    if (cells.every(s => s.trim() === '—')) continue;
    console.log('  ' + ind.padEnd(13) + cells.join('  '));
  }
}
