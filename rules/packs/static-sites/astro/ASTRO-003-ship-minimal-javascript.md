---
id: ASTRO-003
title: Ship JavaScript only where a page needs interaction
level: SHOULD
scope: pack:static-sites
paths: ["**/*.astro", "**/astro.config.*", "**/src/pages/**", "**/src/content/**"]
verified-by: [review]
targets-failure: performance-regression
observed-on: []
rationale: Content sites are fastest as static HTML, and hydrating whole components by default undoes Astro's main advantage.
---
Render content as static HTML and CSS. Add a framework island only for interactive parts, and choose its `client:` directive deliberately (`client:visible` or `client:idle` before `client:load`). Optimize images with Astro's image components.
