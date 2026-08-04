// PHASE B of the era work: turn the balance fit into five INSPECTABLE SCENARIOS.
//
//   node tools/era_scenarios.mjs            # report only
//   node tools/era_scenarios.mjs --write    # write config/era_presets.json
//
// Phase A (tools/era_solver.mjs) answered "what must each good cost, and what must each tier consume".
// It never needed a scenario to do that. This is the other half: a market whose ORDER BOOK actually
// produces those prices, so the answer can be loaded in the balance UI with prices unlocked and checked
// by eye instead of taken on trust.
//
// TWO THINGS SET THE SCALE, and they are different questions:
//   * RATIOS between buildings come from market clearing — each good's supply is set so its buy/sell
//     imbalance reproduces the price Phase A solved for it. That is scale-free.
//   * ABSOLUTE SIZE comes from the POPULATION. Total population per era is the one exogenous number
//     here; everything else is derived so that the buildings employ exactly the working adults the
//     non-peasant population provides. "Consumption should roughly match the workforce" is not a
//     check applied afterwards, it is how the scenario is built.
//
// Support buildings (ownership, government, trade centres, construction) are NOT invented: their share
// of total levels is taken from the real vanilla 1836 markets, which agree closely — ownership 30-34%
// of non-subsistence levels across Britain/France/USA, government 5-7%, trade centres 3-4.5%.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEcon, REPO } from './econ_host.mjs';
import { makePmRules, optimisePMs } from './era_pm.mjs';

const WRITE = process.argv.includes('--write');
const { E, S, PMECON } = loadEcon({ quiet: true });
const FIT = JSON.parse(readFileSync(join(REPO, 'config', 'era_prices.json'), 'utf8'));

// ===================================================================================================
// SCENARIO INPUTS
// ===================================================================================================
// Total population and the peasant share, per era. A developed country growing through the period, and
// shedding peasants as industry absorbs them — the brief's "we're supposed to lose peasants share as the
// game progresses". Both are exogenous: they are the scenario's premise, not an output.
const POP_TOTAL   = [20e6, 26e6, 34e6, 40e6, 46e6];
// MEASURED off vanilla, not chosen (FINDINGS F28, peasant workforce ÷ 0.25 ÷ total pop, developed
// countries): 1836 Austria 88% / Prussia 83% / France 79% / Britain 62% / Belgium 58%; 1870 ~55%;
// 1900 ~30%; 1920 ~12%; 1935 0-10%.
//
// The old 60/45/30/20/12 was wrong at BOTH ends and it is the root of the era-1 failure. The job pool
// forces full employment of the non-peasant population, so a 60% peasant share in 1836 makes the country
// as industrial as Britain — the most industrialised on earth — which floods every manufactured market:
// groceries, paper, steel and services all sat at the 25% price FLOOR while wood sat at the 175% ceiling,
// and the wage bill reached 73% of gross output. At that point +20% is arithmetically unreachable
// (cost ≤ 0.833·O, wages alone 0.73·O, leaving 0.10·O for inputs against a 4:1 ceiling demanding 0.25·O).
const PEASANT_SHARE = [0.78, 0.55, 0.30, 0.12, 0.04];
// Share of GDP spent on the ARMY's goods upkeep, and the battalion mix. Era-appropriate weaponry only:
// a 1935 army is not line infantry. 3 infantry battalions per artillery/armour battalion.
const ARMY_GDP_SHARE = 0.05;
const ARMY_MIX = {
  1: [['combat_unit_type_line_infantry', 3], ['combat_unit_type_cannon_artillery', 1]],
  2: [['combat_unit_type_skirmish_infantry', 3], ['combat_unit_type_mobile_artillery', 1]],
  3: [['combat_unit_type_trench_infantry', 3], ['combat_unit_type_shrapnel_artillery', 1]],
  4: [['combat_unit_type_squad_infantry', 3], ['combat_unit_type_siege_artillery', 1]],
  5: [['combat_unit_type_mechanized_infantry', 3], ['combat_unit_type_heavy_tank', 1]],
};
// Support-building shares, as a fraction of NON-SUBSISTENCE building levels. Measured off the vanilla
// 1836 markets (see the header). Construction is raised from vanilla's ~0.7% because raising it is the
// whole point of the mod — modernising has to be BUILT — and it is the one number here that is a design
// choice rather than an observation. It is a knob; say so when reporting.
const SUPPORT_SHARE = { ownership: 0.32, government: 0.06, trade: 0.035, construction: 0.015 };
// THROUGHPUT, as a flat average per sector. A real market's bonus is per building type and measured
// (economy of scale + technology + laws + company bonuses); these synthetic scenarios have no companies
// and no laws to measure, so a representative average stands in. It is NOT cosmetic: throughput scales a
// building's goods but not its workforce, so it raises the margin — the wage bill is the one cost that
// does not grow with it.
const THRU_MANUFACTURING = 0.20;
const THRU_EXTRACTION = 0.10;
// ===================================================================================================
// THE VALUE-ADDED CEILING — a manufacturing recipe may not turn £1 of inputs into more than £4 of output,
// measured at BASE prices.
//
// This is the constraint that makes the goal-based system DETERMINATE. Profit targets alone do not pin a
// recipe: any output/input ratio can be made to hit any margin by moving the other lever, so the solver
// was free to satisfy "+20%" by driving inputs towards zero instead of by sizing the industry properly.
// It did exactly that — paper e3 was consuming £11 of inputs to make £2,700 of paper (245:1), automotive
// e4 £70 to make £4,500 (64:1). A ceiling on value added closes that hole.
//
// It is an ECONOMIC anchor, not a physical one, which is why it survives the fact that a "unit" of a good
// is arbitrary and that V3 folds quality into quantity: it says value added cannot exceed 75% of output
// value, and never needs to know what a unit is.
//
// EXTRACTION AND AGRICULTURE ARE EXEMPT — they are location- and labour-constrained rather than
// input-constrained, and legitimately run enormous ratios (a coal mine consumes almost nothing but tools).
// The exemption is automatic here: only our tier buildings go through the input solver.
//
// COST: none at base prices. A +20% margin needs I + W <= O/1.2, and with I >= O/4 that is W <= 0.583·O;
// the highest wage share anywhere in the ladder is 0.30·O, so there is about 2x headroom. The ceiling
// only bites once the OUTPUT PRICE FALLS, which is precisely the insolvency case it is meant to expose.
const MFG_IO_CAP = 4;
// ART ACADEMIES ARE EXEMPT. Fine art is not manufacturing in any sense the ceiling was written for: it is
// a £200 good made essentially out of labour, so its value added genuinely is nearly all of its output.
// Capping it at 4:1 would force an academy to consume £1,250 of paper and tools per level to justify its
// canvases, which is a worse falsehood than the one the cap prevents.
// ...but not to INFINITY. A per-industry override of the ratio: art academies may run up to 10:1 rather
// than 4:1, which keeps them recognisably a building that buys canvas and tools rather than one that
// conjures paintings out of nothing.
const IO_CAP_OVERRIDE = { art_academy: 10 };
const ioCapFor = id => IO_CAP_OVERRIDE[id] || MFG_IO_CAP;
// Industries whose scenario presence is FIXED rather than solved. Art academies cannot be sized by the
// profit feedback: fine_art is not supply-clamped (max_supply_share = 1) and carries the highest weight in
// popneed_leisure, so once it absorbs that budget every extra academy adds supply against fixed money and
// simply destroys its own price. Sizing it by margin therefore has no stable answer — it is pinned by
// hand instead, and left insolvent if that is where it lands.
const FIXED_COUNTS = { art_academy: { cur: 2, m1: 2, m2: 1 } };
// Reference producers deliberately kept OUT of these scenarios. Natural dye is removed so that synthetics
// is the ONLY source of dye — the industry exists to replace it, and leaving the plantation in place left
// synthetics competing with a supplier it is supposed to have destroyed (it read best-case −35% in 1870).
const EXCLUDE_REF = new Set(['building_dye_plantation']);
// A scenario where one industry is most of the economy is broken, however well its own margin solves.
const GDP_SHARE_WARN = 0.25;
// The era-appropriate tier and the one below it need enough levels that the two-eras-stale tier (fixed at
// one) is genuinely negligible against them, rather than a tenth of the market.
// PER ERA. Ten everywhere is unaffordable early: with only 22% of an 1836 population outside subsistence,
// reaching ten median levels needed a country of 529M — bigger than Qing China, and not "a reasonably
// modern country" by any reading. Five is enough to make the two-eras-stale tier (fixed at one level)
// negligible against the two main tiers, which is all the floor was ever for.
const MIN_MAIN_LEVELS_BY_ERA = [5, 5, 10, 10, 10];
// Ceiling on how far the population may be scaled to clear that floor. Generous, because the binding
// constraint is an integer and the required factor is genuinely large in the early eras — but finite, so
// a scenario that cannot converge fails loudly at a big number instead of running to infinity.
const POP_BOOST_CAP = 40;
const SUPPORT_BLD = {
  ownership:    ['building_manor_house', 'building_financial_district'],
  government:   ['building_government_administration'],
  trade:        ['building_trade_center'],
  construction: ['building_construction_sector'],
};
const WORK_RATIO = (S.POPM.working_adult_ratio != null ? S.POPM.working_adult_ratio : 0.25);
const SUBSISTENCE_JOBS_PER_LEVEL = 5000;
const URBAN_PER_LEVEL = 100;   // FINDINGS F13
// Which professions land in which consumption stratum (V3's own strata).
const STRATUM = {
  lower:  ['laborers', 'farmers', 'machinists', 'soldiers', 'servicemen'],
  middle: ['shopkeepers', 'clerks', 'engineers', 'bureaucrats', 'academics', 'clergymen', 'officers'],
  upper:  ['aristocrats', 'capitalists'],
};
const stratumOf = p => (STRATUM.lower.includes(p) ? 'lower' : STRATUM.middle.includes(p) ? 'middle'
                      : STRATUM.upper.includes(p) ? 'upper' : null);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Re-solve a tier's INPUT volumes so it earns `target` at the CURRENT thresholds. Output is never
// touched — the ×1.5-per-tier ladder is the mod's structure, and inputs are the lever (BALANCE_FRAMEWORK
// §8). An active secondary PM's inputs are its own recipe, so they are held fixed and netted off first.
// ⚠ THROUGHPUT enters here as W/k, not as a scale on everything. With a bonus k, revenue is k·O and cost
// is k·I + W — the workforce does not grow — so the target (kO − kI − W)/(kI + W) = τ rearranges to
//     I = O/(1+τ) − W/k
// Solving without the /k targets a different margin from the one the Profit column reports, and the two
// silently disagree by exactly the size of the bonus.
function solveInputsAt(ind, t, target) {
  const k = E.thruMult(t.key);
  const O = E.outputValue(ind, t, true), Wc = E.wageCost(t), secI = E.selInVal(t._sec, true);
  const allowed = O / (1 + target);
  const wantI = allowed - Wc / k - secI;
  let haveI = 0;
  for (const g in t.inputs) haveI += t.inputs[g] * (S.PRICES[g] || 0) * ((S.thresholds[g] ?? 100) / 100);
  if (!(haveI > 0) || !(O > 0)) return false;
  // THE CEILING, applied to the recipe at BASE prices (not at this era's prices — it is a property of the
  // technology, not of the market it happens to sit in). Never let the solve buy its margin by making the
  // building consume nothing.
  const outGood = E.tierOut(ind, t);
  const Obase = t.output_qty * (S.PRICES[outGood] || 0);
  let Ibase = 0; for (const g in t.inputs) Ibase += t.inputs[g] * (S.PRICES[g] || 0);
  if (!(Ibase > 0) || !(Obase > 0)) return false;
  const minScale = (Obase / ioCapFor(ind.id)) / Ibase;
  // ⚠ INSOLVENT (wantI <= 0) MUST STILL BE CLAMPED. Returning early here — which is what this did — leaves
  // whatever hollowed-out recipe the tier already had, so the very tiers the ceiling exists to catch were
  // the only ones it never touched: art academy sat at 500:1 and paper e3 at 245:1 through every rebuild.
  // The right answer for an insolvent tier is the CHEAPEST LEGAL recipe (exactly the cap), plus a report
  // that it cannot reach its target; the remedy is a smaller share of the market, not a thinner recipe.
  let scale = wantI > 0 ? wantI / haveI : minScale;
  if (scale < minScale) { scale = minScale; capped.add(t.key); } else capped.delete(t.key);
  for (const g of Object.keys(t.inputs)) {
    t.inputs[g] = Math.max(minMainInput(ind, g), Math.round(t.inputs[g] * scale * 10) / 10);
  }
  return true;
}
const capped = new Set();   // tiers whose recipe is pinned by the ceiling rather than by their target

// THE CLOSED-FORM SOLVENCY TEST. With the recipe floored at O/4, the BEST margin a tier can reach at the
// current prices is fixed — no search needed:
//     margin_max = (p·O − q·O/4 − W) / (q·O/4 + W)
// where p is what its output fetches and q what its inputs cost. If that is below the target, the industry
// cannot hit it at ANY recipe, and the only remedy is to make it a smaller share of the market so its own
// price rises. This is what turns "the solver quietly produced a factory with no inputs" into a condition
// the solver can see before it does any damage.
function maxMargin(ind, t) {
  const k = E.thruMult(t.key);
  const O = E.outputValue(ind, t, true);              // at market prices, incl. secondary output
  const W = E.wageCost(t), secI = E.selInVal(t._sec, true);
  const outGood = E.tierOut(ind, t);
  const Obase = t.output_qty * (S.PRICES[outGood] || 0);
  let Ibase = 0, Imkt = 0;
  for (const g in t.inputs) {
    Ibase += t.inputs[g] * (S.PRICES[g] || 0);
    Imkt  += t.inputs[g] * (S.PRICES[g] || 0) * ((S.thresholds[g] ?? 100) / 100);
  }
  if (!(Ibase > 0) || !(Obase > 0)) return Infinity;
  const q = Imkt / Ibase;                              // this recipe's own input price index
  // the exemption has to apply HERE too, or the test judges an exempt industry against a floor it does
  // not have and reports it insolvent when its recipe could still shrink
  const floor = q * Obase / ioCapFor(ind.id);
  const Imin = floor + secI;                           // cheapest legal input bill, at market prices
  const C = k * Imin + W;
  return C > 0 ? (k * O - C) / C : -1;
}
// THE NEGATIVE-GOODS FLOOR. Some secondary PMs REDUCE a main input rather than adding one (a food
// industry's canning line cuts its grain bill). If the solve pushes the main recipe below the largest
// reduction a legal PM combination can apply, the building's total input for that good goes negative —
// which tools/lint_negative_goods.awk rejects, and rightly: it would be a factory that is PAID to consume.
// The invariant is hard and the profit target is soft, so the floor wins and the tier misses its target
// slightly. Worst-case over every PM in every secondary PMG (one active per group), matching what the
// linter itself enumerates rather than only what this era can reach.
function minMainInput(ind, g) {
  let worst = 0;
  for (const pmg of (ind.secondary_pmgs || [])) {
    const grp = S.VAN.pmgs[pmg]; if (!(grp && grp.pms)) continue;
    let mn = 0;
    for (const pm of grp.pms) { const v = (E.pmRec(pm).in || {})[g] || 0; if (v < mn) mn = v; }
    worst += mn;
  }
  return Math.max(0.1, -worst);
}
const W = (s, n) => String(s).padEnd(n);
const fmtN = n => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(Math.round(n)));

// --- vanilla group helpers -------------------------------------------------------------------------
const VANG = S.VAN.groups || {};
function groupChain(g, field) {
  const seen = new Set();
  while (g && !seen.has(g)) { const r = VANG[g]; if (r && r[field] != null) return r[field]; seen.add(g); g = (VANG[g] || {}).parent; }
  return null;
}
function urbanizationOf(b) {
  const g = (S.VAN.buildings[b] || {}).group; if (!g) return 0;
  if (groupChain(g, 'subsistence')) return 0;
  return groupChain(g, 'urbanization') || 0;
}
const groupOf = b => (S.VAN.buildings[b] || {}).group || '';
const isMilitary = b => /^bg_(army|conscription|naval)/.test(groupOf(b));
const isSupport = b => Object.values(SUPPORT_BLD).some(list => list.includes(b));
const isUrban = b => b === 'building_urban_center';

// ---------------------------------------------------------------------------------------------------
// PRICES ARE REALISED, NOT PRESCRIBED.
//
// Phase A derived a price path from profit margins alone. It is a good starting guess and nothing more,
// because it never asked whether any market composition can PRODUCE those prices — and for several goods
// none can. Steel at 150% of base in era 1 is the clearest case: an era-1 economy has no steel consumer
// at all (era-1 tooling is wood, era-1 arms are iron and hardwood), so steel sits at the 25% floor no
// matter how the market is arranged. Chasing Phase A's number there is chasing a number that cannot exist.
//
// So this solver never sets a price. It reads the price the ORDER BOOK produces — the game's own formula,
// on the scenario's own orders — and moves the one thing it actually controls, BUILDING COUNTS, until the
// PROFIT targets hold at whatever prices result. Supply and profit move opposite ways (more producers ⇒
// lower price ⇒ thinner margin), so the feedback is simply: too profitable ⇒ build more of it.
//
// Targets come from the same rules Phase A used, so the two agree wherever the price path was reachable
// and diverge, visibly, wherever it was not. That divergence is a result, not an error.
// ===================================================================================================
// THE PRICE PATH — what COUNTS are steered by. This is the fix for the degeneracy that made the count
// solver inert: `solveInputsAt` pins every top tier to exactly +20%, so a count feedback driven by the
// margin sees `profit − target = 0` forever and multiplies by one. Both levers were aimed at the same
// number. Counts now target PRICES, inputs target MARGIN, and neither can cancel the other.
//
// The path is not arbitrary — it is what the obsolescence targets arithmetically require. A tier whose
// inputs were solved to +20% at its own era's price P_old earns `1.2·P/P_old − 1` later, so:
//     −5%  one era on   ⟹  P/P_old = 0.79
//     −30% two eras on  ⟹  P/P_old = 0.583   (i.e. ~0.76 per era)
// and the top tier cannot survive below ~66% of base, because the 4:1 ceiling stops it cutting inputs
// any further (P ≥ 1.2·(0.25 + W/O), with W/O ≈ 0.3 measured). Hence: start high, fall ~24% per era,
// floor at 66. RAW goods stay flat — nobody tiers a coal mine, so there is no obsolescence to drive.
const PRICE_START = +(process.env.PRICE_START || 155);
const PRICE_DECAY = +(process.env.PRICE_DECAY || 0.82);
const PRICE_FLOOR = +(process.env.PRICE_FLOOR || 75);
const PRICE_RAW = 100;

const TG = FIT.targets;
const SHIP_INDUSTRIES = new Set(['shipyard', 'shipyard_steam']);
// GOLD IS MONEY, NOT A GOOD. No pop need lists it and no building consumes it, so its order book is
// one-sided by construction: all sell, no buy, price pinned to the 25% floor, and its mines read −68%
// no matter how few of them there are. Excluding it is not a fudge — a target that cannot be moved by
// the only lever we have is not a target. Its mines stay in the scenario (they employ people and the
// game does pay for gold), they are just not steered or scored.
const SKIP_GOODS = new Set(['gold']);
const SKIP_TARGET_BLD = new Set(['building_gold_mine', 'building_gold_field']);
// profit target for the ERA-CURRENT tier of an industry (the one whose margin the price has to deliver)
function currentTargetFor(ind) { return TG.current + (SHIP_INDUSTRIES.has(ind.id) ? TG.shipyard_penalty : 0); }
// ...and for a reference producer, by the UI's taxonomy
const EXTRACTION_CATS = new Set(['mining', 'logging', 'oil', 'rubber', 'fishing_whaling']);
const AGRICULTURE_CATS = new Set(['farms', 'plantations', 'ranching']);
function catOf(b) {
  const info = S.VAN.buildings[b] || {};
  if (info.unique && !PMECON.GRPCAT[info.group]) return 'unique';
  return PMECON.GRPCAT[info.group] || ('grp_' + (info.group || 'other'));
}
function refTargetFor(b) {
  const c = catOf(b);
  return EXTRACTION_CATS.has(c) ? TG.extraction : AGRICULTURE_CATS.has(c) ? TG.agriculture : TG.current;
}

// ===================================================================================================
const rules = makePmRules(E, S);

// good -> first era any tier of ours produces it (manufactured), else null (raw / secondary)
const GOOD_FIRST_ERA = {};
for (const i of S.IND) {
  if (i.follows_be === false) continue;
  for (const t of i.tiers) {
    const g = E.tierOut(i, t);
    if (GOOD_FIRST_ERA[g] == null || t.era < GOOD_FIRST_ERA[g]) GOOD_FIRST_ERA[g] = t.era;
  }
}
// Realised prices per era, filled in as the eras are built in order. The RATIO between consecutive eras
// is what the obsolescence rule actually constrains, so the target is relative to what the previous era
// truly cleared at — not an absolute level.
const REALISED = [];
// ⚠ An ABSOLUTE path does not work and this is why: demanding 140% in a good's debut era is unreachable
// for anything with little demand then (steel in 1836 has essentially no consumers), so the feedback
// pushes counts to the floor and the price sticks at the band edge anyway. Measured on the absolute
// version: groceries RISING 91 → 103 → 110 across eras 1–3, clothes pinned at the 175 ceiling,
// telephones at the 25 floor. A relative target asks only for the decay the ladder needs.
// ⚠ ABSOLUTE, measured better than relative. Targeting `0.76 × the previous era's REALISED price` looks
// more principled — the obsolescence rule constrains a ratio, not a level — but it scores worse (51
// illogical points against 45), because the debut era then has no anchor at all and every later era
// inherits whatever it drifted to. An absolute path re-anchors each era independently.
function targetPrice(good, era) {
  const f = GOOD_FIRST_ERA[good];
  if (f == null) return PRICE_RAW;                       // raw / secondary: no ladder to drive
  return Math.max(PRICE_FLOOR, PRICE_START * Math.pow(PRICE_DECAY, Math.max(0, era - f)));
}

function buildScenario(eIx) {
  const era = FIT.eras[eIx].era;
  // ---- prices, wage, SoL --------------------------------------------------------------------------
  for (const g in S.PRICES) S.thresholds[g] = FIT.prices[eIx][g] != null ? FIT.prices[eIx][g] : 100;
  S.BASE_WAGE = FIT.eras[eIx].base_wage;
  const sol = FIT.eras[eIx].sol;
  S.SOL = { lower: sol, middle: Math.round(sol * 1.5), upper: Math.round(sol * 3), peasants: sol, slaves: 8 };
  // ---- production methods, exactly as Phase A chose them for this era -----------------------------
  for (const i of S.IND) for (const t of i.tiers) if (FIT.pms[eIx].tiers[t.key]) t._sec = { ...FIT.pms[eIx].tiers[t.key] };
  for (const b in FIT.pms[eIx].refs) S.REFSEL[b] = { ...FIT.pms[eIx].refs[b] };

  // ---- which of our tiers this era runs, and in what proportion ----------------------------------
  // Era-appropriate and one-era-old at EQUAL LEVEL COUNTS (the brief), one level of the two-era-old tier
  // so the sheet shows its arithmetic without its orders mattering, and one level of the NEXT era's tier
  // as a forward probe — the 1836 scenario has nothing below it, so without this it could never show the
  // ladder from both sides.
  const placement = [];   // {ind, tiers:[{t, weight}]}
  for (const i of S.IND) {
    const sorted = [...i.tiers].sort((a, b) => a.era - b.era);
    const avail = sorted.filter(t => t.era <= era);
    if (!avail.length) continue;
    const cur = avail[avail.length - 1], m1 = avail[avail.length - 2], m2 = avail[avail.length - 3];
    const p1 = sorted.find(t => t.era > era);
    const fx = FIXED_COUNTS[i.id];
    const rows = [{ t: cur, weight: fx ? 0 : 1, fixed: fx ? fx.cur : undefined }];
    if (m1) rows.push({ t: m1, weight: fx ? 0 : 1, fixed: fx ? fx.m1 : undefined });
    if (m2) rows.push({ t: m2, weight: 0, fixed: fx ? fx.m2 : 1 });
    if (p1) rows.push({ t: p1, weight: 0, fixed: 1 });
    placement.push({ ind: i, rows });
  }

  // ---- reference producers (farms, mines, plantations, …) ----------------------------------------
  const refProducers = E.refBuildings().filter(b => {
    if (EXCLUDE_REF.has(b)) return false;
    // ⚠ THE BUILDING ITSELF IS ERA-GATED, not only its production methods. Without this, every extraction
    // and plantation type existed in every era — 1836 came out with 33% of its ore value from OIL, which
    // Drake's well post-dates by 23 years, and with rubber plantations a century early. `buildings[b].tech`
    // is the vanilla unlocking technology; its era is remapped 1:1 onto ours like every other tech gate.
    const bt = (S.VAN.buildings[b] || {}).tech;
    if (bt && (S.VAN.tech_era || {})[bt] > era) return false;
    if (E.isSubsistenceBuilding(b) || isUrban(b) || isMilitary(b) || isSupport(b)) return false;
    if ((S.VAN.buildings[b] || {}).unique) return false;
    const out = E.selGoods(E.refSel(b)).out;
    return Object.keys(out).some(g => out[g] > 0 && S.PRICES[g]);
  });

  // ---- seed counts ---------------------------------------------------------------------------------
  Object.keys(S.BLDNUM).forEach(k => delete S.BLDNUM[k]);
  Object.keys(S.UNITNUM).forEach(k => delete S.UNITNUM[k]);
  const scaleOf = {};                                     // industry id / ref key -> scale
  for (const p of placement) scaleOf['I:' + p.ind.id] = 10;
  for (const b of refProducers) scaleOf['R:' + b] = 10;
  S.POPS = { total: 0, upper: 0, middle: 0, lower: 0, peasants: 0, slaves: 0 };

  const applyCounts = () => {
    Object.keys(S.BLDNUM).forEach(k => delete S.BLDNUM[k]);
    for (const p of placement) {
      const s = scaleOf['I:' + p.ind.id];
      // NOT floored at MIN_MAIN_LEVELS. Forcing ten levels of an industry a market only needs two of
      // makes it oversupplied by construction, crashes its price and guarantees a loss — the floor has to
      // be reached by making the ECONOMY bigger, not by overbuilding one industry into it. See popBoost.
      for (const r of p.rows) S.BLDNUM[r.t.key] = r.fixed != null ? r.fixed : Math.max(1, Math.round(s * r.weight));
    }
    for (const b of refProducers) S.BLDNUM[b] = Math.max(1, Math.round(scaleOf['R:' + b]));
  };
  // THROUGHPUT per building, by sector. Applied to everything the scenario places, and carried in the
  // preset so the UI shows the same margins the solve used.
  const applyThroughput = () => {
    Object.keys(S.THRU).forEach(k => delete S.THRU[k]);
    for (const i of S.IND) for (const t of i.tiers) if (S.BLDNUM[t.key]) S.THRU[t.key] = THRU_MANUFACTURING;
    for (const b of E.refBuildings()) {
      if (!S.BLDNUM[b] || E.isSubsistenceBuilding(b)) continue;
      const c = catOf(b);
      if (EXTRACTION_CATS.has(c) || AGRICULTURE_CATS.has(c)) S.THRU[b] = THRU_EXTRACTION;
    }
  };

  // ---- the loop ------------------------------------------------------------------------------------
  // `popBoost` scales the exogenous population so that the smallest era-appropriate industry still runs
  // at MIN_MAIN_LEVELS. The brief wants the two-eras-stale tier (fixed at one level) to be negligible
  // against the two main tiers, and one-against-two is not negligible. Raising the population raises
  // every count in proportion, which reaches that floor without distorting the composition — the market
  // stays the same shape, there is just more of it. It is solved, not guessed, and reported.
  let popBoost = 1;
  const infeasible = new Map();   // industry id -> {got, tgt} where even the O/4 recipe misses the target
  capped.clear();
  let jobs = 0, popNonPeasant = 0, peasants = 0, gdp = 0;
  const settle = () => { applyCounts(); addSupport(); applyThroughput(); setPops(); setArmy(); };
  for (let round = 0; round < 4; round++) {
  for (let iter = 0; iter < 220; iter++) {
    settle();
    // PRICES: whatever this scenario's own order book produces, by the game's formula. Never assigned.
    const agg = E.scenarioAggregates();
    for (const g in S.PRICES) { const { buy, sell } = E.scenarioBuySell(agg, g); S.thresholds[g] = E.priceMultPct(buy, sell); }

    // PM CHOICE BELONGS INSIDE THE LOOP. Re-optimising after the counts have settled invalidates them —
    // a building that switches method changes what it buys and sells, so the counts that cleared the old
    // market no longer clear the new one. Re-chosen periodically (not every pass: it is the expensive
    // step, and letting counts settle between changes is what keeps the pair from chattering), then
    // FROZEN for the last stretch so the continuous variables can converge against a fixed choice.
    if (iter % 20 === 0 && iter < 160) {
      optimisePMs({ E, S, rules, era,
        profitOfTier: (i2, t2) => E.TPthr(i2, t2) / 100,
        profitOfRef: b => { const ec = E.refEcon(b); return (ec && ec.tp != null) ? ec.tp / 100 : -1; },
        maxPasses: 2 });
    }

    // At those prices, the era-current tier of each industry re-solves its INPUT volumes to hit its
    // target. This is the same lever Phase A used; it just now runs against realised prices.
    for (const p of placement) {
      const cur = p.rows[0].t;
      if (cur.era !== era || p.ind.follows_be === false) continue;
      solveInputsAt(p.ind, cur, currentTargetFor(p.ind));
    }

    // COUNTS chase the profit target. Supply and margin move opposite ways, so: earning more than the
    // target ⇒ build more of it ⇒ price falls ⇒ margin falls.
    //
    // ⚠ The adjustment is PER GOOD, not per building, and that distinction is load-bearing. Grain has
    // five producers (rye/wheat/rice/maize/millet farms) sharing ONE price, so at most one of them can sit
    // on its own target. Nudging each toward its own margin makes them fight: the efficient farm grows,
    // the price falls, the inefficient one shrinks toward the floor and reads −65% forever. Averaging the
    // gap over a good's producers, weighted by what each contributes, moves them together and leaves the
    // spread between them as what it actually is — a real difference in productivity, not a solver
    // artifact. It also means "significant variance is OK" is honoured rather than fought.
    const gain = iter < 10 ? 0.8 : (iter < 60 ? 0.35 : 0.15);
    // COUNTS CHASE THE PRICE PATH, not the margin. A good trading ABOVE its target is under-supplied, so
    // build more of it; below, build fewer. This is a live error signal for the whole run, unlike the
    // margin gap, which `solveInputsAt` zeroes out every iteration.
    const goodF = {};
    for (const g in S.PRICES) {
      if (SKIP_GOODS.has(g)) continue;
      const want = targetPrice(g, era), got = S.thresholds[g];
      if (!(want > 0) || !(got > 0)) continue;
      goodF[g] = clamp(Math.pow(got / want, gain), 0.6, 1.7);
    }
    // The insolvency test still runs — it is what tells us an industry cannot reach its target at ANY
    // recipe, which is worth reporting even though counts no longer key off it.
    for (const p of placement) {
      const cur = p.rows[0].t;
      if (p.ind.follows_be === false) continue;
      const tgt = currentTargetFor(p.ind);
      const mm = maxMargin(p.ind, cur);
      if (mm < tgt) infeasible.set(p.ind.id, { got: mm, tgt }); else infeasible.delete(p.ind.id);
    }
    // apply each good's factor to every building that makes it, weighted by how much of that building's
    // revenue the good represents (a livestock ranch making meat AND fabric follows both, in proportion)
    const applyF = (key, goodsOut) => {
      let num = 0, den = 0;
      for (const g in goodsOut) {
        if (!(goodsOut[g] > 0) || goodF[g] == null) continue;
        const w = goodsOut[g] * (S.PRICES[g] || 0);
        num += w * Math.log(goodF[g]); den += w;
      }
      if (!(den > 0)) return;
      scaleOf[key] = clamp(scaleOf[key] * Math.exp(num / den), 0.02, 1e7);
    };
    for (const p of placement) {
      const io = E.tierGoodsIO(p.ind, p.rows[0].t);
      applyF('I:' + p.ind.id, io.out);
    }
    for (const b of refProducers) applyF('R:' + b, E.selGoods(E.refSel(b)).out);

    // Then rescale EVERYTHING uniformly so the buildings employ exactly the working adults the
    // population provides. Uniform, so it cannot disturb the ratios the step above just set — this sets
    // the SIZE of the economy, not its shape.
    jobs = totalJobs();
    popNonPeasant = POP_TOTAL[eIx] * popBoost * (1 - PEASANT_SHARE[eIx]);
    const jobPool = popNonPeasant * WORK_RATIO;
    if (jobs > 0) {
      const f = clamp(jobPool / jobs, 0.5, 2.0);
      for (const k in scaleOf) scaleOf[k] *= Math.pow(f, iter < 10 ? 1.0 : 0.5);
    }
  }
  settle();
  // THE INTEGER FLOOR IS THE ONLY NON-PROPORTIONAL THING IN THIS MODEL, which is what makes scaling the
  // market up a real fix rather than a no-op. Every price here is a ratio of buy to sell orders, so
  // multiplying the whole economy changes nothing — EXCEPT that a tier wanting 0.4 levels cannot have them
  // and must sit at 1, flooding its own market. Measured in era 1: one steel e1 plus one steel e2 sold 199
  // against a buy of 40, with pops buying no steel at all; groceries 162 against 74; paper 122 against 47.
  // Scale the market up and the same tier can finally hold the fraction it actually wants.
  //
  // ⚠ MEDIAN, not min. Measuring the SMALLEST main tier never terminates, because art academies and
  // vineyards want fewer than one level at ANY scale — they are permanently floored, and chasing them
  // produced a country of 10 billion people on the first attempt. The median is robust to exactly that
  // tail without having to name the offenders. Capped per round and overall, so an era that cannot
  // converge fails loudly at a large number rather than running away.
  {
    const mains = placement.filter(p => p.rows[0].weight > 0)
      .map(p => S.BLDNUM[p.rows[0].t.key] || 0).sort((a, b) => a - b);
    if (!mains.length) break;
    const med = mains[Math.floor(mains.length / 2)];
    const MIN_MAIN_LEVELS = MIN_MAIN_LEVELS_BY_ERA[eIx];
    if (med >= MIN_MAIN_LEVELS || popBoost >= POP_BOOST_CAP) break;
    popBoost = Math.min(POP_BOOST_CAP, popBoost * Math.min(3, MIN_MAIN_LEVELS / Math.max(1, med)));
  }
  }
  settle();
  { const agg = E.scenarioAggregates();
    for (const g in S.PRICES) { const { buy, sell } = E.scenarioBuySell(agg, g); S.thresholds[g] = E.priceMultPct(buy, sell); } }

  // THE HARD RULE: at the prices this market actually produces, every building must be running the most
  // profitable secondary methods available to it. Phase A chose PMs against its own fitted prices, which
  // are not these — so the choice has to be re-made here, or the scenario asserts an optimum it does not
  // have. Any pair that will not settle is a genuine limit cycle and is reported by name, never hidden.
  const pmResult = optimisePMs({
    E, S, rules, era,
    profitOfTier: (i, t) => { const k = E.thruMult(t.key), I = k * E.inputValue(t, true), Wc = E.wageCost(t), C = I + Wc;
      return C > 0 ? (k * E.outputValue(i, t, true) - C) / C : -1; },
    profitOfRef: b => { const ec = E.refEcon(b); return (ec && ec.tp != null) ? ec.tp / 100 : -1; },
  });
  settle();
  { const agg = E.scenarioAggregates();
    for (const g in S.PRICES) { const { buy, sell } = E.scenarioBuySell(agg, g); S.thresholds[g] = E.priceMultPct(buy, sell); } }

  // Re-solve inputs one final time at the settled prices, for the tiers whose era this is.
  for (const p of placement) {
    const cur = p.rows[0].t;
    if (cur.era === era && p.ind.follows_be !== false) solveInputsAt(p.ind, cur, currentTargetFor(p.ind));
  }

  // ---- helpers that ride on the current counts ----------------------------------------------------
  function totalJobs() {
    let n = 0;
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) n += c * E.empTotal(E.tierEmp(t)); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || E.isSubsistenceBuilding(b)) continue;
      n += c * E.empTotal(E.selEmp(E.refSel(b))); }
    return n;
  }
  function addSupport() {
    // non-subsistence levels placed so far drive the support shares
    let base = 0;
    for (const i of S.IND) for (const t of i.tiers) base += S.BLDNUM[t.key] || 0;
    for (const b of refProducers) base += S.BLDNUM[b] || 0;
    for (const kind in SUPPORT_SHARE) {
      const list = SUPPORT_BLD[kind].filter(b => S.VAN.buildings[b]);
      if (!list.length) continue;
      const total = Math.max(1, Math.round(base * SUPPORT_SHARE[kind] / (1 - Object.values(SUPPORT_SHARE).reduce((a, c) => a + c, 0))));
      const each = Math.max(1, Math.round(total / list.length));
      for (const b of list) S.BLDNUM[b] = each;
    }
    // URBAN CENTRES — derived, never placed: floor(Σ urbanization / 100), FINDINGS F13.
    let urb = 0;
    for (const b in S.BLDNUM) { if (isUrban(b)) continue; urb += (S.BLDNUM[b] || 0) * urbanizationOf(ourVanillaAnchor(b)); }
    S.BLDNUM.building_urban_center = Math.max(1, Math.floor(urb / URBAN_PER_LEVEL));
  }
  // a tier building urbanizes exactly as much as the vanilla building it replaced
  function ourVanillaAnchor(b) {
    if (!S.OURS.has(b)) return b;
    for (const i of S.IND) for (const t of i.tiers) if (t.key === b) return i.tiers[0].key;
    return b;
  }
  function setPops() {
    // strata from the employment mix, peasants from the era's share, subsistence from the peasants
    const byStratum = { lower: 0, middle: 0, upper: 0 };
    const addEmp = (emp, c) => { for (const p in emp) { const s = stratumOf(p); if (s) byStratum[s] += emp[p] * c; } };
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) addEmp(E.tierEmp(t), c); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || E.isSubsistenceBuilding(b)) continue;
      addEmp(E.selEmp(E.refSel(b)), c); }
    const nonPeasant = (byStratum.lower + byStratum.middle + byStratum.upper) / WORK_RATIO;
    peasants = nonPeasant * PEASANT_SHARE[eIx] / Math.max(1e-9, 1 - PEASANT_SHARE[eIx]);
    S.POPS = {
      total: Math.round(nonPeasant + peasants),
      lower: Math.round(byStratum.lower / WORK_RATIO),
      middle: Math.round(byStratum.middle / WORK_RATIO),
      upper: Math.round(byStratum.upper / WORK_RATIO),
      peasants: Math.round(peasants), slaves: 0,
    };
    // subsistence follows the peasants: staffed-level equivalent, the way the placeholder presets do it
    const lvl = Math.max(0, Math.round(peasants * WORK_RATIO / SUBSISTENCE_JOBS_PER_LEVEL));
    if (lvl > 0) S.BLDNUM.building_subsistence_farm = lvl;
  }
  function setArmy() {
    Object.keys(S.UNITNUM).forEach(k => delete S.UNITNUM[k]);
    // GDP proxy: the value of everything the market's buildings produce, at this era's prices. It is a
    // GROSS-output proxy, not value added — stated rather than hidden, because 5% of GDP means nothing
    // without saying which GDP.
    gdp = 0;
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) gdp += c * E.outputValue(i, t, true); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c) continue;
      gdp += c * E.goodsVal(E.selGoods(E.refSel(b)).out, true); }
    const budget = gdp * ARMY_GDP_SHARE;
    const mix = ARMY_MIX[era] || ARMY_MIX[5];
    let unitCost = 0;
    for (const [u, w] of mix) unitCost += w * E.goodsVal(E.unitGoodsIO(u).in, true);
    if (!(unitCost > 0)) return;
    const groups = budget / unitCost;
    for (const [u, w] of mix) S.UNITNUM[E.unitRowKey(u, false)] = Math.max(1, Math.round(groups * w));
  }

  // COMPOSITION SANITY. A scenario in which one industry is most of the economy is broken however neatly
  // its own margin solves — "40% of GDP is paper mills" is the failure this catches.
  const share = [];
  for (const i of S.IND) {
    let v = 0;
    for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) v += c * E.thruMult(t.key) * E.outputValue(i, t, true); }
    if (v > 0) share.push({ id: i.id, v });
  }
  let refTotal = 0;
  for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (c) refTotal += c * E.thruMult(b) * E.goodsVal(E.selGoods(E.refSel(b)).out, true); }
  const gross = share.reduce((a, s) => a + s.v, 0) + refTotal;
  share.forEach(s => { s.share = s.v / Math.max(1, gross); });
  share.sort((a, b) => b.share - a.share);

  // ---- SECTOR COMPOSITION, at realised prices --------------------------------------------------------
  // Where does this economy's output value actually come from? Split so it can be held against vanilla
  // telemetry: manufacturing that consumes other MANUFACTURED goods ("high"), manufacturing fed only by
  // raw goods ("low"), and the raw side broken out — agriculture (incl. fishing and whaling), logging,
  // and ore, with ore's own composition, since "is the ore mix plausible" is its own question.
  const MANUFACTURED = new Set();
  for (const i2 of S.IND) for (const t2 of i2.tiers) MANUFACTURED.add(E.tierOut(i2, t2));
  const sec = { mfg_high: 0, mfg_low: 0, agri: 0, logging: 0, ore: 0, other: 0 };
  const ore = {};
  for (const i2 of S.IND) for (const t2 of i2.tiers) {
    const c = S.BLDNUM[t2.key] || 0; if (!c) continue;
    const v = c * E.thruMult(t2.key) * E.outputValue(i2, t2, true);
    const usesMfg = Object.keys(t2.inputs).some(g => MANUFACTURED.has(g));
    sec[usesMfg ? 'mfg_high' : 'mfg_low'] += v;
  }
  for (const b of E.refBuildings()) {
    const c = S.BLDNUM[b] || 0; if (!c || E.isSubsistenceBuilding(b)) continue;
    const g2 = E.selGoods(E.refSel(b)).out;
    const v = c * E.thruMult(b) * E.goodsVal(g2, true);
    if (!(v > 0)) continue;
    const cat = catOf(b);
    if (cat === 'logging') sec.logging += v;
    else if (AGRICULTURE_CATS.has(cat) || cat === 'fishing_whaling') sec.agri += v;
    else if (cat === 'mining' || cat === 'gold_fields' || cat === 'oil' || cat === 'rubber') {
      sec.ore += v;
      for (const g in g2) { if (!(g2[g] > 0)) continue;
        ore[g] = (ore[g] || 0) + c * E.thruMult(b) * g2[g] * (S.PRICES[g] || 0) * ((S.thresholds[g] ?? 100) / 100); }
    } else sec.other += v;
  }

  return { eIx, era, jobs, gdp, peasants, popNonPeasant, scaleOf, pmResult, share, gross, popBoost,
           infeasible: new Map(infeasible), capped: new Set(capped), sec, ore };
}

// ===================================================================================================
const out = [];
const META = [];
const ERAS_HDR = () => FIT.eras.map(x => W('e' + x.era, 10)).join('');
console.log('\n=========== PHASE B — five scenarios, prices unlocked ===========');
for (let e = 0; e < FIT.eras.length; e++) {
  const meta = buildScenario(e);
  META.push(meta);
  // record what this era actually cleared at, so the NEXT era can target a decay off it
  REALISED[e] = {}; for (const g in S.PRICES) REALISED[e][g] = S.thresholds[g];
  const cfg = FIT.eras[e];
  const agg = E.scenarioAggregates();

  // THE OBJECTIVE: did the era-current tiers and the raw producers land on their profit targets, at the
  // prices this scenario's own order book produces? Everything else is commentary.
  const hits = [];
  for (const i of S.IND) {
    const avail = [...i.tiers].sort((a, b) => a.era - b.era).filter(t => t.era <= meta.era);
    if (!avail.length || i.follows_be === false) continue;
    const cur = avail[avail.length - 1];
    if (!S.BLDNUM[cur.key]) continue;
    const p = E.TPthr(i, cur) / 100;                      // throughput-aware, same as the solve
    if (!isFinite(p)) continue;
    const tgt = TG.current + (SHIP_INDUSTRIES.has(i.id) ? TG.shipyard_penalty : 0);
    hits.push({ what: i.id, kind: 'tier e' + cur.era, got: p, tgt, off: p - tgt });
  }
  for (const b of E.refBuildings()) {
    if (!S.BLDNUM[b] || E.isSubsistenceBuilding(b)) continue;
    const c = catOf(b);
    if (!EXTRACTION_CATS.has(c) && !AGRICULTURE_CATS.has(c)) continue;
    if (SKIP_TARGET_BLD.has(b)) continue;   // gold: see SKIP_GOODS
    const ec = E.refEcon(b); if (!ec || ec.tp == null) continue;
    hits.push({ what: b.replace(/^building_/, ''), kind: c, got: ec.tp / 100, tgt: refTargetFor(b), off: ec.tp / 100 - refTargetFor(b) });
  }
  // FLOORED: the solver wanted FEWER than one level of this building and could not have it. A single
  // level already floods that good's market, so the price sits at the floor and the margin cannot be
  // rescued by any count. That is not a solver miss — it is a real property of a one-country scenario
  // with no exports: a market this size cannot support even one art academy or one vineyard at the
  // target margin. Scored separately, because lumping it in with genuine misses hides both.
  for (const h of hits) {
    const key = h.kind.startsWith('tier') ? 'I:' + h.what : 'R:building_' + h.what;
    h.floored = (meta.scaleOf[key] != null && meta.scaleOf[key] < 0.95 && h.off < 0);
  }
  const scored = hits.filter(h => !h.floored);
  const onTgt = scored.filter(h => Math.abs(h.off) <= 0.08).length;
  const meanOff = scored.reduce((a, h) => a + Math.abs(h.off), 0) / Math.max(1, scored.length);
  scored.sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
  const levels = Object.values(S.BLDNUM).reduce((a, c) => a + c, 0);
  const subs = S.BLDNUM.building_subsistence_farm || 0;
  console.log(`\n--- era ${meta.era}  (${cfg.year}, "${cfg.label}")  SoL ${cfg.sol}  base wage £${cfg.base_wage.toFixed(4)}/wk`);
  console.log(`    pops ${fmtN(S.POPS.total)}  = upper ${fmtN(S.POPS.upper)} · middle ${fmtN(S.POPS.middle)} · lower ${fmtN(S.POPS.lower)} · peasants ${fmtN(S.POPS.peasants)} (${Math.round(100 * S.POPS.peasants / S.POPS.total)}%)`);
  console.log(`    buildings ${fmtN(levels)} levels (${fmtN(subs)} subsistence, ${fmtN(S.BLDNUM.building_urban_center || 0)} urban centres)  jobs ${fmtN(meta.jobs)}`);
  console.log(`    GDP proxy £${fmtN(Math.round(meta.gdp))}/wk   army ${fmtN(Object.values(S.UNITNUM).reduce((a, c) => a + c, 0))} battalions at ${Math.round(ARMY_GDP_SHARE * 100)}% of it`);
  const floored = hits.filter(h => h.floored);
  console.log(`    PROFIT TARGETS at the realised prices: ${onTgt}/${scored.length} within 8pp, mean |off| ${(meanOff * 100).toFixed(1)}pp`
    + (floored.length ? `  (+${floored.length} floored at 1 level — market too small for even one)` : ''));
  console.log('      worst: ' + scored.slice(0, 7).map(h => `${h.what} ${(h.got * 100).toFixed(0)}%/${(h.tgt * 100).toFixed(0)}%`).join('  '));
  if (floored.length) console.log('      floored: ' + floored.map(h => h.what).join(', '));
  // the hard PM rule, and the composition check
  console.log(`    PM optimality: ${meta.pmResult.settled ? 'SETTLED' : 'DID NOT SETTLE'} after ${meta.pmResult.passes} pass(es)`
    + (meta.pmResult.cycles.length ? `  ⚠ ${meta.pmResult.cycles.length} limit cycle(s): `
        + meta.pmResult.cycles.slice(0, 3).map(c => `${c.building.replace(/^building_/, '')}/${c.pmg.replace(/^pmg_/, '')}`).join(', ') : ''));
  if (meta.capped.size) console.log(`    value-added ceiling (${MFG_IO_CAP}:1) binds on ${meta.capped.size} tier(s): `
    + [...meta.capped].slice(0, 6).map(k => k.replace(/^building_/, '')).join(', '));
  if (meta.infeasible.size) console.log(`    ⚠ INSOLVENT at these prices — even the ${MFG_IO_CAP}:1 recipe misses target: `
    + [...meta.infeasible].map(([id, v]) => `${id} (best ${(v.got * 100).toFixed(0)}% vs ${(v.tgt * 100).toFixed(0)}%)`).join(', '));
  // ---- ILLOGICALITY: the three ways a scenario can be internally incoherent, counted per industry.
  // They SUM — a top tier that is both loss-making and beaten by the tier below it scores 2, because
  // those are two separate things wrong with it.
  //   1. the era-appropriate tier loses money
  //   2. a two-eras-stale tier still turns a profit (it should have been driven out)
  //   3. the era-appropriate tier earns LESS than the tier one era below it (the ladder runs backwards)
  const ill = { insolvent: [], stale_profitable: [], inverted: [] };
  for (const i of S.IND) {
    if (i.follows_be === false) continue;
    const av = [...i.tiers].sort((a, b) => a.era - b.era).filter(t => t.era <= meta.era && S.BLDNUM[t.key] > 0);
    if (!av.length) continue;
    const cur = av[av.length - 1], m1 = av[av.length - 2], m2 = av[av.length - 3];
    const pc = E.TPthr(i, cur) / 100;
    // ⚠ "Insolvent" means losing money it was NOT meant to lose. Shipyards carry a deliberate −30pp
    // penalty because none of their naval-construction income is modelled, so their target is negative by
    // construction and a shipyard sitting at −10% is exactly on target, not a fault. Counting it was a
    // false positive worth 1–2 points per era.
    const curTgt = TG.current + (SHIP_INDUSTRIES.has(i.id) ? TG.shipyard_penalty : 0);
    if (pc < Math.min(0, curTgt)) ill.insolvent.push(i.id);
    if (m2 && E.TPthr(i, m2) / 100 > 0) ill.stale_profitable.push(i.id);
    if (m1 && pc < E.TPthr(i, m1) / 100) ill.inverted.push(i.id);
  }
  meta.ill = ill;
  const illTot = ill.insolvent.length + ill.stale_profitable.length + ill.inverted.length;
  // EXCUSED by design: shipyards run at a negative target because naval-construction income is not
  // modelled, and art academies cannot be sized by margin at all (fine_art's budget is fixed, so extra
  // academies only destroy their own price). Counted separately so the headline reflects real faults.
  const EXCUSED = new Set(['shipyard', 'shipyard_steam', 'art_academy']);
  const ex = n => n.filter(x => EXCUSED.has(x)).length;
  const net = (ill.insolvent.length - ex(ill.insolvent)) + (ill.stale_profitable.length - ex(ill.stale_profitable))
            + (ill.inverted.length - ex(ill.inverted));
  console.log(`    ILLOGICAL: ${illTot} point(s) (${net} excluding shipyards/art academies) — loss-making `
    + `${ill.insolvent.length} [${ill.insolvent.join(' ') || '-'}], 2-eras-stale profitable `
    + `${ill.stale_profitable.length} [${ill.stale_profitable.join(' ') || '-'}], inverted `
    + `${ill.inverted.length} [${ill.inverted.join(' ') || '-'}]`);
  const top = meta.share.slice(0, 4).map(s => `${s.id} ${(s.share * 100).toFixed(0)}%`).join('  ');
  const overweight = meta.share.filter(s => s.share > GDP_SHARE_WARN);
  console.log(`    composition (share of gross output): ${top}`
    + (overweight.length ? `   ⚠ OVER ${Math.round(GDP_SHARE_WARN * 100)}%: ${overweight.map(s => s.id).join(', ')}` : '   ok'));
  const px = Object.keys(S.PRICES).filter(g => S.thresholds[g] !== 100).sort((a, b) => S.thresholds[b] - S.thresholds[a]);
  console.log('      dearest: ' + px.slice(0, 6).map(g => `${g} ${S.thresholds[g]}`).join('  ')
            + '   cheapest: ' + px.slice(-6).map(g => `${g} ${S.thresholds[g]}`).join('  '));

  out.push({
    id: `era${meta.era}_${cfg.year}`,
    label: `Era ${meta.era} · ${cfg.year}`,
    group: 'Era ladder · solved, prices unlocked',
    country: null,
    base_wage: cfg.base_wage,
    base_wage_note: `era ${meta.era} lower-stratum SoL ${cfg.sol} via FINDINGS F26, base = exp((SoL−37.43)/10.49)`,
    market: [],
    buildings: { ...S.BLDNUM },
    pms: (() => { const o = {}; for (const i of S.IND) for (const t of i.tiers) if (S.BLDNUM[t.key]) o[t.key] = { ...t._sec };
                  for (const b in S.REFSEL) if (S.BLDNUM[b]) o[b] = { ...S.REFSEL[b] }; return o; })(),
    pops: { ...S.POPS },
    sol: { ...S.SOL },
    units: (() => { const o = {}; for (const k in S.UNITNUM) o[k.replace(/\|peace$/, '')] = S.UNITNUM[k]; return o; })(),
    nonbuy: {}, nonsell: {},
    // the throughput the SOLVE used — without carrying it, the UI prices every building at k=1 and its
    // Profit column answers a different question from the solver's
    throughput: { ...S.THRU },
    // the prices this scenario's OWN order book produces — carried so the preset can be checked against
    // the UI's live "auto" price mode, which must reproduce them exactly
    prices: (() => { const o = {}; for (const g in S.PRICES) o[g] = S.thresholds[g]; return o; })(),
    subsistence: { free_arable: 0, capacity_jobs: Math.round(meta.peasants * WORK_RATIO),
                   peasant_workforce: Math.round(meta.peasants * WORK_RATIO), staffing: 1.0,
                   levels: S.BLDNUM.building_subsistence_farm || 0 },
    measured: null,
    notes: [`Synthetic era-${meta.era} scenario, solved by tools/era_solver.mjs + tools/era_scenarios.mjs.`,
            `Prices are SOLVED, not chosen — untick "locked" in the price column to see the market reproduce them.`,
            `Population ${fmtN(S.POPS.total)} with ${Math.round(100 * PEASANT_SHARE[meta.eIx])}% peasants is the scenario's premise; every building count follows from it.`,
            `Army is ${Math.round(ARMY_GDP_SHARE * 100)}% of a GROSS-output GDP proxy, in era-appropriate battalions only.`],
  });
}

// ---------------------------------------------------------------------------------------------------
// SECTOR COMPOSITION across all five scenarios, at realised prices. The question this answers is not
// "did each margin solve" but "does this look like an economy" — and it is the one to hold against
// vanilla telemetry, because vanilla's own sector split is measurable and ours is not obviously right.
console.log('\n=========== SECTOR COMPOSITION — share of total output value, at realised prices ===========\n');
const SEC_LABEL = { mfg_high: 'manufacturing (mfg inputs)', mfg_low: 'manufacturing (raw inputs)',
                    agri: 'agriculture + fish/whaling', logging: 'logging', ore: 'ore, oil & rubber', other: 'other' };
console.log(W('sector', 30) + ERAS_HDR());
for (const k of ['mfg_high', 'mfg_low', 'agri', 'logging', 'ore', 'other']) {
  console.log(W(SEC_LABEL[k], 30) + META.map(m => {
    const tot = Object.values(m.sec).reduce((a, c) => a + c, 0);
    return W((100 * m.sec[k] / Math.max(1, tot)).toFixed(1) + '%', 10);
  }).join(''));
}
console.log('\n' + W('ORE COMPOSITION (within ore)', 30) + ERAS_HDR());
{
  const goods = [...new Set(META.flatMap(m => Object.keys(m.ore)))].sort();
  for (const g of goods) {
    console.log(W('  ' + g, 30) + META.map(m => {
      const tot = Object.values(m.ore).reduce((a, c) => a + c, 0);
      return W(m.ore[g] ? (100 * m.ore[g] / Math.max(1, tot)).toFixed(1) + '%' : '-', 10);
    }).join(''));
  }
}
console.log('\n⚠ The ore block counts ORE-CATEGORY BUILDINGS ONLY, so it is not a supply table for those goods.');
console.log('  OIL in particular also comes from WHALING STATIONS, which are ungated and present from 1836 —');
console.log('  that oil is filed under "agriculture + fish/whaling" above, so oil reading "-" in e1/e2 means');
console.log('  "no oil RIGS yet" (Drake\'s well is 1859), not "no oil". Same shape of caveat for any good with');
console.log('  producers in more than one category.');
console.log('\n⚠ NOT yet checked against vanilla telemetry. The measurement that would settle it is a run\n'
  + '  with the `building_inventory` metric, which no existing session carries — see CLAUDE.md.');

if (WRITE) {
  // ⚠ THE VOLUMES MUST GO BACK TOO. This solver re-derived every tier's input recipe against the prices
  // its own order book produces, which are NOT the prices Phase A assumed. Writing the presets without
  // the volumes would ship building counts fitted to one recipe and a config holding another, and the
  // scenario would simply not reproduce when loaded in the UI.
  const CFG = join(REPO, 'config', 'mod_config.json');
  const cfg = JSON.parse(readFileSync(CFG, 'utf8'));
  const byKey = {}; for (const i of S.IND) for (const t of i.tiers) byKey[t.key] = t;
  let nv = 0;
  for (const ind of cfg.industries) for (const t of ind.tiers) {
    const solved = byKey[t.key]; if (!solved || ind.follows_be === false) continue;
    t.inputs = { ...solved.inputs };
    // restate the legacy BE target so lint_profitability.awk keeps working as a DRIFT GUARD
    const outGood = t.output_good || ind.output_good;
    const Obase = t.output_qty * (S.PRICES[outGood] || 0);
    let Ibase = 0; for (const g in t.inputs) Ibase += t.inputs[g] * (S.PRICES[g] || 0);
    const wp = t.wage_pct != null ? +t.wage_pct : 0.25;
    if (Obase > 0) t.target_be = Math.round(Ibase / ((1 - wp) * Obase) * 100);
    nv++;
  }
  writeFileSync(CFG, JSON.stringify(cfg), 'utf8');
  console.log(`\nWROTE ${nv} tier input recipes (re-solved at the REALISED prices) to ${CFG}`);

  const p = join(REPO, 'config', 'era_presets.json');
  writeFileSync(p, JSON.stringify({
    _comment: 'GENERATED by tools/era_scenarios.mjs from config/era_prices.json. Five synthetic scenarios, one '
      + 'per era of the mod\'s own tech ladder, each solved so its order book reproduces the fitted price path. '
      + 'Read by tools/extract_presets.ps1 and appended to ui/presets.js. Committed, because a scenario is a '
      + 'design input.',
    presets: out,
  }, null, 1), 'utf8');
  console.log(`\nWROTE ${out.length} era presets to ${p}`);
} else {
  console.log('\n(report only — pass --write to save config/era_presets.json)');
}
