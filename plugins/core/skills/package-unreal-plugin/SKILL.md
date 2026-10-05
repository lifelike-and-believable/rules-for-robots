---
name: package-unreal-plugin
description: Build Fab-ready packages of an Unreal plugin for each supported engine version and run the Fab checks. Use only when the user asks to package the plugin or prepare a Fab submission.
disable-model-invocation: true
argument-hint: "[engine versions]"
---

# Package an Unreal plugin for Fab

1. **Versions.** Use the engine versions in `$ARGUMENTS` or AGENTS.md. Fab needs a separate package per version, and builds the three latest versions by default.
2. **Tier 1.** Run `checks/unreal/tier1.mjs` from rules-for-robots on the plugin with the publisher's copyright and without `--allow-missing-fab-url`. Fix or report every error before continuing.
3. **For each version:** copy the plugin to a staging folder outside the engine and project, set `EngineVersion` to `<version>.0`, and run `RunUAT.bat BuildPlugin -Plugin=<staged .uplugin> -Package=<out>/<version>/<Name> -Rocket` with that version's engine. Fail on any compiler warning.
4. **Check each package**: no `Binaries`, `Intermediate`, or `Saved` folders in what you will zip; `Config/FilterPlugin.ini` lists any extra folders; paths are 170 characters or fewer.
5. **Zip** each package's plugin folder (one plugin per zip) and report the zip paths, the build output summary, and the remaining manual steps: upload, `FabURL`, documentation link, example project link, and third-party declaration.
