---
id: ASTRO-002
title: Verify content security policy on a production build
level: SHOULD
scope: pack:static-sites
paths: ["**/astro.config.*", "**/*.astro"]
verified-by: [review]
targets-failure: security-regression
observed-on: []
rationale: Astro's hash-based CSP is not enforced by astro dev, so CSP breakage only shows in a build.
sources: ["docs/research/notes/web_followup.md"]
---
After changing scripts, styles, or `security.csp` settings, run `astro build` and `astro preview`, load the affected pages, and check the browser console for CSP violations.
