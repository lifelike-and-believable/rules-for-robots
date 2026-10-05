# RFR Cooldowns

An Unreal Engine code plugin that tracks ability cooldowns per game instance, for Blueprint and C++ gameplay code. It is the rules-for-robots reference Unreal plugin.

## Commands

- Tier 1 checks (fast, no engine): `node ../../checks/unreal/tier1.mjs Plugins/RfrCooldowns --copyright "Lifelike & Believable Animation Design" --allow-missing-fab-url`
- Verify (run before reporting work as done, and include its output): `./Scripts/Verify.ps1 -EngineVersion <5.6|5.7|5.8> -PluginDir Plugins/RfrCooldowns -PluginName RfrCooldowns -TestFilter RfrCooldowns` for each supported version. It needs Windows and the engines; where they are not available, run Tier 1 and say that the Verify run is still owed.
- Engine source for API lookups: `C:\Program Files\Epic Games\UE_<version>\Engine\Source` on the build machine.

## Project decisions

- Supported engine versions: 5.6, 5.7, 5.8. Distributed on Fab.
- Include order in `*.Target.cs`: `EngineIncludeOrderVersion.Latest`.
- Copyright holders for source headers: Lifelike & Believable Animation Design.
- One runtime module, `RfrCooldowns`; no content.

Rules for this project are in `.claude/rules/`. Check unfamiliar engine APIs against the installed engine headers for each supported version.
