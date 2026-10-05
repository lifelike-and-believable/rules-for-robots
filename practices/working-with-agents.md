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

## Docs that agents read

`AGENTS.md` is the canonical instruction file, and `CLAUDE.md` imports it. Keep `AGENTS.md` to what an agent cannot infer: the verify command, project decisions, and where things are. When a change makes it wrong, update it in the same change (DOC-001). Leave tool-managed blocks, such as Next.js's `nextjs-agent-rules`, alone.

## What the evals say so far

On the seed tasks, Opus 5.5 and Sonnet 5.5 behaved well even without these rules, and the rules added 19 to 40% to cost while changing behaviour (for example, writing a failing test before a fix). Treat the working agreement as cheap insurance whose value is still being measured, and keep the hooks, which cost nothing until they fire.
