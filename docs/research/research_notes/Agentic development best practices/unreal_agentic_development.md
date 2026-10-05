# Agentic (AI coding agent) development of Unreal Engine 5.6+ plugins: pitfalls, verification, best practices

Research date: 2026-10-05. Research-environment caveat: the egress proxy blocked direct fetches of dev.epicgames.com, support.fab.com, ludusengine.com, sharkpillow.com and zuqqhi2.com. Claims attributed to those domains come from search-result snippets only, not full-page reads, and should be re-verified before they are treated as authoritative. Evidence levels used: **Official** (Epic, GitHub or Microsoft docs, or an Epic-owned repo), **Widely reported** (several independent community sources agree), **Single source** (one blog, forum post or vendor).

## 1. Known pitfalls for LLM agents in Unreal C++

### Takeaway
The main failure modes are: hallucinated or version-mismatched APIs; UObject lifetime mistakes, where a UObject* is not tracked by GC because it lacks UPROPERTY; header and reflection changes that cannot be hot-patched; and blindness to binary .uasset content such as Blueprints. Long build times make each failed guess expensive. Agents need a compiler-in-the-loop workflow plus engine-source grounding, not memory.

### Cited Findings
- General LLM code-generation research: 31.67% of erroneous code in a six-LLM study came directly from incorrect API usage ("API hallucinations"). "Knowledge-conflicting hallucinations", such as non-existent API parameters, are subtle, get past linters and fail at runtime. This research is not Unreal-specific but applies directly to UE's very large, version-churning API. — [arXiv 2601.19106](https://arxiv.org/pdf/2601.19106); [arXiv 2508.11257 (automotive case study)](https://arxiv.org/html/2508.11257v1) (Single source each; academic)
- GC semantics: a `TObjectPtr` marked `UPROPERTY` is a strong reference that stops GC from destroying the target. A UObject reference held in a raw pointer is unknown to the engine, is not nulled automatically and does not prevent GC. — [Epic: Object Pointers in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/object-pointers-in-unreal-engine); [Epic: Unreal Object Handling](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-object-handling-in-unreal-engine) (Official, via search snippet)
- Tooling gap that matters for agents relying on IDE inspections: Rider warns about a UObject member that lacks `UPROPERTY()` only for raw pointers, not for `TObjectPtr` members. A missing UPROPERTY on a TObjectPtr can therefore pass static inspection silently. — [JetBrains YouTrack RIDER-88103](https://youtrack.jetbrains.com/issue/RIDER-88103) (Single source, vendor bug tracker)
- Binary assets: Claude cannot read Blueprints out of the box because they are serialized .uasset binaries. Without a bridge (MCP/editor plugin), it is "working blind on half your project". — [LudusEngine: Claude Code for Unreal Engine](https://ludusengine.com/blog/claude-code-for-unreal-engine) (Single source; snippet only)
- Header and layout changes: Live Coding handles .cpp logic changes. Changing USTRUCT size, changing a UCLASS base class, or removing or retyping a UPROPERTY is unsafe and needs an editor restart. Adding a UPROPERTY or UFUNCTION is experimentally supported from 5.4 but needs a restart before it appears in Blueprints. — [mrSutivu UE5 C++ Expert Skills: hot-reload-vs-live-coding](https://github.com/mrSutivu/Unreal-Engine-5-C-Expert-Skills/blob/main/skills/unreal-engine-5/hot-reload-vs-live-coding.md); [Bugnet: stale hot-reload changes](https://bugnet.io/blog/how-to-fix-unreal-hot-reload-stale-cpp-changes) (Widely reported in the community)
- Toolchain churn as a source of "it compiled for the model, not for me" errors. For UE 5.7, community guidance is VS 2022 17.8+ (17.14 recommended), MSVC 14.44.35214, Windows SDK 10.0.22621.0+. One snippet says minimum MSVC 14.38 and recommended 14.50. Microsoft has removed the VS2022/MSVC 14.38 download channels, so new machines get VS2026 with v143 (14.44) build tools installed through the VS2026 installer. — [Epic forum: UE 5.7 and VS 2026](https://forums.unrealengine.com/t/unreal-engine-5-7-and-visual-studio-2026/2674488); [Epic forum: configure VS for UE 5.7](https://forums.unrealengine.com/t/how-to-configure-visual-studio-for-ue-5-7/2678731); [Epic: Hardware & Software Specifications](https://dev.epicgames.com/documentation/unreal-engine/hardware-and-software-specifications-for-unreal-engine) (Mixed: official spec page plus forum; exact numbers conflict between snippets, so verify on the spec page)

### Inferences
- Because 5.6, 5.7 and 5.8 each deprecate and rename APIs, an agent should check every unfamiliar symbol against the installed engine headers (grep `Engine/Source`) before using it, and treat compile errors as ground truth over its own recall.
- The project should require `UPROPERTY()` on all UObject-derived members (`TObjectPtr<>` in headers per UE5 convention), because neither the compiler nor Rider will reliably flag the omission. A reviewer or lint step (e.g. a grep for `TObjectPtr<` lines not preceded by `UPROPERTY`) is a cheap guard.
- Changes to headers, reflection macros or Build.cs should always trigger a full UBT build with the editor closed, never Live Coding.

### Gaps
- No authoritative, fetched list of UE 5.6 and 5.7 C++ API deprecations: the release-notes pages were blocked. The writer should point readers to the "Upgrade Notes / API Changes" sections of the [5.7 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-6-release-notes?application_version=5.7) and [5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes).
- No sourced, agent-specific data on Build.cs dependency errors, IWYU or include-order mistakes, or editor/runtime module separation. These are well known from general UE practice but uncited here.

## 2. Command-line verification loops an agent can run

### Takeaway
A complete headless loop is possible on Windows: UBT/Build.bat for compile, `RunUAT BuildPlugin` for a packaging-grade clean build, `UnrealEditor-Cmd ... -ExecCmds="Automation RunTests <filter>;Quit" -nullrhi -unattended -ReportExportPath=...` for tests, and `-trace=` plus UnrealInsights `-NoUI -AutoQuit` for profiling. The key gotcha is that the editor's exit code does not reliably reflect test failures, so the agent must parse `index.json`.

### Cited Findings
- Typical headless test invocation: `-execcmds="Automation RunTests ..."`, `-unattended`, `-NOSPLASH`, `-NullRHI` (disables rendering, so it works without a GPU or in containers), `-TestExit="Automation Test Queue Empty"`. — [Filipe Freire: An Unreal CI Quest](https://filfreire.com/posts/unreal-gh-actions); [unrealcontainers.com CI](https://unrealcontainers.com/docs/use-cases/continuous-integration); [Epic: Run Automation Tests](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine) (Widely reported plus Official)
- Reporting: `-ReportExportPath=<dir>` writes JSON (index.json) and HTML with every event, per-test durations and device details. **The process exit status can be EXIT_SUCCESS even when a test fails, so index.json must be parsed.** There is a known forum issue where index.html is empty with ReportOutputPath. — [ibbles/LearningUnrealEngine: Unit tests notes](https://github.com/ibbles/LearningUnrealEngine/blob/master/Unit%20tests%20source%20notes.md); [Epic forum: index.html empty](https://forums.unrealengine.com/t/index-html-empty-when-running-automation-tests-and-exporting-them-using-reportoutputpath/471990); [Epic: Review Test Results](https://dev.epicgames.com/documentation/en-us/unreal-engine/review-test-results-in-unreal-engine) (Widely reported)
- Low-Level Tests (LLT) are Catch2-based standalone test executables, with console and xml reporters being the common outputs. They are an option for fast, engine-light unit tests without booting the editor. — [Epic: Types of Low-Level Tests](https://dev.epicgames.com/documentation/en-us/unreal-engine/types-of-low-level-tests-in-unreal-engine); [Epic: Build and Run LLTs](https://dev.epicgames.com/documentation/unreal-engine/build-and-run-low-level-tests-in-unreal-engine) (Official, snippet)
- Automation Spec (BDD-style `Describe/It`) is a documented, practitioner-recommended way to structure UE5 tests. — [Minifloppy: Automated Testing With Specs in UE5](https://minifloppy.it/posts/2024/automated-testing-specs-ue5/) (Single source)
- `RunUAT BuildPlugin -Plugin=<.uplugin> -Package=<out>`: `-Package` must be a new location outside the plugin, engine and project. `-TargetPlatforms` defaults to Win64. `-StrictIncludes` defaults to true, which catches missing includes that unity builds hide. `-Unversioned` skips stamping the engine version. — [Sector9Ltd/UE5-Build-Plugin](https://github.com/Sector9Ltd/UE5-Build-Plugin); [ikrima Gamedev Guide: build binary-only plugin](https://ikrima.dev/ue4guide/build-guide/utilities/build-binary-only-plugin-distribution/) (Widely reported)
- Unreal Insights from the CLI: run the editor or game with `-trace=cpu,gpu,frame` (plus `-tracefile=<path>.utrace`). Running automation with tracing writes a .utrace under `<Project>/Saved/TraceSessions`. Analysis can be automated with `UnrealInsights.exe -OpenTraceFile=file.utrace -ABSLOG=cmd.log -AutoQuit -NoUI`. Epic has a knowledge-base article on automated trace analysis and CSV export. — [Epic: Unreal Insights Reference (UE5)](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-reference-in-unreal-engine-5); [Daniel Xiong: Profiling automation with Insights](https://danielsxiong.medium.com/ue4-performance-profiling-automation-with-unreal-insights-eaabfacf22a7); [Epic forum KB: Automated Trace Analysis & CSV export](https://forums.unrealengine.com/t/knowledge-base-unreal-insights-automated-trace-analysis-and-csv-export/1882278) (Official plus community)
- UE 5.8's MCP plugin exposes "running automation tests" as an MCP tool. A practitioner write-up used UE 5.8 MCP with Codex to build a Blueprint game verified by Functional Tests. — [Cryptobriefing: UE 5.8 MCP](https://cryptobriefing.com/unreal-engine-5-8-mcp-server-support/); [zuqqhi2 Tech Memo](https://zuqqhi2.com/en/https-zuqqhi2-com-unreal-engine-mcp-codex-blueprint-en) (Single sources; snippet only)

### Inferences
- A recommended agent loop:
  1. Build Editor target via `Engine\Build\BatchFiles\Build.bat <Proj>Editor Win64 Development -Project=<.uproject> -WaitMutex`.
  2. Run targeted tests with `-ExecCmds="Automation RunTests <Plugin>.;Quit" -nullrhi -unattended -nosplash -nop4 -ReportExportPath=...`.
  3. Parse index.json for failures and scan the log for `Error:` and `Ensure`.
  4. Before merge, run `RunUAT BuildPlugin` (StrictIncludes, non-unity) for each supported engine version.
- Run LLT/Catch2 for pure logic, Automation Spec for UObject-level tests and Functional Tests (map-based) for gameplay. Run them in that order to keep the agent's inner loop fast.

### Gaps
- Gauntlet: no sourced material was retrieved for this session.
- Exact UE 5.6+ cook command lines (`RunUAT BuildCookRun`) for plugin smoke tests were not retrieved.

## 3. Live Coding vs full builds; Hot Reload hazards

### Takeaway
Agents should default to full UBT builds with the editor closed. Live Coding is only safe for .cpp body edits, and legacy Hot Reload is known to apply stale changes and corrupt Blueprint-referenced classes.

### Cited Findings
- Live Coding handles function-body changes. Header and memory-layout changes (struct size, base class, constructor init lists, removing or retyping a UPROPERTY) need a restart. The general recommendation is: change headers or members, then close the editor and do a full build. — [mrSutivu skills: hot-reload-vs-live-coding](https://github.com/mrSutivu/Unreal-Engine-5-C-Expert-Skills/blob/main/skills/unreal-engine-5/hot-reload-vs-live-coding.md); [Unreal Community Wiki: Live Compiling](https://unrealcommunity.wiki/6100e80a9c9d1a89e0c2eaac); [pome.cc: Hot reload and Live Coding in UE5](https://www.pome.cc/en/tips/livecoding/) (Widely reported)
- Hot Reload can apply stale C++ changes. — [Bugnet](https://bugnet.io/blog/how-to-fix-unreal-hot-reload-stale-cpp-changes) (Single source)
- A commercial "Claude Assistant" plugin shows a Live Coding agent loop: it writes the file, triggers Live Coding, captures compile errors and returns them to Claude, with up to 3 retries before asking a human. — [search snippet aggregated from Claude Code/UE plugin pages, e.g. mcpmarket UnrealClaude](https://mcpmarket.com/server/unrealclaude) (Single source; vendor)

### Inferences
- An agent cannot reliably tell whether a given edit is "Live-Coding-safe". The simplest rule for CLAUDE.md is: any .h/.Build.cs/.uplugin change, or any change to reflection macros, needs the editor closed and a full build. Also, when Live Coding is active, UBT refuses external builds, so the agent must close the editor or press Ctrl+Alt+F11 first (based on general UE knowledge; not sourced this session).

### Gaps
- No official Epic statement fetched on Live Coding reflection support in 5.6/5.7.

## 4. Tooling that gives agents engine context

### Takeaway
As of October 2026 there are three layers: (a) Epic's own experimental **Model Context Protocol plugin (UE 5.8)** plus an Epic-published **Claude Code plugin** (`unreal-engine-skills-for-claude-code`) that drives it; (b) the UE 5.7 in-editor AI Assistant; (c) community MCP servers and clangd via `-mode=GenerateClangDatabase`. Engine-source grep remains the most reliable grounding for APIs.

### Cited Findings
- **Epic official Claude Code plugin**: GitHub `EpicGames/unreal-engine-skills-for-claude-code-plugin`. Its single skill, `unreal-mcp`, drives the editor over MCP with "hundreds of tools across 30+ toolsets". Install with `/plugin install unreal-engine-skills-for-claude-code@claude-plugins-official`. To start the server, run console command `ModelContextProtocol.StartServer` in the editor, then check the Output Log and `/mcp`. It needs bash on PATH (Git Bash/WSL on Windows). Security warnings from the repo: localhost is not a trust boundary; `ProgrammaticToolset.execute_tool_script` runs arbitrary Python with full editor access; avoid `--dangerously-skip-permissions`; commit or shelve before long MCP sessions. — [GitHub: EpicGames/unreal-engine-skills-for-claude-code-plugin](https://github.com/EpicGames/unreal-engine-skills-for-claude-code-plugin) (Official; fetched)
- **UE 5.8 experimental MCP plugin**: it embeds a local MCP server in the editor over HTTP. Tools cover Blueprints, assets, levels, materials, meshes, Slate widget inspection and running automation tests. Enable via Edit > Plugins > "Model Context Protocol", then restart. It was announced around State of Unreal 2026. — [Epic: UE 5.8 Release Notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes) (Official; snippet only); [Cryptobriefing](https://cryptobriefing.com/unreal-engine-5-8-mcp-server-support/); [StraySpark: Epic's official MCP plugin vs third-party](https://www.strayspark.studio/blog/epic-official-mcp-plugin-ue5-8-vs-third-party); [LudusEngine: UE 5.8 MCP setup](https://ludusengine.com/blog/unreal-mcp-plugin-ue5-8-setup) (Widely reported)
- **UE 5.7 in-editor AI Assistant**: a slide-out panel for asking questions, generating C++ and step-by-step guidance. — [Unreal Engine: UE 5.7 is now available](https://www.unrealengine.com/news/unreal-engine-5-7-is-now-available) (Official; snippet). One third-party blog claims it can use your own Claude or GPT key and reads Blueprints and headers. That claim is unverified and conflicts with other sources saying 5.7 does not ship an assistant that writes Blueprints/C++ for you. — [StraySpark: UE 5.7 AI Assistant vs MCP](https://www.strayspark.studio/blog/ue57-ai-assistant-vs-mcp-comparison) vs [LudusEngine: Does UE have a built-in AI assistant](https://ludusengine.com/blog/unreal-engine-built-in-ai-assistant) (Conflicting; treat details as unverified)
- Community MCP and bridge projects: IvanMurzak/Unreal-MCP (C++ editor plugin plus .NET bridge, `unreal-cli`); UnrealClaude (a chat panel in UE 5.7); CLAUDIUS (JSON-command control of UE5). A Puget Systems hands-on (July 2026) tested AI inside the editor via MCP. — [GitHub: IvanMurzak/Unreal-MCP](https://github.com/IvanMurzak/Unreal-MCP); [mcpmarket: UnrealClaude](https://mcpmarket.com/server/unrealclaude); [claudiuscode.com](https://claudiuscode.com/); [Puget Systems](https://www.pugetsystems.com/blog/2026/07/09/unreal-engine-mcp-hands-on-testing-ai-inside-the-editor/) (Single sources)
- **clangd / compile_commands.json**: `UnrealBuildTool.exe -mode=GenerateClangDatabase -project="<.uproject>" -game -engine <Target> Development Win64` writes compile_commands.json at the engine root, so move or symlink it to the project root. It is not incremental: it regenerates the whole file and is slow. Compile once first, or clangd will report missing `.generated.h` headers. — [uetools README](https://github.com/tiagodsp/uetools/blob/develop/README.md); [Epic forum: GenerateClangDatabase not incremental](https://forums.unrealengine.com/t/ubt-generateclangdatabase-is-not-incremental-and-recreates-whole-compile-commands-json-each-time/2005308); [UnrealEngine.nvim](https://github.com/mbwilding/UnrealEngine.nvim) (Widely reported)
- Practitioner setup: JetBrains Rider plus Claude Code is a reported workflow. — [sharkpillow: Rider + Claude Code](https://sharkpillow.com/post/rider-claude/) (Single source; page blocked, so no details extracted)

### Inferences
- For plugin C++ work, editor-driving MCP matters less than (1) local engine source to grep, (2) clangd diagnostics and (3) a fast UBT loop. MCP becomes valuable for asset and Blueprint-side verification and for running automation tests inside a live editor.
- Because Epic's MCP exposes arbitrary Python execution, an agent should run it only on a dev machine and never on a CI runner that holds secrets.

### Gaps
- No "docs for LLMs" (llms.txt-style) offering from Epic was found.
- Whether Epic's MCP plugin is available in 5.6 or 5.7 (backport) was not confirmed. Sources indicate 5.8 only.

## 5. Plugin best practices (.uplugin, modules, Fab, multi-version, Blueprint API, coding standard)

### Takeaway
Fab-ready code plugins need correct per-module platform allow/deny lists and must build cleanly against each engine version they claim. Epic builds against a recent set of engine versions, and community pipelines automate validate, BuildPlugin, package and revalidate.

### Cited Findings
- Fab code-plugin requirement: each module in the .uplugin must have a `PlatformAllowList` or `PlatformDenyList`. — [Fab Plugin Compilation Environment](https://support.fab.com/s/article/Fab-Plugin-Compilation-Environment?language=en_US) (Official; snippet only)
- Engine-version support: Epic will build plugins only against the three latest major engine versions, per the guidelines. A forum report says Fab listings are not strictly locked to the latest 3, and older versions back to 4.27 are supported. — [Epic forum: code plugin distribution on Fab](https://forums.unrealengine.com/t/unreal-engine-code-plugin-distribution-on-fab/2025967) (Conflicting; single forum thread)
- Community release pipelines for Fab: `metyatech/fab-plugin-release-tools` (Windows PowerShell 7.4+, Git, matching UE install with UAT; validate, build, package, revalidate); `MuddyTerrain/unreal-ci-cd-for-fab` (local CI/CD for Fab, MIT). — [GitHub: metyatech/fab-plugin-release-tools](https://github.com/metyatech/fab-plugin-release-tools); [GitHub: MuddyTerrain/unreal-ci-cd-for-fab](https://github.com/MuddyTerrain/unreal-ci-cd-for-fab) (Single sources)
- A plugin whose `EngineVersion` is set to another version won't package with the game even if it compiles. Use `-Unversioned` or update the field per target version. — [aliquodigitalportfolio devblog](https://devblog.aliquodigitalportfolio.com/2020/06/changing-ue4-plugin-engine-version.html); [Sector9Ltd/UE5-Build-Plugin](https://github.com/Sector9Ltd/UE5-Build-Plugin) (Widely reported; older sources)
- Fab publishing docs: [Epic: Publishing Assets for Sale or Free Download in Fab](https://dev.epicgames.com/documentation/fab/publishing-assets-for-sale-or-free-download-in-fab) (Official; not fetched)

### Inferences
- For multi-version support, use per-version build matrix jobs with `#if UE_VERSION_NEWER_THAN(5,6,0)` style guards from `Misc/EngineVersionComparison.h`. Ship per-version packages, because Fab distributes binaries per engine version. (UE_VERSION macros come from general knowledge; not sourced here.)
- Keep editor-only code in a separate `Type: "Editor"` module so runtime packaging (BuildPlugin with game targets) does not pull in UnrealEd. Fab builds will catch this.

### Gaps
- Could not fetch the current (2026) Fab Technical Requirements page or the Epic Coding Standard page, because both domains were blocked. Specifics such as required .uplugin fields (FabURL/MarketplaceURL, SupportURL), loading phases, Blueprint API naming guidelines, subsystem guidance and replication guidance are unsourced in these notes. The writer should cite [Epic Coding Standard](https://dev.epicgames.com/documentation/en-us/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine) and the Fab guidelines directly, or mark them as unverified.

## 6. CI on self-hosted Windows x64 GitHub Actions runners

### Takeaway
UE CI practically requires self-hosted runners because of engine size. GitHub's official guidance is that self-hosted runners should almost never be attached to public repositories, because fork PRs can get persistent code execution on the machine.

### Cited Findings
- GitHub: self-hosted runners are not guaranteed to be ephemeral or clean and "can be persistently compromised by untrusted code in a workflow". They "should almost never be used for public repositories" because any user can open a PR. GitHub recommends using them only with private repos. — [GitHub Docs: Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) (Official)
- Attack research: compromised runners give access to the internal network, can watch later jobs and can steal secrets or higher-privilege `GITHUB_TOKEN`s. Threat actors have used self-hosted runners as backdoors. — [Synacktiv: GH Actions exploitation, self-hosted runners](https://www.synacktiv.com/en/publications/github-actions-exploitation-self-hosted-runners); [Sysdig](https://www.sysdig.com/blog/how-threat-actors-are-using-self-hosted-github-actions-runners-as-backdoors) (Widely reported)
- Why self-hosted: GitHub-hosted runner storage is too small for UE prerequisites and engine installs. — [Filipe Freire: An Unreal CI Quest](https://filfreire.com/posts/unreal-gh-actions) (Single source)
- Example workflows and actions: Sector9Ltd/UE5-Build-Plugin (a GitHub Action wrapping RunUAT BuildPlugin); a forum thread on Unreal tests in GitHub Actions with Test Reporter; unrealcontainers.com CI patterns (Windows/Linux containers, `-nullrhi`). — [Sector9Ltd/UE5-Build-Plugin](https://github.com/Sector9Ltd/UE5-Build-Plugin); [Epic forum: Unreal Tests on GitHub Actions with Test Reporter](https://forums.unrealengine.com/t/unreal-tests-on-github-actions-with-test-reporter/2763115); [unrealcontainers.com](https://unrealcontainers.com/docs/use-cases/continuous-integration) (Community)

### Inferences
- For a public plugin repo, do not trigger the self-hosted runner on `pull_request` from forks. Options include: require approval for all outside contributors; use `workflow_dispatch` or a label-gated job run by maintainers; or keep the self-hosted runner on a private mirror. Run the runner as a low-privilege local user, use an ephemeral `--ephemeral` runner or a VM snapshot reset, and keep no secrets on the box.
- Engine version matrix: one runner label per installed engine (e.g. `ue-5.6`, `ue-5.7`, `ue-5.8`), and `RunUAT BuildPlugin` against each. Cache DerivedDataCache and the plugin's Intermediate on the runner's local disk. Engine installs live on the runner, not in actions/cache.
- Treat the test-runner exit code as untrustworthy: parse index.json and fail the job on any failed test or on `Error:` lines.

### Gaps
- No vetted, complete 2026 example workflow YAML for UE 5.6+ on self-hosted Windows was retrieved. DDC/Zen shared cache configuration for CI was not researched.

## 7. Practitioner reports (Claude Code / Cursor / Copilot / Codex with Unreal)

### Takeaway
Reports are mostly from blogs and vendors rather than rigorous studies. They agree that agents are strong at C++, weak at Blueprints and assets without an editor bridge, and most effective with a tight compile/feedback loop. Epic itself now ships Claude Code integration.

### Cited Findings
- Claude Code is described as "a strong coding agent for Unreal Engine, especially at C++", and can drive the editor through MCP plugins exposing 20+ tools. — [pixelsdesign: Claude Code for UE5 setup & cost guide (2026)](https://www.pixelsdesign.it/blog/claude-code-for-unreal-engine-5.html); [LudusEngine](https://ludusengine.com/blog/claude-code-for-unreal-engine) (Single sources; snippets)
- Blueprints and .uasset content are invisible without a bridge. — [LudusEngine](https://ludusengine.com/blog/claude-code-for-unreal-engine) (Single source)
- A daily.dev-shared report says "Claude Code took over Unreal Engine 5 and built a game". The Codex CLI with UE 5.7 MCP/Blueprint workflows has also been documented. — [daily.dev](https://daily.dev/posts/claude-code-took-over-unreal-engine-5-and-built-a-game-lsf8camb8); [Daniel Vaughan: Codex CLI for UE 5.7](https://codex.danielvaughan.com/2026/05/28/codex-cli-unreal-engine-5-7-game-development-mcp-servers-blueprint-agent-workflows/) (Single sources; anecdotal)
- An automated compile-error-to-model feedback loop (Live Coding, up to 3 retries) is the feature that separates a useful assistant from "a generic AI wrapper". — [mcpmarket: UnrealClaude](https://mcpmarket.com/server/unrealclaude) (Vendor claim)

### Inferences
- The lesson that carries over: give the agent deterministic, machine-readable feedback (UBT errors, index.json, log scraping), local engine source and a rule to restart or rebuild on header changes. Delegate asset and Blueprint work to MCP only with human checkpoints and version-control snapshots.

### Gaps
- No quantitative studies or Epic-forum consensus threads specific to Cursor or Copilot with UE 5.6+ were retrieved. The Unreal Slackers community knowledge base was not accessible.
