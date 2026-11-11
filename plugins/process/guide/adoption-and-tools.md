# Adoption and tools

Part of the [rfr-process guide](../GUIDE.md).

## Adopting on an existing project

Run `/rfr-process:setup`, then `/rfr-process:bootstrap`, which drafts the concept, requirements, and personas from the project's README, documentation, issues, code, and running product, and sets an adoption window. Keep existing planning documents where they are; they are evidence, and the code and running product win where they disagree. Once the process artifacts cover what an old document said, archive it or link it from the concept, so there is one source of intent. Until the window ends, artifacts with no links produce warnings instead of failures. Approve the product-level artifacts first, then write stories and documentation for new work as it comes. Existing features get user documentation and tutorials when they next change, or sooner if they matter most to users.

## Recommended tools

These fit the process without competing with it. Versions are the ones checked on 2026-11-01; pin exactly what you install, and update on purpose. The research behind each choice, and the tools considered and not recommended, are in the rules-for-robots note [third-party tools for the project process](../../../docs/research/notes/third_party_tools_for_process.md).

### Every profile

| Tool | Stage | Source and pin | Notes |
|---|---|---|---|
| `rfr-core` and `rfr-process` | All | This repository's marketplace | Installing `rfr-process` installs `rfr-core` as its dependency. |
| Context7 | Implementation | `context7@claude-plugins-official` (vendored in that repository) | Current library documentation for the agent. Its hosted service sees your queries; do not send confidential code to it. |

### `web-app` and `static-site`

| Tool | Stage | Source and pin | Notes |
|---|---|---|---|
| Playwright | Tutorials, regression tests | npm `playwright`, an exact version (the runner is tested with 1.63.0) | Runs `runner: web` tutorials. For an agent checking a page, prefer the Playwright CLI to the MCP server in long sessions (rule WEB-004). Some add-ons, such as `@axe-core/playwright`, depend on their own `playwright-core` instead of a peer, so pinning `playwright` still leaves two versions; add an npm `overrides` entry for `playwright-core` with the same version. |
| Starlight | User documentation | npm `@astrojs/starlight` (0.42.x when checked; still 0.x, so pin it) | Publishes `docs/user/` as an accessible static site; the files stay the source. |
| Figma MCP server | Design and UX | `figma@claude-plugins-official`, which pins it to a commit | Only if the project designs in Figma. A hosted service that reads your files, and it needs a paid seat for some features. |

| Stryker | Unit tests, implementation | npm `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`, exact versions (checked with 10.1.1) | Mutation testing: it changes the code in small ways and reports each change no test noticed. Locked tests can still be weak, and coverage does not show it. Copy `templates/profiles/<profile>/stryker.config.mjs` to the project root and set `mutation: true` in the workflow caller; the advisory `mutation` job runs on `tier:story` and `tier:epic` pull requests. Treat each surviving mutant as a test to strengthen or code no behaviour depends on; in the pilot, the first run's survivors led to two real defects. Point `mutate` at unit-tested code (the static-site template uses `src/lib/`), since Stryker does not run end-to-end tests. Installing Stryker can update other packages in the lock file; review that diff. The job's score also appears as a check annotation. Locally, after a commit that changes only tests, run `stryker run --force`: incremental mode reuses the earlier result and can report a mutant your new test already kills. |

### Every profile, in CI

The reusable workflow's advisory `docs-lint` job runs [Vale](https://vale.sh) 3.26.0 (installed and checked by SHA-256) on `docs/user/`, `docs/tutorials/`, and `docs/releases/`. Its RFR style carries the rules-for-robots writing rules: no emphatic capitals, no "it's not X, it's Y", few em dashes (one per paragraph passes; the second is flagged), and Canadian spellings. Its vocabulary is built on each run from the personas' names (the title up to its first comma, when that is a name) and the terms in `docs/product/glossary.md` (list items that start with a bold term, and headings), so Vale flags a term written with the wrong case. The alerts go to the job summary and never fail the build. To run it locally: `node .rfr/checks/ci/install-vale.mjs`, then `node .rfr/checks/process-vale.mjs . --out .vale-tmp` and run the printed config with `vale --config`.

### `unreal-plugin`

| Tool | Stage | Source and pin | Notes |
|---|---|---|---|
| Epic's Unreal Engine skills plugin | Design (editor UI), tutorials, demos | `unreal-engine-skills-for-claude-code@claude-plugins-official`, which pins it to a commit | Unreal 5.8 and later. Epic marks Unreal MCP experimental. Use it interactively only, never in CI, with one agent per editor (rule R34 in the rules-for-robots plan), and commit before a long session. See the security notes below. |
| Unreal automation and screenshot functional tests | Tutorials, regression tests | The engine's own test framework | `runner: unreal` tutorials are followed by automation tests. Screenshot functional tests and Movie Render Queue demo renders need a GPU runner; `examples/unreal` in rules-for-robots shows the pattern (a tutorial, the automation spec that follows it, a screenshot of its editor step with approved references per engine version, and a 72-frame demo render), and its Tier 2 workflow runs it. Set the screenshot test's error limits yourself: at Unreal's defaults (0.02 global, 0.1 local) a one-digit change in a text display still passed, and with zero per-pixel tolerance even an unchanged scene failed on render noise. Keep the Low tolerance, lower the limits to just above what an unchanged run measures, and plant a change once to check that it fails. |

## Installing third-party plugins and MCP servers safely

Plugins and MCP servers run with your permissions on your machine and in your CI. Treat each one like a dependency you are adding to the build.

1. **Install from a source you can trace.** Prefer this repository's marketplace and `claude-plugins-official`. Even there, the official README says: "Anthropic does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change." ([claude-plugins-official](https://github.com/anthropics/claude-plugins-official)) Install community collections one plugin at a time, never wholesale.
2. **Pin to a commit.** A marketplace source of type `github`, `url`, or `git-subdir` takes `ref` (a branch or tag) and `sha` (a full 40-character commit); when both are set, Claude Code checks out `sha`. ([plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference.md)) `claude-plugins-official` already pins its git-sourced third-party entries this way; plugins vendored inside that repository are pinned by the repository itself.
3. **Read before installing, and again before updating.** Read the plugin's `hooks/hooks.json` and the scripts it runs, its `.mcp.json`, and any agent or skill that asks for shell or network tools. On an update, read the diff between the old and new commit.
4. **Expect real attacks.** Snyk's study of public agent skills found that 36.82% (1,467) had at least one security flaw, and confirmed 76 malicious payloads built for credential theft, backdoors, and data exfiltration ([Snyk, February 2026](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)). In October 2026, a tampered copy of the Claude Code extension (versions 2.1.312 and 2.1.313) was served from Cursor's extension marketplace for a few hours and tried to open an SSH backdoor; the official npm package was not affected ([Microsoft Security, 30 October 2026](https://www.microsoft.com/en-us/security/blog/2026/10/30/inside-malicious-claude-code-branded-cursor-extension-persistent-ssh-backdoor/)). Install from the publisher's own channel.
5. **Know what an editor-control server can reach.** Epic's documentation says Unreal MCP has no authentication layer, accepts only local connections by default, and discovers Python toolsets from every installed plugin's `Content/Python/` folder at startup ([Unreal MCP in Unreal Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)). So any process on the machine can drive the editor while it runs, and installing an engine plugin can add tools the agent will use. Do not change the bind address, and review engine plugins as you would Claude Code plugins.
6. **Keep remote services' data in mind.** Hosted MCP servers (Figma, Context7, and others) see what you send them. Check a client's confidentiality terms before connecting their project.
