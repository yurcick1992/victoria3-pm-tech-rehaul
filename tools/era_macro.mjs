// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// THE MACROSCENARIO — reasonability bounds the era scenarios must respect (user, 2026-08-09).
//
// The six scenarios describe ONE country, and that country is a CHOICE: a large, autarkic, US-like,
// industry-oriented economy. Parts of that choice were already scattered through the solver as separate
// rulings — the US population path and peasant shares (POP_TOTAL / PEASANT_SHARE), the rice ban
// (ERA_ALLOW_RICE), the temperate-leaning subsistence mix, gold's exclusion. This module makes the
// REASONABILITY half explicit: in a large autarkic market, NO industry that could exist should be dead,
// and NONE should dominate the economy — however cleanly its own margin solves. "Three total railway
// levels in 1900" is the case that prompted it.
//
// It is a SOLVER-SIDE governance layer, like the rice ban: the UI is untouched, nothing here is emitted
// to the game, and a future macroscenario (a small trade-oriented country, say) is a second entry in
// MACROS with different data — selected by ERA_MACRO=<id>, never edited in place.
//
// ═══ THE DERIVATION (user-ruled 2026-08-09, second ruling — §10.47.2). BOUNDS ARE NO LONGER HAND
// BANDS: they are computed from the REAL US ECONOMY at each scenario date, made commensurable with the
// model by the user's three-step procedure:
//   1. IMPORT ADJUSTMENT (the autarky premise). Where the US was a noticeable importer of an industry's
//      output (German dyes, Chilean nitrates), X is scaled up to CONSUMPTION — production plus imports —
//      using a narratively similar industry of similar traded value as the scale reference where the
//      direct number is unavailable. The same logic extends to the ARMY PREMISE: the scenario keeps a
//      standing army at 5% of GDP where the real US peacetime military ran ~1%, so the war industries'
//      X (arms / artillery / munitions) is scaled ×~5 to the demand the premise creates.
//   2. MAP OR DROP. Every real industry is mapped into our classification; what is absolutely
//      unmappable is REMOVED from the calculation — trade margins, finance, housing, domestic and
//      professional services, government, road transport, printing/publishing, and construction (a
//      demand sink in this model, not an industry). BASKET REMAPS where our industry's goods basket
//      cuts across census lines are part of this step, each recorded below (flour milling, meatpacking
//      and dairy map to AGRICULTURE — the game sells grain/meat/fish to pops raw, so that value sits on
//      our farms; distilling likewise, via the farm secondary methods; apparel and footwear fold into
//      TEXTILE, which makes clothes; pottery and household ceramics fold into GLASS; heavy electrical
//      equipment folds into MOTOR, leaving ELECTRICS the communications/consumer-electronics basket).
//   3. RENORMALIZE. The import rule inflates the total and the drop rule shrinks it, so shares are
//      restated over the MAPPED COMMODITY ECONOMY — and the model's own shares are computed over ITS
//      mapped total (every tier industry + the raw reference producers + subsistence; urban centres are
//      the model's unmappable-services counterpart and are excluded symmetrically). X and Y below are
//      therefore SHARES OF THE MAPPED COMMODITY ECONOMY, in percent, not of raw GDP.
//
// Industry gates are [X/4, 4X]; group gates are [Y/3, 2Y] (both user-ruled). 1780 stays EXEMPT.
// Sources: Historical Statistics of the US, Census of Manufactures years, Gallman's commodity-output
// series; values carried at 2 significant figures — the bands are factor-4/-3, and that is the
// precision the data must support, not the decimal.
//
// ⚠ TWO STRUCTURAL FINDINGS THE DERIVATION EXPOSES, deliberately kept visible rather than absorbed:
//   * EXTRACTION runs ×2–4 the real share at every date (real mining+logging is 4.9–9.3% of the mapped
//     economy; the model runs 18–52%), because V3's price vector books the value at the pithead — a
//     mine turns ~£60 of tools into ~£1,200 of ore, where reality's value accrues in processing and
//     distribution — and manufacturing additionally wears the 4:1 value-added cap. No count bound can
//     fix a price-vector property without starving every input chain into the +75% ceiling, so the
//     extraction cap is VERIFY-ONLY: computed, reported red, never enforced.
//   * RAILWAY's real share of the mapped economy is ~7–11% through 1870–1920, so its derived floor
//     (~1.8–2.8%) is far above anything the model can reach — transportation demand in V3 is a pop
//     need plus wage-arbitrage freight methods, an order of magnitude short of reality's freight
//     economy. The bound stands as the honest statement of that gap (§10.47.1's wall, sharpened).
//
// ⚠ A FLOOR APPLIES ONLY WHERE THE INDUSTRY CAN EXIST. The date gate (§10.44), the chain rule, ERA_PRUNE
// and the extinct rule all outrank a floor: an industry those withhold is ABSENT, not dead, and its
// floor is waived that era (the solver checks placement, not this table). `nofloor` marks industries
// whose floor is waived by construction at every era: shipyards (value added negative by construction —
// naval income is unmodelled, LADDER_EXCUSED) and the art academy (no real-world counterpart survives
// the mapping; its hand cap stays as a sanity rail). Caps always apply except where `verify` says the
// breach is structural.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Arrays are indexed by era 0..5 (1780/1836/1870/1900/1920/1945); null = unconstrained that era.
// X and Y are PERCENT of the mapped commodity economy.

const MACROS = {
  usa: {
    id: 'usa',
    label: 'large autarkic industry-oriented US-like economy',
    from_era: 1,                      // 1780 exempt
    // ---- level 1: professions, % of total population (people, dependents included) -----------------
    // VERIFIED only — professions are downstream of building employment and the measured wedge
    // (§10.45), so there is no honest lever besides the ones that already govern them. Hand bands,
    // calibrated 2026-08-09; the shipped state sits mid-band everywhere. (The population side has no
    // mapped-economy problem, so the §10.47.2 derivation does not touch this level.)
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
    // ---- level 2: groups, Y = real US share of the mapped commodity economy, gates [Y/3, 2Y] -------
    // manufacturing = every tier industry EXCEPT railway/port/power (which carry their own gates and
    // map to real rail / water transport / utilities); agriculture INCLUDES subsistence (real farm
    // series count home-consumed output); extraction = mining + logging + oil + rubber references.
    // ⚠ The old mfg_raw/mfg_mfg split gates are GONE by the mapping rule: the model splits per TIER by
    // recipe (late steel migrates to mfg-inputs when it starts eating electricity), which no real
    // census series can follow — unmappable, so removed and the TOTAL is gated instead. The split
    // stays visible in the sector-composition report, ungated.
    categories: {
      manufacturing: { Y: [null, 18, 26, 42, 49, 63] },
      extraction:    { Y: [null, 4.9, 7.0, 8.9, 9.3, 6.1], verify: true },   // structural — see header
      agriculture:   { Y: [null, 73, 58, 36, 27, 16] },
    },
    // ---- level 3: industries, X = real US share of the mapped commodity economy, gates [X/4, 4X] ---
    // Adjustment tags: (b) basket remap, (i) import adjustment, (a) army-premise ×5, (s) judgment
    // scale where the record is thin. See the header for what each means; 2 significant figures.
    industries: {
      food:           { X: [null, 1.5, 2.1, 3.2, 3.1, 2.8] },   // (b) milling/meatpacking/dairy→agriculture
      textile:        { X: [null, 5.5, 5.3, 7.9, 7.7, 6.6] },   // (b) textiles+apparel+footwear
      furniture:      { X: [null, 2.7, 2.6, 3.0, 2.2, 1.6] },   // (b) furniture+misc wood manufactures
      paper:          { X: [null, 0.36, 0.70, 0.99, 1.3, 1.4] },// (b) paper-proper; printing dropped
      tooling:        { X: [null, 1.3, 2.1, 3.0, 3.8, 4.5] },   // (b) machine tools/hardware/implements
      steel:          { X: [null, 1.8, 3.1, 5.0, 6.6, 5.9] },   // primary iron & steel
      glass:          { X: [null, 1.5, 1.6, 1.7, 1.5, 1.4] },   // (b) glass+pottery+household ceramics
      arms:           { X: [null, 0.5, 0.26, 0.30, 0.55, 0.75] },// (a) small arms; 1836 (s) militia-era.
      // ⚠ (a) scales PEACETIME shares by the army premise — 1945 uses the interwar-normal share, NOT
      // the real 1945 war peak: the scenario is a steady state with a 5% army, not a war economy, and
      // an X above what that premise's own demand generates would be a floor no market could honour.
      artillery:      { X: [null, 0.15, 0.15, 0.20, 0.30, 0.50] }, // (a)
      munition:       { X: [null, null, 0.15, 0.25, 0.40, 0.60] }, // (a)
      explosives:     { X: [null, null, 0.35, 0.45, 0.50, 0.50] }, // (i) mining/construction consumption
      fertilizer:     { X: [null, null, 0.25, 0.45, 0.60, 0.80] }, // (i) incl. Chilean nitrate imports
      synthetics:     { X: [null, null, 0.15, 0.25, 0.50, 1.0] },  // (i) dye consumption was German imports
      motor:          { X: [null, 0.55, 1.4, 2.0, 2.6, 3.8] },  // (b) engines + heavy electrical equipment
      automotive:     { X: [null, null, null, 0.10, 3.3, 4.7] },
      electrics:      { X: [null, null, null, 0.30, 0.65, 1.6] },// (b) communications/consumer electronics
      power:          { X: [null, null, null, 0.80, 2.9, 4.2] }, // electric utilities
      port:           { X: [null, 3.6, 2.1, 1.6, 1.8, 1.6] },   // water transport
      railway:        { X: [null, 0.55, 7.0, 10.9, 11.0, 8.2] },// the structural gap — see header
      shipyard:       { X: [null, 1.1, 1.1, 1.6, 1.5, 2.0], nofloor: true },   // excused: VA negative by construction
      shipyard_steam: { X: [null, null, 1.1, 1.6, 1.5, 2.0], nofloor: true },
      art_academy:    { hand: [null, [0, 2], [0, 2], [0, 2], [0, 2], [0, 2]] },// unmappable — dropped from
    },                                                                         // the real calc; sanity rail stays
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

// [lo, hi] as FRACTIONS of the mapped commodity economy (0.01 = 1%), or null when unconstrained.
// Industries: [X/4, 4X] (lo = 0 under `nofloor`). Groups: [Y/3, min(2Y, 95)] — the agriculture cap
// would exceed 100% early, and a cap above the whole economy is no cap. Professions: hand bands,
// fractions of population. Eras beyond a table's length reuse its last entry (defensive).
export function macroBounds(macro, kind, key, eIx) {
  if (!macro || eIx < macro.from_era) return null;
  const row = (macro[kind] || {})[key];
  if (!row) return null;
  const at = a => a[Math.min(eIx, a.length - 1)];
  if (kind === 'professions') { const b = at(row); return b ? [b[0] / 100, b[1] / 100] : null; }
  if (kind === 'categories') {
    const y = at(row.Y); if (y == null) return null;
    return [y / 3 / 100, Math.min(2 * y, 95) / 100];
  }
  if (row.hand) { const b = at(row.hand); return b ? [b[0] / 100, b[1] / 100] : null; }
  const x = at(row.X); if (x == null) return null;
  return [row.nofloor ? 0 : x / 4 / 100, 4 * x / 100];
}

// A bound the solver must REPORT but never ENFORCE — the extraction cap's structural red.
export function macroVerifyOnly(macro, kind, key) {
  if (!macro) return false;
  const row = (macro[kind] || {})[key];
  return !!(row && row.verify);
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
  for (const p in macro.professions) for (const b of macro.professions[p]) {
    if (b && !(b.length === 2 && b[0] <= b[1]))
      throw new Error(`era_macro(${macro.id}): bad bound professions.${p} [${b}]`);
  }
  for (const c in macro.categories) for (const y of macro.categories[c].Y) {
    if (y != null && !(y > 0)) throw new Error(`era_macro(${macro.id}): bad Y categories.${c} (${y})`);
  }
  for (const id in macro.industries) {
    const row = macro.industries[id];
    if (row.hand) { for (const b of row.hand) if (b && !(b.length === 2 && b[0] <= b[1]))
      throw new Error(`era_macro(${macro.id}): bad hand bound industries.${id} [${b}]`); continue; }
    for (const x of row.X) if (x != null && !(x > 0))
      throw new Error(`era_macro(${macro.id}): bad X industries.${id} (${x})`);
  }
}
