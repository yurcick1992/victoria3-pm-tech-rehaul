# PM & Tech Rehaul — changelog

## 1.0.0 (for Victoria 3 1.13)

Every change below is against vanilla Victoria 3 1.13.


Features

* Production: a building for every technology step
   * Seventeen manufacturing industries no longer modernise by switching their main production method: Food Industries, Textile Mills, Furniture Manufacturies, Glassworks, Tooling Workshops, Paper Mills, Fertilizer Plants, Explosives Factory, Steel Mills, Motor Industries, Automotive Industries, Arms Industries, Artillery Foundry, Munition Plants, Synthetics Plants, Electrics Industries and Arts Academy (vanilla's building names).
   * Each of vanilla's main production methods in these industries is now its own building, a rung, unlocked by the technology that unlocked the method, with vanilla's name, staffing and icon. An industry has up to four rungs, on tiers anchored at 1836, 1875, 1905 and 1940.
   * Modernising now means constructing the newer plant. An older plant is never forbidden or penalised: it loses its market when the newer rungs' output pushes its price down relative to wages.
   * A rung one tier up makes 2.2 times the output for 1.64 times the input value, and costs 1.9 times as much to build, so it earns more per worker and slightly more per construction point. Also, more modern tiers are able to stay profitable under lower output prices.
   * A tier-1 rung makes its vanilla method's output from inputs worth 20% more than the method's (motor industry rungs: the same inputs). A non-craft tier-0 rung makes two thirds of the tier-1 output from two thirds of its input value.
   * Construction costs run from 600 or 800 points for a tier-1 rung (the vanilla building's cost; the Arts Academy 400) up to 2,166 or 2,888 points for a tier-3 rung.
   * Late industries start late: Motor Industries have tiers 1–3, Munition Plants tiers 1–2, Synthetics Plants tier 1, Automotive Industries tiers 2–3 and Electrics Industries tier 2.
   * Buildings are named after their rung: "Tier 2. Textile Mills (Sewing Machines)". The number is the rung's tier on its industry's ladder, not the tech tree's era.
   * Every company with an industry can build all of its rungs, and company throughput bonuses apply to every rung of the industry.
* Artisan crafts
   * The first rung of Food Industries, Textile Mills, Furniture Manufacturies, Glassworks, Tooling Workshops and Paper Mills is now an artisan craft: Bakeries, Handsewn Clothes, Handcrafted Furniture, Forest Glass, Crude Tools and Pulp Pressing, named "Tier 0 craft. …".
   * A craft level employs 500 workers (30% shopkeepers, 70% laborers) and costs 6 construction points. It makes 60% of its vanilla method's output per worker, has no economy of scale, and keeps hiring down to a productivity of 2.
   * Crafts have their own building group, Crafts, under Light Industry.
   * Companies do not build crafts or form from them, and crafts carry no secondary production methods.
   * The 1836 map carries as many craft levels as vanilla's 1836 output of their goods needs.
* Merged methods
   * Six of vanilla's steps that are a recipe change rather than a new kind of plant are a second main production method of the building below them, switched without construction: Baking Powder, Electric Sewing Machines, Spray Finishing, Paper Bleaching, Improved Fertilizers and Electric Arc Process. Historically each of these was a retrofit of an existing plant (one new department or a new drive) costing roughly 5–20% of a new plant, so modelling it as a new building would overstate the capital it took. A step that cost more than about 30% of a new plant stays a separate building.
   * A building with two main methods is named by its tier span ("Tier 1-2. Paper Mills") and costs the geometric midpoint of the two rungs' costs (Textile Mills keep their own).
* New technologies
   * Added Spray Finishing (furniture, tech era 5), Continuous Web Processing (paper, tech era 5) and Catalytic Synthesis (fertilizer, tech era 5), each unlocking the top rung of its industry.
* Electricity
   * Electric Streetlights in urban centres now burn 2 coal and produce 1 electricity, staffed by 250 engineers, instead of consuming 3 electricity.
   * Power Plants now cost 1,600 construction points (vanilla 400). Their production methods are vanilla's.
* Hydroelectric dams
   * Added 122 historical hydroelectric projects as four kinds of dam: Mountain Power Station (300 electricity and 4,800 points a level), River Dam (300 and 7,200), Great Mountain Scheme (600 and 6,000) and Great River Dam (600 and 9,000).
   * Dams are built on the state's own dam slots, and every level is built within five years.
   * A site must be surveyed first, through a decision that costs bureaucracy and needs the technology of the dam's first level. A survey by the owner's own family of countries opens the site to that family; one by an outside investor opens it to that investor only.
   * Governments and private investors with construction rights in the state build dams: the owner, its overlords and holders of investment rights. Dams are always subsidised.
   * Each 50 electricity of dam employs 10 laborers, 15 machinists and 10 engineers, and takes 1 tools and 1 engines a week of upkeep.
   * Some dams add arable land or end an irrigation penalty: the new state traits Basin Irrigation (agriculture and plantations −10% throughput) and Rain-fed Plain (−20%) start on their states and go when the dam is built.
   * Other dams grant a new state trait when built: Steppe Irrigation (drought impact −15%), River Flood Control (flood impact −15%) or Partial Flood Control (flood impact −10%).
* Research: technology follows industry
   * Base innovation reduced from 50 to 25, and the innovation cap's base from 50 to 25.
   * The innovation cap's literacy term reduced from 150 to 25.
   * Universities produce a sixth of their vanilla innovation.
   * Added a research journal entry for the technology of every rung. It fills one stage every 36 months while the country employs enough people in the rung below, and each stage grants half the technology's tech-era base cost, for up to 20 stages until the technology is acquired.
   * The mark is 25,000 workers for a tier-1 rung's technology, 75,000 for tier 2 and 235,000 for tier 3, in whole fully staffed levels; half that for arms, artillery, munition, explosives and synthetics. It halves again once a country outside Isolationism holds the technology.
   * Research entries pause while literacy is under 25%, 35%, 45%, 55% or 65% for tech eras 1–5.
   * Added research entries for the production technologies outside the ladders, each tied to the industries that would use it.
   * Added research entries for land units, advancing in 12-month stages while one of your generals with 50 mobilised battalions faces an enemy who already has the technology.
   * Added research entries for ships, advancing while you, a rival or a great power has the ship.
   * Added research entries for laws that spread from other countries, and for technologies advanced by a country's condition: tropical colonies, a civilizing mission, a large state apparatus, big cities, universities and financial districts.
   * Several qualifying sources advance an entry once, not once each. War and naval entries ignore the literacy line.
* Trade
   * One unit of trade capacity now moves more of compact or valuable goods: silk, dye and rubber 5 → 24; opium 5 → 19.2; luxury clothes 4 → 16; clippers 3.5 → 16; steamers 3.5 → 13.71; tea 5 → 13.58; clothes and liquor 8 → 16; fabric 10 → 16.97; tools and tobacco 5 → 12; small arms 4 → 11.31; sugar 8 → 11.31; groceries 9 → 11.31; paper 7 → 11.31; telephones 4 → 9.7; coffee and ammunition 5 → 9.6; radios 3.5 → 8.49; tanks 3 → 8.49; lead, hardwood and glass 5 → 8.49; engines and luxury furniture 4 → 8; porcelain and artillery 3.5 → 6.86; steel and explosives 4 → 6.79; wine 5 → 6.79; aeroplanes 3 → 6; fine art 1.5 → 4.8; automobiles 3 → 4.8. Bulk and perishable goods are unchanged.
   * The world-market monopoly markup now applies only to a good whose leading exporting market holds more than 99% of world exports. In vanilla it added 7–20% to the world price of almost every traded good.


AI

* The AI's desire to build a rung rises with its tier: 1,000 for tiers 0 and 1, 3,000 for tier 2 and 5,000 for tier 3; crafts 800. A building with two main methods wants its own tier's desire until its owner holds the second method's technology, then the second rung's.
* Changed the investment AI's construction defines:
   * PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING from 0.001 to 0.000125
   * MONEY_SPENDING_CONSTRUCTION_TOO_LARGE_INVESTMENT_POOL_FACTOR from 0.75 to 0.95
   * MONEY_SPENDING_CONSTRUCTION_CRITICAL_THRESHOLD from 0.75 to 1.0
   * MONEY_SPENDING_CONSTRUCTION_EXCESSIVE_THRESHOLD from 1.05 to 2.0
   * CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED from 0.05 to 0.1
   * PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD from 40 to 160 weeks
   * PRODUCTION_BUILDING_VERY_LONG_CONSTRUCTION_TIME_THRESHOLD from 60 to 240 weeks
* The AI finishes a technology it has nearly paid for: +10,000 research weight on any technology with at least 99% of its cost researched.
* The AI schools its people like a player would: every administrative AI strategy scores the Education institution at +100, and Religious, Private and Public Schools get +500 enactment weight while the country has no schools.
* The AI no longer subsidises Tooling Workshops and Explosives Factory buildings.
* Every administrative AI strategy always subsidises the four dam types.
* The AI surveys dam sites by itself, at most one new survey every 30 days.


Balance

* Reduced four flat research bonuses to a third of vanilla's:
   * Philips: innovation cap +15 → +5
   * Advanced Research III power bloc principle: innovation cap +5 → +1.5 per Education level
   * Geographic Study Undertaken (expedition): innovation +10 → +3
   * Investing in the Future (Cuba): innovation cap +30 → +10
* Removed the electricity output bonus from the state traits Niagara Falls, Krka Falls, Angara River, Trondhjemsfjorden and Hardangerfjorden; the dams replace them.
* The Food Standardization 3 canning method of the power bloc makes 85 groceries.


Content

* The 1836 start is vanilla's map with each factory on the rung its production method belongs to.
* A country starts with the technology of every production method it runs in 1836.
* Vanilla events, journal entries, decrees, power bloc principles and company bonuses that name a tiered industry now name the right rungs (63 vanilla files).
* Conveyors is now a prerequisite of Compression Ignition, so Mass Production's Assembly Lines keep their own technology gate. This also delays Diesel Engines, diesel tractors, diesel pumps and diesel trains.


Interface

* Every main production method group is titled "Base", as vanilla titles its own.
* A building shows only the secondary and automation methods it can run, never one that would take a good or a job below zero, and none beside a main method it does not fit (14 incompatible pairs, reviewed one by one).
* An automation that is the same thing as a main method comes with it and is the only choice beside it: Mechanized Looms with Sewing Machines, Automatic Power Looms with Electric Sewing Machines, Assembly Lines with Mass Production. It is gone from the rungs below.
* Secondary methods have one recipe per line and industry, sized on the industry's tier-2 rung.
* Research entries share one style: requirements read "<what>: <mark> (now <figure>)", and the progress bar's tooltip lists every condition.
* Dam decisions state their requirements as sentences.
* Tiered buildings and their methods use vanilla's own translations in every language; texts the mod adds are in English.


Performance

* Dams are four building types capped by the state's own resource slots, and research entries are placed by script, which keeps the mod's cost per game tick low.
* Over sixteen campaigns alternated with sixteen vanilla ones on the same machine, a century with the mod took about as long to play as vanilla: ×1.01 pooled, ×1.11 and ×1.00 in the batch's two sessions.


Modding

* The mod replaces 146 vanilla files whole and the folder common/history/buildings; the list is in the repository's README.
* The mod never unlocks DLC content: every DLC gate of the vanilla files it copies is kept, and it was tested with every DLC disabled.
* The mod is built by a generator from a configuration file; its source, tools and design record are public, and its own work is dedicated to the public domain (CC0 1.0).
