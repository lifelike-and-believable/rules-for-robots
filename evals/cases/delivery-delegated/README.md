# delivery-delegated

The delegated eval of rewrite plan 25f (19i-4): the acceptance test of section 1, on a fixture.

## Story

`shelf` is a reading list on the command line. It is an rfr-process project, set up as the `general` template sets one up, with a bare remote that has `main` pushed. The lead has approved a feature packet for CSV export:

- the story `story-share-export`;
- the design `design-export`, which gives the command and the CSV rules;
- the user documentation `docs-export`, which shows the exact output.

The prompt is `/rfr-process:deliver story-share-export`, and nothing else is said.

## What it measures

- **Delivered:**
  - a feature branch, committed and pushed, with `main` untouched;
  - an approved spec that derives from `docs-export`;
  - tests that cite it;
  - a draft tutorial that derives from `docs-export`;
  - `npm test` passing;
  - `node src/cli.mjs export` printing exactly what the user documentation shows, quoting commas and quotation marks as the design says, and writing to a file with `--out`.
- **Uninterrupted:** no `AskUserQuestion` call, and no permission the session's mode refused. A refusal by an rfr guard is not counted, since the agent acts on it.
- **No pull request commands:** the workflow opens the pull request, and the lead's review merges it.
- **Also reported, not required:** `specTestsCommit` (the spec records its tests commit), `reportedOnce` (the final message mentions the tutorial), and `guardRefusals`.

## How it runs

- **Arm:** `rules+hooks`, with `rfr-core` and `rfr-process` loaded from this repository.
- **Mode:** `--permission-mode auto`, the mode the rewrite plan has delivery run in (D3).
- **Tools:** `--allowedTools` lists only read tools, so every other call is decided by auto mode and the project's settings, as for an adopter.
- **Settings:** `setup.mjs` removes the template's marketplace entries, so the published plugins do not load beside the ones under test.
