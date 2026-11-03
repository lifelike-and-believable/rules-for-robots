# Phase 10 eval round: preparation (no paid runs)

Two things done before the paid runs of `../../README.md` ("Planned: Phase 10 round").

## Mutation testing on spec-vacuous-tests

`node evals/stryker-compare.mjs spec-vacuous-tests`, Stryker 10.1.1 with the command runner (`node --test`), no model:

```
spec-vacuous-tests: 8 of 12 mutants killed (score 66.7%).
  Survived ArrayDeclaration at src/convert.js:4  for (const unit of [from, to]) {
  Survived BlockStatement at src/convert.js:4  for (const unit of [from, to]) {
  Survived ConditionalExpression at src/convert.js:5  if (!(unit in METRES)) throw new RangeError(`Unknown unit: ${unit}`);
  Survived StringLiteral at src/convert.js:5  if (!(unit in METRES)) throw new RangeError(`Unknown unit: ${unit}`);
```

The fixture's three tests cite AC-1 (a real assertion), AC-2 (`assert.ok(true)`), and AC-3 (`assert.equal(1 + 1, 2)`). Every survivor is in the unknown-unit check, the behaviour AC-2 describes, so a reviewer reading the survivors can trace them to AC-2. AC-3 (zero and negative values) runs through the same arithmetic as AC-1, whose real test kills those mutants, so Stryker shows nothing for it. Stryker therefore finds one of the two vacuous tests, and reports code locations, which a person then maps to criteria. The sabotage step works from the criteria instead (break zero handling, see whether the AC-3 test fails), so it can find AC-3; the `rules+hooks` runs will show whether it does.

## A harder case for the cadence comparison

`tdd-feature` passes 6 of 6 in the `rules` arm (`../2026-10-05-phase8b/`), and its grader checks that a test ran before the implementation, not why it was red. `tdd-cluster` asks for a new module with three functions. Its grader reads the output of the last red test run before the first green one, and passes only if that run failed on assertions; a run that failed because the module or an export did not exist yet does not count. That is the behaviour `TEST-004-clustered` asks for (stubs first, so each test fails on its assertion), and the one TEST-004 does not mention. To make this possible, graders now get each tool call's `output`.
