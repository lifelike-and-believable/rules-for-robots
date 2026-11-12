---
name: deliver
description: Deliver a feature whose user documentation is approved - write its spec, failing tests, implementation, and tutorial on one branch and push it, without asking the lead anything. Use when the process state says a feature's delivery is open, when a feature packet's pull request has merged, or when the user asks to deliver or build an approved feature.
argument-hint: "[story or feature name]"
---

# Deliver a feature

A delivery run takes a feature from approved user documentation to a pushed branch the lead can test. The lead has already decided what the feature is, in the design and the user documentation they approved. Your job is to build exactly that, and to finish. The run is described in rules-for-robots `docs/specs/delivery-run.md`.

## Before you start

1. Check the feature is ready. Its story, design, and user documentation are approved on the default branch (the process state given at the start of the session lists it under "delivery is open"; `node "${CLAUDE_PLUGIN_ROOT}/scripts/delivery.mjs" status` and the state command show the same). If the user documentation is still waiting for approval, do not start: tell the lead once that it is waiting, and stop.
2. Create the feature's branch from the up-to-date default branch: `feature/<name>`, or the `claude/` branch the session was given.
3. Start the run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/delivery.mjs" start`. It records that a run is under way on this branch and lists what is still to do. From here until the run ends, a check at the end of each turn sends you back to work while anything on that list is missing.

## The run

One branch, a commit for each step, in this order:

1. **The spec**, `docs/specs/<feature>.md`, from the plugin's spec template: an `id`, `derived-from` linking the approved user documentation it comes from, and acceptance criteria that each name their source section. Take every criterion from the approved documents. Where they do not say, do not invent behaviour: see "When something is open". Check the finished spec against those documents, then set `status: approved`.
2. **The tests**, before any implementation, each citing its criterion (`<spec name>#AC-n`). Run them and see them fail for the right reason. Commit them on their own, and record that commit as the spec's `tests-commit`.
3. **The implementation**, until the project's verify command passes. Change the code, not the tests.
4. **The tutorial**, `docs/tutorials/<feature>.md`, deriving from the user documentation: the steps a person follows to try the feature. Run every step yourself against the built feature and record what happened. A spec for work with nothing a user sees (its design says `no-user-docs`) needs no tutorial.
5. **Push the branch.** A workflow opens the pull request and writes its description from the branch. You may push earlier to see the checks run: the pull request cannot merge until the tutorial is in it, and then it waits for the lead. Do not open, approve, or merge a pull request yourself.

## Rules for the run

- Never ask the lead anything, and never end your turn to wait for them. Decide, record, and carry on.
- The approved user documentation is the definition of done. Where it and your code disagree, the code is wrong.
- Do not edit the approved story, design, or user documentation to fit what you built. If one of them is wrong, that is a finding: record it and build what it says.
- Run the project's verify command before you finish, and say what it printed.
- You push the branch, and you do not open, approve, or merge a pull request: the workflow opens it, and the lead's review merges it.

## When something is open

- **A question the approved documents leave open, or a choice only the lead can make:** choose the most conservative reading, and write the question and your choice in `docs/decisions/<spec name>.md`. The workflow puts that file in the pull request's description, where the lead sees it before they approve.
- **Something you cannot do** (a tutorial step that needs a deployment you cannot reach, tests whose runner is not installed): write `[set aside: tutorial]` or `[set aside: tests]` in that file, with the reason and what you did instead. The end-of-turn check then stops asking for it.
- **Something on the never list** (a production deploy, a shared database, a paid service): do not do it. Record it the same way and finish the rest.

## When the run ends

When everything is committed and pushed, the check asks you to report once. Tell the lead: what was built, anything in `docs/decisions/`, and how to review it. `node "${CLAUDE_PLUGIN_ROOT}/scripts/delivery.mjs" gate` prints the review link and the line the lead can run to approve from the Claude Code prompt. Then stop. The lead validates by following the tutorial against the delivery, and their approval of the pull request merges it.

If the session can subscribe to the pull request's activity, subscribe, so that review comments reach you.
