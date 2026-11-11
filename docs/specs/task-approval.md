---
status: draft
---

# Task approval

The person approves tasks, not commands. When the latest message they typed in the session asks for a task (a release, a push to a named branch, a merge), the guards approve the commands that carry out that task, so Claude Code does not prompt for each one. Everything else still prompts or asks as before. Proposed 2026-11-11 by the maintainer, who found long sessions here prompting for routine commands after the task had been approved in chat.

## Problem

- A session asks in chat whether to release, the person says "release 5.8.2", and Claude Code then prompts for the tag, the tag push, and `gh release create` one by one. The person has already decided; the prompts are the same decision three more times.
- Allow rules (#188) cannot help with these: releases and pushes to new branches are outward-facing and hard to take back, so they should not run without the person's say-so, and a rule cannot tell whether the person said so.
- rfr-process's merge guard already reads the person's latest typed message and stops asking when it says to merge this pull request (project-process AC-52). It only stops its own question; Claude Code's prompt still appears unless an allow rule covers the merge.

## The idea

One mechanism in rfr-core, reused by rfr-process: a guard that finds the person's latest typed message, recognizes a task instruction in it, and, for a command that belongs to that task and to nothing else, returns `allow`. The message has to be one the person typed (Claude Code marks it `origin.kind: "human"`); tool results, notifications, other sessions, subagents, and pasted content in a tool result never count, so text the agent reads cannot approve anything.

## User stories

- As the maintainer, I want to say "release 5.8.2" once and have the tag, the push, and the release created without three more prompts.
- As the maintainer, I want commands I did not ask for, or that go beyond what I asked, to keep asking.
- As an adopter, I want to turn this off, and to see in the decision log which commands an instruction approved.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | A task instruction is recognized only in the person's latest typed message (as `latestHumanMessage` reads it today), and only when it is an instruction: not a question, not negated ("don't release yet"), and naming its target. Tasks in this version: **release** a version or tag (`release 5.8.2`, `publish rfr-v5.8.2`), **push** a named branch (`push phase-15/task-approval`), and **merge** a named or open pull request (project-process AC-52, unchanged). | test: recognized and rejected phrasings for each task; questions and negations rejected; text from tool results, notifications, and subagent entries ignored. |
| AC-2 | A command is approved only when every part of it belongs to the instructed task and names its target: for a release, `git tag -a <tag>` on a commit, `git push origin <tag>`, and `gh release create <tag>` where `<tag>` matches the version named; for a push, `git push [-u] origin <branch>` for the branch named. A command chained with anything else (`&&`, `;`, `|`) is not approved. | test: each covered command; the same commands with another tag or branch, chained with another command, or with extra refs. |
| AC-3 | Never approved, whatever the message says: a push to the default branch, a force-push or `--force-with-lease`, deleting a tag or branch (local or remote), `--no-verify`, and any command a deny rule or another guard refuses or asks about. A guard's refusal or question wins over an approval. | test: each excluded command with a matching instruction still asks or is refused. |
| AC-4 | An approved command gets `permissionDecision: "allow"` with a reason that quotes the instruction ("approved by your message: release 5.8.2"), and the decision log records it as `approved-by-instruction` with the task kind. `checks/guard-report.mjs` counts them. | test: hook output and log line; the report's count. |
| AC-5 | The approval lasts while that message is the person's latest: a session that waits for CI and acts on a notification still acts on it; the next message the person types replaces it. Notifications, task results, and messages from other sessions do not replace or extend it. | test: an instruction followed by notifications still covers the command; a new typed message ends it. |
| AC-6 | A project turns this off with `"taskApproval": "off"` in `.claude/rfr.json`; the guards then ask or defer to Claude Code as before. When the transcript cannot be read, nothing is approved. | test: the setting; an unreadable transcript. |
| AC-7 | WA-009 says: when a task needs the person's decision, ask for the task once in chat and name what it covers (for example "release 5.8.2: tag 69d8243, push the tag, publish the release"); after the person approves it, carry it out without asking again command by command. | review: the rule. |
| AC-8 | `practices/guards.md` and `practices/security-for-agentic-projects.md` describe the mechanism, what it never approves, and how it relates to allow rules (standing permission) and to task approval (one task, one message). | review: the guides. |

## Scope

- In: the shared recognizer and its use in `guard-commands` (releases, pushes); the merge guard's move to `allow` for covered merges; the setting; the log and report; WA-009; the guides.
- Out: eval runs and other spending (the agent asks, the person approves in chat, and the command still prompts until a later version decides how to bound spending); deploys and MCP tools; approvals given in answers to the agent's own questions (see open question 2).

## APIs and assumptions

- A PreToolUse hook that returns `permissionDecision: "allow"` skips Claude Code's permission prompt for that call; a matching deny rule still blocks it (Claude Code permissions documentation). To verify on the installed version before release.
- The transcript entry for a typed message carries `origin.kind: "human"`, as the merge guard relies on today (project-process AC-52).

## Non-functional requirements

- Plain Node, no dependencies, within the hook's time limit. The log never records the command or message text beyond the first 200 characters of the reason, as today.

## Open questions

1. Default: on for every project (adopters turn it off), or off until a project turns it on? The draft says on.
2. Should an answer to the agent's own question (`AskUserQuestion`) count as an instruction? Its answer reaches the transcript as a tool result, which the person chose but did not type. The draft says no.
3. Are release, push, and merge the right first tasks, or should one more be included (for example deploying a preview)?

## Delivery

- Plan item: `PLAN.md`, Phase 15.
- Slices: one, after this spec is approved: recognizer, guard changes, setting, log, WA-009, guides, and tests.
