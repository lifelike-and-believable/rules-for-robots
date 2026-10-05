# Contributing

## Setup

Node 22 or later.

```sh
npm ci
npm run verify
```

`npm run verify` runs the rule lint, the tests, a check that `template-repos/` and the install-rules payload match the current sources, and `claude plugin validate --strict` on the marketplace and plugin (needs Claude Code 2.1.288 or later). CI runs the same command on every pull request.

## Adding or changing a rule

1. Read `docs/rule-format.md`.
2. Create `rules/<core|packs/<pack>>/<area>/<ID>-<slug>.md` with the next free ID for its prefix.
3. Fill in every required field. Set `targets-failure` to the failure the rule prevents, or `project-decision`.
4. Write the body as plain imperative sentences with a reason, under 120 words.
5. Add the practice guide that explains the rule to `sources` (the lint requires one, and every guide must be cited by at least one rule).
6. For a MUST rule, name the enforcing hook or CI job in `check` and link the evidence in `sources`. Evidence that came only from a blocked or secondary source cannot support a MUST rule (R40).
7. Run `npm run build` to regenerate `template-repos/`, then `npm run verify`.
8. Bump `version` in `plugins/core/.claude-plugin/plugin.json`, because the install-rules payload changed (R16).
9. Commit the rule, the regenerated output, and the version bump together.

To add an ID prefix, update the table in `docs/rule-format.md` and `PREFIXES` in `checks/lib/rules.mjs` in the same change.

## Removing or rewriting a rule

Rules stay only while evals show they help (R38). When an eval shows a rule has no effect or makes results worse, remove or rewrite it and record the eval run in the pull request.

## Pull requests

- One plan slice per branch and pull request, named `phase-<n>/<slice>`.
- `npm run verify` passes.
- Update `PLAN.md` if the change answers an open question or changes a decision.

## Style

Canadian English. Plain sentences. Avoid emphatic capitals, frequent em dashes, and "it's not X, it's Y" constructions.
