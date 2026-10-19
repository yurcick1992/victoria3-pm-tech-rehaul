// THE WORLD MARKET'S WEEKLY PRICE HISTORY OUT OF ONE SAVE (2026-10-18, FINDINGS F242).
// A 1.13 save keeps, per good, the last 52 WEEKLY world-market prices (market_manager.world_market.price_trend.channels.<goods index>:
// a ring whose newest slot is (index - 1) mod 52; the index advances by 52 between saves a year apart, so the samples are weekly).
// So one yearly autosave gives a whole year of weekly world prices, and consecutive yearly saves give a continuous weekly series.
// Streams the .v3 through rakaly and stops at the end of the price rings (a few seconds; nothing written but the output).
// usage: node tools/testbed/ledger/world_price_rings.mjs <save.v3> <out.json>
//   out = { game: <save date>, rings: { <good>: { date, v: [52 prices, OLDEST FIRST] } } }
// ⚠ The goods index is POSITIONAL in vanilla's common/goods/00_goods.txt (the mod rewrites values in place, never the order).
import { spawn } from 'node:child_process'; import readline from 'node:readline'; import fs from 'node:fs';
const [save, out] = process.argv.slice(2);
if (!save || !out) { console.error('usage: world_price_rings.mjs <save.v3> <out.json>'); process.exit(2); }
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const GOODS = [...fs.readFileSync(`${GAME}/common/goods/00_goods.txt`, 'utf8').replace(/^\uFEFF/, '').matchAll(/^([a-z_]+)\s*=\s*\{/gm)].map(m => m[1]);
const p = spawn('tools/vendor/rakaly/rakaly.exe', ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', save]);
const rl = readline.createInterface({ input: p.stdout });
let st = 0, ch = null, idx = 0, date = '', vals = null, game = ''; const rings = {};
rl.on('line', l => {
  if (!game) { const m = /^date=([\d.]+)/.exec(l); if (m) game = m[1]; }
  if (st === 0 && l === 'market_manager={') st = 1;
  else if (st === 1 && l === '\t\tactive_world_market_hubs={') { st = 2; rl.close(); p.kill(); }
  else if (st === 1) {
    let m;
    if ((m = /^\t\t\t\t(\d+)=\{$/.exec(l))) { ch = +m[1]; vals = null; }
    else if ((m = /^\t\t\t\t\tindex=(\d+)/.exec(l))) idx = +m[1];
    else if ((m = /^\t\t\t\t\tdate=([\d.]+)/.exec(l))) date = m[1];
    else if (/^\t\t\t\t\tvalues=\{$/.test(l)) vals = [];
    else if (vals && /^\t\t\t\t\t\t[\d.\s-]+$/.test(l)) vals.push(...l.trim().split(/\s+/).map(Number));
    else if (vals && /^\t\t\t\t\t\}$/.test(l)) {
      const N = vals.length, s = ((idx % N) + N) % N;
      rings[GOODS[ch] ?? `#${ch}`] = { date, v: [...vals.slice(s), ...vals.slice(0, s)] };
      vals = null;
    }
  }
});
rl.on('close', () => {
  if (!Object.keys(rings).length) { console.error(`${save}: no world-market price rings found`); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify({ game, rings }));
  console.log(save.split(/[\\/]/).pop(), game, Object.keys(rings).length, 'goods');
});
