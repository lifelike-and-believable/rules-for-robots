# Maintenance

How the rule set is versioned, released, and kept current.

## Versioning

The rule set and the `rfr-core` plugin share one semantic version, set in `plugins/core/.claude-plugin/plugin.json`. `rfr-web`, `rfr-unreal`, `rfr-process`, and `rfr-feedback` each have their own version in their `plugin.json`, bumped the same way when their contents change. Claude Code uses that field to decide whether an installed plugin needs updating, so every change to rules, skills, agents, hooks, or the install-rules payload bumps it (R16).

| Change | Bump |
|---|---|
| A MUST rule added, or a rule made stricter so that a repo that passed before can now fail a hook or CI check | Major (minor before 1.0) |
| A rule, pack, skill, agent, or hook removed or renamed, or a rule ID reused | Major (minor before 1.0) |
| A SHOULD or MAY rule added, a new pack, skill, agent, or hook | Minor |
| Wording, sources, practice guides, template fixes, bug fixes in checks or hooks | Patch |

Rule IDs are never reused. A removed rule's ID stays retired so waivers and eval records keep pointing at one meaning.

## Releasing

A release is prepared in pull requests and published from a machine that can push tags.

1. In the pull request that changes a plugin, move the `[Unreleased]` entries in `CHANGELOG.md` under a new version heading with today's date, name the pull request, and set the same version in `plugins/core/.claude-plugin/plugin.json`. `npm run verify` fails if the changelog and plugin version disagree.
2. Merge. Several merged versions can go out as one release: its notes cover every version since the last tag.
3. On a machine with git and `gh` signed in (Windows, macOS, or Linux; a cloud agent session cannot push tags), fetch and prepare:

   ```
   git fetch origin --tags
   node checks/release.mjs prepare --commit <merge commit>
   ```

   `prepare` checks that the commit is on `origin/main`, that its plugin version has a changelog entry, and that no tag of that name exists, then writes the notes (every changelog section since the newest `rfr-v` tag) to a file and prints the commands. It changes nothing on the remote. Fetching is enough; there is no need to check out or pull `main`.
4. Check that CI passed on the commit (`gh run list --commit <sha> --workflow verify.yml`), and confirm with the maintainer before going on. A pushed tag and a published release are public and hard to take back.
5. Run the printed commands: an annotated tag `rfr-v<version>` on the commit, `git push origin rfr-v<version>`, and `gh release create rfr-v<version> --title rfr-v<version> --notes-file <file> --verify-tag`. Releases are titled with the tag name, and GitHub marks the newest as Latest.

`node checks/release.mjs notes [--since <version>] [--to <version>]` prints the notes without the checks. `/rfr-core:release` can drive these steps; it stops for confirmation before tagging. An agent session on the maintainer's computer can run steps 3 to 5; an agent in the cloud can prepare everything up to step 2 and hand the commit to it.

## Review cycle

Each quarter, and whenever a new model generation ships:

- Re-run the eval suite (`node evals/run.mjs`) on the current models. Remove or rewrite rules that show no effect or a negative one, and record the run in the pull request (R38).
- Re-run the agent and skill smoke tests (`node evals/agents/smoke.mjs`).
- Check framework and engine versions against the packs: Next.js, Astro, Node LTS, Postgres, TypeScript, and the Unreal versions Fab builds by default. When Epic's default three-version set moves, update `unreal-tier2.yml` and the `unreal-plugin` template.
- Re-read the sources behind MUST rules for changes. Lightly repeat the Phase 0 research for anything that moved.
- Review open waivers in the reference projects; a waiver older than two review cycles should become a rule change or be removed.

## Adopting repos

Adopting repos update with `/plugin update rfr-core@rules-for-robots` (and `rfr-web` or `rfr-unreal` if they use it), then `/rfr-core:install-rules <profile>` to refresh `.claude/rules/`. The skill keeps waivers and asks before replacing files you changed; see [layering-and-overrides.md](layering-and-overrides.md).
