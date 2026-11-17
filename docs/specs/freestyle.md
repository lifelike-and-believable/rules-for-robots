---
status: draft
---

# Freestyle

Sometimes the person wants to try an idea quickly: a brainstorm that ends in a rough prototype, a spike to see whether a library does what it claims, a throwaway project to learn a tool, a set of images to look at. The process exists so that what reaches a product was approved first, and for this kind of work it is pure cost. This spec adds **freestyle**: work in a local folder, with no repository on GitHub, where rfr keeps its safety guards and drops everything else. Proposed as Phase 28 of `PLAN.md`, at the maintainer's request on 2026-11-17: "rfr needs a 'freestyle' option ... for quick experiments, brainstorms, throwaway projects, etc. where we forego the standard process temporarily in order to just try out ideas quickly", and "this work would mostly be for 'no-repo' scenarios. just a local folder." Nothing here is built, and its decisions wait for the maintainer.

## Problem

rfr's plugins are installed for the person, so their hooks run in every folder Claude Code opens, including a scratch folder on the desktop. What happens there today was checked on 2026-11-17 by running each hook against a plain folder with no git:

1. **The process is already out of the way.** The stage guard and the session-start state are silent without `docs/product/process.yml`, and the delivery stop check acts only during a delivery run.
2. **Outside services are closed, with no way to open them.** The MCP guard refused both `generate_image` through Higgsfield and `create_file` through Google Drive, even with `.claude/rfr.json` listing Higgsfield. A service counts only "as merged to the default branch", and its refusal says to add it in a pull request. A folder with no repository has neither, so a brainstorm cannot make an image, a video, or a document at all.
3. **A delete cannot be undone.** In a repository, `rm -rf build notes.md` goes ahead and the agent is told how to restore the files, because a snapshot commit is taken first. In a plain folder the same command goes ahead silently and the files are gone: the snapshot is a git commit, so there is none.
4. **Some messages talk about things that are not there.** Weakening an existing test goes ahead with a note that "the pull request decides", and there will be no pull request.
5. **Nothing records what was tried or found**, so when the folder is deleted or forgotten, what was learned goes with it. And a folder that turns out to be worth keeping has no clear way into the process.

## User stories

- As a person with an idea, I want to try it in a local folder without the process, so that I find out quickly whether it is worth more.
- As that person, I want the agent to make images, video, or documents in the services I use for this kind of work, without being asked each time and without a repository to declare them in.
- As that person, I want a delete to be recoverable, so that a quick experiment cannot lose work.
- As that person, I want what the experiment found written down, and, if it is worth keeping, a short way from the folder to a real project.
- As an agent, I want to be told that this folder is freestyle, so that I build the experiment instead of asking for documents that do not apply.

## Design

### What a freestyle folder is

A folder is **freestyle** when it has no `docs/product/process.yml` and is not a repository with a remote: either it has no git at all, or its git has no remote. Nothing has to be declared, and an agent cannot make a real project freestyle, because a repository cloned from GitHub has a remote.

### Starting one

`/rfr-core:freestyle <what to try>`, when the person asks for it:

1. Runs `git init` in the folder if it has no git, so that deletes can be snapshotted and undone. Nothing is pushed and no remote is added; the git history is only an undo history.
2. Writes `FREESTYLE.md` at the top of the folder: what is being tried, the date, and an empty `## Findings`.
3. Says, in a few lines, what still applies and what does not (below).

A freestyle folder works without the skill too; the skill only adds the undo history and the note.

### What still applies, and what does not

| Area | In a freestyle folder |
|---|---|
| The process (stages, specs, tutorials, the change check, delivery runs) | Off. It already is without `process.yml`. |
| The never list (destructive or outward commands) | On, unchanged. |
| Deletes | Go ahead, after a snapshot, when the folder has git. Without git, the agent is told the files cannot be restored and to move them aside instead. |
| Outside services | Making things is allowed in the services the person lists for freestyle work in `~/.claude/rfr.json`. Deleting, sharing, publishing, sending, and buying are still refused everywhere. |
| Approving or merging pull requests | Still refused; there are none here anyway. |
| Weakening an existing test | Goes ahead, with a note to say so in the report and no mention of a pull request. |
| Owned paths, formatting | Unchanged. |

### The person's freestyle services

`~/.claude/rfr.json` may hold `"services"`, in the same form as a project's: a name, or an object with a name, what it is for, and its limits. This list is the person's own, written once by them; Claude Code asks before an agent writes inside `~/.claude`, so a session cannot add to it quietly. It applies only in freestyle folders. A project with a remote keeps using its own list, as merged to its default branch, and ignores this one.

### Ending one, or keeping it

`/rfr-core:freestyle end` fills in `## Findings`: what worked, what did not, what it would take to do properly. It then offers two ways on: leave the folder as it is, or make it a project. Making it a project is the existing route: create the repository and push, then `/rfr-process:setup` and `/rfr-process:bootstrap`, which drafts the concept, requirements, and personas from what is there, `FREESTYLE.md` included. From then on the folder has a remote and is no longer freestyle.

### Later, if wanted: a freestyle branch in a real project

The first version of this spec, written before the maintainer said the work is mostly local folders, proposed an experiment branch inside a project that uses rfr-process: a committed note `docs/freestyle/<branch>.md` would tell the session the process is off there, `rfr-open-pr.yml` would open no pull request for it, and `process / change` would refuse to merge it, so it would need no approval. It is kept here as slice 28b, to build only if experiments inside a real project turn out to be needed. The same thing can be had today by copying the project into a local folder.

## Acceptance criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-1 | `isFreestyle(dir)` is true when the folder has no `docs/product/process.yml` at its top and either is in no git repository or its repository has no remote; false otherwise. The top is the git top level, or the project folder when there is no git. | test: no git; git with no remote; git with a remote; each with and without `process.yml`. |
| AC-2 | The MCP guard, in a freestyle folder, allows a tool that makes or changes something in a service named in `"services"` in `~/.claude/rfr.json`, and refuses it for any other service, with a reason that names that file instead of a pull request. Deleting, sharing, publishing, sending, and buying are refused as before. Outside a freestyle folder the guard's decisions are unchanged, and the user-level list is never read there. | test: each case in a freestyle folder; the same calls in a repository with a remote, with and without a user-level list. |
| AC-3 | The command guard, in a folder with no git, adds context to a command that deletes existing files saying they cannot be restored and to move them aside instead; it still allows the command. In a git folder, with or without a remote, behaviour is unchanged. | test: the delete in a plain folder and in a git folder. |
| AC-4 | The existing-test context in a freestyle folder says to name the change in the report and does not mention a pull request. Elsewhere the text is unchanged. | test: both texts. |
| AC-5 | `freestyle.mjs start "<what to try>"` runs `git init` when the folder has no git, writes `FREESTYLE.md` with the text, the date, and an empty `## Findings`, and adds no remote. It refuses, saying why, in a folder that is not freestyle, with no text, or when `FREESTYLE.md` already exists. | test: each case, in temporary folders. |
| AC-6 | `freestyle.mjs end` refuses without `FREESTYLE.md`, and otherwise prints the findings section to fill in and the two ways on. It changes nothing itself. | test: with and without the note. |
| AC-7 | The `freestyle` skill starts freestyle only when the person asks for it, in a slash command or in plain words, and says what still applies in at most 8 lines. | review: the skill file. |
| AC-8 | The rfr-core README and the process guide say what a freestyle folder is, what is off and on, how to list freestyle services, and how to turn the folder into a project. The setup skill, asked to set up a folder the person calls an experiment, offers freestyle instead. | review: the README, the guide, and the setup skill. |
| AC-9 | The session replay (`evals/session-replay/replay-commands.mjs`) shows no changed decision on the maintainer's sessions, all of which are in repositories with a remote. | review: the replay output in the pull request. |

## Decisions

Waiting for the maintainer. Each has a recommendation.

| # | Decision | Recommended | The alternative, and what it costs |
|---|---|---|---|
| D1 | What makes a folder freestyle? | No `process.yml` and no remote, worked out each time (AC-1). Nothing to declare, and a clone of a real project can never be freestyle. | A marker file the person writes: explicit, but an agent can write it too, so it proves nothing, and a forgotten one leaves a real project half outside its rules. |
| D2 | Where are freestyle services approved? | A list in `~/.claude/rfr.json`, written once by the person, read only in freestyle folders. | A list in each folder's `.claude/rfr.json`: closer to the work, but the agent writes the folder, so the list would be the agent's own approval. Or no services in freestyle at all: safe, and a brainstorm cannot make a picture. |
| D3 | Does starting freestyle run `git init`? | Yes, with no remote: deletes become recoverable, and git is otherwise invisible. | No git: a plain folder stays plain, and every delete is final; the guard can only say so. |
| D4 | Which plugin holds freestyle? | rfr-core, since a freestyle folder uses no part of rfr-process and may not have it installed. | rfr-process, beside the rest of the process: but then the person needs rfr-process for the one kind of work that does not use it. |
| D5 | Does it wait for 25f? | No. It changes the MCP and command guards only in folders with no remote, and the replay of the maintainer's sessions (AC-9) shows that nothing else changes. | Wait for 25f, as other guard changes do: safer by rule, and freestyle is blocked for however long 25f takes. |
| D6 | Build the freestyle branch in a real project (28b)? | Not now. Copying a project to a local folder does the same for the rare case; build 28b only if that proves too clumsy. | Build it with 28a: covers experiments inside a gated project, at the cost of a new rule in the change check and the open-pull-request workflow. |

## Scope

- In (28a): `isFreestyle`; the MCP guard's freestyle services; the command guard's delete context with no git; the test-edit wording; the `freestyle` script and skill in rfr-core; the README, guide, and setup skill text; the replay.
- Later (28b, D6): the freestyle branch in a project that uses rfr-process.
- Out: relaxing the never list or the pull request approval guard anywhere; a freestyle mode for a repository with a remote.

## APIs and assumptions

- The process hooks are silent without `docs/product/process.yml` (`process-next.mjs`, `guard-stages.mjs`); checked on 2026-11-17.
- `declaredServices` returns no services outside a git repository, and reads a project's list only as it stands on the default branch (`plugins/core/scripts/lib.mjs`); checked on 2026-11-17 against a plain folder.
- The snapshot before a destructive command is a git commit (`plugins/core/scripts/snapshot.mjs`), so a folder with no git has none.
- Claude Code asks before writing to `~/.claude`, as it does for a project's `.claude` folder (Phase 1 finding). Assumed for the user-level folder; to check in 28a before relying on it in D2.
- `git remote` with no output is how "no remote" is read; a remote added by hand later makes the folder a project.

## Delivery

One slice, 28a, after the decisions are approved: AC-1 to AC-6 tests first, then the code; AC-7 and AC-8 as text; the replay for AC-9 in the pull request. rfr-core's `version` is bumped, and the changelog entry ends "Adopters: nothing to do. To let freestyle folders make things in a service, list it under `services` in `~/.claude/rfr.json`."
