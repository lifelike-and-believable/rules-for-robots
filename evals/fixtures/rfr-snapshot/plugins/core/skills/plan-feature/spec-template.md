---
status: draft
# tests-commit: <sha of the commit that holds the failing tests, once written>
# unlocks:
#   - <test path>: <why a locked test had to change>
---

# <Feature name>

## Problem
<Who needs this and why, in two or three sentences.>

## User stories
- As a <user>, I want <capability> so that <benefit>.

## Acceptance criteria
| # | Criterion | Verified by |
|---|---|---|
| AC-1 | <Observable behaviour> | test: <named test case> |
| AC-2 | <Observable behaviour> | command: <command> or browser check: <steps> |

A test cites a criterion as `<this file's name without .md>#AC-1` in its title or a comment. Only `test:` criteria need a citing test.

## Scope
- In: <files, modules, interfaces>
- Out: <what this change will not do>

## APIs and assumptions
- APIs used: <API, and where it was checked: installed header, type definition, or docs version>
- Assumptions that could be wrong: <assumption, and how to confirm it>

## Non-functional requirements
<Accessibility, performance budget, security, supported engine versions or browsers, as relevant.>

## Delivery
- Plan or roadmap item: <where this feature is tracked>
- Pull requests: <added as each is opened; the plan item names them when the work is done>

## Risks and decisions
<Irreversible steps, migrations, public API changes, decisions that need an ADR.>
