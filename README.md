# rules-for-robots

Rules, best practices, and agent definitions for agentic software development with Claude Code, aimed at software, websites, web apps, and Unreal Engine plugins that are high-quality, user-centred, performant, scalable, extensible, and maintainable.

Status: early development. Phases 0 (research) and 1 (foundations) are complete; Phase 2 (core rules) is next. See [PLAN.md](PLAN.md).

## How it works

- **Rules** live in `rules/`, one per file, in the format described in [docs/rule-format.md](docs/rule-format.md). Each rule records the failure it prevents and how compliance is checked.
- **Template repos** in `template-repos/` are generated from the rules for three profiles: a Next.js web app, an Astro static site, and an Unreal Engine plugin. They carry `AGENTS.md`, a thin `CLAUDE.md`, and `.claude/rules/`.
- **Plugins** carry skills, agents, and hooks. The `rfr-core` plugin provides `/rfr-core:install-rules`, which copies rule packs into an existing repo (plugins cannot ship rules directly), and default hooks that ask before destructive commands and edits to existing tests. See [plugins/core/README.md](plugins/core/README.md).
- **Evals** (from Phase 2) keep only rules that measurably improve agent output.

The research behind these choices is in [docs/research/findings.md](docs/research/findings.md).

## Using it

In an existing repository, from Claude Code:

```
/plugin marketplace add lifelike-and-believable/rules-for-robots
/plugin install rfr-core@rules-for-robots
/rfr-core:install-rules web-app
```

Profiles: `web-app`, `static-site`, `unreal-plugin`. For a new project, copy the matching folder from `template-repos/`.

## Requirements

- Claude Code 2.1.288 or later.
- Node on the PATH for the `rfr-core` hooks.
- Node 22 or later to build and verify this repo.

## Contributing

See [docs/contributing.md](docs/contributing.md).

## Licence

MIT. Copyright Lifelike & Believable Animation Design.
