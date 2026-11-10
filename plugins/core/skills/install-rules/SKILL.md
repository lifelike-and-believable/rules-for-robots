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
- `profiles.json` maps profile names (`web-app`, `static-site`, `unreal-plugin`) to packs, and lists each profile's `plugins`: `rfr-core` plus `rfr-web` for the web profiles or `rfr-unreal` for `unreal-plugin`. Its `permissions.allow` lists the profile's own commands to allow.
- `modes/delegated/` holds the working-agreement files for delegated mode. Each replaces the core rule named in its `replaces:` field.
- `permissions.json` holds the permission rules every profile shares: allow rules for read-only and local git commands, and deny rules for reading `.env` and key files.

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

   **Working mode.** Read `"mode"` from `.claude/rfr.json` at the repository root: `supervised` (the default, also when the file or field is missing) or `delegated`. In delegated mode the agent asks the user only before irreversible or outward actions, and records other decisions in the pull request's `## Decisions` section. For `delegated`, after copying, replace each core rule named in a `payload/modes/delegated/*.md` file's `replaces:` field with that file: delete `.claude/rules/core/working-agreement/<ID>-*.md` and copy the delegated file into the same folder. Tell the user these files are experimental until their eval passes (improvement plan 21a). For `supervised`, remove any `*-delegated.md` file left in `.claude/rules/core/working-agreement/` and make sure the core files it replaced are back. Waivers are kept as in the rest of this step.

4. **Point the project at the rules.** If the repository has neither `AGENTS.md` nor `CLAUDE.md`, tell the user and offer to create `AGENTS.md` with the project's verification command and a thin `CLAUDE.md` containing `@AGENTS.md`. Do not edit tool-managed blocks in an existing `AGENTS.md`, such as the Next.js `nextjs-agent-rules` markers.

   If the repository has no `docs/preferences.md`, offer to create it from `payload/preferences.md` and to add this line to `AGENTS.md`: "Read `docs/preferences.md` before design, interface, or documentation work, and add to it when the project lead corrects something." The file keeps the lead's corrections so each is given once.

5. **Report.** List the files added, updated, skipped, and kept as waivers, and the packs installed. Remind the user to commit `.claude/rules/` so the rules apply to everyone working in the repository. Name the plugins the profile lists under `plugins` that the project does not enable yet, usually `rfr-web` or `rfr-unreal`, and how to enable them (`/plugin install rfr-web@rules-for-robots`, or `enabledPlugins` in `.claude/settings.json`); offer to add them to the settings file, and write it only if the user agrees.

6. **Offer the default permission rules.** Compare `.claude/settings.json` with `permissions.json` plus the profile's `permissions.allow`, and list the rules it lacks. These let routine work run without a prompt while rfr-core's guards still refuse or ask about actions that cannot be undone (WA-009). If the user agrees, add the missing entries to the existing `allow` and `deny` lists in one write, keeping every rule already there; do not remove or loosen a rule the project set. Adjust the profile's command rules to the scripts the project's `package.json` or `AGENTS.md` names.

## Waivers

To waive a rule, replace its file with a waiver of the same name: frontmatter only, with `id`, `waiver: true`, `reason`, `approved-by`, and `date`, and no body. Nothing from a waiver reaches the model. Do not waive a rule by adding a contradicting instruction elsewhere, because Claude Code resolves conflicting instructions arbitrarily.
