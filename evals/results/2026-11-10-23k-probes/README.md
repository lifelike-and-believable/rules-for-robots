# 23k: two probes for the maintainer (set up 2026-11-10, not yet run)

Process plan slice 23k. Both probes are judged by the maintainer, not graded, and each takes one feature. Their results decide whether provisional delivery (23d) gets built, and how. Nothing after 23c is built until they are recorded here.

I have not created the branches: both are in a pilot repository, and pushing there reaches outside this one. The steps below are exact; each takes a few minutes to set up.

Suggested project: the Kettlebird website (`lifelike-and-believable/kettlebird-website`). It has the longest rfr-process history (96 gated pull requests), a running preview deployment, and tutorials CI can drive, so the trial needs no manual tutorial pass. Pick a small story the lead already wants; the same story should not be used for both probes.

## Probe 1: the counterfactual

Question: with no rfr plugins, rules, or process files, does a current model, given a request worded as the maintainer would have worded it before rfr, produce what the maintainer wanted without breaking anything? If it does, the process can be lighter still. The expected answer is no, because the missing piece is intent, not skill.

Set up, on the maintainer's machine:

```
git clone https://github.com/lifelike-and-believable/kettlebird-website kb-counterfactual
cd kb-counterfactual
git switch -c probe/counterfactual
git rm -r -q docs/product docs/design docs/user docs/tutorials .github/workflows/rfr-process.yml .github/workflows/rfr-tutorials-preview.yml
git rm -q CLAUDE.md          # it describes the rfr process and the lead's standing decisions
# Keep docs/specs only if none has an id: front matter; otherwise remove those files too.
mkdir -p .claude
cat > .claude/settings.json <<'JSON'
{ "enabledPlugins": { "rfr-core@rules-for-robots": false, "rfr-web@rules-for-robots": false, "rfr-process@rules-for-robots": false, "rfr-feedback@rules-for-robots": false } }
JSON
git add -A && git commit -m "Probe: remove rfr for the counterfactual"
```

Do not push the branch. Start a session there with the model you use today (`claude` in that folder), check with `/plugin` that no rfr plugin is enabled, and give the feature request in one or two sentences, the way you would have written it before rfr. Answer the agent's questions as you normally would, and keep a note of how many times you had to correct it.

Record, in your own words: was the result what you wanted, did anything break, and how many corrections it took.

## Probe 2: one feature in the lighter mode, by convention

Question: if agents build while the maintainer reviews a single feature packet, does the result match what was wanted, does anything break, and does seeing a build early help or anchor the maintainer?

No new tooling is needed. In a normal checkout of the project, on two branches:

1. `packet/<story>`: the agent writes the story, the design with mock-ups, and the user documentation in one pull request, with the review packet at the top of its description (`node .rfr/checks/process-packet.mjs . --base origin/main`, from #173). This pull request waits for your review as usual.
2. `build/<story>`, branched from `packet/<story>`: the agent writes the spec, tests first, and the implementation straight away, without waiting for your review of the packet. Open it as a draft. Its process check fails link rule 3 (a spec linking to a draft upstream artifact); that is expected, and it must not merge before the packet does.
3. Review the packet in one sitting, with the build's preview deployment open beside it if it is ready. Ask for changes as usual. If the packet changes, the agent reworks the build branch; the staleness check shows what derived from the changed sections.
4. Merge the packet, then the build once its check is green.

Tell the agent, at the start: "Probe 23k: build the packet and the implementation in parallel on two branches as described in rules-for-robots evals/results/2026-11-10-23k-probes/README.md. Do not merge the build before the packet."

Record, in your own words: did the result match what you wanted, did anything break, and did seeing the build early help you judge the packet or anchor you on what was built. Note how much of the build was reworked after your review.

## Results

Not yet run. When both are done, add a short note here with your judgement quoted, and the plan's P3 and slice 23d are updated from it: if building early wasted work or anchored you, the packet review stays blocking and 23d builds only the reporting of provisional specs.
