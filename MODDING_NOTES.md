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
