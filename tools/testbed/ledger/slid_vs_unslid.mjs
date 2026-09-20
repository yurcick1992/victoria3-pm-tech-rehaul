#!/usr/bin/env node
// ⭐⭐ SLID vs UNSLID — does an anchor-slid industry's frontier earn, cost and weigh the same as an unslid one?
//
// User-asked 2026-09-20, of the eight-industry e1 anchor slide: "T3 is very different in efficiency (money printing or
// realised margins) between t0-anchored and t1-anchored industries. How is it in practice? And additionally, how
// different is the build cost between them now? Is there a noticeable change in share of these newly T1 anchored ones
// compared to canon?"
//
// The arithmetic behind the worry: `--anchor-for` moves OUTPUT and INPUT VALUE only — `building_cost` and `ai_value`
// stay functions of the ABSOLUTE era. So at e3 a slid industry makes `anchor × A²` where an unslid one makes
// `anchor × A³`, for the SAME construction cost. Capital per unit of output therefore differs by a factor of A between
// the two groups at every rung above the anchor, by construction. This measures what that does in play.
//
// Read-only, off the yearly save summaries.
//   1. MARGIN — realised, by F92's identity margin = profit ÷ (va_out − profit), which needs no wage model. Per rung,
//      grouped by slid/unslid, level-weighted, world-wide and pooled over the shortlist.
//   2. CAPITAL — building_cost from the run's own config, against that rung's OWN realised value added per level, so
//      the comparison is cost per unit of what the building actually produces rather than per unit of design output.
//   3. SHARE — the slid group's share of tiered levels, workers and value added, arm against a reference book.
//
// ⚠ `disabled` industries are skipped (landmine L27). ⚠ The era is the rung's own `era` from the run's own config,
//   never a rung index. ⚠ A rung with no staffed levels anywhere is reported as absent, not as a zero margin.
//
// usage: node tools/testbed/ledger/slid_vs_unslid.mjs --arm <stamp>[:<setup>] --config <book>
//        [--ref <stamp>[,<stamp>][:<setup>] --ref-config <book>] [--year 1935] [--slid <ids>]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const YEAR = +arg('--year', 1935);
const POOL = arg('--tags', 'GBR,USA,FRA,NET,BEL,PRU,NGF,GER').split(',');
const median = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };

function book(cfgPath, slidOverride) {
  const cfg = JSON.parse(readFileSync(join(REPO, cfgPath), 'utf8'));
  const anchor = (cfg._ab && cfg._ab.anchor_for) || {};
  const slid = new Set(slidOverride || Object.keys(anchor));
  const rung = {};
  for (const ind of cfg.industries || []) {
    if (ind.disabled) continue;
    for (const t of ind.tiers || []) {
      rung[t.key] = { ind: ind.id, era: t.era, cost: t.building_cost || 0, slid: slid.has(ind.id),
        emp: Object.values(t.employment || {}).reduce((a, b) => a + (b || 0), 0) * (t.workforce_mult != null ? +t.workforce_mult : 1) };
    }
  }
  return { rung, slid };
}

function harvest(stamps, setup, rung) {
  const out = [];
  for (const stamp of stamps) {
    const root = join(REPO, 'tools/testbed/sessions', stamp);
    if (!existsSync(root)) continue;
    for (const r of readdirSync(root).filter(d => d.startsWith('run') && (!setup || d.includes(setup))).sort()) {
      const d = join(root, r, 'save_summaries');
      if (!existsSync(d)) continue;
      let hit = null;
      for (const f of readdirSync(d).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.'))) {
        let j;
        try { j = JSON.parse(gunzipSync(readFileSync(join(d, f)))); } catch { continue; }
        if (+String((j.provenance || {}).date || '').split('.')[0] === YEAR) { hit = j; break; }
      }
      if (!hit) continue;
      const acc = {};   // key -> totals, world and pool
      for (const [tag, c] of Object.entries(hit.countries || {})) {
        const inPool = POOL.includes(tag);
        for (const [key, b] of Object.entries(c.buildings || {})) {
          if (!rung[key]) continue;
          const a = acc[key] || (acc[key] = { lv: 0, st: 0, prof: 0, vo: 0, vi: 0, plv: 0, pst: 0, pprof: 0, pvo: 0 });
          a.lv += b.levels || 0; a.st += b.staffing || 0; a.prof += b.profit || 0; a.vo += b.va_out || 0; a.vi += b.va_in || 0;
          if (inPool) { a.plv += b.levels || 0; a.pst += b.staffing || 0; a.pprof += b.profit || 0; a.pvo += b.va_out || 0; }
        }
      }
      out.push({ run: stamp + '/' + r, acc });
    }
  }
  return out;
}

const [ARM_S, ARM_SET] = arg('--arm', '').split(':');
if (!ARM_S) { console.error('usage: --arm <stamp>[:<setup>] --config <book>'); process.exit(2); }
const armBook = book(arg('--config', 'config/mod_config.json'), arg('--slid', '') ? arg('--slid').split(',') : null);
const arm = harvest(ARM_S.split(','), ARM_SET, armBook.rung);
if (!arm.length) { console.error('no usable runs in the arm at ' + YEAR); process.exit(2); }

console.log(`SLID vs UNSLID at ${YEAR} — ${ARM_S}${ARM_SET ? ':' + ARM_SET : ''} · ${arm.length} run(s)`);
console.log(`slid (ladder anchored on e1): ${[...armBook.slid].sort().join(', ') || '(none)'}`);
console.log('margin = profit ÷ (va_out − profit), F92’s identity — the game’s own profitability, no wage model\n');

// ---- 1. MARGIN BY ERA, SLID vs UNSLID
console.log('=== 1. REALISED MARGIN BY ERA — level-weighted, median over runs ===');
console.log('                 ——— WORLD ———                    ——— shortlist pool ———');
console.log('era        slid      unslid     gap        slid      unslid     gap');
for (const era of [0, 1, 2, 3]) {
  const cell = (isSlid, pool) => {
    const vals = arm.map(({ acc }) => {
      let prof = 0, vo = 0;
      for (const [key, a] of Object.entries(acc)) {
        const g = armBook.rung[key];
        if (!g || g.era !== era || g.slid !== isSlid) continue;
        prof += pool ? a.pprof : a.prof; vo += pool ? a.pvo : a.vo;
      }
      return (vo - prof) > 0 ? prof / (vo - prof) : null;
    });
    return median(vals);
  };
  const ws = cell(true, false), wu = cell(false, false), ps = cell(true, true), pu = cell(false, true);
  const f = x => x == null ? '   —  ' : (100 * x).toFixed(0) + '%';
  const g = (a, b) => (a == null || b == null) ? '  —' : ((100 * (a - b)).toFixed(0) + 'pp');
  console.log(`e${era}    ${f(ws).padStart(8)} ${f(wu).padStart(11)} ${g(ws, wu).padStart(7)}    ${f(ps).padStart(8)} ${f(pu).padStart(11)} ${g(ps, pu).padStart(7)}`);
}

// ---- 2. CAPITAL
console.log('\n=== 2. CAPITAL — building_cost against the rung’s OWN realised value added per level (world, median run) ===');
console.log('group / era     building_cost   realised VA per level   points per £ of VA   levels');
for (const isSlid of [true, false]) {
  for (const era of [0, 1, 2, 3]) {
    const costs = [], vas = [], lvs = [];
    for (const { acc } of arm) {
      let cost = null, va = 0, lv = 0;
      for (const [key, a] of Object.entries(acc)) {
        const gg = armBook.rung[key];
        if (!gg || gg.era !== era || gg.slid !== isSlid) continue;
        cost = cost == null ? gg.cost : cost;   // same by construction within an era + anchor class
        va += (a.vo - a.vi); lv += a.lv;
      }
      if (lv > 0) { costs.push(cost); vas.push(va / lv); lvs.push(lv); }
    }
    if (!costs.length) continue;
    const c = median(costs), v = median(vas);
    console.log(`${(isSlid ? 'slid' : 'unslid').padEnd(8)} e${era}  ${String(Math.round(c)).padStart(12)}   ${(v || 0).toFixed(1).padStart(21)}   ${(v > 0 ? (c / v).toFixed(1) : '—').padStart(18)}   ${String(Math.round(median(lvs))).padStart(6)}`);
  }
}

// ---- 3. SHARE, against a reference
const REF = arg('--ref', '');
console.log('\n=== 3. THE SLID GROUP’S SHARE OF THE TIERED SECTOR ===');
function shares(runs, bk) {
  const f = sel => median(runs.map(({ acc }) => {
    let s = 0, t = 0;
    for (const [key, a] of Object.entries(acc)) {
      const g = bk.rung[key]; if (!g) continue;
      const v = sel(a, g); t += v; if (g.slid) s += v;
    }
    return t > 0 ? s / t : null;
  }));
  return { lv: f(a => a.lv), wk: f((a, g) => a.st * g.emp), va: f(a => a.vo - a.vi) };
}
const armSh = shares(arm, armBook);
const pct = x => x == null ? '—' : (100 * x).toFixed(1) + '%';
console.log('                       levels     workers   value added');
console.log('arm                  ' + pct(armSh.lv).padStart(8) + pct(armSh.wk).padStart(12) + pct(armSh.va).padStart(14));
if (REF) {
  const [RS, RSET] = REF.split(':');
  const refBook = book(arg('--ref-config', 'config/mod_config.json'), [...armBook.slid]);   // the SAME industry set, so the share is comparable
  const ref = harvest(RS.split(','), RSET, refBook.rung);
  if (ref.length) {
    const rSh = shares(ref, refBook);
    console.log('reference            ' + pct(rSh.lv).padStart(8) + pct(rSh.wk).padStart(12) + pct(rSh.va).padStart(14) + `   (${ref.length} run(s), ${RS})`);
    const d = (a, b) => (a == null || b == null) ? '—' : ((100 * (a - b)).toFixed(1) + 'pp');
    console.log('arm − reference      ' + d(armSh.lv, rSh.lv).padStart(8) + d(armSh.wk, rSh.wk).padStart(12) + d(armSh.va, rSh.va).padStart(14));
  } else console.log('reference            (no usable run at ' + YEAR + ')');
}

// ---- 4. PER-INDUSTRY DETAIL — the group margins broken out, with outliers named (user-asked 2026-09-20)
if (process.argv.includes('--detail')) {
  console.log('\n=== 4. REALISED MARGIN PER INDUSTRY, WITHIN GROUP — world, level-weighted, median over runs ===');
  console.log('An OUTLIER is beyond 1.5 × IQR of its own group+era, marked ‼; a rung with under 5 levels is marked (thin) and excluded from the group stats.');
  for (const era of [0, 1, 2, 3]) {
    for (const isSlid of [true, false]) {
      const inds = [...new Set(Object.values(armBook.rung).filter(g => g.era === era && g.slid === isSlid).map(g => g.ind))].sort();
      const cells = [];
      for (const ind of inds) {
        const m = median(arm.map(({ acc }) => {
          let prof = 0, vo = 0;
          for (const [key, a] of Object.entries(acc)) {
            const g = armBook.rung[key];
            if (!g || g.era !== era || g.ind !== ind) continue;
            prof += a.prof; vo += a.vo;
          }
          return (vo - prof) > 0 ? prof / (vo - prof) : null;
        }));
        const lv = median(arm.map(({ acc }) => {
          let lv = 0;
          for (const [key, a] of Object.entries(acc)) { const g = armBook.rung[key]; if (g && g.era === era && g.ind === ind) lv += a.lv; }
          return lv;
        }));
        if (m != null) cells.push({ ind, m, lv: lv || 0 });
      }
      if (!cells.length) continue;
      const fat = cells.filter(c => c.lv >= 5).map(c => c.m).sort((a, b) => a - b);
      const q = p => fat.length ? fat[Math.min(fat.length - 1, Math.floor(p * (fat.length - 1)))] : null;
      const q1 = q(0.25), q3 = q(0.75), iqr = (q1 != null && q3 != null) ? q3 - q1 : null;
      const lo = iqr != null ? q1 - 1.5 * iqr : null, hi = iqr != null ? q3 + 1.5 * iqr : null;
      const med = median(fat);
      cells.sort((a, b) => b.m - a.m);
      console.log(`\n  e${era} · ${isSlid ? 'SLID (anchored e1)' : 'UNSLID (anchored e0)'} — group median ${med != null ? (100 * med).toFixed(0) + '%' : '—'} over ${fat.length} industries with ≥5 levels`);
      for (const c of cells) {
        const thin = c.lv < 5;
        const out = !thin && lo != null && (c.m < lo || c.m > hi);
        console.log('    ' + c.ind.padEnd(13) + ((100 * c.m).toFixed(0) + '%').padStart(6) + '   ' + String(Math.round(c.lv)).padStart(5) + ' lv' + (thin ? '   (thin)' : '') + (out ? '   ‼ outlier' : ''));
      }
    }
  }
}
