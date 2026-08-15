# The Batch Ledger — reusable per-batch report

`ledger_template.html` is the report shell (structure agreed 2026-08-15): verdict panel →
World / Watchlist pages (tab switcher) → placeholders → incidents → next lever. Conventions it
encodes, all user-ruled:

- **Every graph/table gets a normalized/absolute toggle** unless there is a specific local reason not to.
- **Every graph/table exists at world level AND watchlist level** (the eleven majors: GBR RUS FRA USA
  PRU TUR AUS SPA BRZ SIC POR), the watchlist with **selectable countries** (filter chips).
- **Per-tag anomaly flags in the legends/headers** (dissolutions, civil-war pop collapses,
  annexation-scale jumps) — computed, never hand-listed, because they decide whether a within-tag
  comparison is reliable.
- **Scope control** (whole economy ⇄ tiered sector) on the decomposition tables; urban centres always
  excluded from "tiered".
- A ratio table/chart always sits beside its absolute twin; contraction-aware measures (employment
  with bracketed deltas) over gross level additions.

## Filling it for a new batch

1. Run the three data scripts against the batch (now parameterized: `--session <name>` on analyse_gdp_gap, `--mod <sess/run[,sess/run]>` on report_data + report_data2, `--config <arm config>` for the arm cost book, `--out <dir>`; defaults reproduce the flatcost-n1 fill. Historical note - they were hardcoded to
   `20260815_153825_flatcost-n1` + the `20260813_083557` vanilla baseline — parameterize or edit the
   consts at the top; a proper `--session` flag is the known TODO):
   - `analyse_gdp_gap.mjs` — the world trajectory series (GDP, levels, construction points, labour).
   - `report_data.mjs` — era stocks/additions, paybacks, frontier share, panel GDP.
   - `report_data2.mjs` — the per-country dataset (yearly GDP both arms, labour, tier employment,
     anomaly flags) → `report_data2.json`.
2. The template's inline consts (GDP_FLAT/GDP_VAN/GDP_NB, EMP, PROD_*, TRAJ, LADDER, WATCH, WORLD_*)
   carry the world-level numbers — update them from the scripts' output.
3. Splice the per-country JSON over the `__D2__` token:
   `node -e "...readFileSync(tpl).replace('__D2__', readFileSync('report_data2.json'))..."`
4. Publish as an Artifact (same URL = same report, updated) AND copy to the session folder as
   `REPORT.html` — the annotation lives with the data.

The vanilla baseline stays pinned to `20260813_083557` (n=4) until a game patch breaks comparability.
Collection routes for every metric, including the v13 additions (state_access, construction_queue,
origins phasing), are documented in TESTBED_METRICS.md.
