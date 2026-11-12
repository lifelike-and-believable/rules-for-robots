# Trials 2 to 4: a delivery run in a cloud session, its trigger, and the stop check (2026-11-12)

The remaining trials of phase 25a in [the rewrite plan](../../../docs/rewrite-plan.md), run together on the throwaway repository [lifelike-and-believable/rfr-trial](https://github.com/lifelike-and-believable/rfr-trial), which trial 1 set up.

**Result: all three passed.** The stop check passed on its second version; the first had a fault that the trial found.

| Trial | Passes when | Result |
|---|---|---|
| 2. Auto mode in a cloud session runs a whole delivery | A fixture feature goes from an approved packet to an open delivery pull request with no prompt | Passed |
| 3. The trigger | The session wakes on the packet's merge and starts delivery | Passed |
| 4. The stop check | The agent is sent back to work at least once and finishes; it does not loop | Passed, second version |

## Setup

- `AGENTS.md` in `rfr-trial`: the two pull requests for each feature, the delivery steps (spec, failing tests, implementation, tutorial), and the run's rules (never ask, record open questions in `DECISIONS.md`, push the branch and leave the pull request to the workflow).
- `.claude/settings.json` and `.claude/hooks/stop-check.mjs` in `rfr-trial`: a Stop hook. No rfr plugin was loaded, and no plugin code changed.
- Cloud sessions in the "Default" Anthropic cloud environment, auto mode, Sonnet 5.5, Claude Code 2.1.322, created from the maintainer's session with the claude-code-remote `create_session` tool.
- Two fixture packets written by hand, each a story, design, and user documentation for one subcommand of a small command-line tool.

## Run 1: greet-cli (trials 2 and 3)

The session was told to subscribe to the packet's pull request, wait, and run delivery when it merged.

| Time (UTC) | Event |
|---|---|
| 17:40:08 | Session subscribed to pull request #5 and went idle |
| 17:43:21 | The lead approved #5 |
| 17:43:58 | #5 merged itself |
| 17:44:01 | Session woken by the merge event |
| 17:44:18 | Spec and tests committed; 4 of 6 tests failed, before the implementation |
| 17:44:23 | Implementation committed; 6 of 6 pass |
| 17:44:30 | Tutorial committed, branch pushed, one report, session idle |
| 17:44:39 | The workflow opened pull request #6 as `rfr-agent` |
| 17:47:36 | An approving review on #6 under the lead's account, three minutes after the session went idle |
| 17:50:36 | #6 merged itself |

- No permission denial in any turn, and the session opened, approved, and merged nothing.
- The three commands in the approved user documentation, run against the branch, printed exactly what it says, including the usage line and the exit code.
- Two approvals, and nothing else from a person, took the feature from packet to merged delivery.
- Session cost: about $0.72.

## Run 2: farewell-cli (trial 4)

To see the stop check send an agent back, the session was told to write only the spec after the merge and end its turn.

**First version of the check: failed.** With greet-cli already on `main`, the check treated a session that was only waiting for the packet as an unfinished run, and blocked it six times on "commits not pushed". Six was its cap, so when the session stopped after the spec, the check allowed it: "allow after 6 blocks; still missing: test/farewell-cli.test.mjs ...; docs/tutorials/farewell-cli.md ...". The session left one local commit and no pull request. The trigger worked again in this run (approved 17:56:35, merged 17:57:38, woken on the merge).

**Second version: passed.** Two changes: no block on `main`, where no run is under way; and the cap counts blocks since the last new commit, so a run that is making progress is not cut off. A new session with the same instruction, the packet being on `main` already:

| Time (UTC) | Event |
|---|---|
| 18:03:19 | Spec committed; the session ended its turn, as instructed |
| 18:03:24 | Stop check blocked: tests, tutorial, and push still to do |
| 18:03:35 | Tests written (2 of 3 failed first), then the implementation; 9 of 9 pass |
| 18:03:45 | Tutorial committed and branch pushed; the check allowed the stop |
| about 18:04 | The workflow opened pull request #9 as `rfr-agent`, held for the lead's review |

One block, then a finished delivery, and no loop. The two commands in the approved user documentation, run against the branch, printed what it says.

## What the trials found, for later phases

- **rfr-core blocks the trigger today.** The first session was created in the maintainer's desktop (bridge) environment by mistake, where rfr-core was loaded; its hook refused the `subscribe_pr_activity` tool as a change to another service. 25e removes that hook; until then a delivery session cannot subscribe where rfr-core is loaded.
- **A new session inherits its creator's environment.** A session created from a desktop-bridged session runs on that desktop, not in the cloud, unless a cloud environment is named. 25d names it.
- **The stop check must know which run it is in.** It should look at the feature being delivered, never block a session that is waiting at a gate, and cap blocks by lack of progress, not by count alone (25d).
- **Project hooks load in a cloud session**, so the stop check can ship in a repository's own settings or in a plugin.
- **A cloud session will not take instructions from another session**, and cannot message a session on the owner's computer. Inspection of a run goes through its transcript, not through messages.
- **Statuses were left as written.** The delivered spec and tutorial stayed `status: draft`. The run's end point in 25d says who sets them and when.
- **GitHub's auto-merge can lag.** Merges followed the approval by 37 seconds, 54 seconds, 63 seconds, and once by three minutes, with nothing wrong.
- The fixtures are tiny, so these runs say nothing about delivery quality on a real feature. That is what 25f tests.
