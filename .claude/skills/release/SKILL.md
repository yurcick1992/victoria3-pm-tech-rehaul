---
name: release
description: Publish a mod version once the user has decided to release it — the release build in the game's mod folder for the user's Steam Workshop upload, the patch notes over vanilla and over the previous published version (Workshop and forum lengths), the known-issues list, and the record after the upload (tag, published texts, docs). Use when the user says to release, publish, upload or ship a version, asks for patch notes, a changelog, a change note or known issues for a release, or when a release step is left over from an earlier session. Not the game-update pass (finding what a patch changed, coding around it, testing it): that is the game-update skill, which hands over to this one at its phase 7.
---

# Releasing a mod version

The decision to release is the user's and is already made when this skill runs. Its job is to make the release **reproducible and the same
every time**: one strictly defined build, one fixed set of texts in fixed places, written at the detail the earlier releases set, checked by
tools, then handed to the user, who uploads and posts. Nothing here uploads, posts or tags on its own: the upload and every post are the
user's (they need the user's Steam and forum accounts); the tag waits for the user's word that the upload is done.

**The precedents are the reference for wording and detail.** Read the previous release's folder before drafting anything:
`release_notes/<previous version>/` (all five texts), `release_notes/published/` (what is actually live, which can differ from the draft:
1.1.0's forum post went out as an earlier draft, with 162 files and no Great Works lines), `CHANGELOG.md`'s newest entry, `CHANGELOG_WORKSHOP/` (the change notes as published) and
`KNOWN_ISSUES.md`. Copy their structure, order of sections and register; change what the release changed. 1.0.0 is the full list against
vanilla 1.13; 1.1.0 is the first one in the full five-text set; each later release is the newest precedent.

## 0. Before anything

- **No batch is running** from this checkout (CLAUDE.md §5.1 rule 7: the release build rewrites `mod/`), and **the user is not playing**: a
  default build deploys over the mod the game has loaded (memory `never-build-while-user-plays`). Ask if unsure.
- **The canon is the version's book.** `sha256sum config/mod_config.json` matches CLAUDE.md §4.1; the book's last canonisation is recorded.
- **The game version is right.** The installed game (`launcher/launcher-settings.json`, `rawVersion`) is the one the release is built for, and
  a game-update pass for it is closed: its `GAME_UPDATE_<version>.md` has no OPEN line (rule or defer each; the game-update skill).
- **The version number.** `x.y.0` for a release with design changes (1.1, 1.2); `x.y.z` for a release that only follows a game hotfix or fixes
  bugs (1.1.1 = 1.1 on game 1.15.1). Ask if it is not obvious.
- **The measurement the texts will quote** is named: the newest FINDINGS entry for this book on this game version (its F-number, n, span), and
  its report. Every figure in the texts comes from there or from the precedent it updates.

## 1. The release build

**Definition (strict).** A *release build* is the output of
`powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Release` — the canon, nothing passed but `-Release`, on the installed game — with
nothing changed in it afterwards. It carries no telemetry and no logging but the one start-up manifest line
(`PM_TECH_REHAUL: init OK - <name> <version> loaded (release build)`), no "Recipe BE" in any name, no build stamp in the mod name, and
`metadata.json`'s version is the release's (POLISH_1_0.md H8; `build.ps1`'s header, TWO BUILD KINDS). A `-SaveTo`, `-DryRun`, `-Config`,
telemetry or debug build is not one, whatever it contains. The deployed copy (`Documents\Paradox Interactive\Victoria 3\mod\pm_tech_rehaul`,
the shell's Documents folder) is what the user uploads.

1. `mod/.metadata/metadata.json`: `version` → the release; **`name` → `[<game macro version>] No Free Upgrades: An industrial realism
   overhaul. Version <release>`**, the form of the Workshop item's title (the user, 2026-11-19; "[1.15] … Version 1.1.2"; the macro
   version is the game's major.minor, as `supported_game_version` "1.15.*"); `supported_game_version` covers the installed game
   (`"1.15.*"`); the `short_description` still true. This file is the only hand-maintained one in `mod/`. Remind the user that the Workshop
   item's own title is set on its Steam page.
2. `powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Release` (it deploys). Every lint and the preflight must pass; the output names
   the debug_log lines it stripped and "RELEASE BUILD: no build stamp …".
3. README's replaced-file list: `node tools/list_replaced_files.mjs` on the build, pasted into README's section, its label naming the version.
4. Commit `mod/`, README and `metadata.json` as "Mod <v> release build for game <g> (Steam Workshop)", explicit paths (§5.1 rule 11), and
   push, once the user agrees to the commit.
5. **`node tools/verify_release_build.mjs --version <v>`** — exit 0 is the only proof that `mod/` AND the deployed copy are the release build,
   identical to each other (text compared without line endings: git's autocrlf rewrites `mod/` on a checkout, the game reads both), the
   installed game covered and `mod/` committed. It prints the canon's sha256 to compare with §4.1. A failure is fixed and the step re-run;
   never hand over a folder that fails it.
6. From here until the user confirms the upload, **no default build**: it would turn `mod/` and the deployed copy back into a debug build.
   Build with `-DryRun` or `-SaveTo <name> -NoDeploy` if anything must be built meanwhile.
7. Optional, with the user's go-ahead (a game run, §5.1 rule 4): the release-build crash and stall check, `schedules/release_century_n1.json`
   (setup `{kind: release}`; TESTBED_OPERATIONS §2.2). For a hotfix release the user's own load of the deployed build is usually enough: the
   manifest line in `debug.log` names the version.

## 1½. The headline descriptions — still true?

A game update or a release can make the mod's standing description wrong while every changelog is right: "for Victoria 3 1.13", "full
employment is harder to achieve" when the new game version undid it, "the AI always subsidises dams" after vanilla changed its subsidy rule.
**A measurement a little out of date is fine; a statement that is no longer true is not** (the user, 2026-11-15). Read each description
against the build and the newest measurement, and list every statement that is now untrue, with the current fact and where it comes from.

| description | where to read it | who changes it |
|---|---|---|
| the Workshop item's description | its public page, https://steamcommunity.com/sharedfiles/filedetails/?id=3829692484, read as BBCode with the snippet under **BBCode, always** below (never `innerText`); the last copy read is `release_notes/published/workshop_description.txt` | **the user only**: it is the user's own writing ("No public communication … was written or edited by AI"). Claude lists the obsolete statements and suggests no wording unless asked |
| the forum thread's first post (the mod's description and its known-issues section) | https://forum.paradoxplaza.com/forum/threads/mod-no-free-upgrades-an-industrial-realism-overhaul.1947073/ — the forum shows automated browsers a verification check, which Claude never tries to get past: the user pastes the post from the editor's BBCode view, or passes the check in the built-in browser pane; the copy is `release_notes/published/forum_first_post.txt` | the user (the known-issues section is `forum_known_issues.txt`, replaced wholesale) |
| `mod/.metadata/metadata.json` `short_description` (the launcher's, under 200 characters) | the repository | the user chose its wording (POLISH_1_0 R1): propose a change, never make one |
| README's opening paragraph and scope (which game version, what the mod changes) | the repository | Claude, in the same pass |
| CLAUDE.md §1.2 (the design record's list of changes) | the repository | Claude, in the same pass (CLAUDE.md §5.1 rule 10) |

After the check, save what was read as the new copy in `release_notes/published/` (its BBCode exactly as read), so the next release
compares against it. When the user asks for an updated description, it is the published BBCode with only the obsolete sentences changed,
every tag kept, in `release_notes/<v>/workshop_description.txt` (Steam dialect).

## 2. The texts — one folder per release

All drafts live in **`release_notes/<v>/`** (committed), under these names. Two dialects: **Steam** BBCode (`[h1] [h2] [list] [*] [b] [i]
[url=…] [hr][/hr]`, lowercase) and the **Paradox forum**'s XenForo BBCode (`[B] [I] [SIZE=5] [SIZE=4] [LIST] [*] [SPOILER="…"] [URL=…]`).
Each file is pasted whole.

**BBCode, always** (the user, 2026-11-15, after a plain-text draft of the Workshop description would have stripped its headings and lists):
- Every text meant for Steam or the forum is written and saved in that site's BBCode, never as rendered text: the change note, the
  discussion posts, the forum posts and the descriptions. A heading is a heading tag, a list a list tag, emphasis a bold tag, exactly as the
  live page or the precedent has them.
- **Read a live page as BBCode, never as rendered text.** `innerText` or a copy from the rendered page drops every tag. On the Workshop, rebuild
  the BBCode from the page's HTML in the built-in browser and save it only after it round-trips (its length and a checksum match the
  page's, as below). On the forum, the user copies the post from the editor's BBCode view (the `[ ]` toggle); a rendered copy, like the
  1.1.0 changelog post in `release_notes/published/`, is a record of the words only and is never edited into a replacement.
- Editing an existing text means editing its BBCode source: change the sentences, keep every tag, the blank lines and the order.
- `check_release_notes.mjs` fails a Steam or forum text with no BBCode tag at all, unbalanced tags, or the other site's tags.

The Workshop snippet (run on the item's page; Steam renders `[h1]` / `[h2]` as `div.bb_h1` / `div.bb_h2`, `[list]` as `ul.bb_ul`, and eats
the line break after a block):
```js
const conv = n => [...n.childNodes].map(c => {
  if (c.nodeType === 3) return c.textContent;
  const t = c.tagName, k = c.className;
  if (t === 'BR') return '\n';
  if (t === 'HR') return '[hr][/hr]\n';
  if (t === 'B') return '[b]' + conv(c) + '[/b]';
  if (t === 'I') return '[i]' + conv(c) + '[/i]';
  if (t === 'A') return '[url=' + c.href + ']' + conv(c) + '[/url]';
  if (t === 'DIV' && k === 'bb_h1') return '[h1]' + conv(c) + '[/h1]\n';
  if (t === 'DIV' && k === 'bb_h2') return '[h2]' + conv(c) + '[/h2]\n';
  if (t === 'DIV' && k === 'bb_h3') return '[h3]' + conv(c) + '[/h3]\n';
  if (t === 'UL') return '[list]\n' + [...c.children].map(li => '[*]' + conv(li).replace(/\n$/, '')).join('\n') + '\n[/list]\n';
  return '<<UNKNOWN ' + t + '.' + k + '>>' + conv(c);   // teach the snippet before saving: never save a file with one of these
}).join('');
const bb = conv(document.querySelector('.workshopItemDescription'));
({ len: bb.length, sum: [...bb].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7), unknown: bb.match(/<<UNKNOWN[^>]*>>/g), bb })
```
After writing the file, recompute `len` and `sum` on it in Node (the same fold over its characters, the final line break removed): both
must match before the copy counts as read. Steam's `[url]` links render with a `[domain]` suffix in the text and are rebuilt from `href`;
check them against the precedent.

| file | what | where the user puts it |
|---|---|---|
| `steam_changenote.txt` | over the previous published version, Workshop length | the Workshop upload's change note (≤ 8,000 bytes as Steam counts them) |
| `steam_over_vanilla.txt` | over vanilla on the release's game version, Workshop length | a post in the Workshop item's discussions |
| `steam_known_issues.txt` | the known issues, Workshop length | the known-issues post in the Workshop item's discussions (edited in place) |
| `forum_post.txt` | the thread's changelog post, **replaced wholesale** each release: a disclaimer, then each changelog in full in its own spoiler — this release over the previous one, every earlier release of the same game line over its predecessor back to the line's `x.y.0` (1.1.1 keeps 1.1.0 over 1.0.0), then this release over vanilla | the changelog post in the mod's Paradox forum thread, edited and replaced whole |
| `forum_known_issues.txt` | the known issues in full, in a spoiler | the thread's first post (its known-issues section, replaced) |

And in the repository, in the same pass: **`CHANGELOG.md`** gets the release's entry at the top (the over-previous changelog at forum length,
in Markdown; known issues pointed to `KNOWN_ISSUES.md`); **`KNOWN_ISSUES.md`** is rewritten for the release (the forum known issues in
Markdown, the header naming the version and game). After the upload, `CHANGELOG_WORKSHOP/<v>.txt` is the change note **as published** (§5).

**Lengths.** *Forum length* (`forum_post.txt`, `CHANGELOG.md`, `forum_known_issues.txt`, `KNOWN_ISSUES.md`) gives every change with its
figures: before → after, per level, the named buildings, methods and technologies, a sub-list where one change has several parts (the 1.1.0
forum post's copper section is the model). *Workshop length* says the same in one line per item, merging small items into one line and
dropping the per-good detail (the 1.1.0 Workshop vanilla post compresses the forum's 20 kB into under 8 kB). The over-vanilla changelog at
Workshop length is the hardest to fit: cut sub-detail, never a feature.

**A release that only follows a game hotfix is short** (the user, 2026-11-19, of 1.1.2's texts: "much wordier than is reasonable for its
substance"). When the substance is *"incorporated <g>'s changes without corrections"* and *"tested it this much"*, the over-previous changelog
says exactly that: the game version it follows, that vanilla's changes come through as they are, anything the mod itself had to correct
(only if there was some), how it was tested, and the pointer to the known issues. No itemised list of what vanilla changed (it is vanilla's
changelog, not ours), no per-method figures for vanilla's own recipe moves, no re-statement of the balance standing (the known issues carry
it). A few lines, at Workshop and forum length alike. The 1.1.2 change note is the counter-example; 1.1.1's is the upper bound.

**Sections, in this order** (drop an empty one; precedents for the wording of each):
- *over the previous version:* the header `<v> (for Victoria 3 <g>)`; the AI disclaimer line; an opening paragraph (what the release is, what it
  requires, that the design is unchanged except where said, "Small adjustments that only follow vanilla <g>'s own renames and moves are not
  listed.", where the known issues are, the link to the forum for the full text); **Testing and balance**; **Game <g>** (what of the new
  vanilla comes through); then the changes by kind — the feature names of the mod's own description, Research, AI, Balance, Content, Fixes
  (forum: "(these issues were also in <previous>)"), Interface, Performance, Modding; **Not yet in <v>** (deferred items, pointing at the known
  issues).
- *over vanilla:* the header; "Every change below is against vanilla Victoria 3 <g>."; **Testing and balance**; **Features** (Production,
  Artisan crafts, Merged methods, New technologies, Secondary and automation methods, Electricity, Hydroelectric dams, Research, Trade); **AI**;
  **Balance**; **Content**; **Interface**; **Performance**; **Modding**. Start from the previous release's over-vanilla text and change only
  what this release changed, re-counting every count (files replaced, companies, research entries, vanilla files touched) from the build.
- *known issues:* the header `Known issues in <v> (for Victoria 3 <g>)`; the AI disclaimer; "These are issues a player may notice in version
  <v>. Each line goes when a release fixes it."; **How <v> was tested**; **Mechanical**; **Balance**.

## 3. What goes in — the content rules

**Finding the changes over the previous version** (every source, then sort):
- `git log --oneline v<prev>..HEAD` and `git diff --stat v<prev> HEAD -- mod/` (what players get changed; a tag missing → the previous release
  build's commit, CLAUDE.md §4.1);
- the BALANCE_FRAMEWORK rulings dated since the previous release (§2.13's index), the canon's field diff against the previous canon (§4.1
  states it), the version's `GAME_UPDATE_<g>.md` (every DONE line that reached the build), BUGS_AND_FIXES entries since then;
- `KNOWN_ISSUES.md`: a line the release fixes moves to Fixes.
- Sort each item: **major** (a recipe, cost, AI value, research or mechanic a player meets; copper entering recipes is the user's example) →
  a line; **minor repeg** (only following a vanilla rename or move) → no line, covered by the "Small adjustments …" sentence (memory
  `patch-notes-skip-minor-repegs`); **internal** (tools, telemetry, linters, docs, the testbed) → no line, except a Modding line where it
  changes what a modder sees.

**Known issues — what goes in.** Only what a player may notice (memory `public-known-issues-list`), in two kinds:
- *Mechanical:* problems the mod introduces or makes worse over vanilla — deferred build conditions, interface trouble, a mechanic that misleads
  (the literacy-gated entries). Sources: `KNOWN_ISSUES.md`, BACKLOG's items for the next release, the lint WARNs of the release build
  (`lint_pm_combos.mjs`'s electricity line), playtest reports. Not: an old release failing on a newer game (`supported_game_version` says it).
- *Balance:* where the measured economy stands against where the mod wants it, from the named measurement: every criteria-register line
  outside its aim (CLAUDE.md §3.2) and the readings beside it (§3.3) that a player would see. Some are inherently vanilla-relative (world GDP
  ÷ vanilla, the price indices); others are problems in themselves whatever vanilla does (capital piling up, too-easy depeasantation, the old
  rung surviving, research uneven between the trees). Say for each why it is a problem in the mod's own terms, then the figures.
- A line that the release fixes goes, and the fix is in the changelog. A line whose figures came from an older version's tests is re-read
  against the new measurement and re-quoted, or says plainly which version it was measured on.
- **Not public:** misplaced capital (the ladder offers more ways to invest badly, so the rate against vanilla is not like for like; memory
  `public-issue-wording`), measurement-only items, the register's internal names.

**Wording** (the user's rulings on public text; they hold in every file):
- The first line under the header: *"Unlike all my other public communication, this changelog is AI-generated. Claude wrote it from the mod's
  repository and design record."* (known issues: *"Like the <x.y> changelogs, this list is AI-generated. Claude wrote it from the mod's
  repository and test records."*; the forum post: one disclaimer for both changelogs). Keep the user's wording.
- **Every figure names the version and game it was measured on** ("In mod 1.1.1's ten test campaigns on Victoria 3 1.15.1"); state the
  testing plainly up front: how many automated campaigns ("observer runs, no player") against how many of vanilla, plus manual play.
- **Vanilla is a reference, never the goal:** "for reference, vanilla 1.15.1: 30%", never "fewer than vanilla" as if matching it were the aim.
  The aims are the mod's own. A band is two-sided: above it is a miss, never "met".
- **Unemployment as a percentage** (34% against 30%), never a ratio of shares. Research described **by tree**. A plan names its version
  ("planned for mod 1.2"), never a date the user has not given publicly.
- Player terms only: rung, tier, craft and merged method are defined in the over-vanilla text; in-game names as the game shows them ("Tier 2
  Electrics Industries", "The Five-Year Plan"); no §, F-number, landmine, book name, sha, config key or file path outside the Modding section.
- One claim per bullet, short sentences, British spelling as in the precedents (modernise, subsidise), numbers with thousands separators.

## 4. Check, then hand over

- **`node tools/check_release_notes.mjs release_notes/<v>`** — for each text: Steam's byte count (the file's UTF-8 bytes plus one byte per
  line break, the CRLF a browser submits; the change note must be ≤ 8,000, `k_cchPublishedDocumentChangeDescriptionMax`; the other Workshop
  posts are held to the same as a precaution), balanced BBCode tags, the right dialect for the file, and no internal reference (§, F-number,
  backticks, Markdown). Exit 1 = fix and re-run.
- Read every text back once as a player would: figures against the measurement and the build, counts re-counted, no line claiming what the
  release does not do.
- Show the user, in the final message: the verifier's verdict and the deployed folder; each text's path with where it goes (the table above),
  its size; what changed in the known issues; what the user must do, in order — upload from the deployed folder with
  `steam_changenote.txt` as the change note; post `steam_over_vanilla.txt` and update the known-issues discussion; replace the forum
  thread's changelog post whole with `forum_post.txt` and the first post's known issues with `forum_known_issues.txt`; edit the obsolete
  statements step 1½ found in the Workshop description and the forum's first post; tell Claude when the upload is done. Offer to commit the texts, CHANGELOG.md and KNOWN_ISSUES.md (explicit paths) with
  the hand-over.

## 5. After the upload (on the user's word)

- **Tag:** `git tag -a v<v> <release-build commit> -m "Mod <v> for Victoria 3 <g> (Steam Workshop)"`, `git push origin v<v>` (memory
  `git-workflow-main-direct`). The commit is the one `verify_release_build.mjs` names, not HEAD if docs came after it.
- **The change note as published:** read it back from the Workshop page's change notes (the built-in browser, or the user pastes it), compare
  its words with the draft's, and save the draft's BBCode as `CHANGELOG_WORKSHOP/<v>.txt` when they match; note any difference from the draft. A published note is never rewritten (CLAUDE.md §5.2).
- **The other texts as published:** the forum changelog post and first post (the user pastes them from the editor's BBCode view) and any Workshop discussion the user
  edited go into `release_notes/published/` as read (`forum_changelog_post_<v>.txt`, `forum_first_post.txt`, `workshop_description.txt`),
  replacing the older copy; a difference from the draft is named to the user.
- **Docs, same pass:** CLAUDE.md §4.1 ("the Workshop carries mod <v>"; the tag) and §4.2 if the measurement is new; ROADMAP (the release done);
  BACKLOG (items closed by it); ON_GAME_UPDATE §3's version log if the game version moved; the game-update register closed; REPO_GUIDE if a
  tool changed; the memory files `release-timeline-1-0-and-1-1` and `pending-user-reminders`.
- The next default build turns `mod/` back into a debug build; that is expected and needs no commit until a later release.

## Traps

- A debug build in the mod folder looks fine in game and in the launcher (only the name's "(built …)" stamp gives it away): only the verifier
  proves a release build. Never upload from `mod/` when the verifier has not passed since the last build.
- `mod/` after a git checkout differs from the deployed copy in line endings only; the verifier allows that and nothing else.
- Figures from the debug-build measurement apply to the release build: the two differ only in logging and names (H8). Say "mod <v>", not "the
  release build", in the texts.
- The forum post and the Workshop discussions are not limited the way the change note is, but a 20 kB forum post is fine and a Workshop post
  over 8,000 bytes is unverified: keep the precaution.
- A count copied from the previous release's text is wrong as soon as vanilla adds content (companies, vanilla files replaced, research
  entries): re-count every one from the build.
