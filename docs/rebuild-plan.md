# Rebuild plan: Rules for Robots in the RulesForRobots organization

Written 2026-11-15. Status: **decisions taken** on 2026-11-15 (section 10): the maintainer took the recommended answer for D1 to D7, and chose to create the Creation and Research repositories now (D8). The plan is approved when this pull request merges.

The maintainer created the `RulesForRobots` organization as the home for everything rfr, and asked: if we were building this for the first time today, knowing what we know and with a clearer picture of what rfr is for, how would we build it, and what would we do differently? The organization should expect separate maintainers and specialised content (agents, skills, rules) for each domain, without being restructured as it grows, and should stay easy to use on large and small projects.

The answer in this plan is a rebuild, not a transfer: new repositories, built from a clear charter, carrying over what has proved itself and leaving the rest in this repository, which becomes the archived record. The maintainer is the only user, so projects move one at a time and nothing breaks for anyone else.

## 1. What rfr is for

The charter, approved as written on 2026-11-15 (D1). It goes at the top of the new front-door repository.

> Rules for Robots lets one person direct agents through a whole project by approving decisions, never commands. The person approves what the work should be (a brief, a design, the documentation users will read) and whether the result is right. Agents do everything in between without asking. What must never happen is made impossible, not asked about; what must be true is checked by CI; who approved what is recorded in GitHub. It works for a weekend script and for a product with many features, and the same approach applies to software, to pictures and film, and to research.

Everything below follows from four principles the last two months established, each at some cost:

1. **Approve decisions, never commands.** The person reviews artifacts in GitHub. A permission prompt or a question during a run is a fault.
2. **Put each control where it cannot be argued with.** Who approved: GitHub reviews and branch protection. What is true: CI. What can be damaged: the environment and guards that refuse. A session is told the state and the next step; it is never asked to police itself.
3. **Keep only what earns its place.** A rule ships when it has a mechanical check or evidence that it changes agent behaviour. Advice the models already follow is cost without benefit.
4. **Try it on a throwaway repository, then on a real project, before calling it done.**

## 2. What we would do differently

| What happened | Cost | What the rebuild does |
|---|---|---|
| One repository held rules, six plugins, CI scripts, generated templates, 8 MB of evals, three examples, research, brand, and video | Every change ran the whole suite (7 minutes); nobody could own one part | Repositories by domain, each plugin a self-contained folder with its own tests, version, and changelog (sections 3 and 4) |
| The process engine, its CI, and software-specific stages were mixed in `rfr-process` and `checks/` | The gate and the delivery run, which suit any domain, could not be used for the logo or the intro film | A domain-neutral engine in Core; each domain declares its stages and artifacts (section 5) |
| 21 releases in six days; three permission models in two days; the process spec reached AC-64 | Fixes did not reach the sessions where problems were seen; specs were hard to read | Two channels: `latest` for the maintainer's own projects, pinned releases for everyone else. Specs are short and current; history goes in decision records (section 6) |
| Fresh cloud sessions installed whatever was on `main` | No way to hold a release while testing one | The marketplace pins each plugin to a tag or commit (section 6) |
| Modes added and removed: solo, team, supervised, delegated, unattended, guard tiers | Code, tests, and docs for paths no longer taken | One way of working. Small projects use less of it, not a different version of it (section 7) |
| 55 rules, three with eval evidence; pruned to 12 | Context cost, and rules that told agents to stop and ask | Rules start from the 12 and the evidence. Each rule's evidence lives beside it (section 4) |
| Generated files committed (`template-repos/`, the install payload, the same script copied into three plugins) | Edits in the wrong place; reviews of generated diffs | Nothing generated on `main`. One way to adopt: install plugins and run `setup` |
| Tests locked to spec criteria, with an unlock procedure | Correct, but heavy for rfr's own development | rfr's own tests are ordinary behaviour tests. The protection against agents editing tests is a product feature for adopters, and rfr dogfoods it through its own process (decision D7) |
| History mixed into working documents (PLAN.md 70 KB, CHANGELOG 155 KB, handoff paragraphs back to 25a) | A new session reads history to find the state | Working documents describe now. The record of how we got here stays in the archived repository |

## 3. The organization

```
RulesForRobots/
├── .github                       # Org profile, brand, defaults for every repository
├── rules-for-robots              # The front door: charter, getting started, the marketplace
├── rules-for-robots-core         # rfr-core, rfr-process, rfr-feedback
├── rules-for-robots-engineering  # rfr-engineering, rfr-web, rfr-unreal, rfr-android
├── rules-for-robots-creation     # Created at step 2; its first plugin comes at step 7
├── rules-for-robots-research     # Created at step 2; scope and first plugin to come
└── rules-for-robots-legacy       # This repository, archived, once the last project moves
```

### Why this shape lasts

Claude Code lets one marketplace list plugins from any folder of any repository: a `git-subdir` source names a repository, a path, and a `ref` or `sha` ([marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference.md)). So:

- **Users see one marketplace and plugins.** `/plugin marketplace add RulesForRobots/rules-for-robots`, then install from the `rfr` marketplace. Where a plugin lives is invisible to them.
- **Moving a plugin is one line.** If `rfr-unreal` gains its own maintainers and a self-hosted runner, it moves to `rules-for-robots-unreal` and its marketplace entry changes. Nothing a user installed or wrote changes. That is what makes this structure stable: the plugin is the unit, and repositories are only where maintainers keep them.
- **Dependencies are enforced.** A plugin declares `"dependencies": [{"name": "rfr-core", "version": "^1.0"}]`; Claude Code installs it and disables the dependent plugin if the range is not met. Ranges resolve against tags named `<plugin>--v<version>` in the dependency's repository ([dependencies](https://code.claude.com/docs/en/plugins/dependencies.md)). All rfr plugins stay in one marketplace, so no cross-marketplace allowlist is needed.

### What each repository holds

| Repository | Holds | Owners |
|---|---|---|
| `.github` | `profile/README.md` (the org's front page), `brand/` (moved from `docs/brand`), default `CONTRIBUTING.md`, `SECURITY.md`, issue forms, pull request template | Maintainer |
| `rules-for-robots` | `README.md` (charter and getting started), `.claude-plugin/marketplace.json`, `docs/` for people choosing and adopting (which plugins, rules only or full process, migrating). No code | Maintainer |
| `rules-for-robots-core` | The domain-neutral plugins, the reusable workflows for the gate and process, `tools/` for rfr's maintainers (eval harness, session replay, attention report) | Core maintainers |
| `rules-for-robots-<domain>` | That domain's plugins, its reusable workflows (such as Unreal Tier 1), its examples and eval cases | That domain's maintainers, by `CODEOWNERS` per plugin folder |

Creation and Research are created at step 2 with the same layout (section 4) and a README stating their scope, so contributors can see where the work will go (D8). A later domain repository is created the same way, with the branch ruleset imported from an existing repository, and gets a mark through the brand's "Adding a volume" steps.

## 4. Inside every domain repository

The same layout everywhere, so a maintainer who knows one knows all of them:

```
rules-for-robots-<domain>/
├── AGENTS.md  CLAUDE.md  README.md  ROADMAP.md
├── .github/
│   ├── CODEOWNERS                 # One line per plugin folder
│   └── workflows/
│       ├── ci.yml                 # Tests only the plugins a change touches
│       ├── release.yml            # Tags <plugin>--v<version>, writes the release notes
│       └── <reusable>.yml         # Workflows adopters call, if the domain has any
├── plugins/
│   └── rfr-<name>/                # Self-contained: nothing outside this folder at run time
│       ├── .claude-plugin/plugin.json
│       ├── README.md  CHANGELOG.md
│       ├── rules/                 # Rule files, each with its evidence beside it
│       ├── stages/                # Stage and artifact definitions, for rfr-process
│       ├── agents/  skills/  hooks/  scripts/
│       └── test/
├── evals/                         # Cases for this repository's rules; results summarised in each rule
├── examples/                      # Only what CI or a tutorial runs against
└── docs/
    ├── specs/                     # Current specs, one per component
    └── decisions/                 # ADRs: why things are as they are
```

Conventions:

- **Self-contained plugins.** A plugin reads nothing from another plugin's folder. Shared code is owned by Core and bundled into a plugin by a build step; CI checks the bundled copy matches, and nobody edits it by hand.
- **Plugins cannot load instructions into context** ([manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference.md)). So each plugin keeps its rules in `rules/`, and `rfr-core`'s `setup` skill writes the rules of every installed rfr plugin into the project's `.claude/rules/rfr/` and a marked block in `AGENTS.md`. Invariants are hooks, as now.
- **A rule's evidence is beside it**: the eval case, its result, or the CI check that enforces it. The ledger is generated from those, not kept by hand.
- **Specs are short and current.** A change to a spec replaces text; the reasoning goes in a decision record. A spec that needs a version history is too big.
- **Each repository has its own `ROADMAP.md`** (open work only) and its `AGENTS.md` names its verify command. The front door's `ROADMAP.md` covers work across repositories, and the cross-repository handoff lives there.

## 5. The plugins, and what carries over

Each component is rebuilt in its new home, with its tests, only if it has a real use now. Bringing it over is the moment to simplify it. These verdicts come from reading the current plugins and the handoff; each one is confirmed when its slice is built.

### Core (`rules-for-robots-core`)

| Plugin | Carries | From |
|---|---|---|
| `rfr-core` (every project) | Guards that refuse what must never happen (destructive commands, shell writes to protected files, MCP actions outside declared services); `setup` (from `install-rules`), which writes the rules of installed rfr plugins; the working-agreement rules (WA-001 to WA-006, WA-012) and SEC-001, SEC-003, DOC-001; `decisions` and `write-adr`; the `check-runner` and `citation-checker` agents | `plugins/core` |
| `rfr-process` (the full process) | The domain-neutral engine: process state at session start, the GitHub gate (bot-opened pull requests, reviews on gated folders), the delivery run and its stop check, the decisions file, `deliver` and `revise`, the reusable process workflow. It reads stage definitions from installed domain plugins | `plugins/process`, `checks/ci/process-*`, `deliver-on-merge` |
| `rfr-feedback` (optional) | `report-feedback`, filing on the repository of the plugin concerned | `plugins/feedback` |

### Engineering (`rules-for-robots-engineering`)

| Plugin | Carries | From |
|---|---|---|
| `rfr-engineering` (any software) | Software stages and templates (brief, stories, design, user documentation, spec, tests, implementation, tutorial, validation); TEST-001, TEST-003, TEST-004 with their evals; the test-edit guard and test-change review; `code-reviewer`, `security-reviewer`, `software-architect`, `review-pr`, `security-audit`, `plan-feature`, `lookup-api`; lasting tutorials and the tutorial runner; the docs lint (Vale) | `plugins/core`, `plugins/process`, `checks/` |
| `rfr-web` | Web packs (web platform, TypeScript, React and Next.js, Node services, static sites); `web-engineer`, `accessibility-reviewer`, `performance-reviewer`, `ux-reviewer`; audits; Vercel and database guards; the web tutorial runner and previews | `plugins/web`, `rules/packs`, `plugins/core` |
| `rfr-unreal` | Unreal pack; `unreal-engineer`; packaging and profiling; Tier 1 checks and workflow; `RfrSample` as its CI fixture | `plugins/unreal`, `checks/unreal`, `examples/unreal` |
| `rfr-android` | The adb guard; a pack when there is evidence for one | `plugins/android` |

### Left in the archive

- `template-repos/`, `templates/repo-files/`, and the build that renders them: `setup` is the one way to adopt.
- `examples/web-app` and `examples/unreal-plugin`: XR Studio In A Box is now the real reference project.
- Modes and their remains: delegated and supervised modes, solo and team, guard tiers, task approval, the `process / tier` check, and the eval candidates for them.
- Components marked "experimental, not yet evaluated" (`tech-lead`, `persona-walkthrough`) wait in the archive until a project needs them; then they come over with an eval.
- The unrun eval phases (10c, 14b, 15e, Android 24c and 24d), unless the maintainer names one worth a budget.
- PLAN.md's phase record, the improvement and rewrite plans, the verify inventory, the research notes, the 155 KB changelog, and the 2.5 MB repository snapshot fixture. They stay readable in the archive; the evidence that matters is distilled into the rules it supports.

## 6. Releases and channels

- **Versions per plugin**, semver, tagged `<plugin>--v<version>` (the form dependency ranges resolve against). Each plugin has its own `CHANGELOG.md`; the front door's release notes link them. Versions restart at 1.0.0 in the new marketplace (decision D5).
- **Two channels from one marketplace.** The marketplace's `main` branch lists each plugin pinned to a released tag: the stable channel. A `latest` branch lists each plugin at its repository's `main`. A project picks with the `ref` in its `.claude/settings.json`: `"source": {"source": "github", "repo": "RulesForRobots/rules-for-robots", "ref": "latest"}`. The maintainer's own projects run `latest`; that is how changes get used before they are released. Claude Code has no channels of its own and documents this approach ([host a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace.md)).
- **Reusable workflows are called by the same tag as the plugin**, for example `uses: RulesForRobots/rules-for-robots-core/.github/workflows/process.yml@rfr-process--v1.2.0`. `setup` writes that line from the installed version, and process state warns when the two drift apart.
- **A release is a decision**, made by the maintainer, at a pace adopters can follow. Day-to-day changes reach the maintainer's projects through `latest` without one.

## 7. Small and large projects

One way of working, used in part or in full:

| | Rules only | Full process |
|---|---|---|
| For | A script, a prototype, agent-assisted work | A product with users and features, agents running unattended |
| Installs | `rfr-core` and a domain plugin, then `/rfr-core:setup` | The same, plus `rfr-process`, then `/rfr-process:setup`, the `rfr-agent` App, and branch protection |
| Gets | Rules, guards, reviewers, the domain's skills | Approved packets, approvals in GitHub, delivery runs, lasting tutorials |
| Moving up | Install `rfr-process` and run its setup; nothing installed earlier changes | |

The front door leads with this choice, so a small project is not handed the whole process to read.

## 8. Build order

One slice per pull request, as now. Each step ends with something working on a real project. Steps 2 to 5 are where most of the work is.

1. **Approve this plan** (this pull request), including the charter and the decisions in section 10.
2. **Scaffold the organization.**
   - Maintainer, in Settings: two-factor for members; base permission read; install the Claude GitHub App on the organization (cloud sessions need it), and the `rfr-agent` App where projects use the gate; a branch ruleset on each repository's default branch (pull request required, no force push, no deletion), made once and copied to the others by exporting and importing its JSON, because organization rulesets are not enforced on the Free plan; default labels including `feedback`. When there are other maintainers, GitHub Team allows one organization ruleset instead.
   - Agent: create `.github` (profile, brand, community files) and the front door (charter, an empty marketplace on `main` and `latest`). Create `rules-for-robots-core` and `rules-for-robots-engineering` from the layout in section 4, with CI and the release workflow working on an empty plugin. Create `rules-for-robots-creation` and `rules-for-robots-research` from the same layout, each with a README stating its scope and no plugin yet.
3. **Core, rules only.** `rfr-core` with its guards, `setup`, and rules. Try it on a throwaway repository, then on one real project at "rules only".
4. **Core, full process.** `rfr-process` with the gate, state, and delivery run, and `rfr-engineering` as its first set of stages. Try the gate on a throwaway repository first, as in 25a.
5. **Move XR Studio In A Box.** With `rfr-web`. Its settings switch marketplaces, its workflows switch `uses:` lines, and the next packet is delivered on the new plugins. This is the acceptance test of the rebuild, the same one 25f used: one approval, no interruptions, a preview and a tutorial at the end.
6. **The other projects, one at a time.** Kettlebird website with `rfr-web`; Open3DPuppet with `rfr-unreal` (and `rfr-android` where a project needs it). Then the first stable release: tags, and the marketplace's `main` pinned to them.
7. **Creation.** `rfr-creation` in `rules-for-robots-creation`, built from the logo and intro-film trials (#278): stages that lock each artifact before a costlier one, checks that are technical conformance only, and taste left to the person. It is the first domain that is not software, so it is the test that Core's engine is truly domain-neutral.
8. **Archive.** When no project uses the old marketplace: transfer this repository to the organization as `rules-for-robots-legacy` (links to it keep working through GitHub's redirect), archive it, and link it from the front door as the record of how rfr was made.

## 9. This repository until then

- **Frozen for features.** Only fixes that a project still on it needs. New work goes to the new repositories.
- **Open pull requests:** #272 (8.0.0) merges only if XR Studio In A Box's validation needs it before step 5; otherwise it closes, and its decisions carry into `rfr-process` 1.0.0. #274 (scoped hosting access, a Phase 28 spec) moves to `rules-for-robots-core` as a spec. #278 (the intro film and a process for films) is the seed of step 7; the film itself can finish here.
- **The maintainer's machine** keeps the old marketplace, named `rules-for-robots`, until the last project moves. The new one is named `rfr` (D3), so both can be installed at once.

## 10. Decisions for the maintainer

| | Question | Recommended | Alternative |
|---|---|---|---|
| D1 | The charter in section 1 | Approve, or rewrite it in your words; it is the test every later choice is judged against | |
| D2 | Repository names | As in section 3: the front door `rules-for-robots`, domains `rules-for-robots-<domain>`, matching the brand. Full names keep clones and forks recognisable outside the organization | Short names (`core`, `engineering`) |
| D3 | Marketplace name | `rfr`, so plugins are `rfr-core@rfr`. It cannot be `rules-for-robots` while the old marketplace of that name is installed, and short is easier to type | `rules-for-robots` after the old one is removed, which forces every project to move at once |
| D4 | Where the process engine lives | In Core as `rfr-process`, domain-neutral, with domains declaring stages. Engineering is its first user and Creation its second, soon after, so the abstraction is tested by a real second domain and not guessed | Keep it in Engineering until Creation needs it, and move it then |
| D5 | Plugin versions in the new marketplace | Start at 1.0.0: new repositories, new marketplace, new history | Continue the old numbers (`rfr-core` 9.0.0) |
| D6 | Git history in the new repositories | Start fresh. A carried-over file's first commit names its source path and commit in the archive | Import the history of each moved folder with `git filter-repo`: complete, but brings the mess along |
| D7 | Does rfr develop itself through its own process? | Yes, at "full process" in Core and Engineering: rfr's specs are approved packets, and the gate applies to them. It is the best test of the product, and it replaces the spec-lock machinery rfr used on itself | Rules only, with the maintainer approving pull requests directly |
| D8 | When to create Creation and Research | Creation at step 7; Research when there is a first plugin to put in it | Create both now, empty |

### Answers, 2026-11-15

| | Answer |
|---|---|
| D1 | Charter approved as written |
| D2 | Full names: `rules-for-robots-<domain>` |
| D3 | Marketplace `rfr` |
| D4 | The engine is `rfr-process` in Core, domain-neutral |
| D5 | Versions restart at 1.0.0 |
| D6 | Fresh history; carried files cite their source |
| D7 | rfr develops itself through its own full process |
| D8 | Create Creation and Research now, at step 2 (the alternative) |

## 11. Not in this plan

- A documentation website. The front door's README and `docs/` serve until there is a reader they do not.
- GitHub Discussions and Projects. Feedback arrives as issues through `rfr-feedback`; a second channel would split it.
- Changes in behaviour while porting. Each component comes over doing what it does today, simplified; behaviour changes are their own slices with their own specs.
