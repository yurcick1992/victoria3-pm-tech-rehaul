// Frontier-rung payback and the leader-laggard stock-era gap, from THIS batch.
// Payback = build cost (points x GBP720, the iron-frame rate the cost book is stated in, F53)
//           / annual profit per level, at the scenario's own realised prices.
// A rung at a LOSS has no payback and is counted, never folded into a median as a big number.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
// ⭐⭐ ERA-COUNT AGNOSTIC (2026-08-31). The ledger serves TWO semi-canonical books now — the six-rung
//   canonical one and the four-rung vanilla-ladder arm — so nothing here may assume six eras or a
//   particular config. The arm's OWN config comes in on `--config`; the era count is derived from it.
//   ⚠ Hardcoding `config/mod_config.canon_n7.json` and `[0,0,0,0,0,0]` produced a report claiming
//   `topEra: 5` for a book whose top rung is 3, with two empty era buckets and every tier4-only
//   building unresolved. A panel that is wrong is worse than one that is absent.
const CFGP = (() => { const i = process.argv.indexOf('--config'); return i > 0 && process.argv[i+1] ? process.argv[i+1] : 'config/mod_config.canon_n7.json'; })();
const cfg = JSON.parse(readFileSync(CFGP, 'utf8'));
// the era count IS the config's, never a literal
const NERA = Math.max(...cfg.industries.filter(i => !i.disabled).flatMap(i => (i.tiers||[]).map(t => t.era ?? 0))) + 1;
const ERAS = Array.from({length: NERA}, (_, i) => i);
const tier = {};
for (const ind of (cfg.industries || []).filter(i => !i.disabled))   // ⚠ a DISABLED industry keeps its
  //   canonical era (4, 5) in the config even though the arm never emits it; including it let a
  //   disabled port/railway rung set topEra above the book's own top rung.
  for (const t of ind.tiers || [])
    tier[t.key] = { era: t.era ?? 0, cost: (t.building_cost ?? ind.required_construction ?? 0), ind: ind.id };
const PPP = 720;
const SES = 'tools/testbed/sessions';
// ⚠⚠ THE RUN LIST WAS HARDCODED TO canon-n7 WHILE THE CONFIG CAME IN ON --config (fixed 2026-09-01).
//   The half-fix is the dangerous shape: the caller passes --mod, the tool ignores it, and the output
//   looks like this batch because the CONFIG is this batch’s. It reported "frontier e4" for a book
//   whose top rung is e3. Same class as fill_consts’ hardcode (2026-08-31) — when a tool is
//   parameterised, sweep it for EVERY hardcoded session, not just the one that prompted the change.
const RUNS = (() => {
  const i = process.argv.indexOf('--mod');
  if (i > 0 && process.argv[i+1]) return process.argv[i+1].split(',').map(s => s.trim()).filter(Boolean);
  throw new Error('fill_payback: --mod <sess/run[,...]> is REQUIRED. It used to default to canon-n7 '
    + 'while taking the arm’s config on --config, so a four-rung book was scored against six-rung '
    + 'SUMMARIES and the report named a frontier rung (e4) the book does not contain.');
})();
const YEARS = [1840,1860,1880,1900,1920,1935];
const med = a => { const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const out = {};
for (const y of YEARS) {
  const perRunFrontier = [], perRunStale = [], perRunGap = [], lossCount = [];
  for (const r of RUNS) {
    const dir = join(SES, r, 'save_summaries'); if (!existsSync(dir)) continue;
    const f = readdirSync(dir).filter(x => x.endsWith('.json.gz') && !x.includes('.partial.')).sort()
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
