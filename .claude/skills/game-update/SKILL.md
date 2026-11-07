---
name: game-update
description: Carry the mod from one Victoria 3 game version to the next (mod 1.1 on game 1.15 is the first pass). Use when Paradox releases a patch, when the installed game's version or build changes, when a run reports a game-version mismatch, and whenever the work is planning, doing or reviewing the update pass — finding what changed, keeping the mod building, reconciling the mod's design with what vanilla now does, bringing new vanilla content (a new good, building, method, mechanic, script hook) into what the mod authors, and deciding each of those with the user.
---

# The game-update pass

Three aims, in this order: (1) the mod builds and runs correctly on the new game; (2) it still does what CLAUDE.md §1.1 says it is for,
wherever the new vanilla content and mechanics bear on it; (3) every design choice the patch raises goes to the user — none is made by default.

**The files.** This skill is the procedure. `ON_GAME_UPDATE.md` is its reference: §1 the mechanical routine, §2 the couplings (what of ours
BREAKS when vanilla moves), §3 the version log, §5 the three tables the reconciliation and adoption phases walk (what of ours may become WRONG,
or may need the new thing, while nothing breaks). Each version has its own **register**, `GAME_UPDATE_<version>.md` (user-ruled 2026-11-07:
one file per version): one line per item — id, class, what changed, what of ours it touches, decision, status, pointer. 1.15's is
`GAME_UPDATE_1_15.md`; copy its head for the next version.

**Classes:** N new · R removed or renamed · C changed value · B engine behaviour · T a task of the pass.
**Statuses:** OPEN · RULED §x (decided, not built) · DONE · DEFERRED (to where) · DROPPED. The register closes at release with no OPEN line.

**Standing rules.** CLAUDE.md §5.1 holds throughout: no game run without the user's go-ahead (rule 4), nothing edited in the checkout a batch
runs from (rule 7: `build.ps1`, the emitters, `tools/testbed/**`), a ruling is the user's (rule 13), docs in the same pass (rule 10). What can
be done without disturbing a running batch or its report is done at once; what cannot waits for the session that does the adoption, not an
intermediate one (user, 2026-11-07).

## Phase 0 — before the patch lands

Only possible while the old version is installed (Steam updates Victoria 3 automatically on this machine). Keep, outside the repository and
in no git repository (Paradox's files; the 1.13.11 copy is `C:\claude-code\vic3_game_1.13.11`):
- `game\common`, `events`, `map_data`, `localization`, `gui`, and `binaries\victoria3.exe` with its sha256;
- the engine's vocabulary, which no game file holds: one debug game with no mods, `script_docs` and `dump_data_types`, run from the command
  line (`--run_console_action_main=<command>`, found in the 1.13.11 exe); copy the `docs/` and `data_types/` output beside the snapshot. If it
  cannot be made, the exe's strings stand in (names and descriptions, no scopes or data types).
Record the snapshot in ON_GAME_UPDATE §3.

## Phase 1 — intake: what changed, listed in full

**The diff is the list; the patch notes explain it.** A new good is one block among thousands of changed lines and may get one line in the
notes, so never work from a text diff or the notes alone:
```
node tools/game_diff.mjs <old game dir> <new game dir> --out <scratch>/game_diff.txt
```
It prints the entity counts per database (a new good is its first line), every new entity with — for a new good — every method that makes or
uses it, removals and renames, changed fields with old and new values, the order changes the save readers depend on, the engine vocabulary
diff (exe strings, and script_docs where both exist) and every other changed file. Then read the patch notes in full, from the forum changelog,
for what no file shows: engine behaviour in the exe (1.13.10's notes summary said "localization-only"; it was a substantial hotfix).
**Every diff item that bears on the mod, and every note, gets a register line.** Items that bear on nothing of ours may be summarised in one
line per database ("N new events, none naming a tiered industry").

## Phase 2 — breakage: the mod builds and is correct

ON_GAME_UPDATE §1, steps 2–9: mark the version boundary; refresh the extracts; dry-run; **regenerate the canon into a new named book and
field-diff it** (never skipped: it is the only check on what the book stores); refresh the snapshots; bump the version; build; smoke test (needs
the go-ahead). Then:
- `node tools/lint_vanilla_names.mjs` on that build, against the new game: every name our own script takes from vanilla (laws, regions, building
  and ship types, technologies, on-actions, triggers, effects, icons, defines) must resolve. Run it on a build made from the same game.
- re-read ON_GAME_UPDATE §5.2 (the rulings relative to a vanilla number) against the new numbers.
Mechanical fixes (a moved anchor, a recorded count, a new pair for the compatibility review) need no ruling; list them in the register as DONE.
A fix to an assertion is never the answer: fix the spec table, the pattern or the recorded count it names.

## Phase 3 — reconciliation: our features against the new vanilla

Walk ON_GAME_UPDATE §5.1 feature by feature, with the diff and the notes beside it. Each feature is **unchanged**, its **premise moved** (it
may now be wrong or unnecessary), **taken over** (vanilla now does it: keep ours, drop it, merge), or **contradicted**. Every outcome but
"unchanged" is a register line for the user, with what it would cost to measure. Engine-behaviour changes (class B) usually land here: the
mod's mechanisms run through hiring, wages, prices and the AI, so a bugfix in any of them is a design question until measured.

## Phase 4 — adoption: each new thing against everything we author

For every N item — a good, building, method, technology, mechanic, script hook — walk ON_GAME_UPDATE §5.3 and ask of each entry two
questions: does it belong there **narratively** (would the period's engineers have used it?) and **mechanically** (does vanilla's nearest
content use it?). The default for a new input is §10.108's: *"everywhere where vanilla does, and in similar cases that simply don't exist in
vanilla. By default, proportionally, everything else needs to be argued."* Record every yes and maybe as a proposal with a recommendation,
and list the noes, so the walk is visible. Include the measurement lists (PI and PP baskets, red flags, telemetry) and the player-facing ones.

## Phase 5 — decisions with the user

The register is the agenda: premise changes first, then adoptions, then the mechanical list for information. Bring each as what changed ·
what of ours it touches · the options · the recommendation; record the ruling in BALANCE_FRAMEWORK (and its index row) and the status here.
Hard stops: before a regenerated book is canonised (the field diff goes to the user, CLAUDE.md §4.4), before any game run, before release.

## Phase 6 — re-measure

With the go-ahead: a vanilla batch on the new version (it re-baselines `VANILLA_REF`, the wages, the error-noise catalogue, the fleet-loop
calibration); a canon batch against it, read through the criteria register and the phase-3 lines; misplaced capital if the AI changed.
Write the predictions first (CLAUDE.md §2.8).

## Phase 7 — release and record

`supported_game_version`, the release build, README's replaced-file list (`tools/list_replaced_files.mjs`), KNOWN_ISSUES, the changelog, the
Workshop text; the §3 version-log entry; findings in FINDINGS.md; every new coupling into ON_GAME_UPDATE §2 and every new feature, relative
ruling or authored item into §5. Close the register.

## Traps

- A 1.0 build on the new game overrides it with the old version's copies of every owned file until it is rebuilt and released.
- A rebuild of an unchanged book passes even when vanilla moved what the book stores (1.15: every rung kept its 1.13 mix with no copper).
  Only the regeneration of phase 2 brings vanilla's changes into the book.
- Readers of old sessions need the old game folder (`VIC3_GAME=<snapshot>`): saves key goods by position.
- A batch that straddles a patch is two batches; compare only arms run on the same version.
