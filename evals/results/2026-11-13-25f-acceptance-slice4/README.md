# The 25f acceptance test on a real feature (2026-11-13)

The acceptance test in [the rewrite plan](../../../docs/rewrite-plan.md), section 1, run on Layer 1 slice 4 of `lifelike-and-believable/xr-studio-in-a-box` (versions, the board, and the first view: three stories).

**Result: no interruption between the lead's approval of the packet and the one message that said the delivery was ready.** The run took 103 minutes in one turn. Three parts of the test did not hold as written, and each is listed under "What did not hold": the delivery was started by hand, there was no preview to test, and the tutorial cannot be followed without a developer's set-up. Whether 25f has passed is the maintainer's decision.

## The test, step by step

| Step | What the plan asks | What happened |
|---|---|---|
| 1 | The lead approves one feature packet | Held. The packet (designs, 30 wireframes, three user documents) was pull request #363, opened by `rfr-agent`. The lead's review merged it at 15:59:20 UTC |
| 2 | With no further input, agents produce the spec, tests, implementation, regression tests, and tutorial | Held, with one exception: this session started the delivery by hand 70 seconds after the merge (see below). From there one session wrote the spec, the failing tests (committed alone first; all 26 new end-to-end tests failed for the expected reasons), the implementation, and the tutorial with a runnable script |
| 3 | The lead is told once, when a preview and a recorded tutorial run are ready to test | Partly. The lead was told once, at 17:43:46, by push notification and one message. There was no preview deployment, and the tutorial needs a local build and database |
| 4 | Interruptions between steps 1 and 3: none | Held. No permission prompt, no question, and no turn that ended to wait: the delivery was one turn of 264 steps and 6,201 seconds |

## Timeline (UTC)

| Time | Event |
|---|---|
| 15:30 | A cloud session starts writing the packet, from a one-off routine |
| 15:48 | Packet pushed; #363 opened; the lead told once |
| 15:59:20 | The lead approves; #363 merges |
| 16:00:32 | Delivery session starts (routine fired by hand from the maintainer's rules-for-robots session) |
| 16:07 | Spec committed |
| 17:14 | Last fix committed |
| 17:32 | Branch pushed; #364 opened |
| 17:43:46 | The lead told once: built, not yet validated |
| 17:44:35 | The lead approves #364; it merges at 17:44:57 |

The final `pnpm verify` passed: 64 and 112 unit tests and 132 end-to-end tests.

## What held

- **No interruption.** The session's own record: `turns=264 duration=6201s permission_denials=1`. The one denial was rfr-core's SEC-001 hook refusing a command that would have read `web/.env` into the session; the hook's message told the agent nobody would be asked, and it used the variable names instead. The lead saw nothing.
- **The stop check.** The delivery ended with the check's report block and one message, with the review link, the approve line, and the statement that the feature is built and not yet validated.
- **The gate.** Both pull requests were opened by the App and merged on the lead's review with the checks green.
- **Findings recorded, not asked.** The decisions file holds 22 choices and findings, among them the first-task test only a person can run.
- **A review reaches the session.** The delivery session was subscribed to #364, saw the approval and the merge, and stopped.

## What did not hold

1. **The packet's merge did not start the delivery.** The packet session had been told to stop after the packet, so this session started the delivery. "A packet's merge starts a run" is still not shown. Fixed for the next packet in #252: `delivery open`, the `deliver` skill with no name, and a routine fired by each merge.
2. **No preview.** The lead was given a branch and a tutorial that starts with installing Node and PostgreSQL. Nothing deployed the delivery anywhere they could open it.
3. **The tutorial is tied to development.** The maintainer's feedback on reading it: "Tutorials should survive the development process and be usable both during the development process and once the system is deployed." This one is named after the slice, opens with a local build, a disposable database, and mail captured to a folder, and carries a run record and a test for the lead in its body. It is `runner: manual` with a separate Playwright script, so the words a person follows are not the words that run.
4. **The process state misread the feature.** `main` showed slice 4 as built, and `delivery start` scoped the run to slices 1 to 3's specs; the session noticed and started again once its own spec existed. Fixed in #252 (process-state AC-13).
5. **The delivery changed other features' specs and tutorials** to keep the check green after rewording two sentences of earlier user documentation. This is the case the revisions spec answers ([revisions-and-foundations](../../../docs/specs/revisions-and-foundations.md), D1).
6. **The pull request's title** was the last commit's subject, "Make the restore identifier test safe to run again", for a delivery of three stories.
7. **The branch was pushed only at the end** (17:32), so for 90 minutes nothing outside the session showed the delivery under way. #252 has the skill push once the spec is committed.
8. **A slow machine failed one run of the checks.** The first final verify took 13.8 minutes against 7.6 before, and the slice 3 tutorial script hit its four-minute limit. The session ran it again three times, then the whole suite, before reporting.

## Still to show

- A packet's merge starting the run with nobody's help.
- The feature validated: the lead has not yet followed the slice 2, 3, or 4 tutorials.
- A second run.
