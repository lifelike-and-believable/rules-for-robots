<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/lockups/rules-for-robots-dark.svg">
    <img src="docs/brand/lockups/rules-for-robots-light.svg" alt="Rules for Robots" height="72">
  </picture>
</h1>

Rules, best practices, and agent definitions for agentic software development with Claude Code, aimed at software, websites, web apps, and Unreal Engine plugins that are high-quality, user-centred, performant, scalable, extensible, and maintainable.

Status: v5.8.0 (`rfr-core`), in use on the maintainer's projects. Rules, practice guides, agents, skills, guards, CI workflows, template repos, and the `rfr-process`, `rfr-web`, `rfr-unreal`, and `rfr-feedback` plugins are released. Work in progress: the eval rounds for Phases 10 and 13 to 15, and a delegated working mode that asks the maintainer only for intent, taste, and irreversible actions ([improvement plan](docs/improvement-plan.md)). See [PLAN.md](PLAN.md) and [CHANGELOG.md](CHANGELOG.md).

## How it works

- **Rules** live in `rules/`, one per file, in the format described in [docs/rule-format.md](docs/rule-format.md). Each rule records the failure it prevents and how compliance is checked.
- **Template repos** in `template-repos/` are generated from the rules for three profiles: a Next.js web app, an Astro static site, and an Unreal Engine plugin. They carry `AGENTS.md`, a thin `CLAUDE.md`, and `.claude/rules/`.
- **Plugins** carry skills, agents, and hooks. The `rfr-core` plugin provides `/rfr-core:install-rules`, which copies rule packs into an existing repo (plugins cannot ship rules directly), and default hooks that ask before destructive commands and edits to existing tests. See [plugins/core/README.md](plugins/core/README.md). Domain plugins add what only one kind of project uses: `rfr-web` ([plugins/web/README.md](plugins/web/README.md)) for websites and web apps, `rfr-unreal` ([plugins/unreal/README.md](plugins/unreal/README.md)) for Unreal Engine plugins, and `rfr-android` ([plugins/android/README.md](plugins/android/README.md)) for Android, Android TV, and Google TV apps.
- **Evals** keep only rules that measurably improve agent output.

One idea runs through all of it: every change, to even the smallest component, is a change to the whole of the project, so each change is checked against the whole product, not only its diff. The [process guide](plugins/process/guide/start.md#every-change-is-a-change-to-the-whole) explains how the development process applies this.

The research behind these choices is in [docs/research/findings.md](docs/research/findings.md).

## Using it

In an existing repository, from Claude Code:

```
/plugin marketplace add lifelike-and-believable/rules-for-robots
/plugin install rfr-core@rules-for-robots
/plugin install rfr-web@rules-for-robots
/rfr-core:install-rules web-app
```

Profiles: `web-app` and `static-site` (with `rfr-web`), `unreal-plugin` (with `rfr-unreal` in place of `rfr-web`), and `general` (`rfr-core` only) for anything else, such as a command-line tool, a service, or a desktop, mobile, or TV app. For a new project, copy the matching folder from `template-repos/`.

To report what your project learns back to this repository, install the optional `rfr-feedback` plugin (`/plugin install rfr-feedback@rules-for-robots`) and ask the agent to report feedback; it drafts an issue, checks it for private details, and files it only when you confirm. See [plugins/feedback/README.md](plugins/feedback/README.md).

## Requirements

- Claude Code 2.1.288 or later.
- Node on the PATH for the plugins' hooks.
- Node 22 or later to build and verify this repo.

## Contributing

See [docs/contributing.md](docs/contributing.md).

## Licence

MIT. Copyright Lifelike & Believable Animation Design.
