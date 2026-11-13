---
status: draft
---

# Revisions and shared foundations

A project changes its mind after things are built: a new colour palette, a renamed role, a different navigation. This spec says how such a change is made once and carried through everything that depends on it. It has two parts. A **foundation** is one approved document for something many features share, with the design system as the first kind. A **revision packet** is the pull request that changes an approved document: it shows what the change reaches, deals with every document that cites it, and leaves the built features that are now behind as open deliveries. The lead approves the packet once; agents carry the rest. This is proposed as Phase 26 of `PLAN.md`, after the 25f acceptance test. Nothing here is built. The `status` field stays `draft` until every `test:` criterion has a citing test.

## Problem

The process handles a new feature well and a later change badly. What exists today (`project-process.md`, "Staleness and what a pull request must do"): every link records a hash of the section it cites; an approved artifact whose upstream section changed is stale, and a stale artifact fails CI; the pull request that makes the change must update, re-record, or withdraw each direct dependant. Five gaps showed on XR Studio In A Box during the 25f acceptance test, and the maintainer expects the same on other projects.

1. **A change cannot be approved before its code exists.** Rule 4 applies to specs and tutorials as well as designs. So a pull request that changes approved user documentation must also bring every spec and tutorial that cites it up to date, or re-record them as if nothing changed. On 2026-11-13 the slice 4 delivery changed two sentences of slice 1 and slice 3 user documentation, and had to re-record two specs and two tutorials it had not otherwise touched. A larger change would force the documents, the specs, the tests, and the code into one pull request, which is the opposite of approving the packet first and delivering after.
2. **Nobody sees the size of a change beforehand.** The only way to learn what cites a section is to change it and read the CI failures.
3. **Shared things have no home, so the ripple is not detected.** XR Studio In A Box has eleven approved designs and about seventy mock-ups that share one stylesheet (`docs/design/wireframe.css`). No design links to anything that describes that style, so changing it makes nothing stale. The one shared document it has, a decision note on navigation, had to derive from stories, which joined unrelated features together in the process state (fixed in #252).
4. **A foundation's code is outside the process.** A restyle adds no source file, so a commit that says `Change: trivial` passes the change check with no approved design behind it.
5. **Images are not tracked.** Hashes cover text. A mock-up rendered from HTML before a style change stays as it was, and the scripts that rendered slice 4's mock-ups ran from the session's scratch folder and were not committed, so nobody can render them again the same way.

A sixth point is about the review itself. A style change that reaches fifteen designs gives the lead fifteen diffs, most of them a changed hash and nothing else. The three designs whose text changed are the ones to read.

## User stories

- As a project lead, I want to approve a change to something already built as one packet of documents, and have the built features brought up to it afterwards without me, so that a revision costs me one review and one validation.
- As a project lead, I want to see what a change reaches before I approve it, so that I can decide whether it is worth it.
- As a project lead, I want the review to separate the documents that changed from those only re-recorded, so that I read what matters.
- As a project lead, I want one place for what many features share, starting with the design system, so that mock-ups and the product look the same and a change to it is one edit.
- As a project lead starting a project, I want to say up front whether it adopts an existing design system, defines its own, or has none yet, so that the first mock-ups are not each invented from nothing.
- As an agent, I want to be told that a built feature is behind an approved revision, and which sections changed, so that I bring it up to date instead of treating it as done.

## Design

### Two sides of the chain

The stages split where the lead's packet ends. The **document side** is the concept through user documentation, with designs, decision notes, and foundations: what the lead reads and approves. The **delivery side** is specs and tutorials, and through them tests and code: what agents build from it.

- On the document side nothing changes: a stale artifact fails the check, and the revision packet deals with each direct dependant, so what the lead approves is consistent.
- On the delivery side, staleness stops being a failure and becomes work. A spec or tutorial that is behind an approved upstream section is a **revision open** for its feature. The process state says so, `delivery open` lists it, and the `deliver` skill brings the spec, tests, code, and tutorial up to date on one branch. The release check already refuses a release with a stale ancestor, so nothing ships behind.

A pull request that changes a spec or tutorial must still leave that one up to date: a delivery cannot merge half a revision.

### The revision packet

A pull request is a revision when it changes the text of a section that an artifact approved on the default branch links to. Nothing has to be declared. For such a pull request:

1. **Before the change**, the agent runs the impact report for the sections it means to change and tells the lead the size in one message when it is large (a threshold is not set here; the report's first line gives the counts).
2. **In the pull request**, each document-side dependant is updated, re-recorded with a one-line reason, or withdrawn. The reasons go under `## Revision` in the branch's decisions file (`docs/decisions/<branch>.md`), with why the change is being made.
3. **The description**, written by the workflow, has a Revision section: the sections that changed; the dependants that were updated, first, as the ones to read; those re-recorded as unaffected, as a count and a list with their reasons; those withdrawn; and the delivery-side artifacts now behind, which become open revisions when the packet merges.
4. **After the merge**, each feature behind is delivered like any open delivery, one at a time, by the routine the merge fires.

### Foundations

A foundation is an approved document for something several features share and none owns: the design system, navigation, the roles model, terminology, the data model. It lives in `docs/design/foundations/`, is gated as a design, and is cited by section like any other artifact. It may derive from the concept, requirements, personas, or epics, since it usually exists before the stories do.

A foundation can have code of its own (a token file, a theme, a shared component library). It names those paths in `implemented-by`, and a spec may derive from the foundation directly, as a spec may from a design marked `no-user-docs`. Changing a named path then needs that spec: it cannot go in as a fix or a trivial change.

### The design system

The design system is a foundation with its own template, `docs/design/foundations/design-system.md`, in one of two forms:

- **Declared:** it adopts an existing system, named with its version and where its reference is (`adopts: Unreal Editor Slate style, UE 5.6`, `adopts: shadcn/ui with its default theme`). The body says what the project changes, if anything.
- **Defined:** sections for colour, type, spacing, lines and borders, and components, and a `tokens:` path to one file that holds the values.

When a design system is approved, every design with mock-ups cites the sections it uses. When it has a token file, the mock-ups' HTML and the product both read that one file, so a change to the system is an edit to it, a re-render of the mock-ups, and one delivery for the product.

It is optional. Setup and bootstrap ask the question in the batched interview, with an answer proposed from the project's profile. "None yet" writes nothing, and adding one later is itself a revision.

## Acceptance criteria

Slices are in "Delivery". Criteria marked D are subject to the decision of that number below.

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `changedSections(root, base)` in `checks/lib/process.mjs` lists, for the working tree against a base ref, each section of an artifact approved on the base whose hash differs and which an artifact approved on the base links to. A pull request with any is a revision. An artifact new in the branch, a draft, and a change to a section nothing links to are not. | test: a changed linked section; a changed unlinked section; a new artifact; a draft; a whole-artifact link. |
| AC-2 | `checks/process-impact.mjs` prints what a change reaches, for sections named as `<id>[#section]` or, with `--base <ref>`, for `changedSections`. First a line of counts. Then the direct dependants on the document side, which the packet must deal with; the specs and tutorials that link the section directly, which become open revisions; and, below each of those, the features they belong to (process-state AC-13), the test files that cite an affected spec, and the paths a changed foundation names in `implemented-by`. `--json` gives the same as data. It makes no network call and changes nothing. | test: a fixture with a foundation, two features, and a decision note; the counts, each group, and the JSON; a section nothing cites. |
| AC-3 | The process check keeps rule 4 as a failure for the document side (concept, discovery, requirements, personas, epics, stories, design, user documentation). An approved spec or tutorial that is stale is reported as `revision open: <id> is behind <link>` and does not fail the check, on a pull request or on the default branch, and opens no `stale` issue. A spec or tutorial that the pull request itself changes or adds still fails when stale. (D1) | test: a stale design fails; a stale spec and tutorial pass with the note; the same spec changed in the branch and still stale fails; the default-branch run opens no issue for them. |
| AC-4 | `featureSteps` gives a story the step `revise` when a spec or tutorial in its feature is stale: it comes before `validate` and `done` and after `delivering`. The session text lists it under "Open for an agent" as `revision open: <files> are behind <the changed sections>`. The release check is unchanged and still lists such a story as not ready. | test: a built and validated feature whose user documentation section changed; a feature whose design-system link changed in a re-recorded design is not behind; the text; the release check. |
| AC-5 | `delivery open` lists a revision as it lists a new delivery, marked `revision`, and leaves it out when another branch on the remote changes the stale spec. `delivery start <name>` for it scopes the run to the stale specs. `deliveryMissing` asks for: each stale spec brought up to the changed sections with its hashes recorded; tests for criteria that changed, under the existing lock and `unlocks:` rules; each stale tutorial run again with its hashes recorded. | test: an open revision listed, under way, and started; each missing item; a finished revision. |
| AC-6 | A tutorial changed by a revision reaches the lead through the delivery's pull request, which touches a gated folder and so waits for their review. Its status stays `approved` when only its hashes or its recorded results changed and every step still holds; it goes back to `draft`, for the lead to follow again, when a step's words changed. The description says which. (D3) | test: the description for a tutorial re-recorded and for one with a changed step; the skill's text. |
| AC-7 | `checks/ci/process-pr-body.mjs` adds a Revision section to the description of a pull request that is a revision: the changed sections; dependants updated in the pull request, listed first; dependants re-recorded as unaffected, as a count and a list, each with its reason from `## Revision` in the branch's decisions file or "no reason given"; dependants withdrawn; and the specs and tutorials that will be behind after the merge. A pull request that is not a revision has no such section. (D4) | test: a revision with one of each; a missing reason; a pull request that only adds a feature. |
| AC-8 | rfr-process has a `revise` skill: run the impact report for what is to change and tell the lead its counts once; make the change; deal with each document-side dependant, and never re-record one without reading the changed section against it; write `## Revision` with the reason for the change and for each re-record; re-render mock-ups a changed token file or stylesheet affects; push the branch and tell the lead once. It does not touch specs, tests, or code. The guide's "reviews and changes" part describes the flow and the two sides. | test: the skill's text and the guide. |
| AC-9 | `docs/design/foundations/` holds foundations, which belong to the design stage and are gated with it. A foundation satisfies stage order by deriving from the concept, a requirement, a persona, or an epic, as well as from a story; the process check and the session guard both accept it. It joins no story's feature. A draft foundation is listed with the product-level drafts in the session text. `templates/artifacts/foundation.md` is its template. (D6) | test: a foundation from a persona passes the check and the guard; one with no link fails; the session text; the template. |
| AC-10 | A foundation may list repository paths or globs in `implemented-by`. A spec may derive from an approved foundation in place of user documentation, and needs no tutorial. The process state lists an approved foundation that has `implemented-by` as its own line: delivery open with no spec, under way with a draft spec, `revision open` with a stale one. | test: each state; the guard allowing the spec; `deliveryMissing` asking for no tutorial. |
| AC-11 | The change check fails a pull request that changes a path a foundation names in `implemented-by` unless it carries or rests on an approved spec that derives from that foundation. `Change: fix` and `Change: trivial` do not excuse such a path, as they do not excuse a `public-api` path. | test: a token change declared trivial; the same with the foundation's spec; a path outside `implemented-by`. |
| AC-12 | `templates/artifacts/design-system.md` is the design system's template, for `docs/design/foundations/design-system.md` with the id `design-system`. The process check fails a design system that has neither `adopts:` nor a `tokens:` path to a file that exists. The guide's design part describes the declared and defined forms and when each fits. | test: each form passing; neither; a `tokens:` path that does not exist; the guide. |
| AC-13 | When an approved design system exists, the process check fails an approved design that has a mock-ups table and links to no section of it. The design template has the link line. (D2) | test: a design with mock-ups that cites it, one that does not, a design with no mock-ups, and a project with no design system. |
| AC-14 | When the design system has `tokens:`, the process check fails a mock-up HTML file under `docs/design/` that does not reference that file, naming each; and the token file counts as `implemented-by` without being listed. | test: an HTML file that links the tokens, one that does not, and a project with a declared system. |
| AC-15 | The `setup` and `bootstrap` skills ask about the design system in the batched interview with a proposed answer: for `unreal-plugin`, adopt the Unreal Editor's style; for `web-app` and `static-site`, adopt the component library the project already depends on, or define one; for `general`, none unless the project has screens. Adopt or define writes the foundation as a draft in the product brief. "None yet" writes nothing, and the skill says it can be added later as a revision. | test: both skills' text, and the three proposed answers. |
| AC-16 | `checks/mockup-render.mjs` renders each mock-up HTML file under a design's folder to a PNG beside it and records, in `.rendered.json` in that folder, the hash of the HTML and of each local stylesheet it references. The process check fails a PNG whose recorded hash differs from the current one, or that has an HTML source and no record. A mock-up with no HTML source (a linked design tool, a hand-made image) is not checked. (D5) | test: a fresh render, a changed stylesheet, a PNG with no record, and an image with no HTML. |

## Decisions for the maintainer

| # | Decision | Recommendation | The alternative, and what it costs |
|---|---|---|---|
| D1 | Is a stale spec or tutorial a failure or open work? | Open work (AC-3 to AC-5). It is what lets a revision be approved as documents first. | Keep failing: every revision carries its code in the same pull request, or re-records specs it has not brought up to date, as happened on 2026-11-13. |
| D2 | Must existing designs cite a design system introduced later? | Yes, all of them. The pull request that introduces it adds the link to each, which is mechanical and is one review. The rule then has no date in it. | Only designs written afterwards: older designs are never made stale by a style change, which is the gap this closes. |
| D3 | Does a revised feature need validating again? | Only when a tutorial step's words changed. Every tutorial change still waits for the lead's review, because tutorials are gated. | Always back to draft: safest, and a restyle of ten features then asks for ten walk-throughs. |
| D4 | How is a wrong "unaffected" caught? | Show each re-record with its reason, in a group apart from the real changes. No new reviewer. | An independent reviewer agent judges each re-record against the upstream diff. More certain, costs tokens on every revision, and a new agent needs an eval round before it may gate. Worth a trial if the first real revisions show bad re-records. |
| D5 | Track mock-up images? | Yes, by the hash of their inputs, as the last slice. It needs no browser in CI. | Leave it to agents: a style change leaves old images in approved designs, and the lead reviews pictures that no longer match. |
| D6 | Where do foundations live? | Their own folder, `docs/design/foundations/`. Decision notes stay in `docs/design/decisions/` and keep deriving from stories. | A front-matter flag on any design: more flexible, and harder to see in a file listing and in CODEOWNERS. |

## Scope

- In: `checks/lib/process.mjs` (changed sections, the two sides, `revise`, foundations), `checks/process-trace.mjs`, `checks/process-impact.mjs` (new), `checks/mockup-render.mjs` (new), `checks/ci/process-pr-body.mjs`, `checks/ci/process-change.mjs`, the session guard `guard-stages.mjs` (a foundation's upstream, and a spec from a foundation), `delivery.mjs`, the `deliver`, `setup`, and `bootstrap` skills, a new `revise` skill, the guide's design and reviews-and-changes parts, three templates (`foundation.md`, `design-system.md`, the link line in `design.md`), tests, and `project-process.md`, `process-state.md`, and `delivery-run.md` amended where this changes them.
- Out: staleness that passes through more than one link (it stays direct only, as now); screenshots embedded in user documentation, which a delivery re-records when it runs the tutorial; visual regression of the running product, which is rfr-web's NEXT-004; templates for foundations other than the design system, which use the general one until a project shows what they need; moving existing decision notes into foundations; generating a token file from a design tool.
- Not changed: what the lead approves and where (reviews in GitHub on gated folders), the three ways to deal with a document-side dependant, and the rule that an agent never approves.

## APIs and assumptions

- This builds on #252: `featureFamily` (process-state AC-13) and `delivery open` (delivery-run AC-13). It is written against them and waits for that pull request.
- `guard-stages` changes in AC-9 and AC-10, so the guard freeze in the rewrite plan applies: these slices start after 25f passes, and each guard change is replayed against the maintainer's sessions before it merges.
- The first real use is XR Studio In A Box: its `docs/design/wireframe.css` becomes the token file of a defined design system, and its eleven designs gain the link (D2). That migration is the test of the guide and of AC-13 and AC-14, and it is a revision packet itself.
- Assumption: `checks/mockup-render.mjs` can use the Playwright that `checks/tutorial-run.mjs` already uses, so it adds no dependency. To be checked when slice 26e starts.
- Assumption: rendering is deterministic enough that the same inputs need not produce the same bytes; the check compares input hashes, never images.
- A re-record made without reading is still possible. AC-7 makes it visible and AC-8 tells the agent not to; D4 is the stronger answer if that proves too little.

## Delivery

- Plan item: `PLAN.md`, Phase 26. One pull request for each slice.
  - **26a, revisions as open work:** AC-1, AC-3, AC-4, AC-5, AC-6.
  - **26b, the packet's view:** AC-2, AC-7, AC-8.
  - **26c, foundations:** AC-9, AC-10, AC-11.
  - **26d, the design system:** AC-12, AC-13, AC-14, AC-15, then the migration of XR Studio In A Box.
  - **26e, mock-up images:** AC-16.
- Pull requests: none yet.
