# REPO_GUIDE — what every file and tool in this repository is for

The reference catalogue behind `CLAUDE.md` (which holds the goals, principles, metrics, the canon and the hard rules, and is loaded into every
session). This file is NOT auto-loaded: read the section you need. It describes what each file or tool IS, how to run it, what calls it, and the
traps that bite a user of it; the reasons live in `BALANCE_FRAMEWORK.md` (§), the measurements in `FINDINGS.md` (F), the guardrails in
`TESTBED_LANDMINES.md` (L), the procedure in `TESTBED_OPERATIONS.md`, and the terms in `GLOSSARY.md`.

**Status words:** *current* · *current (build step)* — run by `tools/build.ps1` · *probe-only* — for probe books, never the canon · *record* — kept
as the record of something measured or retired, not used today · *six-rung, retired* — machinery of the closed six-rung book, which throws on the
canon unless `MOD_CONFIG=config/mod_config.six_rung.json` · *superseded by X*.

**Keep it true in the same pass as the change**: a file or tool added, changed or retired updates its entry here.

**Contents**
1. Top-level files and `config/` — the documents, the canon and its twin, the config schema, the book catalogue, the data files
2. Tool conventions, the four-rung book generators, analysis tools, extractors, UI tooling, the six-rung machinery
3. The build pipeline — what `build.ps1` runs in order, the linters, the content emitters, the book makers, shared libraries, `mod/`
4. The testbed — harness, post-run processing, the savegame instrument, the ledger and every reader
5. The balance editor — files, how the sheet loads and writes, UI principles, the model it implements, presets, the other pages

---

## 1. Top-level files and `config/`

### Top-level files

- **`balance-ui.cmd`** — double-click launcher for the balance editor; runs `tools/ui.ps1` (serves `ui/` at localhost:8777, Build now works).
- **`balance-snapshot.cmd`** — writes a self-contained snapshot of the editor (`tools/bundle_ui.mjs`) to `balance_ui_snapshot.html` at the
  repo root (gitignored): one file, no server, the config as of that moment, stamped in a dated banner. Export works in the downloaded file,
  not in a published artifact.
- **`README.md`** — user-facing setup (playing the mod, launching the editor), for GitHub visitors.
- **`CLAUDE.md`** — goals, governing rulings, working rules; auto-loaded into every agent session.
- **`GLOSSARY.md`** — the terminology sheet: every metric letter (world GDP, pool GDP, W, U\*, H, Y, T0–T3, PI, PP, PM, the loss, σ), the
  scopes, time windows, the two statistics conventions ("CI" = the percentile interval of vanilla's seeds), the ladder terms (tier vs tech era,
  A, B, C, in0, target_be, book, canon), economics and process terms. Names things, rules on nothing.
- **`BALANCE_FRAMEWORK.md`** — the balance source of truth: every ruling, §-numbered, with a status index at the top; the sections that no
  longer govern anything are verbatim in **`BALANCE_FRAMEWORK_ARCHIVE.md`** (a stub with their headings stays in place).
- **`FINDINGS.md`** — what the testbed has established (F-numbered), numbers copied in full; appended after every measurement batch. An index
  in number order sits at the top; entries about retired lines are verbatim in **`FINDINGS_ARCHIVE.md`** (a pointer heading stays in place).
- **`ROADMAP.md`** — the plan: a status table for steps 0–14, what is ahead for 1.0 / 1.1 / later, then per-step detail (step 8 the first
  playtest's defect list, steps 10–14 the input penalty, trade and finishing, crafts, merges, the last tech rework).
- **`BACKLOG.md`** — every open item, one line each with status (NOW / OPEN / RULING / DEFERRED / RESEARCH / DEFECT / WATCH) and a pointer to
  the doc with the detail; committed (unlike the handover) and kept true in the same pass as the change.
- **`POLISH_1_0.md`** — the mod 1.0 polish register: each item's DONE / RULING / READY / VERIFY state, the rulings asked, the order (script and
  economics before the alternating batch, text and art after), and source notes on where the two subagent reports' items went (the
  appendices were collapsed 2026-10-24).
- **`MODDING_NOTES.md`** — Victoria 3 engine and tooling gotchas (localization, load order, error.log, headless runs, debug mode).
- **`ON_GAME_UPDATE.md`** — what to re-run or re-check after a game patch; every coupling to a vanilla file or number, plus the drift log.
- **`BUGS_AND_FIXES.md`** — root-cause log of non-obvious fixed bugs, newest first under a dated index; consult when investigating a new bug or
  after a patch. The retired six-rung solver's entries are verbatim in **`BUGS_AND_FIXES_ARCHIVE.md`**.
- **`TESTBED_METRICS.md`** — what telemetry can and cannot log, with in-game-verified data-function syntax; read before adding a metric.
- **`TESTBED_LANDMINES.md`** — the register of defects where nothing fails (L-numbered), each with a detector that `tools/preflight.ps1`
  runs inside every `build.ps1` and before every batch. A new landmine gets an entry, a `Test-Lm<ID>`, and a proof that it trips.
- **`TIER_REFERENCE_AUDIT.md`** — every vanilla script position that references a tiered industry (86 blocks, file:line, verdict, fix) and
  the rulings on each. Status: implemented 2026-10-21 as `tools/emit_vanilla_refs.mjs`; the doc is the current catalogue the emitter
  implements (its §5.1 says what is emitted, §5.2 what to do after a patch), and a new case is catalogued there first.
- **`MISSING_PM_REFERENCES.md`** — vanilla events / journal entries naming a relocated main method; generated by `tools/audit_pm_refs.ps1`.
  Status: superseded by `TIER_REFERENCE_AUDIT.md` (stale: lists railway and shipyard methods, old paths).
- **`MISSING_BUILDING_CONDITIONS.md`** — conditional fields inside vanilla buildings we regenerate that our emitted building drops; hand-
  maintained, directly fixable, deferred. Still accurate.
- Gitignored, never committed: `HANDOVER.md` (the next session's baton), `status_board*.html`, `balance_ui_snapshot*.html`, `mod_*/`.

### config/ — the canon and its twin

- **`config/mod_config.json`** — the canon: what `build.ps1` builds and deploys by default. A verbatim copy of the named book
  `config/mod_config.jex-dam4s-rs-x25-m10ac-dpriv-wm99.json` (sha256 `728f2c7f84e6f467` since the 2026-10-21 polish). Four rungs per industry on
  tiers t0–t3 (anchors 1836 / 1875 / 1905 / 1940), 17 tiered industries / 56 rungs, of which six t0 rungs are 500-worker craft rungs and six
  are merged into their host as second main methods; every industry anchored at t1 (A 2.2, B 1.64, cost ratio 1.9, in0 1.2, down-step 1.5,
  pop-good lift 1.2, the motor rungs unlifted), ai_value 1,000 / 1,000 / 3,000 / 5,000 by tier with crafts at 800, research journal entries,
  per-good trade weights, dams on four resource-slot classes with private construction, the world-market monopoly threshold 0.99. Port,
  shipyards, railway and power are vanilla: they are absent from `industries`, not `disabled`. Stored minified on one line; change it through
  the generators, the balance UI or JSON-aware tooling, then build. Status: current. Refs: §10.99, §10.101, §10.102.
  Traps: canonising means copying a named book's bytes over both canon files and keeping the named copy identical (compare sha256). To
  regenerate it, re-run the chain whose commands sit in the provenance records (`_ab.command` → `_trade_variant` → `_dams_variant` →
  `_artisan.command` → `_merge.command` → `_research_extra_variant` → `_dam4_variant` → `_research_levers_variant` → `_research_rework_variant`
  → `_research_society_variant`, then `dams.private`, `game_defines` and the polish keys). Only the last link, `jex-dam4s-rs-x25-m10ac`, is
  committed; every earlier intermediate (`tier4-e1`, `e1a12-ai1135-*-m10ac`, `jex-dam4s-m10ac`, `jex-dam4s-rl/rb-x25-m10ac`) is gitignored,
  so a full regeneration starts from `make_tier4_config.mjs --derive motor` under `TIER4_SUFFIX=tier4-e1`. The `_canon` record inside is
  inherited from `canon4v-hai3` and does not name the current canon.
- **`config/tech_tree_options.json`** — the canon's tree twin (sha256 `04ac513168388956`): one option, `tier4` "Four-rung, vanilla" — 182
  technologies, vanilla's names, eras and prerequisites, plus three minted ones (`spray_finishing`, `continuous_web_processing`,
  `catalytic_synthesis`), one era move (`vulcanization` 3 → 4) and one added prerequisite (`conveyors` before `compression_ignition`, §10.93
  rule 7). Written by `make_tier4_techs.mjs`; read by `emit_techs.mjs`, `emit_research_events.mjs`, `lint_tier_eras.mjs` and the build's
  `PMDATA.techs` index. Status: current. Traps: the tree page (`ui/techdata.js`) is a 2026-08-12 six-rung copy, not this file (BACKLOG).
  The six-rung candidate trees live in `config/tech_tree_options.six_rung.json`.
- **Twins and committing books.** Every book `config/mod_config.<sfx>.json` needs `config/tech_tree_options.<sfx>.json`: `emit_techs.mjs`
  and `emit_research_events.mjs` derive the tree file from the config's file name (`MOD_CONFIG` first), and a missing twin kills the build
  (landmine L20 checks before any file is emitted). Never "fix" this by falling back to the canonical tree — that pairs one book's
  buildings with another's technologies. The book generators copy their base's twin, so a twin inherited from an old intermediate can miss a
  later tree change; when a book's tree should be the canon's, compare the sha256. Both `config/mod_config.*.json` and
  `config/tech_tree_options.*.json` are gitignored: a book is committed only by an explicit `!config/…` line for it and its twin in
  `.gitignore` (about 110 of each today). The `!config/mod_config.era6.json` line names a file that is not in the repo.
- **`config/mod_config.six_rung.json`** + twin — the retired six-rung book (solver2f: 100 rungs on six tiers, the inverse-solved recipe book,
  payback-normalized costs). Status: six-rung, retired for good (§10.80); its machinery runs only under
  `MOD_CONFIG=config/mod_config.six_rung.json` and throws on any four-rung book.

### config/mod_config.json — the schema

The config holds actual volumes; `build.ps1` emits them directly. The fields below are what the canon carries; "other books" marks a field
read by the builder or an emitter that no current canon key sets.

**Per industry** (`industries[]`): `id`, `output_good`, `secondary_pmgs` (vanilla secondary groups carried by every rung), `source_file` (the
vanilla buildings file the build whole-file-owns for it), `building` (shared building fields: `building_group`, `icon`, `background`,
`city_type`, `levels_per_mesh`, `ownership_type`, `ai_nationalization_desire`, `required_construction` — the vanilla cost class, used as the
anchor and as the fallback when a rung has no `building_cost` — `aliases`, `heavy_industry_law` — emits the industry-ban / extraction-economy
`possible` block), `tiers[]`.
Other books: `disabled: true` (the industry is skipped everywhere and the vanilla building stays; analysis loops must skip it, L27),
`clone_from_vanilla` (emit by copying the vanilla block and swapping key / tech / groups — the infrastructure chains), `follows_be`,
`no_mass_be` (excluded from the linter ladder and locked in the UI), `ladder_end` (six-rung), `building.coastal_only`, `building.ai_value`.

**Per rung** (`tiers[]`):
- identity: `key` (rung 0 keeps the vanilla building key — load-bearing, since a different key returns the vanilla building as a rival
  producer), `name` and `pm_name` (on a rung with a `vanilla_pm` they must equal vanilla's English "<building> (<method>)" and method name,
  or `build.ps1` throws — the in-game name and the short name `<key>_pmr_short` are built from vanilla's own translations; minted rungs stay
  English), `pm_key`, `pmg_key`, `vanilla_pm` (the vanilla main method the rung is; absent on the three minted additions), `texture`.
- placement: `tech` (the gating technology), `era` (the rung's TIER 0–3; derived from the technology's game era through `era_game_era`,
  checked by `lint_tier_eras.mjs`), `tech_year` (the slot's real onset, shown in the UI), `natural_year` (config-only).
- economics: `output_good`, `output_qty`, `inputs` {good: qty}, `employment` {profession: count}, `pollution`, `building_cost` (construction
  points → the building's `required_construction`), `ai_value`, `wage_pct` (the wage share of total cost, a config-side accounting convention
  only, §10.87), `target_be` (output price % of base at which the rung covers inputs + wages; a drift guard restated by the generators under
  the most basic secondary methods, §10.93 rule 6; never a design input).
- crafts (§10.91.1): `craft: true`, `workforce_mult` (0.1 — employment is emitted × this; the 1836 start multiplies levels by its
  inverse), `building_group` (`bg_pmr_crafts`), `levels_per_mesh`, `exclude_secondary_pmgs`, `exclude_secondary_pms`.
- merges (§10.91.2): `method_of: <host key>` (no building is emitted; the rung's main method joins the host's main group, gated by its own
  technology); on the host, `ai_value_cond` {tech, value} (its desire rises to the merged rung's once the owner holds `tech`).
- other books: `effect_mult` (with `workforce_mult`, the graded-port emission multipliers, §10.60.2), `state_infrastructure`,
  `ship_construction`, `output_override`, `solve_profit` (§10.59), `vanilla_pm_aliases`, `required_input_goods`, `secondary_goods`
  (written by `emit_secondaries.mjs --write`), `input_ratio`, `model_only` (six-rung).

**Top-level blocks** (canon):

| key | what | consumer / notes |
|---|---|---|
| `loc_basename`, `languages` | loc file stem; the 11 languages every key is written in | build.ps1 |
| `era_game_era` [1,3,4,5], `era_anchor_years` [1836,1875,1905,1940], `_era_rule`, `_placement_derived` | the tier ↔ tech-era map and anchors; industries placed by `--derive` | make_tier4_config, L31 |
| `start_exceptions_file` | the 1836 rule set to apply (`config/start_exceptions.vanilla.json`, empty) | build.ps1, convert_history.ps1 |
| `industries` | above | everything |
| `pm_goods` {pm: {in, out}}, `pm_employment` {pm: {profession: n}} | per-method overrides written into the owned method files. ⚠ Replacement semantics: the override is the method's whole goods (or employment) block. Canon: the urban-centre electric streetlights as an electricity source (§10.43.0) | build.ps1 |
| `research_events` | the research journal entries — see below | emit_research_events, emit_tech_finish |
| `ai_defines` {NAI key: value} | AI defines (the investment-pool set, the cost divisor, long-construction thresholds) | emit_techs → `01_pm_rehaul_defines.txt`; the engine rejects an out-of-range value at load and keeps vanilla's (L33) |
| `game_defines` {namespace: {KEY: value}} | any other define namespace; canon: `NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD` 0.99 | emit_techs; a key must exist in vanilla's defines or be listed as engine-only, and dead keys are refused (F241) |
| `goods_traded_quantity` {good: n} (+ `_trade`) | per-good trade weight (35 goods, five classes) | emit_goods → whole-file `00_goods.txt` (F159) |
| `building_required_construction` {building: points} | construction cost for a building the build owns (power plant 1,600) | emit_building_costs (§10.89.1) |
| `dams` | `enabled`, `projects_file`, `strip_trait_modifiers`, `effects`, `rules` (`family`), `layout` (`resource4`), `resource4` (the ruled class table), `private` (`all`) | emit_dams; other books: `log_levels`, `probe`, `perf_*`, `static_mode`, `staff_per_50` (§10.89) |
| `building_subsidies` {building: policy} | AI subsidy policy: `vanilla` / `none` / `nice_to_have` / `wants_to_have` / `must_have`; canon: the four dam classes `must_have`, tooling and explosives `none` | build.ps1 → `01_admin_strategies.txt`, emitted only when a non-vanilla policy exists. Vanilla's own `ai_strategy_montenegro_admin` still subsidises trade centres and is preserved, so one subsidy line in the emitted file is not ours |
| `building_groups_add` {bg: {...}} | new building groups (`bg_pmr_crafts`, incl. `min_productivity_to_hire` 2) | emit_building_groups |
| `research_levers` | `static` (static-modifier lines replaced in place), `university_innovation_mult`, `innov_x` (§10.96, §10.101.1) | emit_research_levers |
| `ai_schooling` | `institution_score`, `law_enact_add` (§10.97 item 7) | emit_ai_schooling |
| `secondary_goods_override` {pm: {line: value}} | hand values for a minted secondary (the bloc canning at 85) | emit_secondaries |
| `vanilla_value_overrides` [{file, block, key, vanilla, value, why}] | one vanilla line changed in place; throws if vanilla moved (the four flat research adds ×1/3) | emit_value_overrides |
| `company_target_gate` | `false`; the opt-in best-rung gate on company construction targets (F100) | emit_companies |

Provenance records (never emitted; several are re-derived by `lint_tier_eras.mjs`): `_comment`, `_canon` (stale, above), `_ab` (the A/B
generator's flags and `command`; L31 recomputes output, inputs, cost and ai_value from it), `_variant`, `_trade_variant`, `_dams_variant`,
`_dams_family`, `_artisan` (craft recipes, `hire_floor`, `craft_rule`, `seed`, `craft_ai`; L31-checked) + `_artisan_variant`, `_merge` (pairs
with `cost_rule` / `ai_rule`; L31-checked) + `_merge_variant`, `_research_extra_variant`, `_dam4_variant`, `_research_levers_variant`,
`_research_rework_variant`, `_research_society_variant`, `_dam_private_variant`, `_canon_2026_10_16`, `_wm99_variant`, `_polish_2026_10_21`,
`_polish_2026_10_21b`. Other books add `_basic_be`, `_dams_nolog`, `_derived_from`, `_building_group_ai`.

Read by the builder or emitters, set by no current canon key: `building_ai_value` {building: n} (ai_value for preserved vanilla buildings in
owned files), `subsidy_conditional` (mutually exclusive strategy pairs — the only conditional-subsidy lever; six-rung, §10.60.3, F64, F65),
`tech_ai_weight_mult` {production, military, society} (default 1/1/1 emits nothing), `start_tech_grants` (probe books only),
`building_group_ai` (whole-file building-group weights; `canon-fdi-rgate`), `pop_need_weight_mult` (the overlay arm,
`config/vanilla_weight_x10.json`), `granularity_divisor`, `pmg_drop_methods`, `secondary_rule` / `secondary_anchor_era` (emit_secondaries),
`ai_treaty_ports` / `treaty_port_rules` (deferred to mod 1.1, §10.103), `company_chain` (probe).

**`research_events`** (emit_research_events.mjs; canon values): `enabled`; `stages` (inception / development / implementation; only the first
auto-activates); `grant_fraction` 0.5 of the tech-era base cost per stage; `industry_bar_months` 36, `war_bar_months` 12,
`naval_bar_months` 36 (every bar is monthly); `thresholds_by_era` (people employed in the predecessor rung, keyed by tier) with
`threshold_mult` per industry (0.5 on arms, artillery, explosives, munition, synthetics) and `employment_per_level_default` 5,000;
`marks_whole_levels`; `necessity_anchors` (sources for first rungs with no predecessor — a building, a building group or a list summed as one;
a researchable first rung without one throws); `war_channel: 'unit_types'` (every technology unlocking a land combat unit, marines
excluded), `war_gate` {`general_battalions_flat` 50, `front_casualties_min` 0 = clause omitted, `gate_variable_days` 40} computed in
`on_monthly_pulse_country` into the expiring variable `pmr_wargate_<tech>`; `naval_channel`, `naval_any`; `consumption_thresholds` (the
`good:<name>` anchor, implemented and unused); `finish_boost` {enabled, threshold 0.99, add 10000; `force_test` for probes}; `extra_entries`
(production technologies outside the ladder, §10.95); `era1_rule_a`; `placement: 'script'` (§10.89.13); the §10.97 rework —
`sources_additive: false`, `literacy_by_era`, `follower_halving`, `implementation_repeats` 18, `repeat_all`, `exclude_techs`; the §10.98
entries — `condition_entries`, `condition_values`, `monthly_global_effect`, `count_display`. Other books: `date_gate` (`canon-fdi-rgate`).
How entries and bar tooltips read (staffed levels, the zero-valued lines, no ASCII apostrophe in any bar text — the emitter throws) is in
the emitter's header, BUGS_AND_FIXES 2026-09-30 and 2026-10-21, and POLISH_1_0.md.

### config/ — the book catalogue

Every committed book is `config/mod_config.<suffix>.json` with its twin. "Record" = kept as the evidence of what was measured; "never run" =
generated and committed, no batch. Status dates are canon tenures. Outcomes are in the FINDINGS entries named.

**The canon and the former canons** (newest first):

| book | what it is (levers against its base) | status | refs |
|---|---|---|---|
| `jex-dam4s-rs-x25-m10ac-dpriv-wm99` | the previous canon + `game_defines.NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD = 0.99`; polished in place 2026-10-21 | **the canon** since 2026-10-21 | §10.102; F241, F247, F248 |
| `jex-dam4s-rs-x25-m10ac-dpriv` | measured `jex-dam4s-rs-x25-m10ac` (engines unlifted `--in0-for motor:1`, conditional merge-host desire `--ai-rule cond`) + `dams.private = all` | canon 2026-10-16 → 10-21 | §10.101, §10.91.2; F239 |
| `jex-dam4s-rs-x25-dpriv` | `jex-dam4s-rs-x25` + `dams.private = all` | canon 2026-10-16 (afternoon) | §10.89.14; F240 |
| `jex-dam4s-rs-x25` | `jex-dam4s-rs` with the one innovation parameter x = 25 (universities × 1/6) | canon 2026-10-13 → 10-16; never measured over a century (the 30-year reference of F236) | §10.101.1; F236 |
| `jex-dam4s-rs` | the artmerge arm (crafts + six merges, t1 anchors, lift 1.2, compressed desire ladder, textile host at its own cost) + extra research entries + resource-slot dams + script placement + the §10.97 rework + the §10.98 entries | canon 2026-10-12 → 10-13 | §10.97–§10.99; F227 |
| `canon-dams-family-nolog` | `canon-dams-family` minus the monthly dam log | canon 2026-09-29 → 10-12; the last pre-artmerge canon (a return would need both tick-cost fixes and §10.95–§10.98 re-implemented) | §10.89.12, §10.99 |
| `canon-dams-family` | `canon-dams` + `dams.rules = family` + `dams.log_levels` | record (the measured book of the canon above) | §10.89.12; F177 |
| `canon-dams` | `canon-b164-trade` + power plant at 1,600 points + dams (144 projects / 312 levels) + must_have dam subsidies; the engine builds every level, the script only surveys | canon 2026-09-27 → 09-29 | §10.89–§10.89.11; F170–F175 |
| `canon-b164-trade` | `canon-slide-b158` at B 1.64 + the ×1 per-good trade table + the finish boost | canon 2026-09-25 → 09-27 | §10.88; F163, F167 |
| `canon-slide-b158` (= `probe-sm-b158`, byte-identical; the probe name is the measured record) | A 2.2 / B 1.58 / C 1.9 / in0 1.2 / ai_value 1000 × 3^tier, the anchor slide on eight industries with `--anchor-cost`, the mild spending set 0.95 / 1.0 / 2.0 | canon 2026-09-23 → 09-25 | F157, F158 |
| `canon-c19-in12-elec` | `canon-c19-in12` + the urban-centre electricity override (`pm_goods` / `pm_employment` on `pm_electric_streetlights`); a proved two-key diff | canon 2026-09-20 → 09-23 | §10.43.0 |
| `canon-c19-in12` | A 2.2 / B 1.5, cost = anchor × 1.9^tier, in0 1.2, ai_value 3^tier, divisor 0.000125, the §10.75 defines, 24-month bar; measured without the override | canon 2026-09-18 → 09-20; record | §10.84; F117, F131 |
| `canon4v-hai3` | `canon4v` + ai_value 1000 × 3^tier on all 17 industries + the investment-pool defines (`--ai-defines`); regenerated under the tier rule 2026-09-13 (the measured index-keyed book is commit `880f098`'s) | canon 2026-09-06 → 09-18 | §10.75, §10.76, §10.78; F106 |
| `canon4v` | four rungs built from the game files alone (`make_tier4_config` → `make_tier4_techs` → `make_ab_config`), art academy on the regular ladder | canon 2026-09-05 → 09-06 | §10.72, §10.74; F104 |
| `canon-4rung` | the ab3 book: tier4 structure from the retired clone-from-six-rung generator, vanilla's first recipe on A 2.0 / B 1.5, ai_value 1000 × 2^tier (glass, tooling 3^tier); cannot be regenerated | co-canon 2026-09-03 → 09-05; frozen record | §10.68, §10.69; F98–F102 |
| `six_rung` | the six-rung solver2f book | canon 2026-08-26 → 09-05; retired | §10.65.9, §10.80 |

**The four-rung A/B sweep, 2026-09-03 → 09-18** (all records; each built by `make_ab_config.mjs`, command in `_ab.command`; books before
2026-09-13 were regenerated under the tier rule, the measured copies are commit `880f098`'s):

| book | what it is | status | refs |
|---|---|---|---|
| `canon4-je` | `canon-4rung` + the ruled research-event parameters and military channels | record | §10.69; F102 |
| `canon4-art` | `canon4-je` with the art academy on explicit per-rung multipliers (fine art 5 / 10 / 35 / 80, cost 400 / 800 / 2,400 / 3,600) | record | §10.70; F103 |
| `canon4v-art3` | `canon4v` with the film academy at ×3 output (`--tiers-for art_academy:…`); reverted as gameable | record | §10.73; F104, F105 |
| `canon-je24` | `canon4v-hai3` with `industry_bar_months` 24 (phase 1 of the 60-run plan) | record | §10.76; F107 |
| `canon-je24-a22` | `canon-je24` at A 2.2 (phase 2) | record | §10.76; F109 |
| `canon-flat-in12` | A 2.2 / B 1.5, rung-0 input value × 1.2, flat building cost, ai_value 1,000 / 2,000 / 3,000 / 4,000, divisor 0.001 | record (n=1) | §10.77; F110 |
| `canon-flat-in13` | the same at × 1.3 | never run | §10.77 |
| `canon-flat-in12-a16` | `canon-flat-in12` at A 1.6 | record | F113 |
| `canon-je24-a22-in12` | `canon-je24-a22` + the × 1.2 rung-0 lift only | record | F113 |
| `canon-flat-in12-a19` | `canon-flat-in12` at A 1.9 | record | F115 |
| `canon-c16-in12` | `canon-je24-a22-in12` with cost = anchor × 1.6^tier (`--cost-ratio`) | record | F116 |
| `canon-c19-in13` | `canon-c19-in12` with in0 1.3 | record | F118 |
| `canon-c205-in13` | `canon-c19-in13` with cost × 2.05^tier | record | F119 |
| `canon-c19-e0ai500` | `canon-c19-in12` with rung-0 ai_value 500 | record | F120 (the second F120) |
| `canon-c19-in12-eager` | `canon-c19-in12` + the eager spending set (pool factor 0.99, CRITICAL 1.25, EXCESSIVE 3.0, queue cap 0.05) | record | §10.79; F124, F125 |
| `canon-c205-in12-eager` | cost × 2.05^tier + the eager set, its pool factor at 1.0 — which the engine rejects, so it ran at vanilla's 0.75 | record | §10.79; F121; L33 |
| `canon-c195-in12-eager` | cost × 1.95^tier + the eager set | record | F132 |
| `canon-c195-in12` | `canon-c19-in12` with cost × 1.95^tier only | record | F133 |
| `canon-b18-gm` | `canon-c19-in12` at B 1.8, cost ladder gain-matched per tier (`--cost-ladder 1.52,2.79,5.34`) | record | §10.82; F128 |
| `canon-a19-gm` | A 1.9, gain-matched cost ladder 1.38 / 2.22 / 3.68 | record | §10.82; F129 |
| `canon-a205-gm` | A 2.05, gain-matched cost ladder 1.64 / 2.89 / 5.15 | record | F130 |
| `canon-a20-gm` | A 2.0, cost ladder 1.55 / 2.66 / 4.63 | never run | §10.82 |
| `canon-c19-e2soft` | t2 cost alone lowered (`--cost-ladder 1.9,3.083,6.859`); dropped by §10.82 ruling 1 | never run | §10.82 |
| `canon-c19-in12-mild` | `canon-c19-in12` + the mild spending set; the set was measured on `probe-slide-mild` instead | never run | F157 |
| `canon-c20-in12-eager`, `canon-c205-e0ai500-eager` | branch books (cost × 2.0^tier + eager; the × 2.05 eager book with rung-0 ai_value 500) | never run | §10.79 |
| `canon-c19-in12-eager-sharp`, `canon-c195-in12-eager-sharp` | the eager books + three AI-choice defines (random factor 10 → 5, autonomous random mult 2.0 → 1.0, profit mult 1.5 → 2.5); the defines were measured on `canon-c19-in12-sharp` (gitignored) | never run | §10.79; F126 |
| `canon-lvl-a19b17` | the flat uniform ladder (`--in0-level`, a closed axis since §10.86.4) | record | F139 |

Gitignored and absent: `tier4` (the four-rung structure from `make_tier4_config.mjs`, regenerated from the game files), `canon-c13-in12`,
`canon-c205-in12`, `canon-c19-in12-sharp`, `slide-b1xx` (the trade ladder's bases), every artmerge-chain intermediate.

**Trade and capital export:**

| book | what it is | status | refs |
|---|---|---|---|
| `canon-slide-b158-trade` | `canon-slide-b158` + `goods_traded_quantity` (35 goods) — its build adds only `common/goods/00_goods.txt` | record | F159, F161 |
| `trade15-b164` / `-b168` / `-b172` / `-b176` | the canon of the day at B 1.64–1.76 + `make_trade_config --scale 1.5` | record | F163 |
| `canon-fdi-rgate` | `canon-dams-family-nolog` + `building_group_ai` (manufacturing foreign-investment factor 0.25 → 1.0) + `research_events.date_gate`; not adopted | record | F178, F179 |

**The artmerge line** (crafts, merges, t1 anchors; the canon's ancestry):

| book | what it is | status | refs |
|---|---|---|---|
| `artisan6`, `artisan6-shop` | the canon of the day with six t0 rungs as 500-worker crafts (`make_artisan_config.mjs`); machinist staffing / shopkeeper staffing | record | §10.91.1; F181–F185 |
| `merge6`, `merge6-probe` | six add-on rungs made second main methods of the rung below (`make_merge_config.mjs`, host cost and ai_value at the geometric midpoint); the probe adds `start_tech_grants` | record (probe-only) | §10.91.2; F182, F184 |
| `artmerge6`, `artisan6-floor`, `artmerge6-floor` | crafts + merges combined; the floor books set `min_productivity_to_hire` 0.01 — the probe value, not the ruled £2 | record | §10.91.3; F188 |
| `artisan6-pb`, `artmerge6-pb` | shopkeeper + laborer craft staffing, four craft outputs raised | record | §10.91.4; F191, F194 |
| `artisan6-pb-f2`, `artmerge6-pb-f2` | the pb books at the ruled £2 floor | record | F198 |
| `e1a-artmerge` (+ craft half `e1a-art`) | every industry anchored at t1, down-step ÷ 1.5, pop-good lift 1.4, motor on [1,2,3], the 60% craft rule, output-matched 1836 craft seeding | record | §10.91.5; F197, F199, F200 |
| `e1a10-artmerge`, `e1a12-artmerge` | the same at pop-good lift 1.0 / 1.2 (1.2 ruled) | record | F202, F203 |
| `e1a12-ai1135-artmerge` | `e1a12-artmerge` with the compressed desire ladder 1,000 / 1,000 / 3,000 / 5,000, crafts 800 | record | §10.92; F208–F210 |
| `e1a12-ai1135-tex1140-artmerge` | textile's merged host at its own t2 cost (`--host-cost textile:own`) | record | F213, F216 |
| `e1a12-ai1135-tex1140-jex-artmerge` | + `research_events.extra_entries` (25 technologies) + `era1_rule_a` | record | §10.95; F219 |
| `jex-dam4s` | + dams on four resource-slot classes + `placement = script` (the tick-cost fix) | record | §10.89.13; F221, F222 |
| `jex-dam4s-ra` | + research levers (cap literacy term 150 → 50, universities × 0.5) + dam staffing pinned | record | §10.96; F223–F225 |
| `jex-dam4s-rl`, `jex-dam4s-rb`, `jex-dam4s-rb-wild`, `jex-dam4s-rs-wild` | research levers at 25; + the §10.97 rework; the `-wild` books are smoke builds | record | §10.97; F226 |
| `jex-dam4s-rs-m10`, `jex-dam4s-rs-m10-je48` | the canon of the day with the engines unlifted; + four-year stages | record | §10.101; F232, F233 |
| `jex-dam4s-rs-c20` | cost ratio 2.0 | record | F228 |
| `jex-dam4s-rs-x25-c18k12`, `-c18k12mp48`, `-x25-mp` | cost ratio 1.8 × `cost1` 1.2; + engines and paper unlifted + four-year stages; engines and paper unlifted alone | record | §10.101.2; F234–F237 |
| `jex-dam4s-rs-x25-c18k12mp` | the cost ladder + engines and paper unlifted, without the four-year stages | no FINDINGS entry | §10.101.2 |
| `jex-dam4s-rs-x25-m10ac` | x25 + engines unlifted + conditional merge-host desire | record | F239 |
| `jex-dam4s-rs-x25-m10ac-probehi` / `-probelo` | extreme conditional-desire values + start technology grants | probe-only | F238 |
| `jex-dam4s-rs-x25-m10ac-dprivall-probe` / `-dprivlf-probe` | private dam construction everywhere / under laissez-faire, at probe values | probe-only | F240 |

**Dams and short probes:**

| book | what it is | status | refs |
|---|---|---|---|
| `canon-dams-probe` | `make_dam_config --probe`: technologies granted to ten majors, 2-month surveys, cost × 0.05 | probe-only | F168, F169 |
| `canon-dams-aiself`, `-aiself-probe`, `-aiself-probe-gbr`, `-aiself-probe-p14` | the engine-builds-the-dams probes; their `dams.ai.driver_*` keys are inert since the switches were removed | probe-only | F173, F174 |
| `probe-dam-p15` … `probe-dam-p29`, `p26b` | survey-decision and build-rule probes | probe-only | F176, F177 |
| `probe-in13` / `-in14` / `-in15`, `probe-grada` / `-gradb` / `-gradc` / `-gradrev` / `-gradsup` | short tier-0 input-penalty probes (flat and graded) | probe-only | F142–F147 |
| `probe-sm-b152` / `-b155` / `-b158` / `-b162`, `probe-b16-slide`, `probe-accel-slide` | the B gradient; the accelerating input ladder (`--in-ladder`) | record | F154, F156, F158 |
| `probe-slide-mild`, `probe-slide-mild-c195` | the anchor slide + the mild spending set; its C 1.95 variant (prepared, not run) | record / never run | F157 |

Readers for the quarterly-save dam books (`canon-dams*`, `dams.rules = family`; listed here because no other catalogue entry names them):
`tools/testbed/ledger/dam_situation.mjs <runDir> <modDir>` (per run: surveys, built levels, stalled and wasted constructions by cause; the
mod dir is a build of the run's own book), `dam_outcomes.mjs <modDir> <runDir>…` (finish rates of surveys and constructions by the actor's
relation to the host: own / overlord / family / outside; `DUMP=<file>` writes its records), `dam_survey_use.mjs <dump.json>` (what a finished
survey led to), `dam_report.mjs <runDir> [--years …] [--surveys] [--bur <country>]` (surveys, stages and bureaucracy from the PMR_DAM lines and
yearly summaries; written for the stage design, F168). For yearly-save books use `dam_yearly.mjs` and `dam_slots.mjs`. Refs: F177.

### config/ — data files

- **`config/era_prices.json`**, **`config/era_presets.json`** — the six-rung solve's price path per tier (`era_solver.mjs`) and its solved tier
  scenarios (`era_scenarios.mjs`), committed as design inputs; `extract_presets.ps1` appends the scenarios to `ui/presets.js`. Status:
  six-rung, retired. A `MOD_CONFIG`-redirected solve writes suffixed copies, which are gitignored.
- **`config/era_inverse.json`** — the inverse-solve artifact (`era_inverse.mjs --write`, §10.65.2): the design book, derived recipes, seeded
  scenarios, `presets`, `analytic_ladder`, per-scenario order books. Read at build time: `build.ps1` embeds `recipes` / `mandate` /
  `ladder_yields` into `ui/data.js` (`PMDATA.inverse`, the red `recipes: solver 2` button) and `extract_presets.ps1` the `presets` row; both
  optional. Status: six-rung, retired; rebuild after a `--write` to refresh the sheet.
- **`config/era_inverse.tier4.json`**, **`config/measured_price_paths.json`**, **`config/measured_price_paths.tier4.json`** — artifacts of the
  retired four-rung derivation (§10.66, superseded by §10.72); the price paths come from `tools/measure_price_paths.mjs` (F84) and feed
  `era_inverse.mjs` in granular mode. No longer written. Status: record.
- **`config/start_exceptions.vanilla.json`** — an empty rule set: the canon's `start_exceptions_file`, so the 1836 start is vanilla's,
  converted onto the rungs by `convert_history.ps1`.
- **`config/start_exceptions.json`** — manual 1836 overrides for the six-rung book: 22 rules, the §10.60.3 chain seed (anchorages → level-1
  steam-port stubs in the British and French markets, subject-owned ones rewritten to the overlord; two metal shipyards; one French motor
  factory). Rule schema: `force_tier` / `force_industry_tier` (onto another industry's rung; unknown industry throws) / `remove`, scoped by
  `country` and/or `state`, optional `owner` rewrite (single-owner blocks only); the most specific scope wins; a rule names its rung by `era`
  (a `tier`-keyed rule throws on a four-rung book). A rule on a `disabled` industry is skipped and counted. Embedded in `ui/data.js` and served
  at `/api/start_exceptions`. Status: six-rung only.
- **`config/start_baseline.json`** — the vanilla 1836 start inventory per industry / rung / country, regenerated every build by
  `extract_start.ps1` (gitignored). Its `unmapped` list is the version-drift alarm (a renamed main method shows up there), and
  `emit_techs.mjs` derives the 1836 starting-technology grant from it, which is why the build runs `extract_start.ps1` first.
- **`config/presets.json`** — which scenario presets `extract_presets.ps1` generates (id / label / group / country, optional
  `market_add` / `market_drop`, `sol`, `measured_market`). A `placeholder` block instead of `country` makes a synthetic preset (one level of
  every ordinary building; `placeholder_defaults` holds its pops, SoL multipliers and exclusions). `sol.slaves` is the slave basket level, and
  `defaults.class_mult` deliberately has no `slaves` entry.
- **`config/pop_distribution.json`** — the fitted within-need consumption split, now only the fallback for a need with no supply in the
  scenario (the live split is supply share, `needSplit()`). Re-derive with the sheet's `fit pops` button and paste the printed JSON back.
- **`config/measured_1836.json`** — what the game files cannot give, per market (148): trade, buy / sell / production, SoL per stratum,
  military and urban-centre levels, secondary-method levels, throughput, workforce by stratum, and wages. Written by `tools/extract_measured.ps1`
  from a session built with `boot_dump` / `scenario` / `building_inventory`, read at 1836.2.1; `-WagesOnly` merges just the wages block.
  `base_weekly_wage` is the sheet's base wage on the F26 basis (laborers + farmers + machinists, employed pops); `base_weekly_labour` is the
  superseded 11-profession basis, kept for continuity and never fed to a scenario. Read by `extract_presets.ps1`; optional. Traps: regenerate
  after a game patch — a stale table is silently wrong.
- **`config/measured_1836_professions.json`** — population by profession per country, from a melted vanilla 1836.2.1 save
  (`tools/testbed/melted_pops_by_profession.mjs`); the sheet edits population by profession and sums the strata from it. Per country, not per
  market (market membership stays `extract_presets.ps1`'s). Trap: a pop's size here is workforce + dependents; `measured_1836.json`'s
  `by_pop_type` is workforce, about a quarter of it.
- **`config/measured_1836_pop_identity.json`** — per country and profession the most numerous culture-religion group, and per state share its
  peasants, people and infrastructure, from the same 1836.2.1 melt (`melted_pop_identity.mjs`); the source of the craft seeding
  (`emit_craft_start.mjs`, §10.91.5).
- **`config/measured_base_wages.json`** — the normal wage rate in £ per employee per week (a summary's `base_wage` ÷ 10,000) per tag per year,
  median over the vanilla n=16 baseline with min / max / n; 17 tags including UNL. Written by `tools/measure_wage_share.mjs --write-wages`;
  read by `lib_wage_model.mjs` (`W = wage × wage units × staffed levels`, no premium, F152 §10). Trap: it is vanilla's path; a mod arm's own
  wages come from its summaries. Refs: §10.87.
- **`config/dam_sites_research.json`** — the placement research, one object per state (159), user-reviewed; the input
  `make_dam_projects.mjs` reads.
- **`config/dam_projects.json`** — the dam project table (144 projects): the research minus the ruled cuts and merges in the script's `CUTS`
  table, one object per state with rows, parts, depersonalised name, anchor province and irrigation `effects`. Generated by
  `make_dam_projects.mjs`, committed; everything numeric that ships is derived from it by `tools/lib_dams.mjs`.
- **`config/vanilla_margins_1836.json`** — vanilla building margins at 1836.2.1 (`vanilla_margins.mjs --json`, F92), rendered by
  `build_ui2.mjs`. Written on the legacy margin definition and deliberately not regenerated (see the script's header).
- **`config/vanilla_weight_x10.json`** — the overlay arm's treatment config (`pop_need_weight_mult` only; `{kind: overlay}`). Record (F36).
- **`config/telemetry_ports_cond_cont.json`** — a telemetry spec (`build.ps1 -Telemetry`) from the port-subsidy probes; nothing references it.

---

## 2. Tool conventions, generators, analysis tools, extractors and UI tooling (`tools/`)

### Conventions shared by the tools

`tools/` is dev tooling, never shipped in the mod.

- Node tools need **Node ≥ 24**. They read the game from `VIC3_GAME` (default: the Steam install path) and the
  canon from `config/mod_config.json` unless a `--config` flag or `MOD_CONFIG=` names another book.
- A tool that writes into `config/` does so only under `--write` (or by naming a new `--suffix`); everything else is read-only.
- Two parsing traps for any new tool that reads game files: every vanilla `common/` text file starts with a UTF-8 BOM, so
  strip it before matching `^name = {` (otherwise the first block of each file is invisible); and an id class must admit a
  hyphen (`pm_ammonia-soda_process`, `pm_coal-fired_plant`), or `[a-z_0-9]+` silently splits the key (BUGS_AND_FIXES 2026-08-12).

### The builder and its guardrails

- **`tools/build.ps1`** — the builder: config → every `mod/common/*` file, loc for all 11 languages,
  `tools/ladder_tiers.txt`, the converted 1836 start, then the linters, preflight and `Invoke-ModChecks`, then deploys
  a real copy to Documents. `powershell -ExecutionPolicy Bypass -File tools\build.ps1 [-Config <book>] [-DryRun | -SaveTo <name>]
  [-ControlOnly | -Overlay] [-Telemetry <spec.json> | -TelemetryOn] [-TelemetryToken <t>] [-Release] [-NoLint] [-NoDeploy] [-NoPreflight]`.
  `-Release` makes the player build (POLISH_1_0.md H8; the header's TWO BUILD KINDS): no "Recipe BE" in the building names, the start-up line
  reduced to a version manifest ("PM_TECH_REHAUL: init OK - PM and Tech Rehaul <version> loaded (release build)"), `strip_release_logging.mjs`
  after the last content emitter, no "(built …)" in the mod name; it refuses `-Telemetry`, `-TelemetryOn`, `-ControlOnly` and `-Overlay`.
  Status: current (the only way a mod is produced; measurement builds go through `run_schedule.ps1`).
  Traps:
  - `mod/.metadata/metadata.json` is hand-maintained: the version (1.0.0), `supported_game_version` ("1.13.\*") and the player description live
    there and ride into every build kind; the build only edits the name's "(built …)" stamp.
  - An alternate config `config/mod_config.<sfx>.json` needs its paired `config/tech_tree_options.<sfx>.json`:
    `emit_techs.mjs` and `emit_research_events.mjs` derive the tree file from the config's filename. Without it the build
    stops at the early L20 gate (the book generators write the twin; a hand-made book needs a copy). Never "fix" this by
    falling back to the canonical tree — that pairs one book's buildings with another's technologies. Refs: L20.
  - `-NoPreflight` is for a broken detector, not for a hurry.
- **`tools/preflight.ps1`** — walks every automated entry of `TESTBED_LANDMINES.md` against the EMITTED files (never the
  generator) and exits non-zero on a breach. `preflight.ps1 [-Mod <dir>] [-RepoOnly] [-Config <book>] [-Only L20,L31]
  [-Session <dir>] [-UpdateFingerprint] [-WarnOnly] [-Quiet]`. Run by `build.ps1` (an early `-Only L20 -Config` gate before
  any file is emitted, again at the end, and before the control arm's early exit) and by `run_schedule.ps1` (`-RepoOnly`
  before a batch is estimated, `-Only L20 -Config` per setup); `-Session` walks the post-run entries (L12, L17, L26, L33,
  L34 …). Status: current (build step). Adding a check: register entry → `Test-Lm<ID>` here → prove it trips by breaking
  the thing on purpose (TESTBED_LANDMINES "How this is enforced").
- **`tools/telemetry_fingerprint.json`** — committed sha256 of the canonical telemetry (every metric on, dates/tags/token/stamp
  pinned) beside the schema version it was taken at; rewritten by `preflight.ps1 -UpdateFingerprint`. If the hash moves and
  `TELEMETRY_VERSION` does not, the build fails — a forced choice between bumping the version and recording that old
  sessions stay comparable. Status: current. Refs: L8.
- **`tools/telemetry_lib.ps1`** — the one generator of testbed telemetry script, dot-sourced by `build.ps1` so the control
  arm and every modded arm instrument identically; the harness has no generator of its own. Status: current (build step).
  Traps: sets no `Set-StrictMode` on purpose (it would leak into the caller); never edit it, or `build.ps1`, while a batch runs
  — the scheduler rebuilds before every run (TESTBED_OPERATIONS). Refs: TESTBED_METRICS.

### Book generators (the four-rung pipeline)

The four-rung book is built from the game files and one spec, nothing else: `make_tier4_config.mjs` (structure) →
`make_tier4_techs.mjs` (tree twin) → `make_ab_config.mjs` (prices the ladder) → the later book makers (trade, dams, crafts,
merges, research levers — each records its command in the book). Every book carries its own regenerating commands in
`_ab.command`, `_*_variant` and similar records. Refs: §10.72, §10.78, §10.68.

- **`tools/lib_tier4_spec.mjs`** — the only authored input of the four-rung generator: `INDUSTRIES` (the 17 tiered vanilla
  buildings), `PLACEMENT` (ruled tier placements where the derivation does not fit), `ADDITIONS` (minted top rungs),
  `ERA_MOVES`, `PREREQ_ADDS`, `TECH_RENAMES_RULED` (empty), the tier rule (`GAME_ERA_OF_ERA` = [1, 3, 4, 5],
  `ERA_TOLERANCE` 1, `derivePlacement`, `placementFaults`), `ERA_YEARS` (1836/1875/1905/1940), the ruled urban-centre
  electricity override (`PM_GOODS_RULED` / `PM_EMPLOYMENT_RULED`, §10.43.0) and the `RESEARCH_EVENTS` defaults.
  Used by `make_tier4_config`, `make_tier4_techs`, `make_ab_config`, `emit_secondaries`, `lint_tier_eras`. Status: current.
  Traps: every departure from vanilla must be an explicit, ruled entry here; its `CANON` block is the stamped record of
  canon4v-hai3, not a description of today's canon. Refs: §10.72, §10.78, L31.
- **`tools/lib_vanilla_ladder.mjs`** — reads vanilla live: buildings, production-method groups and methods, per-method gates
  (`gatesOf`) and goods (`goodsOf`), plus a top-level `blocks()` splitter. Shared by the generators, `make_ab_config`, the
  wage tools and several linters. Status: current.
- **`tools/make_tier4_config.mjs`** — the four-rung STRUCTURE from vanilla: each tiered industry is a vanilla building, each
  rung one of its main-group methods in vanilla order with vanilla's name, gate (the method's technology, else the
  building's), recipe, staffing, pollution and icon; rung 0 keeps the vanilla building key, higher rungs are
  `<building>_<method>`. Rung tiers are derived from the gate technology's tech era (1→t0, 2→t1, 3→t1, 4→t2, 5→t3, bumped only
  to keep one rung per tier), checked against ±1 tolerance; it throws on an unruled overflow or a rule-1 violation (an
  addition pegged to a technology that gates the industry's own secondary). Writes `config/mod_config.<TIER4_SUFFIX>.json`
  (default `tier4`, gitignored) with `era_game_era`, `era_anchor_years`, `_era_rule`, and `start_exceptions_file` →
  `config/start_exceptions.vanilla.json` (no rules: the four-rung 1836 start is vanilla's, converted).
  `[TIER4_SUFFIX=<s>] node tools/make_tier4_config.mjs [--derive <ind,ind>]`. Status: current (generator).
  Traps: rung 0 must keep the vanilla key (a different key hands the vanilla building back as a rival reference producer);
  `building_cost` and `ai_value` are not set here — they are `make_ab_config`'s, by tier. `--derive motor` makes the named
  industries ignore their `PLACEMENT` entry and take the derivation ([1,2,3] for motor) — that is the canon's base
  `tier4-e1`, so write it under `TIER4_SUFFIX=tier4-e1`; the book records `_placement_derived`. Refs: §10.72, §10.78, §10.91.5.
- **`tools/make_tier4_techs.mjs`** — the four-rung tree twin `config/tech_tree_options.<suffix>.json`: every vanilla technology
  at vanilla's era, name and prerequisites, plus the spec's departures — `ERA_MOVES` (only vulcanization 3 → 4, marked
  `reEra` so `emit_techs` patches vanilla's file), `PREREQ_ADDS` (conveyors before compression_ignition, recorded as
  `vanillaPrereqs` / `prereqsAdded`, §10.93 rule 7) and the additions' three minted technologies (furniture, paper,
  fertilizer), each placed by its own year. Validates: no minted technology in tech era 1, none gating nothing, every
  prerequisite known, same-category and not later-era, no technology gating two rungs of one industry.
  `[TIER4_SUFFIX=<s>] node tools/make_tier4_techs.mjs`. Status: current (generator). Refs: §10.72.
- **`tools/make_ab_config.mjs`** — prices a four-rung structure on the A/B ladder: a rung of tier t gets
  output = vanilla first-method output × A^t, input VALUE = vanilla first-method input value × lift × B^t spread over the rung's
  own vanilla method's mix, `building_cost` = vanilla anchor × C^t, `ai_value` by tier, `target_be` / `wage_pct` restated under
  the most basic secondary methods (§10.93 rule 6), and the private pool's cost-divisor define scaled to the book. Keyed on
  the rung's TIER, never its index within the industry (books record `_ab.keyed_by: 'era'`). Secondaries are rescaled at build
  time by `emit_secondaries.mjs`, not here. Writes `config/mod_config.<suffix>.json` plus the tree twin (the base's own
  `tech_tree_options.<base suffix>.json`, falling back to tier4's) and prints the book.
  `node tools/make_ab_config.mjs --A <a> --B <b> --suffix <s> [--base <book>] [flags below]`. Status: current (generator).
  The canon's own invocation is its `_ab.command` (base `tier4-e1`, A 2.2, B 1.64, `--in0 1.2 --in0-for motor:1 --cost-ratio 1.9
  --anchor-cost --anchor-for <all 17>:1 --down-step 1.5 --in1-pop 1.2 --ai-ladder 1000,1000,3000,5000 --divisor 0.000125
  --ai-defines … --bar-months 24`).
  Every flag is recorded in the book's `_ab` record under its snake-case name, and `_ab.command` holds the full line;
  `lint_tier_eras.mjs` (L31) re-derives output, input value, cost and ai_value from those records, so a hand edit fails the build.

  | flag | effect | status / note |
  |---|---|---|
  | `--A a` · `--B b` | output × A^t; input value × B^t | required (`--B` optional with `--in-ladder`) |
  | `--base <book>` · `--suffix <s>` | structure to price (default `config/mod_config.tier4.json`) · output name | |
  | `--in0 m` | input-value lift on the anchor rung, ladder anchored on it (canon 1.2) | |
  | `--in0-only` | lift the t0 rung alone; higher rungs keep the vanilla-anchored ladder | |
  | `--in0-for ind:m[,…]` | one industry's lift for its whole ladder; overrides `--in1-pop` | the allowed per-industry form, one number per industry (§10.101); recorded only when set |
  | `--in1-pop m` | anchor-and-below lift for industries whose output sits in a pop need (read from `common/pop_needs`) | canon 1.2; exclusive with the other lift rules |
  | `--in0-anchored m` | a separate lift for the anchored (slid) industries | needs `--anchor-for` |
  | `--in0-level m` | per-industry lift so every t0 lands on the same base margin | closed axis by ruling (§10.86.4); kept only to regenerate F139's book |
  | `--in0-stage r,s1,s2` · `--in0-supplier k` · `--in0-supplier-mode map\|any\|share` | the graded t0 penalty by input stage, plus the supplier-side relief (§10.86.6–7) | probe books only, never run for a century; exclusive with `--anchor-for`; `share` mode needs an emitted 1836 history |
  | `--anchor-for ind:t[,…]` | names the ladder origin: tier t gets A^(t−a) / B^(t−a) over the anchor rung's own vanilla method | canon: all 17 at t1. Origin is 0 unless named, never the industry's own first rung (F111); moves output and input only |
  | `--anchor-cost` | the cost exponent follows the anchor too (C^(t−a)) | needs `--anchor-for`; canon on |
  | `--down-step s` | below the anchor, output and input value ÷ s per step (keeps the anchor's margin) | canon 1.5 |
  | `--in-ladder m1,m2,m3` | input ladder as an explicit per-tier list in place of B^t; below the anchor extended as m1^k | `_ab.B` is null when set (§10.86.4.4) |
  | `--cost-ratio C` | `building_cost` = anchor × C^t (default C = A) | canon 1.9 |
  | `--cost-flat` · `--cost-ladder m1,m2,m3` | anchor at every rung (§10.61) · explicit per-tier cost list | mutually exclusive with `--cost-ratio` |
  | `--cost1 k` | multiplies every rung's cost — the level dial beside the slope (§10.101.2) | recorded only when set |
  | `--A-for ind:r` | one industry's own output ratio (cost and ai_value follow) | |
  | `--tiers-for "ind:out=…;in=…;cost=…"` | explicit per-rung multipliers for one industry | art-academy stress test (§10.70) |
  | `--ai-ladder v0,v1,v2,v3` · `--ai-base n` · `--ai-steep inds:r` | `ai_value` by tier explicitly · base × A^t · base × r^t for named industries | canon `--ai-ladder 1000,1000,3000,5000` |
  | `--divisor s` | private-pool cost-divisor define (auto 0.001 × 800 ÷ the dearest rung's cost) | pin it (canon 0.000125) with `--A-for` / `--tiers-for`, or the auto value re-scores every building |
  | `--ai-defines K=V,…` | extra NAI defines merged into `ai_defines` | values are range-checked by the engine at load (L33) |
  | `--bar-months n` · `--variant "name\|base\|ruled_by\|delta"` | `research_events.industry_bar_months` · writes the `_variant` record | |
  | `--be-wage flat` | restate `target_be` with the old flat `wage_pct` instead of the tier's reference wage × basic-secondary wage units | default `economy` |
  | `--company-gate` | sets `company_target_gate` (emit_companies opt-in) | off by default and in every book |

  Traps: the canon's `--base config/mod_config.tier4-e1.json` is gitignored — regenerate it with `make_tier4_config --derive
  motor` and `make_tier4_techs` under `TIER4_SUFFIX=tier4-e1` before re-running `_ab.command`. Refs: §10.68, §10.77, §10.78,
  §10.86.4, §10.91.5, §10.101, F111.
- **`tools/compare_recipes.mjs`** — a readable recipe diff between two books, grouped by industry and tier, showing only the
  tiers that moved (break-even, O:I at base prices, input-value change) and flagging any output change loudly.
  `node tools/compare_recipes.mjs --before <book> --after <book> [--all] [--threshold 2]`. Status: current.

### Economics and design analysis

All read-only. Report PROFIT in £ first and a margin only beside it (§10.87); every base-price figure is a design coordinate,
not a prediction (§10.86.2).

- **`tools/lib_wage_model.mjs`** — the one implementation of the wage model and the repaired margin identity:
  `W = wage(tag, year) × Σ(employees × wage_weight) × staffed levels`, weights and `POP_SIZE_PACKAGE` read live, £ per employee
  per week = a summary's `base_wage` ÷ 10,000. Exports `economyWage(tag, year)` (from `config/measured_base_wages.json`),
  `predictProfit()` (= O − I − W at the shipped defaults), `tierEmployment()` (falls back to the industry's secondary PMGs'
  base methods for a tier with no `employment` of its own — the art academy), `wageUnits()`, `priceMultiplier()`,
  `trueMargin(profit, R)` (returns null where it cannot be computed). Status: current. Traps: `WAGE_PREMIUM` is 1.0 and
  `PROFIT_WAGE_SHARE` 0; the retired coefficients survive only as `WAGE_PREMIUM_FLAT_RETIRED` / `WAGE_TWO_TERM_RETIRED`.
  `TAG_FAMILY` resolves GER→NGF→PRU and NET→UNL so a wage path survives a tag change. Refs: §10.87, F152.
- **`tools/ladder_options.mjs`** — what a candidate ladder (A, B, cost, in0 — each a ratio or a `/`-separated per-tier list) does
  to the three things that fight each other: profit in £ per level per week with the margin beside it (wage from
  `--economy TAG@YEAR`), F97's death test (a rung two back must hold < 0.20 of the frontier's value added per worker), capital
  per unit of output, and the exact 1836 anchor error (each rung's output against its own vanilla method, weighted by the
  levels the emitted 1836 history places on it). `node tools/ladder_options.mjs --book "name:out=2.2,in=1.5,cost=1.9,in0=1.2"
  [--book …] [--industry textile] [--config <book>] [--economy GBR@1920] [--wage-premium 1.0] [--profit-wage-share 0]`.
  Status: current. Traps: all at base prices — a better death-test score is not better measured obsolescence (§10.86.4.3).
  Refs: §10.86.4, F141, F137.
- **`tools/era0_solvency.mjs`** — the t0 solvency census: rebuilds each industry's t0 recipe as `make_ab_config` does (lift 1.0
  = vanilla's recipe) and scores it against the vanilla n=16 median prices per market at a dump date, with each market leader's
  measured wage. Reports `target_be` per option, insolvent (industry × market) cells and their output-value share beside
  vanilla's count, the very dead (margin < −20% even with the output's sell orders cut to a third), the first-order cost to the
  1836 anchor, and `--century` the same rung at every dump date. `node tools/era0_solvency.mjs [--lifts 1.0,1.2,1.4,1.6]
  [--levels -0.1,-0.2,-0.3] [--date 1836.2.1] [--config <book>] [--dead -0.20] [--detail] [--markets a,b] [--van <session>]
  [--profit-wage-share x]`. Status: current. Traps: base method only (no secondaries, no throughput) on both sides, prices held
  at vanilla's while the recipe changes. Refs: §10.86.2–3, F140 (its census figures superseded; the shape stands).
- **`tools/full_recipe_profit.mjs`** — the profit of a BUILT book's actual recipe at a named situation: main method plus every
  secondary PMG's active method (goods incl. reductions, and employment), economy of scale (`1 + 0.01 × min(levels, 20)` on goods
  only, for groups that have it), the economy-and-decade wage, prices at base or measured from a session. Reports revenue,
  inputs, wages, profit £ and the wage-inclusive margin. `node tools/full_recipe_profit.mjs --mod <dir> --config <book>
  [--economy GBR@1920] [--levels 10] [--secondaries base|none] [--prices <session>[@1935]] [--industry textile] [--compare-main]`.
  Status: current. Traps: it reads an EMITTED mod, so build a candidate first (`build.ps1 -SaveTo <name> -Config <book>`, then
  `--mod mod_<name>`) — the secondaries are rescaled at build time and are not re-implemented here.
- **`tools/recipe_side_by_side.mjs`** — one industry's rungs side by side across books beside vanilla's own method: output,
  inputs, values at base prices, O:I, goods margin, value added per level and per worker, cost, value added per 1,000
  construction points, ai_value, target_be. `node tools/recipe_side_by_side.mjs --industry steel [--books lab=path,…]`.
  Status: current (default books include retired ones; pass `--books`).
- **`tools/building_ledger.mjs`** — a building's own ledger straight out of a MELTED save, no model: `salary_rate`, `goods_cost`
  and `goods_sales` (market prices), `profit_after_reserves`, taxes, reserves, dividends; prints the implied wage bill against
  the modelled one and a head-to-head of candidate wage identities. `rakaly melt --format vic3 --unknown-key stringify -c
  <save.v3> > melt.txt` then `node tools/building_ledger.mjs melt.txt`. Status: current. Traps: takes a melt, not a `.v3`; from
  summary v9 `goods_sales` / `goods_cost` are in the summary and make the price repair unnecessary. Refs: F152 §9.
- **`tools/measure_wage_share.mjs`** — per (country × year) re-prices value added to market with each building's own goods mix
  and reads the implied wage bill `R − I − profit` against the model; excludes shipyards, subsistence, subsidised levels and
  anything > 2% unpriced. `--write-wages` regenerates `config/measured_base_wages.json`. `node tools/measure_wage_share.mjs --run
  <session/run> [--run …] [--years …] [--detail] [--van <session>] [--write-wages]`. Status: current. Refs: F152.
- **`tools/fit_wage_model.mjs`** — fits the per-profession and the two-term wage models against the implied bill; neither is
  adopted. `node tools/fit_wage_model.mjs <session/run> …`. Status: record. Refs: F152 §8, §10.
- **`tools/vanilla_margins.mjs`** — what profit and margin vanilla buildings actually run at, per building type, class and the whole
  map, from v6+ save summaries; margin = `profit ÷ (R − profit)` with value added re-priced at the country's market prices.
  `node tools/vanilla_margins.mjs [--session <dir>] [--date 1836.2.1] [--markets GBR,FRA,…] [--min-levels n] [--legacy-margin]
  [--json]` (`--json` writes `config/vanilla_margins_1836.json`, which `build_ui2.mjs` renders). Status: current.
  Traps: needs instrumented markets, so it scores only a minority of entries and says so; classification is by vanilla
  `building_group` exactly, never a regex over it. Refs: F92, F150, F152.
- **`tools/vanilla_construction.mjs`** — vanilla construction data read live: `requiredConstruction()` (building → points,
  depth-aware), `constructionCostValues()` (the `construction_cost_*` script values), `constructionMethods()` (construction
  sector methods → £ per point; £720 is the iron-frame rate only, F53). Used by the payback censuses and several ledger
  readers (`misplaced_capital`, `return_per_point`). Status: current.
- **`tools/audit_tech_content.mjs`** — everything a technology carries: its modifier block, every production method, building,
  combat unit, decree and company it gates, and every vanilla script line naming it. `node tools/audit_tech_content.mjs <tech>
  | --all-new`. Run it before any technology merge or removal. Status: current. Traps: the tech-tree viewer counts only
  building unlocks, so a technology can look empty there and gate many things (`watertube_boiler` gates sixteen). The build-time
  rule (no orphaned technology, no technology gating two rungs of one industry) is `lint_tech_content.mjs`. Refs: BUGS_AND_FIXES 2026-08-30.
- **`tools/audit_good_timing.mjs`** — per good, the tech era at which it can first be produced and first demanded by a building
  (pop demand excluded): a consumer before any producer is a chain that cannot run. `node tools/audit_good_timing.mjs`.
  Status: diagnostic; hardcoded to `config/mod_config.tier4.json` + its twin (gitignored — generate them first).
- **`tools/audit_tier_gate_eras.mjs`** · **`tools/plan_era_moves.mjs`** — from the four-rung rebuild: which rungs sit on a later-era
  technology than their rung and whether it can drop an era without inverting a prerequisite; and which technologies must rise so
  no top rung is gated below a target tech era (with everything that would be dragged along). Status: record — they key on the
  rung index (pre-tier-rule) and read the tier4 book; superseded by the tier rule and `lint_tier_eras.mjs` (L31).

### Extractors and the 1836 conversion

All take `-Repo` / `-Game` / `-Config` where relevant and are run by `build.ps1` unless noted.

- **`tools/history_lib.ps1`** — shared vanilla parsing: one history walker (`Invoke-HistoryWalk`; `Walk-HistoryFile` rewriting,
  `Read-HistoryBlocks` read-only) plus `Get-TopBlocks` / `Get-ListTokens` / `Get-Num`. Used by the converter, the extractors and
  the volume solvers. Status: current.
- **`tools/convert_history.ps1`** — the 1836 start converter: maps each vanilla starting factory (base building + active main PM)
  onto its tier building, keeps ownership and secondary PMs, applies the book's start rules (`start_exceptions_file`, default
  `config/start_exceptions.json`; the canon names the empty `start_exceptions.vanilla.json`). Writes
  `mod/common/history/buildings/` (and seed pops). Status: current (build step).
  Traps:
  - A rule naming a `disabled` industry is skipped and counted, not fatal; an unknown industry id still throws (§10.67.5).
  - A 1836 block landing on a MERGED rung (`method_of`) throws — none of the six ruled merges has one. Refs: §10.91.2.
  - With nothing to seed it deletes `common/history/pops/zzz_pm_rehaul_seed_pops.txt`, because the build's clean step never wipes
    `common/history` (BUGS_AND_FIXES 2026-09-24). Start rules on a four-rung book name their rung by `era`; a `tier`-keyed rule throws.
- **`tools/extract_start.ps1`** — vanilla start → `config/start_baseline.json` (inventory per industry/tier/country; its
  `unmapped` list is the version-drift alarm after a patch). Run by `build.ps1` before `emit_techs.mjs`, which derives the 1836
  technology grant from it. Status: current (build step).
- **`tools/extract_vanilla.ps1`** — every vanilla building / PMG / PM → `ui/vanilla.js` for the sheet's all-buildings explorer.
  Status: current (build step).
- **`tools/extract_icons.ps1`** — vanilla goods icons (.dds) → `ui/icons.js` (base64 PNGs). Status: current (build step).
  Traps: `ui/icons.js` is Paradox art — gitignored, never committed or shipped; the UI degrades to text without it.
- **`tools/extract_presets.ps1`** — the scenario panel's market presets from the vanilla 1836 start (`config/presets.json` →
  `ui/presets.js`): per market its buildings (re-tiered) and the PMs vanilla runs, treaty transfers, the population split, the
  measured base wage (absent where the market has no per-pop measurement), and the buy-package / pop-need tables. Status: current
  (build step). Traps: it always writes `ui/presets.js` (no output path).
- **`tools/extract_measured.ps1`** — a testbed run folder → `config/measured_1836.json`, the 1836 reference the game files cannot
  give (trade, SoL by stratum, military levels, urban-centre cross-check, wages). `powershell -File tools\extract_measured.ps1
  -Session <run>[,<run>] [-Date 1836.2.1] [-Out <path>] [-WagesOnly]`. Status: current (re-run after a game patch, on a run built
  with metrics `boot_dump` / `scenario` / `building_inventory`). Traps: several runs are averaged field by field; read at 1836.2.1,
  not day 0 (construction spend is £0 before the first weekly tick, F14); `-WagesOnly` merges only the `wages` block.
- **`tools/audit_pm_refs.ps1`** — scanned vanilla events/JEs/effects for references to main PMs the split relocated →
  `MISSING_PM_REFERENCES.md`. Status: superseded by `emit_vanilla_refs.mjs` and its build-time scan (L40, TIER_REFERENCE_AUDIT.md).

### UI tooling

- **`tools/ui.ps1`** (`balance-ui.cmd`) — the balance-UI server: serves `ui/` at `localhost:8777` (`-Port`, `-NoOpen`),
  `POST /api/build` (writes the config, runs the build), `GET /api/config` and `GET /api/start_exceptions` (the live files,
  verbatim — the sheet boots from them, falling back to the build-time copy in `ui/data.js`). Status: current.
- **`tools/bundle_ui.mjs`** (`balance-snapshot.cmd`) — inlines `ui/builder.html` + `data.js` + `vanilla.js` + `presets.js` and the
  tech-tree page (`techtree.html` with `techdata.js`) into one standalone `balance_ui_snapshot.html` at the repo root (gitignored).
  `node tools/bundle_ui.mjs [--out <path>] [--stale-ok]`. Status: current.
  Traps:
  - Refuses to bundle when `ui/*.js` is older than `config/mod_config.json` (`--stale-ok` overrides), fails on a `<script src>` not
    in its INLINE/OMIT lists, and fails if `techtree.html` stops loading `techdata.js` or `builder.html` stops reading
    `window.__TECHTREE_HTML`; a stale `ui/techdata.js` only warns.
  - `ui/icons.js` is excluded on purpose (Paradox art). "Build now" is disabled in the copy; Export works in the local FILE but is
    inert in a published Artifact (no download permission) — never tell anyone to export from the link.
  - The tree block is appended after the wrapper strip, which is `$`-anchored and deletes every `<meta>` globally.
- **`tools/econ_host.mjs`** — loads `ui/econ.js` and the generated `ui/*.js` under Node with the state containers a browser would
  supply; no model of its own. The config is read from `config/mod_config.json` directly (or `MOD_CONFIG`), never from the copy
  in `ui/data.js`, so a solver's `--write` + re-run does not re-read stale values. Holds the six-rung guard: the listed six-rung
  tools throw on the four-rung canon unless `MOD_CONFIG` is given. Status: current (library).
- **`tools/econ_selftest.mjs`** — regression check of `ui/econ.js` against measured numbers in the docs (F26/F27, the price-formula
  anchors, F31's supply-share bounds). `node tools/econ_selftest.mjs`; run after touching `ui/econ.js`. Status: current.
- **`tools/build_ui2.mjs`** · **`tools/build_ui2_report.mjs`** · **`tools/serve_ui2.mjs`** — UI 2.0: `ui/builder.html` itself,
  byte for byte, over another book's data (`--suffix tier4` by default: `config/mod_config.tier4.json`,
  `config/era_inverse.tier4.json`, `ui2/gen/presets.tier4.js`) → `ui2/ladder_sheet.html` + `.artifact.html` (document tags stripped,
  asserted); `--report` adds `ui2/ladder_workbench.html` (verdict table, vanilla margin anchor, obsolescence matrix, price paths).
  `serve_ui2.mjs` serves `ui2/` read-only on port 8791 (`.claude/launch.json` entry `ui2`), because the browser pane cannot open
  an 800 KB file as a `data:` URL. `node tools/build_ui2.mjs [--suffix s | --config <book> --inverse <file>] [--margins <file>]
  [--refresh-presets] [--report] [--out <path>] [--allow-stale]`. Status: record — built on the retired solver-2 tier4 derivation
  (§10.66.8, §10.72); the committed `ui2/` pages are its output. Traps: `--refresh-presets` runs `extract_presets.ps1`, which
  overwrites `ui/presets.js`, so it moves the canonical file aside and restores it; `serve_ui2` deliberately 404s `/api/config`
  so the sheet's banner correctly reports its embedded copy.
- **`tools/status_board.template.html`** — the committed shell of the status board (section order and wording rules in its
  comment); copy to the scratchpad, fill, publish as an Artifact. The filled board is never committed. Status: current.

### Six-rung machinery (retired)

The scenario-solve pipeline of the retired six-rung book (`config/mod_config.six_rung.json`). The tools listed in
`econ_host.mjs`'s guard (`build_era_ladder`, `era_solver`, `era_scenarios`, `era_tech_sync`, `payback_census`,
`vanilla_payback_census`, `verify_pms`) throw on the four-rung canon unless `MOD_CONFIG=config/mod_config.six_rung.json` is set —
a `--write` would otherwise rewrite a four-rung config as six tiers. The pipeline was `build_era_ladder --write` →
`era_solver --write` → `era_scenarios --write` → `build.ps1`. Refs: §10.74 and the §10.10–§10.66 history.

- **`tools/build_era_ladder.mjs`** — stamped each rung's tier from a per-industry spec, minted the invented (`model_only`) tiers
  and applied the ×1.5 output ladder. Idempotent: run before `era_scenarios`, never after (it discards their volumes).
- **`tools/era_tech_sync.mjs`** — one technology, one tier: lowered a tier's unlocking technology (and everything it unlocks) to
  the tier the ladder placed it in. `ERA_TECH_SYNC=1`, default off, measured as no win. Refs: §10.35.
- **`tools/era_solver.mjs`** — the balance-only reference fit (a price path from margins alone, no scenario) → `config/era_prices.json`.
- **`tools/era_scenarios.mjs`** — the authoritative six-rung solve: prices realised from each tier scenario's order book; volumes,
  building counts, pops and the army solved together per tier; an outer iteration (default 3 passes) re-runs the tier sequence
  against the final recipe book; ends in one joint fixed point over prices / PMs / recipes / counts and reports only that state.
  Writes `config/era_presets.json` and the volumes back into the config. `MOD_CONFIG=config/mod_config.six_rung.json node
  tools/era_scenarios.mjs [--write]` (8–20 min); the headline is the FINAL-STATE ILLOGICALITY line, not the per-tier counts.
  Its `ERA_*` / `PRICE_*` environment knobs are documented where each was ruled: the ruled default set §10.42.4; the fixed point
  §10.14.1; the price ceiling §10.15; raw-producer rules §10.18, §10.22; free entry §10.21; recipe-mix sources §10.25.2; the
  count deadband §10.28; debut traps §10.29–§10.30, §10.32; the loss-making reduction §10.38; urban centres and art academies
  §10.40; the date gate §10.44; the profession wedge §10.45; trade-supplied goods §10.46; the macroscenario §10.47–§10.47.2; the
  infrastructure subsidy tolerance §10.47.4 (mirrored in `ui/econ.js` `LADDER_LOSS_FLOOR`); PM hysteresis and freezing §10.48
  (revert both or neither); the constraint-set regime §10.49; the recipe ratchet §10.50; the army fixed point §10.51; the
  solvency bound §10.63. Status: six-rung, retired.
- **`tools/era_pm.mjs`** — which production methods a scenario may use (technology gates only; every other `unlocking_*` never
  satisfied; laws read against the two-law stance `law_slavery_banned` + `law_commercialized_agriculture`; forbidden and mandated
  PMGs), shared by `era_solver` and `era_scenarios` so they cannot disagree. Status: six-rung, retired (library).
- **`tools/era_macro.mjs`** — the macroscenario data (real US industry and group shares, profession bands) and its helpers;
  selected by `ERA_MACRO=<id>`, a new scenario is a new entry, never an edit to `usa`. Refs: §10.47.2.
- **`tools/era_inverse.mjs`** — the inverse solve (mandated prices → recipes in closed form → seeded counts), tier-count agnostic;
  writes `config/era_inverse.json` / `.<suffix>.json` only. Status: record (experimental; its outputs feed the sheet's red
  `recipes: solver 2` button and the Inverse-solve preset row). Traps: `INV_ITERS=400` (the default) under-converges at four
  tiers and reads better than the converged state — quote 1500. Refs: §10.65–§10.65.4, §10.66.3–.4.
- **`tools/make_solver2_config.mjs`** — derived the solver-2 arm (canonical config + the inverse-solve recipe book + restated
  `target_be` + an ai_value ladder) → `config/mod_config.solver2.json` (gitignored). Status: record. Refs: §10.65.9.
- **`tools/measure_price_paths.mjs`** — wrote `config/measured_price_paths.json` (vanilla anchor prices and a measured raw-price
  path per tier in the British market) for the granular price system. Status: record. Refs: §10.65.5.
- **`tools/verify_pms.mjs`** — audited every PM the tier presets select: a real vanilla PM, and legal for that country; reads
  `common/production_methods` directly. Status: six-rung, retired.
- **`tools/payback_census.mjs`** · **`tools/vanilla_payback_census.mjs`** — what a level costs against what it earns across the six
  tier scenarios (payback per tier, K/GDP, years of construction budget in the capital stock), and the same on vanilla's recipe
  book and costs (`--book mod` re-reads the mod; `--detail`; `--constr-pm` picks the construction method). `payback_census
  --rule` derives and `--write` stores the flat vanilla cost book of §10.61 — the four-rung books price cost in `make_ab_config`
  instead. Status: six-rung, retired. Traps: a loss-making building has no payback and is reported as a count; its £ figures
  use £720 per point flat (F53).
- **`tools/solve_be_targets.ps1`** · **`tools/solve_volumes.ps1`** · **`tools/solve_building_cost.ps1`** — the oldest pipeline:
  `target_be` from each tier's tech era (§8.1), volumes from vanilla recipes + `target_be` (§8), cost from an assumed 20%
  return (§9). All take `-Config`. Status: legacy, superseded by the A/B ladder.
- **`tools/sweep_mult.sh`** — swept the ×1.5 output multiplier through `build_era_ladder` → build → `era_solver` → `era_scenarios`
  and counted illogical cases. Status: six-rung, retired.

---

## 3. The build pipeline — `tools/build.ps1`, its emitters, linters and book makers, and `mod/`

### What build.ps1 runs, in order

`powershell -ExecutionPolicy Bypass -File tools\build.ps1 [-Config <book>] [-DryRun | -SaveTo <name>] [-NoLint] [-NoDeploy] [-NoPreflight]
[-Telemetry <spec.json> | -TelemetryOn] [-TelemetryToken <tok>] [-ControlOnly | -Overlay]`. Emitters get the output mod folder and the config path;
every `node` step throws the build on a non-zero exit unless noted. Order as of 2026-10-24:

1. Load `tools/goods_prices.tsv` and the config; drop `model_only` tiers from the emission copy (the UI keeps the full config).
2. L20 gate, before any file is written: `preflight.ps1 -RepoOnly -Only L20 -Config <cfg>` — the book's paired `config/tech_tree_options.<sfx>.json` must exist.
3. Telemetry text from `telemetry_lib.ps1`. `-ControlOnly` / `-Overlay` stop here: metadata + telemetry (+ the pop-need overlay), preflight, `exit 0`.
4. Clean: everything in the output folder except `.metadata/` and `common/history/` is deleted.
5. `basic_secondaries.mjs --config` — goods of each rung's most basic secondary methods, added into the building name's "Recipe BE".
6. In PowerShell: tier buildings into the owned vanilla building files (`01_industry.txt` + any industry's `source_file`), the additive
   `zzz_pm_rehaul_01_industry` methods and groups, `tools/ladder_tiers.txt`; pop-need weights (`pop_need_weight_mult`);
   `01_admin_strategies.txt` (only when `building_subsidies` has a non-`vanilla` entry or `subsidy_conditional` is set); the owned vanilla
   production-method files (secondary gate remap, `pm_goods` / `pm_employment`, `granularity_divisor`) and group files (methods removed);
   localization for every language; the `zzz_pm_rehaul_diag` on_action; the telemetry files.
7. `extract_start.ps1` (canonical build only: it rewrites the tracked `config/start_baseline.json`; alternate builds read the committed copy).
   Must precede emit_techs, which derives the 1836 grant from it.
8. `emit_techs` → `emit_research_events` → `emit_tech_finish` → `emit_companies` → `emit_goods` → `emit_building_groups` → `emit_building_costs`
   → `emit_dams` → `emit_research_levers` → `emit_ai_schooling` → `emit_ai_treaty_ports` → `emit_treaty_port_rules`.
9. Canonical build only: `ui/data.js` (config, prices, tech index, `basic_secondaries.mjs --options`, the era_inverse subset, start rules),
   then `extract_vanilla.ps1`, `extract_icons.ps1`, `extract_presets.ps1`.
10. `convert_history.ps1` — the 1836 start into `common/history/buildings`.
11. `emit_secondaries` → `emit_craft_start` → `emit_vanilla_refs` → `emit_value_overrides` (last content emitter) → `check_dlc_gates` (on the final state).
12. Linters, all skipped by `-NoLint`: `lint.sh` (bash; prints, never fails the build), then `lint_solvency` → `lint_tech_content` →
    `lint_start_conversion` → `lint_tier_eras` → `lint_pm_combos` (each throws).
13. Build time stamped into the metadata `name`; `Invoke-ModChecks` (completeness, throws); `preflight.ps1 -Mod -Config` (the landmine
    register, throws unless `-NoPreflight`).
14. `-DryRun` deletes the folder; `-SaveTo` keeps `mod_<name>/`; otherwise `robocopy /MIR` to Documents' `mod\pm_tech_rehaul` (unless `-NoDeploy`).

Order dependencies the code relies on: emit_tech_finish after emit_techs and emit_research_events (it patches their files);
emit_research_levers after emit_dams (both edit `00_code_static_modifiers.txt`); emit_ai_schooling then emit_ai_treaty_ports (both edit
`01_admin_strategies.txt`); emit_secondaries after convert_history (it rewrites the buildings' group lists and the 1836 history's methods);
emit_craft_start after emit_secondaries (reads the final 1836 map and the scaled secondary jobs); emit_vanilla_refs after both and before
emit_value_overrides (which edits two of its copies).

Conventions every node emitter follows: `node tools/<x>.mjs <modDir> <config>`, game path from `VIC3_GAME`; config key absent → emits
nothing; a vanilla file is owned only when the build changes it (a verbatim copy would freeze it against the next patch); whole-file copies
are regenerated from the live game every build; every text transform asserts its match count and throws on a no-op; the clean step removes
stale output except under `common/history`, which an emitter writing there must clean itself (emit_craft_start does).

### Linters (the build fails on them, except lint.sh)

- **`tools/lint.sh`** — runs the two awk linters on one concatenation of every vanilla + mod production-method, group and building file
  (BOM-stripped, vanilla first so the mod overrides). Env: `PM_MOD_DIR` (folder), `PM_LADDER` (tier map; build.ps1 sets both for alternate
  builds), `VIC3_GAME`. Prints `LINT PASSED` / `NEGATIVE-GOODS CHECK PASSED`. Status: current (build step, advisory).
  Traps: build.ps1 ignores its exit code — a `LINT FAILED` line does not stop the build; `set -e` means a profitability failure skips the
  negative-goods awk.
- **`tools/lint_profitability.awk`** + **`tools/ladder_tiers.txt`** — the target_be drift guard. For every main method of a tiered building
  (a merged host's second method included), the full break-even (inputs + wages at `wage_pct`) under the first member legal beside it in every
  other group (the "off" method, or the mandated copy; power-bloc-gated never chosen) must be within 6 pp of `target_be`; a main method with
  nothing legal in some group fails. `ladder_tiers.txt` (`pm position target_be wage_pct`) is regenerated by every canonical build and covers
  only industries without `follows_be:false` / `no_mass_be`; prices come from `-v PRICES=goods_prices.tsv`. Status: current.
  Traps: circular by design — `target_be` is restated from the recipe, so it catches hand edits, not bad balance. Refs: §10.93 rule 6.
- **`tools/lint_negative_goods.awk`** — no legal combination of one method per group (gates respected) drives a good's building total below
  −0.011. Goods only, printed only. Status: superseded as the hard rule by `lint_pm_combos.mjs` (which adds jobs and dead methods).
- **`tools/lint_solvency.mjs`** — landmine L18: every tier's base method must break even (wages included) at some output price inside the
  engine band with inputs AT BASE: `target_be ≤ 175` ⇔ O:I ≥ 0.762 at wp 0.25. Recomputes from the goods block, never reads `target_be`; sees
  every tier, shipyards included. `node tools/lint_solvency.mjs [--config <book>] [--census] [--goods-only] [--band]` (`--band` = the retired
  ≤ 400 line, `--goods-only` drops wages; neither is the rule). Status: current (build step). Refs: §10.63, F67.
- **`tools/lint_tech_content.mjs`** — the two hard tech rules against the EMITTED mod: no orphaned technology (it must gate a method of a
  shipped building, a building or a modifier; being a prerequisite does not count) and no technology gating two rungs of one industry.
  `node tools/lint_tech_content.mjs [modDir] [config]`. Status: current (build step). Refs: BUGS_AND_FIXES 2026-08-30.
- **`tools/lint_start_conversion.mjs`** — landmine L13, against the emitted history and vanilla: every vanilla main method maps to a tier
  (coverage is per vanilla production-method group, so one vanilla building split over two industries is judged once), an alias does not
  shift a factory by more than a third of the ladder, and every building key the history creates is the config's. Power-bloc-gated methods and
  methods dropped by ruling are exempt. `node tools/lint_start_conversion.mjs [modDir] [config]`. Status: current (build step).
- **`tools/lint_tier_eras.mjs`** — landmine L31, the tier rule (§10.78), on the config and its paired tree: every rung within ±1 of the tier
  its gate technology's tech era implies through `era_game_era` [1, 3, 4, 5] (tech era 2 → t1), one rung per tier, output and value added
  per level rising with tier; for an A/B book, output, input value, cost and ai_value re-derived from the vanilla first method and every
  generator field `_ab` records (`anchor_for`, `cost_ratio`, `cost_ladder`, `cost1`, `in_ladder`, `in0_for`, `down_step`, `in1_pop` …);
  crafts against `_artisan` (incl. `craft_ai`), merged rungs against `_merge` (host directly below, midpoint cost / ai_value, or `cost_rule:
  'own'`, `ai_rule: 'cond'`). `node tools/lint_tier_eras.mjs [--config <book>] [--census]`; also preflight `Test-LmL31`. Status: current.
  Traps: a book keyed on rung index (pre-2026-09-13) fails by design; the `anchor_for` origin is 0 unless the flag names the industry,
  never its own first rung (F111); a book without `era_game_era` is out of scope.
- **`tools/lint_pm_combos.mjs`** — the hard production-method rule (§10.93), on the emitted mod over the game, every building the game loads:
  (1) no legal combination takes any input good, output good or profession's employment below −0.011; (2) no dead method (gated on main
  methods its building lacks — the game still shows it, greyed, at its own numbers); (3) every 1836 history block names only methods its
  building's groups list; (4) no secondary beside a main method `lib_secondary_compat.mjs` marks incompatible (an unreviewed carried pair only
  warns); (5) no labour-saving method on a craft rung; (6) every group of a tier building has something to run beside every main method;
  (7) a mandated automation is the only choice beside its main method and carries no technology gate its main method does not imply;
  (8) no group of a tier building offering only an "off" method. `node tools/lint_pm_combos.mjs [modDir] [config]`. Status: current (build step).
- **`tools/check_dlc_gates.mjs`** — landmine L39, the DLC rule: every shipped `.txt` at a vanilla path keeps vanilla's count of
  `has_dlc_feature` lines and `dlc =` fields (comments excluded). Additive files are not checked — our own hooks that fire DLC content must
  carry the condition themselves. `node tools/check_dlc_gates.mjs [modDir]`. Status: current (build step, on the final state).
- **`tools/list_replaced_files.mjs`** — the README's list of replaced vanilla files (POLISH_1_0.md H9): every file of the built mod at a vanilla
  path (it replaces vanilla's whole), grouped by folder, plus the metadata's `replace_paths`, written into `README.md` between
  `<!-- replaced-files:start -->` and `<!-- replaced-files:end -->` (throws without them). `node tools/list_replaced_files.mjs [--mod mod]
  [--readme README.md] [--print]`. Needs the game folder (`VIC3_GAME`). Status: current; re-run on the build you ship (146 files in 26 folders
  on 2026-10-26).
- **`tools/strip_release_logging.mjs`** — the release build's logging pass (POLISH_1_0.md H8): in every `zzz_pm_rehaul*` script file under
  `common/` and `events/` but the diag manifest, removes each line that is only `debug_log = "…"` or only `<scope> = { debug_log = "…" }`;
  throws on any other `debug_log` left there and on a `zzz_v3tb_*` telemetry file. Blocks a removed line leaves empty stay (valid no-ops);
  vanilla-path files keep vanilla's own lines. `node tools/strip_release_logging.mjs <modDir>`. Status: current (build step, `-Release`
  only; 1,789 lines from 8 files on the canon, 2026-10-26).

### Content emitters

- **`tools/emit_techs.mjs`** — the tech tree from the book's paired `tech_tree_options.<sfx>.json` (the option marked `ships`). Writes:
  additive `technology/technologies/zzz_pm_rehaul_techs.txt` (minted technologies; 3 in the canon), the placeholder invention icon, tech loc;
  `common/defines/01_pm_rehaul_defines.txt` (NAI from `ai_defines`; any other vanilla namespace from `game_defines`; NTechnology only if the
  ahead-of-time factor differs from vanilla's 0.25, which it does not); whole-file `10_production` / `20_military` / `30_society` only when
  they carry tech-era moves (marked `reEra` in the tree), added prerequisites (`prereqsAdded`, throws if vanilla's list is no longer `vanillaPrereqs`), the aniline swap or a
  `tech_ai_weight_mult` ≠ 1 (default 1/1/1 = nothing); `00_starting_inventions.txt` only when the derived 1836 grant differs from vanilla's
  file (canon: not shipped). Status: current (build step).
  - The 1836 grant: a rung's technology goes to the starting-tech tiers of countries owning one on the map that could have built it in
    vanilla (building gate and method gate), minus what `add_era_researched = era_1` and vanilla's named grants cover (§10.55; L14/L15).
  - `game_defines` keys must exist in vanilla `00_defines.txt` or in `ENGINE_ONLY_DEFINES` (`NEconomy.WORLD_MARKET_MONOPOLY_THRESHOLD`);
    known dead keys (`DEAD_DEFINES`) throw; the engine still range-checks values at load (L33, F241). Tech spread stays vanilla.
  Traps: its missing-technology error still suggests `tech_tree_spec.mjs --write`, which refuses four-rung books — regenerate the twin
  through the book's chain (`make_tier4_techs.mjs` at its root); a tech-id pattern must admit a hyphen (three vanilla method names have one).
- **`tools/emit_research_events.mjs`** — the research journal entries from `research_events` (`enabled: false` → nothing). Sources per
  technology: rule A (the ladder's previous rung), B (`necessity_anchors`: buildings, groups counted in people, `good:<name>` market anchors),
  C (war: `war_gate`, `war_channel`, `naval_*`), D (non-tier production technologies, by the group of what they unlock, parsed live),
  `extra_entries` (§10.95; a `mark` must be a whole number of fully staffed levels), `condition_entries` / `condition_values` (§10.98), plus
  the §10.97 keys (`sources_additive`, `literacy_by_era`, `follower_halving`, `implementation_repeats`, `placement`, `count_display`,
  `marks_whole_levels`, `era1_rule_a`, `exclude_techs`). Writes journal entries, progress bars (all `monthly_progress`), script values,
  effects, the war-gate and placement on_actions, loc. A completed stage logs `PMR_JE|<stage>|<tech>|<country name>` to debug.log (counted by
  `testbed/ledger/je_tally.mjs`, de-duplicated — L28). Every anchor lookup throws when missing. Status: current (build step).
  - Skips `disabled` industries and tech-era-1 technologies (except, under `era1_rule_a`, one gating a rung with a predecessor). A merged
    rung counts as its host's levels running its method (`has_active_production_method`); the host's own source counts only its own method.
  - The war gate runs in `on_monthly_pulse_country` and reaches the bar as the expiring variable `pmr_wargate_<tech>` (a bar's script has
    no valid ROOT, BUGS_AND_FIXES 2026-08-17).
  Traps: no ASCII `'` in any text a bar displays or any `$key$` it references, in any language (throws); occupancy is a weight, never a
  `limit` filter (MODDING_NOTES); identify a war bar by its `pmr_wargate_<tech>` variable, not its cadence or span — every bar is monthly.
- **`tools/emit_tech_finish.mjs`** — `research_events.finish_boost` {enabled, threshold 0.99, add 10000}: every researchable technology's
  ai_weight ends in `if = { limit = { has_technology_progress = { technology = X progress >= threshold } } add = … }` (the trigger reads a
  fraction of the penalised cost). Appended last (ai_weight evaluates top to bottom), `add` not multiply (the ahead-of-time divisor applies
  outside it); owns all three vanilla technology files when on. Throws on a doubled or misnamed boost, a conditional `can_research`, the
  retired `diag` / `unresearchable` keys. `force_test` is a probe-only A/B (`testbed/ledger/finish_force.mjs`). Status: current. Refs: F160.
- **`tools/emit_companies.mjs`** — the company chain extension: every vanilla `company_types` reference to a tiered industry becomes the whole
  chain (type lists expanded, `is_building_type` / `has_building` formation tests OR-wrapped, prosperity `building_<anchor>_throughput_add`
  lines one per rung, `ai_construction_targets` duplicated per rung). Emits only changed files + the additive `zzz_pm_rehaul_company_modifiers.txt`
  declaring a `building_<key>_throughput_add` type per rung key (vanilla hand-enumerates them) + loc. Craft and merged keys leave every list
  (a survivor throws with file:line). `company_target_gate: true` (opt-in, off) gates targets below the best unlocked rung (no effect, F100).
  Status: current (build step). Traps: where shipyards are tiered (two industries, one vanilla building), `building_shipyard` maps to both chains. Refs: F77.
- **`tools/emit_goods.mjs`** — `goods_traded_quantity` {good: n} → whole-file `common/goods/00_goods.txt` with only those lines changed (annotated
  with vanilla's value); every other line and the goods order (save indices depend on it) stay vanilla's. Throws on an unknown, `local` or
  untradeable good, a good with no `traded_quantity` line, or a value < 1. Status: current (canon: 35 goods). Refs: F155, F159.
- **`tools/emit_building_groups.mjs`** — `building_group_ai` {group: {field: number}} → whole-file `00_building_groups.txt` with only those
  direct-child fields changed (throws on an unknown group, a field not a direct child, more than one match; never inserts); `building_groups_add`
  {bg_pmr_<x>: {name, fields}} → additive `zzz_pm_rehaul_groups.txt` + loc (the canon's `bg_pmr_crafts`). Status: current (canon: groups_add only).
  Refs: F178, F179 (the foreign-investment factor, not adopted).
- **`tools/emit_building_costs.mjs`** — `building_required_construction` {building: points} patched into building files the build already owns
  (throws on an unowned building or ≠ 1 match). Canon: the power plant at 1,600. Status: current. Refs: §10.89.1.
- **`tools/emit_dams.mjs`** — the hydro dams from `dams` (absent / `enabled: false` → nothing), numbers from `lib_dams.mjs`. Status: current.
  - `dams.layout`: `resource4` (canon) = four types `building_dam_{small,large}_{cheap,dear}` capped by resource slots (whole-file
    `map_data/state_regions` copies); `per_project` (default) = a building per project, capped by a `..._max_level_add` line per project in a
    whole-file `00_code_static_modifiers.txt` (`base_values`). Surveys, decisions and journal entries are per project either way.
  - Group `bg_pmr_hydro_dams` (not government-funded); `ownership_type = self` (a foreign builder needs it); no `unlocking_technologies` (the
    technology is checked on the builder, `scope:investor_country`); `can_build_private` never, unless `dams.private` (`all` in the canon).
  - `dams.rules = family` (canon): rights for the owner, its overlord chain, or investment rights in any of them (read from the HOST's
    treaties); a family survey opens the dam to the family; the AI takes the survey decision (spare bureaucracy, 30-day cooldown).
  - Also the built/expanded `effects`, whole-file vanilla trait files with hydro electricity lines commented out (`strip_trait_modifiers`),
    `PMR_DAM|…` log lines, loc; `dams.log_levels`, `probe`, `perf_off`, `static_mode` are probe-only.
  Traps: no country-tag data function exists — log lines carry the NAME, logged from the country scope. Refs: §10.89, §10.89.12–14, F173, F176, F221, F240.
- **`tools/emit_research_levers.mjs`** — `research_levers`: `static` {block: {key: value}} replaces existing lines of
  `00_code_static_modifiers.txt` (whole-file; edits emit_dams' copy if present; a key not exactly once in its block throws — never inserts);
  `university_innovation_mult` k scales the three university methods' innovation in a whole-file `production_methods/07_government.txt`.
  Status: current (canon: innovation base / cap / literacy term 25, universities × 1/6). Refs: §10.96, §10.101.1.
- **`tools/emit_ai_schooling.mjs`** — `ai_schooling`: `institution_score` N inserts `institution_scores = { institution_schools = { value = N } }`
  into every administrative strategy (edits the build's copy of `01_admin_strategies.txt`, else copies vanilla's; throws if a strategy already has
  the field); `law_enact_add` N adds `+N while no schools` to the religious / private / public schools laws' `ai_enact_weight_modifier`
  (whole-file `laws/01_education_system.txt`). Willingness only — the laws' own gates (serfdom, state religion, technology) are untouched.
  Status: current (canon 100 / 500). Refs: §10.97 item 7.
- **`tools/emit_ai_treaty_ports.mjs`** — `ai_treaty_ports` (absent in the canon): a `treaty_port_value` block in every administrative strategy
  (trade-law points, population and host-state terms, multipliers, cap, a `tech_add` penalty without a technology lead; helper
  `script_values/zzz_pm_rehaul_treaty_ports.txt`); `driver` = a yearly on_action starting `dp_take_treaty_port` plays against recognised hosts
  (the engine targets only unrecognised ones). Throws on an unknown key or law or an already-present field. Status: deferred to mod 1.1 (game
  1.15). Refs: §10.103, F243, F244.
- **`tools/emit_treaty_port_rules.mjs`** — `treaty_port_rules` (absent in the canon): `no_port_building` swaps `is_potential_treaty_port` for
  `pmr_treaty_port_candidate` (whole-file `treaty_articles/14_treaty_port.txt`, `war_goal_types/25_take_treaty_port.txt`); `seed_port_on_cession`
  builds a level-1 port before the cession; `trade_center_gate` moves the AI trade-centre GDP gate into `can_build_*` with treaty ports exempt
  (needs MARKET_CAPITAL 1 / NON_MARKET_CAPITAL 2 in `ai_defines`, else throws — the engine rejects 0). Status: deferred to mod 1.1.
  Traps: `no_port_building` alone cedes the province as plain territory; use it with `seed_port_on_cession`. Refs: §10.103, F244–F246, L33.
- **`tools/emit_secondaries.mjs`** — per-rung secondary methods (canning, luxury lines, rayon, porcelain, radios, tank/aeroplane conversions …),
  inputs following the rung's own input ratio; labour-saving methods keep vanilla quantities; reductions round toward zero. Rewrites the
  buildings' group lists and strips from the 1836 history any method a building no longer carries (the engine rejects a whole
  `create_building` over one invalid method); `--write` stores `secondary_goods`; `secondary_goods_override` {copy: {line: value}} sets a
  ruled value. Status: current (build step). Refs: §10.91.1–2, §10.93.
  - Rule `top` (any book with `_merge` or `_artisan`, so the canon; `secondary_rule` overrides): one method per (industry, line) shared by
    every rung listing it, sized to the industry's t2 rung (`secondary_anchor_era`) against vanilla's most advanced main method; a rung omits a
    line that would go negative beside its main method. Rule `lowest` (older books): a copy per main method. Crafts: no goods lines, minted jobs ×
    `workforce_mult`, `exclude_secondary_pms` / `_pmgs` dropped.
  - §10.93: no method none of the building's main methods can run; compatibility from `lib_secondary_compat.mjs`; a mandated automation is the
    only member beside its main method (law gates removed, technology gate kept only where the main method implies it); "off"-only groups dropped.
  Traps: never put `is_hidden_when_unavailable` on a PM-gated copy — it becomes unselectable (BUGS_AND_FIXES 2026-10-11).
- **`tools/emit_craft_start.mjs`** — the craft rungs' 1836 start (no crafts → nothing, and it deletes any history file it wrote earlier,
  recognised by its header). (1) Ownership: an owner-building entry of a craft block keeps its original levels (the engine sizes financial
  districts and manor houses by starting levels), the rest becomes self-owned. (2) Workforce: each state's craft jobs by profession
  (laborers excepted) carved out of its untyped vanilla pops into typed blocks (≤ 90% of any block, population unchanged), shipped as
  whole-file `common/history/pops` copies. (S) With `_artisan.seed`: tops each country's craft output up to its vanilla t0 factories', over its
  N most urbanised states within spare 1836.2.1 infrastructure, as new typed pops (identity from `config/measured_1836_pop_identity.json`)
  taken off peasants; shortfalls reported. Throws on a craft state with no region_state block or too few untyped pops. Status: current.
  Refs: §10.91.1, §10.91.5, F181, F197.
- **`tools/emit_vanilla_refs.mjs`** — the tier-reference fix: every vanilla script position naming a tiered industry (a rung-0 key, a moved main
  method, a renamed secondary, a `building_<key>_throughput_add`) rewritten to the ruled rung set — whole-file transforms of ~63 vanilla files
  from the live game (or the build's own copy where an earlier emitter wrote it), additive helper triggers / effects / a value
  (`pmr_is_<ind>`, `pmr_has_<ind>`, `pmr_runs_<pm>` …, only those used), six throughput modifier types with loc, the Montenegro first-arms check
  (gated on its DLC). Every snippet and token count asserted; DLC gates counted per file; a scan of the game tree throws on any tiered
  reference left in an unowned file not on its ACCEPTED list. After a patch: `REFS_LEARN=1 node tools/emit_vanilla_refs.mjs <modDir> [config]`
  prints the counts without dying. Status: current (build step). Refs: POLISH_1_0.md §2, TIER_REFERENCE_AUDIT.md, ON_GAME_UPDATE.md.
- **`tools/emit_value_overrides.mjs`** — `vanilla_value_overrides` [{file, block, key, vanilla, value, why}]: one line of a named top-level block
  set to `value`; the key must sit exactly once in its block at the stated `vanilla` value (a patch that moves it throws — re-rule, never
  re-point); edits the build's copy if one exists, else copies vanilla whole; DLC gates counted before and after. Canon: the four flat research
  adds × 1/3. Status: current (last content emitter). Refs: POLISH_1_0.md Q1.

### Book makers (`make_*_config.mjs`)

Shared shape: `node tools/make_<x>_config.mjs --base <book> --suffix <sfx> [flags]` writes `config/mod_config.<sfx>.json` = the base + its keys
+ a `_<x>_variant` record carrying the exact command, and copies the base's tree twin to `config/tech_tree_options.<sfx>.json` (L20). Each
maker refuses a base that already carries its keys, and its ruled table lives only in that file. A flag added later is recorded only when set,
so older books regenerate byte for byte from their own commands. `make_tier4_config.mjs` / `make_tier4_techs.mjs` / `make_ab_config.mjs` are
catalogued with the ladder tools.

The canon's chain, read from its records: `tier4-e1` (make_tier4_config `--derive motor` + make_tier4_techs) → make_ab_config (`_ab.command`)
→ make_trade_config → make_dam_config (+ `dams.rules = family`) → make_artisan_config (`--staffing pb --hire-floor 2 --craft-rule 0.6,0.89
--seed 5 --craft-ai 800`) → make_merge_config (`--host-cost textile:own --ai-rule cond`) → make_research_extra_config → make_dam4_config
`--script-placement` → make_research_levers_config `--innov-x 25` → make_research_rework_config → make_research_society_config, then by
hand: `dams.private = all`, `game_defines` (monopoly threshold 0.99), the 2026-10-21 polish keys. ⚠ Intermediate books on disk may carry
stale tree twins; re-run the chain from its root rather than one step.

- **`tools/make_artisan_config.mjs`** — turns the six light-industry t0 rungs into 500-worker craft rungs: per-level recipe, a 5,000-head
  staffing block × `workforce_mult` 0.1, cost ÷ 50, group `bg_pmr_crafts` (+ `building_groups_add`), `levels_per_mesh` 500, excluded
  secondaries, `craft: true`, `target_be` / `wage_pct` restated; records `_artisan` (checked by L31). Flags: `--staffing ruled|shop|pb`
  (canon pb: 30% shopkeepers / 70% laborers), `--hire-floor X|none` (`min_productivity_to_hire` on the group; default 2, refuses 0, `none` = the
  engine's £3, only for old records), `--craft-rule <share>,<cross>`, `--seed <cities>` (read by emit_craft_start), `--craft-ai <v>`. Throws on a
  base whose t0 is not vanilla-staffed (500/4,500). Status: current. Refs: §10.91.1, §10.91.3–5.
- **`tools/make_merge_config.mjs`** — makes six add-on rungs second main methods of the rung below (`method_of: <host>`; food t2, textile t3,
  furniture t3, paper t2, fertilizer t1, steel t3), host cost / ai_value the geometric midpoint, recipes verbatim; records `_merge` (checked by
  L31). `--host-cost <ind>:own` keeps a host's own cost (`cost_rule: 'own'`); `--ai-rule cond` gives the host its own tier's ai_value raised to the
  merged rung's once the owner holds the merged technology (`ai_value_cond`, emitted by build.ps1). Probe-only (suffix must contain "probe"):
  `--grant`, `--grant-industries`, `--grant-full`, `--grant-host`, `--ai-cond-values`. Throws on a craft rung in a pair, differing staffing,
  a rung with no technology. Status: current. Refs: §10.91.2.
- **`tools/make_trade_config.mjs`** — adds `goods_traded_quantity` + `_trade`: the five-class table (bulk unchanged, semi-bulk ×√2,
  manufactures ×2, compact ×2√2, precious ×4, all × W 240) derived from the game's base prices; an unclassed tradeable good throws;
  `merchant_marine` excluded. `--scale k` (all W × k, recorded as `_trade.scale`), `--ruled-by "…"`. Status: current (canon ×1). Refs: F159 §7, F163.
- **`tools/make_dam_projects.mjs`** — `node tools/make_dam_projects.mjs config/dam_sites_research.json` writes `config/dam_projects.json`: the
  research rows per state + the irrigation `EFFECTS` table and the ruled `CUTS` table (both in the script; a cut naming a missing project or row
  throws). Status: current. Refs: §10.89.9–10.
- **`tools/make_dam_config.mjs`** — the dam book: base (default `canon-b164-trade`) + power plant at 1,600 + `dams` + must-have dam subsidies;
  throws on a base already carrying dams. `--probe` (technology grants, 2-month surveys, cost × 0.05), `--probe --contest [--contest-grant
  chain|overlords|top|none] [--elec-sink PER]`, `--grant TAGS`, `--ai-value N`; `--ai-self` is removed and throws. Status: current. Refs: §10.89.
- **`tools/make_dam4_config.mjs`** — `dams.layout = resource4` + the ruled `dams.resource4` table (only here) + the four class keys must-have in
  place of per-project subsidies; `--script-placement` adds `research_events.placement = script`. Status: current. Refs: §10.89.13, F221.
- **`tools/make_research_extra_config.mjs`** — adds the ruled `research_events.extra_entries` table (25 technologies, only here) +
  `era1_rule_a`. Status: current. Refs: §10.95.
- **`tools/make_research_levers_config.mjs`** — adds `research_levers`: `--cap-lit`, `--cap-base`, `--innov-base`, `--spread-base`,
  `--spread-lit`, `--uni-mult k`, or `--innov-x x` (innovation base = cap base = literacy term = x, universities × x/150; exclusive with the four
  it sets); `--dam-staff L,M,E` pins `dams.staff_per_50`. Status: current (canon `--innov-x 25`). Traps: a `dams.staff_per_50` pin inherited from
  the base is dropped unless `--dam-staff` is given (the book runs lib_dams's default 10/15/10). Refs: §10.96, §10.101.1.
- **`tools/make_research_rework_config.mjs`** — the §10.97 keys: 36-month industry stages, `sources_additive: false`, `literacy_by_era`
  25–65%, `follower_halving`, `implementation_repeats` 18, and `ai_schooling` {100, 500}. Requires a base with `placement = script` and no
  `dams.staff_per_50` pin; run make_research_levers_config first. `--wild` = the smoke book (never measured). Status: current. Refs: §10.97.
- **`tools/make_research_society_config.mjs`** — the §10.98 entries on a §10.97 base: ships, frontline, contagious ideas, tropical empire,
  civilizing mission, state apparatus, universities, finance, cities, antibiotics (`condition_entries` / `condition_values`, follower marks,
  first acquisition × 2). `--wild` = smoke book. Status: current. Refs: §10.98, F227.
- **`tools/make_treaty_port_config.mjs`** — adds `ai_treaty_ports` + `_treaty_port_variant` (the table only here). `--scale k`, `--driver
  extreme|production|production-nogp`, `--extreme` (probe that the engine reads the value; never played). Status: deferred (mod 1.1). Refs: F243, F244.

### Shared libraries and helpers

- **`tools/goods_prices.tsv`** — the one base-price table, read by build.ps1, the linters, the solvers and the UI. Status: current.
  Traps: never copy prices into a tool; refresh after a patch (ON_GAME_UPDATE).
- **`tools/lib_secondary_compat.mjs`** — which secondary / automation method may run beside which main method, reviewed pair by pair
  (§10.93): `REVIEWED`, `NOT_BESIDE` (the incompatible pairs with reasons), `MANDATED` (Mechanized Looms ↔ Sewing Machines, Automatic Power Looms ↔
  Electric Sewing Machines, Assembly Lines ↔ Mass Production — the only choice beside that method, not allowed beside earlier ones). Keyed by
  vanilla method names (a minted rung takes the vanilla method below it). Also the one definition of "most basic secondaries"
  (`basicSecondaries`, `basicTotals`, `basicEmployment`), `secondaryOptions` (the sheet's options) and `readTechPrereqs` / `techClosure`.
  `validateCompat(GAME)` throws on a key the game lacks. Consumed by emit_secondaries, lint_pm_combos, make_ab_config, basic_secondaries.
  Status: current. Refs: §10.93.
- **`tools/basic_secondaries.mjs`** — `node tools/basic_secondaries.mjs --config <book> [--options]`: JSON of each rung's most-basic-secondary
  goods (build.ps1 prices them into "Recipe BE"), or with `--options` the per-rung secondary options for `ui/data.js` `sec_options`. Status: current (build step).
- **`tools/restate_basic_be.mjs`** — `node tools/restate_basic_be.mjs --config <book> [--write]`: re-applies the basic-secondaries
  `target_be` / `wage_pct` restatement to a book made before 2026-10-03 without regenerating its chain; refuses (prints UNEXPECTED, writes
  nothing) unless every unmandated rung reproduces its stored numbers; `--write` records `_basic_be`. Status: record-keeping utility.
- **`tools/lib_dams.mjs`** — the one dam derivation (§10.89): project → levels (≤ 10,000 points), points per MW from the book's power-plant
  cost, 0.52 electricity per MW, staff and upkeep per 50 electricity (default 10/15/10), the per-level technology class (electrical_generation /
  steam_turbine / arc_welding), survey months and bureaucracy; `resourceLayout(P, projects)` = the four-class slot layout (with `dams.resource4`
  the ruled table, each class asserted profitable at the worst prices). Used by emit_dams and `testbed/ledger/dam_slots.mjs`. Status: current.

### Research model (read-only)

- **`tools/research_model/`** — a weekly research simulation with measured rules, for sweeping research levers without a game run; touches
  no book. `lib_sim.mjs` (research = min(innovation, cap); AI picks in each tree's oldest tech era ∝ ai_weight⁴; spread uniform in the oldest
  missing tech era; levers capLit, innovBase, uniMult, spreadLit, tech-era costs, per-tree multipliers, resEff), `lib_tree` / `lib_paths` /
  `lib_grants` / `lib_metrics` (tree, a run's yearly paths, its research-entry grants, the targets). Readers: `flow_check`, `spread_pick`,
  `research_pick`, `innovation_fit` (need v18 summaries), `validate.mjs <summaries> [--mod] [--je]`, `fit_eff`, `sources` (simulated points
  by source), `points_by_source` (the same from runs), `tech_by_group`, `compare_arms` (stitched runs joined by `+`), `sweep.mjs --runs …
  --mod … --tree … [--van …] --set "name:key=v,…"`. Status: current. Traps: GDP is not modelled. Refs: §10.96, F223.

### Six-rung machinery, retired

- **`tools/tech_tree_spec.mjs`** — the six-rung book's candidate tech trees (`--write` → `config/tech_tree_options.json` + `ui/techdata.js`;
  `--chains`). Throws on the four-rung canon unless `MOD_CONFIG=config/mod_config.six_rung.json`. Status: six-rung, retired — except its `ONSET`
  table (a narrative date for every technology), which `make_tier4_config.mjs` parses out of the file as text and the tech-timing ledgers use.
  Traps: keep `const ONSET = {` parseable; the four-rung tree is `make_tier4_techs.mjs`'s.

### mod/ — the generated mod

Git-tracked build output of the canonical build; never hand-edit except `.metadata/metadata.json` (build.ps1 rewrites the `(built …)` suffix of
its `name`; `replace_paths: ["common/history/buildings"]`). Only `mod/` reaches the game: the deployed copy is a robocopy of it (a junction is
not traversed by the launcher). "Whole-file" = a vanilla path the mod shadows; "additive" = a `zzz_pm_rehaul_*` / `zzz_v3tb_*` name.

| path | generated by | kind | present when |
|---|---|---|---|
| `common/buildings/01_industry.txt`, `06_urban_center.txt` (`11_private_infrastructure.txt`) | build.ps1 | whole-file | an industry lives in that file (canon: 01 + 06 for the art academy) |
| `common/{production_methods,production_method_groups}/zzz_pm_rehaul_01_industry.txt` | build.ps1 | additive | always |
| `common/production_methods/<vanilla>.txt` | build.ps1 (gate remap → 01_industry; `pm_goods`/`pm_employment` → 06_urban_center), emit_research_levers (07_government) | whole-file | only files actually changed |
| `common/production_method_groups/<vanilla>.txt` | build.ps1 | whole-file | a book removes a method from a vanilla group |
| `common/production_methods/zzz_pm_rehaul_secondaries.txt`, `production_method_groups/zzz_pm_rehaul_secondary_groups.txt` | emit_secondaries | additive | always |
| `common/history/buildings/*.txt` | convert_history.ps1, then emit_secondaries | replaces vanilla (`replace_paths`) | always; not wiped by the clean step |
| `common/history/pops/*.txt` | emit_craft_start | whole-file | the book has craft rungs |
| `common/ai_strategies/01_admin_strategies.txt` | build.ps1 (subsidies), emit_ai_schooling, emit_ai_treaty_ports | whole-file | `building_subsidies` non-vanilla / `subsidy_conditional` / `ai_schooling` / `ai_treaty_ports` (canon: yes) |
| `common/ai_strategies/00_default_strategy.txt` and ~62 more vanilla files under journal_entries, events, laws, amendments, decisions, scripted_buttons/effects/triggers, static_modifiers, power_bloc_principles | emit_vanilla_refs | whole-file | always |
| `common/{scripted_triggers,scripted_effects,script_values}/zzz_pm_rehaul_industry_*`, `on_actions/zzz_pm_rehaul_vanilla_refs.txt`, `modifier_type_definitions/zzz_pm_rehaul_vanilla_refs_modifiers.txt` | emit_vanilla_refs | additive | always |
| `common/company_types/*.txt` (22) | emit_companies | whole-file | always |
| `common/modifier_type_definitions/zzz_pm_rehaul_company_modifiers.txt` | emit_companies | additive | always |
| `common/goods/00_goods.txt` | emit_goods | whole-file | `goods_traded_quantity` (canon: yes) |
| `common/building_groups/00_building_groups.txt` / `zzz_pm_rehaul_groups.txt` | emit_building_groups | whole-file / additive | `building_group_ai` / `building_groups_add` (canon: the latter) |
| `common/technology/technologies/zzz_pm_rehaul_techs.txt`, `gfx/interface/icons/invention_icons/zzz_pm_rehaul_placeholder.dds` | emit_techs | additive | always (canon: 3 minted technologies) |
| `common/technology/technologies/{10_production,20_military,30_society}.txt` | emit_techs, then emit_tech_finish | whole-file | carries a tech-era move / added prerequisite / weight multiplier / the finish boost (canon: all three) |
| `common/defines/01_pm_rehaul_defines.txt` | emit_techs | additive (partial override) | `ai_defines` / `game_defines` set (canon: NAI + NEconomy) |
| `common/scripted_effects/00_starting_inventions.txt` | emit_techs | whole-file | the derived 1836 grant differs from vanilla (canon: absent) |
| `common/{journal_entries,scripted_progress_bars,script_values,scripted_effects}/zzz_pm_rehaul_research*`, `on_actions/zzz_pm_rehaul_wargate.txt`, `on_actions/zzz_pm_rehaul_research_{place,held,global}.txt` | emit_research_events | additive | `research_events.enabled` (place on_action: `placement = script`) |
| dam buildings, groups, methods, decisions, journal entries, on_actions, script values, effects, static modifiers, `state_traits/zzz_pm_rehaul_dam_traits.txt` (all `zzz_pm_rehaul_dams*`) | emit_dams | additive | `dams.enabled` |
| `common/state_traits/<4 vanilla files>` | emit_dams | whole-file | `dams.strip_trait_modifiers` |
| `map_data/state_regions/*.txt` | emit_dams | whole-file | `dams.layout = resource4` |
| `common/static_modifiers/00_code_static_modifiers.txt` | emit_dams (per_project caps), emit_research_levers | whole-file | either applies (canon: research levers) |
| `common/laws/01_education_system.txt` | emit_ai_schooling | whole-file | `ai_schooling.law_enact_add` |
| `common/treaty_articles/14_treaty_port.txt`, `war_goal_types/25_take_treaty_port.txt`, `script_values/zzz_pm_rehaul_treaty_ports.txt` | emit_treaty_port_rules / emit_ai_treaty_ports | whole-file / additive | `treaty_port_rules` / `ai_treaty_ports` (canon: absent) |
| files named in `vanilla_value_overrides` | emit_value_overrides | edits the existing copy, else whole-file | the key is set (canon: 4 lines) |
| `common/pop_needs/00_pop_needs.txt` | build.ps1 | whole-file | `pop_need_weight_mult` |
| `common/on_actions/zzz_pm_rehaul_diag.txt` | build.ps1 | additive | always — logs `PM_TECH_REHAUL: init OK … (build <ts>)` to debug.log |
| `common/on_actions/zzz_v3tb_telemetry.txt`, `script_values/zzz_v3tb_values.txt` (+ `_probe_values`), `events/zzz_v3tb_probe.txt` | build.ps1 (telemetry_lib.ps1) | additive | telemetry builds only; the events file only for sub-month metrics |
| `localization/<lang>/replace/zzz_pm_rehaul_*_l_<lang>.yml` | build.ps1 (main), emit_techs, emit_research_events, emit_companies, emit_building_groups, emit_secondaries, emit_dams, emit_vanilla_refs | additive, in `replace/` so name overrides win | 11 languages, UTF-8 with BOM |

Engine facts behind several rows live elsewhere: no valid ROOT in a progress bar's script (BUGS_AND_FIXES 2026-08-17); occupancy as a
weight and `replace_paths` (MODDING_NOTES); `add_era_researched = era_1` as the only era granted at the start (BALANCE_FRAMEWORK §10.53, §10.55).

---

## 4. The testbed (`tools/testbed/`)

Paths are relative to `tools/testbed/`; run from the repo root (`node tools/testbed/<path> …`, `powershell -ExecutionPolicy Bypass -File
tools\testbed\<path> …`). Invocation lines give the arguments only. Procedure (launch, smoke-check, wait, report) is TESTBED_OPERATIONS.md,
telemetry is TESTBED_METRICS.md, guardrails are TESTBED_LANDMINES.md. Results live in `sessions/` (gitignored, never deleted), specs in
`schedules/`. Most readers take a run group `<session>[,<session>][:<setup>]` (as `label=<group>` or `--arm <group>`), count only usable
runs through `ledger/lib_runs.mjs`, and print the runs they dropped.

### The harness: scheduler, observer, launchers, watchers

- **`run_schedule.ps1`** — the entry point for all measurement: an ordered schedule JSON → `build.ps1` per run (rebuilt every run, never
  cached) → `run_observer.ps1` → harvest → the session's `markets_all.tsv` (rows prefixed `run_index`, `setup`). Keys `[p]` pause ·
  `[r]` resume · `[s]` stop after this run · `[x]` stop now; 3 crashes from one autosave fail the run, 3 before the first autosave abort
  the schedule; exit 0 ok · 2 stopped · 3 fatal.
  `-Schedule <spec.json> [-WhatIf] [-OutRoot] [-KeepMods] [-KeepSaves] [-NoSaveHarvest] [-HarvestWorkers 4] [-BuildTimeoutMinutes 10] [-NoRedFlagFeed] [-NoMachineMonitor]`
  (`-WhatIf` = plan, builds and time estimate only; there is no `-Label`). Per run it adds the red-flag feed (`market_goods_wide` on
  1 July of every year to the year before `until`, on `lib_markets.TELEMETRY_TAGS`, merged with the schedule's own wide keys, recorded in
  `telemetry.json`; `-NoRedFlagFeed` only to match an old batch); per session it starts `machine_monitor.ps1` (proven alive; a failed
  start only warns). It runs `archive_autosaves.ps1` → `<run>\saves\` and `harvest_saves.ps1 -Watch` → `<run>\save_summaries\`
  concurrently with the game, plus a final drain after each run (`-HarvestWorkers 0` = drain only), and checks `NO_NEW_RUNS` before
  every run. Continuation runs: run keys `continue_save`, `continue_expect_after` (required), `prior_wall_seconds`, `parent` → observer
  `-ContinueSave` and `continuation.json`; read them through `stitch_session.mjs`. Schedule key `game_args` → observer `-ExtraGameArgs`;
  `no_dlc` (run or defaults, true/false) → observer `-DisableAllDlc` (the no-DLC load test, `schedules/no_dlc_load_test.json`).
  Status: current. Traps: the archiver's `Start-Process -ArgumentList` quotes nothing (paths hand-quoted) while the harvester's
  `& powershell @args` quotes each element itself (never pre-quote). Unthreaded spec keys are dropped (L5) or throw from `defaults`
  (L16); builds are time-bounded and a failed one aborts the schedule (L21). Refs: §10.94, L19, L29.
- **`run_observer.ps1`** — the game driver `run_schedule` calls (`-Runs 1 -FlatOut`): headless `victoria3.exe -handsoff -run_until`,
  no launcher; writes `content_load.json` and restores the player's settings; mirrors the rotating logs into `logs_live/`; harvests
  `markets.tsv`, `events.tsv`, `meta.json`, `run.log`; resumes crashes through the deterministic resume feeder (`<run>\resume_set_<n>`).
  Flags include `-DumpDates`, `-ModPath`, `-Stamp`, `-AutosaveInterval`, `-ContinueSave`, `-PriorWallSeconds`, `-ExtraGameArgs`,
  `-DisableAllDlc` (every installed DLC's `pops_id` into `content_load.json`'s `disabledDLC`; meta.json records `disabled_dlc`, the
  `dlc_mounted` read off debug.log's mount lines, and `no_dlc_verified`; MODDING_NOTES has the format). Refuses a
  mod without telemetry (it has no generator). Status: current; a hand run is a diagnostic. Traps: `-script_profiling` crashes a headless
  game. Refs: MODDING_NOTES (Automated headless runs), L17, L26, L28, L32, L34.
- **`launch_detached.ps1`** — creates a process through WMI `Win32_Process.Create`, in no job object of the caller (the agent's shells
  sit in the desktop app's kill-on-close jobs), and kills it if the kernel says it is in one.
  `& 'tools\testbed\launch_detached.ps1' -File <script.ps1> -ArgumentList '<a>','<b>' [-Hidden] [-NoExit] [-WorkingDirectory] [-VerifySeconds 4]`
  (visible console by default for the scheduler keys; `-Hidden` for archiver / watchers; `-NoExit` for the scheduler). Status: current.
  Traps: call it with `&` — through `powershell -File` the argument array becomes one token, the child binds nothing and the launcher
  still reports success; a session folder must appear within a minute. A reboot still kills everything. Refs: L30.
- **`launch_interactive.ps1`** — the game windowed for a person to look at, not a measurement: backs up `content_load.json`,
  `pdx_settings.json` and every autosave slot, sets monthly autosave (first save 1836.2.1). `[-WithMod] [-Autosave monthly]`; `-Restore`
  puts it all back. Status: current.
- **`wait_for_session.ps1`** — the wake-up signal for a batch in its own window (run with `run_in_background`).
  `-Session <dir> [-MaxMinutes 30] [-PollSeconds 30] [-DeadGraceSeconds 900] [-StallMinutes 20]` → DONE · RUNNING · DEAD (exit 2) ·
  STALLED (exit 3, no write anywhere in the session tree; 0 disables). Traps: DEAD can be a long post-run harvest. Refs: L21.
- **`batch_heartbeat.sh`** — one read-only command per wake-up: each run's clock, CRASHED / resume / summary counts; for the newest run
  the mod marker, game-version mismatch, its `error.log` window by parsed time (wrap-safe), the classes left after the known vanilla
  noise classes (the list lives here), anything naming our files; `SCHEDULE DONE`. `bash tools/testbed/batch_heartbeat.sh <session-name>`.
- **`stop_watch.ps1` + `stop_watch.mjs`** — the run-level stop of a 2+1 batch: on each completed run it runs `ledger/criteria.mjs` and
  drops `STOP` when the run is broken; fallback when the register cannot be read: 1936 world GDP > `-Threshold` (1.3) × vanilla's
  median. Never mid-run; removes `STOP` after the scheduler exits.
  `launch_detached.ps1 -File 'tools\testbed\stop_watch.ps1' -ArgumentList '-Session','<session-name>','-Poll','30' -Hidden`.
  Status: current, 2+1 batches only. Traps: `-Session` is the name (a path is cut to its last segment; an unknown session exits 2); the
  proof it is armed is `sessions/<stamp>/stop_watch.log` (~90 s); a running watcher keeps the code it loaded. Refs: §10.83.
- **`NO_NEW_RUNS`, `STOP`, `no_new_runs_at.ps1`** — flag files the scheduler reads (gitignored): `NO_NEW_RUNS` = `[s]` (the running game
  finishes, nothing new starts), `STOP` = `[x]` (the running game is closed). `no_new_runs_at.ps1 -At 'yyyy-MM-dd HH:mm'` (detached,
  `-Hidden`) drops `NO_NEW_RUNS` at a local time, logging to `no_new_runs_at.log`. Traps: while `NO_NEW_RUNS` exists every schedule
  refuses to start a run.
- **`machine_monitor.ps1`** — the machine-load record of a session (started by `run_schedule`; by hand via `launch_detached` with
  `-ArgumentList '-Session','<stamp>' -Hidden`). Every 20 s a row to `<session>/machine_load.tsv`: the game's cores and cumulative CPU
  (more CPU per in-game year = more game work; more wall at flat CPU = waiting), memory, harness and other processes' cores, busy cores
  and clock % per core class (P-cores logical 0–11, E-cores 12–19 here), free memory, hard page reads, disk / GPU, commit vs limit,
  transition faults, in-game date; a compute canary every 5 min. Exits on `SCHEDULE DONE` or `-MaxHours` (96).
  `-Session <name|path> [-IntervalSeconds 20] [-CanaryMinutes 5] [-OutFile]`. Read with `ledger/machine_load.mjs`. Traps: counters come
  from WMI perf classes, never `Get-Counter` — counter paths are localised and a detached process gets the system's ru-RU UI, so English
  paths return nothing.
- **`archive_autosaves.ps1`** — copies each autosave into a keep archive before its slot is reused (run by `run_schedule`).
  `[-Dest tools\testbed\saves_debut] [-StableSeconds 4] [-MaxMinutes 300] [-IdleExitMinutes 10] [-MinFreeGB 8]`. Traps: the engine
  rotates slots by renaming (a per-name dedupe archives one save up to five times); a file is copied once size and mtime are stable, as
  `.v3.part` then renamed, so a live harvester never reads a half-copy. To capture a player's game, launch it detached with
  `-Dest tools\testbed\saves_<name>`.
- **`stitch_session.mjs`** — joins a continuation session with its parents into a new session folder (copies only, `STITCHED.md`): one
  run folder per campaign, summaries renumbered, `debug.log` joined with the continuation's token rewritten to the parent's, tables and
  `meta.json` merged, abandoned resume branches dropped, so every reader works unchanged. `<continuation session> <new name> [--partial]`
  (an absolute output path = a test outside `sessions/`).
- **`probe_resume.ps1`** — diagnostic: a `-continuelastsave -handsoff` launch as the observer's resume does, reporting LOAD FAILED ·
  FRESH 1836 · LOADED <date>. `-ModDir <dir> [-Restore <save.v3>] [-RestoreAs autosave.v3]`; needs the game idle. Status: probe-only. Refs: L32.
- **`test_log_tail.ps1`** — simulates the observer's log-mirror tail (loaded through the AST) on growth, single / double rotation,
  short-signature rotation and an empty new file. `[-Observer <path>]`. Run after any change to the tail. Refs: L28.
- **`run_timing.mjs`** — in-game years per real minute by decade from `run.log`, resumed attempts split. `<sessionDir|runDir> [...]`.
- **`queue_mix.mjs`** — construction mix per major and world, each queue separately, from v5+ summaries; WARN (exit 1) when one building
  family holds ≥ `--warn-share` of a queue with ≥ `--warn-min` items. `<runDir|summariesDir> [--tags …] [--all] [--warn-share 0.6]
  [--warn-min 3]`. Traps: a short queue is a drained backlog — read it with the construction sector and GDP. Refs: F66.
- **`analyse_errors.mjs`** — reads `error.log` mirrors by each line's own timestamp against the run's window (the log carries no token
  and the mirror holds other sessions' lines). `<sessionDir> [...] [--shapes]`.
- **`make_vanilla_stub.ps1`** — a "tiering only" config (structure kept, vanilla recipes / costs / ai_value) →
  `config/mod_config.vanilla_stub.json`, for measuring the split alone. `[-Config] [-Out] [-Game]`. Status: current, rarely used.

### Post-run: summaries, harvest, quarantine

- **`summarise.ps1`** — manual, not called by the scheduler: a session's raw logs → per run `country_state.tsv`, `buildings.tsv`,
  `pop.tsv`, `country_flags.tsv`, `treasury.tsv`, `world.tsv`, `summary.json`, reading both log copies (mirror and exit-time ring).
  `-Session <dir> [-Compress]` (gzips raws only after the summary verifies; it re-runs over `.gz`, so later fields back-fill).
- **`harvest_saves.ps1`** — melt → `save_state_summary.mjs` → verify → reap.
  `-Saves <dir> [-Out] [-Workers 4] [-Watch] [-NoReap] [-KeepLast $true] [-Provenance <json>] [-NoQuarantine]`. `-Watch` polls while the
  game runs; the final drain is idempotent. Each summary is written under a temp name, verified (gunzip, parse, version + date +
  ≥ 10 countries) and renamed before the `.v3` is deleted; a failed save keeps a `.err`; each run's newest save is kept for good. A save is
  reaped only on `slow_quarantine.mjs`'s `release` (`keep` → `<run>\quarantine_saves\`). Traps: once saves are reaped the summary is the
  record (L12 checks this post-run). A concurrent melt costs the game nothing measurable (F217 §1: 5.24 vs 5.17 in-game days per wall second
  in the mod, 5.69 vs 5.59 in vanilla). Refs: TESTBED_METRICS §7½.
- **`slow_quarantine.mjs`** — the quarantine judge `harvest_saves` calls before every reap: each yearly save `keep` (with a self-describing
  name and role) / `release` / `wait`, plus `<run>/slow_periods.json` and `quarantine_saves/MANIFEST.md`. `<runDir> [--final] [--k 3]
  [--restore 2]`; exports `yearTimes()` / `episodes()`. The episode rule: TESTBED_OPERATIONS.
- **`verify_save_alignment.mjs`** — do telemetry and saves agree on GDP, buildings and population? Never joined on display name: one pass
  joins on population + buildings and scores GDP, the other joins on population + GDP and scores buildings; disagreeing rows are
  unproven. `<session dir> [--run runNNN_setup] [--top 25]`. Run before moving a state metric off the logs. Refs: TESTBED_METRICS §7½.
- **`saves_debut/`** — 356 quarterly autosaves of one vanilla campaign, 1836.1 → 1921.1 (9.2 GB, gitignored, on the Windows machine).
  Never delete (an observation, like `sessions/`); evidence for F40, the automobile debut (first traded 1902.1.1) and F223. `_score_work/`
  beside it is disposable. **`map_saves_to_dates.mjs`** dates archived saves from the archiver's log and the observer's ticks:
  `<saves dir> <run.log> [--near 1905.1.1] [--every 4]`.

### The savegame instrument

- **`save_state_summary.mjs`** — one save → one gzipped summary JSON, the yearly per-country series of every batch.
  `<save.v3|melt.txt|-> --out summary.json [--provenance p.json] [--verify-pops]` (a `.v3` is melted in-process with `rakaly -c`, ~5 s a
  save). Generous by default, since the summary becomes the record; `NOT_CAPTURED` in the script names what is left out on purpose (the
  market order book is in no save; per-state goods flows; purchase weights; cultures; technology acquisition dates). `SAVE_SUMMARY_VERSION`
  (19) is bump-never-renumber; an absent field means zero only from the version that added it. Not the binary `save_summary.mjs`.

  | v | adds |
  |---|---|
  | ≤ 4 | provenance; per country GDP / prestige / literacy / SoL, `pop_statistics` (professions, strata), buildings by type (levels, subsidised levels, profit, cash, staffing), the budget with subsidies per building type, `last_bankruptcy_date`, technologies held, foreign-owned / owned-abroad levels (government ownership only, F178 §2), goods in/out, top 20 producers per good; pop-object counts total and non-empty |
  | 5 | construction queues: government / private `n`, `left`, `speed`, `by_type` |
  | 6 | `va_out` / `va_in` per building type at base prices |
  | 7 | `company_levels` per type, the `companies` register, `ownership_levels` by owner class |
  | 8 | `pms` (active method → levels), the `states` map (infrastructure, owner, region), `prestige_out` |
  | 9 | per type `goods_sales` / `goods_cost` (market prices), `salary_w`, taxes: wages = `goods_sales − goods_cost − profit` (F152 §9) |
  | 10 | trade capacity per state, `trade` per country and world with signed capacity per good, `world_market_price` {last, mean52} (F159 §1) |
  | 11 | `laws`, `trade_policy`, `tariffs` per good (F161 §6) |
  | 12 | one entry per country record: main `TAG`, others `TAG@<id>`; `tag`, `civil_war`, `last_civil_war_date`; world totals over every record (F186, L38) |
  | 13 | `interest_groups` {clout, ps, rad, loy} (F190) |
  | 14 | `ig_by_workplace`, `world.ig_order` (F192) |
  | 15 | per state `lab` {peas, unemp} and `res` for resource-capped types (F207); first batch `20261002_120946` |
  | 16 | `formations` per country and world, ≤ 40 worst travel paths with repair target and ships (F218 §8) |
  | 17 | dam types in `states.res`; `states.dam_q` queued dam levels by builder |
  | 18 | `innovation`, `max_innovation`, `population_incorporated` (AI snapshot), `spreading`, `progress_unheld` (§10.96) |
  | 19 | `world.war_goals`, `treaty_port_goals`, `treaty_ports` (F243) |

  Traps: from v12 a country key is opaque — definition = `c.tag ?? key.split('@')[0]`, a pool member is the plain TAG; pre-v12 summaries
  cannot be repaired (`ledger/summary_drops.mjs` sizes their drops). The world price is a 52-slot weekly ring read at `(index − 1) mod 52`;
  goods indices are positional in `00_goods.txt`. In v16 an owner's id can change (key on `owner_id` per year). Pop objects are records
  (17% of vanilla's are empty); the pop table is not scanned (`population_by_profession` is indexed alphabetically over `common/pop_types`;
  the reader throws if the count changes). A pop's `workplace` is the building's full record id. Refs: TESTBED_METRICS §7½.
- **Binary readers** (record — melting is the standing route, TESTBED_METRICS §7): **`save_extract.mjs`** `<save.v3> [--out]` → the
  `gamestate` (there is no text-save option); **`lib_savebin.mjs`**, trusted only before ~104 MB (depth drifts after the pop table);
  **`save_survey.mjs`** `<gamestate> [--limit-mb N]`; **`save_dump_records.mjs`** `<gamestate> --anchor <string> [--records 3]`;
  **`save_pops.mjs`** `<gamestate> [--tsv]` (pop + tag tables); **`save_summary.mjs`** `<pops.tsv> [--game] [--band 10-20]` (wealth,
  need budgets, wealth threshold per need; field meanings are hypotheses).
- **Melted readers** (`rakaly melt --format vic3 --unknown-key stringify`; they need no telemetry):
  **`melted_pop_need_weights.mjs`** `<melt> --tsv out [--region STATE_X] [--weights <json>]` — the game's purchase weight per (state,
  culture, need, good), ÷ base weight = the supply share used (an overlay arm needs `--weights`; F40). **`melted_building_goods.mjs`**
  `<melt> --tsv out` — per-state supply and non-pop demand from buildings, prestige share per output. **`melted_pops_by_profession.mjs`**
  `<melt> [--json] [--date]` → `config/measured_1836_professions.json` (size = workforce + dependents; unowned pops reported).
  **`melted_pop_identity.mjs`** `<melt> [--json]` → `config/measured_1836_pop_identity.json` (largest culture-religion group per country
  and profession; per state share peasants, people, infrastructure; from a vanilla 1836.2.1 save). **`melted_cultures.mjs`** `<melt>
  --tsv out` — the culture database and current obsessions (runtime state; never read them from `common/cultures`).
  **`melted_company_ownership.mjs`** `<save.v3> [--label] [--json]` or `<melt> --melted` — company-held levels and output per type and
  country (F77; summary v7 has the headline numbers).

### Pop-demand calibration readers

The shipped rule is `needSplit()` in `ui/econ.js`; these measured it (F24–F44, F61).
- **`lib_breakdown.mjs`** — the one parser for `GetMarketBuyOrdersBreakdown` blocks: own-token filter, each block verified against the
  run's `G|`/`GW|` buy orders (else discarded), K/M/B suffixes, tail-only matching, a verified block with no pop entry = zero, every dump
  truncated (union across dumps). Streamed.
- **`analyse_wages.sh`** `<session> [--csv <dir>]` — the `wages` metric; own-token filter; per-pop lines checked against `WC` counts.
- **`analyse_slave_basket.ps1`** `-Session <dir> [-Tsv]` — the "purchased for slaves" line, blocks verified against `G|` (F27, F61).
- **`score_pop_split.mjs`** `--session <dir> [--tsv] [--modes raw,final] [--per-good]` — the pop model against measured consumption
  under each `S.SPLIT_MODE` (F24 basis; F31). Traps: `--need` / cap views need every good of a need.
- **`analyse_debut_goods.mjs`** `--session <dir>` — a good's order book after it first appears (`schedules/debut_good_demand.json`),
  keyed on the first month a market buys it.
- **`predict_pop_split.mjs`** `<needs.tsv> <bgoods.tsv> <markets_all.tsv> [--date] [--run] [--market] [--probe] [--no-culture]
  [--local off|scaled:<f>|fixed:<f>|state|gdp] [--shares]` — every stored purchase weight predicted from the market's supply, non-pop
  demand and prestige supply (F40, F43). Traps: `fixed:<f>` below ~0.3 zeroes electricity and drops entries; join two `--shares` outputs
  on the observed column. Support tools (record): `within_need_test`, `fit_substitution_rule --sweep`, `validate_split_rule`,
  `solve_need_availability`, `fit_availability`, `identify_availability`, `invert_deduction`.
- **`score_save.ps1`** `-Save <v3> -Session <dir> [-Market] [-Probe] [-Run] [-Weights] [-Keep]` — melts one autosave and scores the
  substitution rule (weights, building goods, obsessions from that save). Traps: the date is read anchored at column 0.
- **`predict_good_demand.mjs`** `<melt> <weights.tsv> <bgoods.tsv> <markets_all.tsv> [--explain] [--peasant-mult]` — predicted vs
  measured pop demand for one good in units. Traps: measured pop demand = buy − building input − exports (F42).
- **`debut_series.mjs`** `<session> <need> <good> <rival> [--market] [--probe] [--work tools/testbed/_score_work]` — a debut good and
  its need-mate across saves in raw units, the share rebuilt term by term.

### The ledger (the standard batch report)

- **`ledger/`** — the reusable report: `ledger_template.html` + data scripts (`report_data.mjs`, `report_data2.mjs`, `analyse_gdp_gap.mjs`,
  `fill_*.mjs`, the gate `fill_manifest.json` + `fill_verify.mjs`, `fill_assemble.mjs`), published as an Artifact per batch and copied into
  the session as `REPORT.html`. **`ledger/README.md` holds the fill procedure, the gate, the token rules and every `fill_*` script.**
- **`ledger/fill_ledger.sh`** — `bash tools/testbed/ledger/fill_ledger.sh <group> <setup> <book> <outName>`: every data script on the
  group's usable runs against `lib_runs.VANILLA_REF` (wall clock against `VANILLA_WALL_REF`), output in `ledger/<outName>`; stops on more
  than one config family (`ALLOW_MIXED=1`). Then the prose by hand, `fill_assemble.mjs`, `fill_verify.mjs <outDir>` (exit 0 = publishable).
  Traps: one `<book>` serves costs, tiers and labels (pass the one most runs used); `input_price_flags` reads whole sessions only; never
  edit the script while it runs.
- **`ledger/report_perf.mjs`** `<sessionDir|runDir> [...] [--json] [--bins N] [--wall play|meta]` — wall clock against vanilla: the total
  play time (the grade) and pop-matched s per in-game year (the diagnostic); play time from `lib_wall` by default. `fill_build_perf.mjs`
  turns it plus `wall_clusters.json` into row P.
- **`ledger/input_price_flags.mjs`** — the standing input-price red-flag check: HIGH = ≥ 1.70 × base through a ≥ 2-year stretch; SWING =
  a ≥ 0.5 × base range within 3 years on < 10 units/week of supply; every good a production method consumes, local goods excluded, the
  eleven tags' markets. Sources: order books (`G` + yearly `GW` lines) or save summaries (supply = production + v10 imports, a lower bound;
  price = `goods_sales ÷ va_out`; blind where a market makes none); each flag lists producers and the buyers present.
  `<label>=<group> [...] [--ref <label>=<group>] [--source auto|market|summary|both] [--yearly] [--from] [--until] [--list 40] [--html]
  [--md] [--json]` (thresholds `--high --years --gap --swing --window --supply`); `--html` writes the listing `redflags_full.html`
  (beside the report, not on it), `--json` keeps `prodFlags`. Traps: it throws if the coal / iron / lead / sulfur / steel / explosives /
  tools producers move (ON_GAME_UPDATE); read SWING against `--ref`; the pinned vanilla n=16 has no `goods_sales`, so the yearly vanilla
  reference is the eleven-tag n=4 (`20260920_225047` + `20260920_192007` run 1) and must be named. Refs: §10.94, F212, F215.
- **`ledger/lib_redflag_metrics.mjs` + `redflag_metrics.mjs`** `<outDir> [--json redflags.json] [--span 1836-1935]` → `redflags_metrics.json`,
  `redflags_digest.md`, `redflags_card.html` (`__REDFLAGS__`): problem market-years (Σ over eight majors of years under a HIGH flag on
  ≥ 10 units/week of building demand) and chronic markets (≥ 20 such years). The summary is written with the `redflag-summary` skill into
  `redflags_summary.html`; `fill_verify` refuses a report without it. Traps: the vanilla column uses `prodFlags`, never order books.
- **`ledger/fill_obsolescence.mjs`** `<outDir> --session --setup --config [--pool 1920,1930,1935] [--override-dir]` → `obsolescence.json`
  (the `OBS` card), before `fill_assemble`; exits 1 if no industry has an old rung.

### Register, run selection and market definitions

- **`ledger/criteria.mjs`** — the criteria register (§10.83): aim / soft / hard per scope (pool, world), end state 1932–1936, hard lines
  per run (broken by stall / runoff), the consensus of intact runs, the metrics of GLOSSARY §1 (T0–T3 by each rung's tier from the run's
  own config; merge hosts split by method), the loss, the ranking across `--arm`s, and GDP at base prices as a secondary reading (§10.90).
  `--arm <group> [--arm …] [--config <book>] [--van <sessions>] [--end 1932-1936] [--weights k=v,…] [--soft-pen 0] [--soft-slope 2]
  [--sigma fixed|vanilla|runs] [--gdp-aim 0.90,1.00] [--gdp-hard ci|legacy] [--json] [--quiet]`. Read by the report, the iterator and
  `stop_watch`. Lists from `lib_markets`; PI / PP on the arm's markets ∩ vanilla's by series, basis printed. Refs: §10.83–§10.86, §10.100.
- **`ledger/alignment_check.mjs`** `--arm <group> [--van] [--year 1935] [--stop-above 1.3]` — the 2+1 divergence test: world GDP and
  productive workers per capita at 1935 ÷ vanilla's per-run median, five bands each; a pair fails an axis only in different bands and
  ≥ 0.15 / ≥ 0.10 apart; also the run-level stop verdict (`--stop-above 0` = full runs). Exit 0 aligned · 2 run a third · 3 stop · 1
  unreadable. Status: the divergence test only (the register judges the config). Refs: F114.
- **`ledger/lib_runs.mjs`** — which runs count: `usableRuns(root, group, setup)` keeps runs that reached their own `until` with no
  `abandoned_reason` (L17; `session.json`'s `ok` is not evidence) and drops L34's minutes-long "complete" runs; `reportDropped()` prints
  exclusions; a group is a comma list of sessions and/or `<session>/runNNN_<setup>` folders. `configFamilies()` says whether a group may
  pool (same tier/building structure from each run's own config; coefficients and minor-fix builds may differ and are printed).
  `VANILLA_REF` = the summer n=18 (`20260821_131149` + `20260823_113218`) + the October n=6 (`20261020_121619` + `20261020_222433`) + the
  alternating batch's n=16 (`20261021_224949` + `20261023_161802`, setup `vanilla`) = n=40 since 2026-10-26, the default for every reading but
  the wall clock; `VANILLA_WALL_REF` = the alternating batch's vanilla (play time is not comparable across months, F248, nor fully across sessions,
  F249). Still on the summer n=16 on purpose: `measure_wage_share`, `era0_solvency`, `stop_watch`'s
  fallback, `ladder_headlines`, `trade_vs_gdp`, `va_composition`, the corpus tools.
- **`ledger/lib_markets.mjs`** — the shortlist, the majors and the price-tracked markets: `POOL` (GBR USA FRA NET BEL UNL PRU NGF GER),
  `MEMBER_FAMILY` / `resolveMembers()` (one row per state; the German one PRU → NGF → GER, UNL its own row), `MARKET_NAMES`,
  `MARKET_FAMILY` / `seriesOf()` / `groupBySeries()` (a state's market is one series across tag changes, the Commune included),
  `PRICE_TAGS`, `TELEMETRY_TAGS`. Traps: UNL replaces NET and BEL where it forms; a market name does not identify its leader. Refs: F152 §7, F153.
- **`ledger/lib_goods.mjs`** — the goods table from `common/goods` (base price, traded quantity, local / tradeable, a save's positional
  index); `tradedQuantity(cfg)`, `tradeClasses(cfg)` (from the book's `_trade.classes`). Refs: F159.
- **`ledger/lib_era_cols.mjs`** — the ledger's employment-by-tier columns: on a craft book t0 splits into artisans / other; a merge host is
  shared over its methods at each method's tier. `eraCols(cfg)`, `parts(key, building)` (readers key on labels, never indices);
  `countrySplit(buildings)` = workers on a rung ≥ 2 tiers behind the best rung their own country staffs in that industry.
- **`ledger/lib_sumidx.mjs`** — a run's yearly summary index (first summary of each year), shared by small readers.
- **`ledger/summary_drops.mjs`** — which pre-v12 summaries lost a country record and how much (Σ countries vs the complete
  `world.buildings`; dropped levels, value added, an estimated dropped GDP good for materiality only; shortlist members not on their main
  record). `--session <group> [--years 1932-1936] [--all] [--detail]`; `--check <session>` / `--selftest` are L38's halves. Refs: F186.
- **`ledger/first_run_decomp.mjs`** `--arm <s>[:<setup>] [--arm …] --van <s> [--years …]` — GDP = population × productive workers per
  capita × GDP per productive worker, world and pool, every ratio with both terms; reported after each arm's first run.
- **`ledger/advanced_panel.mjs`** / **`tiered_panel.mjs`** `--arm <s>:<label> [--arm …] --van <s>:<label> [--year 1935] [--group …]`
  (`tiered_panel` + `--config-<n>` per arm) — productive share of the workforce and GDP per productive worker ÷ vanilla, whole economy /
  tiered industries (tiered workers modelled from staffed levels). Definitions: `ledger/README.md` §8.3; readings: F76, F78. Traps: the default
  `--group` is GBR,USA,FRA,NET,BEL,PRU,GER (no NGF or UNL, unlike `POOL`); one `--config-<n>` per arm, never one shared `--config`;
  `population_subsisting_workforce` is peasants ÷ 100,000.
- **`ledger/batch_tables.mjs`** `--arm <sess[,sess]>:<setup> [--nb] [--van] [--config] [--year 1935] [--exclude <sess/run,…>]` — pools ÷ GDP,
  tiered goods' prices, wage units, British production and GDP ÷ vanilla for an arm across several sessions.
- **`ledger/capital_flags.mjs`** `--arm <group> [--van] [--year 1935] [--shortlist GBR,USA,FRA,GER] [--persist-from 1931] [--persist-years 5]`
  — hoard ÷ GDP and U* per world / shortlist / member; member flag at U* < 3% with hoard > 2, pooled VOID exit 4. Status: superseded as a
  criterion by §10.83; diagnostic.
- **`ledger/majors_workers.mjs`** `--arm <group> [--arm …] [--van] [--years 1935] [--fail 1.0] [--aim 0.8] [--no-members]` — the pool's W per
  run with each member beneath. Status: its line is the register's pool-W soft boundary; kept as the composition printer.
- **`ledger/major_series.mjs`** `<years> <runDir>…` — per major strict unemployment, peasant share, salaried workforce. Status: its plateau
  test is superseded by §10.83; the columns stay useful.
- **`ledger/assess_gdp_gate.mjs`** `--session <group> [--setup] [--threshold 0.95] [--min-runs 30] [--year 1935]` — mean world GDP ÷
  vanilla → PROCEED / SWITCH. Status: record (§10.76's 60-run plan).

### Economy readers

- **`ledger/misplaced_capital.mjs`** — misplaced capital: each year's new capital's expected payback against the country's best sector
  (fine ≤ 1.5× · a bit ≤ 3× · gross > 3× or loss-making) on ALL / OPEN / VALID benchmarks (VALID needs v15); infrastructure, shipyards,
  trade centres, government buildings and gold exempt, military measured. `--batch label:session[:setup]`, `--snap <dir of v15
  re-summarised saves> --arm label:session`, `--series <dir>`, `--why`. A reading, not a register term. Refs: §10.92, F206, F207.
- **`ledger/return_per_point.mjs`** `[--year 1935] [--scope pool|world] [--filter <regex>] <label>=<group> [...]` — profit per staffed level
  ÷ construction points beside ai_value, per type (no validity rule). Refs: F211 §4.
- **`ledger/lib_obsolescence.mjs` + `trade_obsolescence.mjs`** — in-market vs trade obsolescence: a rung is in-market when its market's
  supply frontier (highest tier with ≥ 10% of output, by `va_out`) is two tiers above, trade-only when only the world's is; per regime loss
  share, true margin, staffing, price ÷ break-even, importer premium; trade-only split by position, tariff, trade policy.
  `--arm <s>:<setup>:<book> [--arm …] [--years] [--pool] [--override-dir] [--industries] [--json]`. Traps: staffing alone is not death;
  the premium is a producer price; a merge host is counted by building type, not split by main method. Refs: F161 §4/§6.
- **`ledger/old_rungs_by_industry.mjs`** `<year> <label>=<group> [...]` — `countrySplit`'s old-rung share per industry, pool and world, each
  run on its own book. Traps: different ladders compare what each calls two tiers behind.
- **`ledger/laggard_pressure.mjs`** `<book> <label>=<group> [...] [--stuck y|y10|none] [--gap 15] [--minpop 1e6] [--tags POR,…]` — competitive
  pressure on backward industry where vanilla CANNOT switch (FINDINGS F249 §4a): A. stuck laggards (a country's industry whose best rung is ≥ 2 tiers
  under its own market's frontier and that lacks the next rung's technology at the start of the decade — `--stuck y`, the default), in-market and
  trade-only, by chain and by whether the technology arrived within the decade; ten-year retention of the INDUSTRY's workers on every rung (a switch
  or a build-up counts as surviving) and profit per 1,000 workers, against stuck industries not behind; B. backward members of shortlist-led markets
  (the leader = the member with the most technologies) against their leader, all markets and the British one; C. named countries; D. every backward
  country (≥ GAP technologies under the world's most advanced) split by whether its market holds a frontier country (leader within 5 technologies),
  with the difference of differences between the two per arm (GDP per head, tiered workers per head, industries, SoL) and who they are (subject
  shares). Section A also splits each class by whether the country already HOLDS the next technology at y (read with `--stuck none`). A vanilla arm
  (setup name contains "vanilla") maps each method to the canon rung built from it; the book gives the tiers and each rung's technology. Traps:
  `--stuck y10` (still lacking the technology ten years later) keeps only industries whose research entry never filled — a size filter, kept for
  the record; `--stuck none` mixes in the cost of modernising (vanilla upgrades a country holding the technology for free); the canon has fewer
  stuck cases (~10 a run); the follower sets differ by seed.
- **`ledger/frontier_supply.mjs`** `<book> <label>=<group>:<setup> [--scope pool|world] [--industries food,textile,…]` — the supply side of the
  price path (FINDINGS F249 §4d): per decade, points built by sector (positive Δlevels × construction cost), the capital-weighted return of new
  profit-seeking capital (£ a year per point of a staffed level) and the top types built; per industry, the output and input price indices and, per
  building type, points built, return, margin, its own output / input index and staffed levels at the decade's ends. A vanilla arm (setup name contains
  "vanilla") keeps the rung-0 key at vanilla's cost, labelled `tv`. Traps: returns are pooled over the scope's countries at the step's start; the
  index of a type covers its whole output mix (secondaries included) — `price_mix.mjs` splits it.
- **`ledger/price_mix.mjs`** `<book> <group>:<setup> [--years 1910,1930] [--industries textile,furniture,glass] [--mod mod]` — why a rung's realised
  output price differs from its frontier's (F249 §4d): each staffed building's output rebuilt from its active methods and valued at its country's own
  market's 1 January price (markets.tsv); realised against predicted index, the main good's and the side goods' indices, the side goods' share, the
  gap to the next rung split into MIX and LOCATION; and per rung, records bucketed by the share of levels on a side-good secondary (margin, profit per
  staffed level). Lists the side lines it found. Traps: `--mod` must be a build of the book the runs played (default `mod/`, the canon); countries
  inside another's market are skipped and counted; one price date stands for the year.
- **`ledger/error_classes.mjs`** `<label>=<run>/logs_live/error.log [...] [--mod mod]` — several runs' error logs side by side (FINDINGS F250):
  per run, non-empty lines and classes (a line with its numbers, strings and handles reduced to tokens); the classes no other listed run has;
  and every line naming a file the mod emits or one of the vanilla-path files it replaces (any file under `--mod` that also exists in the game
  folder, matched by relative path). Traps: read each run's own mirror, never the shared ring; it needs the game folder (`VIC3_GAME`) for the
  replaced-file list, and throws without it.
- **`ledger/laggard_census.mjs`** `<book> <label>=<group> [...]` — the raw old-rung census (in-market and trade-only laggard shares of tiered
  workers, ten-year survival, by industry and tier pair). ⚠ Its vanilla column is confounded by vanilla's free method switch: read it for the canon
  alone, and `laggard_pressure.mjs` for the comparison (F249 §4).
- **`ledger/rung0_path.mjs`, `rung0_who.mjs`, `queue_rungs.mjs`** — rung 0's buildings vs levels, staffing and queue shares (`<run> <config>
  <years…>`); who added rung-0 levels (`<run> <config>`); a queue split by rung (`<run> <year> <config>`). Read staffed and building counts,
  not levels alone. Refs: F122.
- **`ledger/sector_split.mjs`, `rung0_split.mjs`, `rung_econ.mjs`** — value added and staffing by sector (`<config> <year> <runDir>…`); rung 0
  pool vs rest (`<config> <year> mod|vanilla <runDir>…`); per-industry per-tier rung economics (`<runDir> <config> <year>`). Traps: a craft
  level is 500 heads; read vanilla runs with a non-craft book. Refs: F127–F129.
- **`ledger/queue_series.mjs`** `<run> <years> <TAGS>` — backlog years, private share, pool ÷ GDP, construction-sector levels. Refs: F121.
- **`ledger/queue_speed.mjs`** `<save.v3> <config.json> [TAG,TAG]` — per-element construction speed against the per-project cap
  (`country_max_weekly_construction_progress_add` technologies, 10 + 10/5/5/5/5) and each rung's cost ÷ cap in weeks.
- **`ledger/construction_spend.mjs`** `--arm <s>[:<setup>] --mod <emitted mod> [--arm … --mod …] [--until 1866.1.1] [--stock] [--e0-of …]` —
  construction in points and £ (flow, levels added per class, and with `--stock` built / expanded levels and their staffing). Traps: up to
  10 points/week per country come from a static modifier and buy no goods, so £ understates poor countries. Refs: F187.
- **`ledger/good_market.mjs`** `--good engines --arm <s>:<setup> [--arm …] [--dates a,b,c]` — one good's buy, sell, production and the
  producing industry's size across arms. Traps: buy orders include unmet demand; at the band edge only quantities inform. Refs: F147 §1a.
- **`ledger/early_probe.mjs`** `--session <stamp> [--also <sessions>] [--control vanilla] [--years 1836,1837] [--goods …]` — the 1836→1838
  reader: world product ÷ control, margins by tier, negative-margin types, the survival table, British prices. Traps: the control borrows a
  mod arm's key map (output column suppressed). Refs: F142–F145, §10.86.5.
- **`ledger/health_vs_ref.mjs`** `--arm <s> --ref <s> [--date 1846.1.1] [--dead 0.10] [--token 0.20]` — dead industries and token markets
  against a reference.
- **`ledger/merge_methods.mjs`** `--session <stamp> [--setup] [--tags] [--every N]` — a merge host's levels per main method and per
  secondary copy (`!!` = gating broken). Refs: §10.91.2.
- **`ledger/mandate_switch.mjs`** `--session <stamp> [--setup] [--detail] [--every N]` — mandated main methods against their gated
  automation copies. Refs: §10.93.
- **`ledger/country_composition.mjs`** `[--tag USA] [--years] [--runs] <label>=<group> [...]` — one country's value added by sector at base
  prices (`van` label = denominator).
- **`ledger/us_history.mjs`** `<label>=<group> [...]` — the USA's century per run (Texas, Mexico, secessions, California, CSA, bankruptcies)
  and GDP ÷ vanilla split into population and GDP per head. Refs: F210, F211.
- **`ledger/textile_luxury.mjs`** `[--year 1935] [--scope pool|world] [--runs] <label>=<group> [...]` — textile rungs by method and their
  luxury lines.
- **`ledger/country_ustar_hoard.mjs`** `--arm <s>:<setup>[:<label>] [--tag GBR]` — a country's U* and hoard at 1926 / 1931 / 1936 vs vanilla.
- **`ledger/ladder_headlines.mjs`** `--arm <s>:<setup> [--arm …] --prev <s>:<setup> --canon <s>:<setup> --ccache <dir> --vcache <dir>` —
  first-run headlines incl. trade by class against vanilla seeds at similar GDP (caches = 1936 saves re-summarised to v10+, named
  `<session>__<run>.json.gz`). Refs: F163.
- **`ledger/analyse_ai_tier_choice.mjs`** / **`analyse_ai_tier_profit.mjs`** `--session <stamp> --config <path>` — share of built levels
  below the best tier held, and the indefensible cases. Refs: F75, ledger README.
- **`ledger/analyse_build_allocation.mjs`** `--a <baseline> --b <arm>` or `--session` — where construction went by sector / industry /
  tier, absolute beside normalised. Traps: removed levels are ignored; strips the UTF-8 BOM. Refs: ledger README.
- **`ledger/company_check.mjs`** `--arm <s> --ref <s> [--years 1860,1900,1935]` — companies, prosperity, charters, regional HQs, missing types.
- **`ledger/va_composition.mjs`** `[--session <stamp> …] [--years …]` — value-added composition by sector (default: the summer vanilla n=18). Refs: F80.
- **User-asked readers of 2026-09-20**, each `--session <s>[:<setup>] --config <book>` unless noted: **`slid_vs_unslid.mjs`** (`--arm`;
  anchor-slid vs unslid frontier profit and cost), **`e0_survivors.mjs`** (t0 rungs staffed ≥ half a level and ≥ 10% profitable, per
  market), **`era_employment_share.mjs`** (T0…T3 shares by decade), **`payback_by_decade.mjs`** (payback at recorded prices under a cost
  book; an upper bound), **`region_gdp.mjs`** (`[--seed CHI] [--anchor 1836]`; a region = the states a tag held at the anchor),
  **`electrification_shock.mjs`** (`[--tech electrical_generation]`; wars and annexations dominate raw windows).
- **Small per-batch readers** (F209): **`ustar_path.mjs`** / **`craft_path.mjs`** `<s>[:<setup>] [years]`; **`us_construction_windows.mjs`**
  `--arm label:session[:setup] [--country USA] [--windows …]`; **`pp_goods.mjs`** `--arm … [--markets …]`; **`rung_fate.mjs`**
  `--arm … [--scope pool|world] [--years] [--ind]` (workers, prices, true margin, wage ÷ normal).

### Wall clock and tick-cost readers

- **`ledger/lib_wall.mjs` + `wall_from_ticks.mjs`** `<sessionDir|runDir> [...] [--detail]` — a run's play time from the observer's tick lines
  (each crash-resume's reload and replay subtracted). Traps: `meta.json`'s `wall_seconds` over-counts crash-prone runs and a continued run
  carries only its last launch.
- **`ledger/wall_clusters.mjs`** `<label>=<group> [...] [--runs] [--json <file>]` — the wall clock in the three ruled clusters (normal ·
  slowed, no listed bug observed · a directly observed fleet loop: a recalled fleet ≥ 200 path moves and ≥ 125k distance in the v16 worst
  paths, gone after the episode); cluster-1 / -2 medians, the main median over 1 + 2, the cluster-3 count. Episodes without v16 summaries
  stay in cluster 2. `fill_ledger.sh` writes `wall_clusters.json` for row P. Refs: F218, TESTBED_OPERATIONS.
- **`ledger/slow_episodes.mjs`** `<label>=<group> [...] [--years 5] [--ratio 1.4] [--min 2] [--ref <label>]` — episodes from tick lines
  only (any session): ≥ 1.4× the arm's median for ≥ 2 five-year periods; the normal branch, the share of runs with one, an episode's cost.
- **`ledger/tick_profile.mjs`** `<session>/<run> [--from] [--to] [--long S] [--days a,b --slots 6,12,18 --bin 5]` — wall clock tick by tick
  from `Processing Tick` lines (sub-ticks 0/6/12/18); exports `parseTicks`. Signatures are investigation aids, never criteria. Refs: F218.
- **`ledger/fleet_loops.mjs`** `<save.v3> [...] [--min 200] [--json]` — formations with ≥ 200 path moves in a save: owner, id mod 4 and
  its sub-tick (≡ 1 → 6, ≡ 0 → 12, ≡ 2 → 0, ≡ 3 → 18 presumed), recall flag, ships, distance sailed, repair target. Traps: a kept save is
  the newest — copy one into `diag_saves/` while an episode is live. Refs: F218 §8.
- **`ledger/fleet_loop_runs.mjs`** `<label>=<group> [...] [--threshold 25] [--years 3] [--dirs]` — the one-sub-tick episode detector.
  Status: investigation aid only.
- **`ledger/fleet_excess.mjs`** `--arm <group> [--ref <group>] [--min 15] [--list] [--partial]` — per year and sub-tick excess beside that
  year's v16 fleet readings. Refs: F219.
- **`ledger/war_tax.mjs`** `[--runs <group>[,…]] [--detail] [--wars] [--json]` — tick time against run effects, size and concurrent major
  wars (from `events.tsv`). Status: explanatory only, never deducted from a wall-clock reading. Refs: F230.
- **`ledger/tick_overhead.mjs`** `--van label=<s>:<setup> [--van …] --arm label=<s>:<setup> [--arm …] [--json]` — the overhead a book adds
  per period, save ticks removed, vanilla scaled to the run's world size. Traps: compare like save cadence. Refs: F217.
- **`ledger/arm_tick_cost.mjs`** `<session>[,…] [--ref vanilla] [--from 1836] [--to 1841] [--runs] [--exclude <session>/<run>[,…]]` — a
  feature's tick cost arm against arm (1-s tick stamps; game-logic time from `logs/custom_automated_stats.log`), for the `perf_*_5y.json`
  schedules and their probe-only keys. Traps: runs pool by setup name across sessions — exclude a void run by name. Refs: F220, MODDING_NOTES.
- **`ledger/vector_effects.mjs`** `<session> [--from] [--to] [--interactions 12,24]` — OLS on vectors coded `v<digits>` in setup names. Refs: F221.
- **`ledger/run_sanity.mjs`** `<session dir>` — per run of a short timing batch: reached date, GDP ÷ vanilla, in-window errors.
- **`ledger/machine_load.mjs`** `<session> [--years 5] [--run runNNN_setup]` — why a run was slow, from `machine_load.tsv`, against the
  other runs at the same dates, with a heuristic driver (machine · load · memory · game work · waiting).
- **`ledger/fit_cost_drivers.mjs`** `[--refresh]` — races pop objects, levels, building objects, GDP and population as tick-cost drivers
  (cache `cost_drivers_pool.json`, gitignored). Refs: F120. `fit_cost_model.mjs` is dead (record of F72).

### Research, dams, interest groups, crafts and trade readers

- **`ledger/tech_timing.mjs`** `<label>=<group> ... [--control <label>] [--cat production|military|society|all] [--book]` — half-majors
  year per technology against the tree's onset. Refs: §10.95, F219.
- **`ledger/tech_census.mjs`** `<label>=<group> ... [--top-era 5]` — technologies at the end: top-era holders, the tech majors, other
  independents, the anchor-principle share (leader's share of game eras 3 / 4 / 5 at 1875 / 1905 / end), reliance on research entries.
- **`ledger/tech_gain_check.mjs`** `<label>=<group> [...] [--van] [--year 1885] [--gdp-year 1845] [--years] [--runs]` — majors' technology
  gain (line 0.70) and early world GDP (line 0.80) ÷ vanilla. Refs: §10.97.
- **`ledger/je_tally.mjs`** `--session <stamp>[:<setup>] [--config]` — unique research-entry completions per run, token-windowed and
  de-duplicated (L28).
- **`ledger/finish_force.mjs`** `--session <stamp>` — the finish boost's force test (counts only choices while the tech is unacquired;
  F160 §6). `finish_probe.mjs` (record) reads the retired first form (`20260923_203339` only).
- **`ledger/tech_finish_gap.mjs`** `--arm <s>:<setup>[:<label>] [--list]` — acquisition at the second stage once the penalty is zero. Refs: F162.
- **`ledger/dam_slots.mjs`** `<session>[:<setup>] [--every N] [--list 30]` — the canon's resource-slot dams (`dams.layout = resource4`):
  standing + queued levels against each region's slots per year (exit 1 on a breach), builder relations; v17 summaries. Traps: a level
  queued and finished between samples is never seen queued.
- **Per-project dam readers** (record — the pre-resource4 per-project layout, not the canon's four types): **`dam_yearly.mjs`**
  `<label>=<group>` (yearly saves; first read, recorded only here: the artmerge books 22–35 levels a run of 312, jex run 1 104),
  **`dam_situation.mjs`** `<runDir> <modDir>`, **`dam_outcomes.mjs`** `<modDir> <runDir>…` (quarterly summaries; `DUMP=<file>` feeds
  **`dam_survey_use.mjs`** `<dump.json>`; F177), **`dam_report.mjs`** `<runDir> [--years] [--surveys] [--bur <name>]` (F168).
- **`ledger/ig_clout.mjs`** `<save.v3|melt> [--tags …|all] [--ig …|all] [--every N] [--json]` — IG clout with ten years of history from
  the 521-week ring. Traps: read means / medians, never one country. Refs: F190.
- **`ledger/ig_pop_contrib.mjs`** `<save.v3|melt> [--keys] [--ig] [--minwf 1000000] [--json]` — an IG's members and attributed clout by
  workplace (F192); **`ig_workplace_series.mjs`** `--arm <s> [--ig] [--every 5]` the same yearly from v14 summaries.
- **`ledger/pop_literacy.mjs`** `<save.v3> [--json] [--top N]` — lower-class literacy, qualified machinists, the six light t0 levels.
  Traps: pop literacy is literate ÷ workforce. Refs: F183.
- **`ledger/craft_fill.mjs`** `<save.v3> <book.json> --mod <emitted mod> [--max-occ 0.8] [--min-missing 2] [--top 40] [--built] [--states]`
  — why a craft is understaffed: slots and workers per profession, the binding one, hiring state, blame split. Refs: F185.
- **`ledger/hiring_census.mjs`** `<save.v3> --mod <emitted mod> [--book] [--json]`; `--diff A.json B.json` — every building's workers,
  slots, value added, hiring class by sector, and the £3 earnings-floor test. Refs: F188.
- **`ledger/labour_flows.mjs`** `<save.v3> --mod <emitted mod> [--book]` — where each sector's hires came from (transfer logs; recent
  moves only, read shares). Refs: F188.
- **`ledger/trade_vs_gdp.mjs`** `--arm <s>:<setup> [--arm …] --cache <dir> [--build-cache] [--since 20260905] [--match 0.08]` — trade ÷
  world GDP against runs at similar GDP. Traps: each run uses its own book's traded quantities. Refs: F161 §1.
- **`ledger/market_line_check.mjs`** `<runDir> <date> [--config] [--show N]` — the market line's import/export against v10 trade capacity.
  Refs: TESTBED_METRICS §2.5.
- **`ledger/world_price_rings.mjs`** `<save.v3> <out.json>` + **`market_good_snapshots.mjs`** `<summaryDir> --tag CHI --good rubber
  --units-per-cap 48` — one good's trade from a player's yearly autosaves (52 weekly world prices per save). Refs: F242.
- **`ledger/war_goal_mix.mjs`** `--label <name> <save.v3> [...] [--jobs 4] [--json]` — war goals of active plays (pool many saves). Refs: F243.
- **`ledger/treaty_port_trade.mjs`** `<save.v3> <summary.json.gz> <book.json> [--need TAG [--share 0.4]]` — a treaty port's trade
  against its host market. Traps: `treaty_ports[].state` is the host's part of the region. Refs: F245.
- **`ledger/ai_country_goals.mjs`** `<save.v3> <summary.json.gz> [--reason …] [--json]` — the AI's `country_goal` stances. Refs: F244 §10.

### Corpus tools

- **`ledger/corpus_extract.mjs`** (+ `corpus_levers.mjs`, `corpus_early.mjs`, `corpus_depeasant.mjs`, `corpus_depeasant_extrap.mjs`,
  `lib_corpus_stats.mjs`, `lib_depeasant.mjs`) — one line per usable century run of every four-rung A/B book and the vanilla controls
  (levers from `_ab`, yearly GDP / W / U* / H, pool workers by tier) → `corpus_runs.jsonl` (gitignored; split sessions over parallel
  processes); fits of end-state lines on the levers, early predictiveness, and the year Britain's U* crosses 30/20/10/5% (censored
  Tobit; `NO_STUCK=1`). Traps: runs of one config share a lever vector, so standard errors are optimistic. Refs: F165.
- **`ledger/corpus_gbr_extract.mjs`, `stuck_britain.mjs`, `stuck_britain_subjects.mjs`** — Britain's record per run (`corpus_gbr.jsonl`)
  and the stuck-Britain mode. Refs: F166.
- **`ledger/corpus_country_extract.mjs`** `<out.jsonl> <session/run> [...]` → `corpus_countries.jsonl`; **`closed_major_abundance.mjs`**
  `[--runs] [--countries]` reads it for capital abundance in the closed majors. Refs: F231.
- **`ledger/gdp_clusters.mjs`** `<corpus.jsonl> [...]` — is the world-GDP outcome distribution multimodal. Refs: F229.

### Investigation scripts (one-off)

Kept as the record of how a finding was reached; most hardcode a session, market or Windows path and are not maintained.
- `analyse_debut_mechanism.mjs` — four signals of one campaign: where a debut good's demand comes from (§10.29/§10.35).
- `analyse_free_movement_cap.mjs`, `exact_25pct_line.mjs`, `floor_or_formula.mjs`, `share_trajectory.mjs`, `split_auto_between_needs.mjs`,
  `test_cap_binding_prediction.mjs`, `check_reading_a.mjs`, `check_midlands_split.mjs` — the automobile / free-movement share questions (F31–F39).
- `analyse_weight_lever.mjs` — did ×10 on a pop-need `weight` move its within-need share (overlay arm).
- `consumption_calib.mjs`, `slave_channel_ab.mjs` (F61), `state_good_units.mjs`, `wage_calib.mjs` — save-side consumption, slave channel,
  per-state units, save `base_wage` vs telemetry.
- `melted_pop_needs.mjs`, `melted_state_needs.mjs` (superseded by `melted_pop_need_weights.mjs`), `melted_good_consumers.mjs` (who consumes
  a good), `save_market_goods.mjs` (misnamed: its records are not market orders).
- `score_vanilla_window.sh` — scores the vanilla campaign's saves around a debut.
- `analyse_tech_picture.mjs`, `analyse_techtree_run.mjs`, `analyse_three_arm.mjs` — readers of the 2026-08 tech-tree and three-arm batches.
- `market_lifespans.mjs` — how long each tracked market lasted (an annexed market silently stops producing rows).
- `port_ramp_table.mjs`, `watch_mm_chain.mjs` — the six-rung graded-port ramp and merchant-marine chain probes.
- `rescue_ring.ps1` — ring snapshotter for the 2026-07-31 mirror bug (superseded by the tail fix and `summarise.ps1`'s two-copy read).
- `dumpstack.mjs`, `exestrings.mjs`, `ctd_probe/` (`probe_ctd_repro.ps1` + `nosway_mod`) — the 1.13.10 stack-overflow CTD (F56).
- `ledger/je_distribution.mjs` (entry timing in canon-n2), `ledger/peek_run.mjs` (mid-batch headline, `--session [--vs] [--van]`).

---

## 5. The balance editor (`ui/`, `ui2/`)

A browser editor and scenario model over one book. How to launch and use it as a player or modder is in `README.md`;
this section is for an agent reading, changing or relying on it. The tools that generate its data files (`extract_vanilla.ps1`,
`extract_presets.ps1`, `extract_icons.ps1`, `bundle_ui.mjs`, `ui.ps1`, `econ_host.mjs`, `econ_selftest.mjs`, `build_ui2*.mjs`,
`serve_ui2.mjs`) have their own entries in the tools section.

⚠ On the canon the sheet is a reader and a scenario explorer, not the place the book is edited. The canon is a generated A/B
book (`_ab`, `_artisan`, `_merge` records); landmine L31 (`lint_tier_eras.mjs`, run inside every build) recomputes every rung's
output, input value, `building_cost` and `ai_value` from those records, so a recipe, cost or ai_value edited in the sheet, a
`solve → targets`, a recipe-book switch or a Bring to vanilla makes the next build throw. Change a book through its generator
chain (the commands recorded in its `_*` blocks) instead.

### Files (ui/, ui2/)

| file | written by | git | role |
|---|---|---|---|
| `ui/builder.html` | hand | tracked | the editor: three pages (Balance sheet, Tech tree, Mod changes); carries a fork of part of `econ.js` |
| `ui/econ.js` | hand | tracked | the economic model, pure (no DOM); loaded by `builder.html` and, through `tools/econ_host.mjs`, by Node tools |
| `ui/data.js` | `build.ps1`, every build | tracked | `window.PMDATA`: `generated`, `config`, `prices`, `techs`, `sec_options`, `inverse`, `start_exceptions` |
| `ui/vanilla.js` | `extract_vanilla.ps1` (build) | tracked | every vanilla building, PMG and PM; `gated:true` marks power-bloc-gated PMs |
| `ui/presets.js` | `extract_presets.ps1` (build) | tracked | scenario presets plus the buy-package and pop-need tables |
| `ui/icons.js` | `extract_icons.ps1` (build) | gitignored | goods pictograms (Paradox art, never committed or shipped) |
| `ui/techtree.html` | hand | tracked | the tech-tree page, also openable standalone |
| `ui/techdata.js` | `tech_tree_spec.mjs --write` | tracked | the tree page's data; six-rung candidate trees, stale |
| `ui2/*` | `build_ui2.mjs` | tracked | record (see the last group) |

- **`ui/builder.html`** — the editor. Opens on the live config when served by `tools/ui.ps1` (port 8777; launched by
  `balance-ui.cmd`), on the embedded copy otherwise. Status: current.
  Traps: it still carries its own copy of ~260 lines of `econ.js` (`basePm`, `refSel`, `popSpend`, `slaveSpend`, `slaveRealShare`,
  `slaveBasketMult`, `needSplit`, `spendToGoods`, the split and local-goods constants) — change both or neither until the fork is
  collapsed (POLISH_1_0 C4). It reads neither `craft` nor `method_of`: a merged rung renders as its own row under a key that names
  no building in game. The tier pill reads `e<era>` (the config field), the docs' t0–t3.
- **`ui/econ.js`** — the one implementation of the model the sheet and the Node tools share: wages from workforce, the V3 price
  formula, the scenario order book, the pop-demand rules, `ladderFaults()` (the illogicality criterion, §10.11, scoring only
  buildings a scenario contains, §10.17), `scenarioSummary()` and `scenarioGDP()` (52 × weekly value added, F45). Status: current;
  its main Node consumers (`era_scenarios`, `era_solver`, `era_inverse`, `payback_census`) are six-rung machinery, retired, and the
  pop-split readers under `tools/testbed/` still use it. After any edit run `node tools/econ_selftest.mjs` (checks against
  F26/F27/F31/F61 and the price-formula anchors).
- **`ui/data.js`** — build-time copy of the book and its indexes. `generated` is the build time in UTC, shown in the load banner
  when the live config is unavailable. `config` is the whole book. `techs` is a compact index of the SHIPPING tree
  (`config/tech_tree_options.json`): `id → {n name, e tech era, c category, o vanilla|new, y onset}`, ~20 KB; it lets every row and
  chart dot name its unlocking technology, and `emit_techs.mjs` throws when that tree has fallen behind the config, so the index
  matches the game. `sec_options` (since 2026-10-03, §10.93): per tier key and group, the vanilla secondary methods legal beside that
  rung's main method where they differ from vanilla's group (an empty list = the building does not carry the group); the sheet
  offers exactly these and defaults to the first, so a mandated automation is on by default. `inverse` is `config/era_inverse.json`'s
  recipe book (six-rung, see the red buttons below). `start_exceptions` lets the Mod-changes page list the 1836 rules standalone.
  Traps: stale the moment anything writes the config without a build; the served sheet ignores it in favour of `/api/config`.
- **`ui/vanilla.js`, `ui/presets.js`, `ui/icons.js`** — regenerated every build; the UI never reads game files itself. Without
  `icons.js` (fresh clone, never built) rows are text-only and a good with no icon gets a dashed placeholder. Without `presets.js`
  only the built-in Empty preset exists. Patch couplings for all three: ON_GAME_UPDATE.md.
- **`ui/techtree.html` + `ui/techdata.js`** — the tree page (described under "The tech-tree and Mod-changes pages" below). Status: stale. `techdata.js` dates from
  2026-08-12 and holds the six-rung candidate trees; `tech_tree_spec.mjs --write` refuses the four-rung canon (six-rung machinery,
  retired), so the page cannot be refreshed for the canon as things stand (POLISH_1_0 C3, BACKLOG). The row labels on the sheet do
  not depend on it: they come from `PMDATA.techs`.
- **`balance-snapshot.cmd`** → `tools/bundle_ui.mjs` → `balance_ui_snapshot.html` (gitignored): the editor, its data and the tree
  page folded into one file, no server. Build now is disabled in it; Export works in the file but is inert in a published
  Artifact (the viewer grants no download), so a published snapshot is read-only in practice. Republishing rules: CLAUDE.md.

### How the sheet loads and what it writes

- **Load.** Served by `tools/ui.ps1`, the page fetches `GET /api/config` (the live `config/mod_config.json`, verbatim) and
  `GET /api/start_exceptions` synchronously at boot and swaps them into `PMDATA` before anything reads it — the same stale-copy
  trap `econ_host.mjs` closes for the Node tools. Opened as a file or as the snapshot, it keeps the embedded copy. The load banner
  states which source it is on. No reconcile and no re-solve on load: the config is shown as it is (the old load-time
  `reconcileToWageModel` re-solve is removed; a tombstone sits at the end of `builder.html`).
- **Two halves.** The **recipe book** — every tier's `output_qty` and `inputs` plus the `pm_goods` overrides — is what the builder
  emits. The **scenario** — building counts, pops, SoL, wages, workforce ratios, PM selections, prices, locks — is session-only and
  never saved or emitted.
- **What Export / Build now writes** (`mergedConfig()`): a deep copy of the loaded config with, per tier, `output_qty`, `inputs`,
  `target_be`, `building_cost`, `wage_pct`, `ai_value`, `workforce_mult`, `effect_mult`, plus the top-level `building_ai_value`,
  `building_subsidies`, `pm_goods` and `tech_ai_weight_mult` (edited on the tree page). Displayed but never written:
  `pm_employment`, base `employment`. Per-building base wages and PM selections are session-only.
- **Build now** POSTs the config to `/api/build`, which overwrites `config/mod_config.json` and runs the full `build.ps1` (which
  deploys). Without the server, **Export mod_config.json** saves the file and you run `build.ps1` yourself.
  Traps: on the canon, Build now replaces the file that must stay a verbatim copy of the named canon book. The export is never
  byte-identical to its input even with no edit: it restates `input_ratio` on every tier and writes `building_ai_value`, and Export
  pretty-prints it (Build now posts it minified). Edits of recipe, cost or ai_value fail L31 on an A/B book (see the top of this section).
- **AI fields.** Base `ai_value` is editable on every row: per tier (blank = engine default 1000) and per reference building
  (`data-refaiv`, backed by the top-level `building_ai_value` map). The builder emits a tier's own `ai_value`, and applies
  `building_ai_value` only to vanilla buildings preserved inside files it already owns (`Set-BuildingAiValue`); an edit to any other
  building shows but does not emit. The default display reads each building's vanilla `ai_value` from `vanilla.js`. AI subsidy
  policy is a five-option dropdown on every row backed by `building_subsidies` (`vanilla` / `none` / `nice_to_have` /
  `wants_to_have` / `must_have`; absent = `vanilla`), emitted into `common/ai_strategies/01_admin_strategies.txt` only when a value
  other than `vanilla` is set (the builder's own entry has the merge rules). The canon
  carries no `building_ai_value` and sets subsidies only for the four dam classes (`must_have`) and the tooling and explosives
  rungs (`none`).
- **The red buttons write the recipe book; nothing else does.** Exactly four are red: `recipes: vanilla` (every tier's
  `vanilla_pm` recipe from `vanilla.js`; a tier with no vanilla PM — the canon's three minted t3 rungs of furniture, paper and
  fertilizer — is interpolated from the nearest anchored tier by the six-rung ×1.5 ladder, not the canon's A/B ladder),
  `recipes: mod` (the config as loaded), `recipes: solver 2` (`PMDATA.inverse`, the six-rung inverse solve's book, §10.65.2; only
  23 of its 105 keys exist on the canon; refreshed only by `era_inverse.mjs --write` plus a build; disabled when absent), and
  `solve → targets`. All are whole-sheet, ignore locks, and leave the scenario alone.

### UI principles

Rules for anyone changing `ui/builder.html` or `ui/econ.js`. Each exists because breaking it produced a wrong screen with nothing
failing.

- **One layout for every building.** Tiered rungs, economic buildings outside the tiering scope and non-economic buildings all
  render with the same row and the same columns (`MTABLE_COLS`, 13 columns): PM selectors under the name, editable goods, the wages
  row, workforce, BE and profit. A cell shows `—` only when the building genuinely lacks it (no output; no input goods → wages 100%
  of cost with the £ shown as `—`; not on the ladder → Target / Build cost / Payback `—`). Never branch the layout on tiered versus
  reference; add a new element everywhere. Macrogroups organise cards and never change the layout. One shared `wageRowHTML`.
- **Columns align left.** `.num` requests tabular figures only. Right alignment is opt-in where a cell is a label → value pair
  read as an equation (goods rows and subtotals, `.goodrow`'s flex) and in the scenario panel, which mirrors the in-game market
  screen.
- **Every £ in a building row is at the current scenario prices, including throughput** (`mval()`), so `total out − total in`
  equals the Profit column exactly. Wages are the one term throughput does not scale. Do not reintroduce a base-price subtotal
  without a second, labelled row.
- **Red means it writes the recipe book.** Scenario presets write no recipes, and must not: `applyScenarioPreset` touches
  `BLDNUM`, `REFSEL`, `_sec`, `POPS`, `SOL` and wages only. Restore defaults resets `target_be`, `building_cost`, `ai_value` and
  secondary PMs of unlocked groups and never volumes; Bring to vanilla sets `ai_value` to the pre-split vanilla building's (blank =
  engine default), `building_cost` to the pre-split building's flat `required_construction` (`VANILLA_CONSTRUCTION`: low 200 /
  medium 400 / high 600 / very_high 800, mirroring `common/script_values/building_values.txt`), resets secondaries, and leaves
  recipes to `recipes: vanilla`. Its scope rule: everything that is neither recipe nor scenario, except the tier split itself and
  fields the UI does not yet make editable and emittable (today `employment`). When a field becomes editable and emittable, wire it
  into exactly one of the two. Trap: both buttons' tooltips and banners still claim they reset volumes or recipes; the code does not.
- **A preset is a one-off overwrite, not a mode.** Nothing in the panel may claim the scenario is "in" a preset: no sticky active
  button, no standing description of market, subsistence or lock state. What a preset knows about itself (members, building types
  and levels, pop split, subsistence staffing, treaty transfers, lock state, base wage, urban-centre count) is reported once, in the
  banner, by `presetReportHTML()`. The bar holds only live controls.
- **Badges are derived, never tracked.** A recipe button dims (`.same`) when the sheet already holds that book; a preset button
  carries a `.same` ✓ meaning "pressing this would change nothing". Both compare canonical fingerprints recomputed from state; a
  maintained dirty flag is rejected (undoing an edit must bring the badge back).
  - `recipeSnapshot()` is the one definition of a recipe; the writer `recipeApply` and the fingerprint `recipeKey` both consume it.
  - `scenarioSnapshot()` is the one definition of the scenario, shared by the fingerprint and by save/restore
    (`scenarioRestore`). The snapshot must stay faithful and complete; normalise only inside the fingerprint. A field filtered out
    of the snapshot is destroyed on the next probe (it once emptied the price table, visible only when locked, as £NaN).
  - There is no per-preset cache: a preset's result depends on the state it is applied from, so the probe applies it from here
    through `applyScenarioPreset(id, quiet)` and compares. The quiet probe does not render, so it calls `syncScenarioPrices()`
    itself (in auto mode `thresholds` are derived). Prices are compared unconditionally; the lock toggle is not in the key.
    `REFSEL` entries equal to the lazy default `refSel()` fills on render are normalised away.
  - Recompute from both `render()` and `updateComputed()` (the preset pass debounced 200 ms; a full pass over ~22 presets costs
    ~50 ms), because `render()` does not call `updateComputed()`.
- **One implementation per rule.** `ladderFaults()`, `scenarioSummary()` and the pop model live in `econ.js`; `builder.html`'s fork
  is the standing exception (change both). Pure functions take callbacks rather than closing over the sheet's state.
- **Population is edited by profession; a stratum is always the sum.** The By-profession row carries all 16 pop types
  (`PROF_ORDER`, peasants and slaves included) and is always rendered with every field. The class row is always read-only and has
  no write path (`data-pop`). Do not reintroduce a conditional row (the old `HAVE_POPPROF` flag made the derived quantity the
  input). The SoL row and the Population row share one class order (`CLASSES`: upper · middle · lower · peasants · slaves) on one
  grid template. `PROF_STRATUM` (which stratum each profession consumes as) mirrors `extract_presets.ps1`'s `$PROF_STRATUM`:
  change both.
- **Prices are unlocked by default** on load and after every preset, including presets that carry no prices. Locking is the
  deliberate act.
- **Label technologies by tech era, rungs by tier.** Rows read `<technology> · tech era N` (`techLabel`); our tiers name the mod's
  technology, reference buildings their vanilla one, both through `PMDATA.techs`. Never a bare "era".
- **The Mod-changes page is a view.** Numbers and lists are interpolated from the loaded config and session state; its prose
  states the builders' fixed rules and is maintained with them (`renderModChanges`); there is no add/remove-a-point UI. Every
  header control belongs to the sheet and is hidden on the other two pages.
- **Emission scope for untiered buildings**: their goods (through `pm_goods`) and, inside files the builder already owns, their
  `ai_value` — never a whole building definition. There is no scope switch; add one only together with the code that honours it.

### The all-buildings explorer

- The sheet always shows every vanilla building. Our industries are editable cards, one row per rung. Below them every other
  vanilla building renders in the same card and row layout: one category card per taxonomy group, the building shown untiered (a
  grey `0` pill), ladder-only columns `—`, PM selectors under the name, every good editable, the wages row, non-goods outputs and
  workforce read-only, informational BE and profit.
- Categories sit in macrogroups by economic status — economic but out of scope (utilities, trade and arts; food and agriculture;
  raw extraction), then non-economic (administration, military consumers, property owners, subsistence, service, construction,
  unique buildings). The map is `GRPCAT` / `CATLABEL` / `ECON_CATS` / `REF_CLUSTERS` in `builder.html`, keyed by vanilla
  `building_group`; an unmapped group gets its own card in the Other cluster. Each category is locked by default (excluded from
  mass tools, still editable). The **Military** card (battalions, two rows per combat unit type, mobilised and not) folds through
  the same `REFGRPOPEN` set, collapsed by default.
- A PMG's default is its first non-gated PM (`basePm()` skips `gated:true`, i.e. power-bloc-gated methods, which some PMGs list
  first). Explorer PM selections and category locks are session-only.
- Goods edits on reference buildings, and on our tiers' secondary PMs (the `↳` rows), go to the top-level `pm_goods` map, which the
  builder writes into the production-method files it owns, so an edit applies to every building using that PM. Our tiers' main PMs
  stay per tier. PM names are not all `pm_`-prefixed (`default_`, `automatic_`, `picks_and_shovels_` …); the extractor, the
  `pm_goods` writer and the linter accept any name.

### The economic model the sheet implements

`ui/econ.js` (`builder.html`'s fork mirrors the pop half). Assumptions: full employment, no market access; a building contributes
its active PMs' inputs and outputs × its Number × throughput.

- **Wages.** `W = base wage × wage units`, wage units = `Σ employees × wage_weight` (vanilla `common/pop_types`: laborers 1;
  machinists, clerks, soldiers 1.5; farmers 2; shopkeepers, engineers, clergymen 3; bureaucrats, academics 4; officers, aristocrats,
  capitalists 5; peasants 0.2; slaves 0). The base-wage row (in the scenario panel, under Population) sets one sheet wage in linked
  £/week ↔ £/year (×52). Every building keeps its own base wage, so its wages row has three linked fields: base £/wk ⇄ total £ ⇄ %
  of total cost (`base = W/units`; `% → W = p/(1−p) · goods`). A PM change preserves the base wage; changing the sheet wage is
  inherited by unlocked groups only (`recomputeWages()`), locked groups keep theirs. A labour-only building is 100% wages; no
  workforce shows `—`. Model-only, never emitted (the game pays wages from employment). Preset wages: below.
- **Break-even and profit.** Full break-even = the output price, % of base, at which output covers input goods + wages, inputs at
  base. Profitability = (output − inputs − wages) ÷ (inputs + wages) at current prices, as % and weekly £.
- **Prices.** Auto: `price = base × [1 + 0.75 · clamp((BUY − SELL) / min(BUY, SELL), ±1)]`, the 25–175% band. Locked: each price
  cell is an editable % of base; the `100%` button (locked only) resets all. Either way the value lives in `thresholds` and reaches
  every row's profit; `refreshScenPrices()` (from `updateComputed`) keeps the column in sync.
- **Pop spending** (`popSpend()` → `spendToGoods()`). Each class buys the buy package (`common/buy_packages`) of its wealth level,
  × people ÷ `POP_SIZE_PACKAGE` (10,000), × 0.625 per head (needs are per working adult: `0.25 + 0.75 × DEPENDENT_CONSUMPTION_RATIO
  0.5`), × the class multiplier (peasants 0.05, the game's `consumption_mult`; overridable via `defaults.class_mult` in
  `config/presets.json`). Each class is spread uniformly over ±`SOL_SPREAD` (8) wealth levels around its SoL. Money → units at base
  price. There is no global pop-demand fit multiplier, no per-good availability gate and no calendar gate; do not reintroduce any.
- **The within-need split** (`needSplit()`, F40):
  ```
  availability(g) = ( market sell orders(g) − 0.5 × NON-POP demand(g) ) × BASE price(g) × LOCAL(g)
  raw share       = availability(g) / Σ availability over the need's own goods
  purchase weight = base weight(need,g) × clamp( raw , min_supply_share , max_supply_share )
  units           = need money × (purchase weight / Σ purchase weights) / base price(g)
  LOCAL(g)        = 0.40 for `local` goods (services, transportation, electricity), else 1
  ```
  - Availability is a value, not a unit count (F40; the units reading is refuted, F44). `S.AVAIL_MODE = 'units'` exists to re-score
    it, not to configure it.
  - The −0.5 × non-pop demand term is the one that matters most (F22).
  - The bounds clamp the RAW share, not the final share of the need (F31, §10.34). `S.SPLIT_MODE = 'final'` is an A/B switch,
    re-scorable with `tools/testbed/score_pop_split.mjs`.
  - LOCAL 0.40 models a representative state (a fifth of GDP, a fifth of the local supply: `0.2 + 0.8 × 0.25`), and multiplies the
    whole availability, not supply alone (F43, §10.37). `S.LOCAL_MULT = 1` is the A/B.
  - An unsupplied good scores zero and drops out. The slave basket goes through the same split in the same pass.
  - Not modelled, because the scenario has no dimension for them (F40, F44): the prestige-goods multiplier, culture obsession (a
    purchase-weight floor plus a ±25% shift of the need's budget between needs) and religion taboo (×0.5). Where the wiki and
    `common/defines` disagree on their constants, the defines win (F44).
  - Known divergence, not fixed (F44): a need with no supply at all should buy its `default` good exclusively; we fall back to
    `config/pop_distribution.json`, then the vanilla `weight`. The default is already in `presets.js` (`def` per need). Fixing it
    moves scenario demand.
  - The weights match `common/pop_needs/00_pop_needs.txt` exactly (§10.19); re-check after a patch.
  - Accuracy against the game's own 1836 consumption: F24 (mean error ~18.5% of pop spending; individual goods and markets worse,
    Japan the worst).
  - `config/pop_distribution.json` is only the fallback for an unsupplied need. The `fit pops` button re-derives it across every
    preset with a measured order book, each market normalised by its own demand (F15), and prints JSON to paste into the config.
- **The slave channel** (F61; the share derivation is F27's). Slave pops consume in the pop line at their own wealth (0.75 per head
  from their `working_adult_ratio` 0.5, no class multiplier). On top, the building line "purchased for slaves" buys employed
  (non-subsistence) slaves × the per-head package at full rate: `slaveBasketMult()` = `slaveRealShare()`, the employed share by
  residual employment — unqualified jobs (laborers + farmers) in non-subsistence buildings minus lower stratum × 0.25 is the surplus,
  split between slaves and peasants in proportion to their workforce. The basket is a wealth level (`SLAVE_BASKET_DEFAULT` 8,
  clamped by the `SLAVE_BASKET_*` defines), so the SoL row's `slaves` field is that level, not a standard of living. The basket
  folds into the pops buy column; hovering a pops cell breaks it out. Two assumptions, neither fitted: slaves fill laborer/farmer
  jobs, and slaves and peasants share the surplus proportionally. Computed market-wide, which misreads a market whose slaves and free
  workers sit in different states (F27). `econ_selftest.mjs` carries the F61 checks.
- **Scenario summary.** Sector chips (levels and types per sector) and GDP = 52 × weekly value added at current prices (F45), from
  `scenarioSummary()`.

### Scenario panel and presets

- **Layout.** Every row has a **Number** column (count in the hypothetical market, keyed by building key for tiers and reference
  buildings). The panel mirrors the in-game market screen: pictogram, name and base price, then Buy orders (buildings | pops |
  trade) · Sell orders (buildings | trade) · Balance · Price, with proportional bars. Pops = derived pop demand plus the slave
  basket. Trade = treaty transfers a preset fills plus anything dialled in by hand. Colour: gold = abundance and below-base price,
  blue = deficit and above-base price (the game colours by sign; flip `scenPriceCls()` to mirror it). Good-group sections fold
  (`SCENFOLD`). The price header holds the `locked` checkbox and the `100%` button, wired by event delegation because the panel
  re-renders. Hovering a supply or demand number breaks it down by source (by building type; by pop need for pops, with the slave
  part and its share). Hovering an industry flags its goods. Session-only: `BLDNUM`, `ADDBUY`, `ADDSELL`, `SCENFOLD`, lock state,
  pops, SoL.
- **A scenario contains buildings, not raw order adjustments.** Anything that consumes or produces goods is a building with a count;
  the only non-building columns are the two trade columns. Trade centres consume merchant marine only; goods moving through them
  are trade.
- **Other row columns.** Build cost (editable, construction points → `required_construction`; its muted "model N" hint comes from
  the legacy `BCM` payback model of `solve_building_cost.ps1` and means nothing on the canon). Payback (years = build cost × £720 per
  point ÷ annual net profit at current prices; ∞ when unprofitable; £720 is the iron-frame rate, F53). Thru (throughput, editable,
  never emitted).
- **Ladder chart**, two independent radios. Break-even (full BE at base input prices, a property of the recipe, target bands shaded)
  versus profit (the margin at the scenario's realised prices, PMs, throughput and wages; 0% solid, +20% dashed; a line sloping down
  to the right is an inverted ladder); the two disagree by design. Raw (one line per industry, each dot naming its technology) versus
  aggregated (the four sectors — extraction and logging, agriculture and fishing, manufacturing from raw inputs, manufacturing from
  manufactured inputs, the last two split per tier — as box plots with a ◆ output-weighted centre, ◇ hollow when nothing in the box
  is built). Extraction and agriculture are untiered and repeat as a flat baseline. A hollow dot = the scenario contains none. The
  aggregated shape is provisional. The **Ladder check** panel is `ladderFaults()`.
- **Mass tools.** Payback tools ($ = set build cost so payback = X; % = scale an industry's output and input prices by one factor so
  an anchor tier's payback = X, flagging prices outside 25–175%) at tier, group and sheet level. Group locks (🔒 per card, `🔒 all` /
  `🔓 all`) exclude a group from every mass editor; manual edits stay allowed; locks reset on reload. BE tools skip locked and
  `follows_be:false` groups: `solve → targets` (red) re-solves input volumes to each tier's `target_be` at the current wage, output
  untouched, an active secondary's inputs netted off first, build cost not touched; `targets ±10pp` shifts `target_be` (floor
  `BE_MIN` 5) without re-solving. Snapshot history and version-tolerant config-part save/load.
- **Secondary PMs.** Selectors under the building name, options from `sec_options`. A secondary's goods appear as `↳` rows,
  editable and wired to `pm_goods` (so an edit changes that PM everywhere), never summed with the main good. Non-goods outputs are
  read-only, merged by kind. The Workforce column is display-only and adds every PMG's active PM employment, base PM included (the
  art academy's jobs sit in its ownership PMG).
- **Presets.** A button strip grouped by `group`. Applying one overwrites every Number, the non-pop buy and sell orders, population,
  per-stratum SoL, base wage and PM selections (reset to defaults, then set to what vanilla runs). The built-in **Empty** preset works
  without `presets.js`. Groups in `presets.js` today:
  - **Vanilla 1836**, eight country markets (FRA GBR RUS CHI AUS JAP USA BEL; list in `config/presets.json`).
  - **Placeholder**, `ph_sol8` … `ph_sol20` (seven).
  - **Era ladder**, the six-rung tier scenarios (`config/era_presets.json`) — six-rung machinery output, retired.
  - **Inverse solve**, the six-rung inverse solve's seeded scenarios (`config/era_inverse.json` `presets`, fractional counts; read
    their margins only on `recipes: solver 2`) — six-rung, retired; absent when the artifact is.
- **Country preset derivation** (`extract_presets.ps1`; patch couplings in ON_GAME_UPDATE.md). Rule: take everything the history
  files hold, and measure only what they cannot answer — trade, SoL per stratum, pop class shares, urban-centre PMs
  (`config/measured_1836.json`). Check history first before adding a scenario input.
  - Market: the lead country plus every subject sharing its market (all subject types share by default; `grant_own_market` is the
    exception, resolved transitively); `market_add` / `market_drop` override.
  - Buildings: every `create_building` owned by a member, in levels, mapped onto the tier building via the active vanilla main PM.
  - Trade: `goods_transfer` treaty articles in force in 1836 (out of the market = buy, in = sell) plus the measured trade flows; no
    trade-route trade otherwise.
  - Population: `pops_by_profession` from `config/measured_1836_professions.json`, summed over members. Placeholders split their
    stratum totals by the world's within-stratum profession shares. A hand-written class-only preset goes onto laborers / clerks /
    aristocrats with a banner warning that the mix is fabricated.
  - Military: battalions from `common/history/military_formations`, goods from each combat unit type's `upkeep_modifier` (barracks
    and logistics centres carry none); military building levels from `measured_1836.json`, because the engine sizes them to the army
    (F14).
  - Inferred buildings. **Subsistence**: free arable land per state (minus farm, ranch and plantation levels) × staffing, staffing =
    min(1, peasant workforce ÷ capacity), 5,000 peasants a level (rice 10,000), because its goods are `workforce_scaled`.
    **Ownership** (manor houses, financial districts): one level per owned level from `add_ownership`. **Urban centres**:
    `floor(state urbanization ÷ 100)` per state, then summed; subsistence groups contribute nothing; a tier building counts as the
    vanilla building it replaced (F13). The PMs of never-created buildings follow the owner's laws (`Select-LawPm`: the first PM not
    power-bloc- or tech-gated, not disallowed, and ungated or law-unlocked).
  - Throughput: measured per building type (`GetThroughputBonusCurrent`); economy of scale is +0.01 a level, capped at 20.
  - Secondary PMs: measured, the most popular by levels per PMG per building type per market. This distorts a split; the extractor
    warns on a near-tie (winner under 65%).
- **Placeholder presets.** Synthetic: no country, trade or army, base PMs, one level of every ordinary building. Excluded: `unique`
  buildings, monuments and canals, the military groups, company headquarters; manor houses and financial districts stay. Urban
  centres and subsistence are derived (subsistence = peasants × 0.25 ÷ 5,000 staffed levels; urban centres by the F13 rule). Pops:
  1M lower, 1M peasants, 100k middle, 10k upper, 0 slaves. SoL: lower = the preset's number, middle ×1.5, upper ×3. Base wage
  `exp((SoL − 37.43) / 10.49)` (F26). Shared settings in `config/presets.json` `placeholder_defaults`.
- **SoL and wage from a preset.** Five SoL fields, one per stratum; peasants carry their own level (F12); the slaves field is the
  basket level. A preset carries its market's measured `base_wage` (`base_weekly_wage` in `measured_1836.json`: laborers + farmers
  + machinists, employed pops only, F26 basis; the 11-profession `base_weekly_labour` beside it is superseded and never fed to a
  scenario) and applies it through `recomputeWages()`, so unlocked groups inherit and locked ones keep theirs. A preset with no
  measured wage leaves the sheet wage alone and says so.

### The tech-tree and Mod-changes pages

- **Three pages, one window**: the Balance sheet / Tech tree / Mod changes switch at the top left. Views of one config.
- **Tech tree** (`ui/techtree.html`). Embedded in an iframe so its selectors (`header`, `.row`, `.legend`, `.stats`, `.node`) and the
  sheet's cannot collide and the file stays openable standalone; filled lazily on first visit. Served, it loads by `src`; in the
  snapshot the whole page (with `techdata.js` inlined) arrives as `window.__TECHTREE_HTML` and goes in by `srcdoc`. `bundle_ui.mjs`
  fails if either half moves; the sheet shows a named warning if a host's CSP refuses the frame. The bundler warns when `techdata.js`
  and `config/tech_tree_options.json` carry different `generated` stamps (a stamp check, not mtime: the build rewrites the config
  after every `--write`); with today's stale `techdata.js` it warns on every bundle. Layout: tech era is a row and progression runs
  downward; columns are industries. Hover names what blocks a technology and what it blocks, click pins. It switches option (1/2/3)
  and tree and reports each combination's research budget against vanilla's. The tech-spread panel edits the spread formula's
  constants and shows the share of each tree spread alone hands a laggard by 1936, against vanilla's own share; nothing in it is
  emitted except the **AI research weight ×** row (config `tech_ai_weight_mult`, default 1/1/1 = nothing emitted), which
  round-trips to the sheet over `postMessage` (`AIWEDIT` → `mergedConfig()`) and is read-only when the page is opened standalone.
  Status: shows the six-rung candidate trees (Files group above).
- **Mod changes** (`renderModChanges` in `builder.html`). Read-only: every change the Build button emits beyond the per-tier
  recipes, grouped by theme (tier split, emission rules, PM surgery, 1836 start, tech tree, research events, AI behaviour, meta and
  guards), numbers interpolated live. ⚠ marks flag verified divergences between intent and what ships; resolving them is a design
  decision. Status: much of its static prose describes the six-rung-era build and is stale on the canon (POLISH_1_0 C2).

### ui2/ (built on a retired derivation)

- **`ui2/ladder_sheet.html`** (+ `.artifact.html`, the same page stripped of document tags for publishing),
  **`ui2/ladder_workbench.html`**, **`ui2/gen/presets.tier4.js`** — `ui/builder.html` itself with the tier4 config, presets and
  solver-2 book inlined, plus the analysis workbench beside it; written by `tools/build_ui2.mjs` (`--report` for the workbench),
  served by `tools/serve_ui2.mjs` on port 8791 (the browser pane cannot open an ~800 KB `file://` page). Status: record. It was built
  on the four-rung solver-2 derivation (§10.66, §10.66.8), superseded by the vanilla-built structure (§10.72); regenerating it now
  would put the current structure under it with no solver-2 artifact. Traps: build-time copies; Export is inert in a published
  Artifact.
