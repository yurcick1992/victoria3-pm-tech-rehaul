// techsT (technologies held, mean per country, by game era and tree) and jeT (journal-entry firings
// by stage|tree|era) — the two sections the report was leaving empty.
// ⚠ JE firings are counted as DISTINCT (stage, technology, country) triples, never raw log lines:
// landmine L23 measured raw lines overcounting 2.25x in burst ticks.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const DIR = process.argv[2];
const SES = 'tools/testbed/sessions';
const MOD = [1,2,3,4,5,6].map(i => `20260818_221216_canon-n7/run00${i}_canonfull`);
const VAN = ['run001_vanilla','run003_vanilla','run005_vanilla','run007_vanilla'].map(r => '20260813_083557_vanilla-vs-mod-n4/' + r);
const YEARS = [1840,1860,1880,1900,1920,1935];

// tech -> {era, tree} from the SHIPPING option of our own tree (vanilla technologies included there)
const opt = JSON.parse(readFileSync('config/tech_tree_options.canon_n7.json','utf8')).options.find(o => o.ships);
const TT = {}; const totals = {};
for (const t of opt.techs) {
  const tree = t.category || t.tree || 'production';
  const era = t.era ?? 1;
  TT[t.id] = { era, tree };
  if (era >= 1) totals[tree + '|' + era] = (totals[tree + '|' + era] || 0) + 1;
}
const med = a => { const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
function held(dirs) {
  const perYear = {};
  for (const r of dirs) {
    const dir = join(SES, r, 'save_summaries'); if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz')).sort()) {
      let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
      const y = +(j.provenance.date||'0').split('.')[0]; if (!YEARS.includes(y)) continue;
      const acc = {}; let n = 0;
      for (const c of Object.values(j.countries)) {
        if (!Array.isArray(c.technologies_held)) continue;
        n++;
        for (const id of c.technologies_held) { const t = TT[id]; if (!t || t.era < 1) continue; const k = t.tree + '|' + t.era; acc[k] = (acc[k]||0) + 1; }
      }
      if (!n) continue;
      const meanRow = {}; for (const [k, v] of Object.entries(acc)) meanRow[k] = v / n;
      (perYear[y] ||= []).push(meanRow);
    }
  }
  const out = {};
  for (const [y, rows] of Object.entries(perYear)) {
    const keys = new Set(); rows.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
    out[y] = {}; for (const k of keys) out[y][k] = +med(rows.map(r => r[k] || 0)).toFixed(1);
  }
  return out;
}
// ---- jeT: distinct (stage,tech,country) triples, medianed across runs, bucketed stage|tree|era ----
function je(dirs) {
  const per = [];
  for (const r of dirs) {
    const log = join(SES, r, 'logs_live', 'debug.log'); if (!existsSync(log)) continue;
    const seen = new Set(); const acc = {};
    for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('PMR_JE|'); if (i < 0) continue;
      const parts = line.slice(i + 7).trim().split('|'); if (parts.length < 3) continue;
      const [stage, tech, country] = parts;
      const key = stage + '|' + tech + '|' + country; if (seen.has(key)) continue; seen.add(key);
      const t = TT[tech]; if (!t) continue;
      const k = stage + '|' + t.tree + '|' + t.era; acc[k] = (acc[k]||0) + 1;
    }
    per.push(acc);
  }
  const keys = new Set(); per.forEach(a => Object.keys(a).forEach(k => keys.add(k)));
  const out = {}; for (const k of keys) out[k] = Math.round(med(per.map(a => a[k] || 0)));
  return out;
}
const techsT = { totals, flat: { world: held(MOD), tags: {} }, van: { world: held(VAN), tags: {} } };
const jeT = { world: je(MOD), tags: {} };
writeFileSync(join(DIR, 'research.json'), JSON.stringify({ techsT, jeT }));
console.log('totals per tree|era:', Object.keys(totals).length, 'entries');
for (const y of YEARS) if (techsT.flat.world[y]) {
  const sum = o => [1,2,3,4,5].map(e => ['production','military','society'].reduce((s,t)=>s+(o[t+'|'+e]||0),0).toFixed(1)).join(' / ');
  console.log(y, 'mod', sum(techsT.flat.world[y]), '  van', techsT.van.world[y] ? sum(techsT.van.world[y]) : '-');
}
console.log('JE (median run, distinct triples):', JSON.stringify(jeT.world).slice(0, 260));
