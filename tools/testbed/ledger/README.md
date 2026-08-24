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
- **`fill_tierchoice.mjs`** — the **Build choice panel** (`TIERC`, table `t-tierc`; user-ruled INTO
  the layout 2026-08-24 — the layout may gain panels, never lose them): the share of tiered
  construction below the best tier the country holds (raw / unit-weighted / ex-ports, on
  `analyse_ai_tier_choice.mjs`'s F75/F76-family basis) **and the sharper cut — below-best AND
  earning LESS per level than that country's standing frontier** (`analyse_ai_tier_profit.mjs`
  section (c)). It SPAWNS the two analyse tools and parses their headline lines — one source per
  number, because re-deriving either here would be a second definition of a measured quantity (the
  `ladderFaults()` lesson); any parse miss exits 1. `--baseline "label|raw|unit|exports|less"`
  adds prior batches' published rows. ⚠ The two tools qualify country-industry-years slightly
  differently (~0.5pp on the raw share); each figure is quoted on its own basis and the caption
  says so. First fills: canon-n7 52.6/54.1/55.3/30.8 · solver2c 39.8/42.3/44.6/**27.9**.
- **`fill_assemble.mjs`** — splices the lot into the template and writes REPORT.html.

⚠ They are not yet a single command, and their run lists are edited per batch — same known TODO as
`--session`. Everything they emit is a median over the arm’s COMPLETE runs; an L17-incomplete run is
excluded by hand from the run list, so check `preflight.ps1 -Session` before filling.

## Filling it for a new batch

1. Run the three data scripts against the batch (now parameterized: `--session <name>` on analyse_gdp_gap, `--mod <sess/run[,sess/run]>` on report_data + report_data2, **`--van` / `--nb` `<sess/run[,...]>` on both since 2026-08-24** — the vanilla-baseline and reference-arm run lists, so a fill can point at the n=18 ensemble instead of the pinned n4 — `--config <arm config>` for the arm cost book, `--out <dir>`; defaults reproduce the flatcost-n1 fill. Historical note - they were hardcoded to
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

---

## The analysis scripts (as distinct from the `fill_*` scripts)

`fill_*.mjs` fill the report template. These three answer questions, print to stdout, and are quoted
into a report by hand:

| script | question |
|---|---|
| `analyse_ai_tier_choice.mjs` | Of the levels a country builds, what share go to a tier BELOW the best one it already holds? Does the first frontier building break the cycle? (F75) |
| `analyse_ai_tier_profit.mjs` | Which industries are worst, normalised — the indefensible case (the frontier pays, a lower rung loses, and the loser is still built) — and, since 2026-08-24, **section (c)**: the share of ALL building that is below-best AND to a rung earning less per level than the standing frontier (the Build choice panel's sharper column). |
| `analyse_build_allocation.mjs` | ⭐ **THE OVERSHOOT CHECK.** Where did construction actually go, by sector / industry / era, and how did that split move between two arms? |

**All three take `--session <stamp>` and `--config <path>`, and with no arguments reproduce the
canon-n7 baseline** (52.6% below-best, 54.1% unit-weighted, 55.3% excluding ports, 62,285 qualifying
country-industry-years). The `fill_*` scripts still hardcode their session; that TODO stands.

### ⚠ They no longer take a run list, and that is the point

`lib_runs.mjs`'s `usableRuns()` **discovers** the run folders and keeps only those that reached their
own `until` date carrying no `abandoned_reason` — landmine **L17**. `status: ok` in `session.json` is
derived from the observer's exit code, and the observer exits 0 even when it abandons a run, so it is
not evidence; each run's own `meta.json` is. Exclusions are **printed with their reason**, because a
silent exclusion is indistinguishable from a run that never existed.

The hardcoded `RUNS = [1,2,3,4,5,6]` these replaced was correct only by hand and only for canon-n7: it
happened to stop before that batch's abandoned seventh run, and would have swallowed it the moment
anyone re-pointed the script at another session.

### Why `analyse_build_allocation.mjs` exists

The tier-choice measure is **within-industry**. A lever that raises the desire of high tiers can move
it and still be a failure in two ways that measure cannot see:

- **between industries** — tier-4 automotive at `ai_value` 2500 outbids tier-2 textile at 1500, so the
  construction budget drains out of whole chains instead of climbing each chain's rungs;
- **out of the untiered sector** — extraction, agriculture, ranching and fishing carry no `ai_value`
  change at all, so **starving them registers as a WIN** on the tier-choice metric.

So it reports the sector / industry / era split of every level **added**, absolute beside normalized,
with a per-industry `B/A abs` ratio and a list of industries now building at under 0.60× the baseline.

Conventions it follows, each of which changed a number when it was got wrong:

- **Levels added, never standing levels** — a standing count confounds building with inheriting.
- **Removals ignored, never netted** — demolition is a different decision, and netting makes a
  shrinking industry indistinguishable from an unbuilt one.
- **Annexation-scale country-years excluded** (>+25% total levels in one year), same rule as the
  tier-choice analysis; the count is reported.
- **Raw AND unit-weighted totals**, because ports are graded (`workforce_mult` 0.1/0.2) and a ladder
  that looks like it moved infrastructure may only have moved the unit.
- **Absolute beside normalized on every table** — a share that rises because its numerator grew and one
  that rises because everything else collapsed are different results.
- **Nothing is swept into "other"**: building groups come from vanilla with `mod/common/buildings`
  layered over (the all-new steamer chain has no vanilla anchor), and anything still unsectored is
  reported by name with its level count.
- ⚠ **The UTF-8 BOM is stripped before matching top-level blocks.** Without it the FIRST block of every
  vanilla file is invisible — the trap `verify_pms.mjs` documents for production methods — and here it
  loses `building_coal_mine` and `building_logging_camp`, two of the raw industries the whole analysis
  is about.

---

## `advanced_panel.mjs` — the productivity claim, read where it is visible

**User ruling, 2026-08-20: report these two alongside the world's 1935 GDP decomposition, every
batch.** Pooled over **GBR USA FRA NET BEL PRU GER**:

1. **productive share** = productive workers ÷ total workforce, ÷ vanilla
2. **productivity** = GDP ÷ productive worker, ÷ vanilla

**Why pooled, and why these tags.** The world reading is dominated by countries that never
industrialise; the per-tag reading is dominated by SIZE. Whether France holds Piedmont or the
Rhineland barely changes how industrialised France is, but it moves the worker count a lot. Both
metrics here are ratios INTERNAL to the group, so territory moving between members cancels — and PRU
and GER are both listed precisely because one usually becomes the other.

⚠ Territory leaving the group entirely does **not** cancel. The tool prints the pooled workforce per
arm as a composition check; read any ratio move against it.

### The definitions, and why they are not the ledger's

```
total workforce = Σ workforce_by_profession   ( = salaried + unemployed + peasants, exact identity )
productive      = population_salaried_workforce
                    − population_government_workforce − population_military_workforce
```

⚠⚠ **The ledger's existing G5 row subtracts the STAFFING of government/university/military
BUILDINGS, and that field is a levels-scale quantity, not a headcount.** For Britain at 1935 it is
**677** against the save's own gov+military workforce of **1,204,779** — five thousandths of one
percent. So the published *"productive workers ÷ vanilla = 0.86×"* is, to four decimals, the salaried
workforce ratio under a label it does not earn. `advanced_panel.mjs` computes both (`direct` and
`legacy`); the legacy pair is printed only to connect to what is already published, never as a second
opinion. **`fill_consts.mjs` should be moved onto the direct fields** — not done yet, because it would
silently restate a number the shipped report already quotes.

⚠ `population_subsisting_workforce` is peasants ÷ 100,000 (verified exactly) — a scaled field, not a
headcount. Never sum it with the others.

### GDP is printed FIRST, and that is deliberate

"GDP per productive worker" is a ratio, and quoting it alone invites the reading that the mod produces
more. It does not: pooled group output sits at or slightly below vanilla's and **employment falls
faster**, which is what lifts the quotient. Labour released rather than output added is the design
goal — but it is a different claim, and it must not arrive disguised as the other one.

### What it read on 2026-08-20

| arm | group GDP ÷van | productive share ÷van | £/productive worker ÷van |
|---|---|---|---|
| vanilla (n=4) | — (£1,366M) | — (73.16%) | — (£19.3) |
| canon-n7 (n=6) | 0.945× | 0.972× | **1.143×** |
| aival-n4 (n=4) | 0.984× | **0.912×** | **1.113×** |

Against the **world** figures for the same batches (1.01× and 1.03× productivity), the advanced-majors
lens is far sharper and both mod arms clear G5's ≥1.11× target that the world reading misses.

⚠ **Variance is large and must be quoted with it.** Productive share sd: vanilla 7.59pp, aival 6.64pp,
canon-n7 **14.65pp** — the last inflated by canon-n7 run003, a collapsed world (group GDP £379M against
£1,155–1,846M elsewhere, 57.6M workforce against 76–100M). Productivity sd 0.87 / 1.40 / 1.95 on
medians near £20, i.e. ~5–9%. **The aival-vs-canon differences on both metrics are inside that.**

---

## `tiered_panel.mjs` — the same two, restricted to the tiered industries

Same pooled shortlist, same two questions, but inside the 22 industries the mod actually reshapes —
which is where a tier ladder can be expected to show up at all. The whole-economy figure includes
farms, mines, barracks, manor houses and urban centres, none of which the ladder touches.

### Workers are MODELLED, and here is why that is sound

A save summary has **no per-building headcount**. `staffing` is a count of STAFFED LEVELS, not people
(government administration: 234 levels, staffing 223.15). So

```
workers = per-level employment × workforce_mult × staffed levels
```

⭐ **Total employment per level is constant across an industry's main PMs** — only the profession mix
moves. Our config reads 5000 at every rung of textile/food/glass/tooling/steel/…, 1000 at every rung of
power/port/railway, and **vanilla's own main PMs read the same numbers**, checked live against
`common/production_methods`. Three industries are not flat — furniture 5000→5500, artillery
5000→5250, explosives 10000→4000 — and **vanilla moves at the same rungs by the same amounts**. So the
vanilla side uses the employment of the most advanced `vanilla_pm` in each chain (these are advanced
majors at 1935; they run it), and the comparison is derived rather than assumed.

⚠ **Secondary PMs are not modelled.** Automation removes ~1500 laborers a level and the summary does
not say which secondaries are active, so both sides are overstated. The bias points the same way on
both arms, so the ratio survives better than the level.
⚠ `art_academy` employs 0 in its base PM on both sides (its jobs live in the ownership PMG, which the
summary does not break out), so it contributes no workers to either — consistently, not silently.

### ⚠⚠ Value added is MOD-ARMS-ONLY and cannot be backfilled

`va_out`/`va_in` ship in **SAVE_SUMMARY_VERSION 6** (2026-08-18). The pinned vanilla baseline
`20260813_083557` is **v4**; a scan of every session since 2026-08-10 finds **no vanilla arm above
v5**, and the saves behind them are reaped. Metric 2 therefore has no vanilla denominator today. The
**2026-08-22/23 vanilla runs will be v6 and close it** — that is the first batch on which "tiered
productivity ÷ vanilla" becomes answerable at all.

### What it read on 2026-08-20

| arm | tiered share of workforce | ÷van | £VA per tiered worker | tiered share of all VA |
|---|---|---|---|---|
| vanilla (n=4) | 28.71% (sd 2.16pp) | — | n/a (v4) | n/a |
| canon-n7 (n=6) | 31.43% (sd 6.97pp) | 1.095× | £30.8 (sd 4.9) | 69.11% |
| aival-n4 (n=4) | 29.06% (sd 4.87pp) | 1.012× | £32.5 (sd 1.8) | 66.76% |

⭐ **Two-thirds of all value added in the advanced majors comes from the tiered industries** — the
sector the mod reshapes is the economy in exactly the countries that matter.

⚠ **The mod puts MORE labour into the tiered sector than vanilla, not less** (1.01× and 1.10×). The
whole-economy productivity gain is therefore not coming from a leaner tiered sector; it is coming from
elsewhere in the economy. That is worth a separate look.

⚠ The LEVELS column in section 3 is **not arm-comparable** — the mod's ports are graded, so one vanilla
port is ten mod port levels. Workers correct for it via `workforce_mult`, and value added is money, so
those two are comparable. Read levels within an arm only.

### The per-industry table's own finding

Three industries run **negative value added per worker** in both mod arms: `shipyard_steam` (−£25),
`power` (−£15), `shipyard` (−£11) — inputs cost more than outputs at market prices. Shipyards are
expected (naval construction is unmodelled and they carry a −30pp handicap by design); **power is not**,
and `automotive` at £1–3 is barely above zero. Highest are `explosives` £58, `electrics` £58,
`fertilizer` £51. `tooling` is the largest employer by far at ~5.4M workers.

---

## ⚠ `fill_consts.mjs` — the "productive workers" definition was CORRECTED on 2026-08-20

**User-ruled.** Reports published **before 2026-08-20 carry the old definition.** This section exists so
the two are reconcilable rather than merely different.

### What was wrong

It derived government + military payrolls from the **staffing of government/university/military
BUILDINGS**. `staffing` in a save summary is a count of **staffed levels, not people**. Measured at
1935, world:

| | mod (canon-n7, n=6) | vanilla (n=4) |
|---|---|---|
| salaried workforce | 246.5M | 286.5M |
| gov + military, the **real** payroll | 15.6M | 16.3M |
| **what the old code actually subtracted** | **12,430** | **13,176** |

It removed about **eight hundredths of one percent** of the payroll it named. "Productive workers" was
the salaried workforce with a label it did not earn.

### The fix

```
productive = population_salaried_workforce
               − population_government_workforce − population_military_workforce
```

Both fields are booked directly by the save. Same definition as `advanced_panel.mjs` and
`tiered_panel.mjs`; **keep the three in step.**

### ⭐ What it changes, and the honest surprise: almost nothing

| | OLD | NEW |
|---|---|---|
| productive workers, mod | 246.5M | **230.9M** |
| productive workers, vanilla | 286.5M | **270.2M** |
| **workers ÷ vanilla (the G5 row)** | **0.860×** | **0.855×** |
| **GDP per worker ÷ vanilla** | **1.004×** | **1.011×** |

The **absolute** figures move by ~16M workers each. The **ratios** — which is all G5 reports — move by
0.5pp and 0.7pp, inside the rounding the report already used.

**Why:** gov + military are **6.3% of the mod's salaried workforce and 5.7% of vanilla's**. Subtracting
a near-identical share from both numerator and denominator leaves the ratio almost untouched.

⇒ **The published G5 figure was right by luck, not by construction.** The label was wrong and the
arithmetic was wrong; the number survived because the error was nearly common-mode. Had the two arms
differed in military size — a war-heavy arm, or a conscription-law change — it would not have survived,
and nothing in the old code would have signalled that.

**Nothing published needs retracting.** `canon-n7`'s shipped 0.86× / 1.00× stands to two significant
figures under the corrected definition (0.855× / 1.011×).
