# Fixed bugs & root causes

A running log of **non-obvious bugs**, their real root cause, and the fix — the kind that the economics
linter can't catch and that took real investigation to pin down. **Not loaded into context by default.**
Consult it:

- when investigating a **new bug** (the same root causes recur — especially the PM-emitter whitelist and
  main-PM renaming),
- on an **explicit ask** ("what did we fix / why did X break"),
- after a **game update**, alongside `ON_GAME_UPDATE.md`.

Each entry: symptom → root cause → fix → how to detect/prevent next time. Newest first.

---

## Recurring themes (read first)

1. **The builder's PM emitter is a WHITELIST.** When we regenerate a tier's main PM
   (`New-...` in `build.ps1`), it only reproduces: goods in/out, employment, `state_pollution_generation`,
   `state_infrastructure`, `country_ship_construction`. **Any other modifier on the vanilla PM is silently
   dropped** — `country_modifiers`, other `state_*_add`, `disallowing_laws`, `unlocking_*`, etc. The
   economics linter won't notice (it only checks break-even). → When tiering a new building or after a
   patch, **scan each `vanilla_pm` for anything outside the whitelist** (`country_modifiers`, unexpected
   `state_*_add`, etc.).

2. **Renaming/splitting main PMs breaks references to them by name.** Our tiers rename each vanilla main PM
   (`pm_crystal_glass` → `pm_main_glass_crystal`) and put it in its own building. Anything in vanilla that
   references a main PM **by its original name** stops matching — `unlocking_production_methods`, and
   potentially other cross-references. → When splitting a chain, **grep vanilla for the vanilla main-PM
   names** to find who else depends on them.

3. **The linter checks economics, not engine behavior.** Naval capacity, PM gates, `port = yes`, AI
   values, infrastructure output — all invisible to `lint.sh`. A green build is necessary, not sufficient;
   **in-game load + `error.log` is the only real check** (see `MODDING_NOTES.md`).

---

## 2026-07-18 — 1836 start: `Invalid production method: pm_anchorage` (90× in error.log)

**Symptom.** `error.log` at load: 90× `create_building effect [ Invalid production method: pm_anchorage ]`
in our re-tiered `common/history/buildings/*.txt`. (Found via the new self-diagnostic in-game test.)

**Root cause.** `pm_anchorage` is vanilla's *undeveloped-port* base PM. The 1836 start has ports on it.
`convert_history.ps1` matches a factory's active main PM against each tier's `vanilla_pm` (port = basic /
industrial / modern) — `pm_anchorage` matches none, so the block is left **unchanged** (still
`building_port` + `pm_anchorage`). But `building_port` is now our T1 (PMG `pmg_main_port_basic`, no
`pm_anchorage`), so the activated PM is invalid for it.

**Fix.** New per-tier **`vanilla_pm_aliases`** (list) in the config + `history_lib.ps1`: extra vanilla main
PMs that also map to that tier. Set port T1 `vanilla_pm_aliases = ["pm_anchorage"]`, so undeveloped ports
convert to our basic port (T1). Verified: 0 `pm_anchorage` left; conversion 604→694.

**Detect/prevent.** After tiering any building, check the 1836 history for its **base/level-0 PM** (ports:
anchorage; some buildings have an inert base main PM) — it won't match a tier's `vanilla_pm` and will be
left invalid. Add it to that tier's `vanilla_pm_aliases`. The converter's `unmapped` warning also flags it.

## 2026-07-18 — Known limitation: `is_production_method_active` checks on split main PMs (log noise + missed flavor)

**Symptom.** `error.log`: `is_production_method_active trigger [ Invalid Production Method 'pm_mechanized_workshops' / 'pm_electric_trains' / 'pm_diesel_trains' … ]` (a few each, more as the game runs).

**Root cause.** Theme #2 at scale. Vanilla industrialization/modernization **events, journal entries, and
scripted effects** (e.g. `save_industrialized_pm_building_and_state` in `common/scripted_effects`, used by
`events/pm_events.txt`) check `is_production_method_active = { building_type = building_X; production_method = pm_Y }`
where `pm_Y` is a **main** PM we split/renamed onto a separate tier building — so the base building no longer
has it, and the trigger errors and returns **false**.

**Impact.** Low: those checks fail → the flavor/journal content that detects "this building is industrialized/
modern" won't fire for our tiered buildings. **No crashes.** Long-standing for manufacturing (since the v0.1
split); railway variants arrived with Phase 2. **Not fixed** — a comprehensive fix means owning
`scripted_effects` / `scripted_triggers` / `journal_entries` / `events` and rewriting every such check to our
tier structure (check for our tier *building* instead of the old main PM). Deferred pending a decision on
whether the affected content is worth it.

## 2026-07-17 — Gated secondary PMs stopped working (bone china / elastics / precision tools)

**Symptom.** After the tier split, secondary PMs that were gated behind a primary PM became permanently
unavailable — e.g. **Bone China** could not be selected on the Crystal Glassworks (glass tier 3).

**Root cause.** Three vanilla secondaries are gated by
**`unlocking_production_methods = { <vanilla main PM> }`** — only available when one of those *main* PMs is
present in the building:

| Secondary | gated behind (vanilla main PM) | should appear on |
|---|---|---|
| `pm_bone_china` (glass porcelain) | `pm_crystal_glass`, `pm_houseware_plastics` | glass T3, T4 |
| `pm_elastics` (textile luxury) | `pm_sewing_machines`, `pm_electric_sewing_machines` | textile T3, T4 |
| `pm_precision_tools` (furniture luxury) | `pm_lathe`, `pm_mechanized_workshops` | furniture T2, T3 |

The split renamed those main PMs (`pm_crystal_glass` → `pm_main_glass_crystal`) and moved each into its own
building, so the gate referenced a PM that is **never present** in the tier building → the secondary
silently locked. (Theme #2.)

**Fix.** The gate lives inside the vanilla PM, and V3 rejects cross-file PM redefine, so the builder now
**whole-file-replaces `common/production_methods/01_industry.txt`**: it copies vanilla verbatim but, for
every `unlocking_production_methods` list, **appends our tier `pm_key`** for each split vanilla main PM it
references (map `vanilla_pm → pm_key`, built from the config). The secondary then unlocks at exactly the
tiers whose main PM satisfied it in vanilla. Scope: exactly 3 PMs, all in `01_industry.txt` (06/11 have
none). Verified: 106 PMs preserved, untouched PMs byte-identical, gates correctly extended, LINT 53/53
(the linter reads vanilla + `zzz`, not the owned copy).

**Detect/prevent.** After a patch or when splitting a new chain, grep vanilla `common/production_methods`
for `unlocking_production_methods` and check whether any listed PM is one we split. The builder's remap now
handles any such gate automatically on rebuild — but only for files it owns (currently `01_industry.txt`);
if a gated secondary appears in another PM file, own that file too.

---

## 2026-07-17 — Shipyards make clippers but navies can't be built or maintained

**Symptom.** After the shipyard split, shipyards still produced **clippers**, but **navies would not build**,
and existing 1836 navies **decayed over time from missing maintenance**.

**Root cause.** The base shipbuilding PMs carry a **country modifier on the same PM that outputs
clippers/steamers**:

```
pm_basic_shipbuilding = {
    country_modifiers = { workforce_scaled = { country_ship_construction_add = 5 } }   # <-- naval capacity
    building_modifiers = { workforce_scaled = { ... goods_output_clippers_add = 40 } }
}
```

`country_ship_construction_add` (basic 5 / complex 10 / metal 15 / arc 20) is the capacity that **builds and
maintains navies**. Our PM emitter only copied goods/employment/pollution, so it **dropped the
`country_modifiers` block** → shipyards granted **zero** ship construction. (Theme #1.)

**Why it was hard to find.** `country_ship_construction_add` is a **country modifier, not a good**, so it was
invisible to every goods-based search. Dead ends ruled out along the way: `clippers` is an **`industrial`**
good (trade convoys / fishing / ports), *not* a naval-unit good; there are **no naval `combat_unit_types`**;
the naval buildings (`naval_administration`/`fortification`/`logistics_center`) consume
small_arms/artillery/steel, not ship goods. The capacity comes solely from the shipbuilding PMs' country
modifier.

**Fix.** New per-tier **`ship_construction`** config field → emitted as
`country_modifiers { workforce_scaled { country_ship_construction_add = N } }`; set **5 / 10 / 15 / 20** on
the four shipyard tiers. Audited every tiered `vanilla_pm` for `country_modifiers` / unhandled
`state_*_add`: **the shipyard chain is the only one affected**.

**Detect/prevent.** This is the canonical Theme-#1 case: the emitter whitelist dropped a modifier. When
tiering any building, dump its `vanilla_pm`s and look for modifier blocks the emitter doesn't carry.
