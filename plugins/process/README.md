# rfr-process

A staged project development process for products built with agents, from [rules-for-robots](../../README.md). The design is in [docs/specs/project-process.md](../../docs/specs/project-process.md).

Install it from this marketplace with `/plugin install rfr-process@rules-for-robots`. It declares `rfr-core` as a dependency, so Claude Code installs that too.

This is slice 11a: templates, links between artifacts, and the CI check. Approvals, issue sync, the tier check, skills, and the persona walkthrough follow in later slices.

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
2. Copy `templates/workflows/rfr-process.yml` to `.github/workflows/`. It runs the check on pull requests and on pushes to the default branch, and opens a `stale` issue when the default branch fails.
3. Start each artifact from `templates/artifacts/`.

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
