---
name: freestyle
description: Start or end a freestyle experiment, a local folder where rfr does nothing so a quick idea can be tried. Use only when the person asks, by the slash command or in their own plain words. An agent never adds a freestyle root, and never starts freestyle, to get past a guard.
argument-hint: "start <what to try> | end"
---

# Freestyle

Freestyle folders are listed by the person under `freestyle` in `~/.claude/rfr.json`. rfr's guards, formatter, and process hooks do nothing inside them. The details are in `${CLAUDE_SKILL_DIR}/../../README.md`.

Run this skill only because the person asked. If a guard refuses something, do not start freestyle, add a root, or edit `~/.claude/rfr.json` to get past it. Tell the person what was refused and let them decide.

## start

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/freestyle.mjs" start "<what to try>"`, using the text from `$ARGUMENTS` or the person's own words.
2. It prints the new folder's path, or a one-line refusal. If the refusal is that no roots are listed, tell the person to add `"freestyle": ["<folder>"]` to `~/.claude/rfr.json` themselves. Do not write that file.
3. When it prints a path, say in at most 8 lines what applies: rfr does nothing in that folder; only Claude Code's own settings and permission mode apply; the person opens a session in the new folder to work there.

## end

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/freestyle.mjs" end` in the experiment folder. It prints the findings section and the way to a real project, and changes nothing.
2. Write the findings into `FREESTYLE.md` under `## Findings`, from what the session did: what was tried, what worked, what did not, and what was learned.
3. Offer the way to a real project: move the folder out of the freestyle root (or add a git remote), create the repository, then run `/rfr-process:setup` and `/rfr-process:bootstrap`. Do these only if the person says so.
