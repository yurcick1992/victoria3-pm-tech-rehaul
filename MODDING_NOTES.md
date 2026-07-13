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
