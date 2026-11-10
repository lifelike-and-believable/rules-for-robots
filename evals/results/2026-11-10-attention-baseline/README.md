# Attention baseline (2026-11-10)

The baseline for slice 19a of [the improvement plan](../../../docs/improvement-plan.md): how often sessions waited on the maintainer, and for how long, before any delegated-mode change. Produced by `checks/attention-report.mjs` from the Claude Code transcripts on the maintainer's machine. The JSON files hold counts and durations only; no message text, paths, or tool inputs.

```
node checks/attention-report.mjs <project transcripts folder> --repo <owner/name> --json
```

| Project | Sessions | Merged pull requests | Waits | Blocked | Words typed | Per merged pull request |
|---|---|---|---|---|---|---|
| XR pipeline (design stages, rfr-process) | 1, over 2.7 days | 5 | 168 | 62.3 h | 10,355 | 33.6 waits, 12.5 h, 2,071 words |
| Launcher (delivery, rfr-process) | 2 | 15 | 105 | 17.3 h | 1,312 | 7.0 waits, 1.2 h, 87 words |
| rules-for-robots (framework work) | 3 | 4 | 74 | 28.6 h | 821 | 18.5 waits, 7.1 h, 205 words |

What the waits were:

| Project | Permission prompts | of which merges | Questions (AskUserQuestion) | Replies after a turn ended | Median reply wait |
|---|---|---|---|---|---|
| XR pipeline | 11 | 6 | 22 | 135 | 1.1 min |
| Launcher | 35 | 11 | 18 | 52 | 1.2 min |
| rules-for-robots | 35 (18 Edit, 16 Bash) | 0 | 0 | 39 | 2.7 min |

## Reading it

- Most waits are replies: the agent ended its turn, and the session waited until the maintainer typed. The median is a minute or two, so the maintainer was usually present; the total is dominated by a few long gaps (overnight, other work), which is still time the work sat still.
- Merge confirmations are the commonest prompt in the process projects: 6 of 11 prompts in the XR pipeline and 11 of 35 in the launcher. This is the rfr-process merge guard (solo mode: the merge is the approval).
- The XR pipeline is all design stages, where the maintainer is meant to be involved, so its word count is high by design. The launcher is the better picture of delivery work.
- In this repository, 6 of the 18 Edit prompts were test edits (the test-edit guard); the rest were edits to documentation, build scripts, and skills that Claude Code's own permission mode asked about. The Bash prompts were mostly inline `node -e` scripts, git branch work, and `gh pr create`.

## Limits

- The Kettlebird pilot's transcripts are on another machine, so it is not here. Run the same command there to add it.
- A reply's wait runs from the end of a turn to the next typed message. It counts time the maintainer spent elsewhere, and cannot tell a question from a finished report. Both stop the work, which is what this measures.
- The maintainer's own minutes (reading and deciding) are not recorded anywhere. Words typed is the proxy.
- Merged pull requests are counted with `gh` between the first and last event, so a pull request merged by another session in that window is counted too.
- Process gates decided at GitHub are measured by the gate report (slice 23a), not here.
