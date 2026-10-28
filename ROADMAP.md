# ROADMAP — from a solved economy to a shipped mod

This file is the PLAN: what each step is, where it stands, and what is still ahead. It is not a record of results (`FINDINGS.md`), not the
rulings (`BALANCE_FRAMEWORK.md`), not the open-item list (`BACKLOG.md`, one line per item) and not the 1.0 release register (`POLISH_1_0.md`).
The canon and its measured state are CLAUDE.md Part 4. When a step's design settles, its content moves to the doc it belongs in and the entry
here shrinks to a pointer.

**Numbering.** Steps 0–7 are the user's plan of 2026-08-10 (steps 1–4 the MVP, 5–7 polish before release); steps 8–14 were added as the work
went. Other files cite steps by number ("ROADMAP step 2", "step 8 P1", "step 9 §3", "step 10 §3.4", "step 13 item 3") and these sections by
title: *COVERAGE AUDIT OF THE PRODUCTION TREE*, *The NAVAL channel*, *The war channel — RULED IN DETAIL*, *DEFERRED FIXES*, *Parked*. Never
renumber or retitle them.

**Status words:** DONE · IN PROGRESS · OPEN (planned, unscheduled) · DEFERRED to 1.1 (or later) · DROPPED · CLOSED (tried and ended).

---

## Where the plan stands (2026-10-26)

Mod 1.0 ships on game 1.13 on **2026-10-30**; mod 1.1 follows on game 1.15.N around **2026-11-16**. The alternating vanilla + canon batch has
measured the 1.0 canon (F249: 16 intact, world GDP 1.07×, play time ×1.010 of the same sessions' vanilla), and the no-DLC load test passed (F250).
What is left for 1.0 is the release build ("Mod 1.0 — the remainder" below). Everything below the table is per step.

| step | what | status | closed | pointers |
|---|---|---|---|---|
| 0 | the solver: six-rung ladder, scenario solve, balance UI | CLOSED — the four-rung books are built from vanilla by the A/B formula | 2026-09-16 | §10.80, §10.72, CLAUDE.md §1.3 |
| 1 | a technology gate per rung | DONE in another form: the tree is vanilla's + 3 minted; the deeper tree was never built | 2026-09-05 | §10.72, §10.78, F138, P9 |
| 1b | the six-rung anchor re-band | DROPPED with the six-rung ladder | 2026-09-16 | §10.80, CLAUDE.md §2.2 |
| 2 | industry-driven research entries | DONE; reworked 2026-10-11/12; texts 2026-10-21 | 2026-10-12 | §10.95, §10.97, §10.98, POLISH §1 |
| 3 | building costs, then the first real build | DONE; today `K(t) = K₁ · C^k`, C 1.9, t1-anchored (canon 2026-10-12) | 2026-08-17 | CLAUDE.md §1.3, §10.68, §10.91.5 |
| 3½ | savegames as the instrument for state | DONE; alignment proven | 2026-08-15 | TESTBED_METRICS §7½, §9 |
| 4 | measurement runs and the loop back | IN PROGRESS, permanently: the criteria register is its form | — | §10.83, CLAUDE.md Part 3 |
| 5 | company mandates over every rung | DONE (first cut); read by F249 §5 — companies a little smaller than vanilla's, no change proposed | 2026-08-23 | §10.64, F77, F79, F249, POLISH F3 |
| 5a | company instrumentation | item (1) DONE (summary v7); item (2) OPEN | 2026-08-21 | BACKLOG D |
| 6 | hydro-dam megaprojects | DONE; canon since 2026-09-27, redesigned to 2026-10-16 | 2026-10-16 | §10.89 (.1, .9–.14), F168–F177 |
| 6½ | artisanal ownership | DEFERRED to 1.1 or later | 2026-10-21 | POLISH F1 |
| 7 | visuals, proofreading, release | IN PROGRESS — the 1.0 polish | target 2026-10-30 | `POLISH_1_0.md` |
| — | the war and naval research channels | DONE; re-ruled 2026-09-03 and 2026-10-12 | 2026-10-12 | §10.69, §10.98 |
| 8 | the first playtest's defects P1–P9 | P1 P2 P3 P4 P6 P7 DONE (P1 and P6 closed by the user 2026-10-24) · P5 accepted · P8 CLOSED (F255, not an issue) · P9 a ruling | — | BACKLOG B, F137, F138 |
| 9 | margin compression | CLOSED (batch 1 out; levelling closed) | 2026-09-19 | F139, §10.86.3–.4 |
| 10 | the tier-0 input penalty | partly superseded by the t1-anchor model; two items OPEN | — | F140–F148, §10.86.6–.7, §10.91.5 |
| 11 | post-JE tech finishing and broader trade | DONE; three follow-ups OPEN | 2026-09-25 | §10.88, F160–F164 |
| 12 | craft t0 rungs | DONE (canon) | 2026-10-12 | §10.91.1, .3, .5, §10.99 |
| 13 | six merged rungs | DONE (canon); item 3 OPEN | 2026-10-12 | §10.91.2, §10.99 |
| 14 | the last tech rework, then the canonisation decision | DONE: the arm is the canon | 2026-10-12 | §10.96–§10.99, F223–F227 |
| — | DEFERRED FIXES | one DEFECT open (`deviates_from_vanilla`); the rest fixed or moot | — | below |

---

## What is ahead

### Mod 1.0 — the remainder (game 1.13; release 2026-10-30)

Already done for 1.0 (2026-10-21): the engine-compatibility pass (POLISH §2, `TIER_REFERENCE_AUDIT.md`, `emit_vanilla_refs.mjs`, commit
`94ae51c`), the research-entry texts (POLISH §1), the generated-text pass, and every polish question Q1–Q11 ruled and canonised (POLISH "Every Q
is ruled"). What is left, in order:

1. ✅ **The alternating batch — READ 2026-10-26 (FINDINGS F249; report https://claude.ai/artifact/7dR3FWMiYKJbeMjixMcDQK).** Vanilla + canon
   run by run, n=16 + 16, 1836→1936 (`20261021_224949_alt-vanilla-canon-n16` runs 1–12, `20261023_161802_alt-vanilla-canon-rest20`, and
   `20261026_032622_alt-canon-replace20` for rest20 run 20, lost to landmine L42). 16 intact, world GDP 1.07× vanilla n=40, loss 6.60, play time
   ×1.010 of the same sessions' vanilla (×1.11 and ×0.996 in its two sessions — the machine sped up for both arms).
   - A3 fixed (`fill_research.mjs` reads the book's own tree, commit `fc401bf`). A4 needed no label: `fill_consts.mjs` reads the save's own
     government and military workforce since 2026-08-20 (BACKLOG Done, closed on re-check 2026-10-24), so the report's productive workers are right.
   - A5 done: `VANILLA_WALL_REF` = the batch's vanilla, `VANILLA_REF` = n=40; the ledger, built on the criteria register (§10.104).
   - A6 read in F249: the canon's century with private dams (16 intact); company mandates' first cut (companies a little smaller than vanilla's);
     the red-flag vanilla twin (on the order books, vanilla 120.5 problem market-years against the canon's 147.5); Austria's art academy (no
     difference while the Metternich entry runs). NOT separated: the urban-centre electricity override's effect (no arm without it ran).
   - Nothing read badly enough to revert (POLISH "The second pass").
2. ✅ **The no-DLC load test — PASSED 2026-10-26 (FINDINGS F250).** Vanilla and the canon, 2 × 1836→1841, with all 17 installed DLCs disabled and
   none mounted (the harness's new `no_dlc` / `run_observer -DisableAllDlc`). Both played clean; no error names a mod file or a replaced vanilla
   file, and the canon adds no error class beyond vanilla's.
3. **The release build (~2026-10-26/27)**: the first RELEASE build kind — no telemetry or logging but a start-up manifest line (POLISH H8);
   release metadata — version 1.0.0, no "(built …)" stamp, a current description, `supported_game_version` "1.13.\*" (R1, Q9); "Recipe BE"
   out of the building names (R1); thumbnail and licence (R2); a player README with the list of replaced vanilla files (R3, H9); a proofread
   of every generated player-facing text (R4); the three minted technologies' icons from the user's images (R5); then a final build, every
   lint, an in-game load and an `error.log` read.
4. **Release, 2026-10-30.**

### Mod 1.1 (game 1.15.N, ~2026-11-16)

The schedule leaves about four days between a stable 1.15.N and 1.1 — room for 10-year probes and at most one n=3 century, so 1.1 can carry a
feature only if it needs no iteration (step 7's timeline).

- **The ON_GAME_UPDATE pass for 1.15.N** — every coupling in `ON_GAME_UPDATE.md`, including the hand re-test that a foreign dam builder still
  meets the level cap and the 1836 starting-technology checks (L14/L15).
- **Treaty ports** (§10.103, F243–F246): five layers built and probed on 1.13, none in the canon; deferred until the 1.15 AI (1.14's promised
  AI rework) is seen. Open on 1.15: does the AI pursue recognised hosts by itself; does the never-added rule hold (`skip_build_list`
  untested); why do ports in recognised markets build no trade capacity.
- **Urban-centre electricity ×2 or ×3** (user-ruled 2026-10-24, §10.89.15): `pm_electric_streetlights` from 1 to 2–3 electricity a level,
  with a reasonable coal increase. A one-line recipe change, but it moves electricity prices world-wide, so it needs a century measurement;
  measure the canon's urban-centre and total electricity at 1935 first. More hydro variety within the four dam types was dropped.
- **Military research** — ~10 technologies behind vanilla and no tech-era-5 military technology held anywhere (POLISH Q5). The user's first
  approach: *"a bit higher ai weights for military techs over societal techs over most production techs (exceptions with also higher
  priority on production where there are no JEs, like Shift Work)"*. Tech spread ×2 and a society research multiplier stay deferred (§10.97
  item 8).
- **The balance levers that are not minor** (POLISH Q4): the cost ladder C 1.8 × cost1 1.2 (F234, measured on an older canon) and paper's own
  input lift (1.0–1.3, §10.101).
- **Tier-scaled secondary lines — a possible lever, not ruled** (user, 2026-10-26; F249 §4d): the textile and furniture t1 live on a luxury line
  sized for t2; scaling a line's goods with its rung's tier would take that away. "One name — one recipe" stands (§10.93), so a strictly tiered
  industry needs new names for its secondaries, and a merged building, where one secondary serves two tiers, is a harder question (BACKLOG B).
- **Deferred content**: stale looms on the merged textile building (B2, revisit); craft secondary lines (B3); artisanal ownership (step 6½,
  "1.1 or later"); per-rung building art (R6, "1.1 or later"); the art academy's Austrian conditional desire, if the batch shows the canon's
  Austria building too few (BACKLOG E). Rubber in a rich late game is a watch item (Q7).

### Later — no release assigned

The balance campaign (BACKLOG "The order" items 2–3, section B), then the final balance check:
- the price path and the old rung in the consumer chains — the central open problem (CLAUDE.md §2.1, F136);
- the hoard (F135, F179 §3);
- what is left of step 8 (P9), step 10 (the graded penalty's century, the output-ladder flag) and step 11's follow-ups (2)–(4).

---

## Step 0 — The solver

The six-rung ladder, its scenario solve (the band regime, the recipe ratchet and the army fixed point of §10.49–§10.51) and the balance UI it
fed. The builder, the testbed runner and its telemetry came before it — the "negative steps" a solved economy needed.

**Status: CLOSED 2026-09-16.** The six-rung ladder was closed for good, for UI bloat rather than economics (§10.80). The four-rung books are
built from vanilla's own methods by the A/B formula (§10.68, §10.72; CLAUDE.md §1.3); per-rung recipe solving and a per-industry level solved to
a target margin are closed levers (CLAUDE.md §2.5, §10.86.4). The balance editor survives as a reader and explorer (CLAUDE.md §5.7). Step 4's
loop still feeds back to the book, now through its generator chain (CLAUDE.md §4.4).

---

## Step 1 — Rework the industry tech tree

**What.** Give every rung its own unlocking technology, so that "modernising means constructing the newer building" has an industry-specific
research gate in front of it — and step 2's entries have a technology that belongs to one industry. The plan of 2026-08-10 also meant to make
the production tree deliberately deeper than vanilla's.

**Status: DONE in another form, 2026-09-05.** Since the vanilla-ladder rebuild (§10.72; `canon4v`, canon 2026-09-05) every rung is a vanilla main
method gated by vanilla's own technology, and the tree is vanilla's — 179 technologies at vanilla's tech eras, names and prerequisites — plus three
minted tech-era-5 technologies (spray finishing, continuous web processing, catalytic synthesis), one era move (vulcanization 3 → 4, `ERA_MOVES`)
and one added prerequisite (conveyors before compression ignition, `PREREQ_ADDS`, §10.93). The spec is `tools/lib_tier4_spec.mjs`, the tree is
written by `tools/make_tier4_techs.mjs`. The deeper tree was never built (F138: 182 technologies, 3 minted); deepening it is one of P9's levers.
The six-rung candidate trees, merges and renames of August are records in `tools/tech_tree_spec.mjs` (§10.53, §10.56); the canon carries no
technology rename (`TECH_RENAMES_RULED` is empty; the two dating corrections — pumpjacks "Oil Drilling", threshing machine "Steam
Threshing" — were ruled out on 2026-10-24: vanilla's names stay, POLISH R9).

**Constraints any future change to the tree must respect** (engine facts and user rulings, still true):
- The engine lays the tree out by itself (`TechTreePanel.GetProductionTechTreeItems` / `…Lines` in `gui/tech_tree.gui`); adding technologies
  needs no GUI work. The era band dividers are hard-coded (`extra_lines`, y = −100 / 2200 / 4060) and line up on vanilla + 3 (in-game check 5,
  2026-10-21, POLISH R7); a taller tree would need that GUI file owned — a new coupling.
- **Cost is per tech era, never per technology** (7,500 / 10,000 / 12,500 / 15,000 / 17,500, `common/technology/eras/00_eras.txt`).
- **The ahead-of-time penalty grows with the size of the tree**: `cost = era cost × (1 + F × Σ)`, Σ summing (N − e) over the unresearched
  same-tree technologies of every earlier tech era e (MODDING_NOTES, exact per F160) — doubling a tech era's technologies doubles its term. F = `TECH_AHEAD_OF_TIME_PENALTY_FACTOR`, vanilla 0.25, a define a small file can override;
  the mod emits it only when it differs from vanilla's (POLISH C1), and today it does not.
- **Prerequisites stay in the same tree and never sit in a later tech era** (vanilla has zero cross-tree prerequisites among its 179;
  `make_tier4_techs.mjs` throws on either). Every technology of tech era 2 and above has a prerequisite (vanilla satisfies this).
- **No fully empty technology**: a minted one unlocks something or carries an explicit modifier; a vanilla one is never emptied or deleted
  (`audit_tech_content.mjs`, `lint_tech_content.mjs`, CLAUDE.md §2.6). An invented modifier name does not error in game, it silently does
  nothing — validate any new one against `common/modifier_type_definitions` (the six-rung `tech_tree_spec.mjs` did; the four-rung tools mint no
  modifier today).
- **No filler technologies and no modifier creep** (user, 2026-08-11): a modifier is added only for a strong design or narrative reason where
  vanilla has a real gap, never to give a technology something to do.
- Vanilla buildings unlocked from the military or society tree stay there (user ruling).
- Localization keys are `<tech>` and `<tech>_desc`, generated for all 11 languages.
- Every technology carries a NARRATIVE ONSET (the `ONSET` table in `tools/tech_tree_spec.mjs`, read by `make_tier4_techs.mjs` into the twin's
  `onset`; `tech_timing.mjs` reads timing against it).
- Calibration: vanilla's production tree is 57 technologies / 697,500 innovation, military 58 / 722,500, society 64 / 737,500 (2,157,500 in all).
  Vanilla's weekly innovation cap is 50 + 150 × literacy; the canon's is 25 + 25 × literacy (x = 25, §10.101.1), before universities and bonuses.

The AI-weight question this step opened (when is `ai_weight` read, do dynamic triggers work there) is answered: the AI chooses only when its
current research completes, and a conditional `add` in `ai_weight` does steer it (F160 §6; MODDING_NOTES → *Technology: research, spread, and what
the AI actually weighs*). The per-tree weight is `tech_ai_weight_mult` (§10.62, default 1, nothing emitted at 1).

---

## Step 1b — The anchor re-band

**What.** The six-rung tree's anchors (1750 / 1830 / 1870 / 1900 / 1925 / 1940 for tiers 0–5) and the re-banded 105-rung ladder built and
solved on 2026-08-12.

**Status: DROPPED 2026-09-16** with the six-rung ladder (§10.80). The anchor principle it served stands on the four-rung anchors 1836 / 1875 /
1905 / 1940 (CLAUDE.md §2.2). Its one lasting effect: dropping the invented ~1700 rungs put the vanilla building key back in slot 0, which
masked landmine L13 (see *DEFERRED FIXES*).

---

## Step 2 — Industry-driven research events

**What.** A country — or its companies — that employs enough people in industry X earns research progress on X's next technology, the way
industrial leadership compounded historically: the country with the mills got the next mill innovation first. It is also the counterweight to
the cut in ordinary research. The player-facing description is CLAUDE.md §1.2 ("Research: technology follows industry").

**Status: DONE.** Built 2026-08-12 (`tools/emit_research_events.mjs`); re-keyed to the four-rung tiers 2026-09-03 (§10.69); extended to
production technologies outside the ladder 2026-10-05 (§10.95, the audit below); reworked 2026-10-11 (§10.97) and extended beyond production
2026-10-12 (§10.98), canon since 2026-10-12 (§10.99); every mark a whole number of levels and every condition a line of the bar tooltip,
2026-10-21 (POLISH §1, U5). Engine mechanics: MODDING_NOTES → *What a tech-granting event can CONDITION on* (F51).

**The mechanism today:**
- One journal-entry set per technology, carrying a scripted progress bar, visible while `can_research` holds. Entries are placed by script — at
  game start, on every technology acquired and on the yearly pulse — so a tag that appears mid-game gets its entries within a year
  (`research_events.placement = script`, a tick-cost fix, §10.89.13 / §10.99).
- The bar ticks on employment, `Σ (level × occupancy) × employees per level` — occupancy is a weight, never a filter. Marks are authored in
  people and emitted as whole fully staffed levels (`marks_whole_levels`); the tooltip reads in levels.
- Marks by the UNLOCKED rung's tier: 25,000 (t1) / 75,000 (t2) / 235,000 (t3) in the rung below, ×0.5 for arms, artillery, explosives,
  munition and synthetics, halved once a country outside isolationism holds the technology. 36-month stages, up to 20 (the implementation stage
  repeats); sources do not add up; the entry pauses under the literacy line 25 / 35 / 45 / 55 / 65% by tech era (§10.97).
- Each stage grants half the tech era's base cost — an absolute number of points, so under an ahead-of-time penalty it buys less than half
  (decided, not routine: CLAUDE.md §2.5).
- A first rung with no predecessor anchors on a narrative supplier (config `necessity_anchors`): fertilizer and explosives on staple-crop farms,
  synthetics on textile and light industry, automotive on the motor industry's electric and diesel rungs, electrics on trade centres, munition
  on the military industry, motor (atmospheric engine) on coal and iron mines together (user, 2026-09-04 — the one relaxation of the
  2026-08-11 rule "mines should never be used"). Urban centres and financial districts gate nothing (2026-09-03).
- Foreign-owned levels count for the HOST's territory, owner-agnostic — the workforce is what learns. `levels_owned_by_country` makes the
  owner-learns variant a one-clause change (MODDING_NOTES).
- The AI's research weighting has no progress term (MODDING_NOTES). A grant that reaches the cost acquires the technology on the spot, and the
  finish boost (+10,000 AI weight at ≥ 99% progress, `emit_tech_finish.mjs`) covers the rest (F160).
- Tech spread is vanilla's (§10.54). `research_events.enabled: false` emits nothing — the events are a config variant, not a build flag (user,
  2026-08-11).
- Beyond the ladder: the technologies of the audit below (§10.95); land-unit and ship technologies (*The war research channel*); radical and
  advanced laws, tropical colonies, the civilizing mission, the state apparatus, cities, universities, finance and antibiotics (§10.98).

### COVERAGE AUDIT OF THE PRODUCTION TREE (2026-10-05)

The user asked after finding Radio without an entry. Per production technology: (a) one of our entries; (b) a universal vanilla journal entry
granting its progress; (c) first in its chain and held at the start by most of the world; (d) no reasonable precursor; (e) none of these — an
oversight. Read off the emitted mod, the 1836 starting sets (weighted by 1836 population) and vanilla's journal entries and events, over the 60
production technologies of the time:

- **(a) 25** had entries.
- **(b) 0.** No vanilla journal entry grants a production technology. Vanilla's monthly random events (`production_tech_events`) offer progress
  on railways, watertube boiler, shift work, steel railway cars, radio and steam turbine. Radio's `.210` could not fire in the mod (it tested
  `pm_radios`, renamed on our electrics rung) — fixed 2026-10-21 by the vanilla-reference pass (POLISH §2).
- **(c) 6 + 1:** enclosure (98% of the 1836 population starts with it), manufacturies (97%), shaft mining (97%), distillation, prospecting,
  steelworking (94% each); sericulture is unresearchable by design.
- **(d) 2:** rubber mastication (reconsidered the same day and anchored on textile) and pumpjacks (no precursor; skipped).
- **(e) 26** in two groups: the tech-era-1 skip (the emitter treated every tech-era-1 technology as an 1836 grant, true only for starting-tech
  tiers 1–2, 59 of 444 countries — lathe, which gates three t1 rungs, and cotton gin), lifted by `research_events.era1_rule_a`; and the
  technologies left out by the 2026-08-30 `tiers_only` scope.

**The user's direction and rules** (§10.95 records the rulings): restore them one by one where it makes narrative sense; an entry counts its
precursor and may require held technologies (radio on the electrics industry, requiring electric telegraph); the second-fastest country should
start the clock in the narrative onset decade on average, and in no more than 10% of playerless runs should any country start it more than 20
years early; a late technology with no second country by 1936 is allowed but highlighted; onsets before 1836 are exempt, sized so a Russian,
Chinese or Ottoman speed-up is possible, not instant; every mark is a whole number of fully staffed levels of what it counts (a level with a
mandated automation counts its base 5,000); a switchable building counts only the main methods that can narratively lead to the technology.
"Starts the clock" = the first yearly summary in which the technology is researchable, every co-requirement is held and a source is at or above
the mark.

**The calibration** — read on the 18 complete century runs of the six artmerge arms (`20260930_232639` ×3, `20261001_124750` ×2,
`20261001_225817` ×3, `20261002_120946` ×2, `20261002_235755` ×3, `20261003_171038` ×5), each with its own book's per-level employment; a run
with no second country by 1936 counts as 1937. Those runs carry none of these entries; a restored entry speeds its technology and everything
downstream, so the marks want re-reading on a book that has them. Built 2026-10-05 (user: *"Drop the Shift Work JE set. Build it and go with
n=16"*): `tools/make_research_extra_config.mjs` holds the table (the only place it lives), first measured by `20261005_154629_jex-n16`. Two marks
moved in the build: threshing 95k → 100k (rice farms employ 10,000 a level), and shift work went.

| technology | counts (method filter) | mark (levels) | also requires | 2nd starts | early | note |
|---|---|---|---|---|---|---|
| lathe | t0 textile, furniture, glass crafts | 25k (50 craft levels) | — | | | pre-1836: Russia, China, the Ottomans start at once at any mark that lets them start; ~2 years forward |
| cotton_gin | cotton plantations | 48k (6) | — | | | pre-1836: the Ottomans at once, ~2 years forward; China has no plantations |
| canneries | food industry | 100k (20) | — | | | pre-1836: Russia 11/18 (median 7 years forward), China 5/18, the Ottomans never |
| fractional_distillation | food industry | 10k (2) | — | | | pre-1836: China 14/18 (8 years forward), the Ottomans 9/18 (16) |
| railways | coal + iron mines on steam pumps | 30k (6) | — | | | pre-1836: no real speed-up possible |
| rubber_mastication | textile | 100k (20) | — | | | pre-1836: Russia 12/18, the Ottomans 4/18, China at once |
| rotary_valve_engine | motor industry | 10k (2) | — | 1854 | 0 | prerequisites alone give 1852 |
| electrical_generation | motor industry | 15k (3) | electric_telegraph | 1885 | 0 | |
| ~~shift_work~~ | non-craft urban industry + shipyards | 850k (170) | — | 1884 | 1 | DROPPED by ruling (§10.95 item 6): an absolute mark rewards playing wide — 850k is 7% of the Dutch or Belgian population against 1.2% of the American and 0.8% of the Russian; the Netherlands reached 850k at a median 1936 while researching shift work unaided ~1881 |
| conveyors | motor + automotive | 180k (36) | — | 1916 | 1 | 3 runs with no second |
| reinforced_concrete | construction sector on iron frame or later | 61k (61) | — | 1866 | 0 | |
| pneumatic_tools | construction sector on iron frame or later | 9k (9) | — | 1885 | 0 | prerequisites alone give 1883 |
| vacuum_canning | food factory rungs (not the craft) | 75k (15) | — | 1879 | 1 | |
| steel_railway_cars | railways | 56k (56) | bessemer_process | 1866 | 0 | |
| steam_turbine | power plants | 13k (13) | — | 1905 | 0 | |
| steam_donkey | logging camps on saw mills or later | 10k (2) | rotary_valve_engine | 1888 | 0 | |
| threshing_machine | grain farms using tools (rice farms 10k a level) | 100k (20) | — | 1864 | 0 | prerequisites alone give 1862 |
| mechanized_farming | wheat, rye, maize, millet farms on steam threshers | 75k (15) | combustion_engine | 1899 | 0 | |
| pasteurization | ranches on slaughterhouses or later | 55k (11) | — | 1898 | 0 | prerequisites alone give 1896 |
| flash_freezing | fishing on steam trawlers + whaling on steam ships | 75k (15) | steam_turbine | 1925 | 0 | |
| dough_rollers | food factory rungs | 85k (17) | — | 1924 | 0 | 1 run with no second |
| arc_welding | shipyards on metal shipbuilding | 5k (1) | — | 1918 | 1 | |
| oil_turbine | power plants on coal-fired turbines | 19k (19) | pumpjacks | 1925 | 0 | |
| watertube_boiler | motor industry | 30k (6), user-set | — | — | 2 | rule 3: a second country in 4/18 only; Britain early in 2/18 |
| radio | electrics industry | 25k (5), user-set | electric_telegraph | 1932 | 0 | rule 3: no second country in 9/18 |
| art_silk | synthetics plants | 25k (5), user-set | — | — | 0 | rule 3: no second country in 15/18 |
| automatic_bottle_blowers | glass factory rungs (not forest glass) | 200k (40), user-set | — | 1916 | 1 | a decade after the onset decade |
| pumpjacks | — | — | — | — | — | skipped: no precursor |

The older entries were checked against the method rule and nothing was found: every source is one rung with one main method, or a merged host
counted by the method it runs, and every necessity anchor counts buildings whose methods all precede the technology.

---

## Step 3 — Building costs, then the first real build

**What.** Decide each rung's construction cost under the new gating, then build the mod for real: recipes, technologies and research entries.

**Status: DONE.** The first real build shipped 2026-08-17 on a flat vanilla-cost book (§10.61). The four-rung ladder then made cost part of the
formula — capacity-priced construction (§10.68), `building_cost = K₁ × 1.9^tier` from 2026-09-18 (§10.84), anchored at t1 since 2026-10-01
(§10.91.5). Today: `K(t) = K₁ · C^k`, k = t − 1, C = 1.9, so t2 costs ×1.9 and t3 ×3.6 of the vanilla building; non-craft t0 `K₁ / C`; crafts ÷50; a
merged host the geometric midpoint; the power plant 1,600 points (CLAUDE.md §1.3). Cost level (`cost1`) and slope (C) are routine levers
(§10.101.2).

---

## Step 3½ — Savegames become the instrument for state

**What.** Archive, melt, summarise and reap every autosave concurrently with the game, so a batch yields a yearly per-country state series —
complete, internally consistent and outside the log ring — beside the log telemetry, which keeps events.

**Status: DONE.** Built 2026-08-11 (`save_state_summary.mjs` + `harvest_saves.ps1`, wired into `run_schedule.ps1`; summary version 19 today);
the alignment gate passed (F50; re-run 2026-08-15, ALIGNED) and the telemetry audit moved state-of-process metrics to the saves
(TESTBED_METRICS §9). The kept last save
of each run is the escape hatch, since a summary is the record once its save is reaped. What the summary carries, the measured cost (a 5-second
streamed melt) and the rules: TESTBED_METRICS §7½; the tools: REPO_GUIDE §4. Events (technology acquisition dates included) and the market order
book stay on the logs for good — neither is in a save.

---

## Step 4 — Telemetry runs, and the loop back

**What.** Run the testbed heavily on the mod and on vanilla controls, ask whether the game unfolds as intended, and where it does not, go back
to the book. The signals named in August — GDP against vanilla, workforce composition (runners-up holding far fewer engineers, machinists and
capitalists), whether a technology leader takes markets, and wall-clock speed — are now the criteria register and its readings (§10.83;
CLAUDE.md Part 3).

**Status: IN PROGRESS, permanently** — this is the loop the project is defined by. The current measurement is the alternating batch (*What is
ahead*). Procedure: `TESTBED_OPERATIONS.md`.

### Parked

Instrument questions parked since 2026-08-11; nothing here is abandoned, nothing is scheduled.
- **Runs 4–6 of the three-arm batch** (`schedules/three_arm_tc_subsidy.json`) — the trade-centre subsidy question (F49 measured the mandate at
  35% of government expense against vanilla's 4.7%; the mandate was removed from the default config, the question left open).
- **The autosave cadence experiment** (`schedules/autosave_cadence_vanilla.json`) — the only design that separates a save's cost from the yearly
  pulse it fires with (TESTBED_METRICS §7½).
- **A stronger concentration metric** — top-3 share and HHI, value-weighted, splitting the tiered goods from the rest, before goal 2 is
  re-reported (a top-1 share over all goods gave a wrong reading once).
- **The tick-speed regression** — wall clock against continuous predictors (pop objects, live pop objects, people, GDP, building count).
- **Do empty pop records cost the engine anything?** If it iterates them they are overhead; if it skips them, the live count is the better
  regressor (TESTBED_METRICS §7½, the pop-objects box).

---

## Step 5 — Company mandates

**What.** Company mandates, prosperity bonuses and formation tests named only the first rung of each industry — the rung the ladder retires —
so companies could not follow a country up the ladder (F77, F77.1: companies held 38.5% of vanilla's tiered sector against 9.0% of ours, 86% of
the gap the lock-out alone — both slight undercounts, counted on main HQs without the regional HQs; F79: vanilla's company century). The fix
lists every tiered rung of an industry in every company that has it.

**Status: DONE (first cut) 2026-08-23, unmeasured** (§10.64; `tools/emit_companies.mjs`: all 22 vanilla company files rewritten, formation tests
OR-wrapped, prosperity bonuses per rung, the per-key throughput modifier types declared). Craft and merged keys stay out (CLAUDE.md §5.4). The
alternating batch reads the company-held rung mix against F79 (`ledger/company_check.mjs`; POLISH F3).

### Step 5a — Instrumentation first

- **(1) DONE 2026-08-21** — save summary v7: `company_levels` per building type per country (regional HQs included), the `companies` register and
  `ownership_levels` by owner class; unattributable levels are counted (`world.company_levels_unattributed`), never guessed (REPO_GUIDE §4,
  the v7 header of `save_state_summary.mjs`).
- **(2) OPEN** — `analyse_ai_tier_choice.mjs --exclude-company-owned`: the non-company flow is `Δ(total) − Δ(company-held)` per building per year.
  Report the count of country-years where `Δ(company-held) < 0` rather than clamping it — "companies only acquire" is a prior, not a fact.

---

## Step 6 — Dam megaprojects

**What.** Hydro as site-specific megaprojects — the re-entry point §10.43 left for large-scale hydro. The player-facing description is CLAUDE.md
§1.2 ("Electricity"): 122 historical projects in four dam classes on the states' resource slots, surveyed first, built by governments and
private investors with construction rights, always subsidised; the power plant at 4× construction cost.

**Status: DONE.** Ruled and first built 2026-09-26 (§10.89, probes F168); redesigned to one building per project (§10.89.9, F169–F170); cut and
canonised 2026-09-27 (§10.89.10, F171–F172); built by the engine, the script only surveying (§10.89.11, F173–F174); family survey rules
(§10.89.12, F176–F177); four classes on resource slots (§10.89.13, F220–F221); private construction 2026-10-16 (§10.89.14, F239–F240). The
consumers' recipes were KEPT as they are (2026-10-21, POLISH Q6). Open items: BACKLOG D.

---

## Step 6½ — Artisanal ownership: the last feature pass

**Status: DEFERRED to mod 1.1 or later** (user, 2026-10-21; POLISH F1). Its place was fixed by the user on 2026-10-01: *"the artisanal ownership
will probably be the last feature pass between final balance check and final polishing"* — after the final balance check, before release
polish — and it became live when the crafts were canonised (step 12).

- **What it is:** shopkeepers as OWNERS — ownership production methods that route dividends to the artisans' own class (the crafts, and possibly
  urban-centre and trade-centre shopkeepers), so the Petite Bourgeoisie holds property income, not wages alone.
- **Not researched yet:** which ownership groups the engine lets a building carry, how dividends reach a pop type, and what it does to the
  investment pool.
- **Why it waits for a measured arc:** the ruled intent (2026-10-01) is that the Petite Bourgeoisie FALLS with the crafts and RE-RISES with the
  urban centres' and trade centres' shopkeepers, the displaced shopkeepers' radicalism a temporary friction around 1848. Ownership income changes
  that arc, so it is designed against the measured arc. The arc is tracked only (the user rejected forcing it: *"your solutions are about as
  forced. Tracking only it is"*): save summary v14 `ig_by_workplace`, read with `tools/testbed/ledger/ig_workplace_series.mjs`; FINDINGS
  F190–F193.

---

## Step 7 — Visuals, proofreading, release

**What.** Make the mod releasable: the engine-compatibility pass, the art, the texts, the release metadata.

**Status: IN PROGRESS — the 1.0 polish** (`POLISH_1_0.md` is the register; the remainder is under *What is ahead*).
- **The engine-compatibility pass** — the main part of the 1.0 polish (user, 2026-10-19): vanilla script that checks a building or method the
  tier split renamed or narrowed now counts every rung. DONE 2026-10-21 (POLISH §2, `TIER_REFERENCE_AUDIT.md`, `emit_vanilla_refs.mjs`,
  `check_dlc_gates.mjs`, L39, L40).
- **Per-rung building artwork** — DEFERRED to 1.1 or later; 1.0 shows vanilla's pictures (POLISH R6).
- **The tech-tree era dividers** — CLOSED 2026-10-21, they line up (POLISH R7).
- **Proofreading every new name and description** — READY (POLISH R4). **Technology icons** — the three minted technologies share one generated
  placeholder until the user's images arrive (POLISH R5; the DDS recipe is in MODDING_NOTES).
- **Release** — release build and metadata (POLISH R1–R3, H8, H9).

### THE RELEASE TIMELINE (user, 2026-10-19)

1. **30.10** — **mod 1.0** for Victoria 3 1.13.
2. **05.11** — Victoria 3 **1.15** (1.14 folded in by the developers; 1.14 is where an AI decision-making rework was promised).
3. **~12.11** — a stable **1.15.N**.
4. **~16.11** — **mod 1.1** for 1.15.N: the ON_GAME_UPDATE pass plus whatever deferred feature the new game supports; the candidate is
   **treaty ports** (§10.103, F243–F246), built and probed on 1.13, deferred until the 1.15 AI is seen; another vector on record is the
   urban-centre electricity ×2 or ×3 (§10.89.15), which needs a century measurement. Only about four days between items 3 and
   4: room for 10-year probes and at most one n=3 century, so 1.1 can carry a feature only if it needs no iteration.
5. **18.11** — GTA VI; no attention for Paradox mods until the new year.

---

## The war research channel (ruled 2026-08-17; re-ruled 2026-09-03 and 2026-10-12)

**What.** Research entries for military technologies that a country learns by meeting them, not by building an industry. Today: six land
unit-type technologies (breech-loading artillery, defense in depth, general staff, mobile armor, NCO training, trench works) on the war gate,
and nine ship technologies on the naval gate.

**Status: DONE.** The war gate was rebuilt on 2026-08-18 after the first form proved inert: `ROOT` is not a valid scope inside a
`scripted_progress_bar` (BUGS_AND_FIXES 2026-08-17), so the gate could never pass and logged ~18,720 errors a run; the rebuilt gate took them to
0 (F70). The shape that survives: the gate is computed in `on_monthly_pulse_country`, where ROOT
is valid, registered as a named on_action (landmine L22), and handed to the bar as a per-technology country variable `pmr_wargate_<tech>` that
expires after 40 days, so no clearing pass is needed. Re-ruled 2026-09-03 (§10.69): unit-type technologies only (marines excluded 2026-09-04),
a flat 50 battalions, no casualties clause. Stages of 12 months since §10.98 (2026-10-12), non-additive, 20 stages, exempt from the literacy line.
The ship entries were switched off 2026-09-03 and back on 2026-10-12 (below).

### The NAVAL channel — OBSERVATION, NOT BATTLE (user-ruled 2026-08-18, evening)

A navy is observed by seeing the ship, not by bleeding on a front, so a ship technology ticks on POSSESSION, regardless of war.
- **Today (§10.98 item 1):** the bar ticks if WE have a qualifying ship, a declared RIVAL has one, or a GREAT POWER has one — any of the three, one
  tick; 36-month stages. (The 2026-08-18 form — ours +2 superseding a rival's +1, 5-year stages — was replaced.)
- **The gate is entirely country-scoped** — no war, front, general or character: `any_scope_ship = { is_ship_type = … }` for ours,
  `any_rival_country = { any_scope_ship = … }` for a rival's, a global variable set in the monthly pulse for a great power's.
- **Rivalry is one-sided, and that is the point**: `common/diplomatic_actions/12_rivalry.txt` carries `is_two_sided_pact = no`, so
  `any_rival_country` iterates the countries WE declared — if A rivals B and B floats the ship, A's bar ticks, not B's.
- **Every component is vanilla-attested** (read off the 1.13 files, 2026-08-18): `any_rival_country` 8 files, `any_scope_ship` 7 (in country
  scope, filtered by `is_ship_type`), `is_ship_type` 4; vanilla nests country iterators inside `any_rival_country` itself.
- **Possession covers acquisition for free**: bought, annexed or ceded ships count.
- **The technology → ship table is derived live** from `common/ship_types/00_ship_types.txt` (`unlocking_technologies`), never authored.
- **No exception for landlocked countries** (ruled): vanilla makes none for naval spread or requirements either.
- The land tree was deliberately NOT moved to this model; the same `unlocking_technologies` field exists in `common/combat_unit_types` if it is
  ever wanted.

### The war channel — RULED IN DETAIL (user, 2026-08-18)

**The gate, as it ships** (re-ruled 2026-09-03, §10.69): inside ONE war and ONE front, a general of ours with ≥ 50 mobilised battalions AND a
general on that front not owned by ROOT whose owner holds the technology:

```
any_scope_war = { any_scope_front = {
    any_scope_general = { owner = ROOT            num_mobilized_battalions >= 50 }
    any_scope_general = { NOT = { owner = ROOT }  owner = { has_technology_researched = <tech> } }
} }
```

- **Binding inside one front is the whole point.** The first form ANDed two uncoupled clauses — some war has a big general of ours, and some enemy
  in some war holds the technology — so Britain at war with both the USA and the Qing learned an American technology by fighting in China (user,
  2026-08-17). A general on the far side of a front we fight on is the enemy there by construction, which removes the need for
  `is_at_war_with` (not a valid trigger here).
- **One variable per technology**, not a shared flag: a shared flag would push the enemy test back into the bar as country-wide
  `any_enemy_in_war`, reintroducing the leak.
- **Cost (landmines L3, L4):** one pass per country per month; countries at peace exit on `is_at_war = yes`; the technology loop runs only past
  the general clause. Measured free (§10.98, F227).
- **A state of war never ticks by itself** (user, 2026-08-18): the old two-term structure (+1 for war, +2 for an enemy holding it) is gone.
- **The grant is an absolute point value** (half the tech era's base cost), so under an ahead-of-time penalty it stops being half a technology —
  the ruled behaviour.
- **Superseded parts of the 2026-08-18 ruling:** the 100-battalion threshold and the clause `num_front_casualties = { target = ROOT value >=
  50000 }` (dropped 2026-09-03; `war_gate.front_casualties_min = 0` omits it), and 6-tick monthly stages (12 months since §10.98).
- If casualties ever return: `num_front_casualties` is total casualties at that front — a location filter, not a cause filter. The engine has no
  counter splitting battle from attrition (only modifiers and the boolean `has_high_attrition`); never describe it as battle-only.

---

## Step 8 — The first human playtest's defect list (user, 2026-09-18)

The user, playing `canon-c19-in12`: *"Mistakes I noticed that need fixing. Don't do now as I'm still playing, but plan for fixes."* P1–P5 and
P7–P9 are the user's; P6 was found while investigating P1. Several measurements below were taken on that book (B 1.5, anchored at t0) and are
dated by it; the canon has since moved to B 1.64 and the t1-anchor model (§10.91.5).

| item | what | status |
|---|---|---|
| P1 | the early rungs are a money printer | DONE — closed by the user 2026-10-24: solved by the t1 anchor (§10.91.5) and B 1.64 |
| P2 | the urban-centre electricity override was lost | DONE 2026-09-20 |
| P3 | the building name said "BE target" | DONE 2026-09-18 |
| P4 | the research tooltip did not state its conditions | DONE 2026-09-18; levels wording 2026-10-21 |
| P5 | tier-3 output is enormous | ACCEPTED — rides on P1 |
| P6 | the 1836 anchor over-produces on the supply side | DONE — closed by the user 2026-10-24: solved by the t1 anchor and the seeded crafts (§10.91.5, F199); guarded by the register's hard 1836–1845 line |
| P7 | a minted top rung was locked out of its industry's gated secondary | DONE 2026-09-18 (landmine L35) |
| P8 | a t3 takes 2+ years to build | CLOSED 2026-10-28 by the user: not an issue (F255: 60–85 weeks at vanilla's per-construction ceiling; 2+ years only in late British and American private queues) |
| P9 | the tech tree should be a thing to prioritise, not to complete | a registered desire; RULING (BACKLOG B) |

P1 (the money printer), P8 (build time) and the hoard (F135) point at the same two dials — the A/B gap and the top of the cost ladder. Neither is
free (F135: the cost axis moves 1.73% of hoard per 1% of world GDP), so one campaign moving both, with P8's option (b) compensating the build time,
is the coherent experiment rather than several separate ones.

### P1 — the early rungs are a money printer

**DONE — closed by the user 2026-10-24.** Base-price margins (wages 25% of cost) of food / textile / furniture: t1 −3 / +13 / +22% and
t2 +31 / +51 / +63% on the canon, against +55% and +127% in the playtest book; a margin problem the alternating batch finds becomes a new item.
The record of the complaint follows.

The user: *"Probably need to reduce the A/B diff, or invent a more complex ladder than A^N / ((input_t0_penalty+1)*B^N). The game quite actively
resist prolonged prices under base for most goods, maybe some ladder of +70 .. +0 (base) between 1830s and 1920s can be constructed?"*

- **The arithmetic.** The output-to-input ratio steps by A ÷ B per tier; on a rung 0 anchored near break-even, that multiplicative step lands as
  a huge additive step in margin (A 2.2 / B 1.5 from a t0 anchor: food, textile and furniture at +5 / +55 / +127 / +233% at base prices,
  wages at 25% of cost).
- **F139 §5 corrected the framing**: realised, that book ran 26 / 31 / 47 / 46% at 1935 and peaked mid-century (t2 76%, t1 47% in 1860) against
  vanilla manufacturing's 23.1% realised. Judge any fix on realised margins in the 1850–1880 window (CLAUDE.md §2.7).
- **Since:** the t1-anchor model makes each industry's t1 its vanilla method with inputs × the lift, so t1 carries no A/B premium (F199: food t1
  £8.4 of value added per worker-year against the old book's £21). What remains is the t2–t3 margin and the realised path.
- **Routes** (not exclusive): (a) shrink the gap — F139 retired the A/B gap as the hoard's lever, since it drives the inflow, obsolescence and the
  price decline together; (b) a non-geometric ladder, opened by §10.86.4 — `--in-ladder` exists (2026-09-20), `--out-ladder` does not (step 10
  §3 candidate 4); (c) design against a price path instead of base: set a per-tier target price path and price each rung's break-even below its
  own tier's price. (c) needs two classes, because where pops buy the output the price is pinned near base by rising pop wealth (F97, F136),
  and it needs a high 1836 price (P6). The British market's price as % of base, medians (vanilla n=16 against `canon-c19-in12` n=4):

| good | vanilla 1836 | 1870 | 1900 | 1935 | canon 1836 | 1870 | 1900 | 1935 |
|---|---|---|---|---|---|---|---|---|
| groceries | 175 | 124 | 110 | 116 | 175 | 113 | 90 | 98 |
| fertilizer | 138 | 114 | 109 | 99 | 156 | 123 | 118 | 82 |
| explosives | 135 | 128 | 114 | 102 | 158 | 136 | 88 | 66 |
| steel | 100 | 118 | 107 | 111 | 104 | 139 | 68 | 72 |
| clothes | 79 | 112 | 116 | 105 | 56 | 108 | 82 | 88 |
| small_arms | 104 | 81 | 77 | 72 | 107 | 97 | 64 | 29 |
| artillery | 105 | 72 | 80 | 78 | 105 | 100 | 60 | 25 |
| automobiles | — | — | 175 | 142 | — | — | 154 | 102 |

### P2 — the urban-centre electricity override was lost

**DONE 2026-09-20.** `pm_electric_streetlights` burns 2 coal and adds 1 electricity, staffed by 250 engineers, instead of consuming 3 electricity.
It now lives in `tools/lib_tier4_spec.mjs` (`PM_GOODS_RULED` / `PM_EMPLOYMENT_RULED`) so a regeneration cannot drop it again, and is canonical on
its own (§10.43.0, user-ruled 2026-09-19). The user's prediction — mostly player convenience, a small economic effect — is unmeasured; the
alternating batch reads it.

### P3 — the building name said "BE target"

**DONE 2026-09-18.** The label is the recipe's goods-only break-even at base prices ("Recipe BE N%"), computed from the emitted recipe — since
2026-10-03 under the most basic secondaries (§10.93 rule 6). Names read "Tier N." since 2026-10-21 (POLISH Q8); the release build drops "Recipe
BE" (R1).

### P4 — the research tooltip did not state its conditions

**DONE 2026-09-18**: the engine ignored our `desc` because it sat on the outer `add`; vanilla's shape puts it on the inner `add` inside the `if`
(MODDING_NOTES). **2026-10-21**: every source reads `<buildings>: N fully staffed levels (now X)` and every condition is a line of the bar
tooltip, always (user: levels, not people; BUGS_AND_FIXES 2026-10-21). The earlier proposal to word everything in people was overruled.

### P5 — tier-3 output is enormous

**ACCEPTED.** Output steps by A = 2.2 per tier (t1 → t3 = A² = 4.84; t0 → t3 = 7.26 since the t1 anchor) against vanilla's ~1.33 per method
step. Employment is flat per level, so this is output per worker — the "minimum viable firm size" the user wants, and what lets the frontier
out-earn the old rung at all. It moves with any P1 change and gets no separate lever.

### P6 — the 1836 anchor over-produces on the supply side

**DONE — closed by the user 2026-10-24.** The record of the defect follows.

A starting factory converted onto rung e produced `vanilla method 1 × A^e`, while the vanilla method it ran makes ~1.33^e: tooling +88% output
world-wide, munition +65%, food +29%, furniture +25%, glass +23%, textile +18%, paper +15%, and exactly 0% for industries wholly on rung 0 (F137).
"1836 matches vanilla" held for composition and demand and failed for supply, and so for price — the L13 check compares the mapping, not the
goods produced.
- **Fix options as written** (each needing a ruling): scale a converted building's levels by the inverse of its rung's output multiplier;
  convert everything onto rung 0; re-anchor on the measured 1836 prices; an output-goods penalty on the t0 recipes (closed unless decided
  explicitly, CLAUDE.md §2.5).
- **Since:** under the t1-anchor model a converted t1 rung makes exactly its vanilla method's output, and F199 measured the 1836 supply back on
  vanilla's in the seven markets (groceries 0.93, paper 0.96 against 1.33–1.53 and 1.16 before) on the `e1a-artmerge` book. Not re-read on the
  canon.

### P7 — a minted top rung was locked out of its industry's gated secondary

**DONE 2026-09-18.** Vanilla gates three secondaries by naming main methods (`pm_elastics`, `pm_precision_tools`, `pm_bone_china`); a minted rung
has no `vanilla_pm`, so furniture's spray finishing missed `pm_precision_tools`. A minted rung now inherits the gate membership of the rung below
(`build.ps1` `$script:pmRemap`, `emit_secondaries.mjs`), and landmine L35 checks the emitted gates: if any rung of an industry is named, every
higher rung must be.

### P8 — a t3 takes 2+ years to build

**CLOSED 2026-10-28 by the user: not an issue** (F255; nothing deferred). What follows is the record.

**Was OPEN.** Build time is a building's cost ÷ the points per week it is allocated (V3 has no construction-time field), so build time and capital
cost are one dial.
- **Measured on `canon-c19-in12`** (t3 at ×6.86 of vanilla's cost): Britain's government queue at 1900 ran 327 points a week over 10 items, ~33
  each, so 4,115 ÷ 33 = 126 weeks = 2.4 years — the user's figure (vanilla 600 ÷ 33 = 18 weeks). Britain's construction sector was ample (65 levels
  at 1860, 1,316 at 1935); the queue divided it. The private queue held 130 / 511 / 1,000 items at 1900 / 1920 / 1935 against vanilla's 73 / 186
  / 126 — the 1,000 is the cap (`CONSTRUCTION_MAX_NUM_PRODUCTION_BUILDING_CONSTRUCTIONS_SCALED_MAX` 999), reached through the coefficient §10.75
  doubled from 0.05 to 0.1 — and the private pool took 74–83% of Britain's construction speed. Not read out of the engine: the allocation rule
  (an even split reproduces the figures).
- **Since:** the canon's t3 costs ×3.6 of vanilla (t1-anchored), not ×6.86. The queue coefficient is still 0.1. **Read on the 1.0 canon (F255):**
  the binding limit is vanilla's per-construction ceiling (`country_max_weekly_construction_progress`: 10 base + 30 from five society
  technologies), not the even split — canon elements get 31–36 points a week, so a t3 level takes 60–85 weeks; 2+ years only in Britain's and the
  USA's 1935 private queues (477 / 264 elements at ~11 points each). A further option: (e) raise that ceiling — shorter builds, capital cost kept.
- **Options:** (a) flatten the top of the cost ladder (`--cost-ladder`) — also the hoard's and world GDP's dial (F135: log world GDP on log C at
  −3.34); (b) make construction faster by tech era in step with the cost ladder — vanilla's construction methods give 2 → 5 → 10 → 15 points a
  level (base, iron frame, steel frame, arc welded); a t3 at arc welding now needs 2,166 ÷ 15 = 144 level-weeks against a vanilla-cost t1's 600 ÷
  5 = 120 at iron frame (it was 274 at ×6.86). Scale the late methods' points AND goods by the same factor, or capital cost falls with the time
  (goal 3 undone); needs owning `common/production_methods/13_construction.txt`; a GDP lever to measure; (c) the queue coefficient back to
  vanilla's 0.05 — F125 exonerated it for the hoard, but it speeds only the AI; (d) shrink the private pool's inflow (P1, the hoard).

### P9 — the tech tree should be a thing to prioritise, not to complete

The user, after a Brazil campaign: *"I'd prefer the late game techs to be less accessible … I ended up maybe 5 techs short from the absolute full
tech situation … please register the desire to make the tech tree less a thing 'to complete', and more a thing to prioritise."* A standing
desire, matching the anchor principle (CLAUDE.md §2.2 rule 2). F138 measured it then: the tree was never made deeper; the AI completes it as in
vanilla; the human advantage was ~35–50 technologies. Since then §10.97 halved ordinary research and reworked the entries, and the leader's share
of each tier is read in every batch (`tech_census.mjs`). **Levers today**, cheapest first: the stage length (a routine lever, 36 months; 48 was
ruled out, F237); the grant per stage (half the base cost — decided, changed only as a deliberate event, CLAUDE.md §2.5); the ahead-of-time
define or the tech-era-4/5 base costs — the lever that hits the top of the tree and leaves the bottom alone; real depth (minted technologies with
content, never an emptied vanilla one — a content project). More tech spread (§10.97 item 8) pushes the other way.

---

## Step 9 — The margin-compression campaign

The user, 2026-09-18: *"I really want to decrease margins across the board, tbh, in both early tiers (a bit) and the late tiers (a lot,
otherwise both their margins and natural cost becomes exorbitant)."* The plan: compress r = A ÷ B, which moves P1, P5, P8 and the hoard together,
holding capital per unit of output constant (C ÷ A).

### §3 — the trap: the level is not the same in every industry

Rung 0's base-price margin differed by industry (+25% glass, +5% textile, −19% steel at the 1.2 lift), because the lift sat on vanilla's own
recipes, whose margins differ. A uniform r compression therefore lands unevenly — at A 1.8 steel loses money at base on three of its four rungs
while glass still earns 36–62% — and worst on the thin-margin chains (steel, fertilizer, explosives, motor) whose prices also fall (F136). The way
out proposed was to level rung 0 per industry first (`--in0-level`); that axis is now closed (§10.86.4, "the solver all over again").

### Batch 1 (2026-09-18/19, F139, session `20260918_235214`)

`canon-lvl-a19b17` — rung 0 levelled at +5% with A 1.9 / B 1.7 / C 1.64 — was out: one run intact at world GDP 0.60×, one broken by stall at
0.45×. It fixed the hoard (pool H 0.82×) and inverted the realised ladder (designed 5 / 17 / 31 / 47%, realised 37.6 / 26.0 / 26.3 / 27.4%). The
market eats most of the designed slope, so a design must over-provide it; and the A/B gap drives the inflow, obsolescence and the price decline
together, so it is retired as the hoard's lever.

**Status: CLOSED 2026-09-19.** The campaign's standing rule "do not raise `in0` above 1.2 in the same batch" was superseded by the user's
follow-up — a tighter r with a higher t0 input penalty (§10.86.3) — which became step 10; the canon later moved B to 1.64 (§10.88).

---

## Step 10 — The tier-0 input penalty, settled at the anchor and untested over the century

After F139 the user re-opened the penalty axis: *"we need a tighter A/B to avoid money printing, but a higher t0 input penalty to ensure that t0
industry can't work at base prices, require higher output prices"* (§10.86.3). Paper analysis and 28 short probes in five sessions settled what
the penalty does at the anchor (F140–F147).

**Status: partly superseded.** Since §10.91.5 (canon 2026-10-12) every industry is anchored at t1 (`--anchor-for` on all 17), t0 steps down ÷1.5
on output and on input value, and the lift (1.2, the pop-good lift 1.2) sits on the anchor. Two items stay OPEN in BACKLOG B: the graded penalty's
century (the generator still refuses `--anchor-for` with `--in0-stage`) and the output-ladder flag (§3 candidate 4).

### §1 — what was settled (2026-09-19)

- The design intent is arithmetically right (F143 §1): at the canon's own realised prices a lift of 1.3–1.4 turns textile's 1836 rung from
  "survives on a sliver" into "destroys value from 1890 on".
- At the anchor the penalty is absorbed (F142): realised t0 margin 26 / 23 / 21 / 21% at lift 1.2 / 1.3 / 1.4 / 1.5 after 21 months. Read F142
  as the anchor and F143 as the design. The world-product cost is about 1 point per +0.1 of lift, and it saturates.
- The raw-input penalty's working maximum is ≈ 1.40 (F140, F144, F145): at 1.50+ the steel industry is demolished at the anchor.
- The graded penalty has a final shape (§10.86.6–.7): `--in0-stage 1.40,1.20,1.10 --in0-supplier 0.5` (`probe-gradsup`) was the best anchor of
  any penalised book (F147 §1c, n=6).
- Early steel tightness does not predict late GDP (F146: pooled r = −0.15, within-book +0.19).
- Instrument rule (F147 §1c): on a 1836→1838 batch n=2 is enough for steel (~18 levels), not for engines, motor, explosives or munition
  (single-digit levels, where one seed moving one level is a 30–50% swing).

### §2 — what was not settled

- The lift 1.2 FLAT has a century of evidence (every canon from `canon-flat-in12`, F110, to the t1-anchor model carried it); 1.3 flat ran for
  a century and is closed (F118 runaway, F119 stall).
- The lift 1.4 flat and the graded penalty have only ever seen 21 months — too short to see obsolescence, the price decline, the money printer or
  the hoard.
- The supplier weights are an 1836-derived number applied to every rung (§10.86.7; at 1910 the same measure reads steel 0.31 against 1836's 1.00);
  only `k = 0.5` and the `map` variant were tested.

### §3 — the next step, as it stood (2026-09-19)

Written against the t0-anchored book of the time; candidates 1–2 now need the `--anchor-for` / `--in0-stage` conflict lifted first.
1. A century of `--in0-stage 1.40,1.20,1.10 --in0-supplier 0.5` — one change from the then canon's uniform 1.2.
2. The same penalty with F141's A 1.9 / B 1.5 / C 1.75 — two levers, readable only beside `canon-a19-gm` (F141 §4).
3. P6 / F137 first, if either is to be clean.
4. **A non-geometric output/input ladder** (F148): vanilla's own method ladder over the rungs the 1836 map holds is out ×1.00 / 1.48 / 2.67 with
   input tracking output within 1–2% — pure throughput at a flat margin. A front-flattened book (`out 1 / 1.40 / 2.60 / 10.65`, `in 1 / 1.18 /
   1.70 / 3.38`) scored an 1836 anchor of −1.9% against +27.3%, a t1 margin of 25% (vanilla manufacturing 23%, F92) and obsolescence 15 of 17.
   It needs `make_ab_config --out-ladder` (mirroring `--cost-ladder` and `--in-ladder`, which exist) and its arm in `lint_tier_eras.mjs` (L31).
   Never run.

---

## Step 11 — Raise the world product without lowering B: post-JE tech finishing and broader trade

The user, 2026-09-23: *"My expectation is that pushing post-JE tech finishing more efficiently and broadening trade will increase the economy
some more, improving world GDP (but worsening Britain's U\*)."* B could not do it (F158: a lower B raises world GDP and collapses Britain's U\*).
The user's correction the same day: the two changes go in for their own reasons, not as levers against B, so the base they land on should sit
slightly BELOW the GDP target — the under-side rule (CLAUDE.md §2.5, §10.79). World GDP is the primary and steadier target; Britain's U\* is a
constraint (CLAUDE.md §3.2).

1. **Post-JE tech finishing**: the finish boost — +10,000 AI weight on a technology at ≥ 99% progress (`emit_tech_finish.mjs`; F160, F162; no
   wall-clock cost, F164). Any further scope (stage length, per-tree AI weight, spread) is a ruling owed (BACKLOG C).
2. **Broader trade**: the traded quantity per unit of trade capacity set by good class — five classes, bulk at vanilla (F155, F159;
   `make_trade_config.mjs`, `emit_goods.mjs`). F161: trade ×1.9 and world GDP 0.87 → 1.13 with one runoff; F163: ×1.5 bought only ×1.03 the trade
   of ×1.

**Status: DONE — canonised 2026-09-25** as trade ×1 at B 1.64 with the finish boost (§10.88). The follow-ups, numbered as when it closed:
1. A century on the combination — answered by the later canons' centuries (F177 on).
2. The consumer-chain old rungs still pay (87–93% of their levels profitable, F163) — the central open problem (CLAUDE.md §2.1).
3. Britain fully employed in most seeds, with no relation to B — OPEN (BACKLOG B).
4. A uniform trade weight is absorbed by less trade capacity, so price convergence needs another lever (trade capacity itself?) — OPEN
   (BACKLOG B). F178 §9: in textile, furniture and tooling 28–44% of the rest of the world's old rungs sit in markets with no trade capacity.

Instrument notes: size a step against the seed spread, not the hoped-for effect (F158: within-config world GDP spread 0.37–0.50); the reading
gate applies (§10.83.8); landmine L37 (the stop watcher blind on multi-config schedules) still owes its detector.

---

## Step 12 — The artisanship t0 rungs

**Where it came from.** On 2026-09-30 the user closed Britain's U\* and the price path "on the current lines" (F178, F179, §10.90): the ladder
levers are one axis with world GDP; the price path runs only through GDP; more trade cannot reach the survivors; capital export does not help.
The next major change was *"drastically changing e0 economy to push its effectiveness per wage unit way lower, implementing 'true artisanship'
on lower level (prospering in scarcity, badly scalable, replaced in mid-game by industrial scale)"*.

**What.** The t0 rungs of food, textile, furniture, glass, tooling and paper become 500-worker craft rungs that die where wages rise and survive
where they do not (CLAUDE.md §1.2, §1.3 exception 1).

**Status: DONE — canon since 2026-10-12** with step 13 (§10.99). The path: ruled and built 2026-09-30 (§10.91.1, `make_artisan_config.mjs`;
F180–F182); one book with step 13, the machinist staffing and the hiring floor (§10.91.3, F184–F188); the staffing re-ruled as 30% shopkeepers
and 70% laborers (§10.91.4); the t1-anchor recipe model and one craft rule (§10.91.5, F197–F200); the arm's centuries (F203, F209, F210); the last
tech rework (step 14).

**Deferred:** a Muskets craft; spreading the 1836 craft levels over the largest states (unverified whether §10.91.5's output-matched seeding,
which puts the extra levels in each country's five most urbanised states, already covers it); craft secondary lines (POLISH B3, 1.1 or later).
Trimming automation that duplicates a main-method upgrade is done (§10.93 rule 5).

---

## Step 13 — Six add-on rungs become method switches

**What.** Baking Powder, Electric Sewing Machines, Spray Finishing, Paper Bleaching, Improved Fertilizers and Electric Arc become second main
methods of the rung below, switched without construction (CLAUDE.md §1.2, §1.3 exception 2). Ruled 2026-09-30: the host at the geometric-midpoint
cost, recipes by the formula; a branch if hosts run hot — the added method ×1/√1.9, or host cost ×1.62 (deferred, §10.91.2).

1. DONE — the book (`make_merge_config.mjs`, `method_of` on the removed rung).
2. DONE — builder support: no building for a merged rung; its method in the host's main group, gated by its technology; per-method secondaries;
   companies keep merged keys out; research counts the host's levels on the merged method; the start converter throws on a merged rung; L31.
3. **OPEN** — method-tier accounting: the register's T0–T3 splits a host's workers by method (`criteria.mjs`) and `merge_methods.mjs` reads the
   switch, but the old-rung census and obsolescence readers (`rung_econ`, `rung0_*`, `lib_obsolescence`, `tiered_panel`) still key on building
   type — teach them before quoting them on a merged rung.
4. DONE — probed (F182: the AI switches hosts one at a time over 0–19 months, no construction; F184: the merged methods spread decades before the
   older canon built those rungs).
5. DONE — one book with step 12 (§10.91.3).

**Status: DONE — canon since 2026-10-12** (§10.99); item 3 open.

---

## Step 14 — The artmerge arm's last tech rework, then the canonisation decision

The user, 2026-10-10: wrap up the crafts + merges arm with a final tech rework — world volumes back onto vanilla's, the research entries more
important — then decide whether the arm is canonised or the pre-artmerge canon is resumed.

**Status: DONE 2026-10-12 — the arm is the canon** (§10.99), as `jex-dam4s-rs`. The rework's ruling and targets are §10.96; the research model
(`tools/research_model/`, F223) came first; the two passes were §10.97 (F226) and §10.98 (F227: 2 intact / 1 runoff, consensus loss 5.37, the
majors at 0.97 of vanilla's technology, play ×1.005). Returning to the pre-artmerge family would need the performance changes reimplemented
(CLAUDE.md §4.3). The canon has moved since (x = 25, private dams, engines unlifted, the monopoly threshold, the polish): CLAUDE.md §4.3.

---

## DEFERRED FIXES — known, not scheduled

### `deviates_from_vanilla` names only six directories (DEFECT, found 2026-08-12)

`run_observer.ps1` builds `build_state.json`'s `deviates_from_vanilla` from a hard-coded probe list — `common/buildings`,
`common/production_methods`, `common/history`, `common/pop_needs`, `common/ai_strategies`, `localization` — while the canon's build carries 24
directories under `common/` plus `events`, `gfx`, `localization` and `map_data`. The guardrail is intact: landmine L7 walks the built mod
itself. What is wrong is the record, and `arm` is derived from it: a control carrying an unprobed directory is recorded as a clean `control`
rather than `control+UNEXPECTED`, and an overlay whose content sits outside the list as `overlay+EMPTY`.
**Fix:** derive the list by walking the built mod, as L7 does, and keep `arm`'s derivation on top. Not while a batch runs (`run_observer.ps1` is
in `tools/testbed/`). Sessions before the fix under-report their content; never back-fill `build_state.json`, it is a historical record.

### L13 — the 1836 start emitted on the wrong tier (found 2026-08-12; masked by construction, guarded)

**Root cause.** `Get-SplitMaps` (`tools/history_lib.ps1`) keys the converter's base-building map on the FIRST rung (`if ($n -eq 1)
{ $baseIndustry[$t.key] = $ind.id }`). When the six-rung ladder minted invented t0 keys, slot 0 stopped carrying the vanilla building key, so a
vanilla `create_building` naming e.g. `building_textile_mill` matched nothing, was not recorded as `unmapped`, and passed through unconverted onto
whatever rung owned that key — 98 of 327 starting factories on tier 1 against their own methods (TESTBED_LANDMINES L13).
**Today.** Every first rung of the four-rung books carries the vanilla building key (the crafts included), so conversion works by construction.
`Get-SplitMaps` still keys on position; the guard is `tools/lint_start_conversion.mjs` (L13, every build, throws), which checks the emitted
history: every vanilla main method maps to some rung, an aliased method moves no factory across most of the ladder, and every emitted building
key is one the config defines. A proper fix would key the map on the rung carrying the vanilla key and send a known industry's unmatched key
to `unmapped`.

### Fixed or moot (one line each)

- **The emitted files' missing UTF-8 BOM** — FIXED 2026-09-25 (BUGS_AND_FIXES).
- **The AI subsidised only the obsolete tier of each infrastructure chain** — MOOT: ports, railways and power plants are vanilla's buildings in the
  canon (POLISH C5).
- **Drop steel's tier-1 rung** — MOOT: the four-rung steel ladder is vanilla's own methods (POLISH C5).
