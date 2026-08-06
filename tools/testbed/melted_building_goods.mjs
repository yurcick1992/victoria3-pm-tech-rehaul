// melted_building_goods.mjs — per-state and per-market goods flows straight out of a melted save.
//
//   node tools/testbed/melted_building_goods.mjs <melted.txt> --tsv out.tsv
//
// ⭐ WHY THIS MATTERS. The market order book is NOT persisted in a savegame (checked: the market
// database holds only `owner`). But every BUILDING is, with its realised recipe:
//
//   building_manager={ database={ <id>={ building="..."  levels=N  state=<state id>
//       input_goods={ goods={ <good idx>={ value=X } } }
//       output_goods={ goods={ <good idx>={ value=X } } } } } }
//
// Summing those gives, for the SAME gamestate the pop-need weights come from:
//   · SUPPLY            = sum of output_goods            (the sell side, before trade)
//   · NON-POP DEMAND    = sum of input_goods             (industry, government, construction, military)
// which is exactly the pair the substitution rule is supposed to consume. No second instrument, no
// cross-run pairing, no assumption that two campaigns are comparable.
//
// ⚠ It is NOT the order book. Trade moves goods between markets, and pops add the demand side we are
// trying to predict. So `output` here is production, not sell orders; compare accordingly.
import { createReadStream, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const TSV = argOf('--tsv', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: melted_building_goods.mjs <melted.txt> --tsv out.tsv'); process.exit(1); }
const strip = s => s.replace(/^\uFEFF/, '');
const GOODS = [];
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')).sort())
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{/gm)) GOODS.push(m[1]);

// pass 1 is not needed: states and countries appear BEFORE building_manager in the file, so one
// streaming pass can build state->country and country->market first and use them at the end.
const stateCountry = new Map(), stateRegion = new Map(), countryMarket = new Map(), countryTag = new Map();
const inp = new Map(), outp = new Map();   // "state|good" -> qty
// ⭐ each good entry also carries `prestige_goods={ a b c }` — how much of that flow is PRESTIGE goods.
// That is the scaling factor behind DEFAULT_PRESTIGE_GOODS_DEMAND_INCREASE, and it exists nowhere else.
const pout = new Map();
let section = '', depth = 0;
let curState = null, curCountry = null, curId = null;
let bState = null, bBuilding = null, bLevels = 0, side = '', inGoods = false, curGood = null, inPrestige = false;

const rl = createInterface({ input: createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (section === '') {
    if (t === 'states={') { section = 'states'; depth = 1; }
    else if (t === 'country_manager={') { section = 'countries'; depth = 1; }
    else if (t === 'building_manager={') { section = 'buildings'; depth = 1; }
    continue;
  }
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  if (section === 'states') {
    const sm = /^(\d+)=\{$/.exec(t);
    if (sm && depth === 2) curId = +sm[1];
    else if (curId !== null) {
      const cm = /^country=(\d+)$/.exec(t); if (cm) stateCountry.set(curId, +cm[1]);
      const rm = /^region="([A-Z_]+)"$/.exec(t); if (rm) stateRegion.set(curId, rm[1]);
    }
    depth += opens - closes; if (depth <= 0) { section = ''; curId = null; }
    continue;
  }
  if (section === 'countries') {
    const sm = /^(\d+)=\{$/.exec(t);
    if (sm && depth === 2) curId = +sm[1];
    else if (curId !== null) {
      const mm = /^market=(\d+)$/.exec(t); if (mm && !countryMarket.has(curId)) countryMarket.set(curId, +mm[1]);
      const dm = /^definition="([A-Z_]+)"$/.exec(t); if (dm && !countryTag.has(curId)) countryTag.set(curId, dm[1]);
    }
    depth += opens - closes; if (depth <= 0) { section = ''; curId = null; }
    continue;
  }
  // buildings
  const sm = /^(\d+)=\{$/.exec(t);
  if (sm && depth === 2) { bState = null; bBuilding = null; bLevels = 0; side = ''; inGoods = false; }
  else {
    if (t === 'input_goods={') side = 'in';
    else if (t === 'output_goods={') side = 'out';
    else if (t === 'goods={' && side) inGoods = true;
    else if (inGoods) {
      const gm = /^(\d+)=\{$/.exec(t);
      if (gm) { curGood = GOODS[+gm[1]] ?? ('idx' + gm[1]); inPrestige = false; }
      else if (t === 'prestige_goods={') inPrestige = true;
      else if (inPrestige) {
        if (t === '}') inPrestige = false;
        else if (side === 'out' && curGood && bState !== null && /^[\d.\- ]+$/.test(t)) {
          const v = t.split(/\s+/).reduce((a, b) => a + (+b || 0), 0);
          if (v) { const k = bState + '|' + curGood; pout.set(k, (pout.get(k) || 0) + v); }
        }
      } else {
        const vm = /^value=([\-\d.]+)$/.exec(t);
        if (vm && curGood && bState !== null) {
          const map = side === 'in' ? inp : outp, k = bState + '|' + curGood;
          map.set(k, (map.get(k) || 0) + +vm[1]);
        }
      }
    }
    const stm = /^state=(\d+)$/.exec(t); if (stm) bState = +stm[1];
    const bm = /^building="([a-z_]+)"$/.exec(t); if (bm) bBuilding = bm[1];
    const lm = /^levels=(\d+)$/.exec(t); if (lm) bLevels = +lm[1];
  }
  const nd = depth + opens - closes;
  // leaving the input_goods / output_goods block resets the side
  if (side && nd <= 3) { side = ''; inGoods = false; curGood = null; inPrestige = false; }
  depth = nd;
  if (depth <= 0) { section = ''; }
}

const rows = ['state\tregion\tcountry\ttag\tmarket\tgood\tinput\toutput\tprestige_out'];
const keys = new Set([...inp.keys(), ...outp.keys()]);
for (const k of [...keys].sort()) {
  const [s, g] = k.split('|');
  const c = stateCountry.get(+s);
  rows.push([s, stateRegion.get(+s) ?? '', c ?? '', countryTag.get(c) ?? '', countryMarket.get(c) ?? '', g,
  (inp.get(k) || 0).toFixed(3), (outp.get(k) || 0).toFixed(3), (pout.get(k) || 0).toFixed(3)].join('\t'));
}
if (TSV) { writeFileSync(TSV, rows.join('\n') + '\n'); console.log(`${rows.length - 1} state-good rows -> ${TSV}`); }
else console.log(rows.slice(0, 40).join('\n'));
console.log(`states ${stateCountry.size} · countries ${countryMarket.size} · markets ${new Set(countryMarket.values()).size}`);
