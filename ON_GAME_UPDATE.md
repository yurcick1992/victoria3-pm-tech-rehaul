# On a Victoria 3 game update

This mod is **generated from the live vanilla files** (buildings, recipes, prices, 1836 start). A
Paradox patch can change any of those out from under it. This doc is the running checklist of
**everything version-sensitive** — what to re-run, what to eyeball, and how drift shows up. Add to it
whenever we discover a new coupling to vanilla.

Currently built against **game version 1.13.9 "Matcha"** (see `mod/.metadata/metadata.json`
→ `supported_game_version`).

---

## TL;DR — the update routine

```
# 1. point at the game if it isn't the default Steam path
$env:VIC3_GAME = "C:\path\to\Victoria 3\game"     # optional; default is the Steam location

# 2. re-derive numbers from the CURRENT vanilla data, then build
powershell -ExecutionPolicy Bypass -File tools\solve_be_targets.ps1 -Write   # target_be from each tech's era
powershell -ExecutionPolicy Bypass -File tools\solve_volumes.ps1
powershell -ExecutionPolicy Bypass -File tools\solve_building_cost.ps1
powershell -ExecutionPolicy Bypass -File tools\build.ps1        # regen + convert 1836 start + lint + deploy
```

`build.ps1` must end with **LINT PASSED** and **MOD CHECKS PASSED**. Then do the **manual checks**
below (they are *not* automated), load a game, and read `error.log` (see `MODDING_NOTES.md`).

Tip: dry-run first (`build.ps1 -DryRun`) to validate a patch without touching the deployed `mod/`.

---

## Automated — re-derived from the game each run

These read vanilla live, so re-running the solvers + builder picks up the patch automatically. You
still must **run** them; they don't run themselves.

| What | Reads from vanilla | Tool | Notes |
|---|---|---|---|
| Tier **BE targets** (`target_be`) + `natural_year` | `common/technology/technologies/*.txt` (each tier's `tech` → `era`) | `solve_be_targets.ps1 -Write` | Era anchors 125/100/75/50/35 (e1–e5) − 15pp H1 manufactured-input adjustment. Run **before** `solve_volumes`. If a patch moves a tech's `era`, its tier's target shifts. |
| Tier output/input **volumes** | **all** `common/production_methods/*.txt` (each tier's `vanilla_pm`; reads every file so power/port/railway PMs in `06`/`11` resolve) | `solve_volumes.ps1` | Re-solves inputs to hit `target_be`; skips `follows_be:false` industries (ports/railways stay vanilla). |
| Tier **building_cost** (£/point) | `common/production_methods/13_construction.txt` → `pm_iron_frame_buildings` | `solve_building_cost.ps1` | £/point = Σ(goods_input×price) ÷ `country_construction_add`. Today **£3600/wk ÷ 5 = £720/pt**. |
| **production_methods** files (whole-file replace, ALL) | **every** `common/production_methods/*.txt` | `build.ps1` | Owns them all so any PM's goods can be edited without owning building files (buildings reference PMs by key). Two surgical transforms, verbatim otherwise: (1) **gate remap** — append our tier `pm_key` to `unlocking_production_methods` lists referencing a split main PM (bone china / elastics / precision tools); (2) **goods override** — overwrite `goods_input/output_*_add` for any PM in the config `pm_goods` map. Modifiers/employment/effects untouched. New vanilla PMs flow in on rebuild. Our tier PMs stay in the additive `zzz_*` file; the linter reads vanilla + `zzz`, not these owned copies. |
| **buildings** files (whole-file replace) | `common/buildings/01_industry.txt` + `06_urban_center.txt` + `11_private_infrastructure.txt` | `build.ps1` | Owns all three (V3 rejects cross-file redefine). Copies each vanilla file, swaps our base buildings, keeps others **verbatim**. New-economy chains (power/port/railway) are **clone-and-swap**: `build.ps1` copies the vanilla building block and swaps only key/tech/PMGs/construction — so a patch that changes `port`/`railway`/`power_plant`'s special fields (`port=yes`, `terrain_manipulator`, `ai_value`, …) flows in on rebuild, and a patch that changes urban_center/trade_center/manor/financial (kept verbatim) does too. |
| **1836 start** (re-tiered) | `common/history/buildings/*.txt` | `convert_history.ps1` (via `build.ps1`) | `metadata.json` `replace_paths` makes the mod's copy replace vanilla's. Rebuild to absorb new vanilla history. |
| **Linter** baseline | `common/production_methods/`, `production_method_groups/`, `buildings/` `01_industry.txt` | `lint.sh` | Concatenates vanilla + mod (vanilla first) to check break-even. |
| **UI building explorer** (`ui/vanilla.js`) | ALL of `common/buildings/`, `common/production_method_groups/`, `common/production_methods/` | `extract_vanilla.ps1` (via `build.ps1`) | Full building/PMG/PM dump for the UI's read-only all-buildings explorer. UI-only, never shipped. Regenerated every build, so a patch's new/changed buildings show up after a rebuild. |

**Drift alarm (read this every update):** `config/start_baseline.json` → **`unmapped`** list. It is
regenerated each build by `extract_start.ps1`. If a patch **renames or adds a main PM**, the vanilla
starting factories using it can no longer be mapped and show up in `unmapped`. That's the signal to
refresh the affected tier's **`vanilla_pm`** field in `config/mod_config.json`, then re-solve + rebuild.

---

## Manual — static snapshots that can go stale (NOT automated)

These are hand-maintained copies of vanilla data. Nothing warns you if vanilla changes them — check by
hand on a major patch.

1. **Base good prices — `tools/goods_prices.tsv`.** A static mirror of `common/goods/00_goods.txt`
   base prices, and the single price source for the builder, both solvers, the linter, and the UI. If a
   patch **re-prices any good**, update this TSV or every derived number is subtly wrong. (No automatic
   check — compare against `00_goods.txt`.)

2. **UI £/point constant — `ui/builder.html`, `BCM.poundPerPoint = 720`.** Static; used only for the
   UI's muted "model N" build-cost hint. Will go **stale if the construction iron PM recipe changes**.
   The *stored* `building_cost` values shown are always correct (they come from the config), and
   `solve_building_cost.ps1` re-derives the real £/point live — only this hint drifts until 720 is
   refreshed. (Commented in-file.)

3. **Construction cost script-values (fallback only).** Vanilla
   `common/script_values/building_values.txt`: `construction_cost_low/medium/high/very_high` =
   200/400/600/800. We now emit explicit per-tier `building_cost`, so these are only the **fallback**
   for a tier missing `building_cost`. Note if the numbers move, but low priority.

4. **`metadata.json` → `supported_game_version`.** Bump to the new version so the launcher doesn't flag
   the mod as out-of-date. (`id` must stay fixed to preserve playset membership; the builder only
   restamps the `name` with a build time.)

5. **Hardcoded vanilla file paths.** The tools assume these vanilla files exist by name:
   `common/buildings/01_industry.txt`, `common/production_methods/01_industry.txt` &
   `13_construction.txt`, `common/production_method_groups/01_industry.txt`,
   `common/history/buildings/*.txt`, `common/goods/00_goods.txt`,
   `common/script_values/building_values.txt`, `common/technology/technologies/*.txt` (era per tech, read
   by `solve_be_targets.ps1`), and `common/buildings/06_urban_center.txt` + `11_private_infrastructure.txt`
   (own the new-economy chains via clone-and-swap; each tier's `vanilla_pm` must still exist). If Paradox
   **renames or resplits** any of these — or moves `building_power_plant`/`building_port`/`building_railway`
   to another file — the corresponding tool breaks loudly (clone throws "vanilla building … not found"):
   update the path / the industry's `source_file`.

---

## Baked-in assumptions (rarely change, but they're here)

- **Weekly economy tick, 52 weeks/year** — `solve_building_cost.ps1 -WeeksPerYear 52`. PM `_add`
  flows and construction output are weekly; profit is annualized ×52. If Paradox ever changes the tick,
  revisit.
- **Price band 25%–175% of base** (floor at supply≈2×demand, ceiling at demand≈2×supply) — the
  corridor the whole break-even ladder lives in (`BALANCE_FRAMEWORK.md` §2). Used by the UI's out-of-band
  flags. Would only change with a market-mechanics overhaul.
- **Wage assumption `wage_pct = 0.33`** — wages modeled as 33% of input-goods cost, folded into the
  full break-even everything is designed against (`BALANCE_FRAMEWORK.md` §1). It is **not** derived from
  vanilla (the game pays its own endogenous wages; this is a design-model layer, not emitted to the mod).
  The default is **duplicated** across `solve_volumes.ps1` (`-WagePct`), `solve_building_cost.ps1`
  (`-WagePct`), `build.ps1` (hardcoded 0.33 for the building-name BE + tier map), `lint_profitability.awk`
  (fallback when the tier map lacks a `wage_pct` column), and `ui/builder.html` (`DEF_WAGE`). To change the
  global default, update all five (or set per-tier `wage_pct` in the config, which every tool honors); then
  re-solve volumes + building cost and rebuild.

---

## Log of version-sensitive findings

Newest first. Append here as we discover more couplings to vanilla.

- **2026-07-17** — **All PM goods editable & emitted.** The builder now **owns EVERY
  `common/production_methods/*.txt`** (was just `01_industry`), applying the gate remap + a new per-PM
  **goods override** from the config `pm_goods` map (default = verbatim copy). This makes every PM's
  input/output goods editable in the UI (explorer buildings *and* our tiers' secondary PMs) and emitted —
  without owning building files, since buildings reference PMs by key. Secondary *effects* (modifiers,
  employment) stay verbatim/display-only. New coupling: **all** vanilla PM files (a patch that adds/renames
  PMs or PM files flows in on rebuild; stale until then, like the buildings files). Verified: unaffected
  files byte-identical to vanilla, overrides scoped to the exact PM, LINT 53/53.
- **2026-07-17** — **Softened the ladder −15pp** (era anchors 140/115/90/65/50 → **125/100/75/50/35**; solver
  `FLOOR` 45 → 30 so e5 can reach 35). Re-ran `solve_be_targets -Write` → `solve_volumes` →
  `solve_building_cost` → `build` (LINT 53/53). Also: per-tier **`ai_value`** is now editable in the UI and
  emitted by the builder (blank = engine default 1000); the UI "natural BE" preset became **Restore
  defaults** (resets unlocked groups to the loaded config). **Tooling gotcha fixed:** `solve_be_targets.ps1`
  used a *relative* `-Config` default, so launching it via `powershell -File …` from the wrong cwd silently
  failed to persist (the build stayed self-consistent at the OLD targets). Its default is now the repo-absolute
  path like the other solvers. When running solvers, prefer dot/`&`-invocation in the repo, or pass `-Config`.
  Also: **`ai_value` is now editable for every explorer building** (top-level `building_ai_value` map →
  builder injects it into PRESERVED blocks in owned files via `Set-BuildingAiValue`); set **trade center =
  3000** (3× the vanilla 1000 default) and **tooling = 2000** (vanilla) at all tiers. `extract_vanilla.ps1`
  now also captures each building's base `ai_value` into `ui/vanilla.js` (UI default display).
- **2026-07-17** — **Fixed: split broke gated secondary PMs.** `pm_bone_china` / `pm_elastics` /
  `pm_precision_tools` are gated by `unlocking_production_methods = { <vanilla main PM> }` (only available
  when that main PM is in the building). Renaming/splitting the main PMs (`pm_crystal_glass` →
  `pm_main_glass_crystal`, etc.) left the gate unsatisfiable, so those secondaries silently locked. Fix:
  builder now **owns `common/production_methods/01_industry.txt`** (whole-file replace) and appends our tier
  `pm_key` to each `unlocking_production_methods` list referencing a split main PM. New coupling: that
  vanilla file (verbatim except the gate lists). Verified: 106 PMs preserved, untouched PMs byte-identical,
  the 3 gates extended; LINT still 53/53 (linter reads vanilla + zzz, not the owned copy).
- **2026-07-17** — **Fixed: shipyard split silently dropped naval capacity.** The base shipbuilding PMs
  (`pm_basic/complex/metal/arc_welding_shipbuilding`) carry a **`country_modifiers { country_ship_construction_add }`**
  (5/10/15/20) from the *same* PM that outputs clippers/steamers — this is what lets a country build and
  **maintain navies**. Our PM emitter only copied goods/employment/pollution, so the split produced shipyards
  that made clippers but granted **zero ship construction** → navies couldn't be built and existing ones
  decayed. Fix: new per-tier **`ship_construction`** field → emitted as `country_ship_construction_add`; set
  5/10/15/20 on the four shipyard tiers. **Gotcha (version-sensitive):** the builder's PM emitter carries only
  a *whitelist* of modifiers — goods in/out, employment, `state_pollution_generation`, `state_infrastructure`,
  `country_ship_construction`. **Any other modifier on a tiered building's main PM is silently dropped.** If a
  patch adds a modifier to a tiered main PM (or we tier a new building whose PM has one), audit for it — a
  quick scan of each `vanilla_pm` for `country_modifiers` / unexpected `state_*_add` catches it (that scan
  found the shipyard was the only affected chain).
- **2026-07-17** — **New-economy chains tiered (power / port / railway).** The builder now **owns three**
  vanilla buildings files (`01` + `06_urban_center` + `11_private_infrastructure`) and emits the new
  chains by **clone-and-swap** (`New-ClonedBuilding`: copy the vanilla block, swap only key/tech/PMGs/
  construction — preserves `port=yes`, `terrain_manipulator`, `ai_value`, `should_auto_expand`, `potential`).
  New config flags: `clone_from_vanilla`, `source_file`, `follows_be` (false = ports/railways stay on
  vanilla volumes — solvers + linter skip them), `no_mass_be` (excluded from the linter ladder + UI mass
  tools), per-tier `state_infrastructure` (emitted as `state_infrastructure_add`; ports/railways produce
  infrastructure) and `output_override` (power keeps vanilla electricity output while on the BE ladder).
  `solve_volumes` now reads **all** production-methods files. 1836 ports/railways are re-tiered by
  `convert_history` (both start on their T1 PM; conversion is a token swap). `trade_center` left vanilla.
  Rebuilt clean: 63 tier buildings / 21 industries, LINT PASSED (53 core), 604 factories re-tiered.
  **Not verifiable without launching V3** — engine correctness (mod loads, ports/railways function,
  `error.log`) needs an in-game test.
- **2026-07-16** — **BE targets re-cast as a curve over tech unlock date (era).** New solver
  `solve_be_targets.ps1` reads each tier's unlocking tech's **era** from `common/technology/technologies/*.txt`
  and writes per-tier `target_be` (era anchors **125/100/75/50/35** for e1–e5, minus **−15 pp** when a tier
  unlocks in eras 1–3 and consumes a factory-made intermediate — dye/silk excluded) plus `natural_year`
  (era's representative year, shown in the UI). Replaces the old per-group ladders (light/heavy/tools/single-PM).
  **New vanilla coupling:** tech→era assignments; a patch that moves a tech between eras shifts that tier's
  target. Run order is now `solve_be_targets -Write` → `solve_volumes` → `solve_building_cost` → `build`.
  Rebuilt clean (LINT 53/53). Building costs re-solved off the new volumes (spread 240→1030, steel now dearest).
- **2026-07-14** — Added the UI **all-buildings explorer**. `extract_vanilla.ps1` dumps every vanilla
  building/PMG/PM to `ui/vanilla.js` (regenerated each build); the balance UI always shows every building
  with switchable PMs (read-only). New coupling: it reads the WHOLE of `common/buildings`,
  `production_method_groups`, `production_methods` (all files, not just `01_*`), so a patch that adds/renames
  buildings, PMGs or PMs flows in on rebuild. New builder flag `include_all_buildings` (config bool /
  `-IncludeAllBuildings`) gates emission of non-tiered buildings (currently no-op — we don't edit them yet).
- **2026-07-14** — Shipyards **enabled and split by output good**. The vanilla shipyard's one chain makes
  clippers (basic/complex) then steamers (metal/arc-welding) — a mid-ladder good change — so it's split
  into `shipyard` → clippers and `shipyard_steam` → steamers, each a 2-tier 120/95 chain. History routing:
  vanilla `building_shipyard` start factories map onto the **clipper** line (that's the industry owning
  the `building_shipyard` base key); the steamer line's base (`building_shipyard_metal`) has **no vanilla
  anchor**, so the builder appends it (informational note, not a warning) and any start factory running a
  metal/arc PM would be **unmapped** — but none exist at 1836 (those techs post-date the start), so the
  whole shipyard stock converts cleanly to clippers. If a future patch ships a later bookmark with
  metal/arc shipyards, add `vanilla_pm` routing or a `start_exceptions` rule for them.
- **2026-07-14** — Wages made explicit. Break-even is now **wage-inclusive** (full BE = (I + wage_pct·I)/O,
  default wage_pct 0.33); the ladder was re-based onto the full-BE scale (light 140/115/90/65, tools one
  tier lower, heavy/mil 120/95/65/40, single-PM 65). `ladder_tiers.txt` gained a 4th `wage_pct` column;
  the wage default is duplicated across five tools (see Baked-in assumptions). Wages are model-only — **not**
  emitted to the game.
- **2026-07-14** — Initial doc. Established: construction £/point = £720 from `pm_iron_frame_buildings`
  (wood 40 + fabric 20 + iron 50 + tools 10 = £3600/wk ÷ 5 pts/wk) at 0 efficiency bonus; economy ticks
  weekly (52/yr); `goods_prices.tsv` is a static price mirror; UI `poundPerPoint` is a static hint that
  can drift; `building_cost` overrides vanilla's flat 200/400/600/800 construction-cost script-values.
