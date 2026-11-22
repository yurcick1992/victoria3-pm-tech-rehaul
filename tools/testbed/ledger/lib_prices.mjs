// PRICES BY GOODS CLASS — ONE DEFINITION for the ledger's price panel (fill_prices.mjs) and the register's industry-price term (criteria.mjs)
// (BALANCE_FRAMEWORK §10.128; FINDINGS F285 §5–§7). Price ÷ base price at every market dump of a run's `markets.tsv`.
// ⭐ A market-good reading counts only where BOTH sides trade (buy and sell orders above 0.5): a price parked on its 25% / 175% band edge with
//   one side empty is not a price (CLAUDE.md §2.7).
// ⭐ A class's index in one market = the geometric mean of price ÷ base over its goods read there; the AGGREGATE of one run = the median over
//   the markets read that year (the eight instrumented markets as SERIES, lib_markets.mjs: German PRU → NGF → GER, Dutch NET → UNL, French with
//   the Commune). The run's OWN markets: no intersection with vanilla's, since a price fall is an aim of the mod's own (§10.128).
// ⚠ The CLASSES are Claude's grouping of the user's five expectations (F285 §5); military goods, ships and the local goods are in none.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seriesOf } from './lib_markets.mjs';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const CLASSES = {
  industry: { label: 'Scalable industry output', expect: 'clearly down', main: true,
    goods: ['groceries', 'clothes', 'furniture', 'glass', 'paper', 'tools', 'steel', 'engines', 'fertilizer', 'explosives', 'automobiles', 'telephones', 'radios'] },
  staples: { label: 'Staple food and raw materials', expect: 'about flat', goods: ['grain', 'fish', 'meat', 'fruit', 'wood', 'hardwood', 'fabric', 'iron', 'lead', 'sulfur', 'copper'] },
  fuels: { label: 'Coal and oil', expect: 'swinging, no trend', goods: ['coal', 'oil'] },
  rubber: { label: 'Rubber', expect: 'up', goods: ['rubber'] },
  luxury: { label: 'Plantation goods and luxuries', expect: 'slightly down',
    goods: ['sugar', 'tea', 'coffee', 'tobacco', 'opium', 'silk', 'dye', 'wine', 'liquor', 'porcelain', 'luxury_clothes', 'luxury_furniture', 'fine_art'] },
};
export const YEARS = [1836, 1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1935];
export const MARKETS = [['British Market', 'Britain'], ['American Market', 'the USA'], ['French Market', 'France'], ['German Market', 'Germany (Prussia before it)'],
  ['Russian Market', 'Russia'], ['Japanese Market', 'Japan'], ['Dutch Market', 'the Netherlands'], ['Belgian Market', 'Belgium']];
export const SERIES = MARKETS.map(m => m[0]);
export const BASE = Object.fromEntries(readFileSync(join(REPO, 'tools', 'goods_prices.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#'))
  .map(l => l.split('\t')).map(([g, p]) => [g.trim(), +p]));
for (const c of Object.values(CLASSES)) for (const g of c.goods) if (!BASE[g]) throw new Error('lib_prices: no base price for ' + g + ' in tools/goods_prices.tsv');

const fin = Number.isFinite;
export const med = a => { const s = a.filter(fin).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const gmean = a => { const s = a.filter(x => fin(x) && x > 0); return s.length ? Math.exp(s.reduce((x, y) => x + Math.log(y), 0) / s.length) : NaN; };

/** one run's markets.tsv → { P: year → series → good → price ÷ base (both sides trading), kept, oneSided }, or null without the file */
export function readMarketRun(runDir) {
  const f = join(runDir, 'markets.tsv'); if (!existsSync(f)) return null;
  const P = {}; let kept = 0, oneSided = 0;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const c = line.split('\t'); if (c.length < 8 || c[0] === 'run') continue;
    const y = +String(c[1]).split('.')[0]; if (!YEARS.includes(y)) continue;
    const ser = seriesOf(c[2]); if (!SERIES.includes(ser)) continue;
    const g = c[4], buy = +c[5], sell = +c[6], p = +c[7]; if (!BASE[g] || !(p > 0)) continue;
    if (!(buy > 0.5 && sell > 0.5)) { oneSided++; continue; }
    ((P[y] ||= {})[ser] ||= {})[g] = p / BASE[g]; kept++;
  }
  return { P, kept, oneSided };
}
/** a class's index in one market and year (the geometric mean over its goods read there) */
export const classIndex = (P, k, ser, y) => gmean(CLASSES[k].goods.map(g => P[y]?.[ser]?.[g]));
/** one run's aggregate path of a class: YEARS → the median over the markets read that year */
export const aggPath = (P, k) => YEARS.map(y => med(SERIES.map(ser => classIndex(P, k, ser, y))));
/** ⭐ THE REGISTER'S INDUSTRY-PRICE TERM's reading (§10.128, user-ruled 2026-11-22: "Aggregate fall, ~25%"): one run's industry-output
 *  aggregate in 1935 ÷ its aggregate in 1900; NaN when either is missing */
export const IND_FROM = 1900, IND_TO = 1935;
export function industryFall(P) { const p = aggPath(P, 'industry'); const a = p[YEARS.indexOf(IND_FROM)], b = p[YEARS.indexOf(IND_TO)]; return { path: p, ratio: fin(a) && fin(b) && a > 0 ? b / a : NaN }; }
