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

`build.ps1` must end with **LINT PASSED**, **MOD CHECKS PASSED** and **PREFLIGHT PASSED**. Then do the
**manual checks** below (they are *not* automated), load a game, and read `error.log` (see
`MODDING_NOTES.md`).

⚠ **PREFLIGHT WILL FAIL ON A PATCH THAT RENAMES COUNTRY TAGS OR SCRIPT VALUES**, and that is the point —
see `TESTBED_LANDMINES.md`. Two entries are patch-sensitive:
- **L1** guards named tags with `exists`. If a patch removes a tag we name (e.g. a formable changes), the
  guard keeps the game quiet but the metric silently stops covering that country — check the tag lists in
  the schedules, not just that preflight is green.
- **L8** compares the emitted telemetry against a stored hash. It does **not** move on a game patch (it
  hashes our generator's output, not vanilla), so a failure after a patch means *our* code changed, not
  the game.

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
| **production_methods** files (whole-file replace, **only the CHANGED ones**) | **every** `common/production_methods/*.txt` is read; only files a transform actually alters are emitted | `build.ps1` | Any PM's goods can be edited without owning building files (buildings reference PMs by key). Two surgical transforms, verbatim otherwise: (1) **gate remap** — append our tier `pm_key` to `unlocking_production_methods` lists referencing a split main PM (bone china / elastics / precision tools); (2) **goods override** — overwrite `goods_input/output_*_add` for any PM in the config `pm_goods` map. Modifiers/employment/effects untouched. **The builder compares its output against the vanilla text and skips the write when they match**, so we own only what we change (today: `01_industry.txt`; the other 14 stay vanilla and thus absorb a patch automatically). The build log line `production_methods: owning N file(s) … M left vanilla` says which. Our tier PMs stay in the additive `zzz_*` file; the BE linter reads vanilla + `zzz`, and the negative-goods linter reads vanilla PMs **plus** whatever we own on top. |
| **buildings** files (whole-file replace) | `common/buildings/01_industry.txt` + `06_urban_center.txt` + `11_private_infrastructure.txt` | `build.ps1` | Owns all three (V3 rejects cross-file redefine). Copies each vanilla file, swaps our base buildings, keeps others **verbatim**. New-economy chains (power/port/railway) are **clone-and-swap**: `build.ps1` copies the vanilla building block and swaps only key/tech/PMGs/construction — so a patch that changes `port`/`railway`/`power_plant`'s special fields (`port=yes`, `terrain_manipulator`, `ai_value`, …) flows in on rebuild, and a patch that changes urban_center/trade_center/manor/financial (kept verbatim) does too. |
| **1836 start** (re-tiered) | `common/history/buildings/*.txt` | `convert_history.ps1` (via `build.ps1`) | `metadata.json` `replace_paths` makes the mod's copy replace vanilla's. Rebuild to absorb new vanilla history. |
| **BE linter** baseline | `common/production_methods/`, `production_method_groups/`, `buildings/` `01_industry.txt`; **prices from `tools/goods_prices.tsv`** (passed as `-v PRICES=`) | `lint.sh` → `lint_profitability.awk` | Concatenates vanilla + mod (vanilla first) to check break-even. The linter used to carry its **own hardcoded copy** of the 53-good price table, so a post-patch price refresh in the TSV reached the builder, both solvers and the UI but silently *not* the linter; it now reads the one table like everything else. |
| **Negative-goods linter** | ALL vanilla `common/production_method_groups/*.txt` + ALL vanilla `common/production_methods/*.txt` + the mod's own PM files on top + ALL `buildings/*.txt` (vanilla + mod); reads `unlocking_production_methods` gates | `lint.sh` → `lint_negative_goods.awk` | Brute-forces every legal PM combination of **every building** to ensure no good's total goes < 0. Vanilla-first-mod-second at every layer, so it sees the full PM set even though the mod now owns only the PM files it changes (`pm_goods` edits are still checked — they land in an owned file by definition). Honors vanilla PM gates. A patch that changes vanilla PMG membership, gate lists, or a building's PMGs flows in on rebuild. |
| **UI building explorer** (`ui/vanilla.js`) | ALL of `common/buildings/`, `common/production_method_groups/`, `common/production_methods/`; per-PM `unlocking_principles` (→ `gated:true`) | `extract_vanilla.ps1` (via `build.ps1`) | Full building/PMG/PM dump for the UI's all-buildings explorer. UI-only, never shipped. Regenerated every build, so a patch's new/changed buildings show up after a rebuild. `gated:true` marks **power-bloc-gated** PMs (have `unlocking_principles`); the UI's `basePm()` never defaults a PMG to one. A patch that adds/renames `unlocking_principles` on more PMs flows in on rebuild. |
| **AI subsidy policy** | `common/ai_strategies/01_admin_strategies.txt` (whole-file replacement) + `00_default_strategy.txt` (**read-only**, for its `subsidies` trio) | `build.ps1` (`building_subsidies` map) | Rewrites the `subsidies` block of all **7 administrative** strategies. `ai_strategy_default`'s own subsidies are **read live** from vanilla each build and restated **only into strategies that had no `subsidies` block of their own** (a strategy that has one is authoritative — restating there would invent subsidies vanilla never granted, overriding deliberate per-strategy fine-tuning). Nothing to resync by hand. We deliberately do NOT own `00_default_strategy.txt`: it is one ~8790-line block covering the whole AI (wargoals, army/navy sizes, treaties, infamy, interest groups), so owning it to set one field would freeze all of that against future patches. **Re-check after a patch:** (a) new/renamed administrative strategies — the builder keys off `type = administrative`, so new ones are picked up automatically, but a strategy that stops being administrative silently loses our policy; (b) `ai_strategy_industrial_expansion` gaining a `possible` gate would break universal coverage (today it has none, which is why every AI always runs one administrative strategy). Unverified: whether a typed strategy's `subsidies` merges per key with the default's or replaces it (we restate the trio so we are correct either way). |
| **Pop-need weights** (`common/pop_needs/00_pop_needs.txt`, whole-file replacement — **conditional, usually NOT emitted**) | `common/pop_needs/00_pop_needs.txt` | `build.ps1` → `Write-PopNeedWeights`, driven by the config's `pop_need_weight_mult` map | Multiplies the `weight` of named goods inside **every** need they appear in. **Emitted only when that map is non-empty** — absent or empty and the file is not written at all, so pop needs stay vanilla and absorb a patch automatically (same principle as the production-method files). ⚠ **When it IS emitted it is a whole-file copy of a single vanilla file**, so a patch that adds a need, adds a good to one, or retunes a `weight`/`max_supply_share` is **silently overridden until rebuilt** — and the override looks like vanilla, because everything except the scaled lines is copied verbatim. **Re-check after a patch:** the build log prints `pop needs: scaled N weight line(s) across M good(s)`; if N changes for an unchanged config, vanilla's own weights moved. A config naming a good that no longer exists scales **0** lines and the build warns rather than failing. ⚠ The canonical `config/mod_config.json` carries **no** multipliers today — the only user is the experimental treatment arm `config/vanilla_weight_x10.json` (see CLAUDE.md → `-ControlOnly`). |
| **Trade-center GDP gate** | `common/defines/00_ai.txt` → `NAI` `TRADE_CENTER_MINIMUM_GDP_*` | (not modded — informational) | Hard eligibility filter on where the AI will build trade centers (market capital 100k / other 500k yearly GDP, ×2 non-coastal, ×2 unrecognized, ×(1 + years×0.02)). `ai_value` and subsidies only re-weight states that already cleared it. If AI trade-center construction is being tuned, check these first. |
| **UI goods pictograms** (`ui/icons.js`) | `common/goods/00_goods.txt` (each good's `texture = "…"`) + `gfx/interface/icons/goods_icons/*.dds` | `extract_icons.ps1` (via `build.ps1`) | Converts each good's icon to a base64 PNG for the scenario panel. Reads the texture path **per good** (never assumes filename = good name: `engines`→`locomotives.dds`, `manowars`→`man_o_wars.dds`), so renames/re-points follow on rebuild. **UI-only, `.gitignore`d — Paradox art is never committed or shipped in `mod/`.** Requires *uncompressed 32-bit BGRA* DDS (today's format); if a patch switches to DXT/BC the icons are skipped with a `note:` and the UI degrades to text-only. Absent `icons.js` (fresh clone, never built) ⇒ text-only rows, no error. |
| **UI scenario presets** (`ui/presets.js`) | `common/history/buildings/*.txt`, `common/history/pops/*.txt`, `common/history/states/00_states.txt`, `common/history/countries/*.txt` (`activate_law`), `common/history/diplomacy/00_subject_relationships.txt`, `common/history/treaties/00_historical_treaties.txt`, `map_data/state_regions/*.txt` (`arable_land`, `subsistence_building`), `common/defines/00_defines.txt` (`SLAVE_BASKET_*` → the basket level buildings buy for their slaves), `common/buy_packages/*.txt`, `common/pop_needs/*.txt`, `common/pop_types/*.txt` (`working_adult_ratio` — incl. slaves' 0.5 override — and `consumption_mult`), `common/buildings/`, `production_method_groups/`, `production_methods/` (PMGs, per-PM employment, law + tech gates) | `extract_presets.ps1` (via `build.ps1`) | One preset per entry in `config/presets.json` = a country's whole market: buildings (re-tiered via `vanilla_pm`, counted in levels) + the PMs vanilla runs, `goods_transfer` treaty articles in force in 1836, the **subsistence** buildings inferred from free arable land at their staffed-level equivalent, and the population split into consumption classes. UI-only, never shipped. **Re-check after a patch:** (a) the **strata map** (`$STRATA`) and **subject-type list** (`$SUBJECT_TYPES`) are ENGINE-side, spelled out in the tool — a new profession warns ("unknown pop type … treated as lower") but a new *subject type* would silently drop that subject out of the market; (b) market membership assumes **every subject shares its overlord's market unless a `grant_own_market` pact exists** — if Paradox changes that default (or which types it applies to), fix `Get-MarketMembers` or use `market_add`/`market_drop`; (c) **ownership buildings** (manor house / financial district) are inferred as "owner types history never `create_building`s", one level per owned level — a patch that starts creating them explicitly, or adds a third ownership type, flows in automatically, but a patch that changes the levels-per-ownership rule does not; (d) **subsistence** assumes one arable land per agricultural level and `subsistence levels = free arable`, with employment read per type from its own PM (5 000, rice 10 000) — the arable-land accounting is the part not stated anywhere in the files; (e) **slave consumption** is a building purchase sized by the `SLAVE_BASKET_*` defines — read live, but with a hardcoded fallback the extractor warns about per key. Defines mirrored statically in the tool / `ui/builder.html`: `POP_SIZE_PACKAGE` (10 000), `WORKING_ADULT_RATIO_BASE` (0.25), `DEPENDENT_CONSUMPTION_RATIO` (0.5). |
| **Non-`pm_` PM names** | PM keys in `common/production_methods/` (plantations/mines use `default_`/`automatic_`/`worker_`/`picks_and_shovels_`/… , not `pm_`) | `extract_vanilla.ps1`, `build.ps1` (`pm_goods` writer), `lint_negative_goods.awk` | All three treat **every** top-level block in a production_methods file as a PM (not only `pm_*`), so plantation/mine goods extract, emit (via `pm_goods`), and lint. If a patch introduces yet another PM-name shape, these already handle any identifier. |

**Drift alarm (read this every update):** `config/start_baseline.json` → **`unmapped`** list. It is
regenerated each build by `extract_start.ps1`. If a patch **renames or adds a main PM**, the vanilla
starting factories using it can no longer be mapped and show up in `unmapped`. That's the signal to
refresh the affected tier's **`vanilla_pm`** field in `config/mod_config.json`, then re-solve + rebuild.

---

## ⭐ THE 1836 STARTING-TECHNOLOGY CHECK — run it after EVERY patch, PER COUNTRY

**The question:** for every country, does its 1836 starting technology set unlock every production
method its own 1836 buildings are told to activate? A country that starts with a building running a PM
it cannot legally run is a silent fault — the engine does not refuse it loudly, and the economy simply
comes out different from vanilla's.

This becomes load-bearing once the starting sets are **authored lists** rather than
`add_era_researched = era_1` (the anchor principle in `CLAUDE.md` requires that, because the shorthand
grants a whole mechanical era and the principle says a leader should hold about *half* of era 1 at its
anchor). Vanilla's shorthand is forgiving; an authored list is not.

**The check, in order:**
1. Collect every `activate_production_methods` entry in `common/history/buildings/*.txt` — **the mod's
   emitted copy**, since `replace_paths` makes ours the only history the engine reads.
2. Resolve each PM's `unlocking_technologies` from `common/production_methods/` — vanilla **and** our
   owned files.
3. Resolve each building's own `unlocking_technologies` too (a building can be gated as well as its PM).
4. For each COUNTRY, take its starting set from `common/scripted_effects/00_starting_inventions.txt`
   (which tier it gets comes from `common/history/countries/*.txt`) and check every technology its own
   buildings and PMs need is in it.
5. Report per country, not as a union.

⚠⚠ **STRIP THE UTF-8 BOM BEFORE PARSING THE PM FILES.** Every PM file starts with one, so a naive
`^name = {` match makes the **first production method in each file invisible**. On 2026-08-12 that
silently dropped 8 of 110 PMs from this very check and produced a clean result that was not earned;
`tools/verify_pms.mjs` records the same trap making six real PMs look hallucinated. If any of the eight
had carried a tech gate, the check would have passed while 1836 was broken.

⚠ **The union across all countries is NOT sufficient.** A leader's generous set can cover a gap that a
tier-3 or tier-4 country's does not. The lower starting tiers are where this bites, and they are also
the ones most likely to drift 1836 away from vanilla.

**Known structural exceptions, as of 2026-08-12 (patch 1.13):** three technologies the 1836 map depends
on have onsets *after* 1836 — `central_archives` (1838), `mechanical_tools` (1840) and
`intensive_agriculture` (1842). All three are in vanilla's explicit named grant, which is exactly what
that list is for. If a patch adds a fourth such case and does *not* name it, this check is what finds it.

---

## Manual — static snapshots that can go stale (NOT automated)

These are hand-maintained copies of vanilla data. Nothing warns you if vanilla changes them — check by
hand on a major patch.

1. **Base good prices AND the good list — `tools/goods_prices.tsv`.** A static mirror of
   `common/goods/00_goods.txt` base prices, and the single price source for the builder, both solvers,
   the linter, and the UI. Two things to check after a patch, both by comparing against `00_goods.txt`
   (no automatic check):
   - **Re-priced goods** → update the TSV or every derived number is subtly wrong.
   - **Added / removed / renamed goods** → add them to the TSV, *and* to `GOOD_GROUPS` in
     `ui/builder.html` (an unlisted good still shows, but lands in the catch-all "Other" section).
     A good the TSV doesn't know is priced £0 everywhere — this one bites hard, so check it first.
   **Goods pictograms** follow automatically: `tools/extract_icons.ps1` re-reads each good's own
   `texture = "…"` from `00_goods.txt` every build, so a new/renamed good or a re-pointed icon is
   picked up on the next `build.ps1` with nothing to hand-edit. Two caveats worth knowing:
   - The decoder only handles **uncompressed 32-bit BGRA** `.dds` (what V3 ships today: 256×256, no
     fourCC). If a patch re-encodes the icons as **DXT/BC compressed**, every icon is skipped with a
     `note:` line and the UI falls back to text-only — it will not crash, but you'd need block
     decompression added to the extractor.
   - A good whose icon is missing renders a dashed placeholder box in the scenario panel (its name and
     price still show), so a gap is visible rather than silent.

1b. **The pop-need substitution constants — `common/defines/00_defines.txt`.** The rule the balance model
   implements (FINDINGS F40, BALANCE_FRAMEWORK §10.36) reads six defines, none of them mirrored in our
   config, all of them silent if Paradox re-tunes them:
   - `TABOO_DEMAND_MULT` (0.5) — a religion's taboo halves that good's entry. Measured exact.
   - `DEFAULT_OBSESSION_DEMAND_MIN` (0.5) / `DEFAULT_OBSESSION_DEMAND_MULT` (1.5) — the obsession floor,
     overridden per need in `common/pop_needs` (`intoxicants`, `luxury_drinks`, `luxury_items` use 0.75 /
     1.75; `leisure` 0.5 / 2.0).
   - `DEFAULT_PRESTIGE_GOODS_DEMAND_INCREASE` (0.5) — likewise overridden per need (0.75 in three, 1.0 in
     `leisure`). Its scaling input is the prestige share of the good's supply, so **`common/prestige_goods`
     is a coupling too**: a patch that adds a prestige variant to a good silently changes that good's pop
     demand. 40 base goods carry one today.
   - `LOCAL_GOODS_SUBSTITUTION_SUPPLY_GDP_FACTOR` (0.25) — ⭐ **NOW IMPLEMENTED (F43, §10.37)**, so this is
     a live coupling rather than a documented gap. It feeds the constant `LOCAL_MULT_DEFAULT` in
     `ui/econ.js` (mirrored in `ui/builder.html`): `0.2 + (1 − 0.2) × 0.25 = 0.40`, the share of market
     supply a representative state sees of a `local` good. ⚠ **Two things move it and both are silent:**
     this define, and **which goods carry `local = yes` in `common/goods/00_goods.txt`** — today exactly
     `services`, `transportation` and `electricity`, hardcoded as `LOCAL_GOODS` in both files. A patch that
     flags a fourth good `local` would leave it at full market supply with nothing failing. **Re-check both
     after a patch**, and re-run `node tools/econ_selftest.mjs` (its `F43` cases pin the constant *and* the
     set). The two 0.2 assumptions are ours, not the game's, and are re-derivable per F43's sweep.
   - `MAX_DEMAND_ADJUSTMENT_BASE_AMOUNT` (0.01) / `_SCALED_AMOUNT` (0.09) / `_SCALE` (1.0) — how far a pop's
     demand for a substitutable good may move per update. We do not model it, and at annual sampling it does
     **not** bind: a stored weight sits on its computed target (F40). ⚠ If a patch tightened these, stored
     weights would start trailing and every save-based measurement would need a lag term.
   ⚠ Also version-sensitive: **`common/cultures`** obsession lists are only the 1836 starting set (the game
   adds and drops them at runtime), and **`common/religions`** taboo lists. The measurement tooling reads
   both from the *save*, not the files — keep it that way.

1c. **Population by profession — `config/measured_1836_professions.json`.** GENERATED from a **melted
   vanilla 1836.4.1 autosave** by `tools/testbed/melted_pops_by_profession.mjs`, and it is the source the
   balance sheet's whole population model rests on: professions are the input and the wealth strata are
   their sum. **Regenerate after a patch that moves starting populations** — a stale table is silently
   wrong rather than obviously missing, exactly like `measured_1836.json`. It also encodes two things the
   engine owns: the **pop type list** (16 today) and which **stratum** each consumes as (`$PROF_STRATUM`
   in `extract_presets.ps1`, mirrored as `PROF_STRATUM` in `ui/builder.html` — **change both or neither**).
   A patch adding a pop type would leave it at zero everywhere with nothing failing.
   ⚠ It reads at **1836.4.1**, three months in, because that is the earliest archived autosave — whereas
   `measured_1836.json` reads at **1836.2.1**. The two-month gap is why the derived strata and each
   preset's own `pops` block do not agree to the person; they agree to 0–1 % in six of eight markets, and
   the USA (12–15 %) and the Russian/French slave counts (63–90 %) are **unexplained**, not drift.

2. **UI £/point constant — `ui/builder.html`, `BCM.poundPerPoint = 720`.** Static; used only for the
   UI's muted "model N" build-cost hint. Will go **stale if the construction iron PM recipe changes**.
   The *stored* `building_cost` values shown are always correct (they come from the config), and
   `solve_building_cost.ps1` re-derives the real £/point live — only this hint drifts until 720 is
   refreshed. (Commented in-file.)

3. **Construction cost script-values (fallback + "Bring to vanilla").** Vanilla
   `common/script_values/building_values.txt` defines `construction_cost_very_low/low/medium/high/very_high`
   = 100/200/400/600/800 (plus `monument` 2500, `sagrada_familia` 6000, `construction_sector` 25). We now emit
   explicit per-tier `building_cost`, so these are the **fallback** for a tier missing `building_cost` **and**
   the values the UI's **Bring-to-vanilla** resets `building_cost` to (mirrored statically as
   `VANILLA_CONSTRUCTION` in `ui/builder.html`). If these numbers move, update that map too. ⚠ The UI mirror
   currently lists only `low/medium/high/very_high` — the four our split industries actually use. A building
   on `very_low` (e.g. the trade centre) or on no building-level value at all (the clone-and-swap chains:
   power/port/railway) would get `undefined` from Bring-to-vanilla; harmless today because those groups are
   locked by default, but extend the map if we tier such a building.

4. **`metadata.json` → `supported_game_version`.** Bump to the new version so the launcher doesn't flag
   the mod as out-of-date. (`id` must stay fixed to preserve playset membership; the builder only
   restamps the `name` with a build time.)

5. **Hardcoded vanilla file paths.** The tools assume these vanilla files exist by name:
   `common/buildings/01_industry.txt`, `common/production_methods/01_industry.txt` &
   `13_construction.txt`, `common/production_method_groups/01_industry.txt`,
   `common/history/buildings/*.txt`, `common/history/pops/*.txt`,
   `common/history/diplomacy/00_subject_relationships.txt`,
   `common/history/treaties/00_historical_treaties.txt`, `common/buy_packages/*.txt`,
   `common/pop_needs/*.txt`, `common/pop_types/*.txt` (the last five feed the UI's scenario presets —
   a missing dir makes `extract_presets.ps1` throw), `common/goods/00_goods.txt`,
   `common/script_values/building_values.txt`, `common/technology/technologies/*.txt` (era per tech, read
   by `solve_be_targets.ps1`), and `common/buildings/06_urban_center.txt` + `11_private_infrastructure.txt`
   (own the new-economy chains via clone-and-swap; each tier's `vanilla_pm` must still exist). If Paradox
   **renames or resplits** any of these — or moves `building_power_plant`/`building_port`/`building_railway`
   to another file — the corresponding tool breaks loudly (clone throws "vanilla building … not found"):
   update the path / the industry's `source_file`.

---

## Testbed (`tools/testbed/run_observer.ps1`) — engine couplings to re-verify

The automated observer harness drives the **executable and the launcher's config files**, none of which
are moddable data — a patch can change them silently. Full detail in `MODDING_NOTES.md` →
*Automated headless runs*. After an update, run one short **diagnostic** session — this is the one
sanctioned hand invocation of the observer; everything that produces *measurements* goes through
`run_schedule.ps1`:

```
powershell -ExecutionPolicy Bypass -File tools\testbed\run_observer.ps1 -Runs 1 -DumpDates 1836.3.1 -UntilDate 1836.4.1
```

(~1 min; lands in `tools\testbed\sessions\<stamp>\`). It runs the **deployed** mod, so build first — the
observer refuses to launch a mod that carries no telemetry, so build it with `-TelemetryOn`. Check
`meta.json`: `mod_loaded`, `dump_complete` and `goods_rows` are the assertion. What can break:

| Coupling | Where it lives | How breakage shows |
|---|---|---|
| CLI args `-handsoff`, `-run_until=`, `-disable_renderframeifneeded` | `binaries\victoria3.exe` (arg table near `game_setup.cpp` in the string pool) | The game sits in the main menu (no auto-start), or never exits → the harness watchdog kills it and flags `timed_out`. |
| Mod enabling via `content_load.json` (objects with an **absolute** `path`) | `Documents\Paradox Interactive\Victoria 3\content_load.json`, read by `dlc.cpp` | `meta.json` `mod_loaded=false`; `debug.log` says `Missing path for dlc/mod` or `No subdirs mounted`. The launcher rewriting this file is normal — the harness backs it up and restores it. |
| `pdx_settings.json` keys `Graphics.display_mode`, `game.autosave` (enum: `never`/`monthly`/`quarteryear`/`halfyear`/**`five_year`**/`yearly` — the `SETTING_AUTOSAVE` cluster in the exe; note `halfyear` has no underscore while `five_year` does) | same folder; **the game rewrites this file on exit and drops default-valued keys** | Runs go fullscreen, or the autosave cadence changes — which silently changes how much a crash resume loses. ⚠ Do **not** read these values off the `save_interval` string in the exe: that is a *different* enum (`half_year`, `three_months`, `every_other_month`) belonging to something else, and this row previously quoted it by mistake. The harness default is `five_year` (`-AutosaveInterval`), the coarsest 1.13.9 offers. |
| Crash artifacts at `Documents\…\crashes\victoria3_<stamp>\` (`exception.txt` + `minidump.dmp`) | engine crash handler | The harness would stop distinguishing a CTD from a manual kill and fall back to the grace prompt (`-StopGraceSeconds`, default 60 s) — which a background batch cannot answer, so it would resume when it should stop. |
| `-continuelastsave` semantics (loads the newest save **on the machine**) | `frontendidlerlogic.cpp` | Resume guards fire and runs get abandoned with `abandoned_reason` set, rather than producing corrupt data. `-loadsave=<path>` is NOT a working alternative — it was rejected in 1.13.9. |
| Data functions `GetMarketGoods.GetGoods.{GetKey,GetMarketBuyOrders,GetMarketSellOrders,GetMarketPrice}` and the `every_market_goods` iterator | engine-side, exercised through `debug_log` | `goods_rows = 0` with `Data error in loc string …` in `error.log`. Remember one bad function voids the **whole** line. |
| `on_monthly_pulse` firing on the 1st of each month, with no root scope | `common/on_actions/00_code_on_actions.txt` + engine | The dump never fires (`dump_complete=false`) because the one-month trigger window is missed. |
| **`on_game_started_after_lobby` reads an INITIALISED market** (verified 2026-08-02: the day-0 read returns real buy/sell/price, not zeros) | engine start-up order | The scenario-calibration reference date silently becomes worse: the earliest comparable snapshot falls back to a monthly pulse, by which time the AI has acted. Detect: the `EARLY\|boot` lines come back all-zero. |
| **`trigger_event = { id = … days = N }`** from the game-start hook, and the `events/` folder being read from a mod at all | engine | The day-7 early-read hook goes silent (no `EARLY\|day7` lines). Only used by the `scenario_probe` metric. |
| Pop-type names in the **stratum map** (`aristocrats/capitalists` … `peasants`, `slaves`) | duplicated in `tools/telemetry_lib.ps1` (SoL by stratum) **and** `tools/extract_presets.ps1` (`$STRATA`) — they must agree, or the measured SoL is keyed to different buckets than the scenario's pop split | A patch adding a profession lands it in `lower` with a warning from the extractor, and is simply absent from the telemetry sums. Re-check **both** lists together. |
| `building_urban_center` as a building key | `common/defines/00_defines.txt` → `URBAN_CENTER_BUILDING`, read by `v3tb_lvl_urban_center` | Urban-centre levels come back 0, which reads as "the scenario has no gap" when in fact the metric broke. Cross-check against the define. |
| **Wage / pop-income data functions**: `State.GetAverageAnnualWage`, `State.GetNumSubsistenceWorkingAdults`, `State.GetNumUnemployedWorkingAdults`, and on Pop `GetIncome` / `GetWorkforceIncome` / `GetDependentIncome` / `GetExpenses` / `GetNumWorkforce` / `GetDependentsSize` / `GetTotalSize` | engine-side, exercised through `debug_log`; see TESTBED_METRICS §5 | The whole `wages` metric goes silent — one bad function voids its entire line, so a `PW` or `SW` line simply stops appearing rather than reporting a wrong number. ⚠ `Country.GetAverageAnnualWage` does **not** exist (it voids); if a patch adds it, Q1 collapses from a state sweep to one line per country. Re-probe with `wage_probe`. |
| **`market = c:TAG.market`** as a country-scope trigger, used to enumerate a whole market | vanilla idiom (`common/journal_entries/01_silkworm_diseases.txt`), engine-evaluated | ⚠ The dangerous mode is **silent**: an invalid trigger inside a `limit` is ignored, so the limit becomes a no-op and the sweep silently covers **all ~285 countries** instead of one market — a per-pop sweep would then emit ~100k lines and destroy the ring. Detect via the `MEMBER` line count (6 for BEL+AUS in 1836, not hundreds). |
| **`wage_weight` per pop type** — the base-wage arithmetic divides by it | `common/pop_types/*.txt`, duplicated in `tools/extract_measured.ps1` (`$WW`), `tools/telemetry_lib.ps1` (`Get-WagePopTypes` order) and `ui/builder.html` (`WAGE_WEIGHT`) | A changed weight silently rescales every measured base wage. A **new pop type** is worse: `v3tb_poptype_id` returns 0 for it (deliberately loud) but the three lists must be updated **together**, and `Get-WagePopTypes` is **append-only** — its order is the on-disk encoding of every recorded session. |
| `WORKING_ADULT_RATIO_BASE` (0.25) and `WORKING_ADULT_RATIO_SKEW_MAXIMUM` (2.0) | `common/defines/00_defines.txt` | Q3's baseline moves. Note these are **not** constants in play — aristocrats override to 0.2 and slaves 0.5 in `common/pop_types`, `state_working_adult_ratio_add` modifiers shift it, and the Austrian market measured **0.2995** against Belgium's exact 0.2500 at the same instant. Treat the define as the floor of the story, not the answer. |
| Log names/rotation (`debug.log` 512 KB × 5, `dedicated_server.log` tick lines) | `platform_specific_game_data/log_settings_live.json` | Progress reporting goes blank (tick parsing), or rows go missing from long runs. The harness mirrors the growing logs live into the run folder's `logs_live/` and recovers from `<name>.1.log` on rotation — a renamed/re-sinked log would silently stop being mirrored, so check that `meta.json`'s `mirrored_lines` are non-zero. |

## Baked-in assumptions (rarely change, but they're here)

- **Weekly economy tick, 52 weeks/year** — `solve_building_cost.ps1 -WeeksPerYear 52`. PM `_add`
  flows and construction output are weekly; profit is annualized ×52. If Paradox ever changes the tick,
  revisit.
- **Price band 25%–175% of base** (floor at supply≈2×demand, ceiling at demand≈2×supply) — the
  corridor the whole break-even ladder lives in (`BALANCE_FRAMEWORK.md` §2). Used by the UI's out-of-band
  flags. Would only change with a market-mechanics overhaul.
- **Wage assumption `wage_pct = 0.25`** — wages modeled as the wage fraction of **total** cost (goods +
  wages), so `W = wage_pct/(1−wage_pct)·I` and total `= I/(1−wage_pct)`; 0.25 of total ≡ the old 0.333 of
  goods. Folded into the full break-even everything is designed against (`BALANCE_FRAMEWORK.md` §1). It is
  **not** derived from vanilla (the game pays its own endogenous wages; a design-model layer, not emitted).
  The default + the `1/(1−wage_pct)` total-cost factor are **duplicated** across `solve_volumes.ps1`
  (`-WagePct`), `solve_building_cost.ps1` (`-WagePct`), `build.ps1` (hardcoded 0.25 for the building-name BE +
  tier map), `lint_profitability.awk` (fallback when the tier map lacks a `wage_pct` column), and
  `ui/builder.html` (`DEF_WAGE`; the £↔% wage row). To change the global default, update all five (or set
  per-tier `wage_pct` in the config, which every tool honors); then re-solve volumes + building cost and rebuild.

---

## Log of version-sensitive findings

Newest first. Append here as we discover more couplings to vanilla.

- **2026-08-12** — 🛑 **THE GAME WENT 1.13.9 → 1.13.10 BETWEEN TWO SESSIONS OF ONE AFTERNOON.** Batch A
  (`20260812_093402`, 12:37–15:17) ran on **1.13.9**; the era6 run (`20260812_152101`, 15:21) ran on
  **1.13.10** and logged `Mod … version 1.13.9 does not match game version 1.13.10`. Nothing announced
  it — Steam updated between the two launches, and the only evidence is one line in `error.log`.
  ⇒ **The two sessions are not comparable**, and any comparison drawn across that boundary needs saying
  so out loud. This is why the ~5-minute smoke check in `CLAUDE.md` includes the version line.
  ⚠⚠ **"LOCALIZATION-ONLY" WAS WRONG AND IS RETRACTED.** 1.13.10 is a **substantial hotfix** —
  Improvements, AI, a long Interface section, Performance, Modding and a long Bugfixes section
  ([forum thread](https://forum.paradoxplaza.com/forum/threads/hotfix-1-13-10-is-now-live-not-for-problem-reports.1938098/),
  checksum `2964`). The claim came from a web-search *summary* that never actually retrieved the 1.13.10
  notes; it inferred them from the 1.13.9 announcement's line about translations arriving later. **A
  search summary is not a source.** Fetch the changelog itself.
  ⚠ **AND THE FILE-MTIME CENSUS AGREED WITH THE WRONG ANSWER, for a reason worth remembering:** of 405
  files the patch rewrote under `game/`, 305 are localization — but **`binaries/victoria3.exe` was
  rewritten too**, and that is where a hotfix like this one mostly lives. **Counting touched script files
  cannot see engine changes.** Check the binary's timestamp before concluding anything about scope.

  ⭐ **THREE ITEMS TOUCH QUANTITIES THIS MOD IS CALIBRATED AGAINST**, and each needs re-measuring rather
  than assuming it is neutral:
  - **"Private investment no longer endlessly expands railways that can never become profitable."**
    Directly on the transport gap (BALANCE_FRAMEWORK §10.47.1) — railway's derived macro floors and the
    ruled-accepted freight residual were both measured on a game that *did* endlessly expand railways.
  - **"Shipyard wages are no longer paid twice."** A doubled wage bill on a building we model, and one
    already carrying a −30pp handicap because its naval-construction income is unmodelled.
  - **"Single good shortage no longer drains supply and instead lowers maximum organization."** Changes
    what a goods shortage does to an army, which is the channel the 5%-of-GDP army premise sits in.
  Also relevant, unquantified: strait-toll and trade-centre toll accounting now agree and no longer
  charge for goods that do not pass the strait; goods are removed from the importer correctly during
  piracy; a crash loading saves with pops missing a social class (our savegame harvest reads those).
  **New modding surface:** `create_container` script containers, the `on_treaty_ports_inherited`
  on-action and the `renege_treaty_ports_with` effect.

  ✅ **What the re-derivation DID establish — and it stands, because it is measurement rather than
  inference:** none of the vanilla DATA we derive from moved. That is a narrower claim than
  "the patch changed nothing", and it is the one the evidence supports:
  | re-derived artifact | result under 1.13.10 |
  |---|---|
  | `ui/vanilla.js` — every vanilla building, PMG and PM | **byte-identical** |
  | `tools/ladder_tiers.txt` | **byte-identical** |
  | `config/start_baseline.json` — the 1836 inventory + drift alarm | unchanged, `unmapped: []` |
  | `ui/presets.js` | differs **only in its own generation timestamp** |
  | `config/tech_tree_options.json` — display names parsed LIVE from vanilla loc | **identical** |
  ⭐ The tech tree is the one that could have moved on a localization patch, since `tech_tree_spec.mjs`
  reads vanilla's loc for display names. It did not.
  `metadata.json` bumped to 1.13.10.

- **2026-08-12** — ⭐ **THE 1836 STARTING-TECHNOLOGY CHECK IS NOW A TOOL: `tools/verify_start_techs.mjs`.**
  It reads the EMITTED history (ours, via `replace_paths`), resolves each building's and production
  method's `unlocking_technologies` against vanilla plus our owned files, and reports **per country**.
  Point it at an absolute path to run the identical check on pure vanilla — which is the only way to
  tell a gap we introduced from one the base game has always had.
  **Result on 1.13.10:** 6 countries start with something their technologies do not unlock — AUS, FRA,
  PRU, RUS (`fractional_distillation`), BAV (`railways`), SPA (`atmospheric_engine`). **All six are
  present in PURE VANILLA identically**, so the mod introduces none.
  ⚠ Two ways this check reported a false answer before it worked, both worth knowing:
  · **it passed vacuously** — wrong tag regexes matched zero countries and it printed PASSED. Hence
    `assertNonTrivial()`, which refuses to report success unless it found countries, buildings and
    starting sets. A check that cannot fail is worse than no check.
  · **it failed spuriously on 24 countries** — the starting sets grant most of their content through
    `add_era_researched = era_1`, not by naming technologies, so reading only `add_technology_researched`
    made Britain and France look as though they lacked `manufacturies`. The shorthand is expanded now,
    from the MOD's technology eras (our re-eras change who gets what for free).

- **2026-08-09** — **The electricity pass (BALANCE_FRAMEWORK §10.43) adds three vanilla couplings:**
  - **`common/production_methods/06_urban_center.txt` is now OWNED** (whole-file, because of the
    `pm_electric_streetlights` override). Self-healing on a patch — the builder re-reads live vanilla
    every build and re-applies the surgery — but two things can silently drift: (a) the override targets
    the PM **by name**; if a patch renames `pm_electric_streetlights` the build THROWS (an override
    naming an unknown PM is fatal, deliberately); (b) if a patch restructures the PM's
    `building_modifiers` (no `workforce_scaled`/`level_scaled` sub-block) the build also THROWS. Either
    way the failure is loud, not silent — re-point the override and re-check §10.43's arithmetic
    (the £90/level delta assumes vanilla's 3-electricity/10-services shape and base prices 30/30/30).
  - **`MANDATED_PMGS` in `tools/era_pm.mjs` hardcodes the street-lighting ladder** (none@0 / gas@1 /
    electric@3) including the PM names. A patch adding a fourth lighting method (LED? arc?) or renaming
    one leaves the mandate quietly wrong — re-check `pmg_street_lighting`'s member list after a patch.
  - **Power's vanilla anchors narrowed**: `pm_early_power_plant` is no longer any tier's `vanilla_pm`
    (the era-3 tier is deleted; the coal tier keeps the vanilla `building_power_plant` key with tech
    swapped to `steam_turbine`). If a patch gives the power plant a fourth PM or renames
    `pm_coal-fired_plant`/`pm_oil-fired_plant`, the volume solver's anchors and `start_baseline`'s
    unmapped alarm are the tripwires, as for any split industry.

- **2026-07-31** — **Redundancy audit: one price table, one telemetry generator, one results root, one
  history walker; and only CHANGED vanilla files are owned.** No balance numbers moved (both linters give
  byte-identical output before and after; the converted 1836 start is byte-identical). What changed that
  matters on a patch:
  - **`goods_prices.tsv` is now genuinely the only price table.** `lint_profitability.awk` carried a
    hardcoded copy of all 53 goods; it now reads the TSV via `-v PRICES=`. They happened to agree, but a
    post-patch price refresh would have reached everything *except* the linter.
  - **The builder owns only the `common/production_methods/*.txt` it actually changes** (compare-then-skip).
    14 of 15 were verbatim vanilla copies — frozen against future patches for nothing. The negative-goods
    linter now reads vanilla PMs as its base with the mod layered on top.
  - **`Set-Content` without `-Encoding` is a config-corrupting bug on a non-English Windows** —
    `solve_be_targets.ps1 -Write` used it; verified losing an `é` to CP1251 on this machine. All config
    writers use `WriteAllText` + UTF-8 no BOM. See MODDING_NOTES → PS 5.1 traps.
  - **`solve_volumes.ps1` gained `-Config`** (the other two solvers already had it), and it + 
    `make_vanilla_stub.ps1` now parse **fractional** PM quantities via `Get-Num` — the integer-only regex
    captured `0` out of `0.5` rather than skipping it. Vanilla has 58 such lines; none is on a tier's
    `vanilla_pm` today, so nothing moved, but a patch could put one there.
  - **`include_all_buildings` removed** (config bool + `-IncludeAllBuildings`): it was read, logged and
    never used. Untiered buildings still emit their `pm_goods` and, in owned files, their `ai_value`.
  - **Post-build checks now cover the 1836 start**: one history file per vanilla history file, none empty,
    `create_building` blocks present. `replace_paths` makes our copy the only history the engine reads, so
    an empty conversion would delete every starting factory and nothing was checking. The converter also
    clears its output folder first, so a history file a patch *removes* can't linger as a stale copy.
  - **Testbed**: the observer's second telemetry generator is gone (it had drifted to a shorter market
    line and no events); `tools/testbed/sessions/` is the one results root (`runs/`, `batches/` stay
    gitignored); a scheduled run writes flat into its own folder with no duplicate aggregate; the
    scheduler emits a real cross-run `markets_all.tsv` and deletes its `mod_sched_*` build folders.
  - Docs corrected against code: trade-centre `ai_value` is **5000** (not 3000); README scope is **22
    industries / 67 tier buildings**; the harness autosave default is **`five_year`** (not `never`) and the
    autosave enum row here quoted the *wrong* exe enum; the grace prompt is **60 s** (not 30 s); the removed
    `run_batch.ps1` was still referenced.
- **2026-08-03** — **The five-era ladder replaces the BE-target system** (BALANCE_FRAMEWORK §10).
  Balance is now solved as one interdependent economy with prices UNLOCKED, by a Node pipeline.
  **New requirement: Node ≥ 24** (`C:\Program Files\nodejs`) — the PowerShell tools alone can no longer
  reproduce the balance. **New vanilla couplings, all read live and re-derived on rebuild:**
  `extract_vanilla.ps1` now also dumps **every gate a PM can carry** — `unlocking_laws`, `disallowing_laws`,
  `unlocking_geographic_regions`, `unlocking_company_categories`, `unlocking_identity`, `unlocking_religions`,
  `disallowing_religions` — because the solver must never select a PM this country could not run. Verify with
  `node tools/verify_pms.mjs` after any patch: it reads the game files directly and fails on an unreal or
  illegal selection. Specifically it also dumps (a) **per-PM `unlocking_technologies`** plus a **tech→era table**
  from `common/technology/technologies`, used to decide which production method a country of a given era
  actually runs; (b) **per-PM `unlocking_production_methods`** gates; (c) **`common/building_groups`**
  urbanization / `is_subsistence` / parent chain, so the F13 urban-centre rule can run outside PowerShell.
  A patch that moves a tech between eras, adds a PM gate, or changes a group's urbanization now moves the
  solved balance — **re-run `node tools/era_scenarios.mjs --write` after any patch**, then `build.ps1`.
  Run order: `build_era_ladder.mjs --write` → `era_scenarios.mjs --write` → `build.ps1`, never the
  reverse: build_era_ladder is idempotent by DISCARDING model_only tiers, which throws away their volumes.
  `solve_be_targets.ps1` / `solve_volumes.ps1` / `solve_building_cost.ps1` are now **legacy** for tiered
  industries, and `target_be` is a derived drift guard rather than a design input.
- **2026-08-03** — **Slave consumption is a BUILDING purchase, and the scenario panel now reads two new vanilla
  places for it.** Slaves buy nothing; the employing building buys them a basket. New couplings, both read live by
  `extract_presets.ps1`: **`common/defines/00_defines.txt` → `SLAVE_BASKET_DEFAULT/_MIN/_MAX/_SCALED_MIN/
  _SCALED_MAX/_SUBSISTENCE_GOODS_MULT`** (the basket wealth level, its clamp, and the ×0.05 for slaves in a
  subsistence building — the extractor warns per missing key and falls back to 8/1/12/0.5/1.0/0.05, mirrored in
  `ui/builder.html`), and **`common/pop_types/slaves.txt` → `working_adult_ratio`** (0.5, an override of the 0.25
  base, ⇒ 0.75 per head). Removed at the same time: the invented `class_mult.slaves = 0.5`. The subsistence
  multiplier is the dominant term — the share of slaves it applies to is **derived from the scenario's own
  buildings**, not measured, so it needs no per-patch refresh; see FINDINGS F27.
- **2026-08-03** — **REMOVED: the per-good "when can this exist?" year ladder.** With the within-need split
  following supply share, a good the market does not supply already takes a zero share, so gating it a second
  time by calendar year could only make the two disagree. Gone with it: the UI's "Pops may buy" toggles and
  scenario year, `pop_model.need_goods` / `available_from` / per-preset `unlocked`, `unlock_add`/`unlock_drop` and
  `placeholder_defaults.unlock_steps` in `config/presets.json`, and — the reason this entry is here — **the only
  reader of the era start years vanilla writes as COMMENTS in `common/technology/eras`**. That fragile coupling is
  no longer a scenario-preset concern. ⚠ `tools/solve_be_targets.ps1` still reads tech **eras** (not the comment
  years), so the BE ladder's coupling to `common/technology/technologies/*.txt` is untouched. Supersedes the
  2026-07-27 entry below.
- **2026-07-27** *(superseded 2026-08-03 — kept for the record)* — **Which goods pops may want is derived from the
  YEAR, not from any country's technology.** A
  market imports what it cannot produce, so availability is a calendar question: `available_from[good]` = the
  earliest year some building × PM that outputs it can run, from the **era start years vanilla only writes as
  COMMENTS** in `common/technology/eras` (`era_2 = { #1836-1861 }`). That comment is the sole place those years
  appear — if a patch drops or reformats them the extractor warns and falls back to a static ladder
  (`$ERA_YEAR_FALLBACK` = 0/1836/1862/1887/1911), so check it after a patch. Per-preset forcing is
  `unlock_add`/`unlock_drop` in `config/presets.json`. **Scope**: this seeds the "pops may buy" toggles and nothing
  else — deliberately no tech-gating of PMs or goods anywhere in the UI or the mod. Don't extend it. (Supersedes an
  earlier country-tech derivation, removed: `effect_starting_technology_tier_N_tech` is no longer read at all.)
- **2026-07-26** *(twice superseded — kept for the record)* — **Pop demand: flat weights over UNLOCKED goods,
  editable pop counts.** The goods split inside a
  pop need no longer uses V3's supply-share substitution; it is the need's own `weight` over the goods currently
  unlocked (per design: a standard distribution, no substitution modelling). For where "unlocked" comes from, see
  the 2026-07-27 entry above — it is the scenario year, not any country's research.
  ⚠ **Both halves of this are now false.** Supply-share substitution came *back* (it is the game's own documented
  rule and worth 14 pp — FINDINGS F19/F22), and with it the "unlocked" set became redundant and was removed on
  2026-08-03.
- **2026-07-26** — **`Get-Content -Raw` reads config JSON as ANSI.** Every tool now passes `-Encoding UTF8` when
  reading a config file. Windows PowerShell 5.1 defaults to the system ANSI codepage for BOM-less files, so a
  non-ASCII character in `config/*.json` (the `·` in a preset label) came out mojibake in the generated file. Only
  `presets.json` had non-ASCII, but `mod_config.json` was equally exposed — a building name with an accent would
  have been mangled into the mod's localization.
- **2026-07-26** — **Subsistence supply modelled; PM goods are NOT always integers.** The presets now include the
  subsistence buildings (the dominant food/wood/fabric/services supplier at 1836), derived from `arable_land` +
  `subsistence_building` in **`map_data/state_regions`** (a data source no other tool here reads) minus the state's
  real agricultural levels, staffed by the peasant residual. Three vanilla numbers now matter and are worth
  re-checking on a patch: subsistence employment per level (**5 000**, rice paddies **10 000**),
  `DEPENDENT_CONSUMPTION_RATIO` (**0.5** — pop needs are per *working adult*, so per head it is 0.625), and
  peasants' `consumption_mult` (**0.05** — read live, this is the game's own "peasants barely reach the market"
  factor). Separately: vanilla PM goods use **fractions** (58 values: subsistence/urban-centre/agro use 1.0, 0.5,
  0.33) and `extract_vanilla.ps1` was matching `\d+` only, silently truncating them to 0 — fixed (`Get-Num`), and
  `build.ps1` now writes `pm_goods` quantities with **invariant culture** so a comma decimal separator from a
  non-English Windows can never reach a game file. See BUGS_AND_FIXES.
- **2026-07-25** — **Scenario presets added (`ui/presets.js`), with three engine-side assumptions worth
  re-checking.** The UI's scenario panel can now be filled from a country's vanilla 1836 market
  (`tools/extract_presets.ps1`, driven by `config/presets.json`). Three things it must assume because they are
  **not in the game files**: (1) **pop strata** — which profession is upper/middle/lower is engine-side, only
  `officers.txt` even mentions `strata`, so the map lives in the tool (a new profession warns; a *re-stratified*
  one would be silently wrong); (2) **market membership** — no script field says a subject shares its overlord's
  market; the `grant_own_market` pact type (used exactly twice in 1836: NET→LUX, TUR→EGY) is the evidence that
  sharing is the **default**, which is what the tool implements, transitively (so GBR's market is 65 tags,
  including BIC and all of India, and Qing's includes its tributaries); (3) **ownership-building levels** —
  manor houses / financial districts are never `create_building`d, so they are inferred from `add_ownership`
  entries at **one level per owned level**. Also note `common/history/trade/00_historical_trade.txt`
  (`add_exports`) is deliberately **ignored** — the presets assume no trade-route trade.
- **2026-07-23** — **AI subsidy policy added; merge-vs-replace probed, not conclusively settled.** The builder now
  owns `common/ai_strategies/01_admin_strategies.txt` and writes a `subsidies` block into all 7 administrative
  strategies from the top-level `building_subsidies` config map (shipped set: only `building_trade_center =
  must_have`). Whether a typed strategy's `subsidies` **merges** per key with `ai_strategy_default`'s or **replaces**
  it is undetermined from the files, so the builder restates `ai_strategy_default`'s subsidies (read **live** each
  build) *only into strategies that had no block of their own* — correct under both readings. A temporary in-game
  probe (power-plant subsidy state by strategy group) **leaned toward merge** — in 2078 every AI power plant was
  subsidized in *both* the has-own-block group (142/142) and the control group (43/43), with **zero** unsubsidized —
  but this is **late-game data only** (`debug.log` rotated away 1836–2077, losing the discriminating early-
  electrification window ~1862–1890, where a cash-strapped AI would reveal replace if it were true). The late-game
  autonomous subsidy model (`defines NAI SUBSIDIZE_*`) can subsidize power plants on their own merits, so this
  is **suggestive, not decisive**. Probe removed. Left unsettled deliberately: the restatement is correct either
  way; the answer only matters for making `none` suppress the trio and for collapsing the rule to one branch. See
  MODDING_NOTES → *Writing a temporary diagnostic probe* for the `debug_log` scope/token gotchas this surfaced.
- **2026-07-19** — **Wages re-parameterized: fraction of TOTAL, not of goods.** `wage_pct` now means
  `W/(I+W)` (default **0.25**, ≡ the old +33%-over-goods), so the total-cost factor is `1/(1−wage_pct)`
  instead of `(1+wage_pct)`. Economics-neutral (re-solved volumes/costs are ~identical). Updated in all five
  duplication points (both solvers, `build.ps1`, `lint_profitability.awk`, `ui/builder.html`) and the one
  explicit per-tier override (steel 0.3→0.23). The UI wage row is now **two linked editable fields** (% of
  total ↔ £). Framing is bounded 0–100% and forward-compatible with labour-only buildings. Still model-only,
  not emitted. Deferred: rooting wages in real per-profession values.
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
  *(Superseded: the trade centre is **5000** in the shipped config — raised later without a log entry, found
  and reconciled 2026-07-31. Tooling's 2000 is per-tier `ai_value`, not the `building_ai_value` map.)*
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
  *(Superseded: still a no-op two months later, so it was **removed** 2026-07-31 — see that entry.)*
- **2026-07-14** — Shipyards **enabled and split by output good**. The vanilla shipyard's one chain makes
  clippers (basic/complex) then steamers (metal/arc-welding) — a mid-ladder good change — so it's split
  into `shipyard` → clippers and `shipyard_steam` → steamers, each a 2-tier 120/95 chain. History routing:
  vanilla `building_shipyard` start factories map onto the **clipper** line (that's the industry owning
  the `building_shipyard` base key); the steamer line's base (`building_shipyard_metal`) has **no vanilla
  anchor**, so the builder appends it (informational note, not a warning) and any start factory running a
  metal/arc PM would be **unmapped** — but none exist at 1836 (those techs post-date the start), so the
  whole shipyard stock converts cleanly to clippers. If a future patch ships a later bookmark with
  metal/arc shipyards, add `vanilla_pm` routing or a `start_exceptions` rule for them.
- **2026-08-07** — **The pop-need substitution rule was solved against savegame state** (FINDINGS F40).
  The balance model now reads six `common/defines` constants it never touched before, plus
  `common/prestige_goods`; see Manual item 1b. `ui/econ.js` changed one line — availability is
  `(sell − 0.5 × non-pop demand) × BASE price`, a value rather than a unit count — and
  `econ_selftest.mjs` gained nine regression cases taken from a measured 1925 gamestate, so a patch that
  moves any of those constants will show up as a failing selftest rather than as silent drift.

- **2026-07-14** — Wages made explicit. Break-even is now **wage-inclusive** (full BE = (I + wage_pct·I)/O,
  default wage_pct 0.33); the ladder was re-based onto the full-BE scale (light 140/115/90/65, tools one
  tier lower, heavy/mil 120/95/65/40, single-PM 65). `ladder_tiers.txt` gained a 4th `wage_pct` column;
  the wage default is duplicated across five tools (see Baked-in assumptions). Wages are model-only — **not**
  emitted to the game.
- **2026-07-14** — Initial doc. Established: construction £/point = £720 from `pm_iron_frame_buildings`
  (wood 40 + fabric 20 + iron 50 + tools 10 = £3600/wk ÷ 5 pts/wk) at 0 efficiency bonus; economy ticks
  weekly (52/yr); `goods_prices.tsv` is a static price mirror; UI `poundPerPoint` is a static hint that
  can drift; `building_cost` overrides vanilla's flat 200/400/600/800 construction-cost script-values.
