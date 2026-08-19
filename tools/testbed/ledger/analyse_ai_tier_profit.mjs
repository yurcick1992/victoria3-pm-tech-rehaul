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
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const SES = 'tools/testbed/sessions';
const RUNS = [1, 2, 3, 4, 5, 6].map(i => `20260818_221216_canon-n7/run00${i}_canonfull`).slice(0, +argOf('--runs', '6'));
const MINLV = +argOf('--minlv', '3');
const ANNEX_JUMP = 1.25;

const cfg = JSON.parse(readFileSync('config/mod_config.canon_n7.json', 'utf8'));
const IND = {};
for (const ind of cfg.industries || []) {
  const tiers = (ind.tiers || []).map((t, i) => ({ key: t.key, idx: i, tech: t.tech, wm: +(t.workforce_mult ?? 1) }))
    .filter(t => t.key && t.tech);
  if (tiers.length > 1) IND[ind.id] = tiers;
}

const per = {};          // industry -> {front, lag, lossBuilt, lossLevels, frontProfitable}
const ev = { checked: 0, hits: 0, levels: 0, byIndustry: {}, byDecade: {}, examples: [] };
const bump = (o, k, v) => { o[k] = (o[k] || 0) + v; };

for (const run of RUNS) {
  const dir = join(SES, run, 'save_summaries'); if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
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
          for (const t of tiers) {
            const add = (now.b[t.key]?.lv || 0) - (was.b[t.key]?.lv || 0);
            if (add > 0) { if (t.idx >= best) P.front += add; else P.lag += add; }
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
