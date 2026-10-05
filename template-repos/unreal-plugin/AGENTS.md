# <Plugin name>

<One or two sentences: what the plugin does and who uses it in the editor.>

## Commands

- Tier 1 checks (fast, no engine): `node <path-to-rules-for-robots>/checks/unreal/tier1.mjs <PluginDir> --copyright "<publisher name>"` (repeat `--copyright` for each additional holder)
- Verify (run before reporting work as done, and include its output): `./Scripts/Verify.ps1 -EngineVersion <5.6|5.7|5.8> -PluginDir Plugins/<Name> -PluginName <Name> -TestFilter <Name>` for each supported version
- Engine source for API lookups: `<path to each installed engine's Engine/Source>`

## Project decisions

<!-- List only choices an agent cannot infer from the code. Delete this comment when done. -->
- Supported engine versions: 5.6, 5.7, 5.8. Distributed on Fab.
- Copyright holders for source headers: <publisher name> (list any upstream holders whose code the plugin includes).

Rules for this project are in `.claude/rules/`. Check unfamiliar engine APIs against the installed engine headers for each supported version.
