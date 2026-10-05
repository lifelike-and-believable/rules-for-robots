# Candidate rules

Draft rules under evaluation. The `rules+candidate` arm of `evals/run.mjs` adds the files a case lists in `case.json` (`"candidates": ["WA-008"]`) to `.claude/rules/candidates/`, on top of the normal rules. A candidate moves to `rules/` only when an eval shows it helps (R38); otherwise it is deleted or rewritten. Each file follows `docs/rule-format.md` but is not linted until it moves.
