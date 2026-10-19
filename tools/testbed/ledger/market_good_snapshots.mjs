// ONE GOOD IN ONE MARKET, SAVE BY SAVE — demand, own output, imports, the market's price from its own order book, and the world price
// (2026-10-18, FINDINGS F242: the Qing's rubber in a live playtest).
// Reads save summaries (v10+: per-country trade capacity by good) and, where a `<name>.rings.json` from world_price_rings.mjs sits beside a
// summary, that save's weekly world prices.
// usage: node tools/testbed/ledger/market_good_snapshots.mjs <summaryDir> --tag CHI --good rubber --units-per-cap 48
//   --units-per-cap = the good's traded_quantity × (1 + the trade centres' state_trade_quantity_mult) — the units ONE capacity unit moves
//     (F155). It is a property of the build AND the importing country's trade-centre method, so it is an argument, not a guess.
// ⚠ The market price is the engine's formula on the market's BUILDING demand and its own output + imports (pops are not in goods_in, so a
//   pop-bought good reads too low); market access and state-level prices are not modelled. It is an estimate of the market price, not a read.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const args = process.argv.slice(2); const dir = args[0];
const opt = k => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : null; };
const TAG = opt('tag') || 'CHI', G = opt('good') || 'rubber', Q = +(opt('units-per-cap') || 0);
if (!dir || !(Q > 0)) { console.error('usage: market_good_snapshots.mjs <summaryDir> --tag CHI --good rubber --units-per-cap 48'); process.exit(2); }
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const base = (() => { const t = fs.readFileSync(`${GAME}/common/goods/00_goods.txt`, 'utf8'); const m = new RegExp(`^${G}\\s*=\\s*\\{[^}]*?cost\\s*=\\s*([\\d.]+)`, 'ms').exec(t); if (!m) throw new Error(`no cost for ${G}`); return +m[1]; })();
// the V3 price rule (common/defines PRICE_RANGE 0.75, BUY_SELL_DIFF_AT_MAX_FACTOR 2): ceiling at buy >= 2 x sell, floor at sell >= 2 x buy
const price = (buy, sell) => buy <= 0 ? base * 0.25 : sell <= 0 ? base * 1.75 : base * (1 + 0.75 * Math.max(-1, Math.min(1, (buy - sell) / Math.min(buy, sell))));
const read = f => { let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b); return JSON.parse(b); };
const rows = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.rings.json'))) {
  const s = read(path.join(dir, f)); const me = s.countries[TAG]; if (!me) continue;
  let out = 0, inn = 0, imp = 0, exp = 0;
  for (const c of Object.values(s.countries)) if (c.market === me.market) {
    out += (c.goods_out || {})[G] || 0; inn += (c.goods_in || {})[G] || 0;
    const t = ((c.trade || {}).goods || {})[G] || {}; imp += t.imp || 0; exp += t.exp || 0;
  }
  const rf = path.join(dir, f.replace(/\.json$/, '.rings.json'));
  const ring = fs.existsSync(rf) ? read(rf).rings[G]?.v : null;
  let since = null; if (ring) { since = 0; for (let i = ring.length - 1; i >= 0 && ring[i] >= base * 1.745; i--) since++; }
  rows.push({ date: s.provenance.date, inn, out, imp: imp * Q, exp: exp * Q, mp: price(inn + exp * Q, out + imp * Q), wp: ring ? ring[ring.length - 1] : (s.world.world_market_price || {})[G]?.last, since });
}
const key = d => d.split('.').map(Number).reduce((a, x) => a * 100 + x, 0);
rows.sort((a, b) => key(a.date) - key(b.date));
const n = x => x == null ? '-' : Math.round(x).toLocaleString('en-US');
console.log(`${G} in the ${TAG} market (base price ${base}; ceiling ${base * 1.75}, floor ${base * 0.25}; ${Q} units per capacity unit)`);
console.log(['date', 'building demand', 'own output', 'imports', 'exports', 'market price (order book)', 'world price (last week)', 'weeks at the ceiling since the last dip'].join('\t'));
for (const x of rows) console.log([x.date, n(x.inn), n(x.out), n(x.imp), n(x.exp), x.mp.toFixed(1), x.wp == null ? '-' : x.wp.toFixed(1), x.since ?? '-'].join('\t'));
