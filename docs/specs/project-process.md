---
status: draft
tests-commit: [1f67328ed21ed9f55811bcebd3ae545b9c8987ed, f3f2066cbb3a2070061147c723581c684974c449, 51f89fb172cd3527cd7fb94697184d8d18d30c88, 043f277ba18537380b7d62d20bf664621ab74cf8, e41896af8c44a939d674b60337672de413eee6c3, c59346967309205158322e9d1e1e364fba99bf52, 82d6f7de2c54b7b334e466c42aa034ec0900c0fb, 96a0855ce23e78b40af7c7e3ec2e95dd8d8391d1, ebd561f5e43f13211e0c7712accada96bb13f772, 21eb11cd3f99f77e81e81b14ae95315edc6346f3, 2304e60d1dabd0307b3eb4528b55081d1efafaee, cd9940d18a56042b3f6c704ceb89c7429d406466, 1fdd76a90d1c0dc3754565761098680c7ed7b7aa, bfaa5dc01c5b305d3d246ff29eeaa0f816732e30, fffd27a033cf46bf47fcb9aad79f10fed00dd72a, fa5eb980bbea3ddf35f3caf3faad50cb29b865ef, 1976536227cf3d45b2227e57bb99cb523f38163d, e1b077853beb2c5e3ed189d0a9c5bef6586b0a15, 73d79a2682eaa6e1894265271989bd78faa115ef, 5436e9ec7919fb15cd13f590acab1db032b52972, e5aa497fb289c5292bb46659fbcc4e99a033695c]
unlocks:
  - test/process-pilot-fixes.test.mjs: deleted; its AC-28 test moved, unchanged, to test/process-links.test.mjs (rewrite plan 25e, verify inventory: files named after a pilot round fold into files named by behaviour)
  - test/process-pilot-round2.test.mjs: deleted; its tests moved, unchanged, to test/process-roles.test.mjs (AC-29), test/process-design-names.test.mjs (AC-30), test/process-check-messages.test.mjs (AC-31), and test/process-links.test.mjs (AC-32) (rewrite plan 25e, verify inventory)
  - test/process-pilot-round3.test.mjs: deleted; its AC-30 test moved, unchanged, to test/process-design-names.test.mjs (rewrite plan 25e, verify inventory)
  - test/process-pilot-round4.test.mjs: deleted; its AC-34 tests moved, unchanged, to test/process-links.test.mjs (rewrite plan 25e, verify inventory)
  - test/process-pilot-round5.test.mjs: deleted; its tests moved, unchanged, to test/process-links.test.mjs (AC-35), test/tutorial-previews.test.mjs (AC-36), and test/process-mutation.test.mjs (AC-37) (rewrite plan 25e, verify inventory)
  - test/process-pilot-round6.test.mjs: deleted; its AC-38 tests moved, unchanged, to test/process-links.test.mjs (rewrite plan 25e, verify inventory)
  - test/process-pilot-round7.test.mjs: deleted; its AC-40 test moved, unchanged, to test/process-check-messages.test.mjs (rewrite plan 25e, verify inventory)
  - test/process-pilot-round9.test.mjs: deleted; its AC-44 and AC-45 tests moved, unchanged, to test/process-workflow.test.mjs (rewrite plan 25e, verify inventory)
  - test/process-workflow.test.mjs: the AC-44 and AC-45 tests from test/process-pilot-round9.test.mjs are appended, unchanged, with the inputs constant they use; the existing tests are unchanged (rewrite plan 25e, verify inventory)
  - test/process-pilot-round10.test.mjs: deleted; its AC-49 and AC-50 tests moved, unchanged, to test/tutorial-controls-viewport.test.mjs (rewrite plan 25e, verify inventory)
  - test/process-xr-round1.test.mjs: deleted; its tests moved, unchanged, to test/process-stages.test.mjs (AC-41) and test/process-markers.test.mjs (AC-42) (rewrite plan 25e, verify inventory)
  - test/process-xr-round2.test.mjs: deleted; its AC-43 tests moved, unchanged, to test/process-links.test.mjs (rewrite plan 25e, verify inventory)
  - test/process-xr-round3.test.mjs: deleted; its tests moved, unchanged, to test/process-markers.test.mjs (AC-46) and test/process-github-retry.test.mjs (AC-48) (rewrite plan 25e, verify inventory)
  - test/process-11g.test.mjs: deleted; its tests moved, unchanged, to test/process-docs-lint.test.mjs (AC-23), test/process-mutation.test.mjs (AC-24), and test/tutorial-previews.test.mjs (AC-33) (rewrite plan 25e, verify inventory)
  - test/feedback-round1.test.mjs: deleted; its AC-51 tests moved, unchanged, to test/tutorial-first-step-timeout.test.mjs, which covers the same behaviour (rewrite plan 25e, verify inventory)
  - test/tutorial-first-step-timeout.test.mjs: the AC-51 tests from test/feedback-round1.test.mjs are appended, unchanged, with their own server (renamed slowServer so the two servers do not clash); the existing tests are unchanged (rewrite plan 25e, verify inventory)
  - test/process-codeowners.test.mjs: AC-9 amended (rewrite plan 25e, 2026-11-12, decision D5: one path): solo mode gets the same CODEOWNERS block as team mode, which the GitHub gate needs, so the test that solo mode skips becomes one that it writes the block and matches the gate's; the other AC-9 tests are unchanged
  - test/process-approvals.test.mjs: deleted; AC-5 and AC-6 retired with the approvals job's review and merge checks (rewrite plan 25e, 2026-11-12, the maintainer's answer to the verify inventory's question 2)
  - test/process-tier.test.mjs: deleted; AC-10 retired with the tier job (rewrite plan 25e, 2026-11-12, the maintainer's answer to the verify inventory's question 1); matchGlob moved to the change check
  - test/process-tier-inference.test.mjs: deleted; AC-54 retired with the tier job (rewrite plan 25e, 2026-11-12)
  - test/process-pilot-fixes.test.mjs: AC-27 retired with the tier job (rewrite plan 25e, 2026-11-12), so its two tests and imports go; the AC-28 test is unchanged
  - test/process-pilot-round6.test.mjs: AC-39 retired with the tier job (rewrite plan 25e, 2026-11-12), so its two tests and import go; the AC-38 tests are unchanged
  - test/process-xr-round3.test.mjs: AC-47 retired with the solo-mode merge audit (rewrite plan 25e, 2026-11-12), so its three tests go; AC-48's approvals test now exercises the retry on the notify path, the job's one remaining call after a merge; the AC-46 and sync tests are unchanged
  - test/process-gate-types.test.mjs: AC-56 amended (rewrite plan 25e, 2026-11-12): an approve stage passes the job with no API call, solo mode checks an agent stage on the pull request as well as after the merge, and a review event is checked like a pull request event; the AC-55 and AC-57 tests are unchanged
  - test/process-11g.test.mjs: AC-24 amended (rewrite plan 25e, 2026-11-12): the mutation job needs the change job and runs on its kind `feature`, in place of the tier output; the other assertions are unchanged
  - test/process-gate-types.test.mjs: AC-58 retired with the merge guard (rewrite plan 25e, 2026-11-12), so its test and the guard-merge import go; the AC-55 to AC-57 tests are unchanged
  - test/process-guard-merge-instruction.test.mjs: deleted with the merge guard (rewrite plan 25e, 2026-11-12); AC-52 is retired
  - test/process-guard-merge-automerge.test.mjs: deleted with the merge guard (rewrite plan 25e, 2026-11-12); AC-53 is retired
  - test/process-trace.test.mjs: AC-63 (2026-11-12) makes every delivery stage required unless waived, so a spec in a process project with no id now fails, and a spec that derives straight from a story while its design and user documentation are drafts fails the stage order; the two tests expect those errors
  - test/process-trace.test.mjs: link rule 8 (AC-21, amendment approved 2026-11-01) requires an approved story to say who it is for, what they want, and why, and to have acceptance criteria; the fixture's stories gain a benefit and a criterion, and nothing else changes
  - test/process-plain-specs.test.mjs: AC-7 retired with the merge guard (rewrite plan 25e, 2026-11-12), so its merge-guard case and import go; the AC-5 case is unchanged (before that, the same AC-7 change made its merge-guard case expect no ask instead of no deny)
  - test/process-guard-merge.test.mjs: AC-7 changed from blocking to asking (lead's decision, 2026-11-01, after pilot entry 18); the tests expect an ask decision instead of a deny, and nothing else changes
  - test/process-tutorials.test.mjs: AC-32 (pilot round 2) makes the persona starters link to concept#audience, as the concept template's sections allow; the fixture's concept gains an Audience section, and nothing else changes
  - test/process-codeowners.test.mjs: AC-41 (Agentic XR Pipeline feedback, 2026-11-05) adds the optional discovery stage, which has its own CODEOWNERS entry; the expected block gains the line /docs/product/discovery/ between the concept and the requirements, and nothing else changes
  - test/process-tutorial-record.test.mjs: the "without record" test also counted every entry in the shared temp folder, which other test files running in parallel write to, so it failed at random in CI (seen on #108, reproduced locally by creating temp folders during the run); that count is removed, and the test still checks that a run without --record returns no artifacts
  - test/process-11g.test.mjs: AC-23's Vale test compared the linted folders as path.relative output with forward slashes, so it failed on Windows (improvement plan 18b, 2026-11-10); the folders are compared with separators normalised, and the expected list and every alert check are unchanged; AC-24 with AC-54 (2026-11-10, process plan 23f): the mutation job runs by the tier job's output, so the test reads `tier == 'story'` and `tier == 'epic'` in its condition instead of the label names
  - test/process-tier.test.mjs: AC-10 amended 2026-11-10 (process plan 23f): the tier is inferred from the changed paths, so a pull request with no tier label passes at the inferred tier instead of failing; the cases for two labels, unknown tiers, and each path rule are unchanged, and a label lower than the paths imply fails
  - test/process-pilot-fixes.test.mjs: AC-27 amended 2026-11-10 (process plan 23f): with the tier inferred, a later change to process.yml passes at tier story (it is under docs/product/), and the label wait and its EVENT_ACTION input are removed, so their tests go; the adoption and label-creation cases are unchanged
  - test/unreal-tutorial-demo.test.mjs: AC-25's check that the demo scripts are valid Python ran `python3`, which a python.org install on Windows does not provide (the name reaches the Microsoft Store stub), so it failed on Windows machines with Python installed (2026-11-11); it now uses the first of `python3`, `python`, and `py -3` that runs, and fails saying so when none does; the parse check and every assertion are unchanged
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

Not every change goes through every stage. The tier decides where a change starts. A pull request that changes source must belong to a feature with an approved spec, or say `Change: fix` or `Change: trivial` at the end of a commit message; the `process / change` check holds it to that claim (a fix changes a test and adds no source file; a trivial change adds no source file and touches no `public-api` path). (Amended 2026-11-12, rewrite plan 25e: the tier check, which inferred a tier from the paths or read a `tier:` label, is retired, and so are the labels.)

| Tier | Example | Stages | What CI holds it to |
|---|---|---|---|
| Trivial | Typo, dependency bump, internal refactor with no behaviour change | Implementation, regression tests | `Change: trivial`: no source file added, and no path listed under `public-api` in `process.yml` changed |
| Fix | A bug: behaviour that differs from approved stories or docs, or, where none exist yet, behaviour the approver confirms is a bug in the issue | A test reproducing the bug, implementation, regression | `Change: fix`: a test changes, and no source file is added |
| Story | A new story inside an approved epic | Stories to demos; the design stage may be a short addendum to the epic's design | A source change needs the feature's approved spec |
| Epic | A new area of capability | All feature-level stages, and a review of whether requirements or personas change | A source change needs the feature's approved spec |

A change that alters documented behaviour is at least Story tier: its documents go through the gated stages, and its source change needs the approved spec.

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

**Gate types** (added 2026-11-10, process plan 23b). Each gated stage has a gate: `approve` (an approver decides, and the merge waits for them), `notify` (no approver; after the merge the person is told through the decision queue and can object, and an objection is an amendment under the normal staleness rules), or `agent` (an independent reviewer's review, recorded on the head commit, stands in for the approver). `gates:` in `process.yml` sets them per stage. Without it, a supervised project keeps `approve` for every stage, which is the behaviour this spec described before the amendment; a delegated project (`.claude/rfr.json` `"mode": "delegated"`) uses `approve` for the concept, design, user documentation, specs with approvers, tutorials, and release, and `notify` for discovery, requirements, personas, epics, and stories, which reach the person inside a brief or feature packet.

```yaml
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

- **`approve` stages.** For each gated stage whose artifacts' `status`, body, or recorded hashes change in the pull request, branch protection requires an approving review from one of that stage's approvers, through a CODEOWNERS block ([github-gate](github-gate.md)). A workflow opens each pull request as a GitHub App, so the approver can review it in solo mode as well as team mode, and agents do not approve or merge pull requests. (Amended 2026-11-12, rewrite plan 25e: before the gate, the job checked the review in team mode and, in solo mode, that an approver merged.)
- **`agent` and `notify` stages.** The job (`process-approvals`) requires an independent reviewer's recorded review for `agent` stages, on the pull request and again after the merge (AC-56), and opens a decision-queue issue for `notify` stages after the merge (AC-57).
- **Plan limits.** Required reviews and required status checks are not available for private repositories on GitHub Free, so nothing there can block a merge (rewrite plan D7).

A plugin hook warns when an agent edits `status` in a gated folder, as a convenience. It is not part of the enforcement.

### CODEOWNERS

A plugin script (`process-codeowners`) runs in the adopting repository and writes a managed block in `.github/CODEOWNERS` from `process.yml`, mapping each stage folder to its approvers. A CI step fails if the block differs from what the script would write. The block covers each `approve` stage with approvers, the same block the GitHub gate's setup script writes (github-gate AC-2); solo and team mode get the same block (amended 2026-11-12, rewrite plan 25e: the gate lets the approver review a pull request whoever opened it). This repository's `build/` is not involved: it renders this repository's template repos and never reads an adopting project's files.

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
| AC-5 | In team mode, the approvals job fails when a gated stage's artifacts change without an approving review from that stage's approvers on the current head, and passes with one. | retired 2026-11-12 (rewrite plan 25e): the approver's review is GitHub's: branch protection requires it on the gated folders ([github-gate](github-gate.md)), so the approvals job no longer checks reviews or merges. |
| AC-6 | In solo mode, the approvals job checks that the merge was by an approver of every gated stage touched, and opens an issue when it was not. | retired 2026-11-12 (rewrite plan 25e): the approver's review is GitHub's: branch protection requires it on the gated folders ([github-gate](github-gate.md)), so the approvals job no longer checks reviews or merges. |
| AC-7 | The plugin hook asks the person to confirm merge commands and the GitHub MCP merge tool for pull requests that touch gated folders (changed from blocking on 2026-11-01, after the pilot: the confirmation is how an approver's instruction to merge becomes a decision they made). | retired 2026-11-12 (rewrite plan 25e): the merge guard is removed; under the GitHub gate ([github-gate](github-gate.md)) the approver's review in GitHub is the approval, and no agent merges a gated pull request. |
| AC-8 | `process.yml` requires a `default`, rejects unknown stages, and supports `mode`, `public-api`, and `adoption-until`. | test: valid file, missing default, unknown stage, bad mode, and bad date. |
| AC-9 | `process-codeowners` writes a managed CODEOWNERS block from `process.yml`, and the drift step fails when the block differs. | test: written block for a team file; drift detected; solo mode writes the same block, which matches the gate's (amended 2026-11-12, rewrite plan 25e). |
| AC-10 | The tier check infers the tier from the changed paths: `tier:story` when the pull request changes `docs/product/`, `docs/design/`, or `docs/user/`; `tier:fix` when it changes another process artifact folder (tutorials, process specs) or a `public-api` path; `tier:trivial` otherwise. A tier label can raise the tier. It fails a pull request with a tier label lower than the paths imply, with two tier labels, or with an unknown tier. (Amended 2026-11-10, process plan 23f: a pull request with no label passes at the inferred tier.) | retired 2026-11-12 (rewrite plan 25e): the tier job is retired; the change job reads a `Change: fix` or `Change: trivial` claim from the commits (process-state AC-5 and AC-6), and the mutation job reads its kind. |
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
| AC-24 | The `web-app` and `static-site` profiles ship a Stryker configuration and an advisory `mutation` job: incremental on feature pull requests (amended 2026-11-12, rewrite plan 25e: the change job's kind `feature`, in place of `tier:story` and `tier:epic`), a full run when tests change, and the mutation score in the job summary. | test: the configuration and job structure; command: a Stryker run on the tutorial fixture's test project. |
| AC-25 | `examples/unreal/RfrSample` has a fixture tutorial followed by an automation test that cites it, a screenshot functional test of the editor step it covers, and a Movie Render Queue command that renders the tutorial's demo sequence; the Tier 2 workflow runs all three on the GPU runner and fails when the tutorial no longer matches. | Tier 2 workflow run (the Unreal half of AC-16). |
| AC-26 | The guide has a "recommended tools" section for each profile, each tool with its source, a pinned version or commit, and its security notes, and a section on installing third-party plugins and MCP servers safely. Every security claim cites a primary source. | Review against `docs/research/notes/third_party_tools_for_process.md`. |
| AC-27 | The tier job creates the four `tier:` labels if they are missing, with a colour and description, and lets the pull request that adds `docs/product/process.yml` through without a tier, because adopting the process fits no tier. (Amended 2026-11-10, process plan 23f: the wait for a label on a newly opened pull request is removed, since a missing label no longer fails.) | retired 2026-11-12 (rewrite plan 25e): the tier job is retired; the change job reads a `Change: fix` or `Change: trivial` claim from the commits (process-state AC-5 and AC-6), and the mutation job reads its kind; there are no tier labels to create. |
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
| AC-39 | The tier job reads the pull request's current labels from GitHub on every run, so re-running a failed tier job after changing the label uses the new label, not the one recorded in the original event. | retired 2026-11-12 (rewrite plan 25e): the tier job is retired; the change job reads a `Change: fix` or `Change: trivial` claim from the commits (process-state AC-5 and AC-6), and the mutation job reads its kind; no labels are read. |
| AC-40 | When an approved artifact is set back to draft without a withdrawn entry, the message also says that an amendment keeps `approved` (the gated merge approves it) and that `draft` with a reason and an issue is only for withdrawing it. | test: the rule 7 message names both choices. |
| AC-41 | An optional discovery stage sits between the concept and the requirements: files in `docs/product/discovery/` are gated artifacts with their own approver key (`discovery`) and CODEOWNERS entry, and requirements can link to their sections. | test: the stage is recognised and ordered, `process.yml` accepts it, and a requirements file linking to an approved discovery section passes. |
| AC-42 | Three markers record what is not settled in an artifact: `[open]` (a question for the approver), `[assumed]` (an assumption made without the approver's answer), and `[proposed]` (text the agent proposed, not yet accepted). The process check lists them per artifact, ignoring HTML comments and code, and warns when an approved artifact still contains one. | test: markers in a draft are listed with their line, markers in comments and code are not, and an approved artifact with a marker gets a warning that names it. |
| AC-43 | The process check warns when an approved artifact in `docs/product/` links, with a relative Markdown link, to a Markdown file that exists but is not a process artifact (notes, drafts kept outside the stage folders), because approval cannot cover what that file says. Links in HTML comments and code, links to process artifacts, and web addresses are not reported. | test: an approved requirement linking a plain notes file is warned about; a link to an artifact, a web address, a link in a comment, and the same link in a draft are not. |
| AC-44 | The reusable process workflow takes an optional `typecheck` input, a command such as `npm run check`; when it is set, a `typecheck` job installs the project and runs the command on every pull request, and fails when the command fails. | test: the input exists, the job runs only when it is set, and the command reaches the job through an environment variable, not inline expression text. |
| AC-45 | The reusable process workflow takes an optional `install-dirs` input, a space-separated list of folders with their own `package.json`; the `mutation` and `typecheck` jobs run `npm ci` in each after the root. | test: the input exists, and both jobs install each listed folder after the root. |
| AC-46 | A fourth marker, `[to validate]`, records a detail the approver accepts as a working assumption to check later (a persona detail with no interview behind it yet). The process check lists it with the other open items and does not warn when an approved artifact has it; the warning for the other markers no longer suggests rewording them as settled text. | test: an approved artifact with `[to validate]` gets no warning and its items are listed; the warning for `[assumed]` does not suggest rewording. |
| AC-47 | In solo mode, when GitHub's commit-to-pull-request lookup returns nothing for a merge, the approvals job reads the pull request number from the commit subject ("Merge pull request #N", or "(#N)" at the end of a squash commit) and accepts that pull request only if GitHub reports it merged with this commit as its merge commit; the merger is then checked against the approvers as usual. | retired 2026-11-12 (rewrite plan 25e): the approver's review is GitHub's: branch protection requires it on the gated folders ([github-gate](github-gate.md)), so the approvals job no longer checks reviews or merges; the solo-mode merge audit that read the merge subject is removed. |
| AC-48 | The approvals and issue sync jobs retry a GitHub API call that fails with a server error (HTTP 500 to 504) twice, after a short wait, before treating it as a failure. | test: one 502 or 500 followed by success passes; a server error on every attempt still fails. |
| AC-49 | When a tutorial step clicks a control found by its text, the runner chooses a visible element, so a hidden copy of the control (for another screen size) is not picked. | test: a page with a hidden and a visible control of the same name passes the click step. |
| AC-50 | A web tutorial can name its browser size in front matter (`viewport: 390x844`), so a phone-sized tutorial runs at that size; without it the runner keeps its default. | test: a tutorial with a viewport sees the page at that width; a malformed viewport is an error. |
| AC-51 | The first page a web tutorial opens gets a longer load timeout than the other steps (30 seconds), so a cold preview deployment does not fail step 1; later steps keep the step timeout. The rest of the step that opens it gets the same timeout, because a cold page can finish loading and still render late. (Amended 2026-11-10: the checks after the first page in step 1 kept the step timeout, which failed on a slow Windows runner; `firstLoadTimeout` was never an option and is dropped from the text.) | test: a page that answers after longer than the step timeout opens as the first step; the same delay on a later page fails; text that appears after the step timeout on the first page is seen in step 1, and the same page in step 2 fails. |
| AC-52 | The merge hook does not ask when the person's latest message typed in the session is an instruction to merge that covers this pull request: it names the pull request, or names none and was given after the pull request was opened. It still asks when the instruction names another pull request, when the person has typed anything else since, for negated instructions and questions, for text that reached the session any other way (tool results, notifications, other sessions), and when the transcript or the pull request's opening time cannot be read. Amended 2026-11-12: an instruction that names no pull request also covers one the session itself opened after it ("fix it, open a PR, and merge when green"), shown by the transcript's call that created it; and where there is no `gh` (cloud sessions), the hook lists the pull request's files by fetching its head with git. | retired 2026-11-12 (rewrite plan 25e): the merge guard is removed; under the GitHub gate ([github-gate](github-gate.md)) the approver's review in GitHub is the approval, and no agent merges a gated pull request. |
| AC-53 | The merge hook treats turning on auto-merge as a merge (the GitHub MCP auto-merge tool, the REST auto-merge route, `gh pr merge --auto`, and GraphQL merge or auto-merge mutations, which it asks about because it cannot tell which pull request they name), and does not treat read-only calls (a `GET` of `.../pulls/N/merge`) or turning auto-merge off as merges. | retired 2026-11-12 (rewrite plan 25e): the merge guard is removed; under the GitHub gate ([github-gate](github-gate.md)) the approver's review in GitHub is the approval, and no agent merges a gated pull request. |
| AC-54 | The tier job reports the tier it settled on as a job output, and the advisory mutation job runs on story and epic pull requests by that output, so an unlabelled pull request that changes user documentation is mutation-tested. (Added 2026-11-10, process plan 23f.) | retired 2026-11-12 (rewrite plan 25e): the tier job is retired; the change job reads a `Change: fix` or `Change: trivial` claim from the commits (process-state AC-5 and AC-6), and the mutation job reads its kind (AC-24). |
| AC-63 | Every delivery stage is required unless `process.yml` waives it, ahead of time, with a reason: `waived:` maps `design`, `user-docs`, or `specs` to a sentence saying why the project does not need it. The process check fails an artifact that does not derive from an artifact of the nearest earlier stage that is not waived: a design from stories, user documentation from a design, a spec or a tutorial from user documentation. In a process project, a spec without an id fails, unless specs are waived. (Added 2026-11-12, after a project's agent wrote a spec and code straight from stories, skipping design and user documentation: feedback #204. The maintainer: "Every stage is required unless deliberately waived ahead of time. The development process is what matters most.") | test: the upstream stage for each stage, with and without waivers; waiver parsing and rejection; a spec straight from stories fails; a spec with no id fails unless specs are waived. |
| AC-64 | In the session, rfr-process refuses writing a design, user documentation, a spec, or a tutorial whose `derived-from` links no approved artifact of the stage it requires (AC-63), with a reason that names the stage to write and get approved first, and tells the agent not to waive the stage itself. Nobody is asked. Files of a waived stage, other files, and projects without `process.yml` are not checked. For a spec or a tutorial, where delivery starts, approval is read from the remote default branch, as the process state reads it (process-state AC-3): an artifact new or changed in the working tree counts with the status its default-branch version has, so user documentation set to `approved` only in this branch does not open delivery, and an amendment keeps an approval already given; with no default branch to read, the working tree's status counts. A design or user documentation, written inside a feature packet, derives from the stage before it as proposed in the same branch. (Amended 2026-11-12, rewrite plan 25e.) | test: a spec from stories, from draft and from approved user documentation; a design and user documentation; a waived stage; a source file; a project without the process; for a spec, user documentation approved on the default branch, approved only in the branch, added in the branch as approved, and amended in the branch; a design from a story proposed in the same branch. |
| AC-55 | `process.yml` accepts `gates:` mapping a stage to `approve`, `notify`, or `agent`, and rejects an unknown stage or type. Without `gates:`, every stage is `approve` in supervised mode, and in delegated mode (`.claude/rfr.json`) the concept, design, user documentation, specs, tutorials, and release are `approve` and the other stages `notify`. An explicit entry wins over the mode's default. (Added 2026-11-10, process plan 23b.) | test: parsing and rejection; the default gate for each stage in each mode; an explicit entry overriding it; the working mode read from `.claude/rfr.json`, and supervised when the file or field is missing. |
| AC-56 | For `agent` stages the approvals job requires a pull request comment `<!-- rfr-agent-review head=<sha> -->` naming the head commit, on the pull request in solo and team mode alike, and reports one that is missing or names an older commit. After the merge it checks the merged pull request's head the same way and opens a `process-approval` issue when the review is missing. It does not check `approve` stages, whose approver's review branch protection requires, or `notify` stages. (Added 2026-11-10, process plan 23b; amended 2026-11-12, rewrite plan 25e: approve stages and the solo-mode merger check left the job.) | test: an `agent` stage passes with the marker on the head and fails without it or with it on an older commit, on pull request and review events, in team and solo mode; after the merge, a missing review opens an issue; an `approve` stage makes no API call. |
| AC-57 | After a merge to the default branch that changed a `notify` stage, the approvals job opens one decision-queue issue (label `needs-lead`) naming the pull request, the stages, and the files, with "keep them" as the default taking effect in two days and "object" as the other option. (Added 2026-11-10, process plan 23b.) | test: the issue's label, options, default, and the files listed; no issue when no `notify` stage changed. |
| AC-58 | The merge guard asks only for pull requests that touch an `approve` stage. (Added 2026-11-10, process plan 23b.) | retired 2026-11-12 (rewrite plan 25e): the merge guard is removed; under the GitHub gate ([github-gate](github-gate.md)) the approver's review in GitHub is the approval, and no agent merges a gated pull request. |
| AC-59 | `checks/process-packet.mjs` builds the review packet for the process artifacts a pull request changes: every `[open]` marker first, then every `[assumed]` marker, each with its file and line; the persona walkthrough's `blocks` and `misleads` findings, each with what was done about it or "not yet addressed"; the mock-ups and recordings the artifacts link; and the artifacts with their stage and status. Markers in code and comments are left out, as in the process check. (Added 2026-11-10, process plan 23c.) | test: a feature packet fixture gives the sections in that order, the right file lines, `slows` findings left out, and the media resolved to repository paths; the command line needs `--base`. |
| AC-60 | The guide and the `bootstrap` and `setup` skills describe the batched interview (every question at once, each with a proposed answer, unanswered ones drafted as `[assumed]`), the product brief (concept to epics in one pull request, after the consistency and persona passes), the feature packet (story, design with mock-ups, and user documentation in one pull request), and the review packet at the top of each. (Added 2026-11-10, process plan 23c.) | test: the guide's design part and both skills name each of the four; a smoke case runs `bootstrap` and checks it asks its questions in one batch with proposed answers. |

| AC-61 | The review packet lists the persona walkthrough's mismatches (tutorial steps the product did not match, each reported as `- **Mismatch:**`) before its `blocks` and `misleads` findings, each with what was done about it, and gives the number of `slows` findings it leaves out instead of dropping them without a word. (Added 2026-11-11, process plan 23l.) | test: a report with a mismatch, a `blocks` finding, and two `slows` findings gives the mismatch first, then the `blocks` finding, then a line counting two `slows` findings, with none of their text; a `- **Done:**` line under a mismatch belongs to the mismatch; a report with neither adds no lines. |
| AC-62 | `checks/process-rework-report.mjs` reads a repository's first-parent git history, offline, and reports for each stage the artifacts approved, the amendments (a change to the body of an approved artifact), the late amendments (an amendment to an artifact that an approved stage 8 spec derived from at the time, directly or through other artifacts), and the withdrawals and removals; and how many approved specs had an upstream artifact amended late. Each merge to the default branch counts once, with its pull request number. Its JSON holds pull request numbers, stages, dates, and counts, with no ids, file names, or text. (Added 2026-11-11, process plan 23l.) | test: a fixture repository with an amendment before any spec, a late amendment two links up, a whitespace-only edit, a hash re-record, and a rename (none of the three counts), a withdrawal, a spec amendment, and a merged branch with two commits counted once; the JSON has no ids or file names. |

## Scope

- In: `plugins/process/` (setup, relink, CODEOWNERS, status, release check and notes, triage, and bootstrap skills; the merge-blocking and status-warning hooks; per-profile templates; the `persona-walkthrough` agent); `checks/process-trace.mjs`, the approvals, tier, and sync scripts, and their tests; reusable workflows that adopting repos call, like `rfr-guards.yml`; the `validate:plugins` script extended to the new plugin; `plugins/process/GUIDE.md`; eval cases.
- In (amendment, approved 2026-11-01): the tutorial recorder, link rule 8, the Project board sync, the Vale style and `docs-lint` job, the Stryker configuration and `mutation` job, the Unreal fixture and Tier 2 additions, and the recommended-tools guide.
- Out: changes to `rfr-core`; trackers other than GitHub; a MUST rule before evals support one; design-stage skills before an eval shows they beat the guide. (Amended 2026-11-10, process plan 23b: "automating the approvers' decisions" is no longer out of scope. A stage can be gated `notify` or `agent`, so the person decides only where the gate is `approve`. In supervised mode every gate stays `approve`, as before.)

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
  - Pilot fixes, round 9: AC-44, AC-45, spec-test-traceability AC-13, and the guide changes under "Pilot findings: round 9".
  - Agentic XR Pipeline feedback, round 2: the setup changes under "Project findings: Agentic XR Pipeline, round 2".
  - Feedback #130 to #132, round 1: AC-51 (cold preview first load), and the preview workflow's browser install and job timeout.
  - Pilot fixes, round 10: AC-49, AC-50, spec-test-traceability AC-14 and AC-15, and the guide changes under "Pilot findings: round 10".
  - Agentic XR Pipeline feedback, round 3: AC-46 to AC-48, and the guide changes under "Project findings: Agentic XR Pipeline, round 3".
  - Pilot fixes, round 6: AC-38, AC-39, and the template, agent, and guide changes under "Pilot findings: round 6".
  - Pilot fixes, round 5: AC-35 to AC-37, and the template, agent, skill, and guide changes under "Pilot findings: round 5".
  - Pilot fixes, round 4: AC-34, and the guide changes under "Pilot findings: round 4".
  - Pilot fixes, round 3: the AC-30 warning wording, and the guide, template, and agent changes under "Pilot findings: round 3".
  - 11h: the Unreal tutorial fixture, screenshot functional test, and demo render on the Tier 2 GPU runner (AC-25, and the Unreal half of AC-16).
  - 23l: the rework report and the packet's mismatches and `slows` count (AC-61, AC-62), under "Amendment: rework and the packet's minor findings".

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

## Amendment: rework and the packet's minor findings (approved 2026-11-11)

Two ideas from Anthropic's [AI-native SDLC playbook](https://claude.com/resources/articles/the-ai-native-sdlc-playbook) (August 2026), approved by the project lead on 2026-11-11 as process plan 23l:

1. **Measure what happens after approval.** Each play in the playbook names indicators that can be read from git history, including requirements rework after build starts. The gate report (23a) measures what an approval costs and whether it changed anything at the pull request; it cannot say whether intent was right when approved. The process rests on the claim that reviewing user documentation before the spec finds misalignment while it is cheap. A late amendment, an approved artifact changed after a spec built on it was approved, is the case that claim says should be rare. The rework report counts them per stage from the history alone (AC-62), so 23g can weigh a stage's rework as well as its wait before demoting its gate.
2. **Count minor findings, do not list them.** The playbook's review file keeps "Important" for findings that break behaviour or breach policy, reports a few nits, and summarizes the rest as a count. The review packet already leaves out `slows` findings; it now says how many it left out, and it lists the walkthrough's mismatches with the product, which are facts and were not in the packet at all (AC-61). The walkthrough still reports every finding (AC-19).

## Pilot findings

What the pilots found, round by round, and why each criterion from AC-27 on was added, is in [docs/research/pilots/kettlebird.md](../research/pilots/kettlebird.md) and [docs/research/pilots/agentic-xr-pipeline.md](../research/pilots/agentic-xr-pipeline.md) (moved there on 2026-11-10, process plan 23j).

## Open questions

None blocking. The items listed under "APIs and assumptions" are confirmed in 11a.
