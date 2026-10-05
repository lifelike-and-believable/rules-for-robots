---
name: release
description: Prepare a release of the current project, including version bump, changelog, verification, and tag. Use only when the user asks to cut or prepare a release.
disable-model-invocation: true
argument-hint: "[major | minor | patch | <version>]"
---

# Prepare a release

1. **Check the state.** The working tree is clean, the branch is the release branch, and CI is green on its head. Stop and report if not.
2. **Choose the version** from `$ARGUMENTS` or from the changes since the last tag (semantic versioning). Show the proposed version and the list of changes, and wait for the user's confirmation.
3. **Update** the version in the project's manifest(s) (`package.json`, `.uplugin` `VersionName` and `Version`, plugin manifests) and add a changelog entry grouped by Added, Changed, Fixed, and Removed.
4. **Verify** with the project's verify command and include its output.
5. **Commit and tag** only after the user confirms. Do not push tags or publish packages unless the user explicitly asks; for Unreal plugins, use `/rfr-core:package-unreal-plugin` for Fab packages.
