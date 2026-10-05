# Working with coding agents

Practice guide for the working agreement (`WA-*`) and the git and documentation rules (`GIT-*`, `DOC-*`). It explains how the rules fit into a solo developer's workflow and where a person's attention matters most. Sources: [findings](../docs/research/findings.md), [context and workflow notes](../docs/research/notes/context_and_workflows.md), [instruction design notes](../docs/research/notes/instruction_design.md), and the [seed eval report](../evals/results/2026-10-05-seed/report.md).

## The loop

1. **Explore** with a subagent when the area is unfamiliar, so the main session keeps only the conclusions (WA-007).
2. **Plan** when the change is bigger than one sentence can describe. Name the files, the interfaces, what is out of scope, the assumptions that could be wrong, the APIs it relies on and where each was checked, and the named test cases that will verify it. Skip the plan for small, obvious changes.
3. **Implement** in the main session, one writer at a time. Parallel agents are for reading and review.
4. **Verify** with the project's own command and include its output (WA-001). Ground every claim in this session's evidence (WA-005).
5. **Review** in a fresh context: a reviewer sees the diff and the criteria, not the author's reasoning, and reports every finding with its severity (the `code-reviewer` agent uses blocker, major, minor, and nit). Filter findings in a separate pass, because reviewers asked for "only important issues" drop real ones.

## Where a solo developer's attention pays off

Watch the inputs and outputs, not every step:

- the research or exploration summary, when the area is new;
- the plan and its acceptance criteria, before implementation;
- the verification output and the report, before merging;
- any approval prompt from the `rfr-core` hooks (destructive commands, edits to existing tests, Vercel actions).

## Stops the agent should make

The working agreement names exactly when to stop and ask (WA-003): before irreversible actions, before a material change of scope, and when the task or a test looks wrong (WA-002). Everything else should continue to completion. Naming the stops works better on current models than "ask when unsure", which they either ignore or over-apply. When a request is ambiguous, the agent asks the one question whose answer changes the result most, or states its assumption and continues.

## Scope

Current models widen tasks: extra refactors, features, files, and reviewer subagents. WA-004 uses Anthropic's tested scope wording. If you want more than was asked, ask for it explicitly; ideas the agent has go at the end of its report (WA-004, GIT-001).

Some boundaries are not visible in the code. If part of the tree belongs to someone else (vendored code, a submodule, an upstream that integration overwrites), list the paths your project owns in `AGENTS.md`. An agent then finds the boundary while planning, reads upstream code only through its existing public interfaces, keeps its own tests in code you own, and reports a missing interface instead of editing around it. Write the list as a `## Owned paths` heading followed by a bullet list of backticked globs, such as `` - `Plugins/MyPlugin/**` ``; a trailing `/` covers a whole folder. With that section in place, the `rfr-core` hook `guard-owned-paths` asks you before an agent edits a file in the project that is not on the list, and the opt-in `owned-paths` job in the reusable `rfr-guards.yml` workflow fails a pull request that touches one (see the [adoption guide](../docs/adoption-guide.md#owned-paths)). List everything your branch owns, including `AGENTS.md`, `.claude/`, and `.github/` if you change them.

When you are working in phases, such as requirements before design, say which phase you are in. An agent answers at that level and keeps code references and implementation detail for later, unless you ask for them.

## Evidence for claims

An agent's report is only as good as what it checked this session (WA-005, WA-006).

- Build on the code the shipped product uses. A prototype, sample, or deprecated class can be a closer name match than the live one; check which is in use and say so if the pattern you followed may be legacy (CODE-001). When a claim turns out wrong, say what was wrong, cite the file and line, and rework from there.
- Examples from blogs, forums, or other versions of a library or engine are leads, not evidence. Confirm against the installed source or version-matched docs, and check experimental or pre-release modules every time, because they change between minor versions.
- Confirm how a dependency behaves, not only that its API exists: read the code path you rely on. A fake or mock in the tests should follow the real library's contract; a fake that is more forgiving than the library hides exactly the bugs it should catch.
- In design answers and plans, label the claims that matter as checked this session, inferred, or recalled from memory, next to the claim rather than in a closing note. Keep these labels out of committed code.
- When a live tool connection drops in the middle of a batch (an editor bridge, a browser, a database console), stop the batch, check the connection once, and report what was collected. Missing results are not a negative finding.

## Delegating to subagents

A subagent starts with none of the main session's context, so the hand-off has to carry it.

- Keep broad searches and sweeps in subagents, so the main session holds conclusions rather than file dumps (WA-007).
- Treat the hand-off as a contract: the files in scope, the APIs already checked and where, the named tests that define done, and what is out of scope. A plan from `/rfr-core:plan-feature` is a good hand-off.
- State the subagent's authority: the task, its scope, and that the user approved it. Ask it to return new scope, architectural choices, and irreversible actions to you instead of acting on them. Permission prompts and hooks apply inside subagents too, so the prompt cannot grant more than the session has.
- Ask for a structured result: files changed, test runs, verification output, and what it could not verify. The `web-engineer`, `unreal-engineer`, and `code-reviewer` agents already report this way.
- Match the model to the stage. One team's experience: a larger model for planning and review, a faster one for well-specified implementation and searches. Override the model per call rather than duplicating agent definitions.
- Long build-and-fix loops fill a session with failed attempts; run them in their own session (see Long sessions).

## Long sessions

Rule adherence declines as a session grows, and a session full of failed attempts steers the agent toward more of the same. After two failed corrections on the same problem, ask for a summary and continue in a fresh session (WA-007). Keep instructions short: always-on text in these template repos stays under 200 lines.

## Work that spans sessions

Multi-week work needs state that outlives a session. Keep a handoff file (named in `AGENTS.md`, for example `docs/handoff.md`) with sections for current state, open items, what still needs a live test, decisions, and lessons. List decisions there with a link to their ADR; the reasoning belongs in the ADR (`/rfr-core:write-adr`), which an agent should offer to write when a significant decision is settled, not write unasked. A session reads it first and updates it at the end, separating "unit tests pass" from "verified": changes that only a person can verify (live services, hardware, two-machine sessions) stay on the needs-a-live-test list, with exact steps, until someone runs them. Keep status edits out of code pull requests and update the file in one docs change per batch; when every pull request edits the same status line, each one conflicts with the others.

## Docs that agents read

`AGENTS.md` is the canonical instruction file, and `CLAUDE.md` imports it. Keep `AGENTS.md` to what an agent cannot infer: the verify command, project decisions, and where things are. When a change makes it wrong, update it in the same change (DOC-001). Leave tool-managed blocks, such as Next.js's `nextjs-agent-rules`, alone.

If the project has a glossary, name it in `AGENTS.md` (for example `docs/glossary.md`). Agents then use its terms exactly, without synonyms, and ask before introducing a new one. A glossary with a column of rejected synonyms can also be checked in CI.

Agents treat instruction files as true, so stale paths and tool names send them looking for things that do not exist. Keep history and "last updated" dates out of them; those belong in the changelog or the handoff file. `checks/ci/instruction-lint.mjs` (run by the reusable `rfr-guards.yml` workflow) fails when a backticked path or `npm run` script named in `AGENTS.md` or `CLAUDE.md` does not exist, and warns about absolute paths and MCP tool names it cannot check.

## Pull requests and CI

- Merge only when the user asked for a merge, and only after reading every check on the head commit (`gh pr view --json headRefOid,statusCheckRollup,mergeStateStatus`): all successful or skipped, state clean. A bot comment saying a run succeeded can refer to an older commit.
- Merging on green and carrying on is what lets an agent work through a queue of changes. Make the wait cheap and the check exact:
  - Wait without polling. A cloud session subscribed to the pull request gets CI results as events; elsewhere, one blocking call (`gh pr checks <pr> --watch --fail-fast`, or `gh run watch`) returns when the checks finish. Never loop with `sleep` or guess a long timeout.
  - Have CI announce itself. The reusable `rfr-ci-status.yml` workflow, called as the last job of the workflow that gates merging, keeps one comment on the pull request with the result and the head commit's full SHA. It notifies people and agents, and helps most with long self-hosted runs such as Unreal Tier 2. The template repos call it.
  - Treat any "CI passed" comment as a signal to look, not proof; it may describe an older commit. Confirm the checks on the current head, then merge with `gh pr merge --match-head-commit <sha>` so a push that lands meanwhile stops the merge.
  - `/rfr-core:merge-when-green <pr>` does all of this, then updates the base branch and continues.
- Fix failures with new commits on the branch, and resolve conflicts by merging the base branch in. Do not rebase or force-push a branch that has been pushed (the `guard-commands` hook asks before a force-push).
- Required checks and path filters interact badly. A workflow skipped by `on.<event>.paths` never reports, so a required check from it blocks the pull request forever. A job skipped by `if:` reports as skipped and counts as passed, so when a change-detection job decides whether real jobs run, require the change-detection job too. A job in a reusable workflow reports as `<caller> / <called>` when it runs but as `<caller>` when skipped, so a required check has to match both, or the job has to always run.
- With a single self-hosted runner, leave "require branches to be up to date" off; otherwise every pull request waits behind a full rebuild.

## Windows

Claude Code on Windows has a PowerShell tool as well as Bash; the `rfr-core` guards cover both.

- `sed -i` in Git Bash rewrites CRLF files with LF line endings, and the diff shows the whole file changed. Edit with the Edit tool, or keep a file's existing line endings, and check `git diff --stat` for whole-file rewrites before committing. `core.autocrlf=true` can cause the same churn when staging.
- When git refuses a checkout ("dubious ownership") or a clone fails on long paths, pass the setting for that one command (`git -c safe.directory=<path> ...`, `git -c core.longpaths=true clone ...`) and report it. Do not change global or system git configuration from an agent session; it changes the user's whole machine, and `guard-commands` asks before `git config --global` or `--system`.

## What the evals say so far

On the seed tasks, Opus 5.5 and Sonnet 5.5 behaved well even without these rules, and the rules added 19 to 40% to cost while changing behaviour (for example, writing a failing test before a fix). The harder Phase 8 cases showed clear effects where it matters most: without rules both models edited a wrong test to make CI pass in every run, and with TEST-001 neither did; TEST-004 made Sonnet work test-first. On data-loss, over-engineering, and Next.js 16 tasks the models behaved well without rules. Treat the working agreement as insurance whose value is measured case by case, and keep the hooks, which cost nothing until they fire.
