# Before you start

Part of the [rfr-process guide](../GUIDE.md).

## Every change is a change to the whole

Every change, to even the smallest component, is a change to the whole of the project, the way every brushstroke on a canvas, no matter how minute, is a change made to the whole painting. So a change is judged by what it does to the whole product, not only by the lines in its diff.

The process separates two questions. The first is which approvals a change reopens. Here the answer is deliberately narrow: only artifacts that link directly to a changed section go stale, not everything downstream of it, so that each re-approval is about something that actually changed. Even links to whole artifacts were too broad: in the pilot, one edit made ten approved artifacts stale, which is why artifacts link to sections. The second is what a change is checked against, and here the answer is the whole:

- Every change, including `tier:trivial`, runs the full regression suite, not only the tests near the edit.
- The process check runs again on the default branch after every merge, because two pull requests that each pass can leave the whole stale together.
- Requirements are read across all areas and against the concept before approval, and against every persona once there are personas.
- A change to the build or deployment is checked on the pull request's own deployment, where the whole site runs.

When you review or write a change, ask what else in the product it touches beyond the files it edits: a page that shows the same data, a promise in the user documentation, a persona's frustration, a setting another feature reads. A small change that is right in its own file can still be wrong for the whole.

## Before you start: a repository

Start the process in a git repository, before the first artifact is written. Approval is a merged pull request, so drafts written in a plain folder have no history and no way to be approved until they are moved. If there is no repository yet, create one (`git init`, then a remote), and make the first commit with `process.yml`, the workflow, and the artifacts as drafts (`status: draft`) on the default branch: that commit is set-up, not an approval, needs no pull request, and the approvals job skips it because it has no parent. If the repository already has commits, add the drafts in a pull request instead (the one that adds `process.yml` needs no tier label); a direct push of process files to the default branch opens a `process-approval` issue in solo mode. From then on every change goes through a pull request, and the pull request that sets an artifact to `approved` is its approval.

## Before you start: the size tier

Pick the tier before writing anything: it decides where you start. A pull request that changes source must belong to a feature with an approved spec, or say `Change: fix` or `Change: trivial` at the end of a commit message; the `process / change` check holds it to that claim (a fix changes a test and adds no source file; a trivial change adds no source file and touches no `public-api` path).

| Tier | Use it when | Start at |
|---|---|---|
| `tier:trivial` | Nothing a user could notice changes: a typo in code, a dependency bump, a refactor | Implementation |
| `tier:fix` | The approved stories or user documentation already describe the right behaviour, and the product does something else | A failing test that reproduces the bug |
| `tier:story` | A new capability inside an approved epic | User stories |
| `tier:epic` | A new area of capability | Epics, after checking whether requirements or personas change |

Size a request by what it changes, not by what it is called. A "feature request" with one obvious right behaviour (the product already does it that way elsewhere), no design choice, and no user documentation that describes the old behaviour is a `tier:fix`: a failing test, then the change. If the fixed behaviour deserves a line in the user documentation, add it in a separate small pull request, because a `tier:fix` may not change `docs/user/`. A request that needs a design decision, or changes what the documentation says, is a story whatever it was called.

If a fix turns out to need a change to the user documentation, it is a story. So is any pull request that adds or changes a design or user documentation, however small the change it describes: a short design for a one-line fix still takes `tier:story`. The tier job infers this from the documentation folders, and fails a lower label; after changing a label, re-run it. The one pull request with no tier is the one that adds `process.yml`: adopting the process fits none of them, so the tier check lets it through.
