// validate_split_rule.mjs — check the WHOLE within-need substitution rule against a gamestate,
// term by term, including the ones the clean-cell test had to exclude.
//
//   node tools/testbed/validate_split_rule.mjs <needs.tsv> <bgoods.tsv> <markets_all.tsv>
//        [--date 1925.1.1] [--run 3] [--region STATE_HOME_COUNTIES] [--market "British Market"]
//
// THE RULE
//   avail(g)  = ( sell(g) - 0.5 * nonpop_demand(g) ) * base_price(g)
//   raw(g)    = avail(g) / SUM avail over the need's goods
//   share(g)  = clamp( raw, min_supply_share, max_supply_share )
//               * prestige multiplier   ( 1 + prestige_goods_demand_increase * prestige share of supply )
//               * obsession / taboo     ( TABOO_DEMAND_MULT = 0.5 measured exactly )
//   stored purchase weight = base weight(need,g) * share
//
// Each term is checked where it is ISOLATED: clamps on entries sitting exactly on a bound, prestige on
// needs whose shares sum above 1, culture terms by comparing two cultures of the SAME state (same
// market, same instant, so availability cannot differ).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [NEEDS_TSV, BG_TSV, MKT_TSV] = pos;
const DATE = argOf('--date', '1925.1.1'), RUN = argOf('--run', '3');
const REGION = argOf('--region', 'STATE_HOME_COUNTIES'), MARKET = argOf('--market', 'British Market');
const C1 = +argOf('--c1', '0.5');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const strip = s => s.replace(/^\uFEFF/, '');

const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
const PRESTIGE = new Set();
for (const f of readdirSync(join(GAME, 'common/prestige_goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/prestige_goods', f), 'utf8')).matchAll(/^([a-z_0-9]+)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const b = /base_good\s*=\s*([a-z_]+)/.exec(m[2]); if (b) PRESTIGE.add(b[1]);
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

const BG = readFileSync(BG_TSV, 'utf8').split('\n').filter(Boolean);
const bh = BG[0].split('\t'), bi = Object.fromEntries(bh.map((x, i) => [x, i]));
const nonpop = new Map(), stateMarket = new Map();
for (let i = 1; i < BG.length; i++) {
  const c = BG[i].split('\t'); stateMarket.set(c[bi.region], c[bi.market]);
  const k = c[bi.market] + '|' + c[bi.good]; nonpop.set(k, (nonpop.get(k) || 0) + +c[bi.input]);
}
const MID = stateMarket.get(REGION);
const M = readFileSync(MKT_TSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = {};
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.run_index] !== RUN || c[mi.dump_date] !== DATE || c[mi.tag] !== MARKET) continue;
  OB[c[mi.good]] = { sell: +c[mi.sell_orders], buy: +c[mi.buy_orders], price: +c[mi.price], exports: +c[mi.exports], production: +c[mi.production] };
}
const avail = g => OB[g] ? Math.max(0, OB[g].sell - C1 * (nonpop.get(MID + '|' + g) || 0)) * BASEP[g] : 0;

const L = readFileSync(NEEDS_TSV, 'utf8').split('\n').filter(Boolean);
const h = L[0].split('\t'), ix = Object.fromEntries(h.map((x, i) => [x, i]));
const rows = [];
for (let i = 1; i < L.length; i++) {
  const c = L[i].split('\t'); if (c[ix.region] !== REGION) continue;
  rows.push({ key: +c[ix.key], need: c[ix.need], good: c[ix.good], share: +c[ix.share], maxs: +c[ix.maxs], mins: +c[ix.mins], clamp: c[ix.clamp] || '' });
}
const keys = [...new Set(rows.map(r => r.key))];
console.log(`${REGION} (market id ${MID}) @ ${DATE} · c1 = ${C1}`);
console.log(`cultures: ${keys.map(k => `${k}:${CULT[k]?.name}${CULT[k]?.obs.length ? ' obsess ' + CULT[k].obs.join('/') : ''}${(RELTABOO[CULT[k]?.religion] || []).length ? ' taboo ' + RELTABOO[CULT[k].religion].join('/') : ''}`).join(' | ')}\n`);

const KEY = keys[0], cult = CULT[KEY], taboo = RELTABOO[cult.religion] || [];
console.log(`=== predicted vs stored, culture ${KEY} (${cult.name}) ===`);
console.log('need              good           raw pred   clamped   observed   obs/clamped   note');
const mult = {};
const mine = rows.filter(r => r.key === KEY);
for (const need of [...new Set(mine.map(r => r.need))]) {
  const gs = mine.filter(r => r.need === need);
  if (gs.some(r => LOCAL.has(r.good))) { console.log(`${need.padEnd(18)} -- skipped: contains a local good (${gs.filter(r => LOCAL.has(r.good)).map(r => r.good).join(',')})`); continue; }
  const av = gs.map(r => avail(r.good)); const S = av.reduce((a, b) => a + b, 0);
  if (!(S > 0)) { console.log(`${need.padEnd(18)} -- skipped: no availability`); continue; }
  for (let i = 0; i < gs.length; i++) {
    const r = gs[i], raw = av[i] / S;
    const cl = Math.min(Math.max(raw, r.mins), r.maxs);
    const ratio = cl > 0 ? r.share / cl : NaN;
    const notes = [];
    if (cult.obs.includes(r.good)) notes.push('OBSESSED');
    if (taboo.includes(r.good)) notes.push('TABOO');
    if (PRESTIGE.has(r.good)) notes.push('has prestige variant');
    if (r.clamp) notes.push('stored sits on ' + r.clamp);
    if (!cult.obs.includes(r.good) && !taboo.includes(r.good)) (mult[r.good] = mult[r.good] || []).push({ need, ratio });
    console.log(`${need.padEnd(18)} ${r.good.padEnd(14)} ${raw.toFixed(5)}  ${cl.toFixed(5)}   ${r.share.toFixed(5)}    ${(ratio).toFixed(4).padStart(8)}   ${notes.join(', ')}`);
  }
}
console.log('\n=== the residual multiplier per good, across the needs it appears in ===');
console.log('(if it is the prestige-goods term it must be >= 1 and the SAME in every need)');
for (const [g, list] of Object.entries(mult)) {
  if (list.length < 2) continue;
  const rs = list.map(x => x.ratio).filter(Number.isFinite);
  const spread = Math.max(...rs) / Math.min(...rs) - 1;
  console.log(`  ${g.padEnd(16)} ${list.map(x => x.need + '=' + x.ratio.toFixed(4)).join('  ')}   spread ${(spread * 100).toFixed(2)} %`);
}
console.log('\n=== culture terms: two cultures of THIS state, same market, same instant ===');
for (const k of keys.slice(0, 6)) {
  const c = CULT[k], tb = RELTABOO[c.religion] || [];
  if (!c.obs.length && !tb.length) continue;
  for (const g of [...c.obs, ...tb]) {
    const mine = rows.filter(r => r.key === k && r.good === g);
    for (const r of mine) {
      const base = rows.filter(x => x.key !== k && x.need === r.need && x.good === g && !(CULT[x.key]?.obs || []).includes(g) && !(RELTABOO[CULT[x.key]?.religion] || []).includes(g));
      if (!base.length) continue;
      const b = base[0].share;
      console.log(`  ${c.name.padEnd(12)} ${(c.obs.includes(g) ? 'obsession' : 'taboo').padEnd(10)} ${g.padEnd(12)} ${r.need.padEnd(16)} ${b.toFixed(5)} -> ${r.share.toFixed(5)}   x${(r.share / b).toFixed(4)}`);
    }
  }
}
