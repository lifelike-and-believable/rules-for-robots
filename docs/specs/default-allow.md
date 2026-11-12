---
status: draft
---

# Default allow

rfr flips its permission model. Today Claude Code asks about everything not allowed, rfr adds exceptions to stop the asks it can anticipate, and every unanticipated case becomes another prompt. Under this spec an rfr project allows the agent's working tools by default and asks only for a short, named list of actions: those that cannot be undone, reach outside the project, or are the person's review point. The guard tiers (`guard-tiers.md`) already define that list as tier 4. Proposed 2026-11-12 by the maintainer: "I want to be able to delegate the implementation of a designed feature or application to an agent or agents, and review the results, not become the bottleneck clicking on prompts that are mostly meaningless."

## Problem

- **The prompts are Claude Code's, not rfr's.** This repository's longest session (2026-11-09 to 11-12, `checks/attention-report.mjs`) had 69 permission prompts: 41 edits, 23 shell commands, 4 merges, 1 write. The median took 6 seconds to answer, which is approval without reading. rfr's guard log for the same days shows a handful of asks. The rest came from Claude Code's default mode and the auto-mode classifier, for actions the person had already agreed to.
- **Exceptions keep missing cases.** Allow rules (#188), task approval (#192), "merge when green" for the session's own pull request (#195), and standing instructions (#196) each removed one kind of prompt. The next session found the next kind: a chained commit and push, a script that edited a guide, a cloud session whose merge guard could not reach GitHub. Enumerating the safe cases cannot finish.
- **The prompts that matter get lost.** A person approving 69 prompts in 6 seconds each will approve the one force-push or production deploy among them the same way. Guard tiers made the same argument for rfr's own asks; it applies to all of them.
- **Delegation stops at the first prompt.** A delegated, multi-PR implementation (Phase 19) waits on every prompt, and in a headless run each prompt is a denial that ends the task.

## The idea

Three layers, each doing one job:

1. **Allow by default.** The project's `.claude/settings.json` allows the tools the agent works with: the shell, file edits, web search and fetch, and the GitHub tools for branches, pull requests, and comments. Claude Code then prompts only where a rule, a guard, or a protected path says so.
2. **Named asks.** The actions a person must decide are listed once (AC-2), enforced by the guards (which can ask even where an allow rule matches), and, where Claude Code's rule syntax can express them, also as `ask` or `deny` rules, so they hold when the plugin's hooks are not loaded.
3. **Containment for what nobody named.** A one-off script can do something no pattern describes. The defences are the ones already in place: snapshots before destructive local commands (guard tiers AC-11), git and the pull request as the review point, a disposable container in cloud sessions, and the Bash sandbox where the platform has one.

Task approval stays, for its original purpose: pre-approving a named ask in chat ("merge each PR when green", "release 5.11.0"). It stops being the way to avoid ordinary prompts.

## User stories

- As the maintainer, I want to agree a design and delegate its implementation to one or more agents, and come back to pull requests to review, with no prompts in between except for the named asks.
- As the maintainer, I want the few prompts I do get to be ones worth reading: each one irreversible, outward-facing, or my review point.
- As an adopter, I want to keep the old behaviour, or choose which named asks I pre-approve, with one setting.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | The template repositories and `/rfr-core:install-rules` write a default allow set to `.claude/settings.json`: `Bash`, `PowerShell`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `WebSearch`, `WebFetch`, and the GitHub MCP tools that read, create branches, push files, open and update pull requests, and comment (each named; merge, repository settings, and deletion tools are not in the set). The existing deny rules for `.env`, `.env.*`, and `*.pem` stay. | test: the generated settings for each profile hold the set and the deny rules, and no merge, settings, or delete tool. |
| AC-2 | The named asks are tier 4 of the guard tiers plus the review points, listed in one table in `practices/guards.md`: force-pushes and pushes to the default branch; deleting branches or tags, and history rewrites; `--no-verify`; global or system git config; `rm -rf` outside the repository, of root-like paths, or of anything no snapshot covers; destructive database commands; production deploys, promotions, and alias or domain changes; reads of secret values; merging a pull request; publishing a release or pushing a tag; and the open questions' answers. Each has a case in the guard corpus that must ask. | test: the corpus asks for every named ask; the table and the corpus list the same actions. |
| AC-3 | Each named ask that Claude Code's rule syntax can express is also an `ask` rule (or a `deny` rule for an action an agent never takes) in the generated settings, for example `Bash(git push --force *)`, `Bash(git push origin main)`, and `mcp__github__merge_pull_request`. Ask and deny rules are checked before allow rules, so they hold under the allow set, and they hold in a session where rfr's hooks are not loaded. | test: the generated rules; a fixture that runs Claude Code's documented rule order over the corpus commands. |
| AC-4 | Before release, a recorded check on the installed Claude Code version shows that a guard's `ask` prompts when an allow rule matches the same call, in `default` and `auto` mode, and that a headless run (`claude -p`) denies it. If it does not, the named asks move to `ask` rules only, and the spec records which ones the rules cannot express. | test: a scripted run, recorded in `evals/results/`. |
| AC-5 | A project chooses with `"permissions": "default-allow"` (the default for new projects) or `"ask"` (today's behaviour) in `.claude/rfr.json`. `install-rules` on an existing project shows the settings it would write and writes them only when the person agrees; Claude Code's protected-path prompt for `.claude/settings.json` is that agreement. | test: both values in the template build; install-rules' proposed diff. |
| AC-6 | Task approval approves only named asks. Its instructions for merges, releases, and preview deploys still work, and its push and branch rules are removed because pushes to non-default branches are allowed. | test: the task-approval tests for merges and releases pass; a push to a feature branch is allowed with no instruction. |
| AC-7 | WA-009 says: once the person has agreed the plan or design, carry it out without asking, except for the named asks; ask for those once, in chat, naming the action. WA-003's list of actions to confirm is the named-ask list. | review: the rules. |
| AC-8 | `practices/security-for-agentic-projects.md` explains the model, what default allow trusts (the agent, inside the project, with the pull request as review), what contains an unnamed dangerous command, and when to keep `"permissions": "ask"`: shared machines, credentials with wide reach, or no sandbox and no container. | review: the guide. |
| AC-9 | An eval measures it: a delegated implementation of a designed feature in three or more pull requests, run under default allow, prompts only for named asks (target: zero other prompts, by `checks/attention-report.mjs` and the guard log), and the guard corpus's dangerous cases still ask in the same configuration. | eval: the case and its report in `evals/results/`. |

## Scope

- In: the allow set, the named-ask list and its rules, the setting, install-rules and templates, the task-approval reduction, WA-009 and WA-003 wording, the guides, the check of hook asks under allow rules, and the eval.
- Out: Claude Code's protected paths (`.claude`, `.git`, `.mcp.json`), which no rule lifts outside `bypassPermissions`, so writes there keep prompting (rare in implementation work); MCP servers other than GitHub, which each project adds to its own allow set; managed policy settings.

## APIs and assumptions

- Permission rules are checked deny, then ask, then allow; the first match decides (Claude Code permissions documentation, as summarised in `practices/security-for-agentic-projects.md`).
- A PreToolUse hook's `deny` blocks in every mode. A hook's `ask` goes to the prompt in `default` and `auto` mode. Whether it prompts when an allow rule matches the same call is not stated in the documentation; AC-4 checks it.
- The Bash sandbox exists on macOS, Linux, and WSL2, not native Windows. The maintainer's local sessions run on native Windows, so containment there relies on snapshots, git, and the pull request, or on running delegated work in cloud sessions or WSL2.
- Cloud sessions get only the settings and plugins the repository commits. A repository without `.claude/settings.json` (as XR Studio In A Box was on 2026-11-12) gets neither the allow set nor the guards, so install-rules commits both.

## Risks

- **An unnamed dangerous command runs without a prompt.** For example, a script that deletes files outside the repository, or one that sends data out. Mitigation: containment (layer 3); the named list grows from the guard decision log and the attention report rather than from guesses; projects without a sandbox or container can keep `"ask"`.
- **Prompt injection gets further.** A web page or issue that persuades the agent to run a command now meets no prompt. Mitigation: SEC-003; the named asks cover the outward actions an injection usually aims at (pushes to the default branch, deploys, secret reads, merges); the network is limited in cloud sessions and in the sandbox.
- **The guards' patterns miss a variant of a named ask.** Mitigation: the `ask` rules of AC-3 as a second layer, and the corpus.

## Open questions

1. **Merges.** Ask for every merge unless an instruction covers it (proposed: the pull request is the review point), or allow merges once CI is green when the person delegated the whole feature?
2. **New dependencies** (`npm install <package>`, CODE-004). Allow, and judge them at the pull request (proposed), or keep them a named ask?
3. **Native Windows without a sandbox.** Accept default allow there with snapshots and the pull request (proposed), recommend cloud sessions or WSL2 for delegated work, or default those machines to `"ask"`?
4. **Network.** Allow `WebFetch` and outbound shell network access by default (proposed), or keep fetches to unlisted hosts as a named ask?
5. **Existing projects.** Offer default allow at the next `install-rules` (proposed), or switch them automatically with a changelog note?

## Delivery

- Plan item: `PLAN.md`, Phase 19 (delegated work), slice 19i.
- Slices, after the open questions are answered: 19i-1 the check of hook asks under allow rules (AC-4), first, since it decides how AC-2 and AC-3 are enforced; 19i-2 the settings, rules, setting, templates, and install-rules (AC-1 to AC-3, AC-5); 19i-3 task approval, the rules, and the guides (AC-6 to AC-8); 19i-4 the eval (AC-9).
- Pull requests: #PR (spec).
