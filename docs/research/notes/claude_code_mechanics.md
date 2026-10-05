# Claude Code mechanics for packaging rules, agents, and workflows

Research date: 2026-10-05. Primary sources: the official Claude Code docs at code.claude.com, fetched as raw markdown on 2026-10-05, and the official changelog page (generated from anthropics/claude-code CHANGELOG.md). The latest release at fetch time was **v2.1.289 (October 3, 2026)**. Changelog anchors: v1.0.0 = May 22, 2025; v2.0.0 = Sep 29, 2025; v2.1.0 = Jan 7, 2026. Evidence levels: **[official]** means official docs or changelog; **[inference]** means my own synthesis. Unless marked otherwise, every finding below is [official].

Main source URLs (all fetched 2026-10-05):
- Memory / CLAUDE.md / rules: https://code.claude.com/docs/en/memory
- Skills: https://code.claude.com/docs/en/skills
- Subagents: https://code.claude.com/docs/en/sub-agents
- Hooks reference: https://code.claude.com/docs/en/hooks
- Features overview (when to use what): https://code.claude.com/docs/en/features-overview
- Plugins: https://code.claude.com/docs/en/plugins (overview), https://code.claude.com/docs/en/plugins/components, https://code.claude.com/docs/en/plugins/manifest-reference, https://code.claude.com/docs/en/plugins/marketplace-reference, https://code.claude.com/docs/en/plugins/host-marketplace, https://code.claude.com/docs/en/plugins/loading
- Settings: https://code.claude.com/docs/en/settings, https://code.claude.com/docs/en/settings-reference, https://code.claude.com/docs/en/managed-settings
- Headless: https://code.claude.com/docs/en/headless; GitHub Actions: https://code.claude.com/docs/en/github-actions; Agent SDK: https://code.claude.com/docs/en/agent-sdk/overview
- Best practices: https://code.claude.com/docs/en/best-practices; Output styles: https://code.claude.com/docs/en/output-styles
- Changelog: https://code.claude.com/docs/en/changelog

---

## CLAUDE.md: locations, @imports, loading, CLAUDE.local.md, size

### Takeaway
CLAUDE.md is still the always-loaded, advisory instruction layer. Files from four scopes (managed, user, project, local) are concatenated rather than overriding each other, and nested subdirectory files load lazily. CLAUDE.local.md is still supported. Official guidance is under 200 lines per file. Since v2.1.277 (Sep 18, 2026), Claude Code also reads AGENTS.md natively when no CLAUDE.md exists.

### Cited Findings
- **Scopes, in load order:** managed policy (`/Library/Application Support/ClaudeCode/CLAUDE.md` on macOS, `/etc/claude-code/CLAUDE.md` on Linux/WSL, `C:\Program Files\ClaudeCode\CLAUDE.md` on Windows), user (`~/.claude/CLAUDE.md`), project (`./CLAUDE.md` or `./.claude/CLAUDE.md`), and local (`./CLAUDE.local.md`, "add to .gitignore"). — [Memory](https://code.claude.com/docs/en/memory)
- Managed CLAUDE.md content can also be inlined through the `claudeMd` key in managed settings. That key is honored only in managed/policy settings. Managed CLAUDE.md files "cannot be excluded". — [Memory](https://code.claude.com/docs/en/memory)
- **Loading:** CLAUDE.md and CLAUDE.local.md files in the cwd and every ancestor directory load at launch. Files in subdirectories load "on demand when Claude reads files in those directories". — [Memory](https://code.claude.com/docs/en/memory). In v2.1.288 (Oct 2, 2026), nested CLAUDE.md and path-scoped rules also started loading when Write or Edit touches a file; before that, only Read triggered them. — [Changelog](https://code.claude.com/docs/en/changelog)
- **Merge semantics:** "All discovered files are concatenated into context rather than overriding each other." Order runs from the filesystem root down to the cwd, and within each directory CLAUDE.local.md comes after CLAUDE.md. When instructions conflict, "Claude may pick one arbitrarily." — [Memory](https://code.claude.com/docs/en/memory)
- **Advisory, not enforced:** "Claude treats them as context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook." — [Memory](https://code.claude.com/docs/en/memory)
- **Size:** "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence." Imports "don't reduce its context cost, because imported files also load at launch." — [Memory](https://code.claude.com/docs/en/memory)
- **@imports:** `@path/to/file`, relative to the importing file, recursive up to **four hops**. Spaces in a path need backslash escapes, and quoted paths are not imported. Imports inside code spans and fences are skipped. The first time a project imports a file outside the working directory, the user sees an approval dialog; declining disables those imports. — [Memory](https://code.claude.com/docs/en/memory)
- Block-level HTML comments (`<!-- -->`) in CLAUDE.md are stripped before injection, which makes them a zero-cost place for maintainer notes. — [Memory](https://code.claude.com/docs/en/memory)
- **CLAUDE.local.md** is current and supported ("loads alongside CLAUDE.md and is treated the same way"). It only exists in the worktree where it was created. To share personal instructions across worktrees, import `@~/.claude/...` instead. — [Memory](https://code.claude.com/docs/en/memory)
- `claudeMdExcludes` (glob patterns against absolute paths; arrays merge across settings layers) skips other teams' CLAUDE.md files in monorepos. — [Memory](https://code.claude.com/docs/en/memory)
- **AGENTS.md** (v2.1.277+, Sep 18, 2026, extended to Bedrock/Vertex/Foundry in v2.1.281):
  - Default mode `claude-md-or-agents-md` reads AGENTS.md only when there is no CLAUDE.md, .claude/CLAUDE.md, or CLAUDE.local.md in the cwd or above.
  - The other modes are `claude-md-and-agents-md`, `claude-md`, and `managed-only`, set through `/config` or `pluginConfigs["agents-md@builtin"]`. That setting is ignored in project and local settings.
  - `AGENTS.local.md`, `AGENTS.override.md`, and `.agents/` are not read.
  - A CLAUDE.md containing `@AGENTS.md` is the portable pattern, and Claude Code never reads the file twice.
  - Sources: [Memory](https://code.claude.com/docs/en/memory); [Changelog](https://code.claude.com/docs/en/changelog)
- **Auto memory:** Claude writes typed notes (`user`, `feedback`, `project`, `reference`) to `~/.claude/projects/<project>/memory/`. It is on by default locally and loads the first 200 lines or 25KB every session. Disable it with `autoMemoryEnabled: false` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. — [Memory](https://code.claude.com/docs/en/memory)
- `/doctor prompt-audit` (v2.1.283, Sep 25, 2026) audits CLAUDE.md, rules, skills, agents, commands, and output styles. It flags stale paths and commands, contradictions, and "instructions written for older models". — [Memory](https://code.claude.com/docs/en/memory); [Changelog](https://code.claude.com/docs/en/changelog)
- `/init` generates a CLAUDE.md. With `CLAUDE_CODE_NEW_INIT=1` it runs a multi-phase flow that can also scaffold skills and hooks, and it migrates `.cursor/rules`, `.github/copilot-instructions.md`, `.windsurfrules`, and `.clinerules`. — [Memory](https://code.claude.com/docs/en/memory)

### Inferences
- [inference] A rule set that targets several tools (Claude, Codex, Cursor and others) should ship AGENTS.md as the canonical file plus a thin CLAUDE.md containing `@AGENTS.md` and any Claude-specific lines. That works on every Claude Code version, avoids the Windows symlink problem the docs call out, and survives a user adding CLAUDE.local.md, which would otherwise suppress native AGENTS.md reading.
- [inference] Because files concatenate and conflicts resolve arbitrarily, a layered rule system (org → team → project) should avoid contradicting itself across layers rather than rely on "later overrides earlier".

### Gaps
- No official token budget for CLAUDE.md beyond the "under 200 lines" guidance; the auto-memory limit is the only documented hard cap.

---

## Path-scoped rules (.claude/rules/)

### Takeaway
Path-scoped rules exist and are officially documented. They are markdown files under `.claude/rules/` (recursive), plus user-level `~/.claude/rules/`. A rule with no frontmatter loads at launch like CLAUDE.md. A rule with `paths:` globs loads lazily when Claude reads, edits, or writes a matching file. `paths` is the only frontmatter field Claude Code reads.

### Cited Findings
- `.claude/rules/*.md` is discovered recursively, so subfolders such as `frontend/` work. Rules without `paths` "are loaded at launch with the same priority as `.claude/CLAUDE.md`". — [Memory](https://code.claude.com/docs/en/memory)
- **Syntax:**
  ```yaml
  ---
  paths:
    - "src/api/**/*.ts"
  ---
  ```
  `paths` accepts a YAML list or a comma-separated string, and supports brace expansion (`src/**/*.{ts,tsx}`). Brace expansion is capped at 1,000 expanded patterns / 4 MiB per rule. — [Memory](https://code.claude.com/docs/en/memory)
- **Trigger:** "Path-scoped rules trigger when Claude uses the Read, Write, or Edit tool on a file matching the pattern, not on every tool use." Write/Edit triggering was fixed in v2.1.288 (Oct 2, 2026). — [Memory](https://code.claude.com/docs/en/memory); [Changelog](https://code.claude.com/docs/en/changelog)
- "`paths` is the only field Claude Code reads from a rule; any other field is ignored without an error." Invalid YAML makes the rule load unconditionally. — [Memory](https://code.claude.com/docs/en/memory)
- **User-level rules** in `~/.claude/rules/` load before project rules, and "Neither set overrides the other." — [Memory](https://code.claude.com/docs/en/memory)
- **Symlinks** are supported for sharing rules across projects. A symlink whose target is outside the project counts as an external import that needs approval, and even after approval only the rules without `paths` load. — [Memory](https://code.claude.com/docs/en/memory)
- An `InstructionsLoaded` hook fires when CLAUDE.md or rules load. Its `load_reason` field (`session_start`, `path_glob_match`, `nested_traversal`, `include`) can be used to observe or audit which rules loaded. — [Hooks](https://code.claude.com/docs/en/hooks)
- Skills also accept a `paths` field with the same glob format, which limits automatic activation to matching files. — [Skills](https://code.claude.com/docs/en/skills)

### Inferences
- [inference] Path-scoped rules are the best home for language- or directory-specific conventions such as "*.tsx rules" or "migrations/ rules". They cost nothing until a matching file is touched, and unlike skills they need no model decision to load.
- [inference] Glob-scoped Cursor `.mdc` rules map closely onto `.claude/rules/` with `paths:`. Cursor's `description`/`alwaysApply` fields are ignored by Claude Code.

### Gaps
- No documented way for a **plugin** to ship `.claude/rules/` (see the Plugins section).

---

## Skills (SKILL.md)

### Takeaway
A skill is a folder containing SKILL.md and optional supporting files. Only its name and description (capped at 1,536 characters) sit in context up front. The body loads when the skill is invoked, by the user typing `/name` or by Claude matching the description, and it then stays in context. Supporting files load only when Claude reads them, and scripts run without loading. Custom slash commands have been merged into skills, and skills follow the open Agent Skills standard (agentskills.io).

### Cited Findings
- "Custom commands have been merged into skills." `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`. Commands still work, but skills add supporting files, invocation control, and auto-loading. — [Skills](https://code.claude.com/docs/en/skills)
- **Locations and precedence:** enterprise (managed dir) > personal (`~/.claude/skills/`) > project (`.claude/skills/`). Nested `<subdir>/.claude/skills/` loads lazily. Plugin skills are namespaced `/plugin:skill`, so they never collide. A skill beats a same-named command file. — [Skills](https://code.claude.com/docs/en/skills)
- **Frontmatter (all optional; `description` recommended):** `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context` (`fork`), `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`. Unknown fields are silently ignored. — [Skills](https://code.claude.com/docs/en/skills)
- **Portability:** claude.ai uploads, the Skills API, and `package_skill.py` from anthropics/skills accept only `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`. Any other key is a hard error on those paths. Dynamic context injection (`` !`cmd` ``) works only in Claude Code. — [Skills](https://code.claude.com/docs/en/skills)
- **Progressive disclosure:**
  - Default: "Description always in context, full skill loads when invoked."
  - `disable-model-invocation: true`: description *not* in context; the user can still invoke it.
  - `user-invocable: false`: hidden from the `/` menu; Claude can still invoke it.
  - Source: [Skills](https://code.claude.com/docs/en/skills)
- **Listing budget:** the skill listing budget is 1% of the context window. When it overflows, descriptions of the least-used skills are dropped first. Tune it with `skillListingBudgetFraction` or `skillOverrides` (`on`/`name-only`/`user-invocable-only`/`off`). `skillOverrides` does not affect plugin skills, which are managed via `/plugin`. `/skill-doctor` (v2.1.261, Sep 4, 2026) reports the context cost and usage of each skill. — [Skills](https://code.claude.com/docs/en/skills); [Changelog](https://code.claude.com/docs/en/changelog)
- **Lifecycle:** once invoked, "the rendered SKILL.md content enters the conversation as a single message and stays there across later turns". The file is not re-read. After compaction, the most recent invocation of each skill is re-attached, capped at its first 5,000 tokens, with a 25,000-token combined budget. That is why "put the most important instructions near the top." — [Skills](https://code.claude.com/docs/en/skills)
- **Supporting files:** reference them from SKILL.md so Claude knows when to read them. Scripts are "executed, not loaded". "Keep SKILL.md under 500 lines." Use `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, and `${CLAUDE_PLUGIN_DATA}` to reference bundled files. Using the same variable inside an `allowed-tools` Bash rule lets a bundled script run without prompts. — [Skills](https://code.claude.com/docs/en/skills)
- `allowed-tools` pre-approves the listed tools only for the invoking turn and does not restrict the tool set. It is applied even in untrusted `-p` runs, so review repo skills for security. — [Skills](https://code.claude.com/docs/en/skills)
- **`context: fork`:**
  - The skill runs as the prompt of a fresh subagent (type set by `agent`) with no conversation history. Since v2.1.218 the fork runs in the background by default; set `background: false` to block.
  - "only makes sense for skills with explicit instructions". Guideline-only content returns nothing useful.
  - Source: [Skills](https://code.claude.com/docs/en/skills)
- **Descriptions:** put the key use case first. Include the keywords users naturally say. If a skill triggers too often, make the description more specific or set `disable-model-invocation`. `claude plugin eval` (v2.1.269, Sep 11, 2026) with a `tool_used: Skill` grader measures how often a skill triggers. — [Skills](https://code.claude.com/docs/en/skills); [Changelog](https://code.claude.com/docs/en/changelog)
- If Claude stops following a skill: rules that must always hold belong in a hook, which can be declared in the skill's `hooks` frontmatter and then stays active for the rest of the session. Judgment guidance should be worded as a standing instruction. — [Skills](https://code.claude.com/docs/en/skills)
- Skill bodies should be concise because "every line is a recurring token cost" once loaded. — [Skills](https://code.claude.com/docs/en/skills)

### Inferences
- [inference] Skills are the right package for procedures (release, review, migration playbooks) and for large reference material. Use `disable-model-invocation` for anything with side effects, and `user-invocable: false` for background knowledge.
- [inference] For cross-tool distribution (claude.ai, API, other Agent-Skills tools), keep frontmatter to the six spec fields and put Claude Code-only behaviour in plugin hooks or agents.

### Gaps
- I did not fetch the anthropic.com engineering post "Equipping agents for the real world with Agent Skills" or the anthropics/skills repo in this pass. The Claude Code docs above are authoritative for behaviour.

---

## Sub-agents (.claude/agents/*.md)

### Takeaway
A subagent is a markdown file whose frontmatter configures it and whose body is the system prompt. It runs in a fresh, isolated context, sees CLAUDE.md but not the conversation, and returns a summary. Claude delegates based on `description`, or the user can force delegation with an @-mention or `--agent`. Subagents run in parallel and in the background, and since mid-2026 they can spawn nested subagents (default depth 3, 20 concurrent).

### Cited Findings
- **Scope priority:** managed settings (1) > `--agents` CLI JSON (2) > `.claude/agents/` (3, discovered walking up from the cwd; the closest wins) > `~/.claude/agents/` (4) > plugin `agents/` (5, lowest). — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Frontmatter:**
  - Required: `name` (no `:`) and `description`.
  - Optional: `tools`, `disallowedTools`, `model` (`sonnet`/`opus`/`haiku`/`fable`/full ID/`inherit`), `permissionMode`, `maxTurns`, `skills` (full content preloaded), `mcpServers`, `hooks`, `memory` (`user`/`project`/`local`), `background`, `omitClaudeMd` (v2.1.271+), `effort`, `isolation: worktree`, `color`, `initialPrompt`, `experimental.cacheTtl`.
  - Fields use camelCase. Unknown fields are silently ignored.
  - Source: [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Plugin agents** ignore `permissionMode`, `hooks`, `mcpServers`, and `initialPrompt`. Those must be added as plugin-level hooks or MCP servers instead. — [Plugin components](https://code.claude.com/docs/en/plugins/components)
- **Context:**
  - The body becomes the system prompt. Subagents "receive only this system prompt plus basic environment details … not the Claude Code system prompt."
  - Initial context = system prompt + Claude's delegation message + the full CLAUDE.md hierarchy + git status + preloaded skills.
  - Built-in Explore and Plan skip CLAUDE.md and git status.
  - Output style and the main session's auto memory don't reach subagents.
  - Sources: [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- Description cost: a startup warning appears when the combined custom subagent descriptions exceed 15,000 tokens. Adding "use proactively" to a description encourages auto-delegation. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Model resolution order:** per-invocation `model` param > frontmatter `model` > `CLAUDE_CODE_SUBAGENT_MODEL` > main model. Before v2.1.251 the environment variable took precedence. The org `availableModels` allowlist is enforced. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Nesting:**
  - Default is up to **three layers** below main (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; `1` disables nesting).
  - History: v2.1.172–2.1.216 allowed nesting 5 deep; v2.1.217–218 defaulted to 1; v2.1.219 (Jul 24, 2026) set the default to 3.
  - To stop one agent from spawning, omit `Agent` from its `tools`.
  - Source: [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Concurrency:** by default the Agent tool fails at 20 running subagents (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, v2.1.217+). There is no cap on the session total. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Foreground/background:** in interactive sessions "fork mode" is on by default, and spawned subagents run in the background. In `-p` and the SDK fork mode is off. Background subagents get a narrower tool set. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Forks** (a subagent that inherits the full conversation) are distinct from `context: fork` skills. A fork can't spawn further forks. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- Hooks configured in settings and plugins also fire inside subagents, with `agent_id` and `agent_type` in their input. Frontmatter hooks on a subagent are active only while it runs, and `Stop` becomes `SubagentStop`. — [Hooks](https://code.claude.com/docs/en/hooks)
- **When to use a subagent:** verbose output, tool restrictions, or self-contained work. Use the main conversation for iterative or latency-sensitive work. Beyond a handful of subagents, use **dynamic workflows** (a script Claude writes that runs many subagents) or **agent teams**. — [Sub-agents](https://code.claude.com/docs/en/sub-agents); [Features overview](https://code.claude.com/docs/en/features-overview)

### Inferences
- [inference] Read-only reviewer/verifier subagents (`tools: Read, Grep, Glob`, no `Agent`) are the cleanest way to ship an "adversarial review" step, which matches the best-practices doc.
- [inference] Because plugin agents can't carry hooks, MCP servers, or permissionMode, any enforcement tied to an agent must live in the plugin's `hooks/hooks.json`, filtered on `agent_type`.

### Gaps
- No official guidance on optimal subagent count or cost multipliers beyond "subagents count toward the same usage limits".

---

## Hooks: events, enforcement, exit codes, JSON

### Takeaway
Hooks are the deterministic enforcement layer. They are configured in settings JSON, plugin `hooks/hooks.json`, or skill/agent frontmatter, and come in five handler types (command, http, mcp_tool, prompt, agent) across about 30 events. Enforcement uses **exit 2** or JSON decisions. Exit 1 does *not* block.

### Cited Findings
- **Events:** SessionStart, Setup, InstructionsLoaded, UserPromptSubmit, UserPromptExpansion, MessageDisplay, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, PostToolBatch, PermissionDenied, Notification, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, PreModelSwitch, PostModelSwitch, SessionEnd, Elicitation, ElicitationResult. — [Hooks](https://code.claude.com/docs/en/hooks)
- **Locations:** `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, managed policy, plugin `hooks/hooks.json`, skill frontmatter (active for the rest of the session once invoked; `once: true` supported), and subagent frontmatter (active while it runs). Hooks **merge** across levels. `allowManagedHooksOnly` blocks user, project, local, and plugin hooks, except plugins force-enabled by managed settings. — [Hooks](https://code.claude.com/docs/en/hooks)
- **Matchers:** an exact name or a `|`/`,` list (e.g. `Edit|Write`). Any other character makes the matcher an unanchored JS regex. The `if` field takes a single permission-rule pattern such as `"Bash(git *)"` or `"Edit(*.ts)"` to narrow tool events. — [Hooks](https://code.claude.com/docs/en/hooks)
- **Exit codes:**
  - 0 = success. Stdout is parsed as JSON if it is wrapped in `{}`. For UserPromptSubmit, UserPromptExpansion, SessionStart, and PostModelSwitch, plain stdout is added to Claude's context.
  - **2 = block**, and not even JSON `"allow"` can override it.
  - Other codes = non-blocking error. The docs warn: "If your hook is meant to enforce a policy, use `exit 2`."
  - Source: [Hooks](https://code.claude.com/docs/en/hooks)
- **What exit 2 does per event:**
  - PreToolUse: blocks the tool call.
  - UserPromptSubmit: rejects the prompt.
  - Stop / SubagentStop: prevents stopping, so Claude continues.
  - PostToolUse: shows stderr to Claude (the tool already ran).
  - PreCompact: blocks compaction.
  - PermissionRequest: exit 2 is not honored; use a JSON decision instead.
  - Source: [Hooks](https://code.claude.com/docs/en/hooks)
- **JSON output:**
  - Universal fields: `continue`, `systemMessage`, and others. Some events take a top-level `decision`/`reason`.
  - `hookSpecificOutput` (with `hookEventName`) carries `permissionDecision` (allow/deny/ask/defer for PreToolUse), `updatedInput`, and `additionalContext`.
  - Each string is capped at 10,000 characters; longer output is spilled to a file and only a preview is shown.
  - Source: [Hooks](https://code.claude.com/docs/en/hooks)
- **Timeouts:** the default is 600s for command, http, and mcp_tool handlers, 30s for prompt, and 60s for agent. A timed-out PreToolUse command hook does *not* block: "don't count on a stalled hook to act as a gate." — [Hooks](https://code.claude.com/docs/en/hooks)
- PreToolUse does not fire for `@`-referenced files; use `Read` deny rules for those. — [Hooks](https://code.claude.com/docs/en/hooks)
- **Workspace trust:** project subagent frontmatter hooks need the trust dialog accepted. Project skill hooks and `-p` runs execute even in untrusted folders. — [Hooks](https://code.claude.com/docs/en/hooks); [Headless](https://code.claude.com/docs/en/headless)
- **Hook vs skill:** "Put guardrails in hooks. An instruction like 'never edit .env' in CLAUDE.md or a skill is a request, not a guarantee." Hooks cost "Zero [context] unless the hook returns output". — [Features overview](https://code.claude.com/docs/en/features-overview)
- **Enforcement recipes from the docs:** a PreToolUse Bash hook that exits 2 on `rm` (or returns a `permissionDecision: "deny"` for `rm -rf`), a PostToolUse `Write|Edit` formatter (`${CLAUDE_PLUGIN_ROOT}/scripts/format.sh`), "block edits to protected files", and an async hook that runs tests after file changes. — [Hooks](https://code.claude.com/docs/en/hooks); [Plugin components](https://code.claude.com/docs/en/plugins/components)

### Inferences
- [inference] Mapping of enforcement goals to hooks:
  - Formatting: PostToolUse `Edit|Write` → formatter, exit 0.
  - Lint feedback: PostToolUse with exit 2 or `additionalContext`, so Claude sees the errors.
  - Dangerous commands: PreToolUse `Bash` → exit 2.
  - Preventing test edits: PreToolUse `Edit|Write` with `if: "Edit(tests/**)"`, or a path check in the script → deny.
  - "Don't stop until tests pass": a Stop hook that exits 2 when the test suite fails. Guard against infinite loops by checking `stop_hook_active`.
  - Injecting dynamic rules: a SessionStart hook whose stdout or `additionalContext` adds them.

### Gaps
- I didn't read the per-event input schemas in full (e.g. the exact `stop_hook_active` semantics). The hooks reference page has them.

---

## Plugins and marketplaces

### Takeaway
A plugin is a directory with an optional `.claude-plugin/plugin.json` (only `name` is required) that can bundle skills, legacy commands, agents, `hooks/hooks.json`, MCP servers, LSP servers, `bin/` executables, output styles, themes, monitors, channels, and a default `settings.json` (only the `agent` and `subagentStatusLine` keys). **A plugin cannot ship CLAUDE.md or `.claude/rules/`.** Marketplaces are `.claude-plugin/marketplace.json` catalogs. Teams and orgs distribute them through `extraKnownMarketplaces`, `enabledPlugins`, and managed `strictKnownMarketplaces`.

### Cited Findings
- **CLAUDE.md is not loaded from plugins:** "To include instructions in a plugin, write them as a skill. Claude Code doesn't load a `CLAUDE.md` at the plugin root, and `claude plugin validate` warns." Rules that must always hold should be hooks. — [Plugin components](https://code.claude.com/docs/en/plugins/components)
- **Component list:**
  - Skills (`skills/<name>/SKILL.md` → `/plugin:name`), commands (legacy), agents, hooks (`hooks/hooks.json`, same shape as settings), MCP servers (tool names `mcp__plugin_<plugin>_<server>__<tool>`), LSP servers.
  - `bin/`, which is added to the Bash PATH after the user's PATH, so it can't shadow system commands. claude.ai and Cowork refuse plugins that have a top-level `bin/`.
  - Default `settings.json` (`agent`, `subagentStatusLine` only), themes, output styles (`output-styles/*.md`), monitors, channels.
  - Source: [Plugin components](https://code.claude.com/docs/en/plugins/components)
- **plugin.json:** `name` is required. `version` is "not checked against semver" and "pins the plugin to that version until you change it". `dependencies` can list other plugins. `userConfig` defines prompts shown to the user. `claude plugin validate [--strict]` checks a plugin. — [Manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference)
- **Version computation:** the manifest `version` wins, then the marketplace entry's `version`, then a source-derived value (a 12-character git SHA for github/url/git-subdir, the sha256 for an archive, `unknown` for npm or a local non-git source). If `version` is unchanged, `claude plugin update` won't pick up new commits. — [Plugin loading](https://code.claude.com/docs/en/plugins/loading)
- **marketplace.json:**
  - Lives at `.claude-plugin/marketplace.json`.
  - Required top-level fields: `name`, `owner`, `plugins`. Optional: `metadata.pluginRoot`, `forceRemoveDeletedPlugins`, `renames`, `allowCrossMarketplaceDependenciesOn`.
  - Plugin entries take `name`, `source`, `version`, `category`, `tags`, `strict` (default true), `dependencies`, `defaultEnabled`, `relevance`, `displayName`, and more.
  - Reserved names include `claude-plugins-official`, `anthropic-*`, and `npm`/`github`, and names that impersonate official marketplaces are rejected.
  - Source: [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- **Install and dev:** load locally with `--plugin-dir` while developing. Users install from a marketplace via `/plugin`. At project scope, plugins are "enabled for everyone who works in this repository, through the committed `.claude/settings.json`", and each collaborator still installs locally. — [Plugins](https://code.claude.com/docs/en/plugins)
- **Org distribution:**
  - Admins register marketplaces and turn plugins on for everyone with managed `extraKnownMarketplaces` + `enabledPlugins`, plus an `autoUpdate` policy.
  - `strictKnownMarketplaces` and `blockedMarketplaces` restrict sources.
  - `strictPluginOnlyCustomization` (managed) "Block[s] skills, agents, hooks, and MCP servers from user and project sources, so they can come only from plugins or managed settings."
  - Sources: [Host marketplace](https://code.claude.com/docs/en/plugins/host-marketplace); [Settings reference](https://code.claude.com/docs/en/settings-reference)
- `claude plugin eval` (v2.1.269) runs a plugin's eval suite with and without the plugin. It measures skill triggering and subagent delegation and produces a JSON + HTML report. — [Changelog](https://code.claude.com/docs/en/changelog); [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- A skill folder that contains `.claude-plugin/plugin.json` loads as a plugin `<name>@skills-dir`, so it can bundle agents, hooks, and MCP servers. — [Skills](https://code.claude.com/docs/en/skills)

### Inferences
- [inference] **The key packaging constraint for a "rules" product:** always-on rules and path-scoped rules cannot be delivered by a plugin. Options:
  1. A GitHub template repo that contains CLAUDE.md/AGENTS.md and `.claude/rules/`.
  2. A plugin skill (e.g. `/rules:install`) that copies rule files into the repo or `~/.claude/rules/`.
  3. A plugin SessionStart hook that emits rules as `additionalContext`. This costs context every session and is capped at 10k characters per string.
  4. Skills with `paths:` frontmatter as a lazy approximation of path rules.

  Combining a template repo for rules with a plugin for skills, agents, and hooks matches the docs' division of responsibilities.
- [inference] Pin `version` in plugin.json and bump it per release. Otherwise every commit is a new version (SHA), which is noisy for teams.

### Gaps
- I did not verify the exact current `/plugin marketplace add` CLI syntax in this pass. It is in https://code.claude.com/docs/en/plugins/install.

---

## Settings precedence, permissions, output styles, slash commands vs skills

### Takeaway
Precedence is **managed > CLI args (`--settings` and flags) > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`**. List keys such as `permissions.allow`/`deny` merge across levels. Output styles change the system-prompt style for the whole session. Slash commands are now just skills.

### Cited Findings
- The precedence order is quoted above. Nothing overrides managed settings. Environment variables are not a level; precedence is decided per variable/key pair. A few security keys honor a stricter lower-level value. — [Settings](https://code.claude.com/docs/en/settings)
- "When you set the same list key, such as `permissions.allow`, in more than one file, Claude Code combines the lists." Exceptions: `fallbackModel`, `modelPicker`, `availableModels`, `modelSettings`. — [Settings](https://code.claude.com/docs/en/settings)
- **Managed delivery:** a `managed-settings.json` file, MDM, or server-managed settings from the claude.ai admin console (fetched at startup, polled hourly). Cloud sessions use server-managed settings only. — [Managed settings](https://code.claude.com/docs/en/managed-settings)
- **Use settings for enforcement and CLAUDE.md for behaviour:** `permissions.deny`, `sandbox.enabled`, and `env` belong in managed settings; style and compliance reminders belong in managed CLAUDE.md. — [Memory](https://code.claude.com/docs/en/memory)
- **Output styles:**
  - Four built-in styles besides Default: Proactive, Concise, Explanatory, Learning. Custom styles are markdown with `name`/`description` frontmatter, and plugins can ship them as `<plugin>:<name>`.
  - One style is active at a time. "It doesn't guarantee that something always happens".
  - Subagents don't inherit the output style (forks do).
  - Sources: [Output styles](https://code.claude.com/docs/en/output-styles); [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **Slash commands vs skills:** they are merged. `.claude/commands/*.md` is "the older format and still works", supports the same frontmatter except `name`/`paths`, and should be replaced by skills for new work. — [Skills](https://code.claude.com/docs/en/skills)

### Inferences
- [inference] For team templates: commit `.claude/settings.json` with `permissions` deny rules, hooks, `enabledPlugins`, and `extraKnownMarketplaces`, and leave `.claude/settings.local.json` for personal overrides.

### Gaps
- I did not catalogue the full permission rule syntax (see https://code.claude.com/docs/en/permissions).

---

## Headless/CI: claude -p, GitHub Action, Agent SDK

### Takeaway
`claude -p` runs non-interactively, with `--output-format json|stream-json` and `--json-schema`, and `--bare` is recommended for reproducible CI. `anthropics/claude-code-action@v1` runs Claude Code in GitHub workflows and can install plugins from marketplaces. The Agent SDK (Python/TS) embeds the same loop and loads `.claude/` skills, commands, memory, and plugins.

### Cited Findings
- `-p` with `--allowedTools`, `--permission-mode` (`auto`/`dontAsk`/`acceptEdits`), `--permission-prompts none` for unattended runs, `--output-format json` (the result is in `result`), and `--json-schema` (output in `structured_output`). — [Headless](https://code.claude.com/docs/en/headless)
- **`--bare`** skips discovery of hooks, skills, commands, subagents, plugins, MCP servers, auto memory, and CLAUDE.md. It needs `ANTHROPIC_API_KEY` and "will become the default for `-p` in a future release." Without `--bare`, `-p` runs the project's hooks and `.mcp.json` "even in a folder you've never trusted". — [Headless](https://code.claude.com/docs/en/headless)
- **GitHub Action:**
  - `anthropics/claude-code-action@v1`, in interactive mode (`@claude` trigger) or automation mode (`prompt`).
  - Inputs: `prompt`, `claude_args`, `anthropic_api_key`/`claude_code_oauth_token`, `github_token`, `plugin_marketplaces`, `plugins`, `settings`, `trigger_phrase`, `use_bedrock`/`use_vertex`/`use_foundry`.
  - Example: `plugins: "code-review@claude-code-plugins"` with `prompt: "/code-review:code-review --comment ..."`.
  - "Define project standards in CLAUDE.md": the action follows it.
  - Source: [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- **Agent SDK:** "A library that runs the Claude Code binary". It supports tools, hooks, subagents, MCP, permissions, and sessions, loads skills, commands, and memory "from your project's `.claude/` and from `~/.claude/`", and loads plugins by local path. In the SDK and `-p`, forked skills block and fork mode is off. — [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview); [Skills](https://code.claude.com/docs/en/skills)
- `--append-subagent-system-prompt[-file]` (v2.1.205 and v2.1.261) appends text to every subagent's prompt in non-interactive mode. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)

### Inferences
- [inference] A template repo can ship `.github/workflows/claude.yml` that installs the project's own plugin via `plugin_marketplaces` + `plugins`, so CI review uses the same agents and skills as local development.

### Gaps
- I didn't read the claude-code-action repo docs (usage.md, security.md) directly.

---

## 2026 changes relevant to this project (changelog)

### Takeaway
2026 (v2.1.0 on Jan 7 through v2.1.289 on Oct 3) brought: nested subagents, background-by-default forks, skill/command unification refinements, `claude plugin eval`, `/skill-doctor`, native AGENTS.md, `/doctor prompt-audit`, dynamic workflows, agent teams, and rule-loading fixes.

### Cited Findings (all from [Changelog](https://code.claude.com/docs/en/changelog) unless noted)
- v2.1.172 (Jun 10, 2026): nested subagents (5 deep). v2.1.217–219 (Jul 2026): configurable depth, default 3, plus the 20-concurrent limit. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- v2.1.218 (Jul 22, 2026): `context: fork` skills background by default (`background` field); booleans accept yes/no/on/off; agent names with `:` are rejected. — [Skills](https://code.claude.com/docs/en/skills); [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- v2.1.261 (Sep 4, 2026): `/skill-doctor`.
- v2.1.269 (Sep 11, 2026): `claude plugin eval`.
- v2.1.271 (Sep 14, 2026): `omitClaudeMd` for subagents; dynamic workflow sizing changes. — [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- v2.1.277 (Sep 18, 2026): AGENTS.md support. v2.1.281 (Sep 23) extended it to Bedrock, Vertex, Foundry, and gateways.
- v2.1.283 (Sep 25, 2026): `/doctor prompt-audit`.
- v2.1.288 (Oct 2, 2026): path-scoped rules and nested CLAUDE.md now load on Write/Edit as well as Read.
- v2.1.286 (Sep 30, 2026): `--bare` limits fully enforced. — [Headless](https://code.claude.com/docs/en/headless)

### Inferences
- [inference] The pace is very fast (about 290 patch releases in 2026, often daily), and behaviour has changed several times within months. Anything the project ships should state a minimum Claude Code version (likely ≥2.1.277 for AGENTS.md, or ≥2.1.288 for reliable path rules) and be validated with `claude plugin validate --strict` and `claude plugin eval` in CI.

### Gaps
- I didn't systematically read all 411 changelog entries; the list above is keyword-targeted.

---

## Non-obvious tips from Anthropic best practices

### Takeaway
Give Claude a verification loop, keep CLAUDE.md ruthlessly short, put guarantees in hooks, use subagents for investigation and adversarial review, and manage context aggressively.

### Cited Findings
- "Give Claude a check it can run: tests, a build, a screenshot… It's the difference between a session you watch and one you walk away from." — [Best practices](https://code.claude.com/docs/en/best-practices)
- For each CLAUDE.md line, ask "Would removing this cause Claude to make mistakes?" "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" The docs include an include/exclude table: exclude anything Claude can infer from the code, standard conventions, and file-by-file descriptions. — [Best practices](https://code.claude.com/docs/en/best-practices)
- Use emphasis ("IMPORTANT") on single lines only: "If you emphasize many lines, none of them stands out." — [Best practices](https://code.claude.com/docs/en/best-practices)
- "If Claude already does something correctly without the instruction, delete it or convert it to a hook." — [Best practices](https://code.claude.com/docs/en/best-practices)
- Adversarial review: run a subagent on the diff in a fresh context. Tell the reviewer to flag only correctness/requirement gaps, because chasing every finding "leads to over-engineering". — [Best practices](https://code.claude.com/docs/en/best-practices)
- Failure patterns: the kitchen-sink session (`/clear`), repeated corrections (`/clear` after two), the over-specified CLAUDE.md, the trust-then-verify gap, and infinite exploration (scope it or use subagents). — [Best practices](https://code.claude.com/docs/en/best-practices)
- Adoption order ("Build your setup over time"): CLAUDE.md after the second repeated mistake → output style → skill for repeated prompts or procedures → MCP → LSP plugin → subagent for noisy side tasks → hook for "every time" → plugin when a second repo needs the same setup. — [Features overview](https://code.claude.com/docs/en/features-overview)

### Inferences
- [inference] **Mechanism-to-guidance mapping for the rule set:**
  - Always-true facts and commands → CLAUDE.md/AGENTS.md (under 200 lines).
  - File-type or directory conventions → `.claude/rules/` with `paths`.
  - Procedures and reference docs → skills (side-effecting ones with `disable-model-invocation`).
  - Isolated or verbose work and reviewers → subagents (tool-restricted).
  - Must-always-hold guarantees → hooks (exit 2) and permission deny rules.
  - Tone and format → output styles.
  - Org-wide non-negotiables → managed settings + managed CLAUDE.md.
  - Distribution → a plugin for skills, agents, and hooks, plus a template repo for CLAUDE.md, rules, and settings.

### Gaps
- I didn't fetch the anthropic.com engineering posts or the "Steering Claude Code" blog post (https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more, linked from the official docs), and I gathered no practitioner (non-Anthropic) sources in this pass. Practitioner tips are therefore not represented; all findings here are official.
