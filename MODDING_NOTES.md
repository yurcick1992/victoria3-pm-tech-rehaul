# Victoria 3 modding notes

Engine and tooling behaviour for this mod: how Victoria 3 loads, validates and runs script, what fails silently, what costs the
tick, and how the headless harness drives the game. Each gotcha is stated once, as a rule, with the evidence that settles it: an
F-number (FINDINGS), a dated entry (BUGS_AND_FIXES), a landmine Lnn (TESTBED_LANDMINES) or a game file. Balance rulings are in
BALANCE_FRAMEWORK; every coupling to a vanilla file or number, and what to re-run after a patch, is in ON_GAME_UPDATE.

Target: game **1.13.x "Matcha"**. The mod declares `supported_game_version` 1.13.11; the harness behaviour below was verified on 1.13.9.
All of it is engine behaviour — true until a patch changes it, so re-verify after one.

**Contents.** File loading · Localization · Debugging & validation (self-diagnostics, diagnostic probes) · PS 5.1 traps · Script
semantics: what fails silently · Buildings and production methods (clone-and-swap) · Game-start conversion (`create_building`) ·
Technology: research · What a tech-granting event can CONDITION on (journal entries, progress bars, war conditions, market goods) ·
What script content costs the tick · AI subsidies · Automated headless runs · metadata.json · gfx / icons

---

## File loading & override semantics

- Mods load **after** the base game. Inside a `common/` folder the engine reads every file **alphabetically (A→Z)**; it loads folders,
  not named files. A **new key** in any file just adds. Never edit vanilla files in place.
- **A duplicate key from a differently-named file is REJECTED, and vanilla wins.** The log says
  `gamedatabase.h: Duplicated key <x> will not be created from file: …`. Verified for buildings; assumed for scripted triggers and
  effects (check error.log once before relying on it). To change a vanilla object, replace its **whole file** by using the **same
  filename**; the mod's file must then define everything that file defines (copy the untouched entries verbatim).
- **The filename choice cuts both ways, and nothing errors either way.** Override existing keys → the SAME filename as vanilla. Add new
  keys → a DIFFERENT filename (`zzz_pm_rehaul_*`). Reusing a vanilla filename for additive content deletes that file's vanilla
  contents: naming our method file `01_industry.txt` would wipe every vanilla production method in it.
- **Own a vanilla file only when you change it.** Owning freezes it against every patch and ships someone else's script. So every owned
  file — about 150 in the canon build: buildings, production methods, company types, events, journal entries, static modifiers,
  strategies, state regions, the 1836 history — is **regenerated from the installed vanilla file on every build**, substituting only what
  we change, and every transform asserts its match count (a no-op throws). A patch then flows through on the next build, and a patch that
  moves a matched line stops the build instead of shipping stale script (`build.ps1`, `emit_vanilla_refs.mjs`,
  `emit_research_levers.mjs`, `emit_companies.mjs`; ON_GAME_UPDATE lists every coupling). A transform that comes out equal to vanilla is
  not written (the build prints `production_methods: owning N file(s) [...]`).
- ⭐ **`common/defines/` is the exception: a NEW file with a PARTIAL block overrides only the keys it names**, leaving the rest of that
  category and of vanilla's `00_defines.txt` alone. Everywhere else a differently-named duplicate is rejected. The canon's file:
  ```
  # mod/common/defines/01_pm_rehaul_defines.txt   (loads after 00_*, alphabetically; emitted by emit_techs.mjs)
  NAI = {
      PRODUCTION_BUILDING_AUTONOMOUS_INVESTMENT_CONSTRUCTION_COST_DIVISOR_SCALING = 0.000125
      …
  }
  NEconomy = {
      WORLD_MARKET_MONOPOLY_THRESHOLD = 0.99
  }
  ```
  ⚠ A value outside the validator's hardcoded range is **discarded** with one `defines.cpp` "not valid with given value" line in
  error.log, and the key keeps vanilla's value — the bound can be a cross-reference to another define (L33). ⚠ Some vanilla defines are
  **dead**: the engine never reads them, and debug.log says `Define 'X' defined in '<file>' not specified` for vanilla's own line too
  (15 keys in 1.13.11; `WORLD_MARKET_MONOPOLY_MIN_SHARE` is one — F241). `emit_techs.mjs` refuses the known dead keys.
- **On_actions merge their DATA, not their blocks.** `<vanilla_on_action> = { on_actions = { <ours> } }` or `events = { … }` in our own
  file adds to vanilla's; a second `effect` or `trigger` block on a vanilla on_action **replaces** vanilla's (L22;
  `common/on_actions/_on_actions.md`). So hang our effects on a vanilla on_action by NAME, in an `on_actions = { … }` list — the
  self-diagnostic on `on_game_started_after_lobby`, the research placement on `on_acquired_technology`, the pulses.
- Text files under `common/` and `history/` **should be UTF-8 with BOM** (vanilla's are). Without it the log warns
  `lexer.cpp: File … should be in utf8-bom encoding (will try to use it anyways)` — non-fatal; every emitter writes a BOM. A writer that
  reads through a BOM-stripping helper must write the BOM back (BUGS_AND_FIXES 2026-09-25).
- ⚠ **The converse bites every tool that READS those files:** strip the BOM before matching `^name = {`, or the first block of each file
  is invisible. And an id class must admit a hyphen (`pm_ammonia-soda_process`, `pm_coal-fired_plant`), or `[a-z_0-9]+` silently splits
  the key (BUGS_AND_FIXES 2026-08-12).
- `replace_paths` in metadata.json makes the engine ignore a whole vanilla folder — see *metadata.json*.

## Localization — every language needs its own file

**A real correctness issue, not cosmetic.** Victoria 3 does not reliably fall back to English for a key missing in the selected
language: the UI shows the raw token (`building_paper_mill_sulfite`). Every key we add must exist in **all 11 languages**:

```
braz_por  english  french  german  japanese  korean
polish    russian  simp_chinese  spanish  turkish
```
(`jomini` and `modifiers` are engine folders, not player languages.)

Rules for each `localization/<lang>/…/<name>_l_<lang>.yml`:
- Encoding **UTF-8 with BOM**; first line the header `l_<lang>:` matching the folder (`l_german:`).
- Each entry: a **leading space**, then `key:0 "Text"`. `:0` is a version number; `$key$` interpolates another key; `[concept]` links a
  game concept.
- The folder is spelled **localization** (with a *z*). `localisation` fails silently.
- **Overriding a vanilla key** from a normal file logs `pdx_localize: Duplicate localization key …` and vanilla usually wins. Keys in a
  **`localization/<lang>/replace/`** file hard-overwrite any identical key and also define new ones, so the mod emits all its loc there
  (`zzz_pm_rehaul_*_l_<lang>.yml`).
- Load order is the **opposite of `common/`: reverse-alphabetical (Z→A)**, so an early-letter file is applied last and wins. It matters
  only when two files set the same key.

**How the mod fills the other ten languages.** Tiered building and method names reuse vanilla's own per-language translations (a
building name token and a `$pm_…$` reference, resolved per language by `build.ps1`); genuinely new text stays English in every file.
So a German file reads `Tier 0 craft. Lebensmittelfabriken ($pm_bakery$). Recipe BE 65%`, and a new name reads the same in all 11.

### Loc: showing a script value, and line breaks

- A loc string can print a script value evaluated in a scope: `[ROOT.GetCountry.MakeScope.ScriptValue('pmr_src_x')|0]` (vanilla does the
  same for `acw_reincorporate_dixie_loyalist_min`). In a journal entry's text ROOT is the country; the research entries show each source's
  live figure this way.
- A loc VALUE is one line of the yml. A line break inside the text is the two-character escape `\n`; a real newline splits the entry, and
  the rest becomes malformed lines the game ignores — the build does not catch it (`emit_research_events.mjs` escapes them).
- **No ASCII apostrophe** in any text a progress bar displays: its tooltip pastes the text into a single-quoted data-function argument
  (BUGS_AND_FIXES 2026-09-30; the emitter throws on one). French vanilla's typographic ’ is harmless.
- `GetName` on a country or good emits a clickable tooltip blob (`…CountryTooltip GBR!flag_overlay! United Kingdom!!`);
  `GetNameNoFormatting` prints plain text but is localized; a good's `GetKey` is stable and language-independent.

## Debugging & validation

- **`error.log`** (`Documents\Paradox Interactive\Victoria 3\logs\error.log`) lists missing keys, unresolved references (bad
  technology / group / method names), brace and parse errors, missing textures. Read it after any in-game load: the build's linters check
  economics and structure, not engine errors. It is a shared ring full of vanilla's own noise — count against the vanilla baseline and
  by the run's own position (TESTBED_OPERATIONS §4 has the noise catalogue; `grep -c zzz_pm_rehaul` finds lines naming our files).
- **`debug.log`** carries every `debug_log` line, in a plain launch too (`debug_log` is not gated behind `-debug_mode`; verified 1.13.9).
- **The log ring.** The game keeps the current `error.log` / `debug.log` plus **5 rotated backups** (`error.1.log` … `error.5.log`),
  512 KB each; it rotates **by size and again at every launch**. A long run overwrites its own early lines, and a log from more than
  five launches ago is gone. Copy what you need before relaunching; the harness mirrors the logs as they grow (*Automated headless runs*).
- **`-debug_mode`** (launch option) gives richer script errors and hot-reload of some assets. ⭐ In debug mode the game shows **each
  subtask's share of tick time, in milliseconds** — the tool for a slowdown nobody can explain from logs: load a save from inside the slow
  period and read where the time goes. The testbed keeps such saves (`<run>\quarantine_saves\`, `tools/testbed/slow_quarantine.mjs`,
  TESTBED_OPERATIONS §7.6). The per-task list has no log output; the menu path and readout are not yet recorded here.
- Mods that change checksummed files (most of `common/`) disable Ironman and achievements and change the checksum; multiplayer needs the
  same mod and checksum on every machine.
- **Triage of the errors you find.** Something we generated is malformed or names a missing key → fix it, and record the cause in
  BUGS_AND_FIXES if it would surprise the next reader. A vanilla script naming a tiered industry (a rung-0 key, a moved method, a
  throughput modifier) is rewritten to the ruled rungs by `emit_vanilla_refs.mjs`, whose scan stops the build on an unhandled reference
  (L40); a new class of such reference is catalogued in TIER_REFERENCE_AUDIT, not fixed inline.

### Self-diagnostics

The builder emits **`mod/common/on_actions/zzz_pm_rehaul_diag.txt`**, which fires at game start and writes to `debug.log` (search
`PM_TECH_REHAUL`):
`PM_TECH_REHAUL: init OK - mod loaded, game started (build yyyy-MM-dd HH:mm) on <date>`.

- **Marker present** → the mod's script loaded and its on_action fired; the timestamp says which build (it matches the mod name in
  metadata.json). **Marker absent** → the mod failed to load or the on_action did not merge → read `error.log`. The two logs are the pair.
- It only adds `on_actions = { pm_tech_rehaul_diag }` to vanilla's `on_game_started_after_lobby`, never an `effect` block (L22).
- **The convention:** when a change might break something no linter sees (naval capacity, method goods, gated methods, a building failing
  to load), add an invariant tripwire inside `pm_tech_rehaul_diag` in `build.ps1` that logs `PM_TECH_REHAUL WARN: <what broke>`. The
  marker appears at the 1836 start, so one in-game day is enough; run to 1837.2.1 to also catch a first monthly or yearly tick.

### Writing a temporary diagnostic probe

When adding a tripwire that logs per-country state:
- **Hook a pulse the way the diagnostic hooks game start:** `on_five_year_pulse_country = { on_actions = { <ours> } }` merges with
  vanilla's `events` / `on_actions` on that pulse. The root of a `…_country` pulse **is the country** (`has_strategy`, `is_ai` work
  directly). `on_monthly_pulse` fires on the 1st of every month and has **no root scope** — `game_date` and `debug_log` work there, a
  country does not.
- **A country's name in a `debug_log`** has no preset data context: `[This.GetName]` fails (*"Failed to find type 'This'"*) and
  `[Country.GetName]` prints **blank** (*"No context supplied … wanted 'Country'"*; the tell is a double space). Use
  **`[SCOPE.GetRootScope.GetCountry.GetNameNoFormatting]`**. In a journal entry's `on_complete`, use `THIS` (*Journal entries and
  scripted progress bars*).
- **Gate wiring checks on something guaranteed to exist,** because a silent-false trigger looks exactly like a genuinely false condition.
  Railways exist in 11 places in 1836, so a railway check reading 0 proves nothing; every incorporated state has a
  `building_urban_center`. Layer the checks (state exists → building iterates → the specific trigger evaluates) so a blank names the
  broken layer.
- ⚠ A probe of 2026-07-23 saw `any_scope_building` straight from country scope return false and concluded it needs `any_scope_state`
  first. The controlled probe of 2026-08-11 (session `20260811_215142`, with a negative control) found country-direct
  `every_scope_building` equal to the state-nested sum, and vanilla's Balkan League button uses `any_scope_building` from country scope.
  Trust the later probe; if an iterator reads false, layer the check.
- **The ring rotates by size**, so a late read does not contain early pulses: stop the run near the date you want, or tail the log into
  a file as it is written.

## PS 5.1 traps (Windows PowerShell 5.1)

Not Victoria 3 behaviour, but every one cost hours here (the user's machine runs PowerShell 5.1 on a ru-RU / CP1251 system).

- **Keep `.ps1` files pure ASCII.** PowerShell 5.1 reads a BOM-less script as ANSI (CP1252): a UTF-8 em-dash (`E2 80 94`) decodes as
  `â€"`, and `0x94` is a smart double quote that ends the enclosing string, giving parse errors dozens of lines away. Use `-`, `->`.
- **Read JSON with `-Encoding UTF8`.** `Get-Content -Raw` reads a BOM-less file in the system codepage, so a UTF-8 `·` becomes `В·`.
- **Write with `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`, never `Set-Content`.** Without `-Encoding`,
  `Set-Content` encodes to the system codepage and silently best-fits or drops what it cannot hold: an `é` came back as `e`, with no
  warning (BUGS_AND_FIXES 2026-07-31). `Out-File -Encoding utf8` writes a BOM, which makes `JSON.parse` throw (2026-08-11).
- **Put `$null` on the LEFT of a null check.** `$collection -ne $null` filters the collection; an empty one yields an empty, falsy
  result:
  ```
  $hs = New-Object 'System.Collections.Generic.HashSet[string]'
  [bool]($hs -ne $null)   # False   <- empty set
  [bool]($null -ne $hs)   # True    <- correct
  ```
  A de-duplication guard in `run_observer.ps1` written the first way never ran, so its set stayed empty and the branch stayed dead.
- **Format numbers with InvariantCulture.** On a non-English Windows a double interpolates as `0,5`, which Victoria 3 cannot parse and
  which breaks only on that machine. `build.ps1` routes quantities through `Format-Qty`; `tools/testbed/summarise.ps1` pins the whole
  script with `[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture`.
- **Never `@($list)` a `System.Collections.Generic.List[object]`**: it throws `Argument types do not match`, blamed on the enclosing
  statement. Use `$list.ToArray()`. `List[string]` is fine.
- **A bare `Write-Output` inside a function joins the function's return value.** A builder note became line 0 of a returned building
  block and was written into the mod (BUGS_AND_FIXES 2026-08-19, L24). Use `Write-Host` for messages.
- **Variable names are case-insensitive:** a local `$out` IS the script's `$Out` parameter (BUGS_AND_FIXES 2026-08-11).
- **`Start-Process -ArgumentList` quotes nothing**, and the repo path has a space — quote every path there. **`& exe @args` quotes each
  element itself** — pre-quoting nests the quotes. Two styles, opposite rules (BUGS_AND_FIXES 2026-08-11).
- **`Start-Process -PassThru`: read `$p.Handle` right away** (`$null = $p.Handle`), or `ExitCode` stays empty after exit
  (BUGS_AND_FIXES 2026-08-11).
- **`Start-Process … -ArgumentList @(…) + $(…)` binds the `+` as a positional argument** and fails with "A positional parameter cannot be
  found that accepts argument '+'", blamed on the calling script; a parse check calls it clean. Build the array first, then pass it
  (BUGS_AND_FIXES 2026-08-12).
- **`Add-Content` throws "Stream was not readable" while another process holds the file open** — a reader that keeps it open (`tail -F`)
  defeats any retry (L29). Read live files with short reads.
- Launching detached, redirected stdio and job objects: *Automated headless runs* (L30).

## Script semantics: what fails silently

The dangerous failures in Jomini script are the ones that produce a plausible number. Rules:

- **An invalid trigger inside a `limit` is silently ignored** — the limit degrades to whatever else it holds, and every candidate
  matches (TESTBED_METRICS §3.7 `is_unemployed`; BUGS_AND_FIXES 2026-08-02, `is_production_method_active` used at building scope).
  **Ask every condition twice**: once with a threshold that must pass and once with an absurd twin that cannot. A filtered result equal
  to its unfiltered twin, or identical across mutually exclusive candidates, is a failed filter, not a measurement (F51).
- **The `_greater_than` / `_greater_or_equal` / `_less_than` names in `trigger_localization` are LOCALIZATION keys**, not triggers. Some
  parse and return true; one logs `Unknown trigger type`. The callable form is the base name with an inline comparator (`army_size >= N`).
  The three dead spellings are listed under *War conditions*.
- **A script value that does not exist returns 0, not an error** (`MakeScope.ScriptValue('<missing>')`; BUGS_AND_FIXES 2026-08-02, L6).
  A clean 0 for every country is a missing value.
- **A loc data function written as script abandons the rest of the file.** `is_goods = GetGoods('grain')` in a `limit` is a parse error,
  and Paradox drops everything from the error onward, so a bad line near the top of a file destroys every block below it
  (BUGS_AND_FIXES 2026-08-02, L2). Data functions belong only inside quoted loc text.
- **One bad data function kills its whole loc line**: the line is not printed, only
  `pdx_data_localize.cpp: Data error in loc string '<the whole string>'`. Probe a new function on its own line first.
- **`c:TAG` on a country that does not exist is an ERROR, not false** (`Invalid right side during comparison 'c'`, re-raised on every
  evaluation; BUGS_AND_FIXES 2026-08-06, L1). `exists = c:TAG` is false with no error — guard every named tag with it first.
- **A scope link can be INVALID, not merely false.** `owner`, `market`, `capital`, a general's or a front's country can resolve to
  nothing, and every comparison through it logs an error each evaluation. Guard with `exists = <link>` before comparing
  (BUGS_AND_FIXES 2026-09-05).
- **`root.` is load-bearing inside an inner scope.** `army_power_projection >= root.<value>` inside `any_enemy_in_war` compares against
  the root country; without `root.` the value resolves in the enemy's scope. Both parse, neither errors (F51).
- **`ROOT` is not valid inside a `scripted_progress_bar`** — vanilla uses it zero times in its 14 bar files; ours errored on every tick
  (BUGS_AND_FIXES 2026-08-17). Compute the condition where ROOT is valid (an on_action, a journal entry) and pass it to the bar as a
  variable — the research bars' war gate is an expiring `pmr_wargate_<tech>` set in `on_monthly_pulse_country`.
- **A construct idiomatic in one file type may be meaningless in another.** When script fails uniformly rather than occasionally, suspect
  the context, not the data.

## Buildings and production methods

### A building with no `ownership_type` cannot be built in a FOREIGN state

The build menu lists it in a foreign state (a subject's, with investment rights) and refuses it: *"<building> cannot be constructed in a
foreign state"* (`CANNOT_EXPAND_BUILDING_NOT_OWNABLE`). Vanilla leaves `ownership_type` out on exactly the buildings no foreign country
may build — military buildings, government administration, universities, monuments, canals, the construction sector — and sets it on
everything a foreign government can build (`self` on the trade centre, ports, power plant and industry; `other` on financial districts,
manor houses and company HQs). `is_government_funded = no` on the group is not enough. ⇒ A building meant to be buildable abroad needs
`ownership_type = self` (BALANCE_FRAMEWORK §10.89.9).

### A production method the building can NEVER run is still SHOWN — greyed, at its own numbers

A method whose `unlocking_production_methods` names main methods the building lacks can never be selected there, but the panel still
lists it in its group, locked, with its full goods and jobs (vanilla's Elastics, −70 clothes, beside a craft rung making 2.7; BUGS_AND_FIXES
2026-10-02, BALANCE_FRAMEWORK §10.93). The engine's hiding field, `is_hidden_when_unavailable = yes` (on a method, or on a whole group —
`common/production_method_groups/production_method_groups.md`), hides on ANY unavailability, technology included. ⇒ This mod does not
list a method its building can never run (`emit_secondaries.mjs`); `tools/lint_pm_combos.mjs` fails the build on one.
⚠⚠ **Never put `is_hidden_when_unavailable` on a method gated by `unlocking_production_methods` — the player can then never select
it.** The panel counts it as an option and refuses every switch to it (BUGS_AND_FIXES 2026-10-11). Vanilla hides only methods gated on
technology or a principle; the same main-method gate without the flag works (Bone China, Precision Tools).

### `required_input_goods` locks a method until the good is already traded

`required_input_goods = <good>` makes a method unselectable until that good is already traded in the market — vanilla uses it on
`pm_electric_streetlights` so streets cannot be lit before electricity exists. On a method that PRODUCES the good it is a deadlock, and
nothing errors: our streetlights generate electricity, so with vanilla's line kept no urban centre could ever switch to them. The
builder's `pm_goods` writer drops a `required_input_goods` whose good is no longer among the override's inputs (BALANCE_FRAMEWORK
§10.43.2).

### Content-specific reminders (this mod)

- A production method group with exactly one method = that method is always active (no choice): "one main method".
- A method inside a single-method main group carries **no `unlocking_technologies`**; the gate sits on the **building**, so the building
  has a valid main method the moment it can be built. A merged rung's method joins its host's main group as a second method, gated by its
  own technology (CLAUDE.md §5.4).
- The vanilla building key stays the industry's **first rung** (the craft rung where there is one), so companies, journal entries, history
  placement and AI that name `building_<x>` keep working; higher rungs are new keys. ⚠ So a disabled industry's rung-0 key IS the vanilla
  building — every reader loop must skip `disabled` industries (L27).
- `aliases = { … }` on a building preserves the plural / alternative keys other files use.
- One vanilla secondary method cannot hold per-rung numbers, so `emit_secondaries.mjs` mints its own method and group per (rung,
  secondary); the "off" methods carry no goods or jobs and are kept by reference.
- **Modifier types are hand-enumerated in vanilla, not generated per building.** `building_<key>_throughput_add` and its siblings exist
  only where declared (United Fruit uses the plantation GROUP modifier because `building_banana_plantation_throughput_add` does not
  exist). A new building key named in a modifier needs its own declaration in `common/modifier_type_definitions`, plus loc
  (`emit_companies.mjs`).
- **A building group with `capped_by_resources = yes`** takes its per-region cap from `capped_resources = { building_<type> = N }` in
  `map_data/state_regions`, keyed by building TYPE (any group); whole-file copies of the region files override vanilla's (F221 — the dams).

### Clone-and-swap: some vanilla buildings carry fields our schema cannot model

Ports, railways and power plants carry engine-critical fields — `port = yes`, `terrain_manipulator`, large conditional `ai_value` and
`should_auto_expand` blocks, `potential` — that a building regenerated from the config's simple schema would lose. A tiered industry
flagged `clone_from_vanilla: true` (with `source_file` naming the vanilla buildings file the builder then owns) is therefore emitted by
COPYING its vanilla block and swapping only the key, the technology, the production method groups and the construction cost
(`New-ClonedBuilding` in `tools/build.ps1`). The canon tiers none of these industries (they are vanilla); the machinery serves books that
do.

## Game-start conversion (the 1836 "savegame")

The 1836 start is **generated from `common/history/buildings/*.txt`** (16 regional files); there is no bundled save. Each building is a
`create_building` block:

```
create_building={
    building="building_textile_mill"
    add_ownership={ building={ type="building_textile_mill" country="c:SWE" levels=3 region="STATE_SVEALAND" } }
    reserves=1
    activate_production_methods={ "pm_handsewn_clothes" "pm_no_luxury_clothes" "pm_traditional_looms" }
}
```

`activate_production_methods` lists one method per group (main + each secondary's "off" state). A block naming a method its building
does not carry logs `create_building effect [ Invalid production method: <pm> ]` (BUGS_AND_FIXES 2026-07-18) and is rejected whole
(BALANCE_FRAMEWORK §10.93); `lint_pm_combos.mjs` fails the build on one.

Because the tier split moves main methods onto other buildings, the start must be **converted**, not copied: `tools/convert_history.ps1`
maps each (vanilla building, active main method) to the rung that method belongs to, rewriting `building=` and the `type=` inside
`add_ownership`, swapping the main method token and keeping the secondary tokens, then applies the book's start rules
(`start_exceptions_file`). Inert base methods that match no rung (a port's `pm_anchorage`) are mapped through `vanilla_pm_aliases`. The
mod's converted set replaces vanilla's through `replace_paths: ["common/history/buildings"]` in metadata.json (otherwise every factory is
placed twice). Rebuild after every game update.

### `create_building` IS GATED ON THE STATE OWNER'S TECHNOLOGY — AND FAILS SILENTLY

The most expensive engine trap this mod has hit (F68). A `create_building` block in `common/history/buildings` is validated against the
**country that owns the region_state**, using the building's own `unlocking_technologies`. If that country lacks the technology the block
is dropped and the building never exists. The build succeeds, the mod loads, the game runs; the only trace is one line in `error.log`:

```
Error: create_building effect [ … Dutch East Indies … must have invented … The Screw Steamer … ]
Script location: common/history/buildings/12_indonesia.txt:683
```

- ⚠⚠ **`add_ownership` is not consulted.** Naming an advanced overlord as owner does not satisfy the check: of 38 seeded steam ports
  owned by GBR / FRA / NET, the 22 in a subject's state were all rejected, identically in ten runs; granting the technology to each
  subject fixed all 22.
- Why (the loc evidence is direct, the conclusion inference): the error is the generic `LACKING_TECHNOLOGY_SINGLE` check that gates
  construction and method selection, and it needs ONE country. `add_ownership` is a set of shares, mostly not countries (vanilla's 1836
  files: 2,361 `building=` shares against 898 `country=` and 21 `company=`), so the state owner is the only unambiguous country.
- ⚠ **In-game construction is not gated this way.** A country can build in any state its diplomacy allows without the local country
  holding the technology; the history effect is a separate code path. Do not reason from one to the other.
- **The fix.** The 1836 technology grant is derived from the converted map, so every country holds the technology of every method it
  runs at the start (BALANCE_FRAMEWORK §10.55; `emit_techs.mjs`). A building a start rule seeds where the vanilla map has none is
  declared in the config's `start_tech_grants`, emitted as a guard inside that country's own starting-tier effect. Landmine **L14**
  (`verify_start_techs.mjs`) fails the build on a country owning a building its technologies cannot unlock; check at 1836.2.1, not a year
  later.
- It is documented nowhere: the wiki's effect tables come from the engine's script-doc dump (signature and scope only;
  `create_building` is not in it). The one statement of the rule is the error tooltip.

## Technology: research, spread, and what the AI actually weighs

- **Two independent channels.** Directed research spends weekly innovation on the one technology selected. **Spread** is separate and
  automatic: each country may have one technology per tree spreading to it from countries ahead, at
  `(25 + 75 × literacy + 0.2 × unspent innovation) × (1 + Σ mult) × rand(0.5, 1.5)` per week
  (`country_tech_spread_add` / `_mult`, and the per-category `country_production_tech_spread_mult`, `country_military_…`,
  `country_society_…`). Spread grants **progress toward** a technology and finishes what it starts without the AI noticing.
- **The spread constants are static modifiers, not defines.** They sit in `common/static_modifiers/00_code_static_modifiers.txt`, whose
  header says *"Effects are fully scriptable here"* and *"these names can NOT be removed or changed, as the code uses them"* — the block
  names are fixed, the numbers are ours:
  ```
  base_values           = { country_tech_spread_add = 25  }   # the flat term
  country_literacy_rate = { country_tech_spread_add = 75  }   # x literacy (0..1)
  excess_innovation     = { country_tech_spread_add = 0.2 }   # x unspent innovation points
  ```
  ⚠ The innovation term is 0.2 per point (unspent ÷ 5). `base_values = { country_tech_spread_mult = 2 }` would scale all three at once;
  ⚠ multipliers **add** rather than compound (vanilla's +5% / +25% bonuses land as `1 + 2.0 + 0.25`, not `3 × 1.25`).
  The file (1,029 lines, 149 blocks) also carries weekly innovation, the innovation cap, bureaucracy, authority, influence, minting, tax
  capacity and infrastructure, and cannot be overridden partially. **The mod owns it for the research levers** (base innovation, the cap
  and the cap's literacy term at 25, BALANCE_FRAMEWORK §10.96, §10.101.1): `emit_research_levers.mjs` regenerates it from vanilla on every
  build, replacing only the named lines and throwing unless each key occurs exactly once in its block. Spread stays vanilla's (§10.54):
  its lines are untouched.
- **No vanilla technology requires one from another tree** (0 of 179). Moving a technology between trees means re-rooting its
  prerequisites on the new tree.
- **Progress is stored per technology and persists.** Switching research away does not discard it, so a country can sit at 90% on
  something it is not researching.
- **`add_technology_progress = { progress = N technology = X }`** is used 68 times in vanilla, every time with a literal number and a
  literal technology key; a script-value `progress` or a technology read from a variable is unverified either way.
- **`has_technology_progress = { technology = X progress >= p }`** is declared in `trigger_localization`, used by no vanilla file, and
  reads a **fraction of the PENALISED cost** (agreed with `GetProgress ÷ GetCost` on 219 of 219 readings, F160).
- ⭐ **The exe string pool carries the engine's usage hints** for triggers and effects vanilla never calls:
  `grep -a -o -E "[a-z_]{6,40} = \{[^}\"]{3,110}\}" binaries/victoria3.exe` prints e.g.
  `has_technology_progress = { technology = X progress = Y }`, `has_employee_slots_filled = { pop_type = X percent = Y }`,
  `add_journal_entry = { type = <key> target = <scope> }`. Reach for it before guessing a key.
- ⭐⭐ **A grant that reaches the cost acquires the technology on the spot** (F160): `on_acquired_technology` fires inside the granting
  effect, whatever the country is researching. A grant short of the cost leaves it part-paid until the next grant (F160 §5: plateaux at
  0.80 of cost with Σ = 1 and 0.67 with Σ = 2 after two half-cost stages). ⚠ Untested: whether a cost that FALLS below banked progress
  (an earlier technology researched, the penalty shrinking) completes it. The finish boost (`tools/emit_tech_finish.mjs`) covers that and
  every other leftover: `has_technology_progress >= 0.99` → `add = 10000` in each technology's `ai_weight`.
- **The AI's exposed weighting has no progress term.** Its technology model in `common/defines/00_ai.txt` is two constants:
  ```
  TECH_RANDOM_FACTOR       = 1.0  # the higher this is, the more random AI tech research will be
  TECH_COST_PENALTY_FACTOR = 5.0  # AI tendency to research a tech is divided by
                                  #   ( 1 + this * ahead of time penalty / era base cost )
  ```
  That is how anachronistic a technology is, not how much of it is paid. An argument from what the engine exposes, not a proof.
- ⭐⭐ **A conditional `add` in `ai_weight` does steer the AI's choice** (F160 §6, forced A/B): with one ignored technology at 99% in every
  country, the next choice took it 52 of 52 times with `if = { limit = { has_technology_progress = { … progress >= 0.99 } } add = 10000 }`
  and 0 of 42 without. ⚠ The AI chooses only when its current research completes — for a small country that can be two years away.
  `while = { limit = { … } <effect> }` works in on_action effects; a stepped `add_technology_progress` loop that stops on
  `has_technology_progress` sets progress to a fraction of a cost script cannot read.
- ⭐⭐ **The ahead-of-time penalty, exactly** (F160: 76,681 engine readings, 291 countries, 100% match):
  `cost = era_cost × (1 + TECH_AHEAD_OF_TIME_PENALTY_FACTOR × Σ)`, factor 0.25, Σ = the sum over the UNRESEARCHED technologies of the same
  category in earlier eras of (era − their era). `can_research = no` technologies are not counted (sericulture, the only one). Readable
  per country in loc as `[GetTechnology('X').GetCost(THIS.GetCountry.Self)|0]` (and `.GetProgress(…)`). There is no trigger for the
  penalty or the cost; `has_technology_progress` already reads the fraction of the penalised cost.
- ⭐ **The AI's pick is the maximum after randomisation** (Dev Diary #59): each score is rolled into `[X / (1 + R), X × (1 + R)]`,
  R = `TECH_RANDOM_FACTOR` 1.0, i.e. 0.5×–2×, so **a 4× weight edge guarantees the pick** and anything less is a lottery. The divisor
  `1 + TECH_COST_PENALTY_FACTOR × penalty ÷ era_cost` = `1 + 1.25 Σ` applies outside `ai_weight`. Vanilla's weights are near-flat (mostly
  `value = 1`; heaviest 101.5, napoleonic_warfare with je_sick_man_army; median 1.5), so on a wide frontier the pick scatters.
  ⚠ `ai_weight` is a script value, evaluated left to right with no order of operations: a `multiply` after an `add` scales the add.
- **Research modifiers are category-wide, never per technology** (`country_production_tech_research_speed_mult`,
  `country_tech_research_speed_mult`, `country_weekly_innovation_add` / `_mult` / `_max_add`,
  `country_ahead_of_time_research_penalty_mult`, the per-category spread multipliers; `country_tech_group_research_speed_mult` is
  defined and used nowhere). One technology can only get flat progress, or the whole tree a speed-up.
- **A production method can pay research directly, scaled by staffing:** `country_modifiers = { workforce_scaled = { … } }` applies a
  country modifier scaled by staffed level ("between 0.0 and building level"). Vanilla's universities do this with
  `country_weekly_innovation_add = 1 / 1.5 / 2` (the mod scales those by a sixth, §10.101.1). Diffuse, not directed at one technology.

## What a tech-granting event can CONDITION on

The engine facts behind the research journal entries (`tools/emit_research_events.mjs`), from the shipped game files and docs, the exe
string pool, and five probe runs of 2026-08-11/12: probe 1 `20260811_215142` (journal entries, occupancy), probe 2 `20260811_225546`
(war conditions), probe 3 `20260811_235642` (anti-gaming), probes 4–5 `20260812_001905` / `20260812_003658` (generals, mobilisation).
F51 holds their main results and tables; a fact below that F51 does not carry names its probe. Every probe asked each condition twice,
against a threshold that must pass and an absurd twin that cannot.

- ⭐⭐ **`can_research = <tech>` is exactly "all prerequisites researched AND not yet researched"** — one cheap engine-side trigger.
  Vanilla's `je_victoria_terminus` writes `OR = { can_research = steel_frame_buildings  has_technology_researched = steel_frame_buildings }`
  precisely because it goes false once researched. Related: `has_researchable_technology = yes`, `has_technology_discovered`,
  `is_original_inventor_of`.
- **A script value can be used as a trigger** (`pmrprobe_tex_lvl >= 1`), and `set_variable` from a script value then `var:x` as a trigger
  works (probe 1).
- **Ownership is expressible:** `levels_owned_by_country = { target = c:XXX  value >= N }` inside a building scope separates who owns the
  levels from whose territory they sit in; `country_ownership_fraction` / `private_ownership_fraction` give the split.

### Counting industry

Four instruments, very different costs:
- `country_has_building_type_levels = { target = bt:building_X  value >= N }` and
  `country_has_building_group_levels = { type = bg_X  value >= N }` — country scope, engine aggregate, **levels only, staffing ignored**.
  Cheapest; vanilla runs the first inside a building's `ai_value` (`05_military.txt`).
- `any_scope_building = { is_building_type = X  level >= N  occupancy >= 0.5 … }` — per building. Keys verified inside a building scope:
  `is_building_type`, `is_building_group`, `level`, `occupancy`, `weekly_profit`, `earnings`, `cash_reserves_ratio`, `is_subsidized`,
  `is_under_construction`, `has_active_production_method`, `has_failed_hires`, `building_has_goods_shortage`,
  `private_ownership_fraction`, `country_ownership_fraction`, `levels_owned_by_country`. The building-scope method test is
  `has_active_production_method = pm_x`; `is_production_method_active` is a STATE-scope trigger taking a block.
- ⭐ **Staffed levels, with occupancy as a WEIGHT** — `Σ(level × occupancy)`:
  ```
  every_scope_building = { limit = { is_building_type = X }
                           add = { value = this.level  multiply = occupancy } }
  ```
  Verified to five decimals against the per-building data functions `GetExpansionLevel` / `GetEmploymentPercentage` in seven countries
  (F51). Bare `occupancy` and `this.occupancy` agree. ⚠⚠ **Never `limit = { … occupancy >= 0.9 }` with `add = this.level`**: that is a
  filter, and seven levels at 50% staffing (3.5 level-equivalents) score zero while three full levels pass. Country-direct
  `every_scope_building` and `every_scope_state × every_scope_building` return identical sums (GBR 3,252 both ways, probe 1), so the
  single-level form is fine.
- ⚠ **Level × occupancy × the rung's employment is staffed CAPACITY, not bodies.** It equals headcount at the base method and overstates
  by up to ~30% where an automation method is active (automation cuts up to 1,500 of ~5,000 laborers a level); correct per building with
  `has_active_production_method`. **True headcount** only via `every_scope_pop = { limit = { pop_employment_building = X } … }` — a
  pop-scope boolean that walks every pop in the country; there is no building- or country-scope employee count. Vanilla uses that loop
  only in one-off effects, never on a pulse.
- ⇒ Author "Y people employed" as people and compile it to staffed levels from the rung's `employment`. ⚠ Guard the divide: a rung with
  zero base employment (the art academy's jobs sit in its ownership group) never reaches a mark (BUGS_AND_FIXES 2026-09-03).

### Journal entries and scripted progress bars

- **Journal entries are the engine's own conditional progress bar, and they run for AI countries.** `is_shown_when_inactive` (default
  no) and `possible` (default yes) both true ⇒ the entry **activates by itself** — no `add_journal_entry`, no on_action; it did so for all
  285 countries in a year, and a never-true negative control completed 0 times (F51). `can_deactivate = yes` lets it fall back to
  inactive. AI participation is proven by vanilla: `je_meiji_restoration`'s `on_complete` has an `is_player = no` branch.
- **Auto-activation is an engine sweep over countries** (every 14 days inactive, 4 active), so a tag that first exists in 1880 is swept
  like any other; `add_journal_entry` is a one-shot and a new tag misses it. Decentralized countries drop out for free: their
  `country_type` has `can_research = no` and `has_events = no`. Set `can_revolution_inherit = yes` (*"Revolutions also get all variables
  from the defeated parent country"*) and `transferable = no`.
  ⚠ The sweep costs every month for every entry TYPE carrying `is_shown_when_inactive` (*What script content costs the tick*), so the
  canon places first stages from script instead (`research_events.placement = script`, F221): on `on_acquired_technology` (root = the
  country), at the campaign start, and by a yearly retry. ⚠ **A revolt is created, acquires its technologies — firing
  `on_acquired_technology` — and only then inherits its parent's entries**, so a placement that tests `has_journal_entry` wins the race and
  the inheritance logs "already has a journal entry" (F227); the emitter places nothing in a revolutionary country. A revolt inherits
  entries but not variables, so a placed entry must also test `has_journal_entry` for every stage.
- **Two independent bar systems.** *Goal:* `current_value` + `goal_add_value` (summed at activation) with
  `complete = { scope:journal_entry = { is_goal_complete = yes } }`, `progressbar = yes`, `display_progressbar_as_months = yes`.
  *Scripted:* `scripted_progress_bar = <key>` from `common/scripted_progress_bars`, with its own `min_value` / `max_value` / `start_value`
  and a `monthly_progress = { add = { desc = … if = { limit = {…} value = N } } }` block (or `weekly_progress`, verified in probe 2), read
  back as
  `"scripted_bar_progress(<key>)" >= N`. Bar state is per entry instance.
- ⚠⚠ **The goal re-activation trap.** `goal_add_value` is evaluated at activation and **added to** `current_value`; an entry that
  deactivates and reactivates while its counter has grown re-bases the goal upward and can never complete. Keep it active and gate only
  the tick, reset the variable in `immediate`, or use a scripted bar (fixed `max_value`).
- **Order within a period:** a scripted bar's progress update runs **before** the entry's own pulse, and before an on_action that feeds
  it — the first tick logged `Failed to fetch variable … due to not being set` (probe 1). Set such a variable in `immediate` or guard with
  `has_variable`. `on_weekly_pulse` / `on_monthly_pulse` / `on_yearly_pulse` inside an entry take `effect = {}` and / or `events = {}`.
- **A bar can be reset from script**: `je:<type> ?= { add_progress = { value = -N name = <bar> } }` (vanilla's French monarchism), read by
  `je:<type> ?= { "scripted_bar_progress(<bar>)" >= N }` — so an entry can grant repeatedly without completing.
- **Update frequency.** `JOURNAL_ENTRY_UPDATE_ACTIVE = 4` and `_INACTIVE = 14` days (`00_defines.txt`); the per-type overrides
  `active_update_frequency` / `inactive_update_frequency` (named in the exe, used by no vanilla file) are honoured but do not reduce the
  steady cost (F220).
- **Loc:** the 1.13 journal window renders the `<key>_reason` text (the body), `GetStatusDesc`, `GetGoalDesc` and the completion tooltip
  — **nothing renders `<key>_desc`** (BUGS_AND_FIXES 2026-09-25; `gui/journal_entry.gui`). An entry without a `_reason` key logs
  `Journal entry is missing loc for je_X_reason!`. In a `debug_log` inside `on_complete`, `[THIS.GetCountry.GetNameNoFormatting]` works
  and `[ROOT.GetCountry…]` raises `Data error in loc string` and logs an empty field (probe 1).
- ⚠⚠ **Do not reuse vanilla's tech-event channel.** All ~33 vanilla tech events hang off one `tech_monthly_events` `random_events` block
  at `chance_to_happen = 50` with `never_fire_again` cooldowns — about half an event a month from the whole set. Use an own on_action
  with `events = { … }` (fires whenever the event's trigger passes), appended with
  `on_monthly_pulse_country = { on_actions = { pm_rehaul_research_pulse } }`.
- ⭐ **A delayed event re-checks itself** (`_on_actions.md`: *"an event will only successfully fire if it is valid both when the on_action
  is executed AND once the delay is complete"*), so `trigger_event = { id = X  days = 1095 }` is a free "still true three years later?"
  that does not observe the middle of the interval.

### A scripted progress bar's tooltip lists only the `add` terms evaluated that month

The bar tooltip (`PROGRESS_BAR_BREAKDOWN`, `localization/english/interfaces_l_english.yml`) prints "<value> from <desc>" for every `add`
the `monthly_progress` block actually reached this month — so a term behind an `if` whose limit fails is ABSENT, and a bar whose terms all
sit behind failing limits shows an empty breakdown. Vanilla shows its conditions by adding every factor every month and letting it be
worth 0: the French Divided Monarchists bar reads "0.0 from Clout of Orleanist Interest Groups", and the Ryukyu bars close each chain with
`else = { add = { desc = "…_low" value = 0 } }`. Two rules, both read off vanilla's files:
- **the `desc` goes on an `add` INSIDE a branch** — `if = { limit = {…} add = { desc = "…" value = 1 } }`, never
  `add = { desc = "…" if = {…} }`, where the engine ignores the desc and auto-describes the nested condition;
- **every condition ends in an unconditional branch adding 0** with its own desc, so its line always shows.

The research bars (`tools/emit_research_events.mjs`) follow both (BUGS_AND_FIXES 2026-10-21). ⚠ The desc text is pasted into a
single-quoted data-function argument, so it must carry no ASCII apostrophe (BUGS_AND_FIXES 2026-09-30). ⚠ Not yet confirmed on screen —
vanilla's bars are the evidence.

### War conditions (probes 2–5)

What works at country scope (F51 and probes 2–5):
- `army_power_projection` is a country-scope script value, readable inside an enemy's scope; `any_enemy_in_war = { … }`, and
  `every_enemy_in_war = { add = 1 }` to COUNT. A bar gated on `is_at_war` + an enemy at least half as strong completed for 9 countries in a
  year (probe 2) — with `root.` on the comparison (*Script semantics*).
- ❌ **Three spellings are accepted and ignored** — true for countries at peace and for their absurd twins:
  ```
  num_mobilized_battalions_greater_or_equal = { value = N }
  num_mobilized_battalions_greater_or_equal = N
  army_size_greater_than = N          # probe 5 also found "Unknown trigger type" for it in error.log
  ```
  They are loc keys for rendering a comparator. The callable form is `army_size >= N`.
- ❌ **`num_mobilized_battalions` is CHARACTER scope**, and says so loudly from a country
  (`Event target link 'num_mobilized_battalions' did not get a matching scope type. Expected 'character', but got 'country'`). Reach it
  per general: `any_scope_general = { owner = ROOT  num_mobilized_battalions >= N }` works at country scope and nested in
  `any_scope_war → any_scope_front`; `every_scope_general` sums it. `count >= N` works inside a list trigger (vanilla:
  `any_scope_ally = { … count >= 2 }`), so "one general with ≥ 100 or two with ≥ 50" is an `OR` of two lists.
- **The anti-gaming chain** (adapted from vanilla's `je_war_nursing`). `is_at_war` alone does not exclude a colonial subject dragged into
  someone else's war — Puerto Rico, Cuba and the Philippines were at war with war exhaustion, no front of their own and zero casualties;
  the front chain and the casualty count both exclude them:
  ```
  is_at_war = yes
  any_scope_war = { any_scope_front = { any_scope_general = { owner = ROOT } } }   # a real front
  every_scope_war = { add = "num_country_casualties(root)" }                        # unfakeable rate
  any_scope_war = { has_war_exhaustion = { target = ROOT  value > N } }             # WAR scope, targeted
  ```
  Guard `owner` with `exists = owner` first (BUGS_AND_FIXES 2026-09-05), and keep the chain out of a progress bar (no ROOT there).
- **Barracks levels = `army_size` (battalions), exactly** (RUS 206 / 206, FRA 182 / 182), so the save summaries give army size per
  country per year for free. The largest army runs from RUS 206 (1837) to GBR 573 (1935). ⚠ `army_size >= 100` is a high bar early
  (Britain 68 and Carlist Spain 60 in 1836): a gate read only on the 1830s looks dead when it is merely early.
- ⚠ **"Share of the army mobilised" is not a true fraction.** Σ(per-general mobilised battalions) ÷ `army_size` exceeds 1 (GBR 1.29,
  MEX 2.44); `army_size_including_raised_conscripts` fixes most of it (Mexico still 1.50). Use it only as a one-sided `>=` gate; every
  country at peace reads 0. `army_mobilization_option_fraction` is a different quantity (the share carrying one named mobilisation option).
- **`num_front_casualties` is total casualties at that front** — a location filter, not a cause filter. The engine has no counter that
  splits battle from attrition (only modifiers and the boolean `has_high_attrition`); never describe a casualties gate as battle-only.
- **Rivalry is one-sided.** `common/diplomatic_actions/12_rivalry.txt` carries `is_two_sided_pact = no`, so `any_rival_country` iterates the
  countries WE declared rivals: if A rivals B and B floats a ship, A's scope sees it, not B's. The naval research entries rely on this
  (ROADMAP → "The NAVAL channel").

### Market-goods triggers from a country scope (`mg:<good>`)

A country's market is a scope (`market = { … }`) and a good in it is `mg:<good>`, on which `market_goods_buy_orders` /
`market_goods_sell_orders` are triggers — the form vanilla-style strategy `possible` blocks use, proven inside `ai_strategy` blocks
(F64, F65). It also parses and ticks as a scripted-progress-bar term (`market = { mg:small_arms = { market_goods_buy_orders >= 900 } }`).
⚠ It reads the MARKET, so it ticks for every member: a princely state in the British market read Britain's small-arms demand as its own
and completed the entry while Britain never did. No canon entry uses it. Check the first tick's `error.log` for a `market` / `mg:` scope
error, and treat a bar that never moves in a market that plainly buys the good as the silent-zero shape (L6).

## What script content costs the tick

Measured on 1836→1841 observer runs by switching parts of the mod off and multiplying one part ×10 (FINDINGS F220; the fixes F221). The
probe switches — `dams.perf_off` / `perf_amplify` / `static_mode`, `research_events.perf_off` / `perf_amplify` / `perf_amplify_mode` /
`update_frequency`, `company_chain: false` — are probe-only config keys; no book ships with them. Read with
`node tools/testbed/ledger/arm_tick_cost.mjs <session>[,<session>]`. Seconds are WALL seconds per in-game year at observer speed (vanilla
~55 s/yr in 1836–40).
- **The engine writes its own per-tick-rate timings in every run**: `logs/custom_automated_stats.log` (the `automation_stats` logger of
  vanilla's `log_settings_live.json`), one block per in-game year — the year's total tick LOGIC and the average cost of one daily / weekly /
  monthly tick. A line labelled `[Y]` covers year Y−1. Logic is only ~35% of the observer's wall clock (vanilla 1836–40: ~19.7 of
  ~55.7 s/yr); the per-task "Tick Task List" (debug mode) has no log output.
- **A journal-entry TYPE that carries `is_shown_when_inactive` costs every month whether or not it ever shows.** ×10 research entries whose
  `is_shown_when_inactive` and `possible` are `always = no` still cost ~0.8 s/yr per copy (the monthly tick 189 → 580 ms). Active entries
  with progress bars add ~0.4 s/yr per 204 on top. ⭐ An entry type with NO `is_shown_when_inactive` (placed only by `add_journal_entry`)
  is FREE until placed: 1,440 never-placed dam entry types measured = nothing. ⇒ The lever is the number of entry types that carry the
  trigger, and how many entries are active at once — not their conditions.
- **Activating many entries at once is a one-off quadratic burst**: ×10 research entries (2,040) cost ~180 s of wall clock in 13 long daily
  ticks from 1836.2.1 (24 s → 2 s), deterministic; at ×1 it is ~2 s. Never seen in the steady state.
- **`active_update_frequency` / `inactive_update_frequency`** are honoured — the activation burst spreads over the longer interval — but
  do NOT reduce the steady cost.
- **A building TYPE costs even if it is never built and its `potential` is `always = no`**: ~1.5 s/yr per 144 types (×10 unbuildable dam
  types; the weekly tick +100 ms). The tier split's ~40 extra types are inside the noise.
- **Modifier lines on EVERY country cost by count**: the 144 dam `state_building_X_max_level_add` lines in `base_values` cost ~1 s/yr, ×3
  +2.25 and ×10 +2.2 per extra 144 (a little faster than linear); the same lines as one country static modifier added to every country cost
  the same — the route does not matter, the number of countries carrying them does. The same modifier TYPES declared without any line cost
  nothing.
- **Free in this period**: state traits (×10 = 1,440 added at start), decisions whose first `is_shown` condition fails (×10 = 2,880), the
  war-channel research entries, the company chain extension.
- ⚠ **`-script_profiling` crashes a `-handsoff` game** within the first in-game week (two attempts, two minidumps).
- ⭐ **The fixes that work (F221, n=3 in every combination)**: four dam types capped by resource slots (`capped_by_resources`, *Buildings
  and production methods*) instead of 144 types with `base_values` caps, −2.3 s/yr; and research first stages placed by
  `on_acquired_technology` + the campaign start instead of `is_shown_when_inactive`, −1.2 s/yr, research delivery unchanged. Fewer,
  longer stages buy nothing; one entry per industry saves what script placement saves.

## AI subsidies live in the strategies' `subsidies` blocks — nowhere else holds

- The `subsidies` block inside an `ai_strategy` is the AI's subsidy DECISION RULE (`must_have` / `wants_to_have` / `nice_to_have`, the only
  three values vanilla uses). It is the only durable way to make the AI subsidise a building: the AI re-scores subsidies continuously
  (`NAI` `SUBSIDIZE_*`), so a scripted `set_subsidized` is undone on its next pass.
- Every AI country always runs exactly one ADMINISTRATIVE strategy (`ai_strategy_industrial_expansion` has no `possible` gate), so the seven
  blocks of `common/ai_strategies/01_admin_strategies.txt` (~655 lines) reach every country; the alternative, `ai_strategy_default`, is one
  ~8,790-line block.
- **Unsettled engine semantics:** whether a typed strategy's `subsidies` MERGES with the default's per key or REPLACES it wholesale (an early
  probe leaned toward merge, on late-game data only — ON_GAME_UPDATE §2.3.1, "AI subsidies"). The builder's rule is correct under both
  readings: a strategy that already has a block is authoritative (whatever it omits was omitted deliberately; restating would invent
  subsidies vanilla never granted); a strategy with NO block gets the default's subsidies restated (read live from
  `00_default_strategy.txt`) only because adding our block makes it replace-exposed. Value `none` can reliably suppress only entries living
  in files we own.
- The builder owns `01_admin_strategies.txt` only when the book sets a policy (`building_subsidies` with a non-`vanilla` value, or
  `subsidy_conditional`). The canon does: the four dam types `must_have`, the tooling workshop and the explosives factory `none`
  (BALANCE_FRAMEWORK §10.92).
- **Conditional subsidies:** the `subsidies` block is a flat map with no per-entry triggers (unlike `goods_stances`). The only conditional
  lever is a mutually exclusive set of strategy VARIANTS whose `possible` blocks partition the condition — the AI re-picks strategies
  mid-campaign when `possible` flips (F64), and custom script values work inside strategy `possible` blocks (F65).
- A subsidy does NOT bypass the trade-centre GDP gate (`NAI` `TRADE_CENTER_MINIMUM_GDP_*`), an eligibility filter on which states the AI
  considers at all — and that gate is not absolute either: the AI built trade centres in Qing treaty ports at a quarter and a tenth of the
  threshold (F246).

## Automated headless runs (the testbed)

`tools/testbed/run_observer.ps1` drives the game itself — no launcher, no clicking, no debug mode — so balance changes can be measured
over real playthroughs. It is called by `tools/testbed/run_schedule.ps1`, the entry point for all measurement (it builds each run's mod);
a hand invocation of the observer is a diagnostic. This section is the engine behaviour the harness rests on; the batch procedure is
TESTBED_OPERATIONS, what the instruments can log is TESTBED_METRICS. Verified against 1.13.9; re-verify after a patch (ON_GAME_UPDATE).

### Launching without the launcher

`binaries\victoria3.exe`, working directory `binaries`:

| arg | effect |
|---|---|
| `-handsoff` | **Auto-starts an observer game** at the 1836 bookmark — no launcher, no lobby, no country selection, no input. `continue_game.json` then reads `Observing Great Britain`. |
| `-run_until=<Y.M.D>` | Plays to that date and **quits the process itself** (a clean exit). |
| `-disable_renderframeifneeded` | The exe's own description: *"Sacrifice sub-tick rendering for tick speed."* |
| `-gdpr-compliant` | What the launcher passes; suppresses the legal-docs prompt. |
| `-continuelastsave` | Loads the save the continue pointer names (*Resuming*); with `-handsoff` the game stays in observer mode. |

The full CLI table sits in the exe's string pool near `game_setup.cpp` (`start_tag=`, `handsoff`, `run_until`, `scripted_tests`,
`no_save_after_failed_test`, `gamestate_validation`, `host_server`, `automated_test`, …). `game/tools/scripted_tests/scripted_tests.md`
documents a separate pass/fail suite (daily triggers, no effects) — it yields PASS/FAIL, not numbers. `-loadsave=<absolute path>` is
rejected (`Could not load save game [...]. Going to main menu.`), so a save cannot be named on the command line.

**Enabling mods from a script is `content_load.json`, not `dlc_load.json`** (gone in 1.13 / launcher v2). The exe reads
`Documents\Paradox Interactive\Victoria 3\content_load.json`; entries are **objects with a `path`**, absolute, with forward slashes:

```json
{"enabledMods":[{"path":"C:/Users/<you>/Documents/Paradox Interactive/Victoria 3/mod/pm_tech_rehaul"}],"disabledDLC":[],"enabledUGC":[]}
```

A bare string gives `dlc.cpp: Missing path for dlc/mod`; a relative path gives
`No subdirs mounted for game dir from candidates: mod/<name>`. Success is
`dlc.cpp: Mod <name> (<id>) version 1.13.9 successfully matched game version 1.13.9.` in `debug.log`, which the harness asserts on. The
Paradox launcher overwrites this file whenever it runs, so the harness backs it up and restores it.

**Disabling DLC is the same file's `disabledDLC`** (2026-10-26, from the launcher's own content-load schema in its `app.asar`): entries are
**objects with a `paradoxAppId`**, whose value is the DLC's `pops_id` from its descriptor `game\dlc\<folder>\<name>.dlc` (today the
folder name, e.g. `{"paradoxAppId":"dlc001_preorder"}`). The game logs one `virtualfilesystem_physfs.cpp: Mounted Data: …/game/dlc/<folder>`
line per DLC it loads, so a run's `debug.log` says which DLCs were active (all 17 installed ones in an ordinary run). `run_observer
-DisableAllDlc` writes every installed DLC there and checks that no mount line appears (meta.json `no_dlc_verified`). Proven in game
2026-10-26: both runs of the no-DLC load test mounted none of the 17 (F250).

**`pdx_settings.json` is rewritten by the game on exit**, dropping keys it considers default — never assume a key survived. The harness
sets `Graphics.display_mode=windowed` (a run cannot hijack the desktop), `System.language=l_english` (logged strings stay stable),
`game.save_on_exit=false`, and `game.autosave` to `-AutosaveInterval`.

**Autosaves are the only way to make a crash resumable** — no script effect can save the game (`save_scope_as` and friends save scopes).
The engine's values, from the exe's `SETTING_AUTOSAVE` option block:
```
never   monthly   quarteryear   halfyear   five_year   yearly
```
Note the spelling: `halfyear` has no underscore, `five_year` does. ⚠ The `save_interval` enum elsewhere in the exe (`half_year`,
`three_months`, `every_other_month`) belongs to something else; the authoritative cluster contains `SETTING_AUTOSAVE` / `autosave` /
`OPTION_FIVE_YEAR`. The observer defaults to `five_year` (~19 saves a century, capping crash loss at five in-game years; a 7-year run writes
exactly 1); century schedules set `yearly`, which the save summaries need. ⚠ **Autosaves OVERWRITE the player's own `autosave*.v3`
slots**; named saves are untouched. `never` opts out, at the price of unrecoverable crashes.

### Getting numbers out

`debug_log` interpolates data functions — the only numeric channel that needs no debug mode and no save parsing. The market path the
telemetry uses (`tools/telemetry_lib.ps1`):

```
c:GBR = { market_capital.market = {
    every_market_goods = {
        debug_log = "…[THIS.GetMarketGoods.GetGoods.GetKey]…[THIS.GetMarketGoods.GetGoods.GetMarketBuyOrders|2]…"
    }
} }
```

- `every_market_goods` iterates a market's goods (43 in the British market at the 1836 start).
- `THIS.GetMarketGoods.GetGoods` exposes `.GetKey`, `.GetMarketBuyOrders`, `.GetMarketSellOrders`, `.GetMarketPrice`,
  `.GetMarketImports`, `.GetMarketExports`, `.GetMarketProduction`; `|2` gives two decimals. The functions are per market.
  `THIS.GetMarketGoods.GetMarketBuyOrders` (skipping `.GetGoods`) does not exist.
- **A one-shot dump needs no global variable**, just a one-month window on `on_monthly_pulse`:
  `trigger = { game_date >= "1840.1.1"  NOT = { game_date >= "1840.2.1" } }`.
- Guard every named tag: `exists = c:GER` is false in 1836 with no error, while a bare `c:GER` errors (*Script semantics*, L1).

### The log ring: mirror it, token it, filter it

- **The ring is small and shared.** `debug.log` rotates at 512 KB with 5 backups (~3 MB), and again at every launch.
  `dedicated_server.log` (4 `Processing Tick` lines a day) fills a slot every ~5 in-game years, so a century discards its own early game,
  and an end-of-run snapshot of `logs\` mixes runs. The harness therefore **mirrors the growing logs continuously** into the run's
  `logs_live\` (`debug.log`, `error.log`, `dedicated_server.log`): one complete file per log per run, flushed every poll — the
  authoritative copy; `logs\` beside it is only the exit-time snapshot.
- **Rotation eats what was not read yet.** When the live file is renamed to `.1.log`, everything written since the last poll goes with
  it, and a `debug_log` burst can itself trigger the rotation (an 89-line dump once lost 68 lines). On a shrink the tail reads the rest of
  `<name>.1.log` from its last offset before restarting on the new file, and writes a `--- harness: source log rotated … recovered N chars
  ---` seam so a gap is visible (the false-rotation defect: L28).
- **Every telemetry line carries a per-run token.** Runs share one `logs\` folder, back-to-back runs are seconds apart and rotation keeps
  timestamps, so mtime filtering is not enough (it once produced a run with exactly double the rows). `run_schedule.ps1` generates a token
  and passes it to both the builder (`build.ps1 -TelemetryToken`, lines like `V3TB|<stamp>s001|G|…`) and the observer, which keeps only its
  own; `meta.json`'s `foreign_token_lines_skipped` counts the rest. Judge completeness from the harvest, not the live tail.
- ⚠⚠ **`error.log` has no token, and its mirror carries other sessions' lines, out of order** — including a previous run's keys that no
  longer exist in the mod. Never compare raw line counts between arms (two hand runs read 15,294 against 7,516 where their own windows
  held 139 and 12 — F47, FINDINGS_ARCHIVE; F51). Filter every line by its `[HH:MM:SS]` stamp against the run's launch and finish
  times in `harness.log`, count **distinct error shapes, not lines** (one naval battle produces hundreds of identical `NAVAL_BATTLE`
  lines, vanilla's own bug), and de-duplicate (L9). TESTBED_OPERATIONS §4 has the vanilla noise catalogue.

### One game at a time

A second instance writes to the same `logs\` folder. The harness refuses to start if `victoria3.exe` is already running (it will not kill
it — that might be a game being played); a crashed harness can leave one orphaned, since `-run_until` means the game outlives its launcher
(L19).

### Surviving a crash, without mistaking you for one

A run that ends before its `-run_until` date is either the game dying (resume it) or a human stopping it (stop the batch). The signals,
strongest first:

1. **A key in the harness console, at any time during the run** — `p` pause, `r` resume, `s` or `q` stop after this run, `x` or `Esc` close
   the game and stop now. It responds while a run is in progress.
2. **A new `crashes\victoria3_*` directory** (`exception.txt` + `minidump.dmp`) whose mtime falls inside the attempt ⇒ a CTD ⇒ resume at
   once. Exit codes are not used: Task Manager, `Stop-Process` and the game's crash handler are not reliably distinguishable; a minidump
   exists or it does not.
3. **A grace prompt** if the game exits early with no minidump: press any key to confirm the stop; no key within `-StopGraceSeconds`
   (default **60 s**) ⇒ treated as a crash.
4. **A STOP file** — `tools\testbed\STOP`, or `STOP` in the session folder: the only control for a run with no console. A keypress also
   writes it, which is how it reaches the parent `run_schedule.ps1`. `tools\testbed\NO_NEW_RUNS` is the stop-after-this-run twin.

⚠ **Redirected stdio disables signals 1 and 3.** `[Console]::KeyAvailable` throws when stdout / stdin are redirected, so `Start-Process …
-NoNewWindow -RedirectStandardOutput …` silently drops the harness into headless mode with the STOP file as its only control; the observer
logs a startup `WARN` when it has no console. Launch batches into their own visible window and read progress from
`sessions\<stamp>\session.log`. From a human console: `Start-Process powershell -NoExit -File tools\testbed\run_schedule.ps1 -Schedule <spec>`.
From the AGENT, only `& 'tools\testbed\launch_detached.ps1' -File 'tools\testbed\run_schedule.ps1' -ArgumentList '-Schedule','<spec>' -NoExit`,
which creates the process through WMI outside the desktop app's job objects (a child of the agent's shell dies with the app — L30).
⚠ Call it DIRECTLY from the PowerShell tool, never as `powershell -File launch_detached.ps1 …`, which flattens the array to the single
token `-Schedule,<spec>` and leaves an idle window while the launcher reports success.

### Resuming

- ⚠⚠ **`-continuelastsave` loads the save whose TITLE `continue_game.json` names** — the engine's own pointer, rewritten at every
  COMPLETED save — **not the newest file** (probed 2026-09-14, L32). With the pointer's target absent it logs
  `Could not load save game [<title>]. Going to main menu.` whatever else is in the folder; any `.v3` copied in under that title loads,
  even from another campaign. A CTD during the autosave write leaves the pointer aimed at a file that never landed, which is what defeated
  every resume before the fix (BUGS_AND_FIXES 2026-09-14/15; the earlier "truncated save" hypothesis was refuted, 2026-08-31).
- **A failed load plus `-handsoff` starts a FRESH 1836 game**, with no error (verified with a bad `-loadsave=` path and by L32's probe).
  So a resume must check where the clock landed on its first tick: far behind the crash point ⇒ the load failed. Checked only at the end
  of an attempt, a fresh campaign that plays to the target passes as a clean run (BUGS_AND_FIXES 2026-08-31, 2026-09-03; L26 checks
  sessions on disk).
- **The harness's answer is the deterministic resume feeder** (`run_observer.ps1`): on a crash every autosave slot the run owns is moved
  into `<run>\resume_set_<n>\` and frozen; each attempt COPIES one member, newest first, under the pointer's title; whatever the engine
  writes meanwhile is set aside and never fed; a re-crash within `-ResumeWindowYears` (5) feeds the next-older original; the set exhausted,
  the run is abandoned (L32). A run that dies **before its first autosave** restarts as a fresh 1836 game, never through
  `-continuelastsave`, which would load another run's endpoint (L34). The policy is TESTBED_OPERATIONS §5.3.
- **A resume rewinds to the last autosave**, so a dump date that already fired can fire again with different numbers. The harvest keeps
  the **last** emission per `(date, tag, good)` — the timeline that reached the end — and reports `re-dumped` rows.

### How long a run takes — never extrapolate from the first decade

**The game slows as the economy it simulates grows:** about **1.0 in-game years per real minute** in the 1830s against **0.44** in the
1930s, a factor of 2.3. A rate sampled in the first minutes under-states a century by about a third — fine for a probe (~5.7 in-game days a
second early, plus ~40 s load: a 5-year probe is 6–8 minutes), wrong for anything reaching the 1900s, and expensive when sizing
`timeout_minutes`.

The curves below are the 2026-08 measurement (vanilla `20260807_005246` 1836→1921 and `20260806_110926` 1836→1889; mod: both runs of
`20260811_020843`; one machine, coarse by construction, the vanilla 1930s an extrapolation). **Use their SHAPE; the absolute minutes have
risen since** — a century now takes 165–195 min (vanilla 178.5 on the October six, F248; the canon's book 194, F247), and play time is
not comparable across months (F248). Current magnitudes and the batch budget are TESTBED_OPERATIONS §1.3. Regenerate the curves with
`node tools/testbed/run_timing.mjs <sessionDir>`, which splits resumed attempts (a resume restarts the wall clock).

In-game years per real minute, by decade:

| decade | vanilla | mod | | decade | vanilla | mod |
|---|---|---|---|---|---|---|
| 1830s | 1.05 | 1.00 | | 1890s | 0.69 | 0.61 |
| 1840s | 0.95 | 0.95 | | 1900s | 0.62 | 0.56 |
| 1850s | 0.89 | 0.85 | | 1910s | 0.52 | 0.51 |
| 1860s | 0.87 | 0.82 | | 1920s | 0.53 | 0.47 |
| 1870s | 0.81 | 0.77 | | 1930s | ~0.50 | 0.43 |
| 1880s | 0.78 | 0.68 | | | | |

Cumulative minutes from an 1836 start (add ~1 min for load; a crash-resume costs the in-game time back to the last autosave):

| reach | 1850 | 1860 | 1870 | 1880 | 1890 | 1900 | 1910 | 1920 | 1930 | 1936 |
|---|---|---|---|---|---|---|---|---|---|---|
| **vanilla** | 14 | 26 | 37 | 49 | 62 | 77 | 93 | 112 | 131 | 143 |
| **mod** | 15 | 26 | 39 | 52 | 66 | 83 | 101 | 120 | 141 | 155 |

### RNG seed: readable, not settable headlessly

**A run's seed can be logged, not chosen** (settled 2026-08-01 by experiment, including a manual lobby test; do not re-litigate without new
evidence).
- **Reading it.** The telemetry emits at boot `V3TB|<token>|SEED|[GetGlobalRandomSeed]|custom=[GetGlobalRandomSeedString]`.
  `GetGlobalRandomSeed` is a bare global data function (vanilla shows it on the loading screen via `INGAME_RNG_SEED`), so it resolves in any
  loc string. Verified: `SEED|466290526|custom=`.
- **Setting it does not work.** The custom seed is a lobby-only input, and `-handsoff` skips the lobby. Flipping the game rule
  `custom_rng_seed` to `use_custom_rng_seed` in `player/game_rules/presets.txt` changes nothing alone (two runs: 466290526 and 1921701894).
  No command-line argument exists — ⚠ web sources claiming a `random_seed` CLI argument are wrong: `random_seed` is a savegame gamestate
  field. A mod cannot supply the value (`game_rules.md` permits only `default`, `apply_modifier` and `flag` per setting). The value arrives
  by a runtime command, `set_custom_rng_seed_command`, and persists **only in the save** (a hash diff of all 9,794 files under
  `Documents/Paradox Interactive/Victoria 3` found a lobby seed inside the zipped `gamestate` and in no config file).
- **Consequence.** Same-seed A/B is unavailable, so the telemetry tax stays bounded ("no detectable difference", ~±12% resolution) rather
  than measured. The only route to a fixed seed is resuming a save, which carries its own.

## metadata.json

- Lives at `mod/.metadata/metadata.json` — the one hand-maintained file in `mod/`. Fields: `name`, a unique reverse-domain `id`,
  `version`, `game_id: "victoria3"`, `supported_game_version`, `short_description`, `tags`, `relationships`, `replace_paths`,
  `game_custom_data.multiplayer_synchronized`.
- **`relationships` must be present, even empty**, or the log says `pdx_mod_metadata: Expected member (relationships)`.
- **The builder stamps `name`:** `build.ps1` suffixes it with `(built yyyy-MM-dd HH:mm)` on every build (stripping the previous suffix), so
  the launcher's mod list shows which build is freshest. The `id` is untouched, so playset membership is stable.
- **`replace_paths`** (an array of folder paths) makes the engine **ignore the entire vanilla folder** and use only the mod's — for when a
  same-filename override is not enough. The mod uses it for `common/history/buildings` alone, so the converted 1836 start replaces
  vanilla's instead of placing every factory twice.

## gfx / icons

- **The tech tree lays itself out.** The engine places technologies and their lines on its own (`TechTreePanel.GetProductionTechTreeItems` /
  `…Lines` in `gui/tech_tree.gui`), so adding technologies needs no GUI work. The era band dividers are hard-coded (`extra_lines`,
  y = −100 / 2200 / 4060) and line up only as long as the tree keeps vanilla's era bands.
- Buildings (`icon`, `background`) and production methods (`texture`) reference `.dds` paths. Reusing a vanilla path needs no asset. A bad
  path logs an error and shows a fallback icon; it does not crash.
- ⭐ **Icons can be generated — no image library, no Paradox art.** Vanilla's invention icons are 256×256, 32-bit A8R8G8B8, uncompressed,
  9 mipmaps (`gfx/interface/icons/invention_icons/*.dds`). Mipmaps are optional and a single surface is a legal DDS, so a placeholder is a
  **128-byte header plus raw BGRA pixels**. Header fields that must match: `dwSize` 124, `dwFlags` 0x100F, height / width,
  `dwPitchOrLinearSize` = width × 4, `ddspf.dwSize` 32, `ddspf.dwFlags` 0x41, `dwRGBBitCount` 32, masks R `0x00ff0000` G `0x0000ff00`
  B `0x000000ff` A `0xff000000`, `dwCaps` 0x1000 (byte-compared against `manufacturies.dds`: identical but for the mipmap flag and
  `dwCaps`). ⚠ Pixels are **BGRA byte order** — the masks describe a little-endian A8R8G8B8 word. `emit_techs.mjs` writes the mod's
  `zzz_pm_rehaul_placeholder.dds` this way. A real icon carries the full mip chain like vanilla's (`dwFlags` 0x2100F, mip count 9,
  `dwCaps` 0x401008, 349,652 bytes at 256 px): `tools/lib_image.mjs` `writeDDS` writes that form for the technology icons in `art/`.
- **Vanilla's invention icons share one soft black glow** (measured on nitrogen_fixation, pneumatic_tools, improved_fertilizer, lathe): the
  black's alpha 2–8 px outside the silhouette is 145 103 68 41 22 10 4 on all four — a full-black edge 1.9 px out, softened as a Gaussian of
  σ 2.4 px. `tools/make_tech_icon.mjs` draws it, so an image model need not.
