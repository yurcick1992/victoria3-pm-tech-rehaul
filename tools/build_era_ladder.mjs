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

// ⚠ MOD_CONFIG redirects the WHOLE era pipeline at an alternate config, exactly as econ_host.mjs already
// does for the model it loads. Without it the two disagree — the model would speak for one file while the
// ladder rewrote another — and there would be no way to develop a ladder while a measurement batch is
// still building from the canonical config.
const CFG = join(REPO, process.env.MOD_CONFIG || join('config', 'mod_config.json'));
const WRITE = process.argv.includes('--write');

// The mod's own era anchors. Contracting on purpose: 100 years, then 50, then 25, then 15.
// ⭐ ERA 0 — the pre-industrial rung, added so the 1836 SCENARIO is not a single-tier economy.
// Vanilla's own 1836 start runs 46% of the USA's tiered levels at era 1, 45% at era 2 and 9% at era 3;
// our era-1 scenario ran 100% era 1, i.e. a 1750 economy wearing an 1836 label, and that was the base
// every macro growth ratio was measured from.
// ⚠ Era 0 is ~1700 and exists ONLY for industries that existed before ~1780. Fertilizer, explosives,
// motor, munition and synthetics begin at era 2; automotive and electrics at era 3. Minting a 1700 tier
// for those would invent a technology, which is the same test every `note` in the SPEC below applies.
// ⭐⭐ THE ANCHORS ARE AUTHORITATIVE (user ruling 2026-08-12, CLAUDE.md's anchor principle). At an era's
// anchor year a technology LEADER holds about half of that era's technologies — so the anchor is the
// MEDIAN of the era's dates, not the midpoint of its band. Era 0 sits well before the 1836 start and
// era 5 slightly after the 1936 end, both deliberately.
export const ERA_YEAR = { 0: 1750, 1: 1830, 2: 1870, 3: 1900, 4: 1925, 5: 1940 };
// The band each tier's tech_year falls in, derived as the midpoints between consecutive anchors. Every
// tier below MUST land in the band its authored era names — `checkBands()` throws otherwise, so a
// re-dating that quietly moves a rung into the wrong era cannot ship.
export const ERA_BAND = [1790, 1850, 1885, 1912, 1932];
export const bandOf = y => { let e = 0; for (let i = 0; i < ERA_BAND.length; i++) if (y >= ERA_BAND[i]) e = i + 1; return e; };

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
  // `years` (one per entry of `eras`) and `year:` on each invent = the tier's TECH_YEAR (§10.44): the
  // year the SLOT'S technology was first commercially deployable — a building of this kind could exist.
  // ⚠ Date the SLOT, not the vanilla PM's decorative name (vanilla gates rubber-grip tooling on
  // vulcanization, 1844; the slot it occupies is the high-speed-steel machine shop, 1901). The date gate
  // in era_scenarios places a tier iff tech_year <= the scenario year.
  //
  // ⭐⭐ RE-BANDED ONTO THE RULED ANCHORS (2026-08-12). Three things changed together:
  //   1. THE ANCHORS MOVED to 1750/1830/1870/1900/1925/1940, so most rungs move DOWN one era number —
  //      what used to be era 5 is mostly era 4 now, which is what frees era 5 for genuinely 1930s work.
  //   2. THE 1700 RUNGS ARE GONE. Seven industries carried an invented ~1700 tier AND a real ~1750
  //      vanilla-anchored one; under the new anchors both fall in era 0 and an industry may not hold two
  //      rungs in one era. The invented one is dropped in every case — it is ours, not vanilla's, and the
  //      user had already ruled the steel instance that way. ⭐ This also restores the vanilla building
  //      key to slot 0 in nine industries, which is the root cause of landmine L13.
  //   3. FIFTEEN RUNGS ARE ADDED, filling every interior gap the re-band opened and giving era 5 real
  //      content. Each names a specific historical step, not a placeholder: a rung that could not be
  //      justified was left out and the industry marked `plateau` instead (LADDER_END below).
  // ⚠ Where a date moved, the note says so and why. The anchors are authoritative; the dates are
  // calibrated to them, never the reverse.

  // --- consumer manufacturing -----------------------------------------------------------------------
  food:        { eras:[0,1,2], years:[1750,1815,1860], invent:[ {era:3, year:1909, slug:'hydrogenated', name:'Hydrogenated Fat Food Industries', pm:'Fat Hydrogenation'}, {era:4, year:1920, slug:'mechanised', name:'Mechanised Bakery Food Industries', pm:'Mechanised Bread Plant'} ],
                 note:'e3 is NEW: catalytic hydrogenation of oils (Normann 1902, Procter & Gamble Crisco 1911) turned cheap oils into solid cooking fat and is the one clean 1885-1911 step in food manufacture. Still plateaus at e4 — continuous-mix dough is 1953. Years: naval victualling biscuit manufactories ~1750, beet-sugar plants 1815, commercial baking powder 1860, hydrogenated fat 1909, mechanised bread 1920.' },
  textile:     { eras:[0,1,2,3], years:[1780,1830,1855,1905], invent:[ {era:4, year:1925, slug:'highdraft', name:'High-Draft Spinning Textile Mills', pm:'Long-Draft Roving and Spinning'} ],
                 note:'the invented 1700 cottage tier is dropped and the vanilla handsewn manufactory moves to e0 at 1780 — putting-out clothing manufactories predate 1800 comfortably, and this is what puts the VANILLA KEY back in slot 0. e4 is NEW: long-draft roving and spinning (1920s) cut the number of passages and doublings and is the last pre-war spinning step. Plateau at e4 stands — shuttleless looms and open-end spinning are 1950s-60s.' },
  furniture:   { eras:[0,1,2], years:[1780,1830,1855], invent:[ {era:3, year:1900, slug:'plywood', name:'Plywood Furniture Manufactories', pm:'Rotary-Cut Veneer and Plywood'}, {era:4, year:1923, slug:'sprayed', name:'Spray-Finished Furniture Manufactories', pm:'Spray Lacquer Finishing'} ],
                 note:'same 1700-drop and 1780 re-date as textile, for the same two reasons. e3 is NEW: rotary-lathe veneer cutting plus waterproof glue made plywood carcass furniture an industrial product around 1900 — the missing 1885-1911 step. Plateau at e4: the trade stayed hand-assembled into the 1990s.' },
  glass:       { eras:[0,1,2,3], years:[1750,1832,1867,1910], invent:[ {era:4, year:1926, slug:'ribbon', name:'Ribbon Machine Glassworks', pm:'Continuous Ribbon Machine'}, {era:5, year:1938, slug:'fibre', name:'Glass Fibre Works', pm:'Continuous Glass Fibre'} ],
                 note:'e5 is NEW: Owens-Corning 1938, continuous glass-fibre drawing — a genuinely 1930s product and a new market rather than a faster bottle machine. Years: coal-fired cone glasshouses 1750, cylinder sheet (Chance) 1832, Siemens regenerative tank 1867, housewares plastics 1910, Corning ribbon machine 1926, glass fibre 1938.' },
  tooling:     { eras:[0,1,2,3], years:[1770,1830,1865,1901], invent:[ {era:4, year:1927, slug:'carbide', name:'Cemented Carbide Tooling Workshops', pm:'Cemented Carbide Tools'}, {era:5, year:1936, slug:'tracer', name:'Tracer-Controlled Tooling Workshops', pm:'Hydraulic Tracer Control'} ],
                 note:'e5 is NEW and answers the user’s point that tooling is "basically any machine", so its e3/e4/e5 must really differ: hydraulic tracer-controlled mills and lathes (Keller, Cincinnati, 1930s) cut complex profiles from a master without a skilled machinist — the step between carbide cutting speed and 1950s numerical control. Years: Soho toolshops 1770, pig-iron tooling 1830, Bessemer-steel tools 1865, HSS 1901, cemented carbide 1927, tracer control 1936.' },
  paper:       { eras:[0,1,2], years:[1750,1830,1874], invent:[ {era:3, year:1890, slug:'kraft', name:'Kraft Process Paper Mills', pm:'Kraft Sulfate Pulping'},
                                        {era:4, year:1925, slug:'nssc', name:'Semi-Chemical Paper Mills', pm:'Neutral Sulfite Semi-Chemical Pulping'},
                                        {era:5, year:1935, slug:'highspeed', name:'High-Speed Machine Paper Mills', pm:'High-Speed Fourdrinier'} ],
                 note:'e4 is NEW: neutral sulfite semi-chemical pulping (commercial 1925) opened hardwoods and corrugating medium to chemical pulping. High-speed machines move 1930 -> 1935 so they sit in era 5 rather than crowding e4; machine speed 270 ft/min (1889) -> 600 (1910) -> 1500+ by 1940 makes either date defensible and the anchors decide.' },

  // --- chemicals ------------------------------------------------------------------------------------
  fertilizer:  { eras:[1,3,4], years:[1842,1885,1913], invent:[ {era:2, year:1865, slug:'ammoniacal', name:'Ammoniacal Liquor Fertilizer Plants', pm:'By-Product Ammonium Sulphate'}, {era:5, year:1935, slug:'reforming', name:'Steam Reforming Chemical Plants', pm:'Methane Steam Reforming'} ],
                 note:'e2 is NEW: ammonium sulphate recovered from gasworks and coke-oven liquor was the era’s real nitrogen fertilizer, 1860s-70s, and fills the gap between superphosphate and Thomas slag. Steam reforming moves 1931 -> 1935 (ICI Billingham scale-up) so it lands in era 5. ⚠ Superphosphate 1842 POSTDATES the 1836 scenario — vanilla-1836 fertilizer capacity was always an anachronism.' },
  explosives:  { eras:[1,2,3,4], years:[1820,1867,1908,1928], invent:[ {era:5, year:1940, slug:'cyclonite', name:'Cyclonite Explosives Factories', pm:'RDX Continuous Nitration'} ],
                 note:'e5 is NEW: RDX/cyclonite at scale (Woolwich process, then Bachmann 1940) — roughly 1.5x TNT’s power and the defining explosive of the war that ends the game window.' },
  synthetics:  { eras:[2], years:[1857], invent:[ {era:3, year:1897, slug:'indigo', name:'Synthetic Indigo Plants', pm:'Synthetic Indigo'},
                                    {era:4, year:1912, slug:'viscose', name:'Viscose Rayon Plants', pm:'Viscose Rayon'},
                                    {era:5, year:1939, slug:'polyamide', name:'Polyamide Fibre Plants', pm:'Polyamide Synthesis'} ],
                 note:'no new rungs — viscose moves 1905 -> 1912, which both resolves the era-3 collision with indigo and is the more honest date: Courtaulds licensed it in 1904 but rayon reached real tonnage in the 1910s. Aniline works 1857 (Perkin 1856, so vanilla dating it era 4 was an era late).' },

  // --- metals and machinery -------------------------------------------------------------------------
  steel:       { eras:[0,2,3,4], years:[1745,1856,1885,1912], invent:[ {era:5, year:1932, slug:'strip_mill', name:'Continuous Strip Mill Steelworks', pm:'Continuous Wide Strip Mill'} ],
                 note:'⚠ THE ERA-1 GAP IS DELIBERATE, not an oversight: era-1 steel has no buyer of any kind (BALANCE_FRAMEWORK §10.32), which is why ERA_PRUNE excludes the blister mill from the era-0 AND era-1 scenarios and why dropping it outright is on the long-term todo. The invented bloomery tier is gone; blister steel keeps the VANILLA key in slot 0, which is what the 1836 map’s six steel mills convert onto. Three re-dates, all defensible and all forced by one rung per era: open hearth 1868 -> 1885 (Siemens-Martin existed from 1865 but the BASIC process, Thomas 1879, is what made it dominant), electric arc 1903 -> 1912 (Heroult 1900, first plants 1903-06, real tonnage in the 1910s), continuous wide strip 1926 -> 1932 (ARMCO Butler 1926, but the strip-mill building wave is the 1930s).' },
  motor:       { eras:[1,3,4], years:[1820,1893,1912], invent:[ {era:2, year:1860, slug:'compound', name:'Compound Engine Motor Industries', pm:'Compound Steam Engines'}, {era:5, year:1935, slug:'welded_diesel', name:'Welded High-Speed Motor Industries', pm:'Welded High-Speed Diesel'} ],
                 note:'e2 is NEW: compound expansion (Corliss 1849, compound marine engines from 1854, widespread 1860s) roughly halved coal per horsepower-hour and is the missing step between the atmospheric-era engine works and the electric motor. Diesel moves 1904 -> 1912, which resolves the collision with electric engines and matches when MAN marine diesels reached industrial scale.' },

  // --- shipbuilding ---------------------------------------------------------------------------------
  shipyard:    { eras:[0,1], years:[1700,1845], invent:[],
                 note:'DEAD END, not a plateau: steam tonnage passes sail in 1890 and the last commercial sailing hulls are ~1899-1904. Two tiers is already generous. Years: 1700, screw-era yards 1845.' },
  shipyard_steam:{ eras:[1,5], years:[1843,1941], invent:[ {era:2, year:1875, slug:'steel_hull', name:'Steel Hull Steamship Yards', pm:'Steel Hull Construction'},
                                        {era:3, year:1903, slug:'turbine', name:'Turbine Steamship Yards', pm:'Marine Steam Turbines'},
                                        {era:4, year:1913, slug:'oil_fired', name:'Oil-Fired Steamship Yards', pm:'Oil-Fired Turbine Steamers'} ],
                 note:'e2 is NEW: mild-steel hulls (Siemens-Martin plate from the late 1870s, SS Rotomahana 1879) cut hull weight ~15% over iron and are the missing 1850-1884 step. Years: SS Great Britain 1843, steel hulls 1875, merchant turbines 1903, oil-fired boilers 1913, welded prefabrication 1941.' },
  automotive:  { eras:[3,4], years:[1899,1913], invent:[ {era:5, year:1936, slug:'transfer_line', name:'Transfer Line Automotive Industries', pm:'Transfer Machining'} ],
                 note:'unchanged — the one industry whose dates already sat one per era under the new anchors. Series production 1899 (De Dion-Bouton), moving assembly line 1913, transfer machining 1936.' },

  // --- war industries -------------------------------------------------------------------------------
  arms:        { eras:[0,1,2,3], years:[1770,1849,1866,1886], invent:[ {era:4, year:1915, slug:'automatic', name:'Automatic Arms Industries', pm:'Light Machine Gun Production'}, {era:5, year:1938, slug:'stamped', name:'Stamped Receiver Arms Industries', pm:'Stamped and Welded Receivers'} ],
                 note:'the invented gunsmith tier is dropped so the vanilla musket works holds slot 0. Rifles move 1853 -> 1849 (Minie ball 1849 rather than the Enfield 1853 pattern), which is what lets repeaters keep 1866 without colliding. e4 is NEW: light machine guns at scale from 1915 (Lewis, Chauchat) — the 1912-1931 step the ladder had nothing for.' },
  artillery:   { eras:[0,1,2,3], years:[1750,1830,1861,1897], invent:[ {era:4, year:1925, slug:'autofrettage', name:'Autofrettaged Artillery Foundries', pm:'Autofrettage and Welded Carriages'}, {era:5, year:1936, slug:'antiaircraft', name:'Automatic Anti-Aircraft Foundries', pm:'Automatic Anti-Aircraft Guns'} ],
                 note:'the invented bronze-cannon tier is dropped; the vanilla cannon foundry holds slot 0 at 1750. e5 is NEW: automatic anti-aircraft artillery (Bofors 40 mm 1934, welded mountings, mechanical directors) — a real 1930s product line and the answer to aircraft, which the game window ends on.' },
  munition:    { eras:[1,2], years:[1830,1875], invent:[ {era:3, year:1895, slug:'drawn_brass', name:'Drawn Brass Munition Plants', pm:'Drawn Brass Cartridges'},
                                      {era:4, year:1915, slug:'filling', name:'Shell Filling Munition Plants', pm:'Mass Shell Filling'},
                                      {era:5, year:1940, slug:'automatic', name:'Automatic Line Munition Plants', pm:'Automatic Cartridge Lines'} ],
                 note:'e4 is NEW: the WWI national shell-filling factory (Gretna, Chilwell, 1915-16) is a distinct industrial form from a cartridge-case plant and fills the 1912-1931 gap. Years: caps at scale 1830, filled explosive shells 1875, smokeless-era drawn brass 1895, shell filling 1915, automatic lines 1940.' },

  // --- new economy ----------------------------------------------------------------------------------
  electrics:   { eras:[2], years:[1878], invent:[ {era:3, year:1901, slug:'wireless', name:'Wireless Telegraph Electrics Industries', pm:'Wireless Telegraphy'},
                                    {era:4, year:1920, slug:'radio', name:'Radio Electrics Industries', pm:'Radio Manufacturing'},
                                    {era:5, year:1935, slug:'electronics', name:'Electronics Industries', pm:'Vacuum Tube Electronics'} ],
                 note:'telephone exchanges (1878) move DOWN to era 2 under the new anchors — vanilla had this industry two eras late. e3 is NEW: wireless telegraphy as a manufacturing industry (Marconi transatlantic 1901, ship installations from 1900) fills the gap between the exchange and broadcast radio.' },
  power:       { eras:[3,5], years:[1900,1932], invent:[ {era:4, year:1920, slug:'pulverized', name:'Pulverized-Coal Power Plant', pm:'Pulverized Coal Firing'} ],
                 note:'⚠ pulverized-coal MOVED from the eras[] list into invent[] — it has no vanilla PM, and `vanilla_pm` is now what marks a tier as ours (see the filter above). Its key is unchanged. Oil-fired moves 1925 -> 1932 so it holds era 5; large oil-fired central stations are a 1930s form. e3 Coal-Fired = the first turbine station (Parsons 1884, Elberfeld 1900). Hydro is deliberately NOT a market industry.' },

  // --- infrastructure -------------------------------------------------------------------------------
  port:        { eras:[0,2,3], years:[1700,1875,1908], invent:[ {era:1, year:1840, slug:'steam', name:'Steamship Ports', pm:'Steamship Bunkering',
                                         inputs:{ steamers:2, coal:2 }, state_infrastructure:4},
                                        {era:4, year:1930, slug:'motor', name:'Motor Ship Ports', pm:'Mechanised Cargo Handling',
                                         state_infrastructure:6} ],
                 note:'now PLATEAUS at e4 rather than reaching e5: the next real step in cargo handling is containerisation (1956), far outside the window, and inventing a 1930s rung to avoid an empty column is exactly the filler the design forbids. ⚠ The era-1 tier is why an invent entry may carry its own `inputs`: iron screw steamers arrive in era 1-2, so an 1870 port bunkers STEAMERS, not the era-0 port’s clippers.' },
  railway:     { eras:[1,2,3,4], years:[1825,1867,1895,1925], invent:[],
                 note:'RAILWAY PLATEAUS AT e4 (user ruling 2026-08-12). The invented superheating rung is gone and the vanilla DIESEL rung moves e5 -> e4, gated on the motor industry\'s own diesel_engine: one technology for the diesel locomotive and the diesel engine works, which is what they historically were. Dated 1925 rather than 1934 — mainline diesel-electric service (Kaufman Act 1923, the first road switchers) rather than the Zephyr, and e4 s band is 1912-1932 anyway. ⚠ compression_ignition is NOT deleted: it is a VANILLA technology gating ten vanilla production methods (diesel pumps in five mine types, diesel tractors, diesel trains, mass automobile production) and a vanilla event. It simply no longer gates a building of ours. Years: Stockton & Darlington 1825, steel rails 1867, electrification 1895, road diesel 1925.' },

  // --- arts -----------------------------------------------------------------------------------------
  art_academy: { eras:[1,2,3,4], years:[1800,1850,1885,1912], invent:[ {era:5, year:1932, slug:'sound_film', name:'Sound Film Art Academies', pm:'Sound and Colour Film'} ],
                 note:'no new rungs; three re-dates put one per era and each is the INDUSTRIAL onset rather than the invention. Photography 1839 -> 1885 (dry plates 1878, Kodak roll film 1888 made it a trade); film 1896 -> 1912 (the feature-film studio industry, 1912-15); sound film 1927 -> 1932 (The Jazz Singer 1927, but conversion of the exhibition industry completes about 1932). This also removes the old non-monotone photography-before-realism inversion.' },
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
  // ⚠ port is a plateau AGAIN as of the 2026-08-12 re-band. It briefly reached era 5, but under the ruled
  // anchors its mechanised-cargo tier is a 1930 building and therefore era 4; the next real step in cargo
  // handling is containerisation (1956), far outside the window. Inventing a 1930s rung purely to fill the
  // era-5 column is the filler the design forbids, so the last tier gets a price floor instead.
  port: 'plateau',
  railway: 'plateau',            // user ruling 2026-08-12: no era-5 railway; the diesel rung is the last
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
  // stacking a second copy on top. ⚠ This DISCARDS solved input volumes for invented tiers, so the
  // pipeline order is build_era_ladder.mjs -> era_solver.mjs, never the reverse.
  // ⚠⚠ THE MARKER IS `vanilla_pm`, NOT `model_only`. It used to be model_only, and that silently BROKE:
  // the tech-tree step assigns a technology to every tier and clears the flag by design, after which this
  // filter matched nothing, the arity check below threw on the first industry, and the ladder builder —
  // the FIRST stage of the pipeline — could not run at all. `vanilla_pm` is the durable statement of the
  // same thing (a tier with no base-game production method is one we invented) and no step clears it.
  // Every tier the SPEC's `eras[]` names therefore MUST carry a vanilla_pm; a genuinely all-new permanent
  // tier belongs in `invent[]`, which is where power's pulverized-coal tier now lives.
  ind.tiers = ind.tiers.filter(t => t.vanilla_pm);
  if (spec.eras.length !== ind.tiers.length) {
    throw new Error(`${ind.id}: spec lists ${spec.eras.length} eras for ${ind.tiers.length} existing tiers`);
  }
  // TECH_YEAR is mandatory (§10.44): the date gate in era_scenarios places a tier iff its year <= the
  // scenario year, and a tier without one would silently fall back to nothing. Fail here, at authoring
  // time, not there.
  if (!spec.years || spec.years.length !== spec.eras.length) {
    throw new Error(`${ind.id}: spec needs a years[] entry per eras[] entry (got ${spec.years ? spec.years.length : 0} for ${spec.eras.length})`);
  }
  // 1. era-stamp and date-stamp the existing tiers
  ind.tiers.forEach((t, ix) => { t.era = spec.eras[ix]; t.tech_year = spec.years[ix]; t.model_only = false; });
  if (LADDER_END[ind.id]) ind.ladder_end = LADDER_END[ind.id]; else delete ind.ladder_end;

  // 2. mint the invented ones
  const base = ind.tiers[0];
  for (const inv of spec.invent) {
    if (inv.year == null) throw new Error(`${ind.id}: invented tier '${inv.slug}' has no year`);
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
      tech_year: inv.year,
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
      ind: ind.id, era: t.era, k: k + 1, key: t.key, name: t.name, year: t.tech_year,
      out: t.output_qty, good: t.output_good || ind.output_good,
      emp: t.employment ? Object.values(t.employment).reduce((a, b) => a + b, 0) : 0,
      model: t.model_only, be: ind.follows_be !== false,
    });
  });
  // ARRIVAL MONOTONICITY (per industry): a tier's first scenario, by date, must not precede a lower
  // tier's. Raw years MAY be non-monotone (photography 1839 < realism 1850) as long as no scenario year
  // falls between them — the gate only sees arrivals. A violation means a HIGHER rung would stand in a
  // scenario its predecessor cannot reach, which inverts the ladder's meaning; that is an authoring
  // error, not a solver condition, so it throws here.
  const SCEN_YEARS = [1780, 1836, 1870, 1900, 1920, 1945];
  const arrival = y => { const ix = SCEN_YEARS.findIndex(sy => y <= sy); return ix < 0 ? SCEN_YEARS.length : ix; };
  for (let k = 1; k < ind.tiers.length; k++) {
    if (arrival(ind.tiers[k].tech_year) < arrival(ind.tiers[k - 1].tech_year)) {
      throw new Error(`${ind.id}: tier ${ind.tiers[k].key} (year ${ind.tiers[k].tech_year}) arrives at an earlier scenario than ${ind.tiers[k - 1].key} (year ${ind.tiers[k - 1].tech_year})`);
    }
  }
  // ⭐ THE ANCHORS ARE AUTHORITATIVE, SO THE BANDS ARE CHECKED. A tier's authored era and its tech_year
  // are two statements about the same thing, and nothing else in the pipeline compares them — a re-dating
  // that quietly moves a rung out of its era's band would just change which scenario it appears in, with
  // no error anywhere. It throws here, at authoring time.
  // ⚠ ONE tier per era per industry is checked in the same pass: it is the ladder's own invariant and the
  // re-band is exactly the operation that breaks it.
  const seen = new Map();
  for (const t of ind.tiers) {
    const want = bandOf(t.tech_year);
    if (want !== t.era) {
      throw new Error(`${ind.id}: tier ${t.key} is authored era ${t.era} but its tech_year ${t.tech_year} falls in era ${want} (bands ${ERA_BAND.join('/')})`);
    }
    if (seen.has(t.era)) {
      throw new Error(`${ind.id}: two tiers in era ${t.era} — ${seen.get(t.era)} and ${t.key}`);
    }
    seen.set(t.era, t.key);
  }
}

// ---------------------------------------------------------------------------------------------------
const W = (s, n) => String(s).padEnd(n);
console.log('\nERA LADDER  (M = model_only, not emitted;  * = off the break-even ladder)\n');
console.log(W('industry', 15) + W('e', 3) + W('year', 6) + W('building', 46) + W('out', 6) + W('good', 15) + W('jobs', 7) + 'flags');
console.log('-'.repeat(106));
let last = null;
for (const r of rows) {
  if (last && last !== r.ind) console.log('');
  last = r.ind;
  console.log(W(r.ind, 15) + W(r.era, 3) + W(r.year, 6) + W(r.name, 46) + W(r.out, 6) + W(r.good, 15) + W(r.emp || '-', 7)
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
