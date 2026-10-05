# rules-for-robots

Rules, best practices, and agent definitions for agentic software development with Claude Code, aimed at software, websites, web apps, and Unreal Engine plugins that are high-quality, user-centred, performant, scalable, extensible, and maintainable.

Status: pre-1.0. Research, foundations, core rules, stack packs, practice guides, agents and skills, CI integration, and the reference web app are done; the Unreal Tier 2 run, the Phase 8 evals, and the 1.0 release are in progress. See [PLAN.md](PLAN.md) and [CHANGELOG.md](CHANGELOG.md).

## How it works

- **Rules** live in `rules/`, one per file, in the format described in [docs/rule-format.md](docs/rule-format.md). Each rule records the failure it prevents and how compliance is checked.
- **Template repos** in `template-repos/` are generated from the rules for three profiles: a Next.js web app, an Astro static site, and an Unreal Engine plugin. They carry `AGENTS.md`, a thin `CLAUDE.md`, and `.claude/rules/`.
- **Plugins** carry skills, agents, and hooks. The `rfr-core` plugin provides `/rfr-core:install-rules`, which copies rule packs into an existing repo (plugins cannot ship rules directly), and default hooks that ask before destructive commands and edits to existing tests. See [plugins/core/README.md](plugins/core/README.md).
- **Evals** keep only rules that measurably improve agent output.

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
