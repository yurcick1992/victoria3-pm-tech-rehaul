// save_market_goods.mjs — per-market, per-good order book straight out of a gamestate.
//
//   node tools/testbed/save_market_goods.mjs <file.gamestate> [--tsv out.tsv]
//
// ⭐ WHY THIS EXISTS, AND WHY IT DOES NOT USE lib_savebin's block parser. The market database lives
// past ~104 MB, where that reader's brace depth drifts (see lib_savebin header). But a globally correct
// parse is not needed: these records are a FIXED, REPEATING FIELD SEQUENCE, so they can be read by
// LOCAL ANCHORING on the good-name field and walking forward a bounded number of tokens. The cursor
// itself never desyncs — 8 814 strings decode cleanly through the break window — it is only the DEPTH
// accounting that is wrong, and this reader does not use depth.
//
// THE RECORD, established by save_dump_records:
//   { 0x00e1 = <enum>  0x304f = "<good>"  0x004d = <enum>  0x2840 = <int>
//     0x008d = { 0x008d = <enum>  0x5982 = <A>  0x301b = <B> }
//     0x27fe = 20000000  0x30c5 = yes }
//
// ⚠ A AND B ARE HYPOTHESES until checked. They are validated against telemetry the run itself logged
// (`market_goods_scoped`), which is an INDEPENDENT instrument — the same discipline that caught F39's
// bad solve. Do not name them buy/sell in output until that check passes.
//
// ⚠⚠ STATUS 2026-08-06: THE VALIDATION FAILS, AND THAT IS THE USEFUL RESULT. The best-matching block
// gives transportation 26 298 / 23 809 against a telemetry buy/sell of 27 952 / 32 501, automobiles
// 7 940 / 7 188 against 9 466 / 5 352. A and B track each other far too closely to be an order book —
// across all 4 854 records B/A has mean 1.029 and never leaves 0.50–1.45, where real buy/sell diverge
// hard. So THESE ARE NOT MARKET ORDERS and the file is misnamed until they are identified.
//
// ⭐ WHAT THEY ALMOST CERTAINLY ARE: the goods present are **34 of the 35 goods that appear in
// `common/pop_needs`, and nothing else** — the sole absentee is `radios`, which plausibly has zero
// everywhere at 1925. A record set whose good list is exactly the pop-needs universe is pop-side data
// (demand and satisfied demand, or units and money), not a market inventory. 177 blocks of ~30 goods.
// ⇒ NEXT: identify A and B against a pop quantity we can compute independently — the three Midlands /
// Cornwall / Lowlands pops read in-game are the natural anchors, since their per-need money and unit
// splits are known exactly. Until then this tool REPORTS but does not INTERPRET.
import { openSync, readSync, closeSync, statSync, existsSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const SRC = args.find(a => !a.startsWith('--'));
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TSV = argOf('--tsv', '');
if (!SRC || !existsSync(SRC)) { console.error('usage: save_market_goods.mjs <file.gamestate> [--tsv f]'); process.exit(1); }

const T_NAME = 0x304f, T_A = 0x5982, T_B = 0x301b, T_END = 0x30c5;
const fd = openSync(SRC, 'r'), SZ = statSync(SRC).size;
const CH = 1 << 22;
let buf = Buffer.alloc(CH), base = 0, len = 0, pos = 0;
const need = n => {
  if (pos + n <= len) return true;
  const keep = len - pos; buf.copy(buf, 0, pos, len); base += pos;
  len = keep + readSync(fd, buf, keep, CH - keep, base + keep); pos = 0;
  return len >= n;
};
function item() {
  if (!need(2)) return null;
  const t = buf.readUInt16LE(pos); pos += 2;
  switch (t) {
    case 0x000C: if (!need(4)) return null; { const v = buf.readInt32LE(pos); pos += 4; return { t, v }; }
    case 0x0014: if (!need(4)) return null; { const v = buf.readUInt32LE(pos); pos += 4; return { t, v }; }
    case 0x000D: if (!need(4)) return null; { const v = buf.readInt32LE(pos) / 100000; pos += 4; return { t, v }; }
    case 0x000E: if (!need(1)) return null; { const v = !!buf[pos]; pos += 1; return { t, v }; }
    case 0x0167: if (!need(8)) return null; { const v = Number(buf.readBigInt64LE(pos)); pos += 8; return { t, v }; }
    case 0x0290: if (!need(8)) return null; { const v = Number(buf.readBigInt64LE(pos)) / 100000; pos += 8; return { t, v }; }
    case 0x000F: case 0x0017: {
      if (!need(2)) return null; const n = buf.readUInt16LE(pos); pos += 2;
      if (!need(n)) return null; const v = buf.toString('latin1', pos, pos + n); pos += n; return { t, v };
    }
    default: return { t };
  }
}

// Scan for the good-name field, then walk forward a bounded window for the two numbers. Bounded so a
// malformed record can never swallow the rest of the file looking for a field that is not coming.
// ⚠ A NAME TOKEN IS FOLLOWED BY '=' THEN THE VALUE — not by the value directly. Reading the '=' as
// the value yielded ZERO records and no error, which is this project's recurring failure shape.
// So: remember the last name token, and assign the next item that actually carries a value.
const recs = [];
let cur = null, since = 0, lastName = null;
while (base + pos < SZ) {
  const at = base + pos;
  const it = item(); if (!it) break;
  if (it.t === 0x0001) continue;                        // '='
  if (!('v' in it)) {                                   // a name token (or a brace)
    lastName = it.t;
    if (it.t === T_END && cur) { if (cur.a !== null && cur.b !== null) recs.push(cur); cur = null; }
    else if (cur && ++since > 30) cur = null;           // bounded window
    continue;
  }
  if (lastName === T_NAME && typeof it.v === 'string') { cur = { good: it.v, at, a: null, b: null }; since = 0; continue; }
  if (!cur) continue;
  if (++since > 30) { cur = null; continue; }
  if (lastName === T_A && typeof it.v === 'number') cur.a = it.v;
  else if (lastName === T_B && typeof it.v === 'number') cur.b = it.v;
}
closeSync(fd);

// Records for one market are contiguous, so a repeat of a good name starts a new market.
let market = 0; const seen = new Set();
for (const r of recs) { if (seen.has(r.good)) { market++; seen.clear(); } seen.add(r.good); r.market = market; }
const markets = market + 1;

console.log(`records      : ${recs.length.toLocaleString()}  over ${markets.toLocaleString()} contiguous market blocks`);
const goods = new Set(recs.map(r => r.good));
console.log(`distinct goods: ${goods.size}`);
const per = new Map();
for (const r of recs) per.set(r.market, (per.get(r.market) || 0) + 1);
const sizes = [...per.values()].sort((a, b) => b - a);
console.log(`goods per market: max ${sizes[0]}  median ${sizes[sizes.length >> 1]}  min ${sizes[sizes.length - 1]}`);

// ⚠ VALIDATION against an INDEPENDENT instrument, not against itself. GBR at 1925.1.1 from
// `market_goods_scoped` telemetry, run003: transportation A/B, automobiles, telephones.
const EXPECT = { transportation: [27952.28, 32501.27], automobiles: [9465.61, 5351.84], telephones: [2222.65, 1479.72] };
console.log(`\nVALIDATION — looking for the market block matching GBR 1925.1.1 telemetry`);
let best = null;
for (const [m] of per) {
  const byGood = new Map(recs.filter(r => r.market === m).map(r => [r.good, r]));
  let score = 0, n = 0;
  for (const g in EXPECT) {
    const r = byGood.get(g); if (!r) continue;
    const [x, y] = EXPECT[g];
    const fit = Math.min(...[[r.a, r.b], [r.b, r.a]].map(([p, q]) => Math.abs(p - x) / x + Math.abs(q - y) / y));
    score += fit; n++;
  }
  if (n === Object.keys(EXPECT).length && (!best || score < best.score)) best = { m, score, byGood };
}
if (!best) console.log('  no market block carries all three goods — the record model needs revisiting');
else {
  console.log(`  best match: block #${best.m}   total relative error ${best.score.toFixed(3)}`);
  console.log(`  good              save A        save B     telemetry buy   telemetry sell`);
  for (const g in EXPECT) {
    const r = best.byGood.get(g);
    console.log(`  ${g.padEnd(16)}${String(r.a).padStart(10)}${String(r.b).padStart(13)}${String(EXPECT[g][0]).padStart(16)}${String(EXPECT[g][1]).padStart(16)}`);
  }
  console.log(`  ⇒ ${best.score < 0.05 ? 'MATCH — the two fields are the order book, and the market is identified'
    : 'NO MATCH — do not name these fields buy/sell; the record model or the market grouping is wrong'}`);
}

if (TSV) {
  writeFileSync(TSV, ['market\tgood\tA\tB', ...recs.map(r => `${r.market}\t${r.good}\t${r.a}\t${r.b}`)].join('\n'));
  console.log(`\nwrote ${recs.length.toLocaleString()} rows -> ${TSV}`);
}
