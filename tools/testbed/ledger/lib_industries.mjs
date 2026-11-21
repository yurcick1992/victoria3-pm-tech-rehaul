// WHICH OF A BOOK'S INDUSTRIES ARE MANUFACTURING (BALANCE_FRAMEWORK §10.123 point 4, user-ruled 2026-11-20: "T0-T3 do NOT count deposit
// rungs or anything else except manufacturing (no agriculture either)"; §10.121.1 the same for the old-plants term). ONE definition for the
// register's T0–T3 (criteria.mjs) and the in-market backward-industry test (lib_laggard.mjs, laggard_pressure.mjs).
// ⭐ An explicit list of `cfg.industries[].id`, never "every entry": the mod 1.2 book may carry tiered deposit rungs in the same array, and a
//   reader that took every entry would count old mines as old plants. The seventeen tiered manufacturing industries of CLAUDE.md §1.2; the
//   motor's new t0 rung (§10.116, Steam Engines) is a rung of `motor` and counts with it; crafts and merged rungs count by their own tiers.
// ⚠ A new manufacturing industry must be added here, or it is skipped — and every skip is returned so the caller prints it (CLAUDE.md §2.12).
export const MANUFACTURING = ['food', 'textile', 'furniture', 'glass', 'tooling', 'paper', 'fertilizer', 'explosives', 'steel', 'motor',
  'automotive', 'arms', 'artillery', 'munition', 'synthetics', 'electrics', 'art_academy'];
const SET = new Set(MANUFACTURING);
/** the book's enabled manufacturing industries as [key, industry] pairs, and the ids of every other enabled industry (skipped). */
export function manufacturing(cfg) {
  const kept = [], skipped = [];
  for (const [k, ind] of Object.entries((cfg && cfg.industries) || {})) {
    if (ind.disabled) continue;                       // handed back to vanilla (L27)
    if (SET.has(ind.id)) kept.push([k, ind]); else skipped.push(ind.id || String(k));
  }
  return { kept, skipped };
}
