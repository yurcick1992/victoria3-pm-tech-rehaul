# Fixtures of the same-book gate (landmine L54)

These files are never launched. They are the proof that the gate of `tools/testbed/lib_same_book.ps1` exists and trips:
`tools/preflight.ps1`'s `Test-LmL54` runs `Get-SameBookPlan` (the function `run_schedule.ps1` itself calls at plan time) on
every `*.json` here and fails the walk when one behaves otherwise than its `_expect` says. The rule is BALANCE_FRAMEWORK
§10.118; the entry is TESTBED_LANDMINES L54; the procedure is TESTBED_OPERATIONS §2.3.

**The schedules.** Each carries three keys the scheduler ignores (a `_` prefix marks a comment):

| key | meaning |
|---|---|
| `_expect` | `throw` or `pass`: what the gate must do |
| `_expect_message` | on `throw`: a piece of text the error must contain, so a throw for another reason does not count |
| `_expect_kinds` | on `pass`: the `run_kind` of each run, in order |

| fixture | what it shows |
|---|---|
| `short_config_no_flag` | the case the rule exists for: a run on a book that stops in 1855 and says nothing — throws |
| `second_run_short_no_flag` | the same when the short run is not the first — throws, naming run #2 |
| `short_config_probe_syntax`, `short_config_probe_performance_defaults` | the two probe kinds, on the run and in `defaults` — pass |
| `short_config_checkpoint` | a checkpoint leg — passes |
| `full_span` | full runs — pass |
| `short_control_no_flag` | the gate judges books only: a short control run passes, recorded `short` |
| `probe_banana` | a probe kind that does not exist — throws |
| `probe_and_checkpoint`, `checkpoint_full_span`, `checkpoint_autosave_never` | flags that contradict the run — throw |
| `continuation_with_probe`, `continuation_without_parent`, `continuation_middle_leg_no_checkpoint` | a continuation's own rules — throw |
| `full_until_1900`, `full_until_1950` | a schedule that moves the full span, earlier (the way round the gate) or later — throw: the span is 1936.1.1 and not a lever |
| `full_until_stated_default` | the key saying 1936.1.1 changes nothing — passes |
| `short_release_no_flag` | a release build is a book of ours: a short run with no flag — throws |
| `short_release_probe_syntax` | the legal short form of a release-build load check, and a full release century — pass |
| `short_overlay_no_flag` | an overlay arm is vanilla + one declared file, not a book: a short run passes, recorded `short` |

Any of them can be shown to a person through the scheduler, which stops at the gate before it builds or launches anything:
`powershell -ExecutionPolicy Bypass -File tools\testbed\run_schedule.ps1 -Schedule tools\testbed\fixtures\same_book\<name>.json -WhatIf`
(a passing fixture goes on to the pre-batch preflight, which fails on L19 while a game is running).

**`reader_session/`** is a session of five stub runs for the reader half: `check_readers.mjs` asks
`ledger/lib_runs.mjs` `usableRuns()` for it and requires the two runs whose `build_state.json` says `probe:*` to be dropped
and the other three (a full run, a checkpoint leg, a run from before `run_kind` existed) to be kept. `continue_save` in the
continuation fixtures names this README only because the scheduler requires that file to exist.

To add a case: one more `*.json` with its `_expect`. `Test-LmL54` refuses to pass with fewer than five throwing and five
passing fixtures, and without `short_config_no_flag`, `short_release_no_flag` and `full_until_1900` each refused for its own
reason, so deleting them does not make it green. The third-party arm's continuation rule (the mod's layout fingerprint must be
the parent's) has no schedule here, because it needs a mod folder and a parent run: `Test-LmL54` checks it on synthetic parents.
