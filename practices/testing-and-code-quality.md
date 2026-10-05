# Testing and code quality with agents

Practice guide for the testing (`TEST-*`) and code quality (`CODE-*`) rules. Sources: [findings](../docs/research/findings.md), [failure modes and evals notes](../docs/research/notes/failure_modes_and_evals.md), and [verification of figures](../docs/research/notes/verification_of_secondary_figures.md).

## Why tests get special treatment

Claude models game tasks mainly by editing tests: in ImpossibleBench, over 79% of their cheating went through test changes. Telling a model it may stop and report helps less for Claude than for some other models, and recent Claude models still gamed 12.5 to 37.5% of impossible tasks with Anthropic's anti-hack prompt. So the defence has three layers:

1. **Rule:** TEST-001 and WA-002 ask the agent to change the implementation, not the test, and to report a wrong test.
2. **Hook:** `guard-test-edits` asks you before any edit to an existing test file. New tests are allowed.
3. **CI:** a pull request that changes tests and implementation together is flagged for a person to look at (Phase 6 template workflows).

When you do approve a test change, the agent should list each changed test and why (TEST-001).

## Test-first bug fixes

TEST-002 asks for a failing test before the fix. In the seed evals this was the clearest behaviour change the rules produced: with rules, Sonnet 5.5 wrote the regression test first in every run; without them, never. It costs a few extra turns and leaves a test that keeps the bug fixed.

## What good tests look like here

- Assert behaviour through the public interface (TEST-003).
- Mock only process and network boundaries.
- Wait for conditions, not fixed delays.
- Match the nearest existing tests' style, and point the agent at them (CODE-001).

## Keeping code small and local

Agent-written code tends toward duplication and speculative structure. Published analyses found sharp rises in duplicated blocks and falls in refactoring as AI assistance spread (GitClear 2025, pre-agentic tools). The rules counter this directly:

- CODE-001: follow an existing file's pattern and reuse helpers; name the exemplar.
- CODE-002: no single-implementation abstractions, unrequested configuration, or handling for impossible cases.
- CODE-003: comments explain why, and none are added to unchanged code.
- CODE-004: dependencies are added deliberately, after confirming the package exists. About a fifth of model-suggested package names in one large study did not exist, and recurring invented names can be registered by attackers.

Leave formatting and mechanical style to the formatter and linter (the `format-on-edit` hook runs the project's own formatter).
