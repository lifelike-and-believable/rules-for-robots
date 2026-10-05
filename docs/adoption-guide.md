# Adoption guide

How to use rules-for-robots as a solo developer, a team, or an organization. Requirements: Claude Code 2.1.288 or later, and Node on the PATH for the `rfr-core` hooks.

## Solo developer, new project

1. Create the project with its usual tool (`create-next-app`, `create astro`, or the Unreal plugin wizard).
2. Copy the matching folder from [`template-repos/`](../template-repos/) into it: `web-app`, `static-site`, or `unreal-plugin`. Each folder's README lists the remaining steps (scripts, secrets, labels, runner).
3. Fill in `AGENTS.md` with the verify command and the decisions an agent cannot infer.
4. Open Claude Code in the project and accept the `rfr-core` plugin when prompted.

## Solo developer, existing project

1. In Claude Code: `/plugin marketplace add lifelike-and-believable/rules-for-robots`, then `/plugin install rfr-core@rules-for-robots`.
2. Run `/rfr-core:install-rules <profile>` and approve the writes to `.claude/rules/`.
3. Add an `AGENTS.md` with a verify command (and a `CLAUDE.md` containing `@AGENTS.md`) if the project has neither.
4. Copy the CI workflows you want from the matching template repo. At minimum, call the reusable guards:

```yaml
jobs:
  guards:
    uses: lifelike-and-believable/rules-for-robots/.github/workflows/rfr-guards.yml@main
```

5. Commit `.claude/` so the rules and plugin settings apply to everyone working in the repository.

### Owned paths

If your repository takes regular integrations from an upstream branch, edits to upstream-owned files are overwritten at the next integration. List the paths your branch owns in `AGENTS.md`:

```markdown
## Owned paths

- `Plugins/MyPlugin/**`
- `Source/MyGameTests/**`
- `AGENTS.md`
- `.github/`
```

Each bullet is a backticked glob relative to the repository root; a trailing `/` covers a whole folder. Once the section exists, the `rfr-core` hook `guard-owned-paths` asks before an agent edits any other file in the project. To also fail pull requests that touch other paths, turn on the job in the reusable guards:

```yaml
jobs:
  guards:
    uses: lifelike-and-believable/rules-for-robots/.github/workflows/rfr-guards.yml@main
    with:
      owned-paths: true
```

The job is off by default. When it is on and `AGENTS.md` has no `## Owned paths` section, it passes and prints a note. The list is read from the pull request's own `AGENTS.md`, so a change to the list shows up in review. See [working with agents](../practices/working-with-agents.md#scope) for the guidance behind it.

## Team

- Commit `.claude/settings.json` with `extraKnownMarketplaces` and `enabledPlugins` (the template repos already do), so every collaborator gets the same plugin.
- Pin the reusable workflows and the plugin to a tag instead of `main` once releases exist.
- Add team rules as new files in `.claude/rules/` with your own ID prefix, and remove or waive rules you do not want. See [layering and overrides](layering-and-overrides.md).
- Use CODEOWNERS on `.claude/` and `AGENTS.md` so instruction changes get review.

## Organization

- Publish an organization plugin (its own marketplace) for organization-specific skills, agents, and hooks.
- Use managed settings to register marketplaces and enable plugins for everyone (`extraKnownMarketplaces`, `enabledPlugins`), and `strictKnownMarketplaces` to restrict sources.
- Use `strictPluginOnlyCustomization` in managed settings when hooks, skills, and agents must come only from approved plugins.
- Distribute organization rules through a template repo or an installer skill, since plugins cannot ship rules.
