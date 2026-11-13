---
status: draft
tests-commit: [d01ef49d13a3cb6c975e0a6b7ea41efdf67d4658, 9d491cd524d7ab6e764f9e511a07306edda77970]
unlocks:
  - test/process-github-gate.test.mjs: AC-8 (2026-11-12) adds a setting the gate needs, that a new push dismisses an earlier approval, so the AC-3 fixture of a repository already set up gains that setting; without it the plan is no longer empty, which the AC-8 test now checks; nothing else changes
---

# The GitHub gate

Approval and merging move to GitHub. An agent pushes a branch; a workflow opens the pull request as a GitHub App and turns on auto-merge; branch protection holds a pull request that touches a gated process folder until one of that stage's approvers reviews it, and lets every other pull request merge when its checks pass. This is slice 25b of [the rewrite plan](../rewrite-plan.md), approved by the maintainer on 2026-11-12. The `status` field stays `draft` until every `test:` criterion has a citing test.

## Problem

In solo mode the lead's merge is the approval ([project-process](project-process.md), "Approval records"). A session, local or cloud, pushes and merges as the lead, so the only way to tell the lead's merge from the agent's is to read the lead's chat messages, which misreads real instructions (feedback #205, #206) and lets a standing "merge when green" approve a design nobody read. GitHub does not let a pull request's author approve it, so the lead cannot simply review instead.

The trials of phase 25a showed the way out on a real repository ([trial 1](../../evals/results/2026-11-12-25a-trial-1/README.md), [trials 2 to 4](../../evals/results/2026-11-12-25a-trials-2-4/README.md)): when a workflow opens the pull request as an App, the lead can approve it, an ungated pull request merges itself, and a gated one waits. Setting that up by hand took a workflow file, a CODEOWNERS file, four repository settings, and three steps only a person can do.

## User stories

- As a project lead, I want my approval of a design or user documentation to be a review in GitHub, so that nothing has to guess it from what I typed.
- As a project lead, I want agents' pull requests to merge themselves when the checks pass and nothing in them needs my review, so that I am not asked to merge.
- As someone adopting the process, I want one command that sets up my repository and tells me plainly what I still have to do by hand, so that I do not have to work out GitHub's settings.
- As someone with an existing repository, I want the setup to keep the branch protection I already have, so that adopting the process does not weaken it.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | The plugin ships a workflow template, `templates/workflows/rfr-open-pr.yml`, that runs on a push to `claude/**`, `phase-*/**`, and `feature/**` branches; mints a token for the App from the `RFR_APP_ID` variable and the `RFR_APP_PRIVATE_KEY` secret; opens a pull request for the branch if none is open, titled with the last commit's subject; and turns on auto-merge with a merge commit. Its own token is read-only, and the branch name reaches the script through an environment variable, not inline expression text. | test: the template's triggers, permissions, token step, and script. |
| AC-2 | `gateCodeowners` renders the managed CODEOWNERS block for every stage whose gate is `approve`, with that stage's approvers, in solo mode as well as team mode. The block uses the same markers as the existing script, so one replaces the other. | test: a solo file, a team file with a stage approver, and a stage gated `agent` left out. |
| AC-3 | `planSetup` works out the changes from the repository's current state: allow auto-merge when it is off; branch protection on the default branch with the requested checks added to any already required, code-owner review required, approval of the most recent push not required, and the rules applied to administrators; and the `RFR_APP_ID` variable when an App ID is given and differs. Protection settings it does not name are kept as they are, including a required approval count; with no protection yet the count is 0. A setting already as wanted is not in the plan. | test: a repository with no protection; one with other required checks, an approval count of 1, and push restrictions, all kept; one already set up, with an empty plan. |
| AC-4 | Without `--apply`, the script prints the plan and makes no request that changes anything and writes no file. With `--apply` it writes the workflow and the CODEOWNERS block and sends each change; a change that fails is reported with its name and the status GitHub gave, the others are still attempted, and the exit code is 1. | test: stubbed requests for a dry run, a full apply, and an apply in which one change fails. |
| AC-5 | The script always ends by listing what only a person can do: create the App with Contents and Pull requests set to read and write, install it on the repository, and store its private key as the `RFR_APP_PRIVATE_KEY` secret. It checks whether that secret exists and says so. When GitHub refuses branch protection for the repository's plan, it says that required reviews are not available there instead of reporting a bare failure. | test: the list; a missing and a present secret; a 403 from the protection request. |
| AC-6 | The `setup` skill has a step that runs the script, first without `--apply` to show the plan, and names the three manual steps. The "Development process" section it writes into `AGENTS.md` says that agents push branches and do not open, approve, or merge pull requests where the gate is set up. | test: the skill names the script, `--apply`, the template, the secret, and the agent rule. |
| AC-7 | `docs/adoption-guide.md` has a section on the gate: what it is for, the manual steps in order, the command, choosing auto mode (which a project cannot set), and the plan limit. | review: the guide. |
| AC-8 | Branch protection is set so that a new push dismisses an earlier approval. What an agent pushes after the approver has reviewed, in answer to a review or otherwise, cannot merge until they approve again. A repository set up before this, or with the setting off, gets it in the plan. (Added 2026-11-12: without it an approval stood across later pushes, so commits the approver never saw could merge; trial 1 had listed this as not tested.) | test: no protection, the setting off, the setting absent, and the setting on. |
| AC-9 | rfr-core refuses an agent approving a pull request, whatever the session was told: `gh pr review` with `--approve` or `-a`, a request to a pull request's reviews endpoint or the GraphQL review mutations with the `APPROVE` event, a review sent from a file with `gh api --input`, and a GitHub MCP review tool called with `event: APPROVE`. The refusal comes before task approval, so no instruction allows it, and its reason gives the next step: tell the approver once, with the review link and the line they run themselves. A review that comments or requests changes, and the approve line quoted as text, are not refused. (Added 2026-11-12, rewrite plan 25e: the session holds the approver's token, so it could otherwise give the approval in their name.) | test: each form refused, the forms allowed, the order against task approval, and the hook for MCP tools. |

## Scope

- In: `plugins/process/templates/workflows/rfr-open-pr.yml`; `checks/process-github-setup.mjs` and its tests; the `setup` skill; `docs/adoption-guide.md`; the plugin's README and version.
- In (25e): the refusal in AC-9, in rfr-core's `guard-commands` and a hook for the GitHub MCP tools.
- Out: removing the merge guard, task approval, and the solo approvals job (25e); the stop check and the trigger (25d); the rule that a source change cites an approved spec (25c); private repositories on GitHub's free plan (rewrite plan D7).

## APIs and assumptions

- Confirmed in trial 1 on `lifelike-and-believable/rfr-trial`: an App with Contents and Pull requests read and write can open a pull request and turn on auto-merge; CI runs on a pull request opened with the App's token; with zero required approvals and code-owner review required, a pull request touching no owned path merges with no review and one touching an owned path waits for the owner.
- GitHub REST endpoints used: `GET` and `PATCH /repos/{repo}`; `GET` and `PUT /repos/{repo}/branches/{branch}/protection`; `GET`, `POST`, and `PATCH /repos/{repo}/actions/variables`; `GET /repos/{repo}/actions/secrets/{name}`.
- Assumption: `PUT` on branch protection replaces the whole object, so the script reads the current protection and sends it back with its changes. The test for AC-3 fixes the shape; the first run on a repository with existing protection confirms it.
- The session holds the lead's token, so it could approve an App-authored pull request as the lead. AC-9 refuses that one action. A program the agent writes and runs could still call the API in a way the guard does not read; branch protection cannot tell that review from the lead's.

## Delivery

- Plan item: `PLAN.md`, Phase 25, slice 25b.
- Pull requests: #218, #230 (AC-8).
- Not done in this slice: the guide's pass condition (a second repository set up from the guide alone), which needs the maintainer to install the App on it.
