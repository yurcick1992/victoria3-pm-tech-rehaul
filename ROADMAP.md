# ROADMAP — from a solved economy to a shipped mod

The order below is the project's own numbering, set by the user on 2026-08-10. Step 0 is where the work
has been until now; **steps 1–4 are the MVP**, steps 5–7 are polish before release.

⚠ This file is the PLAN. It is not a status board (those are disposable, see CLAUDE.md) and not a record
of results (that is `FINDINGS.md`). When a step's design settles, its content moves into the relevant
doc — `BALANCE_FRAMEWORK.md` for balance rulings, `MODDING_NOTES.md` for engine gotchas,
`TESTBED_METRICS.md` for instrument work — and the entry here shrinks to a pointer.

---

## Step 0 — THE SOLVER (substantially done, "almost happy")

The five-era ladder, the scenario solve, and the balance UI. Everything the repo does today.
State of play is in `CLAUDE.md` and `BALANCE_FRAMEWORK.md`; the current numbers are the §10.49–§10.51
set (band regime + recipe ratchet + army fixed point).

Everything before it — the balance UI, the builder, the testbed runner and its telemetry — are the
"negative steps": infrastructure that had to exist before a solved economy was possible.

**Not closed.** Step 4 feeds back here: when a telemetry run says the game does not unfold as intended,
the fix may be a recipe, a target, or a constraint, and that means re-solving.

---

## Step 1 — REWORK THE INDUSTRY TECH TREE  ⬅ IN PROGRESS

**Goal.** Give every building tier its own unlocking technology, so that "modernising means constructing
the newer building" has a research gate in front of it that is specific to that industry.

**Why it must come first.** 33 of the mod's 100 tiers are `model_only` today — modelled by the solver,
never emitted — precisely because the game has no technology that could unlock them. The builder cannot
ship them until this step exists. It is also the prerequisite for step 2: an event that rewards an
industry with research progress needs a technology that belongs to *that* industry and nothing else.

**Scale is deliberate.** The production tree will hold **significantly more technologies than vanilla's
57, and more than either of the other two trees.** That asymmetry is the design, not an accident: this
is a mod about industry, and the industrial half of the tree should be where the depth is.

**Constraints discovered while scoping it** (2026-08-10):
- The tech tree is **auto-laid out by the engine** (`TechTreePanel.GetProductionTechTreeItems` /
  `…Lines` in `gui/tech_tree.gui`). Adding techs needs no GUI work — but the **era band dividers are
  hardcoded** (`extra_lines`, y = −100 / 2200 / 4060 for production) and will not match a taller tree.
  That is a step-7 cosmetic fix, not a blocker.
- **Cost is per ERA, never per tech** (`common/technology/eras/00_eras.txt`:
  7500 / 10000 / 12500 / 15000 / 17500). A technology cannot be made individually cheap or expensive.
- ⚠⚠ **The ahead-of-time penalty scales with the SIZE of the tree**, and is the single biggest
  consequence of making the production tree deep:
  `cost(era N) = era cost × [ 1 + F × Σ over earlier eras e of (unresearched techs in e) × (N − e) ]`,
  where `F` = `NTechnology.TECH_AHEAD_OF_TIME_PENALTY_FACTOR`, **0.25 in vanilla**. Doubling the number
  of era-1 production techs doubles the penalty term on every later production tech. This is the
  mechanism that makes a deep tree *punish* a country that neglects industry.
  ⭐ **`F` IS A LIVE DESIGN KNOB, not a fixed cost of the design** (user, 2026-08-10). Defines are the one
  `common/` folder where a partial override in a new file works (MODDING_NOTES → *File loading*), so
  lowering it costs a four-line file. `tools/tech_tree_spec.mjs` sweeps it with `--aot=<F>`.
  The value that holds each option's worst case at **vanilla's own** worst case (542 500) is
  **0.195 / 0.155 / 0.142**; **F = 0.15** is the round number that lands options 2 and 3 at 0.97× and
  1.05× of vanilla.
- A technology's era **must be ≥ the era of every prerequisite**, or the cost calculation misbehaves.
- Localization keys are the tech's script name: `<tech>:0` and `<tech>_desc:0` (vanilla puts them in
  `inventions_l_english.yml`). Our builder emits stubs for all 11 languages, as it does for buildings.
- Vanilla research budget, for calibration: production 57 techs / **697 500** innovation, military 58 /
  722 500, society 64 / 737 500 — **2 157 500 total**, against a weekly innovation cap of
  `50 + 1.5 × literacy` (200/wk at full literacy, before institutions and companies). Nobody finishes
  vanilla's tree; how much of it a country finishes is the thing this step changes.
- Some vanilla buildings are unlocked from the **military** tree (arms industry, artillery foundry,
  munition plant, shipyards, whaling station) or the **society** tree (art academy, urban centre,
  construction sector, university). **Those stay where they are** — user ruling. Their missing rungs
  get new technologies in their own tree, not in production.

**Where it stands (2026-08-10).** Three complete candidate trees are authored in
`tools/tech_tree_spec.mjs`, emitted to `config/tech_tree_options.json`, and viewable in
`ui/techtree.html`. All three cover all 100 tiers plus the vanilla economic buildings.
⭐ **The viewer is now the balance UI's SECOND PAGE** (2026-08-12) — the `Balance sheet` / `Tech tree`
switch at the top left of `builder.html`, embedded in an iframe and carried into the standalone snapshot
by `tools/bundle_ui.mjs`. It remains openable on its own; see CLAUDE.md → `ui/techtree.html`.
⭐⭐ **THE TREE IS SMALLER, TWICE OVER (2026-08-12).** First the **ladder-era alignment** — a technology
unlocking one of our tiers sits in the mechanical era that tier maps to, which 41 of 106 tiers violated
(BALANCE_FRAMEWORK §10.53). Then **eleven merges** (§10.56): where one historical advance reached several
industries, one technology now gates all of them — Bulk Steel, Electric Drive, The Screw Steamer,
Continuous-Flow Production, Magazine Rifles, Percussion Ordnance, Coal-Tar Chemistry, Cellulose Esters,
High-Pressure Steam, Automatic Machine Control, Mass Small-Arms Production. **Railway plateaus at e4** on
the diesel engine; the invented superheating rung is gone.
⚠ **A merge deletes only technologies WE added.** A vanilla one is named by vanilla script — production
methods, journal entries, events, ship modifications, company formation — so merging onto it means
re-pointing our own tier gate and leaving it in the tree. `tools/audit_tech_content.mjs` enumerates what
any technology carries before it is touched. Deleting vanilla technologies and re-pointing their
references is DEFERRED to final polish (user, 2026-08-12: *"in the distant future we won't shy from
deleting vanilla techs"*), and the UI-readability argument for it is accepted.

| | before | after |
|---|---|---|
| production | 92 techs · 1198k · +65% vs vanilla | **84 · 1045k · +50%** |
| military | 76 · 960k · +33% | **72 · 910k · +26%** |
| society | 65 · 755k · +2% | untouched, by ruling |
| new technologies | 54 | **42** |

⚠ **Two consequences flagged and NOT addressed.** Era-5 production fell from 20 technologies to 14, which
changes what "a leader holds half of era 5 by 1940" means and partly re-opens the era-5 hole the re-band
was filling. And the military tree now hands a laggard 34% of itself by 1936 against vanilla's 45% — an
11pp shortfall with no compensation, since its journal entries run on a 26-week war bar rather than the
36-month industry one.
⭐ **OPTION 1, "VANILLA-SHAPED", SHIPS** (user ruling, made without confidence — "I'm really unsure").
The other two stay in the file and the viewer: they cost nothing to keep and a week to re-derive.

**Four structural constraints, user-ruled and enforced by the generator:**
1. **No technology may require a later-era prerequisite.** (Vanilla already satisfies this; so do all
   three options.)
2. **Every technology of era 2 and above must have at least one prerequisite** — nothing floats free in
   the middle of the tree, only era 1 may be a root. (Vanilla satisfies this too; checked, not assumed.)
3. ⭐ **A PREREQUISITE MUST BE IN THE SAME TREE.** Measured, not assumed: **vanilla has zero
   cross-category prerequisites across all 179 of its technologies**, so a technology reaching into
   another tab is something the engine has never been asked to draw. This is the constraint that decides
   which industries may be *shifted* between trees at all — a shifted ladder must re-root on
   technologies of its new tree, and one that cannot re-root cannot move.
4. **NO FULLY EMPTY TECHNOLOGY.** One we add must unlock something *or* carry a modifier — a technology
   that costs innovation and does nothing is a toll, not content. Effects other than a building unlock
   are fine, but they must be **explicit**. Scoped to ours on purpose: vanilla ships several genuinely
   empty ones (`screw_frigate`, `monitor_tech` and `admiralty` have modifier blocks containing only
   comments), and repairing those is a separate decision from not committing the fault ourselves.
   ⚠ The generator also **validates every modifier name against `common/modifier_type_definitions`** and
   throws on an unknown one — an invented modifier does not error in game, it silently does nothing,
   which would recreate the empty technology it was added to prevent. This check caught 10 on its first
   run (option 3's whole platform layer).

**Two vanilla technologies move to era 1** (user ruling 2026-08-11), the two worst datings in the tree:
`atmospheric_engine` (Newcomen **1712**, sitting 124 years after the fact in era 2 — and in our tree it
is what gates the engine works) and `crystal_glass` (Ravenscroft **1674**, 162 years). Both keep
prerequisites that are already era 1, so neither creates an inversion. Nearly free in practice: vanilla
already hands `atmospheric_engine` to the tier-1 and tier-2 starting countries by name and grants them
era 1 wholesale, so nothing changes for the powers and it gets cheaper for everyone else.
**All other datings are left as they are** — they will be tuned against telemetry anyway.

⛔ **NO FILLER TECHNOLOGIES, AND NO MODIFIER CREEP** (user ruling 2026-08-11). An earlier pass added 22
modifier-only technologies to the military and society trees purely to absorb a spread boost. They were
**removed**. Modifiers are added only for a strong game-design or narrative reason where vanilla has a
real gap — never to give a technology something to do. The spread problem they existed to solve is
solved properly in step 2, by a per-category multiplier.

⭐ **INSTEAD, INDUSTRIES MOVE BETWEEN TREES — and only where it genuinely reads.** ⭐ **THE PORT LADDER
IS MILITARY** (user: "ports being in the military tree complement this idea very naturally"). This is
vanilla's own logic rather than a stretch: `hydraulic_cranes`, `gantry_cranes`, `floating_harbor` and
`concrete_dockyards` are **already military technologies**, so dock engineering was never in the
production tree to begin with. All four port technologies re-root cleanly onto them.
⚠ **Electrics was considered and rejected** on exactly the constraint below: telephony reads as
communications and society already owns `mass_communication`, but a telephone works cannot stop
requiring `electrical_generation` merely to sit in another tab.

**Every technology now carries a NARRATIVE ONSET** — the year the thing it names was first practically
available — for all 239, vanilla included, checked against its era's calendar window. 25 conflicts, of
which 5 are ideas dated by first articulation and gated by mainstreaming (which is correct design, not a
fault). See `tools/tech_tree_spec.mjs`'s ONSET table and the report it prints.

**Deliverable of this step:** a chosen tree, emitted by the builder into
`mod/common/technology/technologies/`, with every tier's `tech` field in `config/mod_config.json`
pointing at it and the `model_only` flags gone. Plus, in the same pass:

- The new era-1 technologies added to `effect_starting_technology_tier_3..6_tech` wherever the 1836
  start places the matching building (see the constraint above).
- ✅ **ICONS — SOLVED, the builder can mint its own.** Vanilla's invention icons are **256×256, 32-bit
  A8R8G8B8, uncompressed, with 9 mipmaps** (read off `manufacturies.dds`). Mipmaps are optional and a
  single surface is a legal DDS, so a placeholder is a 128-byte header plus raw BGRA — **no image
  library and no Paradox art**. Prototyped and byte-compared against vanilla: magic, header size,
  dimensions, pitch, pixel-format flags, bit count and all four channel masks are identical; only the
  mipmap flag and `dwCaps` differ, exactly as they should for a single-surface texture.
  ⇒ Ship **one shared placeholder** (red cross on yellow, ~256 KB) referenced by every new technology
  rather than 38 near-identical copies: it makes "no art yet" obvious at a glance and is one file to
  replace. Per-tech art is a step-7 job, and any technology can be pointed at a fitting vanilla icon in
  the meantime for nothing.
- 🔍 **OPEN INVESTIGATION — HOW DEEP CAN `ai_weight` REACH?** (user, 2026-08-11.) It is a script value
  block, so arbitrary triggers are *syntactically* allowed — but that is not the same as them being
  evaluated when it matters. What has to be established before step 2 relies on it:
  1. **When is `ai_weight` evaluated?** The user's understanding, to be confirmed: the AI **never
     queues** — it picks one technology from those whose prerequisites are met, and once started it
     **runs that technology to completion**. If so, `ai_weight` matters only at the moment of choice,
     and a dynamic condition inside it is read once per decision rather than continuously. That makes a
     condition like "do I own a lot of steel mills?" perfectly usable, but it also means a weight that
     changes mid-research does nothing until the next pick.
  2. **Do dynamic triggers actually work there**, or is the block evaluated once at load? Vanilla's own
     weights use `has_strategy` and `country_rank`, both of which change during a campaign — evidence
     for dynamic evaluation, not proof.
  3. **How expensive is a heavy trigger** evaluated for every country × every available technology?
     A building-count scan is not free, and this is the tree that just grew by 24 technologies.
  ⇒ Answerable in the testbed by watching an AI country's selection against a weight that only its own
  industry could satisfy. Do this **before** writing the step-2 weights, not after.
- ⚠ **`ai_weight` STILL NEEDS AUTHORING.** Vanilla leans on `value = 1`; on a tree this deep that
  scatters the AI more than it does in vanilla (`TECH_RANDOM_FACTOR = 1.0`). It is also where step 2's
  "the technology's weight reads the industry the country owns" clause lives, so both should be written
  in one pass rather than twice.
- ✅ **DONE — the stale tier BUILDING NAMES are fixed** (2026-08-10). They had been inherited from the
  vanilla production method that used to occupy the slot and several no longer described it. **11 tiers
  renamed** in `config/mod_config.json`: paper e2 → *Machine Paper Mills* and e3 → *Sulfite Pulping
  Paper Mills* (they were off by one rung), glass e1 → *Coal-Fired Glassworks* and e3 → *Tank Furnace
  Glassworks*, tooling e4 → *High-Speed Steel Tooling Workshops*, explosives e3/e4/e5 → *Dynamite* /
  *Ostwald Process* / *Continuous Nitration*, fertilizer e2 → *Superphosphate Plants*, textile e2 →
  *Calico Printing Textile Mills*, food e2 → *Beet Sugar Food Industries*.
  ⚠ Only `name` and `pm_name` moved. **`vanilla_pm` is untouched** — it is the 1836 history converter's
  mapping key, and renaming it would silently mis-tier every starting factory.
- ✅ **DONE — five vanilla technologies get a new DISPLAY NAME**, because the slot they gate is not the
  thing they are named after (user ruling: "don't leave the vanilla name at all if the tech means
  something drastically different"). The KEY stays in every case — 457 vanilla references depend on
  those — and only our localization changes: `crystal_glass` → **Lead Crystal**, `electrical_capacitors`
  → **Alternating Current**, `pumpjacks` → **Oil Drilling**, `threshing_machine` → **Steam Threshing**,
  `dough_rollers` → **Mechanised Bakeries**. Two of these also *fix* a dating absurdity: a pumpjack is
  1925 and gates an era-3 oil rig, a threshing machine is 1786 and gates era-3 steam threshers.

### ⭐⭐ STEP 1b — THE ANCHOR RE-BAND (specified 2026-08-12, NOT yet written)

The governing principle is in `CLAUDE.md` (*the era anchors are authoritative; technologies and
industries are calibrated to them, never the reverse*). This is the concrete change that brings the
tree to it. **Nothing below is implemented yet** — it is a specification the user has ruled on
clause by clause, held back only by the sequencing constraint at the end.

**The anchors, user-ruled:** **1750 / 1830 / 1870 / 1900 / 1925 / 1940** for our eras 0–5, with band
boundaries **1790 / 1850 / 1885 / 1912 / 1932**. Six of our eras ride on the engine's five, ours 0
and 1 sharing mechanical era 1. The anchor means *a technology leader holds about half of that era's
technologies at the anchor year* — so era 0 sits far before the game starts and era 5 slightly after
it ends, and finishing a tree should need luck, a strong nation and some neglect of the other trees.

**1. Today's e0 and e1 merge by SPREADING, not doubling.** An industry that currently holds two rungs
below 1850 keeps both, one per era — it does not end up with two era-0 buildings. After this no
industry has more than one rung in any era, which is the invariant the ladder already claims.

**2. Steel loses its era-0 rung.** `building_steel_mill_bloomery` is dropped outright: its good has no
buyer of any kind that early, which is exactly why `ERA_PRUNE` already carries `steel@0`.
⚠ `steelworking` is **not orphaned** by this — it stays era 1, keeps `shaft_mining` as its
prerequisite, is still required by `bessemer_process` and `mechanical_tools`, and still unlocks
vanilla `pm_pig_iron` / `pm_saw_mills` / `building_steel_mill`.

**3. `building_steel_mill` (blister steel — today's era-1 rung) gets a MANDATED SOLVER EXCLUSION**
(user ruling: *"we must mandate a solver exclusion for it to avoid it being built"*), and **dropping it
too goes on the long-term todo.** ⚠ Named by BUILDING, not by era number: under the new bands its
`tech_year` of 1745 puts it in era 0 beside the bloomery, so "the era-1 rung" is only true of today's
numbering.
The building itself has to survive for now — the 1836 map contains steel mills, so the history
converter needs a tier to map them onto — but no scenario may place it.
⚠ **The mechanism already exists and is NOT `EXCLUDE_REF`.** `EXCLUDE_REF` (gold mines, rice farms)
holds *vanilla reference* buildings. Ours are governed by **`ERA_PRUNE`**, whose spec is
`industry@scenarioEra` and whose shipped default is `steel@0,glass@0` — so the exclusion is
**`ERA_PRUNE=steel@0,steel@1,glass@0`** as the new default, one line in `tools/era_scenarios.mjs`.
⚠ Two things to check when it is applied, neither yet done: `ERA_PRUNE` prunes a whole **industry**
at an era rather than a single rung (harmless here, since era 1 is the only scenario that could hold
the e1 rung once e0 is gone), and the 1836 scenario then contains no steel at all against a map that
holds 6 levels of it — small, but it is a divergence from the "1836 stays close to vanilla" premise
and should be stated rather than discovered.

**4 & 5. THE LADDER IS RE-BANDED, SEVEN RUNGS DROPPED AND FIFTEEN ADDED — BUILT 2026-08-12.**
The provisional tables that stood here (five new era-1 technologies, eight new rungs) are **superseded
by what was actually authored**; both were earlier iterations that did not survive the arithmetic. The
ladder now runs **105 tiers over 22 industries — 11 / 17 / 19 / 21 / 21 / 16 per era** (the re-band
authored 106; one invented e5 rung was dropped in a later pass — `build_era_ladder.mjs`'s own summary
line is the authority), with one rung per
era per industry, no interior gaps, and every tier's `tech_year` inside its era's band. Bold = new rung:

| industry | e0 | e1 | e2 | e3 | e4 | e5 |
|---|---|---|---|---|---|---|
| food | 1750 | 1815 | 1860 | **1909** | 1920 | *plateau* |
| textile | 1780 | 1830 | 1855 | 1905 | **1925** | *plateau* |
| furniture | 1780 | 1830 | 1855 | **1900** | 1923 | *plateau* |
| glass | 1750 | 1832 | 1867 | 1910 | 1926 | **1938** |
| tooling | 1770 | 1830 | 1865 | 1901 | 1927 | **1936** |
| paper | 1750 | 1830 | 1874 | 1890 | **1925** | 1935 |
| fertilizer | — | 1842 | **1865** | 1885 | 1913 | 1935 |
| explosives | — | 1820 | 1867 | 1908 | 1928 | **1940** |
| steel | 1745 | *no buyer* | 1856 | 1885 | 1912 | 1932 |
| motor | — | 1820 | **1860** | 1893 | 1912 | 1935 |
| shipyard | 1700 | 1845 | — | — | — | *extinct* |
| shipyard_steam | — | 1843 | **1875** | 1903 | 1913 | 1941 |
| automotive | — | — | — | 1899 | 1913 | 1936 |
| arms | 1770 | 1849 | 1866 | 1886 | **1915** | 1938 |
| artillery | 1750 | 1830 | 1861 | 1897 | 1925 | **1936** |
| munition | — | 1830 | 1875 | 1895 | **1915** | 1940 |
| synthetics | — | — | 1857 | 1897 | 1912 | 1939 |
| electrics | — | — | 1878 | **1901** | 1920 | 1935 |
| power | — | — | — | 1900 | 1920 | 1932 |
| port | 1700 | 1840 | 1875 | 1908 | 1930 | *plateau* |
| railway | — | 1825 | 1867 | 1895 | **1915** | 1934 |
| art_academy | — | 1800 | 1850 | 1885 | 1912 | 1932 |

**Seven ~1700 rungs dropped.** Under the new anchors an invented ~1700 tier and a real ~1750
vanilla-anchored one both fall in era 0, and no industry may hold two rungs in one era. The invented one
goes in every case — it is ours rather than vanilla's, and the user had already ruled the steel instance
that way. ⭐ **This restores the vanilla building key to slot 0 in nine industries, which is the root
cause of landmine L13**, so the re-band and that bug fix pull in the same direction.

**Fifteen rungs added**, each naming a specific historical step rather than filling a column: fat
hydrogenation (1909), long-draft spinning (1925), plywood furniture (1900), glass fibre (1938), tracer
control (1936), semi-chemical pulping (1925), by-product ammonium sulphate (1865), RDX (1940), compound
steam engines (1860), steel hulls (1875), light machine guns (1915), automatic anti-aircraft (1936),
shell filling (1915), wireless telegraphy (1901), superheated locomotives (1915).

**Where no rung could be justified the industry PLATEAUS instead**, per the ruling that gaps are bad but
late onsets and plateaus are fine. **Port is a plateau again** — its mechanised-cargo tier is a 1930
building and therefore era 4, and the next real step is containerisation in 1956.

**Eleven dates moved**, all forced by one-rung-per-era and all recorded with their reasoning in the
SPEC's own notes: textile and furniture manufactories 1800 → 1780, arms rifles 1853 → 1849, steel open
hearth 1868 → 1885 and electric arc 1903 → 1912 and strip mill 1926 → 1932, motor diesel 1904 → 1912,
synthetics viscose 1905 → 1912, power oil-fired 1925 → 1932, fertilizer reforming 1931 → 1935, paper
high-speed 1930 → 1935, and art academy photography 1839 → 1885 / film 1896 → 1912 / sound 1927 → 1932.

⚠ **Steel's era-1 gap is deliberate**, not an oversight — era-1 steel has no buyer of any kind, which is
the same fact clause 3's `ERA_PRUNE` exclusion states.

**Three guards now enforce all of this at authoring time**, because nothing downstream compared an
authored era against its own date: a tier whose `tech_year` falls outside its era's band throws, two
tiers in one era throw, and the arrival-order check already present still throws. Two tooling defects
were fixed to get here — see *Deferred fixes* and the commit log.

**THE SOLVE — RUN AND CONFIRMED, 2026-08-12.** Two consecutive `era_scenarios --write` runs on the
re-banded ladder came back **byte-identical outside the RECIPE MIX line**, and the second printed *"no
tier reads its mix from the previous run"* — so this is a **strict fixed point**, not a transitional
state, and it is comparable to the shipped numbers.

| | re-banded (106 tiers) | shipped (100 tiers) |
|---|--:|--:|
| final-state illogicality | **63** (57 excl shipyards) | 57 (54) |
| per era | 4 / 4 / 9 / 13 / 15 / 18 | 3 / 5 / 7 / 12 / 15 / 15 |
| — **loss** family | **8** | 12 |
| — inverted | 8 | 6 |
| — stale-profitable | 41 | 36 |
| net | £20.2M/wk | £20.1M |
| losses | £136k/wk (0.7% of net) | £138k |
| industrial ceiling | **clear, all six eras** | clear |
| macro residual breaches | 23 | 19 |
| recipe monotonicity | 5/84 (all rounding, 4.02→3.99) | 3 |

⭐ **Read against the ruled severity ordering this is a net gain, not a regression.** A top rung *losing
money* is the very bad fault and it falls **12 → 8**; an *inverted* ladder is the middling one and rises
6 → 8; *obsolete-not-phased-out* is the tolerable one and takes the growth, 36 → 41. The headline number
going up is that trade, and it is the trade the severity ordering asks for.
⭐ **Losses on NEWEST rungs are £1k / £4k / £603 / £620 / 0 / 0 across the six eras** — the fifteen added
rungs pay for themselves, and eras 4 and 5 carry no newest-rung loss at all. What loss remains is
subsistence (£22–38k in the late eras) and stale tails, which is the design working.

**Two honest residuals, neither hidden:**
- ⚠ **Dominant rungs sit 37.5pp off the band on average (57/105 within 8pp)**, against 23.5pp shipped.
  The re-band moved every recipe and the band regime has not caught up; this is the clearest lever left.
- ⚠ **There are now ZERO leading rungs (0/0).** The bands align tightly with the scenario years, so no
  present tier has an era above its scenario. The leading rung was scored by nothing anyway
  (BALANCE_FRAMEWORK, 2026-08-08), but it is a structural change, not noise.
- Macro breaches 19 → 23; the new entries are the war industries and glass at the late eras, plus
  railway, which remains the standing transport gap rather than anything the re-band caused.

**Not yet done, and needed before this can be merged:** `building_cost` is `null` on all fifteen new
rungs — `solve_building_cost.ps1` has not been run — and none of them has an unlocking technology yet,
which is step 1's job and the reason they are still invented tiers rather than emitted buildings.

**6. The four starting-technology lists are rewritten**, and the blanket pass is deliberate: *"the
countries should have reasonable base techs, and not only the absolute minimum mandated by their 1836
PMs"* — every civilised country gets **all of era 0** as a blanket statement, before the per-country
pass that guarantees each start's own production methods are gated.

| list | contents |
|---|---|
| `effect_starting_technology_tier_1_tech` | all era 0 + every era-1 technology with onset ≤ 1836 |
| `…_tier_2_tech` | all era 0 + every era-1 technology with onset ≤ 1820 |
| `…_tier_3_tech` | all era 0 |
| `…_tier_4_tech` | stays a curated named list |

⚠ **The blanket lists are a vanilla-style shortcut, not a hard limit** (user): a minor that should not
hold all of era 0 can be handed technologies one by one. The per-country verification that every 1836
production method is actually gated is in `ON_GAME_UPDATE.md`, with its BOM warning — a union across
countries is **not** sufficient, since a technology can be covered by some other country's list while
the country that needs it lacks it.

⚠ **THE REPO IS SELF-CONSISTENT AT HEAD; THE RE-BAND LIVES IN ONE FILE.** `config/era_prices.json`
and `config/era_presets.json` were briefly overwritten with the 106-tier solve and have been **restored to
their 100-tier versions**, because they feed `extract_presets.ps1` -> `ui/presets.js` and a snapshot built
in that state would have shown scenarios referencing buildings the sheet does not contain. The re-banded
ladder therefore lives entirely in `config/mod_config.era6.json` (un-ignored on purpose — it carries
solved volumes, so it is not a derivable output), and the two solve logs are the record of its result.
**Merging it needs one `era_scenarios --write` re-run to regenerate both artifacts, plus
`solve_building_cost.ps1`, in the same pass.**

⚠⚠ **SEQUENCING — nothing here may be written yet.** `config/mod_config.json` and
`tools/build_era_ladder.mjs` must not move until the second research-events batch has launched *and
built*, or batch A and batch B stop being comparable and both nights of game time are wasted.

---

## Step 2 — INDUSTRY-DRIVEN RESEARCH EVENTS  ⬅ **BUILT 2026-08-12, first batch running**

**Status: emitted, lint-clean, smoke-tested, and under measurement.** `tools/emit_research_events.mjs`
turns the config's `research_events` block into **378 journal entries over 126 technologies** (86
industry-gated, 40 war-gated) — 126 scripted progress bars, 133 script values, ~1,265 loc keys in 11
languages (the counts moved with the ladder-era alignment; the original 2026-08-12 emission was
366/122/115/1103). `enabled: false` emits nothing and reproduces the plain `techs` arm, which is what makes the
two a **config variant** rather than a build flag (user ruling 2026-08-11).
Every engine fact it stands on was measured in five probe runs on 2026-08-11/12 rather than assumed —
`can_research` semantics, journal-entry auto-activation reaching every country, occupancy as a weight,
script-values-as-triggers, the `root.` scope trap, and the general/mobilisation gate. They are written up
in MODDING_NOTES → *What a tech-granting event can CONDITION on*, with the three dead trigger spellings
that all failed **silently** and were caught only by asking each condition twice, once impossibly.
⚠ **The thresholds under measurement are the user's ruled ones** (15k/45k/135k/405k people in the
predecessor tier for eras 2–5), chosen deliberately high against a retrospective sweep that put JE #2
completion at 14%/4%/0%/0% of top-20 countries. The batch exists to see whether the mechanism still moves
technology and GDP despite firing rarely — that is the question, not a calibration to be fixed first.

**Goal.** Add research progress to the technologies of industry X when the country — or its companies —
owns or controls a significant amount of **staffed** industry X.

**Why.** It is how industrial leadership actually compounded: the country with the mills got the next
mill innovation first. Mechanically it is also the counterweight to step 1's deeper tree — without a
source of industry-specific research, a bigger production tree simply means everyone researches less of
it.

⭐⭐ **THE SHAPE — RULED 2026-08-10.** Most industrial technologies carry **a chain of three events on the
same condition, firing three years apart — nine years for the whole chain** — and **two of them must be
enough to research that technology with no ahead-of-time penalty.**

So the grant is simply **half the era cost**, and the third event is the surplus that begins to eat into
the penalty:

| era | technology cost | grant per event | chain of three, over 9 years |
|---|---|---|---|
| 1 | 7 500 | 3 750 | 11 250 |
| 2 | 10 000 | 5 000 | 15 000 |
| 3 | 12 500 | 6 250 | 18 750 |
| 4 | 15 000 | 7 500 | 22 500 |
| 5 | 17 500 | 8 750 | 26 250 |

That is a sane rate rather than a lump: an era-5 chain delivers ~2 900/year, about **28% of a fully
literate country's entire research output** (`50 + 1.5 × literacy` caps at ~200/week), aimed at one
industry. It is also close to vanilla's own progress events, which run 2 500–6 000 — the eras file even
says to use "an approximate third" of an era cost for one.

⚠ **This SUPERSEDES the earlier ruling** that a grant should cover an era-5 technology *including* the
worst-case penalty. That figure was 571 375 — roughly 55 years of national research output — and the
worst case describes a country with nothing researched, i.e. one that could never qualify for the reward
in the first place. The ceiling arithmetic is kept in step 1's `--aot` sweep, where it belongs.

❌❌ **TECH SPREAD IS NOT BOOSTED — THE WHOLE IDEA IS WITHDRAWN (user ruling 2026-08-12).** *"Increased
number of industry techs are compensated aplenty by JEs."* The research journal entries of step 2 grant
half an era's base cost per stage, so a spread boost was paying twice for the same depth — and paying it
on the one lever that works **against** the mod's goal, because spread only ever delivers technologies
somebody else already has: it cannot create a leader, it closes the gap the deeper tree exists to open.
**Nothing spread-related is emitted any more**, and with it we stopped owning
`common/static_modifiers/00_code_static_modifiers.txt` — one added line in a 900-line vanilla file.
⚠ For the record of what was actually ever SHIPPED: only the per-tree multiplier
(`country_production_tech_spread_mult = 0.5`). The FLAT 25 → 50 / LIT 75 → 100 ruling below was
superseded before it was emitted, so the base terms have always been vanilla.
⚠ The **knobs stay in the tech-tree page's spread panel**, defaulting to vanilla — the panel is the
instrument for re-asking the question (the share of a tree handed to a laggard by 1936, against
vanilla's own share), and deleting it with the setting would leave nothing to measure with.
The superseded reasoning is kept below, because the mechanism is still true and someone will ask again.

⭐ **TECH SPREAD GETS BOOSTED TOO** (user, 2026-08-10 — **WITHDRAWN, see above**) so a laggard converges
on the leading edge faster
and the deepened tree does not simply mean everyone finishes less of it. **The formula's own constants
are scriptable** — all three sit in `common/static_modifiers/00_code_static_modifiers.txt`; see
MODDING_NOTES for the mechanism, the file-ownership cost and how to avoid freezing it:

`weekly spread = (FLAT + LIT × literacy + 0.2 × unspent innovation) × (1 + Σ mult) × rand(0.5, 1.5)`

⚠ **The first ruling here — FLAT 25 → 50, LIT 75 → 100 — is SUPERSEDED, by its own consequence.** It was
sized against a production tree propped up by 22 filler technologies in the military and society trees.
Those were removed (no modifier creep, user ruling), and a **global** boost then overshoots badly:
society gained one technology while production gained 24, so the same multiplier gives society's tree
away.

⭐⭐ **THE LEVER IS PER-CATEGORY, AND ALWAYS WAS.** `country_production_tech_spread_mult` boosts one tree
only. What matters is not the multiplier but the SHARE of a tree that spread alone hands a laggard over
the campaign, measured against **vanilla's own share** rather than against zero. At 50% literacy, over
1836–1936 (`tools/tech_tree_spec.mjs` prints this table; the tech tree page has it live and editable):

| arm | production | military | society |
|---|---|---|---|
| vanilla spread, vanilla trees | 47% | 45% | 44% |
| vanilla spread, **our** trees | 31% (−15pp) | 36% (−9pp) | 43% (−1pp) |
| global 50/100, our trees | 50% (+3pp) | 57% (+12pp) | **69% (+25pp)** |
| **production-only +50%, our trees** | **47% (+0pp)** | 36% (−9pp) | 43% (−1pp) |

⇒ **`base_values = { country_production_tech_spread_mult = 0.5 }`** puts all three trees within a few
points of vanilla's own catch-up rate, changes no vanilla constant, and needs no technology invented to
absorb it. Military sits slightly *below* vanilla, which is correct — it got deeper by 13 real
technologies (9 tier rungs plus the port ladder).

⚠ Spread runs **one technology per tree at a time**, so a general boost also races the military and
society trees, which is why step 1 deepens those as well.

⚠⚠ **A BOOST HERE PUSHES AGAINST THE MOD'S OWN GOAL, and step 4 must measure it.** Spread only ever
delivers technologies *somebody else already has*, so it cannot create a leader — but it is exactly the
mechanism that closes the gap the mod is trying to open ("runners-up should have drastically less
advanced industries"). The arithmetic is not small: at 50% literacy, vanilla spread alone delivers
~326k innovation-equivalent over 1836–1936, roughly **47% of vanilla's whole production tree**. Tripled
it is ~978k, which is ~**89% of our option-1 production tree** — i.e. a laggard would be handed almost
all of it for free. The intended shape is *floor from spread, frontier from the step-2 events*; whether
that survives contact is a step-4 question, and the knob to turn if it does not.
⚠ Note also **which** term gets boosted is itself a design choice: raising the flat 25 helps illiterate
countries most in relative terms, raising the 75 helps literate ones. They are not interchangeable.
⚠ There is an alternative we did NOT take and should remember: `country_production_tech_spread_mult` is
**per category**, so production alone could have been boosted, leaving the other two trees untouched.
Deepening all three was chosen instead — the added technologies are real gaps in vanilla's coverage, and
a production-only boost makes the other trees feel stagnant rather than balanced.

⭐⭐ **THE MECHANISM — RULED 2026-08-11 (user: "broadly yes, go B").** A **journal entry per technology**,
carrying a **`scripted_progress_bar`**, is the shipping shape. The engine mechanics, all verified against
the shipped files and the exe string pool, are in MODDING_NOTES → *What a tech-granting event can CONDITION
on*. The four decisions:

1. **Visibility = `can_research = <tech>`**, which is exactly "every prerequisite researched **and** not yet
   researched" — vanilla proves it by writing `OR = { can_research = X  has_technology_researched = X }` in
   `je_victoria_terminus`. One cheap engine-side trigger, and it is the *whole* of the eligibility rule.
2. **The bar ticks on EMPLOYMENT, measured as `Σ (level × occupancy) × employees-per-level`** — occupancy is
   a **weight, never a filter**. 7 half-staffed levels (17 500 people) must pass a 15 000 threshold that 3
   fully-staffed levels (15 000) also passes; a `limit = { occupancy >= 0.9 }` filter scores the first as
   **zero** and is wrong. The threshold is authored in `mod_config.json` **in people**; the builder divides
   by that tier's own `employment` sum to emit the level figure.
3. **The first-rung technologies hang off a NARRATIVE supplier, and ⭐ NO MINE IS EVER USED** (user,
   2026-08-11: *"inputs should only be used when it fits narratively; mines should never be used"*). The
   config's `inputs` are a *candidate generator*, not the rule — where they name a mine, the mapping is
   authored instead:

   | industry | technology | conditions on | why |
   |---|---|---|---|
   | fertilizer | `intensive_agriculture` | **agriculture** (`bg_agriculture`) | the technology *is* farming; its iron/sulfur inputs are mines |
   | munition | `percussion_cap` | **arms** + explosives | percussion caps are gunsmiths' work; its lead input is a mine |
   | synthetics | `aniline` | **fertilizer** + textile | the chemical industry makes coal-tar dyes; the dyers wanted them |
   | railway | `railways` | **motor** + steel | engines on rails; its coal input is a mine |
   | shipyard_steam | `iron_screw_steamers` | **motor** + shipyard | you make engines and you build hulls |
   | electrics | `telephone` | **tooling** | precision instrument making; iron, lead and rubber are extraction |
   | **automotive** | `combustion_engine` | **motor** | the car is an engine on wheels |
   | **power** | `steam_turbine` | **motor** | the turbine is an engine; its coal input is a mine |

   ⚠ Automotive, electrics, power and railway are precisely the §10.29/§10.35 debut-wall industries, so
   this rule points straight at the standing problem.
   ⭐⭐ **THE OTHER FOUR GET NO EVENT, because their technology is a 1836 FREEBIE.** `navigation` (shipyard),
   `romanticism` (art_academy), `leblanc_process` (explosives) and `atmospheric_engine` (motor) all sit in
   **game era 1**, and `effect_starting_technology_tier_1_tech` opens with `add_era_researched = era_1` —
   so every tier-1/2 country already holds them at the 1836 start and `can_research` is false from day one.
   An event on them is dead on arrival.
   ⚠⚠ **THIS GENERALISES AND IT RESIZES STEP 2.** Of the **83** distinct tier technologies, **13 are game
   era 1** and therefore free at the start: artillery, atmospheric_engine, beet_sugar_refining,
   calico_printing, crystal_glass, fourdrinier_machine, gunsmithing, lathe, leblanc_process, manufacturies,
   navigation, romanticism, steelworking. ⇒ **70 technologies carry a live event, not 83.** The remainder
   split 14 / 12 / 22 / 22 across game eras 2–5.
4. **Every country gets it, including tags that do not exist yet** (user ruling — vanilla's tech events work
   this way and that is to be kept). This is *free* on the auto-activation route and impossible on the
   effect route: `is_shown_when_inactive` + `possible` is an engine sweep over all countries, so a tag first
   created in 1880 is picked up within 14 days, whereas `add_journal_entry` is a one-shot a new tag misses.
   Decentralized countries exclude themselves (`can_research = no` on their country type).

**Still open:** whether the grant is one lump per stage or a monthly drip; whether several contributing
industries gate the bar (any-of) or *speed* it (one `add` term each — the scripted bar makes this natural);
and how it interacts with tech spread.
**Settled by measurement, not opinion:** foreign-owned levels count for the **host's territory**, owner-
agnostic — the workforce is what learns. `levels_owned_by_country` exists, so the owner-learns variant is a
one-clause change if step 4 shows imperial powers under-teching.

⚠⚠ **THE OBVIOUS IMPLEMENTATION HAS A HOLE, FOUND WHILE SCOPING STEP 1** (2026-08-10 — the mechanics and
their evidence are in MODDING_NOTES → *Technology: research, spread, and what the AI actually weighs*).
`add_technology_progress` is exactly the right effect and vanilla uses it 68 times — **but the AI's
exposed weighting has no progress term at all.** Its entire model is `ai_weight` divided by
`1 + 5 × aheadOfTimePenalty / eraBaseCost`, which measures how *anachronistic* a technology is, never how
much of it is already paid for. Vanilla never notices because the other channel, **spread**, picks its
own target and finishes it unaided. An event that dumps progress onto a technology the AI has no reason
to select would create the stranded-progress case for the first time.

⇒ **So step 2 is two mechanisms, not one.** The event grants the progress, **and the technology's own
`ai_weight` reads the industry the country owns** — the same condition the event fires on. That makes an
industrial country *want* industrial technologies, which is the goal regardless, and it does not depend
on the AI understanding progress. A `has_technology_progress` clause can be added on top, but its
parameter names are unverified (vanilla never calls it) and must be probed with the
`pm_tech_rehaul_diag` tripwire first.

⚠ Related: `TECH_RANDOM_FACTOR = 1.0` means a 100+ technology production tree scatters the AI more than
vanilla's 57 does. Our technologies need **authored** `ai_weight`s, not vanilla's near-flat `value = 1`.

---

## Step 3 — BUILDING COSTS, THEN THE FIRST REAL BUILD  ✅ **RULED AND SHIPPED (2026-08-17)**

Decide each tier's `building_cost` (construction points) under the new tech gating, then build the mod
for real: solved recipes + new technologies + the step-2 events. **Resolved through three rulings**: the
§9 ten-year-payback model (its assumed 20% return was 3–6× off the realised margins) → §10.57's
two-band × 1.5^(era−1) vanilla-anchored ladder (2026-08-13) → **§10.61's EXACTLY-VANILLA FLAT book
(2026-08-17, canonical)**: each tier costs its industry's vanilla anchor, flat, × workforce_mult on the
graded ports — the exponential ladder was double jeopardy, since constructing the next tier at all IS
the modernisation cost. `payback_census.mjs --rule --write` owns the book; `solve_building_cost.ps1`
remains legacy documentation of the §9 model.

---

## Step 3½ — SAVEGAMES BECOME THE INSTRUMENT FOR STATE  ✅ **BUILT 2026-08-11**

**Status: shipped and in use.** The pipeline exists, is wired into `run_schedule.ps1` by default, and ran
its first batch (`20260811_094048_three-arm-tc-subsidy`). What it is and what it carries is documented in
**TESTBED_METRICS §7½** and **CLAUDE.md**'s tool list; the plan below is kept because its *reasoning* is
still the reasoning, and because two of its central assumptions turned out to be wrong in ways worth
recording.

⭐ **THE FEASIBILITY GATE CAME BACK 45× BETTER THAN FEARED.** The plan was written around a possible ~90 s
melt, which implied a backlog growing without bound. Measured on the 56.9 MB 1935 gamestate: **melt 2 s**,
single-pass extract ~4 s, and **streamed end to end 5.0 s** with no 391 MB intermediate on disk. The
consumer is several times *faster* than a quarterly producer. Every queued mitigation — parallel melt,
adaptive thinning, the high-water throttle pausing the game — is unnecessary at any cadence we use;
**streaming was the one that mattered**, and it was free.

⚠ **WHAT AN AUTOSAVE COSTS THE ENGINE IS AN OPEN QUESTION**, and it is the one thing that would make
cadence a wall-clock decision rather than a free choice of resolution. An estimate of 4–13% for quarterly
from save size alone was **wrong and is withdrawn**; and the obvious measurement cannot settle it, because
a yearly autosave fires on **1 January** and so is perfectly confounded with `on_yearly_pulse`
(TESTBED_METRICS §7½ carries the numbers). **Scheduled, not yet run:**
`schedules/autosave_cadence_vanilla.json` — n=2 vanilla-yearly against n=2 vanilla-quarterly, interleaved.
Both arms run the same ~100 yearly pulses and differ by ~300 autosaves, so the pulse cancels and the
wall-clock difference divided by 300 is the cost of one save.
**Cadence is user-ruled YEARLY for now** (2026-08-11); quarterly is proven feasible on the consumer side
and remains a per-batch choice, not a standing setting.

⭐ **THE SUBSIDY BREAKDOWN NEEDED NO DERIVING.** The plan expected to reconstruct it from each building's
subsidised flag and its shortfall. The save books it directly:
`country_building_budget.expenses.subsidies.values.<building_key>`, per country, per save. GBR 1935:
port £62 376/wk · railway £51 146 · trade centre £12 449 · power plant £104.

⭐ **ALIGNMENT LOOKS RIGHT ON THE FIRST CHECK** (formally re-run per batch by
`verify_save_alignment.mjs`): against its own run's telemetry the kept 1935 save matches GDP to 0.1–0.5 %
(India 979.3 M telemetry vs 980.2 M save), building counts exactly for several countries (1208 vs 1208,
360 vs 360) and population to 0.16 %. It also demonstrated the property that motivated tags over names:
that country is tag **`BHT`** in the save and *"India"* in the log.

⚠ **NOTHING HAS BEEN STRIPPED FROM LOG TELEMETRY YET**, and nothing should be until a full batch passes
the alignment gate. Events and the market order book stay on the logs permanently regardless.

---

### The plan as agreed (kept for its reasoning)

**What already exists and should be reused, not rewritten:**
- `tools/testbed/archive_autosaves.ps1` — stage A, already handles both hazards (slots rotate by
  RENAME; a 45 MB write is not atomic).
- `tools/testbed/score_save.ps1` — melt → readers → score, for one save. The shape of stages B–C.
- `melted_pops_by_profession.mjs` · `melted_building_goods.mjs` · `melted_pop_need_weights.mjs` ·
  `melted_cultures.mjs` — the readers. Profession-by-country is the step-4 metric telemetry never had.
- `tools/vendor/rakaly` is present.
- `tools/testbed/analyse_errors.mjs` and `analyse_tech_picture.mjs` — and read their headers before
  writing any new reader: both encode traps that produced confident nonsense first (the log ring has no
  token on `error.log`; country DISPLAY NAMES change mid-campaign; `debug.log` fields carry a trailing CR).

**Two live inconsistencies to be aware of while working:**
- The AI subsidy targeting bug below (§ *Deferred fixes*) — it invalidates BALANCE_FRAMEWORK §10.47.4's
  tolerance for every tier above the first.
- Six of our new technologies are never reached in a century (F48), so six top rungs are never built.

**Do NOT** strip anything from log telemetry until the alignment proof in the build order passes.

**The refocus.** For **state of process** — anything that is a *level* rather than an *event* — a melted
savegame is a better source than a log flood: it is complete, it is internally consistent, it carries
things telemetry cannot reach, and it is not subject to the log ring. Telemetry keeps **events**.

⭐ **The immediate prize:** `melted_pops_by_profession.mjs` already reads **population by profession per
country** — the exact metric step 4's sharpest criterion needs (runners-up holding drastically fewer
engineers, machinists and capitalists) and the one telemetry has never been able to give.

### ⚠⚠ The principle this INVERTS, and what it therefore demands

The repo runs on *"the summary is a CACHE; the raw log is the record"* — which is what makes compressing
logs safe. **Reaping the saves inverts it: the summary BECOMES the record.** Anything not captured at
melt time is gone, and the only remedy is re-running a campaign, which is a different world. Hence:
- the schema is **generous by default** — everything cheap goes in, not just what today's question needs;
- ⭐ **the last save of each run is kept permanently** (user-agreed) as the escape hatch. ~55 MB × runs,
  against ~16 GB for a run's full set.

### The pipeline — four stages, and A must not be coupled to B

| stage | what | when | cost |
|---|---|---|---|
| **A. capture** | copy each autosave out before its slot is reused | **concurrent** with the run — `archive_autosaves.ps1` already does this, including both hazards (slots rotate by RENAME; a 45 MB write is not atomic) | seconds |
| **B. melt** | rakaly → plaintext | after/behind the run, from the archive | minutes, ~7× disk transient |
| **C. extract** | readers → one summary JSON per save | after melt | seconds |
| **D. reap** | delete melt, verify summary, then delete the save | after C verifies | — |

**A concurrent, B–D behind it.** Coupling them races the engine: if a melt outlasts the interval between
autosaves, saves are lost silently. Archiving first removes the race. Same discipline as
`summarise.ps1`: **verify the summary before reaping its source.**

### ⭐ CADENCE: QUARTERLY (user-ruled) — and the queue arithmetic that follows

400 saves per century-long run. Sizes measured this session: 44.6 MB at 1915, 54.2 MB at 1935, smaller
early — call it ~40 MB mean. **~16 GB per run, ~48 GB for a 3-run batch**, which sits on the user's
**50 GB ceiling with no margin**. So the queue must be actively drained, not merely tolerated.

⚠⚠ **THE QUEUE PROBABLY GROWS WITHOUT BOUND AT THIS CADENCE, AND THAT IS THE FIRST THING TO MEASURE.**
From the timing curves, a quarter-year of game takes **~15 s of wall clock in the 1830s and ~35 s in the
1930s** — so a save arrives every 15–35 s. **Melt+extract time is UNMEASURED.** If it is ~90 s for a
40 MB save, the consumer is 3–6× slower than the producer, the backlog grows monotonically, and it never
drains during a back-to-back batch: ~250–330 unprocessed saves ≈ 10–13 GB left standing per run.
⇒ **Measure a melt before committing.** Then, in rough order of value:
1. **Stream the melt** if rakaly can write to stdout — extraction reads the stream and the 250 MB
   intermediate never touches disk. Biggest single win if it works.
2. **Parallel melt workers** — if melting is CPU-bound, N workers buy roughly N× throughput.
3. **Adaptive thinning** — keep every quarter in the decades under study, thin to yearly elsewhere.
4. **High-water throttle** — over X GB, pause the game (the observer already has a pause channel) until
   the queue drains. Bounded by construction; costs wall clock. The backstop, not the plan.

### ⭐ CLI TRANSPARENCY (user requirement)

The runner must say where phase B is at any moment, not just where the game is. Target shape:

```
run 6/12 · in-game 1862 · melt queue: autosave 275/399 of run 5 · 12.4 GB · draining 0.8/min
```

so a growing backlog is visible while it is still cheap to react to.

### The summary schema — one JSON per save

Provenance first, so a summary outlives its save: source filename, in-game date, run id, `build_state`
hash, mod build, rakaly version, and **`SAVE_SUMMARY_VERSION`** (bump-never-renumber, like
`TELEMETRY_VERSION`).

Then, and **nothing currently captured by log telemetry may be lost**:
- **Population by profession, per country** — the step-4 metric.
- **Full building count AND levels by TYPE by COUNTRY** — not category totals; the whole table.
- **GDP** per country (F45 confirmed the series is persisted), plus foreign-owned GDP.
- **Full market composition — which country is in which market.** A necessity, and today it is only
  derivable via `extract_presets.ps1`'s reading of history.
- **Trade: what is traded where**, country- and market-level aggregation.
- **Per-state/market goods flows** — supply and non-pop demand (`melted_building_goods.mjs`).
- ⭐ **COUNTRY BUDGETS, WITH SUBSIDIES AS THEIR OWN LINE — imperative** (user, 2026-08-11).
  ✅ **Already reachable and already itemised**: TESTBED_METRICS §3.5 verified the whole in-game budget
  panel on Country scope, and **`GetSubsidiesExpenses`** is a separate expense function, next to
  `GetSubventionsExpenses`. So the *line* exists today — it simply was not enabled in the `techtree-full-n3`
  batch. Turning the `treasury` metric on is all the total requires. ⚠ Seven revenue/expense terms are
  `Predict*` rather than `Get*` — the panel computes them forward and there is no stored value.
  ⚠ **The BREAKDOWN — where subsidies go — is NOT in the budget panel.** No per-building function
  exists; the panel gives one country total. It has to come from the **save**: read each building's
  subsidised flag and its shortfall, then aggregate by building type and by country. That is precisely
  the kind of question saves answer and logs cannot, and it is the reason it belongs in this schema
  rather than in telemetry.
- ⭐ **TOP PRODUCERS BY GOOD — the ranked table the game itself shows** (user, 2026-08-11): for each
  good, the leading producing countries in order with their quantities, at least the top 10. Cheap:
  `melted_building_goods.mjs` already reads every building's `output_goods` per state, so this is an
  aggregation to country plus a sort. ⭐ **It is also the most direct measure of economic
  SPECIALISATION we would have** — who actually makes the engines, and how far ahead of second place —
  which is the mod's central claim ("efficient producers should drive inefficient ones out of a
  market") expressed as a single readable table. Keep the quantities, not just the ranking: a
  near-monopoly and a three-way tie are the same ordering and completely different economies.
- **Pop-need purchase weights** (`melted_pop_need_weights.mjs` — the F40 instrument).
- **Cultures and current obsessions** (`melted_cultures.mjs` — runtime state, unreadable from files).
- **Technologies held per country** — a new reader. ⭐ **Rename-proof by construction**, since saves
  carry TAGS where `tech_log` carries display names — the exact trap F48 fell into.

### What moves off the logs, and what must never

⭐ **Once alignment is proven, log telemetry is STRIPPED of state-of-process metrics** (user ruling):
`country_state`, `population`, `building_inventory`, market composition. **Logs are for EVENTS.**

**Stays on telemetry, permanently:**
- **Events** — war start, bankruptcy/default, peace, diplomatic plays, and **technology ACQUISITION
  DATES**. A save shows what is held, never when it arrived.
- ⚠ **The market ORDER BOOK, which is NOT PERSISTED IN A SAVE** — the market database holds only
  `owner`, which is why F40 had to rebuild the pair from buildings. Anything needing actual buy/sell
  orders stays in the logs.

**Expected payoff:** a much smaller log flood, less ring pressure, and some of the mod's 8% wall-clock
cost back.

### Build order — and the gate that must not be skipped

1. ✅ **Time a melt+extract.** Done — 2 s melt, 5.0 s streamed end to end. See the box at the top.
2. ✅ `save_state_summary.mjs` (**not** `save_summary.mjs`, which already existed and reads the raw
   binary for a different purpose) + `SAVE_SUMMARY_VERSION`.
3. ⏳ **PROVE ALIGNMENT before retiring anything.** `verify_save_alignment.mjs` exists and the spot check
   passes; the formal run happens on the first completed batch. Same discipline that caught F39's bad
   solve: a metric is not replaced until its replacement is validated against it. **Only then** does
   "strip the logs" run — and it has NOT run.
4. ✅ Technologies-held and market composition — both in the summary (market as each country's own market
   id plus the subject/overlord relation; the merge is deliberately left to the reader, because
   `melted_building_goods.mjs` measured the naive merge to be *worse* against telemetry).
5. ✅ `harvest_saves.ps1` — chains B–D, N workers, verify-before-reap, progress line.
6. ✅ Wired into `run_schedule.ps1` by default (`-NoSaveHarvest` opts out). The queue high-water guard is
   **not needed** — the archiver already stops below 8 GB free, and at the measured drain rate the queue
   cannot outrun the consumer.
7. ✅ **Landmine L12** + `Test-LmL12`, proved by breaking it both ways (summaries removed; every save
   reaped with none kept). ⚠ L11 was already taken — check the register before claiming an ID.

⚠ **A STALENESS COUPLING TO CLOSE FIRST, unrelated to saves but in the same class.** `build.ps1` calls
`emit_techs.mjs` but **not** `tech_tree_spec.mjs`, so `config/tech_tree_options.json` is never
regenerated by a build and can go stale against `config/mod_config.json`. Editing recipes in the balance
UI is safe — each tier's `tech` lives in the config and the builder reads it directly — but **adding a
tier in the UI produces a tier no technology knows about**, silently. The fix is the guard
`bundle_ui.mjs` already uses: refuse to emit when the generated file is older than the config it was
derived from.

---

## 🚩 HANDOVER — start here (written 2026-08-12, ~01:15, batch left running overnight)

**A three-run batch is PLAYING right now: `tools/testbed/sessions/20260812_010659_research-events-n3`.**
3 × (1836→1936), ~7–8 h, the `techs+events` arm. Read `session.log`'s tail first — if it says
`SCHEDULE DONE`, it finished; if the newest line is a tick, it is still going.

### What to read first, in this order
1. **`PMR_JE|<stage>|<tech>|<country>`** lines in each run's `logs_live/debug.log` — one per completed
   journal entry. That is question 1 (how often does each fire, and for whom).
2. The **annual save summaries** (`run00N_events/save_summaries/`) for GDP, buildings-by-type and
   `technologies_held` — questions 2 and 3.
3. **Against run003 of `20260811_094048`**, the `techs` arm at n=1, which pools because metrics, cadence,
   span, dump dates and tags are all identical.

### ⚠ THE FIRST THING TO CHECK, because it is the most likely disappointment
The thresholds are the **user's ruled** 15k/45k/135k/405k, chosen deliberately high. A retrospective
sweep over the baseline campaign put JE #2 completion at **14% / 4% / 0% / 0%** of top-20 countries at
those levels, and the 10-year smoke fired **20 of 122** technologies — dominated by the *group-anchored*
ones (`fractional_distillation` 293, `watertube_boiler` 159, `intensive_agriculture` 113), because a
building-GROUP threshold is expressed in staffed LEVELS (3 at era 2) while a tier threshold is expressed
in PEOPLE (15 000). **That asymmetry is mine, not the user's ruling**, and it is the first calibration
question to put to them: a group spans many buildings, so its gate is far easier to clear than a single
tier's. The user's stated purpose is to see whether the mechanism moves tech and GDP *despite* firing
rarely — do not "fix" the thresholds without asking.

### What shipped, and where it lives
- **`tools/emit_research_events.mjs`** — 126 technologies → 378 journal entries, 126 scripted progress
  bars, 133 script values, ~1,265 loc keys × 11 languages (was 122/366/115 at the 2026-08-12 first
  emission; the counts track the ladder). Wired into `build.ps1`, throws on failure.
- **`research_events` in `config/mod_config.json`** — `enabled:false` emits nothing and reproduces the
  plain `techs` arm, which is what makes the two a **config variant** rather than a build flag.
  ⚠ **The canonical config now carries `enabled: true`**, so a default build ships the events. If the
  events-free mod is wanted as the default again, flip that flag and carry a variant file for the batch.
- Coverage census, validated with the user: **152 in-scope technologies, 122 covered, 30 not** — 27 of
  those are era-1 freebies (`add_era_researched = era_1` hands them out at the 1836 start, so
  `can_research` is false from day one) and 3 are modifier-only. Society is out of scope by ruling.
- Engine mechanics: **FINDINGS F51** and MODDING_NOTES → *What a tech-granting event can CONDITION on*.
  Five probe runs; three trigger spellings were accepted and **silently ignored**, and were caught only
  because every condition was asked twice, once impossibly. Keep that discipline.
- ⚠ **`run_schedule.ps1` had a launch-blocking bug** (a `+` read as a positional argument to
  `Start-Process`); fixed, and written up in BUGS_AND_FIXES. Sessions `20260812_005609`, `010202` and
  `010614` are its failed attempts — kept, per the never-delete rule, and they contain no measurement.

### Still open
- The **military gate is emitted but unproven in a real war**: front-restricted, one general with ≥100
  mobilised battalions or two with ≥50, plus a ≥50% mobilised share. 1836 has no war big enough to trip
  it, so the century run is its first real test. Barracks levels = `army_size` exactly, so the save
  summaries can check reachability retrospectively (largest army: RUS 206 in 1837 → GBR 573 in 1935).
- **"Share of the army mobilised" is not a true fraction** — it exceeds 1 for some countries. It ships as
  a one-sided `>=` gate only. See F51.
- The **balance UI snapshot has not been regenerated** since the config gained `research_events`.

---

## 🚩 PREVIOUS HANDOVER (written 2026-08-11 evening, session ended for a device switch)

**Everything below is committed and pushed to `main`. The game is off; nothing is running.**

### What just landed
Step 3½ is **built and validated** (F50) and the first three-arm measurement exists (**F49**). The
savegame instrument archives, melts, summarises and reaps **concurrently with the game** (user ruling),
schema **v3**, alignment gate passed at 1.61 % on GDP. Read F49 and F50 before anything else — they hold
the numbers and, more importantly, the three things that were wrong before they were right.

### ⚠ A RESULT THAT WAS RETRACTED THE SAME DAY — read F49 §5 before citing it
An earlier form of this handover led with "the technology distribution has COMPRESSED": vanilla's leader
160 technologies against a median of 122, the mod's 130 against 130. **That was one country, not a
distribution.** The full distribution has leader ÷ median at **1.36× in BOTH** vanilla and the mod (1.47×
without the trade-centre subsidy), the mod's top higher in absolute terms, and its Gini marginally
*higher*. What the figure actually measured was the technology count of the single highest-GDP country —
Russia in the mod, 67th of 135 on technology, against the USA in vanilla, 5th of 125 — while the mod's
#2 and #3 economies sit at 173 and 174, right at the frontier.

⇒ **The design conclusion drawn from it is withdrawn.** It was used to argue that the spread boost and
step 2's research events pull against each other and that spread should stay small. That may still be
true; **this measurement does not show it**, and step 2 should not be scoped as if it did.
⚠ The general fault is worth more than the number: a one-country statistic was reported as a property of
the world. When the next batch reports "the leader", say leader BY WHAT, and put the distribution beside
it.

### ⭐ THE PLAN FOR THE NEXT SESSION (user, 2026-08-11) — go straight to step 2

1. **Research what a tech-granting event can actually condition on.**
2. **Draft the events.**
3. **Overnight test: vanilla vs techs vs techs+events.** The trade-centre subsidy question is **PARKED**.

Everything else on this file's old list is parked behind that — see *Parked* below.

**What already exists for (1), so it is not started from nothing.** Step 2's own section holds the
groundwork; read it before searching:
- `add_technology_progress` is the right effect and **vanilla uses it 68 times**.
- ⚠⚠ **The obvious implementation has a hole.** The AI's exposed weighting is
  `ai_weight / (1 + 5 × aheadOfTimePenalty / eraBaseCost)` and has **no progress term at all** — so
  progress dumped onto a technology the AI has no reason to pick creates *stranded progress*, a case
  vanilla never produces because its other channel (spread) finishes what it starts. ⇒ **Step 2 is two
  mechanisms, not one:** the event grants the progress, **and** the technology's own `ai_weight` reads
  the industry the country owns.
- 🔍 **The open investigation is exactly your step 1** — *how deep can `ai_weight` reach?* Three
  sub-questions, none answered: when is it evaluated (the belief is: at the moment of choice only, since
  the AI runs a technology to completion rather than queueing); do dynamic triggers work there at all, or
  is the block read once at load; and how expensive is a building-count scan across every country ×
  every available technology on a tree that just grew by 24. Answerable in the testbed by watching an AI
  country's selection against a weight only its own industry could satisfy.
- The **shape is already ruled**: three events on one condition, three years apart, each granting **half
  the era cost**. Still open: whether the trigger is levels, employment or output share, and whether
  foreign-owned levels count for the owner, the host or neither.
- `MODDING_NOTES.md` → *Technology: research, spread, and what the AI actually weighs* has the mechanics.

**The three arms, now settled (user, 2026-08-11):**
- **vanilla** — `{kind: control}`.
- **techs** — `config/mod_config.json`. ⭐ **The trade-centre subsidy mandate has been REMOVED from the
  default config** (`building_subsidies.building_trade_center: "vanilla"`), so the shipped mod now *is*
  what this session called `mod_no_tc`. F49 measured that mandate at **35% of all government expense**
  against vanilla's 4.7%; the question is parked, not answered. `config/mod_config.no_tc_subsidy.json`
  is deleted as redundant. ⚠ Vanilla's own `ai_strategy_montenegro_admin` still subsidises trade centres
  and we preserve it — one line survives in the emitted file and it is not ours.
- **techs+events** — ⚠⚠ **MUST BE A CONFIG VARIANT, not a code arm** (user ruling). The events therefore
  have to be *driven by a field in `mod_config.json`* that the builder reads, exactly as `pm_goods` and
  `building_subsidies` are — not by a build flag and not by a hardcoded emitter. Design the config shape
  before the emitter; it is what makes the arm expressible as `{kind: config, config: …}`, recordable in
  `build_state.json`, and switchable without a rebuild of the harness.
  ⚠ **No scaffolding was written for it.** The config shape depends on answers step (1) has not produced
  yet — whether the trigger is levels, employment or output share, and whether the grant is flat progress
  or a research-speed modifier — and a schema guessed now would most likely be undone.

⭐ **POOLING — and note WHICH run pools, because the arms were renamed under it.** This session's
**run 3** (`mod_no_tc`) is the one that matches the new `techs` arm; **run 2 carried the subsidy mandate
and does NOT pool with it**. Run 1 (vanilla) pools as vanilla. Both were telemetry v12, yearly autosaves,
1836→1936, the same six metrics (`20260811_094048_three-arm-tc-subsidy`). Keep those defaults and vanilla
and techs each start at n=1 for free; change any of them and say so in the schedule's `_comparison`.

### Parked (was the old plan; nothing here is abandoned)
- **Runs 4–6 of the three-arm batch** — `schedules/three_arm_tc_subsidy.json`, unchanged and re-runnable.
  Everything in F49 stays n=1 until it runs.
- **The autosave cadence experiment** — `schedules/autosave_cadence_vanilla.json`, validated. The only
  design that isolates a save's cost from the yearly pulse it fires alongside.
- **Strengthen the concentration metric** — top-3 share and HHI, value-weighted, always splitting the 22
  goods the mod tiers from the 27 it does not. A top-1 share over all goods produced a wrong "goal 2 is
  not happening" reading; the corrected one is a wash. Do this **before** goal 2 is re-reported.
- **The tick-speed regression** — fit wall clock against continuous predictors (pop objects, live pop
  objects, people, GDP, building count) rather than the coarse mod/vanilla factor. Every summary from now
  on carries all of them; the first batch's runs carry pop counts at one date each, their saves having
  been reaped before the field existed.

### Two open questions worth keeping
- **Do the 17.4 % empty pop records cost the engine anything?** If it iterates them they are real
  overhead; if it skips them, live count is the better regressor. The two differ by a fifth.
- **Nothing has been stripped from log telemetry**, and should not be until the alignment gate passes on
  a full batch rather than one arm. Events and the market order book stay on the logs permanently either
  way.

---

## Step 4 — TELEMETRY RUNS, AND THE LOOP BACK

Run the testbed heavily on the mod and some vanilla control arms, and ask whether the game unfolds as
envisioned. The signals that decide it:

- **GDP** — level and trajectory against vanilla.
- **Workforce composition** — the sharpest test. Runners-up should hold *less advanced* industry than
  they do in vanilla, and therefore **drastically fewer engineers, machinists and capitalists**.
- **Trade** — whether a technological leader actually takes markets from a laggard.
- **Wall-clock speed** — a deeper tree and more events must not make the game unplayable.

Where it disagrees, go back to steps 0–3 and tune. **This is the loop the MVP is defined by**, not a
one-off validation pass.

---

*— MVP ends here. Everything below is polish. —*

## DEFERRED FIXES — known, not scheduled

- ⚠ **Our emitted `common/buildings/*.txt` carry no UTF-8 BOM** and the engine logs *File 'common/buildings/01_industry.txt' should be in
  utf8-bom encoding (will try to use it anyway)* for 01 and 06 in every run — checked and **pre-existing** (two occurrences in the canon
  's own sessions), so long-standing, not new. It evidently does use them, so this is cosmetic; but it is two lines of engine complaint
  per run that a reader has to learn to ignore, which is the class of thing that hides a real one. Fix: write those files with a BOM, as
  vanilla does. ⚠ **Not while a batch runs** — `run_schedule.ps1` rebuilds the mod before EVERY run, so a builder edit mid-batch makes the
  arms incomparable (noticed 2026-09-18 at the step-9 batch's smoke check).

### ⚠ `deviates_from_vanilla` NAMES 5 OF THE 13 DIRECTORIES AN ARM ACTUALLY CARRIES (found 2026-08-12)

**The record of what a run was testing has quietly stopped being true.** `run_observer.ps1` builds
`build_state.json`'s `deviates_from_vanilla` from a **hardcoded probe list** of six paths —
`common/buildings`, `common/production_methods`, `common/history`, `common/pop_needs`,
`common/ai_strategies`, `localization`. It has never grown. The era6 arm emits **25 directories**, and
everything ROADMAP steps 1 and 2 added is missing from the record: `common/technology`,
`common/journal_entries`, `common/script_values`, `common/scripted_progress_bars`, `common/defines`,
`common/scripted_effects`, `common/static_modifiers`, `gfx/interface`.

Its own comment states the intent it no longer meets — *"names every gameplay file the arm carries, so
'how far from vanilla is this' is answerable without re-deriving it from the config"*.

✅ **The GUARDRAIL is intact; it is the RECORD that is wrong.** Landmine **L7** (a control arm carrying
gameplay content) does **not** consult this list — it walks the built mod itself against an allow-list of
`.metadata` / `common/on_actions` / `common/script_values` / `events`. So a control that carried a tech
tree would still fail the build.

⚠ **But two derived values are wrong, and both are `arm` — the field the hard rule about run
configuration exists to protect.** `arm` is computed *from* this list:
- a **control** carrying an unprobed directory yields `deviates.Count -eq 0` and is recorded as a clean
  `control` rather than `control+UNEXPECTED`;
- an **overlay** whose content sits outside the probe list is recorded as `overlay+EMPTY`.

**Fix:** derive the list by walking the built mod (as L7 already does) rather than probing six names, and
keep `arm`'s derivation on top of it. Then a directory added by a future step is recorded without anyone
remembering to update a list — which is the property that failed here.
⚠ **Held while a session is live**: `run_observer.ps1` is what the running batch is executing.
⚠ **Sessions before this fix under-report their content**; the value is a historical record and must not
be back-filled (same rule as the 2026-08-05/06 `control+pop_needs` entries).

### ⚠⚠ 30% OF THE 1836 START IS EMITTED ON THE WRONG TIER (found 2026-08-12)

**A LANDMINE in the exact sense the register means: nothing fails.** The build succeeds, the linter
passes, `Invoke-ModChecks` passes (its test is that `create_building` blocks are *present*), the history
files are non-empty, and `start_baseline.json`'s **`unmapped` list — the version-drift alarm — reads 0**
while 327 factories are never inspected at all.

**Root cause, one line.** `Get-SplitMaps` in `tools/history_lib.ps1:61` keys the converter's
base-building map on the **first** tier: `if ($n -eq 1) { $baseIndustry[$t.key] = $ind.id }`. That was
correct while tier 1 *was* the vanilla building. The era ladder then minted **e0 rungs**, which are not
`model_only`, so slot 0 is now an invented key — `building_textile_mill_cottage`,
`building_steel_mill_bloomery` — and the vanilla key it displaced is invisible to the map. A vanilla
`create_building` naming `building_textile_mill` therefore matches nothing, is **not** recorded as
`unmapped`, and passes straight through unconverted onto whatever tier happens to own that key: era 1.

**Nine industries affected** — exactly those that got an e0 rung: food, textile, furniture, glass,
tooling, paper, steel, arms, artillery. Counted by the era each factory's *own active production
method* implies, against the era 1 they are all emitted as:

| industry | e1 | e2 | e3 | wrong |
|---|--:|--:|--:|--:|
| textile | 55 | 21 | — | 21 |
| furniture | 33 | 18 | — | 18 |
| tooling | 10 | 16 | 9 | **25** |
| glass | 28 | 12 | — | 12 |
| food | 20 | 12 | — | 12 |
| paper | 40 | 10 | — | 10 |
| arms | 27 | — | — | 0 |
| artillery | 10 | — | — | 0 |
| steel | 6 | — | — | 0 |

⇒ **98 of 327 (30%)**, and tooling holds a **two-era** demotion on nine of them. Vanilla and converted
`create_building` counts are byte-for-byte identical for all nine, which is the cleanest proof that no
conversion happens: only `port` moves (229 → 241), because port's first tier still *is* `building_port`.

⭐ **Steel is correct by luck, and that matters for step 1b.** All six 1836 steel mills run
`pm_blister_steel_process`, which is era 1 anyway — so the pass-through lands them right. Better still,
**dropping steel's bloomery rung (step 1b clause 2) makes `building_steel_mill` the first tier again and
un-breaks steel by construction.** The same is true of any industry whose e0 rung is dropped; it is not
a substitute for the fix, but it means the redo and this bug pull in the same direction.

**The fix** is to key `baseIndustry` on the tier that carries the **vanilla building key** rather than on
position — every affected industry has exactly one tier whose key appears in vanilla history — and to
make a `create_building` whose key belongs to a known industry but matches no tier land in `unmapped`
rather than vanishing. Then add the detector: **a landmine-register entry that walks the emitted history
against vanilla's and fails when a factory's tier disagrees with its own active production method.**
The current alarm cannot see this, and an entry that stays manual is a smell.

⚠⚠ **HELD until the research-events batch B has built.** `history_lib.ps1` is a build input and
`run_schedule.ps1` rebuilds the mod before every run, so changing it mid-batch would land in some runs
and not others — the same reason `build.ps1` and `telemetry_lib.ps1` are frozen during a batch.
⚠ **It also invalidates nothing measured so far**, because every arm that carried a mod carried this
too; it is a wrong *baseline*, not a wrong *comparison*.

### ⚠⚠ THE AI SUBSIDISES ONLY THE OBSOLETE TIER OF EACH INFRASTRUCTURE CHAIN (found 2026-08-11)

**Worse than "we keep subsidising basic ports": we subsidise *nothing else*.** Vanilla's
`ai_strategy_default` names three buildings at `must_have`:

```
building_power_plant · building_railway · building_port
```

Those are **our tier-1 keys**, because the split deliberately keeps the vanilla key on the lowest rung
so `has_building` references keep matching. So in the shipped mod the standing subsidy lands on:

| chain | subsidised | never subsidised |
|---|---|---|
| ports | `building_port` — **Basic Port, 1700** | steam 1840 · industrial 1875 · modern 1908 · motor 1930 |
| railways | `building_railway` — Early Railway, 1825 | steam 1867 · electric 1895 · diesel 1934 |
| power | `building_power_plant` — Coal-Fired, 1900 | pulverized 1920 · oil 1925 |

⇒ The AI props up the rung the ladder is trying to retire and leaves the modern ones to fend for
themselves — the exact inverse of the design.

⚠⚠ **AND IT SILENTLY INVALIDATES A BALANCE RULING.** BALANCE_FRAMEWORK §10.47.4 grants railway / port /
power a **−10% loss tolerance before the ladder criterion calls it a fault**, justified by "vanilla's
default AI strategy subsidises the trio at must_have". That justification only holds for the tier-1
key. Every higher tier is being scored with a tolerance it does not actually receive.

**This is the `has_building` narrowing class** already recorded in CLAUDE.md (457 vanilla references now
matching only tier 1, alongside company mandates and monopolies) — but it is the most economically
consequential instance found so far, because it moves money every week.

**What a fix has to do** (user, 2026-08-11: *"invent some option to stop subsidising obsolete
infrastructure once newer infrastructure is mature enough"*):
1. **Subsidise the tier a country actually runs**, not the one holding the vanilla key. The builder
   already whole-file-owns `01_admin_strategies.txt` and writes every `subsidies` block from the config
   map, so the emission side is free — the map simply needs every tier, not one key per chain.
2. **Retire the subsidy on an obsolete rung once its successor is mature.** `subsidies` takes only
   `must_have`/`wants_to_have`/`nice_to_have` and no trigger, so "mature enough" cannot be expressed
   inside the block. Two candidate routes, neither tested:
   - a **war_subsidies-style second block** if any conditional form exists — needs checking;
   - a **scripted route**: the AI re-scores subsidies continuously and undoes `set_subsidized`, so this
     probably means swapping the whole strategy on a condition, not toggling a building.
   ⚠ Whatever ships must be re-measured against §10.47.4's tolerance, which was calibrated on the
   assumption above.

### DROP STEEL'S ERA-1 RUNG (user-ruled 2026-08-12, deliberately not scheduled)

`building_steel_mill` (blister steel) should eventually go the way of the bloomery rung that step 1b
drops. It survives for now for one reason only: the **1836 map contains steel mills**, and the history
converter needs a tier to map them onto. Until that is solved, the rung exists but is **excluded from
every scenario** by `ERA_PRUNE` (step 1b, clause 3) — so it costs the model nothing and costs the
player only a building they will never profitably run.

Taking it needs three things together, which is why it is not scheduled: a home for the 1836 steel
mills (re-tier them onto era 2, or remove them from the converted start), a decision on
`crucible_casting` (it would then gate nothing — either drop it or give it a real effect, per
constraint 4), and a check that nothing in the 1836 start depends on the key.

---

## Step 5 — COMPANY MANDATES  ⬅ **MEASURED 2026-08-20 — SURVEYED AND FIRST CUT SHIPPED 2026-08-23 (probe, unmeasured)**

✅ **THE SURVEY RAN AND THE IDEAL DESIGN IS RULED AND BUILT (2026-08-23, BALANCE_FRAMEWORK §10.64).**
Answers to the questions below: a mandate CAN name many building keys (it is a plain key list; vanilla
companies already carry 2–3), prosperity bonuses CAN be re-pointed per tier (but every new
`building_<tierkey>_throughput_add` needs a hand-declared modifier type — vanilla hand-enumerates them),
and a company has NO building-selection AI of its own — it is assigned ownership of investment-pool
construction of its listed types, so the tier choice is the construction AI's and the company system just
amplifies it. The two hardcoded formation gates (tech for ≥1 listed type; 5 levels of listed types in one
state) make "list the whole chain" both necessary and sufficient for companies to form off the lowest
rung and follow the country up the ladder. `tools/emit_companies.mjs` ships it: all 22 vanilla company
files rewritten (195 companies), formation tests OR-wrapped, prosperity expanded per tier (85 lines — the
F77 census exactly), ai_construction_targets duplicated, 75 new modifier types + loc ×11. Shipyard
companies get BOTH config chains (one vanilla industry, two of ours). **Unmeasured**: deployed 2026-08-23
for an in-game eyeball; the first measured arm reads the v7+ per-year company series against F79's
vanilla century (4.0%→47.4% of tiered-equivalent) and the rung mix of company-held levels. The ai_value
ladder stays set aside until that read is in.

Change company mandates so they latch onto useful and reasonable industries rather than always the
Tier-1 building. Related to the standing `MISSING_PM_REFERENCES.md` / narrowed-`has_building` problem:
457 vanilla `has_building` references now match only our Tier-1 building, and the same "make every tier
of the industry eligible" fix resolves mandates, monopolies and the flavour references together.

⭐⭐ **THE `ai_value` LADDER IS SET ASIDE BY RULING (user, 2026-08-23) UNTIL THE COMPANY SYSTEM WORKS.**
The user's words: pushing the ladder *"at least in a world without proper manufacturing companies leads
to a broken game."* The measurement behind the call is the n=18 vanilla baseline (F79): companies run
**47.4%** of vanilla's tiered-equivalent sector by 1936 against the mod's ~9%, vanilla's free PM
switching converges the majors' stock to 77–90% frontier — the actor the ladder was trying to
substitute for is the one the tier split locked out. `1000 × (era+1)` stays the bracketed-best,
unshipped, in its alt config; do not resume the ladder series before step 5's company work lands.
**The next session investigates the company system**: can a mandate name MANY tiers of a chain (several
building keys per mandate?), can `prosperity_modifier` throughput bonuses be re-pointed per tier or per
industry, what does a company's building-selection AI actually accept — the 222 vanilla company
definitions, `common/company_types`, and the mandate/prosperity schema are the ground to survey, with
F77's census as the map and F79's vanilla company century as the yardstick.

### What is now measured (FINDINGS **F77** and **F77.1**)

- **Every** company mandate and **every** company throughput bonus lands on the **first rung** of one of
  our chains and never on any other. 21 of our 22 industries are named; of 151 `prosperity_modifier`
  throughput bonuses across all 222 company types, **85 target our buildings and all 85 target rung 1**
  (railway alone has 19, textile 11). The modifier is keyed to a literal building key, so the tier split
  put every higher rung permanently out of reach.
- ⇒ **a company-backed obsolete mill carries a permanent throughput bonus its modern replacement can
  never receive** — a standing incentive to keep building the oldest rung, entirely independent of
  `ai_value`, and acting through every arm of the F76 ladder series.
- Companies hold **38.5%** of vanilla's tiered sector by levels (41.0% by value added) against **9.0%**
  (7.1%) of ours. Decomposed: rung-1 is 100% of vanilla's tiered sector and **34.3%** of ours, and
  **the lock-out alone is 86% of the gap** — arithmetic on our own tier mix, not RNG.

⇒ The fix is no longer only a completeness chore. **The tier split shrank the share of the economy
companies can touch by about two thirds, and what is still in reach is exactly the part we want
retired.**

### Step 5a — INSTRUMENTATION FIRST  ✅ **ITEM (1) SHIPPED (2026-08-21, save summary v7)** · item (2) open

The 2026-08-21 deferral was reversed by the user the same week, **before the long vanilla batch** —
exactly because per-year ownership cannot be back-filled and that batch is the baseline everything will
be read against. Shipped as `SAVE_SUMMARY_VERSION = 7`:
- `company_levels` per building type per country, from the `identity={ building= }` ownership records,
  filtered on the OWNER building's type. ⚠ **Company-held includes REGIONAL HQs** —
  `building_regional_company_*` owns through the same mechanism (canon-n7 1936 endpoint: 5,190 levels
  against 40,466 via main HQs, ~520 of them on tiered types), so both instruments now use the
  two-prefix definition and **F77.1's shipped shares (38.5% / 9.0%) are slight undercounts on both
  sides** (`melted_company_ownership.mjs` updated to match; its header carries the note).
- The **`companies` register** per country: type, prosperity, prosperous flag, charter count,
  regional-HQ count — resolved to a country via the HQ building (the record's own `country=` is a typed
  handle, not a country_manager id; it is deliberately not decoded). Yearly summaries date each
  company's formation to ±1y by first appearance.
- **`ownership_levels`** per country: host-side levels by owner class (state / foreign_country /
  financial_district / manor_house / company / company_regional / other_building) — the full capital
  structure per year, which the §10.45 profession wedge previously had to be derived from one
  hand-kept campaign.
- Resolution is **deferred to end-of-parse** (the roadmap's own warning about parse order held), and
  unattributable levels are counted and emitted (`world.company_levels_unattributed`, 270 levels on 97
  records at the canon endpoint — owner ids resolving to no building), never guessed.
- Validated level-exact against `melted_company_ownership.mjs` (independently parsed) on the canon-n7
  mod endpoint (world 3,357; GBR 130 / USA 127 / FRA 107 / NET 20 / GER 392) and sanity-checked on a
  vanilla 1936 endpoint (328 companies, 0 unresolved). Cost: +1% summary size.

**Item (2) — `analyse_ai_tier_choice.mjs --exclude-company-owned` — stays open**: it is analysis over
summaries that carry the field, so unlike (1) it can be written any time after data exists. First data:
the long vanilla batch.

*(Original design below, planned 2026-08-20.)*

The one question the melts could **not** answer is the dynamic: *how does the below-best metric move if
only non-company-owned levels are counted?* That needs ownership **per year**, and only the newest save
of each run survives the reap — so it cannot be recovered from any past batch and must be captured going
forward.

1. **`save_state_summary.mjs` — capture company-held levels.** Its `building_ownership_manager` pass
   already walks every ownership record but extracts only `identity={ country= }`; the `identity={
   building= }` variant — which is how a company HQ owns — is dropped on the floor. Capture it, resolve
   the owner building's TYPE, and keep the entry only when that type is `building_company_*`.
   - ⚠ **A building-identity owner is usually NOT a company.** In the canon melt, financial districts
     account for 13,864 such records against a few hundred company ones, with manor houses next. Key on
     the owner's type; never assume.
   - ⚠ **Parse order must be verified, not assumed.** The existing pass resolves `bldState.get(...)` at
     ownership-read time, which implies `building_manager` precedes `building_ownership_manager` in the
     melt — but the owner's *type* is a new lookup, and the file already carries a comment about
     `states` arriving late. If the order does not hold, defer resolution to the end rather than
     silently attributing to `(unknown)`.
   - Emit as `company_levels` per building key beside the existing per-building record — a small map,
     and it keeps the summary's shape.
   - **`SAVE_SUMMARY_VERSION` bump** (bump-never-renumber). Pre-bump summaries simply lack the field, so
     every reader must degrade explicitly and say so — the same discipline `va_out`/`va_in` needed when
     the VA chart shipped, and the same reason the vanilla baseline cannot answer tiered productivity.
2. **`analyse_ai_tier_choice.mjs` — `--exclude-company-owned`.** The metric already diffs standing levels
   year to year, so the non-company flow is `Δ(total) − Δ(company-held)` per building per year, directly
   available once (1) lands.
   - ⚠ **Do not bake in the user's simplifying assumption.** "Companies only acquire, never lose unless
     downsizing" is a reasonable prior, not a fact: report the count of country-years where
     `Δ(company-held) < 0` rather than clamping it away. If it is rare the assumption is vindicated in
     the output; if it is not, the assumption was load-bearing and wrong.
3. **Only then the gameplay change.** Re-pointing mandates touches 222 vanilla company definitions and is
   a design decision with its own balance consequences — it should be made against a measured baseline,
   not ahead of one.

⚠ **Sequencing is deliberate.** (1) and (2) are measurement and can land any time the machine is free;
they change no emitted content, so they cannot disturb a running comparison. (3) is an arm.

## Step 6 — DAM MEGAPROJECTS

Modelled on canals: a decision available to the state owner, a running bureaucratic cost for a period,
then a building slot unlocks; constructed with a large construction-point cost, it yields **electricity
output in the thousands** for modest labour and a tools input.

⚠ This is the deliberate re-entry point for hydro, which BALANCE_FRAMEWORK §10.43 excluded from the
market model on purpose: small-scale hydro folds into the urban-centre narrative, and large-scale hydro
is a site-specific megaproject — exactly what this step builds it as.

## Step 7 — VISUALS, PROOFREADING, RELEASE

- Per-tier building artwork, so a player reads the tier from the picture instead of a wall of text.
- Fix the era band dividers in the tech tree GUI (step 1's known cosmetic debt).
- Proofread every new technology name and description.
- Release.

---

## The war research channel — RULED (user, 2026-08-17): rebuild it on option 3

**Status: SPECIFIED, NOT IMPLEMENTED.** The war half of the research events (40 of 126 technologies)
is currently **inert** — its gate can never pass — and pours ~18,720 error lines into every run.
Root cause in BUGS_AND_FIXES (2026-08-17): **`ROOT` is not a valid scope inside a
`scripted_progress_bar`**, and the gate is written there.

### Why the obvious fixes were rejected

The bar can evaluate any COUNTRY-scoped trigger (`is_at_war`, `pmr_mob_share`, `any_enemy_in_war`,
`any_scope_general`). It cannot evaluate anything that needs **us** as a target — `owner = ROOT`,
`is_at_war_with = ROOT`, `num_front_casualties = { target = root }`. That single limit rules out the
front restriction, casualty gating, and — decisively — **binding the enemy who holds the technology to
the war our general is actually fighting in**.

⚠⚠ **THAT BINDING IS ALREADY BROKEN TODAY, INDEPENDENTLY OF THE ROOT BUG.** The emitted gate ANDs two
uncoupled clauses: *some* war has *some* front with a big general of ours, AND *some* enemy in *some*
war has the technology. **GBR at war with both the USA and the Qing learns a US technology by fighting
in China.** (User, 2026-08-17.) No fix that stays inside the bar can close this.

### The ruled design

Compute the gate where ROOT is valid, store the answer on the country, let the bar read it. **Nothing
structural changes** — still three journal entries per technology sharing one progress bar.

1. **`on_monthly_pulse_country`** (country scope, ROOT valid) evaluates the real gate:
   iterate `any_scope_war`; within ONE war require both our qualifying general on one of *its* fronts
   **and** an enemy *of that war* holding the technology — the two clauses bound to the same war, which
   is the whole point. `any_participant` is the war-scoped iterator; enemies are separated from
   co-belligerents with `is_at_war_with = ROOT`, which is legal here and illegal in the bar.
2. It sets a per-technology country variable, e.g. `pmr_wargate_<tech>`, **with an expiry** (`days`)
   slightly over the pulse interval, so the flag lapses by itself and needs no clearing pass.
3. The bar's war term becomes `has_variable = pmr_wargate_<tech>` — country-scoped, no back-reference.

### Accepted approximation

`on_monthly_pulse_country` is the **finest country pulse vanilla has** (verified). War bars tick
`weekly_progress`, so the gate is re-evaluated monthly against weekly accrual: ~6 checks over a 26-week
bar, and a war ending mid-month leaks at most 3 weeks of progress. **Accepted deliberately**; the
alternative is moving war bars to `monthly_progress`, which changes the mechanic's pacing.

### ⚠ The cost this must be designed against — L3 and L4

40 technologies × a war/front/general sweep per country per month is exactly landmine **L3** (a scope
bounded today and unbounded by 1900) and **L4** (heavy sweeps in one tick). It must be **one pass that
sets all applicable flags**, not forty passes: iterate wars once, and only when the general clause holds
for that war, test which of the covered technologies its enemies hold. Most countries are at peace and
exit on `is_at_war = yes` immediately.

### Optional, once the scope is available

With ROOT valid, `num_front_casualties = { target = root }` becomes expressible, giving front
restriction and a "has actually bled" test in one trigger. ⚠ It is **not battle-only** — the loc reads
*"Total number of [Country] casualties at [Front]"*, a location filter and not a cause filter, and the
engine exposes **no** counter splitting battle from attrition (only modifiers, and the boolean
`has_high_attrition`). Do not promise a battle/attrition split; it does not exist in script.

### Verification, two stages

1. **Any short run:** the 18,720 `link 'owner'` errors go to **0**. Needs no war — they fire on every
   evaluation regardless.
2. **A run reaching a dependable war** (Opium 1839–42, Mexican–American 1846 — the two that are not
   stochastic): confirms the gate actually *passes* and bars fill. The emitter logs
   `PMR_JE|<stage>|<tech>|<country>` on completion, so firings are directly countable.
   ⚠ This gate has overshot in **both** directions — session 20260812_010659 measured military taking
   70% of all completions with micro-states firing it, and it is now never-true. Stage 2 matters more
   than usual.

### The fallback, if this is ever descoped

`war_gate.require_front: false` in the config already emits `any_scope_general = { … }` with no ROOT —
a config-only change that stops the errors and makes the gate function, while leaving the cross-war
leak in place. It is strictly worse than the design above and is recorded only as the cheap escape.

### The NAVAL channel — OBSERVATION, NOT BATTLE (user-ruled 2026-08-18, evening)

⭐⭐ **Fleet technologies do NOT use the battle gate at all.** A navy is not observed by bleeding on a
front, it is observed by *seeing the ship*. So a naval tech ticks on POSSESSION — ours or a declared
rival's — **regardless of the state of war**.

**The two sources, and they SUPERSEDE rather than stack** (explicit ruling):

| state | monthly progress |
|---|---|
| a declared **rival** owns a qualifying ship | **+1** (normal) |
| **we** own one | **+2** (double) |
| both | **+2** — no extra bonus |

**Pacing: one stage completes in 5 YEARS at the normal rate** ⇒ `monthly_progress`, `max_value = 60`.
Owning one halves it to 2.5 years. Three stages as usual.

**The gate, entirely in COUNTRY scope** — no war, no front, no general, no character:

```
# ship types S1..Sn for tech X, derived LIVE from common/ship_types (unlocking_technologies)
if      = { limit = { any_scope_ship    = { OR = { is_ship_type = ship_type:S1  … } } }  value = 2 }
else_if = { limit = { any_rival_country = { any_scope_ship = { OR = { is_ship_type = ship_type:S1  … } } } }  value = 1 }
```

⭐ **RIVALRY IS ONE-SIDED AND THAT IS THE POINT.** `common/diplomatic_actions/12_rivalry.txt` carries
**`is_two_sided_pact = no`**, so A→B needs no reciprocation, and `any_rival_country` from A's scope
iterates the countries **A has declared**. If A rivals B and B floats the ship, A's bar ticks — B's does
not, unless B has declared A in turn.

⭐ **Every component is VANILLA-ATTESTED**, which is the whole reason for this shape:
`any_country` 84 files · `any_diplomatically_relevant_country` 22 · `any_rival_country` 8 ·
`any_scope_ship` 7 (used in **country** scope, filtered by exactly `is_ship_type`) · `is_ship_type` 4.
Vanilla also nests country-scoped iterators inside `any_rival_country`, so the composite is its own idiom.
⚠ It **retires `num_mobilized_battalions`** for these techs — a trigger with **ZERO** vanilla uses,
appearing only in `trigger_localization` — and the `owner = ROOT` character link vanilla never writes.

**Self-possession covers the acquisition cases for free**: `any_scope_ship` asks what is IN the navy, not
how it arrived — bought, annexed, or taken in a peace treaty all count, which is the intent.

**The tech→ship table is DERIVED, never authored.** `common/ship_types/00_ship_types.txt` carries
`unlocking_technologies` per type, so the emitter builds it live, exactly as it already parses
production methods: `ironclad_tech` → monitor · early_ironclad · iron_frigate · troop_ship;
`monitor_tech` → coastal_defense_ship · modern_ironclad; `pre_dreadnought_tech` → pre_dreadnought ·
armored_cruiser; `dreadnought_tech` → dreadnought · light_cruiser · seaplane_tender;
`battleship_tech` → super_dreadnought; plus submarine / destroyer / torpedo_boat.

**LANDLOCKED COUNTRIES GET NO EXCEPTION** (ruled): vanilla makes none for naval tech spread or
requirements either, and such powers are too marginal to justify the machinery.
⚠ **The land tree is NOT moved to this model** — considered and deliberately deferred. The same
`unlocking_technologies` field exists in `common/combat_unit_types`, so it remains available later.
⇒ the battle gate above stays for land techs, and its 100-battalion threshold is still to be tuned down
(it is far too hard early).

### The war channel — RULED IN DETAIL (user, 2026-08-18)

**The gate** (computed in `on_monthly_pulse_country`, where ROOT is valid — all three clauses bound
inside ONE front, inside ONE war):

```
any_scope_war = { any_scope_front = {
    any_scope_general = { owner = ROOT            num_mobilized_battalions >= 100 }
    any_scope_general = { NOT = { owner = ROOT }  owner = { has_technology_researched = <tech> } }
    num_front_casualties = { target = ROOT  value >= 50000 }
} }
```

⭐ **The ruling asked for war-level binding (1a) and the casualty clause delivers FRONT-level for free.**
The threshold was specified as *"50k casualties on a front that contains a technologically superior
enemy army"*, which is tighter than 1a — and it **removes the dependency on `is_at_war_with`, a trigger
that does not exist**: a general on the opposite side of a front we are bleeding on is the enemy there
by construction, so `NOT = { owner = ROOT }` suffices. The state-ownership route proposed for 1b is
therefore not needed and is dropped.

**Pacing.** War bars move from `weekly_progress` to `monthly_progress`, `max_value = 6`, gate true =
**+1**. Six qualifying months complete one journal entry and grant `0.5 × era base cost`.
⭐ This also **retires the pulse-granularity approximation** recorded above: flag and bar both move
monthly, in step, so there is no stale-flag window at all.

**The two-term structure is retired.** `pmr_term_war_pressed` (+1 for a bare state of war) and
`pmr_term_war_enemy_has_it` (+2) collapse into ONE gate: a state of war must not tick by itself
(user, 2026-08-18), so the enemy-has-it condition folds in and the weaker term disappears.

**Flag granularity: ONE VARIABLE PER TECHNOLOGY** (40), `pmr_wargate_<tech>`, set with an expiry just
over the pulse interval so it lapses without a clearing pass. The bar reads `has_variable`.
⚠ A single shared flag was rejected: it forces the enemy test back into the bar as country-wide
`any_enemy_in_war`, which is uncoupled from the war and reintroduces the very leak this removes.
⚠ **L3/L4 cost is contained by ordering**: countries at peace exit on `is_at_war = yes`; the 40-way
technology loop runs only after a front has already passed the 100-battalion and 50 000-casualty
tests, which is rare.

**Unchanged and already correct:** the grant is an ABSOLUTE point value (`era base cost × 0.5`), so
under an ahead-of-time penalty it stays the same number of points and simply stops being half a
technology — which is the ruled behaviour.

⚠ **Known property of `num_front_casualties`, accepted:** it is total casualties at that front, not
battle-only — a location filter, not a cause filter, and no counter in the engine splits battle from
attrition. At a 50 000 threshold on a front that also holds a superior enemy army, attrition alone is
unlikely to carry it, but the term is not battle-pure and should not be described as such.

## ⭐⭐⭐ STEP 8 — THE FIRST HUMAN PLAYTEST'S DEFECT LIST (user, 2026-09-18, while playing `canon-c19-in12`; PLANNED, NOTHING CHANGED)

**The ask, verbatim:** *"Mistakes I noticed that need fixing. Don't do now as I'm still playing, but plan for fixes."* Five items, listed
below as P1–P5 in the user's own order, each investigated read-only against the shipped canon and the measured runs. **P6 is not the user's —
it was found while investigating P1 and is the supply-side root cause of it.** Nothing here is implemented; nothing may be built or deployed
while a playthrough is live (a build overwrites the deployed copy under the player).

---

### P1 — THE EARLY RUNGS ARE A MONEY PRINTER (especially e1). CONFIRMED, and worse than the realised margins suggest.

**The user:** *"Probably need to reduce the A/B diff, or invent a more complex ladder than A^N / ((input_t0_penalty+1)*B^N). The game quite
actively resist prolonged prices under base for most goods, maybe some ladder of +70 .. +0 (base) between 1830s and 1920s can be constructed?"*

**Measured — every rung's margin AT BASE PRICES** (`(out − in − wages) / (in + wages)`, wage_pct 0.25, from the shipped config):

| industry | e0 | e1 | e2 | e3 |
|---|---|---|---|---|
| food / textile / furniture | +5.5% | **+54.6%** | +127% | +233% |
| glass / tooling / paper | +25.0% | **+83.3%** | +169% | +294% |
| steel | −18.8% | +19.2% | +74.8% | +156% |
| fertilizer | −11.2% | +30.3% | +90.9% | +180% |
| arms | +40.6% | **+106%** | +203% | +344% |
| art academy | +108% | +206% | +348% | +556% |

against **vanilla's whole manufacturing sector at 23.1% realised**. The realised mod figures (e0 26% / e1 31% / e2 47% / e3 46% at 1935) are
much lower only because prices have fallen by then — **in the decades when a rung is new, it earns the base-price number**, and that is what
the player is feeling.

**The arithmetic behind it, which is the thing to fix.** Every rung is `output × A^era` over `input value × in0 × B^era`, so the output-to-input
RATIO steps by `A ÷ B = 2.2 ÷ 1.5 = 1.467` per era. Because rung 0 is anchored at roughly break-even (O ÷ total cost ≈ 1.05), **a multiplicative
step in the ratio lands as a huge additive step in the margin**: 1.05 → 1.54 → 2.27 → 3.33, i.e. +5% → +55% → +127% → +233%. The ladder's
steepness is not really "A" — it is the GAP, and the gap is being applied to a base of ~1.0 where it is at its most violent.

**Three fixes, in increasing order of ambition. They are not exclusive; (b) is the tactical version of (c).**

**(a) Shrink the A/B gap.** To put e3 near +60% with e0 at +5%, the gap must be `r³ = 1.60 ÷ 1.05` ⇒ **r ≈ 1.15**, e.g. A 2.2 / B 1.91 or
A 1.73 / B 1.5 — against today's 1.467. ⚠ This is the SAME lever F135 identified for the hoard (the pool's inflow is our doubled margins), so
two independent problems point at it, which is a reason to try it and a reason to expect it to move a lot at once. ⚠ It also shrinks how much
price decline the frontier can absorb before it dies too — the frontier's cushion IS the gap.

**(b) A non-geometric ladder — an explicit per-era vector.** The user's "more complex ladder". Half the machinery exists: `make_ab_config.mjs`
already takes `--tiers-for "<ind>:out=…;in=…;cost=…"` for ONE industry and `--cost-ladder` per era globally. **The work is to generalise
`--tiers-for` into a global `--out-ladder` / `--in-ladder`** and then author the vector from a DESIGNED margin ladder rather than from a ratio —
e.g. target margins 5 / 25 / 40 / 55% and solve the output and input vectors backwards. This is the smallest change that ends the money printer
without committing to a price theory.

**(c) ⭐ DESIGN AGAINST A PRICE PATH INSTEAD OF AGAINST BASE — the user's "+70 .. +0" — and it is measurable that this is the game's own shape.**
Measured, British market, price as % of base, medians (vanilla n=16 / the canon n=4):

| good | 1836 | 1870 | 1900 | 1935 | | 1836 | 1870 | 1900 | 1935 |
|---|---|---|---|---|---|---|---|---|---|
| | **vanilla** | | | | | **canon** | | | |
| groceries | 175 | 124 | 110 | 116 | | 175 | 113 | 90 | 98 |
| fertilizer | 138 | 114 | 109 | 99 | | 156 | 123 | 118 | 82 |
| explosives | 135 | 128 | 114 | 102 | | 158 | 136 | 88 | 66 |
| steel | 100 | 118 | 107 | 111 | | 104 | 139 | 68 | 72 |
| clothes | 79 | 112 | 116 | 105 | | 56 | 108 | 82 | 88 |
| small_arms | 104 | 81 | 77 | 72 | | 107 | 97 | 64 | **29** |
| artillery | 105 | 72 | 80 | 78 | | 105 | 100 | 60 | **25** |
| automobiles | — | — | 175 | 142 | | — | — | 154 | 102 |

⭐ **The user's instinct is right and the game already does it for the goods that can**: several goods START well above base (groceries 175,
fertilizer 138–156, explosives 135–158, automobiles and telephones at the +75% band ceiling on debut) and decay toward base. So the design
could stop asking for sub-base prices and instead **set a per-era target price path (say 170 / 145 / 120 / 100 of base) and derive each rung's
break-even as a fixed margin below its OWN era's price.** Rung 0 would break even near 150: profitable at 1836's 170, dead by the time the price
reaches 120. That is the obsolescence mechanism stated in the units the engine actually delivers, and it stays inside the solvency bound
(target_be ≤ 175, §10.63).

⚠⚠ **But it CANNOT be one path for all goods, and F136 says why.** Where demand is exogenous or inelastic the price really does collapse — the
canon's small arms reach **29** and artillery **25** of base, which is exactly why those chains obsolete perfectly. Where pops buy the output the
price is pinned near base by rising pop wealth (clothes 88, groceries 98) — F97's mechanism — and no recipe can move it. ⇒ **a price-path design
needs at least two classes: a falling path for building-fed and army-fed goods, and a flat-at-base path for pop-fed goods, where obsolescence has
to come from somewhere other than the output price.** What that "somewhere else" is for the pop chains is the open design question this playtest
has sharpened; the standing candidate is labour cost (every rung employs 5,000/level regardless of era, so the old rung's wage bill per unit of
output is ~10× the frontier's, and rising SoL should bite it) — and F136 shows that today it does NOT bite hard enough (textile e0 still earns
21% against its own frontier's 25%).

⚠ **(c) has a prerequisite: P6 below.** Designing rung 0 to break even at 150 requires the 1836 price to actually BE ~170. It is not — the canon's
1836 clothes read 56 of base and tools 21 — and P6 is why.

---

### P6 (NOT the user's; found while investigating P1) — ⚠⚠ THE 1836 ANCHOR IS BROKEN ON THE SUPPLY SIDE, IN PROPORTION TO HOW MANY STARTING FACTORIES SIT ABOVE RUNG 0

**The measurement.** British market at 1836.2.1, canon (n=4) against vanilla (n=16) — buy orders agree within a few percent everywhere, and
PRODUCTION does not:

| good | vanilla prod | canon prod | | vanilla price | canon price | share of that industry's 1836 factories above e0 |
|---|---|---|---|---|---|---|
| tools | 1,889 | **3,428 (+81%)** | | 41 | **21** | **71%** (tooling: 10 e0 / 16 e1 / 9 e2) |
| groceries | 534 | **817 (+53%)** | | 53 | 53 | 38% (food: 20 e0 / 12 e1) |
| clothes | 6,578 | **8,510 (+29%)** | | 24 | **17** | 22% (textile: 73 e0 / 21 e1) |
| paper | 971 | 1,146 (+18%) | | 41 | 37 | 18% |
| steel | 562 | 559 (+0%) | | 50 | 52 | **0%** |
| small_arms | 640 | 603 (−6%) | | 63 | 64 | **0%** |
| fertilizer | 253 | 236 (−7%) | | 42 | 47 | **0%** |

**The correlation holds industry by industry, and FINDINGS F137 re-does it properly in LEVELS world-wide** (tooling +88% output against a
vanilla-equivalent ladder, munition +65%, food +29%, furniture +25%, glass +23%, textile +18%, paper +15%, and an exact **0%** for every industry
wholly on rung 0). 26% of the 392 converted starting factories (93 on e1, 9 on e2) land above rung 0. ⚠ Furniture is +25% world-wide but only +4%
in the British market, because that market’s furniture is mostly BIC’s and India’s, all on rung 0 — a per-market figure is the world mechanism
filtered through market membership.

**The cause is structural.** Our rung *e* produces `vanilla method 1 × A^e` = ×2.2 at e1 and ×4.84 at e2, while the VANILLA method that building
was actually running produces only ~1.33× and ~1.8× method 1 (measured: clothes 45 → 60 → 100 → 140; steel 65 → 90 → 120 → 150). So a starting
building converted onto e1 makes **1.65×** what it made in vanilla, and one converted onto e2 makes **2.7×**. Tooling, where 71% of the starting
workshops are above rung 0, is the worst case and shows the largest price collapse.

⇒ **The "1836 matches vanilla" premise holds for composition and for demand, and is violated for supply and therefore for price.** This has been
true of every A-ladder book and was never measured, because the anchor check (`extract_start` / L13) compares the building MAPPING, not the goods
it then produces.

**Fix options** (all need a ruling; the first is the cheap one):
1. **Scale a converted building's LEVELS by the inverse of its rung's output multiplier** — a building converted to e1 comes in at `levels ÷ 2.2`
   (rounded, floor 1). The mechanism already exists for the graded ports (`workforce_mult`, §10.60.2, and `convert_history.ps1` already does
   `levels × 1/workforce_mult`). Keeps vanilla's output, halves the capital stock those states start with. ⚠ Changes the starting building COUNT,
   which the player sees.
2. **Convert everything onto rung 0** regardless of the vanilla method it ran, and let the AI climb. Simplest, and it makes the 1836 map
   uniformly "pre-industrial", which is arguably what era 0 means. ⚠ Loses the historical distinction between an advanced and a backward 1836
   economy — probably unacceptable.
3. **Leave it and re-anchor the design on the measured 1836 prices** instead of on vanilla's. ⚠ Incompatible with (c) above, which needs a HIGH
   1836 price.
4. **The recorded "distant possibility" (§10.83): an OUTPUT-goods penalty on the e0 recipes**, which would raise 1836 prices directly. It was
   written down explicitly as not-to-be-tried-without-a-ruling; P6 is the first concrete argument for it.

---

### P2 — THE URBAN-CENTRE ELECTRICITY OVERRIDE WAS LOST. ✅ **FIXED 2026-09-19** (user, mid-batch: *"stop now, fix the electricity and restart"*).

✅ **DONE, and put where a rebuild cannot drop it again.** The override now lives in **`tools/lib_tier4_spec.mjs`** as
`PM_GOODS_RULED` / `PM_EMPLOYMENT_RULED` and is emitted by **`make_tier4_config.mjs`** into every generated book —
`pm_goods.pm_electric_streetlights = {in:{coal:2}, out:{services:10, electricity:1}}` and
`pm_employment.pm_electric_streetlights = {engineers:250}`, **byte-identical to `config/mod_config.six_rung.json`**, which is the
parity the user asked for. It was a hand-edited config key before, and a hand edit is exactly how the 2026-09-04
rebuild-from-vanilla lost it. Verified end to end on `probe-anch-in12`: the emitted
`common/production_methods/06_urban_center.txt` diffs against vanilla in **four lines and only on that one method** — electricity
3 IN → coal 2 IN, `goods_output_electricity_add = 1` added, 200 laborers + 50 engineers → 250 engineers, and the now-meaningless
`required_input_goods = electricity` dropped; `pm_gas_streetlights` and every other urban-centre method untouched. Every linter
passes, negative-goods included. Regenerating the book changed **exactly two top-level keys and no rung**.
⭐⭐ **RULED CANONICAL ON ITS OWN, 2026-09-19** (user: *"Make the notes to canonize the ruling on electricity within Urban Centers,
regardless of whether we adopt any other changes"*). **BALANCE_FRAMEWORK §10.43.0 is the record.** It does not ride on the anchor
slide, the in0 sweep or the split lift: whatever book becomes the canon next carries this override. ⭐ The user's own prediction,
recorded to be checked rather than assumed: the dominant effect is **player CONVENIENCE** — electrifying a state no longer depends
on arranging supply for it first, so the player is not switching methods state by state as the grid arrives — with a real but
**small** economic effect. Nothing has measured either half yet; the anchor probes could not (the method is technology-gated and
unreachable in 1836–1838), and `20260919_224153_anch-in12-century-n3` is the first century run carrying it.
✅⭐ **AND THE CANON CARRIES IT SINCE 2026-09-20 — CLOSED.** Regenerated through the vanilla-only pipeline and canonized as
**`canon-c19-in12-elec`** (`config/mod_config.json` is a verbatim copy). The diff against the shipped book was PROVED to be the
two keys: no industry, rung, recipe, `building_cost`, `ai_value`, technology or define moved, and the tech-tree twin came back
with **zero** field diffs (the rest is 12 `_ab` flags going absent → explicit `null`, plus the book's own name and stamp). Built
and deployed; every linter, L18, L31, MOD CHECKS, PREFLIGHT.
⚠ **`config/mod_config.canon-c19-in12.json` keeps its own bytes and is NOT the canon** — it is the record of the arm F131
measured over four seeds, which ran WITHOUT the override. A named book is the record of what it measured.
⚠ **The second-difference warning still applies in the other direction**: the canon's own century runs (`20260917_132449` /
`20260917_161410`) predate the override, so an arm read against them still carries it as a second difference until a century
batch runs on this book. Nothing has measured its economic effect.
⚠ **The power chain around it is deliberately NOT restored** (user-ruled the same day): the regular power-plant industry stays
vanilla — no tiering, no other change, now or deferred — and the dam megaproject is a polishing-phase item. So this book has both
the municipal electricity source and vanilla's own Early Power Plant, where §10.43's six-rung design had the municipal source
*instead of* it. That is intended, not an oversight.
⚠ **Power-plant content rides along in both owned `06_urban_center` files and cannot be spared** — `building_power_plant` in the
buildings file (owned since `canon4v` because the art academy shares it) and `pm_early_power_plant` in the production-methods file
(owned for this override). Both blocks are **byte-identical to vanilla**, so there is no behavioural change; the cost is patch
drift, recorded in `ON_GAME_UPDATE.md`.

(the original report follows)

**The user:** *"We somehow lost most of the custom modded additions to electricity (making Urban Center PM produce electricity rather than
consume it). They were there several canon versions ago, but now they aren't."*

Correct, and the loss is recorded in CLAUDE.md's own canon4v entry: *"NOT carried from the six-rung book: the hoard defines, **the streetlight
override**, the trade-centre ai_value, …"* — i.e. it was dropped deliberately when canon4v was built from vanilla on 2026-09-04 and never
restored. Verified in the shipped canon: `pm_goods` and `pm_employment` are both **empty**, and the mod emits no `06_urban_center.txt`
production-methods file at all. The six-rung book still carries it:

| | vanilla `pm_electric_streetlights` | the six-rung override (§10.43) |
|---|---|---|
| inputs | **3 electricity** | **2 coal** |
| outputs | 10 services | 10 services **+ 1 electricity** |
| employment | 200 laborers + 50 engineers | **250 engineers** |

**The fix is a straight port** of two config keys (`pm_goods.pm_electric_streetlights`, `pm_employment.pm_electric_streetlights`); the emitter
already handles the `required_input_goods = electricity` line that must be dropped when the override removes the electricity input (the trap is
documented in the `pm_goods` entry).

⚠⚠ **One design question must be answered first, and it is why this is not a pure restore.** In the six-rung book the override was half of a
PAIR: §10.43 also DELETED vanilla's era-3 "Early Power Plant" tier, on the reasoning that the 1900 municipal engine-house is what urban centres
model. **The four-rung canon does not tier `power` at all — vanilla's whole power-plant chain is intact.** Restoring the override alone gives the
world municipal generation *and* vanilla's early power plants, which is not what either design intended. So: restore the override and accept the
overlap, or restore it and suppress vanilla's early power plant, or leave power wholly vanilla. ⚠ Also note §10.43.2's calibration is specific —
**2 coal was ruled**: 1 left the mandate too profitable, 3 forced a loss-maker — and that was calibrated on the six-rung economy, so it should be
re-checked against this one.

---

### P3 — ✅ FIXED AND DEPLOYED 2026-09-18. The building name said "BE TARGET": two separate defects in one label.

**The user:** *"building titles still say BE Target, despite the ruling that we're not using this, and rather show the factual recipe value-added
BE (with wages ignored)."*

Today (`tools/build.ps1:590`): `". BE target $([math]::Round($actualBe))%"`, so a building reads
`Era 1. Food Industries (Sweeteners). BE target 65%`. Two things are wrong:

1. **The word is wrong.** The number is NOT `target_be` — `$actualBe` is computed from the emitted recipe (`build.ps1:534`). The config's
   `target_be` survives only as a drift guard for the linter. So the label describes the value as a design target when it is a measurement of
   the recipe.
2. **The basis is wrong for what the player wants.** `actualBe = actualI / (1 − wage) / Oval × 100` is the WAGE-INCLUSIVE break-even. The
   goods-only figure the user asks for is simply `actualI / Oval × 100` = the same number × `(1 − wage_pct)` = **×0.75** at the default. Food
   e1 would read **49%** instead of 65%, textile e0 **71%** instead of 95%.

**Fixed in `build.ps1`**: a goods-only `$goodsBe = $actualI / $Oval * 100` and the label `". Recipe BE N%"`. Verified in the build — food e0 now
reads `Era 0. Food Industries (Bakeries). Recipe BE 71%` and e1 `Recipe BE 49%`, where they read 95% and 65%. ⚠ Three consumers must stay in step: the `$summary` object and `tools/ladder_tiers.txt` (the linter reads the
latter and its `target_be` column must NOT change basis, or `lint_profitability.awk` starts failing), and the UI, which shows its own BE.
⚠ State plainly that this is a property of the RECIPE at base prices — the player's actual building will differ, because throughput bonuses,
economy of scale, company modifiers and active secondary methods all move it.

---

### P4 — ✅ FIXED AND DEPLOYED 2026-09-18. ⚠ MY FIRST DIAGNOSIS WAS WRONG AND THE USER CORRECTED IT.

**The user:** *"the causes for JE tick are not explicit yet (e.g. 'at least 25k people employed in automotive industry era N')."*

⚠⚠ **THE UNITS READING BELOW WAS WRONG.** The user, from the live campaign: *"the tooltip now doesn't work at all, saying stuff like 'the condition
to increase based on enough workforce is fulfilled' rather than the actual condition."* The loc keys all resolve (checked: 43 of 43 present), so
this was never a missing-string problem — **the engine was ignoring our `desc` and auto-describing the condition instead.**

⭐ **THE CAUSE: the wrong nesting.** We emitted `add = { desc = "…"  if = { limit = {…} value = 1 } }` — the `desc` on the OUTER add, the `if`
inside it. The game's own `scripted_progress_bars.md` documents that shape, which is why it was written; but **vanilla ships the OTHER shape 224
times against this one's 5**: `if = { limit = {…}  add = { desc = "…"  value = 1 } }`. With the `desc` on the inner `add`, the engine uses it.
**Fixed in `emit_research_events.mjs`**; EXCLUSIVE terms keep their exclusivity through `if` / `else_if` at that level (vanilla does the same in
00_ep2_ryukyu_rivalry and 00_sepoy_mutiny), so "supersedes" still cannot become "stacks" — and every branch now carries its OWN description
instead of sharing the first term's.

⚠ **The units observation below stands as a SEPARATE, still-open readability point** (it was not what the user was seeing):

- level-counted source — `pmr_src_combustion_engine_0` returns **Σ level × occupancy**, and the tooltip reads
  *"$building_motor_industry_electric_engines$: at least 15 fully staffed levels (75,000 workers at the base method's staffing, labour saving and
  other staffing changes calculated correctly); now [15 → a LEVEL count]"*. The prose leads with levels, parenthesises people, and the live
  figure is levels — so "now 7" sits next to "75,000 workers".
- people-counted source — `pmr_src_aniline_1` returns **PEOPLE**, and reads *"Workers in $bg_light_industry$: at least 12,500; now […]"*.

Aniline's own bar carries one of each, with the same underlying 12,500-people mark expressed as "3 fully staffed levels" in one line and
"12,500" in the other.

**The fix:** make every source read in PEOPLE. `tierEmp()` already computes per-level employment, so a level-counted source becomes
`Σ level × occupancy × employment` in the script value, and the tooltip collapses to one unit and one sentence — the user's own phrasing,
*"at least 25,000 people employed in <industry>, Era N; now X"*. ⚠ Two knock-ons: the threshold constants in the emitted bar (`>= 15`) must be
converted with the same multiplier, and the long parenthetical (*"at the base method's staffing, labour saving and other staffing changes
calculated correctly"* — the user's own wording of 2026-09-03) should be shortened but must keep its meaning, which is that the figure stays
right when automation changes a building's staffing. ⚠ P3 improves this for free: the building names these tooltips interpolate currently end in
"BE target 65%".

---

### P5 — TIER-3 OUTPUT IS ENORMOUS. CONFIRMED and quantified; the user is inclined to accept it.

**The user:** *"some tier3 output is just insane (e.g. fertilizer). Maybe this doesn't really need fixing though. An increase in minimum viable
firm size is a desirable thing to simulate."*

Measured against the game's own files:

| industry | vanilla's whole method ladder | our ladder | our top ÷ vanilla's top |
|---|---|---|---|
| fertilizer | 90 → 140 → 200 (3 methods) | 90 → 198 → 436 → **958** | **4.8×** |
| steel | 65 → 90 → 120 → 150 | 65 → 143 → 315 → **692** | **4.6×** |
| textile (clothes) | 45 → 60 → 100 → 140 | 45 → 99 → 218 → **479** | **3.4×** |

**Vanilla's four methods multiply output by ~2.3–3.1× end to end (about 1.33× a step); ours multiplies by A³ = 10.65× (2.2× a step).** Fertilizer
is the extreme because vanilla gives it only three methods while our ladder gives it four rungs.

**Recommendation: ACCEPT, with one caveat and one consequence.** The caveat: the 10.65× is the same number that produces P1's margin explosion,
so **anything done to P1 moves this automatically** — if the output ladder is re-authored per era (P1 fix (b)) or the gap is shrunk (fix (a)),
tier-3 output comes down with it, and P5 should not be given a separate lever. The consequence worth stating: employment is FLAT at 5,000 per
level across every rung, so a ×10.65 output step is a ×10.65 step in output per worker — which is precisely the "minimum viable firm size"
the user wants, and also precisely why the frontier out-earns the old rung at all. Cutting it without cutting the input ladder would kill the
ladder's whole mechanism.

---

### P7 — ✅ FIXED AND DEPLOYED 2026-09-18, with a detector (landmine L35). A minted top rung was locked out of its industry's gated secondary.

**The user:** *"our additional late-game tiers can disallow modern secondary PMs when the locks are done through explicit naming of all compatible
primary PMs. Example: T3 furniture doesn't allow adding top luxury furniture secondary PM."*

Exactly right, and the scope is now bounded. Vanilla gates a secondary method by naming the main methods it may sit beside
(`unlocking_production_methods`), and **the whole game has exactly three such gates, all in `01_industry.txt`**: `pm_elastics` (textile luxury),
`pm_precision_tools` (furniture luxury), `pm_bone_china` (glass porcelain). The builder whole-file-replaces that file and appends OUR tier
`pm_key` for each vanilla main PM the list names — through the map `vanilla_pm` → `pm_key`. **A MINTED rung has no `vanilla_pm`, so it is in no
map and gets no append.** What ships:

| gate | vanilla names | we append | our rung that is MISSING |
|---|---|---|---|
| `pm_elastics` (textile) | `pm_sewing_machines`, `pm_electric_sewing_machines` | our e2, e3 | — (textile has four vanilla methods) |
| `pm_bone_china` (glass) | `pm_crystal_glass`, `pm_houseware_plastics` | our e2, e3 | — (glass has four) |
| **`pm_precision_tools` (furniture)** | `pm_lathe`, `pm_mechanized_workshops` | our **e1, e2** | ⚠ **e3 `pm_main_furniture_spray_finishing` — the minted rung** |

⇒ **One live case today, and it is the one the user found.** The canon has three minted rungs — furniture `spray_finishing`, paper
`continuous_web_processing`, fertilizer `catalytic_synthesis` — and only furniture's industry carries a gated secondary, so only furniture is
bitten. **It is a latent trap for every future addition**, and it is a textbook landmine: the build passes, every linter passes, the mod loads,
the game runs, and the player simply cannot select a method.

**FIXED 2026-09-18, at BOTH sites — there were two.** `$script:pmRemap` in `build.ps1` is now `vanilla_pm` → a LIST of `pm_key`s, and
`emit_secondaries.mjs` made the same `vanilla_pm` test a second time when minting the per-rung copies. Verified in a real build: the furniture
gate names `pm_main_furniture_spray_finishing`, and `pm_precision_tools_furniture_manufactory_spray_finishing` is minted beside the e1 and e2
copies (6 per-rung copies → 7). **Landmine L35 added to `preflight.ps1` and TESTBED_LANDMINES.md, proven both ways by sabotage.**

**What was done (the plan as written, for the record):**
1. **A minted rung inherits the gate membership of the rung below it.** The generator already copies an addition's recipe, staffing and icon from
   the rung beneath; gate membership should ride along by the same logic — an addition is "the method after X", so wherever X is allowed, it is.
   Implement as: when building the `vanilla_pm` → `pm_key` map, a rung with no `vanilla_pm` is registered under the `vanilla_pm` of the nearest
   rung below it that has one.
2. ⭐ **A DETECTOR, because this is a landmine and the register's own rule is that an entry needs one.** For every
   `unlocking_production_methods` list in the emitted files: if any rung of industry I appears in the list, **every higher rung of I must appear
   too**. Cheap, reads the ARTIFACT not the generator, and would have caught this on the first build after the addition was minted. Belongs in
   `preflight.ps1` as a new landmine ID with its entry in TESTBED_LANDMINES.md, and must be proven by breaking it on purpose.

⚠ Scope checked: the three gates above are the only ones in `common/production_methods` that name a main method we split. Gates elsewhere in the
game (ship modifications, company `possible` blocks) are a different mechanism and are catalogued in MISSING_PM_REFERENCES.md.

---

### P8 — AN e3 TAKES 2+ YEARS TO BUILD. CONFIRMED, reproduced to the year, and the cause is NOT the construction sector's size

**The user:** *"e3 construction takes too much time. It may make sense from economic PoV or maybe even narrative PoV, but this is just unfun to
construct a new industry tier for 2+ years."*

**1. It is the COST, one-for-one.** V3 has no construction-time field: a building's time is `required_construction ÷ the points per week it is
allocated`. Our e3 costs **4,115** points (600-anchor industries) and **5,487** (800-anchor) against vanilla's flat 600 / 800 — **×6.86**. So an
e3 takes 6.86× as long as the same building does in vanilla, in any queue, at any date. **Build time and capital cost are the same dial in this
engine**, which is why this item cannot be fixed without touching one of them.

**2. The capacity is ample — it is the QUEUE that divides it.** Britain's own construction sector in the canon (run 1): 65 levels at 1860 → 173
at 1900 → 398 at 1920 → **1,316** at 1935. If one e3 got ALL of Britain's points it would take **6.3 weeks at 1860 and 0.3 weeks at 1935**. The
2+ years is entirely the split across a queue.

**3. Reproduced to the year.** Britain's GOVERNMENT queue — the player's own — at 1900 runs at **327 points/week over 10 items**, i.e. ~33 per
item. `4,115 ÷ 33 = 126 weeks = ` **2.4 years**, which is exactly what the user reports. The same arithmetic in vanilla: `600 ÷ 33 = 18 weeks`.

**4. And the private queue is worse, which is the AI's build time and the world's:**

| | canon Britain | | | vanilla Britain | | |
|---|---|---|---|---|---|---|
| year | private items | points left | **points per item** | private items | points left | **points per item** |
| 1900 | 130 | 93,332 | **718** | 73 | 21,764 | 298 |
| 1920 | 511 | 335,641 | **657** | 186 | 93,250 | 501 |
| 1935 | **1,000** | 1,277,140 | **1,277** | 126 | 35,021 | 278 |
| backlog | 1.1 → 1.6 → **2.4 y** | | | 0.3 → 0.7 → **0.2 y** | | |

Two compounding causes: **each item is dearer** (up to 4.6× the points of vanilla's average queued item) **and the queue is longer** (1,000
against 126). ⚠ The 1,000 is a CEILING being hit — `CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED_MAX = 999` — and **we doubled
the coefficient that gets there**, from vanilla's 0.05 to **0.1**, in §10.75.

**5. ⚠ The player's share of the throughput is small and shrinking.** The private pool takes **83% / 74% / 76%** of Britain's construction speed
at 1900 / 1920 / 1935 (F132 read 87% / 81% on the eager book). So the player's own queue is drawing on a quarter of the country's capacity while
each of their buildings costs 6.86× vanilla's. **P8 is the hoard defect (F135) seen from the player's chair**: a large investment pool owns the
construction sector's output, and what is left for the player is slow.

**The fix options.**

**(a) Flatten the top of the cost ladder.** `make_ab_config --cost-ladder m1,m2,m3` already exists and does exactly this per era. ⚠ It is the
same dial F135 measured as the hoard's lever — log world GDP regresses on log C at −3.34 — so cutting e3's cost to, say, 3× rung 0 (from 6.86×)
is a large economic move, not a cosmetic one. **This is the honest, direct fix and it costs GDP.**

**(b) ⭐ MAKE CONSTRUCTION ITSELF GET FASTER WITH THE ERA, in step with the cost ladder — the only option that keeps the capital cost AND cuts the
time.** Vanilla's construction methods give **2 → 5 → 10 → 15** points per level (base → iron frame `urban_planning`, era 1 → steel frame
`steel_frame_buildings`, era 3 → arc welded `arc_welding`, era 5). Our cost ladder is **1 → 1.9 → 3.6 → 6.86**. Level-weeks per building:

| | 1836, e0 at iron frame | 1930, e3 at arc welded |
|---|---|---|
| cost ÷ points per level | 600 ÷ 5 = **120** | 4,115 ÷ 15 = **274** |

⇒ **an e3 at the best construction method still takes 2.3× the level-weeks an e0 took in 1836.** Equalising it needs arc welding at ~**34**
points/level instead of 15 (×2.3) and steel frame at ~**18** instead of 10 (×1.8). ⚠⚠ **Their GOODS must be scaled by the same factor**, or each
construction point costs less in real resources and the capital cost falls with the time — which is exactly goal 3 undone. ⚠ Implementation: the
points figure is `country_construction_add`, a building modifier, not a goods line, so `pm_goods` cannot reach it — **the builder would have to
own `common/production_methods/13_construction.txt`** (a small file; the same whole-file-replacement pattern it already uses for `01_industry`).
⚠ It is also a GDP lever — a country with the same construction sector builds faster, so more gets built — and must be measured, not assumed.

**(c) Put `CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED` back to vanilla's 0.05.** We doubled it to 0.1 in §10.75 for the
investment pool, and **F125 later exonerated the queue cap for the hoard** ("the queue cap is exonerated"), so it can go back at no known cost.
Halves the AI's queue depth ⇒ roughly halves each AI building's time. ⚠ It is an **NAI** define: it speeds the AI and the world economy and does
**nothing** for the player's own government queue.

**(d) Fix the inflow instead.** The private pool's 74–83% share of construction speed is a consequence of our doubled margins (F135). Compressing
the A/B gap — already wanted by P1 and by the hoard — would shrink the private queue and give the player's own queue a larger share.

⭐⭐ **THE CONVERGENCE WORTH NOTING: three separate complaints now point at the same two dials.** P1 (the money printer) and the hoard both want
the **A/B gap** compressed; P8 and the hoard both want the **cost ladder** flattened at the top. Neither is free — F135 measured the cost axis at
1.73% of hoard per 1% of world GDP — but a single campaign that moves both, with (b) compensating the build time, is the coherent next
experiment rather than six separate ones.

⚠ **What this does NOT establish:** the exact allocation rule V3 uses to split points across a queue (the arithmetic above assumes an even split,
which reproduces the user's 2.4 years and vanilla's queue behaviour, but was not read out of the engine); and whether a player with a *short*
queue experiences the same thing — the measurement is of Britain's AI-run queues plus the user's own report.

---

### P9 — ⭐ REGISTERED DESIRE: THE TECH TREE SHOULD BE A THING TO PRIORITISE, NOT TO COMPLETE (user, 2026-09-18, after finishing a Brazil campaign)

**The user:** *"I'd prefer the late game techs to be less accessible. In this game as Brazil (so a low-tech low-literacy start) I ended up maybe 5
techs short from the absolute full tech situation. Sounds excessive. I hoped that highest tier techs will be less prevalent. I'm not sure that
this needs acting upon, but if there are other ideas that would require changing all this, please register the desire to make the tech tree less
a thing 'to complete', and more a thing to prioritise."*

**Registered as a standing design desire, not as a scheduled fix** — and it is the one item on this list that the mod has never addressed.
FINDINGS **F138** has the measurement; the short version:

- **It contradicts the mod's own governing ANCHOR PRINCIPLE**, which says in as many words that *"even an experienced player should finish a whole
  tree only when unusually lucky, playing a strong nation, and probably neglecting the other trees."*
- **The tree was never made deeper**: 182 technologies against vanilla's 178 — three minted, ~2%.
- **The AI completes it identically to vanilla**: top 94% against 95%, and the two distributions match at every quantile.
- **The human advantage is ~35–50 technologies**: AI-run Brazil reaches 127–143 of 182; the user reached ~177.
- ⚠ **The one mechanism the mod added pushes the wrong way**: the research journal entries grant **1.5× each covered technology's entire base
  cost** over their three stages, across **126** technologies — two stages already pay for the technology and the third is surplus. It was added
  to compensate for a depth increase that never happened.

**Levers, cheapest first. None is scheduled; all are cheap to try except the last.**

1. ⭐ **Cut `grant_fraction`** (config `research_events.grant_fraction`, today **0.5**). At 0.5 a filled bar pays 150% of the technology; at
   **0.15** it pays 45%, which is a real reward for building the industry without handing the technology over. **One config number, no generator
   change.** ⚠ It changes the research-event arm that F102/F107 measured, so it needs a batch — but it is the single highest-leverage knob here.
2. **Drop a stage** (`stages`, today three: inception / development / implementation). Two stages at 0.5 still pays 100%; three stages at 0.25
   pays 75%. Combining (1) and (2) is the same dial twice — pick one.
3. **Make the late eras genuinely harder** rather than the early ones cheaper: raise `TECH_AHEAD_OF_TIME_PENALTY_FACTOR` above vanilla's 0.25
   (⚠ we currently emit exactly 0.25, i.e. a no-op that has been flagged on the UI's Mod-changes page for months), or raise the era base costs for
   eras 4–5 specifically. **This is the lever that matches the user's words most directly** — "highest tier techs less prevalent" — because it hits
   the top of the tree and leaves the bottom alone.
4. **Actually deepen the tree** — the thing ROADMAP step 1 set out to do and did not. ⚠ Expensive, and it must respect the rule that vanilla
   technologies are never emptied or deleted (`audit_tech_content.mjs`, and the 2026-08-30 ruling); a deeper tree means MINTED technologies with
   real content, which is a content project, not a tuning one.
5. **Restore a research cost or spread malus** — the 2026-08-12 ruling withdrew the tech-spread boost on the reasoning that the deeper tree was
   *"compensated aplenty by the research journal entries"*. F138 §5 shows the compensation shipped and the depth did not, so **the premise of that
   ruling is void** and the spread knobs (the tech-tree page's panel) are open again.

⚠ **What would settle it cheaply**: the completion curve is already in every run's save summaries (`technologies` per country per year), so any
future batch can report "technologies held at 1936, top / p95 / median" at no cost. **Add it to the criteria register as a read-only line** so the
next configuration change does not move it unnoticed — it is not an aim today and should at least be watched.

---

### Ordering, and what each fix costs

| | item | kind | cost | blocks / blocked by |
|---|---|---|---|---|
| 1 | **P3** the BE label | emitter, 2 lines | minutes | improves P4's text for free |
| 2 | **P4** JE units | emitter + script values | a few hours | eased by P3 |
| 3 | **P7** the minted rung's locked secondary | generator + a new landmine detector | hours | none |
| ✅ | **P2** the electricity override | config, 2 keys | ✅ **DONE 2026-09-20** — canonized as canon-c19-in12-elec, the two-key diff proved | its economic effect is still unmeasured |
| 5 | **P6** the 1836 supply anchor | converter or generator | a day + a batch | **blocks P1 fix (c)** |
| 6 | **P8** e3 build time | the cost ladder, or owning `13_construction.txt` | a campaign — **it is the same dial as P1 and the hoard** | see the convergence below |
| 7 | **P1** the ladder | generator + a config sweep | the next measurement campaign | needs P6 for (c); (a)/(b) can go first |
| 8 | **P5** top-rung output | — | none | rides on P1 |
| — | **P9** the tech tree is completable | REGISTERED DESIRE, unscheduled | one config number to try (`grant_fraction`) | independent of the rest |

⭐⭐ **THE CONVERGENCE.** P1 (the money printer), P8 (build time) and the hoard (F135) are three complaints about two dials: **the A/B gap** —
wanted compressed by P1 and by the hoard's inflow — and **the cost ladder** — wanted flattened at the top by P8 and by the hoard's absorption.
Neither is free (F135 measured the cost axis at 1.73% of hoard per 1% of world GDP), and P8's option (b) — scaling the late construction methods'
points AND goods so build TIME stays flat while capital COST keeps rising — is the one move that buys P8 without spending GDP. **One campaign
that moves both dials with (b) compensating is the coherent next experiment, not six separate ones.**

P3 and P4 are cosmetic-to-local and can be done in one pass without a measurement batch. **P2 IS DONE** (2026-09-20) and its slight economic
effect should be read in the next batch, not chased on its own. P6 and P1 are the real work and belong to one campaign, because P6 changes the 1836 prices that P1's recipes
would be designed against. ⚠ Nothing in this list may be built or deployed while a playthrough is live.

## ⭐⭐⭐ STEP 9 — THE MARGIN-COMPRESSION CAMPAIGN (the user's steer, 2026-09-18: "I really want to decrease margins across the board, in both early tiers (a bit) and the late tiers (a lot)")

**The steer, verbatim:** *"I really want to decrease margins across the board, tbh, in both early tiers (a bit) and the late tiers (a lot,
otherwise both their margins and natural cost becomes exorbitant)."*

**This is one change that moves four of the nine complaints**, because the same two numbers produce all of them: P1 (the money printer), P5
(top-rung output), P8 (build time) and the hoard defect (F135). It is the campaign ROADMAP step 8's convergence note calls for.

### 1. The arithmetic to design against

A rung's margin at base prices is `(O·Aᵉ) ÷ (I·in0·Bᵉ ÷ (1 − wage_pct)) − 1`. So:

- **`r = A ÷ B` sets the SHAPE** — the margin multiplies by `r` per era on top of rung 0's. Today `r = 2.2 ÷ 1.5 = 1.467`, applied to a rung 0
  sitting at ~break-even, which is why the ladder explodes: **1.05 → 1.54 → 2.27 → 3.33**, i.e. +5% → +55% → +127% → +233%.
- **`in0` sets the LEVEL** — it scales every rung's input value together.
- **`A` alone sets the top rung's OUTPUT** (P5) and, through a capacity-priced cost, its BUILD TIME (P8).

### 2. THE CANDIDATE TABLE, holding `in0` at 1.2 so rung 0 is untouched

Cost is set to hold **capital per unit of output constant** at today's ratio (`C ÷ A = 1.9 ÷ 2.2 = 0.864`), so only the MARGIN moves — a clean
one-dimensional experiment. Margins are % at base prices; "build time" is the e3 cost relative to today's 6.86× vanilla.

| setting | r | textile e0…e3 | glass e0…e3 | steel e0…e3 | top output | e3 build time |
|---|---|---|---|---|---|---|
| **TODAY** A 2.2 · B 1.5 · C 1.9 | 1.467 | 5 / **55** / **127** / **233** | 25 / 83 / 169 / 294 | −19 / 19 / 75 / 156 | 10.6× | 100% |
| A 2.1 · B 1.6 · C 1.80 | 1.313 | 5 / 38 / 82 / 138 | 25 / 64 / 115 / 183 | −19 / 7 / 40 / 84 | 9.3× | 85% |
| ⭐ **A 2.0 · B 1.7 · C 1.70** | **1.176** | **5 / 24 / 46 / 72** | 25 / 47 / 73 / 104 | −19 / −4 / 12 / 32 | **8.0×** | **72%** |
| A 1.9 · B 1.7 · C 1.62 | 1.118 | 5 / 18 / 32 / 47 | 25 / 40 / 56 / 75 | −19 / −9 / 1 / 13 | 6.9× | 62% |
| A 1.8 · B 1.65 · C 1.55 | 1.091 | 5 / 15 / 26 / 37 | 25 / 36 / 49 / 62 | −19 / −11 / −3 / 5 | 5.8× | 54% |
| A 1.7 · B 1.6 · C 1.48 | 1.063 | 5 / 12 / 19 / 27 | 25 / 33 / 41 / 50 | −19 / −14 / −8 / −3 | 4.9× | 47% |

*(Vanilla's manufacturing runs **23.1%** realised at 1935. Our realised figures sit well below the base-price numbers because prices fall —
today's realised ladder is 26 / 31 / 47 / 46%.)*

### 3. ⚠⚠ THE TRAP IN THIS TABLE: THE LEVEL IS NOT THE SAME IN EVERY INDUSTRY

Look across the three columns at one row. **Rung 0 starts at +25% in glass, +5% in textile and −19% in steel**, because `in0` was applied over
*vanilla's own recipes*, whose margins differ wildly. A uniform `r` compression therefore lands very unevenly: at A 1.8 the steel chain is
**loss-making at base on three of its four rungs**, while glass still earns 36–62%.

⚠ And it is worst where it hurts most: steel, fertilizer, explosives and motor are the thin-margin chains **and** the ones whose prices actually
fall (F136 — building-fed and army-fed goods reach 25–72% of base), so a uniform compression squeezes them from both ends.

⇒ **Two ways out, and the second is the user's own P1 idea (b):**
1. **Stop at r ≈ 1.18** (the A 2.0 row), where steel's worst rung is −4% and only at base prices — survivable, since steel's realised price sits
   at or above base for most of the century (vanilla 100–132, the canon 104–141 to 1870).
2. ⭐ **Level the rung-0 margins first, per industry**, then compress uniformly. A per-industry `in0` chosen so every industry's e0 lands on the
   same margin (say +5%) would make one `r` mean the same thing everywhere. That is a generator change — `make_ab_config` takes a scalar `--in0`
   today — and it is the cleaner design, because the current spread is an inherited accident, not a decision.

### 4. ⭐ WHY THIS IS AFFORDABLE NOW AND WAS NOT LAST WEEK

Lowering `A` means less output per level, so the same economy needs MORE levels and MORE workers — which is why `canon-a19-gm` (F129) read
**workers per capita 0.85 / 0.91 world and 1.04 / 0.78 on the pool** and was judged to have overshot. **The 2026-09-18 amendment (§10.85) widened
the pool W aim from 0.6–0.7 to 0.6–0.95**, so that reading is now inside the aim rather than past it. The A axis was closed by a criterion that
has since moved.

⚠ Note the difference from F129 all the same: that book **gain-matched the cost ladder downward** (`--cost-ladder 1.38,2.22,3.68`) to hold value
added per construction point constant, which made the frontier cheap and the build-out deep. The proposal here holds **capital per unit of
output** constant instead, which is a different and gentler move — and F128's lesson (a base-price gain match understates the price channel) is
the reason not to gain-match again.

### ⛔ BATCH 1 RAN AND IS OUT (2026-09-18/19, FINDINGS **F139**, session 20260918_235214)

`canon-lvl-a19b17` — the per-industry levelling at +5% plus A 1.9 / B 1.7 / C 1.64 — was generated, dry-run clean, launched and read at n=2
ALIGNED. **Run 1 intact at world GDP 0.60× (loss 29.2), run 2 BROKEN BY STALL at 0.45×**, so the config is out and the canon stands.

⭐ **It fixed the hoard**: pool H 0.82×, world H 0.66×, both AT THE AIM — the first book to get there with no spending define, confirming F135
that the margin ladder is the investment pool's inflow.

⭐⭐ **And it failed because the REALISED ladder inverted**: designed 5 / 17 / 31 / 47 realised as **37.6 / 26.0 / 26.3 / 27.4**, the 1836 rung
the most profitable in the game. Era-0 workers GREW 0.70 → 1.33M, T3 fell to 14.9%, tiered levels to 8,517 against the canon's 43,913, and the
price decline REVERSED (PI 1.02, not falling, against 0.84 falling).

⇒ **The market eats most of the designed slope, so the design must OVER-PROVIDE it** — the canon's designed 5/55/127/233 realises as
26/31/47/46, this book's realises past flat into inversion. There is a floor under the designed steepness, bracketed between r 1.118 and 1.467.

⇒ **The A/B gap is retired as the hoard's lever** — it drives the inflow AND obsolescence AND the price decline, and they cannot be separated
with it.

⇒ ⚠ **The per-industry LEVELLING was never tested alone** (three coupled levers). That separation is the cheap next book if the route is
continued: `--in0-level 0.05` with A 2.2 / B 1.5 / C 1.9 otherwise unchanged.

⇒ ⚠ **P1's base-price framing is corrected by F139 §5.** Realised, the canon runs 26 / 31 / 47 / 46 at 1935 and peaks at e2 **76%** and e1
**47%** in 1860 — against vanilla manufacturing's 23.1%. The money printer is a MID-CENTURY phenomenon that decays, not the +233% the
base-price table suggests; aim any future attack at the 1850–1880 window and judge it on REALISED margins.

### 5. What the campaign should be (as written before batch 1 ran)

1. **First batch: A 2.0 / B 1.7 / C 1.70, `in0` 1.2** — one book, the 2+1 rule, read under the criteria register. Generated by
   `make_ab_config --A 2.0 --B 1.7 --cost-ratio 1.70 --in0 1.2 …`, no generator change needed.
   **Predictions to pre-register:** margins at base 5 / 24 / 46 / 72 (textile); realised 1935 margins roughly 15 / 20 / 28 / 28; pool H well below
   the incumbent's 4.17 (the inflow is roughly halved); world GDP 0.9–1.1; pool W 0.75–0.95 (inside the widened aim); e3 build time −28%; top-rung
   output 8.0× rung 0 instead of 10.6×. **The KEY reading is pool H against world GDP** — if the hoard falls without the GDP falling, the A/B gap
   was the inflow and F135's diagnosis is confirmed.
2. **Then, depending on it:** either step down one more row (A 1.9), or go to the per-industry `in0` levelling of §3.2 and compress harder.
3. **P6 (the 1836 supply anchor) belongs in the same campaign** — it changes the 1836 prices these recipes are designed against, and it blocks
   the price-path route entirely.
4. **P8's construction-throughput compensation is the optional extra**: if −28% build time is not enough, scaling the late construction methods'
   points AND goods buys the rest without spending GDP.

⚠ **What NOT to do**: do not raise `in0` above 1.2 in the same batch. It is closed as a lever at the current `r` (F118 ran away at C 1.9, F119
stalled at C 2.05), the candidate table shows it drives rung 0 negative at base, and P6 means the 1836 price is already below base in the
industries with the most starting capacity — three independent reasons, and combining it with a new `r` would make the result unreadable.

⭐⭐ **SUPERSEDED IN PART, 2026-09-19 (user-ruled; BALANCE_FRAMEWORK §10.86.3, measured in FINDINGS F140).** The user: *"I now think we need a tighter
A/B to avoid money printing, but a higher t0 input penalty to ensure that t0 industry can't work at base prices, require higher output prices."*
The pairing is the direct answer to F139's inversion — a tighter `r` made era 0, whose recipe is the cheapest in input value, the most profitable
rung in the game, and the `in0` penalty attacks exactly that. **Two of the three reasons above are answered**: "drives rung 0 negative at base" is
now the stated INTENT, and "closed as a lever" was measured at `r` = 1.467, the number being changed. **The third stands**, and F140 sizes it:

- **The penalty is bounded by the 1836 map's own value added, not by an insolvency count.** The era-0 recipe IS the 1836 manufacturing sector, so a
  penalty subtracts value added one-for-one: the seven instrumented markets' era-0 VA is 9.2% of world GDP, and the options cost −1.9 (×1.2, today)
  / −3.9 (×1.4) / −5.8 (×1.6) / −6.6 (uniform −20%) / −8.9 (uniform −30%) points of world GDP on the day they ship, against a HARD 1836–1845 anchor
  of vanilla's 90% CI ± 10%.
- **A scalar lift and a uniform `--in0-level` are different levers.** The uniform one hits hardest exactly where vanilla was generous (arms ×2.11,
  art academy ×3.13 at −20%), and those are the cells that go very dead. Up to ×1.4 on the scalar axis, **nothing is very dead at vanilla's prices**.
- **P6 / F137 IS A PREREQUISITE.** At the canon's own 1836 prices every option is materially worse and the very-dead count doubles to quadruples;
  even vanilla's own recipe is insolvent in 40% of cells there. Fix the supply anchor first, or the batch measures two changes at once.

⇒ **The revised next batch: the tighter `r` AND `--in0` 1.35–1.45, after F137 — not before it, and not on the uniform axis.**

---


## ⭐⭐⭐ STEP 10 — THE ERA-0 INPUT PENALTY, SETTLED AT THE ANCHOR AND UNTESTED OVER THE CENTURY (2026-09-19, FINDINGS F140–F147)

**Where this came from.** ROADMAP step 9's margin-compression campaign closed its first batch (F139: the flat uniform ladder fixes the hoard and loses
the economy, because the realised ladder inverts). The user then re-opened the `in0` axis — *"we need a tighter A/B to avoid money printing, but a
higher t0 input penalty to ensure that t0 industry can't work at base prices, require higher output prices"* — and a day of paper analysis and
**28 short probe runs across five sessions** settled what the penalty does AT THE ANCHOR. Nothing here has been run for a century.

### 1. WHAT IS SETTLED

- **The design intent is arithmetically right (F143 §1).** At the canon's OWN realised prices, textile's 1836 rung earns +1% at 1890 and +6% at 1935 on
  the shipped book, and **−14% / −9% at `in0` 1.4**. `in0` 1.3–1.4 is what turns the consumer chains from "survives forever on a sliver" into
  "destroys value from 1890 on", with no extra price decline needed — which is exactly the user's mechanism.
- **At the anchor the penalty is absorbed (F142).** Realised era-0 margin 26 / 23 / 21 / 21% at `in0` 1.2 / 1.3 / 1.4 / 1.5 after 21 months: a 24-point
  designed spread becomes a 3-point realised one. The rung sheds staffing until its price recovers. **Read F142 as the ANCHOR and F143 as the DESIGN.**
- **The world-product cost is about 1 point per +0.1 of `in0`, and it saturates (F142)** — far less than the paper's first-order arithmetic.
- **The raw-input penalty's working maximum is ≈1.40** (F140 on paper, F144 on demolition, F145 on the market). At 1.50+ the STEEL industry is
  demolished at the anchor and the chain goes with it.
- **⭐ THE GRADED PENALTY WORKS AND HAS A FINAL SHAPE (§10.86.6/.7).** `--in0-stage <raw>,<s1>,<s2>` relieves an industry for what it BUYS;
  `--in0-supplier <k>` adds a binary point for what it SELLS, counting only consumers standing on the 1836 map. **`probe-gradsup` — `--in0-stage
  1.40,1.20,1.10 --in0-supplier 0.5` — is the best anchor of any penalised book measured**: world product at the control's, steel's ceiling share
  48% → 25% and engines' 46% → 39% against the ungraded arm, both markets improving on supply as well as price (F147 §1c, n=6).
- **⚠ The canon has an anchor defect of its own (F145).** Its steel runs demand 0.97 of vanilla on three-quarters the supply with **18% of its early
  prices at the +75% ceiling**, where vanilla never touches it — because vanilla leaves steel at a −2.5% base margin, the thinnest of any industry, and
  the uniform ×1.2 lift takes it to −19%. **⭐ But F146 measured that early steel tightness does NOT predict late GDP** (162 runs, 47 books: pooled
  r = −0.15, within-book **+0.19** — opposite signs, both weak), so it is a reason not to spend a lever on it, not an emergency.
- **Motor is structurally odd and it is not the recipe (F143 §2/§3a).** It is the only industry whose rungs skip an era (e0, e2, e3 — vanilla gives it
  three methods three game eras apart), so its output per level is frozen from 1836 to ~1905 while everything else compounds at A^era; a gap costs
  vanilla 1.33× and costs us 2.2×. **A lower A shrinks that automatically** — a third independent argument for the A cut of F141.

### 2. WHAT IS NOT SETTLED, AND IT IS THE IMPORTANT HALF

⚠⚠ **THE GRADED PENALTY HAS NEVER BEEN RUN FOR A CENTURY** — and that, not the penalty as such, is the open question. Say which is which, because the
loose form of this line ("nothing in step 10 has been run for a century") was flagged by the user on 2026-09-20 and is WRONG as stated:
- **`in0` 1.2 FLAT has a century of evidence and is in the SHIPPED CANON.** Every book from `canon-flat-in12` (F110) through the cost-slope sweep, the
  canon `canon-c19-in12` itself and last session's `probe-anch-costslide` carries it. It is the incumbent, not an open probe.
- **`in0` 1.3 FLAT was run for a century and is CLOSED as a lever** — F118 (`canon-c19-in13`, n=1: the dip removed, then a runaway to 1.44×) and F119
  (`canon-c205-in13`, n=2: a stall at 0.71 / 0.74×). The lift pushes construction to the frontier; it does not kill the old rung, at either slope.
- **`in0` 1.4 flat, and THE GRADED PENALTY (`--in0-stage` for what an industry BUYS + `--in0-supplier` for what it SELLS), have only ever seen 21 months.**
  Two in-game years cannot see obsolescence, the price decline, the money printer or the hoard — the four things the project is actually for. F143 §1's
  case for the graded shape is paper arithmetic over ANOTHER book's prices, and F139 is the standing warning that a designed ladder is not the realised one.
⚠ A second, separate blocker on the graded shape: the generator currently REFUSES `--anchor-for` together with `--in0-stage`, so the graded penalty cannot
be combined with the anchor slide the working book now carries. Lifting that conflict comes before any century run of it.
⚠ **The supplier weights are a 1836-derived number knowingly applied to every rung** (§10.86.7). At 1910 the same measure reads steel 0.31 against
1836's 1.00. The late game is deferred by ruling, not answered.
⚠ Only `k = 0.5` and only the `map` variant have been tested; `any` and `share` remain in the generator, unrun.

### 3. THE NEXT STEP, as it stands

**A full 1836→1936 run of `probe-gradsup`'s configuration, or of it combined with F141's A cut**, is what everything above now waits on. The candidates,
in the order the evidence supports them:

1. **`--in0-stage 1.40,1.20,1.10 --in0-supplier 0.5` on the canon's A 2.2 / B 1.5 / C 1.9** — the measured best anchor, one change from the canon's
   uniform 1.2. Tests F143 §1's claim that this kills the consumer chains from 1890 without breaking the anchor.
2. **The same penalty with F141's `A 1.9 / B 1.5 / C 1.75`** — the money printer and the penalty moved together, which is the user's original framing
   (*"the answer to money printing is mostly not in0, but A/B, which can be afforded to be milder if in0 ensures that a smaller price difference to
   1830s is enough to kill the e0"*). ⚠ Two levers at once, so it needs the A-only arm beside it to be readable — and `canon-a19-gm` already IS that
   arm, measured at n=2 (F141 §4).
3. **P6 / F137 first, if either of the above is to be clean** — the 1836 supply anchor is broken in every A-ladder book and it depresses exactly the
   prices these recipes are designed against.
4. ⭐⭐ **A NON-GEOMETRIC OUTPUT/INPUT LADDER — added 2026-09-19 by FINDINGS F148, and on paper it dominates candidate 2 on every axis at once.** F148
   measures vanilla's OWN method ladder over the rungs the 1836 map actually holds: **out ×1.00 / 1.48 / 2.67 with input tracking output to within
   1–2%**, i.e. vanilla's early methods are pure throughput at a FLAT margin, against our geometric ×1.00 / 2.20 / 4.84 on ×1.00 / 1.50 / 2.25, which
   adds +47% and +115% of margin where vanilla adds none — **F137's anchor error and P1's money printer are the same table read on two axes.** A
   front-flattened book (`out 1 / 1.40 / 2.60 / 10.65`, `in 1 / 1.18 / 1.70 / 3.38`) scores 1836 anchor **−1.9%** against the canon's +27.3%, an e1
   margin of **25%** — on vanilla manufacturing's measured 23% (F92) — and obsolescence **15 of 17**, where the geometric A 1.9 that buys a smaller
   anchor gain collapses to 10 of 17. It is what the 2026-09-19 ruling opened (*"ladders can be more complex than anchor × A^era"*, §10.86.4) and it
   leaves the top rung's 232% margin untouched, so P1's other half still wants F141 §5's B ladder. ⚠ **Blocked on a generator flag**:
   `make_ab_config` has `--cost-ladder` but output and input are the geometric `--A` / `--B`; it needs `--out-ladder` / `--in-ladder` mirroring it, and
   the matching arm in `lint_tier_eras` (L31), which already recomputes cost from `_ab.cost_ladder`. ⚠ Never run for an hour, let alone a century.

⭐ **And an instrument rule earned the hard way (F147 §1c): on a 1836→1838 batch, n=2 is enough for steel (~1,250 units, ~18 levels) and is NOT enough
for engines, motor, explosives or munition, which are single-digit levels where one seed moving one level is a 30–50% swing.** Two n=2 readings of the
engine market produced two confident, opposite, wrong answers in one day.


## ⭐⭐⭐ STEP 11 — RAISE THE WORLD PRODUCT WITHOUT LOWERING B: POST-JE TECH FINISHING AND BROADER TRADE (user's steer, 2026-09-23, at the close of the B-gradient session)

**The user, in their own words:** *"My expectation is that pushing post-JE tech finishing more efficiently and broadening
trade will increase the economy some more, improving world GDP (but worsening Britain's U\*). We'll implement those two
changes and test them over next several sessions."*

⭐⭐ **WHY THIS IS THE RIGHT NEXT MOVE, in the canon's own residual.** `canon-slide-b158` (canonized the same day,
FINDINGS **F158**) meets almost every line of the register — pool W 0.73 · pool H 0.92 · pool GDP 1.13 · PP 0.78 · T0 0.71 ·
world W 0.67 all AT THE AIM, PI 0.89 falling decade over decade, 3 intact / 0 broken, Britain 12.1–24.8% U\* in all three
seeds — and misses on exactly one important line: **world GDP 0.87 median against the 1.0 aim** (consensus 0.84).
⚠⚠ **AND THE B AXIS CANNOT FIX IT.** F158's five-point gradient is monotone in the wrong direction for this purpose: a
LOWER B raises world GDP (slope −4.47 on ln(B/1.5)) and the same data shows a lower B collapses Britain's U\* (B 1.55 put
0 of 3 seeds in the 10–50% band; B 1.58 put 3 of 3). ⇒ **the world product has to come from a lever that is not on the
ladder at all**, which is what these two are.

### The two changes

1. **POST-JE TECH FINISHING, more efficient.** The research journal entries grant **1.5× each covered technology's whole
   base cost** across 126 of them (F138), a subsidy added to compensate for a tree-depth increase that never happened —
   and ROADMAP step 8 **P9** already records the user's registered desire that *the tech tree is a thing to COMPLETE, not
   to prioritise*. This step is about what happens AFTER a JE fires: how efficiently a country finishes the rest of the
   tree. ⚠ Scope is NOT yet specified — the candidate levers are the JE grant fraction, the bar months, the per-tree AI
   research weight (`tech_ai_weight_mult`, at the ruled default 1/1/1 since 2026-08-17) and the spread constants; which
   of them is "post-JE finishing" needs the user's own reading before anything is generated.
2. **BROADER TRADE.** Our scenarios and our books have never touched trade: `trade_center` is deliberately left vanilla,
   the mod ships no trade-route or market-access change, and the balance model assumes NO international trade inside a
   scenario (the amalgamation premise of the anchor principle, rule 6). ⚠ Scope unspecified likewise.

### ⭐⭐ THESE TWO ARE NOT LEVERS UNDER EVALUATION — THEY GO IN FOR THEIR OWN REASONS, AND THAT DICTATES WHERE WE START FROM

**The user, correcting a first reading of this step that framed them as levers competing with B (2026-09-23):** *"the point
isn't whether those two are B in disguise or not. They must be done for other reasons, but this means that the initial
point we start applying them to should be lower than the target on GDP (which is a more important and less volatile
target and the primary optimization point)."*

⇒ **Do NOT design a batch to measure their exchange rate against B.** They are going in regardless; what their arrival
determines is the STARTING POINT they are applied to. ⭐ **This is the UNDER-SIDE RULE of 2026-09-15 applied a second
time** — the user then: *"more aggressive spend of investment pool money will increase the economy and thus
depeasantation. So ceteris paribus, the other parts of the config … should be taken from the side that gave values
slightly under the GDP/depeasantation target, not at the target."* Same logic, new cause.

⭐ **THE CANON IS ALREADY POSITIONED CORRECTLY, ON BOTH AXES.** `canon-slide-b158` reads world GDP **0.87, below the 1.0
target**, and Britain's U\* **22.2% median, above the 15% target**; the two changes push GDP UP and U\* DOWN, i.e. both
toward their targets from the side that leaves room. ⇒ **The canon's world-GDP "miss" is not a defect to correct before
step 11 — it is the headroom step 11 consumes**, and a book sitting on 1.0 today would overshoot the moment these land.

⭐⭐ **WORLD GDP IS THE PRIMARY OPTIMIZATION POINT — more important AND less volatile** (same ruling). The volatility half
is MEASURED on the B-gradient batch: within-config coefficient of variation averages **19.1% for world GDP against 88.0%
for British U\***, a **4.6× gap that holds at every one of the five B points** (3.0× / 3.9× / 4.5× / 5.3× / 5.9×).
⇒ **Tune on world GDP; treat British U\* as a CONSTRAINT that must stay inside its band, never as a quantity to minimise
or to trade against GDP point-for-point.** A U\* difference between two books is roughly four times more likely to be seed
noise than the same relative difference in world GDP.

**The pre-registered prediction (the user's, before anything is built):** world GDP UP, Britain's U\* DOWN (worse). Record
the measured size of both when the batches land — not to judge the changes, which are going in anyway, but to know how
much headroom they consumed and therefore where the ladder should sit afterwards.

### Instrument notes for whoever runs it

- ⚠ **Size the spacing against σ, not against the hoped-for effect** — F158's central methodological result. The
  within-config seed spread on world GDP is **0.37–0.50**, so a step whose whole predicted movement is smaller than that
  cannot be read at n=3. B 1.52 and B 1.55 were wasted for exactly this reason.
- ⚠ **The reading gate (§10.83.8) applies**: if a change pushes world GDP outside 0.80–1.20 the U\* and H readings are
  weakened, and at 0.60 they are disqualified — so a trade change that overshoots cannot be scored on the labour lines.
- ⚠ **L37 is still live and still owed a fix** — `stop_watch` calls `criteria.mjs --arm <session>` with no `:setup` and
  therefore goes blind to the register on any multi-config schedule.

