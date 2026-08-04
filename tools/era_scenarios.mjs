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
const SUPPORT_SHARE = { ownership: 0.32, government: 0.06, trade: 0.035 };
// ---------------------------------------------------------------------------------------------------
// CONSTRUCTION IS SIZED BY ITS SHARE OF GDP, NOT BY A SHARE OF BUILDING LEVELS, and its method is FIXED.
//
// A construction sector's level count is not something the market solves for: it sells nothing, so no
// margin steers it, and a level share is the wrong unit anyway — what a country spends on building things
// is a share of what it produces. So the count is derived from a target share of gross output, and the
// solver takes both that and the method as given.
//
// MEASURED AGAINST VANILLA, under this same accounting (construction goods bill ÷ gross output value, at
// base prices, on the vanilla 1836 markets): Qing 0.66%, Russia 1.19%, Japan 1.61%, Britain 2.28%,
// France 3.76%, Austria 4.13%, USA 4.63%, Belgium 6.30% — median ~3.0%, industrialised markets 2.3–6.3%.
// We take 10% — ABOVE the vanilla range, deliberately and with eyes open.
//
// ⚠ BE HONEST ABOUT WHAT THIS KNOB IS. Neither investment nor government spending is simulated here, so the
// construction sector is the one thing in the scenario that is pure DEMAND with no supply: it buys goods
// and sells nothing. That makes it a demand injection, and it means almost any average profitability could
// be manufactured just by pumping it. So this number must be a stated premise, never a lever to tune the
// margins with — if a target is ever "achieved" by raising it, nothing has been achieved.
//
// 10% is roughly double vanilla's industrial end, which is the intended direction (modernising has to be
// BUILT, and raising the demand for capital is the mod's whole point), and it is written down here rather
// than discovered in the numbers.
const CONSTRUCTION_GDP_SHARE = +(process.env.ERA_CONSTRUCTION_SHARE || 0.10);
// THE METHOD IS HARDCODED PER ERA. It cannot be chosen by profit (no priced output) and it should not be
// left to drift; a construction sector's frame material is a fact about the era, not a market outcome.
// ⚠ ERA 4 IS STEEL FRAME, NOT ARC WELDED. Vanilla gates `pm_arc_welded_buildings` on the `arc_welding`
// technology, which sits in vanilla's era 5, and §10.8's standing rule is that technology is the one gate
// the solver satisfies freely with the vanilla era remapped 1:1. Historically defensible too — arc welding
// existed in the 1920s but did not become the normal way to frame a building until later. Change this one
// line to `pm_arc_welded_buildings` if era 4 should have it anyway.
const CONSTRUCTION_PM = {
  1: 'pm_iron_frame_buildings', 2: 'pm_iron_frame_buildings',
  3: 'pm_steel_frame_buildings', 4: 'pm_steel_frame_buildings',
  5: 'pm_arc_welded_buildings',
};
const CONSTRUCTION_BLD = 'building_construction_sector';
// ===================================================================================================
// FREE ENTRY: A MANUFACTURING INDUSTRY EARNING MORE THAN +25% GROWS UNTIL IT DOESN'T.
//
// An industry sitting on an unusually fat margin in a market anyone can enter is not an equilibrium — the
// margin should be competed away by new capacity. So each era-appropriate manufacturing tier above the cap
// is built ONE LEVEL AT A TIME until it drops under it.
//
// ⚠ FULLY REVERTABLE: `ERA_PROFIT_CAP=0` disables it entirely and the solve returns to its previous
// behaviour. Kept as a switch on purpose — this is a rule whose consequences are judged after the fact
// (does it produce an economy that is 90% factories? does it starve the raw sectors into fat margins?),
// so being able to take it back out without unpicking anything is part of the design.
//
// ⚠ THE +75% CEILING STILL BINDS AND OUTRANKS IT. Growing a manufacturer raises its demand for inputs, so
// a step that pushes a consumable good to the band edge is undone and that industry stops growing — the
// same precedence already used when dropping loss-making raw producers.
const PROFIT_CAP_ON = process.env.ERA_PROFIT_CAP !== '0';
const PROFIT_CAP = +(process.env.ERA_PROFIT_CAP_PCT || 0.25);
const PROFIT_CAP_STEPS = +(process.env.ERA_PROFIT_CAP_STEPS || 400);
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
// Place one level of the NEXT era's tier as a forward probe. Kept only as a switch to re-measure the
// defect it caused (see `placement` below); it is off, and should stay off.
const PROBE = process.env.ERA_PROBE === '1';
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
//
// THREE BANDS, not two (BALANCE_FRAMEWORK §10.13). One decay for every manufactured good deflates a deep
// chain's INPUTS and its OUTPUT together, which leaves obsolescence nothing to bite on: automotive eats
// engines, steel and tools, so if all four fall 18% per era its stale tier's margin never moves. Giving
// intermediates a slower decay opens the gap the mechanism needs.
//
// ⚠ The two bands pull in OPPOSITE directions and the balance between them is the whole design question.
// A slow intermediate decay is what squeezes the industries that EAT intermediates — and it simultaneously
// spares the stale tiers of the industries that MAKE them, because steel's own obsolescence driver is its
// output price falling against flat raw inputs. Neither band can be set without the other in view.
// What keeps both liveable is that WAGES DO NOT DEFLATE: the base wage rises with the era's SoL (0.0605 →
// 0.1297 over the five eras, ~1.46× per two eras) while an old tier's output is fixed, so a fixed cost
// that grows carries part of the obsolescence load and neither band has to carry all of it.
const PRICE_START = +(process.env.PRICE_START || 155);
const PRICE_DECAY = +(process.env.PRICE_DECAY || 0.82);
const PRICE_FLOOR = +(process.env.PRICE_FLOOR || 75);
// Intermediates: their own start, decay and floor. Defaults are the solved values (see §10.13).
const PRICE_START_INT = +(process.env.PRICE_START_INT || PRICE_START);
const PRICE_DECAY_INT = +(process.env.PRICE_DECAY_INT || 0.86);
const PRICE_FLOOR_INT = +(process.env.PRICE_FLOOR_INT || PRICE_FLOOR);
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

// A BUILDING WITH NO PRICED OUTPUT CANNOT BE RANKED BY PROFIT — so it must be told what to run.
//
// `optimisePMs` scores a method by the building's margin. For a building that sells nothing — the
// construction sector above all, but also government administration and the military buildings — that
// margin is undefined, every candidate ties, and the incumbent therefore never moves. The incumbent is the
// PMG's first entry, which is the most primitive method in the group.
//
// ⚠⚠ THE COST OF THAT WAS LARGE AND IT RAN FOR THE WHOLE PROJECT. Every era's construction sector sat on
// `pm_wooden_buildings`, the *era-0* method: 75 wood and 25 fabric per level, at 74–92 levels, in 1935 as
// much as in 1836. So construction never bought iron, steel, glass, explosives, tools or electricity in any
// scenario, while inflating wood demand by thousands of units — which is most of the "wood famine" earlier
// blamed on logging camps, and the reason era-1 iron demand was 704 when the real figure is several
// thousand. A country that builds its factories out of wood in 1935 is not a country.
//
// The rule: such a building runs the most ADVANCED method its technology allows.
// ⚠ "Most advanced" is by TECH ERA, not by position in the list. The last entry is often not the newest —
// `pmg_transportation_building_logging_camp` ends on `pm_log_carts`, which is the primitive one.
function advanceNonMarketPMs(era) {
  // The construction sector's method is STATED, not derived — and it is set unconditionally, before
  // anything checks whether the building is present. It has to be: its level count is now derived FROM
  // its goods bill (sizeConstruction), so the method must be known while the count is still zero.
  // Guarding this on `BLDNUM > 0` deadlocked the two and shipped a scenario with no construction at all.
  {
    const cs = S.VAN.buildings[CONSTRUCTION_BLD];
    if (cs) {
      const want = CONSTRUCTION_PM[era], sel = E.refSel(CONSTRUCTION_BLD);
      for (const pmg of (cs.pmgs || [])) if (((S.VAN.pmgs[pmg] || {}).pms || []).includes(want)) sel[pmg] = want;
    }
  }
  for (const b of E.refBuildings()) {
    if (!(S.BLDNUM[b] > 0)) continue;
    const out = E.selGoods(E.refSel(b)).out;
    if (Object.keys(out).some(g => out[g] > 0 && S.PRICES[g])) continue;   // sells something: profit ranks it
    const sel = E.refSel(b), info = S.VAN.buildings[b] || {};
    for (const pmg of (info.pmgs || [])) {
      const cand = rules.candidates(pmg, era, new Set(Object.values(sel)));
      if (!cand.length) continue;
      let best = cand[0], bestEra = rules.pmEra(cand[0]);
      for (const pm of cand) { const e = rules.pmEra(pm); if (e >= bestEra) { bestEra = e; best = pm; } }
      sel[pmg] = best;
    }
  }
}

// good -> first era any tier of ours produces it (manufactured), else null (raw / secondary)
const GOOD_FIRST_ERA = {};
for (const i of S.IND) {
  if (i.follows_be === false) continue;
  for (const t of i.tiers) {
    const g = E.tierOut(i, t);
    if (GOOD_FIRST_ERA[g] == null || t.era < GOOD_FIRST_ERA[g]) GOOD_FIRST_ERA[g] = t.era;
  }
}
// ===================================================================================================
// THE INDUSTRIAL PRICE CEILING — a HARD constraint, not a target.
//
// **No good that manufacturing can consume may reach +75% (the engine's 175% band ceiling).** −75% is
// fine, and +75% is fine for a purely consumer good; what is not acceptable is an INPUT pinned at the
// ceiling. At that point the market has run out of any ability to signal scarcity — the price cannot rise
// further however short the good is — so every industry downstream is priced against a wall, its recipe
// is solved against a number that is an artifact of the band rather than of the market, and the count
// feedback receives no gradient at all.
//
// SCOPE, deliberately simple: a good is restricted if it is an input to ANY production method reachable
// in any of our industry buildings — main recipes and every secondary PMG, across every era. "Consumable
// by industry", not "consumed by industry right now": a good that some era's method could buy is treated
// as restricted in all of them, because the alternative is a set that changes underfoot as the PM
// optimiser moves.
const CEILING = 175;            // the engine's own band edge
const CEIL_TARGET = 160;        // what the count feedback aims restricted goods AT MOST at, to leave slack
// The three levers that enforce it, individually switchable so each one's contribution can be measured
// rather than asserted. All ON; the switches exist for the A/B, not as configuration.
const CEIL_BOOST = process.env.ERA_CEIL_BOOST !== '0';   // counts: a breach outranks the revenue-weighted mean
const CEIL_PM    = process.env.ERA_CEIL_PM    !== '0';   // PM choice: a breach outranks profit
const JOINT_PASSES = +(process.env.ERA_JOINT || 8);      // price/PM/recipe fixed-point passes (1 = the old single pass)
const RESTRICTED = new Set();
for (const i of S.IND) {
  for (const t of i.tiers) {
    for (const g in t.inputs) if (t.inputs[g] > 0) RESTRICTED.add(g);
    for (const pmg of (i.secondary_pmgs || [])) {
      const grp = S.VAN.pmgs[pmg]; if (!(grp && grp.pms)) continue;
      for (const pm of grp.pms) { const r = E.pmRec(pm); for (const g in (r.in || {})) if (r.in[g] > 0) RESTRICTED.add(g); }
    }
  }
}
// ---------------------------------------------------------------------------------------------------
// WHICH BAND A GOOD IS IN — derived from the config, not from a hand-written list, so it follows the
// ladder rather than having to be maintained alongside it.
//
//   INTERMEDIATE = a tiered good that some LADDER industry eats as an input.
//   FINISHED     = every other tiered good (its demand is pops, the army, or construction).
//   RAW          = anything no tier of ours produces.
//
// The rule is the mechanism stated word for word: a good is an intermediate exactly when a tier's output
// price is another tier's input price, which is the coupling the third band exists to break.
//
// ⚠ `follows_be: false` consumers DO NOT COUNT. Port and railway are held on vanilla economics and are not
// on the ladder, so their appetite cannot define a band. That single exclusion settles clippers and
// steamers mechanically — port is their only industrial buyer, and they are otherwise pop leisure goods.
//
// ⚠ RECORDED JUDGEMENT CALL — GLASS. §10.13 listed glass as an intermediate on the strength of the name.
// The config disagrees: no tier of ours consumes glass, its demand is popneed_household_items, and it is
// therefore FINISHED here. Deriving the split rather than transcribing the list is what caught it.
const BAND = {};                       // good -> 'intermediate' | 'finished' | 'raw'
{
  const eaten = new Set();
  for (const i of S.IND) {
    if (i.follows_be === false) continue;
    for (const t of i.tiers) for (const g in t.inputs) if (t.inputs[g] > 0) eaten.add(g);
  }
  for (const g in S.PRICES) {
    BAND[g] = GOOD_FIRST_ERA[g] == null ? 'raw' : eaten.has(g) ? 'intermediate' : 'finished';
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
  const age = Math.max(0, era - f);
  const p = BAND[good] === 'intermediate'
    ? Math.max(PRICE_FLOOR_INT, PRICE_START_INT * Math.pow(PRICE_DECAY_INT, age))
    : Math.max(PRICE_FLOOR, PRICE_START * Math.pow(PRICE_DECAY, age));
  // A restricted good's path may not ASK for a price near the ceiling. PRICE_START of 155-175 in a good's
  // debut era is exactly such an ask, and the feedback would then be satisfied by the very state the
  // constraint forbids.
  return RESTRICTED.has(good) ? Math.min(CEIL_TARGET, p) : p;
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
  // Era-appropriate and one-era-old at EQUAL LEVEL COUNTS (the brief), and one level of the two-era-old
  // tier so the sheet shows its arithmetic — that one has to be present, because "is the two-eras-stale
  // tier still profitable" is one of the three illogicality faults and an absent building cannot be
  // scored.
  //
  // ⚠ THE FORWARD PROBE IS GONE, AND IT WAS THE LARGEST SINGLE DEFECT IN THESE SCENARIOS. One level of the
  // NEXT era's tier used to be placed in every industry, to "show the ladder from both sides". It was
  // scored by nothing — every check here filters to `era <= this era` — so it contributed supply and no
  // information. For a mature industry that was harmless. For a YOUNG one it was fatal: the probe is a
  // ×1.5-bigger plant than the tier it sits beside, so in a debut era it supplied MORE THAN HALF the
  // market, drove the good to the 25% floor, and made the era-appropriate tier read insolvent — after
  // which the count feedback saw an over-supplied good, tried to build fewer, and could not, because one
  // level is the floor. Measured before removal: era-1 steel sold 199 against a buy of 36 with the era-2
  // Bessemer probe supplying 101 of it; era-3 automobiles sold 92 against 45; era-3 telephones 184
  // against 32. All three were the goods reported as "insolvent at these prices".
  // It was also an anachronism on its own terms — a Bessemer converter (1856) standing in the 1836
  // scenario, and mass-production car plants in 1900.
  const placement = [];   // {ind, tiers:[{t, weight}]}
  for (const i of S.IND) {
    const sorted = [...i.tiers].sort((a, b) => a.era - b.era);
    const avail = sorted.filter(t => t.era <= era);
    if (!avail.length) continue;
    const cur = avail[avail.length - 1], m1 = avail[avail.length - 2], m2 = avail[avail.length - 3];
    const fx = FIXED_COUNTS[i.id];
    const rows = [{ t: cur, weight: fx ? 0 : 1, fixed: fx ? fx.cur : undefined }];
    if (m1) rows.push({ t: m1, weight: fx ? 0 : 1, fixed: fx ? fx.m1 : undefined });
    if (m2) rows.push({ t: m2, weight: 0, fixed: fx ? fx.m2 : 1 });
    if (PROBE) { const p1 = sorted.find(t => t.era > era); if (p1) rows.push({ t: p1, weight: 0, fixed: 1 }); }
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

  // ===================================================================================================
  // NO LOSS-MAKING RAW PRODUCER MAY BE PRESENT. A scenario that places a mine, a logging camp, a farm or
  // a plantation and has it run at a loss is not a picture of an economy — nobody operates one. The rule
  // is on NON-ZERO producers, which names its own escape: the remedy is not to build it. That is also the
  // economically honest one, and it is self-limiting, because removing a producer RAISES its good's price
  // and can make the remaining ones (or a rival good's) viable.
  //
  // ⚠ GOLD IS EXEMPT, for the same reason it is exempt from profit targets (SKIP_GOODS): no pop need lists
  // it and no building consumes it, so its order book is one-sided by construction and its mines read
  // about −68% at any size. That is an artifact of not modelling gold as money, not a loss anyone is
  // choosing to take, and dropping every gold mine would delete gold from the economy to fix a number.
  const dropped = new Set();
  const minCount = {};          // tier key -> floor imposed by the post-solve free-entry tuner
  const isRawProducer = b => {
    if (SKIP_TARGET_BLD.has(b)) return false;
    const c = catOf(b);
    return EXTRACTION_CATS.has(c) || AGRICULTURE_CATS.has(c);
  };
  const applyCounts = () => {
    Object.keys(S.BLDNUM).forEach(k => delete S.BLDNUM[k]);
    for (const p of placement) {
      const s = scaleOf['I:' + p.ind.id];
      // NOT floored at MIN_MAIN_LEVELS. Forcing ten levels of an industry a market only needs two of
      // makes it oversupplied by construction, crashes its price and guarantees a loss — the floor has to
      // be reached by making the ECONOMY bigger, not by overbuilding one industry into it. See popBoost.
      for (const r of p.rows) {
        const base = r.fixed != null ? r.fixed : Math.max(1, Math.round(s * r.weight));
        // `minCount` is the POST-SOLVE TUNER's floor (free entry, below). During the solve it is empty, so
        // this is a no-op; afterwards it holds counts the tuner added and the solver must not undo.
        S.BLDNUM[r.t.key] = Math.max(base, minCount[r.t.key] || 0);
      }
    }
    for (const b of refProducers) { if (dropped.has(b)) continue; S.BLDNUM[b] = Math.max(1, Math.round(scaleOf['R:' + b])); }
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
  // ⚠ advanceNonMarketPMs runs inside settle(), not once at the start: addSupport() places the construction
  // sector and the other non-selling buildings on every settle, and optimisePMs can evict a selection back
  // to a PMG's first (most primitive) entry. Anywhere less often and the wooden-buildings default creeps
  // back in unnoticed — which is exactly how it survived this long.
  const settle = () => { applyCounts(); addSupport(); applyThroughput(); advanceNonMarketPMs(era);
                         sizeConstruction(); setPops(); setArmy(); };
  // Construction levels follow the TARGET SHARE OF GROSS OUTPUT, not a share of building levels.
  // No circularity: the construction sector produces no priced good, so it contributes nothing to the
  // gross output it is sized against.
  //
  // ⚠ IT IS RE-SIZED ON EVERY SETTLE, and that is the point. It is not part of the price/count feedback —
  // it is never steered toward a margin and never enters `scaleOf` — but it must not be computed ONCE
  // either. The economy grows by large factors during a solve, and a count fixed from an early, small GDP
  // would leave the shipped scenario nowhere near its stated share. Recomputing costs nothing and makes
  // staleness impossible by construction. The ACHIEVED share is reported per era so this is checkable
  // rather than assumed.
  function constructionShare() {
    const n = S.BLDNUM[CONSTRUCTION_BLD] || 0; if (!n) return 0;
    const cost = n * E.thruMult(CONSTRUCTION_BLD) * E.goodsVal(E.selGoods(E.refSel(CONSTRUCTION_BLD)).in, true);
    let gross = 0;
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) gross += c * E.thruMult(t.key) * E.outputValue(i, t, true); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || b === CONSTRUCTION_BLD) continue;
      gross += c * E.thruMult(b) * E.goodsVal(E.selGoods(E.refSel(b)).out, true); }
    return gross > 0 ? cost / gross : 0;
  }
  function sizeConstruction() {
    if (!S.VAN.buildings[CONSTRUCTION_BLD]) return;
    let gross = 0;
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) gross += c * E.thruMult(t.key) * E.outputValue(i, t, true); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || b === CONSTRUCTION_BLD) continue;
      gross += c * E.thruMult(b) * E.goodsVal(E.selGoods(E.refSel(b)).out, true); }
    // ⚠ Compute the goods bill directly rather than via refEcon(): ui/econ.js's refEcon does NOT return
    // `Ith`/`Oth` (builder.html's copy of the same function does — the fork noted in CLAUDE.md), so reading
    // `per.Ith` here silently produced `undefined`, a zero cost, and a scenario with NO construction sector
    // at all. Depending on the return shape of the forked half of the model is not worth the brevity.
    const cost = E.thruMult(CONSTRUCTION_BLD) * E.goodsVal(E.selGoods(E.refSel(CONSTRUCTION_BLD)).in, true);
    if (!(cost > 0) || !(gross > 0)) return;
    S.BLDNUM[CONSTRUCTION_BLD] = Math.max(1, Math.round(CONSTRUCTION_GDP_SHARE * gross / cost));
  }

  // COUNTS CHASE THE PRICE PATH, not the margin. A good trading ABOVE its target is under-supplied, so
  // build more of it; below, build fewer. This is a live error signal for the whole run, unlike the
  // margin gap, which `solveInputsAt` zeroes out every iteration.
  //
  // ⚠ The adjustment is PER GOOD, not per building, and that distinction is load-bearing. Grain has five
  // producers (rye/wheat/rice/maize/millet farms) sharing ONE price, so at most one of them can sit on its
  // own target. Nudging each toward its own margin makes them fight: the efficient farm grows, the price
  // falls, the inefficient one shrinks toward the floor and reads −65% forever. Averaging the gap over a
  // good's producers, weighted by what each contributes, moves them together and leaves the spread between
  // them as what it actually is — a real difference in productivity, not a solver artifact.
  //
  // Hoisted out of the main loop so the FINAL JOINT SETTLE can use the same lever. It used to be inline,
  // which meant the joint settle ran with counts FROZEN — and counts are exactly what absorbs the movement
  // in this system, so freezing them left {price, PM, recipe} oscillating with nothing to damp it.
  function stepCounts(gain, rescalePow) {
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
    //
    // ⚠ THE CEILING OVERRIDES THE AVERAGE, and it has to. The weighted mean is the right rule for two goods
    // that merely disagree, and the WRONG one when a building makes a starved good and a glutted one at
    // once: the two factors cancel, the building never grows, and the starved good stays starved. That is
    // not hypothetical — it is what happened to WOOD. A logging camp running `pm_increased_hardwood` makes
    // wood (pinned at the 175 ceiling) and hardwood (dumped at the 25 floor); the mean sat below 1, so the
    // solver SHRANK logging from 523 levels to 124 across eras 2→5 while wood's shortage tripled.
    // A restricted good at the ceiling is a hard constraint being violated, so it wins outright.
    const applyF = (key, goodsOut) => {
      let num = 0, den = 0, forced = 0;
      for (const g in goodsOut) {
        if (!(goodsOut[g] > 0) || goodF[g] == null) continue;
        const w = goodsOut[g] * (S.PRICES[g] || 0);
        num += w * Math.log(goodF[g]); den += w;
        if (CEIL_BOOST && RESTRICTED.has(g) && S.thresholds[g] >= CEIL_TARGET) forced = Math.max(forced, 1 + gain / 2);
      }
      if (!(den > 0)) return;
      scaleOf[key] = clamp(scaleOf[key] * Math.max(Math.exp(num / den), forced), 0.02, 1e7);
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
      for (const k in scaleOf) scaleOf[k] *= Math.pow(f, rescalePow);
    }
  }

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
    stepCounts(iter < 10 ? 0.8 : (iter < 60 ? 0.35 : 0.15), iter < 10 ? 1.0 : 0.5);
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
  // ---- THE FINAL JOINT SETTLE -----------------------------------------------------------------------
  // Prices, PM selections and input recipes are three mutually dependent things, and this used to be
  // three single passes over them in a fixed order — which guaranteed that whichever ran LAST invalidated
  // the other two. Concretely: the last act was re-solving every era-current tier's recipe, which changes
  // what those buildings buy, which changes prices — so the scenario SHIPPED a price table that its own
  // recipes contradicted. It was measurable rather than theoretical: era-1 iron reported at the 175
  // ceiling while the shipped order book said buy 831 against sell 990, a price of 86.
  //
  // So iterate the three to a joint fixed point instead, and report the residual movement rather than
  // letting the order of the passes decide the answer.
  const syncPrices = () => {
    const a = E.scenarioAggregates();
    for (const g in S.PRICES) { const { buy, sell } = E.scenarioBuySell(a, g); S.thresholds[g] = E.priceMultPct(buy, sell); }
  };
  // THE CEILING GOVERNS PM CHOICE TOO, and it has to — otherwise the optimiser walks straight into it.
  // A building's most profitable method is not always one the market can live with: `pmg_hardwood` on the
  // logging camp is the proof. It is a bistable switch with NO stable side under a profit-only rule —
  // `pm_increased_hardwood` cuts wood output from 60 to 20 per level and pins WOOD at the ceiling, while
  // `pm_no_hardwood` removes the market's only hardwood supply and pins HARDWOOD at it. The two trade
  // places forever (measured: a 150pp residual in the joint settle, and profit of 213% vs 34% between
  // them), because the model runs ONE method per building type per market where a real market runs a mix.
  //
  // Scoring the constraint alongside profit resolves it without naming any building: the middle method
  // `pm_hardwood` is the only one that leaves both goods inside the band, so it wins on the penalty even
  // though it loses on profit. That is the right answer and it is arrived at by the rule, not by hand.
  const ceilingBreaches = () => {
    const a = E.scenarioAggregates();
    let n = 0;
    for (const g of RESTRICTED) {
      const { buy, sell } = E.scenarioBuySell(a, g);
      if (buy > 0 && E.priceMultPct(buy, sell) >= CEILING) n++;
    }
    return n;
  };
  const breachCount = () => CEIL_PM ? ceilingBreaches() : 0;
  // Weight it far above any profit difference: this is a constraint, not a preference. Profit only ever
  // breaks ties between selections that breach the ceiling equally often.
  const CEIL_PENALTY = 100;
  let pmResult = { cycles: [], settled: true, passes: 0 };
  let pmSettled = false;
  // ⚠ THE INNER LOOP MUST CONVERGE WITH PMs HELD FIXED. Prices, recipes and counts are continuous and do
  // converge against a fixed method choice — that is exactly why the main loop freezes PM selection for its
  // last stretch. Re-opening the discrete choice on every pass, which is what this did first, guarantees it
  // never settles: a single PM flip moves a price by up to 150pp, so the continuous variables are chasing a
  // target that jumps before they arrive. Converge the continuous part, THEN re-check the discrete part.
  // The continuous half: prices, recipes and counts, with the method choice held fixed. Returns how far
  // the LAST iteration still moved — the honest convergence measure, uncontaminated by any PM flip.
  const contSettle = (iters, gain) => {
    let d = 0, dg = null, dn = 0;
    for (let j = 0; j < iters; j++) {
      const b0 = { ...S.thresholds };
      settle(); syncPrices();
      for (const p of placement) {
        const cur = p.rows[0].t;
        if (cur.era === era && p.ind.follows_be !== false) solveInputsAt(p.ind, cur, currentTargetFor(p.ind));
      }
      stepCounts(gain, 0.5);
      settle(); syncPrices();
      d = 0; dn = 0; dg = null;
      for (const g in S.PRICES) {
        const x = Math.abs((S.thresholds[g] || 0) - (b0[g] || 0));
        if (x > 5) dn++;
        if (x > d) { d = x; dg = g; }
      }
    }
    return { d, dg, dn };
  };
  let conv = { d: 0, dg: null, dn: 0 };
  for (let k = 0; k < JOINT_PASSES; k++) {
    conv = contSettle(40, 0.15);
    // THE HARD RULE: at the prices this market actually produces, every building must be running the most
    // profitable secondary methods available to it. Phase A chose PMs against its own fitted prices, which
    // are not these — so the choice has to be re-made here, or the scenario asserts an optimum it does not
    // have. Any pair that will not settle is a genuine limit cycle and is reported by name, never hidden.
    const r = optimisePMs({
      E, S, rules, era,
      profitOfTier: (i, t) => { const k2 = E.thruMult(t.key), I = k2 * E.inputValue(t, true), Wc = E.wageCost(t), C = I + Wc;
        const p = C > 0 ? (k2 * E.outputValue(i, t, true) - C) / C : -1;
        return p - CEIL_PENALTY * breachCount(); },
      profitOfRef: b => { const ec = E.refEcon(b); const p = (ec && ec.tp != null) ? ec.tp / 100 : -1;
        return p - CEIL_PENALTY * breachCount(); },
    });
    const pmMoved = !(r.passes === 1 && r.settled);
    pmResult = { cycles: [...pmResult.cycles, ...r.cycles], settled: r.settled, passes: pmResult.passes + r.passes };
    pmSettled = !pmMoved;
    if (!pmMoved) break;
  }
  // ⚠⚠ INVARIANT — NOTHING IS REPORTED OR SHIPPED FROM A NON-FINAL STATE.
  // Every number this tool prints, and every field of the preset it writes, is read from the state left
  // here: counts, PM selections, recipes and prices all mutually consistent, with nothing mutated
  // afterwards. Do not add a step after this point that changes any of them — that is precisely the bug
  // this replaced, where the last act was re-solving recipes AFTER the final price sync, so the scenario
  // reported (and shipped) a price table its own recipes contradicted. Era-1 iron read at the 175 ceiling
  // while the shipped order book said buy 831 against sell 990, a price of 86.
  //
  // The final convergence runs with the method choice FIXED, so the last thing to move is continuous.
  // ---- enforce "no loss-making raw producer is present" -----------------------------------------------
  // Greedy and MINIMAL: drop the single worst offender, re-converge, look again. Dropping one raises its
  // good's price, which routinely rescues the others sharing that price — so removing them all at once
  // would delete producers the constraint never actually required. Monotone (a drop is never undone), so
  // it terminates; capped anyway, and what it removed is reported.
  //
  // ⚠⚠ THE TWO HARD CONSTRAINTS CAN CONFLICT, AND THE CEILING WINS. Dropping a producer removes supply, so
  // it can push a good manufacturing consumes to the +75% ceiling — or leave it with NO producer at all.
  // Measured the first time this ran unguarded: dropping the era-1 iron mine left 1836 with 704 iron
  // demand and zero iron supply, and dropping the era-3 rubber plantation did the same to rubber. A market
  // with no iron in it is a worse falsehood than a marginal iron mine, so a drop that breaches the ceiling
  // is UNDONE and the building is protected. Those are reported by name: a raw producer that must run at a
  // loss because it is the market's only source is a real finding about the scenario, not something to
  // quietly absorb.
  //
  // ⚠ EACH ROUND STARTS FROM A CONVERGED STATE, and that ordering is the whole correctness of this loop.
  // Checking the constraint and THEN running a final convergence lets the state drift back across the line
  // after the check — measured: era-3 wheat/maize/millet settled at −6% and era 2 picked up two ceiling
  // breaches, both AFTER the loop had declared itself satisfied. Converge, then check, then act.
  const protectedRaw = new Set();
  for (let guard = 0; guard < 20; guard++) {
    conv = contSettle(30, 0.15);
    let worst = null, worstP = 0;
    for (const b of refProducers) {
      if (!(S.BLDNUM[b] > 0) || dropped.has(b) || protectedRaw.has(b) || !isRawProducer(b)) continue;
      const ec = E.refEcon(b); if (!ec || ec.tp == null || !isFinite(ec.tp)) continue;
      if (ec.tp < 0 && ec.tp < worstP) { worst = b; worstP = ec.tp; }
    }
    if (!worst) break;
    const before = ceilingBreaches();
    dropped.add(worst);
    conv = contSettle(20, 0.15);
    if (ceilingBreaches() > before) {          // the drop broke the market — put it back and keep it
      dropped.delete(worst); protectedRaw.add(worst);
      conv = contSettle(20, 0.15);
    }
  }
  // ---- POST-SOLVE SCENARIO TUNER: free entry ---------------------------------------------------------
  // ⚠ THIS IS NOT PART OF THE SOLVE. The solve is finished by this point — recipes, PM selections and
  // volumes are FINAL and must not move. The tuner adjusts one thing only, BUILDING COUNTS, and re-prices
  // after each step. That is why it does not call contSettle(): contSettle re-solves input recipes, which
  // would undo the solve it is supposed to be tuning.
  //
  // The rule: any era-appropriate manufacturing tier earning more than +25% is built one level at a time
  // until it drops under the cap. A fat margin in a market anyone can enter is not an equilibrium.
  const tuned = {}, capBlocked = new Set();
  if (PROFIT_CAP_ON) {
    for (let step = 0; step < PROFIT_CAP_STEPS; step++) {
      let best = null, bestP = PROFIT_CAP;
      for (const p of placement) {
        const cur = p.rows[0].t;
        if (cur.era !== era || p.ind.follows_be === false || capBlocked.has(p.ind.id)) continue;
        if (!(S.BLDNUM[cur.key] > 0)) continue;
        const pr = E.TPthr(p.ind, cur) / 100;
        if (isFinite(pr) && pr > bestP) { best = { ind: p.ind, t: cur }; bestP = pr; }
      }
      if (!best) break;
      const before = ceilingBreaches();
      const k = best.t.key, prev = minCount[k] || 0;
      minCount[k] = (S.BLDNUM[k] || 0) + 1;               // one level at a time, as specified
      settle(); syncPrices();
      if (ceilingBreaches() > before) {
        // the extra capacity pushed one of its own inputs to the +75% band edge — the ceiling outranks
        // this rule, so put the level back and stop growing this industry
        minCount[k] = prev; capBlocked.add(best.ind.id);
        settle(); syncPrices();
      } else {
        tuned[best.ind.id] = (tuned[best.ind.id] || 0) + 1;
      }
    }
  }

  // ⚠ NO trailing convergence here. The loop breaks only after a contSettle(30) that found no offender, so
  // it already ends on a converged state that satisfies the constraint — and running one more settle after
  // the check is exactly the mistake this loop was restructured to avoid: it moved era-3's wheat, maize and
  // millet farms back to −1% after they had been declared clear.
  // ⚠ Report the COUNT as well as the max. The worst-drifting good is almost always a thin-market
  // passenger — luxury_furniture, porcelain, fruit, all of them secondary-PM outputs with an order book
  // small enough that one building type's method flips them between the 25 and 175 band edges. Taking the
  // max alone makes a converged economy look divergent because of a good nothing depends on.
  const jointDrift = conv.d, jointDriftGood = conv.dg, jointDriftN = conv.dn;

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
           jointDrift, jointDriftGood, jointDriftN, pmSettled,
           constrShare: constructionShare(), constrLevels: S.BLDNUM[CONSTRUCTION_BLD] || 0,
           tuned: { ...tuned }, capBlocked: new Set(capBlocked),
           // the two things the free-entry rule has to be judged on afterwards
           mfgShare: (() => { let m = 0, tot = 0;
             for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) { const v = c * E.thruMult(t.key) * E.outputValue(i, t, true); m += v; tot += v; } }
             for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || E.isSubsistenceBuilding(b)) continue;
               tot += c * E.thruMult(b) * E.goodsVal(E.selGoods(E.refSel(b)).out, true); }
             return tot > 0 ? m / tot : 0; })(),
           rawProfits: (() => { const xs = [];
             for (const b of refProducers) { if (!(S.BLDNUM[b] > 0) || !isRawProducer(b)) continue;
               const ec = E.refEcon(b); if (ec && ec.tp != null && isFinite(ec.tp)) xs.push(ec.tp); }
             xs.sort((a, b2) => a - b2);
             return xs.length ? { n: xs.length, med: xs[xs.length >> 1], max: xs[xs.length - 1],
                                  over50: xs.filter(v => v > 50).length } : null; })(),
           dropped: new Set(dropped), protectedRaw: new Set(protectedRaw),
           rawLoss: refProducers.filter(b => S.BLDNUM[b] > 0 && isRawProducer(b))
             .filter(b => { const ec = E.refEcon(b); return ec && ec.tp != null && ec.tp < 0; })
             .map(b => ({ b: b.replace(/^building_/, ''), tp: E.refEcon(b).tp })),
           infeasible: new Map(infeasible), capped: new Set(capped), sec, ore };
}

// ===================================================================================================
const out = [];
const META = [];
const ERAS_HDR = () => FIT.eras.map(x => W('e' + x.era, 10)).join('');
console.log('\n=========== PHASE B — five scenarios, prices unlocked ===========');
{
  const band = k => Object.keys(BAND).filter(g => BAND[g] === k && GOOD_FIRST_ERA[g] != null).sort();
  console.log(`\nPRICE BANDS (§10.13) — finished ${PRICE_START}·${PRICE_DECAY}^age floor ${PRICE_FLOOR}`
    + ` · intermediate ${PRICE_START_INT}·${PRICE_DECAY_INT}^age floor ${PRICE_FLOOR_INT} · raw flat ${PRICE_RAW}`);
  console.log('  intermediate (a ladder industry eats it): ' + band('intermediate').join(' '));
  console.log('  finished (demand is pops / the army):      ' + band('finished').join(' '));
}
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
  console.log(`    PM optimality: ${meta.pmSettled ? 'SETTLED at the realised prices' : '⚠ NEVER SETTLED'} (${meta.pmResult.passes} pass(es));`
    + ` continuous residual ${meta.jointDrift}pp`
    + (meta.jointDriftN ? ` (${meta.jointDriftN} good(s) still moving >5pp, worst ${meta.jointDriftGood})` : ' — converged')
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
  // ⚠ ONE implementation of this rule, in ui/econ.js, shared with the balance UI — the criterion that
  // decides whether the ladder works cannot have two definitions. It judges on the buildings actually
  // PRESENT, so a tier the scenario does not contain is never a fault and never inflates a comparison.
  const illRaw = PMECON.ladderFaults(S.IND, {
    countOf: t => (S.BLDNUM[t.key] || 0),
    profitOf: (i, t) => E.TPthr(i, t) / 100,
    // the era-current tier's own target, floored at 0: a shipyard at −10% is on target, not a fault
    lossFloor: i => Math.min(0, currentTargetFor(i)),
  });
  const ill = { insolvent: illRaw.loss, stale_profitable: illRaw.stale, inverted: illRaw.inverted };
  meta.ill = ill;
  const illTot = illRaw.total, net = illRaw.net;
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
  // ---- DID THE PRICE PATH ACTUALLY HAPPEN? ----------------------------------------------------------
  // The obsolescence arithmetic is entirely a story about prices MOVING, so a price path that the market
  // never realises makes every refinement of that path meaningless. Counts are the only lever, and they
  // are bounded below by ONE LEVEL and bounded either side by the engine's own 25–175% band — so "the
  // target was missed" and "the target was unreachable" are different failures and have to be told apart.
  const track = [];
  for (const g in S.PRICES) {
    // ⚠ Only goods that EXIST in this era. A good whose industry debuts later has no producer and no
    // consumer, so its price sits at a default 100 that means nothing, and scoring it against the path
    // manufactures failures — automobiles and telephones "missing 155" in 1836 is the diagnostic
    // mis-reading an empty market, not the market mis-pricing anything.
    if (SKIP_GOODS.has(g) || GOOD_FIRST_ERA[g] == null || GOOD_FIRST_ERA[g] > meta.era) continue;
    track.push({ g, want: Math.round(targetPrice(g, meta.era)), got: S.thresholds[g], band: BAND[g] });
  }
  meta.track = track;
  const off = track.filter(t => Math.abs(t.got - t.want) > 15).sort((a, b) => Math.abs(b.got - b.want) - Math.abs(a.got - a.want));
  const pinned = track.filter(t => t.got >= 175 || t.got <= 25);
  console.log(`    PRICE PATH: ${track.length - off.length}/${track.length} tiered goods within 15pp of the path`
    + (pinned.length ? `, ${pinned.length} PINNED at the 25/175 band edge` : '')
    + (off.length ? '\n      adrift: ' + off.slice(0, 8).map(t => `${t.g} ${t.got}(want ${t.want})`).join('  ') : ''));
  // ---- THE INDUSTRIAL CEILING: a hard constraint, reported as pass/fail, never averaged away ----------
  // Two failures with the same symptom and completely different remedies, so they are separated here:
  // a good with producers is under-BUILT (counts can fix it), a good with NO producer at all cannot be
  // fixed by any count and needs either a producer placed or the market to import it.
  const breach = [];
  for (const g of RESTRICTED) {
    if (S.thresholds[g] < CEILING) continue;
    const { buy, sell } = E.scenarioBuySell(agg, g);
    if (!(buy > 0)) continue;                       // nobody is actually buying it: not a real breach
    breach.push({ g, buy, sell, orphan: !(sell > 0) });
  }
  breach.sort((a, b) => b.buy - a.buy);
  // Name the PRODUCERS and the method each is running. "Under-built" and "throttled by its own production
  // method" look identical in the price and need opposite remedies — more levels, or a different PM.
  for (const b of breach) {
    const src = [];
    for (const bl of E.refBuildings()) {
      const c = S.BLDNUM[bl] || 0; if (!c) continue;
      const o = E.selGoods(E.refSel(bl)).out; if (!(o[b.g] > 0)) continue;
      src.push(`${bl.replace(/^building_/, '')} ${c}×${o[b.g]}`);
    }
    for (const i of S.IND) for (const t of i.tiers) {
      const c = S.BLDNUM[t.key] || 0; if (!c) continue;
      const o = E.tierGoodsIO(i, t).out; if (!(o[b.g] > 0)) continue;
      src.push(`${t.key.replace(/^building_/, '')} ${c}×${Math.round(o[b.g])}`);
    }
    b.src = src;
  }
  meta.breach = breach;
  // The ACHIEVED share, not the target — this is the check that the count tracked a growing GDP instead of
  // being fixed from an early, small one.
  // The free-entry tuner, and the two numbers it has to be judged on.
  if (PROFIT_CAP_ON) {
    const t = Object.entries(meta.tuned).sort((a, b) => b[1] - a[1]);
    const rp = meta.rawProfits;
    console.log(`    FREE ENTRY (>${(PROFIT_CAP * 100).toFixed(0)}% ⇒ build more): `
      + (t.length ? `${t.reduce((a, x) => a + x[1], 0)} level(s) added — ` + t.slice(0, 6).map(([id, n]) => `${id} +${n}`).join(', ')
                  : 'nothing above the cap')
      + (meta.capBlocked.size ? `  ⚠ stopped by the ceiling: ${[...meta.capBlocked].join(', ')}` : ''));
    console.log(`      SANITY: manufacturing ${(100 * meta.mfgShare).toFixed(0)}% of non-subsistence output`
      + (meta.mfgShare > 0.90 ? ' ⚠ OVERSIZED' : '')
      + (rp ? ` · raw producers median ${rp.med.toFixed(0)}% / max ${rp.max.toFixed(0)}%`
             + (rp.over50 ? ` (${rp.over50} over +50%)` : '') : ''));
  }
  console.log(`    CONSTRUCTION: ${meta.constrLevels} levels = ${(100 * meta.constrShare).toFixed(1)}% of gross output`
    + ` (target ${(100 * CONSTRUCTION_GDP_SHARE).toFixed(0)}%, ${CONSTRUCTION_PM[meta.era]})`
    + (Math.abs(meta.constrShare - CONSTRUCTION_GDP_SHARE) > 0.02 ? '   ⚠ OFF TARGET' : ''));
  console.log(`    RAW PRODUCERS: ${meta.rawLoss.length ? '⚠ ' + meta.rawLoss.length + ' LOSS-MAKING while present: '
      + meta.rawLoss.map(r => `${r.b} ${r.tp.toFixed(0)}%`).join(', ')
    : 'clear — every extraction/agriculture building present is profitable'}`
    + (meta.dropped.size ? `\n      dropped as unviable (${meta.dropped.size}): ` + [...meta.dropped].map(b => b.replace(/^building_/, '')).join(', ') : '')
    + (meta.protectedRaw.size ? `\n      ⚠ KEPT AT A LOSS — the market's only source, dropping them breached the ceiling: `
        + [...meta.protectedRaw].map(b => b.replace(/^building_/, '')).join(', ') : ''));
  console.log(`    INDUSTRIAL CEILING: ${breach.length ? '⚠ ' + breach.length + ' consumable good(s) AT +75%' : 'clear — no consumable good at +75%'}`);
  for (const b of breach) console.log(`      ${b.g} buy ${fmtN(b.buy)} / sell ${fmtN(b.sell)}`
    + (b.orphan ? '   ⚠ NO PRODUCER AT ALL — no count can fix this' : '   from ' + b.src.join(', ')));

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
