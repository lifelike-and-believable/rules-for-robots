# Maintenance

How the rule set is versioned, released, and kept current.

## Versioning

The rule set and the `rfr-core` plugin share one semantic version, set in `plugins/core/.claude-plugin/plugin.json`. Claude Code uses that field to decide whether an installed plugin needs updating, so every change to rules, skills, agents, hooks, or the install-rules payload bumps it (R16).

| Change | Bump |
|---|---|
| A MUST rule added, or a rule made stricter so that a repo that passed before can now fail a hook or CI check | Major (minor before 1.0) |
| A rule, pack, skill, agent, or hook removed or renamed, or a rule ID reused | Major (minor before 1.0) |
| A SHOULD or MAY rule added, a new pack, skill, agent, or hook | Minor |
| Wording, sources, practice guides, template fixes, bug fixes in checks or hooks | Patch |

Rule IDs are never reused. A removed rule's ID stays retired so waivers and eval records keep pointing at one meaning.

## Releasing

1. Move the `[Unreleased]` entries in `CHANGELOG.md` under a new version heading with today's date.
2. Set the same version in `plugins/core/.claude-plugin/plugin.json`.
3. Run `npm run build` and `npm run verify`. The release check fails if the changelog and plugin version disagree.
4. Merge, then tag the merge commit `v<version>` and create a GitHub release from the changelog entry.

In this repository, `/rfr-core:release` can drive these steps; it stops for confirmation before committing and tagging.

## Review cycle

Each quarter, and whenever a new model generation ships:

- Re-run the eval suite (`node evals/run.mjs`) on the current models. Remove or rewrite rules that show no effect or a negative one, and record the run in the pull request (R38).
- Re-run the agent and skill smoke tests (`node evals/agents/smoke.mjs`).
- Check framework and engine versions against the packs: Next.js, Astro, Node LTS, Postgres, TypeScript, and the Unreal versions Fab builds by default. When Epic's default three-version set moves, update `unreal-tier2.yml` and the `unreal-plugin` template.
- Re-read the sources behind MUST rules for changes. Lightly repeat the Phase 0 research for anything that moved.
- Review open waivers in the reference projects; a waiver older than two review cycles should become a rule change or be removed.

## Adopting repos

Adopting repos update with `/plugin update rfr-core@rules-for-robots`, then `/rfr-core:install-rules <profile>` to refresh `.claude/rules/`. The skill keeps waivers and asks before replacing files you changed; see [layering-and-overrides.md](layering-and-overrides.md).
