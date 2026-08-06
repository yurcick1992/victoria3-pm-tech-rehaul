// split_auto_between_needs.mjs — automobiles sit in TWO needs. How much of their money is free_movement?
//
//   node tools/testbed/split_auto_between_needs.mjs --session <dir> [--market "British Market"]
//
// ⚠⚠ THE ERROR THIS EXISTS TO FIX (user, 2026-08-06). Every "observed automobile share of
// free_movement" computed so far credited **all** of automobiles' measured pop money to
// `popneed_free_movement`. But automobiles are also in **`popneed_leisure`** (weight 1,
// max_supply_share 0.25), whose budget is **0.40–0.80 ×** free_movement's depending on wealth. So the
// measured money is split across two needs and attributing it to one INFLATES the free_movement share.
//
// I had been applying this logic to `transportation` (also in two needs) and calling the result a LOWER
// bound — correct for that good — while never applying it to automobiles, where it cuts the other way.
// The two corrections push in OPPOSITE directions and the net effect has to be computed, not assumed.
//
// METHOD. Use `needSplit()` — the shared implementation — on BOTH needs with the run's own measured
// supply, to get automobiles' predicted share of each. Combine with the needs' relative budgets to get
// the fraction of automobile spending that belongs to free_movement:
//
//     auto_fm      = share_fm(supply)      × B_fm
//     auto_leisure = share_leisure(supply) × B_leisure ,   B_leisure = LRATIO × B_fm
//     fm_fraction  = auto_fm / (auto_fm + auto_leisure)
//
// ⚠ LRATIO is the one unmeasured input — it is population-weighted and this run carries no SoL metric —
// so it is SWEPT across the whole range the buy-package table allows (0.40–0.80), and the answer is
// reported as a band. ⚠ The shares come from the model, so this corrects a measurement using a model;
// that is weaker than measuring it, and is why the output states both the raw and corrected figures.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buyOrderTable, readBreakdown } from './lib_breakdown.mjs';
import { loadEcon, REPO } from '../econ_host.mjs';
const { E, S } = loadEcon({ quiet: true });

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SESSION = argOf('--session', ''), MARKET = argOf('--market', 'British Market');
if (!SESSION) { console.error('usage: split_auto_between_needs.mjs --session <dir> [--market M]'); process.exit(1); }
const SDIR = join(REPO, SESSION.replace(/^[.\\/]+/, ''));

// verbatim from common/pop_needs/00_pop_needs.txt
const FM = { entries: [ { g:'transportation', w:1, max:0.75, min:0 }, { g:'automobiles', w:1.25, max:1.0, min:0 } ] };
const LEI = { entries: [
  { g:'services',    w:0.1,  max:1.0,  min:0 }, { g:'fine_art',  w:4,    max:1.0,  min:0 },
  { g:'small_arms',  w:0.75, max:0.25, min:0 }, { g:'aeroplanes',w:1,    max:0.2,  min:0 },
  { g:'automobiles', w:1,    max:0.25, min:0 }, { g:'radios',    w:1,    max:0.2,  min:0 },
  { g:'opium',       w:0.5,  max:0.5,  min:0 }, { g:'clippers',  w:1,    max:0.25, min:0 },
  { g:'steamers',    w:0.75, max:0.25, min:0 } ] };
const LR_LO = 0.40, LR_HI = 0.80;                    // leisure budget ÷ free_movement budget
const PT = 30, PA = 100, FT_LO = 0.617, FT_HI = 0.676;
S.SPLIT_MODE = 'raw';

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
  const sell = new Map(), buy = new Map();
  for (const line of readFileSync(tsv, 'utf8').split(/\r?\n/).slice(1)) {
    if (!line) continue; const c = line.split('\t');
    if (c.length < 8 || c[2] !== MARKET) continue;
    if (!sell.has(c[1])) { sell.set(c[1], {}); buy.set(c[1], {}); }
    sell.get(c[1])[c[4]] = parseFloat(c[6]); buy.get(c[1])[c[4]] = parseFloat(c[5]);
  }
  const rows = [];
  for (const [date, fA] of [...fAby.entries()].sort()) {
    const sup = sell.get(date), bys = buy.get(date);
    if (!sup || !bys || !(sup.transportation > 0) || !(sup.automobiles > 0)) continue;
    const shFM  = (E.needSplit('popneed_free_movement', FM,  sup, {}) || []).find(x => x.g === 'automobiles');
    const shLEI = (E.needSplit('popneed_leisure',       LEI, sup, {}) || []).find(x => x.g === 'automobiles');
    if (!shFM || !shLEI) continue;
    const frac = lr => shFM.s / (shFM.s + shLEI.s * lr);      // share of automobile money that is free_movement
    const fLo = frac(LR_HI), fHi = frac(LR_LO);
    const mAtot = fA * bys.automobiles * PA;
    // raw (what every earlier table did) vs corrected, both against the same transportation band
    const obs = (mA, fT) => 100 * mA / (mA + fT * bys.transportation * PT);
    rows.push({ date,
      'auto share of leisure (model) %': +(100 * shLEI.s).toFixed(1),
      'of auto money, free_movement %':  `${(100*fLo).toFixed(0)}–${(100*fHi).toFixed(0)}`,
      'RAW observed fm share %':         `${obs(mAtot,FT_HI).toFixed(1)}–${obs(mAtot,FT_LO).toFixed(1)}`,
      'CORRECTED fm share %':            `${obs(mAtot*fLo,FT_HI).toFixed(1)}–${obs(mAtot*fHi,FT_LO).toFixed(1)}`,
      'corrected vs 25% floor':          obs(mAtot*fLo,FT_HI) > 25 ? 'ABOVE' : obs(mAtot*fHi,FT_LO) < 25 ? 'below' : 'straddles' });
  }
  if (!rows.length) continue;
  console.log(`\n${r} — ${MARKET}.  leisure budget swept ${LR_LO}–${LR_HI} × free_movement's`);
  console.table(rows);
}
