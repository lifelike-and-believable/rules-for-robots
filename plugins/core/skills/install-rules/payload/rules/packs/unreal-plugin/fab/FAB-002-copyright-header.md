---
id: FAB-002
title: Start every source file with the publisher's copyright notice
level: MUST
scope: pack:unreal-plugin
paths: ["**/*.h", "**/*.cpp", "**/*.inl", "**/*.cs"]
verified-by: [ci]
check: "ci: Tier 1 unreal check requires the copyright line in every source file"
targets-failure: convention-drift
observed-on: []
rationale: Fab requires a commented copyright notice with the publisher's name and year in every source and header file, not Epic's default text (4.3.6.1.b).
sources: ["practices/unreal-plugin-development.md", "docs/research/sources/fab-requirements.md"]
---
Begin every `.h`, `.cpp`, `.inl`, and `.cs` file with a copyright line naming a holder listed in AGENTS.md, as a `//` comment on the first line. New files get the publisher's line. Replace Epic's default "Fill out your copyright notice" text wherever you find it. Leave third-party code under a `ThirdParty` folder with its authors' notices.
