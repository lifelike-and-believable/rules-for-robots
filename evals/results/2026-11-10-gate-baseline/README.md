# Gate baseline (2026-11-10)

The baseline for slice 23a of [the process plan](../../../docs/improvement-plan-process.md): for each pilot that uses `rfr-process`, which merged pull requests changed a gated stage, how long each waited from its request for approval to the merge, and whether anything changed in between. Produced by `checks/process-gate-report.mjs` with `gh`; the JSON files hold pull request numbers, stages, times, and counts, with no titles or text.

```
node checks/process-gate-report.mjs --repo <owner/name> --label <name> --json
```

| Pilot | Merged | Gated | Unchanged after the request | Median wait | Total wait |
|---|---|---|---|---|---|
| Kettlebird (website, delivery) | 164 | 96 | 91 (95%) | 0.0 h | 13.1 h |
| XR pipeline (design stages only) | 6 | 6 | 5 (83%) | 0.2 h | 1.7 h |
| Launcher (design and delivery) | 15 | 11 | 7 (64%) | 0.1 h | 1.0 h |

By stage, Kettlebird, the largest history:

| Stage | Pull requests | Unchanged |
|---|---|---|
| concept | 3 | 100% |
| personas | 3 | 100% |
| requirements | 6 | 100% |
| epics | 18 | 94% |
| stories | 15 | 100% |
| design | 50 | 96% |
| user-docs | 35 | 100% |
| tutorials | 32 | 91% |

## What it answers

The improvement brief asked whether the maintainer's approvals often changed anything, because a "yes" would mean keeping more stages as `approve` and investing in the review packet rather than provisional delivery.

At the pull request, approvals almost never changed anything. In Kettlebird, 91 of 96 gated pull requests merged with no later commit, no request for changes, and no note from the approver; the median time from request to merge was under three minutes. The one long wait (6.8 hours, a design pull request) is probably the six-and-a-half-hour merge prompt the process spec records; this report cannot tell.

That does not mean the maintainer's review changes nothing. It happens earlier, in the session, before the pull request is opened: the attention baseline (`../2026-11-10-attention-baseline/`) shows 135 replies and 10,355 typed words over the XR pipeline's five design pull requests, and the launcher's merge comments quote instructions such as "make those changes and merge". So:

- The intent review is real work and does shape the result, as the process plan assumes. It belongs in a review packet the maintainer reads once per feature, which is what 23c builds.
- The pull request gate itself is mostly a confirmation step. Merge confirmations are the commonest permission prompt in both process projects. Turning the derived stages (requirements, epics, stories) into `notify` (23b) and removing the label wait (23f) lose nothing these histories can show.
- Provisional delivery (23d) still waits on the 23k probes, as planned; this data cannot say whether building early anchors the maintainer.

## Limits

- Agents commit and comment from the maintainer's account in solo mode. Commits after the request are an upper bound on approver-driven changes; comments in the forms agents use (merge notes, CI reports, "Done in ...") are excluded by pattern, which can miss an unusual agent comment or exclude an approver's.
- A review held in the session before the pull request was opened is invisible here; see the attention baseline for that side.
- Kettlebird's in-session history (its transcripts) is on another machine and is not in the attention baseline.
