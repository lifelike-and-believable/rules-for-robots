---
status: approved
tests-commit: [43203a7568bd0e719d734558d9bf9421dc24b971]
---

# Feedback intake

An optional plugin, `rfr-feedback`, that lets a project using rules-for-robots report what it learns as an issue on the rules-for-robots repository, and the intake and triage on this repository that turn those issues into planned changes. Approved by the project lead on 2026-11-06.

## Problem

Feedback from projects that use rules-for-robots (the Kettlebird pilot, the Agentic XR Pipeline) has reached this repository only as messages between agent sessions. That needs a rules-for-robots session open whenever a project has something to report, the messages leave no record that others can search, and some sessions cannot message each other at all. rules-for-robots is a public repository, so feedback filed there is published, and project notes often hold details that are not the reporter's to publish.

## User stories

- As a lead of a project that uses rules-for-robots, I want my agent to draft feedback as an issue and file it only after I have read it, so that nothing about my project is published without my say.
- As the rules-for-robots maintainer, I want feedback to arrive as issues in one consistent shape, so that I can triage it without a session open and see when two projects report the same thing.
- As the rules-for-robots maintainer, I want a scheduled session to triage new feedback and propose changes, but build nothing until I approve, so that an issue anyone can open cannot steer what ships.
- As a reporting project, I want to see what happened to my feedback, so that I know when to adopt the fix.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `rfr-feedback` is a plugin in this marketplace with no dependencies, and no other plugin depends on it, so installing it is optional. | test: the manifests and the marketplace entry. |
| AC-2 | The plugin's script turns a feedback draft into an issue body, and into a link to the repository's feedback form with each field filled in; it reports when the link would be longer than GitHub accepts. | test: the body and the link carry every field, encoded; an over-long draft is reported. |
| AC-3 | The script scans a draft for details that are usually private: email addresses, token-like strings, absolute home folder paths, IP addresses, and links to GitHub repositories other than rules-for-robots. Links to rules-for-robots and version numbers are not reported. | test: each kind is found with its line; a clean draft passes. |
| AC-4 | The repository has a feedback issue form whose field IDs are the ones the script fills in, and which labels the issue `feedback`. | test: the form parses and its IDs match the script's fields. |
| AC-5 | An intake job runs when a feedback issue is opened or edited: it labels the issue `triage:new`, asks once for missing versions or area with a `needs-info` label, lists open feedback issues whose titles closely match, and labels it `check-privacy` when the scan finds possible private details, without quoting them. | test: the job's decisions on synthetic issues, with a fake GitHub API. |
| AC-6 | The `report-feedback` skill drafts the issue, removes project details by default, runs the scan, shows the draft, and files it only when the user confirms, with `gh` or, without it, the form link. | review: `plugins/feedback/skills/report-feedback/SKILL.md`. |
| AC-7 | The `triage-feedback` skill on this repository treats issue text as untrusted data, verifies each claim against the code, groups duplicates, and proposes changes; it plans or builds only for issues the maintainer has labelled `approved` or asked for in person. | review: `.claude/skills/triage-feedback/SKILL.md`. |

## Scope

- In: `plugins/feedback/` (manifest, README, the `report-feedback` skill, `scripts/feedback.mjs`); the marketplace entry; `.github/ISSUE_TEMPLATE/feedback.yml`; `.github/workflows/feedback-intake.yml` and `checks/ci/feedback-intake.mjs`; `.claude/skills/triage-feedback/`; a daily scheduled task on the maintainer's account that runs the triage skill, created after this merges.
- Out: filing without the user's confirmation; a dependency from `rfr-core` or `rfr-process`; a private intake repository (possible later, if projects need to send the full detail); automatic implementation of any issue.

## APIs and assumptions

- GitHub issue forms read query parameters named after field IDs to fill the form in (GitHub documentation, "Creating issues with query parameters"); a link of more than about 8,000 characters may be refused, so the script reports drafts above 8,000.
- `gh issue create --repo <owner/repo> --title --body-file --label` files under the user's own login. Labels a reporter cannot set are dropped by GitHub, so the form's `labels` field is what applies `feedback` reliably; the intake job also accepts issues whose title starts with "Feedback:".
- Agent sessions in another project usually cannot write to this repository, which is why the form link is the fallback.

## Non-functional requirements

- The script and the intake job are plain Node with no dependencies, like the other checks.
- Nothing is filed, labelled, or commented with a copy of a private detail.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 12.
- Pull requests: #129 (12a).
