// THE MEASURED INPUTS OF THE GRANULAR PRICE SYSTEM (BALANCE_FRAMEWORK §10.65.5, user-ordered
// 2026-08-24: per-good ladders — anchors + slopes — with an enforced death condition).
// Emits config/measured_price_paths.json:
//   anchors_vanilla: good -> % of base, the VANILLA n=18 realized price in the British market,
//                    median over the 1840.1.1 + 1850.1.1 dumps of all 18 runs — the early plateau
//                    the mod's e1 rungs actually live in (1836.2.1 alone is day-40 noise, F14-adjacent)
//   raw_paths:       good -> [e0..e5] % of base, the SOLVER2C-MEASURED realized path in the British
//                    market, era-mapped e0=e1=med(1840,1850) · e2=1870 · e3=1900 · e4=med(1920,1930)
//                    · e5=1935. First-iteration ground truth for raw-input deflation (F84); re-measure
//                    after any arm that changes the price environment.
// Emits EVERY good with data; the solver picks what it needs (raw paths for non-industrial inputs,
// anchors for industrial outputs). British market: the largest, and the one F84 read.
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = {};
for (const l of readFileSync('tools/goods_prices.tsv', 'utf8').split(/\r?\n/)) {
  const m = l.split('\t'); if (m.length >= 2 && +m[1] > 0) BASE[m[0].trim()] = +m[1];
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

function collect(file, dates) {
  const out = {};                     // good -> date -> [prices]
  for (const r of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const c = r.split('\t'); if (c.length < 10) continue;
    const [, , date, market, , good, , , price] = c;
    if (market !== 'British Market' || !dates.includes(date) || !BASE[good]) continue;
    (((out[good] ||= {})[date]) ||= []).push(+price);
  }
  return out;
}
const pct = (o, g, dates) => {
  const v = dates.flatMap(d => (o[g] && o[g][d]) || []);
  return v.length ? Math.round(100 * med(v) / BASE[g]) : null;
};

const VAN = ['tools/testbed/sessions/20260821_131149_vanilla-baseline-n16/markets_all.tsv',
             'tools/testbed/sessions/20260823_113218_vanilla-baseline-extra-n2/markets_all.tsv'];
const vanRows = {};
for (const f of VAN) {
  const o = collect(f, ['1840.1.1', '1850.1.1']);
  for (const g in o) for (const d in o[g]) (((vanRows[g] ||= {})[d]) ||= []).push(...o[g][d]);
}
const anchors = {};
for (const g of Object.keys(vanRows).sort()) {
  const p = pct(vanRows, g, ['1840.1.1', '1850.1.1']);
  if (p != null) anchors[g] = p;
}

const modRows = collect('tools/testbed/sessions/20260824_174224_solver2c-n1/markets_all.tsv',
  ['1840.1.1', '1850.1.1', '1870.1.1', '1900.1.1', '1920.1.1', '1930.1.1', '1935.1.1']);
const raw_paths = {};
for (const g of Object.keys(modRows).sort()) {
  const e1 = pct(modRows, g, ['1840.1.1', '1850.1.1']);
  const e2 = pct(modRows, g, ['1870.1.1']);
  const e3 = pct(modRows, g, ['1900.1.1']);
  const e4 = pct(modRows, g, ['1920.1.1', '1930.1.1']);
  const e5 = pct(modRows, g, ['1935.1.1']);
  if ([e1, e2, e3, e4, e5].some(x => x == null)) continue;   // a partial path misleads more than none
  raw_paths[g] = [e1, e1, e2, e3, e4, e5];
}

const out = {
  _provenance: {
    anchors: 'vanilla n=18 (20260821_131149 + 20260823_113218), British market, median over the 1840+1850 dumps',
    raw_paths: 'solver2c-n1 (20260824_174224), British market, era-mapped e1=med(1840,1850) e2=1870 e3=1900 e4=med(1920,1930) e5=1935; e0 held at e1',
    date: '2026-08-24', note: 'first iteration (F84); re-measure after any arm that changes the price environment',
  },
  anchors_vanilla: anchors, raw_paths,
};
writeFileSync('config/measured_price_paths.json', JSON.stringify(out, null, 1));
console.log(`anchors: ${Object.keys(anchors).length} goods · raw paths: ${Object.keys(raw_paths).length} goods`);
console.log('sample anchors:', ['clothes', 'furniture', 'groceries', 'paper', 'tools', 'steel', 'engines', 'fabric', 'grain'].map(g => g + ' ' + anchors[g]).join(' · '));
console.log('fabric path:', JSON.stringify(raw_paths.fabric), 'wood:', JSON.stringify(raw_paths.wood), 'grain:', JSON.stringify(raw_paths.grain));
