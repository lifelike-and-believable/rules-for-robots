---
id: UE-006
title: Set the current build settings version in target files
level: MUST
scope: pack:unreal-plugin
paths: ["**/*.Target.cs"]
verified-by: [ci]
check: "ci: Tier 1 unreal check requires BuildSettingsVersion.V6 in Target.cs files"
targets-failure: stale-knowledge
observed-on: []
rationale: Unreal 5.7 and later require BuildSettingsVersion.V6 in every Target.cs, and example projects generated from older templates fail to build.
sources: ["docs/research/notes/unreal_followup.md"]
---
In every `*.Target.cs` (for example in the example project), set `DefaultBuildSettings = BuildSettingsVersion.V6;` and `IncludeOrderVersion = EngineIncludeOrderVersion.Latest;`.
