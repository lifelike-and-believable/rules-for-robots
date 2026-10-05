# Experiment R7: what reaches the model from a rule file

Date: 2026-10-05. Claude Code 2.1.289, model `claude-sonnet-5-5`, headless (`claude -p`).

## Question

Does Claude Code send a `.claude/rules/*.md` file's YAML frontmatter and HTML comments to the model? (Plan section 12, question 1; recommendation R7.) A related eval question from Phase 0: does searching matching files with Grep, without reading them, load a path-scoped rule?

## Method

A throwaway project contained two rule files, each carrying unique canary tokens in places we wanted to test:

| File | Frontmatter | HTML comment | Body |
|---|---|---|---|
| `.claude/rules/probe-global.md` (no `paths`) | `id: ZEBRA-7731`, `rationale: canary-QUOKKA` | `canary-PANGOLIN` | `BODYTOKEN-ALPHA` |
| `.claude/rules/probe-scoped.md` (`paths: ["src/**"]`) | `id: OTTER-5512`, `rationale: canary-WOMBAT` | `canary-NARWHAL` | `BODYTOKEN-BETA` |

An `InstructionsLoaded` hook logged each load event. Run 1 asked the agent to read `src/a.txt` and then reproduce, without tools, every rule text in its context and report which tokens it had seen. Run 2 asked it to search `src/` with Grep only. The session transcript (`~/.claude/projects/.../*.jsonl`) was then searched for the injected `system-reminder` text, so the result does not rest on the model's self-report alone.

## Results

1. **Frontmatter is stripped.** The injected text for both files contained only the body. No frontmatter token appeared in any injected block.
2. **HTML comments are stripped** from rule files, as the docs already state for `CLAUDE.md`.
3. **Unscoped rules load at session start** (`load_reason: session_start`) inside a system reminder headed `Contents of <path> (project instructions, checked into the codebase):`.
4. **Path-scoped rules load after the triggering tool call**, attached after the Read result (`load_reason: path_glob_match`). The hook reported the glob `src/**` as `["src"]` and named the trigger file.
5. **Grep does not trigger a path-scoped rule.** In run 2 the agent found `src/a.txt` with Grep, but only the unscoped rule loaded.

Injected text, as recorded in the transcript (paths shortened):

```
Contents of .claude/rules/probe-global.md (project instructions, checked into the codebase):

Probe rule A: the code word for this project is BODYTOKEN-ALPHA.
```

```
Contents of .claude/rules/probe-scoped.md:

Probe rule B: files under src use the code word BODYTOKEN-BETA.
```

## Consequences for the rule format

- Rule metadata can stay in YAML frontmatter in the rendered files. It costs no context tokens, so no separate comment block or metadata stripping is needed (R7 resolved).
- Maintainer notes in HTML comments are free.
- A path-scoped rule only applies once the agent reads or edits a matching file. Rules that must guide a search-only or planning step need to be unscoped or placed in a skill.
- Each rule file adds a short header line when injected, so one rule per file costs a few tokens per rule. That is acceptable for fine-grained waivers (see `docs/rule-format.md`).

## Reproducing

Create the two probe files above plus `src/a.txt`, add an `InstructionsLoaded` hook that appends its stdin to a log, run `claude -p` with `--allowedTools Read` (run 1) or `--allowedTools Grep` (run 2), and search the session transcript for the canary tokens inside `system-reminder` blocks.
