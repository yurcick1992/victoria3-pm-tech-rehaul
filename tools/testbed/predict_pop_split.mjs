// predict_pop_split.mjs — THE end-to-end check: reproduce a gamestate's stored pop-need purchase
// weights from that same gamestate's supply, non-pop demand and prestige supply.
//
//   node tools/testbed/predict_pop_split.mjs <needs.tsv> <bgoods.tsv> <markets_all.tsv>
//        [--date 1925.1.1] [--run 3] [--market "British Market"] [--probe STATE_MIDLANDS]
//
// THE RULE, as measured (FINDINGS F40):
//   avail(g) = ( market sell orders(g) - 0.5 * non-pop demand(g) ) * BASE price(g)
//   raw      = avail(g) / SUM avail over the need's own goods
//   share    = clamp( raw, min_supply_share, max_supply_share )
//   share   *= 1 + prestige_goods_demand_increase(need) * prestige share of that good's supply
//   if the culture is OBSESSED with g:  share = max( share, obsession_demand_min(need) * max_supply_share(g) )
//   if the religion TABOOS g:           share *= 0.5                     (TABOO_DEMAND_MULT)
//   stored purchase weight = base weight(need,g) * share
//
// Every input is read from the same instant: the weights and the building flows from the save, the
// order book from the run's own telemetry at the same dump date.
//
// ⚠ LOCAL goods (services, transportation, electricity) are reported separately and excluded from the
// headline. Their substitution supply is not the market's: per LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR
// it is the state's own supply plus (1 - the state's GDP share) * 0.25 of the market's production, and
// the state GDP share is not extracted yet.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [NEEDS_TSV, BG_TSV, MKT_TSV] = pos;
const DATE = argOf('--date', '1925.1.1'), RUN = argOf('--run', '3');
const MARKET = argOf('--market', 'British Market'), PROBE = argOf('--probe', 'STATE_MIDLANDS');
const C1 = +argOf('--c1', '0.5');
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const strip = s => s.replace(/^\uFEFF/, '');

const BASEP = {};
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{([\s\S]*?)^\}/gm)) {
    const p = /cost\s*=\s*([\d.]+)/.exec(m[2]); if (p) BASEP[m[1]] = +p[1];
  }
// pop needs: entry table + the per-need obsession / prestige overrides
const NEED = {};
for (const m of strip(readFileSync(join(GAME, 'common/pop_needs/00_pop_needs.txt'), 'utf8')).matchAll(/^popneed_([a-z_]*)\s*=\s*\{([\s\S]*?)\n\}/gm)) {
  const body = m[2];
  const n = {
    entries: {},
    obsMin: +(/obsession_demand_min\s*=\s*([\d.]+)/.exec(body)?.[1] ?? 0.5),
    obsMult: +(/obsession_demand_mult\s*=\s*([\d.]+)/.exec(body)?.[1] ?? 1.5),
    prestige: +(/prestige_goods_demand_increase\s*=\s*([\d.]+)/.exec(body)?.[1] ?? 0.5),
  };
  for (const e of body.matchAll(/entry\s*=\s*\{([\s\S]*?)\}/g)) {
    const g = /goods\s*=\s*([a-z_]+)/.exec(e[1]); if (!g) continue;
    n.entries[g[1]] = {
      w: +(/^\s*weight\s*=\s*([\d.]+)/m.exec(e[1])?.[1] ?? 1),
      max: +(/max_supply_share\s*=\s*([\d.]+)/.exec(e[1])?.[1] ?? 1),
      min: +(/min_supply_share\s*=\s*([\d.]+)/.exec(e[1])?.[1] ?? 0),
    };
  }
  NEED[m[1]] = n;
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
// ⚠ OBSESSIONS ARE RUNTIME STATE. common/cultures holds the 1836 set; the game adds and drops them all
// campaign, so they must come from the save (melted_cultures.mjs) or every culture that acquired one is
// mis-scored — Australian wine read 220 pp wrong before this.
const OBSF = argOf('--obsessions', '');
if (OBSF) {
  for (const l of readFileSync(OBSF, 'utf8').split('\n').filter(Boolean).slice(1)) {
    const [id, type, o] = l.split('\t');
    if (CULT[+id]) CULT[+id].obs = o ? o.split(',') : [];
  }
}

const BG = readFileSync(BG_TSV, 'utf8').split('\n').filter(Boolean);
const bh = BG[0].split('\t'), bi = Object.fromEntries(bh.map((x, i) => [x, i]));
const nonpop = new Map(), prodM = new Map(), prestM = new Map(), stateMarket = new Map();
for (let i = 1; i < BG.length; i++) {
  const c = BG[i].split('\t'); stateMarket.set(c[bi.region], c[bi.market]);
  const k = c[bi.market] + '|' + c[bi.good];
  nonpop.set(k, (nonpop.get(k) || 0) + +c[bi.input]);
  prodM.set(k, (prodM.get(k) || 0) + +c[bi.output]);
  prestM.set(k, (prestM.get(k) || 0) + +(c[bi.prestige_out] || 0));
}
// ⭐ IMPORTED PRESTIGE. The prestige share is measured from a market's own production, so a good it
// IMPORTS reads 0 prestige however prestigious it is abroad — which is exactly the American luxury_drinks
// residual (tea: production 0, imports 3 310). --world-prestige values the imported part at the WORLD's
// prestige rate for that good. Off by default: it is a correction to an INPUT, so it must be measured
// before it is believed.
const WORLDP = !args.includes('--domestic-prestige');
const wProd = new Map(), wPrest = new Map();
for (let i = 1; i < BG.length; i++) {
  const c = BG[i].split('	');
  wProd.set(c[bi.good], (wProd.get(c[bi.good]) || 0) + +c[bi.output]);
  wPrest.set(c[bi.good], (wPrest.get(c[bi.good]) || 0) + +(c[bi.prestige_out] || 0));
}
const worldRate = g => { const o = wProd.get(g) || 0; return o > 0 ? Math.min(1, (wPrest.get(g) || 0) / o) : 0; };
const MID = stateMarket.get(PROBE);
const M = readFileSync(MKT_TSV, 'utf8').split('\n').filter(Boolean);
const mh = M[0].split('\t'), mi = Object.fromEntries(mh.map((x, i) => [x, i]));
const OB = {};
for (let i = 1; i < M.length; i++) {
  const c = M[i].split('\t');
  if (c[mi.run_index] !== RUN || c[mi.dump_date] !== DATE || c[mi.tag] !== MARKET) continue;
  OB[c[mi.good]] = { sell: +c[mi.sell_orders], buy: +c[mi.buy_orders], price: +c[mi.price], exports: +c[mi.exports], production: +c[mi.production] };
}
const avail = g => OB[g] ? Math.max(0, OB[g].sell - C1 * (nonpop.get(MID + '|' + g) || 0)) * (BASEP[g] ?? 0) : 0;
// prestige share of the market's supply for this good
const pshare = g => {
  const p = prestM.get(MID + '|' + g) || 0, o = prodM.get(MID + '|' + g) || 0;
  if (!WORLDP) return o > 0 ? Math.min(1, p / o) : 0;
  const sell = OB[g] ? OB[g].sell : 0;
  const imported = Math.max(0, sell - o);
  const tot = o + imported;
  return tot > 0 ? Math.min(1, (p + imported * worldRate(g)) / tot) : 0;
};

const L = readFileSync(NEEDS_TSV, 'utf8').split('\n').filter(Boolean);
const h = L[0].split('\t'), ix = Object.fromEntries(h.map((x, i) => [x, i]));
const cells = new Map();
for (let i = 1; i < L.length; i++) {
  const c = L[i].split('\t');
  if (stateMarket.get(c[ix.region]) !== MID) continue;
  const k = c[ix.region] + '|' + c[ix.key] + '|' + c[ix.need];
  if (!cells.has(k)) cells.set(k, { region: c[ix.region], key: +c[ix.key], need: c[ix.need], gs: [] });
  cells.get(k).gs.push({ good: c[ix.good], share: +c[ix.share] });
}

let tot = 0, n = 0, totL = 0, nL = 0;
const worst = [];
const perNeed = {};
for (const cell of cells.values()) {
  const nd = NEED[cell.need]; if (!nd) continue;
  const cult = CULT[cell.key] || { obs: [], religion: '' }, taboo = RELTABOO[cult.religion] || [];
  const isLocal = cell.gs.some(r => LOCAL.has(r.good));
  const av = cell.gs.map(r => avail(r.good));
  const S = av.reduce((a, b) => a + b, 0);
  if (!(S > 0)) continue;
  for (let i = 0; i < cell.gs.length; i++) {
    const r = cell.gs[i], e = nd.entries[r.good] || { max: 1, min: 0 };
    let s = Math.min(Math.max(av[i] / S, e.min), e.max);
    s *= 1 + nd.prestige * pshare(r.good);
    // the obsession floor is on the PURCHASE WEIGHT (= weight x share), and it is CLAMPED at both ends:
    //     pw  >=  clamp( obsMin x max_supply_share x weight ,  obsMin^2 ,  obsMin )
    // The lower bound catches goods whose own weight x cap is tiny (wine: 0.25 x 0.25); the upper bound
    // catches the one good whose weight is large (fine_art: 4). Across three gamestates 63 entries sit
    // EXACTLY on it, 884 above it, and none below. Divided through by the weight to stay in share terms.
    if (cult.obs.includes(r.good) && (e.w || 0) > 0) {
      const oM = nd.obsMin;
      s = Math.max(s, Math.min(Math.max(oM * e.max * e.w, oM * oM), oM) / e.w);
    }
    if (taboo.includes(r.good)) s *= 0.5;
    const err = Math.abs(s - r.share);
    // --no-culture scores the MECHANISM only: obsession and taboo are per-culture terms our scenario
    // model has no dimension for, and the obsession FLOOR is not fully resolved (see FINDINGS F40).
    if (args.includes('--no-culture') && (cult.obs.includes(r.good) || taboo.includes(r.good))) continue;
    // ⚠ local-good needs are kept in `worst` (flagged) so --good can still trace them; they are excluded
    // from the headline, not from the record — telephones lives in a need that contains transportation.
    worst.push({ ...cell, good: r.good, obs: r.share, pred: s, err, local: isLocal });
    if (isLocal) { totL += err; nL++; }
    else {
      tot += err; n++;
      (perNeed[cell.need] = perNeed[cell.need] || { e: 0, n: 0 }).e += err;
      perNeed[cell.need].n++;
    }
  }
}
// --good/--need: print one entry's observed-vs-predicted instead of the whole market. Looped over a run's
// quarterly saves this is the DEBUT TRAJECTORY — how far the stored share lags the share the rule computes,
// which is the rate limiter (MAX_DEMAND_ADJUSTMENT_*) made visible rather than inferred.
const ONEG = argOf('--good', ''), ONEN = argOf('--need', '');
if (ONEG) {
  const rows = worst.filter(w => w.good === ONEG && (!ONEN || w.need === ONEN) && w.region === PROBE);
  if (!rows.length) console.log(`${DATE}\t${ONEG}\t-\t-\t(not present in ${PROBE})`);
  for (const r of rows) {
    const o = OB[r.good];
    console.log(`${DATE}\t${r.need}\t${r.good}\tobserved ${r.obs.toFixed(5)}\ttarget ${r.pred.toFixed(5)}\t` +
      `lag ${((r.obs - r.pred) * 100).toFixed(2)} pp\tsell ${o ? o.sell.toFixed(0) : '-'}\tnonpop ${(nonpop.get(MID + '|' + r.good) || 0).toFixed(0)}`);
  }
  process.exit(0);
}
console.log(`market '${MARKET}' (save market id ${MID}) @ ${DATE}, run ${RUN} · c1 = ${C1}`);
console.log(`state x culture x need x good entries scored: ${n} non-local, ${nL} containing a local good`);
console.log(`\n⭐ MEAN ABSOLUTE ERROR OF THE PREDICTED SHARE: ${(tot / n * 100).toFixed(3)} pp   (local-good needs, excluded: ${(totL / nL * 100).toFixed(2)} pp)`);
console.log('\nper need:');
for (const [k, v] of Object.entries(perNeed).sort((a, b) => a[1].e / a[1].n - b[1].e / b[1].n))
  console.log(`  ${k.padEnd(20)} ${(v.e / v.n * 100).toFixed(3).padStart(8)} pp   over ${v.n} entries`);
worst.sort((a, b) => b.err - a.err);
console.log('\nworst 15 entries:');
for (const w of worst.filter(x => !x.local).slice(0, 15))
  console.log(`  ${w.region.padEnd(24)} ${(CULT[w.key]?.name ?? w.key).padEnd(14)} ${w.need.padEnd(16)} ${w.good.padEnd(14)} observed ${w.obs.toFixed(5)} predicted ${w.pred.toFixed(5)}  ${(w.err * 100).toFixed(2)} pp`);
