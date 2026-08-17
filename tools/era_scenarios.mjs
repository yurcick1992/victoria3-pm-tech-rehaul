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
import { makePmRules, optimisePMs, tierLegal, refLegal } from './era_pm.mjs';
import { activeMacro, macroBounds, macroVerifyOnly, validateMacro } from './era_macro.mjs';
import { applyTechEraCorrections } from './era_tech_sync.mjs';

const WRITE = process.argv.includes('--write');
const { E, S, PMECON, config: CFG_RAW } = loadEcon({ quiet: true });
// ONE TECHNOLOGY, ONE ERA — see build_era_ladder.mjs. Must run BEFORE anything reads S.VAN.tech_era, which
// is every production-method and vanilla-building gate below. Off unless ERA_TECH_SYNC=1.
applyTechEraCorrections(S, CFG_RAW);
// ⚗ EXPERIMENT KNOB (2026-08-09 measurement session, default no-op): rescale the ×1.5-per-tier output
// ladder IN MEMORY. ERA_OUT_SLOPE=f multiplies each tier's output_qty by (f/1.5)^k, k = the tier's rung
// index within its industry in era order — so the config (whose ladder is ×1.5) is re-sloped to ×f for
// this run only, without a --write. Industries carrying an output_override (power) or follows_be:false
// are left alone, exactly like build_era_ladder.mjs treats them.
const OUT_SLOPE = +(process.env.ERA_OUT_SLOPE || 1.5);
if (OUT_SLOPE !== 1.5) {
  for (const i of S.IND) {
    if (i.follows_be === false) continue;
    const ts = [...i.tiers].sort((a, b) => (a.era ?? 0) - (b.era ?? 0));
    if (ts.some(t => t.output_override != null)) continue;
    ts.forEach((t, k) => { t.output_qty = Math.round(t.output_qty * Math.pow(OUT_SLOPE / 1.5, k) * 10) / 10; });
  }
}
// ⚠⚠ THE GENERATED ARTIFACTS FOLLOW MOD_CONFIG TOO. era_prices.json and era_presets.json are derived
// from whichever config is being solved, so a redirected run that wrote them to the canonical names left
// the repo describing a ladder its own config did not have — and ui/presets.js is built from
// era_presets.json, so the next build shipped a balance sheet whose scenarios referenced buildings the
// sheet did not contain. Same defect as era_solver writing its recipes to the canonical config.
// MOD_CONFIG=config/mod_config.era6.json  ->  config/era_prices.era6.json / era_presets.era6.json
const ARTIFACT_SUFFIX = (() => {
  const b = (process.env.MOD_CONFIG || '').split(/[\\/]/).pop() || '';
  const m = b.match(/^mod_config\.(.+)\.json$/);
  return m ? '.' + m[1] : '';
})();
const artifact = base => join(REPO, 'config', base + ARTIFACT_SUFFIX + '.json');
const FIT = JSON.parse(readFileSync(artifact('era_prices'), 'utf8'));

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
// ⭐ ERA_ARMY_FP (default ON; =0 reverts) — see setArmy: battalions and the army-goods prices are
// solved to their joint fixed point instead of the one-tick-behind cobweb. ARMY_FP_LAST is the warm
// start + skip cache (per era; the cheap current-price sizing agreeing with the incumbent within 3%
// means the fixed point already holds and the aggregates call is skipped).
const ARMY_FP = process.env.ERA_ARMY_FP !== '0';
const ARMY_FP_LAST = { era: -1, groups: null };
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
// ⭐⭐ THE WEDGE IS NOW MEASURED, PER PROFESSION (§10.45, 2026-08-09 — `ERA_PROF_WEDGE=0` reverts to the
// flat 1836 vector). Multipliers on PROF_RATIO_1836 per era, fitted from the saves_debut archive: nine
// melted saves of ONE vanilla USA campaign at decade intervals 1846-1920 plus the committed 1836
// professions config, each profession's workforce ÷ the productive workforce (everything outside these
// eight, minus peasants/slaves/soldiers — the same denominator PROF_RATIO_1836 used). The SHAPE is the
// USA's; the 1836 LEVEL stays the committed eight-market median, so the calibrated anchor is untouched
// and only the trajectory is new. Scenario eras read the nearest decades (era 2 = mean of 1866/1876,
// era 3 = 1896/1906); era 0 is a backcast and era 5 an extrapolation (the campaign ends 1921), both
// judgment calls stated per line. The raw series lives in §10.45.
// What the data says, in one line each: clerks and shopkeepers DOUBLE (the white-collar ramp is real);
// aristocrats rise to an 1866 peak then fall to 0.59× by 1920 (the land economy's decline, with the
// early rise a real feature of the data); capitalists ×2.5; bureaucrats HALVE (vanilla's own path — the
// game under-builds government late, and the model mirrors the game it mods); clergymen rise then ebb;
// academics boom mid-century (vanilla's university surge — volatile but real) and thin out after.
const PROF_MULT_BY_ERA = {
  clerks:      [0.70, 1.00, 1.55, 1.78, 2.13, 2.70],
  bureaucrats: [1.20, 1.00, 1.05, 0.78, 0.53, 0.45],
  clergymen:   [1.00, 1.00, 1.51, 1.49, 1.16, 1.00],
  shopkeepers: [0.70, 1.00, 1.47, 1.90, 2.13, 2.50],
  aristocrats: [1.10, 1.00, 1.39, 1.08, 0.59, 0.35],
  capitalists: [0.30, 1.00, 1.61, 2.47, 2.46, 2.80],
  officers:    [1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  academics:   [0.70, 1.00, 8.40, 4.00, 2.13, 1.80],
};
const PROF_WEDGE = process.env.ERA_PROF_WEDGE !== '0';
let PROF_RATIO = { ...PROF_RATIO_1836 };
const setProfRatio = eIx => {
  const f = Math.pow(PROF_RAMP, eIx / 4);
  PROF_RATIO = Object.fromEntries(Object.entries(PROF_RATIO_1836).map(([k, v]) =>
    [k, v * f * (PROF_WEDGE && PROF_MULT_BY_ERA[k] ? PROF_MULT_BY_ERA[k][eIx] : 1)]));
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
const SUBSISTENCE_MIX_SETS = {
  world: {
    building_subsistence_rice_farm: 0.597, building_subsistence_farm: 0.374,
    building_subsistence_pasture: 0.025, building_subsistence_orchard: 0.002,
    building_subsistence_fishing_village: 0.002,
  },
  // ⚗ ERA_SUBS_MIX=temperate — the scenario is ONE US-like country, and 60% rice-paddy subsistence is the
  // world's mix (Asia dominates the level count), not a temperate country's. Judgement shares, stated as
  // such: overwhelmingly grain farming, some pasture, a little orchard and fishing, no rice.
  temperate: {
    building_subsistence_farm: 0.85, building_subsistence_pasture: 0.10,
    building_subsistence_orchard: 0.03, building_subsistence_fishing_village: 0.02,
  },
};
// ⭐ RICE IS BANNED FROM THE SOLVER (user, 2026-08-09; ERA_ALLOW_RICE=1 restores it). The scenario is one
// US-like temperate country, and the world-1836 subsistence mix made it 60% rice paddies — whose
// workforce-scaled output flooded the rice market and bankrupted every commercial rice farm in every era.
// The solver therefore places NO rice producer of either kind; the mix renormalises over the rest. The UI
// is untouched — a human can still build rice farms and read the arithmetic; this binds the solver only.
const SUBSISTENCE_MIX = (() => {
  const src = SUBSISTENCE_MIX_SETS[process.env.ERA_SUBS_MIX || 'world'] || SUBSISTENCE_MIX_SETS.world;
  if (process.env.ERA_ALLOW_RICE === '1') return src;
  const out = { ...src }; delete out.building_subsistence_rice_farm;
  const s = Object.values(out).reduce((a, b) => a + b, 0);
  for (const k in out) out[k] = out[k] / s;
  return out;
})();
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
// Per-era construction share (default ON; ERA_CONSTR_RAMP=0 restores the flat 15%): an 1780s economy does
// not spend a 1920s share of GDP on building. Direction is historical — real capital formation's GDP share
// roughly doubled-to-tripled between the 1830s and the 1900s–20s — and the level stays deliberately above
// both vanilla (BEL 8.8% … FRA 20.1% at 1901) and reality (~3–10%), because raising the demand for capital
// is the mod's point. Still a stated premise, never a margin lever.
const CONSTR_BY_ERA = process.env.ERA_CONSTR_RAMP !== '0' ? [0.08, 0.10, 0.12, 0.15, 0.17, 0.18] : null;
const constrShareOf = eIx => (CONSTR_BY_ERA ? CONSTR_BY_ERA[eIx] : CONSTRUCTION_GDP_SHARE);
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
// ⭐ ERA_PROFIT_BAND (default ON — §10.49, user-ruled 2026-08-10 "ship this"; =0 restores the +5%
// target regime) — PROFIT TARGETS BECOME A BAND.
// The dominant tier's recipe is no longer solved to an exact margin (+5%): it is left alone while its
// total-profit margin sits inside [ERA_BAND_LO, ERA_BAND_HI] (default [+5%, +100%], profit ÷
// (inputs+wages) — the codebase's one margin basis), and solved to the nearest edge only when outside.
// "Not allowing noticeable negatives" stays with the loss-shrink and the illogicality floor (both
// unchanged); "penalising over-the-board positives after late-stage settling" is the free-entry tuner,
// whose absolute cap becomes the band's TOP under this knob (a margin is only "over the board" when it
// leaves the band). Industry handicaps (shipyards −30pp, ERA_RAIL_PENALTY) shift the whole band, same
// as they shifted the targets. ⚠ Expect a structural consequence, not a tweak: recipes freed from the
// +5% pin settle much LEANER (the canonical start is the 4:1-cap recipe and a lean recipe inside the
// band is never enriched), so input demand across the chain falls — measure, don't assume.
const PROFIT_BAND_ON = process.env.ERA_PROFIT_BAND !== '0';
const BAND_LO = +(process.env.ERA_BAND_LO || 0.05);
// 0.5 by measurement (§10.49.3): at 1.0 a debut recipe's cost is revenue/2, so a stale rung only dies
// when its price HALVES in two eras — no plausible ladder decays that fast, and the stale family
// exploded. 0.5 keeps observed margins in 5–50%, inside the ruled "reasonable 5–100%".
const BAND_HI = +(process.env.ERA_BAND_HI || 0.50);
const PROFIT_CAP = +(process.env.ERA_PROFIT_CAP_PCT || (PROFIT_BAND_ON ? BAND_HI : 0.25));
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
// 6000 since the outer iteration: with coarse stepping the loop self-terminates well under this, and a
// net that binds ships un-shrunk losses silently (§10.38.2's lesson, which the outer loop re-taught).
const SHRINK_STEPS = +(process.env.ERA_SHRINK_STEPS || 6000);
// ⭐ ERA_GROW (default 2 = STRICT — §10.49, user-ruled 2026-08-10 "ship this"; =0 disables, =1 is the
// measured-harmful plain variant kept for A/B) — THE INCREASE MECHANISM, the
// reduction's mirror (user design): alternating with the loss-shrink's cuts, the TOP-PROFIT building is
// grown, shifting the workforce toward the highest-margin use. To qualify it must be BOTH the top of all
// ELIGIBLE producers (eligible = not at a scale cap — agriculture/extraction carry the SCALE_LIMITs,
// manufacturing carries none — and not fixed/dropped/protected/already-cut-this-loop) AND at least
// ERA_GROW_MARGIN (20pp) above the CAPITAL-WEIGHTED average margin of every profitable producer
// (weights = each building's cost base, inputs+wages at market prices — profit% is a return on that
// base, so the average is the economy's return on working capital). Step: +10% of levels at ≥10 levels,
// else +1. Guards, same precedence as everywhere: a step that grows the ceiling breach set is undone and
// the building blocked; a step that deepens a macro reasonability gap likewise; a step that does not
// move the margin with the output not at the ceiling unwinds the whole run for that building (§10.21's
// futility doctrine). Shipyard margins enter handicap-adjusted (−30pp deducted from par), so their
// artifact losses neither qualify them nor drag the average.
// ERA_GROW=2 is the STRICT variant: a growth step may not deepen even a VERIFY-ONLY macro gap — the
// extraction cap above all, which is structurally breached (V3 books value at the pithead, §10.47.2),
// so under strict reading the mechanism cannot pour further workforce into the artifact's direction.
// Measured because the smoke run showed plain ERA_GROW=1 growing era-5 sulfur +266 / iron +255: free
// entry chasing a margin the model itself calls a price-vector distortion.
const GROW_MODE = process.env.ERA_GROW ?? '2';
const GROW_STRICT = GROW_MODE === '2';
const GROW_ON = GROW_MODE === '1' || GROW_STRICT;
const GROW_MARGIN = +(process.env.ERA_GROW_MARGIN || 0.20);
// May the reduction cut URBAN CENTRES as well as our tiers? See the F13 block in `addSupport` for why
// their entitlement is a ceiling rather than a count. `ERA_URBAN_SHRINK=0` restores the old behaviour.
const URBAN_SHRINK = process.env.ERA_URBAN_SHRINK !== '0';

// ═══ THE RULED SET (user, 2026-08-09) — measured in the 122-run campaign, then shipped as DEFAULTS. ═══
// Every default here carries a revert knob so any single decision can be re-measured; the knob is the
// A/B instrument, the default is the decision.
//
//   ERA_OUTER (default 3)      — outer passes over the whole ERA SEQUENCE. A tier's recipe is solved once,
//        in the era where it is dominant, so a single pass chooses era N's counts against PROVISIONAL
//        recipes for the era-(N+1) rung standing in its scenario — the sequential inconsistency (§10.41.3).
//        Passes 2+ re-run every era against the previous pass's final recipe book; the metrics plateau by
//        pass 3 (measured: further passes wander inside a ±40k band, smaller than run-to-run noise).
//        ERA_OUTER=1 restores the old single-pass solve.
//   ERA_SHRINK_COARSE (default ON) — §10.38.4's coarse-to-fine reduction step: ~5% of levels while worse
//        than −10%, one level near the boundary. Under ERA_OUTER the one-level-at-a-time reduction cannot
//        finish era 5 inside any reasonable step budget (pass 2 wanted >2000 steps), so coarse stepping is
//        what keeps the safety net a safety net. =0 reverts.
//   ERA_STALE_W (default 0.25) — placement weight of a rung that is ALREADY STALE when placed (era 5 and
//        past a plateau's end, where the partner slot slides onto a dying rung). The user's directive:
//        era-minus-one industries must not be systemically prevalent. =1 reverts.
//   ERA_LEAD_W (default 1)     — the leading rung keeps EQUAL weight by design ruling: the scenario is not
//        "day 1 after the unlock", so the newest technology may hold real capacity. Kept as a knob only.
//   ERA_DATE_GATE (default ON — §10.44, user-ruled 2026-08-09) — a tier is placeable iff its
//        `tech_year` (stamped by build_era_ladder from the spec's dated notes: the year the slot's
//        technology was first commercially deployable) is <= the SCENARIO YEAR. This replaces the
//        leading-rung era arithmetic, which put ~50-58% of tier-output value on NEXT-ERA technology in
//        every middle scenario (the census that killed it: level-parity leading rungs — tooling 105/105,
//        steel 48/47 at 1900 — each carrying MORE than half the industry's output on a ×1.5 recipe).
//        "Leading" stops being a category; what stands in 1900 is what existed by 1900. Era labels keep
//        classifying rungs (a present tier with era > scenario era still reports as the lead rung and
//        aims at TG.current). =0 reverts to the era ceiling + debut guard below.
//   ERA_DEBUT_GUARD (LEGACY — only read when ERA_DATE_GATE=0) — the leading rung may EXTEND a ladder but
//        never START one. Under the date gate both its job and its exemption list are done properly by
//        the dates themselves: railway (1825), steam shipyards (1843), the engine trade (1820) and power
//        (1900, embedded in urban centres before that) all resolve without hand-waving.
//        ERA_DEBUT_EXEMPT (default railway,shipyard_steam,motor,power) spares industries on the legacy
//        path only. =0 reverts the guard there.
//   ERA_RAW_SHRINK (default ON) — §10.18 sheds LEVELS (25% at a time, floor 1, then the type) instead of
//        dropping a whole TYPE outright. The type-drop, applied to one shared price, removed wheat, maize
//        and rye one after another and left millet as the only — protected, loss-making — grain source.
//        Implies ERA_RAW_RECHECK (the unified post-solve enforcement pass). =0 reverts both.
//   ERA_URBAN_FLOOR (default 0 = no special case) — urban centres are cut at any loss, the same rule as
//        manufacturing. The floor (−0.10) was a workaround for the unconditional cut breaking 1870/1900
//        under the OLD single-pass solve; under the ruled set the outer loop + unified enforcement absorb
//        that mechanism and the three variants (floor −0.10 / floor 0 / never cut) are statistically
//        indistinguishable (58–69 faults, 155–242k losses, all inside the jitter spread) — so the special
//        case is removed per the user's "why only urban centres" objection. The knob remains the A/B.
//   ERA_CONSTR_RAMP (default ON) — construction share of GDP per era [8,10,12,15,17,18]% instead of flat
//        15%. Historically capital formation's GDP share roughly doubled-to-tripled from the 1830s to the
//        1900s–20s; the ramp keeps the mod's deliberately-above-reality level while restoring the trend.
//        =0 reverts to the flat 15%.
//   ERA_ALLOW_RICE=1           — restore rice production. By design ruling the solver mandates ZERO rice
//        levels (no rice farms, no subsistence rice paddies; the subsistence mix renormalises over the
//        rest): a US-like country is not a paddy economy, and paddy output was flooding the rice market
//        and bankrupting every commercial rice farm. The UI is untouched — this binds the SOLVER only.
//   ERA_RAW_PRICE_BAND (default 30) — raw goods get a ±band (pp of base) around 100 in the COUNT
//        controller instead of the tight 8pp deadband: inside it the controller leaves them alone, so raw
//        prices float with scarcity instead of being steered back to base. Replaces the rejected
//        "raw price drift" idea — prices may rise emergently, nothing prescribes a path. =0 reverts.
//   ERA_SHRINK_STALE_FIRST (default ON) — the loss-making reduction cuts STALE rungs (older than the
//        scenario era) before era-exact ones: obsolete capacity must be the first victim of the process
//        (user directive). Only when no stale loser above one level remains may an era-exact loser be cut.
//        =0 reverts to pure worst-first.
//   ERA_POLISH (default ON)    — final-pass integer polish: greedy ±1 level moves on our tiers, judged on
//        the global objective (illogicality excluding excused, then losses, then net), each trial re-priced
//        and reverted unless it strictly helps and breaches nothing. This attacks the ±1-level jaggedness
//        at its source. ERA_POLISH=0 reverts; ERA_POLISH_TRIALS caps work (default 200/era).
//   ERA_WAGE_RAMP (default 1 = off) — extra wage growth ×f^era on top of the SoL-driven base. PENDING a
//        design ruling: it is the strongest stale-rung killer measured (+2.1M net at zero fault cost) but
//        interacts with raw-sector solvency; measured with the price band replacing the rejected drift.
//   ERA_PRUNE (default steel@0,glass@0 — RULED) — industries not placed at named eras. The 1780 prune,
//        refined by the buyer test: only goods with NO buyer of any kind at that era qualify.
//        ERA_PRUNE= (empty) reverts to no pruning.
//   ERA_SUBS_MIX=temperate     — optional hand-authored temperate subsistence mix; with rice banned the
//        default world mix renormalises to ~93% grain farms anyway, so this is now nearly equivalent.
//   ⭐⭐ THE CONSTRAINT-SET REGIME — SHIPPED AS DEFAULTS BY RULING (user, 2026-08-10 "ship this, this
//   is an obvious improvement"; measured §10.49, formerly the "ABC2h" arm):
//   ERA_PROFIT_BAND (default ON; =0 restores the +5% target regime) — profit TARGETS are a BAND
//        [ERA_BAND_LO, ERA_BAND_HI] (default +5%…+50% total profit): the dominant recipe moves only
//        when its margin leaves the band, and the free-entry cap is the band top. Header at PROFIT_CAP.
//   ERA_PRICE_AVG (default ON; =0 disables) — the MANDATED PRICE DECLINE: weighted-average
//        manufactured prices track an era ladder (raw-fed 120…72, mfg-fed 130…50 across eras 1–5,
//        ±10pp), an integral class offset on the count controller's targets. Header at PRICE_AVG_ON.
//   ERA_GROW (default 2 = STRICT; =0 disables, =1 the measured-harmful plain form) — the INCREASE
//        MECHANISM, the reduction's mirror: alternating with loss-shrink cuts, the top-profit
//        eligible producer ≥20pp above the capital-weighted average margin is grown (+10% of levels
//        at ≥10, else +1), under the ceiling/macro/futility guards; strict may not deepen even
//        verify-only macro gaps. Header at GROW_ON.
//   ERA_PM_LIFT (default 0.25; =0 disables) — pins and settled selections yield to DOMINANCE: a
//        method beaten by >25pp at current prices re-opens the choice (shipped with the ruling; the
//        era-0 textile −40%-vs-+159% pin is the case it exists for). Header at PM_LIFT.
//   ERA_RECIPE_MONO (default strong; weak | 0 revert — §10.50, 2026-08-10) — THE RECIPE RATCHET: a
//        later tier's base recipe may not be less input-efficient (O:I value at base prices) than
//        the tier below it. Strong = every adjacent pair; weak = identical one-good-in/one-good-out
//        pairs only. Hard cap on recipe richness, mirror of the 4:1 lean floor. Header above
//        solveInputsAt.
//   ERA_MACRO (default usa — §10.47, user-ruled 2026-08-09) — the MACROSCENARIO reasonability layer
//        (tools/era_macro.mjs): per-era bounds on profession shares (verified), industry-category GDP
//        shares and per-industry GDP shares (both enforced through counts, gross product = value
//        added), 1780 exempt. The governance layer the rice ban and the US population premise already
//        belonged to, made explicit. ERA_MACRO=0 disables; ERA_MACRO_STEPS caps the enforcement's
//        count moves per era (default 400).
const OUTER = Math.max(1, Math.round(+(process.env.ERA_OUTER || 3)));
const LEAD_W = +(process.env.ERA_LEAD_W || 1);
const STALE_W = +(process.env.ERA_STALE_W || 0.25);
const DATE_GATE = process.env.ERA_DATE_GATE !== '0';
const DEBUT_GUARD = process.env.ERA_DEBUT_GUARD !== '0';
const DEBUT_EXEMPT = new Set((process.env.ERA_DEBUT_EXEMPT != null ? process.env.ERA_DEBUT_EXEMPT
  : 'railway,shipyard_steam,motor,power').split(',').filter(Boolean));
const WAGE_RAMP = +(process.env.ERA_WAGE_RAMP || 1);
const RAW_SHRINK = process.env.ERA_RAW_SHRINK !== '0';
const RAW_RECHECK = RAW_SHRINK || process.env.ERA_RAW_RECHECK === '1';
// Default: the RULED 1780 prune (user, 2026-08-09) — steel and glass are the two goods with no buyer of
// any kind at 1780 (steel's first consumer is era-2 machinery; glass has only a pop need that SoL-7 pops
// fund with nothing), so their industries are not placed there. Paper, arms and artillery STAY: the
// university buys paper in every era (pm_scholastic_education, 5/level), the army buys small arms and
// artillery (pruning them pinned orphaned demand at 175 — the ceiling tripwire caught it).
// ERA_PRUNE= (empty) reverts to no pruning; any other spec replaces the list.
const PRUNE = (() => { const m = {};
  const spec = process.env.ERA_PRUNE != null ? process.env.ERA_PRUNE : 'steel@0,glass@0';
  for (const kv of spec.split(',').filter(Boolean)) {
    const [id, e] = kv.split('@'); (m[id] = m[id] || new Set()).add(+e); } return m; })();
const SHRINK_COARSE = process.env.ERA_SHRINK_COARSE !== '0';
const URBAN_FLOOR = +(process.env.ERA_URBAN_FLOOR || 0);
const ALLOW_RICE = process.env.ERA_ALLOW_RICE === '1';
const RAW_PRICE_BAND = +(process.env.ERA_RAW_PRICE_BAND != null ? process.env.ERA_RAW_PRICE_BAND : 30);
const SHRINK_STALE_FIRST = process.env.ERA_SHRINK_STALE_FIRST !== '0';
const POLISH = process.env.ERA_POLISH !== '0';
const POLISH_TRIALS = +(process.env.ERA_POLISH_TRIALS || 200);

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
// the rice ban's commercial half — see SUBSISTENCE_MIX above for the rule and the ruling
if (process.env.ERA_ALLOW_RICE !== '1') EXCLUDE_REF.add('building_rice_farm');
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
// ⚠ THE DYE PIN IS GONE (user, 2026-08-09 — "10 dye plantations with barely any profit makes no
// sense"). It was a self-declared placeholder from before the count controller, the raw band and the
// level-shedding existed; those now size dye plantations like any plantation, and the pin had become
// the same class of defect as the art academy's FIXED_COUNTS (§10.40): a hand constant the machinery
// could never correct. The mechanism stays (a future hand-set producer would go here), empty.
const FIXED_REF_COUNT = {};
// ⚠ TRADE SUPPLY IS AN EXPLICIT LIST, NOT A CONDITION — learned the expensive way. The first version
// imported ANY non-ladder good with building demand and zero building supply, and that DISARMED the
// "kept at a loss — the market's only source" ceiling guard: dropping the last iron mine no longer
// breached the ceiling (imports flooded in at 100), so the drop machinery cascaded and the solve shipped
// 1900 with its ENTIRE 25,520-unit iron supply imported, rubber 16,572 and even the army's tanks bought
// abroad. The ruling was for goods whose production is a structural WALL (hardwood: the ungated
// wood→hardwood conversion can never pay while wood floats in-band under hardwood's price cap) — not for
// goods whose producers were transiently absent mid-solve. Walls are design findings; name them here.
const TRADE_SUPPLY_GOODS = new Set(['hardwood']);
// Goods the CURRENT era actually imports. Module-level so the per-era report can print it; cleared at
// each era's build.
const tradeSupplied = new Set();
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
// ⭐ ERA_RECIPE_MONO (default 'strong'; 'weak' | '0'/'off' revert — 2026-08-10, user hypotheses,
// strong measured decisively better: shipped-state census 31/78 violated → 3 rounding hairliners,
// ill-excl 64 → 54 with the INVERTED family collapsing 21 → 6, net and macro both improved) — THE
// RECIPE RATCHET: a later tier's BASE-PM recipe may not be less input-efficient than the tier below it.
// The complaint that motivated it: e0 tooling made 20 tools from 14.3 wood while e1 needed 77.3 wood
// for 30 tools — at base prices a ratio of 2.80 collapsing to 0.78. Nothing bounded recipe richness
// from above (the 4:1 cap bounds only leanness), so a tier solved at high realised prices could go
// arbitrarily gluttonous: 31 of 78 adjacent pairs violated this in the first shipped §10.49 book.
// ⚠ THE DEFECT IS THE REGRESSION, NOT THE LEVEL (user, 2026-08-10 — §10.50.1): a sub-1 ratio at base
// prices is NOT itself forbidden — a recipe may destroy value at base prices so long as plausible
// price scenarios carry it (fertilizer runs 0.98 for three eras, electrics debuts at 0.75, both
// viable at their realised prices). There is deliberately NO absolute floor here; a chain whose
// first tier sits below 1 may legally stay below 1. What is forbidden is only technology running
// BACKWARDS — a later tier worse than the one below it.
//   weak   — applies only where the pair is one-good-in, one-good-out with IDENTICAL goods (the
//            physical reading: later out/in may not fall; prices cancel, so the value form below is
//            exactly the physical form there).
//   strong — applies to every adjacent pair of the industry (base recipes, VALUE ratio at base
//            prices, output_qty·P / Σ inputs·P): later ≥ earlier.
// "≥", not ">": two consecutive tiers both pinned at the 4:1 cap tie at ratio 4 exactly, so strict
// improvement is infeasible at the cap. Secondary PMs are deliberately unrestricted (user spec).
// The cap is HARD and the profit band is soft, same precedence as the 4:1 ceiling: a tier the ratchet
// stops from richening floats above the band top and free entry corrects it through counts. Feasible
// by construction: ratio_prev ≤ 4 (its own 4:1 cap) ⇒ IbaseMax ≥ Obase/4 = the lean floor.
const RECIPE_MONO = (() => {
  const v = process.env.ERA_RECIPE_MONO ?? 'strong';
  if (v === '' || v === '0' || v === 'off') return '';
  if (v !== 'weak' && v !== 'strong') throw new Error(`ERA_RECIPE_MONO=${v} — use strong | weak | 0`);
  return v;
})();
const monoCapped = new Set();   // tiers whose recipe the ratchet clamped (reported)
function monoCapInfo(ind, t) {
  if (!RECIPE_MONO) return null;
  const prev = (ind.tiers || [])
    .filter(x => x !== t && (x.era ?? 0) < (t.era ?? 0)
      && Object.keys(x.inputs || {}).some(g => x.inputs[g] > 0))
    .sort((a, b) => (b.era ?? 0) - (a.era ?? 0))[0];
  if (!prev) return null;
  if (RECIPE_MONO === 'weak') {
    const pk = Object.keys(prev.inputs).filter(g => prev.inputs[g] > 0);
    const tk = Object.keys(t.inputs || {}).filter(g => t.inputs[g] > 0);
    if (pk.length !== 1 || tk.length !== 1 || pk[0] !== tk[0]
        || E.tierOut(ind, prev) !== E.tierOut(ind, t)) return null;
  }
  let Iprev = 0; for (const g in prev.inputs) Iprev += prev.inputs[g] * (S.PRICES[g] || 0);
  const Oprev = prev.output_qty * (S.PRICES[E.tierOut(ind, prev)] || 0);
  const Obase = t.output_qty * (S.PRICES[E.tierOut(ind, t)] || 0);
  if (!(Iprev > 0) || !(Oprev > 0) || !(Obase > 0)) return null;
  return { IbaseMax: Obase * Iprev / Oprev, prevEra: prev.era };
}
function monoViolated(ind, t) {
  const m = monoCapInfo(ind, t); if (!m) return false;
  let Ibase = 0; for (const g in t.inputs) Ibase += t.inputs[g] * (S.PRICES[g] || 0);
  return Ibase > m.IbaseMax * 1.005;   // 0.5% grace for the 0.1-unit rounding
}
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
  // the RECIPE RATCHET (ERA_RECIPE_MONO): richness is capped so the tier is never less
  // input-efficient at base prices than the tier below it; the lean floor below still wins ties
  const mono = monoCapInfo(ind, t);
  if (mono) {
    const Xmono = mono.IbaseMax / unitBase;
    if (X > Xmono) { X = Xmono; monoCapped.add(t.key); } else monoCapped.delete(t.key);
  }
  // ⭐⭐ THE SOLVENCY BOUND — TARGET BE ≤ 175 (§10.63, user-ruled 2026-08-17) — the ABSOLUTE cap the
  // ladder never had. Every other bound here is RELATIVE: Xmin to this tier's own output, Xmono to the
  // tier BELOW. A ladder's bottom rung has no tier below it, so before this it was bounded on one side
  // only (leanness) and could be solved arbitrarily gluttonous. That is how `building_port` reached 15.2
  // clippers for 9 merchant marine — a break-even at 270% of base against an engine that stops at 175%,
  // i.e. insolvent at every price the game can produce (FINDINGS F67, landmine L18).
  //
  // THE RULE: a tier's full, wage-inclusive break-even — the OUTPUT price, as a % of base, at which the
  // base PM covers its input goods plus wages WITH INPUTS AT BASE — may not exceed the engine's own
  // +75% band edge:
  //     target_be = Ibase / ((1 − wp) · Obase) · 100  ≤  175      ⟺  Ibase ≤ 1.75 · (1 − wp) · Obase
  // so at the default wp = 0.25 the recipe may cost at most 1.3125 × its own output value, i.e. O:I ≥ 0.762.
  //
  // ⚠⚠ THIS IS THE STRICTER OF THE TWO LINES CONSIDERED, AND IT IS THE RULED ONE (2026-08-17, second
  // ruling). The first ruling allowed BOTH prices to move to their favourable edges (output ×1.75 AND
  // inputs ×0.25), which is `target_be ≤ 400` and caught 0 of 105 tiers — measured before it shipped.
  // Holding inputs at BASE is what makes the bound bite: it catches port 270, railway 217, synthetics 208.
  // It is still NOT "may not destroy value at base prices" (that would be ≤ 100 and is rejected): a tier
  // may legitimately be insolvent at base prices and be carried by a higher output price. §10.50.1 stands,
  // sub-1 O:I stays legal, and the §10.50 RECIPE RATCHET is untouched and orthogonal — that one is
  // relative (a tier against the one below), this one absolute (a tier against the engine).
  // ⚠ SHIPYARDS ARE NOT EXEMPT (user, same ruling). They cost nothing today — all seven tiers already sit
  // at ≤128 — but the carve-out is gone, so a future re-solve cannot hide behind it.
  // ⚠ It can never fight the lean floor: Xmin sits at Ibase = Obase/ioCap (≤ 0.25·Obase) and this cap at
  // Ibase = 1.3125·Obase, a factor of five apart — so the Xmin clamp below still has the last word.
  const wpS = t.wage_pct != null ? +t.wage_pct : DEFAULT_WAGE_PCT;
  const IbaseMaxSolv = ERA_SOLVENCY ? (MAX_TARGET_BE / 100) * (1 - wpS) * Obase : Infinity;
  const Xsolv = IbaseMaxSolv / unitBase;
  if (X > Xsolv) { X = Xsolv; solvCapped.add(t.key); } else solvCapped.delete(t.key);
  if (X < Xmin) { X = Xmin; capped.add(t.key); } else capped.delete(t.key);
  const applyInputs = round => {
    for (const g of Object.keys(t.inputs)) {
      t.inputs[g] = Math.max(minMainInput(ind, g), round(t._ratio[g] * X * 10) / 10);
    }
    let I = 0; for (const g in t.inputs) I += t.inputs[g] * (S.PRICES[g] || 0);
    return I;
  };
  let IbaseFinal = applyInputs(Math.round);
  // ⚠⚠ ROUNDING MUST FALL ON THE SAFE SIDE OF A HARD BOUND. Inputs are quantised to 0.1, so `Math.round`
  // can push a tier the clamp placed exactly ON the cap just over it — a grid artifact, not a balance
  // fact. It bites hardest on the GRADED PORT tiers (§10.60.2), whose goods are divided by 10, so one
  // grid step is 13% of a port level's entire output value. MEASURED: the first run of this bound put the
  // port at 1.0 clippers (£60) against a £59.06 cap — over by £0.94, exactly one step. So when the
  // solvency cap binds, re-round DOWN. Leaner than required is safe; over a hard bound is not.
  if (IbaseFinal > IbaseMaxSolv * (1 + 1e-9)) IbaseFinal = applyInputs(Math.floor);
  // ⚠⚠ ONLY NOW is a breach real, and it can only come from `minMainInput` — that floor is applied PER
  // GOOD and AFTER the clamp, so a tier whose secondary PMs carry large reductions can be pushed back
  // over the line by a DIFFERENT hard invariant (the negative-goods floor, which can never yield: a
  // building's total input for a good going negative is not a balance question). Two hard rules in
  // genuine conflict must FAIL LOUDLY rather than have one silently pick the winner.
  if (IbaseFinal > IbaseMaxSolv * (1 + 1e-9)) {
    solvBreach.set(t.key, {
      industry: ind.id, era: t.era, Obase, Ibase: IbaseFinal, wp: wpS,
      needBe: Math.round(IbaseFinal / ((1 - wpS) * Obase) * 100),
    });
  } else solvBreach.delete(t.key);
  return true;
}
// The engine's own upper band edge (vic3 `price = base × [1 + 0.75·clamp(...)]` ⇒ 25–175% of base).
// ⚠ THE THRESHOLD IS A GAME CONSTANT AND IS NOT TUNABLE. "No reachable output price saves this building"
// is a fact about the engine, not a balance preference, so there is deliberately no ERA_MAX_BE=200.
const MAX_TARGET_BE = 175;
const DEFAULT_WAGE_PCT = 0.25;
// ⭐ ERA_SOLVENCY (default ON, `=0` disables) — A MEASUREMENT SWITCH, NOT A SETTING, and the distinction
// is the whole point: the THRESHOLD above is fixed, but whether the bound is ENFORCED can be turned off
// so the rule's cost is measurable. Same shape as ERA_RECIPE_MONO=0 and ERA_PROFIT_BAND=0, and it exists
// for the same reason: this repo judges a design change on a measured A/B, and without an off-switch
// there is no baseline to measure against — the cap lives in the CODE, not the config, so two solves of
// two different configs both apply it and come back byte-identical (observed 2026-08-17, which is how
// this knob came to be written an hour after the comment claiming it was unnecessary).
// ⚠ Never ship with it off; it is for re-measurement only, like ERA_RAIL_PENALTY.
const ERA_SOLVENCY = process.env.ERA_SOLVENCY !== '0';
const solvCapped = new Set();          // tiers whose richness the solvency bound is actively holding back
const solvBreach = new Map();          // tiers that violate it ANYWAY, via the negative-goods floor
// ⭐ "fail solving" (user, 2026-08-17): the solve must not WRITE a config it knows is unsolvable. Called
// immediately before every config write, so a breach stops the pipeline instead of shipping quietly.
function assertSolvency(where = 'solve') {
  if (!solvBreach.size) return;
  const lines = [...solvBreach.entries()].map(([k, b]) =>
    `  ${k} (${b.industry}, e${b.era}): break-even at ${b.needBe}% of base, cap is ${MAX_TARGET_BE}% `
    + `(out £${b.Obase.toFixed(0)}, in £${b.Ibase.toFixed(0)}, wage_pct ${b.wp}).`);
  throw new Error(
    `SOLVENCY BOUND VIOLATED by ${solvBreach.size} tier(s) at ${where} — §10.63 / landmine L18.\n`
    + lines.join('\n')
    + `\nThese recipes cannot break even at ANY price the engine can produce, so the solve refuses to write`
    + ` them. Each was clamped, re-rounded DOWN, and STILL over — which leaves only minMainInput (the`
    + ` negative-goods floor, applied per good after the clamp) as the cause, i.e. two hard invariants in`
    + ` genuine conflict. Widen the tier's output or reduce the secondary reduction that sets its floor.`
    + ` Do NOT relax the bound.`);
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
// ⚗ ERA_RAW_DRIFT=f — raw goods' target price drifts ×f per era instead of staying flat at 100. The flat
// path plus any wage growth is incoherent: a mine's costs rise every era while the count controller pushes
// its price back to 100, so a strong wage ramp bankrupts the whole raw sector (measured: ERA_WAGE_RAMP=1.1
// alone puts £1.9M/wk of era-5 losses on raw producers). Real resource prices rise with labour costs.
const RAW_DRIFT = +(process.env.ERA_RAW_DRIFT || 1);
// ⭐ ERA_PRICE_AVG (default ON — §10.49, user-ruled 2026-08-10 "ship this"; =0 disables) — THE
// MANDATED PRICE DECLINE, as
// an AGGREGATE constraint (user design): the WEIGHTED AVERAGE realised price of manufactured goods must
// track an era-indexed ladder, within ±ERA_PRICE_AVG_TOL (10pp). Two classes, split by what a tier EATS
// (the sector report's own rule): tiers fed on raw inputs decline gently, tiers fed on MANUFACTURED
// inputs decline harder — a deep chain compounds its inputs' productivity gains, so its prices fall
// fastest. Any single good may sit off the ladder; only the average is constrained.
// Enforcement: an INTEGRAL OFFSET per class on the per-good price-path targets (the count controller's
// one lever), adapted only while the average is outside tolerance, clamped ±[−70,+40]. The per-good
// age-decay path keeps setting the WITHIN-class shape (new goods dear, old goods cheap); the offset
// re-anchors the class. Weights are base-price output value (count × qty × base price) — realised-price
// weights would make the average self-referential. Exemptions: era 0 (tiny floored markets — §10.29's
// trap: the controller cannot raise a price whose one-level supply already floods the market), plateau
// goods PAST their ladder's end (their price holding up the permanent tier IS the design — they stay in
// the average, so the movable goods must carry their share of the decline: Baumol, again), and
// trade-supplied goods (pinned at 100 by construction).
// Ladder defaults are grounded in the SHIPPED state (measured 2026-08-10: raw-fed 103/103/94/90/81,
// mfg-fed 125/106/102/92/82 across eras 1–5) — early rungs bind softly, late rungs demand the decline
// the zombie stale tail (−10..+5% margins, eras 4–5) currently never receives.
const PRICE_AVG_ON = process.env.ERA_PRICE_AVG !== '0';
const AVG_TOL = +(process.env.ERA_PRICE_AVG_TOL || 10);
const AVG_GAIN = +(process.env.ERA_PRICE_AVG_GAIN || 0.25);
const AVG_LADDER = (() => {
  const parse = (env, dflt) => {
    if (!process.env[env]) return dflt;
    const xs = process.env[env].split(',').map(s => (s === 'null' || s === '' ? null : +s));
    if (xs.length !== 6 || xs.some(x => x !== null && !(x > 0))) throw new Error(`${env} must be 6 comma-separated values (null allowed)`);
    return xs;
  };
  return {
    raw: parse('ERA_PRICE_AVG_RAW', [null, 120, 108, 96, 84, 72]),
    mfg: parse('ERA_PRICE_AVG_MFG', [null, 130, 108, 88, 68, 50]),
  };
})();

const TG = FIT.targets;
const SHIP_INDUSTRIES = new Set(['shipyard', 'shipyard_steam']);
// ⚗ ERA_RAIL_PENALTY (measurement knob, default 0 — MEASURED AND REJECTED, §10.47.1): a shipyard-style
// profitability handicap for RAILWAY applied to targets AND recipes. It made railway value-poorer at
// every era (a softer RECIPE target buys ~10% of revenue more inputs per level), faults and losses up.
// Kept at 0 strictly for re-measurement; the shipped subsidy stance is SUBSIDY_TOL below, which is the
// same softness applied to SCORING ONLY.
const RAIL_PENALTY = +(process.env.ERA_RAIL_PENALTY || 0);
const indPenalty = ind => (SHIP_INDUSTRIES.has(ind.id) ? TG.shipyard_penalty : 0)
                        + (ind.id === 'railway' ? RAIL_PENALTY : 0);
// ⭐ THE SUBSIDY TOLERANCE (user-ruled direction, 2026-08-09 — §10.47.4; ERA_SUBSIDY_TOL=0 reverts).
// Vanilla's default AI strategy subsidises the infrastructure trio at `must_have`
// (00_default_strategy.txt: building_power_plant / building_railway / building_port), so in the game
// we mod these industries run state-backed and a book loss does not kill them. The scenarios model
// that stance as a LOSS TOLERANCE, never as income and never as a recipe change:
//   * the ladder criterion's loss floor drops by the tolerance (an infra industry at −10%..0 is
//     subsidised operation, not a fault),
//   * the loss-shrink treats it like the shipyard handicap (cut only below −tol),
//   * the RECIPE targets are untouched — the measured ERA_RAIL_PENALTY failure is exactly what
//     happens when the softness reaches solveInputsAt (richer recipes, value-poorer sector),
//   * the implied SUBSIDY BILL (the trio's aggregate book losses) is printed per era in the final
//     profit pass. It is structurally bounded — bill ≤ tol × the sector's cost base — which is what
//     lets the stance exist without modelling a state budget.
// ⚠ Keep this consistent with ui/econ.js's LADDER_LOSS_FLOOR (the UI's copy of the same floors) —
// the criterion has ONE implementation and the floor values must not fork.
const SUBSIDY_TOL = +(process.env.ERA_SUBSIDY_TOL != null ? process.env.ERA_SUBSIDY_TOL : 0.10);
const SUBSIDIZED = new Set(['railway', 'port', 'power']);   // = vanilla's must_have trio (and MACRO_INFRA)
const subsidyTol = ind => (SUBSIDIZED.has(ind.id) ? SUBSIDY_TOL : 0);
// GOLD IS MONEY, NOT A GOOD. No pop need lists it and no building consumes it, so its order book is
// one-sided by construction: all sell, no buy, price pinned to the 25% floor, and its mines read −68%
// no matter how few of them there are. Excluding it is not a fudge — a target that cannot be moved by
// the only lever we have is not a target. Its mines stay in the scenario (they employ people and the
// game does pay for gold), they are just not steered or scored.
const SKIP_GOODS = new Set(['gold']);
const SKIP_TARGET_BLD = new Set(['building_gold_mine', 'building_gold_field']);
// profit target for the ERA-CURRENT tier of an industry (the one whose margin the price has to deliver)
function currentTargetFor(ind) { return TG.current + indPenalty(ind); }
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
function dominantTargetFor(ind) { return TG.minus1 + indPenalty(ind); }
// ⚗ ERA_PROFIT_BAND — the ONE recipe-solve entry point for the dominant tier. Under the band, the recipe
// is left alone while the margin sits inside [lo,hi]+penalty and solved to the NEAREST EDGE when outside
// (solving to lo LEANS the recipe toward the 4:1 cap — `capped` then reports it, exactly as under a
// target it cannot reach). A 2pp hysteresis stops the edge-solve churning against price drift.
function solveDomRecipe(ind, t) {
  // ⭐ per-tier `solve_profit` (user-ruled 2026-08-16 — §10.59): a POINT target that replaces both the
  // band edge and the industry handicap for THIS tier's recipe. The ruled use: shipyard_steam e1 at
  // +0.05 — the −30pp shipyard stance made its recipe a −25% loss-maker at scenario prices, and in the
  // game (where the handicap's unmodelled naval income did not materialise) it struggled even at a
  // +75% output price, so nobody built steamer supply while port_steam bought phantom steamers at the
  // ceiling for decades. Scoring keeps the industry handicap — only the SOLVE is overridden.
  if (t.solve_profit != null) {
    const tgt = +t.solve_profit;
    if (RECIPE_MONO && monoViolated(ind, t)) return solveInputsAt(ind, t, tgt);
    const m = E.TPthr(ind, t) / 100;
    if (!isFinite(m) || Math.abs(m - tgt) > 0.02) return solveInputsAt(ind, t, tgt);
    capped.delete(t.key);
    return true;
  }
  if (!PROFIT_BAND_ON) return solveInputsAt(ind, t, dominantTargetFor(ind));
  const pen = indPenalty(ind);
  // the ratchet outranks the in-band rest: a recipe that violates it (the tier below moved under an
  // outer pass, or the state predates the knob) is re-solved, and solveInputsAt clamps it legal
  if (RECIPE_MONO && monoViolated(ind, t)) return solveInputsAt(ind, t, BAND_HI + pen);
  const m = E.TPthr(ind, t) / 100;
  if (!isFinite(m) || m > BAND_HI + pen + 0.02) return solveInputsAt(ind, t, BAND_HI + pen);
  if (m < BAND_LO + pen - 0.02) return solveInputsAt(ind, t, BAND_LO + pen);
  capped.delete(t.key);
  return true;
}
// How far a margin sits from what the solve AIMED at — a point target normally, the band's nearest edge
// under ERA_PROFIT_BAND (inside the band `off` is 0: the report must grade what the solve aimed for).
function gradeOff(p, tgt, pen) {
  if (!PROFIT_BAND_ON) return p - (tgt + pen);
  return p < BAND_LO + pen ? p - (BAND_LO + pen) : p > BAND_HI + pen ? p - (BAND_HI + pen) : 0;
}
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

// ═══ THE MACROSCENARIO — reasonability bounds (tools/era_macro.mjs, §10.47; ERA_MACRO=0 reverts). ═══
// Bounds on gross product (VALUE ADDED) shares per industry and per group, and on profession shares of
// population — the explicit form of "this is a large autarkic US-like economy", the same governance
// layer the rice ban and the population premise already belong to. 1780 is exempt.
// ⭐ SINCE §10.47.2 THE YARDSTICK IS THE MAPPED COMMODITY ECONOMY, NOT RAW MODEL GDP (user-ruled
// derivation): the real-US side is import-adjusted, mapped-or-dropped and renormalized in
// era_macro.mjs, and the MODEL side must be measured on the symmetric denominator — every tier
// industry + the raw reference producers + subsistence, EXCLUDING urban centres (the model's
// unmappable-services counterpart) and the construction/army sinks. Shares here can no longer be read
// against the report's GDP line; the report labels them "of the mapped commodity economy".
const MACRO = activeMacro();
const MACRO_STEPS = +(process.env.ERA_MACRO_STEPS || 400);
if (MACRO) validateMacro(MACRO, {
  industryIds: new Set(S.IND.map(i => i.id)),
  professionIds: new Set([...STRATUM.lower, ...STRATUM.middle, ...STRATUM.upper, 'peasants', 'slaves']),
  categoryIds: new Set(['manufacturing', 'extraction', 'agriculture']),
});
// Group membership under the mapping (§10.47.2): manufacturing = every tier industry EXCEPT the three
// infrastructure chains (railway/port/power map to real rail / water transport / utilities and carry
// their own industry gates); agriculture = farm/plantation/ranch/fishing references PLUS SUBSISTENCE
// (real farm-output series count home-consumed production); extraction = mining/logging/oil/rubber.
// Fishing/whaling files under agriculture (the UI taxonomy), not under the raw-band's extraction set.
const MACRO_EXTRACT_CATS = new Set(['mining', 'logging', 'oil', 'rubber']);
const MACRO_AGRI_CATS = new Set(['farms', 'plantations', 'ranching', 'fishing_whaling']);
const MACRO_INFRA = new Set(['railway', 'port', 'power']);

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

// ⚗ ERA_PM_SEED=prod (2026-08-10, default '' = off, no-op) — START the PM hill-climb from the era-legal
// candidate with the highest OUTPUT-PER-WORKER at BASE prices, instead of from Phase A's incumbents.
// The optimiser is a hill-climb over a discrete landscape, so where it starts decides which local
// optimum it can reach; seeding at the most productive method biases the start toward the modern,
// capital-shaped selections (user hypothesis 2026-08-10: better local equilibria than primitive-first).
// BASE prices deliberately — the scenario's realised prices do not exist at seed time, and a seed must
// be a function of the design alone, not of whatever the previous era left in the state.
// Mirrors optimisePMs' structures exactly: same candidate rule (mandates collapse to one, the era gate,
// law stance, forbidden PMs), same legality test (the negative-goods invariant), incumbent kept on ties.
// Non-selling buildings score 0 for every candidate, so they keep their incumbent here and
// advanceNonMarketPMs() (inside settle) remains their owner.
const PM_SEED = process.env.ERA_PM_SEED || '';
function seedProductivePMs(era) {
  if (PM_SEED !== 'prod') return;
  const seed = (sel, pmgs, present, score) => {
    for (const pmg of (pmgs || [])) {
      const cand = rules.candidates(pmg, era, present);
      if (!cand.length) continue;
      if (!cand.includes(sel[pmg])) sel[pmg] = cand[0];
      if (cand.length < 2) continue;
      const cur = sel[pmg];
      let best = cur, bestP = score();
      for (const pm of cand) {
        if (pm === cur) continue;
        sel[pmg] = pm;
        const p = score();
        if (p > bestP + 1e-9) { bestP = p; best = pm; }
      }
      sel[pmg] = best;
    }
  };
  const perWorker = (out, emp) => out / Math.max(1, emp);
  for (const i of S.IND) for (const t of i.tiers) {
    if (!t._sec) continue;                                   // FIT never chose for it ⇒ never present
    seed(t._sec, i.secondary_pmgs, new Set([t.pm_key, ...Object.values(t._sec)]),
      () => tierLegal(E, i, t) ? perWorker(E.outputValue(i, t, false), E.empTotal(E.tierEmp(t))) : -Infinity);
  }
  for (const b of E.refBuildings()) {
    const sel = E.refSel(b), info = S.VAN.buildings[b] || {};
    seed(sel, info.pmgs, new Set(Object.values(sel)),
      () => refLegal(E, b) ? perWorker(E.goodsVal(E.selGoods(sel).out, false), E.empTotal(E.selEmp(sel))) : -Infinity);
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
// ⚗ ERA_PRICE_AVG — the class-weighted price averages off the CURRENT state (whatever S.BLDNUM and
// S.thresholds hold when called): per present tier, its output good's realised price weighted by
// count × qty × BASE price; class = does this tier's recipe eat a tiered good (the sector report's own
// mfg_high/mfg_low rule, per TIER — a good made by both classes is averaged into both, and its OFFSET
// class is its weight-majority one). Module-level because the final profit pass replays shipped presets
// and must measure them with the identical rule.
function classInfo() {
  const acc = { raw: { w: 0, pw: 0 }, mfg: { w: 0, pw: 0 } };
  const goodW = {};
  for (const i of S.IND) {
    if (i.follows_be === false) continue;
    for (const t of i.tiers) {
      const n = S.BLDNUM[t.key] || 0; if (!(n > 0)) continue;
      const g = E.tierOut(i, t);
      const w = n * t.output_qty * (S.PRICES[g] || 0);
      if (!(w > 0)) continue;
      const c = Object.keys(t.inputs || {}).some(x => t.inputs[x] > 0 && GOOD_FIRST_ERA[x] != null) ? 'mfg' : 'raw';
      acc[c].w += w; acc[c].pw += w * (S.thresholds[g] ?? 100);
      (goodW[g] = goodW[g] || { raw: 0, mfg: 0 })[c] += w;
    }
  }
  const cls = {};
  for (const g in goodW) cls[g] = goodW[g].mfg >= goodW[g].raw ? 'mfg' : 'raw';
  return { avg: { raw: acc.raw.w > 0 ? acc.raw.pw / acc.raw.w : null,
                  mfg: acc.mfg.w > 0 ? acc.mfg.pw / acc.mfg.w : null },
           w: { raw: acc.raw.w, mfg: acc.mfg.w }, cls };
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
// in any of our industry buildings — main recipes and every secondary PMG, across every era — OR if any
// combat unit's upkeep consumes it (user ruling 2026-08-12; the addition is made further down, where
// UNIT_GOODS is built). "Consumable by industry or by the army", not "consumed right now": a good that
// some era's method could buy is treated as restricted in all of them, because the alternative is a set
// that changes underfoot as the PM optimiser moves.
// ⇒ The ONLY good that may pass +75% is one nothing but civilian pops consume.
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
// ⭐⭐ MILITARY CONSUMPTION IS RESTRICTED TOO (user ruling 2026-08-12). The ceiling exists because a good
// pinned at the band edge can no longer signal scarcity, so everything downstream is priced against a
// wall — and that argument does not care whether the buyer is a factory or a battalion. **The only good
// allowed past +75% is one that is PURELY CIVILIAN-CONSUMED.** Radios are the named case: pops buy them,
// which made them look like a consumer good, but a battalion's upkeep buys them too, so they are in.
// ⚠ This set is computed above for the no-buyer test and was simply never consulted by the ceiling; the
// two rules ask opposite questions about the same fact ("does anything buy this?" / "does anything that
// is not a pop buy this?") and now share one source for it.
for (const g of UNIT_GOODS) RESTRICTED.add(g);

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
  if (f == null) return PRICE_RAW * Math.pow(RAW_DRIFT, era);   // raw / secondary: no ladder to drive (⚗ ERA_RAW_DRIFT)
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

function buildScenario(eIx, finalPass) {
  const era = FIT.eras[eIx].era;
  // The newest TIER this scenario may contain — LEGACY path only (ERA_DATE_GATE=0). Falls back to `era`
  // so a stale era_prices.json (written before the six-scenario ladder) still runs with the old
  // one-tier-per-era behaviour rather than silently placing nothing.
  const LEAD_TIER = FIT.eras[eIx].lead != null ? FIT.eras[eIx].lead : era;
  // The scenario YEAR — what the date gate places against (§10.44).
  const SCEN_YEAR = FIT.eras[eIx].year;
  if (DATE_GATE && SCEN_YEAR == null) throw new Error(`era_prices.json carries no year for era ${era} — re-run era_solver.mjs`);
  WORK_RATIO = WORK_RATIO_BY_ERA[eIx];
  setProfRatio(eIx);                         // the non-productive wedge, ramped per era (ERA_PROF_RAMP)
  S.POPM.working_adult_ratio = WORK_RATIO;   // keep ui/econ.js's pop maths on the same number
  // ---- prices, wage, SoL --------------------------------------------------------------------------
  for (const g in S.PRICES) S.thresholds[g] = FIT.prices[eIx][g] != null ? FIT.prices[eIx][g] : 100;
  S.BASE_WAGE = FIT.eras[eIx].base_wage * Math.pow(WAGE_RAMP, eIx);   // ⚗ ERA_WAGE_RAMP, default 1 = FIT's wage
  const sol = FIT.eras[eIx].sol;
  S.SOL = { lower: sol, middle: Math.round(sol * 1.5), upper: Math.round(sol * 3), peasants: sol, slaves: 8 };
  // ---- production methods, exactly as Phase A chose them for this era -----------------------------
  for (const i of S.IND) for (const t of i.tiers) if (FIT.pms[eIx].tiers[t.key]) t._sec = { ...FIT.pms[eIx].tiers[t.key] };
  for (const b in FIT.pms[eIx].refs) S.REFSEL[b] = { ...FIT.pms[eIx].refs[b] };
  seedProductivePMs(era);   // ⚗ ERA_PM_SEED=prod — productivity-first start for the PM hill-climb (no-op by default)

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
  const debutHeld = [];   // industries withheld by the debut guard (would debut as the leading rung)
  const prunedHeld = [];  // industries withheld by ERA_PRUNE
  const chainHeld = [];   // tiers dropped because an input's producer cannot exist yet (mirror of GONE)
  const GONE = goneGoods(era);      // goods whose every producer is extinct by now
  // PASS 1 — which industries exist this era, and which the debut guard withholds. Must complete before
  // any tier is chain-checked, because "can this input be produced at all" depends on who is withheld.
  const plan = [];
  for (const i of S.IND) {
    if (extinctBy(i.id, era)) continue;                  // declared extinct and two eras past its end
    const sorted = [...i.tiers].sort((a, b) => a.era - b.era);
    // ⚠ THE CEILING IS THE SCENARIO'S LEADING TIER, NOT ITS OWN INDEX. A scenario's dominant tier lags its
    // leading tier by one (see ERAS in era_solver.mjs), so scenario 1 (1836) may hold up to tier 2 while
    // tier 1 remains the bulk. Reading `t.era <= era` here is what made the 1836 scenario a pure tier-1
    // economy — a 1750 market wearing an 1836 label — against a vanilla 1836 start that is 45% tier 2.
    // THE DATE GATE (§10.44): what a scenario may contain is what EXISTED by its calendar year — a tier
    // whose technology was first deployable in 1901 does not stand in 1900, however good its margin.
    // Under the legacy path the ceiling is the leading TIER (era arithmetic; see the ⚠ below).
    if (DATE_GATE) for (const t of sorted) {
      if (t.tech_year == null) throw new Error(`${t.key} has no tech_year — re-run build_era_ladder.mjs --write`);
    }
    // ⭐⭐ THE GATE APPLIES TO LATER-ERA RUNGS ONLY (user ruling 2026-08-12). A scenario at era N must
    // contain every industry's era-N rung — CLAUDE.md's anchor principle says so explicitly, and gives
    // the reason: a scenario is not one country but an AMALGAMATION of several technology leaders, each
    // ahead in a different subfield, with NO international trade, so it must hold every chain to be
    // solvable at all. The date gate was reading `tech_year <= SCEN_YEAR` for EVERY rung, which withheld
    // an industry's own era-appropriate tier whenever its date fell after the scenario year — tooling's
    // high-speed-steel shop missed the 1900 scenario by ONE year and its carbide shop missed 1920 by
    // seven. Census: 30 of 106 era-appropriate rungs were absent from their own era's scenario.
    // ⚠ THIS DOES NOT UNDO §10.44. What the date gate was introduced to stop is NEXT-era technology
    // flooding a scenario — the measured fault was ~50-58% of tier-output value sitting on the era above.
    // That is exactly the case `t.era > era` still covers; only the industry's own era and below are
    // exempted, and those cannot be anachronistic in the sense the census measured.
    const avail0 = sorted.filter(t => (DATE_GATE ? (t.era <= era || t.tech_year <= SCEN_YEAR) : t.era <= LEAD_TIER)
      && !Object.keys(t.inputs || {}).some(g => GONE.has(g)));   // its input has no supplier left
    if (!avail0.length) continue;
    // ⚠ WITHHELD IS NOT THE SAME AS ABSENT. An industry nothing buys from is pinned to ZERO levels rather
    // than dropped from `placement`, because the placement list is also what drives `solveInputsAt`: drop
    // it and the tier's recipe is never solved at all, so the era in which it DOES have a market inherits
    // whatever the canonical start left behind. Measured — dropping it outright cost era 2 three points
    // and blew the continuous residual from 12pp to 34pp. At zero levels §10.17 already excludes it from
    // the criterion, which is the whole effect wanted.
    let withheld = NO_BUYER && hasNoBuyer(E.tierOut(i, avail0[avail0.length - 1]), era);
    if (withheld) noBuyer.push(i.id);
    // THE DEBUT GUARD — LEGACY path only: under the date gate an industry whose technology has not
    // arrived has an empty avail0 and is simply absent, which is the guard's job done properly (and
    // without the exemption list: railway 1825, steam shipyards 1843, engines 1820, power 1900 all
    // predate or meet their scenarios on their own dates).
    if (!DATE_GATE && DEBUT_GUARD && !DEBUT_EXEMPT.has(i.id) && avail0[0].era > era) { withheld = true; debutHeld.push(i.id); }
    if (PRUNE[i.id] && PRUNE[i.id].has(era)) { withheld = true; prunedHeld.push(i.id); }
    plan.push({ i, sorted, avail0, withheld });
  }
  // THE FORWARD-CHAIN RULE — the debut guard's mirror of "the chain has to be finished" (extinct rule).
  // A tiered good is unproducible this era when every tiered industry making it is withheld or absent AND
  // no reachable reference building could make it under any of its methods. A tier eating an unproducible
  // good is not placed: a buyer whose supplier cannot exist is not a thin market, it is a wall.
  // Measured case (2026-08-09): the engine industry's era-3 rung (electric machining) stood in 1870 as the
  // leading rung demanding 97 electricity while `power` — the good's only producer, also era 3 — was
  // debut-withheld; electricity sat at the +75% ceiling with sell = 0 in every combination carrying the
  // guard. Pop demand cannot save such a good: pops allocate by supply share, and its supply is zero.
  const refProducible = new Set();
  for (const b of E.refBuildings()) {
    if (EXCLUDE_REF.has(b)) continue;
    const bt = (S.VAN.buildings[b] || {}).tech;
    if (!techAllowed(bt, era)) continue;
    for (const pmg of ((S.VAN.buildings[b] || {}).pmgs || [])) {
      const grp = S.VAN.pmgs[pmg]; if (!(grp && grp.pms)) continue;
      // ⚠ THE METHOD ITSELF MUST BE REACHABLE THIS ERA, not only the building. The urban centre is an
      // era-0 building whose lighting PMG lists `pm_electric_streetlights` — an era-3 method that (since
      // the electricity pass, §10.43) PRODUCES electricity. Without the per-PM gate this walk would call
      // electricity "producible" at 1780 and un-withhold every electricity-eating rung three eras early.
      // Principle-gated and law-illegal methods are excluded the same way the optimiser excludes them.
      for (const pm of grp.pms) {
        if (E.pmGated(pm) || !rules.pmAvailable(pm) || rules.pmEra(pm) > era) continue;
        const o = E.pmRec(pm).out || {}; for (const g in o) if (o[g] > 0) refProducible.add(g);
      }
    }
  }
  // ⚠ THE WALL PROPAGATES — the chain filter iterates to a FIXED POINT. One pass checked every tier
  // against a producer list built BEFORE any drop, so a chain of length two slipped through: at 1836
  // (date-gated) the explosives factory is dropped because its fertilizer input debuts in 1842 — but the
  // munition plant had already passed its explosives check against the pre-drop list, and shipped with
  // buy 49 / sell 0 explosives pinned at the ceiling. Drop, rebuild the producible set, re-check, until
  // nothing moves; the loop is bounded by the tier count.
  const chainDropped = new Set();      // tier keys chain-dropped so far
  for (let guard = 0; guard < 200; guard++) {
    const tierProducible = new Set();
    for (const { i, avail0, withheld } of plan) {
      if (withheld) continue;
      for (const t of avail0) if (!chainDropped.has(t.key)) tierProducible.add(E.tierOut(i, t));
    }
    const unproducible = g => GOOD_FIRST_ERA[g] != null && !tierProducible.has(g) && !refProducible.has(g);
    let moved = false;
    for (const { i, avail0, withheld } of plan) {
      if (withheld) continue;
      for (const t of avail0) {
        if (chainDropped.has(t.key)) continue;
        const bad = Object.keys(t.inputs || {}).filter(unproducible);
        if (bad.length) { chainDropped.add(t.key); chainHeld.push(`${t.key.replace(/^building_/, '')} (needs ${bad.join(',')})`); moved = true; }
      }
    }
    if (!moved) break;
  }
  // PASS 2 — build the rows from the chain-filtered tier lists.
  for (const { i, sorted, avail0, withheld } of plan) {
    const avail = avail0.filter(t => !chainDropped.has(t.key));
    if (!avail.length) continue;
    const cur = avail[avail.length - 1], m1 = avail[avail.length - 2], m2 = avail[avail.length - 3];
    const fx = FIXED_COUNTS[i.id];
    // Placement weights: the leading rung keeps EQUAL weight (design ruling — the scenario is not "day 1
    // after the unlock"); a rung already STALE when placed (era 5 / plateau overhang) is a remnant at 0.25.
    const wCur = cur.era > era ? LEAD_W : 1;
    const wM1 = (m1 && m1.era < era) ? STALE_W : 1;
    const rows = [{ t: cur, weight: (fx || withheld) ? 0 : wCur, fixed: withheld ? 0 : (fx ? fx.cur : undefined) }];
    if (m1) rows.push({ t: m1, weight: (fx || withheld) ? 0 : wM1, fixed: withheld ? 0 : (fx ? fx.m1 : undefined) });
    if (m2) rows.push({ t: m2, weight: 0, fixed: withheld ? 0 : (fx ? fx.m2 : 1) });
    if (PROBE) { const p1 = sorted.find(t => t.era > era); if (p1) rows.push({ t: p1, weight: 0, fixed: 1 }); }
    // `withheld` rides along for the macroscenario layer: a deliberately-withheld industry is ABSENT,
    // not dead, so its gross-product floor is waived (era_macro.mjs's "a floor applies only where the
    // industry can exist").
    placement.push({ ind: i, rows, withheld });
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
  const rawCap = {};    // ⚗ ERA_RAW_SHRINK: per-building level cap imposed by §10.18's level-shedding mode
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
      // ⚠⚠ `minCount` MUST BE HONOURED HERE TOO (BUGS_AND_FIXES 2026-08-09). The §10.22 tuner grows an
      // over-band raw producer by raising minCount — and this branch ignored it, so every raw growth
      // step was a silent no-op: the margin never moved, the futility guard read that as "pinned at the
      // floor" and permanently blocked the producer after one wasted step. The whole upper half of the
      // raw band was unenforceable for as long as the fix was missing. Caps still outrank the floor,
      // same as the tier branch above.
      S.BLDNUM[b] = Math.min(Math.max(lvl(scaleOf['R:' + b]), minCount[b] || 0), scaleCapOf(b),
                             rawCap[b] != null ? rawCap[b] : Infinity);   // ⚗ ERA_RAW_SHRINK's cap
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
    // ⭐ SHIPYARDS ARE OUT OF THE HEADLINE TOTALS (user, 2026-08-09). Their −30pp handicap exists because
    // none of their naval-construction income is modelled, so their book losses are an artifact of the
    // model's blind spot, not of the economy — counting them in net/losses measures the blind spot, and
    // optimising the totals would optimise for it. Reported separately (shipNet/shipLoss), never folded in;
    // same treatment gold already gets, for the same reason.
    let net = 0, loss = 0, winners = 0, losers = 0, exNet = 0, exLoss = 0, auNet = 0, auLoss = 0,
        shipNet = 0, shipLoss = 0;
    const take = (p, excused, gold, ship) => {
      if (!isFinite(p)) return;
      if (gold) { auNet += p; if (p < 0) auLoss -= p; return; }
      if (ship) { shipNet += p; if (p < 0) shipLoss -= p; return; }
      net += p; if (p < 0) { loss -= p; losers++; } else winners++;
      if (excused) { exNet += p; if (p < 0) exLoss -= p; }
    };
    for (const i of S.IND) {
      const excused = PMECON.LADDER_EXCUSED.has(i.id);
      const ship = SHIP_INDUSTRIES.has(i.id);
      for (const t of i.tiers) {
        const n = S.BLDNUM[t.key] || 0; if (!(n > 0)) continue;
        const io = E.tierGoodsIO(i, t);
        if (!Object.keys(io.out || {}).length) continue;             // sells nothing -> no margin to report
        take(n * E.weeklyProfit(i, t), excused, false, ship);
      }
    }
    const seen = new Set(S.IND.flatMap(i => i.tiers.map(t => t.key)));
    for (const b in S.BLDNUM) {
      const n = S.BLDNUM[b] || 0; if (!(n > 0) || seen.has(b)) continue;
      const ec = E.refEcon(b); if (!ec || ec.p == null) continue;    // refEcon gives weekly £ at thresholds
      if (!Object.keys((ec.goods || {}).out || {}).length) continue;
      take(n * ec.p, false, SKIP_TARGET_BLD.has(b), false);
    }
    return { net, loss, winners, losers, exNet, exLoss, auNet, auLoss, shipNet, shipLoss };
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
    const cs = constrShareOf(eIx);
    const bill = cs * v0 / (1 + cs);
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
  // ⚗ ERA_PRICE_AVG — the class offsets (integral control on the aggregate) and the last measurement,
  // per era. Reset with the scenario; the report reads `classAvgLast` so it prints what the controller
  // actually steered by, not a recomputation from a later state.
  const classOff = { raw: 0, mfg: 0 };
  let classAvgLast = null;
  function stepCounts(gain, rescalePow) {
    const goodF = {};
    if (PRICE_AVG_ON && (AVG_LADDER.raw[eIx] != null || AVG_LADDER.mfg[eIx] != null)) {
      const ci = classInfo();
      classAvgLast = ci;
      for (const c of ['raw', 'mfg']) {
        const tgt = AVG_LADDER[c][eIx], avg = ci.avg[c];
        if (tgt == null || avg == null) continue;
        const err = avg - tgt;
        // adapt only OUTSIDE tolerance, toward its edge — inside, the aggregate is satisfied and the
        // per-good path is in charge. Clamped asymmetrically: −70 (the decline is the point) / +40.
        if (Math.abs(err) > AVG_TOL) classOff[c] = clamp(classOff[c] - AVG_GAIN * (err - Math.sign(err) * AVG_TOL), -70, 40);
      }
    }
    for (const g in S.PRICES) {
      if (SKIP_GOODS.has(g)) continue;
      let want = targetPrice(g, era);
      // the class offset re-anchors every movable good of the class; plateau goods FROM their ladder's
      // last era onward and trade-supplied goods are exempt (their prices are design statements, not
      // levers). ⚠ `>=`, not `>`: the plateau price must hold from the moment the ladder ends — the
      // first ABC2h run applied the offset during textile's own last era and pushed the whole industry
      // to NEGATIVE gross product (e4 textile −0.50% against a 1.93% macro floor), which is the Baumol
      // promise broken by the very constraint that was supposed to leave it alone.
      if (PRICE_AVG_ON && classAvgLast && classAvgLast.cls[g] && !tradeSupplied.has(g)
          && !(PLATEAU_LAST_ERA[g] != null && era >= PLATEAU_LAST_ERA[g])) {
        want = clamp(want + classOff[classAvgLast.cls[g]], 30, RESTRICTED.has(g) ? CEIL_TARGET : 170);
      }
      const got = S.thresholds[g];
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
      // ⭐ RAW GOODS GET A BAND, NOT A TARGET (user, 2026-08-09). The flat 100 with the tight 8pp deadband
      // was effectively steering every raw price back to base, fighting the scarcity signal the order book
      // was trying to send. Inside ±RAW_PRICE_BAND (default 30pp) the controller leaves a raw good alone
      // entirely — its price floats with scarcity — and only acts when it leaves the band (hysteresis at
      // ×1.2). Nothing prescribes a path; a raw price that drifts up under demand is the market speaking.
      const isRaw = GOOD_FIRST_ERA[g] == null;
      const bandIn = (isRaw && RAW_PRICE_BAND > 0) ? RAW_PRICE_BAND : COUNT_DEADBAND;
      const bandOut = (isRaw && RAW_PRICE_BAND > 0) ? RAW_PRICE_BAND * 1.2 : COUNT_DEADBAND_OUT;
      const err = Math.abs(got - want);
      if (bandIn > 0) {
        if (parked.has(g)) { if (err > bandOut) parked.delete(g); }
        else if (err <= bandIn) parked.add(g);
        if (parked.has(g)) { goodF[g] = 1; continue; }
      }
      goodF[g] = clamp(Math.pow(got / want, gain), 0.6, 1.7);
    }
    // The insolvency test still runs — it is what tells us an industry cannot reach its target at ANY
    // recipe, which is worth reporting even though counts no longer key off it.
    for (const p of placement) {
      const cur = p.rows[0].t;
      if (p.ind.follows_be === false) continue;
      // under the band, "insolvent" means the LEANEST recipe cannot even reach the band's floor
      const tgt = PROFIT_BAND_ON ? BAND_LO + indPenalty(p.ind) : currentTargetFor(p.ind);
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

  // ⭐ TRADE-SUPPLIED GOODS (user ruling, 2026-08-09 — the 1780 hardwood wall). A NON-LADDER good that
  // buildings demand but NO building supplies is imported: trade sell orders are set equal to the demand
  // EVERY iteration, so supply = demand and the price sits at exactly 100% of base however demand moves.
  // Scope, deliberately narrow: GOOD_FIRST_ERA[g] == null (a good our tier ladder makes must still obey
  // the chain rule — imports must not quietly disarm the "buyer whose supplier cannot exist" wall) and
  // building demand only (a pop-only good with no supply is a consumer-goods statement, and +75% is legal
  // there). The 1780 case: the shipyard eats hardwood, whose ungated wood→hardwood conversion can never
  // pay while wood floats in-band below hardwood's price cap — a wall no count can fix, so the market
  // imports. If a domestic producer appears in a later iteration, the import is withdrawn the same tick.
  // (`tradeSupplied` is module-level: the per-era report prints it, and the NEXT era's build clears it —
  // the solver never had trade orders before this rule, so nothing else resets S.ADDSELL between eras.)
  for (const g of tradeSupplied) delete S.ADDSELL[g];
  tradeSupplied.clear();
  const syncTradeSupply = agg => {
    for (const g of tradeSupplied) {
      if ((agg.outAgg[g] || 0) > 0 || !((agg.inAgg[g] || 0) > 0)) { delete S.ADDSELL[g]; tradeSupplied.delete(g); }
    }
    for (const g of TRADE_SUPPLY_GOODS) {
      if (GOOD_FIRST_ERA[g] != null) continue;       // a ladder good must never be importable
      const bBuy = agg.inAgg[g] || 0, bSell = agg.outAgg[g] || 0;
      if (bBuy > 0 && bSell === 0) {
        const { buy } = E.scenarioBuySell(agg, g);   // buy side never includes ADDSELL, no recursion
        S.ADDSELL[g] = buy; tradeSupplied.add(g);    // sell = the whole demand ⇒ price = 100% of base
      }
    }
  };
  for (let round = 0; round < 4; round++) {
  for (let iter = 0; iter < 220; iter++) {
    settle();
    // PRICES: whatever this scenario's own order book produces, by the game's formula. Never assigned.
    const agg = E.scenarioAggregates();
    syncTradeSupply(agg);
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
      solveDomRecipe(p.ind, dom);
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
    // trade-supplied goods track demand through EVERY re-price — the tuner and the enforcement passes
    // re-settle after the main loop, and an import frozen at the old demand would drift off 100%.
    syncTradeSupply(a);
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
  const ceilingBreachSet = () => {
    const a = E.scenarioAggregates();
    const s = new Set();
    for (const g of RESTRICTED) {
      const { buy, sell } = E.scenarioBuySell(a, g);
      if (buy > 0 && E.priceMultPct(buy, sell) >= CEILING) s.add(g);
    }
    return s;
  };
  const ceilingBreaches = () => ceilingBreachSet().size;
  // ⚠⚠ GUARDS COMPARE THE SET, NOT THE COUNT (2026-08-10). Every "undo if the step breached the ceiling"
  // guard used to compare breach COUNTS — and a count is blind the moment ANY breach already exists: a
  // step that breaches a NEW good while another good sits breached reads "1 → 1, fine", and a loop of
  // such steps walks a whole industry out one level at a time. Measured: with dye breached at era 2, the
  // raw reduction dropped EVERY iron mine — iron buy 1k / sell 0 at the 175 wall, "no producer at all" —
  // and every per-step check passed. A step is now undone when any good is breached that was not
  // breached before it; swapping one breach for another is also a regression and also rejected.
  const breachGrew = before => { for (const g of ceilingBreachSet()) if (!before.has(g)) return true; return false; };
  const breachCount = () => CEIL_PM ? ceilingBreaches() : 0;
  // Weight it far above any profit difference: this is a constraint, not a preference. Profit only ever
  // breaks ties between selections that breach the ceiling equally often.
  const CEIL_PENALTY = 100;
  let pmResult = { cycles: [], settled: true, passes: 0 };
  let pmSettled = false;
  // ⭐ ERA_PM_FREEZE (default ON — §10.48, shipped 2026-08-10; =0 reverts) — BEST-OF-CYCLE FREEZING, the
  // designed fix for "PM choice never settles". The cycle the report complained about mostly spans JOINT
  // ROUNDS, which optimisePMs
  // cannot see: it flips a method, contSettle re-prices, the flip back becomes attractive next round.
  // So the detection lives here: after every round the full selection state is snapshotted, and any
  // (building, PMG) that RETURNS to a method it held in an earlier round is oscillating — a monotone
  // march never revisits — and is pinned at the phase it just returned to. That phase won the score
  // comparison at the current (settled) prices, so it is the best-scoring phase the cycle has exhibited;
  // pinning it is "best-of-cycle", not "last-of-budget". The pin map is also handed to optimisePMs, which
  // enforces it, adds its own within-call cycles to it, and drops any pin whose method stops being legal.
  const PM_FREEZE = process.env.ERA_PM_FREEZE !== '0';
  const pmFrozen = new Map();                    // "building|pmg" -> pinned pm (per era; rebuilt each scenario)
  const pmRoundSeen = new Map();                 // "building|pmg" -> Set of pms held after earlier rounds
  const pmRoundLast = new Map();                 // "building|pmg" -> pm held after the previous round
  const snapSelections = () => {
    const m = new Map();
    for (const i of S.IND) for (const t of i.tiers) {
      if (t.era > era || !(S.BLDNUM[t.key] > 0) || !t._sec) continue;
      for (const pg in t._sec) m.set(t.key + '|' + pg, t._sec[pg]);
    }
    for (const b of E.refBuildings()) {
      if (!(S.BLDNUM[b] > 0)) continue;
      const sel = S.REFSEL[b] || {};
      for (const pg in sel) m.set(b + '|' + pg, sel[pg]);
    }
    return m;
  };
  const freezeReturners = () => {
    const now = snapSelections();
    for (const [k, cur] of now) {
      const last = pmRoundLast.get(k);
      if (last != null && cur !== last) {
        const hist = pmRoundSeen.get(k) || new Set();
        if (hist.has(cur) && !pmFrozen.has(k)) pmFrozen.set(k, cur);
        hist.add(last); pmRoundSeen.set(k, hist);
      }
      pmRoundLast.set(k, cur);
    }
  };
  // ⚠ A PIN IS NOT EXEMPT FROM THE CEILING. The optimiser's score carries CEIL_PENALTY, but a frozen PMG
  // is never re-scored — so a pinned phase that pins a consumable at +75% would hold the breach forever,
  // with the one lever that could clear it disabled (measured on the first freeze ensemble: a pinned
  // luxury phase held `silk buy 4 / sell 0` — an automatic 175 — through the whole joint loop). So after
  // every settle, any pin whose method TOUCHES a breached good is lifted and the choice re-opened; the
  // penalty then steers it off the breach exactly as it does for a free PMG. Returns how many were lifted.
  // ⭐ ERA_PM_LIFT (default 0.25; =0 disables — 2026-08-10, shipped with §10.49's ruling) — a selection
  // DOMINATED at current prices re-opens the method choice. §10.48's pins (and the pmDone latch below)
  // are re-validated against legality and the ceiling but never against PROFIT, so a phase pinned when
  // it won could ship long after prices had made it grossly wrong. Measured on the ABC2h state: era-0
  // textile pinned on craftsman's sewing at −40% with +159% one candidate away (luxury_clothes floored
  // at 25 — no SoL-7 pop buys luxury — while the foregone clothes trade at 161), and era-4's dye/sewing
  // mills stuck the OTHER way (+49pp/+40pp forgone by no_luxury_clothes). The scan mirrors the
  // optimiser's own scoring minus the ceiling penalty (dominance is a profit question; the re-choice
  // applies the penalty), and it only RE-OPENS: the pin is dropped and pmDone unlatched, then
  // optimisePMs decides under its own rules — a genuine cycle re-freezes at the better-of-cycle at
  // CURRENT prices, which is exactly the §10.48 contract kept honest.
  const PM_LIFT = +(process.env.ERA_PM_LIFT ?? 0.25);
  // ⚠ ONE APPEAL PER PIN, HEARD LATE — or the lift undoes §10.48. A genuinely bistable pair is
  // dominated from whichever side it currently holds, so an unconditional per-round lift re-opens it
  // forever (measured on the first shipped write: "PM settled 1/6" with the discrete state once again
  // decided by where the budget ran out). So the scan runs only in the LAST THREE joint rounds — the
  // appeal is judged at near-converged prices, which is the whole point — and a pin may be lifted
  // exactly once per era: if the re-opened choice re-freezes, the new pin STANDS (best-of-cycle at
  // late prices, the honest §10.48 contract).
  const pmLiftAppealed = new Set();
  const liftDominatedSelections = () => {
    if (!(PM_LIFT > 0)) return 0;
    let lifted = 0;
    const scan = (key, sel, pmgs, present, score, legal) => {
      for (const pmg of (pmgs || [])) {
        const fkey = key + '|' + pmg;
        if (pmFrozen.has(fkey) && pmLiftAppealed.has(fkey)) continue;   // the one appeal is spent
        const cand = rules.candidates(pmg, era, present);
        if (cand.length < 2 || !cand.includes(sel[pmg])) continue;
        const cur = sel[pmg];
        const curP = legal() ? score() : -Infinity;
        let bestGap = 0;
        for (const pm of cand) {
          if (pm === cur) continue;
          sel[pmg] = pm;
          const p = legal() ? score() : -Infinity;
          if (p - curP > bestGap) bestGap = p - curP;
        }
        sel[pmg] = cur;
        if (bestGap > PM_LIFT) {
          if (pmFrozen.has(fkey)) { pmFrozen.delete(fkey); pmLiftAppealed.add(fkey); }
          lifted++;
        }
      }
    };
    for (const i of S.IND) for (const t of i.tiers) {
      if (t.era > era || !(S.BLDNUM[t.key] > 0) || !t._sec) continue;
      scan(t.key, t._sec, i.secondary_pmgs, new Set([t.pm_key, ...Object.values(t._sec)]),
        () => E.TPthr(i, t) / 100, () => tierLegal(E, i, t));
    }
    for (const b of E.refBuildings()) {
      if (!(S.BLDNUM[b] > 0)) continue;
      const sel = E.refSel(b), info = S.VAN.buildings[b] || {};
      scan(b, sel, info.pmgs || [], new Set(Object.values(sel)),
        () => { const ec = E.refEcon(b); return (ec && ec.tp != null) ? ec.tp / 100 : -Infinity; },
        () => refLegal(E, b));
    }
    return lifted;
  };
  const liftBreachedPins = () => {
    if (!pmFrozen.size) return 0;
    const a = E.scenarioAggregates();
    const breached = [];
    for (const g of RESTRICTED) {
      const { buy, sell } = E.scenarioBuySell(a, g);
      if (buy > 0 && E.priceMultPct(buy, sell) >= CEILING) breached.push(g);
    }
    if (!breached.length) return 0;
    let lifted = 0;
    for (const [k, pm] of [...pmFrozen]) {
      const r = E.pmRec(pm);
      if (breached.some(g => (r.in && r.in[g]) || (r.out && r.out[g]))) { pmFrozen.delete(k); lifted++; }
    }
    return lifted;
  };
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
        if (dm && p.ind.follows_be !== false) solveDomRecipe(p.ind, dm);
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
  // ⚗ ERA_SETTLE_ITERS (default 40 = the shipped cutoff) — how long the continuous variables converge
  // between discrete re-choices in the joint loop. Exposed for the hysteresis experiment: a longer settle
  // shows the PM optimiser (and the cycle-freezer) prices closer to their fixed point, so the discrete
  // decision is made on better information at the cost of proportional runtime.
  const SETTLE_ITERS = +(process.env.ERA_SETTLE_ITERS || 40);
  // An early PM fixed point must not STARVE the continuous half: the pre-freeze loop spent every joint
  // round on contSettle (PM choice never settled), so breaking the whole loop at a round-k PM fixed point
  // would ship LESS converged prices than never settling at all (measured: freeze-alone with an early
  // break left era 1 at a 33pp residual where the full budget reaches 8pp). So the loop always runs its
  // whole budget; once the method choice is settled the optimiser is merely SKIPPED — unless a lifted
  // pin re-opened it — and the last act of every round stays continuous (§10.14.1's invariant).
  let pmDone = false;
  for (let k = 0; k < JOINT_PASSES; k++) {
    conv = contSettle(SETTLE_ITERS, 0.15);
    if (PM_FREEZE && liftBreachedPins() > 0) pmDone = false;   // a pinned phase breached the ceiling: re-open
    // the dominance appeal, LAST THREE ROUNDS ONLY (near-converged prices; see PM_LIFT's header)
    if (k >= JOINT_PASSES - 3 && liftDominatedSelections() > 0) pmDone = false;
    if (pmDone) continue;
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
      frozen: PM_FREEZE ? pmFrozen : null,
    });
    if (PM_FREEZE) freezeReturners();   // pin any (building, PMG) that returned to an earlier round's method
    const pmMoved = !(r.passes === 1 && r.settled);
    pmResult = { cycles: [...pmResult.cycles, ...r.cycles], settled: r.settled, passes: pmResult.passes + r.passes };
    pmSettled = !pmMoved;
    if (!pmMoved) pmDone = true;
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
  // ⚗ ERA_RAW_SHRINK — §10.18 by LEVEL-SHEDDING. The type-drop is all-or-nothing per building type, and a
  // shared price makes it destructive for a good with several producer types: grain's price under zero got
  // wheat, maize and rye DROPPED one after another, leaving millet as the only source — undroppable
  // (ceiling), so protected at −27% at full scale, the biggest single loss in the 1900 economy. Shedding
  // levels (25% at a time, floor 1, then the type) lets ALL grain farms retreat together until the shared
  // price recovers, which is what a market would actually do.
  for (let guard = 0; guard < (RAW_SHRINK ? 250 : 20); guard++) {
    conv = contSettle(RAW_SHRINK && guard ? 10 : 30, 0.15);
    let worst = null, worstP = 0;
    for (const b of refProducers) {
      if (!(S.BLDNUM[b] > 0) || dropped.has(b) || protectedRaw.has(b) || !isRawProducer(b)) continue;
      const ec = E.refEcon(b); if (!ec || ec.tp == null || !isFinite(ec.tp)) continue;
      if (ec.tp < 0 && ec.tp < worstP) { worst = b; worstP = ec.tp; }
    }
    if (!worst) break;
    const before = ceilingBreachSet();
    if (RAW_SHRINK && (S.BLDNUM[worst] || 0) > 1) {
      const n = S.BLDNUM[worst] || 0, prevCap = rawCap[worst];
      rawCap[worst] = n - Math.max(1, Math.floor(n * 0.25));
      conv = contSettle(10, 0.15);
      if (breachGrew(before)) {                // the shed broke the market — restore and protect
        rawCap[worst] = prevCap; protectedRaw.add(worst);
        conv = contSettle(10, 0.15);
      }
      continue;
    }
    dropped.add(worst);
    conv = contSettle(20, 0.15);
    if (breachGrew(before)) {                  // the drop broke the market — put it back and keep it
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
  // ═══ MACRO HELPERS — hoisted above the loss-shrink loop because ⚗ ERA_GROW's guard reads macroGap()
  // there; the ENFORCEMENT still runs in its place after RAW_RECHECK (ordering unchanged, §10.47).
  const macroM = { on: !!(MACRO && eIx >= MACRO.from_era), grown: {}, cut: {}, blocked: [], resid: [], profBad: [], negVA: [] };
  const vaPerLvl = (ind2, t2) => { const io = E.tierGoodsIO(ind2, t2);
    return E.thruMult(t2.key) * (E.goodsVal(io.out, true) - E.goodsVal(io.in, true)); };
  const refVaPerLvl = b => { const g = E.selGoods(E.refSel(b));
    return E.thruMult(b) * (E.goodsVal(g.out, true) - E.goodsVal(g.in, true)); };
  // Shares of the MAPPED COMMODITY ECONOMY (§10.47.2): tier industries + raw references + subsistence.
  // Urban centres are excluded (the model's unmappable-services counterpart, symmetric with dropping
  // real trade/finance/services), and the construction/army sinks never entered a VA sum anyway.
  const macroShares = () => {
    const ind = {}, cat = { manufacturing: 0, extraction: 0, agriculture: 0 };
    let total = 0;
    for (const p of placement) {
      let v = 0;
      for (const r of p.rows) {
        const n = S.BLDNUM[r.t.key] || 0; if (!(n > 0)) continue;
        v += n * vaPerLvl(p.ind, r.t);
      }
      ind[p.ind.id] = v;
      total += v;
      if (!MACRO_INFRA.has(p.ind.id)) cat.manufacturing += v;
    }
    for (const b of refProducers) {
      const n = S.BLDNUM[b] || 0; if (!(n > 0)) continue;
      const c = catOf(b);
      const key = MACRO_AGRI_CATS.has(c) ? 'agriculture' : MACRO_EXTRACT_CATS.has(c) ? 'extraction' : null;
      if (!key) continue;
      const va = n * refVaPerLvl(b);
      cat[key] += va; total += va;
    }
    // subsistence: in the denominator and in agriculture's numerator (real farm-output series count
    // home-consumed production) — but NEVER a lever: its size follows the peasants, not a bound
    for (const b in S.BLDNUM) {
      const n = S.BLDNUM[b] || 0;
      if (!(n > 0) || !E.isSubsistenceBuilding(b)) continue;
      const va = n * refVaPerLvl(b);
      cat.agriculture += va; total += va;
    }
    return { total: Math.max(1, total), ind, cat };
  };
  const macroViolations = st => {
    if (!macroM.on) return [];
    const v = [];
    for (const p of placement) {
      if (p.withheld || p.ind.follows_be === false) continue;
      const b = macroBounds(MACRO, 'industries', p.ind.id, eIx); if (!b) continue;
      const s = (st.ind[p.ind.id] || 0) / st.total;
      const verify = macroVerifyOnly(MACRO, 'industries', p.ind.id);
      // lo = 0 means NO floor (era_macro.mjs `nofloor`) — presence is not demanded and negative gross
      // product is tolerated there (it still lands on the NEGATIVE GROSS PRODUCT line, never silently)
      if (b[0] > 0 && s < b[0] - 1e-9) v.push({ kind: 'ind', key: p.ind.id, dir: 1, gap: b[0] - s, share: s, lo: b[0], hi: b[1], p, verify });
      else if (s > b[1] + 1e-9) v.push({ kind: 'ind', key: p.ind.id, dir: -1, gap: s - b[1], share: s, lo: b[0], hi: b[1], p, verify });
    }
    for (const c in MACRO.categories) {
      const b = macroBounds(MACRO, 'categories', c, eIx); if (!b) continue;
      const s = (st.cat[c] || 0) / st.total;
      const verify = macroVerifyOnly(MACRO, 'categories', c);
      if (b[0] > 0 && s < b[0] - 1e-9) v.push({ kind: 'cat', key: c, dir: 1, gap: b[0] - s, share: s, lo: b[0], hi: b[1], verify });
      else if (s > b[1] + 1e-9) v.push({ kind: 'cat', key: c, dir: -1, gap: s - b[1], share: s, lo: b[0], hi: b[1], verify });
    }
    // the concrete outranks the aggregate: industries first, worst gap first within each kind
    return v.sort((a, b2) => (a.kind === b2.kind ? b2.gap - a.gap : a.kind === 'ind' ? -1 : 1));
  };
  // total shortfall over every ENFORCEABLE violated bound — the polish guard's scalar: a move that
  // DEEPENS any existing breach must be rejected even though the breach COUNT does not change.
  // Verify-only breaches (extraction's structural red) are excluded — polish must not be vetoed by a
  // gap nothing is allowed to close.
  const macroGap = () => macroM.on
    ? macroViolations(macroShares()).filter(x => !x.verify).reduce((a, x) => a + x.gap, 0) : 0;
  // the STRICT gap includes verify-only bounds — read ONLY by ERA_GROW=2's guard (see GROW_STRICT):
  // enforcement must never act on a verify-only bound, but a growth mechanism may be forbidden to
  // deepen one, which is a weaker and legitimate use (report-only stays report-only; growth just stops).
  const macroGapAll = () => macroM.on
    ? macroViolations(macroShares()).reduce((a, x) => a + x.gap, 0) : 0;

  const SHRINK_ON = process.env.ERA_SHRINK_LOSSMAKERS !== '0';
  const shrunk = {};
  const grown = {};                 // ⚗ ERA_GROW tally: key -> levels added
  const growBlocked = new Set();    // grow candidates retired by a guard
  const growFrom = {};              // key -> count at the first grow (futility unwinds to here)
  let growWavg = null;              // last computed capital-weighted average margin (reported)
  // ⭐ STALE RUNGS ARE THE FIRST VICTIMS (user, 2026-08-09; ERA_SHRINK_STALE_FIRST=0 reverts). The
  // reduction used to cut the worst loser regardless of vintage, which could trim an era-exact
  // workhorse while an obsolete rung still stood at scale. Now: while ANY stale rung (older than the
  // scenario era) loses money above one level, it is cut first; era-exact and leading capacity may
  // only be cut once the obsolete tail is spent. `worstStale` carries that priority class.
  // ⭐ URBAN CENTRES ARE A CANDIDATE TOO. Their level count is an ENTITLEMENT from urbanization
  // (F13), not a decision — but the game staffs that entitlement out of who is available, so a
  // loss-making urban centre sheds employment instead of standing fully manned. With no employment
  // scaling in the model, cutting levels is the available approximation of the same thing. Keyed by
  // building rather than by tier, hence the `worst` bookkeeping below carries a KEY, not a tier.
  const findWorstLoser = () => {
    let worst = null, worstP = 0, worstStale = null, worstStaleP = 0;
    if (URBAN_SHRINK) {
      const n = S.BLDNUM.building_urban_center || 0;
      const ec = n > 1 ? E.refEcon('building_urban_center') : null;
      if (ec && ec.tp != null && isFinite(ec.tp) && ec.tp / 100 < URBAN_FLOOR && ec.tp / 100 < worstP) {
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
        const tp = E.TPthr(p.ind, t) / 100 - indPenalty(p.ind) + subsidyTol(p.ind);
        if (!isFinite(tp) || tp >= 0) continue;
        if (SHRINK_STALE_FIRST && t.era < era) { if (tp < worstStaleP) { worstStale = t; worstStaleP = tp; } }
        if (tp < worstP) { worst = t; worstP = tp; }
      }
    }
    if (worstStale) { worst = worstStale; worstP = worstStaleP; }
    return worst ? { worst, worstP } : null;
  };
  // ⚗ ERA_GROW — the qualified grow target, or null. Candidates and the capital-weighted average are
  // both computed on the CURRENT settled state; see the knob's header comment for the rule.
  const pickGrow = () => {
    let wSum = 0, wTot = 0;
    const cands = [];
    let agriTot = 0;
    for (const b in S.BLDNUM) if (isScaleAgri(b) && !E.isSubsistenceBuilding(b)) agriTot += S.BLDNUM[b] || 0;
    for (const p of placement) {
      if (p.ind.follows_be === false) continue;
      const pen = indPenalty(p.ind);
      for (const r of p.rows) {
        const t = r.t, n = S.BLDNUM[t.key] || 0;
        if (!(n > 0)) continue;
        const io = E.tierGoodsIO(p.ind, t); if (!Object.keys(io.out || {}).length) continue;
        const tp = E.TPthr(p.ind, t) / 100 - pen;
        if (!isFinite(tp)) continue;
        const k2 = E.thruMult(t.key), cost = n * (k2 * E.inputValue(t, true) + E.wageCost(t));
        if (tp > 0 && cost > 0) { wSum += tp * cost; wTot += cost; }
        // a rung this same loop already CUT is not a grow candidate — the alternation must not ping-pong
        if (r.fixed != null || growBlocked.has(t.key) || shrunk[t.key]) continue;
        cands.push({ key: t.key, isRef: false, tp, n, ind: p.ind, t });
      }
    }
    for (const b of refProducers) {
      const n = S.BLDNUM[b] || 0;
      if (!(n > 0) || dropped.has(b)) continue;
      const ec = E.refEcon(b); if (!ec || ec.tp == null || !isFinite(ec.tp)) continue;
      const tp = ec.tp / 100;
      const cost = n * (E.thruMult(b) * E.goodsVal((ec.goods || {}).in || {}, true) + (ec.W || 0));
      if (tp > 0 && cost > 0) { wSum += tp * cost; wTot += cost; }
      if (!isRawProducer(b)) continue;
      if (fixedRef[b] != null || growBlocked.has(b) || protectedRaw.has(b) || rawCap[b] != null) continue;
      if (n + 1 > scaleCapOf(b)) continue;                              // the user-ruled limits bind here
      if (isScaleAgri(b) && agriTot + 1 > SCALE_LIMIT.agriculture) continue;
      cands.push({ key: b, isRef: true, tp, n });
    }
    if (!cands.length || !(wTot > 0)) return null;
    growWavg = wSum / wTot;
    cands.sort((a, b2) => b2.tp - a.tp);
    const top = cands[0];
    return top.tp >= growWavg + GROW_MARGIN ? top : null;
  };
  const doGrow = g => {
    const before = ceilingBreachSet();
    const gap0 = GROW_STRICT ? macroGapAll() : macroGap();
    if (growFrom[g.key] == null) growFrom[g.key] = g.n;
    const step = g.n >= 10 ? Math.max(1, Math.floor(g.n * 0.10)) : 1;
    const prevMin = minCount[g.key], prevMax = g.isRef ? undefined : maxCount[g.key];
    minCount[g.key] = g.n + step;
    if (!g.isRef && maxCount[g.key] != null && maxCount[g.key] < g.n + step) maxCount[g.key] = g.n + step;
    settle(); syncPrices();
    const tpA = g.isRef ? (((E.refEcon(g.key) || {}).tp ?? NaN) / 100)
                        : E.TPthr(g.ind, g.t) / 100 - indPenalty(g.ind);
    const outG = g.isRef ? E.selGoods(E.refSel(g.key)).out : E.tierGoodsIO(g.ind, g.t).out;
    const outHigh = Object.keys(outG).some(x => outG[x] > 0 && (S.thresholds[x] ?? 100) >= 174.5);
    const futile = isFinite(tpA) && !(tpA < g.tp - 0.0025) && !outHigh;   // §10.21's doctrine
    if (breachGrew(before) || (GROW_STRICT ? macroGapAll() : macroGap()) > gap0 + 1e-9 || futile) {
      // ceiling/macro: undo this step. FUTILE: unwind the whole run — pin at the count the first grow
      // saw, exactly the tuner's growStart semantics (§10.21).
      minCount[g.key] = futile ? growFrom[g.key] : prevMin;
      if (minCount[g.key] == null) delete minCount[g.key];
      if (!g.isRef) { maxCount[g.key] = prevMax; if (maxCount[g.key] == null) delete maxCount[g.key]; }
      growBlocked.add(g.key);
      if (futile) delete grown[g.key];
      settle(); syncPrices();
      return;
    }
    grown[g.key] = (grown[g.key] || 0) + step;
  };
  if (SHRINK_ON) {
    // ⚗ ERA_GROW alternates one increase with one reduction (user design); with the knob off this loop
    // is byte-for-byte the previous reduction loop. When only one kind of candidate exists, that kind
    // runs every iteration; the loop ends when neither exists.
    let phase = 0;
    for (let guard = 0; guard < SHRINK_STEPS; guard++) {
      conv = contSettle(20, 0.15);
      const w = findWorstLoser();
      const g = (GROW_ON && (phase === 1 || !w)) ? pickGrow() : null;
      phase = 1 - phase;
      if (g) { doGrow(g); continue; }
      if (!w) break;
      const { worst, worstP } = w;
      const nW = S.BLDNUM[worst.key] || 1;
      const cut = (SHRINK_COARSE && worstP < -0.10) ? Math.max(1, Math.floor(nW * 0.05)) : 1;
      maxCount[worst.key] = Math.max(1, Math.floor(nW - cut));
      shrunk[worst.key] = (shrunk[worst.key] || 0) + cut;
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
  // ⭐ §10.51.2 (user-ruled "needs fixing", 2026-08-10): FREE ENTRY IS A FUNCTION AND RUNS TWICE — here,
  // and again AFTER the macro pass, because the tuner's one pass left its work graded against prices
  // that macro and the recheck then moved (dominant rungs ending 6–17pp off the band edge with growth
  // headroom unexploited). The second call starts with a CLEAN futility slate (capBlocked.clear() — the
  // late-appeal doctrine: verdicts formed at mid-solve prices get one re-hearing at near-final ones)
  // and carries a MACRO GUARD the first pass does not need: a growth step that deepens an enforceable
  // macro gap is undone and the tier blocked, so free entry cannot un-pay what macro's floors paid for.
  const runFreeEntry = (steps, macroGuard) => {
    for (let step = 0; step < steps; step++) {
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
      const beforeC = ceilingBreachSet();
      if (shrink) {
        // ⚠ THE CEILING GUARDS THE SHRINK TOO. In era 1 the plantation is dye's ONLY source — synthetics
        // does not exist yet — so shrinking it to zero left dye with demand and no supply, pinned at the
        // band edge. Retreat stops at the point where the market still has a supplier.
        const prevN = fixedRef[shrink];
        fixedRef[shrink] -= 1;
        if (fixedRef[shrink] <= 0) dropped.add(shrink);
        settle(); syncPrices();
        if (breachGrew(beforeC)) {
          fixedRef[shrink] = prevN; dropped.delete(shrink); protectedRaw.add(shrink);
          settle(); syncPrices();
        }
        continue;
      }
      if (rawDrop) {
        dropped.add(rawDrop);
        settle(); syncPrices();
        if (breachGrew(beforeC)) { dropped.delete(rawDrop); protectedRaw.add(rawDrop); settle(); syncPrices(); }
        continue;
      }
      if (rawGrow && (!best || rawGrowP > bestP - PROFIT_CAP)) {
        const prevR = minCount[rawGrow] || 0, tpBefore = E.refEcon(rawGrow).tp;
        const gap0 = macroGuard ? macroGap() : 0;
        if (growStart[rawGrow] == null) growStart[rawGrow] = S.BLDNUM[rawGrow] || 0;
        minCount[rawGrow] = (S.BLDNUM[rawGrow] || 0) + 1;
        settle(); syncPrices();
        // ⚠ STOP IF GROWING DOES NOT ACTUALLY HELP. If the good is already pinned at the 25% price FLOOR,
        // extra supply cannot push the price down any further, so the margin does not move and the loop
        // will spend its entire budget achieving nothing. Measured before this guard: tea_plantation took
        // ALL 400 steps in era 1 and still read 294%. A rule that cannot reach its goal must say so and
        // stop, not grind.
        // ⚠⚠ ONLY AT THE FLOOR. The guard used to fire on ANY unmoved margin — including a good pinned at
        // the 175 CEILING with demand far above supply, where one level of growth is not yet enough to
        // unpin the price. There "margin did not move" means "not enough growth YET", and the permanent
        // capBlocked it imposed was blocking exactly the producer the hard ceiling constraint needs grown:
        // the 1780 iron mine sat at 1 level / 419% / buy 58 vs sell 22 forever, and the era-2 engines
        // under-build (§10.42.5, reopened) carries the same signature in the manufacturing branch below.
        const tpAfter = E.refEcon(rawGrow).tp;
        const outPinnedHigh = (() => { const o = E.selGoods(E.refSel(rawGrow)).out;
          for (const g in o) if (o[g] > 0 && (S.thresholds[g] ?? 100) >= 174.5) return true; return false; })();
        const futile = PROFIT_CAP_FUTILITY && !(tpAfter < tpBefore - 0.25) && !outPinnedHigh;
        // the second pass's macro guard: growth may not deepen an enforceable reasonability gap (§10.51.2)
        if (breachGrew(beforeC) || futile || (macroGuard && macroGap() > gap0 + 1e-9)) {
          // ceiling/macro breach: undo this step. FUTILE: undo the entire run back to where it started.
          minCount[rawGrow] = futile ? growStart[rawGrow] : prevR;
          capBlocked.add(rawGrow); settle(); syncPrices();
          if (futile) delete tuned[rawGrow.replace(/^building_/, '')];
        } else tuned[rawGrow.replace(/^building_/, '')] = (tuned[rawGrow.replace(/^building_/, '')] || 0) + 1;
        continue;
      }
      if (!best) break;
      const k = best.t.key, prev = minCount[k] || 0;
      const tpB = E.TPthr(best.ind, best.t);
      const gapB = macroGuard ? macroGap() : 0;
      if (growStart[k] == null) growStart[k] = S.BLDNUM[k] || 0;
      minCount[k] = (S.BLDNUM[k] || 0) + 1;               // one level at a time, as specified
      settle(); syncPrices();
      // the futility guard applies to manufacturing too: if its own good is floored, more capacity cannot
      // move the margin and the run is unwound to where it began — but NOT when the good is pinned at the
      // CEILING (see the raw branch above: there growth is mandatory and merely insufficient so far)
      const tpA = E.TPthr(best.ind, best.t);
      const outHigh = (S.thresholds[E.tierOut(best.ind, best.t)] ?? 100) >= 174.5;
      if (PROFIT_CAP_FUTILITY && !(tpA < tpB - 0.25) && !outHigh) {
        minCount[k] = growStart[k]; capBlocked.add(k); settle(); syncPrices();
        const lbl = best.t.era === era ? best.ind.id : `${best.ind.id} e${best.t.era}`;
        delete tuned[lbl];
        continue;
      }
      if (breachGrew(beforeC) || (macroGuard && macroGap() > gapB + 1e-9)) {
        // the extra capacity pushed one of its own inputs to the +75% band edge (or, on the second
        // pass, deepened a macro gap) — those outrank this rule, so put the level back and stop growing
        // THIS TIER (not the whole industry: another tier of it may still have room)
        minCount[k] = prev; capBlocked.add(k);
        settle(); syncPrices();
      } else {
        const label = best.t.era === era ? best.ind.id : `${best.ind.id} e${best.t.era}`;
        tuned[label] = (tuned[label] || 0) + 1;
      }
    }
  };
  if (PROFIT_CAP_ON) runFreeEntry(PROFIT_CAP_STEPS, false);

  // ⚗ ERA_RAW_RECHECK — re-enforce §10.18 on the FINAL state. The main enforcement runs before the
  // manufacturing reduction and the tuner, and both of those move counts and prices afterwards — which is
  // exactly how the shipped 1870 ended with wheat/maize/millet at −3% unprotected. This pass may only move
  // COUNTS and re-price (settle + syncPrices, like the tuner): recipes are final here and contSettle would
  // re-solve them.
  // ⭐ §10.51.1 (user-ruled "needs fixing", 2026-08-10): the recheck is a FUNCTION and runs TWICE — here,
  // and again AFTER the macro enforcement pass, because macro moves counts and prices and nothing was
  // re-verifying §10.18 (no loss-making raw producer), §10.22 (the raw band) or the mfg loss rule after
  // it. The post-macro call passes `skipGrown` — the exact keys macro's FLOOR moves raised — because a
  // reasonability floor outranks a margin by ruling (§10.47): the recheck must not cut what macro just
  // paid for, and everything else is fair game. `protectedMfg` persists across both calls.
  const RECHECK_PROTECTED_MFG = new Set();
  const runRecheck = (budget, skipGrown = null) => {
    // ⚠ THE RE-CHECK MUST COVER MANUFACTURING TOO, or it recreates the phase-ordering bug it exists to
    // close. Measured (combo1, 2026-08-09): the raw-only version dropped/shrank raw producers AFTER the
    // manufacturing reduction had terminated, prices moved, and era-5's fertilizer tier — clean when the
    // reduction last looked — ended at 116 levels × −46%, £448k/wk, with nothing left running that could
    // cut it. One combined loop over every count rule, settle-only (recipes are final here), worst first.
    const protectedMfg = RECHECK_PROTECTED_MFG;
    for (let guard = 0; guard < budget; guard++) {
      // ⭐ UNDROP ON BREACH (2026-08-10, found by the army fixed point): a producer dropped as unviable
      // is dropped against THAT moment's demand, and demand keeps moving — the §10.51 army re-solve
      // raised era-3 sugar demand AFTER the sugar plantations were legally dropped, and the good pinned
      // at 175 with no producer any rule could bring back (the polish moves only our tiers). The ceiling
      // outranks solvency in BOTH directions, so the remedy is symmetric with the drop guard: while a
      // restricted good is breached and a dropped/capped raw producer makes it, restore that producer
      // (undrop, or lift the shed cap by 25%) as this iteration's step. Protected producers are already
      // present, so this cannot fight the "kept at a loss" rule.
      {
        const breached = ceilingBreachSet();
        let acted = false;
        for (const g of breached) {
          for (const b of refProducers) {
            if (!isRawProducer(b)) continue;
            const makes = (E.selGoods(E.refSel(b)).out || {})[g] > 0;
            if (!makes) continue;
            if (dropped.has(b)) { dropped.delete(b); protectedRaw.add(b); acted = true; break; }
            if (rawCap[b] != null && rawCap[b] < scaleCapOf(b)) {
              rawCap[b] = Math.min(scaleCapOf(b), Math.ceil(rawCap[b] * 1.25) + 1); acted = true; break;
            }
          }
          if (acted) break;
        }
        if (acted) { settle(); syncPrices(); continue; }
      }
      let worst = null, worstP = 0, kind = null, worstStale = null, worstStaleP = 0;
      let rawOver = null, rawOverGap = 0;
      for (const b of refProducers) {
        if (!(S.BLDNUM[b] > 0) || dropped.has(b) || protectedRaw.has(b) || !isRawProducer(b)) continue;
        if (fixedRef[b] != null) continue;               // fixed-count producers have their own rule above
        if (skipGrown && skipGrown.has(b)) continue;     // macro floors outrank margins (§10.47)
        const ec = E.refEcon(b); if (!ec || ec.tp == null || !isFinite(ec.tp)) continue;
        if (ec.tp < 0 && ec.tp < worstP) { worst = b; worstP = ec.tp; kind = 'raw'; }
        // …and the §10.22 UPPER band, re-verified here too (§10.51.1): a producer left over-band by
        // post-tuner phases grows one level at a time, loss cases first
        const band = rawBandOf(b);
        if (band && ec.tp / 100 > band[1] && !capBlocked.has(b)
            && (S.BLDNUM[b] || 0) + 1 <= scaleCapOf(b)
            && (rawCap[b] == null || (S.BLDNUM[b] || 0) + 1 <= rawCap[b])
            && ec.tp / 100 - band[1] > rawOverGap) { rawOver = b; rawOverGap = ec.tp / 100 - band[1]; }
      }
      if (SHRINK_ON) for (const p of placement) {
        if (p.ind.follows_be === false) continue;
        for (const r of p.rows) {
          const t = r.t, n = S.BLDNUM[t.key] || 0;
          if (!(n > 1) || r.fixed != null || protectedMfg.has(t.key)) continue;
          if (skipGrown && skipGrown.has(t.key)) continue;   // macro floors outrank margins (§10.47)
          const tp = E.TPthr(p.ind, t) / 100 - indPenalty(p.ind) + subsidyTol(p.ind);
          if (!isFinite(tp) || tp >= 0) continue;
          if (SHRINK_STALE_FIRST && t.era < era && tp < worstStaleP) { worstStale = t.key; worstStaleP = tp; }
          if (tp < worstP) { worst = t.key; worstP = tp; kind = 'mfg'; }
        }
      }
      if (worstStale) { worst = worstStale; worstP = worstStaleP; kind = 'mfg'; }   // stale rungs die first
      // a loss anywhere outranks an over-earner; only a loser-free pass may spend its step on the band top
      if (!worst && rawOver) {
        const before2 = ceilingBreachSet(), tpB = E.refEcon(rawOver).tp;
        const prevMin = minCount[rawOver];
        minCount[rawOver] = (S.BLDNUM[rawOver] || 0) + 1;
        settle(); syncPrices();
        const tpA = (E.refEcon(rawOver) || {}).tp;
        const outHigh = (() => { const o = E.selGoods(E.refSel(rawOver)).out;
          for (const g in o) if (o[g] > 0 && (S.thresholds[g] ?? 100) >= 174.5) return true; return false; })();
        if (breachGrew(before2) || (PROFIT_CAP_FUTILITY && !(tpA < tpB - 0.25) && !outHigh)) {
          minCount[rawOver] = prevMin; if (minCount[rawOver] == null) delete minCount[rawOver];
          capBlocked.add(rawOver); settle(); syncPrices();
        }
        continue;
      }
      if (!worst) break;
      const before = ceilingBreachSet();
      if (process.env.ERA_BREACH_TRACE === '1')
        console.error(`BTRACE e${era} shrink ${worst} n=${S.BLDNUM[worst] || 0} before={${[...before].join(',')}}`);
      const n = S.BLDNUM[worst] || 0;
      if (kind === 'mfg') {
        const prevCap = maxCount[worst];
        const cut = (SHRINK_COARSE && worstP < -0.10) ? Math.max(1, Math.floor(n * 0.05)) : 1;
        maxCount[worst] = Math.max(1, Math.floor(n - cut));
        shrunk[worst] = (shrunk[worst] || 0) + cut;
        settle(); syncPrices();
        if (breachGrew(before)) { maxCount[worst] = prevCap; protectedMfg.add(worst); settle(); syncPrices(); }
        if (process.env.ERA_BREACH_TRACE === '1')
          console.error(`BTRACE e${era}   after={${[...ceilingBreachSet()].join(',')}} undone=${protectedMfg.has(worst)}`);
      } else if (RAW_SHRINK && n > 1) {
        const prevCap = rawCap[worst];
        rawCap[worst] = n - Math.max(1, Math.floor(n * 0.25));
        settle(); syncPrices();
        if (breachGrew(before)) { rawCap[worst] = prevCap; protectedRaw.add(worst); settle(); syncPrices(); }
      } else {
        dropped.add(worst);
        settle(); syncPrices();
        if (breachGrew(before)) { dropped.delete(worst); protectedRaw.add(worst); settle(); syncPrices(); }
      }
    }
  };
  const macroGrownKeys = new Set();   // §10.51.1: keys macro's FLOOR moves raised — the post-macro recheck skips them
  if (RAW_RECHECK) runRecheck(400);
  // ═══ MACROSCENARIO REASONABILITY — enforcement (tools/era_macro.mjs, §10.47; ERA_MACRO=0 reverts) ═══
  // The bounds say what a large autarkic US-like economy may look like: per-industry and per-category
  // GROSS PRODUCT (value added) shares of GDP, professions verified alongside. Enforcement is a
  // post-solve count pass in the tuner's mould — recipes and PM selections are FINAL here, so it moves
  // COUNTS only (minCount/maxCount, rawCap for reference producers) and re-prices with settle +
  // syncPrices after every step. Ordering is deliberate: it runs AFTER the profit-driven passes
  // (§10.18/§10.21/§10.38/RAW_RECHECK), because a reasonability floor OUTRANKS a margin — a railway
  // sector the margin math dislikes is still a railway sector 1900 America has — and nothing after it
  // may undo it (the integer polish below carries a macro guard).
  //   * FLOOR (industry dead): grow the present tier with the best VA per level, 25% of levels at a
  //     time. A tier with negative VA/level can only make the share worse, so it is never grown; an
  //     industry with no positive-VA tier at all is BLOCKED and reported — that is the user-ruled
  //     "negative pre-wage balance" case, a wall to discuss, not to grind against.
  //   * CAP (industry dominant): cut the OLDEST tier above one level (stale capacity dies first, the
  //     §10.38 directive), 25% at a time.
  //   * CATEGORY moves pick the best member by the same VA test, and are undone if they push a member
  //     industry out of its OWN band — the aggregate is never fixed by breaking a concrete bound.
  //   * Guards, same precedence as everywhere: a step that breaches the +75% industrial ceiling is
  //     undone and the bound blocked; a step that does not move the share is undone, and if the share
  //     never moved at all the whole run is unwound (§10.21's futility doctrine — levels that bought
  //     nothing are junk, but progress already banked is kept and the shortfall reported).
  // ⚠ Two accepted approximations, stated: post-solve growth adds workforce with no job-pool rescale
  // (same acceptance as the tuner's), and a category unwind can clip an overlapping industry move's
  // gains when both touched one tier. Category bounds sit far from today's state, so both paths are
  // dormant until a bound is narrowed; revisit §10.18 interaction if category enforcement starts binding.
  // (macroM / macroShares / macroViolations / macroGap are defined ABOVE the loss-shrink loop — the
  //  ⚗ ERA_GROW guard consumes them there; the enforcement below is unchanged and still runs HERE.)
  if (macroM.on) {
    const mBlocked = new Set();       // 'I:<id>' / 'C:<cat>' that may no longer be acted on
    const memberSkip = new Set();     // 'C:<cat>|<member>' — category member whose move failed
    const startShare = {};            // violation key -> share when first acted on (net-progress test)
    const movesBy = new Map();        // violation key -> Map(target -> first-touch {min0,max0,cap0,isRef})
    const record = (vKey, target, isRef) => {
      let m = movesBy.get(vKey); if (!m) movesBy.set(vKey, m = new Map());
      if (!m.has(target)) m.set(target, isRef ? { isRef, min0: minCount[target], cap0: rawCap[target] }
                                              : { isRef, min0: minCount[target], max0: maxCount[target] });
    };
    const unwind = vKey => {
      const m = movesBy.get(vKey); if (!m) return;
      for (const [target, s0] of m) {
        if (s0.isRef) { minCount[target] = s0.min0; rawCap[target] = s0.cap0; }
        else { minCount[target] = s0.min0; maxCount[target] = s0.max0; }
        if (minCount[target] == null) delete minCount[target];
        if (!s0.isRef && maxCount[target] == null) delete maxCount[target];
        if (s0.isRef && rawCap[target] == null) delete rawCap[target];
      }
      settle(); syncPrices();
    };
    const shareNow = (kind, key) => { const st = macroShares();
      return ((kind === 'ind' ? st.ind[key] : st.cat[key]) || 0) / st.total; };
    for (let step = 0; step < MACRO_STEPS; step++) {
      const st = macroShares();
      // verify-only breaches are never acted on — they go straight to the residual report
      const viol = macroViolations(st).find(x => !x.verify && !mBlocked.has((x.kind === 'ind' ? 'I:' : 'C:') + x.key));
      if (!viol) break;
      const vKey = (viol.kind === 'ind' ? 'I:' : 'C:') + viol.key;
      if (startShare[vKey] == null) startShare[vKey] = viol.share;
      const preInd = new Set(macroViolations(st).filter(x => x.kind === 'ind').map(x => x.key));
      const before = ceilingBreachSet();
      const block = why => { mBlocked.add(vKey);
        macroM.blocked.push({ key: viol.key, kind: viol.kind, dir: viol.dir, share: shareNow(viol.kind, viol.key), lo: viol.lo, hi: viol.hi, why }); };
      // ---- pick the move target -------------------------------------------------------------------
      let target = null;   // { key, isRef, n, size, apply(), undoStep() }
      const tierMove = (r, dir) => {
        const k = r.t.key, n = S.BLDNUM[k] || 0;
        const size = Math.max(1, Math.floor(n * 0.25));
        const prevMin = minCount[k], prevMax = maxCount[k];
        return {
          key: k, isRef: false, n, size,
          apply: dir > 0
            ? () => { minCount[k] = n + size; if (maxCount[k] != null && maxCount[k] < n + size) maxCount[k] = n + size; }
            : () => { maxCount[k] = Math.max(1, n - size); if (minCount[k] != null && minCount[k] > maxCount[k]) minCount[k] = maxCount[k]; },
          undoStep: () => { minCount[k] = prevMin; maxCount[k] = prevMax;
            if (minCount[k] == null) delete minCount[k]; if (maxCount[k] == null) delete maxCount[k]; },
        };
      };
      const refMove = (b, dir) => {
        const n = S.BLDNUM[b] || 0;
        const size = Math.max(1, Math.floor(n * 0.25));
        const prevMin = minCount[b], prevCap = rawCap[b];
        return {
          key: b, isRef: true, n, size,
          apply: dir > 0 ? () => { minCount[b] = n + size; }
                         : () => { rawCap[b] = Math.max(1, n - size); },
          undoStep: () => { minCount[b] = prevMin; rawCap[b] = prevCap;
            if (minCount[b] == null) delete minCount[b]; if (rawCap[b] == null) delete rawCap[b]; },
        };
      };
      if (viol.kind === 'ind') {
        if (viol.dir > 0) {
          let best = null, bestVa = 0;
          for (const r of viol.p.rows) {
            if (!(S.BLDNUM[r.t.key] > 0) || r.fixed != null) continue;
            const va = vaPerLvl(viol.p.ind, r.t);
            if (va > bestVa) { best = r; bestVa = va; }
          }
          if (!best) { block('no tier adds positive gross product — negative pre-wage balance'); continue; }
          target = tierMove(best, +1);
        } else {
          const cand = viol.p.rows.filter(r => (S.BLDNUM[r.t.key] || 0) > 1 && r.fixed == null)
            .sort((a, b2) => a.t.era - b2.t.era)[0];   // stale capacity dies first
          if (!cand) { block('nothing above one level to cut'); continue; }
          target = tierMove(cand, -1);
        }
      } else {
        // category: best/oldest member by the same tests, skipping members that already failed
        if (viol.dir > 0) {
          if (viol.key === 'manufacturing') {
            let best = null, bestVa = 0;
            for (const p of placement) {
              if (p.withheld || p.ind.follows_be === false || MACRO_INFRA.has(p.ind.id)) continue;
              for (const r of p.rows) {
                const k = r.t.key;
                if (!(S.BLDNUM[k] > 0) || r.fixed != null || memberSkip.has(vKey + '|' + k)) continue;
                const va = vaPerLvl(p.ind, r.t);
                if (va > bestVa) { best = r; bestVa = va; }
              }
            }
            if (!best) { block('no member tier adds positive gross product'); continue; }
            target = tierMove(best, +1);
          } else {
            let best = null, bestVa = 0;
            for (const b of refProducers) {
              const n = S.BLDNUM[b] || 0;
              if (!(n > 0) || dropped.has(b) || fixedRef[b] != null || memberSkip.has(vKey + '|' + b)) continue;
              if (n >= scaleCapOf(b) || (rawCap[b] != null && n >= rawCap[b])) continue;   // no headroom
              const c = catOf(b);
              if (!(viol.key === 'agriculture' ? MACRO_AGRI_CATS : MACRO_EXTRACT_CATS).has(c)) continue;
              const va = refVaPerLvl(b);
              if (va > bestVa) { best = b; bestVa = va; }
            }
            if (!best) { block('no member producer with positive gross product and headroom'); continue; }
            target = refMove(best, +1);
          }
        } else {
          if (viol.key === 'manufacturing') {
            let cand = null;
            for (const p of placement) {
              if (p.withheld || p.ind.follows_be === false || MACRO_INFRA.has(p.ind.id)) continue;
              for (const r of p.rows) {
                const k = r.t.key;
                if (!((S.BLDNUM[k] || 0) > 1) || r.fixed != null || memberSkip.has(vKey + '|' + k)) continue;
                if (!cand || r.t.era < cand.t.era) cand = r;      // stale capacity dies first
              }
            }
            if (!cand) { block('nothing above one level to cut'); continue; }
            target = tierMove(cand, -1);
          } else {
            let worstB = null, worstVa = Infinity;
            for (const b of refProducers) {
              const n = S.BLDNUM[b] || 0;
              if (!(n > 1) || dropped.has(b) || fixedRef[b] != null || memberSkip.has(vKey + '|' + b)) continue;
              const c = catOf(b);
              if (!(viol.key === 'agriculture' ? MACRO_AGRI_CATS : MACRO_EXTRACT_CATS).has(c)) continue;
              const va = refVaPerLvl(b);
              if (va < worstVa) { worstB = b; worstVa = va; }
            }
            if (!worstB) { block('nothing above one level to cut'); continue; }
            target = refMove(worstB, -1);
          }
        }
      }
      // ---- apply, re-price, judge -----------------------------------------------------------------
      record(vKey, target.key, target.isRef);
      target.apply();
      settle(); syncPrices();
      const sAfter = shareNow(viol.kind, viol.key);
      const improved = viol.dir > 0 ? sAfter > viol.share + 1e-9 : sAfter < viol.share - 1e-9;
      const breach = breachGrew(before);
      const newInd = viol.kind === 'cat'
        && macroViolations(macroShares()).some(x => x.kind === 'ind' && !preInd.has(x.key));
      if (breach || !improved || newInd) {
        target.undoStep();
        settle(); syncPrices();
        if (viol.kind === 'cat' && !breach) { memberSkip.add(vKey + '|' + target.key); continue; }   // try another member
        const sNow = shareNow(viol.kind, viol.key);
        const netProgress = viol.dir > 0 ? sNow > startShare[vKey] + 1e-9 : sNow < startShare[vKey] - 1e-9;
        if (!netProgress) { unwind(vKey); block(breach ? 'ceiling — a step pinned a consumable at +75%' : 'futile — the share never moved'); }
        else block((breach ? 'ceiling after partial progress' : 'stalled') + ` at ${(100 * sNow).toFixed(2)}%`);
      } else {
        const tally = viol.dir > 0 ? macroM.grown : macroM.cut;
        tally[viol.key] = (tally[viol.key] || 0) + target.size;
        if (viol.dir > 0) macroGrownKeys.add(target.key);   // §10.51.1: the post-macro recheck spares these
      }
    }
    // ---- residuals + the verified level (professions) + the standing negative-VA list --------------
    {
      const st = macroShares();
      macroM.resid = macroViolations(st).map(x => ({ kind: x.kind, key: x.key, share: x.share, lo: x.lo, hi: x.hi, dir: x.dir, verify: x.verify }));
      for (const pr in MACRO.professions) {
        const b = macroBounds(MACRO, 'professions', pr, eIx); if (!b) continue;
        const s = (POPPROF[pr] || 0) / Math.max(1, S.POPS.total);
        if (s < b[0] - 1e-9 || s > b[1] + 1e-9) macroM.profBad.push({ prof: pr, share: s, lo: b[0], hi: b[1] });
      }
      for (const p of placement) {
        const va = st.ind[p.ind.id];
        if (va != null && va < 0 && p.rows.some(r => (S.BLDNUM[r.t.key] || 0) > 0))
          macroM.negVA.push({ id: p.ind.id, share: va / st.total, excused: PMECON.LADDER_EXCUSED.has(p.ind.id) });
      }
    }
  }
  // ⭐ §10.51.1/.2 — THE POST-MACRO RE-VERIFICATION (user-ruled "needs fixing", 2026-08-10): the macro
  // pass moves counts and prices, and neither the loss/band rules nor FREE ENTRY ever looked again.
  // Order: free entry's second pass first (fresh futility slate, macro-guarded — §10.51.2), then the
  // combined loss/band recheck sparing only the keys macro's floors grew (the ruled precedence: a
  // reasonability floor outranks a margin). The polish stays the final pass.
  if (PROFIT_CAP_ON && macroM.on) { capBlocked.clear(); runFreeEntry(Math.min(200, PROFIT_CAP_STEPS), true); }
  if (RAW_RECHECK && macroM.on) runRecheck(200, macroGrownKeys);
  // ⭐ THE INTEGER POLISH (default ON; ERA_POLISH=0 reverts; ERA_POLISH_TRIALS caps work) — the approved
  // attack on the ±1-level jaggedness at its source. FINAL outer pass only: greedy ±1-level moves over our
  // tiers, each trial re-priced (settle + syncPrices — recipes are final here) and kept only when the
  // global objective strictly improves with no new ceiling breach. Objective, lexicographic: CEILING
  // BREACHES → illogicality excluding excused → losses (shipyards excluded) → net; £500/wk epsilons stop
  // it churning on noise. Breaches lead (2026-08-10) because §10.15 is a hard constraint and the polish is
  // the last count pass that could CLEAR one — with the old objective a standing breach was invisible to
  // it: a +1 shipyard level that would price clippers off the 175 wall was scored only by the profit keys,
  // and a breach the joint loop shipped simply survived (measured at era 1: clippers buy 106 / sell 48
  // from the 1-level shipyard, every downstream guard correctly refusing to make it WORSE and nothing
  // rewarded making it BETTER).
  // Moves apply through minCount/maxCount so the job-pool rescale cannot silently undo an accepted move.
  const polished = { trials: 0, accepted: 0 };
  if (POLISH && finalPass) {
    const objective = () => {
      const f = PMECON.ladderFaults(S.IND, {
        countOf: t => (S.BLDNUM[t.key] || 0),
        profitOf: (i2, t2) => E.TPthr(i2, t2) / 100,
        lossFloor: i2 => Math.min(0, currentTargetFor(i2)) - subsidyTol(i2),   // subsidised infra: fault only below −tol
      });
      const pt = profitTotals();
      return { br: ceilingBreaches(), f: f.net, l: pt.loss, n: pt.net };
    };
    const better = (a, b) => a.br !== b.br ? a.br < b.br
      : a.f !== b.f ? a.f < b.f : Math.abs(a.l - b.l) > 500 ? a.l < b.l : a.n > b.n + 500;
    let cur = objective();
    for (let sweep = 0; sweep < 4 && polished.trials < POLISH_TRIALS; sweep++) {
      let acceptedThisSweep = 0;
      for (const p of placement) {
        if (p.ind.follows_be === false) continue;
        for (const r of p.rows) {
          if (r.fixed != null) continue;
          for (const dir of [-1, 1]) {
            if (polished.trials >= POLISH_TRIALS) break;
            const k = r.t.key, n = S.BLDNUM[k] || 0;
            if (dir < 0 && n <= 1) continue;              // one level is the floor, as everywhere
            if (dir > 0 && !(n > 0)) continue;            // never resurrect an absent tier
            polished.trials++;
            const prevMin = minCount[k], prevMax = maxCount[k];
            const before = ceilingBreachSet();
            // the macroscenario guard: polish must not deepen a reasonability breach the enforcement
            // above just paid for — the gap SUM catches a move that worsens an existing breach, which
            // the breach count alone would miss.
            // ⚠ EXCEPT for a move that CLEARS a hard-ceiling breach (2026-08-10): §10.15 outranks the
            // macro layer everywhere else (macro enforcement undoes its own steps on a ceiling breach),
            // so it must outrank it here too. Measured: the +1 shipyard level that prices era-1 clippers
            // off the 175 wall shrinks the mapped denominator (shipyard VA is negative), nudging a
            // standing above-cap gap wider — and the gap veto rejected the only move that could clear
            // the era's one hard-constraint violation.
            const gap0 = macroGap();
            if (dir > 0) { minCount[k] = n + 1; if (maxCount[k] != null && maxCount[k] < n + 1) maxCount[k] = n + 1; }
            else { maxCount[k] = n - 1; if (minCount[k] != null && minCount[k] > n - 1) minCount[k] = n - 1; }
            settle(); syncPrices();
            const now = objective();
            const clearedBreach = !breachGrew(before) && ceilingBreaches() < before.size;
            if (breachGrew(before) || (!clearedBreach && macroGap() > gap0 + 1e-9) || !better(now, cur)) {
              minCount[k] = prevMin; maxCount[k] = prevMax;
              settle(); syncPrices();
            } else { cur = now; polished.accepted++; acceptedThisSweep++; }
          }
        }
      }
      if (!acceptedThisSweep) break;                      // a full sweep with nothing accepted = optimum
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
    let groups = budget / unitCost;
    // ⭐ ERA_ARMY_FP (default ON; =0 reverts to the raw sizing — user-ruled 2026-08-10 "army and
    // construction should re-solve and change on price and GDP changes"). Sizing battalions from
    // CURRENT prices alone is a COBWEB: battalions = budget/unitCost(p) while p = f(army demand), and
    // war-goods demand is most of those goods' books — simulated undamped on the shipped 1900 preset
    // it flips forever between ~78 groups (prices floored) and ~310 (prices at 122–175), and the
    // shipped state was wherever the last tick landed (372 battalions whose bill was 1.8% of GDP
    // against the 5% premise, §10.50.2 — the same defect as that era's insolvent war industries).
    // So battalions and the army-goods prices are solved to their JOINT fixed point here, by damped
    // iteration against the FROZEN non-army order book (S.UNITNUM was cleared above, so the
    // aggregates ARE the non-army book; pops buy none of these goods, so freezing the rest is exact).
    // The engine's own price formula, monotone-decreasing budget demand against fixed supply ⇒ a
    // unique crossing; λ=0.5 kills the two-cycle. ⚠ The aggregates call is the expensive part, so it
    // runs only when the cheap current-price sizing disagrees with the incumbent by >3% — once the
    // outer loop has converged, nearly every settle takes the skip.
    if (ARMY_FP) {
      const prevGroups = ARMY_FP_LAST.era === era ? ARMY_FP_LAST.groups : null;
      if (prevGroups != null && Math.abs(groups - prevGroups) <= 0.03 * Math.max(1, prevGroups)) {
        groups = prevGroups;
      } else {
        const upk = {};
        for (const [u, w] of mix) { const gi = E.unitGoodsIO(u).in; for (const g in gi) upk[g] = (upk[g] || 0) + w * gi[g]; }
        const a = E.scenarioAggregates();
        const book = {};
        for (const g in upk) book[g] = E.scenarioBuySell(a, g);   // non-army buy/sell (army cleared above)
        for (let k = 0; k < 40; k++) {
          let uc = 0;
          for (const g in upk) {
            const p = E.priceMultPct(book[g].buy + groups * upk[g], book[g].sell);
            uc += upk[g] * (S.PRICES[g] || 0) * p / 100;
          }
          if (!(uc > 0)) break;
          const want = budget / uc;
          if (Math.abs(want - groups) < 0.5) { groups = want; break; }
          groups += 0.5 * (want - groups);
        }
      }
      ARMY_FP_LAST.era = era; ARMY_FP_LAST.groups = groups;
    }
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
           army: (() => { let bill = 0, batt = 0;
             for (const u of E.unitTypes()) for (const mob of [false, true]) {
               const n = S.UNITNUM[E.unitRowKey(u, mob)] || 0; if (!n) continue;
               batt += n; bill += n * E.goodsVal(E.unitGoodsIO(u).in, true);
             }
             const vaNow = E.scenarioValueAdded();
             return { bill, batt, share: vaNow > 0 ? bill / vaNow : 0 }; })(),
           jointDrift, jointDriftGood, jointDriftN, pmSettled, pmFrozen: pmFrozen.size,
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
           infeasible: new Map(infeasible), capped: new Set(capped), sec, ore, noBuyer,
           debutHeld, prunedHeld, chainHeld, polished, macro: macroM,
           grown: { ...grown }, growWavg, growBlocked: new Set(growBlocked),
           priceAvg: PRICE_AVG_ON ? { avg: classAvgLast ? { ...classAvgLast.avg } : null,
                                      off: { ...classOff } } : null };
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

// ---------------------------------------------------------------------------------------------------
// MACRO shares off the CURRENT GLOBAL STATE — the final profit pass's version, where `placement` no
// longer exists. Presence-based: an industry with zero levels was withheld by something that outranks
// a floor (date gate, prune, extinct, chain), so only PRESENT industries are judged. Must agree with
// buildScenario's closure version on the same state; both live on E.goodsVal at market prices, both on
// the §10.47.2 MAPPED-COMMODITY-ECONOMY denominator (tier industries + raw references + subsistence;
// urban centres excluded as the model's unmappable-services counterpart).
function macroSharesGlobal() {
  const ind = {}, cat = { manufacturing: 0, extraction: 0, agriculture: 0 };
  let total = 0;
  for (const i of S.IND) {
    let v = 0, any = false;
    for (const t of i.tiers) {
      const n = S.BLDNUM[t.key] || 0; if (!(n > 0)) continue;
      any = true;
      const io = E.tierGoodsIO(i, t);
      v += n * E.thruMult(t.key) * (E.goodsVal(io.out, true) - E.goodsVal(io.in, true));
    }
    if (!any) continue;
    ind[i.id] = v;
    total += v;
    if (!MACRO_INFRA.has(i.id)) cat.manufacturing += v;
  }
  const seenT = new Set(S.IND.flatMap(i => i.tiers.map(t => t.key)));
  for (const b in S.BLDNUM) {
    const n = S.BLDNUM[b] || 0; if (!(n > 0) || seenT.has(b)) continue;
    const g = E.selGoods(E.refSel(b));
    const va = n * E.thruMult(b) * (E.goodsVal(g.out, true) - E.goodsVal(g.in, true));
    if (E.isSubsistenceBuilding(b)) { cat.agriculture += va; total += va; continue; }
    const c = catOf(b);
    const key = MACRO_AGRI_CATS.has(c) ? 'agriculture' : MACRO_EXTRACT_CATS.has(c) ? 'extraction' : null;
    if (!key) continue;
    cat[key] += va; total += va;
  }
  return { total: Math.max(1, total), ind, cat };
}
function macroCheckGlobal(eIx2, popProf, popTotal) {
  if (!MACRO || eIx2 < MACRO.from_era) return null;
  const st = macroSharesGlobal();
  const breaches = [], negVA = [], profBad = [];
  for (const id in st.ind) {
    const s = st.ind[id] / st.total;
    const b = macroBounds(MACRO, 'industries', id, eIx2);
    if (b) {
      const verify = macroVerifyOnly(MACRO, 'industries', id);
      // lo = 0 means NO floor, same as the in-era check — negative gross product lands on negVA instead
      if (b[0] > 0 && s < b[0] - 1e-9) breaches.push({ kind: 'ind', key: id, share: s, dir: 1, bound: b[0], verify });
      else if (s > b[1] + 1e-9) breaches.push({ kind: 'ind', key: id, share: s, dir: -1, bound: b[1], verify });
    }
    if (st.ind[id] < 0) negVA.push({ id, share: s, excused: PMECON.LADDER_EXCUSED.has(id) });
  }
  for (const c in MACRO.categories) {
    const b = macroBounds(MACRO, 'categories', c, eIx2); if (!b) continue;
    const s = (st.cat[c] || 0) / st.total;
    const verify = macroVerifyOnly(MACRO, 'categories', c);
    if (b[0] > 0 && s < b[0] - 1e-9) breaches.push({ kind: 'cat', key: c, share: s, dir: 1, bound: b[0], verify });
    else if (s > b[1] + 1e-9) breaches.push({ kind: 'cat', key: c, share: s, dir: -1, bound: b[1], verify });
  }
  for (const pr in MACRO.professions) {
    const b = macroBounds(MACRO, 'professions', pr, eIx2); if (!b) continue;
    const s = ((popProf || {})[pr] || 0) / Math.max(1, popTotal || 0);
    if (s < b[0] - 1e-9 || s > b[1] + 1e-9) profBad.push({ prof: pr, share: s, lo: b[0], hi: b[1] });
  }
  return { breaches, negVA, profBad };
}

let out = [];
let META = [];
const ERAS_HDR = () => FIT.eras.map(x => W('e' + x.era, 10)).join('');
// ⚗ ERA_OUTER — the outer iteration over the era SEQUENCE. A tier's recipe is solved once, in the era
// where it is dominant, so on pass 1 era N's counts are chosen against a PROVISIONAL (canonical-start,
// leanest-legal) recipe for the era-(N+1) rung standing in its scenario — the sequential inconsistency the
// final profit pass reports but cannot fix. Pass 2+ re-runs every era against the previous pass's final
// recipe book (t.inputs is the ONLY state deliberately carried across passes; PM selections and reference
// selections are reset to their module-load state so the replay cannot leak through them). Report and
// presets come from the LAST pass only; earlier passes print a one-line summary for convergence tracking.
const REFSEL0 = JSON.parse(JSON.stringify(S.REFSEL || {}));
const SEC0 = new Map(); for (const i of S.IND) for (const t of i.tiers) SEC0.set(t.key, t._sec ? { ...t._sec } : undefined);
const LOG_REAL = console.log;
let PASS_SUMMARY = null;   // set by the final profit pass each outer pass
for (let PASS = 1; PASS <= OUTER; PASS++) {
out = []; META = []; REALISED.length = 0;
Object.keys(S.REFSEL).forEach(k => delete S.REFSEL[k]);
for (const k in REFSEL0) S.REFSEL[k] = { ...REFSEL0[k] };
for (const i of S.IND) for (const t of i.tiers) { const s0 = SEC0.get(t.key); t._sec = s0 ? { ...s0 } : undefined; }
if (PASS < OUTER) console.log = () => {};
console.log('\n=========== PHASE B — five scenarios, prices unlocked ===========');
{
  const band = k => Object.keys(BAND).filter(g => BAND[g] === k && GOOD_FIRST_ERA[g] != null).sort();
  console.log(`\nPRICE BANDS (§10.13) — finished ${PRICE_START}·${PRICE_DECAY}^age floor ${PRICE_FLOOR}`
    + ` · intermediate ${PRICE_START_INT}·${PRICE_DECAY_INT}^age floor ${PRICE_FLOOR_INT} · raw flat ${PRICE_RAW}`);
  console.log('  intermediate (a ladder industry eats it): ' + band('intermediate').join(' '));
  console.log('  finished (demand is pops / the army):      ' + band('finished').join(' '));
}
for (let e = 0; e < FIT.eras.length; e++) {
  const meta = buildScenario(e, PASS === OUTER);
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
    const ship = indPenalty(i);
    const score = (t, tgt, role) => {
      if (!t || !S.BLDNUM[t.key]) return;
      const p = E.TPthr(i, t) / 100;                       // throughput-aware, same as the solve
      if (!isFinite(p)) return;
      // ⚠ `kind` MUST keep the `tier ` prefix — the floored test below keys on it to build `I:<industry>`
      // vs `R:building_<name>`. Renaming it to the role silently sent every lookup to the reference branch,
      // so nothing was ever detected as floored and era 1's seven floored industries became genuine misses.
      hits.push({ what: i.id, kind: 'tier e' + t.era, role,
                  got: p, tgt: PROFIT_BAND_ON ? BAND_LO + ship : tgt + ship, off: gradeOff(p, tgt, ship) });
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
  console.log(`    PM optimality: ${meta.pmSettled ? 'SETTLED at the realised prices' : '⚠ NEVER SETTLED'} (${meta.pmResult.passes} pass(es)`
    + (meta.pmFrozen ? `, ${meta.pmFrozen} PMG(s) cycle-frozen` : '') + `);`
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
    lossFloor: i => Math.min(0, currentTargetFor(i)) - subsidyTol(i),   // subsidised infra: fault only below −tol
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
    if (meta.debutHeld && meta.debutHeld.length) console.log(`    NOT PLACED (debut guard — industry does not exist yet): `
      + meta.debutHeld.join(', '));
    if (meta.prunedHeld && meta.prunedHeld.length) console.log(`    NOT PLACED (pruned by ERA_PRUNE): `
      + meta.prunedHeld.join(', '));
    if (meta.chainHeld && meta.chainHeld.length) console.log(`    NOT PLACED (input's producer cannot exist yet): `
      + meta.chainHeld.join(', '));
  }
  {
    const sh = Object.entries(meta.shrunk || {});
    if (sh.length) console.log('    SHRUNK (loss-making, stale rungs first): ' + sh.sort((a, b) => b[1] - a[1])
      .map(([k, n]) => k.replace(/^building_/, '') + ' −' + n).join(', '));
    if (GROW_ON) {
      const gr = Object.entries(meta.grown || {});
      console.log(`    GROWN (⚗ ERA_GROW: top-profit ≥ wavg+${(GROW_MARGIN * 100).toFixed(0)}pp`
        + (meta.growWavg != null ? `, wavg ${(100 * meta.growWavg).toFixed(0)}%` : '') + '): '
        + (gr.length ? gr.sort((a, b) => b[1] - a[1]).map(([k, n]) => k.replace(/^building_/, '') + ' +' + n).join(', ')
                     : 'nothing qualified')
        + (meta.growBlocked.size ? '   blocked: ' + [...meta.growBlocked].map(x => x.replace(/^building_/, '')).join(', ') : ''));
    }
    if (meta.polished && meta.polished.trials) console.log(`    INTEGER POLISH: ${meta.polished.accepted} move(s)`
      + ` accepted of ${meta.polished.trials} trials (final pass only)`);
  }
  // ⚗ ERA_PRICE_AVG — the aggregate the count controller steered by, and where it landed. The achieved
  // averages off the SHIPPED state print again in the final profit pass (the headline for this knob).
  if (PRICE_AVG_ON && meta.priceAvg) {
    const pa = meta.priceAvg;
    const line = ['raw', 'mfg'].map(c => {
      const tgt = AVG_LADDER[c][meta.eIx];
      const a = pa.avg && pa.avg[c] != null ? pa.avg[c].toFixed(1) : '—';
      const bad = tgt != null && pa.avg && pa.avg[c] != null && Math.abs(pa.avg[c] - tgt) > AVG_TOL;
      return `${c === 'raw' ? 'raw-fed' : 'mfg-fed'} ${a}` + (tgt != null ? ` (want ${tgt}±${AVG_TOL}${bad ? ' ⚠ OFF' : ''}, offset ${pa.off[c].toFixed(0)})` : ' (exempt)');
    }).join(' · ');
    console.log(`    PRICE LADDER (⚗ ERA_PRICE_AVG, weighted avg of manufactured prices): ${line}`);
  }
  // ⚠⚠ THE PER-ERA PROFITABILITY LINE IS GONE ON PURPOSE. It was computed HERE, inside the era pass, and
  // that is too early to mean anything: a tier recipe is solved in the era where its tier is DOMINANT, so
  // era N still holds an UNSOLVED recipe for the era-(N+1) rung standing in its scenario, and unsolved
  // recipes are leaner. Measured against a replay of the shipped presets it agreed EXACTLY at era 0 (no
  // leading tier) and era 5 (nothing left to solve) and overstated everything between — net £1.80M against
  // a true £0.40M at 1900, 4.5x. See the FINAL PROFIT PASS after the era loop.
  console.log(`    CONSTRUCTION: ${meta.constrLevels} levels = ${(100 * meta.constrShare).toFixed(1)}% of GDP`
    + ` (target ${(100 * constrShareOf(meta.eIx)).toFixed(0)}%, ${CONSTRUCTION_PM[meta.era]})`
    + (Math.abs(meta.constrShare - constrShareOf(meta.eIx)) > 0.02 ? '   ⚠ OFF TARGET' : ''));
  // the ARMY premise, on the DISPLAY basis (bill ÷ army-inclusive VA — the UI chips' arithmetic):
  // budgeting 5% of army-exclusive VA makes the consistent display value s/(1−s) ≈ 5.3% (§10.50.2)
  {
    const armyTgt = ARMY_GDP_SHARE / (1 - ARMY_GDP_SHARE);
    console.log(`    ARMY: ${fmtN(meta.army.batt)} battalions, upkeep £${fmtN(Math.round(meta.army.bill))}/wk`
      + ` = ${(100 * meta.army.share).toFixed(1)}% of GDP (consistent ≈${(100 * armyTgt).toFixed(1)}%`
      + `${ARMY_FP ? '' : '; ⚗ ERA_ARMY_FP=0 — cobweb sizing'})`
      + (Math.abs(meta.army.share - armyTgt) > 0.01 ? '   ⚠ OFF TARGET' : ''));
  }
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
      // subsistence buildings are sized from the peasants, not by the count controller — the caps never
      // applied to them, so the verification must not count them either (subsistence_fishing_village
      // matched /fishing/ and printed a phantom "fishing 102 BREACHED" the moment the wharf sat at its cap)
      if (E.isSubsistenceBuilding(b)) continue;
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
  // ---- MACROSCENARIO REASONABILITY (§10.47) — what the bounds did and what still stands outside them.
  // The residual line is the one to read: enforcement stops at a wall (ceiling, negative gross product,
  // a price already at the floor) rather than grinding, so a residual breach is a finding about the
  // scenario, not a bug in the pass.
  if (meta.macro && meta.macro.on) {
    const m = meta.macro;
    const gl = Object.entries(m.grown), cl = Object.entries(m.cut);
    console.log(`    MACRO (${MACRO.id} reasonability, §10.47.2 — shares of the MAPPED COMMODITY ECONOMY; 1780 exempt): `
      + (gl.length || cl.length
        ? (gl.length ? 'grown ' + gl.map(([k, n]) => `${k} +${n}`).join(', ') : '')
          + (gl.length && cl.length ? ' · ' : '')
          + (cl.length ? 'cut ' + cl.map(([k, n]) => `${k} −${n}`).join(', ') : '')
        : (m.blocked.length ? 'no count moves kept' : 'no count moves needed'))
      + (m.resid.length ? '' : ' — all industry/group bounds hold'));
    if (m.resid.length) console.log('      ⚠ RESIDUAL BREACH(ES): ' + m.resid.map(r =>
      `${r.key} ${(100 * r.share).toFixed(2)}% ${r.dir > 0 ? '< floor ' : '> cap '}${(100 * (r.dir > 0 ? r.lo : r.hi)).toFixed(2)}%${r.kind === 'cat' ? ' (group)' : ''}${r.verify ? ' [structural, verify-only]' : ''}`).join(' · '));
    if (m.blocked.length) console.log('      blocked: ' + m.blocked.map(b => `${b.key} (${b.why})`).join(' · '));
    if (m.profBad.length) console.log('      ⚠ PROFESSION BOUNDS: ' + m.profBad.map(p =>
      `${p.prof} ${(100 * p.share).toFixed(2)}% outside [${100 * p.lo}%, ${100 * p.hi}%]`).join(' · '));
    if (m.negVA.length) console.log('      NEGATIVE GROSS PRODUCT (output < inputs at market prices — a VA floor cannot reach these): '
      + m.negVA.map(x => `${x.id} ${(100 * x.share).toFixed(2)}%${x.excused ? '*' : ''}`).join(' · ')
      + (m.negVA.some(x => x.excused) ? '   (*excused)' : ''));
  }
  if (tradeSupplied.size) console.log(`    TRADE-SUPPLIED (no domestic producer; imported at demand, price = 100): `
    + [...tradeSupplied].map(g => `${g} ${Math.round(S.ADDSELL[g] || 0)}`).join(' · '));
  console.log(`    INDUSTRIAL CEILING: ${breach.length ? '⚠ ' + breach.length + ' consumable good(s) AT +75%' : 'clear — no consumable good at +75%'}`);
  for (const b of breach) console.log(`      ${b.g} buy ${fmtN(b.buy)} / sell ${fmtN(b.sell)}`
    + (b.orphan ? '   ⚠ NO PRODUCER AT ALL — no count can fix this' : '   from ' + b.src.join(', ')));

  out.push({
    id: `era${meta.era}_${cfg.year}`,
    // ⭐ THE LABEL IS THE YEAR ALONE (user ruling 2026-08-12). It used to read `Era 5 · 1945`, which asserts
    // that era 5 IS 1945 — it is not. The scenario YEAR is where the vanilla GDP/SoL/wage references were
    // measured (1780/1836/1870/1900/1920/1945); the era ANCHOR is a different date meaning something else
    // (1750/1830/1870/1900/1925/1940 — at the anchor a technology leader holds about half that era's
    // technologies). They coincide only at eras 2 and 3. The UI shows the anchor as a read-only chip
    // beside the year; `era` and `year` are carried here so it need not parse the id.
    label: String(cfg.year),
    era: meta.era,
    year: cfg.year,
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
    const eraN = rows.length;   // eras are 0..5 in order
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

    let net = 0, loss = 0, winners = 0, losers = 0, exNet = 0, exLoss = 0, shipNet = 0, shipLoss = 0;
    // ⭐ LOSSES BY VINTAGE — the decomposition "total losses" cannot show (§10.38's note): a dying stale
    // tail is the design working; a loss on a NEWEST rung is an industry that cannot pay for itself.
    // ⭐ SHIPYARDS ARE EXCLUDED FROM EVERY HEADLINE FIGURE and reported on their own line (user ruling —
    // their book losses measure the unmodelled naval income, not the economy; the −30pp handicap stays).
    const lossBy = { newest: 0, stale: 0, subsistence: 0, raw_other: 0 };
    const worst = [];
    // the IMPLIED SUBSIDY BILL (§10.47.4): per subsidised industry, its aggregate book loss — what the
    // state would be paying to keep vanilla's must_have trio running. Per INDUSTRY, not per tier: a
    // profitable port does not offset the railway's loss, matching how the game subsidises buildings.
    const subsNet = {};
    const take = (p, excused, what, cls, ship) => {
      if (!isFinite(p)) return;
      if (ship) { shipNet += p; if (p < 0) shipLoss -= p; return; }
      net += p;
      if (p < 0) { loss -= p; losers++; worst.push({ what, p }); lossBy[cls] -= p; } else winners++;
      if (excused) { exNet += p; if (p < 0) exLoss -= p; }
    };
    const seen = new Set();
    for (const i of S.IND) {
      const ex = PMECON.LADDER_EXCUSED.has(i.id);
      const ship = SHIP_INDUSTRIES.has(i.id);
      const present = i.tiers.filter(t => (S.BLDNUM[t.key] || 0) > 0);
      const newestEra = present.length ? Math.max(...present.map(t => t.era)) : -1;
      for (const t of i.tiers) {
        seen.add(t.key);
        const n = S.BLDNUM[t.key] || 0; if (!(n > 0)) continue;
        const io = E.tierGoodsIO(i, t); if (!Object.keys(io.out || {}).length) continue;
        if (SUBSIDIZED.has(i.id)) subsNet[i.id] = (subsNet[i.id] || 0) + n * E.weeklyProfit(i, t);
        // "newest" = the industry's newest present rung, or anything at/after the scenario era (the two
        // coincide except past a plateau's end, where the permanent last tier is still the workhorse)
        const cls = (t.era === newestEra || t.era >= eraN) ? 'newest' : 'stale';
        take(n * E.weeklyProfit(i, t), ex, t.key.replace(/^building_/, ''), cls, ship);
      }
    }
    for (const b in S.BLDNUM) {
      const n = S.BLDNUM[b] || 0; if (!(n > 0) || seen.has(b) || isGold(b)) continue;
      const ec = E.refEcon(b); if (!ec || ec.p == null) continue;
      if (!Object.keys((ec.goods || {}).out || {}).length) continue;
      take(n * ec.p, false, b.replace(/^building_/, ''), E.isSubsistenceBuilding(b) ? 'subsistence' : 'raw_other', false);
    }
    worst.sort((a, b) => a.p - b.p);
    // ⭐ THE LEADING RUNG, SCORED AT LAST — possible only here, where every recipe is final. The per-era
    // line deliberately skips it (its recipe is unsolved at that point); this is the post-solve pass that
    // note asks for. The dominant figure here reproduces the in-era line by construction (its recipe was
    // already final in its own era) and is printed as the cross-check.
    const tgtRows = [];
    for (const i of S.IND) {
      if (i.follows_be === false) continue;
      const present = i.tiers.filter(t => (S.BLDNUM[t.key] || 0) > 0).sort((a, b) => a.era - b.era);
      if (!present.length) continue;
      const ship = indPenalty(i);
      const newest = present[present.length - 1];
      const dom = present.find(t => t.era === eraN) || (newest.era < eraN ? newest : null);
      if (newest.era > eraN) {
        const p = E.TPthr(i, newest) / 100;
        if (isFinite(p)) tgtRows.push({ id: i.id, role: 'lead', p,
          tgt: (PROFIT_BAND_ON ? BAND_LO : TG.current) + ship, off: gradeOff(p, TG.current, ship) });
      }
      if (dom) {
        const p = E.TPthr(i, dom) / 100;
        const base = dom.era === eraN ? TG.minus1 : (TG.plateau != null ? TG.plateau : TG.minus1);
        if (isFinite(p)) tgtRows.push({ id: i.id, role: 'dom', p,
          tgt: (PROFIT_BAND_ON ? BAND_LO : base) + ship, off: gradeOff(p, base, ship) });
      }
    }
    // final-state illogicality: the same one criterion, evaluated where recipes are final
    const illF = PMECON.ladderFaults(S.IND, {
      countOf: t => (S.BLDNUM[t.key] || 0),
      profitOf: (i, t) => E.TPthr(i, t) / 100,
      lossFloor: i => Math.min(0, currentTargetFor(i)) - subsidyTol(i),   // subsidised infra: fault only below −tol
    });
    rows.push({ id: ep.label, net, loss, winners, losers, exNet, exLoss, shipNet, shipLoss,
                worst: worst.slice(0, 4), lossBy, tgtRows, illF,
                priceAvgF: classInfo().avg,   // the class price averages on the SHIPPED state
                subsBill: Object.values(subsNet).reduce((a, v) => a + Math.max(0, -v), 0),
                gdpF: E.scenarioValueAdded(),
                // the macroscenario, verified on the SHIPPED state like everything else here — the
                // in-era line reads provisional leading-rung recipes, so this is the headline check
                macroF: macroCheckGlobal(eraN, ep.pops_by_profession, (ep.pops || {}).total) });
  }

  console.log('\n=========== PROFITABILITY — replayed on the SHIPPED state, recipes AND counts final ===========');
  console.log('            (shipyards excluded from every column — reported on their own line below)\n');
  console.log('  era            net £/wk     losses £/wk   loss-makers   profitable   losses % of net');
  let tn = 0, tl = 0, tw = 0, tp = 0, tsn = 0, tsl = 0;
  for (const r of rows) {
    tn += r.net; tl += r.loss; tw += r.losers; tp += r.winners; tsn += r.shipNet; tsl += r.shipLoss;
    console.log('  ' + r.id.padEnd(14)
      + fmtN(Math.round(r.net)).padStart(12) + fmtN(Math.round(r.loss)).padStart(16)
      + String(r.losers).padStart(14) + String(r.winners).padStart(13)
      + ((r.net > 0 ? (100 * r.loss / r.net).toFixed(0) + '%' : '∞')).padStart(17));
  }
  console.log('  ' + 'TOTAL'.padEnd(14) + fmtN(Math.round(tn)).padStart(12) + fmtN(Math.round(tl)).padStart(16)
    + String(tw).padStart(14) + String(tp).padStart(13)
    + ((tn > 0 ? (100 * tl / tn).toFixed(1) + '%' : '∞')).padStart(17));
  console.log('  shipyards (excluded): net ' + fmtN(Math.round(tsn)) + ' · losses ' + fmtN(Math.round(tsl))
    + '  — per era ' + rows.map(r => fmtN(Math.round(r.shipLoss))).join('/'));
  // §10.47.4 — the state's implied bill for vanilla's must_have infrastructure trio, per era. Bounded
  // by construction (≤ ERA_SUBSIDY_TOL × the trio's cost base); printed so "subsidised" can never
  // silently become "eating the budget" without this line saying so.
  console.log(`  IMPLIED INFRA SUBSIDY (railway/port/power book losses, tol ${(100 * SUBSIDY_TOL).toFixed(0)}%): `
    + rows.map(r => fmtN(Math.round(r.subsBill)) + (r.gdpF > 0 ? ' (' + (100 * r.subsBill / r.gdpF).toFixed(2) + '%)' : '')).join(' / ')
    + '   (£/wk, % of GDP)');
  console.log('\n  losses by vintage — newest rungs are failures, stale tails are the design working');
  console.log('  era            newest £/wk      stale £/wk    subsist £/wk  raw&other £/wk');
  for (const r of rows)
    console.log('  ' + r.id.padEnd(14) + fmtN(Math.round(r.lossBy.newest)).padStart(12)
      + fmtN(Math.round(r.lossBy.stale)).padStart(16) + fmtN(Math.round(r.lossBy.subsistence)).padStart(16)
      + fmtN(Math.round(r.lossBy.raw_other)).padStart(16));
  console.log('\n  biggest loss-makers per era');
  for (const r of rows)
    console.log('  ' + r.id.padEnd(14) + (r.worst.length
      ? r.worst.map(w => `${w.what} ${fmtN(Math.round(w.p))}`).join('  ') : '(none)'));
  {
    // the leading rungs, scored at the final state (TG.current +20%), and the dominant cross-check
    const leads = rows.flatMap(r => r.tgtRows.filter(x => x.role === 'lead'));
    const doms = rows.flatMap(r => r.tgtRows.filter(x => x.role === 'dom'));
    const on = xs => xs.filter(x => Math.abs(x.off) <= 0.08).length;
    const mean = xs => xs.length ? xs.reduce((a, x) => a + Math.abs(x.off), 0) / xs.length : 0;
    const wl = [...leads].sort((a, b) => Math.abs(b.off) - Math.abs(a.off)).slice(0, 6);
    const tgtLbl = r => PROFIT_BAND_ON ? `band ${(100 * BAND_LO).toFixed(0)}–${(100 * BAND_HI).toFixed(0)}%` : r;
    console.log(`\n  LEADING rungs at final recipes (${tgtLbl('target +20%')}): ${on(leads)}/${leads.length} within 8pp, mean |off| ${(100 * mean(leads)).toFixed(1)}pp`);
    if (wl.length) console.log('    worst: ' + wl.map(x => `${x.id} ${(100 * x.p).toFixed(0)}%/${(100 * x.tgt).toFixed(0)}%`).join('  '));
    console.log(`  DOMINANT rungs at final recipes (${tgtLbl('target +5%')}): ${on(doms)}/${doms.length} within 8pp, mean |off| ${(100 * mean(doms)).toFixed(1)}pp`);
    // the manufactured-price averages on the shipped state — always printed (a cheap baseline for the
    // ⚗ ERA_PRICE_AVG ladder), graded against the ladder only when the knob is on
    console.log('  PRICE AVG (weighted, raw-fed/mfg-fed per era): '
      + rows.map((r, i2) => {
          const f = v => v == null ? '—' : v.toFixed(0);
          let s = `${f(r.priceAvgF.raw)}/${f(r.priceAvgF.mfg)}`;
          if (PRICE_AVG_ON) {
            const tR = AVG_LADDER.raw[i2], tM = AVG_LADDER.mfg[i2];
            const bad = (a, t) => t != null && a != null && Math.abs(a - t) > AVG_TOL;
            if (bad(r.priceAvgF.raw, tR) || bad(r.priceAvgF.mfg, tM)) s += '⚠';
          }
          return s;
        }).join(' · ')
      + (PRICE_AVG_ON ? `   (want raw ${AVG_LADDER.raw.map(x => x == null ? '—' : x).join('/')} · mfg ${AVG_LADDER.mfg.map(x => x == null ? '—' : x).join('/')} ±${AVG_TOL})` : ''));
    // the RECIPE MONOTONICITY census on the FINAL recipe book (ERA_RECIPE_MONO's yardstick, printed
    // always): adjacent tier pairs whose later rung is LESS input-efficient at base prices (0.5% grace)
    {
      let pairs = 0; const viol = [];
      for (const i2 of S.IND) {
        if (i2.follows_be === false) continue;
        const ts = [...i2.tiers].sort((a, b) => (a.era ?? 0) - (b.era ?? 0))
          .filter(t2 => Object.keys(t2.inputs || {}).some(g => t2.inputs[g] > 0));
        for (let k2 = 1; k2 < ts.length; k2++) {
          const a = ts[k2 - 1], b = ts[k2];
          const val = t2 => Object.keys(t2.inputs).reduce((s, g) => s + t2.inputs[g] * (S.PRICES[g] || 0), 0);
          const ra = a.output_qty * (S.PRICES[E.tierOut(i2, a)] || 0) / Math.max(1e-9, val(a));
          const rb = b.output_qty * (S.PRICES[E.tierOut(i2, b)] || 0) / Math.max(1e-9, val(b));
          pairs++;
          if (rb < ra / 1.005) viol.push({ id: i2.id, ae: a.era, be: b.era, ra, rb });
        }
      }
      viol.sort((x, y) => (y.ra / Math.max(1e-9, y.rb)) - (x.ra / Math.max(1e-9, x.rb)));
      console.log(`  RECIPE MONOTONICITY (O:I value at base prices, later ≥ earlier; ERA_RECIPE_MONO=${RECIPE_MONO || 'off'}): `
        + (viol.length ? `${viol.length}/${pairs} adjacent pairs violated — worst: `
            + viol.slice(0, 5).map(v => `${v.id} e${v.ae}→e${v.be} ${v.ra.toFixed(2)}→${v.rb.toFixed(2)}`).join('  ')
          : `all ${pairs} adjacent pairs monotone`));
    }
    const illTot = rows.reduce((a, r) => a + r.illF.total, 0), illNet = rows.reduce((a, r) => a + r.illF.net, 0);
    console.log(`  FINAL-STATE ILLOGICALITY (same criterion, recipes final): ${illTot} point(s) (${illNet} excluding ${EXCUSED_LABEL}) — per era `
      + rows.map(r => r.illF.total).join('/'));
    // the FAMILY SPLIT, because the acceptance criterion (§10.11) is per family — loss and inverted
    // must be ~0 while stale-profitable tolerates the teens — and a total cannot show which one moved
    {
      const exN = list => list.filter(id => !PMECON.LADDER_EXCUSED.has(id)).length;
      const fam = k => rows.reduce((a, r) => a + exN(r.illF[k]), 0);
      console.log(`    families (excl ${EXCUSED_LABEL}): loss ${fam('loss')} · stale-profitable ${fam('stale')} · inverted ${fam('inverted')}`
        + '   — worst offenders: ' + (() => {
            const cnt = {};
            for (const r of rows) for (const k of ['loss', 'stale', 'inverted'])
              for (const id of r.illF[k]) if (!PMECON.LADDER_EXCUSED.has(id)) cnt[id] = (cnt[id] || 0) + 1;
            return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${id} ${n}`).join(', ');
          })());
    }
    // ---- the macroscenario, verified where recipes are final (§10.47.2 mapped-economy basis) -------
    let macroResid = 0;
    if (MACRO) {
      const all = rows.flatMap((r, i2) => (r.macroF ? r.macroF.breaches.map(b => ({ era: i2, ...b })) : []));
      const rb = all.filter(b => !b.verify), rbV = all.filter(b => b.verify);
      const rp = rows.flatMap((r, i2) => (r.macroF ? r.macroF.profBad.map(b => ({ era: i2, ...b })) : []));
      const nv = rows.flatMap((r, i2) => (r.macroF ? r.macroF.negVA.map(x => ({ era: i2, ...x })) : []));
      macroResid = rb.length + rp.length;
      const fmtB = b => `e${b.era} ${b.key} ${(100 * b.share).toFixed(2)}%${b.dir > 0 ? ' < ' : ' > '}${(100 * b.bound).toFixed(2)}%${b.kind === 'cat' ? ' (group)' : ''}`;
      console.log(`  MACRO REASONABILITY (${MACRO.id}, §10.47.2 — shares of the MAPPED COMMODITY ECONOMY; 1780 exempt): `
        + (rb.length ? `${rb.length} residual bound breach(es) — ` + rb.map(fmtB).join(' · ')
          : 'all enforceable industry/group bounds hold')
        + (rp.length ? `\n    ⚠ profession bounds: ` + rp.map(b =>
            `e${b.era} ${b.prof} ${(100 * b.share).toFixed(2)}% outside [${100 * b.lo}%, ${100 * b.hi}%]`).join(' · ') : ''));
      if (rbV.length) console.log('    structural, verify-only (V3 prices the pithead, no count can close these — §10.47.2): '
        + rbV.map(fmtB).join(' · '));
      if (nv.length) console.log('    negative gross product (growth can only worsen these — §10.47\'s discussion list): '
        + nv.map(x => `e${x.era} ${x.id} ${(100 * x.share).toFixed(2)}%${x.excused ? '*' : ''}`).join(' · ')
        + (nv.some(x => x.excused) ? '  (*excused)' : ''));
    }
    PASS_SUMMARY = { net: tn, loss: tl, illTot, illNet, macroResid,
      inEraIll: META.reduce((a, m) => a + (m.ill ? m.ill.insolvent.length + m.ill.stale_profitable.length + m.ill.inverted.length : 0), 0) };
  }
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

// ⚗ end of one outer pass — restore the console and print the convergence one-liner for quiet passes
console.log = LOG_REAL;
if (PASS < OUTER && PASS_SUMMARY) console.log(`--- outer pass ${PASS}/${OUTER}: in-era ill ${PASS_SUMMARY.inEraIll}`
  + ` · final ill ${PASS_SUMMARY.illTot} (${PASS_SUMMARY.illNet} excl)`
  + ` · net £${fmtN(Math.round(PASS_SUMMARY.net))} · losses £${fmtN(Math.round(PASS_SUMMARY.loss))}`
  + (PASS_SUMMARY.macroResid != null ? ` · macro ${PASS_SUMMARY.macroResid}` : '') + ` ---`);
}

// ⚗ ERA_DUMP=<path> — write the final state (presets + the solved recipe book) as JSON for offline
// narrative checks (input/output ratios, composition), without --write and without touching config.
if (process.env.ERA_DUMP) {
  const recipes = {};
  for (const i of S.IND) for (const t of i.tiers) recipes[t.key] = {
    ind: i.id, era: t.era, model_only: !!t.model_only, output_qty: t.output_qty,
    out_good: E.tierOut(i, t), inputs: { ...t.inputs },
  };
  writeFileSync(process.env.ERA_DUMP, JSON.stringify({ presets: out, recipes, prices_base: S.PRICES }), 'utf8');
  console.log(`\n(ERA_DUMP: wrote final state to ${process.env.ERA_DUMP})`);
}

if (WRITE) {
  // ⚠ THE VOLUMES MUST GO BACK TOO. This solver re-derived every tier's input recipe against the prices
  // its own order book produces, which are NOT the prices Phase A assumed. Writing the presets without
  // the volumes would ship building counts fitted to one recipe and a config holding another, and the
  // scenario would simply not reproduce when loaded in the UI.
  // ⚠ MOD_CONFIG, same contract as econ_host.mjs and build_era_ladder.mjs: the volumes must go back to
  // the config the MODEL was loaded from, or the solve writes its results into a file it never read.
  const CFG = join(REPO, process.env.MOD_CONFIG || join('config', 'mod_config.json'));
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
  // §10.63 — refuse to write a config the solve already knows is unsolvable (landmine L18).
  assertSolvency('config write');
  writeFileSync(CFG, JSON.stringify(cfg), 'utf8');
  console.log(`\nWROTE ${nv} tier input recipes (re-solved at the REALISED prices) to ${CFG}`);

  const p = artifact('era_presets');
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
