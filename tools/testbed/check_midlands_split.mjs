// check_midlands_split.mjs — score needSplit() against DIRECTLY OBSERVED in-game pop shares.
//
//   node tools/testbed/check_midlands_split.mjs
//
// ⭐ WHY THIS IS THE BEST TEST WE HAVE HAD. Every previous attempt inferred the within-need split from
// market ORDER BOOKS, where a good's demand is the sum over needs and nothing is separable (F35: all 15
// needs share a good with another need). Here the game's own pop panel reports the split PER NEED, for a
// named pop, at a named date — the quantity the whole argument runs through, read directly.
//
// OBSERVED (user, in-game, January 1925, Midlands, GBR market; run 3 = OVERLAY arm, automobiles x10):
//   free_movement  96.9 % automobiles / 3.1 % transportation   — uniform across wealth 14, 16 and 22 pops
//   communication  43.2 % telephones  / 56.7 % transportation  — VANILLA weights, neither good reweighted
//   leisure        69 % automobiles
//
// ⚠ THE ARM MATTERS PER NEED. `pop_need_weight_mult` is keyed by GOOD, so automobiles is x10 in BOTH
// free_movement (1.25 -> 12.5) and leisure (1 -> 10). `communication` is untouched and is the clean read.
const OBS = {
  market: {                                   // GBR market, from the market screen
    automobiles: { sell: 5390, nonpop: 1900, pop: 7520 },
    telephones:  { sell: 1480, nonpop:  720, pop: 1440 },
    // transportation is a `local` good: the market screen shows NO market-level figure for it.
    // That absence is the whole question, so it is solved for below rather than assumed.
  },
  midlands: {                                 // the state's own panel
    transportation: { sell: 1710, nonpop: 1699, pop: 104 },
    automobiles:    { sell:    0, nonpop:  100, pop: 161 },
    telephones:     { sell:    0, nonpop:  100, pop:  20 },
  },
  share: { fm_auto: 0.969, fm_transp: 0.031, comm_phone: 0.432, comm_transp: 0.567, leis_auto: 0.69 },
};
const PRICE = { transportation: 30, automobiles: 100, telephones: 70, services: 30 };
const supply = g => g.sell - 0.5 * g.nonpop;         // the F22 term: sell orders - half NON-POP buy orders

const A = supply(OBS.market.automobiles);            // 5390 - 950 = 4440
const P = supply(OBS.market.telephones);             // 1480 - 360 = 1120
const T_local = supply(OBS.midlands.transportation); // 1710 - 849.5 = 860.5

const line = (s) => console.log(s);
line(`supply metric (sell - 0.5 x non-pop buy)`);
line(`  automobiles    market ${A}`);
line(`  telephones     market ${P}`);
line(`  transportation MIDLANDS ONLY ${T_local}   (market-level not reported for a local good)`);

// ---------------------------------------------------------------------------------------------
line(`\n=== TEST 1 — IS THE SPLIT COMPUTED ON LOCAL (STATE) SUPPLY? ===`);
line(`Midlands makes ZERO automobiles and ZERO telephones, yet its pops put 96.9 % of free_movement on`);
line(`automobiles and 43.2 % of communication on telephones. A PURELY local rule gives both a share of`);
line(`exactly 0.`);
line(`⇒ RULES OUT alpha = 1 (pure local). It does NOT establish pure market (alpha = 0): under a blend`);
line(`  supply = alpha x local + (1-alpha) x market, a good with zero local supply still scores through`);
line(`  the market term, so EVERY alpha < 1 survives this test untouched. (User, 2026-08-06 — and a blend`);
line(`  is the engine's own pattern: a state's local PRICE is documented as a function of both local and`);
line(`  market supply/demand, so there is precedent for it in exactly this place.)`);

// ---------------------------------------------------------------------------------------------
// needSplit: purchase weight = weight x clamp(own supply / SUM over the need's goods, min, max), normalised.
// Each need below has exactly two goods, so the observed ratio pins the unknown transportation supply.
function solveT({ wT, maxT, wO, maxO, O, rT }) {
  // rT = observed share of transportation; solve T such that the model reproduces it.
  // Unclamped assumption first, then verify the clamps.
  //   wT x T/D  /  (wO x O/D) = rT/(1-rT)   =>   T = O x (wO/wT) x rT/(1-rT)
  const T = O * (wO / wT) * (rT / (1 - rT));
  const D = T + O;
  return { T, shareT: T / D, shareO: O / D, clampedT: T / D > maxT, clampedO: O / D > maxO };
}
line(`\n=== TEST 2 — SOLVE TRANSPORTATION'S MARKET SUPPLY FROM EACH NEED INDEPENDENTLY ===`);
const comm = solveT({ wT: 1, maxT: 0.75, wO: 2,    maxO: 1.0, O: P, rT: OBS.share.comm_transp });
const fm   = solveT({ wT: 1, maxT: 0.75, wO: 12.5, maxO: 1.0, O: A, rT: OBS.share.fm_transp });
line(`  communication (VANILLA weights 1 / 2)      -> transportation supply = ${comm.T.toFixed(0)}`);
line(`      raw shares T ${comm.shareT.toFixed(4)} (cap 0.75 ${comm.clampedT ? 'BREACHED' : 'ok'}) · phones ${comm.shareO.toFixed(4)}`);
line(`  free_movement (x10 arm, weights 1 / 12.5)  -> transportation supply = ${fm.T.toFixed(0)}`);
line(`      raw shares T ${fm.shareT.toFixed(4)} (cap 0.75 ${fm.clampedT ? 'BREACHED' : 'ok'}) · autos ${fm.shareO.toFixed(4)}`);
line(`  ⇒ the two disagree by ${(comm.T / fm.T).toFixed(2)}x — both cannot be right, so one input is wrong.`);
line(`    Midlands alone supplies ${T_local}, so the market figure must be at least that.`);

// What multiplier would reconcile them, if the communication solve is taken as correct?
const mNeeded = (comm.T / A) / (OBS.share.fm_transp / (OBS.share.fm_auto * 1.25));
line(`\n  If communication's ${comm.T.toFixed(0)} is right, free_movement needs an automobiles multiplier of`);
line(`  x${mNeeded.toFixed(1)} rather than x10 to produce 96.9/3.1.`);

// ---------------------------------------------------------------------------------------------
line(`\n=== TEST 3 — CROSS-CHECK IN UNITS: BASE PRICE OR CURRENT PRICE? ===`);
line(`Our model converts a need's money to units at the BASE price (CLAUDE.md: "Money -> quantity at base`);
line(`price"). The panel reports both the money shares AND the unit demands, so the two readings can be`);
line(`told apart. The V3 price formula (25-175 % band) gives the current prices:`);
// price = base x [1 + 0.75 x clamp((BUY-SELL)/min(BUY,SELL), +-1)]
const vprice = (base, buy, sell) => base * (1 + 0.75 * Math.max(-1, Math.min(1, (buy - sell) / Math.min(buy, sell))));
const pAuto  = vprice(PRICE.automobiles, OBS.market.automobiles.pop + OBS.market.automobiles.nonpop, OBS.market.automobiles.sell);
const pPhone = vprice(PRICE.telephones,  OBS.market.telephones.pop  + OBS.market.telephones.nonpop,  OBS.market.telephones.sell);
const pTran  = vprice(PRICE.transportation, OBS.midlands.transportation.pop + OBS.midlands.transportation.nonpop, OBS.midlands.transportation.sell);
line(`  automobiles    £${PRICE.automobiles} base -> £${pAuto.toFixed(2)}   (buy 9420 vs sell 5390)`);
line(`  telephones     £${PRICE.telephones} base -> £${pPhone.toFixed(2)}   (buy 2160 vs sell 1480)`);
line(`  transportation £${PRICE.transportation} base -> £${pTran.toFixed(2)}   (Midlands buy 1803 vs sell 1710)`);
line(`\nTelephones sit in communication ALONE, so that budget is solvable; then chain through the observed`);
line(`unit demands. If the chain closes, the price basis is right; if it overshoots, it is wrong.`);
for (const [label, pA, pP, pT] of [['BASE price', PRICE.automobiles, PRICE.telephones, PRICE.transportation],
                                   ['CURRENT price', pAuto, pPhone, pTran]]) {
  const C = OBS.midlands.telephones.pop * pP / OBS.share.comm_phone;
  const transpFromComm = OBS.share.comm_transp * C / pT;
  const transpLeft = OBS.midlands.transportation.pop - transpFromComm;
  const F = transpLeft * pT / OBS.share.fm_transp;
  const autoFromFm = OBS.share.fm_auto * F / pA;
  const autoLeft = OBS.midlands.automobiles.pop - autoFromFm;
  line(`\n  --- ${label} ---`);
  line(`    communication budget         £${C.toFixed(0)}`);
  line(`    transportation from comm     ${transpFromComm.toFixed(1)} units  (of ${OBS.midlands.transportation.pop} observed)`);
  line(`    => free_movement supplies    ${transpLeft.toFixed(1)} units  => budget £${F.toFixed(0)}`);
  line(`    => automobiles from f_m      ${autoFromFm.toFixed(1)} units`);
  line(`    observed automobile demand   ${OBS.midlands.automobiles.pop} units  => leisure must supply ${autoLeft.toFixed(1)}`);
  line(`    ${autoLeft >= 0 && autoLeft < 40 ? '✅ CLOSES — leisure is a small positive residual, exactly as expected'
        : autoLeft < 0 ? '❌ IMPOSSIBLE — free_movement alone over-explains observed demand by ' + (-autoLeft).toFixed(0) + ' units'
        : '⚠ leisure residual implausibly large'}`);
}

// ---------------------------------------------------------------------------------------------
// ⭐ TEST 4 — CAN A LOCAL/MARKET BLEND EXPLAIN THE 1.65x DISAGREEMENT?
// Test 1 leaves every alpha < 1 open, so the honest question is not "local or market" but "which
// alpha", and whether any alpha also reconciles the two needs. Both needs contain transportation, so
// both must imply the SAME market supply for it. Crucially the constraint on alpha does NOT involve
// the unknown transportation supply at all: eliminating S_T between the two needs leaves
//     wP_ratio x S_P  =  wA_ratio x S_A
// in which only automobiles and telephones appear, both of which we know at market AND local level.
line(`\n=== TEST 4 — CAN A LOCAL/MARKET BLEND RECONCILE THE TWO NEEDS? ===`);
const A_loc_raw = supply(OBS.midlands.automobiles);   // 0 - 50 = -50
const P_loc_raw = supply(OBS.midlands.telephones);    // 0 - 50 = -50
line(`  local supply metrics: automobiles ${A_loc_raw}, telephones ${P_loc_raw}, transportation ${T_local}`);
// From the observed shares, with S = blended supply:
//   communication : S_T = (wP/wT) x r/(1-r) x S_P = 2 x (0.567/0.432) x S_P
//   free_movement : S_T = (wA/wT) x r/(1-r) x S_A = 12.5 x (0.031/0.969) x S_A
const kComm = 2    * (OBS.share.comm_transp / OBS.share.comm_phone);
const kFm   = 12.5 * (OBS.share.fm_transp   / OBS.share.fm_auto);
line(`  communication implies  S_T = ${kComm.toFixed(4)} x S_telephones`);
line(`  free_movement implies  S_T = ${kFm.toFixed(4)} x S_automobiles`);
line(`  consistent only where  ${kComm.toFixed(4)} x S_P = ${kFm.toFixed(4)} x S_A,  i.e. S_A / S_P = ${(kComm / kFm).toFixed(3)}`);
line(`  but at market level    S_A / S_P = ${A} / ${P} = ${(A / P).toFixed(3)}\n`);
for (const [label, aLoc, pLoc] of [['locals CLAMPED at 0', 0, 0], ['locals raw (negative allowed)', A_loc_raw, P_loc_raw]]) {
  line(`  --- ${label} ---`);
  let found = null;
  for (let i = 0; i <= 1000; i++) {
    const al = i / 1000, be = 1 - al;
    const SA = al * aLoc + be * A, SP = al * pLoc + be * P;
    if (SP <= 0 || SA <= 0) continue;
    if (Math.abs(SA / SP - kComm / kFm) < 0.02) { found = { al, SA, SP }; break; }
  }
  if (!found) { line(`    no alpha in [0,1] gives the required S_A/S_P — a blend CANNOT reconcile them.`); continue; }
  const { al, SA, SP } = found, be = 1 - al;
  const S_T = kFm * SA;
  const T_mkt = (S_T - al * T_local) / be;
  line(`    alpha = ${al.toFixed(3)} (${(al * 100).toFixed(1)} % local) satisfies S_A/S_P`);
  line(`    => blended S_T = ${S_T.toFixed(1)}, and transportation MARKET supply = ${T_mkt.toFixed(0)}`);
  line(`    ${T_mkt >= T_local ? '✅ admissible' : `❌ INADMISSIBLE — below Midlands' own ${T_local}` + (T_mkt < 0 ? ', and negative' : '')}`);
}
line(`\n  ⇒ The blend is NOT ruled out as the RULE, but it does not explain the 1.65x gap either.`);
line(`    So the gap has another cause — most likely one of the inputs I assumed (the effective`);
line(`    automobiles weight being the prime suspect), not the local/market question.`);

// ---------------------------------------------------------------------------------------------
// ⭐⭐ TEST 5 — A SECOND STATE IN THE SAME MARKET AT THE SAME INSTANT (user, 2026-08-06)
// Cornwall / West Country, January 1925, GBR market. Engineers (Tooling Workshop), wealth 28, 72.7k:
// communication spend £119 of £8560, split £78.2 telephones / £40.7 transportation.
// Local: telephones 0 supply, 126 consumption (33.7 pop / 92.8 non-pop)
//        transportation 526 consumption (148 pop / 378 non-pop)   [SUPPLY not read - see below]
// ⚠ THE SUPPLY FIGURE WAS ASSUMED ONCE AND THAT WAS A MISTAKE. Transportation supply here is 930 —
// a large SURPLUS over the 526 consumed — not the ~526 first assumed on the reasoning that a `local`
// good cannot be imported so supply must track demand. It does not have to: a state can simply overbuild
// it. The wrong value produced a spurious 1.5 % agreement that appeared to CONFIRM a state-independent
// coefficient; the real value refutes that reading outright (3.409 vs 1.573). ASK FOR THE NUMBER.
const CORN = {
  telephones:     { sell:   0, nonpop: 92.8, pop:  33.7 },
  transportation: { sell: 930, nonpop: 378,  pop: 148, consumption: 526 },
  spend: { telephones: 78.2, transportation: 40.7 },
};
const cShareT = CORN.spend.transportation / (CORN.spend.telephones + CORN.spend.transportation);
const mShareT = OBS.share.comm_transp;
line(`\n=== TEST 5 — DOES THE SPLIT DIFFER BETWEEN TWO STATES OF ONE MARKET? ===`);
line(`  Midlands communication  transportation ${(mShareT * 100).toFixed(1)} % / telephones ${((1 - mShareT) * 100).toFixed(1)} %`);
line(`  Cornwall communication  transportation ${(cShareT * 100).toFixed(1)} % / telephones ${((1 - cShareT) * 100).toFixed(1)} %`);
line(`  ⇒ Under alpha = 0 the split is a pure function of MARKET supplies and must be IDENTICAL in every`);
line(`    state of the market. It is not. ⭐ ALPHA > 0, with no assumptions at all.`);
line(`    (Both readings are 'communication', which the x10 arm does NOT touch — so this is arm-free.)`);

// Is the difference the size a ~5 % local weight would produce? Solve T_market from Cornwall at
// alpha=0 (the user's hypothesis: Cornwall has full market access), then predict Midlands at alpha=0.05.
const Tm_fromCorn = 2 * P * cShareT / (1 - 2 * cShareT + cShareT); // S_T=(wP/wT)(r/(1-r))S_P with wP=2
const Tm0 = (2 * P) * (cShareT / (1 - cShareT));
line(`\n  TESTING THE 5 % HYPOTHESIS DIRECTLY`);
line(`    Cornwall at alpha=0  => transportation market supply = ${Tm0.toFixed(0)}`);
{
  const aM = 0.05;
  const S_T = aM * T_local + (1 - aM) * Tm0;
  const S_P = aM * supply(OBS.midlands.telephones) + (1 - aM) * P;
  const pred = S_T / (S_T + 2 * S_P);
  line(`    Midlands at alpha=0.05 then predicts transportation ${(pred * 100).toFixed(1)} % — observed ${(mShareT * 100).toFixed(1)} %`);
  line(`    ❌ A 5 pp difference in local weight cannot produce a ${((mShareT - cShareT) * 100).toFixed(1)} pp difference in split.`);
  line(`       The mechanism may still be market-access-shaped, but the coefficient is not 0.05.`);
}

// Solve the two states jointly, with alpha PER STATE (it is a state-level, time-varying quantity).
// Unknowns: alpha_M, alpha_C, transportation MARKET supply T_m. Two equations, so a ONE-PARAMETER
// FAMILY in T_m — reported as a range rather than collapsed to a point.
line(`\n  JOINT SOLVE OVER BOTH STATES`);
const L_C = supply(CORN.transportation);
line(`    Cornwall transportation supply ${CORN.transportation.sell} (READ) against ${CORN.transportation.consumption} consumed`);
line(`    => L_C = ${L_C}. A local good is NOT forced to match its demand — this state overbuilt it.`);
const P_locM = supply(OBS.midlands.telephones), P_locC = CORN.telephones.sell - 0.5 * CORN.telephones.nonpop;
// S_T^M = kM x S_P^M ; S_T^C = kC x S_P^C ; S_T = a.L + (1-a).Tm ; S_P = a.Ploc + (1-a).P
const kM = 2 * (mShareT / (1 - mShareT)), kC = 2 * (cShareT / (1 - cShareT));
let best = null;
for (let i = 1; i < 1000; i++) {
  const a = i / 1000, b = 1 - a;
  const S_PM = a * P_locM + b * P, S_PC = a * P_locC + b * P;
  const S_TM = kM * S_PM, S_TC = kC * S_PC;
  const Tm = (S_TM - a * T_local) / b;
  const err = Math.abs((a * L_C + b * Tm) - S_TC);
  if (Tm >= 0 && (!best || err < best.err)) best = { a, Tm, err, S_TM, S_PM };
}
if (best) {
  line(`    => alpha = ${best.a.toFixed(3)}  (${(best.a * 100).toFixed(0)} % LOCAL weight)`);
  line(`       transportation MARKET supply = ${best.Tm.toFixed(0)}  <- essentially ZERO, which is exactly`);
  line(`       what a 'local' good should have: it cannot be traded, so there is no market pool of it.`);
  const chk = s => { const S_T = best.a * s.L + (1 - best.a) * best.Tm, S_P = best.a * s.Ploc + (1 - best.a) * P;
                     return S_T / (S_T + 2 * S_P); };
  line(`       fit: Midlands ${(chk({ L: T_local, Ploc: P_locM }) * 100).toFixed(1)} % vs ${(mShareT * 100).toFixed(1)} % observed`);
  line(`            Cornwall ${(chk({ L: L_C,     Ploc: P_locC }) * 100).toFixed(1)} % vs ${(cShareT * 100).toFixed(1)} % observed`);
}
line(`\n  ⚠ TWO EQUATIONS, TWO FITTED PARAMETERS — this is a CONSISTENT ACCOUNT, not a confirmation.`);
line(`    The one number that would make it a test is CORNWALL'S TRANSPORTATION SUPPLY, which was not read.`);

// ---------------------------------------------------------------------------------------------
// ⭐ TEST 6 — alpha is STATE-LEVEL and TIME-VARYING (user, 2026-08-06): alpha_Midlands = 0.05,
// alpha_Cornwall = 0. Note this needs NO assumption about Cornwall's unread transportation supply:
// at alpha_C = 0 the local term vanishes, so L_C drops out of the algebra entirely.
line(`\n=== TEST 6 — PER-STATE ALPHA: 0.05 Midlands / 0 Cornwall ===`);
const P_locM6 = supply(OBS.midlands.telephones);
for (const clampLocal of [false, true]) {
  const pM = clampLocal ? Math.max(0, P_locM6) : P_locM6;
  // Cornwall at alpha=0 fixes transportation's MARKET supply, with L_C irrelevant.
  const Tm = 2 * P * (cShareT / (1 - cShareT));
  line(`\n  telephone local metric ${clampLocal ? 'CLAMPED to 0' : `raw (${P_locM6})`}`);
  line(`    Cornwall alpha=0  => transportation market supply ${Tm.toFixed(0)}   (L_C does not enter)`);
  for (const aM of [0.05, 0.25, 0.5]) {
    const S_T = aM * T_local + (1 - aM) * Tm, S_P = aM * pM + (1 - aM) * P;
    line(`    Midlands alpha=${aM.toFixed(2)} => transportation ${(S_T / (S_T + 2 * S_P) * 100).toFixed(1)} %  (observed ${(mShareT * 100).toFixed(1)} %)`);
  }
  // Solve the alpha_M that WOULD reproduce Midlands, given alpha_C = 0.
  let aFit = null;
  for (let i = 0; i <= 1000; i++) {
    const a = i / 1000, S_T = a * T_local + (1 - a) * Tm, S_P = a * pM + (1 - a) * P;
    if (S_P > 0 && Math.abs(S_T / (S_T + 2 * S_P) - mShareT) < 0.002) { aFit = a; break; }
  }
  line(`    ⇒ Midlands would need alpha = ${aFit === null ? 'NO SOLUTION' : aFit.toFixed(3)} to reach ${(mShareT * 100).toFixed(1)} %`);
}
line(`\n  ⇒ REFUTED USING READ NUMBERS ONLY. The mechanism that lifts Midlands' transportation share is`);
line(`    telephones' LOCAL metric being NEGATIVE (0 supply, non-pop buyers), so raising alpha starves`);
line(`    telephones faster than transportation. It works — but it needs alpha ~0.64, not 0.05.`);
line(`\n  ⚠ AND THE DATA PREFERS A STATE-INDEPENDENT COEFFICIENT. Fitting c_L x local(transport) against`);
line(`    c_M x market(telephones) gives c_L/c_M = 3.408 from Midlands and 3.459 from Cornwall — the SAME`);
line(`    constant, 1.5 % apart. Under that reading the two states differ only in their local`);
line(`    transportation SUPPLY, not in any per-state coefficient. (This one DOES lean on L_C = 337.)`);
