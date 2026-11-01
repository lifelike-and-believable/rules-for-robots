# Third-party tools for the project process

Research date: 2026-11-01, for the Phase 11 amendment in [docs/specs/project-process.md](../../specs/project-process.md). Done by a research subagent from public sources; no tool was installed or trialled. Treat it as a map of candidates, not as measurements.

Known weaknesses, found on review before the amendment was written:
- Star counts were read from repository pages and some look implausible (for example `mattpocock/skills` at about 309k); none of the decisions depends on them.
- Prices and some dates come from secondary or vendor sources (for example Argos's own pricing comparison) and are marked so in the tables.
- The security incidents cited were checked against their primary sources on 2026-11-01 (see "Corrections" at the end). The Snyk figures in this report were wrong as stated; the Microsoft report was accurate.

Date: 2026-11-01. Scope: Claude Code skills, plugins, MCP servers, and developer tools that could strengthen the staged process in `docs/specs/project-process.md` (rfr-process). Versions marked "tag" are the latest git tag read with `git ls-remote` on 2026-11-01; star counts were read from the GitHub repository page on the same day. Anything taken only from a secondary source is labelled as such.

What rfr-process already has, and so is not re-recommended: artifact links and staleness (`process-trace`), approvals read from GitHub, CODEOWNERS block generation, issue sync, size tiers, merge guard, spec lock and trace (Phase 10), a Playwright-based tutorial runner with its own step grammar (`checks/tutorial-run.mjs`), and the `rfr-core` reviewers and skills. The PLAN already treats Epic's Unreal MCP as optional for 5.8+ projects and forbids sharing one editor between agents (R34).

## Executive summary: top recommendations, ranked

| # | What | Stage | Why | Effort | Risk | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Stryker** mutation testing (StrykerJS, tag v10.1.1, Apache-2.0), incremental mode on pull requests | 9 Unit tests, 10 Implementation | The process's weakest point is test strength: tests are written first and locked, so weak assertions get locked in too. Research on LLM-written tests reports suites with 100% coverage and 4% mutation score (MutGen, IEEE TSE 2026). A mutation score is an objective, CI-runnable version of the "sabotage step". | Medium (config per web profile; incremental cache) | Low; CI time on large suites | Adopt (web profiles) |
| 2 | **Playwright Test Agents** (planner, generator, healer; Playwright tag v1.64.1) plus Playwright CLI or MCP for interactive work | 11 Regression, 12 Tutorials | Official, Apache-2.0, ship as editable Claude Code subagents. Planner turns user docs into a markdown test plan; generator writes tests. Fits "acceptance tests drafted from stories and docs". | Low | Healer can "fix" a test by loosening an assertion; heavy token use reported | Adopt planner and generator; gate healer behind spec-lock and review |
| 3 | **Vale** prose linter (tag v3.26.0, 31 Oct; MIT) with a project style | 7 User docs, 12 Tutorials, 13 Release notes | User docs are the main alignment check, so they deserve a CI check like code does. Vale is deterministic, headless, fast, and can encode the repo's own writing rules (Canadian English, no emphatic capitals, plain sentences) plus per-project terminology. | Low | False positives need tuning | Adopt |
| 4 | **Epic's Unreal Engine skills plugin** + in-editor **Unreal MCP** (UE 5.8, experimental) | 6 Design (editor UI), 11, 12 (Unreal) | Official, MIT, in `claude-plugins-official` pinned to a SHA. Lets agents build and inspect UMG/Slate, run automation tests, drive Sequencer for demo capture. | Medium | Broad live editor access, arbitrary Python via `execute_tool_script`, no auth on localhost; 5.8+ only | Try (5.8 projects, interactive only, never in CI) |
| 5 | **Argos** visual regression (MIT; free tier 5,000 screenshots/month per vendor) or plain Playwright `toHaveScreenshot` in a pinned Docker image | 11 Regression, 7 docs screenshots | Catches UI drift that user docs and tutorials depend on. Lost Pixel was sunset in 2026; Chromatic and Percy cost more. | Low–medium | Vendor dependency (Argos); baseline churn | Try |
| 6 | **Figma remote MCP** (official; write-to-canvas free in beta) | 6 Design and UX (web) | Gives agents design context, variables and Code Connect mappings; can write specs and frames back to Figma. Strongest design-to-code bridge available. | Low (one command) | OAuth to a paid seat; write-to-canvas will become usage-billed; hosted service sees file content | Try (web profiles with Figma) |
| 7 | **Persona walkthrough design informed by evidence**, not a third-party tool | 6, 7, 12 | No tool is mature enough to adopt. Evidence: LLM walkthroughs complete more tasks, take more optimal paths, and find fewer failure points than humans; persona prompting mostly makes output more believable rather than more accurate; synthetic users collapse variance. Keep the walkthrough advisory and shape its prompt around failure-point prediction. | Low | Over-trust by approvers | Adopt the findings; skip commercial "synthetic user" products |
| 8 | **Agentic property-based testing** with fast-check (tag v4.10.2, MIT) for TS, following Anthropic's published Hypothesis agent | 9 Unit tests | Peer-reviewed workshop result: an agent on Claude Code proposing properties found real bugs in 100 Python packages; 86% of top-ranked reports valid. Properties derive naturally from spec criteria. | Medium | Flaky generators; agent invents unjustified properties | Try |
| 9 | **Starlight** (Astro docs framework, tag starlight@0.42.8, MIT) as the recommended renderer for `docs/user/` on web and static-site profiles | 7 User docs, 13 | Free, static, accessible, matches the Astro target stack; keeps docs-as-code in the repo. | Low | Still 0.x | Adopt as a recommendation in setup guide |
| 10 | **Demo capture**: VHS (tag v0.12.1, MIT) for CLI demos, Playwright video for web tutorials, Movie Render Queue command line for Unreal | 12 Demos | Turns the runnable tutorial into a recorded demo from the same script, so the demo cannot drift from the tutorial. | Medium | Unreal capture needs a GPU runner | Try |
| 11 | **`anthropics/claude-code-action`** (tag v1.0.266, MIT) in automation mode | 7, 12, 13 plumbing | Runs the persona walkthrough, release-notes draft, and feedback triage as CI jobs that comment on the pull request, so the approver sees findings before reviewing. | Low | API cost; prompt injection from issue text; needs tight `permissions` | Try |
| 12 | **Requirements-stage interview skill**: `mattpocock/skills` `grill-with-docs` / `domain-modeling` (MIT, in the official marketplace) | 1 Concept, 2 Requirements | Structured interrogation of the lead plus a maintained `GLOSSARY.md` addresses the early-stage gap that `plan-feature` does not cover. Better fit than Superpowers or BMAD, which bring their own competing artifact layouts. | Low | Writes ADRs/glossary in its own layout; review before adopting | Try (borrow ideas into an rfr-process skill) |

Not recommended to adopt wholesale: GitHub Spec Kit, BMAD-METHOD, OpenSpec, Kiro, Tessl, Superpowers. All are mature and popular, but each defines its own artifact layout and stage model that would compete with rfr-process. Borrow specific ideas instead (see section 4).

## 1. Requirements, personas, user stories, story mapping

| Candidate | What it does | Fit | Maturity | Cost / licence | CI | Verdict |
|---|---|---|---|---|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) (`grill-me`, `grill-with-docs`, `domain-modeling`, `to-spec`, `to-tickets`) | Interviews the user until a plan has no open branches; maintains `GLOSSARY.md` and ADRs; splits specs into tickets | Good for stages 1–2 and for a shared vocabulary that personas and docs can reuse. `to-spec`/`to-tickets` publish to the issue tracker directly, which conflicts with "issues written only by the sync workflow"; do not use those two. | ~309k stars; listed in `claude-plugins-official` pinned to a SHA | MIT, free | No (interactive) | Try; or copy the grilling pattern into an rfr-process `concept`/`requirements` skill |
| [obra/superpowers](https://github.com/obra/superpowers) `brainstorming` | Socratic design session, writes a design spec to `docs/superpowers/specs/` | Overlaps `plan-feature` and would write specs outside `docs/specs/`. Skills auto-trigger, so installing it beside rfr-process risks two competing workflows in one session. | ~310k stars, tag v7.0.1, in official marketplace | MIT | No | Skip installing; read for ideas |
| [Dovetail MCP](https://docs.dovetail.com/claude) (official, remote, OAuth) | Reads research projects, insights, verbatim quotes | Useful where a team already has real user research: personas and requirements can cite evidence. Not relevant to a solo developer without Dovetail. | Shipped June 2025; official | Paid Dovetail plan | No | Watch (teams later) |
| [Miro plugin](https://github.com/miroapp/miro-ai) (official marketplace) | Reads and writes Miro boards | Story mapping on a board, but the repo is the source of truth; a board would be a second copy. | Official, SHA-pinned | Miro plan | No | Skip unless the team already maps stories in Miro |
| AQUSA / Quality User Story framework ([Lucassen et al.](https://www.researchgate.net/publication/299576904_Improving_agile_requirements_the_Quality_User_Story_framework_and_tool)) | Rule-based NLP lint for 13 story quality criteria | Research tool, effectively unmaintained. The research is useful: a 2026 comparison found rule-based checks best for syntactic and format defects (deterministic), LLMs better for semantic ones but prone to critiquing for unrelated reasons; a hybrid pipeline (rules first, then LLM) worked best. | Academic | Open, old Python | Yes | Skip the tool; build a small deterministic story lint into `process-trace` (role is an approved persona, "so that" present, acceptance criteria present and testable-shaped), and leave INVEST judgment to `tech-lead`/`ux-reviewer` |
| Persona generators (LLM "synthetic persona" products) | Generate personas from prompts | Personas in rfr-process are approver-owned and should come from real knowledge of users. Research on synthetic personas reports poor ecological validity. | Varied | Paid | — | Skip |

## 2. Design and UX

| Candidate | What it does | Fit | Maturity | Cost / licence | CI | Verdict |
|---|---|---|---|---|---|---|
| [Figma MCP server](https://developers.figma.com/docs/figma-mcp-server/) (remote `https://mcp.figma.com/mcp`; plugin `figma@claude-plugins-official`) | Design context (variables, components, layout), code generation from frames, Code Connect, write-to-canvas (frames, components, variables), code-to-canvas, Figma Specs skill (open beta) | Strong for web stage 6: `docs/design/<feature>.md` can link the Figma frame, and agents implementing stage 10 read real tokens instead of guessing. Write-to-canvas lets an agent draft a design from approved stories for the approver to edit. | Official; write features in beta | Free in beta, will be usage-based; desktop server needs a Dev/Full seat on a paid plan | No (OAuth, interactive) | Try |
| [Storybook MCP](https://storybook.js.org/docs/ai/mcp/overview) (`@storybook/addon-mcp`, Storybook 10.x) | Development tools (`stories-preview`, `stories-find-by-component`), docs tools from a component manifest, `test-run` | Good for web-app design systems: agents check existing components before writing new ones, and preview stories for the approver. | Experimental ("in preview") | MIT, free; Chromatic can host the docs tools | Partly (`test-run` is Storybook Test, which runs in CI on its own) | Try where a project already uses Storybook |
| [DTCG Design Tokens 2025.10](https://www.designtokens.org/tr/2025.10/) + Style Dictionary v5 | Stable token format (first stable release 2025-10-28) and the reference build tool | Makes design tokens a reviewable artifact in `docs/design/` that compiles to CSS. Figma and Tokens Studio read the format. | Stable spec | Free, open | Yes | Try (web profiles with a design system) |
| [Penpot MCP](https://github.com/penpot/penpot) (integrated into the main repo in Feb 2026) | Open-source design tool with an MCP server | Open-source alternative to Figma, attractive for self-hosting, but the server is early. | Early / beta | MPL-2.0, free | No | Watch |
| [Excalidraw MCP](https://github.com/excalidraw) (Excalidraw org, MCP Apps) | Draw and edit diagrams in chat | Quick wireframes and flow diagrams for `docs/design/`. The official server renders inside Claude chat; check that it can save a `.excalidraw` file into the repo before relying on it. | ~4.5k stars (secondary) | MIT | No | Watch |
| Claude Design / Figma Make | Prompt-to-prototype tools with a handoff to Claude Code | Good for throwaway exploration before stage 6. The prototype is not the design artifact; the approved markdown is. Sources comparing them are mostly marketing. | 2026 products | Bundled in Claude plans (secondary) / Figma plans | No | Watch |
| `frontend-design`, `superdesign`, `playground` (official marketplace) | Generate polished UI or interactive HTML explorers | `playground` is useful for making a design decision tangible for the approver. `frontend-design` overlaps the web-engineer agent. | Official / partner | Free | No | Try `playground`; skip the others |
| Unreal Slate/UMG aids | Epic's Unreal MCP toolsets include widget (UMG) and Slate inspection tools via the skills plugin; no mature third-party UMG design tool found | Agents can build a draft editor panel for the approver to try in-editor; the design doc stays the artifact. | Experimental | Free | No | Try with recommendation 4 |

## 3. User documentation

| Candidate | What it does | Fit | Maturity | Cost / licence | CI | Verdict |
|---|---|---|---|---|---|---|
| [Vale](https://github.com/vale-cli/vale) + [vale-action](https://github.com/errata-ai/vale-action) (tag v3.0.0) | Rule-based prose lint with custom styles (Microsoft, Google, write-good, custom vocabularies) | High. Encode the repo's own writing rules and per-project term lists (persona names, product terms) and run on `docs/user/`, `docs/tutorials/`, release notes. Deterministic, so it can gate. | Very mature, active (v3.26.0 on 31 Oct) | MIT, free | Yes | Adopt |
| [Starlight](https://github.com/withastro/starlight) | Astro docs framework: search, i18n, accessible defaults | Publishes `docs/user/` as a site with no lock-in. Matches the Astro target. | ~9.5k stars, 0.42.x | MIT, free | Yes | Adopt as recommendation |
| Docusaurus | React docs framework, versioned docs | Good if a project needs versioned docs per release; heavier than Starlight. | Very mature | MIT | Yes | Alternative |
| [Mintlify](https://github.com/mintlify/mintlify-claude-plugin) (official marketplace plugin) | Hosted docs platform with AI features | Hosted, pricing changed several times in 2026 (Pro reported at $450/month annual in Aug 2026, secondary). Poor fit for a solo developer and for docs-as-source-of-truth. | Mature | Paid | Partly | Skip |
| [Doc Detective](https://github.com/doc-detective/doc-detective) (tag v4.41.5) | Parses docs for testable actions, runs them in a browser, can screenshot and record video | Overlaps `checks/tutorial-run.mjs` almost exactly. Its screenshot/record actions are worth borrowing as step types. | 137 stars, active tags | AGPL-3.0 (licence matters if vendored) | Yes | Watch; borrow ideas only |
| [Runme](https://github.com/stateful/runme) (tag v3.17.6) | Runs shell code blocks in markdown, in CI | Useful for Node/Postgres tutorials whose steps are shell commands (migrations, CLI), which the web runner does not cover. | Mature | Apache-2.0 | Yes | Try for shell-step tutorials |
| Playwright screenshots in pinned Docker image | Generate doc screenshots from the same script as the tutorial | Screenshots in `docs/user/` then fail visibly when the UI changes. Playwright docs say to generate baselines in the same environment that compares them. | Mature | Apache-2.0 | Yes | Adopt as a pattern |
| [KantanDocGen](https://forums.unrealengine.com/t/kantan-doc-gen-auto-generate-ue4-reference-documentation-for-blueprints-reflected-c/90146) | Blueprint/reflected C++ reference docs | UE4-era, no maintained UE5 fork found. | Unmaintained | Free | — | Skip; Blueprint reference stays hand-written or agent-written from headers, checked by `code-reviewer` |

## 4. Specifications, acceptance tests, spec-driven development

### Spec-driven tools compared with rfr-process

| Tool | Stages it models | Where it differs from rfr-process | Maturity | Verdict |
|---|---|---|---|---|
| [GitHub Spec Kit](https://github.com/github/spec-kit) | constitution → specify → clarify → plan → tasks → implement (+ extensions for bugs, idea assessment) | No personas, no user docs before the spec, no human gate tied to GitHub reviews, no hash-based staleness. Its specs live under `specs/`. | 144.7k stars; v1.2.5 (28 Oct); MIT; 30+ agents | Skip adopting; borrow the **clarify** step (agent lists ambiguities and asks before planning) for stage 8, and look at its extension catalogue model |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | Analyst/PM/UX/architect/dev/test personas; PRD → architecture → stories → dev loop; Test Architect add-on | Closest in spirit (product stages and a UX role), but stories come after architecture in v6, and it ships its own agent personas and file layout. Heavy. | 54.8k stars; v6.12.4; MIT; Claude Code plugin | Skip; read its Test Architect module for regression-test ideas |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | propose → apply → archive with spec deltas merged into living specs | Lightweight brownfield change model. rfr-process already handles change through staleness and withdrawal. | 73.6k stars; v1.16.0; MIT | Skip |
| Kiro | requirements (EARS) → design → tasks, steering, hooks | Separate IDE, credit-priced. EARS is the reusable idea: it gives `test:` criteria a testable shape. | AWS product, free tier + paid | Skip the tool; consider EARS phrasing for criteria |
| Tessl | Spec-as-source; now mainly a skills registry | Framework still in closed beta; registry repositioned as a skills package manager in Jan 2026. | Pre-GA | Skip |
| Superpowers | brainstorm → plan → TDD → subagent execution → review | Overlaps `plan-feature`/`review-pr`. | ~310k stars | Skip (see section 1) |

None of these has the two checkpoints that define rfr-process (user docs before the spec, runnable tutorials as acceptance), approval read from GitHub, or link staleness. That is the differentiator, and a reason to keep the design as is.

### BDD, executable specs, traceability

| Candidate | Fit | Verdict |
|---|---|---|
| [playwright-bdd](https://github.com/vitalets/playwright-bdd) (stable tag v9.3.x; v10 in pre-release; MIT) | Turns Gherkin into Playwright tests. rfr-process already has a markdown step grammar for tutorials and a `test:` criterion table with citations. Adding Gherkin gives a third format for the same information. | Skip unless a team already writes Gherkin |
| Cucumber.js (tag v13.3.0) | Same reasoning | Skip |
| StrictDoc, OpenFastTrace, sphinx-needs | Requirements traceability tools. `process-trace` plus Phase 10 `spec-trace` already do this in-repo and more specifically. | Skip |
| [TDD Guard](https://github.com/nizos/tdd-guard) / Probity (2.4k stars, MIT) | Hook that blocks implementation ahead of failing tests. Overlaps `spec-lock` and the delivery hooks; it judges with an LLM per edit, which is slower and less deterministic. | Skip |

## 5. Testing

| Candidate | What it does | Fit | Maturity | Cost / licence | CI | Verdict |
|---|---|---|---|---|---|---|
| [StrykerJS](https://github.com/stryker-mutator/stryker-js) (tag v10.1.1) with `@stryker-mutator/vitest-runner` | Mutation testing; `--incremental` only re-tests changed mutants | Measures whether locked tests can catch defects. Run incrementally on pull requests and fully nightly; report score in the PR. Note: incremental mode does not notice changes to tests, so run a full pass when tests change. | Very mature | Apache-2.0 | Yes | Adopt |
| [Mull](https://github.com/mull-project/mull) (0.34.0, May 2026, secondary) | LLVM mutation testing for C/C++ | Unreal builds use UBT with MSVC/Clang toolchains; wiring Mull in is non-trivial and only applies to engine-free modules. | Active but niche | Apache-2.0 | Yes | Watch |
| [fast-check](https://github.com/dubzzz/fast-check) (tag v4.10.2) + an agentic PBT skill modelled on [Anthropic's PBT agent](https://red.anthropic.com/2026/property-based-testing) | Agent proposes properties from the spec, writes and triages them | Properties map well to spec criteria ("for all valid inputs ..."). | fast-check very mature; agent pattern research-grade (NeurIPS 2025 DL4Code workshop, [arXiv 2510.09907](https://arxiv.org/abs/2510.09907)) | MIT | Yes | Try |
| [Playwright Test Agents](https://playwright.dev/docs/test-agents) (`npx playwright init-agents --loop=claude`) | planner/generator/healer subagents + MCP config | See summary #2. Point the planner at `docs/user/` and the tutorial, not at the live app alone, so tests come from the documented expectation. | Official since Playwright 1.56 | Apache-2.0 | Generated tests run headless; agents themselves are interactive | Adopt (planner, generator); healer only under review |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) vs Playwright CLI skill | Browser control for agents | Sources in 2026 recommend the CLI for agents with a shell (lower token use); newer MCP versions write snapshots to disk, narrowing the gap. Either is fine; prefer the CLI in Claude Code. | Official | Apache-2.0 | n/a | Adopt one, prefer CLI |
| [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) (official marketplace) | Live Chrome inspection, performance traces, console with source maps | Complements `perf-audit`; useful in debugging, not a stage gate. | Official Google | Apache-2.0 | No | Try |
| Visual regression: [Argos](https://argos-ci.com/blog/visual-testing-pricing), Chromatic (CLI tag v18.13.6), Percy, Playwright snapshots | Screenshot diff review | Argos: MIT, free tier, Playwright-native. Chromatic: best if Storybook-centric, from $179/month. Percy: most expensive. Lost Pixel: sunset in 2026. Pricing figures come from Argos's own blog; verify. Free option: `toHaveScreenshot` in a pinned Playwright Docker image. | Mature | See left | Yes | Try Argos or plain Playwright snapshots |
| Unreal Automation Test Framework + [Screenshot Comparison](https://dev.epicgames.com/documentation/unreal-engine/screenshot-comparison-tool-in-unreal-engine) + [Gauntlet](https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-overview-in-unreal-engine) | Functional tests, screenshot ground truth, multi-process session orchestration | Already the basis of Tier 2. Screenshot tests need a real GPU on the runner (inference; not confirmed in Epic docs). Gauntlet is worth it only for packaged-build or multi-process tests. | Official | Engine licence | Self-hosted GPU runner | Adopt screenshot functional tests for editor UI tutorials where a GPU runner exists |
| Unreal MCP servers: [Epic official](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor) (5.8, experimental), [chongdashu/unreal-mcp](https://github.com/chongdashu/unreal-mcp) (2.1k stars, "experimental, not for production"), ChiR24/Unreal_mcp, flopperam, UEMCP | Editor control | For 5.6/5.7 projects only the third-party servers apply; they run arbitrary editor actions through a native plugin or Python remote execution with no auth. Prefer Epic's server once on 5.8. | Mixed | MIT mostly | No | Try Epic's on 5.8; skip third-party servers for anything but experiments |

## 6. Runnable tutorials and demos

| Candidate | Fit | Verdict |
|---|---|---|
| Existing `tutorial-run` + Playwright `video: 'on'` and `screenshot` per step | The cheapest way to get a demo: record the tutorial run itself. Publish the video as a CI artifact for the approver at stage 12. | Adopt (small change to the runner) |
| [VHS](https://github.com/charmbracelet/vhs) + `vhs-action` | `.tape` scripts produce GIF/MP4 and `.ascii` golden files for CLI tools. Fits Node CLIs and setup steps. | Try |
| [Doc Detective](https://github.com/doc-detective/doc-detective) `record` action | Same idea, but a second runner; AGPL. | Watch |
| Runme | Shell-step tutorials | Try (section 3) |
| Unreal: [Movie Render Queue command line](https://dev.epicgames.com/documentation/unreal-engine/using-command-line-rendering-with-move-render-queue-in-unreal-engine) (`-LevelSequence` + `-MoviePipelineConfig`, or a Python executor) | Renders a Sequencer demo headless on a GPU runner. Forum reports note the process can exit before rendering completes, so the CI wrapper must wait. Editor-workflow walkthroughs (clicking through panels) still need screen capture, for example an automation test that takes screenshots at each tutorial step. | Try |
| Unreal MCP + Sequencer tools | An agent can assemble a demo sequence for the approver to refine. | Try (interactive) |

## 7. Persona walkthroughs and synthetic user testing

Evidence (primary sources):

- **Synthetic Cognitive Walkthrough** ([arXiv 2512.03568](https://arxiv.org/abs/2512.03568)): GPT-4 and Gemini 2.5 Pro completed more tasks than humans, took more optimal paths, and identified fewer potential failure points. With additional prompting they could predict the failure points humans found. Conclusion: a complement, not a replacement.
- **What Would GPT Click** ([arXiv 2605.18302](https://arxiv.org/abs/2605.18302)): over 3,431 first-click responses in twelve tasks, synthetic click distributions differed significantly from real users in 53% of tasks. Personas, chain of thought, and sampling changes mostly made outputs more believable, not more accurate.
- **Synthetic heuristic evaluation** ([arXiv 2507.02306](https://arxiv.org/pdf/2507.02306)): an LLM heuristic evaluation found 73% and 77% of known usability issues in two apps, more than five aggregated expert evaluators. Heuristic review works better than behavioural simulation.
- **UXAgent** ([arXiv 2504.09407](https://arxiv.org/abs/2504.09407)): persona generator plus browser agent; five UX researchers found the data useful for iterating study design but not realistic as human behaviour.
- Reviews of synthetic participants report variance collapse (personas converge on one view) and over-generation of issues (secondary summaries: [AIES paper](https://arxiv.org/html/2512.00461v1), [ACM critical analysis](https://dl.acm.org/doi/10.1145/3745900.3746108)).

Implications for rfr-process's experimental persona walkthrough:

1. Frame it as a heuristic and cognitive-walkthrough review per persona ("where would this persona fail, and why"), not as a simulation of what the persona would do. That is where LLMs did best.
2. Ask explicitly for failure points at each step, since unprompted models under-report them.
3. Ground the persona in the approved persona file, and do not expect persona prompting to add accuracy.
4. Expect over-generation: rank findings and cap the list, and let the approver dismiss items.
5. For web tutorials, an agent can follow the tutorial in a real browser (Playwright) and report where the documented step did not match what it saw. That is a factual check and more reliable than simulated confusion.
6. Keep it advisory, as the spec already says, and measure it in the Phase 8 eval: seed known doc-versus-UI mismatches and count recall.

Commercial synthetic-user products (Synthetic Users, and similar): skip. Validation claims are mostly proprietary.

## 8. Process plumbing

| Candidate | Fit | Verdict |
|---|---|---|
| GitHub sub-issues and issue types (native; sub-issues GA April 2025 per secondary source) | `process-sync` should use native sub-issues (epic → story) rather than task lists, if it does not already. Issue types/fields still need a `GraphQL-Features` header (secondary), so avoid depending on them. | Adopt sub-issues |
| [actions/add-to-project](https://github.com/actions/add-to-project) (tag v2.0.0) + Projects built-in workflows | Adds synced issues to a Project board; the `stage:` label can drive the column through a built-in workflow or one GraphQL call. Projects v2 automation may need a PAT or GitHub App token with project scope. | Try |
| [mszostok/codeowners-validator](https://github.com/mszostok/codeowners-validator) (latest tag v0.7.5-rc1) | Validates CODEOWNERS syntax and that owners exist. `process-codeowners` already checks drift; the owner-existence check is the extra value. Low activity. | Watch |
| [release-please-action](https://github.com/googleapis/release-please-action) (v5, Apache-2.0) / [changesets](https://github.com/changesets/changesets) / [git-cliff](https://github.com/orhun/git-cliff) (tag v2.14.2) | Version and changelog automation. rfr-process deliberately drafts release notes from user docs and stories, and `rfr-core:release` does versioning. release-please would compete with both; git-cliff could supply the technical changelog section only. | Skip release-please and changesets; watch git-cliff |
| [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | Automation mode with a fixed prompt: run the persona walkthrough on pull requests touching `docs/user/` or `docs/tutorials/`, draft release notes, triage `feedback` issues. Set `permissions` minimally, never let issue text from untrusted users trigger write-capable runs, and pin the action by SHA. | Try |
| [Linear plugin](https://github.com/anthropics/claude-plugins-official) / Jira (Atlassian plugin) | Only if a team tracks work outside GitHub. rfr-process reads approvals from GitHub, so a second tracker adds a sync problem. | Skip (revisit for teams) |
| Mergify (official marketplace plugin) / GitHub merge queue | Addresses the spec's "concurrent pull requests" staleness risk. GitHub's native merge queue is enough on paid plans. | Use native merge queue where available |

## 9. Claude Code ecosystem

| Candidate | Notes | Verdict |
|---|---|---|
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 45.7k stars. Internal plugins plus partner/community ones, with third-party entries pinned to a commit SHA in the marketplace manifest. The README says Anthropic cannot verify plugins will work as intended or won't change. Relevant entries: `playwright`, `figma`, `unreal-engine-skills-for-claude-code`, `chrome-devtools-mcp`, `mattpocock-skills`, `superpowers`, `skill-creator`, `plugin-dev`, `hookify`, `claude-code-setup`, `security-guidance`, `pr-review-toolkit`, `code-review`, `feature-dev`, `context7`, `github`, `linear`, `playground`. | The default place to recommend plugins from |
| [anthropics/skills](https://github.com/anthropics/skills) | 186k stars. Document skills (source-available) and example skills (Apache-2.0), including `webapp-testing` and `mcp-builder`. | Use `skill-creator` when building the stage skills; others optional |
| `skill-creator` / `plugin-dev` (official) | Help author and evaluate the planned rfr-process stage skills, with variance analysis. | Try (for this repo's own development) |
| `pr-review-toolkit`, `code-review`, `feature-dev` (official) | Overlap `rfr-core` reviewers and `plan-feature`. Not clearly better; worth a head-to-head in the Phase 8 eval rather than adoption. | Skip pending eval |
| `security-guidance` (official) | Edit-time warnings and a Stop-hook diff review. Overlaps `security-reviewer`; it is hook-driven, so it runs without being asked. | Watch; consider in an eval |
| `context7` (official, remote) | Version-specific library docs for Next.js 16, Astro, UE APIs. Reduces outdated-API errors at stage 10. Anonymous use works; hosted service sees queries. | Try |
| Community collections: wshobson/agents, hesreallyhim/awesome-claude-code, ComposioHQ/awesome-claude-plugins | Large, uneven quality, unpinned. | Skip as dependencies; browse for ideas |

### Security considerations

- **Supply chain is a real, current risk.** Snyk's ToxicSkills study (Feb 2026) reported prompt injection in 36% of agent skills it examined and 1,467 malicious payloads; a January 2026 measurement found likely malicious patterns in 5.2% of 31,132 published skills. PromptArmor showed a plugin hook bypassing human-in-the-loop prompts; Prompt Security showed a marketplace skill steering the agent to install a trojanized package. On 30 Oct 2026 Microsoft reported trojanized Claude Code extension builds (2.1.312, 2.1.313) in Cursor's marketplace with an SSH backdoor; Anthropic's own listing and npm package were not affected.
- **Rules for the setup guide:** install from `claude-plugins-official` or the publisher's own repository; pin marketplaces and plugins to commit SHAs; read hooks and `.mcp.json` before installing; prefer official remote MCP servers with OAuth over community local servers; never run `--dangerously-skip-permissions` with editor-control servers.
- **Unreal MCP:** no authentication; loopback only by default, but any same-user process can connect; `execute_tool_script` runs Python with full editor access. Commit before long sessions. One agent per editor (already PLAN R34).
- **Figma, Dovetail, Context7 (remote):** data leaves the machine to the vendor; check confidentiality before connecting client projects.
- **claude-code-action:** treat issue and comment text as untrusted input; restrict who can trigger runs; least-privilege `permissions`.

## Integration ideas for rfr-process

1. **`process / docs-lint` CI job** in `templates/workflows/rfr-process.yml`: Vale on `docs/user/`, `docs/tutorials/`, and release notes, with a shipped `rfr` Vale style generated from the repo's writing rules and a per-project vocabulary file seeded from persona and glossary terms. Deterministic, so it can be required.
2. **`process / mutation` CI job** for the `web-app` and `static-site` profiles: Stryker incremental on pull requests labelled `tier:story` or `tier:epic`, full run nightly, score posted in the pull request summary. Start as advisory with a recorded baseline; consider a "no score drop on changed files" rule after an eval.
3. **Tutorial runner extensions**: add `screenshot` and video recording to `checks/lib/tutorial.mjs` so a passing tutorial run produces the stage 12 demo and the screenshots used in `docs/user/` (generated in the pinned Playwright Docker image). Optional Argos upload for review.
4. **Acceptance-test drafting skill** (stage 11): wraps Playwright's planner and generator agents, points them at the approved user docs and tutorial, and makes generated tests cite the story or doc section (`<spec>#AC-n` or the doc id). The healer is allowed only on tests not under `spec-lock`, and its diffs go to `code-reviewer`.
5. **Persona walkthrough skill** (experimental): implement as a per-persona cognitive walkthrough with explicit failure-point prompts, findings ranked and capped, and an optional browser pass for web tutorials. Run it from `claude-code-action` on pull requests touching `docs/user/` or `docs/tutorials/`, posting a comment for the approver. Add a seeded-mismatch eval case to Phase 8.
6. **Property-test skill** (stage 9): reads a spec's `test:` criteria and proposes fast-check properties for those that are universally quantified, citing the criterion.
7. **Setup guide "recommended tools" section per profile**: web (Playwright CLI, Figma MCP if the project uses Figma, Storybook MCP if it uses Storybook, Context7, Starlight), static-site (Starlight, Playwright), unreal-plugin (Epic's skills plugin for 5.8+, screenshot functional tests on a GPU runner, MRQ command line for demos). Each entry pinned to a SHA from `claude-plugins-official`, with its security notes.
8. **Concept and requirements skill** borrowing the grilling pattern (one question at a time until no branch is open) and a maintained glossary that Vale's vocabulary and persona files reuse. Borrow Spec Kit's `clarify` step into stage 8, and consider EARS phrasing for `test:` criteria.
9. **Story lint** in `process-trace`: deterministic structure checks (persona role, benefit, acceptance criteria present, criteria phrased as observable outcomes). INVEST judgment stays with reviewer agents.
10. **process-sync**: use native sub-issues for epic → story, and `add-to-project` plus the `stage:` label to place items on a Project board.

## Sources

Spec-driven and workflow tools
- GitHub Spec Kit: https://github.com/github/spec-kit ; releases: https://github.com/github/spec-kit/releases
- BMAD-METHOD: https://github.com/bmad-code-org/BMAD-METHOD
- OpenSpec: https://github.com/Fission-AI/OpenSpec
- Superpowers: https://github.com/obra/superpowers
- Matt Pocock skills: https://github.com/mattpocock/skills
- Tessl SDD tile and repositioning (secondary): https://tessl.io/registry/tessl-labs/spec-driven-development ; https://codemyspec.com/blog/tessl-review
- Kiro (secondary): https://lushbinary.com/blog/kiro-ide-developer-guide-specs-hooks-agents-pricing/
- TDD Guard: https://github.com/nizos/tdd-guard

Claude Code ecosystem and security
- Official plugin marketplace: https://github.com/anthropics/claude-plugins-official
- Anthropic skills: https://github.com/anthropics/skills
- Claude Code Action: https://github.com/anthropics/claude-code-action
- Snyk ToxicSkills: https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/
- PromptArmor, plugin hook hijack: https://promptarmor.substack.com/p/hijacking-claude-code-via-injected
- Prompt Security, dependency hijack: https://prompt.security/blog/when-your-plugin-starts-picking-your-dependencies-marketplace-skills-and-dependency-hijack-in-claude-code
- Microsoft, trojanized extension (30 Oct 2026): https://www.microsoft.com/en-us/security/blog/2026/10/30/inside-malicious-claude-code-branded-cursor-extension-persistent-ssh-backdoor/
- Curated lists: https://github.com/hesreallyhim/awesome-claude-code ; https://vibeindex.ai/marketplaces/wshobson/agents

Design and UX
- Figma MCP server: https://developers.figma.com/docs/figma-mcp-server/ ; write to canvas: https://developers.figma.com/docs/figma-mcp-server/write-to-canvas
- Storybook MCP: https://storybook.js.org/docs/ai/mcp/overview
- Design Tokens 2025.10: https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ ; https://www.designtokens.org/tr/2025.10/
- Penpot MCP (secondary): https://github.com/montevive/penpot-mcp ; https://tympanus.net/codrops/?p=104662
- Excalidraw MCP (secondary): https://www.sourcepulse.org/projects/24078214
- Claude Design vs Figma Make (secondary): https://www.magicpatterns.com/blog/claude-design-vs-figma-make
- Dovetail MCP: https://docs.dovetail.com/claude

Documentation
- Vale: https://github.com/vale-cli/vale/releases ; vale-action: https://github.com/errata-ai/vale-action
- Starlight: https://github.com/withastro/starlight
- Doc Detective: https://github.com/doc-detective/doc-detective
- Runme in CI (2023): https://dev.to/sourishkrout/integration-testing-docs-in-github-actions-4h1d
- Mintlify pricing snapshots (secondary): https://www.usagepricing.com/blueprint/activity/mintlify-2026-08-11-pro-tier-confirmed
- KantanDocGen: https://forums.unrealengine.com/t/kantan-doc-gen-auto-generate-ue4-reference-documentation-for-blueprints-reflected-c/90146

Testing
- Playwright Test Agents: https://playwright.dev/docs/test-agents
- Playwright snapshots: https://playwright.dev/docs/test-snapshots
- Playwright CLI vs MCP (secondary): https://betterstack.com/community/guides/ai/playwright-cli-vs-mcp-browser/ ; https://dev.to/aswani25/playwright-cli-vs-playwright-mcp-which-should-you-use-with-claude-code-1olh
- Playwright agents token cost (secondary): https://shipyard.build/blog/playwright-agents-claude-code/
- Stryker incremental: https://stryker-mutator.io/docs/stryker-js/incremental/
- MutGen (LLM tests, coverage vs mutation): https://arxiv.org/abs/2506.02954
- Agentic property-based testing: https://arxiv.org/abs/2510.09907 ; https://red.anthropic.com/2026/property-based-testing
- fast-check: https://github.com/dubzzz/fast-check
- Visual testing pricing (vendor, Argos): https://argos-ci.com/blog/visual-testing-pricing ; Lost Pixel sunset: https://argos-ci.com/blog/lost-pixel-alternatives
- playwright-bdd: https://github.com/vitalets/playwright-bdd
- Mull: https://github.com/mull-project/mull
- StrictDoc: https://strictdoc.readthedocs.io/en/stable/

Unreal Engine
- Unreal MCP in Unreal Editor: https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?lang=en-US
- Epic skills plugin: https://github.com/EpicGames/unreal-engine-skills-for-claude-code-plugin
- chongdashu/unreal-mcp: https://github.com/chongdashu/unreal-mcp
- Screenshot comparison: https://dev.epicgames.com/documentation/unreal-engine/screenshot-comparison-tool-in-unreal-engine
- Gauntlet: https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-overview-in-unreal-engine
- MRQ command line: https://dev.epicgames.com/documentation/unreal-engine/using-command-line-rendering-with-move-render-queue-in-unreal-engine
- Unreal tests on GitHub Actions (forum): https://forums.unrealengine.com/t/unreal-tests-on-github-actions-with-test-reporter/2763115

Personas and synthetic users
- Synthetic Cognitive Walkthrough: https://arxiv.org/abs/2512.03568
- What Would GPT Click: https://arxiv.org/abs/2605.18302
- Synthetic Heuristic Evaluation: https://arxiv.org/pdf/2507.02306
- UXAgent: https://arxiv.org/abs/2504.09407
- Whose Personae? (AIES): https://arxiv.org/html/2512.00461v1
- LLMs in HCI, synthetic users critique: https://dl.acm.org/doi/10.1145/3745900.3746108
- User story quality, LLM vs rule-based: https://link.springer.com/chapter/10.1007/978-3-032-22375-3_10 ; QUS/AQUSA: https://www.researchgate.net/publication/299576904_Improving_agile_requirements_the_Quality_User_Story_framework_and_tool

Process plumbing
- release-please-action: https://github.com/googleapis/release-please-action
- changesets: https://github.com/changesets/changesets
- git-cliff: https://github.com/orhun/git-cliff
- add-to-project: https://github.com/actions/add-to-project
- codeowners-validator: https://github.com/mszostok/codeowners-validator
- Projects API (GitHub docs): https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- VHS: https://github.com/charmbracelet/vhs

## Corrections (2026-11-01)

Checked against the primary pages after the report was written. The report text above is kept as written.

- **Snyk ToxicSkills** (published 2026-02-05): 36.82% (1,467) of the skills examined had at least one security flaw of any kind. That is not the prompt-injection rate: prompt injection was found in 2.6% of ClawHub skills overall, and in 91% of the confirmed malicious ones. Confirmed malicious payloads numbered 76, not 1,467.
- **Microsoft, 30 October 2026**: accurate. Cursor reported a tampered copy of the Claude Code extension (`anthropic.claude-code` 2.1.312 and 2.1.313) in its marketplace for a few hours; it tried to add an attacker's SSH key and open a reverse tunnel. Microsoft confirmed that the Visual Studio Marketplace listing and the npm package `@anthropic-ai/claude-code` were not affected.
- **Epic's Unreal MCP**: the documentation (a UE 5.8 page) marks it experimental, says it has no authentication, and binds to loopback by default (the bind address is configurable). It does not describe a built-in tool that runs arbitrary Python; it says Python toolsets in any installed plugin's `Content/Python/` folder are discovered at startup and exposed to the agent. The report's `execute_tool_script` claim is unconfirmed.
- **claude-plugins-official**: confirmed that git-sourced third-party entries carry a `sha`, and that the README says Anthropic "does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change". Plugins vendored in the repository (for example `playwright` and `context7`) have no `sha`, because their code is in the repository itself.
- **Claude Code plugin docs**: marketplace sources of type `github`, `url`, and `git-subdir` take `ref` and `sha`, and `sha` wins when both are set.
