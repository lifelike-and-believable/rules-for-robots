# Brief: implementing the improvement plans

For the agent assigned to this work. Read this first, then [improvement-plan.md](improvement-plan.md) (the main plan) and [improvement-plan-process.md](improvement-plan-process.md) (the process plan).

## Set by the maintainer

Confirmed by the maintainer on 2026-11-10, with every recommendation accepted as written.

| Setting | Value |
|---|---|
| Decisions D1 to D8 (main plan) and P1 to P7 (process plan) | The recommended answer for each |
| Merging | You may merge your own pull request when CI is green on its head commit, except one that changes how a MUST rule is enforced or spends money. Leave those open and continue on a stacked branch. |
| Paid eval runs | Only 21a, up to $20. Build and unit-test other cases, and leave their runs for approval. |
| Tags and releases | Not yours. Bump versions and write changelog entries; the maintainer publishes. |
| Access to the pilot repositories for the gate report (23a) | Read access through `gh`. If it is missing, build and test the script on fixtures and say the baseline is still owed. |

## What this is for

rules-for-robots has one user, its maintainer, who wants to direct agents that work on their own for long stretches. The maintainer supplies intent at the start, taste where a choice is open, and judgement of the running result. The framework currently asks for the maintainer in many more places than that, and each one stops the work until they return. Your job is to change the framework so it stops only where a person is the one who has to decide.

The measure is the maintainer's minutes, and the hours work sat blocked, per merged story. When you are unsure between two designs, choose the one that lowers that number without giving up the three things listed under "What does not change".

## How to work on this assignment

You are working the way the framework will work once you are done: decide, record, continue.

- When a choice comes up that the plans do not settle, make it, and write one line in the pull request's `## Decisions` section: what you chose, the alternative, and why.
- When something blocks one slice, park it with a note and move to the next slice that does not depend on it. A session that ends with three slices merged and one parked is a good result. A session that stopped at the first question is not.
- Collect questions for the maintainer and give them together at the end of your report, each with the default you proceeded on.
- Stop and ask only before something that cannot be undone or that reaches outside this repository: a force-push, a tag or release, a paid run beyond the allowance above, a public issue or comment on another repository, or deleting work that is not yours.

## The plans are a proposal, not a specification

They were written from a read of the repository in one sitting. Where a plan and the code disagree, the code is right; say what you found. Where a simpler design meets the goal, take it and record the choice. The slice boundaries, field names (`kind`, `gates:`, `mode`), and script names are suggestions.

Known gaps in the plans:

- The rules named for demotion in 18d are candidates. Only SEC-002's body was read. Read each before moving it.
- 28 of 654 tests failed on the maintainer's Windows machine. Some were missing local dependencies (Playwright); the causes of the rest were not separated.
- Cost figures marked "rough" are guesses. Price one cell before a round.
- Nobody has checked how often the maintainer's approvals changed anything in the pilots. Slice 23a finds out, and its answer can change the process plan. If approvals often did change things, keep more stages as `approve` and put the effort into the review packet instead of provisional delivery, and say so.

## Existing pieces, and how much weight each carries

Much of what is in this repository describes the behaviour you are replacing. It will be in front of you as rules, specs, tests, and hooks while you work. Sort it into three groups.

### What does not change

These hold in both modes, and nothing in the plans loosens them.

1. **Tests stay honest.** A test is never changed so that code with a defect passes. The test-edit hook, the shell-write guard, and the CI test change guard stay as they are unless a slice is specifically about them.
2. **Irreversible and outward actions ask a person.** Tier 4 in `practices/guards.md` is the list.
3. **Claims rest on evidence.** Run `npm run verify` before reporting a slice as done and include its output. Say plainly what you did not run.
4. **The maintainer reviews design and user documentation before they merge.** That review is the most likely reason rfr projects now produce what the maintainer wanted (see "Why the intent reviews stay" in the process plan). Make it faster, batched, and non-blocking for the build; do not turn it into `notify` or an agent review.

Repository conventions also stay: one slice per branch and pull request, named `phase-<n>/<slice>`; a version bump and a changelog entry with an "Adopters:" line for every plugin change; `npm run build` after changing `rules/` or `templates/`; Canadian English and plain sentences.

### What you are here to change

Treat these as a description of the old behaviour, not as requirements on the new one.

- **The stop-and-ask text** in WA-002, WA-003, and WA-004, and the stop in `plan-feature`. These rules are not installed in this repository, but their wording runs through the specs, guides, and agent definitions. You are not bound by it on this assignment; the section above replaces it.
- **The approver gates, tier labels, and link rule 3** in `rfr-process`.
- **Approved specs.** `docs/specs/project-process.md` lists "automating the approvers' decisions" as out of scope, and other specs fix behaviour the plans alter. An approved spec records a past decision. Amend it: add or change the criterion, note the date and this plan as the reason, and keep the old text only where it still describes supervised mode.
- **Principle 8 and R18** (nothing ships without an eval). They still hold for defaults. They do not stop you building the delegated mode: new behaviour ships opt-in, behind the mode setting or in `evals/candidates/`, and becomes a default when its eval passes. Do not wait for an eval before writing the code.

Do not shape the new design to preserve the old one. There is one user, so there are no installed copies to keep working: no compatibility shims, no deprecated aliases, no settings kept only because they exist today. A breaking change is a major version and a line in the changelog. Supervised mode should keep working because the plans say it is a supported mode, and for no other reason.

### Tests that encode the old behaviour

This is where the first two groups meet, so be exact about it.

Many existing tests assert behaviour the plans change: that a tier job fails with no label, that a merge of a gated pull request asks, that an approved artifact may not link to a draft. Changing those tests is correct, and it is different from weakening a test. The difference is which came first. If the specified behaviour changed and the test follows, that is maintenance. If the code fails and the test is changed to match it, that is gaming.

The route that keeps the two apart already exists, so use it:

1. Amend the spec with the new or changed criterion.
2. Add the test file to that spec's `unlocks:` with the criterion ID and a reason.
3. Change the test with the Edit tool. The hook reads the `unlocks:` entry; a shell write to an existing test is refused.
4. Name each changed test and its criterion in the pull request.

If a guard still asks after that, the classifier could not read the change. Answer in the pull request what changed and why, and carry on; do not look for a way around the hook. If a guard fires on something that is plainly safe, that is a finding for the guard corpus (`test/fixtures/guard-corpus.json`), so record it.

When a test fails and you cannot tell whether the behaviour or the test is wrong, leave the test, park that item with what you found, and continue elsewhere.

### What is yours to reshape freely

File layout, names, the contents of the guide and the spec's diary sections, generated output, and anything the plans themselves propose. Remove what a slice makes dead in the same pull request: the label wait that tier inference replaces, for example.

## Order

1. **Measure:** 19a and 23a. No behaviour changes. These are the baseline everything else is judged against.
2. **Housekeeping:** 18a and 18b, so `npm run verify` passes on Windows and the status documents are true.
3. **Delegated mode:** 19b, 19h (the preferences log), and 19c, then the 21a eval. If 21a shows the delegated wording lets test gaming back in, stop that line, keep the candidates out of `rules/`, and report; the process slices can still proceed on the mode setting alone.
4. **Process:** 23f and 23j, then 23b and 23c.
5. **Probes (23k):** set up the counterfactual branch and the one-feature trial, and hand them to the maintainer. Both are judged by the maintainer, so this is the point to stop the line and report. Do not build 23d until they have recorded the results.

That is the assignment. The rest of both plans (23d onward, rule classification and demotion, agent consolidation, the larger eval rounds, the new hooks, variants, gate demotion) waits for the maintainer to look at what steps 1 to 5 produced.

## What to report

At the end of each working session, a short report in this order:

1. What merged, what is open, and what is parked, with pull request numbers.
2. What the measurements showed, once 19a and 23a have run.
3. Decisions you made that the maintainer would want to know about, one line each.
4. Questions, each with the default you proceeded on.
5. Anything in the plans that turned out to be wrong.

Keep `PLAN.md` current as slices land; `npm run check:plan` fails on completed work with no pull request named.
