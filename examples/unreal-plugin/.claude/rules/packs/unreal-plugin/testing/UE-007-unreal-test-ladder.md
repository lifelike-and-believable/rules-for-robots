---
id: UE-007
title: Test at the lowest level that exercises the behaviour
level: SHOULD
scope: pack:unreal-plugin
paths: ["**/*.h", "**/*.cpp", "**/Tests/**"]
verified-by: [review]
targets-failure: unverified-claim
observed-on: []
rationale: Low-level tests run in seconds without the editor, while editor automation tests are slow, so choosing the lowest level keeps the verification loop short.
sources: ["practices/unreal-plugin-development.md", "docs/research/notes/unreal_followup.md"]
---
Test pure logic with Low-Level Tests in the plugin's `Tests` folder beside `Source`. Use Automation Spec (`DEFINE_SPEC`) for code that needs UObjects or the engine, and functional tests only for behaviour in a map. When reading automation results, use the exported `index.json` (`failed` and `notRun` counts) or the `TEST COMPLETE. EXIT CODE` log line, not the editor's process exit code.
