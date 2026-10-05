# Working with coding agents

Practice guide for the working agreement (`WA-*`) and the git and documentation rules (`GIT-*`, `DOC-*`). It explains how the rules fit into a solo developer's workflow and where a person's attention matters most. Sources: [findings](../docs/research/findings.md), [context and workflow notes](../docs/research/notes/context_and_workflows.md), [instruction design notes](../docs/research/notes/instruction_design.md), and the [seed eval report](../evals/results/2026-10-05-seed/report.md).

## The loop

1. **Explore** with a subagent when the area is unfamiliar, so the main session keeps only the conclusions (WA-007).
2. **Plan** when the change is bigger than one sentence can describe. Name the files, the interfaces, what is out of scope, and how the result will be verified. Skip the plan for small, obvious changes.
3. **Implement** in the main session, one writer at a time. Parallel agents are for reading and review.
4. **Verify** with the project's own command and include its output (WA-001). Ground every claim in this session's evidence (WA-005).
5. **Review** in a fresh context: a reviewer sees the diff and the criteria, not the author's reasoning, and reports every finding with its severity. Filter findings in a separate pass, because reviewers asked for "only important issues" drop real ones.

## Where a solo developer's attention pays off

Watch the inputs and outputs, not every step:

- the research or exploration summary, when the area is new;
- the plan and its acceptance criteria, before implementation;
- the verification output and the report, before merging;
- any approval prompt from the `rfr-core` hooks (destructive commands, edits to existing tests, Vercel actions).

## Stops the agent should make

The working agreement names exactly when to stop and ask (WA-003): before irreversible actions, before a material change of scope, and when the task or a test looks wrong (WA-002). Everything else should continue to completion. Naming the stops works better on current models than "ask when unsure", which they either ignore or over-apply.

## Scope

Current models widen tasks: extra refactors, features, files, and reviewer subagents. WA-004 uses Anthropic's tested scope wording. If you want more than was asked, ask for it explicitly; ideas the agent has go at the end of its report (WA-004, GIT-001).

## Long sessions

Rule adherence declines as a session grows, and a session full of failed attempts steers the agent toward more of the same. After two failed corrections on the same problem, ask for a summary and continue in a fresh session (WA-007). Keep instructions short: always-on text in these template repos stays under 200 lines.

## Work that spans sessions

Multi-week work needs state that outlives a session. Keep a handoff file (named in `AGENTS.md`, for example `docs/handoff.md`) with sections for current state, open items, what still needs a live test, decisions, and lessons. A session reads it first and updates it at the end, separating "unit tests pass" from "verified": changes that only a person can verify (live services, hardware, two-machine sessions) stay on the needs-a-live-test list, with exact steps, until someone runs them. Keep status edits out of code pull requests and update the file in one docs change per batch; when every pull request edits the same status line, each one conflicts with the others.

## Docs that agents read

`AGENTS.md` is the canonical instruction file, and `CLAUDE.md` imports it. Keep `AGENTS.md` to what an agent cannot infer: the verify command, project decisions, and where things are. When a change makes it wrong, update it in the same change (DOC-001). Leave tool-managed blocks, such as Next.js's `nextjs-agent-rules`, alone.

Agents treat instruction files as true, so stale paths and tool names send them looking for things that do not exist. Keep history and "last updated" dates out of them; those belong in the changelog or the handoff file. `checks/ci/instruction-lint.mjs` (run by the reusable `rfr-guards.yml` workflow) fails when a backticked path or `npm run` script named in `AGENTS.md` or `CLAUDE.md` does not exist, and warns about absolute paths and MCP tool names it cannot check.

## Pull requests and CI

- Merge only when the user asked for a merge, and only after reading every check on the head commit (`gh pr view --json headRefOid,statusCheckRollup,mergeStateStatus`): all successful or skipped, state clean. A bot comment saying a run succeeded can refer to an older commit.
- Wait for CI through notifications or a single long fallback check, not a sleep loop.
- Fix failures with new commits on the branch, and resolve conflicts by merging the base branch in. Do not rebase or force-push a branch that has been pushed (the `guard-commands` hook asks before a force-push).
- Required checks and path filters interact badly. A workflow skipped by `on.<event>.paths` never reports, so a required check from it blocks the pull request forever. A job skipped by `if:` reports as skipped and counts as passed, so when a change-detection job decides whether real jobs run, require the change-detection job too. A job in a reusable workflow reports as `<caller> / <called>` when it runs but as `<caller>` when skipped, so a required check has to match both, or the job has to always run.
- With a single self-hosted runner, leave "require branches to be up to date" off; otherwise every pull request waits behind a full rebuild.

## Windows

Claude Code on Windows has a PowerShell tool as well as Bash; the `rfr-core` guards cover both.

- `sed -i` in Git Bash rewrites CRLF files with LF line endings, and the diff shows the whole file changed. Edit with the Edit tool, or keep a file's existing line endings, and check `git diff --stat` for whole-file rewrites before committing. `core.autocrlf=true` can cause the same churn when staging.
- When git refuses a checkout ("dubious ownership") or a clone fails on long paths, pass the setting for that one command (`git -c safe.directory=<path> ...`, `git -c core.longpaths=true clone ...`) and report it. Do not change global or system git configuration from an agent session; it changes the user's whole machine, and `guard-commands` asks before `git config --global` or `--system`.

## What the evals say so far

On the seed tasks, Opus 5.5 and Sonnet 5.5 behaved well even without these rules, and the rules added 19 to 40% to cost while changing behaviour (for example, writing a failing test before a fix). The harder Phase 8 cases showed clear effects where it matters most: without rules both models edited a wrong test to make CI pass in every run, and with TEST-001 neither did; TEST-004 made Sonnet work test-first. On data-loss, over-engineering, and Next.js 16 tasks the models behaved well without rules. Treat the working agreement as insurance whose value is measured case by case, and keep the hooks, which cost nothing until they fire.
