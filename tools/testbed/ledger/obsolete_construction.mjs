// OBSOLETE CONSTRUCTION — of all new tiered capacity, how much goes to an obsolete building: one that, at the start of that year, the same
// country could have replaced, because it (1) holds the technology of a higher-tier BUILDING of the same industry, (2) already has one
// standing, and (3) that building's value added per worker exceeds the obsolete building's own average (domestic, else the world's that
// year). The user's question of 2026-11-01 (FINDINGS F262). Written in tools/ while the 2026-10-30 batch froze tools/testbed/**; moved
// here beside misplaced_capital.mjs on 2026-11-07 (BACKLOG G), only its imports, paths and usage lines changed.
//   Merged rungs are methods of their host, not buildings: building the host while holding its merged method is never obsolete.
//   Levels are NET yearly additions per (country, building type) between the yearly save summaries, so a level built and lost in one year
//   is missed; annexation-scale country-years (> +25% of all building levels) are skipped, as in analyse_ai_tier_choice.mjs.
//   Value added = goods_sales − goods_cost (market prices, save summary v9+); workers = staffing × the main method's employment per level
//   (automation secondaries ignored; a craft level is 500). The art academy staffs through its patronage group, the same on every rung,
//   so it is compared per staffed level. Construction points are the EMITTED required_construction of the mod folder given.
//   Variant (3'): the standing building earns more weekly profit per construction point than the obsolete one.
//   ⚠ Vanilla has no equivalent — one building per industry switches methods — so this reads a mod arm only.
// USAGE: node tools/testbed/ledger/obsolete_construction.mjs <group> [--setup <name>] [--config <book>] [--mod <mod folder>]
//        <group> = a session, a comma list of sessions or <session>/runNNN_<setup> folders (lib_runs.usableRunsPooled)
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usableRuns, reportDropped } from './lib_runs.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
if (!ARGV[0] || ARGV[0].startsWith('--')) { console.error('usage: node tools/testbed/ledger/obsolete_construction.mjs <group> [--setup <name>] [--config <book>] [--mod <dir>]'); process.exit(2); }
const SES = join(ROOT, 'tools/testbed/sessions');
const { runs: RUNS, dropped } = usableRuns(SES, ARGV[0], argOf('--setup', ''));
if (!RUNS.length) { console.error('no usable runs in ' + ARGV[0]); process.exit(1); }
const cfg = JSON.parse(readFileSync(resolve(ROOT, argOf('--config', 'config/mod_config.json')), 'utf8'));
const MOD = resolve(ROOT, argOf('--mod', 'mod'));

// emitted construction cost per building key
const COST = {};
for (const f of readdirSync(join(MOD, 'common/buildings'))) {
  let cur = null;
  for (const line of readFileSync(join(MOD, 'common/buildings', f), 'utf8').split(/\r?\n/)) {
    let m = /^(building_\w+)\s*=\s*\{/.exec(line); if (m) { cur = m[1]; continue; }
    m = /^\s*required_construction\s*=\s*([\d.]+)/.exec(line); if (m && cur) COST[cur] = +m[1];
  }
}
// buildings of each industry: own tier, tech, employment per level by main method
const B = {};            // key -> {ind, tier, tech, craft, empByPm, emp, cost}
const IND = {};          // ind -> [keys]
for (const ind of cfg.industries || []) {
  if (ind.disabled) continue;   // L27: a disabled industry's rung-0 key is the vanilla building
  const ts = (ind.tiers || []).filter(t => t.key);
  if (ts.length < 2) continue;
  for (const t of ts) {
    const emp = Object.values(t.employment || {}).reduce((a, b) => a + b, 0) * (+(t.workforce_mult ?? 1));
    const host = t.method_of || t.key;
    if (!t.method_of) {
      B[t.key] = { ind: ind.id, tier: t.era ?? 0, tech: t.tech, craft: !!t.craft, emp, empByPm: {}, cost: COST[t.key] ?? t.building_cost };
      (IND[ind.id] ||= []).push(t.key);
    }
    (B[host] ||= { empByPm: {} }).empByPm[t.pm_key] = emp;
  }
}
const missingCost = Object.keys(B).filter(k => COST[k] == null);
const empPerLevel = (key, rec) => {
  const b = B[key]; let n = 0, s = 0;
  for (const [pm, c] of Object.entries(rec.pms || {})) if (b.empByPm[pm] != null) { n += c; s += c * b.empByPm[pm]; }
  const e = n ? s / n : b.emp;
  return e > 0 ? e : 1;     // the art academy staffs through its patronage group, the same on every rung: compare per staffed level
};
const va = r => (r.goods_sales != null ? r.goods_sales - r.goods_cost : r.va_out - r.va_in);

const zero = () => ({ lv: 0, pts: 0, jobs: 0 });
const add = (o, lv, pts, jobs) => { o.lv += lv; o.pts += pts; o.jobs += jobs; };
const S = { all: zero(), c1: zero(), c12: zero(), c123: zero(), c12cap: zero(), byDec: {}, byInd: {}, byTier: {}, gap: {}, perRun: {},
  fallbackWorld: 0, noLcmp: 0, annex: 0, ratios: [], ch: { all: zero(), c123: zero(), byDec: {}, perRun: {}, byTier: {}, outside: 0 } };

for (const run of RUNS) {
  const dir = join(SES, run, 'save_summaries');
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  let prev = null;
  const pr = (S.perRun[run] = { all: zero(), c123: zero() });
  for (const f of files) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const year = +(j.provenance.date || '0').split('.')[0];
    const cur = {}, world = {};
    for (const [tag, c] of Object.entries(j.countries)) {
      const bl = c.buildings || {}; let total = 0;
      const t = { lv: {}, prod: {}, ppp: {}, tech: new Set(c.technologies_held || []) };
      for (const [k, r] of Object.entries(bl)) {
        total += r.levels || 0;
        if (!B[k]) continue;
        t.lv[k] = r.levels || 0;
        const w = (r.staffing || 0) * empPerLevel(k, r);
        if (w > 0) { t.prod[k] = va(r) / w; const W = (world[k] ||= { va: 0, w: 0 }); W.va += va(r); W.w += w; }
        if ((r.levels || 0) > 0) t.ppp[k] = (r.profit || 0) / r.levels / B[k].cost;     // weekly profit per construction point
      }
      t.total = total; cur[tag] = t;
    }
    if (prev) {
      for (const [tag, now] of Object.entries(cur)) {
        const was = prev.c[tag]; if (!was) continue;
        if (was.total > 0 && now.total / was.total > 1.25) { S.annex++; continue; }
        for (const [ind, keys] of Object.entries(IND)) {
        // a CHOICE existed (user, 2026-11-01: "remove from the denominator cases when there's no possible variety"): at the start of the
        // year some building L of the industry was buildable (its technology held) while a higher-tier one stood at home, its technology
        // held, making more per worker than L's average — so an obsolete build was possible at all
        const lAvgOf = L => was.prod[L] ?? (prev.world[L] && prev.world[L].w > 0 ? prev.world[L].va / prev.world[L].w : null);
        const choice = keys.some(L => was.tech.has(B[L].tech) && lAvgOf(L) != null && keys.some(H => B[H].tier > B[L].tier
          && was.tech.has(B[H].tech) && (was.lv[H] || 0) > 0 && was.prod[H] != null && was.prod[H] > lAvgOf(L)));
        for (const L of keys) {
          const n = (now.lv[L] || 0) - (was.lv[L] || 0); if (n <= 0) continue;
          const bl = B[L], pts = n * bl.cost, jobs = n * bl.emp, dec = Math.floor(year / 10) * 10;
          add(S.all, n, pts, jobs); add(pr.all, n, pts, jobs);
          const CH = choice ? { d: (S.ch.byDec[dec] ||= { all: zero(), c123: zero() }), r: (S.ch.perRun[run] ||= { all: zero(), c123: zero() }),
            t: (S.ch.byTier[bl.craft ? 'craft' : 't' + bl.tier] ||= { all: zero(), c123: zero() }) } : null;
          if (CH) { add(S.ch.all, n, pts, jobs); add(CH.d.all, n, pts, jobs); add(CH.r.all, n, pts, jobs); add(CH.t.all, n, pts, jobs); }
          const D = (S.byDec[dec] ||= { all: zero(), c123: zero() }); add(D.all, n, pts, jobs);
          const I = (S.byInd[ind] ||= { all: zero(), c1: zero(), c12: zero(), c123: zero() }); add(I.all, n, pts, jobs);
          const T = (S.byTier[bl.craft ? 'craft' : 't' + bl.tier] ||= { all: zero(), c123: zero() }); add(T.all, n, pts, jobs);
          const higher = keys.filter(H => B[H].tier > bl.tier && was.tech.has(B[H].tech));
          if (!higher.length) continue;
          add(S.c1, n, pts, jobs); add(I.c1, n, pts, jobs);
          const standing = higher.filter(H => (was.lv[H] || 0) > 0);
          if (!standing.length) continue;
          add(S.c12, n, pts, jobs); add(I.c12, n, pts, jobs);
          if (standing.some(H => was.ppp[H] != null && was.ppp[L] != null && was.ppp[H] > was.ppp[L])) add(S.c12cap, n, pts, jobs);
          let lAvg = was.prod[L];
          if (lAvg == null) { const W = prev.world[L]; lAvg = W && W.w > 0 ? W.va / W.w : null; if (lAvg != null) S.fallbackWorld += n; }
          if (lAvg == null) { S.noLcmp += n; continue; }
          const better = standing.filter(H => was.prod[H] != null && was.prod[H] > lAvg);
          if (!better.length) continue;
          add(S.c123, n, pts, jobs); add(pr.c123, n, pts, jobs); add(D.c123, n, pts, jobs); add(I.c123, n, pts, jobs); add(T.c123, n, pts, jobs);
          if (CH) { add(S.ch.c123, n, pts, jobs); add(CH.d.c123, n, pts, jobs); add(CH.r.c123, n, pts, jobs); add(CH.t.c123, n, pts, jobs); }
          else S.ch.outside += n;
          const top = better.reduce((a, H) => (B[H].tier > B[a].tier ? H : a));
          const g = B[top].tier - bl.tier; add((S.gap[g] ||= zero()), n, pts, jobs);
          if (lAvg > 0) S.ratios.push([was.prod[top] / lAvg, n]);
        }
        }
      }
    }
    prev = { c: cur, world };
  }
}

const pc = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '—');
const row = (lbl, o, base) => console.log(`  ${lbl.padEnd(46)} ${pc(o.pts, base.pts).padStart(7)} ${pc(o.lv, base.lv).padStart(7)} ${pc(o.jobs, base.jobs).padStart(7)}`);
console.log(`runs ${RUNS.length} (${ARGV[0]}${argOf('--setup', '') ? ':' + argOf('--setup', '') : ''}) · book ${argOf('--config', 'config/mod_config.json')} · costs from ${argOf('--mod', 'mod')}`); reportDropped(dropped);
if (missingCost.length) console.log('⚠ no emitted cost (the book\'s building_cost used) for: ' + missingCost.join(' '));
console.log(`tiered construction: ${Math.round(S.all.lv).toLocaleString()} levels · ${Math.round(S.all.pts / 1e3).toLocaleString()}k construction points · ${(S.all.jobs / 1e6).toFixed(1)}M job slots; ${S.annex} annexation-scale country-years skipped`);
console.log(`  share of all tiered construction, in:            points  levels    jobs`);
row('(1) a higher-tier building\'s technology is held', S.c1, S.all);
row('(1)+(2) and one already stands domestically', S.c12, S.all);
row('(1)+(2)+(3) and it makes more per worker', S.c123, S.all);
row('    variant (3\'): more profit per constr. point', S.c12cap, S.all);
console.log(`  (3) used the world average for ${S.fallbackWorld} levels (no staffed obsolete building at home); ${S.noLcmp} levels had no comparator at all`);
console.log('\n  by the obsolete building\'s tier (share of that tier\'s own construction meeting 1+2+3):');
for (const [k, v] of Object.entries(S.byTier).sort()) console.log(`    ${k.padEnd(6)} ${pc(v.c123.pts, v.all.pts).padStart(7)} of points · ${pc(v.c123.lv, v.all.lv).padStart(7)} of levels · ${pc(v.c123.jobs, v.all.jobs).padStart(7)} of jobs   (its levels ${Math.round(v.all.lv)}, its points ${Math.round(v.all.pts)})`);
console.log('\n  how far behind (tiers between the obsolete building and the best qualifying one), share of the 1+2+3 points:');
for (const [g, v] of Object.entries(S.gap).sort()) console.log(`    ${g}: ${pc(v.pts, S.c123.pts)}  (${Math.round(v.lv)} levels)`);
console.log('\n  by decade:                   points            levels');
for (const [d, v] of Object.entries(S.byDec).sort()) console.log(`    ${d}   ${pc(v.c123.pts, v.all.pts).padStart(7)} of ${String(Math.round(v.all.pts / 1e3)).padStart(6)}k   ${pc(v.c123.lv, v.all.lv).padStart(7)} of ${Math.round(v.all.lv)}`);
console.log('\n  by industry (share of the industry\'s own construction):');
for (const [k, v] of Object.entries(S.byInd).sort((a, b) => b[1].c123.pts - a[1].c123.pts)) console.log(`    ${k.padEnd(12)} ${pc(v.c123.pts, v.all.pts).padStart(7)} of points · ${pc(v.c123.lv, v.all.lv).padStart(7)} of levels   [levels: (1) ${pc(v.c1.lv, v.all.lv)} · (1)+(2) ${pc(v.c12.lv, v.all.lv)}]`);
const rs = S.ratios.sort((a, b) => a[0] - b[0]); const tw = rs.reduce((a, r) => a + r[1], 0);
const q = p => { let acc = 0; for (const r of rs) { acc += r[1]; if (acc >= p * tw) return r[0].toFixed(2); } };
console.log(`\n  value added per worker, best qualifying building ÷ the obsolete one's average (level-weighted): p25 ${q(.25)} · median ${q(.5)} · p75 ${q(.75)}`);
const sh = Object.entries(S.perRun).map(([k, v]) => 100 * v.c123.pts / v.all.pts);
console.log('  per run (points): ' + sh.map(v => v.toFixed(1)).join(' · '));

// the same share with the denominator cut to the industry's construction in country-years where an obsolete build was possible at all
console.log(`\n=== WHERE A CHOICE EXISTED (an obsolete building buildable beside a standing, more productive higher-tier one, at the start of the year) ===`);
console.log(`  such country-industry-years carry ${pc(S.ch.all.pts, S.all.pts)} of all tiered construction points, ${pc(S.ch.all.lv, S.all.lv)} of its levels, ${pc(S.ch.all.jobs, S.all.jobs)} of its job slots`);
console.log(`  obsolete construction as a share of THEIR construction:  points ${pc(S.ch.c123.pts, S.ch.all.pts)} · levels ${pc(S.ch.c123.lv, S.ch.all.lv)} · job slots ${pc(S.ch.c123.jobs, S.ch.all.jobs)}   (obsolete levels outside them: ${S.ch.outside})`);
console.log('  by the building\'s tier (its construction inside those years, and the obsolete share of it):');
for (const [k, v] of Object.entries(S.ch.byTier).sort()) console.log(`    ${k.padEnd(6)} ${pc(v.c123.pts, v.all.pts).padStart(7)} of points · ${pc(v.c123.lv, v.all.lv).padStart(7)} of levels   (its levels there ${Math.round(v.all.lv)})`);
console.log('  by decade:            obsolete share of points / levels      the choice years\' share of all points / levels');
for (const [d, v] of Object.entries(S.ch.byDec).sort()) { const A = S.byDec[d].all;
  console.log(`    ${d}   ${pc(v.c123.pts, v.all.pts).padStart(7)} / ${pc(v.c123.lv, v.all.lv).padStart(7)}                       ${pc(v.all.pts, A.pts).padStart(7)} / ${pc(v.all.lv, A.lv).padStart(7)}`); }
console.log('  per run (points): ' + Object.values(S.ch.perRun).map(v => (100 * v.c123.pts / v.all.pts).toFixed(1)).join(' · '));
