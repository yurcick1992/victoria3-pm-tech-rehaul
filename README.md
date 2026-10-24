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

## Requirements

- **Windows** with **Victoria 3** installed (Steam). PowerShell ships with Windows.
- A **browser** (Chrome or Edge recommended) if you want the balance editor.
- If Victoria 3 isn't at the default Steam path, set the `VIC3_GAME` environment variable to your
  `…\Victoria 3\game` folder before building.

## Play the mod

```
powershell -ExecutionPolicy Bypass -File tools\build.ps1
```

This regenerates the mod, converts the 1836 start, lints the economy, and deploys a real copy to
`Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul`. Then **restart the Paradox
launcher**, add **“PM and Tech Rehaul”** to a playset, and Play.

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
