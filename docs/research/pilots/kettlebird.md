# Pilot findings: the Kettlebird website

Findings from the Kettlebird website pilot (rounds 1 to 10, the merge prompts, and the guard calibration review), moved here from [the process spec](../../specs/project-process.md) on 2026-11-10 (process plan 23j) so the spec reads as a specification. The criteria each round added are in the spec's acceptance criteria table; this is the record of why. Treat it as history: correct errors, do not rewrite it.

## Pilot findings: round 1 (2026-11-01)

The first real use, on the Kettlebird website ([kettlebird-website#28](https://github.com/lifelike-and-believable/kettlebird-website/pull/28)), produced a log of 16 findings after setup and bootstrap. Decisions taken from it:

- **Tier job friction.** Every new pull request showed one red tier run, because the job ran on `opened` before a label could be added; agents without `gh` could not create the labels; and the setup and bootstrap pull request fit no tier. The tier job now creates the labels, waits briefly for a label on `opened`, and lets the pull request that adds `process.yml` through (AC-27).
- **Bootstrap drafted tools into requirements.** Its instruction to describe "current behaviour" led to requirements naming Sanity, Ko-fi, and AO3, and to non-goals inferred from missing features; the lead caught it at the design gate. Bootstrap now asks for user-visible behaviour, names tools only as the current implementation, ranks the code and the live product above planning documents, and ends with a list of defects found, which become `tier:fix` issues once the requirements are approved.
- **Smaller fixes**: setup skips the starter personas when bootstrap comes next; both skills allow a commit when the task asks for a pull request; the guide covers existing planning documents, splitting or merging starter personas, and pinning the reusable workflow to a commit; the process check reports draft links with no recorded hash (AC-28).
- **Approval needs the status change in the approved pull request** (entries 17 and 18, after the bootstrap pull request was merged). Merging the bootstrap drafts left every artifact `draft`, so nothing downstream could start. Decided: an artifact is approved by the pull request that sets `status: approved` and records its hashes, and the approver's merge or review of that pull request is the approval; bootstrap now does the change in the same pull request once the approver says the drafts are ready. The agent that merged it did so on the lead's explicit instruction, in a session without the plugin, so the merge guard was not running and GitHub recorded the lead as the merger. Decided: an agent merges a gated pull request only on the approver's explicit instruction and then comments on it quoting the instruction; setup writes these rules into the project's `AGENTS.md` so they hold without the plugin. Decided by the lead the same day: the merge guard asks the person (a permission prompt) instead of denying, so an approver's explicit instruction to merge is carried out with their confirmation (AC-7 changed).
- **Added to 11g**: a reusable job that runs `runner: web` tutorials against each pull request's preview deployment (for example from a Vercel `deployment_status` event), because adopting projects have previews but no job to run tutorials against them.
- **Evidence for the process**: the step "run the project's own tests before each push" found 18 errors in a check the project's CI never ran, and bootstrap's evidence-gathering found real defects (broken links, an inaccessible lightbox, 404s rewritten to the home page).

## Pilot findings: round 2 (2026-11-01)

Entries 19 to 40 from the Kettlebird pilot, after the concept, requirements, personas, two epics, a story, its design, and a decision note had been approved. Decisions:

- **Whole-artifact links cause churn.** Bootstrap linked every requirement and persona to the whole concept, and the story template linked to the whole epic, so a one-line concept change staled ten approved artifacts, and adding a story's id to its epic staled that story at once. Templates and bootstrap now link to sections (AC-32).
- **The persona walkthrough found real design flaws.** On a story's design it found that chapterless comic series used a different address shape, so adding a chapter later would break every shared link, and that the story alone would ship a reader with no way forward; on a decision note it found nine gaps for the artist persona, four of them misleading. This is the first evidence for the walkthrough outside a test, for the 11d eval to measure. The agent now says how to walk a decision note.
- **Designs include visual mock-ups or wireframes.** A written flow is not enough for the approver or the walkthrough to judge a user interface. The design template requires them for every screen, panel, or dialog the design adds or changes (images in the repository or links to the design tool, with the state each one shows), and the walkthrough reads them (lead's instruction).
- **Control names drift between the design and the manual.** The walkthrough found names in the user documentation that no design defined. A warning-level check now catches them (AC-30).
- **Smaller decisions**: rule 8's persona matching is tightened (AC-29); the check prints the rules-for-robots commit it ran, because local and CI runs used different commits (AC-31); in solo mode an artifact's pull request proposes `approved` from the start and drafts are for work that will not merge yet; requirements may describe behaviour the product does not have yet, which epics then close; the epic template gains Dependencies, Open questions, proposed stories, release groups for stories that must ship together, and a size signal; a decision-note template for choices that span epics (it lives in `docs/design/`, so it is gated); a visitor-facing user documentation template for static sites, with the editor guide split into file-based and CMS variants; bootstrap checks the live content source; the guide covers running web tutorials in the project's CI against a fixture build with offline content (entry 46, which the pilot found a better default than a preview deployment while its CMS was empty), stubs that return wrong non-empty values so negative tests also start red (entry 44), the Playwright add-on that brings its own `playwright-core` (entry 45), checking that stacked pull requests get the project's own CI and re-running it after retargeting (entry 41), batching same-stage artifacts, stacked pull requests for linked artifacts, the one-branch limit of some cloud sessions, and why pull request numbers skip.

## Pilot findings: round 3 (2026-11-01)

Entries 47 to 50, from the first designs made with mock-ups. Decisions:

- **Mock-ups made the walkthrough much stronger.** With images to open, it found text and images that disagreed, nine states the text described and no image showed, and one blocking problem (a "file too large" state that told the artist to resize, which the story rules out). Rendering the images from an editable source in the same folder kept each round of fixes cheap, so the guide and the design template recommend keeping the source (HTML, or a link to the design tool) beside the images.
- **Mock-ups of a third-party interface** (a CMS's editing screens) settle labels, help text, states, and warnings, but cannot show what the tool's components support. The guide says the spec checks that.
- **The walkthrough surfaced an ambiguous word in a story** ("placeholder", which overlapped with honest empty states). The agent now checks each key term a story's criteria rely on against anything in the product that looks similar.
- **The bold-name check flagged emphasis.** Its warning now also offers removing the bold when it is emphasis (AC-30). Printing the rules-for-robots commit worked as intended.

## Pilot findings: round 4 (2026-11-01)

Entries 51 to 54, from the first delivery-stage pull requests. Decisions:

- **New links could not be recorded.** A `derived-from` entry written without the colon (`- persona-fan#goals`) was an error the relink script could not fix, so the pilot typed a placeholder hash. Both forms are now read as unrecorded links, and relink fills them in (AC-34).
- **Some stories have nothing to document or demonstrate.** A story that only removes things (placeholder text) gives a user page nothing to say and a tutorial nothing to show that the end-to-end tests do not. The guide says when the user documentation and tutorial stages may be skipped, and that the pull request says so and why, so the approver can disagree.
- **A criterion found after the tests commit** goes in as a new criterion with its own failing test in a second commit, listed in `tests-commit`; the earlier tests stay locked. The pilot found the gap by reading the spec against the approved user documentation before implementing, which the guide now recommends.
- **A user interface the CI cannot drive** (a hosted CMS editor behind a login): keeping the rules and messages in a module that does not import the editor let unit tests cover most criteria, and a `runner: manual` tutorial covers the rest. The guide gives this as the pattern.

## Pilot findings: round 5 (2026-11-02)

Entries 55 to 69, from the first runs of 0.9.0 and the designs that followed. Decisions:

- **Mutation testing found real defects.** Its first run found two wording bugs the locked criteria tests missed, and the survivor list was clear enough to act on. The job now posts its score as a check annotation, so it is visible from the pull request (AC-37). The static-site Stryker configuration mutates `src/lib/` by default: pages and data loaders are covered by end-to-end tests, which Stryker does not run, so their mutants only add noise.
- **The preview workflow runs from the pull request's own branch** on its own preview, before merge; the caller template said otherwise and is corrected. A protected preview failed with "could not see" an element, which reads as a product bug; the runner now names the protection (AC-36). The guide lists the choices when tutorials follow fixture content and previews read an empty CMS.
- **The check did not see a stale draft.** A draft built on a story that changed in the same pull request kept its old hash and the check said links were current. It now warns (AC-35).
- **The walkthrough found mechanism flaws, not only wording**: status kept only in the browser, a "never shown" promise that held by accident, a shared Publish that let one field block another, help text promising features the site lacks, and a mock-up the rendering code cannot produce. The design template asks how the system knows what it shows, what enforces each promise and what checks it, and what is published together. The walkthrough reads the code that renders each changed screen, checks help text against the site field by field, walks editor designs as the personas who read the changed pages, and notes the branch's base when related designs are still in review.
- **Smaller decisions**: requirements stay free of implementation notes (bootstrap puts them in `docs/product/notes.md`, which is not an artifact), so a factual change does not force a story tier; the Vale em dash rule allows one per paragraph by design; installing Stryker can update other packages in the lock file.

## Pilot findings: round 6 (2026-11-02)

Entries 70 to 80: adopting 0.9.3, the lead's manual pass of a CMS editing story, and two smaller stories. Decisions:

- **The manual tutorial found four defects the tests could not**, all where the project's code calls the CMS framework (a validation result the framework ignored, a drop handler that left an overlay stuck, a delete the framework refused, a delete the editor pane never heard about). Two were framework behaviours the spec assumed without saying so. The guide now says to wrap each framework call in a thin adapter tested with a fake, to list each framework behaviour the spec relies on under its assumptions, and to check wiring by its observable effect rather than a planned function name. A manual tutorial is walked once by its author before review, or its pull request says it has not been.
- **Old whole-artifact links cause churn.** A small addition to an approved design staled two artifacts that did not depend on it, because they linked the whole design. The stale message now lists the sections to link instead (AC-38).
- **Re-running a failed tier job replayed the old label** from the event, so only a fresh run from the label change passed. The job now reads current labels (AC-39). The guide's tier table says that any pull request adding or changing a design or user documentation is at least `tier:story`, however small the change it describes.
- **Smaller decisions**: each changelog entry ends with an "Adopters:" line; expected values that depend on outside facts (time zones, calendars) are worked out by hand and the reasoning noted in the test, and redoing an unpushed tests-first commit is fine; after a test-only change, run Stryker locally with `--force`; the manual tutorial template has a "Before you start" block with each server's command and address; mock-ups with several frames on one page use container units; the guide shows how an intermittent visual report became a deterministic first-frame test.

## Pilot findings: round 7 (2026-11-02)

Entries 81 to 83. Decisions:

- **Amending an approved artifact keeps it `approved`.** The pilot set an approved user guide to `draft` while adding two sections, as it would for a new guide, and rule 7 failed. Nothing said which way an amendment goes: the gated merge approves the amended text, `draft` is for new artifacts, and `withdrawn` is for real withdrawals. The guide says so, and the rule 7 message names both choices (AC-40).
- **Run the type check on the tests-first commit.** Against stubs, type errors in tests are easy to miss; the pilot committed the same unneeded `@ts-expect-error` twice.
- **Test each page state as a component.** A fixture build holds one set of content; splitting a page into components that take their data as props, rendered in unit tests (Astro's container API, for one), covers every state while the end-to-end suite keeps the fixture build.
- Observed, no change needed: mutation testing caught another real gap (alt text made only of spaces); an accessibility rule (visible link text must be part of the accessible name) shaped a design detail; the `unlocks:` list held up for test changes made after the build started.

## Pilot findings: round 8 (2026-11-03)

Entries 84 to 86, from the preview-before-publishing story. Decisions:

- **Verify platform behaviour before writing criteria that depend on it.** The spec's research said a hosting configuration file should still apply after a change of build adapter, and flagged it as unverified; a ten-minute throwaway build showed it would be dropped, with the site's security headers and a rewrite. The guide says to check such behaviour with a trial build or request first, and record the result under the spec's assumptions.
- **Designs inside a third-party interface name the version they were checked against.** An approved design put a button where that version of the CMS draws only a menu item. The amendment went well, but the walkthrough could have asked. The design template asks for a "Checked against <product> <version>" line, and the persona walkthrough checks each placement against it.
- **Check the pull request's own deployment for build and deployment changes.** The host's preview environment set a variable CI does not, chose a different build adapter, and the first deployment failed while CI was green. The guide makes checking the deployment, and saying what was checked, a step before asking for the merge. Kept as guidance rather than a check: the merge guard cannot tell whether a deployment was looked at.

## Pilot findings: round 9 (2026-11-05)

Entries 87 to 91, from finishing the story-reader epic. Decisions:

- **The type check in CI** (AC-44). A type error in a new test reached a push for the third time (entries 81 and 87): Vitest runs code whose types are wrong, and the type check is not part of the habitual test run. Guidance alone has not held, so the reusable workflow takes a `typecheck` command and runs it on every pull request. The guide says to run the type check with the tests, on fixes too.
- **Several criteria after one spec name** (spec-test-traceability AC-13). `spec-trace` read only the first criterion in `story-reader-editor#AC-2 AC-8`, so later ones were reported as uncited. The lead chose to accept the form rather than require `#AC-n` for each: `slug#AC-2 AC-8`, with commas or "and", now counts each criterion. This is in `checks/lib/spec.mjs`, which adopters run from the `.rfr` checkout; the `rfr-core` plugin does not change.
- **Nested packages** (AC-45). The mutation job ran `npm ci` in the root only, so a test importing code from a second package failed with "Cannot find package". The workflow takes `install-dirs`, used by the mutation and type check jobs.
- **Size requests by what they change.** A "feature request" with one obvious behaviour, no design choice, and no documentation of the old behaviour is a `tier:fix`. `tier:fix` still may not change `docs/user/`: a line documenting the fix goes in its own small pull request, which keeps the tier check simple.
- **A fixture build covers every content source,** with a test that it does. Five lists still read live content, and the first published art piece turned every branch red.

## Pilot findings: round 10 (2026-11-05)

Entries 92 to 96, from the two-page spreads and page-flip work. Decisions:

- **The test lock had never run on the pilot** (spec-test-traceability AC-14). Every spec there wrote `tests-commit` as a block list, which the parser did not read, so `spec-lock` checked nothing and reported success. It now reads the block list, and a `tests-commit` it cannot read any commit from is an error. Projects that wrote the block list will see their locks checked for the first time, and may find tests that were changed without an `unlocks` entry.
- **New test files in `unlocks`** (AC-15). A path marked ` (new)` is read without the marker and draws no warning; the guide says new test files need no entry at all.
- **The tutorial runner clicks visible controls only** (AC-49), so a page can keep a hidden set of controls for another screen size, and **a tutorial can name its viewport** (AC-50), so phone-sized tutorials run.
- **The first end-to-end run corrects a few expectations.** Tests first still found design gaps early on a large visual feature; three expectations were corrected under `unlocks`, which is what it is for.
- **Shared code in a repository with a nested package** lives in the package with fewer dependencies, and a change to it is checked with only one package installed, as that package's CI job does.

## Pilot findings: merge prompts (2026-11-07)

The Kettlebird lead saw a permission prompt for every gated merge right after typing "merge" or "merge when green": the guard asked for a confirmation the person had just given. A "merge when green" instruction is meant to be given once and carried out when CI finishes, often while the person is away, and a prompt then holds the merge until they come back (a headless run treats it as a refusal). Decided by the lead: the person's typed instruction is the confirmation, so the guard reads the session transcript and does not ask when the latest message the person typed is an instruction to merge that covers the pull request (AC-52). An instruction that names no pull request covers only those already open when it was given, so an agent that opens a follow-up pull request does not merge it on the same words. The guard relies on Claude Code marking typed messages in the transcript (`origin.kind: "human"`), which is not a documented format; if that changes, the guard finds no instruction and asks, as before. The agent still comments on the pull request quoting the instruction.

## Guard calibration review (2026-11-07)

A review of the permission prompts in twelve hours of the Kettlebird pilot (46 prompts, all from hooks) found:

- **Auto-merge bypassed the merge guard** (AC-53). The guide recommends auto-merge for "merge when green", but neither the MCP auto-merge tool nor the REST auto-merge route was guarded, so an agent could merge a gated pull request with no prompt. Both now count as merges; with AC-52, an instructed auto-merge goes through without one. A `GET` of the merge endpoint, which only checks whether a pull request was merged, no longer asks.
- **Most test-file prompts were not about changing tests** (`rfr-core` 2.2.3). Of 31, 16 named a test path that the command only ran, quoted in a commit message, or wrote as text into a spec (the `unlocks` list of a spec names test files, so every update to it asked). Seven more were edits to tests the agent had added on the same branch, tests first, which the CI test guard counts as new. The command guard now reads a command's write targets, and both test guards treat a test file added on the branch as new; after the tests commit, `spec-lock` holds those tests in CI. Snapshot updates (`-u`) now ask, which they did not before.
- **The merge guard re-asks after a restart.** A prompt left unanswered when the worker restarted was raised again by the agent's retry; one waited six and a half hours. With AC-52 this happens only for merges the person has not asked for.
- Working as intended: the remaining prompts (`git checkout -- .`, `git reset --hard`, `rm -rf dist`, eight edits to existing shared tests). `rm -rf` of a build folder still asks, because in some repositories (this one included) `build/` holds source.
