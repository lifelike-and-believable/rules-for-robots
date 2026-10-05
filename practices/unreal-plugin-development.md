# Unreal plugin development with agents

Practice guide for the `unreal-plugin` pack (rules `UE-*` and `FAB-*`). It covers the verification loop an agent can run without the editor UI, multi-version support, and the Fab release flow. Sources: [findings](../docs/research/findings.md), [Unreal follow-up notes](../docs/research/notes/unreal_followup.md), and [Fab requirements](../docs/research/sources/fab-requirements.md).

## The verification loop

Fastest first. An agent should stop at the first level that proves the change.

| Step | Command (Windows; adjust paths) | Proves |
|---|---|---|
| Tier 1 checks | `node checks/unreal/tier1.mjs <PluginDir> --copyright "<holder>"` (repeat `--copyright` for each holder) | Descriptor, layout, copyright, `TObjectPtr`/`UPROPERTY` (UE-002, UE-005, FAB-001 to FAB-003) |
| Compile and package | `"<Engine>\Build\BatchFiles\RunUAT.bat" BuildPlugin -Plugin="<Path>\<Name>.uplugin" -Package="<OutDir>" -Rocket` | The plugin builds as Fab will build it (UE-001, FAB-004) |
| Low-Level Tests | Build and run the plugin's LLT target from its `Tests` folder | Pure logic (UE-007) |
| Automation tests | `"<Engine>\Binaries\Win64\UnrealEditor-Cmd.exe" "<Host>.uproject" -ExecCmds="Automation RunTests <Filter>;Quit" -unattended -nullrhi -nosound -ReportExportPath="<OutDir>"` | UObject and engine behaviour (UE-007) |

Notes:

- `-Package` must point outside the plugin, engine, and project folders. Fab documents only `-Plugin`, `-Package`, and `-Rocket`. Other flags, including whether `-StrictIncludes` is the default, are defined in `Engine/Source/Programs/AutomationTool/Scripts/BuildPlugin.Automation.cs`, which Launcher-installed engines do not ship; use the documented flags, or read that file in a source build, rather than relying on memory (R55).
- Decide pass or fail from `<OutDir>/index.json` (`failed` and `notRun` must be 0) or the log line `**** TEST COMPLETE. EXIT CODE: <n> ****`. On UE 5.6 to 5.8 the editor exits with 0 when all tests pass and 255 when a test fails (the log line reads `EXIT CODE: -1`), but this is not documented, so gate on the report.
- In Automation Specs, create objects with the outer their class requires. A game-instance subsystem has `ClassWithin` `UGameInstance`, so `NewObject<UMySubsystem>()` in the transient package raises an ensure ("created in invalid Outer") that fails the first test to hit it, while later tests pass with a warning. Create a transient `UGameInstance` and use it as the outer. This one-pass, one-fail pattern points to an ensure, which fires once per session.
- End every `-ExecCmds` string with `Quit`. Exit conditions such as the test queue finishing apply only to `Automation RunTests`; any other command leaves the editor running and the script hanging. Run long editor jobs in the background with a timeout, and check that the process has exited.
- Data validation results (`IsDataValid`) default to `NotValidated`. Treat that as "not checked", not as a pass, when a check gates on the result.
- To test a packaged plugin, copy the `-Package` output into a host project's `Plugins/` folder. A content-only host `.uproject` that enables the plugin is enough.
- Generate `compile_commands.json` for clangd once with `UnrealBuildTool -mode=GenerateClangDatabase` after a first build, not in the inner loop.

## Live Coding versus full builds

Live Coding patches function bodies in `.cpp` files only. Any change to a header, a reflection macro (`UCLASS`, `USTRUCT`, `UPROPERTY`, `UFUNCTION`), a `.Build.cs`, a `.Target.cs`, or the `.uplugin` needs the editor closed and a full build (UE-004). Agents cannot see the editor, so they should default to full command-line builds.

## Supporting several engine versions

- Fab needs one package per engine version, each with its own `EngineVersion` (FAB-001). Epic builds against the three latest versions by default.
- Build and test against every supported version in CI (Tier 2). Keep the toolchain matched per version:

| Engine | Visual Studio | MSVC |
|---|---|---|
| 5.6 | 2022 17.8 or later | 14.38 or later |
| 5.7 | 2022 17.14 or later | 14.44 (14.50 unsupported) |
| 5.8 | 2026 recommended | 14.50 recommended, 14.38 minimum |

- Target files need `DefaultBuildSettings = BuildSettingsVersion.V6` on 5.7 and later (UE-006, checked by Tier 1). The include order is a project decision recorded in AGENTS.md: `EngineIncludeOrderVersion.Latest` for a plugin built against several versions, or a pinned version such as `Unreal5_7` for a project on one engine.
- Guard newer APIs with `ENGINE_MAJOR_VERSION` / `ENGINE_MINOR_VERSION` checks or a small wrapper (UE-001). Examples that differ across 5.6 to 5.8: `UE_LOGF` and `UE_PLATFORM_*` macros (5.8), `FCoreDelegates::OnPostEngineInit` (deprecated in 5.8), and APIs deprecated in 5.0 to 5.6 that 5.8 removed.

## Shared build machines

Other projects and other agent sessions may build on the same machine, and distributed build tools such as Incredibuild (XGE) are a shared, limited resource.

- Before an engine build, check for running builds (`xgConsole`, `AutomationTool`, `UnrealBuildTool`, `dotnet UnrealBuildTool.dll`). If one is running, wait and say so. Never stop another project's build.
- "Maximum number of concurrent builds reached", or `OtherCompilationError` with no compiler errors in the log, means the machine is busy, not that the code is wrong. Wait, or retry once with `-NoXGE`; do not change code to "fix" it.
- Use a separate git worktree for each parallel branch rather than switching branches under a running build.

## Giving agents engine context

- Point the agent at the installed engine's `Source/` folder for each supported version and ask it to grep declarations before using an API (UE-001).
- Epic's Claude Code plugin and the editor MCP server exist for UE 5.8 only. Treat them as optional for 5.8 projects: commit before long sessions, never share one editor MCP between agents, and remember the MCP server has no authentication and can run Python. Its calls run one at a time on the editor's game thread: call it serially, keep query limits small (100 results or fewer), and if a call times out or the connection closes, stop the batch, check the connection once, and report the partial results.

## Fab release checklist

1. Tier 1 passes with `FabURL` set.
2. Tier 2 builds every supported version with zero warnings and all automation tests passing.
3. Each version's package has the right `EngineVersion`, no `Binaries`/`Intermediate`/`Saved`, and `FilterPlugin.ini` lists any extra folders.
4. English documentation is available, and the example project references the plugin without containing it.
5. Third-party software is declared on the listing.
