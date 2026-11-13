---
id: NODE-002
title: Treat the Vercel MCP server as a privileged credential
level: MUST
scope: pack:node-services
verified-by: [hook]
check: "hook: rfr-web guard-mcp refuses Vercel MCP tools that deploy to production, change settings or environment variables, decrypt, delete, or purchase; rfr-web guard-cli refuses the same through the Vercel CLI"
targets-failure: destructive-action
observed-on: []
rationale: The Vercel MCP server acts with the full access of the user's Vercel account, including deployments, secrets, deletions, and purchases.
sources: ["practices/postgres-on-vercel.md", "practices/guards.md", "docs/research/notes/web_followup.md"]
---
Use the Vercel MCP server and CLI freely to read deployments, logs, and project settings, and to make preview deployments. Never deploy to production, promote, roll back, change environment variables or protection settings, delete anything, buy anything, or read decrypted environment variable values; rfr-web refuses these. When the task needs one, report the preview URL, write what is needed and why in the pull request's `## Decisions` section, and carry on with the rest.
