# The ledger — the standard batch report

The ledger is one HTML report per configuration: one group of runs of one config family, read against vanilla. It is published as an
Artifact and copied into the session folder as `REPORT.html` (CLAUDE.md §5.6). This file is the operator's manual: how to fill it, the
prose it needs, how it is assembled, gated and published, and what each reader behind it computes. A tool's full argument list is in
`REPO_GUIDE.md` (the ledger and readers sections); this file keeps what filling a report needs.

The procedure, in order:

```bash
bash tools/testbed/ledger/fill_ledger.sh <group> <setup> <book> <outName>   # 1. every data script → tools/testbed/ledger/<outName>/
#    2. write the prose by hand: lede / incidents / next / footer .html, tokens.json, title.txt,
#       and redflags_summary.html with the redflag-summary skill
node tools/testbed/ledger/fill_assemble.mjs tools/testbed/ledger/<outName>   # 3. → <outName>/REPORT.html
node tools/testbed/ledger/fill_verify.mjs   tools/testbed/ledger/<outName>   # 4. the gate: exit 0 = publishable
#    5. eyeball it, publish it as an Artifact, copy REPORT.html + redflags_full.html into the session folder
```

Everything runs from the repository root on the user's machine, where the sessions live (`tools/testbed/sessions/` is gitignored and
exists nowhere else). In the fill chain `report_data`, `report_data2`, `analyse_gdp_gap`, `lib_obsolescence` and `lib_goods` hardcode the
Windows repository path (`C:/claude-code/victoria 3 PM and tech rehaul`); the rest read repo-relative paths.

⚠ The ledger scripts are on the batch's build path: `preflight.ps1` walks every `tools/testbed/**/*.mjs` inside each pre-run build, so a
reader added or edited in the checkout a batch runs from can abort the batch (CLAUDE.md §5.1 rule 7; L10, L27). Queue such edits until
`SCHEDULE DONE`.

---

## 1. Fill the data — `fill_ledger.sh`

```bash
bash tools/testbed/ledger/fill_ledger.sh <group> <setup> <book> <outName>
# e.g. bash tools/testbed/ledger/fill_ledger.sh 20261005_154629_jex-n16,20261006_193418_jex-n8-v16 jex config/mod_config.e1a12-ai1135-tex1140-jex-artmerge.json out_jex_n16
```

- **`<group>`** — a session name, or a comma list of session names and/or single `<session>/runNNN_<setup>` folders. Every step reads the
  same usable runs (`lib_runs.usableRuns`: reached its own `until` date with no `abandoned_reason`, not an L34 stub; L17). Exclusions are
  printed with their reason. A run broken on the register is still complete: it stays in, and the prose says so.
- **The group must be one config family** (user-ruled 2026-10-08): the same tier and building structure — enabled industries, rung keys and
  tiers, crafts, merged methods — read from each run's own config by `lib_runs.configFamilies()`. Ladder coefficients and before/after
  builds of a minor fix may pool. The fill stops on more than one family (`ALLOW_MIXED=1` overrides) and prints every distinct config and
  build inside the family; the prose names them.
- **`<setup>`** — the setup name of the arm's runs (`runNNN_<setup>`).
- **`<book>`** — ONE config for costs, tiers and labels in every step. With coefficient variants pooled, pass the book most runs used and
  say so in the prose (`criteria.mjs` reads each run's own config).
- **`<outName>`** — the out dir, created as `tools/testbed/ledger/<outName>/` (`out_*` is gitignored scratch; the session folder is the
  record). The usable run lists land in `_mod.txt` and `_van.txt`.

**References** (`lib_runs.mjs`, the one definition, CLAUDE.md §3.5): every reading is against `VANILLA_REF` (n=24: the summer 18 + the
October 6); the wall clock against `VANILLA_WALL_REF` (the October 6, the most recent same-harness vanilla; F248). The red flags' vanilla
line is the eleven-tag set `20260920_225047_schedule,20260920_192007_schedule` (n=4, v9+ summaries, which price goods) — name it as such.

**The steps, in order.** A step that fails prints `!!! FAILED (<code>): <command>` and the fill goes on; read the log for `FAILED` before
writing prose, because `fill_assemble` stops on any missing output.

| # | step | writes | feeds |
|---|---|---|---|
| 1 | `analyse_gdp_gap.mjs --session --setup --config --out` | `gdp_gap_series.tsv` | nothing on the page; the world trajectory per run and year, for the prose |
| 2 | `report_data.mjs --mod --van --nb none --config --out` | `report_data.json` | the ladder, trajectory and watchlist tables, the tiered-sector GDP (`VA`), G3 |
| 3 | `report_data2.mjs --mod --van --config --out` | `report_data2.json` | the watchlist page (`D2`) |
| 4 | `report_perf.mjs <mod runs> <wall-ref runs> --json perf_raw.json` | `perf_raw.json` | row P |
| 5 | `wall_clusters.mjs "<setup>=<group>:<setup>" "vanilla=<wall ref>:vanilla" --json` | `wall_clusters.json` | row P's clusters |
| 6 | `fill_build_perf.mjs <out>` | `perf_panel.json` | `PERF` |
| 7 | `fill_consts.mjs <out> --mod --van --nb none` | `consts.json` | `GDP_*`, `PROD_*`, `TRAJ`, `WORLD_*`, G5 |
| 8 | `fill_emp.mjs <out> --mod --config` | `emp.json`, `emp_cols.json`, `emp_b2.json` | `EMP`, `EMP_COLS`, `EMP_B2`, G2, G7 |
| 9 | `fill_payback.mjs <out> --mod --config` | `payback.json` | `LADDER`, G2, G3 |
| 10 | `fill_research.mjs <out> --mod --van --config` | `research.json` | `D2.techsT`, `D2.jeT` |
| 11 | `fill_tierchoice.mjs <out> --session --setup --config` | `tierchoice.json` | `TIERC`, G1 |
| 12 | `fill_indecomp.mjs <out> --mod --van --config` | `indecomp.json` | `INDECOMP` |
| 13 | `fill_obsolescence.mjs <out> --session --setup --config` | `obsolescence.json` | `OBS` |
| 14 | `input_price_flags.mjs "<setup>=<group>:<setup>" --ref … --yearly --html redflags_full.html --json redflags.json --list 0` | `redflags_full.html`, `redflags.json` | the red-flag card (via 15) |
| 15 | `redflag_metrics.mjs <out>` | `redflags_metrics.json`, `redflags_digest.md`, `redflags_card.html` | `__REDFLAGS__` |
| 16 | `criteria.mjs --arm "<group>:<setup>" --van "<VANS>:vanilla" --json <out>/criteria.json --quiet` | `criteria.json` | the register (via 17) |
| 17 | `fill_register.mjs <out>` | `register.html` | `__REGISTER__` (the scorecard, §6) |
| 18 | `fill_goals.mjs <out>/goals.html <out> --config` | `goals.html` | `__GOALS__` (the readings: G1, G2, G3, G5, G7) |

**Traps.**
- Run the steps through `fill_ledger.sh`, not by hand. Run alone without flags, several scripts fall back to retired sessions:
  `report_data` / `report_data2` default `--mod` to flatcost-n1 and `--van` to the August n=4 (`20260813_083557`), `fill_consts` to
  canon-n7 and the August n=4, `analyse_gdp_gap` to the August vanilla-vs-mod session, the `analyse_ai_tier_*` tools to canon-n7.
  `fill_emp`, `fill_payback` and `fill_research` throw without `--mod`.
- `input_price_flags` takes whole sessions only: a group with single-run items reads those sessions' every run there. Name whole sessions,
  or check its run count in the output.
- `fill_research.mjs` (fixed 2026-10-26, POLISH A3–A6): it buckets technologies by the tech eras of the BOOK's own tree twin
  (`config/tech_tree_options.<suffix>.json`, required through `--config`) — the mod runs by the mod's eras, the vanilla runs by each
  technology's `vanillaEra` — and reads the vanilla runs `--van` names (default `lib_runs.VANILLA_REF`). Until then it bucketed by the
  retired six-rung tree (`tech_tree_options.canon_n7.json`, gitignored) and read the August n=4 as vanilla. Technology counts for prose
  still come from `tech_census.mjs` (§8.2), which reads the majors.
- **Never edit `fill_ledger.sh` while it runs**: bash reads a script as it goes, and an edit mid-fill breaks every later step.

---

## 2. Write the prose

The shell holds structure; prose that names a year, a country, a run or a number is a token filled from a file, and numbers are consts
derived by a `fill_*.mjs` (`fill_manifest.json`'s `_rule`). Write these into the out dir:

| file | token | what it holds |
|---|---|---|
| `lede.html` | `__LEDE__` | what the batch is for and how to read the register table under it (since §10.104 the table IS `criteria.mjs`'s reading of the same group; the lede names what dominates the loss, the soft and hard breaches, and where the lucky seed stands in, CLAUDE.md §3.2). It names the configs and builds the family check printed. |
| `incidents.html` | `__INCIDENTS__` | the confounds THIS batch carries, naming its own runs: broken runs, crashes and resumes, excluded runs and why, civil wars and collapses behind notches in the charts |
| `next.html` | `__NEXT__` | the lever this batch's numbers point at |
| `footer.html` | `__FOOTER__` | provenance: what was read, how many runs, on what build and game version |
| `redflags_summary.html` | `__RF_SUMMARY__` | 3–15 sentences in one to three `<p>`, written with the **redflag-summary skill** (`.claude/skills/redflag-summary/SKILL.md`) from `redflags_digest.md`; without it the gate refuses the report |
| `title.txt` | `<title>` | the page's title, one line (each batch is its own Artifact; absent, the template's title stands) |
| `tokens.json` | the eleven below | `{"__SESSION__": "…", …}` |

`tokens.json` carries:

| token | means |
|---|---|
| `__SESSION__` | the session folder name(s) |
| `__ARM__` | arm kind + the config and its sha (may hold HTML) |
| `__N__` | runs counted, after L17 exclusions |
| `__GAME__` | the game build every run ran on |
| `__DELTA__` | what the arm changes against the shipped canon (the chip reads "Δ vs shipped") |
| `__BASE__` | the references (VANILLA_REF n=24; wall clock VANILLA_WALL_REF n=6) and whether they ran in the same days |
| `__HEALTH__` | the one-line batch health chip |
| `__ARMLABEL__` | the legend label of this arm's GDP line |
| `__NBLABEL__` | the legend label of a reference series — fill it even when there is none (the token sits in the script either way) |
| `__VANLABEL__` | how the GDP chart names vanilla, e.g. `n=24 median` (`GDP_VAN` is the median of the reference runs) |
| `__SPREAD__` | the sentence after "A median hides the spread —": this batch's per-run GDP ratio range at 1935 and how to read it |

**Token rules.**
- **`__ARMLABEL__`, `__NBLABEL__`, `__VANLABEL__` and `__SPREAD__` land inside single-quoted JavaScript strings.** A straight `'` or a line
  break in one ends the string, the script fails to parse, and every renderer after it stays blank. `fill_assemble` turns a word-internal
  `'` into `’` in every token and warns about any straight quote left; keep these four on one line. The HTML fragments (`lede.html` …) are
  spliced into markup and may use either apostrophe.
- **One configuration per report** (user-ruled 2026-09-13): the ledger compares its arm against vanilla and nothing else — no reference
  series on the GDP chart (`--nb none`), no other arms' rows in the build-choice table (no `fill_tierchoice --baseline`), no other batch's
  numbers in the verdict. Cross-batch remarks go in ONE labelled closing paragraph of the lede ("Cross-reference — other configurations,
  each with its own report"), naming the other reports.
- **Mark a deliberate cross-batch reference** `<code class="xref">…</code>`: the staleness check exempts it and prints it by name. Prose
  left in the shell never wears the class, so the exemption cannot fire by accident.
- **Do not run `fill_tokens.mjs`.** It is a legacy filler with a previous batch's values hardcoded (canon-n7, and a deliberately obvious
  `HEALTH CHIP NOT SUPPLIED` placeholder); `fill_assemble` takes every token from `tokens.json` and the prose files. (The manifest's
  `from` field still names `fill_tokens.mjs` for the seven chip tokens.)
- The analysis rules of CLAUDE.md §5.6 apply to the prose: profit in £, ratios with both terms, the baseline and markets named.

---

## 3. Assemble — `fill_assemble.mjs`

`node tools/testbed/ledger/fill_assemble.mjs <outDir>` (from the repository root: it reads `tools/testbed/ledger/ledger_template.html`
by relative path) writes `<outDir>/REPORT.html`.

- **Reads** `consts.json`, `emp.json`, `emp_cols.json`, `emp_b2.json`, `perf_panel.json`, `report_data.json`, `report_data2.json`,
  `research.json`, `payback.json`, `tierchoice.json`, `indecomp.json`, `obsolescence.json`; any missing file stops it.
- **Splices every const** over the template's line (`const X=…;`); a missing anchor exits 1 (`ANCHOR MISSING`). It never leaves the
  template's shipped values in place, which would publish a previous batch's numbers under this title.
- **Computes three consts itself:** `LADDER` (most-built tier and t0 share from the decade's additions summed over every run; frontier and
  stale payback from `payback.json`; t0 staffing from run 1), `TRAJ` (GDP and levels ÷ vanilla from `consts.json`, construction ÷ vanilla
  as the median over runs) and `WATCH` (seven positional slots: GDP ÷ vanilla · the world's mean stock tier · GBR's · the p25 tag's ·
  non-productive % mod · non-productive % vanilla · frontier share of output %; the tier and share slots from run 1). `VA` comes from
  `report_data.json`; `D2` is `report_data2.json` with `research.json`'s `techsT` and `jeT` added.
- **Splices the tokens** from `tokens.json` plus `lede`, `goals`, `incidents`, `next`, `footer` `.html`. The red-flag card
  (`redflags_card.html`) gets `redflags_summary.html` spliced in before the token map is applied; without the summary it prints a warning
  and the gate will refuse. With no card at all the page says the red flags were not read. An out dir from before 2026-10-08 holding a
  `redflags.html` listing is used as the card if no `redflags_card.html` exists.
- **Prints** the tokens spliced, any token with no source, any straight quote left, the title, and the page size.

⚠ **Never hand-edit `REPORT.html`.** It is an artifact: the next fill overwrites it. Structure goes in the template, prose in the token
files, numbers in a `fill_*.mjs`.

---

## 4. The gate — `fill_verify.mjs`

`node tools/testbed/ledger/fill_verify.mjs <outDir>` reads the finished `REPORT.html` — the artifact, never the generators — against
`fill_manifest.json`. **Exit 0 = safe to publish. Exit 1 = do not publish**; every failure is printed with its fix.

1. **Tokens.** Any manifest token left unfilled, or any `__TOKEN__` the manifest does not know (HTML comments are not scanned).
2. **Consts.** Every required const present and non-empty, and at least its `minKeys` entries. An empty panel is worse than an absent one:
   a reader cannot tell it from a panel of zeroes.
3. **Staleness.** None of `staleness.forbidden` (retired session ids, arm labels and phrases) may appear outside an `xref` code span.
   Add each retired session id and arm label to that list as it is superseded — the list is the gate's memory.
4. **Render, rows, controls.** The page's scripts run under a headless DOM; anything that throws fails (one renderer failing blanks every
   panel after it). Every manifest table must render its `minRows`; every manifest control is clicked and must not throw or take over 2 s
   (an empty series once hung the page).
5. **Every table carries data.** After the controls have run, every element whose id starts `t-` must hold a data row with a nonzero
   digit that is not a year, and every `chart*` element must have drawn something. Generic on purpose: a new panel is covered the day it is
   added.

**Every graph and table is checked working before publishing** (user-ruled 2026-08-24): not "the page renders" — each panel carries
data. Section 5 is the mechanical half; the other half is a person looking at the assembled page in a browser, because the gate catches
zeroes, not nonsense.

The gate was proven by deliberate breakage in each class (a stale string, an emptied const, an unfilled token, a renderer made to throw).
Re-prove it the same way after changing the checker.

---

## 5. Publish

1. **Eyeball the page.** The preview config `ledger` in `.claude/launch.json` serves `tools/testbed/ledger/` read-only on port 8792:
   `http://localhost:8792/<outName>/REPORT.html`. The browser pane cannot open the file directly (too large) nor the published URL (not
   signed in to claude.ai).
2. **Publish `REPORT.html` as an Artifact.** Republishing the same file updates the same URL.
3. **Copy into the session folder** `REPORT.html` (`REPORT_<setup>.html` when the session holds several configs) and `redflags_full.html`
   beside it. The out dir is scratch; the session is the record.
4. Quote the report's link in the batch's finding (CLAUDE.md §5.1 rule 9), as FINDINGS entries do.

---

## 6. What the page shows

**Layout:** the header chips (the seven chip tokens) → the verdict: the red-flag card, THE REGISTER TABLE and the readings table (G1, G2, G3, G5, G7 + P) → section P, the
wall clock, directly beneath it → the **World** and **Watchlist** pages (tab switcher) → incidents → next lever. Rungs are labelled
`e0 … e3`: these are tiers t0–t3 (the identifiers predate the rename, CLAUDE.md §2.3); on a craft book t0 is two columns, `e0 artisans`
and `e0 other`.

### The scorecard: the register, then the readings (BALANCE_FRAMEWORK §10.104, built 2026-10-26)

**The register table** (`__REGISTER__`, `fill_register.mjs` from `criteria.mjs --json`; user-ruled 2026-10-24: *"the register metrics come
later and are better defined and calibrated, so we should mostly be based on them"*). One row per register line, each the consensus ÷ the
vanilla reference, the absolute figure beside vanilla's, the aim / soft / hard band and criteria.mjs's own verdict (at the aim · inside, off the
aim · beyond the soft line · broken): the per-run hard outcome; world GDP (aim from the JSON, soft 0.75–1.33, the derived hard band); **the
decade path** (§10.96: world GDP ÷ vanilla's per-run median at 1846, 1856 … 1936, the median of ALL usable runs, graded only at **1886 against
0.83–1.17**, not in the loss); world W, U*, H; the shortlist's GDP, W, U*, H; PI and PP (PM read only); T0 and T3; the closed-major term with its
lucky seed; the loss with its parts. ⚠ `fill_register.mjs` grades nothing of its own; the bands it restates are §10.83's and move with
`criteria.mjs`.

**The readings table** (`__GOALS__`, `fill_goals.mjs`; the template renders P): what the old goals table measured that the register does not.
Each keeps its band and is a READING, not a register line (turning one into a line is a separate ruling). G4 (world GDP) and G6 (the early game)
are gone — the register's world-GDP line and its decade path carry them; G2 lost its t0 part to the register's T0, G5 its W to the register's W.

| row | goal | graded on | ok | warn | source |
|---|---|---|---|---|---|
| G1 | A tech edge wins markets | unit-weighted share of tiered levels built below the best tier the country holds (raw share and the leader−p25 tier gap beside it) | < 35% | 35–45% (bad > 45%) | the four-rung canon family measured 34.9–40.2%. A below-best level is a fault even when it out-earns the frontier (user-ruled 2026-10-08) |
| G2 | Inefficient producers die (t0: the register's T0) | t1 workers falling every decade from 1920; every t0 part (artisans and t0 factories apart) paying back in ≥ 30 y | both | otherwise | — |
| G3 | Modernising costs capital | construction points added 1880–1935 (median of runs ÷ vanilla mean); frontier-rung payback at £720 a point | ≥ 1× and 8–15 y | 0.9–1×, or 6–8 / 15–20 y (bad beyond) | the floor is vanilla's own manufacturing payback at 1900 (F53); £720 overstates a late payback by ~25% |
| G5 | More product per worker (W: the register's) | GDP per productive worker ÷ vanilla, 1932–36 (W printed beside it) | > 1× | otherwise | — |
| G7 | Tiers arrive on the anchors | the tiers holding half the tiered workers (by descending share, listed until they pass 50%) at 1900 · 1920 · 1935 | every listed tier in the target | one year off (bad: two or more) | target = the latest tier whose anchor has passed plus the next if its anchor is within 5 years (`era_anchor_years` from `--config`): t1/t2 · t2 · t2/t3 |
| P | The game does not get slower | total play time ÷ vanilla, median over clusters 1 + 2 | ≤ +5% | +5–10% (bad > +10%, the ruled budget) | CLAUDE.md §3.4 |

⚠ **Every reading row is positional:** metric A · metric B → value A · value B → target A · target B. A term with no target carries an
explicit em-dash; dropping it re-pairs the surviving values against the wrong targets.

⚠ **The world-GDP chart's and the trajectory / watchlist tables' 0.8–1.25× band** is a rough visual guide, not the target (§10.104, labelled so
on the page); the register's world-GDP lines are read in its table, not drawn on the chart.

### Row P and the wall-clock section

TESTBED_OPERATIONS §7 holds the wall-clock procedure; the page shows its result.
- **The grade is the total play time** (user-ruled 2026-08-31): what a player waits through. Shrinking what the engine simulates is a
  legitimate way to meet the budget. The pill reads faster / no change / acceptable / needs improvement / too slow.
- **Clusters** (user-ruled 2026-10-07): the main figure is the median over clusters 1 + 2; a cluster-3 run (a directly observed listed
  vanilla bug — today the fleet path loop) leaves the grade and is named with its bug. Without `wall_clusters.json` every run counts and
  the page says so.
- **The pop-matched figure is the per-unit diagnostic beside it:** seconds per in-game year compared at equal `world.pop_objects_live`,
  over bins where both arms have samples (`no overlap` bins are shown, never folded in). It answers "is the engine dearer per unit of
  work?", not "did the batch pass?". With overlap under about a third of the bins the arms did not simulate a comparable economy and the
  per-unit figure cannot be compared.
- The sentence under the per-unit number is derived: when the per-unit figure carries at least half the total with the same sign, the gap
  is a dearer (or cheaper) engine; otherwise it is the size of the world.
- Speeds are shown in in-game years per minute (higher is better). The ÷ modelled-cost view is a tripwire (F72's coefficients, fixed in
  `fill_build_perf.mjs`): near 1.0 and flat; a build that lifts it made each unit of world dearer.

### The two pages

Both pages carry **the same panels in the same order** (user-ruled 2026-08-24; the layout may gain panels, never lose them): GDP → the
G4/G5 decomposition (workers × product per worker) → employment in tier buildings by tier (chart + table, decade change in brackets) →
old rungs beside their replacement → industry composition of value added → obsolescence, in-market vs trade → research (technologies held,
journal entries) → build choice. Then page extras — world: the ladder (climb and death), the trajectory ÷ vanilla; watchlist: labour, the
tech edge. A view diverges only for a reason written in its caption; today one does: the watchlist build-choice panel shows world totals.

- **The watchlist** covers 16 tags (GBR RUS FRA USA PRU TUR AUS SPA BRZ SIC POR NET BEL NGF GER UNL) with country chips and a `shortlist`
  button that selects the register's pool (`lib_markets.POOL`: GBR USA FRA NET BEL UNL PRU NGF GER; an absent tag contributes nothing).
  ⚠ It reads the group's FIRST usable run only (`report_data2.json`'s `flat`), and its per-tag anomaly flags (dissolution, a civil war or
  collapse — population −25% in a year —, an annexation-scale jump of +25%) come from that run.
- ⚠ **A per-tag panel understates a colonial power.** Subjects are separate countries sharing the overlord's market, so their buildings and
  GDP sit on their own tags: in F67 the Dutch subjects held 238 port levels at 67% modern against the Netherlands' own 161 at 39%. Check a
  colonial power's development against its market (each country record in a save summary carries a numeric `market` id).
- **Scope control** (whole economy ⇄ tiered sector) applies to the decomposition tables, the industry composition (broad sectors ⇄ the
  industries) and the world GDP chart. The tiered GDP is value added (`va_out − va_in`, at base cost) over the tier buildings; 52 × the
  weekly figure reproduces the save's own GDP to 0.3% (F74), and urban centres are not tier buildings. It needs summary v6+; with fewer than
  5 such years on an arm the chart stays whole-economy and the caption states the coverage, derived from the data.
- **Old rungs beside their replacement** (`t-empb2`, `t-wempb2`): workers on a rung two or more tiers behind a rung their own country
  already staffs in the same industry, world-wide and in the pool, with their share of tier workers. It separates the ladder failing to
  retire a rung from a country that runs nothing newer (CLAUDE.md §3.3).
- **Obsolescence, in-market vs trade** (`t-obs`, `t-wobs`; F161 §4/§6): an old rung is in-market when its own market's supply frontier is
  two tiers above it, trade-only when only the world's is. Per industry and regime: the loss-making share of levels, the true margin,
  staffed ÷ levels, the world price ÷ the rung's break-even, the importers' loss share and signed premium. The watchlist mirror shows the
  selection's shares; a rung's regime is still decided by its own market's and the world's frontier.
- **The red-flag card** (§10.94) is collapsed by default: its summary line carries the two headline numbers per run, median · range —
  **problem market-years** (Σ over the eight major markets, British American French Dutch Belgian German Russian Japanese, of in-game years
  under a HIGH flag on ≥ 10 units/week of building demand, of 800) and **chronic markets** (≥ 20 such years). The table (also split by
  period and market), the summary and the rule line open on a click. ⚠ Basis: the order books price a good with demand and no producer at
  the band edge, the save summaries leave it unpriced, so the two bases read several-fold apart; the vanilla line uses the book's
  summary-basis `prodFlags`. The flag-by-flag listing stays in `redflags_full.html`, off the page. Not a loss term.

**Conventions every panel follows:** a normalised / absolute toggle unless there is a local reason not to; a ratio beside its absolute twin;
contraction-aware measures (employment with bracketed deltas) over gross level additions; per-tag anomaly flags computed, never hand-listed.

---

## 7. The `fill_*` scripts

Each writes one or more files into the out dir; `fill_ledger.sh` runs them in the order of §1.

- **`fill_build_perf.mjs <out>`** → `perf_panel.json` (`PERF`). From `perf_raw.json` (`report_perf`) and `wall_clusters.json`: the complete
  runs with their cluster and bug, speeds by year in in-game years per minute, the pop-matched bins, the grade edges (green 5, yellow 10).
  The `source` line is derived from the run labels. ⚠ It maps `report_perf`'s bins (`{bin, vanilla, mod}`, seconds per year) onto the
  renderer's shape (`{b, v, m, nV, nM}`, years per minute; a side with no samples is null, never 0).
- **`fill_consts.mjs <out> --mod --van [--nb none]`** → `consts.json`: `GDP_FLAT` / `GDP_VAN` / `GDP_NB` (yearly world GDP, median of runs),
  `PROD_FLAT` / `PROD_VAN` (productive workers `w`, GDP `g`, world population `p`, millions), `TRAJ`, `WORLD_FULL` (non-productive adults
  %: unemployed + peasants ÷ workforce) and `WORLD_PURE` (pure unemployment %). **Productive workers** = `population_salaried_workforce −
  population_government_workforce − population_military_workforce`, the save's own fields — the same definition as `advanced_panel` and
  `tiered_panel`; keep the three in step (§10 has the pre-2026-08-20 definition).
- **`fill_emp.mjs <out> --mod --config`** → `emp.json`, `emp_cols.json`, `emp_b2.json`. Tier employment by tier, exact: staffed levels × the
  book's per-level employment × `workforce_mult`. Samples every decade (1840 … 1930, 1935), the first summary of each year per run. The
  columns come from `lib_era_cols.mjs`, shared with `report_data2`'s per-country columns so the two pages cannot disagree: on a craft book t0
  splits into artisans and other (user-ruled 2026-10-02: a craft is meant to fade on its own economics, a t0 factory that survives is the
  ladder failing), and a merge host's workers are shared over its main methods at each method's own tier. `emp_b2.json` is old rungs
  beside their replacement (`countrySplit`), world and pool. ⚠ Columns are LABELS, never indices: with the split, index 2 is t1.
- **`fill_payback.mjs <out> --mod --config`** → `payback.json`, at 1840/1860/1880/1900/1920/1935: frontier and stale (t0) rung payback =
  building cost × £720 ÷ annual profit per level at realised prices, the frontier tier, and the leader−p25 stock-tier gap. On a craft book
  also `staleArt` / `staleOther`, because a craft costs a fiftieth of a factory and employs a tenth; the pooled `stale` stays what the
  ladder table and G2 read, and G2 prints both parts. ⚠ A loss-making rung has no payback: it is counted, never folded into a median as a
  large number.
- **`fill_research.mjs <out> --mod`** → `research.json`: `techsT` (technologies held per tech era and tree, mean per country, world and
  per tag, both arms, from `technologies_held`) and `jeT` (research-entry firings by stage, tree and tech era). Firings are DISTINCT
  `(stage, technology, country)` triples, never raw log lines (raw lines overcount 2.25×, L23). Per-tag firings join `PMR_JE` display names
  to tags through a curated alias map (the L11 hazard); an unknown name is dropped, never guessed. ⚠ The two hardcoded inputs of §1.
- **`fill_tierchoice.mjs <out> --session --setup --config [--label] [--baseline "label|raw|unit|exports|less"]`** → `tierchoice.json`
  (`TIERC`, table `t-tierc`, by decade `t-tierc-dec`). It SPAWNS `analyse_ai_tier_choice.mjs` (raw, unit-weighted and ex-ports below-best
  shares, the decade trajectory) and `analyse_ai_tier_profit.mjs` §c (below-best AND earning less per level than the country's standing
  frontier) and parses their headline lines: one source per number, so a measured quantity is never defined twice. Any parse miss exits 1.
  The two tools qualify country-industry-years slightly differently (~0.5 pp on the raw share); each figure is quoted on its own basis and
  the caption says so. ⚠ `--baseline` rows come FIRST and the arm's row LAST; every reader takes the last row. One configuration per
  report: no `--baseline`.
- **`fill_indecomp.mjs <out> --mod --van --config`** → `indecomp.json` (`INDECOMP`): each tiered industry's weekly value added and the broad
  sectors', world and per tag, both arms, at 1840, 1860, 1880, 1900, 1920 and 1935, absolute £/week so the renderer can follow scope and
  selection. Vanilla reads the same industries through their first rung's key (the vanilla base building). Broad sectors are a regex
  table; anything it misses lands in `other` and is printed by name.
- **`fill_obsolescence.mjs <out> --session --setup --config [--pool 1920,1930,1935] [--override-dir <dir>]`** → `obsolescence.json`
  (`OBS`), from `lib_obsolescence.mjs` (§8.1). Exits 1 if no industry has an in-market or trade-only old rung. Summaries before v11 carry no
  tariffs: to split the trade-only row by tariff and trade policy, re-summarise the kept saves and pass `--override-dir` (re-summaries named
  `<session>__<run>.json.gz`); `trade_obsolescence.mjs` prints those splits.
- **`fill_register.mjs <outDir> [--json <criteria.json>]`** → `register.html` (`__REGISTER__`), the register table of §6 from `criteria.mjs --json`
  (ONE arm, or it exits 1). It grades nothing of its own.
- **`fill_goals.mjs <outFile> <outDir> [--config <book>]`** → `goals.html`, the readings G1, G2, G3, G5, G7 as in §6, from `consts.json`, `payback.json`, `emp.json`,
  `emp_cols.json`, `tierchoice.json` and `report_data.json`. Without `--config` G7 assumes the anchors 1836 / 1875 / 1905 / 1940.
- **`fill_assemble.mjs`, `fill_verify.mjs`** — §3, §4. **`fill_manifest.json`** — the contract between shell and batch: every token
  (`name`, `from`, `required`, `means`), every const (`minKeys`), every table (`minRows`), every control, and the staleness list.
- **`fill_tokens.mjs`** — legacy; do not run (§2).

---

## 8. The readers

### 8.1 Readers the fill runs

- **`analyse_gdp_gap.mjs`** — per run and year: world GDP, levels by class (mod: by tier), construction points delivered, construction
  sector, investment pool, government construction, workforce split, per-tier profit and staffing → `gdp_gap_series.tsv`. Needs `--setup`
  on a session holding several configs.
- **`report_data.mjs`** — tier stocks and additions by decade (every run in `flats`; run 1 in `flat`), construction points per year (all
  runs; vanilla's mean in `vanPtsByYear`), the frontier share, panel GDP and the `VA` block (`{flat, van, nb}` per year in £M/yr, each
  `{tier, all}`, plus coverage counts).
- **`report_data2.mjs`** — the watchlist dataset per tag: yearly GDP and population, labour, tier employment (`lib_era_cols` columns), old
  rungs (`b2`), productive workers (`pw`), the tiered sector (workers and weekly value added, world and per tag), and the anomaly flags. All
  runs are walked (`flatRuns`); the page reads `flat`, run 1.
- **`report_perf.mjs`** — the century's play time per run, rebuilt from the observer's tick lines (`lib_wall.mjs`; each crash-resume's
  reload and replay out; `--wall meta` restores `meta.json`'s `wall_seconds`), the naive total, per-decade rates and the pop-matched bins
  (`--bins`, default 14). A run is vanilla when `build_state.json`'s `deterministic.arm` is `control` or its setup name contains
  vanilla / control; incomplete runs are skipped.
- **`wall_clusters.mjs`** — the three ruled clusters (TESTBED_OPERATIONS §7.4; REPO_GUIDE).
- **`input_price_flags.mjs` → `redflag_metrics.mjs` (`lib_redflag_metrics.mjs`)** — the red flags (§10.94; thresholds and sources in
  REPO_GUIDE). The first-proposed headline forms ("years with a problem in any market", "markets with a problem in ≥ 5 of the 99 two-year
  windows") saturate on the four-rung books and stay in the JSON only.
- **`lib_runs.mjs`** (usable runs, families, the references), **`lib_era_cols.mjs`** (the employment columns, `countrySplit`),
  **`lib_obsolescence.mjs`** (a market's supply frontier = the highest tier with ≥ 10% of its output by `va_out`; staffing alone is not
  death; the premium is a producer price; a merge host is counted by building type), **`lib_markets.mjs`** (the pool, the majors, the
  price-tracked markets) — REPO_GUIDE.

### 8.2 Readers a report quotes by hand

These print to stdout and the prose quotes them; nothing in the fill reads them. Arguments and traps are in REPO_GUIDE.

| reader | what it reads | status |
|---|---|---|
| `criteria.mjs --arm <group>` | the criteria register: consensus, loss, soft and hard lines, the decade path | the register (CLAUDE.md §3.2); since §10.104 the fill runs it (step 16) and the scorecard shows it; run it by hand for the per-run detail |
| `misplaced_capital.mjs --batch <label>:<session>[:<setup>]` | the share of new capital placed far from the best valid alternative (F206/F207) | read in every batch report (CLAUDE.md §3.3) |
| `tech_census.mjs <label>=<group>` | the majors' technology against vanilla, the anchor-principle share | read in every batch report (§3.3) |
| `old_rungs_by_industry.mjs <year> <label>=<group>`, `trade_obsolescence.mjs` | old rungs per industry; the obsolescence census by regime | read in every batch report (§3.3) |
| `dam_slots.mjs <session>[:<setup>]` | dam slot breaches (must be 0), who builds | read in every batch report (§3.3) |
| `first_run_decomp.mjs --arm --van` | GDP = population × W × GDP per productive worker, world and pool | after each arm's first run (§3.3) |
| `batch_tables.mjs --arm <sess[,sess]>:<setup>` | pools ÷ GDP, tiered goods' prices, wage units, British production, GDP ÷ vanilla across sessions | what FINDINGS quotes |
| `ustar_path`, `craft_path`, `us_construction_windows`, `pp_goods`, `rung_fate` | small per-batch readers (F209) | as needed |
| `advanced_panel.mjs`, `tiered_panel.mjs` | §8.3 | as needed |
| `analyse_ai_tier_choice.mjs`, `analyse_ai_tier_profit.mjs`, `analyse_build_allocation.mjs` | §8.4 | as needed |

### 8.3 `advanced_panel.mjs` and `tiered_panel.mjs` — definitions

Both pool a fixed group of advanced majors (default `--group` GBR,USA,FRA,NET,BEL,PRU,GER — no NGF or UNL, unlike `POOL`) and report two
ratios to vanilla (user-ruled 2026-08-20: read beside the world's GDP decomposition). Both are internal to the group, so territory moving
between members cancels (PRU and GER are both listed because one usually becomes the other); territory leaving the group does not, so the
pooled workforce is printed per arm as a composition check.

- **`advanced_panel`** — the whole economy:
  - productive share = productive workers ÷ total workforce, where total workforce = Σ `workforce_by_profession` (= salaried + unemployed
    + peasants, an exact identity) and productive = salaried − government − military workforce (§7, `fill_consts`);
  - productivity = GDP ÷ productive worker.
  It prints group GDP first: GDP per productive worker can rise because employment falls faster than output, which is a different claim
  from producing more.
- **`tiered_panel`** — the same two inside the tiered industries: tiered share = tiered workers ÷ total workforce; productivity = tiered
  value added ÷ tiered worker. Workers are modelled: workers = per-level employment × `workforce_mult` × staffed levels (a summary has no
  per-building headcount; `staffing` counts staffed levels). Mod arms use the book's per-tier employment (one `--config-<n>` per `--arm`,
  never one shared config); vanilla uses its most advanced main method's employment, read live from the game. This is sound because total
  employment per level is constant across an industry's main methods (only the profession mix moves), and where it is not — furniture
  5000→5500, artillery 5000→5250, explosives 10000→4000 — vanilla moves at the same rungs by the same amounts.
  ⚠ Secondary methods are not modelled (automation removes ~1,500 laborers a level), so both arms are overstated; the ratio survives better
  than the level. ⚠ The art academy employs 0 in its base method on both sides (its jobs are in the ownership group), so it adds no workers.
  ⚠ Levels are not arm-comparable where a building is graded; workers and value added are.
- ⚠ `population_subsisting_workforce` is peasants ÷ 100,000 (verified exactly) — a scaled field. Never sum it with the others.

Readings: F76 (canon-n7, aival, aival2) and F78.

### 8.4 `analyse_ai_tier_choice.mjs`, `analyse_ai_tier_profit.mjs`, `analyse_build_allocation.mjs`

All three take `--session <group>` and `--config <path>` (and `--setup` for a session holding several configs); without `--session` they
read canon-n7. They discover runs through `lib_runs.usableRuns` (L17); `session.json`'s `status: ok` is the observer's exit code and not
evidence.

- **`analyse_ai_tier_choice`** — of the levels a country builds, the share going to a tier BELOW the best one it already holds (raw,
  unit-weighted, ex-ports; per decade; per-run spread), and whether the first frontier building breaks the cycle (F75).
- **`analyse_ai_tier_profit`** — the worst industries, normalised: the indefensible case (the frontier pays, a lower rung loses, and the
  loser is still built); §c, the share of all building that is below-best AND to a rung earning less per level than the standing frontier.
- **`analyse_build_allocation`** (`--session`, or `--a <baseline> --b <arm>` with `--config-a` / `--config-b`) — the overshoot check: where
  construction went by sector, industry and tier, and how the split moved between two arms, with a per-industry B/A ratio and the
  industries building at under 0.60× the baseline. The tier-choice measure is within-industry and cannot see a lever that drains whole
  chains, or starves the untiered sector (which registers as a WIN there). Conventions, each of which changed a number when got wrong:
  levels ADDED, never standing levels; removals ignored, never netted; annexation-scale country-years (> +25% levels in a year) excluded
  and counted; raw AND unit-weighted totals; absolute beside normalised; nothing swept into "other" (building groups from vanilla with
  `mod/common/buildings` layered over; anything unsectored printed by name); the UTF-8 BOM stripped before matching top-level blocks
  (without it the first block of every vanilla file — `building_coal_mine`, `building_logging_camp` — is invisible).

---

## 9. Changing the template or a fill script

- **A new panel** needs its const in the manifest (`consts`, with `required` and `minKeys`), its table ids in `tables` (`minRows`) and its
  controls in `controls`; numbers come from a `fill_*.mjs`, prose from a token. Section 5 of the gate covers any `t-…` or `chart…` element
  automatically. Add it to both pages in the same position (§6).
- **The tag list** lives in several places: `report_data.mjs` `PANEL`, `report_data2.mjs` `TAGS` and the template's `TAGS` (identical, 16
  tags; chips, flags and per-country charts derive from them), the template's `SL` (= `lib_markets.POOL`), and the twelve-tag lists of
  `fill_research.mjs` (`TAGS`, `NAME2TAG`) and `fill_indecomp.mjs` (`TAGS`), which still lack BEL, NGF, GER and UNL — those four have no
  per-tag research or industry-composition rows today.
- **Every loop over `cfg.industries` skips `disabled` industries** (L27): a disabled industry keeps its tiers in the config and its rung-0
  key IS the vanilla building, so an unfiltered tier map counts vanilla ports and shipyards as t0 (BUGS_AND_FIXES 2026-09-03). Put the
  guard on the loop line or within the next two: preflight's L27 detector reads that window over every `tools/testbed/**/*.mjs`, and a miss
  fails the next batch build (BUGS_AND_FIXES 2026-09-09).
- **No literal that names a batch.** A caption that states a number is derived from the const its table reads, or it is a token; the gate
  catches an unfilled token and a listed string, never a plausible literal. A script's run list comes from its flags and throws without
  them; a default that is a previous batch produces a believable wrong report. When one script is parameterised, sweep its siblings for the
  same hardcoded value in the same pass (BUGS_AND_FIXES 2026-09-01).
- **Positional rows** (`fill_goals`, `WATCH`, `LADDER`) must match their renderer slot for slot.
- **One source per measured number.** If `analyse_ai_tier_choice` or `analyse_ai_tier_profit` changes a headline line, update
  `fill_tierchoice`'s regexes (a miss exits 1, as it should).
- **Grade every band on both bounds**; a one-sided target says so in its target text.
- **The wall-clock panel is its own `<script>` block, wrapped in an IIFE with its own `css()`**, so it renders when anything else on the
  page throws (the main script declares its own top-level `const css`; a second one would throw).
- **`render1()` is called by the scope buttons as well as the mode buttons**; forgetting a renderer there is how a control silently stops
  applying to one card.
- **A signed speed delta goes through `spd()`** in the template: positive → `+X% slower`, negative → `X% faster` (unsigned; the word carries
  the sign), |x| < 0.05 → `no change`, non-finite → `—`. A signed number with a direction word of its own reads as the opposite
  (`-11.8% slower`).
- After changing `fill_verify.mjs`, re-prove it by breakage (§4).

---

## 10. Reading an older report

Earlier published ledgers are not re-filled; their numbers stand except where listed here.

**Productive workers before 2026-08-20.** `fill_consts.mjs` subtracted the STAFFING of government, university and military buildings —
a count of staffed levels, not people — so "productive workers" was the salaried workforce. Since 2026-08-20 it subtracts the save's own
government and military workforce (user-ruled). World, 1935, canon-n7 (n=6) against the August vanilla (n=4):

| | mod | vanilla |
|---|---|---|
| salaried workforce | 246.5M | 286.5M |
| government + military, the real payroll | 15.6M | 16.3M |
| what the old code subtracted | 12,430 | 13,176 |
| productive workers, old → new | 246.5M → 230.9M | 286.5M → 270.2M |

| ratio | old | new |
|---|---|---|
| productive workers ÷ vanilla (G5) | 0.860× | 0.855× |
| GDP per productive worker ÷ vanilla | 1.004× | 1.011× |

The ratios barely moved because government and military were a near-identical share of both arms (6.3% and 5.7%); the published 0.86× /
1.00× stand to two significant figures. Between arms that differ in military size the old definition would not have survived.

**Other changes an older report carries:**
- Before 2026-09-01: some fills' employment and research tables were canon-n7's, published under another batch's title (BUGS_AND_FIXES
  2026-09-01).
- 2026-08-15 to 2026-09-05: the GDP chart labelled every arm `flat 0.65×` and its reference `×1.5^era`, five captions carried the first
  fill's numbers, the pop-matched table read `no overlap` in every row, and G3's construction ratio was an em-dash (BUGS_AND_FIXES
  2026-09-05).
- Before 2026-09-03: four-rung reports counted the disabled industries' vanilla buildings as t0 (BUGS_AND_FIXES 2026-09-03).
- Before 2026-09-13: G4 was graded on its lower bound only and printed "met" on a 2.10× world (BUGS_AND_FIXES 2026-09-13).
- Before 2026-09-25: the sentence under the per-unit speed figure was fixed text ("a bigger world, not a dearer engine").
- Before 2026-10-08: G1 was graded against 39% (a retired six-rung figure), G3 read run 1's single year 1934→35, G5 graded absolute
  workers, G7 used the six-rung target "t2 · t3 · t3", P's yellow edge was +15% and the runs were not clustered. From 2026-10-03 to
  2026-10-08 the red flags were the full flag-by-flag listing.
