# Project findings: the Agentic XR Pipeline

Findings from the Agentic XR Pipeline (rounds 1 to 3), moved here from [the process spec](../../specs/project-process.md) on 2026-11-10 (process plan 23j) so the spec reads as a specification. The criteria each round added are in the spec's acceptance criteria table; this is the record of why. Treat it as history: correct errors, do not rewrite it.

## Project findings: Agentic XR Pipeline, round 1 (2026-11-05)

A second project, a greenfield XR pipeline in solo mode, sent seven recommendations after stage 1 and four more at the end of stage 2. Decisions:

- **Discovery gets an optional stage** (AC-41). The project needed a long use-case and decision document before its requirements, and with no artifact for it, requirements cited it in comments. `docs/product/discovery/<topic>.md` sits between the concept and the requirements, is gated like the concept, and has its own approver key and template. It is optional and numbered 1a, so the stage numbers elsewhere do not change.
- **Open-item markers** (AC-42). `[open]`, `[assumed]`, and `[proposed]` replace free-text TBDs and invented conventions. `[proposed]` also answers the provenance question: text the agent proposed keeps the marker until the approver accepts it, so the distinction survives the chat. The check lists every marker and warns, not fails, when an approved artifact still has one, because a success measure the approver will set later is allowed to stay (next point).
- **Success measures not yet set** may be approved as `[open]` with the event they wait for, if the approver says so in the pull request; the warning stays as the reminder.
- **Requirements carry a `Release:` line** under each heading, which the epics' release groups use.
- **A consistency pass across areas** before requirements are approved, repeated when an area changes later, and a statement of how a reviewed area is re-opened (a draft is edited; an approved one is amended and keeps `approved`).
- **Batch 2, at the end of stage 2.** The cross-area pass found about a dozen real conflicts across nine area files that had each been reviewed, so it is now a required step, and it includes the concept: one requirement contradicted a concept non-goal. The guide says how a later stage re-opens an earlier artifact (decide which is wrong, amend it in its own pull request, say which finding led to it). An approved requirement pointed to a list kept in plain notes; the check now warns when an approved product artifact links to a Markdown file that is not an artifact (AC-43). Several requirements assumed a separate operator, which fails for a solo performer; after personas are approved, each requirement is checked against each persona, starting with the smallest team, and the `persona-walkthrough` agent can do this pass.
- **A repository first.** Setup stops if the folder is not a git repository. The guide says the first commit of a new repository goes straight to the default branch (the approvals job skips a commit with no parent), and in an existing repository the drafts go in through a pull request.

## Project findings: Agentic XR Pipeline, round 2 (2026-11-05)

From running `/rfr-process:setup` on a repository that will hold web apps, Unreal plugins, and possibly Claude Code plugins, and that held only documents when setup ran. Decisions:

- **Several sub-projects share one process.** The profile only chooses the starters and templates setup offers; no check reads it, and each tutorial names its own runner. So a `mixed` setup records each sub-project's folder and profile in the project's `AGENTS.md`, offers persona starters from each profile used, and offers the Stryker configuration per web sub-project. A `profiles:` key in `process.yml` waits until a check or workflow needs to read it. There is no Claude Code plugin profile yet; such a sub-project uses the closest profile's templates.
- **Nothing to infer from.** When the repository has no code yet, setup asks for the profile instead of guessing.
- **Setup never replaces an existing artifact.** The starter step copied the concept template without checking for a concept that was already written.

## Project findings: Agentic XR Pipeline, round 3 (2026-11-05)

From the project's personas stage (ten personas) and a false alarm after its first solo merge. Decisions:

- **Approved working assumptions get their own marker** (AC-46). Personas on a new project with no interviews are honestly approved as working assumptions, but the 0.10.0 warning told the agent to "reword it as settled text", which invites hiding the gap, and forty warnings buried the real ones. `[to validate]` marks a detail the approver accepts to check later; it is listed with the open items and does not warn. The warning for the other markers now says that changing the wording only to clear it hides the gap.
- **The persona template has an Evidence section,** which the guide already asked for, and so do the profile starters.
- **Artifact pull requests name their tier, labelled when opened**: product-level artifacts are `tier:epic`, stories, designs, and user documentation `tier:story`. The project's personas pull request opened without a label and the tier job failed.
- **"Propose approved" in solo mode** is restated so it cannot read as the agent approving: the merge is the approval, and the agent offers a read first when markers remain.
- **"Merge when green" with auto-merge.** Setup tells the user about the repository's auto-merge setting, which lets an agent act on the instruction without waiting on CI itself. Setup does not change the setting.
- **The approvals job looks harder before raising an alarm** (AC-47). After a solo merge made during a GitHub outage, the commit-to-pull-request lookup stayed empty although the pull request showed the merge, and the job opened a false "merged without approval" issue. It now reads the number from the merge or squash commit subject and accepts it only if GitHub reports that pull request merged as this commit, then checks the merger as usual.
- **Server errors are retried** (AC-48). The approvals and issue sync jobs retry an HTTP 500 to 504 twice, after a short wait, instead of failing the run on the first one.
