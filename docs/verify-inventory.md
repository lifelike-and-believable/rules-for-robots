# Verify suite inventory

The inventory the rewrite plan's phase 25e asks for before any test changes ([rewrite-plan.md](rewrite-plan.md), "Review of the verify suite"). Written 2026-11-12 from `main` at 57e4beb plus pull request #233. Status: **approved by the maintainer on 2026-11-12**, with the recommended answer to each of the three questions at the end (decisions below).

On that date `npm run verify` has 11 steps and 127 test files (866 tests). CI runs all of it on every pull request, documents included, on Linux and on Windows.

How each file was classed: what it imports, the spec criteria its test names cite, and its test titles. "Removed component" means one that section 4 of the rewrite plan removes. A file "locked" cites a spec with a `tests-commit` (project-process, process-state, delivery-run, github-gate, feedback, test-change-review, spec-test-traceability); changing or deleting it needs the criterion retired or the file listed under that spec's `unlocks:`, in the same pull request.

## Verify steps

| Step | Class | Reason |
|---|---|---|
| `lint:rules` | keep | Rule format; fast |
| `setup:vale` | keep | The docs-lint tests run Vale. Revisit if docs-lint, which the plan defers, is removed |
| `npm test` | keep, split in CI | Locally still everything. In CI, a plugin's tests run when that plugin or the `checks/lib/` code the build copies into it changes |
| `check:release` | keep | Changelog, plan, and plugin versions agree |
| `check:plan` | keep | |
| `check:specs` | keep | Trace and lock |
| `check:process` | keep | |
| `check:instructions` | keep | |
| `build:check` | keep | Template repos match their sources |
| `check:unreal-sample` | move | To rfr-unreal's CI path: runs when `plugins/unreal/`, `checks/unreal/`, or `examples/unreal/` changes |
| `validate:plugins` | keep | |

CI changes (not test changes):

- **Documents-only pull requests** (only Markdown outside `rules/`, `templates/`, and `plugins/`): run the lint, plan, spec, process, instruction, and build checks; skip `npm test` and the Windows job.
- **Windows job**: measure which tests take its 6 to 7 minutes before changing it. The likely change is to run only the tests that depend on paths and shells (the guards, owned paths, build) on Windows. It is not a required check today.

## Remove: tests of removed components (15 files)

| File | Tests | Component | Locked |
|---|---|---|---|
| `task-approval.test.mjs` | 8 | task approval | no |
| `task-approval-replies.test.mjs` | 2 | task approval | no |
| `standing-task-approval.test.mjs` | 3 | task approval, merge guard | no |
| `release-instruction.test.mjs` | 2 | task approval (release by instruction) | no |
| `merge-instruction-phrasings.test.mjs` | 2 | task approval | no |
| `merge-instruction-session-pr.test.mjs` | 3 | task approval, merge guard | project-process |
| `process-guard-merge.test.mjs` | 8 | merge guard | project-process |
| `process-guard-merge-automerge.test.mjs` | 3 | merge guard | project-process |
| `process-guard-merge-instruction.test.mjs` | 6 | merge guard, merge-when-green | project-process |
| `smoke-merge-when-green.test.mjs` | 5 | merge-when-green | no |
| `session-tools.test.mjs` | 3 | default-allow hook | no |
| `process-plain-specs.test.mjs` | 2 | approvals job (AC-5), merge guard (AC-7) | project-process |
| `process-approvals.test.mjs` | 14 | `process / approvals` job; see question 2 | project-process |
| `delegated-mode.test.mjs` | 5 | supervised and delegated modes | no |
| `default-allow.test.mjs` AC-1, AC-3 to AC-5 | 4 of 6 | default-allow hook, ask rules in templates; AC-2 and AC-6 move (below) | no |

## Split: part removed, part kept

| File | Removed | Kept, and where |
|---|---|---|
| `default-allow.test.mjs` | AC-1, AC-3, AC-4, AC-5 | AC-2, AC-6 (pushes to the default branch, remote deletes, releases): into `guard-never-list.test.mjs` |
| `unattended.test.mjs` | AC-3 (approved in the person's own words) | AC-1, AC-2, AC-5 |
| `process-gate-types.test.mjs` | AC-56 (solo and team mode paths), AC-58 (merge guard) | AC-55 (gates parsed), AC-57 (notify gate) |
| `guard-outcomes.test.mjs` | AC-6 (logging that an ask was approved: no asks remain once `"permissions": "ask"` goes) | AC-7 and plugin-split AC-6 (the decision report): renamed `guard-report.test.mjs` |
| `process-xr-round3.test.mjs` | AC-47, and AC-48's approvals case (approvals job) | AC-46 into `process-markers.test.mjs`; AC-48's sync case into `process-sync.test.mjs` |
| `preferences-log.test.mjs` | the delegated-agreement test | the template and install-rules tests, into `build.test.mjs`; decided with the rules |
| `process-codeowners.test.mjs` | the solo-mode case (solo mode now gets a block, github-gate AC-2) | the rest |

## Merge: files named after a pilot round or slice, folded into files named by behaviour

**Done for the process files and plugin-split (slice e, 2026-11-13).** The names differ from the table below where a better one fitted the behaviour, and where the target did not exist or already had its own fixture server:

- AC-28, AC-32, AC-34, AC-35, AC-38, and AC-43 are in `process-links.test.mjs`.
- AC-29 is in `process-roles.test.mjs`, AC-30 in `process-design-names.test.mjs`, and AC-41 in `process-stages.test.mjs`.
- AC-42 and AC-46 are in `process-markers.test.mjs`.
- AC-31 and AC-40 are in `process-check-messages.test.mjs`.
- AC-24 and AC-37 are in `process-mutation.test.mjs`, and AC-23 in `process-docs-lint.test.mjs`.
- AC-33 and AC-36 are in `tutorial-previews.test.mjs`, and AC-49 and AC-50 in `tutorial-controls-viewport.test.mjs`.
- AC-48, which this table did not list (from `process-xr-round3`), is in `process-github-retry.test.mjs`.
- AC-44 and AC-45 went into `process-workflow.test.mjs`, AC-51 into `tutorial-first-step-timeout.test.mjs`, and `plugin-split-16b` into `plugin-split.test.mjs`.

**Left for slice f:** `guard-tiers-15b`, `guard-tiers-15c`, `guard-tiers-15d`, `rm-own-scratch`, and `hooks`. They import the web and Unreal guards that slice f moves into their plugins, so they are split once, there, and not moved twice.

| File | Criteria | Into |
|---|---|---|
| `process-pilot-fixes.test.mjs` | AC-27 (tier labels), AC-28 (draft links) | tier: see question 1; AC-28 into `process-trace.test.mjs` |
| `process-pilot-round2.test.mjs` | AC-29, AC-30, AC-31, AC-32 | `process-roles.test.mjs` (AC-29), `process-glossary-names.test.mjs` (AC-30), `process-trace.test.mjs` (AC-31, AC-32) |
| `process-pilot-round3.test.mjs` | AC-30 | `process-glossary-names.test.mjs` |
| `process-pilot-round4.test.mjs` | AC-34 | `process-relink.test.mjs` |
| `process-pilot-round5.test.mjs` | AC-35, AC-36, AC-37 | `process-staleness.test.mjs` (AC-35), `process-tutorials.test.mjs` (AC-36), `process-mutation.test.mjs` (AC-37) |
| `process-pilot-round6.test.mjs` | AC-38, AC-39 | `process-staleness.test.mjs` (AC-38); AC-39 (labels) with the tier |
| `process-pilot-round7.test.mjs` | AC-40 | `process-trace.test.mjs` |
| `process-pilot-round9.test.mjs` | AC-44, AC-45 | `process-workflow.test.mjs` |
| `process-pilot-round10.test.mjs` | AC-49, AC-50 | `process-tutorials.test.mjs` |
| `process-xr-round1.test.mjs` | AC-41, AC-42 | `process-stages.test.mjs` (AC-41), `process-markers.test.mjs` (AC-42) |
| `process-xr-round2.test.mjs` | AC-43 | `process-markers.test.mjs` |
| `process-11g.test.mjs` | AC-23, AC-24, AC-33 | `process-docs-lint.test.mjs`, `process-mutation.test.mjs`, `process-tutorials.test.mjs` |
| `feedback-round1.test.mjs` | AC-51 | `tutorial-first-step-timeout.test.mjs` (the same behaviour) |
| `guard-tiers-15b.test.mjs` | guard-tiers AC-3 to AC-5, AC-12 | `guard-commands.test.mjs` |
| `guard-tiers-15c.test.mjs` | guard-tiers AC-11 | `guard-snapshots.test.mjs` |
| `guard-tiers-15d.test.mjs` | guard-tiers AC-8 | `guard-replay.test.mjs` |
| `plugin-split-16b.test.mjs` | plugin-split AC-7 to AC-9 | `plugin-split.test.mjs` |
| `rm-own-scratch.test.mjs` | default-allow AC-2 (rm -rf in temp folders) | `guard-commands.test.mjs`, citing guard-tiers |
| `hooks.test.mjs` (38 tests) | mixed | guard-commands tests into `guard-commands.test.mjs`; format-on-edit (8) into `format-on-edit.test.mjs`; owned paths (3) into `owned-paths.test.mjs`; guard-mcp (3) to rfr-web; guard-unreal (1) to rfr-unreal |

All the `process-*` files above are locked by project-process: each is listed under its `unlocks:` with "moved, unchanged" as the reason, and the moved tests keep their titles, so `check:specs` still finds every citation.

## Move: domain tests to their plugin's `test/` folder

**Done for the test files and CI (slice f1, 2026-11-13).**

- Moved into the plugins' `test/` folders: `android-guard` (now `plugins/android/test/guard-adb.test.mjs`), `feedback`, `feedback-area`, `unreal-tier1`, and `unreal-tutorial-demo`. Only their import paths changed. The feedback, android-plugin, and project-process specs name the plugin folder in `tests:`, so the trace and lock checks find them.
- The guard files slice e left behind are split by behaviour:
  - `hooks` became `guard-commands`, `guard-test-edits`, `format-on-edit`, and `guard-owned-paths` in `test/`, plus `plugins/web/test/guard-mcp.test.mjs` and `plugins/unreal/test/guard-unreal.test.mjs`.
  - `rm-own-scratch` went into `guard-commands`.
  - `guard-tiers-15b`, `15c`, and `15d` are now `guard-tiers`, `guard-snapshots`, and `guard-replay`. `guard-tiers` stays in `test/`: its corpus cases run every plugin's guard.
- CI runs `checks/ci/verify-ci.mjs` in place of `npm run verify`, with these effects:
  - A documents-only pull request runs no tests, and the Windows job is skipped.
  - A plugin's tests run when anything they import, or any path they name, changes.
  - The Unreal sample check runs when rfr-unreal, `checks/unreal/`, or `examples/unreal/` changes.
  - A push to `main`, or a change to the test setup, runs everything.

**Done in slice f2 (2026-11-13).**

- The PG-001 database patterns and the whole Vercel CLI check moved from `guard-commands.mjs` to rfr-web's new `guard-cli.mjs`:
  - production deploys (NODE-002);
  - deleting deployments, projects, DNS records, and certificates (WA-003);
  - pulling secrets (SEC-001).
- The inventory said the Vercel production-deploy refusal moves. #237 had since hardened it inside `guard-commands` as part of the never list, so the maintainer was asked again on 2026-11-13 and chose to move it.
- `guard-cli` reads command lines with a build-generated copy of rfr-core's parser. The command walker moved, unchanged, into `plugins/core/scripts/command-words.mjs` for that purpose.
- Before the move, `main`'s `guard-commands` was compared with this branch's `guard-commands` and `guard-cli` together on 5,372 commands, with no difference in what is refused:
  - the guard corpus;
  - this session's transcript;
  - every quoted string in the test files.
- `evals/session-replay/replay-commands.mjs` now runs both guards.
- **Already in place:** the `mutation` job is opt-in (`mutation: false` by default) and runs only on feature pull requests. The `tutorials` job only checks coverage for each tutorial's own `runner:`. Neither runs anything a profile does not use, so neither changed.

| File | Plugin |
|---|---|
| `android-guard.test.mjs` | rfr-android |
| `feedback.test.mjs`, `feedback-area.test.mjs` | rfr-feedback |
| `unreal-tier1.test.mjs`, `unreal-tutorial-demo.test.mjs` | rfr-unreal |
| guard-mcp tests from `hooks.test.mjs` | rfr-web |
| guard-unreal test from `hooks.test.mjs` | rfr-unreal |
| database and Vercel cases of `guard-commands` (`drizzle-kit`, `prisma`, `vercel --prod`), with their logic | rfr-web |

The logic moves with its tests: the PG-001 and production-deploy patterns leave `guard-commands.mjs` for an rfr-web hook, and the `mutation` and `tutorials` jobs in `rfr-process.yml` run only for the profiles that use them.

## Keep (unchanged unless a removal above touches them)

- **rules-for-robots tooling (repository):** `attention-report`, `build`, `ci-guards`, `ci-status`, `default-permissions` (changes when install-rules stops writing `ask` rules), `general-profile`, `grounded-evidence`, `guards-label-trigger`, `instruction-lint`, `model-adaptation`, `plan`, `plugin-split`, `regrade`, `release`, `release-notes`, `rules`, `smoke-decisions`, and 21 eval files: `eval-agent-cases`, `eval-architect-ladder`, `eval-fable-harness`, `eval-graders`, `eval-greenfield-cases`, `eval-large-repo-cases`, `eval-ls-dependency-contract`, `eval-ls-handoff`, `eval-ls-hard-to-reverse`, `eval-ls-hidden-harness`, `eval-ls-needs-live-test`, `eval-ls-park-and-continue`, `eval-ls-park-early`, `eval-ls-renamed-script`, `eval-ls-repeat-correction`, `eval-ls-stale-green-merge`, `eval-pipeline-case`, `eval-spec-cases`, `eval-tdd-cluster`, `eval-test-change-review-cases`, `eval-ux-cases`. Three eval files (`eval-ls-park-and-continue`, `eval-ls-park-early`, `eval-ls-repeat-correction`) load the delegated rule candidates; they change with the run-contract rule in the rules slice, not here.
- **rfr-core:** `decision-queue`, `guard-calibration`, `guard-corpus` (its expected decisions change with the guard), `guard-windows-paths`, `owned-paths`, `refuse-pr-approval`, `spec-lock`, `spec-lock-cluster`, `spec-lock-forms`, `spec-lock-status`, `spec-trace`, `spec-trace-multi`, `test-change-evidence`, `test-change-label-freshness`, `test-change-review`, `test-change-review-pr`.
- **rfr-process:** `process-briefs`, `process-change`, `process-change-tutorial`, `process-delivery`, `process-delivery-resume`, `process-delivery-validation`, `process-enabling-work`, `process-gate-report`, `process-github-gate`, `process-next`, `process-packet-minor-findings`, `process-relink`, `process-review-packet`, `process-review-response`, `process-rework-report`, `process-role-boundary`, `process-stage-order` (changes when guard-stages reads approval from the default branch), `process-stale-assignees`, `process-story-check`, `process-sync`, `process-sync-project`, `process-trace`, `process-tutorial-record`, `process-tutorials`, `process-workflow`, `tutorial-first-step-timeout`.

## Counts

| Class | Files |
|---|---|
| Remove | 14 whole, plus 4 of 6 tests in `default-allow` |
| Split | 7 |
| Merge | 19, into about 12 behaviour-named files |
| Move | 5 whole, plus parts of `hooks` and `guard-commands` |
| Keep | 80 |
| Removed by decision 1 (`process-tier`, `process-tier-inference`) | 2 |

About 30 fewer files (127 to roughly 95), and the 16 named after a pilot round are gone.

## Questions for the maintainer

Decided 2026-11-12: (1) retire the tier check; (2) remove the approvals check; (3) keep the deferred components' tests as they are. The questions are kept below as asked.

1. **The tier check.** `process / tier` infers a tier from the changed paths or reads a label; `process / change` (25c) already reads a `Change: fix` or `Change: trivial` claim from the commits. Recommended: retire `process / tier` and its label tests (`process-tier`, `process-tier-inference`, AC-27, AC-39), and have the mutation job read the change check's result instead. The alternative is to keep the tier and change it to read the claim, as 25c planned.
2. **The approvals check.** Recommended: remove `process / approvals` and its tests, since with D5 every project uses the gate and GitHub's required review holds a gated pull request. The alternative is to keep it, reporting "waiting for review" without failing.
3. **Deferred components** (issue sync, docs-lint, mutation, gate and rework reports, owned paths, notify gates): their tests are kept as they are, since the plan defers rather than removes them. Agreed?
