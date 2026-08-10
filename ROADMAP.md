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

---

## Step 2 — INDUSTRY-DRIVEN RESEARCH EVENTS

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

**Open questions to settle when we get there:** whether the trigger is levels, employment, or output
share; whether it grants flat progress or a research-speed modifier; whether foreign-owned levels count
for the owner, the host, or neither; and how it interacts with tech spread.

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
