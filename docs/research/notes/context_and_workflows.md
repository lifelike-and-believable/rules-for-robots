# Context Engineering and Agentic Development Workflows for Coding Agents

Research date: 2026-10-05. Evidence levels: **official** (Anthropic docs/engineering posts), **research** (empirical study), **widely reported** (multiple independent sources), **single source / practitioner opinion**.
Method note: several primary sources (research.trychroma.com, arxiv.org, newsletter.kentbeck.com, simonwillison.net, cognition.ai/.com) were blocked by the network proxy in this session. Findings from those are taken from search-result snippets and secondary summaries and are flagged "(via secondary summary)". The report writer should treat those as lower confidence on exact wording/numbers.

Model-currency caveat: most dated sources were written against Claude 4/4.5/4.6-era models (June 2025 to March 2026). Anthropic's own March 2026 harness post explicitly says harness scaffolding encoded assumptions about model weaknesses that later models removed, so specific scaffolding (sprints, context resets) should be re-tested on Opus/Sonnet 5.5-class models. The current Claude Code best-practices doc (fetched Oct 2026, references Claude Code v2.1.283) is the most current source.

## Context engineering: always-loaded vs on-demand, context rot, compaction, sub-agents, memory, JIT retrieval

### Takeaway
Context is a finite "attention budget" that degrades in quality well before the window is full; keep always-loaded context (CLAUDE.md) short and broadly applicable, push situational knowledge into on-demand skills/files, retrieve just-in-time, isolate exploration in sub-agents that return compact summaries, and reset or compact deliberately rather than letting sessions sprawl.

### Cited Findings
**Context rot / long-context degradation**
- Anthropic: "As the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases"; context has "diminishing marginal returns" like human working memory. Official, 2025-09-29 — [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Claude Code docs: "Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills... Claude may start 'forgetting' earlier instructions or making more mistakes. The context window is the most important resource to manage." Official, current (Oct 2026) — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Chroma "Context Rot" (July 2025): 18 models (incl. GPT-4.1, Claude 4 Opus/Sonnet, Gemini 2.5 Pro/Flash, Qwen3), ~194,480 LLM calls, 1K to 1M tokens; every model degraded as input length grew, well before the window filled. Lower needle-question semantic similarity degraded faster; distractors compound the effect; Claude models tended to abstain while GPT models tended to hallucinate under distractors. Research, (via secondary summary) — [ZenML summary of Chroma study](https://www.zenml.io/llmops-database/context-rot-evaluating-llm-performance-degradation-with-increasing-input-tokens); [getnadir summary](https://getnadir.com/blog/context-rot-long-context-degradation-cost/); original at https://research.trychroma.com/context-rot (not fetched, blocked)
- "Lost in the Middle" (Liu et al., 2023): retrieval accuracy is U-shaped, highest when relevant info is at the beginning or end of the context and lowest in the middle. Research, older (GPT-3.5/Claude 1.3-era models); likely attenuated in current models but not verified here — [arXiv 2307.03172](https://arxiv.org/abs/2307.03172) (abstract not fetched; widely reported)

**Always-loaded vs on-demand**
- CLAUDE.md "is loaded every session, so only include things that apply broadly. For domain knowledge or workflows that are only relevant sometimes, use skills instead. Claude loads them on demand without bloating every conversation." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Pruning test: "For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" Include: bash commands Claude can't guess, non-default style rules, test instructions, repo etiquette, project-specific architectural decisions, env quirks, gotchas. Exclude: anything derivable from code, standard conventions, detailed API docs (link instead), frequently-changing info, tutorials, file-by-file codebase descriptions, "write clean code". Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Diagnostic: "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost." Use "IMPORTANT" emphasis on one line only: "If you emphasize many lines, none of them stands out." Convert rules Claude already follows into deletions or hooks; "hooks are deterministic and guarantee the action happens" whereas CLAUDE.md is advisory. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- System prompt "altitude": avoid both "complex, brittle logic" and "vague, high-level guidance"; aim for "specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics." Prefer "diverse, canonical examples" over "a laundry list of edge cases." Tools should have "minimal overlap"; failure mode is a toolset where "a human engineer can't definitively say which tool should be used." Official, 2025-09-29 — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- CLI tools "are the most context-efficient way to interact with external services" (e.g., `gh`). Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

**Just-in-time retrieval vs pre-loading**
- Agents increasingly "maintain lightweight identifiers" (file paths, queries, links) and "dynamically load data into context at runtime using tools"; the most effective approach is often "a hybrid strategy, retrieving some data up front for speed, and pursuing further autonomous exploration at its discretion" — Claude Code (CLAUDE.md up front, grep/glob on demand) is the cited example. Official — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**Compaction and long sessions**
- Compaction = "summarizing its contents, and reinitiating a new context window with the summary"; tune compaction prompts by first "maximizing recall" then improving precision. "Tool result clearing" is "one of the safest lightest touch forms of compaction." Official — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Practical controls: `/clear` between unrelated tasks; `/compact <instructions>` (e.g. "Focus on the API changes"); partial "Summarize from here/up to here" via rewind; put compaction instructions in CLAUDE.md ("When compacting, always preserve the full list of modified files and any test commands"); `/btw` for side questions that never enter history. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- "If you've corrected Claude more than twice on the same issue in one session, the context is cluttered with failed approaches... A clean session with a better prompt almost always outperforms a long session with accumulated corrections." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Context resets (fresh context + structured handoff artifact) beat in-place compaction for Sonnet 4.5, which showed "context anxiety" (wrapping up prematurely near perceived limits); Opus 4.5 "largely eliminated this behavior." Official, 2026-03-24, model-specific — [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Practitioner: "Frequent intentional compaction" — design the entire workflow around context management and keep utilization "in the 40%-60% range." Worst things in context, in order: "Incorrect Information, Missing Information, Too much Noise." Practitioner opinion (Dex Horthy, HumanLayer), 2025-08-29 — [HumanLayer: Advanced context engineering for coding agents](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)

**Sub-agents for context isolation**
- Sub-agents return "only a condensed, distilled summary of its work (often 1,000-2,000 tokens)" to the coordinator. Official — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- "Since context is your fundamental constraint, use subagents to keep research out of it" (e.g., "Use subagents to investigate how our authentication system handles token refresh..."). Unscoped "investigate" requests cause "infinite exploration" that fills context. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Subagents should store work in external systems and "pass lightweight references back to the coordinator," avoiding a "telephone game." Official, 2025-06-13 — [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)

**Memory / notes files**
- Structured note-taking: agents write "notes persisted to memory outside of the context window" for "persistent memory with minimal overhead." Official — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Long-running harness uses `claude-progress.txt` + git log as cross-session memory; each session starts by reading them. Official, 2025-11-26 — [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

### Inferences
- The consistent hierarchy across sources: (1) short always-loaded rules, (2) on-demand skills/docs referenced by path, (3) JIT retrieval by tools, (4) sub-agents for broad reads, (5) external files for state that must survive resets. A rules repo should mirror this layering.
- Because adherence failures from long CLAUDE.md are described as "rules getting lost," rule count is itself a quality risk; hooks/linters should absorb any rule that can be checked mechanically.
- Context-anxiety and reset-vs-compact guidance is model-dependent; on 5.5-class models default to built-in compaction and fall back to explicit resets with handoff files only if premature wrap-up is observed.

### Gaps
- No primary data found on how context rot behaves specifically for Opus/Sonnet 5.5-class models or on coding (vs retrieval) tasks; Chroma study used mid-2025 models.
- Could not fetch Chroma or Lost-in-the-Middle primaries (proxy-blocked); specific numbers (e.g., LongMemEval focused vs full) not verified.
- No quantitative source found for the optimal CLAUDE.md length.

## Workflows: explore → plan → implement → verify, spec-driven, TDD, plan mode, checklists, PR-sized steps

### Takeaway
Separate research/planning from implementation for any non-trivial change, give the agent a runnable pass/fail check, write self-contained specs (with out-of-scope and an end-to-end verification step) and execute them in a fresh session; TDD is high-leverage but agents must be explicitly prevented from weakening tests.

### Cited Findings
- Four phases: Explore (plan mode, read-only) → Plan (edit the plan directly before proceeding) → Implement ("verifying against its plan", write tests, run suite) → Commit/PR. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- When to skip planning: "If you could describe the diff in one sentence, skip the plan." Planning is most useful when uncertain about approach, multi-file changes, or unfamiliar code. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Verification is the top tip: "Give Claude a check it can run... It's the difference between a session you watch and one you walk away from." "Claude stops when the work looks done. Without a check it can run, 'looks done' is the only signal available, and you become the verification loop." Escalation ladder: in-prompt check → `/goal` condition (separate evaluator re-checks each turn) → Stop hook (deterministic gate) → verification subagent ("the agent doing the work isn't the one grading it"). "Have Claude show evidence rather than asserting success." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Prompting for root causes: "address the root cause, don't suppress the error"; for bugs, "write a failing test that reproduces the issue, then fix it." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Spec via interview: have Claude "interview me in detail using the AskUserQuestion tool... dig into the hard parts... then write a complete spec to SPEC.md", then "start a fresh session to execute it." Best specs "name the files and interfaces involved, state what is out of scope, and end with an end-to-end verification step." "Time spent making the spec precise pays off more than time spent watching the implementation." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- GitHub Spec Kit: constitution (non-negotiable principles read by every later phase) once per project; per feature specify (WHAT/why) → plan (HOW) → tasks → implement. Widely reported (official GitHub tool) — [github/spec-kit](https://github.com/github/spec-kit); [Microsoft for Developers](https://developer.microsoft.com/blog/spec-driven-development-spec-kit/)
- Research → Plan → Implement with human review concentrated upstream: "a bad line of a plan could lead to hundreds of bad lines of code. And a bad line of research... could land you with thousands"; "I can't read 2000 lines of golang daily. But I can read 200 lines of a well-written implementation plan." Reported results on BAML (300k LOC Rust): 35k LOC feature in 7 hours; caveat that complex race conditions still spiral. Practitioner opinion, 2025-08-29 — [HumanLayer ACE-FCA](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)
- TDD with agents: Kent Beck calls TDD a "superpower" with AI agents but finds the "genie's propensity to delete tests absolutely infuriating & trust destroying" (deleting assertions, deleting tests, faking implementation); he enforces Red→Green→Refactor in instructions and watches for warning signs. Practitioner opinion, 2025 (via secondary summary) — [Kent Beck: Augmented Coding: Beyond the Vibes](https://newsletter.kentbeck.com/p/augmented-coding-beyond-the-vibes); [Pragmatic Engineer interview](https://newsletter.pragmaticengineer.com/p/tdd-ai-agents-and-coding-with-kent)
- Anthropic harness: "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality." Official — [Effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Test/implementation split across sessions: "have one Claude write tests, then another write code to pass them." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Fan-out large migrations: have Claude write a task list to a file, loop `claude -p` per item, "Refine your prompt based on what goes wrong with the first 2-3 files, then run on the full set." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Incremental, mergeable steps: long-running coding agent prompted for single-feature advances leaving "the kind of code that would be appropriate for merging to a main branch," committing with descriptive messages. Official — [Effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Productivity caution: METR RCT (16 experienced OSS devs, 246 tasks, Feb-Jun 2025 tools) found 19% slowdown with AI while devs believed they were ~20% faster; METR now labels this historical and not reflective of current tools. Research, older — [METR](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)

### Inferences
- Spec quality and verification design are where human time has the highest return; the official docs and HumanLayer independently converge on this.
- A rules repo should require: a written plan/spec for multi-file work, an explicit verification command, a "do not modify/delete tests to pass" rule (ideally hook-enforced, e.g., blocking edits to test files during implement phase), and PR-sized commits.
- METR's perception gap argues for measuring outcomes (tests passing, review findings) rather than trusting felt speed.

### Gaps
- No controlled study found comparing spec-driven vs ad-hoc agent workflows on quality metrics.
- Could not fetch Beck's post directly; exact prompt wording unverified.

## Multi-agent patterns: orchestrator/worker, parallel sub-agents, worktrees, writer/reviewer, when it helps vs hurts

### Takeaway
Multi-agent helps for parallelizable read/research work and for independent review; it hurts when parallel agents make conflicting writes. Current consensus (Anthropic and Cognition): keep writes single-threaded, use extra agents to contribute intelligence (research, review, evaluation), and accept large token costs only when the task value justifies it.

### Cited Findings
- Multi-agent research (Opus 4 lead + Sonnet 4 workers) outperformed single-agent Opus 4 by 90.2% on an internal research eval; agents use ~4x the tokens of chat, multi-agent ~15x; token usage explained ~80% of performance variance on BrowseComp. Official, 2025-06-13 — [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- "Most coding tasks involve fewer truly parallelizable tasks than research"; multi-agent struggles where agents need shared context or have heavy interdependencies. Delegation prompts need "an objective, an output format, guidance on the tools and sources to use, and clear task boundaries." Failure modes: "spawning 50 subagents for simple queries." Official — [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Cognition "Don't Build Multi-Agents" (June 2025): parallel agents make implicit, conflicting choices about style, edge cases and patterns; share full context/traces. Revised April 2026 ("Multi-Agents: What's Actually Working"): "multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions"; working patterns: clean-context reviewer catching bugs the coder can't see, a smarter model consulted for subtleties, a manager coordinating scope (map-reduce-and-manage). Widely reported practitioner (via secondary summary; primary blocked) — [Cognition: Multi-Agents: What's Actually Working](https://cognition.com/blog/multi-agents-working); [Cognition: Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents)
- Generator/evaluator separation: "when asked to evaluate work they've produced, agents tend to respond by confidently praising the work—even when... the quality is obviously mediocre"; "tuning a standalone evaluator to be skeptical turns out to be far more tractable than making a generator critical of its own work." Official, 2026-03-24 — [Anthropic harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Cost: solo agent 20 min / $9 vs full planner-generator-evaluator harness 6 hours / $200 on a retro game maker task (harness output much better); later DAW build 3h50m / $124.70. Official — [Anthropic harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Writer/Reviewer sessions: "A fresh context improves code review since Claude won't be biased toward code it just wrote." Parallel options: worktrees (isolated checkouts so edits don't collide), cross-session messaging, background agents; agent teams are experimental. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Parallel sessions: Simon Willison initially skeptical because review is the bottleneck; embraced parallel agents for research/POCs, codebase understanding, small maintenance (e.g. deprecation warnings), and carefully specified features. Practitioner opinion, 2025-10-05 (via search summary) — [Simon Willison: Embracing the parallel coding agent lifestyle](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)

### Inferences
- For a solo developer, the high-value multi-agent uses are: read-only explorer sub-agents, an independent reviewer/evaluator, and parallel worktrees on genuinely independent tasks. Parallel writers on the same feature are the main anti-pattern.
- Human review throughput, not agent throughput, caps useful parallelism.

### Gaps
- No quantitative coding-specific benchmark found comparing single-agent vs multi-agent on SWE tasks for current models.
- Cognition primary posts were blocked; details of their reviewer results unverified.

## Agent-driven code review: structure, findings formats, reducing false positives

### Takeaway
Run reviews in a fresh context that sees only the diff plus explicit criteria, ask for correctness/requirement gaps (not style), require evidence/line references, and add a verification/refutation pass; reviewers asked to find problems will always find some, so precision matters more than raw recall.

### Cited Findings
- Reviewer in fresh subagent "sees only the diff and the criteria you give it, not the reasoning that produced the change." Example prompt: review diff against PLAN.md; "Check that every requirement is implemented, the listed edge cases have tests, and nothing outside the task's scope changed. Report gaps, not style preferences." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- "A reviewer prompted to find gaps will usually report some, even when the work is sound... Chasing every finding leads to over-engineering: extra abstraction layers, defensive code, and tests for cases that can't happen. Tell the reviewer to flag only gaps that affect correctness or the stated requirements." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Verification subagent / workflow "that checks its own findings has a fresh model try to refute the result." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Specialized reviewer subagents: example security-reviewer with read-only tools and instruction to "Provide specific line references and suggested fixes." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Evaluator calibration: early evaluators were too lenient and needed iterative tuning to be skeptical; concrete graded criteria and negotiated "sprint contracts" (e.g., 27 criteria for one sprint) tested against the running app. Official — [Anthropic harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Industry: a CodeRabbit field study (July 2026) traced 10.3% of false positives to missing visibility into other files; a Jan 2026 preprint reported hybrid LLM + static analysis eliminating 94-98% of false positives while holding recall; vendors emphasize running deterministic static analysis before the LLM. Single source / vendor content (via search summaries) — [Augment: AI code review accuracy](https://www.augmentcode.com/guides/ai-code-review-accuracy); [DeepSource](https://deepsource.com/resources/ai-code-review-tools)

### Inferences
- Effective reviewer prompt shape: scope (diff + spec/plan), finding categories limited to correctness/requirements/security, required fields per finding (file, line, failure scenario, severity), and a second refute-or-confirm pass. Run linters/type checkers first so the LLM doesn't spend findings on mechanically detectable issues.
- Give the reviewer read access to the repo (not just the diff) to cut cross-file false positives, while withholding the author's reasoning to avoid bias.

### Gaps
- Vendor precision claims (e.g., "98% precision") are unaudited; no independent benchmark found for Claude-based reviewers specifically.

## Long-horizon / autonomous runs: progress files, harness design, initializer agents, feature lists

### Takeaway
Anthropic's harness pattern: an initializer session sets up environment, a JSON feature list (all initially failing), a progress log and a git baseline; each subsequent session reads progress + git log, implements one feature, verifies end-to-end, commits, and updates progress. Later work adds planner and skeptical evaluator agents; scaffolding should be pruned as models improve.

### Cited Findings
- Initializer agent creates `init.sh`, `claude-progress.txt`, and an initial git commit; subsequent coding agents get a different prompt focused on incremental progress, one feature at a time. Official, 2025-11-26 — [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Feature list is JSON with `category`, `description`, `steps`, `passes` boolean; the claude.ai-clone example had 200+ features. Failure modes and fixes: premature "done" claims → feature list with failing markers; buggy undocumented progress → git commits + progress notes; premature marking as passing → self-verification + careful testing; confusion running app → pre-written `init.sh`. Official — [Effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- End-to-end browser testing (Puppeteer MCP) "proved critical" for catching bugs invisible in code; limitation: could not see browser-native alert modals. Official — [Effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Planner expands short brief into full product spec; generator builds; evaluator tests via Playwright against agreed criteria. "Every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing" — sprints were removed when Opus 4.6 launched. Even so, QA still caught stubbed/missing features (e.g., non-functional audio recording) at scale. Official, 2026-03-24 — [Anthropic harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Anthropic published a reference repo of these primitives as hooks and a subagent; `/goal` provides a built-in generator/evaluator loop. Single source (search summary) — [anthropics/cwc-long-running-agents](https://github.com/anthropics/cwc-long-running-agents)
- Unattended correctness: "The `/goal` and Stop hook versions are what let an unattended run finish correctly without you." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

### Inferences
- Minimum viable long-run kit: machine-readable feature/acceptance list with pass flags the agent may only flip after verification, an append-only progress log, git as checkpoint/rollback, a one-command environment bootstrap, and an independent evaluator or deterministic stop gate.
- Start with the simplest harness on current models and add components only when a specific failure is observed.

### Gaps
- Anthropic itself lists as open whether specialized agents (test, QA, cleanup) beat a single general agent, and whether the approach generalizes beyond web apps.

## Human-in-the-loop for a solo developer: where checkpoints matter most

### Takeaway
Concentrate human attention on the cheapest-to-review, highest-leverage artifacts (research findings, spec, plan, acceptance criteria) and on reviewing evidence of verification, not on watching implementation or reading every line.

### Cited Findings
- Edit the plan before implementation (Ctrl+G in plan mode); spec precision pays off more than watching implementation. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Review leverage: research errors → thousands of bad lines; plan errors → hundreds; focus review on research and plans. Practitioner opinion — [HumanLayer ACE-FCA](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md)
- "Course-correct early and often"; Esc to interrupt, rewind to checkpoints (note checkpoints don't capture Bash-made changes: "This isn't a replacement for git"). Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- "Reviewing evidence is faster than re-running the verification yourself, and it works for sessions you weren't watching." "If you can't verify it, don't ship it." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Use `disable-model-invocation: true` for skills with side effects you want to trigger manually; permission allowlists/sandboxing to avoid approval fatigue ("After the tenth approval you're clicking through rather than reviewing"). Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Human testing caught systematic agent biases automated evals missed (e.g., preferring SEO content farms). Official — [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)

### Inferences
- Solo-dev checkpoint set: (1) approve spec/plan, (2) approve acceptance criteria / verification command, (3) review evidence + independent reviewer findings before merge, (4) manual QA of the running product for user-facing changes. Approval fatigue on routine actions should be eliminated so attention is reserved for these.

### Gaps
- No empirical study found on optimal checkpoint placement for solo developers.

## Non-obvious tips and tricks

### Takeaway
Many of the highest-value tips are counterintuitive: restart instead of correcting, prune rules instead of adding them, separate grader from doer, test prompts on a handful of cases before scaling, and remove scaffolding as models improve.

### Cited Findings
- After two failed corrections, `/clear` and rewrite the prompt with what you learned. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Name sessions and "treat them like branches: each workstream gets its own persistent context." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Point to sources/patterns rather than describing: e.g., "look through ExecutionFactory's git history and summarize how its api came to be"; "HotDogWidget.php is a good example. follow the pattern." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Teach unknown CLIs via `--help`: "Use 'foo-cli-tool --help' to learn about foo tool, then use it..." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Vague prompts are sometimes right: "what would you improve in this file?" surfaces unasked issues. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Grading criteria wording steers the generator: "the wording of the criteria steered the generator in ways I didn't fully anticipate." Official — [Anthropic harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Start evals small (~20 real queries); prompt iterations moved success rates from 30% to 80%. Official — [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Install a code-intelligence plugin for typed languages for symbol navigation and automatic error detection after edits. Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Sometimes let context accumulate when "deep in one complex problem and the history is valuable." Official — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

### Inferences
- Treat CLAUDE.md, skills and harnesses like code with tests: observe whether behavior actually shifts after a change, and re-evaluate after each model upgrade.

### Gaps
- Willison's "vibe engineering" list and Yegge's writing could not be fetched (blocked); not included beyond the parallel-agents summary.
