# PM & Tech Rehaul — Victoria 3 mod

An **economic-realism mod for Victoria 3 (1.13 "Matcha")** that addresses structural
deficiencies in the base game's economy.

## Why this mod exists (the goals)

The vanilla economy is too forgiving and makes technology feel cheap. Concretely:

- **A technological edge should really matter.** Falling behind on tech should cost you
  markets; leading should let you out-compete rivals. Vanilla blunts this.
- **The economy should be more competitive and aggressive** — efficient producers should
  drive inefficient ones out of a market, not coexist indefinitely.
- **Upgrading production should cost capital, like it does in reality.** Today, turning an
  1830s-design factory into a 1930s-design one is *free* — you just flip a production method.
  That is ridiculous. A more modern, more efficient plant should have to be **built** (real
  construction cost, real capital demand), not switched on for nothing. This raises the demand
  for capital and creates a realistic capital deficit as economies modernize.

Everything below — "one main PM", "a building per tier", the profitability ladder — is a
**means to those ends**, not the point. If a mechanic doesn't serve the goals above, it's wrong.

## How the goals are achieved (the means)

1. **One main PM per building.** Each economic building keeps a single main production method.
   The old free "switch your factory to a newer method" upgrade path is removed. Secondary /
   redistribution groups (automation, luxury, canning, distillery, glassblowing, …) stay.
2. **A building per tier.** Each former main PM becomes its own building type, unlocked on the
   same technology the old PM used. Modernizing now means *constructing* the newer building —
   spending capital — instead of a free toggle. (This is the mechanism for the capital-demand
   and "tech matters" goals.)
3. **Profitability ladder.** Outputs/inputs are re-sloped so a tier-N building can't stay
   profitable once tier-(N+2) buildings flood the market — so a tech lead actually pushes
   laggards out. Governed by a break-even ladder in `BALANCE_FRAMEWORK.md` (the balance
   source of truth).

Scope now: **all manufacturing + the new-economy chains** — 21 config industries / 63 tier buildings.
The new-economy chains (infra + electricity) are `power` (electricity, **on the BE ladder**), `port`
and `railway` (both `follows_be: false` — kept on **vanilla economics**, informational BE only). They
live in other vanilla files (`06_urban_center`, `11_private_infrastructure`) and are emitted by
**clone-and-swap** (see below); `trade_center` is deliberately left vanilla. Break-even is
**wage-inclusive** (full break-even: output revenue = input goods + wages, wages = `wage_pct`·input cost,
default 33% — a model-only accounting layer, **not** emitted to the game; see BALANCE_FRAMEWORK §1).
**The ladder is a curve over each tier's tech unlock date (era), not a per-industry group ladder.** Each
tier's `target_be` = the era anchor for its unlocking tech's era, minus an early-game input adjustment:
- **Era anchors** (BE % of base output price), by the tech's vanilla era: **e1 125 / e2 100 / e3 75 /
  e4 50 / e5 35** (~25 pp/era, so a 2-era lead sits ~50 pp under → the N+2 obsolescence). There is
  **no within-era differentiation** — every tier on the same era gets the same anchor (the eras will be
  reworked later).
- **H1 manufactured-input discount: −15 pp** if the tier unlocks in **eras 1–3** *and* its recipe
  consumes a **factory-made intermediate** (tools, steel, engines, fertilizer, explosives, paper, glass,
  …). **Dye and silk do NOT count** (RGO/plantation-sourced in H1; see BALANCE_FRAMEWORK §3). Off in
  eras 4–5, where those intermediate markets have matured to ~base.

Targets are derived by **`tools/solve_be_targets.ps1`** (reads each tech's era live from vanilla, writes
per-tier `target_be` + `natural_year`); the UI shows the natural unlock year per tier and per industry.
Volumes then follow the §8 methodology (tier-1 output = vanilla output, ×1.5 per tier, inputs solved from
the full-BE goal with wages folded in).
**Shipyards are enabled and split by output good** into two output-good-consistent 2-tier chains (the
vanilla shipyard produces *clippers* then switches to *steamers* mid-ladder): `shipyard` → clippers
(Basic/Complex, e1/e2 → 125/85) and `shipyard_steam` → steamers (Metal/Arc-Welding, e3/e5 → 60/35). The
steamer chain is all-new buildings (base `building_shipyard_metal`, no vanilla anchor — the builder
appends it). Deferred: more tech tiers, transport/electricity secondary-PM tweaks, and raw-resource
extraction. (The wage layer is now folded into the ladder.)

## Repository layout

```
CLAUDE.md               this file — goals + how to work
README.md               user-facing setup (play the mod, launch the editor) — for GitHub visitors
balance-ui.cmd          one-click launcher for the balance editor (double-click; runs tools\ui.ps1)
BALANCE_FRAMEWORK.md    balance methodology, targets, vanilla baseline, applied changes (SOURCE OF TRUTH)
MODDING_NOTES.md        Victoria 3 engine/tooling gotchas (localization, load order, error.log, …)
ON_GAME_UPDATE.md       what to re-run / re-check after a Victoria 3 patch (version-sensitive touchpoints + drift log)
BUGS_AND_FIXES.md       root-cause log of non-obvious fixed bugs — NOT auto-loaded; CONSULT when investigating a new bug or after a patch
MISSING_PM_REFERENCES.md catalogue of vanilla events/JEs/effects that reference a main PM our tier split relocated (they error+return false → missed flavor). GENERATED by tools/audit_pm_refs.ps1; strategic fix deferred
config/mod_config.json      THE THING YOU EDIT — industries → tiers (tech, target_be, natural_year, output, inputs, building_cost, wage_pct?, employment, names, vanilla_pm, vanilla_pm_aliases?, state_infrastructure?, ship_construction?, ai_value?, output_override?); industry flags source_file?/clone_from_vanilla?/follows_be?/no_mass_be? (new-economy); plus top-level include_all_buildings (build-emission scope flag; see below), building_ai_value (map building_key→ai_value for PRESERVED buildings in owned files, e.g. trade center), and pm_goods (map pm_key→{in:{good:qty},out:{good:qty}} — per-PM goods overrides applied to the owned PM files; any building's PM)
config/start_exceptions.json manual 1836-start overrides (force_tier / remove, scoped by country/state) — editable
config/start_baseline.json   GENERATED inventory of the vanilla 1836 start (per-industry/tier/country + drift check)
tools/                  dev tooling — NOT shipped in the mod
  build.ps1             builder: config → generates all mod/ files + all-language loc + ladder_tiers.txt + 1836 start, then lints
  solve_be_targets.ps1  re-derives every tier's target_be + natural_year from its tech's vanilla era (date ladder; BALANCE_FRAMEWORK §8.1)
  solve_volumes.ps1     re-derives every tier's output/input volumes from vanilla recipes + target_be (BALANCE_FRAMEWORK §8)
  solve_building_cost.ps1 re-derives every tier's building_cost (construction points) from a 10yr-payback model (BALANCE_FRAMEWORK §9)
  extract_vanilla.ps1   dumps EVERY vanilla building/PMG/PM → ui/vanilla.js (the UI's read-only all-buildings explorer); regenerated each build
  audit_pm_refs.ps1     scans vanilla events/JEs/effects for references to main PMs our split relocated → MISSING_PM_REFERENCES.md (diagnostic; not run by build)
  convert_history.ps1   1836 start converter: re-tiers vanilla starting factories, applies start_exceptions.json
  extract_start.ps1     baseline extractor: vanilla start → start_baseline.json (inventory + version-drift alarm)
  history_lib.ps1       shared history parser used by the converter + extractor
  ui.ps1                balance-UI server: serves ui/ at localhost:8777 + POST /api/build (writes config, runs build)
  goods_prices.tsv      shared vanilla price table (build + UI + reference)
  lint.sh / lint_profitability.awk / ladder_tiers.txt   profitability linter (ladder_tiers.txt is GENERATED)
  solve_targets.awk / profit.awk / vanilla_profit_baseline.txt   ad-hoc analysis helpers
ui/                     browser balance editor — builder.html (hand-authored) + data.js + vanilla.js (both GENERATED each build)
mod/                    THE DEPLOYABLE MOD — GENERATED, do not hand-edit
  .metadata/metadata.json                                (hand-maintained, except the mod `name` which the builder suffixes with the build time; has replace_paths for history)
  common/buildings/{01_industry,06_urban_center,11_private_infrastructure}.txt   (generated: WHOLE-FILE replacements of vanilla — 06/11 own the new-economy chains — see MODDING_NOTES)
  common/{production_methods,production_method_groups}/zzz_pm_rehaul_*.txt   (generated, additive)
  common/production_methods/*.txt                        (generated: WHOLE-FILE replacements of EVERY vanilla PM file — remaps secondary-PM gates + applies per-PM goods overrides; verbatim otherwise. Lets any PM's goods be edited without owning building files. See below)
  common/history/buildings/*.txt                         (generated: the re-tiered 1836 start; replaces vanilla via replace_paths)
  common/on_actions/zzz_pm_rehaul_diag.txt               (generated: self-diagnostic tripwire; logs PM_TECH_REHAUL init marker to debug.log at game start — see MODDING_NOTES → Self-diagnostics)
  localization/<lang>/replace/zzz_pm_rehaul_l_<lang>.yml (generated for all 11 languages; replace/ so name overrides win)
```

Only `mod/` is the game mod; the whole repo (docs + tools + config + `mod/`) goes on GitHub.
The deployed mod is a real copy of `mod/` only (see Deployment below), so docs/tools never reach
the game.

## Working conventions

- **Keep the docs in sync with reality — always, in the same pass as the change.** Any change
  that affects behavior, file structure, conventions, scope, or numbers must be reflected in the
  relevant `.md` (`CLAUDE.md`, `BALANCE_FRAMEWORK.md`, `MODDING_NOTES.md`, `ON_GAME_UPDATE.md`,
  `README.md`) right then. In particular, any new coupling to a vanilla file/number goes in
  `ON_GAME_UPDATE.md`.
  Never leave a doc describing something that is no longer true, and never leave a doc update
  "hanging" for later. **One narrow exception:** when a change is a *proposed* solution the user is
  still weighing and its outcome is genuinely uncertain, the doc update may be briefly deferred —
  but call out the divergence explicitly and reconcile it the moment it settles (bring the docs to
  the facts, or the facts to the docs). Resolve such gaps as soon as possible, not eventually.
- **Edit the config, not the generated files.** The mod content lives in
  `config/mod_config.json`. To change balance or add/split buildings, edit that, then run the
  builder:
  ```
  powershell -ExecutionPolicy Bypass -File tools\build.ps1
  ```
  It regenerates every `mod/common/*` and `mod/localization/*` file, regenerates
  `tools/ladder_tiers.txt`, **converts the 1836 start** (re-tiers vanilla starting factories into
  `mod/common/history/buildings/` via `convert_history.ps1`), and then runs the linter — which
  must print **LINT PASSED**, then **MOD CHECKS PASSED** (post-build sanity on the finished mod:
  required files exist + non-empty, one loc file per language — the hook for future mandatory
  checks lives in `Invoke-ModChecks` in `build.ps1`). Never hand-edit files under `mod/common` or
  `mod/localization`; they are overwritten on every build. To build from a **different config
  file** (e.g. an alternate balance set exported from the UI) without touching
  `config/mod_config.json`, pass `-Config <path>` — `build.ps1` threads it through the start
  extractor and history converter too, so the whole build uses that file. Default is
  `config/mod_config.json`. Other flags: `-NoLint`, `-NoDeploy`.
- **Build somewhere other than `mod/` (for tests / alternates).** By default the build writes the
  canonical `mod/` and deploys it. Two flags redirect the output and **never touch `mod/`** (nor
  `tools/ladder_tiers.txt`, `ui/data.js`, or `config/start_baseline.json` — alt builds only ever
  write their own folder):
    - `-DryRun` — build a full, real mod into a throwaway `mod_dryrun_<pid>/`, run the linter +
      `Invoke-ModChecks` on it, report, then **delete** the folder. Never deploys. Use this to
      verify a config/build safely (**prefer it for test builds** so a build never silently
      rewrites `mod/`).
    - `-SaveTo <name>` — build into `mod_<name>/` inside the repo and **keep** it (not deployed,
      not deleted; clean up manually). For alternate balance sets you want to compare/keep.
  `-DryRun` and `-SaveTo` are mutually exclusive.
- **The 1836 start is converted, not hand-authored.** `convert_history.ps1` reads vanilla
  `common/history/buildings/*.txt` and maps each split-industry factory (base building + active
  main PM) onto the correct tier building, keeping ownership + secondary PMs. metadata.json's
  `replace_paths` makes the mod's copy replace vanilla's, so **rebuild after any game update** to
  pick up new vanilla history. Uses the `vanilla_pm` field per tier in the config.
- **Manual start overrides** live in `config/start_exceptions.json`: rules targeting a vanilla base
  building, optionally scoped to a `country` (region_state tag) and/or `state`, with action
  `force_tier` (set tier N regardless of vanilla PM) or `remove` (delete the factory). Most
  specific scope wins. Default is an empty `rules` list (pure mechanical conversion). To author
  rules, browse `config/start_baseline.json` (regenerated each build by `extract_start.ps1`) to see
  which countries/states have which factories. That baseline's `unmapped` list is also the
  **version-drift alarm**: if a game update renames/adds main PMs, unmapped factories appear there,
  telling you to refresh the config's `vanilla_pm` fields.
- **Config holds ACTUAL volumes.** `inputs` and `output_qty` are the real per-throughput numbers
  the game uses; the builder emits them directly. `target_be` is the design goal (informational) and
  now means **full** break-even (output revenue = input goods + wages). The linter re-checks each
  building's actual full break-even (building-level: main PM + the base PM of every other PMG, plus
  wages = `wage_pct`·inputs) against its configured `target_be` (±6pp). This per-target check supports
  the date-based ladder (era anchors 125/100/75/50/35 with the H1 −15 pp input adjustment; targets set by
  `solve_be_targets.ps1`). `tools/ladder_tiers.txt` carries `pm tier target_be wage_pct`.
- **BE targets are derived from tech unlock date.** `tools/solve_be_targets.ps1` reads each tier's
  unlocking tech's **era** live from vanilla `common/technology/technologies/*.txt` and writes per-tier
  `target_be` (era anchor − H1 input discount, above) and `natural_year` (the era's representative year,
  shown in the UI). Run it **before** `solve_volumes.ps1` when eras/anchors change or after a game patch:
  `solve_be_targets.ps1` → `solve_volumes.ps1` → `solve_building_cost.ps1` → `build.ps1`. It is a
  design-target solver, not run by `build.ps1`.
- **Volumes are derived, not hand-tuned.** `output_qty`/`inputs` come from `tools/solve_volumes.ps1`
  (BALANCE_FRAMEWORK §8): tier-1 output = the vanilla tier-1 PM's output, higher tiers ×`output_mult`
  (default 1.5) per tier, inputs solved from `target_be` (with wages folded in: `I = target_be/100 ·
  O / (1+wage_pct)`) keeping vanilla input ratios. It re-reads the
  **current** vanilla recipes (via each tier's `vanilla_pm`), so after changing a `target_be`/`output_mult`
  or after a game update: run `solve_volumes.ps1`, then `build.ps1`. (The UI edits volumes directly;
  the solver regenerates them from the methodology.)
- **Building cost is derived too.** Each tier's `building_cost` (construction points) is emitted as the
  building's `required_construction` (a per-tier number now — it replaces vanilla's flat
  `construction_cost_high`/`_very_high` script-values; the building-level `required_construction` in the
  config remains only as a fallback for tiers without `building_cost`). Values come from
  `tools/solve_building_cost.ps1` — a 10-year-payback model (BALANCE_FRAMEWORK §9): `building_cost =
  10yr × 52wk × (20% net return on total operating cost) ÷ £720-per-construction-point`, where £720 is
  read live from the construction sector's iron PM at 0 efficiency bonus. Re-solve after changing volumes
  or a game patch: `solve_volumes.ps1` → `solve_building_cost.ps1` → `build.ps1`. The model's knobs
  (margin %, payback years, weeks/yr) are solver parameters; **wages** use the shared `wage_pct` (default
  0.33, per-tier `wage_pct` override — the same knob the volume solver, linter, and UI use; §1). The UI
  preserves `building_cost` through export/Build-now (it deep-clones the config), but does not itself edit it.
- **Toggle a whole industry** with an industry-level `disabled: true` in the config — the builder,
  history converter, and UI all skip it, leaving that vanilla building untouched (the mechanism that
  formerly kept shipyards vanilla; no industry is disabled now). Building-level flags: `heavy_industry_law` (emits the industry-ban /
  extraction-economy `possible` block), `coastal_only` (emits `potential = { is_coastal = yes }`),
  and a per-tier `output_good` override (e.g. clippers→steamers). `mod_config.json` is stored
  **minified**; edit it via the balance UI, or with JSON-aware tooling (add industries by merging
  with PowerShell `ConvertTo-Json -Compress`), not by hand.
- **New-economy industries (clone-and-swap) — power / port / railway.** These vanilla buildings carry
  engine-critical fields our simple schema can't model (`port = yes`, `terrain_manipulator`, big
  `ai_value`/`should_auto_expand` blocks, `potential`). So an industry with **`clone_from_vanilla: true`**
  is emitted by *copying its vanilla building block* and surgically swapping only key / tech / PMGs /
  (construction) — everything else verbatim (`New-ClonedBuilding` in build.ps1). It also needs
  **`source_file`** (the vanilla `common/buildings/*.txt` we whole-file-own for it — `06_urban_center` for
  power, `11_private_infrastructure` for port/railway; the builder now owns **01 + 06 + 11**). Two more
  industry flags: **`follows_be: false`** (port/railway — stay on vanilla volumes: the volume / BE-target /
  building-cost solvers skip them, the linter ladder skips them, the building name omits the BE target) and
  **`no_mass_be: true`** (all three — excluded from the linter ladder and, in the UI, locked-by-default so
  the mass BE tools + preset never touch them). Per-tier **`state_infrastructure`** is emitted as a
  workforce-scaled `state_infrastructure_add` (ports/railways produce infrastructure). Power is on the BE
  ladder normally (electricity output; `output_override` keeps its vanilla per-tier electricity). Their PMs
  are our own copies (editable), so `solve_volumes` reads **every** `common/production_methods` file, not
  just `01_industry`. `trade_center` stays vanilla (no tiers). `1836` ports/railways are re-tiered by
  `convert_history` like any split industry.
- **Secondary-PM gates (`unlocking_production_methods`).** A few vanilla secondary PMs are gated behind a
  main PM: `pm_bone_china` (glass porcelain), `pm_elastics` (textile luxury), `pm_precision_tools`
  (furniture luxury) each have `unlocking_production_methods = { <vanilla main PM> }` — only available when
  that main PM is present in the building. Splitting each main PM into its own renamed building broke the
  gate (the secondary silently locked). Fix: the builder **whole-file-replaces `common/production_methods/01_industry.txt`**
  and, for every `unlocking_production_methods` list, **appends our tier `pm_key`** for each split
  vanilla main PM it references (map: `vanilla_pm`→`pm_key`). The secondary then unlocks at exactly the
  tiers whose main PM satisfied it in vanilla (e.g. bone china at glass T3/T4). Everything else in the file
  is copied verbatim; the linter reads vanilla's copy + our `zzz`, so it's untouched. New gated secondaries
  a patch adds are picked up automatically on rebuild.
- **Balance UI (for Claude-less iteration):** one-click **`balance-ui.cmd`** (or
  `powershell -ExecutionPolicy Bypass -File tools\ui.ps1`) opens a browser editor (`ui/builder.html`)
  showing every building × tier with editable input/output volumes + an editable **wages %** line (per-tier
  `wage_pct`, default 33% of input-goods cost), live **full** break-even + per-good-threshold **full
  profitability** ((output − inputs − wages)/(inputs + wages)), an editable **Build cost** column
  (construction points → `required_construction`, with a muted "model N" hint that turns amber when the
  stored value diverges from what `solve_building_cost.ps1` would set), a read-only **Payback** column
  (years = build cost × £720/point ÷ annual net profit at the current price panel; wages per the row's
  wage %, at base input cost; **∞** when unprofitable at current prices), a
  break-even-ladder chart, config-part save/load (version-tolerant), and snapshot history. **Payback
  tools** (selectable X years) come in two actions at three levels: **$ = set build cost** (fix prices,
  set build cost so payback = X) and **% = set prices** (fix build cost, scale that industry's output +
  input prices by one factor — keeping the IO ratio + input mix — so an anchor tier's payback = X; flags
  prices leaving the 25–175% band). The three levels: **tier** (the `$`/`%` buttons on each row, anchor =
  that tier), **group/vanilla-industry** (the `group $→X`/`group %→X` buttons in each card header, anchor
  = the group's Tier-1), and **whole sheet** (the `sheet …` toolbar buttons — every group, anchor = each
  group's Tier-1). **Group locks:** each card header has a 🔒 lock toggle (plus toolbar `🔒 all` / `🔓
  all`); a locked group is **excluded from every mass editor** — the **Restore-defaults** preset, the sheet
  payback buttons, and its own group/tier payback buttons (which grey out) — while manual field edits stay
  allowed. Locks are UI-session state (reset on reload). The **Restore defaults** button resets each in-scope
  **unlocked** group to its as-loaded config values (target BE, volumes, build cost, ai_value, secondary PMs)
  — i.e. what a page refresh produces, but honoring current locks (a page refresh restores all defaults **and**
  lockedness). More named presets will come later; this button is just the reset. **Base `ai_value`**
  (building AI construction desire) is editable everywhere: on **our tier rows** (per-tier `ai_value` in the
  config; blank = engine default 1000) and on **every explorer building** (a `data-refaiv` field backed by
  the top-level **`building_ai_value`** map). The builder emits ai_value for buildings in files it owns —
  our tiers, and PRESERVED buildings in `01/06/11` via `building_ai_value` + `Set-BuildingAiValue` (used to
  set **trade center = 3000**, 3× the vanilla default, and **tooling = 2000** at all tiers, matching
  vanilla); explorer edits to non-owned buildings show but don't emit yet. The UI's default display reads
  each building's vanilla `ai_value` from `vanilla.js` (now extracted). **"Build now"** writes the config and runs the full build (needs the `ui.ps1` server — a
  browser can't run programs). Everything else works **frontend-only**: opening `ui/builder.html`
  directly still edits + previews + **Export mod_config.json** (then run `build.ps1` yourself).
  User-facing setup lives in `README.md`.
- **All-buildings explorer + `include_all_buildings`.** The UI **always** shows every vanilla building,
  not just our tiered industries: our industries stay editable cards (now each tier also exposes its
  **secondary PMGs** — canning, luxury, automation, … — as PM dropdowns whose selection folds into that
  tier's BE/profit, matching the linter's building-level view; default = base/"off" PM, so nothing moves
  until you switch). Below them, **every other vanilla building** is a **PM explorer with editable goods
  I/O**: pick a PM per PMG, and **edit its input/output quantities** (number fields; BE / £ in-out update
  live via a `REFEDIT` override keyed by PM). Only **secondary effects** (state_infrastructure,
  pollution, bureaucracy, trade capacity, ship construction, …) stay read-only. **Goods edits are
  config-backed and emitted**: they persist to the top-level **`pm_goods`** map, which the builder writes
  into the owned production-methods files, so an edit to a PM applies to **every** building that uses it
  (our tier main PMs stay per-tier; every *other* PM — non-economic buildings' PMs *and* our tiers'
  secondary PMs, now editable on the tier cards too — go through `pm_goods`). These are sorted into
  a **custom taxonomy** (not raw `building_group`): a `#econref` block of **"Other economic buildings"**
  right under our industries (Utilities & trade = ports/railways/trade/power — vanilla values, only power
  will follow our BE ladder; and Arts), then the `#reference` explorer clustered **Food & agriculture
  (arable land)** → **Raw resource extraction** (mining, gold fields, logging, oil, rubber) → **Other**
  (military consumers, property owners, administration, fishing & whaling, subsistence, service,
  construction, Unique buildings). The map is `GRPCAT`/`CATLABEL`/`REF_CLUSTERS` in `ui/builder.html`
  (keyed by vanilla `building_group`; unmapped groups fall back to their own card in the Other cluster).
  All PM data comes from `ui/vanilla.js` (regenerated every build by `extract_vanilla.ps1`; UI-only, never
  shipped). PM *selections* in the explorer are session-only (which PM is active is the game's runtime
  choice); PM *goods* edits are saved/emitted via `pm_goods` (above).
  **`include_all_buildings`** is a **builder** flag (top-level bool in `mod_config.json`, default `false`;
  `build.ps1 -IncludeAllBuildings` forces it on) — it is the **emission scope** for the untouched
  buildings (whether they'd reach an exported config / the built mod), **not** a UI visibility switch. The
  headless builder reads it (logs the mode); the UI only preserves it on export. We do **not** tier or edit
  those buildings yet, so today the flag has nothing extra to emit — it's the gate for when we do.
- **Localization is generated for all 11 languages** — every added key gets an English stub in
  every language file, because untranslated keys show as raw `<key>` placeholders for non-English
  players (no reliable English fallback). This is handled by the builder; you never write loc by
  hand. See MODDING_NOTES.md → Localization. In-game building names are auto-formatted as
  `Tier N. <name>. BE target <actual on-build full BE>%` (e.g. "Tier 1. Bakery Food Industries. BE target 140%";
  BE here is the wage-inclusive full break-even).
- **After an in-game load, check `error.log`** (see MODDING_NOTES.md) — the linter checks
  economics, not engine errors. The builder also emits a **self-diagnostic** on_action
  (`mod/common/on_actions/zzz_pm_rehaul_diag.txt`) that logs a `PM_TECH_REHAUL: init OK … (build <ts>)`
  marker to `logs/debug.log` at game start (absent marker ⇒ mod failed to load). **Convention:** when a
  change might trip something the linter can't see, add an invariant tripwire inside `pm_tech_rehaul_diag`
  (logs `PM_TECH_REHAUL WARN …` on failure), then have the user run the game (init fires at the 1836 start;
  ~1 in-game day, or to 01.02.1837 for a first pulse) and read back `debug.log` + `error.log`. See
  MODDING_NOTES → Self-diagnostics.
- Read `MODDING_NOTES.md` before touching metadata, load order, or icons.
- The only hand-maintained file inside `mod/` is `.metadata/metadata.json` — and even there the
  builder suffixes the mod `name` with `(built yyyy-MM-dd HH:mm)` each build (stripping the prior
  suffix so it never accumulates), so the Paradox launcher's mod list makes the freshest build
  obvious. The mod `id` stays fixed, so playset membership is unaffected.

## Deployment / testing

`build.ps1` deploys a **real copy** of `<repo>\mod` to
`Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul` (via `robocopy /MIR`) at the end of
every build. A directory **junction does NOT work** — the Paradox launcher won't traverse it and
shows the mod as ~48 bytes; a real copy is required. Pass `-NoDeploy` to skip. After a build,
restart the Paradox launcher if it was open (it only rescans local mods on startup), then add
"PM and Tech Rehaul" to a playset to load it.
