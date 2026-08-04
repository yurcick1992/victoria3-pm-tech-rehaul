// WHICH PRODUCTION METHODS A SCENARIO MAY USE — one copy, shared by tools/era_solver.mjs (the balance
// reference fit) and tools/era_scenarios.mjs (the authoritative solve). They MUST agree: the whole class
// of bug this file exists to prevent is one solver quietly allowing a PM the other forbids.
//
// THE RULE
//   * `unlocking_technologies` — satisfied by the era (vanilla era remapped 1:1 onto ours).
//   * `unlocking_production_methods` — satisfied only by a main PM actually present in the same building.
//   * every OTHER `unlocking_*` (power-bloc principle or identity, company category, geographic region,
//     state religion) — NEVER satisfied. The solver may not help itself to a special case.
//   * law gates are read against a two-law stance, in the direction vanilla means them.
//
// WHY TWO LAWS AND NOT ZERO. The two law-gate kinds point opposite ways — `unlocking_laws` means "you
// must hold this", `disallowing_laws` means "you must not". Treating both as unfulfilled is not neutral,
// it is incoherent, and it lands worse than either alternative: automation switches OFF (every automation
// PM carries `disallowing_laws = { law_industry_banned }`, a law an industrial country would never hold)
// and slave exploitation switches ON (25 PMGs, including every plantation labour group, have no
// law-neutral member, so "hold no laws" leaves the default sitting on `slave_exploitation_*`).
export const SCENARIO_LAWS = new Set(['law_slavery_banned', 'law_commercialized_agriculture']);

// ---------------------------------------------------------------------------------------------------
// PRODUCTION METHODS THE SOLVER MAY NOT SELECT, whatever the arithmetic says.
//
// `slave_exploitation_*` is already excluded by the two-law stance (`law_slavery_banned`). Its sibling
// `worker_exploitation_*` is NOT — it is legal under every law we hold, and it is cheap, so a
// profit-maximising solver picks it every time. A scenario meant to describe "an unexceptional modern
// country" should not be built on coerced labour just because the margin is better, so it is forbidden
// outright rather than argued about per era. Every one of these PMGs carries `default_labour`, so
// forbidding them always leaves a legal option — no PMG is left with an empty candidate set.
//
// `lectors_tobacco` is excluded on the same "not a normal method" basis: it is a flavour method (a reader
// paid to read to cigar rollers), not something a scenario should lean on.
const FORBIDDEN_PM_RE = /^worker_exploitation_|^lectors_tobacco$/;

export function makePmRules(E, S) {
  const TECH_ERA = S.VAN.tech_era || {};
  // a PM with no unlocking technology is a base PM: always available
  const pmEra = pm => { const r = S.VAN.pms[pm]; return (!r || !r.tech) ? 0 : (TECH_ERA[r.tech] ?? 0); };

  // our tier split renamed the vanilla main PMs, so a gate naming one is satisfied by our replacement
  const PM_REPLACED_BY = {};
  for (const i of S.IND) for (const t of i.tiers) if (t.vanilla_pm) PM_REPLACED_BY[t.vanilla_pm] = t.pm_key;

  function pmGateOk(pm, presentPms) {
    const g = (S.VAN.pms[pm] || {}).gate;
    if (!g || !g.length) return true;
    return g.some(req => presentPms.has(req) || (PM_REPLACED_BY[req] && presentPms.has(PM_REPLACED_BY[req])));
  }
  function pmAvailable(pm) {
    if (FORBIDDEN_PM_RE.test(pm)) return false;
    const r = S.VAN.pms[pm] || {};
    if (r.regions || r.company || r.identity || r.religion) return false;
    if (r.laws && !r.laws.some(l => SCENARIO_LAWS.has(l))) return false;
    if (r.nolaws && r.nolaws.some(l => SCENARIO_LAWS.has(l))) return false;
    return true;
  }
  function candidates(pmg, era, presentPms) {
    const g = S.VAN.pmgs[pmg]; if (!(g && g.pms)) return [];
    return g.pms.filter(pm => !E.pmGated(pm) && pmAvailable(pm) && pmEra(pm) <= era && pmGateOk(pm, presentPms));
  }
  return { pmEra, pmGateOk, pmAvailable, candidates };
}

// ---------------------------------------------------------------------------------------------------
// THE HARD RULE: a scenario is only valid if EVERY building runs the most profitable combination of the
// secondary production methods available to it, given the other consumers and suppliers in that market.
//
// It is a hill-climb, not an exhaustive search: one PMG at a time, keep any switch that improves the
// building's profit, repeat until nothing moves. `minGain` is hysteresis — a switch must beat the
// incumbent by more than it, so a pair of near-identical options cannot trade places forever.
//
// The one permitted exception is a genuine LIMIT CYCLE: switching a PM moves prices enough that switching
// back becomes attractive, and the pair never settles. Those are not silently tolerated — they are
// returned in `cycles` so every one can be reported by name.
export function optimisePMs({ E, S, rules, era, profitOfTier, profitOfRef, minGain = 0.02, maxPasses = 6 }) {
  const cycles = [];
  const seen = new Map();   // "building|pmg" -> Set of PMs already tried, to spot a repeat
  let moved = true, pass = 0;
  while (moved && pass < maxPasses) {
    moved = false; pass++;
    const consider = (key, sel, pmgs, present, score, legal) => {
      for (const pmg of pmgs) {
        const cand = rules.candidates(pmg, era, present);
        if (cand.length < 2) { if (cand.length === 1 && sel[pmg] !== cand[0]) { sel[pmg] = cand[0]; moved = true; } continue; }
        if (!cand.includes(sel[pmg])) { sel[pmg] = cand[0]; moved = true; }   // evict an illegal incumbent
        const cur = sel[pmg];
        let best = cur, bestP = score();
        for (const pm of cand) {
          if (pm === cur) continue;
          sel[pmg] = pm;
          const p = legal && !legal() ? -Infinity : score();
          if (p > bestP + minGain) { bestP = p; best = pm; }
        }
        sel[pmg] = best;
        if (best !== cur) {
          moved = true;
          const k = key + '|' + pmg;
          const hist = seen.get(k) || new Set();
          if (hist.has(best)) cycles.push({ building: key, pmg, pm: best, note: 'returned to a method it had already left' });
          hist.add(cur); seen.set(k, hist);
        }
      }
    };
    for (const i of S.IND) for (const t of i.tiers) {
      if (t.era > era || !(S.BLDNUM[t.key] > 0)) continue;
      const present = new Set([t.pm_key, ...Object.values(t._sec || {})]);
      consider(t.key, t._sec, i.secondary_pmgs, present,
        () => profitOfTier(i, t), () => tierLegal(E, i, t));
    }
    for (const b of E.refBuildings()) {
      if (!(S.BLDNUM[b] > 0)) continue;
      const sel = E.refSel(b), info = S.VAN.buildings[b] || {};
      consider(b, sel, info.pmgs || [], new Set(Object.values(sel)),
        () => profitOfRef(b), () => refLegal(E, b));
    }
  }
  return { cycles, settled: !moved, passes: pass };
}

// the negative-goods invariant, as a legality test for a candidate selection
const goodsOk = map => { for (const k in map) if (map[k] < -1e-9) return false; return true; };
export const tierLegal = (E, i, t) => { const g = E.tierGoodsIO(i, t); return goodsOk(g.in) && goodsOk(g.out); };
export const refLegal = (E, b) => { const g = E.selGoods(E.refSel(b)); return goodsOk(g.in) && goodsOk(g.out); };
