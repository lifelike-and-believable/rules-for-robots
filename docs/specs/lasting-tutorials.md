---
status: draft
---

# Lasting tutorials and a place to try them

A tutorial is how the lead validates a feature, and it should also be what a user follows to learn it. This spec makes a tutorial a lasting piece of user documentation that runs wherever the product runs, and makes getting somewhere to follow it one click or one command. It answers the maintainer's feedback on the 25f acceptance test, 2026-11-13: "Tutorials should survive the development process and be usable both during the development process and once the system is deployed", and their question whether the tutorial set-up can be simpler. The maintainer approved the six changes in "The tutorial" below the same day; and the seven decisions in the table at the end later that day, each as recommended. A later section, "Organised user documentation", answers further feedback of the same day; its four decisions (D8 to D11) were approved that day as well. This is Phase 27 of `PLAN.md`; slice 27a is built (#255). The `status` field stays `draft` until every `test:` criterion has a citing test.

## Problem

What the acceptance test produced ([record](../../evals/results/2026-11-13-25f-acceptance-slice4/README.md)) is typical of all four tutorials in XR Studio In A Box:

1. **It starts with a developer's set-up.** "Before you start" asks for the repository, Node 26, pnpm, a disposable PostgreSQL database, two connection strings in an environment file, a migration, a build, a server on `localhost:3000`, an allow-listed address, and sign-in links read from files in a capture folder. The lead has validated none of slices 2, 3, or 4, and this is part of why. rfr's own template asks for it: "for each server the tutorial uses: the command that starts it".
2. **It needs four people.** The steps are done as Jordan, Morgan, Riley, Sam, and Drew, in "four browsers or private windows besides your own", each signed in through an emailed link.
3. **It is named and shaped by the build.** The file is `layer1-versions-board-first-view.md`, after the slice. Its body holds a run record and a test "for the lead". None of that means anything to a user of the deployed product.
4. **The words are not the test.** It is `runner: manual` with a separate Playwright script that cites it, because rfr's web runner drives one browser and has no way to sign in or act as a second person. The original design rejected a separate script for exactly this reason: it can drift from the words.
5. **Each slice adds a tutorial.** Slice 4 also had to edit step 14 of slice 3's. A user wants one tutorial for a task, kept current, not one for each increment that built it.
6. **Nothing gives the lead a place to try it.** The delivery ended with a branch. The plan's own acceptance test asks for "a preview and a recorded tutorial run".
7. **The user documentation has no shape.** The maintainer, 2026-11-13: "The user documentation is unorganized, so it's not always clear, especially as there's more and more of it, which documentation is associated with which component of the system. Like the tutorials, user documentation should survive the development process and be easily navigable by the users of the production system." After four slices `docs/user/` is thirteen files in one folder, with no start page, no grouping by part of the product, and no list of what exists. Pages link to one another where an author thought to. Nothing in the product opens them. Layer 1 is one of several layers, and 231 stories have no documentation yet.

## User stories

- As a project lead, I want to open a link, sign in as the person the tutorial names, and follow it, so that validating a feature takes minutes and no installation.
- As a project lead, I want the tutorial I validated to be the one users get, so that validation tests what ships.
- As a user of the deployed product, I want a tutorial for the task I am trying to do, written in the product's own terms, so that I can follow it with my own account.
- As a project lead, I want the words I follow to be the words the check runs, so that a tutorial that passes is one I can trust.
- As an agent, I want one command that gives a running product in a known state, so that I can run every tutorial before I report, and so can CI.
- As a user of the deployed product, I want to start from one page, pick the part of the product I am in, and find the page for my task, so that I do not have to know how the documentation was written.
- As a user looking at a screen, I want help for that screen, so that I do not have to search.
- As a project lead, I want to see which documentation belongs to which part of the product, so that I can tell what is covered and review a change in its place.

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

### Organised user documentation

Added 2026-11-13 from the maintainer's feedback (problem 7). The same idea as for tutorials: what the lead approves is what the user gets, so it has to be findable by someone who was not there when it was written.

1. **Organised by area of the product.** An area is a part of the product as its user sees it: for a web product usually an item in its navigation (Review, Board, People); for a plugin, a panel or tool; for a command-line tool, a group of commands. Each area has a folder, `docs/user/<area>/`, and every page lives in one. Pages that belong to the whole product (signing in, the account) live in an area of their own. The areas follow the product's navigation, which a project with a navigation foundation or decision already has approved.
2. **Each area has an overview.** `docs/user/<area>/README.md` says what the area is for and who uses it, explains the few ideas a reader needs, and lists the area's pages in the order a user needs them, each with one line.
3. **One start page.** `docs/user/README.md` says what the product is in a sentence or two, lists the areas in the order a user meets them, and gives each persona a place to start ("If you are a producer, start with ...").
4. **Every page can be reached.** From the start page, through an area's overview, to the page, and from the page to its tutorial ("Try it", AC-9). A page nobody can reach is reported.
5. **A page says what it covers.** `covers:` in a page's front matter lists where in the product it applies: for a web product the addresses (`/projects/{id}/board`), for a plugin the panel or command names. That is the record of which documentation belongs to which component. The product's help link uses it to open the page for the screen the user is on, and the lead can read from it what has no page.
6. **It ships with the product.** The pages and tutorials are published as the product's help, built from the same files at each deployment, and the product links to it. How depends on the kind of product: a help section of a web app, the documentation folder of a plugin with the address in its descriptor, the help topics of a command-line tool.
7. **Pages are kept, not added to.** A page is named for what the user does or sees there, never for a slice, layer, or story. A later feature that changes a task changes its page (delivery-run AC-15), adds a new page to its area's overview, and adds a new area to the start page.

Ids do not depend on file paths, so moving a page into an area's folder breaks no `derived-from` link.

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
| AC-9 | The process check fails an approved tutorial that no approved user documentation links to, so every tutorial ships with the documentation that ships. A tutorial that derives from no user documentation (the stage is waived, or its design is marked `no-user-docs`) is not checked. Reference-style links are not read; the link is written inline. The user documentation template has a "Try it" line for the link. | test: a linked and an unlinked tutorial; the template. |
| AC-10 | The `setup` and `bootstrap` skills ask, in the batched interview, how the product will be tried (the local command, previews, the deployed address), with an answer proposed from the profile, and write the `try:` block. The guide says the first slice of a product with a user interface builds the `try` command, and the first slice with accounts builds tutorial sign-in. | test: both skills' text and the guide. |
| AC-11 | The `web-app` profile ships a recipe for the `try` command: start the data store the product needs, apply migrations, load fixture data, start the product, print the address, and clean up on exit. It is a recipe in the guide, with one worked example, not a script rfr runs. | review: the guide, and its use on XR Studio In A Box. |
| AC-12 | XR Studio In A Box is moved onto this: a `try` command and preview deployments with tutorial sign-in; its four tutorials rewritten by task as `runner: web`, with their Playwright scripts removed; and each linked from its user documentation. The lead follows them on a preview. (D5) | review: the lead validates slices 2, 3, and 4 from a preview. |
| AC-13 | The guide's validation part has the table of kinds of product and what trying each takes, and each profile's part names its own row. For a product with external services, the guide asks the architecture for a "Trying the product" section listing each service and its stand-in locally and in a preview, with what the stand-in hides; the persona walkthrough of an architecture reports a service the design names that the section leaves out. | test: the guide and the walkthrough's text. |
| AC-14 | A tutorial may list services in `needs:`, and `try:` in `process.yml` may list, for `local`, `preview`, and a `staging` address, the services each `provides`. The runner takes `--provides <list>` (the workflows pass the list for where they run), runs a tutorial only where every need is provided, and reports the others as "not run here: needs <service>", apart from passes and failures. The process check fails a need that no place provides. The release check lists a story whose tutorial has needs and has no recorded run where they were met. (D7) | test: a tutorial with a need run with and without it provided; the report; an unprovided need; the release check. |
| AC-15 | The rules in AC-2 and AC-9 can be reported as warnings, for a project whose tutorials were written before them. `checkCoverage` and `runProcessTrace` take `lasting: 'warn'`; their command lines read it from `RFR_LASTING_TUTORIALS`; and the reusable process workflow has a `lasting-tutorials` input that it passes to both. The input's default is `warn` until slice 27d is done, and `fail` from then on; a project can set `fail` sooner. (Added 2026-11-13 while building 27a: XR Studio In A Box's four tutorials break the rules and cannot be rewritten before 27b to 27d exist, and its CI follows this repository's `main`.) | test: the default and `warn` for both checks; another problem still failing; the command line; the workflow. |
| AC-16 | In a project with user documentation, the process check reports: no `docs/user/README.md`; a page directly in `docs/user/` other than that start page; and an area folder with no `README.md`. The start page and each overview are user documentation artifacts with ids, gated and approved like any page; they satisfy stage order by deriving from the concept, a persona, an epic, or a foundation, as well as from a design. These follow the `lasting` setting of AC-15. (D8, D9) | test: a flat folder; a missing overview; a missing start page; an organised project; an overview deriving from a persona. |
| AC-17 | The process check reports an approved page that its area's overview does not link to, and an area whose overview the start page does not link to. Links are read as in AC-9. | test: an unlisted page, an unlisted area, and a complete set. |
| AC-18 | A user documentation page may list what it covers in `covers:`. The process check fails the same entry in two pages. `checks/docs-map.mjs` prints the documentation as a tree (start page, areas, pages, each page's tutorials) and, with `--json`, the same as data with each page's title, path, and `covers` entries, for a project's help to be built from and its help link to read. It makes no network call and changes nothing. (D10) | test: a duplicate entry; the tree and the JSON for a fixture of two areas. |
| AC-19 | The plugin has templates for the start page (`user-docs-start.md`) and an area's overview (`user-docs-area.md`), and the page template gains `covers:`. The guide's design part says how user documentation is organised (the seven points above), and that a feature packet puts each new page in its area's overview and a new area on the start page. The `setup` and `bootstrap` skills write the start page with the product brief. | test: the templates, the guide, and both skills' text. |
| AC-20 | The guide's validation part says how each kind of product publishes its help from `docs/user/` and `docs/tutorials/` and links to it, with a recipe for the `web-app` profile: build the help from the Markdown at each deployment, serve it under one address, and have the product's help link open the page whose `covers` matches the current address, or the area's overview, or the start page. The `try` command's product includes the help. rfr ships no help site and hosts nothing. (D11) | review: the guide, and its use on XR Studio In A Box. |
| AC-21 | The persona walkthrough of a packet that adds or changes user documentation starts each persona at the start page and reports, as a finding, a task whose page the persona would not find within three selections, or would look for in another area. | test: the agent's text. |

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

### Decisions on organised user documentation

Approved by the maintainer on 2026-11-13, each as recommended: "spec approved with recommended decisions."

| # | Decision | Decided | The alternative, and what it costs |
|---|---|---|---|
| D8 | What is user documentation organised by? | The areas of the product as its user sees them, following its navigation, with a place to start for each persona on the start page. | By persona: pages that several roles use have no one home. By epic or feature: that is the order it was built in, which is the problem. |
| D9 | Folders, or a tag? | A folder for each area with an overview page. The shape is visible in the repository, in a pull request, and in CODEOWNERS. | An `area:` line in each page and a generated index: no files move, and nobody sees the shape without running a tool. |
| D10 | Does a page record what it covers? | Yes, as an optional `covers:` list. It answers "which documentation belongs to which component" with data, and makes help for the current screen possible. | Leave it to the folder: enough to browse, and the product cannot open the right page by itself. |
| D11 | Does rfr publish the help? | No. rfr gives the map as data and a recipe for each kind of product; the project builds and serves its help with its own stack. | An rfr help-site generator: one more thing to maintain, and wrong for every product that is not a web app. |

## Scope

- In: the tutorial and user documentation templates; the guide's validation and delivery parts; `checks/tutorial-run.mjs` and `checks/lib/tutorial.mjs` (people, sign-in, `starts-from`, the body checks); `checks/lib/process.mjs` (`try:`); `checks/process-trace.mjs` (AC-4's names, AC-9); `checks/ci/process-pr-body.mjs`; the `deliver`, `setup`, and `bootstrap` skills; `security-reviewer`; the `web-app` profile's recipe; tests; `project-process.md` and `delivery-run.md` amended where this changes them.
- In (27e): `checks/process-trace.mjs` (AC-16, AC-17, the `covers` rule), `checks/docs-map.mjs` (new), the stage-order rule for a start page and an overview in `checks/lib/process.mjs` and the session guard, three templates, the guide's design and validation parts, the `setup` and `bootstrap` skills, and the `persona-walkthrough` agent.
- Out: hosting. rfr does not create preview deployments or databases; the project's host does, and the existing `rfr-tutorials-preview.yml` already runs web tutorials against a preview and uploads the recording. Unreal, Android, and manual tutorials beyond AC-1 and AC-2: they already run where the product runs. An in-product tutorial viewer. Translating tutorials.
- Not changed: a tutorial is still gated, still derives from user documentation, and its approval is still the lead's validation.

## APIs and assumptions

- The web runner uses Playwright from the project. A browser context for each person is ordinary Playwright; one video for each context is how it records. Confirmed in 27b.
- Choices made in 27b: a tutorial's first person is the first name in its steps, or the first person of the tutorial it starts from; a tutorial that starts from another opens fresh sessions loaded with the cookies and storage the earlier one left, so two tutorials that start from the same one both begin signed in; session storage is not carried; and a web tutorial that starts from a `runner: manual` one is skipped until 27c gives a faster way to reach its state.
- `rfr-tutorials-preview.yml` passes the preview's address as the base URL. Tutorial sign-in on a protected preview goes through the same origin, so the existing bypass secret covers it.
- Assumption: XR Studio In A Box can have preview deployments with their own data store. Its architecture places everything in Canada (Aurora in ca-central-1, Vercel functions in `yul1`); a preview holding only fixture data may not need that, which is the lead's decision when 27d starts.
- A tutorial sign-in path is a deliberate way round authentication. AC-6 keeps it out of production by construction and by test, and D2 gives the option of having none.
- This spec changes no guard, so the freeze in the rewrite plan does not hold it back.

## Delivery

- Plan item: `PLAN.md`, Phase 27. One pull request for each slice.
  - **27a, what a tutorial is:** AC-1, AC-2, AC-7, AC-9, AC-15.
  - **27b, the runner:** AC-3, AC-4.
  - **27c, a place to try it:** AC-5, AC-6, AC-8, AC-10, AC-11, AC-13, AC-14.
  - **27e, organised user documentation:** AC-16 to AC-21. Built before 27d, so that the move below is made once.
  - **27d, XR Studio In A Box:** AC-12, with its user documentation moved into areas under a start page, and the workflow's `lasting-tutorials` default becomes `fail`.
- Pull requests: none yet.
