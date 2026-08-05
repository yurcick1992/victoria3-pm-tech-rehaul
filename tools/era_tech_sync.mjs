// era_tech_sync.mjs — ONE TECHNOLOGY, ONE ERA.
//
// ⚠ Deliberately side-effect free, and that is not tidiness. The natural home for this is
// `build_era_ladder.mjs`, beside the historical judgements it implements — but that module runs its whole
// build at import time and keys off `--write`, the SAME flag `era_scenarios --write` uses. Importing it
// from the scenario solver would re-mint the invented tiers and discard the volumes that solver had just
// produced, which is exactly the ordering CLAUDE.md warns never to invert. So the code lives here and the
// reasoning is cross-referenced from there.
//
// THE PROBLEM. The ladder places three industries EARLIER than their vanilla unlocking technology's era,
// as deliberate historical corrections (Bell's telephone 1876, the Curved Dash 1901). But every OTHER gate
// in the era pipeline — which production methods a scenario may run (`era_pm.mjs`), which vanilla buildings
// it may contain (`era_scenarios.mjs`) — reads that technology's own VANILLA era, remapped 1:1. So a
// hand-moved industry gets its factory in one era and everything else the same technology unlocks in the
// next one.
//
// For `automotive` that is provably an inconsistency rather than a balance choice: vanilla's
// `combustion_engine` unlocks BOTH `pm_automobile_production` (the factory) and `pm_public_motor_carriages`
// — urban-centre public transport, the ONLY building in the game that buys automobiles, one per level, and
// there are hundreds of levels in a large market. Placing the factory in era 3 while leaving its customer
// in era 4 hands era 3 an industry whose good nobody is permitted to buy.
//
// Measured on the shipped scenarios: era 3 makes 30 automobiles and 60 telephones against a reachable
// building demand of ZERO for both; era 4 switches the customers on (330 automobiles, 770 telephones) and
// the same industries go from 1 level to 22. That is the whole of their insolvency (BALANCE_FRAMEWORK
// §10.29), and no demand model could have fixed it — consistent with FINDINGS F31 finding nothing wrong
// with the demand model.
//
// THE CORRECTION therefore belongs on the TECHNOLOGY, not on the building: if we judge a technology to
// belong in an earlier era, everything it unlocks moves with it. Derived from the config rather than
// hand-listed, so the historical judgement stays stated exactly once, in the ladder SPEC beside its
// reasoning, and cannot drift out of step with a list over here.
//
// ⚠ THIS DOES NOT FIX `electrics`, and should not be read as doing so. Telephones' only building customer
// is `pm_switch_boards`, gated on `central_planning` — a DIFFERENT technology — so moving that would be a
// fresh historical judgement, not the repair of an inconsistency. Left alone deliberately.

// Which technologies the config places EARLIER than their vanilla era, and where it puts them.
//
// ⚠ ONLY EVER LOWERS, and the asymmetry is the whole correctness of this. The forced direction is: a tier's
// own unlocking technology must be available in the era we placed that tier — otherwise the factory exists
// and the things that same technology unlocks do not. The other direction is NOT forced and must not be
// applied: a technology being available EARLIER than some tier that happens to use it is perfectly normal
// (other tiers and other buildings legitimately use it sooner), so raising its era would withdraw methods
// that are currently, correctly, available. Written the naive way — "whenever the two differ" — this rule
// produced 18 changes, 12 of them in the unforced direction, including pushing every dynamite method out
// of era 3. Taking the minimum leaves the 6 that are actually forced.
//
// ⚠ Our eras and vanilla's are NOT the same scale — ours anchor at 1750/1850/1900/1925/1940, vanilla's run
// pre-1836 / 1836-61 / 1862-86 / 1887-1911 / 1911-36 — so the pipeline's 1:1 remap is itself an
// approximation, and it is what puts our era 3 (1900) below vanilla's era 4 (1887-1911) even where the
// years agree. That is the deeper reason these six exist; this function repairs the consequence, not the
// mapping. Model-only tiers are skipped — they have no unlocking technology by definition.
// ⚠ AND ONLY WHERE THE TECHNOLOGY ACTUALLY GATES A CUSTOMER FOR THAT TIER'S OWN GOOD. This is the second
// half of the narrowing, and it is what makes the rule a repair rather than a re-balance. The defect being
// fixed is specific: one technology unlocks both a producer and a consumer of the same good, and we put
// them in different eras. A technology that merely happens to gate a tier we moved is NOT that defect, and
// lowering it just makes unrelated methods available early.
//
// Measured, and this is why the test exists: the broad version (every forced lowering, all six) scores
// **49 points / 36 excluding**, against the shipped **41 / 30** — WORSE. It does fix what it was aimed at —
// automotive leaves era 3's loss-making list exactly as predicted — but `aniline`, `gantry_cranes`,
// `electric_railway`, `compression_ignition` and `telephone` ride along and newly break explosives,
// shipyard_steam and synthetics. Only `combustion_engine` gates a customer of its own tier's good
// (`pm_public_motor_carriages` buys `automobiles`), so only it survives this test.
export function techEraCorrections(cfg, vanillaTechEra, VAN) {
  const pms = (VAN && VAN.pms) || {};
  const out = {};
  for (const ind of (cfg.industries || [])) {
    if (ind.disabled) continue;
    for (const t of (ind.tiers || [])) {
      if (!t.tech || t.model_only || !(t.era > 0)) continue;
      const van = vanillaTechEra[t.tech];
      if (van == null || van <= t.era) continue;                 // already available — nothing forced
      const good = t.output_good || ind.output_good;
      if (!good) continue;
      // does anything else this same technology unlocks BUY that good?
      const customer = Object.entries(pms).find(([, r]) => r && r.tech === t.tech && ((r.in || {})[good] > 0));
      if (!customer) continue;
      const prev = out[t.tech];
      if (!prev || t.era < prev.to)
        out[t.tech] = { from: van, to: t.era, industry: ind.id, good, customer: customer[0] };
    }
  }
  return out;
}

// Apply in place to the shared vanilla extract, so BOTH gates that read it see one era per technology.
// Must run BEFORE anything consults S.VAN.tech_era.
//
// A/B switch while this is measured: `ERA_TECH_SYNC=1` enables it, default OFF. It changes shipped
// behaviour, so it has to earn that on the illogicality count first rather than on the argument above.
export function applyTechEraCorrections(S, cfg, { quiet = false } = {}) {
  if (process.env.ERA_TECH_SYNC !== '1') return {};
  const corr = techEraCorrections(cfg, S.VAN.tech_era || {}, S.VAN);
  // ERA_TECH_SYNC_ONLY=a,b restricts to named technologies — purely for A/B, to separate one correction's
  // effect from the others'. The customer test above does NOT isolate automotive on its own: ports buy
  // steamers and trains buy engines, so `gantry_cranes` and `electric_railway` pass it too.
  const only = (process.env.ERA_TECH_SYNC_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
  if (only.length) for (const k of Object.keys(corr)) if (!only.includes(k)) delete corr[k];
  for (const tech in corr) S.VAN.tech_era[tech] = corr[tech].to;
  if (!quiet && Object.keys(corr).length)
    console.log('TECH ERA SYNC: ' + Object.entries(corr)
      .map(([k, v]) => `${k} ${v.from}→${v.to} (${v.industry})`).join(' · '));
  return corr;
}
