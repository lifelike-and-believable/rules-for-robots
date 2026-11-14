---
status: draft
---

# Scoped hosting access

An agent may set up and change the hosting of the one project the lead has named, for everything short of production: create and link the Vercel project, deploy previews, and set the environment variables that previews and local development use. Production, money, deletion, other projects, and reading secrets stay with the lead, whatever any file says. Asked for by the maintainer on 2026-11-14: "it should be possible to give the rfr agent the ability to create and modify a vercel deployment associated with a project". They chose to build it after 8.0.0, because guard behaviour is frozen until 25f passes. Proposed as Phase 28 of `PLAN.md`. Nothing here is built. The `status` field stays `draft` until every `test:` criterion has a citing test.

## Problem

rfr-web's guard (`plugins/web/scripts/guard-mcp.mjs`, rule NODE-002) lets Vercel reads and new preview deployments through, and asks before anything else: creating a project, linking a repository, changing settings, and every environment variable. Agents now run unattended, and nobody is there to answer, so an ask is a refusal. The CLI guard (`guard-cli.mjs`) does the same for `vercel env add` and the rest.

So setting up a place to try the product (lasting-tutorials, "A place to try it") falls to the lead. On XR Studio In A Box the design for trial copies lists, as checks only the lead can do: connect the Vercel project, add the Neon integration for Preview only, and set `XR_TRY=1` and the trial secrets for Preview only. Each is ordinary, reversible work on one project, and none touches production. The guard cannot tell it apart from the dangerous calls, because it does not know which project the lead meant, or which environment a change reaches.

## User stories

- As a project lead, I want to name the hosting project an agent may manage, once, in a document I review, so that setting up previews is not my job.
- As a project lead, I want production, purchases, deletion, and my other projects out of an agent's reach whatever that document says, so that granting this cannot cost me money or a live site.
- As an agent, I want to set a preview's environment variables with values I generate, without reading any secret back, so that I can finish a place to try the product without asking.

## Design

**The grant.** `docs/product/process.yml` gains a `hosting:` block: `provider: vercel`, the `team` id, and the `project` id or name (or `create: <name>` before the project exists). The file is in a gated folder, so the grant takes the lead's review to add, widen, or move, and an agent cannot grant itself access.

**What the grant allows, for that project only.** Creating the project when the grant says `create:`, and linking it to this repository; preview deployments, including redeploying a preview; reading the project's settings and deployments; creating, editing, and removing environment variables whose targets are only `preview` and `development`, with values the agent supplies; and the Git and build settings a preview needs (framework, build command, root directory), but not settings that change production behaviour (the production branch, domains, protection, the default environment).

**What no grant allows.** Anything that reaches production: a production deployment, promotion, rollback, aliases and domains, a variable whose targets include `production`, a shared variable linked to production, and changing which branch is production. Reading a secret (decrypting variables, tokens). Deleting a project or a deployment. Buying anything (domains, integrations with a price, plan changes). Team, member, billing, and firewall settings. Any call naming a team or project the grant does not name, or naming none when the tool would act on a default. These are refused, never asked, and the refusal says what the lead does instead.

**Integrations.** Adding a Marketplace integration such as Neon usually needs the lead to approve the connection in a browser once. The tools report this as an action for the person; the agent passes the address on, and finishes the rest once it is done. An integration with a price is a purchase and is refused.

**The CLI.** The same rules apply to `vercel` commands: with a grant, `vercel link` to the named project, `vercel env add <name> preview` and `development`, `vercel env rm` for those targets, and `vercel deploy` without `--prod` pass; production, `--prod`, `promote`, `rollback`, `alias`, `domains`, `remove`, and `env pull` stay refused.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `parseProcessConfig` reads a `hosting:` block with `provider` (only `vercel` for now), `team`, and exactly one of `project` and `create`; it refuses any other key, a missing team, and both or neither of `project` and `create`. | test: each valid form and each refusal. |
| AC-2 | `guard-mcp.mjs` reads the grant from the project's `process.yml` on the default branch, not the working tree, so a branch cannot widen its own access. With no grant, its decisions are exactly as before. | test: a grant in the working tree only; a grant on the default branch; no grant, compared with today's decisions. |
| AC-3 | With a grant, these Vercel MCP calls pass when they name the granted team and project: creating the project (only when the grant says `create:`, and only with that name), linking its Git repository to this repository, creating or redeploying a preview deployment, reading its settings, deployments, and logs, creating, editing, and removing environment variables whose targets are a non-empty subset of `preview` and `development`, and updating the build settings named in "Design". | test: each call passing; each with another project or team; each with no project named. |
| AC-4 | With or without a grant, these are refused, with a reason that names what the lead does instead: a production deployment, promotion, rollback, alias, or domain change; an environment variable whose targets include `production`, or a change to a variable that already targets it; a shared variable; reading a decrypted value or a token; deleting a project or deployment; a purchase; team, member, billing, protection, and firewall settings; changing the production branch. None of them asks. | test: each refusal, with a grant naming the same project. |
| AC-5 | `guard-cli.mjs` applies the same grant to `vercel` commands (see "The CLI"), reading the project from `--project`, `--scope`, or the linked `.vercel/project.json`, and refusing a command whose project it cannot determine. | test: each passing command; production forms; an unlinked directory. |
| AC-6 | NODE-002's rule text, the rfr-web README, and the guide's validation part ("A place to try it") say what a grant allows and what it never allows, and that the lead approves it by reviewing `process.yml`. The `setup` skill offers to write the grant when the project has preview deployments. | test: the texts. |
| AC-7 | Before this merges, the guard change is replayed against the maintainer's recorded sessions (`evals/session-replay/`), and no decision changes for a session with no grant. | command: the replay, with its output in the pull request. |

## Decisions for the maintainer

| # | Decision | Recommendation | The alternative, and what it costs |
|---|---|---|---|
| D1 | Where does the grant live? | `docs/product/process.yml`, read from the default branch: one reviewed file, which the agent cannot widen. | A Claude Code permission setting: per machine, invisible to review, and not shared by cloud sessions. |
| D2 | May an agent create the Vercel project? | Yes, only when the grant says `create: <name>`, and only that name. | The lead always creates it: one more manual step for every new project. |
| D3 | May an agent set preview variables to values it generates? | Yes, for `preview` and `development` only. It cannot read them back. | Values only from the lead: the trial secrets would stay a manual step. |

## Scope

- In: `checks/lib/process.mjs` (`hosting:`), `plugins/web/scripts/guard-mcp.mjs`, `plugins/web/scripts/guard-cli.mjs`, rule NODE-002, the rfr-web README, the guide's validation part, the `setup` skill, tests, and the session replay.
- Out: hosts other than Vercel; database providers' own tools (a Neon MCP server would need its own grant); production deployment by an agent, in any form; storing or reading secrets for the lead.

## APIs and assumptions

- The Vercel MCP tools take a team and project as arguments (`teamId`, `projectId` or name) for project-level calls; the guard reads those. A tool that acts on a default team or project when none is given is refused under a grant, because the guard cannot tell what it would touch. To confirm against the installed tool schemas when 28a starts.
- Environment variable targets are named in the call (`target: ["preview"]`); to confirm the field names against the installed schemas.
- Freeze: this changes guard behaviour, so it starts after 25f passes and 8.0.0 is released, and is replayed against the maintainer's sessions before it merges (AC-7).

## Delivery

- Plan item: `PLAN.md`, Phase 28, after 8.0.0. One pull request for the grant and the MCP guard (28a, AC-1 to AC-4), one for the CLI and the texts (28b, AC-5, AC-6), each with the replay (AC-7).
- Pull requests: none yet.
