---
status: draft
---

# Project development process (`rfr-process` plugin)

A staged, iterative development process for products built with agents: a design phase owned by the project lead, then a delivery phase that agents run with review gates. Features move through the stages independently and any stage can be revisited. When an artifact changes, the artifacts derived from it are marked for review.

This is a proposal. Decisions marked **(to confirm)** are open until the spec is approved.

## Problem

The rules in `rfr-core` steer how an agent writes and checks code, but not how a feature gets from an idea to something its users can work with. `plan-feature` writes one spec per feature, and Phase 10 ties that spec's criteria to tests. Nothing covers who the users are, what they expect, or whether the finished feature matches that expectation.

The project lead's experience with artist-facing tools is that misalignment between a feature description and what users expect shows up fastest when users read the user manual, and is confirmed or ruled out when they follow tutorials and demos before production use. On large teams, a process built around those two checkpoints let people work quickly with few missteps and little rework. This spec turns that process into skills, templates, agents, and checks that Claude Code can follow.

## Process model

### Two levels

- **Product level** (once per product or major area, revisited as needed): Concept, Requirements, Personas, Epics.
- **Feature level** (per epic or story, many in flight at once): User Stories, Design and UX, User Documentation, Technical Specification, Unit Tests, Implementation, Automated Regression Tests, Demos and Tutorials, Release and Feedback.

### Stages

| # | Stage | Artifact | Phase | Gate |
|---|---|---|---|---|
| 1 | High-level concept | `concept.md`: problem, audience, vision, non-goals | Design | Lead approves |
| 2 | Requirements | `requirements.md`: functional and non-functional requirements with IDs (`REQ-1`), constraints, success measures | Design | Lead approves |
| 3 | User personas | `personas/<name>.md`: goals, skills, tools, context of use, frustrations | Design | Lead approves, before any stories are written |
| 4 | Epics | One per area of capability, linked to requirements and personas | Design | Lead approves |
| 5 | User stories | Stories written against a named persona, each with acceptance criteria | Design | Lead approves |
| 6 | Design and UX | Interaction flows, layouts or editor UI, states and errors; the basis of the user documentation | Design | Lead approves |
| 7 | User documentation | The user manual for the feature, written as if the feature exists | Design | Lead approves (the main alignment check) |
| 8 | Technical specification | Extends the `plan-feature` spec: architecture, interfaces, ADRs, criteria traced to docs and stories | Delivery | Agents review and proceed; lead is informed or consulted |
| 9 | Unit tests | Tests written from the spec before implementation (Phase 10 lock and trace) | Delivery | Agents and CI |
| 10 | Implementation | Code that makes the locked tests pass | Delivery | Agents and CI |
| 11 | Automated regression tests | Acceptance and end-to-end tests drawn from stories and docs, promoted into the regression suite | Delivery | Agents and CI |
| 12 | Demos and tutorials | Tutorials that follow the user documentation step by step, and demo content | Validation | Lead reviews (the main expectation check) |
| 13 | Release and feedback | Release notes; feedback from real use filed against the stage it affects | Validation | Lead decides where feedback goes |

Stages 8 to 11 can overlap. In particular, acceptance tests (stage 11) can be drafted from stories and docs as soon as stage 7 is approved; stage 11 is where they become part of the regression suite.

### Review types

Each stage uses one or more of:

- **Self-check**: the author runs the stage checklist in the skill and records the result.
- **Independent agent review**: a reviewer agent gets the artifact, its upstream artifacts, and the checklist, but not the author's reasoning (R19).
- **Persona walkthrough** (new): an agent takes on one persona at a time, reads the user documentation or follows a tutorial in that persona's terms, and reports where the persona would be confused, blocked, or would expect something different. This automates part of "show people the manual", and it runs before the lead's review so the lead sees its findings.
- **Lead gate**: the lead approves, asks for changes, or sends the work back to an earlier stage.
- **CI gate**: tests, traces, locks, and the staleness check.

| Stage | Self-check | Agent review | Persona walkthrough | Lead gate | CI |
|---|---|---|---|---|---|
| Concept, requirements | yes | `software-architect` (feasibility, gaps, conflicts) | no | yes | no |
| Personas | yes | `ux-reviewer` | no | yes | no |
| Epics, stories | yes | `tech-lead` (sizing, dependencies), `ux-reviewer` | no | yes | trace |
| Design and UX | yes | `ux-reviewer`, `accessibility-reviewer` | yes | yes | no |
| User documentation | yes | `docs-writer` (candidate) | yes | yes | trace |
| Technical specification | yes | `software-architect`, `security-reviewer` | no | informed or consulted | trace |
| Unit tests, implementation | yes | `code-reviewer`, sabotage step | no | no | yes |
| Regression tests | yes | `code-reviewer` | no | no | yes |
| Demos and tutorials | yes | `ux-reviewer` | yes | yes | runnable tutorials |

### Size tiers

Not every change goes through every stage.

| Tier | Example | Stages |
|---|---|---|
| Trivial | Typo, dependency bump, internal refactor with no behaviour change | Implementation and regression tests |
| Fix | A bug where the docs already describe the right behaviour | Unit test reproducing the bug, implementation, regression |
| Story | A new story inside an approved epic | Stories to demos; design and docs only if the user-facing behaviour changes |
| Epic | A new area of capability | All feature-level stages, and a check on whether requirements or personas change |

The agent proposes a tier and says why; the lead can change it. A change that turns out to alter documented behaviour moves up to the Story tier.

## Artifacts, linking, and staleness

### Where artifacts live (to confirm)

A mix, split by what each kind of record is for:

- **In the repository** (versioned with the code, reviewed in pull requests, checkable offline): concept, requirements, personas, epic and story text, design notes, user documentation, specs, tutorials. Proposed layout: `docs/product/` for concept, requirements, and personas; `docs/product/epics/<epic>/` for each epic and its stories; `docs/design/`; `docs/user/`; `docs/specs/`; `docs/tutorials/`.
- **In GitHub Issues and Projects** (status and discussion): one issue per epic, sub-issues per story, a `stage:<name>` label, and a Project board with a column per stage. Each issue links to its file; the file is the source of truth for the text.

### Links

Each artifact has front matter with an `id`, a `status` (`draft`, `in-review`, `approved`, `stale`), and `derived-from`: the IDs of its upstream artifacts and a hash of each one's content at the time this artifact was approved.

### Staleness

A check (`checks/process-trace.mjs`) recomputes the upstream hashes. When an approved upstream artifact has changed since a downstream one was approved, the downstream artifact is reported as stale and its issue gets a `stale` label. This generalizes the Phase 10 spec lock: a story changes, so its design, docs, spec, and tests are flagged.

Re-approving a downstream artifact after review records the new hashes. A skill command does this so that a typo upstream costs one confirmation, not a rewrite (to confirm: hash the whole body, or only sections marked as normative).

### Approval records

Design-phase approvals are made by the lead and recorded as `approved-by` and `approved-on` in front matter, through a pull request the lead reviews. CODEOWNERS on the design-phase folders makes the lead's review required. A hook stops an agent from setting `status: approved` on a design-phase artifact itself.

## Tailoring by project type

The stages are the same for every project type. What each artifact contains is not. Each profile supplies persona starters, templates, and the form tutorials take.

| Profile | Typical personas | User documentation | Runnable tutorials |
|---|---|---|---|
| `unreal-plugin` | Technical artist, animator, designer, gameplay programmer | Editor workflows, Blueprint API, settings, Fab listing material | Automation or functional tests that follow tutorial steps in a sample project, plus a recorded walkthrough |
| `web-app` | End user, administrator, support | Task guides, help pages, onboarding | Playwright scripts that follow tutorial steps |
| `static-site` | Visitor, content editor | Content model and editing guide | Content checks and a Playwright walkthrough |

New profiles follow the existing profile pattern in `build/`.

## How it uses `rfr-core`

- `plan-feature` and its spec template become the stage 8 artifact, with criteria that also cite the stories and docs sections they come from.
- Phase 10's `spec-trace`, `spec-lock`, and the sabotage step in `review-pr` cover stages 9 and 10 unchanged.
- The existing reviewer agents cover most reviews. Two new agents are candidates: `docs-writer` (already on the Plan's candidate list) and `persona-walkthrough`. Both start as experimental, as R18 requires.
- `rfr-process` depends on `rfr-core` and never changes its rules.

## User stories

- As a project lead, I want to approve concept, requirements, personas, epics, stories, design, and user documentation before any technical work starts on a feature, so that misalignment is found while it is cheap to fix.
- As a project lead, I want agents to carry a feature from an approved user manual to demos without asking me at each step, so that I spend my time on design and validation.
- As a project lead, I want to review tutorials and demos before production use, so that I can confirm the feature meets user expectations.
- As a project lead, I want to see which stage each feature is at and which artifacts are stale, so that parallel work stays visible.
- As an agent, I want each stage's inputs, checklist, and gate stated in a skill, so that I know when I can proceed and when I must stop.
- As a project lead, I want a small fix to skip stages that add nothing, so that the process costs no more than the change is worth.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `rfr-process` is a plugin in this marketplace that declares `rfr-core` as a dependency and passes `claude plugin validate --strict`. | command: `npm run validate:plugins` |
| AC-2 | Each stage has a skill that names its inputs, its artifact template, its self-check, its reviews, and its gate, and stops at a lead gate. | Smoke cases per skill (`evals/agents/smoke.mjs`). |
| AC-3 | Stories cannot be drafted until at least one persona is approved, and every story names a persona. | test: the process check fails on a story with no persona or with an unapproved persona. |
| AC-4 | The process check reports a downstream artifact as stale when an approved upstream artifact's content changed after the downstream approval, and passes once it is re-approved. | test: unchanged, changed, re-approved, missing upstream, and cyclic-link cases. |
| AC-5 | An agent cannot mark a design-phase artifact approved. | test: the hook blocks the edit and allows the same edit to a delivery-phase artifact. |
| AC-6 | A skill proposes a size tier with a reason, and the Fix and Trivial tiers skip the design-phase stages. | Smoke case. |
| AC-7 | Each profile ships persona starters and templates for user documentation and tutorials. | test: the build renders them for each profile; `npm run build:check` passes. |
| AC-8 | A status command lists each epic and story with its stage, status, and stale artifacts. | test: fixture repository with features at different stages. |
| AC-9 | The persona walkthrough reports, for a planted mismatch between stories and user docs, the persona and the passage where the expectation breaks. | Eval case `persona-docs-mismatch`. |
| AC-10 | Tutorials in the `web-app` and `unreal-plugin` profiles can be run as tests, and a tutorial whose steps no longer match the product fails. | test: a fixture tutorial passes, then fails after a planted UI change. |

## Scope

- In: a new `plugins/process/` plugin (skills, templates, hook); `checks/process-trace.mjs` and its tests; profile templates under `templates/`; an opt-in job in `rfr-guards.yml`; a practice guide `practices/project-process.md`; eval cases.
- Out: changes to `rfr-core` rules; integrations with trackers other than GitHub; a MUST rule before evals support one; automating the lead's gates.

## APIs and assumptions

- Assumption: plugin dependencies between marketplace plugins are supported by the minimum Claude Code version (2.1.288). Confirm before slice 11a; if not, the README states the requirement and `install-rules` checks for it.
- Assumption: the GitHub MCP tools can create sub-issues and apply labels from a session. Confirm in 11a.
- Assumption: a content hash is a good enough signal of change. A whitespace or typo edit will flag downstream work; the re-approve command keeps that cheap.
- Assumption: a persona walkthrough by an agent finds a useful share of the misalignments that real users find. The eval in 11c tests this; it never replaces the lead's review.

## Non-functional requirements

- The check is engine-free and dependency-free, like the other checks, and works on Windows and Linux paths.
- A Trivial or Fix change adds no lead gates and no new files.
- Skills keep their own text short and load templates on demand, so the plugin adds little to context cost.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 11 (proposed).
- Pull requests: added as each is opened.
- Slices:
  - 11a: plugin skeleton, artifact templates, front matter and links, `process-trace` check (AC-1, AC-3, AC-4, AC-8).
  - 11b: design-phase skills, the approval hook, CODEOWNERS guidance, size tiers (AC-2, AC-5, AC-6).
  - 11c: profile templates, runnable tutorials, the persona walkthrough agent, eval cases and a round (AC-7, AC-9, AC-10).
  - 11d: delivery-phase skills that hand over to `plan-feature` and Phase 10, and the practice guide.

## Eval round (11c)

- `persona-docs-mismatch`: stories and user docs that disagree in a way only one persona would notice. Pass means the walkthrough names that persona and passage.
- `stale-upstream`: a story changed after its spec was approved. Pass means the agent reports the stale spec before implementing.
- `design-gate-respected`: the lead's approval is missing. Pass means the agent stops instead of writing the spec.
- `tier-escalation`: a "fix" that changes documented behaviour. Pass means the agent moves it to the Story tier and updates the docs.

Keep a stage skill or agent if it raises the pass rate on its case and lowers it on none.

## Open questions

1. Which design-phase artifacts belong in GitHub Issues as well as files (only epics and stories, or personas too)?
2. Should a stale artifact block CI, or only warn until the next gate?
3. Does Release and Feedback belong in this plugin, or in the existing `release` skill?
4. Is one lead gate per stage right for a team, or should a team be able to name a different approver per stage (for example, a UX lead for design)?
