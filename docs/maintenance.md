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

1. In the pull request that changes a plugin, move the `[Unreleased]` entries in `CHANGELOG.md` under a new version heading with today's date, name the pull request, and set the same version in `plugins/core/.claude-plugin/plugin.json`. Add an `Evaluated on:` line naming the models of the newest model-release run in `evals/ledger.json` (for example `Evaluated on: claude-opus-5-5, claude-sonnet-5-5.`). Set the same version in the first `Status:` line of `PLAN.md`. `npm run verify` fails if the changelog, the plan, and the plugin version disagree, or if a release after 5.1.3 has no `Evaluated on:` line.
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

## New model

When Claude Code offers a model ID it did not offer before, or an alias (`opus`, `sonnet`, `haiku`) starts resolving to a new ID, open a [model-release issue](../.github/ISSUE_TEMPLATE/model-release.yml) and work through it within two weeks. The procedure and its reasons are in [docs/specs/model-adaptation.md](specs/model-adaptation.md).

1. Run the suite on the new model, at default effort and at each effort level the agents set in their frontmatter: `node evals/run.mjs --suite model-release --models <id> [--effort <level>]`. The suite holds 27 runs per model and stops at its $40 cap (`--max-cost` overrides it). Check the summary for runs whose reported model differs from the one requested.
2. Run the agent and skill smoke tests with the new model as the main session: `node evals/agents/smoke.mjs --model <id>`.
3. Add both results folders to the ledger: `node checks/model-ledger.mjs add evals/results/<folder>`.
4. Read the report against the previous generation: `node checks/model-ledger.mjs report <id> --since <previous id>`.
5. Decide, using the table below, and make each change in its own pull request with the run named in it. Add a column for the new generation to the table in `PLAN.md` section 5, and update decision 7 once the model has ledger entries.

| Ledger result on the new model | Default decision |
|---|---|
| A rule is `effective` | Keep it, and add the model to its `evaluated-on` field. |
| A rule is `negative` | Rewrite or remove it before the next release, and say which in the changelog. |
| A SHOULD or MAY rule is `no-effect` or `saturated` on the two newest generations | Move its advice to the practice guide it links to, and retire the rule ID (R38). |
| A MUST rule is `no-effect` or `saturated` | Keep the hook or CI check; consider moving the text to the practice guide. The guard decision log shows whether the hook still fires. |
| A target failure reappears in a `none`-arm control | Treat its rules as `effective` again, and add a harder case for it. |
| A case is `saturated` on every current model | Mark it in `evals/README.md`, keep it as a control, and add a harder variant before it counts as evidence. |
| An agent or skill smoke test fails | Pin that agent to the last model it passed on, with the reason in a comment, until it is fixed. |
| A Haiku or Sonnet agent passes where the plan gave it a larger model | Consider the cheaper model, with a smoke test as evidence (R21). |

A case joins the suite when it shows a rule effect on any model; record why in its `reason`.

## Review cycle

Each quarter:

- Re-run the model-release suite and smoke tests on the current models if Claude Code has changed since the last ledger run, and follow "New model" above for the results (R38).
- Check framework and engine versions against the packs: Next.js, Astro, Node LTS, Postgres, TypeScript, and the Unreal versions Fab builds by default. When Epic's default three-version set moves, update `unreal-tier2.yml` and the `unreal-plugin` template.
- Re-read the sources behind MUST rules for changes. Lightly repeat the Phase 0 research for anything that moved.
- Review open waivers in the reference projects; a waiver older than two review cycles should become a rule change or be removed.

## Adopting repos

Adopting repos update with `/plugin update rfr-core@rules-for-robots` (and `rfr-web` or `rfr-unreal` if they use it), then `/rfr-core:install-rules <profile>` to refresh `.claude/rules/`. The skill keeps waivers and asks before replacing files you changed; see [layering-and-overrides.md](layering-and-overrides.md).
