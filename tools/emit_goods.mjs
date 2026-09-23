// THE PER-GOOD TRADE WEIGHT — `traded_quantity` in common/goods/00_goods.txt (FINDINGS F155 / F159).
//
//   node tools/emit_goods.mjs <modRoot> [configPath]        # called by tools/build.ps1
//
// WHAT IT CONTROLS. One unit of a trade centre's Trade Capacity moves `traded_quantity` units of a good
// (× the trade-centre quantity multiplier), and the merchant marine a trade centre consumes is per LEVEL, not per
// unit moved (F155). So `cost × traded_quantity` — W, the base-price £ one unit of capacity moves — is the good's
// in-game ease of trade: in a capacity-bound market the price wedge that survives between markets goes as 1/W.
// Vanilla holds W at ~240 for every good (200–300), which prices every good's trade like grain (F159).
//
// CONFIG. Top-level `goods_traded_quantity` = { <good>: <traded_quantity> }. Absent or empty → nothing is
// emitted and vanilla's file stands (the canon). Present → a WHOLE-FILE replacement of vanilla's
// common/goods/00_goods.txt in which exactly those goods' `traded_quantity` values differ; every other byte is
// vanilla's, including the ORDER of the goods, which is load-bearing: a save keys goods by their position in
// this file (trade.goods.<n>, world_market.price_trend.channels.<n>).
//
// THROWS on: a good this file does not define; a `local = yes` or `tradeable = no` good (the value would do
// nothing); a good whose block has no `traded_quantity` line (its value comes from GOODS_DEFAULT_TRADE_QUANTITY —
// today exactly the four local/untradeable goods, so this cannot happen without a patch); a value below 1.0
// (the limited trade-quantity method halves it, and MINIMUM_GOODS_TRADED_QUANTITY floors the result at 0.5).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_goods.mjs <modRoot> [configPath]'); process.exit(2); }
const CFGPATH = process.argv[3] || join(REPO, 'config/mod_config.json');
const CFG = JSON.parse(readFileSync(CFGPATH, 'utf8'));
const TQ = CFG.goods_traded_quantity;
const die = msg => { throw new Error('emit_goods: ' + msg); };
if (!TQ || !Object.keys(TQ).length) { console.log('goods: vanilla (no goods_traded_quantity) - nothing emitted'); process.exit(0); }

const REL = 'common/goods/00_goods.txt';
const SRC = join(GAME, REL);
if (!existsSync(SRC)) die(`vanilla ${REL} not found at ${SRC}`);
const raw = readFileSync(SRC, 'utf8');
const BOM = raw.charCodeAt(0) === 0xFEFF ? '\uFEFF' : '';
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);

// one pass: depth by brace count on the comment-stripped line; a good opens at depth 0
const code = l => l.replace(/"[^"\n]*"/g, '""').replace(/#.*$/, '');
const info = {};                 // good -> { cost, tqLine, local, untradeable }
let depth = 0, cur = null;
lines.forEach((l, i) => {
  const c = code(l);
  let m;
  if (depth === 0 && (m = /^([a-z_][a-z_0-9]*)\s*=\s*\{/.exec(c))) { cur = m[1]; info[cur] = { cost: null, tqLine: null, local: false, untradeable: false }; }
  else if (cur && depth === 1) {
    if ((m = /^\s*cost\s*=\s*([\d.]+)/.exec(c))) info[cur].cost = +m[1];
    else if (/^\s*traded_quantity\s*=/.test(c)) { if (info[cur].tqLine !== null) die(`${cur} has two traded_quantity lines`); info[cur].tqLine = i; }
    else if (/^\s*local\s*=\s*yes\b/.test(c)) info[cur].local = true;
    else if (/^\s*tradeable\s*=\s*no\b/.test(c)) info[cur].untradeable = true;
  }
  for (const ch of c) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth < 0) die(`unbalanced braces at line ${i + 1}`);
  if (depth === 0) cur = null;
});
if (depth !== 0) die('unbalanced braces at end of file');

const fmt = v => String(+v.toFixed(2));
const out = lines.slice();
const report = [];
for (const [g, v] of Object.entries(TQ)) {
  const x = info[g];
  if (!x) die(`'${g}' is not a good in ${REL}`);
  if (x.local || x.untradeable) die(`'${g}' is ${x.local ? 'local' : 'not tradeable'} — a traded_quantity would do nothing`);
  if (x.tqLine === null) die(`'${g}' has no traded_quantity line (it takes GOODS_DEFAULT_TRADE_QUANTITY) — add the line deliberately, do not guess it`);
  if (!(typeof v === 'number' && isFinite(v) && v >= 1)) die(`'${g}' traded_quantity must be a number >= 1 (got ${v})`);
  const old = +/traded_quantity\s*=\s*([\d.]+)/.exec(code(lines[x.tqLine]))[1];
  const indent = /^\s*/.exec(lines[x.tqLine])[0];
  out[x.tqLine] = `${indent}traded_quantity = ${fmt(v)} # pm_tech_rehaul: vanilla ${fmt(old)}; W = cost x traded_quantity ${fmt(x.cost * old)} -> ${fmt(x.cost * v)} (FINDINGS F159)`;
  report.push({ g, old, v, Wold: x.cost * old, Wnew: x.cost * v });
}
// every line we did not mean to touch is vanilla's, byte for byte
const touched = new Set(Object.keys(TQ).map(g => info[g].tqLine));
lines.forEach((l, i) => { if (!touched.has(i) && out[i] !== l) die(`line ${i + 1} changed unexpectedly`); });
if (out.length !== lines.length) die('line count changed');

const dst = join(MOD, REL);
mkdirSync(dirname(dst), { recursive: true });
writeFileSync(dst, BOM + out.join(eol), 'utf8');
report.sort((a, b) => b.Wnew / b.Wold - a.Wnew / a.Wold);
console.log(`goods: traded_quantity overridden on ${report.length} goods -> ${REL} (whole-file replacement; every other line vanilla's)`);
console.log('  ' + report.map(r => `${r.g} ${fmt(r.old)}->${fmt(r.v)} (W ${fmt(r.Wold)}->${fmt(r.Wnew)})`).join(' · '));
