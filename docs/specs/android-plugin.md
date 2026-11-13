---
status: draft
tests: [test, plugins/android/test]
unlocks:
  - test/android-guard.test.mjs: AC-1 amended: it no longer expects guard-outcome hooks or its build copy, removed with the prompts it logged (rewrite plan 25e (2026-11-12) removes task approval, default allow, "permissions": "ask", and guard-outcome); the plugin, guard-adb, and the other copies are still checked
---

# Android plugin and a core-only profile

A domain plugin, `rfr-android`, for Android, Android TV, and Google TV apps, and two template profiles: `android-app`, and `general` for projects that are neither web, Unreal, nor Android. Drafted 2026-11-11 from what the quiet-launcher project needed; its decisions were settled the same day, the `uiautomator` assumption checked on the reference TV, and the spec approved by the lead (2026-11-11). The `status` field stays `draft` until every `test:` criterion has a citing test, at the end of slice 24d.

## Problem

The quiet-launcher project (an Android TV home screen, Kotlin with Gradle, PowerShell and Python scripts that drive the TV over ADB) fits no profile. Its `AGENTS.md` records three gaps:

1. "No rfr-process profile fits it, so it uses the `web-app` profile's templates": a website's personas (administrator, support agent) and a browser tutorial template for a TV app.
2. "Tutorials will need `runner: manual` until there is an on-device runner." A manual tutorial pass is the most expensive check the lead does (process plan, "What stays with a person"), and on this project every tutorial needs one.
3. "Changing [the reference device's] settings, installing or removing apps, or changing which app is the home screen affects the household's TV: ask the project lead before each such change." That stop is enforced only by text. The device is outside the project, so under the guard tiers (`practices/guards.md`, tier 4) a change to it is exactly what a guard should ask about, and nothing else should.

Separately, the improvement plan lists "a core-only profile for projects that are neither web nor Unreal" as needed before the framework goes public. The launcher is the first such project, and an MCP server or a command-line tool would be the next.

## Decisions (lead, 2026-11-11)

The lead took the recommendation on each.

1. One plugin for the Android family (phone, tablet, TV), named `rfr-android`. Nothing so far is specific to TV beyond the key names in the runner's vocabulary.
2. The plugin starts with a guard and a tutorial runner. No `android-engineer` agent and no Kotlin or Gradle rule packs until a project shows a failure they would prevent: the evals found most behavioural rules unneeded on current models (improvement plan 18c and 18d), and `rfr-core`'s agents and reviewers already apply.
3. A device is shared unless the project says it is disposable. Emulators (`emulator-NNNN`) count as disposable by default; a physical device is disposable only when `.claude/rfr.json` lists its serial under `android.disposable`. On a disposable device the guard asks about nothing.
4. The `general` profile is `rfr-core` with no packs and no domain plugin. Its process templates use `runner: manual` tutorials and two neutral persona starters.

## The device guard

`guard-adb` in `rfr-android` is a PreToolUse hook on Bash and PowerShell. It reads each `adb` command in a command line (after any `-s <serial>`, `-d`, `-e`, or `-t <id>`), finds the target device (`-s`, then `ANDROID_SERIAL` set in the same command, then the environment), and decides:

| Command | Tier | Why |
|---|---|---|
| `adb devices`, `adb connect`, `adb disconnect`, `adb mdns`, `adb get-state`, `adb get-serialno`, `adb wait-for-*` | 1 | No change to a device |
| `adb logcat`, `adb pull`, `adb exec-out screencap`, `adb shell` with `getprop`, `dumpsys`, `pm list`, `pm path`, `settings get`, `cmd package resolve-activity`, `screencap`, `screenrecord`, `uiautomator dump`, `ls`, `cat`, `ps`, `id`, `wm size` with no argument | 1 | Reads |
| `adb shell input`, `adb shell am start`, `adb shell am broadcast`, `adb shell am force-stop`, `adb shell monkey -p <package> 1` | 1 | Drives the user interface, as a person with the remote would; the app restarts, nothing persists |
| `adb install`, `install-multiple`, `uninstall`; `adb shell pm` with `install`, `uninstall`, `disable`, `disable-user`, `enable`, `hide`, `unhide`, `clear`, `grant`, `revoke`, `set-home-activity`, `set-installer`; `adb shell cmd package` with any of those; `adb shell settings put` or `delete`; `adb shell appops set`; `adb shell wm` with `size` or `density` and an argument; `adb shell svc`; `adb reboot`, `root`, `unroot`, `remount`, `disable-verity`, `enable-verity`, `sideload`; `adb push` | 4 on a shared device, 1 on a disposable one | It changes a device outside the project, which a snapshot cannot undo |
| `adb shell` with anything else, or a command the guard cannot read | 4 on a shared device, 1 on a disposable one | Unknown changes are treated as changes |
| A script listed in `.claude/rfr.json` under `android.deviceScripts` (for quiet-launcher, `scripts/quiet-setup.ps1` and `scripts/quiet-undo.ps1`) | 4 on a shared device, 1 on a disposable one | The guard cannot see the `adb` commands inside a script |

The ask names the device, the change, and what the agent can do instead ("If not approved: run it on an emulator, or report the command for the lead to run"). Like the other guards, it logs each decision, and the guard corpus gains a case for each row.

## The on-device tutorial runner

`runner: adb` joins `web`, `unreal`, and `manual`. `node checks/tutorial-run.mjs` runs an `adb` tutorial against the device named by `--serial` or `ANDROID_SERIAL`, using only tier-1 commands, so the guard never asks for it. Before the first step it wakes the device (`input keyevent KEYCODE_WAKEUP`), because a sleeping screen has no layout to read, and a step whose dump still has no root node fails with "the screen is off or locked" rather than "not found". Step grammar, alongside the web one in `checks/lib/tutorial.mjs`:

| Sentence | Action |
|---|---|
| Open the app `<package>`. Open `<package>/<activity>`. | `am start` (or `monkey -p <package> 1` without an activity) |
| Press **Home**, **Back**, **Up**, **Down**, **Left**, **Right**, **Select** (or **OK**, **Center**), **Menu**, **Search**, **Play**, **Pause**. | `input keyevent` with the matching key code |
| Press **Select** on **Text**. | move focus with the arrow keys until a node showing **Text** is focused, then **Select**; fails if focus cannot reach it in 30 moves |
| Type `text`. | `input text` |
| ... you see **Text**. **Text** appears. | `uiautomator dump`, a node whose text or content description contains **Text**, retried until the step timeout |
| **Text** is focused. | the focused node, or a node inside it, has **Text** in its text or content description (on the reference TV the focused node is often a layout that carries only a description) |

A dump takes about five seconds on the reference TV, so an `adb` tutorial's step timeout defaults to 20 seconds, and a focus search that needs all 30 moves can take a few minutes.

With `--record <dir>`, the runner keeps a screenshot after each step and a `failure.png`, as the web runner does, so a passing run is also the demo. A step ending "(manual)" is skipped, as in web tutorials.

## The profiles

- `android-app`: `rfr-core` and `rfr-android`; allow rules for `./gradlew test`, `./gradlew lint`, `./gradlew assembleDebug` and their `gradlew.bat` forms; an `AGENTS.md` template naming the Gradle commands and the device notes file; a CI workflow running `./gradlew test lint`. rfr-process templates in `plugins/process/templates/profiles/android-app/`: personas `household-member` and `app-maintainer`, a user document for a TV or phone app, and a tutorial template with `runner: adb`.
- `general`: `rfr-core` only, no packs; an `AGENTS.md` template with a verify command to fill in; rfr-process templates in `plugins/process/templates/profiles/general/`: personas `primary-user` and `maintainer`, a user document, and a tutorial template with `runner: manual`.
- `install-rules` and the process `setup` skill infer `android-app` from an `AndroidManifest.xml` or the `com.android.application` Gradle plugin, and offer `general` when nothing matches instead of borrowing another profile.

## User stories

- As the lead on an Android TV project, I am asked before an agent changes the household TV, and never about reading from it or pressing its keys, so I am interrupted only for what I would want to stop.
- As the lead, my app's tutorials run on the device in CI or on the reference device, so I check the recording instead of following each tutorial by hand.
- As the lead starting a project that is neither web, Unreal, nor Android, I get templates that fit, instead of borrowing a website's personas.

## Acceptance criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-1 | `plugins/android/` is the `rfr-android` plugin, listed in the marketplace, with the `guard-adb` hook for Bash and PowerShell (amended 2026-11-12, rewrite plan 25e: guard-outcome was removed with the prompts it logged). | test: the plugin validates; its hooks file registers guard-adb. |
| AC-2 | `guard-adb` decides each row of the device guard table: tier 1 for reads, connection commands, and user-interface input; an ask for each change, unknown `adb shell` command, unreadable command, and listed device script on a shared device; nothing on a disposable device. The ask names the device and the change and says what to do if not approved. | test: one guard corpus case per row on a shared and on a disposable device; the reason's wording. |
| AC-3 | The target device is the one `-s` names, else `ANDROID_SERIAL` set in the same command, else the environment's; `emulator-NNNN` serials and serials listed under `android.disposable` are disposable; with no device named and more than one possible, a change asks. | test: each source of the serial, and the ambiguous case. |
| AC-4 | `checks/tutorial-run.mjs` accepts `runner: adb`, checks the step grammar in its coverage mode, wakes the device before the first step, and runs an `adb` tutorial through the commands in the runner table only, recording a screenshot per step with `--record`. It reads the dump with the trailing "UI hierchary dumped to" line removed, and reports an empty dump as the screen being off or locked. | test: the grammar; a run against a fake `adb` that serves `uiautomator` dumps, passing and failing at the right step; the wake key first; the trailing line; an empty dump; every command it sent is tier 1 in `guard-adb`. |
| AC-5 | "Press **Select** on **Text**" moves focus with the arrow keys until a node showing the text is focused, and fails after 30 moves. "**Text** is focused" matches the focused node or a node inside it, by text or content description. | test: against the fake `adb`, a reachable and an unreachable target; a focused layout whose description, or whose child's text, holds the text. |
| AC-6 | `build/profiles.json` has `android-app` (packs none, plugins `rfr-core` and `rfr-android`, the Gradle allow rules) and `general` (packs none, plugin `rfr-core`); the build renders `template-repos/android-app/` and `template-repos/general/`. | test: the build and the rendered settings and `AGENTS.md`. |
| AC-7 | `plugins/process/templates/profiles/android-app/` and `general/` hold the persona starters, a user document, and a tutorial template whose runner is `adb` and `manual`. | test: the files exist and pass the process check as drafts. |
| AC-8 | `install-rules` and the process `setup` skill infer `android-app` from an `AndroidManifest.xml` or the `com.android.application` plugin, and offer `general` when no profile matches. | test: the skill text names both signals and the fallback; a smoke case for `setup` on an Android fixture. |
| AC-9 | Documentation: the plugin's README, `practices/guards.md` rows for `guard-adb`, the process guide's validation part on `runner: adb`, and the root README's plugin table. | verified by review. |
| AC-10 | When `install-rules` or `setup` falls back to `general` because no profile fits, and the project would gain from a profile of its own, the agent offers to suggest one through `/rfr-feedback:report-feedback`, area `profiles`, saying what kind of project it is and how to recognise one, what it had to borrow or do without, and why a profile would help. The feedback form and skill list the `profiles` area, the `general` template's README says the same, and `triage-feedback` groups suggestions by kind of project and proposes a profile only for what `general` cannot give. (Added 2026-11-11 at the lead's request.) | test: each of those texts names the area and the three parts of a suggestion. |

## Scope

- In: the plugin and its guard; the `adb` runner; the two profiles and their process templates; inference in `install-rules` and `setup`; documentation; the guard corpus cases.
- Out: an `android-engineer` agent and Android rule packs (decision 2); iOS; driving an emulator in CI (a project's own workflow can start one; the runner only needs a serial); Gradle or Kotlin build checks beyond the template workflow.

## APIs and assumptions

- `adb exec-out uiautomator dump /dev/tty` prints the view hierarchy as XML without writing a file on the device. Checked on the quiet-launcher reference device (Chromecast with Google TV, Android 14, API 34) on 2026-11-11, with the lead's agreement: while the screen was asleep it printed "null root node returned by UiTestAutomationBridge" and no XML; after `input keyevent KEYCODE_WAKEUP` it returned 75 nodes in about five seconds, each with `text`, `content-desc`, `resource-id`, `class`, `package`, `focusable`, `focused`, `selected`, and `bounds`, with exactly one focused node (a layout with a content description and no text), followed by the line "UI hierchary dumped to: /dev/tty". The dump itself was deleted after the check.
- Key codes come from `android.view.KeyEvent` (`KEYCODE_WAKEUP` 224, `KEYCODE_HOME` 3, `KEYCODE_BACK` 4, `KEYCODE_DPAD_UP` 19 to `KEYCODE_DPAD_RIGHT` 22, `KEYCODE_DPAD_CENTER` 23, `KEYCODE_MENU` 82, `KEYCODE_SEARCH` 84, `KEYCODE_MEDIA_PLAY` 126, `KEYCODE_MEDIA_PAUSE` 127).
- A plugin's hooks cannot import from another plugin, so `rfr-android` gets a build copy of `lib.mjs`, as `rfr-web` and `rfr-unreal` do.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 24 (added with this spec).
- Slices: 24a the `general` profile (AC-6 and AC-7 for `general`, AC-8's fallback), which needs nothing else; 24b the plugin and the device guard (AC-1 to AC-3); 24c the `adb` runner (AC-4, AC-5); 24d the `android-app` profile and inference (the rest of AC-6 to AC-8), and AC-9.
- Evidence: the guard follows the tier rule and the guard corpus, as the other guards do. The runner is a check, not a rule, so it needs tests, not an eval. Whether `runner: adb` saves the lead's time is measured with the attention report (19a) on the launcher before and after.
- Pull requests: #183 (spec).
