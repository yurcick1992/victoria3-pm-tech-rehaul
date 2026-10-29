# The ledger — the standard batch report (the canonical form since 2026-10-29, BALANCE_FRAMEWORK §10.104.1)

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

**References** (`lib_runs.mjs`, the one definition, CLAUDE.md §3.5): every reading is against `VANILLA_REF` (n=40 since 2026-10-26: the
summer 18, the October 6 and the alternating batch's 16); the wall clock and the red flags' vanilla line against `VANILLA_WALL_REF` (the
alternating batch's vanilla n=16, the most recent same-harness vanilla, which reads the order books like the arm; F248, F249).

**The steps, in order.** A step that fails prints `!!! FAILED (<code>): <command>` and the fill goes on; read the log for `FAILED` before
writing prose, because `fill_assemble` stops on any missing output.

| # | step | writes | feeds |
|---|---|---|---|
| 1 | `analyse_gdp_gap.mjs --session --setup --config --out` | `gdp_gap_series.tsv` | nothing on the page; the world trajectory per run and year, for the prose |
| 2 | `report_data.mjs --mod --van --nb none --config --out` | `report_data.json` | the ladder and trajectory tables, the tiered-sector GDP (`VA`), the scorecard's construction line |
| 3 | `report_data2.mjs --mod --van --config --out` | `report_data2.json` | the Shortlist page (`D2`) |
| 4 | `report_perf.mjs <mod runs> <wall-ref runs> --json perf_raw.json` | `perf_raw.json` | the play-time block |
| 5 | `wall_clusters.mjs "<setup>=<group>:<setup>" "vanilla=<wall ref>:vanilla" --json` | `wall_clusters.json` | the play-time clusters |
| 6 | `fill_build_perf.mjs <out>` | `perf_panel.json` | `PERF` (with the per-session ratios), the scorecard's play-time line |
| 7 | `fill_consts.mjs <out> --mod --van --nb none` | `consts.json` | `GDP_*`, `PROD_*`, `TRAJ`, `WORLD_*`, GDP per productive worker |
| 8 | `fill_emp.mjs <out> --mod --config` | `emp.json`, `emp_cols.json`, `emp_b2.json` | `EMP`, `EMP_COLS`, `EMP_B2`, the tier-1 and anchors lines |
| 9 | `fill_payback.mjs <out> --mod --config` | `payback.json` | `LADDER`, the payback lines |
| 10 | `fill_research.mjs <out> --mod --van --config` | `research.json` | `D2.techsT`, `D2.jeT` |
| 11 | `fill_tierchoice.mjs <out> --session --setup --config` | `tierchoice.json` | the "built below the best tier" line |
| 12 | `fill_indecomp.mjs <out> --mod --van --config` | `indecomp.json` | `INDECOMP` |
| 13 | `fill_obsolescence.mjs <out> --session --setup --config` | `obsolescence.json` | `OBS` (the collapsed in-market vs trade detail) |
| 14 | `input_price_flags.mjs "<setup>=<group>:<setup>" --ref … --yearly --html redflags_full.html --json redflags.json --list 0` | `redflags_full.html`, `redflags.json` | the red-flag card (via 15) |
| 15 | `redflag_metrics.mjs <out>` | `redflags_metrics.json`, `redflags_digest.md`, `redflags_card.html` | `__REDFLAGS__`, the scorecard's shortage line |
| 16 | `criteria.mjs --arm "<group>:<setup>" --van "<VANS>:vanilla" --json <out>/criteria.json --quiet` | `criteria.json` | the register's lines, the two charts above the pages |
| 17 | `laggard_pressure.mjs <book> "<setup>=<group>:<setup>" "vanilla=<VANS>:vanilla" --json <out>/laggards.json` | `laggards.json` | the two backward-industry lines |
| 18 | `tech_census.mjs "<setup>=<group>:<setup>" "vanilla=<VANS>:vanilla" --tree <twin> --json <out>/tech.json` | `tech.json` | the technology lines |
| 19 | `misplaced_capital.mjs --batch "<setup>:<group>:<setup>" --json <out>/misplaced.json` | `misplaced.json` | the misplaced-capital line (mod only) |
| 20 | `fill_old_plants.mjs <out> --mod --config` | `old_plants.json` | `OLDP` (the old-plant table, both pages) |
| 21 | `fill_scorecard.mjs <out> --config` | `scorecard.html`, `scorecard_loss.html`, `intro.json` | `__SCORECARD__`, `__LOSS__`, `INTRO` |

**Traps.**
- Run the steps through `fill_ledger.sh`, not by hand. Since 2026-10-28 no step falls back to a retired session: `report_data`,
  `report_data2` and `fill_consts` refuse to run without `--mod` and `--van`, `analyse_gdp_gap` and the `analyse_ai_tier_*` tools without
  `--session`, and `fill_emp`, `fill_payback` and `fill_research` without `--mod` (they used to default to flatcost-n1, canon-n7 and the
  August vanilla n=4).
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
| `lede.html` | `__LEDE__` | ONE paragraph after the template's fixed preface (observer runs, no player): what this batch compares against what, and why the wall clock reads a different vanilla set than the economy. It names the configs and builds the family check printed. Every measured reading is a scorecard line, not prose (§10.104.1); a table written here is wrapped in a scrolling box by `fill_assemble`. |
| `incidents.html` | `__INCIDENTS__` | "What disturbed the runs": the confounds THIS batch carries, naming its own runs — broken runs, crashes and resumes, excluded runs and why, civil wars and collapses behind notches in the charts |
| `footer.html` | `__FOOTER__` | provenance: what was read, how many runs, on what build and game version, which reader each line comes from |
| `redflags_summary.html` | `__RF_SUMMARY__` | 3–15 sentences in one to three `<p>`, written with the **redflag-summary skill** (`.claude/skills/redflag-summary/SKILL.md`) from `redflags_digest.md`; without it the gate refuses the report |
| `title.txt` | `<title>` | the page's title, one line (each batch is its own Artifact; absent, the template's title stands) |
| `tokens.json` | the twelve below | `{"__SESSION__": "…", …}` |

`tokens.json` carries:

| token | means |
|---|---|
| `__HEADLINE__` | the page's heading, in words a reader outside the project understands ("The 1.0 canon against vanilla") |
| `__SUBTITLE__` | one line under it: the runs compared, the span, the game version, the date read |
| `__SESSION__` | the session folder name(s) (footer) |
| `__ARM__` | arm kind + the config and its sha, may hold HTML (footer) |
| `__N__` | runs counted, after L17 exclusions (footer) |
| `__GAME__` | the game build every run ran on (footer) |
| `__DELTA__` | what the arm changes against the shipped canon (footer: "Changed against the shipped canon") |
| `__BASE__` | the references (VANILLA_REF n=40; wall clock VANILLA_WALL_REF) and whether they ran in the same days (footer) |
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
  series on the GDP chart (`--nb none`), no `fill_tierchoice --baseline` rows (the scorecard reads the last row), no other batch's numbers
  in the scorecard. Cross-batch remarks go in ONE labelled closing paragraph of the lede ("Cross-reference — other configurations,
  each with its own report"), naming the other reports.
- **Mark a deliberate cross-batch reference** `<code class="xref">…</code>`: the staleness check exempts it and prints it by name. Prose
  left in the shell never wears the class, so the exemption cannot fire by accident.
- **Tokens come from `tokens.json` alone**: `fill_assemble` takes every token from it and the prose files. The legacy `fill_tokens.mjs`,
  which carried a previous batch's values hardcoded (canon-n7), was removed on 2026-10-28.
- The analysis rules of CLAUDE.md §5.6 apply to the prose: profit in £, ratios with both terms, the baseline and markets named.

---

## 3. Assemble — `fill_assemble.mjs`

`node tools/testbed/ledger/fill_assemble.mjs <outDir>` (from the repository root: it reads `tools/testbed/ledger/ledger_template.html`
by relative path) writes `<outDir>/REPORT.html`.

- **Reads** `consts.json`, `emp.json`, `emp_cols.json`, `emp_b2.json`, `perf_panel.json`, `report_data.json`, `report_data2.json`,
  `research.json`, `payback.json`, `indecomp.json`, `obsolescence.json`, `old_plants.json`, `intro.json`; any missing file stops it.
- **Splices every const** over the template's line (`const X=…;`); a missing anchor exits 1 (`ANCHOR MISSING`). It never leaves the
  template's shipped values in place, which would publish a previous batch's numbers under this title.
- **Computes two consts itself:** `LADDER` (most-built tier and t0 share from the decade's additions summed over every run; frontier and
  stale payback from `payback.json`; t0 staffing from run 1) and `TRAJ` (levels ÷ vanilla from `consts.json`, construction ÷ vanilla as the
  median over runs; its GDP slot is no longer shown). `VA` comes from `report_data.json`; `D2` is `report_data2.json` with
  `research.json`'s `techsT` and `jeT` added; `OLDP` is `old_plants.json`, `INTRO` is `intro.json`. (`WATCH` and `TIERC` went with their
  panels on 2026-10-29.)
- **Splices the tokens** from `tokens.json` plus `lede`, `scorecard` (→ `__SCORECARD__`), `scorecard_loss` (→ `__LOSS__`), `incidents`,
  `footer` `.html`; `__FIRSTRUN__` is the first run of `_mod.txt` unless `tokens.json` names one. A `<table>` in the lede, incidents or
  footer is wrapped in a scrolling box (`tablewrap`). The red-flag card
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
6. **Nothing runs past the right edge** (2026-10-29, §10.104.1). The page is opened in a real headless browser (Edge or Chrome over the
   DevTools protocol; `LEDGER_BROWSER=<path>` names another) at 1000 px and 390 px, on the World and the Shortlist page with every
   `<details>` open; it fails on the page scrolling sideways, on any element crossing the content's right edge outside a scrolling box (the
   outermost offender is named), and on a chart label drawn past its chart (the SVG clips it). No browser found is a WARN, not a pass.
   Proven on F249's first publication, which it fails on the health pill, the lede's laggard table, the red-flag card's table and two
   clipped chart labels; the regenerated page passes.

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
2. **Publish `REPORT.html` as an Artifact.** Republishing the same file updates the same URL — ⚠ **except a link the user has shared
   externally**, which is never republished (user, 2026-10-29, F249's https://claude.ai/artifact/7dR3FWMiYKJbeMjixMcDQK, the reference
   example of the canonical form): a refill of that batch, or a later form, goes to a new artifact.
3. **Copy into the session folder** `REPORT.html` (`REPORT_<setup>.html` when the session holds several configs) and `redflags_full.html`
   beside it. The out dir is scratch; the session is the record.
4. Quote the report's link in the batch's finding (CLAUDE.md §5.1 rule 9), as FINDINGS entries do.

---

## 6. What the page shows

**Layout (BALANCE_FRAMEWORK §10.104.1, 2026-10-29; written to be read from outside the project):** the heading (`__HEADLINE__`, `__SUBTITLE__`)
→ the fixed preface (observer runs, no player: the numbers show the economy's natural progression) → the batch's description (`lede.html`) →
**the scorecard**, one table → the red-flag detail, collapsed → **play time** → two charts, building-input prices by decade and world GDP run
by run → the view selector, **World** / **Shortlist**, with the scope toggle → the two pages → "What disturbed the runs" (incidents) → the
footer: runs, sessions, arm, the change against the shipped canon, the baseline, the register's loss, the batch's provenance. Rungs show as
`t0 … t3` (the data's column labels still say `e0 …`, `lib_era_cols`; the page relabels them); on a craft book t0 is two columns, artisans
and the tier-0 factories. A table written into the prose is wrapped in a scrolling box by `fill_assemble`, and the gate checks the page in a
real browser (§4.6).

### The scorecard (`__SCORECARD__`, `fill_scorecard.mjs`)

Everything above the play-time block is a line of ONE table, in four columns (user, 2026-10-29): **Line** (the scope in prose), **this
batch / vanilla** (one metric, absolute or ratio as fits the line), **aim**, **verdict** (a pill and at most a short note). A line above the
table says how to read it: the consensus of the runs (`criteria.mjs`'s note), the end-state window, the vanilla n, and what "the shortlist" is.
The rows, grouped by the question they answer; where one quantity is split over rows the world comes first, then the shortlist, then any
country (user, 2026-10-29):

| group | lines | source |
|---|---|---|
| Are the runs sound? | runs broken · play time against the same sessions' vanilla (with the per-session ratios) · market-years short of an industrial input against this batch's own vanilla (of 800 = 8 major markets × 100 years, the markets named) | `criteria.json` · `perf_panel.json` · `redflags_metrics.json` |
| Does the world economy stay near vanilla's size? | world GDP 1932–36 (with the per-run range) · world GDP in 1886, the expected dip | `criteria.json` |
| Does a technological edge win markets, and do efficient producers push out the rest? | backward industries (two tiers behind the best producer, without the technology to upgrade yet) with a far better producer in the same market, and with the better producers all abroad: the ten-year change in their workers against vanilla's · T0 · T3 · tier-1 workers 1900 → 1935 · tier-0 paybacks (crafts, factories) · new plants built below the best tier · PI · PP | `laggards.json` · `criteria.json` · `emp.json` · `payback.json` · `tierchoice.json` |
| Does modernising cost capital? | construction 1880–1935 · the newest tier's payback · capital abundance (unspent investment pool ÷ GDP): world, shortlist, Germany (`gerH`; the register's closed-major term is in the loss, its full-employment half the note) · misplaced capital (MOD ONLY, by ruling) | `report_data.json` · `payback.json` · `criteria.json` · `misplaced.json` |
| Do fewer people find productive work, each producing more? | W world and shortlist · U\* world and shortlist (as %) · GDP per productive worker · the shortlist's GDP | `criteria.json` · `consts.json` |
| Do the tiers arrive on time? | the leader's share of a tier's technologies at its anchor · Britain's technology count (military beside it) · the tiers holding half the tiered workers | `tech.json` · `emp.json` |

**Verdicts.** A register line's verdict is `criteria.mjs`'s bands (§10.83 and amendments; the world-GDP aim and the 1886 line come from
`criteria.json`): at the aim · above / below the aim (inside the soft band) · beyond the soft line. The readings keep the bands the goals table
had (§10.104): built below the best tier < 35% (bad > 45%); tier 1 falling from 1920; tier-0 paybacks ≥ 30 y; construction ≥ 1× (bad < 0.9);
newest-tier payback 8–15 y (warn 6–8 or 15–20); GDP per productive worker > 1×; the tiers on the anchors (one year off warn). The lines added
on 2026-10-29 carry no ruled band and say what they are graded on: the backward industries against vanilla's change (±5 points = "about
vanilla's"), the shortages against vanilla's level (×1.1), the technology shares against "about half" (35–65%), Britain's count within ±10%;
misplaced capital is a reading. Play time: ≤ +5% inside the budget, +5–10% needs improvement, beyond +10% too slow. A source that is missing
prints its line as "not read" rather than dropping it.

**The register's loss** (`__LOSS__`, `scorecard_loss.html`) is in the footer with its parts and the per-run range: the config search's
objective, opaque to an outside reader and directional only (§10.83.7).

⚠ **The world-GDP chart's 0.8–1.25× band** is a rough visual guide, not the target (§10.104); the register's lines are read in the scorecard.

### Play time

TESTBED_OPERATIONS §7 holds the wall-clock procedure; the page shows its result in one sentence, a card and a chart.
- **The grade is the total play time** (user-ruled 2026-08-31), the median over clusters 1 + 2 (user-ruled 2026-10-07); a cluster-3 run (a
  directly observed listed vanilla bug — today the fleet path loop) leaves the grade and is counted. Without `wall_clusters.json` every run
  counts and the card says so.
- **Per unit of work** (pop-matched, equal `world.pop_objects_live`, overlapping bins only) is the diagnostic beside it; the sentence under it
  is derived (a dearer engine, or the size of the world).
- **By session** (`PERF.bySession`, from `wall_clusters.json`): the ratio inside each session holding both arms — the reader's caveat that the
  machine's speed drifts between sessions (F248, F249). Shown when there are two or more.
- The speed chart keeps its scale and normalisation buttons (÷ modelled cost is F72's tripwire); the by-decade and pop-matched tables sit in a
  collapsed details section.

### The two charts above the pages (`INTRO`, from `intro.json`)

Their own script, so a failure blanks only them. **Building-input prices, decade by decade**: the arm's median PI path (£ ÷ base, the shortlist,
1900 … 1935, each run's `PIpath` in `criteria.json`) with its runs' range, against vanilla's (`ref.PI.<year>`); the register grades only the
end point, and falling prices are the mod's core mechanism (CLAUDE.md §2.1). ⚠ The consumer-goods path in wage units is not in `criteria.json`
yet. **World GDP, run by run**: every run's end-state ratio as a dot, the aim band, vanilla's own runs' central 95% (back-derived from the
hard band: `gdpHard.lo / 0.8`, `gdpHard.hi / 1.2`), the consensus line; a broken run is red.

### The two pages

**World** (every country) and **Shortlist** (the watchlist's 16 tags, the shortlist `lib_markets.POOL` selected by default, chips to change
it). Both carry the same panels in the same order (user-ruled 2026-08-24): GDP → workers × product per worker → employment in tier buildings
by tier (the by-decade table with its brackets collapsed under the chart) → old rungs beside their replacement → industry composition of value
added → **Do old plants die?** (the in-market vs trade detail collapsed under it) → research. Then page extras — World: the ladder, the
trajectory ÷ vanilla (without its GDP column: the decomposition table carries that figure per decade); Shortlist: labour. Removed on
2026-10-29 (user): the build-choice panel (its headline is a scorecard line), the tech edge, the next lever. **What gets cut is a duplicate at
the same grain**; finer detail may sit in a collapsed section (user, 2026-10-29).

- ⚠ **The Shortlist page reads the group's FIRST usable run** for most panels (`report_data2.json`'s `flat`; `__FIRSTRUN__` names it on the
  page), and its per-tag anomaly flags (dissolution, a civil war or collapse — population −25% in a year —, an annexation-scale jump of +25%)
  come from that run. The old-plant table reads every run.
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
- **Do old plants die?** (`t-oldp`, `t-woldp`; `fill_old_plants.mjs`, user, 2026-10-29): per industry, the workers on plants two or more
  tiers behind their OWN MARKET's best (the highest tier with ≥ 10% of the market's workers in the industry — the in-market rule of the table
  below it and of `laggard_census.mjs`) at their century peak and at 1935, the share shed since the peak (a bar), and their share of the
  industry's workers at 1935; industries bought by pops first. The mean of all runs; the Shortlist page sums the selected tags. Mod only:
  vanilla upgrades in place and has no old plant (the backward-industry scorecard lines are the vanilla comparison).
- **Margins and prices of old plants, in-market vs trade** (`t-obs`, `t-wobs`, collapsed; F161 §4/§6): per industry and regime the loss
  share, the true margin, staffed ÷ levels, the world price ÷ the rung's break-even, the importers' loss share and signed premium; the
  Shortlist mirror shows the selection's shares.
- **The red-flag detail** (§10.94), collapsed under the scorecard: the two headline numbers per run, median · range — **problem
  market-years** (Σ over the eight major markets, British American French Dutch Belgian German Russian Japanese, of in-game years under a HIGH
  flag on ≥ 10 units/week of building demand, of 800) and **chronic markets** (≥ 20 such years) — the reference beside them on the same basis
  (the order books, when it carries them), split by period and market, the summary and the rule line. The flag-by-flag listing stays in
  `redflags_full.html`, off the page. Not a loss term.

**Conventions every panel follows:** a normalised / absolute toggle unless there is a local reason not to; a ratio beside its absolute twin;
contraction-aware measures (employment with bracketed deltas) over gross level additions; per-tag anomaly flags computed, never hand-listed;
chart end labels carry the value only, the series names sit in a legend above the chart (a long name ran past the drawing).

---

## 7. The `fill_*` scripts

Each writes one or more files into the out dir; `fill_ledger.sh` runs them in the order of §1.

- **`fill_build_perf.mjs <out>`** → `perf_panel.json` (`PERF`). From `perf_raw.json` (`report_perf`) and `wall_clusters.json`: the complete
  runs with their cluster and bug, speeds by year in in-game years per minute, the pop-matched bins, the grade edges (green 5, yellow 10).
  The `source` line is derived from the run labels and says whether the arms alternated within the sessions. `bySession` (2026-10-29) is
  the clusters 1 + 2 median ratio inside each session holding both arms. ⚠ It maps `report_perf`'s bins (`{bin, vanilla, mod}`, seconds
  per year) onto the renderer's shape (`{b, v, m, nV, nM}`, years per minute; a side with no samples is null, never 0).
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
  ladder table reads, and the scorecard's tier-0 payback line prints both parts. ⚠ A loss-making rung has no payback: it is counted, never folded into a median as a
  large number.
- **`fill_research.mjs <out> --mod`** → `research.json`: `techsT` (technologies held per tech era and tree, mean per country, world and
  per tag, both arms, from `technologies_held`) and `jeT` (research-entry firings by stage, tree and tech era). Firings are DISTINCT
  `(stage, technology, country)` triples, never raw log lines (raw lines overcount 2.25×, L23). Per-tag firings join `PMR_JE` display names
  to tags through a curated alias map (the L11 hazard); an unknown name is dropped, never guessed. ⚠ The two hardcoded inputs of §1.
- **`fill_tierchoice.mjs <out> --session --setup --config [--label] [--baseline "label|raw|unit|exports|less"]`** → `tierchoice.json`
  (the scorecard's "built below the best tier" line; its own panel went 2026-10-29). It SPAWNS `analyse_ai_tier_choice.mjs` (raw, unit-weighted and ex-ports below-best
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
- **`fill_old_plants.mjs <out> --mod <runs> --config <book>`** → `old_plants.json` (`OLDP`, 2026-10-29): per industry and year (1840 …
  1930, 1935) the workers on plants two or more tiers behind their own market's frontier and all its workers, the mean over the runs, for
  the world, the shortlist pool and each of the 16 watchlist tags; workers by `pms` levels (merged methods at their own tier, crafts ×
  `workforce_mult`), the LAST 1 January summary of a year (a resume's replay overwrites the abandoned branch). On the 1.0 canon it
  reproduces F249 §4's per-industry 1935 shares exactly.
- **`fill_scorecard.mjs <out> [--config <book>]`** → `scorecard.html` (`__SCORECARD__`), `scorecard_loss.html` (`__LOSS__`) and `intro.json`
  (`INTRO`), §6 (2026-10-29; it replaces `fill_register.mjs` and `fill_goals.mjs`). Reads `criteria.json` (ONE arm, or it exits 1),
  `consts.json`, `payback.json`, `emp.json`, `emp_cols.json`, `tierchoice.json`, `report_data.json`, and where present `perf_panel.json`,
  `redflags_metrics.json`, `laggards.json`, `tech.json`, `misplaced.json` (a missing one prints its line as "not read"). Without
  `--config` the anchors line assumes 1836 / 1875 / 1905 / 1940. It grades nothing the register grades: the register's bands are §10.83's,
  restated, and move with `criteria.mjs`.
- **`fill_assemble.mjs`, `fill_verify.mjs`** — §3, §4. **`fill_manifest.json`** — the contract between shell and batch: every token
  (`name`, `from`, `required`, `means`), every const (`minKeys`), every table (`minRows`), every control, and the staleness list.
---

## 8. The readers

### 8.1 Readers the fill runs

- **`analyse_gdp_gap.mjs`** — per run and year: world GDP, levels by class (mod: by tier), construction points delivered, construction
  sector, investment pool, government construction, workforce split, per-tier profit and staffing → `gdp_gap_series.tsv`. Needs `--setup`
  on a session holding several configs.
- **`report_data.mjs`** — tier stocks and additions by decade (every run in `flats`; run 1 in `flat`), construction points per year (all
  runs; vanilla's mean in `vanPtsByYear`), the frontier share, panel GDP and the `VA` block (`{flat, van, nb}` per year in £M/yr, each
  `{tier, all}`, plus coverage counts).
- **`laggard_pressure.mjs <book> <label>=<group>:<setup> … --json`**, **`tech_census.mjs <label>=<group> … --tree --json`**,
  **`misplaced_capital.mjs --batch <label>:<sessions>:<setup> --json`** — the scorecard's backward-industry, technology and misplaced-capital
  lines (2026-10-29; until then the prose quoted them by hand). `tech_census` keeps only the years it reads (the first, the anchors, the
  last): holding every year ran the heap out on the n=40 vanilla reference.
- **`report_data2.mjs`** — the Shortlist page's dataset per tag: yearly GDP and population, labour, tier employment (`lib_era_cols` columns), old
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
| `criteria.mjs --arm <group>` | the criteria register: consensus, loss, soft and hard lines, the decade path | the register (CLAUDE.md §3.2); the fill runs it (step 16) and the scorecard shows it; run it by hand for the per-run detail |
| `misplaced_capital.mjs`, `tech_census.mjs`, `laggard_pressure.mjs` | §8.1 | the fill runs them (steps 17–19); by hand for their full printouts (per run, per tree, sections B–D) |
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
- **Positional rows** (`LADDER`, `TRAJ`) must match their renderer slot for slot.
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
- Before 2026-10-29: the top of a report was a health line, the lede's paragraphs (play time, laggards, technology and misplaced capital in
  prose), the register table and the readings table (G1–G7 + P), a red-flag banner, and a next-lever section; the second page was the
  Watchlist (every tag selected) with the build-choice and tech-edge panels; the 1886 line read 0.83–1.17. The health line, the lede's
  table and the red-flag table ran past the page's right edge, and long chart end labels were clipped.
