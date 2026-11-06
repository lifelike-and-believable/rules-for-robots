# rfr-feedback

An optional plugin for projects that use rules-for-robots. It reports what a project learns (a check that misfired, a step the guide does not cover, a rule that got in the way) as a feedback issue on [rules-for-robots](https://github.com/lifelike-and-believable/rules-for-robots), so the maintainer can act on it without a session open in both projects. No other plugin depends on it; install it only if you want to send feedback.

```
/plugin install rfr-feedback@rules-for-robots
```

## Reporting

Ask the agent to report feedback, or run `/rfr-feedback:report-feedback` with a short description. The skill:

1. Drafts the issue in general terms, with the area, the versions you are using, what happened, the evidence, and a suggestion.
2. Removes project details by default: names, private links, code, content, and anything not yours to publish. **rules-for-robots is public, so the issue will be too.**
3. Scans the draft for likely private details (email addresses, tokens, home folder paths, IP addresses, links to other repositories) with `scripts/feedback.mjs check`.
4. Shows you the draft and files it only when you confirm: with `gh issue create` under your own GitHub login if `gh` is available, or by giving you a link to the repository's feedback form with every field filled in.

To see what happened to feedback you filed: `gh issue list --repo lifelike-and-believable/rules-for-robots --author @me --label feedback --state all`. A fix closes its issue from the pull request that makes it, and the changelog names that pull request.

## What happens next

On rules-for-robots, an intake job labels each new feedback issue, asks for missing versions, points out likely duplicates, and flags possible private details without repeating them. A scheduled session triages new feedback daily: it checks each claim against the code, groups reports of the same problem, and proposes changes. Nothing is built until the maintainer approves it. See `docs/specs/feedback.md` in rules-for-robots.
