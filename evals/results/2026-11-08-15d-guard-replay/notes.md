# Notes on the 15d guard replay

`report.md` and `summary.json` come from:

```
node checks/guard-replay.mjs extract <session>.jsonl <session>/subagents/*.jsonl --root <checkout> --out evals/replay/rfr-session-2026-11-08.jsonl
node checks/guard-replay.mjs run evals/replay/rfr-session-2026-11-08.jsonl --base 0db6ec4 --specs e5379a6 --out evals/results/2026-11-08-15d-guard-replay
```

The session is the one that built #143 to #154 in this repository on 2026-11-08: 634 calls the guards see, 196 of them from subagents. `0db6ec4` is `main` when the session started; `e5379a6` is `main` after #153 merged.

## How much the result depends on the replay's assumptions

The replay cannot run the session's shell commands, so it gets some file states wrong. Asks for each way of handling that, clean state, baseline (rfr-core 3.1.1) against tiered (this checkout, rfr-core 5.1.2):

| Replay | Baseline | Tiered | Fewer |
|---|---|---|---|
| Edits not applied; every call sees the files at `0db6ec4` | 19 | 14 | 26% |
| Edits and writes applied in order | 15 | 10 | 33% |
| Also with the heredoc fix in the tiered guards | 15 | 8 | 47% |
| Also with `docs/specs/` from `e5379a6` (the reported run) | 9 | 2 | 78% |

The last step matters most. The session added spec `unlocks` entries through shell scripts before it edited the tests they cover. Without them, six edits to `test/hooks.test.mjs` ask in both versions, because the replay never sees the unlocks. With the merged specs, both versions see them, so the comparison stays fair; the session's own edits to the specs are not replayed over them.

The dirty state (an uncommitted change and an untracked file in the clone) gives the same counts: this session's discards and deletes ran where nothing was left to lose.

## What the tiered guards still ask

- A force-push named in a `for` list of test strings, in a command that tried the guard by hand. The guard cannot tell a string in a `for` list from a command, so it asks.
- A Python script that the guard reads as possibly writing to an existing test file.

## Not done: the Kettlebird pilot

AC-8 names the Kettlebird pilot's sessions as well. Their transcripts are on the pilot's machine, not here; `project-process.md` records only their totals (46 asks in twelve hours). Replaying them needs `extract` run there and the output reviewed before it is shared. Until then AC-8 rests on this repository's session alone.
