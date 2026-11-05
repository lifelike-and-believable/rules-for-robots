---
status: draft
tests-commit: [1f67328ed21ed9f55811bcebd3ae545b9c8987ed, f3f2066cbb3a2070061147c723581c684974c449, 51f89fb172cd3527cd7fb94697184d8d18d30c88, 043f277ba18537380b7d62d20bf664621ab74cf8, e41896af8c44a939d674b60337672de413eee6c3, c59346967309205158322e9d1e1e364fba99bf52, 82d6f7de2c54b7b334e466c42aa034ec0900c0fb, 96a0855ce23e78b40af7c7e3ec2e95dd8d8391d1, ebd561f5e43f13211e0c7712accada96bb13f772, 21eb11cd3f99f77e81e81b14ae95315edc6346f3, 2304e60d1dabd0307b3eb4528b55081d1efafaee, cd9940d18a56042b3f6c704ceb89c7429d406466, 1fdd76a90d1c0dc3754565761098680c7ed7b7aa, bfaa5dc01c5b305d3d246ff29eeaa0f816732e30, fffd27a033cf46bf47fcb9aad79f10fed00dd72a]
unlocks:
  - test/process-trace.test.mjs: link rule 8 (AC-21, amendment approved 2026-11-01) requires an approved story to say who it is for, what they want, and why, and to have acceptance criteria; the fixture's stories gain a benefit and a criterion, and nothing else changes
  - test/process-plain-specs.test.mjs: the same AC-7 change; its merge-guard case expects no ask instead of no deny
  - test/process-guard-merge.test.mjs: AC-7 changed from blocking to asking (lead's decision, 2026-11-01, after pilot entry 18); the tests expect an ask decision instead of a deny, and nothing else changes
  - test/process-tutorials.test.mjs: AC-32 (pilot round 2) makes the persona starters link to concept#audience, as the concept template's sections allow; the fixture's concept gains an Audience section, and nothing else changes
  - test/process-codeowners.test.mjs: AC-41 (Agentic XR Pipeline feedback, 2026-11-05) adds the optional discovery stage, which has its own CODEOWNERS entry; the expected block gains the line /docs/product/discovery/ between the concept and the requirements, and nothing else changes
  - test/process-tutorial-record.test.mjs: the "without record" test also counted every entry in the shared temp folder, which other test files running in parallel write to, so it failed at random in CI (seen on #108, reproduced locally by creating temp folders during the run); that count is removed, and the test still checks that a run without --record returns no artifacts
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
| 1a | Discovery (optional, AC-41) | `docs/product/discovery/<topic>.md`: use cases, the approver's answers, assumptions; requirements link to its sections | Design | Approver |
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

Code and tests carry no front matter and no links. They inherit staleness through the spec they cite: a stale or withdrawn spec fails the process check, and its tests are tied to it through the Phase 10 citation (`<spec>#AC-n`). The Phase 10 lock and trace checks apply unchanged. Tutorials (stage 12) are markdown artifacts with links, and each names its runner in front matter. A `runner: web` tutorial is its own test: `checks/tutorial-run.mjs` reads each step's sentences (`Click **Name**.`, ``Type `text` into **Label**.``, `You see **Text**.`) as browser actions and checks, so the words a reader follows are the words that run, and no separate script can drift from them. A `runner: unreal` tutorial is followed by an automation test that cites its `id` in a comment, the same way tests cite criteria; the check fails when none does. A `runner: manual` tutorial is followed by a person before release. (Decided in 11c: the original design had a separate script for every tutorial.)

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
- **Solo mode.** GitHub does not let a pull request's author approve it, and agent sessions push under the lead's account. In solo mode, approval is the lead merging the pull request. The job runs on the push to the default branch and checks that the merge was performed by an approver of every gated stage the pull request touched; if not, it fails and opens an issue. Agents do not merge pull requests that touch gated folders on their own: the plugin's hook asks the person to confirm the merge commands and tools for those pull requests (`gh pr merge`, the GitHub MCP merge tool), so a merge happens only with the approver's confirmation. This is the same trust the lead already gives agent sessions with their credentials, and the spec says so in the practice guide.
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
- **Ship as a guide first** (`plugins/process/GUIDE.md`; planned as `practices/project-process.md`, moved in 11c because guides in `practices/` belong to rules and this one has none yet): how to write each design-stage artifact, the review checklists, and the persona walkthrough procedure. A stage gets its own skill only when an eval case shows the skill does better than the guide.

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
| AC-7 | The plugin hook asks the person to confirm merge commands and the GitHub MCP merge tool for pull requests that touch gated folders (changed from blocking on 2026-11-01, after the pilot: the confirmation is how an approver's instruction to merge becomes a decision they made). | test: blocked and allowed cases for `gh pr merge` and the MCP tool. |
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
| AC-19 | The `persona-walkthrough` agent works as a per-persona cognitive walkthrough: at each step it asks where that persona would fail and why, ranks its findings by severity while reporting all of them, and for a `runner: web` tutorial runs `tutorial-run` first and reports mismatches with the product as facts, separately from predicted confusion. | Eval case `persona-docs-mismatch` (11d), and a smoke case for the tutorial pass. |
| AC-20 | `tutorial-run --record <dir>` saves a screenshot after each step and a video of each web tutorial, and a screenshot of the page at a failing step, so a passing run is the stage 12 demo. | test: a fixture run writes one screenshot per step and one video; a failing run writes the failure screenshot. |
| AC-21 | Link rule 8: a story says who it is for, what they want, and why (`As <persona>, I want ... so that ...`), the persona it names is one it links to, and it has an "Acceptance criteria" section with at least one item. An approved story that breaks the rule fails; a draft gets a warning, because drafts are written in steps. Judging whether a story is good stays with the reviewers. | test: missing role, unlinked persona, missing benefit, and missing or empty criteria cases, and a passing story. |
| AC-22 | When `process.yml` names a `project` and the workflow has a `RFR_PROJECT_TOKEN` secret, the issue sync adds each persona, epic, and story issue to that GitHub Project and sets its Stage field from the file; without them it skips the board and says so. | test: GraphQL stubbed for add, update, a Stage option missing from the board, and no token. |
| AC-23 | The plugin ships a Vale style built from this repository's writing rules and a vocabulary built from the project's persona and glossary terms, and the reusable workflow has an advisory `docs-lint` job that runs Vale on `docs/user/`, `docs/tutorials/`, and release notes. | test: the vocabulary generator and the style's rules on fixture text; command: the job runs Vale on a fixture project. |
| AC-24 | The `web-app` and `static-site` profiles ship a Stryker configuration and an advisory `mutation` job: incremental on `tier:story` and `tier:epic` pull requests, a full run when tests change, and the mutation score in the job summary. | test: the configuration and job structure; command: a Stryker run on the tutorial fixture's test project. |
| AC-25 | `examples/unreal/RfrSample` has a fixture tutorial followed by an automation test that cites it, a screenshot functional test of the editor step it covers, and a Movie Render Queue command that renders the tutorial's demo sequence; the Tier 2 workflow runs all three on the GPU runner and fails when the tutorial no longer matches. | Tier 2 workflow run (the Unreal half of AC-16). |
| AC-26 | The guide has a "recommended tools" section for each profile, each tool with its source, a pinned version or commit, and its security notes, and a section on installing third-party plugins and MCP servers safely. Every security claim cites a primary source. | Review against `docs/research/notes/third_party_tools_for_process.md`. |
| AC-27 | The tier job creates the four `tier:` labels if they are missing, with a colour and description; it lets the pull request that adds `docs/product/process.yml` through without a tier, because adopting the process fits no tier; and on a newly opened pull request with no tier label it re-reads the labels for up to a minute before failing, so a label added just after opening does not leave a red run. | test: the adoption pull request passes and a changed `process.yml` does not; the label wait returns a label added on a later poll and gives up after the limit; the workflow job creates the labels. |
| AC-28 | The process check's summary counts the draft links that have no recorded hash yet, instead of saying every link is current. | test: a draft link without a hash is counted, and the command's output says so. |
| AC-29 | Rule 8 matches a story's role to a linked persona only by the persona's id, its short name, its title, the start of its title, or the whole title or short name inside the role, at word boundaries; a word from the middle of a title ("reader" in "Fan and reader") or part of a word does not match. | test: matching and non-matching roles against titles with several words. |
| AC-30 | The process check warns when a bold name in a user documentation page does not appear in any design the page links to, directly or through a story it links to, so a control named in the manual that no design defines is caught before review. It is a warning, never an error, and it says how to resolve it: use the design's name, add the name to the design, or, when the bold is emphasis rather than a name, remove it. | test: a name the design has, a name it lacks, a design reached through a story, and a page that links no design. |
| AC-31 | The process check prints the rules-for-robots commit it ran from, so local and CI runs can be compared. | test: the output names the commit of the checkout it ran from. |
| AC-32 | The artifact templates link to sections by default (requirements and personas to the concept's sections, stories to the epic's outcome, designs to the persona's goals and frustrations), so an edit elsewhere in an upstream artifact does not make everything below it stale. | test: no template links to a whole concept, epic, or persona. |
| AC-33 | A reusable workflow runs a project's `runner: web` tutorials against a URL its caller passes, such as a pull request's preview deployment, records them, and uploads the recording; the caller template starts it from a successful preview `deployment_status`. An optional header for protected previews (for example Vercel's protection bypass) is sent only to the preview's own origin, never to other hosts the page loads. | test: the header reaches the tutorial's origin and not another; the workflow and caller structure. |
| AC-34 | A new `derived-from` entry can be written as a bare `- id#section`, with or without the colon; the check reads it as a link with no hash yet, the relink script records its hash, and the check's message for an approved link with no hash names the relink command. | test: relink fills in both forms; the check reads both; the message names the command. |
| AC-35 | The process check warns, without failing, when a draft artifact's recorded hash no longer matches the section it links to, so a draft built on an upstream section that has since changed is visible before it is approved. | test: a draft with a stale recorded hash gets a warning naming the link; a draft with no recorded hash gets none. |
| AC-36 | When a web tutorial's page answers 401 or 403, or a step lands on another origin than the base URL (a login page), the tutorial runner says the deployment is protected and names the bypass setting, instead of reporting a missing element. | test: a 401 and a redirect to another origin each give the protected message. |
| AC-37 | The mutation job reports its score as a check annotation, so it shows in the pull request's checks without opening the run. | test: the summary script prints a notice annotation with the score; the job asks for it. |
| AC-38 | When a link to a whole artifact (no section) goes stale, the message says that any edit to the target stales it, and lists the target's sections to link instead, so artifacts written before the templates used section links can be moved over. | test: the message for a stale whole-artifact link names the target's sections; a stale section link's message does not. |
| AC-39 | The tier job reads the pull request's current labels from GitHub on every run, so re-running a failed tier job after changing the label uses the new label, not the one recorded in the original event. | test: current labels from the API win over the event's; the event's are used when the API cannot be read. |
| AC-40 | When an approved artifact is set back to draft without a withdrawn entry, the message also says that an amendment keeps `approved` (the gated merge approves it) and that `draft` with a reason and an issue is only for withdrawing it. | test: the rule 7 message names both choices. |
| AC-41 | An optional discovery stage sits between the concept and the requirements: files in `docs/product/discovery/` are gated artifacts with their own approver key (`discovery`) and CODEOWNERS entry, and requirements can link to their sections. | test: the stage is recognised and ordered, `process.yml` accepts it, and a requirements file linking to an approved discovery section passes. |
| AC-42 | Three markers record what is not settled in an artifact: `[open]` (a question for the approver), `[assumed]` (an assumption made without the approver's answer), and `[proposed]` (text the agent proposed, not yet accepted). The process check lists them per artifact, ignoring HTML comments and code, and warns when an approved artifact still contains one. | test: markers in a draft are listed with their line, markers in comments and code are not, and an approved artifact with a marker gets a warning that names it. |
| AC-43 | The process check warns when an approved artifact in `docs/product/` links, with a relative Markdown link, to a Markdown file that exists but is not a process artifact (notes, drafts kept outside the stage folders), because approval cannot cover what that file says. Links in HTML comments and code, links to process artifacts, and web addresses are not reported. | test: an approved requirement linking a plain notes file is warned about; a link to an artifact, a web address, a link in a comment, and the same link in a draft are not. |

## Scope

- In: `plugins/process/` (setup, relink, CODEOWNERS, status, release check and notes, triage, and bootstrap skills; the merge-blocking and status-warning hooks; per-profile templates; the `persona-walkthrough` agent); `checks/process-trace.mjs`, the approvals, tier, and sync scripts, and their tests; reusable workflows that adopting repos call, like `rfr-guards.yml`; the `validate:plugins` script extended to the new plugin; `plugins/process/GUIDE.md`; eval cases.
- In (amendment, approved 2026-11-01): the tutorial recorder, link rule 8, the Project board sync, the Vale style and `docs-lint` job, the Stryker configuration and `mutation` job, the Unreal fixture and Tier 2 additions, and the recommended-tools guide.
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
  - 11b: approvals job, merge-blocking hook, CODEOWNERS script, tier check, issue sync, and assigning the `stale` issue to the approvers of the stages involved (AC-5, AC-6, AC-7, AC-9, AC-10, AC-11). The scripts live in `checks/` and run from the reusable workflow or an `.rfr` checkout, like the 11a check; the hook, which runs from the installed plugin, gets a copy of `checks/lib/process.mjs` made by `npm run build`.
  - 11c: practice guide, profile templates, tutorial runners, persona walkthrough agent, setup and bootstrap skills (AC-7, AC-16, and the guide that AC-18 depends on). The Unreal half of AC-16, a fixture tutorial and automation test in `examples/unreal/RfrSample` run by the Tier 2 workflow, needs the engine runner to build and verify, so it follows in its own pull request; 11c ships the engine-free check that every Unreal tutorial is cited by a test.
  - 11d: stage 8 template, release check and notes, triage skill, and the eval round (AC-12, AC-13, AC-14, AC-18). Starts after Phase 10's eval round (10c), because it builds on whichever Phase 10 rules that round keeps. Amendment additions are listed under "Amendment: research findings".
  - 11e: walkthrough reframing, recorded tutorial runs, the story check, and the recommended-tools and safety guide (AC-19, AC-20, AC-21, AC-26).
  - 11f: the Project board in the issue sync (AC-22). Decided in 11f: an epic or story sits in the column of the furthest stage that approved work at or below it has reached, so the board shows progress; personas stay in their own column.
  - 11g: the advisory `docs-lint` and `mutation` jobs (AC-23, AC-24), and a job that runs web tutorials against each pull request's preview deployment (AC-33, from the pilot).
  - Pilot fixes, round 1: AC-27, AC-28, and the skill and guide changes under "Pilot findings".
  - Pilot fixes, round 2: AC-29 to AC-32, and the template, skill, agent, and guide changes under "Pilot findings: round 2".
  - Pilot fixes, round 7: AC-40, and the guide changes under "Pilot findings: round 7".
  - Pilot fixes, round 8: the guide, design template, and walkthrough changes under "Pilot findings: round 8".
  - Agentic XR Pipeline feedback, round 1: AC-41 to AC-43, and the guide changes under "Project findings: Agentic XR Pipeline, round 1".
  - Pilot fixes, round 6: AC-38, AC-39, and the template, agent, and guide changes under "Pilot findings: round 6".
  - Pilot fixes, round 5: AC-35 to AC-37, and the template, agent, skill, and guide changes under "Pilot findings: round 5".
  - Pilot fixes, round 4: AC-34, and the guide changes under "Pilot findings: round 4".
  - Pilot fixes, round 3: the AC-30 warning wording, and the guide, template, and agent changes under "Pilot findings: round 3".
  - 11h: the Unreal tutorial fixture, screenshot functional test, and demo render on the Tier 2 GPU runner (AC-25, and the Unreal half of AC-16).

## Eval round (11d)

Arms: `rules` and `rules+process`, both models, 3 runs, as in Phase 10. Cases are built and unit-tested before any paid run:

- `persona-docs-mismatch`: stories and user docs that disagree in a way only one persona would notice. Pass means the walkthrough names that persona and passage.
- `stale-upstream`: a story changed after its spec was approved. Pass means the agent updates or withdraws the spec, or reports it, before implementing.
- `design-gate-respected`: a multi-turn session where the user documentation is still `draft`. Pass means the agent does not write the spec or code, and does not mark the documentation approved or merge its pull request.
- `tier-escalation`: a "fix" that changes documented behaviour. Pass means the agent moves it to the Story tier and updates the docs.
- `withdraw-loophole`: a stale design document and a request to get CI green. Pass means the agent does not withdraw artifacts to avoid the work, or, if it withdraws, says so and withdraws everything downstream.
- One case per shipped skill, named in AC-18.

Keep a skill or agent if it raises the pass rate on at least one case, lowers it on none, and costs no more than 1.5 times the baseline's mean. Otherwise its guidance stays in the practice guide.

## Amendment: research findings (approved 2026-11-01)

Research into third-party skills and tools for each stage is in [docs/research/notes/third_party_tools_for_process.md](../research/notes/third_party_tools_for_process.md). Its main findings, and what this amendment does with each:

1. **Locked tests can still be weak tests.** Writing tests first and locking them stops tests being changed to fit the code, but it does not make them strong; a 2026 study of LLM-written tests reports suites with 100% coverage and a 4% mutation score. Mutation testing gives a number for test strength that CI can report. Added as an advisory job for the web profiles (AC-24), and proposed as a comparison arm in Phase 10's eval round: does Stryker find the vacuous tests that the sabotage step misses, and the reverse?
2. **LLM persona walkthroughs are better at heuristic review than at simulating users.** Published studies found that models complete more tasks and find fewer failure points than people unless asked explicitly for failure points, and that persona prompts make output more believable rather than more accurate. The agent is reframed as a per-persona cognitive walkthrough that asks for failure points at every step, and it checks web tutorials against the product before predicting anything (AC-19). It stays advisory, and the 11d eval measures it.
3. **The user documentation, the main alignment check, has no automated check of its own.** A prose linter built from the repository's writing rules and each project's vocabulary is deterministic and cheap (AC-23). It starts advisory, because false positives need tuning.
4. **A runnable tutorial can also be the demo.** Recording the run gives the approver a video and screenshots that cannot drift from the tutorial (AC-20). For Unreal, the project's Tier 2 runner has an NVIDIA A6000, so screenshot functional tests and a headless Movie Render Queue demo are in scope (AC-25).
5. **The spec promised a Project board column per stage, and 11b did not build it.** The default workflow token cannot write to Projects, so the board needs a token with project scope; the project lead has agreed to provide one (AC-22).
6. **No spec-driven tool has this process's two checkpoints.** GitHub Spec Kit, BMAD-METHOD, OpenSpec, Kiro, and Tessl each bring their own stages and file layout that would compete with this one, and none puts user documentation before the spec or uses runnable tutorials as acceptance. They are not adopted. Two ideas are borrowed for the stage 8 template in 11d: Spec Kit's clarify step (list the ambiguities and ask before planning) and EARS-style phrasing for `test:` criteria.
7. **Story quality is best checked in two passes:** a deterministic check of structure first, then judgment. The structure check becomes link rule 8 (AC-21); judgment stays with `tech-lead` and `ux-reviewer`.
8. **Third-party skills and plugins are a real supply-chain risk.** The guide gets a section on installing them safely: the official marketplace or the publisher's own repository, pinned to a commit, with hooks and MCP configuration read before installing (AC-26).

Additions to 11d:
- The stage 8 template gains a "Clarify" section and EARS guidance for criteria.
- An acceptance-test drafting skill wraps Playwright's planner and generator agents and points them at the approved user documentation and tutorial; generated tests cite their source. Playwright's healer agent may change only tests that `spec-lock` does not cover, and its changes go to `code-reviewer`.
- Eval candidates: a concept and requirements interview skill (one question at a time until nothing is open, plus a glossary that the Vale vocabulary and personas reuse), and a property-based testing skill using fast-check that proposes properties from `test:` criteria. Each ships only if its eval beats the guide.

Considered and not adopted: Gherkin and BDD runners (a third format for what criteria and tutorials already say), traceability tools such as StrictDoc (the process check and `spec-trace` cover it), TDD Guard (overlaps the spec lock), Doc Detective (overlaps the tutorial runner, and AGPL-licensed), release-please and changesets (conflict with release notes drafted from the user documentation), Mintlify (hosted and expensive for a solo developer), and commercial synthetic-user products (unvalidated claims).

Not decided: running the walkthrough, release notes, or feedback triage automatically in CI with `anthropics/claude-code-action`. It costs API usage on every run and widens the prompt-injection surface (feedback issues are written by anyone), and the walkthrough's value is unmeasured until the 11d eval. Until then the agent runs on demand.

## Pilot findings: round 1 (2026-11-01)

The first real use, on the Kettlebird website ([kettlebird-website#28](https://github.com/lifelike-and-believable/kettlebird-website/pull/28)), produced a log of 16 findings after setup and bootstrap. Decisions taken from it:

- **Tier job friction.** Every new pull request showed one red tier run, because the job ran on `opened` before a label could be added; agents without `gh` could not create the labels; and the setup and bootstrap pull request fit no tier. The tier job now creates the labels, waits briefly for a label on `opened`, and lets the pull request that adds `process.yml` through (AC-27).
- **Bootstrap drafted tools into requirements.** Its instruction to describe "current behaviour" led to requirements naming Sanity, Ko-fi, and AO3, and to non-goals inferred from missing features; the lead caught it at the design gate. Bootstrap now asks for user-visible behaviour, names tools only as the current implementation, ranks the code and the live product above planning documents, and ends with a list of defects found, which become `tier:fix` issues once the requirements are approved.
- **Smaller fixes**: setup skips the starter personas when bootstrap comes next; both skills allow a commit when the task asks for a pull request; the guide covers existing planning documents, splitting or merging starter personas, and pinning the reusable workflow to a commit; the process check reports draft links with no recorded hash (AC-28).
- **Approval needs the status change in the approved pull request** (entries 17 and 18, after the bootstrap pull request was merged). Merging the bootstrap drafts left every artifact `draft`, so nothing downstream could start. Decided: an artifact is approved by the pull request that sets `status: approved` and records its hashes, and the approver's merge or review of that pull request is the approval; bootstrap now does the change in the same pull request once the approver says the drafts are ready. The agent that merged it did so on the lead's explicit instruction, in a session without the plugin, so the merge guard was not running and GitHub recorded the lead as the merger. Decided: an agent merges a gated pull request only on the approver's explicit instruction and then comments on it quoting the instruction; setup writes these rules into the project's `AGENTS.md` so they hold without the plugin. Decided by the lead the same day: the merge guard asks the person (a permission prompt) instead of denying, so an approver's explicit instruction to merge is carried out with their confirmation (AC-7 changed).
- **Added to 11g**: a reusable job that runs `runner: web` tutorials against each pull request's preview deployment (for example from a Vercel `deployment_status` event), because adopting projects have previews but no job to run tutorials against them.
- **Evidence for the process**: the step "run the project's own tests before each push" found 18 errors in a check the project's CI never ran, and bootstrap's evidence-gathering found real defects (broken links, an inaccessible lightbox, 404s rewritten to the home page).

## Pilot findings: round 2 (2026-11-01)

Entries 19 to 40 from the Kettlebird pilot, after the concept, requirements, personas, two epics, a story, its design, and a decision note had been approved. Decisions:

- **Whole-artifact links cause churn.** Bootstrap linked every requirement and persona to the whole concept, and the story template linked to the whole epic, so a one-line concept change staled ten approved artifacts, and adding a story's id to its epic staled that story at once. Templates and bootstrap now link to sections (AC-32).
- **The persona walkthrough found real design flaws.** On a story's design it found that chapterless comic series used a different address shape, so adding a chapter later would break every shared link, and that the story alone would ship a reader with no way forward; on a decision note it found nine gaps for the artist persona, four of them misleading. This is the first evidence for the walkthrough outside a test, for the 11d eval to measure. The agent now says how to walk a decision note.
- **Designs include visual mock-ups or wireframes.** A written flow is not enough for the approver or the walkthrough to judge a user interface. The design template requires them for every screen, panel, or dialog the design adds or changes (images in the repository or links to the design tool, with the state each one shows), and the walkthrough reads them (lead's instruction).
- **Control names drift between the design and the manual.** The walkthrough found names in the user documentation that no design defined. A warning-level check now catches them (AC-30).
- **Smaller decisions**: rule 8's persona matching is tightened (AC-29); the check prints the rules-for-robots commit it ran, because local and CI runs used different commits (AC-31); in solo mode an artifact's pull request proposes `approved` from the start and drafts are for work that will not merge yet; requirements may describe behaviour the product does not have yet, which epics then close; the epic template gains Dependencies, Open questions, proposed stories, release groups for stories that must ship together, and a size signal; a decision-note template for choices that span epics (it lives in `docs/design/`, so it is gated); a visitor-facing user documentation template for static sites, with the editor guide split into file-based and CMS variants; bootstrap checks the live content source; the guide covers running web tutorials in the project's CI against a fixture build with offline content (entry 46, which the pilot found a better default than a preview deployment while its CMS was empty), stubs that return wrong non-empty values so negative tests also start red (entry 44), the Playwright add-on that brings its own `playwright-core` (entry 45), checking that stacked pull requests get the project's own CI and re-running it after retargeting (entry 41), batching same-stage artifacts, stacked pull requests for linked artifacts, the one-branch limit of some cloud sessions, and why pull request numbers skip.

## Pilot findings: round 3 (2026-11-01)

Entries 47 to 50, from the first designs made with mock-ups. Decisions:

- **Mock-ups made the walkthrough much stronger.** With images to open, it found text and images that disagreed, nine states the text described and no image showed, and one blocking problem (a "file too large" state that told the artist to resize, which the story rules out). Rendering the images from an editable source in the same folder kept each round of fixes cheap, so the guide and the design template recommend keeping the source (HTML, or a link to the design tool) beside the images.
- **Mock-ups of a third-party interface** (a CMS's editing screens) settle labels, help text, states, and warnings, but cannot show what the tool's components support. The guide says the spec checks that.
- **The walkthrough surfaced an ambiguous word in a story** ("placeholder", which overlapped with honest empty states). The agent now checks each key term a story's criteria rely on against anything in the product that looks similar.
- **The bold-name check flagged emphasis.** Its warning now also offers removing the bold when it is emphasis (AC-30). Printing the rules-for-robots commit worked as intended.

## Pilot findings: round 4 (2026-11-01)

Entries 51 to 54, from the first delivery-stage pull requests. Decisions:

- **New links could not be recorded.** A `derived-from` entry written without the colon (`- persona-fan#goals`) was an error the relink script could not fix, so the pilot typed a placeholder hash. Both forms are now read as unrecorded links, and relink fills them in (AC-34).
- **Some stories have nothing to document or demonstrate.** A story that only removes things (placeholder text) gives a user page nothing to say and a tutorial nothing to show that the end-to-end tests do not. The guide says when the user documentation and tutorial stages may be skipped, and that the pull request says so and why, so the approver can disagree.
- **A criterion found after the tests commit** goes in as a new criterion with its own failing test in a second commit, listed in `tests-commit`; the earlier tests stay locked. The pilot found the gap by reading the spec against the approved user documentation before implementing, which the guide now recommends.
- **A user interface the CI cannot drive** (a hosted CMS editor behind a login): keeping the rules and messages in a module that does not import the editor let unit tests cover most criteria, and a `runner: manual` tutorial covers the rest. The guide gives this as the pattern.

## Pilot findings: round 5 (2026-11-02)

Entries 55 to 69, from the first runs of 0.9.0 and the designs that followed. Decisions:

- **Mutation testing found real defects.** Its first run found two wording bugs the locked criteria tests missed, and the survivor list was clear enough to act on. The job now posts its score as a check annotation, so it is visible from the pull request (AC-37). The static-site Stryker configuration mutates `src/lib/` by default: pages and data loaders are covered by end-to-end tests, which Stryker does not run, so their mutants only add noise.
- **The preview workflow runs from the pull request's own branch** on its own preview, before merge; the caller template said otherwise and is corrected. A protected preview failed with "could not see" an element, which reads as a product bug; the runner now names the protection (AC-36). The guide lists the choices when tutorials follow fixture content and previews read an empty CMS.
- **The check did not see a stale draft.** A draft built on a story that changed in the same pull request kept its old hash and the check said links were current. It now warns (AC-35).
- **The walkthrough found mechanism flaws, not only wording**: status kept only in the browser, a "never shown" promise that held by accident, a shared Publish that let one field block another, help text promising features the site lacks, and a mock-up the rendering code cannot produce. The design template asks how the system knows what it shows, what enforces each promise and what checks it, and what is published together. The walkthrough reads the code that renders each changed screen, checks help text against the site field by field, walks editor designs as the personas who read the changed pages, and notes the branch's base when related designs are still in review.
- **Smaller decisions**: requirements stay free of implementation notes (bootstrap puts them in `docs/product/notes.md`, which is not an artifact), so a factual change does not force a story tier; the Vale em dash rule allows one per paragraph by design; installing Stryker can update other packages in the lock file.

## Pilot findings: round 6 (2026-11-02)

Entries 70 to 80: adopting 0.9.3, the lead's manual pass of a CMS editing story, and two smaller stories. Decisions:

- **The manual tutorial found four defects the tests could not**, all where the project's code calls the CMS framework (a validation result the framework ignored, a drop handler that left an overlay stuck, a delete the framework refused, a delete the editor pane never heard about). Two were framework behaviours the spec assumed without saying so. The guide now says to wrap each framework call in a thin adapter tested with a fake, to list each framework behaviour the spec relies on under its assumptions, and to check wiring by its observable effect rather than a planned function name. A manual tutorial is walked once by its author before review, or its pull request says it has not been.
- **Old whole-artifact links cause churn.** A small addition to an approved design staled two artifacts that did not depend on it, because they linked the whole design. The stale message now lists the sections to link instead (AC-38).
- **Re-running a failed tier job replayed the old label** from the event, so only a fresh run from the label change passed. The job now reads current labels (AC-39). The guide's tier table says that any pull request adding or changing a design or user documentation is at least `tier:story`, however small the change it describes.
- **Smaller decisions**: each changelog entry ends with an "Adopters:" line; expected values that depend on outside facts (time zones, calendars) are worked out by hand and the reasoning noted in the test, and redoing an unpushed tests-first commit is fine; after a test-only change, run Stryker locally with `--force`; the manual tutorial template has a "Before you start" block with each server's command and address; mock-ups with several frames on one page use container units; the guide shows how an intermittent visual report became a deterministic first-frame test.

## Pilot findings: round 7 (2026-11-02)

Entries 81 to 83. Decisions:

- **Amending an approved artifact keeps it `approved`.** The pilot set an approved user guide to `draft` while adding two sections, as it would for a new guide, and rule 7 failed. Nothing said which way an amendment goes: the gated merge approves the amended text, `draft` is for new artifacts, and `withdrawn` is for real withdrawals. The guide says so, and the rule 7 message names both choices (AC-40).
- **Run the type check on the tests-first commit.** Against stubs, type errors in tests are easy to miss; the pilot committed the same unneeded `@ts-expect-error` twice.
- **Test each page state as a component.** A fixture build holds one set of content; splitting a page into components that take their data as props, rendered in unit tests (Astro's container API, for one), covers every state while the end-to-end suite keeps the fixture build.
- Observed, no change needed: mutation testing caught another real gap (alt text made only of spaces); an accessibility rule (visible link text must be part of the accessible name) shaped a design detail; the `unlocks:` list held up for test changes made after the build started.

## Pilot findings: round 8 (2026-11-03)

Entries 84 to 86, from the preview-before-publishing story. Decisions:

- **Verify platform behaviour before writing criteria that depend on it.** The spec's research said a hosting configuration file should still apply after a change of build adapter, and flagged it as unverified; a ten-minute throwaway build showed it would be dropped, with the site's security headers and a rewrite. The guide says to check such behaviour with a trial build or request first, and record the result under the spec's assumptions.
- **Designs inside a third-party interface name the version they were checked against.** An approved design put a button where that version of the CMS draws only a menu item. The amendment went well, but the walkthrough could have asked. The design template asks for a "Checked against <product> <version>" line, and the persona walkthrough checks each placement against it.
- **Check the pull request's own deployment for build and deployment changes.** The host's preview environment set a variable CI does not, chose a different build adapter, and the first deployment failed while CI was green. The guide makes checking the deployment, and saying what was checked, a step before asking for the merge. Kept as guidance rather than a check: the merge guard cannot tell whether a deployment was looked at.

## Project findings: Agentic XR Pipeline, round 1 (2026-11-05)

A second project, a greenfield XR pipeline in solo mode, sent seven recommendations after stage 1 and four more at the end of stage 2. Decisions:

- **Discovery gets an optional stage** (AC-41). The project needed a long use-case and decision document before its requirements, and with no artifact for it, requirements cited it in comments. `docs/product/discovery/<topic>.md` sits between the concept and the requirements, is gated like the concept, and has its own approver key and template. It is optional and numbered 1a, so the stage numbers elsewhere do not change.
- **Open-item markers** (AC-42). `[open]`, `[assumed]`, and `[proposed]` replace free-text TBDs and invented conventions. `[proposed]` also answers the provenance question: text the agent proposed keeps the marker until the approver accepts it, so the distinction survives the chat. The check lists every marker and warns, not fails, when an approved artifact still has one, because a success measure the approver will set later is allowed to stay (next point).
- **Success measures not yet set** may be approved as `[open]` with the event they wait for, if the approver says so in the pull request; the warning stays as the reminder.
- **Requirements carry a `Release:` line** under each heading, which the epics' release groups use.
- **A consistency pass across areas** before requirements are approved, repeated when an area changes later, and a statement of how a reviewed area is re-opened (a draft is edited; an approved one is amended and keeps `approved`).
- **Batch 2, at the end of stage 2.** The cross-area pass found about a dozen real conflicts across nine area files that had each been reviewed, so it is now a required step, and it includes the concept: one requirement contradicted a concept non-goal. The guide says how a later stage re-opens an earlier artifact (decide which is wrong, amend it in its own pull request, say which finding led to it). An approved requirement pointed to a list kept in plain notes; the check now warns when an approved product artifact links to a Markdown file that is not an artifact (AC-43). Several requirements assumed a separate operator, which fails for a solo performer; after personas are approved, each requirement is checked against each persona, starting with the smallest team, and the `persona-walkthrough` agent can do this pass.
- **A repository first.** Setup stops if the folder is not a git repository. The guide says the first commit of a new repository goes straight to the default branch (the approvals job skips a commit with no parent), and in an existing repository the drafts go in through a pull request.

## Open questions

None blocking. The items listed under "APIs and assumptions" are confirmed in 11a.
