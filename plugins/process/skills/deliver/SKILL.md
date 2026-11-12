---
name: deliver
description: Deliver or finish a feature - find how far it has got, then write whatever it still lacks (spec, failing tests, implementation, tutorial) on one branch and push it, without asking the lead anything. Use when the user asks to deliver, build, or finish a feature or slice, when the process state says a feature's delivery is open or under way, or when a feature packet's pull request has merged.
argument-hint: "[story or feature name]"
---

# Deliver a feature

A delivery run takes a feature from approved user documentation to a pushed branch the lead can test. The lead has already decided what the feature is, in the design and the user documentation they approved. Your job is to build exactly that, and to finish. The run is described in rules-for-robots `docs/specs/delivery-run.md`.

## Before you start

"Deliver it", "finish it", and "finish slice 2" all mean the same thing: find out how far the feature has got, and pick it up from there. Do not assume it starts at the spec.

1. **Find where it stands.** `node "${CLAUDE_PLUGIN_ROOT}/scripts/delivery.mjs" where <story id or spec file name>` prints the feature's stage and, once it has a spec, what its delivery still lacks. With no name it lists every feature; use that to turn what the lead called it ("slice 2") into a story or spec name.
2. **If it is at an earlier stage, this is not a delivery.** A story, design, or user documentation that is still to be written: write that one stage from the plugin's template and the guide, push the branch, tell the lead once that it is waiting for their approval, with the review link, and stop. Do not start a run, and do not write the stages after it. If it is already written and waiting for the lead's approval, tell them once and stop.
3. **Otherwise create the feature's branch** from the up-to-date default branch: `feature/<name>`, or the `claude/` branch the session was given.
4. **Start the run:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/delivery.mjs" start <story id or spec file name>`. It records that a run is under way on this branch and lists what is still to do. Name the feature when its spec is already on the default branch, so that the run finishes it from where it stands: a feature that was built before it had a tutorial lacks only the tutorial. From here until the run ends, a check at the end of each turn sends you back to work while anything on that list is missing.

Do only the steps on that list. Skip any step below that is already done and approved; do not rewrite an approved spec or rework code that passes.

## The run

One branch, a commit for each step, in this order:

1. **The spec**, `docs/specs/<feature>.md`, from the plugin's spec template: an `id`, `derived-from` linking the approved user documentation it comes from, and acceptance criteria that each name their source section. Take every criterion from the approved documents. Where they do not say, do not invent behaviour: see "When something is open". Check the finished spec against those documents, then set `status: approved`.
2. **The tests**, before any implementation, each citing its criterion (`<spec name>#AC-n`). Run them and see them fail for the right reason. Commit them on their own, and record that commit as the spec's `tests-commit`.
3. **The implementation**, until the project's verify command passes. Change the code, not the tests.
4. **The tutorial**, `docs/tutorials/<feature>.md`, deriving from the user documentation: the steps a person follows to try the feature. Run every step yourself against the built feature and record what happened. Leave it `status: draft`: the lead's approval of the tutorial is their validation, and it comes after they have followed it. A spec for work with nothing a user sees (its design says `no-user-docs`) needs no tutorial.
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

When everything is committed and pushed, the check asks you to report once. Tell the lead: what was built, anything in `docs/decisions/`, and how to review it. `node "${CLAUDE_PLUGIN_ROOT}/scripts/delivery.mjs" gate` prints the review link and the line the lead can run to approve from the Claude Code prompt. Then stop.

Say plainly that the feature is built and not yet validated. The lead gives two approvals, and they mean different things:

- **Approving the delivery's pull request** accepts the work onto the default branch. The lead may do that after reading your decisions.
- **Approving the tutorial** records that they followed it against the delivery and the feature does what the user documentation says. Until then the tutorial stays a draft, the process state lists the feature as built and not yet validated, and the release check does not count it.

## When the lead has validated

When the lead says they followed the tutorial and it holds, set the tutorial's `status: approved`, record its hashes (`node .rfr/checks/process-relink.mjs <tutorial id>`), and push that on its own branch. It is a gated change, so it reaches the lead as a pull request, and their approval of it is the validation on the record. Do not make that change before they say so.

When the lead reports that a step did not go as the tutorial says, find out which is wrong. If the code does not do what the approved user documentation says, that is a fix: a failing test first, then the code, with `Change: fix` at the end of the commit message. If the user documentation is wrong, change it and push it for the lead's approval. The tutorial stays a draft until every step holds.

If the session can subscribe to the pull request's activity, subscribe, so that review comments reach you.
