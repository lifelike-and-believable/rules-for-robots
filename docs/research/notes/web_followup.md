# Web stack follow-up: official Next.js, Vercel, Postgres-provider, Astro and axe-core sources

Research date: 2026-10-05. Method: nextjs.org and vercel.com were reachable this session, and both serve Markdown (append `.md`), so every Next.js and Vercel claim below comes from a full read of the official page, with the page's own `lastUpdated` or `last_updated` date where it has one. Partway through the session, the coordinator reported that orm.drizzle.team, prisma.io, neon.com, astro.build and docs.astro.build had become reachable. I then read the Drizzle, Prisma, Neon and Astro pages directly. supabase.com stayed blocked, so Supabase findings come from the docs source in the supabase/supabase GitHub repo; axe-core, squawk, pgroll, size-limit and Context7 also come from their GitHub sources. The live Neon page matches its GitHub source. No finding below is "secondary only" except where marked. Package versions and dates come from the npm registry.

Evidence levels: **[Official]** (full read of a vendor page or vendor docs source), **[Official; secondary only]** (official URL, but known only from a search extract), **[Widely reported]**, **[Single source]**, **[Inference]**.

## Verdicts on earlier "secondary only" Next.js and Vercel claims

### Takeaway
I checked every earlier "secondary only" web claim against the full official page. All of them hold, with five corrections. Next.js latest is now **16.3.8**. Astro's current major is **7**, not 6. The "cacheComponents breaks simple pages" claim belongs to the official build error, not to the 16.3 blog. The Vercel MCP server is no longer just a read and deploy tool: it now exposes broad write and purchase tools. Of the WCAG 2.2 criteria, axe-core has a rule only for **target size**, and that rule is off by default.

### Cited Findings
| Earlier claim (findings.md / web_verification.md) | Verdict | Official evidence |
|---|---|---|
| Next.js Vitest guide: Vitest does not support async Server Components; use E2E for them | **Confirmed** | "Since `async` Server Components are new to the React ecosystem, Vitest currently does not support them... we recommend using **E2E tests** for `async` components" — [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) (version 16.3.8 docs) [Official] |
| Next.js 16 renamed `middleware.ts` to `proxy.ts` | **Confirmed, with nuance: deprecated, not removed** | "The `middleware` filename is deprecated, and has been renamed to `proxy`"; the named export `middleware` "is also deprecated"; codemod `npx @next/codemod@canary middleware-to-proxy .` — [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (lastUpdated 2026-08-25); [proxy.js reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) [Official] |
| Caching is explicit via `use cache` | **Confirmed, with nuance** | `use cache` "is a Cache Components feature. To enable it, add the `cacheComponents` option" — so it is opt-in, not on by default in 16.x — [use cache reference](https://nextjs.org/docs/app/api-reference/directives/use-cache) [Official] |
| Since 16.2, docs ship in `node_modules/next/dist/docs/`; from 16.3, `next dev` maintains a managed block in `AGENTS.md` | **Confirmed** | See the AI agents section below — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) (lastUpdated 2026-09-07) [Official] |
| `next-devtools-mcp` exposes build, runtime and type errors from the running dev server | **Confirmed** | Tool list: `get_errors`, `get_logs`, `get_page_metadata`, `get_project_metadata`, `get_routes`, `get_server_action_by_id`, `get_compilation_issues`, `compile_route` — [Next.js MCP guide](https://nextjs.org/docs/app/guides/mcp) (lastUpdated 2026-07-08) [Official] |
| "Turning on `cacheComponents` in 16.3 can break builds of simple pages" (cited to the 16.3 blog) | **Corrected (attribution)** | The 16.3 blog does not say this. The behaviour is official, though: with Cache Components on, `fetch()` or `connection()` outside `<Suspense>` makes `next build` fail with "Next.js encountered uncached data during prerendering", offering fixes `[stream]`, `[cache]`, `[block]` (`export const instant = false`) — [AI agents guide, Step 3](https://nextjs.org/docs/app/guides/ai-agents) [Official]. The "refused to build my simplest page" framing is from a [DEV post](https://dev.to/shubhradev/i-turned-on-cache-components-in-nextjs-163-it-refused-to-build-my-simplest-page-3ak0) [Single source]. |
| Nonce-based CSP forces dynamic rendering; incompatible with static optimization, ISR, PPR | **Confirmed** | "you **must use dynamic rendering to add nonces**"; "Static optimization and Incremental Static Regeneration (ISR) are disabled"; "Partial Prerendering (PPR) is incompatible with nonce-based CSP" — [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy) (lastUpdated 2026-03-20) [Official] |
| Vercel: `x-vercel-protection-bypass` header, `x-vercel-set-bypass-cookie`, `VERCEL_AUTOMATION_BYPASS_SECRET` | **Confirmed** | [Vercel Automated & Agent Access](https://vercel.com/docs/deployment-protection/automated-agent-access) (last_updated 2026-09-15) [Official] |
| Vercel MCP: read build/runtime errors; "launched read-only, can deploy since July 2026" | **Corrected and extended** | Deploy capability confirmed: "Vercel MCP can now deploy code", published **July 23, 2026** — [changelog](https://vercel.com/changelog/vercel-mcp-can-now-deploy-code). "Launched read-only" is **unverifiable**: the Public Beta post (Aug 4, 2025) already listed "Manage projects and deployments" — [changelog](https://vercel.com/changelog/vercels-mcp). As of Sept 2026 the tool reference lists write tools well beyond deploy (see the Vercel MCP section) [Official] |
| Fetch became uncached by default in 16 (squaredtech) vs in 15 | **Corrected: Next.js 15** | v15 upgrade guide: "`fetch` requests are no longer cached by default"; GET Route Handlers also "no longer cached by default" — [v15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15) [Official] |
| Astro 6.x is current; Astro 7 in alpha | **Corrected** | [Astro 7.0 blog](https://astro.build/blog/astro-7/), June 22, 2026. Astro **7.0.0** published 2026-06-22; latest **7.3.5** (2026-09-24); 7.4.0-beta.1 in beta — [npm registry: astro](https://registry.npmjs.org/astro) [Official] |
| axe-core 4.9+ "reliably covers 2.5.8 target size and partially 2.4.11" | **Corrected** | axe-core 4.13 lists exactly one rule under "WCAG 2.2 Level A & AA Rules", `target-size` (tags `wcag22aa, wcag258`), and states "These rules are disabled by default". No rule is tagged for 2.4.11 — [axe-core rule descriptions](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) [Official] |

### Inferences
- The findings.md "Web verification" paragraph can drop "secondary only" from all Next.js and Vercel citations listed above. The 16.3 `cacheComponents` sentence should be re-cited to the AI agents guide's build-error example.
- The rule "point agents at `node_modules/next/dist/docs/`" is now backed by an official page that cites Vercel's own evals ([nextjs.org/evals](https://nextjs.org/evals)). I did not read the eval data itself.

### Gaps
- I did not open nextjs.org/evals, so I cannot state its benchmark numbers.

## Next.js 16.x: current version, AI agents guide, bundled docs, MCP, skills, AGENTS.md

### Takeaway
Next.js **16.3.8** is the latest stable release (2026-09-30), with 16.4 on canary. The official agent stack has four parts: (1) version-matched docs bundled in `node_modules/next/dist/docs/`; (2) an `AGENTS.md` pointer block that `next dev` writes and maintains automatically from 16.3; (3) the `/_next/mcp` dev-server endpoint, reached through `next-devtools-mcp`; (4) four first-party Skills for multi-step workflows. Next.js says framework knowledge should come from docs that are always loaded, not from Skills.

### Cited Findings
- **Versions:** npm `latest` = 16.3.8 (published 2026-09-30); `canary` = 16.4.0-canary.60; `backport` = 15.5.27. 16.0.0 shipped 2025-10-22, 16.1.0 on 2025-12-18, 16.2.0 on 2026-03-18 and 16.3.0 on 2026-08-03 — [npm registry: next](https://registry.npmjs.org/next) [Official]
- The 16.3 release blog is dated Monday, August 3rd 2026, and the 16.3 AI-improvements blog is dated June 26th 2026 (it covered the preview) — [Next.js 16.3](https://nextjs.org/blog/next-16-3); [Next.js 16.3: AI Improvements](https://nextjs.org/blog/next-16-3-ai-improvements) [Official]
- **Bundled docs:** "When you install `next`, the Next.js documentation is bundled at `node_modules/next/dist/docs/`, mirroring the structure of the Next.js documentation site"; "no network request or external lookup required" — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]
- **Auto-managed AGENTS.md:** On 16.3+, "When an AI coding agent is detected in the environment and no managed block is present, Next.js auto-generates `AGENTS.md` and `CLAUDE.md` at the project root. Existing `AGENTS.md` or `CLAUDE.md` files are upserted, so content outside the managed block is preserved." The block sits between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->`, headed "# This is NOT the Next.js you know". The generated `CLAUDE.md` contains `@AGENTS.md` — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]
- The block tells agents: "This block is written and re-added by `next dev`... Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean." The blog adds "Commit the block as-is" — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents); [16.3 AI blog](https://nextjs.org/blog/next-16-3-ai-improvements) [Official]
- **Opt-out** is `agentRules: false` in `next.config.ts`. `create-next-app` generates `AGENTS.md` and `CLAUDE.md`, and `--no-agents-md` disables that. On 16.2 you write AGENTS.md yourself. On 16.1 and earlier you run `npx @next/codemod@canary agents-md`, which downloads docs to `.next-docs/` — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]
- **Docs over the network:** append `.md` to any nextjs.org/docs URL, or send `Accept: text/markdown`. `/docs/llms.txt` and `/docs/llms-full.txt` follow the llms.txt convention. The per-error pages under `/docs/messages` are not bundled — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]
- **Runtime visibility:** `next dev` forwards browser console errors to the terminal (`logging.browserToTerminal`). It also writes its PID, port and URL to `.next/dev/lock`, so a second `next dev` prints the existing server rather than starting a duplicate — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]
- **`/_next/mcp`:** "the Next.js MCP server at `/_next/mcp`... exposes the running dev server's routes, server logs, and compilation issues. Its `get_compilation_issues` and `compile_route` tools report whether the code compiles straight from the dev server, so an agent doesn't have to run a full `next build`" — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]. In 16.3, "knowledge-base tools [were] retired" from the MCP server because the bundled docs replace them. "Skills like next-dev-loop call the underlying /_next/mcp endpoints directly"; for other clients, add `next-devtools-mcp` to `.mcp.json` — [16.3 AI blog](https://nextjs.org/blog/next-16-3-ai-improvements) [Official]
- **next-devtools-mcp:** requires Next.js 16+. Config is `{"mcpServers":{"next-devtools":{"command":"npx","args":["-y","next-devtools-mcp@latest"]}}}`. It auto-discovers the running dev server. `get_compilation_issues` and `compile_route` are "Turbopack only" — [Next.js MCP guide](https://nextjs.org/docs/app/guides/mcp) [Official]. Current npm version: 0.4.0 — [npm registry](https://registry.npmjs.org/next-devtools-mcp/latest) [Official]
- **Browser view:** the experimental `next-browser` from 16.2 "has merged into the general-purpose agent-browser CLI". agent-browser 0.27+ adds React DevTools introspection (`react tree`, `react inspect`, `react renders start/stop`, `react suspense --only-dynamic --json`), enabled with `--enable react-devtools` — [16.3 AI blog](https://nextjs.org/blog/next-16-3-ai-improvements) [Official]. This corrects the earlier note that called it "next-browser" in 16.3.
- **First-party Skills** (install with `npx skills add vercel/next.js --skill <name>`):
  - `next-dev-loop`: runtime inspect, edit and verify loop using `/_next/mcp` plus agent-browser
  - `next-cache-components-adoption`: interactive; turns the flag on and fixes one feature at a time with check-ins
  - `next-cache-components-optimizer`: writes a failing `instant()` test, then refactors until it passes
  - `next-partial-prefetching-adoption`: added in 16.3 stable

  Source: [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]. The earlier "knowledge" Skills are retired ("Run `npx skills update` to remove them") — [16.3 AI blog](https://nextjs.org/blog/next-16-3-ai-improvements) [Official]
- "Framework knowledge comes from the bundled docs, not from Skills. Benchmark results show that always-available context outperforms on-demand retrieval." — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official, vendor-run eval]
- **Agent-readable errors:** with Cache Components enabled, blocking errors print labeled fixes in the overlay, the `next dev` terminal and `next build` output, plus a "Copy prompt" button. `next build --debug-prerender` enables server source maps. Each error links to a page under `/docs/messages` "written for agents to read" — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents) [Official]

### Inferences
- A rules-for-robots Next.js rule should say: do not delete or edit the `nextjs-agent-rules` block, and put project rules outside it. Agents that "clean up" diffs will otherwise fight `next dev`.
- Because `/_next/mcp` `compile_route` is cheap, a rule can say "check compilation through the MCP while iterating, and run `next build` before declaring done", rather than running `next build` after every edit.
- On Next.js ≤16.1, the bundled docs and auto-managed block are not available, so rules need a version gate.

### Gaps
- I did not read the agent-detection logic (`generate-agent-files.js`), so which environment variables count as "agent detected" is unknown.

## Next.js 16.x: proxy.ts, Cache Components, fetch default, Vitest, CSP

### Takeaway
`middleware.ts` still works in 16 but is deprecated. `proxy.ts` is Node-only, so Edge-runtime users must stay on `middleware`. Caching is opt-in: `fetch` has been uncached by default since **15**, and `use cache` requires `cacheComponents: true`. Nonce-based CSP makes every page dynamic. Experimental SRI hash-based CSP is the official way to keep static pages.

### Cited Findings
- "The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured. If you want to continue using the `edge` runtime, keep using `middleware`." Config flags are renamed too (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`) — [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) [Official]
- Setting `runtime` in a Proxy file "will throw an error". Version history: v16.0.0 "Middleware is deprecated and renamed to Proxy"; v15.5.0 Node.js runtime for Middleware stable — [proxy.js reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) [Official]
- Other v16 breaking changes relevant to agents (all from the [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) [Official]):
  - Node.js 20.9+ and TypeScript 5.1+ are required.
  - Turbopack is the default for `next dev` and `next build`. A custom `webpack` config makes `next build` **fail** unless you pass `--webpack`.
  - Synchronous access to request APIs "is fully removed".
  - `revalidateTag` needs a second `cacheLife` argument; the single-argument form is deprecated.
  - `cacheLife` and `cacheTag` are stable, and the `unstable_` prefix is no longer needed.
  - `images.minimumCacheTTL` default changed from 60s to 4h.
- PPR in 16 is opted into via `cacheComponents`. The 16.3 blog says the Instant Navigation behaviours "will become the default in a future major version... dynamic by default, with no hidden or implicit caching" — [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16); [Next.js 16.3](https://nextjs.org/blog/next-16-3) [Official]
- Fetch default: "`fetch` requests are no longer cached by default. To opt specific `fetch` requests into caching, you can pass the `cache: 'force-cache'` option" (Next.js 15) — [v15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15) [Official]
- `use cache` outputs are stored "in memory by default". `'use cache: remote'` uses a platform cache handler ("typically incurs platform fees"). Arguments and return values must be serializable — [use cache reference](https://nextjs.org/docs/app/api-reference/directives/use-cache) [Official]
- CSP nonces: generate a nonce per request in `proxy.ts` and set `script-src 'self' 'nonce-…' 'strict-dynamic'`. Next.js extracts the nonce from the CSP header and applies it automatically. With nonces, "Pages will build successfully but may encounter runtime errors if not properly configured for dynamic rendering". Also "No CDN caching" and "Higher hosting costs" — [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy) [Official]
- Alternatives in the same guide: a CSP set in `next.config.js` `headers()` without nonces (needs `'unsafe-inline'`), or **Experimental SRI** (`experimental.sri`), which "allows you to maintain static generation while still having a strict CSP". SRI limitations: experimental, App Router only, build-time only — [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy) [Official]

### Inferences
- Agent check after adding CSP: compare the `next build` route table before and after. If routes flipped from static to dynamic, the agent must report that cost rather than silently accept it.
- Agents trained on Next ≤14 will assume `fetch` is cached. A rule should state "caching is opt-in (`use cache` with `cacheComponents`, or `cache: 'force-cache'`)".

### Gaps
- The promised "further `edge` runtime instructions" for proxy in a later minor release were not found in the 16.3 docs.

## Vercel: deployment protection bypass, MCP capabilities, function limits, Speed Insights, previews, env vars

### Takeaway
The automation bypass is a per-project secret, sent as `x-vercel-protection-bypass` and exposed as `VERCEL_AUTOMATION_BYPASS_SECRET`, with redaction from build logs. As of Sept 2026, the official Vercel MCP grants an agent **the same access as the user's Vercel account**. It includes tools that deploy, create and edit env vars, decrypt env values, delete projects and buy domains or credits. Vercel itself recommends human confirmation. Function limits: 300s default duration, 4.5 MB request/response body, 2–4 GB memory. Vercel recommends Node.js over Edge.

### Cited Findings
- **Bypass setup:** create the secret under Settings → Deployment Protection → Protection Bypass for Automation. Multiple secrets per project are allowed. "Vercel automatically sets one secret as the `VERCEL_AUTOMATION_BYPASS_SECRET` system environment variable". Send it as an HTTP header (recommended) or as a query parameter named `x-vercel-protection-bypass`. The query form puts the secret in URLs that "are often logged" — [Automated & Agent Access](https://vercel.com/docs/deployment-protection/automated-agent-access) (2026-09-15) [Official]
- **Playwright pattern:** `extraHTTPHeaders: {'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET, 'x-vercel-set-bypass-cookie': 'true'}`, and fail fast if the env var is missing. Revoking a secret invalidates it for all existing deployments, and you must redeploy to receive the new value. Protection Bypass for Automation is available on all plans. Deployment Protection Exceptions make a whole preview domain public, so use them only when public access is acceptable. Trusted IPs suit automation poorly because of rotating IPs. Setup requires the Member role or Project Administrator — [Automated & Agent Access](https://vercel.com/docs/deployment-protection/automated-agent-access) [Official]
- **Log redaction:** "Vercel always redacts the `VERCEL_AUTOMATION_BYPASS_SECRET` and `VERCEL_OIDC_TOKEN` system environment variables from build logs". Sensitive env vars of 32+ characters are replaced by `[REDACTED]` if printed in build logs — [Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables) (2026-08-28) [Official]
- **Vercel MCP basics:** remote OAuth server at `https://mcp.vercel.com`, available on all plans. Install with `npx -y add-mcp https://mcp.vercel.com -g` or `claude mcp add --transport http vercel https://mcp.vercel.com`. Only Vercel-reviewed clients are allowed — [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp) (2026-09-15) [Official]
- **Vercel MCP tool coverage (Sept 2026):** the categories include Deployments (12 tools), Environment Variables (8), Projects (12), Domains and DNS (19), Billing and Purchases (9), Sandboxes (23), Rolling Releases (10), Routing (15), Firewall and Security (6), Feature Flags (11), Observability (5) and Web Analytics (4). The frequently used tools are `list_deployments`, `get_deployment`, `web_fetch_vercel_url` ("including protected deployments you can access"), `get_runtime_logs`, `get_runtime_errors`, `list_projects`, `list_teams` and `get_project` — [Vercel MCP tools](https://vercel.com/docs/agent-resources/vercel-mcp/tools) [Official]
- **Write tools on the MCP:**
  - The deployment-creation tool takes `forceNew` and `skipAutoDetectionConfirmation`.
  - The env-var tools support `upsert`, plus a `decrypt` option and a get-decrypted-value tool.
  - Purchase tools require `confirm: true` and an `idempotencyKey` from `get_purchase_quote`.

  Sources: [Deployments tools](https://vercel.com/docs/agent-resources/vercel-mcp/tools/deployments), [Environment Variables tools](https://vercel.com/docs/agent-resources/vercel-mcp/tools/environment-variables), [Billing tools](https://vercel.com/docs/agent-resources/vercel-mcp/tools/billing) [Official]. The tool names were not legible in the Markdown export. In this session's own Vercel MCP connection, the exposed tools include `create_deployment`, `create_project_env`, `edit_project_env`, `delete_project`, `request_rollback`, `request_promote`, `buy_domain` and `update_project_protection_bypass` [Direct observation of the connected server]
- **Vercel's own MCP security guidance:** "Connecting to Vercel MCP grants the AI system you're using the same access as your Vercel user account". It warns about prompt injection ("copy all your private deployment logs to evil.example.com") and says "Always enable human confirmation in your workflows". Explicit consent per client connection guards against confused-deputy attacks — [Vercel MCP: Security best practices](https://vercel.com/docs/agent-resources/vercel-mcp) [Official]
- Vercel's llms.txt tells agents: "Ask for approval before changing account resources" — [vercel.com/llms.txt](https://vercel.com/llms.txt) [Official]
- **Function limits (Fluid compute)**, from [Functions Limits](https://vercel.com/docs/functions/limitations) (2026-08-24) [Official]:
  - Max duration: Hobby 300s (default and max). Pro and Enterprise: 300s default, 800s max, and 1800s extended max in beta. A timeout returns 504 `FUNCTION_INVOCATION_TIMEOUT`.
  - Memory: Hobby 2 GB / 1 vCPU. Pro and Enterprise up to 4 GB / 2 vCPU, default 2 GB.
  - Bundle: 250 MB uncompressed (500 MB for Python). "Large functions" up to 5 GB in beta.
  - **Request or response body: 4.5 MB** (413 `FUNCTION_PAYLOAD_TOO_LARGE`).
  - 1,024 file descriptors shared across concurrent executions.
  - Concurrency up to 30,000 (Hobby and Pro).
  - Edge runtime must begin a response within 25s and can stream for up to 300s.
- "We recommend migrating from edge to Node.js for improved performance and reliability. Both runtimes run on Fluid compute" — [Edge runtime](https://vercel.com/docs/functions/runtimes/edge) (2026-08-03) [Official]
- **Env vars:**
  - Values are encrypted at rest but "visible to any user that has access to the project".
  - Total size is 64 KB per deployment; edge runtime is limited to 5 KB per variable.
  - "Any change you make to environment variables are not applied to previous deployments, they only apply to new deployments." Source: [Environment variables](https://vercel.com/docs/environment-variables) (2026-09-17) [Official]
  - Sensitive env vars are "non-readable once created" and only available for the production and preview environments. A team policy, "Enforce Sensitive Environment Variables", makes this mandatory. Source: [Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables) [Official]
- **Preview environments:** each environment can define its own env vars (for example, database connection info). Pro and Enterprise can add Custom Environments such as `staging` and `QA`. Branch-specific URLs point to the latest commit on a branch — [Environments](https://vercel.com/docs/deployments/environments) [Official]
- **Speed Insights:** available on all plans. The free tier includes the Real Experience Score (RES), built from real-user data rather than lab simulation. Speed Insights Plus unlocks all Core Web Vitals, breakdowns and Drains. Events are tracked on both preview and production deployments. The dashboard defaults to P75 and filters by device and environment — [Speed Insights](https://vercel.com/docs/speed-insights) (2026-09-01); [Speed Insights metrics](https://vercel.com/docs/speed-insights/metrics) [Official]

### Inferences
- Treat the Vercel MCP as a privileged credential, not a read-only observer. Rules should set read tools to allow and deploy, env, delete, promote, rollback and purchase tools to ask (Claude Code permission rules or a hook). Decrypting env values must never happen without explicit human request.
- Previews pick up env-var changes only after a new deployment. Agents that change env vars and then re-test an old preview URL will draw false conclusions.
- The 4.5 MB body limit and 300s default duration are the limits agents most often hit (file uploads, long AI calls). Point agents at Vercel Workflows or Blob for those cases rather than raising limits blindly.

### Gaps
- I did not find an official Vercel MCP permission-scoping mechanism (for example, read-only tokens). The only project-scoping mention is the vendor's instruction text in this session's connection, which is not a doc.
- Speed Insights pricing and retention details (limits-and-pricing page) were not read.

## Bundle budgets: size-limit and Next.js bundle analysis in Next 16 / Turbopack

### Takeaway
Next 16 builds with Turbopack by default, so the old `@next/bundle-analyzer` (Webpack) works only with `--webpack`. The Turbopack-native tool is `next experimental-analyze` (v16.1+), which can write output to `.next/diagnostics/analyze` for diffing. For CI gating, size-limit with `andresz1/size-limit-action` remains the established budget tool.

### Cited Findings
- "There are two tools for analyzing your application's bundles: Next.js Bundle Analyzer for Turbopack (experimental) [and] `@next/bundle-analyzer` plugin for Webpack." The Turbopack analyzer is "Available in v16.1 and later". Run `npx next experimental-analyze`. `--output` writes to `.next/diagnostics/analyze`, which "you can copy... to compare results". The UI filters by route, client or server, and file type, and shows import chains — [Optimizing package bundling](https://nextjs.org/docs/app/guides/package-bundling) (lastUpdated 2026-06-01) [Official]
- Turbopack is the default for `next build`, with `--webpack` to opt out — [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) [Official]
- size-limit "checks every commit on CI, calculates the real cost of your JS for end-users and throws an error if the cost exceeds the limit". It can also compute the time to download and execute JS. Its GitHub action posts bundle size changes as a PR comment. `--why` explains size — [ai/size-limit README](https://github.com/ai/size-limit); [size-limit-action](https://github.com/andresz1/size-limit-action) [Official]

### Inferences
- A practical Next 16 gate: size-limit on the built `.next/static/chunks` (or route-level entries) in CI, plus `next experimental-analyze --output` artifacts uploaded for before/after review. Treat the analyzer as diagnostic only, because it is experimental and has no official threshold or exit-code mode.
- Agent risk: raising the budget to make CI pass. Budget changes should require human approval, just like visual baselines. One public repo even automates budget raises on dependency bumps ([slicc PR #3456](https://github.com/ai-ecoverse/slicc/pull/3456)) [Single source, illustrative].

### Gaps
- No official Next.js doc describes a CI-failing budget mode for `experimental-analyze`. The older `experimental.bundlePagesExternals` and `performance` budgets were not researched.
- I did not confirm that size-limit has an official Next.js preset.

## Agent-safe Postgres migrations on Vercel

### Takeaway
Vercel Postgres no longer exists. It moved to Neon in December 2024, and Postgres now comes from Marketplace integrations. The provider docs give these practices:
- Branch the database per preview. Neon makes copy-on-write branches **with production data**; Supabase makes data-less branches built from committed migrations plus a seed.
- Apply versioned migrations with a deploy-only command: `prisma migrate deploy` on Prisma 7, which Prisma 8 replaces with `prisma db migrate`; or `drizzle-kit migrate`.
- Use a direct, unpooled connection for migrations and the pooled one for serverless queries.
- Make breaking changes with expand-and-contract (Prisma 8 guide; pgroll automates it).
- Lint migration SQL in CI with squawk (for example, `ban-drop-column`).

Neither ORM blocks destructive changes at apply time. Prisma 8's `db migrate` applies ⚠ destructive operations without asking, and Drizzle `push --force` auto-accepts data loss. Review and linting before apply is therefore the gate.

### Cited Findings
- "Vercel Postgres is no longer available. If you had an existing Vercel Postgres database, we automatically moved it to Neon in December 2024. For new projects, install a Postgres integration from the Marketplace." Credentials and env vars are injected into the project — [Postgres on Vercel](https://vercel.com/docs/postgres) (2026-01-13) [Official]
- **Neon on Vercel (native integration):** it injects `DATABASE_URL` and related variables. "Automated Preview Branching creates an isolated copy-on-write... branch for every Vercel Preview Deployment". The flow:
  - Vercel webhooks Neon, and Neon creates the branch `preview/<git-branch>`.
  - Env vars for the branch "are injected via webhook at deployment time, overriding preview environment variables for this deployment only (cannot be accessed or viewed in your Vercel project's environment variable settings)".
  - Optionally, run migrations in the build step, e.g. `npx prisma migrate deploy && npm run build`.
  - Enable "Resource must be active before deployment" so Vercel waits for the branch.

  Neon's current docs call the product "Lakebase Postgres", and Neon's llms.txt describes Neon as "from Databricks". Source: [Neon: Vercel-Managed Integration](https://neon.com/docs/guides/vercel-managed-integration) (updatedOn 2026-09-08; the live page matches the [GitHub source](https://github.com/neondatabase/website/blob/main/content/docs/guides/vercel-managed-integration.md)); [neon.com/llms.txt](https://neon.com/llms.txt) [Official]
- Neon cleanup: "Preview branches are automatically deleted when their corresponding Vercel deployments are removed". Vercel retains preview deployments for 6 months by default, so "preview branches can persist long after a PR is closed" — [same source](https://github.com/neondatabase/website/blob/main/content/docs/guides/vercel-managed-integration.md) [Official]
- **Neon branch data:** "By default, branches are created with all of the data that existed in the parent branch". A branch is "a copy-on-write clone of your data" and does not add load to the parent. The docs include a "working with sensitive data?" admonition — [Neon: Branching](https://neon.com/docs/introduction/branching) [Official]
- **Neon pooling:** PgBouncer in **transaction mode**, up to 10,000 client connections, `default_pool_size` = 0.9 × `max_connections`. Use the `-pooler` hostname for app traffic and a direct connection "for schema migrations, pg_dump, logical replication, and queries that depend on SET, LISTEN/NOTIFY, or session-level state". SQL-level `SET`, temp tables and `PREPARE` are unsupported on pooled connections — [Neon connection pooling (docs source)](https://github.com/neondatabase/website/blob/main/content/docs/connect/connection-pooling.md) (updatedOn 2026-09-16) [Official]
- **Vercel pooling guidance (Fluid compute):** define the pool globally, call `attachDatabasePool(pool)` from `@vercel/functions` "to ensure idle connections close before suspension", and set a short idle timeout (for example 5s) — [Connection Pooling with Vercel Functions](https://vercel.com/kb/guide/connection-pooling-with-functions) (2026-07-23) [Official]. File descriptors (1,024) include DB connections; "Use connection pooling" — [Functions Limits](https://vercel.com/docs/functions/limitations) [Official]
- **Supabase branching:** preview branches "are ephemeral... automatically deleted when a PR is merged or closed", and persistent branches are long-lived. Branches are "Data-less by default... to better protect your sensitive production data". The schema "is not cloned. Instead, it is built from the migrations you commit", from `supabase/migrations`, and each commit runs only unapplied migrations. Seeds come from `seed.sql`, and "Data changes in your seed files are not merged to production". On merge, a deploy workflow runs Clone → Pull → Health → Configure → Migrate → Seed, and later steps are skipped if migration fails — [Supabase Branching](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/deployment/branching.mdx); [GitHub integration](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/deployment/branching/github-integration.mdx) [Official, docs source]
- Supabase caveats:
  - Branching runs each migration in a single transaction, so `create index concurrently` cannot run there.
  - Declarative schema files are not applied; you must generate a migration.
  - A reset drops branch data.
  - New branches have no default privileges on `public`, so explicit grants are needed.
  - In the Vercel integration, env vars sync when the PR is opened. Because of race conditions, Supabase "is always automatically re-deploying the most recent deployment of the given pull request".

  Sources: [GitHub integration](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/deployment/branching/github-integration.mdx); [Working with branches](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/deployment/branching/working-with-branches.mdx); [Integrations](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/deployment/branching/integrations.mdx) [Official, docs source]
- **Prisma version change: the docs now default to Prisma ORM 8.** "Prisma ORM 8 is here. The docs now default to Prisma ORM 8. Prisma ORM 7 docs stay at /orm/v7." On npm, the `latest` dist-tag is `8.0.0-rc.19` (2026-09-29) and `prev` is `7.10.0`. So 8 is still a release candidate, even though it is tagged latest — [Prisma: Applying a migration](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production); [npm registry: prisma](https://registry.npmjs.org/prisma) [Official]
- **Prisma 8 migration workflow** (all from [Prisma: Applying a migration](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production) [Official]):
  - Commands:
    - `npx prisma contract emit`
    - `npx prisma migration plan --name …`
    - `npx prisma db migrate`, which "replaces Prisma ORM 7's `prisma migrate deploy`"
  - "In CI and production, you never plan a migration, because migrations arrive through your repository, already reviewed and merged."
  - The pre-production sequence is `prisma migration check` (were files edited or deleted?), then `prisma db migrate --show --db "$PRODUCTION_DATABASE_URL"` (dry list), then `prisma db migrate --db …`.
  - `migration status` and `migration log` are read-only.
  - **"A ⚠ marks a destructive operation... `db migrate` applies destructive operations without stopping to ask you, so the time to catch one is while you are reviewing the migration"**, using `npx prisma migration show <dir>`.
- **Prisma 7 (still the stable line):** "`migrate dev` is a development command and should never be used in a production environment"; "`migrate reset` is a development command and should never be used in a production environment"; "In production and testing environments, use the `migrate deploy` command" — [Prisma v7: Development and production](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production) [Official]
- **Prisma expand-and-contract guide (v8):** "Replace a column without downtime using the expand and contract pattern, with the data backfill inside a Prisma ORM migration". The steps:
  1. Expand: add the new field and keep the old one.
  2. Add a `dataTransform` backfill operation in `migration.ts`.
  3. Update application code.
  4. Contract: remove the old field and "review the destructive warning".

  The guide also tells agents to "Run `npx prisma@latest init` so the Prisma agent skills are installed". The older v6/v7 statement that "Prisma does not yet natively support data migrations" is superseded in v8, where data transforms live inside migrations. Source: [Prisma: Expand-and-contract migrations](https://www.prisma.io/docs/guides/database/data-migration) [Official]
- **Drizzle:** `drizzle-kit generate` "lets you generate SQL migration files based on your Drizzle schema"; `drizzle-kit migrate` "lets you apply generated SQL migration files"; `drizzle-kit check` "will walk through all generate migrations and check for any race conditions (collisions)" — [Drizzle: Migrations with Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) [Official]
- **Drizzle push, official text:** "It's the best approach for rapid prototyping and we've seen dozens of teams and solo developers successfully using it as a primary migrations flow in their production applications. It pairs exceptionally well with blue/green deployment strategy and serverless databases like Planetscale, Neon, Turso". CLI options: `--verbose` ("print all SQL statements prior to execution"), `--explain` ("print the planned SQL changes, without applying them (dry run)") and **`--force` ("auto-accept all data-loss statements")** — [Drizzle: push](https://orm.drizzle.team/docs/drizzle-kit-push) [Official]
- **Conflict:** the vendor endorses push in production, but practitioners say never. One documented CI failure: push with a data-loss diff and no `--force` hits a TTY prompt that rejects in CI, so the migration is skipped silently while the deploy proceeds — [project-forge issue #9979](https://github.com/Tristan578/project-forge/issues/9979); [DEV](https://dev.to/dev_encyclopedia/drizzle-orm-migrations-push-vs-migrate-and-what-actually-belongs-in-production-5cm7) [Single source / widely reported; the exit-code behaviour is not confirmed in Drizzle docs]
- Neon also offers **schema-only branching** for sensitive data: "Tip: working with sensitive data? Neon also supports schema-only branching" — [Neon: Branching](https://neon.com/docs/introduction/branching) [Official]
- **pgroll** (Xata): "Zero-downtime, reversible, schema migrations for Postgres... follows a expand/contract workflow", serving old and new schema versions at once through views, with instant `rollback` — [pgroll README](https://github.com/xataio/pgroll) [Official]
- **squawk:** a linter for Postgres migrations with a GitHub Action and PR comments. Rules flag lock hazards (`require-concurrent-index-creation`, `constraint-missing-not-valid`, `disallowed-unique-constraint`) and destructive changes. `ban-drop-column`: "Dropping a column may break existing clients"; the solution is to stop reading or writing the column first. Current npm version is 2.67.0 — [squawk README](https://github.com/sbdchd/squawk); [ban-drop-column rule](https://github.com/sbdchd/squawk/blob/master/docs/docs/ban-drop-column.md); [npm](https://registry.npmjs.org/squawk-cli/latest) [Official]
- Atlas `migrate lint` also detects destructive changes in CI, but a practitioner post says it moved out of Atlas's free plan in October 2025 — [Atlas lint docs](https://atlasgo.io/versioned/lint) [Official, unread]; [DEV post](https://dev.to/mickelsamuel/atlas-paywalled-their-migration-linter-here-are-your-free-alternatives-4god) [Single source]

### Inferences
- Agent rules for Postgres on Vercel:
  1. Agents generate migration files, never apply schema with `push`, `migrate dev` or `db push` against shared databases. This is stricter than Drizzle's own guidance, so state the reason: no review artifact, and `--force` silently accepts data loss. Never pass Drizzle's `--force` without human approval. Pin the Prisma major in rules, since the 7 → 8 command names differ.
  2. Migrations apply only in CI or build through deploy-only commands, over the direct (non-pooler) URL.
  3. Squawk (or equivalent) runs on new migration files and fails on `DROP COLUMN`, `DROP TABLE`, non-concurrent indexes and validated constraints, unless a human-approved label or override exists.
  4. Breaking changes ship as expand → backfill → contract across separate deploys.
- With Neon preview branches, previews (and any agent testing them) see a **copy of production data**. That conflicts with "keep previews off production data". Teams with PII should branch from an anonymized or seed parent, or use Supabase-style data-less branches. Neon's own sensitive-data tip points to schema-only branching.
- Running `migrate deploy` in the Vercel build step (as Neon suggests) also runs against **production** on production builds. A rule should make production migration a separate, gated pipeline step.

### Gaps
- Prisma 8 is an RC tagged `latest` on npm. Whether teams should adopt it, and whether `migrate deploy` still exists as an alias in 8, was not confirmed.
- I did not read Neon's schema-only branching guide or the Vercel branch-cleanup guide in detail.
- I found no official Vercel or Neon doc that recommends destructive-migration CI gates. Among the ORMs, Prisma 8 recommends review before apply (`migration check`, `db migrate --show`, `migration show`), but no ORM documents a CI-failing destructive gate. That practice is sourced only to linters (squawk, Atlas) and pgroll.

## Astro: current major and CSP API

### Takeaway
Astro **7** is current (7.0.0 on 2026-06-22; latest 7.3.5 on 2026-09-24). Astro 7 adds agent-aware features: a background dev server, which since 7.2 also covers `astro preview`, and JSON logs. Astro also runs an official Astro Docs MCP server. CSP is the stable `security.csp` config (since 6.0), which is hash-based, emits a `<meta>` tag and is unsupported in `astro dev`.

### Cited Findings
- npm dist-tags: `latest` 7.3.5 (2026-09-24), `beta` 7.4.0-beta.1. 7.0.0 on 2026-06-22; 6.0.0 on 2026-03-10; 6.4.0 on 2026-05-28 — [npm registry: astro](https://registry.npmjs.org/astro) [Official]
- Astro 7.0.0 major changes: Vite 8; the Go compiler replaced by a Rust-based one; `@astrojs/db` removed; "Adds background dev server management for AI coding agents". When an agent is detected, `astro dev` starts detached and writes a `.astro/dev.json` lock (URL, port, PID). New commands: `astro dev --background`, `astro dev stop`, `astro dev status` and `astro dev logs [-f]` — [Astro CHANGELOG](https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md) [Official]
- Astro 7.0 release post (June 22, 2026): the `.astro` compiler was rewritten in Rust, Markdown and MDX moved to a Rust pipeline, and the release ships with Vite 8 / Rolldown. Builds are "15-61% faster in our benchmarks". Advanced Routing adds a `src/fetch.ts` entrypoint. "For AI-assisted development, Astro can now detect coding agents, run the dev server in the background, and output structured JSON logs" via `astro dev --json` or `logger: logHandlers.json()`. Upgrade with `npx @astrojs/upgrade` — [Astro 7.0 blog](https://astro.build/blog/astro-7/) [Official]
- Astro AI guide: "When an AI coding agent is detected on macOS and Linux, `astro dev` and, since v7.2.0, `astro preview` automatically start the server as a detached background process". On Windows the server stays in the foreground. The official **Astro Docs MCP server** is at `https://mcp.docs.astro.build/mcp` (Streamable HTTP, free, backed by the kapa.ai API) — [Astro: Build with AI](https://docs.astro.build/en/guides/build-with-ai/) [Official]
- `security.csp` (`boolean | object`, default `false`, since v6.0.0) emits a `<meta http-equiv="content-security-policy">` with `script-src` and `style-src` hashes (SHA-256 default). Limitations: external scripts and styles need your own hashes; `<ClientRouter />` view transitions are unsupported; Shiki is unsupported; `'unsafe-inline'` suppresses hashes. "This feature isn't supported while working in `dev` mode... test this... using `build` and `preview`." — [Astro configuration reference (docs source)](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/configuration-reference.mdx) [Official]
- The runtime CSP API (`ctx.csp.insertScriptResource`, `insertStyleResource`) gained a `kind` option for `script-src-elem`, `-attr` and similar directives in a 7.x release — [Astro CHANGELOG](https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md) [Official]

### Inferences
- Astro rules should require `astro build && astro preview` to verify CSP, since dev mode does not enforce it. Agents should also use `astro dev status` and `astro dev logs` rather than spawning duplicate servers. Next.js has the same pattern with `.next/dev/lock`.

### Gaps
- I did not read the Astro v7 upgrade guide in detail (docs.astro.build/en/guides/upgrade-to/v7/ is reachable). The Rust compiler's "no more HTML correction" change is a likely source of agent-visible breakage.

## axe-core: WCAG 2.2 tags and rules

### Takeaway
axe-core **4.13.0** defines the `wcag22aa` tag, but only one rule carries it: `target-size` (SC 2.5.8). It is **disabled by default** "until WCAG 2.2 is more widely adopted". No axe rule covers 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 3.3.8 Accessible Authentication, or the other 2.2 A/AA additions (3.2.6, 3.3.7).

### Cited Findings
- Current version: axe-core 4.13.0 — [npm registry](https://registry.npmjs.org/axe-core/latest) [Official]
- "WCAG 2.2 Level A & AA Rules — These rules are disabled by default, until WCAG 2.2 is more widely adopted and required." The only rule listed is `target-size`, "Ensure touch targets have sufficient size and space", Serious, tags `cat.sensory-and-visual-cues, wcag22aa, wcag258, EN-301-549v4, EN-9.2.5.8`, issue type "failure, needs review" — [axe-core rule descriptions](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) [Official]
- Tag reference: `wcag22aa` = "WCAG 2.2 Level AA". `experimental` rules are "disabled by default". "The default operation for axe.run is to run all rules except for rules with the 'experimental' tag". To run A and AA you must list both tags (for example `runOnly: ['wcag2a','wcag2aa']`) — [axe-core API.md](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) [Official]
- Related keyboard rules: `scrollable-region-focusable` is WCAG 2.1 A/AA. `focus-order-semantics` is experimental best-practice — [rule descriptions](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) [Official]

### Inferences
- The tag set `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` in `runOnly` should enable `target-size`. The rules-for-robots template should include it explicitly, since default runs skip it. Treat its "needs review" results as human or agent judgement tasks.
- Scripted heuristics remain necessary for every other 2.2 addition. The earlier recommendation stands, with the coverage claim corrected.

### Gaps
- I did not test empirically whether `runOnly` with `wcag22aa` overrides the rule's default-disabled state. The API docs imply tag selection enables matching rules, but I did not verify this in code.

## Context7 and llms.txt

### Takeaway
Context7 (Upstash) is an open-source service that injects up-to-date, version-specific library docs into agent context, through either an MCP server (`https://mcp.context7.com/mcp`) or a CLI-plus-Skill mode. llms.txt is a convention for a Markdown index of a site's docs. **Next.js and Vercel both publish llms.txt** (plus llms-full.txt and per-page `.md`). For Next.js specifically, the vendor now prefers the bundled docs in `node_modules` over any network lookup.

### Cited Findings
- Context7 "pulls up-to-date, version-specific documentation and code examples straight from the source — and places them directly into your prompt". It has two modes: "CLI + Skills — installs a skill that guides your agent to fetch docs using `ctx7` CLI commands (no MCP required)" and "MCP". Setup is `npx ctx7 setup` (OAuth, generates an API key) or manual configuration with `https://mcp.context7.com/mcp` and `Authorization: Bearer`. An API key is recommended for rate limits — [upstash/context7 README](https://github.com/upstash/context7) [Official]
- The MCP exposes `resolve-library-id` (library name → Context7 ID) plus a docs-fetch tool. The npm package is `@upstash/context7-mcp`, MIT licensed — [npm](https://www.npmjs.com/package/@upstash/context7-mcp); [GitHub](https://github.com/upstash/context7) [Official via search extract]
- Next.js: `/docs/llms.txt` and `/docs/llms-full.txt` "follow the llms.txt convention". The root `https://nextjs.org/llms.txt` also exists and tells agents to "read the docs for the version in the project's package.json, not the latest. Versioned copies live at `/docs/{version}/...`" — [AI agents guide](https://nextjs.org/docs/app/guides/ai-agents); [nextjs.org/llms.txt](https://nextjs.org/llms.txt) [Official]
- Vercel: `https://vercel.com/llms.txt` indexes Markdown docs, `llms-full.txt`, an OpenAPI description, the MCP and the agent plugin (`npx plugins add vercel/vercel-plugin`). It instructs agents to "Ask for approval before changing account resources". Vercel docs pages serve `.md` and include "For AI agents" cross-link blocks — [vercel.com/llms.txt](https://vercel.com/llms.txt) [Official]
- The llms.txt convention is defined at [llmstxt.org](https://llmstxt.org/) (linked from the Next.js guide) [Official link; page not read]

### Inferences
- Rule hierarchy for framework docs: (1) docs bundled in `node_modules` (Next.js ≥16.2), (2) the vendor's `.md` or llms.txt pages for the pinned version, (3) Context7. Next.js's own guide says always-available local docs beat on-demand retrieval.
- Context7 is a third-party network dependency with rate limits and an API key. In CI or sandboxed agents it may be unavailable, so rules should not rely on it as the only source.

### Gaps
- Other llms.txt files checked this session:
  - **Neon** publishes [neon.com/llms.txt](https://neon.com/llms.txt) and a docs index at neon.com/docs/llms.txt.
  - **Drizzle** publishes [orm.drizzle.team/llms.txt](https://orm.drizzle.team/llms.txt).
  - **Prisma** publishes [prisma.io/docs/llms.txt](https://www.prisma.io/docs/llms.txt), which opens with "Prisma changes frequently — verify against the changelog and current docs before implementing". Prisma and Neon pages also serve `.md` versions.
  - **Astro** returned 404 at both docs.astro.build/llms.txt and astro.build/llms.txt on 2026-10-05, so the earlier claim that Astro docs publish llms.txt is **not confirmed**. Astro's official agent route is the Astro Docs MCP server.
  - Supabase was not checked (blocked).
- I found no independent evaluation of Context7's accuracy.
