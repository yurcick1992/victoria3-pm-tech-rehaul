// THE era solver. Fits the mod's five-era balance as one interdependent economy, with prices UNLOCKED —
// i.e. every good's price is a real number the model has to justify, not a knob set to 100%.
//
//   node tools/era_solver.mjs             # fit and report
//   node tools/era_solver.mjs --write     # also write the solved volumes back into config/mod_config.json
//
// ---------------------------------------------------------------------------------------------------
// WHY IT IS SHAPED LIKE THIS
//
// Wage share is NOT a free variable: W = base wage × Σ(employees × wage_weight), and both employment
// (vanilla, ~5000 per level) and the base wage (the scenario's SoL) are pinned. Across the config it
// lands at 21-36% of total cost. So what kills an obsolete building is NOT its wage bill — it is the gap
// between its output price falling and its input prices not falling. Obsolescence is price-driven.
//
// That makes the design fully determined, with no circular fitting:
//
//   * a good's price in era 1 (or in the first era its industry exists) is the FREE starting level;
//   * every LATER price is set by the obsolescence rule — P[g][e] is whatever makes the tier from era
//     e−1 earn exactly the "one era stale" target;
//   * the tier AT era e then adapts its INPUT volumes to earn the "current" target at those prices.
//     Inputs are the lever, exactly as the design brief says;
//   * the "two eras stale" target has no free variable left, so it is a CHECK, not a constraint. It
//     cannot be independently satisfied — two eras of the −5% drift compounds to about −11%, not −30% —
//     so the honest thing is to report what it actually lands at.
//
// RAW goods are different: nobody tiers a coal mine, so their price is set by the requirement that
// extraction stays mildly profitable in every era. That removes them from the free-parameter list too.
//
// PLATEAUED industries (food/textile/furniture end at era 4, sail shipyards at era 2) have no successor
// tier to hand off to, so past their last era their price is set by keeping the LAST tier at the current
// target — which makes their good get relatively MORE expensive over time. That is Baumol's cost disease
// falling out of the model rather than being put in, and it is why a plateau does not kill an industry.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEcon, REPO } from './econ_host.mjs';
import { makePmRules } from './era_pm.mjs';

const WRITE = process.argv.includes('--write');
// ⚠ MOD_CONFIG, same contract as econ_host.mjs. This was hardcoded and it MATTERED: econ_host already
// honoured the override, so a redirected run READ the alternate config and WROTE its solved recipes into
// the canonical one — silently, since both files are valid and the report names only the one it wrote.
const CFG = join(REPO, process.env.MOD_CONFIG || join('config', 'mod_config.json'));

// ===================================================================================================
// DESIGN INPUTS
// ===================================================================================================
// The five scenarios. `sol` is the LOWER stratum's standard of living, which drives the base wage via
// FINDINGS F26 and every class's buy package (middle ×1.5, upper ×3, as the placeholder presets do).
// ⚠ WHAT AN ERA YEAR MEANS: by that year a technologically advanced country holds ALL the techs of the
// previous eras and about HALF the techs of this one. It is a median unlock date, not a gate — the techs
// are researchable earlier, and the year may sit past the game's own 1936 end without anything breaking.
// Era 5 is 1945 on that reading and implies nothing about the war.
//
// ⭐ SIX SCENARIOS, AND A SCENARIO'S DOMINANT TIER LAGS ITS LEADING TIER BY ONE.
//
// `era` is the scenario index, NOT the tier era. `lead` is the newest tier the scenario may contain; the
// tier below it is the workhorse that carries most of the levels, and the one below that is dying.
//
//   scenario   leading (minority)   dominant (bulk)   tail (dying)
//   1780             —                    t1              t0
//   1836            t2                    t1              t0  (token)
//   1870            t3                    t2              t1
//   1900            t4                    t3              t2
//   1920            t5                    t4              t3
//   1945             —                    t5              t4
//
// WHY. The old five-scenario ladder made the era-appropriate tier the dominant one on the day it unlocked,
// so the 1836 scenario held tier 1 and nothing else — a 1750 economy wearing an 1836 label. Vanilla's own
// 1836 start runs 46% of the USA's tiered levels at tier 1, 45% at tier 2 and 9% at tier 3: a new method
// arrives as a minority and takes a generation to become the bulk. That lag is the whole change.
//
// ⚠ It is NOT achieved by imposing counts — the solver still sizes every tier by profit. It is achieved by
// the TARGETS: the leading tier is the growth business (+20%), the dominant tier is a profitable workhorse
// being competed down (+5%), the tail is dying (−20%). A dominant tier held at the old −5% would shrink,
// not dominate, so the target ladder had to move with the placement rule.
export const ERAS = [
  // ⚠ ERA 0 IS A SINGLE RUNG, DELIBERATELY. `lead: 0` means the 1780 scenario contains t0 and nothing
  // else. It read `lead: 1` and that was an error of mine: the newest AVAILABLE tier is taken as the
  // scenario's frontier, so t1 became the +20% target and the recipe that gets solved — i.e. 1820
  // technology dominant in 1780, forty years before its own median unlock. It is also where era 0's eight
  // "inverted ladder" faults came from: two rungs that barely coexisted, forced to share a market.
  // With one rung era 0 cannot exhibit a ladder at all, which is the point — it asks one question,
  // "can a pre-industrial economy pay for itself?", and cannot answer any other.
  // ⚠ SoL 3.75, not 6: the brief is a base wage two-thirds of 1836's, and F26 locks wage to SoL
  // (base = exp((SoL−37.43)/10.49)), so 3.747 is what two-thirds MEANS. It follows that 1780 pops also
  // CONSUME less — the two cannot be moved apart without breaking a measured relation.
  // ⚠ SoL 7 with an EXPLICIT wage — the one entry that does not take F26's derived value.
  // The brief is "1836's standard of living minus a point, wages two thirds of 1836's", and those are
  // independent in this model: popSpend() reads POPS/SOL/buy-packages and never reads BASE_WAGE, while
  // BASE_WAGE only ever prices a building's workforce. Nothing sums wages into pop income, so the pair
  // cannot contradict itself here. Deriving the wage from SoL (F26) would have forced SoL 3.75 to get a
  // two-thirds wage, which is a starving population, not a poor one.
  // ⚠ It DOES depart from a measured relation: F26 fitted wage-to-SoL on the real game, so this scenario
  // asserts a pair vanilla would not produce. Fine for a synthetic era premise, NOT fine if a scenario is
  // ever scored against measured game data — say so before doing that.
  { era: 0, year: 1780, sol: 7, base_wage: 0.040317, lead: 0, label: 'pre-industrial, c.1780' },
  { era: 1, year: 1836, sol: 8,  lead: 2, label: 'a reasonably modern country, c.1836' },
  { era: 2, year: 1870, sol: 10, lead: 3, label: 'c.1870' },
  { era: 3, year: 1900, sol: 12, lead: 4, label: 'c.1900' },
  { era: 4, year: 1920, sol: 14, lead: 5, label: 'c.1920' },
  { era: 5, year: 1945, sol: 16, lead: 5, label: 'c.1945' },
];
// FINDINGS F26: the slope is the buy-package curve's own exponent, 1/ln(1.1).
export const baseWage = sol => Math.exp((sol - 37.43) / 10.49);

// Profit targets, as a fraction. "current" = the newest tier a country of this era can build.
// ⚠ THE VALUES MOVED WITH THE PLACEMENT RULE (see ERAS above); the KEYS still mean what they say —
// `current` is the LEADING tier, `minus1` the one below it, `minus2` two below.
// Under the old rule the leading tier was also the dominant one, so `minus1` described a tier already on
// its way out and −5% was right. Now the tier one below the leading one is the WORKHOLD that carries most
// of the market's levels, and a workhorse held at −5% shrinks instead of dominating — the count solver
// sizes by profit, so a negative target on the bulk of the economy contradicts the placement it is meant
// to produce. +5% keeps it worth running and still clearly behind the leader; the tail absorbs the
// obsolescence at −20% instead of −30%, because it is now only two rungs from the frontier, not three.
const TARGET = { current: 0.20, minus1: 0.05, minus2: -0.20 };
// A PLATEAUED industry's last tier is the best that will ever exist, so it cannot be allowed to go
// unprofitable — but holding it at the full `current` target props its own older tiers up with it (the
// price is the only thing they share), and obsolescence stops dead. +5% is the compromise: still worth
// running, no longer a growth business, and it lets the tiers below it keep dying. Fully holding it at
// +20% costs about 20pp of obsolescence in every post-plateau era; this recovers most of that.
const PLATEAU_TARGET = 0.05;
// Shipyards earn a further −30pp on every one of those, because we model NONE of their income from naval
// ship construction — the `country_ship_construction_add` a shipyard grants is real value the market
// price of clippers/steamers does not represent. Without this they are priced as if that were free.
const SHIPYARD_PENALTY = -0.30;
const SHIPYARD_INDUSTRIES = new Set(['shipyard', 'shipyard_steam']);
// Reference (untiered) producers, by the UI's own taxonomy.
const EXTRACTION_CATS = new Set(['mining', 'logging', 'oil', 'rubber', 'fishing_whaling']);
const AGRICULTURE_CATS = new Set(['farms', 'plantations', 'ranching']);
const RAW_TARGET = { extraction: 0.20, agriculture: 0.10 };
// Gold is money, not a priced good the market clears — its producers are left alone.
const SKIP_CATS = new Set(['gold_fields']);

// The FREE starting level: what a manufactured good costs, as % of base, in the first era its industry
// exists. The design brief's "+50% for tier 1" — every later era is derived, not set here.
const START_PRICE = 150;
// The engine's own band. A fit that wants to leave it is telling us something, so we clamp and report.
const PRICE_MIN = 25, PRICE_MAX = 175;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%';

// ===================================================================================================
const { E, S, PMECON } = loadEcon({ quiet: true });
const VANG = (S.VAN.groups) || {};

// --- vanilla building-group helpers (F13 / subsistence), walking the parent chain -------------------
function groupChain(g, field) {
  const seen = new Set();
  while (g && !seen.has(g)) { const r = VANG[g]; if (r && r[field] != null) return r[field]; seen.add(g); g = (VANG[g] || {}).parent; }
  return null;
}
export function urbanizationOf(b) {
  const g = (S.VAN.buildings[b] || {}).group; if (!g) return 0;
  if (groupChain(g, 'subsistence')) return 0;          // subsistence declares no urbanization of its own
  return groupChain(g, 'urbanization') || 0;
}
function catOf(b) {
  const info = S.VAN.buildings[b] || {};
  if (info.unique && !PMECON.GRPCAT[info.group]) return 'unique';
  return PMECON.GRPCAT[info.group] || ('grp_' + (info.group || 'other'));
}

// ===================================================================================================
// ERA-APPROPRIATE PRODUCTION METHODS
// ===================================================================================================
// "Use the top PM available for the tech era, then pick the most profitable of those." Availability comes
// from the PM's own unlocking technology and that technology's vanilla era, both now carried in
// vanilla.js. Vanilla eras map 1:1 onto ours — the brief asks for secondary PMs to unlock "about the same
// as vanilla", and a straight remap is the only reading of that which needs no further invention.
// ⚠ THE RULES COME FROM era_pm.mjs AND ONLY FROM THERE — the local fork this file carried is DELETED
// (2026-08-09). It had already drifted exactly as era_pm's header predicted: it lacked the
// coerced-labour ban (worker_exploitation_* was selectable here and forbidden in the authoritative
// solver) and the ERA_FORBID_PMS veto knob. Do not reimplement any of pmEra/pmGateOk/pmAvailable/
// candidates in this file; extend era_pm.mjs (it takes hooks for reporting needs — see below).
// ---------------------------------------------------------------------------------------------------
// WHAT COUNTRY IS THIS, EXACTLY?
//
// Vanilla gates production methods EIGHT ways and we originally modelled three, which let the chooser
// pick a Japan-only rice method (`pm_herring_meal_farming`, gated on geographic_region_japan) and
// slave-exploitation plantations for a scenario containing zero slaves. A "reasonably modern country" has
// to be stated, not left implicit, or the solver quietly gives itself every special case in the game.
//
// The stance, and it is deliberately narrow:
//   * an `unlocking_*` gate of ANY kind (law, geographic region, company category, power-bloc identity,
//     religion) is NOT satisfied unless we grant it explicitly. We grant nothing — no serfdom, no
//     companies, no power bloc, no region. That drops pm_serfdom, pm_hereditary_bureaucrats, the
//     religious-bureaucrat variants and the Japanese rice methods.
//   * a `disallowing_laws` gate blocks the PM only if we actually HAVE that law. We have exactly one:
//     slavery is banned. So pm_automated_bakery (disallowed only under law_industry_banned) stays
//     available and every slave_exploitation_* PM goes.
//
// One law is enough because it is the only one that changes the answer here. Add to it if a scenario
// ever needs to be a different KIND of country — that is what this set is for.
// THE RULE, per the design brief: **TECHNOLOGY IS THE ONLY GATE THE SOLVER MAY SATISFY.** Every other
// gate a production method can carry — any law (serfdom included, and assumed absent), any power-bloc
// principle or identity, any geographic region, company category or religion — counts as NOT FULFILLED,
// so the PM is not choosable when building a scenario.
//
// This is deliberately stricter than "would a plausible country have it?". Granting even one law starts
// an argument about which country this is, and the solver would keep helping itself to special cases:
// before this rule it had picked a Japan-only rice method and slave-exploitation plantations for a
// scenario containing zero slaves.
//
// ⚠ These PMs are NOT removed from the balance UI — a human can still select any of them and see the
// arithmetic. The restriction is on the SOLVER, which must build a scenario out of what an unexceptional
// country can actually run.
//
// THE ONE EXCEPTION, and why it exists. Vanilla gates production methods in two OPPOSITE directions:
// `unlocking_laws` means "you must hold this law", `disallowing_laws` means "you must NOT hold it".
// Treating both as unfulfilled is not neutral — it is incoherent, and it lands somewhere worse than
// either alternative: it switches automation OFF (every automation PM carries
// `disallowing_laws = { law_industry_banned }`, a law an industrial country would never hold) and slave
// exploitation ON (25 PMGs, including every plantation labour group, have no law-neutral member at all,
// so "hold no laws" leaves the default sitting on `slave_exploitation_*`).
//
// So the country holds exactly TWO laws, both of which a "reasonably modern country" has by definition —
// the set itself LIVES IN era_pm.mjs (`SCENARIO_LAWS`), where the one shared rules implementation reads
// it; this comment block stays here as the design rationale's long form.
// That is the smallest stance that makes the scenario coherent. It buys: no serfdom, no slave
// exploitation, no violent-treatment plantation methods — and working automation.
// `disallowedOnly` records PMs rejected for a `disallowing_laws` clause, for the report (filled by the
// shared rules via the hook). `noUngated` = PMGs where EVERY option is gated, so the strict rule cannot
// be satisfied at all. These are real: the serfdom, urban-clergy and bureaucrat groups have no
// law-neutral member — vanilla makes you pick a flavour. The solver leaves whatever the UI's own default
// (basePm) chose and says so, rather than silently selecting a gated PM and calling it legal.
const disallowedOnly = new Set();
const noUngated = new Set();
// ONE implementation (era_pm.mjs), at last — the mandate, the coerced-labour ban, the veto knob and the
// gate remap all arrive together, and there is no second copy left to drift.
const { candidates } = makePmRules(E, S, { onLawDisallowed: pm => disallowedOnly.add(pm) });
// Hysteresis: a switch must beat the incumbent by more than this, and selection freezes after
// PM_PASSES sweeps. Both exist to stop the flip-flop where switching a PM moves prices enough to make
// switching back look best — a limit cycle the fit would never leave.
const PM_MIN_GAIN = 0.02, PM_PASSES = 3;

// --- the ladder, indexed ---------------------------------------------------------------------------
const LADDER = [];   // {ind, t, era, good, isShip, follows}
for (const i of S.IND) {
  for (const t of i.tiers) {
    LADDER.push({ ind: i, t, era: t.era, good: E.tierOut(i, t),
                  isShip: SHIPYARD_INDUSTRIES.has(i.id), follows: i.follows_be !== false,
                  ladderEnd: i.ladder_end || null });
  }
}
const tiersOfGood = {};                         // good -> [entry] sorted by era
for (const L of LADDER) (tiersOfGood[L.good] = tiersOfGood[L.good] || []).push(L);
for (const g in tiersOfGood) tiersOfGood[g].sort((a, b) => a.era - b.era);

// which reference building is the DOMINANT producer of each raw good, and what target it carries
const rawOwner = {};    // good -> {b, target, cat}
for (const b of E.refBuildings()) {
  const cat = catOf(b);
  if (SKIP_CATS.has(cat)) continue;
  const isExt = EXTRACTION_CATS.has(cat), isAgri = AGRICULTURE_CATS.has(cat);
  if (!isExt && !isAgri) continue;
  if (E.isSubsistenceBuilding(b)) continue;     // subsistence sells at no price it controls
  const out = E.selGoods(E.refSel(b)).out;
  let best = null, bestV = 0;
  for (const g in out) { const v = out[g] * (S.PRICES[g] || 0); if (v > bestV) { bestV = v; best = g; } }
  if (!best) continue;
  const target = isExt ? RAW_TARGET.extraction : RAW_TARGET.agriculture;
  // dominant = the producer that makes the most of it, so one good has exactly one price-setter
  if (!rawOwner[best] || bestV > rawOwner[best].v) rawOwner[best] = { b, target, cat, v: bestV };
}

// ===================================================================================================
// SECONDARY-PM GOODS — the third price rule, and the one whose absence broke everything else.
// ===================================================================================================
// Some goods are made by no tier and no extraction building: hardwood, liquor, porcelain, the two luxury
// goods, tanks, aeroplanes, radios, services. They come out of SECONDARY production methods, mostly as
// CONVERSIONS that consume the building's own main output (pm_increased_hardwood turns 40 wood into 20
// hardwood; the tank line turns automobiles into tanks).
//
// Leaving them unpriced is not neutral, it is actively wrong: they sit at 100% of base while every other
// price moves, so the PM chooser always takes the conversion, and the source good's price collapses
// trying to make the building hit its profit target on what is left. That is exactly what pinned wood to
// the engine's 25% floor and made the logging camp read +89% when it was being solved for +20%.
//
// The rule: price the good so the PM that makes it earns the SAME margin its building is targeted at, on
// the resources that PM actually consumes — including the negative output of the source good, which is a
// real cost. For a pure conversion this reduces to something obvious and checkable: 40 wood -> 20
// hardwood at a +20% target gives hardwood = 1.2 x wood, per pound of input.
const secondaryOwner = {};   // good -> {pm, q, target}
{
  const pmgOf = {};                    // pm -> pmg
  for (const pg in S.VAN.pmgs) (S.VAN.pmgs[pg].pms || []).forEach(p => { pmgOf[p] = pg; });
  const bldOfPmg = {};                 // pmg -> a building that has it
  for (const b in S.VAN.buildings) for (const pg of (S.VAN.buildings[b].pmgs || [])) if (!bldOfPmg[pg]) bldOfPmg[pg] = b;
  for (const pm in S.VAN.pms) {
    const r = S.VAN.pms[pm];
    for (const g in (r.out || {})) {
      if (!(r.out[g] > 0)) continue;
      if (tiersOfGood[g] || rawOwner[g]) continue;                 // already has a rule
      const v = r.out[g] * (S.PRICES[g] || 0);
      if (!(v > 0)) continue;
      if (secondaryOwner[g] && secondaryOwner[g].v >= v) continue; // keep the dominant producer
      const b = bldOfPmg[pmgOf[pm]];
      const cat = b ? catOf(b) : null;
      const target = EXTRACTION_CATS.has(cat) ? RAW_TARGET.extraction
                   : AGRICULTURE_CATS.has(cat) ? RAW_TARGET.agriculture
                   : TARGET.current;
      secondaryOwner[g] = { pm, q: r.out[g], v, target, bld: b };
    }
  }
}
// Price for a secondary good at era eIx: the PM's own marginal economics, at its building's target.
function priceForSecondary(good, eIx) {
  const own = secondaryOwner[good]; if (!own) return null;
  const r = S.VAN.pms[own.pm] || {};
  setEraWage(eIx);
  let cost = 0, otherRev = 0;
  for (const h in (r.in || {})) cost += r.in[h] * (S.PRICES[h] || 0) * (P[eIx][h] / 100);
  for (const h in (r.out || {})) {
    if (h === good) continue;
    const v = r.out[h] * (S.PRICES[h] || 0) * (P[eIx][h] / 100);
    if (r.out[h] < 0) cost += -v; else otherRev += v;               // a negative output IS a cost
  }
  cost += E.wageUnits(r.emp || {}) * S.BASE_WAGE;                    // may be negative (automation)
  const need = (1 + own.target) * cost - otherRev;
  const perUnit = own.q * (S.PRICES[good] || 0);
  if (!(perUnit > 0) || !(cost > 0)) return null;
  return 100 * need / perUnit;
}

// target profit for a tier evaluated `age` eras after its own
function tierTarget(L, age) {
  const base = age <= 0 ? TARGET.current : (age === 1 ? TARGET.minus1 : TARGET.minus2);
  return base + (L.isShip ? SHIPYARD_PENALTY : 0);
}

// ===================================================================================================
// PHASE A — the balance fit: a price per good per era, and input volumes per tier.
// ===================================================================================================
// P[era][good] = % of base. Seeded flat and then driven by the rules above.
const P = ERAS.map(() => { const o = {}; for (const g in S.PRICES) o[g] = 100; return o; });

function setEraPrices(eIx) { for (const g in S.PRICES) S.thresholds[g] = P[eIx][g]; }
function setEraWage(eIx) { S.BASE_WAGE = (ERAS[eIx].base_wage != null ? ERAS[eIx].base_wage : baseWage(ERAS[eIx].sol)); }

// value of a goods map at era eIx's prices
const valAt = (map, eIx) => { let v = 0; for (const g in map) v += map[g] * (S.PRICES[g] || 0) * (P[eIx][g] / 100); return v; };

// Solve one tier's INPUT volumes so it earns `target` at era eIx's prices. Output is never touched: the
// ×1.5 ladder is the mod's structure. Returns the resulting input share of total cost, or null if the
// target is unreachable because wages alone already exceed the allowed cost.
function solveInputs(L, eIx, target) {
  setEraPrices(eIx); setEraWage(eIx);
  const O = E.outputValue(L.ind, L.t, true);
  const W = E.wageCost(L.t);
  const secI = E.selInVal(L.t._sec, true);
  const allowed = O / (1 + target);            // total cost the target permits
  const wantI = allowed - W - secI;            // ...of which the main recipe may spend
  const haveI = valAt(L.t.inputs, eIx);
  if (!(haveI > 0) || !(O > 0)) return null;
  if (wantI <= 0) return { infeasible: true, wageShare: 1, W, O, allowed };
  const scale = wantI / haveI;
  for (const g of Object.keys(L.t.inputs)) L.t.inputs[g] = Math.max(0.1, Math.round(L.t.inputs[g] * scale * 10) / 10);
  return { infeasible: false, wageShare: W / allowed, W, O, allowed };
}

// profit of a tier at era eIx, at that era's prices, wage AND that era's PM selections
function tierProfit(L, eIx) {
  setEraPrices(eIx); setEraWage(eIx); restorePMs(eIx);
  const I = E.inputValue(L.t, true), W = E.wageCost(L.t), C = I + W;
  return C > 0 ? (E.outputValue(L.ind, L.t, true) - C) / C : null;
}
// profit of a REFERENCE building at era eIx
function refProfit(b, eIx) {
  setEraPrices(eIx); setEraWage(eIx); restorePMs(eIx);
  const e = E.refEcon(b);
  return (e && e.tp != null) ? e.tp / 100 : null;
}

// The price a good must carry at era eIx so that `L` (a tier from an earlier era) earns `target`.
//   O_main·base·P/100 + secondary revenue = (1+target)·(I + W)
//     =>  P = 100·[ (1+target)·(I+W) − secondary revenue ] / (O_main·base)
// ⚠ The secondary revenue must come out at ITS OWN goods' era prices and be subtracted, not folded into
// the coefficient of P. Adding it to `outBase` silently prices a car plant's tanks as if they were
// automobiles, which made automotive's ladder run backwards (+36% two eras after it should have died).
function priceForTierTarget(L, eIx, target) {
  setEraPrices(eIx); setEraWage(eIx);
  const I = E.inputValue(L.t, true), W = E.wageCost(L.t);
  const secRev = E.selOutVal(L.t._sec, true);          // at era prices, per good
  const perUnit = L.t.output_qty * (S.PRICES[L.good] || 0);
  if (!(perUnit > 0)) return null;
  return 100 * ((1 + target) * (I + W) - secRev) / perUnit;
}
// The price a RAW good must carry at era eIx so its dominant producer earns its target.
function priceForRawTarget(good, eIx) {
  const own = rawOwner[good]; if (!own) return null;
  setEraPrices(eIx); setEraWage(eIx);
  const g = E.selGoods(E.refSel(own.b));
  const W = E.wageUnits(E.selEmp(E.refSel(own.b))) * E.refBaseWage(own.b);
  const I = valAt(g.in, eIx);
  // revenue from this building's OTHER outputs is held at their current price; only `good` moves
  let otherOut = 0;
  for (const k in g.out) if (k !== good) otherOut += g.out[k] * (S.PRICES[k] || 0) * (P[eIx][k] / 100);
  const need = (1 + own.target) * (I + W) - otherOut;
  const perUnit = g.out[good] * (S.PRICES[good] || 0);
  if (!(perUnit > 0)) return null;
  return 100 * need / perUnit;
}

// --- era-appropriate PM selection, by profit, with hysteresis --------------------------------------
// Chosen per ERA, because availability and profitability both move with the era: automation only pays
// once labour is dear relative to the engines and electricity it consumes, which is exactly the
// behaviour the design wants to emerge rather than be asserted.
// ⭐ WHICH SCENARIO A TIER IS SOLVED IN: THE ONE WHERE IT IS DOMINANT, i.e. scenario N holds tier N as its
// workhorse. That is one scenario per tier and one tier per scenario, so every rung is solved exactly once
// and none is orphaned.
//
// ⚠ IT USED TO BE `era - 1` — the scenario where the tier LEADS — and that broke twice. First on era 0:
// a t0 tier gave index -1 and killed the solver outright. Then on the lead sequence [0,2,3,4,5,5], where
// `lead` never equals 1, so TIER 1 LED NOWHERE: it was solved against the 1780 market that no longer
// contains it, and read at 1836 prices it came out ~100% over target. Era 1's 68pp mean miss was that.
//
// ⚠⚠ AND SOLVING THE LEADING TIER WAS BACKWARDS ANYWAY. It tunes the token minority to +20% and lets the
// workhorse float. Tuning the WORKHORSE to a modest +5% instead lets the ladder emerge from the output
// ladder rather than being asserted: the leading tier is the same good at the same price with better
// technology and a flat wage bill, so it floats ABOVE on its own, and the tail floats below as the price
// path deflates under it. Three separate target numbers stop fighting each other.
const eIxOf = e => Math.max(0, Math.min(ERAS.length - 1, e));
const PMSEL = ERAS.map(() => ({ tiers: {}, refs: {} }));   // era -> {tiers:{key:{pmg:pm}}, refs:{b:{pmg:pm}}}

function chooseEraPMs(eIx) {
  const era = ERAS[eIx].era;
  setEraPrices(eIx); setEraWage(eIx);
  for (let pass = 0; pass < PM_PASSES; pass++) {
    // our tier buildings — only tiers that exist by this era
    for (const L of LADDER) {
      if (L.era > era) continue;
      const present = new Set([L.t.pm_key, ...Object.values(L.t._sec || {})]);
      for (const pmg of L.ind.secondary_pmgs) {
        const cand = candidates(pmg, era, present);
        if (!cand.length) { noUngated.add(pmg); continue; }   // every option gated — see the report below
        if (cand.length < 2) { L.t._sec[pmg] = cand[0]; continue; }
        // The incumbent comes from basePm(), which only knows about power-bloc gating — so it can be a
        // PM this country cannot legally run. Evict it before comparing, or nothing will ever beat it.
        if (!cand.includes(L.t._sec[pmg])) L.t._sec[pmg] = cand[0];
        const cur = L.t._sec[pmg];
        let best = cur, bestP = profitOfTier(L);
        for (const pm of cand) {
          if (pm === cur) continue;
          L.t._sec[pmg] = pm;
          const p = profitOfTier(L);
          if (p > bestP + PM_MIN_GAIN) { bestP = p; best = pm; }
        }
        L.t._sec[pmg] = best;
      }
    }
    // reference buildings
    for (const b of E.refBuildings()) {
      const sel = E.refSel(b), info = S.VAN.buildings[b] || {};
      const present = new Set(Object.values(sel));
      for (const pmg of (info.pmgs || [])) {
        const cand = candidates(pmg, era, present);
        if (!cand.length) { noUngated.add(pmg); continue; }   // every option gated — see the report below
        if (cand.length < 2) { sel[pmg] = cand[0]; continue; }
        if (!cand.includes(sel[pmg])) sel[pmg] = cand[0];   // evict an illegal incumbent (see above)
        const cur = sel[pmg];
        let best = cur, bestP = profitOfRef(b);
        for (const pm of cand) {
          if (pm === cur) continue;
          sel[pmg] = pm;
          const p = profitOfRef(b);
          if (p > bestP + PM_MIN_GAIN) { bestP = p; best = pm; }
        }
        sel[pmg] = best;
      }
    }
  }
  // SNAPSHOT. ⚠ Tiers ABOVE this era are skipped by the chooser above (they exist only as the era+1
  // probe), so their `_sec` still holds whatever the LAST era to run left in it — `_sec` is shared
  // mutable state and the eras are looped 0→4 inside every iteration. Capturing it unchanged leaked
  // selections across eras: the 1836 preset ended up running `pm_assembly_lines_building_furniture_manufactory`,
  // which unlocks on `conveyors` in tech era 4. Reset them to base instead — a probe is there to show the
  // next tier's arithmetic, not to run methods its era cannot have.
  for (const L of LADDER) {
    PMSEL[eIx].tiers[L.t.key] = (L.era > era) ? E.initSel(L.ind.secondary_pmgs) : { ...L.t._sec };
  }
  for (const b of E.refBuildings()) PMSEL[eIx].refs[b] = { ...E.refSel(b) };
}
// THE NEGATIVE-GOODS INVARIANT (tools/lint_negative_goods.awk enforces the same thing on the built mod).
// Reduction PMs legitimately emit negative goods_output — the hardwood PM takes 40 wood off the logging
// camp's own output, the tank line takes 20 automobiles off the car plant. A PM choice is only LEGAL if
// the active main output still covers the reduction. Choosing on profit alone picks illegal combinations
// that look wonderful precisely because they consume more than the building makes: simple forestry (+30
// wood) plus increased hardwood (−40 wood) is −10 wood a level, and the fit then has to double the wood
// price to pay for it. Returns false for any selection that drives a building total below zero.
function goodsOk(map) { for (const k in map) if (map[k] < -1e-9) return false; return true; }
function tierLegal(L) { const g = E.tierGoodsIO(L.ind, L.t); return goodsOk(g.in) && goodsOk(g.out); }
function refLegal(b) { const g = E.selGoods(E.refSel(b)); return goodsOk(g.in) && goodsOk(g.out); }

function profitOfTier(L) {
  if (!tierLegal(L)) return -Infinity;
  const I = E.inputValue(L.t, true), W = E.wageCost(L.t), C = I + W;
  return C > 0 ? (E.outputValue(L.ind, L.t, true) - C) / C : -1;
}
function profitOfRef(b) {
  if (!refLegal(b)) return -Infinity;
  const e = E.refEcon(b); return (e && e.tp != null) ? e.tp / 100 : -1;
}
function restorePMs(eIx) {
  for (const L of LADDER) if (PMSEL[eIx].tiers[L.t.key]) L.t._sec = { ...PMSEL[eIx].tiers[L.t.key] };
  for (const b in PMSEL[eIx].refs) S.REFSEL[b] = { ...PMSEL[eIx].refs[b] };
}

// --- the fit ---------------------------------------------------------------------------------------
// Alternates: pick PMs at the current prices -> re-derive prices -> re-solve inputs. The PM step is
// frozen after PM_FREEZE_AFTER outer iterations so the discrete choices cannot keep chasing the
// continuous ones (the limit cycle the brief warned about).
const ITERS = 120, PM_FREEZE_AFTER = 60;
let lastReport = null;
let converge = null;      // max |relative price move| in the final iteration — the fit's own residual
let pmChurn = [];         // PM switches per iteration, to see the discrete choices settle
for (let iter = 0; iter < ITERS; iter++) {
  const before = P.map(o => ({ ...o }));
  const selBefore = JSON.stringify(PMSEL);
  // Full steps to get in the neighbourhood, then progressively smaller ones. The tail matters: the price
  // rules are mutually recursive down the goods graph (hardwood follows wood follows the logging camp's
  // tools bill), so the last few percent only settle with a lot of small steps.
  const damp = iter < 3 ? 1.0 : (iter < PM_FREEZE_AFTER ? 0.5 : 0.25);
  if (iter < PM_FREEZE_AFTER) for (let e = 0; e < ERAS.length; e++) chooseEraPMs(e);

  // 1) RAW goods: price follows the extraction / agriculture profit target, in every era independently.
  // ⚠ EXACTLY ONE RULE PER GOOD PER ERA. `dye` is both a plantation good and, once synthetics exists, a
  // manufactured one. Letting both rules run left it converging to a BLEND of the two targets — a stable
  // fixed point that satisfies neither, and it was why synthetics' ladder read −30% where −5% was asked.
  // Once an industry exists for a good, the industry owns its price; the plantation is then simply
  // whatever it is (synthetic dye really did destroy the natural dye trade).
  for (let e = 0; e < ERAS.length; e++) {
    restorePMs(e);
    for (const good in rawOwner) {
      if (tiersOfGood[good] && (e + 1) >= tiersOfGood[good][0].era) continue;
      const want = priceForRawTarget(good, e);
      if (want == null || !isFinite(want)) continue;
      P[e][good] = clamp(P[e][good] * (1 - damp) + want * damp, PRICE_MIN, PRICE_MAX);
    }
  }
  // 2) MANUFACTURED goods: era-by-era, forward.
  for (const good in tiersOfGood) {
    const list = tiersOfGood[good];
    // ports/railways are on vanilla economics; their goods are priced to keep the era's OWN tier at the
    // current target instead of driving an obsolescence ladder they were never part of.
    const offLadder = !list[0].follows;
    const firstEra = list[0].era;
    const lastEra = list[list.length - 1].era;
    const end = list[0].ladderEnd;
    for (let e = 0; e < ERAS.length; e++) {
      const era = e + 1;
      if (era < firstEra) { P[e][good] = P[Math.max(0, firstEra - 1)][good]; continue; }
      if (era === firstEra) { P[e][good] = START_PRICE; continue; }   // the free starting level
      restorePMs(e);
      let want = null;
      if (offLadder) {
        const cur = [...list].filter(L => L.era <= era).sort((a, b) => b.era - a.era)[0];
        want = cur ? priceForTierTarget(cur, e, TARGET.current) : null;
      } else if (era > lastEra && end === 'plateau') {
        // PLATEAU: no successor exists, so the last tier stays state of the art and keeps the CURRENT
        // target. Its good therefore gets relatively dearer as wages rise — Baumol, falling out.
        const cur = list[list.length - 1];
        want = priceForTierTarget(cur, e, PLATEAU_TARGET + (cur.isShip ? SHIPYARD_PENALTY : 0));
      } else {
        // the tier that was current one era ago must now earn the "one era stale" target
        const prev = [...list].filter(L => L.era < era).sort((a, b) => b.era - a.era)[0];
        if (prev) want = priceForTierTarget(prev, e, tierTarget(prev, era - prev.era));
      }
      if (want == null || !isFinite(want)) continue;
      P[e][good] = clamp(P[e][good] * (1 - damp) + want * damp, PRICE_MIN, PRICE_MAX);
    }
  }
  // 3) SECONDARY-PM goods, last: hardwood follows wood, porcelain follows glass, tanks follow
  //    automobiles — so they have to be priced after both the raw and the manufactured passes.
  for (let e = 0; e < ERAS.length; e++) {
    for (const good in secondaryOwner) {
      const want = priceForSecondary(good, e);
      if (want == null || !isFinite(want)) continue;
      P[e][good] = clamp(P[e][good] * (1 - damp) + want * damp, PRICE_MIN, PRICE_MAX);
    }
  }
  // 4) every tier re-solves its inputs for the "current" target in its OWN era
  lastReport = [];
  for (const L of LADDER) {
    if (!L.follows) continue;                  // ports/railways stay on vanilla economics
    restorePMs(eIxOf(L.era));
    const r = solveInputs(L, eIxOf(L.era), tierTarget(L, 1));   // 1 = the DOMINANT target (+5%)
    lastReport.push({ L, r });
  }
  // residual: the largest relative price move this iteration, and where it was
  let mx = 0, mxWhere = '';
  for (let e = 0; e < ERAS.length; e++) for (const g in P[e]) {
    const d = Math.abs(P[e][g] - before[e][g]) / Math.max(1, before[e][g]);
    if (d > mx) { mx = d; mxWhere = `${g} e${e + 1}`; }
  }
  converge = { iter, mx, mxWhere };
  if (JSON.stringify(PMSEL) !== selBefore) pmChurn.push(iter);
}

// ===================================================================================================
// REPORT
// ===================================================================================================
const W = (s, n) => String(s).padEnd(n);
console.log('\n=========== PHASE A — balance fit (prices unlocked, volumes solved) ===========\n');
console.log('ERA          ' + ERAS.map(x => W('e' + x.era, 9)).join(''));
console.log('year         ' + ERAS.map(x => W(x.year, 9)).join(''));
console.log('lower SoL    ' + ERAS.map(x => W(x.sol, 9)).join(''));
console.log('base wage/wk ' + ERAS.map(x => W(baseWage(x.sol).toFixed(4), 9)).join(''));

console.log('\n--- PRICE PATH (% of base; "-" = no producer yet) ---');
const shown = new Set([...Object.keys(tiersOfGood), ...Object.keys(rawOwner), ...Object.keys(secondaryOwner)]);
console.log(W('good', 17) + ERAS.map(x => W('e' + x.era, 8)).join('') + ' kind');
for (const g of [...shown].sort()) {
  const kind = tiersOfGood[g] ? 'manufactured'
             : rawOwner[g] ? (EXTRACTION_CATS.has(rawOwner[g].cat) ? 'raw/extract' : 'raw/agri')
             : 'secondary PM (' + secondaryOwner[g].pm.replace(/^pm_/, '') + ')';
  const first = tiersOfGood[g] ? tiersOfGood[g][0].era : 1;
  console.log(W(g, 17) + ERAS.map((x, e) => W(e + 1 < first ? '-' : Math.round(P[e][g]), 8)).join('') + ' ' + kind);
}

console.log('\n--- PROFIT BY TIER × ERA (target: current ' + pct(TARGET.current) + ', −1 era ' + pct(TARGET.minus1)
  + ', −2 eras ' + pct(TARGET.minus2) + '; shipyards ' + pct(SHIPYARD_PENALTY) + ' on all three) ---');
console.log(W('industry', 15) + W('tier', 5) + ERAS.map(x => W('e' + x.era, 9)).join('') + ' wage%  inputs');
const misses = [];
for (const i of S.IND) {
  if (i.follows_be === false) continue;
  for (const t of i.tiers) {
    const L = LADDER.find(x => x.t === t);
    // A tier's own era is `current`; +1 and +2 eras have targets. THREE OR MORE eras stale has no spec —
    // it is simply "long dead" — so it is shown but never counted as a miss.
    const lastEra = Math.max(...i.tiers.map(x => x.era));
    const cells = ERAS.map((x, e) => {
      if (x.era < L.era) return W('.', 9);
      const p = tierProfit(L, e);
      const age = x.era - L.era;
      // a PLATEAUED industry's last tier stays state of the art, so past its era it is graded against
      // the plateau target rather than against a staleness it cannot escape
      const isPlateauTop = i.ladder_end === 'plateau' && L.era === lastEra;
      const graded = (age <= 2) && !isPlateauTop;
      const tgt = isPlateauTop ? (age === 0 ? tierTarget(L, 0) : PLATEAU_TARGET + (L.isShip ? SHIPYARD_PENALTY : 0))
                               : tierTarget(L, age);
      const off = p - tgt;
      const bad = (graded || (i.ladder_end === 'plateau' && L.era === lastEra)) && Math.abs(off) > 0.08;
      if (bad) misses.push({ id: i.id, era: L.era, at: x.era, age, got: p, tgt });
      return W((p >= 0 ? '+' : '') + (p * 100).toFixed(0) + '%' + (bad ? '!' : ' '), 9);
    });
    setEraPrices(eIxOf(L.era)); setEraWage(eIxOf(L.era)); restorePMs(eIxOf(L.era));
    const Iv = E.inputValue(t, true), Wv = E.wageCost(t);
    const wsh = (Iv + Wv) > 0 ? Wv / (Iv + Wv) : 1;
    const ins = Object.entries(t.inputs).map(([g, q]) => `${g} ${q}`).join(', ');
    console.log(W(i.id, 15) + W('e' + L.era + (t.model_only ? 'M' : ''), 5) + cells.join('')
      + W(Math.round(wsh * 100) + '%', 7) + ins.slice(0, 46));
  }
}

console.log('\n--- RAW PRODUCERS (target: extraction/logging ' + pct(RAW_TARGET.extraction)
  + ', agriculture ' + pct(RAW_TARGET.agriculture) + ') ---');
console.log(W('building', 26) + W('good', 15) + ERAS.map(x => W('e' + x.era, 8)).join('') + ' cat');
for (const g of Object.keys(rawOwner).sort()) {
  const o = rawOwner[g];
  // a good an INDUSTRY also makes stops being priced for its plantation once that industry exists
  const taken = tiersOfGood[g] ? tiersOfGood[g][0].era : null;
  console.log(W(o.b.replace(/^building_/, ''), 26) + W(g, 15)
    + ERAS.map((x, e) => { const p = refProfit(o.b, e); return W(p == null ? '-' : pct(p), 8); }).join('') + ' ' + o.cat
    + (taken ? `  (price taken over by the ${g} industry from e${taken} — not a miss)` : ''));
}

// --- the honest bit: where the fit does not reach its target ---
console.log('\n--- MISSES (|actual − target| > 8pp) ---');
if (!misses.length) console.log('  none');
else {
  const byAge = { 0: [], 1: [], 2: [] };
  for (const m of misses) byAge[m.age].push(m);
  for (const age of [0, 1, 2]) {
    if (!byAge[age].length) continue;
    console.log(`  ${age === 0 ? 'CURRENT era' : age + ' era(s) stale'} — ${byAge[age].length} case(s):`);
    for (const m of byAge[age].slice(0, 14))
      console.log(`     ${W(m.id, 15)} tier e${m.era} evaluated at e${m.at}: ${pct(m.got)} vs target ${pct(m.tgt)}`);
    if (byAge[age].length > 14) console.log(`     …and ${byAge[age].length - 14} more`);
  }
}

// --- infeasible tiers: wages alone exceed what the target allows -----------------------------------
const infeasible = lastReport.filter(x => x.r && x.r.infeasible);
console.log('\n--- INFEASIBLE (wages alone exceed the cost the target allows — inputs would have to be negative) ---');
if (!infeasible.length) console.log('  none');
else for (const x of infeasible)
  console.log(`  ${W(x.L.ind.id, 15)} e${x.L.era}  wages £${x.r.W.toFixed(0)} > allowed cost £${x.r.allowed.toFixed(0)}`);

// --- price-band violations -------------------------------------------------------------------------
const oob = [];
for (const g of shown) for (let e = 0; e < ERAS.length; e++) {
  if (P[e][g] <= PRICE_MIN + 0.5 || P[e][g] >= PRICE_MAX - 0.5) oob.push(`${g} e${e + 1} = ${Math.round(P[e][g])}`);
}
console.log('\n--- PRICES PINNED AT THE ENGINE BAND (25-175%) ---');
console.log(oob.length ? '  ' + oob.join('\n  ') : '  none');

// --- did it actually converge? A fit that is still moving is not a fit, it is a snapshot. ------------
console.log('\n--- CONVERGENCE ---');
console.log(`  largest price move in the final iteration: ${(converge.mx * 100).toFixed(3)}%  (${converge.mxWhere})`);
const lastChurn = pmChurn.length ? pmChurn[pmChurn.length - 1] : -1;
console.log(`  PM selections last changed at iteration ${lastChurn} of ${ITERS} (frozen after ${PM_FREEZE_AFTER})`
  + (lastChurn >= PM_FREEZE_AFTER ? '  ⚠ STILL CHURNING AT FREEZE — the discrete choices had not settled' : ''));

// --- what the strict gating rule excluded ----------------------------------------------------------
console.log('\n--- PMs THE SOLVER MAY NOT USE (technology is the only gate it can satisfy) ---');
{
  const byReason = {};
  for (const pm in S.VAN.pms) {
    const r = S.VAN.pms[pm];
    const why = r.regions ? 'geographic region' : r.company ? 'company category' : r.identity ? 'power-bloc identity'
              : (r.religion || r.noreligion) ? 'religion' : r.laws ? 'requires a law' : r.nolaws ? 'has a disallowing_laws clause'
              : E.pmGated(pm) ? 'power-bloc principle' : null;
    if (why) (byReason[why] = byReason[why] || []).push(pm);
  }
  for (const why of Object.keys(byReason).sort()) {
    const list = byReason[why];
    console.log(`  ${W(why, 32)} ${String(list.length).padStart(3)} PM(s)   e.g. ${list.slice(0, 3).map(p => p.replace(/^pm_/, '')).join(', ')}`);
  }
  console.log(`  (all remain selectable BY HAND in the balance UI — the restriction is on the solver only)`);
  if (noUngated.size) {
    console.log(`\n  ⚠ ${noUngated.size} PMG(s) have NO ungated option — vanilla makes you pick a law flavour, so the`);
    console.log(`    strict rule is unsatisfiable there and the UI's own default stands. None of these carry`);
    console.log(`    market goods except home workshops. PMGs: ${[...noUngated].map(x => x.replace(/^pmg_/, '')).join(', ')}`);
  }
  const autoLost = [...disallowedOnly].filter(p => /automat|assembly_line|mechanized|power_loom|steam_donkey|watertube|bottle_blower/.test(p));
  if (autoLost.length) {
    console.log(`\n  ⚠ ${autoLost.length} AUTOMATION PM(s) are excluded ONLY by a disallowing_laws clause`);
    console.log(`    (mostly law_industry_banned — a law an industrial country would never hold). The design brief`);
    console.log(`    asks for automation to be choosable, so this is the one place the strict rule bites something`);
    console.log(`    the design wants: ${autoLost.slice(0, 6).map(p => p.replace(/^pm_/, '')).join(', ')}${autoLost.length > 6 ? ', …' : ''}`);
  }
}

// --- which secondary PMs each era actually runs, where the era changes the answer -------------------
console.log('\n--- SECONDARY PM CHOICES THAT MOVE WITH THE ERA (ours) ---');
for (const L of LADDER) {
  const rows = [];
  for (const pmg of L.ind.secondary_pmgs) {
    const seq = ERAS.map((x, e) => (x.era < L.era ? '-' : ((PMSEL[e].tiers[L.t.key] || {})[pmg] || '?').replace(/^pm_/, '')));
    const real = seq.filter(s => s !== '-');
    if (new Set(real).size > 1) rows.push(`     ${W(pmg.replace(/^pmg_/, ''), 34)} ${seq.join(' -> ')}`);
  }
  if (rows.length) { console.log(`  ${L.ind.id} e${L.era}:`); rows.forEach(r => console.log(r)); }
}

if (WRITE) {
  const cfg = JSON.parse(readFileSync(CFG, 'utf8'));
  const byKey = {}; for (const L of LADDER) byKey[L.t.key] = L.t;
  let n = 0;
  for (const ind of cfg.industries) for (const t of ind.tiers) {
    const solved = byKey[t.key]; if (!solved || ind.follows_be === false) continue;
    t.inputs = { ...solved.inputs };
    // `target_be` is NO LONGER A DESIGN INPUT. The design target is now a PROFIT at that era's solved
    // prices, which the base-price break-even cannot express. We restate it to whatever the solved
    // volumes actually imply under the LINTER's own (legacy wage_pct) model, which demotes
    // lint_profitability.awk from a design check to a DRIFT GUARD: it can no longer tell us the balance
    // is wrong, but it still catches an accidental hand-edit of an emitted recipe. Replacing it with a
    // check against the era targets is real work and is deliberately not done here.
    const outGood = t.output_good || ind.output_good;
    const Obase = t.output_qty * (S.PRICES[outGood] || 0);
    let Ibase = 0; for (const g in t.inputs) Ibase += t.inputs[g] * (S.PRICES[g] || 0);
    const wp = t.wage_pct != null ? +t.wage_pct : 0.25;
    if (Obase > 0) t.target_be = Math.round(Ibase / ((1 - wp) * Obase) * 100);
    n++;
  }
  writeFileSync(CFG, JSON.stringify(cfg), 'utf8');
  console.log(`\nWROTE ${n} tier input recipes (+ restated target_be as a drift guard) to ${CFG}`);

  // The solved price path and per-era PM selections, for the scenario builder and for anyone who wants
  // to see the fit without re-running it. This is a GENERATED artifact but it is COMMITTED, because it
  // is the balance design: a scenario preset is only interpretable next to the prices it assumes.
  const out = {
    _comment: 'GENERATED by tools/era_solver.mjs. The mod\'s five-era balance: the price every good carries '
      + 'in each era (% of base), and the production methods a country of that era actually runs. Prices are '
      + 'SOLVED, not chosen: raw goods from the extraction/agriculture profit target, manufactured goods from '
      + 'the obsolescence rule, secondary-PM goods from their own marginal economics. See the file header of '
      + 'tools/era_solver.mjs for why the system is determined.',
    eras: ERAS.map(x => ({ ...x, base_wage: +(x.base_wage != null ? x.base_wage : baseWage(x.sol)).toFixed(6) })),
    targets: { current: TARGET.current, minus1: TARGET.minus1, minus2: TARGET.minus2,
               plateau: PLATEAU_TARGET, shipyard_penalty: SHIPYARD_PENALTY,
               extraction: RAW_TARGET.extraction, agriculture: RAW_TARGET.agriculture },
    prices: ERAS.map((x, e) => { const o = {}; for (const g of [...shown].sort()) o[g] = Math.round(P[e][g] * 10) / 10; return o; }),
    pms: PMSEL.map(sel => ({ tiers: sel.tiers, refs: sel.refs })),
  };
  const pricePath = join(REPO, 'config', 'era_prices.json');
  writeFileSync(pricePath, JSON.stringify(out, null, 1), 'utf8');
  console.log(`WROTE the solved price path + per-era PM selections to ${pricePath}`);
} else {
  console.log('\n(report only — pass --write to save the solved input volumes + config/era_prices.json)');
}

export { P, LADDER, tiersOfGood, rawOwner, tierTarget, catOf, EXTRACTION_CATS, AGRICULTURE_CATS };
