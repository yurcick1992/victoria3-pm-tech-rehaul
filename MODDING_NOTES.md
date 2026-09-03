# Victoria 3 modding notes & gotchas

Engine/tooling reference for this mod. Detailed on purpose — loaded on demand, not into every
session (CLAUDE.md keeps only the short version). Balance methodology lives in
`BALANCE_FRAMEWORK.md`; this file is about *how the engine loads and validates content*.

Target game version: **1.13.x "Matcha"**.

## File loading & override semantics

- Mods load **after** the base game. Inside `common/…`, script files are read
  **alphabetically (A→Z)**. A **new key** in any mod file just adds.
- **Overriding an existing key is NOT done by redefining it in a differently-named file.**
  For gamedatabase objects (buildings, and similar), a duplicate key coming from a *different*
  file is **rejected** — vanilla (loaded first) wins, and the log says
  `gamedatabase.h: Duplicated key <x> will not be created from file: …`. To override such an
  object you must **replace the vanilla file by using the SAME filename** (e.g. the mod's
  `common/buildings/01_industry.txt` supersedes vanilla's), which means the mod file must then
  contain **everything** that file should define (we copy the untouched vanilla buildings verbatim
  and swap in our own). This is why `build.ps1` generates `common/buildings/01_industry.txt`
  (whole-file replacement, plus `06_urban_center.txt` + `11_private_infrastructure.txt` for the
  new-economy chains) but keeps *our own* PMs/PMGs as additive `zzz_*` files (all-new keys, no clash).
- **Whole-file replacement is a cost, so only take it where you actually change something.** Owning a
  file freezes it against every future patch. The builder also whole-file-replaces vanilla
  `common/production_methods/*.txt` — to remap secondary-PM gates and apply `pm_goods` overrides — but
  **only the files it really changes**: it compares its transformed text against the vanilla text and
  skips the write when they are equal. Today that is `01_industry.txt` alone; the other 14 stay vanilla.
  A verbatim copy buys nothing (an unwritten file simply stays vanilla) and costs a frozen file plus
  ~230 KB of someone else's script in the repo and in the shipped mod.
- **The filename choice is load-bearing, and cuts both ways:**
  - **Override existing keys → use the SAME filename as vanilla** (replaces the whole file, so your
    file must contain *everything* it should define — copy the untouched vanilla entries too).
  - **Add new keys → use a DIFFERENT filename** (`zzz_pm_rehaul_*`). Reusing a vanilla filename for
    additive content would **replace that whole vanilla file and delete its original contents** —
    e.g. naming our PM file `01_industry.txt` would wipe *every* vanilla production method in it.
  Getting this backwards silently breaks the mod.
- ⭐ **`common/defines/` IS THE EXCEPTION TO ALL OF THE ABOVE — and it is the useful one.** Defines use
  their own replacement mechanic: a **new file** with a **partial block** overrides only the keys it
  names, leaving the rest of that category and the rest of the file alone. So changing one engine
  constant costs a four-line file, not ownership of vanilla's 2 000-line `00_defines.txt`:
  ```
  # mod/common/defines/01_pm_rehaul_defines.txt   (loads after 00_*, alphabetically)
  NTechnology = {
      TECH_AHEAD_OF_TIME_PENALTY_FACTOR = 0.15
  }
  ```
  ⚠ Do **not** generalise this to other `common/` folders — everywhere else, a duplicate key from a
  differently-named file is rejected and vanilla wins. Defines are special.
- Text files under `common/` and `history/` **should be UTF-8 with BOM** (vanilla is). Without it
  the log warns `lexer.cpp: File … should be in utf8-bom encoding (will try to use it anyways)` —
  non-fatal, but we write BOM to match and keep the log clean.
- The engine loads whole folders, not specific filenames. Never edit vanilla files in place.
- **Localization load order is the opposite:** loc files are processed **reverse-alphabetical
  (Z→A)**, so an early-letter/`0`-prefixed file is applied *last* and wins. This only matters
  when two files set the **same** key (e.g. overriding a vanilla name). For brand-new keys it
  is irrelevant. If a vanilla loc override ever fails to take, move it into a `replace/`
  subfolder (`localization/<lang>/replace/…`), whose keys hard-overwrite any identical key.

## Localization — every language needs its own file

**This is a real correctness issue, not cosmetic.** Victoria 3 does **not** reliably fall back
to English for a key that is missing in the currently-selected language — the UI shows the raw
token, e.g. `building_paper_mill_sulfite`, instead of a name. So even though we are not
translating anything, every key we add must exist in **all 11 supported languages**, with the
English text duplicated as a stub.

Supported languages (folder names under `localization/`):

```
braz_por  english  french  german  japanese  korean
polish    russian  simp_chinese  spanish  turkish
```
(`jomini` and `modifiers` are engine folders, not player languages.)

Rules for each `localization/<lang>/<name>_l_<lang>.yml`:
- Encoding **UTF-8 with BOM** (the 3 bytes `EF BB BF` at the very start).
- First line is the header `l_<lang>:` — e.g. `l_german:`, matching the folder.
- Each entry: a **leading space**, then `key:0 "Text"`. The `:0` is a version number; `$var$`
  interpolates another key; `[concept]` links a game concept.
- Folder is spelled **localization** (with a *z*). `localisation` (British *s*) fails silently.
- A stub in `l_german:` still contains the *English* string — that is intended here; it just
  prevents placeholder tokens for non-English players.
- **Overriding a vanilla loc key** (e.g. renaming `building_food_industry`) from a normal file
  triggers `pdx_localize: Duplicate localization key …` and vanilla usually wins. Put overrides in
  a **`localization/<lang>/replace/…yml`** file — replace-folder keys hard-overwrite and also
  define new keys, so we emit *all* our loc there. metadata.json also needs a `relationships`
  array (even if empty), or the log shows `pdx_mod_metadata: Expected member (relationships)`.

Practical approach for this mod: author the English file, then generate the other 10 as byte
copies with only the header line swapped from `l_english:` to `l_<lang>:`.

## Debugging & validation

- **`error.log`** — `Documents\Paradox Interactive\Victoria 3\logs\error.log`. After loading the
  mod, this lists missing keys, unresolved references (bad tech/PMG/PM names), brace/parse
  errors, missing textures, etc. First place to look; should be clean for our objects.
- Launch with **`-debug_mode`** (Steam launch option or launcher) for richer script error
  reporting and hot-reload of some assets.
- Mods that change checksummed files (most of `common/`) **disable Ironman/achievements** and
  change the game **checksum**; multiplayer requires all players on the same mod + checksum.
- Our own lightweight check is `bash tools/lint.sh` (economic balance). It does **not** catch
  engine errors — still eyeball `error.log` after a load.

### Two Windows PowerShell 5.1 traps our tools hit (not V3-specific, but they cost hours)

- **Keep `.ps1` files pure ASCII.** PowerShell 5.1 reads a BOM-less script as **ANSI (CP1252)**, so a
  UTF-8 em-dash (`—` = `E2 80 94`) decodes as `â€"` — and `0x94` is a **smart double quote**, which
  terminates the enclosing string and produces nonsense parse errors dozens of lines away. Use `-`, `->`.
- **Read config JSON with `-Encoding UTF8`.** `Get-Content -Raw` uses the system ANSI codepage for a BOM-less
  file, so a UTF-8 `·` in `config/*.json` becomes `В·` in whatever the tool generates. Every tool here
  passes `-Encoding UTF8`; keep new ones consistent.
- **…and WRITE it with `[IO.File]::WriteAllText(path, text, UTF8Encoding($false))`, never `Set-Content`.**
  The write side has the same trap and is worse, because it is lossy rather than mojibake: without
  `-Encoding`, `Set-Content` encodes to the system ANSI codepage, and a character that codepage has no
  room for is silently best-fitted or dropped. Verified on this ru-RU/CP1251 machine: an `é` injected into
  a tier name came back out of `solve_be_targets.ps1 -Write` as a plain `e`, with no error and no warning.
  Every config writer now uses `WriteAllText`; keep it that way.
- **Put `$null` on the LEFT of a null check, always.** `$collection -ne $null` does not test for null —
  PowerShell treats the left operand as a collection and **filters** it, returning the non-null
  elements. An **empty** collection therefore yields an empty result, which is **falsy**. Measured:
  ```
  $hs = New-Object 'System.Collections.Generic.HashSet[string]'
  [bool]($hs -ne $null)   # False   <- empty set
  [bool]($null -ne $hs)   # True    <- correct
  ```
  This produced a genuinely nasty bug in `run_observer.ps1`: a de-duplication guard written as
  `if ($State.Seen2 -ne $null -and …)` never ran, because the set started empty; nothing was ever
  added to it, so it stayed empty, so the branch stayed dead — **self-perpetuating, and it reported
  0 duplicates while 4 244 reached the mirror.** Write `$null -ne $x`.
- **Write vanilla numbers with `InvariantCulture`.** PM goods quantities can be fractional (`0.5`, `0.33` in
  the subsistence / urban-centre / agro files). On a non-English Windows, plain string interpolation of a
  double emits `0,5` — which V3 cannot parse, and which only breaks on *that* machine. `build.ps1` routes
  quantities through `Format-Qty`; do the same for any new numeric emitter.
- **Never `@($list)` a `System.Collections.Generic.List[object]`.** It throws
  `Argument types do not match` (an ArgumentException blamed on whatever statement contains it — the
  reported line is not the real problem). Use `$list.ToArray()`. `List[string]` is fine; `List[object]`
  is not. This bit the preset extractor twice.

### Self-diagnostics (dev convention — a tripwire we can read)

The builder generates **`mod/common/on_actions/zzz_pm_rehaul_diag.txt`**, a self-diagnostic that fires at
game start and writes to **`Documents\Paradox Interactive\Victoria 3\logs\debug.log`** (search
`PM_TECH_REHAUL`). It logs an **init marker** with the **build timestamp**:
`PM_TECH_REHAUL: init OK - mod loaded, game started (build yyyy-MM-dd HH:mm) on <date>`.

- **Marker present** → the mod's script loaded and its on_action fired; the timestamp confirms *which*
  build is loaded (matches the mod name in `metadata.json`).
- **Marker absent** → the mod failed to load (or the on_action didn't merge) → read **`error.log`** for the
  cause. `error.log` + `debug.log` together are the diagnostic pair.
- **Safe hook:** it only adds `on_actions = { pm_tech_rehaul_diag }` to the vanilla
  `on_game_started_after_lobby` — it does **not** redefine vanilla's `effect` block (which would conflict /
  break game-start), per `common/on_actions/_on_actions.md`.
- **`debug_log` is NOT gated behind `-debug_mode`** (verified 1.13.9, plain launch): the lines land in
  `debug.log` in a normal run. If they're missing, the mod didn't load — check `error.log`.

**Writing a temporary diagnostic probe (hard-won gotchas).** When adding a periodic tripwire that logs per-country
state (as an ad-hoc AI-behaviour probe once did), these cost real iteration to discover:
- **Hook a periodic pulse the same way as game-start:** `on_five_year_pulse_country = { on_actions = { <ours> } }`
  merges with vanilla's own `events`/`on_actions` on that pulse (on_action *data* merges across files; only a
  second `trigger`/`effect` block conflicts). Root scope of `..._country` pulses **is the country** (`has_strategy`,
  `is_ai`, etc. work directly).
- **Country name in a `debug_log`** has **no preset data context**, so the obvious tokens fail silently or blank:
  `[This.GetName]` → *"Failed to find type 'This'"* (no such type); `[Country.GetName]` → *"No context supplied …
  wanted 'Country'"* and prints **blank** (a tell-tale double space). Use an explicit root-walk:
  **`[SCOPE.GetRootScope.GetCountry.GetNameNoFormatting]`** — context-free, and `NoFormatting` avoids the
  clickable-tooltip blob that plain `GetName` emits (`…CountryTooltip GBR!flag_overlay! United Kingdom!!`).
- **Reaching buildings from country scope needs `any_scope_state` first:** `any_scope_building` used directly from
  country scope **parses cleanly and silently returns false** (no error.log entry). Vanilla always nests
  `any_scope_state = { any_scope_building = { … } }` (cf. `journal_entries/00_belle_epoque.txt`).
- **A silent-false trigger is indistinguishable from "condition genuinely false" — so gate wiring checks on
  something guaranteed to exist.** Testing an iterator against a rare building misleads: railways exist in only 11
  places in 1836 (all West Europe), so a railway-based check reading 0 proved nothing. Use `building_urban_center`
  (every incorporated state has one), and **layer** checks (state exists → building iterates → the specific trigger
  evaluates) so a blank result pinpoints the broken layer.
- **`debug.log` rotates by size.** A long observer run (to the 20th century) overwrites early-game lines — the init
  marker and anything before ~the last ~0.4 MB are gone. To capture a *specific-era* window, either stop the run
  near that date and read before it rotates, or tail `debug.log` into a separate file as it's written. Don't trust
  a late read to contain early pulses.

**The convention:** whenever a change is risky and *might* trip something the linter can't see (naval
capacity, PM goods, gated PMs, a building failing to load), **add an invariant tripwire** inside
`pm_tech_rehaul_diag` in `build.ps1` — a check that logs `PM_TECH_REHAUL WARN: <what broke>` on failure.
Then have the user run the game and read back the log. **How long to run:** `on_game_started_after_lobby`
fires *immediately*, so the init marker appears at the 1836 start — running ~1 in-game day is enough;
run to **01.02.1837** to also catch a first monthly/yearly tick if a check is hooked there.

**Triage rule for the errors you find.** Two classes:

- **Genuine mod bugs** (something we generated is malformed / references a key that doesn't exist, e.g. the
  `pm_anchorage` history bug) → **fix**, and log the root cause in `BUGS_AND_FIXES.md`.
- **Vanilla scripts referencing a main PM our split *relocated*** (`is_production_method_active` etc.
  erroring + returning false → missed flavor, no crash) → **do NOT fix piecemeal.** Append the case to
  **`MISSING_PM_REFERENCES.md`** (or add the PM to the split set and re-run `tools/audit_pm_refs.ps1`). That
  catalogue is deliberately **premature** — we'll relocate more vanilla PMs as we add tiers, so it grows;
  we batch one strategic pass over it later (lean: make our new tier buildings eligible where advanced enough).

**Log retention:** the game keeps the current `error.log`/`debug.log` **plus 5 rotated backups**
(`error.1.log` … `error.5.log`), rotated **per launch, not by time**. So a run is readable only if **≤ 5
launches** have happened since — a run from N launches ago is `error.N.log` (gone once N > 5). Grab the log
before relaunching too many times.

## Automated headless runs (the testbed)

`tools/testbed/run_observer.ps1` drives the game itself — no launcher, no clicking, no debug mode — so
balance changes can be measured over real playthroughs. It is called by `tools/testbed/run_schedule.ps1`,
which is the entry point for all measurement (it owns building each run's mod); a hand invocation of the
observer is a diagnostic. Everything below is **verified against 1.13.9**; it is all engine behaviour, so
re-verify after a patch (see `ON_GAME_UPDATE.md`).

### ⚠⚠ NEVER EXTRAPOLATE A RUN'S LENGTH FROM ITS FIRST DECADE (measured 2026-08-11)

**The game gets steadily slower as the economy it simulates grows.** The 1830s run at about **1.0
in-game years per real minute**; the 1930s at about **0.44** — a factor of **2.3** across a campaign. A
rate sampled in the first minutes therefore under-states a century by roughly a **third**, and the
mistake is expensive in exactly the place it is usually made: sizing `timeout_minutes` for an overnight
batch. It cost a relaunch here — 200 min was budgeted from an early reading and the run took **153**,
which would have been guillotined around 1900 had the economy been slightly heavier.

⚠ The "~5.7 in-game days/sec, so a 5-year run is ~5–6 min" figure elsewhere in this file is an
**opening-years** rate. It is correct for a short probe and wrong for anything that reaches the 1900s.

**COARSE CURVES — in-game years per real minute, by decade.** Regenerate with
`node tools/testbed/run_timing.mjs <sessionDir>`; the tool splits resumed attempts, because a resume
restarts the wall clock and folding the attempts together makes the curve double back on itself.

| decade | vanilla | mod | | decade | vanilla | mod |
|---|---|---|---|---|---|---|
| 1830s | 1.05 | 1.00 | | 1890s | 0.69 | 0.61 |
| 1840s | 0.95 | 0.95 | | 1900s | 0.62 | 0.56 |
| 1850s | 0.89 | 0.85 | | 1910s | 0.52 | 0.51 |
| 1860s | 0.87 | 0.82 | | 1920s | 0.53 | 0.47 |
| 1870s | 0.81 | 0.77 | | 1930s | ~0.50 | 0.43 |
| 1880s | 0.78 | 0.68 | | | | |

**CUMULATIVE BUDGET from an 1836 start, in minutes** — this is the table to size a schedule from. Add
~1 min for load, and note it excludes any crash-and-resume (which costs the elapsed in-game time back
to the last autosave).

| reach | 1850 | 1860 | 1870 | 1880 | 1890 | 1900 | 1910 | 1920 | 1930 | 1936 |
|---|---|---|---|---|---|---|---|---|---|---|
| **vanilla** | 14 | 26 | 37 | 49 | 62 | 77 | 93 | 112 | 131 | 143 |
| **mod** | 15 | 26 | 39 | 52 | 66 | 83 | 101 | 120 | 141 | **155** |

⇒ **A full 1836→1936 run is ~2h35 on the mod and ~2h20 on vanilla.** Set `timeout_minutes` well above
that (330 is the value in use) — the margin is for a crash-resume, not for the curve.

**The mod costs ~8% over a full campaign, not a step change.** Per decade it runs 0–15% slower than
vanilla, widest in the 1880s–90s. A deeper tree, 38 more technologies and 33 more buildings are
affordable; this was an open question and the answer is yes.

⚠ **Sources and their limits.** Vanilla: `20260807_005246_popsplit-debut-vanilla` (1836→1921) and
`20260806_110926_vanilla-retest-2` (1836→1889). Mod: both completed runs of
`20260811_020843_techtree-full-n3`. Two to three campaigns per arm, one machine, one game version — the
curves are **coarse by construction** and the 1930s vanilla figure is an extrapolation, since no vanilla
run on file reaches it. Treat them as a budgeting aid, not a benchmark, and re-derive after a patch or a
hardware change.

⚠⚠ **`error.log` IS CROSS-CONTAMINATED BETWEEN RUNS, AND IT HAS NO TOKEN TO FILTER BY** (2026-08-11).
Telemetry lines carry a per-run token precisely so one run cannot read another's; `error.log` carries
nothing of the kind, and it is the same rotating 5×512 KB ring. So a run's `logs_live/error.log` mirror
contains **other sessions' lines**, out of order — a control-arm mirror was observed opening on a line
stamped `01:44:32` and closing on `01:28:26`, and carrying nine `Duplicated key` errors belonging to a
**different arm** that had run 9 minutes earlier.
⇒ **Never compare raw `wc -l` of `error.log` between arms.** It measured 15 294 against 7 516 where the
runs' own windows held **139 and 12**. Filter every line by its own `[HH:MM:SS]` stamp against the run's
launch and finish times from `harness.log` — the same trick the observer already uses for tick lines
(see BUGS_AND_FIXES, the stale-tail resume verdict) — and de-duplicate, because the game repeats one
error line thousands of times. This is landmine **L9** (unfiltered ring reads) wearing a different hat.
⚠ And **count DISTINCT error shapes, not lines**: a single naval battle rendering produces hundreds of
identical `NAVAL_BATTLE` promote/localization lines, which is vanilla's own bug and swamps everything
our mod could possibly say.

**Launching without the launcher.** `binaries\victoria3.exe`, working directory `binaries`:

| arg | effect |
|---|---|
| `-handsoff` | **Auto-starts an observer game** at the 1836 bookmark, straight from the exe — no launcher, no lobby, no country selection, no input. `continue_game.json` then reads `Observing Great Britain`. This is the whole trick. |
| `-run_until=<Y.M.D>` | The game plays to that date and **quits the process itself** (exit is clean; no kill needed). |
| `-disable_renderframeifneeded` | The exe's own description: *"Sacrifice sub-tick rendering for tick speed."* |
| `-gdpr-compliant` | What the launcher passes; suppresses the legal-docs prompt. |

The full CLI table lives in the exe's string pool near `game_setup.cpp` (`start_tag=`, `handsoff`,
`run_until`, `scripted_tests`, `no_save_after_failed_test`, `gamestate_validation`, `host_server`,
`automated_test`, …). `game/tools/scripted_tests/scripted_tests.md` documents a **separate** pass/fail
suite mechanism (daily triggers, no effects) — not what we use; it only yields PASS/FAIL, we need numbers.

**Throughput:** ~5.7 in-game days/second early game (366 days in 64 s), plus ~40 s fixed startup and a
few seconds to exit. A 5-year run lands around 6–8 minutes.

**Enabling mods from a script — it is `content_load.json`, NOT `dlc_load.json`.** `dlc_load.json` does
not exist in 1.13 (launcher v2); the exe reads `Documents\Paradox Interactive\Victoria 3\content_load.json`.
Entries are **objects with a `path`**, and the path must be **absolute with forward slashes**:

```json
{"enabledMods":[{"path":"C:/Users/<you>/Documents/Paradox Interactive/Victoria 3/mod/pm_tech_rehaul"}],"disabledDLC":[],"enabledUGC":[]}
```

A bare string gives `dlc.cpp: Missing path for dlc/mod`; a relative path gives
`No subdirs mounted for game dir from candidates: mod/<name>`. Success looks like
`dlc.cpp: Mod <name> (<id>) version 1.13.9 successfully matched game version 1.13.9.` in `debug.log` —
the harness asserts on that line. The Paradox launcher overwrites this file whenever it runs, so the
harness backs it up and restores it.

**`pdx_settings.json` is rewritten by the game on exit**, dropping keys it considers default — never
assume a category or key survived. The harness sets `Graphics.display_mode=windowed` (so a run can't
hijack the desktop), `System.language=l_english` (so logged strings stay stable), `game.save_on_exit=false`,
and `game.autosave` to whatever `-AutosaveInterval` says — **default `five_year`**, not `never`: autosaves
are the only thing that makes a crash resumable (see *Surviving a crash* below and the enum note further
down). `never` is still available and costs nothing per run, at the price of unrecoverable crashes.
⚠ Either way, autosaving **clobbers the player's own `autosave*.v3` slots**.

**Getting numbers out.** `debug_log` interpolates data functions, which is the only numeric channel that
needs no debug mode and no save parsing. Verified market path:

```
c:GBR = { market_capital.market = {
    every_market_goods = {
        debug_log = "…[THIS.GetMarketGoods.GetGoods.GetKey]…[THIS.GetMarketGoods.GetGoods.GetMarketBuyOrders|2]…"
    }
} }
```

- `every_market_goods` iterates a market's goods (43 in the British market at the 1836 start).
- `THIS.GetMarketGoods.GetGoods` then exposes `.GetKey` (stable `grain`, language-independent — prefer it
  to `GetName`, which emits a tooltip blob, and to `GetNameNoFormatting`, which is localized),
  `.GetMarketBuyOrders`, `.GetMarketSellOrders`, `.GetMarketPrice`. `|2` gives two decimals.
- **One bad data function kills the entire line** — it is not printed at all, you only get
  `pdx_data_localize.cpp: Data error in loc string '<the whole string>'`. So never put an unverified
  function into a line that carries data you need; probe it separately first.
- The functions are **per-market** (British grain buy orders ≠ French), which is the point.
- `THIS.GetMarketGoods.GetMarketBuyOrders` (skipping `.GetGoods`) does **not** exist.

**Timing the dump.** `on_monthly_pulse` fires on the **1st of every month** (verified across 12 months),
and has **no root scope** — `game_date` comparisons and `debug_log` work, but don't expect a country there.
A one-shot dump needs no global variable, just a one-month window:

```
trigger = { game_date >= "1840.1.1"  NOT = { game_date >= "1840.2.1" } }
```

**Absent countries degrade gracefully:** `exists = c:GER` is false in 1836 (no error), and
`c:GBR = { exists = market_capital.market }` guards the market itself — the harness emits a
`MARKET_NOT_FOUND` row rather than losing the run.

**Harvesting the log — the game's logs are a rotating ring, so copy them as the run happens.** Two
distinct hazards, both of which bite in practice:

- **The ring is small and it is shared.** `debug.log` rotates at 512 KB with 5 backups (~3 MB total),
  and the game rotates again at *every launch*. `dedicated_server.log` alone fills a slot per ~5 in-game
  years (4 `Processing Tick` lines a day), so a full-length campaign discards its own early game long
  before it ends — and an end-of-run snapshot of `logs\` **mixes runs**, because a previous run's file is
  still sitting in the ring. The harness therefore **mirrors the growing logs continuously** into the run
  folder's `logs_live\` (`debug.log`, `error.log`, `dedicated_server.log`): one complete file per log per
  run, never rotated, flushed on every poll so a harness crash doesn't lose it. That directory is the
  authoritative copy; `logs\` next to it is just the exit-time snapshot.
- **Rotation eats what you haven't read yet.** When the live file is renamed to `.1.log`, everything
  written since the last poll goes with it. This is not a corner case: a `debug_log` burst can *itself*
  trigger the rotation — a measured 89-line dump lost 68 lines this way. On detecting the shrink the
  tail therefore reads the remainder of `<name>.1.log` from its last offset **before** restarting on the
  new file, and writes a `--- harness: source log rotated … recovered N chars ---` seam so any gap is
  visible rather than silent.

**And tag every emitted line with a per-run token.** Because runs share one `logs\` folder, filtering by
file mtime is not enough — back-to-back runs are seconds apart and rotation preserves timestamps (this
produced a run with exactly double the rows). The mod under test is therefore **rebuilt per run** with a
unique token stamped into every line (`build.ps1 -TelemetryToken`, e.g. `V3TB|<stamp>s001|G|…`), and the
harness accepts only its own; `meta.json`'s `foreign_token_lines_skipped` reports how many belonged to an
earlier run. Judge completeness from the harvest, not the live tail — a poll can miss the final line.
The token is generated by `run_schedule.ps1` and passed to *both* the builder and the observer, so the
mod and the harvester always agree on it.

**One game at a time.** A second instance writes to the same `logs\` folder. The harness refuses to start
if `victoria3.exe` is already running (it will not kill it — that might be a game you are playing); a
crashed harness can leave one orphaned, since `-run_until` means the game outlives its launcher.

**Surviving a crash, without mistaking you for one.** A run that ends before its `-run_until` date is
either the game dying (resume it) or a human killing it (stop the batch). Three signals, strongest first:

1. **A keypress in the harness console, at any time during the run** — `q` finishes the current run then
   stops, `x`/`Esc` closes the game and stops now. This is the primary control: you never have to kill the
   game yourself, and it responds *while* a run is in progress rather than only after one ends.
2. **A new `crashes\victoria3_*` directory** (with `exception.txt` + `minidump.dmp`) whose mtime falls
   inside the attempt ⇒ definitely a CTD ⇒ resume immediately, with no grace-window stall. Exit codes are
   deliberately *not* used: Task Manager, `Stop-Process` and the game's own crash handler are not reliably
   distinguishable, whereas a minidump either exists or does not.
3. **A grace prompt** if the game exits early with no crash dump — you killed it directly, so press any
   key to confirm. No key ⇒ assume crash ⇒ resume. The window is `-StopGraceSeconds`, **default 60 s**.
4. **A STOP file** — `tools\testbed\STOP`, or `STOP` in the session folder. The **fallback for headless
   invocation** (an agent-launched background job has no console, so signals 1 and 3 cannot work there).
   A keypress also writes this file, which is how it reaches the parent `run_schedule.ps1` driver running
   in another process.

⚠ **Redirecting stdio disables signals 1 and 3.** `[Console]::KeyAvailable` throws when stdout/stdin are
redirected, so `Start-Process … -NoNewWindow -RedirectStandardOutput …` silently drops the harness into
headless mode with the STOP file as its only control. Launch batches into their **own visible window**
(`Start-Process powershell -NoExit -File tools\testbed\run_schedule.ps1 -Schedule <spec>`) and read
progress from `sessions\<stamp>\session.log` instead of capturing stdio. The observer now emits a
startup `WARN` when it has no console; before that (pre-2026-07-31) the two cases were
indistinguishable in the log.

**Resuming is `-continuelastsave`, and it needs a guard.** ⚠ `-continuelastsave` loads the newest save
**on the machine**, not "this run's last save". Measured failure: a resume jumped *forward* from 1836.8 to
1837.1 because a previous test run's autosave was newer — silently splicing a foreign timeline in and
skipping a dump date. The harness therefore refuses to resume unless the newest `*.v3` in `save games\` was
written after this run started, and after resuming checks where the clock landed: **ahead** of the kill
point ⇒ foreign save, **far behind** ⇒ the load failed and `-handsoff` started a fresh 1836 game (verified:
a bad `-loadsave=` path does exactly that), **no progress** ⇒ abandon. Any of the three abandons the run
rather than reporting corrupt data. `-loadsave=<absolute path>` was tried and rejected by the exe
(`Could not load save game [...]. Going to main menu.`), so the save cannot be named explicitly.

⚠⚠ **THE "far behind" CHECK USED TO RUN ONLY WHEN THE ATTEMPT ENDED, AND SO COULD NOT RUN AT ALL ON A
SUCCESSFUL ONE** (found 2026-08-31, BUGS_AND_FIXES). It sat after `if ($reached -or $timedOut) { break }`,
so a resume that silently restarted from 1836 and then played the whole century exited through the
`break` with the landing never examined — recorded as a clean run reaching its target, its folder holding
**two campaigns** and its wall clock doubled (267 min against 135–146 for its siblings). The abort now
fires on the **first tick** of a resume, so such an attempt can never reach the target. Landmine **L26**
is the artifact-side check, because fixing the harness says nothing about sessions already on disk.

⚠⚠ **AND THE TRUNCATED-SAVE HYPOTHESIS IS REFUTED BY THE FIRST QUARANTINE THAT RECORDED SIZES.** The
leading explanation for an unloadable newest save was *a CTD landing mid-autosave-write, leaving a `.v3`
that exists, is newest, and is truncated* — which is why the quarantine keeps the file and logs the four
sizes. On `20260830_191950` run004 the bad `autosave.v3` is **43 302 141 B, the LARGEST of the four**
(`autosave_1` 42 946 448 · `autosave_2` 42 452 117 · `autosave_3` 42 475 142). It is not truncated, and
`autosave_1` — a complete, ordinary-sized save — **also failed to load**. What makes a late-campaign
gamestate unloadable is **unidentified**; do not repeat the truncation explanation as though it were
established.

A resume rewinds to the last autosave, so a dump date that already fired can fire **again** with different
numbers. The harvest keeps the **last** emission per `(date, tag, good)` — the one on the timeline that
actually reached the end — and reports the count as `re-dumped` rows.

**Autosave is the only way to make a crash resumable** — **no script effect can save the game**
(`save_scope_as` and friends save *scopes*). The engine's own values, from the exe's `SETTING_AUTOSAVE`
option block, are:

```
never   monthly   quarteryear   halfyear   five_year   yearly
```

Note the inconsistent spelling: **`halfyear` has no underscore, `five_year` does**. ⚠ Do not look for
these near the `save_interval` string in the exe — that is a *different* enum (`half_year`,
`three_months`, `every_other_month`) belonging to something else, and mistaking it for this one is how
this file previously came to claim, wrongly, that no multi-year interval existed. The authoritative
cluster is the one containing `SETTING_AUTOSAVE` / `autosave` / `OPTION_FIVE_YEAR`.

`five_year` is the harness default: ~19 saves over a full 1836–1936 campaign, capping crash loss at five
in-game years. Verified in-game — a 7-year run writes exactly 1 autosave.
⚠ **Autosaves OVERWRITE the player's own `autosave*.v3` slots** — a testbed session will destroy whatever
was in them. Named saves are untouched. Set `-AutosaveInterval never` to opt out, at the cost of making
crashes unrecoverable (and note a crash before the first autosave has nothing to resume from either way).

## metadata.json

- Lives at `mod/.metadata/metadata.json`. Key fields: `name`, unique `id` (reverse-domain),
  `version`, `game_id:"victoria3"`, `supported_game_version`, `tags`, and
  `game_custom_data.multiplayer_synchronized`.
- **The builder stamps `name`.** `build.ps1` suffixes the mod `name` with `(built yyyy-MM-dd HH:mm)`
  on every build (stripping the previous suffix first so it never accumulates), so the Paradox
  launcher's mod list shows which build is freshest. The `id` is left untouched, so playset
  membership is stable. This is the one field of an otherwise hand-maintained file that is machine-edited.
- `replace_paths` (optional array of folder paths) makes the engine **ignore the entire vanilla
  folder** and use only the mod's — use when merge-override is not enough (e.g. to fully drop a
  vanilla file's objects). We **do** use it for `common/history/buildings` (so the converted 1836
  start replaces vanilla's rather than double-placing factories); the rest of the mod is
  merge/override and needs no entry.

## gfx / icons

- Buildings (`icon`, `background`) and PMs (`texture`) reference `.dds` paths. Reusing a vanilla
  path is fine and needs no asset. A bad path logs an error and shows a fallback/missing icon;
  it does not crash.

## ⭐⭐ `create_building` IS GATED ON THE STATE OWNER'S TECHNOLOGY — AND FAILS SILENTLY

**Undocumented, measured 2026-08-17 (FINDINGS F68). The single most expensive engine trap this mod has
hit.**

A `create_building` block in `common/history/buildings` is validated against the **country that owns the
region_state**, using the building's own `unlocking_technologies`. If that country lacks the technology,
**the block is dropped and the building never exists.** The build succeeds, the mod loads, the game runs,
and the only trace is one line in `error.log`:

```
Error: create_building effect [ … Dutch East Indies … must have invented … The Screw Steamer … ]
Script location: common/history/buildings/12_indonesia.txt:683
```

⚠⚠ **`add_ownership` IS NOT CONSULTED.** Naming a technologically advanced overlord as the owner does
**not** satisfy the check. We seeded 38 steam-port stubs owned by GBR/FRA/NET; the 22 that stood in a
*subject's* state were all rejected, deterministically — 110 error lines across 22 locations, identical
in ten runs. Granting the technology to each subject fixes it completely: 0 rejections, 38 of 38 created.

**Why it works this way** (mechanism, from the files):

- The error string is **generic engine validation**, not history-specific:
  `LACKING_TECHNOLOGY_SINGLE:2 "[Country.GetName] must have invented [Technology.GetName]"`, sitting in
  a family with `LACKING_IDENTITY_SINGLE` / `LACKING_PRINCIPLE_SINGLE` / … that maps one-to-one onto the
  `unlocking_*` fields buildings and PMs carry. It is the same "may this country have this thing" check
  that gates construction and PM selection; `create_building` just runs it at world init.
- That check needs **one country**, and ownership cannot supply one. `add_ownership` is a *set of
  shares*, and in vanilla's own 1836 files most shares are not countries: **2 361 `building=`**
  (financial districts, manor houses) against **898 `country=`** and **21 `company=`** —
  e.g. `building={ type="building_financial_district" country="c:USA" levels=6 region="STATE_LOUISIANA" }`.
  The only unambiguous country attached to a building is the state's owner, which is what the error names.
  *(The loc-family evidence is direct; "therefore the state owner" is inference from it.)*

**⚠ IN-GAME CONSTRUCTION IS NOT GATED THIS WAY.** A country can build in any state its diplomacy allows
without the local country holding the technology. The history effect is a separate code path with its own
check. Do not reason from one to the other — that mistake is what produced a wrong ruling here.

**The fix** when a seeded building outruns the local country's tech: declare the technology in the
config's `start_tech_grants`, which `emit_techs.mjs` emits as a guard inside that country's own starting-
tier effect (`if = { limit = { this = c:TAG } add_technology_researched = X }`). **Measured to work,
per country.** Landmine **L14** (`verify_start_techs.mjs`) is the detector; see TESTBED_LANDMINES for the
two ways it was blinded.

**⚠ IT IS NOT DOCUMENTED ANYWHERE.** The game ships no documentation folder; the wiki's effect tables are
generated from the engine's script-doc dump, which gives signature and scope only and never validation
semantics (`create_building` does not appear there at all). The one in-game statement of the rule is the
error tooltip above — a UI template, not documentation — in a log nobody reads by default.

---

## Game-start conversion (the 1836 "savegame")

The 1836 start is **generated from `common/history/buildings/*.txt`** (16 regional files) — there
is **no bundled save**. Each building is a `create_building` block:

```
create_building={
    building="building_textile_mill"
    add_ownership={ building={ type="building_textile_mill" country="c:SWE" levels=3 region="STATE_SVEALAND" } }
    reserves=1
    activate_production_methods={ "pm_handsewn_clothes" "pm_no_luxury_clothes" "pm_traditional_looms" }
}
```

`activate_production_methods` lists one PM per PMG (main + each secondary "off" state).

**What our mod breaks:** the listed **main** PM (e.g. `pm_handsewn_clothes`, and notably higher
tiers actually used at start — `pm_dye_workshops`, `pm_lathe`, `pm_pig_iron`, `pm_sweeteners`,
`pm_leaded_glass`, `pm_sulfite_pulping`, `pm_steel`) is no longer part of the repurposed base
building, so those factories fall back to the forced T1 main PM — silently **downgrading**
advanced starting industry. Secondary "off" PMs still resolve (we keep those vanilla PMGs).

**Converter approach (tasks I.2–I.4):** rewrite each `create_building` block for a split industry:
map (vanilla building + its active **main** PM) → (correct tier building key + our new main PM
key), rewriting both `building=` and the `type=` inside `add_ownership`, and swapping the old main
PM token in `activate_production_methods` for ours (keep the secondary tokens). Consult the
manual-exception subconfig (force tier / remove) before emitting. Write results to
`mod/common/history/buildings/…` and add **`replace_paths: ["common/history/buildings"]`** to
metadata.json so the mod's converted set replaces vanilla's (avoids double-placing buildings).
The vanilla-PM→tier mapping should live in the config (add a `vanilla_pm` field per tier).

## Content-specific reminders (this mod)

- A **PMG with exactly one PM** = that PM is always active (no player choice) = "one main PM".
- A PM inside a single-PM main group must have **no `unlocking_technologies`**; put the tech gate
  on the **building** (`unlocking_technologies = { … }`) so the building always has a valid
  active main PM the moment it can be built.
- Keep the vanilla building key as the **tier-1** variant so companies, journal entries, history
  placement and AI that reference `building_<x>` keep working; higher tiers are new keys.
- `aliases = { … }` on a building preserves the plural/alt keys other files use.
- Referenced secondary PMGs (automation, luxury, canning, …) stay defined in vanilla — we only
  reference them, so their base ("off") PMs come along unchanged.
- **⚠ `required_input_goods = <good>` makes a PM unselectable until that good is ALREADY traded in the
  market** — vanilla uses it on `pm_electric_streetlights` so cities cannot light streets before any
  electricity exists. That is a DEADLOCK for a PM that *produces* the named good: our rehauled
  streetlights GENERATE electricity, and with the vanilla line kept no urban centre could ever switch to
  them (no electricity in market → PM locked → no electricity, forever — and nothing errors). The
  builder's `pm_goods` writer therefore drops a `required_input_goods` whose good is no longer among the
  override's inputs. If you ever hand a producing PM such a gate, this is why the game ignores your PM.

## Technology: research, spread, and what the AI actually weighs

Read this before designing anything that hands a country research (ROADMAP step 2).

- **There are TWO independent channels, and only one of them is a choice.**
  **Directed research** spends your weekly innovation on the one technology you selected.
  **Spread** is separate and automatic: each country may have **one technology per tree** spreading to
  it from countries ahead of it, at
  `(25 + 0.2 × unspent innovation + 0.75 × literacy) × Σ modifiers × rand(0.5, 1.5)` per week
  (`country_tech_spread_add` / `_mult`, and per-category `country_production_tech_spread_mult`,
  `country_military_…`, `country_society_…`). Spread grants **progress toward** a technology, not the
  technology itself, and it finishes what it starts without the AI ever having to notice.
- ⭐ **NO TECHNOLOGY IN VANILLA REQUIRES ONE FROM ANOTHER TREE — zero, across all 179.** Measured, not
  assumed. So a cross-category `unlocking_technologies` entry is something the engine has never been
  asked to draw, and moving a technology between trees means **re-rooting its prerequisites on its new
  tree**, not carrying the old ones across. It is also what makes such a move *decidable*: ports could
  move to military because vanilla's own dock technologies are already there to re-root on; electrics
  could not, because a telephone works cannot stop requiring `electrical_generation`.
- ⭐ **TECH ICONS CAN BE GENERATED — no image library, no Paradox art.** Vanilla's invention icons are
  **256×256, 32-bit A8R8G8B8, uncompressed, 9 mipmaps** (`gfx/interface/icons/invention_icons/*.dds`).
  Mipmaps are optional and a single surface is a legal DDS, so a placeholder is a **128-byte header plus
  raw BGRA pixels** — writable from Node or PowerShell in a dozen lines. Header fields that must match:
  `dwSize` 124, `dwFlags` 0x100F, height/width, `dwPitchOrLinearSize` = width×4, `ddspf.dwSize` 32,
  `ddspf.dwFlags` 0x41, `dwRGBBitCount` 32, masks R `0x00ff0000` G `0x0000ff00` B `0x000000ff`
  A `0xff000000`, `dwCaps` 0x1000. Byte-compared against `manufacturies.dds`: identical but for the
  mipmap flag and `dwCaps`, as expected for a single-surface texture.
  ⚠ Pixels are **BGRA byte order** — the masks describe a little-endian A8R8G8B8 word.
- ⭐ **THE SPREAD FORMULA'S OWN CONSTANTS ARE SCRIPTABLE — all three of them.** ⚠ **THE MOD USES NONE OF
  THIS as of 2026-08-12** (user ruling — the research journal entries already compensate the deeper tree,
  and spread is the one lever that works against the mod's goal). It is kept because the mechanism is a
  real engine fact and the question will be asked again; nothing below describes shipped content.
  They are not defines and
  not hardcoded; they are static modifiers in `common/static_modifiers/00_code_static_modifiers.txt`,
  whose header says outright *"Effects are fully scriptable here"* and *"these names can NOT be removed
  or changed, as the code uses them"* — i.e. the block names are fixed, the numbers are ours:
  ```
  base_values          = { country_tech_spread_add = 25  }   # the flat term
  country_literacy_rate = { country_tech_spread_add = 75  }   # x literacy (0..1)
  excess_innovation     = { country_tech_spread_add = 0.2 }   # x unspent innovation points
  ```
  ⇒ weekly spread = `(25 + 75 x literacy + 0.2 x unspent) x (1 + Σ mult) x rand(0.5, 1.5)`.
  ⚠ The innovation term is **0.2 per point (unspent ÷ 5)**, not ÷ 10.
  ⚠ These live in a **1 029-line, 149-block file** that also carries `base_values` — weekly innovation,
  the innovation cap, bureaucracy, authority, influence, minting, tax capacity, state infrastructure. It
  is NOT a defines-style partial override: changing it means owning the whole file. **Do that by
  GENERATING it from vanilla at build time and substituting only the numbers we change** (the same
  transform-from-vanilla pattern the builder already uses for `01_industry.txt` and
  `01_admin_strategies.txt`), so a patch's edits to the other 148 blocks flow through instead of being
  frozen. ⚠ And make the substitution **throw when it does not match** — a renamed modifier would
  otherwise leave the mod silently running vanilla spread, which is the exact landmine shape.
  ⭐ The single-lever alternative: `base_values = { country_tech_spread_mult = 2 }` scales all three
  terms at once. ⚠ Multipliers **add** rather than compound, so vanilla's own +5%/+25% spread bonuses
  land as `1 + 2.0 + 0.25`, not `3 x 1.25`.
- **Progress is stored PER TECHNOLOGY and persists.** Switching research away from a half-done
  technology does not discard it — the wiki is explicit: *"The amount of innovation applied to a
  technology so far is saved if another technology is selected as the current research."* So a country
  genuinely can sit at 90% on something it is not researching.
- **`add_technology_progress = { progress = N technology = X }` is a real effect**, used 68 times in
  vanilla events and journal entries. It is the natural mechanism for industry-driven research.
- ⚠⚠ **BUT THE AI'S EXPOSED WEIGHTING HAS NO PROGRESS TERM.** The whole of the AI's technology model in
  `common/defines/00_ai.txt` is two constants, and the second states the formula in its own comment:
  ```
  TECH_RANDOM_FACTOR      = 1.0  # the higher this is, the more random AI tech research will be
  TECH_COST_PENALTY_FACTOR = 5.0 # AI tendency to research a tech is divided by
                                 #   ( 1 + this * ahead of time penalty / era base cost )
  ```
  That is the **ahead-of-time penalty**, i.e. how anachronistic the technology is — *not* how much of it
  is already paid for. On this evidence the AI does **not** recognise "this one is nearly finished, so
  it is cheap now".
  ⚠ This is an argument from what the engine exposes, not a proof: the C++ could carry a progress term
  with no define for it. It is **corroborated but not settled** — see the next point — and it is
  measurable in the testbed (watch an AI country's selected technology while it holds partial progress
  elsewhere).
- **Corroboration: `has_technology_progress` exists and vanilla NEVER uses it.** The trigger is declared
  in `common/trigger_localization/00_trigger_localization.txt` and renders as *"Technology progress for
  X is ≥ N%"*, so progress is readable from script as a percentage — and a full-tree grep finds **zero**
  usages outside that declaration. No vanilla content, `ai_weight` block or AI strategy makes any
  decision on accumulated progress.
  ⭐ **ITS PARAMETERS ARE NOW KNOWN, AND THE EARLIER GUESS HERE WAS WRONG** (2026-08-11). The exe's own
  string pool carries the usage hint verbatim:
  ```
  has_technology_progress = { technology = X progress = Y }
  add_technology_progress = { progress = X technology = Y }
  ```
  So the second key is **`progress`**, not `value` — this file previously guessed `value >= <0..1>`, which
  would have failed exactly the way the landmine register describes (trigger returns false, nothing errors).
  The trigger's loc renders `$NUM|%$`, so `progress` is read as a **fraction**, not innovation points.
  ⚠ Still worth a `pm_tech_rehaul_diag` probe before relying on it: the hint fixes the key names, it does
  not prove the comparator form or the 0..1 scale.
  ⭐ **THE EXE STRING POOL IS A GENERAL INSTRUMENT FOR THIS.** `grep -a -o -E "[a-z_]{6,40} = \{[^}\"]{3,110}\}"
  over `binaries/victoria3.exe` prints the engine's own usage hints for triggers and effects vanilla never
  calls — e.g. `has_employee_slots_filled = { pop_type = X percent = Y }`,
  `add_journal_entry = { type = <key> target = <scope> }`. Reach for it before guessing a key.
- ⇒ **Design consequence.** Today the "nearly finished" case barely arises, because spread completes
  what spread starts. An event that dumps progress onto a technology the AI has no reason to select
  would create that case for the first time, and could strand it. The robust shape is to make the
  technology *wanted* rather than merely *cheap*: `ai_weight` is a per-technology script value block
  that accepts arbitrary triggers in a `limit`, so an industrial technology can raise its own weight
  from the industry the country actually owns — the same condition the event fires on, and no dependence
  on the AI understanding progress at all.
- ⚠ **A deeper tree makes AI randomness worse.** `TECH_RANDOM_FACTOR = 1.0` scatters the AI across
  whatever is available, and vanilla leans on `value = 1` for most technologies with a handful of 2s and
  3s. On a 100+ technology production tree that near-flat weighting spreads the AI thinner than it does
  in vanilla, so our technologies need **authored** `ai_weight`s, not a copied `value = 1`.

## What a tech-granting event can CONDITION on (ROADMAP step 2 research, 2026-08-11)

Everything below is read off the shipped game files, the shipped `.md` docs, or the exe string pool.
Nothing here is inferred from the wiki alone.

- ⭐⭐ **`can_research = <tech>` IS EXACTLY "all prerequisites researched AND not yet researched".** It is
  the whole of step 2's visibility condition in one cheap engine-side trigger. Proof that it goes false
  once researched is vanilla's own idiom in `je_victoria_terminus`:
  `OR = { can_research = steel_frame_buildings  has_technology_researched = steel_frame_buildings }` —
  the OR exists precisely because `can_research` stops being true after the fact. Related, also live:
  `has_researchable_technology = yes`, `has_technology_discovered`, `is_original_inventor_of`.
- **Counting industry — four instruments, very different costs.**
  - `country_has_building_type_levels = { target = bt:building_X  value >= N }` and
    `country_has_building_group_levels = { type = bg_X  value >= N }` — country scope, engine aggregate,
    **levels only, staffing ignored**. Cheapest. Vanilla runs the first one *inside a building's `ai_value`*
    (`05_military.txt`), so it is cheap enough for a per-decision weight block.
  - `any_scope_building = { is_building_type = X  level >= N  occupancy >= 0.5  weekly_profit > 0 … }` —
    per building. The full verified key set inside a building scope is `is_building_type`, `is_building_group`,
    `level`, `occupancy`, `weekly_profit`, `earnings`, `cash_reserves_ratio`, `is_subsidized`,
    `is_under_construction`, `has_active_production_method`, `has_failed_hires`, `building_has_goods_shortage`,
    `private_ownership_fraction`, `country_ownership_fraction`, `levels_owned_by_country`.
  - ⭐ **Staffed levels as a script value — and the formulation matters.** The quantity wanted is
    `Σ (level × occupancy)`, i.e. **occupancy as a WEIGHT**:
    ```
    every_scope_building = { limit = { is_building_type = X }
                             add = { value = this.level  multiply = occupancy } }
    ```
    ⚠⚠ **Do NOT write `limit = { … occupancy >= 0.9 }` and `add = this.level`.** That is a *filter*, and it
    throws away the case the rule exists for: 7 levels at 50 % staffing (3.5 level-equivalents) contributes
    **zero**, while 3 levels fully staffed passes. The half-staffed larger industry is the bigger employer
    and must count as one (user, 2026-08-11).
    ✅ **VERIFIED IN GAME 2026-08-11** (session `20260811_215142`, 1836→1837, mod build + probe files).
    The script value equals `Σ(level × occupancy)` rebuilt independently from the per-building data
    functions `GetExpansionLevel` / `GetEmploymentPercentage`, to five decimal places, in all seven
    countries probed:

    | | mills | levels | Σ(lvl×occ) from data functions | script value | filter form |
    |---|--:|--:|--:|--:|--:|
    | GBR | 5 | 57 | 56.810 | **56.81345** | 57 |
    | RUS | 7 | 13 | 12.269 | **12.26985** | 13 |
    | FRA | 7 | 29 | 27.110 | **27.11275** | 29 |
    | PRU | 4 | 13 | 11.112 | **11.11187** | 13 |
    | AUS | 3 | 16 | 15.969 | **15.97368** | 16 |
    | USA | 3 | 10 | 10.000 | **10** | 10 |
    | BEL | 1 | 4 | 3.998 | **3.9986** | 4 |

    Both spellings work and agree exactly — bare `occupancy` and `this.occupancy`. `add = occupancy`
    with no `multiply` also resolves (it returns the per-building occupancy sum, e.g. GBR 4.827 over
    5 mills). The filter form's last column is the point: it cannot see staffing at all.
    ⚠ The occupancy-band fallback is therefore **not needed** and is not part of the design.
  - ⚠ **Level × occupancy × config employment measures STAFFED CAPACITY, not bodies.** It equals headcount
    at a tier's base PM, and **overstates by up to ~30 % where an automation PM is active** (automation cuts
    up to 1 500 of ~5 000 laborers per level). Correctable per building with `has_active_production_method`;
    exact headcount needs the pop walk below.
  - **True headcount** exists only via `every_scope_pop = { limit = { pop_employment_building = X } … }` —
    `pop_employment_building` is a **pop-scope boolean**, so this iterates every pop in the country.
    ⚠ There is **no** building-scope or country-scope employee-count value. Vanilla uses the pop loop only
    for one-off effects (`enslave_discriminated_farm_workers`), never on a pulse.
  - ⇒ **"Y people employed" is best authored as people and COMPILED to staffed levels**, since our own config
    holds each tier's `employment` (~5 000/level for manufacturing). ⚠ Guard the divide: the art academy's
    tiers carry **zero** base employment (its jobs live in the ownership PMG).
- **Ownership is expressible.** `levels_owned_by_country = { target = c:XXX  value >= N }` inside a building
  scope distinguishes who owns the levels from whose territory they sit in; `country_ownership_fraction` /
  `private_ownership_fraction` give the split. So "foreign-owned levels do not count for the host" is a
  one-clause change, not a redesign.
- **Journal entries are the engine's own conditional progress bar, and they run for AI countries.**
  `is_shown_when_inactive` (default **no**) + `possible` (default **yes**) both true ⇒ the JE **activates by
  itself**, no `add_journal_entry` and no on_action needed. `can_deactivate = yes` lets it fall back to
  inactive. AI participation is not an assumption: `je_meiji_restoration`'s `on_complete` carries an
  `is_player = no` branch that annexes Ezo, which only ever executes for an AI Japan.
  - Two independent bar systems. **Goal:** `current_value` + `goal_add_value` (summed **at activation**) with
    `complete = { scope:journal_entry = { is_goal_complete = yes } }`, plus `progressbar = yes` and
    `display_progressbar_as_months = yes`. **Scripted:** `scripted_progress_bar = <key>` from
    `common/scripted_progress_bars`, with its own `min_value`/`max_value`/`start_value` and a
    `monthly_progress = { add = { desc = … if = { limit = {…} value = N } } }` block — i.e. **conditional
    accumulation with a per-term tooltip**, read back as `"scripted_bar_progress(<key>)" >= N`. Bar state is
    per-JE-instance (Antarctica and Central Africa share one definition).
  - ⚠⚠ **The goal-value re-activation trap.** `goal_add_value` is evaluated *at activation* and **added to**
    `current_value`. A JE that deactivates and reactivates while its counter variable has grown re-bases the
    goal upward and can never complete. Either keep the JE active and gate only the tick, reset the variable
    in `immediate`, or use a scripted bar (which has a fixed `max_value` and is immune).
  - `on_weekly_pulse` / `on_monthly_pulse` / `on_yearly_pulse` inside a JE take `effect = {}` and/or
    `events = {}`. A scripted bar's own progress update runs **before** the JE pulse of the same period.
  - **Cost:** `JOURNAL_ENTRY_UPDATE_ACTIVE = 4` days, `JOURNAL_ENTRY_UPDATE_INACTIVE = 14` days
    (`00_defines.txt`), whose comment says it "can be overriden on journal entry type". No vanilla JE does,
    and the doc does not name the field — but the exe string pool carries **`active_update_frequency`** and
    **`inactive_update_frequency`**. ⚠ Unverified key names; probe before relying on them.
- ⚠⚠ **DO NOT reuse vanilla's tech-event channel.** All ~33 vanilla tech events hang off one
  `tech_monthly_events` `random_events` block at `chance_to_happen = 50` with `never_fire_again` cooldowns —
  a country gets roughly half an event a month from the whole set. Adding ours there makes them a lottery.
  Use an own on_action with `events = { … }` (always fires when the event's own trigger passes), attached
  without owning any vanilla file via the documented append pattern:
  `on_monthly_pulse_country = { on_actions = { pm_rehaul_research_pulse } }`.
- ⭐ **A delayed event re-checks itself.** `_on_actions.md`: *"an event will only successfully fire if it is
  valid both when the on_action is executed AND once the delay is complete"*. So
  `trigger_event = { id = X  days = 1095 }` is a free "still true three years later?" with no JE and no
  variable — it just does not observe the middle of the interval.
- **Research modifiers are CATEGORY-wide, never per technology.** `country_production_tech_research_speed_mult`,
  `country_tech_research_speed_mult`, `country_weekly_innovation_add/_mult/_max_add`,
  `country_ahead_of_time_research_penalty_mult`, and the per-category spread multipliers.
  `country_tech_group_research_speed_mult` is *defined* but used nowhere in vanilla. ⇒ **You cannot speed up
  one technology; you can only add flat progress to one, or speed the whole tree.**
- ⭐ **A production method can pay research directly, scaled by staffing.** `country_modifiers = {
  workforce_scaled = { … } }` on a PM applies a country modifier scaled by *staffed* level (the `.md`:
  "scaled by the staffing level of the building … between 0.0 and building level"). Vanilla's universities
  do exactly this with `country_weekly_innovation_add = 1/1.5/2`. Since we already own every tier's PM file,
  "industry generates research" needs **no events, no journal entries and no AI coupling** — but it is
  diffuse, not directed at a particular technology.
- ⭐ **UNIVERSALITY IS FREE ON THE JE ROUTE, AND IT IS NOT ON THE EFFECT ROUTE.** Auto-activation is an
  engine sweep over countries (every 14 days inactive, 4 active), so a tag that first exists in 1880 —
  released subject, successful revolution, unification — is swept exactly like any other and needs nothing
  fired at it. `add_journal_entry` is a one-shot effect and a new tag simply misses it. Decentralized
  countries drop out for free: their `country_type` carries `can_research = no` and `has_events = no`, so
  the `can_research = X` gate is already false for them. Set `can_revolution_inherit = yes` (the doc:
  *"Revolutions also get all variables from the defeated parent country, so most JEs should be inherited in
  this way"*) and `transferable = no` — the entry belongs to the country, not to whoever the player is.
- ⭐ **THE RESEARCHABLE FRONTIER IS ~11 TECHNOLOGIES WIDE, NOT 83** (measured over the shipping tree,
  `config/tech_tree_options.json`, researching in era-then-onset order): min 1, **median 12, mean 11.1,
  max 17** across the whole campaign. That is the number that sizes both the journal clutter and the per-
  country cost — not the 81 production technologies in the tree.
- **Scale of the problem, from our own config:** 100 tiers, 90 carrying a `tech`, **83 distinct technologies**
  (38 of them ours). Only 3 technologies are shared by more than one tier — `manufacturies` (6 industries),
  `mechanized_workshops` (2), `steelworking` (2). ⚠ And **12 of the 90 are the FIRST rung of their industry**,
  so they have no "tier N−1" to condition on at all: fertilizer, explosives, motor, both shipyards, automotive,
  munition, synthetics, electrics, power, railway, art academy.
- ⚠ `add_technology_progress` is called 68 times in vanilla and **every one passes literal integers and a
  literal technology key**. A script-value `progress`, or a `technology` read from a variable, is therefore
  unverified in both directions.

### The step-2 wording probe — what ran, and everything it settled (2026-08-11)

Session **`20260811_215142`**, label `je-wording-probe`. Arm: a full `mod_jeprobe` build
(`build.ps1 -SaveTo jeprobe -TelemetryOn`, config `config/mod_config.json`) plus **five injected probe
files** — script values, scripted progress bars, seven journal entries, an on_action and English loc.
1 run, 1836.1.1 → 1837.1.1, **190 s wall**, self-quit, autosaves off. Not an experiment arm and it pools
with nothing; the probe files were never in `telemetry_lib.ps1`, so the telemetry fingerprint is untouched
and this session cannot disturb the vanilla/techs pooling the ROADMAP handover depends on.

**Seven journal entries differing in exactly one thing each**, so a zero names its own cause:

| variant | completions in 1 year | what it proves |
|---|--:|---|
| `always` | **545** (285 countries named) | JE auto-activation + scripted bar + `on_complete` all work, for **every country in the game**, with no `add_journal_entry` anywhere |
| `canres` | 111 | `can_research` gating works and discriminates (era-2 technology; the era-1 freebies would have given ~0) |
| `lvl` | 82 | ⭐ **a script value CAN be used as a trigger** (`pmrprobe_tex_lvl >= 1`), and `is_building_type` really filters |
| `occw` | 56 | the occupancy-weighted sum works as a bar condition end to end |
| `anyb` | 82 | `any_scope_building` + `occupancy` as a plain trigger works |
| `varw` | 62 | `set_variable` from a script value, then `var:x` as a trigger, works |
| `never` | **0** | ⭐⭐ **the negative control is clean** — the conditions are genuinely being evaluated |

⚠⚠ **The negative control is the load-bearing one.** §3.7 of TESTBED_METRICS established that an invalid
trigger inside a `limit` is *silently ignored*, which would make every conditional bar above tick
unconditionally and every "success" meaningless. `never` completing 0 times is what rules that out.

Incidental findings, each of which would have cost a build cycle later:
- ⭐ **`[THIS.GetCountry.GetNameNoFormatting]` works inside a JE `on_complete`; `[ROOT.GetCountry…]` does
  NOT** — it raises `Data error in loc string` and logs an empty field. Use `THIS`.
- **A JE wants a `<key>_reason` loc key** as well as name and desc: `Journal entry is missing loc for
  je_X_reason!` for every entry. Harmless, noisy, trivially avoided.
- ⚠ **A scripted bar's `monthly_progress` runs BEFORE the on_action that feeds it.** The variable-based
  variant logged `Failed to fetch variable for 'pmrprobe_texw' due to not being set` on its first tick.
  Set such a variable in the JE's `immediate`, or guard the condition with `has_variable`.
- Country-direct `every_scope_building` and `every_scope_state × every_scope_building` return **identical**
  sums (GBR 3252 both ways), so the cheaper single-level form is fine.
- The filtered sums discriminate hard against their unfiltered twins (GBR textile 57 against 3252 total
  levels), so the filters are real, not silently-ignored no-ops.

### Probe 2 — the WAR conditions (session `20260811_225546`, same method, 1 run, 1836→1837)

Same arm and method; every candidate trigger asked twice, once with a threshold that must pass and once
with one that cannot, because an invalid trigger inside a `limit` is silently ignored. 16 countries were
at war in the sample (Carlist Spain, Brazil, Fezzan, Tripolitania, Riograndense Republic, Puerto Rico …).

**WORKS:**
- `army_power_projection` as a **country-scope script value** (GBR 1528 · RUS 4568 · FRA 5112 · Carlist
  Spain 1284), and it is readable **inside the enemy's scope**: `>= 0` true, `>= 1e9` false, so the
  comparison is genuinely evaluated.
- `any_enemy_in_war = { … }` **and** `every_enemy_in_war = { add = 1 }` — the second matters, because a
  script value needs the `every_` form to COUNT rather than test.
- `weekly_progress` on a scripted bar: 285 completions of a 4-week unconditional bar, one per country;
  the weekly negative control completed **0** times.
- The whole war term end to end: a bar gated on `is_at_war` + an enemy at least half as strong completed
  for 9 countries in one year.

⭐⭐ **THE `root.` PREFIX IS LOAD-BEARING AND ITS ABSENCE FAILS SILENTLY.** Inside `any_enemy_in_war`,
`army_power_projection >= root.<script_value>` discriminates correctly (true for Fezzan and Carlist Spain,
**false** for Tripolitania and Brazil). Written **without** `root.`, the script value resolves in the
**enemy's** scope — so it compares each enemy against half of *its own* strength, which is always true, and
it read 1 for every country at war. Both spellings parse, neither errors, and only the discrimination test
tells them apart.

❌ **THREE SPELLINGS OF THE BATTALION COUNT ARE ACCEPTED AND IGNORED.** All of these returned *true* even
for countries at peace, and true for their absurd twins:
```
num_mobilized_battalions_greater_or_equal = { value = N }
num_mobilized_battalions_greater_or_equal = N
army_size_greater_than = N
```
⇒ **The `_greater_than` / `_greater_or_equal` / `_less_than` … names in `trigger_localization` are
LOCALIZATION KEYS for rendering a comparator, not script-callable triggers.** The callable form is the
**base name with an inline comparator** — `army_size >= 3` and `army_power_projection >= 5` are what vanilla
journal entries actually write. Use `num_mobilized_battalions >= N`; it is unprobed but is the only form
consistent with the evidence.
⚠ This is the same class as `is_unemployed` (§3.7 of TESTBED_METRICS) and it is why the absurd twin is not
optional: reading only the "low" value would have reported all three dead spellings as working.

⚠ **The log ring carries the PREVIOUS run's lines into the next run's mirror.** Probe 1's journal-entry
keys appeared in probe 2's `logs_live/debug.log` even though those entries no longer existed in the mod.
Count only keys unique to the run being read, or filter by the run's own token (landmine L9).

### Probe 3 — the anti-gaming set (session `20260811_235642`, 1836→1837.6)

❌❌ **`num_mobilized_battalions` IS NOT A COUNTRY-SCOPE TRIGGER — it is CHARACTER scope.** The engine says
so outright, and unlike the dead spellings above it fails **loudly**:
```
Error: Event target link 'num_mobilized_battalions' did not get a matching scope type.
       Expected 'character', but got 'country'
Error: Invalid left side during comparison 'num_mobilized_battalions'
```
⇒ "the country has ≥ N battalions mobilised" **cannot be written directly**. It is a property of a
general's formation, reachable only as `any_scope_general = { num_mobilized_battalions >= N }`.

✅ **What does work at country scope, measured in the same run:**

| term | GBR | RUS | FRA | Carlist Spain | Puerto Rico |
|---|--:|--:|--:|--:|--:|
| `army_size` (battalions) | 68 | 206 | 182 | 60 | 2 |
| `is_at_war` | 0 | 0 | 0 | 1 | **1** |
| front chain (below) | 0 | 0 | 0 | **1** | **0** |
| `has_war_exhaustion` | 0 | 0 | 0 | 1 | 1 |
| casualties / dead | 0 | 0 | 0 | 38 991 / 11 514 | **0 / 0** |

⭐⭐ **Puerto Rico is the whole point.** It is at war and carries war exhaustion, yet has **no front of its
own and zero casualties** — a colonial subject dragged into someone else's war, i.e. exactly the
"technically at war, never actually fighting" case. `is_at_war` alone does **not** exclude it; the front
chain and the casualty count both do, in the same sample. Cuba and the Philippines behave identically.

The verified anti-gaming chain, adapted from vanilla's `je_war_nursing`:
```
is_at_war = yes
any_scope_war = { any_scope_front = { any_scope_general = { owner = ROOT } } }   # a real front
every_scope_war = { add = "num_country_casualties(root)" }                        # unfakeable rate
any_scope_war = { has_war_exhaustion = { target = ROOT  value > N } }             # WAR scope, targeted
```
⚠ **`army_size` is a battalion count and 100 is a HIGH bar early.** At the 1836 start Britain runs 68 and
Carlist Spain 60, so a flat `army_size >= 100` gate excludes Britain and every minor power for decades
while admitting Russia (206) and France (182) from day one.

### Probes 4 and 5 — the general/mobilisation gate (sessions `20260812_001905`, `20260812_003658`)

⭐ **`num_mobilized_battalions` IS reachable — at CHARACTER scope, through the general list.**
`any_scope_general = { owner = ROOT  num_mobilized_battalions >= N }` works, at country scope and
nested inside `any_scope_war → any_scope_front`. `every_scope_general` also resolves at country scope,
so the battalions can be summed. All absurd twins read 0, so none of it is being silently ignored.
⭐ **`count >= N` works inside a list trigger** (vanilla precedent: `any_scope_ally = { … count >= 2 }`),
so *"one general with ≥100 **or** two with ≥50 each"* is expressible as an `OR` of two general lists.

⭐⭐ **BARRACKS LEVELS = `army_size`, EXACTLY.** RUS 206 levels / 206 battalions, FRA 182 / 182 at the
1836 start. The save summaries therefore give army size per country per year for a whole campaign at no
cost — which is how "is 100 battalions under one general ever reachable?" was answered without a run:
the largest army grows from **RUS 206 (1837)** to **GBR 573 (1935)**, so the gate is impossible in the
1830s and ordinary for a major power by 1900. ⚠ A gate measured only on the 1830s will look dead when it
is merely early — this one did, and the reading was wrong.

⚠ **"What share of the army is mobilised" CANNOT be computed reliably.** Σ(per-general mobilised
battalions) ÷ `army_size` exceeds 1 (GBR 1.29, MEX 2.44). `army_size_including_raised_conscripts` is the
better denominator and fixes most of it (Carlist Spain 1.00, Brazil 0.88) but **Mexico still reads 1.50**,
so the two quantities are not perfectly on one basis and this is not a true fraction. Use it only as a
one-sided `>=` gate, where an overshoot can produce a false positive but never a false negative. In
practice mobilisation is near-total when it happens — **every country at peace reads 0** — so a 0.5
threshold reads as "has actually mobilised".
⚠ `army_mobilization_option_fraction` is a **different quantity**: the share of the army carrying one
named mobilisation *option*. It works and discriminates, but it cannot express "half the army is
mobilised".
⚠ `army_size_greater_than` joins the dead list — `Unknown trigger type` in `error.log`, confirming again
that the comparator-suffixed names are loc keys. `army_size >= N` is the callable form.

## RNG seed: readable, not settable headlessly

**You can log which seed a run used; you cannot choose it.** Settled 2026-08-01 by experiment,
including a manual lobby test — don't re-litigate it without new evidence.

**Reading it (works).** The telemetry emits at boot:
```
V3TB|<token>|SEED|[GetGlobalRandomSeed]|custom=[GetGlobalRandomSeedString]
```
`GetGlobalRandomSeed` is a bare **global** data function — vanilla renders it on the loading screen
via `INGAME_RNG_SEED` — so it resolves in any loc string, `debug_log` included. Verified:
`SEED|466290526|custom=`. Runs are therefore identifiable by seed even though the seed is not
chosen.

**Setting it (does not work).** The custom seed is a **lobby-only** input, and `-handsoff` is
precisely the flag that skips the lobby:

- The game rule `custom_rng_seed` can be flipped to `use_custom_rng_seed` in
  `player/game_rules/presets.txt`, but **the flag alone changes nothing** — two runs with it set
  produced seeds 466290526 and 1921701894.
- **No command-line argument exists.** The exe's arg tables around `handsoff`, `continuelastsave`
  and `gdpr-compliant` contain no seed option. ⚠ Web sources claim a `random_seed` CLI argument —
  **they are wrong**: `random_seed` is a *savegame gamestate field* (its binary neighbours are
  `random_count`, `adjacency`, `topology`).
- **A mod cannot supply the value.** `game_rules.md` permits only `default`, `apply_modifier` and
  `flag` per setting. There is no value field.
- The value is delivered by a runtime command, `set_custom_rng_seed_command`, in the same family as
  `set_ready_command` / `sync_players_command`.
- **Where it actually persists:** the **save only**. A manual lobby run with seed `123ABTEST`, then
  a hash diff of all 9 794 files under `Documents/Paradox Interactive/Victoria 3` before and after
  (including after a clean exit), found the string inside the zipped `gamestate` — next to the
  game-rules list and a session GUID — and **in no config file at all**. `presets.txt` gained only
  the flag.

**Consequence.** Same-seed A/B is unavailable, so the telemetry tax stays *bounded* ("no detectable
difference", ~±12 % resolution) rather than measured. The only route to a fixed seed is **resuming a
save**, which carries its own seed — available if ever needed, not currently used.
