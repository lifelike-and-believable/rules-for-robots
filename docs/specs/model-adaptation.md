---
status: implemented
---

# Model adaptation

A standing procedure for when a new Claude model reaches Claude Code: a fixed, budgeted eval suite that can run within days of the release, a ledger that records which rules, agents, and skills have evidence on which model, and a set of decisions the results feed (keep, rewrite, demote, or remove a rule; change an agent's model; replace a saturated eval case). The plan already says rules are re-evaluated on every new model generation (principle 8; `docs/maintenance.md`, "Review cycle"), but it does not say how, at what cost, or where the result is kept. This spec fills that gap. It is written so that it does not depend on any one release. Approved by the project lead on 2026-11-08.

## Problem

New models will keep arriving, and the rule set is tuned to one generation:

- Decision 7 and section 5 of `PLAN.md` are written for Opus 5.5 and Sonnet 5.5. The wording guidance in section 5 (emphatic wording over-triggers; generic "verify" causes over-verification on Opus 5 and later) changed between the 4.x and 5.x generations and may change again.
- Nothing records which rules have evidence on which model. `observed-on` records where a failure was seen, not where a rule was tested, and 41 of 54 rules have `observed-on: []`. After a new model ships, there is no way to tell which rules have been checked against it and which are carried over on old evidence.
- The eval cases saturate. The seed tasks showed none of the target failures even without rules; round 2's no-rules baseline passed 18 of 18; in Phase 8, three of five cases showed no rule effect on either model. A case the no-rules arm passes cannot show that a rule helps, and a stronger model will saturate more of them. METR's assessment of Anthropic's internal "Model 4" (2026-11-05) reports the same problem for its own benchmarks: the model scored above 50% on all 15, and METR wrote that the lack of hard benchmarks "makes us somewhat nervous".
- Agents name `opus` or `sonnet` as aliases (9 of 12 `rfr-core` agents), so a new model reaches adopters when the alias moves, with no eval. That is the right default for adopters, but the changelog cannot say which model a release was tested on.
- Releases are getting closer together. The same METR report estimates that Anthropic's benchmark progress has run at about 1.9 times its earlier rate since October 2025, and three internal models finished training between July and October 2026. A quarterly review alone can fall a full generation behind.
- Each rule costs money on every run: rules added about 40% to the cost of a run in Phase 8, and hooks 43 to 57% more. A rule that no longer changes behaviour is a cost with no return (R38).

## User stories

- As the maintainer, I want one command that runs the agreed suite on a new model within a fixed budget, so that a model release starts a routine instead of a research project.
- As the maintainer, I want to see, for any model, which rules have evidence on it, which showed no effect, and which have not been tested, so that I decide what to keep from data.
- As the maintainer, I want saturated eval cases flagged, so that I know which results can no longer show a rule's effect and which cases need harder variants.
- As an adopter, I want each release to say which models its rules and agents were evaluated on, so that I know whether a model change in my project is covered.
- As a session working on this repository, I want a checklist issue opened when a new model is noticed, so that the review does not depend on someone remembering it.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `evals/suites/model-release.json` lists the cases, arms, and runs for a model-release run. It contains every case that has shown a rule or hook effect on any model (a cell where the `none` arm failed at least one run and a rules arm passed more), with the `none` and `rules` arms, and one saturated case per target failure in the `none` arm only, as a control that shows whether the failure has come back. Each entry names the case and the reason it is in the suite. | test: the suite file parses, every case exists in `evals/cases/`, every arm is a known arm, and every entry has a reason. |
| AC-2 | `node evals/run.mjs --suite model-release --models <id>` runs the suite on the named models. `--max-cost <usd>` stops starting new runs once the recorded cost of finished runs reaches the cap, and the summary says how many were skipped. | test: suite expansion into jobs, and the cost cap stopping the pool with a fake runner. |
| AC-3 | Each run record in `runs.json` has the model ID the session reported (from the stream's `init` event or the result's per-model usage), not only the ID or alias requested, and the Claude Code version. When the reported and requested IDs differ, the summary says so. | test: parsing a recorded stream with a matching ID, a different ID, and no init event. |
| AC-4 | `evals/ledger.json` holds one entry per rule, agent, or skill and model: the subject, the model ID, the verdict (`effective`, `no-effect`, `negative`, `saturated`, or `not-run`), the result folder, and the date. `node checks/model-ledger.mjs add <results folder>` adds entries from a run's `runs.json` and each case's `rules`: a rule is `effective` on a model when its rules arm passes more runs than the `none` arm on a case that targets it, `negative` when it passes fewer, `saturated` when the `none` arm passes every run, and `no-effect` otherwise. Agent and skill entries come from the smoke tests' results. | test: each verdict from fixture results, and a second run on the same model replacing the first entry. |
| AC-5 | `node checks/model-ledger.mjs report <model>` lists, for that model, each rule with its level, verdict, and evidence, then the rules with no entry, and the cases that are saturated on it. `--since <model>` compares two models and lists the rules whose verdict changed. `--json` prints the same. It exits 0 in every case; it reports and does not gate. | test: a report from a fixture ledger, a comparison of two models, and the JSON shape. |
| AC-6 | The rule lint accepts an optional `evaluated-on` field: model IDs on which the rule has an `effective` verdict in the ledger. The lint warns when the field and the ledger disagree, so the rule file shows its evidence without anyone reading the ledger. | test: a rule whose field matches the ledger, one that names a model the ledger does not, and one with no field. |
| AC-7 | `docs/maintenance.md` has a "New model" section: when it applies (a new model ID in Claude Code's model list, or an alias that resolves to a new ID), the order of work (run the suite on the new model at default and recorded effort, run the agent and skill smoke tests, update the ledger, read the report, decide), the budget, and the decisions in the table under "Decisions after a run". It names the issue form in AC-8. | review: the maintenance guide. |
| AC-8 | A `model-release` issue form in `.github/ISSUE_TEMPLATE/` holds the checklist from AC-7, with fields for the model ID and the date it reached Claude Code. | review: the issue form. |
| AC-9 | `PLAN.md` section 5 is split: guidance that has held on two or more generations stays in section 5 under a heading that names no generation, and generation-specific verdicts move to a table with one column per evaluated generation. Decision 7 says the rule set targets the newest Opus and Sonnet generations that have a ledger entry, and names them. | review: the plan. |
| AC-10 | Each changelog release entry has an "Evaluated on:" line naming the model IDs of the newest ledger run, and `checks/release.mjs` fails a release entry that has none. Entries before the first release under this spec are exempt. | test: a release entry with the line, one without it, and an older entry. |
| AC-11 | A baseline run of the suite on the current models (Opus 5.5 and Sonnet 5.5) fills the ledger, so the first new model is compared with something. The report goes in `evals/results/` and the run's cost is recorded in the pull request. | eval: `evals/results/<stamp>-model-release-baseline/`. |

## Decisions after a run

The report informs these; the maintainer decides, and each change goes through the normal pull request, version bump, and changelog.

| Ledger result on the new model | Default decision |
|---|---|
| A rule is `effective` | Keep it, and add the model to `evaluated-on`. |
| A rule is `negative` | Rewrite or remove it before the next release, and say which in the changelog. |
| A SHOULD or MAY rule is `no-effect` or `saturated` on the two newest generations | Move its advice to the practice guide it links to, and retire the rule ID (R38). |
| A MUST rule is `no-effect` or `saturated` | Keep the hook or CI check, which costs nothing when it does not fire; consider moving the text to the practice guide. The guard decision log (Phase 15) shows whether the hook still fires. |
| A target failure reappears in a `none`-arm control | Treat its rules as `effective` again, and add a harder case for it. |
| A case is `saturated` on every current model | Mark it in `evals/README.md`, keep it as a control, and add a harder variant before it counts as evidence. |
| An agent or skill smoke test fails on the new model | Pin that agent to the last model it passed on, with the reason in its frontmatter comment, until it is fixed. |
| A Haiku or Sonnet agent passes where the plan gave it a larger model | Consider the cheaper model, with a smoke test as evidence (R21). |

## Scope

- In: the suite file, the runner's `--suite` and `--max-cost` options, model ID recording, the ledger and its check, the `evaluated-on` field, the maintenance section and issue form, the section 5 restructure, the changelog line and its check, and the baseline run.
- Out: detecting new models automatically. A scheduled task that reads the Models API or Claude Code's model list would need an API key or network access this repository's sessions may not have; the issue form comes first, and a scheduled check is a later slice if manual detection proves slow. Also out: evaluating models from other vendors, and changing any rule before the baseline exists.

## APIs and assumptions

- `claude -p --output-format stream-json --verbose` emits a `system` event of subtype `init` that names the session's model, and the final `result` event reports usage per model ID. `evals/run.mjs` already reads this stream for cost. Confirmed in 17a on Claude Code 2.1.319: the init event has `model` and `claude_code_version`, an alias such as `haiku` is reported as the ID it resolved to (`claude-haiku-5-5`), and the result has `modelUsage` keyed by model ID.
- Smoke tests pass or fail per case, so an agent or skill is `effective` on a model when every one of its smoke cases passed and `negative` when any failed. Smoke results record the main session's model; results from before 17a used `claude-sonnet-5-5`.
- When one results folder has several cases for a rule, the verdict that most needs attention wins: `negative`, then `effective`, `no-effect`, and `saturated`.
- Model aliases (`opus`, `sonnet`, `haiku`) in agent frontmatter resolve to the newest model of that family that Claude Code offers; pinned IDs do not move.
- The suite built in 17a has 27 runs per model: two effect cases in two arms and five controls in one, three runs each. At Phase 8's mean cost per run that is about $3 for Sonnet and $5 for Opus; the suite's `maxCostUsd` of $40 leaves room for harder and long-session cases. (The draft estimated 60 to 120 runs before the suite was chosen.) The long-session cases from #69 cost more per run and join the suite only once they show an effect.

## Non-functional requirements

- The ledger check is plain Node with no dependencies and no network calls, like the other checks.
- The ledger is a reviewed file: entries are added by the check from committed results, and the pull request that adds them names the run.
- The report never fails `npm run verify`; only the release check (AC-10) gates, and only on the changelog line.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 17.
- Slices: 17a the suite, the runner options, model ID recording, and the ledger and its check (AC-1 to AC-6); 17b the maintenance section, the issue form, the plan restructure, and the changelog check (AC-7 to AC-10); 17c the baseline run (AC-11), with the first decisions it supports.
- Pull requests: #149 (spec and 17a), #152 (17b and 17c).
