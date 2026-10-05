# Instruction and prompt design for current Claude models (4.x to 5.x) in persistent agent instructions

Research date: 2026-10-05. Evidence levels used below: **official** (Anthropic docs/blog), **research** (study), **widely reported** (several practitioners), **single source**.

Source dating note: the Anthropic docs pages (platform.claude.com, code.claude.com) carry no visible publication date. They were fetched on 2026-10-05 and are current as of that date. They reference Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1, and beta headers dated 2026-08-18 and 2026-08-21. The main prompting reference is https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (the old ".../claude-4-best-practices" URL redirects there). It states that it covers "Claude Fable 5.1, Claude Mythos 5.1, Claude Fable 5, Claude Mythos 5, Claude Opus 5.5, Claude Opus 5, Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6, Claude Sonnet 5.5, Claude Sonnet 5, Claude Sonnet 4.6, and Claude Haiku 4.5". The models also have their own per-model pages. Each one describes only the differences from the previous model, so the guidance builds up across pages: Opus 4.8 → Opus 5 → Opus 5.5, and Sonnet 5 → Sonnet 5.5.

## Q1. What do Anthropic's current prompting guides say about writing instructions for the newest models?

### Takeaway
Anthropic's current advice comes down to six points:
- Be clear, direct and specific.
- Explain why a rule exists.
- Say what to do rather than what not to do.
- Use examples and XML or Markdown structure.
- Drop aggressive emphasis. Current models are responsive enough that "CRITICAL/MUST" wording over-triggers.
- Name the scope of a rule explicitly, because newer models apply instructions literally and do not generalise them on their own.

For Opus 5.5 specifically, the guide says existing Opus 5 prompts "should perform well without changes". The 5.5-specific advice is mostly about removing instructions that are no longer needed, such as "think carefully" and requests to show reasoning.

### Cited Findings
**General principles (official, applies to all current models including Opus/Sonnet 5.5)**
- "Claude responds well to clear, explicit instructions… If you want 'above and beyond' behavior, explicitly request it rather than relying on the model to infer this from vague prompts." It also says to think of Claude as "a brilliant but new employee who lacks context on your norms and workflows". Its "golden rule" is to show the prompt to a colleague with minimal context; if they would be confused, Claude will be too. — [Anthropic, Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Giving reasons (official):** "Providing context or motivation behind your instructions, such as explaining to Claude why such behavior is important, can help Claude better understand your goals." The worked example replaces "NEVER use ellipses" with "Your response will be read aloud by a text-to-speech engine, so never use ellipses since the text-to-speech engine will not know how to pronounce them." The guide adds: "Claude is smart enough to generalize from the explanation." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Emphatic language (official):** "Claude Opus 4.5 and Claude Opus 4.6 are also more responsive to the system prompt than previous models. If your prompts were designed to reduce undertriggering on tools or skills, these models may now overtrigger. The fix is to dial back any aggressive language. Where you might have said 'CRITICAL: You MUST use this tool when...', you can use more normal prompting like 'Use this tool when...'." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Over-prompting thoroughness (official):** "Remove over-prompting. Tools that undertriggered in previous models are likely to trigger appropriately now. Instructions like 'If in doubt, use [tool]' will cause overtriggering." Also: "Replace blanket defaults with more targeted instructions. Instead of 'Default to using [tool],' add guidance like 'Use [tool] when it would enhance your understanding of the problem.'" — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Positive vs negative (official):** "Tell Claude what to do instead of what not to do." For example, instead of "Do not use markdown", write "Your response should be composed of smoothly flowing prose paragraphs." Also: "Match your prompt style to the desired output… removing markdown from your prompt can reduce the volume of markdown in the output." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- Two per-model pages repeat this point. Opus 4.8: "Positive examples showing how Claude can communicate with the appropriate level of concision tend to be more effective than negative examples or instructions that tell the model what not to do." Opus 5: "Positive examples of the communication style you want tend to be more effective than instructions about what not to do." — [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8); [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
- **Examples (official):** "Examples are one of the most reliable ways to steer Claude's output format, tone, and structure." Examples should be relevant, diverse and wrapped in `<example>` tags. "Include 3–5 examples for best results." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **XML tags (official):** "XML tags help Claude parse complex prompts unambiguously, especially when your prompt mixes instructions, context, examples, and variable inputs." Use consistent, descriptive tag names, and nest them where the content has a hierarchy. — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices). The context-engineering post adds: organise prompts "into distinct sections (like `<background_information>`, `<instructions>`, `## Tool guidance`…)" using "XML tagging or Markdown headers". — [Anthropic Engineering, Effective context engineering for AI agents, 2025-09-29](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- **Literal instruction following (official):** "Claude's latest models are trained for precise instruction following and benefit from explicit direction to use specific tools. If you say 'can you suggest some changes,' Claude will sometimes provide suggestions rather than implementing them." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- Opus 4.8 is described the same way: "Claude Opus 4.8 interprets prompts literally and explicitly, particularly at lower effort levels. It does not silently generalize an instruction from one item to another, and it does not infer requests you didn't make… If you need Claude to apply an instruction broadly, state the scope explicitly (for example, 'Apply this formatting to every section, not just the first one')." The Sonnet 5 page also lists "literal instruction following" as a change from Sonnet 4.6. — [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8); [Prompting best practices, model table](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Literalism applied to filtering wording (official):** On Opus 4.8, review prompts that say "only report high-severity issues", "be conservative" or "don't nitpick" are followed "more faithfully than earlier models". The model "may investigate the code just as thoroughly, identify the bugs, and then not report findings it judges to be below your stated bar". Anthropic recommends "be concrete about where the bar is rather than using qualitative terms like 'important'". Opus 5 shows the same behaviour: "the model may follow that instruction literally and report less; ask it to report everything and filter in a separate pass instead." — [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8); [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
- **Brief instructions now suffice (official, Fable 5 / Mythos 5, the most capable tier):** "Instruction-following is improved enough that you can steer most behaviors with a brief instruction rather than enumerating each behavior by name… A short brevity instruction is as effective as listing each pattern." Checkpoints work the same way: "there is no need to enumerate every case". — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- **Prescriptive skills can hurt (official, Fable 5):** "Skills developed for prior models are often too prescriptive for Claude Fable 5 and can degrade output quality. Review and consider removing older instructions if default performance is better." — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- **Give the reason (official, Fable 5):** "Claude Fable 5 tends to perform better when it understands the intent behind a request: context lets it connect the task to relevant information rather than inferring intent on its own." Template: "I'm working on [the larger task] for [who it's for]. They need [what the output enables]. With that in mind: [request]." — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- **General instructions over step lists for reasoning (official):** "Prefer general instructions over prescriptive steps. A prompt like 'think thoroughly' often produces better reasoning than a hand-written step-by-step plan. Claude's reasoning frequently exceeds what a human would prescribe." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **"Right altitude" (official, 2025-09-29):** Prompts should sit at "the right altitude". The post names two failure modes. One is hardcoding "complex, brittle logic in their prompts to elicit exact agentic behavior". The other is "vague, high-level guidance that fails to give the LLM concrete signals". The aim is "the minimal set of information that fully outlines your expected behavior", and minimal does not mean short. Use "diverse, canonical examples" rather than "a laundry list of edge cases". Start with a minimal prompt on the best model and add instructions only for failures you observe. — [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- **Opus 5.5 specifics (official):**
  - "Existing Claude Opus 5 prompts should perform well without changes, and the patterns in Prompting Claude Opus 5 remain a reasonable starting point."
  - Remove "think carefully before answering" lines: "The model decides for itself how much to think, and effort is the main control. In Anthropic's testing in a chat product, removing such a line made replies start sooner, with no clear decline in the quality."
  - Effort is a better lever than prompt wording: "To get less thinking, lower the effort level first. Lowering effort reduces thinking… more reliably than prompt instructions do."
  - Opus 5.5 "is responsive to instructions that name the specific kinds of early stop you want it to avoid".
  - Generic negative frontend instructions such as "avoid a generic AI look" mostly "swap one default for another". The model "responds well to instructions that name specific patterns to avoid".

  — [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
- **Sonnet 5.5 specifics (official):** "Asking it in the system prompt to think less doesn't reliably reduce its thinking." Remove language that discourages tool use, such as "only use tools when strictly necessary" or "minimize tool calls". Remove older instructions such as "hold all findings for the final response". — [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
- **Instructions that now cause refusals (official, Opus 5 / Fable 5 / Opus 5.5 / Sonnet 5.5):** "Prompts, skills, and tool descriptions that ask Claude Opus 5 to write out its thinking or reasoning, verbatim or in a fixed format, may be declined with the `reasoning_extraction` refusal category." Fable 5: "Audit existing skills and system prompts for reflection or show-your-thinking instructions when migrating." Asking for "a short explanation of the answer or a summary of the actions taken" is still fine. — [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5); [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- **"No thinking" rules backfire (official, Opus 5 / Sonnet 5.5):** "If your system prompt contains a rule instructing the model not to think or not to reason, remove it; that kind of instruction increases tag leakage." And: "Instructions that call out thinking tags by name are less effective than the general form." — [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5); [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)

### Inferences
- For a rule set aimed at Opus/Sonnet 5.5, state each rule once, calmly, with a one-clause reason and an explicit scope ("in every file you touch", "for all endpoints"). Avoid stacked emphasis, "if in doubt, do X" defaults, and "think carefully / show your reasoning" lines.
- Literal reading cuts both ways. Qualitative thresholds ("only important", "be conservative") get applied strictly and can silently suppress behaviour you wanted. Rules should give concrete criteria.
- Anthropic's own sample prompts still use some negatives ("Don't add…") and occasional caps (for example "DO NOT use ordered lists", "NEVER output a series of overly short bullet points" in its formatting snippet). The "positive framing" advice is a preference, not a ban. Short, specific negative lists work well when they name concrete patterns, as in the Opus 5.5 frontend example.

### Gaps
- Anthropic has not published a controlled measurement of "all caps vs normal case" on 5.x models. The over-triggering claim is stated for Opus 4.5/4.6 and carried forward in the general guide without new data.
- The Opus 5.5 page does not discuss literal instruction following directly. The most recent explicit statements are for Opus 4.8 and Sonnet 5 (literalism) and Fable 5 (brief instructions suffice).

## Q2. What changed between model generations (3.x → 4 → 4.5/4.6 → 4.8 → 5 → 5.5)?

### Takeaway
The direction is consistent. Each generation follows instructions more precisely and is more proactive and thorough by default. As a result, scaffolding written to push older models ("be thorough", "MUST use tool", "verify your work", "think step by step", "summarise every N tool calls") now tends to cause over-triggering, over-verification or wasted tokens. The usual migration advice is to delete, soften or replace such instructions with the effort parameter, not to add more.

### Cited Findings
- **Claude 3.x → 4 (official, older guidance carried in the current doc):** the "be explicit about above-and-beyond" advice exists because newer models do exactly what is asked. The migration list says: "Be specific about desired behavior", "Request specific features explicitly: Animations and interactive elements should be requested explicitly when desired." — [Prompting best practices, Migration considerations](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **4.5/4.6 (official):** These models are "more responsive to the system prompt" and tools/skills "may now overtrigger", so "dial back any aggressive language". "Tune anti-laziness prompting: If your prompts previously encouraged the model to be more thorough or use tools more aggressively, dial back that guidance. Claude 4.6 models are more proactive and may overtrigger on instructions that were needed for previous models." Opus 4.5 and 4.6 "have a tendency to overengineer by creating extra files, adding unnecessary abstractions, or building in flexibility that wasn't requested". Opus 4.6 "has a strong predilection for subagents". Prefill on the last assistant turn is unsupported from Claude 4.6 onwards (returns 400). — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Older-model-only quirk (official):** "When extended thinking is disabled, Claude Opus 4.5 is particularly sensitive to the word 'think' and its variants. Consider using alternatives like 'consider,' 'evaluate,' or 'reason through'." *(Applies to Opus 4.5 with thinking off only.)* — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **4.8 (official):** More literal instruction following; strict respect for effort levels ("At `low` and `medium`, the model scopes its work to what was asked"); favours reasoning over tool calls. Remove forced-status scaffolding: "If you've added scaffolding to force interim status messages ('After every 3 tool calls, summarize progress'), try removing it." "Requires less frontend design prompting than previous models." Review prompts tuned for older models lower measured recall because the model follows filtering language faithfully. — [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8)
- **Opus 5 (official):**
  - "Claude Opus 5 verifies its own work without being told to. If your prompt contains explicit verification instructions ('include a final verification step for any non-trivial task,' 'use a subagent to verify'), remove them: instructions like these cause over-verification on Claude Opus 5, and removing them reduces wasted tokens with no loss in quality."
  - "Avoid instructing re-checks it already performs ('double-check your answer,' 're-verify before responding')."
  - Default responses run longer, and effort "does not reliably change visible response length", so prompt for conciseness explicitly.
  - It can expand task scope and delegates to subagents more readily.
  - The general guide says that on Opus 5 the "verify against criteria" instruction should be removed "rather than rewriting them".

  — [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5); [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Opus 5.5 (official):**
  - Thinking is always on (adaptive only) and the default effort is `medium`. "At `medium` [Opus 5.5] matches or exceeds Claude Opus 5 at `high`."
  - Remove "think carefully" lines.
  - Prompts that substituted for thinking ("write out your reasoning") should be removed because they can trigger `reasoning_extraction` refusals.
  - Re-test visual-input scaffolding, which is no longer needed for most inputs.
  - New failure mode: in unattended loops it can end a turn with a progress report. The fix is a harness change plus a system-prompt paragraph naming the specific early-stop patterns.

  — [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
- **Sonnet 5.5 (official):**
  - Effort levels are recalibrated against Sonnet 5.
  - At low/medium effort it may check in before finishing and may skip verification at `low`, so a concrete "run a real check" paragraph is recommended.
  - At every effort level it "tends to add tests, documentation, and small supporting files", more so at higher effort.
  - At xhigh/max it starts its own review rounds and reviewer subagents. A scope paragraph "stopped the model from launching reviewer subagents and cut session cost by about a third, with no change in quality".

  — [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
- **Note the reversal between Opus 5 and Sonnet 5.5 on verification (official).** Opus 5 says remove verification instructions. Sonnet 5.5 at `low` effort benefits from an explicit, concrete verification rule. Advice is model- and effort-specific. The general guide says: "Where a technique names a specific model, treat it as measured on that model and re-check it against your own evals before applying it to another." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices); [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
- **Formatting instructions can now over-correct (official):** The long "avoid excessive markdown" snippet is flagged for Fable 5.1, which "already formats less than earlier models, so on that model a block like this can suppress structure the content needs". — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Claude Code tooling for migration (official):** `/doctor prompt-audit` looks for "instructions written for older models, references to files or commands that don't exist, and files that contradict each other" across CLAUDE.md, AGENTS.md, rules, skills, commands, subagents and output styles. — [Claude Code docs, memory](https://code.claude.com/docs/en/memory)
- Formal migration guides exist but mainly cover API changes: [Opus 5.5 migration guide](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide) and [Sonnet 5.5 migration guide](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide). They were referenced but not fetched; prompting-relevant content is on the per-model prompting pages cited above.

### Inferences
- Any persistent rule set should be pruned of the following "legacy boosters":
  - "be thorough / if in doubt use X"
  - "ALWAYS verify / double-check"
  - "think step by step / show your reasoning"
  - "summarise progress every N steps"
  - "CRITICAL/MUST" on tool triggers
  - vague qualitative filters
- Keep verification rules only where they are concrete and tied to an observed failure, such as Sonnet 5.5 at low effort or in long unattended runs. Generic verification boilerplate is a cost on Opus 5/5.5.
- Rules that cover several model tiers should avoid model-specific booster lines. Effort and harness settings are the preferred lever for depth and thinking.

### Gaps
- No public Anthropic changelog lists prompting differences between Claude 3.x and Claude 4 specifically. The current docs fold that history into general guidance.
- Practitioner summaries of Opus 5.5 guidance (Search Engine Journal, otio, claudefa.st, explainx) were found in search but not fetched (egress blocked). The official pages are the primary source.

## Q3. How long should always-loaded instruction files be? Evidence on instruction count and length vs adherence

### Takeaway
Anthropic officially recommends keeping each CLAUDE.md under about 200 lines, cutting anything Claude can infer, and moving conditional material into path-scoped rules or skills. Skills should stay under 500 lines.

The research picture is mixed:
- Large-scale instruction-density benchmarks show adherence drops as instruction count grows.
- A 2026 study found repo context files do not improve SWE task success and raise cost by over 20%.
- A factorial study on Claude Code found no detectable effect of file size or position on adherence to a single instruction.
- One study found AGENTS.md reduces runtime and tokens.

The safest reading: short, non-redundant files that contain only non-inferable, non-standard information.

### Cited Findings
**Official guidance**
- "**Size**: target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence. Move instructions that matter for only part of the codebase into path-scoped rules… Imports help you organize a long file but don't reduce its context cost." — [Claude Code docs, How Claude remembers your project](https://code.claude.com/docs/en/memory)
- "The more specific and concise your instructions, the more consistently Claude follows them." Claude Code loads a CLAUDE.md up to 4 MiB in full, but "Shorter files produce better adherence." Auto-memory `MEMORY.md` is truncated at "first 200 lines or 25KB". — [Claude Code docs, memory](https://code.claude.com/docs/en/memory)
- "Keep it concise. For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" Failure pattern "The over-specified CLAUDE.md": "If your CLAUDE.md is too long, Claude ignores half of it because important rules get lost in the noise. Fix: Ruthlessly prune. If Claude already does something correctly without the instruction, delete it or convert it to a hook." — [Claude Code docs, Best practices](https://code.claude.com/docs/en/best-practices)
- The Best practices page gives an include/exclude table:
  - Include: bash commands Claude can't guess, style rules that differ from defaults, test instructions, repo etiquette, project-specific architectural decisions, environment quirks, gotchas.
  - Exclude: anything inferable from code, standard conventions, detailed API docs, frequently changing info, long tutorials, file-by-file descriptions, self-evident practices like "write clean code".

  — [Claude Code docs, Best practices](https://code.claude.com/docs/en/best-practices)
- "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost." — [Claude Code docs, Best practices](https://code.claude.com/docs/en/best-practices)
- Skills: "Keep SKILL.md body under 500 lines for optimal performance." The guide's "Default assumption: Claude is already very smart. Only add context Claude doesn't already have. Challenge each piece of information: 'Does this paragraph justify its token cost?'" It also says to keep references one level deep and add a table of contents to reference files over 100 lines. — [Anthropic, Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- "LLM performance degrades as context fills. When the context window is getting full, Claude may start 'forgetting' earlier instructions." — [Claude Code docs, Best practices](https://code.claude.com/docs/en/best-practices)

**Research**
- **IFScale (Distyl AI, arXiv 2507.11538, July 2025; NeurIPS workshop):** 500 keyword-inclusion instructions, tested from 10 to 500 instructions across 20 models. "Even the best frontier models achieved only 68% accuracy at maximum density (500 instructions)". Reasoning models degrade more slowly at moderate densities (100–250). "Omission is the dominant failure mode." Caveat: these are synthetic keyword-inclusion tasks, not coding rules. — [IFScale summary (alphaXiv)](https://www.alphaxiv.org/abs/2507.11538); [arXiv 2507.11538](https://arxiv.org/abs/2507.11538)
- **Evaluating AGENTS.md (Gloaguen, Mündler, Müller, Raychev, Vechev; ETH Zurich / LogicStar; arXiv 2602.11988, Feb 2026):**
  - Agents tested: Claude Code with Sonnet 4.5, Codex with GPT-5.2 and GPT-5.1 mini, and Qwen Code.
  - Conditions: no context file, an LLM-generated file, and a developer-written file.
  - Context files "do not generally improve task success rates, while increasing inference cost by over 20% on average".
  - LLM-generated files reduced success slightly (about −0.5% on SWE-bench Lite and −2% on AGENTbench). Developer-written files gave about +4% on AGENTbench.
  - "Instructions in the context files are well followed", but "repository overviews… are not helpful".
  - Recommendation: describe only minimal, non-standard requirements, and evaluate before deploying.
  - Caveat: one aggregator reported GPT-4o figures that conflict with the agents listed above; treat per-model numbers from secondary sources with caution.

  — [arXiv 2602.11988](https://arxiv.org/abs/2602.11988); [InfoQ coverage, Mar 2026](https://www.infoq.com/news/2026/03/agents-context-file-value-review/); [Upsun summary](https://developer.upsun.com/posts/ai/agents-md-less-is-more)
- **Instruction Adherence in Coding Agent Configuration Files: factorial study (arXiv 2605.10039, May 2026):**
  - Scale: 1,650 Claude Code CLI sessions and 16,050 function-level observations on two TypeScript codebases, mainly Sonnet 4.6 and replicated on Opus 4.6.
  - Four variables tested: file size, instruction position, file architecture (single vs hierarchical), and presence of a conflicting instruction. None of the four produced "a detectable contrast after multiple-testing correction". Size and conflict nulls had affirmative Bayes-factor support (BF10 0.05–0.10).
  - The largest effect was within-session drift: each additional function generated was associated with about 5.6% lower odds of compliance (OR = 0.944).
  - Caveat: it measured compliance with one trivial annotation rule, not many rules competing.

  — [arXiv 2605.10039](https://arxiv.org/abs/2605.10039); [Moonlight literature review](https://www.themoonlight.io/en/review/instruction-adherence-in-coding-agent-configuration-files-a-factorial-study-of-four-file-structure-variables)
- **Do Context Files Help Coding Agents? (Khatri, arXiv 2607.27250, July 2026):**
  - Setup: Claude Code and Codex, 17 real tasks, 288 runs.
  - Conditions: no file, an always-on AGENTS.md, or selective retrieval of topic wiki files.
  - Result: context strategy "does not measurably move correctness on either agent (bounded to ≤10–15pp via equivalence testing)". Agents fail on "implementation skill… not missing repository knowledge".
  - It offers task-difficulty bands as an explanation for why earlier studies conflict.

  — [arXiv 2607.27250](https://arxiv.org/abs/2607.27250)
- **On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents (Lulla et al., arXiv 2601.20404, Jan 2026):**
  - Setup: Codex (gpt-5.2-codex), 10 repos, 124 PRs.
  - Results with AGENTS.md: median runtime fell 28.64% (98.57s to 70.34s) and median output tokens fell 16.58%, with comparable completion.
  - This partly contradicts the cost finding of 2602.11988.

  — [arXiv 2601.20404](https://arxiv.org/abs/2601.20404)
- **Configuration Smells in AGENTS.md Files (arXiv 2606.15828, June 2026):**
  - Of 100 popular open-source AGENTS.md/CLAUDE.md files, 91 had at least one smell.
  - Smell prevalence:
    - lint leakage (restating linter/formatter rules): 62%
    - context bloat: 42%
    - skill leakage (rarely used procedures in the always-loaded file): 35%
    - conflicting instructions: 28%
    - init fossilization (stale /init output): 24%
    - blind references: 16%
  - Coverage reports these smells waste tokens.

  — [arXiv 2606.15828](https://arxiv.org/abs/2606.15828); [InfoWorld](https://www.infoworld.com/article/4187057/ai-coding-agents-may-be-getting-bad-instructions-from-smelly-config-files.html)
- **Agent READMEs (arXiv 2511.12884, Nov 2025; ACM):**
  - Scale: 2,303 context files from 1,925 repos.
  - Files "evolve like configuration code through frequent, small additions" and are "complex, difficult-to-read artifacts".
  - Content: testing (75.9%), implementation details (70.8%) and architecture (68.1%) dominate; security (14.8%) and performance (14.5%) are rare.

  — [arXiv 2511.12884](https://arxiv.org/abs/2511.12884)

**Practitioner (single source, widely repeated)**
- HumanLayer claims "Frontier thinking LLMs can follow ~150-200 instructions with reasonable consistency", that Claude Code's own system prompt holds about 50 instructions, and that as instruction count rises "instruction-following quality decreases uniformly". Their root CLAUDE.md is under 60 lines, and they say "general consensus is that < 300 lines is best". They recommend progressive disclosure and not using linting rules as instructions. The 150–200 figure appears to be extrapolated from IFScale-style results; it is not a measured property of Claude 5.x. — [HumanLayer, Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) (via search snippets; page fetch blocked)

### Inferences
- Do not cite an "instruction budget" number as fact for 5.5-class models. The official limit is a heuristic (200 lines). The best Claude-specific controlled study (2605.10039) found file size did not measurably matter for a single salient rule. The broader evidence (IFScale, Anthropic docs, smells study) still favours brevity, because cost rises and rules can get lost when many compete.
- The strongest research-backed content filter is to include only non-standard, non-inferable requirements and executable commands. Skip repo overviews, linter-enforced style and rarely used procedures; put the last of these in skills or path-scoped rules.
- Within-session drift (2605.10039) and context fill (Anthropic docs) suggest that how long a session runs matters more for adherence than how the file is laid out. Mechanical rules belong in hooks or linters, not prose.

### Gaps
- No study found tests instruction-count scaling specifically on Opus 5.5 or Sonnet 5.5.
- The full texts of 2602.11988, 2605.10039 and 2607.27250 could not be fetched (arxiv blocked), so the numbers come from abstracts and secondary summaries.

## Q4. Does stating rationale improve adherence or generalisation? Do RFC 2119 levels help?

### Takeaway
Anthropic officially and repeatedly endorses giving the reason behind instructions, and says Claude "generalizes from the explanation". No controlled study measuring rationale vs no-rationale on Claude 5.x was found. No empirical evidence was found that RFC 2119 keywords improve adherence for Claude. Anthropic's guidance points the other way: use emphasis sparingly and avoid aggressive MUST language, which over-triggers.

### Cited Findings
- "Providing context or motivation behind your instructions… can help Claude better understand your goals… Claude is smart enough to generalize from the explanation." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) (official)
- "Give the reason, not only the request… context lets it connect the task to relevant information rather than inferring intent on its own." — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) (official)
- Emphasis guidance in Claude Code: "If Claude keeps skipping one instruction, add emphasis such as 'IMPORTANT' to that line alone. If you emphasize many lines, none of them stands out." — [Claude Code docs, Best practices](https://code.claude.com/docs/en/best-practices) (official)
- The skill-authoring guide's iteration example lists "using stronger language such as 'MUST filter' instead of 'always filter'" as one possible fix when a rule is missed. So targeted emphasis after an observed failure is endorsed, while blanket emphasis is not. — [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (official)
- Anthropic's strict/flexible template pattern ("ALWAYS use this exact template structure" vs "Here is a sensible default format, but use your best judgment") shows that the strength of wording should match how strict the requirement really is. Its "degrees of freedom" principle says the same: give exact commands for fragile operations and heuristics for open-ended ones. — [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (official)
- RFC 2119 in agent SOPs: AWS's open-sourced Agent SOPs use MUST/SHOULD/MAY, and coverage says they were "widely adopted inside Amazon". The claimed benefit is clarity about what is mandatory vs optional. This is adoption evidence, not a controlled adherence study. — [InfoWorld, AWS Agent SOPs](https://www.infoworld.com/article/4095173/aws-open-sources-agent-sops-to-simplify-ai-agent-development.html) (single source / practitioner)
- One industry post reports that "steering hooks" (deterministic runtime checks) reached 100% accuracy where prompts and workflows failed. This supports enforcing must-rules outside the prompt. — [Strands Agents blog](https://strandsagents.com/blog/steering-accuracy-beats-prompts-workflows/) (single source, not fetched)
- Anthropic: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens." "Use hooks for actions that must happen every time with zero exceptions." Also: "To block an action regardless of what Claude decides, use a PreToolUse hook." — [Claude Code docs, Best practices](https://code.claude.com/docs/en/best-practices); [memory](https://code.claude.com/docs/en/memory) (official)

### Inferences
- A defensible design: write rules in plain imperative voice with a short "because…" clause. Reserve one emphasis marker for the rare rule shown to be skipped. Move true MUST-level invariants into hooks, permissions or linters rather than relying on keyword strength.
- If RFC 2119 words are used for human readability, use them sparingly and consistently. Do not apply MUST to every line; Anthropic's "if you emphasize many lines, none of them stands out" applies directly.

### Gaps
- No controlled study was found on whether rationale clauses improve adherence or generalisation for Claude 4.x/5.x. Anthropic's claim is official but anecdotal; no data is given.
- No empirical study was found on RFC 2119 keywords and LLM adherence.

## Q5. Guidance on avoiding over-engineering, over-eager actions, excessive commenting and verbosity

### Takeaway
Anthropic publishes ready-made, tested system-prompt paragraphs for each of these behaviours. The latest versions (Fable 5, Opus 5, Sonnet 5.5) are shorter and more principle-based than the 4.5/4.6 versions. Several report measured effects, such as a one-third cost cut on Sonnet 5.5 with no quality loss.

### Cited Findings
- **Over-engineering (Opus 4.5/4.6 era, still in the general guide):** "Avoid over-engineering. Only make changes that are directly requested or clearly necessary." The paragraph then covers four areas:
  - Scope: "A bug fix doesn't need surrounding code cleaned up".
  - Documentation: "Don't add docstrings, comments, or type annotations to code you didn't change. Only add comments where the logic isn't self-evident".
  - Defensive coding: "Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries".
  - Abstractions: "Don't create helpers… for one-time operations. Don't design for hypothetical future requirements. The right amount of complexity is the minimum needed for the current task."

  — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) (official)
- **Fable 5 version (shorter):** "Don't add features, refactor, or introduce abstractions beyond what the task requires… Don't design for hypothetical future requirements: do the simplest thing that works well. Avoid premature abstraction and half-finished implementations… Don't use feature flags or backwards-compatibility shims when you can just change the code." — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) (official)
- **Scope (Opus 5):** "Deliver what was asked, at the scope intended. Make routine judgment calls yourself, and check in only when different readings of the request would lead to materially different work. If the request seems mistaken or a better approach exists, say so in a sentence and continue with the task as asked rather than quietly narrowing, widening, or transforming it." — [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) (official)
- **Unrequested additions (Sonnet 5.5):** "When the work the user asked for is done and checked, stop and report. Don't add features, tests, files, docs or refactors that weren't asked for. If you think one would help, mention it at the end instead of doing it." A separate review-rounds paragraph "cut session cost by about a third, with no change in quality". — [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5) (official)
- **Over-eager actions / boundaries (Fable 5):** "When the user is describing a problem, asking a question, or thinking out loud rather than requesting a change, the deliverable is your assessment. Report your findings and stop. Don't apply a fix until they ask for one." The general guide adds the `<do_not_act_before_instructions>` and `<default_to_action>` snippets, and a reversibility paragraph listing destructive, hard-to-reverse and externally visible actions that need confirmation. — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5); [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) (official)
- **Open-ended requests (Sonnet 5.5):** "When the user asks for ideas, options or a plan, give them that and stop. Don't start building or changing anything until they say to go ahead." — [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5) (official)
- **Comments:** Fable 5 lists "writing comments that narrate what the next line does" among the elaborations that a short brevity instruction removes. — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) (official)
- **Verbosity:**
  - Opus 5: "Keep responses focused, brief, and concise…". For long system prompts, pair it with a short reminder near the end.
  - Opus 5, for documents written to disk: "Match the length of written documents to what the task needs… do not pad with filler sections, redundant summaries, or boilerplate."
  - Fable 5: "Lead with the outcome…" and "The way to keep output short is to be selective about what you include… not to compress the writing into fragments, abbreviations, arrow chains."

  — [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5); [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) (official)
- **Hard-coding to tests:** a paragraph asking for general-purpose solutions, and "If the task is unreasonable or infeasible, or if any of the tests are incorrect, please inform me rather than working around them." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) (official)
- **Temp files:** "If you create any temporary new files, scripts, or helper files for iteration, clean up these files by removing them at the end of the task." — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) (official)
- **Subagent overuse:** Opus 5 sample: "Do not delegate work you can finish yourself in a handful of tool calls, and do not use subagents to verify or double-check your own work." Deterministic caps are also available: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`. — [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) (official)
- **Review-driven over-engineering:** "A reviewer prompted to find gaps will usually report some, even when the work is sound… Chasing every finding leads to over-engineering: extra abstraction layers, defensive code, and tests for cases that can't happen. Tell the reviewer to flag only gaps that affect correctness or the stated requirements." — [Claude Code docs, Best practices](https://code.claude.com/docs/en/best-practices) (official)
- **Effort as an alternative lever:** Sonnet 5.5 additions increase with effort, and Opus 4.8 at low/medium "scopes its work to what was asked". Effort is a non-prompt lever for scope. — [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5); [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8) (official)

### Inferences
- A coding-agent rule set can reuse Anthropic's own wording almost verbatim for scope, minimal changes, comments, defensive coding and stopping/reporting. It is pre-tested and in the style the models respond to.
- There is tension between "keep working until done" (Opus 5.5, Fable 5, Sonnet 5.5) and "stop and report, don't add extras". Anthropic resolves it by naming exactly which stops are wanted: blocked, destructive, or a real scope change. Rules should do the same rather than saying "ask when unsure".

### Gaps
- Most of these effects are reported by Anthropic without published eval details. Only a few give numbers (Sonnet 5.5 cost reduction; Opus 5.5 progress reminders "roughly halved" silent stretches).

## Q6. Non-obvious tips (practitioner discoveries and less-visible doc details)

### Takeaway
Several of the most useful details are buried in the docs:
- CLAUDE.md arrives as a user message, not the system prompt.
- HTML comments in CLAUDE.md are stripped before loading.
- Contradictions across files make Claude choose arbitrarily.
- Model-specific default styles resist generic negatives.
- Text injected after every tool result can be mistaken for prompt injection.

### Cited Findings
- "CLAUDE.md content is delivered as a user message after the system prompt, not as part of the system prompt itself… there's no guarantee of strict compliance, especially for vague or conflicting instructions." For system-prompt-level instructions, use `--append-system-prompt`. — [Claude Code docs, memory](https://code.claude.com/docs/en/memory) (official)
- "Block-level HTML comments (`<!-- maintainer notes -->`) in CLAUDE.md files are stripped before the content is injected into Claude's context." You can therefore leave notes for human maintainers at no token cost. — [Claude Code docs, memory](https://code.claude.com/docs/en/memory) (official)
- "If two instructions contradict each other, Claude may pick one arbitrarily." This holds between user-level and project rules too: "Neither set overrides the other." Claude Code's built-in git/PR instructions can compete with your own; turn them off with `includeGitInstructions`. — [Claude Code docs, memory](https://code.claude.com/docs/en/memory) (official)
- Project-root CLAUDE.md is re-read from disk after `/compact`. Nested CLAUDE.md and `paths:`-scoped rules reload when matching files are read. You can also put compaction instructions in CLAUDE.md ("When compacting, always preserve the full list of modified files…"). — [Claude Code docs, memory](https://code.claude.com/docs/en/memory); [Best practices](https://code.claude.com/docs/en/best-practices) (official)
- Write rules "concrete enough to verify": "Use 2-space indentation" not "Format code properly"; "Run `npm test` before committing" not "Test your changes". Group related rules under headers and bullets, since "Organized sections are easier for Claude to follow than dense paragraphs." — [Claude Code docs, memory](https://code.claude.com/docs/en/memory) (official)
- In the skill authoring guide:
  - Write skill descriptions in third person, because they are injected into the system prompt.
  - Use consistent terminology ("Always 'API endpoint'").
  - Give a default plus an escape hatch rather than many options.
  - Keep references one level deep, because Claude may `head -100` nested files.
  - Avoid time-sensitive statements.

  — [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (official)
- Evaluation-driven instruction writing: run without the instruction first, document the failures, write minimal instructions that fix them, and compare against the baseline. One Claude instance writes the instructions and a fresh one tests them. — [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (official)
- Model house styles survive generic negatives:
  - Opus 4.8's default cream/serif/terracotta style: "Generic instructions ('don't use cream,' 'make it clean and minimal') tend to shift the model to a different fixed palette."
  - Opus 5.5: "avoid a generic AI look" "mostly swaps one default for another".
  - The fix is a concrete specification or named patterns.

  — [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8); [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) (official)
- Sonnet 5.5 can treat harness text placed after tool results (token countdowns, per-step instructions) as prompt injection and ignore genuine user messages. Never put user text inside `tool_result`. — [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5) (official)
- Showing remaining-token countdowns triggers "context-budget concern" (suggesting new sessions or trimming work) on Fable 5. Avoid them, or add reassurance. — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) (official)
- Grounding progress claims: "Before reporting progress, audit each claim against a tool result from this session…" In Anthropic's testing this "nearly eliminated fabricated status reports". — [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) (official)
- Opus 5.5 multi-app tip: a one-sentence "explore broadly before acting" instruction "completed noticeably more" tasks correctly. — [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) (official)
- Long-system-prompt reminder: in a long system prompt, pair a conciseness instruction with "a short reminder near the end of the prompt". — [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) (official)
- In 1,925 repos, context files "evolve like configuration code through frequent, small additions". The smells study shows that build-up as bloat, stale /init output and contradictions. Treat CLAUDE.md "like code: review it when things go wrong, prune it regularly, and test changes by observing whether Claude's behavior actually shifts." — [Agent READMEs, arXiv 2511.12884](https://arxiv.org/abs/2511.12884); [Configuration smells, arXiv 2606.15828](https://arxiv.org/abs/2606.15828); [Claude Code best practices](https://code.claude.com/docs/en/best-practices) (research + official)
- Practitioner: do not use the LLM as a linter. Put style rules in deterministic tooling and keep CLAUDE.md short via progressive disclosure (pointers to docs read on demand). — [HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md) (single source; matches the "lint leakage" smell in 2606.15828)

### Inferences
- Because CLAUDE.md is a user message, and contradictions between user rules, project rules and the harness's built-in instructions resolve arbitrarily, a rule set should be audited against the harness's own system prompt (e.g. git/commit guidance) to avoid duplicates and conflicts.
- HTML comments give a free place to record rationale and provenance for human maintainers when you do not want to spend tokens on it. Use this only where the rationale is not needed by the model; per Q4, short in-line reasons help the model.

### Gaps
- Much practitioner material (SEJ, claudefa.st, explainx, Simon Willison) could not be fetched because of egress blocks. Practitioner findings here rely mostly on HumanLayer via search snippets.
- No independent replication was found of Anthropic's internal measurements on 5.5-class prompting effects.
