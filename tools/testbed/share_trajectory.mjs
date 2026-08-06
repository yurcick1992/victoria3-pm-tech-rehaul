// share_trajectory.mjs — does the automobile share CONVERGE on 25%, or pass through it?
//
//   node tools/testbed/share_trajectory.mjs --session <dir> [--market "British Market"]
//
// THE QUESTION (user, 2026-08-06): reading B may still be the rule, with real observations DRIFTING
// toward its 75/25 rather than snapping to it. That is testable in one specific way — a drift toward a
// destination ASYMPTOTES there. If the share sails through 25 % and keeps climbing, 25 % is not the
// destination, whatever the adjustment dynamics are.
//
// THE OBSTACLE, and how this gets round it. The share needs both goods' POP money, and the channel
// split captured `transportation` only up to 1912 while `automobiles` run to 1927 — so a joint series
// does not exist. But automobiles' pop fraction IS measured over the whole span, and transportation's
// is measured at three dates and is STABLE across them (0.617, 0.643, 0.676). So the share is
// computed with automobiles' MEASURED fraction and transportation's fraction swept across its whole
// observed range, giving a BAND rather than a line.
//
// ⚠ The band is the honest object here: its width is the uncertainty from not measuring `fT` late, and
// the conclusion only stands where the WHOLE band is on one side of 25 %.
// ⚠ It is still a LOWER bound on the automobile share, because it credits all of transportation's pop
// money to `free_movement`; whatever `popneed_communication` takes pushes the true share HIGHER.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buyOrderTable, readBreakdown } from './lib_breakdown.mjs';
import { REPO } from '../econ_host.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', '');
const MARKET  = argOf('--market', 'British Market');
if (!SESSION) { console.error('usage: share_trajectory.mjs --session <dir> [--market M]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));
const PT = 30, PA = 100;
const FT_LO = 0.617, FT_HI = 0.676;    // the full observed range of transportation's pop fraction

for (const r of readdirSync(SDIR).filter(d => /^run\d+_/.test(d)).sort()) {
  const dir = join(SDIR, r), metaP = join(dir, 'meta.json'), log = join(dir, 'logs_live', 'debug.log');
  const tsv = join(dir, 'markets.tsv');
  if (!existsSync(metaP) || !existsSync(log) || !existsSync(tsv)) continue;
  const meta = JSON.parse(readFileSync(metaP, 'utf8'));
  const buyOf = await buyOrderTable(log, meta.token);
  const { blocks } = await readBreakdown(log, meta.token, buyOf);
  // automobiles' pop fraction, measured, wherever a block survived
  const fAby = new Map();
  for (const b of blocks) if (b.market === MARKET && b.good === 'automobiles' && b.total > 0)
    fAby.set(b.date, b.pop / b.total);
  if (!fAby.size) continue;
  // buy orders at those same dates, from the order book
  const lines = readFileSync(tsv, 'utf8').split(/\r?\n/);
  const buy = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split('\t');
    if (c.length < 7 || c[2] !== MARKET) continue;
    if (c[4] !== 'transportation' && c[4] !== 'automobiles') continue;
    if (!buy.has(c[1])) buy.set(c[1], {});
    buy.get(c[1])[c[4]] = parseFloat(c[5]);
  }
  const rows = [];
  for (const [date, fA] of [...fAby.entries()].sort()) {
    const v = buy.get(date);
    if (!v || !(v.transportation > 0) || !(v.automobiles > 0)) continue;
    const mA = fA * v.automobiles * PA;
    const share = fT => 100 * mA / (mA + fT * v.transportation * PT);
    const lo = share(FT_HI), hi = share(FT_LO);     // bigger fT ⇒ smaller automobile share
    rows.push({ date,
      'automobiles pop fraction (measured)': +fA.toFixed(3),
      'automobile share, low estimate %':    +lo.toFixed(1),
      'automobile share, high estimate %':   +hi.toFixed(1),
      'whole band vs 25%': lo > 25 ? 'ABOVE' : hi < 25 ? 'below' : 'straddles 25%' });
  }
  if (!rows.length) continue;
  console.log(`\n${r} — ${MARKET}. transportation pop fraction swept ${FT_LO}–${FT_HI} (its full observed range)`);
  console.table(rows);
}
