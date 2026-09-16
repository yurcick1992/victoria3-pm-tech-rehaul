// recipe_side_by_side.mjs — one industry's rungs, every book side by side, plus vanilla's own method at each rung.
//
//   node tools/recipe_side_by_side.mjs --industry steel
//   node tools/recipe_side_by_side.mjs --industry automotive --books canon=config/mod_config.json,flat=config/mod_config.canon-flat-in12.json
//
// Per rung: output, every input, values at base prices (tools/goods_prices.tsv), O:I, goods margin, VA per level and per worker,
// employment, building cost, capital productivity (VA per 1,000 construction points), ai_value, target_be, the AI cost divisor's
// penalty. Written 2026-09-13 for the user's "print the whole recipes, all tiers side by side, for canon and canon-flat-in12, so
// that I'd eyeball" — and for the era pass, where every late industry's rungs need the same look. Default books: the canon,
// canon-je24-a22, canon-flat-in12. The vanilla column reads ui/vanilla.js (a build artifact; rebuild if it is stale) and takes the
// rung's own vanilla_pm, so a minted top rung (no vanilla_pm) shows an em-dash there. Reads only; writes nothing.
import { readFileSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] != null ? process.argv[i + 1] : d; };
const IND = arg('--industry', 'steel');
const BOOKS = arg('--books', 'canon=config/mod_config.json,a22=config/mod_config.canon-je24-a22.json,flat-in12=config/mod_config.canon-flat-in12.json')
  .split(',').map(s => { const [lab, f] = s.split('='); return { lab, f }; });
const P = Object.fromEntries(readFileSync('tools/goods_prices.tsv', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => { const [g, p] = l.split('\t'); return [g, +p]; }));
const B = BOOKS.map(({ lab, f }) => {
  const c = JSON.parse(readFileSync(f, 'utf8')); const ind = c.industries.find(i => i.id === IND);
  if (!ind) throw new Error(`${f}: no industry '${IND}'`);
  if (ind.disabled) throw new Error(`${f}: industry '${IND}' is disabled in this book (its vanilla building stands)`);
  return { lab, ab: c._ab || {}, div: c.ai_defines?.PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING ?? 0.001,
           tiers: ind.tiers.slice().sort((a, b) => a.era - b.era), out: ind.output_good };
});
const src = readFileSync('ui/vanilla.js', 'utf8'); const V = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
const val = o => Object.entries(o || {}).reduce((s, [g, q]) => s + q * (P[g] ?? 0), 0);
const emp = e => Object.values(e || {}).reduce((s, v) => s + v, 0);
const fmt = (x, d = 0) => x == null || Number.isNaN(x) ? '—' : typeof x === 'number' ? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : String(x);
const cols = [...B.map(b => b.lab), 'vanilla PM']; const W0 = 30, W = 18;
const row = (label, vals) => console.log(label.padEnd(W0) + vals.map(v => String(v).padStart(W)).join(''));
const nR = Math.max(...B.map(b => b.tiers.length));
if (B.some(b => b.tiers.length !== nR)) console.log('⚠ the books do not carry the same number of rungs for ' + IND + ': ' + B.map(b => b.lab + ' ' + b.tiers.length).join(', '));
console.log(`${IND.toUpperCase()} — rungs side by side. Base prices from tools/goods_prices.tsv. Books: `
  + B.map(b => `${b.lab} (A ${b.ab.A ?? '?'} / B ${b.ab.B ?? '?'}${b.ab.in0 ? ' / in0 ' + b.ab.in0 : ''}${b.ab.cost_flat ? ' / cost flat' : b.ab.cost_ladder ? ' / cost ' + b.ab.cost_ladder.join('/') : b.ab.cost_ratio ? ' / cost ' + b.ab.cost_ratio + '^era' : ''}, divisor ${b.div})`).join(' · ')
  + ' · vanilla PM = the base game\'s own method at that rung (one building, cost = the anchor)');
const anchor = B[0].tiers[0].building_cost; const vb = V.buildings[B[0].tiers[0].key] || {};
for (let k = 0; k < nR; k++) {
  const T = B.map(b => b.tiers[k] || null); const t0 = T.find(Boolean);
  const vpm = t0 && t0.vanilla_pm ? V.pms[t0.vanilla_pm] : null;
  console.log('\n' + '='.repeat(W0 + W * cols.length));
  console.log(`RUNG ${k} · era ${t0.era} · ${t0.name}  (tech ${t0.tech}${t0.tech_year ? ', onset ' + t0.tech_year : ''}; vanilla_pm ${t0.vanilla_pm || 'none — a minted rung'})`);
  console.log('-'.repeat(W0 + W * cols.length));
  row('', cols);
  const outs = [...T.map(t => t ? t.output_qty : null), vpm ? Object.values(vpm.out)[0] : null];
  row(`${t0.output_good || B[0].out} out / level`, outs.map(x => fmt(x, 1)));
  const goods = [...new Set([...T.flatMap(t => t ? Object.keys(t.inputs || {}) : []), ...Object.keys(vpm?.in || {})])];
  for (const g of goods) row('  in ' + g, [...T.map(t => t ? t.inputs?.[g] : null), vpm?.in?.[g]].map(x => x == null ? '—' : fmt(x, 1)));
  const outV = [...T.map(t => t ? t.output_qty * (P[t.output_good || B[0].out] ?? 0) : null), vpm ? val(vpm.out) : null];
  const inV = [...T.map(t => t ? val(t.inputs) : null), vpm ? val(vpm.in) : null];
  row('output value £ (base)', outV.map(x => fmt(x))); row('input value £ (base)', inV.map(x => fmt(x)));
  row('O:I value ratio', outV.map((o, i) => o == null || !inV[i] ? '—' : fmt(o / inV[i], 2)));
  row('goods margin (out−in)/in', outV.map((o, i) => o == null || !inV[i] ? '—' : fmt(100 * (o - inV[i]) / inV[i]) + '%'));
  const va = outV.map((o, i) => o == null ? null : o - inV[i]); row('value added £/level (base)', va.map(x => fmt(x)));
  const emps = [...T.map(t => t ? t.employment : null), vpm?.emp]; row('employment / level', emps.map(e => e ? fmt(emp(e)) : '—'));
  row('VA per worker £ (base)', va.map((x, i) => x == null || !emps[i] ? '—' : fmt(x / emp(emps[i]), 2)));
  const costs = [...T.map(t => t ? t.building_cost : null), anchor];
  row('building cost (points)', costs.map(x => fmt(x)));
  row('points per output unit', costs.map((c, i) => c == null || !outs[i] ? '—' : fmt(c / outs[i], 2)));
  row('VA £/wk per 1,000 points', costs.map((c, i) => c == null || va[i] == null ? '—' : fmt(va[i] / c * 1000)));
  row('ai_value', [...T.map(t => t ? t.ai_value : null), vb.ai_value ?? '(default 1000)'].map(x => fmt(x)));
  row('AI cost divisor ÷(1+cost×d)', [...B.map((b, i) => T[i] ? fmt(1 + T[i].building_cost * b.div, 2) : '—'), fmt(1 + anchor * 0.001, 2)]);
  row('target_be % (wage-incl. BE)', [...T.map(t => t ? t.target_be : null), '—'].map(x => fmt(x)));
}
console.log('\n' + '='.repeat(W0 + W * cols.length)); console.log('LADDER SHAPE — each rung ÷ the book\'s own first rung (per level)');
const shape = [
  ['output', t => t.output_qty, p => Object.values(p.out)[0]],
  ['input value', t => val(t.inputs), p => val(p.in)],
  ['VA', t => t.output_qty * (P[t.output_good || B[0].out] ?? 0) - val(t.inputs), p => val(p.out) - val(p.in)],
  ['building cost', t => t.building_cost, () => 1],
  ['ai_value', t => t.ai_value, () => 1],
];
for (const [lab, f, vf] of shape) {
  const cells = B.map(b => b.tiers.map(t => fmt(f(t) / f(b.tiers[0]), 2)).join(' · '));
  const vp = B[0].tiers.map(t => t.vanilla_pm ? V.pms[t.vanilla_pm] : null);
  cells.push(vp.map(p => p && vp[0] ? fmt(vf(p) / vf(vp[0]), 2) : '—').join(' · '));
  console.log(lab.padEnd(W0) + cells.map(c => c.padStart(W + 10)).join(''));
}
