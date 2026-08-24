// PART 2 of the tier-choice question:
//   (a) WHICH INDUSTRIES are hit hardest, normalised — a raw level count just ranks the big chains.
//   (b) THE INDEFENSIBLE CASE: the frontier tier is PROFITABLE, a lower tier is running at a LOSS,
//       and the AI adds levels to the loss-maker anyway.
//
// (b) is stronger evidence than anything in part 1, because it needs no assumption about prices or
// absorption: the game itself has already priced both rungs, in the same market, in the same year,
// and reports each one's realised profit. There is no reading on which building the loser is correct.
//
// UNITS: levels, never employment — a construction decision is a level decision.
// Profit is the summary's own realised weekly profit per building type; per-level profit is
// profit/levels, so a tier is "paying" if that is > 0.
// ⚠ Loss-making tiers below a MINIMUM SIZE are ignored (default 3 levels): one level at -£5/wk is
// noise, and a rounding artefact should not be dressed up as a decision.
// ⚠ Annexation-scale country-years are excluded, as in part 1.
//
// USAGE: node tools/testbed/ledger/analyse_ai_tier_profit.mjs [--runs 6] [--minlv 3]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { usableRuns, reportDropped } from './lib_runs.mjs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SES = 'tools/testbed/sessions';
// See analyse_ai_tier_choice.mjs for why the run list is DISCOVERED rather than written down.
const SESSION = argOf('--session', '20260818_221216_canon-n7');
const CFGPATH = argOf('--config', SESSION === '20260818_221216_canon-n7'
  ? 'config/mod_config.canon_n7.json' : 'config/mod_config.json');
const { runs: USABLE, dropped: DROPPED } = usableRuns(SES, SESSION);
const RUNS = USABLE.slice(0, +argOf('--runs', '99'));
if (!RUNS.length) { console.error(`no usable runs under ${join(SES, SESSION)}`); process.exit(1); }
const MINLV = +argOf('--minlv', '3');
const ANNEX_JUMP = 1.25;

const cfg = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const IND = {};
for (const ind of cfg.industries || []) {
  const tiers = (ind.tiers || []).map((t, i) => ({ key: t.key, idx: i, tech: t.tech, wm: +(t.workforce_mult ?? 1) }))
    .filter(t => t.key && t.tech);
  if (tiers.length > 1) IND[ind.id] = tiers;
}

const per = {};          // industry -> {front, lag, lossBuilt, lossLevels, frontProfitable}
const ev = { checked: 0, hits: 0, levels: 0, byIndustry: {}, byDecade: {}, examples: [] };
const eff = { cmp: 0, less: 0, noCmp: 0, byDecade: {} };   // (c): below-best adds vs the frontier's per-level profit
const bump = (o, k, v) => { o[k] = (o[k] || 0) + v; };

for (const run of RUNS) {
  const dir = join(SES, run, 'save_summaries'); if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort();
  let prev = null;
  for (const f of files) {
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    const year = +(j.provenance.date || '0').split('.')[0];
    const cur = {};
    for (const [tag, c] of Object.entries(j.countries)) {
      const b = {}; let total = 0;
      for (const [k, v] of Object.entries(c.buildings || {})) { b[k] = { lv: v.levels || 0, pr: v.profit || 0 }; total += v.levels || 0; }
      cur[tag] = { b, total, tech: new Set(c.technologies_held || []) };
    }
    if (prev) {
      for (const [tag, now] of Object.entries(cur)) {
        const was = prev[tag]; if (!was) continue;
        if (was.total > 0 && now.total / was.total > ANNEX_JUMP) continue;
        for (const [id, tiers] of Object.entries(IND)) {
          let best = -1;
          for (const t of tiers) if (now.tech.has(t.tech)) best = Math.max(best, t.idx);
          if (best <= 0) continue;
          if (!tiers.some(t => (now.b[t.key]?.lv || 0) > 0)) continue;

          // (a) per-industry split of where the levels went
          const P = (per[id] ||= { front: 0, lag: 0, lossBuilt: 0, lossLevels: 0, cases: 0 });
          // (c) of the below-best adds, how many went to a rung earning LESS per level than the
          //     frontier was earning at that same moment (user-requested 2026-08-24: "share of
          //     built that's not the top level and less efficient than the top level"). Needs the
          //     frontier to STAND (lv>0) so both per-level profits are the game's own numbers;
          //     below-best adds with no standing frontier are counted separately as no-comparator.
          const frC = now.b[tiers[best].key];
          const frPerLv = frC && frC.lv > 0 ? frC.pr / frC.lv : null;
          for (const t of tiers) {
            const add = (now.b[t.key]?.lv || 0) - (was.b[t.key]?.lv || 0);
            if (add > 0) {
              if (t.idx >= best) P.front += add;
              else {
                P.lag += add;
                if (frPerLv == null) { eff.noCmp += add; }
                else {
                  eff.cmp += add;
                  const lowLv = now.b[t.key].lv;
                  if (lowLv > 0 && now.b[t.key].pr / lowLv < frPerLv) {
                    eff.less += add;
                    bump(eff.byDecade, Math.floor(year / 10) * 10, add);
                  }
                }
              }
            }
          }

          // (b) frontier pays, a lower rung loses, and the loser is STILL being built
          const fr = now.b[tiers[best].key];
          if (!fr || fr.lv <= 0 || fr.pr <= 0) continue;      // frontier must exist AND be paying
          ev.checked++;
          for (const t of tiers) {
            if (t.idx >= best) continue;
            const low = now.b[t.key]; if (!low || low.lv < MINLV) continue;
            if (low.pr >= 0) continue;                        // must actually be losing money
            const add = (low.lv) - (was.b[t.key]?.lv || 0);
            if (add <= 0) continue;                           // and STILL be getting new levels
            ev.hits++; ev.levels += add;
            bump(ev.byIndustry, id, add);
            bump(ev.byDecade, Math.floor(year / 10) * 10, add);
            P.lossBuilt++; P.lossLevels += add;
            if (ev.examples.length < 12)
              ev.examples.push({ year, tag, id, lowIdx: t.idx, bestIdx: best, add,
                lowPerLv: low.pr / low.lv, frontPerLv: fr.pr / fr.lv, lowLv: low.lv, frontLv: fr.lv });
          }
        }
      }
    }
    prev = cur;
  }
}

const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
console.log('\n=== (a) WHICH INDUSTRIES BUILD BELOW THE BEST TIER THEY HOLD ===');
console.log(`session ${SESSION} · ladder ${CFGPATH} · runs ${RUNS.length}`);
reportDropped(DROPPED);
console.log('   (share of that industry\'s own building, so size does not decide the ranking)');
console.log('  industry          below%      below lv     at/above lv');
const rows = Object.entries(per).map(([id, p]) => ({ id, ...p, tot: p.front + p.lag }))
  .filter(r => r.tot >= 200).sort((a, b) => (b.lag / b.tot) - (a.lag / a.tot));
for (const r of rows)
  console.log(`  ${r.id.padEnd(16)} ${pct(r.lag, r.tot).padStart(7)}  ${String(Math.round(r.lag)).padStart(11)}  ${String(Math.round(r.front)).padStart(12)}`);

console.log('\n=== (b) THE FRONTIER PAYS, A LOWER RUNG LOSES, AND THE LOSER IS STILL BUILT ===');
console.log(`  country-industry-years where the frontier tier existed and was profitable: ${ev.checked.toLocaleString()}`);
console.log(`  of those, a LOSS-MAKING lower rung (>=${MINLV} levels) got NEW levels anyway: ${ev.hits.toLocaleString()}  ${pct(ev.hits, ev.checked)}`);
console.log(`  levels added to knowingly loss-making rungs: ${Math.round(ev.levels).toLocaleString()}`);
console.log('\n  by industry:');
for (const [k, v] of Object.entries(ev.byIndustry).sort((a, b) => b[1] - a[1]).slice(0, 10))
  console.log(`    ${k.padEnd(16)} ${Math.round(v).toLocaleString()}`);
console.log('\n  by decade:');
for (const k of Object.keys(ev.byDecade).sort())
  console.log(`    ${k}  ${Math.round(ev.byDecade[k]).toLocaleString()}`);
console.log('\n  examples (per-level weekly profit, same country, same year, same market):');
for (const e of ev.examples)
  console.log(`    ${e.year} ${e.tag.padEnd(4)} ${e.id.padEnd(14)} built +${e.add} of t${e.lowIdx} at £${e.lowPerLv.toFixed(0)}/lv/wk (${e.lowLv} lv)  while t${e.bestIdx} paid £${e.frontPerLv.toFixed(0)}/lv/wk (${e.frontLv} lv)`);

console.log('\n=== (c) BELOW-BEST *AND* LESS EFFICIENT THAN THE FRONTIER (per-level profit) ===');
const totAdds = Object.values(per).reduce((a, p) => a + p.front + p.lag, 0);
const totLag = Object.values(per).reduce((a, p) => a + p.lag, 0);
console.log(`  below-best adds with a STANDING frontier to compare against: ${Math.round(eff.cmp).toLocaleString()} of ${Math.round(totLag).toLocaleString()} (${pct(eff.cmp, totLag)}; ${Math.round(eff.noCmp).toLocaleString()} had no standing frontier)`);
console.log(`  of those, added to a rung earning LESS per level than the frontier: ${Math.round(eff.less).toLocaleString()}  ${pct(eff.less, eff.cmp)}`);
console.log(`  => share of ALL building that is below-best AND less efficient: ${pct(eff.less, totAdds)}  (below-best alone: ${pct(totLag, totAdds)})`);
console.log('  by decade (less-efficient below-best levels):');
for (const k of Object.keys(eff.byDecade).sort())
  console.log(`    ${k}  ${Math.round(eff.byDecade[k]).toLocaleString()}`);
