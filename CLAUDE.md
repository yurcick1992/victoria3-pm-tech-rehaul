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

Scope now: **all manufacturing** — 17 industries / 49 tier buildings. Break-even ladders (relaxed
by −20 pp in v0.2): light (food, textile, furniture, glass, tooling, paper) at **120/95/75/55**;
heavy + military (fertilizer, explosives, steel, motor, automotive, arms, artillery, munitions) at
**90/70/50/30**; single-PM **synthetics + electrics at 100** (set by input depth). Volumes follow
the §8 methodology (tier-1 output = vanilla output, ×1.5 per tier, inputs solved from the BE goal).
**Shipyards are intentionally left vanilla for now** (industry-level `disabled: true` in the config
— data kept, one flag to re-enable). Deferred: shipyards, the wage/total-profitability balance
layer, more tech tiers, transport/electricity secondary-PM tweaks, and raw-resource extraction.

## Repository layout

```
CLAUDE.md               this file — goals + how to work
README.md               user-facing setup (play the mod, launch the editor) — for GitHub visitors
balance-ui.cmd          one-click launcher for the balance editor (double-click; runs tools\ui.ps1)
BALANCE_FRAMEWORK.md    balance methodology, targets, vanilla baseline, applied changes (SOURCE OF TRUTH)
MODDING_NOTES.md        Victoria 3 engine/tooling gotchas (localization, load order, error.log, …)
config/mod_config.json      THE THING YOU EDIT — industries → tiers (tech, target_be, output, inputs, employment, names, vanilla_pm)
config/start_exceptions.json manual 1836-start overrides (force_tier / remove, scoped by country/state) — editable
config/start_baseline.json   GENERATED inventory of the vanilla 1836 start (per-industry/tier/country + drift check)
tools/                  dev tooling — NOT shipped in the mod
  build.ps1             builder: config → generates all mod/ files + all-language loc + ladder_tiers.txt + 1836 start, then lints
  solve_volumes.ps1     re-derives every tier's output/input volumes from vanilla recipes + target_be (BALANCE_FRAMEWORK §8)
  convert_history.ps1   1836 start converter: re-tiers vanilla starting factories, applies start_exceptions.json
  extract_start.ps1     baseline extractor: vanilla start → start_baseline.json (inventory + version-drift alarm)
  history_lib.ps1       shared history parser used by the converter + extractor
  ui.ps1                balance-UI server: serves ui/ at localhost:8777 + POST /api/build (writes config, runs build)
  goods_prices.tsv      shared vanilla price table (build + UI + reference)
  lint.sh / lint_profitability.awk / ladder_tiers.txt   profitability linter (ladder_tiers.txt is GENERATED)
  solve_targets.awk / profit.awk / vanilla_profit_baseline.txt   ad-hoc analysis helpers
ui/                     browser balance editor — builder.html (hand-authored) + data.js (GENERATED each build)
mod/                    THE DEPLOYABLE MOD — GENERATED, do not hand-edit
  .metadata/metadata.json                                (hand-maintained, except the mod `name` which the builder suffixes with the build time; has replace_paths for history)
  common/buildings/01_industry.txt                       (generated: WHOLE-FILE replacement of vanilla — see MODDING_NOTES)
  common/{production_methods,production_method_groups}/zzz_pm_rehaul_*.txt   (generated, additive)
  common/history/buildings/*.txt                         (generated: the re-tiered 1836 start; replaces vanilla via replace_paths)
  localization/<lang>/replace/zzz_pm_rehaul_l_<lang>.yml (generated for all 11 languages; replace/ so name overrides win)
```

Only `mod/` is the game mod; the whole repo (docs + tools + config + `mod/`) goes on GitHub.
The deployed mod is a real copy of `mod/` only (see Deployment below), so docs/tools never reach
the game.

## Working conventions

- **Keep the docs in sync with reality — always, in the same pass as the change.** Any change
  that affects behavior, file structure, conventions, scope, or numbers must be reflected in the
  relevant `.md` (`CLAUDE.md`, `BALANCE_FRAMEWORK.md`, `MODDING_NOTES.md`, `README.md`) right then.
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
  must print **LINT PASSED**. Never hand-edit files under `mod/common` or `mod/localization`;
  they are overwritten on every build.
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
  the game uses; the builder emits them directly. `target_be` is the design goal (informational).
  The linter re-checks each building's actual break-even (building-level: main PM + the base PM of
  every other PMG) against its configured `target_be` (±6pp). This per-target check supports the
  coexisting ladders (light 120/−20, heavy+military 90/−20, single-PM 100). `tools/ladder_tiers.txt`
  carries `pm tier target_be`.
- **Volumes are derived, not hand-tuned.** `output_qty`/`inputs` come from `tools/solve_volumes.ps1`
  (BALANCE_FRAMEWORK §8): tier-1 output = the vanilla tier-1 PM's output, higher tiers ×`output_mult`
  (default 1.5) per tier, inputs solved from `target_be` keeping vanilla input ratios. It re-reads the
  **current** vanilla recipes (via each tier's `vanilla_pm`), so after changing a `target_be`/`output_mult`
  or after a game update: run `solve_volumes.ps1`, then `build.ps1`. (The UI edits volumes directly;
  the solver regenerates them from the methodology.)
- **Toggle a whole industry** with an industry-level `disabled: true` in the config — the builder,
  history converter, and UI all skip it, leaving that vanilla building untouched (used to keep
  shipyards vanilla for now). Building-level flags: `heavy_industry_law` (emits the industry-ban /
  extraction-economy `possible` block), `coastal_only` (emits `potential = { is_coastal = yes }`),
  and a per-tier `output_good` override (e.g. clippers→steamers). `mod_config.json` is stored
  **minified**; edit it via the balance UI, or with JSON-aware tooling (add industries by merging
  with PowerShell `ConvertTo-Json -Compress`), not by hand.
- **Balance UI (for Claude-less iteration):** one-click **`balance-ui.cmd`** (or
  `powershell -ExecutionPolicy Bypass -File tools\ui.ps1`) opens a browser editor (`ui/builder.html`)
  showing every building × tier with editable input/output volumes, live break-even + per-good-threshold
  profitability, a break-even-ladder chart, config-part save/load (version-tolerant), and snapshot
  history. The `natural BE` preset sets target BE to 110% at tier 1, −20pp per tier, and re-solves
  volumes. **"Build now"** writes the config and runs the full build (needs the `ui.ps1` server — a
  browser can't run programs). Everything else works **frontend-only**: opening `ui/builder.html`
  directly still edits + previews + **Export mod_config.json** (then run `build.ps1` yourself).
  User-facing setup lives in `README.md`.
- **Localization is generated for all 11 languages** — every added key gets an English stub in
  every language file, because untranslated keys show as raw `<key>` placeholders for non-English
  players (no reliable English fallback). This is handled by the builder; you never write loc by
  hand. See MODDING_NOTES.md → Localization. In-game building names are auto-formatted as
  `Tier N. <name>. BE target <actual on-build BE>%` (e.g. "Tier 1. Bakery Food Industries. BE target 120%").
- **After an in-game load, check `error.log`** (see MODDING_NOTES.md) — the linter checks
  economics, not engine errors.
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
