---
name: install-rules
description: Install or update rules-for-robots rule packs in the current repository's .claude/rules/ folder. Use when the user asks to add, install, or update rules-for-robots rules in an existing project.
disable-model-invocation: true
argument-hint: "[profile | pack ...]"
---

# Install rules-for-robots rules

Copy rule files from this skill's payload into the current repository so Claude Code loads them. Plugins cannot ship rules directly, which is why this skill exists.

Payload: `${CLAUDE_SKILL_DIR}/payload/`
- `rules/core/` holds rules every project gets.
- `rules/packs/<pack>/` holds stack packs.
- `profiles.json` maps profile names (`web-app`, `static-site`, `unreal-plugin`) to packs.

## Steps

1. **Check the Claude Code version.** Run `claude --version`. If it is older than 2.1.288, tell the user path-scoped rules will not load on edits and ask whether to continue.

2. **Choose packs.** If `$ARGUMENTS` names a profile, use its packs. If it names packs, use those. Either counts as the user's choice, so continue without asking. If `$ARGUMENTS` is empty, inspect the repository and propose a profile, then wait for the user to confirm before copying anything:
   - `next` in `package.json` dependencies: `web-app`
   - `astro` in `package.json` dependencies: `static-site`
   - a `*.uplugin` file: `unreal-plugin`

   A pack can be listed in `profiles.json` before it has any rules. Skip packs with no folder in the payload and mention them in the report; this is expected while the rule set is being built.

3. **Copy.** Copy `payload/rules/core/` and each chosen `payload/rules/packs/<pack>/` into `.claude/rules/` at the repository root, keeping the relative paths (for example `payload/rules/core/testing/X.md` goes to `.claude/rules/core/testing/X.md`). For each file that already exists at the destination:
   - If its frontmatter has `waiver: true`, keep it. It is the project's recorded exception.
   - If it is identical, skip it.
   - Otherwise, show the user the difference and ask before replacing it.

   Leave files for packs the user did not choose in place unless the user asks to remove them.
   Leave `.claude/rules/project/` alone: it holds the project's own rules (`scope: project`).

   Claude Code treats `.claude/` as a sensitive path, so the user is asked to approve these writes. Tell the user which files you are about to write before the first prompt. If a write is refused, stop and give the user the exact copy commands instead of trying another route.

4. **Point the project at the rules.** If the repository has neither `AGENTS.md` nor `CLAUDE.md`, tell the user and offer to create `AGENTS.md` with the project's verification command and a thin `CLAUDE.md` containing `@AGENTS.md`. Do not edit tool-managed blocks in an existing `AGENTS.md`, such as the Next.js `nextjs-agent-rules` markers.

5. **Report.** List the files added, updated, skipped, and kept as waivers, and the packs installed. Remind the user to commit `.claude/rules/` so the rules apply to everyone working in the repository.

## Waivers

To waive a rule, replace its file with a waiver of the same name: frontmatter only, with `id`, `waiver: true`, `reason`, `approved-by`, and `date`, and no body. Nothing from a waiver reaches the model. Do not waive a rule by adding a contradicting instruction elsewhere, because Claude Code resolves conflicting instructions arbitrarily.
