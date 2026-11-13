---
status: draft
---

# Lasting tutorials and a place to try them

A tutorial is how the lead validates a feature, and it should also be what a user follows to learn it. This spec makes a tutorial a lasting piece of user documentation that runs wherever the product runs, and makes getting somewhere to follow it one click or one command. It answers the maintainer's feedback on the 25f acceptance test, 2026-11-13: "Tutorials should survive the development process and be usable both during the development process and once the system is deployed", and their question whether the tutorial set-up can be simpler. The maintainer approved the six changes in "The tutorial" below the same day; and the seven decisions in the table at the end later that day, each as recommended. Proposed as Phase 27 of `PLAN.md`. Nothing here is built. The `status` field stays `draft` until every `test:` criterion has a citing test.

## Problem

What the acceptance test produced ([record](../../evals/results/2026-11-13-25f-acceptance-slice4/README.md)) is typical of all four tutorials in XR Studio In A Box:

1. **It starts with a developer's set-up.** "Before you start" asks for the repository, Node 26, pnpm, a disposable PostgreSQL database, two connection strings in an environment file, a migration, a build, a server on `localhost:3000`, an allow-listed address, and sign-in links read from files in a capture folder. The lead has validated none of slices 2, 3, or 4, and this is part of why. rfr's own template asks for it: "for each server the tutorial uses: the command that starts it".
2. **It needs four people.** The steps are done as Jordan, Morgan, Riley, Sam, and Drew, in "four browsers or private windows besides your own", each signed in through an emailed link.
3. **It is named and shaped by the build.** The file is `layer1-versions-board-first-view.md`, after the slice. Its body holds a run record and a test "for the lead". None of that means anything to a user of the deployed product.
4. **The words are not the test.** It is `runner: manual` with a separate Playwright script that cites it, because rfr's web runner drives one browser and has no way to sign in or act as a second person. The original design rejected a separate script for exactly this reason: it can drift from the words.
5. **Each slice adds a tutorial.** Slice 4 also had to edit step 14 of slice 3's. A user wants one tutorial for a task, kept current, not one for each increment that built it.
6. **Nothing gives the lead a place to try it.** The delivery ended with a branch. The plan's own acceptance test asks for "a preview and a recorded tutorial run".

## User stories

- As a project lead, I want to open a link, sign in as the person the tutorial names, and follow it, so that validating a feature takes minutes and no installation.
- As a project lead, I want the tutorial I validated to be the one users get, so that validation tests what ships.
- As a user of the deployed product, I want a tutorial for the task I am trying to do, written in the product's own terms, so that I can follow it with my own account.
- As a project lead, I want the words I follow to be the words the check runs, so that a tutorial that passes is one I can trust.
- As an agent, I want one command that gives a running product in a known state, so that I can run every tutorial before I report, and so can CI.

## Design

### The tutorial

Approved by the maintainer on 2026-11-13.

1. **A tutorial is user documentation that runs.** It is named for the task ("Give feedback and compare versions"), written for the persona who does it, and starts where that person starts: signed in to the product.
2. **Where it runs is not in it.** Its steps name pages by path and controls by name. The same file is followed on a local build, a pull request's preview, and the deployed product. How to get each of those is described once for the project, outside the tutorials.
3. **Development material is kept out of the body.** A run's record goes with the run (the recording, and the pull request's description). A check only a person can do goes in the design's notes for delivery and from there to the lead's validation list (delivery-run AC-15).
4. **The words are the test.** A tutorial for a web product is `runner: web`: the runner executes its sentences. No second script follows it.
5. **Tutorials are revised, not multiplied.** A delivery extends the tutorial for a task when one exists, and writes a new one only for a new task. A change to an approved tutorial is a revision like any other (Phase 26).
6. **A delivery ends with a place to try it.** The lead is told once, with the address to open and the tutorials to follow there.

### A place to try it

Three things make the set-up short. Each is the project's to provide once, in its first slices, and rfr's to ask for and check.

- **One address or one command.** A project names how to get a running product in `process.yml`: the command that starts one locally in a fresh, known state (`npm run try`), and whether each pull request gets a preview deployment. The command builds nothing the lead has to understand: it starts what the product needs, loads the starting data, and prints the address.
- **Signing in as a tutorial's person.** Where the product has accounts, the local and preview builds offer a way to sign in as each person a tutorial names, without an email round trip: a page that lists them, or a link for each. It exists only when a build is started for trying, never in production, and a test proves that. On the deployed product the reader uses their own account, and a tutorial that needs a second person says so in the product's terms ("ask a director on your project to accept it").
- **Starting where another tutorial ends.** A tutorial can say it starts from the result of another (`starts-from: tutorial-set-up-a-project`), so it does not spend its first steps building a project and inviting four people. The runner runs the earlier one first. The local command and the preview may load that result directly, which is faster and gives the same state. On the deployed product, "Before you start" links the earlier tutorial.

The runner gains what it needs for this: steps done as a named person, each in their own browser session, and a sign-in step.

### Different kinds of product

What "a place to try it" takes depends on what the product is made of (the maintainer, 2026-11-13: "different types of apps will have different tutorial set-up requirements, in particular those for systems that require cloud-based or server infrastructure"). The tutorial stays the same file everywhere; the project decides, once, what stands behind it in each place.

| Kind | Trying it locally | Trying a pull request | What needs care |
|---|---|---|---|
| Static site | The built site, served | The host's preview | Content from a CMS: fixture content, as the guide already says |
| Web app with its own data store | One command: store, migrations, fixture data, the app | A preview with its own store, loaded with fixture data | Accounts and sign-in |
| System with cloud services (queues, object storage, mail, paid or metered APIs, several services) | Each service has a stand-in: an emulator, a fake, or a sandbox account | A preview that uses stand-ins or sandbox accounts, never production's | What the stand-ins cannot show, and cost |
| Unreal plugin | The sample project in the editor | The Tier 2 engine run | Engine versions |
| Android or TV app | A device or emulator | A build to install | A shared device |
| Command-line tool or library | The built tool | Nothing more | Nothing |

For the third kind, three rules keep it honest and cheap:

- **Every piece of infrastructure has a declared stand-in.** The project's architecture has a section, "Trying the product", that lists each external service and what the local command and the preview use for it: the real service in a sandbox account, an emulator, or a fake, with what that hides. The lead approves it with the architecture, so "the preview sends no real email" is a decision and not a surprise.
- **A tutorial says what it needs that a stand-in cannot give.** `needs:` in its front matter names the service (`needs: [mail, tripo]`). Where the place being tried provides it, the tutorial runs. Where it does not, those tutorials are reported as not run there, never as passed.
- **What only the real thing shows is run in one shared place, before release.** A staging environment with real services is for the tutorials that `needs:` marks, on a schedule or before a release, not for every pull request. The release check lists a tutorial that has never run where its needs were met.

rfr does not create any of this infrastructure. It asks for the declaration, checks the tutorials against it, and reports what ran where.

## Acceptance criteria

Criteria marked D rest on the decision of that number below.

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | The tutorial template and the guide's validation part describe a tutorial as lasting user documentation: a title and file name that state the task, the persona it is for, "Before you start" in the product's terms only (an account, a role, a finished earlier tutorial), steps that name pages by path, and no section for a run record or for the lead. The template's line asking for the command that starts each server is removed. | test: the template and the guide. |
| AC-2 | `tutorial-run --coverage` fails a tutorial whose body names a machine or a build: a `localhost` or loopback address, an absolute URL to the product in a step, a fenced or inline shell command in "Before you start" or "Steps", or a heading "Run record". It warns when a tutorial's file name is the same as a spec's. A `runner: unreal` or `runner: manual` tutorial may still name a tool the reader must have installed. | test: one fixture for each failure, the warning, and a clean tutorial. |
| AC-3 | The web runner runs steps as named people. A step that begins `As **Name**:` runs in that person's browser session, which is created on first use and kept for the rest of the tutorial; steps with no name run as the tutorial's first person. `Sign in as **Name**.` signs that session in by the project's way of doing so (AC-6), and is a manual step where the project has none. A recording has one video for each person. (D1) | test: a two-person fixture where the second person sees what the first did; a sign-in step with and without a configured way; the recordings. |
| AC-4 | A tutorial may name another in `starts-from`. The process check fails a name that is not a tutorial's id, and a cycle. The runner runs the named tutorial first, once in a run however many start from it, and skips a tutorial whose starting tutorial failed, saying so. Where the project provides a faster way to reach the same state (AC-5), the runner uses it. (D3) | test: a chain of two; two that start from the same one; a failure upstream; a cycle. |
| AC-5 | `process.yml` accepts a `try:` block: `local`, the command that starts the product in a fresh, known state and prints its address; `preview: true` when each pull request gets a preview deployment; `url`, the deployed product's address; `sign-in`, the path that signs a session in as a named person, with `{name}` in it; and `state`, the path or command that loads the result of a named tutorial. Unknown keys are refused. The process check fails a `local` command that names an npm script the project does not have. | test: parsing, each refusal, and the script check. |
| AC-6 | The guide's validation part says how a product offers tutorial sign-in safely: only in a build started with a setting for trying; refused when the product's production setting is on, whatever else is set; listing only the people the tutorials name, with fixture data; and covered by a test that the path answers 404 without the setting. rfr-core's `security-reviewer` checks a change that adds or alters such a path against those four points. A project that cannot meet them leaves `sign-in` out, and its sign-in steps are manual. (D2) | test: the guide and the reviewer's text. review: the first project to add one. |
| AC-7 | The `deliver` skill, for a web product: writes or extends the task's tutorial as `runner: web`, with no second script; runs every tutorial the delivery touches against the `try` command's product and records it; and leaves checks only a person can do out of the tutorial. It extends an existing tutorial when the user documentation it would derive from already has one for the same task, and says in the decisions file which it did. (D4) | test: the skill's text. |
| AC-8 | The description the workflow writes for a delivery's pull request has a "Try it" section: the tutorials the pull request adds or changes, by title, with their paths; the preview's address when the project has `preview: true`, as "the preview linked below, when its deployment finishes"; and the `local` command. The end-of-run report tells the lead the same, once. | test: the section with and without `preview`, and the report. |
| AC-9 | The process check fails an approved tutorial that no approved user documentation links to, so every tutorial ships with the documentation that ships. The user documentation template has a "Try it" line for the link. | test: a linked and an unlinked tutorial; the template. |
| AC-10 | The `setup` and `bootstrap` skills ask, in the batched interview, how the product will be tried (the local command, previews, the deployed address), with an answer proposed from the profile, and write the `try:` block. The guide says the first slice of a product with a user interface builds the `try` command, and the first slice with accounts builds tutorial sign-in. | test: both skills' text and the guide. |
| AC-11 | The `web-app` profile ships a recipe for the `try` command: start the data store the product needs, apply migrations, load fixture data, start the product, print the address, and clean up on exit. It is a recipe in the guide, with one worked example, not a script rfr runs. | review: the guide, and its use on XR Studio In A Box. |
| AC-12 | XR Studio In A Box is moved onto this: a `try` command and preview deployments with tutorial sign-in; its four tutorials rewritten by task as `runner: web`, with their Playwright scripts removed; and each linked from its user documentation. The lead follows them on a preview. (D5) | review: the lead validates slices 2, 3, and 4 from a preview. |
| AC-13 | The guide's validation part has the table of kinds of product and what trying each takes, and each profile's part names its own row. For a product with external services, the guide asks the architecture for a "Trying the product" section listing each service and its stand-in locally and in a preview, with what the stand-in hides; the persona walkthrough of an architecture reports a service the design names that the section leaves out. | test: the guide and the walkthrough's text. |
| AC-14 | A tutorial may list services in `needs:`, and `try:` in `process.yml` may list, for `local`, `preview`, and a `staging` address, the services each `provides`. The runner takes `--provides <list>` (the workflows pass the list for where they run), runs a tutorial only where every need is provided, and reports the others as "not run here: needs <service>", apart from passes and failures. The process check fails a need that no place provides. The release check lists a story whose tutorial has needs and has no recorded run where they were met. (D7) | test: a tutorial with a need run with and without it provided; the report; an unprovided need; the release check. |

## Decisions

Approved by the maintainer on 2026-11-13, each as recommended: "yes to all decisions."

| # | Decision | Decided | The alternative, and what it costs |
|---|---|---|---|
| D1 | Do web tutorials have to be `runner: web`, with the runner taught to act as several people? | Yes. It is the only way the words stay the test. | Keep `runner: manual` with a separate script: works today, and the script and the words drift, as the original design warned. |
| D2 | May local and preview builds offer sign-in as a tutorial's people? | Yes, under AC-6's four conditions, with a security review of each one. It removes the mail folder and the five browsers. | No shortcut: every validation needs real mailboxes for every person, or stays as it is now. A middle course is local only, which keeps previews honest and means the lead still installs the project. |
| D3 | Do tutorials chain with `starts-from`? | Yes. It keeps each tutorial about its own task, and the starting state is something a real user can also reach. | Every tutorial builds its own world in its first steps (today), or relies on seeded data that exists nowhere a user can see. |
| D4 | One tutorial for each task, extended by later slices? | Yes. | One for each feature or slice: simpler for the run, and users get a history of the build. |
| D5 | When is XR Studio In A Box moved over? | Next, before Phase 26. Slices 2 to 4 are waiting on validation, and this is what makes validating them quick. | After Phase 26: the migration would then be a revision delivered by the new flow, at the price of three slices staying unvalidated longer. |
| D6 | Does 25f wait for this? | Yes. The acceptance test asks for a preview and a recorded tutorial run, and that part did not hold. Run the test again on the next packet once 27c is in. | Call 25f passed on the no-interruption result and release 8.0.0 now, with the preview as known work. |
| D7 | Where do tutorials run that need real cloud services? | Stand-ins locally and in previews; one shared staging environment for what they cannot show, run before a release (AC-14). | A full cloud environment for every pull request: the most faithful, and it costs money and minutes on every push, and needs clean-up that fails quietly. Or stand-ins only: cheap, and the first real email or paid call happens in production. |

## Scope

- In: the tutorial and user documentation templates; the guide's validation and delivery parts; `checks/tutorial-run.mjs` and `checks/lib/tutorial.mjs` (people, sign-in, `starts-from`, the body checks); `checks/lib/process.mjs` (`try:`); `checks/process-trace.mjs` (AC-4's names, AC-9); `checks/ci/process-pr-body.mjs`; the `deliver`, `setup`, and `bootstrap` skills; `security-reviewer`; the `web-app` profile's recipe; tests; `project-process.md` and `delivery-run.md` amended where this changes them.
- Out: hosting. rfr does not create preview deployments or databases; the project's host does, and the existing `rfr-tutorials-preview.yml` already runs web tutorials against a preview and uploads the recording. Unreal, Android, and manual tutorials beyond AC-1 and AC-2: they already run where the product runs. An in-product tutorial viewer. Translating tutorials.
- Not changed: a tutorial is still gated, still derives from user documentation, and its approval is still the lead's validation.

## APIs and assumptions

- The web runner uses Playwright from the project. A browser context for each person is ordinary Playwright; one video for each context is how it records. To be confirmed in 27b.
- `rfr-tutorials-preview.yml` passes the preview's address as the base URL. Tutorial sign-in on a protected preview goes through the same origin, so the existing bypass secret covers it.
- Assumption: XR Studio In A Box can have preview deployments with their own data store. Its architecture places everything in Canada (Aurora in ca-central-1, Vercel functions in `yul1`); a preview holding only fixture data may not need that, which is the lead's decision when 27d starts.
- A tutorial sign-in path is a deliberate way round authentication. AC-6 keeps it out of production by construction and by test, and D2 gives the option of having none.
- This spec changes no guard, so the freeze in the rewrite plan does not hold it back.

## Delivery

- Plan item: `PLAN.md`, Phase 27. One pull request for each slice.
  - **27a, what a tutorial is:** AC-1, AC-2, AC-7, AC-9.
  - **27b, the runner:** AC-3, AC-4.
  - **27c, a place to try it:** AC-5, AC-6, AC-8, AC-10, AC-11, AC-13, AC-14.
  - **27d, XR Studio In A Box:** AC-12.
- Pull requests: none yet.
