// THE ONE DEFINITION OF THE NAMES the "finish a paid-for technology" feature shares between two emitters.
//
// emit_research_events.mjs SETS a stage flag when a research journal entry completes; emit_tech_finish.mjs
// READS it inside the technology's ai_weight. They run as separate processes, so the only thing that keeps
// them agreeing is that both import these functions. A flag set under one name and read under another does
// not error in game — `has_variable` on a name nobody sets is simply false — so the boost would silently
// never fire. That is the failure this file exists to make impossible.

// Country variable set in a research JE's on_complete, inside the same `can_research` guard as the grant,
// so it is set exactly when the progress was actually granted.
export const stageVar = (tech, stage) => `pmr_je_${tech}_${stage}`;

// Country-scope script value: the ahead-of-time penalty a technology of `category` in game era `era` carries,
// in units of (0.25 x the era base cost) — i.e. Σ over the unresearched technologies of the same category in
// earlier eras of (era − their era). `variant` is '' for the shipping reading, or 'all' / 'res' for the two
// diagnostic readings (count / skip technologies the country can never research).
export const aotValue = (category, era, variant = '') =>
  variant ? `pmr_aotdiag_${variant}_${category}_e${era}` : `pmr_aot_${category}_e${era}`;

// Which stages carry a flag at all. k completed stages bank k × grant_fraction of the ERA cost, and a technology can
// never cost less than its era cost (the penalty only adds), so a stage with k × grant_fraction < 1 can never finish
// anything and no condition reads its flag. Setting it anyway earns one engine warning per technology at load
// ("Variable … is set but is never used" — 40 of them in the canon load test of 2026-09-23) and a dead variable per
// country. The diagnostics read every stage (they report k), so diag flags all of them.
// ⚠ emit_tech_finish.mjs must reference ONLY flagged stages; its build-time check enforces that.
export const stageFlagged = (k, grantFraction, diag) => !!diag || k * grantFraction >= 1 - 1e-9;

// The marker written into every patched ai_weight, so a second application is caught instead of doubling the boost.
export const BOOST_MARKER = '# pmr_finish_boost';
