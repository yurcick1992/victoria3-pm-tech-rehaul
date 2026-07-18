# PM & Tech Rehaul — a Victoria 3 economic-realism mod

For **Victoria 3 (1.13 "Matcha")**. It makes a technological edge actually matter: each economic
building keeps **one** main production method, every former "upgrade" PM becomes **its own
tech-gated building**, and outputs/inputs are re-sloped into a **break-even ladder** so modern
factories drive obsolete ones out of the market — and modernizing now costs **capital** (you
*build* the newer plant instead of flipping a PM for free).

Design detail lives in [`CLAUDE.md`](CLAUDE.md) (how it's built), [`BALANCE_FRAMEWORK.md`](BALANCE_FRAMEWORK.md)
(the balance methodology + numbers), and [`MODDING_NOTES.md`](MODDING_NOTES.md) (engine gotchas).

Scope today: **all manufacturing** — 18 industries / 53 tier buildings (light, heavy, military, and
ship construction; the shipyard is split into separate clipper and steamer chains). Raw-resource
extraction and agriculture are out of scope.

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
- watch **break-even** and **profitability** update live,
- switch **secondary production methods** (automation, luxury, …) and see the effect on break-even,
- browse **every vanilla building** in the all-buildings explorer — same card/table look as the tiered
  industries (pick production methods and **edit any good's input/output**; non-goods outputs like
  infrastructure/pollution and workforce stay read-only), sorted into a custom taxonomy (utilities/trade/arts,
  food & agriculture, raw extraction, other) and **locked by default** (unlock a group to include it in mass tools),
- set each tier's base **`ai_value`** (AI construction desire); click **Restore defaults** to reset
  unlocked groups to the loaded config, or **Bring to vanilla** to reset split buildings toward their
  base-game recipes + ai_value,
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

## What you edit

`config/mod_config.json` is the source of truth (the editor reads/writes it). `config/start_exceptions.json`
holds manual overrides for the 1836 start (force a country's factories to a tier, or remove them).
Everything under `mod/` is **generated** — never hand-edit it.
