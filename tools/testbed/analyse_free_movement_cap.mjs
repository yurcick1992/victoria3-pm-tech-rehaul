// analyse_free_movement_cap.mjs — is a debut good's demand just the COMPLEMENT of its rival's cap?
//
//   node tools/testbed/analyse_free_movement_cap.mjs --session <dir> [--market "British Market"]
//
// THE ARGUMENT (user, 2026-08-06). `popneed_free_movement` has exactly two goods:
//     transportation  w1.00  max_supply_share 0.75   (min 0)
//     automobiles     w1.25  max_supply_share 1.00   (min 0)
// F31/F33 checked that automobiles carry no `min_supply_share` and concluded a debut good's demand
// spike cannot be a floor effect. That answered the wrong question: **in a TWO-good need, capping the
// incumbent at 0.75 IS a 0.25 floor on the other good.** It is exactly why the final-share reading
// ("reading B") puts automobiles at 25.00% — the complement of transportation's cap, not a coincidence.
//
// ⭐ THE TEST NEEDS NO BUDGET, ONLY AN INEQUALITY BETWEEN TWO MEASURED NUMBERS — which is what makes it
// stronger than F33's version. If the cap binds, transportation takes 0.75 of the need and automobiles
// 0.25, so the need alone implies
//     transportation_pop_money(free_movement) = 3 × automobiles_pop_money.
// `transportation` also sits in `popneed_communication`, so its measured TOTAL pop money is an UPPER
// BOUND on its free_movement part. Therefore:
//     measured transportation pop money < 3 × measured automobiles pop money  ⇒  READING B REFUTED,
// because the free_movement part alone would have to exceed the total across both needs. The
// unobservable budget never enters. (Reading A implies a far larger multiple still, so the same
// measurement bounds it too — see the ratio printed per date.)
//
// ⚠ MONEY, NOT UNITS. Shares inside a need are shares of MONEY, and these goods have different base
// prices, so units would silently answer a different question.
// ⚠ Both goods must be VERIFIED at the SAME market and date. Every dump is partially truncated at a
// different good (lib_breakdown rule 6), so a date carrying only one of them proves nothing and is
// skipped rather than paired against a neighbouring date.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buyOrderTable, readBreakdown } from './lib_breakdown.mjs';
import { REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
const MARKET  = argOf('--market', '');
if (!SESSION) { console.error('usage: analyse_free_movement_cap.mjs --session <dir> [--market M]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));

// base prices, read from the game so a patch cannot rot this
const GAME = process.env.VIC3_GAME || 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Victoria 3\\game';
const goodsTxt = readFileSync(join(GAME, 'common', 'goods', '00_goods.txt'), 'utf8').replace(/^\uFEFF/, '');
const price = {}; let g = null;
for (const raw of goodsTxt.split(/\r?\n/)) {
  const l = raw.trim(); let m;
  if ((m = l.match(/^([a-z0-9_]+)\s*=\s*\{/))) g = m[1];
  else if ((m = l.match(/^cost\s*=\s*([0-9.]+)/)) && g) price[g] = +m[1];
}
const PT = price.transportation, PA = price.automobiles;
console.log(`base prices: transportation £${PT}  automobiles £${PA}`);
console.log(`free_movement: transportation w1 max0.75 · automobiles w1.25 max1.0 — two goods, so the`);
console.log(`incumbent's 0.75 cap is a 0.25 floor on the newcomer. If it binds: transportation money = 3x automobiles money.\n`);

const runs = readdirSync(SDIR).filter(d => /^run\d+_/.test(d)).sort();
const cell = new Map();   // "market\tdate" -> {transportation, automobiles, telephones}
for (const r of runs) {
  const dir = join(SDIR, r), metaP = join(dir, 'meta.json');
  if (!existsSync(metaP)) continue;
  const meta = JSON.parse(readFileSync(metaP, 'utf8'));
  const log = join(dir, 'logs_live', 'debug.log');
  if (!existsSync(log)) continue;
  const buyOf = await buyOrderTable(log, meta.token);
  const { blocks, stats } = await readBreakdown(log, meta.token, buyOf);
  if (!blocks.length) continue;
  console.error(`  ${r}: ${stats.ok} verified blocks`);
  for (const b of blocks) {
    if (!['transportation', 'automobiles', 'telephones'].includes(b.good)) continue;
    if (MARKET && b.market !== MARKET) continue;
    // ⚠⚠ KEY BY RUN. Runs of one session are DIFFERENT CAMPAIGNS — different seeds, and measurably
    // different histories: F33 recorded the automobile debut nine years apart between these two
    // (1901.6 against 1910.12). Unioning them across runs pairs one campaign's automobiles with
    // another's transportation and produces arithmetic about an economy that never existed. Caught
    // when a "pop demand" of 2770 units turned up against total buy orders of 289 — pop demand cannot
    // exceed the whole market's buy orders, which is what said the pairing was wrong.
    const k = `${r}\t${b.market}\t${b.date}`;
    if (!cell.has(k)) cell.set(k, {});
    const c = cell.get(k);
    c[b.good] = Math.max(c[b.good] ?? 0, b.pop);
  }
}

const rows = [];
for (const [k, c] of [...cell.entries()].sort()) {
  if (c.transportation == null || c.automobiles == null) continue;   // need BOTH, same tick
  if (!(c.automobiles > 0)) continue;                                // no debut good yet — nothing to test
  const [run, market, date] = k.split('\t');
  const moneyT = c.transportation * PT, moneyA = c.automobiles * PA;
  const ratio = moneyT / moneyA;                 // reading B (cap binding) requires EXACTLY 3, at most
  rows.push({ run, market, date,
              auto_units: +c.automobiles.toFixed(1), transp_units: +c.transportation.toFixed(1),
              auto_GBP: Math.round(moneyA), transp_GBP: Math.round(moneyT),
              'transp/auto money': +ratio.toFixed(2),
              'B needs >= 3': ratio >= 3 ? 'ok' : 'REFUTED' });
}

if (!rows.length) {
  console.log('No date has BOTH transportation and automobiles verified with automobiles > 0.');
  console.log('That is the truncation limit, not a result — do not read it as either reading surviving.');
  process.exit(0);
}
console.table(rows);
const bad = rows.filter(r => r['B needs >= 3'] === 'REFUTED').length;
console.log(`\n${'='.repeat(78)}`);
console.log(`  dates where BOTH goods were verified : ${rows.length}`);
console.log(`  dates where measured transportation money < 3x automobiles money : ${bad}`);
console.log(`${'='.repeat(78)}`);
console.log(bad
  ? `  ⇒ On ${bad} date(s) the cap CANNOT be binding: transportation's free_movement share alone would\n    have to exceed its measured total across BOTH its needs. The 0.25-complement explanation fails there.`
  : `  ⇒ Every date is consistent with the cap binding. NOT proof that it does — transportation's other\n    need (communication) can absorb any excess, so ratio >= 3 is necessary, never sufficient.`);
