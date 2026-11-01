---
name: bootstrap
description: Draft the first process artifacts (concept, requirements, personas) for an existing project from its README, documentation, issues, and code, for the approver to review. Use only when the user asks to bootstrap or adopt the process on a project that already exists.
disable-model-invocation: true
argument-hint: "[adoption window in days, default 90]"
---

# Bootstrap an existing project

An existing project has code and users but no process artifacts. This skill drafts the product-level artifacts from what already exists, so the approver reviews instead of writing from nothing. Everything it writes is a `draft`; only the approver approves, by reviewing or merging the pull request. Templates are in `${CLAUDE_SKILL_DIR}/../../templates/`, and how to write each artifact is in `${CLAUDE_SKILL_DIR}/../../GUIDE.md`.

1. **Check the setup.** `docs/product/process.yml` must exist; if it does not, run `/rfr-process:setup` first. If `docs/product/concept.md` already has content beyond the template, stop and ask before replacing it.
2. **Gather evidence.** Read the README, existing documentation, the changelog, open and recently closed issues (`gh issue list --state all --limit 100` if `gh` is available), and the code's public surface (routes and pages for a web app; the `.uplugin`, public headers, Blueprint-exposed functions, and settings classes for an Unreal plugin). Use a subagent for broad reading and keep only its conclusions. Note where each fact comes from.
3. **Draft the concept** in `docs/product/concept.md`: problem, audience, vision, non-goals, as the project's own materials describe them. Mark anything inferred rather than stated with "(inferred from ...)".
4. **Draft requirements** in `docs/product/requirements/<area>.md`, one file per area of capability the project already has. Each requirement gets an ID heading (`## REQ-<area>-1: ...`) and describes current behaviour that users rely on, written so it can be tested. List open questions at the end of each file rather than guessing.
5. **Draft personas** in `docs/product/personas/` from the evidence: who files issues, who the documentation addresses, who the profile's starters in `templates/profiles/<profile>/personas/` describe. Prefer two or three well-evidenced personas to many thin ones. Each persona says what evidence it rests on.
6. **Link them.** Requirements and personas link to `concept` in `derived-from`. Leave hashes empty; they are recorded when each artifact is approved (`node .rfr/checks/process-relink.mjs <id>`).
7. **Set the adoption window.** Add `adoption-until: <today plus the window from $ARGUMENTS, default 90 days>` to `process.yml`, so existing work without links produces warnings until then.
8. **Check.** Run `node .rfr/checks/process-trace.mjs` and show the result.
9. **Stop.** Summarize what was drafted, the open questions, and the evidence behind each persona. The approver reviews and approves these before any epics or stories are written. Do not mark anything approved, and do not commit unless the user asks.
