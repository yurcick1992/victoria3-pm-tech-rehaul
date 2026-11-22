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
// ⭐ SINCE 2026-11-22 (FINDINGS F285 §3, landmine L55) EVERY LEDGER READER THAT SPLITS BY TIER goes through here: on the mod 1.2 book the nine
//   tiered deposits sat in the same `cfg.industries` array and twelve readers counted them as manufacturing (new levels below the best tier
//   46.0% published against 26–28.5% on manufacturing alone; tier-1 workers 29.0M against 6.1M in 1935). A deposit's first rung key IS
//   vanilla's building key (building_coal_mine …), so on a VANILLA run an unfiltered reader counted vanilla's mines as tier-0 rungs too.
/** the enabled manufacturing industries as a plain array in the book's order, and the skipped ids. */
export function manufacturingList(cfg) { const { kept, skipped } = manufacturing(cfg); return { list: kept.map(([, i]) => i), skipped }; }
/** the book's enabled TIERED DEPOSITS (§10.115: `deposit: true`), in the book's order. */
export function depositList(cfg) { return ((cfg && cfg.industries) || []).filter(i => i && !i.disabled && i.deposit); }
/** print what a reader left out, once, on stderr (stdout of some readers is parsed): CLAUDE.md §2.12 — a silent skip is invisible. */
const SAID = new Set();
export function reportSkipped(tool, skipped) {
  if (!skipped || !skipped.length || SAID.has(tool)) return; SAID.add(tool);
  console.error(tool + ': not manufacturing, left out of the tier readings (lib_industries.mjs): ' + skipped.join(', '));
}
