# The Batch Ledger — reusable per-batch report

`ledger_template.html` is the report shell (structure agreed 2026-08-15): verdict panel →
World / Watchlist pages (tab switcher) → placeholders → incidents → next lever. Conventions it
encodes, all user-ruled:

- **Every graph/table gets a normalized/absolute toggle** unless there is a specific local reason not to.
- **Every graph/table exists at world level AND watchlist level** (the twelve majors: GBR RUS FRA USA
  PRU TUR AUS SPA BRZ SIC POR NET), the watchlist with **selectable countries** (filter chips).
  **NET was added 2026-08-17** as the port-seed control: the §10.60.3 chain seed converts anchorages
  into level-1 steam-port stubs in the **GBR and FRA markets only**, so the Netherlands is the third
  overseas-empire power that got nothing — the panel is where "does an unseeded colonial empire fall
  behind, and does it snap back when it researches the tech?" is read.
  ⚠⚠ **THE PANEL IS PER-TAG, AND FOR A COLONIAL POWER THAT UNDERSTATES THE ECONOMY IT RUNS.** Subjects
  are separate countries sharing the overlord's market, so their buildings, GDP and production sit on
  *their* tag, not the overlord's. Measured on the Dutch market at 1935 (F67): NET's own books hold 161
  port levels at 39% modern while its **subjects hold 238 at 67% modern** — read the tag alone and the
  Netherlands looks frozen when its market has modernised. The same applies to GBR (the East India
  Company alone carried ~145 anchorages), FRA, SPA and POR. This cost a wrong conclusion on the day NET
  was added. **Any per-country reading of a colonial power's development must be checked against its
  market**, which the save summaries support directly: each country record carries a numeric `market`
  id, so grouping by it is a one-line change. The tag list is defined in
  three places and they must stay identical: `report_data.mjs` (`PANEL`), `report_data2.mjs` (`TAGS`)
  and `ledger_template.html` (`TAGS`). Everything else — chips, flags, per-country charts — is
  derived from that list, so adding a tag is those three lines and nothing more.
- **Per-tag anomaly flags in the legends/headers** (dissolutions, civil-war pop collapses,
  annexation-scale jumps) — computed, never hand-listed, because they decide whether a within-tag
  comparison is reliable.
- **Scope control** (whole economy ⇄ tiered sector) on the decomposition tables; urban centres always
  excluded from "tiered".
- A ratio table/chart always sits beside its absolute twin; contraction-aware measures (employment
  with bracketed deltas) over gross level additions.
- ⭐⭐ **WALL CLOCK IS A FIRST-CLASS ROW, HIGH UP — row `P` in the verdict table plus its own section
  directly beneath it** (user-ruled 2026-08-18). The mod must not make the game materially slower than
  vanilla; **budget 10%**. It is not an afterthought at the bottom, because a mod that is unplayable-slow
  has failed at something no balance number reveals.
  ⚠⚠ **The headline is the POP-MATCHED figure and nothing else**: seconds per in-game year compared
  between arms **at the same `world.pop_objects_live`**, never at the same date and never in total. On our
  own baseline the raw total says the mod is **14% faster** (×0.86) purely because that arm built a third
  of an economy (×0.65 live pops, ×0.61 levels); pop-matched it is **−2.5%**. The naive total is rendered
  on the page *only so it can be dismissed* — never quote it as the result.
  ⚠ Bins where only one arm has samples are shown as `no overlap` and never folded in. If overlap drops
  below ~a third of the bins, the arms did not simulate a comparable economy and wall clock **cannot be
  compared** for that batch — say so rather than falling back to the total.
  ⚠ **The panel is its own `<script>` block with its own `css()` helper, deliberately** — a hard-constraint
  panel must still render when anything else on the page throws. Appended to the main script it silently
  blanked the moment an unrelated renderer failed. Keep it independent (and keep it wrapped in its IIFE:
  the main script declares its own top-level `const css`, and a second one throws).

## Filling it for a new batch

1. Run the three data scripts against the batch (now parameterized: `--session <name>` on analyse_gdp_gap, `--mod <sess/run[,sess/run]>` on report_data + report_data2, `--config <arm config>` for the arm cost book, `--out <dir>`; defaults reproduce the flatcost-n1 fill. Historical note - they were hardcoded to
   `20260815_153825_flatcost-n1` + the `20260813_083557` vanilla baseline — parameterize or edit the
   consts at the top; a proper `--session` flag is the known TODO):
   - `analyse_gdp_gap.mjs` — the world trajectory series (GDP, levels, construction points, labour).
   - `report_data.mjs` — era stocks/additions, paybacks, frontier share, panel GDP.
   - `report_data2.mjs` — the per-country dataset (yearly GDP both arms, labour, tier employment,
     anomaly flags) → `report_data2.json`.
   - **`report_perf.mjs` — the wall-clock / row-`P` data.** Point it at the session(s) holding **both**
     arms (it reads `meta.json` + `save_summaries/`, so nothing extra is instrumented) and it prints the
     naive total, the per-decade rates and the pop-matched verdict:
     `node tools/testbed/ledger/report_perf.mjs <session> [<session2>] --json perf.json`.
     It classifies an arm from `build_state.json`'s `deterministic.arm`, falling back to the folder name,
     and **skips incomplete runs** (L17: a run that stopped early has a meaningless wall clock).
     ⚠ It needs a vanilla arm to compare against. Where a batch has none, run it over the batch **and**
     the pinned vanilla baseline together — but state that the two were not measured on the same night,
     since machine load and game version both move the absolute numbers (the *ratio* is what survives).
1b. Regenerate the template's `PERF` const from `perf.json` (runs, `byDecade`, `matched.bins`,
   `matched.pct`, and the per-run `curve`), then splice it over the existing `const PERF={...}` in the
   perf `<script>` block.
2. The template's inline consts (GDP_FLAT/GDP_VAN/GDP_NB, EMP, PROD_*, TRAJ, LADDER, WATCH, WORLD_*)
   carry the world-level numbers — update them from the scripts' output.
3. Splice the per-country JSON over the `__D2__` token:
   `node -e "...readFileSync(tpl).replace('__D2__', readFileSync('report_data2.json'))..."`
4. Publish as an Artifact (same URL = same report, updated) AND copy to the session folder as
   `REPORT.html` — the annotation lives with the data.

The vanilla baseline stays pinned to `20260813_083557` (n=4) until a game patch breaks comparability.
Collection routes for every metric, including the v13 additions (state_access, construction_queue,
origins phasing), are documented in TESTBED_METRICS.md.
