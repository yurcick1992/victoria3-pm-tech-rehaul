# PM & Tech Rehaul — a Victoria 3 economic-realism mod

For **Victoria 3 (1.13 "Matcha")**. It makes a technological edge actually matter. In seventeen
manufacturing industries each of vanilla's main production methods becomes **its own tech-gated
building** (a rung), and every newer rung makes more per worker and per unit of capital than the one
before, so modern factories drive obsolete ones out of the market — and modernising costs **capital**
(you *build* the newer plant instead of flipping a method for free). Power becomes a real input (cities
light themselves, power plants are capital-heavy, 122 historical hydro dams), ordinary research is cut
and earned back by running industry, and a unit of trade capacity moves more of compact, valuable goods.
The full list of changes is [`CLAUDE.md`](CLAUDE.md) §1.2.

Design detail lives in [`CLAUDE.md`](CLAUDE.md) (goals, principles, metrics, the canon, the working rules), [`REPO_GUIDE.md`](REPO_GUIDE.md) (every file and tool), [`BALANCE_FRAMEWORK.md`](BALANCE_FRAMEWORK.md)
(the balance rulings), and [`MODDING_NOTES.md`](MODDING_NOTES.md) (engine gotchas).

Scope: **17 tiered industries**, up to four rungs each — food, textile, furniture, glass, tooling, paper,
fertilizer, explosives, steel, motor, automotive, arms, artillery, munition, synthetics, electrics and the
art academy. Extraction, agriculture, ports, shipyards, railways, power plants and trade centres keep
vanilla's buildings; the balance editor still shows every vanilla building's recipe.

Players get the mod from the Steam Workshop; this README is for building and editing it.

## Vanilla files the mod replaces

<!-- replaced-files:start -->
The mod replaces **146 vanilla files** whole, in 26 folders (generated from the 1.0.0 build by `tools/list_replaced_files.mjs`),
and the whole folder `common/history/buildings/` (the converted 1836 start). Another mod that changes
any of these files conflicts with this one: the one loaded later wins the whole file.

<details><summary>The replaced files, by folder</summary>

- `common/ai_strategies/` (2): `00_default_strategy.txt`, `01_admin_strategies.txt`
- `common/amendments/` (1): `00_amendments_enactment_04.txt`
- `common/buildings/` (2): `01_industry.txt`, `06_urban_center.txt`
- `common/company_types/` (22): `00_companies_africa.txt`, `00_companies_americas.txt`, `00_companies_asia.txt`, `00_companies_austria_hungary.txt`, `00_companies_china.txt`, `00_companies_cots.txt`, `00_companies_ep2.txt`, `00_companies_europe.txt`, `00_companies_france.txt`, `00_companies_germany.txt`, `00_companies_great_britain.txt`, `00_companies_ip2.txt`, `00_companies_ip3.txt`, `00_companies_ip4.txt`, `00_companies_italy.txt`, `00_companies_japan.txt`, `00_companies_mp1.txt`, `00_companies_russia.txt`, `00_companies_soi.txt`, `00_companies_totally_normal.txt`, `00_companies_usa.txt`, `99_basic_companies.txt`
- `common/decisions/` (1): `grand_exhibition_decision.txt`
- `common/goods/` (1): `00_goods.txt`
- `common/history/buildings/` (16): `00_west_europe.txt`, `01_south_europe.txt`, `02_east_europe.txt`, `03_north_africa.txt`, `04_subsaharan_africa.txt`, `05_north_america.txt`, `06_central_america.txt`, `07_south_america.txt`, `08_middle_east.txt`, `09_central_asia.txt`, `10_india.txt`, `11_east_asia.txt`, `12_indonesia.txt`, `13_australasia.txt`, `14_siberia.txt`, `15_russia.txt`
- `common/history/pops/` (13): `00_west_europe.txt`, `01_south_europe.txt`, `02_east_europe.txt`, `03_north_africa.txt`, `04_subsaharan_africa.txt`, `05_north_america.txt`, `06_central_america.txt`, `07_south_america.txt`, `08_middle_east.txt`, `09_central_asia.txt`, `10_india.txt`, `11_east_asia.txt`, `15_russia.txt`
- `common/journal_entries/` (8): `00_art_jes.txt`, `00_belle_epoque.txt`, `00_liberalism.txt`, `00_player_objectives_economic_dominance.txt`, `00_prohibition_laws.txt`, `00_trade_route_event_missions.txt`, `03_russia.txt`, `06_economic_regeneration.txt`
- `common/laws/` (2): `01_economic_system.txt`, `01_education_system.txt`
- `common/power_bloc_principles/` (1): `00_power_bloc_principles.txt`
- `common/production_methods/` (3): `01_industry.txt`, `06_urban_center.txt`, `07_government.txt`
- `common/scripted_buttons/` (4): `00_balkan_wars_buttons.txt`, `03_paraguay_scripted_buttons.txt`, `05_serbia_buttons.txt`, `06_vernacular_buttons.txt`
- `common/scripted_effects/` (3): `00_scripted_effects.txt`, `00_victoria_scripted_effects.txt`, `04_negotiation_scripted_effects.txt`
- `common/scripted_triggers/` (1): `00_scripted_triggers.txt`
- `common/state_traits/` (4): `01_scandinavia_traits.txt`, `03_north_america_traits.txt`, `06_eastern_europe_traits.txt`, `11_far_east_asia_traits.txt`
- `common/static_modifiers/` (19): `00_code_static_modifiers.txt`, `00_ip3_02_modifiers.txt`, `00_ip3_03_modifiers.txt`, `00_ip3_04_modifiers.txt`, `00_ip4_03_modifiers.txt`, `00_ip4_04_modifiers.txt`, `02_event_modifiers.txt`, `104_modifiers.txt`, `105_modifiers.txt`, `agitators_4_modifiers.txt`, `agitators_4_revolution_modifiers.txt`, `brazil_2_modifiers.txt`, `content_1_modifiers.txt`, `content_2_modifiers.txt`, `content_3_modifiers.txt`, `content_4_modifiers.txt`, `cuban_modifiers.txt`, `japan_single_fire_events_modifiers.txt`, `montenegrin_modifiers.txt`
- `common/technology/technologies/` (3): `10_production.txt`, `20_military.txt`, `30_society.txt`
- `events/` (11): `assassination_events.txt`, `belle_epoque_events.txt`, `decree_events.txt`, `decree_events_02.txt`, `fascism_events.txt`, `ig_suppression_events.txt`, `industrial_accidents_events.txt`, `krakatoa_events.txt`, `liberalism.txt`, `pm_events.txt`, `trade_route_events.txt`
- `events/balkans_events/` (3): `03_ip3_austria_events.txt`, `montenegro_events.txt`, `national_awakening.txt`
- `events/brazil/` (2): `amazonas.txt`, `paraguay.txt`
- `events/iberia_events/` (1): `ip4_anarchism_events.txt`
- `events/japan_events/` (1): `ep2_japan_events_03.txt`
- `events/law_events/` (2): `citizenship_laws.txt`, `economy_laws.txt`
- `events/tech_events/` (5): `camera_film_pm_events.txt`, `military_tech_events.txt`, `production_tech_events.txt`, `society_tech_events.txt`, `war_crimes_events.txt`
- `map_data/state_regions/` (15): `00_west_europe.txt`, `01_south_europe.txt`, `02_east_europe.txt`, `03_north_africa.txt`, `04_subsaharan_africa.txt`, `05_north_america.txt`, `07_south_america.txt`, `08_middle_east.txt`, `09_central_asia.txt`, `10_india.txt`, `11_east_asia.txt`, `12_indonesia.txt`, `13_australasia.txt`, `14_siberia.txt`, `15_russia.txt`

</details>
<!-- replaced-files:end -->

Map mods and mods that overhaul companies, technologies, production methods or the 1836 history are the likely conflicts. What a game
patch can break in these files, and what to re-run after one, is in [`ON_GAME_UPDATE.md`](ON_GAME_UPDATE.md).

## Building from source

### Requirements

- **Windows** with **Victoria 3** installed (Steam). PowerShell ships with Windows.
- **Node.js 24 or later** (the generators and linters), and **Git for Windows** (its bash runs the economy linter; the build warns and
  skips that linter without it).
- A **browser** (Chrome or Edge recommended) if you want the balance editor.
- If Victoria 3 isn't at the default Steam path, set the `VIC3_GAME` environment variable to your
  `…\Victoria 3\game` folder before building.

### Build

```
powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Release
```

This regenerates the mod, converts the 1836 start, lints the economy, and deploys a real copy to your
`Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul`. Then **restart the Paradox
launcher**, add **“PM and Tech Rehaul”** to a playset, and play. `-Release` makes the player build. Without it the build is a
**debug build**: it logs the mod's dam and research activity to `debug.log`, shows each building's recipe break-even in its name
(“Recipe BE 48%”) and stamps the build time into the mod's name.

## Tweak the balance — the editor

**One click: double-click [`balance-ui.cmd`](balance-ui.cmd).** It starts a small local server
and opens the editor in your browser. You can:

- edit input/output **volumes** and **wages** for every building × tier,
- watch **break-even** and **profitability** update live, and flip the **ladder chart** between the two
  with a radio: *break-even* (what a recipe needs, independent of any scenario) or *profit* (what each tier
  actually earns at the current prices and wages — a line sloping down to the right means newer factories
  are earning less than older ones, which is the thing this mod exists to prevent); a second radio switches
  between *raw* (one line per industry) and *aggregated* (the four sectors — extraction, agriculture,
  manufacturing from raw inputs, manufacturing from manufactured inputs — as box plots with an
  output-weighted centre),
- read the **Ladder check** panel, which counts the three ways a tech ladder can be incoherent and updates
  as you tinker — it only ever counts buildings your scenario actually contains,
- switch **secondary production methods** (automation, luxury, …) and see the effect on break-even,
- browse **every vanilla building** in the all-buildings explorer — same card/table look as the tiered
  industries (pick production methods and **edit any good's input/output**; non-goods outputs like
  infrastructure/pollution and workforce stay read-only), sorted into a custom taxonomy (utilities/trade/arts,
  food & agriculture, raw extraction, other) and **locked by default** (unlock a group to include it in mass tools),
- set each tier's base **`ai_value`** (AI construction desire); click **Restore defaults** to reset
  unlocked groups to the loaded config, or **Bring to vanilla** to reset split buildings toward their
  base-game recipes + ai_value,
- load a **market preset** in the scenario panel — one click fills the whole scenario with a country's
  vanilla 1836 market (France / UK / Russia / Qing, or Empty), or one of the five **solved tier scenarios**
  (1836 / 1870 / 1900 / 1920 / 1935): its buildings and the production methods
  the base game runs there, its **subsistence farms** (staffed by the peasant population, which is where
  most 1836 food comes from), its treaty goods transfers, and its population. Buy orders then split into
  **buildings | pops | trade**, with editable **population** counts and **standard of living** per class.
  Pop demand is derived live from those pops, each need's money splitting across its goods by the market's
  own supply share — the rule the game itself uses — so a good the market does not supply drops out on its
  own,
- switch a tier's **secondary PMs** (selectors under the building name) — their goods distribute into the
  Input/Output columns as editable `↳` rows (shared via `pm_goods`), their non-goods outputs
  (infrastructure/pollution) and employment show read-only; the **Workforce** column tracks the selected PMs,
- click **Build now** to write the config and rebuild + redeploy (then restart V3 to load it).

**No-server option:** just open [`ui/builder.html`](ui/builder.html) in a browser. Everything works
*except* **Build now** — instead use **Export mod_config.json**, save it over
[`config/mod_config.json`](config/mod_config.json), and run `tools\build.ps1`.

> Why a server is needed only for *Build now*: a web page cannot run programs on your PC (a hard
> browser security rule). The server just invokes the same `tools\build.ps1` — no logic is
> duplicated in the browser.

**Take the sheet with you: double-click [`balance-snapshot.cmd`](balance-snapshot.cmd).** It writes
`balance_ui_snapshot.html` at the repo root — the whole editor and its data folded into **one file**
that needs no server, no network and no checkout, so you can read or tune the balance on another
machine, or hand it to someone. Everything computes live (presets, prices, profitability, the payback
and break-even tools) and **Export mod_config.json** works, so the round trip is *tune → export → bring
the file back*. **Build now** is disabled in it, and the goods pictograms are left out (they are game
art). It is a **snapshot, not a mirror**: it carries the balance as of the moment you made it and says
so in a dated banner, so regenerate it rather than trusting an old one — and it refuses to run at all
if you have not rebuilt since the last config change.

## What you edit

`config/mod_config.json` is the source of truth (the editor reads it; Build now and Export write it). A
book's manual overrides for the 1836 start live in the file its `start_exceptions_file` names; the canon's
(`config/start_exceptions.vanilla.json`) is empty, so its start is vanilla's map converted onto the rungs.
Everything under `mod/` is **generated** — never hand-edit it.

⚠ The canon is a **generated** book: the build recomputes every rung from the book's own records and fails
on a hand edit. Use the editor on it to read and explore; change the canon through its generator chain
(`CLAUDE.md` §4.4, §5.7).

## The canon

The balance book the builder ships by default is **`jex-dam4s-rs-x25-m10ac-dpriv-wm99`**, copied verbatim into
`config/mod_config.json` (+ `config/tech_tree_options.json`): up to four rungs per industry, each rung one of
vanilla's own production methods with vanilla's name, gate, staffing and icon, sized by the A/B ladder (output
×2.2, input value ×1.64 and construction cost ×1.9 per tier). The formula and its exceptions are `CLAUDE.md`
§1.3; what the book contains and where it stands, `CLAUDE.md` Part 4.

## Licence

The original work here is public domain under **CC0 1.0 Universal**: copy, change and reuse it freely, without credit. The game's own
material that the mod copies or references remains Paradox Interactive's. See [`LICENSE`](LICENSE).
