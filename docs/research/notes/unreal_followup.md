# Unreal Engine 5.6+ plugin development: follow-up verification against official Epic sources

Research date: 2026-10-05. This pass read dev.epicgames.com pages in full by fetching the raw HTML with curl and stripping it to text. Every Epic doc page fetched was served as "Unreal Engine 5.8 Documentation", which means current docs describe 5.8. Release notes for 5.6 and 5.7 were fetched with `?application_version=5.6` and `?application_version=5.7`.

Access notes:
- **Still blocked:** forums.unrealengine.com (proxy 403, WebFetch EGRESS_BLOCKED) and support.fab.com (TLS/connect failure on the first try and on one retry, as the coordinator allowed). Claims from either domain stay at "search snippet only".
- **Reachable:** the Fab documentation hosted on dev.epicgames.com/documentation/en-us/fab/.
- **Epic Claude Code plugin repo:** the repo is **public**. It was cloned anonymously at commit a6aa73a (2026-09-17), plugin version 3.1.1.
- **Not attempted:** the EpicGames/UnrealEngine source repo (Epic-linked account needed).

Evidence levels:
- **Official:** an Epic doc page or Epic-owned repo, read in full.
- **Official (snippet):** search snippet only.
- **Widely reported:** several community sources agree.
- **Single source:** one source only.

Verdicts on earlier claims:
- **confirmed:** the official source agrees.
- **corrected:** the official source differs. The corrected text is given.
- **unverifiable:** no official source was reachable or exists.

## 1. Epic C++ Coding Standard (current: 5.8 docs page)

### Takeaway
The current standard is mandatory for Epic code. It says UE compiles as C++20 by default and requires at least C++20. It bans `auto` except in three cases, and bans structured bindings. It requires explicit lambda captures, `nullptr`, `enum class`, `virtual` plus `override`, `#pragma once`, `TEXT()`, tabs, and fine-grained IWYU includes. It does not mention `TObjectPtr` at all. TObjectPtr guidance lives on the separate Object Pointers page.

### Cited Findings
All findings in this list come from [Epic C++ Coding Standard](https://dev.epicgames.com/documentation/en-us/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine) (Official; fetched 2026-10-05; page labelled UE 5.8) unless they name another source.
- **Status.** "Following the coding standards is mandatory." The page reflects "the state of Epic Games' current coding standards".
- **C++ version.** "Unreal Engine compiles with a language version of C++20 by default and requires a minimum version of C++20 to build." Compiler-specific features are not allowed unless they are wrapped in macros or conditionals.
- **Naming prefixes.**
  - Each word is capitalised (PascalCase).
  - `T` for templates, `U` for UObject-derived classes, `A` for AActor-derived classes, `S` for SWidget-derived classes, `I` for abstract interfaces, `C` for concept-like structs, `E` for enums, `F` for most other types.
  - Booleans must be prefixed `b`. Typedefs take the prefix of the type they alias.
  - Macros are fully capitalised and prefixed `UE_`.
  - Template parameters that clash with aliases get an `In` prefix.
  - Output parameters are encouraged to use `Out`; a boolean out-parameter is `bOut...`.
  - "Unreal Header Tool requires the correct prefixes in most cases".
  - File names should not carry the prefix (`Scene.cpp`, not `UScene.cpp`).
- **auto.** "You shouldn't use auto in C++ code" except in three cases:
  - binding a lambda to a variable;
  - iterator variables whose type is verbose;
  - template code where the type is hard to discern.

  "C++20's structured binding feature should also not be used, as it is effectively a variadic auto." Large lambdas, or lambdas that return another call's result, should use explicit return types.
- **Lambdas.**
  - "Explicit captures should be used rather than automatic capture ([&] and [=])."
  - Never capture locals or members by reference in a deferred lambda.
  - "Accidentally captured UObject pointers are invisible to the garbage collector."
  - Use `CreateWeakLambda` or `CreateSPLambda` for deferred execution, or capture `TWeakObjectPtr` or `TWeakPtr` and validate it inside the lambda.
  - A deferred lambda that breaks these rules needs a comment explaining why the capture is safe.
- **nullptr.** "You should use nullptr instead of the C-style NULL macro in all cases." The exception is C++/CX, where `TYPE_OF_NULLPTR` is used.
- **Enums.** Enum classes replace old namespaced enums, for both regular enums and UENUMs. Use `ENUM_CLASS_FLAGS(EnumType)` for flag enums.
- **override and final.** Their use is "strongly encouraged". When overriding, use both `virtual` and `override`. Use `final` if a class is not designed to be derived from. `static_assert` is allowed.
- **Const correctness.**
  - "All code should strive to be const-correct."
  - Pass arguments that are not modified by const pointer or const reference.
  - Mark methods `const` when they do not modify the object.
  - Use const iteration when the loop does not modify the container.
  - `const` is preferred on by-value parameters and on locals.
  - Put `const` at the end to make a pointer itself const.
  - "Never use const on a return type", because it inhibits move semantics. A reference or pointer to const may be returned.
- **Includes and physical dependencies.**
  - Use `#pragma once`.
  - "Forward declarations are preferred to including headers."
  - Be as fine-grained as possible: "do not include Core.h". Include every header you need directly, and never rely on headers included indirectly.
  - Avoid including standard library headers from other headers.
  - Public/Private module folders control what other modules can see.
  - "Don't worry about setting up your headers for precompiled header generation."
  - Be conservative with `FORCEINLINE` and with inline functions.
- **Standard library.** Prefer whichever of the standard library or the UE equivalent "gives superior results", and do not mix idioms within one API:
  - `<atomic>` "should be used in new code", because `TAtomic` is only partially implemented.
  - Prefer `<type_traits>` where a standard trait overlaps a UE trait.
  - `<regex>` is allowed only in editor-only code.
  - `MoveTemp` is UE's `std::move`.
- **Other rules.**
  - Always wrap string literals in `TEXT()`.
  - Use tabs (size 4) for leading whitespace, in C# as well.
  - Use U.S. English.
  - Order class sections with the public interface first.
  - Class members are "almost always" private, with protected accessors for derived classes.
  - Pass UObjects by pointer, not by reference.
  - Prefer enum-class flag arguments over `bool` parameters, except for setters.
  - Interfaces carry the `I` prefix, are abstract and have no member variables.
  - Abstract platform code behind `FPlatformMisc`-style functions rather than adding `PLATFORM_*` checks.
- **Comments.** Comment a method once, where it is publicly declared, with caller-relevant information only. `@warning`, `@note`, `@see` and `@deprecated` each go on their own line.
- **Copyright line.** "// Copyright Epic Games, Inc. All Rights Reserved." is required on Epic-distributed files. This applies to Epic's own code, not to third-party plugins.
- **TObjectPtr (Object Pointers page, not the coding standard).** Source: [Epic: Object Pointers](https://dev.epicgames.com/documentation/en-us/unreal-engine/object-pointers-in-unreal-engine) (Official; fetched).
  - Persistent UObject references on a UCLASS or USTRUCT should be `UPROPERTY() TObjectPtr<T>`.
  - Use raw `T*` for "local variables, parameters, or short-lived references that are not UPROPERTY-marked fields".
  - Use `TStrongObjectPtr<T>` for a strong reference held by a non-UObject class.
  - "TObjectPtr is only garbage collection safe if it is marked as a UPROPERTY."
  - TObjectPtr "should be used in place of raw pointers when possible", because it supports cook-time dependency tracking and incremental GC barriers.
  - Never access a UObject through a TObjectPtr from worker threads unless the object is rooted. Use `TWeakObjectPtr::Pin()` instead.
  - Existing `UPROPERTY` raw pointers "should migrate" to TObjectPtr.
  - **Verdict on the earlier claim** that "a UPROPERTY TObjectPtr is a strong reference; a raw pointer is invisible to GC": **confirmed**.
- **IWYU page.** Source: [Epic: IWYU](https://dev.epicgames.com/documentation/en-us/unreal-engine/include-what-you-use-iwyu-for-unreal-engine-programming) (Official).
  - A `.cpp` file includes its matching `.h` file first.
  - IWYU compliance is indicated by `PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs` in `.Build.cs`.

### Inferences
- Rules an agent most often breaks, and which a rule-writer can state crisply:
  - no `auto` and no structured bindings;
  - explicit lambda captures, with weak captures for deferred lambdas;
  - `b`-prefixed booleans;
  - no `const` return values;
  - `.cpp` includes its own header first;
  - no `CoreMinimal.h`/`Core.h`-style catch-all includes in new code;
  - `TObjectPtr` plus `UPROPERTY` for members, raw pointers for parameters and locals.
- Because the standard itself declares C++20 the minimum, C++20 features other than structured bindings are not banned. The portability caveat still applies.

### Gaps
- The coding standard says nothing about `TObjectPtr`, `[[nodiscard]]`, designated initialisers, concepts or `UE_DEPRECATED` usage policy.

## 2. UE 5.6 / 5.7 / 5.8 release notes: toolchain, API changes and deprecations agents get wrong

### Takeaway
The toolchain moved from an MSVC 14.38 minimum and a 14.38 build farm (5.6) to a default of MSVC 14.44 (5.7, where VS 2026 and MSVC 14.50 were not yet supported). In 5.8, VS 2026 and MSVC 14.50 are recommended. 5.7 requires `BuildSettingsVersion.V6`. 5.8 introduces `UE_LOGF` (UE_LOG "will eventually be deprecated"), `UE_PLATFORM_*` macros, and mass removal of 5.0–5.6 deprecations.

### Cited Findings
Source key for this section: [UE 5.6 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-6-release-notes?application_version=5.6), [UE 5.7 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-7-release-notes?application_version=5.7) and [UE 5.8 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes) (all Official; fetched in full).

**Toolchain (Windows)**

| | 5.6 | 5.7 | 5.8 |
|---|---|---|---|
| Visual Studio listed | "Visual Studio 2022 v17.14 or newer" | "Visual Studio 2022 v17.14 or newer" | "Recommended Visual Studio: 2026"; "Minimum Visual Studio: 2022 v17.14 or newer" |
| MSVC | Core notes: "Update minimum MSVC to 14.38.33130 & minimum Visual Studio 2022 to 17.8" | "we updated the default Microsoft Visual C++ compiler to MSVC 14.44"; "MSVC v14.50 compiler bundled with Visual Studio 2026 is not currently supported" | "MSVC Recommended: 14.50", "MSVC Minimum: 14.38" |
| Build farm compiles against | "Visual Studio 2022 17.8 14.38.33130 toolchain and Windows 10 SDK (10.0.22621.0)" | "Visual Studio 2022 17.14 14.44.35207 toolchain and Windows 10 SDK (10.0.22621.0)" | "Visual Studio 2022 17.14, 14.44.35207 toolchain, and Windows 10 SDK (10.0.22621.0)" |
| Windows SDK | "10.0.22621.0 or newer" | "10.0.22621.0 or newer" | Default 10.0.26100.0, minimum 10.0.22621.0 |
| Clang (Windows) | min 18.1.3, preferred 18.1.8 | min 18.1.8, preferred 20.1.8 | min 18.1.8, preferred 20.1.8 |
| Linux | clang 18.1.0 / v25 toolchain | clang 20.1.8 / v26 toolchain | clang 20.1.8 / v26 toolchain |
| .NET | 8.0 | 8.0 | ".NET 10.0 for VS 2026" |
| Other | | "Experimental Visual Studio 2026 support" | |

- The current [Hardware & Software Specifications](https://dev.epicgames.com/documentation/en-us/unreal-engine/hardware-and-software-specifications-for-unreal-engine) page (5.8) says: "Use Visual Studio 2026 for general development. Use Visual Studio 2022 for Nintendo development and AGDE below v26.1.102." (Official)
- **Verdict on the earlier community claim** for 5.7 ("VS 2022 17.8+ (17.14 recommended), MSVC 14.44.35214, SDK 10.0.22621.0+; one snippet says min 14.38, recommended 14.50"): **corrected**.
  - Officially, 5.7 lists VS 2022 v17.14 or newer, the default compiler MSVC 14.44, and a build farm on 14.44.**35207** (not .35214).
  - 5.7 states that MSVC 14.50 (VS 2026) is **not** supported.
  - "Min 14.38 / recommended 14.50" is the **5.8** table, not 5.7.

**Build and target settings**
- 5.7 requires `DefaultBuildSettings = BuildSettingsVersion.V6` in each `*Target.cs` for launcher and installed builds. Source builds either upgrade to V6 or set `BuildEnvironment = TargetBuildEnvironment.Unique`. — [UE 5.7 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-7-release-notes?application_version=5.7)
- 5.7 "ThinLTO is now enabled by default for Clang based toolchains." — [UE 5.7 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-7-release-notes?application_version=5.7)
- 5.8 adds an optional migration from `#if PLATFORM_*` to `#if UE_PLATFORM_*`. `PLATFORM_IOS` "can be stomped by included IOS framework headers". — [UE 5.8 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes)

**Core API**
- **5.8 logging:** "Added the UE_LOGF family of macros for unstructured logging with UTF-8 format strings." Upgrade note: "These replace UE_LOG which will eventually be deprecated. Please convert UE_LOG to UE_LOGF. The release contains ConvertUELog.py". — [UE 5.8 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes)
- **Other 5.8 Core changes** ([UE 5.8 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes)):
  - `FCoreDelegates::OnPostEngineInit` is deprecated in favour of `FCoreDelegates::GetOnPostEngineInit()`. This matters for plugin modules.
  - `UObject::Rename` flag `REN_ForceNoResetLoaders` is deprecated.
  - `ExecCheckImplInternal` is renamed `CheckEnsureFailed`.
  - An implicit cast-to-bool in string conversion may now fail to compile; add a `LexToString`.
  - The `FSharedEventRef` constructor now honours `EEventMode::ManualReset`.
  - The plugin `PluginName.ini` and `BasePluginName.ini` patterns are deprecated.
  - Multiple "Remove non-reflected UE_DEPRECATED items (5.0-5.6)" sweeps: code using APIs deprecated through 5.6 fails to compile on 5.8.
- **5.7 Core and API** ([UE 5.7 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-7-release-notes?application_version=5.7)):
  - "Replaced the UTF8CHAR enum with C++20's char8_t."
  - `TStaticArray` Alignment is deprecated.
  - Public access to `UFont::CompositeFont` is deprecated.
  - `FTickableGameObject` created from a worker thread now ensures. Use the `ETickableTickType::Never` constructor, then call `SetTickableTickType`.
  - The Iris `UReplicationBridge` base class has been removed.
- **5.6 Core** ([UE 5.6 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-6-release-notes?application_version=5.6)):
  - "Deprecated bool AllowShrinking parameters." Use the `EAllowShrinking` enum.
  - `FSoftObjectPath::SubPathString` is converted to `FUtf8String`, and the FString-taking functions are deprecated.
  - SavePackage removed handling of the deprecated `UObject::PreSave`, `PreSaveRoot` and `PostSaveRoot`.
  - UBT now reports when a project uses a plugin that is marked deprecated.
  - Tools depending on the "ProjectLauncher" module must switch to "LegacyProjectLauncher".

### Inferences
- High-value agent rules:
  1. Grep the installed engine for any API before use. Many 5.0–5.6 deprecations were removed outright in 5.8.
  2. Use `EAllowShrinking`, not `bool`.
  3. On 5.8, prefer `UE_LOGF` in new code but keep `UE_LOG` where 5.6 and 5.7 must also compile. `UE_LOGF` does not exist before 5.8, so a version guard or a project-level logging macro is needed.
  4. Use `UE_PLATFORM_*` only behind a version check.
  5. Pin the CI toolchain per engine: 14.38 for 5.6, 14.44 for 5.7, and 14.44 or 14.50 for 5.8. MSVC 14.50 on 5.7 is unsupported.

### Gaps
- I did not exhaustively read the ~15k-line notes for every module. Only the Foundation, Core, Build and Framework upgrade sections and targeted greps were read.
- No official C++23 statement was found. The coding standard says only that C++20 is the default and the minimum.

## 3. Automation testing: command line, report export, exit codes, Spec, LLT, Gauntlet

### Takeaway
Epic documents:
- `-ExecCmds="Automation RunTest <filter>;Quit"`;
- `-ReportExportPath`, which writes JSON plus HTML with `succeeded`/`failed`/`notRun` counts;
- `-ResumeRunTest`;
- a log line `**** TEST COMPLETE. EXIT CODE: <n> ****`, where 0 means no failures.

Epic does not document the process exit code. Parsing `index.json`, or that log line, remains the right gate.

### Cited Findings
- **Command line** ([Epic: Run Automation Tests](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine), Official):
  - `-ExecCmds="Automation RunTest Test1+Test2;Quit"`
  - `-ExecCmds="Automation RunTest MySet.MySubSet;Quit"`
  - `Automation RunTest Group:MyGroup`
  - `-ReportExportPath="<output path>"` stores results "in a JSON format with related HTML files".
  - `-ResumeRunTest` resumes from the first not-run test. In-progress tests are marked failed.
  - Epic writes `RunTest` (singular). Community examples use `RunTests`, and Epic's own Claude Code skill uses `Automation RunTests ...;quit -Unattended -NullRHI` ([EpicGames skill repo, create-toolset/SKILL.md](https://github.com/EpicGames/unreal-engine-skills-for-claude-code-plugin)). Both spellings appear in Epic material.
- **Reports** ([Epic: Review Test Results](https://dev.epicgames.com/documentation/en-us/unreal-engine/review-test-results-in-unreal-engine), Official):
  - There are three formats: log, JSON and HTML.
  - Log patterns: `Test Completed. Result={<status>}`, and `**** TEST COMPLETE. EXIT CODE: <exit code number> ****`, where "An exit code of 0 means no test failure."
  - JSON top-level fields: `succeeded`, `succeededWithWarnings`, `failed`, `notRun`, `inProcess`, `totalDuration`, and `tests[]` with `state` and `entries[].event.type`.
- **Exit code.** Earlier claim: "Exit status can be success when tests fail; parse index.json". Verdict: **unverifiable / partially supported**. Epic documents a test-result exit code in the log, not the process exit status. No official statement says that the process exit code reflects test failures. Keep the rule: parse JSON `failed > 0`, or the log `EXIT CODE` line.
- **Framework** ([Epic: Automation Test Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine), Official):
  - Test types are Unit, Feature, Smoke ("All Smoke tests are intended to complete within 1 second"), Content Stress and Screenshot Comparison.
  - Interfaces are Automation Spec, Automation Driver, Functional Testing, Screenshot Comparison, FBX Test Builder, Editor tests with Blueprint or Python, and **CQTest**.
  - Tests in plugins can be enabled individually.
  - The framework "is not ideal for pure unit testing", and Epic points to Low-Level Tests for that.
- **Automation Spec** ([Epic: Automation Spec](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-spec-in-unreal-engine), Official):
  - `DEFINE_SPEC(Name, "Path", EAutomationTestFlags::ProductFilter | EAutomationTestFlags::ApplicationContextMask)`, or `BEGIN_DEFINE_SPEC`/`END_DEFINE_SPEC` when the spec needs members.
  - `Describe()`/`It()` with `BeforeEach`/`AfterEach`.
  - **Verdict:** the earlier single-source claim is **confirmed as official**.
- **Low-Level Tests** ([Epic: Types of LLTs](https://dev.epicgames.com/documentation/en-us/unreal-engine/types-of-low-level-tests-in-unreal-engine); [Build and Run LLTs](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-and-run-low-level-tests-in-unreal-engine), Official):
  - The current page lists only **Explicit** tests: a module and target pair using `TestModuleRules` and `TestTargetRules`.
  - For a plugin, "place the new module inside a Tests directory at the same level as the plugin's Source directory".
  - Build with `UnrealBuildTool.exe MyTestsTarget Development Win64` or BuildGraph. Epic recommends BuildGraph.
  - Run example: `MyTests.exe --log --debug --sleep=5 --timeout=10 -r xml -# [#MyTestFile][Core] --extra-args -stdout`.
  - Tests are Catch2-based, and the Visual Studio Test Explorer discovers them.
  - Default platforms are Win64, Mac, Linux and Android.
  - **Verdict:** "Catch2 executables, no editor boot" is **confirmed**.
- **Gauntlet** ([Epic: Gauntlet Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/gauntlet-automation-framework-overview-in-unreal-engine), Official):
  - Gauntlet runs "sessions" (one or more processes) on a range of platforms and validates the results.
  - It "does not require any specific game-side automation code". An optional Gauntlet Plugin provides a `TestController`.
  - It does **not** create builds: "You need to provide Gauntlet with a network or locally cooked build."
  - Tier 1 interfaces: `ITargetDevice`, `IBuildSource`, `IBuild`, `IAppInstall`, `IAppInstance`, `TestExecutor`, `ITestNode`.
  - It provides log and crash parsing utilities.

### Inferences
- The test ladder for plugins:
  1. LLT explicit tests for pure logic, in a Tests folder beside Source.
  2. Automation Spec or CQTest for UObject-level tests.
  3. Functional tests for maps.
  4. Gauntlet only for cooked, multi-process or multi-device runs. This is likely out of scope for most plugin CI.

### Gaps
- No official page states the process exit code behaviour. The CQTest page slug could not be resolved.

## 4. BuildPlugin / RunUAT flags; multi-version builds

### Takeaway
No current official Epic doc page for `RunUAT BuildPlugin` flags was found. The flags remain community-sourced.

### Cited Findings
- Search found no dev.epicgames.com page documenting BuildPlugin. Epic's docs cover RunUAT generally (BuildCookRun) on [Build Operations](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-operations-cooking-packaging-deploying-and-running-projects-in-unreal-engine) (Official) and the [Installed Build Reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/installed-build-reference-guide-for-unreal-engine) (Official). Neither mentions BuildPlugin or `-StrictIncludes`.
- Community sources give:
  - `RunUAT.bat BuildPlugin -Plugin=<.uplugin> -Package=<out> [-TargetPlatforms=Win64+...] [-StrictIncludes]`;
  - "`-StrictIncludes` adds `-DisableUnity -NoPCH -NoSharedPCH`".

  Sources: [Sector9Ltd/UE5-Build-Plugin](https://github.com/Sector9Ltd/UE5-Build-Plugin); [getnamo SocketIOClient issue #419](https://github.com/getnamo/SocketIOClient-Unreal/issues/419) (Widely reported).
- **Verdicts:**
  - `-Plugin`, `-Package` and `-TargetPlatforms`: **unverifiable (community only)**.
  - The `-StrictIncludes` default: **unverifiable**, because sources differ on whether it is on by default.
  - `-Rocket`: **unverifiable**. It is legacy and not found in current docs.
  - `-Unversioned`: **unverifiable**.
- **Multi-version builds.** The Fab docs require "a new .uplugin project to your listing per engine version" for code plugins ([Epic Fab: Publishing](https://dev.epicgames.com/documentation/fab/publishing-assets-for-sale-or-free-download-in-fab), Official). This confirms per-engine-version builds. Epic publishes no multi-version build recipe.
- **Precompiling.** The Plugins page still says to compile with the minimum supported Visual Studio for the target engine (its example is VS 2019 for 5.2) "to ensure that the resulting libraries are compatible" ([Epic: Plugins](https://dev.epicgames.com/documentation/en-us/unreal-engine/plugins-in-unreal-engine), Official; outdated example).

### Inferences
- The authoritative flag list is `Engine/Source/Programs/AutomationTool/Scripts/BuildPlugin.Automation.cs` in the installed engine. Agents should read that file rather than rely on memory.
- Pair each engine version with its own toolchain from the section 2 table.

### Gaps
- No official BuildPlugin doc exists. The engine source was not read because the private repo needs an Epic-linked account.

## 5. Unreal Insights command-line capture and analysis

### Takeaway
Epic officially documents the capture flags and a small set of Insights viewer flags. The headless batch-analysis flags (`-NoUI`, `-AutoQuit`, `-ABSLOG`, `-ExecOnAnalysisCompleteCmd`, CSV export) are not on the reference page. They come only from the Epic forum knowledge base, which could not be fetched.

### Cited Findings
- **Capture flags** ([Epic: Unreal Insights Reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-reference-in-unreal-engine-5), Official):
  - `-trace=<channels>` (e.g. `-trace=cpu,frame,bookmark`);
  - `-tracehost=<ip>`, `-tracefile=<filename>`, `-tracefiletrunc`, `-tracetailmb=N` (default 4 MiB);
  - `-notraceserver`, `-statnamedevents`, `-verbosenamedevents`.

  Channels include `cpu`, `gpu`, `frame`, `bookmark`, `log`, `loadtime`, `stats`, `file`, `net`, `task`, `memtag`, `callstack` and `memalloc`.
- **Console commands** (same page): `Trace.File [<File>] [ChannelSet]` defaults to `<Project>/Saved/Profiling`. The page also lists `Trace.Start`, `Trace.Stop`, `Trace.Send`, `Trace.Status`, `Trace.Enable`/`Disable`/`Pause`/`Resume`.
- **Viewer flags** (same page): `-OpenTraceFile=file.utrace`, `-OpenTraceId=id`, `-Store=<ip>:port`, `-TraceAutoStart=[0|1]`, `-NoTraceThreading`.
- **Verdicts:**
  - The earlier claim that `.utrace` lands under `Saved/TraceSessions` is **corrected**. The official default for `Trace.File` is `<Project>/Saved/Profiling`. TraceSessions may apply to the trace-server store, but that is unverified.
  - `-NoUI -AutoQuit` and CSV export: **unverifiable**. They are attributed only to [Epic forum KB](https://forums.unrealengine.com/t/knowledge-base-unreal-insights-automated-trace-analysis-and-csv-export/1882278), which is blocked.

### Gaps
- The official headless-analysis flags and the CSV export commands could not be read.

## 6. UBT -mode=GenerateClangDatabase

### Takeaway
No official Epic doc for this mode was found. The UBT docs index lists Targets, Module Properties, Build Configuration, IWYU, Project Files, Static Code Analysis and "Use Clang to Build Microsoft Platforms", but not GenerateClangDatabase.

### Cited Findings
- UBT topic list: [Epic: UnrealBuildTool](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-build-tool-in-unreal-engine) (Official). It has no GenerateClangDatabase page.
- [Build Configuration](https://dev.epicgames.com/documentation/en-us/unreal-engine/build-configuration-for-unreal-engine) (Official) documents `bUseUnityBuild` and `CppStandard`/`CppStandardEngine` ("Which C++ standard to use for compiling this target").
- **Community usage:**
  - Windows: `UnrealBuildTool.exe -mode=GenerateClangDatabase -project=... -game -engine <Target> Development Win64` writes `compile_commands.json` at the engine root.
  - `-Filter=` limits the files included.
  - The mode is not incremental, and "rewrites .rsp files", so the next normal build can trigger a full rebuild.

  Sources: [uetools README](https://github.com/tiagodsp/uetools/blob/develop/README.md); [Epic forum thread](https://forums.unrealengine.com/t/ubt-generateclangdatabase-is-not-incremental-and-recreates-whole-compile-commands-json-each-time/2005308) (Widely reported; snippet only).
- **Verdict:** **unverifiable officially; widely reported**.

### Inferences
- The forum report that `.rsp` rewrites trigger a full rebuild matters for agents. Generate the database once, separately from the inner build loop, not before each build.

### Gaps
- No official doc was found. The engine source (`GenerateClangDatabase.cs`) was not reachable.

## 7. Plugins: .uplugin descriptor, module types, loading phases, platform allow and deny lists

### Takeaway
The narrative docs are partly stale, but the API reference is authoritative:
- Module descriptor fields are `PlatformAllowList`/`PlatformDenyList`, `TargetAllowList`/`TargetDenyList`, `TargetConfigurationAllowList`/`DenyList`, `ProgramAllowList`/`DenyList`, `GameTargetAllowList`/`DenyList`, `PlatformArchitectureAllowList`/`DenyList` and `bHasExplicitPlatforms`.
- Module type `Developer` is "Deprecated due to ambiguities". Use `DeveloperTool`, `Editor`, `UncookedOnly` and the other current types instead.

### Cited Findings
- **Descriptor format** ([Epic: Plugins](https://dev.epicgames.com/documentation/en-us/unreal-engine/plugins-in-unreal-engine), Official):
  - `.uplugin` is JSON. "FileVersion" is the only required field (example value 3).
  - Boolean fields drop the `b` (`bEnabledByDefault` becomes `EnabledByDefault`).
  - The example fields are `Version`, `VersionName`, `FriendlyName`, `Description`, `Category`, `CreatedBy`, `CreatedByURL`, `DocsURL`, `MarketplaceURL`, `SupportURL`, `EnabledByDefault`, `CanContainContent`, `IsBetaVersion`, `Installed` and `Modules`.
  - Each module entry requires `Name` and `Type`.
  - Content needs `"CanContainContent": true`.
  - The icon is `Resources/Icon128.png` (128×128).
  - Config files are `Config/Base<Plugin>.ini` for engine plugins and `Config/Default<Plugin>.ini` for game plugins.
  - "Plugin configuration files are not packaged with projects."
  - The example module uses `"Type": "Developer"`, which is now deprecated, so the example is stale.
- **Module types** ([Epic API: EHostType::Type](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Projects/EHostType__Type), Official): `Runtime`, `RuntimeNoCommandlet`, `RuntimeAndProgram`, `CookedOnly`, `UncookedOnly`, `Developer` ("Deprecated due to ambiguities"), `DeveloperTool`, `Editor`, `EditorNoCommandlet`, `EditorAndProgram`, `Program`, `ServerOnly`, `ClientOnly`, `ClientOnlyNoCommandlet`.
- **Loading phases** ([Epic API: ELoadingPhase::Type](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Projects/ELoadingPhase__Type), Official): `EarliestPossible`, `PostConfigInit`, `PostSplashScreen`, `PreEarlyLoadingScreen`, `PreLoadingScreen`, `PreDefault`, `Default`, `PostDefault`, `PostEngineInit`, `None`.
- **Module descriptor fields** ([Epic API: FModuleDescriptor](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Projects/FModuleDescriptor), Official): the fields listed in the takeaway, plus `AdditionalDependencies`. `bHasExplicitPlatforms` means that "an empty PlatformAllowList is interpreted as 'no platforms'".
- **Modules narrative page** ([Epic: Unreal Engine Modules](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-modules), Official):
  - Most modules are `Runtime` with `Default` loading. "If you frequently see errors from Unreal Editor trying to find C++ classes in a plugin, try setting them to PreDefault."
  - Load order within a phase "is not deterministic". Use `LoadModuleChecked` to force order.
  - Prefer `PrivateDependencyModuleNames`.
  - **Doc defect:** the page names the platform fields "IncludelistPlatforms / ExcludelistPlatforms", which conflicts with the API struct's `PlatformAllowList`/`PlatformDenyList`. Trust the API reference.
- **Plugin dependencies** ([Epic: Plugins](https://dev.epicgames.com/documentation/en-us/unreal-engine/plugins-in-unreal-engine)): plugins declare dependencies on other plugins inside their `.uplugin`.
- **Verdict on the earlier claim** about `PlatformAllowList`/`PlatformDenyList`: field names **confirmed** by the API. The claim that Fab requires them on every module is still **unverifiable**; see section 9.

### Inferences
- A Tier-1 `.uplugin` lint should:
  - reject `"Type": "Developer"`;
  - require `PlatformAllowList` or `PlatformDenyList` on each module (Fab practice);
  - keep editor code in `Editor` or `UncookedOnly` modules;
  - flag `EnabledByDefault`/`CanContainContent` mismatches.

### Gaps
- No official current list of `FPluginDescriptor` fields was extracted in full. The page was fetched (9 KB) but not parsed. Check whether `FabURL` exists alongside `MarketplaceURL` by fetching [FPluginDescriptor](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Projects/FPluginDescriptor).

## 8. Epic's official MCP / AI tooling; version availability; 5.7 AI Assistant

### Takeaway
Unreal MCP (plugin id `ModelContextProtocol`) is an experimental 5.8 editor plugin. It needs the `AllToolsets` plugin, which builds on the `ToolsetRegistry` plugin. Epic's Claude Code plugin is public, MIT-licensed, at v3.1.1, and depends on it. No official source says either one works on 5.6 or 5.7. The 5.7 AI Assistant is an experimental Q&A and code-example chat panel, not an agent that edits the project.

### Cited Findings
- **Unreal MCP** ([Epic: Unreal MCP in Unreal Editor](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor), Official; 5.8 docs; marked Experimental):
  - It "embeds an MCP server inside the Unreal Editor process so that any MCP-compatible AI agent, such as Claude Code, Cursor, or the MCP Inspector, can drive the editor over a local HTTP connection".
  - "Toolsets and tools are not implemented by Unreal MCP itself; instead, the AllToolsets plugin must be used".
  - Tool calls execute "on the game thread serially, meaning clients should not issue overlapping Tool calls."
  - Default endpoint is `http://127.0.0.1:8000/mcp`. Start it with `ModelContextProtocol.StartServer [port]` or the Auto Start Server preference.
  - `ModelContextProtocol.GenerateClientConfig ClaudeCode|Cursor|VSCode|Gemini|Codex|All` writes `.mcp.json`: at the project root for installed builds, or at the workspace root for source builds.
- **Unreal MCP limitations** (same page): HTTP and SSE only, with no stdio or WebSocket; loopback only; no authentication; Resources and Prompts are not advertised; the Toolset Registry adapter is editor-only; "Live Coding does not propagate new UFUNCTION declarations. Adding a Tool requires an editor restart."
- **5.8 release note:** "a new experimental MCP (Model Context Protocol) plugin for the Unreal Editor", plus an "assistant toolset for animation features". — [UE 5.8 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes) (Official). **Verdict on the earlier claim** (experimental in 5.8, can run automation tests): **confirmed**.
- **Claude Code plugin** ([EpicGames/unreal-engine-skills-for-claude-code-plugin](https://github.com/EpicGames/unreal-engine-skills-for-claude-code-plugin), Official; cloned at commit a6aa73a, 2026-09-17):
  - `plugin.json` is v3.1.1, MIT, authored by an Epic employee.
  - Contents: skills `unreal-mcp`, `create-toolset` (authoring AI-callable toolsets in C++ or Python) and `unreal-skill` (authoring in-editor "Agent Skills" as `UAgentSkill` subclasses), plus a SessionStart hook (`hooks/unreal-context.sh`, bash) that detects `.uproject` and `GenerateProjectFiles.*`.
  - Prerequisites: "ModelContextProtocol and AllToolsets plugins enabled". MCP tool search is on by default (`list_toolsets`, `describe_toolset`, `call_tool`).
  - An optional `unreal_mcp_proxy` under `Engine/Plugins/Experimental/ModelContextProtocol/Extras/Proxy` keeps the session open across editor restarts.
  - Its testing flow: `AutomationTestToolset` (`DiscoverTests` → `ListTests` → `RunTests` → `GetTestStatus`/`GetTestResults`). The CLI fallback is `UnrealEditor-Cmd.exe <Project>.uproject -ExecCmds="Automation RunTests <filter>;quit" -Unattended -NullRHI`, with roughly 30 s of startup.
  - **Verdicts:** the earlier security quotes are **confirmed** ("Localhost is not a trust boundary", `execute_tool_script` "executes arbitrary Python", commit or shelve before long sessions). The earlier claim of "single skill" is **corrected**: there are three skills.
- **Version availability.** Neither the repo nor the Epic MCP doc names a minimum engine version. The plugin's only prerequisite is an editor with these plugins, which are documented only for 5.8. Verdict: "5.6/5.7 not supported" remains **unverifiable, with strong indication of 5.8+ only**. The 5.6 and 5.7 release notes contain no MCP or ToolsetRegistry entries (grep of the full text).
- **5.7 AI Assistant.** The 5.7 release notes section "AI Assistant (Experimental)" describes a slide-out editor panel to "ask questions, generate code, or follow step-by-step guidance". It offers chat history and copy-paste of answers, and is "powered by the same specially-trained AI already available in UEFN and on the Developer Community". — [UE 5.7 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-7-release-notes?application_version=5.7) (Official). **Verdict:** the conflict is **resolved**. It is Epic's own assistant, a chat panel that generates code examples for the user to paste. Epic's notes do not mention bring-your-own Claude or GPT keys, or the assistant editing Blueprints or files. The StraySpark claim is unsupported by Epic.
- **AI index page.** The [AI Features, Tools, and Plugins](https://dev.epicgames.com/documentation/en-us/unreal-engine/ai-features-tools-and-plugins-in-unreal-engine) page (Official) lists Unreal MCP, "Working with PCG and LLMs Using Unreal MCP" and Semantic Search (an AI search mode in the Content Browser).

### Inferences
- For 5.6 and 5.7 projects, agents have no Epic-sanctioned editor bridge. Rules should rely on engine-source grep, UBT, and headless automation.
- The 5.8 MCP is useful for test runs and asset work. Its serial game-thread execution means parallel subagents must not share one editor MCP server.

### Gaps
- No Epic statement on backports. I did not check whether the MCP plugin source compiles on 5.7.

## 9. Fab technical requirements for code plugins

### Takeaway
support.fab.com is still unreachable. The official Fab docs on dev.epicgames.com require at least one code module, a fixed directory layout (Config, Content, Resources, Source/<Module>/{Private,Public}, `.uplugin`), and a new upload per engine version. They say nothing about `PlatformAllowList`, compiler versions or "three latest engine versions".

### Cited Findings
- **Code plugin rules** ([Epic Fab: Asset File Format and Structure Requirements](https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab), Official; fetched):
  - "Code Plugins must contain at least one code module."
  - "All Code Plugin products must contain the following: .uplugin file, Source directory, Content directory, Config directory."
  - The structure is `MyPlugin/{Config, Content, Resources, Source/MyModule/{Private, Public, MyModule.build.cs}, ThirdParty, MyPlugin.uplugin}`.
  - Upload as a .zip.
  - Base functionality must have standalone value even if extra features are licensed.
  - Tools and plugins need "thorough documentation".
  - Blueprints must not generate errors or "consequential warnings".
  - Third-party software must be declared.
  - Python goes under `Content/Python`, with third-party packages in `Content/Python/Lib/site-packages/`.
- **Per-version uploads** ([Epic Fab: Publishing](https://dev.epicgames.com/documentation/fab/publishing-assets-for-sale-or-free-download-in-fab), Official): "Code Plugins: Always require an updated project to be submitted, even if the plugin works as expected in the latest engine release. You must upload a new .uplugin project to your listing per engine version."
- **PlatformAllowList requirement:** still **unverifiable**. The only source is the support.fab.com "Fab Plugin Compilation Environment" snippet, which is blocked. Forum threads discuss `PlatformAllowList` usage but are blocked or snippet-only ([forum: Whitelist/Blacklist/Allow for .uplugin](https://forums.unrealengine.com/t/whitelist-blacklist-allow-for-uplugin/1392743), snippet).
- **"Epic builds against the three latest engine versions":** still **unverifiable** (forum only; blocked).

### Gaps
- Not readable: the Fab compilation environment details (compiler versions and build flags Epic uses), the technical-requirements article, and the "latest 3 versions" policy. www.fab.com serves a Cloudflare challenge, according to the coordinator.

## 10. Subsystems, replication, Blueprint API design (brief)

### Takeaway
Epic recommends subsystems as the plugin extension point because their lifetime is managed and they get Blueprint and Python exposure automatically. Replication follows `bReplicates` plus `GetLifetimeReplicatedProps`/`DOREPLIFETIME` with `Super::` calls and `ReplicatedUsing=OnRep_X`. Blueprint utility APIs belong in static `UBlueprintFunctionLibrary` classes.

### Cited Findings
- **Subsystems** ([Epic: Programming Subsystems](https://dev.epicgames.com/documentation/en-us/unreal-engine/programming-subsystems-in-unreal-engine), Official):
  - Lifetimes: `UEngineSubsystem`, `UEditorSubsystem`, `UGameInstanceSubsystem`, `ULocalPlayerSubsystem`. The fetched page does not list `UWorldSubsystem`.
  - `Initialize()` and `Deinitialize()` are tied to the owner. Engine and Editor subsystems initialise after the module's Startup has returned.
  - "Subsystems are particularly useful when creating plugins": the user just adds the plugin, and "you know exactly when the plugin will be instanced".
  - Blueprint exposure is automatic, controlled via `UFUNCTION()`. Python has `unreal.get_engine_subsystem(...)`.
- **Replication** ([Epic: Replicate Actor Properties](https://dev.epicgames.com/documentation/en-us/unreal-engine/replicate-actor-properties-in-unreal-engine), Official):
  - Set `bReplicates = true`.
  - Override `GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const`, call `Super::`, then `DOREPLIFETIME(Class, Prop)`.
  - Use `UPROPERTY(ReplicatedUsing=OnRep_Fn)` for notify callbacks.
- **Iris in 5.8.** Parallel `NetConnection::Tick` adds thread-safety primitives, which can be disabled with `UE_SUPPORT_PARALLEL_IRIS=0`. 5.7 removed `UReplicationBridge`. — [UE 5.8 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes); [UE 5.7 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-7-release-notes?application_version=5.7) (Official)
- **Blueprint function libraries** ([Epic: Blueprint Function Libraries](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-function-libraries-in-unreal-engine), Official): they inherit `UBlueprintFunctionLibrary`, "should also contain only static methods", and use `UFUNCTION(BlueprintCallable, Category="...")`.
- **Blueprint quality on Fab.** Functions, variables and events must have purpose-revealing names, with no loose nodes. — [Epic Fab requirements](https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab) (Official)
- **5.8 Blueprint upgrade note.** Blueprint function local variables should not share names with member variables. — [UE 5.8 RN](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-8-release-notes) (Official)

### Inferences
- For plugin rules:
  - expose a plugin's runtime API through a subsystem plus a static Blueprint function library;
  - always include a `Category` on `BlueprintCallable` functions;
  - always call `Super::GetLifetimeReplicatedProps`.

### Gaps
- The Actor Replication overview and Iris overview pages returned empty shells. Push-model guidance was not retrieved. No Epic "Blueprint API design guidelines" page was found beyond the coding standard's "API Design Guidelines" section, which was not extracted in detail.
