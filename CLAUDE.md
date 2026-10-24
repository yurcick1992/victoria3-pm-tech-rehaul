# PM & Tech Rehaul — Victoria 3 mod

An economic-realism mod for **Victoria 3 1.13** ("Matcha"). Mod 1.0 ships on game 1.13 (target 2026-10-30); mod 1.1 follows on game
1.15. This repository holds the mod's generator (`config/` + `tools/`), the generated mod (`mod/`), a balance editor (`ui/`), a
headless measurement harness (`tools/testbed/`) and the design record (the `.md` files).

**How this file is organised.** Part 1 is the GOALS, what the mod changes to reach them, and the recipe formula. Part 2 is the PRINCIPLES that turn them into design rules. Part 3 is the METRICS:
the divergences from vanilla we expect, and the register that says how close we are. Part 4 describes THE CANON (the book the mod ships) and where it stands. Part 5 holds the RULES, notes and caveats for working
here. Detail lives in the reference docs listed in §5.2 — this file states each rule once and points at where it is argued, measured
or implemented. Where this file and a dated ruling in `BALANCE_FRAMEWORK.md` disagree, the later ruling wins and this file is wrong:
fix it in the same pass.

Section references: **§10.nn** = `BALANCE_FRAMEWORK.md`, **Fnnn** = `FINDINGS.md`, **Lnn** = `TESTBED_LANDMINES.md`. Terms (tier,
tech era, W, U\*, H, PI, PP, the pool, the register, …) are defined once in **`GLOSSARY.md`**; a bare letter not on that page is not
allowed in prose.

---

# Part 1 — Goals

## 1.1 Why the mod exists

The vanilla economy is too forgiving and makes technology feel cheap. The mod exists to change these things:

1. **A technological edge must really matter.** Falling behind on technology should cost a country its markets; leading should let it
   out-compete rivals.
2. **The economy must be competitive.** Efficient producers should drive inefficient ones out of a market, not coexist with them
   indefinitely.
3. **Modernising production must cost capital, as it does in reality.** In vanilla an 1830s-design factory becomes a 1930s-design one
   by flipping a production method, for free. Here a more modern plant has to be **built** — real construction cost, real capital
   demand — which creates a realistic capital deficit as economies modernise.
4. **Depeasantation must be harder to achieve.** It follows from 3: when every modern job needs real capital, the same savings create
   fewer jobs, so peasants and the unemployed leave subsistence and idleness more slowly than in vanilla. By 1936 a smaller share of the
   population is in productive work than in vanilla, and those who are produce more each. The numbers expected are in §3.1.

Everything else in this file is a means to these ends. A mechanic that does not serve them is wrong, however elegant.

## 1.2 What the mod changes

The changes a player-facing description lists after the premise, each a means to the goals above. The figures are the canon's (Part 4); the
rulings and their reasons are in the § given.

### Production: a building for every technology step

Seventeen manufacturing industries — food, textile, furniture, glass, tooling, paper, fertilizer, explosives, steel, motor, automotive, arms,
artillery, munition, synthetics, electrics and the art academy — no longer modernise by switching a production method. Each of vanilla's main
methods becomes its own building (a **rung**), unlocked by the technology that unlocked the method, with vanilla's name, staffing and icon: up
to four rungs per industry, on tiers anchored at 1836, 1875, 1905 and 1940. A newer rung makes more per worker and per unit of capital and costs
more to build (the formula is §1.3), so modernising means constructing new plants and paying for them.

Old plants are never forbidden or penalised. They lose their market when the newer rungs' output pushes their price down relative to wages,
until a rung two tiers behind cannot pay its workers (§2.1). Secondary and automation methods stay, one recipe per line per industry, shown only
beside the main methods they make sense with; an automation that is the same thing as a main method comes with it (Mechanized Looms with Sewing
Machines, Automatic Power Looms with Electric Sewing Machines, Assembly Lines with Mass Production). Every company that has an industry gets all
of its rungs. Extraction, agriculture, ports, shipyards, railways, power plants and trade centres keep vanilla's buildings.
(§10.64, §10.68, §10.72, §10.78, §10.93)

### Artisans and merged methods

The first rung of food, clothes, furniture, glass, tools and paper is an artisan craft — Bakeries, Handsewn Clothes, Handcrafted Furniture,
Forest Glass, Crude Tools, Pulp Pressing: 500 workers a level (30% shopkeepers, 70% laborers), labour-heavy, cheap to build, without economy of
scale. The 1836 map carries as many craft levels as vanilla's 1836 output of those goods needs. Companies do not build them or form off them.

Six of vanilla's steps that are a recipe change rather than a new kind of plant — Baking Powder, Electric Sewing Machines, Spray Finishing,
Paper Bleaching, Improved Fertilizers, Electric Arc Process — are a second production method of the building below them, switched without
construction. (§10.91)

### Electricity

Power becomes a real input with a supply that has to be built:
- **Cities light themselves.** The urban centre's electric streetlights burn 2 coal and add 1 electricity (staffed by 250 engineers) instead of
  consuming 3 electricity, so electrifying a country no longer needs state-by-state switching. (§10.43.0)
- **Power plants are capital-heavy.** They cost 4× vanilla's construction (1,600 points); their recipes are vanilla's. A utility then carries
  several years of revenue in capital, as 1930s utilities did. (§10.89.1)
- **Hydroelectric dams.** 122 historical projects (sites a 1930s engineer could build) as four kinds of dam — Mountain Power Station, River
  Dam, Great Mountain Scheme, Great River Dam — of 300 or 600 electricity a level, each level built within five years, on the state's own dam
  slots. A site is surveyed first (a bureaucracy cost and the first level's technology): a survey by the owner's own family of countries opens
  it to that family, one by an outside investor only to that investor. Governments and private investors with construction rights (the owner,
  its overlords, holders of investment rights) build; dams are always subsidised; some add arable land or end an irrigation penalty. Vanilla's hydro-themed state traits lose their electricity bonuses, which the dams replace. (§10.89)

### Research: technology follows industry

- **Ordinary research is cut.** Base innovation and the innovation cap fall from 50 to 25, and the cap's literacy term from 150 to 25;
  universities produce a sixth of vanilla's innovation; four flat research bonuses (a company, a power-bloc principle, an expedition, Cuba's
  modernisation) are cut to a third. By the levers' arithmetic a country without universities researches at half vanilla's speed, and a literate
  major on its cap at a quarter to two-fifths. Tech spread is vanilla's. (§10.97, §10.101.1, POLISH_1_0.md Q1)
- **Industry earns it back through research journal entries.** A technology's entry fills one stage every 36 months while the country employs
  enough people in the industry that needs it (for a rung's technology, the rung below), and each stage grants half the technology's tech-era
  base cost, until the technology is acquired — up to 20 stages, so a country far ahead pays the ahead-of-time penalty with time. The mark is
  25,000 workers for a t1 rung's technology, 75,000 for t2 and 235,000 for t3 (whole fully staffed levels; half that for arms, artillery,
  munition, explosives and synthetics), halved once a country outside isolationism holds the technology; the entry pauses while literacy is under 25 / 35 / 45 / 55 / 65% for tech eras 1–5. Production
  technologies outside the ladder have entries of their own, tied to the industries that would use them. (§10.95, §10.97)
- **Beyond factories.** A land unit's technology advances (12-month stages) while one of our generals with 50 mobilised battalions faces an
  enemy who already holds it; a ship's technology while we, a rival or a great power has the ship; radical and advanced laws spread from
  other countries; tropical colonies, a civilizing mission, a large state apparatus, big cities, universities and financial districts each
  advance their own technologies. (§10.98)
- **The AI schools its people like a player would, and finishes a technology it has nearly paid for.** With the entries, the technology majors
  still gain 0.94–0.97 of vanilla's technology by 1935 (F227, F247).

### Trade

- **What one unit of trade capacity moves depends on the good:** bulk and perishable goods as in vanilla, semi-bulk goods √2×, manufactures
  and colonial staples 2×, compact high-value goods 2√2×, precious and self-delivering goods 4× — about doubling world trade.
  (§10.88, F159, F161)
- **Vanilla's world-market monopoly markup** (up to +20% on a good's world price, by the top exporter's share of world exports — in vanilla on
  almost every traded good) applies only above 99% of world exports. (§10.102, F241)

### Smaller changes

- The 1836 start is vanilla's map with each factory on the rung its method belongs to; a country holds the technology of every method it runs.
  (§10.55)
- Vanilla events, journal entries, decrees and company bonuses that name a tiered industry point at the right rungs (`TIER_REFERENCE_AUDIT.md`).
- The investment AI spends a large pool more readily (the investment-pool defines) and weighs a newer rung more (AI desire by tier); vanilla's AI
  subsidies of tooling workshops and explosives factories are off. (§10.75, §10.92)
- The power-bloc canning of Food Standardization 3 makes 85 groceries.

## 1.3 The recipe formula

How every rung's recipe, cost and AI desire is set. Implemented by `tools/make_ab_config.mjs` (§10.68, §10.91.5, §10.101) and recomputed from
the book's `_ab` record by `tools/lint_tier_eras.mjs` in every build (L31). The values are the canon's and change only with it (§4.4).

Every industry is anchored at **t1**. For a rung of tier t, let **k = t − 1**, and take from vanilla:
- **M₁** — the vanilla main method of the industry's t1 rung (an industry with no t1 rung: exception 4);
- **Q₁** — M₁'s output of the industry's good per level; **V₁** — the value of M₁'s inputs at base prices;
- **K₁** — the construction cost of the industry's vanilla building (600 or 800 points; the art academy 400).

Per level:
```
output        Q(t) = Q₁ · A^k           (t ≥ 1)        Q(0) = Q₁ / 1.5
input value   V(t) = V₁ · L · B^k       (t ≥ 1)        V(0) = V₁ · L / 1.5
cost          K(t) = K₁ · C^k                          K(0) = K₁ / C
AI desire     1000 / 1000 / 3000 / 5000  for t0 / t1 / t2 / t3

canon:  A = 2.2   B = 1.64   C = 1.9   L = in1 = 1.2
```
- **The input value is split over goods** in the proportions, by base-price value, of the rung's OWN vanilla method's inputs; quantities are
  rounded to 0.1. A rung keeps its vanilla method's ingredients and staffing and changes only in size and margin.
- **Staffing** is the rung's own vanilla method's employment, unchanged.
- **A level's weekly profit at realised prices:** `profit = (1 + τ) · (p_out · Q(t) − Σ_g p_g · q_g(t)) − W`, with W = the country's wage ×
  Σ (employees × wage weight) (§2.10) and τ the throughput bonus (economy of scale, companies, …), which scales goods but not wages; active
  secondary methods add their own goods. At base prices and no throughput: **profit = O₁ · A^k − V₁ · L · B^k − W**, with O₁ = Q₁ × base price.
- Per tier up, output ×2.2 against input value ×1.64 and cost ×1.9: a newer rung earns more per worker, and slightly more per construction
  point. At base prices a rung two tiers back holds 0.05–0.25 of its successor's value added per worker (most under 0.16; arms and artillery
  t0 at 0.23–0.25), near or under the ~0.2 line below which F97 measured old rungs emptying. Realised prices move this (§2.7).

**The exceptions** (each ruled):
1. **Crafts** — t0 of food, textile, furniture, glass, tooling and paper (§10.91.1, §10.91.5). Not the t0 line above: 500 workers a level (the
   vanilla staffing block × 0.1, as 30% shopkeepers and 70% laborers); output Q = 0.6 × the vanilla first method's output per worker × 500;
   input value V = 0.89 × Q × base price − £2 × 500 ÷ 52, so the value added per worker reaches the crafts' £2 hiring floor when the output sells
   at 0.89 of base; spread over the vanilla first method's input mix; cost K(0) ÷ 50; AI desire 800; building group `bg_pmr_crafts`, no economy
   of scale.
2. **Merged rungs** — food t2, textile t3, furniture t3, paper t2, fertilizer t1, steel t3 (§10.91.2). The recipe follows the formula, but the
   rung is a second main method of the rung below, not a building. The host costs the geometric midpoint √(K_host · K_merged) (textile's host
   keeps its own cost); its AI desire is its own tier's, rising to the merged rung's once its owner holds the merged method's technology.
3. **Engines** (motor): L = 1.0 (§10.101). The industries whose good pops buy carry a separate lift at t0–t1; today it equals in1 (1.2) and
   changes nothing.
4. **Industries with no t0 rung** start where the tier rule places their first rung (§2.3):
   - **motor** — t1 · t2 · t3, from t1 Steam Engines;
   - **munition** — t1 · t2, from t1 Percussion Caps;
   - **synthetics** — t1 only, Synthetic Dye;
   - **automotive** — t2 · t3, from t2 Automobile Production;
   - **electrics** — t2 only, Telephone Production.

   **The ladder counts from t1 for all of them, whether or not the industry has a t1 rung.** Motor, munition and synthetics have one, and it
   is the anchor as usual. Automotive and electrics have none: their first rung's vanilla method is taken as M₁, as if it were a t1 method, so
   their t2 rung gets Q₁ × A, V₁ × L × B and K₁ × C like every other t2 rung (never priced as an 1836 rung, F111), and their t3 gets A², B²,
   C². Automotive's t2 makes 66 automobiles a level (vanilla's 30 × 2.2) and costs 1,520 points (800 × 1.9).
5. **Minted top rungs** — furniture's spray finishing, paper's continuous web and fertilizer's catalytic synthesis have no vanilla method;
   they take the input mix and staffing of the rung below.
6. **Secondary methods** (§10.91.2, §10.93): one recipe per line per industry, sized to vanilla's share of its most advanced main method
   applied to the industry's t2 rung; vanilla's employment; left off any rung where it would take a good or a job below zero. Crafts carry none.
7. **Outside the 17 industries** recipes and costs are vanilla's, except the power plant (1,600 points), the urban centres' streetlights and the
   dams (their own table, §10.89.13).

## 1.4 The constraints the goals are pursued under

- **1836 stays vanilla; afterwards only world GDP stays near vanilla.** At the 1836 start the economy's composition and distribution are
  held close to vanilla where possible (the start is converted from vanilla's own history, §5.4; the input lift is the ruled exception, and the craft rungs
  are seeded to vanilla's 1836 output). After 1836 only **world GDP as the game displays it**
  must stay near vanilla — because government minting and prestige/rank scale with it (§10.90); the technology distribution, prices and
  employment are expected to diverge.
- **The game must stay about as fast as vanilla.** The budget is **+10% of vanilla's play time** for a century (§3.4). A mod that models a
  beautiful economy and costs the player a third of their evening has failed at something the balance numbers never show.
- **Simulation purity: no artificial limits.** No hard build blocks, no `possible` gates that forbid the AI an old rung, and never a
  technology-triggered penalty on old rungs (the user: *"never ever, for simulation purity"*). Production is steered by economics
  (recipes, costs); the AI levers are willingness levers only (§2.4).
- **Vanilla values plus uniform rules.** Rungs are vanilla's own methods; ladders are uniform across industries; per-rung recipe fitting is
  out (§2.5, §2.6). As few special rulings as possible.
- **No DLC content is ever unlocked** — Paradox prohibits it (§5.1).

---

# Part 2 — Principles

## 2.1 Falling prices are the core mechanism

**Obsolescence here is price-driven.** An old building dies when its output price falls while its input prices and wages do not. Remove the
price decline and nothing else in the ladder can do the job. This ranks immediately after the goals (user-ruled 2026-08-30).

- **The decline happens in WAGE UNITS, not in pounds** (F97). Vanilla holds every manufactured good within ~15% of base for the whole century,
  because pop wealth growth re-absorbs any glut; a pop good cannot be held below base in £. What does fall is its price relative to the wage.
  The engine lays a building off once its workers fall under ~0.66× the expected standard of living, and a rung two tiers behind empties when it
  holds under ~0.2 of the frontier's value added per worker (vanilla's own recipes put two methods apart at ~1:2.7 — why vanilla's first method
  survives wherever the AI does not switch). The A/B ladder is designed on that ratio, not on a £ price path.
- **Recipe margins buy PREFERENCE for the frontier; only a price decline buys DEATH of the old rung.** With flat prices, "the old tier dies"
  and "1836 matches vanilla" cannot both hold through recipes alone: killing the old rung at base prices means making it unprofitable at base,
  which contradicts the vanilla-anchored 1836. Work the price path first; treat margin-ladder changes as palliative.
- **It is not yet achieved** — the central open problem; the measured state is in §4.2.
- **Closed price levers** (§10.90): no change to the pop-need demand caps (`max_supply_share` — people should mostly switch to finished goods);
  no construction goods-efficiency change; no change to how treasury and pool cash is generated. Cheaper frontier inputs move prices only with
  world GDP — a GDP lever, not a price lever (F178 §8).

## 2.2 What a tier means — the anchor principle

A rung's **tier** (t0–t3) is a statement about time. The anchors are **1836 / 1875 / 1905 / 1940** (`era_anchor_years`).

1. **At a tier's anchor year a technology leader should hold about half of that tier's technologies** — t1, t2 and t3 sit on the game's tech
   eras 3, 4 and 5; t0's tech era 1 is held at the start. This is the definition of a tier, not a label (user-ruled 2026-08-12, restated for
   the four-rung book). Measured by `tools/testbed/ledger/tech_census.mjs` (section D: the leader's share of tech eras 3/4/5 at 1875/1905/1936).
2. **t3 is anchored after the 1936 end on purpose.** Even an experienced player should finish a whole tree only when unusually lucky, playing a
   strong nation, and probably neglecting the other trees.
3. **The anchors are authoritative.** Technologies and industries are calibrated to them, never the reverse; re-dating technologies is an
   acceptable cost of meeting them.
4. The balance editor's tier scenarios deliberately contain every chain at every tier — a scenario is an amalgamation of several technology
   leaders with no international trade, so it must be solvable. Do not "fix" that to match rule 1.

## 2.3 The tier rule — a rung's number is its tier, and the tier is its place on the ladder

User-ruled 2026-09-13, §10.78; the code-side statement is the header of `tools/lib_tier4_spec.mjs`.

1. **Two numbers, never conflated.** A TECHNOLOGY has a **tech era** (1–5, the game's mechanical era: era base cost and ahead-of-time penalty).
   A RUNG has a **tier** (0–3). They map through `era_game_era` = **[1, 3, 4, 5]**: t0 ↔ tech era 1 (held at the 1836 start), t1 ↔ 3, t2 ↔ 4,
   t3 ↔ 5; tech era 2 (researched 1836–1861) sits in the gap and rounds UP to t1. Write "tech era 4" for a technology and "t2" for a rung; a bare
   "era N" is the bug. ⚠ Identifiers were not renamed: the config field is still `era`, tools are `lint_tier_eras.mjs`, books are `e1a12-…`.
   The docs said "era"/"e2" for a tier until the rename of 2026-10-21; quotations keep the old words.
2. **A tier is derived, not chosen.** A rung's tier is the tier its gate technology's tech era maps to, bumped up only as far as one rung per
   tier needs in vanilla's method order (vanilla's ladders are front-loaded — a textile mill's methods sit on tech eras 1, 1, 2, 4). Tolerance
   ±1 tier; beyond it the generator throws, and a ladder that does not fit needs an explicit `PLACEMENT` ruling (fertilizer and explosives start
   at t0 with a tech-era-2 first method). Late industries start late: automotive is [t2, t3], electrics [t2], munition [t1, t2], synthetics [t1],
   motor [t1, t2, t3] (derived since 2026-10-01). *"If I ever see a t0 automobile industry, I will riot."*
3. **The tier is also the rung's place on the ladder** — output × A^tier, input value × B^tier, building cost and `ai_value` by tier, the research
   marks by the unlocked rung's tier. **The rung's index within its industry is never a key to anything.** (Keying on the index priced
   automotive's t2 rung as an 1836 rung — a quarter of its tier peers' value added — F111.)
4. **Guarded three ways:** the generator derives and throws; `tools/lint_tier_eras.mjs` runs in every build and as landmine L31 (placement,
   one rung per tier, output and value added rising with tier, every A/B multiplier recomputed from `_ab`); a book records `_ab.keyed_by: 'era'`
   and its own regenerating command.
5. In-game names say **"Tier N."** ("Tier 2. Electrics Industries (Telephones). …", §5.4); a start rule names its rung by `era`; where a rung's
   position survives (the UI's `t.tier`, a six-rung start rule's `tier`) it is a lookup key nobody reads.

## 2.4 Recipes steer production; AI values only make the AI follow profit

User-ruled 2026-10-02, §10.92: *"we want it [the ineffectively invested capital] to be as low as possible, and the reason that we fine-tune AI
values is that it's not low naturally, not for some desire to steer it away."*

1. **The investment AI should put capital where it pays.** The measure is **misplaced capital** — the share of new capital in mines, agriculture
   and manufacturing whose expected payback is more than 3× the best VALID alternative's, or loss-making (F206/F207; GLOSSARY §6). It should be as
   low as possible. Vanilla misplaces 10–19% of each decade's capital; the four-rung books 22–29% by 1926–36.
2. **AI values, AI strategies and AI defines are tuned for that alone** — never to push the AI toward or away from an industry or a rung for its
   own sake. A change to them is judged by whether misplaced capital falls (directionally, §2.9). The tier desire ladder is CALIBRATED per book
   to that end; it is not a design lever.
3. **Steering production is the recipes' job** — inputs, outputs, building cost. When an industry is dead and should not be, when a death ripples
   down a chain, when an old rung should die and does not: make the wanted outcome effective and profitable for the AI, reading realised prices
   first (§2.7). The AI values follow.
4. **Exempt, never measured, their AI values set to get them BUILT** (§10.92.1): infrastructure (railways, ports, power plants, dams), trade
   centres, shipyards, every government-funded building group (administration, universities, construction sectors, the military, monuments,
   canals) and gold mines (vanilla's static `ai_value` 5000, kept). ⚠ The military INDUSTRIES (arms, artillery, munitions) are NOT exempt, nor is
   the art academy.
5. The measurement may change; the principle does not. It sits beside the no-artificial-limits constraint (§1.4): that one says which levers may
   touch the AI, this one what they are for.

## 2.5 The levers — what may move, what is decided, what is closed

**The routine levers** (§10.83, §10.101.1) — what a search for the optimum moves:
- the ladder: **A** (output step per tier), **B** (input-value step), **C** (cost step: `building_cost` = anchor × C^tier), **cost1** (one multiplier
  on every rung's cost, §10.101.2 — cost LEVEL beside C's SLOPE);
- **in1** (the general input lift, today 1.2), the pop-good industries' anchor-and-below lift (today 1.2), and a **per-industry lift** where ruled —
  one number for the industry's whole ladder (engines 1.0; paper a candidate, range 1.0–1.3). An industry's own lift overrides the pop-good lift;
- the two steps down to t0: the craft rule's share of vanilla's goods per worker (0.6) and the non-craft down-step (1.5);
- research: the one innovation parameter **x** (innovation base = cap base = the cap's literacy term = x; universities × x/150; today 25), tech
  spread (vanilla so far), the length of a non-war research-entry stage.

**Decided, not routine:** the grant per research stage (half the tech era's base cost), the per-good trade weights (×1; scaling them is closed),
the merge-host cost rule, the dam staffing, the AI desire ladder (calibrated per book, §2.4). The research marks, the literacy gates and the power
plant's cost are recalibrated only as separate, deliberate events.

**Closed:**
- per-rung recipes, and a per-industry level solved to a target margin (`--in0-level`: "the solver all over again", §10.86.4). Ladders may be
  NON-geometric (a per-tier list) but stay uniform across industries;
- hard build blocks and technology-triggered penalties (§1.4);
- the price levers of §2.1 (pop-need caps, construction goods-efficiency, pool cash generation);
- an OUTPUT-goods penalty on the 1836 recipes to raise prices at the anchor — a distant possibility, not to try unless decided explicitly;
- **no infinite money printers**: a rung whose return per construction point far outruns the ladder is gameable by a player (the ×3 film academy was
  reverted for that, §10.74), whatever it does for the AI's economy.

**What the levers are known to do** (directional; corpus readings): A, B, the cost slope and the input lift act as ONE axis for world GDP, Britain's U\*
and the hoard — every +10% of world GDP costs Britain ~2.5–3.3 pp of U\* and raises the hoard ~×1.27, whichever lever buys it, and the seed moves runs
along the same line (F165). The hoard's source is the pool's inflow: realised margins in the four-rung books run about twice vanilla's, and the cost
slope is the lever that takes the hoard down together with W (F135). Britain's end-state U\* is a weak reading (within-config sd ~17 pp); a config's
1900 world GDP already ranks configs well (r ≈ 0.86, F165).

**Two positioning rules.** (1) *The under-side rule* (§10.79): when a change that raises world GDP is going in for its own design reasons, the base
it lands on should sit slightly BELOW the GDP / depeasantation target, not on it. (2) *Which book a change branches from* is never assumed —
ask (§5.1 rule 3).

## 2.6 Vanilla is the reference and the material

- **Rungs are vanilla's main methods** with vanilla's names, gates, recipes, staffing and icons, enriched by the A/B ladder (§10.72). Additions
  (a minted top rung where vanilla has fewer methods) only where ruled, and never on the theme of one of the industry's own secondary methods
  (the generator throws). Three are minted today: furniture spray finishing, paper continuous web, fertilizer catalytic synthesis.
- **The tech tree is vanilla's**, at vanilla's tech eras, names and prerequisites, departing only by the spec's explicit entries in
  `tools/lib_tier4_spec.mjs`: `ERA_MOVES`, `PREREQ_ADDS` (today one: conveyors before compression ignition, so Mass Production's mandated Assembly
  Lines keep their own gate — §10.93) and the minted technologies of the additions.
- **There are no contentless vanilla technologies.** A technology that looks empty in the tree viewer gates something elsewhere (methods, units,
  decrees, companies, events). Never delete a vanilla technology (vanilla script names it), and never empty one: a re-peg must keep what it gates.
  Read `tools/audit_tech_content.mjs` before any merge or removal; `tools/lint_tech_content.mjs` checks the emitted mod every build.
- **The 1836 start is converted, never hand-authored** — vanilla's history re-tiered by the active method, plus the book's start rules (the canon's
  are empty, §5.4). The 1836 technology grant is derived from the map: every method vanilla runs in 1836 stays, and the country running it holds its
  technology (§10.55).
- **Tech spread is vanilla's** (§10.54); the per-tree AI research weights default to 1.
- **A vanilla file is owned only when we change it**; owning it freezes it against the next patch (`ON_GAME_UPDATE.md` lists every coupling).

## 2.7 Plan around realised prices; a base-price margin is not even directional

User-ruled 2026-09-19, §10.86.2: *"Realised prices will be far off base, mostly by design, but significantly — by random seed. Industry economics at
base prices is not even directional … We should always try understanding where prices go, first, and plan configs around that."* Over vanilla's
seeds a good's price ÷ base spreads 61 pp across markets and 10 pp across seeds at 1836, and 42 pp across markets against 52 pp across seeds by 1900;
one industry on vanilla's own recipe runs −48% to +116% across the seven instrumented markets at 1836 (F140).

- Design a recipe against a measured price DISTRIBUTION (`tools/era0_solvency.mjs` on the recipe side; PI/PP on the end-state side), never against
  base prices or one run's prices. A margin quoted at base prices says so and is never presented as what the building will earn.
- **At the band edge only quantities carry information.** A price pinned at 25% or 175% of base can no longer signal scarcity; read sell orders,
  production and the producer's staffed levels (`tools/testbed/ledger/good_market.mjs`) — buy orders include demand that was never met.

## 2.8 No ceteris-paribus extrapolation

The game is one interconnected system: buildings → GDP → investment pool and taxes → construction → buildings; GDP → education → literacy →
research → which tiers exist; war → conquest → the population every aggregate is computed over. A change to one term reaches every other term
within a decade or two of game time.

- The failure is usually a confident MAGNITUDE, not a wrong direction ("buildings are 1/5 the cost so the AI builds 5× as many" — it built 2.21×,
  F78; a doubled `ai_value` predicted to do little moved the metric more than anything before it, F76).
- **State the prediction in the schedule BEFORE the run**; a surprise is then a finding, not a correction. When a result differs from the
  extrapolation, the first hypothesis is a feedback path you did not draw. Say whether a magnitude is argued or only its direction.

## 2.9 The statistics are directional

User-ruled 2026-09-18, §10.83.7: at n=2–3 no gap between two books' losses is statistically real (one run's loss has σ ≈ 6.6, so two books separate
only at Δ ≳ 13). A lever's reading is evidence of its DIRECTION, weighted by whether its mechanism is understood; a pooled reading across a whole
lever axis outranks any two-book comparison. ⚠ **"CI" in this project is the PERCENTILE INTERVAL OF VANILLA'S SEEDS**, never the confidence interval
of a mean (GLOSSARY §4).

## 2.10 Report true profits; predict the wage from the economy and the decade

User-ruled 2026-09-20, §10.87, F152.

1. **Reports quote PROFIT in £** (per week; annual and per staffed level where they help). A margin may sit beside it, never instead of it. A tool
   that cannot compute a unit-correct margin prints none.
2. **The wage model is `tools/lib_wage_model.mjs`, one implementation:** `W = wage(tag, year) × Σ(employees × wage_weight) × staffed levels`, the
   weights read live from `common/pop_types`. **£ per employee per week = a save summary's `base_wage` ÷ 10,000** (the engine's unit is weekly £ per
   `POP_SIZE_PACKAGE` employees). `config/measured_base_wages.json` is the committed per-tag, per-year path (vanilla median). **There is no premium
   and no profit term** — the plain model reproduces the exact wage bill to ~1% in the median from 1857 on. Never quote it for ONE building (p10 ≈
   0.45, p90 ≈ 1.6–1.8). A building in an industry has no "predicted wage"; the economy and the decade do ("stalling GBR in 1920").
3. **`profit = revenue − inputs − wages`; dividends and subsidies sit below it.** The summary's `profit` (`profit_after_reserves`) is the clean
   pre-distribution figure.
4. **The margin identity:** `margin = profit ÷ (R − profit)` with `R = va_out × (market price ÷ base)` — because `va_out`/`va_in` are BASE-priced and
   `profit` is MARKET-priced (F150). From save summary v9 on, `goods_sales` and `goods_cost` are at market and `wages = goods_sales − goods_cost −
   profit` is exact. A building with no goods flows (financial districts, manor houses, company HQs) has profit only, no margin.
5. The wage share of total cost is 15–23% in manufacturing (54% → 29% for the whole economy). `wage_pct` (0.25) survives only as the config-side
   convention behind `target_be` and `lint_solvency.mjs`.

## 2.11 A reported ratio carries its own numerator and denominator

Any table whose headline is a ratio shows both terms as columns, and the ratio column names its direction (`ratio = transp ÷ auto`). The terms carry
the finding: a "transportation ÷ automobiles" collapse looked like displacement until the columns showed transportation flat and automobiles ×829.

## 2.12 Evidence discipline

- **A shipped comment or document is a cheap hypothesis, not evidence.** Read the game's own files before theorising (`common/pop_needs` documents the
  pop-need split in a header comment) — and corroborate with a measurement before believing; a comment true when written rots silently after the code
  moves.
- **A level cannot identify a rule; a perturbation can.** Every pop need shares a good with another need, so no need's budget is observable from the
  order book (F35) — change one input and watch what moves.
- **A quantity that needs a special case everywhere it appears does not belong in the model** (gold, which has no buyer without a treasury, had four
  exemptions and still leaked into the first metric that widened its population).
- **A branch that has never executed is not known to work, and a guardrail that has never failed is not known to work** — prove a detector by
  breaking the thing on purpose. A detector outperforms a hand pass (the hand fix of one landmine found 6 sites; its detector then found 13 more).
- **Report only a final state.** A number read before the last step that mutates its inputs is void, however plausible it looks.
- **A rule that declines or skips cases prints what it declined.** A silent skip is indistinguishable from a rule that never ran; a generator that
  cannot do its job throws rather than warning and continuing.

## 2.13 The rulings in force — an index of BALANCE_FRAMEWORK

One line per ruling that still governs something; the § holds the words, the reasons and the history. §1–§10.51 and most of §10.52–§10.67 are the
six-rung era and the legacy break-even ladder — records, not rules (the solver they describe is closed, §10.80).

| § | the ruling, in one line | status |
|---|---|---|
| 10.54 | tech spread stays vanilla's — the research journal entries pay for the deeper tree | in force |
| 10.55 | the 1836 technology grant is derived from the 1836 map: the owner of a method vanilla runs holds its technology | in force |
| 10.62 | per-tree AI research weight, config-backed, default 1 (nothing emitted at 1) | in force |
| 10.63 | solvency: a rung's base recipe must break even at ≤ 175% of base output price with inputs at base (`lint_solvency.mjs`, L18) | in force |
| 10.64 | the company chain extension: every tiered rung added to every company that has the industry | in force |
| 10.68 | the A/B ladder: output × A^tier and input value × B^tier over the rung's own vanilla method | in force (values in Part 4) |
| 10.69 | no artificial limits: hard build blocks rejected; a willingness lever (a target condition) is allowed | in force |
| 10.72 | the four-rung book is built from vanilla and the spec alone — vanilla names, gates, recipes; additions only where ruled | in force |
| 10.74 | the art academy on the regular ladder; no infinite money printers | in force |
| 10.77 | the tier-0 input lift (the vanilla-1836 premise relaxed for the input penalty only, §10.83) | in force as the lift |
| 10.78 | the tier rule | in force (§2.3) |
| 10.79 | the hoard is a problem in itself; the under-side rule | under-side rule in force; the flag superseded by §10.83 |
| 10.80 | the six-rung ladder is closed for good (UI bloat, not economics) | in force |
| 10.81 | a conditional construction weight is expressible but deliberately unused (defines are global and constant) | record of a decision |
| 10.82 | the 1890–1910 dip is EXPECTED (countries hold technologies before they have built the rungs, where vanilla just switches) | the dip ruling in force; the ceilings superseded by §10.83 |
| 10.83 | the criteria register (+ .4–.8: the amendments, the loss, directional statistics, the reading gate) | in force (§3.2) |
| 10.85 | the shortlist's GDP and W aims widened | in force (§3.2) |
| 10.86 | the world product's derived hard band; prices planned first; the tier-0 penalty bounded by the 1836 map; per-industry levels closed, non-geometric ladders open | in force (per-industry lift relaxed by §10.101) |
| 10.87 | report true profits; the wage model; the margin identity | in force (§2.10) |
| 10.88 | trade weights ×1 at B 1.64; the finish boost | in force (B moved with later books) |
| 10.89 | hydro dams (+ .1 the power plant at 4× cost; .9–.14 the redesign, engine-built, family rules, resource slots, private construction; .15 dams against real plants, urban-centre electricity ×2 / ×3 deferred to mod 1.1, more dam variety dropped) | in force (.15 deferred) |
| 10.90 | the closed price levers; world GDP read as displayed | in force (§2.1, §5.6) |
| 10.91 | craft rungs (line A) and merged rungs (line B), with the staffing, floor, t1 anchors and desire rules of .1–.5 | in force (Part 4) |
| 10.92 | recipes steer production; AI values only follow profit; the exemptions | in force (§2.4) |
| 10.93 | secondary and automation methods: none shown that cannot run, none negative, reviewed compatibility, mandates, "Base", tier-span names | in force (§5.4) |
| 10.94 | input-price red flags, a standing check on every batch | in force (§3.3) |
| 10.95 | research entries for production technologies outside the ladder, one by one, on the narrative onset | in force |
| 10.96 | the last tech rework: shift research levers, no new principle; world GDP of every decade a target, with the 1886 break line | in force (§3.2) |
| 10.97 | research entries reworked: non-additive, literacy-gated, 20 stages; research halved for everyone | in force |
| 10.98 | research entries beyond production (ships, contagious ideas, the country's condition); frontline entries at 12 months | in force |
| 10.99 | the artmerge arm canonised; returning to the pre-artmerge family needs the performance changes reimplemented | record + warning |
| 10.100 | the world-GDP aim 0.90–1.00; the closed-major term on Germany; a lucky seed stands in for a skilled player | in force (§3.2) |
| 10.101 | per-industry input lift allowed (one number per industry line); the routine levers; cost1 | in force (§2.5) |
| 10.102 | the world-market monopoly threshold 0.99 | in force (canon since 2026-10-21) |
| 10.103 | treaty ports: the measured funnel and the layered solution, deferred to mod 1.1 on game 1.15 | deferred |

---

# Part 3 — Metrics: how close we are

## 3.1 Expected divergences from vanilla

What the goals (§1.1) and the changes (§1.2) should do to the numbers, against vanilla. The register (§3.2) turns most of these lines into ruled
aims and boundaries; the others are expectations, read in every report but not scored. A ratio is to vanilla's per-run median (§3.5) at the end
state (the 1932–1936 mean) unless a date is given.

| quantity | vanilla | expected in the mod | why | read by |
|---|---|---|---|---|
| the 1836 start: map, output, prices | — | the same, inside vanilla's seed spread | 1836 stays vanilla (§1.4); the crafts are seeded to vanilla's output; the input lift is the one ruled exception | register (the 1836–1845 anchor) |
| world GDP, as displayed | 1.0 | 0.90–1.00× at the end; a dip around 1890–1910 is expected, but 1886 inside 0.83–1.17× | modernising costs capital, so the world ends slightly poorer; capital abundance must be hard to reach (§10.100) | register |
| productive workers per capita (W), world and pool | 1.0 | 0.6–0.95× | goal 4: capital is scarce, so fewer people find productive work | register |
| unemployment including peasants (U\*), the pool | ≈ 21% | ≥ 2× (≈ 42% or more); never under 10% pooled | goal 4, seen from the other side | register (10% is a hard line) |
| GDP of the shortlist pool | 1.0 | 1.1–1.9× | those in work produce much more each (up to ~2× per productive worker) | register |
| a closed major's capital abundance (Germany, 1927–1936) | — | none: German U\* stays ≥ 10%, and the hoard does not pile up | §10.100 | register (`gerCM`) |
| the hoard (investment pool ÷ GDP) | 1.0 | under 1× | capital is spent on dear modern plants, not piled up | register (least important) |
| building-input prices in £ ÷ base (PI) | 1.0 | ≤ 0.8×, falling decade over decade | the frontier floods the market (§2.1) | register |
| pop-goods prices in wage units (PP) | 1.0 | ≤ 0.8× | obsolescence works through wages, not £ (F97) | register |
| workers on tier-0 rungs (T0) | vanilla's first methods survive wherever the AI does not switch | zero by 1936, or falling decade over decade | goal 2: old plants lose their market | register |
| workers on t3 rungs ÷ all other tiers | — | as high as possible | the frontier takes over | register |
| construction cost of a modern plant | one building cost for every method | t2 ×1.9, t3 ×3.6 of the vanilla building's cost (§1.3) | goal 3 | design |
| misplaced capital | 10–19% of each decade's new capital | as low as possible | §2.4 | `misplaced_capital.mjs` |
| the technology leader's share of a tier's technologies | — | about half at the tier's anchor year (t1 1875, t2 1905; somewhat under half of t3 at 1936) | the anchor principle (§2.2) | `tech_census.mjs` |
| the technology majors' technology count | 77 at 1900, 107 at 1936 | near vanilla's | research cut, industry entries compensate (§1.2) | `tech_census.mjs` |
| world trade | 1.0 | about 2× | traded quantities by class (§1.2, F161) | `trade_vs_gdp.mjs` |
| play time for a century | 1.0 | ≤ 1.10× of the same days' vanilla | §1.4 | `wall_clusters.mjs` |

## 3.2 The criteria register

User-ruled 2026-09-17 and amended since — §10.83 (+ .4–.8), §10.85, §10.86.1, §10.100. **Implementation: `tools/testbed/ledger/criteria.mjs`**,
whose defaults ARE the ruled form (`--arm <session[,session]>[:<setup>] [--arm …] [--config <book>]`; several arms print a ranking). One rule set for
the config iterator and for every batch report.

**Kinds.** An **AIM** is what config iteration tries to reach. A **SOFT** boundary is unacceptable but the economy is not broken: the run is read in
full, and a soft breach never stops a batch (it marks the book "not final"). A **HARD** boundary means the economy is broken: the run records only
*broken by stall* or *broken by runoff*, and **one broken run ends the config** (the stop watcher drops the STOP file).

**Scopes and windows.** The **shortlist pool** = GBR · USA · FRA · NET · BEL · UNL · PRU · NGF · GER read as ONE economy (per country only where a line
says so); the **world** = every country. The table is read at the **end state**: the 1932–1936 mean (the 1935 point printed beside it); the path has
one rule of its own (below). Every
ratio is to vanilla's per-run median of the same scope and window. **Hard lines are checked per run; everything else on the CONSENSUS of the intact
runs** (the median of two; with three, the two closest on world GDP; a pair that diverges owes a third run).

| scope | metric | aim | soft | hard (per run) |
|---|---|---|---|---|
| world | **GDP** (displayed `world.gdp`) — priority 1 | 0.90–1.00× | outside 0.75–1.33× | outside [vanilla p2.5 × 0.8, p97.5 × 1.2], derived per invocation (≈ 0.66–1.38× at n=16): below = stall, above = runoff; and the 1836–1845 anchor outside vanilla's 90% interval ± 10% in more than two years |
| world | W (productive workers per capita) | 0.6–0.95× | > 1.0× | — |
| world | U\* (unemployment incl. peasants) | — (higher than vanilla) | < 1.0× (flag only, not in the loss) | — |
| world | H (investment pool ÷ GDP) | < 1× | — | — |
| world | closed-major term `gerCM` (Germany, 1927–36) | 0 | — | — |
| pool | GDP (total) | 1.1–1.9× | < 0.95× or > 2.0× | — |
| pool | W | 0.6–0.95× | > 1.0× ("full depeasantation") | — |
| pool | U\* | ≥ 2× | < 1.0× | pooled U\* < 10% (runoff) |
| pool | H | < 1× (least important; no book meets it) | — | — |
| pool | capital abundance | — | 3 years at hoard ≥ 1.0 GDP; 5 years at any hoard; a hoard alone > 3 GDP at the end or > 2 every year 1931–36 unspent | a member of ≥ 50M with U\* < 5% in ≥ 5 consecutive years ending by 1936 AND a mean hoard ≥ 1.5 GDP over them (runoff) |
| pool | T0 (tier-0 rung workers, by the rung's TIER) | 0 at 1936, or falling decade over decade | 1935 > 1.3 × the 1900s mean | — |
| pool | T3 ÷ (T0+T1+T2) | the more the better | — | — |
| pool | PI (building inputs steel/tools/engines/fertilizer/explosives/dye/paper, £ ÷ base, ÷ vanilla) | ≤ 0.8 and falling decade over decade | > 1.0 | — |
| pool | PP (pop goods groceries/clothes/furniture/glass/fine art/automobiles/telephones/radios, in WAGE UNITS ÷ vanilla) | ≤ 0.8 | > 1.1 | — |
| pool | PM (war goods) | read only | — | — |

**Priorities:** world GDP > the pool's W × Y > W. World GDP is also the steadier reading — within a config its coefficient of variation runs ~19%
against ~88% for Britain's U\* — so tune on world GDP and read U\* as a constraint that must stay in its band. ⚠ Unruled: the pool U\* aim (≥ 2×) contradicts the widened pool W aim (U\* ≥ 2 ⇔ W ≈ 0.68).
⚠ The pool GDP line reads TOTAL GDP while the ruling spoke of per capita; the report prints both.

**The closed-major term** (§10.100): over 1927–1936, per year, e = how far German U\* is below 10% (0 at ≥ 10%, 1 at 0%) and a = e × the hoard's
excess over 0.5 GDP ramped to 1 at 1.5; G = mean(e) + 4 · mean(a). Germany = GER, else NGF, else PRU. The consensus carries the arm's **lucky seed**
(the 75th-percentile run by G over ALL usable runs, broken ones included) — the stated stand-in for a skilled player; every report using it says so.

**The reading gate** (§10.83.8): U\* and H "at the aim" in a POOR world are not results — a world that never industrialised keeps its peasants and has
no pool by identity. World GDP 0.80–1.20 → read U\* and H normally; 0.66–0.80 or 1.20–1.38 → WEAKENED (quote only with the GDP beside them); ≤ 0.60 →
disqualified (already broken by stall). The cut between weakened and disqualified is unruled. Per-country SHARES (1 − U\*) stand as evidence;
per-country LEVELS move with territory and are weak.

**The loss** (the iterator's objective): L = Σ w · d, where d = the distance from the aim interval in units of a FIXED σ per line (the pooled
within-config spread of the 2026-09-13→18 books, F134; capped at 5σ), plus, beyond a soft line, the excess counted twice more (a kink, continuous
through the line). Weights: world GDP 2 · pool GDP 1.5 · pool W 1.25 · world W 1.25 · T0 1.5 · T3 1.5 · pool U\* 1 · PI 1 · PP 0.75 · pool H 0.75 ·
world H 0.5 · gerCM 1.5. T0 enters as T0 ÷ (T1+T2+T3), the less the better. Losses before 2026-10-13 were on the old GDP aim (0.95–1.05).
⚠ The loss DESCRIBES a config's residual; at n=2–3 it does not rank (§2.9). What it gets right is the historical arc of the books.

**The path: a mid-game dip is expected, within limits.** Around 1890–1910 world GDP may sag below vanilla, because countries hold technologies before
they have built the rungs, where vanilla just switches methods (§10.82). But the world GDP of EVERY DECADE is a target in its own right (§10.96): an
arm whose 1886 world GDP sits more than 2σ of the canon's own 1886 spread from vanilla (0.83 / 1.17 when ruled) has likely broken something.

**Superseded as criteria** (their scripts stay as diagnostics): the 2026-09-15 capital-abundance flag (`capital_flags.mjs`), §10.79's hoarding tests,
§10.82's workers ceilings and plateau test (`majors_workers.mjs`, `major_series.mjs`), F114's target bands (still the divergence test of the 2+1 rule,
`alignment_check.mjs`) and the 1.3× GDP stop (now only the stop watcher's fallback).

## 3.3 Readings beside the register

Not loss terms; each is read in every batch report.

- **Misplaced capital** (§2.4, F206/F207) — `tools/testbed/ledger/misplaced_capital.mjs`; the yardstick of every AI-value change.
- **The old rung beside its replacement** — per industry, workers on a rung two or more tiers behind the best rung their own country staffs
  (`old_rungs_by_industry.mjs`, the ledger's tables); the obsolescence census by regime, in-market vs trade (`trade_obsolescence.mjs`). This separates
  the ladder failing to retire a rung from a country that runs nothing newer. Proposed and unruled: an obsolescence term in place of T0 (per industry,
  the share of the old rung's century-peak workers shed by the end, F136).
- **Input-price red flags** (§10.94, a standing check on every batch and probe): HIGH = ≥ 1.70 × base at every reading of a ≥ 2-year stretch; SWING = a
  ≥ 0.5 × base range within 3 years on < 10 units/week of supply (a shortage in disguise); every industrially consumed good except the local goods
  (electricity, transportation, services); the eleven tags' major markets. Headline: **problem market-years** (of 800) and **chronic markets** (≥ 20
  years), with a 3–15-sentence summary written with the `redflag-summary` skill (`redflag_metrics.mjs`; listing kept in `redflags_full.html`, not on the
  page). No flag is dismissed for want of demand: an industry that cannot start because its inputs are dear shows exactly that. SWING is common in
  vanilla itself — read it against vanilla's line.
- **Technology** — the majors' technology gain against vanilla and the anchor principle (`tech_census.mjs`), timing against the narrative onsets
  (`tech_timing.mjs`), reliance on the research entries.
- **Dams** — slot breaches (must be 0) and who builds (`dam_slots.mjs`).
- **The first-run decomposition** after each arm's first run: GDP = population × productive workers per capita × GDP per productive worker, world and
  pool (`first_run_decomp.mjs`).

## 3.4 Play speed

The budget: **the century's play time within +10% of vanilla's**. The grade is the **raw total a player waits through** (the main median, below);
the pop-matched per-unit cost is a diagnostic beside it, never the verdict — shrinking what the engine simulates is a legitimate way to meet the budget.

- **Same-days vanilla only.** Vanilla on the same game version played ×1.06–1.08 slower per unit of world in October than in August (F248), so a play
  time is not comparable across months: the reference is `VANILLA_WALL_REF` (the most recent same-harness vanilla, `lib_runs.mjs`), and the alternating
  vanilla + canon batch measures both in the same days.
- **Three run clusters** (user-ruled 2026-10-07): (1) normal; (2) inexplicably slowed — a slowdown episode with no listed bug observed; (3) a LISTED
  vanilla bug directly observed in the run's saves. Main reports use clusters 1 + 2 combined; cluster 3 is reported as a count and the bug's name. The
  list holds one bug: **the fleet path loop** (a fleet recalled for repairs whose travel path the engine keeps extending; ≥ 200 path moves and ≥ 125k
  distance, gone once the slowdown ends — F218). No tick pattern is accepted as proof of a listed bug.
- `tools/testbed/ledger/wall_clusters.mjs` reads it; slowdown episodes and the save quarantine that keeps saves for debug-mode inspection, the machine
  monitor and the per-tick profile are in `TESTBED_OPERATIONS.md`.

## 3.5 References, pools and which runs count

- **Vanilla references** (`tools/testbed/ledger/lib_runs.mjs`): `VANILLA_REF` = the summer n=18 + the October n=6 = **n=24**, the default for every
  reading but the wall clock; `VANILLA_WALL_REF` = the October six alone. Interim until the alternating batch.
- **The instrumented tags are eleven:** GBR · FRA · USA · PRU · NGF · GER · NET · BEL · UNL · RUS · JAP. `tools/testbed/ledger/lib_markets.mjs` is the ONE
  definition of the shortlist pool, the majors, the per-country members and the price-tracked markets. UNL (the United Netherlands) replaces NET and
  BEL where it forms. A market is named after its leader's adjective, so prices are keyed by TAG and resolved per run.
- **A state's market is one series across its tag changes** (GER continues NGF continues PRU; UNL continues NET; the French Commune's market continues
  France's); civil-war revolt states are NOT merged. PI/PP are read on the intersection of the arm's and vanilla's market SERIES, and the basis is
  printed.
- **Disclose the baseline.** Prefer the higher-n references; a result that needs a market only the eleven-tag runs carry (German, Belgian prices) says
  so where the number is quoted.
- **Only usable runs count** — a run that reached its own `until` date with no `abandoned_reason` (L17; `lib_runs.usableRuns`, the only definition).
  A run count in a session's name is not evidence. Runs pool across sessions only within one config FAMILY (same structure; `configFamilies`).
- Pre-v12 save summaries may have lost a country record to a civil war or revolt (L38): check with `summary_drops.mjs`.

---

# Part 4 — The canon: what ships and where it stands

## 4.1 What it is

**`config/mod_config.json` + `config/tech_tree_options.json` are verbatim copies of the named book
`config/mod_config.jex-dam4s-rs-x25-m10ac-dpriv-wm99.json` + `config/tech_tree_options.jex-dam4s-rs-x25-m10ac-dpriv-wm99.json`** — sha256 prefix
**`728f2c7f84e6f467`** (the tree twin `04ac513168388956`), canonised 2026-10-21 with the night's polish rulings (§10.102; `_polish_2026_10_21`,
`_polish_2026_10_21b`). `mod/` and the deployed copy are its default build. Verify with `sha256sum config/mod_config.json`.

**What it contains is everything §1.2 describes, built by the formula of §1.3 at the values given there.** The provenance records inside the book —
`_ab`, `_artisan`, `_merge`, `_*_variant`, `_canon_*`, `_polish_*` — carry the commands that regenerate it. ⚠ The book's plain `_canon` record is
inherited from `canon4v-hai3` and does NOT name the current canon; `_canon_2026_10_16`, `_wm99_variant` and the `_polish_*` records do.

What §1.2 and §1.3 leave out:
- **Investment AI:** the private pool's cost divisor 0.000125; the investment-pool defines — too-large-pool factor 0.95, critical 1.0, excessive
  2.0, the queue cap 0.1, long / very long construction 160 / 240 weeks (§10.75, F158).
- **Research as stored:** the one innovation parameter x = 25 (`research_levers`: innovation base, cap base and the cap's literacy term = x,
  universities × x/150, §10.101.1); entries non-additive (several qualifying sources tick once), war and naval entries exempt from the literacy
  line; the finish boost (+10,000 AI weight on a technology at ≥ 99% of its cost, F160); AI schooling (`ai_schooling`).
- **Dams:** the four ruled classes and their slots (§10.89.13); staffing 10 laborers / 15 machinists / 10 engineers per 50 electricity;
  upkeep 1 tools + 1 engines per 50 electricity; the four dam types `must_have` in every administrative strategy.
- **Trade and defines:** the five-class traded-quantity table at ×1 (F159 §7); `NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD = 0.99`.

## 4.2 Where it stands (2026-10-24)

- **The latest century of the canon's economics** (F247: the wm99 book, n=4, before the 2026-10-21 polish): 3 intact + 1 stall (the USA collapsing
  after 1880); consensus loss 8.21; world GDP 1.08×; pool W 1.00× (on its soft line), pool U\* ≈ vanilla's (22.0% against 21.3%, far under the ≥ 2×
  aim), pool H 0.25 against 0.33; PI 0.96 (not falling), PP 0.94; T3 22.7% of tiered workers; the closed-major term 0; misplaced capital 22.5% over the
  century; the majors at 0.94 of vanilla's technology; red flags 140 problem market-years a run.
- **The price path** (§2.1): the ladder works completely in the war and heavy chains (arms, artillery, explosives and steel shed 92–98% of their old
  rung's peak workers) and barely in the consumer chains (glass, motor and textile shed 14–29%; the old rung keeps earning ~21%) — the split is by who
  buys the output (F136). The price indices fell well below vanilla on `canon-c19-in12` (PI 0.84, PP 0.83) but sit near vanilla on the current book
  (PI 0.96, PP 0.94 — F247).
- **Play speed** (§3.4): the wm99 book read ×1.18 of the summer vanilla and ×1.09 of the same days' (F247, F248) — thin (two counting runs).
- **The 1.0 canon (post-polish) is being measured** by the alternating vanilla + canon batch (n=16 + 16; sessions `20261021_224949_…` and
  `20261023_161802_alt-vanilla-canon-rest20`): its century and its wall clock in one.
- **Known open problems:** the price path and the old rung in the consumer chains; one broken seed in three to four (runoff or a stalled USA/Britain —
  F166, F227, F247); Britain near capital abundance in most healthy seeds; military technology ~10 behind vanilla's count with no tech-era-5 military
  technology held anywhere (deferred to mod 1.1, with the user's AI-weight approach); the play-speed budget. The live list is `BACKLOG.md`.

## 4.3 Lineage

One line per canon; the reasons are in the § named. The files of every former canon are kept as records.

| from → to | book | what changed | § |
|---|---|---|---|
| …→ 2026-09-05 | six-rung `solver2f` (`config/mod_config.six_rung.json`) | inverse-solved six-tier book; retired, CLOSED for good 2026-09-16 (UI bloat, not economics) | 10.65.9, 10.80 |
| 2026-09-03 | `canon-4rung` (declared beside the six-rung canon) | first four-rung book; frozen record | 10.69 |
| 09-05 → 09-06 | `canon4v` | four rungs built from vanilla alone | 10.72, 10.74 |
| 09-06 → 09-18 | `canon4v-hai3` | ai_value 1000 × 3^tier, investment-pool defines; regenerated under the tier rule 09-13 | 10.75, 10.78 |
| 09-18 → 09-20 | `canon-c19-in12` | A 2.2 / B 1.5, cost × 1.9^tier, in0 1.2, 24-month bar | 10.84 |
| 09-20 → 09-23 | `canon-c19-in12-elec` | + the urban-centre electricity override | 10.43.0 |
| 09-23 → 09-25 | `canon-slide-b158` | anchor slide on eight industries, mild spending set, B 1.58; finish boost from 09-24 | F158, F160 |
| 09-25 → 09-27 | `canon-b164-trade` | B 1.64, per-good trade weights ×1 | 10.88 |
| 09-27 → 09-29 | `canon-dams` | dam megaprojects, power plant ×4 | 10.89 |
| 09-29 → 10-12 | `canon-dams-family-nolog` | family survey / build rules | 10.89.12 |
| 10-12 → 10-13 | `jex-dam4s-rs` | the artmerge arm (crafts + merges, t1 anchors) + research rework + resource-slot dams + script-placed entries | 10.99 |
| 10-13 → 10-16 | `jex-dam4s-rs-x25` | one innovation parameter x = 25 | 10.101.1 |
| 10-16 | `jex-dam4s-rs-x25-dpriv` | + private dam construction | 10.89.14 |
| 10-16 → 10-21 | `jex-dam4s-rs-x25-m10ac-dpriv` | engines unlifted, conditional merge-host desire | 10.101, 10.91.2 |
| 10-21 → | `jex-dam4s-rs-x25-m10ac-dpriv-wm99` | world-market monopoly threshold 0.99; the polish rulings | 10.102 |

⚠ **Returning to the pre-artmerge family would need the performance changes reimplemented** — those books carry neither tick-cost fix (resource-slot
dams, `dams.layout = resource4`; trigger-placed research entries, `research_events.placement = script`; F220/F221).

## 4.4 Changing the canon

- A canonisation is a user ruling. The named copy is written first, the change proven by **field diff** against the previous canon (only the intended
  keys move), then copied verbatim over `config/mod_config.json` + twin, built, linted and deployed; record the sha256 and the ruling in BALANCE_FRAMEWORK
  and BACKLOG.
- A named book is the record of what was MEASURED: never overwrite it to carry a later change — make a new name.
- Regenerate a book through its recorded chain (`_ab.command`, the `_*_variant` records), never by hand edits. `make_ab_config.mjs` and the `make_*_config.mjs`
  makers are catalogued in `REPO_GUIDE.md`. ⚠ Almost every intermediate book of the canon's chain is gitignored, so a full regeneration starts from
  the structure: `TIER4_SUFFIX=tier4-e1 node tools/make_tier4_config.mjs --derive motor`, then `make_tier4_techs.mjs`, then the recorded commands in
  order. A change made from an intermediate copy can pick up a stale tree twin — prove the result by field diff.
- ⚠ **While the alternating batch runs** (from 2026-10-21): nothing may be canonised into the named copy, and no emitter, `build.ps1` or `tools/testbed/**`
  file may be edited in the checkout the batch runs from — the scheduler rebuilds the mod before every run.

---

# Part 5 — Rules, notes and caveats

## 5.1 Hard rules

**Game content**
1. **Never unlock DLC content** — Paradox prohibits it. Every DLC's gameplay ships in the base game folder behind `has_dlc_feature` triggers and the
   `dlc = dlcNNN` field of events. A vanilla file the mod copies keeps every gate; a building, method or company generated from a vanilla template keeps
   the template's gates (`unlocking_principles` included); any script of ours that fires or grants DLC content carries that content's DLC condition.
   `tools/check_dlc_gates.mjs` fails the build if a shipped vanilla-path file loses a gate (L39).
2. **Edit the config, never the generated files.** Everything under `mod/common`, `mod/localization`, `ui/data.js`, `ui/vanilla.js`, `ui/presets.js`
   is overwritten every build. The only hand-maintained file in `mod/` is `.metadata/metadata.json`.

**Measurement**
3. **A run's configuration is unambiguous before it launches.** State back, and get agreement on: which ARM (`{kind: control}` = vanilla + telemetry
   and nothing else, ever; `{kind: config, config: <path>}` = which book; an overlay is not a control), **which book a new config branches from**
   (never assume — a wrong base cost a whole century batch, F234), the span, n, the metrics and what is compared against what. A probe of how the
   ENGINE behaves belongs on vanilla + telemetry (our content would confound it); a probe of how OUR economy behaves belongs on the config. Write the
   arm and the prediction in the schedule's `_why`, and name the arm in every finding it produces.
4. **Never launch a game run without the user's explicit go-ahead,** and ask for the whole batch, branches included, in ONE request, quoting the cost as
   `<count> × <span>` with a time (a 1836→1936 run is ~3–3.5 h: the canon's book 194 min, the same days' vanilla 178.5 min, F247/F248). Permission for
   one batch is not permission for the next. **An allotted window is a standing go-ahead** for probes and short tests inside it: run the measurement
   instead of asking; a window never ends sooner than 12 hours after the last reply, a status request does not end it, and no long test starts with
   under 3 hours of it left.
5. **All measurement goes through `tools/testbed/run_schedule.ps1`** (never `build.ps1` directly for test data), launched only through
   **`tools/testbed/launch_detached.ps1`** called directly from the PowerShell tool
   (`& 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\run_schedule.ps1' -ArgumentList '-Schedule','<spec>' -NoExit`) — never
   `Start-Process`, never wrapped in `powershell -File` (L30) — and confirm the session folder appears within a minute.
6. **Smoke-check every run about 5 minutes after it starts:** our init marker in `debug.log`, the game version, the run's OWN error lines (wrap-safe,
   by position, against the vanilla noise catalogue), the clock advancing, the construction mix (`tools/testbed/batch_heartbeat.sh <stamp>`). Run the
   background waiter (`wait_for_session.ps1`) after every launch — never relaunch on DEAD alone, a long harvest looks dead — and on a 2+1 batch arm the
   stop watcher and confirm its `stop_watch.log` exists. Watch live files with short reads only. Details: `TESTBED_OPERATIONS.md` §3–§5.
7. **Never edit `build.ps1`, `telemetry_lib.ps1`, an emitter, a setup's config or anything under `tools/testbed/` in the checkout a batch runs from** —
   the mod is rebuilt before every run, so an edit splits the arms (L10). Queue it until `SCHEDULE DONE`; run `preflight.ps1 -RepoOnly` before
   committing any testbed script while a batch plays.
8. **Every session that ran gets a `VERDICT.md`** (with the session) and a row in the committed `tools/testbed/SESSION_VERDICTS.md` before the
   handover is written. **Sessions are never deleted**, nor the kept save archives (`tools/testbed/saves_*/`, `saves_debut/` above all; only
   `_score_work/` is scratch) — gitignored is not backed up, and a session is a historical observation that no re-run reproduces. Short of disk,
   ask and propose archiving.
9. **Record every batch in `FINDINGS.md`** in the same pass: claim and effect size, arms / n / span / session, the numbers in full, the confidence and
   an explicit "what it does NOT say". Check the next F-number at the moment of writing.

**Repo and docs**
10. **Keep the docs in sync with reality, in the same pass as the change** — behaviour, structure, numbers, conventions. A new coupling to a vanilla
    file or number goes into `ON_GAME_UPDATE.md`. The one exception: a proposal the user is still weighing may lag briefly, with the divergence called out.
11. **Commit with explicit paths; never `git add -A` / `git add .`.** Other sessions write in this repo (FINDINGS above all); check `git status --short`
    before committing and account for every staged path. Never amend or force-push shared history to clean up.
12. **Write prose with the Write/Edit tools, never through bash** — backticks are command substitution and Windows paths lose their backslashes, with
    exit code 0. Read a doc back after editing it.
13. **Ask when a decision is the user's.** Rulings are the user's; a recommendation of yours is recorded as a proposal until ruled.

## 5.2 The documents — what goes where

| doc | holds | write there when |
|---|---|---|
| `CLAUDE.md` (this) | goals, principles, metrics, the canon, hard rules | a ruling changes a principle, the canon moves, a hard rule is added |
| `GLOSSARY.md` | every term and letter, one meaning each | a quantity needs a name (same pass) |
| `BALANCE_FRAMEWORK.md` | every balance ruling, §-numbered, with its reasoning — the source of truth | the user rules on design or measurement |
| `FINDINGS.md` | measured results, F-numbered, numbers in full | a batch or probe establishes something |
| `ROADMAP.md` | the plan, step by step | the plan changes |
| `BACKLOG.md` | every open item, one line each, with status and pointer | an item is found, changes status or closes |
| `POLISH_1_0.md` | the 1.0 polish register | polish items and their rulings |
| `REPO_GUIDE.md` | every file and tool: what it is, how to run it, its traps | a file or tool is added, changed or retired |
| `TESTBED_OPERATIONS.md` | how batches are planned, launched, watched, judged, recorded; the wall-clock procedure | the procedure changes |
| `TESTBED_LANDMINES.md` | defects where nothing fails, each with a detector | a run surfaces a new one (register + detector + proof it trips) |
| `TESTBED_METRICS.md` | what telemetry and the save summaries can and cannot log | a metric is added or verified |
| `MODDING_NOTES.md` | engine and tooling behaviour | an engine gotcha is found |
| `ON_GAME_UPDATE.md` | every coupling to a vanilla file or number; what to re-run after a patch | a new coupling |
| `BUGS_AND_FIXES.md` | root causes of non-obvious bugs | a bug is fixed whose cause would surprise the next reader |
| `TIER_REFERENCE_AUDIT.md`, `MISSING_BUILDING_CONDITIONS.md` | vanilla references the tier split affects; dropped building conditionals | a new case is found (catalogue, do not fix inline) |
| `tools/testbed/SESSION_VERDICTS.md` | one committed line per session's verdict | every session |
| `README.md` | the player-facing setup | the player-facing story changes |

**Not committed, by design:** the **handover** (a baton for the next session: the user's next tasks in order, their motivating measurements and the
traps; replaced wholesale; nothing durable may live only there), the **status board** (an Artifact rebuilt unprompted whenever the picture moves —
start from `tools/status_board.template.html`; tally, open work, waiting on the user, verified working, closed; outcomes in plain words, never bare
references), and the **published UI snapshot** (once published, regenerate with `tools/bundle_ui.mjs` and republish to the same URL after any change
to what it shows; stamp `yyyy-mm-dd, HH:MM UTC`; say in the reply that it was regenerated).

## 5.3 Building the mod

```
powershell -ExecutionPolicy Bypass -File tools\build.ps1            # build mod/ from config/mod_config.json and deploy it
powershell -ExecutionPolicy Bypass -File tools\build.ps1 -DryRun    # full build into a throwaway folder, linted, deleted; never deploys
powershell -ExecutionPolicy Bypass -File tools\build.ps1 -SaveTo x -Config config\mod_config.<book>.json   # build an alternate book into mod_x/
```
Other flags: `-NoDeploy`, `-NoLint`, `-ControlOnly` (vanilla + telemetry; requires `-SaveTo`/`-DryRun`), `-Overlay`, `-Telemetry <spec>`, `-NoPreflight`
(only for a broken detector). Node ≥ 24 is required; `VIC3_GAME` overrides the game path. The build order and every emitter are in `REPO_GUIDE.md`.

- **What a build does:** regenerates every `mod/common` and `mod/localization` file from the config, converts the 1836 start, emits the technology tree,
  research entries, secondaries, companies, dams, goods, references and overrides, then runs the linters and the landmine preflight. Any of these throws
  and stops the build: the solvency linter (L18), the tech-content linter, the start-conversion linter (L13), the tier-rule linter (L31), the
  production-method combination linter (`lint_pm_combos.mjs`, §5.4), the DLC-gate check (L39), the reference scan (L40), `Invoke-ModChecks` and
  `preflight.ps1`. `lint.sh` prints LINT PASSED (break-even vs ladder) and NEGATIVE-GOODS CHECK PASSED; its result is printed, not enforced.
- **An alternate config needs its tree twin** `config/tech_tree_options.<suffix>.json`, or the build dies in `emit_techs.mjs` (L20). Never "fix" this by
  falling back to the canonical tree.
- **The config is stored minified**; edit it with the balance editor or JSON-aware tooling. It holds ACTUAL per-throughput volumes. `target_be` is a
  derived drift guard (the output price, % of base, at which the rung's base recipe under its most basic secondaries covers inputs + wages), not a design
  input. An industry-level `disabled: true` hands the industry back to vanilla; every reader loop must skip disabled industries (L27).
- **Deployment** is a real copy (`robocopy /MIR`) of `mod/` to `Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul` — a junction does not work.
  Restart the Paradox launcher to rescan; the mod name carries `(built yyyy-MM-dd HH:mm)`.
- **After an in-game load, read `error.log`** (MODDING_NOTES); the linters check economics, not engine errors. The build emits a self-diagnostic on_action
  that logs `PM_TECH_REHAUL: init OK … (build <ts>)` to `debug.log` at game start; add a `PM_TECH_REHAUL WARN` tripwire there when a change could break
  something no linter sees.
- **The landmine register** (`TESTBED_LANDMINES.md` + `tools/preflight.ps1`) enumerates defects where nothing fails — each with an ID and a detector that
  `preflight.ps1` walks in every build and before every batch. A new one: register entry first, then `Test-Lm<ID>`, then prove the tripwire trips by
  breaking it on purpose. A comment in the right place is not a guardrail, and a detector outperforms a hand pass.

## 5.4 Content rules — what bites when changing the mod

- **The production-method combination rule is HARD** (§10.93, `tools/lint_pm_combos.mjs`, throws): no legal combination of one method per group takes
  any input good, output good or profession's employment below −0.011; no DEAD method (one gated on main methods its building lacks — the game still
  SHOWS it, greyed, at its own numbers); no 1836 history block naming a method its building lacks (the engine rejects the whole block); no secondary
  beside a main method the pair-by-pair review (`tools/lib_secondary_compat.mjs`) marked incompatible; no labour-saving method on a craft rung; no group
  offering only "off"; a mandated automation is the only choice beside its main method.
- **Never mark a PM-gated copy `is_hidden_when_unavailable`** — the player can then never select it.
- **`create_building` is gated on the STATE OWNER's technology and fails silently** — whoever `add_ownership` names (L14; check at 1836.2.1, not a year
  later). A building with no `ownership_type` cannot be built in a foreign state.
- **Own a vanilla file only when changing it**, and assert every transform's match count (a no-op must throw). A mod `effect` block on a VANILLA on_action
  replaces vanilla's (L22). An out-of-range define is rejected at load and the key keeps vanilla's value (L33); some vanilla defines are dead — the engine
  does not read them (F241); `game_defines` refuses the known dead ones.
- **AI subsidies are set only through the strategies' `subsidies` blocks** (a scripted `set_subsidized` is undone by the AI); the builder owns
  `01_admin_strategies.txt` only when the book sets a policy.
- **Companies** (§10.64): every tiered rung is added to every company that has the industry; `building_<key>_throughput_add` modifier types are
  hand-enumerated in vanilla and must be declared for each new key (`emit_companies.mjs`). Craft and merged keys stay out.
- **Vanilla script that names a tiered industry** (a rung-0 key, a moved method, a throughput modifier) is rewritten to the ruled rung set by
  `emit_vanilla_refs.mjs` (`TIER_REFERENCE_AUDIT.md`); the build scan throws on an unhandled reference (L40). A new class of affected reference is
  catalogued in the `MISSING_*`/audit docs, not fixed inline.
- **A merged rung is not a building type.** It carries `method_of: <host key>`: the build emits no building for it, its main method joins the host's
  main group gated by its own technology, and the host carries the midpoint cost and the conditional desire. Every emitter follows (secondaries,
  research counts by `has_active_production_method`, companies keep merged keys out, the 1836 converter throws on a block landing on one). ⚠ The save
  summaries cannot tell the two rungs apart by building type: a merged rung's levels are the host's `pms` entries for its method
  (`tools/testbed/ledger/merge_methods.mjs`). The register's T0–T3 split hosts by method; the old-rung census readers still count by building type.
- **A craft rung** is a 500-worker rung (`workforce_mult` 0.1 on a 5,000-head staffing block) in `bg_pmr_crafts`: per-worker readers must count it so
  (a level is 500 heads, not 5,000); its minted secondaries' employment is scaled with it, and labour-saving methods are never carried on it.
- **Localization is generated for all 11 languages** (an untranslated key shows as a raw placeholder). Tiered building and method names reuse vanilla's
  own translations; genuinely new names stay English. No ASCII `'` in any text a progress bar displays (the tooltip pastes it into a single-quoted
  argument).
- **Building names** read `Tier N. <vanilla building> (<vanilla method>). Recipe BE <n>%` — N is the rung's tier, never its position (an industry
  legitimately starts at Tier 2); the break-even is goods-only, at base prices, under the most basic secondaries. Crafts read `Tier 0 craft. …`; a merged
  building is named by its tier span and building alone with one break-even per main method (`Tier 1-2. Paper Mills. Recipe BE 63%/47%`). Every main
  production-method group is titled "Base" (vanilla's own `$pm_base$`).
- **The 1836 start** is converted by `tools/convert_history.ps1`; a book's manual overrides live in the file its `start_exceptions_file` names
  (`force_tier`, `force_industry_tier`, `remove`, optional `owner`, naming rungs by `era`). The canon names `config/start_exceptions.vanilla.json`, an
  EMPTY rule set — its start is vanilla's, converted; the 22-rule `config/start_exceptions.json` is the six-rung book's; `config/start_baseline.json`'s `unmapped` list is the patch-drift alarm.
  Rebuild after every game update.
- Engine and tooling behaviour (load order, localization, metadata, the research-bar tooltip, what script content costs the tick, PowerShell 5.1 traps):
  `MODDING_NOTES.md`. After a game patch: `ON_GAME_UPDATE.md`.

## 5.5 Measuring — how a run works, and the short procedure

**How a run works** (each tool in `REPO_GUIDE.md` §4):
- **Schedule → build.** `tools/testbed/run_schedule.ps1` reads an ordered schedule (`tools/testbed/schedules/*.json`). For every run it rebuilds
  the mod from that setup's book with `build.ps1`, adds the telemetry script (`tools/telemetry_lib.ps1`, the one generator; a control arm is that
  script and nothing else) and a per-run token, and records what was built in `build_state.json`.
- **The game.** `run_observer.ps1` enables that mod (`content_load.json`) and starts `victoria3.exe -handsoff -run_until=<date>`: an observer
  game from the 1836 bookmark that plays to the date and quits by itself, with no launcher and no player. A crash is resumed from the run's own
  autosaves (the resume feeder, L32).
- **Instrument 1 — telemetry, the process.** The mod's own script writes token-stamped lines to `debug.log`: market order books and prices at
  the dump dates (and every 1 July for the red flags), events, research-entry completions. The game's logs are a small rotating ring shared by
  every run, so the observer mirrors them continuously into `logs_live/` (the authoritative copy) and harvests `markets.tsv` and `events.tsv`.
- **Instrument 2 — the saves, the state.** Autosaves (yearly in a century batch) are copied into `saves/` as they appear and melted with
  `rakaly` into one summary per save in `save_summaries/`: per country GDP, population by profession, buildings by type (levels, staffing,
  profit, active methods), budgets, companies, trade, laws, per-state labour (TESTBED_METRICS §7½). A save is deleted once its summary
  verifies, so the summary is then the record; each run's newest save is kept, and a slowdown episode's saves are quarantined for debug-mode
  inspection (TESTBED_OPERATIONS §7.6).
- **Which answers what.** The register's GDP, W, U\*, H and T0–T3 come from the save summaries; PI, PP and the order books from `markets.tsv`;
  research entries and events from the logs; play time from the observer's tick lines in `run.log`.
- **Beside the run:** the background waiter (wakes the agent: DONE / RUNNING / DEAD / STALLED), the stop watcher (2+1 batches: drops `STOP`
  after a broken run), the machine-load monitor (started by the scheduler, `machine_load.tsv`), the heartbeat script.
- **After the run:** `preflight.ps1 -Session` walks the post-run landmines, `criteria.mjs` reads the register, `fill_ledger.sh` builds the
  report. The session folder's layout is TESTBED_OPERATIONS §8.6.

**The short procedure.** Full procedure: **`TESTBED_OPERATIONS.md`** (§1 before a batch · §2 arms and schedules · §3 launching · §4 the smoke check and the error-noise
catalogue · §5 while it runs · §6 deciding between configs · §7 the wall clock · §8 after a batch · §9 changing the harness). Engine behaviour of
headless runs: MODDING_NOTES §"Automated headless runs".

1. **Plan:** agree arm, base book, span, n, metrics and comparison (§5.1 rule 3); write the predictions into the schedule (§2.8); get the go-ahead.
2. **Batches are decision-driven:** the **2+1 quick config test** — two runs of one config, a third only where the two diverge, then the next config as its
   own schedule. Configs are never alternated — except to measure the WALL CLOCK, where both arms must run in the same days (the alternating batch). A run of
   a 2+1 batch that breaks a hard register line is that config's last run (the stop watcher); a long predetermined batch plays every run.
3. **Launch** detached, start the waiter, arm the stop watcher where it applies, and smoke-check at ~5 minutes (§5.1 rules 5–6).
4. **While it runs:** touch nothing it rebuilds from (§5.1 rule 7). Reading its files is fine. Keys in its console: `p` pause · `r` resume · `s` stop after
   this run · `x` stop now; `tools/testbed/STOP` and `tools/testbed/NO_NEW_RUNS` are the file twins. A crashed run resumes from its own autosaves.
5. **After:** read the register (`criteria.mjs`), fill the ledger (`tools/testbed/ledger/fill_ledger.sh`, README beside it), write the red-flag summary,
   the wall-clock clusters, the VERDICT.md, the SESSION_VERDICTS row and the finding.

⚠ `error.log` is a shared ring with vanilla's own noise (navy-model laws on landlocked countries, interest-group leaders, invalid country handles,
loc-string data errors, battle sizes …): count against the vanilla baseline, filter by the run's own POSITION in the file, and check
`grep -c zzz_pm_rehaul` — every file we emit is named that way. The catalogue is in `TESTBED_OPERATIONS.md`.

## 5.6 Analysing and reporting

- Quote **profit in £** (§2.10) and ratios with both terms (§2.11); say which **baseline** and which **markets** a number rests on (§3.5).
- World GDP is the **displayed** figure; GDP at base prices is a secondary reading only (§10.90). The displayed GDP is `52 × weekly value added`
  (outputs − inputs; pops and trade on neither side — F45), and over a century it tracks value added at BASE prices within 0.94–1.08, so the mod's
  lower prices take only ~7% off the world's (F178 §9.4). Never calibrate on gross output: its ratio to GDP drifts ×48 → ×37 across the century.
- A payback in years needs a £ per construction point, and that depends on the construction method: wooden 1000 · iron frame 720 · steel 540 · arc
  welded 527 (F53). Say which rate a payback uses.
- Read quantities, not prices, where a good sits at the band edge (§2.7).
- The standard batch report is **the ledger** (`tools/testbed/ledger/`), published as an Artifact per batch and copied into the session as `REPORT.html`.
  It carries the register, the verdict table with play speed as a row, the red-flag headline and summary, the obsolescence and old-rung tables, and the
  world and watchlist pages.
- A verdict names what is void, what still reads, and how far; it traces the knock-ons of a defect (war, conquest and research redirect everything) and
  reads the trajectory, not only the endpoint. A retrospective verdict says so.

## 5.7 The balance editor

`balance-ui.cmd` (or `tools/ui.ps1`) serves `ui/builder.html` at localhost:8777; `balance-snapshot.cmd` writes a self-contained snapshot. Three pages:
the balance sheet, the tech tree, the mod-changes page (a read-only view of everything the build emits beyond recipes). The full description — files,
the model the sheet implements, presets, and the UI principles — is in `REPO_GUIDE.md` (the UI section); the player-facing one in `README.md`. Rules
to keep when changing it:

- ⚠ **On a generated book — the canon included — do not edit recipes, costs or `ai_value` in the sheet and do not press Build now / Export over
  `config/mod_config.json`.** The canon must stay a verbatim copy of its named book, and `lint_tier_eras.mjs` (L31) recomputes every rung from the
  book's `_ab` / `_artisan` / `_merge` records, so a hand edit fails the next build. A save from the sheet is never byte-identical to the loaded book
  even with no edit (it adds `input_ratio` to every tier). Change a book through its generator chain (§4.4); use the sheet to read and to explore.
- On the canon the sheet still has known gaps (it does not read `craft` or `method_of`, so a merged rung shows as its own row; the solver-2 book and
  the six-rung preset rows are offered; the tech-tree page shows the six-rung candidate trees) — listed in `BACKLOG.md` §F.
- `ui/econ.js` is THE economic model, shared with the Node solvers; `builder.html` still carries a fork of ~260 of its lines — change both or neither.
- The served sheet opens on the LIVE `config/mod_config.json` (over `/api/config`); `ui/data.js` is a build-time copy for the snapshot and `file://`.
- The sheet is two things: the RECIPE BOOK (what the build emits — written only by the four red buttons) and the SCENARIO (counts, pops, wages, prices,
  PM selections — session-only, never emitted). Scenario presets write no recipes.
- One layout for every building (tiered or not, economic or not); a cell is blank only when the building lacks the thing. Columns align left unless a
  label → value pair needs right alignment.
- A preset is a one-off overwrite: nothing may claim the user is "in" a preset; derived badges are recomputed, never tracked.

## 5.8 Repository map

```
CLAUDE.md, GLOSSARY.md, README.md, BALANCE_FRAMEWORK.md, FINDINGS.md, ROADMAP.md, BACKLOG.md, POLISH_1_0.md,
REPO_GUIDE.md, TESTBED_OPERATIONS.md, TESTBED_LANDMINES.md, TESTBED_METRICS.md, MODDING_NOTES.md, ON_GAME_UPDATE.md,
BUGS_AND_FIXES.md, TIER_REFERENCE_AUDIT.md, MISSING_*.md      the documents (§5.2)
balance-ui.cmd, balance-snapshot.cmd                         one-click editor launcher and snapshot
config/      mod_config.json (the canon) + tech_tree_options.json (its tree twin); every named book mod_config.<name>.json with its twin;
             start rules, measured reference data (1836 professions, wages, pop identity, trade/SoL), the dam tables
tools/       build.ps1 (the builder) and preflight.ps1; the book generators (make_tier4_config, make_tier4_techs, make_ab_config, make_*_config);
             the emitters (emit_*.mjs) and linters (lint_*.mjs, lint.sh); analysis tools; goods_prices.tsv (THE price table)
tools/testbed/          the harness: run_schedule.ps1 (the only entry point), run_observer.ps1, launch_detached.ps1, the waiter, the stop
                        watcher, the save harvest and quarantine, savegame readers; schedules/ (batch specs); sessions/ (results — gitignored,
                        never deleted); SESSION_VERDICTS.md
tools/testbed/ledger/   the batch report and every reader: criteria.mjs, lib_runs.mjs, lib_markets.mjs, misplaced_capital.mjs, wall_clusters.mjs …
tools/research_model/   the research simulation (§10.96)
ui/          the balance editor (builder.html, econ.js, techtree.html; data.js / vanilla.js / presets.js / icons.js generated)
ui2/         the editor pointed at a retired four-rung derivation (record)
mod/         THE DEPLOYABLE MOD — generated; only .metadata/metadata.json is hand-maintained
```
Every file and tool is described in **`REPO_GUIDE.md`**.

## 5.9 The commands used most

Run from the repo root. `<group>` = a session, a comma list of sessions, or `<session>/runNNN_<setup>` folders, optionally `:<setup>`.

| task | command |
|---|---|
| build / dry-run / alternate book | `powershell -ExecutionPolicy Bypass -File tools\build.ps1 [-DryRun \| -SaveTo <name>] [-Config config\mod_config.<book>.json]` |
| walk the landmines | `powershell -File tools\preflight.ps1 [-RepoOnly] [-Config <book>] [-Session tools\testbed\sessions\<stamp>]` |
| launch a batch | `& 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\run_schedule.ps1' -ArgumentList '-Schedule','tools\testbed\schedules\<spec>.json' -NoExit` |
| wait for it (background) | `powershell -File tools\testbed\wait_for_session.ps1 -Session tools\testbed\sessions\<stamp> -MaxMinutes 30` |
| arm the stop watcher (2+1) | `& 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\stop_watch.ps1' -ArgumentList '-Session','<session-name>','-Poll','30' -Hidden` |
| smoke-check / heartbeat | `bash tools/testbed/batch_heartbeat.sh <session-name>` |
| the register | `node tools/testbed/ledger/criteria.mjs --arm <group> [--arm …]` |
| the ledger (batch report) | `bash tools/testbed/ledger/fill_ledger.sh <group> <setup> <book> <outName>` (then the prose, `fill_assemble`, `fill_verify` — ledger README) |
| misplaced capital | `node tools/testbed/ledger/misplaced_capital.mjs --batch <label>:<session>[:<setup>]` |
| wall clock in clusters | `node tools/testbed/ledger/wall_clusters.mjs <label>=<group> [...] [--runs]` |
| red-flag headline | `node tools/testbed/ledger/redflag_metrics.mjs <outDir>` (summary with the `redflag-summary` skill) |
| technology census | `node tools/testbed/ledger/tech_census.mjs <label>=<group> ...` |
| first-run decomposition | `node tools/testbed/ledger/first_run_decomp.mjs --arm <group> --van <sessions>` |
| old rungs per industry | `node tools/testbed/ledger/old_rungs_by_industry.mjs <year> <label>=<group> [...]` |
| one good's order book (quantities) | `node tools/testbed/ledger/good_market.mjs --good <good> --arm <session>:<setup> [--arm …]` |
| merged-rung levels by method | `node tools/testbed/ledger/merge_methods.mjs --session <stamp> [--setup <name>]` |
| stitch a continued campaign | `node tools/testbed/stitch_session.mjs <continuation session> <new session name>` |
| design a ladder / a recipe | `node tools/ladder_options.mjs --book "name:out=2.2,in=1.64,cost=1.9,in0=1.2"` · `node tools/era0_solvency.mjs` · `node tools/full_recipe_profit.mjs --mod mod_<name> --config <book> --economy GBR@1920` |
| generate a book | the recorded `_ab.command` (`node tools/make_ab_config.mjs …`) and the `make_*_config.mjs` makers in their recorded order (§4.4) |

## 5.10 Environment

- The user's machine is Windows: Steam Victoria 3, PowerShell 5.1, Node ≥ 24 (`C:\Program Files\nodejs`); the repo path contains a space. The game, the
  build's deployment and every batch run there.
- A cloud session (Linux, no game) can edit docs, configs and tools, and read anything committed — but session folders (`tools/testbed/sessions/`) are
  gitignored and exist only on the user's machine, and a commit pushed here reaches the batch checkout only when the user pulls.
- `rakaly` melts saves (`rakaly melt --format vic3 --unknown-key stringify -c <save.v3>`); the save summaries are the second instrument beside telemetry
  (`TESTBED_METRICS.md` §7–§7½).
