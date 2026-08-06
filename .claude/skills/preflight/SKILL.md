---
name: preflight
description: Walk the testbed landmine register before a measurement batch, and register a new landmine when one is found. Use before launching any run via run_schedule.ps1, after changing tools/telemetry_lib.ps1 or tools/build.ps1, and whenever a run produces data that looks fine but reads wrong. Covers the judgment checks tools/preflight.ps1 cannot automate (unbounded scopes, mid-batch edits) — the automated ones already run inside the build.
---

# Preflight — the half a script cannot check

`tools/preflight.ps1` runs inside `build.ps1` and `run_schedule.ps1` and **throws**. It already
covers L1, L2, L4, L5, L6, L7, L8, L9. **Do not re-do its work by hand** — read
`TESTBED_LANDMINES.md` for what each ID means, and trust the exit code.

This skill is the remainder: the entries whose answer is not available at build time, and the
discipline for adding new ones.

## Before launching a batch

Run the repo gate first (two seconds, no build):

```bash
powershell -ExecutionPolicy Bypass -File tools/preflight.ps1 -RepoOnly
```

Then answer these two, in the reply, before asking the user for go-ahead:

**L3 — is every scope still bounded at the run's END date?**
Not at 1836. Which market a country belongs to *changes*: a per-pop sweep verified cheap at 1836
(178 pops) emitted 20 686 lines by 1850 because Belgium had joined the British market, and only
5 212 survived the ring — a biased 75 % subset that looked like clean data. For each metric the
schedule enables, state the scope and what bounds it at the final year. `every_country` and
`every_market` are unbounded by definition and are fine only because they are cheap per entity;
anything keyed on **one country's market** is the shape to distrust. If the answer is "probably
fine", it has not been checked.

**L10 — is a batch already running?**
`run_schedule.ps1` rebuilds the mod before every run, so an edit to `telemetry_lib.ps1` or
`build.ps1` lands in run 2 but not run 1 and the arms stop being comparable. Check for a live
`victoria3.exe` and for a session folder with no completion marker. If one is running, **queue the
edit** — including edits that look cosmetic, such as a schema-version bump.

Then state the arm, span, n and metrics back to the user per the hard rule in `CLAUDE.md`, and wait
for an explicit go-ahead.

## After a run that looks wrong

The landmines all present as *plausible* data, so "the numbers look odd" is the symptom. In order:

1. `meta.json` → `error_log_lines`. Low thousands is normal for a control; hundreds of thousands
   means a metric is erroring every tick. ⚠ It is **not a per-run number** (L9) — it includes
   whatever the shared ring still held, so treat it as an upper bound and confirm by looking for
   lines naming `zzz_v3tb_telemetry.txt`, which are ours by definition and should be **zero**.
2. `summary.json` → `integrity.partial_dumps`. A truncated dump is ring loss (L4), not a finding.
3. The run's own `telemetry.json`. Compare it against what the schedule asked for — a key present in
   the schedule and absent here was dropped in transit (L5).
4. A metric reading exactly zero for every entity is an undefined script value (L6), not a result.

## When you find a new landmine

Three steps, in this order, in the same pass:

1. **Entry in `TESTBED_LANDMINES.md`** — ID, what it looks like, why it is silent, the fix idiom, and
   the numbers. Link to `BUGS_AND_FIXES.md` for the root cause rather than restating it.
2. **Detector as `Test-Lm<ID>` in `tools/preflight.ps1`**, registered in `$CHECKS`. Read the
   **emitted artifact**, never the generator that produced it.
3. **Prove the tripwire trips.** Break it on purpose, watch preflight fail, revert, watch it pass.
   A guardrail that has never failed is not known to work.

**A detector that can be code becomes code.** Leaving an entry MANUAL because writing the check was
inconvenient defeats the register: a manual step is one that gets skipped, and these are exactly the
failures nobody notices being skipped.
