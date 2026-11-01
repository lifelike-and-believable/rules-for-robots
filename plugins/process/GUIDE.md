# The project development process

Guide for the `rfr-process` plugin. It ships with the plugin, so the skills and agents can read it in any project. The design and the reasons behind it are in the rules-for-robots [spec](../../docs/specs/project-process.md); the mechanics (folders, front matter, CI jobs) are in the [README](README.md). This guide covers how to write each artifact well, what each review checks, and how to run a persona walkthrough. It is guidance, not rules: a stage gets its own skill only when an eval shows the skill does better than this page.

The process rests on two checks that people do and agents cannot: reading the user manual before the feature is built, and following the tutorials before the feature goes into production. Everything upstream exists to make those two reads meaningful, and everything downstream exists to make the product match what was read.

## Before you start: the size tier

Pick the tier before writing anything, and put it on the pull request as a label.

| Tier | Use it when | Start at |
|---|---|---|
| `tier:trivial` | Nothing a user could notice changes: a typo in code, a dependency bump, a refactor | Implementation |
| `tier:fix` | The approved stories or user documentation already describe the right behaviour, and the product does something else | A failing test that reproduces the bug |
| `tier:story` | A new capability inside an approved epic | User stories |
| `tier:epic` | A new area of capability | Epics, after checking whether requirements or personas change |

If a fix turns out to need a change to the user documentation, it is a story. CI enforces this for the documentation folders. The one pull request with no tier is the one that adds `process.yml`: adopting the process fits none of them, so the tier check lets it through.

## Design stages

Each design artifact is approved by its stage's approver before anything downstream links to it. Write each one short enough to read in one sitting; a long artifact usually means two.

### Concept

One page: the problem and who has it, the audience, what changes for them when this exists, and the non-goals. The non-goals matter most later, when they settle scope arguments.

Review checks: Is the problem stated in the user's terms, not as a missing feature? Would someone outside the project understand who it is for? Are there non-goals?

### Requirements

One file per area (`docs/product/requirements/animation.md`), each requirement under its own ID heading (`## REQ-animation-3: Preview before applying`). Separate files keep pull requests small and stop one shared file becoming a merge hotspot.

- State what must be true, not how to build it. "A batch of up to 500 clips retargets in under a minute on the reference machine" is a requirement; "use a thread pool" is a design.
- Make each requirement testable as written: a number, a named behaviour, or a condition someone could check.
- Put constraints (engine versions, platforms, budgets, policies) and success measures in their own sections.
- List open questions instead of guessing. An approver can answer a question; they may not notice a guess.

Review checks: Is every requirement testable? Do any two conflict? Is anything a design choice in disguise? Are the success measures ones the project can actually observe?

### Personas

A persona is a specific kind of user, described by evidence: interviews, support tickets, forum posts, analytics, your own experience with that role. The profile starters (`templates/profiles/<profile>/personas/` in this plugin) are a starting point, not evidence.

- Write goals, skills and tools, context of use, and frustrations. Stories link to a section (`persona-animator#goals`), so keep each section focused.
- Two or three well-understood personas beat six thin ones. Merge personas whose goals and skills do not differ in ways that change the design. A profile starter may become two personas (a site's visitors who are fans and those who are clients) or fold into one (a content editor who is the artist); say which in the evidence note.
- Approve personas before any story names them; the check enforces this.

Review checks: Does each detail come from somewhere? Would the team design differently for each persona? Are the frustrations ones this product can actually address or make worse?

### Epics

An epic is an outcome for one or more personas: "Animators can retarget a batch of clips without leaving the editor." Link it to the requirements it serves and the personas it is for. List its stories as they are written, and its non-goals.

Review checks: Is it an outcome, not a list of features? Is it small enough to ship and demonstrate on its own?

### User stories

"As <persona>, I want <capability> so that <benefit>", with acceptance criteria written in the persona's terms. Link the story to its epic and to the persona section it serves.

- The benefit should trace to the persona's goals. If it does not, either the story or the persona is wrong.
- Acceptance criteria describe what the persona observes, not internal state: "the clips show the new skeleton in the Content Browser", not "the asset registry is updated".
- Keep a story to something one pull request can deliver and one tutorial can demonstrate.

Review checks: independent, negotiable, valuable, estimable, small, and testable (INVEST). Does each criterion name something the persona can see?

### Design and UX

Flows, layouts or editor UI, and every state: empty, loading, partial, error, success, disabled. For Unreal tools, the Details panel layout, menu placement, undo and cancel behaviour, and where errors appear. Link sketches or mock-ups. The user documentation is written from this, so name every control as it will appear.

Review checks: the `ux-reviewer` and `accessibility-reviewer` checklists. Does every state have a design? Does every error say what to do next?

### User documentation

The user manual for the feature, written before the technical spec, as if the feature exists. This is the main alignment check: the approver reads it as a user would, and misunderstandings between the stories and what users expect show up here, while they are cheap to fix.

- Write for the personas the stories name, in their vocabulary. Explain the task, not the implementation.
- Name every control, menu, and message exactly as the design shows it, in bold. Tutorials and the tutorial runner rely on those names.
- Cover what can go wrong: each message the user might see, what it means, and what to do.
- Keep sections task-shaped, with clear headings. Specs cite them (`docs-retarget#retarget-a-batch`).

Review checks: run a persona walkthrough (below) first. Then read it as each persona: could they do the task with only this page? Does anything promised in the stories not appear? Does anything appear that no story asked for?

## Delivery stages

These follow `rfr-core` and Phase 10: a spec whose criteria cite the stories and documentation sections they come from, tests written first and locked, implementation that makes them pass, and regression tests promoted from the stories and documentation. See [working with agents](../../practices/working-with-agents.md) and [testing and code quality](../../practices/testing-and-code-quality.md).

Acceptance and end-to-end tests can be drafted as soon as the user documentation is approved. Write them against the documented behaviour, not the planned implementation.

## Validation stages

### Tutorials and demos

A tutorial follows the user documentation step by step to a result the persona cares about. It is the main expectation check: the approver follows it, and any gap between what users expect and what the product does shows up here, before production use.

Every tutorial names its runner in front matter:

- `runner: web`: the steps run in a browser against the product (`node .rfr/checks/tutorial-run.mjs --base-url <url>`). Write each step with sentences the runner understands: ``Open `/path`.``, ``Type `text` into **Label**.``, ``Choose `option` from **Label**.``, `Check **Label**.`, `Click **Name**.`, and `You see **Text**.` Other sentences are narration. End a step with `(manual)` when a person has to do it. A tutorial that no longer matches the product fails, so the tutorial and the product cannot drift apart unnoticed.
- `runner: unreal`: an automation or functional test in the sample project follows the steps and names the tutorial's id in a comment. The process check fails if no test cites it, and the Tier 2 workflow runs the test on the engine runner. Record a short walkthrough video from the same steps for the Fab listing.
- `runner: manual`: a person follows it before each release. Use this only when neither runner can do the steps.

Review checks: the approver follows the tutorial on the real product. Did it produce what the stories promised? Was any step surprising?

### Release and feedback

Before a release, every story in it has an approved tutorial, and nothing it depends on is stale or withdrawn. Release notes are written from the user documentation, in the personas' terms. Feedback from real use is filed as an issue with the `feedback` label and routed to the artifact it affects: a wrong promise goes back to the story, a wrong flow to the design, a wrong explanation to the documentation.

## Persona walkthrough

A persona walkthrough is a cognitive walkthrough done once per persona: at every step, where would this persona fail, and why? Run it on design notes, user documentation, and tutorials before the approver reviews them. The `persona-walkthrough` agent does this; you can also do it by hand. Look for failures deliberately at each step: studies of LLM walkthroughs found that models finish more tasks and spot fewer failure points than people unless asked for failures explicitly, and that playing a persona makes the output more believable rather than more accurate. For a web tutorial, run it against the product first (`tutorial-run --record`); a step that fails there is a fact, not a prediction.

1. Pick the personas the artifact's stories name. Read each persona file in full.
2. For each persona separately, read the stories first, as their expectations.
3. Read the artifact from the top with only that persona's skills and vocabulary. For a tutorial, do the steps, on the product if it runs.
4. At each step ask four questions: will they know what to do, will they see the control or information they need, will they connect it to their goal, and after acting, will they know it worked and get what they expected? Note every "no", and every listed frustration the page triggers.
5. For each finding, record where it is, what the persona would do, what they expected and why, how bad it is (blocks, misleads, or slows), and which artifact most likely needs to change.

The walkthrough informs the approver; it does not replace them. Whether an agent's walkthrough finds the misalignments real users find is an open question the Phase 11 evals test.

## When things change

Any stage can be revisited. When an upstream section changes, every approved artifact that links to that section is stale and CI fails, so the same pull request deals with each one:

- **Update** it to match, then record new hashes with `node .rfr/checks/process-relink.mjs <id>`.
- **Re-record** its hashes unchanged, when the change does not affect it.
- **Withdraw** it to `draft` with `withdrawn: <reason> (#<issue>)`. Anything approved that links to it then fails too, so the gap is visible all the way down.

Recording hashes is not approval: the pull request that carries them is approved by the stage's approver like any other change. Run `node .rfr/checks/process-trace.mjs --status` to see how far each persona, epic, and story has reached and what needs attention.

## Adopting on an existing project

Run `/rfr-process:setup`, then `/rfr-process:bootstrap`, which drafts the concept, requirements, and personas from the project's README, documentation, issues, code, and running product, and sets an adoption window. Keep existing planning documents where they are; they are evidence, and the code and running product win where they disagree. Once the process artifacts cover what an old document said, archive it or link it from the concept, so there is one source of intent. Until the window ends, artifacts with no links produce warnings instead of failures. Approve the product-level artifacts first, then write stories and documentation for new work as it comes. Existing features get user documentation and tutorials when they next change, or sooner if they matter most to users.

## Recommended tools

These fit the process without competing with it. Versions are the ones checked on 2026-11-01; pin exactly what you install, and update on purpose. The research behind each choice, and the tools considered and not recommended, are in the rules-for-robots note [third-party tools for the project process](../../docs/research/notes/third_party_tools_for_process.md).

### Every profile

| Tool | Stage | Source and pin | Notes |
|---|---|---|---|
| `rfr-core` and `rfr-process` | All | This repository's marketplace | Installing `rfr-process` installs `rfr-core` as its dependency. |
| Context7 | Implementation | `context7@claude-plugins-official` (vendored in that repository) | Current library documentation for the agent. Its hosted service sees your queries; do not send confidential code to it. |

### `web-app` and `static-site`

| Tool | Stage | Source and pin | Notes |
|---|---|---|---|
| Playwright | Tutorials, regression tests | npm `playwright`, an exact version (the runner is tested with 1.63.0) | Runs `runner: web` tutorials. For an agent checking a page, prefer the Playwright CLI to the MCP server in long sessions (rule WEB-004). |
| Starlight | User documentation | npm `@astrojs/starlight` (0.42.x when checked; still 0.x, so pin it) | Publishes `docs/user/` as an accessible static site; the files stay the source. |
| Figma MCP server | Design and UX | `figma@claude-plugins-official`, which pins it to a commit | Only if the project designs in Figma. A hosted service that reads your files, and it needs a paid seat for some features. |

Vale prose linting and Stryker mutation testing arrive as advisory CI jobs in a later slice (spec slice 11g).

### `unreal-plugin`

| Tool | Stage | Source and pin | Notes |
|---|---|---|---|
| Epic's Unreal Engine skills plugin | Design (editor UI), tutorials, demos | `unreal-engine-skills-for-claude-code@claude-plugins-official`, which pins it to a commit | Unreal 5.8 and later. Epic marks Unreal MCP experimental. Use it interactively only, never in CI, with one agent per editor (rule R34 in the rules-for-robots plan), and commit before a long session. See the security notes below. |
| Unreal automation and screenshot functional tests | Tutorials, regression tests | The engine's own test framework | `runner: unreal` tutorials are followed by automation tests. Screenshot tests and Movie Render Queue demo renders run on a GPU runner (spec slice 11h). |

## Installing third-party plugins and MCP servers safely

Plugins and MCP servers run with your permissions on your machine and in your CI. Treat each one like a dependency you are adding to the build.

1. **Install from a source you can trace.** Prefer this repository's marketplace and `claude-plugins-official`. Even there, the official README says: "Anthropic does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change." ([claude-plugins-official](https://github.com/anthropics/claude-plugins-official)) Install community collections one plugin at a time, never wholesale.
2. **Pin to a commit.** A marketplace source of type `github`, `url`, or `git-subdir` takes `ref` (a branch or tag) and `sha` (a full 40-character commit); when both are set, Claude Code checks out `sha`. ([plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference.md)) `claude-plugins-official` already pins its git-sourced third-party entries this way; plugins vendored inside that repository are pinned by the repository itself.
3. **Read before installing, and again before updating.** Read the plugin's `hooks/hooks.json` and the scripts it runs, its `.mcp.json`, and any agent or skill that asks for shell or network tools. On an update, read the diff between the old and new commit.
4. **Expect real attacks.** Snyk's study of public agent skills found that 36.82% (1,467) had at least one security flaw, and confirmed 76 malicious payloads built for credential theft, backdoors, and data exfiltration ([Snyk, February 2026](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)). In October 2026, a tampered copy of the Claude Code extension (versions 2.1.312 and 2.1.313) was served from Cursor's extension marketplace for a few hours and tried to open an SSH backdoor; the official npm package was not affected ([Microsoft Security, 30 October 2026](https://www.microsoft.com/en-us/security/blog/2026/10/30/inside-malicious-claude-code-branded-cursor-extension-persistent-ssh-backdoor/)). Install from the publisher's own channel.
5. **Know what an editor-control server can reach.** Epic's documentation says Unreal MCP has no authentication layer, accepts only local connections by default, and discovers Python toolsets from every installed plugin's `Content/Python/` folder at startup ([Unreal MCP in Unreal Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)). So any process on the machine can drive the editor while it runs, and installing an engine plugin can add tools the agent will use. Do not change the bind address, and review engine plugins as you would Claude Code plugins.
6. **Keep remote services' data in mind.** Hosted MCP servers (Figma, Context7, and others) see what you send them. Check a client's confidentiality terms before connecting their project.
