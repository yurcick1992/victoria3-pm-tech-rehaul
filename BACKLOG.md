# BACKLOG — every open work item, one line each (created 2026-10-01)

The MIDDLE layer: `ROADMAP.md` is the helicopter view (steps and why), `HANDOVER.md` is the next session's baton (gitignored). This file is
the list in between — what is open, in what state, and where its detail lives. **One line per item; the detail stays in the source doc.**

**Keep it true in the same pass as the change** (the doc-sync rule): add an item when it is found, move it to *Done* (with the commit or
FINDINGS number) or delete it when it closes. An item marked *(verify)* was collected from an older doc and may already be moot.

Status: **NOW** = the current arc · **OPEN** = to do, no ruling needed · **RULING** = waits on the user · **DEFERRED** = parked by
ruling or by order · **RESEARCH** = an unexplained measurement · **DEFECT** = known wrong, accepted for now · **WATCH** = read, do not act.

## The order (from ROADMAP and the user's rulings)

1. **Now:** the crafts + merges arc → the user canonises or drops both lines together (A).
2. **Balance campaign** on the canon that results: the price path, the old rung in the consumer chains, the hoard (B), with the tech-tree
   and AI items that bear on them (C, D).
3. **Final balance check.**
4. **Last feature pass:** artisanal ownership, if the crafts are canonised (A, ROADMAP step 6½).
5. **Polish and release** (H), after the engine-compatibility pass (E).
Tooling and instrument debts (F, G) are paid when an item above needs them.

## A. The arm under test — crafts + merges (ROADMAP steps 12–13, BALANCE_FRAMEWORK §10.91)

- **RULING** · THE e1-ANCHOR BOOK `e1a-artmerge` read over the century (F200, n=2 aligned, both intact): loss 7.76 vs the canon's 5.90 and the 0.01 arm's 10.09 — the hoard gone (pool H 0.52), PP 1.07, PI falling, but world GDP 0.82 after a long mid-game dip; motor's steam rung (e1 now) and the shortlist's food/paper crafts survive · §10.91.5, F199, F200
- **RULING** · the 1.2 book over the century (F203, n=3 full runs): 2 intact / 1 stall (a stuck Britain), loss 8.62 vs the 1.4 book's 7.76 and the canon's 5.90; world GDP 0.78, pool GDP 0.85 (beyond soft), pool H 1.41 (1.4: 0.52); the German hole gone early, the e1 food rung overshooting in the rich markets in the 1850s · §10.91.5, F203
- **RULING** · the USA's agrarian end state is traced (F204): no plain bug; the investment AI puts 26–33% of the US's 1860–1900 private construction into textile's and furniture's e2 merge hosts (`ai_value` 15,588, unlocked by a game-era-2 technology in the 1850s) where steel is thin under the e1 anchor, while mines, logging, plantations and railways (2–10× the profit per point) get ~10% against vanilla's 31%. Levers proposed, none ruled: merge hosts at their own era's ai_value; ai_value keyed on the gate's game era for era-bumped rungs; the untiered capital buildings on the ladder; vanilla's cost divisor. A 30-year probe sees only the capture's onset (1856–66), not its persistence (to ~1886) or the US GDP outcome (out of vanilla's seed range only at 1900–1920), and at 1866 its world GDP sits above five of the canon's six seeds, the reverse of 1935 · F204
- **RULING** · THE COMPRESSED DESIRE LADDER over the century (F209, session `20261002_120946_e1a12-ai1135-n2`, ledger https://claude.ai/artifact/LmtipGTd3dP1CQemKXRhdg): ENDED AT n=2 by the stop rule — run 1 intact (world GDP 0.79, loss 8.79), run 2 BROKEN BY RUNOFF (1.42×, shortlist U* 7.0%, the pools spent). Misplaced capital 1926–36 29% / 26% (e1a12 38%, the canon 28%, vanilla 17%); the USA 1.23 / 0.91× vanilla (e1a12 0.35–0.55); old rungs beside a rung two eras newer 4.9 / 4.5% of world tier workers, 0.9 / 1.2% of the shortlist's at 1935. The arm's keep-or-drop (crafts + merges) is the user's, OVER THE WEEKEND after more tests (user, 2026-10-02 evening: "So far, doesn't work, but we're not giving up on it yet, it's narratively much better than canon, and this is an economic realism mod"); proposed, not ruled: if the arm stays, a recipe-side counterweight to the runaway (§10.92) · §10.91.5 · §10.92 · F208 · F209
- **NOW** · MISPLACED CAPITAL IS THE YARDSTICK OF EVERY AI-VALUE CHANGE (user-ruled 2026-10-02, §10.92: "we want it to be as low as possible … AI values only follow to ensure that the AI follows what's profitable"; recipes steer production). The four-rung books misplace a third of their late capital against vanilla's eighth, all of it in factories, losing to coal, iron, logging and plantations that are valid and unbuilt (F206/F207); the compressed ladder brought it to the canon's level, not vanilla's (F209). Read every later AI-value change on both benchmarks — year by year from its own v15 summaries, and the decade before 1936 like-for-like with e1a12 / the canon / vanilla — beside the register. The reader is `tools/testbed/ledger/misplaced_capital.mjs` (`--batch label:session[:setup]`, `--snap`, `--series`, `--why`; promoted 2026-10-02, identical output to the scratch copy) · §10.92 · F206 · F207 · F209
- **NOW** · THE USER'S PLAYTEST of the e1a12-ai1135 build (deployed 2026-10-02 20:34 — NOT the canon; the repo's `mod/` still is) and the OVERNIGHT FIXED n=3 the user launches, `tools/testbed/schedules/e1a12_ai1135_n3.json` (yearly saves so play time is readable; no stop watcher). Next session: the playtest notes first, then the n=3 read as in HANDOVER (register pooled with the 2+1, misplaced capital, `fill_ledger.sh` ledger) · F209
- Done 2026-10-02 · the century 2+1 of `e1a12-ai1135-artmerge` and its full ledger (the e0 artisans/other split and the old-rungs-beside-replacement table added to the ledger template) · F209
- Done 2026-10-02 · the USA analysis (F203 §3's open item): politics in one seed (five southern states to New Africa in 1891), the ai_value-driven construction mix in all three · F204
- Done 2026-10-02 · the century of `e1a12-artmerge` (session `20261001_225817_e1a12-artmerge-n3`) · F203
- Done 2026-10-01 · the pop-good lift's value RULED at 1.2 (1.4 opened F201's hole; F202: 1.0 overshoots British groceries, 1.2 stays inside vanilla's range). ⛔ A technology-triggered penalty on old rungs is RULED OUT ("never ever, for simulation purity") · §10.91.5, F201, F202
- Done 2026-10-01 · the lift probe `20261001_215119_e1a-lift-probe-10y` (lift 1.0 and 1.2, 2 × 1836→1846 each, all clean) · F202
- Done 2026-10-01 · L29's reader side: a `tail -F` / Monitor holding `session.log` open drops the scheduler's lines; `Test-LmL29` (`preflight -Session`, WARN) checks every run has its `=== run N/M` line · TESTBED_LANDMINES L29
- **OPEN** · `health_vs_ref.mjs`'s token guard (under half the reference MINIMUM) is disarmed where a reference seed lacks the market (the canon's Prussian minimum is 0): add the vanilla n=16 as a second reference, or a both-seeds-agree rule · F199 §8
- Done 2026-10-01 · the arm re-probed at the ruled £2 floor: healthy, crafts as staffed as at 0.01, a fifth of craft levels log failed hires again · F198
- Done 2026-10-01 · output-matched 1836 craft seeding (built into `emit_craft_start.mjs`, `--seed`; vanilla head count kept) · §10.91.5
- **NOW** · recipe iteration for obsolescence: the craft recipes individually, and the other tiered industries through anchors and ladders; the motor e0 is the largest live old rung (647k shortlist workers at 1935) · HANDOVER (2026-10-01) §2, F195
- **RULING** · the arm read over the century (F194): 3/0 intact, consensus loss 10.09 vs the canon's 5.90 — the hoard (pool H 2.64) and pop-goods prices (PP 1.16) carry the gap; crafts still 2.0–2.4M workers at 1935 (periphery) · F194
- **OPEN** · the PB rises every decade with no dip (members do move crafts → urban centres) — tracking only by ruling · F194 §3
- **RULING** · canonise or drop crafts + merges TOGETHER after the 2–3-day arc · §10.91.3
- **RULING** · anchor slide for food and paper (their e1 carries A¹; e1–e3 are held byte-identical by §10.91.1) · F189 §3
- Done 2026-10-01 · the recipe model RULED ("Agreed on e1/1.5 instead of e1/A; e1/B, engines, the 60% and pop-good penalty") and built as `e1a-artmerge` · §10.91.5, F197
- **RULING** · the crafts' ÷50 construction cost ("faster payback is narratively deliberate") · §10.91.1
- **OPEN** · crafts sitting on the engine's 20% profit pause line — a few % more output if the century batch shows it binds · F188
- **OPEN** · `--craft-table <file>` override so a variant never edits the ruled `CRAFTS` table in place · this file
- **OPEN** · teach the old-rung readers (`rung_econ`, `rung0_*`, `lib_obsolescence`, `tiered_panel`) the merged methods · ROADMAP step 13 item 3
- **DEFERRED** · merge branch if the hosts run hot (added method ×1/√1.9, or host cost ×1.62) · §10.91.2
- **DEFERRED** · craft extras: a Muskets craft; spreading the 1836 craft levels over the largest states; automation that duplicates a main-method upgrade · ROADMAP step 12
- **DEFERRED** · ARTISANAL OWNERSHIP (shopkeepers as owners, dividends) — the last feature pass, only if canonised · ROADMAP step 6½
- **WATCH** · craft ai_value (1,000 a level) — not a lever to pull unasked · §10.91.1
- **WATCH** · the PB arc is tracking-only by ruling (no forced radicalisation, no retargeted 1848 cascade) · F190–F193
- **RESEARCH** · the crafts' channel into early revolutions (Austria's 1840 Springtime) — look for Springtimes before 1843 · F184
- **RESEARCH** · merged-method secondaries not re-selected after a switch; switched chemical plants two-thirds staffed · F182

## B. Balance and the economy

- **OPEN (core)** · the output-price path does not fall (F94); the consumer-chain old rungs stay profitable (87–93%) · CLAUDE.md, F136, F163
- **OPEN** · the hoard: pool H ~4× vanilla; the inflow mechanism is a candidate, not measured · F135, F179 §3
- **OPEN** · P1 early rungs are a money printer (aim at 1850–1880 realised margins) · ROADMAP P1
- **OPEN** · P8 an e3 takes 2+ years to build (late construction points + goods, the queue define, or the convergence campaign) · ROADMAP P8
- **OPEN** · P6 / F137 the 1836 supply anchor over-produces — the slide fixed four industries, food and paper remain (see A) · ROADMAP P6
- **OPEN** · the graded era-0 penalty has never run a century; the generator refuses `--anchor-for` with `--in0-stage` · ROADMAP step 10
- **OPEN** · non-geometric OUTPUT ladder flag (`--out-ladder`, mirroring `--cost-ladder` / `--in-ladder`) + its L31 arm · ROADMAP step 10 §3.4, F148
- **OPEN** · Britain fully employed with no relation to B; which lever converges prices (trade capacity?) · ROADMAP step 11 OPEN (3)(4)
- **RULING** · the register: O_shed in place of T0; the four loss fixes; pool U* aim contradicting pool W; "GDP per capita" vs total; the reading-gate cut · §10.83.3–.8, §10.85, F136
- **RULING** · re-basing `wage_pct` in `make_ab_config`'s target_be and `lint_solvency` (L18) · §10.87
- **RULING** · P9: the tech tree should be prioritised, not completed (grant fraction, a stage, the ahead-of-time define, depth) · ROADMAP P9, F138
- **PROPOSED** · per-industry levelling alone (`--in0-level 0.05`) — ⚠ the axis was CLOSED 2026-09-19; *(verify)* drop · ROADMAP step 9
- **PROPOSED** · per-good price system; rung build-gate + steeper ai_value *(verify — may predate the four-rung canon)* · BALANCE_FRAMEWORK
- **DEFECT** · minted top rungs rarely reached in play *(verify after the merges)* · CLAUDE.md, F106 §6
- **DEFECT** · an empty pop need should buy its default good (model only, not the mod) · CLAUDE.md, F44
- **RESEARCH** · the need-substitution rule's real form; prestige share local vs market; USA strata/slave derivations disagree · CLAUDE.md
- **RESEARCH** · the urban-centre electricity override's economic effect is unmeasured · CLAUDE.md
- **RESEARCH** · F45's price basis is qualified, not settled · F178 §9.4
- **ACCEPTED** · P5 tier-3 output enormous — rides on P1 · ROADMAP P5

## C. Tech tree and research

- **OPEN** · step 1's rework never deepened the tree (182 vs vanilla's 178, 3 minted) — ties to P9 · ROADMAP step 1, F138
- **OPEN** · era 5 fell 20 → 14 technologies after the merges · ROADMAP step 1
- **OPEN** · a validator for technology re-pegs (no emptied vanilla technology) · BUGS_AND_FIXES 2026-08-30
- **OPEN** · `emit_techs.mjs` grant-side blind spot (two-line fix) · TESTBED_LANDMINES
- **RULING** · the scope of post-JE tech finishing beyond the shipped finish boost · ROADMAP step 11
- **RESEARCH** · F162's anomalies (Spain's intensive_agriculture, Ecuador's and Alwar's aniline) · F162
- **RESEARCH** · ai_weight depth *(verify — likely moot since `tech_ai_weight_mult`)* · ROADMAP step 1

## D. AI, construction, companies, dams

- **OPEN** · company mandates first cut shipped and unmeasured (the company-held rung mix) · ROADMAP step 5
- **RULING** · the capital-export arm (FDI factor) — measured, not adopted · F179
- **DEFERRED** · dam consumers' recipes (power plant at 4× cost ships) · ROADMAP step 6
- **OPEN** · dam survey concurrency: a spare check + a "just surveyed" variable · F176
- **RESEARCH** · dams' effect on GDP and the stall/runoff tails; what sets the dam count; privatisation in some countries · F175–F177

## E. Engine compatibility (vanilla references our split breaks)

- **DEFERRED** · MISSING_PM_REFERENCES.md — ~28 vanilla events/JEs checking a relocated main PM; one strategic "tiers are eligible" pass · MISSING_PM_REFERENCES.md
- **DEFERRED** · `has_building` narrowing (457 refs match tier 1 only) — the same pass · CLAUDE.md
- **DEFERRED** · MISSING_BUILDING_CONDITIONS.md — the art academy's conditional ai_value (1 case) · MISSING_BUILDING_CONDITIONS.md

## F. UI and tooling

- **OPEN** · collapse `builder.html`'s copy of `econ.js` (~260 lines; change both or neither until then) · CLAUDE.md
- **OPEN** · the tech-tree page (`ui/techdata.js`) still shows the six-rung candidates · CLAUDE.md
- **OPEN** · JE tooltips should read in people, not levels (P4 residual) · ROADMAP P4
- **OPEN** · the ledger fill scripts' hardcoded session paths (`--session` flag) · CLAUDE.md
- **DEFECT** · `fill_consts.mjs`'s "productive workers" subtracts a levels-scale staffing (held: moving it restates a shipped number) · CLAUDE.md
- **DEFECT** · `deviates_from_vanilla` is a six-path probe list; it should walk the built mod · ROADMAP DEFERRED FIXES
- **DEFECT** · the binary save reader is trusted only below ~104 MB (per-market pops, per-state local supply) · CLAUDE.md

## G. Testbed instrument (TESTBED_LANDMINES)

- **OPEN** · L37 the stop watcher goes blind on a multi-setup schedule
- **OPEN** · detectors owed: L19 orphaned game process, L23 raw-counted repeated log lines, L11 wrong/nonexistent tag, L9 per-run error windows
- **OPEN** · live proofs owed: quarantined-save resume hooks, L29 scheduler abort, L34 fresh-start restart
- **OPEN** · L30: a resume mode after a machine reboot
- **MANUAL** · L3 unbounded scopes, L10 mid-batch edits (no detector possible); L4 advisory
- **PARKED** *(verify)* · three-arm runs 4–6, autosave-cadence experiment, concentration metric, tick-speed regression; do empty pop records cost tick time · ROADMAP "Parked"

## H. Polish and release (ROADMAP step 7)

- **OPEN** · per-tier building artwork; per-technology icons (one placeholder ships)
- **OPEN** · era band dividers in the tech-tree GUI
- **OPEN** · proofread every new technology name and description
- **OPEN** · release

## Done (recent; prune freely)

- 2026-10-01 · `artmerge6-pb` century n=3 read · F194

- 2026-10-01 · save summary v13/v14: IG clout and IG members by workplace (`ig_clout.mjs`, `ig_pop_contrib.mjs`, `ig_workplace_series.mjs`) · F190, F192, F193
- 2026-10-01 · craft staffing → 30% shopkeepers / 70% laborers, four craft outputs raised; 10-year probe healthy · §10.91.4, F191
