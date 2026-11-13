---
status: draft
unlocks:
  - test/process-guard-merge.test.mjs: AC-4 makes a merge that needs the person's review a refusal that tells the agent to stop and report, so the hook-output test expects that under default allow, and an ask under "permissions": "ask"; nothing else changes
  - test/fixtures/guard-corpus.json: AC-2 adds the named asks the guards did not cover (pushes to the default branch, remote deletions, tag pushes and releases, production deploys through the Vercel CLI) and two allowed pushes and deploys; no existing case changes
  - test/hooks.test.mjs: AC-10 makes every decision for the person a refusal that sends the agent to ask in chat, so the hook-output tests for a force-push, a decrypting Vercel read, and a PowerShell delete expect that refusal; AC-2 (decision 6) treats a folder in a temp folder as scratch, so the rm -rf test names a path outside the project and every temp folder
  - test/guard-outcomes.test.mjs: AC-10 keeps the prompt only under "permissions": "ask", so the tests of logging an asked call run with RFR_PERMISSIONS=ask; nothing else changes
  - test/guard-calibration.test.mjs: AC-10 as above for the decision-log test; AC-2 (decision 6) no longer asks for a folder directly under the temp folder, so that case leaves the list of deletes that ask
  - test/default-allow.test.mjs: AC-10 makes an MCP change through another service a chat decision and lets Vercel calls through to rfr-web's guard, so the AC-1 test expects the Vercel call allowed
  - test/rm-own-scratch.test.mjs: AC-2 (decision 6) treats any folder in a temp folder, other than the project, as scratch, so the test of what still asks keeps the temp folder itself, a glob that climbs into it, and a path outside
---

# Default allow

> Retired on 2026-11-12 by [rewrite plan 25e](../../rewrite-plan.md): whether Claude Code prompts is the session's permission mode (auto mode), and rfr's hooks only refuse the never list. Kept as a record; its tests and code are removed.

rfr flips its permission model. Today Claude Code asks about everything not allowed, rfr adds exceptions to stop the asks it can anticipate, and every unanticipated case becomes another prompt. Under this spec rfr allows the agent's working tools by default and asks only for a short, named list of actions that cannot be undone or reach outside the project. When work reaches something the person must review, the agent stops and reports; it does not raise a prompt. Proposed 2026-11-12 by the maintainer: "I want to be able to delegate the implementation of a designed feature or application to an agent or agents, and review the results, not become the bottleneck clicking on prompts that are mostly meaningless." Approved the same day, with the five open questions decided below. The `status` field stays `draft` until every `test:` criterion has a citing test, because `spec-trace` treats every uncited criterion of an approved spec as an error.

## Problem

- **The prompts are Claude Code's, not rfr's.** This repository's longest session (2026-11-09 to 11-12, `checks/attention-report.mjs`) had 69 permission prompts: 41 edits, 23 shell commands, 4 merges, 1 write. The median took 6 seconds to answer, which is approval without reading. rfr's guard log for the same days shows a handful of asks. The rest came from Claude Code's default mode and the auto-mode classifier, for actions the person had already agreed to.
- **Exceptions keep missing cases.** Allow rules (#188), task approval (#192), "merge when green" for the session's own pull request (#195), and standing instructions (#196) each removed one kind of prompt. The next session found the next kind: a chained commit and push, a script that edited a guide, a cloud session whose merge guard could not reach GitHub. Enumerating the safe cases cannot finish.
- **The prompts that matter get lost.** A person approving 69 prompts in 6 seconds each will approve the one force-push or production deploy among them the same way.
- **A prompt is the wrong way to ask for a review.** A merge prompt asks the person to judge a pull request from a one-line dialog. The review belongs on the pull request, and the agent's job is to say that one is waiting.
- **Delegation stops at the first prompt.** A delegated, multi-PR implementation (Phase 19) waits on every prompt, and in a headless run each prompt is a denial that ends the task.

## The idea

Three layers, each doing one job:

1. **Allow by default.** An rfr-core hook returns `allow` for the agent's working tools: the shell, file edits, web search and fetch, and the GitHub tools, whenever no guard refuses or asks about the call. A hook ships with the plugin, so every project gets it on its next plugin update, cloud sessions included, without writing its settings.
2. **Named asks and review stops.** A short list of actions asks the person: those that cannot be undone or reach outside the project (AC-2). Where work needs the person's review (a merge that approves gated process files, a test change the reviewer referred, a decision only the person can make), the guard refuses with a reason, and the agent stops and reports in chat. Neither is a prompt about ordinary work.
3. **Containment for what nobody named.** A one-off script can do something no pattern describes. The defences are the ones already in place: snapshots before destructive local commands (guard tiers AC-11), git and the pull request as the review point, required checks before a merge, a disposable container in cloud sessions, and the Bash sandbox where the platform has one.

Task approval stays for the named asks the person may approve in chat ("release 5.11.0"), and for merges that are the person's approval ("merge each PR when green" in an rfr-process project). It stops being the way to avoid ordinary prompts.

## User stories

- As the maintainer, I want to agree a design and delegate its implementation to one or more agents, and come back to pull requests to review, with no prompts in between except for the named asks.
- As the maintainer, I want the agent to stop and tell me when something needs my review, rather than raise a prompt about it.
- As the maintainer, I want the few prompts I do get to be ones worth reading: each one irreversible or outward-facing.
- As an adopter, I want to keep the old behaviour with one setting.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | An rfr-core PreToolUse hook returns `allow` for `Bash`, `PowerShell`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `WebSearch`, `WebFetch`, and the GitHub MCP tools, unless the call is a named ask or a review stop (AC-2, AC-4), or the project set `"permissions": "ask"` (AC-5). It never allows a call for which another rfr guard refuses or asks, and a deny rule or a protected path still applies. Adding a dependency and network access from the shell are allowed; the pull request judges new dependencies (CODE-004). | test: the hook's decision for each tool, with and without a guard objecting; the setting. |
| AC-2 | The named asks are listed in one table in `practices/guards.md`, and each has a corpus case that must ask: force-pushes and pushes to the default branch; deleting branches or tags, and history rewrites; `--no-verify`; global or system git config; `rm -rf` outside the repository, of root-like paths, or of anything no snapshot covers; destructive database commands; production deploys, promotions, and alias or domain changes; reads of secret values; and publishing a release or pushing a tag. Merging is not a named ask (AC-4). | test: the corpus asks for every named ask; the table and the corpus list the same actions. |
| AC-3 | Before release, a recorded check on the installed Claude Code version shows how decisions from several hooks combine on one call: one hook's `allow` with another's `ask` prompts the person, and with another's `deny` refuses the call, in `default` and `auto` mode. If they do not combine that way, the default-allow hook evaluates rfr-core's guards itself and leaves the tools other rfr plugins guard (merges in rfr-process, Vercel in rfr-web) to Claude Code, and the spec records it. | test: a scripted run, recorded in `evals/results/`. |
| AC-4 | A merge of a pull request is allowed without a prompt. GitHub's required checks make it wait for green CI: `install-rules` reports when the default branch does not require the project's verify check. Where merging needs the person's review, the guard refuses with a reason telling the agent to stop, report what is waiting, and carry on with other work; it never asks: in rfr-process, a pull request that touches gated process files and no instruction of the person's covers (the merge is the approval, project-process AC-52); and a pull request whose test changes the reviewer referred. | test: a merge with no gated files is allowed; one with gated files and no instruction is refused with the reason; the same with "merge each PR when green" is allowed. |
| AC-5 | It is on for every project from the release that ships it, with a changelog note. `"permissions": "ask"` in `.claude/rfr.json` restores the old behaviour: the hook decides nothing and Claude Code's own settings apply. `install-rules` commits `.claude/settings.json` with the plugins enabled, so cloud sessions load the guards, and adds `ask` and `deny` rules for the named asks Claude Code's syntax can express, as a second layer where the hooks are not loaded. | test: both setting values; install-rules' settings for each profile. |
| AC-6 | Task approval covers releases and preview deploys as before, and merges in rfr-process projects that touch gated files (AC-4). Under default allow a push to a branch other than the default needs no instruction; task approval's push rules stay for projects that set `"permissions": "ask"`. Amended 2026-11-12 while building: removing them would have taken the push approval away from those projects for no gain. | test: the task-approval tests for releases and gated merges pass; a push to a feature branch is allowed with no instruction. |
| AC-7 | WA-009 says: once the person has agreed the plan or design, carry it out without asking, merging each pull request when its checks pass; when the work reaches something only the person can review or decide, stop and report it in chat, never by triggering a prompt; ask for a named ask once, in chat, naming the action. WA-003's list of actions to confirm is the named-ask list. | review: the rules. |
| AC-8 | `practices/security-for-agentic-projects.md` explains the model, what default allow trusts (the agent, inside the project, with the pull request and required checks as review), what contains an unnamed dangerous command, the residual risk on machines without a sandbox (native Windows), and when to choose `"permissions": "ask"`: shared machines, or credentials with wide reach. | review: the guide. |
| AC-10 | No guard raises a permission prompt. A decision for the person (each named ask, an MCP tool that changes something through another service, and a merge that is the person's review) is a refusal whose reason tells the agent to ask in chat, in plain words, what it wants to do and why, not the command text. When the person's next input (a message they type, or their answer to the agent's own question) says yes, the same call goes ahead once without a prompt; a no, a question, or a different call approves nothing. `"permissions": "ask"` (or `RFR_PERMISSIONS=ask`) brings the prompts back. Added 2026-11-12 (decision 6). | test: the refusal and its reason; a yes, then the same call allowed once; a no, a question, and a different call refused; an answer to the agent's question; an MCP change; the setting. |
| AC-9 | An eval measures it: a delegated implementation of a designed feature in three or more pull requests, run under default allow, prompts only for named asks (target: none, by `checks/attention-report.mjs` and the guard log), stops and reports at a review point, and the guard corpus's dangerous cases still ask in the same configuration. | eval: the case and its report in `evals/results/`. |

## Scope

- In: the default-allow hook, the named-ask list, review stops at merge, the setting, install-rules' settings and second-layer rules, the task-approval reduction, WA-009 and WA-003, the guides, the check of combined hook decisions, and the eval.
- Out: Claude Code's protected paths (`.claude`, `.git`, `.mcp.json`), which no hook lifts outside `bypassPermissions`, so writes there keep prompting (rare in implementation work); MCP servers other than GitHub, which keep Claude Code's prompts unless a project allows them; managed policy settings.

## APIs and assumptions

- A PreToolUse hook that returns `allow` skips Claude Code's permission prompt, and a matching deny rule still blocks the call (Claude Code permissions documentation; task approval relies on the same).
- How Claude Code combines different decisions from several hooks on one call is not stated in the documentation as summarised in `practices/security-for-agentic-projects.md`; AC-3 checks it before anything relies on it.
- Permission rules are checked deny, then ask, then allow; the first match decides.
- The Bash sandbox exists on macOS, Linux, and WSL2, not native Windows. On native Windows the maintainer accepts default allow with snapshots, git, required checks, and the pull request as containment (decision 3).
- Cloud sessions get only the settings and plugins the repository commits. A repository without `.claude/settings.json` (as XR Studio In A Box was on 2026-11-12) gets neither the hook nor the guards, so install-rules commits it.
- Required checks are a GitHub branch protection setting. A repository without them lets a merge through before CI finishes; install-rules reports it, and the agent still merges only when the checks are green (WA-009).

## Risks

- **An unnamed dangerous command runs without a prompt.** For example, a script that deletes files outside the repository, or one that sends data out. Mitigation: containment (layer 3); the named list grows from the guard decision log and the attention report rather than from guesses; `"permissions": "ask"` for shared machines.
- **Prompt injection gets further.** A web page or issue that persuades the agent to run a command now meets no prompt. Mitigation: SEC-003; the named asks cover the outward actions an injection usually aims at (pushes to the default branch, deploys, secret reads, releases); merges wait for required checks and stop at review points; cloud sessions limit the network.
- **A merge lands work the person has not reviewed.** That is the decision (1): delegated work merges when green, and the person reviews merged pull requests and the decisions they record. Review stops (AC-4) keep the person's approval for gated process files and referred test changes.
- **The guards' patterns miss a variant of a named ask.** Mitigation: the corpus, and the second-layer `ask` rules (AC-5).

## Decisions (2026-11-12)

The maintainer answered the draft's open questions:

1. **Merges.** Allowed once CI is green, when a task or feature has been delegated. When there is something for the maintainer to review, the agent stops and says so; it does not fire a permission prompt (AC-4, AC-7).
2. **New dependencies.** Allowed, and judged at the pull request (AC-1).
3. **Native Windows without a sandbox.** Accepted (APIs and assumptions).
4. **Network.** Allowed (AC-1).
5. **Existing projects.** Switched automatically, with a changelog note; `"permissions": "ask"` opts out (AC-5). This is why the allow layer is a hook in the plugin rather than rules in each project's settings: a plugin update cannot write a project's `.claude/settings.json`, which is a protected path.
6. **Never a command prompt** (2026-11-12, after 6.0.0 still prompted for scratch-folder deletes in a cloud session). "I don't EVER want to be prompted to approve a command. The text of the command is generally meaningless to me, so I always end up hitting allow regardless of what it's for." A prompt the person approves unread protects nothing. So the named asks stay, but each becomes a question the agent asks in chat, in plain words (AC-10), and the guards stop asking about things the person could not judge anyway: a folder in a temp folder, other than the project itself, is scratch and is deleted without asking. Claude Code's own prompts outside rfr's control remain (protected paths such as `.claude`, and tools rfr does not cover); rfr cannot switch Claude Code into a mode with no prompts, and Claude Code's auto mode refused an experiment that tried (`bypassPermissions`), as it should.

## Delivery

- Plan item: `PLAN.md`, Phase 19 (delegated work), slice 19i.
- Slices: 19i-1 the check of combined hook decisions (AC-3), first, since it decides how the hook and the guards fit together; 19i-2 the default-allow hook, the setting, the named-ask table and corpus, and review stops at merge (AC-1, AC-2, AC-4, AC-5); 19i-3 task approval, install-rules' settings, the rules, and the guides (AC-5 to AC-8); 19i-4 the eval (AC-9).
- Pull requests: #197 (spec).
