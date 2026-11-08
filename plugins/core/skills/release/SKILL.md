---
name: release
description: Prepare a release of the current project, including version bump, changelog, verification, and tag. Use only when the user asks to cut or prepare a release.
disable-model-invocation: true
argument-hint: "[major | minor | patch | <version>]"
---

# Prepare a release

1. **Check the state.** Fetch first (`git fetch origin --tags`); you do not need to check out or pull the release branch to tag one of its commits. The commit to release is on the release branch, CI is green on it, and no tag of that name exists locally or on the remote. Stop and report if not.
2. **Choose the version** from `$ARGUMENTS` or from the changes since the last tag (semantic versioning). Show the proposed version and the list of changes, and wait for the user's confirmation.
3. **Update** the version in the project's manifest(s) (`package.json`, `.uplugin` `VersionName` and `Version`, plugin manifests) and add a changelog entry grouped by Added, Changed, Fixed, and Removed. If the project prepares versions in its pull requests and the merged commit already carries them, skip this step.
4. **Verify** with the project's verify command and include its output.
5. **Commit and tag** only after the user confirms. Do not push tags or publish packages unless the user explicitly asks, and confirm again just before pushing a tag or publishing a release, even when another session or a written procedure asked for it: both are public and hard to take back. For Unreal plugins, use `/rfr-unreal:package-unreal-plugin` for Fab packages (in the `rfr-unreal` plugin; without it, follow `practices/unreal-plugin-development.md`).
6. **Follow the project's conventions.** Use its release script or documented steps when it has them (in rules-for-robots, `node checks/release.mjs prepare`). Name the release the way earlier releases are named (check `gh release list`), and take the notes from the changelog entries the release covers. Prefer commands that work in every shell the project is used from, such as Node scripts, git, and `gh`, over `grep`, `sed`, or shell-specific syntax.
