# rfr-process

A staged project development process for products built with agents, from [rules-for-robots](../../README.md). The design is in [docs/specs/project-process.md](../../docs/specs/project-process.md).

Install it from this marketplace with `/plugin install rfr-process@rules-for-robots`. It declares `rfr-core` as a dependency, so Claude Code installs that too.

Slices 11a and 11b are in: templates, links between artifacts, the CI checks, approvals, size tiers, CODEOWNERS, issue sync, and a merge guard hook. Skills, profile templates, and the persona walkthrough follow in later slices.

## The process

Approvers configured in `docs/product/process.yml` approve the design phase: concept, requirements, personas, epics, stories, design and UX, and user documentation. Agents then run the delivery phase: technical specification, unit tests, implementation, and regression tests. Approvers review again at tutorials and demos, and at release. Any stage can be revisited, and features move through the stages independently.

| Stage | Where it lives |
|---|---|
| Concept | `docs/product/concept.md` |
| Requirements | `docs/product/requirements/<area>.md` |
| Personas | `docs/product/personas/<name>.md` |
| Epics | `docs/product/epics/<name>.md` |
| Stories | `docs/product/stories/<epic>/<name>.md` |
| Design and UX | `docs/design/` |
| User documentation | `docs/user/` |
| Technical specifications | `docs/specs/` (only files with an `id` are process artifacts) |
| Tutorials | `docs/tutorials/` |

## Setting up a project

1. Copy `templates/process.yml` to `docs/product/process.yml` and name the approvers.
2. Copy `templates/workflows/rfr-process.yml` to `.github/workflows/`. It runs the jobs below on pull requests, reviews, and pushes to the default branch.
3. In team mode, run `node .rfr/checks/process-codeowners.mjs` to write the CODEOWNERS block, and make the `process / approvals` and `process / tier` checks required in branch protection.
4. Create the labels `tier:trivial`, `tier:fix`, `tier:story`, and `tier:epic`.
5. Start each artifact from `templates/artifacts/`.

## Links and staleness

Each artifact has an `id`, a `status` (`draft`, `approved`, or `implemented` for specs), and a `derived-from` list of the sections it comes from, each with a hash:

```yaml
derived-from:
  - epic-retarget: 3f2a9c1e0b7d
  - persona-animator#goals: 9c0e5b21aa40
```

A section is a heading (by slug or by an ID it contains, such as `REQ-animation-1`), a table row whose first cell is an ID, or a list item starting with an ID. Hashes ignore whitespace and front matter.

When an upstream section changes, every approved artifact that links to it is stale and the check fails. In the same pull request, update each one, re-record its hashes if the change does not affect it, or withdraw it to `draft` with `withdrawn: <reason> (#<issue>)`. An approved artifact that links to a draft one also fails, so a withdrawal has to go all the way down.

To record hashes, run this from the project root, with `.rfr` as a checkout of rules-for-robots (or use the path to your copy of `checks/`):

```
node .rfr/checks/process-relink.mjs <id> [<id> ...]
```

Recording hashes is not approval. The pull request that carries them is approved like any other change to that stage.

## The check

`node .rfr/checks/process-trace.mjs [root] [--base <ref>]` fails on:

1. a duplicate id, or a link to an id or section that does not exist;
2. a cycle of links;
3. an approved artifact that links to a draft or withdrawn one;
4. a stale link, or an approved link with no recorded hash;
5. a story that names no persona, or a persona that is not approved;
6. a spec `test:` criterion whose Source column names no story or user documentation section from its `derived-from`;
7. with `--base`, an artifact approved at the base that is now draft without a `withdrawn` entry.

`--status` lists each persona, epic, and story, how far the work below it has reached, and anything stale or withdrawn.

Existing projects can set `adoption-until: <date>` in `process.yml`. Until that date, problems with artifacts that have no links yet are warnings.

## Approvals

Who approved a change is read from GitHub, never from front matter.

- **Team mode** (`mode: team`): each gated stage a pull request changes needs an approving review, on the current head commit, from one of that stage's approvers. A member of a listed team counts if the workflow's token can read team membership. A reviewer's latest review is the one that counts.
- **Solo mode** (`mode: solo`): GitHub does not let you approve your own pull request, so the approval is you merging it. After each merge, the job checks that an approver merged it and opens a `process-approval` issue if not, or if a gated change was pushed without a pull request.

Gated stages are concept to user documentation, and tutorials. Specs are gated only when `process.yml` lists spec approvers.

Required reviews and checks need a paid GitHub plan for private repositories. Without them, the jobs still report failures and open issues, but cannot block a merge.

## The merge guard

The plugin's `guard-merge` hook denies `gh pr merge`, `gh api .../pulls/N/merge`, and the GitHub MCP merge tool when the pull request touches a gated folder, because the approver's merge is the approval. It lists the pull request's files with `gh`; if it cannot, it denies the merge. Projects without `docs/product/process.yml` are not affected. Users can disable plugin hooks, so the hook is a convenience and the approvals job is the enforcement.

## Size tiers

Each pull request carries one label: `tier:trivial`, `tier:fix`, `tier:story`, or `tier:epic`. The tier job fails a `tier:trivial` pull request that changes a process artifact or a `public-api` path, and a `tier:fix` pull request that changes `docs/product/`, `docs/design/`, or `docs/user/`. A change to documented behaviour is at least a story.

## Issue sync

After each merge, every persona, epic, and story gets an issue labelled `rfr-process` and `stage:<stage>`; stories are attached to their epic as sub-issues when created. The file always wins: the next sync rewrites the title, body, stage label, and open state, keeps other labels and the discussion, and closes the issue of a deleted artifact. Large first syncs stop at 100 writes or a long rate limit, and the next run continues.
