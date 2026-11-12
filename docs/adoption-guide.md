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

Three steps are yours, because they involve a credential:

1. **Create the App.** In your account's or organisation's settings: Developer settings, GitHub Apps, New GitHub App. Give it a name and any homepage URL, turn the webhook off, set the repository permissions Contents and Pull requests to "Read and write", and choose "Only on this account". Create it, note the App ID, and generate a private key, which downloads as a `.pem` file.
2. **Install it** on the repository: the App's page, Install App, "Only select repositories".
3. **Store the private key** as the repository's Actions secret `RFR_APP_PRIVATE_KEY` (Settings, Secrets and variables, Actions): the whole file, including the BEGIN and END lines. Do not paste it into a chat with an agent.

The rest is one command, from a checkout of rules-for-robots at `.rfr`, in a repository where `/rfr-process:setup` has written `docs/product/process.yml`:

```
node .rfr/checks/process-github-setup.mjs --app-id <the App ID> --checks <your required check names, comma-separated>
```

It prints what it would change and changes nothing. Add `--apply` to copy the workflow to `.github/workflows/rfr-open-pr.yml`, write the CODEOWNERS block for the gated folders, store the App ID as the variable `RFR_APP_ID`, allow auto-merge, and set branch protection on the default branch: your checks required, a code owner's review required, and the rules applied to administrators. Protection the repository already has is kept. Commit the two files through a pull request. `/rfr-process:setup` runs the same command for you.

Then check it once: push a branch that changes only code, and it should become a pull request by the App and merge itself; push one that changes a file under `docs/design/`, and it should wait until you approve it.

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
