# No Free Upgrades: An industrial realism overhaul — changelog

## 1.1.0 (for Victoria 3 1.15)

*Unlike all my other public communication, this changelog is AI-generated. Claude wrote it from the mod's repository and design record.*

Mod 1.1 brings mod 1.0 to Victoria 3 1.15 "Ivan-Chai". It requires game 1.15 and does not run on 1.13. The design, recipes, costs, research marks and AI values of 1.0 are unchanged, except where 1.15 added something the mod has to take in, mostly copper. Small adjustments that only follow vanilla 1.15's own renames and moves are not listed. Known issues are in `KNOWN_ISSUES.md`. The full changelog against vanilla 1.15 is on the [Paradox forum](https://forum.paradoxplaza.com/forum/threads/mod-no-free-upgrades-an-industrial-realism-overhaul.1947073/).


Testing and balance

* Mod 1.1 was neither measured nor tuned as thoroughly as mod 1.0. Mod 1.0 played 64 automated 1836–1936 campaigns with full telemetry (48 of 1.0 itself and 16 of its 0.99 pre-release; observer runs with no player) against 56 of vanilla. This was done after balance finalisation to ensure that the targets are met.
* Mod 1.1 carries that balance over to game 1.15 without retuning it. On 1.15 it was tested with one automated campaign beside one of vanilla 1.15.0 and several hours of manual play.
* The proper way would be to measure the mod on 1.15, rebalance it, and measure again to make sure the targets are met. That is planned for mod 1.2 and should take about a month; vanilla 1.15 will likely get a couple of hotfixes in the meantime.

Game 1.15

* Built on vanilla 1.15.0. The vanilla files the mod replaces are now 1.15's own copies with the mod's edits, so 1.15's map, AI strategies, companies, events and journal entries come through.
* The 1836 start is converted from vanilla 1.15's, and its crafts are topped up to vanilla 1.15's output.

Copper

* Five rungs now use copper, where vanilla 1.15's methods use it, at the same input value: Electric Sewing Machines (2.4 a level), Tier 2 Motor Industries (8.2), Tier 1 and Tier 2 Munition Plants (6 and 11.1), Tier 2 Electrics Industries (59).
* Secondary and automation methods use vanilla 1.15's copper, sized like the rest of their recipe.
* **Bronze artillery:** the Tier 0 and Tier 1 Artillery Foundry can switch to Bronze Cannons and Bronze Smoothbores without construction, at the input value of the iron method (12.8 copper and 19.2 hardwood a level at Tier 0, 24 and 24 at Tier 1).
* Dams: 6 tools, 3 engines and 4.5 copper per 300 electricity (1.0: 6 tools and 6 engines), at the same value at base prices.
* Trade: one unit of trade capacity moves 12 copper (£480 at base prices; vanilla 5).
* Electric Streetlights are as in 1.0, with no copper. Power Plants keep vanilla's recipes, now including copper, at 1,600 points.

Research

* 1.15's two new flat research bonuses are cut to a third: Russisch-Baltische Waggon-Fabrik (innovation cap +15 → +5) and The Social Revolution (+25 → +8.33).

AI

* In vanilla 1.15, some journal entries increase the AI's desire to build certain industries (The Five-Year Plan and others). These increases now apply to every rung of those industries except the crafts.
* The AI chooses its manufacturing-decree states without counting crafts.

Content

* Crafts are excluded from 1.15's new level counts: The Five-Year Plan's light-industry goal, the Tsar's Favorite's industry mission and the AI's decree states.
* 1.15's new companies, events, journal entries and modifiers that name a tiered industry cover all its rungs, as in 1.0.
* The Automated Bakery requires electricity, like every other method that consumes it.

Fixes

* Crafts can no longer satisfy an interest group's demand to expand Light Industries.
* The Socialism research entries were titled "socialism" in lowercase.
* Company bonuses now name a merged building by its tier span ("Tier 2-3. Textile Mills") instead of its first method.

Interface

* Research entries are in their own journal group, Tech Advancements and Inventions.
* The canals (Suez, Panama) and the dam surveys share another, Great Works.

Modding

* The mod replaces 163 vanilla files whole (146 in 1.0) and the folder common/history/buildings.
* Level counts that exclude crafts use the engine's own counters, not script loops.

Not yet in 1.1

* Buildings that run only on electricity can still be built without it (see the known issues).
* The balance has not been retuned for 1.15 (see Testing and balance above).


## 1.0.0 (for Victoria 3 1.13)

Every change below is against vanilla Victoria 3 1.13. Known issues are in `KNOWN_ISSUES.md`.


Features

* Production: a building for every technology step
   * Seventeen manufacturing industries no longer modernise by switching their main production method: Food Industries, Textile Mills, Furniture Manufacturies, Glassworks, Tooling Workshops, Paper Mills, Fertilizer Plants, Explosives Factory, Steel Mills, Motor Industries, Automotive Industries, Arms Industries, Artillery Foundry, Munition Plants, Synthetics Plants, Electrics Industries and Arts Academy.
   * Each of vanilla's main production methods in these industries is now its own building, a rung, with vanilla's name, staffing and icon: 56 rungs in 50 buildings. Up to four rungs per industry, on tiers anchored at 1836, 1875, 1905 and 1940; late industries start late.
   * Modernising now means constructing the newer plant. An older plant is never forbidden or penalised: it loses its market when the newer rungs' output pushes its price down relative to wages.
   * A rung one tier up makes 2.2 times the output for 1.64 times the input value and costs 1.9 times as much to build, so it earns more per worker and slightly more per construction point. Also, more modern tiers are able to stay profitable under lower output prices.
   * A tier-1 rung makes its vanilla method's output from inputs worth 20% more (Motor Industries: the same inputs) and costs the vanilla building's 600 or 800 points (Arts Academy 400). A tier-0 rung makes two thirds of that from two thirds of the inputs.
   * A technology that unlocked a main method now unlocks that method's rung. The Artillery Foundry is now unlocked by Artillery instead of Gunsmithing.
   * Every company with an industry can build all of its rungs except the craft, and its throughput bonuses reach them.
* Artisan crafts
   * The first rung of Food Industries, Textile Mills, Furniture Manufacturies, Glassworks, Tooling Workshops and Paper Mills is an artisan craft: Bakeries, Handsewn Clothes, Handcrafted Furniture, Forest Glass, Crude Tools and Pulp Pressing.
   * A craft level employs 500 workers (30% shopkeepers, 70% laborers), costs 6 construction points, makes 60% of its vanilla method's output per worker, has no economy of scale, and hires down to a productivity of 2.
   * Crafts have their own building group, Crafts, under Light Industry. Companies do not build crafts or form from them, and crafts carry no secondary production methods.
* Merged methods
   * Six steps that are a recipe change rather than a new kind of plant are a second main method of the building below them, switched without construction: vanilla's Baking Powder, Electric Sewing Machines, Paper Bleaching, Improved Fertilizers and Electric Arc Process, and the new Spray Finishing. Historically each of these was a retrofit of an existing plant costing roughly 5–20% of a new plant; a step that cost more than about 30% stays a separate building.
   * A building with two main methods is named by its tier span ("Tier 1-2. Paper Mills") and costs the geometric midpoint of the two rungs' costs.
* New technologies
   * Added Spray Finishing (furniture), Continuous Web Processing (paper) and Catalytic Synthesis (fertilizer), tech era 5, each unlocking the top rung of its industry, with new technology and production method icons.
* Secondary and automation methods
   * Each industry has its own copy of vanilla's secondary and automation methods, one recipe for all its rungs, sized on its tier-2 rung.
   * A building offers only the methods it can run beside its main method: none that would take a good or a job below zero, none judged incompatible (14 pairs).
   * An automation that is the same thing as a main method comes with it as the only choice: Mechanized Looms with Sewing Machines, Automatic Power Looms with Electric Sewing Machines, Assembly Lines with Mass Production.
* Electricity
   * Electric Streetlights in urban centres now burn 2 coal and produce 1 electricity, staffed by 250 engineers, instead of consuming 3 electricity.
   * Power Plants now cost 1,600 construction points (vanilla 400).
* Hydroelectric dams
   * Added 122 historical hydroelectric projects as four new buildings: Mountain Power Station and River Dam (300 electricity a level), Great Mountain Scheme and Great River Dam (600). Levels cost 4,800 to 9,000 points and need Electrical Generation, Steam Turbine or Arc Welding.
   * A dam is built only on its site, up to the site's levels, which are resource slots in its state region.
   * A site must be surveyed first, through a decision that costs bureaucracy for 12 to 36 months. A survey by the owner's family of countries opens the site to that family; one by an outside investor opens it to that investor only.
   * The owner, its overlords and holders of investment rights may build dams, through the government or private investors.
   * Eleven dams add arable land, end an irrigation penalty or grant a flood or drought trait.
* Research: technology follows industry
   * Base innovation and the innovation cap's base reduced from 50 to 25; the cap's literacy term from 150 to 25; universities produce a sixth of their vanilla innovation.
   * Added 113 research journal entries that grant research toward a technology: 34 for the rungs, 25 for production technologies outside the ladder, 6 for land units, 10 for ships, 11 for laws that spread from other countries and 27 for the country's condition (colonies, a civilizing mission, administration, cities, universities, financial districts, chemical industries).
   * An entry fills one stage every 36 months while its condition holds (land units: 12 months), and each stage grants half the technology's tech-era base cost, for up to 20 stages.
   * An industry entry's mark is 25,000 workers for a tier-1 rung's technology, 75,000 for tier 2 and 235,000 for tier 3 (half that for arms, artillery, munitions, explosives and synthetics), halved once a country outside Isolationism holds the technology.
   * Entries pause while literacy is under 25%, 35%, 45%, 55% or 65% for tech eras 1–5; land-unit and ship entries ignore literacy.
* Trade
   * One unit of trade capacity now moves more of compact or valuable goods: about £340, £480, £680 or £960 of goods at base prices by class, instead of £200–300. Bulk and perishable goods are unchanged.
   * The world-market monopoly markup now applies only above 99% of world exports. In vanilla it added 7–20% to the world price of almost every traded good.


AI

* The AI's desire to build a rung rises with its tier: 1,000 for tiers 0 and 1, 3,000 for tier 2, 5,000 for tier 3, 800 for a craft.
* Changed seven investment-AI construction defines so the AI spends a large investment pool more readily on costly buildings.
* The AI finishes a technology it has nearly paid for: +10,000 research weight at 99% of its cost.
* The AI schools its people: every administrative strategy scores the Education institution at +100, and school laws get +500 enactment weight while a country has none.
* The AI no longer subsidises Tooling Workshops and Explosives Factory buildings.
* The AI always subsidises dams, surveys dam sites by itself (at most one new survey every 30 days) and builds them eagerly.


Balance

* Reduced four flat research bonuses to a third: Philips, Advanced Research III, Geographic Study Undertaken and Investing in the Future (Cuba).
* Vulcanization moved from tech era 3 to 4.
* Conveyors is now a prerequisite of Compression Ignition.
* Removed the electricity bonus from Niagara Falls, Krka Falls, Angara River, Trondhjemsfjorden and Hardangerfjorden; the dams replace them.
* Middle Egypt and Upper Egypt start with Basin Irrigation (−10% agriculture) and Blue Nile with Rain-fed Plain (−20%); the Nile dams end them, except in Upper Egypt.
* Efficient Canning Practices (Food Standardization 3) makes 85 groceries instead of 70.


Content

* The 1836 start is vanilla's map with each factory on the rung its method belongs to. Craft factories become ten craft levels per vanilla level and are topped up per country to vanilla's output; their workers start as shopkeepers and laborers instead of untyped pops.
* Starting technologies are vanilla's.
* 159 companies now list every rung of their industries except the craft, and their bonuses, formation requirements and AI targets follow.
* Vanilla events, journal entries, decisions, laws, buttons and modifiers that name a tiered industry now count its rungs (63 vanilla files). Among the visible changes: the art journal entries complete on one academy of their tier instead of a share of all academies, and Industry Banned demolishes every rung of a banned industry.


Interface

* Tiered buildings are named after their rung: "Tier 2. Glassworks (Crystal Glass)", "Tier 0 craft. Paper Mills (Pulp Pressing)". The number is the rung's tier, not the tech tree's era.
* Every main production method group is titled "Base".
* Research entries share one style: requirements read "<what>: <mark> (now <figure>)", and the progress bar's tooltip lists every condition.
* Dam decisions state their requirements as sentences, and each dam site has a state trait describing it.
* Tiered buildings and methods use vanilla's translations; texts the mod adds are in English.


Performance

* Dams are capped by resource slots and research entries are placed by script, which keeps the mod's cost per game tick low.
* Over sixteen campaigns alternated with sixteen vanilla ones, a century with the mod took about as long to play as vanilla (×1.01).


Modding

* The mod replaces 146 vanilla files whole and the folder common/history/buildings; the list is in the repository's README.
* The vanilla building keys of the 17 industries belong to their first rungs; vanilla's methods of these buildings stay defined but unused.
* Added scripted triggers, effects and modifier types for testing and boosting an industry across its rungs.
* The monopoly threshold is set through NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD.
* The mod never unlocks DLC content and was tested with every DLC disabled.
* The mod is built by a generator from a configuration file; its source, tools and design record are public and dedicated to the public domain (CC0 1.0).
