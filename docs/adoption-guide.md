# Adoption guide

How to use rules-for-robots as a solo developer, a team, or an organization. Requirements: Claude Code 2.1.288 or later, and Node on the PATH for the plugins' hooks.

## Solo developer, new project

1. Create the project with its usual tool (`create-next-app`, `create astro`, or the Unreal plugin wizard). If Claude Code does the scaffolding, start the session in the new project's folder, or add it with `/add-dir <path>` first: Claude Code asks about every file written outside the session's folders, even in accept-edits mode ([asking once for a batch](../practices/security-for-agentic-projects.md#asking-once-for-a-batch)).
2. Copy the matching folder from [`template-repos/`](../template-repos/) into it: `web-app`, `static-site`, `unreal-plugin`, or `general` (for anything else: a command-line tool, a service, or a desktop, mobile, or TV app). Each folder's README lists the remaining steps (scripts, secrets, labels, runner).
3. Fill in `AGENTS.md` with the verify command and the decisions an agent cannot infer.
4. Open Claude Code in the project and accept the plugins when prompted: `rfr-core` and the profile's domain plugin (`rfr-web` for `web-app` and `static-site`, `rfr-unreal` for `unreal-plugin`, none for `general`), which the template's `.claude/settings.json` enables. The same file allows read-only and local git commands and the verify scripts without a prompt; adjust the script names there if your `package.json` uses others.

## Solo developer, existing project

1. In Claude Code: `/plugin marketplace add lifelike-and-believable/rules-for-robots`, then `/plugin install rfr-core@rules-for-robots` and the domain plugin for your project: `/plugin install rfr-web@rules-for-robots` for a website or web app, or `/plugin install rfr-unreal@rules-for-robots` for an Unreal plugin.
2. Run `/rfr-core:install-rules <profile>` and approve the writes to `.claude/rules/`. It also offers the default permission rules for `.claude/settings.json`.
3. Add an `AGENTS.md` with a verify command (and a `CLAUDE.md` containing `@AGENTS.md`) if the project has neither.
4. Copy the CI workflows you want from the matching template repo. At minimum, call the reusable guards:

```yaml
jobs:
  guards:
    uses: lifelike-and-believable/rules-for-robots/.github/workflows/rfr-guards.yml@main
```

   Trigger the workflow on label changes as well. The test change guard passes when the pull request carries the `tests-reviewed` label, and it reads the labels from the event that started the run. With the default pull request events, a label added after the run starts no new run, and re-running the failed job reuses the original event, so the check stays red beside the label. Removing the label has the opposite problem: the check stays green after the approval is withdrawn. Listing `labeled` and `unlabeled` fixes both:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]
  push:
    branches: [main]
```

5. Commit `.claude/` so the rules and plugin settings apply to everyone working in the repository.

### Owned paths

If your repository takes regular integrations from an upstream branch, edits to upstream-owned files are overwritten at the next integration. List the paths your branch owns in `AGENTS.md`:

```markdown
## Owned paths

- `Plugins/MyPlugin/**`
- `Source/MyGameTests/**`
- `AGENTS.md`
- `.github/`
```

Each bullet is a backticked glob relative to the repository root; a trailing `/` covers a whole folder. Once the section exists, the `rfr-core` hook `guard-owned-paths` asks before an agent edits any other file in the project. To also fail pull requests that touch other paths, turn on the job in the reusable guards:

```yaml
jobs:
  guards:
    uses: lifelike-and-believable/rules-for-robots/.github/workflows/rfr-guards.yml@main
    with:
      owned-paths: true
```

The job is off by default. When it is on and `AGENTS.md` has no `## Owned paths` section, it passes and prints a note. The list is read from the pull request's own `AGENTS.md`, so a change to the list shows up in review. See [working with agents](../practices/working-with-agents.md#scope) for the guidance behind it.

### Spec checks (opt-in)

If the repository keeps specs in `docs/specs/` (the `plan-feature` template produces them), turn on the trace and lock checks:

```yaml
    with:
      spec-checks: true
```

A criterion whose "Verified by" cell starts with `test:` must be cited by a test as `<spec file name>#AC-<n>`. A spec can record `tests-commit: <sha>`; tests that cite it are then fixed at that commit unless the spec lists an `unlocks:` entry with a reason, until the spec's status is `implemented`. The job needs the full history (it checks out with `fetch-depth: 0`), and a repository that squash-merges should set `status: implemented` in the last pull request, because squashing removes the recorded commit. Drafts only warn. See [the spec](specs/spec-test-traceability.md).

### CI status comment

To let agents (and you) merge on green without polling, end the workflow that gates merging with the reusable status job. Each run posts a new comment on the pull request with each job's result and the head commit's full SHA, headed "<workflow> completed successfully!" when every job passed. A new comment rather than an edited one, because that is what wakes an agent waiting on the pull request (the Claude desktop app's pull request monitor relays new comments):

```yaml
  status:
    needs: [verify]            # every other job in this workflow
    if: always()
    permissions:
      contents: read
      pull-requests: write
    uses: lifelike-and-believable/rules-for-robots/.github/workflows/rfr-ci-status.yml@main
    with:
      results: ${{ toJSON(needs) }}
```

Skipped jobs count as passed, and the comment lists them. If a job skips on draft pull requests (a long self-hosted build, for example), gate the status job so a draft gets no green comment, and make sure the workflow runs on `ready_for_review`:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
# ...
  status:
    if: always() && !github.event.pull_request.draft
```

The template repos already include it. It never fails the workflow, and pull requests from forks get no comment because their token is read-only. Agents still confirm the checks on the current head commit before merging; `/rfr-core:merge-when-green <pr>` does the whole wait, check, merge, and continue sequence.

## The GitHub gate (projects that use rfr-process)

The gate moves approval and merging to GitHub, so that no agent merges and nothing has to guess your approval from what you typed. An agent pushes a branch. A workflow opens the pull request as a GitHub App and turns on auto-merge. A pull request that touches a gated folder (`docs/product/`, `docs/design/`, `docs/user/`, `docs/tutorials/`) waits for its approver's review in GitHub; any other merges itself when the checks pass. The App matters because a session, local or cloud, pushes with your credentials, and GitHub does not let you approve a pull request you opened. Spec: [github-gate](specs/github-gate.md); the trial it comes from: [evals/results/2026-11-12-25a-trial-1](../evals/results/2026-11-12-25a-trial-1/README.md).

Before you start: required reviews are not available for a private repository on GitHub's free plan. There the gate cannot hold a pull request, and the script says so.

Do these in order. Steps 1 to 4 are yours; an agent can do steps 5 to 8 for you, and `/rfr-process:setup` does them in a project that is setting up the process for the first time.

1. **Merge or close the pull requests you have open.** A pull request opened under your own account that touches a gated folder cannot be approved by you once the gate is on. Merge it the way you do today, or close it and let the workflow reopen it for its branch.

Three steps involve a credential, so only you can do them:

2. **Create the App** (once for your account or organisation; skip this if you already have one). In your account's or organisation's settings: Developer settings, GitHub Apps, New GitHub App. Give it a name and any homepage URL, turn the webhook off, set the repository permissions Contents and Pull requests to "Read and write", and choose "Only on this account". Create it, note the App ID, and generate a private key, which downloads as a `.pem` file.
3. **Install it** on the repository: the App's page, Install App, "Only select repositories". For a second repository, open the existing installation's settings and add the repository to its list.
4. **Store the private key** as the repository's Actions secret `RFR_APP_PRIVATE_KEY` (Settings, Secrets and variables, Actions): the whole file, including the BEGIN and END lines. Do not paste it into a chat with an agent.

The rest an agent can do, in a repository where `/rfr-process:setup` has written `docs/product/process.yml`:

5. **Get the script.** Clone rules-for-robots into `.rfr` at the repository's root (`git clone https://github.com/lifelike-and-believable/rules-for-robots .rfr`; keep `.rfr` out of your commits), or run the script from any other checkout and pass your repository's folder as its first argument.
6. **Set `mode: team` in `docs/product/process.yml`**, even when you work alone. Team mode is what the gate is: approval is the approver's review, which CODEOWNERS and branch protection require, not who merged.
7. **Replace the merge rule in `AGENTS.md`**, if the project was set up before the gate: agents push their branch and do not open, approve, or merge pull requests; the workflow opens the pull request, and GitHub merges it when the checks pass and, for a gated folder, the approver has reviewed it.
8. **Run the setup script.** For `--checks`, give the names of the checks every pull request must pass, exactly as GitHub shows them on a pull request: the project's own verify check, and `process / process-trace` and `process / change` from the process workflow. (`process / tier` was retired in rewrite plan 25e; a repository that requires it should remove it.)

```
node .rfr/checks/process-github-setup.mjs --app-id <the App ID> --checks <your required check names, comma-separated>
```

It prints what it would change and changes nothing. Add `--apply` to copy the workflow to `.github/workflows/rfr-open-pr.yml`, write the CODEOWNERS block for the gated folders, store the App ID as the variable `RFR_APP_ID`, allow auto-merge, and set branch protection on the default branch: your checks required, a code owner's review required, an earlier approval dismissed by a new push, and the rules applied to administrators. Protection the repository already has is kept. Open one pull request with the two files it wrote and the changes from steps 6 and 7. The workflow is not on the default branch yet, so this one pull request is opened by hand; it touches no gated folder, so it merges when the checks pass.

Start a new session after it merges: a session that began earlier still has the old merge rule in its context.


Then check it once: push a branch that changes only code, and it should become a pull request by the App and merge itself; push one that changes a file under `docs/design/`, and it should wait until you approve it.

**What the process tells an agent, and what it checks.** At the start of every session rfr-process gives the agent the state of the project: which features are waiting for your approval, which work is open, and the process rule. Approval is read from the default branch, so an artifact the agent marked `approved` in its own branch does not count until you have approved its pull request. `node .rfr/checks/process-next.mjs` prints the same text.

The `process / change` check fails a pull request that changes source code with no approved spec behind it. A feature needs nothing extra: its spec, approved and deriving from approved user documentation, is in the branch, or its tests cite it. A bug fix or a change with no effect on behaviour says so in a commit message, on a line of its own at the end:

```
Fix the off-by-one in paging

Change: fix
```

A fix must change or add a test and add no source file. `Change: trivial` (a dependency bump, a rename) must add no source file and touch no `public-api` path. Anything larger is a feature.

Work with nothing a user sees, such as a repository skeleton or build tooling, is neither: it adds files, and it has no user documentation to derive a spec from. Give it a design of its own in `docs/design/` whose front matter says `no-user-docs:` with the reason. Its spec may then derive from that design. You approve that line when you approve the design, so look for it in a design pull request: it is the one way a spec skips user documentation, and the process check refuses it on a design that user documentation derives from. The declaration is in the commit and not the pull request's description, because under the gate the workflow writes the description.

**Delivery.** Once you have approved a feature's user documentation, an agent delivers it with `/rfr-process:deliver`: the spec, failing tests, the implementation, and the tutorial, on one branch. While that run is under way, a check at the end of each turn sends the agent back to work until everything is committed and pushed, so it does not stop to ask you. What it could not do, and any question the approved documents left open, it writes in `docs/decisions/<spec name>.md`, which appears in the pull request's description. When it finishes it tells you once, with the link to review and the line you can run yourself to approve from the Claude Code prompt (`! gh pr review <branch> --approve`). Approving that pull request accepts the work onto the default branch; it does not say you have validated it, and the pull request tells you so. The tutorial stays a draft, and every session is told the feature is built and not yet validated. To validate, follow the tutorial against the delivery. When it holds, ask an agent to mark it approved: that comes to you as a pull request of its own, and approving it is your validation. If a step does not go as written, say which.

"Finish slice 2" or "finish it" works the same way: the agent first finds how far the feature has got, and picks it up from there. A feature that was built before it had a tutorial is asked only for the tutorial; one that is still waiting for its design or user documentation gets that one stage written, and then waits for you.

The pull request's description is written by the workflow from the branch: a design that lets a spec skip user documentation is named first, then the review packet, then the decisions. Re-run `node .rfr/checks/process-github-setup.mjs --apply` after updating rules-for-robots to get the current workflow.

**Reviewing in GitHub.** You can comment on a pull request or request changes there, and a session that is still running answers: it subscribes to the pull request when it pushes, fixes what you raised on the same branch, and replies on the pull request saying what changed. A new push cancels your earlier approval, so you look again before it merges. If the session has ended, ask a new one to finish the feature; it reads the open review first. The agent acts only on reviews from the approvers in `process.yml`; a comment from anyone else is information to it, which matters on a public repository.

**Choosing the mode.** A project cannot set Claude Code's permission mode, so this part is yours too. For a session on your machine, set auto mode once in your user settings; for a cloud session, choose Auto when you start it. Agents then run without permission prompts, and the gate above is what holds work for your review.

## Team

- Commit `.claude/settings.json` with `extraKnownMarketplaces` and `enabledPlugins` (the template repos already do), so every collaborator gets the same plugin.
- Pin the reusable workflows and the plugin to a tag instead of `main` once releases exist.
- Add team rules as new files in `.claude/rules/` with your own ID prefix, and remove or waive rules you do not want. See [layering and overrides](layering-and-overrides.md).
- Use CODEOWNERS on `.claude/` and `AGENTS.md` so instruction changes get review.

## Organization

- Publish an organization plugin (its own marketplace) for organization-specific skills, agents, and hooks.
- Use managed settings to register marketplaces and enable plugins for everyone (`extraKnownMarketplaces`, `enabledPlugins`), and `strictKnownMarketplaces` to restrict sources.
- Use `strictPluginOnlyCustomization` in managed settings when hooks, skills, and agents must come only from approved plugins.
- Distribute organization rules through a template repo or an installer skill, since plugins cannot ship rules.
