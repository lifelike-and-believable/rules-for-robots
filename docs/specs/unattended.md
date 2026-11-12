---
status: draft
unlocks:
  - test/hooks.test.mjs: AC-2 makes every guard decision that asked a refusal the agent acts on, so the hook-output tests for a force-push, a decrypting Vercel read, and a PowerShell delete expect that refusal; nothing else changes
  - test/default-allow.test.mjs: AC-4 makes a merge that is the person's review a refusal that tells the agent to leave the pull request for them and carry on, so the AC-4 test expects that reason
  - test/process-guard-merge.test.mjs: AC-4 as above for the merge guard's hook-output test
  - test/guard-tiers-15d.test.mjs: AC-7 removes a false positive the 2026-11-08 replay recorded (a script that only mentions a dangerous command, or a quoted argument that names one), so the replay test requires the current guards to be no stricter than the record, instead of identical; the baseline still reproduces exactly
---

# Unattended

An rfr session runs without the person. Nothing during the run asks them anything: no permission prompt, and no question in chat. Things Claude must never do are refused, and the refusal says what to do instead. Things only the person can authorise are decided before the run, in the plan, or set aside during it for the person to decide at review. Approved by the maintainer on 2026-11-12. It replaces default-allow's named asks and its chat approval (default-allow AC-2, AC-10).

The maintainer's requirements, in their words:

- "I don't EVER want to be prompted to approve a command. The text of the command is generally meaningless to me."
- "If there are things Claude shouldn't ever do, we should make it so Claude doesn't do them, not prompt me to allow Claude to do them. If a task or feature can't be built without doing something so dangerous I might need to deny it, then I'd rather know that ahead of time, not every 5 minutes while I'm waiting for Claude to complete. I don't ever want to be the bottleneck."
- "We already put safeguards in and tested them to prevent test weakening, so I don't want to be prompted, or asked about, editing tests, ever."
- "I shouldn't be getting prompts while Claude is just writing a spec."

## Problem

Default allow (6.0) removed Claude Code's prompts for ordinary work, but kept a list of "named asks", and 6.1 turned those into questions in chat. Both still interrupt the person mid-run: a question in chat blocks the run as surely as a prompt. And each guard that could not prove an action harmless asked about it, so every real session found another case (scratch folders under `/tmp`, a copy of the repository in `/var/tmp`).

## The model

1. **Never.** A short list of actions Claude does not take, in any session: force-pushes and pushes to the default branch; rewriting shared history; deleting on the remote; deleting outside the project and the temp folders; production deploys, promotions, and domain changes; reading secret values; skipping hooks; machine-wide settings; destructive commands against a database; and changes made in another service through an MCP tool. Each is refused with a reason that names what to do instead (a branch, a preview deploy, a migration file). No one is asked.
2. **Allowed.** Everything else: edits (tests included; the test-change review at the pull request judges test changes), shell commands, deletes in the project that git or a snapshot can restore, deletes in temp folders, pushing branches, opening pull requests, and merging when the checks pass.
3. **Decided in the plan.** What only the person can authorise (a release, a production deploy, a migration on a shared database, a new paid service) is named in the plan, and the person's approval of the plan (their own words, read by task approval) covers it. Something unplanned is not asked about: the agent sets that part aside, records it in the pull request's `## Decisions` section, and finishes the rest.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | No rfr guard prints a permission prompt (`ask`) unless the project sets `"permissions": "ask"` (or `RFR_PERMISSIONS=ask`). | test: every hook's output for the guard corpus's tier-4 cases. |
| AC-2 | Each action on the never list is refused with a reason that names what to do instead, and says that if the task cannot be done without it, the agent sets that part aside, records it in `## Decisions`, and carries on. There is no approval in chat. | test: the refusal reasons; no approval after a "yes". |
| AC-3 | The person's own words approve what the plan names: task approval's release, merge, and standing instructions still allow those calls without a prompt or a refusal. | test: a release and a gated merge the person asked for are allowed. |
| AC-4 | A merge that is the person's review (rfr-process gated documents with no instruction covering it) is refused with a reason that tells the agent to leave the pull request for the person, note it in its report and `## Decisions`, and carry on. | test: the merge guard's reason. |
| AC-5 | Test edits never interrupt the person: under the default settings no test edit, test removal, or snapshot update asks, and the test-change review decides at the pull request. | test: weakening, unclear, and removal changes. |
| AC-6 | WA-002, WA-003, and WA-009 say: name what only the person can authorise in the plan, before work starts; during the run, never ask, park and record instead; never trigger a permission prompt. The delegated-mode candidates say the same. | review: the rules. |
| AC-7 | Replaying the commands of real sessions (this repository's session of 2026-11-09 to 11-12 and the XR Studio In A Box cloud session of 2026-11-12) through the guards refuses only actions on the never list. | test: a recorded replay in `evals/results/`. |
| AC-8 | `practices/guards.md` and `practices/security-for-agentic-projects.md` describe the model, and say that Claude Code's own prompts (protected paths, the auto-mode classifier) go only in `bypassPermissions` mode, which the person chooses, and in which rfr's refusals still hold. | review: the guides. |

## Delivery

- Plan item: `PLAN.md`, Phase 19, slice 19j.
- Pull requests: #PR.
