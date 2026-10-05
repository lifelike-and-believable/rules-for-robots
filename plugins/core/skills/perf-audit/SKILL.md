---
name: perf-audit
description: Measure a web page or app against Core Web Vitals and bundle budgets and identify the biggest wins. Use when the user asks for a performance audit, a Lighthouse check, or why a page is slow.
argument-hint: "<URL or route>"
---

# Performance audit (web)

1. **Measure.** Run Lighthouse at least three times against a production build or preview deployment (not the dev server) and take the median. For interaction latency, use a Lighthouse user flow or timespan over the main interaction, since a navigation run cannot measure INP.
2. **Compare** with the budgets: LCP 2.5 s, INP 200 ms, CLS 0.1, plus the project's size-limit budgets. Use field data (Vercel Speed Insights) when the project has it.
3. **Find causes.** Check the LCP element and how it loads, layout shifts and their sources, long tasks, JavaScript per route (`next experimental-analyze` with Turbopack, or the bundle analyzer with webpack), and slow data requests.
4. **Report** the measurements, the three changes with the largest expected gain, and how to verify each. Do not change code unless the user asks.

For Unreal plugins, use `/rfr-core:profile-unreal-plugin` instead.
