# Claude Haiku 5.5 and which agent work to delegate to it

Research date: 2026-10-07 (the model's release day). Evidence levels: **[official]** is Anthropic's launch page or docs, fetched on 2026-10-07; **[inference]** is our own reasoning and has not been measured.

Sources:
- Announcement: https://www.anthropic.com/claude-haiku-5-5
- Model page: https://platform.claude.com/docs/en/models/haiku-5-5/overview
- What's new: https://platform.claude.com/docs/en/models/haiku-5-5/whats-new-haiku-5-5
- Prompting guide: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5

## What the model is

- **[official]** ID `claude-haiku-5-5`, released 2026-10-07. 1M token context, 128K max output, adaptive thinking, knowledge cutoff June 2026. Described as the fastest model in the lineup.
- **[official]** First Haiku with an effort setting (low, medium, high, xhigh, max). Default is `medium`. Anthropic says `low` makes it more likely to skip a search, stop early, or skip a check in long agent prompts.
- **[official]** Price per million tokens, prompts up to 100K: $0.10 input, $0.50 output, $0.01 cache read. Above 100K: $0.50 input, $2.50 output. For comparison, Sonnet 5.5 is $2 and $10, Opus 5.5 is $4 and $20, and Haiku 4.5 was $1 and $5. Batch is 50% off.
- **[official]** The tokenizer produces about 30% more tokens than Haiku 4.5 for the same text. Anthropic still puts the average cost at about 75% below Haiku 4.5.
- **[official]** Anthropic's own recommended uses: summaries, compaction, database queries, classification, quick lookups, pulling figures from long documents as a subagent, browser use. It says to pair Haiku 5.5 with Opus 5.5 or Sonnet 5.5 as a subagent on coding work, and that Sonnet 5.5 and Opus 5.5 remain the better choices for complex agentic coding.
- **[official]** Benchmarks, Haiku 5.5 against Sonnet 5.5: Terminal-Bench 4.0 39.2% against 70.6%; FrontierCode 1.1 46.4% against 52.1%; OSWorld 2.1 72.4% against 83.9%; Humanity's Last Exam without tools 45.9% against 56.9%. SWE-bench is not reported, and no published figure or customer quote concerns code review.
- **[official]** Behaviours the prompting guide flags: at low and medium effort it sometimes reports a code change as done without running a check; with long agent prompts at low effort it sometimes stops early; it needs today's date and a nudge to search. The guide supplies prompt text for each.
- **[official]** The model runs safety classifiers that can return `stop_reason: "refusal"`, with a `cyber` category. Finding vulnerabilities in source code is allowed, but benign security work can also trigger it, and there is no server-side fallback.

Caveats: every figure above is from the vendor on release day, benchmarks are self-reported, and nothing yet tests Haiku 5.5 on our rules or our review tasks.

## Current agents and the model each uses

| Agent | Model | Effort |
|---|---|---|
| `code-reviewer` | opus | high |
| `security-reviewer` | opus | high |
| `unreal-engineer` | opus | medium |
| `web-engineer` | sonnet | medium |
| `accessibility-reviewer` | sonnet | medium |
| `performance-reviewer` | sonnet | medium |

No agent or skill uses Haiku. The smoke runs cost $0.06 to $0.27 per case, mostly in the main session, so the saving from swapping a reviewer's model is small in absolute terms. The larger saving is in work that pushes a lot of raw text through a model: CI logs, scanner output, build output.

## Test for delegating to Haiku

Delegate when all of these hold:

1. The subagent gathers or runs something and returns evidence. The calling model, which has the context, makes the judgment.
2. A wrong or incomplete answer is visible to the caller or caught by a later gate.
3. The input is large and the output small, so most of the tokens are cheap input.
4. The task does not need security-sensitive reasoning, which carries refusal risk and a recall requirement (R19).

Keep on Sonnet or Opus anything where a silent miss is the failure: finding bugs, deciding a finding is false, deciding a check is green enough to merge.

## Candidates

### Delegate now (mechanical, evidence-returning) [inference]

| Task | Where it lives today | What Haiku does | What stays with the caller |
|---|---|---|---|
| CI wait and failure triage | `merge-when-green` steps 2 and 4 (the engineers' "see a change through CI" line cannot use it, because subagents cannot start subagents) | Run `gh pr checks <pr> --watch --fail-fast`; on failure read `gh run view --log-failed` and return the check name, run ID, and the first error with surrounding lines, verbatim | Confirming every check on `headRefOid` (step 3), the decision to merge, and any fix |
| Scanner and measurement runs | `security-audit` step 2 (gitleaks, Semgrep or CodeQL, `npm audit`); `perf-audit` step 1 (Lighthouse three times); `a11y-audit` step 2 (axe) | Run the commands, write raw output to files, return counts, medians, and file paths | Interpreting results; `security-reviewer` still does the deep read |
| Build and test runs | `unreal-engineer` per-version builds and Tier 1; `package-unreal-plugin` step 3 | Run builds for each engine version, read `index.json`, return pass and fail counts and every compiler error and warning verbatim | Deciding what a warning means; fixing anything |
| Citation check on findings | `review-pr` step 4, before the confirm-or-refute pass | For each finding, confirm the cited `path:line` exists and the quoted code matches; return a mismatch list | Whether the failure scenario is real |

Why these are safe: each returns text copied from a tool, so an error shows up as a missing or odd excerpt the caller can compare with the raw file. The first two have large inputs, so most of the saving comes from the $0.10 input rate and the smaller context in the calling session.

### Test with the existing evals before adopting [inference]

- `accessibility-reviewer` and `performance-reviewer` on Haiku 5.5 at `high` effort. Both have smoke cases that pass on Sonnet. Run those on Haiku, then add planted-bug cases for the subtle criteria (2.4.11 focus obscured, 2.5.8 target size, N+1 queries, per-frame allocations) and compare recall, since R19 asks for every finding. Adopt only if recall matches Sonnet on the planted set across three or more runs.
- `plan-feature` step 1 exploration ("use a subagent for broad exploration"). The built-in Explore agent may already cover this; check which model it uses in the installed Claude Code before adding our own.
- A diff and rules gatherer that hands reviewers the changed files, the rule IDs whose paths match, and the requirement text. Reviewers must still get the diff itself, because a gatherer that omits something biases every reviewer the same way.

### Keep on current models [inference]

- `code-reviewer` and `security-reviewer`: recall-critical, and Haiku 5.5 trails Sonnet 5.5 by a wide margin on agentic coding (39.2% against 70.6% on Terminal-Bench 4.0). `security-reviewer` also risks `cyber` refusals with no fallback.
- `web-engineer` and `unreal-engineer`: Anthropic's own guidance keeps implementation on Sonnet or Opus.
- The semantic confirm-or-refute pass in `review-pr`. A wrongly refuted finding disappears from the report, so an error here is silent and costly.
- `release`, `plan-feature` drafting, `write-adr`: low volume, judgment-heavy, and the saving is a few cents.

## Implementation notes

- Pin `model: claude-haiku-5-5` in agent frontmatter, or confirm that the `haiku` alias resolves to 5.5 in the installed Claude Code before relying on it. Our mechanics note lists `haiku` as an accepted value but says nothing about which version it maps to.
- Keep `effort: medium` or higher. Anthropic reports early stopping and skipped checks at `low`.
- Add the "keep working until everything is done, then stop and report" paragraph from the prompting guide to long-running Haiku agents, and the "run a real check before reporting done" paragraph to any that run code.
- Give each Haiku agent a fixed return format (check, command, exit code, verbatim excerpt) so the caller can spot a malformed answer.
- Haiku agents get `Read, Grep, Glob, Bash` and `disallowedTools: Edit, Write, Agent`, as the reviewers do.

## What was built (1.1.0) and what the smoke runs showed

Built: `ci-watcher`, `check-runner`, and `citation-checker`, all pinned to `claude-haiku-5-5` at `medium` effort with read-only tools, and the skill changes in the table above. The skills delegate only when there is something to wait for or enough output to be worth it: `merge-when-green` calls `ci-watcher` when checks are pending, `review-pr` calls `citation-checker` with three or more findings, and `security-audit` calls `check-runner` only when the project has scanners. The caller still re-reads the head commit before merging.

Smoke results (`evals/results/smoke-haiku-subagents/`, 16 of 16 passing, 2026-10-07):

- The harness reads `modelUsage` from the CLI's JSON output, and the new cases fail unless `claude-haiku-5-5` ran, so the pinned ID is accepted and used.
- Each agent run costs about $0.0012 to $0.0018. In these small scenarios the Sonnet session around it costs $0.06 to $0.30, so Haiku was $0.010 of $1.62 in total. The saving here is not measurable; it would have to come from large inputs.
- Two first-run failures were test problems (a format-bound regex, and the agent reporting `pass` where the check expected `SUCCESS`). One was a design finding: with instantly finishing checks, the parent skipped `ci-watcher`, which is correct, since a spawn costs more than the call. A pending-checks scenario was added to the fake `gh`, and the parent then delegated the wait.
- The agents behaved as specified: verbatim excerpts, no merge or re-run calls, `did not run` for a missing scanner, and a clean working tree afterwards.

Still open: a before and after cost comparison on a long CI log or a large scanner output, which is where the input-price difference ($0.10 against $2 per million tokens) should show. Until that is measured, the claim is that the agents are safe and cheap per call, not that a run costs less overall. Reviewer trials on Haiku (the second group above) are not started.
