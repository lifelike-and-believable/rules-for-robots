# Moving to rules-for-robots 8.0.0

8.0.0 is the release of the rewrite plan ([rewrite-plan.md](rewrite-plan.md)): the lead approves decisions in GitHub, never commands, and agents carry each approved feature to something the lead can try, without asking. It passed its acceptance test on XR Studio In A Box ([record](../evals/results/2026-11-13-25f-acceptance-slice4/README.md)). Decision D4 of the plan made it a clean break: XR Studio In A Box was moved by hand, and other projects move on request. This page lists what a project on 7.x changes, in order. The changelog has the detail for each item.

## What the lead does once

1. **Remove `process / tier` from the required checks** in the repository's branch protection. The job is gone; a pull request would wait for it for ever.
2. **Set up the GitHub gate**, if the project does not have it yet: the `rfr-agent` App installed on the repository, its key stored, and branch protection set by `node .rfr/checks/process-github-setup.mjs --apply` ([adoption guide](adoption-guide.md), "The GitHub gate"). Approval is then a review in GitHub, and no agent opens, approves, or merges a pull request.
3. **Optional: have merges start deliveries.** Copy `plugins/process/templates/workflows/rfr-deliver.yml`, create a Claude Code routine on the repository whose prompt is `/rfr-process:deliver`, add an API trigger and generate its token, and create an environment named `rfr-deliver`, limited to the default branch, holding the routine's address as the secret `RFR_DELIVER_ROUTINE` and its token as `RFR_DELIVER_TOKEN`. Without it, say "deliver it" after approving a packet. Runs count against the routine owner's Claude subscription.

## What changes in the repository

4. **Workflows.** Copy `rfr-open-pr.yml` again from the templates: it now titles each pull request after what it carries. If the project calls the reusable process workflow with `rules-ref` pinned, move the pin to the 8.0.0 tag.
5. **Tutorials are lasting user documentation, and the rules now fail.** The process workflow's `lasting-tutorials` input defaults to `fail`. A tutorial must be named for the task, name no machine or build (`localhost`, start commands, a "Run record" section), and be linked from the user documentation page it belongs to. Web tutorials are `runner: web`, and may act as several people (`As **Name**:`), sign in (`Sign in as **Name**.`), and start where another ends (`starts-from:`). A project that needs time to rewrite its tutorials sets `lasting-tutorials: warn` in the caller's `with:` and removes it when done.
6. **User documentation is organised by area** once the project adds a start page: `docs/user/README.md`, a folder for each area of the product with its own `README.md`, and every page in an area. A page may list what it covers in `covers:`. Ids do not depend on paths, so moving pages breaks no link. `node .rfr/checks/docs-map.mjs` shows the result.
7. **A place to try the product.** Add a `try:` block to `docs/product/process.yml` (the command that starts the product with known data, previews, tutorial sign-in for local and preview builds only, and what each place provides). The guide's validation part has a recipe and the four conditions for tutorial sign-in.
8. **Designs.** A design built in steps lists them as a numbered list at the start of "Notes for delivery"; a delivery records each step, and the feature stays open until all are built. Anything the delivery must know goes there too, not in chat.
9. **Mock-ups.** `node .rfr/checks/mockup-render.mjs docs/design/<folder>` renders a design's mock-ups and records what each was made from; the process check then catches a stale image. Untracked mock-ups are a warning only.

## What behaves differently

- **A stale spec or tutorial is open work, not a failure.** When approved user documentation changes, the specs and tutorials that cite it show as a revision open, and the next delivery brings them up to date. Documents (the concept through user documentation) still fail when they fall behind. A tutorial whose steps' words change goes back to draft, for the lead to follow again.
- **Changing something approved** is a revision: the `revise` skill runs `checks/process-impact.mjs` first, deals with every document that cites the change, and writes a reason for each one it only re-records. The pull request's description shows them apart from the real changes.
- **Every session is told where things stand** at its start, and a source change needs an approved spec unless a commit says `Change: fix` or `Change: trivial`.

## Plugins

Update rfr-core to 8.0.0 and rfr-process to 2.15.0 (or later): `/plugin marketplace update rules-for-robots`, then update each plugin. Cloud sessions take them from `main` and need nothing.
