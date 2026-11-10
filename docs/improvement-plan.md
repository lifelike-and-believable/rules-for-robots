# Improvement plan (2026-11-10)

Status: proposed. Nothing here is decided until the maintainer approves it. Once approved, the first slice adds Phases 18 to 22 to `PLAN.md`, and each slice below lands as its own branch and pull request.

## Why

An assessment of the repository on 2026-11-10 found four things.

1. Three of 55 rules have eval evidence (TEST-001, WA-002, TEST-004). The rest are a mix of project facts, text beside a CI check, and behavioural advice the 5.5 models follow without being told.
2. Phases 10 to 16 built their machinery, and their eval slices (10c, 13d, 14b, 15e) have not run.
3. `npm run verify` does not pass on Windows, and CI runs on Ubuntu only.
4. The process and the working agreement stop for the maintainer in places where the maintainer adds nothing, which works against the goal below.

## Goal this plan serves

rules-for-robots lets one person direct agents that produce high-quality, usable, maintainable work, and that run on their own for long stretches. The person is needed for three things: intent, taste, and accepting risk that cannot be undone (money, publication, shared data). Everything else is verification, which agents do with evidence and the person audits afterwards.

The measure is the maintainer's minutes, and the hours work sat blocked, per merged story. Nothing records that today, so the first delegation slice adds it.

## Decisions the maintainer makes first

Each has a recommended answer. The slices assume the recommendation.

| # | Decision | Recommendation |
|---|---|---|
| D1 | Two working modes, supervised and delegated, chosen per project | Yes. Supervised keeps today's stop-and-ask rules. Delegated replaces them with decide, record, and continue. |
| D2 | Which process gates stay with a person | Three: the concept, one design review (user documentation with its design), and the demo. Release stays a confirmation because it is public. |
| D3 | Gates block or run asynchronously | Asynchronous in delegated mode: work continues on a branch and is reworked if the approver rejects. |
| D4 | `tech-lead` | Retire. The October round found no difference from the main session. |
| D5 | `software-architect` | Keep as experimental until the Fable 5.2 round, then decide on quality against cost. |
| D6 | `rfr-process` | Freeze new features except the gate changes in Phase 19. Decide on a separate repository before going public. |
| D7 | Minimum Claude Code version | Raise to 2.1.295 so guards can fail closed (`onFailure: "block"`). |
| D8 | Eval budget for Phase 21 | A cap of $150, spent in the order listed there, stopping when a result changes the plan. |

## Phase 18: Housekeeping and triage (no paid runs)

### 18a: Status documents

Branch `phase-18/status-docs`.

- `README.md`: replace the pre-1.0 status line with the current version and state.
- `PLAN.md`: correct the status line, mark Phases 10 to 16 with their real state, prune section 14 to open items, and add Phases 18 to 22 from this document.
- `checks/plan.mjs`: fail when the status line's version differs from `plugins/core/.claude-plugin/plugin.json`, and when a phase heading says "planned" while every slice under it is marked done.
- Acceptance: `npm run check:plan` fails on the current `PLAN.md` and passes after the edit. Tests in `test/plan.test.mjs`.

### 18b: Verify on Windows

Branch `phase-18/windows-verify`.

- `checks/ci/install-vale.mjs`: pin the `win32-x64` archive by SHA-256, or skip with a warning when no archive is pinned and Vale is not on the PATH, so the chain continues.
- `checks/ci/instruction-lint.mjs` or `AGENTS.md`: stop failing on `.cache/`, which exists only after Vale installs.
- `.github/workflows/verify.yml`: add `windows-latest` to a matrix.
- Fix the tests that fail on Windows. On 2026-11-10, 28 of 654 failed locally. Some were missing local dependencies (Playwright); the `rm -rf`, snapshot, and guard-replay tests need reading one by one.
- Acceptance: the verify workflow is green on both runners.

### 18c: Classify the rules

Branch `phase-18/rule-kinds`.

- `docs/rule-format.md` and `checks/lint-rules.mjs`: a required `kind` field with three values.

| Kind | Meaning | Evidence it needs |
|---|---|---|
| `behaviour` | Changes how the agent works (TEST-001, WA-002, TEST-004) | An eval result in `evals/ledger.json`, or a recorded field observation |
| `fact` | A project decision or version trap the agent cannot infer (Fab descriptor rules, Next.js 16 defaults) | A source, and a `review-by` date |
| `invariant` | Text beside a hook or CI check that does the enforcing (WEB-001, FAB-004, TS-001) | The check; no eval |

- Classify all 55 rules. The lint requires `review-by` on `fact` rules and warns when the date has passed.
- Report: `node checks/model-ledger.mjs report` lists `behaviour` rules with no evidence. That list is the input to Phase 21.
- Acceptance: lint passes; the report prints the list.

### 18d: Demote what the models already do

Branch `phase-18/demote-known`. Depends on 18c.

- Candidates, to confirm by reading each body: CODE-001 to CODE-004, GIT-001, DOC-001, SEC-002, TEST-003. The saturated controls (`scoped-fix`, `configurable-retry`, `dirty-tree`) are the evidence.
- For each: move the advice into the practice guide it links to, retire the ID, and record it in the changelog (a major version under `docs/maintenance.md`).
- Keep any rule the maintainer has seen fail in a pilot; record that observation in `observed-on`.
- Acceptance: `npm run verify`; the always-on line count in the template repos falls.

## Phase 19: Delegated work

### 19a: Measure the person's time (do this first)

Branch `phase-19/attention-metric`.

- Extend the guard decision log into an attention log. Record each event that waits on a person: guard asks (already logged), process gates (opened, decided, changed or unchanged), merge prompts, and questions the agent asks.
- `checks/guard-report.mjs` gains a section: waits per merged pull request, total blocked time, and, per gate, the share approved without changes.
- Run it over the Kettlebird pilot's history to get a baseline before anything else in this phase changes.
- Acceptance: tests for the new log lines and the report; a committed baseline under `evals/results/`.

### 19b: Decide, record, continue

Branch `phase-19/delegated-agreement`.

- New rule files that replace WA-002, WA-003, and WA-004 in delegated mode, following principle 7 (layers replace whole files). Drafts go to `evals/candidates/` with `replaces:` until 21a passes.
  - WA-002 delegated: leave a test or task that looks wrong untouched, record why in the decision log, park that item, and continue with the remaining work.
  - WA-003 delegated: stop only for actions that cannot be undone or reach outside the project. For a material change of scope, choose, record the choice and the alternative, and continue.
  - WA-004 delegated: when a better approach exists inside the approved story or epic, take it and record it. Outside it, file an issue.
- A decision log: a `## Decisions` section in the pull request description, one line each for assumptions made, alternatives rejected, and items parked. `templates/repo-files/common/` gains it in the pull request template; `review-pr` reads it.
- `.claude/rfr.json` gains `"mode": "supervised" | "delegated"`; `install-rules` installs the matching files.
- Acceptance: lint and build pass with both modes rendered; the template pull request form has the section.

### 19c: Decision queue

Branch `phase-19/decision-queue`. Depends on 19b.

- Questions that need the person go to one place instead of stopping the session: an issue labelled `needs-lead`, each with the options, the agent's default, and the date the default takes effect. Questions about irreversible actions carry no default.
- A skill, `/rfr-core:decisions`, lists open questions and applies the answers.
- Acceptance: unit tests for the queue script; a smoke case in `evals/agents/smoke.mjs`.

### 19d: Fewer gates, and gates that do not block

Detailed, with 19e and the process half of 19g, in [improvement-plan-process.md](improvement-plan-process.md) (Phase 23), which replaces the outline below.

Branch `phase-19/async-gates`. Amends `docs/specs/project-process.md` with new acceptance criteria.

- `plugins/process/templates/process.yml`: a gate type per stage, `approve` (blocks), `notify` (the approver is told and can object), or `agent` (an independent reviewer approves). Delegated default: `approve` for concept, design, user documentation, demos, and release; `notify` for discovery, requirements, personas, epics, and stories.
- In delegated mode, delivery may start from a `draft` artifact on a branch. `checks/process-trace.mjs` allows it and marks the pull request as resting on unapproved artifacts; the existing stale-link check forces rework when the approver changes one. Merging to the default branch still needs the `approve` gates.
- `plugins/core/skills/plan-feature/SKILL.md`: remove the stop for spec approval when the spec derives from approved stories, matching the process's "agents may approve specs".
- At the demo gate, allow two or three working variants where the design left a real choice open, so the approver chooses between running things.
- Acceptance: tests for each gate type and for the draft-upstream path; the process guide updated.

### 19e: Demote gates by data

Branch `phase-19/gate-demotion`. Depends on 19a and 19d.

- The guards' rule, applied to gates: a gate approved without changes in at least 95% of 20 or more decisions is reported as a candidate for `notify`. The report proposes; the maintainer changes `process.yml`.
- Acceptance: report tests with fixture logs.

### 19f: Permissions for delegated sessions

Branch `phase-19/delegated-permissions`.

- A delegated permission set in `templates/repo-files/common/.claude/settings.json` and `install-rules`: pushes to branches other than the default, pull request creation and comments, and dependency installs. Force-pushes, shared databases, Vercel writes, releases, and public issues still ask.
- `test-change-guard` already flags test changes; add a pull request check that lists new dependencies, so CODE-004 is judged there.
- `practices/security-for-agentic-projects.md`: recommend a sandbox or cloud session for delegated mode, where the container is the boundary.
- Acceptance: `test/default-permissions.test.mjs` covers both sets.

### 19g: Work queue

Branch `phase-19/work-queue`. Depends on 19c.

- When an item is parked or waits on a gate, the agent takes the next issue in the approved epic. `rfr-process` issue sync already mirrors stories to issues; add a `ready` label and an order.
- Improvements the agent notices outside its lane become issues in the same queue instead of failing the tier check.
- Acceptance: tests for the selection script; a long-session eval case, `ls-park-and-continue` (see 21a).

### 19h: Preferences log

Branch `phase-19/preferences-log`. Depends on 19b.

Corrections the maintainer gives today live in a session or a review comment, so the same one can be needed again on the next feature. Part of why rfr projects needed fewer corrections over time is probably that their artifacts accumulated the maintainer's taste; this makes that explicit, with or without `rfr-process`.

- Template repos and `install-rules` add `docs/preferences.md`: one line per preference, grouped by area (interface, wording, code, tooling), each with its date and the request or review it came from. `AGENTS.md` gains one line: read it before design, interface, or documentation work, and add to it when the person corrects something.
- The delegated agreement (19b) includes the instruction: when the person corrects work, apply the correction, add or update the preference in the same pull request, and name it in the report. A preference that contradicts an older one replaces it.
- `ux-reviewer`, `persona-walkthrough`, and the `review-pr` checklist check changes against the log.
- A preference that applies to every file and fits in a line can move into `AGENTS.md`'s project decisions; the always-on budget still applies.
- Acceptance: the template and payload carry the file and the line; build and lint pass. Eval case `ls-repeat-correction`: a correction given in the first task of one session is applied without being repeated in a later task of a new session. Build and unit-test it; its paid runs wait.

## Phase 20: Consolidation

### 20a: Agents

Branch `phase-20/agents`.

- Retire `tech-lead` (D4). Remove it from the process review table.
- Add smoke cases for `ux-reviewer`, `test-change-reviewer`, and `software-architect`, so each has a ledger entry.
- Change the ledger verdict for agents and skills from `effective` to `smoke-pass` when the evidence is smoke cases with no baseline arm.

### 20b: Test-honesty layers

Branch `phase-20/test-honesty`. Depends on 21b.

- If the `test-change-reviewer` eval passes: make `testWeakening: defer` the default, and treat the in-session ask as the opt-in.
- Review whether the spec lock, the sabotage step, and the Stryker job all earn their place once the reviewer runs changed tests against old and new code. Keep the one that finds the most in 21c.

### 20c: One reviewer or five

Decided by 21d. If one checklist reviewer matches the specialists, keep `code-reviewer` and `security-reviewer` and fold the rest into the checklist.

## Phase 21: Targeted paid evals

Runs wait for approval, in this order, within the D8 cap. Costs marked "repo" come from estimates already in `evals/README.md` or the research notes; the others are rough, scaled from the baseline's $5.52 for 54 single-task runs, and long-session cases cost several times more per run.

| # | Question | Cases | Estimated cost |
|---|---|---|---|
| 21a | Does delegated wording keep the test-gaming result while the session continues? | `green-at-all-costs` with the 19b candidates; new `ls-park-and-continue` (four tasks, one with a wrong test) | $10 to $20 (rough) |
| 21b | Can `test-change-reviewer` approve test changes without the lead? (13d) | As specified in `docs/specs/test-change-review.md` AC-11 | Not yet estimated; price one cell first |
| 21c | Spec traceability, and Stryker against the sabotage step (10c) | The 55-run plan in `evals/README.md` | $20 to $30 (repo) |
| 21d | Specialist reviewers against one reviewer, with `/code-review` as an outside baseline | Golden-finding cases, as in the research note's item 4 | $20 to $40 (rough) |
| 21e | Behaviour rules with no evidence after 18d | Single-rule ablations, five runs per cell, only for rules of kind `behaviour` | Depends on the 18c list; price after it |
| 21f | Guard tiers (15e) and the lookup script (14b) | As specified | Not yet estimated |

Rules for every round:

- Five runs per cell instead of three for any result that decides a rule's future.
- A case saturated on both models is a control, never evidence.
- Read at least one transcript per cell before recording a verdict.

## Phase 22: Guards and hooks that are missing

Each is small, and each has an eval or a replay before it becomes a default.

| Slice | What | Evidence before default |
|---|---|---|
| 22a `phase-22/compaction-handoff` | A PreCompact hook that keeps the files changed, the verify command and its last result, open criteria, the decision log, and parked items | The `ls-*` cases with forced compaction (about 84 runs, $40 to $85, repo estimate) |
| 22b `phase-22/stop-nudge` | A Stop hook that adds context once per prompt when source files changed and verify has not run since | About 60 runs, $15 to $30 (repo estimate); watch for over-verification |
| 22c `phase-22/checker-config-guard` | Treat weakening `tsconfig`, ESLint, budgets, and thresholds like weakening tests: allowed, logged, judged at the pull request | A `weakened-checker` case, no-rules arm first; build only if the baseline shows the failure |
| 22d `phase-22/fail-closed` | `onFailure: "block"` on the guards (needs D7) | Hook tests; a headless run to confirm a crashed guard refuses with a reason |

22a matters most for long delegated sessions and can start as soon as 19b defines the decision log.

## Order

1. D1 to D8.
2. 18a, 18b, 18c in parallel; then 18d.
3. 19a, then 19b and 19h; 21a as soon as 19b's candidates exist.
4. 19d and 19f; then 19c, 19g, 19e. Provisional delivery waits for the probes in the process plan (23k).
5. 21b, then 20b. 21c and 21d, then 20c.
6. 22a to 22d as time allows, 22a first.
7. Before going public: D6, a stable release channel adopters can pin, and a minimal profile (the proven rules, the guards, and CI) alongside a core-only profile for projects that are neither web nor Unreal.

## Out of scope

- New stack packs, and support for agents other than Claude Code.
- Observability and scalability guidance. The goal table in `PLAN.md` promises both and nothing delivers them; either write a practice guide after Phase 19 or remove the claims in 18a.

## Risks

| Risk | Mitigation |
|---|---|
| Delegated wording brings test gaming back | 21a runs before the delegated files leave `evals/candidates/`; the hook and CI guard stay in both modes |
| Work built on a draft artifact is thrown away | The stale-link check bounds it to what derived from the changed section; 19a measures how often it happens |
| Fewer gates let a wrong direction run for hours | The three kept gates are the ones the process spec itself calls the main checks; the decision log and queue make each choice visible afterwards |
| Wider permissions in delegated mode | Irreversible and outward actions still ask; a sandbox is the recommended boundary |
| The plan itself adds machinery faster than evidence | Phase 18 removes before Phase 19 adds; every Phase 22 slice has its eval named |
