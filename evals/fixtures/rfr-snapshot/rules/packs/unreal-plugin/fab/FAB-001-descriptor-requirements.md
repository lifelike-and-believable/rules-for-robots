---
id: FAB-001
title: Keep the plugin descriptor Fab-ready
level: MUST
scope: pack:unreal-plugin
paths: ["**/*.uplugin"]
verified-by: [ci]
check: "ci: Tier 1 unreal check validates EngineVersion, FabURL, per-module platform lists, and plugin dependencies"
targets-failure: project-decision
observed-on: []
rationale: Fab rejects submissions whose descriptors miss these fields (Fab Technical Requirements 4.3.6.a to 4.3.6.d).
sources: ["practices/unreal-plugin-development.md", "docs/research/sources/fab-requirements.md"]
---
In the `.uplugin`, keep `EngineVersion` set to the engine version this copy targets (for example `"5.6.0"`), add `FabURL` once the product exists, give every module a `PlatformAllowList` or `PlatformDenyList` using UE5 platform names (`Win64`, `Mac`, `Linux`, `Android`, `IOS`), and depend only on plugins that ship with the engine.
