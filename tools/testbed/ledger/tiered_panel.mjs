// THE ADVANCED-MAJORS PANEL, RESTRICTED TO THE TIERED INDUSTRIES (user-ruled 2026-08-20).
//
// `advanced_panel.mjs` asks the two G5 questions over a pooled shortlist of advanced majors. This
// asks the same two INSIDE the 22 industries the mod actually reshapes, which is where a tier ladder
// can be expected to show up at all — the whole-economy figure includes farms, mines, barracks,
// manor houses and urban centres, none of which the ladder touches.
//
//   1. TIERED SHARE  = workers in tiered-industry buildings / total workforce
//   2. PRODUCTIVITY  = tiered value added / tiered worker
//
// Pooled over the same shortlist, and for the same reason: both are ratios internal to the group, so
// territory moving between members cancels.
//
// ⭐⭐ WORKERS ARE MODELLED, BECAUSE A SAVE SUMMARY HAS NO PER-BUILDING HEADCOUNT.
// The building record carries `staffing`, and that is a count of STAFFED LEVELS, not people
// (government administration: 234 levels, staffing 223.15). So
//
//     workers = per-level employment  ×  workforce_mult  ×  staffed levels
//
// and the per-level employment has to come from somewhere. It is NOT a fudge, and the reason is
// measured: **total employment per level is constant across the main PMs of an industry** — only the
// profession mix moves. Our config reads 5000 at every rung of textile/food/glass/tooling/steel/…,
// 1000 at every rung of power/port/railway, and VANILLA'S OWN main PMs read the same numbers, checked
// live against common/production_methods. Three industries are not flat (furniture 5000→5500,
// artillery 5000→5250, explosives 10000→4000) and vanilla moves at the same rungs by the same amounts.
//
//   * mod arms  -> our config's per-tier employment × workforce_mult (the graded ports' 0.1/0.2)
//   * vanilla   -> the employment of the LAST vanilla_pm in that industry's chain, i.e. the most
//                  advanced main PM, read live from the game files. These are advanced majors at
//                  1935; they run it.
//
// ⚠ SECONDARY PMs ARE NOT MODELLED. Automation removes ~1500 laborers a level and the save does not
// say which secondaries are active, so both sides are overstated by whatever automation is running.
// The bias is in the same direction on both arms, so the RATIO survives better than the level does.
// ⚠ art_academy employs 0 in its base PM on BOTH sides (its jobs live in the ownership PMG, which the
// summary does not break out), so it contributes no workers to either — consistently, not silently.
//
// ⚠⚠ VALUE ADDED IS MOD-ARMS-ONLY, AND CANNOT BE BACKFILLED.
// `va_out`/`va_in` ship in SAVE_SUMMARY_VERSION 6 (2026-08-18). The pinned vanilla baseline
// 20260813_083557 is **v4**, no vanilla arm anywhere in sessions/ is above v5, and the saves behind
// them are reaped. So metric 2 has NO vanilla denominator today and is reported mod-vs-mod. The
// vanilla runs scheduled for 2026-08-22/23 will be v6 and close it.
//
// USAGE
//   node tools/testbed/ledger/tiered_panel.mjs \
//     --arm 20260819_215528_aival-n4:aival --arm 20260818_221216_canon-n7:canonfull \
//     --van 20260813_083557_vanilla-vs-mod-n4:vanilla [--year 1935] [--group ...]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { usableRuns } from './lib_runs.mjs';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const allOf = n => ARGV.reduce((a, v, i) => (v === n && ARGV[i + 1] ? [...a, ARGV[i + 1]] : a), []);
const SES = 'tools/testbed/sessions';
const GAME = argOf('--game', process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const YEAR = +argOf('--year', '1935');
const GROUP = argOf('--group', 'GBR,USA,FRA,NET,BEL,PRU,GER').split(',').map(s => s.trim()).filter(Boolean);

const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
const fmt = n => Math.round(n).toLocaleString('en-GB');
const split = s => { const i = s.indexOf(':'); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]; };

// ---------------------------------------------------------------- vanilla PM employment ----
const VPM = {};
{
  const dir = join(GAME, 'common/production_methods');
  for (const f of readdirSync(dir).filter(x => /\.txt$/i.test(x))) {
    const txt = readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, '');
    const re = /^([a-z0-9_]+)\s*=\s*\{/gm; let m; const st = [];
    while ((m = re.exec(txt))) st.push([m[1], m.index]);
    for (let i = 0; i < st.length; i++) {
      const body = txt.slice(st[i][1], i + 1 < st.length ? st[i + 1][1] : txt.length);
      const ls = body.indexOf('level_scaled'); if (ls < 0) continue;
      let tot = 0;
      for (const mm of body.slice(ls).matchAll(/building_employment_(\w+)_add\s*=\s*(-?\d+)/g)) tot += +mm[2];
      if (tot) VPM[st[i][0]] = tot;
    }
  }
}

// ---------------------------------------------------------------- the two building maps ----
const cfg = JSON.parse(readFileSync(argOf('--config', 'config/mod_config.json'), 'utf8'));
const MODEMP = {};      // mod tier key   -> people per level (workforce_mult applied)
const VANEMP = {};      // vanilla base key -> people per level
const INDOF = {};       // any key -> industry id
for (const ind of cfg.industries || []) {
  const tiers = (ind.tiers || []).filter(t => t.key);
  if (!tiers.length) continue;
  for (const t of tiers) {
    const per = Object.values(t.employment || {}).reduce((a, b) => a + b, 0);
    MODEMP[t.key] = per * (+(t.workforce_mult ?? 1));
    INDOF[t.key] = ind.id;
  }
  // vanilla side: the base building is tier 0's key, and its per-level employment is that of the
  // MOST ADVANCED vanilla_pm in the chain (these are advanced majors at 1935; they run it).
  const base = tiers[0].key;
  let vanPer = null;
  for (const t of tiers) if (t.vanilla_pm && VPM[t.vanilla_pm] != null) vanPer = VPM[t.vanilla_pm];
  if (vanPer == null) vanPer = Object.values(tiers[tiers.length - 1].employment || {}).reduce((a, b) => a + b, 0);
  VANEMP[base] = vanPer;
  INDOF[base] = ind.id;
}

// ---------------------------------------------------------------- one run ----
function runRow(runDir, isVanilla) {
  const dir = join(SES, runDir, 'save_summaries');
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz')).sort()) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    if (+(j.provenance.date || '0').split('.')[0] !== YEAR) continue;
    const EMP = isVanilla ? VANEMP : MODEMP;
    let wfAll = 0, tierW = 0, tierVA = 0, allVA = 0, lv = 0, tierLv = 0, vaSeen = 0;
    const present = [], byInd = {};
    for (const tag of GROUP) {
      const c = j.countries[tag]; if (!c) continue;
      present.push(tag);
      wfAll += Object.values(c.workforce_by_profession || {}).reduce((a, b) => a + b, 0);
      for (const [k, b] of Object.entries(c.buildings || {})) {
        const st = b.staffing || 0;
        lv += b.levels || 0;
        if (b.va_out !== undefined) { allVA += (b.va_out || 0) - (b.va_in || 0); vaSeen++; }
        const per = EMP[k]; if (per == null) continue;
        const w = per * st;
        tierW += w; tierLv += b.levels || 0;
        const id = INDOF[k];
        const r = (byInd[id] ||= { w: 0, va: 0 });
        r.w += w;
        if (b.va_out !== undefined) { const v = (b.va_out || 0) - (b.va_in || 0); tierVA += v; r.va += v; }
      }
    }
    if (!present.length) return null;
    return {
      run: runDir.split('/')[1], present, wfAll, tierW, tierLv, lv,
      tierVA: 52 * tierVA, allVA: 52 * allVA, hasVA: vaSeen > 0, byInd,
      share: tierW / (wfAll || 1),
      perWorker: vaSeen ? (52 * tierVA) / (tierW || 1) : null,
      vaShare: vaSeen ? tierVA / (allVA || 1) : null,
      lvShare: tierLv / (lv || 1),
    };
  }
  return null;
}

function arm(spec, isVanilla) {
  const [session, setup] = split(spec);
  const { runs } = usableRuns(SES, session, setup);
  const rows = runs.map(r => runRow(r, isVanilla)).filter(Boolean);
  if (!rows.length) throw new Error(`no run of ${spec} has a ${YEAR} summary`);
  return { spec, rows, n: rows.length, isVanilla };
}

const armSpecs = allOf('--arm'), vanSpec = argOf('--van', '');
if (!armSpecs.length || !vanSpec) { console.error('need at least one --arm and a --van'); process.exit(1); }
const V = arm(vanSpec, true);
const arms = armSpecs.map(s => arm(s, false));
const M = (a, f) => med(a.rows.map(f));

console.log(`\n============ ADVANCED MAJORS, WITHIN THE TIERED INDUSTRIES, ${YEAR} ============`);
console.log(`  group (pooled): ${GROUP.join(' ')}`);
console.log('  workers = per-level employment × workforce_mult × STAFFED LEVELS (a summary has no');
console.log('  per-building headcount). Per-level employment is constant across an industry\'s main PMs');
console.log('  on BOTH sides — measured, not assumed — so vanilla uses its own most advanced main PM.');
console.log('  ⚠ secondary PMs (automation) are not modelled: both sides overstated, ratio survives.');

console.log('\n--- per run ---');
console.log('  arm            run             tags                  workforce   tiered workers  share    £VA/worker');
for (const a of [V, ...arms]) for (const r of a.rows)
  console.log(`  ${a.spec.split('_').slice(1).join('_').slice(0, 12).padEnd(13)} ${r.run.padEnd(15)} ${r.present.join(',').padEnd(21)} ${(r.wfAll / 1e6).toFixed(1).padStart(6)}M   ${(r.tierW / 1e6).toFixed(2).padStart(8)}M   ${(100 * r.share).toFixed(2).padStart(5)}%   ${r.perWorker == null ? '   n/a (v<6)' : ('£' + r.perWorker.toFixed(1)).padStart(9)}`);

console.log('\n--- 1. TIERED SHARE OF THE WORKFORCE ---');
console.log('  arm                    median    range              sd       ÷ vanilla');
const vShare = M(V, r => r.share);
for (const a of [V, ...arms]) {
  const v = a.rows.map(r => 100 * r.share);
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} ${med(v).toFixed(2).padStart(6)}%   ${Math.min(...v).toFixed(2)}–${Math.max(...v).toFixed(2)}%     ${sd(v).toFixed(2).padStart(5)}pp    ${a === V ? '   —' : (M(a, r => r.share) / vShare).toFixed(3) + '×'}`);
}

console.log('\n--- 2. PRODUCTIVITY: TIERED VALUE ADDED PER TIERED WORKER (£/yr) ---');
if (!V.rows.some(r => r.hasVA)) {
  console.log('  ⚠⚠ NO VANILLA DENOMINATOR. va_out/va_in ship in save-summary v6 (2026-08-18); the pinned');
  console.log('     vanilla baseline is v4 and no vanilla arm in sessions/ exceeds v5. Those saves are');
  console.log('     REAPED, so this cannot be backfilled. Reported mod-vs-mod until the 2026-08-22/23');
  console.log('     vanilla runs, which will be v6.');
}
console.log('  arm                    median      range              sd        ÷ first mod arm');
const base = arms[0] ? M(arms[0], r => r.perWorker) : null;
for (const a of [V, ...arms]) {
  if (!a.rows.some(r => r.hasVA)) { console.log(`  ${a.spec.slice(0, 21).padEnd(23)} n/a — save summaries are v4/v5, no value added`); continue; }
  const v = a.rows.map(r => r.perWorker);
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} £${med(v).toFixed(1).padStart(7)}   £${Math.min(...v).toFixed(1)}–${Math.max(...v).toFixed(1)}   ${sd(v).toFixed(1).padStart(6)}     ${base && a !== arms[0] ? (M(a, r => r.perWorker) / base).toFixed(3) + '×' : '   —'}`);
}

console.log('\n--- 3. HOW MUCH OF THE ECONOMY THE TIERED SECTOR IS ---');
console.log('  ⚠ THE LEVELS COLUMN IS NOT ARM-COMPARABLE: the mod\'s ports are graded, so one vanilla');
console.log('    port is ten mod port levels. It inflates the mod\'s level share and nothing else here.');
console.log('    The worker column corrects for it (workforce_mult) and value added is money, so both');
console.log('    of those ARE comparable. Read the levels column within an arm, never across.');
console.log('  arm                    tiered share of LEVELS    tiered share of VALUE ADDED');
for (const a of [V, ...arms]) {
  const hv = a.rows.some(r => r.hasVA);
  console.log(`  ${a.spec.slice(0, 21).padEnd(23)} ${(100 * M(a, r => r.lvShare)).toFixed(2).padStart(6)}%                   ${hv ? (100 * M(a, r => r.vaShare)).toFixed(2).padStart(6) + '%' : '   n/a'}`);
}

if (arms.length) {
  console.log('\n--- per industry, mod arms: workers and value added per worker ---');
  const ids = [...new Set(arms.flatMap(a => a.rows.flatMap(r => Object.keys(r.byInd))))].sort();
  console.log('  industry         ' + arms.map(a => (a.spec.split('_').slice(2).join('_') || a.spec).slice(0, 10).padEnd(22)).join(''));
  console.log('                   ' + arms.map(() => 'workers    £VA/wkr    ').join(''));
  for (const id of ids) {
    const cells = arms.map(a => {
      const w = med(a.rows.map(r => (r.byInd[id]?.w) || 0));
      const va = med(a.rows.map(r => 52 * ((r.byInd[id]?.va) || 0)));
      return `${(w / 1e3).toFixed(0).padStart(6)}k   ${w ? ('£' + (va / w).toFixed(1)).padStart(8) : '       —'}   `;
    });
    console.log('  ' + id.padEnd(16) + ' ' + cells.join(''));
  }
}
console.log('');
