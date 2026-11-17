---
status: draft
---

# Freestyle

Sometimes the person wants to try an idea quickly: a brainstorm that ends in a rough prototype, a spike to see whether a library does what it claims, a throwaway project to learn a tool, a set of images to look at. The process exists so that what reaches a product was approved first, and for this kind of work it is pure cost. This spec adds **freestyle**: local folders where rfr does nothing at all, so that only Claude Code's own defaults apply. Proposed as Phase 28 of `PLAN.md`, from the maintainer on 2026-11-17:

- "rfr needs a 'freestyle' option ... for quick experiments, brainstorms, throwaway projects, etc. where we forego the standard process temporarily in order to just try out ideas quickly."
- "This work would mostly be for 'no-repo' scenarios. just a local folder."
- "Freestyle projects should impose no additional restrictions that claude code does not restrict by default."

Nothing here is built, and its decisions wait for the maintainer.

## Problem

rfr's plugins are installed for the person, so their hooks run in every folder Claude Code opens, including a scratch folder on the desktop. Each hook was run against a plain folder with no git on 2026-11-17:

1. The process hooks are silent there already: the stage guard and the session-start state need `docs/product/process.yml`.
2. rfr-core's guards are not. The MCP guard refused both `generate_image` through Higgsfield and `create_file` through Google Drive, and its remedy (declare the service in a pull request) cannot be followed without a repository. The never list, the pull request approval guard, the test-edit and owned-path guards, and the formatter all still run, and rfr-web's, rfr-unreal's, and rfr-android's guards would too.

So today rfr adds restrictions in a scratch folder that Claude Code does not, and some of them cannot be lifted there at all.

## User stories

- As a person with an idea, I want to try it in a local folder with Claude Code as it comes, with nothing from rfr in the way, so that I find out quickly whether it is worth more.
- As that person, I want to say once where my experiments live, so that I do not set anything up for each one.
- As the maintainer, I want an agent never to be able to make a real project freestyle, since freestyle removes every rfr guard.
- As that person, I want a short way from an experiment that worked to a real project.

## Design

### What a freestyle folder is

The person lists one or more **freestyle roots** in their own settings file, `~/.claude/rfr.json`:

```json
{ "freestyle": ["~/scratch", "D:/experiments"] }
```

A folder is freestyle when its project folder (the git top level, or the folder Claude Code opened when there is no git) is a root or inside one, unless it has `docs/product/process.yml` or its git has a remote. Those two exceptions catch a real project cloned or copied into a root by mistake; they are not a defence against an agent, because inside a root the agent is already unrestricted.

Freestyle cannot be worked out from the folder alone. On 2026-11-17 the command guard allowed `git remote remove origin`, `git config --unset remote.origin.url`, `rm -rf .git`, and `rm docs/product/process.yml`, so a rule such as "no remote means freestyle" would let an agent in a real project remove every rfr guard with one command. The declaration has to be the person's, in a place the agent cannot write.

### In a freestyle folder, rfr does nothing

Every rfr hook in every plugin returns at once, with no decision, no added context, and no log line: rfr-core's guards and formatter, rfr-process's stage guard, session-start state, and stop check, and the guards in rfr-web, rfr-unreal, and rfr-android. What remains is exactly what Claude Code does by default with the person's own settings and permission mode.

rfr's skills and agents stay installed and can be used when the person asks for them; nothing runs on its own.

### Protecting the declaration

Outside freestyle folders, rfr-core refuses an agent's write to `~/.claude/rfr.json`, whether through the file tools or a shell command, with a reason that says the file is the person's own settings and to tell them what to change. This is the one new restriction, and it applies only where rfr's guards already apply. Inside a freestyle folder it is off like everything else, which is acceptable: an agent there is already unrestricted, and widening the roots would only free other folders under the person's own scratch locations if they were listed. The person edits the file themselves, or asks in a session and approves the change Claude Code shows.

### Starting, ending, and keeping an experiment

`/rfr-core:freestyle <what to try>`, when the person asks for it, creates a folder under the first root, named from the text, writes `FREESTYLE.md` in it (what is being tried, the date, an empty `## Findings`), and says to open a session there. It is a convenience: any folder under a root is freestyle without it. With no roots listed, it says how to add one and does nothing else.

`/rfr-core:freestyle end` fills in `## Findings` and offers the way to a real project: move the folder out of the root (or add a remote), create the repository, then `/rfr-process:setup` and `/rfr-process:bootstrap`, which drafts the concept, requirements, and personas from what is there, `FREESTYLE.md` included. From then on rfr applies in full.

### Later, if wanted: a freestyle branch in a real project

An earlier draft proposed an experiment branch inside a project that uses rfr-process, which could not merge. It is kept as slice 28b, to build only if experiments inside a real project turn out to be needed. Copying the project into a freestyle root does the same today.

## Acceptance criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-1 | `isFreestyle(dir)` is true when `~/.claude/rfr.json` lists a root that is the project folder or contains it (after expanding `~`, resolving the path, and comparing case-insensitively on Windows and macOS), the project folder has no `docs/product/process.yml`, and its git, if any, has no remote. It is false when the file is missing, unreadable, or has no `freestyle` list, and for a root that is not an absolute path after expansion. | test: inside, outside, and at a root; nested git; a remote; `process.yml`; `~`; Windows paths and case; a bad file; a relative root. |
| AC-2 | In a freestyle folder every hook in rfr-core, rfr-process, rfr-web, rfr-unreal, and rfr-android exits with no output and writes no log line, for every input that would otherwise refuse, ask, defer, add context, or format. Outside, each hook's output is unchanged. | test: each hook script, with a refused or noted input, in a freestyle folder and in a repository with a remote. |
| AC-3 | Each plugin uses the same `isFreestyle`, copied into it by `npm run build` from one source, as `process.mjs` is; `npm run build:check` fails when a copy differs. | test: the build check with a changed copy. |
| AC-4 | Outside freestyle folders, rfr-core refuses an Edit, Write, or MultiEdit of `~/.claude/rfr.json`, and a shell command that writes, moves, copies over, or deletes it, with a reason that says it is the person's settings and to tell them what to change. Reading it is allowed. | test: each tool; shell forms (`>`, `tee`, `sed -i`, `mv`, `cp`, `rm`), with `~`, `$HOME`, and the absolute path. |
| AC-5 | `freestyle.mjs start "<what to try>"` creates a new folder under the first root, named from the text, with `FREESTYLE.md` holding the text, the date, and an empty `## Findings`, and prints its path. It refuses, saying what to do, with no roots, with no text, or when the folder exists. | test: each case, with a temporary home folder. |
| AC-6 | `freestyle.mjs end` refuses outside a freestyle folder or without `FREESTYLE.md`, and otherwise prints the findings section and the way to a real project. It changes nothing itself. | test: each case. |
| AC-7 | The `freestyle` skill runs only when the person asks for it, and its description says that an agent never adds a root or starts freestyle to get past a guard. | review: the skill file. |
| AC-8 | The rfr-core README and the process guide say what freestyle is, that rfr does nothing there, how to list roots, and how to turn an experiment into a project. The setup skill, asked to set up a folder the person calls an experiment, offers freestyle instead. | review: the README, the guide, and the setup skill. |
| AC-9 | The session replay (`evals/session-replay/replay-commands.mjs`) shows no changed decision on the maintainer's sessions, none of which is in a freestyle root. | review: the replay output in the pull request. |

## Decisions

Waiting for the maintainer. Each has a recommendation. The earlier draft's decisions on a freestyle services list and on running `git init` are gone: with no rfr restrictions, neither is needed.

| # | Decision | Recommended | The alternative, and what it costs |
|---|---|---|---|
| D1 | How is a folder made freestyle? | Roots the person lists in `~/.claude/rfr.json`, which agents may not write (AC-1, AC-4). Set once; every experiment goes under a root. | Worked out from the folder (no remote, no `process.yml`): nothing to set up, but an agent in a real project can remove its remote unrefused and lose every guard. Or an environment variable when starting Claude Code: an agent cannot set it, but the desktop app has no easy way to pass one. |
| D2 | Is the formatter off too? | Yes. "rfr does nothing" is one rule with no exceptions to remember. | Keep it: it restricts nothing and keeps code tidy, but rfr then still changes files the person did not ask it to touch. |
| D3 | Is a folder with a remote or `process.yml` under a root still freestyle? | No: both mean a real project was put there, probably by mistake. | Yes: a root is entirely the person's to decide, and a mistaken clone loses its guards. |
| D4 | Which plugin holds freestyle? | rfr-core holds `isFreestyle` and the skill; the build copies the function into each plugin (AC-3). | Each plugin reads the setting on its own: no build step, and five copies that can drift. |
| D5 | Does it wait for 25f? | No. It changes behaviour only in roots the person lists, plus the refusal to write their settings file, and the replay of their sessions (AC-9) shows nothing else changes. | Wait for 25f, as other guard changes do: safer by rule, and freestyle waits for however long 25f takes. |
| D6 | Build the freestyle branch in a real project (28b)? | Not now; copying the project into a root does the same for the rare case. | Build it with 28a: covers experiments inside a gated project, at the cost of a new rule in the change check and the open-pull-request workflow. |

## Scope

- In (28a): `isFreestyle` and its copies; every hook standing down in freestyle; the refusal to write `~/.claude/rfr.json`; the `freestyle` script and skill; the README, guide, and setup skill text; the replay.
- Later (28b, D6): the freestyle branch in a project that uses rfr-process.
- Out: changing what Claude Code itself allows or asks in a freestyle folder, which is the person's settings and permission mode.

## APIs and assumptions

- The process hooks are silent without `docs/product/process.yml` (`process-next.mjs`, `guard-stages.mjs`); checked on 2026-11-17.
- rfr-core's guards run with or without git, and the MCP guard refuses outside services in a plain folder (`plugins/core/scripts/lib.mjs`, `declaredServices`); checked on 2026-11-17.
- The command guard allows removing a remote, unsetting its address, deleting `.git`, and deleting `process.yml`; checked on 2026-11-17. This is why D1 does not infer freestyle from the folder.
- Hooks get the session's working folder in their input (`cwd`) and `CLAUDE_PROJECT_DIR` in their environment, and run as the person's user, so they can read `~/.claude/rfr.json`.
- `plugins/core/scripts/shell-writes.mjs` already finds the files a shell command writes, which AC-4 reuses.

## Delivery

One slice, 28a, after the decisions are approved: AC-1 to AC-6 tests first, then the code; AC-7 and AC-8 as text; the replay for AC-9 in the pull request. Every plugin with a hook gets a `version` bump, and the changelog entry ends "Adopters: nothing to do. To use freestyle, list your experiment folders under `freestyle` in `~/.claude/rfr.json`."
