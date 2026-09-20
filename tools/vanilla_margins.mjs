// ============================================================================================
// WHAT MARGIN DOES A VANILLA BUILDING ACTUALLY RUN AT? — the anchor the design margin should sit on.
//
// Read-only. Sources a set of SAVE SUMMARIES (v6+, which carry `va_out`/`va_in` and the per-building
// active-PM breakdown) and, per building type, computes the margin ON OUR OWN DEFINITION:
//
//     margin = (va_out − va_in − wages) / (va_in + wages)
//
// — the same quantity `E.TPthr` computes for a tier, so the answer is directly comparable to the
// design margins in era_inverse.
//
// ⚠⚠ THE OLD COLLAPSE `margin = profit / (va_out − profit)` IS A MIXED-UNITS RATIO — F150, 2026-09-20.
// It assumes total cost = revenue − profit, which is true, and then uses `va_out` as the revenue. But
// **`va_out` is priced at BASE cost** (save_state_summary prices the save's goods flows with `common/goods`'
// `cost =`) while **`profit` is the game's own figure at MARKET prices**. Measured on a century endpoint the
// implied wage bill `va_out − va_in − profit` comes out NEGATIVE in 26% of entries and 45% of LEVELS.
//
// ⭐ THE REPAIR (F152): re-price value added to market with the building's OWN goods mix, taken from the
// active production methods the summary records, at that country's market's prices —
//     R = va_out × Σ_g share_g × (price_g ÷ base_g),   margin = profit ÷ (R − profit)
// which is the same collapse with the units fixed, because R − profit ≡ inputs + wages by definition.
// ⚠ It is UNDEFINED for a building with no goods flows (financial districts, manor houses, company HQs read
// `va_out = va_in = 0` with a large positive profit) — those are excluded here, as they always were.
// ⭐ WHY THE 1836 ANCHOR SURVIVED ANYWAY, and it is worth knowing: at 1836.2.1 realised prices sit close to
// base, so the repair moves the manufacturing figure very little. It moves a lot at 1935, and more the better
// the mod's price decline works. The header prints how far this date's prices actually are from base.
//
// ⭐ PROFIT IN £ IS REPORTED BESIDE EVERY MARGIN (user-ruled 2026-09-20: reports quote true profits).
//
//   node tools/vanilla_margins.mjs [--session <dir>] [--date 1836.2.1] [--markets GBR,FRA,...]
//                                  [--min-levels 4] [--json <path>] [--legacy-margin]
// ============================================================================================
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEcon } from './econ_host.mjs';
import { priceMultiplier, trueMargin } from './lib_wage_model.mjs';
import { MARKET_NAMES } from './testbed/ledger/lib_markets.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SESSION = arg('--session', 'tools/testbed/sessions/20260821_125917_vanilla-1836-refresh-1311');
const WANT_DATE = arg('--date', '1836.2.1');
const MIN_LEVELS = +arg('--min-levels', 4);
const JSON_OUT = arg('--json', null);
const ONLY = (arg('--markets', '') || '').split(',').filter(Boolean);

const { E, S } = loadEcon({ quiet: true });
const CFG = JSON.parse(readFileSync(join(REPO, 'config/mod_config.tier4.json'), 'utf8'));

// ---- the wage model, exactly the sheet's: W = base × Σ(employees × wage_weight) ------------
const wageUnitsOfPms = pms => {
  const emp = {};
  for (const [pm, lv] of Object.entries(pms || {})) {
    const e = (S.VAN.pms[pm] || {}).emp || {};
    for (const p in e) emp[p] = (emp[p] || 0) + e[p] * lv;
  }
  return { units: E.wageUnits(emp), heads: E.empTotal(emp) };
};

// ---- collect every v6+ summary in the session at the wanted date ---------------------------
const runs = [];
const root = join(REPO, SESSION);
for (const run of readdirSync(root)) {
  const dir = join(root, run, 'save_summaries');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json.gz')) continue;
    let j; try { j = JSON.parse(gunzipSync(readFileSync(join(dir, f)))); } catch { continue; }
    if (!(j.save_summary_version >= 6)) continue;
    if ((j.provenance || {}).date !== WANT_DATE) continue;
    // ⭐ that run's market prices at the same date, by market display NAME — the F150 repair needs them
    const price = {};
    const mf = join(root, run, 'markets.tsv');
    if (existsSync(mf)) for (const line of readFileSync(mf, 'utf8').split(/\r?\n/)) {
      const c = line.split('\t'); if (c.length < 8 || c[1] !== WANT_DATE) continue;
      const p = +c[7]; if (p > 0) (price[c[2]] ||= {})[c[4]] = p;
    }
    runs.push({ run, j, price });
    break;                                   // one summary per run at this date
  }
}
if (!runs.length) throw new Error(`no v6+ save summary dated ${WANT_DATE} under ${SESSION}`);

// ---- each country's market prices: the summary carries a numeric `market` id, so name the market by
// its largest member by GDP and look that tag's market name up. A country whose market is not
// instrumented gets no prices, and its margin is reported as unrepaired.
function marketPricesByTag(j, price) {
  const mkt = {}, out = {};
  for (const [tag, c] of Object.entries(j.countries || {})) {
    if (c.market == null) continue;
    const m = mkt[c.market] ||= { leader: null, gdp: -1, members: [] };
    m.members.push(tag); if ((c.gdp || 0) > m.gdp) { m.gdp = c.gdp || 0; m.leader = tag; }
  }
  for (const m of Object.values(mkt)) {
    const p = (MARKET_NAMES[m.leader] || []).map(n => price[n]).find(Boolean);
    if (p) for (const t of m.members) out[t] = p;
  }
  return out;
}

// ---- per (run, country, building type) ------------------------------------------------------
const rows = [];
let priceSpread = [];
for (const { run, j, price } of runs) {
  const byTagPrice = marketPricesByTag(j, price);
  for (const [tag, c] of Object.entries(j.countries || {})) {
    if (ONLY.length && !ONLY.includes(tag)) continue;
    const P = byTagPrice[tag] || null;
    for (const [key, b] of Object.entries(c.buildings || {})) {
      if (!(b.levels >= MIN_LEVELS)) continue;
      if (b.va_out == null || b.va_in == null) continue;
      if (!(b.va_out > 0)) continue;                       // no goods sold: margin undefined
      if (b.subsidised_levels > 0) continue;               // a subsidised building is not a market read
      const { units, heads } = wageUnitsOfPms(b.pms);
      if (!(units > 0)) continue;
      // the goods mix of the ACTIVE methods, to re-price va_out/va_in from base to market (F152)
      const mixOut = {}, mixIn = {};
      for (const [pm, lv] of Object.entries(b.pms || {})) {
        const g = (S.VAN.pms[pm] || {}); const w = lv / Math.max(1, b.levels);
        for (const [k, v] of Object.entries(g.out || {})) mixOut[k] = (mixOut[k] || 0) + v * w;
        for (const [k, v] of Object.entries(g.in || {})) mixIn[k] = (mixIn[k] || 0) + v * w;
      }
      const mo = P ? priceMultiplier(mixOut, P, S.PRICES) : { mult: NaN, missing: 1 };
      const mi = P ? priceMultiplier(mixIn, P, S.PRICES) : { mult: NaN, missing: 1 };
      const ok = mo.missing <= 0.02 && Number.isFinite(mo.mult);
      const R = ok ? b.va_out * mo.mult : NaN;
      const I = ok ? b.va_in * (Number.isFinite(mi.mult) ? mi.mult : (b.va_in === 0 ? 1 : NaN)) : NaN;
      if (ok) priceSpread.push(mo.mult);
      const wImplied = Number.isFinite(R) && Number.isFinite(I) ? (R - I - b.profit) / units : NaN;
      rows.push({ run, tag, key, levels: b.levels, staffing: b.staffing,
        out: b.va_out, in: b.va_in, R, I, profit: b.profit, units, heads, wImplied, priced: ok,
        group: (S.VAN.buildings[key] || {}).group || '' });
    }
  }
}

// ============================================================================================
// 1. VALIDATION — is `wages = va_out − va_in − profit` a real identity?
// ============================================================================================
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const priced = rows.filter(r => r.priced);
const rates = priced.map(r => r.wImplied).filter(x => isFinite(x) && x > 0);
console.log(`VANILLA ${WANT_DATE} — ${runs.length} run(s), ${rows.length} (country × building type) observations`);
console.log(`  ${SESSION}\n`);
console.log('── VALIDATION: the implied wage rate per wage-unit, from  wages = va_out − va_in − profit ──');
console.log(`  median ${med(rates).toFixed(4)} · p10 ${q(rates, .1).toFixed(4)} · p90 ${q(rates, .9).toFixed(4)}`
  + ` · negative or zero in ${priced.length - rates.length} of ${priced.length} PRICED entries (unpriced ones cannot be scored at all)`);
console.log('  (the sheet\'s measured 1836 base weekly wage is 0.0796 Belgian / 0.0610 Austrian — a rate in that');
console.log('   neighbourhood, and TIGHT, means the identity holds and the margins below are real)\n');

// per-country rate — a country pays ONE base wage, so within a country this should be near-constant
const byTag = {};
for (const r of rows) if (isFinite(r.wImplied) && r.wImplied > 0) (byTag[r.tag] ||= []).push(r);
const bigTags = Object.entries(byTag).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
console.log('  per country (the tightness WITHIN a country is the real test — one country, one base wage):');
for (const [tag, rs] of bigTags) {
  const v = rs.map(x => x.wImplied);
  const cv = Math.sqrt(v.reduce((a, x) => a + (x - v.reduce((s, y) => s + y, 0) / v.length) ** 2, 0) / v.length) / (v.reduce((s, y) => s + y, 0) / v.length);
  console.log(`    ${tag}  n=${String(rs.length).padStart(3)}  median ${med(v).toFixed(4)}  p10 ${q(v, .1).toFixed(4)}  p90 ${q(v, .9).toFixed(4)}  cv ${cv.toFixed(2)}`);
}

// ============================================================================================
// 2. THE MARGINS
// ============================================================================================
// One wage rate per country: the MEDIAN of that country's own implied rates. Using each building's
// own implied rate would make every margin identically equal to the game's profit by construction —
// the point is to price labour once and let the buildings differ.
const rateOf = {};
for (const [tag, rs] of Object.entries(byTag)) rateOf[tag] = med(rs.map(x => x.wImplied));

// ⭐⭐ NO WAGE MODEL IS NEEDED, and using one would only add noise. Our margin is
//     (revenue − inputs − wages) / (inputs + wages)
// and total cost IS revenue − profit, so the whole thing collapses to
//     margin = profit / (va_out − profit)
// on two numbers the save already carries. The wage-model column below is kept only as a
// CROSS-CHECK; the headline needs no assumption about what labour costs.
const LEGACY = process.argv.includes('--legacy-margin');
for (const r of rows) {
  // ⭐ THE REPAIRED IDENTITY (F152): revenue at MARKET, not value added at BASE.
  r.marginLegacy = (r.out - r.profit) > 0 ? r.profit / (r.out - r.profit) : null;
  r.marginTrue = trueMargin(r.profit, r.R);
  r.margin = LEGACY ? r.marginLegacy : r.marginTrue;
  const rate = rateOf[r.tag];
  r.wagesModel = rate * r.units;
  r.marginModel = Number.isFinite(r.R) && (r.I + r.wagesModel) > 0 ? (r.R - r.I - r.wagesModel) / (r.I + r.wagesModel) : null;
}
{
  const n = rows.filter(r => r.margin != null).length, unp = rows.filter(r => !r.priced).length;
  const m = priceSpread.slice().sort((a, b) => a - b);
  console.log('\n── THE F150 REPAIR: value added is BASE-priced, profit is MARKET-priced, so va_out is re-priced first ──');
  console.log(`  output price ÷ base across the scored buildings: median ${(m.length ? m[m.length >> 1] : NaN).toFixed(3)}`
    + `  p10 ${(m.length ? m[Math.floor(m.length * 0.1)] : NaN).toFixed(3)}  p90 ${(m.length ? m[Math.floor(m.length * 0.9)] : NaN).toFixed(3)}`);
  console.log(`  ${n} scored · ${unp} unscoreable (market not instrumented, or a good with no price)`
    + (LEGACY ? '   ⚠ --legacy-margin: showing F92\'s MIXED-UNITS ratio' : ''));
  const both = rows.filter(r => r.marginTrue != null && r.marginLegacy != null);
  if (both.length) {
    const d = both.map(r => r.marginTrue - r.marginLegacy).sort((a, b) => a - b);
    console.log(`  repaired − legacy, over ${both.length} entries: median ${(100 * d[d.length >> 1]).toFixed(1)}pp  p10 ${(100 * d[Math.floor(d.length * 0.1)]).toFixed(1)}pp  p90 ${(100 * d[Math.floor(d.length * 0.9)]).toFixed(1)}pp`);
    // ⚠ LIKE FOR LIKE. The repaired margin exists only where the market is instrumented, so the headline below
    // is a SMALLER and RICHER sample than F92's. Print the legacy figure on the SAME entries, or a reader cannot
    // tell a change of definition from a change of sample.
    const lw = (f) => { const rs = both.filter(r => (S.VAN.buildings[r.key] || {}).group && ['bg_light_industry', 'bg_heavy_industry', 'bg_military_industry', 'bg_ship_construction', 'bg_arts', 'bg_power'].includes((S.VAN.buildings[r.key] || {}).group));
      const lv = rs.reduce((a, r) => a + r.levels, 0); return lv ? rs.reduce((a, r) => a + f(r) * r.levels, 0) / lv : NaN; };
    console.log(`  MANUFACTURING level-weighted on the SAME ${both.filter(r => ['bg_light_industry', 'bg_heavy_industry', 'bg_military_industry', 'bg_ship_construction', 'bg_arts', 'bg_power'].includes((S.VAN.buildings[r.key] || {}).group)).length} priced entries:`
      + ` repaired ${(100 * lw(r => r.marginTrue)).toFixed(1)}%  vs legacy ${(100 * lw(r => r.marginLegacy)).toFixed(1)}%`
      + `   [F92 published 25.8% over the WHOLE 4,002-entry sample, priced and unpriced]`);
  }
}

// classification is by vanilla building_group, EXACTLY — the strings are short, closed and
// enumerable, and a regex over them silently put every wheat farm in "manufacturing" on the first run
const GRP_CLASS = {
  bg_light_industry: 'manufacturing', bg_heavy_industry: 'manufacturing',
  bg_military_industry: 'manufacturing', bg_ship_construction: 'manufacturing',
  bg_arts: 'manufacturing', bg_power: 'manufacturing',
  bg_mining: 'extraction', bg_logging: 'extraction', bg_oil_extraction: 'extraction',
  bg_rubber: 'extraction', bg_fishing: 'extraction', bg_whaling: 'extraction',
  bg_gold_fields: 'extraction',
  bg_staple_crops: 'agriculture', bg_plantations: 'agriculture', bg_ranching: 'agriculture',
  bg_agriculture: 'agriculture',
  bg_subsistence_agriculture: 'subsistence', bg_subsistence_ranching: 'subsistence',
  bg_private_infrastructure: 'infrastructure', bg_service: 'infrastructure', bg_trade: 'infrastructure',
};
const CLASS = k => GRP_CLASS[(S.VAN.buildings[k] || {}).group] || 'other';
// the industries our own ladder tiers, by their vanilla ANCHOR building — the directly comparable
// set, since the design margin is set for exactly these
const TIERED_ANCHORS = new Set((CFG.industries || []).filter(i => !i.disabled)
  .map(i => (i.tiers && i.tiers[0] || {}).key).filter(Boolean));
const byKey = {};
for (const r of rows) if (r.margin != null) (byKey[r.key] ||= []).push(r);
const table = Object.entries(byKey).map(([key, rs]) => {
  const lv = rs.reduce((a, x) => a + x.levels, 0);
  // LEVEL-WEIGHTED, because a two-level workshop and a sixty-level mill are not one observation each
  const wsum = rs.reduce((a, x) => a + x.margin * x.levels, 0);
  return { key, cls: CLASS(key), tiered: TIERED_ANCHORS.has(key), n: rs.length, levels: lv,
    marginW: wsum / lv, marginMed: med(rs.map(x => x.margin)),
    profit: rs.reduce((a, x) => a + (x.profit || 0), 0), profitPerLevel: rs.reduce((a, x) => a + (x.profit || 0), 0) / lv,
    modelMed: med(rs.map(x => x.marginModel).filter(x => x != null)) };
}).sort((a, b) => b.levels - a.levels);

const aggOf = rs => { const lv = rs.reduce((a, t) => a + t.levels, 0); return lv ? rs.reduce((a, t) => a + t.marginW * t.levels, 0) / lv : NaN; };
const gbp = x => (x < 0 ? "-£" : "£") + Math.abs(Math.round(x)).toLocaleString("en-US");
const show = cls => {
  const rs = table.filter(t => t.cls === cls);
  if (!rs.length) return;
  const lv = rs.reduce((a, t) => a + t.levels, 0);
  console.log(`\n── ${cls.toUpperCase()} — PROFIT ${gbp(rs.reduce((a, t) => a + t.profit, 0))}/wk · level-weighted margin ${(100 * aggOf(rs)).toFixed(1)}%  (${Math.round(lv).toLocaleString('en-GB')} levels, ${rs.length} building types) ──`);
  console.log('  building                          obs   levels     PROFIT GBP/wk   GBP/level   margin(lvl-wtd)   median   wage-model x-check');
  for (const t of rs.slice(0, 22))
    console.log('  ' + t.key.replace('building_', '').padEnd(32) + String(t.n).padStart(4) + String(Math.round(t.levels)).padStart(9)
      + gbp(t.profit).padStart(15) + gbp(t.profitPerLevel).padStart(12)
      + (100 * t.marginW).toFixed(1).padStart(15) + '%' + (100 * t.marginMed).toFixed(1).padStart(9) + '%'
      + (100 * t.modelMed).toFixed(1).padStart(13) + '%' + (t.tiered ? '   <- our ladder' : ''));
};
console.log('\n\n==== PROFIT (GBP/week, the game\'s own bottom line) and, beside it, margin = profit / (revenue at MARKET - profit) ====');
for (const c of ['manufacturing', 'extraction', 'agriculture', 'infrastructure', 'subsistence', 'other']) show(c);

console.log('\n==== THE ANCHOR — what a vanilla building earns at the 1836 start ====');
for (const [label, rs] of [
  ['all manufacturing', table.filter(t => t.cls === 'manufacturing')],
  ['the buildings OUR ladder tiers', table.filter(t => t.tiered)],
  ['extraction', table.filter(t => t.cls === 'extraction')],
  ['agriculture (commercial)', table.filter(t => t.cls === 'agriculture')],
]) {
  if (!rs.length) continue;
  const ms = rs.map(t => t.marginW);
  console.log('  ' + label.padEnd(34) + 'level-weighted ' + (100 * aggOf(rs)).toFixed(1).padStart(6) + '%'
    + '   median type ' + (100 * med(ms)).toFixed(1).padStart(6) + '%'
    + '   IQR ' + (100 * q(ms, .25)).toFixed(0) + '-' + (100 * q(ms, .75)).toFixed(0) + '%'
    + '   n=' + rs.length);
}
const mfg = table.filter(t => t.cls === 'manufacturing');
const mfgAgg = aggOf(mfg), mfgMed = med(mfg.map(t => t.marginW));

if (JSON_OUT) {
  writeFileSync(join(REPO, JSON_OUT), JSON.stringify({
    date: WANT_DATE, session: SESSION, runs: runs.length,
    wage_rate_by_country: rateOf, wage_rate_median: med(rates),
    manufacturing: { level_weighted: mfgAgg, median_type: mfgMed, levels: Math.round(mfg.reduce((a,t)=>a+t.levels,0)) },
    tiered_anchors: { level_weighted: aggOf(table.filter(t => t.tiered)), median_type: med(table.filter(t => t.tiered).map(t => t.marginW)) },
    by_building: Object.fromEntries(table.map(t => [t.key, {
      cls: t.cls, obs: t.n, levels: Math.round(t.levels),
      margin: Math.round(t.marginW * 1000) / 1000, margin_median: Math.round(t.marginMed * 1000) / 1000,
    }])),
  }, null, 1));
  console.log(`\n  wrote ${JSON_OUT}`);
}
