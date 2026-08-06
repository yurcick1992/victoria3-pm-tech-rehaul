// floor_or_formula.mjs — is the observed share max(25 %, reading A), as a 25 % FLOOR would imply?
//
//   node tools/testbed/floor_or_formula.mjs --session <dir> [--market "British Market"]
//
// THE HYPOTHESIS (user, 2026-08-06, refined twice): the final-share cap acts as a FLOOR. A newcomer
// climbs to 25 % of its need and sits there for as long as the ordinary supply-share formula would give
// it LESS than that — and once the formula overtakes 25 %, the formula takes over and the share rises
// above it. So the prediction is
//                       share  =  max( 25 % , reading A )
// and an overshoot past 25 % is NOT evidence against the floor, PROVIDED reading A has itself risen
// past 25 % by then. My earlier "it overshoots, therefore no floor" argument ignored that, and this
// tool exists to test it properly rather than assert it.
//
// READING A IS COMPUTED GENEROUSLY, i.e. in whatever way makes it LARGEST, so the hypothesis gets its
// best case:
//   * from SELL ORDERS alone, with no −0.5 × non-pop correction. That correction is measured to reduce
//     automobiles' share (9.40 % against 12.23 % at 1915), so omitting it flatters reading A.
//   * transportation clamped at its 0.75 `max_supply_share`, automobiles unclamped (their max is 1.0).
//        A_auto = 1.25·s_auto / ( min(s_transp, 0.75) + 1.25·s_auto )
// If even the generous A stays below the observed share, the floor-plus-formula story cannot explain it.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buyOrderTable, readBreakdown } from './lib_breakdown.mjs';
import { REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
const MARKET  = argOf('--market', 'British Market');
if (!SESSION) { console.error('usage: floor_or_formula.mjs --session <dir> [--market M]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));
const PT = 30, PA = 100, FT_LO = 0.617, FT_HI = 0.676;

for (const r of readdirSync(SDIR).filter(d => /^run\d+_/.test(d)).sort()) {
  const dir = join(SDIR, r), metaP = join(dir, 'meta.json'), log = join(dir, 'logs_live', 'debug.log');
  const tsv = join(dir, 'markets.tsv');
  if (!existsSync(metaP) || !existsSync(log) || !existsSync(tsv)) continue;
  const meta = JSON.parse(readFileSync(metaP, 'utf8'));
  const buyOf = await buyOrderTable(log, meta.token);
  const { blocks } = await readBreakdown(log, meta.token, buyOf);
  const fAby = new Map();
  for (const b of blocks) if (b.market === MARKET && b.good === 'automobiles' && b.total > 0)
    fAby.set(b.date, b.pop / b.total);
  if (!fAby.size) continue;
  const mk = new Map();
  const lines = readFileSync(tsv, 'utf8').split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split('\t');
    if (c.length < 8 || c[2] !== MARKET) continue;
    if (c[4] !== 'transportation' && c[4] !== 'automobiles') continue;
    if (!mk.has(c[1])) mk.set(c[1], {});
    mk.get(c[1])[c[4]] = { buy: parseFloat(c[5]), sell: parseFloat(c[6]) };
  }
  const rows = [];
  for (const [date, fA] of [...fAby.entries()].sort()) {
    const v = mk.get(date);
    if (!v || !v.transportation || !v.automobiles) continue;
    if (!(v.transportation.sell > 0) || !(v.automobiles.sell > 0)) continue;
    const sA = v.automobiles.sell / (v.automobiles.sell + v.transportation.sell);
    const sT = 1 - sA;
    const A  = 100 * (1.25 * sA) / (Math.min(sT, 0.75) + 1.25 * sA);
    const mA = fA * v.automobiles.buy * PA;
    const obsLo = 100 * mA / (mA + FT_HI * v.transportation.buy * PT);
    const obsHi = 100 * mA / (mA + FT_LO * v.transportation.buy * PT);
    const pred = Math.max(25, A);
    rows.push({ date,
      'automobile supply share %':      +(100 * sA).toFixed(2),
      'reading A (generous) %':         +A.toFixed(1),
      'floor hypothesis: max(25,A) %':  +pred.toFixed(1),
      'OBSERVED share % (band)':        `${obsLo.toFixed(1)}–${obsHi.toFixed(1)}`,
      'observed ÷ predicted':           +(((obsLo + obsHi) / 2) / pred).toFixed(2) });
  }
  if (!rows.length) continue;
  console.log(`\n${r} — ${MARKET}`);
  console.table(rows);
}
