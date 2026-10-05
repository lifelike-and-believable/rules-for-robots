---
id: FAB-003
title: Keep the plugin folder ready to package
level: MUST
scope: pack:unreal-plugin
paths: ["**/*.uplugin", "**/*.Build.cs", "**/Config/**", "**/Resources/**"]
verified-by: [ci]
check: "ci: Tier 1 unreal check validates folder layout, path lengths, third-party placement, and file types"
targets-failure: project-decision
observed-on: []
rationale: Fab rejects packages with build output, executables, misplaced third-party code, or paths over 170 characters (4.3.7.3, 4.3.6.1.e).
sources: ["docs/research/sources/fab-requirements.md"]
---
Keep third-party code under `Source/ThirdParty` and record its licence. Do not add `.exe` or `.msi` files. Keep every path within the plugin folder at 170 characters or fewer, and use only English letters, digits, and underscores in folder and file names. If you add a folder other than `Source`, `Content`, `Resources`, or `Config` (such as `Docs`), list it in `Config/FilterPlugin.ini`.
