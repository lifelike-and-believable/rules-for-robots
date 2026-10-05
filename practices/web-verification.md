# Web verification for agents

Practice guide for the `web-platform`, `typescript`, and `react-nextjs` packs. It gives the checks behind the MUST rules and the configuration the template repos use. Sources: [web verification notes](../docs/research/notes/web_verification.md) and [web follow-up notes](../docs/research/notes/web_followup.md).

## Order of checks

Cheapest and most deterministic first. An agent's verify command runs the first four; CI runs all of them.

1. `tsc --noEmit` with `strict` (TS-001).
2. ESLint, including `@typescript-eslint/no-explicit-any` and `@typescript-eslint/ban-ts-comment` (TS-001).
3. Unit and component tests with Vitest (not for async Server Components; NEXT-004).
4. `next build` or `astro build` (NEXT-003).
5. Against the preview deployment: Playwright end-to-end tests, axe, Lighthouse CI, bundle budgets (WEB-001, WEB-003).
6. Security: gitleaks, Semgrep or CodeQL, `npm audit` (SEC-001).

## Accessibility with axe (WEB-001, WEB-002)

axe-core 4.13 has one WCAG 2.2 rule, `target-size`, and it is disabled by default. Enable it explicitly and assert that it ran:

```ts
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .options({ rules: { 'target-size': { enabled: true } } })
  .analyze();
expect(results.violations).toEqual([]);
expect([...results.passes, ...results.incomplete, ...results.inapplicable].some(r => r.id === 'target-size')).toBe(true);
```

Treat `incomplete` results as judgement calls for a person or a review agent. For criteria axe cannot test (2.4.11 focus not obscured, 2.5.7 dragging, 3.3.8 accessible authentication), write Playwright checks: tab through the page and assert each focused element's bounding box is not covered by fixed or sticky elements; perform each drag action through its click alternative; paste into credential fields.

## Performance (WEB-003)

- Thresholds: LCP 2.5 s, INP 200 ms, CLS 0.1, measured at the 75th percentile of real users. Lab tools approximate these.
- Lighthouse cannot measure INP during a page load; Total Blocking Time is a proxy. Use Lighthouse user flows or timespan mode for interactions.
- Run Lighthouse CI at least three times and assert on the median.
- Bundle budgets: `size-limit` with its GitHub action. With Turbopack, `next experimental-analyze --output` writes `.next/diagnostics/analyze` for before-and-after comparison; `@next/bundle-analyzer` works only with webpack.

## Testing against Vercel previews

Send `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET` as a header (and `x-vercel-set-bypass-cookie: true` for browser sessions), never as a query parameter. Environment variable changes apply only to new deployments, so redeploy before re-testing.

## Browser checks by agents (WEB-004)

The Playwright CLI uses about a quarter of the tokens of the Playwright MCP server per task (widely reported). Prefer accessibility snapshots to screenshots. For Next.js runtime inspection, `agent-browser` and the dev server's `/_next/mcp` endpoint (`get_compilation_issues`, `compile_route`) avoid a separate browser MCP.

## Next.js 16 facts agents get wrong (NEXT-001)

| Topic | Current behaviour |
|---|---|
| Request interception | `proxy.ts` (Node runtime); `middleware.ts` deprecated, still used for Edge |
| `fetch` caching | Uncached by default since Next.js 15 |
| `use cache` | Requires `cacheComponents: true` |
| Request APIs | `cookies()`, `headers()`, `params`, `searchParams` are async |
| Docs | Version-matched docs in `node_modules/next/dist/docs/` (16.2+); `next dev` maintains a `nextjs-agent-rules` block in `AGENTS.md` (16.3+); leave it alone |
| CSP | Nonce-based CSP forces dynamic rendering; use the experimental SRI option to keep pages static |
