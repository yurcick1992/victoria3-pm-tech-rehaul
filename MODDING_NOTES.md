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
  (whole-file replacement) but keeps PMs/PMGs as additive `zzz_*` files (all-new keys, no clash).
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
- If the lines don't appear, launch with **`-debug_mode`** (debug_log may be gated to it).

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
