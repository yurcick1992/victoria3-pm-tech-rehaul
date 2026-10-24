# Vanilla building special conditions dropped by our replace/split

A catalogue of **special conditional fields inside vanilla building definitions we OWN and regenerate**
(tier-split or clone-and-swap) that our emitted building does **not** reproduce. Unlike the *external*
vanilla scripts (events / journal entries / triggers / modifiers) that name a tiered industry — catalogued in
`TIER_REFERENCE_AUDIT.md` and rewritten by `tools/emit_vanilla_refs.mjs` — the cases here are **fully in our
control**: we chose to flatten/omit the field when regenerating the building. They are therefore directly
fixable; we're just **deferring** them to a batch pass.

**Part of the `MISSING_*` family** (CLAUDE.md §5.4): vanilla references to the tiered industries →
`TIER_REFERENCE_AUDIT.md` (it supersedes the older generated `MISSING_PM_REFERENCES.md`); dropped building
conditions → this doc.

**Convention:** when a tier-split or clone drops a special vanilla building condition (a conditional
`ai_value` block, `should_auto_expand`, `potential`, `possible`, a `unique` flag, a scripted trigger inside
the building, …), **append it here** rather than fixing it piecemeal. Re-audit after any tiering change or
game patch. *(Future: a tool could generate this by diffing each replaced vanilla building block against what
the builder emits — a sibling to `tools/audit_pm_refs.ps1`.)*

The non-clone builder path emits a **scalar** `ai_value` (per-tier override, else the config
`building.ai_value`, else engine default); it cannot emit a conditional `ai_value = { … }` block. The
clone-and-swap path (`clone_from_vanilla`; the six-rung book's power, port and railway — the canon clones
nothing) *does* preserve the vanilla block verbatim, so clone-emitted buildings are not affected.

| Building (replaced) | Our industry | Dropped condition | What it did in vanilla | Vanilla source |
|---|---|---|---|---|
| `building_art_academy` (+ its 3 new tier buildings) | `art_academy` | conditional `ai_value` block | `value = 1000`, **`+500` when the owner is `c:AUS` and `has_journal_entry = je_metternich`** — AI Metternich wants art academies more. We emit a flat `ai_value = 1000`. | `common/buildings/06_urban_center.txt` |

**Planned fix (batch):** teach the non-clone builder to carry a verbatim `ai_value = { … }` block from the
vanilla base building onto its split tiers when no scalar override is set — a general capability that would
cover every future split building with a conditional `ai_value`.
