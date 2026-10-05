# Agent-runnable verification loops for web apps (TS, React/Next.js, Astro, Node, Postgres, Vercel)

Research date: 2026-10-05. Method note: nextjs.org, vercel.com and bug0.com were blocked by the sandbox egress proxy, so official Next.js/Vercel facts below come from search-result extracts of those official pages (URLs cited) and corroborating practitioner write-ups, not full-page reads. Evidence levels: **[official]**, **[research]** (study/dataset), **[widely reported]** (multiple independent practitioner sources), **[single source]**.

Current versions (as of Oct 2026): Next.js 16.x, latest minor 16.3 (16.2 added bundled docs + next-browser; 16.3 added agent skills, `/_next/mcp`, instant navigations) — [Next.js 16.3 blog](https://nextjs.org/blog/next-16-3), [Next.js 16.3 AI improvements](https://nextjs.org/blog/next-16-3-ai-improvements) [official]. Astro 6.x (6.0 released 2026-03-10; 6.4 on 2026-05-28; Astro 7 in alpha mid-2026) — [Astro 6.0 blog](https://astro.build/blog/astro-6/) [official; 6.4/7 dates from search summary, single source]. Playwright ≥1.56 ships Test Agents — [Playwright Agents guide](https://testdino.com/blog/playwright-test-agents) [widely reported].

## Browser-driven verification by agents (Playwright MCP, Chrome DevTools MCP, Claude in Chrome, screenshots)

### Takeaway
Agents should verify UI by driving a real browser, but tool choice is a token-budget decision: accessibility-tree snapshots (Playwright MCP) are cheaper and more reliable than screenshots for interaction, CLI/file-based variants are ~4x cheaper again, Chrome DevTools MCP is best for console/network/performance evidence, and Claude in Chrome is for interactive local/authenticated checks only (not CI).

### Cited Findings
- Playwright MCP returns structured accessibility snapshots with stable element refs (e.g. `e5`) rather than pixels; agents act by ref; roughly a quarter of the tokens of a screenshot approach — [Codex CLI + Playwright MCP write-up, 2026-08-14](https://codex.danielvaughan.com/2026/08/14/codex-cli-playwright-mcp-browser-automation-accessibility-snapshots-testing/); [Playwright MCP docs](https://playwright.dev/mcp/introduction) [official for snapshot model; ratio single source]
- Token cost benchmark: ~114K tokens per typical task via Playwright MCP vs ~27K via the Playwright CLI (`@playwright/cli`), attributed to the Playwright team — [scrolltest/Medium](https://scrolltest.medium.com/playwright-mcp-burns-114k-tokens-per-test-the-new-cli-uses-27k-heres-when-to-use-each-65dabeaac7a0); [bug0 CLI vs MCP 2026](https://bug0.com/blog/playwright-cli-vs-playwright-mcp-ai-browser-testing-2026); [bswen, 2026-03-18](https://docs.bswen.com/blog/2026-03-18-playwright-mcp-vs-cli-token-efficiency/) [widely reported]
- Cause: MCP streams full accessibility trees after every navigation; by step ~12 the context can carry 90K+ tokens of stale snapshots. Simple pages: 2–5K tokens/snapshot; complex SPAs: >20K — [Playwright MCP token problem](https://lite.ego.app/article/playwright-mcp-token-problem); [scrolltest](https://scrolltest.medium.com/playwright-mcp-burns-114k-tokens-per-test-the-new-cli-uses-27k-heres-when-to-use-each-65dabeaac7a0) [widely reported]
- Playwright Test Agents (v1.56+): Planner (explores app, writes Markdown plan), Generator (plan -> `.spec.ts`), Healer (diagnoses/repairs a failing test and reruns). Install with `npx playwright init-agents --loop=claude` (also `vscode`, `codex`, `opencode`) — [TestDino](https://testdino.com/blog/playwright-test-agents); [QASkills](https://qaskills.sh/blog/playwright-init-agents-guide); [Playwright DEV post](https://dev.to/playwright/playwright-agents-planner-generator-and-healer-in-action-5ajh) [widely reported, Playwright-team origin]
- Chrome DevTools MCP (`chrome-devtools-mcp`, Google's ChromeDevTools org): tools for performance traces with actionable insights, network analysis, screenshots/snapshots, console messages with source-mapped stack traces, emulation; modes `--slim`, `--headless`, `--isolated`; officially supports only Chrome / Chrome for Testing; perf tools may send trace URLs to the CrUX API unless `--no-performance-crux` — [GitHub repo](https://github.com/ChromeDevTools/chrome-devtools-mcp) [official]
- Chrome DevTools MCP can run `performance_start_trace`/`performance_stop_trace` and Lighthouse checks; agent can debug the user's live browser session — [Addy Osmani](https://addyosmani.com/blog/devtools-mcp/); [Chrome for Developers blog](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session) [official]
- Claude in Chrome: connect via `claude --chrome` or `/chrome`; agent opens `localhost:3000`, clicks through UI, reads console errors and DOM, can record GIFs; works on Chrome/Edge/other Chromium; requires a visible browser window, no headless mode, so it cannot run in GitHub Actions or Docker — [Claude Code playbook](https://claude-code-playbook.pages.dev/en/docs/level-1/chrome-integration); [paddo.dev](https://paddo.dev/blog/claude-in-chrome-dev-loop/) [widely reported; GA version "v2.1.198" is single source]
- Next.js 16.2 added `next-browser`, an experimental CLI letting agents drive a real browser; 16.3 adds Agent Browser with React introspection — [Next.js 16.3 AI improvements](https://nextjs.org/blog/next-16-3-ai-improvements); [digitalapplied](https://www.digitalapplied.com/blog/nextjs-16-3-agent-native-turbopack-persistent-cache-2026) [official via snippet]

### Inferences
- Recommended loop: (1) deterministic checks (tsc, lint, unit) first; (2) committed Playwright specs as the durable verification artifact; (3) ad-hoc MCP/CLI browsing only for exploration and debugging — and convert any finding into a spec so verification isn't repeated at token cost each time.
- Use screenshots sparingly for things the a11y tree cannot show (layout, overlap, contrast, visual regressions); use snapshots for interaction and assertions. Prefer CLI/file-based snapshots in long sessions to avoid context bloat.
- Flakiness mitigation for agents: web-first assertions (auto-wait), role-based locators (`getByRole`) that mirror the a11y tree the agent already sees, never fixed sleeps.

### Gaps
- No primary Playwright-team page fetched for the 114K/27K benchmark (bug0 blocked); treat exact numbers as widely reported, not verified.
- Could not fetch Anthropic's official Claude Code Chrome docs; capability details come from secondary sources.

## Accessibility automation (axe-core, Lighthouse, Pa11y) and WCAG 2.2 AA

### Takeaway
Automated axe-based checks find roughly 57% of issues by volume but only ~20–30% of WCAG success criteria; agents must add scripted heuristic checks (keyboard traversal, focus visibility under sticky headers, target size, drag alternatives, paste-allowed auth) plus human review.

### Cited Findings
- Deque study: 2,000+ audits, ~13,000 pages, ~300,000 issues; axe-core-based automated testing identified 57% of issues by volume, vs the common belief of 20–30% — [Deque](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/) [research, vendor-authored]
- The 57% counts issues by volume (dominated by frequent issues like contrast); by share of WCAG success criteria a tool can evaluate, coverage is closer to 20–30% — [wcagc](https://wcagc.com/blog/how-much-do-automated-accessibility-tools-catch); [Easy A11y Guide](https://easya11yguide.com/tips/how-much-can-automated-accessibility-tools-do/) [widely reported]
- WebAIM Million (Feb 2026): 95.9% of top 1M home pages had detectable WCAG 2 failures (94.8% in 2025); avg 56.1 errors/page. Top six categories = 96% of errors: low contrast text 83.9%, missing alt 53.1%, missing form labels 51%, empty links 46.3%, empty buttons 30.6%, missing document language 13.5% — [WebAIM Million 2026](https://webaim.org/projects/million/) [research]
- WCAG 2.2 new AA criteria: 2.4.11 Focus Not Obscured (Minimum) — focused element not entirely hidden by author content (sticky headers, banners, modals); 2.5.7 Dragging Movements — single-pointer alternative for any drag; 2.5.8 Target Size (Minimum) — 24×24 CSS px with spacing/inline exceptions; 3.3.8 Accessible Authentication (Minimum) — no cognitive function test without alternative; allow paste, offer SSO/magic links — [Vispero](https://vispero.com/resources/new-success-criteria-in-wcag22/); [wcagpatterns](https://wcagpatterns.com/guides/wcag-2-2) (W3C normative text at https://www.w3.org/TR/WCAG22/) [official/widely reported]
- Automation coverage of 2.2 additions: axe-core 4.9+ reliably covers 2.5.8 target size and partially 2.4.11; the rest need manual/process review — [wcagpatterns](https://wcagpatterns.com/guides/wcag-2-2) [single source]
- Lighthouse CI and axe-core are commonly combined in PRs (score budgets + `@axe-core/playwright` tests) — [example PR](https://github.com/Refract-Protocol/refract-frontend/pull/176) [single source, illustrative]

### Inferences
- Agent checklist beyond axe: (a) keyboard-only Playwright test tabbing through each page asserting `:focus-visible` and that the focused element's bounding box is not covered by fixed/sticky elements (`elementFromPoint` at focus centre) for 2.4.11; (b) assert interactive element boxes ≥24×24 or spaced; (c) for any drag UI, assert a click/keyboard alternative exists; (d) assert password/OTP inputs do not block paste and no CAPTCHA without alternative; (e) run axe in multiple states (menus open, modals, error states, dark mode), not just initial load; (f) zoom/reflow at 320px width and 200% text.
- Run axe with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` and fail CI on violations; treat "incomplete"/needs-review results as tasks for a human or agent judgement step.
- Agent-heuristic checks that need judgement (screenshots + reasoning): meaningful alt text quality, logical heading order relative to visual design, link purpose, error message clarity.

### Gaps
- Could not verify the current axe-core version or exact rule IDs for 2.2 (e.g. `target-size` is a known axe rule but its default-tag status was not confirmed in this session).
- No source found quantifying Pa11y vs axe coverage differences (Pa11y can run axe or HTML_CodeSniffer runners).

## Performance (Core Web Vitals, Lighthouse CI, bundle budgets, Vercel Speed Insights)

### Takeaway
CWV "good" thresholds remain LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile of field data; agents can only measure lab proxies (Lighthouse with median-of-N runs, TBT as INP proxy, user-flow/timespan traces), so they should gate on lab budgets and bundle sizes and read field data (Speed Insights/CrUX) post-deploy.

### Cited Findings
- Thresholds: LCP good ≤2.5s / poor >4.0s; INP good ≤200ms / poor >500ms; CLS good ≤0.1 / poor >0.25; assessed at p75 of real Chrome users over a 28-day window — [corewebvitals.io](https://www.corewebvitals.io/core-web-vitals); [workspacein](https://workspacein.com/tools/core-web-vitals-explainer) (canonical: https://web.dev/articles/vitals) [widely reported, consistent with official]
- Lighthouse navigation mode does not interact with the page, so it cannot report INP; TBT is the lab proxy but "not a substitute"; Lighthouse user flows / timespan mode can measure INP over scripted interactions — [Search Engine Journal](https://www.searchenginejournal.com/why-google-lighthouse-doesnt-include-inp-a-core-web-vital/528734/); [web.dev Lighthouse user flows](https://web.dev/articles/lighthouse-user-flows); [web.dev TBT](https://web.dev/articles/tbt) [official]
- Lighthouse CI: set `numberOfRuns: 3` (or 5) and aggregate (`median`, `median-run`, `optimistic`, `pessimistic`); median of 5 runs is ~2x as stable as one run; 3 runs reduce variance ~37% — [Unlighthouse LHCI config](https://unlighthouse.dev/learn-lighthouse/lighthouse-ci/configuration); [web.dev Lighthouse CI](https://web.dev/articles/lighthouse-ci) [widely reported; variance stats attributed to Google research]
- Budgets via `lighthouserc` assertions or `budget.json` — [Unlighthouse budgets](https://unlighthouse.dev/learn-lighthouse/lighthouse-ci/budgets) [widely reported]
- Chrome DevTools MCP lets agents record performance traces and pull insights (and CrUX field data unless disabled) — [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) [official]
- Vercel MCP exposes Web Analytics queries (`get_web_analytics`) and runtime logs/errors — [Vercel MCP docs](https://vercel.com/docs/agent-resources/vercel-mcp) [official via snippet]

### Inferences
- Agent loop: build production (`next build` / `astro build`) and test the production server or a Vercel preview — never measure `next dev` (unminified, HMR overhead).
- Gate PRs on: LHCI assertions (median of ≥3 runs, desktop and mobile presets) for LCP/CLS/TBT; JS bundle budgets per route (size-limit or Next.js bundle analyzer output); a Playwright user-flow trace on key interactions for INP regressions. Report field data from Speed Insights/CrUX as trend, not gate.
- Don't let agents "optimize the score" by gaming Lighthouse (e.g. lazy-loading the LCP image, which hurts LCP) — require before/after numbers with run counts.

### Gaps
- Could not fetch docs for size-limit, @next/bundle-analyzer (Turbopack-era status in Next 16 unverified), or Vercel Speed Insights metrics details; no sourced figures for these.

## Testing strategy for agent-written web code

### Takeaway
Layer verification: `tsc --noEmit` + lint as cheapest gate, Vitest + Testing Library for pure logic and sync components, Playwright E2E for async Server Components and critical flows, visual regression only in pinned Docker environments; test through user-facing roles to avoid brittleness.

### Cited Findings
- Next.js official Vitest guide: Vitest does not support async Server Components; unit-test sync Server/Client Components and use E2E for async components — [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest); [vitest issue #8526](https://github.com/vitest-dev/vitest/issues/8526) [official]
- Typical split: Vitest+RTL for Server Actions, Zod schemas, sync components; Playwright for auth, checkout, async RSC — [SecureStartKit, 2026](https://medium.com/@securestartkit/next-js-testing-in-2026-vitest-playwright-0caf6dd1f829) [single source]
- Visual regression flakiness: animations are the top cause; use `animations: 'disabled'`, wait for fonts, per-browser baselines, `maxDiffPixelRatio` ~0.01, and generate/compare baselines inside the same Playwright Docker image because font rendering/anti-aliasing differ across OSes — [Currents best-practices skill](https://github.com/currents-dev/playwright-best-practices-skill/blob/main/playwright-best-practices/testing-patterns/visual-regression.md); [TestDino visual testing](https://testdino.com/blog/playwright-visual-testing) [widely reported]
- Unguarded visual baseline updates and `numberOfRuns=1` flagged as measurement-rigor anti-patterns in a real repo issue — [VilnaCRM issue #103](https://github.com/VilnaCRM-Org/ui-toolkit/issues/103) [single source, illustrative]
- Playwright Healer agent repairs failing tests caused by locator/UI changes — [TestDino](https://testdino.com/blog/playwright-test-agents) [widely reported]

### Inferences
- Agent-specific risk: the agent that wrote the code also writes tests that encode its misunderstanding, or "heals" tests by weakening assertions / updating snapshots. Rules: never update visual baselines or delete assertions without explicit human approval; Healer changes should be locator-only; require a failing test before the fix for bug work.
- Contract tests: validate API/Server Action inputs/outputs with shared Zod schemas, and for Postgres, run migrations against a real ephemeral DB in CI rather than mocks.
- Type checking is verification but Next.js typed routes/`next typegen` and strict TS settings increase its value; `next build` also catches server/client boundary errors that `tsc` misses.

### Gaps
- No sourced data on flake rates of agent-generated vs human-written Playwright tests.

## Next.js- and Astro-specific agent pitfalls and mitigations

### Takeaway
Training data lags Next.js 16 (proxy.ts, explicit caching via `use cache`/Cache Components, async request APIs); the strongest mitigation is version-matched local docs (AGENTS.md -> `node_modules/next/dist/docs/`) plus the Next.js DevTools MCP for live errors.

### Cited Findings
- Next.js 16+: MCP support via `next-devtools-mcp` (`.mcp.json`: `npx -y next-devtools-mcp@latest`), auto-discovers the running dev server; exposes build/runtime/type errors, live state, page metadata, Server Action inspection, dev logs — [Next.js MCP guide](https://nextjs.org/docs/app/guides/mcp) [official via snippet]
- AGENTS.md directs agents to bundled docs instead of training data. 16.2+: full docs bundled at `node_modules/next/dist/docs/` as Markdown; 16.2 requires writing AGENTS.md yourself; 16.3+ `next dev` detects an AI agent and writes/maintains a managed pointer block in AGENTS.md; ≤16.1 use the legacy `agents-md` command that downloads docs to `.next-docs/` — [Next.js AI agents guide](https://nextjs.org/docs/app/guides/ai-agents.md); [Next.js 16.2 AI](https://nextjs.org/blog/next-16-2-ai) [official via snippet]
- Next.js 16.3: first-party agent skills (`next-cache-components-adoption`, `next-cache-components-optimizer`, partial prefetching adoption, dev-loop skill connecting to `/_next/mcp`) — [digitalapplied](https://www.digitalapplied.com/blog/nextjs-16-3-agent-native-turbopack-persistent-cache-2026); [Next.js 16.3 AI](https://nextjs.org/blog/next-16-3-ai-improvements) [official via snippet + secondary]
- `cacheComponents` will become default in a future major; turning it on in 16.3 can break builds of simple pages (dynamic data outside Suspense) — [Next.js 16.3 blog](https://nextjs.org/blog/next-16-3); [DEV post](https://dev.to/shubhradev/i-turned-on-cache-components-in-nextjs-163-it-refused-to-build-my-simplest-page-3ak0) [official + single source]
- Next.js 16: `middleware.ts` deprecated/renamed to `proxy.ts` (Node.js runtime); caching is explicit via `use cache` — [Pockit migration guide](https://pockit.tools/blog/nextjs-16-migration-guide-turbopack-proxy-cache-components/); [Next.js upgrade guide v16](https://nextjs.org/docs/app/guides/upgrading/version-16) [widely reported]. Note conflict: some write-ups claim fetch became uncached in 16 and that keeping `middleware.ts` silently breaks redirects ([squaredtech](https://www.squaredtech.co/nextjs-16-upgrade-broke-4-things-no-errors-no-warnings)); fetch defaulting to uncached actually dates from Next.js 15, and deprecation (not removal) of middleware.ts is the official framing — treat the silent-break claim as unverified.
- Astro 6 (2026-03-10): built-in Fonts API, CSP API, live content collections, Vite Environment API so dev runs the production runtime, experimental Rust compiler — [Astro 6.0](https://astro.build/blog/astro-6/) [official]

### Inferences
- Common agent errors to check for: Pages Router APIs (`getServerSideProps`, `next/router`) in App Router code; hooks/event handlers in Server Components without `'use client'`; importing server-only modules (DB clients, secrets) into client components (use `server-only` package); synchronous `params`/`cookies()` access (async since 15); assuming implicit fetch caching.
- Mitigations: pin versions in AGENTS.md/CLAUDE.md, point to bundled docs or Context7 version-pinned docs, require `next build` (not just dev) before declaring done, and have the agent query `next-devtools-mcp` for errors after each change.
- For Astro: Astro 6's CSP API and dev-matches-prod runtime reduce "works in dev, fails in build" gaps; still verify `astro build && astro preview`.

### Gaps
- Could not verify Context7 or llms.txt specifics for Next/Astro in this session (no search run); Astro docs do publish llms.txt per general knowledge but unsourced here.

## Vercel: preview deployments as verification targets, Vercel MCP, limits

### Takeaway
Every PR's Vercel preview is the most production-like verification target; agents reach protected previews via "Protection Bypass for Automation" and inspect builds/logs via the official Vercel MCP.

### Cited Findings
- Protection Bypass for Automation: per-project secret sent as `x-vercel-protection-bypass` header (or query param); add `x-vercel-set-bypass-cookie: true` to persist across navigations; Vercel injects `VERCEL_AUTOMATION_BYPASS_SECRET` as a system env var; for GitHub Actions store it as a secret and set Playwright `extraHTTPHeaders` — [Vercel automated & agent access docs](https://vercel.com/docs/deployment-protection/automated-agent-access); [Vercel changelog: available on all plans](https://vercel.com/changelog/improved-security-with-automation-testing-now-available-on-all-plans); [Autonoma guide](https://getautonoma.com/blog/vercel-preview-deployments) [official via snippet]
- Vercel MCP: remote OAuth server at `https://mcp.vercel.com`; tools for docs search, teams/projects, deployments (`list_deployments`, `get_deployment`, build logs, `get_runtime_logs`, `get_runtime_errors`), Web Analytics; launched read-only, can deploy since July 2026; install `npx -y add-mcp https://mcp.vercel.com -g` — [Vercel MCP docs](https://vercel.com/docs/agent-resources/vercel-mcp); [Vercel MCP tools](https://vercel.com/docs/agent-resources/vercel-mcp/tools); [Vercel blog](https://vercel.com/blog/introducing-vercel-mcp-connect-vercel-to-your-ai-tools) [official via snippet; deploy-since-July claim single source]

### Inferences
- Loop: push branch -> wait for preview `READY` (via MCP/`vercel` CLI or GitHub deployment status) -> run Playwright + axe + LHCI against the preview URL with bypass header -> read runtime errors/logs via MCP -> fix.
- Previews use preview env vars and often a separate DB branch; verify the agent isn't testing against production data, and that the bypass secret is never printed to logs or committed.

### Gaps
- Could not fetch current Vercel function duration/memory, build minutes, or rate limits; no sourced agent-relevant limits recorded.

## Security checks runnable in CI

### Takeaway
Cheap, agent-runnable security gates: gitleaks (secrets), Semgrep and/or CodeQL (`javascript-typescript`) SAST, `npm audit` (critical/high) plus Dependabot, and verified CSP headers (Next.js nonce via proxy.ts, Astro 6 CSP API).

### Cited Findings
- Gitleaks: single binary, offline, 150+ secret patterns, SARIF output for GitHub code scanning; use as pre-commit hook plus CI safety net — [AppSecSanta gitleaks](https://appsecsanta.com/gitleaks); [kunalganglani](https://www.kunalganglani.com/blog/gitleaks-pre-commit-ci-setup) [widely reported]
- CodeQL supports `javascript-typescript`; Semgrep with `security-audit`, `secrets`, `owasp-top-ten` rule packs uploading SARIF; `npm audit --audit-level=critical` in CI — [OneUptime 2026](https://oneuptime.com/blog/post/2026-01-25-security-scanning-github-actions/view) [widely reported]
- Next.js CSP: generate per-request nonce in `proxy.ts`, set CSP on request and response with `'nonce-…' 'strict-dynamic'`; Next applies the nonce to its scripts. Nonces require dynamic rendering — incompatible with static optimization, ISR and PPR — [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy); [johnkavanagh](https://johnkavanagh.co.uk/articles/content-security-policy-in-nextjs/) [official via snippet]
- Astro 6 ships a built-in CSP API — [Astro 6.0](https://astro.build/blog/astro-6/) [official]

### Inferences
- Agents often add CSP and break the app (blank page) or silently make every page dynamic; verification should include a Playwright check that no CSP violations appear in the console and that expected pages remain static (check `next build` route output).
- Add a header check (curl preview URL) for CSP, HSTS, X-Content-Type-Options, frame-ancestors; and a Server Action/route-handler review for auth checks, since SAST rarely catches missing authorization.

### Gaps
- No sourced comparison of Semgrep vs CodeQL detection rates for Next.js-specific issues (e.g. Server Action authz, SSRF in route handlers).
