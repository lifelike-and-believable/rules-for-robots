# The delegated delivery eval (2026-11-13)

Rewrite plan 25f runs the delegated eval (19i-4) before the acceptance test on a real feature. It is the plan's acceptance test (section 1) on a fixture. The lead has approved a feature packet, says only `/rfr-process:deliver story-share-export`, and is not asked anything again. The case is described in [`evals/cases/delivery-delegated/README.md`](../../cases/delivery-delegated/README.md).

Claude Code 2.1.323; arm `rules+hooks` (the 12 core rules, rfr-core, and rfr-process from this repository); `--permission-mode auto`, with only read tools allowed up front; default effort. Budget $25, set by the maintainer.

## Smoke run: two faults found

One Sonnet 5.5 run (`smoke/`, $0.35) passed every check, and its transcript showed two faults:

1. **`delivery.mjs start story-share-export` was refused** as "not a delivery run", because the story had no spec yet. That is the state every new delivery starts in, and `where` called it "delivery is open". The agent wrote and committed the spec, then started the run on the spec, and said so in its decisions file. Fixed: rfr-process 2.4.1, with delivery-run AC-9 amended.
2. **A guard refused a harmless command.** The agent wrote its decisions file with `printf '... `export` ...'`. rfr-core refused it under SEC-001, reading the backquoted `export` inside single quotes as a command that lists the environment. The agent switched to the Write tool. Fixed: a substitution now counts only where the shell would run it (rfr-web 3.1.1 carries the same walker).

## Full run, on the fixed plugins

| Model | Pass | Interruptions | Guard refusals | Mean cost (USD) | Mean turns | Mean time |
|---|---|---|---|---|---|---|
| Sonnet 5.5 | 10/10 | 0 | 0 | 0.29 | 15.4 | 82 s |
| Opus 5.5 | 10/10 | 0 | 0 | 0.88 | 25.8 | 132 s |

20 runs, $11.63; with the smoke run, $11.98 of the $25 budget.

In every run:

- `delivery.mjs start` started the run for the story;
- the spec recorded its tests commit;
- the export matched the user documentation exactly, quoting included;
- the branch was pushed with `main` untouched;
- the tutorial was left a draft;
- the final message reported once, naming the tutorial;
- no `AskUserQuestion` call was made, auto mode refused nothing, and no pull request command was run.

## Reading

- On a fixture, the plan's acceptance test passes. One approved packet becomes a delivered, pushed branch with no further input and no interruption, on both models, 20 times out of 20.
- The two faults would have reached adopters, and neither showed up in unit tests. The first was in the path every new delivery takes. The smoke run found both for $0.35, which supports the freeze rule: the delegated eval runs before agent configuration changes ship.
- The fixture is small: one command, a ten-line change, a manual tutorial. It doesn't test a long run, a run that needs a decision recorded, a web tutorial run against a preview, or the packet's merge starting the run. Those belong to the acceptance test on a real feature in XR Studio In A Box, which is next.
