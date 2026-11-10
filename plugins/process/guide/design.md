# Design stages

Part of the [rfr-process guide](../GUIDE.md).

## Design stages

Each design artifact is approved by its stage's approver before anything downstream links to it. Write each one short enough to read in one sitting; a long artifact usually means two.

### Batches: the interview, the product brief, and the feature packet

The approver's attention is the scarce part, so ask for it in batches.

- **The batched interview.** Before drafting the concept or requirements, ask every question they need in one message, each with the answer you propose (for example "Who is the first audience? Proposed: working comic artists, because the README addresses them"). Then draft. A question left unanswered becomes the proposed answer marked `[assumed]` in the artifact, so it shows in the review packet rather than blocking the draft.
- **The product brief.** For a new product, draft the concept, discovery, requirements, personas, and epics together, in one pull request. Before the approver sees it, run the cross-area consistency pass (requirements read across areas and against the concept) and the persona walkthrough of each requirement against every persona, and fix what they find.
- **The feature packet.** For a story, put the story, the design with its mock-ups, and the user documentation in one pull request. An epic gets an epic brief the same way: the epic, its stories, and a short design.
- **The review packet.** At the top of a brief's or packet's pull request description, paste the output of `node .rfr/checks/process-packet.mjs . --base origin/main --walkthrough <report.md>` (save the persona walkthrough's report to a file first, and add a `- **Done:**` line under each finding you acted on). It lists every `[open]` choice first, then every `[assumed]` answer, the walkthrough's `blocks` and `misleads` findings with what was done about each, and the mock-ups and recordings. Run it again after changes and replace the old packet.

In a delegated project, the stages a brief or packet bundles that are gated `notify` (requirements, personas, epics, stories by default) merge without waiting for the approver, and the approver reviews the concept, design, and user documentation in the same packet.

### Concept

One page: the problem and who has it, the audience, what changes for them when this exists, and the non-goals. The non-goals matter most later, when they settle scope arguments.

Review checks: Is the problem stated in the user's terms, not as a missing feature? Would someone outside the project understand who it is for? Are there non-goals?

### Discovery (optional)

When the requirements need a body of findings first (use cases, the approver's answers to a round of questions, assumptions, options weighed), write them in `docs/product/discovery/<topic>.md` from `templates/artifacts/discovery.md`. It links to the concept, is approved like the concept, and gives each use case and decision its own heading, so each requirement can link to the sections it comes from (`discovery-pipeline#uc-3-remote-audience`) instead of citing them in a comment. Skip it when the concept and a short conversation are enough.

Review checks: Is each use case someone's real situation, not a feature? Is each decision the approver's own answer, with where it was given? Are the assumptions ones the approver would accept?

### Requirements

One file per area (`docs/product/requirements/animation.md`), each requirement under its own ID heading (`## REQ-animation-3: Preview before applying`). Separate files keep pull requests small and stop one shared file becoming a merge hotspot.

- State what must be true, not how to build it. "A batch of up to 500 clips retargets in under a minute on the reference machine" is a requirement; "use a thread pool" is a design.
- Make each requirement testable as written: a number, a named behaviour, or a condition someone could check.
- Put constraints (engine versions, platforms, budgets, policies) and success measures in their own sections.
- List open questions instead of guessing. An approver can answer a question; they may not notice a guess.
- Mark what is not settled, in the text where it applies, so the approver sees it and the process check can list it:
  - `[open]`: a question only the approver can answer.
  - `[assumed]`: something you took as true without their answer.
  - `[proposed]`: text you proposed that the approver has not accepted, as opposed to text that records their decisions. Keep it until they accept or change it, so the difference is not lost once the file is written.
  - `[to validate]`: a detail the approver accepts as a working assumption to check later, such as a persona detail on a new project with no interviews yet. It stays after approval and is listed with the open items, without a warning.

  `node .rfr/checks/process-trace.mjs` prints every marker with its file and line, and warns if an approved artifact still has one. Before asking for approval, resolve each marker or leave it for the approver to decide in the pull request; approving means each of the other markers is settled, either in the text or by the approver accepting it as `[to validate]`. Never change the wording only to clear a warning: an honest `[to validate]` is better than an assumption that reads as fact.
- Say which release each requirement is for, with a `Release:` line under its heading (`Release: first`, `Release: later`, or a named release), instead of "(later)" in the heading. Epics group their stories into release groups from these.
- Success measures the approver will set later are written as `[open]` with the event they wait for ("[open] audience size target, set after the first rehearsal"). A requirements file can be approved with such a measure only if the approver says so in the pull request, and the marker then stays as a reminder; the check keeps warning until it is set, which is the point.
- Keep implementation facts out of requirements (the CMS, the hosting provider, the current project ID): they change for reasons no approver needs to review, and a change to a requirements file needs at least a story tier. Put them in `docs/product/notes.md`, which is not an artifact.
- Requirements may lead the product. On an existing project they can describe behaviour it does not have yet; the epics then close the gap. Mark such a requirement as not yet met, so nobody reads it as a description of today.

**Check across areas, and against the concept, before approving.** This is a required step, not a nicety. Areas are often reviewed one at a time, and a later area can change an earlier one: a spend limit in one area can stop a live show promised in another, an offline rule can conflict with a remote audience target, backups can conflict with deleting a guest's data on request. In one project, a pass over nine area files that had each been reviewed found about a dozen real conflicts. Before the requirements are approved, read all the area files together with the concept and any discovery files, and list in the pull request:

- every conflict between two requirements, with the IDs on both sides;
- every requirement that contradicts the concept's vision or non-goals;
- every requirement whose `Release:` disagrees with a requirement it depends on.

The approver resolves each one, sometimes by changing the concept (see "When things change"). Do this pass again whenever an area changes after the others were reviewed.

**Keep what a requirement depends on inside the process.** A requirement that points to a list or rule kept in plain notes rests on text no one approved. Move the content into the requirement, or into a discovery file it links to. The process check warns when an approved artifact in `docs/product/` links to a Markdown file that is not an artifact.

**Re-opening an area.** An area discussed but not yet merged as approved is still a draft: edit it and say in the pull request which earlier answers changed. An approved area is amended like any approved artifact: edit it, keep `status: approved`, and the gated merge approves the change; artifacts that link to the changed sections go stale and are updated in turn.

Review checks: Is every requirement testable? Do any two conflict, within this area or with another? Is anything a design choice in disguise? Are the success measures ones the project can actually observe? Are any markers left?

### Personas

A persona is a specific kind of user, described by evidence: interviews, support tickets, forum posts, analytics, your own experience with that role. The profile starters (`templates/profiles/<profile>/personas/` in this plugin) are a starting point, not evidence.

- Write goals, skills and tools, context of use, and frustrations. Stories link to a section (`persona-animator#goals`), so keep each section focused.
- Two or three well-understood personas beat six thin ones. Merge personas whose goals and skills do not differ in ways that change the design. A profile starter may become two personas (a site's visitors who are fans and those who are clients) or fold into one (a content editor who is the artist); say which in the evidence note.
- Give each persona an **Evidence** section saying where each detail comes from. On a new project with no interviews or tickets yet, the honest state is often "approved as working assumptions": mark those details `[to validate]`, and replace the marker with the evidence when it arrives.
- Approve personas before any story names them; the check enforces this.

**Then check the requirements against the personas.** Requirements come before personas, so they can assume a user no persona is: a separate operator, a full team, a desk, a fast connection. Once personas are approved, read each requirement against each persona's real situation, starting with the smallest team (a solo performer who is also the operator). List each requirement that fails for a persona, with the persona and why, and amend the requirements in their own pull request; the personas do not wait for it. The `persona-walkthrough` agent can do this pass (give it the requirement files). Do it again when a persona is added.

Review checks: Does each detail come from somewhere? Would the team design differently for each persona? Are the frustrations ones this product can actually address or make worse? Has each requirement been checked against each persona?

### Epics

An epic is an outcome for one or more personas: "Animators can retarget a batch of clips without leaving the editor." Link it to the requirements it serves and the goals of the personas it is for. List the proposed stories, then the stories as they are written; the release groups (stories that only make sense shipped together, such as a comic reader and the way to reach the next page); dependencies on other epics or decisions; open questions for the approver; and non-goals. More than about six stories, or more than one tutorial to demonstrate it, means it is two epics.

Review checks: Is it an outcome, not a list of features? Is it small enough to ship and demonstrate on its own? Can each release group ship without the others?

### User stories

"As <persona>, I want <capability> so that <benefit>", with acceptance criteria written in the persona's terms. Link the story to its epic and to the persona section it serves.

- The benefit should trace to the persona's goals. If it does not, either the story or the persona is wrong.
- Acceptance criteria describe what the persona observes, not internal state: "the clips show the new skeleton in the Content Browser", not "the asset registry is updated".
- Keep a story to something one pull request can deliver and one tutorial can demonstrate.

Review checks: independent, negotiable, valuable, estimable, small, and testable (INVEST). Does each criterion name something the persona can see?

### Design and UX

Flows, layouts or editor UI, and every state: empty, loading, partial, error, success, disabled. For Unreal tools, the Details panel layout, menu placement, undo and cancel behaviour, and where errors appear. The user documentation is written from this, so name every control as it will appear.

- **Include visual mock-ups or wireframes** for every screen, panel, menu, or dialog the design adds or changes, and for each state that looks different. A written flow is not enough for the approver or the persona walkthrough to judge a user interface. Wireframes are enough; polish is not the point. Put images in `docs/design/<feature>/` (so they are versioned with the text) or link to frames in the design tool, and say which state each one shows. Screenshots of the current product are fine as a starting point for a change. Keep the editable source beside the images (an HTML file rendered to PNG, or a link to the frame in the design tool), so each round of review is cheap to fix and re-render.
- **For a third-party interface** (a CMS's editing screens, an engine's built-in panels), the mock-ups settle the labels, help text, states, and warnings the project controls. They cannot show what the tool's components support, such as dropping several files at once or reordering by keyboard; the spec checks that against the tool's documentation, and the design says which behaviours it assumes.
- **Say which version of the tool the design was checked against.** When a design places a control inside a third-party interface, add a line such as "Checked against Sanity Studio 5.1: only the first document action is drawn as a button; the rest go in the menu." The persona walkthrough then asks whether each placement is possible in that version, and a later upgrade shows which designs to recheck. The pilot's design put a Preview button beside Publish, which that version cannot draw, and it was found only at spec time.
- Say which persona goals and frustrations the design answers, and link those sections (`persona-fan#frustrations`).
- A choice that spans several stories or epics, such as a URL scheme or a content model, gets its own decision note (`templates/artifacts/decision.md`, in `docs/design/decisions/`), which designs link to. It is gated like any design.

Review checks: the `rfr-core:ux-reviewer` and `rfr-core:accessibility-reviewer` checklists. Does every screen and state have a mock-up? Does every control the text names appear in one? Does every error say what to do next?

### User documentation

The user manual for the feature, written before the technical spec, as if the feature exists. This is the main alignment check: the approver reads it as a user would, and misunderstandings between the stories and what users expect show up here, while they are cheap to fix.

- Write for the personas the stories name, in their vocabulary. Explain the task, not the implementation.
- Name every control, menu, and message exactly as the design shows it, in bold, and keep bold for those names. Tutorials and the tutorial runner rely on them, and the process check warns about a bold name that no design the page reaches mentions; bold used for emphasis triggers the same warning.
- Cover what can go wrong: each message the user might see, what it means, and what to do.
- Keep sections task-shaped, with clear headings. Specs cite them (`docs-retarget#retarget-a-batch`).

**When there is nothing to document or demonstrate.** A story that only removes something (placeholder text, a retired page) or changes nothing a user does may have no user documentation and no tutorial: a page would tell the persona nothing, and a tutorial would repeat what the end-to-end tests check. Skip those stages only then, and say so in the pull request, with the reason, so the approver can disagree. A story that changes what a user sees or does is never in this group.

Review checks: run a persona walkthrough (below) first. Then read it as each persona: could they do the task with only this page? Does anything promised in the stories not appear? Does anything appear that no story asked for?
