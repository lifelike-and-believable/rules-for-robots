# rfr-process

A staged project development process for products built with agents, from [rules-for-robots](../../README.md). The design is in [docs/specs/project-process.md](../../docs/specs/project-process.md).

Install it from this marketplace with `/plugin install rfr-process@rules-for-robots`. It declares `rfr-core` as a dependency, so Claude Code installs that too.

Slices 11a to 11c, 11e, and 11g are in: templates for each artifact and each project type, links between artifacts, the CI checks, approvals, size tiers, CODEOWNERS, issue sync, runnable and recorded tutorials, a merge guard hook, the `persona-walkthrough` agent, the `setup` and `bootstrap` skills, advisory docs-lint (Vale) and mutation (Stryker) jobs, a workflow that runs tutorials against preview deployments, and a guide to recommended tools and installing them safely. How to write each artifact and what each review checks is in the [guide](GUIDE.md). The spec template, release readiness, feedback triage, and the eval round follow in 11d.

## The process

Approvers configured in `docs/product/process.yml` approve the design phase: concept, requirements, personas, epics, stories, design and UX, and user documentation. Agents then run the delivery phase: technical specification, unit tests, implementation, and regression tests. Approvers review again at tutorials and demos, and at release. Any stage can be revisited, and features move through the stages independently.

| Stage | Where it lives |
|---|---|
| Concept | `docs/product/concept.md` |
| Requirements | `docs/product/requirements/<area>.md` |
| Personas | `docs/product/personas/<name>.md` |
| Epics | `docs/product/epics/<name>.md` |
| Stories | `docs/product/stories/<epic>/<name>.md` |
| Design and UX | `docs/design/`, with mock-ups beside each design and decision notes in `docs/design/decisions/` |
| User documentation | `docs/user/` |
| Technical specifications | `docs/specs/` (only files with an `id` are process artifacts) |
| Tutorials | `docs/tutorials/` |

## Setting up a project

Run `/rfr-process:setup`, which does steps 1, 2, and 5 for your project type and gives you the commands for 3 and 4. For a project that already has code and users, follow it with `/rfr-process:bootstrap`, which drafts the concept, requirements, and personas from what exists. By hand:

1. Copy `templates/process.yml` to `docs/product/process.yml` and name the approvers.
2. Copy `templates/workflows/rfr-process.yml` to `.github/workflows/`. It runs the jobs below on pull requests, reviews, and pushes to the default branch. It follows rules-for-robots `main`, so fixes arrive at once, and so do changes that could turn your CI red. For stable CI, pin both the `uses:` line (`...rfr-process.yml@<tag or commit>`) and the `rules-ref` input to the same release tag or commit, and update them on purpose.
3. In team mode, run `node .rfr/checks/process-codeowners.mjs` to write the CODEOWNERS block, and make the `process / approvals` and `process / tier` checks required in branch protection.
4. Nothing to do for labels: the tier job creates `tier:trivial`, `tier:fix`, `tier:story`, and `tier:epic` on its first run.
5. Start each artifact from `templates/artifacts/` (including `decision.md` for a choice that spans epics), and use the persona starters and the user documentation and tutorial templates for your project type in `templates/profiles/<unreal-plugin | web-app | static-site>/`. A static site has a visitor-facing page (`user-doc.md`) and an editor guide for content in files (`user-doc-editor.md`) or in a CMS (`user-doc-editor-cms.md`). The templates link to sections (`concept#audience`, `epic-<name>#outcome`), so an edit elsewhere in an upstream artifact does not make everything below it stale.

## Links and staleness

Each artifact has an `id`, a `status` (`draft`, `approved`, or `implemented` for specs), and a `derived-from` list of the sections it comes from, each with a hash:

```yaml
derived-from:
  - epic-retarget: 3f2a9c1e0b7d
  - persona-animator#goals: 9c0e5b21aa40
```

A section is a heading (by slug or by an ID it contains, such as `REQ-animation-1`), a table row whose first cell is an ID, or a list item starting with an ID. Hashes ignore whitespace and front matter.

When an upstream section changes, every approved artifact that links to it is stale and the check fails. In the same pull request, update each one, re-record its hashes if the change does not affect it, or withdraw it to `draft` with `withdrawn: <reason> (#<issue>)`. An approved artifact that links to a draft one also fails, so a withdrawal has to go all the way down.

A new link can be written as `- id#section` or `- id#section:`, with no hash. To record hashes, run this from the project root, with `.rfr` as a checkout of rules-for-robots (or use the path to your copy of `checks/`):

```
node .rfr/checks/process-relink.mjs <id> [<id> ...]
```

Recording hashes is not approval. The pull request that carries them is approved like any other change to that stage (see "How an artifact becomes approved" below).

## The check

`node .rfr/checks/process-trace.mjs [root] [--base <ref>]` fails on:

1. a duplicate id, or a link to an id or section that does not exist;
2. a cycle of links;
3. an approved artifact that links to a draft or withdrawn one;
4. a stale link, or an approved link with no recorded hash;
5. a story that names no persona, or a persona that is not approved;
6. a spec `test:` criterion whose Source column names no story or user documentation section from its `derived-from`;
7. with `--base`, an artifact approved at the base that is now draft without a `withdrawn` entry;
8. a story without "As <persona>, I want ... so that ..." naming a persona it links to, or without an "Acceptance criteria" section with at least one item (a warning while the story is a draft). The role matches the persona's id, short name, or title, or the start of the title ("Star" for "Star, the artist"), at word boundaries; a word from the middle of a title does not.

It warns, without failing, when a bold name in a user documentation page appears in no design the page links to or reaches through its stories. It prints the rules-for-robots commit it ran from, so a local run and a CI run can be compared.

`--status` lists each persona, epic, and story, how far the work below it has reached, and anything stale or withdrawn.

Existing projects can set `adoption-until: <date>` in `process.yml`. Until that date, problems with artifacts that have no links yet are warnings.

## Approvals

### How an artifact becomes approved

An artifact is approved by the pull request that says so. That pull request sets the artifact's `status: approved` and records its link hashes (`node .rfr/checks/process-relink.mjs <id>`), and the stage's approver approves the pull request: in team mode with an approving review, in solo mode by merging it. Merging a pull request whose artifacts still say `draft` approves nothing: they stay drafts, and nothing can build on them.

So a design-stage pull request usually goes through two steps in the same pull request:
1. Open it with the artifacts as `draft` while the approver reads and asks for changes.
2. When the approver says they are ready, set them to `approved`, record the hashes, and push. The approver then merges (or approves) that commit.

An agent writing the pull request may set `status: approved` in it; that is a proposal, and GitHub's review or merge is the approval. In solo mode, propose `approved` from the start, since the merge is the approval; keep `draft` for work that will not merge yet.

### When an agent merges for the approver

In solo mode the approver's merge is the approval, so agents do not merge pull requests that touch gated folders. When the plugin is installed, its `guard-merge` hook asks the person to confirm each such merge; when an agent follows the skills as plain files, the hook is not running, and the rule depends on the agent and the project's `AGENTS.md`. If the approver explicitly tells an agent in the session to merge a gated pull request, that instruction is their approval: the agent merges, then comments on the pull request with the instruction quoted and the session it came from, so the record shows who decided. GitHub records the approver's account as the merger either way, so the comment is the only trace that an agent pressed the button.

### Who approved, according to GitHub

Who approved a change is read from GitHub, never from front matter.

- **Team mode** (`mode: team`): each gated stage a pull request changes needs an approving review, on the current head commit, from one of that stage's approvers. A member of a listed team counts if the workflow's token can read team membership. A reviewer's latest review is the one that counts.
- **Solo mode** (`mode: solo`): GitHub does not let you approve your own pull request, so the approval is you merging it. After each merge, the job checks that an approver merged it and opens a `process-approval` issue if not, or if a gated change was pushed without a pull request.

Gated stages are concept to user documentation, and tutorials. Specs are gated only when `process.yml` lists spec approvers.

Required reviews and checks need a paid GitHub plan for private repositories. Without them, the jobs still report failures and open issues, but cannot block a merge.

## The merge guard

The plugin's `guard-merge` hook asks the person to confirm `gh pr merge`, `gh api .../pulls/N/merge`, and the GitHub MCP merge tool when the pull request touches a gated folder, because merging it is the approval. The permission prompt is where the approver says yes; the agent should then comment on the pull request with the instruction. It lists the pull request's files with `gh`; if it cannot, it asks anyway and says why. Projects without `docs/product/process.yml` are not affected. Users can disable plugin hooks, so the hook is a convenience and the approvals job is the enforcement.

## Size tiers

Each pull request carries one label: `tier:trivial`, `tier:fix`, `tier:story`, or `tier:epic`. The tier job fails a `tier:trivial` pull request that changes a process artifact or a `public-api` path, and a `tier:fix` pull request that changes `docs/product/`, `docs/design/`, or `docs/user/`. A change to documented behaviour is at least a story. The pull request that adds `process.yml` needs no tier. On a newly opened pull request without a tier label, the job re-reads the labels for up to a minute before failing, so labelling a pull request right after opening it does not leave a red run.

## Issue sync

After each merge, every persona, epic, and story gets an issue labelled `rfr-process` and `stage:<stage>`; stories are attached to their epic as sub-issues when created. The file always wins: the next sync rewrites the title, body, stage label, and open state, keeps other labels and the discussion, and closes the issue of a deleted artifact. Large first syncs stop at 100 writes or a long rate limit, and the next run continues.

## Runnable tutorials

Every tutorial in `docs/tutorials/` names its runner in front matter.

- `runner: web`: the tutorial is its own test. `node .rfr/checks/tutorial-run.mjs . --base-url <url>` opens the product in a browser and performs each step: ``Open `/path`.``, ``Type `text` into **Label**.``, ``Choose `option` from **Label**.``, `Check **Label**.`, `Click **Name**.`, and `You see **Text**.` Other sentences are narration, and a step ending in `(manual)` is skipped. When the product changes and the tutorial does not, the run fails at the step that no longer matches. Add the command to the job that runs your end-to-end tests against a preview; it needs `playwright` as a dev dependency. With `--record <dir>` it saves a screenshot after each step, `failure.png` at a failing step, and `video.webm` for each tutorial: upload the folder as a build artifact and the approver has the stage 12 demo.
- `runner: unreal`: an automation or functional test follows the tutorial and names its id in a comment. On a GPU runner, a screenshot functional test of the tutorial's editor step, compared against approved reference images, and a Movie Render Queue render of a demo sequence make the run the stage 12 demo too; `examples/unreal` and the `tutorial-demo` job in rules-for-robots' `unreal-tier2.yml` are a working example to copy.
- `runner: manual`: a person follows it before release.

The `tutorials` job checks, without a browser or the engine, that every tutorial names a runner, that web tutorials use steps the runner can perform, and that an automation test cites each Unreal tutorial.

## Advisory jobs

These report in the job summary and never fail the build.

- **`docs-lint`**: Vale on `docs/user/`, `docs/tutorials/`, and `docs/releases/`, with the RFR writing style and a vocabulary of persona names and glossary terms (`docs/product/glossary.md`). See the guide's recommended tools.
- **`mutation`** (with `mutation: true` in the caller, for `web-app` and `static-site`): Stryker on `tier:story` and `tier:epic` pull requests, using the project's `stryker.config.mjs` (start from `templates/profiles/<profile>/`). Later pushes to a pull request only retest the mutants their changes affect; a change to a test file reruns everything. The summary gives the mutation score and lists the surviving mutants.

## Tutorials against a preview

`templates/workflows/rfr-tutorials-preview.yml` runs the `runner: web` tutorials against each successful preview deployment (Vercel, Netlify, or any host that reports GitHub deployments), records them, and uploads the recording as the `tutorials` build artifact. For a protected preview, save the bypass token as the `RFR_PREVIEW_BYPASS` secret; the `bypass-header` input names the header (Vercel's `x-vercel-protection-bypass` by default), and it is sent only to the preview's origin. Locally, `RFR_TUTORIAL_HEADER="<name>: <value>"` does the same for `tutorial-run.mjs`.

## Persona walkthrough

The experimental `persona-walkthrough` agent does a cognitive walkthrough of user documentation, a design note, or a tutorial, once for each persona the stories name: at every step it asks where that persona would fail and why. For a web tutorial with a URL, it runs the tutorial first and reports mismatches with the product as facts. Findings are ordered by severity, each citing the story or persona section behind the expectation and the artifact that most likely needs to change. Run it before the approver reviews stages 6, 7, and 12. It has not been through an eval round yet.

### Project board

To place the issues on a GitHub Project as well:

1. Create the Project, and give it a single-select field named **Stage** with the options `Personas`, `Epics`, `Stories`, `Design`, `User docs`, `Specs`, and `Tutorials`. Add the options you use; a missing one is reported in the sync's log and that item is left where it is.
2. Add `project: https://github.com/orgs/<org>/projects/<number>` (or `.../users/<login>/projects/<number>`) to `process.yml`.
3. Create a token that can write to the Project and save it as the repository secret `RFR_PROJECT_TOKEN`. The workflow's own token cannot write to Projects. A classic token needs the `project` scope; a fine-grained token needs read and write access to the organization's Projects (or, for a user Project, a classic token).

After each merge, each persona, epic, and story is added to the board. Personas sit in Personas. Epics and stories move to the furthest stage that approved work at or below them has reached: a story whose design is approved sits in Design, and moves to User docs when its documentation is approved. Without the token, the board is skipped and the log says so.
