# Does the main session call software-architect unprompted?

Change 4 of the architect follow-up (#187). Cases `arch-money-storage`, `arch-greenfield-webapp`, `arch-greenfield-uplugin`; main session Sonnet 5.5; the `rules+hooks` arm, which loads rfr-core but, unlike `rules+agents`, never names the agent in the prompt; 2 runs per case. Claude Code 2.1.322.

| Plugin | Architect description | Architect called | Passed | Cost |
|---|---|---|---|---|
| Before #187 (`129a763`, through `RFR_PLUGIN_DIR`) | "Experimental. Designs the structure ... Use before implementation when ..." | 0 of 6 | 6 of 6 | $2.37 |
| After #187 (`69d8243`) | "Use proactively, before any code is written, when starting a new project ..." | 0 of 6 | 5 of 6 | $2.23 |

The sessions could call it: each run's `init` event lists `rfr-core:software-architect` among the agents, with the Task tool available. None tried, with either description.

## What it shows

- Asked directly for a design, the main session does the design itself. The agent's description does not change that, so outside `plan-feature` (which asks for the architect since #187) and `tech-lead`, the architect runs only when someone names it.
- A core rule with the same triggers is the remaining lever. It would slow every design task (five to seven times in the October and November rounds) for a gain measured so far only on small cases (about 9/9 against 7/9). The pipeline round (`evals/README.md`) should come first: if the architect clearly beats the main session on large multi-component designs, a rule can trigger on those alone.

## Limits

Two runs per case, one main-session model, and direct design requests only; `plan-feature`'s new design step is not exercised here.
