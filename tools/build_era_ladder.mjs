// Rebuild config/mod_config.json onto the mod's OWN five-era ladder.
//
//   node tools/build_era_ladder.mjs            # report only
//   node tools/build_era_ladder.mjs --write    # rewrite config/mod_config.json
//
// The five eras are the mod's own, NOT vanilla's tech eras: ~1750 / 1850 / 1900 / 1925 / 1940.
// Deliberately wider than the game's own window at the front and CONTRACTING towards the back, because
// technical progress accelerates after the industrial revolution. A developed country is meant to hold
// most of an era's techs by its anchor year.
//
// Two rules from the design:
//   * no industry has two tiers on the same era;
//   * output is mechanical — the first tier keeps the vanilla tier-1 output and every next tier is ×1.5.
//     Inputs are the lever, and they are solved later (tools/era_solver.mjs), not here.
//
// Tiers with no real unlocking technology yet are emitted as `model_only: true`: the balance model and the
// scenario panel see them, the BUILDER DOES NOT. They become real buildings when the tech tree gains the
// matching techs — at which point the flag comes off and a `tech` goes on. Nothing else has to change.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './econ_host.mjs';

const CFG = join(REPO, 'config', 'mod_config.json');
const WRITE = process.argv.includes('--write');

// The mod's own era anchors. Contracting on purpose: 100 years, then 50, then 25, then 15.
// ⭐ ERA 0 — the pre-industrial rung, added so the 1836 SCENARIO is not a single-tier economy.
// Vanilla's own 1836 start runs 46% of the USA's tiered levels at era 1, 45% at era 2 and 9% at era 3;
// our era-1 scenario ran 100% era 1, i.e. a 1750 economy wearing an 1836 label, and that was the base
// every macro growth ratio was measured from.
// ⚠ Era 0 is ~1700 and exists ONLY for industries that existed before ~1780. Fertilizer, explosives,
// motor, munition and synthetics begin at era 2; automotive and electrics at era 3. Minting a 1700 tier
// for those would invent a technology, which is the same test every `note` in the SPEC below applies.
export const ERA_YEAR = { 0: 1700, 1: 1750, 2: 1850, 3: 1900, 4: 1925, 5: 1940 };

// ⚠ The "one technology, one era" correction that pairs with SPEC's historical moves below lives in
// `tools/era_tech_sync.mjs`, NOT here: this module runs its whole build at import time and keys off
// `--write`, the same flag `era_scenarios --write` uses, so importing it from the scenario solver would
// silently re-mint the invented tiers and discard the volumes that solver had just produced.

// Output per tier: t0 = X/1.5, t1 = X, ... t5 = X x 1.5^4 = 5.0625X, and the whole span t0->t5 is 7.59x.
//
// ⚠ IT WAS 1.55, JUSTIFIED BY A CHECK THAT DOES NOT DISCRIMINATE. The old note here reasoned from vanilla
// GDP per capita; that was later measured to be nearly INSENSITIVE to this parameter — sweeping 1.25 to
// 1.55 moved per-capita growth by 16% because the solver simply places fewer levels when each makes more.
// Do not re-justify this number that way.
// What 1.5 does agree with, from a completely different direction: vanilla's OWN main-PM step, geometric
// mean 1.497 across 43 steps of 19 industries.
// Overridable for sweeps: `node tools/build_era_ladder.mjs --write --mult=1.6`
const OUTPUT_MULT = (() => {
  const a = process.argv.find(x => x.startsWith('--mult='));
  return a ? +a.split('=')[1] : 1.5;
})();

// ---------------------------------------------------------------------------------------------------
// THE LADDER SPEC. `eras` gives each EXISTING config tier's era, in config order — explicit rather than
// derived, because every interesting case is an exception (see the notes). `invent` lists the tiers that
// do not exist in vanilla at all. Sources for the dates are the industry research in this task's notes.
const SPEC = {
  // --- unchanged shape, one tier added at the top ---------------------------------------------------
  food:        { eras:[1,2,3], invent:[ {era:0, slug:'artisanal', name:'Artisanal Food Workshops', pm:'Artisanal Preserving'}, {era:4, slug:'mechanised', name:'Mechanised Bakery Food Industries', pm:'Mechanised Bread Plant'} ],
                 note:'stops at era 4: mechanised bread and quick-freezing peak in the 1920s-30s; continuous-mix dough is 1953. WEAKEST plateau call — 1930s food TFP was still healthy.' },
  textile:     { eras:[1,2,3,4], invent:[ {era:0, slug:'cottage', name:'Cottage Textile Workshops', pm:'Cottage Spinning'},],
                 note:'stops at era 4: the Northrop automatic loom (1894) + individual electric drive is the last pre-war step. Shuttleless looms and open-end spinning are 1950s-60s — an era-5 tier would be inventing a technology.' },
  furniture:   { eras:[1,2,3], invent:[ {era:0, slug:'village', name:'Village Furniture Workshops', pm:'Village Joinery'}, {era:4, slug:'sprayed', name:'Spray-Finished Furniture Manufactories', pm:'Spray Lacquer Finishing'} ],
                 note:'stops at era 4: the trade stayed hand-assembled into the 1990s; only finishing (nitrocellulose spray lacquer, 1923) is a clean >50% step after 1900.' },
  glass:       { eras:[1,2,3,4], invent:[ {era:0, slug:'broad', name:'Broad Glass Workshops', pm:'Broad Glass'}, {era:5, slug:'ribbon', name:'Ribbon Machine Glassworks', pm:'Continuous Ribbon Machine'} ],
                 note:'Owens bottle machine 1903-05 (one machine ~= 50 hand workers), Fourcault/Colburn flat glass 1913-17, Corning ribbon machine 1926.' },
  tooling:     { eras:[1,2,3,4], invent:[ {era:0, slug:'blacksmith', name:'Blacksmith Tool Workshops', pm:'Blacksmithing'}, {era:5, slug:'carbide', name:'Cemented Carbide Tooling Workshops', pm:'Cemented Carbide Tools'} ],
                 note:'high-speed steel 1900 (cutting 5 -> 30 m/min), cemented carbide 1926-27 (another 4-7x).' },
  paper:       { eras:[1,2,3], invent:[ {era:0, slug:'rag', name:'Rag Paper Workshops', pm:'Rag Pulping'}, {era:4, slug:'kraft', name:'Kraft Process Paper Mills', pm:'Kraft Sulfate Pulping'},
                                        {era:5, slug:'highspeed', name:'High-Speed Machine Paper Mills', pm:'High-Speed Fourdrinier'} ],
                 note:'NO plateau — the hunch that paper stops improving did not survive research. Machine speed 270 ft/min (1889) -> 400-500 (1900) -> 600 (1910) -> 1500+ by 1940, on top of sulfite 1874 / kraft 1884.' },
  fertilizer:  { eras:[2,3,4], invent:[ {era:5, slug:'reforming', name:'Steam Reforming Chemical Plants', pm:'Methane Steam Reforming'} ],
                 note:'superphosphate 1842 (era 2 start), Haber-Bosch commercial at Oppau 1913, methane steam reforming ~1930-31.' },
  explosives:  { eras:[2,3,4,5], invent:[],
                 note:'nitroglycerin 1847, dynamite 1867, Ostwald ammonia oxidation commercial 1908, continuous nitration late 1920s.' },
  steel:       { eras:[1,2,3,4], invent:[ {era:0, slug:'bloomery', name:'Bloomery Steel Forges', pm:'Bloomery Process'}, {era:5, slug:'strip_mill', name:'Continuous Strip Mill Steelworks', pm:'Continuous Wide Strip Mill'} ],
                 note:'crucible 1740 anchors era 1. The era-5 tier is the CONTINUOUS WIDE STRIP MILL (1926), interwar steel’s biggest step and absent from vanilla entirely.' },
  motor:       { eras:[2,3,4], invent:[ {era:5, slug:'welded_diesel', name:'Welded High-Speed Motor Industries', pm:'Welded High-Speed Diesel'} ],
                 note:'atmospheric/steam era 2, electric motor + turbine era 3, diesel (1897) era 4, high-speed welded diesel 1930s era 5.' },
  shipyard:    { eras:[1,2], invent:[],
                 note:'DEAD END, not a plateau: steam tonnage passes sail in 1890 and the last commercial sailing hulls are ~1899-1904. Two tiers is already generous.' },
  shipyard_steam:{ eras:[2,5], invent:[ {era:3, slug:'turbine', name:'Turbine Steamship Yards', pm:'Marine Steam Turbines'},
                                        {era:4, slug:'oil_fired', name:'Oil-Fired Steamship Yards', pm:'Oil-Fired Turbine Steamers'} ],
                 note:'iron screw steamers from the 1840s (era 2, per the design brief), steel + triple expansion 1881, turbines/oil 1900s-20s, welded prefabrication 1941-43 — so vanilla’s arc-welding tier belongs at era 5, not era 3.' },
  automotive:  { eras:[3,4], invent:[ {era:5, slug:'transfer_line', name:'Transfer Line Automotive Industries', pm:'Transfer Machining'} ],
                 note:'Curved Dash 1901 (era 3 start, per the design brief), moving assembly line 1913 (chassis 12.5h -> 1.5h), interwar transfer machinery.' },
  arms:        { eras:[1,2,3,4], invent:[ {era:0, slug:'gunsmith', name:'Gunsmith Arms Workshops', pm:'Handmade Muskets'}, {era:5, slug:'stamped', name:'Stamped Receiver Arms Industries', pm:'Stamped and Welded Receivers'} ],
                 note:'gunsmithing -> rifled musket 1850s -> bolt action 1888 -> stamped/welded submachine guns (MP40 1938, Sten 1941).' },
  artillery:   { eras:[1,2,3,4], invent:[ {era:0, slug:'bronze', name:'Bronze Cannon Foundries', pm:'Bronze Cannons'}, {era:5, slug:'autofrettage', name:'Autofrettaged Artillery Foundries', pm:'Autofrettage and Welded Carriages'} ],
                 note:'smoothbore -> shell gun 1820s-40s -> breech-loading steel with recoil 1897 -> autofrettage, welded carriages, automatic AA.' },
  munition:    { eras:[2,3], invent:[ {era:4, slug:'drawn_brass', name:'Drawn Brass Munition Plants', pm:'Drawn Brass Cartridges'},
                                      {era:5, slug:'automatic', name:'Automatic Line Munition Plants', pm:'Automatic Cartridge Lines'} ],
                 note:'percussion cap 1820s-40s, drawn brass 1866, smokeless shells 1880s-90s, high-speed automatic cartridge lines by WWII.' },
  synthetics:  { eras:[2], invent:[ {era:3, slug:'indigo', name:'Synthetic Indigo Plants', pm:'Synthetic Indigo'},
                                    {era:4, slug:'viscose', name:'Viscose Rayon Plants', pm:'Viscose Rayon'},
                                    {era:5, slug:'polyamide', name:'Polyamide Fibre Plants', pm:'Polyamide Synthesis'} ],
                 note:'VANILLA IS AN ERA LATE: Perkin’s mauveine is 1856, not 1874 — aniline belongs at era 2. Then alizarin 1869 / indigo 1897, viscose rayon 1905, nylon 1935/39.' },
  electrics:   { eras:[3], invent:[ {era:4, slug:'radio', name:'Radio Electrics Industries', pm:'Radio Manufacturing'},
                                    {era:5, slug:'electronics', name:'Electronics Industries', pm:'Vacuum Tube Electronics'} ],
                 note:'VANILLA IS LATE: Bell 1876, first exchange 1878 — era 3, not era 4. Then broadcast radio 1920, electronics/TV 1930s. Telephone TFP actually ACCELERATED after 1929.' },
  power:       { eras:[4,5], invent:[],
                 note:'STARTS AT ERA 4 BY DESIGN (§10.43): the 1900 generation of plant was the municipal engine-house — small, city-embedded, exactly what the urban centre\'s mandated electric-streetlights method now models (+1 electricity, −1 coal, engineers). The standalone ladder is the central turbine station: pulverized-coal turbine hall era 4 (largest unit 1.2 MW 1900 -> 30 MW 1910 -> 60+ MW 1920s), high-pressure/oil era 5 (efficiency ~4% 1900 -> 20%+ 1940). Placeable at era 3 as the LEADING rung (debut-exempt) — Elberfeld 1900 was the leading edge. Hydro is deliberately NOT a market industry: small-scale folds into the urban-centre narrative, large-scale (Niagara 1895, Hoover) is a site-specific megaproject like a canal, outside the scenario model.' },
  art_academy: { eras:[1,2,3,4], invent:[ {era:5, slug:'sound_film', name:'Sound Film Art Academies', pm:'Sound and Colour Film'} ],
                 note:'romanticism -> realism -> photography (1839) -> film 1895 -> sound 1927 / Technicolor 1935. "Output per worker" is barely meaningful here; the ladder is for consistency.' },
  // --- OFF the break-even ladder (follows_be:false) — vanilla economics, informational only ----------
  port:        { eras:[1,3,4], invent:[ {era:2, slug:'steam', name:'Steamship Ports', pm:'Steamship Bunkering',
                                         inputs:{ steamers:2, coal:2 }, state_infrastructure:4},
                                        {era:5, slug:'motor', name:'Motor Ship Ports', pm:'Mechanised Cargo Handling',
                                         state_infrastructure:6} ],
                 note:'ON the ladder since 0cdc041, so it now needs a tier in EVERY era like any other industry — eras 2 and 5 are invented. ⚠ The era-2 tier is the reason the invent spec can carry its own `inputs`: iron screw steamers arrive in era 2 (shipyard_metal), so an 1870 port bunkers STEAMERS, not the 1836 port\'s clippers, and seeding it from the tier below would have got that backwards. It also closes the last producer-before-consumer gap in the model — steamers were made in era 2 and first eaten in era 3 (BALANCE_FRAMEWORK §10.32.1).' },
  railway:     { eras:[2,3,4,5], invent:[],
                 note:'OFF-LADDER. Vanilla’s four tiers map one-to-one onto eras 2-5.' },
};

// How each industry's ladder ENDS, for industries that stop before era 5. This is not decoration — it is
// a hard input to the price solver, and the two cases behave oppositely:
//
//   'plateau'  the newest tier is the best that will EVER exist, but the industry is still needed. Its
//              good's price must therefore stop deflating and instead hold that tier at the CURRENT
//              profit target forever — which makes the good get relatively more expensive over time.
//              That is Baumol's cost disease, and it is why a plateau does not kill an industry.
//   'extinct'  the industry genuinely dies out and nothing replaces it in the same chain. No price
//              floor: its last tier is allowed to go unprofitable and stay there.
//
// An industry that reaches era 5 needs neither.
const LADDER_END = {
  food: 'plateau', textile: 'plateau', furniture: 'plateau',
  shipyard: 'extinct',           // superseded by shipyard_steam, which is a separate chain
  // port WAS 'plateau' — it now has an invented era-5 tier, so it reaches the end of the ladder like any
  // other industry and needs no price floor propping its last tier up.
};

// Skill-mix step for an INVENTED tier: hold headcount constant and move 10% of it from laborers to
// machinists and 5% from machinists to engineers, one step per era. At the standard 5000-worker factory
// that is exactly the -500 laborers / +250 machinists / +250 engineers that vanilla itself uses at every
// tier change (verified against textile T3->T4, glass T3->T4 and steel T3->T4).
function stepEmployment(emp) {
  if (!emp) return null;
  const e = { ...emp };
  const total = Object.values(e).reduce((a, b) => a + b, 0);
  if (!total) return e;
  const up = (from, to, n) => {
    const move = Math.min(n, e[from] || 0);
    if (move <= 0) return 0;
    e[from] -= move; e[to] = (e[to] || 0) + move;
    if (e[from] === 0) delete e[from];
    return move;
  };
  up('machinists', 'engineers', Math.round(total * 0.05));
  up('laborers', 'machinists', Math.round(total * 0.10));
  return e;
}
// ...and the same step DOWNWARD, for a tier minted BELOW its neighbour. A pre-industrial workshop is not
// a factory with fewer engineers, it is a shop of labourers — so the skill mix has to move the other way.
// Calling stepEmployment() for a lower tier would deskill it in the wrong direction, which is the sort of
// thing that never shows up as an error and quietly prices the bottom rung as if it employed engineers.
function stepEmploymentDown(emp) {
  if (!emp) return null;
  const e = { ...emp };
  const total = Object.values(e).reduce((a, b) => a + b, 0);
  if (!total) return e;
  const down = (from, to, n) => {
    const move = Math.min(n, e[from] || 0);
    if (move <= 0) return 0;
    e[from] -= move; e[to] = (e[to] || 0) + move;
    if (e[from] === 0) delete e[from];
    return move;
  };
  down('engineers', 'machinists', Math.round(total * 0.05));
  down('machinists', 'laborers', Math.round(total * 0.10));
  return e;
}

const cfg = JSON.parse(readFileSync(CFG, 'utf8'));
const rows = [];
let invented = 0, moved = 0;

for (const ind of cfg.industries) {
  const spec = SPEC[ind.id];
  if (!spec) { console.error(`!! no ladder spec for industry ${ind.id} — left untouched`); continue; }
  // IDEMPOTENT: drop any previously invented tiers so a re-run rebuilds them from the spec rather than
  // stacking a second copy on top. ⚠ This DISCARDS solved input volumes for model_only tiers, so the
  // pipeline order is build_era_ladder.mjs -> era_solver.mjs, never the reverse.
  ind.tiers = ind.tiers.filter(t => !t.model_only);
  if (spec.eras.length !== ind.tiers.length) {
    throw new Error(`${ind.id}: spec lists ${spec.eras.length} eras for ${ind.tiers.length} existing tiers`);
  }
  // 1. era-stamp the existing tiers
  ind.tiers.forEach((t, ix) => { t.era = spec.eras[ix]; t.model_only = false; });
  if (LADDER_END[ind.id]) ind.ladder_end = LADDER_END[ind.id]; else delete ind.ladder_end;

  // 2. mint the invented ones
  const base = ind.tiers[0];
  for (const inv of spec.invent) {
    const below = [...ind.tiers].filter(t => t.era < inv.era).sort((a, b) => b.era - a.era)[0] || base;
    const t = {
      key: `${base.key}_${inv.slug}`,
      name: inv.name,
      pm_key: `pm_main_${ind.id}_${inv.slug}`,
      pmg_key: `pmg_main_${ind.id}_${inv.slug}`,
      pm_name: inv.pm,
      // NO vanilla_pm and NO tech: this tier has no base-game anchor and no unlocking technology yet.
      // That is exactly what model_only means, and it is why the builder must skip it.
      era: inv.era,
      model_only: true,
      output_qty: 0,                       // filled by the ×1.5 ladder below
      inputs: { ...below.inputs },          // seed only — tools/era_solver.mjs owns the real numbers
      // ⚠ DIRECTION. `below` is the nearest tier UNDER the invented one — except for an era-0 tier, where
      // nothing is under it and `below` falls back to `base`, the tier ABOVE. Stepping employment and the
      // BE target the same way in both cases would deskill era 0 upward and price it as the cheaper plant,
      // which is exactly backwards.
      employment: (inv.era < base.era ? stepEmploymentDown : stepEmployment)(below.employment),
      pollution: below.pollution ?? 0,
      texture: below.texture,
      target_be: Math.max(5, (+below.target_be || 50) + (inv.era < base.era ? 25 : -25)),   // informational; the era solver replaces it
      natural_year: ERA_YEAR[inv.era],
      building_cost: null,                  // solved later
    };
    if (below.output_override != null) t.output_override = below.output_override;
    if (below.output_good) t.output_good = below.output_good;
    if (below.state_infrastructure != null) t.state_infrastructure = below.state_infrastructure;
    if (below.ship_construction != null) t.ship_construction = below.ship_construction;
    if (below.ai_value != null) t.ai_value = below.ai_value;
    // ⚠ AN INVENTED TIER MAY NEED A DIFFERENT RECIPE, NOT JUST A BIGGER ONE. Seeding from the tier below
    // is right when the invented tier is the same technology done better, and WRONG when the era it lands
    // in has changed what the industry consumes — the era-2 port is the case: steamers exist from era 2,
    // so a port minted there must eat steamers, not the era-1 port's clippers. `inputs` in the spec
    // replaces the seed outright; the ×1.5 ladder below still sets its SCALE.
    // (era_scenarios' `ratioFor` then falls through to the frozen ratio for such a tier by itself, because
    // no real tier below it has a vanilla recipe covering these goods — which is exactly what that
    // fallback is for.)
    if (inv.inputs) { t.inputs = { ...inv.inputs }; t._specInputs = true; }
    if (inv.state_infrastructure != null) t.state_infrastructure = inv.state_infrastructure;
    ind.tiers.push(t);
    invented++;
  }

  // 3. sort by era and apply the mechanical output ladder: O_k = O_0 × 1.5^k
  //
  // TWO EXEMPTIONS, both pre-existing design, not special cases invented here:
  //   * `follows_be:false` industries (port, railway) stay on VANILLA economics entirely — the volume,
  //     BE-target and building-cost solvers already skip them, and so must this one;
  //   * a tier carrying `output_override` keeps that number (power's per-tier vanilla electricity).
  ind.tiers.sort((a, b) => a.era - b.era);
  const onLadder = ind.follows_be !== false;
  // ⚠ THE LADDER IS ANCHORED ON `base`, NOT ON INDEX 0. `base` is the lowest-era tier that has a VANILLA
  // recipe behind it, and BALANCE_FRAMEWORK §8's rule is that IT keeps vanilla's output — everything else
  // is ×mult away from it. While every invented tier sat ABOVE the vanilla ones the two were the same
  // statement, because base WAS index 0. Once a tier is minted BELOW (era 0), reading O0 off index 0
  // silently promotes the new bottom rung to the vanilla anchor and multiplies the whole industry by
  // `mult` — a 55% across-the-board output rise disguised as a structural change.
  const baseIx = Math.max(0, ind.tiers.indexOf(base));
  const O0 = (+base.output_qty || +ind.tiers[0].output_qty) / Math.pow(OUTPUT_MULT, baseIx);
  ind.tiers.forEach((t, k) => {
    const want = (!onLadder) ? +t.output_qty
      : (t.output_override != null ? +t.output_override : Math.round(O0 * Math.pow(OUTPUT_MULT, k)));
    if (t.output_qty && t.output_qty !== want) moved++;
    t.output_qty = want;
    // the UI shows this; restate it onto the mod's OWN era anchors rather than vanilla's tech-era years
    t.natural_year = ERA_YEAR[t.era];
    // an invented tier's seeded inputs should at least keep the recipe's shape at the new scale
    // ⚠ …unless the spec gave it a recipe of its OWN (`inv.inputs`), which this would otherwise overwrite
    // with the tier below's goods — silently undoing the whole point of the override.
    if (t.model_only && !t._specInputs) {
      const belowIx = k - 1;
      if (belowIx >= 0) {
        const prev = ind.tiers[belowIx];
        const scale = want / Math.max(1, prev.output_qty);
        t.inputs = Object.fromEntries(Object.entries(prev.inputs).map(([g, q]) => [g, Math.max(1, Math.round(q * scale))]));
      }
    }
    delete t._specInputs;      // transient: must not reach the config
    rows.push({
      ind: ind.id, era: t.era, k: k + 1, key: t.key, name: t.name,
      out: t.output_qty, good: t.output_good || ind.output_good,
      emp: t.employment ? Object.values(t.employment).reduce((a, b) => a + b, 0) : 0,
      model: t.model_only, be: ind.follows_be !== false,
    });
  });
}

// ---------------------------------------------------------------------------------------------------
const W = (s, n) => String(s).padEnd(n);
console.log('\nERA LADDER  (M = model_only, not emitted;  * = off the break-even ladder)\n');
console.log(W('industry', 15) + W('e', 3) + W('building', 46) + W('out', 6) + W('good', 15) + W('jobs', 7) + 'flags');
console.log('-'.repeat(100));
let last = null;
for (const r of rows) {
  if (last && last !== r.ind) console.log('');
  last = r.ind;
  console.log(W(r.ind, 15) + W(r.era, 3) + W(r.name, 46) + W(r.out, 6) + W(r.good, 15) + W(r.emp || '-', 7)
    + (r.model ? 'M' : ' ') + (r.be ? ' ' : '*'));
}
const byEra = [0, 1, 2, 3, 4, 5].map(e => rows.filter(r => r.era === e).length);
console.log(`\n${rows.length} tiers over ${Object.keys(SPEC).length} industries — ${invented} invented (model_only), `
  + `${rows.length - invented} real. Per era: ${byEra.join(' / ')}. ${moved} output volume(s) restated by the ×1.5 ladder.`);
console.log(`\nLADDER ENDS BEFORE ERA 5:`);
for (const [id, kind] of Object.entries(LADDER_END)) {
  const lastEra = Math.max(...rows.filter(r => r.ind === id).map(r => r.era));
  console.log(`  ${W(id, 15)} last era ${lastEra}  ${kind}`
    + (kind === 'plateau' ? '  — price floor: its last tier holds the CURRENT target forever'
                          : '  — no floor: the industry is allowed to die'));
}

if (WRITE) {
  writeFileSync(CFG, JSON.stringify(cfg), 'utf8');   // minified, as the repo stores it
  console.log(`\nWROTE ${CFG}`);
} else {
  console.log('\n(report only — pass --write to rewrite config/mod_config.json)');
}
