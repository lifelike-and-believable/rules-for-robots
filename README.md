# rules-for-robots

Rules, best practices, and agent definitions for agentic software development with Claude Code, aimed at software, websites, web apps, and Unreal Engine plugins that are high-quality, user-centred, performant, scalable, extensible, and maintainable.

Status: early development. Phase 0 (research) is complete; Phase 1 (foundations) is in progress. See [PLAN.md](PLAN.md).

## How it works

- **Rules** live in `rules/`, one per file, in the format described in [docs/rule-format.md](docs/rule-format.md). Each rule records the failure it prevents and how compliance is checked.
- **Template repos** in `template-repos/` are generated from the rules for three profiles: a Next.js web app, an Astro static site, and an Unreal Engine plugin. They carry `AGENTS.md`, a thin `CLAUDE.md`, and `.claude/rules/`.
- **Plugins** (coming in Phase 1 and Phase 5) carry skills, agents, hooks, and a rule installer for existing repos.
- **Evals** (from Phase 2) keep only rules that measurably improve agent output.

The research behind these choices is in [docs/research/findings.md](docs/research/findings.md).

## Requirements

- Claude Code 2.1.288 or later.
- Node 22 or later to build and verify this repo.

## Contributing

See [docs/contributing.md](docs/contributing.md).

## Licence

MIT. Copyright Lifelike & Believable Animation Design.
