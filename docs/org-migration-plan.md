# Migration plan: from lifelike-and-believable to RulesForRobots

Written 2026-11-15, after the maintainer created the `RulesForRobots` organization on GitHub. Status: **proposed**. Nothing here is decided until the maintainer approves it; the decisions in section 6 each carry a recommended answer.

The aim, in the maintainer's words: a dedicated home for everything rfr, with anything outdated or obsolete cleaned up, and a structure that is straightforward and effective without unnecessary bloat, able to grow over time, and easy to use on large and small agentic and agent-assisted projects.

## 1. What is there today

| Area | State on 2026-11-15 | Size |
|---|---|---|
| Plugins | rfr-core 7.4.0, rfr-process 2.15.0 (unreleased), rfr-web 3.1.1, rfr-unreal 3.1.0, rfr-android 0.4.0, rfr-feedback 0.2.0, all in one marketplace | 1.7 MB |
| Rules | 12 core rules, 6 packs, rendered into 4 template repos | 300 KB + 936 KB generated |
| Evals | 52 cases, 14 candidates, results from 2026-10-05 on, a 2.5 MB snapshot of the repository from before 1.0 as a fixture | 7.9 MB |
| Examples | `examples/web-app`, `examples/unreal-plugin` (RfrCooldowns), `examples/unreal` (RfrSample, used by the Tier 1 checks) | 3.9 MB |
| Docs | Specs, research record, five finished or superseded plans, brand, the intro video's sources | 2.1 MB |
| Open work | #272 (8.0.0, draft, held for XR Studio In A Box validation), #274 (Phase 28 spec), #278 (intro video, draft). No open issues. | |
| Releases | `rfr-v7.4.0` latest; 8.0.0 prepared | |

### References to the old owner

`lifelike-and-believable/rules-for-robots` appears 130 times. The ones that do work, and so must change, are:

- `.github/workflows/rfr-*.yml`: the `uses:` example in each header and every `repository:` on a checkout (13 places). Adopters call these.
- `templates/repo-files/common/.claude/settings.json`: `extraKnownMarketplaces`, which every rendered template and `install-rules` writes into adopters.
- `templates/repo-files/*/.github/workflows/*.yml`: the `uses:` lines adopters get.
- Each plugin's `plugin.json` (`homepage`, `repository`) and the marketplace `owner`.
- `plugins/feedback`: files issues on this repository.
- `README.md` and `docs/adoption-guide.md`: the install line.
- Tests that assert the above (`test/process-workflow`, `process-deliver-on-merge`, `guards-label-trigger`).

The rest are records (`evals/results/`, `evals/fixtures/`, `CHANGELOG.md`, `docs/research/`), which keep the old name: they describe what happened where.

### Outside the repository

These are tied to the repository or the old organization and do not move on their own:

- The **Claude GitHub App** installation, which cloud sessions need to clone and push. It must be installed on `RulesForRobots`.
- The **`rfr-agent` GitHub App** (ID 5731039). It opens pull requests on adopters (XR Studio In A Box), which stay in `lifelike-and-believable`. If it is owned by the old organization, it can stay there or be transferred; its installations do not change either way.
- **Scheduled tasks and cloud environments** that name the repository: the daily feedback triage session, and any environment whose setup or allowed repositories list it.
- **Branch protection and rulesets.** Repository rules move with the repository; organization rulesets do not exist yet on `RulesForRobots`.
- **Adopters**: XR Studio In A Box, Kettlebird website, Open3DPuppet (each has `uses:` lines and the marketplace in `.claude/settings.json`), and the maintainer's local plugin install.

## 2. What is outdated or obsolete

Found by reading the repository on 2026-11-15. Each line is a proposed removal or rewrite; git keeps everything removed.

| Item | Why | Proposal |
|---|---|---|
| `README.md` status line | Says v5.8.0 and a delegated mode that 25e removed; says rfr-core's hooks "ask", which they no longer do | Rewrite (short: what it is, the two ways to adopt, the volumes) |
| `PLAN.md` (70 KB) | 27 phases of history; section 6's layout predates rfr-process and rfr-android; section 14 still lists 7.1.0 adoption and 19i-4 as urgent | Rewrite as a short roadmap of open work. Move the phase record to `docs/history/plan-phases-0-27.md` |
| `docs/improvement-brief.md`, `improvement-plan.md`, `improvement-plan-process.md`, `rewrite-plan.md`, `verify-inventory.md` | Finished or superseded plans | Move to `docs/history/` with a one-line status at the top of each. `check:plan` and links updated |
| `docs/specs/retired/` | Already retired | Move to `docs/history/specs/` with the plans, so there is one place for the past |
| `plugins/process/README.md` | Still describes `mode: solo | team` and delegated gates that 25e removed | Rewrite the affected sections |
| `evals/candidates/*-delegated.md` (3) | Test modes that no longer exist (handoff backlog) | Delete |
| Unrun eval phases 10c, 14b, 15e, Android 24c and 24d | Machinery with no result; the handoff asks whether they earn their place | Decide each: run within a stated budget, or delete the cases and mark the phase closed without evidence |
| `evals/fixtures/rfr-snapshot/` (2.5 MB) | A copy of this repository from before 1.0, used as a "large repo" fixture | Keep only if a live case uses it; otherwise delete |
| `examples/unreal-plugin/` and `examples/unreal/` | Two Unreal samples; only `RfrSample` is wired to CI | Keep one (RfrSample, with the CI wiring), fold anything the other shows into it |
| `.idea/` | Committed IDE state | Delete, add to `.gitignore` |
| `docs/video/` | Source files for one film; #278 adds a process for films | Moves with the Creation volume (section 3) |
| `docs/brand/` | Brand for every volume, not for this repository alone | Moves to the organization's `.github` repository |
| `CHANGELOG.md` (155 KB) | Correct, but long | Keep from 8.0.0 on; move earlier entries to `docs/history/CHANGELOG-1-7.md` |

## 3. Target structure

### Principle

Repositories are for people who maintain things; plugins are what users install. A user adds **one marketplace** and installs plugins from it, whatever repository each plugin lives in. So a new repository is earned by a different release cadence, a different set of maintainers, or a different kind of CI, and not by a new topic. Until then a volume is a set of plugins and rule packs inside an existing repository.

### The organization

```
RulesForRobots/
├── .github                  # Organization profile and defaults for every repository
│   ├── profile/README.md    #   The org's front page: the volumes, one install line
│   ├── brand/               #   Moved from docs/brand: marks, lockups, social previews, generator
│   ├── ISSUE_TEMPLATE/      #   Default feedback and bug forms for repositories without their own
│   ├── CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md
│   └── pull_request_template.md
├── rules-for-robots         # Transferred. The marketplace, Core, and Engineering
└── (rules-for-robots-creation, rules-for-robots-research: created when section 5's test is met)
```

### Inside `rules-for-robots`

The layout stays close to today's, with one boundary made explicit: **Core** is what every volume builds on, and must not depend on anything in Engineering.

```
rules-for-robots/
├── .claude-plugin/marketplace.json   # The one marketplace for every volume
├── plugins/
│   ├── core/          # Core: rfr-core (guards, reviewers, install-rules, review-pr)
│   ├── feedback/      # Core: rfr-feedback
│   ├── process/       # Engineering: rfr-process
│   ├── web/  unreal/  android/       # Engineering: domain plugins
├── rules/
│   ├── core/          # Domain-neutral: working agreement, security, documentation
│   └── packs/         # Engineering packs (testing moves here if it is software-specific)
├── practices/  templates/  template-repos/  build/  checks/  test/
├── evals/             # Cases, graders, current results
├── examples/          # web-app, unreal (one each)
└── docs/
    ├── specs/         # Current specs only
    ├── research/      # The Phase 0 record
    ├── history/       # Finished plans, retired specs, the phase record, the old changelog
    ├── handoff.md  adoption-guide.md  rule-format.md  contributing.md
```

`PLAN.md` becomes the roadmap: open work by volume, and the decisions in force. The `phase-<n>/<slice>` branch naming continues.

### Two ways in, for small and large projects

The adoption guide leads with the choice, so a small project is not handed the whole process:

| | Rules only | Full process |
|---|---|---|
| For | A script, a prototype, a solo or agent-assisted project | A product with users, several features, agents running unattended |
| Install | `rfr-core` plus a domain plugin, then `/rfr-core:install-rules <profile>` | The same, plus `rfr-process`, the `rfr-agent` App, and branch protection |
| You get | Rules, guards, reviewers | Staged packets, approvals in GitHub reviews, delivery runs, lasting tutorials |
| Moving up later | Install `rfr-process` and run its setup; nothing installed before changes | |

This is what exists today; the change is presenting it as two levels instead of one long guide.

## 4. Migration steps

One step per pull request where it changes files. Steps 1 to 3 change nothing in the repository.

1. **Trial on throwaway repositories** (the 25a lesson: try it first). Create a repository with a reusable workflow and a one-plugin marketplace under the maintainer's account, call it from a second repository, transfer the first to `RulesForRobots`, and record what still works through GitHub's redirect: `uses: <old>/…@main`, `actions/checkout` with `repository: <old>/…`, `/plugin marketplace add <old>/…`, a cloud session installing the plugin. GitHub documents redirects for web and git URLs, not for `uses:`; the trial settles it. Delete both afterwards. About 30 minutes.
2. **Set up the organization.** Done by the maintainer in Settings, with a checklist from this plan: two-factor required for members; base permission read; install the Claude GitHub App and, if needed, the `rfr-agent` App; an organization ruleset for `main` on every repository (pull request required, no force push, no deletion); default labels including `feedback`; the `.github` repository with the profile README and the brand. The social preview for each repository is uploaded in its Settings.
3. **Transfer `rules-for-robots`.** Settings, Danger zone, Transfer, to `RulesForRobots`, keeping the name. Issues, pull requests (#272, #274, #278), releases, tags, stars, and the repository's branch protection move with it, and GitHub redirects the old URL. Then: check branch protection and Actions secrets survived; point the daily triage scheduled task and any cloud environment at the new name; run `npm run verify` from a fresh cloud session to confirm the session can clone and push.
4. **Update the references** (one pull request). Replace the owner in the live files listed in section 1; leave records alone. Add a check to `npm run verify` that fails if `lifelike-and-believable/rules-for-robots` appears outside `evals/results/`, `evals/fixtures/`, `docs/research/`, `docs/history/`, and `CHANGELOG.md`, so the old name cannot creep back. Set the marketplace `owner` and `LICENSE` per decision D4. Bump every plugin's `version`, since each `plugin.json` changes. The marketplace keeps its name, `rules-for-robots`, so adopters' `enabledPlugins` entries (`rfr-core@rules-for-robots`) stay valid.
5. **Release it with 8.0.0.** Fold step 4 into the 8.0.0 release (rebase #272 on it) and add a section to `docs/migration-8.md`: change the owner in each `uses:` line and in `.claude/settings.json`, then `/plugin marketplace remove rules-for-robots` and `/plugin marketplace add RulesForRobots/rules-for-robots`. Adopters then make one change for both. If 8.0.0 stays held for long, release step 4 alone as 7.4.1 instead (decision D3).
6. **Move the adopters.** XR Studio In A Box through its own gate (a `Change: trivial` pull request), Kettlebird website and Open3DPuppet the same way, and the maintainer's local install. Check the `rfr-deliver` workflow on XR Studio In A Box still starts a run.
7. **Clean up** (section 2), one pull request each, after the transfer so none of them conflicts with step 4:
   a. Docs: `docs/history/`, plan files moved, `README.md` and `plugins/process/README.md` rewritten, `.idea/` removed.
   b. `PLAN.md` rewritten as the roadmap; the phase record moved.
   c. Evals: delegated candidates deleted, the unrun phases decided (D5), the snapshot fixture kept or deleted.
   d. Examples: one Unreal example.
   e. Brand and video moved out (to `.github` and, once it exists, the Creation repository).
8. **Make the Core boundary real.** Audit `plugins/core` and `rules/core` for anything software-specific (test rules, code reviewers that assume a codebase), move it to Engineering or make it neutral, and add a test that nothing under Core imports from Engineering. This is what lets Creation and Research build on Core.

Steps 1 to 6 take a day or two of elapsed time, most of it the maintainer's settings work and the adopters' gates. Step 7 is five small pull requests; step 8 is a spec and one or two slices.

## 5. Growing: when a volume gets its own repository

A volume (Creation, Research, or a later one) starts as a spec in this repository, then as plugins under `plugins/` listed in the one marketplace. It moves to `RulesForRobots/rules-for-robots-<volume>` when any of these is true:

- It has maintainers who are not this repository's maintainers.
- Its CI needs something this repository's CI should not carry (a GPU, an engine, a paid service).
- Its releases need to go out on a different schedule from Core's.

When it moves, its plugins stay in the one marketplace, listed with a GitHub source (`"source": {"source": "github", "repo": "RulesForRobots/rules-for-robots-<volume>"}`), so users still add one marketplace. It depends on Core through the marketplace and a pinned `rules-ref`, never by copying Core's files. The brand's "Adding a volume" steps give it a mark.

The first candidate is Creation: the content process trialled on the logo and the intro video (#278), whose checks are technical conformance and whose approvals lock each artifact before a costlier stage. It is software-independent, so it is also the first real test of the Core boundary in step 8.

## 6. Decisions for the maintainer

| | Question | Recommended | Alternative |
|---|---|---|---|
| D1 | How many repositories now? | Two: `rules-for-robots` (Core and Engineering) and `.github`. Creation and Research get repositories when section 5's test is met | Four now (`-core`, `-engineering`, `-creation`, `-research`), as the brand anticipated. Costs: cross-repository CI and versioning between Core and Engineering, which share guards, `checks/lib`, and the build today; two empty repositories |
| D2 | Name of the main repository | Keep `rules-for-robots`. It is the marketplace name and the install line, and a rename after a transfer is a second redirect to manage | Rename to `rules-for-robots-core` to match the brand |
| D3 | When does the reference change ship? | With 8.0.0, so adopters change once | As 7.4.1 straight after the transfer, if 8.0.0 is held for long |
| D4 | Owner named in `LICENSE` and the marketplace | The maintainer's call: Lifelike & Believable Animation Design stays the copyright holder of past work; "Rules for Robots contributors" for the marketplace owner is the common form | Keep Lifelike & Believable throughout |
| D5 | Unrun eval phases (10c, 14b, 15e, 24c, 24d) | Close them without evidence and delete their cases, unless the maintainer names one worth a budget; the rules they cover keep their current level | Run them under the D8 cap of $150 |
| D6 | Evals results and research record | Stay in `rules-for-robots`, as records | Move to an archive repository. It would hold 9 MB nobody edits; a third repository for it is bloat |

## 7. What is not in this plan

- A website or documentation site for the organization. The org profile README and the repository's guides cover it until there is a reader they do not serve.
- GitHub Discussions and Projects. Feedback comes as issues through `rfr-feedback`; adding a second channel splits it.
- Changes to the guards, the gate, or the process. The freeze from the rewrite plan still holds until 8.0.0.
