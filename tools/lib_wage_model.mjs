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
// ⚠⚠ `base_wage` IS THE COUNTRY'S NORMAL RATE, NOT WHAT BUILDINGS PAY, AND THE GAP IS TWO THINGS, NOT ONE
// (F152 §8, measured on 3,289 observations over the vanilla baseline; it corrects F152 §4's flat 1.52×).
// A building sets its own rate, and the engine RAISES IT WHERE THE BUILDING CAN AFFORD TO —
// `BUILDING_PROFIT_TARGET_TO_RAISE_WAGES = 0.25`, `..._TO_LOWER_WAGES = 0.15` in `common/defines`. Regressing
// the actual wage bill on both terms:
//
//     W = 1.19 × (normal rate × wage units)  +  0.30 × the building's own profit
//
// and the split is IDENTIFIED (the two regressors' weighted collinearity is 0.76, well under the 0.95 danger
// line) and STABLE across all seven instrumented countries (a 1.01–1.26, b 0.18–0.65). ⇒ **the pure premium
// is ~1.2×, not 1.5×; the rest of the old flat figure was the profit-responsive half.**
// ⭐⭐ THE CONSEQUENCE FOR DESIGN IS BIGGER THAN THE ARITHMETIC: **a recipe cannot set a building's margin,
// because the wage answers back.** Solving the line above for profit gives the closed form `predictProfit()`
// uses, and a design margin is damped by 1/1.30 before any price moves at all — one mechanism behind F139's
// compression of a designed 5/55/127/233 ladder into a realised 26/31/47/46.
// ⚠⚠ WHAT `b` ACTUALLY IS — CORRECTED THE SAME DAY (F152 §9), AND IT IS NOT A SECOND COST.
// A building record in the melted save carries **`salary_rate`, its OWN wage rate**, beside `goods_sales` and
// `goods_cost` (revenue and inputs at MARKET). Re-running this regression with each building's own rate in
// place of the country's, over 6,160 buildings: the wage coefficient reads 1.10 and **`b` collapses to 0.019**.
// So `b` was the COUNTRY-level rate standing in for a BUILDING-level one — a building that earns more sets a
// higher `salary_rate`, which leaves a profit-shaped hole in a country-keyed fit. The MECHANISM is real (the
// engine's wage-raising rule is why the hole is profit-shaped); the description of `b` as a term in the wage
// bill, and the dividend reading once offered beside it, are NOT.
// ⇒ `b` is a REDUCED-FORM coefficient for an unobserved `salary_rate`. It earns its place in a PREDICTION,
//   where no building exists yet and only the country's wage is available, and it must never be quoted as a
//   statement about how the game computes a wage. To READ a save, read `salary_rate`.
// Measured against the building's own reported profit, the forms rank:
//     two-term (this one)  median |err| 26.5%   p90  89%   bias  +0.1%
//     flat 1.52            median |err| 38.7%   p90 149%   bias  +5.2%
//     no premium at all    median |err| 52.2%   p90 141%   bias +44.3%
//
// ⭐ WHY THIS REPLACES THE FLAT `wage_pct` 0.25. The wage share of TOTAL COST (inputs + wages) is a property
// of the economy and the decade, exactly as the ruling says: vanilla's own runs 54.6% at 1840 → 29.7% at 1935
// (p10 29.7, p90 61.1 over the cells). A flat 25% is below vanilla's own range in every decade, and it is
// worst where a building's cost is nearly all labour — the ART ACADEMY, whose jobs live in its ownership PMG,
// so 25%-of-goods charges it almost nothing and its base-price margin reads +108% / +313% (F143 §1a).
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
// goods flows) and subsistence (its own wage rules), and it agrees with the modelled bill at the premium
// above. That is `profit = revenue − inputs − wages` at market prices, confirmed.
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

// ⭐ THE TWO MEASURED COEFFICIENTS (F152 §8): W = WAGE_PREMIUM × normal-rate bill + PROFIT_WAGE_SHARE × profit
export const WAGE_PREMIUM = 1.19;            // per-country 1.01–1.26 over the seven instrumented markets
export const WAGE_PREMIUM_BAND = [1.01, 1.26];
export const PROFIT_WAGE_SHARE = 0.30;       // per-country 0.18–0.65
export const PROFIT_WAGE_SHARE_BAND = [0.18, 0.65];
// The flat coefficient F152 §4 published before the profit term was separated out. Kept so a tool can
// reproduce the older reading on purpose; never the default.
export const WAGE_PREMIUM_FLAT = 1.52;

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
