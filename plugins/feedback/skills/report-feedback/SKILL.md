---
name: report-feedback
description: Draft feedback about rules-for-robots (its rules, rfr-core, rfr-process, or this plugin) as an issue for the rules-for-robots repository, remove project details, check the draft for private details, and file it only after the user confirms. Use when the user asks to report feedback, send a finding to rules-for-robots, or file a rules-for-robots issue.
argument-hint: "[what to report]"
---

# Report feedback to rules-for-robots

rules-for-robots is a **public** repository: an issue filed there can be read by anyone and may be indexed. The user decides what is published. Never file without their explicit confirmation of the final draft in this conversation.

`<feedback.mjs>` below is `${CLAUDE_SKILL_DIR}/../../scripts/feedback.mjs` when this plugin is installed. If it is not (you are following this file from a rules-for-robots checkout), it is `<checkout>/plugins/feedback/scripts/feedback.mjs`; it has no dependencies and makes no network requests.

1. **Gather the finding.** From `$ARGUMENTS` and the conversation: what happened, what was expected, and what would help. One issue per finding; split unrelated findings.
2. **Find the versions.** The installed plugin versions (`/plugin` lists them), or the rules-for-robots commit or tag the project's workflows use (the `uses:` and `rules-ref` lines in `.github/workflows/`).
3. **Draft in general terms.** Write the draft as JSON in a temporary file outside the project (fields: `title`, `area`, optional, one of rfr-core, rfr-process, rfr-feedback, rules, evals, profiles, other, left out if unclear; `profiles` is for a suggested new profile or domain plugin, whose draft says what kind of project it is and how to recognise one, what it had to borrow or do without, and why a profile would help; `versions`; `happened`; `evidence`; `suggestion`; `source`, an optional general description such as "a static site in solo mode"). Leave out, unless the user asks to include them: the project's name and people's names, private repository links and pull request numbers, file paths beyond the rules-for-robots files involved, code and content from the project, and business details. Keep what rules-for-robots needs: the check, skill, rule, or template involved, the message or output (with private parts replaced by `<...>`), and a minimal example.
4. **Scan it.** Run `node <feedback.mjs> check <draft.json>`. Remove each finding, or keep it only if the user says it is safe to publish.
5. **Check each claim, then show the draft and ask.** Re-read every statement in the draft against your notes and the evidence, and remove any you cannot support (a re-run that passed, a cause you guessed); the scan cannot catch these. Then show the title and every field exactly as they will be filed, say that the issue will be public, and ask whether to submit it or change it. Change it as the user asks and show it again. Their answer to this question is the confirmation; filing follows it directly, with nothing more for them to do.
6. **File it** when the user confirms, by the first route that works, and tell them the new issue's link and which route filed it:
   1. **`gh`**, where it is signed in and can create issues (a local terminal or the desktop app): `node <feedback.mjs> body <draft.json> > <body.md>`, then `gh issue create --repo lifelike-and-believable/rules-for-robots --title "Feedback: <title>" --body-file <body.md> --label feedback`. If the label is refused, file without it; the title marks it as feedback.
   2. **The GitHub tools**, in a cloud session, where `gh` cannot create issues: if rules-for-robots is not attached to the session, attach it (`add_repo` with owner `lifelike-and-believable`, repo `rules-for-robots`), then create the issue with the GitHub issue tool, using the title `Feedback: <title>`, the output of `node <feedback.mjs> body <draft.json>` as the body, and the label `feedback`. Attaching a repository usually needs the user to have push access to it; if attaching or creating is refused, go to the next route and say why.
   3. **The form link**, only when neither route can file: `node <feedback.mjs> url <draft.json>`, and give the user the link to open, check, and submit. If the link is too long, shorten the evidence.
7. **Delete the temporary files.** Note the issue in the project's own notes if the user keeps a log of findings.

To check on earlier feedback: `gh issue list --repo lifelike-and-believable/rules-for-robots --author @me --label feedback --state all`.
