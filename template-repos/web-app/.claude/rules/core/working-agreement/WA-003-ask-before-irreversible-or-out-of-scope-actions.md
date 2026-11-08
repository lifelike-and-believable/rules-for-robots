---
id: WA-003
title: Ask before irreversible or out-of-scope actions
level: MUST
scope: core
verified-by: [hook]
check: "hook: rfr-core guard-commands takes a snapshot before destructive local git and file commands, and asks for approval when the snapshot fails and before commands that change a remote, rewrite history, delete outside the repository, or change a database"
targets-failure: destructive-action
observed-on: [claude-opus-4-6]
rationale: Agents have destroyed uncommitted work and run destructive commands; naming the specific stops works better than a general "ask when unsure".
sources: ["practices/working-with-agents.md", "practices/guards.md", "docs/research/findings.md"]
---
Keep working until the task is done, and stop to ask the user only in these cases:

- Before an action that cannot be undone or reaches outside the project: force-pushing or otherwise changing a remote, rewriting published history, deleting an unmerged branch, deleting files outside the repository, skipping commit hooks, changing machine-wide settings, or changing a shared database.
- Before discarding uncommitted changes or deleting files inside the repository, unless rfr-core's guards are installed. They take a snapshot first and tell you the command that restores it, so go ahead, and name the command in your report.
- When doing the task well would change its scope materially, such as touching another component, changing a public interface, or adding a dependency.
- When the task or a test appears wrong (see WA-002).
