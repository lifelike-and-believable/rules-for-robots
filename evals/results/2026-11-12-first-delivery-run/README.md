# The first real delivery run (2026-11-12)

The first time the rewrite plan's delivery run ([docs/specs/delivery-run.md](../../../docs/specs/delivery-run.md)) carried a real feature: Layer 1 slice 2 of `lifelike-and-believable/xr-studio-in-a-box` (facts, work samples, the identifier filter, and the activity log). It is the evidence phase 25f of [the rewrite plan](../../../docs/rewrite-plan.md) asks for, short of the acceptance test itself.

**Result: the run finished without interrupting the lead.** One message started it. About 46 minutes later it had pushed the tests, the implementation, the tutorial, and its decisions, and told the lead once what to review. The lead approved after reading the decisions, and the pull request merged itself when its checks passed.

## What was in place

- The GitHub gate on the repository: pull requests opened by the `rfr-agent` App, the lead's review required on the gated folders, auto-merge.
- Required checks: `verify`, `process / process-trace`, `process / tier`, `process / change`.
- rfr-core 7.3.0 and rfr-process from `main` (1.5.0 when the session started), in a new cloud session.
- Approved before the run, each by the lead's review in GitHub: the slice 2 designs (#349), user documentation (#351), and spec (#352, #353).

## Timeline (UTC)

| Time | Event |
|---|---|
| about 22:22 | The lead started a new session and asked it to deliver slice 2 |
| 22:34 | Failing tests committed, then the spec's record of that commit; pushed. Pull request #356 opened by `rfr-agent`; `verify` failed on it, as tests written before the code should |
| 23:01 | Implementation committed |
| 23:04 | Tutorial, a runnable script for it, and the decisions file committed |
| 23:09 | Final push |
| 23:10:57 | The lead approved, after reading the decisions |
| 23:13:12 | `verify` passed; the pull request merged itself |

The pull request: 5 commits, 100 files, about 11,500 lines added.

## What held

- **No interruption.** By the lead's account the session asked nothing during the run, and told them once at the end what to review.
- **The order.** Failing tests, then the code, then the tutorial, each its own commit.
- **The gate.** The pull request stayed open through three pushes and merged only after the lead's approval and a passing `verify`.
- **Decisions recorded, not asked.** `docs/decisions/layer1-facts-identifiers-activity.md` lists 20 choices the approved documents left open, each taking the most conservative reading, and says where the build departs from a mock-up. The workflow put the file in the pull request's description, with the review packet (0 open choices, 4 assumptions) and the approve line.
- **Setting aside.** The run touched the slice 1 spec only to refresh two hashes, and set that spec's missing tutorial aside with the reason, as work that is slice 1's.

## What the run found

- **A delivery pushed part-way could have merged before validation.** Every pushed branch has auto-merge on, and the pull request touched no gated folder until the tutorial arrived. Once the implementation made the checks pass it would have merged with nothing for the lead to review. Fixed while the run was under way: `process / change` fails a feature's pull request until its tutorial exists (process-state AC-12, #226).
- **An earlier slice had been built with no tutorial**, from before tutorials were required. The delivery run assumed a feature starts at its spec, so it could not finish such a feature. Fixed: a run can be started for a named feature and asks only for what it lacks (delivery-run AC-9 and AC-10, #227).
- **The `process / approvals` check shows red on a gated pull request until the lead approves.** It is redundant under the gate and is due to go in 25e.

## What it does not show

- **Whether the feature is right.** The lead approved after reading the decisions; following the tutorial against the delivery is still theirs to do.
- **The automatic trigger.** The lead's message started the run. The packet's merge did not, because the session had not subscribed to it.
- **The stop check under pressure.** GitHub shows the result, not whether the check had to send the agent back. The session's transcript would say.
- **Repeatability.** This is one run on one feature, and the model the session ran on was not recorded. The delegated eval (19i-4) is the controlled version.
