---
status: draft
---

# Freestyle

Sometimes the person wants to try an idea quickly: a spike to see whether a library does what it claims, a brainstorm that ends in a rough prototype, a throwaway project to learn a tool. The process exists so that what reaches the product was approved first, and for this kind of work it is pure cost: a concept, stories, a design, and user documentation for something that may be deleted in an hour. This spec adds **freestyle**: work declared ahead of time as outside the process, which for that reason can never reach the product's default branch on its own. Proposed as Phase 28 of `PLAN.md`, at the maintainer's request on 2026-11-17 ("rfr needs a 'freestyle' option ... for quick experiments, brainstorms, throwaway projects, etc. where we forego the standard process temporarily in order to just try out ideas quickly"). Nothing here is built, and its decisions wait for the maintainer.

## Problem

The maintainer's standing direction is that every stage is required unless deliberately waived ahead of time. Today the only waiver is per stage, for the whole project, in `process.yml`. There is no way to say "this piece of work is an experiment".

What happens now when a person asks for one in a project that uses rfr-process:

1. The session is told, at its start, that a source change belongs to a feature with an approved spec (`process-state.md`, AC-3). A well-behaved agent then either refuses to write the code or writes a concept and stories first. Either way the quick try is no longer quick.
2. If the agent writes the code anyway on a `claude/**` or `feature/**` branch, `rfr-open-pr.yml` opens a pull request with auto-merge on. The `process / change` check fails it, which is correct, but it says "needs a feature with a spec", which reads as a fault to fix rather than the expected end of an experiment, and the pull request sits open.
3. Nothing records what the experiment was for or what it found, so what was learned is lost when the branch is.

In a repository with no `docs/product/process.yml`, rfr-process already stays out of the way: the stage guard and the session-start state are silent there. But the setup skill offers no such answer, so a person who asks to "set up rfr" for a throwaway project is walked through approvers, personas, and a `try:` block.

## User stories

- As a project lead, I want to try an idea in my project without writing the process documents first, so that I find out whether it is worth a packet before I pay for one.
- As a project lead, I want freestyle work to be unable to reach the default branch, so that turning freestyle on never needs my approval and never weakens the gate.
- As a project lead, I want what an experiment found to be written down, so that I can start a packet from it or drop it knowingly.
- As a person starting a throwaway project, I want rfr's safety guards without its process, and a clear way to adopt the process later if the project lasts.
- As an agent, I want to be told plainly that the current branch is freestyle, so that I build the experiment instead of asking for stages that do not apply.

## Design

### Two kinds of freestyle

- **A freestyle project** is a repository that does not use rfr-process at all. Nothing new is needed to make one: without `process.yml` the process hooks are silent. The setup skill gains the answer, and rfr-core's guards stay on (the never list, outside services, pull request approval, existing tests, owned paths). Adopting the process later is the existing route: `/rfr-process:setup`, then `/rfr-process:bootstrap`, which drafts the first documents from what the experiment built.
- **A freestyle branch** is an experiment inside a project that uses rfr-process. This is the new part.

### A freestyle branch

A branch is freestyle when it holds a **freestyle note**, `docs/freestyle/<branch>.md` (each `/` in the branch name written as `-`, as for decisions files). The note is committed, so it survives the end of a cloud session and CI can see it. It holds:

- what is being tried, in a sentence or two, written when freestyle starts;
- the date it started;
- `## Findings`, filled in as the experiment goes and when it ends: what worked, what did not, what it would take to do properly.

`/rfr-process:freestyle <what to try>` writes the note on the current branch and commits it. On the default branch it refuses and says to start a branch first. `/rfr-process:freestyle end` fills in the findings, commits them, and offers three ways on: leave the branch as a record, delete it, or start a packet whose concept or stories cite the note.

On a freestyle branch:

- **The session is told.** In place of the process rule, the session-start state says the branch is freestyle, what it is trying, that no stage or spec is needed for code here, that the branch will not merge, and that findings go in the note.
- **No pull request is opened for it.** `rfr-open-pr.yml` skips a push whose tree holds the branch's freestyle note.
- **It cannot merge.** `process / change` fails a pull request that adds or changes a file under `docs/freestyle/`, with a message that says this is freestyle work, which does not merge, and how to carry it into a packet. This is the one hard control, and it is the gate's existing check, so a freestyle branch never needs anyone's approval.
- **Everything else is unchanged.** The stage guard still refuses an unapproved design, user documentation, spec, or tutorial in the process folders; an experiment does not need them, and sketches go beside the note. rfr-core's guards all still apply.

### Leaving freestyle

What an experiment found reaches the product only through the process. The usual route is a packet: the concept, a story, or a design cites the freestyle note as its evidence, and is reviewed as usual. Once the spec is approved, a delivery run may reuse the experiment's code, as it would reuse any code: the change check, tests that cite the spec, and review all apply, and the run's decisions file names the freestyle branch it took code from.

## Acceptance criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-1 | `freestyleNote(branch)` returns `docs/freestyle/<branch>.md` with each `/` and `\` written as `-`, the same mapping as `decisionsFile`. | test: a nested branch name; a plain one. |
| AC-2 | `freestyle.mjs start "<what to try>"` writes the note with the text, the date, and an empty `## Findings`, and commits it. It refuses on the default branch, on a detached head, with no text, and when the note already exists; each refusal says what to do instead. | test: each case, in a temporary repository. |
| AC-3 | `freestyle.mjs end` refuses when the branch has no note, and otherwise prints the findings section to fill in and the three ways on. It changes nothing itself; the skill writes the findings and commits them. | test: with and without a note. |
| AC-4 | On a branch whose working tree holds its freestyle note, the session-start state prints the freestyle lines (the branch is freestyle, what it tries, no stage or spec is needed for code, it will not merge, findings go in the note) in place of the process rule and the feature list, in at most 8 lines. On any other branch the output is unchanged. | test: a freestyle branch; the same repository on another branch; a note for a different branch. |
| AC-5 | `process / change` fails a pull request whose diff adds, changes, or deletes a file under `docs/freestyle/`, naming the file and saying that freestyle work does not merge and how to carry it into a packet. A `Change: fix` or `Change: trivial` declaration does not change this. | test: add, change, delete; with each declaration. |
| AC-6 | `rfr-open-pr.yml` opens no pull request for a push whose tree holds `docs/freestyle/<branch>.md` for the pushed branch, and logs why. | test: the workflow's step script against a tree with and without the note. |
| AC-7 | The stage guard's decisions are unchanged on a freestyle branch, and its refusal text does not mention freestyle. | test: the existing stage-guard cases, run on a freestyle branch. |
| AC-8 | The `freestyle` skill starts freestyle only when the person asks for it. Its description says so, and that an agent never starts freestyle to get past a stage refusal. | review: the skill file. |
| AC-9 | The setup skill offers a freestyle project: when the person says the repository is an experiment or throwaway, it writes no rfr-process files, says which rfr-core guards still apply, and says how to adopt the process later. | review: the skill file. |
| AC-10 | The guide has a freestyle section: both kinds, what is off and what is not, how to end, and how findings reach a packet. The `deliver` skill tells a run that reuses freestyle code to name the branch in its decisions file. | review: the guide and the skill. |

## Decisions

Waiting for the maintainer. Each has a recommendation.

| # | Decision | Recommended | The alternative, and what it costs |
|---|---|---|---|
| D1 | How is a whole repository made freestyle? | By not adopting rfr-process, with the setup skill offering it (AC-9). No new setting. | A `"process": "freestyle"` line in `.claude/rfr.json`: one more setting to read and test, for what having no `process.yml` already does. |
| D2 | What marks a freestyle branch? | A committed note, `docs/freestyle/<branch>.md`. It survives the session, CI sees it, and it is where findings go. | A branch name prefix such as `freestyle/**`: simpler, but cloud sessions are given their branch name (`claude/...`), so they could not use it. A marker in the git folder, like a delivery run's: lost when a cloud session ends, and CI cannot see it. |
| D3 | Who may start freestyle? | The person, by the slash command or by asking in plain words; never the agent on its own (AC-8). Nothing needs approving, because the branch cannot merge. | Freestyle only through the slash command, with the skill hidden from the model: stricter, and "let's just try it" in chat would not work. |
| D4 | Can freestyle work merge at all? | No. Findings reach the product only through a packet; code only through a delivery run after the spec is approved (AC-5). | Let the note merge alone, as a record on the default branch: experiments stay findable after their branch is deleted, at the cost of a second kind of document in the gated history. Worth revisiting if findings get lost. |
| D5 | Is anything in rfr-core relaxed on a freestyle branch? | No. Its guards protect the person's machine, outside services, and the gate, and an experiment needs all of that. The existing-test guard already lets a change go ahead and asks the agent to report it. | Turn off the existing-test and owned-path guards on freestyle branches: a little faster, and the first guard change that depends on the branch. |
| D6 | Do freestyle branches expire? | No. `end` is offered, and a branch left open is the person's to delete. | List freestyle branches older than some age in the session-start state: a reminder, and more lines in every session. |

## Scope

- In: the freestyle note and its script; the `freestyle` skill; the session-start lines; the change check and open-pull-request workflow rules; the setup skill's answer; the guide; the delivery note on reused code.
- Out: any change to the stage guard or to rfr-core's guards (D5); expiry (D6); a freestyle mode for the default branch of a gated project.

## APIs and assumptions

- The session-start hook and the stage guard are silent without `docs/product/process.yml` (`process-next.mjs`, `guard-stages.mjs`), which is what makes a freestyle project need no new code.
- `rfr-open-pr.yml` runs on pushes to `claude/**`, `phase-*/**`, and `feature/**`, so a freestyle branch in a cloud session would otherwise get a pull request with auto-merge on.
- `process / change` already reads a pull request's diff and commit trailers, so AC-5 is a new rule in an existing check.
- No guard changes, so the freeze on guard behaviour until 25f passes does not hold this up. The session-start state is a hook, but it only informs.

## Delivery

One slice, 28a, after the decisions are approved: AC-1 to AC-7 tests first, then the script, the session-start lines, the change check rule, and the workflow; AC-8 to AC-10 as text. rfr-process's `version` is bumped, and the change goes in the changelog with "Adopters: nothing to do; copy the new `rfr-open-pr.yml` to skip pull requests for freestyle branches."
