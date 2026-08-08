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
import { applyTechEraCorrections } from './era_tech_sync.mjs';

const WRITE = process.argv.includes('--write');
const { E, S, PMECON, config: CFG_RAW } = loadEcon({ quiet: true });
// ONE TECHNOLOGY, ONE ERA — see build_era_ladder.mjs. Must run BEFORE anything reads S.VAN.tech_era, which
// is every production-method and vanilla-building gate below. Off unless ERA_TECH_SYNC=1.
applyTechEraCorrections(S, CFG_RAW);
const FIT = JSON.parse(readFileSync(join(REPO, 'config', 'era_prices.json'), 'utf8'));

// ===================================================================================================
// SCENARIO INPUTS
// ===================================================================================================
// Total population and the peasant share, per era. A developed country growing through the period, and
// shedding peasants as industry absorbs them — the brief's "we're supposed to lose peasants share as the
// game progresses". Both are exogenous: they are the scenario's premise, not an output.
// ⭐ POPULATION IS THE SCENARIO'S PREMISE AND IT IS AUTHORITATIVE AGAIN. Broadly realistic totals for ONE
// US-like country carried from 1780 to 1945 — the six scenarios are meant to read as one country growing,
// not as six unrelated markets. Chosen, not derived; they are a design input.
const POP_TOTAL   = [5e6, 13e6, 40e6, 75e6, 105e6, 150e6];
// ⚠⚠ AND `popBoost` NO LONGER OVERRIDES THEM. It used to scale this number until the median main tier
// cleared MIN_MAIN_LEVELS, which at era 1 meant ×9.5 — so the premise the solve actually ran was 190M
// against a stated 20M, and the stated number was decoration. The floor and the premise disagreed and the
// floor silently won. Now the premise wins and the floor is reported instead (see the "floored at 1 level"
// line per era), because a scenario whose population nobody chose cannot be argued with.
//
// ⚠ WHAT THIS DOES *NOT* FIX, measured: the model is SCALE-INVARIANT. Every price in it is a ratio of buy
// to sell orders, so multiplying the whole market changes nothing except which tiers can hold a fraction
// of a level. Pinning the population moved per-capita GDP by ~2% (growth ×5.62 -> ×5.61) while the
// population itself moved 6x. Do not expect a population change to move a margin; expect it to move which
// industries are stuck at one level.
// ⭐ FRACTIONAL BUILDING LEVELS — the one lever that decouples POPULATION from BALANCE.
//
// §10.29's integer floor is the ONLY non-proportional thing in this model: every price is a ratio of buy
// to sell orders, so scaling the whole market changes nothing EXCEPT that a tier wanting 0.4 levels cannot
// have them and must sit at 1, flooding its own good until the price pins at a band edge and no recipe can
// clear any target. That is why a small market breaks and a huge one does not — and why the populations
// had to be absurd to make the balance work.
//
// A scenario is an abstraction, not a save game. Nothing downstream requires an integer: the count is a
// multiplier on an order book, and we already model subsistence at FRACTIONAL staffed-level equivalents
// for exactly this reason. Allowing a fraction here makes the model fully scale-invariant, which means the
// population becomes a free NARRATIVE choice instead of a balance parameter fighting the floor.
// `ERA_FRAC_LEVELS=0` restores the integer floor for A/B.
// ⚠ DEFAULT OFF. A building level is an integer in the game and a scenario that reports 0.86 factories is
// describing something that cannot exist — that outranks the metric. MEASURED cost of insisting on
// integers: illogicality 43 (32 excluding) -> 48 (38), plus one industrial-ceiling breach returning at
// era 1. It also REDISTRIBUTES rather than uniformly worsening — era 5 goes 15 -> 7 while eras 0-2 get
// worse — so the 5-point total is inside the jaggedness the five-point rule warns about anyway.
// `ERA_FRAC_LEVELS=1` restores fractions for A/B; it is what decouples population from balance, so it is
// the switch to reach for when asking "is this a scale problem?".
const FRAC_LEVELS = process.env.ERA_FRAC_LEVELS === '1';
const MIN_LEVEL = FRAC_LEVELS ? 0.01 : 1;
const lvl = x => FRAC_LEVELS ? Math.max(MIN_LEVEL, Math.round(x * 100) / 100) : Math.max(1, Math.round(x));
const POP_BOOST_ON = process.env.ERA_POP_BOOST === '1';   // the old behaviour, for A/B only
// ⭐ A US-LIKE PATH, because the POPULATION is US-like and the two have to describe one country.
//
// ⚠ THE OLD NUMBERS WERE CONTINENTAL EUROPE. FINDINGS F28 measured 1836 Austria 88% / Prussia 83% /
// France 79% / Britain 62% / Belgium 58% — and the USA is not in that list because it is the outlier:
// measured 33.7% of workforce in 1836, less than half of Austria's. Asserting an Austrian peasant share
// on top of an American population is what starved the early scenarios: the peasant share is what decides
// how much INDUSTRIAL workforce a given headcount yields, and at 0.78 a 13M country produced 0.89M
// workers where a real 1836 USA of 15.8M produced 4.7M. Roughly 3x the industrial base is recovered here
// at exactly the same population.
//
//                              1780   1836   1870   1900   1920   1945
//   ours (share of population)  0.80   0.45   0.35   0.22   0.12   0.04
//   USA measured (of workforce)   -    0.337  0.478  0.416  0.281  0.040
//   GBR measured (of workforce)   -    0.520  0.445  0.247  0.117  0.024
//
// The USA's own path is NOT monotone — it rises to 1870 and stays high to 1900, because the frontier was
// still absorbing farmers while the east industrialised. We take a smooth decline instead: this is one
// idealised advanced country, not a replay of American settlement, and a scenario ladder whose peasant
// share goes UP in the middle would make every era-2/3 comparison read backwards.
// 1780 has no vanilla counterpart at all (the game starts in 1836) and is a judgement: pre-industrial,
// overwhelmingly agrarian, but not so much so that it cannot staff a workshop economy.
const PEASANT_SHARE = [0.80, 0.45, 0.35, 0.22, 0.12, 0.04];
// Share of GDP spent on the ARMY's goods upkeep, and the battalion mix. Era-appropriate weaponry only:
// a 1935 army is not line infantry. 3 infantry battalions per artillery/armour battalion.
const ARMY_GDP_SHARE = 0.05;
const ARMY_MIX = {
  0: [['combat_unit_type_line_infantry', 3], ['combat_unit_type_cannon_artillery', 1]],
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
// ===================================================================================================
// THE POPULATION CHAIN — professions drive buildings, not the other way round.
//
//   productive buildings → their workforce
//   that workforce       → the other professions, in vanilla proportions
//                          (slaves 0 · peasants by era share · soldiers from the army)
//   GDP                  → CONSTRUCTION (10% of gross output)
//   peasants             → subsistence levels, split across the subsistence TYPES
//   GDP                  → battalions → SOLDIERS
//   those professions    → the non-economic / autoscaling buildings that employ them
//   all of the above     → URBAN CENTRES (floor(Σ urbanization / 100), FINDINGS F13) — LAST, because every
//                          building placed above contributes urbanization, so they can only be counted
//                          once everything else exists
//   and back             → productive building counts, chasing the profit goals under the constraints
//
// The direction matters. Support buildings used to be placed at a fixed SHARE OF BUILDING LEVELS, and the
// strata then read off whatever employment that produced — so "how many aristocrats exist" was decided by
// an arbitrary 32%-of-levels constant. Now the professions are the quantity with a claim to be right, and
// the buildings are sized to employ them.
//
// MEASURED, not chosen: the ratio of each non-productive profession's workforce to the total PRODUCTIVE
// workforce, median across the eight vanilla 1836 markets. Soldiers are excluded here — they come from the
// army — and so are laborers/machinists, which belong to buildings sized by their own rules (construction
// at 10% of GDP, urban centres by urbanization). Vanilla's own soldier ratio would have been 0.0216.
const PROF_RATIO_1836 = {
  clerks: 0.0529, bureaucrats: 0.0174, clergymen: 0.0164, shopkeepers: 0.0121,
  aristocrats: 0.0078, capitalists: 0.0028, officers: 0.0024, academics: 0.0015,
};
// ⭐ THE NON-PRODUCTIVE WEDGE (`ERA_PROF_RAMP=k`, default 1 = today's behaviour, i.e. no ramp).
//
// The ratios above are an 1836 measurement applied UNCHANGED to all five eras, which is the one thing the
// comment below already admits is wrong. A real economy moves people OUT of production and into clerking,
// administration and services as it industrialises, and that shift is what lets output per PRODUCTIVE
// worker grow much faster than output per head — the wedge between the two quantities.
//
// `k` is the factor at ERA 5; eras in between are interpolated geometrically from 1.0 at era 1. Applied to
// every entry, because the whole non-productive block moves together and we have no per-profession
// late-game measurement to say otherwise (no session carries `building_inventory` past 1836).
//
// ⚠ IT IS NOT A FREE DIAL. These people are employed, so they enter the non-peasant population (diluting
// per-head output, which is the point) — but they also CONSUME, at middle- and upper-stratum buy packages,
// and government administration buys paper and telephones. So the numerator moves too, and the net effect
// has to be measured rather than assumed from the denominator alone.
const PROF_RAMP = +(process.env.ERA_PROF_RAMP || 1);
let PROF_RATIO = { ...PROF_RATIO_1836 };
const setProfRatio = eIx => {
  const f = Math.pow(PROF_RAMP, eIx / 4);
  PROF_RATIO = Object.fromEntries(Object.entries(PROF_RATIO_1836).map(([k, v]) => [k, v * f]));
};
// WHICH BUILDING IS SIZED FROM WHICH PROFESSION — and, crucially, only for the REMAINDER.
//
// ⚠⚠ A PROFESSION USUALLY HAS SEVERAL EMPLOYERS, AND SOME OF THEM ARE PRODUCTIVE. Sizing a building from a
// profession's whole target double-counts everyone already employed elsewhere, and any building that is not
// somebody's designated source is never placed at all. That is not hypothetical: **academics are 100%
// university in vanilla, universities were in nobody's list, so universities were permanently empty** while
// art academies quietly employed academics that the model never accounted for. Bureaucrats defaulted
// wholly to government administration for the same reason.
//
// So each designated building is sized from `target − what every OTHER placed building already employs of
// that profession`, iterated a few times because the buildings supply each other's professions (government
// administration alone supplies 36.7% of aristocrats and 27% of clerks).
//
// MEASURED shares of each profession's non-productive employment, across the eight vanilla 1836 markets:
//   academics    university 100%
//   aristocrats  manor_house 63.3% · government_administration 36.7%
//   bureaucrats  government_administration 98.6% · construction 1.4%
//   capitalists  financial_district 100%
//   clergymen    manor_house 47.6% · government_administration 33.1% · urban_center 16.5% · university 2.7%
//   clerks       urban_center 50.2% · government_administration 27% · trade_center 18.9%
//   shopkeepers  urban_center 69.8% · trade_center 20.7% · financial_district 9.5%
// Professions with NO designated building (clergymen, shopkeepers, officers) fall out of the buildings
// placed for others — which is what the vanilla data says actually happens.
//
// ⚠ These are 1836 shares, not late-game ones. No session carries the `building_inventory` metric, so
// late-game telemetry does not exist yet (see CLAUDE.md); swap these numbers in when it does.
const PROF_SOURCE = [
  { prof: 'bureaucrats', bld: 'building_government_administration' },
  { prof: 'aristocrats', bld: 'building_manor_house' },
  { prof: 'capitalists', bld: 'building_financial_district' },
  { prof: 'academics',   bld: 'building_university' },
  { prof: 'clerks',      bld: 'building_trade_center' },
];
// Peasants spread over the subsistence TYPES in vanilla proportion rather than all landing on one.
// Measured shares of subsistence levels: rice farm 59.7%, farm 37.4%, pasture 2.5%, orchard 0.2%,
// fishing village 0.2%. ⚠ This is the WORLD 1836 mix and is therefore rice-heavy (Asia dominates the
// count); it is vanilla's proportion as asked for, not a temperate-country one.
const SUBSISTENCE_MIX = {
  building_subsistence_rice_farm: 0.597, building_subsistence_farm: 0.374,
  building_subsistence_pasture: 0.025, building_subsistence_orchard: 0.002,
  building_subsistence_fishing_village: 0.002,
};
// A battalion is 1 000 serving soldiers. The POP behind it is larger: soldiers are working adults like any
// other profession, so the people (with dependents) are 1 000 ÷ the working-adult ratio — 4 000 at 0.25.
const SOLDIERS_PER_BATTALION = 1000;
// Barracks host the battalions. They employ nobody and consume nothing in our extract (V3 puts a barracks'
// manpower in the battalions themselves and its goods in each combat unit's upkeep), so placing them costs
// the model nothing and gives the soldiers somewhere to be seen.
const BARRACK_BLD = 'building_barrack';
// HOW THE ARMY'S MANPOWER SPLITS BY PROFESSION — read from the barracks' active training PM, never guessed.
// ⚠ No PM in the game employs soldiers or officers through `building_employment_*_add`, which is why a
// scan for their employers finds none and both look like professions that do not exist. They come from
// `profession_ratio`, which tools/extract_vanilla.ps1 now carries into ui/vanilla.js as `prof`.
let MIL_SPLIT_WARNED = false, MIL_SPLIT_PM = null;
// ⚠ IT PICKS THE PM ITSELF rather than reading the barracks' current selection, and that is not
// belt-and-braces. advanceNonMarketPMs() skips any building at zero levels, and the barracks is placed by
// setPops() — which runs AFTER it in the settle order — so the selection is whatever the first pass left
// there. Every era came out on `no_organization` (97/3), including 1935, which should be running
// `nco_incorporation` (80/20). Choosing here, by the same "latest era-available candidate" rule the rest
// of the solver uses, makes the answer independent of settle order.
function militaryProfessionSplit(era) {
  const info = S.VAN.buildings[BARRACK_BLD] || {};
  let best = null, bestEra = -1;
  for (const pmg of (info.pmgs || [])) {
    for (const pm of rules.candidates(pmg, era, new Set())) {
      const r = S.VAN.pms[pm] || {};
      if (!r.prof || !Object.keys(r.prof).length) continue;
      const e = rules.pmEra(pm);
      if (e >= bestEra) { bestEra = e; best = pm; }
    }
  }
  if (best) {
    const pr = S.VAN.pms[best].prof;
    const tot = Object.values(pr).reduce((a, b) => a + b, 0);
    if (tot > 0) { MIL_SPLIT_PM = best;
      return Object.fromEntries(Object.entries(pr).map(([p, v]) => [p, v / tot])); }
  }
  // Fail LOUD and fall back to the old behaviour, rather than inventing a ratio that looks plausible.
  if (!MIL_SPLIT_WARNED) { MIL_SPLIT_WARNED = true;
    console.log('    ⚠ barracks training PM carries no profession_ratio — army filed as 100% soldiers.'
      + ' Re-run tools/build.ps1 so ui/vanilla.js carries the `prof` block.'); }
  return { soldiers: 1 };
}
const BATTALIONS_PER_BARRACK = 1;
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
// 15% of GDP (value added), raised from 10% of GROSS OUTPUT — a different base as well as a different
// number. MEASURED off a vanilla 1901 gamestate, construction's goods bill as a share of that country's
// GDP: FRA 20.1% · RUS 19.9% · USA 15.3% · GBR 14.1% · BEL 8.8% · JAP 4.5%. 15% sits with the large powers.
const CONSTRUCTION_GDP_SHARE = +(process.env.ERA_CONSTRUCTION_SHARE || 0.15);
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
// One-level cuts the loss-making reduction may make per era. Each costs a full re-converge, so this is a
// runtime knob as much as a behavioural one.
//
// ⚠⚠ IT IS A SAFETY NET, NOT A BUDGET — AND AT 60 IT WAS A BUDGET. The loop's real stopping condition is
// `if (!worst) break`: it terminates on its own once nothing is losing money above one level. At 60 it
// never got there in era 5, which is a 26k-level economy — it stopped at step 60 of the 543 that era
// wants, having reached only the second entry of a thirteen-industry hand-off. Measured, era 5 alone:
//
//     steps        60          400        2000 (converged at 543)
//     losses    £643k/wk    £137k/wk        £17k/wk
//     % of net     10%          2%             0%
//     losers       26          27             21   (profitable 53 -> 52 -> 58)
//     illogical  11 (8)      11 (8)          9 (6)
//
// It also cost 0.6% of GDP and £100k/wk of net profit to remove £626k/wk of losses, and dropped two
// illogicality points (era 5's `port` inversion and `railway` staying profitable two eras stale) — both
// caused by stale rungs the reduction had not been allowed to reach.
// ⚠ ERAS 0-4 NEVER REVEALED THIS: they use 0/4/2/2/13 steps, so the guard binds in exactly one era and
// nothing else in the report moved when it was raised. A guard that binds in one place looks like a
// converged solve everywhere else.
// The cost is runtime — era 5 now does ~543 `contSettle` calls instead of 60 (six-era run ~5min -> ~12min).
// If that needs fixing, do it with a COARSE-TO-FINE step (cut ~5% of levels while deep in the red, one
// level near the boundary), not by lowering this: a coarse step can overshoot the hand-off point, so it
// must be checked to land in the same terminal state.
const SHRINK_STEPS = +(process.env.ERA_SHRINK_STEPS || 2000);
// May the reduction cut URBAN CENTRES as well as our tiers? See the F13 block in `addSupport` for why
// their entitlement is a ceiling rather than a count. `ERA_URBAN_SHRINK=0` restores the old behaviour.
const URBAN_SHRINK = process.env.ERA_URBAN_SHRINK !== '0';

// ⭐⭐ SCALE LIMITS — HARD SOLVER CONSTRAINTS on how many of a thing a country may hold (user, 2026-08-08).
// The count controller has no notion of a resource deposit, so a good whose price keeps asking for supply
// keeps getting it. These are the bound.
// ⚠ They are JUDGEMENT CALLS, stated as such, and deliberately NOT derived from vanilla's
// `capped_resources`: that file distinguishes potential slots from slots exploitable at a given date, and
// reading one as the other is how a check like this becomes confidently wrong.
// ⚠ WHALING IS THE ONE THAT NEEDED THIS. It produces OIL and is ungated by technology, so the controller
// used it as an unbounded substitute oil source exactly when oil demand exploded: the series across the six
// eras ran 2 / 19 / 1 / 9 / 47 / **440**, which is not a trajectory but a quantity nothing was bounding —
// and historically whaling was in steep DECLINE by 1945, so 440 is the wrong sign as well as the wrong
// magnitude. The others are guardrails; this one is a fix.
const SCALE_LIMIT = { whaling: 30, fishing: 100, oreOrLogging: 1000, plantation: 300, agriculture: 3000 };
const scaleCat = b => PMECON.GRPCAT[(S.VAN.buildings[b] || {}).group || ''] || '';
const isScaleAgri = b => { const c = scaleCat(b); return c === 'farms' || c === 'plantations' || c === 'ranching'; };
// The per-building ceiling. `Infinity` for anything these bounds do not name, so an unlisted building is
// unconstrained rather than silently pinned at a default.
const scaleCapOf = b => {
  if (/whaling/.test(b)) return SCALE_LIMIT.whaling;
  if (/fishing/.test(b)) return SCALE_LIMIT.fishing;
  const c = scaleCat(b);
  if (c === 'mining' || c === 'oil' || c === 'rubber' || c === 'logging') return SCALE_LIMIT.oreOrLogging;
  if (c === 'plantations') return SCALE_LIMIT.plantation;   // per TYPE — 400 tea plantations is implausible
  return Infinity;                                          // even where total acreage is not
};
// The futility guard: stop growing a producer when a step did not actually lower its margin (its good is
// pinned at the 25% price floor, so supply cannot move it). Separately revertable — `ERA_PROFIT_CAP_FUTILITY=0`
// restores the un-guarded behaviour, which is worth being able to reproduce: without it `tea_plantation`
// consumed all 400 steps in era 1 and still read 294%.
const PROFIT_CAP_FUTILITY = process.env.ERA_PROFIT_CAP_FUTILITY !== '0';
// ===================================================================================================
// EXTRACTION AND AGRICULTURE HAVE NO PROFIT TARGET — THEY HAVE A BAND.
//
// A target says "this number should be 20%", and for raw producers that was never true or useful: a good
// has ONE price and several producers of differing productivity, so at most one of them can sit on a
// target, and the rest were permanently reported as misses. §10.6 spent its whole residual saying so.
//
// A band says what would actually be WRONG: a mine running at a loss (nobody would operate it) or a mine
// printing money (nobody would leave that alone). Between those, spread is real productivity difference
// and is left alone rather than fought.
//
//   extraction   0% … +400%
//   agriculture  0% … +200%
//
// Extraction gets the wider ceiling because it genuinely runs enormous ratios — a coal mine consumes
// almost nothing but tools — which is the same reason §10.9's value-added cap exempts it.
const RAW_BAND = {
  extraction:  [0, +(process.env.ERA_RAW_MAX_EXTRACTION || 4.00)],
  agriculture: [0, +(process.env.ERA_RAW_MAX_AGRICULTURE || 2.00)],
};
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
// ⚠ ART ACADEMIES ARE NOW SOLVED LIKE ANY OTHER INDUSTRY (`ERA_ART_NORMAL=0` restores the exceptions).
// The three exceptions below — a 10:1 value-added cap, hand-pinned counts, and exclusion from the ladder
// criterion — were each defensible on their own and together made the industry unobservable: its counts
// could not respond to price, so nothing could correct it, and nothing scored it either.
const ART_NORMAL = process.env.ERA_ART_NORMAL !== '0';
const IO_CAP_OVERRIDE = ART_NORMAL ? {} : { art_academy: 10 };
const ioCapFor = id => IO_CAP_OVERRIDE[id] || MFG_IO_CAP;
// Industries whose scenario presence is FIXED rather than solved. Art academies cannot be sized by the
// profit feedback: fine_art is not supply-clamped (max_supply_share = 1) and carries the highest weight in
// popneed_leisure, so once it absorbs that budget every extra academy adds supply against fixed money and
// simply destroys its own price. Sizing it by margin therefore has no stable answer — it is pinned by
// hand instead, and left insolvent if that is where it lands.
// ⭐⭐ AND THIS IS THE ONE THAT MATTERED. Pinning the counts is precisely why the count controller could
// never close fine_art's 42pp gap to its own price path (117% realised against a path asking 75%): the
// controller's ONLY lever is building counts, and for this industry they were constants. The price then
// rose across the whole ladder, and since each tier's recipe is solved once at its own era's price, every
// older tier came out looking spectacular — era-3 academy +115% against era-5's +2%. The inversion was
// manufactured by the pin, not by the demand model.
// ⚠ The original reasoning is not wrong, and is why this is a switch rather than a deletion: fine_art is
// unclamped (`max_supply_share = 1`) and carries the highest weight in `popneed_leisure`, so extra
// academies really do bid down their own price with no floor under them. If that turns out to have no
// stable answer, the pin comes back — but it has to be MEASURED failing, not assumed to.
const FIXED_COUNTS = ART_NORMAL ? {} : { art_academy: { cur: 2, m1: 2, m2: 1 } };
// The third exception: exclusion from the ladder criterion itself. `LADDER_EXCUSED` lives in ui/econ.js
// because the criterion must have ONE implementation (§10.11) — so this MUTATES that one set rather than
// forking it. The UI is a separate process and keeps the shipped rule.
// ⚠ The excusal exists for a reason that is NOT "art academies are hard to balance": countries build them
// for PRESTIGE, which this model does not represent at all, so a country will hold academies that no margin
// justifies. That argument survives this experiment intact — what is being tested is only whether SOLVING
// them normally is possible, which is a different question from whether SCORING them normally is fair.
if (ART_NORMAL) PMECON.LADDER_EXCUSED.delete('art_academy');
const EXCUSED_LABEL = ART_NORMAL ? 'shipyards' : 'shipyards/art academies';
// Reference producers deliberately kept OUT of these scenarios. Natural dye is removed so that synthetics
// is the ONLY source of dye — the industry exists to replace it, and leaving the plantation in place left
// synthetics competing with a supplier it is supposed to have destroyed (it read best-case −35% in 1870).
// ⭐⭐ GOLD IS OUT OF THE MODEL ENTIRELY (user, 2026-08-08). Not exempted, not reported separately — ABSENT.
// Nothing here buys gold: in the real game it is minted into the treasury, and this model has no treasury,
// so its order book is one-sided by construction. Its price therefore sits pinned at the 25% floor in every
// era and every gold mine runs at about −62% no matter what the rest of the economy does. Half-measures had
// already accumulated around it — `SKIP_GOODS`, `NO_BUYER_EXEMPT`, `SKIP_TARGET_BLD`, an exemption from
// §10.18's solvency rule — and it still leaked into the first widened profit metric, where it supplied
// **£2.28M of loss against £0.48M from the entire rest of the economy**, 4.7× the signal it was meant to
// measure and 92% of era 4's reported losses on its own.
// ⚠ A quantity that needs an exemption everywhere it appears does not belong in the model. Its workforce is
// negligible (the job-pool rescale absorbs it) and its goods feed nothing.
const EXCLUDE_REF = new Set(['building_gold_mine', 'building_gold_field']);
// ===================================================================================================
// FIXED-COUNT REFERENCE PRODUCERS — placed at a stated number rather than solved, and allowed to SHRINK.
//
// The dye plantation is the case this exists for. It used to be deleted from every scenario so that
// synthetics would be dye's only source — which was wrong in era 1, where synthetics does not exist yet
// and the plantation is the historically correct supplier, and crude everywhere else because it decided
// the outcome instead of letting the market reach it.
//
// The rule now: a stated number exists from era 1 and persists unchanged into every later era, UNLESS it
// cannot turn a profit under any of its methods — in which case it loses one level at a time until it is
// profitable or gone. That is obsolescence happening rather than being asserted: synthetics arrives, dye's
// price falls, and the plantations retreat exactly as far as the market pushes them.
//
// ⚠ THE COUNT IS A PLACEHOLDER. 10 is a reasonable-looking number, not a derived one. The intent is that
// "how many of an untiered producer should exist" becomes a proper constraint for every industry later;
// until then this is the one hand-set case, and it is labelled as such rather than dressed up.
const FIXED_REF_COUNT = { building_dye_plantation: 10 };
// A scenario where one industry is most of the economy is broken, however well its own margin solves.
const GDP_SHARE_WARN = 0.25;
// The era-appropriate tier and the one below it need enough levels that the two-eras-stale tier (fixed at
// one) is genuinely negligible against them, rather than a tenth of the market.
// PER ERA. Ten everywhere is unaffordable early: with only 22% of an 1836 population outside subsistence,
// reaching ten median levels needed a country of 529M — bigger than Qing China, and not "a reasonably
// modern country" by any reading. Five is enough to make the two-eras-stale tier (fixed at one level)
// negligible against the two main tiers, which is all the floor was ever for.
// ⚠ THE FLOOR IS ALSO WHAT DECIDES WHICH INDUSTRIES ARE INSOLVENT, which is not obvious from the sentence
// above. A tier reported "floored at 1 level — market too small for even one" is not merely small: it is
// selling more than the market wants at any price, so its good sits at the 25% band edge and the industry
// cannot cover its costs at ANY recipe. Every insolvent industry in the run is one of these. Scaling the
// market raises that tier's demand with everything else, so it can finally hold the fraction it wants.
// ERA_MIN_LEVELS_MULT scales the whole ladder for A/B measurement; 1 = the values below.
const MIN_LEVELS_MULT = +(process.env.ERA_MIN_LEVELS_MULT || 1);
const MIN_MAIN_LEVELS_BY_ERA = [5, 5, 5, 10, 10, 10].map(v => Math.round(v * MIN_LEVELS_MULT));
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
// WORKING-ADULT RATIO — PER ERA, not the engine's flat 0.25.
//
// The share of a population that actually works is not a constant: it rises as economies industrialise,
// child labour and dependency patterns change, and women enter waged work. The game's `WORKING_ADULT_RATIO_BASE`
// is one number because the engine varies it by other means; for a scenario premise a per-era figure is
// closer to the truth and is the sort of thing that should be visible and arguable.
//
// ⚠ Eras 3-5 are the values specified (1900 / 1920 / "1925"→ our era 5). Eras 1-2 are NOT specified and are
// left at the engine base — say so rather than inventing a trend backwards.
// ⚠ Set on S.POPM as well as here, so ui/econ.js's pop-demand maths (the per-head dependent factor) uses
// the SAME number. Changing only the solver's copy would silently desync the two halves of the model.
const WORK_RATIO_BY_ERA = [0.25, 0.25, 0.25, 0.30, 0.33, 0.40];
let WORK_RATIO = WORK_RATIO_BY_ERA[0];
const SUBSISTENCE_JOBS_PER_LEVEL = 5000;
const URBAN_PER_LEVEL = 100;   // FINDINGS F13
// Which professions land in which consumption stratum (V3's own strata).
const STRATUM = {
  // ⚠ NO `servicemen`. The game's own defines say SERVICEMEN_POP_TYPE = "soldiers" — "servicemen" is
  // V3's word for enlisted military pops, not a pop type; common/pop_types holds 15, and none is it.
  lower:  ['laborers', 'farmers', 'machinists', 'soldiers'],
  middle: ['shopkeepers', 'clerks', 'engineers', 'bureaucrats', 'academics', 'clergymen', 'officers'],
  upper:  ['aristocrats', 'capitalists'],
};
const stratumOf = p => (STRATUM.lower.includes(p) ? 'lower' : STRATUM.middle.includes(p) ? 'middle'
                      : STRATUM.upper.includes(p) ? 'upper' : null);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ===================================================================================================
// THE CANONICAL RECIPE MIX — ONE definition, used by every place that needs it.
//
// The solve owns a recipe's SCALE and nothing else; its PROPORTIONS are an input (BALANCE_FRAMEWORK §8:
// inputs are solved "keeping vanilla input ratios"). So the mix must come from something the solve never
// writes — otherwise `--write` saves a rounded copy, the next run recovers a slightly different mix from
// it, and the config never reaches a fixed point. That is the whole of the write-cycle wander (§10.25),
// and two of its three causes were closed by freezing the mix into `input_ratio`.
//
// ⚠ THE THIRD CAUSE WAS THAT THE FROZEN COPY NEVER ARRIVED. `ui/econ.js`'s `makeTiers` did not carry
// `input_ratio` into the model, so `t.input_ratio` was always undefined here and the "frozen" branch was
// unreachable dead code. The 67 tiers with a vanilla recipe were fine — they fell through to it, and it
// is invariant, which is exactly why eras 1-2 looked stable. The 22 model_only tiers have no vanilla
// recipe, fell all the way through to `t.inputs`, and re-derived their mix from the previous `--write`'s
// rounding every single generation. Eras 3-5 are where those 22 live.
//
// Precedence, most invariant first:
//   1. this tier's OWN vanilla recipe — a game file, so it cannot drift;
//   2. the vanilla recipe of the nearest REAL tier below it in the same industry. A model_only tier's
//      goods set is not its own invention: `build_era_ladder.mjs` copies it from that tier when it mints
//      the tier, so that tier's vanilla mix IS this tier's mix, by construction — and it is invariant
//      where a frozen copy of a solved number is not;
//   3. the frozen `input_ratio` in the config, used VERBATIM (re-normalising it shifts it by an ulp per
//      generation, because its sum is 1.0000000000000002, not 1);
//   4. the current inputs — reachable only for a tier no solve has ever written.
//
// ERA_RATIO=frozen restores the documented-but-never-executed order (frozen outranks vanilla) so the two
// can be measured against each other rather than argued about. It is an A/B switch, not configuration.
const RATIO_MODE = process.env.ERA_RATIO || 'vanilla';
function ratioFor(ind, t) {
  const keys = Object.keys(t.inputs || {});
  if (!keys.length) return null;
  const covers = src => !!src && keys.every(g => src[g] > 0);
  const vanOf = x => (x && x.vanilla_pm) ? (E.pmRec(x.vanilla_pm).in || {}) : null;
  const below = () => (ind.tiers || [])
    .filter(x => x !== t && (x.era ?? 0) < (t.era ?? 0) && covers(vanOf(x)))
    .sort((a, b) => (b.era ?? 0) - (a.era ?? 0))[0];
  const cand = { own: () => vanOf(t), below, frozen: () => t.input_ratio, inputs: () => t.inputs };
  const order = RATIO_MODE === 'frozen' ? ['frozen', 'own', 'inputs'] : ['own', 'below', 'frozen', 'inputs'];
  for (const name of order) {
    let src = cand[name]();
    if (name === 'below') src = vanOf(src);           // `below` yields a tier, not a recipe
    if (!covers(src)) continue;
    t._ratioSrc = name;
    RATIO_SRC[name] = (RATIO_SRC[name] || 0) + 1;
    // A FROZEN ratio is used verbatim; anything derived is normalised once and pinned to 6 decimals, so
    // the same source always produces the identical object however many times it is re-derived.
    if (name === 'frozen') return { ...src };
    let s0 = 0; for (const g of keys) s0 += (src[g] || 0);
    if (!(s0 > 0)) continue;
    const r = {}; for (const g of keys) r[g] = Math.round(((src[g] || 0) / s0) * 1e6) / 1e6;
    return r;
  }
  return null;
}
// Which source each tier's mix actually came from. Printed, because "the frozen branch is dead code" was
// invisible for weeks precisely because nothing ever said which branch ran.
const RATIO_SRC = {};
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
  // ⚠⚠ SOLVE FROM THE CANONICAL RATIO, NOT FROM THE CURRENT NUMBERS. This is the fix for the write-cycle
  // wander (§10.16), and it is why the solve is now independent of where it started.
  //
  // The old form rescaled `t.inputs` in place and rounded each good to 0.1. That COMPOUNDS: every re-solve
  // quantises each input separately, so the input MIX drifts slightly each generation — and since `--write`
  // saves the result and the next run begins from it, the drift accumulated ACROSS RUNS. That is exactly
  // why write → re-run scored 47 / 51 / 51 / 48 instead of one number four times.
  //
  // `_ratio` is captured ONCE from the config and never rewritten. The recipe is then always
  // `ratio × X`, with X solved directly from the target bill — same prices in, same recipe out, however
  // many times the config has been written.
  // ⚠ THE RATIO MUST COME FROM SOMETHING THE SOLVE NEVER WRITES — see `ratioFor` above, which is the one
  // definition of that. This branch only fires for a tier the canonical-start pass skipped.
  if (!t._ratio) {
    const r = ratioFor(ind, t);
    if (!r) return false;
    t._ratio = r;
  }
  let unitMkt = 0, unitBase = 0;
  for (const g in t._ratio) {
    const pr = S.PRICES[g] || 0;
    unitMkt  += t._ratio[g] * pr * ((S.thresholds[g] ?? 100) / 100);
    unitBase += t._ratio[g] * pr;
  }
  if (!(unitMkt > 0) || !(unitBase > 0)) return false;
  const Xmin = (Obase / ioCapFor(ind.id)) / unitBase;    // the 4:1 ceiling, in ratio units
  let X = wantI > 0 ? wantI / unitMkt : Xmin;
  if (X < Xmin) { X = Xmin; capped.add(t.key); } else capped.delete(t.key);
  for (const g of Object.keys(t.inputs)) {
    t.inputs[g] = Math.max(minMainInput(ind, g), Math.round(t._ratio[g] * X * 10) / 10);
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
// …and for the tier a scenario is actually built around. The DOMINANT tier is the one solved (see
// era_solver's eIxOf): tune the workhorse, let the leading tier float above it and the tail below.
// ⭐ A PLATEAUED INDUSTRY'S LAST TIER IS ITS DOMINANT TIER FOREVER.
// Past its ladder's end no rung matches the scenario era, so the dominant lookup found NOTHING and the
// whole industry went unsolved — food, textile and furniture reached 1945 carrying recipes fitted at eras
// 3 and 4 against a wage 21% lower, and whether their rungs came out correctly ordered was luck. For food
// it did not: e4 read 0% against e3's +7%, the newest tier losing to the one below it.
// PLATEAU_TARGET was already 0.05 and the dominant target is 0.05, so this makes the two rules one rule
// rather than two ideas that happened to agree.
function domTierOf(p, era) {
  const exact = p.rows.find(r => r.t.era === era);
  if (exact) return exact.t;
  if (p.ind.ladder_end !== 'plateau' || !p.rows.length) return null;
  const best = p.rows[0].t;                       // rows[0] is the highest tier this scenario contains
  return (era > best.era) ? best : null;
}
function dominantTargetFor(ind) { return TG.minus1 + (SHIP_INDUSTRIES.has(ind.id) ? TG.shipyard_penalty : 0); }
// ...and for a reference producer, by the UI's taxonomy
const EXTRACTION_CATS = new Set(['mining', 'logging', 'oil', 'rubber', 'fishing_whaling']);
const AGRICULTURE_CATS = new Set(['farms', 'plantations', 'ranching']);
function catOf(b) {
  const info = S.VAN.buildings[b] || {};
  if (info.unique && !PMECON.GRPCAT[info.group]) return 'unique';
  return PMECON.GRPCAT[info.group] || ('grp_' + (info.group || 'other'));
}
// ⚠ `refTargetFor()` USED TO LIVE HERE and is deliberately gone. It returned TG.extraction (+20%) or
// TG.agriculture (+10%) for a raw producer, and §10.22 replaced those targets with a band — after which
// nothing called it. `TG.extraction`, `TG.agriculture`, `TG.minus1`, `TG.minus2` and `TG.plateau` remain in
// config/era_prices.json but are READ BY NOTHING in this solver: the obsolescence targets they encoded are
// now expressed as the sign tests in the illogicality criterion (§10.11), and the raw ones as a band.
// They are left in the file because era_solver.mjs (the balance-only reference view) still fits against
// them; they are not inputs here.
// which BAND a reference producer must stay inside (null = not a raw producer)
function rawBandOf(b) {
  const c = catOf(b);
  return EXTRACTION_CATS.has(c) ? RAW_BAND.extraction : AGRICULTURE_CATS.has(c) ? RAW_BAND.agriculture : null;
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
const SETTLE_TRACE = process.env.ERA_SETTLE_TRACE === '1';   // print the continuous residual per iteration
// Deadband on the count controller, in pp of base price, WITH HYSTERESIS: a good is parked once its price
// is within COUNT_DEADBAND of the path and stays parked until it drifts past COUNT_DEADBAND_OUT. 0 = off
// (the old always-chase behaviour, which limit-cycles forever). See stepCounts for the measurements.
const COUNT_DEADBAND = process.env.ERA_COUNT_DEADBAND != null ? +process.env.ERA_COUNT_DEADBAND : 8;
const COUNT_DEADBAND_OUT = process.env.ERA_COUNT_DEADBAND_OUT != null ? +process.env.ERA_COUNT_DEADBAND_OUT
                                                                     : Math.max(COUNT_DEADBAND, 15);
// ⚠⚠ VANILLA TECH ERAS START AT 1; OUR SCENARIO INDEX NOW STARTS AT 0. The gate below used to read
// `tech_era[bt] > era`, which was right while era 1 was the earliest scenario — and silently became
// "exclude everything" the moment era 0 existed, because every tech-gated building is vanilla era 1 or
// later. It cost 1780 its ENTIRE raw sector: 23 of 25 raw producers excluded (every farm, ranch and
// plantation on `enclosure`, every mine on `shaft_mining`, gold on `prospecting`, whaling on
// `navigation`), leaving logging and fishing. Hence iron and coal sitting at the +75% ceiling with
// sell = 0, and hence arms at +410% buying iron from a market that had no mines.
//
// The right mapping is the one the tier remap already uses: vanilla era 1 covers our tiers t0 AND t1
// (it is "pre-1836", and 1780 is pre-1836), and vanilla eras 2..5 map 1:1 onto t2..t5. A building is
// available in a scenario when the tier its tech maps to is within that scenario's LEADING tier.
const vanTier = e => (e == null ? 0 : (e <= 1 ? 1 : e));
const leadOfEra = e => { const c = FIT.eras[e]; return (c && c.lead != null) ? c.lead : e; };
// ⚠ FLOORED AT 1, AND THAT IS NOT A FUDGE. This gate governs VANILLA REFERENCE buildings — mines, farms,
// plantations — not our tiers, which `placement` handles via LEAD_TIER. Vanilla era 1 means "pre-1836",
// and EVERY one of our scenarios is 1780 or later, so era-1 techs are available in all of them including
// era 0. Keying this on the leading TIER instead re-broke 1780 the moment era 0 became a single-rung
// scenario (lead 0 < tier 1), taking its mines and farms away again and putting iron and coal straight
// back on the +75% ceiling with no producer.
const techAllowed = (bt, era) => !bt || vanTier((S.VAN.tech_era || {})[bt]) <= Math.max(1, leadOfEra(era));
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
// ===================================================================================================
// `ladder_end` — PLATEAU AND EXTINCT, now actually enforced (§10.1 declared this; nothing implemented it).
//
// **plateau** (food, textile, furniture, port): the last tier is PERMANENT — no better factory is ever
// invented. Its good's price must therefore stop deflating when the ladder stops, or the model quietly
// demands that a permanent tier keep pace with obsolescence that has nowhere left to come from. Holding
// the price is what makes Baumol's cost disease fall out of the model instead of being asserted: a sector
// whose productivity stops improving becomes relatively dearer as the rest of the economy moves on.
//
// **extinct** (sail shipyards): no floor at all — the industry is allowed to die, and its good keeps
// deflating past the point where anyone would build one. That was already the behaviour; it is now
// explicit rather than accidental, which matters because "we chose not to floor it" and "we never
// implemented flooring" look identical from the outside.
const PLATEAU_LAST_ERA = {};           // good -> era of the permanent last tier
for (const i of S.IND) {
  if (i.ladder_end !== 'plateau') continue;
  for (const t of i.tiers) {
    const g = E.tierOut(i, t);
    if (PLATEAU_LAST_ERA[g] == null || t.era > PLATEAU_LAST_ERA[g]) PLATEAU_LAST_ERA[g] = t.era;
  }
}
const EXTINCT_GOODS = new Set();
for (const i of S.IND) if (i.ladder_end === 'extinct') for (const t of i.tiers) EXTINCT_GOODS.add(E.tierOut(i, t));
// ⚠ "ALLOWED TO DIE" HAS TO MEAN IT ACTUALLY DIES. Removing the price floor was only half of it: the
// scenario went on placing sail shipyards in 1920 and 1935 at one level per tier, running at −84%, and
// that is not a dying industry — it is a subsidised one. It also did real damage downstream. Those levels
// keep CLIPPERS supplied at the 25% floor, and the era-1 port eats clippers: in 1920 the oldest port tier
// earned +95% against the era-appropriate tier's +54%, a perfectly inverted ladder bought with an input
// that had been made nearly free by an industry the model had already declared extinct.
// The horizon is the mod's own: a tier TWO eras stale is meant to be gone (§10.11 fault 2), so an extinct
// industry is not placed once it is two eras past its last tier. ERA_EXTINCT_GRACE makes it measurable.
const EXTINCT_GRACE = process.env.ERA_EXTINCT_GRACE != null ? +process.env.ERA_EXTINCT_GRACE : 2;
// §10.29 option 3, built and measured but DEFAULT OFF — it is a design decision about what a scenario
// should contain, not a defect fix, and it did not pay for itself (§10.32). ERA_NO_BUYER=1 turns it on.
const NO_BUYER = process.env.ERA_NO_BUYER === '1';   // withhold an industry whose good has no buyer at all
const EXTINCT_LAST_ERA = {};           // industry id -> era of its last tier
for (const i of S.IND) if (i.ladder_end === 'extinct') EXTINCT_LAST_ERA[i.id] = Math.max(...i.tiers.map(t => t.era));
const extinctBy = (indId, era) => EXTINCT_LAST_ERA[indId] != null
  && EXTINCT_GRACE >= 0 && era - EXTINCT_LAST_ERA[indId] >= EXTINCT_GRACE;
// ⚠ AND THE CHAIN HAS TO BE FINISHED, or removing the producer is worse than leaving it. Dropping the sail
// shipyards on its own left the era-1 port still buying clippers from nobody, which put clippers on the
// +75% ceiling in 1920 and 1935 — a HARD constraint (§10.15), and one that had been clear in all five
// eras. A building whose input has no supplier anywhere in the market does not run at an infinite price;
// it does not run. So a tier is not placed either, once every producer of one of its inputs is extinct.
// ===================================================================================================
// NO INDUSTRY IS PLACED BEFORE ITS GOOD HAS A BUYER OF ANY KIND (§10.29 option 3).
//
// A factory with no customers is not built. This is the mirror of the extinct rule above and is
// deliberately much NARROWER than §10.18's "no loss-making producer may be present": the test is ZERO
// demand, not poor demand, so it cannot be used to quietly delete an industry that is merely struggling.
//
// A good has a buyer if ANY of these is true: a tier of ours eats it at or below this era; a vanilla
// reference building eats it; a battalion's upkeep eats it; or POPS buy it (it appears in a pop need).
// Measured against the shipped order book, exactly one good fails all four in one era: **era-1 steel**,
// which reads buy 0 against sell 78, because the earliest tier that eats steel is `motor_industry` in
// era 2 and construction only moves to steel frames in era 3. `steamers` has the same one-era producer/
// consumer gap but is NOT caught, and correctly so — pops buy steamers through `popneed_leisure`, so its
// market is thin rather than absent. Gold is exempt for the same reason it is exempt from §10.18: its
// order book is one-sided by construction.
const POP_GOODS = new Set();
for (const need in (S.POPM.needs || {})) {
  for (const e of ((S.POPM.needs[need] || {}).entries || [])) if (e.g) POP_GOODS.add(e.g);
}
if (!POP_GOODS.size) throw new Error('pop-need goods came back empty — the no-buyer rule would withhold every consumer industry');
const UNIT_GOODS = new Set();
for (const u of (E.unitTypes ? E.unitTypes() : [])) {
  const io = E.unitGoodsIO ? E.unitGoodsIO(u) : null;
  for (const g in ((io && io.in) || {})) UNIT_GOODS.add(g);
}
const NO_BUYER_EXEMPT = new Set(['gold']);
const firstConsumerEra = {};   // good -> earliest era any BUILDING of ours eats it
for (const i of S.IND) for (const t of i.tiers) for (const g in (t.inputs || {}))
  if (firstConsumerEra[g] == null || t.era < firstConsumerEra[g]) firstConsumerEra[g] = t.era;
const hasNoBuyer = (good, era) => {
  if (!good || NO_BUYER_EXEMPT.has(good)) return false;
  if (POP_GOODS.has(good) || UNIT_GOODS.has(good)) return false;
  if (firstConsumerEra[good] != null && firstConsumerEra[good] <= era) return false;
  // a vanilla reference building may eat it — check the ones this era can actually contain
  for (const b of E.refBuildings()) {
    const bt = (S.VAN.buildings[b] || {}).tech;
    if (!techAllowed(bt, era)) continue;
    if ((E.selGoods(E.refSel(b)).in || {})[good] > 0) return false;
  }
  return true;
};
const goneGoods = era => {
  const gone = new Set();
  for (const g of EXTINCT_GOODS) {
    let alive = false;
    for (const i of S.IND) {
      if (extinctBy(i.id, era)) continue;
      if (i.tiers.some(t => t.era <= era && E.tierOut(i, t) === g)) { alive = true; break; }
    }
    if (!alive) gone.add(g);
  }
  return gone;
};

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
  // ⚠ A PLATEAUED good stops ageing when its ladder does. Past the last tier's era there is no newer,
  // cheaper factory to price against, so the path holds instead of deflating into a tier that can never
  // be superseded.
  const last = PLATEAU_LAST_ERA[good];
  const age = Math.max(0, (last != null ? Math.min(era, last) : era) - f);
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
  // The newest TIER this scenario may contain. Falls back to `era` so a stale era_prices.json (written
  // before the six-scenario ladder) still runs with the old one-tier-per-era behaviour rather than
  // silently placing nothing.
  const LEAD_TIER = FIT.eras[eIx].lead != null ? FIT.eras[eIx].lead : era;
  // A tier's recipe is solved ONCE, in the FIRST scenario where it leads. Tier 5 leads in both 1920 and
  // 1935, and solving it in both would let the later scenario silently rewrite the recipe the earlier one
  // reported its margins at — the §10.14.1 "reported a state it does not ship" failure, in a new place.
  const SOLVE_HERE = eIx === 0 || (FIT.eras[eIx - 1].lead != null ? FIT.eras[eIx - 1].lead : eIx) !== LEAD_TIER;
  WORK_RATIO = WORK_RATIO_BY_ERA[eIx];
  setProfRatio(eIx);                         // the non-productive wedge, ramped per era (ERA_PROF_RAMP)
  S.POPM.working_adult_ratio = WORK_RATIO;   // keep ui/econ.js's pop maths on the same number
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
  const noBuyer = [];     // industries withheld because nothing in this era buys their good
  const GONE = goneGoods(era);      // goods whose every producer is extinct by now
  for (const i of S.IND) {
    if (extinctBy(i.id, era)) continue;                  // declared extinct and two eras past its end
    const sorted = [...i.tiers].sort((a, b) => a.era - b.era);
    // ⚠ THE CEILING IS THE SCENARIO'S LEADING TIER, NOT ITS OWN INDEX. A scenario's dominant tier lags its
    // leading tier by one (see ERAS in era_solver.mjs), so scenario 1 (1836) may hold up to tier 2 while
    // tier 1 remains the bulk. Reading `t.era <= era` here is what made the 1836 scenario a pure tier-1
    // economy — a 1750 market wearing an 1836 label — against a vanilla 1836 start that is 45% tier 2.
    const avail = sorted.filter(t => t.era <= LEAD_TIER
      && !Object.keys(t.inputs || {}).some(g => GONE.has(g)));   // its input has no supplier left
    if (!avail.length) continue;
    // ⚠ WITHHELD IS NOT THE SAME AS ABSENT. An industry nothing buys from is pinned to ZERO levels rather
    // than dropped from `placement`, because the placement list is also what drives `solveInputsAt`: drop
    // it and the tier's recipe is never solved at all, so the era in which it DOES have a market inherits
    // whatever the canonical start left behind. Measured — dropping it outright cost era 2 three points
    // and blew the continuous residual from 12pp to 34pp. At zero levels §10.17 already excludes it from
    // the criterion, which is the whole effect wanted.
    const withheld = NO_BUYER && hasNoBuyer(E.tierOut(i, avail[avail.length - 1]), era);
    if (withheld) noBuyer.push(i.id);
    const cur = avail[avail.length - 1], m1 = avail[avail.length - 2], m2 = avail[avail.length - 3];
    const fx = FIXED_COUNTS[i.id];
    const rows = [{ t: cur, weight: (fx || withheld) ? 0 : 1, fixed: withheld ? 0 : (fx ? fx.cur : undefined) }];
    if (m1) rows.push({ t: m1, weight: (fx || withheld) ? 0 : 1, fixed: withheld ? 0 : (fx ? fx.m1 : undefined) });
    if (m2) rows.push({ t: m2, weight: 0, fixed: withheld ? 0 : (fx ? fx.m2 : 1) });
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
    if (!techAllowed(bt, era)) return false;
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
  const fixedRef = { ...FIXED_REF_COUNT };   // stated counts; shrink one level at a time when unprofitable
  const minCount = {};          // tier key -> floor imposed by the post-solve free-entry tuner
  // ⚠ AND A CEILING, which is what makes a reduction stick. Building counts are the DEPENDENT variable
  // here: every settle rescales them all so total employment equals the job pool the population provides
  // (full employment by construction). So cutting an industry without capping it is a no-op — the next
  // settle grows it straight back to refill the pool. With the cap the labour goes elsewhere instead,
  // which is the whole point: this REDISTRIBUTES the workforce, it cannot shrink it.
  const maxCount = {};          // tier key -> ceiling imposed by the loss-making reduction below
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
        const base = r.fixed != null ? r.fixed : lvl(s * r.weight);
        // `minCount` is the POST-SOLVE TUNER's floor (free entry, below). During the solve it is empty, so
        // this is a no-op; afterwards it holds counts the tuner added and the solver must not undo.
        S.BLDNUM[r.t.key] = Math.min(Math.max(base, minCount[r.t.key] || 0),
                                     maxCount[r.t.key] != null ? maxCount[r.t.key] : Infinity);
      }
    }
    for (const b of refProducers) {
      if (dropped.has(b)) continue;
      // a fixed-count producer is placed at its stated number, never at the solved one
      if (fixedRef[b] != null) { if (fixedRef[b] > 0) S.BLDNUM[b] = fixedRef[b]; continue; }
      S.BLDNUM[b] = Math.min(lvl(scaleOf['R:' + b]), scaleCapOf(b));
    }
    // ⭐ THE COMBINED AGRICULTURE BOUND is joint, so it cannot be a per-building clamp: if the total is
    // over, every non-subsistence farm/plantation/ranch is scaled down together, which preserves the mix
    // the price feedback chose and only removes the excess.
    let agriTot = 0;
    for (const b in S.BLDNUM) if (isScaleAgri(b)) agriTot += S.BLDNUM[b] || 0;
    if (agriTot > SCALE_LIMIT.agriculture) {
      const k = SCALE_LIMIT.agriculture / agriTot;
      for (const b in S.BLDNUM) if (isScaleAgri(b) && S.BLDNUM[b] > 0)
        S.BLDNUM[b] = Math.max(1, Math.floor(S.BLDNUM[b] * k));
    }
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
  let jobs = 0, popNonPeasant = 0, peasants = 0, gdp = 0, grossOut = 0, POPPROF = {};
  // ⚠ advanceNonMarketPMs runs inside settle(), not once at the start: addSupport() places the construction
  // sector and the other non-selling buildings on every settle, and optimisePMs can evict a selection back
  // to a PMG's first (most primitive) entry. Anywhere less often and the wooden-buildings default creeps
  // back in unnoticed — which is exactly how it survived this long.
  // ⚠ ORDER IS THE CHAIN. setArmy must run BEFORE setPops, because the army now produces SOLDIERS and
  // setPops turns them into people: the other way round and the soldier count is always one iteration
  // stale, which in a damped loop reads as a permanent undercount rather than as a lag.
  const settle = () => { applyCounts(); addSupport(); applyThroughput(); advanceNonMarketPMs(era);
                         sizeConstruction(); setArmy(); setPops(); };
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
  // Construction's own goods bill as a share of GDP — the SAME base vanilla's figures were measured on,
  // which means GDP net of construction's own drag (it consumes goods and produces no priced good).
  // ⭐ TWO PROFITABILITY TOTALS, in £/week, over the ECONOMIC industries only — our tiered buildings plus
  // the raw producers, excluding shipyards and art academies (both carry targets they cannot meet by
  // construction) and excluding everything non-economic (military, government, ownership, construction,
  // urban centres, subsistence), which earns nothing by design.
  //   net   — every building's profit summed, losses included. "Is this economy making money at all?"
  //   loss  — the losers alone. Two economies with the same net can hide very different amounts of it.
  // Reported, not targeted: they say what the illogicality count cannot, which is HOW BIG the failures are
  // rather than how many industries have one.
  // ⭐ THE WHOLE PRODUCING ECONOMY, not a selected part of it. Every building in the scenario that SELLS
  // goods counts — our tiers (shipyards and art academies included), raw producers, urban centres,
  // subsistence, everything. A building with no goods output (government administration, barracks) has no
  // margin to report and is skipped, which is the only exclusion.
  //   net  = sum of every producer's weekly profit, losses DEDUCTED from the winners
  //   loss = sum of the loss-makers alone, winners ignored
  // The two are deliberately not derivable from each other: net says whether the economy pays for itself,
  // loss says how much of it is being carried. A rise in both at once is an economy growing while its tail
  // rots, and one number cannot show that.
  // ⚠ `excl` repeats net/loss over the LADDER_EXCUSED industries only, so the figures quoted earlier in
  // this project stay comparable when the excused set changes underneath them.
  // ⚠⚠ GOLD IS REPORTED SEPARATELY, NEVER FOLDED IN. Nothing in the model buys gold, so its order book is
  // one-sided by construction, its price sits pinned at the 25% floor in every era, and every gold mine
  // runs at about −62% no matter what the economy does. `SKIP_TARGET_BLD` already exempts exactly these two
  // buildings from §10.18's no-loss-making-raw-producer rule for this reason; a loss metric without the
  // same exemption measures the artifact instead of the economy.
  // Measured, over the six eras: gold contributes **£2.28M** of loss against **£0.48M** from everything
  // else — 83% of the total, and it drowned the signal completely on this metric's first outing.
  // ⚠ Reported, not dropped: a number removed silently is a number nobody can check.
  function profitTotals() {
    let net = 0, loss = 0, winners = 0, losers = 0, exNet = 0, exLoss = 0, auNet = 0, auLoss = 0;
    const take = (p, excused, gold) => {
      if (!isFinite(p)) return;
      if (gold) { auNet += p; if (p < 0) auLoss -= p; return; }
      net += p; if (p < 0) { loss -= p; losers++; } else winners++;
      if (excused) { exNet += p; if (p < 0) exLoss -= p; }
    };
    for (const i of S.IND) {
      const excused = PMECON.LADDER_EXCUSED.has(i.id);
      for (const t of i.tiers) {
        const n = S.BLDNUM[t.key] || 0; if (!(n > 0)) continue;
        const io = E.tierGoodsIO(i, t);
        if (!Object.keys(io.out || {}).length) continue;             // sells nothing -> no margin to report
        take(n * E.weeklyProfit(i, t), excused);
      }
    }
    const seen = new Set(S.IND.flatMap(i => i.tiers.map(t => t.key)));
    for (const b in S.BLDNUM) {
      const n = S.BLDNUM[b] || 0; if (!(n > 0) || seen.has(b)) continue;
      const ec = E.refEcon(b); if (!ec || ec.p == null) continue;    // refEcon gives weekly £ at thresholds
      if (!Object.keys((ec.goods || {}).out || {}).length) continue;
      take(n * ec.p, false, SKIP_TARGET_BLD.has(b));
    }
    return { net, loss, winners, losers, exNet, exLoss, auNet, auLoss };
  }
  function constrCost() {
    const n = S.BLDNUM[CONSTRUCTION_BLD] || 0;
    return n * E.thruMult(CONSTRUCTION_BLD) * E.goodsVal(E.selGoods(E.refSel(CONSTRUCTION_BLD)).in, true);
  }
  function constructionShare() {
    const gdpNow = E.scenarioValueAdded();          // already net of construction
    return gdpNow > 0 ? constrCost() / gdpNow : 0;
  }
  function sizeConstruction() {
    if (!S.VAN.buildings[CONSTRUCTION_BLD]) return;
    // ⚠ SOLVE, DON'T ASSIGN. The target is a share of GDP, and construction is IN GDP as a negative — its
    // goods bill reduces value added. So `bill = s x (V0 - bill)`, i.e. bill = s x V0 / (1 + s), where V0
    // is value added EXCLUDING construction. Setting bill = s x V0 instead overshoots, and the reported
    // share then never matches the target it was sized to — which is exactly what it did.
    const v0 = E.scenarioValueAdded() + constrCost();     // add back what construction currently costs
    const cost = E.thruMult(CONSTRUCTION_BLD) * E.goodsVal(E.selGoods(E.refSel(CONSTRUCTION_BLD)).in, true);
    if (!(cost > 0) || !(v0 > 0)) return;
    const bill = CONSTRUCTION_GDP_SHARE * v0 / (1 + CONSTRUCTION_GDP_SHARE);
    S.BLDNUM[CONSTRUCTION_BLD] = lvl(bill / cost);
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
  const parked = new Set();   // goods currently inside the deadband — see stepCounts
  function stepCounts(gain, rescalePow) {
    const goodF = {};
    for (const g in S.PRICES) {
      if (SKIP_GOODS.has(g)) continue;
      const want = targetPrice(g, era), got = S.thresholds[g];
      if (!(want > 0) || !(got > 0)) continue;
      // ⚠ DEADBAND — DO NOT CHASE A PRICE THAT IS ALREADY INSIDE THE TARGET'S OWN TOLERANCE.
      //
      // Building counts are INTEGERS, so this is a proportional controller driving a quantised plant, and
      // without a deadband it limit-cycles forever: a good whose ideal count is 6.4 levels toggles 6/7
      // every iteration, and at these market sizes one level is worth ~20pp of price. Traced over the final
      // settle, the residual never decayed at all — era 4 sat at exactly 19-20pp and era 5 at 26-27pp for
      // every one of 40 iterations, with the largest mover a good with very few producers (clippers,
      // explosives, fertilizer, automobiles, artillery). More passes do not help: ERA_JOINT=24 tripled the
      // work and still never settled.
      //
      // The price path is a target with a STATED tolerance — the report itself scores a good as realised
      // when it is within 15pp — so movement inside that band is not signal to chase. Freezing the factor
      // there gives the loop somewhere to stop that is defined by the design rather than by where the
      // iteration happened to be cut off. `ERA_COUNT_DEADBAND=0` restores the old always-chase behaviour.
      //
      // ⚠ THE BAND HAS HYSTERESIS, and a plain one will not do both jobs at once. Measured over a sweep of
      // eight widths: a NARROW band (8pp) tracks the path best of anything tried (71 of 97 goods realised,
      // against 66 with no band at all) but still limit-cycles, because a good sitting just outside it is
      // chased, overshoots, and comes back; a WIDE band (20pp) converges every era but tracks worst
      // (51 of 97), since it simply stops chasing. So the band a good must ENTER is narrow and the one it
      // must LEAVE is wide: it is pursued until comfortably on the path, then tolerates drift before being
      // pursued again. Wider still is not a trade at all — 25 and 35 lose on both counts (60 and 68
      // illogicality points against 45) because the counts barely move.
      const err = Math.abs(got - want);
      if (COUNT_DEADBAND > 0) {
        if (parked.has(g)) { if (err > COUNT_DEADBAND_OUT) parked.delete(g); }
        else if (err <= COUNT_DEADBAND) parked.add(g);
        if (parked.has(g)) { goodF[g] = 1; continue; }
      }
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
      // the DOMINANT tier of this scenario — the one whose era IS this era. Exactly one per industry,
      // and the only rung this scenario tunes.
      const dom = domTierOf(p, era);
      if (!dom || p.ind.follows_be === false) continue;
      solveInputsAt(p.ind, dom, dominantTargetFor(p.ind));
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
    // Under the USA anchor the population is the measurement, so it may not be scaled to clear the
    // integer floor — the floor is exactly what the anchor is replacing.
    if (!POP_BOOST_ON || med >= MIN_MAIN_LEVELS || popBoost >= POP_BOOST_CAP) break;
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
        const dm = domTierOf(p, era);
        if (dm && p.ind.follows_be !== false) solveInputsAt(p.ind, dm, dominantTargetFor(p.ind));
      }
      stepCounts(gain, 0.5);
      settle(); syncPrices();
      d = 0; dn = 0; dg = null;
      for (const g in S.PRICES) {
        const x = Math.abs((S.thresholds[g] || 0) - (b0[g] || 0));
        if (x > 5) dn++;
        if (x > d) { d = x; dg = g; }
      }
      if (SETTLE_TRACE) console.log(`      settle e${era} j=${j} d=${d.toFixed(1)} (${dg}) moving=${dn}`);
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
  // ---- LOSS-MAKING MANUFACTURING SHRINKS ------------------------------------------------------------
  // Raw producers already have this (§10.18) and are DROPPED outright; manufacturing had no downward rule
  // at all, so a loss-maker simply sat at whatever size the job-pool rescale gave it.
  // Converge, take the tier losing money by the LARGEST margin, cut one level, CAP it there so the
  // rescale cannot undo it, re-converge, look again. A tier stops at ONE level — the industry is never
  // deleted, because "unprofitable" and "absent" are different statements and §10.17 stops scoring a
  // tier at zero anyway. Revertable: ERA_SHRINK_LOSSMAKERS=0.
  const SHRINK_ON = process.env.ERA_SHRINK_LOSSMAKERS !== '0';
  const shrunk = {};
  if (SHRINK_ON) {
    for (let guard = 0; guard < SHRINK_STEPS; guard++) {
      conv = contSettle(20, 0.15);
      let worst = null, worstP = 0;
      // ⭐ URBAN CENTRES ARE A CANDIDATE TOO. Their level count is an ENTITLEMENT from urbanization
      // (F13), not a decision — but the game staffs that entitlement out of who is available, so a
      // loss-making urban centre sheds employment instead of standing fully manned. With no employment
      // scaling in the model, cutting levels is the available approximation of the same thing. Keyed by
      // building rather than by tier, hence the `worst` bookkeeping below carries a KEY, not a tier.
      if (URBAN_SHRINK) {
        const n = S.BLDNUM.building_urban_center || 0;
        const ec = n > 1 ? E.refEcon('building_urban_center') : null;
        if (ec && ec.tp != null && isFinite(ec.tp) && ec.tp / 100 < 0 && ec.tp / 100 < worstP) {
          worst = { key: 'building_urban_center' }; worstP = ec.tp / 100;
        }
      }
      for (const p of placement) {
        if (p.ind.follows_be === false) continue;
        for (const r of p.rows) {
          const t = r.t, n = S.BLDNUM[t.key] || 0;
          if (!(n > 1) || r.fixed != null) continue;     // never below one level; hand-placed stay put
          // ⚠ A SHIPYARD AT −30% IS BREAKING EVEN. None of its income from naval ship construction is
          // modelled, which is why every target it has carries TG.shipyard_penalty (−30pp). The same
          // deduction has to apply HERE, or the rule reads a shipyard as the worst loss-maker in the
          // economy at a margin that is, for a shipyard, par — and cuts it first every single era.
          // Comparisons use the handicapped figure too, so a −35% shipyard ranks as −5%.
          const tp = E.TPthr(p.ind, t) / 100 - (SHIP_INDUSTRIES.has(p.ind.id) ? TG.shipyard_penalty : 0);
          if (isFinite(tp) && tp < 0 && tp < worstP) { worst = t; worstP = tp; }
        }
      }
      if (!worst) break;
      maxCount[worst.key] = Math.max(1, Math.floor((S.BLDNUM[worst.key] || 1) - 1));
      shrunk[worst.key] = (shrunk[worst.key] || 0) + 1;
    }
    conv = contSettle(30, 0.15);
  }

  // ---- POST-SOLVE SCENARIO TUNER: free entry ---------------------------------------------------------
  // ⚠ THIS IS NOT PART OF THE SOLVE. The solve is finished by this point — recipes, PM selections and
  // volumes are FINAL and must not move. The tuner adjusts one thing only, BUILDING COUNTS, and re-prices
  // after each step. That is why it does not call contSettle(): contSettle re-solves input recipes, which
  // would undo the solve it is supposed to be tuning.
  //
  // The rule: any era-appropriate manufacturing tier earning more than +25% is built one level at a time
  // until it drops under the cap. A fat margin in a market anyone can enter is not an equilibrium.
  // ⚠ WHEN GROWTH TURNS OUT TO BE FUTILE, UNWIND THE WHOLE RUN — not just the step that revealed it.
  // The margin can keep falling for a while and then stall (the good reaches the 25% price floor), so by
  // the time the guard fires the producer may already carry many levels that bought nothing. Dropping only
  // the last one leaves the scenario in the middle of a growth spurt it has just decided was pointless.
  // `growStart` remembers the count each producer had before this rule first touched it, so the revert
  // goes back to the beginning of the run.
  const tuned = {}, capBlocked = new Set(), growStart = {};
  if (PROFIT_CAP_ON) {
    for (let step = 0; step < PROFIT_CAP_STEPS; step++) {
      // WHICH tier grows: of every TIER TYPE currently over the cap, the MOST PROFITABLE one, one level at
      // a time. Stated that way rather than as "an industry over the cap grows", which left it ambiguous
      // what happens when several qualify at once.
      //
      // ⚠ It considers EVERY placed tier, not only the era-appropriate one. Normally the top tier is the
      // most profitable and so is the one that grows — which is the intent — but where an older tier is the
      // fattest, that is precisely the ladder being inverted, and expanding it is what competes its margin
      // away. Restricting the search to the top tier would leave the actual offender untouched.
      let best = null, bestP = PROFIT_CAP;
      for (const p of placement) {
        if (p.ind.follows_be === false) continue;
        for (const r of p.rows) {
          const t = r.t;
          if (t.era > era || !(S.BLDNUM[t.key] > 0) || capBlocked.has(t.key)) continue;
          const pr = E.TPthr(p.ind, t) / 100;
          if (isFinite(pr) && pr > bestP) { best = { ind: p.ind, t }; bestP = pr; }
        }
      }
      // ...and the RAW BAND, in the SAME loop. Growing a raw producer cuts its good's price, which can push
      // a sibling producer of the same good below zero — so the upper and lower bounds have to be enforced
      // together, not in sequence, or each pass undoes the other's work.
      let rawGrow = null, rawGrowP = 0, rawDrop = null, rawDropP = 0;
      for (const b of refProducers) {
        if (!(S.BLDNUM[b] > 0) || dropped.has(b) || !isRawProducer(b)) continue;
        // A FIXED-COUNT producer is hand-placed by design and may only ever shrink, never grow — so the
        // band's UPPER bound does not apply to it. Reported as exempt rather than as a violation.
        if (fixedRef[b] != null) continue;
        const band = rawBandOf(b); if (!band) continue;
        const ec = E.refEcon(b); if (!ec || ec.tp == null || !isFinite(ec.tp)) continue;
        const pr = ec.tp / 100;
        if (pr > band[1] && !capBlocked.has(b) && pr - band[1] > rawGrowP) { rawGrow = b; rawGrowP = pr - band[1]; }
        if (pr < band[0] && pr < rawDropP) { rawDrop = b; rawDropP = pr; }
      }
      // fix whichever violation is worst; a loss-maker outranks an over-earner
      // A FIXED-COUNT producer that cannot turn a profit sheds ONE level, then we look again. It shrinks
      // rather than being dropped outright, because the question is how far the market pushes it back, not
      // whether it survives — and it may well stabilise partway.
      let shrink = null;
      for (const b in fixedRef) {
        if (!(fixedRef[b] > 0) || !(S.BLDNUM[b] > 0)) continue;
        const ec = E.refEcon(b);
        if (ec && ec.tp != null && isFinite(ec.tp) && ec.tp < 0) { shrink = b; break; }
      }
      if (!best && !rawGrow && !rawDrop && !shrink) break;
      const beforeC = ceilingBreaches();
      if (shrink) {
        // ⚠ THE CEILING GUARDS THE SHRINK TOO. In era 1 the plantation is dye's ONLY source — synthetics
        // does not exist yet — so shrinking it to zero left dye with demand and no supply, pinned at the
        // band edge. Retreat stops at the point where the market still has a supplier.
        const prevN = fixedRef[shrink];
        fixedRef[shrink] -= 1;
        if (fixedRef[shrink] <= 0) dropped.add(shrink);
        settle(); syncPrices();
        if (ceilingBreaches() > beforeC) {
          fixedRef[shrink] = prevN; dropped.delete(shrink); protectedRaw.add(shrink);
          settle(); syncPrices();
        }
        continue;
      }
      if (rawDrop) {
        dropped.add(rawDrop);
        settle(); syncPrices();
        if (ceilingBreaches() > beforeC) { dropped.delete(rawDrop); protectedRaw.add(rawDrop); settle(); syncPrices(); }
        continue;
      }
      if (rawGrow && (!best || rawGrowP > bestP - PROFIT_CAP)) {
        const prevR = minCount[rawGrow] || 0, tpBefore = E.refEcon(rawGrow).tp;
        if (growStart[rawGrow] == null) growStart[rawGrow] = S.BLDNUM[rawGrow] || 0;
        minCount[rawGrow] = (S.BLDNUM[rawGrow] || 0) + 1;
        settle(); syncPrices();
        // ⚠ STOP IF GROWING DOES NOT ACTUALLY HELP. If the good is already pinned at the 25% price floor,
        // extra supply cannot push the price down any further, so the margin does not move and the loop
        // will spend its entire budget achieving nothing. Measured before this guard: tea_plantation took
        // ALL 400 steps in era 1 and still read 294%. A rule that cannot reach its goal must say so and
        // stop, not grind.
        const tpAfter = E.refEcon(rawGrow).tp;
        const futile = PROFIT_CAP_FUTILITY && !(tpAfter < tpBefore - 0.25);
        if (ceilingBreaches() > beforeC || futile) {
          // ceiling breach: undo this step. FUTILE: undo the entire run back to where it started.
          minCount[rawGrow] = futile ? growStart[rawGrow] : prevR;
          capBlocked.add(rawGrow); settle(); syncPrices();
          if (futile) delete tuned[rawGrow.replace(/^building_/, '')];
        } else tuned[rawGrow.replace(/^building_/, '')] = (tuned[rawGrow.replace(/^building_/, '')] || 0) + 1;
        continue;
      }
      if (!best) break;
      const k = best.t.key, prev = minCount[k] || 0;
      const tpB = E.TPthr(best.ind, best.t);
      if (growStart[k] == null) growStart[k] = S.BLDNUM[k] || 0;
      minCount[k] = (S.BLDNUM[k] || 0) + 1;               // one level at a time, as specified
      settle(); syncPrices();
      // the futility guard applies to manufacturing too: if its own good is floored, more capacity cannot
      // move the margin and the run is unwound to where it began
      const tpA = E.TPthr(best.ind, best.t);
      if (PROFIT_CAP_FUTILITY && !(tpA < tpB - 0.25)) {
        minCount[k] = growStart[k]; capBlocked.add(k); settle(); syncPrices();
        const lbl = best.t.era === era ? best.ind.id : `${best.ind.id} e${best.t.era}`;
        delete tuned[lbl];
        continue;
      }
      if (ceilingBreaches() > beforeC) {
        // the extra capacity pushed one of its own inputs to the +75% band edge — the ceiling outranks
        // this rule, so put the level back and stop growing THIS TIER (not the whole industry: another
        // tier of it may still have room)
        minCount[k] = prev; capBlocked.add(k);
        settle(); syncPrices();
      } else {
        const label = best.t.era === era ? best.ind.id : `${best.ind.id} e${best.t.era}`;
        tuned[label] = (tuned[label] || 0) + 1;
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
  // PRODUCTIVE workforce: our tiers plus the raw producers. The quantity everything else is scaled from.
  function productiveWorkforce() {
    let n = 0;
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) n += c * E.empTotal(E.tierEmp(t)); }
    for (const b of refProducers) { const c = S.BLDNUM[b] || 0; if (c) n += c * E.empTotal(E.selEmp(E.refSel(b))); }
    return n;
  }
  function addSupport() {
    // SIZE THE SUPPORT BUILDINGS FROM THE PROFESSIONS THEY EMPLOY, not from a share of building levels.
    // Each target profession count is the productive workforce × its measured vanilla ratio; the building
    // that supplies it is then placed at target ÷ its own per-level employment of that profession.
    const wProd = productiveWorkforce();
    const sized = PROF_SOURCE.filter(x => S.VAN.buildings[x.bld]);
    // seed so the first pass has something to subtract against
    for (const { bld } of sized) if (!(S.BLDNUM[bld] > 0)) S.BLDNUM[bld] = 1;
    // How much of a profession EVERY placed building employs, optionally ignoring one building — that is
    // the "employed elsewhere" term each designated building is sized against.
    const employedOf = (prof, except) => {
      let n = 0;
      for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0;
        if (c) n += (E.tierEmp(t)[prof] || 0) * c; }
      for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0;
        if (!c || b === except || E.isSubsistenceBuilding(b)) continue;
        n += ((E.selEmp(E.refSel(b)) || {})[prof] || 0) * c; }
      return n;
    };
    // Iterated, because these buildings supply each other's professions (government administration alone
    // provides 36.7% of aristocrats and 27% of clerks), so one pass would over- or under-shoot.
    for (let pass = 0; pass < 4; pass++) {
      for (const { prof, bld } of sized) {
        const per = (E.selEmp(E.refSel(bld)) || {})[prof] || 0;
        if (!(per > 0)) continue;                     // this building does not employ that profession
        const want = wProd * (PROF_RATIO[prof] || 0);
        const elsewhere = employedOf(prof, bld);      // includes PRODUCTIVE employers — e.g. art academies
        S.BLDNUM[bld] = lvl(Math.max(0, want - elsewhere) / per);
      }
    }
    // URBAN CENTRES — derived, never placed: floor(Σ urbanization / 100), FINDINGS F13.
    // ⚠⚠ THAT FORMULA IS A CEILING, NOT A COUNT (`ERA_URBAN_SHRINK=0` restores it as a count). F13
    // measures how many levels urbanization ENTITLES a market to, and the game staffs them out of whoever
    // is available — an urban centre that cannot pay its way sheds employment rather than standing fully
    // manned at a loss. Our model has no employment scaling, so holding the entitlement AND full
    // employment modelled a building that would not exist: measured margins ran 1780 −19%, 1836 −49%,
    // 1870 −2%, 1900 −2%, 1920 +17%, 1945 +15%. The two middle eras happen to sit on the zero-profit
    // equilibrium the real rule implies; 1836 is a −49% building held fully staffed, over-supplying
    // services and transportation for that entire scenario.
    // So the reduction below may now cut urban centres like anything else, and this line takes the
    // MINIMUM of the entitlement and whatever cap the reduction has imposed. Where the cap does not bind,
    // the behaviour is exactly F13's.
    let urb = 0;
    for (const b in S.BLDNUM) { if (isUrban(b)) continue; urb += (S.BLDNUM[b] || 0) * urbanizationOf(ourVanillaAnchor(b)); }
    const urbEntitled = Math.max(1, Math.floor(urb / URBAN_PER_LEVEL));
    S.BLDNUM.building_urban_center = URBAN_SHRINK
      ? Math.min(urbEntitled, maxCount.building_urban_center != null ? maxCount.building_urban_center : Infinity)
      : urbEntitled;
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
    // …and the same employment kept PER PROFESSION, so a scenario can be read at the level people actually
    // think in ("how many bureaucrats?") instead of only as three strata. Strata remain the unit consumption
    // is computed on — a buy package is a wealth level, not a job — so these are additive detail that must
    // sum back to them, never a second source of truth.
    const byProf = {};
    const addEmp = (emp, c) => { for (const p in emp) { const s = stratumOf(p); if (s) byStratum[s] += emp[p] * c;
      if (emp[p]) byProf[p] = (byProf[p] || 0) + emp[p] * c; } };
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) addEmp(E.tierEmp(t), c); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || E.isSubsistenceBuilding(b)) continue;
      addEmp(E.selEmp(E.refSel(b)), c); }
    // SOLDIERS COME FROM THE ARMY, not from a building. V3 puts a barracks' manpower in the battalions it
    // hosts, which is why `building_barrack` carries no employment at all — so a scenario that placed no
    // military buildings had ZERO soldiers while its 800 battalions bought small arms and ate nothing.
    // A battalion is 1 000 serving soldiers; they are working adults, so the people behind them are
    // 1 000 ÷ the working-adult ratio. They are lower-stratum consumers like any other wage earner.
    const battalions = Object.values(S.UNITNUM).reduce((a, c) => a + c, 0);
    const milWorkforce = battalions * SOLDIERS_PER_BATTALION;
    // ⚠ 1 000 per battalion is TOTAL manpower and it is NOT all soldiers. Vanilla splits it in the
    // barracks' own training PM — `profession_ratio = { soldiers = 97 officers = 3 }`, running to 75/25
    // as the method improves. advanceNonMarketPMs() has already put the barracks on the NEWEST method the
    // era allows (later ones are strictly better and always taken), so reading the ratio off the live
    // selection makes the split era-correct for free instead of hard-coding a second copy of a vanilla number.
    // ⚠ OFFICERS ARE MIDDLE STRATUM, soldiers LOWER. Omitting them did not lose people — it filed 3-25%
    // of the army in the wrong, poorer consumption class, so the scenario under-bought middle-class goods.
    const milSplit = militaryProfessionSplit(era);
    let soldierWorkforce = 0;
    for (const p in milSplit) {
      const n = milWorkforce * milSplit[p], st = stratumOf(p);
      if (st) byStratum[st] += n;
      if (n) byProf[p] = (byProf[p] || 0) + n;
      if (p === 'soldiers') soldierWorkforce = n;
    }
    // …and give them somewhere to be: barracks host the battalions, employ nobody and consume nothing, so
    // placing them adds no goods demand and no double-counted wages.
    if (S.VAN.buildings[BARRACK_BLD] && battalions > 0)
      S.BLDNUM[BARRACK_BLD] = Math.max(1, Math.round(battalions / BATTALIONS_PER_BARRACK));

    const nonPeasant = (byStratum.lower + byStratum.middle + byStratum.upper) / WORK_RATIO;
    peasants = nonPeasant * PEASANT_SHARE[eIx] / Math.max(1e-9, 1 - PEASANT_SHARE[eIx]);
    S.POPS = {
      total: Math.round(nonPeasant + peasants),
      lower: Math.round(byStratum.lower / WORK_RATIO),
      middle: Math.round(byStratum.middle / WORK_RATIO),
      upper: Math.round(byStratum.upper / WORK_RATIO),
      peasants: Math.round(peasants), slaves: 0,
      soldiers: Math.round(soldierWorkforce / WORK_RATIO),   // reported; already inside `lower`
    };
    // PEOPLE per profession (workforce ÷ working-adult ratio), plus the two classes that are not employment:
    // peasants stand on their own, slaves are zero by the scenario's law stance.
    POPPROF = {};
    for (const p in byProf) POPPROF[p] = Math.round(byProf[p] / WORK_RATIO);
    POPPROF.peasants = Math.round(peasants);
    POPPROF.slaves = 0;
    // SUBSISTENCE FOLLOWS THE PEASANTS, spread over the TYPES in vanilla proportion rather than all landing
    // on one. Each type is sized by its own jobs-per-level (rice paddies hold twice what a farm does), so
    // the split is by WORKFORCE share, not by level share — putting every peasant in `subsistence_farm`
    // both misstated the mix and mis-stated the level count.
    const peasantWork = peasants * WORK_RATIO;
    let placed = 0;
    for (const b in SUBSISTENCE_MIX) {
      if (!S.VAN.buildings[b]) continue;
      const per = E.empTotal(E.selEmp(E.refSel(b))) || SUBSISTENCE_JOBS_PER_LEVEL;
      const lvl = Math.max(0, Math.round(peasantWork * SUBSISTENCE_MIX[b] / per));
      if (lvl > 0) { S.BLDNUM[b] = lvl; placed += lvl * per; }
    }
    // nothing matched (a stripped vanilla?) — fall back to the single farm rather than losing the peasants
    if (!(placed > 0)) {
      const lvl = Math.max(0, Math.round(peasantWork / SUBSISTENCE_JOBS_PER_LEVEL));
      if (lvl > 0) S.BLDNUM.building_subsistence_farm = lvl;
    }
  }
  function setArmy() {
    Object.keys(S.UNITNUM).forEach(k => delete S.UNITNUM[k]);
    // GDP proxy: the value of everything the market's buildings produce, at this era's prices. It is a
    // GROSS-output proxy, not value added — stated rather than hidden, because 5% of GDP means nothing
    // without saying which GDP.
    // ⚠ GDP IS VALUE ADDED, NOT GROSS OUTPUT — measured; see ui/econ.js's scenarioGDP.
    // `gdp` here stays WEEKLY because every budget below it is a weekly goods bill. A share of ANNUAL GDP
    // is the same number: 5% of (52 x weekly VA) spent over 52 weeks is 5% of weekly VA, so the 52 cancels
    // and the percentage can be read straight off vanilla's own figures.
    // REFERENCE, measured off a vanilla 1901 gamestate as a share of that country's GDP:
    //   army goods bill  GBR 1.8% · USA 0.5% · FRA 4.6% · RUS 3.4% · BEL 2.1% · JAP 2.3%
    // ⚠ Those are LOGISTICS ONLY — barracks and conscription centres carry no goods at all (unit upkeep
    // sits on the battalions), so vanilla's true military share is higher by whatever the units eat.
    gdp = E.scenarioValueAdded();
    grossOut = 0;
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) grossOut += c * E.outputValue(i, t, true); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c) continue;
      grossOut += c * E.goodsVal(E.selGoods(E.refSel(b)).out, true); }
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
           constrShare: constructionShare(), constrLevels: S.BLDNUM[CONSTRUCTION_BLD] || 0, gross: grossOut, shrunk,
           profit: profitTotals(),
           popProf: { ...POPPROF },
           tuned: { ...tuned }, capBlocked: new Set(capBlocked), fixedRef: { ...fixedRef },
           modelOnlyPlaced: (() => { let n = 0, tot = 0;
             for (const i of S.IND) for (const t of i.tiers) if (t.model_only) { tot++; if (S.BLDNUM[t.key] > 0) n++; }
             return { placed: n, total: tot }; })(),
           // the two things the free-entry rule has to be judged on afterwards
           mfgShare: (() => { let m = 0, tot = 0;
             for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) { const v = c * E.thruMult(t.key) * E.outputValue(i, t, true); m += v; tot += v; } }
             for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || E.isSubsistenceBuilding(b)) continue;
               tot += c * E.thruMult(b) * E.goodsVal(E.selGoods(E.refSel(b)).out, true); }
             return tot > 0 ? m / tot : 0; })(),
           rawProfits: (() => { const xs = [], out = [];
             for (const b of refProducers) { if (!(S.BLDNUM[b] > 0) || !isRawProducer(b)) continue;
               const ec = E.refEcon(b); if (!ec || ec.tp == null || !isFinite(ec.tp)) continue;
               xs.push(ec.tp);
               const band = rawBandOf(b);
               if (band && (ec.tp / 100 < band[0] || (ec.tp / 100 > band[1] && FIXED_REF_COUNT[b] == null)))
                 out.push({ b: b.replace(/^building_/, ''), tp: ec.tp, lo: band[0] * 100, hi: band[1] * 100 });
             }
             xs.sort((a, b2) => a - b2);
             return xs.length ? { n: xs.length, med: xs[xs.length >> 1], max: xs[xs.length - 1],
                                  over50: xs.filter(v => v > 50).length, outside: out } : null; })(),
           dropped: new Set(dropped), protectedRaw: new Set(protectedRaw),
           rawLoss: refProducers.filter(b => S.BLDNUM[b] > 0 && isRawProducer(b))
             .filter(b => { const ec = E.refEcon(b); return ec && ec.tp != null && ec.tp < 0; })
             .map(b => ({ b: b.replace(/^building_/, ''), tp: E.refEcon(b).tp })),
           infeasible: new Map(infeasible), capped: new Set(capped), sec, ore, noBuyer };
}

// ===================================================================================================
// ===================================================================================================
// CANONICAL START — the solve must not depend on the numbers the LAST solve happened to write.
//
// Freezing the recipe MIX (`input_ratio`) stopped the proportions drifting, but the stored SCALE was still
// an input: run N wrote slightly different volumes from run N−1, so run N+1 opened with a different order
// book, took a different trajectory through a search containing discrete choices (PM selection, integer
// counts) and could settle in a different basin. That is the whole of the write-cycle wander.
//
// So every tier is reset to `ratio × X0` before anything else runs, with X0 fixed by the 4:1 value-added
// cap — a definition, not a remembered number. The config's stored volumes are now purely an OUTPUT of the
// solve; nothing about the previous run survives into the next one.
for (const i of S.IND) {
  for (const t of i.tiers) {
    const keys = Object.keys(t.inputs || {});
    if (!keys.length) continue;
    const r = ratioFor(i, t);
    if (!r) continue;
    t._ratio = r;
    const outGood = E.tierOut(i, t);
    const Obase = t.output_qty * (S.PRICES[outGood] || 0);
    let unitBase = 0; for (const g of keys) unitBase += t._ratio[g] * (S.PRICES[g] || 0);
    if (!(Obase > 0) || !(unitBase > 0)) continue;
    const X0 = (Obase / ioCapFor(i.id)) / unitBase;
    for (const g of keys) t.inputs[g] = Math.max(minMainInput(i, g), Math.round(t._ratio[g] * X0 * 10) / 10);
  }
}
// SAY WHICH BRANCH RAN. `frozen` sat unreachable for weeks because nothing reported it; a source line is
// the cheapest possible guard against the same thing happening to the next one. `inputs` is the only
// entry here that carries state from the previous `--write` — it must read 0.
{
  const order = ['own', 'below', 'frozen', 'inputs'];
  const drift = RATIO_SRC.inputs || 0;
  console.log(`\nRECIPE MIX (ERA_RATIO=${RATIO_MODE}): `
    + order.filter(k => RATIO_SRC[k]).map(k => `${k} ${RATIO_SRC[k]}`).join(' · ')
    + (drift ? `   ⚠ ${drift} tier(s) took their mix from the LAST WRITE — the write cycle cannot converge`
             : '   — no tier reads its mix from the previous run'));
}

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
  // ⚠⚠ SCORE EACH TIER AGAINST THE TARGET IT WAS SOLVED TO. A scenario holds two tuned rungs, not one, and
  // they have DIFFERENT targets (see ERAS/`lead` in era_solver.mjs):
  //   LEADING tier  (era == LEAD_TIER)  — the newest technology in the world  -> TG.current  (+20%)
  //   DOMINANT tier (era == this era)   — the workhorse, what the era mostly runs -> TG.minus1 (+5%)
  // At era 5 there is no tier 6, so lead == dominant and the industry contributes ONE row, not two.
  //
  // ⚠ THIS LINE USED TO GRADE THE DOMINANT TIER AGAINST +20%, and that was a leftover from the five-era
  // ladder, where the top tier present WAS the era-appropriate one. After the switch to solving each rung
  // where it is dominant, the solver aimed the workhorse at +5% while this scored it against +20% — a
  // SYSTEMATIC ~15pp phantom miss in every era, which is most of what "mean |off|" was reporting. Era 5's
  // worst list read `steel 3%/20% railway 3%/20% automotive 3%/20%`: three industries sitting ON their
  // actual target, reported as 15-17pp misses, and the era scored 0/21 within 8pp.
  // The rule: the report grades what the solve aimed at, or it is measuring its own bookkeeping.
  const hits = [];
  const LEAD = FIT.eras[meta.eIx].lead != null ? FIT.eras[meta.eIx].lead : meta.era;   // as `placement` reads it
  for (const i of S.IND) {
    if (i.follows_be === false) continue;
    const sorted = [...i.tiers].sort((a, b) => a.era - b.era);
    const ship = SHIP_INDUSTRIES.has(i.id) ? TG.shipyard_penalty : 0;
    const score = (t, tgt, role) => {
      if (!t || !S.BLDNUM[t.key]) return;
      const p = E.TPthr(i, t) / 100;                       // throughput-aware, same as the solve
      if (!isFinite(p)) return;
      // ⚠ `kind` MUST keep the `tier ` prefix — the floored test below keys on it to build `I:<industry>`
      // vs `R:building_<name>`. Renaming it to the role silently sent every lookup to the reference branch,
      // so nothing was ever detected as floored and era 1's seven floored industries became genuine misses.
      hits.push({ what: i.id, kind: 'tier e' + t.era, role, got: p, tgt: tgt + ship, off: p - (tgt + ship) });
    };
    // ⚠⚠ THE LEADING TIER IS DELIBERATELY *NOT* SCORED HERE, and this is not an oversight. A tier's recipe
    // is solved exactly once, in the era where it is DOMINANT — so when era N reports, the era-(N+1) tier
    // it holds still carries an UNSOLVED recipe, and scoring it measures a state that will not ship.
    // Measured: at era 1 the tooling e2 tier reads inputs {iron 6.4, wood 9.6} and a margin of 201%, where
    // the config it converges to holds {iron 16.8, wood 25.1} and 50% — a uniform 2.62x, with prices,
    // wage, employment, throughput, levels and secondary PM all identical. Era 0 (no leading tier) and era
    // 5 (nothing left to solve) were the only two eras that agreed with the shipped config.
    // This is §10.14.1's rule surviving for RECIPES after it was fixed for prices.
    // ⇒ Scoring the leading tier needs a FINAL pass over every era after the whole solve is done. Until
    // that exists, the per-era line scores only what is final at the moment it prints.
    const dom = sorted.find(t => t.era === meta.era);
    score(dom, TG.minus1, 'dom');
    // A PLATEAUED industry has neither: its ladder ended below this era, and its last tier is PERMANENT
    // rather than stale (CLAUDE.md — the good's price holds it up instead of deflating past it). Score it
    // against the plateau target, or the industry silently contributes nothing to its own era's objective.
    if (!dom && sorted.length) {
      const last = sorted[sorted.length - 1];
      if (last.era < meta.era) score(last, TG.plateau != null ? TG.plateau : TG.minus1, 'plat');
    }
  }
  // ⚠ EXTRACTION AND AGRICULTURE ARE NO LONGER SCORED AGAINST A TARGET. They have a BAND (RAW_BAND) and are
  // reported against it separately. Scoring them here was the source of essentially the whole "profit
  // targets" residual — a good has one price and several producers of differing productivity, so at most
  // one could ever sit on a target and the others were permanently logged as misses that no lever could fix.
  // FLOORED: the solver wanted FEWER than one level of this building and could not have it. A single
  // level already floods that good's market, so the price sits at the floor and the margin cannot be
  // rescued by any count. That is not a solver miss — it is a real property of a one-country scenario
  // with no exports: a market this size cannot support even one art academy or one vineyard at the
  // target margin. Scored separately, because lumping it in with genuine misses hides both.
  for (const h of hits) {
    const key = h.kind.startsWith('tier') ? 'I:' + h.what : 'R:building_' + h.what;
    h.floored = (meta.scaleOf[key] != null && meta.scaleOf[key] < 0.95 && h.off < 0);
  }
  if (process.env.ERA_HITS) console.log('HITS e' + meta.era + ' LEAD=' + LEAD + '  ' +
    hits.map(h => `${h.what}[${h.kind}]=${(h.got * 100).toFixed(0)}%`).join(' '));
  const scored = hits.filter(h => !h.floored);
  const onTgt = scored.filter(h => Math.abs(h.off) <= 0.08).length;
  const meanOff = scored.reduce((a, h) => a + Math.abs(h.off), 0) / Math.max(1, scored.length);
  scored.sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
  const levels = Object.values(S.BLDNUM).reduce((a, c) => a + c, 0);
  const subs = S.BLDNUM.building_subsistence_farm || 0;
  console.log(`\n--- era ${meta.era}  (${cfg.year}, "${cfg.label}")  SoL ${cfg.sol}  base wage £${cfg.base_wage.toFixed(4)}/wk`);
  console.log(`    pops ${fmtN(S.POPS.total)}  = upper ${fmtN(S.POPS.upper)} · middle ${fmtN(S.POPS.middle)} · lower ${fmtN(S.POPS.lower)} · peasants ${fmtN(S.POPS.peasants)} (${Math.round(100 * S.POPS.peasants / S.POPS.total)}%)`);
  console.log(`    buildings ${fmtN(levels)} levels (${fmtN(subs)} subsistence, ${fmtN(S.BLDNUM.building_urban_center || 0)} urban centres)  jobs ${fmtN(meta.jobs)}`);
  const milS = militaryProfessionSplit(meta.era);
  const milPm = MIL_SPLIT_PM || '(none)';
  console.log(`    GDP £${fmtN(Math.round(meta.gdp * 52))}/yr (value added x52; gross output £${fmtN(Math.round(meta.gross))}/wk)   army ${fmtN(Object.values(S.UNITNUM).reduce((a, c) => a + c, 0))} battalions at ${Math.round(ARMY_GDP_SHARE * 100)}% of GDP`
    + `, split ${Object.entries(milS).map(([p, v]) => p + ' ' + Math.round(v * 100) + '%').join(' / ')} by ${milPm.replace(/^pm_/, '')}`);
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
  console.log(`    ILLOGICAL: ${illTot} point(s) (${net} excluding ${EXCUSED_LABEL}) — loss-making `
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
      // ⚠ "growth stopped" covers BOTH reasons — the +75% ceiling, and a good already at the 25% price
      // floor where extra supply cannot move the margin at all. Naming only the ceiling was misleading.
      + (meta.capBlocked.size ? `  ⚠ growth stopped (ceiling or price floor): `
          + [...meta.capBlocked].map(x => String(x).replace(/^building_/, '')).join(', ') : ''));
    console.log(`      SANITY: manufacturing ${(100 * meta.mfgShare).toFixed(0)}% of non-subsistence output`
      + (meta.mfgShare > 0.90 ? ' ⚠ OVERSIZED' : '')
      + (rp ? ` · raw producers median ${rp.med.toFixed(0)}% / max ${rp.max.toFixed(0)}%`
             + (rp.over50 ? ` (${rp.over50} over +50%)` : '') : ''));
  }
  // Fixed-count producers, and how far the market pushed them back. Plus model_only visibility: those tiers
  // are modelled but never emitted (no unlocking technology exists), so a reader has to be told they are in
  // here — they are priced and scored exactly like real tiers, which is the intent but not self-evident.
  {
    const fr = Object.entries(meta.fixedRef);
    if (fr.length) console.log(`    FIXED-COUNT PRODUCERS: `
      + fr.map(([b, n]) => `${b.replace(/^building_/, '')} ${n}/${FIXED_REF_COUNT[b]}`
          + (n < FIXED_REF_COUNT[b] ? (n === 0 ? ' (driven out)' : ' (pushed back)') : '')).join(', '));
    const mo = meta.modelOnlyPlaced;
    console.log(`    MODEL-ONLY TIERS: ${mo.placed} of ${mo.total} present — modelled and scored here, never emitted to the game`);
    // Withholding an industry is a strong act, so it is always named — never silent.
    if (meta.noBuyer && meta.noBuyer.length) console.log(`    NOT PLACED (nothing in this era buys their good): `
      + meta.noBuyer.join(', '));
  }
  {
    const sh = Object.entries(meta.shrunk || {});
    if (sh.length) console.log('    SHRUNK (loss-making, capped one level at a time): ' + sh.sort((a, b) => b[1] - a[1])
      .map(([k, n]) => k.replace(/^building_/, '') + ' −' + n).join(', '));
  }
  // ⚠⚠ THE PER-ERA PROFITABILITY LINE IS GONE ON PURPOSE. It was computed HERE, inside the era pass, and
  // that is too early to mean anything: a tier recipe is solved in the era where its tier is DOMINANT, so
  // era N still holds an UNSOLVED recipe for the era-(N+1) rung standing in its scenario, and unsolved
  // recipes are leaner. Measured against a replay of the shipped presets it agreed EXACTLY at era 0 (no
  // leading tier) and era 5 (nothing left to solve) and overstated everything between — net £1.80M against
  // a true £0.40M at 1900, 4.5x. See the FINAL PROFIT PASS after the era loop.
  console.log(`    CONSTRUCTION: ${meta.constrLevels} levels = ${(100 * meta.constrShare).toFixed(1)}% of GDP`
    + ` (target ${(100 * CONSTRUCTION_GDP_SHARE).toFixed(0)}%, ${CONSTRUCTION_PM[meta.era]})`
    + (Math.abs(meta.constrShare - CONSTRUCTION_GDP_SHARE) > 0.02 ? '   ⚠ OFF TARGET' : ''));
  const outB = (meta.rawProfits && meta.rawProfits.outside) || [];
  console.log(`    RAW BAND (extraction 0–${(RAW_BAND.extraction[1] * 100).toFixed(0)}%, agriculture 0–${(RAW_BAND.agriculture[1] * 100).toFixed(0)}%): `
    + (outB.length ? `⚠ ${outB.length} OUTSIDE — ` + outB.map(r => `${r.b} ${r.tp.toFixed(0)}%`
        + (meta.protectedRaw.has('building_' + r.b) ? ' (kept: only source)' : '')
        + (meta.capBlocked.has('building_' + r.b) ? ' (price at floor — growing cannot help)' : '')).join(', ')
                   : `clear — all ${meta.rawProfits ? meta.rawProfits.n : 0} present producers inside the band`)
    + (meta.dropped.size ? `\n      dropped as unviable (${meta.dropped.size}): ` + [...meta.dropped].map(b => b.replace(/^building_/, '')).join(', ') : '')
    + (meta.protectedRaw.size ? `\n      ⚠ KEPT AT A LOSS — the market's only source, dropping them breached the ceiling: `
        + [...meta.protectedRaw].map(b => b.replace(/^building_/, '')).join(', ') : ''));
  // ⭐ SCALE SANITY — now a VERIFICATION that the hard constraints in SCALE_LIMIT held, not a warning.
  // The caps bind inside applyCounts, so anything printed here is a BUG in the constraint rather than a
  // property of the economy. Kept because a constraint nobody checks is a constraint that silently stops
  // being applied — the same reasoning as the landmine register.
  {
    const AGRI_LIM = SCALE_LIMIT.agriculture;
    let wh = 0, fi = 0, agri = 0; const ore = {}, plant = {};
    for (const b in S.BLDNUM) {
      const n = S.BLDNUM[b] || 0; if (!(n > 0)) continue;
      const c = scaleCat(b);
      if (/whaling/.test(b)) wh += n;
      else if (/fishing/.test(b)) fi += n;
      else if (c === 'mining' || c === 'oil' || c === 'rubber' || c === 'logging') ore[b] = (ore[b] || 0) + n;
      else if (isScaleAgri(b)) { agri += n; if (c === 'plantations') plant[b] = (plant[b] || 0) + n; }
    }
    const bad = [];
    if (wh > SCALE_LIMIT.whaling) bad.push(`whaling ${wh}`);
    if (fi > SCALE_LIMIT.fishing) bad.push(`fishing ${fi}`);
    for (const b in ore) if (ore[b] > SCALE_LIMIT.oreOrLogging) bad.push(`${b.replace(/^building_/, '')} ${ore[b]}`);
    for (const b in plant) if (plant[b] > SCALE_LIMIT.plantation) bad.push(`${b.replace(/^building_/, '')} ${plant[b]}`);
    if (agri > AGRI_LIM) bad.push(`agriculture combined ${agri}`);
    const at = [];
    if (wh === SCALE_LIMIT.whaling) at.push(`whaling ${wh}`);
    if (fi === SCALE_LIMIT.fishing) at.push(`fishing ${fi}`);
    for (const b in ore) if (ore[b] === SCALE_LIMIT.oreOrLogging) at.push(`${b.replace(/^building_/, '')} ${ore[b]}`);
    for (const b in plant) if (plant[b] === SCALE_LIMIT.plantation) at.push(`${b.replace(/^building_/, '')} ${plant[b]}`);
    console.log(`    SCALE LIMITS (whaling ${SCALE_LIMIT.whaling} · fishing ${SCALE_LIMIT.fishing} · each ore/logging ${SCALE_LIMIT.oreOrLogging} · each plantation ${SCALE_LIMIT.plantation} · agriculture ${AGRI_LIM}): `
      + (bad.length ? `⚠⚠ BREACHED — ${bad.join(', ')} (the cap failed to apply; this is a bug)`
                    : at.length ? `held; AT the cap: ${at.join(', ')}` : 'held, nothing near a cap'));
  }
  console.log(`    INDUSTRIAL CEILING: ${breach.length ? '⚠ ' + breach.length + ' consumable good(s) AT +75%' : 'clear — no consumable good at +75%'}`);
  for (const b of breach) console.log(`      ${b.g} buy ${fmtN(b.buy)} / sell ${fmtN(b.sell)}`
    + (b.orphan ? '   ⚠ NO PRODUCER AT ALL — no count can fix this' : '   from ' + b.src.join(', ')));

  out.push({
    id: `era${meta.era}_${cfg.year}`,
    label: `Era ${meta.era} · ${cfg.year}`,
    group: 'Era ladder · solved, prices unlocked',
    country: null,
    base_wage: cfg.base_wage,
    working_adult_ratio: WORK_RATIO,
    base_wage_note: `era ${meta.era} lower-stratum SoL ${cfg.sol} via FINDINGS F26, base = exp((SoL−37.43)/10.49)`,
    market: [],
    buildings: { ...S.BLDNUM },
    pms: (() => { const o = {}; for (const i of S.IND) for (const t of i.tiers) if (S.BLDNUM[t.key]) o[t.key] = { ...t._sec };
                  for (const b in S.REFSEL) if (S.BLDNUM[b]) o[b] = { ...S.REFSEL[b] }; return o; })(),
    pops: { ...S.POPS },
    pops_by_profession: { ...meta.popProf },
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
// ===================================================================================================
// ⭐⭐ THE FINAL PROFIT PASS — the ONLY place profit totals are reported, and it runs after EVERYTHING.
//
// "Reported profit totals should be provided not only after the recipes, but after the recipes AND the
// counts are settled. Anything else is useless." (user, 2026-08-08.) This replays each era's SHIPPED
// preset — the exact object written to config/era_presets.json, so counts, prices, production methods,
// throughput, pops and wages are all the final ones — against the now-final recipe book in S.IND.
//
// ⚠ WHY IT CANNOT LIVE INSIDE THE ERA PASS. A tier's recipe is solved once, in the era where that tier is
// DOMINANT. So while era N is running, the era-(N+1) rung standing in its scenario still carries an
// UNSOLVED recipe, and unsolved recipes are leaner. The old in-pass line agreed EXACTLY with a replay at
// era 0 (which has no leading tier) and era 5 (where nothing is left to solve) and overstated every era
// between — £1.80M against a true £0.40M at 1900, 4.5x. Same defect as §10.39.3, second occurrence.
//
// ⚠ WHAT THIS STILL DOES NOT FIX, and it is the deeper half: era N's COUNTS were themselves chosen
// against those provisional downstream recipes. Replaying gives honest profits FOR THE STATE THAT SHIPS,
// which is what the report must describe — but the state that ships was reached through a sequentially
// inconsistent solve. Fixing that needs an OUTER loop over the era sequence (solve all six, re-solve all
// six against the final recipes, repeat). `JOINT_PASSES` is a within-era fixed point and does not do it.
// ===================================================================================================
{
  const isGold = b => /gold/.test(b);
  const rows = [];
  for (const ep of out) {
    // restore this era's shipped scenario exactly
    S.BASE_WAGE = ep.base_wage;
    S.POPS = { ...ep.pops };
    S.SOL = { ...ep.sol };
    Object.keys(S.BLDNUM).forEach(k => delete S.BLDNUM[k]);
    for (const b in ep.buildings) S.BLDNUM[b] = ep.buildings[b];
    Object.keys(S.THRU).forEach(k => delete S.THRU[k]);
    for (const b in ep.throughput) S.THRU[b] = ep.throughput[b];
    for (const g in ep.prices) S.thresholds[g] = ep.prices[g];
    Object.keys(S.REFSEL).forEach(k => delete S.REFSEL[k]);
    const tierKey = new Map();
    for (const i of S.IND) for (const t of i.tiers) tierKey.set(t.key, t);
    for (const b in (ep.pms || {})) {
      const t = tierKey.get(b);
      if (t) t._sec = { ...ep.pms[b] }; else S.REFSEL[b] = { ...ep.pms[b] };
    }
    Object.keys(S.UNITNUM).forEach(k => delete S.UNITNUM[k]);
    for (const u in (ep.units || {})) S.UNITNUM[u + '|peace'] = ep.units[u];

    let net = 0, loss = 0, winners = 0, losers = 0, exNet = 0, exLoss = 0;
    const worst = [];
    const take = (p, excused, what) => {
      if (!isFinite(p)) return;
      net += p;
      if (p < 0) { loss -= p; losers++; worst.push({ what, p }); } else winners++;
      if (excused) { exNet += p; if (p < 0) exLoss -= p; }
    };
    const seen = new Set();
    for (const i of S.IND) {
      const ex = PMECON.LADDER_EXCUSED.has(i.id);
      for (const t of i.tiers) {
        seen.add(t.key);
        const n = S.BLDNUM[t.key] || 0; if (!(n > 0)) continue;
        const io = E.tierGoodsIO(i, t); if (!Object.keys(io.out || {}).length) continue;
        take(n * E.weeklyProfit(i, t), ex, t.key.replace(/^building_/, ''));
      }
    }
    for (const b in S.BLDNUM) {
      const n = S.BLDNUM[b] || 0; if (!(n > 0) || seen.has(b) || isGold(b)) continue;
      const ec = E.refEcon(b); if (!ec || ec.p == null) continue;
      if (!Object.keys((ec.goods || {}).out || {}).length) continue;
      take(n * ec.p, false, b.replace(/^building_/, ''));
    }
    worst.sort((a, b) => a.p - b.p);
    rows.push({ id: ep.label, net, loss, winners, losers, exNet, exLoss, worst: worst.slice(0, 4) });
  }

  console.log('\n=========== PROFITABILITY — replayed on the SHIPPED state, recipes AND counts final ===========\n');
  console.log('  era            net £/wk     losses £/wk   loss-makers   profitable   losses % of net');
  let tn = 0, tl = 0, tw = 0, tp = 0;
  for (const r of rows) {
    tn += r.net; tl += r.loss; tw += r.losers; tp += r.winners;
    console.log('  ' + r.id.padEnd(14)
      + fmtN(Math.round(r.net)).padStart(12) + fmtN(Math.round(r.loss)).padStart(16)
      + String(r.losers).padStart(14) + String(r.winners).padStart(13)
      + ((r.net > 0 ? (100 * r.loss / r.net).toFixed(0) + '%' : '∞')).padStart(17));
  }
  console.log('  ' + 'TOTAL'.padEnd(14) + fmtN(Math.round(tn)).padStart(12) + fmtN(Math.round(tl)).padStart(16)
    + String(tw).padStart(14) + String(tp).padStart(13)
    + ((tn > 0 ? (100 * tl / tn).toFixed(1) + '%' : '∞')).padStart(17));
  console.log('\n  biggest loss-makers per era');
  for (const r of rows)
    console.log('  ' + r.id.padEnd(14) + (r.worst.length
      ? r.worst.map(w => `${w.what} ${fmtN(Math.round(w.p))}`).join('  ') : '(none)'));
  console.log('\n  ⚠ Gold is excluded everywhere (it is not in the model at all — §10.40.5).');
  console.log('  ⚠ These supersede any per-era profit figure: those were computed mid-solve, before the');
  console.log('    later eras had settled the recipes of the tiers standing in the earlier ones.');
}

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
    // FREEZE THE RECIPE SHAPE. Only the SCALE of a recipe is solved; its proportions are an input to the
    // solve, not an output of it. Persisting them means a re-run cannot recover a slightly different mix
    // from the rounding of the numbers it just wrote — which is what made the write cycle wander.
    if (solved._ratio && Object.keys(solved._ratio).length) t.input_ratio = { ...solved._ratio };
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
