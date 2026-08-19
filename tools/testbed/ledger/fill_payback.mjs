// Frontier-rung payback and the leader-laggard stock-era gap, from THIS batch.
// Payback = build cost (points x GBP720, the iron-frame rate the cost book is stated in, F53)
//           / annual profit per level, at the scenario's own realised prices.
// A rung at a LOSS has no payback and is counted, never folded into a median as a big number.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const cfg = JSON.parse(readFileSync('config/mod_config.canon_n7.json', 'utf8'));
const tier = {};
for (const ind of cfg.industries || [])
  for (const t of ind.tiers || [])
    tier[t.key] = { era: t.era ?? 0, cost: (t.building_cost ?? ind.required_construction ?? 0), ind: ind.id };
const PPP = 720;
const SES = 'tools/testbed/sessions';
const RUNS = [1,2,3,4,5,6].map(i => `20260818_221216_canon-n7/run00${i}_canonfull`);
const YEARS = [1840,1860,1880,1900,1920,1935];
const med = a => { const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const out = {};
for (const y of YEARS) {
  const perRunFrontier = [], perRunStale = [], perRunGap = [], lossCount = [];
  for (const r of RUNS) {
    const dir = join(SES, r, 'save_summaries'); if (!existsSync(dir)) continue;
    const f = readdirSync(dir).filter(x => x.endsWith('.json.gz')).sort()
      .find(x => { try { return +(JSON.parse(gunzipSync(readFileSync(join(dir,x)))).provenance.date||'').split('.')[0] === y; } catch { return false; } });
    if (!f) continue;
    const j = JSON.parse(gunzipSync(readFileSync(join(dir, f))));
    const agg = {};                       // tier key -> {levels, profit}
    const eraByTag = {};
    for (const [tag, c] of Object.entries(j.countries)) {
      let lvW = 0, eraW = 0;
      for (const [k, b] of Object.entries(c.buildings || {})) {
        const t = tier[k]; if (!t) continue;
        (agg[k] ||= { lv: 0, profit: 0 });
        agg[k].lv += b.levels || 0; agg[k].profit += b.profit || 0;
        lvW += b.levels || 0; eraW += (b.levels || 0) * t.era;
      }
      if (lvW > 50) eraByTag[tag] = eraW / lvW;      // ignore microstates: an era is not a rounding
    }
    // frontier rung = the highest era with real presence this year; stale = era 0
    let topEra = 0; for (const [k, a] of Object.entries(agg)) if (a.lv >= 20 && tier[k].era > topEra) topEra = tier[k].era;
    const pay = era => {
      const rows = Object.entries(agg).filter(([k, a]) => tier[k].era === era && a.lv > 0);
      const lv = rows.reduce((s, [, a]) => s + a.lv, 0);
      const pr = rows.reduce((s, [, a]) => s + a.profit, 0);
      const cost = rows.reduce((s, [k, a]) => s + a.lv * tier[k].cost, 0) / (lv || 1) * PPP;
      const perLevelYear = (pr / (lv || 1)) * 52;
      return perLevelYear > 0 ? cost / perLevelYear : null;      // null = loss-making, no payback
    };
    const pf = pay(topEra), ps = pay(0);
    if (pf != null) perRunFrontier.push(pf); else lossCount.push(1);
    if (ps != null) perRunStale.push(ps);
    const eras = Object.values(eraByTag).sort((a,b)=>a-b);
    if (eras.length > 8) perRunGap.push(eras[eras.length-1] - eras[Math.floor(eras.length*0.25)]);
    out[y] ||= { topEra };
  }
  out[y] = { topEra: out[y]?.topEra ?? 0,
             frontier: perRunFrontier.length ? +med(perRunFrontier).toFixed(1) : null,
             frontierLoss: lossCount.length,
             stale: perRunStale.length ? +med(perRunStale).toFixed(1) : null,
             gap: perRunGap.length ? +med(perRunGap).toFixed(2) : null };
}
writeFileSync(join(process.argv[2], 'payback.json'), JSON.stringify(out, null, 1));
for (const y of YEARS) console.log(y, 'frontier e'+out[y].topEra, out[y].frontier ?? 'LOSS', 'y | stale e0', out[y].stale ?? 'LOSS', 'y | leader-p25 era gap', out[y].gap);
