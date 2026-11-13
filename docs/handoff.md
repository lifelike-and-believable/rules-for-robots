# Handoff

The state of rules-for-robots for a session that has none of the conversation behind it. Read this first, then [rewrite-plan.md](rewrite-plan.md) and `PLAN.md` section 14. Updated 2026-11-12, at the end of the day the rewrite plan was written and its phases 25a to 25d built.

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
| on `main`, unreleased | rfr-process 1.5.1 to 1.8.0: a feature's pull request needs its tutorial; finishing a feature from where it stands; accepting and validating as two approvals; answering a review, and a new push dismissing an approval. |
| 7.3.0 | The first release of the rewrite plan: the GitHub gate, process state and the change check, the route for enabling work, the delivery run; rfr-core lets a session subscribe to a pull request. Tagged and published on the maintainer's word. |
| 7.0.0 to 7.2.0 | Unattended runs, stage order on documents (`guard-stages`), the handoff rule. Still in place; 25e removes what the gate replaces. |

Rewrite plan phases: 25a (trials) complete; 25b (gate), 25c (state and change check), and 25d (delivery run) built and in real use; 25e (removal, rules, verify suite review) and 25f (acceptance test, 8.0.0) not started. Guard and permission behaviour is frozen outside the plan until 25f passes.

## What is open

- **`xr-studio-in-a-box` is the real adopter, and the gate is live there.** `main` is protected (required: `verify`, `process / process-trace`, `process / tier`, `process / change`; the maintainer's review on gated folders; stale approvals dismissed), `process.yml` is `mode: team`, and its workflow writes pull request descriptions from the branch.
  - Slice 2 was delivered by the first real run and merged; its tutorial is a draft, so it is built and not yet validated. The maintainer has not yet followed the tutorial. Four of the agent's recorded decisions depart from the approved documents or mock-ups (identifier matching, the project page frame, the activity result line, dates without a year).
  - Slice 1 now has its tutorial: pull request #357 there merged on 2026-11-13 after its session merged `main` in to clear a conflict in `docs/decisions/layer1-organisations-projects-people.md`. Its tutorial went in marked approved, from before agents were told to leave tutorials as drafts, so the record says slice 1 is validated; whether the maintainer followed it first is not recorded.
  - Its skeleton spec lives in `docs/engineering/`, outside the process folders, from before the `no-user-docs` route existed.
- **25e, next.** Remove the merge guard, task approval and its copies, the default-allow hook, `merge-when-green`, solo-mode approval, and the `process / approvals` check where the gate is on (it shows red on every gated pull request until approved). Add the one refusal the gate needs: an agent approving a pull request. Move `guard-stages` to read approval from the default branch, as the process state does. Prune and re-evaluate the rules. Review the verify suite, starting with an inventory the maintainer approves, and move domain tests and logic into their plugins. All of this is in the plan.
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
