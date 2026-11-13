# Handoff

The state of rules-for-robots for a session that has none of the conversation behind it. Read this first, then [rewrite-plan.md](rewrite-plan.md) and `PLAN.md` section 14. Updated 2026-11-13, after slices (c) and (d) of phase 25e merged (#239, #240, #242) and during slice (e).

## What the maintainer wants, in their words

- "I don't EVER want to be prompted to approve a command. The text of the command is generally meaningless to me."
- "If there are things Claude shouldn't ever do, we should make it so Claude doesn't do them, not prompt me to allow Claude to do them. ... I don't ever want to be the bottleneck."
- "Every stage is required unless deliberately waived ahead of time. The development process is what matters most!"
- "Now that I'm approving the things I care about, I'm good taking the time to actually review."
- "Finish it" or "finish slice x" should review which stages have been completed and pick it up from there.
- Approve decisions, never commands. The maintainer approves the product brief, each feature packet (story, design, user documentation), each delivery, and each validation, as reviews in GitHub. Everything between is the agent's to carry out without asking.

## The model, since 2026-11-12

The rewrite plan replaced the approach of 6.x and 7.0 to 7.2, which tried to tell the maintainer's approval from their chat messages. Read [rewrite-plan.md](rewrite-plan.md) for the findings and the design. In short:

- **Approval and merging are GitHub's.** An agent pushes a branch. A workflow opens the pull request as the `rfr-agent` GitHub App (ID 5731039) and turns on auto-merge. Branch protection requires the checks, and the approver's review on the gated folders; a new push dismisses an earlier approval. No agent opens, approves, or merges a pull request. Spec: `docs/specs/github-gate.md`.
- **Every session is told where things stand.** A `SessionStart` hook gives the process rule and each feature's stage, with approval read from the default branch. Spec: `docs/specs/process-state.md`.
- **Code needs an approved spec.** The `process / change` check fails a source change with none, unless a commit ends with `Change: fix` or `Change: trivial` and the change fits. A feature's pull request cannot merge before its tutorial exists. Work with nothing a user sees derives its spec from a design marked `no-user-docs: <reason>`.
- **Delivery is a run.** `/rfr-process:deliver` (also "finish it") finds how far a feature has got and writes what it lacks on one branch. A `Stop` hook keeps the run going only while `delivery.mjs start` has marked one on the current branch. What cannot be done is set aside in `docs/decisions/<spec name>.md`. Spec: `docs/specs/delivery-run.md`.
- **Accepting a delivery and validating it are two approvals.** A delivery leaves its tutorial a draft. Approving the delivery puts it on the default branch; approving the tutorial, after following it, is the validation.

## Where things stand

| Release | What it did |
|---|---|
| on `main`, unreleased | rfr-process 1.5.1 to 2.1.0, rfr-web 3.0.0, rfr-unreal 3.1.0, rfr-android 0.4.0, and rfr-core changes that take its version at the next release. Delivery: a feature's pull request needs its tutorial, finishing a feature from where it stands, accepting and validating as two approvals, answering a review. 25e so far: agents cannot approve a pull request (#233); approval in chat, the merge guard, default allow, `merge-when-green`, and `"permissions": "ask"` removed (#235); the tier check and the approvals job's review check retired (#236); the command guard refuses the never list by every route (#237). |
| 7.3.0 | The first release of the rewrite plan: the GitHub gate, process state and the change check, the route for enabling work, the delivery run; rfr-core lets a session subscribe to a pull request. Tagged and published on the maintainer's word. |
| 7.0.0 to 7.2.0 | Unattended runs, stage order on documents (`guard-stages`), the handoff rule. `guard-stages` and the modes are still in place; 25e changes or removes them. |

Rewrite plan phases: 25a (trials) complete; 25b (gate), 25c (state and change check), and 25d (delivery run) built and in real use; 25e (removal, rules, verify suite review) under way, with slices (a) and (b) of the verify inventory done; 25f (acceptance test, 8.0.0) not started. Guard and permission behaviour is frozen outside the plan until 25f passes; each guard change in 25e is replayed against the maintainer's local transcripts before it merges.

## What is open

- **`xr-studio-in-a-box` is the real adopter, and the gate is live there.** `main` is protected (required: `verify`, `process / process-trace`, `process / tier` (retired in #236; a stub keeps it green until 8.0.0, and the maintainer is to remove it from the required checks), `process / change`; the maintainer's review on gated folders; stale approvals dismissed), `process.yml` is `mode: team`, and its workflow writes pull request descriptions from the branch.
  - Slice 2 was delivered by the first real run and merged; its tutorial is a draft, so it is built and not yet validated. The maintainer has not yet followed the tutorial. Four of the agent's recorded decisions depart from the approved documents or mock-ups (identifier matching, the project page frame, the activity result line, dates without a year).
  - Slice 1 now has its tutorial: pull request #357 there merged on 2026-11-13 after its session merged `main` in to clear a conflict in `docs/decisions/layer1-organisations-projects-people.md`. Its tutorial went in marked approved, from before agents were told to leave tutorials as drafts, so the record says slice 1 is validated; whether the maintainer followed it first is not recorded.
  - Its skeleton spec lives in `docs/engineering/`, outside the process folders, from before the `no-user-docs` route existed.
- **25e, next.** The verify inventory (`docs/verify-inventory.md`, approved with three answers) lists the slices, one per pull request. Done since #237: (c) `install-rules` writes no `ask` rules and the modes are gone (#239, #240); (d) `guard-stages` reads approval from the default branch (#242); (e) the process pilot-round test files and `plugin-split-16b` are folded into files named by behaviour (branch `claude/friendly-galileo-guioqe`). Left: (f) domain tests and logic move into their plugins, with CI running a plugin's tests only when it changes, and the guard test files (e) left behind (`guard-tiers-15b/c/d`, `rm-own-scratch`, `hooks`) are split by behaviour as they move; (g) the rules are pruned and the TEST-001 and WA-002 evals rerun; (h) the decision file named after the branch, and the Windows job's time.
- **How 25e slices have gone:** each pull request gets a code or security review and the test-change review. The test-change review refers changes to existing tests to the maintainer whenever they rest on criteria amended in a draft spec, which in 25e is every time: the maintainer decides those in chat ("merge 237"). This repository has no gate, so pull requests opened here are authored by the maintainer's account and GitHub asks them for no review. The security review of #237 found that a pattern guard always has another route; the guide now lists what it cannot see, which the environment contains.
- **Found in use, to fix in 25e:**
  - Two parallel runs both wrote `docs/decisions/<spec name>.md` for a spec they both touched, and conflicted. Naming the file after the branch would avoid it.
  - The automatic trigger (a packet's merge waking the session) has not been seen on a real project; the first real run was started by a message.
  - How an agent answers a real review has not been observed; only the skill's text is tested.
  - The adoption guide was not clear enough for the maintainer to follow alone. It was extended; the next adopter is its test.
- **25f.** The delegated eval (19i-4, about $15 to $25) and the acceptance test in the plan's section 1, then 8.0.0. The first real run is evidence toward it: `evals/results/2026-11-12-first-delivery-run/`.
- **After 25f:** trial mutation and complexity tools inside the delivery run (in the plan).
- **Feedback** from adopters arrives as issues labelled `feedback`; triage with the `triage-feedback` skill. #132 does not arise with one branch for each feature and can be closed with that note.
- **Housekeeping the maintainer may want:** the throwaway repository `lifelike-and-believable/rfr-trial` can be archived (its pull request #9 is open); one trial session created on the maintainer's desktop by mistake could not be archived from a session.

## Facts the code does not show

- **Identity.** Cloud sessions and the local CLI both act as the maintainer on GitHub, which is why the App opens the pull requests: GitHub does not let an author approve their own. The session still holds the maintainer's token, so it could approve as them; nothing refuses that yet (25e).
- **Claude Code, checked in its documentation on 2026-11-12.** A project's settings cannot set `auto` or `bypassPermissions` mode, or the auto-mode classifier's settings. Cloud sessions have no bypass mode. Auto mode blocks merging a pull request no person approved. An `ask` rule prompts even in auto mode, and `install-rules` still writes some. Native Windows has no sandbox.
- **Plugins.** Fresh cloud sessions install rfr's plugins from `main`, whatever is tagged. An installed copy updates by version, and only after its marketplace copy is refreshed: on the maintainer's machine `/plugin marketplace update rules-for-robots` comes before updating the plugins. That machine ran 5.7.1 for most of 2026-11-12, which is why its sessions kept prompting.
- **Sessions created from a desktop-bridged session** run on that desktop unless a cloud environment is named. A cloud session will not take instructions from another session; inspect a run through its transcript.
- **The maintainer cannot judge command text.** A permission prompt is never acceptable, and neither is a question in chat during a run.
- **Releases.** `node checks/release.mjs prepare --commit <sha>`, check CI on that commit, then tag, push the tag, and `gh release create`. A release needs the maintainer's word in chat.
- **Replaying real sessions** is the way to check that guards do not misfire: `evals/session-replay/replay-commands.mjs`. Run it before releasing guard changes.
- **This repository's CI** takes about seven minutes for every pull request, documents included, because the Windows job runs the whole suite. The verify suite review in 25e covers it.

## Lessons from 2026-11-12

- Put each control where it cannot be argued with: who approved in GitHub, what is true in CI, what can be damaged in the environment. A session should mostly be told the state and the next step.
- Never infer the maintainer's intent from chat. What they authorise is a review, or a line in an approved document.
- Try a design on a throwaway repository before building it. Each of the five trials changed something, and one found a fault in its own first version.
- Run it on the real project early. The first real delivery found two gaps in forty minutes that tests on fixtures had not.
- Run a new command against the real project's data before shipping it. The first version of the process state took seven seconds and listed 231 backlog stories.
- A check that keeps an agent working must know which run it is in. The first stop check took over a session that was only waiting.
- In this repository's own sessions, write multi-line edits with the file tools: long shell heredocs fail on quoting and cost a retry each time.
