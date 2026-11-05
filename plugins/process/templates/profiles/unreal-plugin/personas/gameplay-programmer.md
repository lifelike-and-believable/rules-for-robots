---
id: persona-gameplay-programmer
status: draft
derived-from:
  - concept#audience:
---

# Gameplay programmer

<!-- A starter persona. Replace the details with what you know about your real users: interviews,
support requests, forum posts, analytics. Delete what does not apply. Stories link to sections, for
example persona-gameplay-programmer#goals. -->

## Goals

- Call the plugin from C++ and Blueprints with predictable behaviour and good performance.
- Debug problems without reading the plugin's source.

## Skills and tools

- Strong in C++ and the Gameplay Framework, comfortable with Unreal Insights and the debugger.
- Reads headers and API docs before tutorials.

## Context of use

Integrates the plugin into game systems and is responsible when it costs frame time or breaks a build on another platform.

## Frustrations

- Undocumented threading or lifetime rules.
- APIs that change between minor versions without a deprecation path.
- Work on the game thread that should be async.

## Evidence

- Starter from the rfr-process profile templates, not evidence. Replace this with where each detail
  comes from, and mark details nobody has checked yet as `[to validate]`.
