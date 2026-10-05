---
name: profile-unreal-plugin
description: Capture and analyse an Unreal Insights trace to measure an Unreal plugin's frame time, CPU, GPU, and memory cost. Use when the user asks about an Unreal plugin's performance or wants a performance check before release.
argument-hint: "[map or scenario]"
---

# Profile an Unreal plugin

1. **Pick a scenario** from `$ARGUMENTS` or ask: a map and an action that exercises the plugin. Agree on the budget (for example, the plugin's share of a 16.6 ms frame).
2. **Capture** with the engine version under test: run the host project with `-trace=cpu,gpu,frame,memory -tracefile=<out>.utrace` (plus `-statnamedevents` for detail). By default traces go to `<Project>/Saved/Profiling`.
3. **Analyse.** Open the trace in Unreal Insights. Headless analysis flags (`-NoUI`, `-AutoQuit`, `-ExecOnAnalysisCompleteCmd`) are not in Epic's reference docs; check them against the installed engine (the rules-for-robots runner probe records them) before relying on them.
4. **Report** the plugin's timers and their cost per frame against the budget, the top three hotspots, and a suggested fix for each. Do not change code unless the user asks.
