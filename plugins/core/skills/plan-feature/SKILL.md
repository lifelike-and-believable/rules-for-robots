---
name: plan-feature
description: Turn a feature request into a short spec with user stories, acceptance criteria, scope limits, and a verification plan, before any code is written. Use when the user asks to plan, spec, or scope a feature or a change bigger than one sentence can describe.
argument-hint: "<feature description>"
---

# Plan a feature

Produce a plan the user can approve. Do not change code in this skill.

1. **Understand the request.** Read AGENTS.md and the code the feature touches. Use a subagent for broad exploration so this session keeps only the conclusions. If the request is ambiguous in a way that changes the work materially, ask up to three specific questions; otherwise state your assumptions.
2. **Write the spec** using `${CLAUDE_SKILL_DIR}/spec-template.md`. Keep it short. Name the files and interfaces involved, what is out of scope, and how each acceptance criterion will be verified (a test, a command, a browser check). Give each criterion an ID (`AC-1`) and start the "Verified by" cell with `test:` for the ones a test can express; those become the first failing tests (TEST-004).
3. **Name the risks.** Note anything irreversible (migrations, public API changes, data deletion) and any decision worth an ADR (`/rfr-core:write-adr`).
4. **Plan the tests first.** Make the first slice of the plan the tests: draft the tests for each group of related criteria together, from the spec, with stubs for the new modules so every test fails on its assertion and not on a missing import. Each test cites its criterion as `<spec file name>#AC-1` in its title or a comment. The implementation slices make those tests pass and do not edit them; a test that turns out to be wrong means the spec changes, and the spec lists it under `unlocks:` with a reason. When a cluster is committed red, record its commit in the spec's `tests-commit` (a list, one commit per cluster).
5. **Stop.** Present the spec and wait for the user to approve or change it before implementing.

Save the spec where the project keeps specs (for example `docs/specs/<slug>.md`) only if the user asks or the project already does this.
