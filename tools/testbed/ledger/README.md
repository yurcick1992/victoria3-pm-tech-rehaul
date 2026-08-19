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
- **Scope control** (whole economy ⇄ tiered sector) on the decomposition tables **and, since 2026-08-18,
  on the world GDP chart**; urban centres always excluded from "tiered".
  ⭐ **The GDP card's exception is gone (F74).** A save persists no per-sector GDP, so world GDP used to
  sit outside the control with a stated exception. It does not any more: value added = outputs − inputs at
  BASE cost, and 52 × that reproduces the save's own `gdp` to **0.3 %**, so the tiered slice is the same
  quantity restricted to our tier buildings (urban centres are not tier buildings, so the exclusion holds
  by construction). `report_data.mjs` emits a **`VA`** block — `{flat, van, nb}` per year in £M/yr, each
  `{tier, all}`, plus a `cov` coverage count — and the template plots it under the tiered scope.
  ⚠⚠ **IT DEGRADES, AND THE DEGRADED NOTE IS DERIVED, NEVER WRITTEN.** `va_out`/`va_in` ship in
  **`SAVE_SUMMARY_VERSION = 6`** and *nothing harvested before 2026-08-18 carries them*; the past cannot be
  backfilled, because those saves are reaped. With fewer than **5** years on either arm the chart stays
  whole-economy and the caption states the actual coverage (`mod 0/200 (summaries v5), vanilla 0/400
  (summaries v4)` on canon-n2 + the pinned baseline — measured, not assumed). The note therefore
  **disappears by itself** the first time a v6-harvested batch is read, which is the property a
  hand-written caveat never has. Both paths were exercised before shipping: the real (empty) data prints
  the note, a synthetic 20-year series draws the chart.
  ⚠ `render1()` is called by the scope buttons as well as the mode buttons. Forgetting that is exactly how
  a control silently stops applying to one card — which is the defect this change removed.
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

## ⛔ THE GATE: `fill_manifest.json` + `fill_verify.mjs` (2026-08-19)

**Run `node tools/testbed/ledger/fill_verify.mjs <dir>` before publishing. Exit 0 = safe. Exit 1 = do
not publish.** It reads the finished REPORT.html - the artifact, never the generators - and checks:

1. **Every token filled.** Any `__TOKEN__` left, or one the manifest does not know about.
2. **Every const present and NON-EMPTY**, against `minKeys`. An empty panel is worse than an absent
   one, because a reader cannot tell it from a panel of zeroes.
3. **Staleness.** A list of retired session ids and arm labels that must NOT appear. ⚠ Add to
   `staleness.forbidden` as each batch is superseded - that list is the memory.
4. **The page renders**, under a headless DOM: anything that throws is caught, because one renderer
   failing blanks every panel after it.
5. **Every table has rows** and **every control runs** - with a 2 s watchdog, since an empty series
   once hung the page outright.

**WHY IT EXISTS.** Two failures kept recurring and neither was visible on the finished page: the
flatcost batch’s incidents and its “next lever” (built on an OVERSHOOT) were republished verbatim
under a batch that UNDERSHOOTS, and three data sections rendered as empty tables. Both were found by
a human reading the page, which is exactly the review a gate should not depend on.

⚠ **Proven by deliberate breakage**, all four classes: stale string, emptied const, unfilled token,
and a renderer made to throw. Re-prove it if you change the checker.

⚠⚠ **NEVER HAND-EDIT REPORT.html.** It is an artifact: the next fill overwrites it. Structure goes in
the template, prose in the token files (`lede/goals/incidents/next/footer.html`), numbers in a
`fill_*.mjs`. If a paragraph names a year, a country, a run or a number, it is a TOKEN, not shell.

## The `fill_*.mjs` scripts (added 2026-08-19, canon-n7)

`report_data2.mjs` emits **none of `techsT`, `jeT` or `sector`**, and nothing computed the verdict
table’s own numbers, so those panels were being published EMPTY. These derive them straight from the
save summaries, and are parameterised only by the run list at the top of each file:

- **`fill_consts.mjs`** — GDP_FLAT / GDP_VAN / GDP_NB, PROD_*, TRAJ, WORLD_FULL, WORLD_PURE. Medians
  across the arm’s runs. Productive workers = salaried workforce minus government and military
  staffing, taken off the buildings, which is the panel’s own definition.
- **`fill_emp.mjs`** — EMP, tier employment by era: staffed levels × the config’s own per-tier
  employment × `workforce_mult`. EXACT, not proxied; an earlier proxy (levels × people-per-level ×
  staffing off report_data) came out ~4× low and was thrown away rather than published.
- **`fill_payback.mjs`** — frontier and stale rung payback (build cost × £720 ÷ annual profit per level,
  at realised prices) and the leader−p25 stock-era gap. ⚠ A loss-making rung has NO payback and is
  counted, never folded into a median as a large number (the `vanilla_payback_census` rule).
- **`fill_research.mjs`** — `techsT` (technologies held per era/tree, mean per country, both arms from
  `technologies_held`) and `jeT` (journal entries). ⚠⚠ **JE firings are DISTINCT `(stage, technology,
  country)` triples, never raw log lines** — landmine **L23** measured raw lines overcounting 2.25×.
- **`fill_build_perf.mjs`** — the PERF const from `perf_raw.json` (see the shape warning below).
- **`fill_goals.mjs`** — the verdict rows. ⚠ **Every row reads POSITIONALLY**: metric A · metric B →
  value A · value B → target A · target B. A term with no agreed target carries an explicit em-dash;
  dropping it re-pairs the surviving values against the WRONG targets, which is how a construction
  ratio came to be printed against a payback in years.
- **`fill_assemble.mjs`** — splices the lot into the template and writes REPORT.html.

⚠ They are not yet a single command, and their run lists are edited per batch — same known TODO as
`--session`. Everything they emit is a median over the arm’s COMPLETE runs; an L17-incomplete run is
excluded by hand from the run list, so check `preflight.ps1 -Session` before filling.

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
2b. **Splice the `VA` block** over the line marked `// __VA__` in the template (replace that whole
   `const VA={flat:{},…};` line with `const VA=` + report_data.json's `VA` + `;`). The empty default in
   the template is deliberate and safe — an unfilled report shows the whole-economy chart plus the
   coverage note, which is the same degraded behaviour the filled version falls back to — so this step
   can never break the page, only leave the tiered GDP view unavailable.
3. Splice the per-country JSON over the `__D2__` token:
   `node -e "...readFileSync(tpl).replace('__D2__', readFileSync('report_data2.json'))..."`
4. Publish as an Artifact (same URL = same report, updated) AND copy to the session folder as
   `REPORT.html` — the annotation lives with the data.

The vanilla baseline stays pinned to `20260813_083557` (n=4) until a game patch breaks comparability.
Collection routes for every metric, including the v13 additions (state_access, construction_queue,
origins phasing), are documented in TESTBED_METRICS.md.
