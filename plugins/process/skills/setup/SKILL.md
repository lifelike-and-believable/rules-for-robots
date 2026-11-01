---
name: setup
description: Set up the rfr-process development process in this repository - process.yml, the CI workflow, artifact folders, and the persona starters and templates for the project type. Use only when the user asks to set up or adopt the process.
disable-model-invocation: true
argument-hint: "[unreal-plugin | web-app | static-site] [solo | team]"
---

# Set up the process

The process is described in the rules-for-robots spec `docs/specs/project-process.md` and in `${CLAUDE_SKILL_DIR}/../../README.md`. Templates are in `${CLAUDE_SKILL_DIR}/../../templates/`.

1. **Choose the profile and mode.** Take them from `$ARGUMENTS`. Otherwise infer the profile from the repository (a `.uplugin` file: `unreal-plugin`; Astro: `static-site`; Next.js or another web app: `web-app`) and ask the user to confirm it, and ask whether approvals are `solo` (one person approves everything by merging) or `team` (approving reviews, with approvers per stage). Ask for the approvers' GitHub logins.
2. **Check what exists.** If `docs/product/process.yml` already exists, stop and show it; do not overwrite. If the repository already has code and documentation but no process artifacts, tell the user about `/rfr-process:bootstrap`, which drafts the first artifacts from what exists.
3. **Write the configuration.** Copy `templates/process.yml` to `docs/product/process.yml` and fill in `mode` and `default`. For a team, add a `stages` entry only where the user names a different approver.
4. **Add the workflow.** Copy `templates/workflows/rfr-process.yml` to `.github/workflows/rfr-process.yml`. Change `branches: [main]` if the default branch has another name.
5. **Add starters.** Copy `templates/artifacts/concept.md` to `docs/product/concept.md`, and the profile's persona starters from `templates/profiles/<profile>/personas/` to `docs/product/personas/`. Copy nothing else yet; the other templates are used when each artifact is written. Tell the user that the personas are starters to replace with what they know about their real users.
6. **Team mode only.** Run `node .rfr/checks/process-codeowners.mjs` from a checkout of rules-for-robots at `.rfr` (or give the user the command), and list the branch protection settings to turn on: require the `process / approvals` and `process / tier` checks.
7. **Labels.** Give the user the commands to create the labels `tier:trivial`, `tier:fix`, `tier:story`, and `tier:epic` (`gh label create tier:story --color 0E8A16`, and so on). Do not run them without asking.
8. **Check.** Run `node .rfr/checks/process-trace.mjs` if `.rfr` is available, and show the result. Drafts with no links are expected at this point.
9. **Stop.** List the files written and the next step: write the concept, then requirements and personas, each approved before the next builds on it. Point the user to `${CLAUDE_SKILL_DIR}/../../GUIDE.md` for how to write each artifact and what each review checks. Do not commit unless the user asks.
