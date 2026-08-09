// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// THE MACROSCENARIO — explicit reasonability bounds the era scenarios must respect (user, 2026-08-09).
//
// The six scenarios describe ONE country, and that country is a CHOICE: a large, autarkic, US-like,
// industry-oriented economy. Parts of that choice were already scattered through the solver as separate
// rulings — the US population path and peasant shares (POP_TOTAL / PEASANT_SHARE), the rice ban
// (ERA_ALLOW_RICE), the temperate-leaning subsistence mix, gold's exclusion. This module makes the
// REASONABILITY half explicit: in a large autarkic market, NO industry that could exist should be dead,
// and NONE should dominate the economy — however cleanly its own margin solves. "Three total railway
// levels in 1900" is the case that prompted it: every margin was on target, the price path was tracked,
// and the scenario was still not a picture of 1900 America.
//
// It is a SOLVER-SIDE governance layer, like the rice ban: the UI is untouched, nothing here is emitted
// to the game, and a future macroscenario (a small trade-oriented country, say) is a second entry in
// MACROS with different bounds — selected by ERA_MACRO=<id>, never edited in place.
//
// THREE LEVELS, checked per era. 1780 IS EXEMPT (from_era: 1): the bounds are drawn from
// industrial-era reasoning and an 1780 workshop economy predates all of it.
//   1. PROFESSIONS        — share of TOTAL population per profession. VERIFIED, not enforced: the
//                           professions are downstream of building employment and the measured wedge
//                           (§10.45), so there is no honest lever besides the ones that already govern
//                           them. A breach is reported loudly and means a design input drifted.
//   2. INDUSTRY CATEGORIES — share of GDP per category (the UI's own sector split: manufacturing with
//                           manufactured inputs, manufacturing from raw inputs, extraction & logging,
//                           agriculture incl. fishing/whaling). ENFORCED through building counts.
//   3. INDUSTRY TYPES      — share of GDP per config industry, ALL TIERS COMBINED. ENFORCED through
//                           building counts. This is the level that forbids the dead-railway state.
//
// ⭐ BOUNDS ARE ON GROSS PRODUCT (VALUE ADDED), NOT GROSS OUTPUT — user ruling. An industry's gross
// product is its building outputs minus its building inputs at market prices, the same production-side
// quantity scenarioValueAdded()/F45 measures GDP with, so a share here is VA_industry / GDP. Two
// consequences to keep in mind reading the numbers:
//   * An industry with NEGATIVE pre-wage balance has negative gross product, and growing it makes the
//     share WORSE — a floor is unreachable for it by construction. The enforcement's futility guard
//     detects that, blocks the industry and reports it by name; the report's NEGATIVE GROSS PRODUCT
//     line is the standing list (steel@1836, artillery/explosives@1870 on the shipped state — debut-era
//     squeezes; shipyards always, from the unmodelled naval income).
//   * The model's GDP is net of construction's and the army's goods bills (both consume and sell
//     nothing), so category shares can legitimately sum past 100%. The bounds are calibrated on that
//     same denominator — do not "fix" them against a real-world GDP composition.
//
// ⚠ THE BOUNDS ARE DELIBERATELY BROAD, JUDGEMENT CALLS STATED AS SUCH — same doctrine as SCALE_LIMIT.
// They are calibrated on the shipped 2026-08-09 presets so that today's state PASSES except where it is
// genuinely unreasonable (railway ~0% of GDP in 1870/1900 against a floor of 1%), and they exist to
// catch degeneracy, not to sculpt the composition — the price/count feedback stays the sculptor. Widen
// with an argument; never narrow one just because the solver happens to sit inside it.
//
// ⚠ A FLOOR APPLIES ONLY WHERE THE INDUSTRY CAN EXIST. The date gate (§10.44), the chain rule, ERA_PRUNE
// and the extinct rule all outrank a floor: an industry those withhold is ABSENT, not dead, and its
// floor is waived that era (the solver checks placement, not this table). Caps always apply. lo = 0
// means "no floor" — presence is not demanded and negative gross product is tolerated (but reported).
// Shipyards and the art academy get no floor at any era: their targets are excused by construction
// (LADDER_EXCUSED), and a VA floor would re-impose through the back door what the excusal removed.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Format: [lo%, hi%] of GDP (industries/categories) or of total population (professions), indexed by
// era 0..5 (1780/1836/1870/1900/1920/1945). null = unconstrained that era. Values are PERCENT.

const MACROS = {
  usa: {
    id: 'usa',
    label: 'large autarkic industry-oriented US-like economy',
    from_era: 1,                      // 1780 exempt
    // ---- level 1: professions, % of total population (people, dependents included) -----------------
    // Verified only. Calibrated: shipped values sit mid-band everywhere; the bands say what would be
    // absurd (soldiers 15%, aristocrats 5%, laborers 70%), not what is optimal.
    professions: {
      laborers:    [null, [20, 55],   [25, 55],   [25, 55],   [20, 50],   [15, 45]],
      machinists:  [null, [0.25, 8],  [1, 12],    [3, 18],    [5, 25],    [8, 30]],
      farmers:     [null, [0.5, 15],  [1, 15],    [1, 15],    [1.5, 15],  [2, 15]],
      clerks:      [null, [1, 8],     [2, 12],    [3, 15],    [4, 20],    [5, 25]],
      shopkeepers: [null, [0.5, 8],   [1, 10],    [1.5, 12],  [2, 15],    [2, 15]],
      engineers:   [null, [0, 2],     [0.1, 5],   [1, 10],    [2, 15],    [3, 18]],
      bureaucrats: [null, [0.1, 4],   [0.1, 4],   [0.1, 4],   [0.1, 4],   [0.1, 4]],
      clergymen:   [null, [0.1, 4],   [0.1, 4],   [0.1, 4],   [0.1, 4],   [0.1, 4]],
      academics:   [null, [0.01, 2],  [0.01, 2],  [0.01, 2],  [0.01, 2],  [0.01, 2]],
      soldiers:    [null, [0.5, 6],   [0.5, 6],   [0.5, 6],   [0.5, 6],   [0.5, 6]],
      officers:    [null, [0.01, 1.5],[0.01, 1.5],[0.01, 1.5],[0.01, 1.5],[0.01, 1.5]],
      aristocrats: [null, [0.05, 3],  [0.05, 3],  [0.05, 2.5],[0.02, 1.5],[0.01, 1]],
      capitalists: [null, [0.02, 2],  [0.02, 2],  [0.02, 2],  [0.02, 2],  [0.02, 2]],
      peasants:    [null, [30, 60],   [20, 50],   [10, 35],   [5, 25],    [0, 12]],
    },
    // ---- level 2: industry categories, % of GDP (value added) -------------------------------------
    // The UI's sector split (scenarioSummary): mfg per TIER by the "consumes a good our ladder makes"
    // test; fishing/whaling counts as agriculture, gold is out of the model. Extraction's huge share is
    // structural to the model (raw VA is uncapped where manufacturing carries the 4:1 ceiling), so its
    // band is calibrated to THIS model, not to real-world national accounts.
    categories: {
      mfg_mfg:     [null, [2, 45],  [5, 50],  [10, 55], [12, 60], [12, 60]],
      mfg_raw:     [null, [3, 45],  [4, 45],  [4, 40],  [3, 35],  [2, 30]],
      extraction:  [null, [5, 55],  [10, 60], [15, 65], [15, 70], [15, 70]],
      agriculture: [null, [25, 85], [15, 75], [10, 65], [8, 55],  [5, 45]],
    },
    // ---- level 3: industry types, % of GDP (value added), all tiers combined ----------------------
    // The floor is the "no dead industries" half, the cap the "none dominates" half. Floors ramp with
    // an industry's maturity (a debut era earns a token floor, an established one a real one).
    industries: {
      food:           [null, [0.5, 12],  [0.5, 12],  [0.5, 12],  [0.5, 12],  [0.5, 12]],
      textile:        [null, [0.5, 15],  [0.5, 15],  [0.5, 15],  [0.5, 15],  [0.5, 15]],
      furniture:      [null, [0.2, 10],  [0.2, 10],  [0.2, 10],  [0.2, 10],  [0.2, 10]],
      paper:          [null, [0.1, 8],   [0.1, 8],   [0.1, 8],   [0.1, 8],   [0.1, 8]],
      tooling:        [null, [0.5, 12],  [0.5, 12],  [0.5, 12],  [0.5, 12],  [0.5, 12]],
      steel:          [null, [0, 10],    [0.5, 12],  [1, 12],    [1, 14],    [1, 15]],
      glass:          [null, [0.1, 8],   [0.2, 10],  [0.25, 10], [0.25, 10], [0.25, 10]],
      arms:           [null, [0.05, 6],  [0.05, 5],  [0.05, 5],  [0.05, 5],  [0.05, 5]],
      artillery:      [null, [0.02, 4],  [0.02, 4],  [0.05, 4],  [0.05, 4],  [0.05, 4]],
      munition:       [null, null,       [0.02, 3],  [0.05, 3],  [0.05, 3],  [0.05, 3]],
      explosives:     [null, null,       [0.02, 4],  [0.05, 4],  [0.05, 4],  [0.05, 4]],
      fertilizer:     [null, null,       [0.02, 4],  [0.05, 4],  [0.05, 4],  [0.05, 4]],
      synthetics:     [null, null,       [0.02, 3],  [0.05, 4],  [0.05, 4],  [0.05, 4]],
      motor:          [null, [0.05, 6],  [0.1, 6],   [0.25, 8],  [0.5, 10],  [0.5, 10]],
      automotive:     [null, null,       null,       [0.1, 8],   [0.25, 10], [0.25, 10]],
      electrics:      [null, null,       null,       [0.02, 5],  [0.1, 6],   [0.1, 6]],
      power:          [null, null,       null,       [0.05, 5],  [0.25, 6],  [0.25, 6]],
      port:           [null, [0.25, 8],  [0.25, 8],  [0.25, 8],  [0.25, 8],  [0.25, 8]],
      // The railway band is the one that prompted this module: 1%–15% of GDP through the railway age,
      // and the shipped 1870/1900 states (0.09% / 0.00%, two and three levels) are exactly what it
      // forbids. Whether the floor is REACHABLE at 1900 is a finding, not a given — urban centres
      // cover most pop transportation there — and the enforcement reports the wall when it hits one.
      railway:        [null, [0.05, 8],  [1, 15],    [1, 15],    [1, 15],    [0.75, 12]],
      shipyard:       [null, [0, 5],     [0, 5],     [0, 5],     [0, 5],     [0, 5]],
      shipyard_steam: [null, null,       [0, 5],     [0, 5],     [0, 5],     [0, 5]],
      art_academy:    [null, [0, 2],     [0, 2],     [0, 2],     [0, 2],     [0, 2]],
    },
  },
};

// The active macroscenario: ERA_MACRO=0/off disables the whole layer, ERA_MACRO=<id> selects one,
// unset = 'usa'. An unknown id throws — a typo must not silently unconstrain the solve.
export function activeMacro() {
  const v = process.env.ERA_MACRO;
  if (v === '0' || v === 'off') return null;
  const id = v || 'usa';
  const m = MACROS[id];
  if (!m) throw new Error(`ERA_MACRO=${id} names no macroscenario (have: ${Object.keys(MACROS).join(', ')})`);
  return m;
}

// [lo, hi] as FRACTIONS (0.01 = 1%), or null when unconstrained. `kind` is professions | categories |
// industries; eras beyond the table's length reuse its last entry (defensive — tables carry all six).
export function macroBounds(macro, kind, key, eIx) {
  if (!macro || eIx < macro.from_era) return null;
  const t = (macro[kind] || {})[key];
  if (!t) return null;
  const b = t[Math.min(eIx, t.length - 1)];
  return b ? [b[0] / 100, b[1] / 100] : null;
}

// Fail-loud validation, called by era_scenarios with the live model: every key must name something that
// exists, or the constraint it carries silently binds nothing.
export function validateMacro(macro, { industryIds, professionIds, categoryIds }) {
  if (!macro) return;
  for (const id in macro.industries) if (!industryIds.has(id))
    throw new Error(`era_macro(${macro.id}): unknown industry '${id}'`);
  for (const p in macro.professions) if (!professionIds.has(p))
    throw new Error(`era_macro(${macro.id}): unknown profession '${p}'`);
  for (const c in macro.categories) if (!categoryIds.has(c))
    throw new Error(`era_macro(${macro.id}): unknown category '${c}'`);
  for (const kind of ['professions', 'categories', 'industries']) {
    for (const k in macro[kind]) for (const b of macro[kind][k]) {
      if (b && !(b.length === 2 && b[0] <= b[1]))
        throw new Error(`era_macro(${macro.id}): bad bound ${kind}.${k} [${b}]`);
    }
  }
}
