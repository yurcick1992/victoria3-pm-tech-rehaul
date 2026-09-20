// ⭐⭐ THE WAGE MODEL AND THE REPAIRED MARGIN IDENTITY — ONE implementation, because the alternative is what
// F150 found: three tools quoting a ratio whose wage term was assumed and whose units did not match.
//
// User-ruled 2026-09-20, in two parts (HANDOVER §0, BALANCE_FRAMEWORK §10.87):
//   0.1 REPORTS quote TRUE PROFIT in £. A margin may sit beside it, never instead of it.
//   0.2 PREDICTIONS estimate the wage share by "estimating individual wages and applying profession
//       multipliers" — and *"an industry tier doesn't have a predicted wage, the decade and the economy
//       does (e.g. stalling GBR in 1920)"*. So a wage here is always asked for as (economy, year).
//
// ---------------------------------------------------------------------------------------------------
// 1. THE WAGE BILL
//
//   W (£/week) = wage(tag, year) × Σ_profession (employees × wage_weight) × staffed levels
//
// `wage_weight` is vanilla's own, read LIVE from `common/pop_types` (laborers 1 · clerks/machinists/
// soldiers 1.5 · farmers 2 · shopkeepers/engineers/clergymen 3 · academics/bureaucrats 4 · aristocrats/
// capitalists/officers 5 · peasants 0.2 · slaves 0).
//
// ⭐ THE UNIT, and it is the thing that makes the save's own number usable: the engine's wage rate is
// **weekly £ per POP_SIZE_PACKAGE employees**, stated in `common/defines` on NORMAL_WAGE_RATE_FALLBACK and
// MINIMUM_WAGE_RATE, with POP_SIZE_PACKAGE = 10,000. A save summary's per-country `base_wage` is that rate,
// so **£ per employee per week = base_wage ÷ 10,000** — GBR 1840 reads 0.0610, which is the magnitude F26
// measured per-pop off the telemetry (Austrian market 0.0610, Belgian 0.0796). Both numbers are read live.
//
// ⭐⭐ THERE IS NO PREMIUM AND NO PROFIT TERM. THE LINE ABOVE IS THE WHOLE MODEL (FINDINGS F152 §10) — and it
// RETIRES §4's flat 1.52× and §8's two-term form, BOTH of which were artefacts of approximating revenue.
//
// Settled 2026-09-20 by reading the game instead of inferring it. A building record in a melted save carries
// **`goods_sales` and `goods_cost`** — revenue and inputs at MARKET prices — so the wage bill needs no model
// at all: **`wages = goods_sales − goods_cost − profit`**, exactly. The user confirmed the same identity off
// the game's own building panel (East Anglia furniture, 1836.2.1: 40.87k revenue − 35.35k expenses = 5.51k
// profit, with wages 6.01k inside the expenses; the save reads the identity to 0.38%).
// ⭐ **DIVIDENDS AND SUBSIDIES SIT BELOW THAT LINE** — the same building paid a 6.13k dividend against 5.51k
// of profit and lost cash reserves for it. So `profit_after_reserves` IS the clean, pre-distribution figure
// the 2026-09-20 ruling asks a report to quote.
//
// Scored against that exact wage bill, `base_wage/10,000 × wage units × staffed levels` reproduces it as
// (actual ÷ modelled, median over 1,000–2,600 country × building-type cells of one vanilla campaign):
//
//     1836.2  0.85 · 1836.10  0.92 · 1857  0.99 · 1877  0.99 · 1897  1.01 · 1921  1.09
//
// — RIGHT, to about 1% in the median for most of the century. The two low readings are the opening year,
// before wages have settled (`BUILDING_INITIAL_WAGE_WEEKS`). The old 1.52 came from using base-priced
// `va_out`/`va_in` × an approximate price multiplier as revenue and inputs; THAT error, not a premium, is
// what the coefficient was fitting, and §8's profit term was the same error correlating with profit.
// ⚠ The per-building SPREAD is real and wide (p10 ≈ 0.45, p90 ≈ 1.6–1.8): every building sets its own
//   `salary_rate` around the country's reference. The CENTRE is 1.0; a SINGLE building is not predictable to
//   better than about a factor of two, and nothing here should be quoted per building.
// ⚠ `salary_rate`, the building's own rate, reads 1.09–1.17 against the same exact bill, so it is not the
//   rate actually paid either. `base_wage` is the better of the two. Unexplained, and not needed.
//
// ⭐ WHY IT STILL REPLACES THE FLAT `wage_pct` 0.25 — and NOT for the reason first given. Measured exactly,
// the wage share of TOTAL COST is 54% (1836) → 29% (1921) for the WHOLE economy but **15–23% for
// MANUFACTURING ALONE**, i.e. BELOW the flat 25%, not above it: the whole-economy figure is carried by farms
// and mines, which are labour-heavy and input-light. For the TIERED industries the old flat share was
// reasonable. What it cannot do is see a building whose employment is not in `t.employment` — the ART
// ACADEMY, whose jobs live in its ownership PMG, so a share OF GOODS charges it almost nothing and its
// base-price margin read +108% / +313% (F143 §1a). That, and being a property of the economy and the decade
// rather than a constant, is why the model replaces it.
//
// ---------------------------------------------------------------------------------------------------
// 2. THE MARGIN IDENTITY — WHAT WAS WRONG AND WHAT REPLACES IT
//
// F92 shipped `margin = profit ÷ (va_out − profit)`, which assumes `profit = va_out − va_in − wages`.
// F150 measured the implied wage bill `va_out − va_in − profit` NEGATIVE in 26% of (country × building-type)
// entries and 45% of LEVELS. The cause is two things at once, and neither is investment income alone:
//
//   (a) UNITS. `va_out`/`va_in` are the save's own goods flows priced at BASE cost (save_state_summary.mjs
//       prices them with `common/goods`' `cost =`), while `profit` is the game's figure at MARKET prices.
//       The old identity therefore put a market-price numerator over a base-price denominator, and the
//       better the mod's price decline works the more wrong it gets.
//   (b) BUILDINGS WITH NO GOODS FLOWS AT ALL. Financial districts, manor houses and company headquarters
//       read `va_out = va_in = 0` with a large positive `profit` (GBR 1900: 12 building types, £2.75M).
//       For those the identity is not approximate, it is UNDEFINED — `profit ÷ (0 − profit)` is −1 whatever
//       the building does.
//
// THE REPAIR (F152, validated): convert value added to market prices with the building's own goods mix,
//       R = va_out × Σ_g share_g × (price_g ÷ base_g)      (share_g by base value, from the active PM mix)
//       I = va_in  × the same over its inputs
//       margin = profit ÷ (R − profit)        because  R − profit ≡ inputs + wages  by definition
// Checked on vanilla GBR 1900 over 45 fully-priced unsubsidised production types: the implied wage bill
// R − I − profit is POSITIVE for all of them but shipyards (whose naval-construction income is not in the
// goods flows) and subsistence (its own wage rules). `profit = revenue − inputs − wages` at market prices
// is CONFIRMED — and was confirmed a second time, directly, off the game's own building panel (§10).
//
// ⭐⭐ AND IT IS A WORKAROUND, NOT THE ANSWER. Save-summary **v9 (2026-09-20) carries `goods_sales` and
// `goods_cost`**, which ARE revenue and inputs at market, so from v9 on nothing needs re-pricing:
//       margin = profit ÷ (goods_cost + wages),   wages = goods_sales − goods_cost − profit
// The multiplier above exists for the PRE-v9 sessions, which cannot be back-filled (the harvester reaps the
// `.v3`). ⚠ It is also the reason the multiplier's error looked like a wage premium for most of a day: the
// approximation's residual sat exactly where the wage bill was being read.
//
// ⇒ `trueMargin()` returns null rather than a number when R is not available or not positive. A report
//    quotes `profit` in £ regardless; the margin is the optional column.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';

// ---- POP_SIZE_PACKAGE, live: the wage rate's denominator
export const POP_SIZE_PACKAGE = (() => {
  const t = readFileSync(join(GAME, 'common/defines/00_defines.txt'), 'utf8');
  const m = /POP_SIZE_PACKAGE\s*=\s*([\d.]+)/.exec(t);
  if (!m) throw new Error('POP_SIZE_PACKAGE not found in common/defines — the wage rate unit moved');
  return +m[1];
})();

// ---- profession wage weights, live from common/pop_types
export const WAGE_WEIGHT = (() => {
  const w = {};
  for (const f of readdirSync(join(GAME, 'common/pop_types'))) {
    if (!f.endsWith('.txt')) continue;
    const m = /wage_weight\s*=\s*([\d.]+)/.exec(readFileSync(join(GAME, 'common/pop_types', f), 'utf8'));
    if (m) w[f.replace(/\.txt$/, '')] = +m[1];
  }
  if (Object.keys(w).length < 10) throw new Error('only ' + Object.keys(w).length + ' pop types carry a wage_weight — the key moved');
  return w;
})();

// ⭐ THERE IS NO PREMIUM (F152 §10). Kept as a NAMED knob rather than deleted, so a tool can still ask
// "what if buildings paid x% more than the country's rate" and so the retired readings stay reproducible.
export const WAGE_PREMIUM = 1.0;             // measured 0.99–1.09 from 1857 on; 0.85–0.92 in the opening year
export const WAGE_PREMIUM_BAND = [0.85, 1.09];
export const PROFIT_WAGE_SHARE = 0;          // F152 §8's 0.30 was the price approximation, not a real term
// The two retired coefficients, kept ONLY so a tool can reproduce those readings deliberately.
export const WAGE_PREMIUM_FLAT_RETIRED = 1.52;   // F152 §4
export const WAGE_TWO_TERM_RETIRED = { a: 1.19, b: 0.30 };   // F152 §8

/** Σ (employees × wage_weight) for ONE level. An unknown profession weighs 1 and is reported by the caller. */
export function wageUnits(employment = {}) {
  let u = 0;
  for (const [p, n] of Object.entries(employment)) u += (+n || 0) * (WAGE_WEIGHT[p] ?? 1);
  return u;
}

/**
 * ⭐ A TIER'S PER-LEVEL EMPLOYMENT, BY PROFESSION — and the reason the art academy needed this whole pass.
 * A config tier normally carries its own `employment`. The ART ACADEMY does not: its jobs live in its OWNERSHIP
 * production-method group, which the config keeps as a SECONDARY, so `t.employment` is empty and a flat
 * `wage_pct` of goods then charges it almost no wages at all (F143 §1a: base-price margins of +108% / +313%).
 * The fallback is the same one `emit_research_events.tierEmp()` and `ui/econ.js` use — the BASE method of each of
 * the industry's secondary PMGs — except that this returns the PROFESSION MAP, because a wage needs the weights
 * (the academy's academics weigh 4 and its clerks 1.5, against a laborer's 1).
 * `V` is tools/lib_vanilla_ladder.mjs's readVanilla(); pass it once and reuse.
 */
export function tierEmployment(tier, industry, V) {
  const wm = tier.workforce_mult != null ? +tier.workforce_mult : 1;
  const own = tier.employment || {};
  const scale = m => Object.fromEntries(Object.entries(m).map(([p, n]) => [p, (+n || 0) * wm]));
  if (Object.values(own).some(n => +n > 0)) return scale(own);
  const out = {};
  for (const g of industry.secondary_pmgs || []) {
    const pms = (V.PMG && V.PMG[g]) || [];
    const base = pms.find(k => !/unlocking_principles/.test((V.PMBODY || {})[k] || ''));
    if (!base) continue;
    for (const m of ((V.PMBODY || {})[base] || '').matchAll(/building_employment_([a-z_]+)_add\s*=\s*(-?[0-9.]+)/g)) out[m[1]] = (out[m[1]] || 0) + +m[2];
  }
  return scale(out);
}

// ---- the measured base-wage path, config/measured_base_wages.json (generated by tools/measure_wage_share.mjs)
let WAGES = null;
export function baseWages() {
  if (WAGES) return WAGES;
  const p = join(REPO, 'config/measured_base_wages.json');
  if (!existsSync(p)) throw new Error('config/measured_base_wages.json is missing — regenerate with tools/measure_wage_share.mjs --write-wages');
  const j = JSON.parse(readFileSync(p, 'utf8'));
  WAGES = j.tags || j;
  return WAGES;
}

/**
 * The ECONOMY's wage: £ per employee-week for one country in one year, the normal rate × the premium.
 * `tag` accepts a state family — GER resolves GER→NGF→PRU, NET resolves NET→UNL — because a country's
 * tag changes mid-century and the wage path must not break where it does.
 * Returns { wage, normal, tag, year, n, premium, source }.
 */
export const TAG_FAMILY = { GER: ['GER', 'NGF', 'PRU'], NGF: ['NGF', 'GER', 'PRU'], PRU: ['PRU', 'NGF', 'GER'], NET: ['NET', 'UNL'], BEL: ['BEL', 'UNL'], UNL: ['UNL', 'NET', 'BEL'] };
export function economyWage(tag, year, { premium = WAGE_PREMIUM, table = null } = {}) {
  const T = table || baseWages();
  for (const t of (TAG_FAMILY[tag] || [tag])) {
    const row = T[t]; if (!row) continue;
    // exact year, else the nearest year that exists for this tag
    let y = String(year), rec = row[y];
    if (!rec) {
      const ys = Object.keys(row).map(Number).filter(Number.isFinite);
      if (!ys.length) continue;
      const near = ys.reduce((a, b) => Math.abs(b - year) < Math.abs(a - year) ? b : a);
      y = String(near); rec = row[y];
    }
    return { wage: rec.wage * premium, normal: rec.wage, tag: t, year: +y, n: rec.n, premium, source: 'measured_base_wages' };
  }
  throw new Error('no measured base wage for ' + tag + ' near ' + year + ' — add the tag to tools/measure_wage_share.mjs TAGS and regenerate');
}

/**
 * The weekly wage bill in £ for `levels` staffed levels of a building whose per-level employment is
 * `employment`. `profit` adds the profit-responsive half; omit it for the normal-rate part alone.
 */
export function wageBill({ employment, levels = 1, wage = null, tag = null, year = null, premium = WAGE_PREMIUM, profit = 0, profitShare = PROFIT_WAGE_SHARE }) {
  const w = wage != null ? wage : economyWage(tag, year, { premium }).wage;
  return w * wageUnits(employment) * levels + profitShare * (profit || 0);
}

/**
 * ⭐⭐ PREDICT A BUILDING'S PROFIT, with the wage answering back.
 *   W = a·Wm + b·P  and  P = R − I − W   ⇒   P = (R − I − a·Wm) ÷ (1 + b)
 * Returns { profit, wages, wagesNormalRate, margin, wageShareOfCost } — all £/week for the levels given.
 * `revenue` and `inputs` are at whatever prices the caller is working in; the coefficients do not care.
 * Measured on the vanilla baseline: median |error| 26.5% of the building's own profit, bias +0.1%.
 */
export function predictProfit({ revenue, inputs, employment, levels = 1, wage = null, tag = null, year = null,
                                premium = WAGE_PREMIUM, profitShare = PROFIT_WAGE_SHARE }) {
  const w = wage != null ? wage : economyWage(tag, year, { premium }).wage;
  const wm = w * wageUnits(employment) * levels;          // the normal-rate part, premium already in `w`
  const profit = (revenue - inputs - wm) / (1 + profitShare);
  const wages = revenue - inputs - profit;                // ≡ wm + profitShare × profit
  const cost = inputs + wages;
  return { profit, wages, wagesNormalRate: wm, margin: cost > 0 ? profit / cost : NaN, wageShareOfCost: cost > 0 ? wages / cost : NaN };
}

/**
 * The market-price multiplier of a goods mix: Σ q·price ÷ Σ q·base, i.e. what va_out / va_in must be
 * multiplied by to leave base prices. Returns { mult, missing } where `missing` is the share of base
 * value carried by goods the market has no price for — a caller must refuse the row above a few percent.
 */
export function priceMultiplier(mix, price, base) {
  let vb = 0, vm = 0, miss = 0;
  for (const [g, q] of Object.entries(mix || {})) {
    if (!base[g]) continue;
    if (!(price[g] > 0)) { miss += Math.abs(q * base[g]); continue; }
    vb += q * base[g]; vm += q * price[g];
  }
  const denom = Math.abs(vb) + miss;
  return { mult: vb !== 0 ? vm / vb : NaN, missing: denom > 0 ? miss / denom : 0 };
}

/**
 * THE REPAIRED MARGIN. `revenueAtMarket` is va_out × priceMultiplier(outputs).
 * Returns null when it cannot be computed — an ownership building (va_out 0), or no prices.
 * A report that gets null prints the PROFIT and leaves the margin column empty; it never falls back
 * to the base-priced ratio, which is the mixed-units number F150 condemned.
 */
export function trueMargin(profit, revenueAtMarket) {
  if (!Number.isFinite(revenueAtMarket) || !(revenueAtMarket > 0)) return null;
  const cost = revenueAtMarket - profit;
  if (!(cost > 0)) return null;
  return profit / cost;
}

/** The old F92 ratio, kept ONLY so a tool can print what it used to say beside the repair. Never the headline. */
export function legacyMargin(profit, vaOut) {
  const c = vaOut - profit;
  return c > 0 ? profit / c : null;
}
