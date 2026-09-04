// ⭐⭐ THE FOUR-RUNG LADDER SPEC — user-ruled 2026-08-30.
//
// A TIER IS A VANILLA PRODUCTION METHOD. Rungs are taken from the anchor building's `pmg_base_*`
// group in VANILLA ORDER, and a rung is sourced from the CANONICAL tier that already carries that
// method as its `vanilla_pm` (all 53 exist — verified). We invent a rung only where vanilla has
// fewer methods than the industry needs, and peg an invented rung to a FREE vanilla technology
// before minting one.
//
// ⚠⚠ THIS REPLACES going vanilla -> 6 rungs -> 4 rungs, which was the source of two whole defect
// classes: the six-rung book invented 1-3 rungs per industry, and the four-rung DP then chose among
// THOSE by date proximity, landing on a set that matched neither vanilla's methods nor its gates.
// Four vanilla technologies ended up gating nothing (BUGS_AND_FIXES 2026-08-30) and one technology
// gated two rungs of one industry. Both dissolve here rather than being patched.

// ---- ORDER overrides. Absent = vanilla's own list order. -------------------------------------
// paper: NO override. Vanilla's gate ONSETS look inverted (sulfite 1840 after bleached 1799) but our
// own tech_years — the slot's real deployability, §10.44 — read sulfite 1830 then bleached 1874, which
// is vanilla's own list order. The apparent inversion is the invention-date artifact once more.
// glass: user-ruled option C — forest / leaded / crystal / plastics, no drop, no invention. Leaves a
// visible 126y inversion (crystal 1674 behind leaded 1800), accepted on the same grounds as paper:
// vanilla dates lead crystal at Ravenscroft's invention, not at industrial glassworks.
export const ORDER = {
  glass:      ['pm_forest_glass', 'pm_leaded_glass', 'pm_crystal_glass', 'pm_houseware_plastics'],
  explosives: ['pm_leblanc_process', 'pm_ammonia-soda_process', 'pm_vacuum_evaporation', 'pm_brine_electrolysis'],
  arms:       ['pm_muskets', 'pm_rifles', 'pm_repeaters', 'pm_bolt_action_rifles'],
  artillery:  ['pm_cannons', 'pm_smoothbores', 'pm_breech_loaders', 'pm_recoiled_barrels'],
};

// ---- INVENTED rungs. `at` is the rung INDEX the new tier is spliced in at. ---------------------
// Placement is the NARRATIVE gap, not mechanically the top (user-ruled): motor's gap is the empty
// 1836-1895 middle, so its invented rung goes at index 1 and pushes the electric/diesel methods up.
// `tech` names a FREE vanilla technology wherever one fits; `new: true` mints one.
// ⚠ munition had an invented smokeless_powder rung at 1884 - NINE years after dynamite (1875) and
// the smallest step in the book. It pushed the ladder to five slots once the modern rung arrived, so
// it goes: munition reads 1830 / 1875 / 1940, and one MINT goes with it.
// ⭐⭐ RULE 1 (user-ruled 2026-09-04): "no new tier can be the same in name and essence as a secondary PM of the same
//   industry". Four entries died of it the same day, each pegged to the very technology vanilla gates one of the
//   industry's OWN secondary methods on: food's dough_rollers (= Automated Bakery, the food industry's automation
//   method), synthetics' art_silk (= Rayon, its Synthetic Silk group), electrics' radio (= Radio Production, its Radios
//   group), and the dormant motor watertube_boiler (= the motor industry's Water-tube Boiler automation method).
//   make_tier4_config now THROWS on any such candidate, admitted or not.
// ⭐ electrics' electrical_generation went with them (user, 2026-09-04: "that's a power plant, not an electrics
//   factory"): it was the telephone recipe ×2 pegged to the POWER-PLANT technology, chosen only because the generator
//   wanted a middle rung and took the nearest free vanilla technology. Vanilla's electrics industry has ONE main method
//   and so has this ladder until a rung is explicitly ruled; synthetics is its one vanilla method (dye) plus the ruled
//   MODERN polyamide top.
export const INVENT = {
  furniture:  [{ at: 3, tech: 'pneumatic_tools', year: 1871,      why: 'powered woodworking; vanilla ends at 1850 hand workshops' }],
  paper:      [{ at: 3, tech: 'continuous_web_processing', new: true, year: 1930,
                 why: 'a Fourdrinier is a continuous WEB, not a conveyor - no vanilla technology fits' }],
  fertilizer: [{ at: 3, tech: 'catalytic_synthesis', new: true, year: 1937,
                 why: 'post-Haber catalytic scale-up; no free vanilla technology above nitrogen_fixation' }],
};

// ---- POWER: vanilla-shaped, minus its earliest method (user-ruled 2026-08-30) ------------------
// Power stops being a tiered industry and goes back to being a normal vanilla building with
// SWITCHABLE PMs. The earliest method is removed from its group, which means OWNING the vanilla PMG
// file - a new emission path (we own PM files and buildings today, not PMGs).
// ⚠ The ruling described it as "the one with no input goods"; `pm_early_power_plant` in fact takes
// engines 4 / coal 5 / wood 5. "The earliest" is unambiguous and is what is removed.
export const POWER = { vanilla: true, dropMethods: ['pm_early_power_plant'], pmg: 'pmg_base_building_power_plant' };

// ---- ERA MOVES (user-ruled 2026-08-30) --------------------------------------------------------
// ⭐⭐ A TOP RUNG MAY NOT BE GATED BELOW ERA 4. "e3 techs will be discovered en masse in the late 19th
// century, we can't have narratively 1940s industries gated by them." Five industries topped out on an
// era-3 technology; raising those gates is the fix, and the user ruled it explicitly ("feel free to
// shift techs to higher eras").
// ⚠ This is the FIRST time we move a vanilla technology UP. The standing ladder-era alignment rule
// only ever LOWERS, deliberately — lowering can only make something cheaper and earlier, while raising
// makes it dearer and later FOR EVERYTHING ELSE THAT USES IT. The blast radius was enumerated first
// (tools/plan_era_moves.mjs): four seeds, one dragged dependent, nothing pushed past era 5.
// ⚠ HARD RULE preserved: a technology may not have a prerequisite from a HIGHER era, so raising X
// forces every technology depending on X to rise with it. `electric_railway` is that one case.
export const ERA_MOVES = {
  electrical_capacitors: 4,   // tops textile + explosives
  plastics:              4,   // tops glass
  vulcanization:         4,   // tops tooling
  bolt_action_rifles:    4,   // tops arms
  electric_railway:      4,   // DRAGGED: depends on nothing raised, but motor t2 rides it and
                              // electrical_capacitors depends on it — keeps the chain non-inverted
  // ⚠ 2026-09-04: a `film: 4` entry was added here on the belief that vanilla's film is era 3. It is era 4 in the game
  //   file (camera is the era-3 one), so the entry was a no-op and is gone; the academy's top rung sits on era 4 by
  //   vanilla's own placement, not by a move.
};

// ---- DROPPED vanilla methods (user-ruled 2026-08-30: "drop to have at most four industry rungs") --
// Under the ABSOLUTE tier convention (t0 1700-1830 · t1 1830-1880 · t2 1880-1915 · t3 1915-1940) a
// rung's tier is its commercial-adoption year, not its position in the industry's own list. Fertilizer
// runs 1842/1885/1913/1937, which wants FIVE slots. `improved_fertilizer` (1885) is the one to go: it
// sits between two rungs that both survive and its step is the smallest of the three.
// ⚠ Its vanilla method is ABSORBED as a vanilla_pm_alias on the surviving neighbour, so the 1836
// history conversion still resolves it — and `improved_fertilizer` the TECHNOLOGY must then still gate
// something, or lint_tech_content fails the build. It gates the vanilla chemical plant's own method,
// which the vanilla building still carries, so it stays content-bearing.
// ⭐⭐ SUPERSEDED 2026-09-04 (user-ruled, restated): "the default is 4 vanilla → 4 new canon; only where we want to
//   add a rung, or have a very strong, explicitly defined and talked-through reason, do we change anything". A vanilla
//   method is NEVER dropped to make room for an invention: when a candidate rung would push an industry past four, the
//   INVENTION yields (make_tier4_config admits MODERN first, then INVENT, only while a slot is free). improved_fertilizer
//   is back on its rung — with four rungs placed by ORDER rather than by year band (the 4→4 default) it fits.
export const DROP_METHODS = {};

// ---- MODERN TOP RUNGS (user-ruled 2026-08-30: "go with 1, mint them") -------------------------
// TWELVE industries stopped 25+ years short of 1940 — furniture at 1871, arms 1886, munition 1884 —
// which is why t3 clustered on era 4 instead of era 5. Each gets the modern rung the CANONICAL
// six-rung book already designed (name, recipe and technology all exist there), so this is a RESTORE
// rather than a fresh invention.
// ⚠ Only three free vanilla era-5 technologies are production ones, so these gates are MINTED. That
// is the stated cost of option 1: the tree grows back toward the size we cut it from, and every rung
// it buys is a real 1915-1940 step the ladder was missing.
export const MODERN = {
  furniture:  { key: 'building_furniture_manufactory_sprayed',      tech: 'spray_finishing',        year: 1923 },
  textile:    { key: 'building_textile_mill_highdraft',             tech: 'long_draft_spinning',    year: 1925 },
  glass:      { key: 'building_glassworks_fibre',                   tech: 'glass_fibre',            year: 1938 },
  tooling:    { key: 'building_tooling_workshop_carbide',           tech: 'cemented_carbide',       year: 1927 },
  steel:      { key: 'building_steel_mill_strip_mill',              tech: 'continuous_strip_mill',  year: 1932 },
  motor:      { key: 'building_motor_industry_welded_diesel',       tech: 'high_speed_diesel',      year: 1935 },
  arms:       { key: 'building_arms_industry_stamped',              tech: 'stamped_receivers',      year: 1938 },
  artillery:  { key: 'building_artillery_foundry_antiaircraft',     tech: 'automatic_aa_guns',      year: 1936 },
  munition:   { key: 'building_munition_plant_automatic',           tech: 'automatic_shell_filling',year: 1940 },
  synthetics: { key: 'building_synthetics_plant_polyamide',         tech: 'polyamide_synthesis',    year: 1939 },
  automotive: { key: 'building_automotive_industry_transfer_line',  tech: 'transfer_machining',     year: 1936 },
  art_academy:{ key: 'building_art_academy_sound_film',             tech: 'sound_film',             year: 1932 },
};
// Where adding the modern rung would overflow past t3, one existing rung goes. The choice is the
// SMALLEST year-gap to its neighbour — the least distinct tier — except where that would orphan its
// technology, which lint_tech_content catches and which is noted per entry.
// ⭐ glass drops `pm_crystal_glass`: it also cures the t0/t1/t2-all-on-era-1 fault, since crystal_glass
//   was the third era-1 gate in that ladder.
// ⭐ munition drops `smokeless_powder` (1884, nine years after 1875) — which also removes one MINT.
// ⭐⭐ RETIRED 2026-09-04 (user-ruled, restated): the table above dropped TEN vanilla methods so that minted modern rungs
//   could take the fourth slot — the audit of that day found every one of them surviving only as an alias (textile's
//   sewing machines, glass's crystal glass, tooling's wrought iron, steel's open hearth, motor's electric engines, arms'
//   repeaters, artillery's breech loaders, automotive's mass production, the academy's photographic art, furniture's
//   mechanized workshops). "4 vanilla → 4 new canon" is the default; a MODERN rung is admitted only where a slot is free
//   (munition, synthetics, electrics keep theirs; the eleven above lose theirs, and their minted technologies with them).
export const DROP_FOR_MODERN = {};

// ---- THE COST BOOK: THREE LADDERS, VANILLA-ANCHORED, ONE GROWTH PATTERN (user-ruled 2026-08-30)
// "t0 are exactly vanilla, take vanilla payback period (for all 1836 scenario industries together),
//  fix it as the target, and then introduce the growth pattern that will minimize mean error."
//
// t0 IS VANILLA'S OWN required_construction, unscaled:
//   construction_cost_high      600  -> food textile furniture glass tooling paper arms artillery
//   construction_cost_very_high 800  -> fertilizer explosives steel motor automotive munition
//                                       synthetics electrics
//   construction_cost_medium    400  -> art_academy
//
// THE TARGET is vanilla's own aggregate: tools/vanilla_payback_census.mjs reads the eight vanilla 1836
// markets at their own realised prices and returns **22.1 years capital-weighted over MANUFACTURING**
// (all-industry is 15.3 and median 13.5, but WE ONLY TIER MANUFACTURING - user-corrected 2026-08-30,
// so the manufacturing figure is the right anchor). That is the number the ladder is fitted to.
//
// ⭐ k = 1.92 per TIER, fitted by minimising mean |log(payback / 22.1)| over every profitable rung at
// its OWN era's scenario prices. Result: median 15.9y, IQR 11.0-31.6, ZERO buildings under 3y.
// ⚠ The metric is LOG error, not relative error. Mean |relative| error is dominated by the long tail —
// a 660-year payback scores 42 — so minimising it drives the multiplier toward zero and returned an
// absurd non-monotone 0.05/0.37/1.08/0.24. For a ratio, log error is the honest loss function.
// ⚠ A free per-tier fit would give 1.00 / 2.09 / 2.69 / 9.47; one geometric k tracks that well through
// t1 (1.94 against 1.92) and UNDERSHOOTS at t3 (7.08 against 9.53), so the frontier still pays back
// faster than target. Accepted: the ruling
// asks for one growth pattern, not four bespoke multipliers.
// ⚠ t0 at vanilla cost pays back around 28 years, above the 22.1 target — that is what vanilla's
// 600 buys against an 1836 rung's actual profit, and it is fixed by the ruling, not fitted.
export const COST = {
  bases: { regular: 600, heavy: 800, art: 400 },   // vanilla high / very_high / medium, unscaled
  // ⭐ FLAT (user-ruled 2026-08-31): "let’s try a flat build cost, still exponential ai_value
  //   ladder, and hope that more reasonable margins for higher tiers will get realised through
  //   overbuilding and prices." k = 1 makes every rung cost its industry’s vanilla anchor, which
  //   is CLAUDE.md §10.61’s own rule ("exactly vanilla’s own cost book, flat") and removes the
  //   double jeopardy that ruling names: modernising already costs a whole new building.
  // ⚠ The superseded value was 1.92, fitted so the capital-weighted payback matched vanilla’s
  //   measured 22.1y manufacturing figure at each era’s own prices. Flat cost gives that up on
  //   purpose: late rungs will pay back far faster than 22.1y, which is the point of the test.
  k: 1.5,   // user-ruled 2026-09-01: back to vanilla_e0 x 1.5^era (600/900/1350/2025) after the flat arm
                                                   // starting at t2 pays the t2 price)
  heavyIndustries: ['fertilizer','explosives','steel','motor','automotive','munition','synthetics','electrics'],
};
export const costOf = (industryId, tier) => {
  const b = industryId === 'art_academy' ? COST.bases.art
          : COST.heavyIndustries.includes(industryId) ? COST.bases.heavy : COST.bases.regular;
  return Math.round(b * Math.pow(COST.k, tier) / 10) * 10;
};
