# Project Plan: rules-for-robots

Status: Draft v0.1 (2026-10-05)

## 1. Goal

Produce a reusable set of **rules**, **best practices**, and **agent definitions** that steer AI coding agents (and the humans working with them) toward software, websites, and web apps that are:

| Quality attribute | What it means here | How we will know |
|---|---|---|
| High-quality | Correct, tested, reviewed, consistent | Test coverage on critical paths, zero lint/type errors, review checklist passes |
| User-centred | Solves a real user need; accessible; clear UX and content | WCAG 2.2 AA conformance, documented user stories and acceptance criteria |
| Performant | Fast to load and respond, efficient on server and client | Core Web Vitals budgets (LCP, INP, CLS), bundle size budgets, API latency targets |
| Scalable | Handles growth in users, data, and team size | Stateless services, load test baselines, documented scaling limits |
| Extensible | New features fit without rewrites | Clear module boundaries, stable interfaces, ADRs for key decisions |
| Maintainable | Easy for a new contributor (human or agent) to change safely | Docs, conventions, small modules, automated checks, low change failure rate |

Security, privacy, and observability are treated as cross-cutting requirements underpinning all six attributes.

## 2. Scope

### In scope
- Stack-agnostic core rules and best practices for software and web projects.
- Agent definitions (sub-agents with roles, tools, and instructions) for the main stages of delivery.
- Reusable workflows/skills (e.g. "plan a feature", "review a PR", "accessibility audit").
- GitHub integration: issue and PR templates, CI checks that enforce the rules, CODEOWNERS guidance.
- A validation approach to show the rules actually improve agent output.

### Out of scope (initially)
- Mobile-native (iOS/Android) and desktop-native specifics.
- Full stack-specific guides for every framework. We start with one reference "stack pack" and design for more.
- Hosting/vendor-specific operations runbooks.

## 3. Guiding principles for the rules themselves

1. **Actionable and verifiable.** Every rule states what to do and how compliance is checked (automated check, review checklist, or test). Vague guidance goes in best-practice docs, not rules.
2. **Explained.** Each rule carries a one-line rationale so agents can apply judgement in edge cases.
3. **Graded.** Use RFC 2119 levels (MUST / SHOULD / MAY) so agents know what is negotiable.
4. **Context-budget aware.** Always-loaded instructions stay short. Detail lives in documents loaded on demand (progressive disclosure), so agents are not flooded with irrelevant text.
5. **Enforced by tooling where possible.** If a linter, type checker, test, or CI job can enforce a rule, that is preferred over prose.
6. **Stable IDs.** Rules have IDs (e.g. `A11Y-003`) so reviews, PR comments, and agents can cite them precisely.
7. **Tool-portable.** Content is plain Markdown with light frontmatter so it works with Claude Code and can be adapted to other agents (AGENTS.md, Copilot, Cursor).

## 4. Proposed repository structure

```
rules-for-robots/
├── README.md                     # What this is, how to adopt it
├── AGENTS.md                     # Tool-agnostic entry point for any agent
├── CLAUDE.md                     # Claude Code entry point (imports core rules)
├── rules/                        # Short, enforceable, ID'd rules
│   ├── 00-core.md                # Always-on: workflow, communication, safety
│   ├── architecture.md
│   ├── code-quality.md
│   ├── testing.md
│   ├── accessibility.md
│   ├── ux-content.md
│   ├── performance.md
│   ├── security-privacy.md
│   ├── api-design.md
│   ├── data-and-persistence.md
│   ├── observability.md
│   ├── documentation.md
│   └── git-and-github.md
├── practices/                    # Longer best-practice guides with examples
│   ├── user-research-and-requirements.md
│   ├── design-systems.md
│   ├── frontend-architecture.md
│   ├── backend-architecture.md
│   ├── scalability-patterns.md
│   ├── extensibility-patterns.md
│   ├── testing-strategy.md
│   ├── performance-budgets.md
│   ├── threat-modelling.md
│   └── refactoring-and-tech-debt.md
├── .claude/
│   ├── agents/                   # Sub-agent definitions
│   └── skills/                   # Reusable workflows
├── templates/                    # ADR, feature spec, PR, issue, runbook
├── stack-packs/                  # Optional stack-specific overlays
│   └── typescript-web/           # First reference pack
├── checks/                       # CI configs, lint presets, scripts
├── evals/                        # Tasks and rubrics for validating the rules
└── docs/
    ├── adoption-guide.md
    └── contributing.md
```

## 5. Agent roster (draft)

Each agent gets a focused remit, a minimal tool set, the rules files it must load, and a defined output format (e.g. a findings list with rule IDs and severity).

| Agent | Role | Typical trigger | Output |
|---|---|---|---|
| `product-analyst` | Turns a request into user stories, acceptance criteria, and non-functional requirements | New feature or vague request | Feature spec from template |
| `ux-designer` | Flows, information architecture, content, interaction states (empty, loading, error) | After spec, before build | UX notes and component inventory |
| `architect` | System and module design, interfaces, data model, trade-offs | Non-trivial change or new system | Design doc and ADRs |
| `frontend-engineer` | Implements UI per design system, accessibility, and performance rules | Build phase | Code and tests |
| `backend-engineer` | Implements APIs, data access, jobs, per API and security rules | Build phase | Code and tests |
| `test-engineer` | Designs test strategy, writes missing tests, checks coverage of acceptance criteria | During and after build | Tests and gap report |
| `accessibility-reviewer` | Audits against WCAG 2.2 AA using automated and manual heuristics | Pre-merge for UI changes | Findings with rule IDs |
| `performance-reviewer` | Checks budgets, rendering strategy, queries, caching | Pre-merge, pre-release | Findings and measurements |
| `security-reviewer` | Threat model review, OWASP Top 10, secrets, dependencies, privacy | Pre-merge for sensitive areas | Findings with severity |
| `code-reviewer` | General correctness, readability, maintainability, rule compliance | Every PR | Review comments |
| `docs-writer` | README, API docs, changelogs, runbooks, ADR upkeep | After merge-ready | Docs updates |
| `release-engineer` | CI/CD, versioning, feature flags, rollout and rollback plans | Release | Release checklist |
| `tech-lead` (orchestrator) | Breaks work down, sequences agents, resolves conflicts between findings | Any multi-step task | Plan and hand-offs |

Open design question: whether reviewers should be separate agents (sharper focus, more parallelism) or folded into `code-reviewer` with checklists (lower overhead). Plan is to start separate and merge if evals show no benefit.

## 6. Delivery phases

### Phase 0: Decisions and foundations (short)
- Resolve the open questions in section 8.
- Agree the rule file format: frontmatter fields (`id`, `title`, `level`, `scope`, `verified-by`, `rationale`), naming, and ID scheme.
- Write `docs/contributing.md` describing how to add or change a rule.
- **Exit criteria:** format spec and one fully worked example rule file approved.

### Phase 1: Core rules
- Draft `rules/00-core.md` (agent working agreement: understand before changing, small steps, run checks, never weaken tests, ask when blocked, report honestly).
- Draft the topic rule files in section 4, prioritising: code-quality, testing, accessibility, security-privacy, performance, architecture.
- Sources to draw on: WCAG 2.2, OWASP ASVS and Top 10, web.dev Core Web Vitals guidance, Twelve-Factor App, Google SRE practices, established API design guides.
- **Exit criteria:** each file has IDs, levels, rationale, and a verification method; core file fits a tight token budget (target under ~1,500 words).

### Phase 2: Best-practice guides
- Write the longer `practices/` guides, each linking to the rule IDs it supports.
- Include short good/bad examples rather than long prose.
- **Exit criteria:** every rule file references at least one practice guide, and every guide is referenced by at least one rule.

### Phase 3: Agent definitions
- Write each agent in `.claude/agents/` with: description (when to use), tools, rules to load, step-by-step method, output format, and hand-off criteria.
- Define the hand-off contract between agents (what artefact each produces and consumes).
- **Exit criteria:** each agent tested on at least two sample tasks with output that matches its declared format.

### Phase 4: Workflows, templates, and GitHub integration
- Skills: `plan-feature`, `implement-feature`, `review-pr`, `a11y-audit`, `perf-audit`, `security-review`, `write-adr`, `release`.
- Templates: feature spec, ADR, PR template (with rule-ID checklist), issue forms, runbook.
- `checks/`: CI workflow examples (lint, type check, tests, axe, Lighthouse CI budgets, dependency and secret scanning), plus lint presets.
- **Exit criteria:** a fresh repo can adopt the templates and checks by following the adoption guide in under an hour.

### Phase 5: Reference stack pack
- Build `stack-packs/typescript-web/` (overlay rules and checks for a TypeScript web stack; framework to be confirmed).
- Build a small reference app using the full set of agents and rules as a worked example.
- **Exit criteria:** the reference app passes all its own checks and meets the declared budgets.

### Phase 6: Validation and evals
- Create `evals/` with representative tasks (e.g. "add a search page", "add a paginated API endpoint", "fix a reported accessibility bug").
- Run each task with and without the rule set; score against rubrics tied to the quality attributes (axe violations, Lighthouse scores, test presence, review findings, rule citations).
- Trim or rewrite rules that do not change behaviour, and fix rules agents misapply.
- **Exit criteria:** measurable improvement on the rubric for most tasks; no rule that consistently causes worse output.

### Phase 7: Packaging and maintenance
- Distribution options: GitHub template repo, Claude Code plugin, or copy-in instructions.
- Versioning (semver for the rule set) and a changelog.
- Review cadence for keeping standards current (e.g. quarterly).
- **Exit criteria:** v1.0 tagged with adoption guide and changelog.

## 7. Suggested milestones

| Milestone | Contents |
|---|---|
| M1 | Phase 0 + core rules (`00-core`, code-quality, testing) |
| M2 | Remaining rule files + practice guides |
| M3 | Agent definitions + skills |
| M4 | Templates, CI checks, GitHub integration |
| M5 | Reference stack pack and app |
| M6 | Evals, revisions, v1.0 release |

Each milestone lands as one or more PRs so the work stays reviewable.

## 8. Open questions

1. **Target agents/tools.** Claude Code only, or also AGENTS.md-compatible tools (Codex, Copilot, Cursor)? This affects file layout and frontmatter.
2. **Stack opinion.** Stay fully stack-agnostic in the core, with optional stack packs? If so, which stack first (e.g. TypeScript with React/Next.js, or something else)?
3. **Audience.** Solo developers, teams, or organisations with existing standards to merge with?
4. **Strictness.** Should MUST-level rules be enforced by CI in adopting repos by default, or offered as opt-in?
5. **Distribution.** Template repo, plugin, or both?
6. **Licence.** Which open-source licence, if any?
7. **Spelling convention.** British ("user-centred") or American English throughout?

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rules become too long for agents to follow reliably | Token budget for always-on files; progressive disclosure; evals to prune |
| Rules conflict (e.g. performance vs. extensibility) | Explicit priority order in `00-core.md`; `tech-lead` agent resolves; ADRs record trade-offs |
| Guidance goes stale | Cite sources with dates; scheduled reviews; versioned releases |
| Overly prescriptive rules block reasonable choices | MUST reserved for genuine requirements; SHOULD with documented exceptions |
| Hard to prove value | Phase 6 evals with before/after comparisons |

## 10. Immediate next steps

1. Answer the open questions in section 8.
2. Approve the rule file format and agent roster.
3. Start M1: write the format spec, `rules/00-core.md`, and one complete topic file as the pattern for the rest.
