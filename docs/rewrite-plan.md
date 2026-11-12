# Rewrite plan: rfr-core and rfr-process

A plan to rebuild the two plugins around one outcome: the project lead approves a design and its user documentation, and agents carry the feature, unsupervised, to an implementation the lead can test against those documents. Written 2026-11-12 after a whole-system review asked for by the maintainer. The maintainer approved it on 2026-11-12, taking the recommended answer for each decision in section 6. Nothing in it is built yet.

The staged process in [docs/specs/project-process.md](specs/project-process.md) (the stages, their artifacts, and the human gates) is kept. Everything else was open to change.

## 1. Goal and acceptance test

The model is Anthropic's [AI-native SDLC playbook](https://claude.com/resources/articles/the-ai-native-sdlc-playbook): each stage commits an artifact the next stage reads, people decide at a few named gates, and agents run between them.

The plan is done when this passes on a real feature in a real adopting project:

1. The lead approves one feature packet (story, design, user documentation).
2. With no further input, agents produce the spec, tests, implementation, regression tests, and tutorial.
3. The lead is told once, when a preview and a recorded tutorial run are ready to test.
4. Interruptions between steps 1 and 3 (permission prompts, questions, turns that end and wait): none.

`checks/attention-report.mjs` already counts those interruptions, and the delegated multi-pull-request eval (19i-4) is the same test on a fixture.

## 2. What the review found

| Finding | Evidence |
|---|---|
| In solo mode the lead's merge is the approval, and the agent pushes as the lead, so the only way to tell the two apart is to parse the lead's chat messages. Narrow parsing refuses real instructions; wide parsing lets a standing "merge when green" approve a design nobody read. | `plugins/core/scripts/task-approval.mjs` (480 lines, copied into three plugins); feedback #205 and #206; project-process "Approval records" |
| The process is enforced on documents and not on code. A pull request that touches no process folder is inferred as `trivial`, so skipping every stage is the cheapest way through CI. | `checks/ci/process-tier.mjs` (`inferTier`); feedback #204; `docs/handoff.md` |
| Nothing tells the agent where a feature stands. No always-on rule mentions the process, and an adopter's `AGENTS.md` gets a merge rule and a link to a guide. | `rules/core/`; `plugins/process/skills/setup/SKILL.md` step 7 |
| Most permission prompts are Claude Code's own. Auto mode blocks "merging a pull request no human has approved" by default, a project cannot set the mode or the classifier's settings, and cloud sessions have no bypass mode. | Claude Code documentation, read 2026-11-12 (permission modes, auto mode configuration, Claude Code on the web) |
| The fixes were not running where the problems were seen. | This machine has rfr-core 5.7.1 and rfr-process 0.16.0 installed at user level; the repository is at 7.2.0 |
| Prompts are the smaller part of the waiting. Most waits are the agent ending its turn. | `evals/results/2026-11-10-attention-baseline/`: 135 of 168, 52 of 105, and 39 of 74 waits were replies after a turn ended |
| Approvals at the pull request rarely change anything; the lead's review happens before it opens. | PLAN 23a: Kettlebird, 91 of 96 unchanged |
| The rate of change is a cause. | 21 releases from 7 to 12 November; three permission models in two days; project-process at AC-64 |
| Only three of 55 rules have eval results, 35 are checked by review alone, and seven still tell the agent to stop or ask. | `evals/ledger.json`; `rules/` |

## 3. Target design

### Where each control lives

| Control | Lives in | Replaces |
|---|---|---|
| Who approved, and what may merge | GitHub: a bot-authored pull request, a required review on gated folders, required checks, auto-merge | The merge guard, task approval, standing instructions, the solo approvals job |
| What is true of the repository | CI: links, staleness, stage order, spec to test trace, tutorial runs | In-session refusals as the main enforcement |
| What an agent can damage | The environment: a cloud container or sandbox, branch protection, credentials with no production reach | Most of the command guard; the default-allow hook |
| What the agent should do next | One state command and one always-on rule | The guide as the only source; learning the order from refusals |

A hook stays only where it is fast, exact, and cannot be done elsewhere: a short never list, and the stop check below.

### Gates and runs

| Human gate | Covers stages | The lead reviews |
|---|---|---|
| Product brief | 1 to 4: concept, discovery, requirements, personas, epics | One pull request, after one batched interview |
| Feature packet | 5 to 7: story, design and UX, user documentation | One pull request with the review packet at the top |
| Validation | 12: tutorial and demo, against a preview | The delivery pull request, by following the tutorial |
| Release | 13 | Release notes and the readiness check |

Between the packet and validation is the delivery run (stages 8 to 12). Agents approve the spec, as project-process already decides. The design stages stay conversational: the interview and the lead's corrections are the work there. The rule of no interruptions applies to the delivery run.

Mapped to the playbook: its Plan stage is the product brief, Design is the feature packet, Build and Test are the delivery run, Deploy is validation and release, and Maintain is feedback triage. Three points where this plan follows it directly: "the agent that wrote the code has no way to approve it", "the agent has no route to push to main", and its eval suite runs "on any change to `CLAUDE.md`, skills or hooks".

Two points where it differs, on purpose:

- The playbook has a person accept the implementation plan. Here the approved user documentation does that job, and the spec is checked against it.
- The playbook's branch protection asks a code owner to approve every pull request. Here the lead approves the packet and the delivery pull request, and a fix or trivial change merges on green checks alone.

### Pull requests

Two for each feature: the packet, and delivery with validation. Delivery is one branch with frequent commits; CI runs on every push, reviewer agents review once at the end, and the lead's approval of that pull request is the validation. A feature too large for one branch is split into slices that each leave the default branch working. Trivial changes and fixes are one pull request each and merge when green.

### Approval and merge

The agent pushes a branch and does not open or merge pull requests. A workflow opens the pull request under a GitHub App's identity and turns on auto-merge. Branch protection requires green checks on every pull request and a code-owner review on `docs/product/`, `docs/design/`, `docs/user/`, and `docs/tutorials/`. Because the pull request's author is the App, the lead can approve it. This is needed because both the local CLI and cloud sessions act as the lead: the last twelve pull requests in `xr-studio-in-a-box` were opened from a cloud session and are authored by the lead's account.

The agent still holds the lead's token, so one exact refusal remains: approving a pull request.

### Permissions and containment

- Cloud sessions run in auto mode; the local CLI runs in auto mode set once in the lead's user settings. rfr cannot ship either setting.
- The never list is refused by a hook, with what to do instead: force-pushes and rewriting shared history, deleting on the remote or outside the project, production deploys, reading secret values, skipping commit hooks, approving a pull request. Pushing to the default branch is refused by branch protection.
- `install-rules` stops writing `ask` rules, which prompt even in auto mode.

### In the session

- **State command.** `process next` prints, for each feature, its stage, what is waiting on the lead, and the work that is open. It runs at session start in a process project.
- **One process rule**, always on: find the feature's stage first, do only what that stage allows, and treat approved user documentation as the definition of done.
- **Run contract**, one rule in place of WA-003 and WA-009: during a delivery run, decide, record in `## Decisions`, and continue.
- **Stop check.** A Stop hook that, during a delivery run, sends the agent back to work unless the feature has reached validation or everything left is recorded in `## Decisions`.
- **Trigger.** The session that opened the packet subscribes to that pull request and starts delivery when it merges.

### Rules

Core always-on rules go from 21 to about ten: keep WA-001, WA-006, WA-012, SEC-001, SEC-003, TEST-001, TEST-003, and WA-002; merge WA-003 with WA-009, TEST-002 with TEST-004, and GIT-001 into WA-004; move CODE-001 to CODE-003, SEC-002, WA-005, and WA-007 into the reviewer agents' checklists. Pack rules stay, with the four that still ask the user (NODE-002, NEXT-004, FAB-004, PG-001) rewritten.

## 4. What is kept, changed, removed, and deferred

| | Components |
|---|---|
| Keep | The stages, templates, and front matter; `process-trace`, `process-relink`, `process-packet`; spec lock and trace; the test-diff classifier, evidence script, and `test-change-reviewer` at the pull request; the tutorial runner and recorder; reviewer agents and `review-pr`; `plan-feature`, `write-adr`, `lookup-api`, `security-audit`; the decision queue; `setup` and `bootstrap`; release readiness; session replay and the eval harness |
| Change | `guard-commands` to the short never list; `guard-stages` kept as an early signal behind the CI rule; the tier check to an explicit claim on the pull request; the approvals job to GitHub's required review; `install-rules` settings; the core rules; `AGENTS.md` templates; the `release` skill |
| Remove | `guard-merge`; `task-approval` and its copies; `allow-default`; `merge-when-green`; solo and team modes as separate paths; supervised and delegated modes; the `"permissions": "ask"` setting |
| Defer until the acceptance test passes | Issue sync and the Project board; `docs-lint`; the mutation job; the gate, rework, and attention reports beyond what the acceptance test needs; owned paths; `notify` gates |

The lists under Change and Remove are to be confirmed against each script's callers and tests in phase 25e, before anything is deleted.

## 5. Phases

One slice per branch and pull request, as now. Phase 25 in `PLAN.md`.

### 25a: Trials

Each trial tests one assumption the design rests on. No plugin code changes in this phase.

Trial 1 (the App-opened pull request and the required review) passed on 2026-11-12: [evals/results/2026-11-12-25a-trial-1/](../evals/results/2026-11-12-25a-trial-1/README.md). Trial 5 (squash merging and the spec lock) passed with a condition the same day: delivery pull requests merge with a merge commit, and a squash is safe only when the branch's last commit sets the spec to `implemented` ([result](../evals/results/2026-11-12-25a-trial-5/README.md)). Trials 2 to 4 passed the same day on two fixture features in cloud sessions ([result](../evals/results/2026-11-12-25a-trials-2-4/README.md)): no prompt in auto mode, delivery started by the packet's merge, and the stop check, on its second version, sent an agent that stopped after the spec back to finish. 25a is complete; the result lists what it found for 25d and 25e.

| Trial | Passes when | If it fails |
|---|---|---|
| A workflow opens a pull request as an App, and the lead's review is required on gated folders | On one repository: a pushed branch becomes a bot-authored pull request, CI runs on it, an ungated one merges itself when green, and a gated one waits for the lead's review | The lead approves through a required GitHub environment review, which is weaker because the agent's token could give it |
| Auto mode in a cloud session runs a whole delivery | A fixture feature goes from an approved packet to an open delivery pull request with no prompt | Delivery runs headless from a workflow, started by the packet's merge |
| The trigger | The session wakes on the packet's merge and starts delivery | One message from the lead starts it |
| The stop check | The agent is sent back to work at least once and finishes; it does not loop | An outer loop re-invokes the session until the end point |
| Squash merging and the spec lock | A feature branch with a recorded `tests-commit` squash-merges with the lock check green before and after | Merge commits for delivery pull requests |

### 25b: GitHub side

Built on 2026-11-12 ([spec](specs/github-gate.md), pull request #218): the workflow template, `checks/process-github-setup.mjs`, the `setup` step, and the guide's section. The gate was set up on `xr-studio-in-a-box` the same day (its pull request #350): the script's first `--apply` on a real project set auto-merge, the variable, and branch protection, and the setup pull request merged itself on its checks. The maintainer could not tell the next steps from the guide, so the pass condition below is not met yet: the guide gained what that setup needed (open pull requests, `mode: team`, the `.rfr` checkout, the check names, the `AGENTS.md` rule, a new session afterwards), and the next adopter is its test.

A setup script and workflow for adopting repositories: the App's pull request workflow, auto-merge, branch protection, and CODEOWNERS from `process.yml`. `setup` runs it and reports what it could not set.

Instructions for adopters (added 2026-11-12, approved by the maintainer). Some steps cannot be done by a script in a session, so `docs/adoption-guide.md` is rewritten to cover them in order, with what each is for:

- creating the GitHub App and installing it on the repository, with the App ID and private key stored as an Actions variable and secret (GitHub's App manifest flow may shorten this; untried);
- choosing auto mode, which a project cannot set: once in the adopter's user settings for the local CLI, or when starting a cloud session;
- the plan limit: required reviews are not available on private repositories on GitHub's free plan (D7), said before the adopter starts.

The maintainer's own setup for the 25a trials is the first draft, and its steps and surprises are recorded as they happen. Passes when the trial repository is set up a second time by following only the guide, and what the guide got wrong is fixed before 8.0.0.

### 25c: Process state and the code rule

Built on 2026-11-12 ([spec](specs/process-state.md), pull request #221): the `SessionStart` hook and `checks/process-next.mjs`, which carry the process rule in place of a separate rule file, and the `change` job. The tier check is left as it is until the verify suite review in 25e. A declaration is a commit trailer, because under the gate the agent does not write the pull request's description. Work with no user-facing behaviour (a repository skeleton, build tooling) had no route but a spec that derives from user documentation, which it does not have. Decided by the maintainer on 2026-11-12: such work gets a design of its own that says `no-user-docs` with a reason, which the maintainer approves with the design, and its spec derives from that design (pull request #222).

`process next`; the always-on process rule; a CI rule that a pull request changing source cites an approved spec, or claims `fix` or `trivial` in its description; the tier check reads the claim and stops inferring.

### 25d: The delivery run

The trigger, the run contract, the stop check, the end point (delivery pull request open, tutorial recorded, preview deployed, lead notified once), and feedback #132.

### 25e: Removal and rules

Remove what section 4 lists, with its tests and specs; reduce the command guard; prune and rewrite the rules; rerun the evals for TEST-001 and WA-002, whose wording changed after their last run; replay recorded sessions through the new guards.

The approvals check on gated pull requests (added 2026-11-12, from the first real use of the gate on `xr-studio-in-a-box`, pull request #351). In team mode `process / approvals` fails on a pull request that touches a gated folder until its approver has reviewed it, then reruns and passes. With the gate, GitHub's code-owner requirement already holds that pull request, so the check adds a red mark on every gated pull request that means nothing is wrong; the maintainer noticed it on the first one. In a project with the gate, the check either goes or reports "waiting for review" without failing. Until then the adoption guide says to expect it.

Review of the verify suite (added 2026-11-12, approved by the maintainer). On that date `npm run verify` had 11 steps and 116 test files (about 13,400 lines); 38 files test the process, 16 of them named after a pilot round; 14 touch components this plan removes; and every pull request, documents-only ones included, runs all of it on Linux (about 1 minute) and Windows (6 to 7 minutes).

- **Inventory first.** Each test file and each verify step is classed keep, merge, or remove, with the reason and the spec criteria it cites. The maintainer approves the list before any test changes.
- **Tests of removed components** go with them. A test locked by a spec's `tests-commit` is removed only with that spec retired or the file listed under its `unlocks:`.
- **Pilot-round files** are folded into files named by the behaviour they cover.
- **Domain tests move to the plugin they test.** Each of `rfr-unreal`, `rfr-web`, `rfr-android`, and `rfr-feedback` gets its own `test/` folder, and the inventory names each file's owning plugin. CI runs a plugin's tests when that plugin, or shared code it depends on (the libraries the build copies from `checks/lib/`), changes; `npm run verify` still runs everything locally.
- **Domain logic leaves rfr-core and the shared workflow**, so an adopting project runs only the checks of the plugins it enables: the production-deploy and database refusals in `guard-commands.mjs` (Vercel, Drizzle, Prisma) move to `rfr-web`, and the `mutation` and `tutorials` jobs in `rfr-process.yml` run only for the profiles that use them.
- **Documents-only changes** get a shorter path, and the Windows job's time is investigated.
- Existing test files are changed with the Edit tool, and the test-change review judges the result, as for any other change.

### 25f: Acceptance and release

Run 19i-4, then the acceptance test in section 1 on one feature in XR Studio In A Box. Release as 8.0.0 with a migration note.

### After 25f: verification strength inside the delivery run

Added 2026-11-12, after a look at Robert C. Martin's agent tooling ([github.com/unclebob](https://github.com/unclebob)). It does not cover the planning stages or the gates, which are this plan's subject; it bears on the quality of what a delivery run produces, where this plan leans on reviewer agents at the end of one long branch. Only READMEs and skill files were read, and none of the tools has been run here.

- Trial `mutator` (mutation testing of the changed functions) and `crapper` (complexity against coverage) on one delivery branch, beside the reviewer agents and the sabotage step.
- Trial mutating a runnable tutorial's expected values (the text a step types or expects to see) and confirming the run fails, so a tutorial that does not test the product is caught.
- Keep whichever finds something the reviewers missed, at a cost the keep rule (R38) accepts. The stop check in 25d already takes the related point that passing checks do not show a feature is complete: it asks whether the approved user documentation is met.

### Freeze

From the start of 25a until 25f passes, guard and permission behaviour changes only through this plan. Feedback is triaged and queued. A rule, hook, or skill change ships to adopters only after the session replay and the delegated eval pass, which is the playbook's practice of running the eval suite on any change to agent configuration.

## 6. Decisions

Approved by the maintainer on 2026-11-12: "I approve each of the 8 decision recommendations."

| # | Decision | Decided |
|---|---|---|
| D1 | The human gates | The four in section 3; specs stay agent-approved |
| D2 | Pull requests per feature | Two; split delivery only for large features |
| D3 | Where delivery runs | Cloud sessions in auto mode; the local CLI in auto mode from user settings |
| D4 | Existing adopters | A clean break at 8.0.0; XR Studio In A Box migrated by hand, the others on request |
| D5 | Solo and team modes | One path: a bot-authored pull request makes solo work like team mode |
| D6 | Eval budget | 19i-4 as planned, about $15 to $25, within the improvement plan's $150 eval cap |
| D7 | Private repositories on GitHub Free | Out of scope: required reviews are not available there, and the adopters seen so far are public or on a paid plan |
| D8 | Fixes and trivial changes | Merge on green checks with no review by the lead; the alternative is the playbook's code-owner approval on every pull request |

## 7. Risks

- **The App workflow is untried.** It follows from how GitHub treats a pull request's author; trial 1 is first for that reason.
- **Auto mode is not under rfr's control.** Its classifier can change between Claude Code versions. The replay and the acceptance test are rerun on a new version.
- **One long delivery branch drifts** when several features are in flight, and a failed run is found at the end. CI on every push and the reviewer agents stand in for the intermediate merges.
- **Removing in-session guards trusts the environment.** Native Windows has no sandbox, as `practices/security-for-agentic-projects.md` already records.
- **Fixes and trivial changes merge with no person's review**, which the playbook does not do. The explicit claim on the pull request, the reviewer agents, and the test-change review are what stand behind them; The maintainer chose this in D8.

## 8. Not in this plan

The web, Unreal, Android, and feedback plugins, beyond the four pack rules named above; new profiles; the remaining Phase 8 evals; anything in `PLAN.md` section 14 that this plan does not name stays as it is, behind the freeze.
