---
name: security-audit
description: Audit a repository or change for security and privacy problems, including secrets, injection, authorization, dependencies, CI exposure, and agent tooling risks. Use when the user asks for a security review or audit beyond a single diff.
argument-hint: "[path or scope]"
---

# Security audit

1. **Map entry points**: HTTP routes, server actions, CLI arguments, file parsers, replicated RPCs, webhooks, and anything that reads tool or web content.
2. **Run the scanners the project has**, or report their absence: secret scanning (gitleaks), static analysis (Semgrep or CodeQL), and `npm audit` or the platform equivalent.
3. **Delegate the deep read** to the `security-reviewer` agent, scoped to the riskiest entry points first.
4. **Check the agent setup too**: hooks guarding destructive commands, permissions for MCP servers (especially the Vercel MCP), CI workflows that run on self-hosted runners or with secrets, and whether Claude runs in CI with `--bare` and never on fork PRs.
5. **Report** findings by severity with the attack scenario and fix, then a short list of missing controls. Do not change code unless the user asks.
