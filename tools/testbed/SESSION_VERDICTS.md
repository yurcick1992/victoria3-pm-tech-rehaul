# Session verdicts — the committed index

Each annotated session carries a `VERDICT.md` **inside its own folder**, so the annotation cannot be
found separately from the data it describes. But `tools/testbed/sessions/` is **gitignored**, so those
files are not backed up — the same standing hazard as the sessions themselves (`CLAUDE.md`: *gitignored
≠ backed up; deletion here is unconditionally final*).

**This index is the committed half.** It carries the one-line status and the correction that would
otherwise be lost with the folder. The full reasoning stays in the session's own `VERDICT.md`; anything
here that turns out to be load-bearing belongs in `FINDINGS.md` instead, which is where conclusions live.

Newest first. ⚠ = something is wrong with the session; ✅ = sound, annotated for context.

| session | status |
|---|---|
| `20260812_010659_research-events-n3` | ⚠ **PARTIALLY VOID** — clear overshoot on the technology boost, badly exacerbated by military journal entries gated on conditions true far too often, so military technology was shared free and fast (70% of all completions; top firers were micro-states). Knock-ons traced but unmeasured: 13–20 fewer countries survive, research redirected into the other trees, ~10% more war. **The baseline already held 12/17 era-5 production technologies with no events at all**, so most of that overshoot predates the mechanism. Trade not instrumented; concentration null |
| `20260812_003658` | ✅ diagnostic probe, **negative result**: "share of the army mobilised" is not computable — the ratio exceeds 1 for some countries under either denominator. Ships as a one-sided gate only |
| `20260812_001905` | ✅ diagnostic probe. `count >= N` works in a list trigger. ⚠ Its own conclusion that a 100-battalion gate is "unreachable" was **wrong** — that was an 1830s artefact; armies run 206 → 573 battalions over the century |
| `20260811_235642` | ✅ diagnostic probe. `num_mobilized_battalions` is character scope. Found the anti-gaming discriminator (Puerto Rico: at war, no front, zero casualties). ⚠ **That finding was then not applied** to the batch built two days later |
| `20260811_225546` | ✅ diagnostic probe. `root.` prefix is load-bearing and its absence fails silently. Three comparator-suffixed trigger spellings are loc keys, not triggers |
| `20260811_215142` | ✅ diagnostic probe. Occupancy reads as a **weight**, exact to five decimals; journal entries auto-activate for all 285 countries; negative control clean |
| `20260811_094048_three-arm-tc-subsidy` | ⚠ **retrospective** — F49's "the technology distribution has COMPRESSED" is **retracted**: it was one country, not a distribution. Other results stand. `mod_no_tc` is now the `techs` baseline at **n=1**, and its config file has been deleted |
| `20260811_020843_techtree-full-n3` | ⚠ **retrospective** — **it is n=2, not n=3**: run 3 was stopped by hand at 1839 after 328 s. Re-analysis: acquisitions run **+41 to +43 years vs narrative onset** at the median and era-5 about on time, in tension with the "decades early" framing. `tech_log` counts acquisitions, so per-country sorting finds catch-up, not the frontier |
| `20260806_110926_vanilla-retest-2` | ⚠ **retrospective** — **only 1 of 3 runs reached 1936**; the others died at 1933 and 1925, all three needing 5–6 crash resumes. n=1 for any endpoint statistic. Run 3 is a different arm (`vanilla_x10`) |
| `20260805_234555_vanilla-retest` | ⚠ **retrospective** — **"19 runs" is misleading**: 16 are 52-second smoke probes to 1836.4.1; the three long runs all ended in resume failures at 1867 / 1881 / 1893. **No full-length vanilla century exists here.** Very likely where the stale-tail bug was doing its damage |
| `20260805_150128_debut-good-full-v11` + the four other 2026-08-05 debut sessions | ⚠ **retrospective** — **the arm is not recorded** (no `schedule.json`, `built_from_config: ""`); `CLAUDE.md` states they ran on the tiered mod when vanilla was expected. F33's inference is separately retracted |
| `20260805_234450_x10-arm-check` | ⚠ **retrospective** — records `arm: control+pop_needs`, which after the 2026-08-06 rename means **overlay**, not control. `build_state.json` deliberately not back-filled |
| `20260803_030101_wages-n3` | ⚠ **retrospective** — **n=2, not n=3** (run 3 stopped after 50 s; its reported 1933 date is the stale-tail artefact). Matters because the **measured base weekly wage** the whole scenario model applies comes from here. No reason to doubt the number; its n is 2 |
