# HANDOVER — next session

Written 2026-08-12. **Three tasks, in this order** (user-set). Everything else in this file is the
context needed to do them; the durable records are `FINDINGS.md`, `ROADMAP.md`, `BALANCE_FRAMEWORK.md`,
`TESTBED_LANDMINES.md` and `BUGS_AND_FIXES.md`.

---

## 1. THE TECH TREE BECOMES A VISIBLE UI PAGE

`ui/techtree.html` exists and works — era as a row, progression downward, **columns are industries** so an
industry's ladder reads as one vertical line, hover names what blocks a technology and what it blocks,
switchable between the three trees and the three options, with the tech-spread panel. It is currently
**standalone**, opened off the filesystem, reading the generated `ui/techdata.js`.

**The task:** make it the balance UI's second vertical page, as `ROADMAP` step 1 always intended. The
balance sheet and the tree are two views of one config and should not need two windows.

⚠ It must be reachable from `balance-ui.cmd` **and** survive `tools/bundle_ui.mjs` into the standalone
snapshot — the snapshot is the only view available away from this machine, and `bundle_ui.mjs` FAILS the
build if `builder.html` loads a `<script src>` not on its INLINE/OMIT lists, so `techdata.js` has to be
added there deliberately.

⚠ **Unrelated but visible in-game right now:** the tech tree panel's era band dividers are hardcoded pixel
strips in `gui/tech_tree.gui` (production at y = −100 / 2200 / 4060). Our production tree is 92
technologies against vanilla's 57, so everything sinks below the last strip and the game shows one lonely
era-4 technology and "several dozen" era-5 ones. **The data is correct** — era 1:15 · 2:14 · 3:20 · 4:23 ·
5:20 — it is purely the drawn bands. Fixing it means owning a vanilla `gui/` file (no partial overrides
outside `common/defines`), so it is step-7 work, not this task. Do not let a bug report on it derail the
page work.

---

## 2. DECIDE THE CAPITAL COST LADDER FOR THE NEW TIERS

**There is clearly an overabundance of capital, and the ladder is not being climbed.** This is the
session's central finding and the reason build cost moves up the queue.

### What the run showed

- **Investment pool 3.75bn → 8.46bn (+126%)** while GDP rose 22% and building levels 26%. The top ten
  hold **85.5%** of it. Per hoarder it is **2.4×–4.9× their own annual GDP** (GER 3.37, HUN 3.53,
  BEL 4.18, TIB 4.94) against 1.4–1.8× in the previous build.
- **The pool is not being fed faster** — owner profit per level FELL (547 → 469) and total owner profit
  is nearly flat (+9%). It is not draining.
- **Only 38% of the ladder is realised.** Mean output per built level is 82.7 against 220.5 if every
  level were era 5. At 1936, with the leaders holding *all* of era 5: world levels are
  **e0 12% · e1 19% · e2 23% · e3 26% · e4 16% · e5 4%**. Britain researched every era-5 production
  technology and stands on era-5 buildings for **6.5%** of its levels.
- **The old rung is never displaced.** GBR tooling: e2 holds ~40% of levels continuously from 1887 to
  1936 while e3 arrives and settles beside it at ~40%. Steel reaches e5 only in 1927, at ~10%. Steel is
  an e4/e5 near-tie **despite e5 being twice as profitable**.
- **Real output did not rise.** Total supply at base prices, 1936: British market 29.1M against vanilla's
  46.9M; American 30.3M against 34.2M. ⚠ Weak comparison — see the caveats in task 3.

### The design reading

Every modernisation is a **new building**, not a free production-method switch. That is the mod's whole
point, and it is working in the sense that capital is demanded — but the charge is evidently high enough,
or the incentive weak enough, that the AI mostly declines to pay it, and the capital piles up unspent.

⚠⚠ **AND THE WORKFORCE IS THE BINDING CONSTRAINT, NOT THE CAPITAL.** The pool "barely builds due to lack
of workforce" is a visible in-game indication. Peasants + unemployed as a share of workforce
(dependents excluded) fall below 5% at:

| GER | AUS | GBR | TUR | RUS | USA | JAP | FRA | CHI |
|---|---|---|---|---|---|---|---|---|
| **1889** | 1895 | **1898** | **1898** | **1910** | 1919 | 1920 | 1926 | never (57.6% at 1936) |

It collapses fast once it turns — Germany 34.4% (1873) → 17.0% (1882) → 0.7% (1891). **So a cost change
that only bites after 1900 arrives too late for every major except France, Japan and the USA.** Aim it
at the 1860s–80s.

⭐ **USER RULING, and it governs this task:** *we should not reach full employment under natural
circumstances — the game mechanics break in that case.* Depeasantation should be barely possible, except
perhaps for Benelux. Today it is total: world peasants 208.8M → 101.2M, and nine of the ten pool hoarders
sit at ~0% slack.
⭐ **AND AN OPEN QUESTION THE USER FLAGGED AS VERY IMPORTANT:** when there *is* spare workforce, is the
newer, better building much more likely to be built than the older one? This must be checked. The natural
control already exists in the data — China never drops below 57.6% slack, so its level distribution
against Britain's is the with-labour / without-labour comparison, at no game-time cost.

### What is NOT the cause (measured and rejected this session)

- Not the 1.13.10 railway fix — railways grew **+39%**, not fewer.
- Not persistent margins — profit per level **fell** 601 → 479.
- Not a labour ceiling capping a high-productivity economy — our per-worker ceiling is ~2.4× vanilla's
  (ladder ×5.9 vs vanilla's median ×2.50 bottom-to-top), so exhausted labour cannot explain *lower*
  output. The ladder simply is not climbed.

### Inputs you already have

`build_era_ladder.mjs` holds employment flat at ~5000/level across every era (18 of 21 industries ×1.00)
while output goes ×1.5 per rung — `BALANCE_FRAMEWORK` §8 never put employment on the ladder. That is
deliberate and the user **wants** exploding productivity, so the lever here is **build cost**, not
employment. `solve_building_cost.ps1` currently derives cost from a 10-year-payback model and has been
run for all 106 tiers.

---

## 3. THE RUN: n=2 VANILLA + n=1 NEW MOD VERSION

**Cost to quote: 3 runs × 1836→1936. Budget ~3h–3h50 each on current timings, so ~10 hours.**

⚠⚠ **THE VANILLA ARM MUST CARRY THE SAME METRICS AS THE MOD ARM.** This is the single most valuable thing
the next batch can do, and it has never been done: **every vanilla session in the repo predates the
savegame harvest (2026-08-11) and has ZERO save summaries.** There is therefore no vanilla baseline for
GDP, building levels, workforce composition, treasuries, investment pools, trade or technology
distribution — every comparison in this session had to be mod-versus-mod.

Use the metric set from `tools/testbed/schedules/era6_n1.json` — `country_state`, `population`,
`tech_log`, `building_inventory`, `treasury`, `events` — with the save harvest ON (it is the default).
Adding `market_goods_scoped` as well would let `verify_save_alignment.mjs` check `goods_out` against
`production` for the first time; the two have never been cross-validated and task 2's real-output
comparison leans on them agreeing.

**Three questions this batch settles that nothing else can:**
1. **Is the slowdown ours or the patch's?** ⭐ There is now a specific prediction: it is **ours**. Pop
   records ran **+43% by 1910** against the previous build and the speed gap tracks it almost exactly
   (1/1.43 = 0.70 vs a measured 0.61). Our ladder holds six rungs of one industry simultaneously, and a
   pop's identity includes its workplace, so the workforce fragments. **If vanilla-on-1.13.10 comes back
   near vanilla-on-1.13.9's times, the hotfix is exonerated and the cost is ours.**
2. **Total supply at base prices, mod vs vanilla, same instrument, same version.** The current answer
   (mod ≤ vanilla) rests on unmatched market membership, one vanilla run, and two different instruments.
3. **The GDP premise.** *"After 1836 only GDP needs to stay near vanilla."* Nobody has ever checked it
   against a vanilla 1936.

⚠ **1.13.10 vs 1.13.9 is a real confound for anything compared across today.** The game updated between
the two sessions of 2026-08-12. Three of that hotfix's changes touch quantities this mod is calibrated
against: private investment no longer endlessly expands unprofitable railways; shipyard wages are no
longer paid twice; a single-good shortage now lowers organisation instead of draining supply.

### Before launching, the hard rules that cost time today

- **Smoke-check at ~5 minutes** (now a hard rule in `CLAUDE.md`): init marker in `debug.log`, game-version
  line, errors filtered to *this run's own window*, clock advancing. ⚠ `mod_loaded=False` in the harness
  summary is **not** authoritative — it read False on a run whose marker was plainly present. ⚠ And the
  version-mismatch line may be a **stale ring entry from a previous run** — check its timestamp.
- **Launch into its own window** so the p/r/s/x keys survive, and pair it with `wait_for_session.ps1` in
  the background.
- `tools/testbed/STOP` is the stop channel for a headless launch (`run_observer.ps1` reads it).

---

## STATE OF THE REPO AS HANDED OVER

- **`config/mod_config.json` IS the 106-tier ladder.** Merged, `building_cost` solved for all 106, the
  `.era6` side files deleted. Build is green: LINT / MOD CHECKS / PREFLIGHT, and deployed.
- **Every tier is gated** (54 new technologies), **every technology covered by journal entries** (138
  covered, 414 entries), **every rung requires the rung below it** (84/84 chained).
- **Landmine L14 added and its tripwire proven** — a country starting with a building its own
  technologies cannot unlock. It compares against vanilla rather than demanding zero, because vanilla
  itself fails on six countries.
- **L13 is MASKED, not fixed.** Dropping the invented ~1700 rungs restored the vanilla key to slot 0, so
  the 1836 start re-tiers correctly again (block counts and ownership levels match vanilla exactly, 2954
  and 8224) — but `Get-SplitMaps` still keys on `tiers[0]` and breaks the day anyone mints a new first
  rung.
- **Save summaries are schema v4**: they now record the **game rules**, `pop_consolidation` included.
  ⚠ Every run before 2026-08-12 was guaranteed `moderate_consolidation`; both sessions of that day were
  verified byte-identical across all fifteen rules. Trying `aggressive_consolidation` is a future
  experiment — it is the player's own fidelity-versus-performance dial and would separate pop-record cost
  from everything else, with no rebuild needed.
- **1.13.10 handled**: metadata bumped, everything re-derived, zero drift in the vanilla data we consume,
  and the per-country 1836 starting-technology check is now a tool (`verify_start_techs.mjs`).

## OPEN, NOT SCHEDULED

- `deviates_from_vanilla` in `build_state.json` names 5 of the 13 directories an arm carries — a
  hardcoded probe list that never grew. `arm` is derived from it, so a control carrying an unprobed
  directory records as a clean `control`. **L7 is unaffected** (it walks the mod itself). ROADMAP →
  *Deferred fixes*.
- `world.buildings` in a save summary is a structure, not a scalar, so building count cannot be compared
  on the same footing as pop objects without a reader change.
- `config/measured_1836.json` has **not** been regenerated against 1.13.10 — it needs its own instrumented
  session, and 1.13.10 changed shipyard wages.
- Drop steel's era-1 rung (ROADMAP → *Deferred fixes*); it is `ERA_PRUNE`d from scenarios meanwhile.
