# Handoff

The state of rules-for-robots for a session that has none of the conversation behind it. Read this first, then `PLAN.md` section 14. Updated 2026-11-12, after 7.3.0 was prepared (rewrite plan phases 25a to 25d).

## What the maintainer wants, in their words

- "I don't EVER want to be prompted to approve a command. The text of the command is generally meaningless to me."
- "If there are things Claude shouldn't ever do, we should make it so Claude doesn't do them, not prompt me to allow Claude to do them. If a task or feature can't be built without doing something so dangerous I might need to deny it, then I'd rather know that ahead of time. I don't ever want to be the bottleneck."
- "Every stage is required unless deliberately waived ahead of time. The development process is what matters most!"
- Approve tasks and decisions, never commands. Once a design or spec is approved, building it, merging each slice when CI is green, and releasing are execution: do them without asking. Ask only for real decisions, before the work starts.

## Where things stand

| Release | What it did |
|---|---|
| 7.1.0 | Stage order enforced (project-process AC-63, AC-64): a design from approved stories, user docs from an approved design, specs and tutorials from approved user docs, unless `process.yml` waives a stage with a reason. `guard-stages` refuses writing an artifact that skips a stage. Merge instructions followed by another request, and a short "yes" to the agent's own question, now count (task-approval AC-13, AC-14). Fixed feedback #204 to #206 from XR Studio. |
| 7.0.0 | Unattended runs (`docs/specs/unattended.md`): nothing asks during a run. The never list is refused with what to do instead; what only the person can authorise is decided in the plan; anything unplanned is set aside in the pull request's `## Decisions`. Replaces 6.x's named asks and chat approval. |
| 6.0.0 | Default allow (`docs/specs/default-allow.md`): rfr-core's `allow-default` hook allows the working tools; a guard's deny wins over it on the same call (checked: `evals/results/2026-11-12-hook-combination/`). |
| 5.10 to 5.11 | Test-change reviewer passed its eval (13d); `testWeakening` defaults to `defer`; standing instructions ("merge each PR when green"). |

## What is open

- **The rewrite plan is approved (2026-11-12, all eight decisions as recommended) and not started**: [rewrite-plan.md](rewrite-plan.md) (Phase 25), written 2026-11-12 after a whole-system review. Its findings: the merge doubling as the approval is why merge instructions keep being misread; stage order is enforced on documents and not on code (a code-only pull request is inferred `trivial`); most waits are the agent ending its turn, not prompts. It moves approval and merging to GitHub, with the agent only pushing branches. Nothing in it is built. Change no guard outside the plan. Trial 1 of 25a passed (`evals/results/2026-11-12-25a-trial-1/`): the `rfr-agent` App (ID 5731039) is installed on the throwaway repository `lifelike-and-believable/rfr-trial`, where a pushed branch becomes a bot-authored pull request and a gated one waits for the maintainer's review. Trial 5 passed with a condition (`evals/results/2026-11-12-25a-trial-5/`): merge delivery pull requests with a merge commit. Trials 2 to 4 passed in cloud sessions (`evals/results/2026-11-12-25a-trials-2-4/`), so 25a is complete. 25b is built (`docs/specs/github-gate.md`): `node checks/process-github-setup.mjs` sets a repository up for the gate and only prints its plan without `--apply`; the gate is on for `xr-studio-in-a-box` since 2026-11-12 (branch protection on `main`, `mode: team`, pull requests opened by the `rfr-agent` App), so sessions there push a branch and never open or merge a pull request. The guide was not clear enough for the maintainer to follow alone and was extended; the next adopter is its test. 25c is built (`docs/specs/process-state.md`): every session in a process project is told the rule and each feature's stage by a `SessionStart` hook, and the `process / change` check fails source changes with no approved spec unless a commit ends with `Change: fix` or `Change: trivial`. Work with no user-facing behaviour (a repository skeleton) gets its own design marked `no-user-docs: <reason>`, which the maintainer approves, and its spec derives from that design. `xr-studio-in-a-box` keeps such a spec in `docs/engineering/`, outside the process folders, from before this existed; it would move to `docs/specs/` with an id. 25d is built (`docs/specs/delivery-run.md`): `/rfr-process:deliver` runs a delivery, and a `Stop` hook keeps it going only while `delivery.mjs start` has marked a run on the current branch. It has not yet run on a real feature. rfr-core 7.3.0 lets a session subscribe to a pull request (`subscribe_pr_activity`), so a packet's merge can start its delivery; a session that did not subscribe is started by the lead saying "deliver it". 7.3.0 is merged and prepared, and is tagged and published only on the maintainer's word (`node checks/release.mjs prepare --commit <merge commit>`). Read that result's findings before 25d: rfr-core's hook refuses the `subscribe_pr_activity` tool the trigger needs; a session created from this desktop-bridged session runs on the desktop unless a cloud environment is named; and the stop check must not block a session that is waiting at a gate.

- **XR Studio In A Box** is the main real user. It has been told about 7.1.0. Its spec(s) derived straight from stories now fail the process check, and it should write and get approval for the Layer 1 design and user docs before more code.
  - Its repository has no `.claude/settings.json`, so a fresh cloud session may load no rfr plugins until `/rfr-core:install-rules` commits one.
  - Its feedback arrives as issues labelled `feedback`; triage them with the `triage-feedback` skill.
- **This machine's own Claude Code** has rfr-core 5.7.1 installed at user level. Sessions here do not get 6.x or 7.x behaviour until the plugin is updated (`/plugin`). That is why the session of 2026-11-12 kept prompting.
- **Claude Code's own prompts** (protected paths such as `.claude`, and auto mode's classifier) are outside rfr's control. Only `bypassPermissions` mode removes them. It is the maintainer's choice; rfr's refusals still hold in it.
- **The delegated multi-PR eval (19i-4)** waits for a budget decision (about $15 to $25).
- **Process enforcement covers documents, not code.** A pull request that adds code with no approved spec at all is caught only by the spec and tests rules, not by `guard-stages`.

## Facts the code does not show

- Cloud sessions and the local CLI both act as the maintainer on GitHub: pull requests opened from a cloud session in `xr-studio-in-a-box` are authored by the maintainer's account, so the maintainer cannot give them an approving review. `xr-studio-in-a-box` has no branch protection on `main` (checked 2026-11-12).
- Claude Code facts checked in its documentation on 2026-11-12: a project's settings cannot set `auto` or `bypassPermissions` mode or the auto-mode classifier's settings; cloud sessions have no bypass mode; auto mode blocks merging a pull request no person approved; an `ask` rule prompts even in auto mode.

- The maintainer cannot judge command text. A permission prompt is never acceptable, and neither is a question in chat during a run.
- Replaying real sessions is the way to check that guards do not misfire: `evals/session-replay/replay-commands.mjs` (with `--map` for cloud paths, and `MSYS_NO_PATHCONV=1` in Git Bash). Run it on new session logs before releasing guard changes.
- Releases: `node checks/release.mjs prepare --commit <sha>`, check CI on that commit, then tag, push the tag, and `gh release create`. A release needs the maintainer's word in chat ("release when ready" counts), which this session's auto mode enforces.
- The release notes take every changelog section after the newest tag. Delete a local tag that was never pushed before preparing, or its section is left out.

## Lessons from 2026-11-12

- Patching one prompt at a time does not converge. Decide the model (what is never allowed, what is always allowed, what is decided up front), then check it against real session logs.
- Moving a question from a prompt to chat is still an interruption.
- A guard that cannot prove an action harmless must not default to asking. Allow unless the guard can tell the action is on the never list.
- Make chained commands, inline `node -e`, and scripts that rewrite files rare in this repository's own sessions: they are what auto mode prompts for. Use the Edit tool for test files; this repository's rule.
