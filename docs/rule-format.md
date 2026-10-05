# Rule format

This is the specification for rule files in `rules/`. The lint in `checks/` enforces it. The reasons behind each choice are in [research/findings.md](research/findings.md) and [research/recommendations.md](research/recommendations.md) (R1 to R7).

## One rule per file

Each rule lives in its own Markdown file:

```
rules/<layer>/<area>/<ID>-<slug>.md
```

- `<layer>` is `core` or `packs/<pack>` (for example `packs/unreal-plugin`).
- `<area>` groups related rules for people browsing the repo (for example `testing`, `security`). It has no effect on loading.
- `<ID>` matches the `id` field. `<slug>` is a short kebab-case summary.

Example: `rules/core/testing/TEST-001-keep-tests-honest.md`.

One rule per file keeps waivers and overrides exact. A project removes or replaces a single file to waive a single rule, and Claude Code loads and scopes rules per file. Each injected file adds one short header line, which is an acceptable cost.

## Frontmatter

Claude Code reads only `paths` and strips the rest of the frontmatter before the rule reaches the model ([experiment R7](research/experiments/r7-rule-loading.md)). The other fields are for people, the lint, the build, and evals.

```yaml
---
id: TEST-001
title: Keep tests honest
level: MUST
scope: core
paths: ["**/*.test.*", "**/*.spec.*", "**/tests/**", "**/Tests/**"]
verified-by: [hook, ci]
check: "hook: guard-test-edits; ci: test-change-guard"
targets-failure: test-gaming
observed-on: [claude-opus-4-7, claude-sonnet-4-6]
rationale: Claude models game tasks mainly by editing tests, and prompting alone leaves residual cheating.
sources: ["docs/research/findings.md#agents-cheat-mainly-by-editing-tests"]
---
```

| Field | Required | Values | Purpose |
|---|---|---|---|
| `id` | Yes | `<PREFIX>-<NNN>`, unique across the repo | Stable reference for reviews, waivers, and evals |
| `title` | Yes | Short sentence-case phrase | Index and review output |
| `level` | Yes | `MUST`, `SHOULD`, `MAY` | How negotiable the rule is. Kept here, not in the body |
| `scope` | Yes | `core` or `pack:<pack-name>` | Which layer the rule belongs to; must match the folder |
| `paths` | No | List of glob strings | Loads the rule only when the agent reads or edits a matching file. Omit for always-on rules |
| `verified-by` | Yes | List of `hook`, `ci`, `test`, `review` | How compliance is checked. A `MUST` rule needs `hook` or `ci` |
| `check` | When `verified-by` has `hook` or `ci` | Free text naming the hook or CI job | Lets people find the enforcement |
| `targets-failure` | Yes | A value from the failure vocabulary below | The failure this rule exists to prevent; used by evals |
| `observed-on` | Yes | List of model IDs, or `[]` | Models on which the failure was documented or measured |
| `rationale` | Yes | One sentence | Why the rule exists, for maintainers |
| `sources` | No | List of repo paths or URLs | Evidence |

### Failure vocabulary

`test-gaming`, `scope-creep`, `over-engineering`, `destructive-action`, `data-loss`, `invented-api`, `stale-knowledge`, `unverified-claim`, `security-regression`, `secret-exposure`, `accessibility-regression`, `performance-regression`, `convention-drift`, `project-decision`.

Use `project-decision` for rules that record a choice the agent could not infer (a framework version, a budget, a naming scheme) rather than a failure mode.

### ID prefixes

| Prefix | Area | Prefix | Area |
|---|---|---|---|
| `WA` | Working agreement | `DOC` | Documentation |
| `TEST` | Testing | `GIT` | Git and GitHub |
| `CODE` | Code quality | `WEB` | `web-platform` pack |
| `ARCH` | Architecture | `TS` | `typescript` pack |
| `SEC` | Security and privacy | `NEXT` | `react-nextjs` pack |
| `PERF` | Performance | `ASTRO` | `static-sites` pack |
| `A11Y` | Accessibility | `NODE` | `node-services` pack |
| `UX` | User-centred design | `PG` | Postgres (`node-services` pack) |
| `API` | API design | `UE` | `unreal-plugin` pack |
| `DATA` | Data and persistence | `FAB` | Fab distribution (`unreal-plugin` pack) |
| `OBS` | Observability | | |

New prefixes are added to this table and to the lint in the same change.

## Body

The body is what the model sees. Write it for a capable reader who follows instructions literally.

- **Imperative and scoped.** Say what to do and where it applies. Keep the scope explicit so the rule is not applied outside it.
- **Give the reason** in a short "because" clause or sentence.
- **Name the check.** If a command proves compliance, name it and say its output belongs in the report.
- **Plain wording.** No capitals for emphasis and no MUST/SHOULD/MAY keywords; the level lives in frontmatter.
- **Concrete over generic.** Name specific patterns, commands, or files. Point to an exemplar file where one exists.
- **Short.** At most 120 words. Detail belongs in a practice guide linked from `sources`.
- **Nothing a tool already enforces.** If a linter, formatter, compiler, or type checker enforces it, leave it out.

The lint rejects these phrases in bodies (case-insensitive): `CRITICAL`, `IMPORTANT:`, `NEVER EVER`, `think step by step`, `think carefully`, `show your reasoning`, `explain your reasoning`, `double-check`, `double check`, `if in doubt`, `when in doubt`, `only report important`, `only report high`, and the standalone uppercase words `MUST`, `SHOULD`, `MAY`, `ALWAYS`, `NEVER`.

## Budgets

| What | Limit |
|---|---|
| One rule body | 120 words |
| Always-on text in a rendered repo (`AGENTS.md` plus all rules without `paths`) | 200 lines |

## Loading behaviour to design around

From [experiment R7](research/experiments/r7-rule-loading.md) and the Claude Code docs:

- Rules without `paths` load at session start.
- Rules with `paths` load after the agent reads or edits a matching file, not when it only searches with Grep. Guidance needed during planning or search must be unscoped or live in a skill.
- Frontmatter and HTML comments never reach the model, so maintainer notes in `<!-- -->` are free.
- Invalid YAML makes a scoped rule load everywhere, so the lint parses every file.
- Instruction files are concatenated and conflicts resolve arbitrarily. Never write a rule that contradicts another; replace or remove the other file instead.

## Waivers

A project waives a rule by replacing the rendered file with a waiver of the same filename:

```yaml
---
id: TEST-001
waiver: true
reason: Snapshot tests in this repo are regenerated by a reviewed script.
approved-by: <name>
date: 2026-10-05
---
```

A waiver has no body, so nothing reaches the model. The lint accepts waivers in rendered repos and rejects them in `rules/`.
