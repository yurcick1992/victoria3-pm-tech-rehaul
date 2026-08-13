// Which BUILDING TYPES consume a given good, straight out of a melted save.
//   node who_eats.mjs <melt> steel
import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const strip = s => s.replace(/^\uFEFF/, '');
const GOODS = [];
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')))
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{/gm)) GOODS.push(m[1]);
const MELT = process.argv[2], WANT = process.argv[3] || 'steel';

const eat = new Map(), make = new Map();
let mode = '', depth = 0, b = null, side = '', inGoods = false, curGood = null, inPrestige = false;
const rl = createInterface({ input: createReadStream(MELT, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (mode !== 'bm') { if (t === 'building_manager={') { mode = 'bm'; depth = 1; } continue; }
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  let m;
  if ((m = /^(\d+)=\{$/.exec(t)) && depth === 2) { b = { type: null, lv: 0, in: 0, out: 0 }; side = ''; inGoods = false; }
  else if (b) {
    if ((m = /^building="([a-z_0-9]+)"$/.exec(t))) b.type = m[1];
    else if ((m = /^levels=(\d+)$/.exec(t))) b.lv = +m[1];
    else if (t === 'input_goods={') side = 'in';
    else if (t === 'output_goods={') side = 'out';
    else if (t === 'goods={' && side) inGoods = true;
    else if (inGoods) {
      const gm = /^(\d+)=\{$/.exec(t);
      if (gm) { curGood = GOODS[+gm[1]] ?? ('idx' + gm[1]); inPrestige = false; }
      else if (t === 'prestige_goods={') inPrestige = true;
      else if (inPrestige) { if (t === '}') inPrestige = false; }
      else { const vm = /^value=([\-\d.]+)$/.exec(t); if (vm && curGood === WANT) b[side] += +vm[1]; }
    }
  }
  const nd = depth + opens - closes;
  if (side && nd <= 3) { side = ''; inGoods = false; curGood = null; inPrestige = false; }
  if (b && nd <= 2) {
    if (b.type) {
      if (b.in) { const r = eat.get(b.type) || { q: 0, lv: 0, n: 0 }; r.q += b.in; r.lv += b.lv; r.n++; eat.set(b.type, r); }
      if (b.out) { const r = make.get(b.type) || { q: 0, lv: 0, n: 0 }; r.q += b.out; r.lv += b.lv; r.n++; make.set(b.type, r); }
    }
    b = null;
  }
  depth = nd; if (depth <= 0) break;
}
const show = (label, map) => {
  const rows = [...map.entries()].sort((a, b2) => b2[1].q - a[1].q);
  const tot = rows.reduce((s, r) => s + r[1].q, 0);
  console.log(`\n${label} — world total ${tot.toFixed(0)} units/wk of ${WANT}`);
  for (const [ty, r] of rows) console.log(`   ${String(r.q.toFixed(0)).padStart(7)}  ${(r.q / tot * 100).toFixed(1).padStart(5)}%  ${ty.replace(/^building_/, '').padEnd(30)} ${r.n} buildings / ${r.lv} levels`);
};
show('CONSUMED BY', eat);
show('PRODUCED BY', make);
