# Reviews and changes

Part of the [rfr-process guide](../GUIDE.md).

## Persona walkthrough

A persona walkthrough is a cognitive walkthrough done once per persona: at every step, where would this persona fail, and why? Run it on design notes, user documentation, and tutorials before the approver reviews them. The `persona-walkthrough` agent does this; you can also do it by hand. Look for failures deliberately at each step: studies of LLM walkthroughs found that models finish more tasks and spot fewer failure points than people unless asked for failures explicitly, and that playing a persona makes the output more believable rather than more accurate. For a web tutorial, run it against the product first (`tutorial-run --record`); a step that fails there is a fact, not a prediction.

1. Pick the personas the artifact's stories name. Read each persona file in full.
2. For each persona separately, read the stories first, as their expectations.
3. Read the artifact from the top with only that persona's skills and vocabulary. For a tutorial, do the steps, on the product if it runs.
4. Check each key term the stories' criteria rely on ("no placeholder text") against anything in the product that looks similar (an honest empty state), and report a term the artifact does not define precisely enough to tell them apart.
5. At each step ask four questions: will they know what to do, will they see the control or information they need, will they connect it to their goal, and after acting, will they know it worked and get what they expected? Note every "no", and every listed frustration the page triggers.
6. For each finding, record where it is, what the persona would do, what they expected and why, how bad it is (blocks, misleads, or slows), and which artifact most likely needs to change.

The walkthrough informs the approver; it does not replace them. Whether an agent's walkthrough finds the misalignments real users find is an open question the Phase 11 evals test.

## Turning an intermittent visual report into a test

A report like "the header sometimes flashes on page turns" can be made deterministic. In the pilot, a headless screencast caught the flash in one frame out of four turns: a script scrolled the page after the first paint. The regression test registers an init script that records `window.scrollY` in the first `requestAnimationFrame` after navigation, then asserts the value. It failed before the fix and passed after, every run. Look for the earliest observable state that differs, record it from inside the page, and assert on that rather than on a screenshot timed by luck.

## When things change

Any stage can be revisited, and a later stage often finds the reason: a requirement that contradicts a concept non-goal, a persona that a requirement fails. When that happens, decide which one is wrong. If the earlier artifact is, amend it in its own pull request (approved by its own stage's approver), and let the later work wait on it or carry on as a draft that links to the amended section; do not quietly work around it downstream. If the later work is wrong, change that instead. Either way, say in both pull requests which finding led to the change.

To amend an approved artifact (a new section, a corrected step), edit it and keep `status: approved`: the pull request carries the change, and the approver's review approves the amended text. `draft` is for new artifacts; setting an approved one back to `draft` means withdrawing it, which needs a `withdrawn:` reason and issue.

When an upstream section changes, every approved artifact that links to that section is stale and CI fails, so the same pull request deals with each one:

- **Update** it to match, then record new hashes with `node .rfr/checks/process-relink.mjs <id>`.
- **Re-record** its hashes unchanged, when the change does not affect it.
- **Withdraw** it to `draft` with `withdrawn: <reason> (#<issue>)`. Anything approved that links to it then fails too, so the gap is visible all the way down.

Link to sections, not whole artifacts. A link to `concept` goes stale on any edit to the concept; a link to `concept#audience` only when the audience changes. The templates link to sections; keep it that way when you add links.

Recording hashes is not approval: the pull request that carries them is approved by the stage's approver like any other change. An artifact becomes approved only through a pull request that sets `status: approved` and records its hashes; merging a pull request whose artifacts still say `draft` leaves them drafts (see the README's "How an artifact becomes approved"). Run `node .rfr/checks/process-trace.mjs --status` to see how far each persona, epic, and story has reached and what needs attention.

## When the same correction comes back

The review checks for each stage in this guide are a starting list. A project adds to them from what its own reviews keep finding, so a problem is caught by a check rather than by the approver a third time.

- **A correction from the approver** (a change asked for on a packet, an artifact sent back at a gate, a demo that missed) is applied and recorded in `docs/preferences.md` in the same pull request, like any other correction from the lead. The persona walkthrough and `rfr-core:ux-reviewer` read that file, so it reaches the next review.
- **The same problem found a second time** at the same stage, by the walkthrough, a reviewer agent, or the approver, is a gap in the checks rather than a one-off: a second design with no mock-up for its error state, a second user documentation page that names a control no design defines. Add one line for it under a `## Review checks` heading in `docs/preferences.md` (add the heading if it is missing), naming the stage, the check as a question, and the two pull requests that found it. From then on, run it in the self-check before opening that stage's pull request; the walkthrough runs it too. If an existing check in this guide already covers the problem, the check is being skipped, not missing: say so in the line, and run it.
- **When the check would help any project**, also report it with `/rfr-feedback:report-feedback` (if the project uses `rfr-feedback`), so it can become a check in this guide.
- **Remove a line** when the approver says it no longer matters, or when the check it describes is now done by CI. Every line costs reading time at every review.


- **Claim a fix or a trivial change in the commit, not a label.** A pull request that changes source must belong to a feature with an approved spec, or say `Change: fix` or `Change: trivial` at the end of a commit message; the `process / change` check holds it to that claim (a fix changes a test and adds no source file; a trivial change adds no source file and touches no `public-api` path). There are no tier labels.
- **Propose `approved` from the start.** The approver's review is the approval, so open the pull request with the artifacts already set to `approved` and their hashes recorded; if the approver asks for changes, the agent updates them in the same pull request. This does not mean the agent approves anything: nothing is approved until the approver reviews it. When the artifacts still have `[open]`, `[assumed]`, or `[proposed]` markers, or the approver has not seen a draft, offer them a read first and list the markers in the pull request description. Keep `draft` for work that will not merge yet. In team mode the two-step flow in the README still applies.
- **Merging is GitHub's.** Under the GitHub gate a workflow turns on auto-merge for each pull request, so it merges when its checks pass and, if it touches a gated folder, when its approver has approved it. Agents do not merge or approve pull requests, and nothing said in chat changes that ([github-gate](../../../docs/specs/github-gate.md)).
- **Batch artifacts of the same stage** into one pull request when the approver will read them together (three personas, or an epic's stories), and keep stages apart, so each pull request has one approver and one kind of review.
- **Stack pull requests for linked artifacts.** A story's pull request can be based on its epic's branch, so both are reviewed in parallel; merge the epic first, then retarget the story to the default branch. The story cannot be approved before its epic is, because the check fails an approved artifact that links to a draft. Check that the project's own CI runs on stacked pull requests: workflows often run only on pull requests into the default branch, and retargeting does not re-run CI unless the workflow listens for `edited`. After retargeting, merge the default branch into the story's branch and push, so every check runs on what will merge.
- **Some cloud agent sessions can push to only one branch.** They cannot stack pull requests or keep two open at once; work through the stages one pull request at a time, or batch.
- **Pull request numbers skip.** Issues and pull requests share one sequence, and issue sync creates an issue for each persona, epic, and story, so gaps between pull request numbers are normal.
