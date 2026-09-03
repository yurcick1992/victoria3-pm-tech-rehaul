// ============================================================================================
// THE FOUR-RUNG LADDER — derives an N-era / N-tier config from the canonical one.
//
// User-ruled 2026-08-29, after the band-budget analysis:
//   1) PORTS AND SHIPYARDS ARE VANILLA          — `disabled: true`, so the builder, the history
//      converter, the UI and the solver all leave them alone and their goods (merchant_marine,
//      clippers, steamers) come from vanilla REFERENCE buildings instead.
//   2) EVERY OTHER TIERED INDUSTRY HAS AT MOST 4 TIERS, on 4 eras, so that the two-rung
//      obsolescence rule ("current−2 must be loss-making") is inside the engine's own 25..175
//      price band instead of over it.
//
// WHY FOUR AND NOT SIX. The death condition buys obsolescence with per-rung price slope, and
// every rung of slope COMPOUNDS. Rebased at the 1836 anchor, the last rung has to clear the 25%
// floor, so the minimum admissible slope is 0.25^(1/steps): 0.707 at 6 rungs, 0.630 at 5, 0.500
// at 4. The shipped six-rung book needs slopes AT that 0.707 for engines/electricity/
// transportation — i.e. it is already on the wall — and pays for it by clamping 36 of its 105
// tiers on the 4:1 lean floor, 30 of them at e4/e5. Their designed margin is not delivered and
// the margin ladder INVERTS in practice (designed 30/38/46/54/62/70, realised median
// 30/38/46/54/42/25), which is exactly why a frontier rung fails to displace the rung below it.
//
// ⭐ ERA 0 IS 1836 AND IS VANILLA-ANCHORED (user requirement). The pre-1836 rung folds into it:
// with only four rungs and a last anchor past the game's end, a separate 1780 rung would spend a
// quarter of the ladder outside the playable window. Every good's era-0 design price is its
// MEASURED vanilla 1836 price (config/measured_price_paths.json), and the ladder rebases to 100
// at era 1 and declines by the derived slope from there — the §10.65.6 anchor blend, with 1836
// moved from era 1 to era 0.
//
// Nothing canonical is touched. Writes config/mod_config.tier4.json + config/era_prices.tier4.json.
// ============================================================================================
import {readVanilla, mainLadder, buildingGate} from './lib_vanilla_ladder.mjs';
import {ORDER, INVENT, POWER, DROP_METHODS, MODERN, DROP_FOR_MODERN, costOf} from './lib_tier4_spec.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => JSON.parse(readFileSync(join(REPO, p), 'utf8'));

const SUFFIX     = process.env.TIER4_SUFFIX || 'tier4';
const ERA_YEARS  = (process.env.TIER4_YEARS || '1836,1875,1905,1940').split(',').map(Number);
const ERA_LEAD   = (process.env.TIER4_LEAD  || '2,3,4,5').split(',').map(Number);   // vanilla game era reachable
const VANILLA_INDUSTRIES = new Set((process.env.TIER4_VANILLA || 'port,shipyard,shipyard_steam,railway,power').split(',').filter(Boolean));
// ⭐ POWER joined that list on 2026-08-30: it goes back to being a normal vanilla building with
//   SWITCHABLE PMs rather than a tiered chain. Its earliest method is stripped from the vanilla PMG
//   at emission — see lib_tier4_spec.mjs POWER and build.ps1's PMG ownership step.
const GAME = process.env.VIC3_GAME || 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const VAN  = readVanilla(GAME);
const COST_K = +(process.env.TIER4_COST_K || 1.4);   // the build-cost ladder's one exponent
const N = ERA_YEARS.length;
// ⭐ THE OUTPUT STEP IS 2.5 PER RUNG (user-ruled 2026-09-01), overriding the respread that held the
//   END-TO-END gain equal to the six-rung book. End to end this is 2.5^3 = x15.6 against the old
//   1.5^5 = x7.59 — the productivity ladder DOUBLES in span.
// ⚠ The point is WAGE DILUTION, not the recipe. Employment per level is constant across rungs, so
//   spreading a fixed wage bill over 2.5x the output per rung is the whole mechanism: the frontier
//   gets cheaper per unit BECAUSE its crew is unchanged. That is why the step matters more than the
//   input ratio, and why this is solved PRICES-FIRST — mandate the price path, then let the recipe
//   fall out of it (era_inverse.mjs, §10.65).
// ⚠ Measured 2026-09-01, the reason for the change: realised wage share RISES with rung in game
//   (e0 20% -> e3 47%) while the base-price model says it FALLS (42% -> 19%), and in Britain the
//   margin ladder is outright inverted (e0 40% -> e3 22%). A bigger output step is the one lever
//   that attacks that directly without cutting anyone’s workforce.
const OUT_LADDER = +(process.env.TIER4_OUT_STEP || 2.5);
// ai_value ladder: USER-RULED 2026-08-29 to 1000 / 2000 / 4000 / 8000 -- an explicit doubling per
// ERA, replacing the derived 750 x 1.8^(5/3) = 750/1998/5321/14172. Two deliberate consequences:
//   * e0 rises 750 -> 1000, i.e. our first rung stops sitting BELOW the engine default of 1000 that
//     every untiered vanilla building carries -- it no longer loses to a generic building by default.
//   * the ladder FLATTENS end-to-end, x8 across four rungs against the old x18.9, so the frontier is
//     less dominant over its own industry's lower rungs.
const AI_BASE    = +(process.env.TIER4_AI_BASE  || 750);
const AI_RATIO   = +(process.env.TIER4_AI_RATIO || 2.5);   // user-ruled 2026-09-01: 750 x 2.5^era = 750/1875/4688/11719
//   = 750 / 1950 / 5070 / 13182. Supersedes 1000 x 2.5^era (2026-08-30) and 1000 x 2^era (2026-08-29).
//   ⚠ KEYED ON THE ERA, NEVER THE RUNG INDEX — a building competes against every OTHER industry's,
//   so keying desire on an industry's own rung hands the late-starting industries a malus nobody
//   designed (BUGS_AND_FIXES 2026-08-29). The invariant to assert is ONE ai_value PER ERA.
//   ⚠ 750 at e0 is BELOW the engine default of 1000 that every untiered vanilla building carries,
//   which the 1000-base ladders were chosen to match. Deliberate: the end-to-end spread is x17.6
//   (against x15.6 at 1000x2.5), bought by making the first rung slightly less desired than a
//   generic building rather than by making the frontier dearer still.

const SRC_YEARS = [1780, 1836, 1870, 1900, 1920, 1945];  // the six eras these premises were authored on

// linear interpolation of a per-era series authored on SRC_YEARS, onto an arbitrary year
function atYear(series, year) {
  if (year <= SRC_YEARS[0]) return series[0];
  if (year >= SRC_YEARS[SRC_YEARS.length - 1]) return series[series.length - 1];
  for (let k = 1; k < SRC_YEARS.length; k++) {
    if (year <= SRC_YEARS[k]) {
      const f = (year - SRC_YEARS[k - 1]) / (SRC_YEARS[k] - SRC_YEARS[k - 1]);
      return series[k - 1] + f * (series[k] - series[k - 1]);
    }
  }
  return series[series.length - 1];
}
const nearestSrc = year => SRC_YEARS.reduce((best, y, k) => Math.abs(y - year) < Math.abs(SRC_YEARS[best] - year) ? k : best, 0);

// era BANDS: the midpoints between anchors, exactly as the six-era ladder does it
const BANDS = [];
for (let k = 1; k < N; k++) BANDS.push((ERA_YEARS[k - 1] + ERA_YEARS[k]) / 2);
const eraOfYear = y => { let e = 0; while (e < BANDS.length && y > BANDS[e]) e++; return e; };

// ============================================================================================
// ⭐⭐ --apply-solve — FOLD THE SOLVED RECIPE BOOK BACK INTO THE CONFIG.
//
// `era_inverse.mjs --write` writes its artifact and NOTHING ELSE — deliberately, it is an experiment
// that must not touch a shipped book. So after a solve, `config/mod_config.<sfx>.json` still carries
// the CANONICAL six-era recipes with only their output_qty re-laddered: an incoherent book that is
// neither arm. The balance sheet showed it immediately (steel reading +54% where the solver said
// +26%), which is exactly what a sheet is for.
//
// This mode applies the artifact's `recipes` (inputs + output_qty) and restates `target_be` from them
// under the linter's own legacy wage_pct rule, so lint_profitability stays a drift guard — the same
// two steps `make_solver2_config.mjs` does for the canonical arm. `--cost-book` additionally takes the
// artifact's payback-normalized `building_cost`; it is OPT-IN because §10.61 rules building cost to be
// vanilla's own book flat, and switching cost regimes silently is not this tool's call.
//
//   node tools/make_tier4_config.mjs --apply-solve [--cost-book]
// ============================================================================================
if (process.argv.includes('--apply-solve')) {
  const cfgPath = `config/mod_config.${SUFFIX}.json`;
  const cfg = rd(cfgPath), inv = rd(`config/era_inverse.${SUFFIX}.json`);
  const COSTBOOK = process.argv.includes('--cost-book');
  const PRICES = {};
  for (const line of readFileSync(join(REPO, 'tools/goods_prices.tsv'), 'utf8').split(/\r?\n/)) {
    const m = line.split('\t');
    if (m.length >= 2 && !/^#|^good/i.test(m[0]) && +m[1] > 0) PRICES[m[0].trim()] = +m[1];
  }
  let recipes = 0, restated = 0, costed = 0, missing = [];
  for (const ind of cfg.industries) {
    if (ind.disabled) continue;
    for (const t of ind.tiers) {
      const r = inv.recipes[t.key];
      if (!r) { if (Object.keys(t.inputs || {}).length) missing.push(`${ind.id} e${t.era} ${t.key}`); continue; }
      t.output_qty = r.output_qty;
      t.inputs = { ...r.inputs };
      recipes++;
      const outGood = t.output_good || ind.output_good;
      const Obase = t.output_qty * (PRICES[outGood] || 0);
      let Ibase = 0; for (const g in t.inputs) Ibase += t.inputs[g] * (PRICES[g] || 0);
      const wp = t.wage_pct != null ? +t.wage_pct : 0.25;
      if (Obase > 0) { t.target_be = Math.round(Ibase / ((1 - wp) * Obase) * 100); restated++; }
      if (COSTBOOK && inv.cost_book && inv.cost_book[t.key] != null) { t.building_cost = inv.cost_book[t.key]; costed++; }
    }
  }
  cfg._comment = (cfg._comment || '').replace(/ Recipes are the .*$/, '')
    + ` Recipes are the SOLVED four-rung book from config/era_inverse.${SUFFIX}.json (applied by --apply-solve);`
    + ` target_be restated from them as a drift guard${COSTBOOK ? '; building_cost from the artifact cost book' : ''}.`;
  writeFileSync(join(REPO, cfgPath), JSON.stringify(cfg));
  console.log(`APPLIED the solved book -> ${cfgPath}`);
  console.log(`  recipes ${recipes} · target_be restated ${restated}${COSTBOOK ? ` · building_cost ${costed}` : ' · building_cost UNCHANGED (§10.61 flat vanilla anchors; --cost-book to override)'}`);
  // a tier with inputs but no solved recipe would silently keep the canonical book's numbers — the
  // exact half-and-half state this mode exists to end, so it is an error rather than a warning
  if (missing.length) { console.error(`  ⚠⚠ ${missing.length} tier(s) have inputs but NO solved recipe: ${missing.join(', ')}`); process.exit(1); }
  process.exit(0);
}

const cfg = rd('config/mod_config.json');
const fit = rd('config/era_prices.json');

const report = [];
const out = structuredClone(cfg);
out._comment = `FOUR-RUNG LADDER (${SUFFIX}) derived by tools/make_tier4_config.mjs from config/mod_config.json. `
  + `Eras ${ERA_YEARS.join('/')}; ports and shipyards left VANILLA; every other industry capped at ${N} tiers. `
  + `Era 0 is 1836 and is vanilla-anchored. See the tool's header for why four.`;

for (const ind of out.industries) {
  if (VANILLA_INDUSTRIES.has(ind.id)) {
    ind.disabled = true;
    report.push({ id: ind.id, kept: 0, note: 'VANILLA (disabled — the base-game building stands)' });
    continue;
  }
  // ⭐⭐ RUNGS COME FROM VANILLA'S OWN MAIN LADDER (user-ruled 2026-08-30) — see lib_tier4_spec.mjs.
  // Each rung IS a vanilla production method, taken in vanilla order (or the ruled ORDER override),
  // and sourced from the CANONICAL tier that already carries that method as its `vanilla_pm`. The old
  // date-proximity DP over the six-rung book is GONE: choosing among invented rungs by date is what
  // orphaned four vanilla technologies and let one technology gate two rungs of one industry.
  const byPm = new Map();
  for (const t of ind.tiers) if (t.vanilla_pm) byPm.set(t.vanilla_pm, t);
  const lad = mainLadder(VAN, ind, ind);
  const methods = ORDER[ind.id] || lad.methods;
  const dropSet = new Set([...(DROP_METHODS[ind.id] || []), ...(DROP_FOR_MODERN[ind.id] ? [DROP_FOR_MODERN[ind.id]] : [])]);
  const methodsKept = methods.filter(p => !dropSet.has(p));
  const missing = methodsKept.filter(p => !byPm.has(p));
  if (methods.length && missing.length)
    throw new Error(`${ind.id}: vanilla method(s) with no canonical tier to source from: ${missing.join(', ')}`);

  const anchorKey = (ind.tiers[0] || {}).key;
  const bldGate = buildingGate(VAN, anchorKey);
  const kept = [];
  for (const p of methodsKept) {
    const t = byPm.get(p);
    // ⭐ THE GATE COMES WITH THE METHOD. A rung takes the technology VANILLA gates its own
    //   production method with — that is the whole no-orphan guarantee: every vanilla technology
    //   that gated a method in a chain we replace still gates the rung that method became.
    //   An UNGATED vanilla method (the era-0 ones: pm_bakery, pm_muskets, pm_forest_glass) keeps the
    //   canonical tier’s technology, which is an era-1 one granted at the 1836 start anyway - a rung
    //   with no gate at all would be buildable from 1836 regardless, so nothing is lost.
    // An UNGATED vanilla method falls back to the vanilla BUILDING’s own unlocking technology, which is
    // what actually gates it in game (pm_leblanc_process is ungated; building_explosives_factory is not).
    // Only if that is absent too does the canonical tier’s technology stand - and that one may be a
    // SIX-RUNG INVENTION that no longer exists, which the tech tool then rejects by name.
    const g = VAN.gatesOf(p)[0] || bldGate;
    if (g) t.tech = g;
    kept.push({ t, invented: false });
  }
  // splice the invented rungs in at their ruled index (the NARRATIVE gap, not always the top)
  for (const inv of (INVENT[ind.id] || [])) {
    // ⚠ CLONE THE RUNG BELOW, not the one above. An invented rung is a step UP from its predecessor,
    //   so seeding it from its successor imports goods that cannot exist yet: motor’s 1867 watertube-
    //   boiler rung inherited the ELECTRIC engine recipe and consumed 22.6 electricity while the coal
    //   power plant (steam_turbine, era 3) did not yet exist to supply any.
    const near = kept[Math.max(0, Math.min(inv.at - 1, kept.length - 1))] || kept[0];
    const src  = near ? near.t : ind.tiers[0];
    const t = structuredClone(src);
    delete t.vanilla_pm; delete t.vanilla_pm_aliases; delete t.model_only;
    t.key = `${src.key}_${inv.tech}`.replace(/__+/g, '_');
    // ⚠⚠ AND ITS PM/PMG KEYS. Cloning a source tier carries its `pm_key` and `pmg_key` too, so an
    //   invented rung emitted a SECOND production method under the neighbour's name — the engine logs
    //   "Duplicated key … will not be created" and drops it, leaving that tier building with NO MAIN
    //   PM. Nothing else fails: the mod loads, every linter passes, the campaign runs. Electrics had
    //   THREE tiers on one pm_key. Keyed on the peg technology, which is unique per rung by the hard
    //   rule that no technology gates two rungs of one industry.
    t.pm_key  = `pm_main_${ind.id}_${inv.tech}`;
    t.pmg_key = `pmg_main_${ind.id}_${inv.tech}`;
    t.tech = inv.tech;
    if (inv.year != null) { t.tech_year = inv.year; t.natural_year = inv.year; }
    t.name = t.name ? `${t.name} (${inv.tech.replace(/_/g, ' ')})` : t.key;
    kept.splice(Math.min(inv.at, kept.length), 0, { t, invented: true, spec: inv });
  }
  // ⭐ THE MODERN TOP RUNG (lib_tier4_spec MODERN): restored from the canonical six-rung book, which
  //   already designed it - name, recipe and technology. Appended LAST, so it is always the frontier.
  const mod = MODERN[ind.id];
  if (mod) {
    const src = ind.tiers.find(t => t.key === mod.key);
    if (!src) throw new Error(`${ind.id}: MODERN names ${mod.key}, which the canonical book does not define`);
    const t = structuredClone(src);
    delete t.model_only;
    t.tech = mod.tech; t.tech_year = mod.year; t.natural_year = mod.year;
    kept.push({ t, invented: true, spec: mod, modern: true });
  }
  if (!kept.length) { report.push({ id: ind.id, kept: 0, note: 'no vanilla ladder and nothing invented' }); continue; }
  // rung index IS the era; every downstream ladder (cost, ai_value, output) keys on it
  // ⭐⭐ A RUNG'S TIER IS ITS COMMERCIAL-ADOPTION YEAR, NOT ITS POSITION (user-ruled 2026-08-30).
  //   t0 1700-1830 · t1 1830-1880 · t2 1880-1915 · t3 1915-1940 — "the year corresponds to the
  //   commercial adoption on a noticeable scale in the pioneering country". So a LATE industry starts
  //   at t1/t2/t3 and simply has no early rungs: automotive is t2/t3, synthetics t1/t2/t3.
  //   ⚠ This is what makes the margin ladder, the cost ladder and ai_value mean the same thing across
  //   industries — all three are keyed on the tier, so a rung-index era would have given automotive's
  //   1899 plant era-0 economics.
  //   Rungs are pushed up where two land in one band, which keeps them distinct and monotone; the
  //   push is why a 5th slot is possible at all, and the spec drops a rung wherever it happens.
  const TIER_BANDS = [1830, 1880, 1915];
  const bandOf = y => y < TIER_BANDS[0] ? 0 : y < TIER_BANDS[1] ? 1 : y < TIER_BANDS[2] ? 2 : 3;
  { let prev = -1;
    for (const k of kept) { let b = bandOf(+k.t.tech_year || ERA_YEARS[0]);
      if (b <= prev) b = prev + 1; prev = b; k.era = b; }
    const top = kept[kept.length - 1].era;
    if (top > 3) throw new Error(`${ind.id}: rungs overflow past t3 (${kept.map(k => k.t.tech_year).join('/')}) — drop one in lib_tier4_spec`); }
  const yr = t => +(t.tech_year != null ? t.tech_year : (t.natural_year || ERA_YEARS[0]));
  const base = kept[0].t;
  const baseOut = +base.output_qty || 0;
  const droppedT = ind.tiers.filter(t => !kept.some(k => k.t === t));
  const dropped = droppedT.map(t => `${t.key}@${t.tech_year}`);

  // A DROPPED TIER'S VANILLA METHOD IS ABSORBED, NEVER LOST — the 1836 converter maps a starting
  // factory through `vanilla_pm`. ⚠ Under the vanilla-ladder rule a dropped tier is by construction
  // one WE invented in the six-rung book (every vanilla method is kept), so this now only ever moves
  // our own aliases, never a vanilla method off its own rung.
  for (const d of droppedT) {
    // ⚠ NEAREST IN TIME IS NOT ENOUGH — it can DEMOTE a factory across the ladder. Automotive's
    //   `pm_mass_automobile_production` (1913) is vanilla's LAST method, and the nearest rung by year
    //   is t2 (1899) rather than t3 (1936), so an advanced car plant converted onto the industry's
    //   FIRST rung. L14 cannot see that — the owner still holds t2's gate — which is landmine L13.
    //   So: nearest in time, but never shifting the factory more than a third of the ladder away from
    //   the relative position it held in vanilla.
    const vpos = methods.indexOf(d.vanilla_pm);
    const vFrac = methods.length > 1 && vpos >= 0 ? vpos / (methods.length - 1) : 0;
    const ok = kept.filter((k, ix) => kept.length < 2 ||
      Math.abs(ix / (kept.length - 1) - vFrac) <= 0.34);
    const pool = ok.length ? ok : kept;
    let near = pool[0];
    for (const k of pool) if (Math.abs(yr(k.t) - yr(d)) < Math.abs(yr(near.t) - yr(d))) near = k;
    const list = near.t.vanilla_pm_aliases || (near.t.vanilla_pm_aliases = []);
    for (const pm of [d.vanilla_pm, ...(d.vanilla_pm_aliases || [])]) if (pm && !list.includes(pm) && pm !== near.t.vanilla_pm) list.push(pm);
  }

  // ⭐⭐ THE COST LADDER (user-ruled 2026-08-29): building_cost = the industry's own VANILLA anchor
  // × COST_K^era. It replaces §10.61's flat book FOR THIS ARM and is chosen, not fitted:
  //   · era 0 is vanilla's own cost exactly (k^0 = 1), so 1836 does not diverge;
  //   · ONE exponent for every industry, so the trend is a trend and not a per-era table;
  //   · at k = 1.3 the frontier rung pays back in 9.4y against 4.3y under the flat book — the flat
  //     book's problem being that profit per level grows ×3.75 up the ladder while £/construction
  //     point FALLS 720→527, so a constant cost makes the newest building the fastest to repay.
  // ⚠ The anchor is read from the CANONICAL config, where §10.61 makes every tier of an industry
  // carry the same flat cost — so this is idempotent, and re-running cannot compound the ladder.
  const costAnchor = +(base.building_cost ?? 0) || null;

  for (const k of kept) {
    const t = k.t, j = k.era;
    t.era = j;
    t.natural_year = ERA_YEARS[j];
    // TWO LADDERS, from lib_tier4_spec - never the canonical per-building anchor (see COST there)
    t.building_cost = costOf(ind.id, j);
    // OUTPUT: one uniform per-rung productivity step, anchored on this industry's own first rung.
    // (A tier's absolute output is a design output, not measured — the ladder is what carries meaning.)
    const steps = j - kept[0].era;
    t.output_qty = Math.round(baseOut * Math.pow(OUT_LADDER, steps) * 10) / 10;
    // ai_value is keyed on the ABSOLUTE ERA, never on the rung index. A building competes for
    // construction against every OTHER industry's buildings, so two buildings of the same era must
    // carry the same desire whatever rung of their own ladder they happen to be. Keying it on
    // `steps` gave era 2 three different values (750/1998/5321, a 7.1x spread) and handed the
    // late-starting industries -- automotive, power, synthetics, electrics, i.e. the whole new
    // economy -- a 2.66-7.1x malus they were never meant to have. The canonical book is era-keyed
    // (one value per era, no exceptions); so is `building_cost` two lines up. Only output_qty is
    // rung-anchored, and deliberately so.
    t.ai_value = Math.round(AI_BASE * Math.pow(AI_RATIO, j));
    delete t.model_only;
  }
  // no two rungs of an industry may share an emitted key — a duplicate is DROPPED by the engine,
  // not rejected, so the failure is invisible without reading error.log (2026-08-30).
  for (const f of ['key', 'pm_key', 'pmg_key']) {
    const seen = new Map();
    for (const k of kept) { const v = k.t[f]; if (!v) continue;
      if (seen.has(v)) throw new Error(`${ind.id}: two rungs share ${f}='${v}' (${seen.get(v)} and ${k.t.key}) — the engine would silently drop one`);
      seen.set(v, k.t.key); } }
  ind.tiers = kept.map(k => k.t);
  report.push({ id: ind.id, kept: ind.tiers.length,
    note: ind.tiers.map(t => `e${t.era}:${t.tech_year}`).join(' ') + (dropped.length ? `   dropped ${dropped.join(', ')}` : '') });
}

// ============================================================================================
// ⭐⭐ A SUBSIDY POLICY MAY NOT NAME A BUILDING THIS BOOK DOES NOT EMIT.
//
// `building_subsidies` and `subsidy_conditional` are written against the SIX-rung book: five port
// tiers, four railway tiers, three power tiers. On this book the port and railway industries are
// vanilla and one power tier was resampled away, so nine of those keys name nothing.
//
// ⚠⚠ THAT IS NOT INERT, AND THE FIRST LAUNCH PROVED IT. The emitted
// `common/script_values/zzz_pm_rehaul_subsidy_values.txt` sums merchant-marine coverage with
// `is_building_type = building_port_steam` and friends; against a book that has no such building the
// engine logs `PostValidate of trigger 'is_building_type' returned false` (four lines, one per tier)
// and `pmr_mm_high_cov` is then computed from broken terms. The conditional strategies' `possible`
// blocks test against that value, so EVERY AI country's administrative strategy could be forced to
// one branch — a global behavioural perturbation with nothing to do with what this arm measures.
// It is not fatal, which is exactly why it had to be caught at the smoke check rather than in the data.
//
// So: drop every subsidy key that is a tier of some industry in the CANONICAL book but is not an
// emitted tier here, and drop `subsidy_conditional` outright when its coverage tiers are gone. A key
// that was never one of our tiers (building_trade_center) is a real vanilla building and stays.
// Vanilla's own default strategy still subsidises ports and railways — the builder restates that trio
// live into any strategy lacking a block — so dropping OUR override leaves the base game's policy
// standing, which is the right answer for an industry we just handed back.
// ============================================================================================
{
  const canonTierKeys = new Set();
  for (const i of cfg.industries) for (const t of (i.tiers || [])) canonTierKeys.add(t.key);
  const emitted = new Set();
  for (const i of out.industries) { if (i.disabled) continue; for (const t of i.tiers) emitted.add(t.key); }
  const dropped = [];
  for (const k of Object.keys(out.building_subsidies || {}))
    if (canonTierKeys.has(k) && !emitted.has(k)) { delete out.building_subsidies[k]; dropped.push(k); }
  const cov = (out.subsidy_conditional || {}).coverage_tiers || [];
  if (out.subsidy_conditional && cov.some(k => !emitted.has(k))) {
    delete out.subsidy_conditional;
    dropped.push('subsidy_conditional (its coverage tiers are not emitted here)');
  }
  if (dropped.length) console.log(`  subsidy entries dropped (not emitted by this book): ${dropped.join(', ')}\n`);
}

// ============================================================================================
// ⭐⭐ THE RESEARCH JOURNAL ENTRIES ARE MADE SIGNIFICANTLY LESS PRODUCTIVE (user-ruled 2026-08-29).
// Two independent dials, both taken:
//
// 1. A STEEPER WORKFORCE LADDER. The bar for a tier at era e reads the PEOPLE employed in that
//    industry's era e−1 rung, so the threshold has to be read against what a leading country
//    actually holds. Measured on a played campaign (solver2f n=1): GBR 1875 textile e1 290k ·
//    furniture e1 175k · shipyard e1 160k · arms e0 35k; USA 1905 tooling e2 160k · motor e3 130k;
//    USA 1936 motor e4 2.67M · tooling e4 980k. Against that the six-era book's 15k/45k/135k/405k
//    is trivially cleared — Britain's textile alone passes the 45k bar from 1875 and never drops
//    below it. The new ladder is ×4 from 30k, which puts each bar at roughly the MEDIAN predecessor
//    pool a leader holds at that date, so about half its industries feed a given bar rather than all.
//    ⚠ Those measurements come from the SIX-era arm, where a predecessor rung is one of five rather
//    than one of three; on this ladder each rung holds a larger share of its industry, so the same
//    numbers bite somewhat less than the table suggests. ×5 (30k/150k/750k) is the next arm, not a
//    guess to split the difference with.
// 2. TWICE THE FIRINGS FOR THE SAME GOAL — and the RIGHT reading of it (user-corrected 2026-08-30):
//    the three stages STAY. What halves is how much each TICK contributes toward completing a phase,
//    so a bar needs twice as many qualifying months to fill. Implemented as max_value x2 on the bar,
//    which is arithmetically the same thing and needs no change to the emitter's per-source add.
//    ⚠ I first built this as SIX stages at grant 0.25 - same total grant, but it doubled the number of
//    journal entries (546 against 273) and changed the SHAPE of the mechanic rather than its rate.
//    place of three at a half. The total grant is unchanged (1.5× the era cost); the bar has to be
//    filled twice as many times to collect it.
// ============================================================================================
const THRESH_BASE = +(process.env.TIER4_JE_BASE || 30000);
const THRESH_STEP = +(process.env.TIER4_JE_STEP || 4);
if (out.research_events) {
  const re = out.research_events;
  re.enabled = true;
  // era 0 is the 1836 start rung: its technologies ride `add_era_researched`, so no bar can fire on
  // them. It is listed anyway so a lookup can never miss — an absent key reads as undefined, not as
  // "no bar", and the emitter throws on a researchable rung with no source.
  // ⚠⚠ `thresholds_by_era` IS CONSUMED ON TWO DIFFERENT AXES and the map has to serve both. For OUR
  // tiers `addSource` passes the TIER's ladder era (0…3 here); for rule D — vanilla production
  // technologies outside our ladder, anchored on the building groups they unlock — it passes the
  // technology's MECHANICAL era (2…5), clamped to ≥2. The two overlap at keys 2 and 3. The six-era
  // book never noticed because its ladder eras and the mechanical eras nearly coincided; on a
  // four-rung ladder they do not, and a map keyed only 0…3 dies on "no threshold configured for
  // era 4" the first time a rule-D technology asks.
  // So the map runs 0…5: our rungs read 1/2/3 (30k / 120k / 480k) and rule D reads 2…5, which puts
  // the peripheral vanilla technologies on the steep end too — consistent with the ruling, and the
  // worst case is a bar that never fills, i.e. that technology is simply researched normally.
  const T1 = THRESH_BASE, T2 = Math.round(THRESH_BASE * THRESH_STEP), T3 = Math.round(THRESH_BASE * THRESH_STEP * THRESH_STEP);
  re.thresholds_by_era = { 0: T1, 1: T1, 2: T2, 3: T3, 4: T3, 5: T3 };
  re.stages = ['inception', 'development', 'implementation'];   // UNCHANGED from canonical
  re.grant_fraction = 0.5;                        // UNCHANGED from canonical - the total is 1.5x either way
  re.industry_bar_months = 72;                    // was 36: each tick is worth half, so the bar takes twice as long
  re.war_bar_months = 12;                         // was 6, same halving
  // ⭐ EXPLOSIVES NEEDS A NECESSITY ANCHOR ON THIS BOOK, and it is the tech re-peg that created the
  // need. Its first rung now gates on `intensive_agriculture` — vanilla's OWN requirement for
  // building_explosives_factory — which is a researchable era-2 technology, where the six-era book
  // used our own era-1 `leblanc_process` and so was free at the 1836 start. An industry whose first
  // rung is researchable and has no anchor gets a research bar with no source, which can never fill;
  // emit_research_events throws on exactly that, and it threw here.
  // The pull is blasting and shell-filling: mines and quarries buy dynamite, armies buy the rest.
  re.necessity_anchors = { ...(re.necessity_anchors || {}),
    explosives: ['bg_mining', 'bg_logging', 'bg_army'] };
  re._why_tier4 = 'Four-rung ladder, 2026-08-29: thresholds ×' + THRESH_STEP + ' from ' + THRESH_BASE
    + ' (measured against a leading country\'s real predecessor workforce), and twice the firings for '
    + 'the same total grant (6 stages × 0.25 in place of 3 × 0.5). See BALANCE_FRAMEWORK §10.67.';
  delete re._threshold_era1_note;                 // that note is about the six-era ladder's era-1 guess
}

// ---------------------------------------------------------------------------------------------
// the companion fit file: era anchors, wages, SoL, the reachable vanilla era, and the per-era
// secondary-PM selections (resampled from the nearest authored era, by year)
// ---------------------------------------------------------------------------------------------
const srcWage = fit.eras.map(e => e.base_wage), srcSol = fit.eras.map(e => e.sol);
const newFit = {
  _comment: `Companion fit for ${SUFFIX}: ${N} eras at ${ERA_YEARS.join('/')}. base_wage and sol are the six-era `
    + `series interpolated onto the new anchor years; lead is the vanilla game era a scenario may reach; `
    + `pms are the nearest authored era's secondary-PM selections. targets and prices copied verbatim.`,
  eras: ERA_YEARS.map((year, j) => ({
    era: j, year,
    sol: Math.round(atYear(srcSol, year)),
    base_wage: +atYear(srcWage, year).toFixed(6),
    lead: ERA_LEAD[j],
    label: `${year}`,
  })),
  targets: fit.targets,
  prices: fit.prices,
  pms: ERA_YEARS.map(year => fit.pms[nearestSrc(year)]),
};

// ---------------------------------------------------------------------------------------------
// the measured price paths, resampled onto the new anchor years (they are a CALENDAR observation,
// so they are interpolated by year, never re-indexed by rung)
// ---------------------------------------------------------------------------------------------
const mp = rd('config/measured_price_paths.json');
const newMp = { _provenance: (mp._provenance || '') + ` | resampled onto ${ERA_YEARS.join('/')} by tools/make_tier4_config.mjs`,
                anchors_vanilla: mp.anchors_vanilla, raw_paths: {} };
for (const g in mp.raw_paths) newMp.raw_paths[g] = ERA_YEARS.map(y => Math.round(atYear(mp.raw_paths[g], y)));

// ⭐⭐ PROPERTIES OF THIS LADDER THAT MUST SURVIVE REGENERATION. This tool rebuilds the config from the
//   CANONICAL book every run, so anything set on the tier4 config by hand or by a later tool is wiped
//   unless it is emitted HERE. Both of these were lost that way once (2026-09-01).
// era_game_era: our rung index is NOT the game era. era_pm.mjs gates a method on the GAME technology
//   era, and on four rungs the top index is 3, so every game-era-4/5 method (radios, rayon, aeroplanes,
//   tanks) was excluded from every era. Anchors 1836/1875/1905/1940 in vanilla windows -> 1/3/4/5,
//   with e0 taking 1 rather than 2 to keep the 1836 composition near vanilla.
out.era_game_era = [1, 3, 4, 5];
// the AI long-construction thresholds, in WEEKS at full construction usage. Vanilla is 40/60; this is
//   4x (user-ruled 2026-09-01), so the x1.5^era cost ladder does not push the top rung into the
//   penalty band. The two MULTs stay vanilla — raising the thresholds is a RELAXATION, not a malus.
out.ai_defines = Object.assign({}, out.ai_defines, {
  PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD: 160,
  PRODUCTION_BUILDING_VERY_LONG_CONSTRUCTION_TIME_THRESHOLD: 240,
});
writeFileSync(join(REPO, `config/mod_config.${SUFFIX}.json`), JSON.stringify(out));
writeFileSync(join(REPO, `config/era_prices.${SUFFIX}.json`), JSON.stringify(newFit, null, 1));
writeFileSync(join(REPO, `config/measured_price_paths.${SUFFIX}.json`), JSON.stringify(newMp, null, 1));
// L20: an alternate config needs a paired tech-tree file or the BUILD dies. We emit no tech tree in
// this pass, but the twin must exist for any later build attempt to get past preflight.
try { writeFileSync(join(REPO, `config/tech_tree_options.${SUFFIX}.json`), readFileSync(join(REPO, 'config/tech_tree_options.json'), 'utf8')); } catch {}

console.log(`THE FOUR-RUNG LADDER — ${N} eras at ${ERA_YEARS.join(' / ')}   (bands ${BANDS.join(' / ')})`);
console.log(`  output ladder x${OUT_LADDER.toFixed(3)}/rung (end-to-end x${Math.pow(OUT_LADDER, N - 1).toFixed(2)}, unchanged)`);
console.log(`  ai_value ladder ${AI_BASE} x${AI_RATIO}/era -> ${[0,1,2,3].map(e=>Math.round(AI_BASE*Math.pow(AI_RATIO,e))).join('/')}`);
console.log(`  build cost = each industry's VANILLA anchor x ${COST_K}^era  (top rung x${Math.pow(COST_K, N - 1).toFixed(2)})\n`);
console.log('  industry          rungs  placement');
for (const r of report) console.log('  ' + r.id.padEnd(17) + String(r.kept).padStart(3) + '   ' + r.note);
const tiered = report.filter(r => r.kept > 0);
console.log(`\n  ${tiered.length} tiered industries · ${tiered.reduce((a, r) => a + r.kept, 0)} tier buildings `
  + `(canonical: ${cfg.industries.length} / ${cfg.industries.reduce((a, i) => a + i.tiers.length, 0)})`);
console.log(`  vanilla again: ${[...VANILLA_INDUSTRIES].join(', ')}`);
console.log(`\n  wrote config/mod_config.${SUFFIX}.json · era_prices.${SUFFIX}.json · measured_price_paths.${SUFFIX}.json`);
