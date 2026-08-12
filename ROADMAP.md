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
ladder now runs **106 tiers over 22 industries — 11 / 17 / 19 / 21 / 21 / 17 per era**, with one rung per
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

⚠ **THE REPO IS DELIBERATELY INCONSISTENT UNTIL THE MERGE.** `config/era_prices.json` and
`config/era_presets.json` now describe the **106-tier** ladder, while `config/mod_config.json` still holds
the **100-tier** one; the re-banded config sits in `config/mod_config.era6.json` (un-ignored on purpose —
it carries solved volumes, so it is not a derivable output). A canonical `build.ps1` run in this window
would pass the era6 presets through `extract_presets.ps1` into a `ui/presets.js` that disagrees with the
config beside it. Testbed builds are unaffected — alt builds never write `ui/`. **Merging era6 into
`config/mod_config.json` resolves all of it in one move**, and needs `solve_building_cost.ps1` in the
same pass.

⚠⚠ **SEQUENCING — nothing here may be written yet.** `config/mod_config.json` and
`tools/build_era_ladder.mjs` must not move until the second research-events batch has launched *and
built*, or batch A and batch B stop being comparable and both nights of game time are wasted.

---

## Step 2 — INDUSTRY-DRIVEN RESEARCH EVENTS  ⬅ **BUILT 2026-08-12, first batch running**

**Status: emitted, lint-clean, smoke-tested, and under measurement.** `tools/emit_research_events.mjs`
turns the config's `research_events` block into **366 journal entries over 122 technologies** (82
industry-gated, 40 war-gated) — 122 scripted progress bars, 115 script values, 1103 loc keys in 11
languages. `enabled: false` emits nothing and reproduces the plain `techs` arm, which is what makes the
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

⭐ **TECH SPREAD GETS BOOSTED TOO** (user, 2026-08-10) so a laggard converges on the leading edge faster
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

## Step 3 — BUILDING COSTS, THEN THE FIRST REAL BUILD

Decide each tier's `building_cost` (construction points) under the new tech gating, then build the mod
for real: solved recipes + new technologies + the step-2 events. `tools/solve_building_cost.ps1` holds
the current 10-year-payback model (BALANCE_FRAMEWORK §9); whether that model survives contact with a
tech-gated ladder is part of this step.

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
- **`tools/emit_research_events.mjs`** — 122 technologies → 366 journal entries, 122 scripted progress
  bars, 115 script values, 1225 loc keys × 11 languages. Wired into `build.ps1`, throws on failure.
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

## Step 5 — COMPANY MANDATES

Change company mandates so they latch onto useful and reasonable industries rather than always the
Tier-1 building. Related to the standing `MISSING_PM_REFERENCES.md` / narrowed-`has_building` problem:
457 vanilla `has_building` references now match only our Tier-1 building, and the same "make every tier
of the industry eligible" fix resolves mandates, monopolies and the flavour references together.

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
