# Changelog

All notable changes to the rule set and the `rfr-core` plugin. The rule set and the plugin share one version, because the plugin carries the rules in its install-rules payload. Versioning follows [docs/maintenance.md](docs/maintenance.md). `npm run verify` checks that the newest release here matches `plugins/core/.claude-plugin/plugin.json`.

## [Unreleased]

### Changed

- `spec-trace` counts every criterion named after one spec name: `story-reader-editor#AC-2 AC-8`, with commas or "and" too (spec-test-traceability AC-13, #124). Before, only the first was counted, so later ones were reported as uncited. From Kettlebird pilot entry 89. Adopters: nothing to do; specs whose tests use this form may now show fewer uncited criteria.
- `rfr-process` 0.10.2 (#124): fixes from the ninth round of the Kettlebird pilot. The reusable process workflow takes a `typecheck` command, run as its own job on every pull request (AC-44), and `install-dirs`, folders with their own `package.json` that the mutation and type check jobs install after the root (AC-45). The guide says to run the type check with the tests on fixes too, to size a request by what it changes rather than what it is called, and that a fixture build covers every content source, with a test. Adopters: optional; set `typecheck:` (and `install-dirs:` for a nested package) under `with:` in the caller.

- `rfr-process` 0.10.1 (#123): setup fixes from the Agentic XR Pipeline project. `/rfr-process:setup mixed` handles a repository with several kinds of sub-project: one set of artifacts and approvers, each sub-project's folder and profile recorded in `AGENTS.md`, persona starters from each profile used, and Stryker offered per web sub-project. Setup asks for the profile when the repository has no code to infer it from, and never replaces an existing concept or persona. Adopters: nothing to do.

- `rfr-process` 0.10.0 (#122): feedback from a second project, the Agentic XR Pipeline. An optional discovery stage (`docs/product/discovery/`, with a template) sits between the concept and the requirements, so requirements can link to use cases and the approver's answers (AC-41). The markers `[open]`, `[assumed]`, and `[proposed]` record what an artifact has not settled; the process check lists them with file and line and warns when an approved artifact still has one (AC-42). It also warns when an approved product artifact links to a Markdown file that is not an artifact (AC-43). The guide adds a `Release:` line for requirements, a required pass across requirement areas and against the concept, a check of each requirement against each persona (which the `persona-walkthrough` agent can do), how a later stage re-opens an earlier artifact, when success measures may be approved unset, and starting in a git repository; setup checks for one. Adopters: nothing to do; a team-mode project that regenerates CODEOWNERS gains a `docs/product/discovery/` line.

- `rfr-process` 0.9.6 (#120): fixes from the eighth round of the Kettlebird pilot. The guide says to verify unverified platform behaviour with a throwaway build or request before writing the acceptance criteria that depend on it, and to check a pull request's own deployment before merging a change to the build or deployment. The design template and the persona walkthrough ask which version of a third-party tool a design was checked against. Adopters: nothing to do.

- `rfr-process` 0.9.5 (#119): fixes from the seventh round of the Kettlebird pilot. The message for an approved artifact set back to draft now says that an amendment keeps `approved` and that `draft` with a reason and an issue is for withdrawing it (AC-40); the guide says the same, and adds running the type check on the tests-first commit and testing each page state through components. Adopters: nothing to do.

- `rfr-process` 0.9.4 (#118): fixes from the sixth round of the Kettlebird pilot. A stale link to a whole artifact now lists the sections to link instead (AC-38), and the tier job reads the pull request's current labels, so re-running it after a label change works (AC-39). The guide covers testing framework calls through thin adapters with fakes, listing the framework behaviours a spec relies on, testing wiring by its effect, walking manual tutorials before review, working out time-zone and calendar expectations by hand, running Stryker with `--force` after test-only changes, the `tier:story` rule for designs and user documentation, and turning an intermittent visual report into a first-frame test. The tutorial template lists each server's command and address; the design template covers container units for multi-frame mock-ups. Adopters: nothing to do for projects calling the workflows at `@main`; artifacts that still link whole files can move to section links when the check suggests it.

- `rfr-process` 0.9.3 (#117): fixes from the fifth round of the Kettlebird pilot. The process check warns when a draft's recorded hash is out of date (AC-35); the tutorial runner names a protected preview (a 401 or 403, or a login page on another host) instead of reporting a missing element (AC-36); the mutation job posts its score as a check annotation (AC-37), and the static-site Stryker configuration mutates `src/lib/` only. The design template asks how the system knows what it shows, what enforces each promise, and what is published together; the persona walkthrough reads the rendering code, checks help text against the site, and walks editor designs as the readers of the changed pages; bootstrap keeps implementation facts in `docs/product/notes.md`; the preview caller's comment on when it runs is corrected.

### Added

- Phase 10 eval round preparation: a `tdd-cluster` case that replaces `tdd-feature` in the cadence comparison and passes only if the last red run failed on assertions rather than a missing module; tool output for graders (`transcriptTools` gives each call its `output`); `evals/stryker-compare.mjs`, which runs Stryker on a case's fixture without a model, and its first result (`evals/results/2026-11-03-10c-prep/`); a staged run plan with a cost estimate (#121). No paid runs yet.
- `rfr-process` 0.9.2, slice 11h (#116): the Unreal half of runnable tutorials. `examples/unreal` has a fixture tutorial (`tutorial-rfrsample-score-display`), an `RFR Score Display` actor in the sample plugin, and the automation spec `RfrSample.Tutorial.ScoreDisplay` that follows the tutorial step by step. A new `tutorial-demo` job in `unreal-tier2.yml` runs on the GPU runner for each engine version: it builds a demo level and sequence with editor Python, runs the spec and a screenshot functional test of the tutorial's editor step against approved reference images (a missing reference fails the job), and renders a 72-frame demo with Movie Render Queue, uploaded as an artifact. The workflow takes an `engines` input so one version can be run on its own (AC-25).

## [2.2.1] - 2026-11-01

Pull requests: #103, #104, #105, #107, #108, #109, #110, #111, #112, #113, #114, #115.

### Changed

- `plan-feature` (`rfr-core`, #115): stubs for tests written first return a wrong value that is not empty or false, so tests that expect nothing found or something refused start red; the spec is read against the approved user documentation before the tests are written; and a criterion found missing after the tests commit gets its own failing test in a new commit appended to `tests-commit`. The same guidance is in `practices/working-with-agents.md`. From the Kettlebird pilot (entries 44 and 53).
- `rfr-process` 0.9.1 (#114): fixes from the fourth round of the Kettlebird pilot. A new `derived-from` entry can be written with or without its colon, the relink script records its hash, and the check's message for an unrecorded link names the relink command (AC-34). The guide says when a story may skip user documentation and tutorials, how to add a criterion after the tests commit, and how to test a user interface the CI cannot drive.
- `rfr-process` 0.9.0 (#113), slice 11g: an advisory `docs-lint` job that runs Vale 3.26.0 (pinned by SHA-256) with an RFR style built from the writing rules and a vocabulary of persona names and glossary terms (AC-23); Stryker configurations for the `web-app` and `static-site` profiles and an advisory `mutation` job for `tier:story` and `tier:epic` pull requests, incremental across pushes and in full when tests change, with the score and surviving mutants in the job summary (AC-24); and a reusable workflow, with a caller template, that runs and records web tutorials against each preview deployment, sending a protection-bypass header to the preview's origin only (AC-33).
- `rfr-process` 0.8.1 (#112): fixes from the third round of the Kettlebird pilot. The bold-name warning also offers removing bold that is only emphasis; the guide and design template recommend keeping the mock-ups' editable source beside them and say what mock-ups of a third-party interface can and cannot settle; the persona walkthrough checks a story's key terms against similar things in the product.
- `rfr-process` 0.8.0 (#111): fixes from the second round of the Kettlebird pilot. Designs include visual mock-ups or wireframes for every screen and state they change, and the persona walkthrough reads them; the artifact templates link to sections, so an edit elsewhere in an upstream artifact no longer stales everything below it; the process check matches a story's role to a persona only at word boundaries, warns when the user documentation names a control no design defines, and prints the rules-for-robots commit it ran; new decision-note template, epic sections for dependencies, open questions, proposed stories, and release groups, and a visitor-facing static-site documentation template with file and CMS editor variants; guide notes on solo-mode approval, batching and stacking pull requests, and requirements that lead the product (AC-29 to AC-32).
- `rfr-process` 0.7.0 (#110): the `guard-merge` hook asks the person to confirm an agent's merge of a pull request that touches gated folders, instead of denying it, so an approver's instruction to merge is carried out with their confirmation (lead's decision after pilot entry 18; AC-7 changed).
- `rfr-process` 0.6.0 (#109): fixes from the first pilot, on the Kettlebird website. The tier job creates the four `tier:` labels, lets the pull request that adds `process.yml` through, and on a newly opened pull request waits up to a minute for a tier label before failing. The bootstrap skill drafts requirements as user-visible behaviour with today's tools as "current implementation, not a commitment", ranks code and the running product above planning documents, and lists defects found for later `tier:fix` issues. Setup skips persona starters when bootstrap follows, and both skills allow a commit when the task is to open a pull request. The process check counts draft links with no recorded hash. The README, guide, and workflow template explain pinning the reusable workflow to a tag or commit. From pilot entries 17 and 18: an artifact is approved by the pull request that sets `status: approved` and records its hashes (bootstrap now does this in the same pull request once the approver says the drafts are ready); an agent merges a gated pull request only on the approver's explicit instruction and comments with the instruction quoted; setup writes these rules into the project's `AGENTS.md`, so they hold without the plugin.

### Added

- `rfr-process` 0.5.0 (Phase 11, slice 11f; #108). The issue sync places persona, epic, and story issues on a GitHub Project when `process.yml` names a `project` and the `RFR_PROJECT_TOKEN` secret is set, and sets each item's Stage field: personas in Personas, epics and stories in the furthest stage their approved work has reached. Runs that change nothing make no board changes; missing Stage options are reported, not failed. The reusable workflow declares the optional secret, and the caller template passes it with `secrets: inherit`.
- `rfr-process` 0.4.0 (Phase 11, slice 11e, from the research amendment; #107). Link rule 8 in `checks/process-trace.mjs`: an approved story says "As <persona>, I want ... so that ...", names a persona it links to, and has acceptance criteria (drafts get warnings). `tutorial-run --record <dir>` saves a screenshot per step, `failure.png`, and `video.webm`, so a passing run is the stage 12 demo. The `persona-walkthrough` agent becomes a cognitive walkthrough that asks where each persona would fail at every step, and runs web tutorials against the product first. The guide gains recommended tools per profile and a section on installing third-party plugins and MCP servers safely, with each security claim checked against its primary source. The research note records corrections to two of its claims.
- `rfr-process` 0.3.0 (Phase 11, slice 11c; #105). Runnable tutorials: a web tutorial is its own test, because `checks/tutorial-run.mjs` reads each step (`Click **Name**.`, ``Type `text` into **Label**.``, `You see **Text**.`) as browser actions and fails at the step that no longer matches the product; Unreal tutorials must be cited by an automation test. A new `tutorials` job in the reusable `rfr-process.yml` workflow checks runners and step grammar without a browser. Persona starters and user documentation and tutorial templates for the `unreal-plugin`, `web-app`, and `static-site` profiles. The experimental `persona-walkthrough` agent, and the `setup` and `bootstrap` skills. The plugin's [GUIDE.md](plugins/process/GUIDE.md) covers how to write each artifact, the review checklists, and the persona walkthrough. This repository's CI installs Chromium for the runner's tests.
- `rfr-process` 0.2.0 (Phase 11, slice 11b; #104). New checks, each run by the reusable `rfr-process.yml` workflow: `checks/ci/process-approvals.mjs` requires, in team mode, an approving review on the head commit from the approvers of each gated stage a pull request changes, and in solo mode checks after the merge that an approver merged it, opening a `process-approval` issue if not; `checks/ci/process-tier.mjs` requires one `tier:` label and keeps `tier:trivial` and `tier:fix` pull requests out of the folders their tier may not change; `checks/process-codeowners.mjs` writes and checks a CODEOWNERS block from `process.yml`; `checks/ci/process-sync.mjs` mirrors personas, epics, and stories to issues after each merge, with the files winning. The plugin's new `guard-merge` hook denies agent merges of pull requests that touch gated process folders. The `stale` issue on the default branch is now assigned to the approvers of the stages involved.
- `rfr-process` 0.1.0, a second plugin for the project development process in [docs/specs/project-process.md](docs/specs/project-process.md) (Phase 11, slice 11a; #103). It ships artifact templates for each stage, a `process.yml` template for per-stage approvers, and a caller for the new reusable workflow `rfr-process.yml`. `checks/process-trace.mjs` fails on broken or stale links between artifacts, cycles, approved work built on drafts, stories without an approved persona, spec criteria without a story or documentation source, and withdrawals without a reason; `--status` lists how far each persona, epic, and story has reached. `checks/process-relink.mjs` records current section hashes. The check runs in `npm run verify` and on the default branch, where a failure opens a `stale` issue.

## [2.2.0] - 2026-10-26

Pull request: #95.

### Added

- UE-009 (SHOULD, `unreal-plugin` pack): a custom asset type gets its own entry in the Content Browser's Add menu, through a `UFactory` and a `UAssetDefinitionDefault` in an editor module, and a test that every asset class has both; users should not have to create a generic Data Asset and then pick the class. Observed in an Open3DPuppet session, where the agent made every asset type a plain `UDataAsset` subclass. The Unreal practice guide has a section on custom asset types.

## [2.1.0] - 2026-10-26

Pull request: #91.

### Changed

- `software-architect` and `tech-lead` (both still experimental) handle new projects with no code yet. The architect maps every requirement to the design, lists conflicts, gaps, and ambiguous requirements as questions instead of settling them, and names the platform constraints the requirements leave unstated. The tech lead starts with a slice that creates the project and a thin version passing the verification command, maps every requirement to a slice, plans tests before code, and orders slices that wait on an answer last.

### Added

- Greenfield eval cases `arch-greenfield-webapp`, `arch-greenfield-uplugin`, `lead-greenfield-webapp`, and `lead-greenfield-uplugin`, which start from a profile's template repo plus a requirements brief with planted problems, with unit-tested graders. Large-repository cases `arch-add-godot-support` and `lead-add-godot-support` on a snapshot of this repository.

## [2.0.0] - 2026-10-26

Pull requests: #92, #93, #94.

### Removed

- The `ci-watcher` agent. It existed to make one blocking `gh pr checks --watch` call, and agents no longer wait that way (below). `merge-when-green` reads failed job logs itself. A removed agent is a major change (docs/maintenance.md).

### Changed

- Agents wait for CI on events only. `merge-when-green` checks once; if checks are still running, it ends the turn when the session receives the pull request's events (a cloud session subscribed to the pull request, or the Claude desktop app with the pull request bound and its monitor on, which relays CI failures and new comments, so a green run arrives as the CI status comment), and otherwise says what is still running and stops, with at most one scheduled fallback wake-up. It never waits with `gh pr checks --watch`, `gh run watch`, `sleep` loops, or repeated checks, which hold the session and time out on long self-hosted runs. A check skipped only because the pull request was a draft is not a pass. `unreal-engineer` and `web-engineer` check once and hand a pending wait back to the caller, since a subagent receives no events. The working-with-agents guide says the same. The smoke cases fail any waiting command, and the fake `gh` refuses them.
- The CI status comment (`rfr-ci-status.yml`) posts a new comment on every run instead of editing one in place, because a new comment is what wakes an agent waiting on the pull request (the Claude desktop app's pull request monitor relays new comments, and an edited one may wake nobody). A passing run is headed "✅ **<workflow> completed successfully!**", a failed one "❌ **<workflow> failed**", a cancelled one "⚪ **<workflow> was cancelled**", each with the head commit's full SHA, and a pass lists the jobs it skipped. The adoption guide and the workflow show how to gate the status job on draft pull requests when a job skips on drafts, so a draft gets no green comment. Adopters need no change.

### Fixed

- The guards workflow in the template repos and `examples/web-app` runs when a label is added or removed (`types: [opened, synchronize, reopened, labeled, unlabeled]`). The test change guard (TEST-001) reads the `tests-reviewed` label from the event that started the run, so a reviewer who added the label after a failed run saw the check stay red: the default events start no new run, and re-running the failed job reuses the original event. Removing the label now also re-runs the guard, so the check does not stay green after the approval is withdrawn. The adoption guide shows the `on:` block for adopters who call the reusable workflow. Adopters update their own `guards.yml`; the reusable workflow is unchanged.

## [1.5.0] - 2026-10-12

Pull request: #87.

### Added

- Phase 10b, `docs/specs/spec-test-traceability.md`. The spec lock accepts a list of `tests-commit` values, one per cluster of tests; each cluster is locked at its own commit and each later commit must descend from the one before.
- `plan-feature` gives criteria IDs and `test:` markers and plans the tests first: a cluster per criterion group, stubs so each test fails on its assertion, `tests-commit` recorded when the cluster is committed red. `review-pr` gets a sabotage step for approved specs: break the behaviour behind each traced criterion in a throwaway worktree and report citing tests that still pass. The working guide describes the loop.
- Candidate rules for the evals: TEST-007 (trace acceptance criteria to tests) and TEST-004-clustered (draft tests in clusters, stubs first).
- Eval cases `spec-trace-uncovered`, `spec-trace-wrong-test`, `spec-drift`, and `spec-vacuous-tests`, with unit-tested graders; two smoke cases for the skills; a `skill` setting for cases in the plugin arm. The staged run plan is in `evals/README.md`. No paid runs yet.

## [1.4.0] - 2026-10-12

Pull request: #85.

### Added

- Spec trace and lock checks (Phase 10a, `docs/specs/spec-test-traceability.md`). `checks/spec-trace.mjs` fails when an approved spec has a `test:` criterion no test cites (as `<spec name>#AC-<n>`) or a test cites a criterion the spec lacks; drafts only warn. `checks/spec-lock.mjs` fails when a test that cites a spec was modified, deleted, or renamed after the spec's `tests-commit`, unless the spec lists an `unlocks:` entry with a reason. Both run in `npm run verify` (`check:specs`), and adopting repositories can turn them on with `spec-checks: true` in the reusable guards workflow.
- The `plan-feature` spec template has front matter (`status`, `tests-commit`, `unlocks`) and criterion IDs with `test:` markers.

## [1.3.0] - 2026-10-12

Pull request: #83.

### Added

- Experimental agent `ux-reviewer` (read-only, Opus, medium): usability and interface design in three areas, Unreal Editor tools and Blueprint-facing APIs, general software (desktop, command-line, developer tools), and web pages and apps. Accessibility conformance stays with `accessibility-reviewer`. `review-pr` adds it for new or changed flows, screens, forms, messages, and tools.
- Eval cases for it: `ux-signup-flow`, `ux-landing-page`, `ux-cli-tool`, `ux-editor-tool` (five planted defects each) and the `ux-clean-form` control, with unit-tested graders and a staged run plan in `evals/README.md`. No paid runs yet.

## [1.2.1] - 2026-10-12

Pull request: #82.

### Changed

- `software-architect` runs on `claude-fable-5-1` (was `opus`).

### Added

- Eval round for `software-architect` and `tech-lead`: a `rules+agents` arm in `evals/run.mjs`, four cases (`arch-money-storage`, `arch-reuse-event-bus`, `lead-plan-order`, `lead-check-claim`) with unit-tested graders, and a staged run plan in `evals/README.md`. No paid runs yet.

## [1.2.0] - 2026-10-12

Pull request: #81.

### Added

- Experimental agents `software-architect` (design choices; may write ADR files) and `tech-lead` (slices work, assigns owners, checks delegated work against acceptance criteria). Added before any eval showed a benefit, which R18 asked for; an eval round decides whether they stay.

## [1.1.1] - 2026-10-12

Pull request: #80.

### Fixed

- `format-on-edit` formatted nothing on Windows: Node refuses to spawn the `prettier.cmd` shim directly. The hook now runs the shim through `cmd.exe` with quoted arguments, and skips a path containing `"` or `%`.
- `npm test` ran 0 tests on Windows because its glob was in single quotes, which `cmd.exe` keeps literally. The glob is now in double quotes (also in the `ls-hidden-harness` fixture and its test).
- `build --check` reported paths with backslashes on Windows; paths are now compared with `/`.
- Eval graders and tests that run `npm` or `npx` now do so through the shell on Windows. The `ls-hard-to-reverse` fixture's `check-migrations.mjs` builds its path with `fileURLToPath`.

### Added

- `.gitattributes` with `* text=auto eol=lf`, so Windows checkouts with `core.autocrlf=true` no longer see the generated template files as stale. `npm run verify` now passes on Windows (203 of 203 tests).

## [1.1.0] - 2026-10-07

Pull request: #79.

### Added

- Three Haiku 5.5 agents for work that gathers or runs things and leaves the judgment to the caller: `ci-watcher` (waits for a pull request's checks and returns results with the first error from each failed job's log), `check-runner` (runs named scanners, audits, builds, and tests and returns exit codes and key output verbatim), and `citation-checker` (confirms that review findings cite real files, lines, identifiers, and rule IDs).
- Smoke cases for the three agents and for `merge-when-green` with checks still running; the smoke harness records cost by model and can require that a case used a given model. Research note: `docs/research/notes/haiku_5_5_delegation.md`.

### Changed

- `merge-when-green` hands the wait to `ci-watcher` when checks are pending; `review-pr` runs `citation-checker` when there are three or more findings; `security-audit`, `perf-audit`, `a11y-audit`, and `package-unreal-plugin` hand the commands to `check-runner`. The caller still confirms the head commit, judges results, and decides.

## [1.0.7] - 2026-10-06

Pull request: #77.

### Changed

- DOC-001: when a change completes an item in the project's plan or roadmap, mark it done and name the pull request that delivered it.
- `plan-feature` spec template has a Delivery section for the plan item and its pull requests; `merge-when-green` checks that the plan entry names the merged pull request.
- Working with agents: keeping a trail from the plan to the code. The maintenance guide asks for pull requests in changelog entries.

### Added

- `checks/plan.mjs` (in `npm run verify`): a completed phase or milestone in `PLAN.md` must name its pull requests. `PLAN.md` now lists them for every completed phase and milestone, and the changelog names the pull request for each release from 0.13.2.

## [1.0.6] - 2026-10-06

Pull request: #76.

### Fixed

- `merge-when-green`: picks a merge method without stopping to ask (argument, the only allowed method, recent merges, then a merge commit); reads the failing job's log before reporting; switches to the base branch and fast-forwards it after merging. Found by its new smoke tests, which now pass 4 of 4 (`evals/results/smoke-merge-when-green/`).
- `guard-commands` no longer treats stream redirects (`2>&1`, `>/dev/null`) as writes, so read-only commands on test files are not stopped.

### Added

- Smoke tests for `merge-when-green` in `evals/agents/smoke.mjs`, with a fake `gh` (`evals/agents/fake-gh/`) and a local remote: a green pull request and a pull request whose head commit fails.

## [1.0.5] - 2026-10-05

Pull request: #75.

### Added

- `/rfr-core:merge-when-green <pr>` (user only): waits for CI with one blocking call or pull request events instead of polling, confirms every check on the head commit, merges with `--match-head-commit`, updates the base branch, and continues.
- `.github/workflows/rfr-ci-status.yml`, a reusable workflow that keeps one comment on the pull request with each job's result and the head commit's full SHA, so whoever waits on CI is notified. The template repos' merge-gating workflows (web app and static site CI, Unreal Tier 1 and Tier 2) call it as their last job.

### Changed

- `web-engineer` and `unreal-engineer` wait for CI with a blocking call or notifications, never a sleep loop, confirm checks on the head commit, and merge only when asked.
- Working with agents: the pull request section explains merging on green and continuing, and why a "CI passed" comment is a signal, not proof. The adoption guide shows how to add the status job.

## [1.0.4] - 2026-10-05

Pull request: #73.

### Changed

- `format-on-edit` formats the files edited in a turn once, when the turn ends (Stop, or SubagentStop for a subagent's own edits), instead of rewriting each file straight after every edit. Files no longer change under the agent mid-turn, so a later Edit's `old_string` still matches. Whether this lowers hook cost is measured in the next eval round; the Phase 8 fixtures had no formatter, so formatting did not cause the cost found there.

## [1.0.3] - 2026-10-05

Pull request: #72.

### Added

- Owned paths (#47), opt-in. A project that lists the paths it owns in `AGENTS.md` under `## Owned paths` gets:
  - the `guard-owned-paths` hook, which asks before an edit to a project file outside the list;
  - an `owned-paths` job in the reusable `rfr-guards.yml` (`owned-paths: true`), which fails a pull request that changes files outside the list.

  Projects without the section see no change.

## [1.0.2] - 2026-10-05

Pull request: #68.

### Changed

- `guard-commands` asks before an Unreal editor run whose `-ExecCmds` list does not include `Quit`, which leaves the editor running after its commands finish (#56).

## [1.0.1] - 2026-10-05

Pull request: #67.

Responses to the second external review (#47 to #64). None of the proposals had eval evidence, so none became a new rule. The advice went into the practice guides, skills, and agents, and two rules gained a clarifying sentence.

### Changed

- WA-006: examples from blogs, forums, or other versions do not count as a check (#54).
- CODE-001: prefer code the shipped product uses over prototypes, samples, or deprecated code, and say if the followed file may be legacy (#48).
- `plan-feature` spec template: named test cases, the APIs used and where each was checked, and assumptions that could be wrong (#49).
- `write-adr` offers an ADR before drafting one unasked (#62). `web-engineer` and `unreal-engineer` return new scope, architectural choices, and irreversible actions to the caller (#59).
- Practice guides:
  - Working with agents: evidence for claims (#48, #53, #54, and the dependency and fake advice from #28 and #29), delegating to subagents (#58, #59), ownership boundaries (#47), phases (#60), one question or a stated assumption (#61), decisions linked to ADRs (#62), glossaries (#63), and reviewer severities (#64).
  - Testing: test clusters for expensive runs (#50), validation-first for content and data (#51), and finding the existing test harness (#52).
  - Unreal: ending `-ExecCmds` with `Quit` (#56), `NotValidated` results (#51), and driving the editor MCP serially (#55).

## [1.0.0] - 2026-10-05

Pull request: #66.

First stable release. The rule set, the `rfr-core` plugin, and the template repos are complete for the scope in `PLAN.md`: a stack-independent core, six stack packs (Unreal plugin, TypeScript, web platform, React and Next.js, Node services, static sites), six agents, ten skills, default hooks, reusable CI workflows, and three template repos. Both reference projects, a Next.js web app and an Unreal plugin, were built from the templates by the agents and pass their own checks. From this release on, a stricter or new MUST rule, or a removed or renamed rule, needs a major version (see [docs/maintenance.md](docs/maintenance.md)).

### Changed

- No rule changes since 0.13.2. `PLAN.md` records Phases 0 to 7 and 9 as complete; the remaining Phase 8 evals continue after 1.0.

## [0.13.2] - 2026-10-05

Pull request: #65.

### Added

- `examples/unreal-plugin/`: RfrCooldowns, a reference Unreal plugin built by an agent from the Unreal template with `rfr-core` installed. Tier 2 builds and tests it on UE 5.6, 5.7 and 5.8, then stages and zips it as a Fab package rehearsal.

### Changed

- UE-007 says to create each spec object with the outer its class requires, for example a game-instance subsystem inside a transient `UGameInstance`. The agent that built the reference plugin missed this; the advice had been only in a practice guide.
- The Unreal template's `.clang-format` now produces Epic-style braces, lambdas, and access specifiers.
- Unreal Tier 1 warns about `MarketplaceURL` only when it has a value. BuildPlugin writes an empty one into every packaged descriptor.

## [0.13.1] - 2026-10-05

### Changed

- Unreal Tier 1 and FAB-003 accept third-party code in a module's own `Source/<Module>/ThirdParty/` folder as well as `Source/ThirdParty/`. Fab's TR 4.3.7.3.d allows either reading; the first Fab submission that uses per-module folders will confirm it (#36). A `ThirdParty` folder outside `Source/` is still an error.

## [0.13.0] - 2026-10-05

### Added

- `checks/ci/instruction-lint.mjs`: fails when a backticked path or `npm run` script named in `AGENTS.md` or `CLAUDE.md` does not exist, and warns about absolute paths and MCP tool names. It runs in `npm run verify` and as a new job in the reusable `rfr-guards.yml` workflow (turn off with `instruction-lint: false`) (#34).
- `guard-commands` asks before `git config --global` or `--system` (#31).
- Practice guide sections on work that spans sessions and the needs-a-live-test list (#33, #35), pull requests and CI, including required checks with path filters (#30), Windows (#31), and shared Unreal build machines (#32).

## [0.12.5] - 2026-10-05

### Changed

- UE-006 keeps `BuildSettingsVersion.V6` (checked by Tier 1) and makes the include order a project decision: agents use the `IncludeOrderVersion` AGENTS.md records, defaulting to `EngineIncludeOrderVersion.Latest`. This removes a conflict with projects pinned to one engine version. The unreal-plugin AGENTS.md template and the Unreal guide record the decision (#38).

## [0.12.4] - 2026-10-05

### Fixed

- The rule lint can validate an adopting repo's own rules: `--adopting-repo` accepts waivers and project rules (`scope: project`, in `.claude/rules/project/`, with an ID prefix rules-for-robots does not use). In this repository a project rule still fails (#27).

### Changed

- `install-rules` leaves `.claude/rules/project/` alone. `docs/layering-and-overrides.md` and `docs/rule-format.md` describe project rules.

## [0.12.3] - 2026-10-05

### Fixed

- `guard-commands` now runs for Claude Code's PowerShell tool on Windows and recognises `Remove-Item -Recurse -Force` (and its aliases and parameter prefixes), PowerShell cmdlets that write to test files, and `\` path separators (#23).
- Unreal test modules (`Source/<Name>Tests/`) and test files (`*Tests.cpp`, `*Test.cpp`, `*Spec.cpp` under `Source/`) count as tests in `guard-test-edits`, `guard-commands`, the CI test change guard, and the `paths` of TEST-001 and TEST-003 (#37).

## [0.12.2] - 2026-10-05

### Fixed

- Unreal Tier 1 reports a build-output folder (`Binaries/`, `Intermediate/`, and so on) once and no longer reports every file inside it (#24).
- Unreal Tier 1 skips FAB-002 and UE-002 for third-party code in a module's own `ThirdParty` folder, as it already did for `Source/ThirdParty` (#25).
- Unreal Tier 1 accepts `--copyright` more than once, and the reusable workflow accepts one holder per line, for plugins that include upstream code (#26). FAB-002 says third-party files keep their authors' notices.

## [0.12.1] - 2026-10-05

### Fixed

- RfrSample Automation Spec: creates the subsystem inside a transient `UGameInstance`; outered to the transient package it raised an ensure that failed the first test on every engine.
- Unreal Tier 2 workflow: installs Node for the report reader, prints automation errors when tests fail, and runs the runner probe even when tests fail.

### Changed

- Unreal guide records the editor's exit codes (0 when tests pass, 255 when one fails, UE 5.6 to 5.8), that Launcher builds do not ship the BuildPlugin source, and how to give test objects the outer their class requires.
- `profile-unreal-plugin` no longer claims the runner probe confirmed Insights headless flags; it could not.

## [0.12.0] - 2026-10-05

### Added

- Phase 8 eval cases: green-at-all-costs, tdd-feature, nextjs-redirect, db-preview-push, configurable-retry, with results and a report in `evals/results/2026-10-05-phase8/`.
- Unit tests for eval graders and the harness's shared `node_modules` handling.
- `CHANGELOG.md`, `docs/maintenance.md` (versioning policy and review cycle), and a release check in `npm run verify`.

### Changed

- NEXT-001 now points agents at the `nextjs-agent-rules` block that `next dev` writes into `AGENTS.md`, which the Phase 8 evals showed already prevents the `middleware.ts` mistake.

### Fixed

- Eval harness: hard-link a shared `node_modules` instead of symlinking it, which Turbopack rejects.
- Eval graders: tdd-feature classifies writes by target file; nextjs-redirect recognises `redirects` in property form.

## [0.11.0] - 2026-10-05

### Added

- Reference web app in `examples/web-app` (RFR Shop, Next.js 16), built by the `web-engineer` agent from the `web-app` template, with its own CI workflow.
- `guard-commands` asks before shell commands that write to test files (for example `sed -i` or a Python one-liner), closing a gap the reference build exposed in `guard-test-edits`.

### Fixed

- `web-app` template: `next typegen` runs before `tsc`, `@types/node` matches Vitest, Vitest excludes `e2e/`, a web `.gitignore`, and ESLint ignores Playwright and Lighthouse output.

## [0.10.0] - 2026-10-05

### Added

- TEST-004: develop new behaviour test first. The engineering agents and `plan-feature` work test-first and report the red and green runs.

## [0.9.0] - 2026-10-05

### Added

- Agents: `web-engineer`, `unreal-engineer`, `code-reviewer`, `security-reviewer`, `accessibility-reviewer`, `performance-reviewer`.
- Skills: `plan-feature`, `review-pr`, `a11y-audit`, `perf-audit`, `security-audit`, `write-adr`, `release`, `profile-unreal-plugin`, `package-unreal-plugin`.
- Smoke tests for every agent and skill (`evals/agents/smoke.mjs`).

## [0.8.0] - 2026-10-05

### Added

- Practice guides in `practices/`. Every rule cites a guide and every guide is cited by a rule; the lint enforces both.

## [0.7.0] - 2026-10-05

### Added

- `node-services` (NODE, PG) and `static-sites` (ASTRO) packs.
- `guard-mcp` hook, which asks before Vercel MCP calls that change production.

## [0.6.0] - 2026-10-05

### Added

- `typescript` (TS), `web-platform` (WEB), and `react-nextjs` (NEXT) packs.

## [0.5.0] - 2026-10-05

### Added

- `unreal-plugin` pack (UE, FAB), Unreal Tier 1 checks, the `RfrSample` plugin, and the Unreal guide.

## [0.4.0] - 2026-10-05

### Added

- Core rules for testing, code quality, security, git, and documentation.

## [0.3.0] - 2026-10-05

### Added

- Default hooks: `guard-commands`, `guard-test-edits`, `format-on-edit`.

## [0.2.0] - 2026-10-05

### Added

- Working agreement rules WA-001 to WA-007.

## [0.1.0] - 2026-10-05

### Added

- `rfr-core` plugin, marketplace, and the `install-rules` skill.
- Rule format, rule lint, and template-repo build.
