# BACKLOG — every open work item, one line each (created 2026-10-01)

The MIDDLE layer: `ROADMAP.md` is the helicopter view (steps and why), `HANDOVER.md` is the next session's baton (gitignored). This file is
the list in between — what is open, in what state, and where its detail lives. **One line per item; the detail stays in the source doc.**

**Keep it true in the same pass as the change** (the doc-sync rule): add an item when it is found, move it to *Done* (with the commit or
FINDINGS number) or delete it when it closes. An item marked *(verify)* was collected from an older doc and may already be moot.

Status: **NOW** = the current arc · **OPEN** = to do, no ruling needed · **RULING** = waits on the user · **DEFERRED** = parked by
ruling or by order · **RESEARCH** = an unexplained measurement · **DEFECT** = known wrong, accepted for now · **WATCH** = read, do not act.

## The order (from ROADMAP and the user's rulings)

1. ✅ **Done 2026-10-12:** the artmerge arm's last tech rework (§10.97, §10.98) and THE DECISION — the arm is CANONISED as `jex-dam4s-rs`
   (BALANCE_FRAMEWORK §10.99, F227). The pre-artmerge family is no longer canon; its files stay, and returning to it would need the
   performance changes (resource-slot dams, trigger-placed research entries) reimplemented. Open in the canon: the runoff tail, military
   research ~10 behind vanilla, tech spread ×2 (deferred).
   **DEFERRED TO MOD 1.1 (user, 2026-10-21, POLISH_1_0.md Q5):** military research ~10 behind vanilla and no era-5 military technology anywhere
   (re-counted on F247). The first approach to try: *"a bit higher ai weights for military techs over societal techs over most production techs
   (exceptions with also higher priority on production where there are no JEs, like Shift Work)"* — i.e. the AI research weights, military >
   society > production, with production technologies that have no research entry raised too.
1b. **NOW (2026-10-13):** the canon is `jex-dam4s-rs-x25` (the one innovation parameter x = 25, universities × x/150; unmeasured, deployed) — since 2026-10-16 `jex-dam4s-rs-x25-dpriv` (the same + private dam construction, §10.89.14), and since 2026-10-16 EVENING `jex-dam4s-rs-x25-m10ac-dpriv` = that + the engine ladder unlifted (§10.101) + the conditional merge-host desire (§10.91.2) — F239 measured them without private dams (3 intact, loss 6.72, misplaced capital not lower); the combination is deployed and UNMEASURED. Measured and NOT canon: the engine ladder unlifted with 48-month research stages (F233 — 3 intact, but the leader 20.5% of game era 4 at 1905: the stages overshoot). Routine levers ruled (§10.101.1); likely next: paper's own lift (1.0–1.3, today 1.2), the stage length between 36 and 48 months, and measuring x/150. Nothing launched.
1c. **NEXT (2026-10-16):** measure the canon `jex-dam4s-rs-x25-m10ac-dpriv` over the century (3 × 1836→1936, fixed n; F239 measured everything in it but the private dams, which only the exaggerated probe of F240 has seen) — proposed, NOT launched; it is the base the next lever reads against (paper's own lift, the stage length, the cost ladder of F234).
1d. **RULED (2026-10-17, §10.102):** the NEXT ARM carries `NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD = 0.99` — book
   `jex-dam4s-rs-x25-m10ac-dpriv-wm99` (the canon + that define; F241). Canonised only after at least n=3 performance tests. Deployed for the user's
   playtest 2026-10-17 21:23 (`mod_playtest_wm99/`); the canon is restored with `robocopy mod <Documents mod folder> /MIR`.
   ⭐ **NEXT SESSION (user, 2026-10-19):** first a THOROUGH EXPLANATION of the monopoly-threshold change to the user (deferred, not researched
   on 2026-10-19), then **n=4 under the monopoly threshold** (4 × 1836→1936 on the wm99 book) to decide whether it is canonised for 1.0; then polish.
   ⭐ **EXPLAINED AND RULED 2026-10-19 late evening (§10.102 item 4):** 0.99 is canonised if the n=4's play time is within +10% of vanilla, and the
   threshold is left untouched otherwise. ⛔ **DONE 2026-10-20 (F247): NOT CANONISED** — play ×1.18 of vanilla (194.2 min against 165.0).
   ⭐⭐ **OVERTURNED 2026-10-21 — CANONISED** (user-ruled): vanilla itself plays ×1.08 slower in October than in the summer at the same world size
   (F248), and against the same days' vanilla the book reads ×1.09. `config/mod_config.json` = the wm99 book, deployed.
   ⇒ **NEXT (user, 2026-10-21): after the first round of polish, the ALTERNATING batch** — vanilla + canon run by run, n=16 each, ~4 days
   (`tools/testbed/schedules/alt_vanilla_canon_n16.json`, prepared, NOT launched; point it at the post-polish canon's named copy first). It is the
   canon's century and the wall-clock reference in one.
2. **Balance campaign** on the canon that results: the price path, the old rung in the consumer chains, the hoard (B), with the tech-tree
   and AI items that bear on them (C, D).
3. **Final balance check.**
4. **Last feature pass:** artisanal ownership — DEFERRED to mod 1.1 or later (user, 2026-10-21; A, ROADMAP step 6½).
5. **Polish and release** (H), with the engine-compatibility pass (E) as its main part (user, 2026-10-19).
Tooling and instrument debts (F, G) are paid when an item above needs them.
⭐⭐ **THE RELEASE TIMELINE (user, 2026-10-19; ROADMAP step 7): POLISHING STARTS WITH THE NEXT SESSION.** Mod 1.0 for game 1.13 on **30.10**; game
1.15 (with 1.14's AI rework) on 05.11; a stable 1.15.N ~12.11; **mod 1.1 for 1.15.N ~16.11** (the ON_GAME_UPDATE pass + treaty ports if the new AI
allows, §10.103); GTA VI on 18.11, after which nothing until the new year.

## A. The arm under test — crafts + merges (ROADMAP steps 12–13, BALANCE_FRAMEWORK §10.91)

- **RULING** · THE e1-ANCHOR BOOK `e1a-artmerge` read over the century (F200, n=2 aligned, both intact): loss 7.76 vs the canon's 5.90 and the 0.01 arm's 10.09 — the hoard gone (pool H 0.52), PP 1.07, PI falling, but world GDP 0.82 after a long mid-game dip; motor's steam rung (e1 now) and the shortlist's food/paper crafts survive · §10.91.5, F199, F200
- **RULING** · the 1.2 book over the century (F203, n=3 full runs): 2 intact / 1 stall (a stuck Britain), loss 8.62 vs the 1.4 book's 7.76 and the canon's 5.90; world GDP 0.78, pool GDP 0.85 (beyond soft), pool H 1.41 (1.4: 0.52); the German hole gone early, the e1 food rung overshooting in the rich markets in the 1850s · §10.91.5, F203
- **RULING** · the USA's agrarian end state is traced (F204): no plain bug; the investment AI puts 26–33% of the US's 1860–1900 private construction into textile's and furniture's e2 merge hosts (`ai_value` 15,588, unlocked by a game-era-2 technology in the 1850s) where steel is thin under the e1 anchor, while mines, logging, plantations and railways (2–10× the profit per point) get ~10% against vanilla's 31%. Levers proposed, none ruled: merge hosts at their own era's ai_value; ai_value keyed on the gate's game era for era-bumped rungs; the untiered capital buildings on the ladder; vanilla's cost divisor. A 30-year probe sees only the capture's onset (1856–66), not its persistence (to ~1886) or the US GDP outcome (out of vanilla's seed range only at 1900–1920), and at 1866 its world GDP sits above five of the canon's six seeds, the reverse of 1935 · F204
- **RULING** · THE COMPRESSED DESIRE LADDER over the century (F209, session `20261002_120946_e1a12-ai1135-n2`, ledger https://claude.ai/artifact/LmtipGTd3dP1CQemKXRhdg): ENDED AT n=2 by the stop rule — run 1 intact (world GDP 0.79, loss 8.79), run 2 BROKEN BY RUNOFF (1.42×, shortlist U* 7.0%, the pools spent). Misplaced capital 1926–36 29% / 26% (e1a12 38%, the canon 28%, vanilla 17%); the USA 1.23 / 0.91× vanilla (e1a12 0.35–0.55); old rungs beside a rung two eras newer 4.9 / 4.5% of world tier workers, 0.9 / 1.2% of the shortlist's at 1935. The arm's keep-or-drop (crafts + merges) is the user's, OVER THE WEEKEND after more tests (user, 2026-10-02 evening: "So far, doesn't work, but we're not giving up on it yet, it's narratively much better than canon, and this is an economic realism mod"); proposed, not ruled: if the arm stays, a recipe-side counterweight to the runaway (§10.92) · §10.91.5 · §10.92 · F208 · F209
- **NOW** · MISPLACED CAPITAL IS THE YARDSTICK OF EVERY AI-VALUE CHANGE (user-ruled 2026-10-02, §10.92: "we want it to be as low as possible … AI values only follow to ensure that the AI follows what's profitable"; recipes steer production). The four-rung books misplace a third of their late capital against vanilla's eighth, all of it in factories, losing to coal, iron, logging and plantations that are valid and unbuilt (F206/F207); the compressed ladder brought it to the canon's level, not vanilla's (F209). Read every later AI-value change on both benchmarks — year by year from its own v15 summaries, and the decade before 1936 like-for-like with e1a12 / the canon / vanilla — beside the register. The reader is `tools/testbed/ledger/misplaced_capital.mjs` (`--batch label:session[:setup]`, `--snap`, `--series`, `--why`; promoted 2026-10-02, identical output to the scratch copy) · §10.92 · F206 · F207 · F209
- Done 2026-10-03 · THE OVERNIGHT FIXED n=3, session `20261002_235755_e1a12-ai1135-n3` (the third launch, 23:57; `20261002_223204` and `20261002_232955` VOID): **3/3 intact**, world GDP 0.80 / 1.01 / 0.89× at the end state, consensus loss 7.40 (pooled with the 2+1: 4 intact / 1 broken, 7.02; the canon 5.90, e1a12 8.62), misplaced capital 21% of 1926–36's new capital (the 2+1 29% / 26%, e1a12 38%, the canon 28%, vanilla 17%); one CTD resumed cleanly; every post-run landmine PASS. Read in full: FINDINGS F210 and its ledger https://claude.ai/artifact/JA9phhkp7X7FaRQjyvKdUG — ⚠ the shortlist keeps 3–7% of its tier workers on rungs two eras behind their own country's best (the 2+1 ~1%), led by Dye Workshops beside Electric Sewing Machines, likely §10.93's loom changes at low wages — against the canon it is textile alone in the shortlist (F210 addendum); the USA agrarian in 2 seeds of 3, the two where the Confederacy won its independence (1876, 1849) — no seed fought a Mexican–American war in its window (California Mexican in 1886 in all three) · F209 · F210
- Done 2026-10-02 · THE PAIR-BY-PAIR COMPATIBILITY TABLE (§10.93 rule 3, `tools/lib_secondary_compat.mjs`), ACCEPTED by the user ("All right on incompatibles"): 139 vanilla pairs reviewed, 14 incompatible (Assembly Lines off Muskets, Rifles, Cannons, Smoothbores, Percussion Caps, Wrought Iron Tools; powered automation off Handcrafted Furniture, Crude Tools; Automatic Power Looms off Handsewn Clothes; Bottle Blowers off Forest Glass). ⚠ On the CANON's next build all 14 apply (an unmeasured economic change to the canon) · §10.93
- Done 2026-10-02 · AUTOMATION THAT IS NARRATIVELY THE SAME AS A MAIN METHOD — 3 pairs (Mechanized Looms ↔ Sewing Machines, Automatic Power Looms ↔ Electric Sewing Machines, Assembly Lines ↔ Mass Production), RULED ("1) remove them from lower, 'not yet upgraded' rungs 2) mandate them as is to primary rungs they match with") and built: always on beside their main method (no technology gate of their own), gone from the rungs below · §10.93 rule 5
- Done 2026-10-03 · THE PLAYTEST BUILD REDEPLOYED (user-asked: "the same mod that was used in the latest probe, possibly except for telemetry"): the Paradox mod folder now holds `mod_playtest_tex1140/` (built 13:58, book `e1a12-ai1135-tex1140-artmerge`, with §10.93 and the Conveyors prerequisite) — a rebuild with the probe's own telemetry and token reproduced probe `20261003_111956`'s recorded fingerprint exactly (170 files, 10,424,832 bytes, layout `f88bf6e97156d8e8`), and the deployed copy is that build file for file minus its two telemetry files. The 2026-10-02 20:34 build stays in `mod_playtest_e1a12ai1135/` (restore: robocopy /MIR it back). ⚠ A save from the old build may not load cleanly on this one (§10.93 renamed and mandated secondary groups)
- Done 2026-10-02 · every main production-method group titled "Base" (`$pm_base$`, as vanilla) · §10.93 rule 4
- Done 2026-10-03 · the balance sheet offers only the secondary methods a rung can run and defaults to the first (a mandated automation on by default): `ui/data.js` `sec_options` from `basic_secondaries.mjs --options` (lib_secondary_compat `secondaryOptions`) — no more Elastics on Handsewn Clothes or looms on the e0/e1 textile rungs in the sheet · §10.93 rule 6
- Done 2026-10-03 · BREAK-EVEN "UNDER THE MOST BASIC OF ALL SECONDARY PMs AVAILABLE FOR THE BUILDING" (user-ruled 2026-10-03): one implementation (`lib_secondary_compat` basicSecondaries / basicTotals / basicEmployment); the BOOK — `make_ab_config` restates on it, `tools/restate_basic_be.mjs` re-applied it to the canon (both copies) and the arm (Sewing Machines 62 → 64, Electric Sewing Machines 45 → 48, Mass Production 29 → 32; 53 of 56 rungs reproduce exactly; `_basic_be`); the LINT — every main method of a building (a merged host's second one had no drift guard) under the first member legal beside it, failing a group with nothing legal, the stop-gap skip gone, three sabotages trip it; the NAME — "Recipe BE" adds the basic secondaries' goods (`basic_secondaries.mjs`); the SHEET (item above) · §10.93 rule 6
- Done 2026-10-03 · CONVEYORS IS A PREREQUISITE OF COMPRESSION IGNITION (user-ruled): `PREREQ_ADDS` in `lib_tier4_spec.mjs` → `make_tier4_techs.mjs` (`vanillaPrereqs` / `prereqsAdded`) → `emit_techs.mjs` patches vanilla's block (throws if vanilla's list moved); the canon's and the arm's tree twins regenerated, proven to differ only by the prerequisite and the stamp; a mandated copy now KEEPS vanilla's technology gate wherever its main method's prerequisite closure implies it (all three do), and `lint_pm_combos` check 7 fails a gate it does not imply (proven both ways). ⚠ Compression Ignition also gates Diesel Engines (motor e3), compression-ignition tractors, five mines' diesel pumps and diesel trains — all now wait on Conveyors too; unmeasured · §10.93 rule 7
- **ACCEPTED for 1.0, revisit in 1.1 (user, 2026-10-21)** · THE MANDATED LOOMS ON THE MERGED TEXTILE BUILDING ARE NOT ENFORCED BY THE ENGINE (run 1 of `20261002_235755`, checked live 2026-10-03): the copy follows the main method in most cases, but 10 yearly snapshots 1913–1926 show one or two levels on Electric Sewing Machines still running the Mechanized Looms copy (Scandinavia, Croatia, Austria — all holding the technology; ~1 of 10–14 such levels): the game does not re-check an already-selected method when the main method changes, so the AI keeps the cheaper one. The other merged buildings' per-method copies never did this (14 families). Options: fold each loom into its main method there (engine-proof, no separate tile) or accept. the batch's other two runs never did; checker `tools/testbed/ledger/mandate_switch.mjs --session <stamp> --detail`. ⚠ F210's economic side ("the always-on loom left the e1 rung relatively cheaper") was WITHDRAWN by F211 §4: the loom costs ~£60–110 a week net against ~£2,700 of frontier profit; the e1 rung survives because the frontier is under-built (see the TEXTILE item below). Folding each loom into its main method would still settle the engine's stale copy · §10.93 rule 5
- **RULING** · TEXTILE'S HOST AT ITS OWN COST — probed (`20261003_111956`, 1 × 1836→1866, F213): book `e1a12-ai1135-tex1140-artmerge` (Sewing Machines host 1,571 → 1,140 points). The frontier builds (77 shortlist levels at 1866 against 3–41) and British clothes fall to 0.75 of base, but the e1 Dye Workshops GROW (179 against 104–133), the frontier's return per point collapses (0.63 against the mines' 1.3–1.8) and misplaced capital rises (24% against 15–20%). Options for the user: a century 2+1 on this book (does e1 die after 1880 at clothes ~0.75?), an intermediate cost (~1,300), or drop the lever · F213, F211 §4
- **RULING** · TEXTILE'S OLD RUNG (the user's vector 1, 2026-10-03: "increase obsolescence for specifically textile"; F211 §4): in the arm the e1 Dye Workshops survive (0.43M shortlist workers at 1935, 1.2× the normal wage, mostly making luxury clothes on Craftsman Sewing) because the frontier is under-built — 192 shortlist levels against the canon's 704 — and clothes sell at ~0.85 of base (canon ~0.70). The frontier returns ~2.0 £/wk per construction point against the mines' 3–4, so under §10.92 that is the AI following profit; the canon's frontier (11-year payback, desire 9,000 / 27,000) was misplaced capital. Levers proposed, none ruled: the merged host's cost (1,571 points = the e2/e3 midpoint, 38% above the canon's e2), a textile-specific penalty on the e1 recipe (closed per-industry ladders, 2026-09-19, would need an exception), or Craftsman Sewing off e1 (a §10.93 table change; not the root cause). NOT a higher desire (it repeats the canon's misplacement) · F211 · §10.92
- **RULING** · THE USA (the user's vector 2, 2026-10-03; F211 §1–§3): on par with vanilla for its first thirty years in every book (the canon is not ahead); in the arm its 1935 shortfall is POPULATION (0.77× vanilla) at 1.45× vanilla's GDP per head — three seeds of five lost the South to an independent Confederacy (vanilla 6/16 by 1900), one also lost GDP per head for good after an 1887 bankruptcy; bankrupt before 1890 in 3/5 seeds (vanilla 3/16, canon 0/6), each after a war. Composition: the arm keeps vanilla's extraction weight (35–41%) where the canon's US shifts to heavy and arms industry. No US-specific economic weakness found; more seeds would say whether 3/5 secessions/bankruptcies is more than luck · F211
- **DEFERRED to mod 1.1 or later (user, 2026-10-21)** · THE CRAFTS CARRY NO SECONDARY LINE (2026-10-11, §10.91.2): under one name, one recipe anchored on the e2 rung (ruled), a 500-worker craft level makes too little for any industry-wide line (Handsewn Clothes would go to −25.6 clothes with Craftsman Sewing), so canning, stills, Craftsman Sewing, luxury furniture and ceramics are gone from every craft — and most of the 1836 map's textile and furniture are crafts. A separately NAMED craft variant would satisfy the rule; unruled. The e2-anchored rule as a whole is UNMEASURED (luxury-goods supply, automation uptake; tooling break-even £0.27–0.33 a laborer a week against vanilla's £0.18–0.23) · `emit_secondaries.mjs`
- **WATCH** · the mandated automations always charge vanilla's automation goods (−£60–460 a level a week at base prices, 2–4% of revenue) — vanilla's own note: Mechanized Looms pays only above £6.9 a laborer a year, Britain's normal rate is £3.2–4.8 · §10.93 rule 5
- Done 2026-10-02 · THE PLAYTEST'S TWO DEFECTS: vanilla-gated Elastics / Precision Tools / Bone China no longer shown on rungs that can never run them; the hard `lint_pm_combos.mjs` (goods + jobs never negative, no dead method, history, the compatibility table, crafts) fatal in every build; merged hosts named "Era 1-2. Paper Mills" · §10.93, BUGS_AND_FIXES 2026-10-02
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
- **DEFERRED to mod 1.1 or later (user, 2026-10-21)** · ARTISANAL OWNERSHIP (shopkeepers as owners, dividends) · ROADMAP step 6½
- **WATCH** · craft ai_value (1,000 a level) — not a lever to pull unasked · §10.91.1
- **WATCH** · the PB arc is tracking-only by ruling (no forced radicalisation, no retargeted 1848 cascade) · F190–F193
- **RESEARCH** · the crafts' channel into early revolutions (Austria's 1840 Springtime) — look for Springtimes before 1843 · F184
- **RESEARCH** · merged-method secondaries not re-selected after a switch; switched chemical plants two-thirds staffed · F182

## B. Balance and the economy

- Done 2026-10-03 · INPUT-PRICE RED FLAGS ARE A STANDING CHECK (user-ruled, BALANCE_FRAMEWORK §10.94): HIGH ≥ 1.70 × base for ≥ 2 years; SWING ≥ 0.5 × base within 3 years on < 10 units a week of supply; any industrially consumed good, local goods excluded; not a loss term. Built: `run_schedule.ps1` adds yearly `market_goods_wide` (1 July, the eleven tags) to EVERY run (`-NoRedFlagFeed` drops it); the reader (`ledger/input_price_flags.mjs`) names each flag's consumers and producers, takes a `--ref` vanilla line, writes the ledger's highlighted verdict card (`fill_ledger.sh` → `__REDFLAGS__`) and the probe readouts' `--md`. ⚠ F212's first reading was CORRECTED (§7): the reader priced no tiered good in a control run — vanilla does raise HIGH flags (0.5 a run), and at the ruled line ~21 SWING a century run (books 23–28) · §10.94 · F212
- **RULING** · whether the SWING line needs tightening or a direction rule: at the ruled thresholds vanilla throws ~21 a century run, and four of the probe's 13 are a lone producer entering or leaving a market (its price falling to the floor — nothing starved by it); the HIGH years are where books and vanilla separate (×5–6) · §10.94 · F212 §7 · F213 addendum
- **RULING** · THE CANON'S STEAM MOTOR RUNG IS BUILT AT A THIRD OF ITS PEERS' DESIRE (F214, answering F212 §4's "why the motor rung is not built"): the steam rung is the same recipe in every four-rung book (40 engines from 36 steel, 800 points; vanilla 40 from 30) and earns vanilla's realised margin (~17%, the engines 15–20% dearer instead), but the canon's e0 label gives it `ai_value` 1,000 against 3,000 on every e1 rung of 1840–1890 — Russian / Dutch steam levels a third to a sixth of vanilla's and the arm's, and the canon's engine HIGH-years 7.7 a run against vanilla's 1.0. Under §10.92 an AI value not following profit; no lever ruled · F214
- **WATCH** · the percussion-cap chain (explosives e0 at 23% and munition e1 at 16% goods margin at base against vanilla's 56% / 39% — the e1 anchor's ×1.2 lift) stays unstaffed in thin markets: 10 of the probe's 13 swings; vanilla has the American case too · F213 addendum
- **WATCH** · THE GERMAN OIL ECONOMY WAITS FOR A BUILT RUNG: in about a third of four-rung seeds (2 of 3 arm, 2 of 6 canon) the German market has no oil economy until 1910–1925 — one idle oil rig, no buyer — where vanilla's always forms by 1905–1910 through free switches (arms to Bolt Action Rifles, ports to Modern Port, logging to chainsaws); in the books those first buyers are rungs to build (arms/artillery e3, automotive e2), and the ports and logging camps switch only once oil is on offer. The design's own cost; whether to act is the user's · F215
- **WATCH** · RUBBER IS STRUCTURALLY SHORT IN A RICH LATE GAME (the user's Qing playtest, 1916–1936): the Qing's electrics, tooling e3 (Rubber Grips) and automotive rungs want 74k → 202k rubber a week against a world output of 9–20k; the world price sits at the 175% ceiling 89% of weeks, and the trade AI's 8-week no-reduction lock turns the gap into a ~9–10-week import cycle (median 88k, up to 128k, then a cut and a week at the price floor). Levers if acted on: rubber supply (plantations / a synthetic route), the rungs' rubber inputs, rubber's traded quantity (24, vanilla 5) · F242
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
- **NOW** · THE LAST TECH REWORK of the artmerge arm (user, 2026-10-10): world back onto vanilla's total volumes (F222: world GDP median 1.30, the jex book 1.09; F219: the leader overshoots the anchor principle in game eras 4–5) and the research journal entries more important — the research model built (F223), candidate A (cap literacy term 150 → 50, universities × 0.5) probed 3 × 1836→1900 (F224: majors on vanilla's counts, GDP not lowered), continued to 1936 and stitched (F225: technology on vanilla's pace to 1936, world GDP 1.48, all three broken by runoff — the book's late GDP excess is not its tech lead; superseded as a design by §10.97); deployed for the user's eyeballing as `mod_playtest_ra/` · ROADMAP step 14, §10.96, F219, F222, F223, F224
- **NOW** · THE §10.98 ENTRIES (the weak option: ships, frontline, contagious ideas, tropical empire, civilizing mission, state apparatus, universities, finance, cities, antibiotics) — BUILT AND MEASURED (F227: the book jex-dam4s-rs, 2 intact / 1 runoff at world GDP 1.04 / 1.09 / 1.45, consensus loss 5.37 — the best research book; majors 0.97 of vanilla's technology, the leader on the anchor principle 45 / 38.5 / 50%; society on vanilla's count, military still ~10 behind; play ×1.005). CANONISED 2026-10-12 (§10.99); the revolt duplicate-placement noise FIXED in the emitter the same day (no placement in a revolutionary country). Open: the runoff tail, military research, tech spread ×2 (deferred) · §10.98, §10.99, F227
- **NOW** · THE RESEARCH ENTRIES REWORKED — BUILT AND MEASURED (F226: the book jex-dam4s-rb, 3/3 intact, world GDP 1.00, play ×1.02; production technology ahead of vanilla, military/society 10–12 behind, the leader at 7.7% of game era 4 at 1905 against ~half): the next lever — tech spread ×2 (pre-agreed), or restoring military/society research — is the user's call. Was: THE RESEARCH ENTRIES REWORKED (user, 2026-10-11): sources do not add up; industry stages 36 months; 20 stages (Inception, Development, Implementation 1–18) to pay off the ahead-of-time penalty with time; literacy 25/35/45/55/65% by game era for industry entries (pause, not block; war/naval exempt); mark halved once a non-isolationist country holds the technology, for non-isolationist entry countries only; research halved (base innovation and cap 25, cap literacy term 25, universities stay ×0.5 of vanilla); AI school levers to probe; society/spread deferred. Probes after the concurrent session reports · §10.97
- **RULED 2026-10-21 (POLISH_1_0.md Q1): ×1/3 on Philips, Advanced Research III, Cuba and the expedition; the event grants are Q2**  · NERF THE OTHER INNOVATION-CAP SOURCES to match the cap cut (user, 2026-10-11): the Philips company's prosperity bonus `country_weekly_innovation_max_add = 15` (+ `country_weekly_innovation_mult` 0.05; `common/company_types/00_companies_europe.txt` ~L360 — a file `emit_companies.mjs` already owns whole) and the Advanced Research III power-bloc principle's `country_weekly_innovation_max_add = 5` per schools level (`common/power_bloc_principles/00_power_bloc_principles.txt` ~L385, not owned yet). Both are flat cap adds sized against vanilla's 50 + 150 × literacy, so under A they are worth ~3× as much. The size of the nerf is not ruled (proportional to the literacy term would be ×1/3: 15 → 5, 5 → ~1.7); `emit_research_levers.mjs` is the natural home · §10.96
- **DONE → superseded by the item above** · the extra research entries (25 production technologies outside the tier ladder + the era-1 skip lifted for lathe, distillation, steelworking; shift work and pumpjacks dropped) — built as `e1a12-ai1135-tex1140-jex-artmerge`, measured by `20261005_154629_jex-n16` — STOPPED BY THE USER AT n=8 (2026-10-06); the NEXT BATCH reruns the same config with different telemetry and the report reads both together (HANDOVER); then, per the user, nerf ordinary research if the tree runs ahead (ruling owed: uniform or weighted to game eras 4–5) · BALANCE_FRAMEWORK §10.95, ROADMAP step 2
- **RESEARCH** · F162's anomalies (Spain's intensive_agriculture, Ecuador's and Alwar's aniline) · F162
- **RESEARCH** · ai_weight depth *(verify — likely moot since `tech_ai_weight_mult`)* · ROADMAP step 1

## D. AI, construction, companies, dams

- **DEFERRED to mod 1.1 on game 1.15.N (user-ruled 2026-10-19: "We'll wait for a promised significant AI decision making rework in 1.14")** ·
TREATY PORTS — the funnel as measured on 1.13 and a five-layer solution, all built and probed, none in the canon: A eligibility (our candidate check +
a level-1 port seeded on cession; the override alone is harmful), B the AI's desire (×4, book `…-wm99-tpd4`), C pursuit (C1 the yearly driver,
measured, the user against it; C2 an organic driver from the engine's own stances, designed not built; C3 the 1.15 AI itself), D the trade-centre gate
in script (no cost, no effect — keep off), E the readers. Open on 1.15: whether the AI pursues recognised hosts by itself, the never-added rule
(`skip_build_list` untested), why ports in recognised markets build no trade capacity · BALANCE_FRAMEWORK §10.103 (the plan for 1.15.N), F243–F246
- **OPEN** · company mandates first cut shipped and unmeasured (the company-held rung mix) · ROADMAP step 5
- **RULING** · the capital-export arm (FDI factor) — measured, not adopted · F179
- **OPEN** · the dam level cap with SEVERAL foreign builders on one site: counted on the region total (as intended) or per builder? Read with the contest probe (`dams.probe.contest`, `probe_q` above the cap) · BUGS_AND_FIXES 2026-10-05
- **DONE 2026-10-21 (POLISH_1_0.md Q6): KEPT** · dam consumers' recipes (power plant at 4× cost ships) — the §10.89.1 signal (electricity at the ceiling by ~1920) did not fire on F247 · ROADMAP step 6
- **OPEN** · dam survey concurrency: a spare check + a "just surveyed" variable · F176
- **RESEARCH** · dams' effect on GDP and the stall/runoff tails; what sets the dam count; privatisation in some countries · F175–F177
- **RULING** · dams under laissez-faire: dams are government-built only (`can_build_private = { always = no }`, a design ruling, no engine requirement on record), so a host whose government barely builds never builds its surveyed sites — laissez-faire hosts 0 of 6 in F239 (run 3's Britain surveyed both Scottish sites in 1911–12, built neither). Options: open private construction everywhere, or only where the host's government barely builds. ✅ BUILT AND PROBED (F240): `dams.private` = `all` / `laissez_faire` in emit_dams — the private route builds, the survey gate held 30 of 30, the laissez-faire variant builds privately only in laissez-faire hosts; opened everywhere, private capital pre-empts the government route and financial districts own the dams. ✅ RULED AND CANONIZED 2026-10-16 (`all`, the canon `jex-dam4s-rs-x25-dpriv`, then `-m10ac-dpriv`); OPEN: a century measurement of the canon with it · F239, F240, §10.89.14

## E. Engine compatibility (vanilla references our split breaks)

⭐⭐ **THE MAIN PART OF THE 1.0 POLISH (user, 2026-10-19: "That's the main part of the polish")** — one strategic pass making every rung count as
its vanilla building wherever vanilla script checks a building or a method; it is NOT treaty-port related and is not deferred.

- **RULING (1.0 polish)** · ⭐ AUDITED 2026-10-21: 86 script blocks (22 dead, 49 narrowed to rung 0, 5 changed meaning) + ~48 rung-0-only throughput modifiers; one generator `emit_vanilla_refs.mjs` proposed, four rulings asked (R2.1–R2.4); covers the three lines below · POLISH_1_0.md §2, TIER_REFERENCE_AUDIT.md
- **NOW (1.0 polish)** · MISSING_PM_REFERENCES.md — ~28 vanilla events/JEs checking a relocated main PM; one strategic "tiers are eligible" pass (the catalogue is STALE — TIER_REFERENCE_AUDIT.md supersedes it) · MISSING_PM_REFERENCES.md
- **NOW (1.0 polish)** · the same class for SECONDARY methods, which the audit does not cover: a per-rung copy renames the vanilla method, so e.g. `production_tech_events.210` (radio progress) needs `pm_radios` active and can never fire · ROADMAP step 2 coverage audit
- **NOW (1.0 polish)** · `has_building` narrowing (457 refs match tier 1 only) — the same pass · CLAUDE.md
- **NOW (1.0 polish)** · MISSING_BUILDING_CONDITIONS.md — the art academy's conditional ai_value (1 case) · MISSING_BUILDING_CONDITIONS.md

## F. UI and tooling

- **OPEN** · collapse `builder.html`'s copy of `econ.js` (~260 lines; change both or neither until then) · CLAUDE.md
- **OPEN** · the tech-tree page (`ui/techdata.js`) still shows the six-rung candidates · CLAUDE.md
- **DONE 2026-10-21** · research-entry texts uniform and in LEVELS (the user ruled levels, not people), and every condition a line of the bar tooltip · BUGS_AND_FIXES 2026-10-21
- **OPEN** · the ledger fill scripts' hardcoded session paths (`--session` flag) · CLAUDE.md
- **DEFECT** · `fill_consts.mjs`'s "productive workers" subtracts a levels-scale staffing (held: moving it restates a shipped number) · CLAUDE.md
- **DEFECT** · `deviates_from_vanilla` is a six-path probe list; it should walk the built mod · ROADMAP DEFERRED FIXES
- **DEFECT** · the binary save reader is trusted only below ~104 MB (per-market pops, per-state local supply) · CLAUDE.md
- **RULING** · THE RED-FLAG HEADLINE'S TWO THRESHOLDS (2026-10-08, BALANCE_FRAMEWORK §10.94 rule 9): a problem year counts a HIGH flag only on ≥ 10 units/wk of building demand, and a market is chronic at ≥ 20 problem years — both proposed (the user's own sketch, any-market years and ≥ 5 of 99 two-year windows, saturates at 96/100 and 8/8 on jex n=16) · `lib_redflag_metrics.mjs`
- **OPEN** · a vanilla batch with the yearly order-book feed (`market_goods_wide`, on by default since 2026-10-03) — until one exists the red-flag headline has no vanilla twin on the order books, only on the summaries · §10.94 rule 9
- Done 2026-10-08 · THE GOAL TABLE RE-GRADED AGAINST THE RULED CRITERIA (G1 the unit-weighted below-best share against the canon family, < 35% ok; G2 e0 and e1 falling; G3 1880–1935 construction over all runs + payback warn 6–8 y; G4/G5 the register's end-state bands and W per head; G7 the era rule's anchors in a majority format (eras listed until 50% of tier workers); P over clusters 1 + 2, yellow edge = the +10% budget) · `fill_goals.mjs`, ledger README
- **RULING** · THE GOAL TABLE'S ROW SET (proposed 2026-10-08, not implemented): (b) a G8 "capital goes where it pays" on misplaced capital (F207, §10.92; vanilla's 17% 1926–36 as the yardstick; needs `misplaced_capital.mjs --json` in the fill); (c) a second G7 term, the tech leader's share of game-era 3/4/5 technologies at 1875 / 1905 / 1935 (the anchor principle's own definition, `tech_census.mjs` D); (d) a price row on PI / PP, the "prices must not be flat" goal. (a), G1 on a trade reading, was declined: G1 measures obsolescence through below-best builds · `fill_goals.mjs`
- **DEFECT** · `fill_research.mjs` reads the RETIRED six-rung tree (`config/tech_tree_options.canon_n7.json`) for every book, so the report's technologies-held-by-era table is on the wrong eras for four-rung books; and its vanilla runs are the old pinned n=4 · `fill_research.mjs`
- **OPEN** · copy the redone jex n=16 report (artifact BjmxoKZjkYL6fUypJd5XPf v5) and its full red-flag listing (KdPDv6wH1hb77iJ9GNBtdX) into `20261006_193418_jex-n8-v16` on the machine — the 2026-10-08 redo ran in a cloud session without the session folder; a fresh `fill_ledger.sh` there writes redflags.json and the summary-basis column too

## G. Testbed instrument (TESTBED_LANDMINES)

- **DEFECT** · `hiring_census.mjs` / `craft_fill.mjs` (and F185/F188's prose) name `BUILDING_MAX_PROFIT_TO_PAUSE_HIRES` as the rule behind the
  PAUSED-hiring class, but the 1.13.11 engine does not read that define (FINDINGS F241's dead-define list). Its define registry holds only
  `BUILDING_MIN_EMPLOYMENT_FRACTION_TO_PAUSE_HIRES` and `BUILDING_PAUSE_HIRES_CASH_RESERVES_THRESHOLD` — no profit threshold for pausing hires.
  Re-establish the rule from the engine's behaviour (a hardcoded profit test is possible) or relabel the class
- **RESEARCH** · the world-market monopoly markup is real (F241 addendum): world price × (1 + 0.2 × the top exporter market's share) on EVERY traded good (the
  default threshold is below 0.36); removing it (`NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD` 0.99) drops the price for ~2 weeks and cuts the leader's exports of
  the freed goods ~6–9% while importers take ~4–11% more for the first two months. Open: what it does over decades (old-rung survival abroad), and the default threshold's exact value

- **OPEN** · L37 the stop watcher goes blind on a multi-setup schedule
- **OPEN** · detectors owed: L19 orphaned game process, L23 raw-counted repeated log lines, L11 wrong/nonexistent tag, L9 per-run error windows
- **OPEN** · live proofs owed: quarantined-save resume hooks, L29 scheduler abort, L34 fresh-start restart
- **OPEN** · L30: a resume mode after a machine reboot
- **OPEN** · the perf report (`report_perf.mjs`, the ledger's row P) shows the wall clock FACTORISED as diverging branches (ruled 2026-10-06: the
  normal branch, the share of runs with a slowdown episode and its cost, each against vanilla — `ledger/slow_episodes.mjs`), applies the
  fleet-loop disqualification (`ledger/fleet_loop_runs.mjs`) and puts `ledger/machine_load.mjs` beside it. ✅ The scheduler half is DONE
  (2026-10-06 evening): `run_schedule.ps1` starts `machine_monitor.ps1` for every session (`-NoMachineMonitor` opts out)
- **RULING** · THE FIXES MEASURED (FINDINGS **F221**, 2026-10-09, 39 runs, every combination n=3): dams as four resource-capped types
  (`dams.layout = resource4`) −2.3 s/yr and script-placed research entries (`research_events.placement = script`) −1.2 s/yr, additive —
  together ~70% of the gap to vanilla; two 3-year stages and one entry per industry add nothing. ✅ The classes are RULED (2026-10-09,
  BALANCE_FRAMEWORK §10.89.13: 300/600 electricity, ≤ 5-year builds, cheap 1.5× cheaper, < 150 electricity dropped bar Aswan and Sennar);
  ✅ MEASURED over a century (FINDINGS **F222**, n=4, `jex-dam4s`): play time ×1.036 of vanilla (the jex book ×1.14), 0 dam slot breaches,
  research unchanged. ✅ The dam staffing is at the historical level since 2026-10-10 (10 / 15 / 10 per 50 electricity, §10.89.13).
  ✅ IN THE ARTMERGE ARM since 2026-10-10 (user-ruled: "almost certainly this becomes our standard") — the arm's book is `jex-dam4s`.
  ✅ The player's shift-click queue path PASSED the hand test (user, 2026-10-10: one dam queued correctly; build
  `mod_playtest_dam4s_damtest/`, still deployed) · F221, F222
- **DEFERRED** · a return to the pre-artmerge canon must REIMPLEMENT the two tick-cost fixes (resource-slot dam classes re-fitted to its
  projects, script-placed research entries) — the canon carries neither (user, 2026-10-10) · BALANCE_FRAMEWORK §10.89.13
- **RULING** · F222's open question: the jex-dam4s world ends richer (world GDP median 1.30, 2 of 4 runs broken by runoff, no consensus)
  with no mechanism found — more runs of the book, or the pair split over a century, would tell the change from the seeds; and whether the
  pair rides on the next canonised book · F222
- **RULING** · the early-game tick overhead (+6.5 s per in-game year, +12%, 1836–40) is LOCALISED (FINDINGS **F220**, 2026-10-09): not the
  tier structure (+0.6 ± 0.8) but the research journal entries (~3 s/yr: 68 first-stage types carrying `is_shown_when_inactive` priced monthly
  in every country, and the active stage-2/3 entries) and the dams (~2–3: 144 unbuilt building types by count, 144 level caps on every
  country). Fix candidates, none ruled: one entry type per technology (stages by variable) or a script-placed first stage; the caps only on
  dam-technology holders (`dams.static_mode = country_modifier_tech`, built); fewer dam building types · F220, MODDING_NOTES → *What script
  content costs the tick*
- **WATCH** · slowdown EPISODES — EXPLAINED 2026-10-06 (FINDINGS **F218**): 23 episodes in 22 of 291 century runs (vanilla 2 of 31). Most are a
  LONE SHIP RECALLED FOR REPAIRS whose travel path the engine keeps appending to for decades (run 3 of 20261005_154629: two US torpedo boats,
  4.5k moves each, 1882/1887 → reset 1903-11-22; confirmed again on a Siamese loop at 1936) — VANILLA behaviour, as common in vanilla's
  endpoints (3 of 30) as in the mod's (14 of 258); signature = hour 0 + one other sub-tick of the day rising together, then dropping within days.
  The all-sub-tick ones are long great-power wars (end at the peace); canon-dams-v2-n1's 28-day pulse stays unexplained (retired book). Run 6's
  1890–1897 episode has the fleet-loop shape (memory a bystander). ⭐ RULED LATER THE SAME DAY: a run with a FLEET-LOOP episode is
  DISQUALIFIED for wall clock (whole run, config and vanilla alike, wall clock only; the share disqualified is reported per config); every
  other slowdown stays — `ledger/fleet_loop_runs.mjs`. Diagnose with `ledger/tick_profile.mjs` (the run's log) and `ledger/fleet_loops.mjs`
  (a kept save)
- **OPEN** *(after 20261005_154629 ends)* · wire the fleet-loop disqualification into `report_perf.mjs` / the ledger's row P (today: pass
  `fleet_loop_runs.mjs --dirs` output by hand) and show the share disqualified in the verdict table
- **WATCH** · the jex book 20261005_154629 had fleet loops in 3 of its first 6 runs (corpus ~8% of mod runs, its base tex1140 0 of 5; ~1% by
  chance): if it holds, the extra research entries may raise the loop rate — a mod cost the exclusion would hide
- **RESEARCH** · whether the hour-12 / hour-18 / hour-0-only episodes are fleet loops too — PARTLY ANSWERED 2026-10-06 (F218 §8, every kept
  save scanned): the sub-tick follows the owner's id mod 4 as ≡1 → 6, ≡0 → 12, ≡2 → hour 0 alone, ≡3 → 18 (presumed); an hour-12 episode is
  save-confirmed (Bulgaria); 3 of the 21 disqualified runs have a save inside them, the other 17 are by shape. Still: copy a save by hand into
  `diag_saves/` the next time an hour-18 episode forms mid-batch
- **OPEN** *(after the next n=8+ batch — user-ruled 2026-10-06: collect first, analyse later)* · VERIFY the fleet-loop label. ✅ The MEASUREMENT
  is in: save summary **v16** (2026-10-06) records every country's formations and path sums, by owner bucket, and the ≤ 40 worst paths (owner +
  id, recall flag, typed target, moves, length, distinct nodes, ships). Still to do: correlate per run-year the per-bucket path load (Σ moves,
  Σ (length/1000)², loops) with the sub-tick leads of `tick_profile.mjs`, then make `fleet_loop_runs.mjs` require a recalled loop whose owner
  maps to the flagged sub-tick during the streak and label the rest UNVERIFIED (F218 §8.6). Until then nothing checks the label
- **MANUAL** · L3 unbounded scopes, L10 mid-batch edits (no detector possible); L4 advisory
- **PARKED** *(verify)* · three-arm runs 4–6, autosave-cadence experiment, concentration metric, tick-speed regression; do empty pop records cost tick time · ROADMAP "Parked"

## H. Polish and release (ROADMAP step 7)

⭐ **THE 1.0 POLISH REGISTER IS `POLISH_1_0.md`** (2026-10-21): every polish item with its status (DONE / RULING / READY / VERIFY), the order
(script and economics before the alternating batch, text and art after), and two appendices — the sweep of everything deferred to polishing
and an independent hunt over the generated mod and six canon century runs' error logs. The lines below are its headline items.

- **OPEN** · release metadata (version 0.1.0, the "(built …)" name stamp, short description), thumbnail, LICENSE, a player README · POLISH_1_0.md R1–R3, H9
- **DONE 2026-10-21** · non-English players see vanilla's own translations of the tiered buildings' and methods' names · POLISH_1_0.md H1
- **DONE 2026-10-21** · crafts no longer show method groups whose only option is "off" (lint_pm_combos check 8 guards it) · POLISH_1_0.md H2
- **DONE 2026-10-21** · the generated-text pass (research, dams, company names, config labels): uniform style, current design, no internals · POLISH_1_0.md "Text pass"
- **DONE 2026-10-21** · dam build tooltips: checked in game, no per-project list renders (U4 closed) · POLISH_1_0.md H3
- **OPEN** · per-tier building artwork; per-technology icons (one placeholder ships)
- **DONE 2026-10-21** · era band dividers in the tech-tree GUI: checked in game, they line up (no fix) · POLISH_1_0.md R7
- **OPEN** · proofread every new technology name and description
- **OPEN** · release

## Done (recent; prune freely)
- Done 2026-10-11 · MERGED BUILDINGS CARRY ONE SET OF SECONDARIES, EVERY RUNG TAKES VANILLA'S TOP-METHOD SHARE, AUTOMATION INPUTS SCALE (user-ruled; `top` rule in `emit_secondaries.mjs`, on for every `_merge`/`_artisan` book; the canon builds byte for byte as before). Two combinations forbidden: Elastics beside Sewing Machines, Precision Tools beside Mechanized Workshops. It also resolves the Bakeries' Pot stills / canners reference mismatch and canning losing value beside Sweeteners. Plus: `make_research_levers_config.mjs` drops an inherited `dams.staff_per_50` pin, so the 10/15/10 dam staffing is in every artmerge book onward · BALANCE_FRAMEWORK §10.91.2
- Done 2026-10-11 · THE MERGED HOSTS' SECONDARY COPIES WERE UNSELECTABLE (the playtest of mod_playtest_ra: Pot Stills off but never on, no jars, no luxury lines on the Era 1-2 food, textile and furniture buildings). `is_hidden_when_unavailable` on a main-method-gated copy blocks selection; isolated in the user's game with Bone China and Precision Tools. The flag is removed and copies are named after their main method ("Cannery (Baking Powder)"); built as `mod_ra_named`, not deployed · BUGS_AND_FIXES 2026-10-11

- 2026-10-05 · the dam level cap moved to the engine's `has_max_level`, carried by `base_values` on every country (a shift+click had queued five levels past the scripted cap; a state-trait carrier blocked every foreign builder); the user verified in game that a shift+click stops at the cap for owners and foreign builders alike · BUGS_AND_FIXES 2026-10-05
- 2026-10-01 · `artmerge6-pb` century n=3 read · F194

- 2026-10-01 · save summary v13/v14: IG clout and IG members by workplace (`ig_clout.mjs`, `ig_pop_contrib.mjs`, `ig_workplace_series.mjs`) · F190, F192, F193
- 2026-10-01 · craft staffing → 30% shopkeepers / 70% laborers, four craft outputs raised; 10-year probe healthy · §10.91.4, F191
