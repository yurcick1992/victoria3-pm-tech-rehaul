// melted_pop_needs.mjs — read the game's OWN computed within-need purchase weights out of a melted save.
//
//   node tools/testbed/melted_pop_needs.mjs <melted.txt> [--need free_movement] [--tsv out.tsv]
//
// ⭐⭐ THIS IS THE QUANTITY EVERY PREVIOUS ARGUMENT HAD TO INFER. F35 established that no pop need has an
// observable budget from the order book, so the within-need split could only be reached by inference from
// money shares. The melted save stores it directly:
//
//   pop_needs = { <id> = { pop_need_entry_data = { { weights = { <good index> = <weight> } } ... } } }
//
// The entry ORDER is `common/pop_needs` definition order (verified: entry 0 = simple_clothing
// [fabric, clothes], 1 = crude_items, 2 = basic_food, 3 = heating — all exact good-set matches), and the
// weight KEYS are indices into `common/goods` definition order. So entry 9 is free_movement and entry 10
// is communication, which is the pair F39 turns on.
//
// ⚠ These are the PURCHASE WEIGHTS (weight x clamped supply share), NOT normalised — the pairs observed
// sum to ~1.7, not 1. Normalising them gives the model's predicted split, which is the thing to compare
// against the panel's observed shares.
//
// ⚠ STREAMED. The melted file is 316 MB of text; do not read it whole.
import { createReadStream, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const GAME = argOf('--game', 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game');
const WANT = argOf('--need', '');
const TSV = argOf('--tsv', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: melted_pop_needs.mjs <melted.txt> [--need X] [--tsv f]'); process.exit(1); }

const strip = s => s.replace(/^\uFEFF/, '');
const GOODS = [];
for (const f of readdirSync(join(GAME, 'common/goods')).filter(x => x.endsWith('.txt')).sort())
  for (const m of strip(readFileSync(join(GAME, 'common/goods', f), 'utf8')).matchAll(/^([a-z][a-z_]*)\s*=\s*\{/gm)) GOODS.push(m[1]);
const NEEDS = [];
for (const m of strip(readFileSync(join(GAME, 'common/pop_needs/00_pop_needs.txt'), 'utf8')).matchAll(/^(popneed_[a-z_]*)\s*=\s*\{/gm))
  NEEDS.push(m[1].replace('popneed_', ''));

// Streaming state machine. Depth is tracked only INSIDE a pop_needs block, where the text is regular.
// ⚠ A BLOCK HOLDS MANY GROUPS, each group holding the 15 needs in order. `group` is the sequence of
// `pop_need_entry_data` blocks within the country block — almost certainly its states. Without it the
// rows cannot be joined across needs, which is exactly what identifying a state requires.
let inNeeds = false, needDepth = 0, blockId = null, entryIdx = -1, groupIdx = -1, inWeights = false, cur = null;
const rows = [];
const rl = createInterface({ input: createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.trim();
  if (!inNeeds) { if (t === 'pop_needs={') { inNeeds = true; needDepth = 1; blockId = null; entryIdx = -1; } continue; }
  // inside pop_needs
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  if (t === 'pop_need_entry_data={') { entryIdx = -1; groupIdx++; needDepth += opens - closes; continue; }
  if (inWeights) {
    const m = /^(\d+)=([\-\d.]+)$/.exec(t);
    if (m) { cur.w[GOODS[+m[1]] ?? ('idx' + m[1])] = +m[2]; }
    else if (t === '}') { inWeights = false; rows.push(cur); cur = null; }
    needDepth += opens - closes; continue;
  }
  if (t === 'weights={') { entryIdx++; cur = { block: blockId, group: groupIdx, need: NEEDS[entryIdx] ?? ('entry' + entryIdx), idx: entryIdx, w: {} }; inWeights = true; needDepth += opens - closes; continue; }
  const idm = /^(\d+)=\{$/.exec(t);
  if (idm && blockId === null) { blockId = +idm[1]; groupIdx = -1; }
  needDepth += opens - closes;
  if (needDepth <= 0) inNeeds = false;
}

const sel = WANT ? rows.filter(r => r.need === WANT) : rows;
console.log(`pop_needs blocks read : ${new Set(rows.map(r => r.block)).size}`);
console.log(`need entries          : ${rows.length.toLocaleString()}${WANT ? `   (showing '${WANT}': ${sel.length})` : ''}`);
const byNeed = new Map();
for (const r of rows) byNeed.set(r.need, (byNeed.get(r.need) || 0) + 1);
console.log(`\nentries per need:`);
for (const [n, c] of [...byNeed.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n.padEnd(20)} ${c}`);

if (sel.length) {
  console.log(`\nsample — RAW purchase weights and the NORMALISED split they imply:`);
  for (const r of sel.slice(0, 8)) {
    const tot = Object.values(r.w).reduce((a, b) => a + b, 0);
    const parts = Object.entries(r.w).map(([g, v]) => `${g} ${v.toFixed(5)} (${(v / tot * 100).toFixed(1)}%)`);
    console.log(`  block ${String(r.block).padStart(4)}  ${parts.join('   ')}`);
  }
}
if (TSV) {
  const out = ['block\tgroup\tneed\tgood\tweight'];
  for (const r of rows) for (const g in r.w) out.push(`${r.block}\t${r.group}\t${r.need}\t${g}\t${r.w[g]}`);
  writeFileSync(TSV, out.join('\n'));
  console.log(`\nwrote ${out.length - 1} rows -> ${TSV}`);
}
