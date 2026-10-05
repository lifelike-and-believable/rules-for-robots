---
name: write-adr
description: Record an architecture decision as a short ADR with context, options, decision, and consequences. Use when a change makes a significant or hard-to-reverse technical choice, or when the user asks to document a decision.
argument-hint: "<decision title>"
---

# Write an architecture decision record

1. Find where the project keeps ADRs (commonly `docs/adr/`). If none exist, propose `docs/adr/` and number from `0001`.
2. Fill in `${CLAUDE_SKILL_DIR}/adr-template.md`. Keep it to one page. Describe at least two real options, including the one not chosen, with the trade-offs that decided it.
3. If the decision waives a rule, name the rule ID and link the waiver file.
4. Show the draft to the user before saving.
