// melted_state_needs.mjs — per-STATE pop-need purchase weights out of a melted Victoria 3 save,
// labelled with the state's region name and owning country.
//
// ⛔ SUPERSEDED by melted_pop_need_weights.mjs. This reader NUMBERS the entries inside `pop_needs={ … }`
// 0,1,2,… and throws the real key away — but the keys are CULTURE ids and are not consecutive, so the
// counter merges distinct cultures under one label and makes one state look like several unexplained
// "groups". Culture matters: an obsession floors a good's entry and a religion's taboo halves it
// (FINDINGS F40). Use the newer reader; this one is kept only so older TSVs remain reproducible.
//
//   node tools/testbed/melted_state_needs.mjs <melted.txt> [--tsv out.tsv] [--region STATE_MIDLANDS]
//
// ⭐ WHY. `pop_needs` lives inside the STATE record (`states.database.<id>`), which also carries
// `country=` and `region="STATE_X"` — so every weight can be attributed to a named state and owner
// without any guessing. That is what turns these numbers from "block 246 group 0" into "Midlands, GBR".
//
// THE STRUCTURE, read off the melted text:
//   states={ database={ <state id>={
//       country=<id>  region="STATE_X"  ...
//       pop_needs={ <key>={ pop_need_entry_data={ { weights={ <good idx>=<w> } } x15 } } } } } }
//
// ⚠ `region=` appears AFTER `pop_needs=` in the record, so the region cannot be known while the weights
// are being read. Weights are buffered per state and labelled when the record closes.
//
// ⭐ THE WEIGHT IS `base weight x clamped supply share`, so dividing by the base weight from
// `common/pop_needs` RECOVERS THE SUPPLY SHARE the game actually used — which is not stored anywhere
// else and cannot be derived from the order book. Emitted as the `share` column.
import { createReadStream, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const TSV = argOf('--tsv', ''), ONLY = argOf('--region', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: melted_state_needs.mjs <melted.txt> [--tsv f] [--region R]'); process.exit(1); }

const strip = s => s.replace(/^\uFEFF/, '');
const GOODS = [];
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')).sort())
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{/gm)) GOODS.push(m[1]);
// base weights per (need, good) — the divisor that turns a purchase weight back into a supply share
const NEEDS = [], BASE = new Map();
for (const m of strip(readFileSync(join(GAME, 'common/pop_needs/00_pop_needs.txt'), 'utf8')).matchAll(/^popneed_([a-z_]*)\s*=\s*\{([\s\S]*?)\n\}/gm)) {
  const need = m[1]; NEEDS.push(need);
  for (const e of m[2].matchAll(/entry\s*=\s*\{([\s\S]*?)\}/g)) {
    const g = /goods\s*=\s*([a-z_]+)/.exec(e[1]), w = /weight\s*=\s*([\d.]+)/.exec(e[1]);
    if (g) BASE.set(need + '|' + g[1], w ? +w[1] : 1);
  }
}

let inStates = false, depth = 0, stateId = null, country = null, region = null;
let inNeeds = false, nd = 0, ent = -1, grp = -1, inW = false, cur = null, buf = [];
const rows = [];
const flush = () => {
  for (const r of buf) rows.push({ state: stateId, country, region, ...r });
  buf = []; stateId = null; country = null; region = null; grp = -1;
};
const rl = createInterface({ input: createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (!inStates) { if (t === 'states={') { inStates = true; depth = 1; } continue; }
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  if (inNeeds) {
    if (t === 'pop_need_entry_data={') { ent = -1; grp++; nd += opens - closes; depth += opens - closes; continue; }
    if (t === 'weights={') { ent++; cur = { group: grp, need: NEEDS[ent] ?? ('e' + ent), w: {} }; inW = true; nd += opens - closes; depth += opens - closes; continue; }
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
    if (t === 'pop_needs={') { inNeeds = true; nd = 1; ent = -1; grp = -1; depth += opens - closes; continue; }
  }
  depth += opens - closes;
  if (depth <= 0) { if (stateId !== null) flush(); inStates = false; }
}
if (stateId !== null) flush();

const sel = ONLY ? rows.filter(r => r.region === ONLY) : rows;
console.log(`states with pop_needs : ${new Set(rows.map(r => r.state)).size}`);
console.log(`named regions         : ${new Set(rows.map(r => r.region).filter(Boolean)).size}`);
console.log(`need entries          : ${rows.length.toLocaleString()}${ONLY ? `   (${ONLY}: ${sel.length})` : ''}`);
if (ONLY && sel.length) {
  const s = sel[0];
  console.log(`\n${ONLY}  state ${s.state}  country ${s.country}   groups ${new Set(sel.map(r => r.group)).size}`);
  for (const need of ['free_movement', 'communication']) {
    const r = sel.find(x => x.need === need); if (!r) continue;
    const parts = Object.entries(r.w).map(([g, v]) => {
      const b = BASE.get(need + '|' + g) ?? 1;
      return `${g} w=${v.toFixed(5)} base=${b} => share ${(v / b).toFixed(4)}`;
    });
    console.log(`  ${need.padEnd(14)} ${parts.join('   ')}`);
    console.log(`  ${''.padEnd(14)} shares sum to ${Object.entries(r.w).reduce((a, [g, v]) => a + v / (BASE.get(need + '|' + g) ?? 1), 0).toFixed(4)}`);
  }
}
if (TSV) {
  const out = ['state\tcountry\tregion\tgroup\tneed\tgood\tweight\tbase\tshare'];
  for (const r of rows) for (const g in r.w) {
    const b = BASE.get(r.need + '|' + g) ?? 1;
    out.push(`${r.state}\t${r.country}\t${r.region ?? ''}\t${r.group}\t${r.need}\t${g}\t${r.w[g]}\t${b}\t${(r.w[g] / b).toFixed(6)}`);
  }
  writeFileSync(TSV, out.join('\n'));
  console.log(`\nwrote ${out.length - 1} rows -> ${TSV}`);
}
