// fit_substitution_rule.mjs — THE test. Reconstruct a gamestate's stored pop-need purchase weights
// from that same gamestate's supply and NON-POP demand.
//
//   node tools/testbed/fit_substitution_rule.mjs <needs.tsv> <bgoods.tsv> <markets_all.tsv> \
//        [--date 1925.1.1] [--run 3] [--sweep]
//
// THE RULE UNDER TEST
//   availability(g) = ( sell(g) - c1*nonpop_demand(g) - c2*exports(g) ) * base_price(g)
//   share(need,g)   = clamp( availability(g) / SUM over the need , min_supply_share, max_supply_share )
//   purchase weight = base weight(need,g) * share * (culture / religion / prestige multipliers)
//
// `nonpop_demand` is NOT inferred: it is the sum of every building's `input_goods` in that market,
// read out of the same save as the weights (melted_building_goods.mjs). Supply and price come from the
// run's own market telemetry at the same date. So both sides of the comparison are measurements of one
// gamestate, which is the whole point - no cross-run pairing, no fitted stand-in for industry demand.
//
// Needs are scored only where nothing else is in play: no clamped entry, no obsessed or tabooed good,
// no `local` good (their substitution supply is state-level plus a GDP-weighted slice of the market's,
// per LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR), and sum(share) == 1, which is what rules out the
// prestige-goods demand multiplier.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [NEEDS_TSV, BG_TSV, MKT_TSV] = pos;
const DATE = argOf('--date', '1925.1.1'), RUN = argOf('--run', '3');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const SWEEP = args.includes('--sweep');
const strip = s => s.replace(/^\uFEFF/, '');

const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
const CULT = {}, RELTABOO = {};
{
  const t = strip(readFileSync(join(GAME, 'common/cultures/00_cultures.txt'), 'utf8'));
  const names = [...t.matchAll(/^([a-z_]+)\s*=\s*\{/gm)];
  for (let k = 0; k < names.length; k++) {
    const seg = t.slice(names[k].index, names[k + 1] ? names[k + 1].index : t.length);
    const o = /obsessions\s*=\s*\{([^}]*)\}/.exec(seg), r = /religion\s*=\s*([a-z_]+)/.exec(seg);
    CULT[k] = { name: names[k][1], obs: o && o[1].trim() ? o[1].trim().split(/\s+/) : [], religion: r ? r[1] : '' };
  }
  for (const f of readdirSync(join(GAME, 'common/religions')))
    for (const m of strip(readFileSync(join(GAME, 'common/religions', f), 'utf8')).matchAll(/^([a-z_]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
      const tb = /taboos\s*=\s*\{([^}]*)\}/.exec(m[2]);
      RELTABOO[m[1]] = tb && tb[1].trim() ? tb[1].trim().split(/\s+/) : [];
    }
}
const LOCAL = new Set(['services', 'transportation', 'electricity']);

// ---- non-pop demand per market, from the save's own buildings ----
const BG = readFileSync(BG_TSV, 'utf8').split('\n').filter(Boolean);
const bh = BG[0].split('\t'), bi = Object.fromEntries(bh.map((x, i) => [x, i]));
const nonpop = new Map(), stateMarket = new Map();
for (let i = 1; i < BG.length; i++) {
  const c = BG[i].split('\t');
  stateMarket.set(c[bi.region], c[bi.market]);
  const k = c[bi.market] + '|' + c[bi.good];
  nonpop.set(k, (nonpop.get(k) || 0) + +c[bi.input]);
}

// ---- order book per market ----
const M = readFileSync(MKT_TSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = new Map();
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.run_index] !== RUN || c[mi.dump_date] !== DATE) continue;
  OB.set(c[mi.tag] + '|' + c[mi.good], { buy: +c[mi.buy_orders], sell: +c[mi.sell_orders], price: +c[mi.price], imports: +c[mi.imports], exports: +c[mi.exports], production: +c[mi.production] });
}

// ---- stored shares ----
const L = readFileSync(NEEDS_TSV, 'utf8').split('\n').filter(Boolean);
const h = L[0].split('\t'), ix = Object.fromEntries(h.map((x, i) => [x, i]));
const byCell = new Map();     // "region|key" -> rows
for (let i = 1; i < L.length; i++) {
  const c = L[i].split('\t');
  const k = c[ix.region] + '|' + c[ix.key];
  if (!byCell.has(k)) byCell.set(k, []);
  byCell.get(k).push({ region: c[ix.region], key: +c[ix.key], need: c[ix.need], good: c[ix.good], share: +c[ix.share], clamp: c[ix.clamp] || '' });
}

// map a telemetry market name to the save's numeric market id, by matching a known state
const MARKETS = [
  { name: 'British Market', probe: 'STATE_MIDLANDS' },
  { name: 'American Market', probe: 'STATE_NEW_YORK' },
];
for (const m of MARKETS) m.id = stateMarket.get(m.probe);

// build the scored set
const cells = [];
for (const m of MARKETS) {
  if (m.id === undefined) continue;
  for (const [k, rs] of byCell) {
    const region = k.split('|')[0];
    if (stateMarket.get(region) !== m.id) continue;
    const cult = CULT[rs[0].key] || { obs: [], religion: '' }, taboo = RELTABOO[cult.religion] || [];
    const sums = {};
    for (const r of rs) sums[r.need] = (sums[r.need] || 0) + r.share;
    for (const need of [...new Set(rs.map(r => r.need))]) {
      const gs = rs.filter(r => r.need === need);
      if (gs.length < 2) continue;
      if (gs.some(r => r.clamp || cult.obs.includes(r.good) || taboo.includes(r.good) || LOCAL.has(r.good))) continue;
      if (Math.abs(sums[need] - 1) > 0.002) continue;
      if (gs.some(r => !OB.has(m.name + '|' + r.good) || OB.get(m.name + '|' + r.good).sell <= 0)) continue;
      cells.push({ market: m.name, mid: m.id, region, culture: cult.name, need, gs });
    }
  }
}
// one cell per (market, need) is enough - states of a market repeat the same numbers
const seen = new Set(), uniq = [];
for (const c of cells) { const k = c.market + '|' + c.need; if (seen.has(k)) continue; seen.add(k); uniq.push(c); }
console.log(`scored cells (market x need, fully clean): ${uniq.length}`);
for (const c of uniq) console.log(`  ${c.market.padEnd(16)} ${c.need.padEnd(16)} ${c.region.padEnd(20)} ${c.gs.map(g => g.good).join(',')}`);

const score = (c1, c2) => {
  let tot = 0, n = 0, per = [];
  for (const c of uniq) {
    const av = c.gs.map(r => {
      const o = OB.get(c.market + '|' + r.good);
      const np = nonpop.get(c.mid + '|' + r.good) || 0;
      return Math.max(0, o.sell - c1 * np - c2 * o.exports) * BASEP[r.good];
    });
    const S = av.reduce((a, b) => a + b, 0);
    if (!(S > 0)) return { err: 99, per: [] };
    let e = 0; for (let i = 0; i < c.gs.length; i++) e += Math.abs(av[i] / S - c.gs[i].share);
    per.push({ ...c, err: e / c.gs.length, pred: av.map(v => v / S) });
    tot += e; n += c.gs.length;
  }
  return { err: tot / n, per };
};

if (SWEEP) {
  console.log('\nmean |share error| (pp) over the scored cells, by deduction coefficients:');
  console.log('c2\\c1 ' + [0, 0.25, 0.4, 0.5, 0.6, 0.75, 1.0].map(x => String(x).padStart(8)).join(''));
  for (const c2 of [0, 0.25, 0.5, 0.75, 1.0]) {
    let line = String(c2).padEnd(6);
    for (const c1 of [0, 0.25, 0.4, 0.5, 0.6, 0.75, 1.0]) line += (score(c1, c2).err * 100).toFixed(2).padStart(8);
    console.log(line);
  }
}
// fine search
let best = { err: 9 };
for (let c1 = 0; c1 <= 1.2001; c1 += 0.01) for (let c2 = 0; c2 <= 1.0001; c2 += 0.05) {
  const s = score(c1, c2); if (s.err < best.err) best = { err: s.err, c1, c2, per: s.per };
}
console.log(`\nBEST FIT: c1 (non-pop demand) = ${best.c1.toFixed(2)} · c2 (exports) = ${best.c2.toFixed(2)} · mean |share error| = ${(best.err * 100).toFixed(3)} pp`);
console.log('\nper cell:');
for (const p of best.per) {
  console.log(`  ${p.market.padEnd(16)} ${p.need.padEnd(16)} ${(p.err * 100).toFixed(2)} pp`);
  for (let i = 0; i < p.gs.length; i++)
    console.log(`      ${p.gs[i].good.padEnd(12)} observed ${p.gs[i].share.toFixed(5)}  predicted ${p.pred[i].toFixed(5)}  ${((p.pred[i] - p.gs[i].share) * 100).toFixed(2)} pp`);
}
const s0 = score(0, 0);
console.log(`\nfor comparison: c1=0, c2=0 (no deduction at all) gives ${(s0.err * 100).toFixed(3)} pp`);
