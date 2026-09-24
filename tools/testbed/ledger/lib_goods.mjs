// THE GOODS TABLE, read live from the game: name -> { idx, cost, tq } — base price, vanilla traded_quantity and the POSITIONAL
// index a save uses for its goods (FINDINGS F159 §1). One implementation for the trade readers, so a patch that re-prices a good
// or changes its traded quantity flows through instead of sitting in a copied table.
// ⚠ A book with `goods_traded_quantity` overrides tq for the goods it names — use tradedQuantity(cfg) for an arm's own values.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
export function goodsTable(game = GAME) {
  const out = {}; let idx = 0;
  for (const f of readdirSync(join(game, 'common/goods')).filter(x => x.endsWith('.txt')).sort()) {
    let cur = null;
    for (const line of readFileSync(join(game, 'common/goods', f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const l = line.replace(/#.*$/, ''); let m;
      if ((m = /^([a-z][a-z_]*)\s*=\s*\{/.exec(l))) { cur = m[1]; out[cur] = { idx: idx++, cost: null, tq: null, local: false, tradeable: true }; }
      else if (cur && (m = /^\s*cost\s*=\s*([\d.]+)/.exec(l))) out[cur].cost = +m[1];
      else if (cur && (m = /^\s*traded_quantity\s*=\s*([\d.]+)/.exec(l))) out[cur].tq = +m[1];
      else if (cur && /^\s*local\s*=\s*yes/.test(l)) out[cur].local = true;
      else if (cur && /^\s*tradeable\s*=\s*no/.test(l)) out[cur].tradeable = false;
    }
  }
  if (Object.values(out).filter(g => g.cost).length < 40) throw new Error('goods table read fewer than 40 priced goods — the goods file moved');
  return out;
}
// An arm's traded quantity per good: the book's goods_traded_quantity where set, vanilla's otherwise.
export function tradedQuantity(cfg, G = goodsTable()) { const o = {}; for (const [g, v] of Object.entries(G)) o[g] = cfg?.goods_traded_quantity?.[g] ?? v.tq; return o; }
// F159 §7's five classes, read from the trade book's own `_trade.classes` (make_trade_config.mjs writes them there) — never a
// copy kept here. A book without `_trade` (the canon, vanilla) is classed with the reference trade book's table.
export const REF_TRADE_BOOK = 'C:/claude-code/victoria 3 PM and tech rehaul/config/mod_config.canon-slide-b158-trade.json';
export function tradeClasses(cfg) {
  const src = cfg?._trade?.classes ?? JSON.parse(readFileSync(REF_TRADE_BOOK, 'utf8'))._trade.classes;
  const classOf = {}; for (const [k, c] of Object.entries(src)) for (const g of c.goods) classOf[g] = k;
  return { classes: Object.fromEntries(Object.entries(src).map(([k, c]) => [k, c.goods])), classOf };
}
