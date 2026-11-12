---
status: implemented
---

# Task approval

The person approves tasks, not commands. When the person's latest input in the session asks for a task (a release, a push to a named branch, a merge, a preview deploy), the guards approve the commands that carry out that task, so Claude Code does not prompt for each one. Everything else still prompts or asks as before. Proposed 2026-11-11 by the maintainer, who found long sessions here prompting for routine commands after the task had been approved in chat. The maintainer answered the open questions the same day (see "Decisions"), and the slice that implements it followed (#192).

## Problem

- A session asks in chat whether to release, the person says "release 5.8.2", and Claude Code then prompts for the tag, the tag push, and `gh release create` one by one. The person has already decided; the prompts are the same decision three more times.
- Allow rules (#188) cannot help with these: releases and pushes to new branches are outward-facing and hard to take back, so they should not run without the person's say-so, and a rule cannot tell whether the person said so.
- rfr-process's merge guard already reads the person's latest typed message and stops asking when it says to merge this pull request (project-process AC-52). It only stops its own question; Claude Code's prompt still appears unless an allow rule covers the merge.

## The idea

One mechanism in rfr-core, reused by rfr-process and rfr-web: a guard that finds the person's latest input, recognizes a task instruction in it, and, for a command that belongs to that task and to nothing else, returns `allow`. The input is either a message the person typed (Claude Code marks it `origin.kind: "human"`) or the person's answer to the agent's own multiple-choice question (`AskUserQuestion`), which the person chose in Claude Code's interface. Other tool results, notifications, other sessions, subagents, and pasted content never count, so text the agent reads cannot approve anything.

## User stories

- As the maintainer, I want to say "release 5.8.2" once and have the tag, the push, and the release created without three more prompts.
- As the maintainer, I want commands I did not ask for, or that go beyond what I asked, to keep asking.
- As an adopter, I want to turn this off, and to see in the decision log which commands an instruction approved.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | A task instruction is recognized only in the person's latest input: their latest typed message (as `latestHumanMessage` reads it today), or, when it came later, their answer to an `AskUserQuestion` call whose question and chosen option together name the task ("Release 5.8.2?" answered "Yes, release it"); a "no", "not yet", or "other" answer approves nothing. The instruction must not be a question or negated ("don't release yet"), and must name its target. Tasks in this version: **release** a version or tag (`release 5.8.2`, `publish rfr-v5.8.2`), **push** a named branch (`push phase-15/task-approval`), **merge** a named or open pull request (project-process AC-52, extended to answers), and **deploy a preview** (`deploy a preview`, `preview deploy`). | test: recognized and rejected phrasings for each task; questions and negations rejected; an answer that names the task, one that declines, and one to an unrelated question; text from other tool results, notifications, and subagent entries ignored. |
| AC-2 | A command is approved only when every part of it belongs to the instructed task and names its target: for a release, `git tag -a <tag>` on a commit, `git push origin <tag>`, and `gh release create <tag>` where `<tag>` matches the version named; for a push, `git push [-u] origin <branch>` for the branch named; for a preview deploy, `vercel deploy` or `vercel` (directly or through `npx`) without `--prod`, and a Vercel MCP deployment call whose target is not production. A command chained with anything else (`&&`, `;`, or a pipe) is not approved. | test: each covered command and MCP call; the same commands with another tag or branch, chained with another command, or with extra refs. |
| AC-3 | Never approved, whatever the input says: a push to the default branch, a force-push or `--force-with-lease`, deleting a tag or branch (local or remote), `--no-verify`, a production deploy (`--prod`, a production target, `vercel promote`, alias or domain changes), and any command a deny rule or another guard refuses or asks about. A guard's refusal or question wins over an approval. | test: each excluded command or call with a matching instruction still asks or is refused. |
| AC-4 | An approved command gets `permissionDecision: "allow"` with a reason that quotes the instruction ("approved by your message: release 5.8.2"), and the decision log records it as `approved-by-instruction` with the task kind. `checks/guard-report.mjs` counts them. | test: hook output and log line; the report's count. |
| AC-5 | The approval lasts while that input is the person's latest: a session that waits for CI and acts on a notification still acts on it; the next message the person types, or their next answer, replaces it. Notifications, task results, and messages from other sessions do not replace or extend it. A standing instruction (AC-9) is the exception. | test: an instruction followed by notifications still covers the command; a new typed message or answer ends it. |
| AC-6 | It is on by default. A project turns it off with `"taskApproval": "off"` in `.claude/rfr.json`; the guards then ask or defer to Claude Code as before. When the transcript cannot be read, nothing is approved. | test: the default; the setting; an unreadable transcript. |
| AC-7 | WA-009 says: when a task needs the person's decision, ask for the task once in chat and name what it covers (for example "release 5.8.2: tag 69d8243, push the tag, publish the release"); after the person approves it, carry it out without asking again command by command. | review: the rule. |
| AC-8 | `practices/guards.md` and `practices/security-for-agentic-projects.md` describe the mechanism, what it never approves, and how it relates to allow rules (standing permission) and to task approval (one task, one message). | review: the guides. |
| AC-9 | A standing instruction, a typed message that asks to merge or push repeatedly as the work goes ("merge each PR when green", "merge PRs as you go", "keep merging", "push each branch as you go"), stays in force after the person's later messages and answers. "Each" and "every" count only with what they count ("each PR", "every branch"), so "merge when every check passes" is a single instruction. Questions and negations are not standing instructions. The approval's reason quotes the standing instruction. | test: recognized and rejected phrasings; a later unrelated message, a notification, and a tool result leave it in force. |
| AC-10 | A standing instruction ends when a later typed message says not to merge (or push), or says stop, pause, halt, hold, or wait. Withdrawing merges leaves a standing push in force, and the reverse. A new standing instruction starts it again. | test: each withdrawal; a new instruction after one; merge and push withdrawn separately. |
| AC-11 | A standing instruction covers only what the session itself created: a merge of a pull request whose creating call (the GitHub MCP `create_pull_request` tool, or `gh pr create`) and link are in the transcript, and a push of a branch a successful command in the transcript created (`git switch -c`, `git checkout -b`, `git branch`, `git worktree add -b`). AC-3 still holds: never the default branch, a force-push, or a deletion. In rfr-process projects the merge guard uses it for the GitHub MCP merge tools. | test: the session's own pull request and branches; another pull request, another branch, and a failed branch command; the MCP merge tool through the merge guard. |

## Scope

- In: the shared recognizer and its use in `guard-commands` (releases, pushes, preview deploys through the Vercel CLI) and rfr-web's `guard-mcp` (preview deploys through the Vercel MCP server); the merge guard's move to `allow` for covered merges; answers to `AskUserQuestion`; the setting; the log and report; WA-009; the guides.
- Out: eval runs and other spending (the agent asks, the person approves in chat, and the command still prompts until a later version decides how to bound spending); production deploys; MCP tools other than Vercel deployments.

## APIs and assumptions

- A PreToolUse hook that returns `permissionDecision: "allow"` skips Claude Code's permission prompt for that call; a matching deny rule still blocks it (Claude Code permissions documentation). To verify on the installed version before release.
- The transcript entry for a typed message carries `origin.kind: "human"`, as the merge guard relies on today (project-process AC-52).
- An `AskUserQuestion` answer reaches the transcript as the tool result for that call, holding the chosen option's label (or the person's own text for "other"); the guard pairs it with the call's question by `tool_use_id`. To check against a recorded transcript before building, since the merge guard has not relied on it.

## Non-functional requirements

- Plain Node, no dependencies, within the hook's time limit. The log never records the command or message text beyond the first 200 characters of the reason, as today.

## Decisions (2026-11-11)

The maintainer answered the draft's three open questions:

1. On by default; a project turns it off in `.claude/rfr.json` (AC-6).
2. An answer to the agent's own `AskUserQuestion` counts as an instruction when the question and chosen option name the task, because the person chose it in Claude Code's interface (AC-1).
3. Preview deploys join release, push, and merge as tasks; production deploys stay excluded (AC-1 to AC-3).

## Amendment: standing instructions (2026-11-12)

The maintainer's goal: once a design is agreed, implementation should need few or no prompts, including long multi-PR tasks. Under AC-5 a "merge when green" ended at the person's next message, so any comment during a long task brought the merge prompt back at the next pull request. The maintainer asked for a standing instruction and approved building it the same day ("spec and build it"). AC-9 to AC-11 add it. They keep it to what the session itself created, so a standing instruction never merges or pushes someone else's work, and keep AC-3's exclusions.

## Delivery

- Plan item: `PLAN.md`, Phase 15.
- Slices: one, after this spec is approved: recognizer, guard changes, setting, log, WA-009, guides, and tests. Done (#192).
- Pull requests: #191 (spec), #192 (implementation), #196 (standing instructions, AC-9 to AC-11).
