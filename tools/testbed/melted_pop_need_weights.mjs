// melted_pop_need_weights.mjs — per-STATE pop-need purchase weights out of a melted Victoria 3 save,
// keeping the REAL key of each pop_needs entry.
//
//   node tools/testbed/melted_pop_need_weights.mjs <melted.txt> --tsv out.tsv [--region STATE_X]
//
// ⭐ WHY THIS EXISTS ALONGSIDE melted_state_needs.mjs. That reader numbers the entries inside
// `pop_needs={ ... }` with a counter (0,1,2,…) and throws the actual key away. The keys are not
// 0..n — a state carries entries like `285={` and `15={` — so the counter merged distinct entities
// under one label and made a state's weights look like several unexplained "groups". The key is
// almost certainly an entity id (culture / country / market), and until it is identified it must be
// CARRIED, not renumbered.
//
// THE STRUCTURE, read off the melted text:
//   states={ database={ <state id>={
//       country=<id>  region="STATE_X"
//       trade={ goods={ <good idx>={ value=<net> } } }        <- per-state net trade, if present
//       pop_needs={ <KEY>={ pop_need_entry_data={ {weights={<good idx>=<w>}} x15 } } } } } }
//
// ⚠ `region=` appears AFTER `pop_needs=`, so weights are buffered per state and labelled on close.
//
// ⭐ THE WEIGHT IS `base weight × clamped availability share`. Dividing by the base weight from
// common/pop_needs recovers the share the game actually used — a quantity that exists nowhere else.
// The base weights come from the GAME files, so for an OVERLAY arm that rescales them the `share`
// column is wrong by that arm's multiplier; pass --weights <json> to supply the arm's own weights.
import { createReadStream, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const TSV = argOf('--tsv', ''), ONLY = argOf('--region', ''), WMULT = argOf('--weights', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: melted_pop_need_weights.mjs <melted.txt> --tsv f [--region R] [--weights mult.json]'); process.exit(1); }

const strip = s => s.replace(/^\uFEFF/, '');
const GOODS = [];
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')).sort())
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{/gm)) GOODS.push(m[1]);

// need order = definition order in the file; that is the order pop_need_entry_data uses
const NEEDS = [], BASE = new Map(), MAXS = new Map(), MINS = new Map();
for (const m of strip(readFileSync(join(GAME, 'common/pop_needs/00_pop_needs.txt'), 'utf8')).matchAll(/^popneed_([a-z_]*)\s*=\s*\{([\s\S]*?)\n\}/gm)) {
  const need = m[1]; NEEDS.push(need);
  for (const e of m[2].matchAll(/entry\s*=\s*\{([\s\S]*?)\}/g)) {
    const g = /goods\s*=\s*([a-z_]+)/.exec(e[1]);
    if (!g) continue;
    const w = /(?<!max_supply_share = )(?<!min_supply_share = )\bweight\s*=\s*([\d.]+)/.exec(e[1]);
    const mx = /max_supply_share\s*=\s*([\d.]+)/.exec(e[1]);
    const mn = /min_supply_share\s*=\s*([\d.]+)/.exec(e[1]);
    BASE.set(need + '|' + g[1], w ? +w[1] : 1);
    MAXS.set(need + '|' + g[1], mx ? +mx[1] : 1);
    MINS.set(need + '|' + g[1], mn ? +mn[1] : 0);
  }
}
// an overlay arm rescales base weights by good; apply it so `share` stays meaningful
if (WMULT) {
  const j = JSON.parse(strip(readFileSync(WMULT, 'utf8')));
  const mult = j.pop_need_weight_mult || j;
  for (const [k, v] of BASE) { const good = k.split('|')[1]; if (mult[good]) BASE.set(k, v * mult[good]); }
}

let inStates = false, depth = 0, stateId = null, country = null, region = null;
let inNeeds = false, nd = 0, ent = -1, key = null, inW = false, cur = null, buf = [];
const rows = [];
const flush = () => {
  if (!ONLY || region === ONLY) for (const r of buf) rows.push({ state: stateId, country, region, ...r });
  buf = []; stateId = null; country = null; region = null; key = null;
};
const rl = createInterface({ input: createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (!inStates) { if (t === 'states={') { inStates = true; depth = 1; } continue; }
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  if (inNeeds) {
    // nd === 1 is the level directly inside pop_needs={ … }, i.e. where the real keys live
    const km = /^(\d+)=\{$/.exec(t);
    if (km && nd === 1) { key = km[1]; ent = -1; nd += opens - closes; depth += opens - closes; continue; }
    if (t === 'pop_need_entry_data={') { ent = -1; nd += opens - closes; depth += opens - closes; continue; }
    if (t === 'weights={') { ent++; cur = { key, need: NEEDS[ent] ?? ('e' + ent), w: {} }; inW = true; nd += opens - closes; depth += opens - closes; continue; }
    if (inW) {
      const m = /^(\d+)=([\-\d.]+)$/.exec(t);
      if (m) cur.w[GOODS[+m[1]] ?? ('idx' + m[1])] = +m[2];
      else if (t === '}') { inW = false; buf.push(cur); cur = null; }
      nd += opens - closes; depth += opens - closes; continue;
    }
    nd += opens - closes; depth += opens - closes;
    if (nd <= 0) inNeeds = false;
    continue;
  }
  const sm = /^(\d+)=\{$/.exec(t);
  if (sm && depth === 2) { if (stateId !== null) flush(); stateId = +sm[1]; }
  else if (stateId !== null) {
    const cm = /^country=(\d+)$/.exec(t); if (cm) country = +cm[1];
    const rm = /^region="([A-Z_]+)"$/.exec(t); if (rm) region = rm[1];
    if (t === 'pop_needs={') { inNeeds = true; nd = 1; ent = -1; key = null; depth += opens - closes; continue; }
  }
  depth += opens - closes;
  if (depth <= 0) { if (stateId !== null) flush(); inStates = false; }
}
if (stateId !== null) flush();

const out = ['state\tcountry\tregion\tkey\tneed\tgood\tweight\tbase\tshare\tmaxs\tmins\tclamp'];
let n = 0;
for (const r of rows) for (const [good, w] of Object.entries(r.w)) {
  const bk = r.need + '|' + good;
  const base = BASE.has(bk) ? BASE.get(bk) : 1;
  const mx = MAXS.has(bk) ? MAXS.get(bk) : 1, mn = MINS.has(bk) ? MINS.get(bk) : 0;
  const share = w / base;
  const eps = 1e-6;
  const clamp = Math.abs(share - mx) < eps ? 'max' : (mn > 0 && Math.abs(share - mn) < eps ? 'min' : '');
  out.push(`${r.state}\t${r.country}\t${r.region}\t${r.key}\t${r.need}\t${good}\t${w}\t${base}\t${share.toFixed(6)}\t${mx}\t${mn}\t${clamp}`);
  n++;
}
if (TSV) { writeFileSync(TSV, out.join('\n') + '\n'); console.log(`${n} rows -> ${TSV}`); }
else console.log(out.slice(0, 60).join('\n'));
