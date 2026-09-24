// THE PER-GOOD TRADE BOOK — a base config + `goods_traded_quantity`, from the five-class case of FINDINGS F159 §7.
//
//   node tools/make_trade_config.mjs --base config/mod_config.canon-slide-b158.json --suffix canon-slide-b158-trade
//
// Writes config/mod_config.<suffix>.json (the base, byte-for-byte in every other key, plus `goods_traded_quantity`,
// `_trade` and `_trade_variant`) and its tech-tree twin config/tech_tree_options.<suffix>.json (landmine L20), copied from
// the BASE's own twin. It is the only place the class table lives; emit_goods.mjs applies whatever the config says.
//
// THE CASE (F159, user-approved 2026-09-23 "Implement this"): W = cost × traded_quantity is the base-price £ one unit
// of Trade Capacity moves. Vanilla holds W ~240 for every good, i.e. a ~25% importer–exporter wedge for every good —
// historically the BULK wedge. So the bulk class keeps vanilla's values exactly (the untreated group), and each class
// about 2.4× cheaper to ship per £ gets √2 more W, capped at 4: E 1 · D √2 · C 2 · B 2√2 · A 4 (× 240).
// ⭐ The traded_quantity is DERIVED from the game's own base price (read live), W_class ÷ cost, so a patch that
// re-prices a good keeps its W, and a patch that ADDS a tradeable good makes this THROW until it is classed.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'config/mod_config.canon-slide-b158.json');
const SFX = argOf('--suffix', null);
if (!SFX) { console.error('usage: node tools/make_trade_config.mjs --base <config> --suffix <suffix> [--scale k] [--ruled-by "…"]'); process.exit(2); }
const die = m => { throw new Error('make_trade_config: ' + m); };
// ⭐ --scale k (user-approved 2026-09-24, "OK on general trade correction volume"): EVERY good's W × k, the bulk class
// included (its vanilla traded_quantity × k), on top of the class table — trade raised across the board. At k = 1 the
// output is byte-identical to the unscaled book (proven when the flag was added), so the first trade arm stays reproducible.
const SCALE = +argOf('--scale', '1');
if (!(SCALE >= 1)) die(`--scale must be >= 1 (got ${argOf('--scale', '1')})`);
const RULED_BY = argOf('--ruled-by', null);

const W0 = 240;
const CLASSES = {
  A: { name: 'precious & self-delivering (trade cost <= 1% of value)', weight: 4,
       goods: ['silk', 'opium', 'dye', 'rubber', 'luxury_clothes', 'fine_art', 'clippers', 'steamers'] },
  B: { name: 'compact high-value (1.5-3%)', weight: 2 * Math.SQRT2,
       goods: ['tea', 'small_arms', 'telephones', 'radios', 'tanks'] },
  C: { name: 'manufactures & colonial staples (4-6%)', weight: 2,
       goods: ['clothes', 'tools', 'engines', 'coffee', 'tobacco', 'liquor', 'porcelain', 'artillery', 'ammunition', 'automobiles', 'aeroplanes', 'luxury_furniture'] },
  D: { name: 'semi-bulk (8-15%)', weight: Math.SQRT2,
       goods: ['fabric', 'sugar', 'lead', 'steel', 'groceries', 'paper', 'wine', 'hardwood', 'glass', 'explosives'] },
  E: { name: 'bulk & perishable (>= 20%) - UNCHANGED, vanilla values', weight: null,
       goods: ['coal', 'wood', 'iron', 'fertilizer', 'meat', 'fruit', 'fish', 'sulfur', 'grain', 'oil', 'furniture'] },
};
const EXCLUDED = { merchant_marine: 'the good trade centres consume - changing it reshapes capacity supply itself; a separate lever',
                   manowars: 'deprecated', ironclads: 'deprecated' };

// the game's goods: cost, local, tradeable — read live
const src = readFileSync(join(GAME, 'common/goods/00_goods.txt'), 'utf8').replace(/^\uFEFF/, '');
const G = {}; let cur = null, depth = 0;
for (const l of src.split(/\r?\n/)) {
  const c = l.replace(/"[^"\n]*"/g, '""').replace(/#.*$/, ''); let m;
  if (depth === 0 && (m = /^([a-z_][a-z_0-9]*)\s*=\s*\{/.exec(c))) { cur = m[1]; G[cur] = { cost: null, local: false, tradeable: true }; }
  else if (cur && depth === 1) {
    if ((m = /^\s*cost\s*=\s*([\d.]+)/.exec(c))) G[cur].cost = +m[1];
    if ((m = /^\s*traded_quantity\s*=\s*([\d.]+)/.exec(c))) G[cur].tq = +m[1];
    if (/^\s*local\s*=\s*yes\b/.test(c)) G[cur].local = true;
    if (/^\s*tradeable\s*=\s*no\b/.test(c)) G[cur].tradeable = false;
  }
  for (const ch of c) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth === 0) cur = null;
}
const tradeable = Object.keys(G).filter(g => !G[g].local && G[g].tradeable);
const seen = new Map();
for (const [k, c] of Object.entries(CLASSES)) for (const g of c.goods) {
  if (!G[g]) die(`class ${k} names '${g}', which the game does not define`);
  if (seen.has(g)) die(`'${g}' is in classes ${seen.get(g)} and ${k}`);
  seen.set(g, k);
}
for (const g of tradeable) if (!seen.has(g) && !EXCLUDED[g]) die(`tradeable good '${g}' is in no class and not excluded - class it (FINDINGS F159 §7)`);

const tq = {};
for (const [k, c] of Object.entries(CLASSES)) {
  if (c.weight === null) {
    if (SCALE === 1) continue;                       // the untreated class keeps vanilla's line, and is not written at all
    for (const g of c.goods) { if (!(G[g].tq > 0)) die(`bulk good '${g}' has no vanilla traded_quantity to scale`); tq[g] = +(G[g].tq * SCALE).toFixed(2); }
    continue;
  }
  for (const g of c.goods) tq[g] = +(c.weight * W0 * SCALE / G[g].cost).toFixed(2);
}

const basePath = join(REPO, BASE);
const baseRaw = readFileSync(basePath, 'utf8');
const cfg = JSON.parse(baseRaw);
if (cfg.goods_traded_quantity) die(`the base already carries goods_traded_quantity`);
cfg.goods_traded_quantity = tq;
cfg._trade = {
  source: 'FINDINGS F159 §7 (the case), F155 (the mechanism)',
  rule: 'W = cost x traded_quantity; class weights x 240: E unchanged (vanilla) / D sqrt2 / C 2 / B 2sqrt2 / A 4 (cap)',
  classes: Object.fromEntries(Object.entries(CLASSES).map(([k, c]) => [k, { name: c.name, weight: c.weight === null ? 'vanilla' : +c.weight.toFixed(4), goods: c.goods }])),
  excluded: EXCLUDED,
  first_order_level: 'x2.29 base-GBP per unit of capacity at the vanilla 1901 allocation, before any reallocation (F159 §7)',
};
if (SCALE !== 1) cfg._trade.scale = { k: SCALE, rule: `every good's W x ${SCALE}, the bulk class (E) included: vanilla traded_quantity x ${SCALE}` };
const cmd = `node tools/make_trade_config.mjs --base ${BASE} --suffix ${SFX}` + (SCALE !== 1 ? ` --scale ${SCALE}` : '') + (RULED_BY ? ` --ruled-by "${RULED_BY}"` : '');
const baseName = basename(BASE);
// its own key, so the base's `_variant` (the record of how the base itself was made) survives untouched
cfg._trade_variant = {
  name: SFX, base: BASE,
  base_sha256: createHash('sha256').update(baseRaw).digest('hex'),
  ruled_by: RULED_BY ?? 'user 2026-09-23: "Good. Implement this and go with n=4. Everything except the trade changes are current canon."',
  delta: SCALE === 1
    ? 'goods_traded_quantity only (35 goods; the 11 bulk goods, merchant_marine and the untradeable/local goods keep vanilla values)'
    : `goods_traded_quantity only (46 goods: the class table x ${SCALE}, the 11 bulk goods at vanilla x ${SCALE}; merchant_marine and the untradeable/local goods keep vanilla values)`,
  command: cmd,
};
const outCfg = join(REPO, 'config', `mod_config.${SFX}.json`);
writeFileSync(outCfg, JSON.stringify(cfg), 'utf8');

// the L20 twin: the BASE's tech tree, verbatim
const baseTwin = baseName === 'mod_config.json' ? 'tech_tree_options.json' : baseName.replace(/^mod_config\./, 'tech_tree_options.');
const twinSrc = join(REPO, 'config', baseTwin);
if (!existsSync(twinSrc)) die(`the base's tech-tree twin ${baseTwin} does not exist`);
copyFileSync(twinSrc, join(REPO, 'config', `tech_tree_options.${SFX}.json`));

console.log(`wrote config/mod_config.${SFX}.json (+ config/tech_tree_options.${SFX}.json from ${baseTwin})${SCALE !== 1 ? `  — every W x ${SCALE}` : ''}`);
for (const [k, c] of Object.entries(CLASSES)) {
  console.log(`  ${k} ${c.weight === null ? 'vanilla ' : ('x' + c.weight.toFixed(2)).padEnd(8)} ${c.name}`);
  console.log('     ' + c.goods.map(g => tq[g] === undefined ? `${g} (W ${G[g].cost * G[g].tq})` : `${g} ${tq[g]} (W ${Math.round(tq[g] * G[g].cost)})`).join(' · '));
}
