# Polish for mod 1.0 — the register (started 2026-10-21)

The user opened the polishing sessions on 2026-10-21 with five items: (1) research-entry texts and bar tooltips, (2) every vanilla script
position that references a tiered building or one of its production methods, (3) features deferred to polishing, (4) bug fixes deferred
to polishing, (5) anything else that needs fixing. Mod 1.0 ships **2026-10-30** (game 1.13); the alternating vanilla + canon batch
(`alt_vanilla_canon_n16.json`, ~100 h) runs after the first round of polish and measures the 1.0 build, so **anything that moves script or
economics lands before it; text, icons and metadata can follow it.**

This file is the decision layer. The evidence lives in:
- **`TIER_REFERENCE_AUDIT.md`** — item 2, every reference with file:line, verdict and fix (supersedes `MISSING_PM_REFERENCES.md`).
- **Appendix 1** below — items 3 and 4, the sweep of everything deferred to polishing (22 items, checked against the build).
- **Appendix 2** below — item 5, an independent hunt over the generated mod and six canon century runs' error logs.

Status words: **DONE** · **RULING** (needs the user) · **READY** (clear-cut, can be done without a ruling) · **VERIFY** (look in game first).

---

## 1. Research entries — DONE 2026-10-21 (commits `70daba8`, `0986b5f`), seen in game (check 1)

- Every condition is now a line of the bar tooltip, always: each source, each counted condition, the war and fleet gates (literacy only in the body, user-ruled after check 1), worth
  their tick or 0 (BUGS_AND_FIXES 2026-10-21; MODDING_NOTES → *A scripted progress bar's tooltip lists only the add terms evaluated*).
- One wording, in levels: `<buildings>: N fully staffed levels (now X)`; one body template for every entry.
- ✅ Verified in game (in-game check 1): the lines render, the 0-valued ones included.

## 2. Vanilla references to the tiered industries — RULING, then a generator

**What was found** (`TIER_REFERENCE_AUDIT.md`): 86 distinct script blocks reference a tiered industry's vanilla building key or one of its
vanilla production methods. **22 are DEAD** (can never fire or complete), **49 NARROW** (count only rung 0 — in 10 of them a 500-worker
craft, so a vanilla level threshold is ~10× easier), **5 SHIFT** (fire, but mean something else). Plus ~48 throughput modifiers in 20 files
that boost rung 0 only, and 44 `Invalid Production Method` load errors per run. Checked by hand against the game files: Belle Époque, the
grand exhibition, the industry-ban laws, the military-industry principles, the art journals — all as the audit says.

**The cases that matter most:**
1. ⭐ **The vanilla art journals (romanticism → realism → camera → film) can never complete**, so realism +3,500, camera +4,150,
   film +6,000 and mass propaganda +5,850 of research progress never arrive. ⚠⚠ **§10.98 EXCLUDED realism, camera and film from OUR
   research entries on the premise that "vanilla's own universal entries advance them" — and those entries are dead in the mod.** So the
   art chain has had no entry of any kind since 2026-10-12. Fixing the art journals restores what §10.98 assumed.
2. **Belle Époque never activates** (needs a rung-0 academy running photographic or film art).
3. **The industry-ban and extraction-economy laws demolish only rung 0**; every later rung survives a ban.
4. **Tech-boost events dead or narrowed**: repeaters, plastics, radio dead; steel railway cars, rifling, dynamite only for the old rungs.
5. **Power-bloc Military Industry principles and the event rewards for modernising boost the OBSOLETE rung** (plastics → the forest-glass
   craft, dynamite → Leblanc, engines → steam engines) — against the mod's own obsolescence design.
6. **Grand exhibition** needs a 10-level traditional-art academy (the user's example).
7. **Player objectives demand the obsolete rung** (refining goods → blister steel, specialized goods → steam engines, local arms → muskets).
8. **Prohibition is never shown** (distillery methods renamed; the food craft cannot distill).
9. **Industrialisation events dead**; the mechanised-loom accident fires on artisan crafts instead.
10. **AI levers point at the retired rung**: the admin-strategy subsidies for tools and explosives (the craft and Leblanc), negotiation
    promises of rung-0 arms/artillery/munitions/academy.

**The proposed fix** (audit §5): one generator, `tools/emit_vanilla_refs.mjs`, beside `emit_companies.mjs` — additive helper triggers /
values / effects per industry (`pmr_is_<ind>`, `pmr_has_<ind>`, `pmr_is_<ind>_e<k>plus`, `pmr_runs_<pm>`, `pmr_level_v`), an additive
`on_law_activated` hook for the ban laws, the six missing throughput modifier types, and whole-file transforms of the affected vanilla
files rewritten from the live game text on every build (match counts asserted, THROWS on drift — a rebuild obligation on patch, not a
freeze), with a build-time scan that throws on any tiered reference left outside an owned-and-transformed file or an accepted list.

**Rulings needed** (with the recommendation):
| # | Question | Recommended | Why |
|---|---|---|---|
| R2.1 | "N levels" tests (grand exhibition and the rest) | ~~one building of any rung at level N, everywhere~~ → **the user (2026-10-21): "go one by one and assess, whether it makes sense narratively"** — DONE as `TIER_REFERENCE_AUDIT.md` PART 2: 30 any-rung, 6 non-craft, 15 a technology's era set, 12 whatever runs a named method, 1 highest rung held, 1 every rung removed, 7 left as they are; judgement calls listed there (F) | |
| R2.2 | crafts in vanilla "industry building" tests | ~~count them at a tenth~~ → **the user leans "exclude craft ones completely", unless the test is about traditional production** — the highlighted cases are PART 2 (B): "Industry Suffers" and the Serbian slander button (recommended in), Occitan food, haute couture, Japan's calendar malus (to rule) | |
| R2.3 | the admin-strategy tools/explosives subsidies (a file we already own) | ~~extend to every non-craft rung~~ → **REJECTED by the user**: "such decisions are stopgaps … for now we don't mandate subsidies, except for infrastructure". Vanilla's own two entries (which now subsidise the crude-tools craft and the Leblanc rung): **RULED 2026-10-21, both go** (the user: "remove crude-tool craft and Leblanc shouldn't be subsidised either") — `building_subsidies` none for `building_tooling_workshop` and `building_explosives_factory`, with the generator, before the batch | |
| R2.4 | scope (how many vanilla files the fix takes over) | ~~tier 1 (22 files) + the throughput modifiers + the negotiation promises~~ → **RULED 2026-10-21: everything, flavour included — tier 1 + 2, 60 files** (the user: "The scope does include flavour files. Basically option B") | |

Effort: a day for the generator, its guard and a probe of the ban-law hook; it must land **before** the alternating batch.

⭐⭐ **DLC CONTENT MUST STAY BEHIND ITS DLC — a hard rule (the user, 2026-10-21: "This isn't my intention, and that's explicitly prohibited by
PDS").** How the game gates it: every DLC's gameplay ships in the BASE game folder behind `has_dlc_feature = <feature>` triggers and the
`dlc = dlcNNN` field of 97 event files; the `game/dlc/` folders hold only art, music and sound. **Checked the same day, the current build
unlocks nothing:**
- the 68 vanilla files the mod replaces wholesale keep every gate, file by file (the seven gated company files 11/12/7/7/8/15/12, two
  history files 1/1);
- the files it generates from vanilla templates (the tier buildings from `01_industry`, `06_urban_center`, `11_private_infrastructure`,
  which carry no gate; the per-rung secondary methods) drop none — the one gated method on a tiered building, the power-bloc canning
  `pm_vacuum_canning_principle_3`, keeps `unlocking_principles` on our copy;
- our own systems only READ gated things: the dams' family rule reads investment-rights treaties, which exist only with the
  `foreign_investment` / `mp1_treaties` features, and a building's `can_build_*` conditions can only restrict construction, never allow
  what the engine would not.
**The reference fix must keep it so** (it takes over DLC event files: Montenegro `dlc014`/ip3, Japan `ep2`, the immersion-pack modifiers):
(1) the generator THROWS unless every `has_dlc_feature` and `dlc =` line of a vanilla file survives unchanged in our copy; (2) a preflight
landmine re-counts them over every owned file against vanilla (today's check, made permanent); (3) any check of ours that fires vanilla
DLC content carries that content's own DLC condition explicitly — e.g. the Montenegro check below.

## 3–4. Deferred to polishing (Appendix 1) — the ones for 1.0

| # | Item | Status | Effort |
|---|---|---|---|
| R1 | Release metadata: version 0.1.0 → 1.0.0, a release build without the "(built …)" name stamp, a current short description | DEFERRED to ~2026-10-26 (user: "this is still a prefinal version"); the final build also drops the recipe detail ("Recipe BE N%") from the names | S |
| R2 | No `thumbnail.png`; no LICENSE | DEFERRED to ~2026-10-26 (user) | S |
| R3 | README stale: 22 industries / tiered ports and railways / `canon4v-hai3`; no player install route, no "new game only" | DEFERRED to ~2026-10-26 (user) | S |
| R4 | Proofread every generated player-facing text (3 minted techs, building names, dam strings, craft and secondary names, company lines) | READY | S–M |
| R5 | The three minted technologies share one placeholder icon | READY | S |
| R8 | Dam texts predate private dam construction ("in our own state or a subject's", "each owning what it builds") | DONE 2026-10-21 (the text pass) | S |
| B1 | Dam level cap with two foreign builders on one site unverified | VERIFY (probe or hand test) | S |
| R6 | Per-rung building icons (every rung shows the vanilla picture; all dams the power plant's) | DEFERRED: vanilla pictures for 1.0, new art in 1.1 or later (user, 2026-10-21). The cheap variant was dropped: method icons are 104 px against the buildings' 256 px | S–M / L |
| R7 | Era dividers in the tech-tree GUI | CLOSED 2026-10-21 by in-game check 5: the bands line up, no fix | S |
| F1 | Artisanal ownership — "the last feature pass", live since the crafts were canonised | DEFERRED to mod 1.1 or later (user, 2026-10-21) | L |
| B2 | Mandated looms not enforced on the merged textile building (1–2 stale levels a game) | ACCEPTED for 1.0, revisit in 1.1 (user, 2026-10-21) | M |
| B3 | Crafts carry no secondary line (no canning, stills, luxury) | DEFERRED to mod 1.1 or later (user, 2026-10-21) | M |
| N1 | "Recipe BE N%" rides along wherever a building name is referenced (company modifiers: "Era 2. Arms Industries (Bolt Action Rifles). Recipe BE 55% building Throughput") | DONE 2026-10-21 for the company modifiers and the research texts (the per-language short name `<key>_pmr_short`); company FORMATION lines still print the full name until "Recipe BE" goes at release | S |
| C1 | `TECH_AHEAD_OF_TIME_PENALTY_FACTOR = 0.25` ships at vanilla's value with a false comment | READY (drop the line) | S |
| C5 | Stale "open" lines in BACKLOG/ROADMAP that are done or moot | READY | S |

### R5 — the three technology icons: the specification (2026-10-21; no image generation here, the user draws or sources them)

Measured from vanilla's own 180 invention icons (`game/gfx/interface/icons/invention_icons/*.dds`, e.g. vulcanization, mechanized_workshops,
nitrogen_fixation):
- **File:** DDS, **256 × 256 px**, **uncompressed 32-bit BGRA** (A8R8G8B8 — masks R 0x00ff0000, G 0x0000ff00, B 0x000000ff, A 0xff000000), **full
  mip chain (9 levels, 256 → 1)**, 349,652 bytes. (The placeholder has no mips; it works, vanilla's all have them.) A 256 × 256 PNG with
  transparency is enough to hand over — converting it to this DDS is mechanical and can be done here.
- **Names:** `gfx/interface/icons/invention_icons/catalytic_synthesis.dds`, `continuous_web_processing.dds`, `spray_finishing.dds`; `emit_techs.mjs`
  then points each technology's `texture` at its own file.
- **Style:** ONE isolated object, no background, frame or text — 40–65% of the pixels fully transparent; painted, near-photographic rendering in
  a three-quarter view from slightly above; soft key light from the upper left; muted, low-saturation metal and wood; centred, filling ~85–90% of
  the canvas; anti-aliased edges.
- **Subjects** (each distinct from the vanilla icon of the technology before it):
  - **Spray Finishing** (furniture e3, 1923): a period compressed-air spray gun with its paint cup, a fine mist hitting a glossy lacquered panel or
    chair back. (Vanilla's lathe and mechanized-workshops icons are a lathe and a steam hammer.)
  - **Continuous Web Processing** (paper e3, 1930): steel drying cylinders with one unbroken white paper web running over them onto a large reel —
    the reel is the clearest read at small size.
  - **Catalytic Synthesis** (fertilizer e3, 1937): a tall VERTICAL converter or reformer column with pipework and a gauge, perhaps white fertilizer
    prills at its foot — vanilla's nitrogen fixation is a horizontal bolted high-pressure tube, so avoid that shape.

## 5. Found by the independent hunt (Appendix 2)

| # | Item | Status | Effort |
|---|---|---|---|
| H1 | **Non-English players see English names where vanilla translates**: the 17 rung-0 keys override vanilla's translated names and lens texts; all 56 main-method names are English though 53 are vanilla methods with translations | DONE 2026-10-21 (vanilla building and method names and lens texts per language) | M |
| H2 | **Crafts show method groups whose only option is "off"** (Bakeries: canning, distillery — confirmed) — breaks §10.93's rule; the drop is missing on `emit_secondaries`' rescaled path and the lint does not catch it | DONE 2026-10-21 (emit_secondaries drops them; lint_pm_combos check 8 guards it) | S |
| H3 | Dam build tooltips probably list every project of the class (10/13/38/61 branches) | CLOSED 2026-10-21 by in-game check 4: no requirement list renders | S |
| H4 | Dam decisions show internals (`pmr_dam_bur_headroom > 1500` with no loc; a raw variable name) | DONE 2026-10-21 (the text pass: requirements as sentences, the AI cooldown hidden) | S |
| H5 | ~3,700 lines of dead `pmr_dam_driver` script ship, registered nowhere | DONE 2026-10-21 (emitted only when registered; a short probe checks dams still work) | S |
| H6 | `00_starting_inventions.txt` ships identical to vanilla (L14/L15 read it — they need a fallback) | READY | S |
| H7 | Builds off the default Steam path: 8 emitters hard-code the game path although the README promises `VIC3_GAME` | READY (one shared resolver) | S |
| H8 | Release logging: ~12k debug-log lines a century (dams 5.6k, research 6.3k) | RULED 2026-10-21 — **two build kinds**: DEBUG builds (run locally, full telemetry and logging) and RELEASE builds (designated explicitly; no telemetry or logging at all except a start-up manifest line saying mod version X is loaded). The 1.0 build (~27.10) is the first release build; the alternating batch runs on a debug build. To build: a release switch in `build.ps1` | S |
| H9 | Compatibility footprint: 83 vanilla files replaced wholesale — the README should list them | READY (with R3) | S |
| — | Error logs of six canon-family century runs against ten vanilla: **no error line names a mod file**; the only mod-caused classes are item 2's | — | — |

## Text pass — the generated texts made uniform (DONE 2026-10-21; the user: "make sure that they're all uniform in style unless need to be, and match current mod design")

An inventory of every player-facing string the build writes (a read-only subagent; 48 issues), then the rewrites. The style it set: "we / our"
voice; one requirement template, `<what>: <mark> (now <figure>)`, a qualifier after a semicolon; vanilla loc keys wherever vanilla names the thing
(`$building_x$`, `$pm_x$`, `$law_x$`, `$STATE_X$`, `$region_x$`), and a rung by its short name; digits with thousands separators; American spelling,
as vanilla; the typographic ’ (never an ASCII apostrophe); no script names, variables or internal words in front of the player.
- **Research entries** (`emit_research_events.mjs`): the stage sentence ("then up to 18 more of 36 months each until we have researched X. Each
  completed stage grants 50% of the base research cost of X"), one verb for "has the technology", "Further stages completed: N of 18", "2.5 fully
  staffed levels of 5,000 workers", "(now X); needs <tech>", literacy "Literacy 52% (45% needed)", war entries against "an enemy that has already
  researched X"; law names stay in a bar line unless one carries an ASCII apostrophe in some language (read from the game: today only English
  "Workers' Protections"); 12 unused generic keys no longer shipped.
- **Rung short names** (`build.ps1`, `<key>_pmr_short`, per language — vanilla's building + method names): what research texts and the company
  throughput modifiers call a rung, never the full "Era N. … Recipe BE N%" name.
- **Config labels** (both canon copies and their generators — display only): the extra-entry source labels ("Grain and rice farms ($pm_tools$ or
  later)" — the old label left the rice farms out), the condition labels ("A, B or C"; Civilizing Mission "do not have $law_no_colonial_affairs$";
  "Our largest $building_urban_center$: N levels"), the count names, the two irrigation maluses ("A storage dam upstream would end this."), "Partial
  Flood Control".
- **Dams** (`emit_dams.mjs`, a subagent): the survey decision description (the current rules, private investors, the bureaucracy it ties up, the
  site's effects, exact numbers), its requirements as sentences (the AI cooldown hidden), the build-requirement tooltips in the we-voice with the
  correct family rule, the survey entry and modifier, the stop decision, the site trait (names the building, the survey and its technology, the
  effects), "Expand" lens texts, `$pm_base$` / `$pm_hydroelectric_plant$`, 252 dead keys no longer written. The dam SCRIPT is unchanged except
  presentation: every dam file byte-identical but the decisions, whose 2,074 changed lines are tooltips around the same triggers and one dropped
  line (`produced_bureaucracy > X`, implied by the headroom check).

**Open rulings from the text pass:**
| # | Question |
|---|---|
| U1 | ~~31 dam projects are named "… Dam(s)" … rename them after the SITE?~~ — LEFT AS THEY ARE (user, 2026-10-21; 33 names, counted) |
| U2 | ~~Dam building names in the plural?~~ — KEPT SINGULAR (user, 2026-10-21) |
| U3 | ~~Should the craft rungs say they are crafts in their name?~~ — RULED 2026-10-21: "Era 0 craft. <Building> (<method>)" (the user); "craft" stays English in every language. To do with the text items (build.ps1 name format) |
| U4 | ~~The dam build-requirement tooltip (H3)~~ — CLOSED 2026-10-21 by in-game check 4: no requirement list renders, no change needed |
| U5 | ~~Fractional marks: round to whole levels, or leave?~~ — RULED 2026-10-21: every research mark rounded UP to whole levels, the halved ones included, BEFORE the batch (the user) — so the floored "(now N)" is always honest. To do in emit_research_events.mjs: ceil the level count, then compare people ≥ levels × per-level workforce |
| U7 | Vanilla's Krka Falls and Niagara Falls traits are left empty by the dams — RULED 2026-10-21: no state-level electricity bonus anywhere (the user: "Nothing can have a state-level electricity bonus"), so both stay empty. Found: Krka's state, Dalmatia, is the one hydro-trait state with NO dam project (the research's Yugoslav row covers only the Drina, Neretva, Drava and Vardar) — a Cetina project (~800 MW, one Mountain Power Station level) was proposed and DECLINED (user, 2026-10-21: "No Dalmatia dam site") |
| U8 | Research `_desc` = `$…_reason$` (no visible change; 336 duplicate bodies × 11 languages) — RULED 2026-10-21: yes, each `_desc` becomes a reference to its `_reason` (the user) |

## In-game checks (the user, one at a time; started 2026-10-21)

| # | What | Result |
|---|---|---|
| 1 | A research entry's body, bar label and bar tooltip (Britain 1836, Bessemer Process) | ✅ the lines render. Changed on the user's notes: no literacy line in the tooltip (the body states it); "(now 8)", rounded down, not "(now 8.0)"; the stage rule one sentence, "Each 36-month stage grants 50% of the technology’s base research cost"; the implementation counter shows no cap ("effectively 'this fires until the deed is done'") — `0986b5f` |
| 2 | The craft buildings' method groups and method names | ✅ no "off"-only groups; method names render |
| 3 | The dam survey decision, its requirements, the site trait and the survey entry | ✅ on `mod_playtest_damcheck/` (the canon + the dam technologies to Britain at the start): the decision, its requirements and the survey entry read fine. The site trait shows only its name on hover — the game does not render a description for it; the user: "I don't think it's that bad" — left as it is |
| 4 | The build-menu tooltip of a dam (U4 / H3) | ✅ the build tooltip lists no requirements at all (earnings, cost, goods, jobs, the queue keys) — the suspected per-project list never renders, and a dam shows in the build menu only once its site is surveyed, so U4 needs no change |
| 5 | The tech-tree era dividers (R7) | ✅ Vulcanization in era IV, the three minted technologies in era V; the bands line up now that the tree is vanilla's + 3 (in older, larger trees a band sometimes started a little early or late, the order always correct) — R7 needs no fix |
| 6 | The translated building, method and research names in another language | SKIPPED by the user: "If someone doesn't bother to learn English and needs improved localisation, they can make a pull request … What I do is try to not diverge from vanilla when it doesn't cost me anything." The names come from vanilla's own keys; the build checks every rung name against vanilla English |
| 7 | The company throughput modifier names | ✅ "+15% Textile Mills (Dye Workshops) building Throughput" (J. & P. Coats). The user asked why the requirement lines differ ("Building is Era 1. Textile Mills (Dye Workshops). Recipe BE 67%", "Era 2-3. Textile Mills. Recipe BE 55%/43%"): the engine writes those from is_building_type with the building's full name; the bonus line is the mod's own text. A rename to match the requirement lines was proposed and declined (the user: "The naming isn't a problem, I just want to sure the game understands what's referenced"). The user then asked whether the bonus reaches the higher rungs: it names both non-craft textile buildings, Dye Workshops (e1) and the Sewing Machines building (e2, which also runs Electric Sewing Machines, e3), so every rung but the craft gets it (crafts are out of companies by ruling, and so cannot count toward founding the company either); no line of the canon run's error.log names a company modifier, and vanilla's own `modifier_types.md` says a modifier's KEY decides what it acts on (the definition file only sets its display). ⭐ MEASURED in the canon's 1936 save (`20261019_225952` run 1): each textile mill's throughput minus economy of scale, less the same for the furniture / glass / paper mills IN THE SAME STATE (state and country modifiers cancel) — no prosperous textile company: dye workshops +0.007 (45 buildings), sewing machines +0.012 (39); a +5% company (Britain's HBC, Russia's RAC): +0.059 (5) and +0.064 (5), 7 of 10 within 0.02 of the bonus; a +10% company: +0.09 to +0.50 (16). So the engine applies the bonus to both rungs. Readings above the bonus are textile-specific extras, most likely the prestige-goods input bonus (`PRESTIGE_GOODS_INPUT_THROUGHPUT_BONUS` 0.2 × the prestige share of input value; the dye workshops of the basic-fabrics countries read about +0.2 above the bonus, their sewing-machine mills about the bonus) — a vanilla 1936 save shows the same overshoot (+10% company: +0.158 median, 41 mills) |

## Every ruling is in (2026-10-21, evening) — the work they leave

**Before the alternating batch** (it changes the game, so the batch must measure it):
1. **The reference fix** — `tools/emit_vanilla_refs.mjs` over all 60 files with the rulings of §2 and `TIER_REFERENCE_AUDIT.md` PART 2
   (F), the DLC-gate guard, the Montenegro check (ip3-gated), the two helper triggers for light industry (with and without crafts), and
   vanilla's tooling / explosives subsidies set to none.
2. **U5** — every research mark rounded up to whole levels (`emit_research_events.mjs`).
3. **READY items** — C1 (drop the no-op define), H6 (starting-technology checks without the identical vanilla file), H7 (one game-path
   resolver), C5 (stale doc lines). **B1** — a short probe or hand test of two foreign builders on one dam site.

**Any time before 1.0** (text only): U3 (craft names "Era 0 craft. …"), U8 (`_desc` references).

**For the 1.0 release build (~26–27.10):** the debug/release switch in `build.ps1` (H8), R1–R3 (version, thumbnail, licence, README with the
replaced-file list H9), R4 proofread, R5 icons (waiting on the user's images), "Recipe BE" out of the names, a final build and an error-log read.

**Deferred to 1.1 or later:** B2 (stale looms), B3 (craft secondary lines), F1 (artisanal ownership), R6 (rung building art).

## The second pass (2026-10-21, late evening): balance and research are in scope for 1.0

The user, the same evening: *"Now is likely the time to finalise everything except 1) picture assets 2) telemetry removal. Make another thorough
pass, highlight everything."* — after asking why the power-bloc and company research bonuses and the power-bloc food method had never come up.

**Why they were missed.** (1) Appendix 1's sweep filed research and balance items under §5 "not polish", and that table was never put to the user;
the research-bonus nerf (BACKLOG:129, OPEN since 2026-10-11) sat in it. (2) The power-bloc canning method was discussed in sessions of 2026-10-06/11
and left as shipped, but no doc carries it as an open decision. A second sweep with no category filter found the rest below.

**Timing.** Anything that changes script or economics must land before the alternating batch (~23.10), which is then its only measurement; a change
that reads badly there can be reverted to F247's measured setup before the release build, not replaced by another.

### Q — the open decisions, in the order they will be asked (one at a time, with context)

| # | Decision | Facts | Status |
|---|---|---|---|
| Q1 | **Flat research bonuses sized for vanilla** — how far to scale them | Philips company (prosperity) +15 innovation cap and +5% innovation; Advanced Research III principle +5 cap **per level of the schools institution**, plus +5% spread and −5% ahead-of-time penalty; the Central Africa expedition modifier +10 weekly innovation (`02_event_modifiers.txt:492`); Cuba's modernisation success +30 cap, +15% production spread and research (`cuban_modifiers.txt:86`). The mod cut innovation base, cap base and the cap's literacy term to 25 (vanilla 50 / 50 / 150) and universities to 1/6, so a literate major's cap is ~0.26–0.33 of vanilla's and a flat add weighs 3–4× as much against it; multipliers scale on their own. §10.101.1 states "flat innovation … is not scaled" as a fact, never as a ruling | ✅ **RULED 2026-10-21: ×1/3 on all four** — Philips +15 → **+5** cap, Advanced Research III +5 → **+1.5** cap per schools level, Cuba +30 → **+10** cap, the expedition +10 → **+3** innovation; the multipliers untouched (they scale on their own). Restores each bonus's vanilla share of a literate major's cap. Implementation: Philips in `emit_companies.mjs` (the file is owned already); the principle, the expedition and Cuba each in a generated whole-file copy read live from vanilla (every `has_dlc_feature` kept — the principles file has three `power_bloc_features` gates), each an ON_GAME_UPDATE coupling; before the batch |
| Q2 | **Vanilla's event research grants** | 68 `add_technology_progress` lines in 24 files, of which 65 are real grants (one is an effect-loc definition, two sit in `test_events.txt`): 3,500 ×16, 4,150 ×14, 6,000 ×13, 5,850 ×8, 2,500 ×8, 5,000 ×2, 4,000 ×2, 8,000, 6,250, 666. ⭐ Vanilla sizes them as **"an approximate third"** of the era's technology cost (`common/technology/eras/00_eras.txt`: "When changing these, don't forget to update progress bonuses in events and JEs"), and the mod left technology costs alone (§10.97 item 6). Against a country's own weekly research a grant weighs 2× (a country on the base) to ~3× (a literate major on its cap) as much as in vanilla; against total technology gained (own research + the research entries, the majors at 0.97 of vanilla, F227) about vanilla's share. ~36 of the 65 sit in files the reference fix will own anyway (production, society, trade-route, decree, IG-suppression, camera/film, military and war-crimes events); the rest in ~14 more. The reference fix (§2) revives the art chain's 4,150 / 6,000 / 5,850 grants at that weight | ✅ **RULED 2026-10-21: LEFT AS THEY ARE** — a grant is a third of a technology, as vanilla sizes it, and technology costs are unchanged; unlike Q1's bonuses it is not a weekly rate |
| Q3 | **The Food Standardization 3 canning method** | One copy, `pm_vacuum_canning_principle_3_food`, on the only non-craft food building (Sweeteners, e1, which also runs Baking Powder, e2): the same inputs as plain vacuum canning, 83.42 groceries against 71.5 (vanilla 70 against 60 — the same ×1.17); vanilla's `is_hidden_when_unavailable` and principle gate kept (the principle sits behind `power_bloc_features`). The 2026-10-11 worry that it was unselectable applied to the per-main-method copies, which no longer exist; not seen in game. The user: "this PM needs a balance decision". At base prices: value added over the inputs 964 a level for vacuum canning and 1,322 for this one (+37%; vanilla 600 → 900, +50%); the host's main methods add 450 (Sweeteners) and 1,831 (Baking Powder). ⚠ **BUG (found 2026-10-21, mine to fix before the batch):** our `pm_vacuum_canning_food` carries vanilla's `replacement_if_valid = pm_vacuum_canning_principle_3` — the VANILLA key, which our food building does not carry, so the engine's switch to the principle version (vanilla's mechanism: a holder's buildings move to it on their own) points at nothing; it should name `pm_vacuum_canning_principle_3_food`. The emitter copies the line verbatim. No error line in the four wm99 runs, which does not show that any bloc held the principle. The other `replacement_if_valid` lines in vanilla sit on untiered buildings | ✅ **RULED 2026-10-21: 85 groceries** (the user: "Round up for smoothness, go with 85 for bloc version") — in place of the scaled 83.42; inputs and jobs unchanged (+19% over plain vacuum canning's 71.5). Implementation: one recorded override in `emit_secondaries.mjs` (it asserts the method exists and the scaled value it replaces), plus the switch fix; before the batch |
| Q4 | **Ship the canon's measured balance as is, or move a book lever first** | F247 (n=4): 3 intact + 1 stall (the USA), consensus loss 8.21 (F239 6.72), world GDP 1.08 (aim 0.90–1.00), PI 0.96 not falling, pool W 1.00 at the soft line, Britain near capital abundance in 2 runs of 4. Unchosen levers: the cost ladder C 1.8 × cost1 1.2 (F234: loss 5.37 against 7.28, but measured on the x25 canon, before the engine unlift, private dams and the threshold — unmeasured on today's canon) and paper's own lift (§10.101 item 5). The user's 2026-10-15 request (session "Cost factor balancing for economy tiers"): *"Final balance passes until going to polishing. Maybe 3-5 more n=8 runs … propose other approaches to cost1, in1, C, A and B to increase obsolescence but not kill early- to mid-game markets and overall GDP trends"* — never done, never waived in writing | ✅ **RULED 2026-10-21** (the user: *"We canonise all minor balance changes we make now instantly, and thus the n=16 will be run on the current canon."*): every minor balance change ruled in this polish (Q1, Q3, …) goes into the canon at once, with no test batch of its own, and the alternating n=16 measures the canon as it then stands. Read (stated to the user): the cost ladder and paper's lift are not minor and wait for 1.1; the 2026-10-15 request for more n=8 balance batches is overtaken |
| Q5 | **Military research ~10 technologies behind vanilla; no era-5 military technology held anywhere** | Tech spread ×2 and a society research multiplier were deferred (§10.97 item 8: "let's see how it all works, first"). Players see it, and 1.0 is the last release on game 1.13. Re-counted 2026-10-21 (`tech_census.mjs`, the canon F247 n=4 against October's vanilla n=6): Britain 158.0 (56.3 / **41.0** / 60.8) against 159.5 (49.2 / **50.2** / 60.2), the USA 146.5 (49.0 / **40.0** / 57.5) against 159.3 (49.2 / **49.7** / 60.5); no country holds any of the ten era-5 military technologies in any canon run, where vanilla ends with 1–8 holders of most | ✅ **RULED 2026-10-21: LEFT FOR 1.1.** The approach the user expects to try first: *"a bit higher ai weights for military techs over societal techs over most production techs (exceptions with also higher priority on production where there are no JEs, like Shift Work)"* (BACKLOG, 1.1) |
| Q6 | **The dam consumers' recipes** | §10.89.1 deferred judgement "until tests"; the batch can show a problem but a recipe change cannot follow it into 1.0. The ruling's own signal was electricity at the 175% ceiling in the majors' markets by ~1920; on the canon (F247, n=4) it reads 25–122% at 1920 (vanilla October 73–140%) and touches 175 in one American market in one run at 1930 — the dams supply cheap power the 4× plant cost does not touch | ✅ **RULED 2026-10-21: KEPT AS THEY ARE** — the signal did not fire |
| Q7 | **Rubber (F242)** — the user's Qing playtest | The Qing's own industry wanted ~8× the world's rubber (world price at the ceiling 975 of 1,092 weeks); vanilla's 8-week no-reduction trade lock synchronises its trade centres into a 9–10-week import cycle. The canon's AI games show no such shortage (British market 104–129% of base at 1920 and 1930, F247). Checked 2026-10-21: our rubber rungs use about vanilla's rubber per unit of output (Rubber Grips 0.082 per tool against 0.091; telephones 0.30 per telephone against 0.33) — ~2× per level because a level makes ~2× as much. Our only amplifier is the trade unit (24 rubber per capacity unit against vanilla's 5, F159) | ✅ **RULED 2026-10-21: ACCEPTED for 1.0** (the user: *"I don't see any feasible approach to solving it. I'm reasonably sure vanilla has this as well. While it is problematic (as phantom imports at scale allow for nullifying input shortages penalties when they should be accumulated), I don't think we can do much or should do much."*) — a 1.1 watch item |
| Q8 | **"Era N" in building names against the game's tech eras** (Appendix 2 #7) | "Era 2" electrics are unlocked by a tech-era-4 technology; R1 already drops "Recipe BE" | RULING |
| Q9 | **`supported_game_version`** | 1.13.11 today; "1.13.*" keeps a hotfix from marking the mod outdated | RULING |
| Q10 | **The three minted top rungs are almost never reached** (F227: catalytic synthesis in 1 run) | R5 asks the user to draw their icons | RULING (keep the icon work, or simplify) |
| Q11 | **Accept as watch items for 1.0** | AI schooling unmeasured beyond a smoke probe (F226); crafts as a channel into early revolutions (BACKLOG:88); the percussion-cap chain (BACKLOG:96); the monopoly threshold's decade-scale effect cannot be separated from private dams (F247) | RULING (one answer for the group) |

### Mine, no ruling needed

- **The canning switch (Q3's bug):** `emit_secondaries.mjs` must re-point a copied `replacement_if_valid` at our copy of the target. Before the batch.
- **A load with no DLC enabled** and an `error.log` read — the only proof of the DLC rule (§2) beyond the file comparison; never done. Before the batch.
- **Stale lines that read as open questions:** CLAUDE.md's canon "known open items" (still F227's runoff seed, not F247's stall); ON_GAME_UPDATE:578 (says the
  canon lacks the urban-centre override it has carried since 2026-09-20); BACKLOG 1b (still names a 36–48-month stage length; the user ruled 48 out, F237);
  BACKLOG E:157 (the audit does cover renamed secondaries); BACKLOG lines already settled (textile host, crafts + merges, craft cost ÷50, FDI, survey
  concurrency, tick overhead and others).
- **Unmeasured, harmless direction:** the cause of vanilla's October ×1.08 drift (telemetry tags, summary version or machine) is not separated, so the
  release build (no telemetry, H8) is a build no run has timed.

## Suggested order

1. **Before the batch (21–23.10):** the rulings R2.1–R2.4, then item 2's generator; H2, H5, C1; R8, H4; the in-game look (item 1's tooltips,
   R7, H3, B1); any ruling on B2/B3/N1/H8 that changes the build.
2. **The alternating batch** (measures the 1.0 build).
3. **After the batch (27–29.10), text/art/metadata only:** R1–R5, H1, H6, H7, H9, C5, R6 (cheap variant); a final build, every lint, and an
   error.log read after an in-game load.

---

# Appendix 1 — the sweep of items deferred to polishing (subagent report, 2026-10-21, read-only; numbering R/B/F/C/N as above)


Swept on 2026-10-21. The sweep was read-only: nothing in the repo was edited or built.

**Sources read:** BACKLOG.md (all sections), ROADMAP.md (steps 1, 2-audit, 5, 6, 6½, 7, 8, DEFERRED FIXES, Parked), HANDOVER.md,
BALANCE_FRAMEWORK.md, FINDINGS.md, BUGS_AND_FIXES.md, TESTBED_LANDMINES.md, MODDING_NOTES.md, ON_GAME_UPDATE.md, README.md,
the CLAUDE.md greps, both MISSING_* docs, the `tools/**` greps, and the memory notes (release timeline, playtest defect list).

**Also checked against the build:**
- `mod/` as deployed 2026-10-21 10:36.
- The canon config: 17 industries, 56 rungs on 50 buildings, 6 crafts, 6 merged methods, dams `resource4` with `private = all`.
- The `error.log` of `20261019_225952_wm99-n4`:
  - It contains no `zzz_pm_rehaul` lines.
  - It contains no missing-loc lines of ours.
  - It contains no BOM complaints.
  - The only mod-caused class is `is_production_method_active` on renamed methods. That class is the engine-compatibility pass, which is handled elsewhere.

**The window:** polish runs 21–23.10, then the ~100-hour alternating batch runs ~23–27.10, and mod 1.0 releases on **30.10** (HANDOVER).

⚠ **Timing rule that drives the priorities.** `run_schedule.ps1` rebuilds the mod before every run. This includes text, because the loc is emitted by `build.ps1` and the emitters. So any change to `tools/*` or the config must land **before** the alternating batch starts, or wait until it ends (~27.10). Editing during the batch breaks landmine L10.

Changes that move script or economics (the engine-compatibility pass, any craft or loom ruling) must land **before** the batch, so that the batch measures the 1.0 build. Changes limited to text, icons and metadata can safely follow the batch on 27–29.10.

Effort: **S** = under ~2 h · **M** = half a day to a day · **L** = several days.
Priority:
- **P1:** must happen for 1.0.
- **P2:** should happen if time allows.
- **P3:** nice-to-have, or blocked on a ruling.
- **—:** not for 1.0.

---

### 1. Polish items in scope (22)

#### Release packaging and docs

| # | Item | Source(s) | Cat. | Player-visible | Status (checked) | Effort | Prio |
|---|---|---|---|---|---|---|---|
| R1 | **Release metadata.** Set `version` from `0.1.0` to `1.0.0`. Make a release build that does NOT append `(built yyyy-MM-dd HH:mm)` to the mod name. Refresh `short_description`, which says nothing of the crafts, merges, dams or the monopoly threshold. Confirm `supported_game_version` is `1.13.11`. | `mod/.metadata/metadata.json`; `tools/build.ps1:1724-1725`; ROADMAP:1391 / BACKLOG:244 ("Release") | docs | yes (launcher, mod listing) | OPEN. Not recorded anywhere as a separate item; it is implied by "Release". | S | **P1** |
| R2 | **No `thumbnail.png` in the mod root.** A Paradox Mods or Steam listing needs one. There is also no LICENSE in the repo. | `mod/` listing | UI | yes | OPEN. Not recorded anywhere. | S | **P1** |
| R3 | **README.md is stale.** It says "22 industries / 67 tier buildings" and that power, ports and railways are tiered; all three are vanilla now. Its "The canon (2026-09-05)" section names `canon4v-hai3`. The canon is `jex-dam4s-rs-x25-m10ac-dpriv-wm99`: 17 industries, 56 rungs on 50 buildings, 6 crafts, 6 merged methods, dams, monopoly threshold 0.99. | README.md:13-17, 97-103 | docs | yes (GitHub visitors) | OPEN | S | **P1** |
| R4 | **Proofread every new technology name and description.** Only 3 minted technologies remain: `spray_finishing`, `continuous_web_processing` and `catalytic_synthesis`. Recommended widening, because nothing else proofreads them, to the other generated player-facing strings: <br>• the 50 building names; <br>• the dam strings (2,110 templated lines); <br>• the craft group name; <br>• the secondary-copy names; <br>• the company-modifier lines. | ROADMAP:1391; BACKLOG:243 | text/loc | yes | OPEN. The 3 descriptions read fine at a glance. | S (techs); M (widened) | **P1** |
| R5 | **Per-technology icons.** All 3 minted technologies share one placeholder, `gfx/interface/icons/invention_icons/zzz_pm_rehaul_placeholder.dds`. A fitting vanilla invention icon per technology is the cheap fix. | BACKLOG:241; `mod/common/technology/technologies/zzz_pm_rehaul_techs.txt:7,26,45` | UI | yes (tech tree) | OPEN | S | **P1** |
| R6 | **Per-tier building artwork,** "so a player reads the tier from the picture instead of a wall of text". Today: <br>• every rung of an industry shows the vanilla building icon; <br>• all four dam types use `power_plant.dds`. <br>New art is L. The cheap variant is a distinct existing icon per rung, for example the main production method's icon, plus a non-power-plant icon for dams. | ROADMAP:1389; BACKLOG:241; `mod/common/buildings/01_industry.txt` (e.g. :68), `zzz_pm_rehaul_dams.txt:5` | UI | yes | OPEN | L (new art) / S–M (reuse) | **P2** |
| R7 | **Era band dividers in the tech-tree GUI.** The dividers are hard-coded in vanilla's `gui/tech_tree.gui:517-533` (`extra_lines` at y −100 / 2200 / 4060). The original worry was a much taller tree. The canon tree is vanilla's plus 3 minted era-5 production technologies, with vulcanization moved from era 3 to 4. So the mismatch may now be negligible: **verify in game first.** A real fix means owning a whole vanilla GUI file, which is a new coupling for game 1.15. | ROADMAP:45-47, 1390; BACKLOG:242 | UI | yes | OPEN, possibly moot | S (look) / M (fix) | **P2** (verify), P3 (fix) |
| R8 | **Dam texts predate private dam construction (§10.89.14, canon since 2026-10-16).** Two lines: <br>• The survey journal entry says *"we may build the dams, in our own state or in a subject's"*. <br>• The decision says *"Builders share its levels, each owning what it builds"*. <br>Private investors now build dams, and financial districts own them (F240). | `mod/localization/english/replace/zzz_pm_rehaul_dams_l_english.yml` (`je_pmr_dam_*_survey_reason`, `*_survey_decision_desc`); emitted by `tools/emit_dams.mjs` | text/loc | yes | Found during this sweep (not recorded anywhere); verify against the rules | S | **P2** |

#### Bugs to verify or fix

| # | Item | Source(s) | Cat. | Player-visible | Status | Effort | Prio |
|---|---|---|---|---|---|---|---|
| B1 | **Dam level cap with several foreign builders on one site:** is the cap counted on the region total, as intended, or per builder? Owner and single foreign builder were verified by hand on 2026-10-05; two foreign builders together were not. The tool is the contest probe (`dams.probe.contest`, where `probe_q` above the cap means a leak) or a hand test. | BUGS_AND_FIXES:185-187; BACKLOG:144 | bug fix | yes (possible overbuild) | OPEN, unverified | S | **P2** |
| B2 | **Mandated looms are not enforced on the merged textile building.** The engine does not re-check an already-selected method after a main-method switch. In 1913–1926, 1–2 levels per game keep the cheaper Mechanized Looms copy beside Electric Sewing Machines. Options: fold each loom into its main method, or accept it. | BACKLOG:57; BALANCE_FRAMEWORK §10.93 rule 5 | bug fix | yes, minor | **RULING** | M | P3 (and only before the batch) |
| B3 | **The crafts carry no secondary line.** Under "one name, one recipe" anchored on e2, a 500-worker craft level makes too little for any industry-wide line. So there is no canning, no stills, no Craftsman Sewing, no luxury furniture and no ceramics on any craft, and most of the 1836 textile and furniture is crafts. A separately NAMED craft variant would satisfy the rule; this is unruled. | BACKLOG:61; BALANCE_FRAMEWORK:9254-9258 | feature/balance | yes (early luxury supply) | **RULING** | M | P3 (only before the batch) |

#### Features deferred to the "last feature pass" or to "polish"

| # | Item | Source(s) | Cat. | Player-visible | Status | Effort | Prio |
|---|---|---|---|---|---|---|---|
| F1 | **ARTISANAL OWNERSHIP:** shopkeepers as owners, so dividends go to the artisans' class. The user placed it as *"the last feature pass between final balance check and final polishing"*. It is conditional on the crafts being canonised, and **they were (2026-10-12)**, so the condition is met. It is not researched: which ownership groups a building may carry, how dividends reach a pop type, and the effect on the pool are all unknown. Under the release memory ("new features out of scope for 1.0 unless the user asks"), **recommend asking for an explicit defer to post-1.0.** | ROADMAP:1368-1380; BACKLOG:85 | feature | yes | DEFERRED, now technically live | L | — (needs a ruling) |
| F2 | **Craft extras:** a Muskets craft; spreading the 1836 craft levels over the largest states; trimming automation that duplicates a main-method upgrade. | ROADMAP:2399; BACKLOG:84 | feature | yes | DEFERRED | M | — |
| F3 | **Company mandates (ROADMAP step 5, a "polish before release" step).** The first cut shipped 2026-08-23 and has never been measured: the company-held rung mix. Step 5a item (2), `analyse_ai_tier_choice --exclude-company-owned`, is still open. The alternating batch is the natural measurement (`company_check.mjs`). | ROADMAP:1213-1330; BACKLOG:142 | feature | yes | OPEN (measure) | S (read the batch) | P2 (after the batch) |

#### Cleanup: developer-facing and docs

| # | Item | Source(s) | Cat. | Player-visible | Status | Effort | Prio |
|---|---|---|---|---|---|---|---|
| C1 | **The ahead-of-time define is a no-op.** `01_pm_rehaul_defines.txt` emits `TECH_AHEAD_OF_TIME_PENALTY_FACTOR = 0.25`, which is vanilla's value, with the comment "the tree is deeper", which is false. Either drop the line or fix the comment. | CLAUDE.md:4309, 4654 (also flagged on the Mod-changes page); `mod/common/defines/01_pm_rehaul_defines.txt` | tooling | no | OPEN | S | P3 |
| C2 | **The UI's "Mod changes" page is stale.** <br>• The prose still says "BE target"; the game says "Recipe BE". <br>• It never mentions crafts, dams, the monopoly define, the finish boost, the research levers or AI schooling. <br>• Only merges get one mention. | `ui/builder.html` `renderModChanges` (:1574-1716) | UI (dev) | no (GitHub/editor users) | OPEN | M | P3 |
| C3 | **The tech-tree page shows the six-rung candidate trees.** `ui/techdata.js` was generated 2026-08-12. | BACKLOG:163; CLAUDE.md:1700 | UI (dev) | no | OPEN | M | P3 |
| C4 | **`builder.html` carries a ~260-line fork of `econ.js`.** Until it is removed, a change must be made in both copies or in neither. | BACKLOG:162; CLAUDE.md:4258 | tooling | no | OPEN | M | — |
| C5 | **Stale "open" lines to close (doc hygiene).** Ideally done in the README pass: <br>• ROADMAP DEFERRED FIXES lists the BOM warning as open. It was **fixed 2026-09-25** (BUGS_AND_FIXES:322), and all emitted files start with `EF BB BF`. <br>• BACKLOG:123, "a validator for technology re-pegs": **done** as `tools/lint_tech_content.mjs`, 2026-08-30. <br>• BACKLOG:124, the `emit_techs.mjs` grant-side blind spot: **fixed 2026-08-31** (`emit_techs.mjs:451` reads aliases). <br>• BACKLOG:170, "a vanilla batch with the yearly order-book feed": **exists**, since October vanilla n=6 (20261020_*) carries the `wide_dates`; only the red-flag twin needs re-pointing. <br>• BACKLOG:223, wiring the fleet-loop disqualification into row P: superseded by `wall_clusters.mjs` in `fill_ledger.sh` (2026-10-08). <br>• ROADMAP:91, "deleting vanilla techs deferred to final polish": **moot**, since the vanilla-ladder rebuild makes the tree vanilla's. <br>• ROADMAP:1100-1212 lists three items, now fixed or moot: <br>&nbsp;&nbsp;– "30% of the start on the wrong tier" is fixed (L13); <br>&nbsp;&nbsp;– "the AI subsidises only the obsolete infrastructure tier" is moot, because infrastructure is vanilla in the canon; <br>&nbsp;&nbsp;– "drop steel's era-1 rung" is moot. <br>• BUGS_AND_FIXES 2026-10-11: the vacuum-canning principle-3 caveat is moot under the `top` rule (the copy has no main-method gate). | as listed | docs | no | Verified done or moot | S | P2 |
| C6 | **BACKLOG:122, "era 5 fell 20 → 14 technologies after the merges".** This is from the six-rung tree; the canon tree is vanilla's era 5 plus 3. Likely moot; verify and close. | BACKLOG:122; ROADMAP:105 | docs | no | likely moot | S | P3 |

#### Found during this sweep (not recorded as deferred anywhere)

| # | Item | Source(s) | Cat. | Player-visible | Effort | Prio |
|---|---|---|---|---|---|---|
| N1 | **"Recipe BE N%" travels with the building name everywhere the name is referenced.** For example, a company prosperity modifier reads *"Era 2. Arms Industries (Bolt Action Rifles). Recipe BE 55% building Throughput"*. The label itself was ruled on 2026-09-18 (P3), but whether references should use a short name is a ruling. | `mod/localization/english/replace/zzz_pm_rehaul_companies_l_english.yml` | text/loc | yes | S–M | P3 (ruling) |
| N2 | **Ten non-English languages ship English stubs.** This is by design (MODDING_NOTES:64) and is not deferred anywhere; at most, mention it in the release notes. | MODDING_NOTES:61-71 | text/loc | yes | L | — |

**Counts by category (22):**

| Category | Count | Items |
|---|---|---|
| UI | 6 | R2, R5, R6, R7, C2, C3 |
| docs | 4 | R1, R3, C5, C6 |
| text/tooltip/loc | 4 | R4, R8, N1, N2 |
| feature | 4 | B3, F1, F2, F3 |
| bug fix | 2 | B1, B2 |
| tooling | 2 | C1, C4 |
| balance | 0 | balance arcs are out of scope; see §5 |

**15 are player-visible:** R1–R8, B1–B3, F1–F3 and N1.

---

### 2. Suggested order for the 9-day window

1. **21–23.10, before the batch:**
   - The two items handled elsewhere: the engine-compatibility pass and the research-JE texts.
   - **R8** (dam texts).
   - **B1** (verify; it is a probe or hand test, not a build change).
   - Any **ruling** the user wants on B2, B3 or N1 (each changes the build, so it lands before the batch or not at all).
   - **R4** proofreading and **R5** icons, if done here, so the batch measures the final build.
   - **R7** eyeball.
   - Ask the user to rule on **F1** (defer).
2. **Launch the alternating batch** (§3).
3. **27–29.10, after the batch, text/art/metadata only:**
   - **R1**, **R2**, **R3**, **C5**.
   - **R6**, cheap variant.
   - Anything from R4/R5 not done earlier.
   - These move no economics, so the batch stays valid for the release build.
   - Then a final `build.ps1` (every lint) and an `error.log` check after an in-game load.

---

### 3. Scheduled "after the first round of polish" (not polishing)

- **A1. The ALTERNATING batch.** Schedule `tools/testbed/schedules/alt_vanilla_canon_n16.json`: 32 × 1836→1936, ~100 h. It is prepared but NOT launched (BACKLOG:29-31, HANDOVER:24-38). Its launch checklist:
  - Copy the post-polish canon to a NAMED book plus its twin (L20) and point `setups.canon.config` at it.
  - Write the sha256 into `_arms`, then dry-run build.
  - Get the user's go-ahead on "32 × 1836→1936, ~100 h".
  - Launch through `launch_detached.ps1`, called DIRECTLY from the PowerShell tool.
  - Smoke-check run 1 (vanilla) and run 2 (canon), then arm `wait_for_session.ps1`.
- **A2. Reboot risk over ~4 days.** No resume-after-reboot mode exists (L30 "other class stays open", TESTBED_LANDMINES:1707-1710; BACKLOG:189). A user action is needed: pause Windows Update for the batch window, or accept the risk.
- **A3. `fill_research.mjs` reads the retired six-rung tree,** `config/tech_tree_options.canon_n7.json`, and the old vanilla n=4 (`20260813_083557`) for every book (BACKLOG:173; `tools/testbed/ledger/fill_research.mjs:18-21`). The batch ledger's technologies-by-era table will be wrong. Fix it before reading the batch: S–M.
- **A4. `fill_consts.mjs`'s "productive workers" defect,** held because fixing it restates a shipped number (BACKLOG:166). Label it in the batch report.
- **A5. After the batch,** set `lib_runs.VANILLA_WALL_REF` to this batch's vanilla, add its 16 runs to `VANILLA_REF`, and write a FINDINGS entry (HANDOVER:36-38).
- **A6. Questions the batch answers with no extra runs:**
  - The canon's century including private dams (BACKLOG:19, :148).
  - The deferred judgement on dam consumers' recipes, "until tests" (§10.89.1, ROADMAP:1361).
  - Company mandates' first cut (F3).
  - The urban-centre electricity override's effect (BACKLOG:115).
  - The red-flag vanilla twin on the order books.
- **A7. Any harness change** must land before the batch or wait for it to end (HANDOVER:20). An example is `deviates_from_vanilla` walking the built mod instead of probing 6 paths (BACKLOG:167; `run_observer.ps1:598-600`).

---

### 4. Deferred to mod 1.1 (game 1.15.N, ~16.11)

- **Treaty ports.** All five layers (A eligibility, B desire, C pursuit, D the trade-centre gate in script, E readers) are built and probed; none is in the canon.
  - The open questions on 1.15: does the AI pursue recognised hosts by itself? Does the "never-added" rule hold (`skip_build_list` is untested)? Why do ports in recognised markets build no trade capacity?
  - Sources: BALANCE_FRAMEWORK §10.103 (:10119-10214); FINDINGS F243–F246; BACKLOG D:136-141; ON_GAME_UPDATE:76-77, 158-177.
- **The ON_GAME_UPDATE pass for 1.15.N.** It includes the hand re-test that a FOREIGN dam builder still gets the `has_max_level` cap (ON_GAME_UPDATE:150-153) and the 1836 starting-technology check (L14/L15).
- **Anything that depends on AI behaviour** waits for the 1.15 AI rework (memory `release-timeline-1-0-and-1-1.md`).

---

### 5. Out of scope here

#### Handled elsewhere

**(1) The research journal entries' descriptions and progress-bar tooltips** (`tools/emit_research_events.mjs`). This covers:
- the P4 residual, "JE tooltips should read in people, not levels" (BACKLOG:164; ROADMAP P4);
- the `_reason` loc and bar-text rules (BUGS_AND_FIXES 2026-09-25, 2026-09-30).

**(2) Vanilla script references to tiered buildings and production methods.** This covers:
- MISSING_PM_REFERENCES.md: ~28 events/JEs checking a relocated main method.
- The secondary-copy rename class: `production_tech_events.210` (radio progress, ROADMAP:592-593), and the `is_production_method_active` errors seen in the wm99 `error.log` (44 lines in run 2). The methods named in those errors:
  - `pm_watertube_boiler_building_*`, `pm_rotary_valve_engine_building_*`, `pm_assembly_lines_building_*`;
  - `pm_pot_stills`, `pm_patent_stills`;
  - `pm_mechanized_looms`, `pm_automatic_power_looms`, `pm_traditional_looms`;
  - `pm_traditional_art`, `pm_mechanized_workshops`.
- Vanilla `events/pm_events.txt` industrialization checks (234 script-error locations in run 1).
- The `has_building` narrowing: 457 refs, which now hit the vanilla-keyed rung only. That rung is the CRAFT for six industries. The narrowing also covers company mandates and monopolies latching onto tier 1 (ROADMAP:1238-1241).
- MISSING_BUILDING_CONDITIONS.md: the art academy's conditional `ai_value` (Metternich +500).
- BUGS_AND_FIXES 2026-07-18, the "known limitation".
- The "AI subsidises only the obsolete infrastructure tier" issue belongs to the same class but is moot, since infrastructure is vanilla in the canon.

#### Balance and research (not polish; listed so they are not mistaken for polish)

⚠ **Brought into scope for 1.0 on 2026-10-21 (late evening)** — the Research, Book levers, Prices and Rubber rows are questions Q1–Q7 of "The second
pass" above. This table was the reason they had never been asked.

| Group | Items | Sources |
|---|---|---|
| Playtest defect list | P1 money-printer rungs; P6 / F137 the 1836 supply anchor; P8 e3 build time; P9 "prioritise, not complete" the tree | ROADMAP step 8 |
| Prices and the old rung | The flat price path (F94); the consumer-chain old rung; the hoard; the runoff tail | — |
| Research | Military research ~10 behind vanilla; tech spread ×2 and the society multiplier (deferred); nerfing the Philips and Advanced Research III innovation-cap adds | BACKLOG:129 |
| Book levers | Paper's own lift; research stage length; the cost ladder (F234/F235) | — |
| Textile | Textile's old rung and host cost | BACKLOG:57-59 |
| Countries | The USA (F211) | — |
| Watch items | Rubber (F242); the German oil economy (F215); the steam motor rung's desire (F214) | — |
| Rulings | The SWING red-flag threshold; the register and loss rulings; the `wage_pct` rebase; the goal-table row set | — |
| Generator work | The graded era-0 penalty (never run over a century); `--out-ladder` | — |
| Crafts | Crafts on the 20% profit pause line | BACKLOG:80 |

#### Tooling debts (BACKLOG F/G — "paid when an item above needs them"; not polish)

- `health_vs_ref` token guard.
- `--craft-table` override.
- Teaching the old-rung readers the merged methods.
- `hiring_census`'s dead-define label (`BUILDING_MAX_PROFIT_TO_PAUSE_HIRES`).
- The binary save reader is trusted only below 104 MB.
- L37: the stop watcher on multi-setup schedules.
- Detectors owed: L19, L23, L11, L9.
- Live proofs owed: quarantined-save resume hooks, L29, L34.
- Copying the jex n=16 report into its session folder (BACKLOG:174).
- A post-run validator, "a technology gating a tier held by zero countries" (BUGS_AND_FIXES:2198-2200).
- Readers still on the summer n=16 (HANDOVER:47).

---

# Appendix 2 — the independent pre-release hunt (subagent report, 2026-10-21, read-only; its numbering differs from H1–H9 above)


Read-only audit of the generated canon mod (`mod/`, built 2026-10-21 10:36, the same files as the deployed copy in Documents) and of the
canon's latest game runs. Nothing was edited, built or launched.

**Out of scope, as briefed.** Overlap is noted in one line where a finding touches it: the research journal entries and their tooltips,
vanilla references to tiered buildings or their production methods, and items already deferred in BACKLOG/ROADMAP.

Severity scale: **P** player-visible breakage / **C** confusing / **K** cosmetic / **I** internal.

---

### Summary, most important first

| # | Finding | Sev. | Sure? | Effort |
|---|---|---|---|---|
| 1 | README is stale and wrong for a player (scope, canon name, install needs Node.js, no "new game only", no compatibility list, no explanation of the building names) | C (blocks a smooth install) | high | 1–2 h |
| 2 | Vanilla throughput modifiers keyed on a building type now reach **only rung 0**: power-bloc principle *Military Industry* 1–3, the production-tech event rewards, art-academy rewards (61 lines in 20 vanilla files; not catalogued anywhere) | P (gameplay) | high | 2–4 h |
| 3 | Non-English players see English building and main-method names, even where vanilla has translations. Rung 0 also **replaces** vanilla's translated name and its "Expand …" lens text | K/C (11 languages) | high | 1–3 h |
| 4 | Craft rungs carry five secondary groups that offer nothing but "off". This breaches §10.93's "no off-only groups"; the cause is the `top` path in `emit_secondaries.mjs` | K | high | 30–60 min |
| 5 | Dam build tooltips: `can_build_government`/`_private` is one OR over every project of the class (10/13/38/61 branches). If a requirement fails, the tooltip will probably list every branch | C | medium (GUI not exercised) | 30 min + a look in game |
| 6 | Release metadata: version `0.1.0`, a build timestamp in the mod name, an outdated short description, no Workshop thumbnail, an exact game-version pin; no LICENSE or CHANGELOG | K/C | high | 30 min |
| 7 | "Era N" in building names clashes with the game's own tech eras (e.g. "Era 2. Electrics Industries" is unlocked by an era-4 technology). "Recipe BE" is explained nowhere a player can see | C | high (the labels are a user ruling, so this is for the user to weigh) | README: 10 min; renaming needs a ruling |
| 8 | Dam decisions and texts expose internals: a script-value comparison with no loc key, a raw variable name in an OR, and journal text that understates who may build | K | medium | 30 min |
| 9 | Building from source: 8 emitters, `tech_tree_spec.mjs` and `preflight.ps1` hard-code the Steam path (README promises `VIC3_GAME`); deploy ignores OneDrive-redirected Documents | C (builders only) | high | 20–30 min |
| 10 | `00_starting_inventions.txt` ships byte-identical to vanilla (the mod owns a vanilla file it does not change) | I/compat | high | 20 min |
| 11 | ~3,700 lines of dead dam-driver script ship. `pmr_dam_driver` is registered on no on_action under `dams.rules = family` | I | high | 15 min |
| 12 | No-op define `TECH_AHEAD_OF_TIME_PENALTY_FACTOR = 0.25` (vanilla's own value) with the comment "the tree is deeper" | K/I | high | 5 min |
| 13 | ~12k `debug_log` lines a century in a release build (5.6k dams, 6.3k research). Harmless | I | high | optional |
| — | ✅ **Error-log scan: no error from mod files** in 6 canon-family century runs (details and caveat below) | — | high | — |

---

### 1. README.md is stale and partly wrong for a player (C)

Evidence (`README.md`):
- **L12–16, scope.** It says "22 industries / 67 tier buildings … power plants, ports, railways … tiered". The canon has **17 industries and 56
  rungs**: 50 buildings, 6 merged into method switches, 6 of them craft rungs. Port, railway and power are vanilla. It does not mention the
  crafts, the merged buildings, the 122 dam projects (decisions, journal entries, 4 dam buildings), the research journal entries, the
  innovation changes (base/cap 50→25, universities ×1/6), the 4× power-plant cost, the per-good trade weights or the monopoly threshold.
- **L97–103, "The canon (2026-09-05)".** It names `canon4v-hai3` and offers the six-rung book via `-Config`. The canon is
  `jex-dam4s-rs-x25-m10ac-dpriv-wm99`, and the six-rung book was retired for good on 2026-09-16.
- **L18–35, install.** The only route offered is "run `tools\build.ps1`". That build calls about 17 `node` scripts (`build.ps1:469,
  1452–1627, 1660–1701`), but **Node.js is not listed in Requirements**. Without it the build throws ("emit_techs.mjs failed"). Meanwhile `mod/`
  is git-tracked and current, so the simplest player install (copy `mod/` to `Documents\…\mod\pm_tech_rehaul`) is not mentioned.
- **Missing entirely:**
  - **new game only.** The 1836 history is replaced, and dam site traits plus research placement run on `on_game_started_after_lobby`.
  - **do not remove the mod mid-campaign.** Tier building types disappear.
  - **compatibility.** The mod whole-file-replaces **83 vanilla files** (list in §13 below), and `replace_paths` covers `common/history/buildings`.
  - **how to read the building names** "Era N. … Recipe BE X%".
- L59 (editor presets: "France / UK / Russia / Qing … five solved era scenarios") and L92 (`config/start_exceptions.json` as the start-override
  file) describe the six-rung machinery. The canon uses `start_exceptions.vanilla.json`, which is empty.
- L22: the `VIC3_GAME` promise is broken; see §9.

Fix: split the README into "Play" (install a prebuilt `mod/`, new game only, compatibility, how to read names, what the mod adds) and "Develop"
(build needs Node.js and optionally Git Bash; the editor). Effort 1–2 h.

### 2. Vanilla building-keyed throughput modifiers now reach only rung 0 (P, high)

A modifier like `building_arms_industry_throughput_add` targets one building **type**. After the split, each rung above 0 is its own type
(`building_arms_industry_rifles`, …), so these vanilla bonuses land only on the rung that kept the vanilla key, which is usually the obsolete one
or a craft. `emit_companies.mjs` already expands company prosperity lines per tier. Nothing does this for the rest. **Not catalogued** in
MISSING_PM_REFERENCES.md, MISSING_BUILDING_CONDITIONS.md or BACKLOG (grep finds nothing). Overlaps brief item 2 (vanilla references), but
this is a different mechanism: modifier names, not `has_building`/PM triggers.

Census (vanilla `common/` + `events/`, outside company_types): **61 lines in 20 files**.
- `common/power_bloc_principles/00_power_bloc_principles.txt:902–904, 947–949, 967–969`. **Military Industry 1/2/3** give members +10%
  automotive, arms and artillery throughput. Only *Automobile Production*, *Muskets* and *Cannons* benefit, so a player's modern arms
  factories get nothing from a principle they chose.
- `common/static_modifiers/02_event_modifiers.txt:1515–1563`, the production-tech event rewards:
  - `plastic_production_modifier` +33% glassworks lands on the **Forest Glass craft**;
  - `dynamite_production_modifier` lands on Leblanc explosives;
  - `munitions_production_modifier`, `motor_industry_production_modifier`, `engine_production_modifier` and `electrics_building_modifier`
    land on the first rung only.
  
  Also 02_event_modifiers 512 (food −50%), 1254, 1720–1721, 1746, 1757.
- ~22 art-academy lines (ip3/ip4/104/105/agitators_4/brazil_2/ep2 modifiers, `amendments/00_amendments_enactment_04.txt:688`). Also
  content_1/2/3/4, montenegrin, japan_single_fire, agitators_4_revolution and brazil_2 (arms, artillery, paper, steel, munition, motor,
  textile).

Fix: give every higher rung's key a declared `building_<key>_throughput_add` modifier type. Today 27 are declared, for the keys companies use;
33 rung keys exist. Then emit a sibling line per rung beside each vanilla line, either in whole-file copies of the ~12 static-modifier files
plus the principles file, or by a builder pass like `emit_companies`. Add a lint that fails when a vanilla `building_<tiered>_*_add`
survives unexpanded. Effort 2–4 h. Cost: more owned vanilla files.

### 3. English names for non-English players, even where vanilla translates (K/C, high)

- Rung-0 keys **replace** vanilla's own translated strings. Measured on German: 34 mod keys override a key vanilla German translates, that is
  17 building names and 17 `_lens_option`s. Example: `building_food_industry` vanilla DE "Lebensmittelfabriken" becomes "Era 0. Food
  Industries (Bakeries). Recipe BE 65%", and the lens option "…erweitern" becomes "Expand …".
- All 56 `pm_main_*` names are hard English (`mod/localization/*/replace/zzz_pm_rehaul_l_*.yml`), although 53 of them are vanilla methods
  with translated vanilla keys (`pm_bakery` = "Bäckereien").
- The other generated loc already does this right. The company modifiers and the secondary copies reference vanilla keys (`$pmg_canning$`)
  or carry each language's own line. So only `build.ps1`'s name emitter is the outlier.
- Not a defect: dams, research entries and the 3 minted technologies are new content with English stubs, by design. The crafts group
  "Crafts" is the same case.

Fix:
- method names → `"$<vanilla_pm>$"`;
- emit no `_lens_option` for keys vanilla already localizes;
- compose building names per language from `game/localization/<lang>/buildings_l_<lang>.yml` and `production_methods_l_<lang>.yml`, read at
  build time. Rung 0 cannot self-reference, so inline the text.

"Era" and "Recipe BE" can stay English or take an 11-language word table. Effort 1–3 h.

### 4. Craft rungs show five secondary groups that offer only "off" (K, high)

`node` check over `mod/common/buildings` × production method groups (single-member secondary groups):

| building | group | its only member |
|---|---|---|
| building_food_industry (craft) | pmg_canning_food_industry | pm_disabled_canning |
| building_food_industry (craft) | pmg_distillery_food_industry | pm_disabled_distillery |
| building_textile_mill (craft) | pmg_luxury_building_textile_mill_textile_mill | pm_no_luxury_clothes |
| building_furniture_manufactory (craft) | pmg_luxury_building_furniture_manufactory_furniture_manufactory | pm_no_luxuries |
| building_glassworks (craft) | pmg_luxury_building_glassworks_glassworks | pm_disabled_ceramics |

The sixth single-member group is the mandated Assembly Lines on Mass Production, which is intended.

BALANCE_FRAMEWORK §10.93 (L9619) and CLAUDE.md say a group left with nothing but "off" is dropped. `tools/emit_secondaries.mjs:394` does
that only on the compatibility-copy path. The `top` (rescaled) path, L435–588, mints the group even when every rescaled member was stripped
(the build log lists `pm_cannery`/`pm_pot_stills`/`pm_craftsman_sewing`/`pm_luxury_furniture`/`pm_ceramics` as "forbidden" beside the
crafts). `lint_pm_combos.mjs` check 6 does not catch it, because an off method counts as "something to run".

Fix: after the member loop, `if (newMembers.every(isOffMethod))` drop the group and STRIP its methods (the craft history strip already
exists). Optionally add a lint check for off-only groups on tier buildings. Effort 30–60 min plus a build.

### 5. Dam build-requirement tooltips are likely enormous (C, medium)

Each dam class is one building type whose `can_build_government` / `can_build_private` (`mod/common/buildings/zzz_pm_rehaul_dams.txt:82,
464, 1191, 2965, 4829, 5124, 5649, 6756`) is a single `OR` with one `AND` per project. Each `AND` is `state_region = s:X` plus 3 custom
tooltips. Branches per class: large_cheap 10, large_dear 13, small_cheap 38, small_dear 61.

When a builder fails a requirement (technology, survey, rights), Jomini normally renders an OR as "at least one of:" followed by every branch.
**Not verified in game.** Headless observer runs never render it. The 2026-10-10 hand test (`mod_playtest_dam4s_damtest/`) queued a dam that
passed, so the failing tooltip may never have been seen.

Fix: emit `trigger_if = { limit = { state_region = s:X } … } trigger_else_if = …` chains in `emit_dams.mjs`. Only the matching branch is then
shown. Effort ~30 min, plus 2 minutes in game hovering a dam you cannot build.

### 6. Release metadata (K/C, high)

`mod/.metadata/metadata.json`:
- `"version": "0.1.0"` should be 1.0.0 for the release.
- `"name"` carries "(built 2026-10-21 10:36)", stamped by every build. Fine for the testbed, odd on a Workshop page.
- `short_description` reads "Removes main-PM diversity … splits each tier into its own tech-gated building type". Six buildings now have two
  main methods, and it says nothing about crafts, dams or the research entries.
- `"supported_game_version": "1.13.11"`. Consider "1.13.*" so a hotfix does not mark the mod outdated. This is a judgement call.
- No `thumbnail.png` for a Workshop upload.
- The repo has no LICENSE or CHANGELOG.

Also a stray root file: `gdp_gap_series.tsv` is tracked.

### 7. "Era N" collides with the game's tech eras; "Recipe BE" is unexplained (C)

The building names use the mod's narrative era (0–3) while the tech screen groups technologies into the game's five eras:
- "Era 2. Electrics Industries" is unlocked by `telephone` (game era 4);
- "Era 2. Automotive Industries" by `combustion_engine` (era 4);
- "Era 3. Arms Industries (Bolt Action Rifles)" by an era-4 technology;
- "Era 3. Fertilizer Plants (Catalytic Synthesis)" by an era-5 technology;
- "Era 1. Motor Industries" by an era-2 technology.

A player will read "Era 2" as the tree's Era II. "Recipe BE 44%" appears on every building and nothing in game or in the README says what it
is. Both labels are user rulings (era rule 2026-09-13; P3 2026-09-18), so this is for the user to weigh. Cheapest mitigation: a README section
"How to read building names" (narrative era ≠ tech era; recipe break-even at base prices, goods only). Alternatives: anchor years ("c.1875"),
or a different word than "Era".

### 8. Dam decisions and texts expose internals (K, medium)

- `mod/common/decisions/zzz_pm_rehaul_dams.txt:28`: `pmr_dam_bur_headroom > 1500` in `possible`, and there is no loc key `pmr_dam_bur_headroom`.
  The requirement probably shows the raw script-value name (unverified in GUI). It is also partly redundant with `produced_bureaucracy > 1500`
  on L27.
- L29: `OR = { is_player = yes  NOT = { has_variable = pmr_dam_took_survey } }` shows a raw variable name. Wrap it in `hidden_trigger`, or in a
  `custom_tooltip` with text.
- Every `je_pmr_dam_*_survey_reason` says "we may build the dams, in our own state or in a subject's". Under `dams.rules = family` the surveyor
  may hold investment rights in a non-subject's state, and `dams.private = all` also lets private investors build.
- The decision description says "Builders share its levels, each owning what it builds". F240 found that privately built levels go to the
  host's financial district or to the dam itself.

Effort ~30 min in `emit_dams.mjs`.

### 9. Building from source off the default path (C, builders only, high)

`tools/emit_techs.mjs:34`, `emit_research_events.mjs:29`, `emit_tech_finish.mjs:37`, `emit_goods.mjs:26`, `emit_research_levers.mjs:13`,
`emit_ai_schooling.mjs:16`, `emit_ai_treaty_ports.mjs:22`, `emit_treaty_port_rules.mjs:28`, `tech_tree_spec.mjs` and `preflight.ps1:64` all hard-code
`C:/Program Files (x86)/Steam/…`. The other emitters and `build.ps1:155` honour `VIC3_GAME`.

Deploy uses `Join-Path $env:USERPROFILE 'Documents\…'` (`build.ps1:1772`), which misses OneDrive-redirected Documents, a common default on
Windows 11. `[Environment]::GetFolderPath('MyDocuments')` is correct.

Effort 20–30 min.

### 10. `00_starting_inventions.txt` is owned but identical to vanilla (I/compatibility, high)

`mod/common/scripted_effects/00_starting_inventions.txt` is byte-identical to vanilla's apart from line endings (checked with `cmp` after
stripping CR). The 1836 grant is empty under the vanilla-ladder rule, but `tools/emit_techs.mjs:524` writes the file unconditionally. That
contradicts CLAUDE.md's "a file we would copy verbatim is NOT emitted": it freezes a vanilla file against a 1.13.x hotfix and blocks other mods.

Fix: skip the write when the text equals vanilla's. ⚠ Landmines L14/L15 read this grant file, so let them fall back to vanilla's file.
Effort 20 min.

### 11. Dead dam-driver script ships (I, high)

`mod/common/on_actions/zzz_pm_rehaul_dams.txt:540` to the end (~3,680 of 4,221 lines) defines `pmr_dam_driver`. No on_action lists it (grep:
the definition only). `dams.rules = family` has no driver by ruling. It is harmless at runtime but is parse load and noise.

Fix: don't emit it when the driver is off. 15 min.

### 12. A no-op define with a misleading comment (K/I)

`mod/common/defines/01_pm_rehaul_defines.txt:5` reads `TECH_AHEAD_OF_TIME_PENALTY_FACTOR = 0.25  # vanilla 0.25; the tree is deeper`
(`emit_techs.mjs:98,576`). This is vanilla's own value. It is already flagged on the UI's Mod-changes page. Drop the line. 5 min.

### 13. Logs and the compatibility footprint (I)

- **debug_log volume, release build** (canon run 2 of `20261019_225952_wm99-n4`):
  - research JE file 6,313 lines (out of scope, brief item 1);
  - dams 5,638 lines (`bur_year` 3,058: once a year for every country holding electrical_generation; `survey_month` 2,157);
  - init marker 1.
  
  It only goes to debug.log and is harmless. A "release" switch could drop the dam lines. No telemetry (`zzz_v3tb_*`) ships in the default
  build ✅. The `zzz_pm_rehaul_diag.txt` init marker ships (one line; fine to keep as a load proof).
- **83 vanilla files whole-file replaced** (for the README compatibility note):
  - 22 `company_types`;
  - 16 `history/buildings` (plus `replace_paths`);
  - 13 `history/pops`;
  - 15 `map_data/state_regions`;
  - `technology/technologies/10_production`, `20_military`, `30_society`;
  - 4 `state_traits`;
  - `static_modifiers/00_code_static_modifiers`;
  - `ai_strategies/01_admin_strategies`;
  - `buildings/01_industry`, `06_urban_center`;
  - `production_methods/01_industry`, `06_urban_center`, `07_government`;
  - `goods/00_goods`;
  - `laws/01_education_system`;
  - `scripted_effects/00_starting_inventions`.
  
  Map mods, and company, tech or pop-history overhauls, will conflict silently by load order.

---

### Error-log scan: what was checked, and the caveat

**Runs.**
- Canon family: 6 runs. Runs 2–4 of `20261019_225952_wm99-n4` are the canon's bytes. Runs 1–3 of `20261016_092158_rs-m10ac-n3` are the
  canon minus private dams and the threshold.
- Run 1 of wm99 is left out: its mirror re-copied the error log (the L28 incident in its VERDICT).
- Vanilla: 10 runs, all six of the October n=6 (`20261020_121619`, `20261020_222433`) plus summer n=16 runs 1–4.
- Each mirror begins at the game's own log rotation ("recovered 0 chars"), so the whole file is the run's own.
- Entries were classified by source plus normalised message plus script location (`classify.mjs` in the scratchpad).

**Results.**
- **0 error lines name a mod file** (`zzz_pm_rehaul*`) or a `pmr_` key in any canon run.
- No load-time errors: no duplicate keys, no unknown modifiers. No `defines.cpp` rejection; `debug.log` says "successfully matched game
  version 1.13.11".
- Totals excluding the navy-model flood: canon 10k–72k lines a run, vanilla 12k–152k.

**Classes systematic in the mod and absent from all 10 vanilla runs, all out of scope:**
- `is_production_method_active` PostValidate (6/6 runs; `00_scripted_triggers`, `00_scripted_effects`, `pm_events`,
  `industrial_accidents_events`, `ep2_japan_events_03`). Catalogued in MISSING_PM_REFERENCES.md.
- `production_tech_events.txt:460–461` "Undefined event target / unset scope / add_modifier wrong scope" (4/6 runs). Event 300 (telephone)
  fires on the trigger's `building_electrics_industry` check, but its `immediate` needs `pm_telephones`, which our electrics rung does not run
  (it runs its own main method copy). The event then appears with no placement, and its "industry!" option does nothing. It is
  MISSING_PM_REFERENCES row 40 and already catalogued.

**Classes that look mod-only but are vanilla and playthrough-dependent:**
- `country_bic.txt:1270` "state vs state_region comparison" (3/6 vs 0/10). Vanilla's own bug, `this = s:STATE_HYDERABAD` inside
  `any_scope_state`.
- `ip3_hungary_events`, `ip4_cuba_values`, `india_non_cooperation` (1 run each).
- `trade_route_events` invalid object (also in 3/10 vanilla).
- The `concept_religious_trait` data-function failures (also in vanilla).

**Generated-content checks (all clean).**
- **Loc:** 3,671 keys, the same key set in all 11 languages; correct `l_<lang>:` headers and BOMs; no broken `$ref$`, no unescaped inner
  quotes, no unbalanced `[ ]` or `#…#!`.
- **Loc coverage:** every decision has a name and `_desc`, every journal entry a name and `_reason`; every building, method, group, state
  trait, technology and progress bar has a name.
- **Assets and definitions:** all 644 icon and texture paths exist; every modifier name in the mod's own static modifiers, state traits,
  technologies and methods is a defined modifier type (2,377 checked).
- **Script structure:** every script file has a BOM; no vanilla on_action carries a direct `effect` (L22 idiom held).
- **Config:** the canon config carries no probe-only keys (`dams.probe`, `force_test`, `perf_*`, treaty-port layers all absent).
- **Deployment:** the Documents copy is identical to `mod/`.

⚠ **Caveat that matters for release.** The observer runs headless, and nothing hovers tooltips or opens decision, building or company panels.
So GUI-only failures (tooltip data functions, huge OR tooltips, raw script-value names) cannot show up in these logs.

**Recommended:** a 15-minute manual pass on the canon in game, then read `error.log` by position:
- a craft and a merged building panel;
- the build menu tooltip of a dam you cannot build;
- the decision panel after a dam technology;
- a company prosperity tooltip;
- the Military Industry principle tooltip.

Untested: a DLC-less install.
