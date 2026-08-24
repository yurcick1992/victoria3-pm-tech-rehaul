// THE INVERSE SOLVE — EXPERIMENTAL PROTOTYPE (user-directed, 2026-08-23; BALANCE_FRAMEWORK §10.65).
//
//   node tools/era_inverse.mjs             # report only (never touches config/mod_config.json)
//   node tools/era_inverse.mjs --write     # write config/era_inverse.json (a separate artifact)
//
// The standing solver (era_scenarios.mjs) treats COUNTS as the lever and prices as REALISED: it moves
// building counts until profit targets hold at whatever prices the order book produces. This tool runs
// the whole problem BACKWARDS, per the user's first-pass spec:
//
//   1. PRICES ARE MANDATED, not realised:
//        * every NON-INDUSTRIAL good sits at base (100%) in every scenario;
//        * every INDUSTRIAL good sits at 175% − 25pp × scenario era (e0 175 · e1 150 · e2 125 ·
//          e3 100 · e4 75 · e5 50). "Industrial" = a good some ladder tier produces, once that
//          tier's era has arrived (before its first tier's era a good like dye is a plantation good
//          and prices at 100 — the one-price-rule-per-good-per-era invariant).
//   2. RECIPES ARE DERIVED from those prices + the profitability targets + the ×1.5 output ladder:
//        each tier's inputs are solved ONCE, at its own (dominant) era's mandated prices, to the
//        dominant target (+5%, shipyards −30pp, per-tier solve_profit honoured), under the same hard
//        invariants the standing solver uses (4:1 lean cap, §10.63 solvency ≤175, §10.50 recipe
//        ratchet, the negative-goods floor).
//   3. THE SCENARIO BECOMES A FEASIBILITY PROBLEM: find building counts whose order book actually
//        PRODUCES the mandated prices through the game's own formula. price p ⟺ a fixed buy:sell
//        ratio (175 ⇒ buy=2·sell · 150 ⇒ 5/3 · 125 ⇒ 4/3 · 100 ⇒ 1 · 75 ⇒ 3/4 · 50 ⇒ 3/5), so the
//        count solve is a damped per-good supply iteration — no price feedback, no deadbands, no PM
//        hill-climb. The question it answers is the user's: does a coherent market composition exist
//        at these prices ("no 8 million steel mills"), and where exactly does the mandate fail?
//
// ⭐ PASS 3 — THE DESIGN LADDER WITH POP-LIMITED YIELDS (user-ruled 2026-08-24: "I'd like our tiered
// Industry's output prices to have a downward ladder, where possible (where it doesn't conflict with
// pop demand)"). "Industrial" is DEFINED as a tiered industry's OUTPUT — consumer chains included:
// clothes, furniture and groceries are industrial goods and their DESIGN price is the downward ladder
// 175 − 25pp × era, exactly like steel's. Everything else designs at base 100. Steering always aims
// at the design; the ladder yields ONLY where pop demand refuses it: a good whose demand POPS
// dominate (> 50% of buy) and whose realised price persistently misses its book is POP-LIMITED — its
// book re-anchors (damped, over INV_OUTER passes) to what the pop model actually supports, recipes
// re-solve against that, and the yield is reported as a NAMED CONFLICT (design → achieved). The
// report still ⚠-flags every pop-priced good more than 30pp from base.
// (Pass 2 — every pop-dominated good floating freely with no design at all — is superseded: it let
// the consumer half of the ladder lose its obsolescence engine entirely, illogicality 22 vs 7.)
//
// WHAT THIS DELIBERATELY DOES NOT DO (first pass, each a stated simplification):
//   * PM selections are taken from Phase A's fit (config/era_prices.json), not re-optimised at the
//     mandated prices.
//   * Relative rung mix within an industry (dominant : stale) is a placement premise (1 : 1, stale
//     0.25, two-era rung at one level), scaled as a block — the mandate fixes only each GOOD's total.
//   * Fractional building counts throughout — this is a feasibility study, not a shippable preset.
//   * The macroscenario layer (§10.47) is not enforced; composition is REPORTED against common sense.
//
// ⚠ PREMISE TABLES ARE A FORK. era_scenarios.mjs runs its full solve at import time, so its premise
// constants (population, peasant share, army mix, profession wedge, subsistence mix, construction
// ramp) cannot be imported from it; they are COPIED below, marked, and must be kept in step if the
// experiment is promoted. If this tool ever becomes canon, the tables move to a shared module first.
//
// ⚠ The era-0 mandate (175) sits exactly ON the engine's band edge and would violate §10.15's
// industrial-price-ceiling rule for any industrially-consumed good; it is implemented as specified
// (buy = 2·sell is the clamp edge, reachable exactly) and flagged in the report.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEcon, REPO } from './econ_host.mjs';
import { makePmRules } from './era_pm.mjs';

const WRITE = process.argv.includes('--write');
const MAX_IT = +(process.env.INV_ITERS || 400);      // count-iteration budget per era
const DAMP = +(process.env.INV_DAMP || 0.5);         // exponent damping on the per-good scale factor
const PLATEAU_HOLD = process.env.INV_PLATEAU === '1'; // hold a plateaued good's price at its last tier's era
const TOL_PP = 3;                                     // "on mandate" = implied price within this many pp
const OUTER = +(process.env.INV_OUTER || 6);          // design-book ↔ pop-limited re-anchoring passes
const ANCHOR_POP_SHARE = 0.5;                         // pop share of buy above which a persistent miss re-anchors
const HIGHLIGHT_PP = 30;                              // ⚠ a pop price this far from base is flagged

const { E, S, PMECON, config: CFG_RAW } = loadEcon({ quiet: true });
const rules = makePmRules(E, S);

// same artifact-suffix rule as era_scenarios.mjs: a redirected config reads its own era_prices twin
const ARTIFACT_SUFFIX = (() => {
  const b = (process.env.MOD_CONFIG || '').split(/[\\/]/).pop() || '';
  const m = b.match(/^mod_config\.(.+)\.json$/);
  return m ? '.' + m[1] : '';
})();
const artifact = base => join(REPO, 'config', base + ARTIFACT_SUFFIX + '.json');
const FIT = JSON.parse(readFileSync(artifact('era_prices'), 'utf8'));
const TG = FIT.targets;
const SHIP_INDUSTRIES = new Set(['shipyard', 'shipyard_steam']);

// ===================================================================================================
// PREMISES — COPIED from tools/era_scenarios.mjs (see the fork warning in the header).
// ===================================================================================================
const POP_TOTAL = [5e6, 13e6, 40e6, 75e6, 105e6, 150e6];
const PEASANT_SHARE = [0.80, 0.45, 0.35, 0.22, 0.12, 0.04];
const WORK_RATIO_BY_ERA = [0.25, 0.25, 0.25, 0.30, 0.33, 0.40];
const ARMY_GDP_SHARE = 0.05;
const ARMY_MIX = {
  0: [['combat_unit_type_line_infantry', 3], ['combat_unit_type_cannon_artillery', 1]],
  1: [['combat_unit_type_line_infantry', 3], ['combat_unit_type_cannon_artillery', 1]],
  2: [['combat_unit_type_skirmish_infantry', 3], ['combat_unit_type_mobile_artillery', 1]],
  3: [['combat_unit_type_trench_infantry', 3], ['combat_unit_type_shrapnel_artillery', 1]],
  4: [['combat_unit_type_squad_infantry', 3], ['combat_unit_type_siege_artillery', 1]],
  5: [['combat_unit_type_mechanized_infantry', 3], ['combat_unit_type_heavy_tank', 1]],
};
const PROF_RATIO_1836 = {
  clerks: 0.0529, bureaucrats: 0.0174, clergymen: 0.0164, shopkeepers: 0.0121,
  aristocrats: 0.0078, capitalists: 0.0028, officers: 0.0024, academics: 0.0015,
};
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
let PROF_RATIO = { ...PROF_RATIO_1836 };
const setProfRatio = eIx => {
  PROF_RATIO = Object.fromEntries(Object.entries(PROF_RATIO_1836).map(([k, v]) =>
    [k, v * (PROF_MULT_BY_ERA[k] ? PROF_MULT_BY_ERA[k][eIx] : 1)]));
};
const PROF_SOURCE = [
  { prof: 'bureaucrats', bld: 'building_government_administration' },
  { prof: 'aristocrats', bld: 'building_manor_house' },
  { prof: 'capitalists', bld: 'building_financial_district' },
  { prof: 'academics',   bld: 'building_university' },
  { prof: 'clerks',      bld: 'building_trade_center' },
];
// world mix minus the ruled rice ban, renormalised — same default as the standing solver
const SUBSISTENCE_MIX = (() => {
  const src = {
    building_subsistence_farm: 0.374, building_subsistence_pasture: 0.025,
    building_subsistence_orchard: 0.002, building_subsistence_fishing_village: 0.002,
  };
  const s = Object.values(src).reduce((a, b) => a + b, 0);
  for (const k in src) src[k] = src[k] / s;
  return src;
})();
const SOLDIERS_PER_BATTALION = 1000;
const BARRACK_BLD = 'building_barrack';
const BATTALIONS_PER_BARRACK = 1;
const CONSTR_BY_ERA = [0.08, 0.10, 0.12, 0.15, 0.17, 0.18];
const CONSTRUCTION_PM = {
  0: 'pm_wooden_buildings', 1: 'pm_iron_frame_buildings', 2: 'pm_iron_frame_buildings',
  3: 'pm_steel_frame_buildings', 4: 'pm_steel_frame_buildings', 5: 'pm_arc_welded_buildings',
};
const CONSTRUCTION_BLD = 'building_construction_sector';
const SUPPORT_BLD = {
  ownership:    ['building_manor_house', 'building_financial_district'],
  government:   ['building_government_administration'],
  trade:        ['building_trade_center'],
  construction: ['building_construction_sector'],
};
const STRATUM = {
  lower:  ['laborers', 'farmers', 'machinists', 'soldiers'],
  middle: ['shopkeepers', 'clerks', 'engineers', 'bureaucrats', 'academics', 'clergymen', 'officers'],
  upper:  ['aristocrats', 'capitalists'],
};
const stratumOf = p => (STRATUM.lower.includes(p) ? 'lower' : STRATUM.middle.includes(p) ? 'middle'
                      : STRATUM.upper.includes(p) ? 'upper' : null);
const SUBSISTENCE_JOBS_PER_LEVEL = 5000;
const URBAN_PER_LEVEL = 100;   // FINDINGS F13
const THRU_MANUFACTURING = 0.20;
const THRU_EXTRACTION = 0.10;
const SCALE_LIMIT = { whaling: 30, fishing: 100, oreOrLogging: 1000, plantation: 300, agriculture: 3000 };
const EXCLUDE_REF = new Set(['building_gold_mine', 'building_gold_field']);
const PRUNE = (() => { const m = {};
  const spec = process.env.ERA_PRUNE != null ? process.env.ERA_PRUNE : 'steel@0,glass@0';
  for (const kv of spec.split(',').filter(Boolean)) {
    const [id, e] = kv.split('@'); (m[id] = m[id] || new Set()).add(+e); } return m; })();
const EXTINCT_GRACE = 2;
const MFG_IO_CAP = 4;
const MAX_TARGET_BE = 175;
const DEFAULT_WAGE_PCT = 0.25;

// ===================================================================================================
// SHARED HELPERS (thin copies of the standing solver's — see the fork warning)
// ===================================================================================================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const W = (s, n) => String(s).padEnd(n);
const fmtN = n => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(Math.round(n)));
const pct = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(0) + '%';

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
function catOf(b) {
  const info = S.VAN.buildings[b] || {};
  if (info.unique && !PMECON.GRPCAT[info.group]) return 'unique';
  return PMECON.GRPCAT[info.group] || ('grp_' + (info.group || 'other'));
}
const EXTRACTION_CATS = new Set(['mining', 'logging', 'oil', 'rubber', 'fishing_whaling']);
const AGRICULTURE_CATS = new Set(['farms', 'plantations', 'ranching']);
const isScaleAgri = b => { const c = catOf(b); return c === 'farms' || c === 'plantations' || c === 'ranching'; };
const scaleCapOf = b => {
  if (/whaling/.test(b)) return SCALE_LIMIT.whaling;
  if (/fishing/.test(b)) return SCALE_LIMIT.fishing;
  const c = catOf(b);
  if (c === 'mining' || c === 'oil' || c === 'rubber' || c === 'logging') return SCALE_LIMIT.oreOrLogging;
  if (c === 'plantations') return SCALE_LIMIT.plantation;
  return Infinity;
};
const vanTier = e => (e == null ? 0 : (e <= 1 ? 1 : e));
const leadOfEra = e => { const c = FIT.eras[e]; return (c && c.lead != null) ? c.lead : e; };
const techAllowed = (bt, era) => !bt || vanTier((S.VAN.tech_era || {})[bt]) <= Math.max(1, leadOfEra(era));

const GOOD_FIRST_ERA = {};
for (const i of S.IND) {
  if (i.follows_be === false) continue;
  for (const t of i.tiers) {
    const g = E.tierOut(i, t);
    if (GOOD_FIRST_ERA[g] == null || t.era < GOOD_FIRST_ERA[g]) GOOD_FIRST_ERA[g] = t.era;
  }
}
const PLATEAU_LAST_ERA = {};
for (const i of S.IND) {
  if (i.ladder_end !== 'plateau') continue;
  for (const t of i.tiers) {
    const g = E.tierOut(i, t);
    if (PLATEAU_LAST_ERA[g] == null || t.era > PLATEAU_LAST_ERA[g]) PLATEAU_LAST_ERA[g] = t.era;
  }
}
const EXTINCT_GOODS = new Set();
const EXTINCT_LAST_ERA = {};
for (const i of S.IND) if (i.ladder_end === 'extinct') {
  for (const t of i.tiers) EXTINCT_GOODS.add(E.tierOut(i, t));
  EXTINCT_LAST_ERA[i.id] = Math.max(...i.tiers.map(t => t.era));
}
const extinctBy = (indId, era) => EXTINCT_LAST_ERA[indId] != null && era - EXTINCT_LAST_ERA[indId] >= EXTINCT_GRACE;
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

// ===================================================================================================
// THE INDUSTRIAL-INPUT CEILING — §10.15's rule, AS AN ACCEPTANCE CRITERION, NOT A CONTROL TERM.
//
// The rule is solver 1's: no good that industry or the army can consume may sit AT the +75% band edge,
// because a pinned input can no longer signal scarcity and everything downstream is priced against a
// wall. ⚠ THE IMPLEMENTATION IS DELIBERATELY DIFFERENT FROM SOLVER 1'S, and this is the line that keeps
// the inverse solver off the constraint slope: solver 1 enforced the ceiling INSIDE the loop (price
// caps, count boosts, PM-score penalties — three levers, each interacting with every other constraint
// through the fixed point). Here it is a VERIFY line: the seed runs, and any restricted good whose
// realised price pins at the edge FAILS the scenario by name, with its residual class attached
// (joint-production, wall, scale-cap…). The remedy is then a structural change — a book change, a
// premise change, a new lever like PM mixing — ruled explicitly, never a feedback gain.
//
// The set is computed from the CONFIG AS LOADED (main-recipe input goods sets are invariant under the
// recipe solve — solveTier rescales quantities, never the goods list — so load-time is always), plus
// every secondary PMG's inputs and every combat unit's upkeep (the §10.15 army half).
const RESTRICTED = new Set();
for (const i of S.IND) {
  for (const t of i.tiers) for (const g in (t.inputs || {})) if (t.inputs[g] > 0) RESTRICTED.add(g);
  for (const pmg of (i.secondary_pmgs || [])) {
    const grp = S.VAN.pmgs[pmg]; if (!(grp && grp.pms)) continue;
    for (const pm of grp.pms) { const r = E.pmRec(pm); for (const g in (r.in || {})) if (r.in[g] > 0) RESTRICTED.add(g); }
  }
}
for (const u of (E.unitTypes ? E.unitTypes() : [])) {
  const io = E.unitGoodsIO(u); for (const g in (io.in || {})) RESTRICTED.add(g);
}
const CEIL_EDGE = 174.5;   // "at the edge" — the engine rounds to 175; realised ≥ this is a pinned input

// ===================================================================================================
// THE MANDATE
// ===================================================================================================
const isIndustrial = (g, era) => GOOD_FIRST_ERA[g] != null && GOOD_FIRST_ERA[g] <= era;
function mandatePrice(g, era) {
  if (!isIndustrial(g, era)) return 100;
  const eEff = PLATEAU_HOLD && PLATEAU_LAST_ERA[g] != null ? Math.min(era, PLATEAU_LAST_ERA[g]) : era;
  return clamp(175 - 25 * eEff, 25, 175);
}
// the order-book ratio the V3 price formula demands for price p (% of base):
//   p ≥ 100:  buy/sell = 1 + (p/100−1)/0.75      p < 100:  buy/sell = 1 / (1 + (1−p/100)/0.75)
const buyOverSell = p => p >= 100 ? 1 + (p / 100 - 1) / 0.75 : 1 / (1 + (1 - p / 100) / 0.75);
// the V3 price formula UNROUNDED (priceMultPct rounds to whole %, too coarse for the outer fixed point)
const pricePctRaw = (buy, sell) => {
  buy = Math.max(0, buy); sell = Math.max(0, sell);
  if (buy === 0 && sell === 0) return 100;
  const mn = Math.min(buy, sell);
  const dev = clamp(mn > 0 ? (buy - sell) / mn : (buy > sell ? 1 : -1), -1, 1);
  return (1 + 0.75 * dev) * 100;
};

// ---- PASS 3: the DESIGN book with POP-LIMITED overrides ----
// Every good's DESIGN price is the ruled ladder — a tiered industry's output at 175 − 25pp × era,
// everything else at 100 (mandatePrice above). The ladder holds WHERE POSSIBLE: a good whose demand
// pops dominate and whose realised price persistently refuses the design is POP-LIMITED, and its
// book re-anchors (damped) to what the pop model supports. BOOK_OVR[eIx] holds exactly those
// overrides — every entry is a NAMED CONFLICT between the design ladder and pop demand.
const BOOK_OVR = FIT.eras.map(() => ({}));
function bookPrice(eIx, g) {
  const o = BOOK_OVR[eIx][g];
  return o != null ? o : mandatePrice(g, FIT.eras[eIx].era);
}

function setEraContext(eIx) {
  const era = FIT.eras[eIx].era;
  for (const g in S.PRICES) S.thresholds[g] = bookPrice(eIx, g);
  S.BASE_WAGE = FIT.eras[eIx].base_wage;
  const sol = FIT.eras[eIx].sol;
  S.SOL = { lower: sol, middle: Math.round(sol * 1.5), upper: Math.round(sol * 3), peasants: sol, slaves: 8 };
  S.POPM.working_adult_ratio = WORK_RATIO_BY_ERA[eIx];
  setProfRatio(eIx);
  // PM selections: Phase A's fit for this era (stated first-pass simplification)
  Object.keys(S.REFSEL).forEach(k => delete S.REFSEL[k]);
  for (const i of S.IND) for (const t of i.tiers) if (FIT.pms[eIx].tiers[t.key]) t._sec = { ...FIT.pms[eIx].tiers[t.key] };
  for (const b in FIT.pms[eIx].refs) S.REFSEL[b] = { ...FIT.pms[eIx].refs[b] };
}
function thruAllTiers() {
  Object.keys(S.THRU).forEach(k => delete S.THRU[k]);
  for (const i of S.IND) for (const t of i.tiers) S.THRU[t.key] = THRU_MANUFACTURING;
}

// ===================================================================================================
// PHASE 1 — RECIPES DERIVED AT MANDATED PRICES
// ===================================================================================================
// the canonical ratio precedence (own vanilla recipe → nearest real tier below → frozen → inputs)
function ratioFor(ind, t) {
  const keys = Object.keys(t.inputs || {});
  if (!keys.length) return null;
  const covers = src => !!src && keys.every(g => src[g] > 0);
  const vanOf = x => (x && x.vanilla_pm) ? (E.pmRec(x.vanilla_pm).in || {}) : null;
  const below = () => (ind.tiers || [])
    .filter(x => x !== t && (x.era ?? 0) < (t.era ?? 0) && covers(vanOf(x)))
    .sort((a, b) => (b.era ?? 0) - (a.era ?? 0))[0];
  for (const name of ['own', 'below', 'frozen', 'inputs']) {
    let src = name === 'own' ? vanOf(t) : name === 'below' ? vanOf(below())
            : name === 'frozen' ? t.input_ratio : t.inputs;
    if (!covers(src)) continue;
    if (name === 'frozen') return { ...src };
    let s0 = 0; for (const g of keys) s0 += (src[g] || 0);
    if (!(s0 > 0)) continue;
    const r = {}; for (const g of keys) r[g] = Math.round(((src[g] || 0) / s0) * 1e6) / 1e6;
    return r;
  }
  return null;
}
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
// §10.50 ratchet cap, against the tier below's NEW (mandate-solved) recipe — era order guarantees it exists
function monoCapInfo(ind, t) {
  const prev = (ind.tiers || [])
    .filter(x => x !== t && (x.era ?? 0) < (t.era ?? 0)
      && Object.keys(x.inputs || {}).some(g => x.inputs[g] > 0))
    .sort((a, b) => (b.era ?? 0) - (a.era ?? 0))[0];
  if (!prev) return null;
  let Iprev = 0; for (const g in prev.inputs) Iprev += prev.inputs[g] * (S.PRICES[g] || 0);
  const Oprev = prev.output_qty * (S.PRICES[E.tierOut(ind, prev)] || 0);
  const Obase = t.output_qty * (S.PRICES[E.tierOut(ind, t)] || 0);
  if (!(Iprev > 0) || !(Oprev > 0) || !(Obase > 0)) return null;
  return { IbaseMax: Obase * Iprev / Oprev };
}
const RECIPES = [];   // {ind, t, target, margin, cap, be}
function deriveRecipes() {
  RECIPES.length = 0;
  const byEra = new Map();
  for (const i of S.IND) {
    if (i.follows_be === false) continue;
    for (const t of i.tiers) {
      if (!Object.keys(t.inputs || {}).length) { RECIPES.push({ ind: i, t, skip: 'no inputs' }); continue; }
      const e = clamp(t.era ?? 0, 0, FIT.eras.length - 1);
      if (!byEra.has(e)) byEra.set(e, []);
      byEra.get(e).push({ i, t });
    }
  }
  for (const e of [...byEra.keys()].sort((a, b) => a - b)) {
    setEraContext(e); thruAllTiers();
    for (const { i, t } of byEra.get(e)) {
      const target = t.solve_profit != null ? +t.solve_profit
                   : TG.minus1 + (SHIP_INDUSTRIES.has(i.id) ? TG.shipyard_penalty : 0);
      const k = E.thruMult(t.key);
      const O = E.outputValue(i, t, true), Wc = E.wageCost(t), secI = E.selInVal(t._sec, true);
      const outGood = E.tierOut(i, t);
      const Obase = t.output_qty * (S.PRICES[outGood] || 0);
      const ratio = ratioFor(i, t);
      if (!ratio || !(Obase > 0)) { RECIPES.push({ ind: i, t, skip: 'no ratio/output' }); continue; }
      let unitMkt = 0, unitBase = 0;
      for (const g in ratio) { const pr = S.PRICES[g] || 0;
        unitMkt += ratio[g] * pr * ((S.thresholds[g] ?? 100) / 100); unitBase += ratio[g] * pr; }
      if (!(unitMkt > 0) || !(unitBase > 0)) { RECIPES.push({ ind: i, t, skip: 'unpriced ratio' }); continue; }
      const wantI = O / (1 + target) - Wc / k - secI;
      const Xmin = (Obase / MFG_IO_CAP) / unitBase;
      let X = wantI > 0 ? wantI / unitMkt : Xmin, cap = wantI > 0 ? null : 'insolvent-at-target';
      const mono = monoCapInfo(i, t);
      if (mono) { const Xm = mono.IbaseMax / unitBase; if (X > Xm) { X = Xm; cap = 'ratchet'; } }
      const wp = t.wage_pct != null ? +t.wage_pct : DEFAULT_WAGE_PCT;
      const IbMax = (MAX_TARGET_BE / 100) * (1 - wp) * Obase;
      const Xs = IbMax / unitBase;
      if (X > Xs) { X = Xs; cap = 'solvency'; }
      if (X < Xmin) { X = Xmin; cap = 'lean-floor'; }
      const apply = rnd => {
        for (const g of Object.keys(t.inputs)) t.inputs[g] = Math.max(minMainInput(i, g), rnd(ratio[g] * X * 10) / 10);
        let Ib = 0; for (const g in t.inputs) Ib += t.inputs[g] * (S.PRICES[g] || 0);
        return Ib;
      };
      let Ib = apply(Math.round);
      if (Ib > IbMax * (1 + 1e-9)) Ib = apply(Math.floor);
      RECIPES.push({ ind: i, t, target, cap, margin: E.TPthr(i, t) / 100, be: E.BE(i, t) });
    }
  }
}

// ===================================================================================================
// PLACEMENT — the date gate + extinct + chain rules, compact copies of the standing solver's
// ===================================================================================================
function placementFor(eIx) {
  const era = FIT.eras[eIx].era, YEAR = FIT.eras[eIx].year;
  const GONE = goneGoods(era);
  const plan = [];
  for (const i of S.IND) {
    if (extinctBy(i.id, era)) continue;
    const sorted = [...i.tiers].sort((a, b) => a.era - b.era);
    const avail0 = sorted.filter(t => (t.era <= era || (t.tech_year != null && t.tech_year <= YEAR))
      && !Object.keys(t.inputs || {}).some(g => GONE.has(g)));
    if (!avail0.length) continue;
    const withheld = !!(PRUNE[i.id] && PRUNE[i.id].has(era));
    plan.push({ i, avail0, withheld });
  }
  // which goods a reachable reference building could make (per-PM era gate included)
  const refProducible = new Set();
  for (const b of E.refBuildings()) {
    if (EXCLUDE_REF.has(b)) continue;
    const bt = (S.VAN.buildings[b] || {}).tech;
    if (!techAllowed(bt, era)) continue;
    for (const pmg of ((S.VAN.buildings[b] || {}).pmgs || [])) {
      const grp = S.VAN.pmgs[pmg]; if (!(grp && grp.pms)) continue;
      for (const pm of grp.pms) {
        if (E.pmGated(pm) || !rules.pmAvailable(pm) || rules.pmEra(pm) > era) continue;
        const o = E.pmRec(pm).out || {}; for (const g in o) if (o[g] > 0) refProducible.add(g);
      }
    }
  }
  const chainDropped = new Set();
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
        if (Object.keys(t.inputs || {}).some(unproducible)) { chainDropped.add(t.key); moved = true; }
      }
    }
    if (!moved) break;
  }
  const placement = [];
  for (const { i, avail0, withheld } of plan) {
    const avail = avail0.filter(t => !chainDropped.has(t.key));
    if (!avail.length) continue;
    const cur = avail[avail.length - 1], m1 = avail[avail.length - 2], m2 = avail[avail.length - 3];
    const rows = [{ t: cur, weight: 1 }];
    if (m1) rows.push({ t: m1, weight: m1.era < era ? 0.25 : 1 });
    if (m2) rows.push({ t: m2, weight: 0, fixed1: true });
    placement.push({ ind: i, rows, withheld });
  }
  return placement;
}

// ===================================================================================================
// PHASE 2 — THE ANALYTIC LADDER: margins are count-independent under mandated prices
// ===================================================================================================
function ladderAt(eIx, quietTable) {
  setEraContext(eIx); thruAllTiers();
  const placement = placementFor(eIx);
  const present = new Map();
  for (const p of placement) if (!p.withheld) for (const r of p.rows) present.set(r.t.key, 1);
  const faults = PMECON.ladderFaults(S.IND, {
    countOf: t => present.get(t.key) || 0,
    profitOf: (i2, t2) => E.TPthr(i2, t2) / 100,
  });
  if (!quietTable) {
    for (const p of placement) {
      if (p.withheld) continue;
      const cells = p.rows.map(r => `e${r.t.era}${r.t.era > eIx ? '↑' : ''} ${pct(E.TPthr(p.ind, r.t) / 100)}`);
      const marks = faults.byIndustry[p.ind.id] ? '  ⚠ ' + faults.byIndustry[p.ind.id].join('+') : '';
      console.log(`    ${W(p.ind.id, 14)} ${cells.join(' · ')}${marks}`);
    }
  }
  return { faults, placement };
}

// ===================================================================================================
// PHASE 3 — SEEDING: counts as a feasibility problem
// ===================================================================================================
function seedScenario(eIx) {
  const era = FIT.eras[eIx].era;
  setEraContext(eIx);
  const placement = placementFor(eIx);
  const refProducers = E.refBuildings().filter(b => {
    if (EXCLUDE_REF.has(b)) return false;
    const bt = (S.VAN.buildings[b] || {}).tech;
    if (!techAllowed(bt, era)) return false;
    if (E.isSubsistenceBuilding(b) || isUrban(b) || isMilitary(b) || isSupport(b)) return false;
    if ((S.VAN.buildings[b] || {}).unique) return false;
    const out = E.selGoods(E.refSel(b)).out;
    return Object.keys(out).some(g => out[g] > 0 && S.PRICES[g]);
  });

  const N = new Map();                 // adjustable building -> fractional count
  const FIXED1 = new Set();            // two-era rungs pinned at one level
  const tierOf = new Map();            // key -> {ind, t}
  const URBAN = 'building_urban_center';
  for (const p of placement) {
    for (const r of p.rows) {
      tierOf.set(r.t.key, { ind: p.ind, t: r.t });
      if (p.withheld) continue;                      // pruned: place nothing
      if (r.fixed1) FIXED1.add(r.t.key);
      else N.set(r.t.key, 10 * r.weight);
    }
  }
  for (const b of refProducers) N.set(b, 10);
  // URBAN CENTRES join the adjustables (they are the ONLY producer of services), capped at the F13
  // urbanization entitlement — the inverse-solve mirror of ERA_URBAN_SHRINK: a centre that cannot sell
  // its services sheds levels rather than standing fully manned.
  N.set(URBAN, 5);
  // a building's goods output at one level (with throughput), for steering and attribution
  const outOf = b => {
    const x = tierOf.get(b);
    return x ? E.tierGoodsIO(x.ind, x.t).out : E.selGoods(E.refSel(b)).out;
  };
  // every good some adjustable building can produce (by-products included — steering is blended)
  const byGood = new Map();
  const registerOutputs = b => {
    const out = outOf(b);
    for (const g in out) {
      if (!(out[g] > 0) || !S.PRICES[g]) continue;
      if (!byGood.has(g)) byGood.set(g, []);
      if (!byGood.get(g).includes(b)) byGood.get(g).push(b);
    }
  };
  for (const [b] of N) registerOutputs(b);
  for (const b of FIXED1) { /* fixed rungs supply but are not steered */ }

  // ---- the settle chain (compact copies; fractional counts throughout) ----
  const applyCounts = () => {
    Object.keys(S.BLDNUM).forEach(k => delete S.BLDNUM[k]);
    for (const [b, n] of N) if (n > 0) S.BLDNUM[b] = n;
    for (const b of FIXED1) S.BLDNUM[b] = 1;
  };
  const applyThroughput = () => {
    Object.keys(S.THRU).forEach(k => delete S.THRU[k]);
    for (const i of S.IND) for (const t of i.tiers) if (S.BLDNUM[t.key]) S.THRU[t.key] = THRU_MANUFACTURING;
    for (const b of E.refBuildings()) {
      if (!S.BLDNUM[b] || E.isSubsistenceBuilding(b)) continue;
      const c = catOf(b);
      if (EXTRACTION_CATS.has(c) || AGRICULTURE_CATS.has(c)) S.THRU[b] = THRU_EXTRACTION;
    }
  };
  const advanceNonMarketPMs = () => {
    const cs = S.VAN.buildings[CONSTRUCTION_BLD];
    if (cs) {
      const want = CONSTRUCTION_PM[era], sel = E.refSel(CONSTRUCTION_BLD);
      for (const pmg of (cs.pmgs || [])) if (((S.VAN.pmgs[pmg] || {}).pms || []).includes(want)) sel[pmg] = want;
    }
    for (const b of E.refBuildings()) {
      if (!(S.BLDNUM[b] > 0)) continue;
      const out = E.selGoods(E.refSel(b)).out;
      if (Object.keys(out).some(g => out[g] > 0 && S.PRICES[g])) continue;
      const sel = E.refSel(b), info = S.VAN.buildings[b] || {};
      for (const pmg of (info.pmgs || [])) {
        const cand = rules.candidates(pmg, era, new Set(Object.values(sel)));
        if (!cand.length) continue;
        let best = cand[0], bestEra = rules.pmEra(cand[0]);
        for (const pm of cand) { const e = rules.pmEra(pm); if (e >= bestEra) { bestEra = e; best = pm; } }
        sel[pmg] = best;
      }
    }
  };
  const productiveWorkforce = () => {
    let n = 0;
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) n += c * E.empTotal(E.tierEmp(t)); }
    for (const b of refProducers) { const c = S.BLDNUM[b] || 0; if (c) n += c * E.empTotal(E.selEmp(E.refSel(b))); }
    return n;
  };
  const addSupport = () => {
    const wProd = productiveWorkforce();
    const sized = PROF_SOURCE.filter(x => S.VAN.buildings[x.bld]);
    for (const { bld } of sized) if (!(S.BLDNUM[bld] > 0)) S.BLDNUM[bld] = 1;
    const employedOf = (prof, except) => {
      let n = 0;
      for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0;
        if (c) n += (E.tierEmp(t)[prof] || 0) * c; }
      for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0;
        if (!c || b === except || E.isSubsistenceBuilding(b)) continue;
        n += ((E.selEmp(E.refSel(b)) || {})[prof] || 0) * c; }
      return n;
    };
    for (let pass = 0; pass < 4; pass++) {
      for (const { prof, bld } of sized) {
        const per = (E.selEmp(E.refSel(bld)) || {})[prof] || 0;
        if (!(per > 0)) continue;
        const want = wProd * (PROF_RATIO[prof] || 0);
        S.BLDNUM[bld] = Math.max(0, want - employedOf(prof, bld)) / per;
      }
    }
    let urb = 0;
    const anchor = b => { const x = tierOf.get(b); return x ? x.ind.tiers[0].key : b; };
    for (const b in S.BLDNUM) { if (isUrban(b)) continue; urb += (S.BLDNUM[b] || 0) * urbanizationOf(anchor(b)); }
    // the F13 entitlement is a CEILING (ERA_URBAN_SHRINK's reading); the level below it is steered by
    // the services order book like any other adjustable
    const entitled = Math.max(1, urb / URBAN_PER_LEVEL);
    const uc = clamp(N.get(URBAN) || 1, 1, entitled);
    N.set(URBAN, uc);
    S.BLDNUM[URBAN] = uc;
  };
  const constrCost = () => (S.BLDNUM[CONSTRUCTION_BLD] || 0)
    * E.thruMult(CONSTRUCTION_BLD) * E.goodsVal(E.selGoods(E.refSel(CONSTRUCTION_BLD)).in, true);
  const sizeConstruction = () => {
    if (!S.VAN.buildings[CONSTRUCTION_BLD]) return;
    const v0 = E.scenarioValueAdded() + constrCost();
    const cost = E.thruMult(CONSTRUCTION_BLD) * E.goodsVal(E.selGoods(E.refSel(CONSTRUCTION_BLD)).in, true);
    if (!(cost > 0) || !(v0 > 0)) return;
    const cs = CONSTR_BY_ERA[eIx];
    S.BLDNUM[CONSTRUCTION_BLD] = (cs * v0 / (1 + cs)) / cost;
  };
  const setArmy = () => {
    Object.keys(S.UNITNUM).forEach(k => delete S.UNITNUM[k]);
    const gdp = E.scenarioValueAdded();
    const budget = gdp * ARMY_GDP_SHARE;
    const mix = ARMY_MIX[era] || ARMY_MIX[5];
    let unitCost = 0;
    for (const [u, w2] of mix) unitCost += w2 * E.goodsVal(E.unitGoodsIO(u).in, true);
    if (!(unitCost > 0) || !(budget > 0)) return;
    const groups = budget / unitCost;      // prices are mandated ⇒ no fixed point needed
    for (const [u, w2] of mix) S.UNITNUM[E.unitRowKey(u, false)] = groups * w2;
  };
  const militarySplit = () => {
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
      if (tot > 0) return Object.fromEntries(Object.entries(pr).map(([p, v]) => [p, v / tot]));
    }
    return { soldiers: 1 };
  };
  const WORK_RATIO = WORK_RATIO_BY_ERA[eIx];
  let POPPROF = {};    // people per profession — the balance sheet edits population by profession
  const setPops = () => {
    const byStratum = { lower: 0, middle: 0, upper: 0 };
    const byProf = {};
    const addEmp = (emp, c) => { for (const p in emp) { const s = stratumOf(p); if (s) byStratum[s] += emp[p] * c;
      if (emp[p]) byProf[p] = (byProf[p] || 0) + emp[p] * c; } };
    for (const i of S.IND) for (const t of i.tiers) { const c = S.BLDNUM[t.key] || 0; if (c) addEmp(E.tierEmp(t), c); }
    for (const b of E.refBuildings()) { const c = S.BLDNUM[b] || 0; if (!c || E.isSubsistenceBuilding(b)) continue;
      addEmp(E.selEmp(E.refSel(b)), c); }
    const battalions = Object.values(S.UNITNUM).reduce((a, c) => a + c, 0);
    const milSplit = militarySplit();
    let soldierWork = 0;
    for (const p in milSplit) {
      const n = battalions * SOLDIERS_PER_BATTALION * milSplit[p], st = stratumOf(p);
      if (st) byStratum[st] += n;
      if (n) byProf[p] = (byProf[p] || 0) + n;
      if (p === 'soldiers') soldierWork = n;
    }
    if (S.VAN.buildings[BARRACK_BLD] && battalions > 0)
      S.BLDNUM[BARRACK_BLD] = Math.max(1, battalions / BATTALIONS_PER_BARRACK);
    const nonPeasant = (byStratum.lower + byStratum.middle + byStratum.upper) / WORK_RATIO;
    const peasants = nonPeasant * PEASANT_SHARE[eIx] / Math.max(1e-9, 1 - PEASANT_SHARE[eIx]);
    S.POPS = {
      total: nonPeasant + peasants,
      lower: byStratum.lower / WORK_RATIO, middle: byStratum.middle / WORK_RATIO,
      upper: byStratum.upper / WORK_RATIO, peasants, slaves: 0,
      soldiers: soldierWork / WORK_RATIO,
    };
    POPPROF = {};
    for (const p in byProf) POPPROF[p] = Math.round(byProf[p] / WORK_RATIO);
    POPPROF.peasants = Math.round(peasants);
    POPPROF.slaves = 0;
    const peasantWork = peasants * WORK_RATIO;
    for (const b in SUBSISTENCE_MIX) {
      if (!S.VAN.buildings[b]) continue;
      const per = E.empTotal(E.selEmp(E.refSel(b))) || SUBSISTENCE_JOBS_PER_LEVEL;
      const lv = peasantWork * SUBSISTENCE_MIX[b] / per;
      if (lv > 0) S.BLDNUM[b] = lv;
    }
  };
  const settle = () => { applyCounts(); addSupport(); applyThroughput(); advanceNonMarketPMs();
                         sizeConstruction(); setArmy(); setPops(); };

  // ---- the iteration ----
  // The system is homogeneous of degree ~1 (pops derive from employment, demand from pops), so the
  // count solve is a POWER ITERATION with a free scale mode. Two numerical rules keep it honest:
  //   * each building is steered by the GEOMETRIC BLEND of its outputs' factors, weighted by output
  //     value (a logging camp selling wood + hardwood answers to both, not to whichever is "main");
  //   * the scale mode is RENORMALISED every pass (total adjustable employment pinned to its seed),
  //     so relative composition converges without the absolute scale drifting to 0 or ∞ — the real
  //     scale is set once at the end, from the POPULATION premise.
  Object.keys(S.ADDSELL).forEach(k => delete S.ADDSELL[k]);
  Object.keys(S.ADDBUY).forEach(k => delete S.ADDBUY[k]);
  const tradeSupplied = new Set(), walls = new Set();
  const sellOfBuilding = (b, g) => {
    const n = S.BLDNUM[b] || 0; if (!(n > 0)) return 0;
    return n * E.thruMult(b) * (outOf(b)[g] || 0);
  };
  const N_MIN = 1e-6;
  // THE FUTILITY GUARD (the §10.21 lesson: a rule that cannot reach its goal must stop). A good whose
  // ratio has not moved across a 25-pass window DESPITE real steering is declared FUTILE: steering
  // stops, its producers freeze. In pass 2 this is a backstop — consumer goods self-target their own
  // realised price, so the systematic pop-fed futility of pass 1 mostly disappears — but mixed-feed
  // goods and joint-production knots (wood+hardwood) still need it.
  const FUTILE = new Set();
  const appeals = new Map();     // good -> unfreezes used (ONE appeal per good — the §10.49 lesson:
                                 // unlimited re-opens churn forever and nothing ever settles)
  const ratioSnap = new Map();   // good -> {it, logRatio, steer}   (steer = Σ|logF| applied this window)
  let resid = Infinity, iters = 0;
  const TRACE = (process.env.INV_TRACE || '').split('@');
  const traceGood = TRACE[0] && (TRACE[1] == null || +TRACE[1] === eIx) ? TRACE[0] : null;
  for (let it = 1; it <= MAX_IT; it++) {
    iters = it;
    settle();
    const agg = E.scenarioAggregates();
    // trade supply: a demanded good with NO domestic producer of any kind — imported at base if
    // non-industrial (the generalised §10.46 rule), a named WALL if industrial (autarky for the ladder)
    for (const g in S.PRICES) {
      if (byGood.has(g)) continue;
      const { buy, sell } = E.scenarioBuySell(agg, g);
      const domestic = sell - (S.ADDSELL[g] || 0);
      if (buy > 1e-6 && domestic < 1e-6) {
        if (!isIndustrial(g, era)) { S.ADDSELL[g] = buy; tradeSupplied.add(g); }
        else walls.add(g);
      } else if (S.ADDSELL[g] != null && domestic >= 1e-6) { delete S.ADDSELL[g]; tradeSupplied.delete(g); }
    }
    // per-good factors first…
    const logF = new Map();   // good -> log of the supply factor its book price asks for
    let maxErr = 0;
    for (const [g, blds] of byGood) {
      const { buy, sell } = E.scenarioBuySell(agg, g);
      const rho = buyOverSell(bookPrice(eIx, g));
      const err = (buy > 1e-6 && sell > 1e-9) ? Math.abs(Math.log((buy / sell) / rho)) : 0;
      const lr = Math.log(Math.max(1e-9, buy) / Math.max(1e-9, sell));
      if (FUTILE.has(g)) {
        // ONE appeal: if the system visibly shifted under a frozen good, it may resume steering once —
        // a second freeze is permanent (unlimited re-opens churn forever, the §10.49 lesson)
        const snap = ratioSnap.get(g);
        if (snap && Math.abs(lr - snap.lr) > 0.1 && !(appeals.get(g) >= 1)) {
          FUTILE.delete(g); appeals.set(g, 1); ratioSnap.set(g, { it, lr, steer: 0 });
        }
        continue;
      }
      let adjSell = 0, cappedSell = 0;
      for (const b of blds) {
        const s = sellOfBuilding(b, g);
        adjSell += s;
        if ((N.get(b) || 0) >= scaleCapOf(b) * 0.99) cappedSell += s;
      }
      const atCap = adjSell > 0 && cappedSell / adjSell > 0.9;
      let lf;
      if (!(buy > 1e-6)) lf = Math.log(0.25);              // no demand: decay
      else if (!(adjSell > 0)) lf = Math.log(4);           // demand, no live supply: regrow
      else {
        const wantAdj = buy / rho - (sell - adjSell);
        lf = Math.log(clamp(wantAdj > 0 ? wantAdj / adjSell : 0.25, 0.25, 4));
        if (err > maxErr && !atCap) maxErr = err;
      }
      logF.set(g, lf);
      // futility: real steering (Σ|logF| > 0.75 this window) moved the producers and the RATIO did not
      // move — but a good held down by its producers' SCALE CAPS is capped, not futile
      const snap = ratioSnap.get(g);
      if (!snap) ratioSnap.set(g, { it, lr, steer: Math.abs(lf) });
      else {
        snap.steer += Math.abs(lf);
        if (it - snap.it >= 25) {
          if (!atCap && Math.abs(lr - snap.lr) < 0.02 && snap.steer > 0.75 && err > 0.1) { FUTILE.add(g); logF.delete(g); }
          ratioSnap.set(g, { it, lr, steer: 0 });
        }
      }
      if (traceGood === g) console.log(`      [trace ${g}] it ${it} buy ${buy.toFixed(1)} sell ${sell.toFixed(1)} adjSell ${adjSell.toFixed(2)} lf ${lf.toFixed(3)} err ${err.toFixed(3)}${FUTILE.has(g) ? ' FUTILE' : ''}${atCap ? ' CAP' : ''}`);
    }
    // …then each building takes the value-weighted blend over its own outputs
    for (const [b, n0] of N) {
      const out = outOf(b);
      let wSum = 0, lf = 0;
      for (const g in out) {
        if (!(out[g] > 0) || !logF.has(g)) continue;
        const w2 = out[g] * (S.PRICES[g] || 0);
        wSum += w2; lf += w2 * logF.get(g);
      }
      if (!(wSum > 0)) continue;
      let n = Math.max(N_MIN, n0) * Math.exp(DAMP * lf / wSum);
      n = Math.min(n, scaleCapOf(b));
      N.set(b, Math.max(N_MIN, n));
    }
    // pin the free scale mode to the POPULATION PREMISE (so the absolute caps and thresholds are
    // honest at every pass), then re-apply the hard caps
    const k = clamp(POP_TOTAL[eIx] / Math.max(1, S.POPS.total), 0.5, 2);
    for (const [b, n] of N) N.set(b, Math.min(Math.max(N_MIN, n * k), scaleCapOf(b)));
    // joint agriculture bound (preserves the mix, removes only the excess)
    let agriTot = 0;
    for (const [b, n] of N) if (isScaleAgri(b)) agriTot += n;
    if (agriTot > SCALE_LIMIT.agriculture) {
      const ka = SCALE_LIMIT.agriculture / agriTot;
      for (const [b, n] of N) if (isScaleAgri(b)) N.set(b, n * ka);
    }
    resid = maxErr;
    if (resid < 0.01 && it > 10) break;
  }
  settle();
  // final touch-up onto the population premise, prune sub-visible ghosts, settle again
  const kPop = POP_TOTAL[eIx] / Math.max(1, S.POPS.total);
  for (const [b, n] of N) N.set(b, Math.min(n * kPop, scaleCapOf(b)));
  for (const g in S.ADDSELL) S.ADDSELL[g] *= kPop;
  for (const [b, n] of N) if (n < 0.05) N.set(b, 0);
  settle();

  // ---- diagnostics ----
  const agg = E.scenarioAggregates();
  const offMandate = [];      // goods off their BOOK price
  const consumer = [];        // POP-PRICED goods (pop > ANCHOR_POP_SHARE of buy): {g, p, popShare, hot}
  const realisedP = {};       // every traded good's realised price (unrounded) — the outer loop's read
  const popShareOf = {};      // every traded good's pop share of buy — the re-anchor gate
  const thinOf = {};          // a market too thin to anchor on: its price is band-edge noise, not a
                              // pop statement (era-0 luxuries flip 25↔175 on unit-sized moves)
  const ceilingBreach = [];   // restricted goods pinned at the +75% edge — the §10.15 verify line
  // …and the DESIGN side of the same rule: a book that ASKS a restricted good to sit at the edge is a
  // breach the composition can never avoid (the era-0 mandate of 175 is exactly this)
  const ceilingByDesign = [];
  for (const g in S.PRICES) if (RESTRICTED.has(g) && bookPrice(eIx, g) >= CEIL_EDGE) ceilingByDesign.push(g);
  const mandErrs = [];        // log((buy/sell)/rho) per NON-pop good — for the offset/dispersion split
  let checked = 0, onMandate = 0, tieredN = 0, tieredOnDesign = 0;
  for (const g in S.PRICES) {
    const { buy, sell } = E.scenarioBuySell(agg, g);
    if (buy < 1e-3 && sell < 1e-3) continue;
    const popBuy = ((agg.pop || {})[g] || 0) + ((agg.slave || {})[g] || 0);
    const popShare = buy > 0 ? popBuy / buy : 0;
    const praw = pricePctRaw(buy, sell);
    realisedP[g] = praw;
    popShareOf[g] = popShare;
    thinOf[g] = buy < 8;
    if (popShare > ANCHOR_POP_SHARE && !thinOf[g]) consumer.push({ g, p: praw, popShare, hot: Math.abs(praw - 100) > HIGHLIGHT_PP });
    if (RESTRICTED.has(g) && praw >= CEIL_EDGE && !thinOf[g]) ceilingBreach.push({ g, buy, sell });
    else if (buy > 1e-3 && sell > 1e-3) mandErrs.push(Math.log((buy / sell) / buyOverSell(bookPrice(eIx, g))));
    checked++;
    // the user's question, tracked directly: does this tiered output HOLD the design ladder?
    if (isIndustrial(g, era)) { tieredN++; if (Math.abs(praw - mandatePrice(g, era)) <= TOL_PP) tieredOnDesign++; }
    const implied = E.priceMultPct(buy, sell);
    const pm = bookPrice(eIx, g);
    if (Math.abs(implied - pm) <= TOL_PP) { onMandate++; continue; }
    const blds = byGood.get(g) || [];
    let adjS = 0, capS = 0;
    for (const b of blds) { const s = sellOfBuilding(b, g); adjS += s; if ((N.get(b) || 0) >= scaleCapOf(b) * 0.99) capS += s; }
    const atCap = adjS > 0 && capS / adjS > 0.9;
    const alive = blds.some(b => (N.get(b) || 0) > 0);
    const cls = !blds.length ? (tradeSupplied.has(g) ? 'trade' : walls.has(g) ? 'WALL' : 'fixed-supply')
              : atCap ? 'scale-capped' : popShare > ANCHOR_POP_SHARE ? 'pop-limited'
              : FUTILE.has(g) ? 'unsteerable'
              : alive ? 'unconverged' : 'died-out';
    offMandate.push({ g, mand: pm, implied, buy, sell, cls, popShare });
  }
  offMandate.sort((a, b) => Math.abs(b.implied - b.mand) - Math.abs(a.implied - a.mand));
  consumer.sort((a, b) => Math.abs(b.p - 100) - Math.abs(a.p - 100));
  // the AGGREGATE-SCARCITY split: with the population pinned, total supply is bounded, so an era whose
  // pop demand outruns the workforce shows every mandated good off by a COMMON factor while the
  // RELATIVE structure still holds. MEDIAN log-offset = that factor (robust — hardwood/artillery
  // outliers blow an RMS up); "structurally on" = goods within tolerance of the SHIFTED mandate.
  const sortedErrs = [...mandErrs].sort((a, b) => a - b);
  const aggMean = sortedErrs.length ? sortedErrs[sortedErrs.length >> 1] : 0;
  const structOn = mandErrs.filter(x => Math.abs(x - aggMean) < 0.035).length;
  const aggDisp = mandErrs.length
    ? Math.sqrt(mandErrs.reduce((a, b) => a + (b - aggMean) ** 2, 0) / mandErrs.length) : 0;
  // presence-based illogicality on the SEEDED scenario
  const faults = PMECON.ladderFaults(S.IND, {
    countOf: t => S.BLDNUM[t.key] || 0,
    profitOf: (i2, t2) => E.TPthr(i2, t2) / 100,
  });
  // composition
  const MANUFACTURED = new Set();
  for (const i2 of S.IND) for (const t2 of i2.tiers) MANUFACTURED.add(E.tierOut(i2, t2));
  const sec = { mfg_high: 0, mfg_low: 0, agri: 0, logging: 0, ore: 0, other: 0 };
  const indShare = [];
  // VALUE-ADDED composition (outputs − inputs at the scenario's prices, per producer — wages are not
  // in VA). Per tiered industry, with the untiered side in category aggregates. The user's "does this
  // look like an economy" read, on the same basis vanilla GDP is measured (F45).
  const vaBy = {};                        // label -> £/wk of value added
  const addVA = (label, v) => { if (v) vaBy[label] = (vaBy[label] || 0) + v; };
  let grossAll = 0, vaAll = 0;
  for (const i2 of S.IND) {
    let v = 0, va = 0;
    for (const t2 of i2.tiers) {
      const c = S.BLDNUM[t2.key] || 0; if (!c) continue;
      const k = E.thruMult(t2.key);
      const vv = c * k * E.outputValue(i2, t2, true);
      v += vv;
      va += c * k * (E.outputValue(i2, t2, true) - E.inputValue(t2, true));
      sec[Object.keys(t2.inputs || {}).some(g => MANUFACTURED.has(g)) ? 'mfg_high' : 'mfg_low'] += vv;
    }
    if (v > 0) indShare.push({ id: i2.id, v });
    if (va) addVA(i2.id, va);
    grossAll += v; vaAll += va;
  }
  for (const b of E.refBuildings()) {
    const c = S.BLDNUM[b] || 0; if (!c) continue;
    const k = E.thruMult(b), g2 = E.selGoods(E.refSel(b));
    const va = c * k * (E.goodsVal(g2.out, true) - E.goodsVal(g2.in, true));
    const cat = catOf(b);
    const vaLabel = E.isSubsistenceBuilding(b) ? '(subsistence)'
      : isUrban(b) ? '(urban centres)'
      : cat === 'logging' ? '(logging)'
      : (AGRICULTURE_CATS.has(cat) || cat === 'fishing_whaling') ? '(agriculture)'
      : (cat === 'mining' || cat === 'gold_fields' || cat === 'oil' || cat === 'rubber') ? '(extraction)'
      : '(support/other)';
    addVA(vaLabel, va); vaAll += va;
    if (E.isSubsistenceBuilding(b)) continue;
    const v = c * k * E.goodsVal(g2.out, true);
    if (!(v > 0)) continue;
    grossAll += v;
    if (cat === 'logging') sec.logging += v;
    else if (AGRICULTURE_CATS.has(cat) || cat === 'fishing_whaling') sec.agri += v;
    else if (cat === 'mining' || cat === 'gold_fields' || cat === 'oil' || cat === 'rubber') sec.ore += v;
    else sec.other += v;
  }
  const vaList = Object.entries(vaBy).map(([id, v]) => ({ id, v, share: v / Math.max(1, vaAll) }))
    .sort((a, b) => b.v - a.v);
  indShare.forEach(s => { s.share = s.v / Math.max(1, grossAll); });
  indShare.sort((a, b) => b.share - a.share);
  const battalions = Object.values(S.UNITNUM).reduce((a, c) => a + c, 0);
  let armyBill = 0;
  for (const u of E.unitTypes()) { const n = S.UNITNUM[E.unitRowKey(u, false)] || 0;
    if (n) armyBill += n * E.goodsVal(E.unitGoodsIO(u).in, true); }
  const gdp = E.scenarioValueAdded();
  // ---- the UI PRESET — the same schema era_scenarios.mjs writes into config/era_presets.json, so
  // extract_presets.ps1 can pass it straight through into ui/presets.js and the balance sheet's
  // preset bar renders it like any other scenario. Counts stay FRACTIONAL (this solver's convention;
  // the order book multiplies, so the UI arithmetic is exact either way).
  const round2 = x => Math.round(x * 100) / 100;
  const preset = {
    id: `inv${era}_${FIT.eras[eIx].year}`,
    label: String(FIT.eras[eIx].year),
    era, year: FIT.eras[eIx].year,
    group: 'Inverse solve · designed ladder, pop-limited yields (§10.65.2)',
    country: null,
    base_wage: S.BASE_WAGE,
    working_adult_ratio: WORK_RATIO,
    base_wage_note: `era ${era} lower-stratum SoL ${FIT.eras[eIx].sol} via FINDINGS F26 (the FIT's wage)`,
    market: [],
    buildings: (() => { const o = {}; for (const b in S.BLDNUM) { const v = round2(S.BLDNUM[b]); if (v > 0) o[b] = v; } return o; })(),
    pms: (() => { const o = {};
      for (const i2 of S.IND) for (const t2 of i2.tiers) if (S.BLDNUM[t2.key]) o[t2.key] = { ...t2._sec };
      for (const b in S.REFSEL) if (S.BLDNUM[b]) o[b] = { ...S.REFSEL[b] }; return o; })(),
    pops: Object.fromEntries(Object.entries(S.POPS).map(([k, v]) => [k, Math.round(v)])),
    pops_by_profession: { ...POPPROF },
    sol: { ...S.SOL },
    units: (() => { const o = {}; for (const k in S.UNITNUM) { const v = Math.round(S.UNITNUM[k]); if (v > 0) o[k.replace(/\|peace$/, '')] = v; } return o; })(),
    nonbuy: {},
    nonsell: (() => { const o = {}; for (const g in S.ADDSELL) { const v = round2(S.ADDSELL[g]); if (v > 0) o[g] = v; } return o; })(),
    throughput: { ...S.THRU },
    prices: (() => { const o = {}; for (const g in S.PRICES) o[g] = Math.round((S.thresholds[g] ?? 100) * 10) / 10; return o; })(),
    subsistence: { free_arable: 0, capacity_jobs: Math.round(S.POPS.peasants * WORK_RATIO),
                   peasant_workforce: Math.round(S.POPS.peasants * WORK_RATIO), staffing: 1.0,
                   levels: round2(S.BLDNUM.building_subsistence_farm || 0) },
    measured: null,
    notes: [`Synthetic era-${era} scenario from the INVERSE solve (tools/era_inverse.mjs, §10.65.2).`,
            `Every tiered output DESIGNS at 175−25pp×era; a pop-dominated good that refuses the design is re-anchored to what pops support.`,
            `Counts are FRACTIONAL by this solver's convention; prices are what this composition's own order book produces.`,
            `Pair with the red 'recipes: solver 2' button — these counts were seeded against THAT recipe book, not the mod config's.`],
  };
  return {
    eIx, era, iters, resid, N, FIXED1, byGood, placement, refProducers,
    tradeSupplied: [...tradeSupplied], walls: [...walls], offMandate, checked, onMandate,
    consumer, realisedP, popShareOf, thinOf, tieredN, tieredOnDesign,
    ceilingBreach, ceilingByDesign,
    futile: [...FUTILE], aggMean, aggDisp, structOn, mandN: mandErrs.length,
    faults, sec, indShare, grossAll, gdp, vaList, vaAll,
    pops: { ...S.POPS }, jobs: productiveWorkforce(),
    armyShare: gdp > 0 ? armyBill / gdp : 0, battalions,
    constrShare: gdp > 0 ? constrCost() / gdp : 0,
    counts: { ...S.BLDNUM }, preset,
  };
}

// ===================================================================================================
// RUN + REPORT
// ===================================================================================================
console.log('THE INVERSE SOLVE, PASS 3 — the DESIGN LADDER with pop-limited yields (experimental, §10.65)');
console.log(`  design: every TIERED INDUSTRY\'S OUTPUT at 175 − 25·era (${FIT.eras.map(e => 175 - 25 * e.era).join(' · ')}) — consumer chains included; everything else 100`);
console.log(`  the ladder yields ONLY where pop demand refuses it: a pop-dominated good (> ${ANCHOR_POP_SHARE * 100}% of buy) persistently off its book`);
console.log(`  re-anchors to what pops support — each yield is a NAMED CONFLICT; ⚠ flags a pop price >${HIGHLIGHT_PP}pp from base`);
if (PLATEAU_HOLD) console.log('  INV_PLATEAU=1: a plateaued good\'s design holds its last tier era\'s price');
console.log('');

console.log('── OUTER LOOP: design book ↔ pop-limited re-anchoring ──');
let SCEN = [];
for (let outer = 1; outer <= OUTER; outer++) {
  // re-anchor BEFORE recipes and seeds, so within one pass recipes, scenarios and the book agree:
  // a pop-dominated good persistently off its book yields toward its realised price; an anchored
  // good keeps tracking (which also lets it converge BACK to the design if pops turn out to bear it)
  if (outer > 1) {
    for (let e = 0; e < FIT.eras.length; e++) {
      const r = SCEN[e];
      for (const g in r.realisedP) {
        if (r.thinOf[g]) continue;                 // a thin market's price is noise — never anchor on it
        const book = bookPrice(e, g);
        const miss = Math.abs(r.realisedP[g] - book) > TOL_PP;
        if (BOOK_OVR[e][g] != null) {
          BOOK_OVR[e][g] = 0.5 * book + 0.5 * r.realisedP[g];       // damped tracking once anchored
        } else if ((r.popShareOf[g] || 0) > ANCHOR_POP_SHARE && miss) {
          BOOK_OVR[e][g] = r.realisedP[g];   // FIRST anchoring jumps straight to the realised price —
                                             // the design was refused, so the midpoint means nothing,
                                             // and half-steps just feed the recipe solve big transients
        }
      }
    }
  }
  deriveRecipes();
  SCEN = [];
  for (let e = 0; e < FIT.eras.length; e++) SCEN.push(seedScenario(e));
  let maxD = 0, maxDGood = '', anchors = 0;
  for (let e = 0; e < FIT.eras.length; e++) {
    anchors += Object.keys(BOOK_OVR[e]).length;
    for (const g in BOOK_OVR[e]) {
      const p = SCEN[e].realisedP[g];
      if (p == null || SCEN[e].thinOf[g]) continue;
      const d = Math.abs(p - bookPrice(e, g));
      if (d > maxD) { maxD = d; maxDGood = `${g}@e${e}`; }
    }
  }
  console.log(`  pass ${outer}: pop-limited anchors ${anchors} · worst anchored-good residual ${maxD.toFixed(1)}pp (${maxDGood || '—'})`);
  if (process.env.INV_DEBUG) {
    for (const g of process.env.INV_DEBUG.split(',')) {
      console.log(`    [debug ${g}] ` + FIT.eras.map((_, e) =>
        `e${e} book ${Math.round(bookPrice(e, g))}${BOOK_OVR[e][g] != null ? '*' : ''}→real ${SCEN[e].realisedP[g] != null ? Math.round(SCEN[e].realisedP[g]) : '—'}`).join(' · '));
    }
  }
  if (outer > 1 && maxD < 2) break;
}

console.log('\n── PHASE 1: RECIPES DERIVED AT THE HYBRID BOOK (dominant target +5%, shipyards −30pp, solve_profit honoured) ──');
{
  const capN = {};
  for (const r of RECIPES) { const c = r.skip ? 'skip:' + r.skip : (r.cap || 'on-target'); capN[c] = (capN[c] || 0) + 1; }
  console.log('  ' + Object.entries(capN).map(([k, v]) => `${k} ${v}`).join(' · '));
  const rows = RECIPES.filter(r => !r.skip);
  for (const i of S.IND) {
    const mine = rows.filter(r => r.ind === i).sort((a, b) => a.t.era - b.t.era);
    if (!mine.length) continue;
    console.log(`  ${W(i.id, 14)} ${mine.map(r =>
      `e${r.t.era} ${pct(r.margin)}${r.cap ? '(' + r.cap[0] + ')' : ''} be${r.be.toFixed(0)}`).join(' · ')}`);
  }
  console.log('  (margin = at its OWN era\'s BOOK prices — mandate or realised consumer price; cap letter: r=ratchet s=solvency l=lean-floor i=insolvent-at-target; be = full BE % of base)');
}

console.log('\n── PHASE 2: THE ANALYTIC LADDER (margins are count-independent given the book) ──');
const LADDERS = [];
for (let e = 0; e < FIT.eras.length; e++) {
  console.log(`  era ${e} (${FIT.eras[e].year}) — industrial mandate ${175 - 25 * e}%, consumer goods at their realised prices  [↑ = leading rung]`);
  const { faults } = ladderAt(e);
  LADDERS.push(faults);
  console.log(`    faults: loss ${faults.loss.length} [${faults.loss.join(',')}] · stale-profitable ${faults.stale.length} [${faults.stale.join(',')}] · inverted ${faults.inverted.length} [${faults.inverted.join(',')}] — excl. excused: ${faults.net}`);
}
console.log(`  TOTAL analytic illogicality (all six eras, excl. excused): ${LADDERS.reduce((a, f) => a + f.net, 0)}`
  + `  (incl.: ${LADDERS.reduce((a, f) => a + f.total, 0)})`);

console.log('\n── PHASE 3: THE SEEDED SCENARIOS (final outer pass) ──');
const wrapPrint = (parts, indent = '      ') => {
  let line = '';
  for (const p of parts) {
    if (line && (line + ' · ' + p).length > 104) { console.log(indent + line); line = p; }
    else line = line ? line + ' · ' + p : p;
  }
  if (line) console.log(indent + line);
};
for (const r of SCEN) {
  const e = r.eIx;
  console.log(`\n  ═ era ${e} (${FIT.eras[e].year}) — ${r.iters} iterations, steerable-core residual ${r.resid.toFixed(3)}`);
  console.log(`    goods on their BOOK price: ${r.onMandate}/${r.checked} within ±${TOL_PP}pp`
    + ` · structurally on (after common demand shift ×${Math.exp(r.aggMean).toFixed(2)}): ${r.structOn}/${r.mandN}`);
  console.log(`    ⭐ DESIGN LADDER on tiered outputs: ${r.tieredOnDesign}/${r.tieredN} hold 175−25·era`);
  const yields = Object.keys(BOOK_OVR[e]).sort();
  const yTier = yields.filter(g => isIndustrial(g, e));
  const yOther = yields.filter(g => !isIndustrial(g, e));
  if (yTier.length) {
    console.log(`    ⚠ LADDER YIELDS (tiered outputs where pop demand refused the design — design→achieved):`);
    wrapPrint(yTier.map(g => `${g} ${Math.round(mandatePrice(g, e))}→${Math.round(r.realisedP[g] ?? bookPrice(e, g))}`));
  }
  if (yOther.length) {
    console.log(`    pop-limited non-tiered (design 100 → achieved):`);
    wrapPrint(yOther.map(g => `${g} ${Math.round(r.realisedP[g] ?? bookPrice(e, g))}`));
  }
  const hot = r.consumer.filter(c => c.hot);
  console.log(`    POP-PRICED GOODS (pop > ${ANCHOR_POP_SHARE * 100}% of buy; ⚠ = >${HIGHLIGHT_PP}pp from base — ${hot.length} of ${r.consumer.length}):`);
  wrapPrint(r.consumer.map(c => `${c.hot ? '⚠' : ''}${c.g} ${Math.round(c.p)}`));
  if (r.futile.length) console.log(`    unsteerable (steering moved producers, ratio did not move): ${r.futile.join(', ')}`);
  console.log(`    INDUSTRIAL-INPUT CEILING (§10.15 as a verify line): ` + (r.ceilingBreach.length
    ? `⚠ ${r.ceilingBreach.length} consumable input(s) AT the +75% edge — `
      + r.ceilingBreach.map(c => { const o = r.offMandate.find(x => x.g === c.g);
          return `${c.g} (buy ${fmtN(c.buy)} / sell ${fmtN(c.sell)}${o ? ', ' + o.cls : ''})`; }).join(' · ')
    : 'clear')
    + (r.ceilingByDesign.length ? `   ⚠ the DESIGN itself asks the edge for: ${r.ceilingByDesign.length} good(s) (era-0 mandate 175)` : ''));
  if (r.offMandate.length) {
    console.log('    OFF MANDATE:');
    for (const o of r.offMandate.slice(0, 14)) {
      console.log(`      ${W(o.g, 16)} mand ${W(Math.round(o.mand), 4)} implied ${W(o.implied, 4)} buy ${W(fmtN(o.buy), 7)} sell ${W(fmtN(o.sell), 7)} pop ${W(Math.round(o.popShare * 100) + '%', 4)} ${o.cls}`);
    }
    if (r.offMandate.length > 14) console.log(`      … +${r.offMandate.length - 14} more`);
  }
  if (r.tradeSupplied.length) console.log(`    trade-supplied (no domestic producer, non-industrial): ${r.tradeSupplied.join(', ')}`);
  if (r.walls.length) console.log(`    WALLS (industrial good demanded, no producer possible): ${r.walls.join(', ')}`);
  // industries that died out under the mandate
  const died = [];
  for (const p of r.placement) {
    if (p.withheld) continue;
    const alive = p.rows.some(x => (r.counts[x.t.key] || 0) > 0.05);
    if (!alive) died.push(p.ind.id);
  }
  if (died.length) console.log(`    industries absent under the mandate (no demand at these prices): ${died.join(', ')}`);
  console.log(`    ladder faults on the seeded presence (excl. excused): ${r.faults.net}  (loss [${r.faults.loss.join(',')}] stale [${r.faults.stale.join(',')}] inv [${r.faults.inverted.join(',')}])`);
  const p = r.pops;
  console.log(`    pops ${fmtN(p.total)} (premise ${fmtN(POP_TOTAL[e])}) · peasants ${(100 * p.peasants / Math.max(1, p.total)).toFixed(0)}% · productive jobs ${fmtN(r.jobs)}`);
  console.log(`    GDP £${fmtN(r.gdp)}/wk · army ${(r.armyShare * 100).toFixed(1)}% (${Math.round(r.battalions)} btn) · constr ${(r.constrShare * 100).toFixed(1)}% (target ${(CONSTR_BY_ERA[e] * 100).toFixed(0)}%)`);
  const st = r.sec, tot = Math.max(1, r.grossAll);
  console.log(`    output mix: mfg(mfg-fed) ${(100 * st.mfg_high / tot).toFixed(0)}% · mfg(raw-fed) ${(100 * st.mfg_low / tot).toFixed(0)}% · agri ${(100 * st.agri / tot).toFixed(0)}% · logging ${(100 * st.logging / tot).toFixed(0)}% · ore ${(100 * st.ore / tot).toFixed(0)}% · other ${(100 * st.other / tot).toFixed(0)}%`);
  console.log(`    VALUE-ADDED composition (Σ £${fmtN(r.vaAll)}/wk; outputs − inputs at these prices, untiered side in (aggregates)):`);
  wrapPrint(r.vaList.map(x => `${x.id} ${(100 * x.share).toFixed(1)}%`));
  console.log(`    top industries: ${r.indShare.slice(0, 6).map(s => `${s.id} ${(s.share * 100).toFixed(1)}%${s.share > 0.2 ? '⚠' : ''}`).join(' · ')}`);
  // the coherence read: biggest tier counts
  const tiers = [];
  for (const p2 of r.placement) for (const x of p2.rows) {
    const c = r.counts[x.t.key] || 0; if (c > 0) tiers.push({ k: `${p2.ind.id} e${x.t.era}`, c });
  }
  tiers.sort((a, b) => b.c - a.c);
  console.log(`    largest tier counts: ${tiers.slice(0, 8).map(x => `${x.k} ${x.c.toFixed(1)}`).join(' · ')}`);
  const refs = r.refProducers.map(b => ({ b: b.replace(/^building_/, ''), c: r.counts[b] || 0 }))
    .filter(x => x.c > 0.5).sort((a, b) => b.c - a.c);
  console.log(`    largest raw producers: ${refs.slice(0, 8).map(x => `${x.b} ${x.c.toFixed(0)}`).join(' · ')}`);
  console.log(`    support: gov ${fmtN(r.counts.building_government_administration || 0)} · urban ${fmtN(r.counts.building_urban_center || 0)} · constr ${fmtN(r.counts[CONSTRUCTION_BLD] || 0)} · trade ${fmtN(r.counts.building_trade_center || 0)}`);
}

console.log('\n── SUMMARY ──');
console.log(`  analytic illogicality by era (excl.): ${LADDERS.map(f => f.net).join(' / ')} — total ${LADDERS.reduce((a, f) => a + f.net, 0)}`);
console.log(`  seeded   illogicality by era (excl.): ${SCEN.map(r => r.faults.net).join(' / ')} — total ${SCEN.reduce((a, r) => a + r.faults.net, 0)}`);
console.log(`  ⭐ DESIGN LADDER held on tiered outputs by era: ${SCEN.map(r => `${r.tieredOnDesign}/${r.tieredN}`).join(' · ')}`);
console.log(`  ladder yields (pop-limited anchors, tiered) by era: ${SCEN.map(r => Object.keys(BOOK_OVR[r.eIx]).filter(g => isIndustrial(g, r.eIx)).length).join(' · ')}`);
console.log(`  goods on their book by era: ${SCEN.map(r => `${r.onMandate}/${r.checked}`).join(' · ')}`);
console.log(`  pop-priced goods ⚠ beyond ±${HIGHLIGHT_PP}pp by era: ${SCEN.map(r => `${r.consumer.filter(c => c.hot).length}/${r.consumer.length}`).join(' · ')}`);
console.log(`  structurally on book (after common shift ×): ${SCEN.map(r => `${r.structOn}/${r.mandN} (×${Math.exp(r.aggMean).toFixed(2)})`).join(' · ')}`);
console.log(`  steerable-core residual by era: ${SCEN.map(r => r.resid.toFixed(3)).join(' · ')}`);
console.log(`  unsteerable goods by era: ${SCEN.map(r => r.futile.length).join(' · ')}`);
console.log(`  INDUSTRIAL-INPUT CEILING breaches by era: ${SCEN.map(r => r.ceilingBreach.length).join(' · ')}`
  + `  [${[...new Set(SCEN.flatMap(r => r.ceilingBreach.map(c => c.g)))].join(', ') || 'none'}]`);
// the recurring ⚠ offenders — a good far from base in several eras is a structural statement, not noise
{
  const hotBy = new Map();
  for (const r of SCEN) for (const c of r.consumer) if (c.hot) {
    if (!hotBy.has(c.g)) hotBy.set(c.g, []);
    hotBy.get(c.g).push(`e${r.eIx} ${Math.round(c.p)}`);
  }
  const rec = [...hotBy.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length);
  if (rec.length) {
    console.log(`  ⚠ RECURRING (>${HIGHLIGHT_PP}pp from base in 2+ eras):`);
    for (const [g, v] of rec) console.log(`    ${W(g, 18)} ${v.join(' · ')}`);
  }
}

if (WRITE) {
  const out = {
    _comment: 'GENERATED by tools/era_inverse.mjs — the INVERSE-SOLVE experiment, PASS 3 (§10.65.2): '
      + 'the DESIGN LADDER with pop-limited yields. Every tiered industry output designs at '
      + '175-25pp*era (consumer chains included), everything else at 100; a pop-dominated good that '
      + 'persistently refuses its design re-anchors to what pops support, each yield a named '
      + 'conflict. NOT read by the build; a design study artifact.',
    mandate: FIT.eras.map((e, i) => ({ era: e.era, year: e.year, industrial: 175 - 25 * e.era, raw: 100 })),
    ladder_yields: FIT.eras.map((e, i) => ({
      era: e.era,
      tiered: Object.fromEntries(Object.keys(BOOK_OVR[i]).filter(g => isIndustrial(g, e.era)).sort()
        .map(g => [g, { design: Math.round(mandatePrice(g, e.era)), achieved: Math.round(SCEN[i].realisedP[g] ?? BOOK_OVR[i][g]) }])),
      non_tiered: Object.fromEntries(Object.keys(BOOK_OVR[i]).filter(g => !isIndustrial(g, e.era)).sort()
        .map(g => [g, Math.round(SCEN[i].realisedP[g] ?? BOOK_OVR[i][g])])),
    })),
    pop_prices: FIT.eras.map((e, i) => ({
      era: e.era,
      prices: Object.fromEntries((SCEN[i] ? SCEN[i].consumer : []).map(c => [c.g, Math.round(c.p)])),
      beyond_30pp: (SCEN[i] ? SCEN[i].consumer : []).filter(c => c.hot).map(c => c.g),
    })),
    recipes: Object.fromEntries(RECIPES.filter(r => !r.skip).map(r => [r.t.key, {
      industry: r.ind.id, era: r.t.era, inputs: { ...r.t.inputs }, output_qty: r.t.output_qty,
      margin_own_era: Math.round(r.margin * 1000) / 1000, cap: r.cap || null, be: Math.round(r.be),
    }])),
    scenarios: SCEN.map(r => ({
      era: r.era, year: FIT.eras[r.eIx].year, iterations: r.iters, residual: Math.round(r.resid * 1000) / 1000,
      goods_on_mandate: `${r.onMandate}/${r.checked}`,
      counts: Object.fromEntries(Object.entries(r.counts).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      pops: Object.fromEntries(Object.entries(r.pops).map(([k, v]) => [k, Math.round(v)])),
      gdp_weekly: Math.round(r.gdp),
      va_by_industry: Object.fromEntries(r.vaList.map(x => [x.id,
        { weekly: Math.round(x.v), share: Math.round(x.share * 1000) / 1000 }])),
      off_mandate: r.offMandate.map(o => ({ good: o.g, mandated: o.mand, implied: o.implied, class: o.cls })),
      industrial_input_ceiling: { at_edge: r.ceilingBreach.map(c => c.g), design_asks_edge: r.ceilingByDesign },
      walls: r.walls, trade_supplied: r.tradeSupplied,
      faults: { loss: r.faults.loss, stale: r.faults.stale, inverted: r.faults.inverted, net: r.faults.net },
    })),
    // THE UI PRESETS — consumed by tools/extract_presets.ps1 (pass-through into ui/presets.js, like
    // config/era_presets.json's), so the balance sheet grows a second row of six era scenarios
    presets: SCEN.map(r => r.preset),
  };
  const path = artifact('era_inverse');
  writeFileSync(path, JSON.stringify(out, null, 1));
  console.log(`\nwrote ${path}`);
}
