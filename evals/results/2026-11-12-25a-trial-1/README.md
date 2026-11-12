# Trial 1: a pull request opened as a GitHub App, with the lead's review required on gated folders (2026-11-12)

The first trial of phase 25a in [the rewrite plan](../../../docs/rewrite-plan.md). The design moves approval and merging to GitHub, which needs a pull request the lead can approve. A session, local or cloud, pushes as the lead, and GitHub does not let an author approve their own pull request, so the pull request has to be opened by another identity.

**Result: passed.** Repository: [lifelike-and-believable/rfr-trial](https://github.com/lifelike-and-believable/rfr-trial) (public, throwaway).

## Setup

- A GitHub App, `rfr-agent`, owned by the organisation: repository permissions Contents and Pull requests set to read and write, no webhook, installable only on the organisation. Installed on `rfr-trial` alone.
- The App ID as the Actions variable `RFR_APP_ID`, and its private key as the Actions secret `RFR_APP_PRIVATE_KEY`.
- `.github/workflows/open-pr.yml`: on a push to `claude/**`, `phase-*/**`, or `feature/**`, mint an App token with `actions/create-github-app-token`, open a pull request for the branch if none is open, and turn on auto-merge.
- `.github/workflows/verify.yml`: `node --test` on every pull request.
- `.github/CODEOWNERS`: the lead owns `docs/product/`, `docs/design/`, `docs/user/`, and `docs/tutorials/`.
- Branch protection on `main`: the `verify` check required; code-owner review required with zero other approvals; approval of the most recent push not required; applied to administrators. Auto-merge allowed on the repository.

## What happened

| Step | Result |
|---|---|
| The session pushed `feature/code-only` (a function and its test) with the lead's credentials | Pull request #1 opened by `app/rfr-agent`; `verify` ran on it and passed; it merged with no one acting, 2026-11-12 16:50 UTC |
| The session pushed `feature/gated-design` (a change under `docs/design/`) | Pull request #2 opened by `app/rfr-agent`; `verify` passed; GitHub reported the merge blocked |
| The lead approved #2 in GitHub | Review recorded at 16:53:14 UTC; the pull request merged itself at 16:54:08 UTC |

All four pass conditions held: a pushed branch became a bot-authored pull request, CI ran on it, an ungated one merged itself when green, and a gated one waited for the lead's review and merged on it.

## Notes for the adoption guide (25b)

- The App needs only Contents and Pull requests, both read and write. Nothing was missing.
- The App's token is what makes CI run on the pull request; a pull request opened with a workflow's default token does not trigger workflows.
- With zero required approvals and code-owner review required, a pull request that touches no owned path needs no review, and one that does needs the owner's. That is the whole gate.
- The lead does three things by hand: create the App, install it on the repository, and store the private key as a secret. The rest (workflow, CODEOWNERS, branch protection, the variable, allowing auto-merge) a script can do with the lead's token.
- The first `gh repo create --push` failed to push and a plain `git push` straight after worked; a setup script should retry the push.
- Actions in the trial workflow are named by version tag. The shipped workflow pins them by commit.

## Not tested here

- The session holds the lead's token, so it could approve a bot-authored pull request as the lead. The plan keeps one refusal for that; this trial did not attempt it.
- A pull request updated by a later push after the lead approved. Whether the approval is dismissed is a branch protection setting, to decide in 25b.
- A private repository, and an organisation on GitHub's free plan (D7).
