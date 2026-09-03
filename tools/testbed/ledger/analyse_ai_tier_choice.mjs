// DOES THE AI BUILD THE BEST TIER IT CAN? — the three-condition pattern, measured.
//
// The claim under test, per (country, industry, year):
//   1. the tier-N technology is ALREADY HELD by that country;
//   2. tier N is materially better than N-1, and the market can absorb one more tier-N building
//      without the good's price falling more than 20 pp;
//   3. yet tier N is not built, and levels are added to N-1 or lower instead.
// Then: once the FIRST tier-N building finally appears, does building below N stop, or continue?
//
// CONDITION 2, MADE OPERATIONAL. V3 prices as
//     price = base x [1 + 0.75 x clamp((buy - sell)/min(buy,sell), +/-1)]
// so adding output dQ to a roughly balanced market of size Q moves price by about -75 x dQ/Q pp.
// A <=20 pp fall therefore needs dQ/Q <= 0.267. dQ is one tier-N building's own output_qty; Q is the
// market's CURRENT supply of that good, summed over every country sharing the market id.
// ⚠ Deliberately CONSERVATIVE: where the market supplies none of the good the ratio is undefined and
// the case is DROPPED, not counted as unreasonable — a debut faces a ceiling price and is a different
// argument. Every number below is therefore a floor on the problem.
//
// "Materially better" is structural: the ladder gives each tier x1.5 the output of the one below
// (BALANCE_FRAMEWORK Section 8), so a higher tier always produces more per level. The check keeps
// only pairs where the config confirms it.
//
// ⚠ ANNEXATION. A country's levels also jump when it conquers someone. Country-years whose total
// building levels move more than +25% in one year are EXCLUDED, and the count of exclusions is
// reported — a transferred factory is not a construction decision.
//
// USAGE: node tools/testbed/ledger/analyse_ai_tier_choice.mjs [--runs <n>] [--json <out>]

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SES = 'tools/testbed/sessions';
// --session <stamp> points the whole analysis at another batch; --config <path> gives it that
// batch's own FROZEN ladder. Both default to canon-n7, so the published baseline still reproduces
// with no arguments. Run folders are DISCOVERED, never listed: a hardcoded list silently counts a
// run that L17 says did not finish, and silently omits one that did.
const SESSION = argOf('--session', '20260818_221216_canon-n7');
const CFGPATH = argOf('--config', SESSION === '20260818_221216_canon-n7'
  ? 'config/mod_config.canon_n7.json' : 'config/mod_config.json');
const SETUP = argOf('--setup', null);   // a multi-arm session must name its arm (lib_runs refuses to fold two arms into one n)
const { runs: USABLE, dropped: DROPPED } = usableRuns(SES, SESSION, SETUP);
const RUNS = USABLE.slice(0, +argOf('--runs', '99'));
if (!RUNS.length) { console.error(`no usable runs under ${join(SES, SESSION)}`); process.exit(1); }
const ABSORB = 0.267;          // dQ/Q that costs 20 pp of price
const ANNEX_JUMP = 1.25;       // level growth in one year that means conquest, not construction

// ---------------------------------------------------------------- the ladder ----
const cfg = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const IND = {};                // industry -> [{key, tier, era, tech, good, out}] ordered
for (const ind of cfg.industries || []) {
  // ⚠⚠ SKIP A DISABLED INDUSTRY. Its rung 0 KEY IS THE VANILLA BUILDING KEY, so leaving it in the map
  //   makes every VANILLA building of that type count as one of our tiers — with the canonical book's
  //   `workforce_mult` (0.1 for graded ports) attached. On the four-rung arm, which hands ports,
  //   shipyards, railway and power back to vanilla, that silently pulled 3,443 vanilla port levels into
  //   the below-best denominator and weighted them at a tenth, so "raw", "unit-weighted" and
  //   "excluding ports" all disagreed on a book that has no tiered ports at all (user-spotted
  //   2026-08-31). Nothing failed; the numbers were simply about a different economy.
  if (ind.disabled) continue;
  const tiers = (ind.tiers || []).map((t, i) => ({
    key: t.key, idx: i, era: t.era ?? 0, tech: t.tech,
    good: t.output_good || ind.output_good,
    out: +(t.output_qty || 0),
    wm: +(t.workforce_mult ?? 1),   // graded ports are 0.1/0.2 of a normal building unit
  })).filter(t => t.key && t.tech);
  if (tiers.length > 1) IND[ind.id] = tiers;
}
const KEY2 = {};               // building key -> {ind, idx}
for (const [id, ts] of Object.entries(IND)) ts.forEach(t => { KEY2[t.key] = { ind: id, idx: t.idx }; });

// ---------------------------------------------------------------- the sweep ----
const stat = {
  frontierLv: 0, laggardLv: 0, laggardByGap: {}, byDecade: {},
  cases: 0, annexSkipped: 0, absorbDropped: 0, absentIndustry: 0,
  frontierUnits: 0, laggardUnits: 0, frontierNoPort: 0, laggardNoPort: 0,
  lag: [],                      // years between holding the tech and the first level of that tier
  afterFirst: { before: 0, after: 0, beforeYears: 0, afterYears: 0, keptBuildingLower: 0, stopped: 0,
                beforeAll: 0, afterAll: 0 },
  worstIndustries: {},
  perRun: {},                   // run -> {front, lag} — the NOISE FLOOR for this metric
};
const bump = (o, k, v) => { o[k] = (o[k] || 0) + v; };

for (const run of RUNS) {
  const dir = join(SES, run, 'save_summaries');
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  let prev = null;
  const techSince = {};        // tag|ind|idx -> first year the tech was held
  const firstBuilt = {};       // tag|ind|idx -> first year a level existed
  for (const f of files) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const year = +(j.provenance.date || '0').split('.')[0];

    // market supply per (market id, good), from every member's own output
    const mkt = {};
    for (const c of Object.values(j.countries)) {
      const m = c.market; if (m == null) continue;
      const g = c.goods_out || {};
      for (const [good, q] of Object.entries(g)) bump(mkt[m] ||= {}, good, +q || 0);
    }

    const cur = {};
    for (const [tag, c] of Object.entries(j.countries)) {
      const lv = {}; let total = 0;
      for (const [k, b] of Object.entries(c.buildings || {})) { lv[k] = b.levels || 0; total += b.levels || 0; }
      cur[tag] = { lv, total, market: c.market, tech: new Set(c.technologies_held || []) };
    }

    if (prev) {
      for (const [tag, now] of Object.entries(cur)) {
        const was = prev[tag]; if (!was) continue;
        if (was.total > 0 && now.total / was.total > ANNEX_JUMP) { stat.annexSkipped++; continue; }
        for (const [id, tiers] of Object.entries(IND)) {
          // highest tier whose technology this country HOLDS
          let best = -1;
          for (const t of tiers) if (now.tech.has(t.tech)) best = Math.max(best, t.idx);
          if (best <= 0) continue;                       // nothing better than the bottom rung yet
          // Holding a technology for a chain you do not operate is an ABSENCE, not a refusal to
          // modernise. Only countries that already run the industry can be said to have chosen.
          if (!tiers.some(t => (now.lv[t.key] || 0) > 0)) { stat.absentIndustry++; continue; }
          const bestT = tiers[best];

          // condition 2: can the market absorb one more of it?
          const supply = (mkt[now.market] || {})[bestT.good] || 0;
          if (!(supply > 0) || !(bestT.out > 0)) { stat.absorbDropped++; continue; }
          if (bestT.out > ABSORB * supply) { stat.absorbDropped++; continue; }

          // first year the tech was held / first year a level existed, for the lag + cycle questions
          const tk = run + '|' + tag + '|' + id + '|' + best;
          if (techSince[tk] == null) techSince[tk] = year;
          if ((now.lv[bestT.key] || 0) > 0 && firstBuilt[tk] == null) firstBuilt[tk] = year;

          let front = 0, lag = 0, worstGap = 0;
          for (const t of tiers) {
            const add = (now.lv[t.key] || 0) - (was.lv[t.key] || 0);
            if (add <= 0) continue;
            if (t.idx >= best) { front += add; stat.frontierUnits += add * t.wm; if (id !== 'port') stat.frontierNoPort += add; }
            else { lag += add; stat.laggardUnits += add * t.wm; if (id !== 'port') stat.laggardNoPort += add;
                   worstGap = Math.max(worstGap, best - t.idx); bump(stat.laggardByGap, best - t.idx, add); }
          }
          if (front || lag) {
            stat.cases++;
            stat.frontierLv += front; stat.laggardLv += lag;
            const pr = (stat.perRun[run] ||= { front: 0, lag: 0 });
            pr.front += front; pr.lag += lag;
            const dec = Math.floor(year / 10) * 10;
            const d = (stat.byDecade[dec] ||= { front: 0, lag: 0 });
            d.front += front; d.lag += lag;
            if (lag) bump(stat.worstIndustries, id, lag);
          }
          // the cycle question: with a tier-N building already standing, is anything below it still built?
          if (firstBuilt[tk] != null && year > firstBuilt[tk]) {
            let lower = 0;
            for (const t of tiers) if (t.idx < best) lower += Math.max(0, (now.lv[t.key] || 0) - (was.lv[t.key] || 0));
            stat.afterFirst.after += lower; stat.afterFirst.afterYears++;
            stat.afterFirst.afterAll += lower + front;
            if (lower > 0) stat.afterFirst.keptBuildingLower++; else stat.afterFirst.stopped++;
          } else if (firstBuilt[tk] == null) {
            let lower = 0;
            for (const t of tiers) if (t.idx < best) lower += Math.max(0, (now.lv[t.key] || 0) - (was.lv[t.key] || 0));
            stat.afterFirst.before += lower; stat.afterFirst.beforeYears++;
            stat.afterFirst.beforeAll += lower + front;
          }
        }
      }
    }
    prev = cur;
  }
  // adoption lag: years from holding the technology to the first level of that tier
  for (const k of Object.keys(techSince)) {
    if (firstBuilt[k] != null) stat.lag.push(firstBuilt[k] - techSince[k]);
    else stat.lag.push(null);                            // never built it at all
  }
}

// ---------------------------------------------------------------- report ----
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const tot = stat.frontierLv + stat.laggardLv;
console.log('\n=== AI TIER CHOICE — all three conditions satisfied ===');
console.log(`session ${SESSION} · ladder ${CFGPATH}`);
reportDropped(DROPPED);
console.log(`runs ${RUNS.length} · qualifying country-industry-years ${stat.cases.toLocaleString()}`);
console.log(`levels built AT or above the best held tier : ${Math.round(stat.frontierLv).toLocaleString().padStart(9)}  ${pct(stat.frontierLv, tot)}`);
console.log(`levels built BELOW it (the fault)           : ${Math.round(stat.laggardLv).toLocaleString().padStart(9)}  ${pct(stat.laggardLv, tot)}`);
console.log(`  excluded: ${stat.annexSkipped.toLocaleString()} annexation-scale country-years · ${stat.absorbDropped.toLocaleString()} cases the market could not absorb (conservative)`);

console.log(`  excluded: ${stat.absentIndustry.toLocaleString()} country-years where the country does not operate that industry at all`);
const totU = stat.frontierUnits + stat.laggardUnits, totNP = stat.frontierNoPort + stat.laggardNoPort;
console.log('');
// ⭐ THE NOISE FLOOR. A change in the pooled share means nothing without the run-to-run spread of
// the same quantity on byte-identical runs, and nothing in this project had ever quoted it for THIS
// metric — only for GDP (71%) and levels (21%). Printed whenever there is more than one run.
const prKeys = Object.keys(stat.perRun);
if (prKeys.length > 1) {
  const shares = prKeys.map(k => { const r = stat.perRun[k]; return 100 * r.lag / ((r.front + r.lag) || 1); });
  const lo = Math.min(...shares), hi = Math.max(...shares);
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
  const sd = Math.sqrt(shares.reduce((a, b) => a + (b - mean) ** 2, 0) / shares.length);
  console.log('');
  console.log('--- PER-RUN SPREAD of the below-best share (the noise floor for this metric) ---');
  prKeys.forEach((k, n) => console.log('  ' + k.split('/')[1].padEnd(20) + shares[n].toFixed(2) + '%'));
  console.log('  range ' + lo.toFixed(2) + '-' + hi.toFixed(2) + '%  (' + (hi - lo).toFixed(2) + 'pp wide) · mean ' + mean.toFixed(2) + '% · sd ' + sd.toFixed(2) + 'pp');
}
console.log('--- the same totals, corrected for what a LEVEL means ---');
console.log(`  unit-weighted (a graded port level is 0.1 of a building): below ${pct(stat.laggardUnits, totU)}`);
console.log(`  excluding ports entirely                               : below ${pct(stat.laggardNoPort, totNP)}  (${Math.round(stat.laggardNoPort).toLocaleString()} of ${Math.round(totNP).toLocaleString()} levels)`);
console.log('\n--- how far behind, by level count ---');
for (const g of Object.keys(stat.laggardByGap).sort((a, b) => a - b))
  console.log(`  ${g} tier(s) behind : ${Math.round(stat.laggardByGap[g]).toLocaleString().padStart(8)}  ${pct(stat.laggardByGap[g], stat.laggardLv)} of the fault`);

console.log('\n--- by decade ---');
console.log('  decade   at/above     below    below %');
for (const d of Object.keys(stat.byDecade).sort()) {
  const r = stat.byDecade[d];
  console.log(`  ${d}   ${String(Math.round(r.front)).padStart(8)}  ${String(Math.round(r.lag)).padStart(8)}   ${pct(r.lag, r.front + r.lag)}`);
}

console.log('\n--- worst industries (levels built below the best held tier) ---');
for (const [id, v] of Object.entries(stat.worstIndustries).sort((a, b) => b[1] - a[1]).slice(0, 8))
  console.log(`  ${id.padEnd(16)} ${Math.round(v).toLocaleString()}`);

const built = stat.lag.filter(x => x != null);
const never = stat.lag.length - built.length;
built.sort((a, b) => a - b);
const q = p => built.length ? built[Math.floor(built.length * p)] : NaN;
console.log('\n--- adoption lag: years from holding the technology to the first level of that tier ---');
console.log(`  cases ${stat.lag.length.toLocaleString()} · NEVER built ${never.toLocaleString()} (${pct(never, stat.lag.length)})`);
console.log(`  of those that were built: median ${q(0.5)}y · p25 ${q(0.25)}y · p75 ${q(0.75)}y · max ${built[built.length - 1]}y`);

console.log('\n=== DOES THE FIRST TIER-N BUILDING BREAK THE CYCLE? ===');
const af = stat.afterFirst;
const rB = af.beforeYears ? af.before / af.beforeYears : 0, rA = af.afterYears ? af.after / af.afterYears : 0;
console.log(`  BEFORE the first tier-N building : ${Math.round(af.before).toLocaleString()} lower-tier levels over ${af.beforeYears.toLocaleString()} country-industry-years = ${rB.toFixed(3)}/yr`);
console.log(`  AFTER  it                        : ${Math.round(af.after).toLocaleString()} lower-tier levels over ${af.afterYears.toLocaleString()} country-industry-years = ${rA.toFixed(3)}/yr`);
console.log(`  => rate ratio ${(rA / (rB || 1)).toFixed(2)}x — but see the share, which controls for the fact that`);
console.log('     everyone builds more of everything later, and "after" is by construction later:');
const sB = af.beforeAll ? af.before / af.beforeAll : 0, sA = af.afterAll ? af.after / af.afterAll : 0;
console.log(`  SHARE of building that goes below the frontier: ${(100*sB).toFixed(1)}% before -> ${(100*sA).toFixed(1)}% after`);
console.log(`  => the first tier-N building ${sA >= sB*0.9 ? 'DOES NOT break the cycle' : 'reduces but does not end it'}`);
console.log(`  country-industry-years after the first tier-N building:`);
console.log(`     still adding lower tiers : ${af.keptBuildingLower.toLocaleString()}  ${pct(af.keptBuildingLower, af.keptBuildingLower + af.stopped)}`);
console.log(`     building nothing lower   : ${af.stopped.toLocaleString()}  ${pct(af.stopped, af.keptBuildingLower + af.stopped)}`);

const out = argOf('--json', null);
if (out) { writeFileSync(out, JSON.stringify(stat)); console.log('\nwrote ' + out); }
