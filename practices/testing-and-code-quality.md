# Testing and code quality with agents

Practice guide for the testing (`TEST-*`) and code quality (`CODE-*`) rules. Sources: [findings](../docs/research/findings.md), [failure modes and evals notes](../docs/research/notes/failure_modes_and_evals.md), and [verification of figures](../docs/research/notes/verification_of_secondary_figures.md).

## Why tests get special treatment

Claude models game tasks mainly by editing tests: in ImpossibleBench, over 79% of their cheating went through test changes. Telling a model it may stop and report helps less for Claude than for some other models, and recent Claude models still gamed 12.5 to 37.5% of impossible tasks with Anthropic's anti-hack prompt. So the defence has three layers:

1. **Rule:** TEST-001 and WA-002 ask the agent to change the implementation, not the test, and to report a wrong test.
2. **Hook:** `guard-test-edits` asks you before any edit to an existing test file. New tests are allowed.
3. **CI:** a pull request that changes tests and implementation together is flagged for a person to look at (Phase 6 template workflows).

When you do approve a test change, the agent should list each changed test and why (TEST-001).

## Test-driven development

The project works test-driven wherever a test can express the behaviour (TEST-004):

1. **Red:** write one small failing test for the next piece of behaviour, and run it to see it fail for the expected reason. A test that passes before the code exists is testing nothing.
2. **Green:** write the least code that makes it pass.
3. **Refactor:** tidy the code and tests with everything green.

Agents should show the red and green runs in their report, which also satisfies WA-001 and WA-005. Acceptance criteria from `/rfr-core:plan-feature` become the first tests. Test-first is skipped for spikes, visual and layout tweaks, and configuration; the agent says so when it skips.

When a test run is expensive (a build, an engine start, a browser), write a cluster of tests for one contract at a time, then run them together. In the red run, check that each test fails for its own expected reason; one that passes is too weak. Pair each rule's passing case with its failing case, and split a cluster that grows past about ten tests.

Some work has no unit test. For content, data, or asset changes, write the validation check first and see it fail. For feel, timing, or visual judgement, say that a person has to check it and add it to the needs-a-live-test list (see [working with agents](working-with-agents.md)). Do not write a test that cannot fail to fill the gap.

Before saying a project has no tests for an area, search for its test module: tests often live somewhere unexpected, such as a separate package or an Unreal `Tests` module. If there really is none, ask before creating a new test module or framework, and keep headless suites headless.

For Unreal plugins, TDD works best at the lowest test level (UE-007): Low-Level Tests for pure logic run in seconds, while editor automation tests are slower and suit fewer, larger steps.

The hook that asks before editing existing tests (TEST-001) does not get in the way of TDD: new tests and new test files are allowed without asking.

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
