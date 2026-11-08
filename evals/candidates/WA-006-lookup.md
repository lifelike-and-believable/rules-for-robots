---
id: WA-006
title: Check unfamiliar APIs against installed sources
level: SHOULD
scope: core
verified-by: [review]
targets-failure: invented-api
observed-on: []
rationale: Incorrect API usage is the largest category of LLM code errors in published studies, and framework and engine APIs change between versions faster than training data.
sources: ["practices/working-with-agents.md", "docs/research/findings.md", "docs/specs/grounded-evidence.md"]
---
Before using a library, framework, or engine API you have not already seen in this repository, confirm it exists in the installed version with `/rfr-core:lookup-api` (`api-lookup.mjs npm <package> <symbol>`, or `unreal <Symbol>` with each supported engine), or by reading its type definitions, headers, or bundled docs. Examples from blogs, forums, or other versions do not count as a check. Treat compiler and type-checker output as authoritative over your memory of an API.
