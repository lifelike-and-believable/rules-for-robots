# <Project name>

Started from the rules-for-robots `general` template, for a project that is neither a website nor an Unreal plugin: a command-line tool, an MCP server, a service, or a desktop, mobile, or TV app. It carries the core rules and enables `rfr-core` only.

## Remaining steps

1. Fill in `AGENTS.md`: the one command that builds, lints, and tests (the verify command), the language and version, and anything outside the repository the project touches (a device, a service, a shared database) with when an agent must ask before changing it.
2. Add allow rules for the verify command to `.claude/settings.json` (`"Bash(<command> *)"`), so routine checks run without a prompt.
3. Add a CI workflow that runs the verify command on every pull request. `.github/workflows/guards.yml` already runs the test change guard.
4. To use the development process, run `/rfr-process:setup general` after installing `rfr-process`. Its tutorials are `runner: manual` until a runner exists for your kind of product.

5. If this kind of project would gain from a profile of its own (its own templates, a tutorial runner, a guard for something it touches outside the repository), suggest one with `/rfr-feedback:report-feedback`, area `profiles`: what the project is, what it had to borrow or do without, and why a profile would help.

Replace this file with the project's own README.
