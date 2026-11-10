# Improvement plan for rfr-process (2026-11-10)

Status: proposed. Companion to [improvement-plan.md](improvement-plan.md), which covers the rules, `rfr-core`, and the evals. This document is Phase 23 of that plan and replaces its slices 19d, 19e, and the process half of 19g. Nothing here is decided until the maintainer approves it; approved changes then amend `docs/specs/project-process.md` with new acceptance criteria.

## What the pilots showed

Read from `docs/specs/project-process.md` (the Kettlebird and Agentic XR Pipeline findings), `plugins/process/`, and the checks. The pilots' pull request histories were not read, so how often an approval changed anything is not known yet; slice 23a measures it.

### Parts that earned their place

| Part | Evidence from the pilots |
|---|---|
| User documentation written before the spec | The pilot found a missing criterion by reading the spec against the approved documentation before implementing (round 4) |
| Runnable tutorials, recorded as the demo | The words a reader follows are the words that run; a manual tutorial pass by the lead found four defects the tests could not (round 6) |
| Persona walkthrough with mock-ups | Found an address shape that would break shared links, nine missing states, and mechanism flaws such as status kept only in the browser (rounds 2, 3, 5) |
| Mutation job | Found two wording bugs on its first run, and a later gap in alt text (rounds 5, 7) |
| Section-level staleness | Catches a draft built on changed upstream text (round 5) |
| Cross-area consistency pass | Found about a dozen conflicts across nine requirement files that had each been reviewed (XR round 1) |

Four of these six are agent or CI work. The lead's own contribution shows up in two places: catching tools drafted into requirements at a design gate (round 1), and the manual tutorial pass.

### Costs

- **Gates.** A story-tier change passes up to four approver gates before release (stories, design, user documentation, demos), and a new product passes up to five before any feature starts (concept, discovery, requirements, personas, epics). In solo mode each approval is a merged pull request, and delivery cannot start from a `draft`.
- **Mechanics.** About a dozen of the 27 criteria added after launch (AC-27 to AC-53) fix the process's own machinery: tier labels, hash recording, draft and approved status, merge prompts, and false alarms from the approvals job. One merge prompt waited six and a half hours.
- **Team features with no user.** Team-mode approvals, CODEOWNERS, per-stage approvers, and the Project board sync are built and tested, and no pilot has used them.
- **Unfinished.** Slice 11d has not started: the release readiness check, release notes, the stage 8 template, and the eval round (AC-12 to AC-14, AC-18). `persona-walkthrough` is still experimental with no eval.
- **The spec is also a diary.** `project-process.md` is 520 lines, more than half of it pilot findings, and the guide is 292 lines that an agent reads whole.

### The user story to change

The spec's first story has the lead approve seven kinds of artifact before technical work starts, "so that misalignment is found while it is cheap to fix". That reasoning assumes implementation is the expensive step. With agents it is the cheap one, and the lead's attention is the scarce one. The spec's second story (agents carry a feature to demos without asking at each step) is the one that matches the goal.

## Why the intent reviews stay

Before rfr, the maintainer often got results that worked but were not what they wanted, needed many change requests to get close, and saw new features break old ones. On recent rfr projects none of that has happened. The likely causes, in order:

1. **Intent made explicit and reviewed before code.** User documentation written before the spec, designs with mock-ups, tutorials that say what the reader will see. A better model cannot supply intent it was never given, so this is the process, and specifically the maintainer's review of those artifacts. The pilot shows it: the lead caught tools drafted into requirements at a design gate.
2. **Decisions that accumulate as checks.** Criteria tests and runnable tutorials from every feature, run against the whole product on every change.
3. **Honest tests.** Without TEST-001 and WA-002, both 5.5 models changed a wrong test to get green in every run, so a regression would often have been hidden by editing the test that caught it.

Most of the rule library targets failures the 5.5 models no longer show without rules (scope creep, over-engineering, destructive git), and is probably not what changed the results.

So this plan keeps the maintainer's review of design and user documentation, and makes it cheaper: one packet per feature instead of one pull request per stage, reviewed while agents build instead of before. What it removes is the review of artifacts the agent derives from what the maintainer already said (requirements, epics, stories), which a product brief or feature packet covers in one reading.

## Target

The person supplies intent at the start, taste where a choice is open, and judgement of the running result. Agents do the derivation, the consistency checks, and the reviews, and bring the person a packet that takes minutes to decide.

| Change | Approver decisions now (up to) | Proposed |
|---|---|---|
| Trivial, fix | 0 | 0 |
| Story | 4: stories, design, user documentation, demo, each blocking the next | 2: the feature packet (story, design, and user documentation together), reviewed while agents build, and the demo. The two can be one sitting when the packet is reviewed beside the recording |
| Epic | 1 for the epic, then 4 per story | 1 for an epic brief, then 2 per story |
| New product | 5: concept, discovery, requirements, personas, epics | 2: answers to one batched interview, then a product brief |
| Release | 1 | 1 (public, so it stays) |

## Decisions the maintainer makes first

| # | Decision | Recommendation |
|---|---|---|
| P1 | Gate types per stage | Three types: `approve` (a person, blocks the merge), `notify` (a person is told and can object afterwards), `agent` (an independent reviewer approves). Delegated defaults: `approve` for the concept, design, user documentation, demos, and release; `notify` for discovery, requirements, personas, epics, and stories, which reach the person inside a brief or packet. |
| P2 | Batch derived artifacts | Yes. One product brief and one feature packet instead of a pull request per stage. |
| P3 | Delivery from unapproved artifacts | Yes, on a branch, after the probes in 23k. The delivery pull request cannot merge until its `approve` gates pass. |
| P4 | Tier labels | Infer the tier from the changed paths; a label only overrides upward. |
| P5 | Team-mode features | Keep, mark as not exercised by a pilot, and stop work on them until a team adopts. |
| P6 | Remaining 11d scope | Build the release readiness check and the stage 8 template. Defer release notes and the triage skill until a pilot asks. |
| P7 | Separate repository | Defer until the framework goes public (D6 in the main plan). |

## Slices

### 23a: Measure the gates (first, no behaviour change)

Branch `phase-23/gate-report`.

- `checks/process-gate-report.mjs`: from a repository's merged pull requests (`gh`), list each gated pull request with its stage, the time from ready to merged, and whether anything changed between the first request for approval and the merge (commits or review comments).
- Run it on both pilots. Commit the summary under `evals/results/`, with project details removed.
- This is the baseline for every slice below, and the input to 23g.
- Acceptance: unit tests with stubbed API responses; the two baseline summaries.

### 23b: Gate types

Branch `phase-23/gate-types`. Needs P1.

- `plugins/process/templates/process.yml` and `checks/lib/process.mjs`: a `gates:` mapping from stage to `approve`, `notify`, or `agent`, with today's behaviour (`approve` everywhere) as the supervised default.
- `checks/ci/process-approvals.mjs`: requires the approver only for `approve` stages. For `notify` and `agent` it requires a recorded independent review on the head commit.
- `plugins/process/scripts/guard-merge.mjs`: asks only for pull requests that touch an `approve` stage.
- `notify`: after merge, the workflow posts one line per artifact to the decision queue (main plan 19c). An objection is an amendment through the normal staleness rules.
- Acceptance: tests for each type in the approvals job and the merge guard; `process.yml` validation rejects unknown types.

### 23c: Briefs and the review packet

Branch `phase-23/briefs`. Needs P2.

- **Batched interview.** `bootstrap` and the guide: before drafting, ask every question the concept and requirements need in one batch, each with a proposed answer. Unanswered questions become `[assumed]` markers.
- **Product brief.** Concept, discovery, requirements, personas, and epics drafted together in one pull request. Before the person sees it, agents run the cross-area consistency pass and the persona-against-requirement pass, which the guide already describes.
- **Feature packet.** Story, design with mock-ups, and user documentation in one pull request. An epic gets a shorter epic brief the same way.
- **Review packet.** A generated section at the top of the pull request description: the choices that need taste, every `[open]` and `[assumed]` marker, the walkthrough's blocker and major findings and what was done about each, and links to the mock-ups or the recording. `checks/process-trace.mjs` already lists the markers; a script assembles the rest.
- Acceptance: tests for the packet script on a fixture repository; the guide and both skills updated; a smoke case for `bootstrap`.

### 23d: Delivery that does not wait

Branch `phase-23/provisional-delivery`. Needs P3, 23b, and the results of 23k. If the 23k feature showed that building before the packet review wasted work or anchored the maintainer on what was built, keep the packet review blocking and build only 23d's reporting of provisional specs.

- Link rule 3 changes in delegated mode: a stage 8 spec may link to a `draft` upstream artifact when the spec is marked `provisional`. `process-trace` reports provisional specs and counts them.
- A delivery pull request that rests on a provisional spec cannot merge until the upstream `approve` gates pass. If the approver changes the upstream text, the existing staleness rule forces the rework.
- For a story, the packet review stays its own decision and stops blocking: agents build while the person reviews the design and documentation, and the person may review the packet beside the recorded tutorial on the preview deployment, deciding both in one sitting.
- A manual tutorial stays a person's job where CI cannot drive the interface, since that pass found defects nothing else did.
- Acceptance: tests for the provisional path, the blocked merge, and rework after an upstream change. The `design-gate-respected` eval case is rewritten for both modes.

### 23e: Choose between running variants

Branch `phase-23/variants`. Needs 23d.

- The design template gains an "Options" section, used only where a choice is marked `[open]`. For each, the agent builds up to three variants as preview deployments or recorded tutorials, and the review packet shows them side by side.
- A cap in `process.yml` (`max-variants`, default 2) bounds the cost.
- Acceptance: template and guide changes; a test that the packet lists variants; one pilot story run this way before it becomes a default.

### 23f: Infer the tier

Branch `phase-23/tier-inference`. Needs P4.

- `checks/ci/process-tier.mjs`: derive the tier from changed paths with the rules AC-10 already states (process folders, `public-api`, documentation paths). A label can raise the tier and cannot lower it.
- Removes the red first run and the label wait that AC-27 and AC-39 work around.
- Acceptance: the AC-10 cases pass with no label; a lower label than the paths imply fails.

### 23g: Demote gates by data

Branch `phase-23/gate-demotion`. Needs 23a and 23b.

- The gate report flags an `approve` stage as a candidate for `notify` when the approver merged without changes in at least 95% of 20 or more decisions, the rule the guards already use. It proposes; the maintainer edits `process.yml`.
- The reverse also holds: a `notify` stage whose artifacts drew objections in more than a set share of cases is flagged to go back to `approve`.
- Acceptance: report tests with fixture histories.

### 23h: Evidence for the reviewers that carry the load

Branch `phase-23/process-evals`. Paid runs wait for approval.

- With fewer human gates, `persona-walkthrough` and the independent reviews carry more weight, and the walkthrough has pilot evidence but no eval. Build the 11d cases: `persona-docs-mismatch`, `stale-upstream`, `tier-escalation`, `withdraw-loophole`, and `design-gate-respected` in its two-mode form.
- Add smoke cases for `persona-walkthrough`, `setup`, and `bootstrap`, so each has a ledger entry (AC-18).
- The spec's own research found that persona prompts make output more believable, not more accurate. So the eval scores the walkthrough on planted defects only, and the demo gate stays with a person whatever the result.
- Cost: not estimated. These are multi-turn cases; price one cell before the rest, as the Phase 10 plan does.

### 23i: Finish the useful part of 11d

Branch `phase-23/release-readiness`. Needs P6.

- `checks/process-release-check.mjs` (AC-13): stories that lack an approved tutorial or have a stale or draft ancestor.
- The stage 8 template with the "Clarify" section (AC-12), confirmed against `spec-trace` and `spec-lock`.
- Release notes and the triage skill stay deferred.

### 23j: Hygiene

Branch `phase-23/process-hygiene`.

- Move the pilot findings out of `docs/specs/project-process.md` into `docs/research/pilots/`, one file per project, leaving the spec as the specification with links to them.
- Split `plugins/process/GUIDE.md` by stage, so an agent working on a design reads the design section and not the whole guide. The setup skill copies or links the parts.
- Name new process tests by behaviour, not by pilot round. Existing files stay as they are.
- In `plugins/process/README.md`, mark team mode, CODEOWNERS, per-stage approvers, and the Project board as not yet exercised by a pilot (P5).
- Acceptance: `npm run verify`; `spec-trace` still finds every cited criterion after the move.

### 23k: Two probes before provisional delivery

No branch of its own; results go under `evals/results/` with project details removed. These are judged by the maintainer, not graded, and each takes one feature.

- **Counterfactual.** In a throwaway branch of a current project, with no rfr plugins, rules, or process files, the maintainer gives a current model a feature request worded the way they would have before rfr. The agent sets up the branch and session; the maintainer judges whether the result is what they wanted and whether anything broke. If it is, the model is doing more than assumed, and the process can be lighter still. Expected: it is not, because the missing piece is intent, not skill.
- **One feature in the lighter mode, by convention.** Before any tooling for 23d: one real story with a single feature packet, built on a branch while the maintainer reviews the packet, then the demo. CI's rule 3 failure on the branch is expected and the branch does not merge until the packet is approved. The maintainer judges three things: did the result match what they wanted, did anything break, and did seeing a build early help or anchor them.
- Record both results in a short note, with the maintainer's judgement quoted, and update P3 and 23d from them.

## Order

1. P1 to P7, and 23a, which needs no decision. The maintainer reading one project's history for where their corrections happened is an acceptable first pass of 23a.
2. 23j and 23f: small, and they lower the cost of everything after.
3. 23b, then 23c.
4. 23k, then 23d, then 23e on one pilot story.
5. 23h once the cases are built; 23g when 23a has enough history.
6. 23i before the first release that uses the process end to end.

Slices 23b to 23d depend on the main plan's 19b (the delegated mode setting and the decision log) and 19c (the decision queue).

## What stays with a person

- The concept, and the answers to the batched interview.
- The feature packet: design with mock-ups, and user documentation. This is where "worked but not what I wanted" is caught.
- Taste choices marked `[open]`, shown as mock-ups or running variants.
- Corrections, which go into the project's preferences log (main plan 19h) so they are given once.
- The demo, and a manual tutorial where CI cannot drive the interface.
- The release.
- Any `notify` item the person objects to.

## Risks

| Risk | Mitigation |
|---|---|
| A wrong direction is built before anyone looks | The work is bounded to one story's branch; the staleness rule limits rework to what derived from the changed section; 23a reports how often it happens, and 23g moves a gate back to `approve` if it happens often |
| Agent reviews approve plausible but wrong artifacts | The demo gate stays human; the walkthrough is scored on planted defects in 23h; `notify` items remain open to objection |
| Large briefs are harder to review than small artifacts | The review packet puts the decisions first; the consistency and persona passes run before the person sees it |
| Variants multiply cost | `max-variants` cap, and variants only for choices marked `[open]` |
| Two modes double the test surface | The supervised defaults are today's behaviour, so existing tests keep covering it; new tests cover only the delegated paths |
