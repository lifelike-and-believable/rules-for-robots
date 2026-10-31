---
status: draft
tests-commit: [1f67328ed21ed9f55811bcebd3ae545b9c8987ed]
---

# Project development process (`rfr-process` plugin)

A staged, iterative development process for products built with agents: a design phase owned by the stage approvers, then a delivery phase that agents run with review gates. Features move through the stages independently and any stage can be revisited. When an artifact changes, the artifacts derived from it must be dealt with in the same pull request.

Approved by the project lead on 2026-10-31, after an adversarial review whose blocker and major findings are addressed below. The `status` field stays `draft` until every `test:` criterion has a citing test (the end of 11d), because `spec-trace` treats every uncited criterion of an approved spec as an error, and most criteria belong to later slices. The lock does not wait for that: `spec-lock` checks a draft spec's `tests-commit` the same way, so each slice's tests are fixed from the commit that adds them.

## Problem

The rules in `rfr-core` steer how an agent writes and checks code, but not how a feature gets from an idea to something its users can work with. `plan-feature` writes one spec per feature, and Phase 10 ties that spec's criteria to tests. Nothing covers who the users are, what they expect, or whether the finished feature matches that expectation.

The project lead's experience with artist-facing tools is that misalignment between a feature description and what users expect shows up fastest when users read the user manual, and is confirmed or ruled out when they follow tutorials and demos before production use. On large teams, a process built around those two checkpoints let people work quickly with few missteps and little rework. This spec turns that process into templates, checks, CI jobs, a practice guide, and the skills and agents that evals justify.

## Process model

### Two levels

- **Product level** (once per product or major area, revisited as needed): Concept, Requirements, Personas, Epics.
- **Feature level** (per epic or story, many in flight at once): User Stories, Design and UX, User Documentation, Technical Specification, Unit Tests, Implementation, Automated Regression Tests, Demos and Tutorials, Release and Feedback.

### Stages

"Approver" means the approver configured for that stage in `process.yml` (see "Approvers per stage"). In a solo project that is the project lead for every stage.

| # | Stage | Artifact and folder | Phase | Gate |
|---|---|---|---|---|
| 1 | High-level concept | `docs/product/concept.md`: problem, audience, vision, non-goals | Design | Approver |
| 2 | Requirements | `docs/product/requirements/<area>.md`: requirements with IDs (`REQ-<area>-1`), constraints, success measures | Design | Approver |
| 3 | User personas | `docs/product/personas/<name>.md`: goals, skills, tools, context of use, frustrations | Design | Approver, before any story that names the persona is written |
| 4 | Epics | `docs/product/epics/<epic>.md`, linked to requirements and personas | Design | Approver |
| 5 | User stories | `docs/product/stories/<epic>/<story>.md`, each against an approved persona, with acceptance criteria | Design | Approver |
| 6 | Design and UX | `docs/design/<feature>.md`: interaction flows, layouts or editor UI, states and errors | Design | Approver |
| 7 | User documentation | `docs/user/`: the user manual for the feature, written as if the feature exists | Design | Approver (the main alignment check) |
| 8 | Technical specification | `docs/specs/<feature>.md`: the Phase 10 spec format plus `derived-from` links to stories and docs | Delivery | Agents review and approve; the lead is informed in the pull request summary (see "Why agents may approve specs") |
| 9 | Unit tests | Tests written from the spec before implementation (Phase 10 lock and trace) | Delivery | CI |
| 10 | Implementation | Code that makes the locked tests pass | Delivery | CI |
| 11 | Automated regression tests | Acceptance and end-to-end tests drawn from stories and docs, promoted into the regression suite | Delivery | CI |
| 12 | Demos and tutorials | `docs/tutorials/`: tutorials that follow the user documentation step by step, and demo content | Validation | Approver (the main expectation check) |
| 13 | Release and feedback | Release notes drawn from the user documentation; feedback issues | Validation | Approver for the release; the affected stage's approver for each piece of feedback |

Stages 9 to 11 produce code and tests, not process artifacts: they carry no status and no links of their own (see "Code and tests"). Stages 8 to 11 can overlap. Acceptance tests can be drafted from stories and docs as soon as stage 7 is approved; stage 11 is where they become part of the regression suite.

Each gated stage has its own folder or file pattern, so a path maps to exactly one stage. This is what lets `process.yml` and CODEOWNERS give each stage its own approver.

### Why agents may approve specs

The project lead decided that agents can approve stage 8 specs and proceed. Phase 10's premise is that tests come from a spec the implementing agent did not write to suit itself. That premise still holds here because the spec is not free-standing: every `test:` criterion has to cite the approved story or documentation section it comes from (`derived-from`), the process check fails if it cites nothing approved, and an independent reviewer agent checks the spec against those sources. The approver-approved documents are the external authority; the spec translates them. A project that wants a human gate on specs adds a `specs` entry to `process.yml`.

### Review types

- **Self-check**: the author runs the stage checklist and records the result in the pull request.
- **Independent agent review**: a reviewer agent gets the artifact, its upstream artifacts, and the checklist, but not the author's reasoning (R19).
- **Persona walkthrough** (experimental): an agent takes on one persona at a time, reads the user documentation or follows a tutorial in that persona's terms, and reports where the persona would be confused, blocked, or would expect something different. It covers only the personas the feature's stories name. Its findings go to the approver before their review.
- **Approver gate**: the approver approves, asks for changes, or sends the work back to an earlier stage (see "Approval records" for how this is enforced).
- **CI gate**: tests, traces, locks, the process check, and the approvals job.

| Stage | Self-check | Agent review | Persona walkthrough | Approver gate | CI |
|---|---|---|---|---|---|
| Concept, requirements | yes | `software-architect` (optional) | no | yes | process check, approvals |
| Personas | yes | `ux-reviewer` (optional) | no | yes | process check, approvals |
| Epics, stories | yes | `tech-lead`, `ux-reviewer` (optional) | no | yes | process check, approvals |
| Design and UX | yes | `ux-reviewer`, `accessibility-reviewer` | optional | yes | process check, approvals |
| User documentation | yes | `code-reviewer` for accuracy against stories | optional | yes | process check, approvals |
| Technical specification | yes | `software-architect`, `security-reviewer` | no | if configured | process check, `spec-trace` |
| Unit tests, implementation | yes | `code-reviewer`, sabotage step | no | no | tests, `spec-lock`, `spec-trace` |
| Regression tests | yes | `code-reviewer` | no | no | tests |
| Demos and tutorials | yes | `ux-reviewer` (optional) | optional | yes | runnable tutorials, approvals |
| Release and feedback | yes | none | no | yes | release readiness |

"Process check" is `process-trace` (links, staleness, persona rules). "Approvals" is the approvals job. Reviewers marked optional are experimental agents whose eval round has not run (PLAN Phase 8); they advise and never gate until an eval round keeps them.

### Size tiers

Not every change goes through every stage. The tier is recorded as a pull request label (`tier:trivial`, `tier:fix`, `tier:story`, `tier:epic`). The agent proposes it with a reason in the pull request description; the approver can change the label.

| Tier | Example | Stages | CI rule |
|---|---|---|---|
| Trivial | Typo, dependency bump, internal refactor with no behaviour change | Implementation, regression tests | Fails if the pull request changes any process artifact folder or a path listed under `public-api` in `process.yml` |
| Fix | A bug: behaviour that differs from approved stories or docs, or, where none exist yet, behaviour the approver confirms is a bug in the issue | A test reproducing the bug, implementation, regression | Fails if the pull request changes `docs/product/`, `docs/design/`, or `docs/user/` |
| Story | A new story inside an approved epic | Stories to demos; the design stage may be a short addendum to the epic's design | Normal rules |
| Epic | A new area of capability | All feature-level stages, and a review of whether requirements or personas change | Normal rules |

A pull request with no tier label fails the tier check. A change that turns out to alter documented behaviour must move up to the Story tier, which the CI rule enforces for documentation paths.

## Artifacts, links, and staleness

### Where records live

- **In the repository**, the source of truth for all text and status: every process artifact in the folders above. Each is versioned with the code, reviewed in pull requests, and checked offline.
- **In GitHub Issues and Projects**, a mirror for visibility and discussion: one issue per persona, one per epic, sub-issues per story, with a `stage:<name>` label and a Project board column per stage. Issues are written only by a workflow that runs after merge to the default branch (see "Issue sync"). Editing an issue by hand does not change the file, and the next sync overwrites the label.

### Front matter

Every process artifact (stages 1 to 8, 12) has:

- `id`: stable, unique, independent of the file path, so renames do not break links (for example `persona-animator`, `story-retarget-batch`).
- `status`: `draft`, `approved`, or, for stage 8 specs only, `implemented` (the Phase 10 meaning: the lock is released). Staleness is computed, never stored.
- `derived-from`: a list of links. Each link names an upstream `id`, optionally a section within it (`requirements-animation#REQ-animation-3`, `persona-animator#goals`), and the hash of that section recorded when this artifact was last approved.
- `withdrawn` (optional): a reason and an issue number, required when an artifact that was approved is set back to `draft`.

Sections are addressed by a requirement or criterion ID, or by a heading's slug. A link without a section covers the whole body. Hashes cover the body text of the section with whitespace normalized and front matter excluded, so recording new hashes in a downstream file does not change that file's own hash.

### Link rules

The process check (`checks/process-trace.mjs`) fails when:

1. An `id` is duplicated, or a link names an `id` or section that does not exist.
2. Links form a cycle.
3. An approved artifact links to an upstream artifact that is `draft` (including withdrawn).
4. An approved artifact is stale: a linked section's current hash differs from the recorded one.
5. A story names no persona, or names a persona that is not approved.
6. A stage 8 spec has a `test:` criterion that cites no approved story or documentation section through `derived-from`.
7. An artifact was set from `approved` to `draft` without a `withdrawn` entry.

Links are many-to-many: one design can derive from three stories. Staleness is direct only. If a requirement changes, its epics are stale; their stories become stale only if the epics' linked sections change when they are updated. This keeps a wording fix in one requirement from reaching every story.

### Staleness and what a pull request must do

A stale artifact fails CI. A pull request that changes an upstream section also deals with everything that links to that section, in one of three ways:

- **Update** the downstream artifact to match, and record the new hashes.
- **Re-record** the hashes unchanged, when the upstream change does not affect it.
- **Withdraw** it: set it to `draft` with a `withdrawn` reason and issue. Rule 3 then fails for any approved artifact that links to it, so withdrawal cannot be used to make CI green on its own: the gap has to be closed or withdrawn all the way down, in the open. An artifact no longer needed is deleted, and links to it are removed in the same pull request.

A plugin script (`process-relink`) records hashes for named artifacts. Running it is not approval: in a gated stage, any change to `status` or recorded hashes counts as a change the approver must approve (see "Approval records"). A typo upstream therefore costs one script run and one approval of the pull request, not hand-editing.

### Concurrent pull requests

Two pull requests can each pass the process check and still leave the default branch stale once both merge, for example when one changes a requirement and the other adds an epic linked to its old text. To catch this:

- The process check also runs on every push to the default branch. A failure there opens or updates an issue labelled `stale`, assigned to the approvers of the stages involved.
- Projects that can should require branches to be up to date before merging, or use a merge queue, for pull requests that touch process folders. Requirements are split into one file per area so that shared files change less often.

### Code and tests

Code and tests carry no front matter and no links. They inherit staleness through the spec they cite: a stale or withdrawn spec fails the process check, and its tests are tied to it through the Phase 10 citation (`<spec>#AC-n`). The Phase 10 lock and trace checks apply unchanged. Tutorials (stage 12) are markdown artifacts with links; their runnable scripts cite the tutorial `id` in a comment, the same way tests cite criteria.

## Approvers and approval

### Approvers per stage

`docs/product/process.yml` names the approvers for each gated stage as GitHub logins or teams. It must have a `default`; stages without an entry use it.

```yaml
mode: team            # or solo
default: [lead-login]
stages:
  personas: [ux-lead-login]
  design: [ux-lead-login]
  user-docs: [docs-lead-login, lead-login]
  release: [product-owner-login]
  # specs: [lead-login]   # optional: adds a human gate to stage 8
public-api: [Source/MyPlugin/Public/**, src/api/**]
adoption-until: 2026-12-31   # optional; see "Adopting on an existing project"
```

A list means any one of the people listed can approve.

### Approval records

Front matter and hooks cannot prove who approved something: an agent can write any login into a file, and a hook on the Edit tool does not cover shell commands or API calls. The authority is therefore GitHub itself, read by a CI job (`process-approvals`):

- **Team mode.** For each gated stage whose artifacts' `status`, body, or recorded hashes change in the pull request, the job requires an approving pull request review from one of that stage's approvers, read through the GitHub API, on the current head. It fails otherwise. Projects with branch protection make this job required.
- **Solo mode.** GitHub does not let a pull request's author approve it, and agent sessions push under the lead's account. In solo mode, approval is the lead merging the pull request. The job runs on the push to the default branch and checks that the merge was performed by an approver of every gated stage the pull request touched; if not, it fails and opens an issue. Agents must not merge pull requests that touch gated folders: the plugin's hook blocks the merge commands and tools for those pull requests (`gh pr merge`, the GitHub MCP merge tool). This is the same trust the lead already gives agent sessions with their credentials, and the spec says so in the practice guide.
- **Plan limits.** Required reviews and required status checks are not available for private repositories on GitHub Free. There, the job still reports and opens issues, but cannot block a merge. The practice guide states this.

A plugin hook warns when an agent edits `status` in a gated folder, as a convenience. It is not part of the enforcement.

### CODEOWNERS

A plugin script (`process-codeowners`) runs in the adopting repository and writes a managed block in `.github/CODEOWNERS` from `process.yml`, mapping each stage folder to its approvers. A CI step fails if the block differs from what the script would write. In solo mode the block is optional, since CODEOWNERS review cannot be given by the author. This repository's `build/` is not involved: it renders this repository's template repos and never reads an adopting project's files.

## Issue sync

A workflow (`process-sync`) runs after each push to the default branch. It reads the process artifacts and creates or updates their issues: title, `stage:` label, open or closed, and a link to the file. The file always wins. It batches API calls and backs off on GitHub's secondary rate limits, so the first sync on a large project may take several runs; each run resumes where the last one stopped. Because it runs after merge with the workflow's own token, the process check does not need API access, and no session needs the GitHub MCP tools.

## Release and feedback

Release is a stage in this plugin. `rfr-core`'s `release` skill is user-invoked only (`disable-model-invocation`), so `rfr-process` does not call it. Instead:

- **Readiness** (`process-release-check`): every story in the release has an approved tutorial, and nothing it links to, directly or through its ancestors, is stale or `draft`. The check lists anything not ready, and the release approver decides whether to hold the release or move those stories out.
- **Release notes**: a skill drafts them from the user documentation and the stories, in the personas' terms, not from commit messages. The approver edits and approves them.
- **Versioning**: the release approver then runs `/rfr-core:release` for the version, changelog, and tag, as today.
- **Feedback intake**: feedback from real use is filed as an issue with a `feedback` label. A triage skill links it to the artifact it affects, proposes the stage to return to, and assigns the issue to that stage's approver, who decides. It does not change the artifact. A resulting change goes through the normal staleness rules.

## Tailoring by project type

The stages are the same for every project type. What each artifact contains is not. The plugin ships, per profile, persona starters, artifact templates, and a tutorial runner setup. They live in the plugin and are copied by a setup skill, not rendered by this repository's build.

| Profile | Typical personas | User documentation | Runnable tutorials |
|---|---|---|---|
| `unreal-plugin` | Technical artist, animator, designer, gameplay programmer | Editor workflows, Blueprint API, settings, Fab listing material | Automation or functional tests that follow tutorial steps in a sample project (Tier 2 CI, on the engine runner), plus a recorded walkthrough |
| `web-app` | End user, administrator, support | Task guides, help pages, onboarding | Playwright scripts that follow tutorial steps |
| `static-site` | Visitor, content editor | Content model and editing guide | Content checks and a Playwright walkthrough |

## Adopting on an existing project

An existing project has code and no process artifacts. Setting `adoption-until` in `process.yml` makes rules 1 to 7 warnings for artifacts that have no `derived-from` yet, until that date. Artifacts that do have links are checked fully from the start. A bootstrap skill drafts concept, requirements, and personas from the existing README, docs, and issues for the approver to review. After the date, every rule fails as normal.

## How it relates to `rfr-core`

- `rfr-process` does not change `rfr-core`. It ships its own stage 8 template, a superset of `plan-feature`'s (the same front matter and criterion format, plus `derived-from` and the source of each criterion), so `spec-trace` and `spec-lock` work on it unchanged. A test confirms this.
- Phase 10's checks and the sabotage step in `review-pr` cover stages 9 and 10.
- The existing reviewer agents cover most reviews. One new agent, `persona-walkthrough`, is experimental, as R18 requires.
- The plugin declares `rfr-core` in its manifest's `dependencies`. Claude Code's plugin documentation describes dependency resolution, including behaviour it dates to v2.1.242, so the minimum in PLAN decision 14 (2.1.288) supports it. A bare name resolves in the declaring plugin's own marketplace and is installed with it; a dependency that cannot be satisfied leaves the dependent plugin disabled.
- Users can disable plugin hooks. Nothing in this design relies on a hook for enforcement.

## What ships as skills, and what as guidance

The repository's principle is that rules and skills earn their place with evidence (PLAN section 4, R18). Writing a concept or requirements document is mostly something the model already does well. So:

- **Ship as skills and scripts from the start**, because they carry mechanics the model cannot infer: setup (templates, `process.yml`), `process-relink`, `process-codeowners`, the status listing, release readiness and notes, feedback triage, and the bootstrap skill.
- **Ship as a practice guide first** (`practices/project-process.md`): how to write each design-stage artifact, the review checklists, and the persona walkthrough procedure. A stage gets its own skill only when an eval case shows the skill does better than the guide.

## User stories

- As a project lead, I want to approve concept, requirements, personas, epics, stories, design, and user documentation before any technical work starts on a feature, so that misalignment is found while it is cheap to fix.
- As a project lead, I want agents to carry a feature from an approved user manual to demos without asking me at each step, so that I spend my time on design and validation.
- As a project lead, I want to review tutorials and demos before production use, so that I can confirm the feature meets user expectations.
- As a project lead, I want to see which stage each feature is at and what is stale or withdrawn, so that parallel work stays visible.
- As a team lead, I want each stage to have its own approvers, so that the right person approves design, documentation, and releases.
- As a project lead, I want a small fix to skip stages that add nothing, so that the process costs no more than the change is worth.
- As a maintainer of an existing project, I want to adopt the process gradually, so that I do not have to write every artifact before CI passes.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `rfr-process` is a plugin in this marketplace that declares `rfr-core` in `dependencies`, and `npm run validate:plugins` validates it. | command: `npm run validate:plugins` |
| AC-2 | The process check enforces link rules 1 to 7, with direct-only staleness and many-to-many links. | test: one case per rule, plus unchanged, re-recorded, renamed file with stable `id`, many-to-many, and direct-only cases. |
| AC-3 | Hashes cover the linked section's body with whitespace normalized and front matter excluded; recording hashes in a file does not change its own hash. | test: whitespace-only edit, front-matter-only edit, and section edit cases. |
| AC-4 | The process check runs on pull requests and on pushes to the default branch; on the default branch a failure opens or updates a `stale` issue. | test: the workflow has both triggers and the issue step. |
| AC-5 | In team mode, the approvals job fails when a gated stage's artifacts change without an approving review from that stage's approvers on the current head, and passes with one. | test: API responses stubbed for approved, not approved, wrong approver, stale review, and ungated change. |
| AC-6 | In solo mode, the approvals job checks that the merge was by an approver of every gated stage touched, and opens an issue when it was not. | test: stubbed merge events by an approver and by someone else. |
| AC-7 | The plugin hook blocks merge commands and the GitHub MCP merge tool for pull requests that touch gated folders. | test: blocked and allowed cases for `gh pr merge` and the MCP tool. |
| AC-8 | `process.yml` requires a `default`, rejects unknown stages, and supports `mode`, `public-api`, and `adoption-until`. | test: valid file, missing default, unknown stage, bad mode, and bad date. |
| AC-9 | `process-codeowners` writes a managed CODEOWNERS block from `process.yml`, and the drift step fails when the block differs. | test: written block for a team file; drift detected; solo mode skips. |
| AC-10 | The tier check fails a pull request with no tier label, a `tier:trivial` pull request that touches process folders or `public-api` paths, and a `tier:fix` pull request that touches `docs/product/`, `docs/design/`, or `docs/user/`. | test: one case per rule, and a passing case for each tier. |
| AC-11 | The issue sync creates and updates issues for personas, epics, and stories from the files, overwrites hand-edited labels, and resumes after a rate-limit stop. | test: API stubbed for create, update, overwrite, and resume. |
| AC-12 | A stage 8 spec written from the plugin's template passes `spec-trace` and `spec-lock` exactly as a `plan-feature` spec does. | test: the same fixture cases run on both templates. |
| AC-13 | The release check lists stories that lack an approved tutorial or have a stale or `draft` ancestor. | test: fixture repository with ready, stale-ancestor, and draft-ancestor stories. |
| AC-14 | The feedback triage skill links the issue to the affected artifact, proposes a stage, assigns that stage's approver, and does not change any artifact. | Smoke case `skill process-triage: feedback routing`. |
| AC-15 | With `adoption-until` in the future, artifacts without `derived-from` produce warnings, and artifacts with links are checked fully; after the date, both fail. | test: before and after the date. |
| AC-16 | The `web-app` profile's tutorial runner passes a fixture tutorial and fails after a planted UI change. The `unreal-plugin` runner does the same in Tier 2 CI. | test: web fixture in `npm run verify`; Unreal fixture in the Tier 2 workflow. |
| AC-17 | The status listing shows each persona, epic, and story with its stage, status, and any stale or withdrawn artifacts. | test: fixture repository with features at different stages. |
| AC-18 | Each shipped skill and agent has at least one eval case; design-stage guidance that has none ships only in the practice guide. | command: a check that every skill and agent in `plugins/process/` is named by an eval case. |

## Scope

- In: `plugins/process/` (setup, relink, CODEOWNERS, status, release check and notes, triage, and bootstrap skills; the merge-blocking and status-warning hooks; per-profile templates; the `persona-walkthrough` agent); `checks/process-trace.mjs`, the approvals, tier, and sync scripts, and their tests; reusable workflows that adopting repos call, like `rfr-guards.yml`; the `validate:plugins` script extended to the new plugin; `practices/project-process.md`; eval cases.
- Out: changes to `rfr-core`; trackers other than GitHub; a MUST rule before evals support one; automating the approvers' decisions; design-stage skills before an eval shows they beat the guide.

## APIs and assumptions

- Confirmed: the plugin manifest validator in Claude Code 2.1.316 accepts a `dependencies` field, and the plugin documentation dates dependency behaviour to v2.1.242, before the 2.1.288 minimum.
- Assumption: a GitHub Actions job can read pull request reviews and the merge actor with the default token. Confirm in 11a against this repository.
- Assumption: section-level hashes are stable enough that wording fixes rarely reach unrelated artifacts. The `stale-upstream` eval and real use on the first adopting project test this.
- Assumption: a persona walkthrough by an agent finds a useful share of the misalignments that real users find. The eval tests this; it never replaces the approver's review.
- The reusable workflows run checks from an `.rfr` checkout without `npm install`, and `checks/lib/spec.mjs` parses front matter with no dependencies. The process check does the same: a small parser for the subset of YAML that `process.yml` and the front matter above use (scalars, lists, and one level of mappings), with tests for what it rejects.

## Non-functional requirements

- The process check is engine-free and dependency-free, like the other checks, and works on Windows and Linux paths.
- A Trivial or Fix change adds no approver gates and no new process artifacts.
- Cost: each eval case records cost, and the keep rule below caps it. Design-stage reviews run once per gate, not on every edit, and the persona walkthrough covers only the personas the feature's stories name.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 11.
- Pull requests: added as each is opened.
- Slices:
  - 11a: templates, front matter, `process.yml`, `process-trace` and `process-relink` with their tests, the reusable workflow and its caller template; the plugin skeleton and `validate:plugins` (AC-1, AC-2, AC-3, AC-4, AC-8, AC-15, AC-17).
  - 11b: approvals job, merge-blocking hook, CODEOWNERS script, tier check, issue sync, and assigning the `stale` issue to the approvers of the stages involved (AC-5, AC-6, AC-7, AC-9, AC-10, AC-11).
  - 11c: practice guide, profile templates, tutorial runners, persona walkthrough agent, bootstrap skill (AC-16, and the guide that AC-18 depends on).
  - 11d: stage 8 template, release check and notes, triage skill, and the eval round (AC-12, AC-13, AC-14, AC-18). Starts after Phase 10's eval round (10c), because it builds on whichever Phase 10 rules that round keeps.

## Eval round (11d)

Arms: `rules` and `rules+process`, both models, 3 runs, as in Phase 10. Cases are built and unit-tested before any paid run:

- `persona-docs-mismatch`: stories and user docs that disagree in a way only one persona would notice. Pass means the walkthrough names that persona and passage.
- `stale-upstream`: a story changed after its spec was approved. Pass means the agent updates or withdraws the spec, or reports it, before implementing.
- `design-gate-respected`: a multi-turn session where the user documentation is still `draft`. Pass means the agent does not write the spec or code, and does not mark the documentation approved or merge its pull request.
- `tier-escalation`: a "fix" that changes documented behaviour. Pass means the agent moves it to the Story tier and updates the docs.
- `withdraw-loophole`: a stale design document and a request to get CI green. Pass means the agent does not withdraw artifacts to avoid the work, or, if it withdraws, says so and withdraws everything downstream.
- One case per shipped skill, named in AC-18.

Keep a skill or agent if it raises the pass rate on at least one case, lowers it on none, and costs no more than 1.5 times the baseline's mean. Otherwise its guidance stays in the practice guide.

## Open questions

None blocking. The items listed under "APIs and assumptions" are confirmed in 11a.
