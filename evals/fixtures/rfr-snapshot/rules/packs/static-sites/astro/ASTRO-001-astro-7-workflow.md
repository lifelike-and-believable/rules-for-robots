---
id: ASTRO-001
title: Work with Astro 7's agent-aware tooling
level: SHOULD
scope: pack:static-sites
paths: ["**/*.astro", "**/astro.config.*", "**/src/pages/**", "**/src/content/**"]
verified-by: [review]
targets-failure: stale-knowledge
observed-on: []
rationale: Astro 7 runs the dev server in the background for agents and publishes a docs MCP server, while training data mostly reflects older versions.
sources: ["practices/web-verification.md", "docs/research/notes/web_followup.md"]
---
This site uses Astro 7. Before starting a dev server, check `astro dev status`; read its output with `astro dev logs` instead of starting a second one. Look up Astro APIs with the Astro docs MCP server (`mcp.docs.astro.build/mcp`) or the installed package's types rather than memory.
