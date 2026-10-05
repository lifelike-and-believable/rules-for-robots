# Project Plan: rules-for-robots

Status: Draft v0.2 (2026-10-05). Updated with decisions from the initial review.

## 1. Goal

Produce a reusable set of **rules**, **best practices**, and **agent definitions** that steer AI coding agents (and the humans working with them) toward software, websites, web apps, and Unreal Engine plugins that are:

| Quality attribute | What it means here | How we will know |
|---|---|---|
| High-quality | Correct, tested, reviewed, consistent | Tests on critical paths, zero lint/type/compiler warnings at the agreed level, review checklist passes |
| User-centred | Solves a real user need; accessible; clear UX and content. For plugins, "users" includes the developers and designers who use the plugin in the editor | WCAG 2.2 AA for web; documented user stories and acceptance criteria; plugin settings, Blueprint API, and docs reviewed for usability |
| Performant | Fast to load and respond; efficient on client, server, and game thread | Core Web Vitals budgets (LCP, INP, CLS) and bundle budgets for web; frame-time and memory budgets profiled with Unreal Insights for plugins |
| Scalable | Handles growth in users, data, content, and team size | Stateless services and load-test baselines for web; plugins that behave well with large worlds, many actors, and network replication |
| Extensible | New features fit without rewrites | Clear module boundaries, stable public interfaces, extension points (e.g. subsystems, interfaces, delegates), ADRs for key decisions |
| Maintainable | Easy for a new contributor (human or agent) to change safely | Docs, conventions, small modules, automated checks, low change failure rate |

Security, privacy, and observability are treated as cross-cutting requirements underpinning all six attributes.

## 2. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Target agents/tools | Claude Code first. Keep content in plain Markdown so other tools can be supported later. |
| 2 | Stack opinion | Stack-independent core, plus optional stack packs covering Unreal Engine plugins, websites, and web apps. |
| 3 | Audience | A solo developer first, structured so teams and organizations can adopt and override it. |
| 4 | Strictness | MUST-level rules are enforced by CI where practical and relevant. |
| 5 | Distribution | Both a Claude Code plugin and a GitHub template repo. MIT licence. |
| 6 | Spelling | Canadian English (e.g. "centre", "colour", "behaviour", "organize", "licence" as noun). |

## 3. Scope

### In scope
- Stack-independent core rules and best practices.
- Stack packs for the three primary use cases (section 6).
- Agent definitions (Claude Code sub-agents) for the main stages of delivery.
- Reusable skills (e.g. "plan a feature", "review a PR", "accessibility audit", "profile a plugin").
- GitHub integration: issue and PR templates, CI workflows that enforce MUST rules, CODEOWNERS guidance.
- A validation approach showing the rules improve agent output.
- Layering so a team or organization can add or override rules without forking the core.

### Out of scope (initially)
- Mobile-native (iOS/Android) and desktop-native apps outside Unreal.
- Full Unreal game projects (the focus is plugins, though most plugin guidance applies to game modules too).
- Vendor-specific hosting runbooks.
- First-class support for agents other than Claude Code.

## 4. Guiding principles for the rules themselves

1. **Actionable and verifiable.** Every rule states what to do and how compliance is checked (CI check, review checklist, or test). Vague guidance goes in best-practice docs, not rules.
2. **Explained.** Each rule carries a one-line rationale so agents can apply judgement in edge cases.
3. **Graded.** RFC 2119 levels (MUST / SHOULD / MAY) tell agents what is negotiable.
4. **Context-budget aware.** Always-loaded instructions stay short. Detail lives in files loaded on demand (by path-scoped rules, skills, or agents), so agents are not flooded with irrelevant text.
5. **Enforced by tooling where possible.** If a linter, compiler, test, or CI job can enforce a rule, that is preferred over prose. Each MUST rule declares `verified-by: ci`, `review`, or `test`.
6. **Stable IDs.** Rules have IDs (e.g. `A11Y-003`, `UE-PERF-002`) so reviews, PR comments, and agents can cite them precisely.
7. **Layered.** Core, then stack pack, then organization, then team, then project, then personal. Later layers may add rules or relax SHOULD/MAY rules; relaxing a MUST requires a recorded exception (ADR or inline waiver citing the rule ID).

## 5. Proposed repository structure

```
rules-for-robots/
├── README.md                     # What this is, how to adopt it
├── LICENSE                       # MIT
├── CLAUDE.md                     # Entry point for working on this repo itself
├── .claude-plugin/
│   └── marketplace.json          # Lets the repo act as a Claude Code plugin marketplace
├── plugins/
│   ├── core/                     # Core plugin: rules, agents, skills, hooks
│   │   ├── .claude-plugin/plugin.json
│   │   ├── agents/
│   │   ├── skills/
│   │   └── hooks/
│   ├── web/                      # Stack-pack plugins (installed as needed)
│   └── unreal/
├── rules/                        # Short, enforceable, ID'd rules (source of truth)
│   ├── core/
│   │   ├── 00-working-agreement.md   # Always-on: how agents work
│   │   ├── architecture.md
│   │   ├── code-quality.md
│   │   ├── testing.md
│   │   ├── user-centred-design.md
│   │   ├── accessibility.md
│   │   ├── performance.md
│   │   ├── security-privacy.md
│   │   ├── api-design.md
│   │   ├── data-and-persistence.md
│   │   ├── observability.md
│   │   ├── documentation.md
│   │   └── git-and-github.md
│   └── packs/                    # Stack-pack rules (see section 6)
├── practices/                    # Longer best-practice guides with examples
├── templates/                    # Feature spec, ADR, PR, issue forms, runbook, CLAUDE.md starters
├── checks/                       # Reusable CI workflows, lint presets, scripts
├── template-repos/               # Starter layouts for the template-repo distribution
├── evals/                        # Tasks and rubrics for validating the rules
└── docs/
    ├── adoption-guide.md         # Solo, team, and organization adoption paths
    ├── layering-and-overrides.md
    └── contributing.md
```

How the two distribution channels relate: `rules/`, `practices/`, and `templates/` are the source of truth. The plugins package agents, skills, and hooks that reference them. The template repos are pre-wired starting points (CLAUDE.md, CI workflows, PR template) for new projects, and they install the plugins.

## 6. Stack packs

Each pack adds rules, practices, CI checks, and agent guidance for its stack. Packs can be combined (a web app typically uses `web-platform` + `typescript` + one framework pack + `node-services`).

| Pack | Covers | Example tooling and checks |
|---|---|---|
| `web-platform` | Semantic HTML, CSS architecture, responsive design, browser APIs, SEO basics, accessibility specifics | axe-core, Lighthouse CI budgets, HTML validation, Stylelint |
| `typescript` | Strict typing, module boundaries, error handling, dependency hygiene | `tsc --noEmit` (strict), ESLint, Prettier, Vitest |
| `react-nextjs` | Component design, state management, server/client rendering choices, data fetching, caching | React-specific lint rules, Playwright end-to-end tests, bundle analysis |
| `static-sites` | Content-heavy sites (e.g. Astro), content modelling, image pipelines, minimal JavaScript | Link checking, image budgets, Lighthouse |
| `node-services` | APIs, auth, validation, background jobs, Postgres, migrations, caching, rate limiting | Schema validation, migration checks, contract tests, load-test baselines |
| `unreal-plugin` | Plugin and module structure (`.uplugin`, runtime vs. editor modules), Epic C++ coding standard, UObject and GC rules, Blueprint API design, subsystems, replication, asset and content conventions, editor tooling UX, packaging for Fab and multiple engine versions | clang-format, include-what-you-use style checks, `.uplugin` validation, Automation Spec tests, BuildPlugin/RunUAT packaging, Unreal Insights profiling checklists |

Unreal CI constraint: building and testing plugins needs an engine installation, which hosted GitHub runners do not have. The plan provides two tiers:
- **Tier 1 (any runner):** formatting, static checks, `.uplugin` and config validation, documentation checks.
- **Tier 2 (self-hosted runner with the engine):** compile against each supported engine version, run Automation tests, package the plugin.

MUST rules that depend on Tier 2 are marked so a solo developer without a build machine can run them locally through a skill instead.

## 7. Agent roster (draft)

Each agent has a focused remit, a minimal tool set, the rules it must load, a step-by-step method, and a defined output format (e.g. findings with rule IDs and severity). Engineers and reviewers load stack-pack rules based on the files they are working on.

| Agent | Role | Typical trigger | Output |
|---|---|---|---|
| `tech-lead` | Breaks work down, sequences agents, resolves conflicting findings | Any multi-step task | Plan and hand-offs |
| `product-analyst` | Turns a request into user stories, acceptance criteria, and non-functional requirements | New feature or vague request | Feature spec from template |
| `ux-designer` | Flows, information architecture, content, interaction states; for plugins, editor UX, settings, and Blueprint ergonomics | After spec, before build | UX notes and component inventory |
| `architect` | System and module design, interfaces, data model, trade-offs | Non-trivial change or new system | Design doc and ADRs |
| `web-engineer` | Implements frontend and backend web code per the web packs | Build phase (web) | Code and tests |
| `unreal-engineer` | Implements plugin C++ and Blueprint-facing APIs per the Unreal pack | Build phase (Unreal) | Code and tests |
| `test-engineer` | Test strategy, missing tests, coverage of acceptance criteria | During and after build | Tests and gap report |
| `accessibility-reviewer` | WCAG 2.2 AA for web; game and editor accessibility guidance for Unreal | Pre-merge for UI changes | Findings with rule IDs |
| `performance-reviewer` | Web budgets, queries, caching; frame time, memory, tick usage, and loading for Unreal | Pre-merge, pre-release | Findings and measurements |
| `security-reviewer` | Threat model review, OWASP Top 10, secrets, dependencies, privacy; network trust boundaries for replicated code | Pre-merge for sensitive areas | Findings with severity |
| `code-reviewer` | Correctness, readability, maintainability, rule compliance | Every PR | Review comments |
| `docs-writer` | README, API and Blueprint docs, changelogs, runbooks, ADR upkeep | Before merge | Docs updates |
| `release-engineer` | CI/CD, versioning, feature flags, rollout and rollback; plugin packaging and engine-version matrix | Release | Release checklist |

Open design question: separate reviewer agents (sharper focus, can run in parallel) or one `code-reviewer` with checklists (less overhead). Start separate and merge if evals show no benefit.

## 8. Adapting for teams and organizations

- **Personal layer:** `CLAUDE.local.md` and user-level settings for individual preferences.
- **Project layer:** a project's `CLAUDE.md` picks packs and records project-specific rules and waivers.
- **Team/organization layer:** an organization can publish its own plugin that adds rules, tightens SHOULD rules to MUST, and sets required CI checks, without editing the core.
- **Governance:** CODEOWNERS for rule files, ADRs for rule changes, and a changelog so adopters can see what changed between versions.

`docs/layering-and-overrides.md` will document the precedence order and the waiver format.

## 9. Delivery phases

### Phase 0: Foundations
- Rule file format: frontmatter fields (`id`, `title`, `level`, `scope`, `applies-to` path globs, `verified-by`, `rationale`), ID scheme, Canadian spelling note.
- Repo skeleton, `LICENSE`, `CLAUDE.md` for this repo, `docs/contributing.md`.
- Plugin and marketplace manifests (empty shells) so packaging is tested from the start.
- **Exit criteria:** format spec plus one fully worked rule file approved; the core plugin installs in Claude Code.

### Phase 1: Core rules
- `00-working-agreement.md`: understand before changing, small steps, run checks before declaring done, never weaken or skip tests, ask when blocked, report results honestly.
- Topic rule files, prioritizing code-quality, testing, security-privacy, architecture, performance, accessibility, user-centred design.
- Sources: WCAG 2.2, OWASP ASVS and Top 10, web.dev guidance, Twelve-Factor App, Google SRE practices, established API design guides.
- **Exit criteria:** every rule has an ID, level, rationale, and verification method; the always-on file stays under roughly 1,500 words.

### Phase 2: Stack packs
- Order: `unreal-plugin`, `typescript`, `web-platform`, `react-nextjs`, `node-services`, `static-sites`. (Order is adjustable; Unreal first because it has the least existing agent guidance.)
- Sources for Unreal: Epic's coding standard, plugin and module documentation, Automation testing documentation, Fab technical requirements.
- **Exit criteria:** each pack has rules, at least one practice guide, and Tier 1 CI checks.

### Phase 3: Best-practice guides
- Longer `practices/` guides linked to rule IDs, with short good/bad examples.
- **Exit criteria:** every rule file links to at least one guide; every guide is referenced by at least one rule.

### Phase 4: Agents and skills
- Agent definitions per section 7, with hand-off contracts (what each agent produces and consumes).
- Skills: `plan-feature`, `implement-feature`, `review-pr`, `a11y-audit`, `perf-audit`, `security-review`, `write-adr`, `release`, `profile-unreal-plugin`, `package-unreal-plugin`.
- Hooks where they add value (e.g. run format and lint after edits).
- **Exit criteria:** each agent tested on at least two sample tasks with output in its declared format.

### Phase 5: GitHub integration and templates
- PR template with a rule-ID checklist, issue forms, ADR and feature spec templates.
- Reusable GitHub Actions workflows in `checks/` that enforce MUST rules, plus the self-hosted Unreal workflow.
- Template repos for: web app, static site, Unreal plugin.
- **Exit criteria:** a new repo created from a template is fully wired (CI, plugin, CLAUDE.md) in under an hour by following the adoption guide.

### Phase 6: Reference projects
- A small web app and a small Unreal plugin built with the full set of agents and rules.
- **Exit criteria:** both pass their own checks and meet declared budgets.

### Phase 7: Validation and evals
- `evals/` with representative tasks, e.g. "add a search page", "add a paginated API endpoint", "fix an accessibility bug", "add a replicated component to a plugin", "expose a subsystem to Blueprints".
- Run each task with and without the rule set; score against rubrics tied to the quality attributes.
- Remove or rewrite rules that do not change behaviour or that agents misapply.
- **Exit criteria:** measurable improvement for most tasks; no rule that consistently makes output worse.

### Phase 8: Release and maintenance
- Semantic versioning for the rule set and plugins; changelog.
- Quarterly review to keep standards current (e.g. new Unreal versions, WCAG updates).
- **Exit criteria:** v1.0 tagged; plugin installable from the marketplace; template repos published.

## 10. Milestones

| Milestone | Contents |
|---|---|
| M1 | Phase 0 + core working agreement, code-quality, testing |
| M2 | Remaining core rules + `unreal-plugin` and `typescript` packs |
| M3 | Remaining web packs + practice guides |
| M4 | Agents, skills, hooks |
| M5 | GitHub integration, CI workflows, template repos |
| M6 | Reference projects, evals, revisions, v1.0 |

Each milestone lands as one or more PRs so the work stays reviewable.

## 11. Remaining open questions

1. **Unreal engine versions.** Which versions should plugins target (e.g. the latest two 5.x releases)? This sets the CI matrix and API guidance.
2. **Unreal build machine.** Is a self-hosted runner with the engine available, or should Tier 2 checks run locally for now?
3. **Web framework preferences.** Confirm React/Next.js and Astro as the first framework packs, or name the ones you use.
4. **Backend and hosting.** Preferred database, runtime, and hosting (e.g. Postgres, Node, Vercel), so the `node-services` pack matches real use.
5. **Copyright holder** for the MIT licence (currently set to the `lifelike-and-believable` organization).

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rules become too long for agents to follow reliably | Word budget for always-on files; path-scoped loading; evals to prune |
| Rules conflict (e.g. performance vs. extensibility) | Priority order in the working agreement; `tech-lead` resolves; ADRs record trade-offs |
| Unreal checks can't run on hosted CI | Two-tier CI; local skill fallback for Tier 2 |
| Guidance goes stale (engine, framework, and standard updates) | Cite sources with dates; quarterly reviews; versioned releases |
| Overly prescriptive rules block reasonable choices | MUST reserved for genuine requirements; waiver format for exceptions |
| Hard to show value | Phase 7 evals with before/after comparisons |

## 13. Immediate next steps

1. Answer the remaining questions in section 11 (none block Phase 0).
2. Start M1: rule format spec, repo skeleton, `LICENSE`, plugin manifests, and `00-working-agreement.md`.
